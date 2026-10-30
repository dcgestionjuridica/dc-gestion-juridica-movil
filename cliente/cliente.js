// DC Gestión Jurídica · portal de clientes (solo consulta).
// El cliente ve únicamente lo que devuelve portal_mi_resumen_transaccional: su proceso y su cartera.
(function () {
  const L = window.DC_LOGICA;
  const cfg = window.DC_CONFIG;
  const $ = id => document.getElementById(id);
  const PENDIENTE = "dc_portal_codigo_pendiente";
  const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  const sb = window.supabase.createClient(cfg.url, cfg.clavePublica, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "dc-portal-cliente-sesion" } });
  let datos = null;
  let cargadoEn = 0;
  let vista = "proceso";
  let modoCrear = false;
  let mensajes = [];
  let sondeo = null;

  function esc(t) {
    return String(t === null || t === undefined ? "" : t)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  const ICONO = { r: "ic-alerta", a: "ic-campana", v: "ic-check", z: "ic-reloj" };
  function item(color, titulo, sub) {
    return '<div class="it"><div class="pto ' + color + '"><svg><use href="#' + (ICONO[color] || "ic-reloj") + '"/></svg></div><div class="crece">' + titulo + (sub ? "<small>" + sub + "</small>" : "") + "</div></div>";
  }
  function tarjeta(titulo, derecha, contenido, clase) {
    return '<div class="tarj ' + (clase || "") + '"><h3>' + titulo + (derecha !== "" && derecha !== undefined ? " <span>" + derecha + "</span>" : "") + "</h3>" + contenido + "</div>";
  }
  function vacio(t) { return '<div class="vacio">' + esc(t) + "</div>"; }
  function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
  // Valor en pesos. Con «Ocultar valores» (Configuración) sale como $ •••• hasta que lo toque.
  function plata(v, suave) {
    return '<span class="monto' + (suave ? " suave" : "") + '"><span class="mv">' + esc(pesos.format(num(v))) + '</span><span class="mo">$ ••••</span></span>';
  }
  function guardarCodigo(c) { try { c ? localStorage.setItem(PENDIENTE, c) : localStorage.removeItem(PENDIENTE); } catch (e) {} }
  function codigoGuardado() { try { return localStorage.getItem(PENDIENTE) || ""; } catch (e) { return ""; } }

  function mostrar(id) {
    ["entrada", "vincular", "app", "nueva-clave"].forEach(s => $(s).classList.toggle("oculto", s !== id));
  }

  // ---------- Entrar / crear cuenta ----------
  function modo(crear) {
    modoCrear = crear;
    $("tab-entrar").classList.toggle("on", !crear);
    $("tab-crear").classList.toggle("on", crear);
    $("caja-clave2").classList.toggle("oculto", !crear);
    $("caja-codigo").classList.toggle("oculto", !crear);
    $("clave2").required = crear;
    $("codigo").required = crear;
    $("clave").autocomplete = crear ? "new-password" : "current-password";
    $("btn-entrar").textContent = crear ? "Crear mi cuenta" : "Entrar";
    $("btn-olvido").classList.toggle("oculto", crear);
    $("error-entrada").textContent = "";
    $("ok-entrada").textContent = "";
  }
  $("tab-entrar").addEventListener("click", () => modo(false));
  if (window.DCHuella) DCHuella.montar(sb, "cliente", iniciar);
  $("tab-crear").addEventListener("click", () => modo(true));

  $("form-entrada").addEventListener("submit", async ev => {
    ev.preventDefault();
    $("error-entrada").textContent = "";
    $("ok-entrada").textContent = "";
    const correo = $("correo").value.trim();
    const clave = $("clave").value;
    if (clave.length < 8) { $("error-entrada").textContent = "La contraseña debe tener al menos 8 caracteres."; return; }
    $("btn-entrar").disabled = true;
    try {
      if (modoCrear) {
        if (clave !== $("clave2").value) { $("error-entrada").textContent = "Las dos contraseñas no son iguales."; return; }
        const codigo = $("codigo").value.trim();
        if (codigo.replace(/[^A-Za-z0-9]/g, "").length < 8) { $("error-entrada").textContent = "Escriba el código completo que le envió el despacho."; return; }
        guardarCodigo(codigo);
        const { data, error } = await sb.auth.signUp({ email: correo, password: clave, options: { emailRedirectTo: location.href.split("#")[0] } });
        if (error) { $("error-entrada").textContent = traducir(error.message); return; }
        if (!data.session) {
          modo(false);
          $("correo").value = correo;
          $("ok-entrada").textContent = "Listo. Le enviamos un correo a " + correo + ": ábralo y pulse el enlace para confirmar. Después vuelva aquí y pulse «Entrar».";
          return;
        }
        $("clave").value = ""; $("clave2").value = "";
        await iniciar();
        // 28/10/2026: primera vez, recién creada la cuenta con el código, se ofrece la huella (solo celular).
        if (window.DCHuella && datos) DCHuella.ofrecer();
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
        if (error) { $("error-entrada").textContent = traducir(error.message); return; }
        $("clave").value = "";
        await iniciar();
        // 28/10/2026: después de entrar con contraseña se ofrece «Entrar con huella» (solo celular, una vez).
        if (window.DCHuella && datos) DCHuella.ofrecer();
      }
    } finally {
      $("btn-entrar").disabled = false;
    }
  });

  function traducir(m) {
    if (/invalid login/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/not confirmed/i.test(m)) return "Primero confirme su correo: abra el mensaje que le enviamos y pulse el enlace.";
    if (/already registered/i.test(m)) return "Ese correo ya tiene cuenta. Use «Entrar».";
    if (/rate limit/i.test(m)) return "Se enviaron demasiados correos. Intente de nuevo en una hora.";
    return "No fue posible: " + m;
  }

  $("form-vincular").addEventListener("submit", async ev => {
    ev.preventDefault();
    $("btn-vincular").disabled = true;
    const r = await reclamar($("codigo2").value.trim());
    $("btn-vincular").disabled = false;
    if (r === true) { $("codigo2").value = ""; await cargar(); } else $("error-vincular").textContent = r;
  });
  async function reclamar(codigo) {
    const { data, error } = await sb.rpc("portal_reclamar_transaccional", { datos: { codigo } });
    if (error) { guardarCodigo(""); return error.message; }
    if (!data || !data.ok) return (data && data.mensaje) || "El código no coincide.";
    guardarCodigo("");
    return true;
  }
  async function salir() {
    await sb.auth.signOut();
    datos = null;
    modo(false);
    mostrar("entrada");
  }
  $("btn-salir").addEventListener("click", salir);
  $("salir-vincular").addEventListener("click", ev => { ev.preventDefault(); salir(); });
  $("btn-actualizar").addEventListener("click", () => cargar());

  // ---------- Datos ----------
  async function cargar() {
    $("cuerpo").innerHTML = '<div class="cargando" aria-label="Cargando"><div></div><div></div><div></div></div>';
    const { data: s } = await sb.auth.getSession();
    if (!s.session) { mostrar("entrada"); return; }
    let { data, error } = await sb.rpc("portal_mi_resumen_transaccional", { datos: {} });
    if (error && error.code === "DC404" && codigoGuardado()) {
      // Recién creada la cuenta: se usa el código que escribió al crearla.
      const r = await reclamar(codigoGuardado());
      if (r === true) ({ data, error } = await sb.rpc("portal_mi_resumen_transaccional", { datos: {} }));
      else { $("error-vincular").textContent = r; mostrar("vincular"); return; }
    }
    if (error && error.code === "DC404") { $("error-vincular").textContent = ""; mostrar("vincular"); return; }
    if (error) {
      mostrar("app");
      $("cuerpo").innerHTML = tarjeta("No se pudo cargar", "", vacio("Revise el internet y pulse el botón Actualizar arriba.") + vacio(error.message));
      return;
    }
    datos = data;
    if (window.DCHuella && datos.cliente) {
      const nom = [String(datos.cliente.nombres || "").split(" ")[0], String(datos.cliente.apellidos || "").split(" ")[0]].join(" ").trim();
      DCHuella.recordar(nom, s.session.user.email);
    }
    cargadoEn = Date.now();
    mostrar("app");
    pintar();
    urgentes(); contarSinLeer();
  }

  // V1.3.391: mensaje urgente del despacho. Sale en el centro durante 2 días; la X lo cierra para esta persona.
  async function urgentes() {
    const { data, error } = await sb.rpc("portal_mensajes_urgentes_transaccional", { datos: {} });
    const lista = (!error && data && data.mensajes) || [];
    if (!lista.length || document.getElementById("urgente-fondo")) return;
    const m = lista[0];
    const fondo = document.createElement("div");
    fondo.id = "urgente-fondo";
    fondo.setAttribute("role", "dialog");
    fondo.setAttribute("aria-modal", "true");
    fondo.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(10,20,40,.55);display:flex;align-items:center;justify-content:center;padding:16px";
    fondo.innerHTML = '<div style="position:relative;max-width:440px;width:100%;background:var(--fondo,#fff);color:var(--texto,#1f2a3d);border-radius:14px;border-top:5px solid #c9a24a;box-shadow:0 18px 50px rgba(0,0,0,.35);padding:22px 20px 18px">' +
      '<button type="button" id="urgente-x" aria-label="Cerrar" style="position:absolute;top:8px;right:8px;width:38px;height:38px;border:0;border-radius:50%;background:transparent;color:inherit;font-size:24px;line-height:1;cursor:pointer">&times;</button>' +
      '<div style="display:flex;gap:10px;align-items:center;margin:0 34px 10px 0;color:#8a1c1c"><svg class="ic" width="26" height="26"><use href="#ic-alerta"/></svg><b style="font-size:17px">' + esc(m.titulo) + '</b></div>' +
      '<div style="white-space:pre-line;font-size:15px;line-height:1.55">' + esc(m.mensaje) + '</div>' +
      '<div style="margin-top:14px;font-size:12.5px;opacity:.75">' + esc(m.firma || "Carvajal & Rivera Abogados Asociados") + '</div></div>';
    document.body.appendChild(fondo);
    document.getElementById("urgente-x").onclick = async () => {
      fondo.remove();
      await sb.rpc("portal_mensaje_urgente_cerrar_transaccional", { datos: { id: m.id } });
      urgentes();
    };
  }

  // ---------- Pantallas ----------
  function pintar() {
    document.querySelectorAll(".nav button").forEach(b => b.classList.toggle("on", b.dataset.vista === vista));
    const nombre = String(datos.cliente.nombres || "").split(" ")[0];
    pintarInsignia();
    if (vista === "mensajes") {
      $("titulo").textContent = L.saludo() + (nombre ? ", " + nombre : "");
      $("subtitulo").textContent = "Carvajal & Rivera Abogados Asociados";
      $("cuerpo").innerHTML = vistaMensajes();
      const hilo = $("hilo"); if (hilo) hilo.scrollTop = hilo.scrollHeight;
      return;
    }
    if (vista === "acerca") {
      $("titulo").textContent = "Acerca de";
      $("subtitulo").textContent = "Su portal del cliente";
      $("cuerpo").innerHTML = '<div class="acerca"><div class="acerca-logo">DC</div><div class="acerca-t">Su portal del cliente</div><div class="acerca-s">Carvajal &amp; Rivera Abogados Asociados</div><div class="acerca-c"><b>¿Para qué sirve?</b>Siga su caso sin llamar: vea cómo va su proceso, cuánto ha pagado y escríbale a su abogado.</div><div class="acerca-c"><b>¿Cómo se usa?</b><ul><li><span class="num">1</span>Mi proceso: el estado de su caso.</li><li><span class="num">2</span>Mis pagos: cuotas y recibos.</li><li><span class="num">3</span>Tengo una duda: elija a su abogado y escríbale.</li></ul></div><div class="acerca-ver"><b>Versión ' + esc(window.DC_VERSION || "") + '</b>Portal del cliente</div></div>';
      $("cuerpo").scrollTop = 0;
      return;
    }
    $("titulo").textContent = vista === "proceso" ? L.saludo() + (nombre ? ", " + nombre : "") : "Mis pagos";
    $("subtitulo").textContent = vista === "proceso" ? "Estado de su proceso" : "Cuotas y recibos";
    $("cuerpo").innerHTML = vista === "proceso" ? vistaProceso() : vistaPagos();
    $("cuerpo").scrollTop = 0;
  }

  // V1.4.11: «Tengo una duda sobre mi caso». El cliente le escribe al despacho; la conversación queda en su ficha.
  const HORARIO = "Le respondemos en horario de oficina, de 8:00 a. m. a 5:00 p. m. Si es urgente, llámenos al 312 783 7570.";
  function horaMsj(iso) {
    const d = new Date(iso); if (isNaN(d)) return "";
    const hoy = new Date(), ayer = new Date(Date.now() - 86400000);
    const hm = d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Bogota" }).replace("a. m.", "a. m.").replace("p. m.", "p. m.");
    const clave = x => x.toLocaleDateString("es-CO", { timeZone: "America/Bogota" });
    const dia = clave(d) === clave(hoy) ? "Hoy" : clave(d) === clave(ayer) ? "Ayer" : clave(d);
    return dia + " " + hm;
  }
  // V1.4.16: a quién va dirigido el mensaje ("" = todo el despacho).
  let abogados = [], destino = "";
  const iniAbo = n => String(n || "").split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
  const nomAbo = id => { const a = abogados.find(x => x.id === id); return a ? a.nombre : ""; };
  function vistaMensajes() {
    const e = (datos.expedientes || [])[0];
    let sup = "";
    if (e) {
      let prox = null;
      (datos.contratos || []).forEach(k => (k.cuotas || []).forEach(q => {
        const debe = Math.max(0, num(q.valor) - num(q.pagado)); const d = L.diasHasta(q.vencimiento);
        if (debe > 0 && d !== null && d >= 0 && (prox === null || d < prox.d)) prox = { d, q, debe };
      }));
      sup = '<div class="msj-card"><b>Proceso ' + esc(e.numero) + (e.servicio ? " · " + esc(e.servicio) : "") + "</b>" +
        (prox ? "<span>Próxima cuota: " + esc(L.fechaCorta(prox.q.vencimiento)) + " · " + plata(prox.debe, true) + "</span>" : "") + "</div>";
    }
    const quien = [...mensajes].reverse().find(m => m.de === "despacho");
    let h = '<div class="chat">' + sup +
      '<div class="msj-aviso">Conversación sobre este proceso' + (quien && quien.quien ? " · " + esc(quien.quien) : "") + "</div>" +
      '<div id="hilo" class="hilo">';
    if (!mensajes.length) h += '<div class="msj-aviso">Todavía no hay mensajes. Escríbanos su duda y le respondemos.</div>';
    mensajes.forEach(m => {
      h += '<div class="msj ' + (m.de === "cliente" ? "cli" : "abo") + '">' + esc(m.texto).replace(/\n/g, "<br>") +
        '<div class="hora">' + esc(horaMsj(m.creado_en)) + (m.de === "despacho" && m.quien ? " · " + esc(m.quien) : "") + "</div>" +
        (m.de === "cliente" && m.para ? '<span class="para-tag">Para: ' + esc(m.para) + "</span>" : "") + "</div>";
    });
    h += '<div class="msj-aviso">' + esc(HORARIO) + "</div></div>" +
      '<form id="form-msj" class="caja-msj2"><div class="dest-lab">¿A quién va dirigido?</div><div class="dest-chips">' +
      '<button type="button" class="dest-chip' + (destino === "" ? " on" : "") + '" data-destino=""><span class="dest-av oro">★</span>Todo el despacho</button>' +
      abogados.map((a, i) => '<button type="button" class="dest-chip' + (destino === a.id ? " on" : "") + '" data-destino="' + esc(a.id) + '"><span class="dest-av ' + (i % 2 ? "azul" : "") + '">' + esc(iniAbo(a.nombre)) + "</span>" + esc(a.nombre) + (destino === a.id ? " ✓" : "") + "</button>").join("") +
      '</div><div class="dest-lab">Su mensaje</div><textarea id="txt-msj" rows="3" maxlength="2000" placeholder="Escriba aquí su duda…" aria-label="Escriba su mensaje"></textarea>' +
      '<button type="submit" id="env-msj" class="dest-enviar">Enviar ' + (destino ? "a " + esc(nomAbo(destino)) : "a todo el despacho") + '</button>' +
      '<div class="dest-nota">' + (destino ? "Todo el equipo verá su mensaje; " + esc(nomAbo(destino)) + " será quien le responda." : "Todo el equipo verá su mensaje y le responderá quien pueda.") + '</div></form><p id="err-msj" class="gris" style="margin:4px 14px"></p></div>';
    return h;
  }
  async function cargarMensajes(avisar) {
    const { data, error } = await sb.rpc("portal_mensajes_mios_transaccional", { datos: {} });
    if (error) { if (avisar && $("err-msj")) $("err-msj").textContent = "No se pudieron cargar los mensajes: " + error.message; return; }
    const nuevos = (data && data.mensajes) || [];
    const cambio = nuevos.length !== mensajes.length;
    mensajes = nuevos;
    if (vista === "mensajes" && cambio) {
      const t = $("txt-msj") ? $("txt-msj").value : "";
      pintar(); if (t && $("txt-msj")) $("txt-msj").value = t;
    }
  }
  async function cargarAbogados() {
    if (abogados.length) return;
    const { data, error } = await sb.rpc("portal_abogados_listar_transaccional", { datos: {} });
    if (!error && data && data.abogados) abogados = data.abogados;
  }
  async function abrirMensajes() {
    vista = "mensajes"; sinLeer = 0; pintar();
    await Promise.all([cargarMensajes(true), cargarAbogados()]);
    pintar();
    clearInterval(sondeo);
    sondeo = setInterval(() => { if (vista === "mensajes" && document.visibilityState === "visible") cargarMensajes(false); else if (vista !== "mensajes") clearInterval(sondeo); }, 30000);
  }
  document.addEventListener("click", ev => {
    const d = ev.target.closest && ev.target.closest("[data-destino]");
    if (d && vista === "mensajes") {
      destino = d.dataset.destino || "";
      const t = $("txt-msj") ? $("txt-msj").value : "";
      pintar(); if ($("txt-msj")) $("txt-msj").value = t;
      return;
    }
    const b = ev.target.closest && ev.target.closest("[data-mensajes]");
    if (!b || !datos) return;
    if (b.dataset.mensajes === "abrir") abrirMensajes();
  });
  // V1.4.12: número de respuestas del despacho sin leer, en el botón «Tengo una duda» del menú de abajo.
  let sinLeer = 0;
  function pintarInsignia() {
    const caja = document.querySelector('.nav button[data-vista="mensajes"] .ic-caja'); if (!caja) return;
    let ins = caja.querySelector(".badge-msj");
    if (!sinLeer || vista === "mensajes") { if (ins) ins.remove(); return; }
    if (!ins) { ins = document.createElement("span"); ins.className = "badge-msj"; caja.appendChild(ins); }
    ins.textContent = sinLeer > 9 ? "9+" : String(sinLeer);
  }
  async function contarSinLeer() {
    const { data, error } = await sb.rpc("portal_mensajes_sin_leer_transaccional", { datos: {} });
    if (error) return;
    sinLeer = Number(data && data.cantidad) || 0; pintarInsignia();
  }
  setInterval(() => { if (datos && document.visibilityState === "visible" && vista !== "mensajes") contarSinLeer(); }, 60000);
  document.addEventListener("submit", async ev => {
    if (!ev.target || ev.target.id !== "form-msj") return;
    ev.preventDefault();
    const caja = $("txt-msj"), texto = (caja.value || "").trim();
    if (!texto) return;
    $("env-msj").disabled = true; $("err-msj").textContent = "";
    const { error } = await sb.rpc("portal_mensaje_enviar_transaccional", { datos: { texto, dirigido_a: destino || undefined } });
    if (error) { $("err-msj").textContent = error.message || "No se pudo enviar. Intente de nuevo."; $("env-msj").disabled = false; return; }
    caja.value = "";
    await cargarMensajes(true);
    pintar();
  });

  // V1.3.391: avisos al celular (cuota por vencer, novedad en su proceso, proceso abierto o cerrado, mensajes
  // importantes). El aviso no muestra datos personales; el detalle se ve aquí, en el portal.
  function tarjetaAvisos() {
    const P = window.DC_PUSH, est = P ? P.estado() : "no";
    const como = "¿Cómo funciona? Le llega un aviso al celular cuando una cuota está por vencer, cuando hay una novedad en su proceso o cuando el despacho le envía un mensaje importante.";
    let h;
    // 30/10/2026 (Darío): con los avisos ya activados la tarjeta no sale; se apagan desde Configuración.
    if (est === "activo") return "";
    else if (est === "iphone") h = vacio("En iPhone: toque el botón Compartir y luego «Agregar a inicio». Abra el portal desde ese ícono y aquí podrá activar los avisos (iOS 16.4 o más nuevo).");
    else if (est === "denegado") h = vacio("Los avisos están bloqueados para esta página. Actívelos en los ajustes del navegador y vuelva a intentarlo.");
    else if (est === "no") h = vacio("Este navegador no admite avisos.");
    else h = '<button type="button" data-push="activar">Activar avisos en este celular</button>';
    return tarjeta("Avisos al celular", "", '<p class="gris" style="margin:0 0 10px">' + esc(como) + "</p>" + h + '<p id="push-msg" class="gris"></p>');
  }
  // Activar o quitar los avisos (desde la tarjeta o desde Configuración). Devuelve el error, si hubo.
  async function avisosActivar() {
    const P = window.DC_PUSH;
    const { data: k } = await sb.rpc("push_clave_publica_transaccional", { datos: {} });
    await P.activar((k && k.clave) || "", "../sw.js", "../");
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

  function vistaProceso() {
    return vistaProcesos() + tarjetaAvisos();
  }

  // V1.6.2: «Así va su proceso» (modelo aprobado por Darío el 29/10): cada paso que el despacho agrega al
  // historial, con su explicación y el PDF para ver o descargar; arriba, el próximo paso.
  const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  function fechaPaso(t, conHora) {
    const m = String(t || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return "";
    let f = +m[3] + " " + MESES[+m[2] - 1] + " " + m[1];
    if (conHora && m[4] !== undefined && !(m[4] === "00" && m[5] === "00")) {
      const h = +m[4];
      f += " · " + ((h + 11) % 12 + 1) + ":" + m[5] + (h < 12 ? " A. M." : " P. M.");
    }
    return f;
  }
  function lineaHistorial(pasos, apertura) {
    if (!pasos.length) return "";
    let h = '<div class="hist-t">Así va su proceso</div><div class="hist">';
    const ult = pasos[0];
    const hoy = L.hoyLocal ? L.iso(L.hoyLocal()) : new Date().toISOString().slice(0, 10);
    if (ult.proximo_paso && (!ult.proximo_fecha || String(ult.proximo_fecha).slice(0, 10) >= hoy)) {
      h += '<div class="paso futuro"><div class="bola">' + (pasos.length + 1) + '</div><div class="crece">' +
        (ult.proximo_fecha ? '<div class="pf">' + esc(fechaPaso(ult.proximo_fecha, true)) + "</div>" : "") +
        '<div class="pt">' + esc(ult.proximo_paso) + "</div>" +
        '<div class="pnota">📅 Próximo paso.' + (ult.proximo_detalle ? " " + esc(ult.proximo_detalle) : " El despacho le avisará cualquier novedad.") + "</div></div></div>";
    }
    pasos.forEach((p, i) => {
      const filas = [["Documento", p.numero], ["Entidad", p.entidad], ["Responsable", p.responsable]].filter(x => String(x[1] || "").trim())
        .map(x => '<div class="pfila"><span>' + x[0] + ":</span> " + esc(x[1]) + "</div>").join("");
      const doc = p.documento ? '<div class="pbotones"><button class="pver" data-doc="ver" data-ruta="' + esc(p.documento.ruta) + '" data-nombre="' + esc(p.documento.nombre) + '">Ver documento</button>' +
        '<button class="pbajar" data-doc="bajar" data-ruta="' + esc(p.documento.ruta) + '" data-nombre="' + esc(p.documento.nombre) + '">⬇ Descargar PDF</button></div>' : "";
      const detalle = (p.explicacion ? '<div class="pexp">' + esc(p.explicacion) + "</div>" : "") + filas + doc;
      h += '<div class="paso' + (i === 0 ? " actual" : "") + '"><div class="bola">' + (pasos.length - i) + '</div><div class="crece">' +
        '<div class="pf">' + esc(fechaPaso(p.fecha)) + "</div>" +
        (detalle ? '<details' + (i === 0 ? " open" : "") + '><summary class="pt">' + esc(p.titulo) + (p.nuevo ? ' <b class="nuevo">NUEVO</b>' : "") + "</summary>" +
          '<div class="pcaja">' + detalle + "</div></details>"
          : '<div class="pt">' + esc(p.titulo) + (p.nuevo ? ' <b class="nuevo">NUEVO</b>' : "") + "</div>") +
        "</div></div>";
    });
    if (apertura) h += '<div class="paso hecho"><div class="bola">✓</div><div class="crece"><div class="pf">' + esc(fechaPaso(apertura)) +
      '</div><div class="pt">Se abrió su expediente en el despacho</div></div></div>';
    return h + "</div>";
  }
  document.addEventListener("click", async ev => {
    const b = ev.target.closest && ev.target.closest("button[data-doc]");
    if (!b) return;
    const ver = b.dataset.doc === "ver";
    // La ventana se abre en el mismo toque (si no, el celular la bloquea) y luego recibe el enlace.
    const ventana = ver ? window.open("", "_blank") : null;
    const antes = b.textContent;
    b.disabled = true; b.textContent = "Abriendo…";
    try {
      const { data, error } = await sb.storage.from("documentos").createSignedUrl(b.dataset.ruta, 600, ver ? undefined : { download: b.dataset.nombre || true });
      if (error || !data || !data.signedUrl) throw error || new Error("sin enlace");
      if (ventana) ventana.location.href = data.signedUrl; else window.location.href = data.signedUrl;
    } catch (e) {
      if (ventana) ventana.close();
      alert("No fue posible abrir el documento. Revise su conexión e intente de nuevo.");
    } finally {
      b.disabled = false; b.textContent = antes;
    }
  });

  function vistaProcesos() {
    const exps = datos.expedientes || [];
    const general = datos.historial_general || [];
    if (!exps.length && !general.length) return tarjeta("Su proceso", "", vacio("Todavía no hay un expediente registrado. Si tiene preguntas, comuníquese con el despacho."));
    return (general.length ? tarjeta("Su proceso", "", lineaHistorial(general, "")) : "") + exps.map(e => {
      const pasos = e.historial || [];
      let h = '<div class="it"><div class="crece">' + esc(e.asunto || e.servicio || "Proceso") +
        "<small>" + esc(e.servicio && e.asunto ? e.servicio + " · " : "") + "Abierto el " + esc(L.fechaCorta(e.apertura)) + "</small></div></div>";
      h += lineaHistorial(pasos, e.apertura);
      if (e.rama && e.rama.fecha) {
        h += item("a", "Última actuación en la Rama Judicial", esc(L.fechaCorta(e.rama.fecha)) + (e.rama.actuacion ? " · " + esc(String(e.rama.actuacion).slice(0, 220)) : "") +
          "<br>Radicado " + esc(e.rama.radicado));
      }
      (e.actuaciones || []).forEach(a => { h += item("z", esc(a.nombre), esc(L.fechaCorta(a.fecha))); });
      if (!(e.rama && e.rama.fecha) && !(e.actuaciones || []).length && !pasos.length) h += vacio("Aún no hay actuaciones registradas.");
      return tarjeta("Expediente " + esc(e.numero), esc(e.estado), h, e.rama && e.rama.fecha ? "mov" : "");
    }).join("");
  }

  function vistaPagos() {
    const contratos = datos.contratos || [];
    if (!contratos.length) return tarjeta("Mis pagos", "", vacio("No hay contratos registrados."));
    let saldo = 0, vencidas = 0, proxima = null, total = 0, pagadoTotal = 0, cuotas = 0, pagadas = 0;
    contratos.forEach(k => (k.cuotas || []).forEach(q => {
      const debe = Math.max(0, num(q.valor) - num(q.pagado));
      total += num(q.valor); pagadoTotal += Math.min(num(q.valor), num(q.pagado)); cuotas++;
      if (debe <= 0) { pagadas++; return; }
      saldo += debe;
      const d = L.diasHasta(q.vencimiento);
      if (d !== null && d < 0) vencidas++;
      else if (d !== null && (proxima === null || d < proxima.d)) proxima = { d, q };
    }));
    // Saldo en grande con la barra de lo pagado (Modelo B / C aprobado por Darío).
    const avance = total > 0 ? Math.round((pagadoTotal / total) * 100) : 0;
    let h = '<div class="saldo"><span class="lbl">Saldo pendiente</span><span class="cifra">' + plata(saldo) + "</span>" +
      '<div class="barra" role="progressbar" aria-valuenow="' + avance + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + avance + '%"></i></div>' +
      '<div class="pie"><span>Ha pagado ' + pagadas + " de " + cuotas + " cuotas (" + avance + " %)</span><span>" +
      (vencidas ? vencidas + (vencidas === 1 ? " cuota vencida" : " cuotas vencidas") : proxima ? "Próxima cuota " + esc(L.fechaCorta(proxima.q.vencimiento)) : "Al día") + "</span></div></div>";
    contratos.forEach(k => {
      const cuotas = (k.cuotas || []).map(q => {
        const debe = Math.max(0, num(q.valor) - num(q.pagado));
        const d = L.diasHasta(q.vencimiento);
        const color = debe <= 0 ? "v" : d !== null && d < 0 ? "r" : d !== null && d <= 5 ? "a" : "z";
        const estado = debe <= 0 ? "Pagada" : d !== null && d < 0 ? "Vencida" : num(q.pagado) > 0 ? "Pago parcial" : "Pendiente";
        return item(color, "Cuota " + esc(q.numero) + " · " + plata(q.valor),
          esc(estado) + " · vence " + esc(L.fechaCorta(q.vencimiento)) + (num(q.pagado) > 0 && debe > 0 ? " · pagado " + plata(q.pagado, true) : ""));
      }).join("");
      h += tarjeta("Contrato " + esc(k.numero), "Honorarios " + plata(k.honorarios, true), cuotas || vacio("Sin cuotas."));
      const pagos = (k.pagos || []).map(p => item("v", plata(p.monto) + " · " + esc(L.fechaCorta(p.fecha)),
        (p.recibo ? "Recibo " + esc(p.recibo) + " · " : "") + esc(p.metodo || p.concepto || ""))).join("");
      h += tarjeta("Pagos recibidos", (k.pagos || []).length, pagos || vacio("Todavía no hay pagos registrados."));
    });
    return h;
  }

  document.querySelector(".nav").addEventListener("click", ev => {
    const b = ev.target.closest("button[data-vista]");
    if (!b || !datos) return;
    if (b.dataset.vista === "mensajes") { abrirMensajes(); return; }
    vista = b.dataset.vista; clearInterval(sondeo);
    pintar();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && datos && Date.now() - cargadoEn > 120000) cargar();
  });

  // Recuperar contraseña: ver ../clave.js.
  const CLAVE = window.DC_CLAVE;
  CLAVE.preparar(sb, { alTerminar: () => { $("volver-clave").classList.add("oculto"); cargar(); } });

  // ---------- Configuración (engranaje de arriba) ----------
  if (window.DCAjustes) DCAjustes.montar({
    app: "cliente",
    avisos: { estado: () => (window.DC_PUSH ? DC_PUSH.estado() : "no"), activar: avisosActivar, quitar: avisosQuitar },
    cambiarClave() {
      $("volver-clave").classList.remove("oculto");
      $("error-nueva-clave").textContent = "";
      mostrar("nueva-clave");
    },
    alCerrar() { if (datos) pintar(); }
  });
  $("volver-clave").addEventListener("click", ev => { ev.preventDefault(); $("volver-clave").classList.add("oculto"); mostrar("app"); });
  async function iniciar() {
    const { data } = await sb.auth.getSession();
    if (CLAVE.enRecuperacion && data.session) { mostrar("nueva-clave"); return; }
    if (data.session) await cargar();
    else { mostrar("entrada"); $("error-entrada").textContent = CLAVE.errorEnlace; }
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js", { scope: "../" }).catch(() => {});
  iniciar();
})();
