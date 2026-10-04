// === DEBUT_LANGAGE_CONSTATS_STRUCTURELS ===
// v0.63.8 — ÉTAPE 6 : « PREMIER PRODUCTEUR DE COUVERTURES : CONSTATS STRUCTURELS PARTAGÉS » (décision ChatGPT, 04/10/2026).
// PRODUCTEUR PUR, DORMANT. Il répond à UNE seule question :
//
//   « quels éléments partagent exactement un même constat structurel ? »
//
// ENTRÉE : un tableau d'éléments { chemin, contenu }. `chemin` = IDENTITÉ de l'élément (un chemin typé au sens de
// couverture-occurrences.js) ; `contenu` = donnée observable, OPAQUE pour ce fichier. Chaque élément est un objet (ni null, ni tableau)
// qui porte SES PROPRES champs de donnée « chemin » et « contenu » ; d'autres champs sont tolérés et ignorés. Un champ hérité ne compte
// pas ; un accesseur est refusé (TypeError) SANS être exécuté.
//
// INSTANTANÉ : une seule passe initiale lit chaque élément une fois (par description de propriété) et capture { chemin, contenu } dans
// une structure interne neuve. Plus rien n'est relu dans l'entrée ensuite ; l'entrée n'est jamais modifiée.
//
// IDENTITÉS : normaliserCouverture() (v0.63.6) est l'unique autorité sur la validité des chemins, leur unicité (un doublon d'identité est
// un TypeError : les contenus ne sont jamais fusionnés), l'identité typée (0 ≠ "0", [] ≠ [""]) et l'ordre canonique.
// ORDRE DES ÉLÉMENTS : resoudreCouverture() (v0.63.7) sert UNIQUEMENT à obtenir les éléments de l'instantané dans l'ordre canonique de
// leur couverture universelle. Cet ordre est une convention déterministe SANS signification perceptive : il rend le résultat
// indépendant de l'ordre d'entrée.
//
// CONTENU : ce fichier ne connaît aucune structure de contenu. Il appelle parcourirStructure() sur chaque contenu, dans l'ordre
// canonique des éléments (l'échec parmi plusieurs contenus invalides ne dépend donc pas de l'ordre d'entrée). Toute erreur du parcours
// est un échec du producteur : aucun résultat partiel. Un CONSTAT est exactement UNE occurrence rendue par ce parcours ; son chemin est
// RELATIF AU CONTENU et n'est jamais confondu avec l'identité de l'élément. Un élément POSSÈDE un constat si et seulement si ce
// constat figure tel quel dans le parcours de son contenu : aucune projection, aucune profondeur privilégiée, aucun champ choisi.
//
// ÉGALITÉ DE DEUX CONSTATS : chemins relatifs égaux (identité typée de v0.63.6), même type, même présence PROPRE d'une valeur, et,
// si elle est présente, Object.is des deux valeurs (donc 0 et -0 sont deux constats distincts ; l'absence n'est jamais une valeur nulle).
// Aucune sérialisation n'est employée comme identité.
//
// SORTIE : [{ constat, couverture }, ...]. `constat` est une copie neuve, indépendante de l'occurrence temporaire ; `couverture` est
// la couverture canonique (normaliserCouverture) des chemins d'identité ORIGINAUX des éléments qui possèdent ce constat. Un même
// constat trouvé dans plusieurs contenus est UNE seule entrée. Deux constats différents de même couverture restent deux entrées.
// Singletons et couverture universelle sont conservés ; aucune couverture vide n'est fabriquée ; [] donne []. Ordre : constats par
// première rencontre dans le parcours des éléments en ordre canonique (aucun comparateur de constats).
//
// DÉPENDANCES : parcours-structure.js, couverture-occurrences.js, resolution-couverture.js, rien d'autre. NON BRANCHÉ : aucun mécanisme
// du dépôt n'importe ce fichier (gardé par un test statique).
import { parcourirStructure } from './parcours-structure.js';
import { normaliserCouverture, memesCouvertures } from './couverture-occurrences.js';
import { resoudreCouverture } from './resolution-couverture.js';

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

function memeConstat(a, b) {
  if (a.type !== b.type) return false;
  const aValeur = Object.hasOwn(a, 'valeur');
  if (aValeur !== Object.hasOwn(b, 'valeur')) return false;
  if (aValeur && !Object.is(a.valeur, b.valeur)) return false;
  return memesCouvertures([a.chemin], [b.chemin]);
}

function copierConstat(occurrence) {
  const copie = { chemin: [...occurrence.chemin], type: occurrence.type };
  if (Object.hasOwn(occurrence, 'valeur')) copie.valeur = occurrence.valeur;
  return copie;
}

export function produireConstatsStructurels(elements) {
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
  const groupes = [];
  for (let j = 0; j < ordonnes.length; j += 1) {
    for (const occurrence of parcours[j]) {
      let groupe = null;
      for (let g = 0; g < groupes.length; g += 1) {
        if (memeConstat(groupes[g].constat, occurrence)) { groupe = groupes[g]; break; }
      }
      if (groupe === null) {
        groupe = { constat: copierConstat(occurrence), membres: [] };
        groupes.push(groupe);
      }
      groupe.membres.push(ordonnes[j].chemin);
    }
  }
  return groupes.map((groupe) => ({ constat: groupe.constat, couverture: normaliserCouverture(groupe.membres) }));
}
// === FIN_LANGAGE_CONSTATS_STRUCTURELS ===
