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
//     MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D'ÉPISODE (décision ChatGPT « DÉCISION APRÈS SONDE PARTIE CONNUE », 12/10/2026) :
//     la présence de la valeur observée à une extrémité ne dépend plus que de CETTE extrémité. valeurs.depart existe si le départ est
//     comparable ; valeurs.arrivee si l'arrivée l'est ; les deux si les deux le sont (identique à avant) ; `valeurs` absent si aucun ne l'est.
//     Aucune inférence nouvelle : les mêmes valeurs, déjà résolues, décrites fidèlement. relationValeur STRICTEMENT inchangée (egale /
//     differente seulement si les deux bouts sont comparables, non_comparable sinon). Le schéma n'est pas étendu : aucune valeur
//     intermédiaire, aucune décomposition d'une collection ou d'un objet (non comparables : jamais sous `valeurs`), aucune métadonnée.
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

// v0.63.98 — résolution des valeurs comparables (mécanismes existants : resoudreIdentitesDonnees + valeurDePorteur ; comparable = accepté par
// decrireValeursObservees). Une identité inconnue : l'erreur de resoudreIdentitesDonnees, propagée telle quelle. `retenir` choisit les
// identités dont la valeur est conservée (les autres sont résolues, donc validées, mais ignorées).
function resoudreValeursComparables(identites, retenir, lignesValeurs, lignesExecutions, descriptions) {
  const resolues = resoudreIdentitesDonnees(identites, lignesValeurs, lignesExecutions, descriptions);
  const valeurs = new Map();
  const nonComparables = [];
  for (const r of resolues) {
    const id = r.donnee.identite;
    if (!retenir(id)) continue;
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
  return { valeurs, nonComparables };
}

// Relation entre deux extrémités : l'égalité typée de decrireValeursObservees (un seul groupe = même valeur) ; non_comparable si l'une ne l'est pas.
function relationEntre(valeurs, depart, arrivee) {
  if (!valeurs.has(depart) || !valeurs.has(arrivee)) return 'non_comparable';
  const { nombreValeurs } = decrireValeursObservees([{ id: 'a', valeur: valeurs.get(depart) }, { id: 'b', valeur: valeurs.get(arrivee) }]);
  return nombreValeurs === 1 ? 'egale' : 'differente';
}

// v0.63.97 — `valeurs` d'un épisode : chaque extrémité donnée [clé, identité] dont la valeur est comparable ; null si aucune.
function valeursDesExtremites(valeurs, extremites) {
  const objet = {};
  for (const [cle, id] of extremites) if (valeurs.has(id)) objet[cle] = valeurs.get(id);
  return Object.keys(objet).length > 0 ? objet : null;
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
  // v0.63.98 : résolution et relation factorisées (resoudreValeursComparables, relationEntre), partagées avec partieConnueEpisode ; comportement identique.
  const { valeurs, nonComparables } = resoudreValeursComparables(ordre, (id) => impliquees.has(id), lignesValeurs, lignesExecutions, descriptions);
  const relation = (depart, arrivee) => relationEntre(valeurs, depart, arrivee);

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
      // v0.63.97 : chaque extrémité comparable porte sa valeur, indépendamment de l'autre ; ordre des clés inchangé (depart puis arrivee).
      const valeursEpisode = valeursDesExtremites(valeurs, [['depart', depart], ['arrivee', arrivee]]);
      if (valeursEpisode !== null) episode.valeurs = valeursEpisode;
      episodes.push(episode);
    }
  }
  episodes.sort((x, y) => comparerCodes(x.depart, y.depart) || comparerCodes(x.arrivee, y.arrivee)
    || comparerCodes(x.chemin.map((e) => e.vers).join('\u0000'), y.chemin.map((e) => e.vers).join('\u0000')));
  return { episodes, nonComparables, nombreDescendances };
}

// v0.63.98 — PARTIE CONNUE D'UN ÉPISODE (décision ChatGPT « AUTORISATION DE CODER L'ÉTAPE PARTIE CONNUE D'UN ÉPISODE », 12/10/2026). VUE PURE,
// SYNCHRONE, DÉTERMINISTE, DORMANTE (aucun mécanisme du dépôt ne l'importe ; gardé par test).
//
// partieConnueEpisode(episodePartiel, lignesValeurs, lignesExecutions, descriptions) -> objet du SCHÉMA D'ÉPISODE (v0.63.97), incomplet :
//   uniquement ce qui est déterminé par episodePartiel et par les valeurs persistées de ses EXTRÉMITÉS CONNUES ; rien n'est supposé.
//   - depart : l'identité (obligatoire, chaîne non vide) ;
//   - arrivee : seulement si episodePartiel la porte déjà (chaîne non vide) ; sinon ABSENTE — inconnue n'est pas non comparable ;
//   - chemin : copie exacte des étapes de episodePartiel, telles quelles (une étape partielle reste partielle : ni execution ni vers inventés) ;
//   - relationValeur : seulement si les DEUX extrémités sont connues, par la règle normale de l'épisode (relationEntre) ; sinon ABSENTE ;
//   - valeurs : la règle de v0.63.97 appliquée aux seules extrémités CONNUES (valeur résolue et comparable) ; absent si aucune.
//   Les identités intermédiaires du chemin restent des identités : aucune valeur intermédiaire, aucune extension du schéma.
//   Ordre des clés : celui de l'épisode complet (depart, arrivee, chemin, relationValeur, valeurs).
//   Résolution : resoudreValeursComparables (la MÊME que la vue complète) ; une identité non résoluble lève la même erreur. Aucune lecture
//   d'issue ni d'exécution future : même episodePartiel ⇒ même résultat, quoi qu'il arrive ensuite (les valeurs persistées sont immuables).
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sortie neuve.
const NOM_PARTIE = 'partieConnueEpisode';
function refuserPartie(raison) {
  throw new TypeError(`${NOM_PARTIE} : ${raison}.`);
}
export function partieConnueEpisode(episodePartiel, lignesValeurs, lignesExecutions, descriptions) {
  if (episodePartiel === null || typeof episodePartiel !== 'object' || Array.isArray(episodePartiel)) refuserPartie('episodePartiel doit être un objet');
  const lire = (champ) => { const place = Object.getOwnPropertyDescriptor(episodePartiel, champ); if (place !== undefined && !('value' in place)) refuserPartie(`episodePartiel.${champ} est un accesseur : une donnée est attendue`); return place; };
  const placeDepart = lire('depart');
  if (placeDepart === undefined || typeof placeDepart.value !== 'string' || placeDepart.value.length === 0) refuserPartie('episodePartiel.depart doit être une chaîne non vide');
  const placeChemin = lire('chemin');
  if (placeChemin === undefined || !Array.isArray(placeChemin.value)) refuserPartie('episodePartiel.chemin doit être un tableau');
  const placeArrivee = lire('arrivee');
  if (placeArrivee !== undefined && (typeof placeArrivee.value !== 'string' || placeArrivee.value.length === 0)) refuserPartie('episodePartiel.arrivee, si présente, doit être une chaîne non vide');
  exigerTableau(lignesValeurs, 'lignesValeurs');
  exigerTableau(lignesExecutions, 'lignesExecutions');
  exigerTableau(descriptions, 'descriptions');
  const depart = placeDepart.value;
  const arrivee = placeArrivee === undefined ? null : placeArrivee.value;
  const connues = arrivee === null ? [depart] : [...new Set([depart, arrivee])];
  const { valeurs } = resoudreValeursComparables(connues, () => true, lignesValeurs, lignesExecutions, descriptions);
  const partie = { depart };
  if (arrivee !== null) partie.arrivee = arrivee;
  partie.chemin = structuredClone(placeChemin.value);
  if (arrivee !== null) partie.relationValeur = relationEntre(valeurs, depart, arrivee);
  const valeursPartie = valeursDesExtremites(valeurs, arrivee === null ? [['depart', depart]] : [['depart', depart], ['arrivee', arrivee]]);
  if (valeursPartie !== null) partie.valeurs = valeursPartie;
  return partie;
}
// === FIN_LANGAGE_EPISODES_DE_TRANSFORMATION ===
