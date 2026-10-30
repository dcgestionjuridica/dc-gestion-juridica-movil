// DC Gestión Jurídica · web para el celular (solo consulta).
// Lee de Supabase con la sesión de cada persona; las reglas de cada rol las aplica Supabase.
(function () {
  const L = window.DC_LOGICA;
  const cfg = window.DC_CONFIG;
  const $ = id => document.getElementById(id);
  const PORTAL = "https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion";

  const sb = window.supabase.createClient(cfg.url, cfg.clavePublica, { auth: { persistSession: true, autoRefreshToken: true } });
  let datos = null;
  let cargadoEn = 0;
  let vista = "inicio";
  let pestana = "vencimientos";
  let mensajes = { lista: [], abierto: null, hilo: [], error: "", filtro: "todos", eligiendo: false, clientesPortal: null, buscar: "" };

  function esc(t) {
    return String(t === null || t === undefined ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function nombreCliente(id) {
    const c = datos.clientesPorId[id];
    return c ? (c.nombres + " " + c.apellidos).trim() : "";
  }
  function numeroExpediente(id) {
    const e = datos.expedientesPorId[id];
    return e ? e.numero : "";
  }
  // Cada estado lleva color e ícono (rojo = vencido, ámbar = pronto, verde = hecho, azul = programado).
  const ICONO = { r: "ic-alerta", a: "ic-campana", v: "ic-check", z: "ic-reloj" };
  function punto(color) { return '<div class="pto ' + color + '"><svg><use href="#' + (ICONO[color] || "ic-reloj") + '"/></svg></div>'; }
  function titulo(icono, texto) { return '<span class="tit"><svg><use href="#' + icono + '"/></svg>' + texto + "</span>"; }
  function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function item(color, titulo, sub) {
    return '<div class="it">' + punto(color) + '<div class="crece">' + esc(titulo) +
      (sub ? "<small>" + sub + "</small>" : "") + "</div></div>";
  }
  function tarjeta(titulo, derecha, contenido, clase) {
    return '<div class="tarj ' + (clase || "") + '"><h3>' + titulo + (derecha ? " <span>" + derecha + "</span>" : "") + "</h3>" + contenido + "</div>";
  }
  function vacio(texto) { return '<div class="vacio">' + esc(texto) + "</div>"; }

  // ---------- Entrada y salida ----------
  function mostrarEntrada(mensaje) {
    $("app").classList.add("oculto");
    $("nueva-clave").classList.add("oculto");
    $("entrada").classList.remove("oculto");
    $("error-entrada").textContent = mensaje || "";
  }
  function mostrarApp() {
    $("entrada").classList.add("oculto");
    $("nueva-clave").classList.add("oculto");
    $("app").classList.remove("oculto");
  }
  $("form-entrada").addEventListener("submit", async ev => {
    ev.preventDefault();
    $("btn-entrar").disabled = true;
    $("error-entrada").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("correo").value.trim(), password: $("clave").value });
    $("btn-entrar").disabled = false;
    if (error) {
      $("error-entrada").textContent = /invalid/i.test(error.message) ? "Correo o contraseña incorrectos." : "No fue posible entrar: " + error.message;
      return;
    }
    $("clave").value = "";
    await iniciar(true);
    // 28/10/2026: después de entrar con contraseña se ofrece «Entrar con huella» (solo celular, una vez).
    if (window.DCHuella) DCHuella.ofrecer();
  });
  // 30/10/2026 (Darío): cerrar sesión borra la sesión del celular AL INSTANTE. Antes se esperaba la respuesta del
  // servidor y, si el internet estaba lento o se recargaba la página antes, la sesión quedaba guardada y volvía a entrar.
  async function cerrarSesion() {
    let token = "";
    try { const { data } = await sb.auth.getSession(); token = (data.session && data.session.access_token) || ""; } catch (e) {}
    try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    if (token) fetch(cfg.url + "/auth/v1/logout?scope=global", { method: "POST", keepalive: true,
      headers: { apikey: cfg.clavePublica, Authorization: "Bearer " + token } }).catch(() => {});
    try { await sb.auth.signOut({ scope: "local" }); } catch (e) {}
  }
  if (window.DCHuella) DCHuella.montar(sb, "movil", () => iniciar(true));
  $("btn-salir").addEventListener("click", async () => {
    await cerrarSesion();
    try { localStorage.removeItem("dc-movil-ultimo-uso"); } catch (e) {}
    datos = null;
    mostrarEntrada("");
  });
  $("btn-actualizar").addEventListener("click", () => cargar());

  // ---------- Datos ----------
  async function leer(consulta) {
    const { data, error } = await consulta;
    if (error) throw error;
    return data || [];
  }
  async function cargar() {
    $("cuerpo").innerHTML = '<div class="cargando" aria-label="Cargando"><div></div><div></div><div></div></div>';
    try {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) { mostrarEntrada(""); return; }
      const uid = s.session.user.id;
      const [perfiles, clientes, expedientes, vencimientos, terminos, eventos, tareas, agenda, vigilancia, filasMsj] = await Promise.all([
        leer(sb.from("perfiles").select("nombre,rol,activo").eq("id", uid)),
        leer(sb.from("clientes").select("id,nombres,apellidos,archivado")),
        leer(sb.from("expedientes").select("id,cliente_id,numero,estado,fecha_apertura,archivado_en")),
        leer(sb.from("vencimientos_juridicos").select("id,termino_id,expediente_id,cliente_id,titulo,fecha_vencimiento,estado,responsable")),
        leer(sb.from("terminos_juridicos").select("id,evento_id,fecha_inicio,fecha_vencimiento,cantidad,unidad")),
        leer(sb.from("eventos_juridicos").select("id,expediente_id,fecha_evento,tipo_evento")),
        leer(sb.from("tareas_juridicas").select("id,vencimiento_id,titulo,responsable,fecha_limite,estado")),
        leer(sb.from("eventos_agenda").select("id,titulo,descripcion,fecha,hora,tipo")),
        sb.rpc("vigilancia_listar_transaccional", { datos: {} }).then(r => (r.error ? [] : (r.data && r.data.procesos) || [])),
        sb.rpc("mensajes_clientes_lista_transaccional", { datos: {} }).then(r => (r.error ? [] : (r.data && r.data.filas) || []))
      ]);
      // 30/10/2026: el aviso «Movimiento nuevo» se quita solo cuando ya tiene más de 7 días (el proceso sigue en la lista).
      vigilancia.forEach(p => { if (p.pendiente && p.movimiento_en && Date.now() - Date.parse(p.movimiento_en) > 7 * 86400000) p.pendiente = false; });
      const perfil = perfiles[0];
      if (!perfil || perfil.activo === false) {
        await cerrarSesion();
        mostrarEntrada("Su cuenta no está activa. Pídale al administrador que la active.");
        return;
      }
      if (window.DCHuella) DCHuella.recordar(perfil.nombre, s.session.user.email);
      datos = { perfil, clientes, expedientes, vencimientos, terminos, eventos, tareas, agenda, vigilancia, clientesPorId: {}, expedientesPorId: {} };
      clientes.forEach(c => (datos.clientesPorId[c.id] = c));
      expedientes.forEach(e => (datos.expedientesPorId[e.id] = e));
      mensajes.lista = filasMsj;
      cargadoEn = Date.now();
      anotado = 0; anotarUso();
      mostrarApp();
      pintar();
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (/JWT|session|token/i.test(msg)) { mostrarEntrada("La sesión venció. Entre de nuevo."); return; }
      mostrarApp();
      $("cuerpo").innerHTML = '<div class="tarj">' + vacio("No fue posible leer los datos. Revise el internet y pulse el botón Actualizar arriba.") +
        '<div class="vacio">' + esc(msg) + "</div></div>";
    }
  }

  // Darío (30/10/2026): todos en el despacho son abogados; el nombre va con «Abg.» (menos la cuenta «Oficina»).
  function conTitulo(nombre) {
    const n = String(nombre || "").trim();
    return !n || /^(oficina|despacho|todo el despacho)$/i.test(n) || /^abg\./i.test(n) ? n : "Abg. " + n;
  }

  // ---------- Pantallas ----------
  function pintar() {
    if (!datos) return;
    document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("on", b.dataset.vista === vista));
    const hoy = new Date();
    // 30/10/2026 (Darío): en Inicio va el saludo y debajo el nombre completo de quien abrió la app.
    const encabezados = {
      inicio: [L.saludo(hoy), conTitulo(datos.perfil.nombre) || L.fechaLarga(hoy)],
      pendientes: ["Pendientes", "Lo mismo que en el programa del PC"],
      agenda: ["Agenda", "Próximos 30 días"],
      procesos: ["Procesos", "Radicados vigilados en la Rama Judicial"],
      mensajes: ["Mensajes de clientes", "Desde el portal del cliente"],
      acerca: ["Acerca de", "DC Gestión Jurídica"]
    };
    const q = norm($("buscar").value.trim());
    $("titulo").textContent = q.length >= 2 ? "Resultados" : encabezados[vista][0];
    $("subtitulo").textContent = q.length >= 2 ? "Búsqueda en clientes, expedientes y radicados" : encabezados[vista][1];
    const html = q.length >= 2 ? vistaBusqueda(q) : { inicio: vistaInicio, pendientes: vistaPendientes, agenda: vistaAgenda, procesos: vistaProcesos, mensajes: vistaMensajes, acerca: vistaAcerca }[vista]();
    $("cuerpo").innerHTML = html;
    $("cuerpo").scrollTop = 0;
    // 30/10/2026 (Darío): el número de abajo cuenta los mensajes sin leer; al abrir la conversación se borra, aunque no se haya respondido.
    const porResponder = (mensajes.lista || []).filter(f => Number(f.sin_leer) > 0).length;
    const bm = $("badge-msj");
    if (bm) { bm.textContent = porResponder; bm.classList.toggle("oculto", porResponder === 0); }
    if (vista === "mensajes" && mensajes.abierto) { const h = $("hilo-abogado"); if (h) h.scrollTop = h.scrollHeight; }
  }

  // V1.4.11 · «Tengo una duda sobre mi caso»: el abogado responde desde el celular, con las mismas funciones del servidor que usa el programa del PC.
  function horaMsj(iso) {
    const d = new Date(iso); if (isNaN(d)) return "";
    const clave = x => x.toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
    const dia = clave(d) === clave(new Date()) ? "Hoy" : clave(d) === clave(new Date(Date.now() - 86400000)) ? "Ayer" : clave(d);
    return dia + " " + d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" });
  }
  function vistaAcerca() {
    return '<div class="acerca"><div class="acerca-logo">DC</div><div class="acerca-t">DC Gestión Jurídica</div><div class="acerca-s">Carvajal &amp; Rivera Abogados Asociados</div><div class="acerca-c"><b>¿Para qué sirve?</b>Su despacho en el bolsillo: consulta sus procesos, vencimientos y agenda, y atiende a sus clientes desde el celular.</div><div class="acerca-c"><b>¿Cómo se usa?</b><ul><li><span class="num">1</span>Inicio: lo urgente del día.</li><li><span class="num">2</span>Pendientes y Agenda: términos y citas.</li><li><span class="num">3</span>Mensajes: responda a sus clientes.</li></ul></div><div class="acerca-ver"><b>Versión ' + esc(window.DC_VERSION || "") + '</b>Aplicación web del celular</div></div>';
  }
  function vistaMensajes() {
    if (mensajes.abierto) {
      const f = mensajes.abierto;
      let h = '<div class="chat"><button type="button" class="chat-volver" data-msj="volver">‹ Volver a los mensajes</button>' +
        '<div class="msj-cab"><span class="msj-av">' + esc(iniciales(f.cliente)) + '</span><div class="crece"><b>' + esc(f.cliente) + "</b>" + (f.expediente ? "<span>Proceso " + esc(f.expediente) + "</span>" : "<span>Portal del cliente</span>") + "</div></div>" +
        '<div id="hilo-abogado" class="hilo">';
      if (!mensajes.hilo.length && !mensajes.error) h += '<div class="msj-aviso">Todavía no hay mensajes con este cliente. Escríbale aquí: lo verá en su portal y le llegará un aviso al celular.</div>';
      mensajes.hilo.forEach(m => {
        h += '<div class="msj ' + (m.de === "cliente" ? "abo" : "cli") + '">' + esc(m.texto).replace(/\n/g, "<br>") +
          '<div class="hora">' + esc(horaMsj(m.creado_en)) + (m.de === "despacho" && m.quien ? " · " + esc(conTitulo(m.quien)) : "") + "</div>" +
          (m.de === "cliente" && m.para ? '<span class="para-pill' + (m.para_mi ? " mi" : "") + '">' + (m.para_mi ? "Para ti" : "Para: " + esc(conTitulo(m.para))) + "</span>" : "") + "</div>";
      });
      h += '</div><form id="form-resp" class="caja-msj"><textarea id="txt-resp" rows="1" maxlength="2000" placeholder="' + (mensajes.hilo.length ? "Escriba su respuesta…" : "Escriba su mensaje…") + '" aria-label="Respuesta"></textarea>' +
        '<button type="submit" id="env-resp" aria-label="Responder">➤</button></form><p id="err-resp" class="gris" style="margin:4px 14px">' + esc(mensajes.error) + "</p></div>";
      return h;
    }
    const filas = mensajes.lista || [];
    // 30/10/2026 (Darío): el despacho también puede escribirle primero a un cliente que tenga el portal.
    const nuevo = '<button type="button" class="nuevo-msj" data-nuevo="abrir">✏️ Escribir a un cliente</button>';
    if (!filas.length) return nuevo + tarjeta("Mensajes de clientes", "", vacio("Todavía no hay conversaciones con clientes.")) + hojaClientes();
    const paraMi = filas.filter(f => f.para_mi && Number(f.sin_leer) > 0).length;
    const fil = mensajes.filtro === "mi" ? filas.filter(f => f.para_mi) : mensajes.filtro === "resp" ? filas.filter(f => f.por_responder) : filas;
    const tabs = '<div class="tabs-msj"><button type="button" class="tab-msj' + (mensajes.filtro === "todos" ? " on" : "") + '" data-filtro="todos">Todos</button>' +
      '<button type="button" class="tab-msj' + (mensajes.filtro === "mi" ? " on" : "") + '" data-filtro="mi">Para mí' + (paraMi ? ' <span class="n">' + paraMi + "</span>" : "") + "</button>" +
      '<button type="button" class="tab-msj' + (mensajes.filtro === "resp" ? " on" : "") + '" data-filtro="resp">Sin responder</button></div>';
    // 30/10/2026 (modelo aprobado): lista estilo chat con iniciales, hora, vista previa y estado (Nuevo, Por responder, Respondido).
    const estado = f => Number(f.sin_leer) > 0 ? '<span class="est-msj nuevo">Nuevo</span>' : f.por_responder ? '<span class="est-msj resp">Por responder</span>' : f.cliente_escribio === false ? '<span class="est-msj ok">✓ Enviado</span>' : '<span class="est-msj ok">✓ Respondido</span>';
    return nuevo + tabs + tarjeta("Mensajes de clientes", filas.filter(f => f.por_responder).length + " por responder", fil.length ? fil.map(f =>
      '<div class="fila-msj' + (Number(f.sin_leer) > 0 ? " sin-leer" : "") + (f.para_mi ? " para-mi" : "") + '" data-msj="abrir" data-cliente="' + esc(f.cliente_id) + '">' +
      '<span class="msj-av">' + esc(iniciales(f.cliente)) + (Number(f.sin_leer) > 0 ? '<i class="msj-punto"></i>' : "") + "</span>" +
      '<div class="crece"><div class="msj-l1"><b>' + esc(f.cliente) + '</b><time>' + esc(horaMsj(f.ultimo_en)) + "</time></div>" +
      '<div class="msj-prev">' + (f.ultimo_de === "despacho" ? "Usted: " : "") + esc(String(f.ultimo_texto || "").slice(0, 120)) + "</div>" +
      '<div class="msj-l3">' + (f.cliente_escribio === false ? "" : '<span class="para-pill' + (f.para_mi ? " mi" : "") + '">' + (f.para_mi ? "Para ti" : "Para: " + esc(conTitulo(f.para) || "Todo el despacho")) + "</span>") + estado(f) + "</div></div></div>").join("") : vacio("No hay mensajes en esta pestaña.")) + hojaClientes();
  }
  // Lista para elegir a qué cliente escribirle: solo los que ya entraron al portal (allí leen el mensaje).
  function hojaClientes() {
    if (!mensajes.eligiendo) return "";
    const q = norm(mensajes.buscar || "");
    const lista = mensajes.clientesPortal;
    const fil = (lista || []).filter(c => !q || norm(c.cliente).includes(q));
    return '<div class="hoja-velo" data-nuevo="cerrar"></div><div class="hoja-a" role="dialog" aria-label="Escribir a un cliente"><div class="hoja-asa"></div>' +
      '<div class="hoja-tit">¿A qué cliente le escribe?</div><p class="gris" style="margin:0 0 10px">Solo aparecen los clientes que ya entraron a su portal; allí leen el mensaje y les llega el aviso al celular.</p>' +
      '<label class="buscar hoja-buscar"><svg class="ic" width="20" height="20"><use href="#ic-buscar"/></svg><input id="buscar-cli" type="search" placeholder="Buscar cliente" value="' + esc(mensajes.buscar || "") + '"></label>' +
      '<div class="hoja-lista">' + (lista === null ? vacio("Cargando…") : fil.length ? fil.map(c => '<button type="button" class="hoja-opc" data-nuevo-cli="' + esc(c.cliente_id) + '"><span class="hoja-av">' + esc(iniciales(c.cliente)) +
        '</span><span class="crece">' + esc(c.cliente) + "<small>" + esc(c.expediente ? "Proceso " + c.expediente : "Portal activo") + "</small></span></button>").join("") : vacio("No hay clientes con ese nombre en el portal.")) + "</div></div>";
  }
  const iniciales = n => String(n || "").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  async function abrirHilo(f) {
    mensajes.abierto = f; mensajes.hilo = []; mensajes.error = ""; pintar();
    const { data, error } = await sb.rpc("mensajes_cliente_hilo_transaccional", { datos: { cliente_id: f.cliente_id } });
    // Al abrirla, la conversación queda leída (el servidor la marca) y el número de abajo se borra.
    if (error) mensajes.error = error.message; else { mensajes.hilo = (data && data.mensajes) || []; f.sin_leer = 0; }
    pintar();
  }
  async function recargarLista() {
    const { data } = await sb.rpc("mensajes_clientes_lista_transaccional", { datos: {} });
    if (data) mensajes.lista = data.filas || [];
  }
  document.addEventListener("click", async ev => {
    const nv = ev.target.closest && ev.target.closest("[data-nuevo]");
    if (nv && datos) {
      mensajes.eligiendo = nv.dataset.nuevo === "abrir"; mensajes.buscar = "";
      pintar();
      if (mensajes.eligiendo && mensajes.clientesPortal === null) {
        const { data, error } = await sb.rpc("mensajes_clientes_portal_transaccional", { datos: {} });
        mensajes.clientesPortal = error ? [] : (data && data.clientes) || [];
        pintar();
      }
      return;
    }
    const nc = ev.target.closest && ev.target.closest("[data-nuevo-cli]");
    if (nc && datos) {
      const c = (mensajes.clientesPortal || []).find(x => String(x.cliente_id) === nc.dataset.nuevoCli);
      mensajes.eligiendo = false;
      if (c) abrirHilo((mensajes.lista || []).find(x => String(x.cliente_id) === String(c.cliente_id)) || { cliente_id: c.cliente_id, cliente: c.cliente, expediente: c.expediente });
      return;
    }
    const fl = ev.target.closest && ev.target.closest("[data-filtro]");
    if (fl && datos) { mensajes.filtro = fl.dataset.filtro; pintar(); return; }
    const b = ev.target.closest && ev.target.closest("[data-msj]");
    if (!b || !datos) return;
    if (b.dataset.msj === "volver") { mensajes.abierto = null; await recargarLista(); pintar(); return; }
    const f = (mensajes.lista || []).find(x => String(x.cliente_id) === b.dataset.cliente);
    if (f) abrirHilo(f);
  });
  document.addEventListener("submit", async ev => {
    if (!ev.target || ev.target.id !== "form-resp" || !mensajes.abierto) return;
    ev.preventDefault();
    const caja = $("txt-resp"), texto = (caja.value || "").trim();
    if (!texto) return;
    $("env-resp").disabled = true;
    const f = mensajes.abierto;
    const { error } = await sb.rpc("mensaje_responder_transaccional", { datos: { cliente_id: f.cliente_id, texto } });
    if (error) { mensajes.error = error.message; pintar(); return; }
    mensajes.error = "";
    await abrirHilo(f);
    await recargarLista();
  });

  function lineaVencimiento(v) {
    const cli = nombreCliente(v.cliente_id);
    return item(L.colorPunto(v.dias), v.titulo, esc(cli || numeroExpediente(v.expediente_id)) + " · " + esc(v.dias !== null && v.dias <= 6 ? L.cuando(v.dias) : L.fechaCorta(v.fecha_vencimiento)));
  }

  function tarjetaAvisos() {
    const P = window.DC_PUSH, est = P ? P.estado() : "no";
    const como = "¿Cómo funciona? Le llega un aviso a la barra de mensajes del celular cuando tiene una cita por comenzar o un vencimiento, tarea o recordatorio para hoy.";
    let h;
    // 30/10/2026 (Darío): con los avisos ya activados la tarjeta no sale; se apagan desde Configuración.
    if (est === "activo") return "";
    else if (est === "iphone") h = vacio("En iPhone: toque el botón Compartir y luego «Agregar a inicio». Abra la app desde ese ícono y aquí podrá activar los avisos (iOS 16.4 o más nuevo).");
    else if (est === "denegado") h = vacio("Los avisos están bloqueados para esta página. Actívelos en los ajustes del navegador (Permisos › Notificaciones) y vuelva a intentarlo.");
    else if (est === "no") h = vacio("Este navegador no admite avisos.");
    else h = '<button type="button" data-push="activar">Activar avisos en este celular</button>';
    return tarjeta("Avisos al celular", "", '<p class="gris" style="margin:0 0 10px">' + esc(como) + "</p>" + h + '<p id="push-msg" class="gris"></p>');
  }
  // Activar o quitar los avisos (desde la tarjeta de Inicio o desde Configuración). Devuelve el error, si hubo.
  async function avisosActivar() {
    const P = window.DC_PUSH;
    const { data: k } = await sb.rpc("push_clave_publica_transaccional", { datos: {} });
    await P.activar((k && k.clave) || "", "sw.js", "./");
    if (!P.resultado) return P.error || "No se pudo activar.";
    const { error } = await sb.rpc("push_suscribir_transaccional", { datos: JSON.parse(P.resultado) });
    if (error) { try { localStorage.removeItem("dc-push-activo"); } catch (e) {} return "No se pudo activar: " + error.message; }
    return "";
  }
  async function avisosQuitar() {
    const P = window.DC_PUSH;
    await P.desactivar();
    if (P.resultado && P.resultado !== "{}") await sb.rpc("push_quitar_transaccional", { datos: JSON.parse(P.resultado) });
    return "";
  }
  document.addEventListener("click", async ev => {
    const b = ev.target.closest && ev.target.closest("[data-push]");
    if (!b || !window.DC_PUSH) return;
    b.disabled = true;
    const error = b.dataset.push === "activar" ? await avisosActivar() : await avisosQuitar();
    if (error) { $("push-msg").textContent = error; b.disabled = false; return; }
    pintar();
  });

  function vistaInicio() {
    const g = L.agruparVencimientos(datos.vencimientos);
    const movidos = datos.vigilancia.filter(p => p.pendiente);
    const citasHoy = L.agenda(datos.agenda, datos.vencimientos, datos.tareas, undefined, 0).length;
    let h = '<div class="res"><div><b>' + g.semana.length + "</b><span>Vencen esta semana</span></div><div><b>" + movidos.length +
      "</b><span>Procesos con movimiento</span></div><div><b>" + citasHoy + "</b><span>Citas hoy</span></div></div>";
    const mov = movidos.length
      ? movidos.map(p => item("a", (p.cliente || "Sin cliente") + " · " + p.expediente_numero,
          esc(String(p.ultima_actuacion || "").split(" · ")[0]) + (p.ultima_fecha_actuacion ? " · " + esc(L.fechaCorta(p.ultima_fecha_actuacion)) : ""))).join("")
      : vacio("Sin actuaciones nuevas.");
    h += tarjeta(titulo("ic-balanza", "Movimiento en Rama Judicial"), movidos.length ? "hoy" : "", mov, "mov");
    const proximos = g.vencidos.concat(g.semana, g.despues).slice(0, 3);
    h += '<div class="tarj"><h3>' + titulo("ic-reloj", "Próximos vencimientos") + ' <a href="#" data-ir="pendientes">ver todos</a></h3>' +
      (proximos.length ? proximos.map(lineaVencimiento).join("") : vacio("No hay vencimientos pendientes.")) + "</div>";
    return h + tarjetaAvisos();
  }

  function vistaPendientes() {
    const chips = [["vencimientos", "Vencimientos"], ["terminos", "Términos"], ["alertas", "Alertas"], ["tareas", "Tareas"]]
      .map(([k, t]) => '<button data-pestana="' + k + '" class="' + (k === pestana ? "on" : "") + '">' + t + "</button>").join("");
    let h = '<div class="chips">' + chips + "</div>";
    if (pestana === "vencimientos") {
      const g = L.agruparVencimientos(datos.vencimientos);
      if (!g.vencidos.length && !g.semana.length && !g.despues.length) return h + tarjeta("Vencimientos", "", vacio("No hay vencimientos pendientes."));
      if (g.vencidos.length) h += tarjeta("Vencidos", g.vencidos.length, g.vencidos.map(lineaVencimiento).join(""));
      if (g.semana.length) h += tarjeta("Esta semana", g.semana.length, g.semana.map(lineaVencimiento).join(""));
      if (g.despues.length) h += tarjeta("Más adelante", g.despues.length, g.despues.map(lineaVencimiento).join(""));
    } else if (pestana === "terminos") {
      const vencPorTermino = {};
      datos.vencimientos.forEach(v => (vencPorTermino[v.termino_id] = v));
      const lista = datos.terminos
        .map(t => ({ t, v: vencPorTermino[t.id], dias: L.diasHasta(t.fecha_vencimiento) }))
        .filter(x => x.v && L.estaPendiente(x.v.estado))
        .sort((a, b) => (a.dias === null ? 1e9 : a.dias) - (b.dias === null ? 1e9 : b.dias));
      h += tarjeta("Términos en curso", lista.length, lista.length ? lista.map(x => item(L.colorPunto(x.dias), x.v.titulo,
        esc(nombreCliente(x.v.cliente_id)) + " · " + esc(x.t.cantidad + " " + String(x.t.unidad || "").replace(/_/g, " ").toLowerCase()) +
        " · desde " + esc(L.fechaCorta(x.t.fecha_inicio)) + " · vence " + esc(L.fechaCorta(x.t.fecha_vencimiento)))).join("") : vacio("No hay términos en curso."));
    } else if (pestana === "alertas") {
      const al = L.alertas(datos.vencimientos, datos.expedientes, datos.eventos);
      const grupos = {};
      al.forEach(a => (grupos[a.tipo] = grupos[a.tipo] || []).push(a));
      const tipos = Object.keys(grupos);
      if (!tipos.length) return h + tarjeta("Alertas de riesgo", "", vacio("Sin alertas. Todo al día."));
      tipos.forEach(tipo => {
        h += tarjeta(esc(tipo), grupos[tipo].length, grupos[tipo].map(a => a.expediente
          ? item(a.color, a.titulo, esc(nombreCliente(a.expediente.cliente_id)) + " · " + (a.sinActuacion === null ? "sin actuaciones registradas" : "última actuación hace " + a.sinActuacion + " días"))
          : item(a.color, a.titulo, esc(nombreCliente(a.detalle.cliente_id)) + " · " + esc(L.cuando(a.dias)))).join(""));
      });
    } else {
      const lista = datos.tareas.filter(t => L.estaPendiente(t.estado))
        .map(t => Object.assign({}, t, { dias: L.diasHasta(t.fecha_limite) }))
        .sort((a, b) => (a.dias === null ? 1e9 : a.dias) - (b.dias === null ? 1e9 : b.dias));
      h += tarjeta("Tareas pendientes", lista.length, lista.length ? lista.map(t => item(L.colorPunto(t.dias), t.titulo,
        esc(t.responsable || "Sin responsable") + " · " + esc(L.fechaCorta(t.fecha_limite)))).join("") : vacio("No hay tareas pendientes."));
    }
    return h;
  }

  function vistaAgenda() {
    const items = L.agenda(datos.agenda, datos.vencimientos, datos.tareas);
    if (!items.length) return tarjeta("Agenda", "", vacio("Nada en los próximos 30 días."));
    const porDia = {};
    items.forEach(i => (porDia[i.dias] = porDia[i.dias] || []).push(i));
    return Object.keys(porDia).map(Number).sort((a, b) => a - b).map(d => {
      const f = L.hoyLocal(); f.setDate(f.getDate() + d);
      const titulo = d === 0 ? "Hoy" : d === 1 ? "Mañana" : L.fechaLarga(f);
      return tarjeta(esc(titulo), porDia[d].length, porDia[d].map(i => item(
        i.tipo === "Vencimiento" ? L.colorPunto(d) : i.tipo === "Tarea" ? "v" : "z",
        (i.hora ? i.hora + " · " : "") + i.titulo,
        esc(i.tipo.charAt(0).toUpperCase() + i.tipo.slice(1).toLowerCase()) + (i.ref ? " · " + esc(nombreCliente(i.ref.cliente_id)) : i.sub ? " · " + esc(i.sub) : ""))).join(""));
    }).join("");
  }

  // Buscador de arriba: clientes, expedientes, vencimientos y radicados vigilados.
  function vistaBusqueda(q) {
    const coincide = (...textos) => textos.some(t => norm(t).includes(q));
    const exps = datos.expedientes.filter(e => coincide(e.numero, nombreCliente(e.cliente_id)))
      .sort((a, b) => String(b.fecha_apertura).localeCompare(String(a.fecha_apertura))).slice(0, 30);
    const g = L.agruparVencimientos(datos.vencimientos);
    const venc = g.vencidos.concat(g.semana, g.despues).filter(v => coincide(v.titulo, nombreCliente(v.cliente_id), numeroExpediente(v.expediente_id))).slice(0, 30);
    const procs = datos.vigilancia.filter(p => coincide(p.radicado, p.cliente, p.expediente_numero)).slice(0, 30);
    if (!exps.length && !venc.length && !procs.length) return tarjeta("Sin resultados", "", vacio("No hay nada que coincida con lo que escribió."));
    let h = "";
    if (exps.length) h += tarjeta("Expedientes", exps.length, exps.map(e => item("z", e.numero,
      esc(nombreCliente(e.cliente_id) || "Sin cliente") + " · " + esc(e.estado || "") + (e.fecha_apertura ? " · abierto " + esc(L.fechaCorta(e.fecha_apertura)) : ""))).join(""));
    if (venc.length) h += tarjeta("Vencimientos", venc.length, venc.map(lineaVencimiento).join(""));
    if (procs.length) h += tarjeta("Procesos vigilados", procs.length, procs.map(p => item(p.pendiente ? "a" : "z", (p.cliente || "Sin cliente") + " · " + p.expediente_numero,
      "Radicado " + esc(p.radicado) + (p.ultima_fecha_actuacion ? " · última actuación " + esc(L.fechaCorta(p.ultima_fecha_actuacion)) : ""))).join(""));
    return h;
  }

  function vistaProcesos() {
    const lista = datos.vigilancia;
    if (!lista.length) return tarjeta("Procesos vigilados", "", vacio("Todavía no hay radicados en vigilancia. Se agregan en el programa del PC, en la ficha del expediente."));
    return tarjeta("Procesos vigilados", lista.length, lista.map(p => {
      const sub = "Radicado " + esc(p.radicado) + "<br>" +
        (p.ultima_revision ? '<span class="revisado">Revisado: ' + esc(horaMsj(p.ultima_revision)) + "</span><br>" : "") +
        (p.ultima_fecha_actuacion ? "Última actuación: " + esc(L.fechaCorta(p.ultima_fecha_actuacion)) + (p.ultima_actuacion ? " · " + esc(String(p.ultima_actuacion).slice(0, 220)) : "") : "Aún sin revisar.") +
        '<br><a class="enlace" href="' + PORTAL + '" target="_blank" rel="noopener" data-radicado="' + esc(p.radicado) + '">Ver en el portal (copia el radicado)</a>';
      return item(p.pendiente ? "a" : "z", (p.pendiente ? "Movimiento nuevo · " : "") + (p.cliente || "Sin cliente") + " · " + p.expediente_numero, sub);
    }).join(""));
  }

  // ---------- Navegación ----------
  document.querySelector(".nav").addEventListener("click", ev => {
    const b = ev.target.closest("button[data-vista]");
    if (!b) return;
    vista = b.dataset.vista;
    $("buscar").value = "";
    pintar();
  });
  $("buscar").addEventListener("input", () => pintar());
  document.addEventListener("input", ev => {
    if (!ev.target || ev.target.id !== "buscar-cli") return;
    mensajes.buscar = ev.target.value;
    const pos = ev.target.selectionStart;
    pintar();
    const b = $("buscar-cli"); if (b) { b.focus(); b.setSelectionRange(pos, pos); }
  });

  // 30/10/2026: deslizar el dedo a la izquierda o a la derecha pasa al módulo siguiente o al anterior.
  let toque = null;
  const appEl = $("app");
  appEl.addEventListener("touchstart", ev => {
    const t = ev.touches[0];
    toque = ev.touches.length === 1 && !ev.target.closest("input, textarea, select, .chips, .nav, #hilo-abogado") ? { x: t.clientX, y: t.clientY, en: Date.now() } : null;
  }, { passive: true });
  appEl.addEventListener("touchend", ev => {
    if (!toque || !datos || $("buscar").value.trim().length >= 2) { toque = null; return; }
    const t = ev.changedTouches[0], dx = t.clientX - toque.x, dy = t.clientY - toque.y, rapido = Date.now() - toque.en < 700;
    toque = null;
    if (!rapido || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
    const orden = [...document.querySelectorAll(".nav button[data-vista]")].map(b => b.dataset.vista);
    const i = orden.indexOf(vista) + (dx < 0 ? 1 : -1);
    if (i < 0 || i >= orden.length) return;
    vista = orden[i];
    pintar();
    const c = $("cuerpo");
    c.classList.remove("entra-der", "entra-izq");
    void c.offsetWidth;
    c.classList.add(dx < 0 ? "entra-der" : "entra-izq");
  }, { passive: true });
  $("cuerpo").addEventListener("click", ev => {
    const ir = ev.target.closest("[data-ir]");
    if (ir) { ev.preventDefault(); vista = ir.dataset.ir; pestana = "vencimientos"; pintar(); return; }
    const p = ev.target.closest("[data-pestana]");
    if (p) { pestana = p.dataset.pestana; pintar(); return; }
    const r = ev.target.closest("[data-radicado]");
    if (r && navigator.clipboard) navigator.clipboard.writeText(r.dataset.radicado).catch(() => {});
  });
  // Al volver a la app después de un rato, se actualiza sola.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && datos && !inactivo() && Date.now() - cargadoEn > 120000) cargar();
  });

  // Recuperar contraseña: ver clave.js.
  const CLAVE = window.DC_CLAVE;
  CLAVE.preparar(sb, { alTerminar: () => { $("volver-clave").classList.add("oculto"); cargar(); } });

  // ---------- Configuración (engranaje de arriba) ----------
  if (window.DCAjustes) DCAjustes.montar({
    app: "movil",
    avisos: { estado: () => (window.DC_PUSH ? DC_PUSH.estado() : "no"), activar: avisosActivar, quitar: avisosQuitar },
    cambiarClave() {
      $("app").classList.add("oculto");
      $("volver-clave").classList.remove("oculto");
      $("error-nueva-clave").textContent = "";
      $("nueva-clave").classList.remove("oculto");
    },
    alCerrar() { if (datos) pintar(); }
  });
  $("volver-clave").addEventListener("click", ev => { ev.preventDefault(); $("volver-clave").classList.add("oculto"); mostrarApp(); });

  // ---------- Cerrar la sesión si no se usa (Configuración › Seguridad; 10 minutos por defecto) ----------
  const ULTIMO = "dc-movil-ultimo-uso";
  let anotado = 0;
  // 30/10/2026: al entrar se anota la hora de una vez; antes, si no se tocaba la pantalla después de entrar, nunca se cerraba.
  function usoNuevo() { anotado = 0; anotarUso(); }
  function anotarUso() {
    const ahora = Date.now();
    if (ahora - anotado < 15000) return;
    anotado = ahora;
    try { localStorage.setItem(ULTIMO, String(ahora)); } catch (e) {}
  }
  function inactivo() {
    let u = 0;
    try { u = Number(localStorage.getItem(ULTIMO)) || 0; } catch (e) {}
    const min = window.DCAjustes ? DCAjustes.minutosInactividad() : 10;
    return u > 0 && Date.now() - u > min * 60000;
  }
  async function revisarInactividad() {
    if (!datos || !inactivo()) return;
    await cerrarSesion();
    try { localStorage.removeItem(ULTIMO); } catch (e) {}
    datos = null;
    if (window.DCAjustes) DCAjustes.cerrar();
    mostrarEntrada("Cerramos la sesión porque no la usó por un rato.");
  }
  ["pointerdown", "keydown", "scroll"].forEach(t => document.addEventListener(t, () => { if (datos && !inactivo()) anotarUso(); }, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") revisarInactividad(); });
  ["focus", "pageshow"].forEach(t => window.addEventListener(t, revisarInactividad));
  setInterval(revisarInactividad, 30000);

  async function iniciar(recienEntro) {
    const { data } = await sb.auth.getSession();
    if (recienEntro === true && data.session) usoNuevo();
    // Al abrir la app después de mucho rato sin usarla, se pide entrar de nuevo (con la huella o la contraseña).
    if (data.session && !CLAVE.enRecuperacion && inactivo()) {
      await cerrarSesion();
      try { localStorage.removeItem(ULTIMO); } catch (e) {}
      mostrarEntrada("");
      return;
    }
    if (CLAVE.enRecuperacion && data.session) {
      $("app").classList.add("oculto");
      $("entrada").classList.add("oculto");
      $("nueva-clave").classList.remove("oculto");
      return;
    }
    if (data.session) { await cargar(); if (datos) { let u = 0; try { u = Number(localStorage.getItem(ULTIMO)) || 0; } catch (e) {} if (!u) usoNuevo(); } }
    else mostrarEntrada(CLAVE.errorEnlace);
  }

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  iniciar();
})();
