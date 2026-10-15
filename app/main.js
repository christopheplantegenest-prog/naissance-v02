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
import { nouvelId, ouvrirIndexedDB as ouvrirLangage, magasinMemoireVive as magasinLangageVive, enregistrerExperience as enregistrerExperienceReelle, ajouterInterpretation as ajouterInterpretationReelle, enregistrerObservationLangage as enregistrerObservationLangageReelle, rattacherObservationLangage as rattacherObservationLangageReelle, enregistrerObservationPossibilites as enregistrerObservationPossibilitesReelle, enregistrerValeurDonnee as enregistrerValeurDonneeReelle , enregistrerManifestationFait } from './langage/connaissances.js';
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
import { lireCapacite, tourActif, peutAgir, PARAMETRES_B1 } from './langage/capacite.js';
// v0.63.86 — B2 : état relationnel (lecture pour le bandeau ; conséquence d'une réception déclarée) et tick propre à deux conséquences (tick-propre.js).
// Aucune orientation : r n'est lu par aucun mécanisme de décision. Voir relation.js.
import { lireRelation, consequenceReception, PARAMETRES_B2 } from './langage/relation.js';
// v0.63.87 — besoins déclarés : motif actuel et moyens connus, LECTURE PURE pour l'affichage (aucune initiative, aucun choix, aucune émission).
import { lireBesoins } from './langage/besoins.js';
// v0.63.88 — épisode propre : après qu'un événement réel (tick, message, réception) a écrit ses conséquences, l'occasion est calculée et, s'il y a lieu,
// un épisode propre est ouvert (observation propre → évaluation → engagement d'un candidat UNIQUE autorisé → coût → émission). Jamais au chargement.
import { traiterOccasion, lireDernierEpisode, lireDernierEvenement } from './langage/episode-propre.js';

// v0.63.88 — après un TOUR (message extérieur), les événements réels de ce geste sont traités dans l'ordre où leurs conséquences ont été écrites :
// l'observation du message (cause du coût B1 du tour mécanique) puis la réception déclarée (cause de r → 0). Chacun ouvre AU PLUS une occasion
// (occasion.js) ; les épisodes ouverts sont joints au résultat pour l'écran. Un échec est rendu, jamais levé : le tour reste intact.
async function apresEvenements(joint) {
  if (joint === null || typeof joint !== 'object' || Array.isArray(joint)) return joint;
  const evenements = [];
  if (joint.sollicitation && joint.sollicitation.observation && typeof joint.sollicitation.observation.id === 'string') evenements.push(joint.sollicitation.observation.id);
  if (joint.reception && joint.reception.reception && typeof joint.reception.reception.id === 'string') evenements.push(joint.reception.reception.id);
  if (evenements.length === 0) return joint;
  const e = await ecranLangage.assurerEsprit();
  const episodes = [];
  for (const evenement of evenements) {
    try { episodes.push(await traiterOccasion(e.magasin, evenement)); } catch (echec) { episodes.push({ evenement, statut: 'echec', echec }); }
  }
  return { ...joint, episodes };
}
import { tickPropre } from './langage/tick-propre.js';
import { TABLE_OPERATIONS } from './langage/table-operations.js';
import { composerApresVecu } from './langage/vecu.js';
import { extraireLecon, apercuLecon, TYPES_LECON } from './langage/lecon.js';
import { estEnseignementNaturel, interpreterEnseignement, reconnaitreAffirmationPossessive } from './langage/interpretation.js';
import { examinerFormeApresSupervision, confirmerFormeSupervisee, refuserFormeSupervisee } from './langage/formes-confirmees.js'; // v0.64.17
import { extraireReponseAttendue, examinerReponseApresSupervision } from './langage/reponses-attendues.js'; // v0.64.19
import { examinerCorrectionApresSupervision, confirmerFormeCorrection, refuserFormeCorrection, reconnaitreCorrection } from './langage/corrections-apprises.js'; // v0.64.20
import { divergencesDeReponses, historiqueDesAppuis, notesHistoire } from './langage/divergences.js'; // v0.64.21
import { lireLignesDivergences } from './langage/connaissances.js'; // v0.64.21
import { localiserDivergences, notesLocalisation } from './langage/divergences-localisees.js'; // v0.64.23
import { examinerResolution, memeProposition, notesResolution, notesActes } from './langage/resolutions.js'; // v0.64.24 // v0.64.25 — + notesActes (vue pure des actes vécus)
import { experiencesSitueesDeResolution } from './langage/experiences-situees.js'; // N3b-0 — relecture située des propositions vécues, pour le Diagnostic SEULEMENT
import { enregistrerPropositionResolution, enregistrerIssueResolution, lireActesResolution } from './langage/connaissances.js'; // v0.64.25 — proposition vécue, issue annulee/perimee ; lecture pour les notes seulement
import { resoudreIncompatibilite } from './langage/esprit.js'; // v0.64.24 — fait + manifestation de résolution, ou rien
import { enregistrerReponseLocale } from './langage/connaissances.js'; // v0.64.22
import { enregistrerReponseAttendue } from './langage/connaissances.js'; // v0.64.19
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
// v0.64.13 — ligne FACULTATIVE « Constantes : nom = valeur, … » juste après « Rôles : » (même voie technique ; aucune syntaxe naturelle).
const MOT_CONSTANTES_ACTION = /^constantes\s*:\s*(.+)$/i;
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
  // v0.64.13 — constantes facultatives : chaque élément « nom = valeur » ; un élément mal formé ou un nom répété refuse la leçon (rien n'est deviné).
  let constantes;
  let debutExemples = 2;
  const mConstantes = lignes[2] ? lignes[2].match(MOT_CONSTANTES_ACTION) : null;
  if (mConstantes) {
    constantes = {};
    for (const morceau of mConstantes[1].split(',').map((c) => c.trim()).filter(Boolean)) {
      const m = morceau.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (!m || Object.prototype.hasOwnProperty.call(constantes, m[1].trim())) {
        actionEnAttente = null;
        return { texte: 'Il me faut une ligne « Constantes : <nom> = <valeur>, ... » (chaque nom une seule fois).' };
      }
      constantes[m[1].trim()] = m[2].trim();
    }
    debutExemples = 3;
  }
  const exemples = lignes.slice(debutExemples);
  const resultat = evaluerAction({ operation, roles, exemples, ...(constantes !== undefined ? { constantes } : {}) });
  if (!resultat.ok) {
    actionEnAttente = null;
    return { texte: `Je ne peux pas retenir cette action : ${resultat.detail}` };
  }
  actionEnAttente = {
    candidat: {
      operation, roles: resultat.roles, n: resultat.n, exemples: resultat.exemples, statut: resultat.statut,
      ...(resultat.constantes !== undefined ? { constantes: resultat.constantes } : {}),
    },
  };
  const apercu = resultat.exemples.map((e) => `  ${e.entree}`).join('\n');
  const noteStatut = resultat.statut === 'incertaine'
    ? "\n\nATTENTION : avec ces seuls exemples, je ne peux pas encore distinguer tous les rôles les uns des autres. Je la garderai INCERTAINE (jamais utilisée pour répondre) tant que des exemples supplémentaires ne lèveront pas ce doute."
    : '';
  return {
    texte: `Voici ce que je propose de retenir comme action « ${operation} », rôles [${roles.join(', ')}]${resultat.constantes !== undefined ? `, constantes [${Object.entries(resultat.constantes).map(([k, v]) => `${k} = ${v}`).join(', ')}]` : ''}, à partir de :\n${apercu}${noteStatut}\n\n`
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
// v0.64.14 — « CONSERVER L'EXPÉRIENCE D'UN FAIT CONFIRMÉ » (GO ChatGPT, 14/10/2026) : `source` (facultatif) = { idMessage, voie }, la provenance
// STRUCTURÉE de la proposition, transmise explicitement par l'appelant (traiterTour) : l'identité message-N du tour (jamais recherchée par le texte
// ni « le dernier message ») et la voie qui a produit la proposition. Absente (message non identifié) : aucune manifestation, rien d'autre ne change.
// POINT D'ÉCRITURE : dans onOui, APRÈS que ecrireConnaissance a rendu un fait réellement accepté (r.type === 'fait', aucune exception : un refus
// d'apprendreFait — conflit — lève avant). Annuler (onNon) et l'absence de réponse n'atteignent jamais ce point. Écriture additive : son échec
// éventuel ne change ni la réponse, ni le journal, ni le fait appris.
function sourceProposition(message, voie) {
  return message && typeof message.id === 'string' && message.id.length > 0 ? { idMessage: message.id, voie } : null;
}
// v0.64.15 — « RÉFÉRENCE EXPLICITE À UN MESSAGE NATUREL » (GO ChatGPT « v0.64.15 », 14/10/2026) : `referenceMessage` (facultatif) = { idMessage }
// d'un message NATUREL M, choisi par le geste « Répondre » de Christophe sur SA bulle (conversation/ecran.js, options.referenceMessage), jamais
// retrouvé par le texte, l'ordre ou la proximité. Admissible seulement si c'est une identité non vide, différente du message de CE tour (aucune
// auto-référence). Seule la branche « Apprends : Fait : … » la transmet à proposerLecon ; partout ailleurs elle est ignorée.
function referenceSupervisee(options, message) {
  const ref = options && options.referenceMessage;
  if (!ref || typeof ref.idMessage !== 'string' || ref.idMessage.length === 0) return null;
  if (message && ref.idMessage === message.id) return null;
  return { idMessage: ref.idMessage };
}
// v0.64.15 — l'identité du message RÉELLEMENT conservé de ce tour (sa valeur brute écrite), exposée à la bulle de Christophe pour le geste « Répondre ».
// Aucune identité si la conservation a échoué ; un résultat non objet traverse inchangé.
function avecIdMessage(resultat, idMessage) {
  if (typeof idMessage !== 'string' || idMessage.length === 0) return resultat;
  if (resultat === null || typeof resultat !== 'object' || Array.isArray(resultat)) return resultat;
  return { ...resultat, idMessage };
}
// v0.64.15 — `referenceMessage` (facultatif) : { idMessage } admis par referenceSupervisee. Après la manifestation de la leçon L (source), la
// manifestation SUPERVISÉE de M est TENTÉE ensuite, dans le même onOui : { idMessage: M, fait identique, voie: { nom: 'reference-explicite',
// idLecon: L } }. enregistrerManifestationFait la refuse si la ligne L n'existe pas avec ce même fait (jamais M sans L), si M a déjà sa
// manifestation (immuable), ou si L = M. Échec additif, jamais bloquant, jamais visible (même discipline que la v0.64.14).
function proposerLecon(texte, extrait, contenuLecon, source = null, referenceMessage = null) {
  const dateQuestion = new Date().toISOString();
  return {
    texte: apercuLecon(extrait),
    confirmation: {
      onOui: async () => {
        let reponseFinale;
        let propositionForme = null; // v0.64.17 — proposition de RÈGLE née de CETTE supervision (voir propositionDeForme), ou rien
        try {
          const e = await ecranLangage.assurerEsprit();
          const r = await ecranLangage.ecrireConnaissance(e, extrait, { origine: 'apprise-conversation', exemple: contenuLecon });
          reponseFinale = r.explication;
          if (source && r && r.type === 'fait' && r.objet) {
            try {
              await enregistrerManifestationFait(e.magasin, { idMessage: source.idMessage, fait: { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur }, voie: source.voie });
            } catch { /* manifestation : additive, jamais bloquante, jamais visible */ }
            if (referenceMessage) {
              let supervisionEcrite = false;
              try {
                await enregistrerManifestationFait(e.magasin, { idMessage: referenceMessage.idMessage, fait: { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur }, voie: { nom: 'reference-explicite', idLecon: source.idMessage } });
                supervisionEcrite = true;
              } catch { /* manifestation supervisée : additive, jamais bloquante, jamais visible */ }
              // v0.64.17 — SEUL déclencheur causal : la manifestation supervisée de M vient d'être RÉELLEMENT écrite. Échec : aucune proposition.
              if (supervisionEcrite) {
                try { propositionForme = await propositionDeForme(referenceMessage.idMessage); } catch { propositionForme = null; }
              }
            }
          }
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
        // v0.64.17 — le fait reste confirmé et affiché tel quel ; la proposition de règle, s'il y en a une, est une SECONDE bulle distincte.
        return propositionForme ? { texte: reponseFinale, proposition: propositionForme } : reponseFinale;
      },
      onNon: async () => {
        const reponseFinale = "D'accord, je n'ai rien retenu.";
        await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
    },
  };
}

// v0.64.17 — « CONFIRMER UNE FORME INDUITE ET LA RENDRE ACTIVE » (GO ChatGPT « v0.64.17 », 14/10/2026). Après l'écriture réussie de la
// manifestation supervisée de M, examine la SEULE famille dont M est membre (formes-confirmees.js, rien n'est écrit) ; si une règle compatible
// et jamais décidée apparaît, la propose : { texte, confirmation }. Confirmer = la RÈGLE (généralisation, constante, activation) : Action
// proposerFait validée d'origine induite-supervisee puis décision 'confirmee' ; les actions de l'esprit sont relues pour qu'elle serve dès ce
// tour. Refuser = UNE écriture, la décision 'refusee'. Jamais confondu avec la confirmation d'un fait : autre fonction, autre libellé (Refuser).
async function propositionDeForme(idMessage) {
  const e = await ecranLangage.assurerEsprit();
  const examen = await examinerFormeApresSupervision(e.magasin, idMessage);
  if (!examen.proposition) return null;
  const proposition = examen.proposition;
  const dateQuestion = new Date().toISOString();
  return {
    texte: proposition.texte,
    confirmation: {
      libelleNon: 'Refuser',
      onOui: async () => {
        let reponseFinale;
        try {
          const esp = await ecranLangage.assurerEsprit();
          const { action } = await confirmerFormeSupervisee(esp.magasin, proposition);
          esp.actions = await esp.magasin.lireTout('actions');
          reponseFinale = action && action.statut === 'validee'
            ? "C'est noté : je comprendrai désormais cette forme de phrase, et je te proposerai le fait correspondant."
            : "Je n'ai pas pu rendre cette forme active.";
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(proposition.texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
      onNon: async () => {
        let reponseFinale;
        try {
          const esp = await ecranLangage.assurerEsprit();
          await refuserFormeSupervisee(esp.magasin, proposition);
          reponseFinale = "D'accord : je ne retiens pas cette forme. Tes exemples restent tels quels.";
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(proposition.texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
    },
  };
}

// v0.64.19 — « APPRENDRE À UTILISER UNE CONNAISSANCE PAR LA RÉPONSE ATTENDUE » (GO ChatGPT « v0.64.19 », 14/10/2026). « Apprends : Réponse : R. »
// n'est admis QU'AVEC une référence explicite valide (referenceSupervisee : le message naturel choisi par « Répondre », jamais retrouvé par le
// texte ni « le dernier message ») et un message de leçon identifié. Aperçu + Confirmer / Annuler ; SEULE écriture (onOui) : la réponse attendue
// { idMessage: M, reponse: R, idLecon: L } (connaissances.js, immuable). Ce n'est pas un fait : rien d'autre n'est écrit. Ensuite SEULEMENT,
// l'inducteur (reponses-attendues.js) est consulté pour M ; une forme de question éventuelle est une SECONDE bulle (Confirmer / Refuser).
function proposerReponseAttendue(texte, reponse, message, reference) {
  if (!reponse) return { texte: 'Il me faut la réponse attendue après « Réponse : ».' };
  if (!reference) return { texte: 'Pour m\'apprendre une réponse attendue, appuie d\'abord sur « Répondre » sous ta question, puis envoie « Apprends : Réponse : … ». Je n\'ai rien retenu.' };
  if (!message || typeof message.id !== 'string' || message.id.length === 0) return { texte: 'Je n\'ai pas pu identifier ce message : je n\'ai rien retenu.' };
  const dateQuestion = new Date().toISOString();
  return {
    texte: `J'ai compris : la réponse attendue à ton message est « ${reponse} ». C'est correct ?`,
    confirmation: {
      onOui: async () => {
        let reponseFinale;
        let propositionQuestion = null;
        try {
          const e = await ecranLangage.assurerEsprit();
          await enregistrerReponseAttendue(e.magasin, { idMessage: reference.idMessage, reponse, idLecon: message.id });
          reponseFinale = `J'ai retenu : la réponse attendue à ton message est « ${reponse} ».`;
          // v0.64.20 — question naturelle (v0.64.19) OU réaction en situation (forme de correction) : au plus un des deux inducteurs répond.
          try { propositionQuestion = (await propositionDeReponse(reference.idMessage)) || (await propositionDeCorrection(reference.idMessage)); } catch { propositionQuestion = null; }
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
        return propositionQuestion ? { texte: reponseFinale, proposition: propositionQuestion } : reponseFinale;
      },
      onNon: async () => {
        const reponseFinale = "D'accord, je n'ai rien retenu.";
        await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
    },
  };
}

// v0.64.19 — proposition d'une FORME DE QUESTION induite (reponses-attendues.js, rien n'est écrit). Confirmer / Refuser : les MÊMES fonctions que
// pour une forme de fait (Action validée d'origine induite-supervisee + décision 'confirmee', ou décision 'refusee'), autre message de retour.
async function propositionDeReponse(idMessage) {
  const e = await ecranLangage.assurerEsprit();
  const examen = await examinerReponseApresSupervision(e.magasin, e, idMessage);
  if (!examen.proposition) return null;
  const proposition = examen.proposition;
  const dateQuestion = new Date().toISOString();
  return {
    texte: proposition.texte,
    confirmation: {
      libelleNon: 'Refuser',
      onOui: async () => {
        let reponseFinale;
        try {
          const esp = await ecranLangage.assurerEsprit();
          const { action } = await confirmerFormeSupervisee(esp.magasin, proposition);
          esp.actions = await esp.magasin.lireTout('actions');
          reponseFinale = action && action.statut === 'validee'
            ? "C'est noté : je répondrai désormais moi-même à cette forme de question."
            : "Je n'ai pas pu rendre cette forme active.";
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(proposition.texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
      onNon: async () => {
        let reponseFinale;
        try {
          const esp = await ecranLangage.assurerEsprit();
          await refuserFormeSupervisee(esp.magasin, proposition);
          reponseFinale = "D'accord : je ne retiens pas cette forme. Tes exemples restent tels quels.";
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(proposition.texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
    },
  };
}

// v0.64.23 — + lignes de localisation (divergences-localisees.js), après les notes d'histoire inchangées.
// v0.64.21 — notes d'histoire des connaissances qui ressortent : divergences (vue pure sur lignes persistées) dont les appuis HISTORIQUES
// contiennent l'un des appuis de la réponse actuelle. N'écrit rien ; tout échec → aucune note (jamais bloquant).
async function notesDesAppuis(appuis) {
  if (!Array.isArray(appuis) || appuis.length === 0) return [];
  try {
    const e = await ecranLangage.assurerEsprit();
    const lignes = await lireLignesDivergences(e.magasin);
    const divergences = divergencesDeReponses(lignes);
    // v0.64.23 — + une ligne SÉPARÉE par divergence localisée de ces appuis (projection déclarée et vérifiée ; portée sur l'identité). Vue pure.
    // v0.64.25 — actes vécus (actesResolution) : lus ICI, pour la vue seulement ; un échec de lecture laisse les notes .24 intactes (aucun acte).
    let actes = [];
    try { actes = await lireActesResolution(e.magasin); } catch { actes = []; }
    return [...notesHistoire(historiqueDesAppuis(appuis, divergences)), ...notesLocalisation(appuis, localiserDivergences({ divergences, traces: lignes.traces })),
      ...notesResolution(appuis, lignes, actes), // v0.64.24 — + lien de résolution, seulement si le fait résultant EST l'appui actuel (vue pure) ; v0.64.25 — une seule ligne si l'acte est confirmé
      ...notesActes(appuis, actes)]; // v0.64.25 — proposition ouverte/annulée dont l'ancien EST un appui actuel
  } catch { return []; }
}

// v0.64.20 — « APPRENDRE LA FORME D'UNE CORRECTION NATURELLE ». Proposition d'une FORME DE CORRECTION induite (corrections-apprises.js, rien n'est
// écrit). Confirmer = la décision 'confirmee' qui porte la règle (ce n'est pas une Action) ; Refuser = la décision 'refusee'.
async function propositionDeCorrection(idMessage) {
  const e = await ecranLangage.assurerEsprit();
  const examen = await examinerCorrectionApresSupervision(e.magasin, idMessage);
  if (!examen.proposition) return null;
  const proposition = examen.proposition;
  const dateQuestion = new Date().toISOString();
  return {
    texte: proposition.texte,
    confirmation: {
      libelleNon: 'Refuser',
      onOui: async () => {
        let reponseFinale;
        try {
          const esp = await ecranLangage.assurerEsprit();
          await confirmerFormeCorrection(esp.magasin, proposition);
          reponseFinale = "C'est noté : quand tu répondras ainsi à l'une de mes réponses, je te proposerai de retenir la réponse attendue.";
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(proposition.texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
      onNon: async () => {
        let reponseFinale;
        try {
          const esp = await ecranLangage.assurerEsprit();
          await refuserFormeCorrection(esp.magasin, proposition);
          reponseFinale = "D'accord : je ne retiens pas cette forme. Tes exemples restent tels quels.";
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(proposition.texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
    },
  };
}

// v0.64.20 — correction COMPRISE par une forme apprise, dans sa situation : aperçu seulement. SEULE écriture (onOui) : la réponse attendue de la
// QUESTION corrigée { idMessage: question, reponse, idLecon: ce message } (connaissances.js, immuable). Aucun fait, aucune Action, aucune capacité.
// v0.64.24 — « PROPOSER LA RÉSOLUTION D'UNE INCOMPATIBILITÉ VÉCUE ». La proposition voyage par FERMETURE (données structurées, jamais relues
// dans le texte affiché) ; rien n'est écrit avant Confirmer. Confirmer : garde de PÉREMPTION (l'examen est refait sur les lignes et l'esprit
// actuels et doit rendre exactement la même proposition), puis apprentissage du fait par le chemin normal (ecrireConnaissance → apprendreFait,
// remplacement en place sous cleFait), puis SEULEMENT si le fait est accepté, la manifestation de résolution (voie 'resolution', idReponseAttendue).
// Annuler : aucune écriture cognitive, aucune marque de refus.
// v0.64.25 — « LA PROPOSITION DE RÉSOLUTION DEVIENT UN ACTE VÉCU ». La proposition p a été ÉCRITE (actesResolution, ligne proposition) avant
// d'arriver ici. Confirmer : fait + manifestation + issue confirmee, UNE écriture atomique (resoudreIncompatibilite) ; péremption CONSTATÉE au
// clic : issue perimee + raison structurelle (aucune surveillance des propositions ouvertes). Annuler : issue annulee SEULE (aucun fait touché,
// aucune interprétation). Silence : aucune issue (la proposition reste ouverte, même après redémarrage).
function proposerResolution(p) {
  const texte = `Sous ${p.ancien.sujet} → ${p.ancien.relation}, je connais ${p.ancien.valeur} ; tu attendais ${p.nouveau.valeur}. Les deux ne peuvent pas coexister. Veux-tu que je retienne ${p.nouveau.sujet} → ${p.nouveau.relation} → ${p.nouveau.valeur} à la place de ${p.ancien.valeur} ?`;
  const dateQuestion = new Date().toISOString();
  return {
    texte,
    confirmation: {
      onOui: async () => {
        let reponseFinale;
        try {
          const e = await ecranLangage.assurerEsprit();
          const examen = examinerResolution(await lireLignesDivergences(e.magasin), e, p.idReponseAttendue);
          if (!examen.proposition || !memeProposition(examen.proposition, p)) {
            reponseFinale = `Cette proposition n'est plus valable : ce que je sais sous ${p.ancien.sujet} → ${p.ancien.relation} a changé depuis. Je n'ai rien modifié.`;
            try {
              await enregistrerIssueResolution(e.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'perimee', raison: examen.proposition ? 'proposition-differente' : examen.raison });
            } catch { reponseFinale += " Je n'ai pas pu noter ce constat."; }
          } else {
            // ATOMICITÉ (v0.64.24) : fait remplacé ET manifestation de résolution, ou rien (resoudreIncompatibilite, esprit.js).
            try {
              await resoudreIncompatibilite(e, { fait: { ...p.nouveau }, manifestation: { idMessage: p.idMessage, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } } });
              reponseFinale = `J'ai retenu ${p.nouveau.sujet} → ${p.nouveau.relation} → ${p.nouveau.valeur} à la place de ${p.ancien.valeur}, comme résolution de ta correction de « ${p.question === null ? '(question introuvable)' : p.question} ».`;
            } catch (err) {
              reponseFinale = `Je n'ai rien modifié : ${err.message}`;
            }
          }
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
      onNon: async () => {
        let reponseFinale;
        try {
          const e = await ecranLangage.assurerEsprit();
          await enregistrerIssueResolution(e.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'annulee' });
          reponseFinale = `D'accord, je garde ${p.ancien.sujet} → ${p.ancien.relation} → ${p.ancien.valeur}.`;
        } catch { reponseFinale = `Je n'ai pas pu noter ton annulation. Rien d'autre n'a changé : je garde ${p.ancien.sujet} → ${p.ancien.relation} → ${p.ancien.valeur}.`; }
        await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
        return reponseFinale;
      },
    },
  };
}

// v0.64.24 — après l'écriture RÉELLE de la réponse attendue (et seulement elle), examen de la résolution (resolutions.js, vue pure) : si une
// incompatibilité vécue sur un appui encore actuel en découle, une SECONDE bulle propose la résolution. Échec d'examen : aucune proposition.
function proposerReponseCorrigee(texte, correction, message) {
  const dateQuestion = new Date().toISOString();
  return {
    texte: `J'ai compris : la réponse attendue à ta question « ${correction.question} » est « ${correction.reponse} ». C'est correct ?`,
    confirmation: {
      onOui: async () => {
        let reponseFinale;
        let resolution = null;
        try {
          const e = await ecranLangage.assurerEsprit();
          await enregistrerReponseAttendue(e.magasin, { idMessage: correction.idQuestion, reponse: correction.reponse, idLecon: message.id });
          reponseFinale = `J'ai retenu : la réponse attendue à ta question « ${correction.question} » est « ${correction.reponse} ».`;
          try {
            const examen = examinerResolution(await lireLignesDivergences(e.magasin), e, correction.idQuestion);
            // v0.64.25 — la proposition est ÉCRITE (acte vécu) AVANT d'être remise à l'interface ; échec d'écriture → aucune bulle de proposition.
            if (examen.proposition) {
              await enregistrerPropositionResolution(e.magasin, examen.proposition);
              resolution = proposerResolution(examen.proposition);
            }
          } catch { resolution = null; }
        } catch (err) { reponseFinale = err.message; }
        await journaliserEchangeLaboratoire(texte, reponseFinale, dateQuestion);
        return resolution ? { texte: reponseFinale, proposition: resolution } : reponseFinale;
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
// v0.64.14 — + `message` : { id: message-N, texte }, tel que traiterTourAvecEnonce (pont.js) le transmet à `traiter` ; null s'il n'a pas pu être identifié.
// Il ne sert QU'À porter l'identité du message jusqu'à proposerLecon (sourceProposition) ; aucune autre branche ne le lit.
// v0.64.22 — `referenceCible` (facultatif) : la CIBLE de la réaction ({ idTrace?, idReponseLocale? }) ; `referenceTrace` reste la référence
// d'INVOCATION (trace seule), lue telle quelle par les consommateurs qui parlent réellement d'une invocation (observation, expérience).
async function traiterTour(texte, options, referenceTrace, message = null, referenceCible = referenceTrace) {
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
      return proposerLecon(texte, r.extrait, r.phrase, sourceProposition(message, { nom: 'apprends-que' }));
    }
    if (MARQUEUR_APPRENTISSAGE.test(texte)) {
      const contenuLecon = texte.replace(MARQUEUR_APPRENTISSAGE, '').trim();
      // v0.64.19 — « Apprends : Réponse : … » : réponse attendue au message naturel EXPLICITEMENT référencé (Répondre), jamais une leçon de fait.
      const reponseAttendue = extraireReponseAttendue(contenuLecon);
      if (reponseAttendue) return proposerReponseAttendue(texte, reponseAttendue.reponse, message, referenceSupervisee(options, message));
      const extrait = extraireLecon(contenuLecon);
      if (!extrait) {
        const formes = Object.values(TYPES_LECON).map((f) => `\n• ${f}`).join('');
        return { texte: `Je ne reconnais pas cette forme de leçon. Les formes que je comprends sont :${formes}` };
      }
      // v0.64.15 — seule une leçon de FAIT transmet la référence explicite à un message naturel (toute autre leçon l'ignore).
      return proposerLecon(texte, extrait, contenuLecon, sourceProposition(message, { nom: 'lecon-technique' }), extrait.type === 'fait' ? referenceSupervisee(options, message) : null);
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
    // v0.64.20 — FORME DE CORRECTION APPRISE : examinée SEULEMENT si ce message est une réaction (Répondre) à une réponse de Naissance ET qu'il est
    // identifié ; reconnaitreCorrection exige en plus la situation persistée (énoncé de CE message → trace action → question). Rien n'est écrit
    // ici : seulement un aperçu ; échec ou absence de forme → pipeline inchangé.
    // v0.64.22 — même examen pour toute CIBLE de réaction (trace historique ou réponse locale) : la situation est lue dans les lignes persistées.
    if (referenceCible && message && typeof message.id === 'string' && message.id.length > 0) {
      let correction = null;
      try {
        const e = await ecranLangage.assurerEsprit();
        correction = await reconnaitreCorrection(e.magasin, { idMessage: message.id, texte });
      } catch { correction = null; }
      if (correction && correction.reconnue) return proposerReponseCorrigee(texte, correction, message);
    }
    // v0.64.20 — + l'identité de la question de ce tour, portée par la trace d'une réponse locale (lien question → réponse).
    const reconnaissanceAction = await ecranLangage.tenterReconnaissanceAction(texte, message && typeof message.id === 'string' ? message.id : undefined);
    // v0.64.13 — « UNE FORME APPRISE PEUT PROPOSER UN FAIT » (autorisation ChatGPT « v0.64.13 », 14/10/2026) : une action apprise VALIDÉE de
    // capacité proposerFait, reconnue SANS ambiguïté, a produit une STRUCTURE de fait (rien n'est écrit). Même garde que J1a : aller-retour
    // extraireLecon, puis le canal existant proposerLecon (aperçu + bouton Confirmer, seule écriture : apprendreFait). Structure incomplète
    // ou aller-retour impossible → abstention locale. Ce bloc est AVANT reconnaitreAffirmationPossessive (J1a) : une forme apprise reconnue,
    // ou une ambiguïté entre formes (abstention ci-dessous, inchangée), n'atteint jamais J1a.
    // v0.64.18 — le raccord vaut pour TOUTE capacité que le registre déclare `proposeFait: true` (proposerFait, proposerFaitComplet) :
    // ecran.js transmet ce booléen, aucun nom de capacité n'est comparé ici.
    if (reconnaissanceAction.reconnu && reconnaissanceAction.ok && reconnaissanceAction.proposeFait === true) {
      const proposition = reconnaissanceAction.resultat;
      const d = proposition && proposition.type === 'fait' ? proposition.donnees : null;
      const phraseFait = d ? `Fait : ${d.sujet} / ${d.relation} / ${d.valeur}.` : null;
      const extraitFait = phraseFait ? extraireLecon(phraseFait) : null;
      const fidele = extraitFait && extraitFait.type === 'fait' && extraitFait.donnees.sujet === d.sujet
        && extraitFait.donnees.relation === d.relation && extraitFait.donnees.valeur === d.valeur;
      if (!fidele) return { texte: 'Cette formulation correspond à une forme apprise, mais je ne parviens pas à en tirer un fait proprement : je n\'ai rien proposé.', local: true };
      return { ...proposerLecon(texte, extraitFait, phraseFait, sourceProposition(message, { nom: 'forme-apprise', idAction: reconnaissanceAction.idAction })), voieProposition: 'forme-apprise' };
    }
    if (reconnaissanceAction.reconnu) {
      // v0.63 — « EXPOSER L'IDENTITÉ DE LA TRACE PRODUITE PAR UN TOUR » (décision ChatGPT,
      // 03/10/2026) : transport ADDITIF, jamais une recherche -- reconnaissanceAction.idTrace est
      // déjà, par construction, l'id de LA trace que CE tour vient réellement de créer (présent
      // uniquement en cas de succès réel, voir ecran.js). Reste DORMANT : aucun consommateur ici.
      if (!reconnaissanceAction.ok) return { texte: `Je ne peux pas répondre localement à partir de cette formulation : ${reconnaissanceAction.detail}` };
      // v0.64.21 — la réponse reste celle de l'Action ; si ses appuis ont une histoire de divergence, une note SÉPARÉE la signale.
      const notesAction = await notesDesAppuis(reconnaissanceAction.appuis);
      // v0.64.22 — + l'identité de la réponse locale (si la capacité en a produit une), cible du geste Répondre de cette bulle.
      return { texte: reconnaissanceAction.texte, local: true, ...(reconnaissanceAction.idTrace !== undefined ? { idTrace: reconnaissanceAction.idTrace } : {}), ...(reconnaissanceAction.idReponseLocale !== undefined ? { idReponseLocale: reconnaissanceAction.idReponseLocale } : {}), ...(notesAction.length ? { actions: notesAction } : {}) };
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

    // v0.64.12 — J1a « ENSEIGNEMENT NATUREL CONFIRMÉ » (décision ChatGPT « MISSION DE DÉVELOPPEMENT v0.64.12 — J1 », 14/10/2026) : APRÈS les
    // marqueurs explicites, les squelettes appris et le rejeu (rien de déjà appris n'est préempté), AVANT le pont local et le repli conversationnel.
    // Une affirmation possessive ordinaire et suffisamment déterminée (« Mon chien s'appelle Rex. », langage/interpretation.js) devient une
    // PROPOSITION de leçon, par le canal existant proposerLecon (aperçu + Confirmer / Annuler) : rien n'est écrit avant le bouton Confirmer, aucun
    // modèle externe n'est appelé. Toute autre phrase (refus silencieux, ou mémoire du langage indisponible) suit EXACTEMENT le flux antérieur.
    {
      let espritAffirmation = null;
      try { espritAffirmation = await ecranLangage.assurerEsprit(); } catch { espritAffirmation = null; }
      const affirmation = espritAffirmation ? reconnaitreAffirmationPossessive(texte, { lexique: espritAffirmation.lexique }) : null;
      if (affirmation && affirmation.ok) return proposerLecon(texte, affirmation.extrait, affirmation.phrase, sourceProposition(message, { nom: 'j1a' }));
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
      // v0.64.22 — réponse locale de la voie repondre : identité de la question de CE tour (jamais retrouvée) et écriture persistante.
      idQuestion: message && typeof message.id === 'string' ? message.id : null,
      enregistrerReponseLocale: async (donnees) => {
        const e = await ecranLangage.assurerEsprit();
        return enregistrerReponseLocale(e.magasin, donnees);
      },
      observer: sansObservation ? null : async (t, resultat, ref) => {
        poigneeObservation = await observateurLangage(t, resultat, ref);
        return poigneeObservation;
      },
    });
    if (local && local.local) {
      const msg = await traiterPropositionSpontanee(local.propositionSpontanee);
      // v0.64.21 — même note d'histoire pour la voie repondre (appui = le fait qui a produit la réponse) ; la réponse elle-même est inchangée.
      const notesLocales = await notesDesAppuis(local.appuis);
      const actionsLocales = [...(local.actions || []), ...notesLocales, ...(msg ? [msg] : [])];
      return actionsLocales.length ? { ...local, actions: actionsLocales } : local;
    }
    // v0.64.21 — O6 : une réaction EXPLICITE (Répondre) à une réponse locale de Naissance que le moteur propre n'a pas comprise reste locale :
    // aucune transmission au modèle externe (règle STRUCTURELLE : la seule présence de la référence de trace, jamais le contenu du texte).
    // L'énoncé est déjà conservé (pont.js). Hors Répondre : chemin ci-dessous inchangé.
    // v0.64.22 — O6 ÉTENDU : toute CIBLE réelle (trace historique ou réponse locale), critère purement structurel.
    if (referenceCible && ((typeof referenceCible.idTrace === 'string' && referenceCible.idTrace.length > 0) || (typeof referenceCible.idReponseLocale === 'string' && referenceCible.idReponseLocale.length > 0))) {
      return { texte: 'Je garde ta réaction à ma réponse, mais je ne sais pas encore ce qu\'elle signifie.', local: true };
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
    // v0.64.22 — référence à une RÉPONSE LOCALE ({ idReponseLocale }, geste Répondre sur une bulle qui en porte une), donnée structurée jamais
    // retrouvée depuis le texte. La CIBLE de la réaction réunit les deux identités réelles disponibles ; la référence d'invocation reste la trace.
    const idReponseLocaleRef = options && options.referenceReponseLocale && typeof options.referenceReponseLocale.idReponseLocale === 'string' && options.referenceReponseLocale.idReponseLocale.length > 0
      ? options.referenceReponseLocale.idReponseLocale : null;
    const referenceCible = (referenceTrace || idReponseLocaleRef)
      ? { ...(referenceTrace && typeof referenceTrace.idTrace === 'string' ? { idTrace: referenceTrace.idTrace } : {}), ...(idReponseLocaleRef ? { idReponseLocale: idReponseLocaleRef } : {}) }
      : null;
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
        // v0.63.88 — la porte B1 commune (capacite.js : peutAgir), même définition que celle de l'épisode propre.
        const porte = !peutAgir(capaciteAvant);
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
    // v0.64.15 — identité du message de CE tour, notée SEULEMENT après sa conservation réelle (enregistrerValeur ci-dessous) ; exposée à la bulle.
    let idMessageConserve = null;
    const resultat = await traiterTourAvecEnonce(texte, referenceCible, {
      // v0.64.20 — + l'identité du message porteur de l'énoncé (fournie par pont.js seulement si sa valeur a été conservée).
      // v0.64.22 — + la réponse locale ciblée (4e argument, seulement si la référence en porte une).
      enregistrerEnonce: (idTrace, texteEnonce, idMessageEnonce, idReponseLocaleEnonce) => ecranLangage.enregistrerEnonceSurTrace(idTrace, texteEnonce, idMessageEnonce, idReponseLocaleEnonce),
      // v0.64.14 — le message identifié (message-N) que pont.js passait déjà à `traiter` n'est plus ignoré : il est transmis à traiterTour.
      traiter: (message) => traiterTour(texte, options, referenceTrace, message, referenceCible),
      nouvelId,
      // v0.63.16 — observation des possibilités au moment vécu : écrite AVANT la capture d'énoncé et le traitement (voir pont.js).
      observerPossibilites: suivi.observer,
      // v0.63.27 — valeur brute du message conservée sous SON identité, AVANT l'observation (échec : pas d'observation, le tour continue).
      enregistrerValeur: async (entree) => {
        const e = await ecranLangage.assurerEsprit();
        const conservee = await enregistrerValeurDonneeReelle(e.magasin, entree);
        idMessageConserve = entree.id;
        return conservee;
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
      return avecIdMessage(await apresEvenements({ ...joint, reception: { idEmission: referenceEmission.idEmission, idDonnee, reception: declaree.reception, echec: declaree.echec, relation } }), idMessageConserve);
    }
    return avecIdMessage(await apresEvenements(joint), idMessageConserve);
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
      const r = await tickPropre(e.magasin);
      // v0.63.88 — le tick est un événement réel : ses conséquences (c, r) sont écrites ; l'occasion est calculée ensuite (episode-propre.js).
      let episode = null;
      try { episode = await traiterOccasion(e.magasin, r.tick.id); } catch (echec) { episode = { evenement: r.tick.id, statut: 'echec', echec }; }
      return { ...r, episode };
    },
    // v0.63.88 — lecture seule : le dernier épisode propre reconstruit depuis le magasin (affichage au chargement ; aucune initiative).
    dernierEpisode: async () => {
      const e = await ecranLangage.assurerEsprit();
      return lireDernierEpisode(e.magasin);
    },
    // v0.63.89 — lecture seule : le dernier événement persisté et son occasion, même sans épisode.
    dernierEvenement: async () => {
      const e = await ecranLangage.assurerEsprit();
      return lireDernierEvenement(e.magasin);
    },
    // N3b-0 — lecture seule, pour le panneau Diagnostic UNIQUEMENT : chaque proposition de résolution vécue relue dans sa situation
    // (historique / relecture actuelle / issue / après). Aucune décision, aucun examen, aucune proposition ne lit cette vue.
    experiencesSituees: async () => {
      const e = await ecranLangage.assurerEsprit();
      return experiencesSitueesDeResolution(await lireActesResolution(e.magasin), await lireLignesDivergences(e.magasin), e);
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
