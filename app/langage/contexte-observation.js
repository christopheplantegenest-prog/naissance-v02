// === DEBUT_LANGAGE_CONTEXTE_OBSERVATION ===
// v0.63.49 — « CONTEXTE D'UNE OBSERVATION PERSISTÉE » (décision ChatGPT, 06/10/2026). PRIMITIVE PURE, DORMANTE.
// v0.63.50 — « SOUS-CATALOGUE HISTORIQUE » (décision ChatGPT, 06/10/2026) : une capacité AJOUTÉE depuis l'observation ne la rend plus illisible.
// v0.63.53 — « VÉRIFIER LA PREUVE DES CONTRATS HISTORIQUES » (décision ChatGPT, 06/10/2026) : une observation de NOUVELLE génération (qui porte
// empreintesOperationsExaminees) n'est rendue que si le contrat mécanique de chaque opération examinée est resté IDENTIQUE.
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
// DEUX GARANTIES (v0.63.53) : ANCIENNE ligne (sans empreintesOperationsExaminees) = garantie FAIBLE, celle de v0.63.50 inchangée (points 1 à 4 ci-dessous) ;
// NOUVELLE ligne (avec) = les mêmes contrôles PLUS le point 5 : garantie FORTE. Ordre : preuve persistée validée STRICTEMENT (avant tout) -> catalogue
// fourni validé et sous-catalogue extrait -> empreintes du sous-catalogue RECALCULÉES (empreintesDesContrats, v0.63.51) et comparées -> univers -> atomes.
//
// FIDÉLITÉ (définition exacte). Le contexte rendu est fidèle si et seulement si TOUT ce qui suit est vrai, vérifié uniquement avec ce que
// l'observation a persisté et le catalogue fourni (aucune version de catalogue, aucune empreinte nouvelle) :
//   1. la ligne est bien formée (clés closes, voir plus bas) et son idMessage figure dans donneesExaminees (l'observation d'un message
//      examine ce message : sans cela la ligne n'est pas une observation que observerPossibilites aurait pu écrire) ;
//   2. chaque donnée examinée est résoluble (v0.63.48 : sinon TypeError, collisions d'identité comprises) ;
//   3. chaque opération de operationsExaminees existe encore dans le catalogue fourni (v0.63.50 : INCLUSION, plus égalité). Les opérations
//      du catalogue fourni qui n'y figurent pas (capacités apparues APRÈS l'observation) sont IGNORÉES : elles n'ont jamais fait partie de ce
//      contexte et n'y apparaissent pas rétroactivement. Une opération examinée qui a disparu ou changé de nom : REFUS. Aucune version de
//      catalogue, aucune empreinte : seules les informations déjà persistées servent ;
//   4. les possibilités RECALCULÉES (possibilitesDeLiaison sur les données de l'univers reconstruit et le SOUS-CATALOGUE HISTORIQUE — la
//      même primitive que celle de observerPossibilites) sont ÉQUIVALENTES aux possibilités PERSISTÉES ;
//   5. (NOUVELLE génération seulement) la preuve persistée est bien formée et ÉGALE, couple à couple (operation + empreinte), aux empreintes recalculées
//      du sous-catalogue historique. Une seule différence : TypeError. Les opérations ajoutées depuis n'y figurent pas et sont ignorées.
//
// SOUS-CATALOGUE HISTORIQUE (v0.63.50) : les descriptions du catalogue fourni dont le nom figure dans operationsExaminees, EXACTEMENT celles-là,
// telles quelles (mêmes objets, jamais réinterprétées ni copiées), dans l'ordre où le catalogue fourni les présente (cet ordre n'a aucune
// signification). Le catalogue fourni et operationsExaminees ne sont jamais modifiés. Le catalogue fourni est d'abord validé EN ENTIER (descripteurs
// valides, noms uniques) : une opération supplémentaire invalide ou en double est un TypeError, jamais ignorée en silence. Le sous-catalogue sert
// À LA FOIS à reconstruire l'univers (formes des productions par resoudreIdentitesDonnees) et à recalculer les possibilités. Un producteur d'une
// donnée examinée figure toujours dans operationsExaminees (une donnée n'est examinée que si son opération est décrite) : si une ligne dit autre
// chose, la forme de cette donnée est indéterminée et le contexte est refusé, jamais forcé.
//
// LIMITE DOCUMENTÉE (ANCIENNE génération seulement, volontaire, v0.63.53) : une modification de la SORTIE d'une opération, ou une entrée insatisfiable
// ajoutée, qui ne change AUCUN atome ne se voit pas avec ce qui est persisté par une ancienne ligne (les atomes ne déterminent pas les formes) ; le
// contexte est alors rendu avec le catalogue fourni. Les lignes de NOUVELLE génération, elles, sont refusées (point 5). Aucune empreinte rétroactive.
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
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique) ; ni opération, ni catalogue, ni table. La vérification ne
// crée, n'écrit et ne modifie aucune observation.
import { resoudreIdentitesDonnees } from './resoudre-identites.js';
import { possibilitesDeLiaison } from './possibilites-liaison.js';
import { empreintesDesContrats } from './empreinte-contrats.js';

const NOM = 'resoudreContexteObservation';
const CLES = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'possibilites'];
// DEUX GÉNÉRATIONS de lignes (v0.63.52 les écrit, v0.63.53 les distingue À LA LECTURE) :
//   ANCIENNE : les six clés ci-dessus, SANS la propriété empreintesOperationsExaminees -> garantie FAIBLE (v0.63.50), lue exactement comme avant ;
//   NOUVELLE : les six clés PLUS empreintesOperationsExaminees -> mêmes contrôles PLUS vérification de la preuve des contrats (garantie FORTE).
// Le critère est l'EXISTENCE de la propriété : présente et invalide = REFUS (aucun repli vers le régime ancien) ; absente = ancienne génération
// (aucune empreinte n'est jamais inventée, ni calculée pour une ligne qui n'en porte pas).
const CLE_EMPREINTES = 'empreintesOperationsExaminees';
const HEX64 = /^[0-9a-f]{64}$/;
const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

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

// Preuve persistée : [{ operation, empreinte }] — tableau dense, une couple par opération examinée, couple EXACTEMENT { operation, empreinte },
// operation chaîne non vide, empreinte hex64 minuscule, tri STRICT par operation (donc sans doublon), noms exactement ceux de operationsExaminees.
// Rend une copie locale de couples { operation, empreinte } ; rien n'est modifié.
function lirePreuve(valeur, operationsExaminees, nom) {
  exigerTableau(valeur, nom);
  if (valeur.length !== operationsExaminees.length) refuser(`${nom} doit contenir exactement une couple par opération examinée (${valeur.length} pour ${operationsExaminees.length})`);
  const attendues = new Set(operationsExaminees);
  const couples = [];
  for (let rang = 0; rang < valeur.length; rang += 1) {
    const couple = lireRang(valeur, rang, nom);
    const nomCouple = `${nom}[${rang}]`;
    if (couple === null || typeof couple !== 'object' || Array.isArray(couple)) refuser(`${nomCouple} doit être un objet`);
    const clesCouple = Reflect.ownKeys(couple);
    if (clesCouple.length !== 2 || !clesCouple.includes('operation') || !clesCouple.includes('empreinte')) refuser(`${nomCouple} doit porter exactement operation et empreinte`);
    const operation = lirePropre(couple, 'operation', nomCouple);
    const empreinte = lirePropre(couple, 'empreinte', nomCouple);
    if (typeof operation !== 'string' || operation.length === 0) refuser(`${nomCouple}.operation doit être une chaîne non vide`);
    if (typeof empreinte !== 'string' || !HEX64.test(empreinte)) refuser(`${nomCouple}.empreinte doit être 64 caractères hexadécimaux minuscules`);
    if (rang > 0 && !(comparerCodes(couples[rang - 1].operation, operation) < 0)) refuser(`${nom} doit être strictement triée par operation (sans doublon)`);
    if (!attendues.has(operation)) refuser(`${nomCouple} : l'opération « ${operation} » n'est pas dans operationsExaminees`);
    couples.push({ operation, empreinte });
  }
  // Longueur égale + noms distincts + tous dans l'ensemble attendu (sans doublon dans operationsExaminees) : les ensembles sont égaux.
  return couples;
}

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
  const avecEmpreintes = cles.includes(CLE_EMPREINTES);
  if (cles.length !== CLES.length + (avecEmpreintes ? 1 : 0) || !CLES.every((cle) => cles.includes(cle))) refuser(`observation « ${idObservation} » mal formée : clés attendues ${CLES.join(', ')}`);
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

  // 2b. NOUVELLE génération : la preuve persistée est validée STRICTEMENT avant toute reconstruction (une observation dont la preuve est invalide
  // n'est jamais déclarée fidèle). Lecture sûre (ni creux ni accesseur). Aucune empreinte n'est recalculée ici, seulement lue et contrôlée.
  const preuve = avecEmpreintes ? lirePreuve(lirePropre(observation, CLE_EMPREINTES, nomLigne), operationsExaminees, `${nomLigne}.${CLE_EMPREINTES}`) : null;

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

  // 4. Le catalogue fourni est validé EN ENTIER (descripteurs valides, noms uniques), puis le SOUS-CATALOGUE HISTORIQUE en est extrait.
  try {
    possibilitesDeLiaison([], descriptions);
  } catch (erreur) {
    refuser(`catalogue fourni invalide — ${erreur.message}`);
  }
  const nomsExamines = new Set(operationsExaminees);
  const nomsFournis = new Set();
  const sousCatalogue = [];
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    const description = lireRang(descriptions, rang, 'descriptions');
    const nom = lirePropre(description, 'nom', `descriptions[${rang}]`);
    nomsFournis.add(nom);
    if (nomsExamines.has(nom)) sousCatalogue.push(description);
  }
  const absentesDuCatalogue = operationsExaminees.filter((nom) => !nomsFournis.has(nom));
  if (absentesDuCatalogue.length > 0) {
    refuser(`${nomLigne} : le catalogue fourni n'est pas celui de l'observation (opérations examinées absentes du catalogue : [${absentesDuCatalogue.join(', ')}])`);
  }

  // 4b. NOUVELLE génération : le contrat mécanique de CHAQUE opération historiquement examinée doit être resté identique. Les empreintes sont
  // RECALCULÉES par la primitive v0.63.51 sur le SOUS-CATALOGUE HISTORIQUE (jamais sur le catalogue fourni entier : une opération ajoutée depuis
  // est ignorée, son absence de la preuve est correcte) et comparées couple à couple (operation + empreinte, égalité exacte). Faite AVANT la
  // reconstruction et la comparaison des atomes : un contrat dérivé est refusé ici, pour sa preuve, même quand les atomes seraient identiques.
  if (preuve !== null) {
    let recalculees;
    try {
      recalculees = empreintesDesContrats(sousCatalogue);
    } catch (erreur) {
      refuser(`${nomLigne} : empreintes du sous-catalogue historique incalculables — ${erreur.message}`);
    }
    const differentes = [];
    for (let rang = 0; rang < preuve.length; rang += 1) {
      if (recalculees[rang].operation !== preuve[rang].operation) refuser(`${nomLigne} : le sous-catalogue historique ne correspond pas à la preuve persistée`);
      if (recalculees[rang].empreinte !== preuve[rang].empreinte) differentes.push(preuve[rang].operation);
    }
    if (differentes.length > 0) {
      refuser(`${nomLigne} : le contrat mécanique d'au moins une opération examinée a changé depuis l'observation (empreinte différente : [${differentes.join(', ')}])`);
    }
  }

  // 5. Reconstruire l'univers examiné : EXACTEMENT donneesExaminees, par v0.63.48 (jamais réimplémentée), avec le sous-catalogue historique.
  let univers;
  try {
    univers = resoudreIdentitesDonnees(donneesExaminees, lignesValeurs, lignesExecutions, sousCatalogue);
  } catch (erreur) {
    refuser(`${nomLigne} : donnée examinée non résoluble — ${erreur.message}`);
  }

  // 6. Recalculer les possibilités avec la même primitive que observerPossibilites, puis comparer des ENSEMBLES d'atomes.
  let recalculees;
  try {
    recalculees = possibilitesDeLiaison(univers.map((element) => element.donnee), sousCatalogue);
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
