// === DEBUT_LANGAGE_SUITES_FERMEES ===
// v0.63.32 — ÉTAPE 6 : « OBSERVER LES SUITES CONTIGUËS FERMÉES » (décision ChatGPT, 05/10/2026, après les diagnostics v0.63.30 et v0.63.31).
// OBSERVATEUR PUR, DORMANT. Il répond à UNE seule question :
//
//   « quelle suite contiguë de valeurs scalaires typées apparaît dans quels éléments, à quels endroits, et sous quel parent ? »
//
// C'est une TROISIÈME VUE des mêmes faits (valeur + élément + chemin), jamais un remplacement des deux autres :
//   - constats structurels : même fait = même chemin relatif + type + valeur ;
//   - constats de valeurs  : même fait = même type + valeur, à n'importe quel chemin ;
//   - ici                  : même fait = même SUITE CONTIGUË de valeurs, à n'importe quelle position.
// Aucune perception nouvelle : chaque symbole d'une suite est une valeur que l'observateur de valeurs voit déjà, à ce chemin exact.
//
// ENTRÉE : un tableau d'éléments { chemin, contenu }, même contrat que l'observateur de valeurs (elle accepte telle quelle la sortie de la
// vue des valeurs persistées). `chemin` = identité opaque de l'élément (normaliserCouverture est l'unique autorité : doublon = TypeError),
// `contenu` = valeur JSON du domaine de parcourirStructure (invalide = TypeError, aucun résultat partiel). Instantané unique, propriétés
// propres de donnée seulement, entrée jamais modifiée. Ordre des éléments : ordre canonique de leur couverture universelle (convention
// déterministe SANS signification : ni temps, ni importance, ni fréquence).
//
// SÉQUENCE : dans un contenu, pour un parent tableau donné, une suite MAXIMALE d'indices entiers consécutifs dont chaque enfant est un
// scalaire (chaîne, nombre fini, booléen). Une séquence ne franchit jamais un changement de parent. Sont des BARRIÈRES : le nœud nul, un
// objet, un tableau imbriqué (le tableau imbriqué a ses propres séquences). Aucun symbole nul, objet ou tableau n'est inventé. Une chaîne
// est un scalaire atomique : elle n'est jamais parcourue. Les scalaires enfants d'un objet ou la racine scalaire n'ont pas d'indice : aucune
// séquence.
// Exemple : [1,2,null,3,[7,8],9,"x"] → [1,2], [3], [7,8], [9,"x"].
//
// ÉGALITÉ DES SYMBOLES : celle de l'observateur de valeurs : même type ET Object.is. 7 ≠ "7", true ≠ "true", 0 ≠ -0. Aucune
// sérialisation comme identité, aucune normalisation. Un index à clé de valeur (SameValueZero, jamais de coercition entre types) dont le
// seul cas à part est -0, mis sous une clé interne dédiée.
//
// FAIT : une suite w (contenu, longueur = contenu.length) et l'ensemble EXACT Occ(w) de ses occurrences (élément, parent, début). Deux
// occurrences du même contenu à des positions différentes appartiennent au même fait.
// FERMETURE PAR OCCURRENCES (indépendante de l'algorithme) : w est fermée si AUCUNE extension d'un symbole, à gauche ou à droite, ne
// conserve exactement toutes ses occurrences (une extension conserve toutes les occurrences quand chaque occurrence de w a, de ce côté, un
// voisin dans sa séquence et que ce voisin est le même partout ; le bord d'une séquence bloque l'extension de ce côté). La fermeture se
// raisonne sur les OCCURRENCES, jamais sur la seule couverture : « a » dans ababa/aba a la même couverture que « ab » mais cinq
// occurrences contre trois.
// Toute suite omise se reconstruit EXACTEMENT depuis un seul groupe fermé : contenu = tranche, occurrences = occurrences du groupe
// décalées, couverture = celle des occurrences décalées.
//
// SORTIE : [{ contenu: [symboles], occurrences: [{ element, parent, debut }], couverture }].
//   - contenu : valeurs scalaires explicites (copie neuve). Aucune référence, aucune structure d'index exposée.
//   - occurrences : TOUTES les occurrences exactes (multiples dans un élément, chevauchantes, même contenu sous plusieurs parents) ;
//     `element` = chemin d'identité (copie neuve), `parent` = chemin interne du tableau parent (copie neuve), `debut` = indice entier.
//   - couverture : couverture canonique des éléments, chaque élément au plus une fois, dérivée des occurrences.
// Longueur 1 et singletons conservés : aucun seuil de longueur, de couverture, de fréquence, aucun top N.
// ORDRE (canonique, sans signification) : groupes par première occurrence (rang canonique de séquence, puis début) puis longueur ;
// occurrences dans le même ordre (séquence, puis début). Une permutation des éléments ou des clés d'objet ne change pas la sortie.
//
// ALGORITHME (interne, jamais exposé) : toutes les séquences sont mises bout à bout, chacune suivie d'un séparateur unique ; un automate
// de suffixes généralisé (au plus 2N états) est construit ; un état donne au plus un groupe fermé (sa plus longue suite sans séparateur) ;
// il est fermé à droite si aucune transition par un symbole réel ne mène à un état de même nombre d'occurrences. Les occurrences d'un
// groupe se lisent dans le sous-arbre de liens. Construction en temps ≈ N ; N = nombre de symboles en séquence.
// DETTE QUADRATIQUE CONNUE (non corrigée ici) : la taille de la SORTIE est la somme des occurrences et des longueurs de contenu des groupes
// fermés ; sur des corpus périodiques (a^n : n groupes, n(n+1)/2 occurrences) elle est quadratique. Le nombre de groupes reste ≤ 2N.
//
// INDÉPENDANCE : parcours-structure.js, couverture-occurrences.js, resolution-couverture.js, rien d'autre. Aucune connaissance de mot, de
// phrase, de langue, ni de découpage de texte. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier, il n'est ni décrit au
// catalogue ni dans la table d'invocation, il ne persiste rien (gardé par un test statique).
import { parcourirStructure } from './parcours-structure.js';
import { normaliserCouverture } from './couverture-occurrences.js';
import { resoudreCouverture } from './resolution-couverture.js';

const MOINS_ZERO = Symbol('moins-zero');

function lireDonnee(objet, intitule, rang) {
  const propriete = Object.getOwnPropertyDescriptor(objet, intitule);
  if (propriete === undefined) throw new TypeError(`elements[${rang}] n'a pas de champ « ${intitule} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`elements[${rang}].${intitule} est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

function instantane(elements) {
  const prises = [];
  for (let rang = 0; rang < elements.length; rang += 1) {
    const place = Object.getOwnPropertyDescriptor(elements, rang);
    if (place === undefined) throw new TypeError(`elements[${rang}] est absent (tableau creux).`);
    if (!('value' in place)) throw new TypeError(`elements[${rang}] est un accesseur : une donnée est attendue.`);
    const element = place.value;
    if (element === null || typeof element !== 'object' || Array.isArray(element)) {
      throw new TypeError(`elements[${rang}] doit être un objet portant « chemin » et « contenu ».`);
    }
    prises.push({ chemin: lireDonnee(element, 'chemin', rang), contenu: lireDonnee(element, 'contenu', rang) });
  }
  return prises;
}

function memeParent(chemin, parent) {
  if (chemin.length !== parent.length + 1) return false;
  for (let i = 0; i < parent.length; i += 1) if (chemin[i] !== parent[i]) return false;
  return true;
}

// Séquences d'un contenu : suites maximales d'enfants scalaires d'un même tableau, à indices consécutifs.
function sequencesDe(occurrences) {
  const sequences = [];
  let courante = null;
  for (const occurrence of occurrences) {
    if (!Object.hasOwn(occurrence, 'valeur')) continue;
    const chemin = occurrence.chemin;
    const indice = chemin[chemin.length - 1];
    if (chemin.length === 0 || typeof indice !== 'number') continue;
    if (courante !== null && courante.suivant === indice && memeParent(chemin, courante.parent)) {
      courante.valeurs.push(occurrence.valeur);
      courante.suivant += 1;
    } else {
      courante = { parent: chemin.slice(0, -1), debut: indice, suivant: indice + 1, valeurs: [occurrence.valeur] };
      sequences.push(courante);
    }
  }
  return sequences;
}

// Automate de suffixes généralisé sur un texte d'entiers. Interne : rien n'en sort.
function automate(texte) {
  const longueur = [0];
  const lien = [-1];
  const suivants = [new Map()];
  const nombre = [0];
  const fin = [-1];
  const prefixe = [false];
  let dernier = 0;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    const courant = longueur.length;
    longueur.push(longueur[dernier] + 1); lien.push(0); suivants.push(new Map()); nombre.push(1); fin.push(i); prefixe.push(true);
    let p = dernier;
    while (p !== -1 && !suivants[p].has(c)) { suivants[p].set(c, courant); p = lien[p]; }
    if (p !== -1) {
      const q = suivants[p].get(c);
      if (longueur[p] + 1 === longueur[q]) {
        lien[courant] = q;
      } else {
        const clone = longueur.length;
        longueur.push(longueur[p] + 1); lien.push(lien[q]); suivants.push(new Map(suivants[q])); nombre.push(0); fin.push(fin[q]); prefixe.push(false);
        while (p !== -1 && suivants[p].get(c) === q) { suivants[p].set(c, clone); p = lien[p]; }
        lien[q] = clone;
        lien[courant] = clone;
      }
    }
    dernier = courant;
  }
  const n = longueur.length;
  const seaux = new Array(texte.length + 2).fill(0);
  for (let v = 0; v < n; v += 1) seaux[longueur[v]] += 1;
  for (let k = 1; k < seaux.length; k += 1) seaux[k] += seaux[k - 1];
  const ordre = new Array(n);
  for (let v = n - 1; v >= 0; v -= 1) { seaux[longueur[v]] -= 1; ordre[seaux[longueur[v]]] = v; }
  for (let k = n - 1; k > 0; k -= 1) { const v = ordre[k]; nombre[lien[v]] += nombre[v]; }
  return { longueur, lien, suivants, nombre, fin, prefixe };
}

export function produireSuitesFermees(elements) {
  if (!Array.isArray(elements)) throw new TypeError('elements doit être un tableau d\'éléments { chemin, contenu }.');
  const prises = instantane(elements);
  let universelle;
  try {
    universelle = normaliserCouverture(prises.map((prise) => prise.chemin));
  } catch (erreur) {
    throw new TypeError(`elements : chemins d'identité invalides — ${erreur.message} (ici, le rang désigne la position dans elements).`);
  }
  const ordonnes = resoudreCouverture(prises, universelle);
  const parcours = [];
  for (let j = 0; j < ordonnes.length; j += 1) {
    try {
      parcours.push(parcourirStructure(ordonnes[j].contenu));
    } catch (erreur) {
      throw new TypeError(`elements : contenu invalide (rang canonique ${j}) — ${erreur.message}`);
    }
  }
  // Séquences, symboles typés (index à clé de valeur), texte d'entiers avec séparateurs uniques.
  const alphabet = new Map();
  const valeursDeSymbole = [];
  const sequences = [];
  for (let j = 0; j < ordonnes.length; j += 1) {
    for (const sequence of sequencesDe(parcours[j])) {
      sequence.element = j;
      sequences.push(sequence);
      for (const valeur of sequence.valeurs) {
        const cle = Object.is(valeur, -0) ? MOINS_ZERO : valeur;
        if (!alphabet.has(cle)) { alphabet.set(cle, valeursDeSymbole.length); valeursDeSymbole.push(valeur); }
      }
    }
  }
  if (sequences.length === 0) return [];
  const k = valeursDeSymbole.length;
  const texte = [];
  const debutDeSequence = [];
  const sequenceDe = [];
  const dernierSeparateur = [];
  for (let g = 0; g < sequences.length; g += 1) {
    debutDeSequence.push(texte.length);
    for (const valeur of sequences[g].valeurs) {
      texte.push(alphabet.get(Object.is(valeur, -0) ? MOINS_ZERO : valeur));
      sequenceDe.push(g);
      dernierSeparateur.push(-1);
    }
    texte.push(k + g);
    sequenceDe.push(g);
    dernierSeparateur.push(-1);
  }
  // dernierSeparateur[i] : position du dernier séparateur à l'indice ≤ i (-1 si aucun).
  for (let i = 0, dernier = -1; i < texte.length; i += 1) {
    if (texte[i] >= k) dernier = i;
    dernierSeparateur[i] = dernier;
  }
  const { longueur, lien, suivants, nombre, fin, prefixe } = automate(texte);
  const n = longueur.length;
  // Enfants dans l'arbre de liens, pour lire les fins d'occurrences d'un état.
  const enfants = new Array(n);
  for (let v = 0; v < n; v += 1) enfants[v] = [];
  for (let v = 1; v < n; v += 1) enfants[lien[v]].push(v);
  const groupes = [];
  for (let v = 1; v < n; v += 1) {
    const e = fin[v];
    const L = Math.min(longueur[v], e - dernierSeparateur[e]);
    if (L <= longueur[lien[v]] || L === 0) continue;
    let ferme = true;
    for (const [symbole, cible] of suivants[v]) {
      if (symbole < k && nombre[cible] === nombre[v]) { ferme = false; break; }
    }
    if (!ferme) continue;
    const fins = [];
    const pile = [v];
    while (pile.length > 0) {
      const u = pile.pop();
      if (prefixe[u]) fins.push(fin[u]);
      for (const w of enfants[u]) pile.push(w);
    }
    const departs = fins.map((f) => f - L + 1).sort((a, b) => a - b);
    groupes.push({ L, departs });
  }
  groupes.sort((a, b) => (a.departs[0] - b.departs[0]) || (a.L - b.L));
  return groupes.map(({ L, departs }) => {
    const premier = departs[0];
    const contenu = [];
    for (let i = 0; i < L; i += 1) contenu.push(valeursDeSymbole[texte[premier + i]]);
    const occurrences = [];
    const membres = [];
    let dernierElement = -1;
    for (const depart of departs) {
      const g = sequenceDe[depart];
      const sequence = sequences[g];
      occurrences.push({ element: [...universelle[sequence.element]], parent: [...sequence.parent], debut: sequence.debut + (depart - debutDeSequence[g]) });
      if (sequence.element !== dernierElement) { membres.push(ordonnes[sequence.element].chemin); dernierElement = sequence.element; }
    }
    return { contenu, occurrences, couverture: normaliserCouverture(membres) };
  });
}
// === FIN_LANGAGE_SUITES_FERMEES ===
