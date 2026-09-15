// === DEBUT_SERVICE_WORKER ===
// NAISSANCE V0.2 - Mise en cache pour l'installation et l'usage hors ligne.
// Ne touche ni au micro, ni a l'organisme. Change le nom du cache a chaque
// nouvelle version pour forcer le rechargement des fichiers.

const CACHE = 'naissance-v02-1';

const FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icone.svg',
  './organisme/config.js',
  './organisme/oreille.js',
  './organisme/flux.js',
  './organisme/activite.js',
  './organisme/organisme.js',
  './support/capture.js',
  './support/worklet-capture.js',
  './support/stockage.js',
  './support/laboratoire.js',
  './support/spectrogramme.js',
  './support/interface.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') { return; }
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copie = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copie)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
// === FIN_SERVICE_WORKER ===
