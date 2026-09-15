// === DEBUT_SERVICE_WORKER ===
// Réseau d'abord, cache en secours : une nouvelle version s'affiche dès
// qu'elle est en ligne, et l'appli s'ouvre quand même hors connexion.
const VERSION = "0.2.0"; // VERSION_AUTO
const CACHE = `naissance-ia-${VERSION}`;
const COQUILLE = [
  './',
  './index.html',
  './main.js',
  './version.js',
  './styles.css',
  './manifest.webmanifest',
  './icones/icone.svg',
  './icones/icone-192.png',
  './icones/icone-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(
        cles.filter((c) => c.startsWith('naissance-ia-') && c !== CACHE).map((c) => caches.delete(c)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copie = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html'))),
  );
});
// === FIN_SERVICE_WORKER ===
