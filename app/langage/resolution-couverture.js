// === DEBUT_LANGAGE_RESOLUTION_COUVERTURE ===
// v0.63.7 — ÉTAPE 6 : « RÉSOLUTION PURE D'UNE COUVERTURE DANS UN UNIVERS » (décision ChatGPT, 04/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle relie deux représentations déjà acquises et répond à UNE seule question :
//
//   « quelles occurrences de cet univers désigne exactement cette couverture ? »
//
// Elle ne découvre aucun groupe, n'observe aucune propriété, ne connaît aucune raison et ne produit aucune couverture nouvelle.
//
// UNIVERS : un tableau d'occurrences { chemin, type[, valeur] } (la forme d'un parcours de structure). Seule exigence : chaque élément
// est un objet portant SON PROPRE champ « chemin » (donnée, jamais un accesseur), et l'ensemble des chemins est valide au sens de
// couverture-occurrences.js, doublons compris. Le type et la valeur ne sont NI lus NI validés : la résolution n'en dépend pas.
// Un doublon dans l'univers est un TypeError : une couverture ne pourrait plus désigner exactement une occurrence.
//
// COUVERTURE : validée par normaliserCouverture() (contrat de v0.63.6 : chemins typés, doublon = TypeError).
//
// IDENTITÉ : uniquement le chemin typé, par l'égalité de couverture-occurrences.js (0 != "0", [] != [""], ["a/b"] != ["a","b"]).
// Ce fichier ne définit AUCUNE égalité de chemins : il utilise les deux fonctions publiques de v0.63.6, sans rien y ajouter.
//
// CHEMIN ABSENT : un chemin de la couverture qui n'existe pas dans l'univers est un TypeError (une couverture est « dans » son
// univers). Rien n'est ignoré, aucun résultat partiel n'est rendu, aucune liste d'absents n'est produite.
//
// SORTIE : un NOUVEAU tableau contenant les occurrences ORIGINALES de l'univers (la même référence, pas une copie : la résolution
// est une SÉLECTION dans l'univers, jamais une donnée nouvelle ; l'identité d'une occurrence reste celle de son chemin). Ordre = ordre
// canonique de la couverture normalisée : deux représentations de la même couverture donnent la même séquence, quels que soient
// l'ordre de la couverture d'entrée et l'ordre de l'univers. Cet ordre est une convention de représentation, sans signification.
// Ni l'univers ni la couverture ne sont jamais modifiés. Les membres rendus restent partagés avec l'univers : les modifier modifie
// l'univers (à la charge de l'appelant).
//
// COÛT : une recherche linéaire par chemin demandé, car l'égalité typée est la seule opération publique de v0.63.6.
// INDÉPENDANCE : ce fichier importe uniquement couverture-occurrences.js. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier
// (gardé par un test statique).
import { normaliserCouverture, memesCouvertures } from './couverture-occurrences.js';

function lireChemin(occurrence, rang) {
  if (occurrence === null || typeof occurrence !== 'object' || Array.isArray(occurrence)) {
    throw new TypeError(`univers[${rang}] doit être un objet portant un champ « chemin ».`);
  }
  const propriete = Object.getOwnPropertyDescriptor(occurrence, 'chemin');
  if (propriete === undefined) throw new TypeError(`univers[${rang}] n'a pas de champ « chemin » propre.`);
  if (!('value' in propriete)) throw new TypeError(`univers[${rang}].chemin est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

export function resoudreCouverture(univers, couverture) {
  if (!Array.isArray(univers)) throw new TypeError('univers doit être un tableau d\'occurrences.');
  const occurrences = [];
  const chemins = [];
  for (let rang = 0; rang < univers.length; rang += 1) {
    const occurrence = univers[rang];
    chemins.push(lireChemin(occurrence, rang));
    occurrences.push(occurrence);
  }
  try {
    normaliserCouverture(chemins);
  } catch (erreur) {
    throw new TypeError(`univers : chemins invalides — ${erreur.message} (ici, le rang désigne la position dans l'univers).`);
  }
  const demandes = normaliserCouverture(couverture);
  const membres = [];
  for (let i = 0; i < demandes.length; i += 1) {
    let trouve = -1;
    for (let k = 0; k < chemins.length; k += 1) {
      if (memesCouvertures([chemins[k]], [demandes[i]])) { trouve = k; break; }
    }
    if (trouve < 0) throw new TypeError(`couverture : le chemin de rang canonique ${i} est absent de l'univers.`);
    membres.push(occurrences[trouve]);
  }
  return membres;
}
// === FIN_LANGAGE_RESOLUTION_COUVERTURE ===
