// === DEBUT_LANGAGE_COMPOSER_COLLECTION ===
// v0.63.67 — brique « composerCollection » (décision de l'architecte). PRIMITIVE PURE, SYNCHRONE, SANS ÉTAT, DORMANTE.
// Elle reçoit UNE collection ORDONNÉE et rend UNE valeur du MÊME GENRE que ses éléments, lorsque cette composition est mécaniquement définie.
//
// RÈGLE GÉNÉRALE RETENUE (la seule) :
//   - la collection est un tableau DENSE dont chaque élément est une CHAÎNE PRIMITIVE ;
//   - la valeur composée est la chaîne obtenue en juxtaposant les éléments DANS L'ORDRE REÇU, bout à bout, suite d'unités de code après suite d'unités de code.
// Seul ce genre est composable : pour une collection de nombres, de booléens, d'objets, de collections ou de null, aucune composition ne se déduit du genre sans
// un choix arbitraire (somme ? produit ? « et » ? fusion ?). Ces collections sont REFUSÉES, jamais coercées : TypeError, aucun résultat partiel.
//
// HOMOGÉNÉITÉ : « tous les éléments sont des chaînes primitives ». Un élément d'un autre genre (nombre, booléen, null, undefined, objet, collection, objet String)
// refuse la collection ENTIÈRE. Aucune conversion implicite, aucune lecture de toString/valueOf.
// ORDRE : il fait partie de la donnée. Aucun tri, aucune déduplication, aucune normalisation Unicode : les doublons restent des doublons, les chaînes vides sont
// neutres, les chaînes de plusieurs caractères sont composées telles quelles. Les unités de code sont conservées : deux moitiés d'un caractère hors plan de base
// consécutives se retrouvent ensemble, un substitut isolé est conservé tel quel.
// COLLECTION VIDE : [] rend la chaîne vide. C'est une collection de chaînes (la forme déclarée l'accepte) et la juxtaposition de zéro élément ne contient rien.
// Lecture : propriétés propres de donnée (un accesseur est refusé sans être exécuté ; un tableau creux est refusé).
// La transformation ne voit que sa propre entrée. Ce fichier n'importe RIEN.
const NOM = 'composerCollection';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function genreDe(valeur) {
  if (valeur === null) return 'null';
  if (Array.isArray(valeur)) return 'collection';
  return typeof valeur;
}

export function composerCollection(elements) {
  if (!Array.isArray(elements)) refuser(`elements doit être un tableau (reçu : ${genreDe(elements)})`);
  let composition = '';
  for (let rang = 0; rang < elements.length; rang += 1) {
    const place = Object.getOwnPropertyDescriptor(elements, rang);
    if (place === undefined) refuser(`elements[${rang}] est absent (tableau creux)`);
    if (!('value' in place)) refuser(`elements[${rang}] est un accesseur (une donnée est attendue)`);
    if (typeof place.value !== 'string') refuser(`elements[${rang}] doit être une chaîne (reçu : ${genreDe(place.value)})`);
    composition += place.value;
  }
  return composition;
}
// === FIN_LANGAGE_COMPOSER_COLLECTION ===
