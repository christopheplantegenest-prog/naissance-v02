// === DEBUT_LANGAGE_EPISODES_DE_TRANSFORMATION ===
// v0.63.69 — « OBSERVER LES ÉPISODES DE TRANSFORMATION, Y COMPRIS LES NON-RETOURS » (décision ChatGPT, 07/10/2026). VUE PURE, SYNCHRONE, DORMANTE.
// Généralisation de retoursDeValeur (v0.63.68) : ce module est désormais la SEULE source de vérité pour le graphe de descendance, les chemins,
// la résolution des valeurs et la relation de valeur ; retours-de-valeur.js n'est plus qu'une projection (épisodes de relation 'egale').
// Elle répond à UNE seule question, purement historique :
//
//   « quels chemins réels de transformation ont été vécus entre deux données d'identités distinctes, et quelle est la relation entre la
//     valeur de départ et la valeur d'arrivée : egale, differente ou non_comparable ? »
//
// episodesDeTransformation(lignesValeurs, lignesExecutions, descriptions) -> { episodes, nonComparables, nombreDescendances }
//   lignesValeurs / lignesExecutions / descriptions : exactement les arguments de resoudreIdentitesDonnees (messages persistés, exécutions
//   persistées, catalogue COURANT). La vue ne lit aucun magasin : elle ne voit que les lignes qu'on lui donne (aucune production future).
//
// ÉPISODE = UN CHEMIN INDIVIDUEL (décision B). Un épisode est { depart, arrivee, chemin, relationValeur[, valeurs] } :
//   - depart, arrivee : identités réelles distinctes ; `arrivee` descend de `depart` par le chemin ;
//   - chemin : suite ordonnée d'étapes { de, execution, operation, entrees, vers } — la donnée reçue, la ligne d'exécution (son id), son
//     opération telle que persistée, les noms d'entrées par lesquels `de` y entre (triés), la donnée produite ; une étape par liaison, un
//     retour direct = un chemin d'UNE étape ;
//   - relationValeur : 'egale' | 'differente' | 'non_comparable' ;
//   - valeurs : { depart, arrivee } présent uniquement si les deux extrémités sont comparables (relation egale ou differente).
//   Deux chemins distincts entre le même départ et la même arrivée = DEUX épisodes (jamais fusionnés) : c'est ce qui permettra à une vue
//   ultérieure de comparer des chemins par leur structure (suite des opérations + entrées empruntées) sans perte. Tri : par depart, arrivee,
//   puis suite d'identités du chemin (unités de code). Aucun compteur, score, fréquence, succès, échec, règle, attente ni utilité.
//
// DESCENDANCE (seule source : les liaisons persistées). Une exécution d'id P dont une liaison porte la donnée A (liaison ordinaire `donnee`
// ou chaque identité d'une liaison collective `donnees`) crée l'arête orientée A -> P. Si la ligne porte des sous-données (clé `sousDonnees`),
// la MÊME exécution crée aussi A -> chaque sous-donnée : une sous-donnée est portée par sa production et issue des mêmes entrées. Les
// liaisons sont lues par entreesDeProduction (validation + copie), les sous-données par indexSousDonnees : aucun second système d'identité
// (l'identité d'une production est l'id de sa ligne d'exécution). Jamais déduite de l'égalité des valeurs, de l'ordre temporel, de la forme
// ni du nom d'une opération (aucun nom d'opération n'est connu de ce fichier). Cycles de graphe (données synthétiques) : chemins SIMPLES
// (aucune donnée répétée), ensemble visité, ordre déterministe ; une donnée n'est jamais sa propre arrivée ; les données ne sont jamais
// corrigées. TOUS les chemins simples sont énumérés : aucune limite, aucune politique de réduction (coût mesuré par les tests).
//
// VALEURS : résolues par resoudreIdentitesDonnees + valeurDePorteur (message, production, sous-donnée, entrées(P)) : aucune règle parallèle.
// Une identité inconnue d'une liaison, une opération non décrite ou une ligne mal formée : TypeError (aucun résultat partiel).
// RELATION : decrireValeursObservees décide ce qui est comparable (primitive JSON : chaîne, nombre fini, booléen, null, undefined) et
// porte l'égalité typée existante (7 et "7" différents ; null et undefined différents). Aucune égalité profonde : une collection, un objet
// ou les entrées d'une production sont NON COMPARABLES (listés dans `nonComparables` avec la raison), et tout épisode dont une extrémité
// est non comparable a relationValeur 'non_comparable' — jamais supprimé, jamais compté comme confirmation ni contradiction. Les formes ne
// participent à aucune décision : rien n'est déduit des formes.
//
//   nonComparables : [{ identite, raison }] triées — données impliquées dans au moins une descendance dont la valeur n'est pas comparable.
//   nombreDescendances : nombre de couples (ancêtre, descendant) d'identités différentes (indépendant du nombre de chemins).
//
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état global ; entrées jamais modifiées. NON BRANCHÉ : seul
// retours-de-valeur.js (dormant) importe ce fichier ; aucun mécanisme du dépôt ne l'appelle (gardé par un test statique).
import { resoudreIdentitesDonnees } from './resoudre-identites.js';
import { entreesDeProduction } from './entrees-production.js';
import { indexSousDonnees } from './sous-donnees.js';
import { decrireValeursObservees } from './valeurs-observees.js';
import { valeurDePorteur } from './acces-valeur.js';

const NOM = 'episodesDeTransformation';
export const RELATIONS_VALEUR = Object.freeze(['egale', 'differente', 'non_comparable']);

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${nom}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${nom}[${rang}] est un accesseur : une donnée est attendue`);
  return place.value;
}

function exigerTableau(valeur, nom) {
  if (!Array.isArray(valeur)) refuser(`${nom} doit être un tableau`);
}

export function episodesDeTransformation(lignesValeurs, lignesExecutions, descriptions) {
  exigerTableau(lignesValeurs, 'lignesValeurs');
  exigerTableau(lignesExecutions, 'lignesExecutions');
  exigerTableau(descriptions, 'descriptions');

  // 1. Graphe : arêtes parent -> enfant, étiquetées par l'exécution et les noms d'entrées.
  const noeuds = new Set();
  const parents = new Map(); // enfant -> Set(parents)
  const aretes = new Map(); // parent + NUL + enfant -> { execution, operation, entrees:Set }
  const sousIndex = indexSousDonnees(lignesExecutions);
  const sousParExecution = new Map(); // idExecution -> [idsSous]
  for (const [idSous, { execution }] of sousIndex) {
    const idE = Object.getOwnPropertyDescriptor(execution, 'id').value;
    if (!sousParExecution.has(idE)) sousParExecution.set(idE, []);
    sousParExecution.get(idE).push(idSous);
  }
  const relier = (parent, enfant, idExecution, operation, entree) => {
    noeuds.add(parent);
    noeuds.add(enfant);
    if (!parents.has(enfant)) parents.set(enfant, new Set());
    parents.get(enfant).add(parent);
    const cle = `${parent}\u0000${enfant}`;
    if (!aretes.has(cle)) aretes.set(cle, { execution: idExecution, operation, entrees: new Set() });
    aretes.get(cle).entrees.add(entree);
  };
  for (let rang = 0; rang < lignesExecutions.length; rang += 1) {
    const ligne = lireRang(lignesExecutions, rang, 'lignesExecutions');
    if (ligne === null || typeof ligne !== 'object' || Array.isArray(ligne)) refuser(`lignesExecutions[${rang}] doit être un objet`);
    const idE = Object.getOwnPropertyDescriptor(ligne, 'id')?.value;
    if (typeof idE !== 'string' || idE.length === 0) refuser(`lignesExecutions[${rang}].id doit être une chaîne non vide`);
    noeuds.add(idE);
    let liaisons;
    try {
      liaisons = entreesDeProduction(idE, lignesExecutions);
    } catch (erreur) {
      refuser(`liaisons de « ${idE} » illisibles : ${erreur.message}`);
    }
    const operation = Object.getOwnPropertyDescriptor(ligne, 'operation').value;
    const cibles = [idE, ...(sousParExecution.get(idE) ?? [])];
    for (const liaison of liaisons) {
      const donnees = Object.hasOwn(liaison, 'donnees') ? liaison.donnees : [liaison.donnee];
      for (const parent of donnees) for (const cible of cibles) relier(parent, cible, idE, operation, liaison.entree);
    }
    for (const cible of cibles) noeuds.add(cible);
  }
  const ordre = [...noeuds].sort(comparerCodes);
  const parentsTries = new Map();
  for (const id of ordre) parentsTries.set(id, [...(parents.get(id) ?? [])].sort(comparerCodes));

  // 2. Ascendances (fermeture transitive, ensemble visité, sans soi-même).
  const ascendances = new Map();
  for (const id of ordre) {
    const vus = new Set();
    const pile = [...parentsTries.get(id)];
    while (pile.length > 0) {
      const courant = pile.pop();
      if (vus.has(courant)) continue;
      vus.add(courant);
      for (const p of parentsTries.get(courant) ?? []) if (!vus.has(p)) pile.push(p);
    }
    vus.delete(id);
    ascendances.set(id, vus);
  }
  let nombreDescendances = 0;
  for (const asc of ascendances.values()) nombreDescendances += asc.size;

  // 3. Valeurs : mécanismes existants. Comparable = accepté par decrireValeursObservees.
  const impliquees = new Set();
  for (const [id, asc] of ascendances) {
    if (asc.size > 0) impliquees.add(id);
    for (const a of asc) impliquees.add(a);
  }
  const resolues = resoudreIdentitesDonnees(ordre, lignesValeurs, lignesExecutions, descriptions);
  const valeurs = new Map();
  const nonComparables = [];
  for (const r of resolues) {
    const id = r.donnee.identite;
    if (!impliquees.has(id)) continue;
    const valeur = valeurDePorteur(r.porteur, r.donnee, r.acces);
    try {
      decrireValeursObservees([{ id, valeur }]);
    } catch (erreur) {
      nonComparables.push({ identite: id, raison: erreur.message });
      continue;
    }
    valeurs.set(id, valeur);
  }
  nonComparables.sort((a, b) => comparerCodes(a.identite, b.identite));

  // Relation entre deux extrémités comparables : l'égalité typée de decrireValeursObservees (un seul groupe = même valeur).
  const relation = (depart, arrivee) => {
    if (!valeurs.has(depart) || !valeurs.has(arrivee)) return 'non_comparable';
    const { nombreValeurs } = decrireValeursObservees([{ id: 'a', valeur: valeurs.get(depart) }, { id: 'b', valeur: valeurs.get(arrivee) }]);
    return nombreValeurs === 1 ? 'egale' : 'differente';
  };

  // 4. Tous les chemins simples de chaque ancêtre vers chaque descendant : un épisode par chemin.
  const episodes = [];
  const etape = (de, vers) => {
    const arete = aretes.get(`${de}\u0000${vers}`);
    return { de, execution: arete.execution, operation: arete.operation, entrees: [...arete.entrees].sort(comparerCodes), vers };
  };
  for (const arrivee of ordre) {
    const ascendance = ascendances.get(arrivee);
    if (ascendance.size === 0) continue;
    const trouves = []; // [suite d'identités, du départ à l'arrivée]
    const enCours = [arrivee];
    const dans = new Set([arrivee]);
    const explorer = (courant) => {
      for (const p of parentsTries.get(courant)) {
        if (dans.has(p)) continue;
        trouves.push([p, ...enCours.slice().reverse()]);
        enCours.push(p);
        dans.add(p);
        explorer(p);
        dans.delete(p);
        enCours.pop();
      }
    };
    explorer(arrivee);
    for (const suite of trouves) {
      const depart = suite[0];
      const relationValeur = relation(depart, arrivee);
      const episode = { depart, arrivee, chemin: suite.slice(1).map((vers, i) => etape(suite[i], vers)), relationValeur };
      if (relationValeur !== 'non_comparable') episode.valeurs = { depart: valeurs.get(depart), arrivee: valeurs.get(arrivee) };
      episodes.push(episode);
    }
  }
  episodes.sort((x, y) => comparerCodes(x.depart, y.depart) || comparerCodes(x.arrivee, y.arrivee)
    || comparerCodes(x.chemin.map((e) => e.vers).join('\u0000'), y.chemin.map((e) => e.vers).join('\u0000')));
  return { episodes, nonComparables, nombreDescendances };
}
// === FIN_LANGAGE_EPISODES_DE_TRANSFORMATION ===
