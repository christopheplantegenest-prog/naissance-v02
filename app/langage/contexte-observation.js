// === DEBUT_LANGAGE_CONTEXTE_OBSERVATION ===
// v0.63.49 — « CONTEXTE D'UNE OBSERVATION PERSISTÉE » (décision ChatGPT, 06/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « connaissant l'identité d'une observation persistée, quel univers avait-elle examiné, et ce univers, interprété avec le catalogue
//     FOURNI, redonne-t-il bien les possibilités qu'elle a constatées ? »
//
// resoudreContexteObservation(idObservation, lignesObservations, lignesValeurs, lignesExecutions, descriptions) -> { observation, univers }
//   - observation : EXACTEMENT la ligne persistée demandée (même référence, jamais copiée, jamais modifiée).
//   - univers : resoudreIdentitesDonnees(observation.donneesExaminees, ...) — v0.63.48, jamais réimplémentée ici — donc des éléments
//     { donnee, porteur, acces } dans l'ordre de donneesExaminees (ordre canonique, sans signification, simplement préservé), message
//     historique compris, formes selon le catalogue FOURNI.
//   Aucun résultat partiel : si le contexte n'est pas FIDÈLE, TypeError. Rien d'autre n'est rendu.
//
// FIDÉLITÉ (définition exacte). Le contexte rendu est fidèle si et seulement si TOUT ce qui suit est vrai, vérifié uniquement avec ce que
// l'observation a persisté et le catalogue fourni (aucune version de catalogue, aucune empreinte nouvelle) :
//   1. la ligne est bien formée (clés closes, voir plus bas) et son idMessage figure dans donneesExaminees (l'observation d'un message
//      examine ce message : sans cela la ligne n'est pas une observation que observerPossibilites aurait pu écrire) ;
//   2. chaque donnée examinée est résoluble (v0.63.48 : sinon TypeError, collisions d'identité comprises) ;
//   3. operationsExaminees, comparée comme ENSEMBLE de noms, est égale à l'ensemble des noms des descriptions fournies : la liste des
//      opérations examinées est la seule trace persistée du catalogue qui permettait l'observation ; une absence d'atome ne se lit
//      qu'au regard d'elle (opération absente != examinée sans atome). Un catalogue qui a gagné ou perdu une opération n'est pas celui
//      de l'observation : REFUS (aucune version de catalogue n'est créée pour l'excuser) ;
//   4. les possibilités RECALCULÉES (possibilitesDeLiaison sur les données de l'univers reconstruit et les descriptions fournies — la
//      même primitive que celle de observerPossibilites) sont ÉQUIVALENTES aux possibilités PERSISTÉES.
//
// ÉQUIVALENCE des possibilités : égalité d'ENSEMBLES d'atomes { donnee, operation, entree } (trois chaînes), jamais une comparaison JSON.
//   - Ni l'ordre ni la forme sérialisée ne comptent : l'ordre canonique d'un tableau d'atomes (operation, entree, donnee) est sans
//     signification ; seule l'appartenance compte.
//   - Chaque atome persisté doit être exactement { donnee, operation, entree }, chaînes non vides, sans doublon (sinon TypeError : mal formé).
//   - Aucun champ technique n'est comparé : ni id, ni horodatage de l'observation, ni formes (elles ne sont pas persistées).
//   - Un atome en plus OU en moins d'un côté est une différence : REFUS (c'est la dérive du catalogue qui change une forme ou une entrée).
//
// IDENTITÉS : idObservation explicite (chaîne non vide). Observation inconnue ou portée par deux lignes : TypeError. Chaque ligne de
// lignesObservations doit porter un `id` propre (chaîne non vide, jamais un accesseur) ; deux lignes de même id sont une ambiguïté.
// Ne choisit jamais « la dernière », « la première », « la pertinente » ; ne compare jamais deux observations ; aucun ordre entre elles.
//
// PURETÉ : aucun magasin, aucune écriture, aucune horloge, aucune identité générée, aucun état global ; aucune entrée n'est modifiée.
// Aucune donnée historique n'est ajoutée à un snapshot courant : l'univers rendu est un tableau LOCAL de l'appelant.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique) ; ni opération, ni catalogue, ni table.
import { resoudreIdentitesDonnees } from './resoudre-identites.js';
import { possibilitesDeLiaison } from './possibilites-liaison.js';

const NOM = 'resoudreContexteObservation';
const CLES = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'possibilites'];

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

function exigerTableau(valeur, nom) {
  if (!Array.isArray(valeur)) refuser(`${nom} doit être un tableau`);
  return valeur;
}

function exigerChaines(valeurs, nom) {
  const vus = new Set();
  const copie = [];
  for (let rang = 0; rang < valeurs.length; rang += 1) {
    const v = lireRang(valeurs, rang, nom);
    if (typeof v !== 'string' || v.length === 0) refuser(`${nom}[${rang}] doit être une chaîne non vide`);
    if (vus.has(v)) refuser(`${nom} contient un doublon (« ${v} »)`);
    vus.add(v);
    copie.push(v);
  }
  return copie;
}

const cleAtome = (a) => JSON.stringify([a.operation, a.entree, a.donnee]);

export function resoudreContexteObservation(idObservation, lignesObservations, lignesValeurs, lignesExecutions, descriptions) {
  if (typeof idObservation !== 'string' || idObservation.length === 0) refuser("idObservation doit être une chaîne non vide");
  exigerTableau(lignesObservations, 'lignesObservations');
  exigerTableau(lignesValeurs, 'lignesValeurs');
  exigerTableau(lignesExecutions, 'lignesExecutions');
  exigerTableau(descriptions, 'descriptions');

  // 1. Trouver exactement l'observation demandée (identité explicite ; unicité vérifiée sur toutes les lignes).
  const vus = new Set();
  let observation = null;
  for (let rang = 0; rang < lignesObservations.length; rang += 1) {
    const ligne = lireRang(lignesObservations, rang, 'lignesObservations');
    if (ligne === null || typeof ligne !== 'object' || Array.isArray(ligne)) refuser(`lignesObservations[${rang}] doit être un objet`);
    const id = lirePropre(ligne, 'id', `lignesObservations[${rang}]`);
    if (typeof id !== 'string' || id.length === 0) refuser(`lignesObservations[${rang}].id doit être une chaîne non vide`);
    if (vus.has(id)) refuser(`lignesObservations : deux lignes portent la même identité « ${id} » (rang ${rang})`);
    vus.add(id);
    if (id === idObservation) observation = ligne;
  }
  if (observation === null) refuser(`observation inconnue « ${idObservation} »`);

  // 2. Ligne d'observation bien formée (clés closes : exactement celles que enregistrerObservationPossibilites écrit).
  const cles = Reflect.ownKeys(observation);
  if (cles.length !== CLES.length || !CLES.every((cle) => cles.includes(cle))) refuser(`observation « ${idObservation} » mal formée : clés attendues ${CLES.join(', ')}`);
  const nomLigne = `observation « ${idObservation} »`;
  const idMessage = lirePropre(observation, 'idMessage', nomLigne);
  if (typeof idMessage !== 'string' || idMessage.length === 0) refuser(`${nomLigne} : idMessage doit être une chaîne non vide`);
  const horodatage = lirePropre(observation, 'horodatage', nomLigne);
  if (typeof horodatage !== 'string' || horodatage.length === 0) refuser(`${nomLigne} : horodatage doit être une chaîne non vide`);
  const donneesBrutes = lirePropre(observation, 'donneesExaminees', nomLigne);
  const operationsBrutes = lirePropre(observation, 'operationsExaminees', nomLigne);
  const possibilitesBrutes = lirePropre(observation, 'possibilites', nomLigne);
  exigerTableau(donneesBrutes, `${nomLigne}.donneesExaminees`);
  exigerTableau(operationsBrutes, `${nomLigne}.operationsExaminees`);
  exigerTableau(possibilitesBrutes, `${nomLigne}.possibilites`);
  const donneesExaminees = exigerChaines(donneesBrutes, `${nomLigne}.donneesExaminees`);
  const operationsExaminees = exigerChaines(operationsBrutes, `${nomLigne}.operationsExaminees`);
  if (!donneesExaminees.includes(idMessage)) refuser(`${nomLigne} : son message « ${idMessage} » n'est pas parmi les données examinées`);

  // 3. Possibilités persistées : atomes { donnee, operation, entree } exactement, sans doublon.
  const persistees = new Map();
  for (let rang = 0; rang < possibilitesBrutes.length; rang += 1) {
    const atome = lireRang(possibilitesBrutes, rang, `${nomLigne}.possibilites`);
    const nomAtome = `${nomLigne}.possibilites[${rang}]`;
    if (atome === null || typeof atome !== 'object' || Array.isArray(atome)) refuser(`${nomAtome} doit être un objet`);
    const clesAtome = Reflect.ownKeys(atome);
    if (clesAtome.length !== 3 || !['donnee', 'operation', 'entree'].every((cle) => clesAtome.includes(cle))) refuser(`${nomAtome} doit porter exactement donnee, operation, entree`);
    const lu = {};
    for (const champ of ['donnee', 'operation', 'entree']) {
      lu[champ] = lirePropre(atome, champ, nomAtome);
      if (typeof lu[champ] !== 'string' || lu[champ].length === 0) refuser(`${nomAtome}.${champ} doit être une chaîne non vide`);
    }
    const cle = cleAtome(lu);
    if (persistees.has(cle)) refuser(`${nomLigne}.possibilites contient un doublon (rang ${rang})`);
    persistees.set(cle, lu);
  }

  // 4. Reconstruire l'univers examiné : EXACTEMENT donneesExaminees, par v0.63.48 (jamais réimplémentée).
  let univers;
  try {
    univers = resoudreIdentitesDonnees(donneesExaminees, lignesValeurs, lignesExecutions, descriptions);
  } catch (erreur) {
    refuser(`${nomLigne} : donnée examinée non résoluble — ${erreur.message}`);
  }

  // 5. Le catalogue fourni doit être celui de l'observation : mêmes opérations examinées (ensemble de noms).
  const nomsFournis = new Set();
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    const description = lireRang(descriptions, rang, 'descriptions');
    nomsFournis.add(lirePropre(description, 'nom', `descriptions[${rang}]`));
  }
  const nomsExamines = new Set(operationsExaminees);
  const absentesDuCatalogue = operationsExaminees.filter((nom) => !nomsFournis.has(nom));
  const nouvellesDansCatalogue = [...nomsFournis].filter((nom) => !nomsExamines.has(nom));
  if (absentesDuCatalogue.length > 0 || nouvellesDansCatalogue.length > 0) {
    refuser(`${nomLigne} : le catalogue fourni n'est pas celui de l'observation (opérations examinées absentes du catalogue : [${absentesDuCatalogue.join(', ')}] ; opérations du catalogue non examinées : [${nouvellesDansCatalogue.join(', ')}])`);
  }

  // 6. Recalculer les possibilités avec la même primitive que observerPossibilites, puis comparer des ENSEMBLES d'atomes.
  let recalculees;
  try {
    recalculees = possibilitesDeLiaison(univers.map((element) => element.donnee), descriptions);
  } catch (erreur) {
    refuser(`${nomLigne} : recalcul des possibilités impossible — ${erreur.message}`);
  }
  const recalculeesParCle = new Map(recalculees.map((atome) => [cleAtome(atome), atome]));
  const enMoins = [...persistees.keys()].filter((cle) => !recalculeesParCle.has(cle));
  const enPlus = [...recalculeesParCle.keys()].filter((cle) => !persistees.has(cle));
  if (enMoins.length > 0 || enPlus.length > 0) {
    refuser(`${nomLigne} : les possibilités recalculées avec ce catalogue ne sont pas celles de l'observation (persistées non retrouvées : ${enMoins.length} ; nouvelles : ${enPlus.length})`);
  }
  return { observation, univers };
}
// === FIN_LANGAGE_CONTEXTE_OBSERVATION ===
