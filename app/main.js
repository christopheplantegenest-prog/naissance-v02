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
import { monterEcranGrandBanc } from './moteur-local/grand-banc-ecran.js';
import { monterEcranSolutions } from './moteur-local/solutions-ecran.js';
import { monterEcranLangage } from './langage/ecran.js';
import { ouvrirIndexedDB as ouvrirLangage, magasinMemoireVive as magasinLangageVive } from './langage/connaissances.js';
import { repondre as repondreLangage, COMPRIS } from './langage/esprit.js';
import { extraireLecon, apercuLecon, TYPES_LECON } from './langage/lecon.js';
import { ouvrirIndexedDB as ouvrirIndexedDBGrandBanc, magasinMemoireVive as magasinMemoireViveGrandBanc } from './moteur-local/grand-banc-stockage.js';
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
  const fetchEnseignement = fetchCompte({ type: 'enseignement', fournisseur: f });
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
    // v0.13 — Gemini comme professeur ponctuel du canal pédagogique (langage/). Même mécanisme
    // que generer() ci-dessus (même relance, même repli de modèle), seul le type d'appel compté
    // change, pour que ces appels soient identifiables séparément dans le quota.
    async enseigner(args) {
      const { resultat, repli } = await executer((m) => f.generer({ ...args, ...acces, modele: m, fetchFn: fetchEnseignement }));
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
  if (nom === 'reglages') { reglages.rafraichir(); reglagesVoix.rafraichir(); ecranLocal.rafraichir(); ecranGrandBanc.rafraichir(); ecranSolutions.rafraichir(); ecranLangage.rafraichir(); }
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
// Banc d'essai (rapide et grand banc) : une question envoyée au moteur local, sans rien écrire dans la mémoire.
const essaiMoteurLocal = async (epreuve) => {
  const contexte = await esprit.contexteLocalPourEssai(epreuve.question, moteurLocal.libelle, {
    souvenirsImposes: epreuve.souvenirsImposes || null,
    sansSouvenirs: !!epreuve.sansSouvenirs,
    sansIdentite: !!epreuve.sansIdentite,
    identiteCourte: !!epreuve.identiteCourte,
  });
  const r = await moteurLocal.envoyer({
    preparer: async () => contexte, journaliser: false, limite: epreuve.limite || null,
    seed: Number.isFinite(epreuve.graine) ? epreuve.graine : null,
  });
  return { texte: r.texte, mesures: r.mesures, contexte };
};
const ecranLocal = monterEcranMoteurLocal({
  zone: document.querySelector('[data-zone-local]'),
  moteur: moteurLocal,
  essai: essaiMoteurLocal,
  identite: () => esprit.identiteCourante(),
  surChangement: () => conversation.rafraichir(),
});
const ecranGrandBanc = monterEcranGrandBanc({
  zone: document.querySelector('[data-zone-grand-banc]'),
  essai: essaiMoteurLocal,
  identite: () => esprit.identiteCourante(),
  ouvrirStockage: async () => {
    try { return await ouvrirIndexedDBGrandBanc(); } catch { return magasinMemoireViveGrandBanc(); }
  },
  surChangement: () => {},
});
// Banc comparatif : contexte fourni de bout en bout par le banc lui-même (mémoire de test isolée),
// sans jamais passer par la mémoire réelle de Naissance.
const ecranSolutions = monterEcranSolutions({
  zone: document.querySelector('[data-zone-solutions]'),
  essaiBrut: async ({ prefixe, elements, limite, seed }) => {
    const contexte = { prefixe, elements, estimation: { total: 0 }, souvenirsTrace: [], tropLong: false };
    const r = await moteurLocal.envoyer({
      preparer: async () => contexte, journaliser: false, limite: limite || null, seed: seed ?? null,
    });
    return { texte: r.texte, mesures: r.mesures };
  },
  ouvrirStockage: async () => {
    try { return await ouvrirIndexedDBGrandBanc(); } catch { return magasinMemoireViveGrandBanc(); }
  },
});
// Langage propre à Naissance : base isolée, aucun lien avec la mémoire réelle ni avec LFM2.
// appelerGemini (v0.13) : réutilise entièrement moteurExterne() — mêmes réglages, même relance,
// même repli de modèle — seul le type d'appel compté ('enseignement') est nouveau. Résolu à chaque
// appel, pas mémorisé, pour refléter tout changement fait depuis dans les Réglages.
const ecranLangage = monterEcranLangage({
  zone: document.querySelector('[data-zone-langage]'),
  ouvrirStockage: async () => {
    try { return await ouvrirLangage(); } catch { return magasinLangageVive(); }
  },
  appelerGemini: async ({ instructions, entree, signal }) => {
    const externe = moteurExterne();
    if (!externe) throw new Error("Aucun modèle externe n'est configuré dans les Réglages : impossible de demander un enseignement à Gemini.");
    return externe.enseigner({ instructions, entree, signal });
  },
});
// Pont vers le canal pédagogique (v0.15.0) : un marqueur explicite, jamais une conversation
// ordinaire prise pour une leçon. Réutilise EXACTEMENT le canal du laboratoire — extraireLecon,
// l'aperçu, ecrireConnaissance — sur le MÊME esprit partagé (ecranLangage.assurerEsprit) : ce qui
// est appris ici est immédiatement visible dans le laboratoire, et réciproquement, sans jamais deux
// copies indépendantes de la même base en mémoire.
const MARQUEUR_APPRENTISSAGE = /^apprends\s*:\s*/i;

async function journaliserEchangeLaboratoire(question, reponse, dateQuestion) {
  await memoire.ajouterEchange({ question, reponse, moteur: 'laboratoire', dateQuestion, dateReponse: new Date().toISOString() });
}

const conversation = monterConversation({
  liste: document.querySelector('[data-messages]'),
  formulaire: document.querySelector('[data-formulaire]'),
  repondre: async (texte, options) => {
    if (MARQUEUR_APPRENTISSAGE.test(texte)) {
      const contenuLecon = texte.replace(MARQUEUR_APPRENTISSAGE, '').trim();
      const extrait = extraireLecon(contenuLecon);
      if (!extrait) {
        const formes = Object.values(TYPES_LECON).map((f) => `\n• ${f}`).join('');
        return { texte: `Je ne reconnais pas cette forme de leçon. Les formes que je comprends sont :${formes}` };
      }
      const dateQuestion = new Date().toISOString();
      return {
        texte: apercuLecon(extrait),
        confirmation: {
          onOui: async () => {
            let reponseFinale;
            try {
              const e = await ecranLangage.assurerEsprit();
              const r = await ecranLangage.ecrireConnaissance(e, extrait, { origine: 'apprise-conversation', exemple: contenuLecon });
              reponseFinale = r.explication;
            } catch (err) { reponseFinale = err.message; }
            await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
            return reponseFinale;
          },
          onNon: async () => {
            const reponseFinale = "D'accord, je n'ai rien retenu.";
            await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
            return reponseFinale;
          },
        },
      };
    }

    // Sinon : le laboratoire répond en premier quand il est SÛR de lui (état COMPRIS) ; sinon le
    // chemin de conversation actuel reste strictement inchangé — aucun appel réseau, aucun coût,
    // pour tout message que le canal pédagogique ne reconnaît pas avec certitude.
    // GARDE-FOU TROUVÉ EN TESTANT (pas anticipé dans l'analyse) : comprendre() peut atteindre l'état
    // COMPRIS sur une phrase qui n'est PAS une question — « J'ai un chat qui s'appelle Pixel » (une
    // simple présentation) est comprise comme une question sur « mon nom », sujet par défaut sans
    // possessif explicite, et répond « Je ne sais pas. » au lieu de laisser la conversation
    // l'accueillir normalement. Pas un défaut du moteur pédagogique, jamais conçu pour trier entre
    // question et affirmation ordinaire — ce tri revient au pont, pas à lui. Restreint ici, dans
    // main.js seulement, à un signe de question explicite : couvre l'usage réel visé (« Quelle est
    // la couleur de mon vélo ? ») sans jamais intercepter une phrase qui n'en est pas une.
    const ressembleAUneQuestion = texte.includes('?');
    const eLangage = ressembleAUneQuestion ? await ecranLangage.assurerEsprit() : null;
    const local = eLangage ? repondreLangage(eLangage, texte) : null;
    if (local && local.etat === COMPRIS) {
      const dateQuestion = new Date().toISOString();
      await journaliserEchangeLaboratoire(texte, local.texte, dateQuestion);
      return { texte: local.texte, local: true, laboratoire: true };
    }

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
