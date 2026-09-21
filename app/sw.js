// === DEBUT_SERVICE_WORKER ===
// Réseau d'abord, cache en secours : une nouvelle version s'affiche dès
// qu'elle est en ligne, et l'appli s'ouvre quand même hors connexion.
// Les appels vers le fournisseur d'IA (autre domaine) ne passent jamais par ici.
const VERSION = "0.15.1"; // VERSION_AUTO
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
  './natif.js',
  './fournisseurs/erreurs.js',
  './fournisseurs/gemini.js',
  './fournisseurs/registre.js',
  './fournisseurs/sante.js',
  './fournisseurs/fiabilite.js',
  './fournisseurs/compteur.js',
  './reglages/cle.js',
  './reglages/stockage.js',
  './reglages/ecran.js',
  './conversation/texte.js',
  './conversation/ecran.js',
  './conversation/brouillon.js',
  './voix/outils-voix.js',
  './voix/voix.js',
  './voix/preferences.js',
  './voix/ecran-voix.js',
  './actions/schema.js',
  './actions/retenir.js',
  './actions/catalogue.js',
  './actions/executeur.js',
  './moteur-local/profil.js',
  './moteur-local/reglages-local.js',
  './moteur-local/pont.js',
  './moteur-local/moteur.js',
  './moteur-local/ecran.js',
  './moteur-local/grand-banc-plan.js',
  './moteur-local/grand-banc-classement.js',
  './moteur-local/grand-banc.js',
  './moteur-local/grand-banc-stockage.js',
  './moteur-local/grand-banc-ecran.js',
  './moteur-local/solutions-memoire.js',
  './moteur-local/solutions-approches.js',
  './moteur-local/solutions-banc.js',
  './moteur-local/solutions-ecran.js',
  './langage/bagage.js',
  './langage/comprendre.js',
  './langage/connaissances.js',
  './langage/esprit.js',
  './langage/ecran.js',
  './langage/regles.js',
  './langage/lecon.js',
  './langage/gemini-professeur.js',
  './moteur-local/diagnostic.js',
  './moteur-local/banc.js',
  './moteur-local/protocoles.js',
  './moteur-local/classement.js',
  './esprit/aiguillage.js',
  './esprit/contexte-local.js',
  './esprit/identite.js',
  './esprit/contexte.js',
  './esprit/consolidation.js',
  './esprit/esprit.js',
  './memoire/magasin.js',
  './memoire/memoire.js',
  './memoire/selection.js',
  './memoire/transfert.js',
  './memoire/ecran.js',
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
