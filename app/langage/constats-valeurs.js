// === DEBUT_LANGAGE_CONSTATS_VALEURS ===
// v0.63.29 — ÉTAPE 6 : « OBSERVER LES VALEURS INDÉPENDAMMENT DE LEUR POSITION » (décision ChatGPT, 05/10/2026).
// OBSERVATEUR PUR, DORMANT. Il répond à UNE seule question :
//
//   « quelle VALEUR typée apparaît dans quels éléments, et à quels chemins internes ? »
//
// C'est une DEUXIÈME VUE des mêmes faits que le producteur de constats structurels, jamais son remplacement :
//   - constats structurels : deux occurrences sont le même constat si chemin relatif + type + valeur sont égaux ;
//   - ici : deux occurrences sont le même constat de valeur si type + valeur sont égaux. Le chemin NE SERT PAS À REGROUPER, mais il
//     n'est jamais supprimé des faits : chaque occurrence garde son élément et son chemin interne exacts. Ce module ne décide pas que la
//     position est sans importance : il rend visible la même valeur à des positions différentes, et la position où elle a été vue.
//
// ENTRÉE : un tableau d'éléments { chemin, contenu }, même contrat que le producteur de constats structurels : `chemin` = IDENTITÉ opaque de
// l'élément (chemin typé de couverture-occurrences.js), `contenu` = valeur JSON dans le domaine de parcourirStructure. Propriétés propres de
// donnée seulement (héritage ignoré, accesseur refusé sans être exécuté), instantané unique, entrée jamais modifiée. Elle accepte telle
// quelle la sortie de la vue des valeurs persistées (aucun adaptateur). Identités : normaliserCouverture() est l'unique autorité (doublon =
// TypeError, jamais fusionné) ; resoudreCouverture() ne sert qu'à obtenir les éléments dans l'ordre canonique de leur couverture
// universelle (convention déterministe SANS signification : ni temps, ni importance, ni fréquence, ni préférence).
//
// OBSERVATION : parcourirStructure() sur chaque contenu (ordre canonique des éléments ; un contenu invalide = TypeError, aucun résultat
// partiel). Seules les occurrences qui portent réellement une PROPRE propriété `valeur` entrent : chaînes, nombres finis, booléens.
// Les nœuds conteneurs (objet, tableau) et le nœud `nul` n'ont pas de propriété `valeur` dans le parcours : ils sont IGNORÉS ICI (aucune
// pseudo-valeur « objet », « tableau » ou null n'est inventée) ; les structures restent observables par le producteur de constats structurels.
//
// ÉGALITÉ DES VALEURS : celle du producteur de constats structurels. Même type ET Object.is des deux valeurs : 7 ≠ "7", true ≠ "true",
// 0 ≠ -0 (deux constats distincts). Aucune normalisation (casse, accents, blancs), aucune sérialisation comme identité : un index à clé
// de valeur (égalité SameValueZero, jamais de coercition entre types) dont le seul cas à part est -0, mis sous une clé interne dédiée.
//
// SORTIE : [{ constat: { type, valeur }, occurrences: [{ element, chemin }], couverture }].
//   - constat : copie neuve ; type = celui du parcours ('chaine' | 'nombre' | 'booleen').
//   - occurrences : TOUTES les occurrences réelles, une entrée par occurrence ; `element` = chemin d'identité de l'élément (copie neuve),
//     `chemin` = chemin interne exact. Dans un même élément, les occurrences multiples sont conservées (la multiplicité est un fait).
//   - couverture : couverture canonique (normaliserCouverture) des éléments, CHAQUE ÉLÉMENT AU PLUS UNE FOIS.
// Aucun score, aucun nombre « importance », aucun seuil, aucun classement par fréquence : le nombre d'occurrences se déduit des faits.
// Singletons conservés. [] donne []. Ordre : constats par première rencontre dans le parcours des éléments en ordre canonique ; occurrences
// dans cet ordre de rencontre (élément canonique, puis ordre du parcours) ; aucun comparateur de valeurs.
//
// COMPLEXITÉ : linéaire dans le nombre total d'occurrences rendues par le parcours (un index, jamais de comparaison deux à deux), hors
// canonicalisation des chemins d'identité faite par les primitives de couverture.
//
// INDÉPENDANCE : parcours-structure.js, couverture-occurrences.js, resolution-couverture.js, rien d'autre. Aucune connaissance de mot, de
// phrase, de langue ni de découpage de texte : une chaîne est un scalaire atomique. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce
// fichier, il n'est ni décrit au catalogue ni dans la table d'invocation (gardé par un test statique).
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

export function produireConstatsValeurs(elements) {
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
  const index = new Map();
  const groupes = [];
  for (let j = 0; j < ordonnes.length; j += 1) {
    for (const occurrence of parcours[j]) {
      if (!Object.hasOwn(occurrence, 'valeur')) continue;
      const cle = Object.is(occurrence.valeur, -0) ? MOINS_ZERO : occurrence.valeur;
      let groupe = index.get(cle);
      if (groupe === undefined) {
        groupe = { constat: { type: occurrence.type, valeur: occurrence.valeur }, occurrences: [], membres: [], dernier: -1 };
        index.set(cle, groupe);
        groupes.push(groupe);
      }
      groupe.occurrences.push({ element: [...universelle[j]], chemin: [...occurrence.chemin] });
      if (groupe.dernier !== j) {
        groupe.membres.push(ordonnes[j].chemin);
        groupe.dernier = j;
      }
    }
  }
  return groupes.map((groupe) => ({
    constat: groupe.constat,
    occurrences: groupe.occurrences,
    couverture: normaliserCouverture(groupe.membres),
  }));
}
// === FIN_LANGAGE_CONSTATS_VALEURS ===
