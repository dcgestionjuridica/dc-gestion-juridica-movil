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
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: correo, password: clave });
        if (error) { $("error-entrada").textContent = traducir(error.message); return; }
        $("clave").value = "";
        await iniciar();
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
    cargadoEn = Date.now();
    mostrar("app");
    pintar();
    urgentes();
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
    document.querySelector(".nav").classList.toggle("oculto", vista === "mensajes");
    if (vista === "mensajes") {
      $("titulo").textContent = L.saludo() + (nombre ? ", " + nombre : "");
      $("subtitulo").textContent = "Carvajal & Rivera Abogados Asociados";
      $("cuerpo").innerHTML = vistaMensajes();
      const hilo = $("hilo"); if (hilo) hilo.scrollTop = hilo.scrollHeight;
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
        (prox ? "<span>Próxima cuota: " + esc(L.fechaCorta(prox.q.vencimiento)) + " · " + esc(pesos.format(prox.debe)) + "</span>" : "") + "</div>";
    }
    const quien = [...mensajes].reverse().find(m => m.de === "despacho");
    let h = '<div class="chat">' + sup +
      '<button type="button" class="chat-volver" data-mensajes="volver">‹ Volver a mi proceso</button>' +
      '<div class="msj-aviso">Conversación sobre este proceso' + (quien && quien.quien ? " · " + esc(quien.quien) : "") + "</div>" +
      '<div id="hilo" class="hilo">';
    if (!mensajes.length) h += '<div class="msj-aviso">Todavía no hay mensajes. Escríbanos su duda y le respondemos.</div>';
    mensajes.forEach(m => {
      h += '<div class="msj ' + (m.de === "cliente" ? "cli" : "abo") + '">' + esc(m.texto).replace(/\n/g, "<br>") +
        '<div class="hora">' + esc(horaMsj(m.creado_en)) + (m.de === "despacho" && m.quien ? " · " + esc(m.quien) : "") + "</div></div>";
    });
    h += '<div class="msj-aviso">' + esc(HORARIO) + "</div></div>" +
      '<form id="form-msj" class="caja-msj"><textarea id="txt-msj" rows="1" maxlength="2000" placeholder="Escriba su mensaje…" aria-label="Escriba su mensaje"></textarea>' +
      '<button type="submit" id="env-msj" aria-label="Enviar">➤</button></form><p id="err-msj" class="gris" style="margin:4px 14px"></p></div>';
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
  async function abrirMensajes() {
    vista = "mensajes"; pintar();
    await cargarMensajes(true);
    pintar();
    clearInterval(sondeo);
    sondeo = setInterval(() => { if (vista === "mensajes" && document.visibilityState === "visible") cargarMensajes(false); else if (vista !== "mensajes") clearInterval(sondeo); }, 30000);
  }
  document.addEventListener("click", ev => {
    const b = ev.target.closest && ev.target.closest("[data-mensajes]");
    if (!b || !datos) return;
    if (b.dataset.mensajes === "abrir") abrirMensajes();
    else { vista = "proceso"; clearInterval(sondeo); pintar(); }
  });
  document.addEventListener("submit", async ev => {
    if (!ev.target || ev.target.id !== "form-msj") return;
    ev.preventDefault();
    const caja = $("txt-msj"), texto = (caja.value || "").trim();
    if (!texto) return;
    $("env-msj").disabled = true; $("err-msj").textContent = "";
    const { error } = await sb.rpc("portal_mensaje_enviar_transaccional", { datos: { texto } });
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
    if (est === "activo") h = item("a", "Avisos activados en este celular", "Puede quitarlos cuando quiera.") + '<button type="button" class="sec" data-push="quitar">Quitar avisos</button>';
    else if (est === "iphone") h = vacio("En iPhone: toque el botón Compartir y luego «Agregar a inicio». Abra el portal desde ese ícono y aquí podrá activar los avisos (iOS 16.4 o más nuevo).");
    else if (est === "denegado") h = vacio("Los avisos están bloqueados para esta página. Actívelos en los ajustes del navegador y vuelva a intentarlo.");
    else if (est === "no") h = vacio("Este navegador no admite avisos.");
    else h = '<button type="button" data-push="activar">Activar avisos en este celular</button>';
    return tarjeta("Avisos al celular", "", '<p class="gris" style="margin:0 0 10px">' + esc(como) + "</p>" + h + '<p id="push-msg" class="gris"></p>');
  }
  document.addEventListener("click", async ev => {
    const b = ev.target.closest && ev.target.closest("[data-push]");
    if (!b || !window.DC_PUSH) return;
    const P = window.DC_PUSH, msg = () => $("push-msg");
    b.disabled = true;
    if (b.dataset.push === "activar") {
      const { data: k } = await sb.rpc("push_clave_publica_transaccional", { datos: {} });
      await P.activar((k && k.clave) || "", "../sw.js", "../");
      if (P.resultado) {
        const { error } = await sb.rpc("push_suscribir_transaccional", { datos: JSON.parse(P.resultado) });
        if (error) { try { localStorage.removeItem("dc-push-activo"); } catch (e) {} msg().textContent = "No se pudo activar: " + error.message; b.disabled = false; return; }
      } else { msg().textContent = P.error; b.disabled = false; return; }
    } else {
      await P.desactivar();
      if (P.resultado && P.resultado !== "{}") await sb.rpc("push_quitar_transaccional", { datos: JSON.parse(P.resultado) });
    }
    pintar();
  });

  function vistaProceso() {
    const boton = '<button type="button" class="btn-duda" data-mensajes="abrir">💬 Tengo una duda sobre mi caso</button>';
    return vistaProcesos() + boton + tarjetaAvisos();
  }

  function vistaProcesos() {
    const exps = datos.expedientes || [];
    if (!exps.length) return tarjeta("Su proceso", "", vacio("Todavía no hay un expediente registrado. Si tiene preguntas, comuníquese con el despacho."));
    return exps.map(e => {
      let h = '<div class="it"><div class="crece">' + esc(e.asunto || e.servicio || "Proceso") +
        "<small>" + esc(e.servicio && e.asunto ? e.servicio + " · " : "") + "Abierto el " + esc(L.fechaCorta(e.apertura)) + "</small></div></div>";
      if (e.rama && e.rama.fecha) {
        h += item("a", "Última actuación en la Rama Judicial", esc(L.fechaCorta(e.rama.fecha)) + (e.rama.actuacion ? " · " + esc(String(e.rama.actuacion).slice(0, 220)) : "") +
          "<br>Radicado " + esc(e.rama.radicado));
      }
      (e.actuaciones || []).forEach(a => { h += item("z", esc(a.nombre), esc(L.fechaCorta(a.fecha))); });
      if (!(e.rama && e.rama.fecha) && !(e.actuaciones || []).length) h += vacio("Aún no hay actuaciones registradas.");
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
    let h = '<div class="saldo"><span class="lbl">Saldo pendiente</span><span class="cifra">' + esc(pesos.format(saldo)) + "</span>" +
      '<div class="barra" role="progressbar" aria-valuenow="' + avance + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + avance + '%"></i></div>' +
      '<div class="pie"><span>Ha pagado ' + pagadas + " de " + cuotas + " cuotas (" + avance + " %)</span><span>" +
      (vencidas ? vencidas + (vencidas === 1 ? " cuota vencida" : " cuotas vencidas") : proxima ? "Próxima cuota " + esc(L.fechaCorta(proxima.q.vencimiento)) : "Al día") + "</span></div></div>";
    contratos.forEach(k => {
      const cuotas = (k.cuotas || []).map(q => {
        const debe = Math.max(0, num(q.valor) - num(q.pagado));
        const d = L.diasHasta(q.vencimiento);
        const color = debe <= 0 ? "v" : d !== null && d < 0 ? "r" : d !== null && d <= 5 ? "a" : "z";
        const estado = debe <= 0 ? "Pagada" : d !== null && d < 0 ? "Vencida" : num(q.pagado) > 0 ? "Pago parcial" : "Pendiente";
        return item(color, "Cuota " + esc(q.numero) + ' · <span class="monto">' + esc(pesos.format(num(q.valor))) + "</span>",
          esc(estado) + " · vence " + esc(L.fechaCorta(q.vencimiento)) + (num(q.pagado) > 0 && debe > 0 ? " · pagado " + esc(pesos.format(num(q.pagado))) : ""));
      }).join("");
      h += tarjeta("Contrato " + esc(k.numero), "Honorarios " + esc(pesos.format(num(k.honorarios))), cuotas || vacio("Sin cuotas."));
      const pagos = (k.pagos || []).map(p => item("v", '<span class="monto">' + esc(pesos.format(num(p.monto))) + "</span> · " + esc(L.fechaCorta(p.fecha)),
        (p.recibo ? "Recibo " + esc(p.recibo) + " · " : "") + esc(p.metodo || p.concepto || ""))).join("");
      h += tarjeta("Pagos recibidos", (k.pagos || []).length, pagos || vacio("Todavía no hay pagos registrados."));
    });
    return h;
  }

  document.querySelector(".nav").addEventListener("click", ev => {
    const b = ev.target.closest("button[data-vista]");
    if (!b || !datos) return;
    vista = b.dataset.vista;
    pintar();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && datos && Date.now() - cargadoEn > 120000) cargar();
  });

  // Recuperar contraseña: ver ../clave.js.
  const CLAVE = window.DC_CLAVE;
  CLAVE.preparar(sb, { alTerminar: () => cargar() });
  async function iniciar() {
    const { data } = await sb.auth.getSession();
    if (CLAVE.enRecuperacion && data.session) { mostrar("nueva-clave"); return; }
    if (data.session) await cargar();
    else { mostrar("entrada"); $("error-entrada").textContent = CLAVE.errorEnlace; }
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("../sw.js", { scope: "../" }).catch(() => {});
  iniciar();
})();
