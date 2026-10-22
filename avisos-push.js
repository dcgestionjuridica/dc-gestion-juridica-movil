// V1.3.391: avisos al celular (Web Push). Lo usan el portal del cliente y la app web.
// En iPhone solo funciona con la página agregada a la pantalla de inicio (iOS 16.4 o más nuevo).
(function () {
  function b64aBytes(b) {
    const s = (b + "=".repeat((4 - (b.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    const r = atob(s), a = new Uint8Array(r.length);
    for (let i = 0; i < r.length; i++) a[i] = r.charCodeAt(i);
    return a;
  }
  function bytesAb64(buf) {
    let s = ""; new Uint8Array(buf).forEach(c => s += String.fromCharCode(c));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const instalada = window.matchMedia && matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const P = window.DC_PUSH = {
    resultado: "", error: "",
    soportado: "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    /** «activo», «inactivo», «denegado», «iphone» (falta agregarla a la pantalla de inicio) o «no».*/
    estado() {
      if (ios && !instalada) return "iphone";
      if (!P.soportado) return "no";
      if (Notification.permission === "denied") return "denegado";
      return localStorage.getItem("dc-push-activo") === "1" && Notification.permission === "granted" ? "activo" : "inactivo";
    },
    /** Pide permiso e inscribe este equipo. Deja en P.resultado el JSON {endpoint,p256dh,auth} o en P.error el motivo. */
    async activar(clave, sw, alcance) {
      P.resultado = ""; P.error = "";
      try {
        if (!P.soportado) throw new Error(ios ? "En iPhone, primero agregue esta página a la pantalla de inicio." : "Este navegador no admite avisos.");
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") throw new Error("No se dio permiso para los avisos.");
        const reg = await navigator.serviceWorker.register(sw, alcance ? { scope: alcance } : undefined);
        await navigator.serviceWorker.ready;
        let s = await reg.pushManager.getSubscription();
        if (!s) s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64aBytes(clave) });
        try { localStorage.setItem("dc-push-activo", "1"); } catch (e) {}
        P.resultado = JSON.stringify({ endpoint: s.endpoint, p256dh: bytesAb64(s.getKey("p256dh")), auth: bytesAb64(s.getKey("auth")), agente: navigator.userAgent });
      } catch (e) { P.error = String(e && e.message || e); }
    },
    async desactivar() {
      P.resultado = ""; P.error = "";
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const s = reg && await reg.pushManager.getSubscription();
        try { localStorage.removeItem("dc-push-activo"); } catch (e) {}
        P.resultado = s ? JSON.stringify({ endpoint: s.endpoint }) : "{}";
        if (s) await s.unsubscribe();
      } catch (e) { P.error = String(e && e.message || e); }
    }
  };
})();
