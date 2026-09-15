// === DEBUT_DEMARRAGE ===
// Point d'entrée : branche la conversation, les Réglages et le fournisseur choisi.
import { VERSION } from './version.js';
import { obtenirFournisseur } from './fournisseurs/registre.js';
import { lireReglages, reglagesDe } from './reglages/stockage.js';
import { monterConversation } from './conversation/ecran.js';
import { monterReglages } from './reglages/ecran.js';

document.querySelectorAll('[data-version]').forEach((el) => {
  el.textContent = `Version ${VERSION}`;
});

function reglagesDuFournisseur() {
  const r = lireReglages();
  return { fournisseur: obtenirFournisseur(r.fournisseur), perso: reglagesDe(r, r.fournisseur) };
}

// 'sans-cle' | 'a-tester' | 'pret'
function etatConfiguration() {
  const { perso } = reglagesDuFournisseur();
  if (!perso.cle) return 'sans-cle';
  if (!perso.modele || !perso.methode) return 'a-tester';
  return 'pret';
}

function envoyer(historique) {
  const { fournisseur, perso } = reglagesDuFournisseur();
  return fournisseur.envoyer({
    historique, cle: perso.cle, methode: perso.methode, modele: perso.modele,
  });
}

// --- Panneau des Réglages (le bouton retour d'Android le referme) ---
const panneau = document.getElementById('reglages');

function ouvrirReglages() {
  if (!panneau.hidden) return;
  reglages.rafraichir();
  panneau.hidden = false;
  history.pushState({ reglages: true }, '');
}

function fermerReglages() {
  if (panneau.hidden) return;
  if (history.state && history.state.reglages) history.back();
  else { panneau.hidden = true; conversation.rafraichir(); }
}

window.addEventListener('popstate', () => {
  if (!panneau.hidden) {
    panneau.hidden = true;
    conversation.rafraichir();
  }
});

const reglages = monterReglages({ panneau, surChangement: () => {} });
const conversation = monterConversation({
  liste: document.querySelector('[data-messages]'),
  formulaire: document.querySelector('[data-formulaire]'),
  envoyer,
  etatConfiguration,
  ouvrirReglages,
});

document.querySelectorAll('[data-ouvrir-reglages]').forEach((b) => b.addEventListener('click', ouvrirReglages));
document.querySelectorAll('[data-fermer-reglages]').forEach((b) => b.addEventListener('click', fermerReglages));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => {
    console.warn('Service worker non enregistré :', e);
  });
}

// Signal lu par le robot : l'application a bien démarré.
document.documentElement.dataset.demarrage = 'ok';
// === FIN_DEMARRAGE ===
