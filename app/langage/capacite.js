// === DEBUT_LANGAGE_CAPACITE ===
// v0.63.84 — B1 : CAPACITÉ D'AGIR (décision ChatGPT « SONDE 1 VALIDÉE — INTÉGRATION DE B1 », 10/10/2026 ; issue de la sonde 1 du 10/10).
//
// PREMIER BESOIN PRIMITIF PROGRAMMÉ de Naissance (décision du 09/10 : les besoins primitifs sont programmés ; ce qui doit émerger est ce qu'on
// en fait). Un ÉTAT PROPRE c ∈ [0, plafond] qui :
//   - existe indépendamment du contenu des messages ;
//   - diminue quand Naissance AGIT : un TOUR ACTIF (un tour dont le lot mécanique a réellement produit ≥ 1 exécution propre) coûte coutTourActif ;
//   - se restaure quand elle se REPOSE : un tick de temps propre sans activité rend recuperationRepos, jusqu'au plafond ;
//   - CONTRAINT son action : à c = 0, le lot mécanique du tour n'a pas lieu (l'observation du monde, elle, a toujours lieu) ;
//   - est OBSERVABLE par elle et entre dans son expérience générique par la projection « soi » (projection-soi.js via executions-vecues.js) :
//     chaque variation est, pour les mécanismes .69→.83 inchangés, l'exécution « soi:tour / soi:repos (etat = état d'avant) → nouvel état » ;
//   - devient ANTICIPABLE : avant chaque variation, contextes (.72) et attentes (.74) sont écrits pour « soi:<cause>(etat = état courant) » avec
//     les PRIMITIVES EXISTANTES (mêmes tables, même ancrage par idDesignation que .83 pour les émissions), puis la variation (l'issue) ;
//   SANS valeur : aucune préférence pour c élevé, aucune récompense, aucun score, aucune règle de classe. La SEULE lecture de c par un mécanisme
//   est « c === 0 ? » (porte, dans main.js) ; ce module ne compare jamais deux valeurs de c autrement que pour appliquer le plafond.
//
// PARAMETRES_B1 : les SEULS nombres de B1, marqués PARAMÈTRES PRIMITIFS INITIAUX (pas des constantes démontrées) :
//   plafond 3 (décision A : cycle assez court pour être observé et validé sur téléphone ; aucune autre justification, rien n'en est généralisé),
//   coutTourActif 1, recuperationRepos 1.
//
// CAUSES (vocabulaire OBLIGATOIRE, décision du 10/10) :
//   'tour'  : UN TOUR ACTIF DE NAISSANCE. cause.id = l'identité de l'observation du tour, réutilisée comme IDENTITÉ TECHNIQUE STABLE DU TOUR (un
//             tour = une observation, déjà persistée et unique). Cela signifie « cet identifiant identifie le tour actif correspondant », JAMAIS
//             « observer le message a consommé la capacité » : un tour observé sans acte exécuté ne consomme rien ; un tour à c = 0 non plus.
//   'repos' : UN TICK DE TEMPS PROPRE sans activité. cause.id = nouvelId('tick-propre'), identité unique et persistée par la variation elle-même.
//
// TEMPS PROPRE (décision B) : dans cette version, le tick de repos est déclenché par le bouton « Repos » de l'écran (main.js → tickPropre, tick-propre.js) :
//   CE BOUTON EST UN DISPOSITIF DE VALIDATION DU TEMPS PROPRE, PAS LE TEMPS PROPRE DÉFINITIF DE NAISSANCE. Aucune boucle autonome, aucun
//   minuteur, aucune cadence automatique ici ni ailleurs. Ce qui est validé : tick → variation → expérience → attente → issue.
//
// RECONSTRUCTION (lireCapacite) : l'état courant est la fin de la CHAÎNE origine → variation (idEtatAvant = origine) → variation (idEtatAvant =
//   état d'après de la précédente) → … ; indépendante de l'ordre de lecture des lignes, identique après redémarrage. Cette chaîne sert UNIQUEMENT
//   à reconstruire les faits persistés : la projection expose des états d'UN pas, les mécanismes ne reçoivent jamais la chaîne comme ascendance.
//
// HORS B1 (décision C, documenté) : la sollicitation EXTÉRIEURE (bouton « Exécuter », origine 'exterieure') n'est ni gatée par c ni coûteuse :
//   ce n'est pas un acte propre du lot mécanique. Les émissions suivent le lot et ne coûtent rien par elles-mêmes.
import { enregistrerCapaciteInitiale, enregistrerVariationCapacite, enregistrerContexteProspectif, enregistrerAttenteProspective } from './connaissances.js';
import { contextesProspectifs } from './contexte-prospectif.js';
import { attentesDuContexteProspectif } from './attentes-prospectives.js';
import { attentesConditionneesDesContextes } from './attentes-conditionnees.js';
import { retrouvaillesDesContextes } from './retrouvailles.js';
import { rappelsDesContextes } from './rappels.js';
import { episodesDeTransformation } from './episodes-de-transformation.js';
import { lireExecutionsVecues } from './executions-vecues.js';
import { identiteEtatApres, PREFIXE_SOI, ENTREE_ETAT } from './projection-soi.js';
import { prospecterConsequence, SOURCE_OBSERVATION_INTERNE, ORIGINE_CONSEQUENCE } from './prospection-soi.js';
// v0.66.5 — C1 « ISSUE VÉCUE D'UNE RETROUVAILLE » : juste APRÈS l'écriture de la variation (la conséquence), conserverIssuesVecues reçoit
// l'acte (idDesignation porté par l'exécution projetée de la variation : celui de la ligne, sinon cause.id) et l'id du fait écrit. L'appel ne
// change ni la valeur rendue ni la variation ; il absorbe toute erreur (rien ne remonte).
import { conserverIssuesVecues } from './issues-vecues.js';
// v0.63.86 — le TICK (observation interne, désignations, conséquences B1 ET B2) vit désormais dans tick-propre.js ; ce module ne connaît que la
// capacité : sa règle, sa lecture, la conséquence d'un tour actif, et la conséquence d'un repos DÉJÀ désignée (par le tick).
export { SOURCE_OBSERVATION_INTERNE, ORIGINE_CONSEQUENCE };

export const PARAMETRES_B1 = Object.freeze({ plafond: 3, coutTourActif: 1, recuperationRepos: 1 });
export const CAUSE_TOUR = 'tour';
export const CAUSE_REPOS = 'repos';

function exigerMagasin(magasin, nom) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function' || typeof magasin.ecrire !== 'function') throw new TypeError(`${nom} : magasin doit offrir lireTout et ecrire.`);
}

// L'état propre courant : { idEtat, valeur, origine, derniere, nombreVariations }. Écrit l'origine (valeur = plafond) si elle n'existe pas encore.
export async function lireCapacite(magasin, parametres = PARAMETRES_B1) {
  exigerMagasin(magasin, 'lireCapacite');
  let origines = await magasin.lireTout('capaciteInitiale');
  if (!Array.isArray(origines)) throw new TypeError('lireCapacite : la table capaciteInitiale doit rendre un tableau.');
  if (origines.length === 0) origines = [await enregistrerCapaciteInitiale(magasin, { valeur: parametres.plafond })];
  if (origines.length > 1) throw new TypeError('lireCapacite : plusieurs origines de capacité (une seule attendue).');
  const origine = origines[0];
  const variations = await magasin.lireTout('variationsCapacite');
  if (!Array.isArray(variations)) throw new TypeError('lireCapacite : la table variationsCapacite doit rendre un tableau.');
  const suites = new Map();
  for (const v of variations) {
    if (v === null || typeof v !== 'object' || typeof v.idEtatAvant !== 'string') throw new TypeError('lireCapacite : variation mal formée.');
    if (suites.has(v.idEtatAvant)) throw new TypeError(`lireCapacite : deux variations partent de l'état « ${v.idEtatAvant} » (fourche).`);
    suites.set(v.idEtatAvant, v);
  }
  let idEtat = origine.id;
  let valeur = origine.valeur;
  let derniere = null;
  let pas = 0;
  while (suites.has(idEtat)) {
    derniere = suites.get(idEtat);
    idEtat = identiteEtatApres(derniere);
    valeur = derniere.valeur;
    pas += 1;
    if (pas > variations.length) throw new TypeError('lireCapacite : chaîne de variations cyclique.');
  }
  if (pas !== variations.length) throw new TypeError(`lireCapacite : ${variations.length - pas} variation(s) hors de la chaîne (état d'avant inconnu).`);
  return { idEtat, valeur, origine, derniere, nombreVariations: variations.length };
}

// L'application « soi:repos(etat = état courant) » : ce que le tick fait DÉSIGNER dans son observation interne (tick-propre.js).
export function applicationRepos(etat) {
  return { operation: PREFIXE_SOI + CAUSE_REPOS, liaisons: [{ entree: ENTREE_ETAT, donnee: etat.idEtat }] };
}

// TOUR ACTIF (.84, inchangé) : AVANT l'issue, contextes .72 puis attentes .74 pour « soi:tour(etat = état courant) », désignés par l'identité technique
// du tour (observation du tour) ; puis la variation. Ce chemin reste en régime .84 (aucune désignation de conséquence : l'observation du tour
// n'examine pas l'état propre ; voir tick-propre.js pour le régime .85/.86).
async function prospecterTour(magasin, acte, idEtat) {
  const application = { operation: acte.operation, liaisons: [{ entree: ENTREE_ETAT, donnee: idEtat }] };
  let vecu = null;
  let vueEpisodes = null;
  let contextes = [];
  try {
    vecu = await lireExecutionsVecues(magasin);
    // v0.64.1 — la vue des épisodes du vécu « avant » est calculée UNE fois ici, sur les lignes exactes de contextesProspectifs, puis transmise
    // explicitement aux contextes et aux attentes conditionnées (aucun recalcul identique ; .74 inchangé).
    vueEpisodes = episodesDeTransformation(vecu.valeurs, vecu.executions, vecu.descriptions);
    contextes = contextesProspectifs(application, vecu.valeurs, vecu.executions, vecu.descriptions, vueEpisodes);
  } catch (erreur) {
    if (!(erreur instanceof TypeError)) throw erreur;
    contextes = [];
  }
  const lignes = [];
  // v0.64.31 — RETROUVAILLE-1 : AVANT toute attente de l'acte, UNE lecture de attentesProspectives, puis, pour chaque contexte, la retrouvaille
  // (calcul pur, même vécu « avant »), écrite DANS la ligne du contexte. Elle n'influence rien de ce qui suit (attentes, issue) : les lignes
  // d'attentes produites sont exactement celles d'avant. Une garantie violée (attente de l'acte déjà présente) lève : jamais masquée.
  const retrouvailles = contextes.length === 0 ? [] : retrouvaillesDesContextes(contextes, acte, await magasin.lireTout('attentesProspectives'), vecu);
  // v0.66.14 — C2 « RAPPEL DES ISSUES DÉJÀ VÉCUES » : pour chaque contexte retrouvé, le rappel (historique de ce qui est déjà arrivé après la
  // même retrouvaille, calculé sur les tables AVANT toute écriture de cet acte), écrit DANS la ligne du contexte s'il n'est pas null. Il n'est
  // lu par rien de ce qui suit (attentes, issue) : seul le Diagnostic le relira.
  const rappels = await rappelsDesContextes(magasin, retrouvailles, acte);
  for (let k = 0; k < contextes.length; k += 1) lignes.push(await enregistrerContexteProspectif(magasin, { designation: acte, contexte: contextes[k], retrouvaille: retrouvailles[k], ...(rappels[k] === null ? {} : { rappel: rappels[k] }) }));
  if (lignes.length === 0) return { contextes: 0, attentes: 0 };
  const anterieurs = await magasin.lireTout('contextesProspectifs');
  let nombreAttentes = 0;
  for (const contexte of lignes) {
    let attentes = [];
    try {
      attentes = attentesDuContexteProspectif(contexte, acte, anterieurs, vecu.valeurs, vecu.executions, vecu.descriptions);
    } catch (erreur) {
      if (!(erreur instanceof TypeError)) throw erreur;
      attentes = [];
    }
    for (const attente of attentes) { await enregistrerAttenteProspective(magasin, { designation: acte, contexte, attente }); nombreAttentes += 1; }
  }
  // v0.64.1 — ATTENTES CONDITIONNÉES PAR LA PARTIE CONNUE (source distincte de .74, champ `fondation`) : même vécu « avant », même ancrage,
  // écrites APRÈS les attentes .74, sans rien changer à celles-ci ni au flux. Un passé non résoluble (TypeError) = aucune attente conditionnée.
  let conditionnees = [];
  try {
    conditionnees = attentesConditionneesDesContextes(lignes, acte, vecu.valeurs, vecu.executions, vecu.descriptions, vueEpisodes);
  } catch (erreur) {
    if (!(erreur instanceof TypeError)) throw erreur;
    conditionnees = [];
  }
  // une sortie par contexte, dans l'ordre des contextes transmis (rang k ↔ lignes[k]).
  for (let k = 0; k < conditionnees.length; k += 1) for (const attente of conditionnees[k].attentes) await enregistrerAttenteProspective(magasin, { designation: acte, contexte: lignes[k], attente });
  return { contextes: lignes.length, attentes: nombreAttentes };
}

// UN TOUR ACTIF : à appeler APRÈS le lot mécanique, seulement si ce lot a produit ≥ 1 exécution (c'est l'appelant qui l'établit : main.js).
// Exige c > 0 (la porte a eu lieu avant le lot) ; le résultat ne descend jamais sous 0.
// v0.63.88 — PORTE B1 GÉNÉRIQUE (décision ChatGPT « ORDRE DE DÉVELOPPEMENT v0.63.88 », 11/10/2026) : « ai-je actuellement la capacité d'accomplir un
// acte propre ? » — UNE définition, lue par le tour mécanique (main.js) et par l'épisode propre (episode-propre.js). Elle ne connaît ni B2, ni la
// relation, ni la conversation, ni aucun motif : seulement l'état de capacité rendu par lireCapacite. c = 0 → false ; c > 0 → true.
export function peutAgir(etatCapacite) {
  if (etatCapacite === null || typeof etatCapacite !== 'object' || typeof etatCapacite.valeur !== 'number' || !Number.isFinite(etatCapacite.valeur)) throw new TypeError('peutAgir : état de capacité { valeur } requis.');
  return etatCapacite.valeur > 0;
}

// v0.63.88 — `idDesignation` (facultatif) : l'engagement propre (désignation D d'origine « propre », episode-propre.js) dont ce coût est l'issue ; la
// variation le porte (primitive existante « une désignation, une issue »). Le tour mécanique (main.js) ne le fournit pas : comportement .84 inchangé.
export async function tourActif(magasin, { idObservation, horodatage, idDesignation }, parametres = PARAMETRES_B1) {
  exigerMagasin(magasin, 'tourActif');
  if (typeof idObservation !== 'string' || idObservation.length === 0) throw new TypeError('tourActif : idObservation (identité technique du tour) doit être une chaîne non vide.');
  if (typeof horodatage !== 'string' || horodatage.length === 0) throw new TypeError('tourActif : horodatage doit être une chaîne non vide.');
  const avant = await lireCapacite(magasin, parametres);
  if (!peutAgir(avant)) throw new TypeError('tourActif : la capacité est à 0 (le lot n\'aurait pas dû avoir lieu).');
  const cause = { type: CAUSE_TOUR, id: idObservation };
  const acte = { id: cause.id, idObservation, operation: PREFIXE_SOI + CAUSE_TOUR, horodatage };
  const prospection = await prospecterTour(magasin, acte, avant.idEtat);
  if (idDesignation !== undefined && (typeof idDesignation !== 'string' || idDesignation.length === 0)) throw new TypeError('tourActif : idDesignation, si présent, doit être une chaîne non vide.');
  const variation = await enregistrerVariationCapacite(magasin, { cause, idEtatAvant: avant.idEtat, valeur: Math.max(0, avant.valeur - parametres.coutTourActif), ...(idDesignation === undefined ? {} : { idDesignation }) });
  await conserverIssuesVecues(magasin, { idDesignation: idDesignation === undefined ? cause.id : idDesignation, idExecution: variation.id });
  return { variation, avant: avant.valeur, apres: variation.valeur, prospection };
}

// CONSÉQUENCE B1 D'UN TICK DE REPOS, déjà DÉSIGNÉE par le tick (tick-propre.js : observation interne → désignation D1 → …). Deux temps, pour que
// l'ordre « toutes les prospections, puis toutes les variations » soit tenu quand un tick a plusieurs conséquences :
//   prospecterRepos(magasin, designation)                 → contextes .72 + attentes .74 ancrés sur D1 ;
//   varierRepos(magasin, { tick, designation, avant })    → la variation (cause = le tick, idDesignation = D1), c → min(plafond, c + recuperationRepos).
// À saturation la variation existe tout de même (état inchangé : un fait « egale »). Restaure jusqu'au plafond, jamais au-delà.
export async function prospecterRepos(magasin, designation) {
  exigerMagasin(magasin, 'prospecterRepos');
  if (designation === null || typeof designation !== 'object' || designation.operation !== PREFIXE_SOI + CAUSE_REPOS) throw new TypeError('prospecterRepos : la désignation doit être celle de soi:repos.');
  return prospecterConsequence(magasin, designation);
}
export async function varierRepos(magasin, { tick, designation, avant }, parametres = PARAMETRES_B1) {
  exigerMagasin(magasin, 'varierRepos');
  if (tick === null || typeof tick !== 'object' || typeof tick.id !== 'string' || tick.id.length === 0) throw new TypeError('varierRepos : tick { id } requis.');
  if (designation === null || typeof designation !== 'object' || typeof designation.id !== 'string') throw new TypeError('varierRepos : désignation requise.');
  if (avant === null || typeof avant !== 'object' || typeof avant.idEtat !== 'string') throw new TypeError('varierRepos : état d\'avant requis.');
  const variation = await enregistrerVariationCapacite(magasin, { cause: { type: CAUSE_REPOS, id: tick.id }, idEtatAvant: avant.idEtat, valeur: Math.min(parametres.plafond, avant.valeur + parametres.recuperationRepos), idDesignation: designation.id });
  await conserverIssuesVecues(magasin, { idDesignation: designation.id, idExecution: variation.id });
  return { variation, avant: avant.valeur, apres: variation.valeur };
}
// === FIN_LANGAGE_CAPACITE ===
