// === DEBUT_LANGAGE_PARTITION_COUVERTURES ===
// v0.63.9 — ÉTAPE 6 : « PARTITION ÉLÉMENTAIRE DE DEUX COUVERTURES » (décision ChatGPT, 04/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « que partagent deux couvertures, et que possède chacune que l'autre n'a pas ? »
//
// ENTRÉES : deux couvertures au sens de v0.63.6, validées et canonicalisées par normaliserCouverture() (aucune validation de chemin
// n'est recopiée ici). Un doublon, un chemin invalide ou une entrée qui n'est pas un tableau est un TypeError, sans résultat partiel.
// Elle ne reçoit AUCUN univers, AUCUN constat, AUCUNE raison : seulement deux couvertures.
//
// SORTIE : exactement { communs, seulementA, seulementB }, trois couvertures normalisées (nouvelles structures) :
//   communs = A ∩ B,  seulementA = A \ B,  seulementB = B \ A.
// [] est une partie valide : elle dit seulement qu'aucun chemin n'appartient à cette partie. Elle n'est jamais interprétée.
// La primitive ne classe pas la relation (aucun mot « égal », « inclus », « disjoint », « chevauchement », « universel »,
// « singleton ») : ces constats se lisent sur les trois parties. Aucune taille, aucun compteur, aucune matrice, aucun rang.
// Une couverture universelle fournie comme A ou B n'a aucun traitement particulier.
//
// IDENTITÉ DES CHEMINS : uniquement celle de v0.63.6, par memesCouvertures() sur des couvertures d'un seul chemin (segments typés,
// 0 ≠ "0", 0 = -0, préfixes distincts, [] ≠ [""]). Aucune sérialisation, aucune clé texte, aucun hachage.
// NOTE -0 : l'identité est celle de v0.63.6, mais la représentation d'un chemin reste celle de la couverture qui le porte.
// « communs » reprend les chemins de A ; si A porte [-0] et B porte [0], communs contient [-0] (et vice versa en échangeant A et B).
//
// ORDRE : chaque partie est rendue par normaliserCouverture() ; l'ordre brut des entrées n'a aucune influence.
// COÛT : comparaison linéaire par chemin (la seule égalité publique de v0.63.6 est memesCouvertures) : O(|A|·|B|).
// INDÉPENDANCE : ce fichier importe uniquement couverture-occurrences.js. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce
// fichier (gardé par un test statique).
import { normaliserCouverture, memesCouvertures } from './couverture-occurrences.js';

function lire(couverture, intitule) {
  try {
    return normaliserCouverture(couverture);
  } catch (erreur) {
    throw new TypeError(`${intitule} : ${erreur.message}`);
  }
}

function contient(couverture, chemin) {
  for (let i = 0; i < couverture.length; i += 1) {
    if (memesCouvertures([couverture[i]], [chemin])) return true;
  }
  return false;
}

export function partagerCouvertures(a, b) {
  const gauche = lire(a, 'a');
  const droite = lire(b, 'b');
  const communs = [];
  const seulementA = [];
  const seulementB = [];
  for (let i = 0; i < gauche.length; i += 1) {
    if (contient(droite, gauche[i])) communs.push(gauche[i]);
    else seulementA.push(gauche[i]);
  }
  for (let j = 0; j < droite.length; j += 1) {
    if (!contient(gauche, droite[j])) seulementB.push(droite[j]);
  }
  return {
    communs: normaliserCouverture(communs),
    seulementA: normaliserCouverture(seulementA),
    seulementB: normaliserCouverture(seulementB),
  };
}
// === FIN_LANGAGE_PARTITION_COUVERTURES ===
