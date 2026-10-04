// === DEBUT_LANGAGE_PARCOURS_STRUCTURE ===
// v0.63.5 — ÉTAPE 6 : « PARCOURS GÉNÉRIQUE D'UNE VALEUR STRUCTURÉE » (décision ChatGPT, 04/10/2026, suite au diagnostic
// « PEUT-ON OBSERVER LES DESCRIPTIONS DES OUTILS AVEC LES OUTILS DÉJÀ EXISTANTS ? »). PRIMITIVE PURE, GÉNÉRALE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « quelles sont les occurrences structurelles de cette valeur JSON-compatible ? »
//
// Elle ne connaît RIEN : ni les opérations, ni les descripteurs, ni le langage, ni Naissance, ni les capacités, ni la
// pertinence. Elle ne choisit rien, n'interprète rien, ne compare rien : elle liste ce qui existe, avec le chemin qui y
// mène. Quelles occurrences méritent attention, et pourquoi, n'est PAS son affaire.
//
// ENTRÉE (domaine exact, récursif) : null ; chaîne ; booléen ; nombre fini ; tableau dense (prototype Array.prototype, aucune
// propriété propre autre que ses indices et `length`) ; objet simple (prototype Object.prototype ou null, uniquement des
// propriétés propres énumérables à clé chaîne et à valeur de donnée). Une sous-structure partagée mais ACYCLIQUE est permise.
// TypeError, sans aucun résultat : undefined, NaN, ±Infinity, bigint, symbol, fonction, Date, Map, Set, RegExp, instance de
// classe (ou de toute autre valeur dont le prototype n'est ni Object.prototype ni null), tableau creux, propriété de tableau
// additionnelle, clé symbole, accesseur, propriété propre non énumérable, cycle. Rien n'est corrigé, filtré ni converti.
// Un accesseur n'est JAMAIS exécuté : les propriétés sont lues par leur descripteur, seule leur valeur de donnée est lue.
//
// SORTIE : un tableau d'occurrences, en parcours PRÉFIXE (le nœud, puis ses enfants). Chaque nœud de la structure, conteneurs
// compris (même vides), produit exactement UNE occurrence :
//   { chemin: [...segments], type }                       pour 'objet', 'tableau' et 'nul' (jamais de `valeur`)
//   { chemin: [...segments], type, valeur }               pour 'chaine', 'nombre' et 'booleen' (valeur primitive)
// Les six types sont exactement : 'objet', 'tableau', 'chaine', 'nombre', 'booleen', 'nul'.
//
// CHEMIN : un tableau de segments typés naturellement -- clé d'objet = chaîne, indice de tableau = entier. La racine a le
// chemin []. Un chemin n'est JAMAIS encodé en chaîne (aucune jonction, aucune sérialisation) : "a/b" ne se confond pas avec
// ["a","b"], la clé "0" ne se confond pas avec l'indice 0, la clé vide ne se confond pas avec la racine.
//
// IDENTITÉ : dans UNE structure parcourue, le chemin est l'identité factuelle d'une occurrence. Aucune propriété `id` n'est
// créée, aucune identité n'est partagée entre deux appels.
//
// ORDRE : déterministe mais SANS AUCUNE SIGNIFICATION (ni importance, ni fréquence, ni qualité). Objets : clés propres triées
// par unités de code (l'ordre d'insertion n'est pas conservé). Tableaux : indices croissants.
//
// COPIE : la sortie ne partage aucune structure avec l'entrée. Les chemins sont neufs (un tableau par occurrence), les
// valeurs sont des primitives, aucun objet ni tableau d'entrée n'est placé dans la sortie. Une sous-structure partagée dans
// l'entrée produit des occurrences distinctes selon chacun de ses chemins. L'entrée n'est jamais modifiée (gelée acceptée).
//
// NON FOURNI VOLONTAIREMENT (dérivable, ou appartenant à une étape ultérieure) : id, parent, profondeur, nombre d'enfants,
// taille, feuille, catégorie, score, comparaison, regroupement, filtre, sélection, encodage de chemin.
//
// VALIDATION : le résultat n'est rendu qu'une fois TOUTE la structure lue ; une valeur invalide, même profonde, lève un
// TypeError et aucun résultat partiel n'existe. Une structure démesurément profonde épuise la pile du moteur et échoue de la
// même façon (sans résultat).
//
// INDÉPENDANCE : ce fichier n'importe RIEN. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique).

function lieu(chemin) {
  let texte = 'racine';
  for (let i = 0; i < chemin.length; i += 1) {
    const segment = chemin[i];
    texte += typeof segment === 'number' ? `[${segment}]` : `["${segment}"]`;
  }
  return texte;
}

function refuser(chemin, raison) {
  throw new TypeError(`parcourirStructure : ${lieu(chemin)} ${raison}.`);
}

function lireTableau(valeur, chemin) {
  if (Object.getPrototypeOf(valeur) !== Array.prototype) refuser(chemin, 'n\'est pas un tableau simple (sous-classe de tableau ?)');
  const n = valeur.length;
  const cles = Reflect.ownKeys(valeur);
  if (cles.length !== n + 1) refuser(chemin, 'est un tableau creux ou porte des propriétés additionnelles (clé symbole comprise)');
  const enfants = [];
  for (let i = 0; i < n; i += 1) {
    if (cles[i] !== String(i)) refuser(chemin, 'est un tableau creux ou porte des propriétés additionnelles');
    const d = Object.getOwnPropertyDescriptor(valeur, cles[i]);
    if (!('value' in d)) refuser([...chemin, i], 'est un accesseur');
    if (!d.enumerable) refuser([...chemin, i], 'n\'est pas énumérable');
    enfants.push([i, d.value]);
  }
  if (cles[n] !== 'length') refuser(chemin, 'est un tableau creux ou porte des propriétés additionnelles');
  return enfants;
}

function lireObjet(valeur, chemin) {
  const proto = Object.getPrototypeOf(valeur);
  if (proto !== Object.prototype && proto !== null) refuser(chemin, 'n\'est pas un objet simple (instance de classe, Date, Map, Set, RegExp… ?)');
  const enfants = [];
  for (const cle of Reflect.ownKeys(valeur)) {
    if (typeof cle !== 'string') refuser(chemin, 'porte une clé symbole');
    const d = Object.getOwnPropertyDescriptor(valeur, cle);
    if (!('value' in d)) refuser([...chemin, cle], 'est un accesseur');
    if (!d.enumerable) refuser([...chemin, cle], 'n\'est pas énumérable');
    enfants.push([cle, d.value]);
  }
  enfants.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return enfants;
}

function lire(valeur, chemin, pile, occurrences) {
  if (valeur === null) { occurrences.push({ chemin, type: 'nul' }); return; }
  const sorte = typeof valeur;
  if (sorte === 'string') { occurrences.push({ chemin, type: 'chaine', valeur }); return; }
  if (sorte === 'boolean') { occurrences.push({ chemin, type: 'booleen', valeur }); return; }
  if (sorte === 'number') {
    if (!Number.isFinite(valeur)) refuser(chemin, `contient un nombre non fini (${String(valeur)})`);
    occurrences.push({ chemin, type: 'nombre', valeur });
    return;
  }
  if (sorte !== 'object') refuser(chemin, `contient une valeur de type ${sorte} (valeur JSON attendue)`);
  if (pile.includes(valeur)) refuser(chemin, 'contient un cycle');
  const estTableau = Array.isArray(valeur);
  const enfants = estTableau ? lireTableau(valeur, chemin) : lireObjet(valeur, chemin);
  occurrences.push({ chemin, type: estTableau ? 'tableau' : 'objet' });
  pile.push(valeur);
  for (const [segment, enfant] of enfants) lire(enfant, [...chemin, segment], pile, occurrences);
  pile.pop();
}

export function parcourirStructure(valeur) {
  const occurrences = [];
  lire(valeur, [], [], occurrences);
  return occurrences;
}
// === FIN_LANGAGE_PARCOURS_STRUCTURE ===
