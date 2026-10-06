// === DEBUT_LANGAGE_GROUPES_CANDIDATS ===
// v0.63.21 — « GROUPES COMPLETS DE CANDIDATS » (décision ChatGPT, 05/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « parmi les opérations décrites, lesquelles ont, pour CHAQUE entrée requise, au moins une donnée candidate — et quels sont
//     alors, entrée par entrée, TOUS les candidats ? »
//
// Elle représente l'ESPACE COMPLET des applications possibles d'une opération sous forme COMPACTE (un groupe de candidats par
// entrée). Elle ne représente AUCUNE application particulière, n'en choisit aucune, n'exécute rien, ne persiste rien. Le produit
// des groupes (une donnée par entrée) n'est JAMAIS matérialisé : la désignation d'une application précise {operation, liaisons}
// appartient à un choix ultérieur.
//
// ENTRÉES : (possibilites, descriptions), deux tableaux DENSES.
//   possibilites : atomes { donnee, operation, entree } exactement, trois PROPRES champs de donnée, chaînes non vides, sans trim ni
//     coercition. Refusés (TypeError) : tableau creux, accesseur (jamais exécuté), propriété héritée, clé étrangère, atome répété à
//     l'identique (jamais fusionné), opération absente des descriptions, entrée absente de la description de l'opération.
//     Un atome prétend déjà être une possibilité valide : il n'est jamais ignoré en silence.
//   descriptions : validées UNE PAR UNE par le langage de formes existant ; deux descriptions de même nom : TypeError. Ce module
//     n'utilise d'une description que son nom, les noms de ses entrées et le fait `omissible` posé sur une ENTRÉE. Il ne relit
//     aucune forme et ne recalcule aucune compatibilité (responsabilité de la vue des possibilités).
//   Une description portant une entrée `omissible: true` est REFUSÉE (TypeError) : aucune entrée réelle n'est omissible ; ni
//   absence optionnelle, ni liaison undefined, ni double branche présente/absente ne sont inventées.
//
// SORTIE : un NOUVEAU tableau [{ operation, entrees: [{ entree, donnees: [identité, ...] }] }], rien d'autre (ni id, ni compte,
// ni forme, ni valeur, ni score). Une opération y figure SI ET SEULEMENT SI elle a au moins une entrée et que CHAQUE entrée
// requise (toutes les clés de ses entrées) a au moins un candidat ; chaque entrée requise y figure exactement une fois. Une
// opération incomplète est ABSENTE (jamais de groupe partiel, d'entrée vide ou de statut). Une même donnée peut figurer dans
// plusieurs entrées d'une opération ; plusieurs données dans une même entrée restent des candidats distincts.
// Ordre CANONIQUE par unités de code : opérations, puis entrées, puis identités. L'ordre d'arrivée n'a aucun sens.
//
// Ce module ne lit aucune valeur, aucun résultat, aucune mémoire ; il ne connaît aucun nom d'opération, ne garde aucun état.
// INDÉPENDANCE : il n'importe que le langage de formes. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier.
import { validerDescripteurOperation } from './formes-operation.js';

const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function lireRang(tableau, rang, nomTableau) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) throw new TypeError(`${nomTableau}[${rang}] est absent (tableau creux).`);
  if (!('value' in place)) throw new TypeError(`${nomTableau}[${rang}] est un accesseur : une donnée est attendue.`);
  return place.value;
}

function lireChampPropre(objet, champ, rang) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`possibilites[${rang}] n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`possibilites[${rang}].${champ} est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

export function groupesDeCandidats(possibilites, descriptions) {
  if (!Array.isArray(possibilites)) throw new TypeError('possibilites doit être un tableau d\'atomes { donnee, operation, entree }.');
  if (!Array.isArray(descriptions)) throw new TypeError('descriptions doit être un tableau de descripteurs d\'opération.');

  const operations = new Map();
  const collectives = new Map(); // v0.63.39 : opération -> entrée collective (au plus une, unique entrée), lue dans le descripteur validé
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    let validee;
    try {
      validee = validerDescripteurOperation(lireRang(descriptions, rang, 'descriptions'));
    } catch (erreur) {
      throw new TypeError(`descriptions[${rang}] : ${erreur.message}`);
    }
    if (operations.has(validee.nom)) throw new TypeError(`descriptions : deux descriptions portent le même nom (rang ${rang}).`);
    const candidats = new Map();
    for (const entree of Object.keys(validee.entrees)) {
      if (validee.entrees[entree].omissible === true) throw new TypeError(`descriptions[${rang}] : l'entrée « ${entree} » est omissible, ce que ce mécanisme ne représente pas.`);
      candidats.set(entree, new Set());
      if (validee.entrees[entree].collectif === true) collectives.set(validee.nom, entree);
    }
    operations.set(validee.nom, candidats);
  }

  for (let rang = 0; rang < possibilites.length; rang += 1) {
    const atome = lireRang(possibilites, rang, 'possibilites');
    if (atome === null || typeof atome !== 'object' || Array.isArray(atome)) {
      throw new TypeError(`possibilites[${rang}] doit être un objet { donnee, operation, entree }.`);
    }
    for (const cle of Reflect.ownKeys(atome)) {
      if (cle !== 'donnee' && cle !== 'operation' && cle !== 'entree') throw new TypeError(`possibilites[${rang}] contient un champ étranger.`);
    }
    const donnee = lireChampPropre(atome, 'donnee', rang);
    const operation = lireChampPropre(atome, 'operation', rang);
    const entree = lireChampPropre(atome, 'entree', rang);
    for (const [nom, valeur] of [['donnee', donnee], ['operation', operation], ['entree', entree]]) {
      if (typeof valeur !== 'string' || valeur.length === 0) throw new TypeError(`possibilites[${rang}].${nom} doit être une chaîne non vide.`);
    }
    const entrees = operations.get(operation);
    if (entrees === undefined) throw new TypeError(`possibilites[${rang}] : opération inconnue des descriptions.`);
    const candidats = entrees.get(entree);
    if (candidats === undefined) throw new TypeError(`possibilites[${rang}] : entrée inconnue de l'opération.`);
    if (candidats.has(donnee)) throw new TypeError(`possibilites[${rang}] répète une possibilité déjà présente.`);
    candidats.add(donnee);
  }

  const groupes = [];
  for (const operation of [...operations.keys()].sort(comparer)) {
    const entrees = operations.get(operation);
    if (entrees.size === 0) continue;
    const completes = [];
    for (const entree of [...entrees.keys()].sort(comparer)) {
      const donnees = [...entrees.get(entree)].sort(comparer);
      if (donnees.length === 0) break;
      completes.push(collectives.get(operation) === entree ? { entree, donnees, collectif: true } : { entree, donnees });
    }
    if (completes.length === entrees.size) groupes.push({ operation, entrees: completes });
  }
  return groupes;
}
// === FIN_LANGAGE_GROUPES_CANDIDATS ===
