// Guarda la página (no los datos) para que abra rápido y se pueda instalar en el celular.
// Siempre intenta primero internet; los datos de Supabase nunca se guardan aquí.
const CACHE = "dc-movil-v4";
const ARCHIVOS = ["./", "index.html", "estilos.css", "tema.js", "config.js", "logica.js", "app.js", "manifest.webmanifest",
  "icono-192.png", "icono-512.png", "apple-touch-icon.png", "favicon-32.png",
  "cliente/", "cliente/index.html", "cliente/cliente.js", "cliente/manifest.webmanifest"];
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
