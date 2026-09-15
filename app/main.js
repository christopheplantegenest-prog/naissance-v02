// === DEBUT_DEMARRAGE ===
// Point d'entrée de l'application. Les futurs modules (conversation,
// mémoire, personnalité, outils) seront branchés ici, un par un.
import { VERSION } from './version.js';

document.querySelector('[data-version]').textContent = `Version ${VERSION}`;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => {
    console.warn('Service worker non enregistré :', e);
  });
}

// Signal lu par le robot : l'application a bien démarré.
document.documentElement.dataset.demarrage = 'ok';
// === FIN_DEMARRAGE ===
