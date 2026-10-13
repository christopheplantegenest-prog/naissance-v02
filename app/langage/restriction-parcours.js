// === DEBUT_LANGAGE_RESTRICTION_PARCOURS ===
// v0.64.4 — « SOUS-PARCOURS STRUCTUREL MINIMAL » (décision ChatGPT « DÉCISION v0.64.4 », 13/10/2026). PRIMITIVE PURE, GÉNÉRALE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « parmi les occurrences d'un parcours, quel est le PLUS PETIT sous-ensemble qui contient les occurrences de ces chemins et décrit encore
//     une valeur reconstructible ? »
//
// restreindreParcours(occurrences, chemins) -> occurrences
//   occurrences : P, un parcours COMPLET au sens de reconstruireStructure (domaine exact de reconstruction-structure.js : une racine, chaque
//     parent présent, segments compatibles, tableaux denses ; typiquement la sortie de parcourirStructure). Un P hors domaine : TypeError.
//   chemins : C, tableau dense de chemins (tableaux denses de segments : chaîne, ou entier >= 0). C est un ENSEMBLE : son ordre et ses
//     répétitions n'ont aucune signification (un chemin répété est le même chemin demandé). Un chemin absent de P : TypeError.
//   Demander un chemin = demander SON OCCURRENCE, et rien d'autre. Demander un conteneur ne demande pas ses descendants : { c:{d:3,e:4} },
//     demande c -> occurrences de la racine et de c, reconstruites en { c:{} }. Le sous-arbre entier est une AUTRE demande (ses chemins).
//
// SORTIE : S, le MINIMUM (au sens de l'inclusion) des sous-ensembles de P qui contiennent les occurrences de C et appartiennent au domaine de
//   reconstruireStructure. Il existe et il est unique : ces sous-ensembles sont stables par intersection et P en fait partie. Il est obtenu
//   par la fermeture de C sous les seules conséquences de ce domaine :
//     D1 : la racine ; D2 : le parent de toute occurrence retenue ; D3 : dans un tableau, tous les indices inférieurs à un indice retenu
//     (un tableau dense ne peut avoir un indice i sans 0..i-1 ; aucun indice n'est jamais renuméroté).
//   Aucune autre règle. S ⊆ P : aucune occurrence, valeur ni type inventé ; un prédécesseur de tableau est retenu par SON occurrence seule
//   (un objet ou un tableau sans ses descendants ; un scalaire avec sa valeur, indissociable de son occurrence). C vide : S = { racine }.
//   ORDRE : celui du parcours de la valeur reconstruite (préfixe, clés en unités de code, indices croissants), c'est-à-dire l'ordre technique
//   déjà fixé par parcourirStructure, sans signification ; il ne dépend ni de l'ordre de P ni de celui de C. Occurrences neuves (copies).
//   reconstruireStructure(S) réussit toujours, et parcourirStructure(reconstruireStructure(S)) rend S.
// LECTURE DU RÉSULTAT : la valeur reconstruite à partir de S est une PROJECTION. Un conteneur vide y signifie « aucun descendant retenu »,
//   PAS « ce conteneur était vide » ; un objet y omet les clés non retenues.
// Aucun nom de champ, aucune connaissance de ce que décrivent les occurrences. MISE À JOUR v0.64.5 : importée par attentes-conditionnees.js (relation fondatrice calculée à K0), seul mécanisme.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées.
import { reconstruireStructure } from './reconstruction-structure.js';
import { parcourirStructure } from './parcours-structure.js';

const NOM = 'restreindreParcours';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function denses(valeur, nom) {
  if (!Array.isArray(valeur) || Object.getPrototypeOf(valeur) !== Array.prototype) refuser(`${nom} doit être un tableau simple`);
  const cles = Reflect.ownKeys(valeur);
  if (cles.length !== valeur.length + 1 || cles[valeur.length] !== 'length') refuser(`${nom} est creux ou porte des propriétés additionnelles`);
  return cles.slice(0, -1).map((cle, i) => {
    if (cle !== String(i)) refuser(`${nom} est creux ou porte des propriétés additionnelles`);
    const d = Object.getOwnPropertyDescriptor(valeur, cle);
    if (!('value' in d) || !d.enumerable) refuser(`${nom}[${i}] doit être une donnée énumérable`);
    return d.value;
  });
}

const cleDe = (chemin) => JSON.stringify(chemin);

export function restreindreParcours(occurrences, chemins) {
  // P doit appartenir au domaine : reconstruireStructure le vérifie entièrement (racine, parents, segments, tableaux denses, doublons, valeurs).
  reconstruireStructure(occurrences);
  const parChemin = new Map(denses(occurrences, 'occurrences').map((o) => [cleDe(o.chemin), o]));
  const demandes = denses(chemins, 'chemins').map((c, rang) => {
    const segments = denses(c, `chemins[${rang}]`);
    segments.forEach((s, k) => { if (!(typeof s === 'string' || (Number.isSafeInteger(s) && s >= 0 && !Object.is(s, -0)))) refuser(`chemins[${rang}][${k}] doit être une chaîne ou un entier positif ou nul`); });
    if (!parChemin.has(cleDe(segments))) refuser(`chemins[${rang}] n'est le chemin d'aucune occurrence du parcours`);
    return segments;
  });
  // Fermeture par D1/D2/D3 (D1 découle de D2 : tout chemin remonte à la racine ; C vide : la racine seule).
  const retenus = new Map();
  const pile = [[], ...demandes];
  while (pile.length > 0) {
    const chemin = pile.pop();
    const cle = cleDe(chemin);
    if (retenus.has(cle)) continue;
    retenus.set(cle, parChemin.get(cle));
    if (chemin.length === 0) continue;
    const parent = chemin.slice(0, -1);
    pile.push(parent);
    if (parChemin.get(cleDe(parent)).type === 'tableau') for (let i = 0; i < chemin[chemin.length - 1]; i += 1) pile.push([...parent, i]);
  }
  // Sortie dans l'ordre technique du parcours (sans signification) : parcours de la projection reconstruite = exactement S, copies neuves.
  return parcourirStructure(reconstruireStructure([...retenus.values()]));
}
// === FIN_LANGAGE_RESTRICTION_PARCOURS ===
