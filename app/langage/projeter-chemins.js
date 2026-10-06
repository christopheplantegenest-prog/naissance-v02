// === DEBUT_LANGAGE_PROJETER_CHEMINS ===
// v0.63.45 — PROJECTION MÉCANIQUE DES CHEMINS (décision ChatGPT, 06/10/2026, après le diagnostic « situation et nouveauté »).
// FONCTION PURE, SYNCHRONE, SANS ÉTAT. JUMELLE STRUCTURELLE de la projection des contenus : elle rend, pour chaque élément reçu et dans l'ordre,
// EXACTEMENT son `chemin` :
//
//   [ { chemin: A, … }, { chemin: B, … } ]  ->  [ A, B ]
//
// Rien d'autre. Elle ne trie pas, ne filtre pas, ne dédoublonne pas, ne compare rien, ne calcule ni nouveauté ni différence, ne choisit aucun
// contexte, n'interprète pas les chemins, ne lit PAS `contenu` (les champs en plus sont tolérés et ignorés, jamais lus), n'utilise aucun
// horodatage et ne consulte aucune table. Chaque chemin rendu est la référence EXACTE reçue (aucune copie). Elle ne crée qu'UNE valeur.
// Le nom ne dit que la transformation (« prendre les chemins ») : aucune notion de situation, de nouveauté ou de dernier n'y entre.
// Elle ne fusionne JAMAIS avec la projection des contenus : l'une projette les VALEURS contenues, l'autre les IDENTITÉS.
// Entrée invalide (non tableau, tableau creux, élément non objet, `chemin` absent / accesseur / non collection / creux, élément de chemin
// non scalaire primitif) : TypeError, aucun résultat partiel. Lecture : propriétés propres de donnée (accesseur refusé sans être exécuté).
// L'unicité des chemins n'est PAS exigée. Ce fichier n'importe RIEN.
const NOM = 'projeterChemins';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireRang(tableau, rang, lieu) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${lieu}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${lieu}[${rang}] est un accesseur (une donnée est attendue)`);
  return place.value;
}

export function projeterChemins(elements) {
  if (!Array.isArray(elements)) refuser('elements doit être un tableau');
  const sortie = [];
  for (let rang = 0; rang < elements.length; rang += 1) {
    const element = lireRang(elements, rang, 'elements');
    if (element === null || typeof element !== 'object' || Array.isArray(element)) refuser(`elements[${rang}] doit être un objet portant un champ « chemin »`);
    const place = Object.getOwnPropertyDescriptor(element, 'chemin');
    if (place === undefined) refuser(`elements[${rang}] n'a pas de champ « chemin » propre`);
    if (!('value' in place)) refuser(`elements[${rang}].chemin est un accesseur (une donnée est attendue)`);
    const chemin = place.value;
    if (!Array.isArray(chemin)) refuser(`elements[${rang}].chemin doit être une collection`);
    for (let k = 0; k < chemin.length; k += 1) {
      const symbole = lireRang(chemin, k, `elements[${rang}].chemin`);
      if (typeof symbole !== 'string' && typeof symbole !== 'number' && typeof symbole !== 'boolean') refuser(`elements[${rang}].chemin[${k}] doit être un scalaire`);
    }
    sortie.push(chemin);
  }
  return sortie;
}
// === FIN_LANGAGE_PROJETER_CHEMINS ===
