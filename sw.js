// Guarda la página (no los datos) para que abra rápido y se pueda instalar en el celular.
// Siempre intenta primero internet; los datos de Supabase nunca se guardan aquí.
const CACHE = "dc-movil-v25";
const ARCHIVOS = ["./", "index.html", "estilos.css", "tema.js", "config.js", "logica.js", "clave.js", "app.js", "intro.js", "manifest.webmanifest",
  "icono-192.png", "icono-512.png", "apple-touch-icon.png", "favicon-32.png",
  "cliente/", "cliente/index.html", "cliente/cliente.js", "cliente/manifest.webmanifest", "avisos-push.js", "huella.js", "ajustes.js"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copia = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copia));
    return r;
  }).catch(() => caches.match(e.request)));
});
// V1.3.391: avisos al celular. Muestra el aviso y, al tocarlo, abre la página.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { texto: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "DC Gestión Jurídica", {
    body: d.texto || "", tag: d.etiqueta || undefined, data: { url: d.url || self.registration.scope },
    icon: new URL("icono-192.png", self.registration.scope).href, badge: new URL("icono-192.png", self.registration.scope).href
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
    for (const v of ventanas) if (v.url.split("#")[0] === url.split("#")[0] && "focus" in v) { v.navigate && v.navigate(url); return v.focus(); }
    return self.clients.openWindow(url);
  }));
});
