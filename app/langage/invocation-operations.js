// === DEBUT_LANGAGE_INVOCATION_OPERATIONS ===
// v0.63.18 — ÉTAPE 8 : « INVOCATION MÉCANIQUE DES OPÉRATIONS DÉCRITES » (décision ChatGPT, 05/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « une table fermée, un nom d'opération et des valeurs nommées déjà disponibles : quel est le résultat BRUT de l'appel réel ? »
//
// ENTRÉES : (table, nom, valeurs).
//   table : objet dont chaque propriété PROPRE DE DONNÉE est une entrée { fonction, appel, parametres } (voir table-operations.js
//     pour la vraie table ; les tests utilisent des tables factices). Ce module n'importe RIEN : ni opération, ni description, ni
//     langage de formes ; il ne connaît aucun nom d'opération, aucune forme, ni message, trace, possibilité.
//   nom : chaîne non vide ; il SÉLECTIONNE une entrée de la table (propriété propre de donnée, via descripteur) et ne sert à rien d'autre :
//     jamais de module construit, d'eval, de namespace, de prototype (« __proto__ », « constructor », « toString » = inconnus).
//   valeurs : objet non nul, non tableau, portant exactement les paramètres attendus, rien d'autre.
//
// ENTRÉE DE TABLE, validée à l'appel pour pouvoir appeler sans ambiguïté (ce n'est PAS un validateur du catalogue descriptif) :
//   objet ; `fonction` appelable ; `appel` ∈ {'positionnel','objet'} ; `parametres` : tableau de chaînes non vides sans doublon.
//
// VALEURS : toute clé propre étrangère (Reflect.ownKeys : chaînes, symboles, non-énumérables) est refusée AVANT tout appel et sans
// que sa valeur soit lue. Chaque paramètre attendu doit être une propriété PROPRE DE DONNÉE : absent ou hérité = TypeError ; accesseur =
// TypeError sans exécution. Une propriété présente valant undefined est PRÉSENTE et transmise telle quelle (c'est l'opération qui juge).
// L'appel JavaScript ne fait pas ce travail (argument en trop ignoré, argument absent indiscernable d'un undefined présent) : cette
// primitive est la seule barrière.
//
// APPEL : 'positionnel' = un argument par paramètre, dans l'ORDRE de `parametres` (jamais celui de `valeurs`, jamais celui d'une
// description) ; 'objet' = UN SEUL argument, un objet NEUF (propriétés de donnée, exactement les paramètres), jamais `valeurs` lui-même.
//
// RÉSULTAT : rendu BRUT, par référence, sans copie, sérialisation, normalisation ni validation de sortie. Une erreur levée par la
// fonction se propage TELLE QUELLE (aucun try/catch, aucune enveloppe, aucune nouvelle classe) ; les refus propres de cette primitive
// sont des TypeError. Aucun état, aucune table, aucune trace, aucun choix.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique).
function lireChampPropre(objet, champ, nom) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`${nom}.${champ} est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

function exigerObjet(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`${nom} doit être un objet.`);
}

function lireParametres(entree, nom) {
  const brut = lireChampPropre(entree, 'parametres', nom);
  if (!Array.isArray(brut)) throw new TypeError(`${nom}.parametres doit être un tableau.`);
  const noms = [];
  for (let i = 0; i < brut.length; i += 1) {
    const element = lireChampPropre(brut, i, `${nom}.parametres`);
    if (typeof element !== 'string' || element.length === 0) throw new TypeError(`${nom}.parametres[${i}] doit être une chaîne non vide.`);
    if (noms.includes(element)) throw new TypeError(`${nom}.parametres contient un doublon.`);
    noms.push(element);
  }
  return noms;
}

export function invoquerOperation(table, nom, valeurs) {
  exigerObjet(table, 'table');
  if (typeof nom !== 'string' || nom.length === 0) throw new TypeError('nom doit être une chaîne non vide.');
  const entree = lireChampPropre(table, nom, 'table');
  exigerObjet(entree, 'entrée de table');
  const fonction = lireChampPropre(entree, 'fonction', 'entrée de table');
  if (typeof fonction !== 'function') throw new TypeError('entrée de table : fonction doit être appelable.');
  const appel = lireChampPropre(entree, 'appel', 'entrée de table');
  if (appel !== 'positionnel' && appel !== 'objet') throw new TypeError('entrée de table : appel inconnu.');
  const parametres = lireParametres(entree, 'entrée de table');
  exigerObjet(valeurs, 'valeurs');
  for (const cle of Reflect.ownKeys(valeurs)) {
    if (typeof cle !== 'string' || !parametres.includes(cle)) throw new TypeError('valeurs contient une entrée étrangère.');
  }
  const lues = parametres.map((parametre) => lireChampPropre(valeurs, parametre, 'valeurs'));
  if (appel === 'objet') {
    const argument = {};
    for (let i = 0; i < parametres.length; i += 1) {
      Object.defineProperty(argument, parametres[i], { value: lues[i], enumerable: true, writable: true, configurable: true });
    }
    return fonction(argument);
  }
  return fonction(...lues);
}
// === FIN_LANGAGE_INVOCATION_OPERATIONS ===
