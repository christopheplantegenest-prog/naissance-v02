// === DEBUT_ATELIER_ECRAN ===
// v0.65.3 — AT-4 « ÉCRAN ATELIER OFF / MANUEL » (GO Christophe + ChatGPT « AUTORISATION AT-4 », 17/10/2026 ; D-007 ACTIVE).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Seul module d'interface de l'atelier, et seul raccord des modules purs
// chantier.js (AT-1), budget.js (AT-2), mission.js (AT-3) et montants.js. Il ne connaît ni le moteur, ni la mémoire, ni aucune table.
//   monterAtelier({ zone, version, stockage, copier, maintenant }) -> { rafraichir }
// Chargé seulement au toucher « Atelier de développement » (import dynamique dans main.js) : rien ne s'exécute au démarrage.
// MODE (donnée d'interface, jamais transmise aux modules purs) : OFF au premier lancement = consultation seulement ; MANUEL = formulaire,
// ouverture / approbation / arrêt du chantier, ouverture du cycle et plafond du chantier, génération + copie du dossier, vérification
// de forme d'un rapport collé. AUTO n'existe pas. Aucun réseau, aucune API, aucun GitHub, dans aucun mode.
// COPIE DE TRAVAIL LOCALE JETABLE : une seule clé localStorage « naissance-ia.atelier.v1 » { version, mode, formulaire, fiches, journal,
// registre, mission }. Ni autorité Git, ni acquisition, ni table, ni reprise AT-7, jamais exportée. Relue avec verifierJournal / verifierRegistre :
// incohérente => déclarée illisible, rien n'est utilisé ni réparé ; seul « Effacer l'atelier de cet appareil » reste possible.
// Données SÉPARÉES : AT-1 garde id, objectif, base, jalons (titre, critere, tentativesMax) ; la fiche locale du jalon garde comportement,
// critères, tests, autorisés, interdits, frontières, décisions. Le dossier les compose explicitement ; AT-1 n'est pas réinterprété.
// Une vérification de rapport n'écrit RIEN : ni journal AT-1, ni registre AT-2, ni copie locale ; elle n'avance aucun état.
// v0.65.3 (correction avant dépôt) : « Générer » fige dans la copie locale l'INSTANTANÉ des données exactes du dossier (« mission ») ;
// « Vérifier la forme » contrôle le rapport contre CET instantané, jamais contre la fiche courante. Seul un nouveau « Générer » le remplace.
// v0.65.6 — AT-6 « MANUEL DE BOUT EN BOUT » (GO 17/10/2026 ; décision D-007 sur les autorisations manuelles) : parcours complet
// mission -> tentative -> rapport -> demande de vérification -> faits AT-5 -> verdict technique -> décision humaine -> clôture.
// Les étapes sont DÉRIVÉES (parcours.js) du journal AT-1 et des PIÈCES de chaque tentative, gardées dans la copie locale (version 2) :
// pieces["<jalon>/<n>"] = { mission (instantané exact lancé), rapport (texte exact enregistré), demande (copiée, figée), faits [textes AT-5] }.
// Le verdict technique est RECALCULÉ à chaque affichage (verification.js, confronter) et n'est jamais stocké comme une vérité ; la
// décision humaine est un événement AT-1 (motif obligatoire) qui cite l'empreinte des faits et le verdict observé au moment du geste.
// Tout geste persistant SAUVE D'ABORD (copie vérifiée entière, sinon rien n'est fait), effet externe (presse-papiers) ENSUITE.
// Une copie version 1 est lue comme un chantier sans pièces AT-6 (aucune pièce historique n'est inventée).
// v0.65.7 — AT-7 « JOURNAL GIT + REPRISE » (GO 17/10/2026 ; D-007 précision D4) : copie locale version 3 = version 2 + « sauvegarde »,
// la dernière sauvegarde durable CONFIRMÉE par Claude sur cet appareil ({ empreinte, commit, evenements }) — un statut connu, jamais une
// preuve. Sauvegarde : l'état durable (journal.js) est découpé en parties k/N copiées une à une. Restauration : atelier VIDE seulement,
// parties collées dans n'importe quel ordre, lecture complète, aperçu, confirmation humaine, puis copie installée en mode OFF.
// D3 « pas de candidat sans lancement sauvegardé » : lancer n'écrit que la tentative et son instantané, sans presse-papiers ; le dossier
// n'est copiable, et un candidat enregistrable, qu'après une sauvegarde confirmée qui CONTIENT ce lancement. Dérivé ici, AT-1 inchangé.
// v0.65.9 — AT-8.1 « AUTO À BLANC » (GO 18/10/2026 ; D-007) : troisième mode, AUTO, choisi seulement par un toucher explicite de
// Christophe (aucun passage implicite ; une restauration installe toujours OFF). AUTO garde la préparation commune (chantier, plan, fiche,
// budget, dossier, sauvegarde) et remplace le lancement MANUEL par un lancement AUTO à blanc (section 11) : UN engager écrit la
// tentative AT-1 { jalon, mode: 'AUTO', appel } ET l'engagement AT-2 { execution: T, chantier, maximum = estimation } (refus de l'un :
// rien n'est écrit). Après sauvegarde confirmée À JOUR (D3), la demande AUTO (auto.js) se copie pour Claude, qui déclenche UNE fois le
// workflow atelier-auto.yml. La clôture AUTO exige des faits atelier-auto-faits-1 de CETTE tentative (appel_emis = false) et un motif :
// tentative annulée (faits cités, texte exact) + coût réel 0 inscrit. Annuler sans faits laisse l'engagement ouvert (incertain).
// Les gestes MANUEL (copie du dossier, candidat, demande AT-5, faits AT-5, décision) restent réservés au mode MANUEL (v0.65.16 : demande AT-5,
// faits AT-5 et décision d'une tentative AUTO rendue, en AUTO seulement). Aucun réseau.
// v0.65.10 — AT-8.2 « TÉMOIN À BLANC » (GO 18/10/2026 ; D-007) : en AUTO, un TÉMOIN peut être joint au lancement (« Préparer le
// témoin réel ») : jeton de 128 bits tiré sur l'appareil, tarifs CONSTATÉS saisis, engagement saisi (>= estimation). La tentative
// AT-1 porte alors { temoin: { jeton, tarif_entree, tarif_sortie } } et l'engagement AT-2 le montant saisi. Aucun réseau ici : l'appel
// éventuel est fait par le workflow, jamais par l'appareil. Clôture d'un témoin : « Lire les faits » montre l'issue, puis UN geste :
//   NON ÉMIS        tentative annulée + coût réel 0
//   RÉPONSE CONNUE  tentative annulée + coût réel calculé (usage x tarifs constatés)
//   ISSUE INCONNUE  tentative annulée SANS coût : engagement MAINTENU OUVERT, aucune relance, tout lancement AUTO bloqué jusqu'à la
//                   régularisation humaine (montant > 0 saisi, motif obligatoire)
// La décision de clôture est celle d'auto.js (decisionCloture) ; une tentative sans témoin garde la clôture AT-8.1 à coût 0.
// v0.65.13 — AT-9.1 « APPEL DE DÉVELOPPEMENT À BLANC » (GO 20/10/2026 ; D-007) : en AUTO, un DÉVELOPPEMENT peut être joint au
// lancement à la place d'un témoin (« Préparer l'appel de développement ») : modèle, bornes, tarifs plafonds, tarifs CONSTATÉS, effort
// et engagement saisis (>= estimation). La tentative AT-1 porte alors { developpement: { effort, tarif_entree, tarif_sortie } }.
// Aucun réseau ici. Même clôture que le témoin (trois issues, decisionCloture) ; une réponse connue dit en plus si la proposition est
// valide (le run crée alors la branche candidate, vérifiée ensuite par AT-5 sur une demande séparée) ou refusée (aucun candidat).
// AT-9.2 « REMPLACEMENTS EXACTS » : le développement porte aussi ses EXTRAITS (une ligne « chemin début-fin » par extrait, lignes de la
// base) : seuls ces extraits sont transmis ; le modèle répond par remplacements exacts. { developpement: { ..., extraits } }.
// v0.65.16 — AT-10.5 « DÉCISION HUMAINE SUR UN CANDIDAT AUTO » (GO « AT-10.5 — GO RÉALISATION LOCALE », 20/10/2026 ; D-007).
// Tentative AUTO d'appel de développement : faits J2 ET J4 collés, « Lire le retour » (lireRetourAuto, rien n'est écrit), puis UN geste
// « Enregistrer le candidat AUTO » : une seule copie vérifiée écrit la tentative rendue (textes exacts de J2 et J4), le coût réel de J2
// au registre AT-2 et la demande AT-5 figée (celle de J4). Il exige que le run ait lu la sauvegarde confirmée sur cet appareil (état
// J2 = sauvegarde confirmée, toujours à jour). La suite est celle du MANUEL : faits AT-5, verdict RECALCULÉ (rapport dérivé des faits
// J4 et AT-5, confrontationDe), décision humaine. Ces gestes ne sont permis qu'en AUTO pour une tentative AUTO, et qu'en MANUEL pour
// une tentative MANUEL. « Clore : RÉPONSE CONNUE » reste possible (abandon explicite, D11). Aucun dépôt, aucune livraison, aucun réseau.
// v0.65.18 — AT-10.1 « CARNET DE TROIS MISSIONS » (GO « AT-10.1 — GO RÉALISATION LOCALE », 21/10/2026 ; D-007). Section 12, raccord du
// modèle pur carnet.js : collage d'une proposition (ATELIER-PARTIE-2), aperçu avec empreinte, approbation V1 (MANUEL seulement), suivi du
// budget (confirmé, réservé, disponible), ouverture de la mission k (carnet sauvegardé à jour, atelier du chantier VIDE : formulaire
// pré-rempli), clôture d'échec dérivée du chantier, livraison seulement sur preuve ATELIER-LIVRAISON-1 recoupée avec le chantier de
// l'appareil, validation, arrêt, sauvegarde et restauration du carnet. Copie locale SÉPARÉE « naissance-ia.atelier.carnet.v1 » ; la copie
// du chantier est inchangée (seul son formulaire est pré-rempli à l'ouverture d'une mission). Aucun appel, aucune dépense, aucun réseau.
// v0.65.19 — AT-10.2 « PRÉPARATION AUTOMATIQUE D'UNE MISSION » (GO « AT-10.2 — GO RÉALISATION LOCALE », 21/10/2026 ; DA, DB, DC, DE).
// « Préparer la mission k » (section 12, atelier VIDE, carnet sauvegardé à jour) : UNE copie vérifiée entière contient le chantier ouvert
// et son plan approuvé (la V1 couvre exactement ce plan), la fiche, le cycle et le plafond AT-2, l'appel AUTO de développement, tous
// dérivés de preparationMission (carnet.js) ; contrôle complet AVANT l'écriture (comparerChantier + formulaires relus), sinon rien.
// Mission de carnet : fiche et formulaires AUTO figés, lancement MANUEL refusé ; toute différence avec la mission = DIVERGENCE (STOP),
// generer et lancer bloqués ; après une restauration, « Rétablir la préparation locale » réécrit seulement la fiche et les formulaires.
// Estimation et plafond ne valent jamais V2 ; rien n'est lancé, aucun appel. E-T1 : effacements nommés (CHANTIER / CARNET) et exclusifs.
// v0.65.20 — AT-10.3 « RELAIS DU CYCLE AUTOMATISÉ » (GO « AT-10.3 — GO RÉALISATION LOCALE », 21/10/2026 ; DA, DG). D3 du carnet regroupée :
// l'ouverture de la mission k >= 2 est permise sur une sauvegarde confirmée qui couvre la livraison de k-1 (suivie, au plus, de sa validation) ;
// la sauvegarde qui suit l'ouverture reste exigée avant « Préparer » (Claude y rejoue le contrôle E1). Consignes : pour une mission de
// carnet, Claude dérive lui-même les demandes AUTO et AT-5 des sauvegardes (auto-carnet.mjs) ; V2, V3 et V4 restent tes gestes.
// v0.65.21 — AT-10.4 « RETOUR DES FAITS SANS RECOPIE » (GO « AT-10.4 — GO RÉALISATION LOCALE », 21/10/2026 ; DI = F2, DJ, DO). Section 11,
// « Clôture par les faits du run » : UN collage du bloc ATELIER-RETOUR-1 rendu par Claude (auto-retour.mjs) ; « Lire le retour de Claude »
// le relit (lireRetour, controlerRetour de retour.js : mêmes lecteurs, même T, même run, sauvegarde confirmée de cet appareil, pièce de T)
// et montre l'empreinte de chaque fait ; après comparaison avec les titres des annotations sur la page du run (DJ), « utiliser ces faits »
// les place dans les champs existants (faits AUTO, J4, AT-5), puis les gestes de clôture habituels s'appliquent. Rien n'est écrit par ces
// deux gestes ; la copie manuelle (F1) reste possible, par les mêmes champs et les mêmes lecteurs.

import { ouvrirChantier, appliquer, etatDe, verifierJournal } from './chantier.js';
import { ouvrirRegistre, appliquerBudget, etatBudget, verifierRegistre } from './budget.js';
import { construireMission, verifierRapport } from './mission.js';
import { lireUSD, ecrireUSD } from './montants.js';
import { lireFaits, confronter, lireDemande } from './verification.js';
import { cleTentative, etapeDe, proposerVersion, demandeDe, texteDemande, raisonPieces, tentativesDuJournal } from './parcours.js';
import { hacherSha256 } from './empreinte.js';
import { lirePieces, ecrireEtatDurable, etatDurableDe, canonique, decouper, preparerRestauration, lireConfirmation, brancheJournal, confrontationDe, assemblerParties } from './journal.js';
import { identiteT, lireAppel, estimationMax, texteDemandeAuto, lireFaitsAuto, lireTemoin, decisionCloture, lireDeveloppement, lireExtraitsTexte, EFFORTS, lireRetourAuto, lireFaitsCandidat } from './auto.js';
import { lireRetour, controlerRetour, GENRES as GENRES_FAITS, LIBELLES as LIBELLES_FAITS } from './retour.js';
import { PROTOCOLE_PROPOSITION_CARNET, lireProposition, empreinteProposition, ouvrirCarnet, appliquerCarnet, etatCarnet, verifierCarnet, etatDurableCarnet, lireEtatCarnet, bilanChantier, comparerChantier, formulaireMission, lireLivraison, preparationMission } from './carnet.js';

export const CLE_ATELIER = 'naissance-ia.atelier.v1';
export const CLE_CARNET = 'naissance-ia.atelier.carnet.v1';
const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
const CHAMPS_FICHE = ['comportement', 'criteres', 'tests', 'autorises', 'interdits', 'frontieres'];
const CHAMPS_BUDGET = ['cycle', 'plafond', 'reserve', 'plafondRun', 'plafondChantier'];
const CHAMPS_AUTO = ['modele', 'entree_max', 'max_tokens', 'tarif_entree', 'tarif_sortie'];
const CHAMPS_TEMOIN = ['jeton', 'tarif_entree', 'tarif_sortie', 'maximum'];
const CHAMPS_DEVELOPPEMENT = ['effort', 'tarif_entree', 'tarif_sortie', 'maximum', 'extraits'];
const MODES = Object.freeze(['OFF', 'MANUEL', 'AUTO']);
// v0.65.19 : forme des chantiers de mission « <carnet>-m<k> » (carnet.js) ; un tel chantier sans son carnet ouvert ici n'avance pas.
const RE_CHANTIER_CARNET = /^carnet-[a-z0-9]+(-[a-z0-9]+)*-m[1-3]$/;
const usd = (m) => `${ecrireUSD(m)} USD`;

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

const jalonVide = () => ({ id: '', titre: '', critere: '', tentativesMax: '2' });
const ficheVide = () => ({ comportement: '', criteres: '', tests: '', autorises: '', interdits: '', frontieres: '', decisions: [] });
const formulaireVide = (version) => ({
  chantier: '', objectif: '', version, sha: '', jalons: [jalonVide()],
  budget: { cycle: '', plafond: '', reserve: '', plafondRun: '', plafondChantier: '' },
});
const copieVide = (version) => ({ version: 3, mode: 'OFF', formulaire: formulaireVide(version), fiches: {}, journal: null, registre: null, mission: null, pieces: {}, piecesDepuis: 1, sauvegarde: null });
const uiVide = () => ({ section: null, message: null, dossier: null, rapport: '', verification: null, confirmerEffacement: false, faits: '', versionCandidat: null, motifDecision: '', retour: null, preparation: null, confirmation: '', partie: '', parties: [], faitsAuto: '', motifAuto: '', lectureAuto: null, montantRegul: '', motifRegul: '', faitsCandidat: '', partieCarnet: '', partiesCarnet: [], preparationCarnet: null, confirmationCarnet: '', livraisonCarnet: '', motifCarnet: '', confirmerCloture: false, confirmerEffacementCarnet: false, retourMission: '', lectureRetour: null });
const autoVide = () => ({ modele: '', entree_max: '', max_tokens: '', tarif_entree: '', tarif_sortie: '' });
// Appel À BLANC prérempli : libellé de modèle sans valeur réelle, bornes et tarifs plafonds retenus pour le témoin (aucun appel).
const autoTemoin = () => ({ modele: 'a-blanc', entree_max: '20000', max_tokens: '1000', tarif_entree: '1', tarif_sortie: '5' });
// AT-8.2 : TÉMOIN RÉEL prérempli : bornes du témoin (entrée 1000, sortie 64) et tarifs PLAFONDS prudents (0,5 et 2,5 USD par million) ;
// le modèle et les tarifs CONSTATÉS restent vides : ils sont vérifiés et saisis le jour du témoin. Engagement 0,001 USD (1000 microdollars).
const autoTemoinReel = () => ({ modele: '', entree_max: '1000', max_tokens: '64', tarif_entree: '0,5', tarif_sortie: '2,5' });
// AT-9.1 : APPEL DE DÉVELOPPEMENT : tout reste à saisir (modèle, bornes, tarifs plafonds) ; aucune valeur n'est proposée par défaut.
const autoDeveloppement = () => ({ modele: '', entree_max: '', max_tokens: '', tarif_entree: '', tarif_sortie: '' });
const LIBELLE_ISSUE = Object.freeze({ 'non-emis': 'NON ÉMIS', 'reponse-connue': 'RÉPONSE CONNUE', 'issue-inconnue': 'ISSUE INCONNUE' });
// Section ouverte d'office pour les étapes AT-6 (les autres gardent la règle AT-4).
const SECTION_DE_L_ETAPE = Object.freeze({ 'auto-lancee': 'auto', 'rapport-attendu': 'rapport', 'demande-a-copier': 'verification', 'faits-attendus': 'verification', 'verification-a-refaire': 'verification', 'decision-attendue': 'verification', 'chantier-termine': 'decision' });
const CONFORME = 'verification-technique-conforme';
const CONSIGNE_D3 = 'Sauvegarde durable requise (D3) : prépare les parties, colle-les à Claude une à une, puis colle ici sa confirmation.';
const NON_CONFORME = 'verification-technique-non-conforme';
const CONSIGNE_AUTO = 'Mode AUTO à blanc : remplis la fiche, génère le dossier, puis lance la tentative en AUTO (section 11).';
const CONSIGNE_AUTO_DEV = 'Appel de développement lancé : sauvegarde-le, copie la demande AUTO pour Claude, puis colle ici les faits J2 et J4 du run, lis-les, puis enregistre le candidat ou clos la tentative (section 11).';
// v0.65.16 : raisons du retour AUTO (lireRetourAuto) dites en clair ; rien n'est enregistré.
const RAISONS_RETOUR = Object.freeze({
  'j2-pas-un-appel': 'faits J2 attendus (étape « appel ») : faits intermédiaires', 'j2-autre-tentative': 'faits J2 d\'une autre tentative', 'j2-hors-premier-essai': 'faits J2 hors premier essai ou hors de main',
  'j2-sans-reponse-connue': 'J2 n\'est pas une RÉPONSE CONNUE : utilise le constat ou la clôture ci-dessus', 'j2-sans-proposition': 'aucune proposition valide : clore la tentative',
  'j4-autre-tentative': 'faits J4 d\'une autre tentative', 'j4-sans-candidat': 'aucun candidat créé par J4', 'run-different': 'J2 et J4 viennent d\'un run différent',
  'etat-different': 'J2 et J4 n\'ont pas lu le même état', 'candidat-etranger': 'candidat étranger (autre branche ou autre base)', 'fichiers-differents': 'fichiers différents entre J4 et la proposition de J2',
  'demande-at5-incoherente': 'demande AT-5 incohérente', 'mission-etrangere': 'mission étrangère à cette tentative',
});
const raisonRetour = (r) => (r.startsWith('j2-illisible:') ? `faits J2 illisibles : ${r.slice(13)}` : r.startsWith('j4-illisible:') ? `faits J4 illisibles : ${r.slice(13)}` : RAISONS_RETOUR[r] || r);

// Chantier TÉMOIN : reconnaissable par son identifiant « temoin- ». Aucun SHA n'est inventé : il reste à coller.
function temoin(version) {
  return {
    formulaire: {
      chantier: 'temoin-atelier', objectif: 'TÉMOIN — démontrer l\'écran Atelier OFF / MANUEL, sans aucun développement réel.', version, sha: '',
      jalons: [{ id: 'temoin-1', titre: 'Jalon témoin', critere: 'Le dossier témoin est généré puis copié sans aucune modification.', tentativesMax: '2' }],
      budget: { cycle: 'temoin-cycle', plafond: '100', reserve: '20', plafondRun: '15', plafondChantier: '30' },
    },
    fiche: {
      comportement: 'TÉMOIN — le dossier de mission est généré et copié, puis un rapport témoin collé est vérifié dans sa forme seulement.',
      criteres: 'Le dossier copié est identique au dossier généré.\nLe rapport témoin est déclaré conforme mais non vérifié.',
      tests: 'Aucun test réel : chantier témoin.', autorises: 'tests/temoin-atelier.test.mjs', interdits: '',
      frontieres: 'Aucun développement réel.\nAucun dépôt.',
      decisions: [{ id: 'D-007', texte: 'Atelier de développement : OUTILLAGE NON COGNITIF. Claude produit des candidats, jamais des acquisitions.' }],
    },
  };
}

// Forme de la copie locale ; rend une raison ou null. Le journal et le registre sont vérifiés par leurs propres modules.
function raisonCopie(c) {
  const objet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const textes = (o, cles) => objet(o) && cles.every((k) => typeof o[k] === 'string');
  if (!objet(c) || ![1, 2, 3].includes(c.version) || !Object.hasOwn(c, 'mission')) return 'version de copie inconnue';
  if (!MODES.includes(c.mode)) return 'mode inconnu';
  const f = c.formulaire;
  if (!textes(f, ['chantier', 'objectif', 'version', 'sha']) || !Array.isArray(f.jalons) || !f.jalons.every((j) => textes(j, ['id', 'titre', 'critere', 'tentativesMax'])) || !textes(f.budget, CHAMPS_BUDGET)) return 'formulaire illisible';
  if (Object.hasOwn(f, 'auto') && !textes(f.auto, CHAMPS_AUTO)) return 'formulaire illisible';
  if (Object.hasOwn(f, 'temoin') && f.temoin !== null && !textes(f.temoin, CHAMPS_TEMOIN)) return 'formulaire illisible';
  if (Object.hasOwn(f, 'developpement') && f.developpement !== null && !textes(f.developpement, CHAMPS_DEVELOPPEMENT)) return 'formulaire illisible';
  if (!objet(c.fiches) || !Object.values(c.fiches).every((x) => textes(x, CHAMPS_FICHE) && Array.isArray(x.decisions) && x.decisions.every((d) => textes(d, ['id', 'texte'])))) return 'fiche illisible';
  if (c.journal !== null) { const v = verifierJournal(c.journal); if (!v.ok) return `journal du chantier incohérent (événement ${v.n}) : ${v.raison}`; }
  if (c.registre !== null) { const v = verifierRegistre(c.registre); if (!v.ok) return `registre de budget incohérent (événement ${v.n}) : ${v.raison}`; }
  if (c.mission !== null) {
    if (!objet(c.mission) || c.journal === null) return 'instantané du dossier illisible';
    try { construireMission(c.mission); } catch (e) { return `instantané du dossier illisible : ${e.message}`; }
    const etat = etatDe(c.journal);
    if (c.mission.chantier !== etat.id || c.mission.base.sha !== etat.base.sha || c.mission.base.version !== etat.base.version) return 'instantané du dossier étranger au chantier';
  }
  if (c.version >= 2) {
    const lues = piecesLues(c);
    if (typeof lues === 'string') return lues;
    const r = raisonPieces({ etat: c.journal ? etatDe(c.journal) : null, journal: c.journal, pieces: lues, piecesDepuis: c.piecesDepuis, lireRetour: lireRetourAuto });
    if (r) return `pièces incohérentes : ${r}`;
  }
  if (c.version === 3 && c.sauvegarde !== null) {
    const s = c.sauvegarde;
    if (!objet(s) || Object.keys(s).sort().join(',') !== 'commit,empreinte,evenements' || !/^[0-9a-f]{64}$/.test(s.empreinte) || !RE_SHA.test(s.commit)) return 'sauvegarde confirmée illisible';
    if (c.journal === null || !Number.isInteger(s.evenements) || s.evenements < 1 || s.evenements > c.journal.length) return 'sauvegarde confirmée étrangère au chantier';
  }
  return null;
}

// Pièces de la copie relues par les vérificateurs (journal.js, lirePieces) ; rend les pièces lues, ou la raison de l'illisibilité.
const piecesLues = (c) => lirePieces(c.pieces, c.piecesDepuis);

function lireCopie(stockage, version) {
  let brut = null;
  try { brut = stockage ? stockage.getItem(CLE_ATELIER) : null; } catch { brut = null; }
  if (!brut) return { copie: copieVide(version) };
  let c;
  try { c = JSON.parse(brut); } catch { return { illisible: 'texte illisible' }; }
  const r = raisonCopie(c);
  if (r) return { illisible: r };
  // Copie AT-4 (version 1) : lue comme un chantier sans pièces AT-6 ; les tentatives déjà écrites n'en reçoivent aucune.
  if (c.version === 1) return { copie: { ...c, version: 3, pieces: {}, piecesDepuis: c.journal ? c.journal.length + 1 : 1, sauvegarde: null } };
  // Copie AT-6 (version 2) : aucune sauvegarde durable confirmée sur cet appareil.
  if (c.version === 2) return { copie: { ...c, version: 3, sauvegarde: null } };
  return { copie: c };
}

// v0.65.18 — copie locale du carnet (AT-10.1) : { version: 1, journal (carnet.js) ou null, sauvegarde confirmée ou null }. Relue entière
// (verifierCarnet) ; incohérente => illisible, rien n'est utilisé ni réparé ; seul « Effacer le carnet de cet appareil » reste possible.
const carnetVide = () => ({ version: 1, journal: null, sauvegarde: null });
function raisonCarnet(c) {
  if (c === null || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).sort().join(',') !== 'journal,sauvegarde,version' || c.version !== 1) return 'version de copie du carnet inconnue';
  if (c.journal !== null) { const v = verifierCarnet(c.journal); if (!v.ok) return `journal du carnet incohérent (événement ${v.n}) : ${v.raison}`; }
  const s = c.sauvegarde;
  if (s !== null) {
    if (s === null || typeof s !== 'object' || Object.keys(s).sort().join(',') !== 'commit,empreinte,evenements' || !/^[0-9a-f]{64}$/.test(s.empreinte) || !RE_SHA.test(s.commit)) return 'sauvegarde du carnet illisible';
    if (c.journal === null || !Number.isInteger(s.evenements) || s.evenements < 1 || s.evenements > c.journal.length) return 'sauvegarde étrangère au carnet';
  }
  return null;
}
function lireCarnetLocal(stockage) {
  let brut = null;
  try { brut = stockage ? stockage.getItem(CLE_CARNET) : null; } catch { brut = null; }
  if (!brut) return { carnet: carnetVide() };
  let c;
  try { c = JSON.parse(brut); } catch { return { illisible: 'texte illisible' }; }
  const r = raisonCarnet(c);
  return r ? { illisible: r } : { carnet: c };
}

// Une ligne de zone de texte = un élément ; une ligne vide est refusée, jamais ignorée.
function lignes(texte, nom) {
  if (texte === '') return [];
  const l = texte.split('\n');
  const i = l.indexOf('');
  if (i >= 0) throw new Error(`${nom} : ligne ${i + 1} vide`);
  return l;
}

export function monterAtelier({ zone, version, stockage = stockageParDefaut(), copier = (t) => navigator.clipboard.writeText(t), maintenant = () => new Date().toISOString(), hasard = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n)) }) {
  let lu = lireCopie(stockage, version);
  let lc = lireCarnetLocal(stockage);
  // État temporaire d'interface (mémoire vive seulement).
  let ui = uiVide();

  const el = (tag, { classe, texte, attrs } = {}, ...enfants) => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    e.append(...enfants.filter(Boolean));
    return e;
  };
  const manuel = () => !!lu.copie && lu.copie.mode === 'MANUEL';
  // AT-8.1 : AUTO seulement par choix explicite ; « pilote » = gestes communs aux deux modes actifs (OFF reste consultation seule).
  const auto = () => !!lu.copie && lu.copie.mode === 'AUTO';
  const pilote = () => manuel() || auto();
  const bouton = (texte, nom, action, { principal = false, actif = true } = {}) => {
    const b = el('button', { classe: principal ? 'bouton-principal' : 'bouton-secondaire', texte, attrs: { type: 'button', 'data-atelier': nom } });
    b.disabled = !actif;
    b.addEventListener('click', () => (b.disabled ? undefined : action()));
    return b;
  };
  const champ = (libelle, valeur, surSaisie, { nom, multi = false, rangs = 3, aide = '', clavier = '', verrou = false } = {}) => {
    const entree = el(multi ? 'textarea' : 'input', { attrs: { 'data-atelier': nom, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', ...(clavier ? { inputmode: clavier } : {}) } });
    if (multi) entree.rows = rangs; else entree.type = 'text';
    entree.value = valeur;
    entree.disabled = !pilote() || verrou;
    entree.addEventListener('input', () => { if (pilote() && !verrou) { surSaisie(entree.value); sauver(); } });
    return el('label', { classe: 'champ' }, el('span', { texte: libelle }), entree, aide ? el('span', { classe: 'aide', texte: aide }) : null);
  };
  // Saisie d'interface seulement (mémoire vive) : motif, faits, version proposée. Rien n'est enregistré à la frappe.
  const saisie = (libelle, valeur, surSaisie, { nom, multi = false, rangs = 3, aide = '' } = {}) => {
    const entree = el(multi ? 'textarea' : 'input', { attrs: { 'data-atelier': nom, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' } });
    if (multi) entree.rows = rangs; else entree.type = 'text';
    entree.value = valeur;
    entree.disabled = !pilote();
    entree.addEventListener('input', () => { if (pilote()) surSaisie(entree.value); });
    return el('label', { classe: 'champ' }, el('span', { texte: libelle }), entree, aide ? el('span', { classe: 'aide', texte: aide }) : null);
  };
  const message = (section) => (ui.message && ui.message.section === section
    ? el('p', { classe: `resultat ${ui.message.erreur ? 'resultat-erreur' : 'resultat-ok'}`, texte: ui.message.texte, attrs: { 'data-atelier': 'message' } }) : null);
  const dire = (section, texte, erreur = false) => { ui.message = { section, texte, erreur }; };

  const ecrireCopie = (c) => stockage.setItem(CLE_ATELIER, JSON.stringify(c));
  function sauver() {
    if (!lu.copie) return false;
    try { ecrireCopie(lu.copie); return true; } catch { dire('bandeau', 'Copie locale non enregistrée sur cet appareil.', true); return false; }
  }
  // AT-6 : un geste persistant prépare une NOUVELLE copie, la fait relire entière par les vérificateurs, l'enregistre, et seulement
  // alors la retient. Copie incohérente ou enregistrement impossible : rien n'est fait (la copie retenue reste l'ancienne).
  function engager(nouvelle) {
    const r = raisonCopie(nouvelle);
    if (r) throw new Error(`Refusé : ${r}.`);
    try { ecrireCopie(nouvelle); } catch { throw new Error('Copie locale non enregistrée sur cet appareil : rien n\'est fait.'); }
    lu = { copie: nouvelle };
  }
  // Exécute une action technique en MANUEL seulement, puis enregistre la copie locale et redessine.
  const agir = (section, action) => () => {
    if (!pilote()) return;
    try { action(); } catch (e) { dire(section, e && e.message ? e.message : String(e), true); }
    rendre();
  };
  const etatChantier = () => (lu.copie && lu.copie.journal ? etatDe(lu.copie.journal) : null);
  const ficheDe = (id) => lu.copie.fiches[id] || (lu.copie.fiches[id] = ficheVide());

  // ---------------------------------------------------------------------------------------------- actions techniques (MANUEL)
  function ouvrir() {
    const f = lu.copie.formulaire;
    if (!RE_ID.test(f.chantier) || f.chantier.length > 40) throw new Error('Identifiant du chantier : lettres minuscules, chiffres et tirets (40 au plus).');
    if (!RE_VERSION.test(f.version)) throw new Error('Version de base : X.Y.Z attendu.');
    if (!RE_SHA.test(f.sha)) throw new Error('SHA de base : 40 caractères hexadécimaux minuscules attendus (il n\'est jamais deviné : colle-le).');
    const plan = f.jalons.map((j, i) => {
      if (!RE_ID.test(j.id) || j.id.length > 40) throw new Error(`Jalon ${i + 1} : identifiant en lettres minuscules, chiffres et tirets.`);
      if (!/^[1-9][0-9]{0,2}$/.test(j.tentativesMax)) throw new Error(`Jalon ${i + 1} : tentatives max = entier de 1 à 999.`);
      return { id: j.id, titre: j.titre, critere: j.critere, tentativesMax: Number.parseInt(j.tentativesMax, 10) };
    });
    lu.copie.journal = ouvrirChantier({ id: f.chantier, objectif: f.objectif, base: { sha: f.sha, version: f.version }, plan }, maintenant());
    sauver();
    dire('chantier', 'Chantier ouvert (état technique). Plan à approuver.');
  }
  function appliquerChantier(type, donnees, section, texte) {
    const r = appliquer(lu.copie.journal, { type, quand: maintenant(), donnees });
    if (!Array.isArray(r)) throw new Error(`Refusé : ${r.raison}.`);
    lu.copie.journal = r;
    sauver();
    dire(section, texte);
  }
  function ouvrirCycle() {
    const b = lu.copie.formulaire.budget;
    const m = {};
    for (const [k, nom] of [['plafond', 'Plafond du cycle'], ['reserve', 'Réserve'], ['plafondRun', 'Plafond par exécution']]) {
      const v = lireUSD(b[k]);
      if (typeof v !== 'number') throw new Error(`${nom} : ${v.raison}.`);
      m[k] = v;
    }
    lu.copie.registre = ouvrirRegistre({ cycle: b.cycle, ...m }, maintenant());
    sauver();
    dire('budget', 'Cycle ouvert (registre technique).');
  }
  function plafonnerChantier() {
    const v = lireUSD(lu.copie.formulaire.budget.plafondChantier);
    if (typeof v !== 'number') throw new Error(`Plafond du chantier : ${v.raison}.`);
    const r = appliquerBudget(lu.copie.registre, { type: 'chantier-plafonne', quand: maintenant(), donnees: { chantier: etatChantier().id, plafond: v } });
    if (!Array.isArray(r)) throw new Error(`Refusé : ${r.raison}.`);
    lu.copie.registre = r;
    sauver();
    dire('budget', 'Plafond du chantier fixé.');
  }
  // Données du dossier : AT-1 (id, objectif, base, titre, numéro de tentative) + fiche locale (le reste), composées explicitement.
  function donneesMission(copie = lu.copie) {
    const e = copie.journal ? etatDe(copie.journal) : null;
    if (!e || e.statut !== 'en-cours') throw new Error('le chantier doit être en cours (plan approuvé)');
    const j = e.plan[e.jalonCourant];
    const f = copie.fiches[j.id] || ficheVide();
    return {
      chantier: e.id, objectif: e.objectif, base: { sha: e.base.sha, version: e.base.version },
      jalon: { id: j.id, titre: j.titre, comportement: f.comportement }, tentative: j.tentatives.length + 1,
      criteres: lignes(f.criteres, 'Critères'), tests: lignes(f.tests, 'Tests exigés'), autorises: lignes(f.autorises, 'Chemins autorisés'),
      interdits: lignes(f.interdits, 'Chemins interdits'), frontieres: lignes(f.frontieres, 'Frontières'),
      decisions: f.decisions.map((d) => ({ id: d.id, texte: d.texte })),
    };
  }
  function generer() {
    if (!pilote()) return;
    try {
      const donnees = donneesMission();
      if (!permis('generer')) throw new Error(`aucune nouvelle tentative à cette étape (« ${etapeCourante().etape} »)`);
      exigerPreparation();
      const texte = construireMission(donnees);
      lu.copie.mission = structuredClone(donnees);
      sauver();
      ui.dossier = { texte }; ui.verification = null; ui.message = null;
    } catch (e) { ui.dossier = null; dire('dossier', `Dossier impossible : ${e.message}`, true); }
    rendre();
  }
  function verifier() {
    if (!manuel()) return;
    const v = vivanteCourante();
    const reference = v && v.piece ? v.piece.mission : lu.copie.mission;
    if (!reference) ui.verification = { structure: 'impossible', raison: 'aucun dossier généré' };
    else try { ui.verification = verifierRapport(reference, ui.rapport); } catch (e) { ui.verification = { structure: 'impossible', raison: e.message }; }
    rendre();
  }
  // ---------------------------------------------------------------------------------------------- parcours MANUEL (AT-6)
  // Pièce de la tentative vivante du jalon courant (lue), ou null.
  function vivanteCourante() {
    const e = etatChantier();
    if (!e || e.statut !== 'en-cours') return null;
    const j = e.plan[e.jalonCourant];
    const t = j.tentatives.find((x) => x.statut === 'lancee' || x.statut === 'rendue');
    if (!t) return null;
    const cle = cleTentative(j.id, t.numero);
    const lues = piecesLues(lu.copie);
    return { e, j, t, cle, piece: Object.hasOwn(lues, cle) ? lues[cle] : null };
  }
  // Verdict technique RECALCULÉ depuis les pièces (dernier texte de faits reçu) ; jamais lu depuis la copie.
  function confrontationCourante() {
    const v = vivanteCourante();
    if (!v || !v.piece || (v.piece.rapport === null && !autoRendue(v)) || v.piece.faits.length === 0) return null;
    const f = v.piece.faits[v.piece.faits.length - 1];
    return { ...v, faits: f, resultat: autoRendue(v) ? confrontationDe(v.piece, f, rendueDe(v)) : confronter({ mission: v.piece.mission, rapport: v.piece.rapport.texte, faits: f.texte, hacherSha256 }) };
  }
  function etapeCourante() {
    const e = etatChantier();
    const c = confrontationCourante();
    return etapeDe({ etat: e, pieces: lu.copie ? piecesLues(lu.copie) : {}, verdict: c ? c.resultat.verdict_technique : null, journal: lu.copie ? lu.copie.journal : null });
  }
  const permis = (geste) => etapeCourante().gestes.includes(geste);
  // v0.65.16 : tentative AUTO rendue (candidat AUTO enregistré) ; candidat cité ; gestes du parcours permis selon le mode de la tentative.
  const rendueDe = (v) => { const x = v ? tentativesDuJournal(lu.copie.journal).find((y) => y.jalon === v.j.id && y.numero === v.t.numero) : null; return x ? x.rendue : null; };
  const autoRendue = (v) => { const r = rendueDe(v); return !!r && r.donnees.mode === 'AUTO'; };
  const candidatAuto = (v) => lireFaitsCandidat(rendueDe(v).donnees.faits_candidat).faits.candidat;
  const candidatDe = (v) => (autoRendue(v) ? candidatAuto(v) : v.piece.rapport.lu.rapport.candidat);
  const parcoursPermis = () => { const v = vivanteCourante(); return tentativeAuto(v) ? auto() : manuel(); };
  function exiger(geste) {
    if (!permis(geste)) throw new Error(`Geste impossible à l'étape « ${etapeCourante().etape} ».`);
  }
  // Nouvelle copie = copie retenue + journal AT-1 avec l'événement (refus AT-1 : erreur) + modification des pièces.
  function avecEvenement(type, donnees, modifier = () => {}) {
    const c = structuredClone(lu.copie);
    const r = appliquer(c.journal, { type, quand: maintenant(), donnees });
    if (!Array.isArray(r)) throw new Error(`Refusé : ${r.raison}.`);
    c.journal = r;
    modifier(c);
    return c;
  }
  async function copierVers(cle, texte, quoi) {
    try { await copier(texte); ui.retour = { cle, ok: true, texte: `${quoi} copié ✓ (${octets(texte)} octets)` }; } catch (e) {
      ui.retour = { cle, ok: false, texte: `Copie impossible : ${e && e.message ? e.message : String(e)} — utilise « Recopier ».` };
    }
  }
  // D3 : la dernière sauvegarde confirmée CONTIENT-elle le lancement de la tentative vivante ? (une sauvegarde plus ancienne ne suffit pas)
  function lancementSauvegarde(v) {
    const s = lu.copie.sauvegarde;
    const t = v ? tentativesDuJournal(lu.copie.journal).find((x) => x.jalon === v.j.id && x.numero === v.t.numero) : null;
    return !!s && !!t && s.evenements >= t.n;
  }
  const attenteD3 = () => { const v = vivanteCourante(); return !!v && !!v.piece && v.t.statut === 'lancee' && !lancementSauvegarde(v); };
  // Geste 1 : « Lancer la tentative n ». Tentative AT-1 lancée + instantané figé ; AUCUN presse-papiers (D3 : sauvegarde d'abord).
  function lancer() {
    if (!manuel()) return;
    try {
      exiger('lancer');
      if (RE_CHANTIER_CARNET.test(etatChantier().id)) throw new Error('chantier d\'une mission de carnet : lancement en AUTO seulement (appel approuvé par la V1)');
      const et = etapeCourante();
      const m = lu.copie.mission;
      if (!m || m.jalon.id !== et.jalon || m.tentative !== et.numero) throw new Error(`génère d'abord le dossier de la tentative ${et.numero}`);
      engager(avecEvenement('tentative-lancee', { jalon: et.jalon }, (c) => {
        c.pieces[cleTentative(et.jalon, et.numero)] = { mission: structuredClone(m), rapport: null, demande: null, faits: [] };
      }));
      ui.dossier = null; ui.preparation = null;
      ui.section = 'sauvegarde';
      dire('sauvegarde', `Tentative ${et.numero} lancée (état technique) : dossier figé. Sauvegarde durable requise avant de copier le dossier (D3).`);
    } catch (e) { dire('dossier', `Lancement impossible : ${e.message}`, true); }
    rendre();
  }
  async function recopierDossier() {
    if (!manuel()) return;
    const v = vivanteCourante();
    if (!v || !v.piece || !permis('recopier-dossier') || !lancementSauvegarde(v)) return;
    const texte = construireMission(v.piece.mission);
    ui.dossier = { texte };
    await copierVers('dossier', texte, 'Dossier');
    rendre();
  }
  // Geste 2 : « Enregistrer le candidat reçu » — rapport « candidat » conforme seulement ; tentative AT-1 rendue, référence branche@sha.
  function enregistrer() {
    if (!manuel()) return;
    try {
      exiger('enregistrer');
      const v = vivanteCourante();
      if (!lancementSauvegarde(v)) throw new Error('aucune sauvegarde durable confirmée de ce lancement (D3) : aucun candidat ne peut exister');
      const vr = verifierRapport(v.piece.mission, ui.rapport);
      if (vr.structure !== 'conforme') throw new Error(`rapport non conforme : ${vr.raison}. Rien n'est enregistré`);
      if (vr.statutAnnonce !== 'candidat') throw new Error(`Claude annonce « ${vr.statutAnnonce} » : aucun candidat n'est rendu. Seule l'annulation de la tentative est possible`);
      const ref = `${vr.rapport.candidat.branche}@${vr.rapport.candidat.sha}`;
      const texte = ui.rapport;
      engager(avecEvenement('tentative-rendue', { jalon: v.j.id, numero: v.t.numero, reference: ref }, (c) => { c.pieces[v.cle].rapport = texte; }));
      ui.rapport = ''; ui.verification = null;
      ui.section = 'verification';
      dire('verification', `Candidat reçu enregistré (tentative ${v.t.numero} rendue : ${ref}). Il n'est pas vérifié.`);
    } catch (e) { dire('rapport', `Enregistrement impossible : ${e.message}.`, true); }
    rendre();
  }
  // Demande de vérification : construite depuis les pièces ; version_candidat proposée, modifiable, puis FIGÉE à la première copie.
  async function copierDemande() {
    if (!parcoursPermis()) return;
    try {
      exiger('copier-demande');
      const v = vivanteCourante();
      let d = v.piece.demande;
      if (d === null) {
        d = demandeDe({ mission: v.piece.mission, rapport: v.piece.rapport.lu.rapport, versionCandidat: versionProposee(v) });
        const ld = lireDemande(d);
        if (ld.raison) throw new Error(ld.raison);
        const figee = { ...d };
        const c = structuredClone(lu.copie);
        c.pieces[v.cle].demande = figee;
        engager(c);
        dire('verification', 'Demande figée : elle ne change plus pour cette tentative.');
      }
      await copierVers('demande', texteDemande(d), 'Demande');
    } catch (e) { dire('verification', `Demande impossible : ${e.message}.`, true); }
    rendre();
  }
  const versionProposee = (v) => (ui.versionCandidat !== null ? ui.versionCandidat : proposerVersion(v.piece.mission.base.version));
  // Geste 3 : « Confronter les faits » — faits AT-5 lisibles, d'empreinte vérifiée, de CETTE demande : texte exact ajouté (append-only).
  function confronterFaits() {
    if (!parcoursPermis()) return;
    try {
      exiger('confronter');
      const v = vivanteCourante();
      const texte = ui.faits;
      const lf = lireFaits(texte, hacherSha256);
      if (lf.raison) throw new Error(`faits illisibles : ${lf.raison}. Rien n'est conservé`);
      const d = lf.faits.demande;
      if (!['branche', 'candidat', 'base', 'version_base', 'version_candidat'].every((k) => d[k] === v.piece.demande[k])) throw new Error('faits d\'une autre demande que celle copiée pour cette tentative. Rien n\'est conservé');
      const c = structuredClone(lu.copie);
      c.pieces[v.cle].faits.push(texte);
      engager(c);
      ui.faits = '';
      dire('verification', `Faits reçus (run ${lf.faits.provenance.run_id}) : verdict technique recalculé ci-dessous.`);
    } catch (e) { dire('verification', `Confrontation impossible : ${e.message}.`, true); }
    rendre();
  }
  // Geste 4 : décision humaine. Le verdict est RECALCULÉ au moment du geste ; le motif est écrit par Christophe.
  function decider(type) {
    if (!parcoursPermis()) return;
    try {
      exiger(type === 'tentative-acceptee' ? 'accepter' : 'refuser');
      const motif = ui.motifDecision || '';
      if (motif.trim() === '') throw new Error('motif humain obligatoire');
      const c = confrontationCourante();
      const verdict = c.resultat.verdict_technique;
      if (type === 'tentative-acceptee' && verdict !== CONFORME) throw new Error('acceptation possible seulement sur un verdict technique conforme');
      if (type === 'tentative-rejetee' && verdict !== CONFORME && verdict !== NON_CONFORME) throw new Error('refus possible seulement sur un verdict technique exploitable');
      const f = c.faits.lu.faits;
      engager(avecEvenement(type, { jalon: c.j.id, numero: c.t.numero, motif, candidat: candidatDe(c).sha, faits: f.empreinte, verdict, run_id: f.provenance.run_id }));
      ui.motifDecision = '';
      dire('decision', type === 'tentative-acceptee' ? `Candidat accepté (décision humaine, tentative ${c.t.numero}). Ce n'est ni un dépôt, ni une acquisition ; main est inchangé.` : `Candidat refusé (décision humaine, tentative ${c.t.numero}).`);
    } catch (e) { dire('decision', `Décision impossible : ${e.message}.`, true); }
    rendre();
  }
  function annuler() {
    if (!pilote() || (autoRendue(vivanteCourante()) && !auto())) return;
    try {
      exiger('annuler');
      const motif = ui.motifDecision || '';
      if (motif.trim() === '') throw new Error('motif humain obligatoire');
      const v = vivanteCourante();
      engager(avecEvenement('tentative-annulee', { jalon: v.j.id, numero: v.t.numero, motif }));
      ui.motifDecision = '';
      dire('decision', `Tentative ${v.t.numero} annulée (état technique).`);
    } catch (e) { dire('decision', `Annulation impossible : ${e.message}.`, true); }
    rendre();
  }
  // ---------------------------------------------------------------------------------------------- AUTO à blanc (AT-8.1)
  const formulaireAuto = () => lu.copie.formulaire.auto || (lu.copie.formulaire.auto = autoVide());
  // Appel prévu lu du formulaire : entiers sans zéro de tête, tarifs plafonds en USD par million de jetons (lireUSD), appels = 1.
  function appelDuFormulaire(f = formulaireAuto()) {
    const entier = (v, nom) => { if (!/^[1-9][0-9]{0,8}$/.test(v)) throw new Error(`${nom} : entier sans zéro de tête attendu`); return Number(v); };
    const tarif = (v, nom) => { const m = lireUSD(v); if (typeof m !== 'number') throw new Error(`${nom} : ${m.raison}`); return m; };
    const appel = { modele: f.modele, entree_max: entier(f.entree_max, 'Jetons d\'entrée max'), max_tokens: entier(f.max_tokens, 'Jetons de sortie max'),
      tarif_entree: tarif(f.tarif_entree, 'Tarif plafond d\'entrée'), tarif_sortie: tarif(f.tarif_sortie, 'Tarif plafond de sortie'), appels: 1 };
    const a = lireAppel(appel);
    if (a.raison) throw new Error(`appel prévu refusé (${a.raison}) : modèle en minuscules, chiffres, points et tirets ; entrée <= 200000 ; sortie <= 64000 ; tarifs de 0,000001 à 1000 USD par million`);
    return a;
  }
  const tentativeAuto = (v) => !!v && tentativesDuJournal(lu.copie.journal).some((x) => x.jalon === v.j.id && x.numero === v.t.numero && x.mode === 'AUTO');
  // AT-8.2 : témoin du formulaire (null sans témoin) ; jeton tiré sur l'appareil ; lancement et vivante témoin ; issues inconnues ouvertes.
  const formulaireTemoin = () => (lu.copie.formulaire.temoin ? lu.copie.formulaire.temoin : null);
  function tirerJeton() {
    const o = hasard(16);
    if (!(o instanceof Uint8Array) || o.length !== 16) throw new Error('hasard indisponible : aucun jeton tiré');
    return [...o].map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  function temoinDuFormulaire(appel) {
    const f = formulaireTemoin();
    if (!f) return null;
    const usdOu = (v, nom) => { const m = lireUSD(v); if (typeof m !== 'number') throw new Error(`${nom} : ${m.raison}`); return m; };
    const temoin = { jeton: f.jeton, tarif_entree: usdOu(f.tarif_entree, 'Tarif constaté d\'entrée'), tarif_sortie: usdOu(f.tarif_sortie, 'Tarif constaté de sortie') };
    const t = lireTemoin(temoin, appel);
    if (t.raison) throw new Error(`témoin refusé (${t.raison}) : jeton de 32 hexadécimaux, tarifs constatés <= tarifs plafonds, sortie <= 64 jetons, entrée max >= 1000 jetons`);
    const engagement = usdOu(f.maximum, 'Engagement');
    if (engagement < estimationMax(appel)) throw new Error(`engagement ${usd(engagement)} inférieur à l'estimation maximale ${usd(estimationMax(appel))}`);
    return { temoin: t, engagement };
  }
  // AT-9.1 : développement du formulaire (null sans développement) ; effort low, medium ou high ; tarifs constatés <= plafonds.
  const formulaireDeveloppement = () => (lu.copie.formulaire.developpement ? lu.copie.formulaire.developpement : null);
  function developpementDuFormulaire(appel, f = formulaireDeveloppement()) {
    if (!f) return null;
    const usdOu = (v, nom) => { const m = lireUSD(v); if (typeof m !== 'number') throw new Error(`${nom} : ${m.raison}`); return m; };
    const ex = lireExtraitsTexte(f.extraits);
    if (ex.raison) throw new Error(`extraits illisibles${ex.ligne ? ` (« ${ex.ligne} »)` : ''} : une ligne « chemin début-fin » par extrait`);
    const dev = { effort: f.effort, tarif_entree: usdOu(f.tarif_entree, 'Tarif constaté d\'entrée'), tarif_sortie: usdOu(f.tarif_sortie, 'Tarif constaté de sortie'), extraits: ex.extraits };
    const d = lireDeveloppement(dev, appel);
    if (d.raison) throw new Error(`développement refusé (${d.raison}) : effort ${EFFORTS.join(', ')} ; tarifs constatés <= tarifs plafonds ; sortie >= 1024 jetons ; extraits sans chevauchement, 30 au plus`);
    const engagement = usdOu(f.maximum, 'Engagement');
    if (engagement < estimationMax(appel)) throw new Error(`engagement ${usd(engagement)} inférieur à l'estimation maximale ${usd(estimationMax(appel))}`);
    return { developpement: d, engagement };
  }
  const lancementDe = (jalon, numero) => { const x = tentativesDuJournal(lu.copie.journal).find((y) => y.jalon === jalon && y.numero === numero); return x ? lu.copie.journal[x.n - 1] : null; };
  const vivanteTemoin = (v) => !!v && tentativeAuto(v) && Object.hasOwn(lancementDe(v.j.id, v.t.numero).donnees, 'temoin');
  const vivanteDeveloppement = (v) => !!v && tentativeAuto(v) && Object.hasOwn(lancementDe(v.j.id, v.t.numero).donnees, 'developpement');
  const vivanteReelle = (v) => vivanteTemoin(v) || vivanteDeveloppement(v);
  function inconnuesOuvertes() {
    const e = etatChantier();
    if (!e || !lu.copie.registre) return [];
    const b = etatBudget(lu.copie.registre);
    return tentativesDuJournal(lu.copie.journal).filter((t) => t.mode === 'AUTO' && t.decision && t.decision.donnees.issue === 'issue-inconnue')
      .map((t) => ({ t, id: `${e.id}/${t.jalon}/${t.numero}`, x: b.executions[`${e.id}/${t.jalon}/${t.numero}`] })).filter((y) => y.x && y.x.statut === 'engagee');
  }
  // Lancement AUTO : tentative AT-1 + instantané + engagement AT-2 de T, dans UNE copie vérifiée entière ; un refus de l'un : rien.
  function lancerAuto() {
    if (!auto()) return;
    try {
      exiger('lancer');
      const et = etapeCourante();
      const m = lu.copie.mission;
      if (!m || m.jalon.id !== et.jalon || m.tentative !== et.numero) throw new Error(`génère d'abord le dossier de la tentative ${et.numero}`);
      exigerPreparation();
      const e = etatChantier();
      const id = identiteT({ chantier: e.id, jalon: et.jalon, numero: et.numero });
      if (id.raison) throw new Error('identité T invalide');
      const appel = appelDuFormulaire();
      if (!lu.copie.registre) throw new Error('ouvre d\'abord le cycle de budget (section 4)');
      if (inconnuesOuvertes().length > 0) throw new Error('une ISSUE INCONNUE n\'est pas régularisée : aucun nouveau lancement AUTO');
      const tm = temoinDuFormulaire(appel);
      const dv = tm ? null : developpementDuFormulaire(appel);
      const maximum = tm ? tm.engagement : dv ? dv.engagement : estimationMax(appel);
      engager(avecEvenement('tentative-lancee', { jalon: et.jalon, mode: 'AUTO', appel: { ...appel }, ...(tm ? { temoin: { ...tm.temoin } } : {}), ...(dv ? { developpement: { ...dv.developpement } } : {}) }, (c) => {
        c.pieces[cleTentative(et.jalon, et.numero)] = { mission: structuredClone(m), rapport: null, demande: null, faits: [] };
        const r = appliquerBudget(c.registre, { type: 'engagement', quand: maintenant(), donnees: { execution: id.t, chantier: e.id, maximum } });
        if (!Array.isArray(r)) throw new Error(`engagement refusé (${r.limite}) : ${r.raison}. Rien n'est lancé`);
        c.registre = r;
      }));
      ui.dossier = null; ui.preparation = null;
      ui.section = 'sauvegarde';
      dire('sauvegarde', `Tentative ${et.numero} lancée en AUTO ${tm ? 'avec TÉMOIN RÉEL (UN appel possible après ton approbation)' : dv ? 'avec APPEL DE DÉVELOPPEMENT (UN appel possible après ton approbation)' : 'à blanc'} (T = ${id.t}, engagement ${usd(maximum)}). Sauvegarde durable requise avant la demande AUTO (D3).`);
    } catch (err) { dire('auto', `Lancement AUTO impossible : ${err.message}.`, true); }
    rendre();
  }
  // Demande AUTO : seulement si la dernière sauvegarde confirmée contient le lancement ET désigne l'état ACTUEL (la garde J1 exigera
  // que ce commit soit la tête de journal-atelier/<chantier> et que chantier.json ait cette empreinte). Rien n'est enregistré.
  const demandeAutoPossible = (v) => !!v && lancementSauvegarde(v) && lu.copie.sauvegarde.empreinte === empreinteDe(durableCourant());
  async function copierDemandeAuto() {
    if (!auto()) return;
    try {
      exiger('copier-demande-auto');
      const v = vivanteCourante();
      if (!demandeAutoPossible(v)) throw new Error('sauvegarde durable confirmée et à jour requise (D3)');
      const s = lu.copie.sauvegarde;
      await copierVers('demande-auto', texteDemandeAuto({ chantier: v.e.id, jalon: v.j.id, numero: v.t.numero, commit: s.commit, empreinte: s.empreinte, temoin: vivanteTemoin(v), developpement: vivanteDeveloppement(v) }), 'Demande AUTO');
    } catch (err) { dire('auto', `Demande AUTO impossible : ${err.message}.`, true); }
    rendre();
  }
  // Clôture AUTO : faits AUTO lisibles (empreinte, appel_emis = false) de CETTE tentative + motif humain ; tentative annulée citant les
  // faits (texte exact conservé) et coût réel 0 inscrit pour T, dans UNE copie vérifiée. Aucun appel n'existe : 0 est certain.
  function cloreAuto() {
    if (!auto()) return;
    try {
      exiger('clore-auto');
      const motif = ui.motifAuto || '';
      if (motif.trim() === '') throw new Error('motif humain obligatoire');
      const texte = ui.faitsAuto.endsWith('\n') ? ui.faitsAuto : `${ui.faitsAuto}\n`;
      const lf = lireFaitsAuto(texte);
      if (lf.raison) throw new Error(`faits AUTO illisibles : ${lf.raison}. Rien n'est conservé`);
      const v = vivanteCourante();
      if (vivanteReelle(v)) throw new Error('tentative avec appel réel possible : « Lire les faits », puis clore selon l\'issue');
      const id = identiteT({ chantier: v.e.id, jalon: v.j.id, numero: v.t.numero });
      if (lf.faits.tentative !== id.t) throw new Error(`faits d'une autre tentative (${lf.faits.tentative}) que ${id.t}. Rien n'est conservé`);
      const d = decisionCloture({ faits: lf.faits, t: id.t, temoin: false });
      if (d.raison || d.montant !== 0) throw new Error(`ces faits ne prouvent pas l'absence d'émission (${d.raison || d.issue}). Rien n'est conservé`);
      engager(avecEvenement('tentative-annulee', { jalon: v.j.id, numero: v.t.numero, motif, mode: 'AUTO', faits_auto: texte, faits_auto_empreinte: lf.faits.empreinte }, (c) => {
        const r = appliquerBudget(c.registre, { type: 'cout', quand: maintenant(), donnees: { execution: id.t, montant: 0 } });
        if (!Array.isArray(r)) throw new Error(`coût réel 0 refusé (${r.limite}) : ${r.raison}. Rien n'est clos`);
        c.registre = r;
      }));
      ui.faitsAuto = ''; ui.motifAuto = ''; ui.retourMission = ''; ui.lectureRetour = null;
      dire('auto', `Tentative ${v.t.numero} AUTO close : ${lf.faits.etape} ${lf.faits.resultat || lf.faits.issue}${lf.faits.raison ? ` (${lf.faits.raison})` : ''}, aucun appel, coût réel 0 inscrit. Sauvegarde durable à refaire.`);
    } catch (err) { dire('auto', `Clôture AUTO impossible : ${err.message}.`, true); }
    rendre();
  }
  // AT-8.2 : faits collés d'une tentative TÉMOIN, lus et décidés par auto.js (decisionCloture) ; rien n'est écrit par la lecture.
  const RAISONS_CLOTURE = Object.freeze({ 'faits-autre-tentative': 'faits d\'une autre tentative', 'faits-intermediaires': 'faits intermédiaires (garde autorisée ou frontière prête) : colle les faits de l\'appel (J2) ou du constat (J3)', 'hors-premier-essai': 'faits d\'un autre essai que le premier, ou hors de main', 'constat-sans-objet': 'constat sans objet (garde non franchie) : colle les faits de la garde J1', 'protocole inconnu': 'protocole inconnu' });
  function lireFaitsColles() {
    const v = vivanteCourante();
    if (!vivanteReelle(v)) throw new Error('aucune tentative témoin ou développement vivante');
    const texte = ui.faitsAuto.endsWith('\n') ? ui.faitsAuto : `${ui.faitsAuto}\n`;
    const lf = lireFaitsAuto(texte);
    if (lf.raison) throw new Error(`faits AUTO illisibles : ${lf.raison}`);
    const id = identiteT({ chantier: v.e.id, jalon: v.j.id, numero: v.t.numero });
    const d = decisionCloture({ faits: lf.faits, t: id.t, temoin: true });
    if (d.raison) throw new Error(RAISONS_CLOTURE[d.raison] || d.raison);
    return { v, id, texte, faits: lf.faits, d };
  }
  // v0.65.16 : texte J4 collé (saut de ligne final ajouté s'il manque), et retour AUTO lu des textes actuellement collés (null sans J4).
  const texteJ4 = () => (ui.faitsCandidat === '' ? '' : ui.faitsCandidat.endsWith('\n') ? ui.faitsCandidat : `${ui.faitsCandidat}\n`);
  const lireRetourColle = (l) => (texteJ4() === '' ? null : lireRetourAuto({ j2Texte: l.texte, j4Texte: texteJ4(), t: l.id.t, mission: l.v.piece.mission }));
  function lireFaitsTemoin() {
    if (!auto()) return;
    try {
      exiger('clore-auto');
      const l = lireFaitsColles();
      const retour = vivanteDeveloppement(l.v) && l.d.issue === 'reponse-connue' ? lireRetourColle(l) : null;
      ui.lectureAuto = { texte: l.texte, issue: l.d.issue, montant: l.d.montant, faits: l.faits, texteJ4: texteJ4(), retour };
      dire('auto', `Faits lus : ${LIBELLE_ISSUE[l.d.issue]}${retour ? (retour.raison ? ` ; retour J4 refusé : ${raisonRetour(retour.raison)}` : ' ; candidat AUTO lisible') : ''}. Rien n'est encore écrit.`, l.d.issue === 'issue-inconnue' || !!(retour && retour.raison));
    } catch (err) { ui.lectureAuto = null; dire('auto', `Lecture des faits impossible : ${err.message}. Rien n'est conservé.`, true); }
    rendre();
  }
  // v0.65.21 — AT-10.4 : bloc ATELIER-RETOUR-1 collé, relu contre T, la sauvegarde confirmée et la pièce de T ; rien n'est écrit.
  const texteRetourColle = () => (ui.retourMission.endsWith('\n') ? ui.retourMission : `${ui.retourMission}\n`);
  function lireRetourMission() {
    if (!auto()) return;
    try {
      exiger('clore-auto');
      const v = vivanteCourante();
      if (!v) throw new Error('aucune tentative AUTO vivante');
      const s = lu.copie.sauvegarde;
      if (!s || !RE_SHA.test(s.commit || '')) throw new Error('sauvegarde durable confirmée requise (celle que le run a lue)');
      const lr = lireRetour(texteRetourColle());
      if (lr.raison) throw new Error(lr.raison);
      const t = identiteT({ chantier: v.e.id, jalon: v.j.id, numero: v.t.numero }).t;
      const c = controlerRetour(lr.retour, { t, d3: { commit: s.commit, empreinte: s.empreinte }, mission: v.piece.mission });
      if (c.raison) throw new Error(c.raison);
      ui.lectureRetour = { texte: texteRetourColle(), retour: lr.retour, principal: c.principal, utilises: c.utilises };
      dire('auto', `Retour de Claude lisible (empreinte ${lr.retour.empreinte.slice(0, 16)}…) : compare chaque empreinte avec la page du run, puis « utiliser ces faits ». Rien n'est encore écrit.`);
    } catch (err) { ui.lectureRetour = null; dire('auto', `Retour de Claude refusé : ${err.message}. Rien n'est conservé ; la copie manuelle des faits reste possible.`, true); }
    rendre();
  }
  // Place les faits relus dans les champs existants (fait principal, J4, AT-5) ; la lecture habituelle (« Lire le retour ») reste à faire.
  function utiliserRetour() {
    if (!auto()) return;
    try {
      exiger('clore-auto');
      const l = ui.lectureRetour;
      if (!l || l.texte !== texteRetourColle()) throw new Error('lis d\'abord le retour de Claude');
      const f = l.retour.faits;
      ui.faitsAuto = f[l.principal].texte;
      ui.faitsCandidat = Object.hasOwn(f, 'j4') ? f.j4.texte : '';
      ui.faits = Object.hasOwn(f, 'at5') ? f.at5.texte : '';
      ui.lectureAuto = null;
      dire('auto', `Faits placés : ${l.utilises.map((g) => LIBELLES_FAITS[g]).join(', ')}. Lis-les ci-dessous comme d'habitude, puis clore ou enregistrer.`);
    } catch (err) { dire('auto', `Faits non placés : ${err.message}.`, true); }
    rendre();
  }
  function cloreTemoin() {
    if (!auto()) return;
    try {
      exiger('clore-auto');
      const motif = ui.motifAuto || '';
      if (motif.trim() === '') throw new Error('motif humain obligatoire');
      const l = lireFaitsColles();
      if (!ui.lectureAuto || ui.lectureAuto.texte !== l.texte) throw new Error('lis d\'abord ces faits (« Lire les faits »)');
      engager(avecEvenement('tentative-annulee', { jalon: l.v.j.id, numero: l.v.t.numero, motif, mode: 'AUTO', issue: l.d.issue, faits_auto: l.texte, faits_auto_empreinte: l.faits.empreinte }, (c) => {
        if (l.d.montant === null) return; // ISSUE INCONNUE : AUCUN coût inscrit, l'engagement reste ouvert
        const r = appliquerBudget(c.registre, { type: 'cout', quand: maintenant(), donnees: { execution: l.id.t, montant: l.d.montant, issue: l.d.issue } });
        if (!Array.isArray(r)) throw new Error(`coût réel refusé (${r.limite}) : ${r.raison}. Rien n'est clos`);
        c.registre = r;
      }));
      ui.faitsAuto = ''; ui.motifAuto = ''; ui.lectureAuto = null; ui.retourMission = ''; ui.lectureRetour = null;
      dire('auto', l.d.montant === null
        ? `Tentative ${l.v.t.numero} : ISSUE INCONNUE constatée. Aucun coût inscrit, engagement maintenu ouvert, aucune relance ; régularisation humaine obligatoire. Sauvegarde durable à refaire.`
        : `Tentative ${l.v.t.numero} close : ${LIBELLE_ISSUE[l.d.issue]}, coût réel ${usd(l.d.montant)} inscrit. Sauvegarde durable à refaire.`, l.d.montant === null);
    } catch (err) { dire('auto', `Clôture impossible : ${err.message}.`, true); }
    rendre();
  }
  // v0.65.16 — AT-10.5 : « Enregistrer le candidat AUTO ». UNE copie vérifiée : tentative rendue (textes exacts J2 et J4, empreintes),
  // coût réel de J2 inscrit pour T, demande AT-5 de J4 figée. Le motif n'est pas exigé : c'est un transport vérifié, pas une décision.
  function enregistrerAuto() {
    if (!auto()) return;
    try {
      exiger('enregistrer-auto');
      const v = vivanteCourante();
      if (!vivanteDeveloppement(v)) throw new Error('tentative AUTO d\'appel de développement attendue');
      const l = lireFaitsColles();
      const lu4 = ui.lectureAuto;
      if (!lu4 || lu4.texte !== l.texte || lu4.texteJ4 !== texteJ4() || texteJ4() === '') throw new Error('lis d\'abord ces faits J2 et J4 (« Lire le retour »)');
      const r = lireRetourColle(l);
      if (r.raison) throw new Error(raisonRetour(r.raison));
      const retour = r.retour;
      const s = lu.copie.sauvegarde;
      if (!lancementSauvegarde(v) || s.commit !== retour.j2.etat.commit || s.empreinte !== retour.j2.etat.empreinte) throw new Error('le run n\'a pas lu l\'état de cet appareil (sauvegarde confirmée différente de l\'état lu par J2 et J4)');
      if (!demandeAutoPossible(v)) throw new Error('le run n\'a pas lu l\'état de cet appareil (état modifié depuis la sauvegarde confirmée)');
      const ld = lireDemande(retour.demande);
      if (ld.raison) throw new Error(`demande AT-5 de J4 illisible : ${ld.raison}`);
      engager(avecEvenement('tentative-rendue', { jalon: v.j.id, numero: v.t.numero, reference: retour.reference, mode: 'AUTO', faits_auto: l.texte, faits_auto_empreinte: retour.j2.empreinte, faits_candidat: texteJ4(), faits_candidat_empreinte: retour.j4.empreinte }, (c) => {
        c.pieces[v.cle].demande = { ...retour.demande };
        const b = appliquerBudget(c.registre, { type: 'cout', quand: maintenant(), donnees: { execution: l.id.t, montant: retour.montant, issue: 'reponse-connue' } });
        if (!Array.isArray(b)) throw new Error(`coût réel refusé (${b.limite}) : ${b.raison}`);
        c.registre = b;
      }));
      ui.faitsAuto = ''; ui.faitsCandidat = ''; ui.motifAuto = ''; ui.lectureAuto = null; ui.retourMission = ''; ui.lectureRetour = null;
      ui.section = 'verification';
      dire('verification', `Candidat AUTO enregistré (tentative ${v.t.numero} rendue : ${retour.reference}), coût réel ${usd(retour.montant)} inscrit. Il n'est pas vérifié : copie la demande AT-5 pour Claude.`);
    } catch (err) { dire('auto', `Enregistrement du candidat AUTO impossible : ${err.message}. Rien n'est enregistré.`, true); }
    rendre();
  }
  // Régularisation HUMAINE d'une issue inconnue : montant > 0 (microdollars entiers) et motif ; seul geste qui solde son engagement.
  function regulariser(execution) {
    if (!auto()) return;
    try {
      const y = inconnuesOuvertes().find((z) => z.id === execution);
      if (!y) throw new Error('aucune issue inconnue ouverte pour cette exécution');
      const montant = lireUSD(ui.montantRegul);
      if (typeof montant !== 'number') throw new Error(`montant : ${montant.raison}`);
      if (montant < 1) throw new Error('montant nul refusé : une issue inconnue ne devient jamais un coût 0');
      const motif = ui.motifRegul || '';
      if (motif.trim() === '') throw new Error('motif obligatoire (ce que montre la Console)');
      const r = appliquerBudget(lu.copie.registre, { type: 'cout', quand: maintenant(), donnees: { execution, montant, issue: 'issue-inconnue', regularisation: motif } });
      if (!Array.isArray(r)) throw new Error(`coût refusé (${r.limite}) : ${r.raison}`);
      engager({ ...structuredClone(lu.copie), registre: r });
      ui.montantRegul = ''; ui.motifRegul = '';
      dire('auto', `Issue inconnue de ${execution} régularisée : coût réel ${usd(montant)} inscrit. Sauvegarde durable à refaire.`);
    } catch (err) { dire('auto', `Régularisation impossible : ${err.message}.`, true); }
    rendre();
  }
  function effacer() {
    // v0.65.19 (E-T1) : confirmations exclusives ; armer l'effacement du chantier désarme celui du carnet.
    if (!ui.confirmerEffacement) { ui.confirmerEffacement = true; ui.confirmerEffacementCarnet = false; rendre(); return; }
    try { if (stockage) stockage.removeItem(CLE_ATELIER); } catch { /* rien à faire de plus */ }
    lu = { copie: copieVide(version) };
    ui = uiVide();
    rendre();
  }
  // ---------------------------------------------------------------------------------------------- sauvegarde et reprise (AT-7)
  const atelierVide = () => !!lu.copie && lu.copie.journal === null && lu.copie.registre === null && lu.copie.mission === null && Object.keys(lu.copie.pieces).length === 0;
  // Texte canonique de l'état durable courant (comparaison seulement) et son empreinte, mémorisée par texte.
  const durableCourant = () => (lu.copie && lu.copie.journal ? canonique(etatDurableDe(lu.copie)) : null);
  let memo = { texte: null, empreinte: null };
  const empreinteDe = (texte) => { if (memo.texte !== texte) memo = { texte, empreinte: hacherSha256(texte) }; return memo.empreinte; };
  function preparerSauvegarde() {
    if (!pilote()) return;
    try {
      const d = ecrireEtatDurable(lu.copie);
      ui.preparation = { ...d, parties: decouper(d.texte, etatChantier().id) };
      dire('sauvegarde', `${ui.preparation.parties.length} partie(s) prête(s) : copie-les une à une, chacune dans son propre message à Claude.`);
    } catch (e) { ui.preparation = null; dire('sauvegarde', `Sauvegarde impossible : ${e.message}`, true); }
    rendre();
  }
  async function copierPartie(k) {
    if (!pilote() || !ui.preparation || ui.preparation.texte !== durableCourant()) return;
    await copierVers('sauvegarde', ui.preparation.parties[k - 1], `Partie ${k}/${ui.preparation.parties.length}`);
    rendre();
  }
  // La confirmation de Claude n'est retenue que si elle désigne l'état durable ACTUEL de cet appareil (même chantier, même empreinte).
  function enregistrerConfirmation() {
    if (!pilote()) return;
    try {
      const lc = lireConfirmation(ui.confirmation);
      if (lc.raison) throw new Error(lc.raison);
      const e = etatChantier();
      if (!e) throw new Error('aucun chantier sur cet appareil');
      if (lc.chantier !== e.id) throw new Error(`confirmation du chantier « ${lc.chantier} », pas de « ${e.id} »`);
      if (lc.empreinte !== ecrireEtatDurable(lu.copie).empreinte) throw new Error('confirmation d\'un autre état que l\'état actuel de cet appareil (état modifié depuis, ou autre sauvegarde). Rien n\'est enregistré');
      const c = structuredClone(lu.copie);
      c.sauvegarde = { empreinte: lc.empreinte, commit: lc.commit, evenements: c.journal.length };
      engager(c);
      ui.confirmation = '';
      dire('sauvegarde', `Sauvegarde durable confirmée : ${brancheJournal(e.id)} @ ${lc.commit} (empreinte ${lc.empreinte.slice(0, 16)}…).`);
    } catch (err) { dire('sauvegarde', `Confirmation refusée : ${err.message}.`, true); }
    rendre();
  }
  // Restauration : atelier VIDE seulement ; une partie refusée n'est pas conservée ; rien n'est installé avant la confirmation.
  function ajouterPartie() {
    if (!pilote()) return;
    const texte = ui.partie;
    const r = atelierVide() ? preparerRestauration([...ui.parties, texte]) : { statut: 'refuse', raison: 'l\'atelier de cet appareil n\'est pas vide' };
    if (r.statut === 'refuse') dire('sauvegarde', `Partie refusée : ${r.raison}. Rien n'est conservé de ce collage.`, true);
    else if (ui.parties.includes(texte)) { ui.partie = ''; dire('sauvegarde', 'Partie déjà reçue : doublon identique ignoré.'); } else { ui.parties = [...ui.parties, texte]; ui.partie = ''; ui.message = null; }
    rendre();
  }
  function confirmerRestauration() {
    if (!pilote()) return;
    try {
      if (!atelierVide()) throw new Error('l\'atelier de cet appareil n\'est pas vide');
      const r = preparerRestauration(ui.parties);
      if (r.statut !== 'pret') throw new Error(r.raison || 'parties incomplètes');
      const d = r.lu.durable;
      engager({ ...copieVide(version), journal: structuredClone(d.journal), registre: structuredClone(d.registre), pieces: structuredClone(d.pieces), piecesDepuis: d.piecesDepuis });
      ui = uiVide();
      dire('bandeau', `Chantier « ${d.chantier} » restauré (empreinte ${r.empreinte.slice(0, 16)}…). Mode OFF : passe en MANUEL pour continuer.`);
    } catch (e) { dire('sauvegarde', `Restauration impossible : ${e.message}.`, true); }
    rendre();
  }
  function abandonnerRestauration() {
    if (!pilote()) return;
    ui.parties = []; ui.partie = ''; ui.message = null;
    rendre();
  }

  // ---------------------------------------------------------------------------------------------- rendu
  const sections = [];
  function section(nom, titre, ...contenu) {
    const d = el('details', { classe: 'bloc atelier-section', attrs: { 'data-atelier-section': nom } }, el('summary', { texte: titre }), ...contenu);
    d.open = ui.section === nom;
    d.addEventListener('toggle', () => {
      if (d.open) { ui.section = nom; for (const autre of sections) if (autre !== d) autre.open = false; } else if (ui.section === nom) ui.section = null;
    });
    sections.push(d);
    return d;
  }
  const ligneTexte = (texte, nom) => el('p', { classe: 'aide atelier-ligne', texte, attrs: nom ? { 'data-atelier': nom } : {} });

  // v0.65.17 — AT-10.5.1 (dette UX 1) : le bandeau est coupé en deux blocs consécutifs, dans le MÊME ordre de lecture qu'avant.
  // Tête collante compacte (data-atelier « bandeau ») : version, titres, avertissement, mode et boutons, témoin ; elle reste visible.
  // Consignes longues (data-atelier « bandeau-consignes ») : prochaine étape, avertissement AUTO, message ; elles défilent.
  // L'enveloppe est en display: contents (styles.css) : la tête reste collante sur toute la hauteur de l'écran, comme avant.
  // Garde : si la tête dépasse la moitié de l'écran (texte très agrandi, téléphone en paysage), elle cesse d'être collante
  // (data-collant « non ») pour qu'aucune commande ne soit jamais recouverte ; aucun défilement interne n'est introduit.
  // v0.65.17 — AT-10.5.1 correction C1 (GO ChatGPT 21/10/2026) : un message d'ERREUR actif du bandeau se lit juste après la tête, dans
  // son propre bloc collant (data-atelier « bandeau-erreur ») : collé sous la tête quand elle est collante, en haut de l'écran quand la
  // garde l'a libérée (texte agrandi, paysage) ; il est donc vu sans défilement quel que soit l'endroit du geste. Le message ordinaire
  // (restauration) reste dans les consignes. La garde compte la tête ET l'erreur.
  function bandeau(e) {
    const c = lu.copie;
    const erreurActive = !!(ui.message && ui.message.section === 'bandeau' && ui.message.erreur);
    const idChantier = e ? e.id : c ? c.formulaire.chantier : '';
    const modes = c ? el('div', { classe: 'ligne' },
      el('span', { texte: `Mode : ${c.mode}`, attrs: { 'data-atelier': 'mode' } }),
      ...MODES.map((m) => {
        const b = bouton(m, `mode-${m.toLowerCase()}`, () => { c.mode = m; ui.dossier = null; ui.verification = null; sauver(); rendre(); });
        b.setAttribute('aria-pressed', String(c.mode === m));
        return b;
      })) : null;
    const tete = el('div', { classe: 'atelier-bandeau', attrs: { 'data-atelier': 'bandeau', 'data-collant': 'oui' } },
      el('p', { classe: 'aide', texte: `Naissance v${version}`, attrs: { 'data-atelier': 'version-apk' } }),
      el('div', { classe: 'atelier-titres' },
        el('p', { classe: 'atelier-titre', texte: 'ATELIER DE DÉVELOPPEMENT' }),
        el('p', { classe: 'atelier-titre', texte: 'OUTILLAGE NON COGNITIF' })),
      el('p', { classe: 'aide', texte: 'Rien ici n\'est une acquisition de Naissance.' }),
      modes,
      idChantier.startsWith('temoin-') ? el('div', { classe: 'atelier-temoin', attrs: { 'data-atelier': 'temoin-bandeau' } },
        el('p', { classe: 'atelier-titre', texte: 'CHANTIER TÉMOIN' }), el('p', { classe: 'aide', texte: 'Démonstration — aucun développement réel.' })) : null);
    const erreur = erreurActive ? el('div', { classe: 'atelier-bandeau-erreur', attrs: { 'data-atelier': 'bandeau-erreur' } }, message('bandeau')) : null;
    const consignes = [
      c ? el('p', { classe: 'aide', texte: `Prochaine étape : ${attenteD3() ? CONSIGNE_D3 : auto() && etapeCourante().etape === 'mission-a-lancer' ? CONSIGNE_AUTO : etapeCourante().etape === 'auto-lancee' && vivanteDeveloppement(vivanteCourante()) ? CONSIGNE_AUTO_DEV : etapeCourante().consigne}`, attrs: { 'data-atelier': 'prochaine-etape' } }) : null,
      c && auto() ? el('p', { classe: 'aide', texte: vivanteDeveloppement(vivanteCourante()) ? 'Mode AUTO, APPEL DE DÉVELOPPEMENT : après ton approbation, et seulement si la clé existe, le run fait UNE requête au plus, puis crée au plus UNE branche candidate. Aucune relance.' : vivanteTemoin(vivanteCourante()) ? 'Mode AUTO, TÉMOIN RÉEL : après ton approbation, et seulement si la clé existe, le run fait UNE requête au plus. Aucune relance.' : 'Mode AUTO à blanc : aucun appel de modèle, aucune clé, aucun secret. Le run s\'arrête sur PRET_A_APPELER.', attrs: { 'data-atelier': 'auto-bandeau' } }) : null,
      erreurActive ? null : message('bandeau')].filter(Boolean);
    if (typeof ResizeObserver === 'function') {
      const garde = new ResizeObserver(() => {
        if (!tete.isConnected) { garde.disconnect(); return; }
        const collant = tete.offsetHeight + (erreur ? erreur.offsetHeight : 0) <= globalThis.innerHeight / 2;
        tete.setAttribute('data-collant', collant ? 'oui' : 'non');
        if (erreur) erreur.setAttribute('style', `top: ${collant ? tete.offsetHeight : 0}px`);
      });
      garde.observe(tete);
      if (erreur) garde.observe(erreur);
      garde.observe(document.documentElement);
    }
    return el('div', { classe: 'atelier-bandeau-enveloppe' }, tete, erreur,
      consignes.length ? el('div', { classe: 'atelier-bandeau-consignes', attrs: { 'data-atelier': 'bandeau-consignes' } }, ...consignes) : null);
  }

  function sectionChantier(e) {
    const c = lu.copie;
    const f = c.formulaire;
    if (e) {
      const arret = e.statut === 'ouvert' || e.statut === 'en-cours' || e.statut === 'bloque';
      return section('chantier', '1. Chantier (état technique)',
        ligneTexte(`Identifiant : ${e.id}`), ligneTexte(`Objectif : ${e.objectif}`), ligneTexte(`Version de base : ${e.base.version}`),
        ligneTexte(`SHA de base : ${e.base.sha}`), ligneTexte(`Statut technique : ${e.statut}`, 'statut'),
        arret ? champ('Motif d\'un arrêt', ui.motifArret || '', (v) => { ui.motifArret = v; }, { nom: 'motif-arret' }) : null,
        arret ? bouton('Arrêter définitivement le chantier', 'arreter', agir('chantier', () => appliquerChantier('chantier-arrete', { motif: ui.motifArret || '' }, 'chantier', 'Chantier arrêté (état technique).')), { actif: pilote() }) : null,
        message('chantier'));
    }
    const jalons = f.jalons.map((j, i) => el('div', { classe: 'atelier-jalon' },
      ligneTexte(`Jalon ${i + 1}`),
      champ('Identifiant du jalon', j.id, (v) => { j.id = v; }, { nom: `jalon-${i}-id` }),
      champ('Titre', j.titre, (v) => { j.titre = v; }, { nom: `jalon-${i}-titre` }),
      champ('Critère (AT-1)', j.critere, (v) => { j.critere = v; }, { nom: `jalon-${i}-critere`, multi: true, rangs: 2 }),
      champ('Tentatives max', j.tentativesMax, (v) => { j.tentativesMax = v; }, { nom: `jalon-${i}-tentatives`, clavier: 'numeric' })));
    return section('chantier', '1. Chantier (préparation)',
      bouton('Remplir avec le chantier TÉMOIN', 'temoin', agir('chantier', () => { const t = temoin(version); c.formulaire = t.formulaire; c.fiches = { 'temoin-1': t.fiche }; sauver(); dire('chantier', 'Chantier TÉMOIN prérempli. Colle le SHA de base, puis ouvre le chantier.'); }), { actif: pilote() }),
      champ('Identifiant du chantier', f.chantier, (v) => { f.chantier = v; }, { nom: 'chantier-id', aide: 'Lettres minuscules, chiffres et tirets.' }),
      champ('Objectif', f.objectif, (v) => { f.objectif = v; }, { nom: 'objectif', multi: true }),
      champ('Version de base', f.version, (v) => { f.version = v; }, { nom: 'version', aide: 'Préremplie avec la version de l\'appli.' }),
      champ('SHA de base', f.sha, (v) => { f.sha = v; }, { nom: 'sha', aide: '40 caractères. L\'appli ne connaît pas son commit : il est collé, jamais deviné.' }),
      ...jalons,
      el('div', { classe: 'ligne' },
        bouton('+ jalon', 'ajouter-jalon', agir('chantier', () => { f.jalons.push(jalonVide()); sauver(); }), { actif: pilote() }),
        bouton('− dernier jalon', 'retirer-jalon', agir('chantier', () => { f.jalons.pop(); sauver(); }), { actif: pilote() && f.jalons.length > 1 })),
      bouton('Ouvrir le chantier', 'ouvrir', agir('chantier', ouvrir), { principal: true, actif: pilote() }),
      message('chantier'));
  }

  function sectionPlan(e) {
    if (!e) return section('plan', '2. Plan', ligneTexte('Aucun chantier ouvert.'));
    const jalons = e.plan.map((j, i) => ligneTexte(`${i + 1}. ${j.id} — ${j.titre} — ${j.statut} — tentatives ${j.tentatives.length} / ${j.tentativesMax}${i === e.jalonCourant ? ' — jalon courant' : ''}`, `plan-${i}`));
    return section('plan', '2. Plan', ligneTexte(`Chantier ${e.id} — statut technique : ${e.statut}`), ...jalons,
      e.statut === 'ouvert' ? bouton('Approuver le plan', 'approuver', agir('plan', () => appliquerChantier('plan-approuve', {}, 'plan', 'Plan approuvé : il est désormais figé.')), { principal: true, actif: pilote() }) : null,
      ligneTexte('Le plan est figé après son approbation (aucune modification, aucun ajout).'),
      message('plan'));
  }

  function sectionFiche(e) {
    if (!e || e.statut !== 'en-cours') return section('fiche', '3. Fiche du jalon courant', ligneTexte('Aucun jalon courant : le plan doit être approuvé.'));
    const j = e.plan[e.jalonCourant];
    const f = ficheDe(j.id);
    // AT-6 : la fiche n'est modifiable que tant qu'aucune tentative n'est vivante ; le dossier lancé reste l'instantané figé.
    const carnet = !!missionDuChantier();
    const verrou = etapeCourante().etape !== 'mission-a-lancer' || carnet;
    const decisions = f.decisions.map((d, i) => el('div', { classe: 'atelier-decision' },
      champ(`Décision ${i + 1} : identifiant`, d.id, (v) => { d.id = v; }, { nom: `decision-${i}-id`, aide: 'D-xxx', verrou }),
      champ(`Décision ${i + 1} : texte copié`, d.texte, (v) => { d.texte = v; }, { nom: `decision-${i}-texte`, multi: true, verrou })));
    return section('fiche', '3. Fiche du jalon courant',
      ligneTexte(`Jalon ${j.id} — ${j.titre}`), ligneTexte(`Critère (AT-1, inchangé) : ${j.critere}`),
      ligneTexte('Une ligne = un élément. Une ligne vide est refusée.'),
      carnet ? ligneTexte('Fiche figée : mission du carnet approuvée (V1) ; elle n\'est jamais modifiée sur cet appareil.', 'fiche-figee-carnet')
        : verrou ? ligneTexte('Fiche figée : une tentative est lancée (son dossier est l\'instantané exact) ou aucune nouvelle tentative n\'est possible.', 'fiche-figee') : null,
      champ('Comportement observable', f.comportement, (v) => { f.comportement = v; }, { nom: 'comportement', multi: true, verrou }),
      champ('Critères d\'acceptation', f.criteres, (v) => { f.criteres = v; }, { nom: 'criteres', multi: true, verrou }),
      champ('Tests exigés', f.tests, (v) => { f.tests = v; }, { nom: 'tests', multi: true, verrou }),
      champ('Chemins autorisés', f.autorises, (v) => { f.autorises = v; }, { nom: 'autorises', multi: true, aide: 'Fichier, ou dossier terminé par /.', verrou }),
      champ('Chemins interdits (facultatif)', f.interdits, (v) => { f.interdits = v; }, { nom: 'interdits', multi: true, rangs: 2, verrou }),
      champ('Frontières (facultatif)', f.frontieres, (v) => { f.frontieres = v; }, { nom: 'frontieres', multi: true, rangs: 2, verrou }),
      ...decisions,
      el('div', { classe: 'ligne' },
        bouton('+ décision', 'ajouter-decision', agir('fiche', () => { if (!verrou) { f.decisions.push({ id: '', texte: '' }); sauver(); } }), { actif: pilote() && !verrou }),
        bouton('− dernière décision', 'retirer-decision', agir('fiche', () => { if (!verrou) { f.decisions.pop(); sauver(); } }), { actif: pilote() && !verrou && f.decisions.length > 0 })),
      message('fiche'));
  }

  function sectionBudget(e) {
    const c = lu.copie;
    const b = c.formulaire.budget;
    const executions = c.registre ? Object.entries(etatBudget(c.registre).executions) : [];
    const contenu = executions.length === 0 ? [ligneTexte('Aucune exécution dans AT-4 : aucun engagement, aucun coût.', 'sans-execution')]
      : executions.map(([t, x]) => ligneTexte(`Exécution ${t} : maximum ${usd(x.maximum)} — ${x.statut === 'engagee' ? 'engagée (coût réel non inscrit)' : `coût réel ${usd(x.montant)}`}`, `execution-${t}`));
    if (!c.registre) {
      contenu.push(
        champ('Libellé du cycle', b.cycle, (v) => { b.cycle = v; }, { nom: 'cycle' }),
        champ('Plafond du cycle (USD)', b.plafond, (v) => { b.plafond = v; }, { nom: 'plafond', clavier: 'decimal' }),
        champ('Réserve (USD)', b.reserve, (v) => { b.reserve = v; }, { nom: 'reserve', clavier: 'decimal' }),
        champ('Plafond par exécution (USD)', b.plafondRun, (v) => { b.plafondRun = v; }, { nom: 'plafond-run', clavier: 'decimal' }),
        bouton('Ouvrir le cycle', 'ouvrir-cycle', agir('budget', ouvrirCycle), { principal: true, actif: pilote() }));
    } else {
      const r = etatBudget(c.registre);
      const ligneBudget = (libelle, cle, valeur) => ligneTexte(`${libelle} : ${usd(valeur)}`, `budget-${cle}`);
      contenu.push(ligneTexte(`Cycle : ${r.cycle}`, 'budget-cycle'),
        ligneBudget('Plafond du cycle', 'plafond', r.plafond), ligneBudget('Réserve', 'reserve', r.reserve), ligneBudget('Utilisable', 'utilisable', r.utilisable),
        ligneBudget('Consommé', 'consommeCycle', r.consommeCycle), ligneBudget('Engagé', 'engageCycle', r.engageCycle), ligneBudget('Restant du cycle', 'resteCycle', r.resteCycle),
        ligneBudget('Plafond par exécution', 'plafondRun', r.plafondRun),
        ligneTexte(r.suspendu ? 'SUSPENDU : anomalie de borne financière à examiner' : 'Registre non suspendu.', 'budget-suspendu'));
      const ch = e && Object.hasOwn(r.chantiers, e.id) ? r.chantiers[e.id] : null;
      if (ch) {
        contenu.push(ligneBudget('Plafond du chantier', 'chantier-plafond', ch.plafond), ligneBudget('Consommé (chantier)', 'chantier-consomme', ch.consomme),
          ligneBudget('Engagé (chantier)', 'chantier-engage', ch.engage), ligneBudget('Restant (chantier)', 'chantier-reste', ch.reste));
      } else if (e) {
        contenu.push(champ('Plafond du chantier (USD)', b.plafondChantier, (v) => { b.plafondChantier = v; }, { nom: 'plafond-chantier', clavier: 'decimal' }),
          bouton('Fixer le plafond du chantier', 'plafonner', agir('budget', plafonnerChantier), { principal: true, actif: pilote() }));
      } else contenu.push(ligneTexte('Plafond du chantier : à fixer après l\'ouverture du chantier.'));
    }
    return section('budget', '4. Budget (registre technique)', ...contenu, message('budget'));
  }

  const portee = (texte, nom) => el('p', { classe: 'aide atelier-ligne', texte, attrs: { 'data-atelier': nom } });
  const retour = (cle) => (ui.retour && ui.retour.cle === cle
    ? el('p', { classe: `resultat ${ui.retour.ok ? 'resultat-ok' : 'resultat-erreur'}`, texte: ui.retour.texte, attrs: { 'data-atelier': `retour-${cle}` } }) : null);
  const branchePrevue = (m) => `atelier/${m.chantier}/${m.jalon.id}/${m.tentative}`;
  const porteeDossier = (m) => `Ton collage de ce dossier à Claude, copié après la sauvegarde durable confirmée de son lancement (D3), autorise UNIQUEMENT la création et le push de la branche ${branchePrevue(m)}, pour cette tentative et conformément au dossier. Rien sur main, aucun tag, aucun dépôt, aucune autre tentative, rien hors mission.`;
  const apercuDossier = (texte) => {
    const apercu = el('textarea', { classe: 'atelier-dossier', attrs: { 'data-atelier': 'dossier', readonly: '', spellcheck: 'false' } });
    apercu.readOnly = true;
    apercu.rows = 12;
    apercu.value = texte;
    return apercu;
  };

  function sectionDossier() {
    if (!pilote()) return section('dossier', '5. Dossier de mission', ligneTexte('Mode OFF : consultation seulement. Aucune génération, aucune copie.', 'off-dossier'));
    const et = etapeCourante();
    const v = vivanteCourante();
    const contenu = [bouton('Générer le dossier', 'generer', generer, { principal: true })];
    if (v && v.piece && tentativeAuto(v)) {
      contenu.push(ligneTexte(`Tentative ${v.t.numero} lancée en AUTO à blanc : dossier figé (instantané exact, ${octets(construireMission(v.piece.mission))} octets). Il ne se copie pas : la frontière J2 en relève l'empreinte. ${auto() ? 'Suite : section 11.' : 'Passe en mode AUTO pour la suivre.'}`, 'dossier-auto'));
    } else if (v && v.piece) {
      const texte = construireMission(v.piece.mission);
      if (!lancementSauvegarde(v)) {
        contenu.push(ligneTexte(`Tentative ${v.t.numero} lancée : dossier figé (instantané exact, ${octets(texte)} octets). D3 : il n'est copiable qu'après la sauvegarde durable confirmée de ce lancement (section 10).`, 'dossier-d3'));
      } else {
        contenu.push(ligneTexte(`Tentative ${v.t.numero} lancée et sauvegardée : dossier figé (instantané exact, ${octets(texte)} octets).`, 'dossier-fige'), apercuDossier(texte),
          bouton(`Copier le dossier de la tentative ${v.t.numero}`, 'recopier-dossier', recopierDossier, { principal: true, actif: permis('recopier-dossier') }),
          portee(porteeDossier(v.piece.mission), 'portee-dossier'), retour('dossier'));
      }
    } else if (ui.dossier) {
      contenu.push(apercuDossier(ui.dossier.texte), ligneTexte(`${octets(ui.dossier.texte)} octets UTF-8 — aperçu du dossier généré. Il ne se copie qu'après son lancement ET la sauvegarde durable confirmée de ce lancement (D3).`, 'apercu-d3'));
      const m = lu.copie.mission;
      if (auto() && et.etape === 'mission-a-lancer') contenu.push(ligneTexte('Mode AUTO : le lancement se fait en section 11 (AUTO à blanc).', 'dossier-vers-auto'));
      else if (et.etape === 'mission-a-lancer' && m && m.jalon.id === et.jalon && m.tentative === et.numero) {
        contenu.push(ligneTexte('Générer ne lance rien. Lancer écrit la tentative et fige ce dossier, sans rien copier ; ensuite : sauvegarde durable (section 10), puis copie du dossier.'),
          bouton(`Lancer la tentative ${et.numero}`, 'lancer', lancer, { principal: true }), portee(porteeDossier(m), 'portee-dossier'));
      }
      contenu.push(retour('dossier'));
    } else if (et.etape === 'base-indefinie') contenu.push(ligneTexte(et.consigne, 'abstention-base'));
    return section('dossier', '5. Dossier de mission', ...contenu, message('dossier'));
  }

  function sectionRapport() {
    if (auto() && autoRendue(vivanteCourante())) {
      const d = rendueDe(vivanteCourante()).donnees;
      return section('rapport', '6. Rapport de Claude', ligneTexte(`Candidat AUTO enregistré : ${rendueDe(vivanteCourante()).reference} — faits J2 ${d.faits_auto_empreinte.slice(0, 8)} / J4 ${d.faits_candidat_empreinte.slice(0, 8)}`, 'auto-rapport'));
    }
    if (auto()) return section('rapport', '6. Rapport de Claude', ligneTexte('Mode AUTO à blanc : aucun rapport, aucun candidat (aucun appel).', 'auto-rapport'));
    if (!manuel()) return section('rapport', '6. Rapport de Claude', ligneTexte('Mode OFF : consultation seulement. Aucune vérification.', 'off-rapport'));
    const zoneRapport = el('textarea', { attrs: { 'data-atelier': 'rapport', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' } });
    zoneRapport.rows = 6;
    zoneRapport.value = ui.rapport;
    zoneRapport.addEventListener('input', () => { ui.rapport = zoneRapport.value; });
    return section('rapport', '6. Rapport de Claude',
      el('label', { classe: 'champ' }, el('span', { texte: 'Coller le rapport JSON de Claude' }), zoneRapport),
      ligneTexte(lu.copie.mission ? `Référence : dernier dossier généré (jalon ${lu.copie.mission.jalon.id}, tentative ${lu.copie.mission.tentative}), jamais la fiche actuelle.` : 'Référence : aucun dossier généré.', 'reference'),
      bouton('Vérifier la forme', 'verifier', verifier, { principal: true }),
      ui.verification ? resultatRapport(ui.verification) : null,
      etapeCourante().etape === 'rapport-attendu' ? bouton(`Enregistrer le candidat reçu (tentative ${etapeCourante().numero})`, 'enregistrer', enregistrer, { principal: true }) : null,
      etapeCourante().etape === 'rapport-attendu' ? ligneTexte('Enregistrer = « Claude a rendu ce candidat » (tentative rendue). Ce n\'est ni une vérification, ni une acceptation.') : null,
      message('rapport'));
  }

  function resultatRapport(v) {
    const p = (texte) => el('p', { texte });
    const boite = (...enfants) => el('div', { classe: 'resultat atelier-verification', attrs: { 'data-atelier': 'verification' } }, ...enfants);
    if (v.structure === 'impossible') return boite(p(`Vérification impossible : ${v.raison}.`));
    if (v.structure !== 'conforme') return boite(p(`Rapport NON CONFORME : ${v.raison}.`), p('Rien n\'est enregistré.'));
    const r = v.rapport;
    if (v.statutAnnonce === 'bloque') return boite(p('Rapport structurellement conforme — Claude annonce : BLOQUÉ.'), p(`Question de Claude : ${r.question}`));
    if (v.statutAnnonce === 'echec') return boite(p('Rapport structurellement conforme — Claude annonce : ÉCHEC.'), p(`Motif annoncé : ${r.motif}`));
    const liste = (l) => (l.length ? l.join(', ') : '(aucun)');
    return boite(p('Rapport structurellement conforme.'), p('Candidat NON VÉRIFIÉ.'), p('Aucune validation ni acquisition.'),
      el('p', { classe: 'atelier-titre', texte: 'Annoncé par Claude (non vérifié)' }),
      p(`Branche : ${r.candidat.branche}`), p(`SHA : ${r.candidat.sha}`), p(`Fichiers créés : ${liste(r.fichiers.crees)}`),
      p(`Fichiers modifiés : ${liste(r.fichiers.modifies)}`), p(`Fichiers supprimés : ${liste(r.fichiers.supprimes)}`),
      p(`Tests : ${r.tests.total} au total, ${r.tests.reussis} réussis, ${r.tests.echecs} échecs`),
      p(`Divergences : ${r.divergences.length ? r.divergences.join(' / ') : '(aucune)'}`));
  }

  function sectionVerification() {
    const v = vivanteCourante();
    const titre = '7. Vérification technique (AT-5)';
    if (!v || !v.piece || (v.piece.rapport === null && !autoRendue(v))) return section('verification', titre, ligneTexte('Aucun candidat reçu à vérifier.', 'verification-vide'), message('verification'));
    const p = v.piece;
    const cand = candidatDe(v);
    const actif = parcoursPermis();
    const contenu = [ligneTexte(autoRendue(v) ? `Candidat AUTO (branche créée par le run, non vérifiée) : ${cand.branche}@${cand.sha}` : `Candidat reçu (annoncé par Claude, non vérifié) : ${cand.branche}@${cand.sha}`, 'candidat-recu'),
      el('p', { classe: 'atelier-titre', texte: 'Demande de vérification' })];
    const valeurs = p.demande || { branche: cand.branche, candidat: cand.sha, base: p.mission.base.sha, version_base: p.mission.base.version };
    for (const k of ['branche', 'candidat', 'base', 'version_base']) contenu.push(ligneTexte(`${k} = ${valeurs[k]}`, `demande-${k}`));
    if (p.demande === null) {
      contenu.push(saisie('version_candidat (valeur d\'essai proposée)', versionProposee(v), (x) => { ui.versionCandidat = x; }, { nom: 'version-candidat',
        aide: 'Proposée : patch suivant de version_base. Modifiable jusqu\'à la copie, puis figée. Sa validité est établie par AT-5 : ce n\'est pas la version du candidat.' }));
    } else contenu.push(ligneTexte(`version_candidat = ${p.demande.version_candidat} (valeur d'essai figée dans la demande)`, 'demande-version_candidat'));
    contenu.push(bouton(p.demande === null ? 'Copier la demande de vérification' : 'Recopier la demande', 'copier-demande', copierDemande, { principal: true, actif: actif && permis('copier-demande') }),
      portee('Ton collage de cette demande à Claude autorise UNIQUEMENT le run AT-5 « Atelier — vérification technique » lancé depuis main avec exactement ces cinq valeurs. Aucun autre run, aucune branche, rien sur main, aucun tag, aucun dépôt.', 'portee-demande'),
      retour('demande'));
    if (p.demande !== null) {
      const zoneFaits = el('textarea', { attrs: { 'data-atelier': 'faits-colles', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' } });
      zoneFaits.rows = 6;
      zoneFaits.value = ui.faits;
      zoneFaits.disabled = !actif;
      zoneFaits.addEventListener('input', () => { if (actif) ui.faits = zoneFaits.value; });
      contenu.push(el('p', { classe: 'atelier-titre', texte: 'FAITS TECHNIQUES (AT-5)' }),
        el('label', { classe: 'champ' }, el('span', { texte: 'Coller les faits du run (« Faits à copier tels quels »)' }), zoneFaits),
        bouton('Confronter les faits', 'confronter', confronterFaits, { principal: true, actif: actif && permis('confronter') }),
        ...p.faits.map((f, i) => ligneTexte(`Faits n° ${i + 1} — run ${f.lu.faits.provenance.run_id} — empreinte ${f.lu.faits.empreinte.slice(0, 16)}… (texte exact conservé)`, `faits-recus-${i}`)));
    }
    const c = confrontationCourante();
    if (c) contenu.push(blocFaits(c.faits.lu.faits), blocVerdict(c.resultat, c.faits.lu.faits.provenance.run_id));
    return section('verification', titre, ...contenu, message('verification'));
  }
  function blocFaits(f) {
    const id = f.identite;
    const fichiers = f.diff.fichiers.map((x) => `${x.chemin} (${x.etat})`).join(', ') || '(aucun)';
    return el('div', { classe: 'resultat', attrs: { 'data-atelier': 'faits-techniques' } },
      el('p', { classe: 'atelier-titre', texte: 'Faits techniques du dernier run (établis par AT-5, jamais par le rapport)' }),
      el('p', { texte: `Run ${f.provenance.run_id} — identité ${id.statut} — segment d'outillage : ${id.segment.statut}, ${id.segment.commits} commit(s)` }),
      el('p', { texte: `Diff ${f.diff.statut} : ${fichiers}` }),
      el('p', { texte: `Tests ${f.tests.statut} : ${f.tests.total} au total, ${f.tests.reussis} réussis, ${f.tests.echecs} échecs` }),
      el('p', { texte: `Exécution ${f.execution.statut} — durée ${f.execution.duree_tests_ms} ms, délai ${f.execution.delai_ms} ms — version injectée ${f.execution.version_injectee}` }),
      el('p', { texte: `Robot : syntaxe ${f.robot.syntaxe}, JSON ${f.robot.json}, fumée ${f.robot.fumee}` }));
  }
  // v0.65.14 — AT-9 jalon 2 : numéro du passage AT-5 (run_id) inscrit dans la décision, cherché sans supposer sa place exacte.
  function runDeDecision(d) {
    const vus = new Set();
    const chercher = (o, cle) => {
      if (!o || typeof o !== 'object' || vus.has(o)) return null;
      vus.add(o);
      if (Object.prototype.hasOwnProperty.call(o, cle) && (typeof o[cle] === 'string' || typeof o[cle] === 'number')) return String(o[cle]);
      for (const v of Object.values(o)) { const x = chercher(v, cle); if (x !== null) return x; }
      return null;
    };
    const r = chercher(d, 'run_id');
    if (r !== null) return r;
    vus.clear();
    return chercher(d, 'run');
  }

  function blocVerdict(r, run) {
    const liste = (titre, l, nom) => (l.length ? [el('p', { classe: 'atelier-titre', texte: titre }), el('ul', { attrs: { 'data-atelier': nom } }, ...l.map((x) => el('li', { texte: x })))] : []);
    return el('div', { classe: 'resultat atelier-verification', attrs: { 'data-atelier': 'verdict' } },
      el('p', { classe: 'atelier-titre', texte: 'Verdict technique — ce n\'est pas une acceptation.' }),
      el('p', { texte: `Verdict : ${r.verdict_technique}`, attrs: { 'data-atelier': 'verdict-technique' } }),
      el('p', { texte: `Passage AT-5 : ${run}`, attrs: { 'data-atelier': 'verdict-run' } }),
      el('p', { texte: 'Recalculé à l\'instant depuis la mission lancée, le rapport enregistré et les faits ; il ne déclenche rien.' }),
      ...liste('À examiner', r.a_examiner, 'a-examiner'), ...liste('Raisons de non-conformité', r.raisons_non_conformite, 'raisons-non-conformite'),
      ...liste('Raisons d\'impossibilité', r.raisons_impossibilite, 'raisons-impossibilite'));
  }

  function sectionDecision() {
    const e = etatChantier();
    const et = etapeCourante();
    const contenu = [el('p', { classe: 'atelier-titre', texte: 'DÉCISION HUMAINE' }),
      ligneTexte('Toi seul décides. Une acceptation n\'est ni un dépôt, ni une acquisition, et ne modifie pas main.')];
    if (e && e.statut === 'termine') {
      contenu.push(ligneTexte('Chantier terminé (état technique). Ni dépôt sur main, ni acquisition.', 'chantier-termine'));
      for (const t of tentativesDuJournal(lu.copie.journal)) {
        if (t.decision && t.decision.type === 'tentative-acceptee') contenu.push(ligneTexte(`Jalon ${t.jalon}, tentative ${t.numero} — candidat accepté : ${t.rendue.reference}${(() => { const run = runDeDecision(t.decision); return run === null ? '' : ` — passage AT-5 ${run}`; })()}`, `accepte-${t.jalon}`));
      }
    }
    if (et.etape === 'verification-a-refaire') contenu.push(ligneTexte('Vérification impossible : aucune acceptation ni aucun refus du candidat sur ces faits. Relance une vérification, ou annule la tentative.', 'decision-impossible'));
    if (['accepter', 'refuser', 'annuler'].some(permis)) {
      contenu.push(saisie('Ton motif (obligatoire)', ui.motifDecision, (x) => { ui.motifDecision = x; }, { nom: 'motif-decision', multi: true, rangs: 2 }));
      if (permis('accepter')) contenu.push(bouton(`Accepter le candidat (tentative ${et.numero})`, 'accepter', () => decider('tentative-acceptee'), { principal: true, actif: parcoursPermis() }));
      if (permis('refuser')) contenu.push(bouton(`Refuser le candidat (tentative ${et.numero})`, 'refuser', () => decider('tentative-rejetee'), { actif: parcoursPermis() }));
      if (permis('annuler')) contenu.push(bouton(`Annuler la tentative ${et.numero}`, 'annuler', annuler, { actif: pilote() && !(autoRendue(vivanteCourante()) && !auto()) }));
      if (et.etape === 'auto-lancee') contenu.push(ligneTexte('Annuler une tentative AUTO sans faits laisse son engagement ouvert (exécution incertaine) : aucun nouveau cycle tant que son coût réel n\'est pas inscrit. Préfère la clôture AUTO avec les faits (section 11).', 'annuler-auto'));
    }
    return section('decision', '8. Décision humaine', ...contenu, message('decision'));
  }

  function sectionJournal() {
    const c = lu.copie;
    const resume = (d, montants) => Object.keys(d).map((k) => `${k} = ${montants && Number.isSafeInteger(d[k]) && k !== 'n' ? usd(d[k]) : JSON.stringify(d[k])}`).join(' ; ');
    const liste = (journal, nom, montants) => el('ul', { classe: 'atelier-journal', attrs: { 'data-atelier': nom } },
      ...(journal || []).map((ev) => el('li', { texte: `${ev.n}. ${ev.type} — ${ev.quand} — ${resume(ev.donnees, montants)}` })));
    return section('journaux', '9. Journal technique',
      el('p', { classe: 'atelier-titre', texte: 'Journal du chantier (AT-1)' }), c.journal ? liste(c.journal, 'journal-chantier', false) : ligneTexte('(vide)', 'journal-chantier-vide'),
      el('p', { classe: 'atelier-titre', texte: 'Registre de budget (AT-2)' }), c.registre ? liste(c.registre, 'registre-budget', true) : ligneTexte('(vide)', 'registre-budget-vide'),
      ligneTexte('Lecture seule. Les fiches de jalon et les rapports vérifiés n\'entrent dans aucun de ces deux journaux.'));
  }

  function sectionSauvegarde(e) {
    const titre = '10. Sauvegarde durable et reprise (journal Git)';
    const c = lu.copie;
    const p = (texte, nom) => el('p', { texte, attrs: nom ? { 'data-atelier': nom } : {} });
    if (e) {
      const s = c.sauvegarde;
      const actuel = durableCourant();
      const branche = brancheJournal(e.id);
      const contenu = [ligneTexte(s ? `Dernière sauvegarde confirmée sur cet appareil : ${branche} @ ${s.commit} — empreinte ${s.empreinte.slice(0, 16)}… — ${s.empreinte === empreinteDe(actuel) ? 'à jour' : 'état modifié depuis : sauvegarde à refaire'}` : 'Aucune sauvegarde durable confirmée sur cet appareil.', 'sauvegarde-statut')];
      if (attenteD3()) contenu.push(ligneTexte(`D3 : tentative lancée, sauvegarde durable non confirmée. Le dossier n'est pas copiable et aucun candidat ne peut être enregistré. ${CONSIGNE_D3}`, 'd3-attente'));
      contenu.push(bouton('Préparer la sauvegarde (parties à copier)', 'preparer-sauvegarde', preparerSauvegarde, { principal: true, actif: pilote() }));
      if (ui.preparation && ui.preparation.texte === actuel) {
        const n = ui.preparation.parties.length;
        contenu.push(ligneTexte(`État durable : ${ui.preparation.octets} octets, empreinte ${ui.preparation.empreinte}, ${n} partie(s). Une partie = un message à Claude, dans n'importe quel ordre.`, 'sauvegarde-parties'),
          ...ui.preparation.parties.map((_, i) => bouton(`Copier la partie ${i + 1}/${n}`, `copier-partie-${i + 1}`, () => copierPartie(i + 1), { actif: pilote() })),
          portee(`Ton collage de ces ${n} partie(s) à Claude autorise UNIQUEMENT : la branche ${branche} (créée orpheline si absente, sinon avancée en avance rapide), le seul fichier chantier.json, avec ce contenu exact, s'il est valide et prolonge la sauvegarde précédente. Aucun force-push, aucune suppression, aucune fusion, rien sur main, aucun tag, aucune branche candidate, aucun autre fichier.`, 'portee-sauvegarde'),
          retour('sauvegarde'));
      } else if (ui.preparation) contenu.push(ligneTexte('État modifié depuis la préparation : prépare à nouveau.', 'preparation-perimee'));
      contenu.push(saisie('Coller la confirmation de Claude (ATELIER-SAUVEGARDE-1 …)', ui.confirmation, (x) => { ui.confirmation = x; }, { nom: 'confirmation-sauvegarde', multi: true, rangs: 2 }),
        bouton('Enregistrer la confirmation', 'enregistrer-confirmation', enregistrerConfirmation, { actif: pilote() }), message('sauvegarde'));
      return section('sauvegarde', titre, ...contenu);
    }
    if (!atelierVide()) return section('sauvegarde', titre, ligneTexte('Restauration impossible : l\'atelier de cet appareil n\'est pas vide. Efface-le d\'abord.', 'restauration-impossible'), message('sauvegarde'));
    const r = preparerRestauration(ui.parties);
    const contenu = [ligneTexte('Restaurer un chantier depuis sa branche journal-atelier : colle les parties envoyées par Claude, une à la fois, dans n\'importe quel ordre.'),
      saisie('Coller une partie', ui.partie, (x) => { ui.partie = x; }, { nom: 'partie-restauration', multi: true, rangs: 6 }),
      bouton('Ajouter la partie', 'ajouter-partie', ajouterPartie, { principal: true, actif: pilote() })];
    if (r.statut === 'incomplet') contenu.push(ligneTexte(`Chantier ${r.chantier} — empreinte attendue ${r.empreinte} — parties reçues : ${r.recues.join(', ')} sur ${r.N} — manquantes : ${r.manquantes.join(', ')}. Rien n'est assemblé.`, 'restauration-etat'));
    if (r.statut === 'pret') {
      const { etat, durable, verdicts } = r.lu;
      // AT-8.1 : l'étape de l'aperçu (journal.js) ignore le mode ; une tentative AUTO vivante est relue avec le journal.
      const etape = etat.statut === 'en-cours' && tentativesDuJournal(durable.journal).some((t) => t.mode === 'AUTO' && !t.decision) ? etapeDe({ etat, pieces: r.lu.lues, journal: durable.journal }) : r.lu.etape;
      const tentatives = etat.plan.flatMap((j) => j.tentatives.map((t) => {
        const cle = cleTentative(j.id, t.numero);
        return p(`Tentative ${cle} — ${t.statut}${t.reference ? ` — ${t.reference}` : ''}${Object.hasOwn(verdicts, cle) ? ` — verdict recalculé : ${verdicts[cle]}` : ''}`, `apercu-tentative-${cle}`);
      }));
      contenu.push(ligneTexte(`Chantier ${r.chantier} — empreinte ${r.empreinte} — ${r.N} partie(s) sur ${r.N} : assemblage et lecture complète réussis.`, 'restauration-etat'),
        el('div', { classe: 'resultat atelier-verification', attrs: { 'data-atelier': 'apercu-restauration' } },
          el('p', { classe: 'atelier-titre', texte: 'APERÇU — rien n\'est installé avant ta confirmation' }),
          p(`Chantier : ${etat.id} — statut technique : ${etat.statut}`), p(`Objectif : ${etat.objectif}`), p(`Base : ${etat.base.version} @ ${etat.base.sha}`),
          p(`Journal AT-1 : ${durable.journal.length} événement(s) ; registre AT-2 : ${durable.registre ? durable.registre.length : 0} événement(s)`),
          p(`Étape retrouvée : ${etape.etape} — ${etape.consigne}`, 'apercu-etape'), ...tentatives,
          p('Après confirmation : mode OFF, aucun geste automatique. Les brouillons de cet appareil (formulaire, fiches) restent vides ; aucune donnée n\'est inventée.')),
        bouton('Confirmer la restauration', 'confirmer-restauration', confirmerRestauration, { principal: true, actif: pilote() }));
    }
    if (r.statut === 'incomplet' || r.statut === 'pret') contenu.push(bouton('Abandonner la restauration', 'abandonner-restauration', abandonnerRestauration, { actif: pilote() }));
    return section('sauvegarde', titre, ...contenu, message('sauvegarde'));
  }

  // Section 11, AUTO seulement : appel prévu et lancement ; puis T, engagement, demande AUTO (après sauvegarde à jour), clôture par les faits.
  // v0.65.21 — AT-10.4 : un collage du retour de Claude ; empreintes à comparer (DJ) avec les titres des annotations ATELIER-FAITS-1.
  function blocRetourMission(t) {
    const l = ui.lectureRetour && ui.lectureRetour.texte === texteRetourColle() && ui.lectureRetour.retour.tentative === t ? ui.lectureRetour : null;
    const contenu = [
      saisie('Coller le retour de Claude (ATELIER-RETOUR-1, un seul bloc)', ui.retourMission, (y) => { ui.retourMission = y; }, { nom: 'retour-mission', multi: true, rangs: 4 }),
      bouton('Lire le retour de Claude (rien n\'est écrit)', 'lire-retour-mission', lireRetourMission, { actif: permis('clore-auto') }),
    ];
    if (l) {
      const r = l.retour;
      contenu.push(el('p', { classe: 'resultat resultat-ok', texte: `RETOUR DE CLAUDE LISIBLE — T = ${r.tentative} — D3 ${r.d3.commit.slice(0, 12)} — empreinte du bloc ${r.empreinte.slice(0, 16)}…`, attrs: { 'data-atelier': 'retour-lu' } }));
      for (const g of GENRES_FAITS.filter((x) => Object.hasOwn(r.faits, x))) { // ordre de la chaîne J1 -> AT-5
        const f = r.faits[g];
        const run = g === 'at5' ? r.runs.at5.run_id : r.runs.auto.run_id;
        contenu.push(ligneTexte(`${LIBELLES_FAITS[g]} — run ${run} — empreinte ${f.empreinte.slice(0, 16)}${l.utilises.includes(g) ? ' (utilisé)' : ''}`, `retour-fait-${g}`));
      }
      contenu.push(ligneTexte('CONTRÔLE OBLIGATOIRE : sur la page de chaque run (GitHub, « Annotations »), le titre ATELIER-FAITS-1 de chaque fait porte la même empreinte (après le numéro de morceau). Une seule différence : ne pas utiliser, prévenir Claude.', 'retour-consigne'),
        bouton('Empreintes comparées sur GitHub : utiliser ces faits', 'utiliser-retour', utiliserRetour, { principal: true, actif: permis('clore-auto') }));
    }
    contenu.push(ligneTexte('Sans retour de Claude : colle les faits à la main ci-dessous (mêmes contrôles).', 'retour-repli'));
    return contenu;
  }
  function sectionAuto(e) {
    const titre = '11. AUTO à blanc (aucun appel)';
    const contenu = [ligneTexte('AUTO à blanc : le run vérifie la garde (J1), attend ton approbation, sonde ses droits (J2) et s\'arrête sur PRET_A_APPELER. Aucun appel de modèle n\'existe, aucune clé, aucun secret. Ce n\'est ni une acceptation, ni une acquisition.', 'auto-portee')];
    const et = etapeCourante();
    const v = vivanteCourante();
    if (et.etape === 'mission-a-lancer') {
      const f = formulaireAuto();
      const ft = formulaireTemoin();
      const fd = formulaireDeveloppement();
      // v0.65.19 — AT-10.2 : mission de carnet : appel figé (V1), aucun autre mode, aucune saisie.
      const carnet = !!missionDuChantier();
      if (carnet) contenu.push(ligneTexte('Appel figé : mission du carnet approuvée (V1). Appel de développement seulement ; ni témoin, ni appel à blanc, aucune saisie.', 'auto-fige-carnet'));
      contenu.push(bouton('Remplir l\'appel à blanc (témoin)', 'auto-temoin', agir('auto', () => { lu.copie.formulaire.auto = autoTemoin(); delete lu.copie.formulaire.temoin; delete lu.copie.formulaire.developpement; sauver(); dire('auto', 'Appel à blanc prérempli : libellé « a-blanc », aucune valeur réelle.'); }), { actif: !carnet }),
        bouton('Préparer le témoin réel (UN appel possible)', 'auto-temoin-reel', agir('auto', () => {
          const jeton = tirerJeton();
          delete lu.copie.formulaire.developpement;
          lu.copie.formulaire.auto = autoTemoinReel();
          lu.copie.formulaire.temoin = { jeton, tarif_entree: '', tarif_sortie: '', maximum: '0,001' };
          sauver();
          dire('auto', 'Témoin réel préparé : jeton tiré sur cet appareil. Saisis le modèle et les tarifs CONSTATÉS du jour (vérifiés juste avant le témoin).');
        }), { actif: !carnet }),
        bouton('Préparer l\'appel de développement (UN appel possible)', 'auto-developpement', agir('auto', () => {
          delete lu.copie.formulaire.temoin;
          lu.copie.formulaire.auto = autoDeveloppement();
          lu.copie.formulaire.developpement = { effort: 'low', tarif_entree: '', tarif_sortie: '', maximum: '', extraits: '' };
          sauver();
          dire('auto', 'Appel de développement préparé : saisis le modèle, les bornes, les tarifs plafonds et CONSTATÉS du jour, l\'effort, les extraits et l\'engagement.');
        }), { actif: !carnet }),
        champ('Modèle (libellé)', f.modele, (x) => { f.modele = x; }, { nom: 'auto-modele', verrou: carnet, aide: ft ? 'Témoin : identifiant EXACT du modèle, revérifié le jour du témoin (le moins cher approprié).' : fd ? 'Développement : identifiant EXACT du modèle, revérifié le jour de l\'appel.' : 'Libellé seulement en AT-8.1 : aucun appel.' }),
        champ('Jetons d\'entrée max', f.entree_max, (x) => { f.entree_max = x; }, { nom: 'auto-entree-max', verrou: carnet, clavier: 'numeric' }),
        champ('Jetons de sortie max', f.max_tokens, (x) => { f.max_tokens = x; }, { nom: 'auto-max-tokens', verrou: carnet, clavier: 'numeric' }),
        champ('Tarif plafond d\'entrée (USD par million de jetons)', f.tarif_entree, (x) => { f.tarif_entree = x; }, { nom: 'auto-tarif-entree', verrou: carnet, clavier: 'decimal' }),
        champ('Tarif plafond de sortie (USD par million de jetons)', f.tarif_sortie, (x) => { f.tarif_sortie = x; }, { nom: 'auto-tarif-sortie', verrou: carnet, clavier: 'decimal' }));
      let estimation = null;
      try { estimation = estimationMax(appelDuFormulaire()); } catch { estimation = null; }
      contenu.push(ligneTexte(estimation === null ? 'Estimation maximale : appel incomplet.' : `Estimation maximale (engagée au lancement) : ${usd(estimation)} — appels autorisés : 1.`, 'auto-estimation'));
      if (ft) {
        contenu.push(el('p', { classe: 'atelier-titre', texte: 'TÉMOIN RÉEL : UN APPEL POSSIBLE APRÈS TON APPROBATION' }),
          ligneTexte(`Jeton témoin (128 bits, il relie la demande et la réponse ; il n'est pas secret) : ${ft.jeton}`, 'auto-jeton'),
          bouton('Tirer un nouveau jeton', 'auto-nouveau-jeton', agir('auto', () => { ft.jeton = tirerJeton(); sauver(); })),
          champ('Tarif CONSTATÉ d\'entrée (USD par million de jetons)', ft.tarif_entree, (x) => { ft.tarif_entree = x; }, { nom: 'auto-constate-entree', clavier: 'decimal', aide: 'Lu dans la documentation officielle des tarifs le jour du témoin ; au plus le tarif plafond.' }),
          champ('Tarif CONSTATÉ de sortie (USD par million de jetons)', ft.tarif_sortie, (x) => { ft.tarif_sortie = x; }, { nom: 'auto-constate-sortie', clavier: 'decimal' }),
          champ('Engagement (USD, au moins l\'estimation maximale)', ft.maximum, (x) => { ft.maximum = x; }, { nom: 'auto-engagement-saisi', clavier: 'decimal' }),
          bouton('Retirer le témoin (revenir à blanc)', 'auto-sans-temoin', agir('auto', () => { delete lu.copie.formulaire.temoin; sauver(); dire('auto', 'Témoin retiré : lancement à blanc.'); })));
      }
      if (fd) {
        contenu.push(el('p', { classe: 'atelier-titre', texte: 'APPEL DE DÉVELOPPEMENT : UN APPEL POSSIBLE APRÈS TON APPROBATION' }),
          ligneTexte('Le run transmet le dossier de mission et, à la base, les SEULS extraits déclarés ci-dessous (fichiers autorisés : modifiables ; autres fichiers : lecture seule). Le modèle répond par remplacements exacts. La borne d\'entrée vaut 2 × les octets du dossier + 4096 (marge de prudence : les jetons ne sont pas mesurés avant l\'appel) : la requête est refusée avant émission si elle dépasse les jetons d\'entrée max. L\'engagement est un maximum calculé, pas un coût garanti.', 'auto-dev-portee'),
          champ(`Effort (${EFFORTS.join(', ')})`, fd.effort, (x) => { fd.effort = x; }, { nom: 'auto-dev-effort', verrou: carnet }),
          champ('Tarif CONSTATÉ d\'entrée (USD par million de jetons)', fd.tarif_entree, (x) => { fd.tarif_entree = x; }, { nom: 'auto-dev-entree', verrou: carnet, clavier: 'decimal', aide: 'Lu dans la documentation officielle des tarifs le jour de l\'appel ; au plus le tarif plafond.' }),
          champ('Tarif CONSTATÉ de sortie (USD par million de jetons)', fd.tarif_sortie, (x) => { fd.tarif_sortie = x; }, { nom: 'auto-dev-sortie', verrou: carnet, clavier: 'decimal' }),
          champ('Extraits transmis (une ligne « chemin début-fin » par extrait)', fd.extraits, (x) => { fd.extraits = x; }, { nom: 'auto-dev-extraits', verrou: carnet, multi: true, rangs: 4, aide: 'Lignes de la base, bornes comprises ; préparés avec la mission.' }),
          champ('Engagement (USD, au moins l\'estimation maximale)', fd.maximum, (x) => { fd.maximum = x; }, { nom: 'auto-dev-engagement', verrou: carnet, clavier: 'decimal' }),
          bouton('Retirer le développement (revenir à blanc)', 'auto-sans-developpement', agir('auto', () => { delete lu.copie.formulaire.developpement; sauver(); dire('auto', 'Développement retiré : lancement à blanc.'); }), { actif: !carnet }));
      }
      const bloque = inconnuesOuvertes().length > 0;
      if (bloque) contenu.push(el('p', { classe: 'resultat resultat-erreur', texte: '⚠ Lancement AUTO bloqué : une ISSUE INCONNUE n\'est pas régularisée (voir plus bas).', attrs: { 'data-atelier': 'auto-bloque' } }));
      const m = lu.copie.mission;
      if (m && m.jalon.id === et.jalon && m.tentative === et.numero) {
        contenu.push(bouton(ft ? `Lancer la tentative ${et.numero} en AUTO avec TÉMOIN RÉEL` : fd ? `Lancer la tentative ${et.numero} en AUTO avec APPEL DE DÉVELOPPEMENT` : `Lancer la tentative ${et.numero} en AUTO à blanc`, 'lancer-auto', lancerAuto, { principal: true, actif: !bloque }),
          ligneTexte(`Lancer écrit la tentative (T = ${e.id}/${et.jalon}/${et.numero}) et engage ${ft || fd ? 'le montant saisi' : 'son estimation'} au registre, sans rien copier ; ensuite : sauvegarde durable (section 10), puis demande AUTO.`));
      } else contenu.push(ligneTexte('Génère d\'abord le dossier de la tentative (section 5).', 'auto-generer'));
    } else if (et.etape === 'auto-lancee' && v) {
      const t = `${v.e.id}/${v.j.id}/${v.t.numero}`;
      const ev = lancementDe(v.j.id, v.t.numero);
      const a = ev.donnees.appel;
      const tm = Object.hasOwn(ev.donnees, 'temoin') ? ev.donnees.temoin : null;
      const dvl = Object.hasOwn(ev.donnees, 'developpement') ? ev.donnees.developpement : null;
      const x = lu.copie.registre ? etatBudget(lu.copie.registre).executions[t] : undefined;
      contenu.push(ligneTexte(`T = ${t}`, 'auto-t'),
        ligneTexte(`Appel prévu : ${a.modele} — entrée <= ${a.entree_max}, sortie <= ${a.max_tokens} jetons — appels : ${a.appels}`, 'auto-appel'),
        ligneTexte(x ? `Engagement : ${usd(x.maximum)} — ${x.statut === 'engagee' ? 'ouvert' : 'soldé'}` : 'Engagement : absent du registre.', 'auto-engagement'));
      if (dvl) contenu.push(ligneTexte(`APPEL DE DÉVELOPPEMENT : effort ${dvl.effort} — ${dvl.extraits.length} extrait(s) — tarifs constatés ${usd(dvl.tarif_entree)} / ${usd(dvl.tarif_sortie)} par million de jetons — UN appel au plus, seulement si la clé existe et après ton approbation ; au plus UNE branche candidate atelier/${t}.`, 'auto-developpement-lance'));
      if (tm) contenu.push(ligneTexte(`TÉMOIN RÉEL : jeton ${tm.jeton} — tarifs constatés ${usd(tm.tarif_entree)} / ${usd(tm.tarif_sortie)} par million de jetons — UN appel au plus, seulement si la clé existe et après ton approbation.`, 'auto-temoin-lance'));
      if (!demandeAutoPossible(v)) contenu.push(ligneTexte(`D3 : demande AUTO copiable seulement après une sauvegarde durable confirmée À JOUR qui contient ce lancement. ${CONSIGNE_D3}`, 'auto-d3'));
      // v0.65.20 (DA) : mission de carnet : Claude dérive la demande de la D3 qu'il vient d'écrire ; la copier n'est pas nécessaire.
      if (missionDuChantier()) contenu.push(ligneTexte('Mission de carnet : après ta sauvegarde de ce lancement, Claude reconstruit lui-même cette demande depuis le carnet et la D3 (auto-carnet.mjs demande-auto) et lance le run dans ton autorisation écrite du carnet ; puis, dès la branche candidate, la vérification AT-5 (demande-at5). Aucune dépense sans TON approbation de l\'environnement atelier-auto (V2) ; l\'acceptation (V3) et la livraison (V4) restent tes gestes.', 'auto-relais-carnet'));
      contenu.push(bouton('Copier la demande AUTO', 'copier-demande-auto', copierDemandeAuto, { principal: true, actif: demandeAutoPossible(v) }),
        portee(dvl ? 'Ton collage de cette demande à Claude autorise UNIQUEMENT UN déclenchement du workflow AUTO depuis main, avec exactement ces valeurs : après ton approbation, et seulement si la clé existe, UNE requête de développement au plus, puis au plus UNE branche candidate. Aucune relance, aucun second déclenchement, rien sur main, aucun tag, aucun dépôt ; la vérification AT-5 est une demande séparée.'
          : tm ? 'Ton collage de cette demande à Claude autorise UNIQUEMENT UN déclenchement du workflow AUTO depuis main, avec exactement ces valeurs : après ton approbation, et seulement si la clé existe, UNE requête de témoin au plus. Aucune relance, aucun second déclenchement, rien sur main, aucun tag, aucun dépôt.'
          : 'Ton collage de cette demande à Claude autorise UNIQUEMENT UN déclenchement du workflow « Atelier — AUTO à blanc » depuis main, avec exactement ces valeurs. Aucune relance, aucun second déclenchement, aucun appel de modèle, aucun secret, rien sur main, aucun tag, aucun dépôt.', 'portee-demande-auto'),
        retour('demande-auto'),
        el('p', { classe: 'atelier-titre', texte: 'CLÔTURE PAR LES FAITS DU RUN' }),
        ...blocRetourMission(t),
        saisie('Coller les faits AUTO du run (« Faits à copier tels quels »)', ui.faitsAuto, (y) => { ui.faitsAuto = y; }, { nom: 'faits-auto', multi: true, rangs: 6 }),
        dvl ? saisie('Coller les faits J4 du run (« Faits à copier tels quels »)', ui.faitsCandidat, (y) => { ui.faitsCandidat = y; }, { nom: 'faits-candidat', multi: true, rangs: 6 }) : null,
        saisie('Ton motif (obligatoire)', ui.motifAuto, (y) => { ui.motifAuto = y; }, { nom: 'motif-auto', multi: true, rangs: 2 }));
      if (!tm && !dvl) {
        contenu.push(bouton(`Clore la tentative ${v.t.numero} AUTO (coût réel 0)`, 'clore-auto', cloreAuto, { principal: true, actif: permis('clore-auto') }),
          ligneTexte('Clore = tentative annulée citant les faits, coût réel 0 inscrit (aucun appel n\'existe). Une nouvelle tentative AUTO prendra le numéro suivant.'));
      } else {
        contenu.push(bouton(dvl ? 'Lire le retour (rien n\'est écrit)' : 'Lire les faits (rien n\'est écrit)', 'lire-faits-auto', lireFaitsTemoin, { principal: true, actif: permis('clore-auto') }),
          ligneTexte('Les faits de l\'appel (J2) ou du constat (J3) disent l\'issue : NON ÉMIS, RÉPONSE CONNUE ou ISSUE INCONNUE. Toute ambiguïté est ISSUE INCONNUE.'));
        const l = ui.lectureAuto && ui.lectureAuto.texte === (ui.faitsAuto.endsWith('\n') ? ui.faitsAuto : `${ui.faitsAuto}\n`) ? ui.lectureAuto : null;
        const retourLu = dvl && l && l.retour && l.texteJ4 === texteJ4() ? l.retour : null;
        if (l && l.issue === 'non-emis') {
          contenu.push(el('p', { classe: 'resultat resultat-ok', texte: `NON ÉMIS — aucune requête n'est partie (${l.faits.etape}, ${l.faits.raison || l.faits.resultat}). Coût réel 0.`, attrs: { 'data-atelier': 'auto-lecture' } }),
            bouton('Clore : NON ÉMIS (coût réel 0)', 'clore-temoin', cloreTemoin, { principal: true, actif: permis('clore-auto') }));
        } else if (l && l.issue === 'reponse-connue') {
          const r = l.faits.reponse;
          contenu.push(el('p', { classe: 'resultat resultat-ok', texte: `RÉPONSE CONNUE — modèle ${r.modele}, requête ${r.request_id || '(sans identifiant)'}, usage ${r.usage.entree} + ${r.usage.sortie} jetons, coût réel calculé ${usd(l.montant)} (Console à vérifier). ${dvl ? (l.faits.raison === null ? `Proposition VALIDE (${r.proposition.fichiers.map((y) => `${y.chemin} ${y.etat}, ${y.remplacements} remplacement(s)`).join(' ; ')}) : le run crée la branche candidate atelier/${t} ; la vérification AT-5 est une demande séparée.` : `Proposition REFUSÉE (${l.faits.raison}) : aucun candidat.`) : `Témoin ${r.temoin_conforme ? 'CONFORME' : 'NON CONFORME (réponse inattendue : le témoin n\'est pas réussi)'}.`}`, attrs: { 'data-atelier': 'auto-lecture' } }),
            ...(retourLu && retourLu.retour ? [el('p', { classe: 'resultat resultat-ok', texte: `CANDIDAT AUTO LISIBLE — ${retourLu.retour.reference} — fichiers : ${retourLu.retour.j4.fichiers.map((y) => `${y.chemin} (${y.etat})`).join(', ')} — run ${retourLu.retour.j4.provenance.run_id} — demande AT-5 : version_candidat ${retourLu.retour.demande.version_candidat}. Rien n'est encore écrit.`, attrs: { 'data-atelier': 'auto-retour' } }),
              bouton(`Enregistrer le candidat AUTO (coût réel ${usd(retourLu.retour.montant)})`, 'enregistrer-auto', enregistrerAuto, { principal: true, actif: permis('enregistrer-auto') }),
              ligneTexte('Enregistrer = tentative rendue + coût réel inscrit + demande AT-5 figée, en une seule écriture. Ce n\'est ni une vérification, ni une acceptation. Clore ci-dessous abandonne le candidat sans l\'examiner.', 'auto-enregistrer-portee')] : []),
            ...(retourLu && retourLu.raison ? [el('p', { classe: 'resultat resultat-erreur', texte: `Retour refusé : ${raisonRetour(retourLu.raison)}. Aucun candidat ne peut être enregistré.`, attrs: { 'data-atelier': 'auto-retour' } })] : []),
            bouton(`Clore : RÉPONSE CONNUE (coût réel ${usd(l.montant)})`, 'clore-temoin', cloreTemoin, { principal: !(retourLu && retourLu.retour), actif: permis('clore-auto') }));
        } else if (l) {
          const r = l.faits.reponse;
          contenu.push(el('p', { classe: 'resultat resultat-erreur', texte: `⚠ ISSUE INCONNUE — un appel a pu avoir lieu (${l.faits.raison}${r && r.statut ? `, statut ${r.statut}${r.type_erreur ? ` ${r.type_erreur}` : ''}` : ''}). Coût NON établi : ce n'est ni un succès, ni un coût nul. L'engagement de ${usd(x ? x.maximum : 0)} reste OUVERT. Aucune relance. Régularisation humaine obligatoire (Console).`, attrs: { 'data-atelier': 'auto-lecture' } }),
            bouton('Constater : ISSUE INCONNUE (aucun coût inscrit, engagement maintenu)', 'clore-temoin', cloreTemoin, { actif: permis('clore-auto') }));
        }
      }
    } else contenu.push(ligneTexte('Aucun lancement AUTO possible à cette étape.', 'auto-indisponible'));
    for (const t of tentativesDuJournal(lu.copie.journal || [])) {
      if (t.mode === 'AUTO' && t.rendue && t.rendue.donnees.mode === 'AUTO') contenu.push(ligneTexte(`Tentative ${t.jalon}/${t.numero} AUTO rendue : candidat ${t.rendue.reference} — run ${lireFaitsAuto(t.rendue.donnees.faits_auto).faits.provenance.run_id} — faits J2 ${t.rendue.donnees.faits_auto_empreinte.slice(0, 8)} / J4 ${t.rendue.donnees.faits_candidat_empreinte.slice(0, 8)}`, `auto-rendue-${t.jalon}-${t.numero}`));
      if (t.mode !== 'AUTO' || !t.decision || !t.decision.donnees.faits_auto) continue;
      const lf = lireFaitsAuto(t.decision.donnees.faits_auto);
      const issue = t.decision.donnees.issue;
      if (lf.faits && issue === 'issue-inconnue') contenu.push(el('p', { classe: 'resultat resultat-erreur', texte: `⚠ Tentative ${t.jalon}/${t.numero} AUTO : ISSUE INCONNUE (${lf.faits.raison}) — run ${lf.faits.provenance.run_id}. Un appel a pu avoir lieu, coût non établi, aucune relance.`, attrs: { 'data-atelier': `auto-close-${t.jalon}-${t.numero}` } }));
      else if (lf.faits && issue) contenu.push(ligneTexte(`Tentative ${t.jalon}/${t.numero} AUTO close : ${LIBELLE_ISSUE[issue]}${lf.faits.raison ? ` (${lf.faits.raison})` : ''} — run ${lf.faits.provenance.run_id} — empreinte ${lf.faits.empreinte.slice(0, 16)}…`, `auto-close-${t.jalon}-${t.numero}`));
      else if (lf.faits) contenu.push(ligneTexte(`Tentative ${t.jalon}/${t.numero} AUTO close : ${lf.faits.etape} ${lf.faits.resultat}${lf.faits.raison ? ` (${lf.faits.raison})` : ''} — run ${lf.faits.provenance.run_id} — empreinte ${lf.faits.empreinte.slice(0, 16)}…`, `auto-close-${t.jalon}-${t.numero}`));
    }
    const ouvertes = inconnuesOuvertes();
    if (ouvertes.length > 0) {
      const y = ouvertes[0];
      contenu.push(el('p', { classe: 'atelier-titre', texte: 'RÉGULARISATION HUMAINE D\'UNE ISSUE INCONNUE' }),
        el('p', { classe: 'resultat resultat-erreur', texte: `⚠ ${y.id} : engagement de ${usd(y.x.maximum)} MAINTENU OUVERT. Lis la Console (requêtes et jetons de ce jour), puis inscris le coût réel (jamais 0 ; à défaut, le maximum engagé).`, attrs: { 'data-atelier': 'auto-regulariser-quoi' } }),
        saisie('Coût réel à inscrire (USD, > 0)', ui.montantRegul, (z) => { ui.montantRegul = z; }, { nom: 'montant-regul' }),
        saisie('Motif (ce que montre la Console)', ui.motifRegul, (z) => { ui.motifRegul = z; }, { nom: 'motif-regul', multi: true, rangs: 2 }),
        bouton('Régulariser (coût réel saisi)', 'regulariser', () => regulariser(y.id), { principal: true }));
    }
    return section('auto', titre, ...contenu, message('auto'));
  }

  // ---------------------------------------------------------------------------------------------- carnet de trois missions (AT-10.1)
  // v0.65.18 — AT-10.1 : copie locale du carnet SÉPARÉE (CLE_CARNET) ; la copie du chantier n'est jamais réécrite par le carnet, sauf le
  // pré-remplissage du formulaire d'un atelier VIDE à l'ouverture d'une mission. Le carnet (carnet.js) décide seul de ce qui est permis.
  const carnetCourant = () => (lc.carnet && lc.carnet.journal ? etatCarnet(lc.carnet.journal) : null);
  const durableCarnet = () => (lc.carnet && lc.carnet.journal ? canonique(etatDurableCarnet(lc.carnet.journal)) : null);
  const carnetAJour = () => { const s = lc.carnet && lc.carnet.sauvegarde; return !!s && s.empreinte === hacherSha256(durableCarnet()); };
  // v0.65.20 (DG) : la sauvegarde confirmée couvre-t-elle la livraison de la mission k-1 ? Son préfixe (les « evenements » premiers) est
  // exactement l'état confirmé et contient « mission-livree » de k-1 ; après une livraison, le carnet n'admet que sa validation (ou
  // l'arrêt, qui ferme toute ouverture). Aucune autre preuve n'est supposée : rien n'est anticipé ni fabriqué.
  function sauvegardeCouvreLivraison(k) {
    const s = lc.carnet && lc.carnet.sauvegarde;
    const j = lc.carnet && lc.carnet.journal;
    if (k < 2 || !s || !j) return false;
    const prefixe = j.slice(0, s.evenements);
    try { if (s.empreinte !== hacherSha256(canonique(etatDurableCarnet(prefixe)))) return false; } catch { return false; }
    return prefixe.some((x) => x.type === 'mission-livree' && x.donnees.k === k - 1);
  }
  const ouverturePermise = (k) => carnetAJour() || sauvegardeCouvreLivraison(k);
  const raisonOuverture = (k) => `sauvegarde durable du carnet requise et à jour avant d'ouvrir une mission${k >= 2 ? ` (ou couvrant la livraison de la mission ${k - 1})` : ''}`;
  function engagerCarnet(nouvelle) {
    const r = raisonCarnet(nouvelle);
    if (r) throw new Error(`Refusé : ${r}.`);
    try { stockage.setItem(CLE_CARNET, JSON.stringify(nouvelle)); } catch { throw new Error('Copie locale du carnet non enregistrée sur cet appareil : rien n\'est fait.'); }
    lc = { carnet: nouvelle };
  }
  // Un événement du carnet : refusé par carnet.js => rien n'est écrit ; sinon une copie vérifiée entière est enregistrée.
  function evenementCarnet(type, donnees) {
    const r = appliquerCarnet(lc.carnet.journal, { type, quand: maintenant(), donnees });
    if (!Array.isArray(r)) throw new Error(`Refusé par le carnet : ${r.raison}`);
    return { ...structuredClone(lc.carnet), journal: r };
  }
  const gesteCarnet = (action) => () => {
    if (!pilote()) return;
    try { action(); } catch (e) { dire('carnet', e && e.message ? e.message : String(e), true); }
    rendre();
  };
  // ---------------------------------------------------------------------------------------------- préparation d'une mission (AT-10.2)
  // Mission du carnet dont le chantier est sur cet appareil (carnet en cours, mission ouverte, même identifiant), ou null.
  function missionDuChantier(c = lu.copie) {
    const e = carnetCourant();
    if (!e || !c || !c.journal || e.statut !== 'en-cours' || e.missionCourante === null) return null;
    const k = e.missionCourante;
    const m = e.missions[k - 1];
    return m.statut === 'ouverte' && etatDe(c.journal).id === m.chantier ? { e, k, m } : null;
  }
  // Valeurs LOCALES de la préparation (formulaire, fiche), écrites avec les mêmes formats que la saisie humaine (ecrireUSD, une ligne par élément).
  function formulairePrepare(p) {
    const j = p.plan[0];
    const a = p.appel;
    const d = p.developpement;
    return {
      ...formulaireVide(version), chantier: p.chantier.id, objectif: p.chantier.objectif, version: p.chantier.base.version, sha: p.chantier.base.sha,
      jalons: [{ id: j.id, titre: j.titre, critere: j.critere, tentativesMax: String(j.tentativesMax) }],
      budget: { cycle: p.cycle.cycle, plafond: ecrireUSD(p.cycle.plafond), reserve: ecrireUSD(p.cycle.reserve), plafondRun: ecrireUSD(p.cycle.plafondRun), plafondChantier: ecrireUSD(p.plafond) },
      auto: { modele: a.modele, entree_max: String(a.entree_max), max_tokens: String(a.max_tokens), tarif_entree: ecrireUSD(a.tarif_entree), tarif_sortie: ecrireUSD(a.tarif_sortie) },
      developpement: { effort: d.effort, tarif_entree: ecrireUSD(d.tarif_entree), tarif_sortie: ecrireUSD(d.tarif_sortie), maximum: ecrireUSD(p.engagement), extraits: d.extraits.map((x) => `${x.chemin} ${x.debut}-${x.fin}`).join('\n') },
    };
  }
  function fichesPreparees(p) {
    const m = p.mission;
    return { [m.jalon.id]: { comportement: m.jalon.comportement, criteres: m.criteres.join('\n'), tests: m.tests.join('\n'), autorises: m.autorises.join('\n'),
      interdits: m.interdits.join('\n'), frontieres: m.frontieres.join('\n'), decisions: m.decisions.map((x) => ({ id: x.id, texte: x.texte })) } };
  }
  // Écart entre une copie et la préparation de la mission k : chantier, registre et pièces (comparerChantier, même contrôle que D8 et la
  // livraison), puis valeurs locales exactes ET relues comme à la saisie (appel, développement, engagement, dossier). null si identiques.
  function ecartPreparation(c, e, k) {
    const p = preparationMission(e, k);
    if (p.raison) return p.raison;
    const d = comparerChantier(e, k, c);
    if (d) return d;
    if (canonique(c.formulaire) !== canonique(formulairePrepare(p))) return 'préparation locale absente ou modifiée (formulaire du chantier, du budget ou de l\'appel AUTO différent de la mission approuvée)';
    if (canonique(c.fiches) !== canonique(fichesPreparees(p))) return 'préparation locale absente ou modifiée (fiche du jalon différente de la mission approuvée)';
    try {
      const a = appelDuFormulaire(c.formulaire.auto);
      const dv = developpementDuFormulaire(a, c.formulaire.developpement);
      if (canonique(a) !== canonique(p.appel) || canonique(dv.developpement) !== canonique(p.developpement) || dv.engagement !== p.engagement) return 'appel AUTO relu différent de l\'appel approuvé';
      const etat = etatDe(c.journal);
      if (etat.statut === 'en-cours' && canonique({ ...donneesMission(c), tentative: 1 }) !== canonique(p.mission)) return 'dossier relu de la fiche différent de la mission approuvée';
    } catch (err) { return `préparation locale illisible (${err.message})`; }
    if (c.mission !== null && canonique(c.mission) !== canonique(p.mission)) return 'dossier généré différent de la mission approuvée';
    return null;
  }
  // Garde des gestes generer et lancer AUTO : chantier d'une mission de carnet identique à sa préparation, sinon STOP.
  function exigerPreparation() {
    const x = missionDuChantier();
    if (!x) {
      if (RE_CHANTIER_CARNET.test(etatChantier().id)) throw new Error('chantier d\'une mission de carnet sans sa mission ouverte sur cet appareil (restaure d\'abord le carnet, section 12). STOP');
      return;
    }
    const d = ecartPreparation(lu.copie, x.e, x.k);
    if (d) throw new Error(`DIVERGENCE avec la mission ${x.k} du carnet : ${d}. STOP`);
  }
  // « Préparer la mission k » : UNE copie vérifiée entière (chantier + plan approuvé + registre + fiche + formulaires), contrôlée en entier
  // AVANT l'écriture ; le moindre refus : rien n'est écrit. Aucun lancement, aucun appel, aucune dépense.
  const preparerMission = (k) => gesteCarnet(() => {
    const e = carnetCourant();
    if (!carnetAJour()) throw new Error('sauvegarde durable du carnet requise et à jour avant de préparer une mission');
    if (!atelierVide()) throw new Error('l\'atelier du chantier n\'est pas vide : rien n\'est préparé');
    const p = preparationMission(e, k);
    if (p.raison) throw new Error(`Préparation refusée : ${p.raison}. Rien n'est écrit`);
    const quand = maintenant();
    const j = appliquer(ouvrirChantier(structuredClone(p.chantier), quand), { type: 'plan-approuve', quand, donnees: {} });
    if (!Array.isArray(j)) throw new Error(`Préparation refusée : ${j.raison}. Rien n'est écrit`);
    const r = appliquerBudget(ouvrirRegistre({ ...p.cycle }, quand), { type: 'chantier-plafonne', quand, donnees: { chantier: p.chantier.id, plafond: p.plafond } });
    if (!Array.isArray(r)) throw new Error(`Préparation refusée : ${r.raison}. Rien n'est écrit`);
    const c = { ...structuredClone(lu.copie), journal: j, registre: r, formulaire: formulairePrepare(p), fiches: fichesPreparees(p), mission: null };
    const ecart = ecartPreparation(c, e, k);
    if (ecart) throw new Error(`Préparation refusée (contrôle avant écriture) : ${ecart}. Rien n'est écrit`);
    engager(c);
    dire('carnet', `Mission ${k} préparée en un geste : chantier « ${p.chantier.id} » ouvert, plan de la V1 approuvé, fiche, cycle et plafond AT-2 (${usd(p.plafond)}), appel AUTO de développement (${p.appel.modele}, estimation maximale ${usd(p.engagement)}). Estimation et plafond ne valent NI approbation de l'appel (V2) NI dépense ; rien n'est lancé. Suite : génère le dossier (section 5), puis lance en AUTO (section 11).`);
  });
  // Après une restauration (fiche et formulaires vides) : réécrit SEULEMENT la fiche et les formulaires, si le chantier durable est
  // exactement la préparation de la mission ; un dossier généré différent est retiré (à régénérer).
  const retablirPreparation = (k) => gesteCarnet(() => {
    const x = missionDuChantier();
    if (!x || x.k !== k) throw new Error('aucune mission de carnet ouverte pour ce chantier');
    const d = comparerChantier(x.e, k, lu.copie);
    if (d) throw new Error(`DIVERGENCE : ${d}. STOP : rien n'est rétabli`);
    const p = preparationMission(x.e, k);
    const c = { ...structuredClone(lu.copie), formulaire: formulairePrepare(p), fiches: fichesPreparees(p) };
    if (c.mission !== null && canonique(c.mission) !== canonique(p.mission)) c.mission = null;
    const ecart = ecartPreparation(c, x.e, k);
    if (ecart) throw new Error(`Rétablissement refusé : ${ecart}. Rien n'est écrit`);
    engager(c);
    dire('carnet', `Préparation locale de la mission ${k} rétablie (fiche et formulaires de la mission approuvée). Le journal, le registre et les pièces sont inchangés.`);
  });
  // Parties collées : une proposition (atelier-carnet-proposition-1) ou un état durable (atelier-carnet-1), relus entiers.
  function lireCollageCarnet(textes) {
    const a = assemblerParties(textes);
    if (a.statut !== 'complet') return a;
    let v;
    try { v = JSON.parse(a.contenu); } catch { return { statut: 'refuse', raison: 'contenu illisible' }; }
    if (v && v.protocole === PROTOCOLE_PROPOSITION_CARNET) {
      const l = lireProposition(v);
      if (l.raison) return { statut: 'refuse', raison: `proposition refusée : ${l.raison}` };
      if (canonique(v) !== a.contenu || v.carnet !== a.chantier) return { statut: 'refuse', raison: 'proposition non canonique ou d\'un autre carnet' };
      return { statut: 'proposition', proposition: l.proposition, empreinte: empreinteProposition(v) };
    }
    const l = lireEtatCarnet(a.contenu);
    if (l.raison) return { statut: 'refuse', raison: `état du carnet invalide : ${l.raison}` };
    if (l.durable.carnet !== a.chantier) return { statut: 'refuse', raison: 'carnet des parties différent de celui de l\'état' };
    return { statut: 'etat', lu: l };
  }
  function ajouterPartieCarnet() {
    if (!pilote()) return;
    const texte = ui.partieCarnet;
    const r = lc.carnet && lc.carnet.journal === null ? lireCollageCarnet([...ui.partiesCarnet, texte]) : { statut: 'refuse', raison: 'un carnet existe déjà sur cet appareil' };
    if (r.statut === 'refuse') dire('carnet', `Partie refusée : ${r.raison}. Rien n'est conservé de ce collage.`, true);
    else if (ui.partiesCarnet.includes(texte)) { ui.partieCarnet = ''; dire('carnet', 'Partie déjà reçue : doublon identique ignoré.'); } else { ui.partiesCarnet = [...ui.partiesCarnet, texte]; ui.partieCarnet = ''; ui.message = null; }
    rendre();
  }
  const installerCarnet = gesteCarnet(() => {
    const r = lireCollageCarnet(ui.partiesCarnet);
    if (r.statut === 'proposition') {
      engagerCarnet({ version: 1, journal: ouvrirCarnet(structuredClone(r.proposition), maintenant()), sauvegarde: null });
      dire('carnet', `Carnet « ${r.proposition.carnet} » ouvert en brouillon (empreinte ${r.empreinte.slice(0, 16)}…). Rien n'est approuvé : relis-le, puis approuve-le (V1) en MANUEL.`);
    } else if (r.statut === 'etat') {
      engagerCarnet({ version: 1, journal: structuredClone(r.lu.durable.journal), sauvegarde: null });
      dire('carnet', `Carnet « ${r.lu.durable.carnet} » restauré (empreinte ${r.lu.empreinte.slice(0, 16)}…, statut ${r.lu.etat.statut}). Aucun geste automatique.`);
    } else throw new Error(`Rien n'est installé : ${r.raison || 'parties incomplètes'}.`);
    ui.partiesCarnet = []; ui.partieCarnet = '';
  });
  const approuverCarnet = gesteCarnet(() => {
    if (!manuel()) throw new Error('approbation V1 en mode MANUEL seulement');
    const e = carnetCourant();
    engagerCarnet(evenementCarnet('carnet-approuve', { empreinte: e.empreinte }));
    dire('carnet', `Carnet approuvé (V1, empreinte ${e.empreinte.slice(0, 16)}…) : trois missions immuables. Sauvegarde durable du carnet requise avant la mission 1.`);
  });
  // Ouvrir la mission k : carnet sauvegardé à jour, atelier du chantier VIDE ; le formulaire du chantier est pré-rempli (identifiant,
  // objectif, base, jalon à une tentative), rien d'autre. Le chantier s'ouvre ensuite par les gestes ordinaires (section 1).
  const ouvrirMission = (k) => gesteCarnet(() => {
    const e = carnetCourant();
    if (!ouverturePermise(k)) throw new Error(raisonOuverture(k));
    if (!atelierVide()) throw new Error('l\'atelier du chantier n\'est pas vide : efface-le d\'abord (sa sauvegarde durable reste sur GitHub)');
    const base = k === 1 ? e.base : { sha: e.missions[k - 2].livraison.main, version: e.missions[k - 2].livraison.version };
    const nouvelle = evenementCarnet('mission-ouverte', { k, chantier: e.missions[k - 1].chantier, base: { sha: base.sha, version: base.version } });
    const f = formulaireMission(etatCarnet(nouvelle.journal), k);
    engager({ ...structuredClone(lu.copie), formulaire: { ...formulaireVide(version), chantier: f.chantier, objectif: f.objectif, version: f.version, sha: f.sha, jalons: f.jalons } });
    engagerCarnet(nouvelle);
    dire('carnet', `Mission ${k} ouverte (plafond ${usd(e.missions[k - 1].plafond)} réservé). Formulaire du chantier « ${f.chantier} » pré-rempli : sauvegarde le carnet${k >= 2 ? ` (une seule sauvegarde pour la validation de la mission ${k - 1} et cette ouverture ; Claude y contrôle que les fichiers approuvés n'ont pas changé, E1)` : ''}, puis prépare la mission.`);
  });
  // Issue d'une clôture d'échec, dérivée du chantier : coût inconnu => issue-inconnue (plafond réservé) ; sinon selon le statut AT-1.
  function issueCloture(b, journal) {
    if (b.inconnu) return 'issue-inconnue';
    if (b.statut === 'bloque') return journal.some((x) => x.type === 'tentative-rejetee') ? 'refusee' : 'sans-candidat';
    return 'arretee';
  }
  const cloreMission = (k) => gesteCarnet(() => {
    if (!ui.confirmerCloture) { ui.confirmerCloture = true; return; }
    ui.confirmerCloture = false;
    const e = carnetCourant();
    const d = comparerChantier(e, k, lu.copie);
    if (d) throw new Error(`DIVERGENCE : ${d}. STOP`);
    const b = bilanChantier({ journal: lu.copie.journal, registre: lu.copie.registre });
    const issue = issueCloture(b, lu.copie.journal);
    engagerCarnet(evenementCarnet('mission-close', { k, issue, cout: issue === 'issue-inconnue' ? null : b.cout }));
    dire('carnet', `Mission ${k} close (${issue}${issue === 'issue-inconnue' ? ', coût inconnu : plafond gardé réservé' : `, coût ${usd(b.cout)}`}). Carnet BLOQUÉ : aucune relance ; seul l'arrêt reste possible.`);
  });
  // Livraison : la preuve ATELIER-LIVRAISON-1 (émise par Claude après vérification git) est recoupée avec le chantier de CET appareil :
  // même chantier, conforme à la mission, terminé sur le MÊME candidat, même coût connu, sauvegarde confirmée à jour = la preuve.
  const enregistrerLivraison = (k) => gesteCarnet(() => {
    const l = lireLivraison(ui.livraisonCarnet.trim());
    if (l.raison) throw new Error(l.raison);
    const v = l.livraison;
    const e = carnetCourant();
    if (v.carnet !== e.id || v.k !== k) throw new Error(`preuve d'un autre carnet ou d'une autre mission (attendu ${e.id}, mission ${k})`);
    if (!lu.copie.journal) throw new Error('aucun chantier sur cet appareil : la preuve ne peut pas être recoupée');
    const d = comparerChantier(e, k, lu.copie);
    if (d) throw new Error(`DIVERGENCE : ${d}. STOP`);
    const b = bilanChantier({ journal: lu.copie.journal, registre: lu.copie.registre });
    if (b.statut !== 'termine' || b.candidat !== v.candidat) throw new Error('le chantier de cet appareil n\'est pas terminé sur ce candidat accepté');
    if (b.inconnu || b.cout !== v.cout) throw new Error(`coût de la preuve (${v.cout}) différent du coût connu du chantier (${b.cout === null ? 'inconnu' : b.cout})`);
    const s = lu.copie.sauvegarde;
    if (!s || s.empreinte !== v.preuve || s.empreinte !== ecrireEtatDurable(lu.copie).empreinte) throw new Error('la preuve ne cite pas la sauvegarde durable confirmée et à jour de ce chantier');
    engagerCarnet(evenementCarnet('mission-livree', { candidat: v.candidat, carnet: v.carnet, chantier: v.chantier, cout: v.cout, k: v.k, main: v.main, preuve: v.preuve, version: v.version }));
    ui.livraisonCarnet = '';
    dire('carnet', `Mission ${k} livrée en v${v.version} (main ${v.main.slice(0, 8)}, coût ${usd(v.cout)} confirmé). Sauvegarde le carnet (Claude y revérifie la livraison par git), puis valide-la après contrôle de l'APK.`);
  });
  const validerMission = (k) => gesteCarnet(() => {
    engagerCarnet(evenementCarnet('mission-validee', { k }));
    dire('carnet', k === 3 ? 'Mission 3 validée : carnet TERMINÉ.' : `Mission ${k} validée. Mission ${k + 1} : efface le CHANTIER de cet appareil, puis ouvre-la ; si la livraison n'est pas encore sauvegardée, sauvegarde d'abord le carnet.`);
  });
  const arreterCarnet = gesteCarnet(() => {
    if (!(ui.motifCarnet || '').trim()) throw new Error('motif de l\'arrêt obligatoire');
    engagerCarnet(evenementCarnet('carnet-arrete', { motif: ui.motifCarnet }));
    ui.motifCarnet = '';
    dire('carnet', 'Carnet arrêté définitivement.');
  });
  function preparerSauvegardeCarnet() {
    if (!pilote()) return;
    try {
      const texte = durableCarnet();
      ui.preparationCarnet = { texte, empreinte: hacherSha256(texte), parties: decouper(texte, carnetCourant().id) };
      dire('carnet', `${ui.preparationCarnet.parties.length} partie(s) du carnet prête(s) : copie-les une à une, chacune dans son propre message à Claude.`);
    } catch (e) { ui.preparationCarnet = null; dire('carnet', `Sauvegarde du carnet impossible : ${e.message}`, true); }
    rendre();
  }
  async function copierPartieCarnet(k) {
    if (!pilote() || !ui.preparationCarnet || ui.preparationCarnet.texte !== durableCarnet()) return;
    await copierVers('carnet', ui.preparationCarnet.parties[k - 1], `Partie ${k}/${ui.preparationCarnet.parties.length} du carnet`);
    rendre();
  }
  const confirmerCarnet = gesteCarnet(() => {
    const c = lireConfirmation(ui.confirmationCarnet);
    if (c.raison) throw new Error(c.raison);
    const e = carnetCourant();
    if (c.chantier !== e.id) throw new Error(`confirmation de « ${c.chantier} », pas du carnet « ${e.id} »`);
    if (c.empreinte !== hacherSha256(durableCarnet())) throw new Error('confirmation d\'un autre état que le carnet actuel de cet appareil. Rien n\'est enregistré');
    engagerCarnet({ ...structuredClone(lc.carnet), sauvegarde: { empreinte: c.empreinte, commit: c.commit, evenements: lc.carnet.journal.length } });
    ui.confirmationCarnet = '';
    dire('carnet', `Sauvegarde durable du carnet confirmée : ${brancheJournal(e.id)} @ ${c.commit}.`);
  });
  function effacerCarnet() {
    if (!ui.confirmerEffacementCarnet) { ui.confirmerEffacementCarnet = true; ui.confirmerEffacement = false; rendre(); return; }
    try { if (stockage) stockage.removeItem(CLE_CARNET); } catch { /* rien à faire de plus */ }
    lc = { carnet: carnetVide() };
    ui.confirmerEffacementCarnet = false; ui.partiesCarnet = []; ui.preparationCarnet = null;
    rendre();
  }

  function sectionCarnet() {
    const titre = '12. Carnet de trois missions (AT-10.1)';
    // v0.65.19 (E-T1) : le libellé nomme l'objet (CARNET) et son identifiant ; la confirmation dit la conséquence.
    const idCarnet = lc.carnet && lc.carnet.journal ? ` « ${carnetCourant().id} »` : '';
    const effacement = bouton(ui.confirmerEffacementCarnet ? `Confirmer : effacer le CARNET${idCarnet} (carnet local perdu, sauvegarde GitHub intacte)` : `Effacer le CARNET${idCarnet} de cet appareil`, 'effacer-carnet', effacerCarnet);
    if (!lc.carnet) return section('carnet', titre, el('p', { classe: 'resultat resultat-erreur', texte: `Copie locale du carnet illisible : rien n'est utilisé (${lc.illisible}).`, attrs: { 'data-atelier': 'carnet-illisible' } }), effacement);
    const e = carnetCourant();
    const p = (texte, nom) => el('p', { texte, attrs: nom ? { 'data-atelier': nom } : {} });
    if (!e) {
      const r = ui.partiesCarnet.length ? lireCollageCarnet(ui.partiesCarnet) : { statut: 'vide' };
      const contenu = [ligneTexte('Aucun carnet sur cet appareil. Colle les parties d\'une proposition de carnet (ou d\'un carnet sauvegardé, pour le restaurer), une à la fois.'),
        saisie('Coller une partie du carnet', ui.partieCarnet, (x) => { ui.partieCarnet = x; }, { nom: 'partie-carnet', multi: true, rangs: 6 }),
        bouton('Ajouter la partie', 'ajouter-partie-carnet', ajouterPartieCarnet, { principal: true, actif: pilote() })];
      if (r.statut === 'incomplet') contenu.push(ligneTexte(`Carnet ${r.chantier} — parties reçues : ${r.recues.join(', ')} sur ${r.N} — manquantes : ${r.manquantes.join(', ')}.`, 'carnet-collage'));
      if (r.statut === 'proposition') {
        const q = r.proposition;
        contenu.push(el('div', { classe: 'resultat atelier-verification', attrs: { 'data-atelier': 'apercu-carnet' } },
          el('p', { classe: 'atelier-titre', texte: 'APERÇU DE LA PROPOSITION — rien n\'est installé ni approuvé' }),
          p(`Carnet : ${q.carnet} — empreinte ${r.empreinte}`, 'apercu-carnet-empreinte'), p(`Objectif : ${q.objectif}`), p(`Base : ${q.base.version} @ ${q.base.sha}`),
          p(`Plafond total : ${usd(q.plafond_total)} (limite déclarée de l'espace Console : ${usd(q.limite_espace)})`, 'apercu-carnet-plafond'),
          ...q.missions.map((m, i) => p(`Mission ${i + 1} — ${m.jalon.titre} — plafond ${usd(m.plafond)} — appel ${m.appel.modele}, entrée <= ${m.appel.entree_max}, sortie <= ${m.appel.max_tokens} — fichiers : ${m.autorises.join(', ')}`, `apercu-mission-${i + 1}`))),
        bouton('Ouvrir le carnet en brouillon', 'installer-carnet', installerCarnet, { principal: true, actif: pilote() }));
      }
      if (r.statut === 'etat') {
        const x = r.lu.etat;
        contenu.push(el('div', { classe: 'resultat atelier-verification', attrs: { 'data-atelier': 'apercu-carnet' } },
          el('p', { classe: 'atelier-titre', texte: 'APERÇU DU CARNET SAUVEGARDÉ — rien n\'est installé avant ta confirmation' }),
          p(`Carnet : ${x.id} — statut ${x.statut} — empreinte de l'état ${r.lu.empreinte}`, 'apercu-carnet-empreinte'),
          ...x.missions.map((m) => p(`Mission ${m.k} — ${m.statut}`, `apercu-mission-${m.k}`))),
        bouton('Restaurer le carnet', 'installer-carnet', installerCarnet, { principal: true, actif: pilote() }));
      }
      if (ui.partiesCarnet.length) contenu.push(bouton('Abandonner le collage', 'abandonner-carnet', () => { ui.partiesCarnet = []; ui.partieCarnet = ''; ui.message = null; rendre(); }, { actif: pilote() }));
      return section('carnet', titre, ...contenu, message('carnet'), effacement);
    }
    const b = e.budget;
    const contenu = [ligneTexte(`Carnet ${e.id} — statut ${e.statut} — empreinte ${e.empreinte.slice(0, 16)}…`, 'carnet-statut'), ligneTexte(`Objectif : ${e.objectif}`),
      ligneTexte(`Budget : confirmé ${usd(b.confirme)} — réservé ${usd(b.reserve)} — disponible ${usd(b.disponible)} sur ${usd(e.plafond_total)}`, 'carnet-budget'),
      ...e.missions.map((m) => ligneTexte(`Mission ${m.k} (${m.chantier}) — ${m.spec.jalon.titre} — plafond ${usd(m.plafond)} — ${m.statut}${m.issue && m.issue !== 'livree' ? ` (${m.issue})` : ''}${m.cout !== null ? ` — coût ${usd(m.cout)}` : ''}${m.livraison ? ` — v${m.livraison.version}` : ''}`, `carnet-mission-${m.k}`))];
    if (e.statut === 'brouillon') {
      contenu.push(el('p', { classe: 'atelier-titre', texte: 'APPROBATION V1 : TROIS MISSIONS IMMUABLES' }),
        ligneTexte(`Approuver fige les trois missions, leur ordre, leurs plafonds et leur périmètre (empreinte ${e.empreinte}). Aucun appel, aucune dépense : chaque appel payant garde sa propre approbation.`, 'carnet-portee-v1'),
        bouton('Approuver le carnet (V1)', 'approuver-carnet', approuverCarnet, { principal: true, actif: manuel() }),
        manuel() ? null : ligneTexte('Approbation possible en mode MANUEL seulement.', 'carnet-v1-manuel'));
    }
    const k = e.missionCourante;
    const m = k === null ? null : e.missions[k - 1];
    const suivante = e.statut === 'approuve' ? 1 : m && m.statut === 'validee' && k < 3 ? k + 1 : null;
    if (suivante !== null && ['approuve', 'en-cours'].includes(e.statut)) {
      const raison = !ouverturePermise(suivante) ? `${raisonOuverture(suivante)} (ci-dessous)` : !atelierVide() ? 'atelier du chantier non vide : efface-le d\'abord (sa sauvegarde durable reste sur GitHub)' : null;
      contenu.push(bouton(`Ouvrir la mission ${suivante}`, `ouvrir-mission-${suivante}`, ouvrirMission(suivante), { principal: true, actif: pilote() && raison === null }),
        raison ? ligneTexte(`Avant d'ouvrir la mission ${suivante} : ${raison}.`, 'carnet-avant-ouverture') : null);
    }
    if (m && m.statut === 'ouverte' && e.statut === 'en-cours') {
      const ch = etatChantier();
      const d = ch ? comparerChantier(e, k, lu.copie) : null;
      const local = ch && !d ? ecartPreparation(lu.copie, e, k) : null;
      const bl = ch && !d ? bilanChantier({ journal: lu.copie.journal, registre: lu.copie.registre }) : null;
      contenu.push(el('p', { classe: 'atelier-titre', texte: `MISSION ${k} OUVERTE — chantier ${m.chantier}` }));
      if (!ch) {
        const p = preparationMission(e, k);
        const raison = p.raison ? p.raison : !carnetAJour() ? 'sauvegarde durable du carnet requise et à jour (ci-dessous)' : !atelierVide() ? 'atelier du chantier non vide : efface d\'abord le CHANTIER (sa sauvegarde durable reste sur GitHub)' : null;
        contenu.push(ligneTexte(`Le chantier ${m.chantier} n'est pas ouvert sur cet appareil : prépare-le en un geste depuis la mission approuvée (V1).`, 'carnet-chantier-absent'),
          bouton(`Préparer la mission ${k}`, `preparer-mission-${k}`, preparerMission(k), { principal: true, actif: pilote() && raison === null }),
          p.raison ? null : ligneTexte(`Préparer écrit, en une seule fois : le chantier ${m.chantier} ouvert et son plan approuvé (un jalon, une tentative : exactement la V1), la fiche du jalon, le cycle AT-2 ${p.cycle.cycle} et le plafond du chantier (${usd(p.plafond)}), l'appel AUTO de développement (${p.appel.modele}, entrée <= ${p.appel.entree_max}, sortie <= ${p.appel.max_tokens}, effort ${p.developpement.effort}, ${p.developpement.extraits.length} extrait(s)) et son engagement prévu ${usd(p.engagement)}. Ni l'estimation ni le plafond ne valent approbation de l'appel (V2) ou dépense : rien n'est lancé, aucun appel.`, 'carnet-portee-preparation'),
          raison ? ligneTexte(`Avant de préparer la mission ${k} : ${raison}.`, 'carnet-avant-preparation') : null);
      } else if (d) contenu.push(el('p', { classe: 'resultat resultat-erreur', texte: `⚠ DIVERGENCE entre le chantier de cet appareil et la mission ${k} : ${d}. STOP : aucun geste du carnet n'est possible ; arrête le carnet ou corrige le chantier avec Claude.`, attrs: { 'data-atelier': 'carnet-divergence' } }));
      else if (local) {
        contenu.push(el('p', { classe: 'resultat resultat-erreur', texte: `⚠ DIVERGENCE LOCALE avec la mission ${k} : ${local}. STOP : ni dossier, ni lancement. Le chantier durable est conforme : « Rétablir » réécrit seulement la fiche et les formulaires de la mission approuvée.`, attrs: { 'data-atelier': 'carnet-divergence-locale' } }),
          bouton(`Rétablir la préparation locale de la mission ${k}`, 'retablir-preparation', retablirPreparation(k), { principal: true, actif: pilote() }));
      } else {
        contenu.push(ligneTexte(`Chantier : ${bl.statut}${bl.candidat ? ` — candidat accepté ${bl.candidat.slice(0, 8)}` : ''} — coût ${bl.inconnu ? 'INCONNU (plafond réservé)' : usd(bl.cout)}`, 'carnet-bilan'));
        if (bl.statut === 'termine' && bl.candidat) {
          contenu.push(ligneTexte('Accepter un candidat ne vaut pas livraison : colle la preuve ATELIER-LIVRAISON-1 que Claude émet après la livraison vérifiée (étiquette, base, fichiers, coût).', 'carnet-livraison-portee'),
            saisie('Coller la preuve de livraison (ATELIER-LIVRAISON-1 …)', ui.livraisonCarnet, (x) => { ui.livraisonCarnet = x; }, { nom: 'livraison-carnet', multi: true, rangs: 3 }),
            bouton(`Enregistrer la livraison de la mission ${k}`, 'enregistrer-livraison', enregistrerLivraison(k), { principal: true, actif: pilote() }));
        }
        contenu.push(bouton(ui.confirmerCloture ? `Confirmer : clore la mission ${k} en échec (${issueCloture(bl, lu.copie.journal)})` : `Clore la mission ${k} en échec (${issueCloture(bl, lu.copie.journal)})`, 'clore-mission', cloreMission(k), { actif: pilote() }),
          ligneTexte('Clore en échec bloque le carnet : aucune relance, aucune mission suivante ; seul l\'arrêt reste possible.', 'carnet-clore-portee'));
      }
    }
    if (m && m.statut === 'livree') contenu.push(bouton(`Mission ${k} validée (APK contrôlé)`, 'valider-mission', validerMission(k), { principal: true, actif: pilote() }));
    if (!['termine', 'arrete'].includes(e.statut)) {
      contenu.push(saisie('Motif d\'un arrêt du carnet', ui.motifCarnet, (x) => { ui.motifCarnet = x; }, { nom: 'motif-carnet' }),
        bouton('Arrêter définitivement le carnet', 'arreter-carnet', arreterCarnet, { actif: pilote() }));
    }
    const s = lc.carnet.sauvegarde;
    const actuel = durableCarnet();
    contenu.push(el('p', { classe: 'atelier-titre', texte: 'SAUVEGARDE DURABLE DU CARNET' }),
      ligneTexte(s ? `Dernière sauvegarde confirmée : ${brancheJournal(e.id)} @ ${s.commit} — ${carnetAJour() ? 'à jour' : 'carnet modifié depuis : sauvegarde à refaire'}` : 'Aucune sauvegarde durable du carnet confirmée sur cet appareil.', 'carnet-sauvegarde-statut'),
      bouton('Préparer la sauvegarde du carnet', 'preparer-sauvegarde-carnet', preparerSauvegardeCarnet, { actif: pilote() }));
    if (ui.preparationCarnet && ui.preparationCarnet.texte === actuel) {
      const n = ui.preparationCarnet.parties.length;
      contenu.push(ligneTexte(`État du carnet : empreinte ${ui.preparationCarnet.empreinte}, ${n} partie(s).`, 'carnet-parties'),
        ...ui.preparationCarnet.parties.map((_, i) => bouton(`Copier la partie ${i + 1}/${n} du carnet`, `copier-partie-carnet-${i + 1}`, () => copierPartieCarnet(i + 1), { actif: pilote() })),
        portee(`Ton collage de ces ${n} partie(s) à Claude autorise UNIQUEMENT : la branche ${brancheJournal(e.id)} (créée orpheline si absente, sinon avancée en avance rapide), le seul fichier carnet.json, avec ce contenu exact, s'il est valide et prolonge la sauvegarde précédente ; une livraison inscrite est revérifiée par git avant toute écriture. Aucun force-push, aucune suppression, rien sur main, aucun tag, aucun appel, aucune dépense.`, 'carnet-portee-sauvegarde'),
        retour('carnet'));
    } else if (ui.preparationCarnet) contenu.push(ligneTexte('Carnet modifié depuis la préparation : prépare à nouveau.', 'carnet-preparation-perimee'));
    contenu.push(saisie('Coller la confirmation de Claude (ATELIER-SAUVEGARDE-1 …)', ui.confirmationCarnet, (x) => { ui.confirmationCarnet = x; }, { nom: 'confirmation-carnet', multi: true, rangs: 2 }),
      bouton('Enregistrer la confirmation du carnet', 'enregistrer-confirmation-carnet', confirmerCarnet, { actif: pilote() }));
    return section('carnet', titre, ...contenu, message('carnet'), effacement);
  }

  function rendre() {
    sections.length = 0;
    zone.textContent = '';
    if (!lu.copie) {
      zone.append(bandeau(null), el('p', { classe: 'resultat resultat-erreur', texte: `Copie locale illisible : rien n'est utilisé (${lu.illisible}).`, attrs: { 'data-atelier': 'illisible' } }), blocEffacer());
      return;
    }
    const e = etatChantier();
    if (ui.section === null) ui.section = (attenteD3() ? 'sauvegarde' : SECTION_DE_L_ETAPE[etapeCourante().etape]) || (pilote() && e && e.statut === 'en-cours' ? 'dossier' : 'chantier');
    zone.append(bandeau(e), sectionChantier(e), sectionPlan(e), sectionFiche(e), sectionBudget(e), sectionDossier(), sectionRapport(), sectionVerification(), sectionDecision(), sectionJournal(), sectionSauvegarde(e), ...(auto() ? [sectionAuto(e)] : []), sectionCarnet(), blocEffacer());
  }
  function blocEffacer() {
    const idChantier = lu.copie && lu.copie.journal ? ` « ${etatChantier().id} »` : '';
    return el('div', { classe: 'bloc' },
      ligneTexte('Copie de travail locale jetable : ni autorité Git, ni acquisition, ni sauvegarde de Naissance.'),
      // v0.65.19 (E-T1) : le libellé nomme l'objet (CHANTIER) et son identifiant ; la confirmation dit la conséquence.
      bouton(ui.confirmerEffacement ? `Confirmer : effacer le CHANTIER${idChantier} (mode OFF, chantier local perdu, sauvegarde GitHub intacte)` : `Effacer le CHANTIER${idChantier} de cet appareil`, 'effacer', effacer));
  }

  rendre();
  return {
    rafraichir() {
      lu = lireCopie(stockage, version);
      lc = lireCarnetLocal(stockage);
      ui = { ...ui, dossier: null, verification: null, confirmerEffacement: false, preparation: null, preparationCarnet: null, confirmerEffacementCarnet: false, confirmerCloture: false };
      rendre();
    },
  };
}

// Nombre d'octets UTF-8 d'une chaîne (affichage seulement).
function octets(s) {
  let n = 0;
  for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}
// === FIN_ATELIER_ECRAN ===
