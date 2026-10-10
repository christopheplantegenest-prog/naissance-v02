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
import { nouvelId, ouvrirIndexedDB as ouvrirLangage, magasinMemoireVive as magasinLangageVive, enregistrerExperience as enregistrerExperienceReelle, ajouterInterpretation as ajouterInterpretationReelle, enregistrerObservationLangage as enregistrerObservationLangageReelle, rattacherObservationLangage as rattacherObservationLangageReelle, enregistrerObservationPossibilites as enregistrerObservationPossibilitesReelle, enregistrerValeurDonnee as enregistrerValeurDonneeReelle } from './langage/connaissances.js';
import { tenterPontLangage, enregistrerExperienceTentativeEchouee, traiterTourAvecEnonce, creerObservateurLangage } from './langage/pont.js';
import { observerPossibilites } from './langage/observation-possibilites.js';
// v0.63.35 — OUTIL DE DÉVELOPPEMENT : sollicitation extérieure d'UNE application déterminée (voir contexte-sollicitation.js et execution-sollicitee.js).
import { suivreObservationDuTour } from './langage/contexte-sollicitation.js';
import { executerApplicationSollicitee } from './langage/execution-sollicitee.js';
// v0.63.60 — déclencheur mécanique des applications sans choix (origine de désignation 'mecanique').
import { executerApplicationsDeterminees } from './langage/execution-mecanique.js';
// v0.63.81 — J-B : l'environnement 'conversation' — émission réelle de chaque production du lot (acte persisté, puis ligne dans la bulle) et
// réception DÉCLARÉE par le geste « Répondre » sur une émission (fait brut, aucune signification). Voir environnement-conversation.js.
import { emettreLot, declarerReceptionConversation } from './langage/environnement-conversation.js';
// v0.63.84 — B1 : capacité d'agir. Porte « c = 0 ? » sur le lot mécanique, variation après un tour ACTIF, tick de repos explicite (bouton « Repos »,
// dispositif de validation du temps propre). Aucune autre lecture de c. Voir capacite.js.
import { lireCapacite, tourActif, PARAMETRES_B1 } from './langage/capacite.js';
// v0.63.86 — B2 : état relationnel (lecture pour le bandeau ; conséquence d'une réception déclarée) et tick propre à deux conséquences (tick-propre.js).
// Aucune orientation : r n'est lu par aucun mécanisme de décision. Voir relation.js.
import { lireRelation, consequenceReception, PARAMETRES_B2 } from './langage/relation.js';
// v0.63.87 — besoins déclarés : motif actuel et moyens connus, LECTURE PURE pour l'affichage (aucune initiative, aucun choix, aucune émission).
import { lireBesoins } from './langage/besoins.js';
import { tickPropre } from './langage/tick-propre.js';
import { TABLE_OPERATIONS } from './langage/table-operations.js';
import { composerApresVecu } from './langage/vecu.js';
import { extraireLecon, apercuLecon, TYPES_LECON } from './langage/lecon.js';
import { estEnseignementNaturel, interpreterEnseignement } from './langage/interpretation.js';
import { verifierCours, donnerCours, formaterApercu } from './langage/cours.js';
import { demanderDecompositionCours, assurerRelationsConnues } from './langage/gemini-professeur.js';
import { induireTransformation } from './langage/transformation.js';
import { evaluerAction } from './langage/action.js';
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

// --- v0.21 — ASSIMILATION D'UN COURS (DÉCISION CHATGPT, VOIE A) ----------------------------------
// « Apprends : <forme> » ci-dessus reste pour UNE seule connaissance déjà écrite dans le format exact.
// Ici : un COURS entier, en prose libre, que Gemini décompose en PLUSIEURS candidates -- chacune
// revalidée par extraireLecon() (gemini-professeur.js), jamais écrite avant une validation globale
// explicite. Un marqueur EXPLICITE, jamais une liste de formulations naturelles ("étudie", "retiens
// ce cours"...) : Christophe doit dire « Cours : » pour qu'un message soit pris comme matière à
// apprendre. Le lot proposé est ensuite écrit par cours.js -- donnerCours()/ecrireConnaissance(),
// EXACTEMENT le même chemin que le laboratoire -- jamais un second système de stockage.
const MARQUEUR_COURS = /^cours\s*:\s*/i;
const MARQUEUR_VALIDER_COURS = /^valide le cours\s*\.?\s*$/i;
const MARQUEUR_ANNULER_COURS = /^annule le cours\s*\.?\s*$/i;
let coursEnAttente = null; // { texteBloc } — UN SEUL cours en attente à la fois, comme leconEnAttente (ecran.js).

// --- v0.25 — PROPOSITION SPONTANÉE (décision ChatGPT du 27/09/2026) ------------------------------
// Naissance signale d'elle-même, après une réponse normale, qu'elle a repéré une régularité dans son
// vécu récent (ecranLangage.examinerPropositionSpontanee(), appelée via le point apresNouvelleExperience
// existant, ci-dessous) et demande une signification -- même principe de marqueur EXPLICITE que
// « Cours : »/« Valide le cours. »/« Annule le cours. » ci-dessus : jamais une liste de formulations
// naturelles à deviner. UNE SEULE proposition en attente à la fois (propositionSignificationEnAttente),
// mais l'absence d'empilement est en réalité garantie par la table `propositions` elle-même (voir
// ecran.js) : cette variable ne fait que retrouver l'identifiant à confirmer/refuser depuis le
// marqueur suivant, elle ne décide jamais seule qu'une proposition existe.
const MARQUEUR_SIGNIFICATION = /^signification\s*:\s*/i;
const MARQUEUR_REFUSER_PROPOSITION = /^(refuse|non)\s*\.?\s*$/i;
let propositionSignificationEnAttente = null; // { id, motifCle }

function messageDeProposition(proposition) {
  if (!proposition) return null;
  const sujet = proposition.motifCle.replace(/^(mot|role):/, '');
  return `J'ai remarqué une régularité dans plusieurs de nos échanges (autour de « ${sujet} »). `
    + `Veux-tu me dire ce qu'elle signifie ? Réponds « Signification : ... » pour me l'apprendre, `
    + `ou « Refuse » si tu préfères que j'oublie cette piste.`;
}

async function validerPropositionEnAttente(signification) {
  if (!propositionSignificationEnAttente) return { texte: "Aucune proposition de signification n'est en attente." };
  if (!signification) return { texte: 'Il me faut un nom pour cette signification.' };
  const { id } = propositionSignificationEnAttente;
  propositionSignificationEnAttente = null;
  try {
    const resultat = await ecranLangage.confirmerPropositionSpontanee(id, signification);
    return { texte: resultat.explication };
  } catch (err) {
    return { texte: err.message };
  }
}

async function refuserPropositionEnAttente() {
  if (!propositionSignificationEnAttente) return { texte: "Aucune proposition de signification n'est en attente." };
  const { id } = propositionSignificationEnAttente;
  propositionSignificationEnAttente = null;
  await ecranLangage.refuserPropositionSpontanee(id);
  return { texte: "D'accord, je n'ai rien retenu de cette proposition." };
}

// Une même proposition 'proposee' reste retournée par examinerPropositionSpontanee() tant qu'elle
// n'a pas de réponse (voir ecran.js) -- volontaire, pour survivre à un redémarrage complet. Mais
// annoncer CETTE MÊME proposition à CHAQUE tour de conversation reviendrait à interrompre Christophe
// « à chaque motif », l'inverse du garde-fou demandé : ce module ne remet le message que la
// PREMIÈRE fois qu'il la voit (id différent de celle déjà en attente, ou rien en attente jusque-là).
async function traiterPropositionSpontanee(proposition) {
  const nouvelle = !!proposition && (!propositionSignificationEnAttente || propositionSignificationEnAttente.id !== proposition.id);
  if (proposition) propositionSignificationEnAttente = { id: proposition.id, motifCle: proposition.motifCle };
  return nouvelle ? messageDeProposition(proposition) : null;
}

// --- v0.26 — TRANSFORMATIONS APPRISES PAR EXEMPLES (décision ChatGPT du 27/09/2026, « ÉDUQUER
// PLUTÔT QUE PROGRAMMER ») ------------------------------------------------------------------------
// Diagnostic du chantier précédent (v0.25) : le canal du cours ne sait stocker que des connaissances
// déclaratives ou des substitutions à créneau fermé, jamais une transformation généralisable à une
// phrase inédite. Ici : Christophe fournit lui-même plusieurs exemples « entrée => sortie » (aucun
// Gemini, tout est local et déterministe -- voir langage/transformation.js), Naissance induit une
// transformation générale SI les exemples s'accordent, la propose (rien n'est encore appris), et
// n'apprend RÉELLEMENT qu'après confirmation explicite -- même principe de marqueur EXPLICITE et de
// variable « en attente » que « Cours : »/« Valide le cours. » ci-dessus, jamais une liste de
// formulations naturelles à deviner. « Applique : » mobilise ensuite, en conversation normale, TOUTES
// les transformations déjà validées dont l'arité correspond -- jamais un second système parallèle.
const MARQUEUR_TRANSFORMATION = /^transformation\s*:\s*/i;
const MARQUEUR_VALIDER_TRANSFORMATION = /^valide la transformation\s*\.?\s*$/i;
const MARQUEUR_ANNULER_TRANSFORMATION = /^annule la transformation\s*\.?\s*$/i;
const MARQUEUR_APPLIQUE = /^applique\s*:\s*/i;
const SEPARATEUR_EXEMPLE_TRANSFORMATION = /^(.+?)\s*(?:=>|→)\s*(.+)$/;
// v0.29 (décision ChatGPT « SÉLECTION CONTEXTUELLE PAR INTENTION ») : une ligne FACULTATIVE, avant
// « Transformation : », pour donner un nom (chaîne libre, JAMAIS interprété) à ce qu'on enseigne --
// « Intention : féminin » -- et un séparateur « / » dans « Applique : » pour redemander ce même nom au
// moment d'appliquer -- « Applique : féminin / lent ». Deux marqueurs explicites de plus, jamais une
// formulation naturelle devinée, exactement le principe déjà en place pour Transformation:/Applique:.
const MARQUEUR_INTENTION_ENSEIGNEE = /^intention\s*:\s*(.+?)\s*\r?\n/i;
const SEPARATEUR_INTENTION_APPLIQUE = /^(.+?)\s*\/\s*(.+)$/;
let transformationEnAttente = null; // { candidat: {n, insertions, exemples, intention} } — une seule à la fois, comme coursEnAttente.

// Lit un bloc « une ligne par exemple, entrée => sortie », induit et propose (rien n'est écrit).
function proposerTransformationDepuisBloc(bloc, intention = null) {
  const lignes = bloc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const exemples = [];
  const rejetees = [];
  for (const ligne of lignes) {
    const m = ligne.match(SEPARATEUR_EXEMPLE_TRANSFORMATION);
    if (!m) { rejetees.push(ligne); continue; }
    exemples.push({ entree: m[1].trim(), sortie: m[2].trim() });
  }
  if (!exemples.length) {
    transformationEnAttente = null;
    return { texte: 'Il me faut des exemples « entrée => sortie », un par ligne, après « Transformation : ».' };
  }
  const resultat = induireTransformation(exemples);
  if (!resultat.ok) {
    transformationEnAttente = null;
    return { texte: `Je ne peux pas généraliser une transformation à partir de ces exemples : ${resultat.detail}` };
  }
  transformationEnAttente = { candidat: { ...resultat.transformation, exemples: resultat.exemples, intention } };
  const apercu = resultat.exemples.map((e) => `  ${e.entree} → ${e.sortie}`).join('\n');
  const note = rejetees.length ? `\n(${rejetees.length} ligne(s) ignorée(s), pas de « => » reconnu : ${rejetees.join(' / ')})` : '';
  const noteIntention = intention ? `\n(intention : ${intention})` : '';
  return {
    texte: `Voici ce que je propose de retenir comme transformation générale, à partir de :\n${apercu}\n\n`
      + `Réponds « Valide la transformation. » pour que je l'apprenne, ou « Annule la transformation. » pour ne rien retenir.${note}${noteIntention}`,
  };
}

async function validerTransformationEnAttente() {
  if (!transformationEnAttente) return { texte: "Aucune transformation n'est en attente de validation." };
  const { candidat } = transformationEnAttente;
  transformationEnAttente = null;
  const { explication } = await ecranLangage.confirmerTransformation(candidat);
  return { texte: explication };
}

// --- v0.39 — LOT B3 : RACCORD CONVERSATIONNEL D'UNE ACTION INTERNE APPRISE (décision ChatGPT du
// 02/10) -----------------------------------------------------------------------------------------
// Rend enseignable, depuis la conversation, ce que B2 (action.js) sait déjà VALIDER et INVOQUER :
// un squelette de plusieurs exemples + une association explicite des positions variables à des rôles
// nommés (« sujetA », « sujetB », « relation » pour confrontation, la seule capacité du registre pour
// l'instant). MÊME DISCIPLINE PÉDAGOGIQUE que « Transformation : » ci-dessus : un marqueur EXPLICITE,
// jamais une formulation naturelle devinée ; rien n'est appris avant « Valide l'action. ». La syntaxe
// pédagogique (« Action : <opération> » / « Rôles : ... » / une ligne par exemple) est délibérément
// explicite et temporaire -- elle ne doit JAMAIS être confondue avec la forme naturelle apprise
// elle-même (« compare zalpha et zbeta sur zcouleur », reconnue ensuite par tenterReconnaissanceAction(),
// ci-dessous, sans AUCUN mot français câblé en dur).
const MARQUEUR_ACTION = /^action\s*:\s*/i;
const MARQUEUR_VALIDER_ACTION = /^valide l['’]action\s*\.?\s*$/i;
const MARQUEUR_ANNULER_ACTION = /^annule l['’]action\s*\.?\s*$/i;
const MOT_ROLES_ACTION = /^r[ôo]les\s*:\s*(.+)$/i;
let actionEnAttente = null; // { candidat: {operation, roles, n, exemples, statut} } — une seule à la fois, comme transformationEnAttente.

// Lit un bloc « Action : <opération> » suivi de « Rôles : <rôle1>, <rôle2>, ... » puis d'au moins deux
// exemples (une phrase entière par ligne), évalue (evaluerAction(), action.js, PUR — aucune écriture)
// et propose (rien n'est encore appris). evaluerAction() calcule déjà TOUT : opération inconnue, rôles
// manquants/en trop/mal orthographiés, arité incompatible, et le statut validee/incertaine lui-même —
// cette fonction ne fait que lire le bloc et restituer honnêtement ce que evaluerAction() a décidé,
// jamais une seconde logique de validation.
function proposerActionDepuisBloc(bloc) {
  const lignes = bloc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lignes.length < 2) {
    actionEnAttente = null;
    return { texte: 'Il me faut, après « Action : <opération> », une ligne « Rôles : ... » puis au moins deux exemples (une phrase par ligne).' };
  }
  const operation = lignes[0];
  const mRoles = lignes[1].match(MOT_ROLES_ACTION);
  if (!mRoles) {
    actionEnAttente = null;
    return { texte: 'Il me faut une ligne « Rôles : <rôle1>, <rôle2>, ... » juste après le nom de l\'opération.' };
  }
  const roles = mRoles[1].split(',').map((r) => r.trim()).filter(Boolean);
  const exemples = lignes.slice(2);
  const resultat = evaluerAction({ operation, roles, exemples });
  if (!resultat.ok) {
    actionEnAttente = null;
    return { texte: `Je ne peux pas retenir cette action : ${resultat.detail}` };
  }
  actionEnAttente = {
    candidat: {
      operation, roles: resultat.roles, n: resultat.n, exemples: resultat.exemples, statut: resultat.statut,
    },
  };
  const apercu = resultat.exemples.map((e) => `  ${e.entree}`).join('\n');
  const noteStatut = resultat.statut === 'incertaine'
    ? "\n\nATTENTION : avec ces seuls exemples, je ne peux pas encore distinguer tous les rôles les uns des autres. Je la garderai INCERTAINE (jamais utilisée pour répondre) tant que des exemples supplémentaires ne lèveront pas ce doute."
    : '';
  return {
    texte: `Voici ce que je propose de retenir comme action « ${operation} », rôles [${roles.join(', ')}], à partir de :\n${apercu}${noteStatut}\n\n`
      + `Réponds « Valide l'action. » pour que je l'apprenne, ou « Annule l'action. » pour ne rien retenir.`,
  };
}

async function validerActionEnAttente() {
  if (!actionEnAttente) return { texte: "Aucune action n'est en attente de validation." };
  const { candidat } = actionEnAttente;
  actionEnAttente = null;
  const { explication } = await ecranLangage.confirmerAction(candidat);
  return { texte: explication };
}

// --- v0.43 — DÉCISION CHATGPT « RÉFÉRENÇABILITÉ ET RÉUTILISATION SCALAIRE DES RÉSULTATS » (02/10) --
// MÊME DISCIPLINE PÉDAGOGIQUE EXACTE que « Action : » ci-dessus : un marqueur EXPLICITE et structurel
// (jamais une formulation naturelle devinée, jamais un mot français câblé en dur pour une capacité
// particulière), rien n'est appris avant « Valide la liaison. ». Une LIAISON associe un champ
// scalaire explicite du résultat d'une capacité SOURCE à un rôle explicite d'une capacité CIBLE —
// voir composition.js (evaluerLiaison, PUR) pour ce qui est déjà vérifié contre le registre fermé.
const MARQUEUR_LIAISON = /^liaison\s*:\s*/i;
const MARQUEUR_VALIDER_LIAISON = /^valide la liaison\s*\.?\s*$/i;
const MARQUEUR_ANNULER_LIAISON = /^annule la liaison\s*\.?\s*$/i;
const MOT_VERS_LIAISON = /^vers\s*:\s*(.+)$/i;
const SEPARATEUR_CHAMP = /^(.+?)\s*\.\s*(.+)$/; // "<capacite> . <champ ou rôle>"
let liaisonEnAttente = null; // { candidat: {capaciteSource, champ, capaciteCible, role} } — une seule à la fois.

// Lit un bloc « Liaison : <capaciteSource> . <champ> » suivi de « Vers : <capaciteCible> . <role> »,
// évalue (evaluerLiaison(), composition.js, PUR — aucune écriture) et propose (rien n'est encore
// appris). Même principe EXACT que proposerActionDepuisBloc() ci-dessus : cette fonction ne fait que
// lire le bloc et restituer honnêtement ce que evaluerLiaison() a décidé.
async function proposerLiaisonDepuisBloc(bloc) {
  const lignes = bloc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lignes.length < 2) {
    liaisonEnAttente = null;
    return { texte: 'Il me faut, après « Liaison : <capacité source> . <champ> », une ligne « Vers : <capacité cible> . <rôle> ».' };
  }
  const mSource = lignes[0].match(SEPARATEUR_CHAMP);
  if (!mSource) {
    liaisonEnAttente = null;
    return { texte: 'Il me faut « Liaison : <capacité source> . <champ> » (séparés par un point).' };
  }
  const mVers = lignes[1].match(MOT_VERS_LIAISON);
  if (!mVers) {
    liaisonEnAttente = null;
    return { texte: 'Il me faut une ligne « Vers : <capacité cible> . <rôle> » juste après « Liaison : ... ».' };
  }
  const mCible = mVers[1].match(SEPARATEUR_CHAMP);
  if (!mCible) {
    liaisonEnAttente = null;
    return { texte: 'Il me faut « Vers : <capacité cible> . <rôle> » (séparés par un point).' };
  }
  const [, capaciteSource, champ] = mSource;
  const [, capaciteCible, role] = mCible;
  const resultat = ecranLangage.evaluerLiaison({
    capaciteSource: capaciteSource.trim(), champ: champ.trim(), capaciteCible: capaciteCible.trim(), role: role.trim(),
  });
  if (!resultat.ok) {
    liaisonEnAttente = null;
    return { texte: `Je ne peux pas retenir cette liaison : ${resultat.detail}` };
  }
  liaisonEnAttente = {
    candidat: {
      capaciteSource: capaciteSource.trim(), champ: champ.trim(), capaciteCible: capaciteCible.trim(), role: role.trim(),
    },
  };
  return {
    texte: `Voici ce que je propose de retenir : « ${capaciteSource.trim()}.${champ.trim()} » → « ${capaciteCible.trim()}.${role.trim()} ».\n\n`
      + `Réponds « Valide la liaison. » pour que je l'apprenne, ou « Annule la liaison. » pour ne rien retenir.`,
  };
}

async function validerLiaisonEnAttente() {
  if (!liaisonEnAttente) return { texte: "Aucune liaison n'est en attente de validation." };
  const { candidat } = liaisonEnAttente;
  liaisonEnAttente = null;
  const { explication } = await ecranLangage.confirmerLiaison(candidat);
  return { texte: explication };
}

// --- « Compose : <opération> » suivi de lignes « <rôle> : <valeur> » (une par ligne, FACULTATIVES) :
// invocation EXPLICITE et IMMÉDIATE (jamais de confirmation différée -- une invocation ne modifie
// aucune connaissance, exactement comme l'invocation naturelle d'une action apprise). Tout rôle non
// listé ici est résolu par une liaison déjà apprise (invoquerComposition(), ecran.js) -- sinon
// abstention explicite, jamais une invocation partielle. AUCUN « pour chaque » : une seule invocation,
// un seul résultat, conforme au cadrage de ce chantier (aucune liste, aucune itération).
const MARQUEUR_COMPOSE = /^compose\s*:\s*/i;
const MOT_ROLE_VALEUR = /^(.+?)\s*:\s*(.+)$/;
async function composerDepuisBloc(bloc) {
  const lignes = bloc.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lignes.length) return { texte: 'Il me faut, après « Compose : », le nom de l\'opération.' };
  const operation = lignes[0];
  const argumentsExplicites = {};
  for (const ligne of lignes.slice(1)) {
    const m = ligne.match(MOT_ROLE_VALEUR);
    if (!m) return { texte: `Je ne reconnais pas « ${ligne} » : il me faut « <rôle> : <valeur> ».` };
    argumentsExplicites[m[1].trim()] = m[2].trim();
  }
  const r = await ecranLangage.invoquerComposition({ operation, argumentsExplicites });
  // v0.63 — même principe exact que pour les voies action/rejeu : transport additif de l'id de la
  // trace 'composition' réellement créée ce tour-ci, jamais une recherche. Reste DORMANT.
  return { texte: r.texte, local: r.ok, ...(r.idTrace !== undefined ? { idTrace: r.idTrace } : {}) };
}

async function appliquerTransformationEnConversation(texte) {
  let intention = null;
  let phrase = texte;
  const m = texte.match(SEPARATEUR_INTENTION_APPLIQUE);
  if (m) { intention = m[1].trim(); phrase = m[2].trim(); }
  const resultat = await ecranLangage.appliquerTransformationLocale(phrase, intention);
  if (!resultat.ok) return { texte: `Je ne peux pas l'appliquer localement : ${resultat.detail}` };
  return { texte: resultat.texte, local: true };
}

async function journaliserEchangeLaboratoire(question, reponse, dateQuestion) {
  return memoire.ajouterEchange({ question, reponse, moteur: 'laboratoire', dateQuestion, dateReponse: new Date().toISOString() });
}

// Décompose la prose reçue avec Gemini, revalide chaque ligne, prépare un aperçu (RIEN n'est écrit :
// verifierCours() rejoue sur une copie éphémère) et met le lot de côté pour une validation globale.
async function proposerCoursDepuisProse(prose) {
  let decomposition;
  try {
    decomposition = await demanderDecompositionCours({ titre: null, prose, appelerGemini: ecranLangage.appelerGemini });
  } catch (err) {
    return { texte: `Je n'ai pas pu décomposer ce cours : ${err.message}` };
  }
  const { note, reconnues, rejetees } = decomposition;
  if (!reconnues.length) {
    coursEnAttente = null;
    return { texte: `Je n'ai rien pu tirer d'exploitable de ce cours.${rejetees.length ? ` (${rejetees.length} ligne(s) proposée(s) mais mal formée(s).)` : ''}${note ? ` ${note}` : ''}` };
  }
  const contexte0 = await ecranLangage.contexteCours();
  const relationsAAjouter = assurerRelationsConnues(reconnues, contexte0.esprit.lexique);
  const texteBloc = ['Leçon : Cours reçu en conversation', 'Source : conversation', ...relationsAAjouter, ...reconnues.map((r) => r.texte)].join('\n');
  const v = await verifierCours(texteBloc, contexte0);
  if (!v.ok) {
    coursEnAttente = null;
    return { texte: `Gemini a proposé des connaissances, mais le lot n'est pas exécutable : ${v.erreurs.map((e) => e.raison).join(' ; ')}` };
  }
  coursEnAttente = { texteBloc };
  const lignes = [
    `Voici ce que je propose de retenir de ce cours (rien n'est encore appris) :`,
    '',
    formaterApercu(v),
    '',
    rejetees.length ? `${rejetees.length} ligne(s) proposée(s) par Gemini écartée(s) car mal formée(s) : ${rejetees.join(' / ')}` : null,
    note ? `Note de Gemini (jamais apprise) : ${note}` : null,
    '',
    'Réponds « Valide le cours. » pour que je l\'apprenne, ou « Annule le cours. » pour ne rien retenir.',
  ].filter((l) => l !== null);
  return { texte: lignes.join('\n') };
}

async function validerCoursEnAttente() {
  if (!coursEnAttente) return { texte: "Aucun cours n'est en attente de validation." };
  const { texteBloc } = coursEnAttente;
  coursEnAttente = null;
  const res = await donnerCours(texteBloc, await ecranLangage.contexteCours());
  await ecranLangage.rafraichir();
  if (!res.ok) return { texte: "Le lot n'est plus exécutable (la mémoire a changé entretemps) : rien n'a été écrit. Renvoie le cours si besoin." };
  const ecrites = res.elements.filter((e) => e.action === 'ecrite').length;
  const sautees = res.elements.filter((e) => e.action === 'sautee').length;
  return {
    texte: `J'ai appris ${ecrites} connaissance${ecrites > 1 ? 's' : ''} de ce cours.`
      + (sautees ? ` (${sautees} déjà connue${sautees > 1 ? 's' : ''}, laissée${sautees > 1 ? 's' : ''} inchangée${sautees > 1 ? 's' : ''}.)` : ''),
  };
}

// Aperçu + Confirmer / Annuler d'UNE leçon déjà extraite — le même pour « Apprends : <forme> » et pour
// « Apprends que … » (v0.16) : une seule confirmation, un seul chemin d'écriture (ecrireConnaissance).
// texte : le message tel que tapé (journal) ; contenuLecon : la leçon au format du canal (exemple d'écriture).
function proposerLecon(texte, extrait, contenuLecon) {
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

// ÉTAPE 5.2-bis — RÉFÉRENCE EXPLICITE D'UNE VRAIE EXPÉRIENCE À UNE TRACE (décision ChatGPT,
// 03/10/2026) : extrait ici TEL QUEL (aucun changement de logique) tout le dispatch déjà existant,
// uniquement pour pouvoir y faire traverser referenceTrace jusqu'aux deux points réels de création
// d'expérience (tenterPontLangage/enregistrerExperienceTentativeEchouee ci-dessous), SANS toucher
// à aucun des chemins locaux (action/rejeu/transformation/marqueur/composition) : ils continuent de
// renvoyer EXACTEMENT ce qu'ils renvoyaient avant ce chantier. C'est le wrapper repondre:
// ci-dessous qui décide, une fois pour toutes, si une référence sélectionnée a été honorée ou non
// (appliquerAbstentionSiReferenceIgnoree(), pont.js -- fonction PURE, testée en isolation car
// traiterTour() elle-même ne l'est pas, pour la même raison que pont.js existe : main.js n'a aucun
// export, couplage direct à document/window dès le chargement du module).
async function traiterTour(texte, options, referenceTrace) {
    // v0.25 — réponse à une proposition spontanée EN ATTENTE : marqueurs explicites, vérifiés en tout
    // premier (avant même l'enseignement naturel) puisqu'ils ne concernent qu'un état de conversation
    // ponctuel, jamais une phrase à interpréter comme du langage ordinaire.
    if (MARQUEUR_SIGNIFICATION.test(texte)) return validerPropositionEnAttente(texte.replace(MARQUEUR_SIGNIFICATION, '').trim());
    if (MARQUEUR_REFUSER_PROPOSITION.test(texte)) return refuserPropositionEnAttente();
    // v0.16 — « Apprends que ma couleur est rouge. » : interprétation LOCALE d'un cadre très étroit
    // (langage/interpretation.js), traduite en UNE leçon « Fait » puis confirmée comme les autres.
    // Testé AVANT tout le reste : un message marqué ne retombe jamais silencieusement dans la
    // conversation ordinaire — hors du cadre, il reçoit un refus clair. « Retiens que » n'est pas touché.
    if (estEnseignementNaturel(texte)) {
      let e;
      try { e = await ecranLangage.assurerEsprit(); } catch (err) {
        return { texte: `Je n'ai pas pu ouvrir ma mémoire du langage : ${err.message}` };
      }
      const r = interpreterEnseignement(texte, { lexique: e.lexique });
      if (!r.ok) return { texte: r.raison };
      return proposerLecon(texte, r.extrait, r.phrase);
    }
    if (MARQUEUR_APPRENTISSAGE.test(texte)) {
      const contenuLecon = texte.replace(MARQUEUR_APPRENTISSAGE, '').trim();
      const extrait = extraireLecon(contenuLecon);
      if (!extrait) {
        const formes = Object.values(TYPES_LECON).map((f) => `\n• ${f}`).join('');
        return { texte: `Je ne reconnais pas cette forme de leçon. Les formes que je comprends sont :${formes}` };
      }
      return proposerLecon(texte, extrait, contenuLecon);
    }
    if (MARQUEUR_VALIDER_COURS.test(texte)) return validerCoursEnAttente();
    if (MARQUEUR_ANNULER_COURS.test(texte)) {
      coursEnAttente = null;
      return { texte: "D'accord, je n'ai rien retenu de ce cours." };
    }
    if (MARQUEUR_COURS.test(texte)) {
      const prose = texte.replace(MARQUEUR_COURS, '').trim();
      if (!prose) return { texte: 'Il me faut le contenu du cours après « Cours : ».' };
      return proposerCoursDepuisProse(prose);
    }
    // v0.26 — mêmes garanties que le bloc Cours ci-dessus : marqueurs explicites, vérifiés avant
    // tout le reste, jamais devinés depuis une formulation naturelle.
    if (MARQUEUR_VALIDER_TRANSFORMATION.test(texte)) return validerTransformationEnAttente();
    if (MARQUEUR_ANNULER_TRANSFORMATION.test(texte)) {
      transformationEnAttente = null;
      return { texte: "D'accord, je n'ai rien retenu de cette transformation." };
    }
    {
      // v0.29 : une ligne « Intention : ... » facultative peut précéder « Transformation : » dans le
      // MÊME message -- détectée et retirée ICI seulement (jamais affecter Cours:/Applique: ci-dessus/
      // dessous), avant de reconnaître le marqueur Transformation: comme d'habitude.
      const mIntentionEnseignee = texte.match(MARQUEUR_INTENTION_ENSEIGNEE);
      const texteSansIntention = mIntentionEnseignee ? texte.slice(mIntentionEnseignee[0].length) : texte;
      if (MARQUEUR_TRANSFORMATION.test(texteSansIntention)) {
        const bloc = texteSansIntention.replace(MARQUEUR_TRANSFORMATION, '').trim();
        if (!bloc) return { texte: 'Il me faut au moins deux exemples après « Transformation : », un par ligne : entrée => sortie.' };
        return proposerTransformationDepuisBloc(bloc, mIntentionEnseignee ? mIntentionEnseignee[1].trim() : null);
      }
    }
    if (MARQUEUR_APPLIQUE.test(texte)) {
      const entree = texte.replace(MARQUEUR_APPLIQUE, '').trim();
      if (!entree) return { texte: 'Il me faut une phrase après « Applique : ».' };
      return appliquerTransformationEnConversation(entree);
    }
    // v0.39 — LOT B3 : mêmes garanties que Transformation:/Cours: ci-dessus pour l'enseignement d'une
    // action interne apprise -- marqueurs explicites, vérifiés avant tout le reste.
    if (MARQUEUR_VALIDER_ACTION.test(texte)) return validerActionEnAttente();
    if (MARQUEUR_ANNULER_ACTION.test(texte)) {
      actionEnAttente = null;
      return { texte: "D'accord, je n'ai rien retenu de cette action." };
    }
    if (MARQUEUR_ACTION.test(texte)) {
      const bloc = texte.replace(MARQUEUR_ACTION, '').trim();
      if (!bloc) return { texte: 'Il me faut, après « Action : », le nom de l\'opération, puis « Rôles : ... », puis au moins deux exemples.' };
      return proposerActionDepuisBloc(bloc);
    }
    // v0.43 — RÉFÉRENÇABILITÉ ET RÉUTILISATION SCALAIRE DES RÉSULTATS : mêmes garanties que Action:
    // ci-dessus -- marqueurs explicites, vérifiés avant tout le reste.
    if (MARQUEUR_VALIDER_LIAISON.test(texte)) return validerLiaisonEnAttente();
    if (MARQUEUR_ANNULER_LIAISON.test(texte)) {
      liaisonEnAttente = null;
      return { texte: "D'accord, je n'ai rien retenu de cette liaison." };
    }
    if (MARQUEUR_LIAISON.test(texte)) {
      const bloc = texte.replace(MARQUEUR_LIAISON, '').trim();
      if (!bloc) return { texte: 'Il me faut, après « Liaison : <capacité source> . <champ> », une ligne « Vers : <capacité cible> . <rôle> ».' };
      return proposerLiaisonDepuisBloc(bloc);
    }
    if (MARQUEUR_COMPOSE.test(texte)) {
      const bloc = texte.replace(MARQUEUR_COMPOSE, '').trim();
      if (!bloc) return { texte: 'Il me faut, après « Compose : », le nom de l\'opération.' };
      return composerDepuisBloc(bloc);
    }

    // v0.30 — RACCORDEMENT COMPRÉHENSION → INTENTION → TRANSFORMATION (décision ChatGPT) : AVANT tout
    // recours au chemin conversationnel externe (Gemini), tenter de reconnaître si le message tapé
    // NATURELLEMENT (aucun marqueur « Applique : ») correspond littéralement au squelette d'une
    // transformation déjà enseignée avec une intention. Si RIEN ne correspond, ce n'est jamais une
    // erreur : on continue exactement le pipeline habituel, sans aucun changement (ligne ci-dessous).
    // Dès qu'AU MOINS un squelette correspond, la réponse est TOUJOURS locale, succès ou abstention
    // explicite -- jamais Gemini pour trancher une formulation déjà reconnue comme relevant d'un
    // apprentissage local.
    const reconnaissance = await ecranLangage.tenterReconnaissanceTransformation(texte);
    if (reconnaissance.reconnu) {
      return reconnaissance.ok
        ? { texte: reconnaissance.texte, local: true }
        : { texte: `Je ne peux pas répondre localement à partir de cette formulation : ${reconnaissance.detail}` };
    }

    // v0.39 — LOT B3 : RACCORDEMENT ACTION INTERNE APPRISE (décision ChatGPT « RACCORD
    // CONVERSATIONNEL ») -- MÊME PRINCIPE EXACT que la reconnaissance de transformation ci-dessus,
    // pour les actions internes apprises (B2, action.js) plutôt que pour les transformations. AUCUN
    // mot français déclencheur codé en dur : la seule question posée est structurelle (« cette entrée
    // correspond-elle au squelette d'une action déjà VALIDÉE ? »). Si RIEN ne correspond, ce n'est
    // jamais une erreur : le pipeline habituel continue, strictement inchangé. Dès qu'AU MOINS une
    // action validée correspond, la réponse est TOUJOURS locale à partir d'ici -- succès, ambiguïté
    // explicite, ou échec d'invocation -- jamais Gemini pour masquer l'échec d'une action locale déjà
    // reconnue.
    const reconnaissanceAction = await ecranLangage.tenterReconnaissanceAction(texte);
    if (reconnaissanceAction.reconnu) {
      // v0.63 — « EXPOSER L'IDENTITÉ DE LA TRACE PRODUITE PAR UN TOUR » (décision ChatGPT,
      // 03/10/2026) : transport ADDITIF, jamais une recherche -- reconnaissanceAction.idTrace est
      // déjà, par construction, l'id de LA trace que CE tour vient réellement de créer (présent
      // uniquement en cas de succès réel, voir ecran.js). Reste DORMANT : aucun consommateur ici.
      return reconnaissanceAction.ok
        ? { texte: reconnaissanceAction.texte, local: true, ...(reconnaissanceAction.idTrace !== undefined ? { idTrace: reconnaissanceAction.idTrace } : {}) }
        : { texte: `Je ne peux pas répondre localement à partir de cette formulation : ${reconnaissanceAction.detail}` };
    }

    // CHANTIER « PREMIER REJEU AUTONOME » (décision ChatGPT) : UNIQUEMENT consultée ici, c'est-à-dire
    // seulement après que tenterReconnaissanceAction() ci-dessus a renvoyé { reconnu: false } --
    // aucune concurrence avec une action enseignée (CHEMIN A figé, section 2 du cadrage : une action
    // enseignée unique, ambiguë, ou en échec d'invocation termine déjà le tour ci-dessus, sans jamais
    // atteindre cette ligne). Abstention SILENCIEUSE si { reconnu: false } : le pipeline continue
    // EXACTEMENT comme si cette tentative n'avait pas eu lieu (section 16) -- aucun message
    // spécifique au rejeu, jamais un recours à Gemini pour masquer une abstention locale.
    const reconnaissanceRejeu = await ecranLangage.tenterRejeuAutonome(texte);
    if (reconnaissanceRejeu.reconnu) {
      // v0.63 — même principe exact que pour la voie action ci-dessus : transport additif de l'id
      // de la trace 'rejeu' réellement créée ce tour-ci, jamais une recherche. Reste DORMANT.
      return {
        texte: reconnaissanceRejeu.texte, local: true,
        ...(reconnaissanceRejeu.idTrace !== undefined ? { idTrace: reconnaissanceRejeu.idTrace } : {}),
      };
    }

    // Sinon : le laboratoire répond en premier quand il est SÛR de lui (état COMPRIS) ; sinon le
    // chemin de conversation actuel reste strictement inchangé — aucun appel réseau, aucun coût,
    // pour tout message que le canal pédagogique ne reconnaît pas avec certitude.
    // A1 — décision extraite dans langage/pont.js (testable, à dépendances injectées).
    // A2 — quand elle répond, l'échange est aussi conservé comme expérience (B1).
    const experienceDeps = {
      enregistrerExperience: async (donnees) => {
        const e = await ecranLangage.assurerEsprit();
        return enregistrerExperienceReelle(e.magasin, donnees);
      },
      ajouterInterpretation: async (idExperience, donnees) => {
        const e = await ecranLangage.assurerEsprit();
        return ajouterInterpretationReelle(e.magasin, idExperience, donnees);
      },
      // Étape E (décision ChatGPT du 26/09/2026, « SIGNAL D'APPRENTISSAGE ») : après CHAQUE
      // nouvelle expérience B1 réelle, pose l'attente de toute hypothèse DÉJÀ persistée dont le
      // motif correspond -- ne recalcule jamais les motifs récurrents ici (repererMotifs() reste
      // strictement derrière le clic manuel de Christophe dans le laboratoire). v0.25 (décision
      // ChatGPT du 27/09/2026) : le MÊME point examine aussi, en plus, si le vécu justifie une
      // PROPOSITION SPONTANÉE (ecranLangage.examinerPropositionSpontanee(), qui borne elle-même le
      // pool et n'écrit jamais de connaissance) -- si une proposition existe déjà en attente ou
      // qu'une nouvelle vient d'être posée, son résultat remonte via le bilan rendu ci-dessous,
      // jamais deviné : pont.js le transmet tel quel (voir langage/pont.js, propositionSpontanee).
      // v0.49 — POINT D'ORCHESTRATION COMMUN DU VÉCU (décision ChatGPT, 03/10/2026) : enveloppe le
      // traitement ci-dessus, STRICTEMENT INCHANGÉ (composerApresVecu(), vecu.js, pure), pour qu'il
      // traverse d'abord apresNouveauVecu({type:'experience', id}) — rien de plus, aucune nouvelle
      // faculté cognitive. Même id reçu, même ordre, même valeur de retour, mêmes erreurs qu'avant
      // ce chantier (voir vecu.js : composerApresVecu() ne fait qu'ajouter cet appel AVANT).
      apresNouvelleExperience: composerApresVecu('experience', async (idExperience) => {
        const posees = await ecranLangage.reconnaitreAttentesPourExperience(idExperience);
        const proposition = await ecranLangage.examinerPropositionSpontanee();
        return { posees, proposition };
      }),
    };
    // v0.63.0 — ÉTAPE 7, OBSERVATION PASSIVE (décision ChatGPT, 04/10/2026) : photographie, pour tout message
    // qui atteint ICI la voie ordinaire (donc APRÈS marqueurs, squelettes et rejeu), ce que le moteur de
    // langage propre constate à T, via l'UNIQUE exécution de l'analyse faite dans tenterPontLangage(). Une
    // reprise forcée du même message n'est jamais observée. Aucune logique ici : tout vit dans pont.js
    // (creerObservateurLangage) et connaissances.js ; la poignée sert seulement à rattacher, plus bas, la
    // ligne à l'échange réel du journal. Ne change ni la réponse, ni le moteur, ni aucune autre donnée.
    const sansObservation = !!options && (options.repriseDe != null || options.forcerExterne === true);
    let poigneeObservation = null;
    const observateurLangage = creerObservateurLangage({
      enregistrer: async (donnees) => {
        const e = await ecranLangage.assurerEsprit();
        return enregistrerObservationLangageReelle(e.magasin, donnees);
      },
      rattacher: async (ligne, echange) => {
        const e = await ecranLangage.assurerEsprit();
        return rattacherObservationLangageReelle(e.magasin, ligne, echange);
      },
    });
    const local = await tenterPontLangage(texte, {
      assurerEsprit: ecranLangage.assurerEsprit,
      journaliser: journaliserEchangeLaboratoire,
      ...experienceDeps,
      referenceTrace,
      observer: sansObservation ? null : async (t, resultat, ref) => {
        poigneeObservation = await observateurLangage(t, resultat, ref);
        return poigneeObservation;
      },
    });
    if (local && local.local) {
      const msg = await traiterPropositionSpontanee(local.propositionSpontanee);
      return msg ? { ...local, actions: [...(local.actions || []), msg] } : local;
    }

    const reponse = await esprit.repondre(texte, options);
    // v0.63.0 — rattachement OPTIONNEL de l'observation à l'échange réel que esprit.repondre() vient d'écrire
    // (jamais bloquant ; absent si Gemini a échoué, puisqu'on n'arrive alors pas jusqu'ici).
    if (poigneeObservation && reponse) {
      try { await poigneeObservation.rattacher({ idQuestion: reponse.idQuestion, idReponse: reponse.idReponse }); } catch { /* jamais */ }
    }
    // Chantier « conserver PARTIEL/INCOMPRIS » : si le laboratoire avait une tentative locale
    // (PARTIEL/INCOMPRIS, transmise par tenterPontLangage() ci-dessus, jamais recalculée), on
    // l'enregistre honnêtement maintenant que la réponse RÉELLEMENT montrée est connue -- en
    // référençant l'échange mémoire déjà écrit par esprit.repondre() (idQuestion/idReponse/
    // dateQuestion), sans jamais en créer un second.
    if (local && local.tentative) {
      const experience = await enregistrerExperienceTentativeEchouee(texte, local.tentative, reponse, { ...experienceDeps, referenceTrace });
      // idExperience (étape E) : permet à la conversation de proposer un jugement facultatif,
      // même sur une réponse venue du repli LLM -- jamais un second appel au moteur langage.
      const msg = await traiterPropositionSpontanee(experience.propositionSpontanee);
      return msg
        ? { ...reponse, idExperience: experience.id, actions: [...(reponse.actions || []), msg] }
        : { ...reponse, idExperience: experience.id };
    }
    setTimeout(() => esprit.consoliderSiBesoin(), 1500);
    return reponse;
}

const conversation = monterConversation({
  liste: document.querySelector('[data-messages]'),
  formulaire: document.querySelector('[data-formulaire]'),
  repondre: async (texte, options) => {
    const referenceTrace = (options && options.referenceTrace) || null;
    // ÉTAPE 6 (v0.62.0) — CAPTURE BRUTE D'UN ÉNONCÉ ENVOYÉ EN RÉPONSE À UNE TRACE : si une référence
    // explicite existe, {idTrace, texte} est d'abord TENTÉ en persistance (table 'enonces'), AVANT que
    // n'importe quel chemin de traitement de traiterTour() puisse consommer le message ; ce point est
    // le seul appelant de traiterTour(), donc aucun chemin terminal ne peut le court-circuiter. Le
    // traitement reçoit EXACTEMENT le même texte et garde son comportement antérieur. Toute la
    // logique (capture non bloquante, enveloppe de sortie) vit dans pont.js, testable ; voir
    // traiterTourAvecEnonce() et appliquerAbstentionSiReferenceIgnoree() (étape 5.2-bis, enveloppe
    // de sortie, désormais informée de l'état de la capture).
    // v0.63.35 — CONTEXTE EXACT DU TOUR (en mémoire, propre à CET appel) : le retour réel d'observerPossibilites ({ observation, univers }) est gardé ici
    // avant que pont.js ne l'ignore, puis joint au résultat pour la bulle de réponse de CE tour (jamais reconstruit, jamais persisté).
    const suivi = suivreObservationDuTour((message) => observerPossibilites(message, {
        enregistrer: async (donnees) => {
          const e = await ecranLangage.assurerEsprit();
          return enregistrerObservationPossibilitesReelle(e.magasin, donnees);
        },
        // v0.63.24 — univers élargi : LECTURE seule de toutes les lignes d'exécution (aucune écriture, aucun filtre) pour la photographie
        // du début de tour. Échec de lecture : aucune observation écrite (voir observation-possibilites.js).
        lireExecutions: async () => {
          const e = await ecranLangage.assurerEsprit();
          return e.magasin.lireTout('executionsOperations');
        },
      }), async ({ observation, univers }) => {
        // v0.63.60 : UN lot par observation, chemin normal, aucune boucle (les productions sont observables au tour suivant).
        const e = await ecranLangage.assurerEsprit();
        // v0.63.84 — B1, PORTE PAR TOUR (décision ChatGPT du 10/10/2026) : la SEULE lecture de la capacité par un mécanisme. À c = 0, le lot
        // mécanique n'a pas lieu (aucune désignation, aucune exécution, aucune émission) ; l'observation du tour, elle, a déjà eu lieu. À c > 0, le
        // lot se déroule EXACTEMENT comme avant (aucune opération retirée, aucun ordre modifié : B1 gate le lot, il ne choisit rien).
        const capaciteAvant = await lireCapacite(e.magasin);
        const porte = capaciteAvant.valeur === 0;
        const lot = porte
          ? { applications: [], choixAFaire: [], resultats: [] }
          : await executerApplicationsDeterminees({ observation, univers }, { magasin: e.magasin, table: TABLE_OPERATIONS });
        // v0.63.81 — J-B : APRÈS le lot, chaque production exécutée est ÉMISE vers 'conversation' (emettreProduction : acte persisté avant toute
        // présentation) ; les lignes émises sont jointes au contexte de la bulle. Échec rendu, jamais levé ; aucune sélection, aucune lecture.
        const { emises, echec } = await emettreLot(lot, { magasin: e.magasin, idObservation: observation.id });
        // v0.63.84 — B1, TOUR ACTIF : si le lot a réellement produit au moins une exécution propre, ce tour coûte une unité de capacité : contextes
        // et attentes « soi:tour(etat) » écrits avant, puis la variation (cause { type:'tour', id: identité technique du tour = observation.id }).
        // Un tour sans acte exécuté (lot vide, échecs, ou porte) ne consomme rien. Échec rendu dans `capacite.echec`, jamais levé.
        let capacite = { avant: capaciteAvant.valeur, apres: capaciteAvant.valeur, plafond: PARAMETRES_B1.plafond, porte, variation: null, echec: null };
        if (lot.resultats.some((r) => r && r.statut === 'executee')) {
          try {
            const tour = await tourActif(e.magasin, { idObservation: observation.id, horodatage: observation.horodatage });
            capacite = { ...capacite, apres: tour.apres, variation: tour.variation };
          } catch (echecCapacite) {
            capacite = { ...capacite, echec: echecCapacite };
          }
        }
        return { ...lot, emises, echecEmission: echec, capacite };
      }, async () => (await ecranLangage.assurerEsprit()).magasin);
      // v0.63.78 — jalon 1 : le troisième argument donne un accès en LECTURE au magasin, après le lot, pour présenter dans la bulle les attentes
      // que ces exécutions ont écrites avant leur issue, et leurs issues (voir attentes-du-tour.js). Aucune décision, aucune écriture.
    const resultat = await traiterTourAvecEnonce(texte, referenceTrace, {
      enregistrerEnonce: (idTrace, texteEnonce) => ecranLangage.enregistrerEnonceSurTrace(idTrace, texteEnonce),
      traiter: () => traiterTour(texte, options, referenceTrace),
      nouvelId,
      // v0.63.16 — observation des possibilités au moment vécu : écrite AVANT la capture d'énoncé et le traitement (voir pont.js).
      observerPossibilites: suivi.observer,
      // v0.63.27 — valeur brute du message conservée sous SON identité, AVANT l'observation (échec : pas d'observation, le tour continue).
      enregistrerValeur: async (entree) => {
        const e = await ecranLangage.assurerEsprit();
        return enregistrerValeurDonneeReelle(e.magasin, entree);
      },
    });
    const joint = suivi.joindre(resultat);
    // v0.63.81 — J-B : si le message portait une référence d'ÉMISSION (geste « Répondre » sur une ligne émise par Naissance, voyage comme donnée
    // structurée { idEmission }, jamais retrouvée depuis le texte), le FAIT BRUT « ce message a été envoyé en réponse à cette émission » est
    // persisté (receptions) avec l'identité de la valeur du message de CE tour (observation.idMessage, déjà conservée). Sans référence : rien.
    // Référence invalide ou tour non observé : refus rendu dans `reception.echec`, tour intact. Aucune interprétation.
    const referenceEmission = (options && options.referenceEmission) || null;
    if (joint !== null && typeof joint === 'object' && !Array.isArray(joint) && referenceEmission && typeof referenceEmission.idEmission === 'string' && referenceEmission.idEmission.length > 0) {
      const e = await ecranLangage.assurerEsprit();
      const idDonnee = joint && joint.sollicitation && joint.sollicitation.observation ? joint.sollicitation.observation.idMessage : null;
      const declaree = await declarerReceptionConversation({ idDonnee, idEmission: referenceEmission.idEmission }, { magasin: e.magasin });
      // v0.63.86 — B2 : une réception DÉCLARÉE est une cause réelle pour la relation : observation interne → désignation soi:reception(etat, recu) →
      // variation r → 0 (relation.js). Le résultat est transmis tel quel à l'écran ; échec rendu dans `relation.echec`, jamais levé ; sans réception écrite : rien.
      let relation = null;
      if (declaree.reception) {
        try { relation = { ...(await consequenceReception(e.magasin, declaree.reception)), echec: null }; } catch (echecRelation) { relation = { echec: echecRelation }; }
      }
      return { ...joint, reception: { idEmission: referenceEmission.idEmission, idDonnee, reception: declaree.reception, echec: declaree.echec, relation } };
    }
    return joint;
  },
  // v0.63.35 — OUTIL DE DÉVELOPPEMENT : exécute exactement l'application que le bouton de CETTE bulle a transmise (observation, application, univers
  // du tour de la bulle). Aucune recherche, aucune relecture : la persistance et la table d'opérations ne sont connues que d'ici.
  surSollicitation: async ({ observation, application, univers }) => {
    const e = await ecranLangage.assurerEsprit();
    return executerApplicationSollicitee({ observation, application, univers }, { magasin: e.magasin, table: TABLE_OPERATIONS });
  },
  // v0.63.84 — B1 : lecture de l'état propre pour le bandeau (faits bruts) et tick de repos EXPLICITE (bouton « Repos » : dispositif de validation du
  // temps propre, pas une cadence). La sollicitation extérieure ci-dessus reste HORS B1 (décision C) : ni gatée, ni coûteuse.
  capacite: {
    lire: async () => {
      const e = await ecranLangage.assurerEsprit();
      const c = await lireCapacite(e.magasin);
      const r = await lireRelation(e.magasin);
      const besoins = await lireBesoins(e.magasin);
      return { besoins, valeur: c.valeur, plafond: PARAMETRES_B1.plafond, derniere: c.derniere, idEtat: c.idEtat, nombreVariations: c.nombreVariations, relation: { valeur: r.valeur, plafond: PARAMETRES_B2.plafond, derniere: r.derniere, idEtat: r.idEtat, nombreVariations: r.nombreVariations } };
    },
    repos: async () => {
      const e = await ecranLangage.assurerEsprit();
      return tickPropre(e.magasin);
    },
  },
  // Étape E — signal FACULTATIF, léger : « correct »/« incorrect » sur une expérience B1 précise
  // (identifiée par idExperience, porté par la réponse ci-dessus quand elle en a une). Jamais
  // déduit par comprendre()/repondre() ; confronte automatiquement toute attente déjà posée.
  surJugement: (idExperience, jugement) => ecranLangage.jugerExperience(idExperience, jugement),
  // CHANTIER « PREMIER BRANCHEMENT UI DE L'ACTE EXPLICITE » (décision ChatGPT, 03/10/2026) : MÊME
  // PRINCIPE EXACT que surJugement ci-dessus -- idTrace est déjà porté, de façon purement
  // additive, par le retour de repondre() ci-dessus (voies action/rejeu/composition, v0.61.3),
  // jamais recalculé ni recherché ici. Le bouton attaché à la bulle (conversation/ecran.js)
  // transmet l'idTrace capturé pour CETTE bulle précise, par fermeture.
  surActe: (idTrace) => ecranLangage.enregistrerActeExplicite(idTrace),
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
  // v0.17.15 — Sauvegarde complète : réutilise le MÊME magasin de langage que le laboratoire
  // (jamais une seconde copie de la base en mémoire), en s'assurant qu'il est ouvert au besoin.
  magasinLangage: async () => (await ecranLangage.assurerEsprit()).magasin,
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
