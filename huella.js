// «Entrar con huella» estilo banco (modelos aprobados por Darío el 28/10/2026), para la app del abogado y el
// portal del cliente, SOLO en el celular. En el computador no aparece: allí siempre se entra con contraseña.
// El celular (huella o cara) guarda la llave; la huella nunca sale del teléfono.
// La función «huella» de Supabase comprueba la firma y entrega una sesión normal.
(function () {
  const b64 = b => btoa(String.fromCharCode.apply(null, new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const deb = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const ICONO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M7.5 4.6A8 8 0 0 1 20 11M4 9.5A8 8 0 0 1 5.3 7M4.2 15A8 8 0 0 1 4 12.5M8 19.5c1.2-2 1.8-4.3 1.8-7a2.2 2.2 0 0 1 4.4 0c0 1.2-.1 2.4-.3 3.5M12 12.5c0 3.3-.8 6.3-2.4 8.8M16.4 18.6c.6-1.8 1-3.9 1-6.1a5.4 5.4 0 0 0-8.6-4.3M12.6 21.4c.5-.9.9-1.9 1.2-2.9M19.8 15c.1-.8.2-1.6.2-2.5"/></svg>';
  const CHULO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let sb = null, app = "", alEntrar = null, quien = { nombre: "", correo: "" }, pantalla = null, forzarFormulario = false;
  const clave = () => "dc-huella-" + app;
  const leer = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const guardar = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };
  const esc = t => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const raiz = () => (app === "cliente" ? "../" : "");

  // Solo celulares (Android, iPhone, iPad) que tengan huella o reconocimiento de la cara.
  const esCelular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  let disponibleCache = null;
  function disponible() {
    if (disponibleCache) return disponibleCache;
    disponibleCache = esCelular && window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false) : Promise.resolve(false);
    return disponibleCache;
  }
  const activaAqui = () => !!leer(clave());
  function guardado() { try { return JSON.parse(leer(clave() + "-quien") || "{}"); } catch (e) { return {}; } }
  function primerNombre() { return String(quien.nombre || guardado().nombre || "").split(" ")[0]; }
  function tapar(correo) {
    const m = String(correo || "").match(/^(.{1,2})[^@]*(@.+)$/);
    return m ? m[1] + "•••" + m[2] : "";
  }

  async function llamar(cuerpo, token) {
    const cfg = window.DC_CONFIG || {};
    const h = { "Content-Type": "application/json", apikey: cfg.clavePublica || "" };
    if (token) h.Authorization = "Bearer " + token;
    const r = await fetch((cfg.url || "") + "/functions/v1/huella", { method: "POST", headers: h, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({ error: "Sin respuesta del servidor." }));
    j.estado = r.status;
    return j;
  }

  // ---------- Pantalla de entrada estilo banco ----------
  function crearPantalla() {
    pantalla = document.createElement("section");
    pantalla.id = "huella-pant";
    pantalla.className = "entrada hb-pant oculto";
    pantalla.innerHTML = '<img src="' + raiz() + 'icono-192.png" alt="" class="hb-logo">' +
      (app === "cliente" ? '<div class="hb-portal">Portal de clientes</div>' : "") +
      '<div class="hb-hola"></div><div class="hb-nom"></div><div class="hb-correo"></div>' +
      '<button type="button" class="hb-circ" aria-label="Entrar con su huella">' + ICONO + "</button>" +
      '<div class="hb-toque">Toque para entrar con su huella</div><div class="hb-toque2">También sirve el reconocimiento de la cara</div>' +
      '<div class="hb-err" role="alert"></div><div class="hb-esp"></div>' +
      '<button type="button" class="hb-btn2">Entrar con contraseña</button>' +
      '<button type="button" class="hb-cambio">¿No es usted? <b>Entrar con otra cuenta</b></button>';
    const entrada = document.getElementById("entrada");
    entrada.parentNode.insertBefore(pantalla, entrada);
    pantalla.querySelector(".hb-circ").addEventListener("click", ev => entrar(ev.currentTarget));
    pantalla.querySelector(".hb-btn2").addEventListener("click", () => {
      forzarFormulario = true;
      const c = document.getElementById("correo");
      if (c && !c.value) c.value = guardado().correo || "";
      pintar();
    });
    pantalla.querySelector(".hb-cambio").addEventListener("click", () => {
      // Otra persona va a entrar en este celular: se olvida la huella de esta cuenta aquí.
      guardar(clave(), ""); guardar(clave() + "-quien", "");
      forzarFormulario = true;
      const c = document.getElementById("correo");
      if (c) c.value = "";
      pintar();
    });
  }

  async function pintar() {
    if (!pantalla) return;
    const entrada = document.getElementById("entrada");
    const otra = ["app", "nueva-clave", "vincular"].some(id => { const e = document.getElementById(id); return e && !e.classList.contains("oculto"); });
    const enEntrada = !otra && (!entrada.classList.contains("oculto") || !pantalla.classList.contains("oculto"));
    const usar = enEntrada && !forzarFormulario && activaAqui() && await disponible();
    if (usar) {
      const g = guardado();
      const L = window.DC_LOGICA;
      pantalla.querySelector(".hb-hola").textContent = (L ? L.saludo() : "Hola") + ",";
      pantalla.querySelector(".hb-nom").textContent = g.nombre || "";
      pantalla.querySelector(".hb-correo").textContent = tapar(g.correo);
      const msg = document.getElementById("error-entrada");
      pantalla.querySelector(".hb-err").textContent = msg ? msg.textContent : "";
    }
    entrada.classList.toggle("oculto", !enEntrada || usar);
    pantalla.classList.toggle("oculto", !usar);
    api.activa = activaAqui() && await disponible();
  }

  async function entrar(boton) {
    const err = pantalla.querySelector(".hb-err");
    err.textContent = "";
    boton.disabled = true;
    try {
      const op = await llamar({ accion: "entrada_opciones" });
      if (op.error) { err.textContent = op.error; return; }
      const guardada = leer(clave());
      let cred;
      try {
        cred = await navigator.credentials.get({ publicKey: { challenge: deb(op.challenge), rpId: op.rpId, timeout: op.timeout, userVerification: "required",
          allowCredentials: guardada.length > 1 ? [{ id: deb(guardada), type: "public-key", transports: ["internal", "hybrid"] }] : [] } });
      } catch (e) {
        if (!(e && (e.name === "NotAllowedError" || e.name === "AbortError"))) err.textContent = "No se pudo usar la huella. Entre con su contraseña.";
        return;
      }
      const r = cred.response;
      const v = await llamar({ accion: "entrada_verificar", respuesta: { id: cred.id, rawId: b64(cred.rawId), type: cred.type, clientExtensionResults: {}, response: {
        clientDataJSON: b64(r.clientDataJSON), authenticatorData: b64(r.authenticatorData), signature: b64(r.signature), userHandle: r.userHandle ? b64(r.userHandle) : undefined } } });
      if (v.error) {
        if (v.estado === 404) { guardar(clave(), ""); guardar(clave() + "-quien", ""); forzarFormulario = true; pintar(); }
        err.textContent = v.error;
        const e2 = document.getElementById("error-entrada");
        if (e2 && v.estado === 404) e2.textContent = v.error;
        return;
      }
      const { error: e2 } = await sb.auth.setSession({ access_token: v.access_token, refresh_token: v.refresh_token });
      if (e2) { err.textContent = "No se pudo abrir la sesión. Entre con su contraseña."; return; }
      await alEntrar();
    } finally { boton.disabled = false; }
  }

  // ---------- Activar ----------
  async function activar() {
    const { data } = await sb.auth.getSession();
    const token = data.session && data.session.access_token;
    if (!token) throw new Error("Primero entre con su contraseña.");
    const op = await llamar({ accion: "registro_opciones" }, token);
    if (op.error) throw new Error(op.error);
    let cred;
    try {
      cred = await navigator.credentials.create({ publicKey: {
        challenge: deb(op.challenge), rp: op.rp, user: { id: deb(op.user.id), name: op.user.name, displayName: op.user.displayName || op.user.name },
        pubKeyCredParams: op.pubKeyCredParams, timeout: op.timeout, attestation: "none", authenticatorSelection: op.authenticatorSelection,
        excludeCredentials: (op.excludeCredentials || []).map(c => ({ id: deb(c.id), type: "public-key", transports: c.transports })) } });
    } catch (e) {
      // Este celular ya tenía una huella activada para esta cuenta: se marca de nuevo como activa.
      if (e && e.name === "InvalidStateError") { recordarActiva("1", data.session.user.email); return true; }
      if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) return false;
      throw new Error("Este celular no permitió activar la huella.");
    }
    const r = cred.response;
    const ua = navigator.userAgent;
    const equipo = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Celular Android" : "Celular";
    const v = await llamar({ accion: "registro_verificar", equipo, respuesta: { id: cred.id, rawId: b64(cred.rawId), type: cred.type, clientExtensionResults: {}, response: {
      clientDataJSON: b64(r.clientDataJSON), attestationObject: b64(r.attestationObject), transports: r.getTransports ? r.getTransports() : [] } } }, token);
    if (v.error) throw new Error(v.error);
    recordarActiva(cred.id, data.session.user.email);
    return true;
  }
  function recordarActiva(id, correo) {
    guardar(clave(), id);
    guardar(clave() + "-no", "");
    guardar(clave() + "-quien", JSON.stringify({ nombre: quien.nombre || guardado().nombre || "", correo: quien.correo || correo || "" }));
    api.activa = true;
  }

  function velo(clase, html) {
    const v = document.createElement("div");
    v.className = "hb-velo";
    v.innerHTML = '<section class="entrada hb-pant ' + clase + '">' + html + "</section>";
    document.body.appendChild(v);
    return v;
  }
  function listo(alFinal) {
    const v = velo("hb-listo", '<div class="hb-ok">' + CHULO + "</div><h2>¡Listo" + (primerNombre() ? ", " + esc(primerNombre()) : "") + "!</h2>" +
      "<p>Su huella quedó activada en este celular. La próxima vez que abra " + (app === "cliente" ? "el portal" : "la aplicación") + ", solo tóquela para entrar.</p>" +
      '<div class="hb-esp"></div><button type="button" class="hb-prim">' + (app === "cliente" ? "Ver mi proceso" : "Ir al inicio") + "</button>" +
      '<div class="hb-nota">Puede apagarla cuando quiera en Configuración</div>');
    v.querySelector(".hb-prim").addEventListener("click", () => { v.remove(); if (alFinal) alFinal(); });
  }

  /** Después de entrar con contraseña o de crear la cuenta: «¿Quiere entrar con su huella?» (una vez por celular). */
  async function ofrecer(forzar) {
    if (!sb || (!forzar && (activaAqui() || leer(clave() + "-no")))) return;
    if (!await disponible()) return;
    const v = velo("hb-oferta", '<img src="' + raiz() + 'icono-192.png" alt="" class="hb-logo"><div class="hb-circ">' + ICONO + "</div>" +
      "<h2>¿Quiere entrar con su huella?</h2><p>La próxima vez entra con solo tocar la pantalla, sin escribir la contraseña. Su huella se queda en su celular; ni nosotros ni la aplicación la vemos.</p>" +
      '<div class="hb-err" role="alert"></div><div class="hb-esp"></div><button type="button" class="hb-prim">Sí, usar mi huella</button><button type="button" class="hb-link">Ahora no</button>');
    const si = v.querySelector(".hb-prim"), err = v.querySelector(".hb-err");
    si.addEventListener("click", async () => {
      si.disabled = true; err.textContent = "";
      try { if (await activar()) { v.remove(); listo(); } }
      catch (e) { err.textContent = (e && e.message) || "No se pudo activar la huella."; }
      si.disabled = false;
    });
    v.querySelector(".hb-link").addEventListener("click", () => { guardar(clave() + "-no", "1"); v.remove(); });
  }

  /** Desde Configuración: apagar la huella en este celular (en el servidor y aquí). */
  async function quitar() {
    const id = leer(clave());
    guardar(clave(), ""); guardar(clave() + "-quien", "");
    api.activa = false;
    const { data } = await sb.auth.getSession();
    if (data.session && id.length > 1) await llamar({ accion: "quitar", credencial_id: id }, data.session.access_token).catch(() => {});
  }

  /** Cada app dice quién entró, para saludarlo por su nombre en la pantalla de la huella. */
  function recordar(nombre, correo) {
    quien = { nombre: nombre || "", correo: correo || "" };
    forzarFormulario = false;
    if (activaAqui()) guardar(clave() + "-quien", JSON.stringify(quien));
  }

  /** Prepara la pantalla de la huella encima del formulario de entrada. */
  function montar(cliente, nombreApp, despuesDeEntrar) {
    sb = cliente; app = nombreApp; alEntrar = despuesDeEntrar;
    if (!document.getElementById("entrada")) return;
    crearPantalla();
    // Cada vez que la app muestra u oculta la entrada, se decide si va la pantalla de la huella.
    const vigia = new MutationObserver(() => pintar());
    ["entrada", "app", "nueva-clave", "vincular"].forEach(id => { const e = document.getElementById(id); if (e) vigia.observe(e, { attributes: true, attributeFilter: ["class"] }); });
    const msg = document.getElementById("error-entrada");
    if (msg) new MutationObserver(() => { pantalla.querySelector(".hb-err").textContent = msg.textContent; }).observe(msg, { childList: true, characterData: true, subtree: true });
    pintar();
  }

  const api = { montar, ofrecer, activar, listo, quitar, recordar, activa: false, activaAqui, disponible };
  window.DCHuella = api;
})();
