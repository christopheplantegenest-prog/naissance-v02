// === DEBUT_LANGAGE_RETOURS_DE_VALEUR ===
// v0.63.68 — « OBSERVER UN RETOUR DE VALEUR DANS UNE CHAÎNE DE PRODUCTIONS » (décision ChatGPT, 07/10/2026). VUE PURE, SYNCHRONE, DORMANTE.
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
import { resoudreIdentitesDonnees } from './resoudre-identites.js';
import { entreesDeProduction } from './entrees-production.js';
import { indexSousDonnees } from './sous-donnees.js';
import { decrireValeursObservees } from './valeurs-observees.js';
import { valeurDePorteur } from './acces-valeur.js';

const NOM = 'retoursDeValeur';

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

export function retoursDeValeur(lignesValeurs, lignesExecutions, descriptions) {
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

  // 2. Ascendances (fermeture transitive, ensemble visité, sans soi-même).
  const ascendances = new Map();
  for (const id of ordre) {
    const vus = new Set();
    const pile = [...(parents.get(id) ?? [])];
    while (pile.length > 0) {
      const courant = pile.pop();
      if (vus.has(courant)) continue;
      vus.add(courant);
      for (const p of parents.get(courant) ?? []) if (!vus.has(p)) pile.push(p);
    }
    vus.delete(id);
    ascendances.set(id, vus);
  }
  let nombreDescendances = 0;
  for (const asc of ascendances.values()) nombreDescendances += asc.size;

  // 3. Valeurs : mécanismes existants. Comparable = accepté par decrireValeursObservees.
  const resolues = resoudreIdentitesDonnees(ordre, lignesValeurs, lignesExecutions, descriptions);
  const valeurs = new Map();
  const impliquees = new Set();
  for (const [id, asc] of ascendances) {
    if (asc.size > 0) impliquees.add(id);
    for (const a of asc) impliquees.add(a);
  }
  const comparables = [];
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
    comparables.push({ id, valeur });
  }
  nonComparables.sort((a, b) => comparerCodes(a.identite, b.identite));

  // 4. Couples de même valeur, identités différentes, avec descendance.
  const { valeurs: groupes } = decrireValeursObservees(comparables);
  const couples = [];
  for (const groupe of groupes) {
    for (const a of groupe.ids) for (const d of groupe.ids) if (a !== d && ascendances.get(d).has(a)) couples.push([a, d]);
  }
  couples.sort((x, y) => comparerCodes(x[0], y[0]) || comparerCodes(x[1], y[1]));

  // 5. Chemins simples de l'ancêtre au descendant (tous conservés).
  const cheminsDe = (ancetre, descendant) => {
    const trouves = [];
    const enCours = [descendant];
    const dans = new Set([descendant]);
    const explorer = (courant) => {
      for (const p of [...(parents.get(courant) ?? [])].sort(comparerCodes)) {
        if (dans.has(p)) continue;
        if (p === ancetre) {
          trouves.push([ancetre, ...enCours.slice().reverse()]);
        } else if (ascendances.get(p).has(ancetre)) {
          enCours.push(p);
          dans.add(p);
          explorer(p);
          dans.delete(p);
          enCours.pop();
        }
      }
    };
    explorer(descendant);
    return trouves
      .sort((x, y) => comparerCodes(x.join('\u0000'), y.join('\u0000')))
      .map((suite) => suite.slice(1).map((vers, i) => {
        const de = suite[i];
        const arete = aretes.get(`${de}\u0000${vers}`);
        return { de, execution: arete.execution, operation: arete.operation, entrees: [...arete.entrees].sort(comparerCodes), vers };
      }));
  };
  const retours = couples.map(([ancetre, descendant]) => ({ ancetre, descendant, valeur: valeurs.get(ancetre), chemins: cheminsDe(ancetre, descendant) }));
  return { retours, nonComparables, nombreDescendances };
}
// === FIN_LANGAGE_RETOURS_DE_VALEUR ===
