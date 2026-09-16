// === DEBUT_DEMARRAGE ===
// Point d'entrée : ouvre la mémoire, crée l'esprit, branche les écrans.
// Le moteur (fournisseur + clé) vient des Réglages et reste interchangeable.
import { VERSION } from './version.js';
import { obtenirFournisseur } from './fournisseurs/registre.js';
import { lireReglages, reglagesDe, modifierFournisseur } from './reglages/stockage.js';
import { executerAvecRepli, noteDeRepli, nomCourt } from './fournisseurs/fiabilite.js';
import { ouvrirMagasin } from './memoire/magasin.js';
import { creerMemoire } from './memoire/memoire.js';
import { creerEsprit } from './esprit/esprit.js';
import { monterConversation } from './conversation/ecran.js';
import { monterReglages } from './reglages/ecran.js';
import { monterEcranMemoire } from './memoire/ecran.js';

const RAPPEL_EXPORT_MS = 7 * 24 * 60 * 60 * 1000;

document.querySelectorAll('[data-version]').forEach((el) => {
  el.textContent = `Version ${VERSION}`;
});
const activite = document.querySelector('[data-activite]');

// --- moteur actuel, d'après les Réglages ---
// Chaque demande passe par la couche de fiabilité : relance, puis repli vers un
// autre modèle qui répond vraiment. Si le modèle choisi n'existe plus, le modèle
// de repli devient le nouveau choix (modifiable dans Réglages).
function moteurActuel() {
  const r = lireReglages();
  const f = obtenirFournisseur(r.fournisseur);
  const p = reglagesDe(r, f.id);
  if (!p.cle || !p.modele || !p.methode) return null;
  const acces = { cle: p.cle, methode: p.methode };
  const libelleDe = (modele) => `${f.nom} — ${nomCourt(modele)}`;
  const executer = (tache) => executerAvecRepli({
    fournisseur: f, prefere: p.modele, modeles: p.modeles, tache,
  });
  const apresRepli = (repli) => {
    if (repli && repli.definitif) modifierFournisseur(f.id, { modele: repli.vers });
  };
  return {
    libelle: libelleDe(p.modele),
    async envoyer({ preparer }) {
      const { resultat, modele, repli } = await executer(
        (m) => f.envoyer({ ...acces, modele: m, ...preparer(libelleDe(m)) }),
      );
      apresRepli(repli);
      return { texte: resultat, libelle: libelleDe(modele), note: noteDeRepli(repli) };
    },
    async generer(args) {
      const { resultat, repli } = await executer((m) => f.generer({ ...args, ...acces, modele: m }));
      apresRepli(repli);
      return resultat;
    },
  };
}

function etatReglages() {
  const r = lireReglages();
  const p = reglagesDe(r, obtenirFournisseur(r.fournisseur).id);
  if (!p.cle) return 'sans-cle';
  if (!p.modele || !p.methode) return 'a-tester';
  return 'pret';
}

// --- mémoire et esprit ---
const magasin = await ouvrirMagasin();
const memoire = creerMemoire(magasin);
const esprit = creerEsprit({
  memoire,
  moteurActuel,
  surActivite: (actif) => { activite.hidden = !actif; },
});

async function etat() {
  if (!(await memoire.estNee())) return 'a-naitre';
  return etatReglages();
}

// --- panneaux (le bouton retour d'Android les referme) ---
const panneaux = {
  reglages: document.getElementById('reglages'),
  memoire: document.getElementById('memoire'),
};
let panneauOuvert = null;

async function ouvrirPanneau(nom) {
  if (panneauOuvert) return;
  if (nom === 'reglages') reglages.rafraichir();
  if (nom === 'memoire') await ecranMemoire.ouvrir();
  panneaux[nom].hidden = false;
  panneauOuvert = nom;
  history.pushState({ panneau: nom }, '');
}

function fermerPanneau() {
  if (!panneauOuvert) return;
  if (history.state && history.state.panneau) history.back();
  else surRetour();
}

function surRetour() {
  if (!panneauOuvert) return;
  panneaux[panneauOuvert].hidden = true;
  const etaitReglages = panneauOuvert === 'reglages';
  panneauOuvert = null;
  conversation.rafraichir();
  if (etaitReglages) lancerRangement();
}
window.addEventListener('popstate', surRetour);

const reglages = monterReglages({ panneau: panneaux.reglages, surChangement: () => {} });
const conversation = monterConversation({
  liste: document.querySelector('[data-messages]'),
  formulaire: document.querySelector('[data-formulaire]'),
  repondre: async (texte) => {
    const reponse = await esprit.repondre(texte);
    setTimeout(() => esprit.consoliderSiBesoin(), 1500);
    return reponse;
  },
  chargerRecents: () => memoire.derniersMessages(60),
  etat,
  naitre: async (prenom) => {
    await esprit.naitre(prenom);
    demanderStockagePersistant();
  },
  ouvrirReglages: () => ouvrirPanneau('reglages'),
});
const ecranMemoire = monterEcranMemoire({
  panneau: panneaux.memoire,
  memoire,
  esprit,
  versionAppli: VERSION,
  moteurLibelle: () => (moteurActuel() || {}).libelle,
  surChangement: () => conversation.recharger(),
});

document.querySelectorAll('[data-ouvrir-reglages]').forEach((b) => b.addEventListener('click', () => ouvrirPanneau('reglages')));
document.querySelectorAll('[data-ouvrir-memoire]').forEach((b) => b.addEventListener('click', () => ouvrirPanneau('memoire')));
document.querySelectorAll('[data-fermer-panneau]').forEach((b) => b.addEventListener('click', fermerPanneau));

// --- rangement de la mémoire au retour dans l'appli ---
async function lancerRangement() {
  const absence = await esprit.estRevenueApresAbsence();
  esprit.consoliderSiBesoin({ absence });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') lancerRangement();
});

function demanderStockagePersistant() {
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

async function rappels() {
  if (magasin.persistant === false) {
    conversation.info(`⚠️ La mémoire ne peut pas être enregistrée sur cet appareil (${magasin.erreur || 'stockage indisponible'}) : elle sera perdue à la fermeture.`);
    return;
  }
  if (!(await memoire.estNee())) return;
  const [meta, nb] = await Promise.all([memoire.meta(), memoire.compterMessages()]);
  const reference = Date.parse(meta.dernierExport || meta.neeLe || 0);
  if (nb > 0 && Date.now() - reference > RAPPEL_EXPORT_MS) {
    conversation.info('Pense à sauvegarder la mémoire de Naissance.', {
      libelle: 'Ouvrir la Mémoire', action: () => ouvrirPanneau('memoire'),
    });
  }
}

await conversation.recharger();
await rappels();
if (await memoire.estNee()) demanderStockagePersistant();
lancerRangement();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => {
    console.warn('Service worker non enregistré :', e);
  });
}

// Signal lu par le robot : l'application a bien démarré.
document.documentElement.dataset.demarrage = 'ok';
// === FIN_DEMARRAGE ===
