// === DEBUT_LANGAGE_RESOUDRE_ELEMENTS ===
// v0.63.47 — SÉLECTION D'ÉLÉMENTS IDENTIFIÉS EN CONSERVANT LEUR FORME (décision ChatGPT, 06/10/2026, après le diagnostic « cadrage de R ∩ N »).
// FONCTION PURE, SYNCHRONE, SANS ÉTAT. Elle répond à UNE seule question :
//
//   « quels éléments de cette collection ont un `chemin` qui appartient à cette couverture ? »
//
// ENTRÉES : elements = collection de { chemin: collection de scalaire, contenu: collection de scalaire } (champs en plus tolérés, jamais lus) ;
// couverture = collection de collection de scalaire. SORTIE : un NOUVEAU tableau des éléments ORIGINAUX (même référence : ni l'objet élément, ni
// son chemin, ni son contenu ne sont copiés), un par chemin demandé, dans l'ordre canonique de la couverture. L'ordre n'a aucune signification.
// C'est la jumelle, pour des éléments qui portent aussi leur `contenu`, de la résolution d'une couverture dans un univers : la MÉCANIQUE de
// résolution est celle de cette dernière (elle est réutilisée telle quelle : même égalité de chemins typés, mêmes erreurs, même ordre) ; ce
// contrat-ci ne fait qu'ajouter la validation du `contenu` et garantir que la forme de l'élément traverse la sélection.
// ÉGALITÉ : exactement celle des chemins typés (0 ≠ "0", [] ≠ [""], ["a/b"] ≠ ["a","b"]). Le contenu n'est JAMAIS comparé : deux éléments de
// chemins différents et de contenu identique restent distincts.
// ERREURS (TypeError, aucun résultat partiel, aucune déduplication) : doublon dans la couverture ; chemin demandé absent de `elements` ;
// deux éléments de même chemin ; entrée qui n'est pas un tableau, tableau creux, élément non objet, `chemin` ou `contenu` absent / accesseur /
// non collection / creux / contenant autre chose qu'un scalaire primitif. Couverture vide : collection vide valide.
// Elle ne connaît rien d'autre : aucun filtre de sous-collection, aucun champ particulier hors `chemin` et `contenu`, aucun choix, aucune table.
import { resoudreCouverture as resoudreChemins } from './resolution-couverture.js';

const NOM = 'resoudreElements';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireRang(tableau, rang, lieu) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${lieu}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${lieu}[${rang}] est un accesseur (une donnée est attendue)`);
  return place.value;
}

function exigerCollectionDeScalaires(liste, lieu) {
  if (!Array.isArray(liste)) refuser(`${lieu} doit être une collection`);
  for (let k = 0; k < liste.length; k += 1) {
    const x = lireRang(liste, k, lieu);
    if (typeof x !== 'string' && typeof x !== 'number' && typeof x !== 'boolean') refuser(`${lieu}[${k}] doit être un scalaire`);
  }
}

function exigerChamp(element, cle, lieu) {
  const place = Object.getOwnPropertyDescriptor(element, cle);
  if (place === undefined) refuser(`${lieu} n'a pas de champ « ${cle} » propre`);
  if (!('value' in place)) refuser(`${lieu}.${cle} est un accesseur (une donnée est attendue)`);
  exigerCollectionDeScalaires(place.value, `${lieu}.${cle}`);
}

export function resoudreElements(elements, couverture) {
  if (!Array.isArray(elements)) refuser('elements doit être un tableau');
  if (!Array.isArray(couverture)) refuser('couverture doit être un tableau');
  for (let rang = 0; rang < elements.length; rang += 1) {
    const element = lireRang(elements, rang, 'elements');
    if (element === null || typeof element !== 'object' || Array.isArray(element)) refuser(`elements[${rang}] doit être un objet { chemin, contenu }`);
    exigerChamp(element, 'chemin', `elements[${rang}]`);
    exigerChamp(element, 'contenu', `elements[${rang}]`);
  }
  return resoudreChemins(elements, couverture);
}
// === FIN_LANGAGE_RESOUDRE_ELEMENTS ===
