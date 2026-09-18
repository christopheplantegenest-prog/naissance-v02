// === DEBUT_DEMARRAGE ===
// Point d'entrée : ouvre la mémoire, crée l'esprit, branche les écrans.
// Le moteur (fournisseur + clé) vient des Réglages et reste interchangeable.
import { VERSION } from './version.js';
import { obtenirFournisseur } from './fournisseurs/registre.js';
import { lireReglages, reglagesDe, modifierFournisseur } from './reglages/stockage.js';
import { executerAvecRepli, noteDeRepli, nomCourt } from './fournisseurs/fiabilite.js';
import { fetchCompte, lireCompteur } from './fournisseurs/compteur.js';
import { estNatif } from './natif.js';
import { creerPont } from './moteur-local/pont.js';
import { creerMoteurLocal } from './moteur-local/moteur.js';
import { lireReglagesLocaux, ecrireReglagesLocaux } from './moteur-local/reglages-local.js';
import { monterEcranMoteurLocal } from './moteur-local/ecran.js';
import { envoyerAiguille } from './esprit/aiguillage.js';
import { ouvrirMagasin } from './memoire/magasin.js';
import { creerMemoire } from './memoire/memoire.js';
import { creerEsprit } from './esprit/esprit.js';
import { monterConversation } from './conversation/ecran.js';
import { monterReglages } from './reglages/ecran.js';
import { monterEcranMemoire } from './memoire/ecran.js';
import { creerVoix } from './voix/voix.js';
import { lirePreferencesVoix } from './voix/preferences.js';
import { monterReglagesVoix } from './voix/ecran-voix.js';

const RAPPEL_EXPORT_MS = 7 * 24 * 60 * 60 * 1000;

document.querySelectorAll('[data-version]').forEach((el) => {
  el.textContent = `Version ${VERSION}`;
});
const activite = document.querySelector('[data-activite]');

// --- moteur actuel, d'après les Réglages ---
// Chaque demande passe par la couche de fiabilité : relance, puis repli vers un
// autre modèle qui répond vraiment. Si le modèle choisi n'existe plus, le modèle
// de repli devient le nouveau choix (modifiable dans Réglages).
function moteurExterne() {
  const r = lireReglages();
  const f = obtenirFournisseur(r.fournisseur);
  const p = reglagesDe(r, f.id);
  if (!p.cle || !p.modele || !p.methode) return null;
  const acces = { cle: p.cle, methode: p.methode };
  const libelleDe = (modele) => `${f.nom} — ${nomCourt(modele)}`;
  const executer = (tache, { surEtape, signal } = {}) => executerAvecRepli({
    fournisseur: f, prefere: p.modele, modeles: p.modeles, tache, surEtape, signal,
  });
  // Chaque appel qui consomme du quota est compté localement.
  const fetchConversation = fetchCompte({ type: 'conversation', fournisseur: f });
  const fetchRangement = fetchCompte({ type: 'rangement', fournisseur: f });
  const apresRepli = (repli) => {
    if (repli && repli.definitif) modifierFournisseur(f.id, { modele: repli.vers });
  };
  return {
    libelle: libelleDe(p.modele),
    async envoyer({ preparer, actions, executer: executerAction, surEtape, signal }) {
      const { resultat, modele, repli } = await executer(
        async (m, s) => f.converser({
          ...acces, modele: m, ...(await preparer(libelleDe(m))), actions, executer: executerAction,
          fetchFn: fetchConversation, signal: s,
        }),
        { surEtape, signal },
      );
      apresRepli(repli);
      return { texte: resultat, libelle: libelleDe(modele), note: noteDeRepli(repli) };
    },
    async generer(args) {
      const { resultat, repli } = await executer((m) => f.generer({ ...args, ...acces, modele: m, fetchFn: fetchRangement }));
      apresRepli(repli);
      return resultat;
    },
  };
}

// --- moteur local (lecture seule) et aiguillage ---
const moteurLocal = creerMoteurLocal({ pont: creerPont(), natif: estNatif() });

function moteurActuel() {
  const mode = lireReglagesLocaux().mode;
  const externe = moteurExterne();
  const local = mode !== 'externe-seul' && moteurLocal.utilisable() ? moteurLocal : null;
  const externeAutorise = mode === 'local-seul' ? null : externe;
  if (!externeAutorise && !local) return null;
  return {
    libelle: (externeAutorise || local).libelle,
    envoyer: (args) => envoyerAiguille({ mode, local, externe, ...args }),
    // Le rangement reste confié à un moteur externe ; jamais en mode « Local seulement ».
    generer: externeAutorise ? externeAutorise.generer : null,
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
  // Actions de niveau « accord » : la personne décide AVANT l'exécution.
  confirmerAction: async ({ resume }) => window.confirm(`Naissance demande l'autorisation de faire ceci :\n\n${resume}\n\nAutoriser ?`),
  // Économie : pas de rangement automatique quand le quota du jour est déjà bien entamé.
  appelsAujourdhui: () => lireCompteur().total,
  varianteLocale: () => lireReglagesLocaux().variante,
});

// --- voix : Android dans l'APK, navigateur dans la PWA ---
const voix = creerVoix();

async function etat() {
  if (!(await memoire.estNee())) return 'a-naitre';
  const externe = etatReglages();
  if (externe === 'pret') return 'pret';
  if (lireReglagesLocaux().mode !== 'externe-seul' && moteurLocal.utilisable()) return 'pret';
  return externe;
}

// --- panneaux (le bouton retour d'Android les referme) ---
const panneaux = {
  reglages: document.getElementById('reglages'),
  memoire: document.getElementById('memoire'),
};
let panneauOuvert = null;

async function ouvrirPanneau(nom) {
  if (panneauOuvert) return;
  if (nom === 'reglages') { reglages.rafraichir(); reglagesVoix.rafraichir(); ecranLocal.rafraichir(); }
  conversation.arreterVoix();
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
const reglagesVoix = monterReglagesVoix({ zone: document.querySelector('[data-zone-voix]'), voix });
const ecranLocal = monterEcranMoteurLocal({
  zone: document.querySelector('[data-zone-local]'),
  moteur: moteurLocal,
  // Banc d'essai : une question envoyée au moteur local, sans rien écrire dans la mémoire.
  essai: async (question) => {
    const contexte = await esprit.contexteLocalPourEssai(question, moteurLocal.libelle);
    const r = await moteurLocal.envoyer({ preparer: async () => contexte, journaliser: false });
    return { texte: r.texte, mesures: r.mesures, contexte };
  },
  surChangement: () => conversation.rafraichir(),
});
const conversation = monterConversation({
  liste: document.querySelector('[data-messages]'),
  formulaire: document.querySelector('[data-formulaire]'),
  repondre: async (texte, options) => {
    const reponse = await esprit.repondre(texte, options);
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
  peutDemanderPlusFort: () => !!moteurExterne(),
  voix,
  lectureAuto: () => lirePreferencesVoix().lectureAuto,
});
const ecranMemoire = monterEcranMemoire({
  panneau: panneaux.memoire,
  memoire,
  esprit,
  versionAppli: VERSION,
  moteurLibelle: () => (moteurActuel() || {}).libelle,
  surChangement: async () => {
    await esprit.identiteAJour();
    await conversation.recharger();
  },
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
  else conversation.arreterVoix();
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

// État du moteur local ; s'il a provoqué un arrêt brutal, il est suspendu par sécurité.
const etatLocal = await moteurLocal.rafraichir();
let alerteLocal = '';
if (etatLocal.arretBrutal) {
  ecrireReglagesLocaux({ suspendu: true, raisonSuspension: `arrêt brutal pendant : ${etatLocal.arretBrutal}` });
  await moteurLocal.acquitterArret().catch(() => {});
  alerteLocal = `⚠️ L'appli s'est arrêtée brutalement pendant une opération du moteur local (${etatLocal.arretBrutal}), probablement faute de mémoire. Le moteur local est suspendu par sécurité ; Naissance continue avec le moteur externe.`;
}

await esprit.identiteAJour();
await conversation.recharger();
if (alerteLocal) {
  conversation.info(alerteLocal, { libelle: 'Ouvrir les Réglages', action: () => ouvrirPanneau('reglages') });
}
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
