// === DEBUT_LANGAGE_FAMILLES_EPISODES ===
// v0.63.70 — « OBSERVER LES FAMILLES D'ÉPISODES DE TRANSFORMATION » (décision ChatGPT, 07/10/2026). VUE PURE, SYNCHRONE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « parmi des épisodes de transformation déjà constatés, lesquels ont suivi la MÊME STRUCTURE de chemin ? »
//
// famillesDEpisodes(sortieEpisodes) -> { familles }
//   sortieEpisodes : la sortie de episodesDeTransformation (objet portant `episodes`), ou directement son tableau `episodes`. Seul le champ
//   `episodes` est lu ; nonComparables et nombreDescendances sont ignorés. La vue ne reconstruit RIEN : ni graphe, ni descendance, ni valeur,
//   ni chemin, ni exécution ; elle ne lit ni catalogue (aucune forme), ni magasin, ni ligne d'exécution.
//
// FAMILLE = STRUCTURE DE CHEMIN. La structure d'un épisode est la suite ordonnée de ses étapes réduites à { operation, entrees } :
//   - operation : le nom persisté de l'opération de l'étape (fait historique, jamais interprété) ;
//   - entrees : les noms d'entrées par lesquels la donnée est RÉELLEMENT entrée dans l'exécution, en représentation canonique : tableau
//     dense trié en unités de code, sans doublon (['a','b'] et ['b','a'] sont la même étape : l'ordre des noms d'entrée n'a aucune
//     sémantique ; ['a'] et ['a','b'] sont deux étapes différentes : le fait « entrée par a ET par b » est préservé).
//   Ne participent PAS à la famille : depart, arrivee, de, vers, execution (identités), les valeurs, relationValeur, les formes.
//   relationValeur hors identité est voulu : une même famille peut contenir des épisodes 'egale', 'differente' et 'non_comparable' côte à
//   côte ; rien ne les sépare, rien ne les compte, rien ne les qualifie.
//   Deux structures sont identiques si elles ont le même nombre d'étapes et, rang par rang, même operation et mêmes entrees canoniques.
//   Un préfixe commun (op1>op2 et op1>op2>op3) donne DEUX familles : aucune hiérarchie, aucune relation entre familles. Une étape unique est
//   une famille comme une autre.
//
// SORTIE : familles : [{ structure, episodes }]
//   - structure : [{ operation, entrees }] (objets neufs, entrees copie canonique) — c'est l'identité de la famille ; aucun identifiant
//     séparé n'est créé (la structure canonique est déjà déterministe et comparable par égalité structurelle) ;
//   - episodes : les épisodes MÊMES (mêmes références que l'entrée, jamais copiés ni modifiés), chacun retrouvable individuellement ;
//     deux épisodes de même structure, mêmes valeurs et même relation restent deux épisodes (deux expériences distinctes).
//   ORDRE DÉTERMINISTE, indépendant de l'ordre reçu : familles triées par structure (nombre d'étapes, puis rang par rang operation puis
//   entrees, en unités de code) ; épisodes d'une famille triés par (depart, arrivee, suite des identités `vers` du chemin), tri stable.
//   Aucun compteur, confirmation, contradiction, confiance, fréquence, règle, attente, préférence : la vue regroupe, elle n'interprète pas.
//
// CONTRAT D'ENTRÉE : chaque épisode doit être un objet dont `chemin` est un tableau dense non vide d'étapes { operation: chaîne non vide,
// entrees: tableau dense non vide de chaînes non vides } ; depart et arrivee chaînes non vides (pour le tri). Sinon TypeError, aucun
// résultat partiel. Les autres champs ne sont pas lus.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état global, aucune mutation (entrées gelées acceptées).
// NON BRANCHÉ : aucun fichier du dépôt n'importe ce module (gardé par un test statique).
const NOM = 'famillesDEpisodes';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function lirePropre(objet, champ, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${nom}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${nom}[${rang}] est un accesseur : une donnée est attendue`);
  return place.value;
}

function exigerObjet(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) refuser(`${nom} doit être un objet`);
}

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

// Structure canonique d'un épisode : [{ operation, entrees triées sans doublon }].
function structureDe(episode, nom) {
  exigerObjet(episode, nom);
  chaineNonVide(lirePropre(episode, 'depart', nom), `${nom}.depart`);
  chaineNonVide(lirePropre(episode, 'arrivee', nom), `${nom}.arrivee`);
  const chemin = lirePropre(episode, 'chemin', nom);
  if (!Array.isArray(chemin) || chemin.length === 0) refuser(`${nom}.chemin doit être un tableau non vide`);
  const structure = [];
  for (let rang = 0; rang < chemin.length; rang += 1) {
    const etape = lireRang(chemin, rang, `${nom}.chemin`);
    const nomEtape = `${nom}.chemin[${rang}]`;
    exigerObjet(etape, nomEtape);
    const operation = chaineNonVide(lirePropre(etape, 'operation', nomEtape), `${nomEtape}.operation`);
    chaineNonVide(lirePropre(etape, 'vers', nomEtape), `${nomEtape}.vers`);
    const brutes = lirePropre(etape, 'entrees', nomEtape);
    if (!Array.isArray(brutes) || brutes.length === 0) refuser(`${nomEtape}.entrees doit être un tableau non vide`);
    const entrees = [];
    for (let k = 0; k < brutes.length; k += 1) entrees.push(chaineNonVide(lireRang(brutes, k, `${nomEtape}.entrees`), `${nomEtape}.entrees[${k}]`));
    structure.push({ operation, entrees: [...new Set(entrees)].sort(comparerCodes) });
  }
  return structure;
}

// Clé textuelle de tri/regroupement : longueur puis, rang par rang, operation puis entrees (unités de code ; séparateurs U+0000/U+0001).
const cleDe = (structure) => structure.map((e) => `${e.operation}\u0001${e.entrees.join('\u0001')}`).join('\u0000');
const cleEpisode = (episode) => `${episode.depart}\u0000${episode.arrivee}\u0000${episode.chemin.map((e) => e.vers).join('\u0001')}`;

export function famillesDEpisodes(sortieEpisodes) {
  let episodes;
  if (Array.isArray(sortieEpisodes)) episodes = sortieEpisodes;
  else {
    exigerObjet(sortieEpisodes, 'sortieEpisodes');
    episodes = lirePropre(sortieEpisodes, 'episodes', 'sortieEpisodes');
    if (!Array.isArray(episodes)) refuser('sortieEpisodes.episodes doit être un tableau');
  }
  const parCle = new Map(); // clé -> { structure, episodes:[{ episode, cle }] }
  for (let rang = 0; rang < episodes.length; rang += 1) {
    const episode = lireRang(episodes, rang, 'episodes');
    const structure = structureDe(episode, `episodes[${rang}]`);
    const cle = cleDe(structure);
    if (!parCle.has(cle)) parCle.set(cle, { structure, episodes: [] });
    parCle.get(cle).episodes.push({ episode, cle: cleEpisode(episode) });
  }
  const familles = [...parCle.entries()]
    .sort(([a, fa], [b, fb]) => fa.structure.length - fb.structure.length || comparerCodes(a, b))
    .map(([, famille]) => ({
      structure: famille.structure,
      episodes: famille.episodes.slice().sort((x, y) => comparerCodes(x.cle, y.cle)).map((x) => x.episode),
    }));
  return { familles };
}
// === FIN_LANGAGE_FAMILLES_EPISODES ===
