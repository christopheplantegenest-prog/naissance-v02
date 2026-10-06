// === DEBUT_LANGAGE_FORMES_RENCONTREES ===
// v0.63.64 — « OBSERVER LES FORMES D'ENTRÉE DÉJÀ RENCONTRÉES » (décision ChatGPT, 06/10/2026). VUE PURE, DORMANTE, QUI NE CHOISIT RIEN.
// Elle répond à UNE seule question HISTORIQUE :
//
//   « quelles formes d'entrée ont réellement été portées par les données liées lors des EXÉCUTIONS RÉUSSIES d'une opération ? »
//
// formesEntreesRencontrees(lignesDesignations, lignesObservations, lignesValeurs, lignesExecutions, descriptions) -> { experiences, refusees }
//
// EXPÉRIENCE RÉUSSIE = une ligne d'exécution PERSISTÉE (une ligne de `executionsOperations`, écrite après invocation réussie). Une désignation sans exécution n'est
// PAS une expérience (elle n'apparaît ni dans `experiences` ni dans `refusees`). Ni statut de retour, ni origine, ni âge, ni utilité, ni jugement ne sélectionnent :
// `mecanique` et `exterieure` sont toutes deux des expériences. Ce module ne lit ni n'interprète JAMAIS le champ `resultat` d'une exécution. La reconstruction du contexte historique (résolution d'identités du contexte) exige seulement que le porteur de chaque donnée examinée
// soit lisible : un résultat absent ou une sous-donnée illisible rend le contexte infidèle et l'expérience est REFUSÉE (contexte_infidele), jamais comblée ni devinée.
//
// SORTIE (nouveaux objets, rien n'est partagé avec les entrées ; jamais persistée) :
//   experiences : une entrée PAR EXÉCUTION, jamais fusionnée avec une autre, même opération et mêmes formes (deux histoires distinctes restent deux entrées) :
//     { idExecution, idDesignation, idObservation, operation, origine, entrees: [ ... ] }
//     entrees : une entrée par rôle d'entrée de l'exécution, triée par nom de rôle (unités de code ; ordre sans signification) :
//       liaison ordinaire : { entree, donnee, forme }   — forme = forme DÉCLARÉE de la donnée liée, telle que portée dans l'observation d'origine ;
//       liaison collective : { entree, donnees: [ { donnee, forme }, ... ] } — les données réellement liées, chacune avec SA forme, triées par identité
//         (ordre sans signification). Aucune forme moyenne, aucun ensemble de formes, aucune réduction : la structure collective est préservée.
//     Le COUPLAGE entre rôles est préservé par exécution : (A=chaine, B=chaine) et (A=nombre, B=nombre) sont deux expériences ; la vue ne produit jamais
//     « A ∈ {chaine, nombre}, B ∈ {chaine, nombre} ».
//   refusees : une entrée par exécution persistée dont la forme historique NE PEUT PAS être reconstruite avec la garantie requise :
//     { idExecution, operation, raison, detail }, raison ∈ RAISONS_REFUS. Un refus est EXPLICITE : jamais de forme fabriquée avec le catalogue courant, jamais
//     d'omission silencieuse. Une expérience refusée n'est pas une absence d'expérience et n'interdit rien.
//   Ordres : experiences et refusees sont triées par idExecution (unités de code) ; cet ordre n'est ni chronologique ni une préférence.
//   Aucun compte, aucune fréquence, aucun score, aucune déduplication, aucune sélection, aucun filtre par opération courante ou par observation courante.
//
// RECONSTRUCTION : exécution -> idDesignation -> désignation -> idObservation -> observation. Cette observation est le CONTEXTE HISTORIQUE de l'expérience :
// son univers est reconstruit par resoudreContexteObservation (v0.63.49 à .63), JAMAIS réimplémentée ici. La forme d'une donnée liée est celle de l'élément de cet
// univers qui porte son identité : message -> la déclaration descriptive de la source message (mécanisme de source existant, aucun « si message alors chaîne » ici) ; production ou
// sous-donnée -> `sortie` décrite par le sous-catalogue historique ; entrées(P) -> contrat de catégorie. Aucune inférence depuis typeof ni depuis la valeur.
//
// GARANTIE HISTORIQUE (point critique). La forme d'une production est une DÉCLARATION du catalogue : relue avec un catalogue courant qui aurait dérivé, elle
// serait fausse. La vue n'accepte donc une expérience que si les preuves DÉJÀ PERSISTÉES par l'observation d'origine permettent de garantir le contrat nécessaire.
// Aucune empreinte par exécution, aucune migration, aucune preuve nouvelle. Garantie requise selon la nature des données LIÉES (le maximum sur l'exécution) :
//   - donnée de message : aucun contrat de catalogue n'intervient. Acceptée pour TOUTE génération (6, 7, 8, 9 clés). La déclaration de la source message n'est couverte par
//     AUCUNE preuve persistée (limite documentée plus bas) ;
//   - production ou sous-donnée : exige la preuve des contrats d'opérations (empreintesOperationsExaminees : 7 clés et plus), VÉRIFIÉE par la reconstruction
//     (un contrat dont l'empreinte a changé refuse l'expérience) ;
//   - entrées(P) : exige en plus la preuve de catégorie (empreintesCategoriesDonnees : 8 clés et plus), vérifiée par la reconstruction.
// GÉNÉRATIONS : 6 clés -> formes de messages seulement ; 7 clés -> + productions et sous-données (contrats d'opérations prouvés) ; 8 clés -> + entrées(P)
// (contrat de catégorie prouvé) ; 9 clés -> comme 8, la preuve relationnelle (vérifiée aussi par la reconstruction) n'ajoute aucune forme mais conditionne le
// contexte : une dérive relationnelle refuse donc aussi l'expérience (contexte infidèle). Aucune garantie n'est inventée pour une génération qui ne la porte pas.
//
// REFUS (raisons) :
//   designation_absente        : la désignation citée par l'exécution n'est pas dans lignesDesignations ;
//   incoherence_designation    : opération ou liaisons de l'exécution différentes de celles de sa désignation (aucune des deux n'est préférée) ;
//   observation_absente        : l'observation citée par la désignation n'est pas dans lignesObservations ;
//   garantie_insuffisante      : génération trop ancienne pour la nature des données liées (voir GÉNÉRATIONS) ;
//   contexte_infidele          : resoudreContexteObservation refuse (contrat dérivé, donnée non résoluble, possibilités différentes, catalogue fourni invalide…) ;
//   liaison_hors_observation   : une donnée liée n'est pas un atome { donnee, operation, entree } de l'observation, ou n'a pas d'élément dans son univers.
// Une ligne MAL FORMÉE (tableau absent, ligne non objet, champ obligatoire invalide, identité dupliquée dans une table) est un TypeError : l'entrée est invalide,
// ce n'est pas un fait historique.
//
// LIMITES DOCUMENTÉES. (1) La déclaration descriptive de la source « message » n'est couverte par aucune preuve persistée, quelle que soit la génération :
// une dérive de cette constante qui ne changerait aucun atome ne serait pas vue (ceux qui en dépendent sont comparés par la reconstruction du contexte). (2) La forme
// est celle DÉCLARÉE de la donnée, jamais mesurée sur sa valeur. (3) « Réussie » signifie seulement qu'une exécution a été persistée : aucune utilité n'est mesurée.
// (4) Un catalogue fourni invalide se manifeste par des refus contexte_infidele (jamais par une forme). (5) Aucun contrôle de cohérence ne compare une exécution
// à son résultat.
//
// PURETÉ : aucun magasin, aucune écriture, aucune horloge, aucune identité générée, aucun état global ; aucune entrée n'est modifiée.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique) ; il n'est lu ni par applicationsSollicitables, ni par le déclencheur
// mécanique, ni par le pont, ni par l'esprit. Il ne choisit rien et ne modifie aucune classification.
import { resoudreContexteObservation } from './contexte-observation.js';
import { estIdentiteEntrees } from './entrees-donnee.js';

const NOM = 'formesEntreesRencontrees';
const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const CLE_OPERATIONS = 'empreintesOperationsExaminees';
const CLE_CATEGORIES = 'empreintesCategoriesDonnees';
const copierForme = (forme) => JSON.parse(JSON.stringify(forme));

export const RAISONS_REFUS = Object.freeze({
  DESIGNATION_ABSENTE: 'designation_absente',
  INCOHERENCE_DESIGNATION: 'incoherence_designation',
  OBSERVATION_ABSENTE: 'observation_absente',
  GARANTIE_INSUFFISANTE: 'garantie_insuffisante',
  CONTEXTE_INFIDELE: 'contexte_infidele',
  LIAISON_HORS_OBSERVATION: 'liaison_hors_observation',
});

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${nom}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${nom}[${rang}] est un accesseur : une donnée est attendue`);
  return place.value;
}

function lirePropre(objet, champ, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

function exigerTableau(valeur, nom) {
  if (!Array.isArray(valeur)) refuser(`${nom} doit être un tableau`);
  return valeur;
}

function exigerLigne(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) refuser(`${nom} doit être un objet`);
  return valeur;
}

// Lit les lignes d'une table : chaque ligne un objet portant un `id` propre (chaîne non vide), identités uniques. Rend [{ id, ligne }].
function lireTable(lignes, nom) {
  exigerTableau(lignes, nom);
  const vus = new Set();
  const lus = [];
  for (let rang = 0; rang < lignes.length; rang += 1) {
    const ligne = exigerLigne(lireRang(lignes, rang, nom), `${nom}[${rang}]`);
    const id = chaineNonVide(lirePropre(ligne, 'id', `${nom}[${rang}]`), `${nom}[${rang}].id`);
    if (vus.has(id)) refuser(`${nom} : deux lignes portent la même identité « ${id} » (rang ${rang})`);
    vus.add(id);
    lus.push({ id, ligne });
  }
  return lus;
}

// Liaisons d'une exécution ou d'une désignation, en forme CANONIQUE : tri par rôle (puis par identité pour un collectif). L'ordre reçu n'a aucun sens ; un rôle
// répété, une identité répétée, une liaison qui n'est pas exactement { entree, donnee } ou { entree, donnees } est un TypeError.
function lireLiaisons(valeur, nom) {
  exigerTableau(valeur, nom);
  if (valeur.length === 0) refuser(`${nom} doit contenir au moins une liaison`);
  const vus = new Set();
  const liaisons = [];
  for (let rang = 0; rang < valeur.length; rang += 1) {
    const brute = exigerLigne(lireRang(valeur, rang, nom), `${nom}[${rang}]`);
    const nomLiaison = `${nom}[${rang}]`;
    const cles = Reflect.ownKeys(brute);
    const collective = cles.includes('donnees');
    const attendues = collective ? ['entree', 'donnees'] : ['entree', 'donnee'];
    if (cles.length !== 2 || !attendues.every((cle) => cles.includes(cle))) refuser(`${nomLiaison} doit porter exactement ${attendues.join(' et ')}`);
    const entree = chaineNonVide(lirePropre(brute, 'entree', nomLiaison), `${nomLiaison}.entree`);
    if (vus.has(entree)) refuser(`${nom} : l'entrée « ${entree} » est liée deux fois`);
    vus.add(entree);
    if (collective) {
      const ids = exigerTableau(lirePropre(brute, 'donnees', nomLiaison), `${nomLiaison}.donnees`);
      if (ids.length === 0) refuser(`${nomLiaison}.donnees doit contenir au moins une identité`);
      const donnees = ids.map((_, k) => chaineNonVide(lireRang(ids, k, `${nomLiaison}.donnees`), `${nomLiaison}.donnees[${k}]`)).sort(comparer);
      if (donnees.some((id, k) => k > 0 && id === donnees[k - 1])) refuser(`${nomLiaison}.donnees contient un doublon`);
      liaisons.push({ entree, donnees });
    } else {
      liaisons.push({ entree, donnee: chaineNonVide(lirePropre(brute, 'donnee', nomLiaison), `${nomLiaison}.donnee`) });
    }
  }
  return liaisons.sort((a, b) => comparer(a.entree, b.entree));
}

const identitesLiees = (liaisons) => liaisons.flatMap((l) => (l.donnees === undefined ? [l.donnee] : l.donnees));

export function formesEntreesRencontrees(lignesDesignations, lignesObservations, lignesValeurs, lignesExecutions, descriptions) {
  const designees = new Map(lireTable(lignesDesignations, 'lignesDesignations').map(({ id, ligne }) => [id, ligne]));
  const observations = new Map(lireTable(lignesObservations, 'lignesObservations').map(({ id, ligne }) => [id, ligne]));
  const messages = new Set(lireTable(lignesValeurs, 'lignesValeurs').map(({ id }) => id));
  exigerTableau(descriptions, 'descriptions');
  const executions = lireTable(lignesExecutions, 'lignesExecutions').sort((a, b) => comparer(a.id, b.id));

  const contextes = new Map(); // idObservation -> { univers } | { erreur } (calcul local, jamais persistant)
  const contexteDe = (idObservation) => {
    if (!contextes.has(idObservation)) {
      try {
        contextes.set(idObservation, { univers: resoudreContexteObservation(idObservation, lignesObservations, lignesValeurs, lignesExecutions, descriptions).univers });
      } catch (erreur) {
        if (!(erreur instanceof TypeError)) throw erreur;
        contextes.set(idObservation, { erreur: erreur.message });
      }
    }
    return contextes.get(idObservation);
  };

  const experiences = [];
  const refusees = [];
  for (const { id, ligne } of executions) {
    const nomExecution = `exécution « ${id} »`;
    const operation = chaineNonVide(lirePropre(ligne, 'operation', nomExecution), `${nomExecution}.operation`);
    const idDesignation = chaineNonVide(lirePropre(ligne, 'idDesignation', nomExecution), `${nomExecution}.idDesignation`);
    const liaisons = lireLiaisons(lirePropre(ligne, 'liaisons', nomExecution), `${nomExecution}.liaisons`);
    const refus = (raison, detail) => refusees.push({ idExecution: id, operation, raison, detail });

    const designation = designees.get(idDesignation);
    if (designation === undefined) { refus(RAISONS_REFUS.DESIGNATION_ABSENTE, `la désignation « ${idDesignation} » n'est pas persistée`); continue; }
    const nomDesignation = `désignation « ${idDesignation} »`;
    const operationDesignee = chaineNonVide(lirePropre(designation, 'operation', nomDesignation), `${nomDesignation}.operation`);
    const idObservation = chaineNonVide(lirePropre(designation, 'idObservation', nomDesignation), `${nomDesignation}.idObservation`);
    const origine = chaineNonVide(lirePropre(designation, 'origine', nomDesignation), `${nomDesignation}.origine`);
    const liaisonsDesignees = lireLiaisons(lirePropre(designation, 'liaisons', nomDesignation), `${nomDesignation}.liaisons`);
    if (operationDesignee !== operation || JSON.stringify(liaisonsDesignees) !== JSON.stringify(liaisons)) {
      refus(RAISONS_REFUS.INCOHERENCE_DESIGNATION, `l'exécution et sa désignation « ${idDesignation} » ne portent pas la même opération et les mêmes liaisons`);
      continue;
    }
    const observation = observations.get(idObservation);
    if (observation === undefined) { refus(RAISONS_REFUS.OBSERVATION_ABSENTE, `l'observation « ${idObservation} » n'est pas persistée`); continue; }

    // Garantie requise selon la nature des données liées (le maximum sur l'exécution).
    const liees = identitesLiees(liaisons);
    const cles = Reflect.ownKeys(observation);
    if (liees.some((identite) => !messages.has(identite) && !cles.includes(CLE_OPERATIONS))) {
      refus(RAISONS_REFUS.GARANTIE_INSUFFISANTE, `l'observation « ${idObservation} » ne porte pas la preuve des contrats d'opérations : la forme d'une production ne peut pas être garantie`);
      continue;
    }
    if (liees.some((identite) => estIdentiteEntrees(identite)) && !cles.includes(CLE_CATEGORIES)) {
      refus(RAISONS_REFUS.GARANTIE_INSUFFISANTE, `l'observation « ${idObservation} » ne porte pas la preuve du contrat de catégorie des entrées de production`);
      continue;
    }

    const contexte = contexteDe(idObservation);
    if (contexte.erreur !== undefined) { refus(RAISONS_REFUS.CONTEXTE_INFIDELE, contexte.erreur); continue; }
    const atomes = new Set(lirePropre(observation, 'possibilites', `observation « ${idObservation} »`).map((a) => JSON.stringify([a.operation, a.entree, a.donnee])));
    const formes = new Map(contexte.univers.map((element) => [element.donnee.identite, element.donnee.forme]));
    const horsObservation = liaisons.flatMap((l) => (l.donnees === undefined ? [l.donnee] : l.donnees).map((d) => [l.entree, d]))
      .find(([entree, donnee]) => !atomes.has(JSON.stringify([operation, entree, donnee])) || !formes.has(donnee));
    if (horsObservation !== undefined) {
      refus(RAISONS_REFUS.LIAISON_HORS_OBSERVATION, `la donnée « ${horsObservation[1]} » liée à l'entrée « ${horsObservation[0]} » n'appartient pas aux possibilités ni à l'univers de l'observation « ${idObservation} »`);
      continue;
    }
    experiences.push({
      idExecution: id,
      idDesignation,
      idObservation,
      operation,
      origine,
      entrees: liaisons.map((l) => (l.donnees === undefined
        ? { entree: l.entree, donnee: l.donnee, forme: copierForme(formes.get(l.donnee)) }
        : { entree: l.entree, donnees: l.donnees.map((donnee) => ({ donnee, forme: copierForme(formes.get(donnee)) })) })),
    });
  }
  return { experiences, refusees };
}
// === FIN_LANGAGE_FORMES_RENCONTREES ===
