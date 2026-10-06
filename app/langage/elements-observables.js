// === DEBUT_LANGAGE_ELEMENTS_OBSERVABLES ===
// v0.63.41 — PREMIÈRE OPÉRATION COLLECTIVE RÉELLE DU CATALOGUE (décision ChatGPT, 06/10/2026, après le diagnostic du raccord 7.3).
// FONCTION PURE, SYNCHRONE, SANS ÉTAT. Elle met EXPLICITEMENT en forme d'élément observable des données reçues avec leur identité :
//
//   [ { identite, valeur }, … ]  ->  [ { chemin: [identite], contenu: valeur }, … ]
//
// `identite` est l'identité immuable de la donnée (chaîne) ; `chemin` est son identité sous la forme attendue par les observateurs
// ({ chemin, contenu }) : EXACTEMENT UN segment, l'identité reçue, telle quelle. Aucune hiérarchie n'est inventée.
// INVARIANTS : même ordre que l'entrée ; aucun tri, aucun filtre, aucun dédoublonnage ; `contenu` est la référence EXACTE de `valeur`
// (aucune copie, aucune transformation) ; aucune connaissance de l'origine, du nom ni du contenu des données. L'ensemble reçu est
// celui de la liaison collective (toutes les données de la forme déclarée) : ce fichier n'en choisit aucune.
// Entrée invalide (non tableau, élément non objet, `identite` non chaîne non vide) : TypeError, aucun résultat partiel. Le contrôle est
// minimal : la forme précise de `valeur` est la garantie du catalogue, pas de cette fonction.
// Lecture : propriétés propres de donnée (accesseur refusé sans être exécuté). Ce fichier n'importe RIEN.
const NOM = 'elementsObservables';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lire(element, cle, rang) {
  const place = Object.getOwnPropertyDescriptor(element, cle);
  if (place === undefined) refuser(`elements[${rang}] n'a pas de champ « ${cle} » propre`);
  if (!('value' in place)) refuser(`elements[${rang}].${cle} est un accesseur (une donnée est attendue)`);
  return place.value;
}

export function elementsObservables(elements) {
  if (!Array.isArray(elements)) refuser('elements doit être un tableau');
  const sortie = [];
  for (let rang = 0; rang < elements.length; rang += 1) {
    const place = Object.getOwnPropertyDescriptor(elements, rang);
    if (place === undefined || !('value' in place)) refuser(`elements[${rang}] est absent ou est un accesseur`);
    const element = place.value;
    if (element === null || typeof element !== 'object' || Array.isArray(element)) refuser(`elements[${rang}] doit être un objet { identite, valeur }`);
    const identite = lire(element, 'identite', rang);
    if (typeof identite !== 'string' || identite.length === 0) refuser(`elements[${rang}].identite doit être une chaîne non vide`);
    sortie.push({ chemin: [identite], contenu: lire(element, 'valeur', rang) });
  }
  return sortie;
}
// === FIN_LANGAGE_ELEMENTS_OBSERVABLES ===
