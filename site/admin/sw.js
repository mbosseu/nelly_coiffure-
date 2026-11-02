// Service worker de l'espace de gestion : rend l'application installable et permet de l'ouvrir sans réseau.
// Toujours la version en ligne en priorité ; l'API n'est jamais mise en cache.
const CACHE = 'gestion-nelly-v16';
const COQUILLE = ['/admin/', '/admin/admin.css', '/admin/admin.js', '/admin/manifest.webmanifest', '/img/marque/logo.webp'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !COQUILLE.includes(url.pathname)) return;
  e.respondWith(fetch(e.request).then((r) => {
    const copie = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copie));
    return r;
  }).catch(() => caches.match(e.request)));
});
