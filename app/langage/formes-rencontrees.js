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
//   - donnée de message (v0.63.65, remplace « acceptée pour toute génération ») : la forme d'un message est la DÉCLARATION de la source message, qui peut dériver
//     SANS changer aucun atome. Une expérience liée à un message n'est acceptée que dans l'un de ces deux cas, jamais autrement :
//       A. la ligne porte EXPLICITEMENT la preuve de la catégorie message (empreintesCategoriesDonnees contient l'entrée « message »), vérifiée par la reconstruction (contexte
//          infidèle sinon) -> garantie FORTE, directe ;
//       B. sans cette preuve : la forme de chaîne est PROUVÉE par les preuves que la ligne porte déjà : (i) la preuve des contrats d'opérations est présente (donc vérifiée par la
//          reconstruction), (ii) un atome { donnee: message, operation, entree } de la ligne vise une entrée dont la forme attendue, dans le contrat d'opération ainsi vérifié, est
//          un scalaire à GENRE déclaré (relation de garantie, règle R2 : seule une forme scalaire de CE genre la garantit, et un message n'a aucun fait de racine) ; les atomes
//          étant égaux aux atomes recalculés, la forme d'origine du message est exactement cette forme scalaire, et la forme rendue la même. Aucun nom d'opération n'est connu ici ;
//       C. sinon (ligne sans preuve des contrats d'opérations, ou aucune entrée à genre ne verrouille la forme) : REFUS garantie_insuffisante. Une dérive conjointe (entrée d'opération
//          ET source message) resterait invisible : le refus est préféré à une étiquette faible. Aucune forme n'est reconstruite par fiction.
//     Le choix entre A, B et C ne dépend que des preuves contenues dans la ligne, jamais d'un numéro de version ;
//   - production ou sous-donnée : exige la preuve des contrats d'opérations (empreintesOperationsExaminees : 7 clés et plus), VÉRIFIÉE par la reconstruction
//     (un contrat dont l'empreinte a changé refuse l'expérience) ;
//   - entrées(P) : exige en plus la preuve de catégorie (empreintesCategoriesDonnees : 8 clés et plus), vérifiée par la reconstruction.
// GÉNÉRATIONS (v0.63.65) : 6 clés -> AUCUNE forme (message non prouvé : refus C) ; 7 clés -> messages par B (si une entrée à genre verrouille la forme), productions et
// sous-données (contrats d'opérations prouvés) ; 8/9 clés ANCIENNES (preuve de catégorie [entrées(P)] seule) -> + entrées(P) ; message par B comme à 7 clés, JAMAIS par A ;
// ligne NOUVELLE (preuves [entrées(P), message]) -> message par A. La preuve relationnelle (9 clés, vérifiée par la reconstruction) n'ajoute aucune forme mais conditionne
// le contexte. Aucune garantie n'est inventée pour une génération qui ne la porte pas.
//
// REFUS (raisons) :
//   designation_absente        : la désignation citée par l'exécution n'est pas dans lignesDesignations, OU (v0.63.65) l'exécution n'en cite aucune (voir EXÉCUTIONS ANCIENNES) ;
//   incoherence_designation    : opération ou liaisons de l'exécution différentes de celles de sa désignation (aucune des deux n'est préférée) ;
//   observation_absente        : l'observation citée par la désignation n'est pas dans lignesObservations ;
//   garantie_insuffisante      : preuves de la ligne trop faibles pour la nature des données liées (voir GÉNÉRATIONS ; message : cas C) ;
//   contexte_infidele          : resoudreContexteObservation refuse (contrat dérivé, donnée non résoluble, possibilités différentes, catalogue fourni invalide…) ;
//   liaison_hors_observation   : une donnée liée n'est pas un atome { donnee, operation, entree } de l'observation, ou n'a pas d'élément dans son univers.
// EXÉCUTIONS ANCIENNES (v0.63.65). Les lignes écrites avant v0.63.23 n'ont pas idDesignation (ancien format que le magasin documente et ne migre pas) : leur forme EXACTE est
// { id, horodatage, operation, liaisons, resultat }. Une ligne SANS idDesignation dont les clés sont EXACTEMENT celles-là (et dont operation, liaisons, horodatage sont bien formés) est
// REFUSÉE INDIVIDUELLEMENT (designation_absente, aucune provenance connue) : les autres lignes restent rendues. Toute autre ligne sans idDesignation (clé en plus ou en moins,
// operation ou liaisons invalides) reste un TypeError : ce n'est pas l'ancien format. Un idDesignation PRÉSENT mais invalide (vide, non chaîne, accesseur) reste un TypeError.
// LIMITE : la structure ne peut pas distinguer une ancienne ligne d'une ligne moderne dont le seul champ idDesignation aurait été perdu ; dans les deux cas la ligne n'est JAMAIS une
// expérience, seulement une refusée, et la raison le dit sans prétendre savoir laquelle.
// Une ligne MAL FORMÉE (tableau absent, ligne non objet, champ obligatoire invalide, identité dupliquée dans une table) est un TypeError : l'entrée est invalide,
// ce n'est pas un fait historique.
//
// LIMITES DOCUMENTÉES. (1) (v0.63.65) La preuve du contrat message ne couvre que les lignes qui la portent ; pour les autres, seule la règle B (forme verrouillée par une entrée à genre
// d'un contrat d'opération vérifié) accepte, sinon C refuse : jamais d'étiquette faible. L'identité d'un message (sa génération, son préfixe) n'est pas dans le contrat. (2) La forme
// est celle DÉCLARÉE de la donnée, jamais mesurée sur sa valeur. (3) « Réussie » signifie seulement qu'une exécution a été persistée : aucune utilité n'est mesurée.
// (4) Un catalogue fourni invalide se manifeste par des refus contexte_infidele (jamais par une forme). (5) Aucun contrôle de cohérence ne compare une exécution
// à son résultat.
//
// PURETÉ : aucun magasin, aucune écriture, aucune horloge, aucune identité générée, aucun état global ; aucune entrée n'est modifiée.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique) ; il n'est lu ni par applicationsSollicitables, ni par le déclencheur
// mécanique, ni par le pont, ni par l'esprit. Il ne choisit rien et ne modifie aucune classification.
import { resoudreContexteObservation } from './contexte-observation.js';
import { estIdentiteEntrees } from './entrees-donnee.js';
import { CATEGORIE_MESSAGE } from './empreinte-categorie-message.js';

const NOM = 'formesEntreesRencontrees';
const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const CLE_OPERATIONS = 'empreintesOperationsExaminees';
const CLE_CATEGORIES = 'empreintesCategoriesDonnees';
const CLES_ANCIEN_FORMAT = ['id', 'horodatage', 'operation', 'liaisons', 'resultat'];
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

// v0.63.65 — garantie de la FORME d'un message lié (voir GARANTIE HISTORIQUE, A/B/C). Appelée APRÈS une reconstruction réussie : la preuve présente (contrats d'opérations,
// catégories) est donc DÉJÀ vérifiée. Rend null si la garantie est suffisante, sinon le détail du refus.
function categoriesLues(observation) {
  const place = Object.getOwnPropertyDescriptor(observation, CLE_CATEGORIES);
  if (place === undefined || !('value' in place) || !Array.isArray(place.value)) return [];
  return place.value.map((_, rang) => {
    const entree = Object.getOwnPropertyDescriptor(place.value, rang);
    if (entree === undefined || !('value' in entree) || entree.value === null || typeof entree.value !== 'object') return undefined;
    const categorie = Object.getOwnPropertyDescriptor(entree.value, 'categorie');
    return categorie !== undefined && 'value' in categorie ? categorie.value : undefined;
  });
}

function detailGarantieMessage(observation, idObservation, idMessage, descriptions) {
  if (categoriesLues(observation).includes(CATEGORIE_MESSAGE)) return null; // A
  const cles = Reflect.ownKeys(observation);
  if (!cles.includes(CLE_OPERATIONS)) return `l'observation « ${idObservation} » ne porte ni la preuve de la catégorie message ni la preuve des contrats d'opérations : la forme du message « ${idMessage} » a pu dériver sans trace`;
  const examinees = new Set(lirePropre(observation, 'operationsExaminees', `observation « ${idObservation} »`));
  for (const atome of lirePropre(observation, 'possibilites', `observation « ${idObservation} »`)) {
    if (atome.donnee !== idMessage || !examinees.has(atome.operation)) continue;
    const description = descriptions.find((candidate) => candidate.nom === atome.operation);
    if (description === undefined) continue;
    const entrees = lirePropre(description, 'entrees', `description « ${atome.operation} »`);
    if (!Object.hasOwn(entrees, atome.entree)) continue;
    const attendue = lirePropre(entrees, atome.entree, `description « ${atome.operation} ».entrees`); // B : entrée du contrat d'opération (vérifié)
    if (attendue.forme === 'scalaire' && attendue.genre !== undefined) return null;
  }
  return `l'observation « ${idObservation} » ne porte pas la preuve de la catégorie message et aucune entrée à genre déclaré d'un contrat d'opération vérifié ne verrouille la forme du message « ${idMessage} »`;
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
    const refus = (raison, detail) => refusees.push({ idExecution: id, operation, raison, detail });
    if (Object.getOwnPropertyDescriptor(ligne, 'idDesignation') === undefined) {
      // v0.63.65 : ancien format (voir EXÉCUTIONS ANCIENNES) : refus INDIVIDUEL si, et seulement si, la ligne a exactement les clés de l'ancien format et des champs bien formés.
      const clesLigne = Reflect.ownKeys(ligne);
      if (clesLigne.length !== CLES_ANCIEN_FORMAT.length || !CLES_ANCIEN_FORMAT.every((cle) => clesLigne.includes(cle))) {
        refuser(`${nomExecution} n'a pas de champ « idDesignation » propre et n'a pas les clés de l'ancien format (${CLES_ANCIEN_FORMAT.join(', ')})`);
      }
      chaineNonVide(lirePropre(ligne, 'horodatage', nomExecution), `${nomExecution}.horodatage`);
      lireLiaisons(lirePropre(ligne, 'liaisons', nomExecution), `${nomExecution}.liaisons`);
      refus(RAISONS_REFUS.DESIGNATION_ABSENTE, `l'exécution ne cite aucune désignation (pas d'idDesignation) : provenance inconnue, ligne non reconstructible`);
      continue;
    }
    const idDesignation = chaineNonVide(lirePropre(ligne, 'idDesignation', nomExecution), `${nomExecution}.idDesignation`);
    const liaisons = lireLiaisons(lirePropre(ligne, 'liaisons', nomExecution), `${nomExecution}.liaisons`);

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
    for (const identite of liees) {
      if (!messages.has(identite)) continue;
      const detail = detailGarantieMessage(observation, idObservation, identite, descriptions);
      if (detail !== null) { refus(RAISONS_REFUS.GARANTIE_INSUFFISANTE, detail); break; }
    }
    if (refusees.length > 0 && refusees[refusees.length - 1].idExecution === id) continue;
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
