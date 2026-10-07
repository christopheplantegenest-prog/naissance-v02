// === DEBUT_LANGAGE_RETOURS_DE_VALEUR ===
// v0.63.68 — « OBSERVER UN RETOUR DE VALEUR DANS UNE CHAÎNE DE PRODUCTIONS » (décision ChatGPT, 07/10/2026). VUE PURE, SYNCHRONE, DORMANTE.
// v0.63.69 — PROJECTION. Ce module ne calcule plus rien lui-même : graphe, descendance, chemins, résolution des valeurs et relation de valeur
// vivent dans episodes-de-transformation.js (SEULE source de vérité). retoursDeValeur rend exactement les épisodes de relationValeur 'egale',
// regroupés par couple (ancetre, descendant) sous la forme de .68. COMPATIBILITÉ : même signature, même forme de sortie { retours,
// nonComparables, nombreDescendances }, même tri, mêmes étapes de chemin ; les tests de .68 passent sans modification de leurs attentes.
// Le texte ci-dessous (contrat de .68) reste vrai ; ce qui y est décrit comme « calculé ici » est désormais calculé par la vue générale.
// Elle répond à UNE seule question, purement historique :
//
//   « parmi les données examinables, laquelle possède la même valeur qu'une donnée dont elle DESCEND réellement par des exécutions,
//     tout en ayant une identité différente ? »
//
// retoursDeValeur(lignesValeurs, lignesExecutions, descriptions) -> { retours, nonComparables, nombreDescendances }
//   lignesValeurs / lignesExecutions / descriptions : exactement les arguments de resoudreIdentitesDonnees (messages persistés, exécutions
//   persistées, catalogue COURANT). La vue ne lit aucun magasin : elle ne voit que les lignes qu'on lui donne (aucune production future).
//
// DESCENDANCE (seule source : les liaisons persistées). Une exécution d'id P dont une liaison porte la donnée A (liaison ordinaire `donnee`
// ou chaque identité d'une liaison collective `donnees`) crée l'arête orientée A -> P. Si la ligne porte des sous-données (clé `sousDonnees`),
// la MÊME exécution crée aussi A -> chaque sous-donnée : une sous-donnée est portée par sa production et issue des mêmes entrées. Les
// liaisons sont lues par entreesDeProduction (validation + copie), les sous-données par indexSousDonnees : aucun second système d'identité
// (l'identité d'une production est l'id de sa ligne d'exécution). D descend de A s'il existe une suite d'arêtes A -> ... -> D (fermeture
// transitive, toutes les entrées d'une exécution sont des parents au même titre : aucun « parent principal »). Jamais déduite de l'égalité
// des valeurs, de l'ordre temporel, de la forme ni du nom d'une opération (aucun nom d'opération n'est connu de ce fichier).
// Cycles de graphe (données synthétiques) : parcours à ensemble visité, chemins SIMPLES (aucun nœud répété), ordre déterministe ; une donnée
// n'est jamais son propre descendant ; les données ne sont jamais corrigées.
//
// VALEURS : résolues par resoudreIdentitesDonnees + valeurDePorteur (message, production, sous-donnée, entrées(P)) : aucune règle parallèle.
// Une identité inconnue d'une liaison, une opération non décrite ou une ligne mal formée : TypeError (aucun résultat partiel).
// ÉGALITÉ : decrireValeursObservees (valeurs observées) sur les seules valeurs comparables ; c'est elle qui décide qu'une valeur est
// comparable (primitive JSON : chaîne, nombre fini, booléen, null, undefined). Aucune égalité profonde n'est créée : une collection, un objet
// ou les entrées d'une production sont NON COMPARABLES (listés dans `nonComparables`, jamais comptés comme égaux ni comme différents).
// Distinctions strictes : même identité (exclue : un retour exige des identités différentes) / même valeur / égalité structurelle (non
// couverte). Un retour exige : descendance ET identités différentes ET valeur égale. Même valeur sans descendance : aucun retour.
// Descendance sans valeur égale : aucun retour (la descendance reste interne ; seul son nombre est exposé).
//
// SORTIE
//   retours : [{ ancetre, descendant, valeur, chemins }] triés par (ancetre, descendant) en unités de code.
//     chemins : TOUS les chemins distincts de l'ancêtre au descendant (jamais fusionnés), chacun une suite d'étapes ordonnée de l'ancêtre
//       vers le descendant, triés par suite d'identités ; une étape = { de, execution, operation, entrees, vers } : la donnée reçue, la ligne
//       d'exécution (et son opération telle que persistée), les noms d'entrées par lesquels `de` y entre (triés), la donnée produite.
//       Un retour direct a un chemin d'UNE étape.
//   nonComparables : [{ identite, raison }] triées ; données ayant au moins une descendance (comme ancêtre ou comme descendant) dont la
//     valeur n'est pas comparable par decrireValeursObservees.
//   nombreDescendances : nombre de couples (ancêtre, descendant) d'identités différentes, comparables ou non.
// LIMITE : seules les valeurs primitives sont comparées. Le nombre de chemins n'est pas borné (graphes synthétiques très denses : coûteux).
//
// Un retour n'est PAS une interprétation : ni opérations inverses, ni règle, ni succès, ni utilité, ni préférence, ni attente, ni confirmation.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état global ; entrées jamais modifiées. NON BRANCHÉ : aucun
// mécanisme du dépôt n'importe ce fichier (gardé par un test statique).
import { episodesDeTransformation } from './episodes-de-transformation.js';

const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function retoursDeValeur(lignesValeurs, lignesExecutions, descriptions) {
  const { episodes, nonComparables, nombreDescendances } = episodesDeTransformation(lignesValeurs, lignesExecutions, descriptions);
  const parCouple = new Map(); // ancetre + NUL + descendant -> retour
  for (const episode of episodes) {
    if (episode.relationValeur !== 'egale') continue;
    const cle = `${episode.depart}\u0000${episode.arrivee}`;
    if (!parCouple.has(cle)) parCouple.set(cle, { ancetre: episode.depart, descendant: episode.arrivee, valeur: episode.valeurs.depart, chemins: [] });
    parCouple.get(cle).chemins.push(episode.chemin);
  }
  const retours = [...parCouple.values()].sort((x, y) => comparerCodes(x.ancetre, y.ancetre) || comparerCodes(x.descendant, y.descendant));
  return { retours, nonComparables, nombreDescendances };
}
// === FIN_LANGAGE_RETOURS_DE_VALEUR ===
