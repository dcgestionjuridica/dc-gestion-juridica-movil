// «Entrar con huella» (modelo aprobado por Darío el 26/10/2026), para la app del abogado y el portal del cliente.
// El celular (huella o cara) o el PC (Windows Hello) guarda la llave; la huella nunca sale del equipo.
// La función «huella» de Supabase comprueba la firma y entrega una sesión normal.
(function () {
  const b64 = b => btoa(String.fromCharCode.apply(null, new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const deb = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const ICONO = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M7.5 4.6A8 8 0 0 1 20 11M4 9.5A8 8 0 0 1 5.3 7M4.2 15A8 8 0 0 1 4 12.5M8 19.5c1.2-2 1.8-4.3 1.8-7a2.2 2.2 0 0 1 4.4 0c0 1.2-.1 2.4-.3 3.5M12 12.5c0 3.3-.8 6.3-2.4 8.8M16.4 18.6c.6-1.8 1-3.9 1-6.1a5.4 5.4 0 0 0-8.6-4.3M12.6 21.4c.5-.9.9-1.9 1.2-2.9M19.8 15c.1-.8.2-1.6.2-2.5"/></svg>';

  const estilo = document.createElement("style");
  estilo.textContent = `
.huella-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;max-width:360px;padding:14px;border-radius:99px;border:0;background:var(--primario);color:var(--fondo);font-weight:700;font-size:16px;cursor:pointer}
html[data-tema="oscuro"] .huella-btn{color:#0b1626}
.huella-btn.oculto,.huella-o.oculto{display:none}
.huella-o{width:100%;max-width:360px}
html.huella-activa #form-entrada button[type=submit]{background:var(--tonal);color:var(--tonal-txt)}
.huella-o{display:flex;box-sizing:border-box;align-items:center;gap:10px;color:var(--texto2);font-size:13px;margin:14px 0}
.huella-o:before,.huella-o:after{content:"";flex:1;height:1px;background:var(--linea)}
.huella-velo{position:fixed;inset:0;background:rgba(10,18,32,.45);z-index:9000;display:flex;align-items:flex-end;justify-content:center}
.huella-hoja{background:var(--sup2,#fff);background:#fff;color:#191c20;width:100%;max-width:520px;border-radius:22px 22px 0 0;padding:22px 20px 26px;text-align:center;box-sizing:border-box}
.huella-circ{width:64px;height:64px;border-radius:50%;background:#d6e3ff;color:#0f2540;display:flex;align-items:center;justify-content:center;margin:0 auto 12px}
.huella-circ svg{width:38px;height:38px}
.huella-hoja h3{margin:0 0 6px;font-size:18px;color:#0f2540}
.huella-hoja p{font-size:13.5px;color:#5b6472;margin:0 0 16px;line-height:1.45}
.huella-hoja button{display:block;width:100%;height:44px;border-radius:22px;border:0;font-weight:600;font-size:15px;margin-top:10px;cursor:pointer}
.huella-si{background:#0f2540;color:#fff}.huella-no{background:#d6e3ff;color:#0f2540}
.huella-err{color:#93000a;font-size:12.5px;margin:0 0 6px}`;
  document.head.appendChild(estilo);

  let sb = null, app = "", alEntrar = null, textoOriginal = "";
  const clave = () => "dc-huella-" + app;
  const leer = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const guardar = (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} };
  const disponible = () => window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false) : Promise.resolve(false);

  async function llamar(cuerpo, token) {
    const cfg = window.DC_CONFIG || {};
    const h = { "Content-Type": "application/json", apikey: cfg.clavePublica || "" };
    if (token) h.Authorization = "Bearer " + token;
    const r = await fetch((cfg.url || "") + "/functions/v1/huella", { method: "POST", headers: h, body: JSON.stringify(cuerpo) });
    const j = await r.json().catch(() => ({ error: "Sin respuesta del servidor." }));
    j.estado = r.status;
    return j;
  }

  function error(texto) { const e = document.getElementById("error-entrada"); if (e) e.textContent = texto; }

  async function entrar(boton) {
    error("");
    boton.disabled = true;
    try {
      const op = await llamar({ accion: "entrada_opciones" });
      if (op.error) { error(op.error); return; }
      let cred;
      try {
        cred = await navigator.credentials.get({ publicKey: { challenge: deb(op.challenge), rpId: op.rpId, timeout: op.timeout, userVerification: "required", allowCredentials: [] } });
      } catch (e) {
        if (!(e && (e.name === "NotAllowedError" || e.name === "AbortError"))) error("No se pudo usar la huella en este equipo. Entre con su contraseña.");
        return;
      }
      const r = cred.response;
      const v = await llamar({ accion: "entrada_verificar", respuesta: { id: cred.id, rawId: b64(cred.rawId), type: cred.type, clientExtensionResults: {}, response: {
        clientDataJSON: b64(r.clientDataJSON), authenticatorData: b64(r.authenticatorData), signature: b64(r.signature), userHandle: r.userHandle ? b64(r.userHandle) : undefined } } });
      if (v.error) {
        if (v.estado === 404) { guardar(clave(), ""); pintar(); }
        error(v.error);
        return;
      }
      const { error: e2 } = await sb.auth.setSession({ access_token: v.access_token, refresh_token: v.refresh_token });
      if (e2) { error("No se pudo abrir la sesión. Entre con su contraseña."); return; }
      await alEntrar();
    } finally { boton.disabled = false; }
  }

  async function activar(hoja, aviso) {
    const { data } = await sb.auth.getSession();
    const token = data.session && data.session.access_token;
    if (!token) return;
    const op = await llamar({ accion: "registro_opciones" }, token);
    if (op.error) { aviso.textContent = op.error; return; }
    let cred;
    try {
      cred = await navigator.credentials.create({ publicKey: {
        challenge: deb(op.challenge), rp: op.rp, user: { id: deb(op.user.id), name: op.user.name, displayName: op.user.displayName || op.user.name },
        pubKeyCredParams: op.pubKeyCredParams, timeout: op.timeout, attestation: "none", authenticatorSelection: op.authenticatorSelection,
        excludeCredentials: (op.excludeCredentials || []).map(c => ({ id: deb(c.id), type: "public-key", transports: c.transports })) } });
    } catch (e) {
      if (e && e.name === "InvalidStateError") { guardar(clave(), "1"); hoja.remove(); return; }
      if (!(e && (e.name === "NotAllowedError" || e.name === "AbortError"))) aviso.textContent = "Este equipo no permitió activar la huella.";
      return;
    }
    const r = cred.response;
    const ua = navigator.userAgent;
    const equipo = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Celular Android" : /Windows/.test(ua) ? "PC con Windows" : /Mac/.test(ua) ? "Mac" : "Otro equipo";
    const v = await llamar({ accion: "registro_verificar", equipo, respuesta: { id: cred.id, rawId: b64(cred.rawId), type: cred.type, clientExtensionResults: {}, response: {
      clientDataJSON: b64(r.clientDataJSON), attestationObject: b64(r.attestationObject), transports: r.getTransports ? r.getTransports() : [] } } }, token);
    if (v.error) { aviso.textContent = v.error; return; }
    guardar(clave(), cred.id);
    hoja.remove();
  }

  /** Después de entrar con contraseña: «¿Quiere entrar con su huella?» (una vez por equipo). */
  async function ofrecer(forzar) {
    if (!sb || (!forzar && (leer(clave()) || leer(clave() + "-no")))) return;
    if (!await disponible()) return;
    const cliente = app === "cliente";
    const velo = document.createElement("div");
    velo.className = "huella-velo";
    velo.innerHTML = `<div class="huella-hoja"><div class="huella-circ">${ICONO}</div><h3>¿Quiere entrar con su huella?</h3>
<p>${cliente ? "Así consulta sus procesos más rápido y sin recordar la contraseña. Su huella se queda en su celular."
      : "La próxima vez no tendrá que escribir la contraseña en este celular. Su huella no sale del teléfono: ni la aplicación ni nosotros la vemos."}</p>
<p class="huella-err"></p><button type="button" class="huella-si">Sí, usar mi huella</button><button type="button" class="huella-no">Ahora no</button></div>`;
    document.body.appendChild(velo);
    const aviso = velo.querySelector(".huella-err");
    const si = velo.querySelector(".huella-si");
    si.addEventListener("click", async () => {
      si.disabled = true; aviso.textContent = "";
      try { await activar(velo, aviso); } catch (e) { aviso.textContent = "No se pudo activar la huella."; }
      si.disabled = false;
      pintar();
    });
    velo.querySelector(".huella-no").addEventListener("click", () => { guardar(clave() + "-no", "1"); velo.remove(); });
  }

  let boton = null, separador = null;
  async function pintar() {
    const activa = !!leer(clave()) && await disponible();
    if (boton) { boton.classList.toggle("oculto", !activa); separador.classList.toggle("oculto", !activa); }
    const entrarBtn = document.getElementById("btn-entrar");
    if (entrarBtn && (entrarBtn.textContent === "Entrar" || entrarBtn.textContent === "Entrar con contraseña"))
      entrarBtn.textContent = activa ? "Entrar con contraseña" : "Entrar";
    api.activa = activa;
    document.documentElement.classList.toggle("huella-activa", activa);
  }

  /** Pone el botón «Entrar con huella» arriba del formulario de entrada. */
  function montar(cliente, nombreApp, despuesDeEntrar) {
    sb = cliente; app = nombreApp; alEntrar = despuesDeEntrar;
    const form = document.getElementById("form-entrada");
    if (!form) return;
    boton = document.createElement("button");
    boton.type = "button";
    boton.className = "huella-btn oculto";
    boton.innerHTML = ICONO + "<span>Entrar con huella</span>";
    boton.addEventListener("click", () => entrar(boton));
    separador = document.createElement("div");
    separador.className = "huella-o oculto";
    separador.textContent = "o";
    form.parentNode.insertBefore(boton, form);
    form.parentNode.insertBefore(separador, form);
    pintar();
  }

  /** Quita la huella de este equipo (en el servidor y aquí). */
  async function quitar() {
    const id = leer(clave());
    guardar(clave(), "");
    const { data } = await sb.auth.getSession();
    if (data.session && id.length > 1) await llamar({ accion: "quitar", credencial_id: id }, data.session.access_token).catch(() => {});
    pintar();
  }

  const api = { montar, ofrecer, quitar, activa: false, activaAqui: () => !!leer(clave()), disponible };
  window.DCHuella = api;
})();
