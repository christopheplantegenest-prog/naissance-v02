// === DEBUT_LANGAGE_RELATIONS_PARENT_ENFANT ===
// v0.63.11 — ÉTAPE 6 : « RELATION STRUCTURELLE PARENT → ENFANT » (décision ChatGPT, 04/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle rend EXPLICITE une seule relation déjà contenue dans les chemins d'un univers, et répond à UNE seule question :
//
//   « quels chemins de cet univers ont leur parent immédiat dans cet univers ? »
//
// Elle ne découvre aucune sémantique, ne calcule aucune descendance, ne connaît ni le catalogue, ni aucun nom de champ.
//
// UNIVERS : un tableau DENSE d'objets portant chacun SON PROPRE champ « chemin » (donnée, jamais un accesseur, jamais hérité). Même
// contrat minimal que l'univers de la résolution de couverture (v0.63.7) : ni type, ni valeur, ni contenu, ni id ne sont lus ; les champs supplémentaires
// sont ignorés. La lecture est faite par description de propriété : un accesseur (sur un rang du tableau ou sur « chemin ») est
// refusé SANS être exécuté. (La lecture est volontairement recopiée ici : aucun validateur commun n'est extrait dans cette version.)
//
// VALIDATION DES CHEMINS : entièrement déléguée à normaliserCouverture() (couverture-occurrences.js, v0.63.6) : segments chaîne ou
// entier >= 0, [] valide, doublon = TypeError ([0] et [-0] sont une même identité), aucune règle de chemin n'est recopiée ici.
//
// PARENT IMMÉDIAT : pour un chemin [c0 … cn] de longueur > 0, c'est exactement [c0 … c(n-1)] (le dernier segment retiré, un seul).
// Une paire n'est produite QUE SI ce chemin parent existe lui-même dans l'univers, par l'égalité typée de v0.63.6 (memesCouvertures
// sur des couvertures d'un seul chemin : 0 != "0", [] != [""], ["a/b"] != ["a","b"], 0 = -0). Aucun « ancêtre le plus proche présent » :
// si ["a","b"] est absent, ["a","b","c"] n'a PAS de paire, même si ["a"] est présent. La racine [] n'a aucun parent : elle ne produit
// aucune paire comme enfant (elle peut être parent d'un chemin de longueur 1, sans traitement spécial).
//
// SORTIE : un NOUVEAU tableau de { parent, enfant } exactement, deux chemins qui sont des COPIES NEUVES (jamais les tableaux de
// l'entrée, jamais partagés entre deux paires). Ni segment, ni profondeur, ni type, ni valeur, ni contenu, ni nombre d'enfants, ni racine,
// ni ancêtre, ni descendant, ni sous-arbre, ni couverture : le segment reliant parent et enfant se retrouve par différence des deux
// chemins (le dernier segment de `enfant`), il n'est donc pas stocké. Ordre = ordre canonique du chemin ENFANT (celui de
// normaliserCouverture), SANS signification ; l'ordre brut de l'univers n'a aucune influence.
// NOTE -0 : l'identité est celle de v0.63.6 ; la REPRÉSENTATION d'un chemin est celle de l'élément de l'univers qui le porte. `enfant`
// reprend le chemin de l'élément enfant, `parent` reprend le chemin de l'élément parent (pas un préfixe recopié depuis l'enfant) : si
// l'univers porte [-0] comme parent et [0, "x"] comme enfant, la paire est { parent: [-0], enfant: [0, "x"] }.
//
// COÛT : pour chaque chemin non racine, une recherche linéaire de son parent par la seule égalité publique de v0.63.6 : O(n²) égalités.
// INDÉPENDANCE : ce fichier importe uniquement couverture-occurrences.js. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier
// (gardé par un test statique). Il n'est PAS décrit dans le catalogue des opérations (décision de la v0.63.11) et ne reçoit aucun catalogue.
import { normaliserCouverture, memesCouvertures } from './couverture-occurrences.js';

function lireCheminPropre(univers, rang) {
  const place = Object.getOwnPropertyDescriptor(univers, rang);
  if (place === undefined) throw new TypeError(`univers[${rang}] est absent (tableau creux).`);
  if (!('value' in place)) throw new TypeError(`univers[${rang}] est un accesseur : une donnée est attendue.`);
  const occurrence = place.value;
  if (occurrence === null || typeof occurrence !== 'object' || Array.isArray(occurrence)) {
    throw new TypeError(`univers[${rang}] doit être un objet portant un champ « chemin ».`);
  }
  const propriete = Object.getOwnPropertyDescriptor(occurrence, 'chemin');
  if (propriete === undefined) throw new TypeError(`univers[${rang}] n'a pas de champ « chemin » propre.`);
  if (!('value' in propriete)) throw new TypeError(`univers[${rang}].chemin est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

export function relationsParentEnfant(univers) {
  if (!Array.isArray(univers)) throw new TypeError('univers doit être un tableau d\'objets portant un champ « chemin ».');
  const chemins = [];
  for (let rang = 0; rang < univers.length; rang += 1) chemins.push(lireCheminPropre(univers, rang));
  let canoniques;
  try {
    canoniques = normaliserCouverture(chemins);
  } catch (erreur) {
    throw new TypeError(`univers : chemins invalides — ${erreur.message} (ici, le rang désigne la position dans l'univers).`);
  }
  const paires = [];
  for (let i = 0; i < canoniques.length; i += 1) {
    const enfant = canoniques[i];
    if (enfant.length === 0) continue;
    const attendu = enfant.slice(0, enfant.length - 1);
    for (let j = 0; j < canoniques.length; j += 1) {
      if (memesCouvertures([canoniques[j]], [attendu])) {
        paires.push({ parent: [...canoniques[j]], enfant: [...enfant] });
        break;
      }
    }
  }
  return paires;
}
// === FIN_LANGAGE_RELATIONS_PARENT_ENFANT ===
