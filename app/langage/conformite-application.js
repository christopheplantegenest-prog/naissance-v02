// === DEBUT_LANGAGE_CONFORMITE_APPLICATION ===
// v0.63.40 — CONFORMITÉ APPLICATION ↔ CATALOGUE (décision ChatGPT, 06/10/2026, après la liaison collective v0.63.39).
// MODULE PUR, SYNCHRONE, SANS ÉTAT. Il répond à UNE seule question :
//
//   « cette application est-elle écrite dans le mode de liaison que son opération déclare pour chacune de ses entrées ? »
//
// verifierApplicationAuCatalogue(application, descriptions) rend `true` ou lève un TypeError. Il ne rend jamais `false`, ne répare rien, ne
// complète rien, ne transforme rien : l'application n'est ni copiée ni modifiée (celle qui vient de applicationsSollicitables passe telle quelle).
//
// POURQUOI : la désignation persistante (enregistrerDesignation) ne connaît pas le catalogue, et l'observation ne dit pas qu'une entrée est
// collective. Une application construite à la main pouvait donc lier UNE donnée { entree, donnee } à une entrée `collectif: true` : un « choix d'une
// seule donnée » déguisé. Le catalogue reste l'UNIQUE source du fait « cette entrée est collective » ; il n'est copié nulle part.
//
// INVARIANT VÉRIFIÉ (général, aucun cas propre à une opération) :
//   - l'opération existe dans le catalogue ;
//   - la liste des liaisons couvre TOUTES les entrées de l'opération et uniquement elles, chacune UNE seule fois ;
//   - entrée ordinaire  -> liaison { entree, donnee: <chaîne non vide> } ;
//   - entrée collective -> liaison { entree, donnees: [<chaînes non vides, sans doublon>] } non vide ;
//   - jamais l'inverse, jamais les deux clés ensemble, aucune clé étrangère.
// L'EXACTITUDE de l'ensemble d'une liaison collective (« toutes les possibilités de l'observation, aucune de moins, aucune de plus ») reste
// vérifiée par enregistrerDesignation, qui lit l'observation ; ce module ne lit pas l'observation.
// Lecture : propriétés propres de donnée (accesseur refusé sans être exécuté, héritage ignoré). Catalogue validé par le langage de formes
// (validerDescripteurOperation), deux descriptions de même nom refusées. Aucun import autre que le langage de formes.
import { validerDescripteurOperation } from './formes-operation.js';

const NOM = 'verifierApplicationAuCatalogue';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${nom}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${nom}[${rang}] est un accesseur (une donnée est attendue)`);
  return place.value;
}

function lireObjetExact(valeur, cles, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) refuser(`${nom} doit être un objet { ${cles.join(', ')} }`);
  for (const cle of Reflect.ownKeys(valeur)) {
    if (typeof cle !== 'string' || !cles.includes(cle)) refuser(`${nom} contient un champ étranger`);
  }
  const lu = {};
  for (const cle of cles) {
    const place = Object.getOwnPropertyDescriptor(valeur, cle);
    if (place === undefined) refuser(`${nom} n'a pas de champ « ${cle} » propre`);
    if (!('value' in place)) refuser(`${nom}.${cle} est un accesseur (une donnée est attendue)`);
    lu[cle] = place.value;
  }
  return lu;
}

function exigerChaine(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
}

function lireCatalogue(descriptions) {
  if (!Array.isArray(descriptions)) refuser('descriptions doit être un tableau de descripteurs d\'opération');
  const operations = new Map();
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    let validee;
    try {
      validee = validerDescripteurOperation(lireRang(descriptions, rang, 'descriptions'));
    } catch (erreur) {
      refuser(`descriptions[${rang}] : ${erreur.message}`);
    }
    if (operations.has(validee.nom)) refuser(`descriptions : deux descriptions portent le même nom (rang ${rang})`);
    operations.set(validee.nom, validee);
  }
  return operations;
}

export function verifierApplicationAuCatalogue(application, descriptions) {
  const { operation, liaisons } = lireObjetExact(application, ['operation', 'liaisons'], 'application');
  exigerChaine(operation, 'application.operation');
  const description = lireCatalogue(descriptions).get(operation);
  if (description === undefined) refuser(`opération « ${operation} » inconnue du catalogue`);
  if (!Array.isArray(liaisons) || liaisons.length === 0) refuser('application.liaisons doit être un tableau non vide');
  const attendues = Object.keys(description.entrees);
  const vues = new Set();
  for (let rang = 0; rang < liaisons.length; rang += 1) {
    const lieu = `application.liaisons[${rang}]`;
    const brute = lireRang(liaisons, rang, 'application.liaisons');
    const collective = brute !== null && typeof brute === 'object' && !Array.isArray(brute) && Object.hasOwn(brute, 'donnees');
    const liaison = lireObjetExact(brute, collective ? ['entree', 'donnees'] : ['entree', 'donnee'], lieu);
    exigerChaine(liaison.entree, `${lieu}.entree`);
    if (!Object.hasOwn(description.entrees, liaison.entree)) refuser(`${lieu} : l'entrée « ${liaison.entree} » n'existe pas dans l'opération « ${operation} »`);
    if (vues.has(liaison.entree)) refuser(`${lieu} : l'entrée « ${liaison.entree} » est liée plusieurs fois`);
    vues.add(liaison.entree);
    const entreeCollective = description.entrees[liaison.entree].collectif === true;
    if (entreeCollective !== collective) {
      refuser(`${lieu} : l'entrée « ${liaison.entree} » est ${entreeCollective ? 'collective (liaison { entree, donnees } exigée)' : 'ordinaire (liaison { entree, donnee } exigée)'}`);
    }
    if (collective) {
      if (!Array.isArray(liaison.donnees) || liaison.donnees.length === 0) refuser(`${lieu}.donnees doit être un tableau non vide`);
      const ids = new Set();
      for (let k = 0; k < liaison.donnees.length; k += 1) {
        const id = lireRang(liaison.donnees, k, `${lieu}.donnees`);
        exigerChaine(id, `${lieu}.donnees[${k}]`);
        if (ids.has(id)) refuser(`${lieu}.donnees répète une donnée déjà présente`);
        ids.add(id);
      }
    } else {
      exigerChaine(liaison.donnee, `${lieu}.donnee`);
    }
  }
  for (const entree of attendues) {
    if (!vues.has(entree)) refuser(`application.liaisons ne lie pas l'entrée « ${entree} » de l'opération « ${operation} »`);
  }
  return true;
}
// === FIN_LANGAGE_CONFORMITE_APPLICATION ===
