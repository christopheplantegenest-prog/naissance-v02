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
// TEMPS PROPRE (décision B) : dans cette version, le tick de repos est déclenché par le bouton « Repos » de l'écran (main.js → tickRepos) :
//   CE BOUTON EST UN DISPOSITIF DE VALIDATION DU TEMPS PROPRE, PAS LE TEMPS PROPRE DÉFINITIF DE NAISSANCE. Aucune boucle autonome, aucun
//   minuteur, aucune cadence automatique ici ni ailleurs. Ce qui est validé : tick → variation → expérience → attente → issue.
//
// RECONSTRUCTION (lireCapacite) : l'état courant est la fin de la CHAÎNE origine → variation (idEtatAvant = origine) → variation (idEtatAvant =
//   état d'après de la précédente) → … ; indépendante de l'ordre de lecture des lignes, identique après redémarrage. Cette chaîne sert UNIQUEMENT
//   à reconstruire les faits persistés : la projection expose des états d'UN pas, les mécanismes ne reçoivent jamais la chaîne comme ascendance.
//
// HORS B1 (décision C, documenté) : la sollicitation EXTÉRIEURE (bouton « Exécuter », origine 'exterieure') n'est ni gatée par c ni coûteuse :
//   ce n'est pas un acte propre du lot mécanique. Les émissions suivent le lot et ne coûtent rien par elles-mêmes.
import { enregistrerCapaciteInitiale, enregistrerVariationCapacite, enregistrerContexteProspectif, enregistrerAttenteProspective, enregistrerDesignation, enregistrerObservationPossibilites, nouvelId } from './connaissances.js';
// v0.63.85 — OBSERVATION INTERNE du tick (sondes X1/X2) : la même observation que celle du tour, appliquée à la donnée courante « état propre ».
import { observerPossibilites } from './observation-possibilites.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';
import { DESCRIPTION_SOURCE_SOI } from './source-soi.js';
import { contextesProspectifs } from './contexte-prospectif.js';
import { attentesDuContexteProspectif } from './attentes-prospectives.js';
import { lireExecutionsVecues } from './executions-vecues.js';
import { identiteEtatApres, PREFIXE_SOI, ENTREE_ETAT, DESCRIPTIONS_SOI } from './projection-soi.js';

export const SOURCE_OBSERVATION_INTERNE = 'soi';
export const ORIGINE_CONSEQUENCE = 'mecanique';

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

// AVANT l'issue : contextes .72 puis attentes .74 pour « soi:<type>(etat = état courant) », désignés par la cause (même patron que l'émission en
// .83 : la cause est un fait déjà persisté, son issue — la variation — n'existe pas encore). Un TypeError des vues = « calcul non effectué ».
async function prospecterSoi(magasin, acte, idEtat) {
  const application = { operation: acte.operation, liaisons: [{ entree: ENTREE_ETAT, donnee: idEtat }] };
  let vecu = null;
  let contextes = [];
  try {
    vecu = await lireExecutionsVecues(magasin);
    contextes = contextesProspectifs(application, vecu.valeurs, vecu.executions, vecu.descriptions);
  } catch (erreur) {
    if (!(erreur instanceof TypeError)) throw erreur;
    contextes = [];
  }
  const lignes = [];
  for (const contexte of contextes) lignes.push(await enregistrerContexteProspectif(magasin, { designation: acte, contexte }));
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
  return { contextes: lignes.length, attentes: nombreAttentes };
}

async function varier(magasin, cause, idObservation, horodatage, nouvelleValeur, designation = null) {
  const avant = await lireCapacite(magasin);
  // v0.63.85 : si une DÉSIGNATION de la conséquence a été écrite (tick : chaîne observation interne → désignation), l'acte prospectif EST cette
  // désignation (id = D.id, idObservation = l'observation interne) et la variation la porte ; sinon (tour actif, .84) : l'acte est identifié par la cause.
  const acte = designation === null ? { id: cause.id, idObservation, operation: PREFIXE_SOI + cause.type, horodatage } : { id: designation.id, idObservation: designation.idObservation, operation: PREFIXE_SOI + cause.type, horodatage: designation.horodatage };
  const prospection = await prospecterSoi(magasin, acte, avant.idEtat);
  const variation = await enregistrerVariationCapacite(magasin, { cause, idEtatAvant: avant.idEtat, valeur: nouvelleValeur(avant.valeur), ...(designation === null ? {} : { idDesignation: designation.id }) });
  return { variation, avant: avant.valeur, apres: variation.valeur, prospection };
}

// v0.63.85 — OBSERVATION INTERNE (décision ChatGPT du 10/10/2026 ; sondes X1/X2). ORDRE PROSPECTIF OBLIGATOIRE au tick T :
//   T (fait de temps propre) → O : observation interne de l'ÉTAT PROPRE AVANT CONSÉQUENCE (datum = la donnée d'état courante, source déclarée
//   DESCRIPTION_SOURCE_SOI, forme nombre : aucune fausse chaîne de texte ; même mécanisme que l'observation d'un message, catalogue = catalogue réel +
//   DESCRIPTIONS_SOI ; ligne persistée avec source = 'soi') → D : DÉSIGNATION de l'application « soi:repos(etat = état courant) » parmi les possibilités
//   de O (table designations, idObservation = O.id, origine 'mecanique' : aucun choix) → contextes/attentes (.72/.74, ancrage D) → V : la variation
//   (son issue), qui porte idDesignation = D.id → la projection expose l'exécution { id: V.id, idDesignation: D.id } : issue calculable (.73), et un
//   futur tick pourra porter D1, D2… (une désignation par conséquence, aucune collision).
//   L'observation interne N'APPELLE PAS le déclencheur mécanique (.60) : ses possibilités déterminées (sur les productions passées) restent
//   OBSERVÉES ; aucune exécution, aucune émission, aucun tourActif, aucune boucle. Le seul fait exécuté est la conséquence B1 du repos.
//   Une observation ou une désignation impossible = tick refusé (erreur rendue à l'appelant) : jamais une variation sans identité propre.
async function observerEtatPropre(magasin, etat, descriptions) {
  const datum = { id: etat.idEtat, valeur: etat.valeur, source: DESCRIPTION_SOURCE_SOI };
  const r = await observerPossibilites(datum, {
    enregistrer: (donnees) => enregistrerObservationPossibilites(magasin, donnees),
    lireExecutions: () => magasin.lireTout('executionsOperations'),
    descriptions,
    descriptionSource: DESCRIPTION_SOURCE_SOI,
    source: SOURCE_OBSERVATION_INTERNE,
  });
  if (r.statut !== 'ecrite') throw new TypeError(`tickRepos : observation interne impossible (${r.statut}).`);
  return { observation: r.observation, univers: r.univers };
}

// UN TOUR ACTIF : à appeler APRÈS le lot mécanique, seulement si ce lot a produit ≥ 1 exécution (c'est l'appelant qui l'établit : main.js).
// Exige c > 0 (la porte a eu lieu avant le lot) ; le résultat ne descend jamais sous 0.
export async function tourActif(magasin, { idObservation, horodatage }, parametres = PARAMETRES_B1) {
  exigerMagasin(magasin, 'tourActif');
  if (typeof idObservation !== 'string' || idObservation.length === 0) throw new TypeError('tourActif : idObservation (identité technique du tour) doit être une chaîne non vide.');
  if (typeof horodatage !== 'string' || horodatage.length === 0) throw new TypeError('tourActif : horodatage doit être une chaîne non vide.');
  return varier(magasin, { type: CAUSE_TOUR, id: idObservation }, idObservation, horodatage, (c) => {
    if (c === 0) throw new TypeError('tourActif : la capacité est à 0 (le lot n\'aurait pas dû avoir lieu).');
    return Math.max(0, c - parametres.coutTourActif);
  });
}

// UN TICK DE REPOS : un fait de temps propre, déclenché explicitement (bouton « Repos », décision B). Restaure jusqu'au plafond ; à saturation,
// la variation existe tout de même (état inchangé : un fait « egale » pour l'expérience).
export async function tickRepos(magasin, parametres = PARAMETRES_B1) {
  exigerMagasin(magasin, 'tickRepos');
  const tick = { id: nouvelId('tick-propre'), horodatage: new Date().toISOString() };
  const descriptions = [...DESCRIPTIONS_OPERATIONS, ...DESCRIPTIONS_SOI];
  const avant = await lireCapacite(magasin, parametres);
  const { observation, univers } = await observerEtatPropre(magasin, avant, descriptions);
  const designation = await enregistrerDesignation(magasin, { observation, application: { operation: PREFIXE_SOI + CAUSE_REPOS, liaisons: [{ entree: ENTREE_ETAT, donnee: avant.idEtat }] }, origine: ORIGINE_CONSEQUENCE });
  const resultat = await varier(magasin, { type: CAUSE_REPOS, id: tick.id }, observation.id, tick.horodatage, (c) => Math.min(parametres.plafond, c + parametres.recuperationRepos), designation);
  return { ...resultat, tick, observation, univers, designation };
}
// === FIN_LANGAGE_CAPACITE ===
