// Órdenes de voz con Doc Dai (pedido de Darío, 22/11/2026; modelo aprobado: analisis/modelo_ordenes_voz).
// Botón dorado del micrófono arriba → Doc Dai escucha → tarjeta para confirmar → «Sí, enviar».
// Nada se envía sin que el abogado toque el botón de confirmar. El reconocimiento de voz es el del
// navegador (gratis) y quien entiende y ejecuta la orden es la función «ordenes-voz» del servidor de C&R.
(function () {
  const cfg = window.DC_CONFIG;
  const $ = id => document.getElementById(id);
  const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const plata = v => "$ " + Math.round(Number(v) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const fechaCorta = f => { if (!/^\d{4}-\d{2}-\d{2}/.test(f || "")) return ""; const t = new Date(f.slice(0, 10) + "T12:00:00Z"); return DIAS[t.getUTCDay()] + " " + t.getUTCDate() + " de " + MESES[t.getUTCMonth()]; };
  const horaBonita = h => { const m = /^(\d{1,2}):(\d{2})/.exec(h || ""); if (!m) return ""; let x = +m[1]; const pm = x >= 12; x = x % 12 || 12; return x + ":" + m[2] + (pm ? " p. m." : " a. m."); };
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const AYUDA = ["Envía la cuenta de cobro a…", "Envía un mensaje a…", "¿Qué tengo para mañana?", "Agéndame una tarea de… mañana a las 9", "¿Cuánto debe…?", "Cancela… (lo agendado, un mensaje o un cobro)"];
  const MIC = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg>';

  let est = null;        // estado de la hoja
  let rec = null;        // reconocimiento en curso

  // ---------- Voz de Doc Dai (femenina latina, igual que en la app completa) ----------
  // Voz de Doc Dai: la mejor voz femenina latina que tenga el celular o el computador (gratis, nada sale del equipo).
  // Prefiere voces «naturales», «mejoradas» o «premium» y de Colombia/México/EE. UU.; nunca de hombre ni de España.
  const MUJERES = /(salom|dalia|paloma|elena|sabina|paulina|marisol|camila|ximena|valentina|catalina|luciana|renata|larissa|lupe|penelope|penélope|mia|sof[ií]a|isabela|gabriela|andrea|carolina|beatriz|esc|esf)/i;
  const HOMBRES = /(jorge|pablo|raul|raúl|alvaro|álvaro|diego|enrique|carlos|juan|andres|andrés|gonzalo|tomas|tomás|miguel|antonio|jose|josé|emilio|lorenzo|gerardo|federico|alonso|esd|\bmale\b|hombre)/i;
  let vozElegida = null;
  function puntaje(v) {
    const n = v.name || "", l = (v.lang || "").toLowerCase().replace("_", "-");
    if (!l.startsWith("es") || HOMBRES.test(n)) return -1;
    let p = 0;
    if (/natural|neural|online|premium|enhanced|mejorad|network/i.test(n)) p += 50;
    if (MUJERES.test(n)) p += 20;
    if (l === "es-co") p += 18; else if (l === "es-mx") p += 15; else if (l === "es-us" || l === "es-419") p += 13; else if (l !== "es-es") p += 8;
    if (l === "es-es") p -= 10;
    if (/google/i.test(n)) p += 6;
    if (/compact|eloquence|grandma|grandpa|abuel/i.test(n)) p -= 30;
    return p;
  }
  function elegirVoz() {
    try {
      const vs = window.speechSynthesis.getVoices().map(v => [puntaje(v), v]).filter(x => x[0] >= 0).sort((a, b) => b[0] - a[0]);
      if (vs.length) vozElegida = vs[0][1];
    } catch (e) {}
    return vozElegida;
  }
  try { if ("speechSynthesis" in window) { elegirVoz(); window.speechSynthesis.addEventListener("voiceschanged", elegirVoz); } } catch (e) {}
  function hablar(texto) {
    let listo = null; const fin = new Promise(r => { listo = r; });
    try {
      if (!texto || !("speechSynthesis" in window)) { listo(); return fin; }
      const s = window.speechSynthesis; s.cancel();
      const voz = vozElegida || elegirVoz();
      // Más pausado y un poco más grave suena cálido y menos robótico. Frase por frase, con su pausa natural.
      const limpio = String(texto).replace(/\$\s?/g, "").replace(/\s+/g, " ").trim();
      const frases = limpio.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/).filter(f => f.trim());
      // Por si el navegador no avisa que terminó de hablar.
      setTimeout(listo, 1500 + limpio.length * 85);
      frases.forEach((f, i) => {
        const t = f.trim();
        const u = new SpeechSynthesisUtterance(t);
        if (voz) u.voice = voz;
        u.lang = voz ? voz.lang : "es-CO";
        const natural = voz && /natural|neural|online|premium|enhanced|mejorad|network/i.test(voz.name);
        u.rate = natural ? 0.95 : 0.9;
        u.pitch = natural ? 1 : 0.94;
        u.volume = 1;
        if (i === frases.length - 1) { u.onend = () => listo(); u.onerror = () => listo(); }
        s.speak(u);
      });
      if (!frases.length) listo();
    } catch (e) { listo(); }
    return fin;
  }
  const callar = () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} };

  // ---------- Servidor ----------
  // En la web liviana la sesión es la de DC_SB; en la app completa la pasa la app al abrir (opciones).
  let opciones = null;
  async function llamar(cuerpo) {
    let token = opciones && opciones.token;
    if (!token && window.DC_SB) { const { data } = await window.DC_SB.auth.getSession(); token = data && data.session && data.session.access_token; }
    if (!token) throw new Error("Su sesión se cerró. Vuelva a entrar.");
    const url = (opciones && opciones.url) || cfg.url, clave = (opciones && opciones.clave) || cfg.clavePublica;
    const h = { Authorization: "Bearer " + token, apikey: clave, "Content-Type": "application/json" };
    if (opciones && opciones.version) h["x-dc-version"] = opciones.version;
    const r = await fetch(url + "/functions/v1/ordenes-voz", { method: "POST", headers: h, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(j.error || "No se pudo conectar con el servidor.");
    return j;
  }

  // ---------- Escuchar ----------
  function escuchar(alTexto, alNada) {
    if (!R) { est = { fase: "sinvoz" }; pintar(); return; }
    detener();
    let final = "", ultimo = "";
    rec = new R(); rec.lang = "es-CO"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    rec.onresult = ev => {
      let t = ""; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      ultimo = t; if (ev.results[ev.results.length - 1].isFinal) final = t;
      const d = $("voz-dicho"); if (d) { d.textContent = "«" + t + "»"; d.classList.remove("oculto"); }
    };
    rec.onerror = ev => { rec = null; if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { est = { fase: "permiso" }; pintar(); } else if (ev.error === "no-speech") { if (alNada) alNada(); else { est = { fase: "escucha", nada: true }; pintar(); } } };
    rec.onend = () => { const t = (final || ultimo).trim(); rec = null; if (t) alTexto(t); else if (alNada) alNada(); else if (est && est.fase === "escucha" && !est.nada) { est.nada = true; pintar(); } };
    try { rec.start(); } catch (e) { rec = null; }
  }
  function detener() { if (rec) { try { rec.onend = null; rec.abort(); } catch (e) {} rec = null; } }

  function abrir() {
    callar();
    est = { fase: "escucha" }; pintar();
    escuchar(async texto => {
      est = { fase: "pensando", dicho: texto }; pintar();
      try {
        const r = await llamar({ paso: "entender", texto });
        est = { fase: "tarjeta", r, elegido: r.candidatos && r.candidatos.length === 1 ? r.candidatos[0].id : null, mensaje: r.mensaje || "", fecha: r.fecha || "", hora: r.hora || "", titulo: "" };
        pintar();
        if (r.accion === "mensaje" && est.elegido && !est.mensaje && est.elegido && elegido().portal) { if (r.voz) await hablar(r.voz); if (est && est.r === r) dictarMensaje(); }
        else preguntarSiNo(r.voz);
      } catch (e) { est = { fase: "error", error: e.message }; pintar(); }
    });
  }
  function cerrar() { detener(); callar(); est = null; pintar(); }

  function dictarMensaje() {
    est.dictando = true; pintar();
    escuchar(t => { if (!est) return; est.dictando = false; est.mensaje = t; pintar(); preguntarSiNo(""); }, () => { if (est) { est.dictando = false; pintar(); } });
  }

  // ---------- Confirmar con la voz: Doc Dai pregunta y basta decir «sí» o «no» ----------
  const SI = /^(si+|sip|claro|dale|de una|hagale|hazlo|correcto|confirmo|confirmado|afirmativo|listo|ok|okay|por favor|bueno|exacto|eso|cancelalo|cancela|borralo|borra|retiralo|retira|quitalo|anulalo|envialo|envia|adelante)\b/;
  const NO = /\b(no|nop|negativo|mejor no|todavia no|espera|esperate|deja(lo)?|para|alto|olvidalo|nada)\b/;
  const normal = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  const horaDicha = h => { const m = /^(\d{1,2}):(\d{2})/.exec(h || ""); if (!m) return ""; const H = +m[1], M = +m[2], h12 = H % 12 || 12;
    return (h12 === 1 ? "a la una" : "a las " + h12) + (M ? (M === 30 ? " y media" : ":" + m[2]) : "") + (H < 12 ? " de la mañana" : H < 19 ? " de la tarde" : " de la noche"); };
  // ¿Qué confirma la tarjeta abierta? Devuelve la pregunta en voz alta y la acción del botón dorado.
  function queConfirma() {
    if (!est || est.fase !== "tarjeta" || est.espera || est.enviando) return null;
    const r = est.r, c = elegido();
    if (r.accion === "cancelar") {
      if (!c || (r.que === "cobro" && c.tiene_correo === false)) return null;
      return { boton: "cancelar", no: "Listo, no cancelé nada.", p: r.que === "mensaje" ? "¿Retiro ese mensaje del portal?" : r.que === "cobro" ? "¿Le envío el aviso al cliente?" : "¿Cancelo " + (c.nombre ? "«" + c.nombre + "»" : "eso") + (c.detalle ? ", " + c.detalle : "") + "?" };
    }
    if (r.accion === "cobro") {
      if (!c || !c.tiene_correo || (!c.vencidas && !c.proxima)) return null;
      return { boton: "enviar", no: "Listo, no envié nada.", p: "¿Le envío " + (c.vencidas ? "la cuenta de cobro" : "el recordatorio de la cuota") + " a " + c.nombre + "?" };
    }
    if (r.accion === "mensaje") {
      if (!c || !c.portal || est.dictando || !String(est.mensaje || "").trim()) return null;
      return { boton: "enviar", no: "Listo, no envié nada.", p: "¿Le envío el mensaje a " + c.nombre + "?" };
    }
    if (r.accion === "agendar") {
      if (!est.fecha) return null;
      const tit = est.titulo || [r.clase, c ? c.nombre : ""].filter(Boolean).join(", ");
      return { boton: "agendar", no: "Listo, no agendé nada.", p: "¿Agendo " + (tit ? "«" + tit + "» " : "") + "para el " + fechaCorta(est.fecha) + (est.hora ? " " + horaDicha(est.hora) : "") + "?" };
    }
    return null;
  }
  // Salen los botones y además Doc Dai pregunta: decir «sí» es igual que tocar el botón dorado; «no», igual que «Cancelar».
  async function preguntarSiNo(antes, intento) {
    guardarCampos();
    const q = queConfirma(); if (!q) { if (antes) hablar(antes); return; }
    const yo = est; detener();
    yo.siNo = "habla"; pintar();
    await hablar(intento ? "No le entendí. Diga sí, o no." : [antes || "", q.p, "Diga sí o no."].filter(Boolean).join(" "));
    if (est !== yo || yo.siNo !== "habla" || yo.espera || yo.enviando) return;
    yo.siNo = "oye"; pintar();
    escuchar(t => {
      if (est !== yo || yo.siNo !== "oye") return;
      const n = normal(t);
      const dijoSi = !/^no\b/.test(n) && SI.test(n), dijoNo = !dijoSi && NO.test(n);
      if (dijoNo) { yo.siNo = null; est = { fase: "listo", texto: q.no }; pintar(); hablar(q.no); }
      else if (dijoSi) { yo.siNo = null; confirmar(q.boton); }
      else if (!intento) preguntarSiNo("", true);
      else { yo.siNo = "tocar"; pintar(); hablar("Toque el botón, por favor."); }
    }, () => {
      if (est !== yo || yo.siNo !== "oye") return;
      if (!intento) preguntarSiNo("", true); else { yo.siNo = "tocar"; pintar(); }
    });
  }
  const indicadorSiNo = () => !est.siNo || est.espera || est.enviando ? "" : est.siNo === "tocar"
    ? '<div class="voz-sino">No le escuché. Use los botones de abajo. <button type="button" class="voz-sino-otra" data-voz="sino">' + MIC + ' Volver a escuchar</button></div>'
    : '<div class="voz-sino' + (est.siNo === "oye" ? " oye" : "") + '"><span class="voz-sino-mic">' + MIC + '</span><span class="crece">' + (est.siNo === "oye" ? "Le escucho… diga <b>«sí»</b> o <b>«no»</b>" : "Doc Dai le pregunta en voz alta…") + '<small id="voz-dicho" class="oculto"></small></span></div>';

  // ---------- Pintar ----------
  function cabeza(t, sub) {
    return '<div class="voz-dai"><span class="voz-f">DD</span><div class="crece"><b>' + esc(t) + "</b>" + (sub ? "<small>" + esc(sub) + "</small>" : "") + '</div><button type="button" class="voz-como" data-voz="como" aria-label="¿Cómo funciona?">?</button></div>';
  }
  const ayudaHtml = () => '<div class="voz-ayuda">Puede decir, por ejemplo:' + AYUDA.map(a => "<b>• " + esc(a) + "</b>").join("") + "</div>";
  const onda = () => '<div class="voz-onda">' + [14, 30, 48, 26, 54, 36, 18, 42, 24, 12].map((h, i) => '<i style="height:' + h + "px;animation-delay:" + (i * 0.08) + 's"></i>').join("") + "</div>";
  const botones = (no, si, dSi) => (si && est.fase === "tarjeta" ? indicadorSiNo() : "") + (est.espera > 0
    ? '<div class="voz-bts"><button type="button" class="voz-b1" data-voz="deshacer">Deshacer · se hace en ' + est.espera + "</button></div>"
    : '<div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">' + esc(no) + "</button>" + (si ? '<button type="button" class="voz-b1" data-voz="' + dSi + '"' + (est.enviando ? " disabled" : "") + ">" + esc(est.enviando ? "Un momento…" : si) + "</button>" : "") + "</div>");
  function elegir(lista, sub) {
    if (!lista.length) return '<div class="voz-aviso">No encontré un cliente con ese nombre. Toque «Otra vez» y dígalo con nombre y apellido.</div>';
    if (lista.length === 1) return "";
    return '<div class="voz-aviso">Encontré ' + lista.length + " clientes con ese nombre. Elija a quién:</div>" + lista.map(c =>
      '<button type="button" class="voz-op' + (est.elegido === c.id ? " sel" : "") + '" data-voz-cli="' + c.id + '"><span class="voz-rad"></span><span class="crece">' + esc(c.nombre) +
      "<small>" + esc([c.doc ? "C.C. terminada en " + c.doc : "", sub(c)].filter(Boolean).join(" · ")) + "</small></span></button>").join("");
  }
  const dato = (k, v, cls) => '<div class="voz-dato"><span>' + esc(k) + "</span><b" + (cls ? ' class="' + cls + '"' : "") + ">" + esc(v) + "</b></div>";
  const elegido = () => est && est.r && (est.r.candidatos || []).find(c => c.id === est.elegido);

  function tarjeta() {
    const r = est.r, c = elegido(), lista = r.candidatos || [];
    if (r.accion === "desconocida") return cabeza("No entendí la orden", "Entendí: «" + r.dicho + "»") + ayudaHtml() + '<div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">Cerrar</button><button type="button" class="voz-b1" data-voz="otra">Otra vez</button></div>';
    if (r.accion === "agenda_dia") {
      return cabeza(String(r.titulo || "").replace(/ de \d{4}$/, ""), "Doc Dai también se lo lee en voz alta") + '<div class="voz-tarj">' + (r.eventos.length ? r.eventos.map(e =>
        '<div class="voz-ev"><span class="voz-hora">' + esc(e.hora) + '</span><span class="crece">' + esc(e.titulo) + (e.detalle ? "<small>" + esc(e.detalle) + "</small>" : "") + "</span></div>").join("") : '<div class="voz-vacio">No hay nada en la agenda para ese día.</div>') + "</div>" +
        '<div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">Cerrar</button>' + (document.querySelector('.nav [data-vista="agenda"]') ? '<button type="button" class="voz-b1" data-voz="agenda">Abrir la Agenda</button>' : '<button type="button" class="voz-b1" data-voz="otra">Otra orden</button>') + "</div>";
    }
    if (r.accion === "deuda") {
      let h = cabeza("¿Cuánto debe?", "Entendí: «" + r.entendi + "»") + elegir(lista, x => x.correo || "");
      if (c) h += '<div class="voz-tarj"><div class="voz-etq">' + esc(c.nombre) + "</div>" + dato("Saldo pendiente", plata(c.total)) +
        dato("Cuotas vencidas", c.vencidas ? c.vencidas + " (" + plata(c.saldo_vencido) + ")" : "Ninguna", c.vencidas ? "rojo" : "") +
        dato("Próxima cuota", c.proxima ? fechaCorta(c.proxima.fecha) + " · " + plata(c.proxima.valor) : "—") + "</div>";
      return h + '<div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">Cerrar</button><button type="button" class="voz-b1" data-voz="otra">Otra orden</button></div>';
    }
    if (r.accion === "cobro") {
      let h = cabeza("Enviar cuenta de cobro", "Entendí: «" + r.entendi + "»") + elegir(lista, x => x.correo || "sin correo"), si = "";
      if (c) {
        if (!c.tiene_correo) h += '<div class="voz-aviso rojo">Este cliente no tiene correo. Agréguelo en su ficha para poder enviarle el cobro.</div>';
        else if (!c.vencidas && !c.proxima) h += '<div class="voz-aviso">Este cliente no tiene cuotas pendientes. No hay nada que cobrar.</div>';
        else {
          if (c.cuota_litis) h += '<div class="voz-aviso">Ojo: este cliente es de cuota litis.</div>';
          if (c.pausado) h += '<div class="voz-aviso">Ojo: este cliente tiene el cobro de cuotas en pausa. Si confirma, este correo sí sale.</div>';
          h += '<div class="voz-tarj"><div class="voz-etq">Lo que se va a enviar</div>' + (c.vencidas
            ? dato("Cuotas vencidas", String(c.vencidas)) + dato("Saldo vencido", plata(c.saldo_vencido), "rojo") + dato("Va como", "Correo de cobro con copia en PDF")
            : dato("Cuotas vencidas", "Ninguna") + dato("Va como", "Recordatorio de la cuota " + c.proxima.numero) + dato("Vence", fechaCorta(c.proxima.fecha) + " · " + plata(c.proxima.valor))) +
            dato("Para", c.correo) + dato("Firma", "Carvajal & Rivera Abogados") + "</div>";
          si = "Sí, enviar";
        }
      }
      return h + botones("Cancelar", si, "enviar");
    }
    if (r.accion === "mensaje") {
      let h = cabeza("Enviar mensaje al portal", "Entendí: «" + r.entendi + "»") + elegir(lista, x => x.portal ? "Portal activo" : "Sin portal"), si = "";
      if (c && !c.portal) h += '<div class="voz-aviso rojo">Este cliente todavía no ha entrado a su portal, así que no puede leer mensajes allí.</div>';
      else if (c) {
        h += '<div class="voz-tarj"><div class="voz-etq">Mensaje para ' + esc(c.nombre) + "</div>" +
          (est.dictando ? '<div class="voz-dicho">Doc Dai le escucha… diga el mensaje.</div>' + onda()
            : '<textarea id="voz-txt" class="voz-txt" rows="4" maxlength="2000" placeholder="¿Qué desea decirle?">' + esc(est.mensaje) + "</textarea>" +
              '<button type="button" class="voz-dictar" data-voz="dictar">' + MIC + " Dictar el mensaje</button>") + "</div>";
        if (!est.dictando) si = "Sí, enviar";
      }
      return h + botones("Cancelar", si, "enviar");
    }
    if (r.accion === "agendar") {
      let h = cabeza(r.titulo, r.entendi ? "Entendí: «" + r.entendi + "»" : "") + (lista.length > 1 ? elegir(lista, x => (x.expedientes && x.expedientes[0] ? "Rad. " + x.expedientes[0].numero : "")) : "");
      const exp = c && c.expedientes && c.expedientes[0];
      const tit = est.titulo || [r.clase, c ? c.nombre : ""].filter(Boolean).join(" · ");
      h += '<div class="voz-tarj"><div class="voz-etq">Así quedará en la agenda</div>' +
        '<label class="voz-campo">Título<input id="voz-tit" value="' + esc(tit) + '"></label>' +
        '<div class="voz-fila2"><label class="voz-campo">Fecha<input id="voz-fecha" type="date" value="' + esc(est.fecha) + '"></label>' +
        '<label class="voz-campo">Hora<input id="voz-hora" type="time" value="' + esc(est.hora) + '"></label></div>' +
        (exp ? dato("Expediente", "Rad. " + exp.numero) : "") + dato("Aviso", "Un día antes") + "</div>" +
        '<div class="voz-aviso">Puede corregir cualquier dato antes de guardar. También queda en su Google Calendar.</div>';
      return h + botones("Cancelar", "Sí, agendar", "agendar");
    }
    if (r.accion === "cancelar") {
      let h = cabeza(r.titulo || "Cancelar", r.dicho ? "Entendí: «" + r.dicho + "»" : "");
      if (!lista.length) return h + '<div class="voz-aviso">' + esc(r.voz || "No encontré nada que cancelar.") + "</div>" + '<div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">Cerrar</button><button type="button" class="voz-b1" data-voz="otra">Otra vez</button></div>';
      const etq = r.que === "mensaje" ? "Mensaje que se retira del portal" : r.que === "cobro" ? "Cliente" : "Lo que se quita de la agenda";
      if (lista.length > 1) h += '<div class="voz-aviso">Encontré ' + lista.length + " opciones. Elija cuál:</div>" + lista.map(x =>
        '<button type="button" class="voz-op' + (est.elegido === x.id ? " sel" : "") + '" data-voz-cli="' + x.id + '"><span class="voz-rad"></span><span class="crece">' + esc(x.nombre) + "<small>" + esc(x.detalle || "") + "</small></span></button>").join("");
      if (c) {
        h += '<div class="voz-tarj"><div class="voz-etq">' + etq + "</div>" + dato(r.que === "cobro" ? "Nombre" : r.que === "mensaje" ? "Texto" : "Título", c.nombre) + dato(r.que === "agenda" ? "Cuándo" : "Detalle", c.detalle || "") + "</div>";
        if (r.que === "agenda") h += '<div class="voz-aviso">También desaparece de Google Calendar en unos minutos.</div>';
        if (r.que === "mensaje") h += '<div class="voz-aviso">' + (c.leido ? "Ojo: el cliente ya lo leyó. Igual se retira del chat." : "Se borra del chat del portal. Si el cliente ya vio el aviso en su celular, al abrir no lo encontrará.") + "</div>";
        if (r.que === "cobro") h += '<div class="voz-aviso rojo">Un correo enviado no se puede devolver. Lo que sí puedo hacer es enviarle al cliente un correo corto pidiéndole que no tenga en cuenta el cobro anterior.</div>' +
          (c.tiene_correo === false ? '<div class="voz-aviso rojo">Este cliente no tiene correo válido.</div>' : "");
      }
      const si = !c ? "" : r.que === "mensaje" ? "Sí, retirar" : r.que === "cobro" ? (c.tiene_correo === false ? "" : "Sí, enviar el aviso") : "Sí, cancelar";
      return h + botones("No", si, "cancelar");
    }
    return "";
  }

  function cuerpo() {
    if (!est) return "";
    if (est.fase === "escucha") return cabeza(est.dictando ? "Diga el mensaje…" : "Doc Dai le escucha…", est.nada ? "No escuché nada. Toque «Otra vez» y hable cerca del celular." : "Hable con calma. Toque fuera para cancelar.") + onda() +
      '<div id="voz-dicho" class="voz-dicho oculto"></div>' + ayudaHtml() + (est.nada ? '<div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">Cerrar</button><button type="button" class="voz-b1" data-voz="otra">Otra vez</button></div>' : "");
    if (est.fase === "pensando") return cabeza("Un momento…", "Doc Dai está entendiendo la orden") + '<div class="voz-dicho">«' + esc(est.dicho) + '»</div><div class="voz-cargando"><i></i><i></i><i></i></div>';
    if (est.fase === "error") return cabeza("No se pudo", est.error) + '<div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">Cerrar</button><button type="button" class="voz-b1" data-voz="otra">Otra vez</button></div>';
    if (est.fase === "listo") return cabeza("Hecho", "") + '<div class="voz-ok">✓ ' + esc(est.texto) + '</div><div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">Cerrar</button><button type="button" class="voz-b1" data-voz="otra">Otra orden</button></div>';
    if (est.fase === "permiso") return cabeza("Falta el permiso del micrófono", "") + '<div class="voz-aviso">Permita el micrófono para esta página en los ajustes del navegador (el candado junto a la dirección › Permisos › Micrófono) y vuelva a intentarlo.</div>' + botones("Cerrar", "", "");
    if (est.fase === "sinvoz") return cabeza("Este navegador no reconoce la voz", "") + '<div class="voz-aviso">Abra la app en Google Chrome o en Microsoft Edge para usar las órdenes de voz.</div>' + botones("Cerrar", "", "");
    if (est.fase === "como") return cabeza("¿Cómo funciona?", "Órdenes de voz con Doc Dai") + '<div class="voz-como-txt">' +
      "<p><b>1.</b> Toque el botón dorado de Doc Dai y diga la orden con calma.</p>" +
      "<p><b>2.</b> Doc Dai entiende lo que pidió y le muestra una tarjeta con los datos. Si hay clientes con nombres parecidos, usted elige a cuál.</p>" +
      "<p><b>3.</b> Doc Dai le pregunta en voz alta si lo hace. Puede contestar <b>«sí»</b> o <b>«no»</b> con la voz, o tocar el botón: es lo mismo. <b>Nada se envía</b> sin su sí, y aun así tiene 5 segundos para tocar «Deshacer».</p>" +
      "<p><b>Órdenes:</b> enviar la cuenta de cobro (si no tiene cuotas vencidas, va el recordatorio de la próxima), enviar un mensaje al portal del cliente, agendar tareas, recordatorios, audiencias o citas, preguntar qué tiene para un día y cuánto debe un cliente. <b>Todo se puede cancelar:</b> «cancela la tarea de mañana», «borra el mensaje que le mandé a…» (hasta 24 horas), «anula el cobro de…» (como el correo ya salió, se le envía al cliente un aviso de que no lo tenga en cuenta) o «deshaz lo último».</p>" +
      "<p>El navegador convierte su voz en texto con su dictado (Google en Chrome, Microsoft en Edge), igual que el micrófono de Doc Dai. Después, la orden se entiende en el servidor del despacho, sin inteligencia artificial externa. Es gratis.</p></div>" +
      '<div class="voz-bts"><button type="button" class="voz-b2" data-voz="cerrar">Cerrar</button><button type="button" class="voz-b1" data-voz="otra">Dar una orden</button></div>';
    if (est.fase === "tarjeta") return tarjeta();
    return "";
  }
  function pintar() {
    // El botón de Doc Dai del menú crece y suena (ondas y barras) mientras escucha.
    const dai = document.querySelector(".nav .dai");
    if (dai) dai.classList.toggle("vivo", !!est && (est.fase === "escucha" || !!est.dictando || est.siNo === "oye"));
    let caja = $("voz-hoja");
    if (!est) { if (caja) caja.remove(); return; }
    if (!caja) { caja = document.createElement("div"); caja.id = "voz-hoja"; document.body.appendChild(caja); }
    // Se guardan los campos que el abogado esté escribiendo antes de volver a pintar.
    guardarCampos();
    caja.className = opciones ? "voz-propio" + (opciones.oscuro ? " voz-oscuro" : "") : "";
    caja.innerHTML = '<div class="hoja-velo" data-voz="fuera"></div><div class="hoja-a voz-hoja" role="dialog" aria-label="Órdenes de voz"><div class="hoja-asa"></div>' + cuerpo() + "</div>";
  }
  function guardarCampos() {
    if (!est) return;
    const t = $("voz-txt"); if (t) est.mensaje = t.value;
    const a = $("voz-tit"); if (a) est.titulo = a.value;
    const f = $("voz-fecha"); if (f) est.fecha = f.value;
    const h = $("voz-hora"); if (h) est.hora = h.value;
  }

  // Antes de hacer cualquier orden quedan unos segundos para «Deshacer».
  let reloj = null;
  function conDeshacer(fn) {
    est.espera = 5; pintar();
    reloj = setInterval(() => {
      if (!est || !est.espera) { clearInterval(reloj); reloj = null; return; }
      est.espera--; if (est.espera > 0) { pintar(); return; }
      clearInterval(reloj); reloj = null; fn();
    }, 1000);
  }
  function deshacer() { if (reloj) { clearInterval(reloj); reloj = null; } if (est) { est.espera = 0; pintar(); hablar("Listo, no hice nada."); } }

  async function confirmar(accion) {
    guardarCampos();
    if (est && est.siNo) { est.siNo = null; detener(); callar(); }
    const c = elegido();
    if (accion !== "agendar" && !c) return;
    let cuerpo = { paso: "ejecutar", accion: accion === "enviar" ? est.r.accion : "agendar", cliente_id: c ? c.id : null };
    if (accion === "cancelar") cuerpo = { paso: "ejecutar", accion: "cancelar_" + est.r.que, id: c.id, cliente_id: est.r.que === "cobro" ? c.id : null };
    if (cuerpo.accion === "mensaje") { if (!est.mensaje.trim()) { const t = $("voz-txt"); if (t) t.focus(); return; } cuerpo.texto = est.mensaje.trim(); }
    if (cuerpo.accion === "agendar") {
      if (!est.fecha) { const f = $("voz-fecha"); if (f) f.focus(); return; }
      const exp = c && c.expedientes && c.expedientes[0];
      Object.assign(cuerpo, { titulo: est.titulo || "", fecha: est.fecha, hora: est.hora || "", descripcion: [exp ? "Expediente: Rad. " + exp.numero : "", est.r.dicho ? "Orden dictada: «" + est.r.dicho + "»" : ""].filter(Boolean).join("\n") });
    }
    conDeshacer(() => hacer(cuerpo));
  }
  async function hacer(cuerpo) {
    if (!est) return;
    est.enviando = true; pintar();
    try {
      const r = await llamar(cuerpo);
      est = { fase: "listo", texto: r.mensaje }; pintar(); hablar(r.mensaje);
      if (cuerpo.accion === "agendar" || cuerpo.accion === "mensaje" || /^cancelar_(agenda|mensaje)$/.test(cuerpo.accion)) { document.dispatchEvent(new CustomEvent("dc-voz-cambio")); try { window.DC_VOZ_CAMBIO && window.DC_VOZ_CAMBIO(); } catch (e) {} }
    } catch (e) { est.enviando = false; est.errorEnvio = e.message; pintar(); alertaError(e.message); }
  }
  function alertaError(m) {
    const caja = document.querySelector("#voz-hoja .voz-bts"); if (!caja) return;
    const d = document.createElement("div"); d.className = "voz-aviso rojo"; d.textContent = m; caja.parentNode.insertBefore(d, caja);
  }

  document.addEventListener("click", ev => {
    const b = ev.target.closest && ev.target.closest("[data-voz],[data-voz-cli]");
    if (!b) return;
    if (b.dataset.vozCli) { guardarCampos(); est.elegido = Number(b.dataset.vozCli); pintar(); if (est.r.accion === "mensaje" && !est.mensaje && elegido() && elegido().portal) dictarMensaje(); else preguntarSiNo(""); return; }
    const a = b.dataset.voz;
    if (a === "abrir" || a === "otra") abrir();
    else if (a === "cerrar" || (a === "fuera" && est && est.fase !== "tarjeta")) { if (reloj) { clearInterval(reloj); reloj = null; } cerrar(); }
    else if (a === "como") { detener(); est = { fase: "como" }; pintar(); }
    else if (a === "dictar") { guardarCampos(); dictarMensaje(); }
    else if (a === "enviar") confirmar("enviar");
    else if (a === "agendar") confirmar("agendar");
    else if (a === "cancelar") confirmar("cancelar");
    else if (a === "deshacer") deshacer();
    else if (a === "sino") preguntarSiNo("");
    else if (a === "agenda") { cerrar(); const n = document.querySelector('.nav [data-vista="agenda"]'); if (n) n.click(); }
  });

  // Botón dorado del micrófono en la cabecera (al lado de Configuración).
  function ponerBoton() {
    // Si el menú de abajo ya trae a Doc Dai en el centro, no se pone el micrófono de arriba.
    if (document.querySelector(".nav .dai")) return;
    const ref = $("btn-ajustes"); if (!ref || $("btn-voz")) return;
    const b = document.createElement("button");
    b.id = "btn-voz"; b.type = "button"; b.className = "cab-btn voz-mic"; b.title = "Órdenes de voz"; b.setAttribute("aria-label", "Órdenes de voz"); b.dataset.voz = "abrir";
    b.innerHTML = MIC; ref.parentNode.insertBefore(b, ref);
  }
  ponerBoton();
  // App completa (Compose): la cabecera llama window.DC_VOZ.abrir({ url, clave, token, version, oscuro }).
  window.DC_VOZ = { abrir: o => { opciones = o || null; abrir(); }, cerrar: () => { if (reloj) { clearInterval(reloj); reloj = null; } cerrar(); } };
})();
