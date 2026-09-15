// === DEBUT_SERVICE_WORKER ===
// NAISSANCE - Mise en cache pour l'installation et l'usage hors ligne.
//
// === SANS_ENTRETIEN ===
// Ce fichier ne contient AUCUNE liste de fichiers : il met en cache ce qui
// passe, au fur et a mesure. Ajouter ou retirer un module de l'organisme
// ne l'oblige donc plus jamais a changer.
//
// Strategie : le reseau d'abord, le cache en secours. Une version deposee
// sur GitHub est donc prise en compte des le rechargement suivant, sans
// avoir a vider quoi que ce soit.

const CACHE = 'naissance';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(['./', './index.html']))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
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
        if (r && r.ok) {
          const copie = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copie)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html')))
  );
});
// === FIN_SERVICE_WORKER ===
