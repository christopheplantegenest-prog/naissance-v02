// === DEBUT_LANGAGE_PROJETER_CONTENUS ===
// v0.63.43 — PROJECTION MÉCANIQUE DES CONTENUS (décision ChatGPT, 06/10/2026, après le cadrage B1).
// FONCTION PURE, SYNCHRONE, SANS ÉTAT. Elle rend, pour chaque élément reçu et dans l'ordre, EXACTEMENT son `contenu` :
//
//   [ { contenu: A, … }, { contenu: B, … } ]  ->  [ A, B ]
//
// Rien d'autre. Elle ne trie pas, ne filtre pas, ne dédoublonne pas, ne concatène pas, ne choisit pas, ne classe pas, n'applique aucun seuil,
// ne lit NI couverture NI occurrences NI chemin (les champs en plus sont tolérés et ignorés), n'interprète pas le contenu et n'en tire aucune
// identité. Les doublons restent des doublons ; un contenu vide reste vide ; chaque contenu rendu est la référence EXACTE reçue (aucune copie).
// Elle ne crée qu'UNE valeur : une seule production, jamais une production par contenu.
// La VALEUR rendue ne contient aucune identité historique : la provenance reste dans la ligne d'exécution et la désignation ordinaires.
// Le nom ne dit que la transformation (« prendre les contenus ») : aucune notion de motif, de condition ou de suite n'y entre.
// Entrée invalide (non tableau, tableau creux, élément non objet, `contenu` absent / accesseur / non collection / creux, élément de contenu
// non scalaire primitif) : TypeError, aucun résultat partiel. Lecture : propriétés propres de donnée (accesseur refusé sans être exécuté).
// Ce fichier n'importe RIEN.
const NOM = 'projeterContenus';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireRang(tableau, rang, lieu) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${lieu}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${lieu}[${rang}] est un accesseur (une donnée est attendue)`);
  return place.value;
}

export function projeterContenus(elements) {
  if (!Array.isArray(elements)) refuser('elements doit être un tableau');
  const sortie = [];
  for (let rang = 0; rang < elements.length; rang += 1) {
    const element = lireRang(elements, rang, 'elements');
    if (element === null || typeof element !== 'object' || Array.isArray(element)) refuser(`elements[${rang}] doit être un objet portant un champ « contenu »`);
    const place = Object.getOwnPropertyDescriptor(element, 'contenu');
    if (place === undefined) refuser(`elements[${rang}] n'a pas de champ « contenu » propre`);
    if (!('value' in place)) refuser(`elements[${rang}].contenu est un accesseur (une donnée est attendue)`);
    const contenu = place.value;
    if (!Array.isArray(contenu)) refuser(`elements[${rang}].contenu doit être une collection`);
    for (let k = 0; k < contenu.length; k += 1) {
      const symbole = lireRang(contenu, k, `elements[${rang}].contenu`);
      if (typeof symbole !== 'string' && typeof symbole !== 'number' && typeof symbole !== 'boolean') refuser(`elements[${rang}].contenu[${k}] doit être un scalaire`);
    }
    sortie.push(contenu);
  }
  return sortie;
}
// === FIN_LANGAGE_PROJETER_CONTENUS ===
