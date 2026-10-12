// === DEBUT_LANGAGE_CO_COUVERTURES ===
// v0.63.95 — « RELATION DE CO-COUVERTURE ENTRE POSITIONS » (décision ChatGPT « DÉCISION MINI-DESIGN CO-COUVERTURES », 12/10/2026 ; issue des
// sondes « que comprend Naissance d'un échange ? » et du mini-design du même jour). VUE PURE, SYNCHRONE, DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question, sur les épisodes d'UNE famille (épisodes de même structure, sortie de la vue des familles) :
//
//   « quels constats à valeur, observés à des chemins différents, sont portés par EXACTEMENT les mêmes épisodes ? »
//
// SENS CONTRACTUEL, ET RIEN D'AUTRE : « dans les épisodes observés de cette famille, les épisodes portant X au chemin A sont exactement ceux
// portant Y au chemin B ». Relation SYMÉTRIQUE, DESCRIPTIVE, HISTORIQUE. Elle ne dit PAS que X cause Y, que X annonce Y, que Y convient à X,
// que X et Y ont un même sens, que la relation se reproduira, qu'elle est préférable, ni qu'elle est sûre ou probable.
//
// coCouverturesParChemins(episodes) -> { universelle, classes }
//   episodes : tableau d'épisodes { depart, arrivee, chemin: [{ …, vers }], … } (une famille). Identité d'un épisode = identiteEpisode
//     (identite-episode.js, la MÊME que celle des contextes prospectifs) : [depart, arrivee, …vers]. Deux occurrences d'un même échange sont
//     deux épisodes, donc deux témoins.
//   Les constats sont ceux de constatsParChemin (UN appel, éléments { chemin: identité, contenu: épisode }) : même parcours, même égalité
//     (même type ET Object.is : 7 ≠ "7"), mêmes couvertures canoniques. Rien n'est reparcouru ni recomparé ici.
//   universelle : couverture canonique de tous les épisodes (copie).
//   classes : [{ couverture, constats: [{ chemin, type, valeur }] }] — une classe par couverture portée par AU MOINS DEUX constats retenus,
//     de chemins distincts. La couverture peut être d'un seul épisode : elle est conservée telle quelle (aucun seuil, aucun comptage, aucune
//     confiance ; la couverture dit elle-même combien d'épisodes portent la relation).
//
// CONSTATS RETENUS (restrictions de DÉFINITION, aucune liste de champs, de préfixes ni de noms) :
//   R0 — seuls les constats qui portent une valeur scalaire (le producteur ne donne `valeur` qu'aux chaînes, nombres, booléens) ; conteneurs
//        et nul restent hors relation.
//   R1 — jamais un chemin avec lui-même : à un chemin, un épisode porte au plus un constat, donc deux constats d'un même chemin ont des
//        couvertures disjointes ; une classe exige en outre des chemins distincts (vérifié).
//   R2 — exclu : un constat porté par TOUS les épisodes (couverture = universelle). Il ne distingue aucun épisode ; c'est déjà le constat
//        universel existant.
//   R3 — exclu : un constat dont la valeur est un SEGMENT de l'identité de CHACUN des épisodes de sa couverture (égalité stricte ===). C'est
//        l'identité de l'épisode lue à une position, pas une observation sur l'épisode. Critère structurel, tiré de la couverture elle-même.
//   Regroupement : égalité EXACTE des couvertures (couvertures canoniques de normaliserCouverture, comparées par leur sérialisation JSON,
//   qui distingue segments chaîne et entiers). Ni inclusion, ni intersection.
//
// ORDRE : déterministe (classes dans l'ordre des codes de leur sérialisation ; constats dans l'ordre de constatsParChemin), et SANS AUCUNE
// SIGNIFICATION. Aucun lecteur ne doit utiliser la première ou la dernière classe, un index ou un ordre d'insertion comme critère : seul
// l'ENSEMBLE des classes (couverture + constats) est un fait.
// ERREURS : episodes non tableau, épisode non objet ou sans tableau `chemin` : TypeError ; ensuite exactement celles du producteur
// (identité dupliquée, contenu hors domaine). Aucun résultat partiel. [] -> { universelle: [], classes: [] }.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sortie entièrement neuve.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce module (gardé par test statique). Aucun comportement ne change.
import { constatsParChemin } from './constats-par-chemin.js';
import { memesCouvertures } from './couverture-occurrences.js';
import { identiteEpisode } from './identite-episode.js';

const NOM = 'coCouverturesParChemins';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function coCouverturesParChemins(episodes) {
  if (!Array.isArray(episodes)) refuser('episodes doit être un tableau');
  const elements = [];
  for (let rang = 0; rang < episodes.length; rang += 1) {
    const episode = episodes[rang];
    if (episode === null || typeof episode !== 'object' || Array.isArray(episode)) refuser(`episodes[${rang}] doit être un objet`);
    if (!Array.isArray(episode.chemin)) refuser(`episodes[${rang}].chemin doit être un tableau`);
    elements.push({ chemin: identiteEpisode(episode), contenu: episode });
  }
  const histoire = constatsParChemin(elements);
  const parCouverture = new Map();
  for (const entree of histoire.chemins) {
    for (const constat of entree.constats) {
      if (!Object.hasOwn(constat, 'valeur')) continue; // R0
      if (memesCouvertures(constat.couverture, histoire.universelle)) continue; // R2
      if (constat.couverture.every((temoin) => temoin.some((segment) => segment === constat.valeur))) continue; // R3
      const cle = JSON.stringify(constat.couverture);
      if (!parCouverture.has(cle)) parCouverture.set(cle, { couverture: constat.couverture, constats: [] });
      parCouverture.get(cle).constats.push({ chemin: structuredClone(entree.chemin), type: constat.type, valeur: constat.valeur });
    }
  }
  const classes = [];
  for (const cle of [...parCouverture.keys()].sort(comparerCodes)) {
    const { couverture, constats } = parCouverture.get(cle);
    const chemins = new Set(constats.map((c) => JSON.stringify(c.chemin)));
    if (constats.length < 2 || chemins.size !== constats.length) continue; // R1 : au moins deux constats, chemins distincts
    classes.push({ couverture: structuredClone(couverture), constats });
  }
  return { universelle: structuredClone(histoire.universelle), classes };
}
// === FIN_LANGAGE_CO_COUVERTURES ===
