// Configuración de las apps del celular (modelo aprobado por Darío el 28/10/2026). Se abre con el engranaje de arriba.
// Abogado: huella, cerrar sesión si no la usa, contraseña, modo nocturno, letra, animación al abrir y avisos.
// Cliente: huella, ocultar valores, contraseña, modo nocturno, letra y avisos.
// Todo se guarda en este celular.
(function () {
  const SVG = {
    huella: '<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M7.5 4.6A8 8 0 0 1 20 11M4 9.5A8 8 0 0 1 5.3 7M4.2 15A8 8 0 0 1 4 12.5M8 19.5c1.2-2 1.8-4.3 1.8-7a2.2 2.2 0 0 1 4.4 0c0 1.2-.1 2.4-.3 3.5M12 12.5c0 3.3-.8 6.3-2.4 8.8M16.4 18.6c.6-1.8 1-3.9 1-6.1a5.4 5.4 0 0 0-8.6-4.3M12.6 21.4c.5-.9.9-1.9 1.2-2.9M19.8 15c.1-.8.2-1.6.2-2.5"/>',
    reloj: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    llave: '<rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    ojo: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 20 20 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    letra: '<path d="M3 19 8 6l5 13M4.8 14.5h6.4M14 19l3.5-9 3.5 9M15.2 16h4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    intro: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5 12 12l8-4.5M12 12v9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
    campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
  };
  const ic = n => '<span class="aj-ic"><svg viewBox="0 0 24 24" aria-hidden="true">' + SVG[n] + "</svg></span>";
  const leer = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const guardar = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };
  const MINUTOS = [5, 10, 15, 30];

  let op = null, caja = null, huellaPosible = false, abiertaLista = false, mensajeAvisos = "", mensajeHuella = "";

  /** Minutos sin uso para cerrar la sesión del abogado (10 por defecto). */
  function minutosInactividad() { const n = Number(leer("dc-movil-inactividad")); return MINUTOS.indexOf(n) >= 0 ? n : 10; }

  function fila(icono, titulo, sub, derecha, extra) {
    return '<div class="aj-op"' + (extra || "") + ">" + ic(icono) + '<span class="aj-tx"><b>' + titulo + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</span>" + derecha + "</div>";
  }
  const sw = (on, accion, desact) => '<button type="button" class="aj-sw' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" data-aj="' + accion + '"' + (desact ? " disabled" : "") + "></button>";
  function seg(accion, opciones, actual) {
    return '<div class="aj-seg">' + opciones.map(([v, t, est]) => '<button type="button" data-aj="' + accion + '" data-v="' + v + '" class="' + (v === actual ? "on" : "") + '"' + (est ? ' style="' + est + '"' : "") + ">" + t + "</button>").join("") + "</div>";
  }

  function pintar() {
    if (!caja) return;
    const T = window.DC_TEMA, H = window.DCHuella;
    const abogado = op.app === "movil";
    const avisosOn = op.avisos && op.avisos.estado() === "activo";
    let h = '<div class="aj-cab"><button type="button" class="aj-atras" data-aj="cerrar" aria-label="Volver">‹</button><b>Configuración</b></div>';
    h += '<div class="aj-sec">Seguridad</div><div class="aj-grupo">';
    if (huellaPosible) h += fila("huella", "Entrar con huella", "Solo en este celular", sw(H && H.activaAqui(), "huella"));
    if (abogado) {
      h += fila("reloj", "Cerrar sesión si no la uso", "Después de " + minutosInactividad() + " minutos", '<span class="aj-flecha">›</span>', ' role="button" tabindex="0" data-aj="minutos"');
      if (abiertaLista) h += '<div class="aj-lista">' + MINUTOS.map(m => '<button type="button" data-aj="min" data-v="' + m + '" class="' + (m === minutosInactividad() ? "on" : "") + '">Después de ' + m + " minutos</button>").join("") + "</div>";
    } else {
      h += fila("ojo", "Ocultar valores", "Los pagos salen como $ ••••", sw(T.ocultarValores(), "ocultar"));
    }
    h += fila("llave", "Cambiar mi contraseña", "", '<span class="aj-flecha">›</span>', ' role="button" tabindex="0" data-aj="clave"');
    h += "</div>" + (mensajeHuella ? '<p class="aj-msg">' + mensajeHuella + "</p>" : "");
    h += '<div class="aj-sec">Pantalla</div><div class="aj-grupo">';
    h += fila("luna", "Modo nocturno", "", "") + seg("tema", [["claro", "Claro"], ["oscuro", "Oscuro"], ["auto", "Automático"]], T.leer());
    h += fila("letra", "Tamaño de la letra", "", "") + seg("letra", [["normal", "Normal", "font-size:11.5px"], ["grande", "Grande", "font-size:13px"], ["muy", "Muy grande", "font-size:14.5px"]], T.leerLetra());
    if (abogado) h += fila("intro", "Animación al abrir", "", sw(T.animacion(), "animacion"));
    h += "</div>";
    h += '<div class="aj-sec">Avisos</div><div class="aj-grupo">';
    h += fila("campana", "Avisos en este celular", abogado ? "Términos y audiencias" : "Novedades de su proceso", sw(avisosOn, "avisos"));
    h += "</div>" + (mensajeAvisos ? '<p class="aj-msg">' + mensajeAvisos + "</p>" : "");
    h += '<div class="aj-ver">Versión ' + (window.DC_VERSION || "") + " · " + (abogado ? "DC Gestión Jurídica" : "Portal de clientes") + "</div>";
    caja.innerHTML = h;
  }

  async function accion(b) {
    const a = b.dataset.aj, T = window.DC_TEMA, H = window.DCHuella;
    if (a === "cerrar") { cerrar(); return; }
    if (a === "tema") T.poner(b.dataset.v);
    else if (a === "letra") T.ponerLetra(b.dataset.v);
    else if (a === "animacion") T.ponerAnimacion(!T.animacion());
    else if (a === "ocultar") T.ponerOcultar(!T.ocultarValores());
    else if (a === "minutos") abiertaLista = !abiertaLista;
    else if (a === "min") { guardar("dc-movil-inactividad", b.dataset.v); abiertaLista = false; }
    else if (a === "clave") { cerrar(); op.cambiarClave(); return; }
    else if (a === "huella") {
      mensajeHuella = "";
      b.disabled = true;
      try {
        if (H.activaAqui()) await H.quitar();
        else if (await H.activar()) { cerrar(); H.listo(); return; }
      } catch (e) { mensajeHuella = (e && e.message) || "No se pudo activar la huella."; }
    } else if (a === "avisos") {
      mensajeAvisos = "";
      const est = op.avisos.estado();
      if (est === "iphone") mensajeAvisos = "En iPhone: toque Compartir y luego «Agregar a inicio». Abra la app desde ese ícono y active aquí los avisos.";
      else if (est === "denegado") mensajeAvisos = "Los avisos están bloqueados para esta página. Actívelos en los ajustes del navegador y vuelva a intentarlo.";
      else if (est === "no") mensajeAvisos = "Este navegador no admite avisos.";
      else {
        b.disabled = true;
        const r = est === "activo" ? await op.avisos.quitar() : await op.avisos.activar();
        if (typeof r === "string" && r) mensajeAvisos = r;
      }
    }
    pintar();
  }

  async function abrir() {
    huellaPosible = !!(window.DCHuella && await window.DCHuella.disponible());
    mensajeAvisos = ""; mensajeHuella = ""; abiertaLista = false;
    caja.classList.remove("oculto");
    pintar();
    caja.scrollTop = 0;
  }
  function cerrar() { caja.classList.add("oculto"); if (op.alCerrar) op.alCerrar(); }

  /** opciones: { app: "movil" | "cliente", avisos: { estado, activar, quitar }, cambiarClave(), alCerrar() } */
  function montar(opciones) {
    op = opciones;
    caja = document.createElement("section");
    caja.id = "ajustes";
    caja.className = "aj oculto";
    document.body.appendChild(caja);
    caja.addEventListener("click", ev => { const b = ev.target.closest("[data-aj]"); if (b && !b.disabled) accion(b); });
    const g = document.getElementById("btn-ajustes");
    if (g) g.addEventListener("click", abrir);
  }

  window.DCAjustes = { montar, abrir, cerrar, minutosInactividad };
})();
