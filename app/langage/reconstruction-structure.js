// === DEBUT_LANGAGE_RECONSTRUCTION_STRUCTURE ===
// v0.64.3 — « INVERSE GÉNÉRAL DU PARCOURS STRUCTUREL » (décision ChatGPT « DÉCISION v0.64.3 », 13/10/2026). PRIMITIVE PURE, GÉNÉRALE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « quelle est l'UNIQUE valeur JSON-compatible dont ces occurrences structurelles sont exactement les occurrences ? »
//
// C'est l'inverse exact de parcourirStructure (parcours-structure.js), défini sur SON contrat réel de sortie, et rien d'autre :
//   pour toute valeur admise X :            reconstruireStructure(parcourirStructure(X)) est structurellement égale à X ;
//   pour tout ensemble admissible O :       parcourirStructure(reconstruireStructure(O)) rend exactement les occurrences de O
//                                           (mêmes chemins, mêmes types, mêmes valeurs ; dans l'ordre du parcours).
//
// reconstruireStructure(occurrences) -> valeur
//   occurrences : un tableau dense d'occurrences, chacune un objet simple à propriétés propres de données, EXACTEMENT :
//     { chemin, type }           pour 'objet', 'tableau', 'nul'
//     { chemin, type, valeur }   pour 'chaine' (chaîne), 'nombre' (nombre fini), 'booleen' (booléen)
//   chemin : tableau dense de segments ; un segment est une chaîne (clé d'objet, toute chaîne, "" et "0" compris) ou un entier >= 0
//     (indice de tableau ; -0 refusé : le parcours ne le produit jamais). La clé "0" et l'indice 0 restent distincts.
//
// ADMISSIBILITÉ (sinon TypeError, aucun résultat partiel, aucune réparation) — l'ensemble doit décrire UNE valeur, sans rien deviner :
//   - exactement une occurrence de chemin [] (la racine) ;
//   - aucun chemin en double, même identique en tout point (le parcours produit exactement UNE occurrence par nœud : un doublon n'est
//     jamais une redondance admissible, c'est une entrée qui ne vient pas d'un parcours) ;
//   - toute occurrence non racine a son PARENT parmi les occurrences (chemin privé de son dernier segment). La nature d'un conteneur
//     n'est JAMAIS déduite du segment : elle vient uniquement de l'occurrence du parent ('objet' ou 'tableau'). Sans parent : refus ;
//   - un parent 'objet' n'a que des segments chaînes ; un parent 'tableau' n'a que des segments entiers ;
//   - un parent scalaire ou 'nul' n'a aucun descendant (feuille ayant des descendants : refus) ;
//   - les indices d'un tableau sont exactement 0..n-1 (un indice manquant rend la longueur et le contenu indécidables : refus) ;
//   - aucune propriété en plus dans une occurrence, aucun accesseur, aucune valeur hors du type annoncé.
// ORDRE : l'ordre des occurrences reçues n'a AUCUNE signification ; toute permutation rend la même valeur. L'ordre d'un tableau est
//   celui de ses indices (il appartient à la valeur). Les clés d'un objet reconstruit sont posées dans l'ordre canonique des unités de
//   code, le même que celui du parcours : ordre SANS signification, seulement pour qu'une permutation de l'entrée ne change même pas
//   l'ordre d'insertion des clés.
// SORTIE : une valeur neuve ; objets simples (prototype Object.prototype) et tableaux denses ; aucune structure partagée avec l'entrée.
//   (Une sous-structure partagée ou un objet à prototype null de la valeur d'origine reviennent comme copies structurellement égales.)
// Aucun nom de champ, aucune connaissance d'épisode, de fondation ou de Naissance. MISE À JOUR v0.64.5 : importée par attentes-conditionnees.js (relation fondatrice calculée à K0), seul mécanisme.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées.

const NOM = 'reconstruireStructure';
const SCALAIRES = Object.freeze({ chaine: 'string', nombre: 'number', booleen: 'boolean' });
const CONTENEURS = Object.freeze(['objet', 'tableau']);

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lieu(chemin) {
  let texte = 'racine';
  for (const segment of chemin) texte += typeof segment === 'number' ? `[${segment}]` : `["${segment}"]`;
  return texte;
}

// Lecture stricte d'un tableau dense simple (sans accesseur, sans propriété additionnelle) ; rend ses éléments.
function elementsDense(valeur, nom) {
  if (!Array.isArray(valeur) || Object.getPrototypeOf(valeur) !== Array.prototype) refuser(`${nom} doit être un tableau simple`);
  const cles = Reflect.ownKeys(valeur);
  if (cles.length !== valeur.length + 1 || cles[valeur.length] !== 'length') refuser(`${nom} est creux ou porte des propriétés additionnelles`);
  const elements = [];
  for (let i = 0; i < valeur.length; i += 1) {
    if (cles[i] !== String(i)) refuser(`${nom} est creux ou porte des propriétés additionnelles`);
    const d = Object.getOwnPropertyDescriptor(valeur, cles[i]);
    if (!('value' in d) || !d.enumerable) refuser(`${nom}[${i}] doit être une donnée énumérable`);
    elements.push(d.value);
  }
  return elements;
}

function lireOccurrence(brute, rang) {
  const nom = `occurrences[${rang}]`;
  if (brute === null || typeof brute !== 'object' || Array.isArray(brute)) refuser(`${nom} doit être un objet`);
  const proto = Object.getPrototypeOf(brute);
  if (proto !== Object.prototype && proto !== null) refuser(`${nom} doit être un objet simple`);
  const donnees = {};
  for (const cle of Reflect.ownKeys(brute)) {
    if (cle !== 'chemin' && cle !== 'type' && cle !== 'valeur') refuser(`${nom} porte une propriété étrangère (${String(cle)})`);
    const d = Object.getOwnPropertyDescriptor(brute, cle);
    if (!('value' in d) || !d.enumerable) refuser(`${nom}.${cle} doit être une donnée énumérable`);
    donnees[cle] = d.value;
  }
  if (!Object.hasOwn(donnees, 'chemin') || !Object.hasOwn(donnees, 'type')) refuser(`${nom} doit porter chemin et type`);
  const chemin = elementsDense(donnees.chemin, `${nom}.chemin`);
  chemin.forEach((s, k) => {
    const valide = (typeof s === 'string') || (Number.isSafeInteger(s) && s >= 0 && !Object.is(s, -0));
    if (!valide) refuser(`${nom}.chemin[${k}] doit être une chaîne ou un entier positif ou nul`);
  });
  const { type } = donnees;
  if (Object.hasOwn(SCALAIRES, type)) {
    if (!Object.hasOwn(donnees, 'valeur')) refuser(`${nom} (${type}) doit porter une valeur`);
    if (typeof donnees.valeur !== SCALAIRES[type] || (type === 'nombre' && !Number.isFinite(donnees.valeur))) refuser(`${nom} : valeur incompatible avec le type ${type}`);
  } else if (CONTENEURS.includes(type) || type === 'nul') {
    if (Object.hasOwn(donnees, 'valeur')) refuser(`${nom} (${type}) ne porte jamais de valeur`);
  } else {
    refuser(`${nom}.type inconnu (${String(type)})`);
  }
  return { chemin, type, valeur: donnees.valeur };
}

// Clé d'identité d'un chemin : la sérialisation JSON distingue la clé "0" de l'indice 0 et "a/b" de ["a","b"].
const cleDe = (chemin) => JSON.stringify(chemin);
const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function reconstruireStructure(occurrences) {
  const lues = elementsDense(occurrences, 'occurrences').map(lireOccurrence);
  const parChemin = new Map();
  for (const o of lues) {
    const cle = cleDe(o.chemin);
    if (parChemin.has(cle)) refuser(`le chemin ${lieu(o.chemin)} apparaît deux fois`);
    parChemin.set(cle, o);
  }
  const racine = parChemin.get('[]');
  if (racine === undefined) refuser('aucune occurrence racine (chemin [])');
  const enfants = new Map(); // clé du parent -> [occurrence]
  for (const o of lues) {
    if (o.chemin.length === 0) continue;
    const cleParent = cleDe(o.chemin.slice(0, -1));
    const parent = parChemin.get(cleParent);
    if (parent === undefined) refuser(`${lieu(o.chemin)} n'a pas d'occurrence parente : la nature de son conteneur est inconnue`);
    const segment = o.chemin[o.chemin.length - 1];
    if (parent.type === 'objet' && typeof segment !== 'string') refuser(`${lieu(o.chemin)} : un objet n'a que des clés chaînes`);
    if (parent.type === 'tableau' && typeof segment !== 'number') refuser(`${lieu(o.chemin)} : un tableau n'a que des indices entiers`);
    if (!CONTENEURS.includes(parent.type)) refuser(`${lieu(parent.chemin)} (${parent.type}) est une feuille et ne peut avoir de descendant`);
    if (!enfants.has(cleParent)) enfants.set(cleParent, []);
    enfants.get(cleParent).push(o);
  }
  const construire = (o) => {
    if (Object.hasOwn(SCALAIRES, o.type)) return o.valeur;
    if (o.type === 'nul') return null;
    const siens = enfants.get(cleDe(o.chemin)) || [];
    const dernier = (x) => x.chemin[x.chemin.length - 1];
    if (o.type === 'tableau') {
      const parIndice = new Map(siens.map((x) => [dernier(x), x]));
      for (let i = 0; i < siens.length; i += 1) if (!parIndice.has(i)) refuser(`${lieu(o.chemin)} : indices non contigus (indice ${i} absent)`);
      return Array.from({ length: siens.length }, (_, i) => construire(parIndice.get(i)));
    }
    const objet = {};
    for (const x of [...siens].sort((a, b) => comparerCodes(dernier(a), dernier(b)))) Object.defineProperty(objet, dernier(x), { value: construire(x), enumerable: true, writable: true, configurable: true }); // propriété propre, même pour la clé "__proto__"
    return objet;
  };
  return construire(racine);
}
// === FIN_LANGAGE_RECONSTRUCTION_STRUCTURE ===
