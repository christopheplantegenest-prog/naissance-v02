// === DEBUT_LANGAGE_CONTEXTE_PROSPECTIF ===
// v0.63.72 — « PERSISTER CE QUI ÉTAIT ENVISAGEABLE AVANT L'ISSUE » (décision ChatGPT, 07/10/2026). CALCUL PUR, SYNCHRONE, DÉTERMINISTE.
// Il répond à UNE seule question, posée AVANT qu'une application soit exécutée :
//
//   « si cette application concrète était exécutée, quels épisodes prolongerait-elle (ou ouvrirait-elle), et que contenaient mes
//     expériences passées de même structure aux endroits de ces épisodes qui sont encore inconnus ? »
//
// NOM : « contexte prospectif ». « Contexte » au sens déjà en usage dans le dépôt (contexte d'observation, contexte de sollicitation : ce qui est rassemblé autour d'un
// moment vécu) ; « prospectif » : rassemblé avant l'issue. Le nom ne dit ni attente, ni hypothèse, ni prédiction : il décrit un contenu.
//
// contextesProspectifs(application, lignesValeurs, lignesExecutions, descriptions) -> [contexte]  (UN contexte par PROJECTION)
//   application : { operation, liaisons } concrète (liaisons { entree, donnee } ou { entree, donnees:[…] }), telle qu'elle existe avant
//     exécution (application déterminée, candidate, ou sollicitée). Rien d'autre n'est lu de l'application.
//   lignesValeurs / lignesExecutions / descriptions : exactement les arguments de episodesDeTransformation : le passé tel qu'il existe à
//     cet instant. Aucune opération n'est invoquée, aucun résultat n'est lu ni simulé.
//
// PROJECTION (règle vérifiée 33/33 contre les épisodes réels, diagnostic du 07/10) : pour chaque DONNÉE liée D (chaque identité d'une
// liaison, collective comprise), avec E(D) = ensemble des noms d'entrées par lesquels D entre dans l'application :
//   - une projection DIRECTE : structure [{ operation, entrees: E(D) }], sans épisode parent (D sera le départ) ;
//   - une projection de PROLONGEMENT par épisode P existant dont l'arrivée est D : structure(P) + { operation, entrees: E(D) }.
//   Les lignées ne sont jamais fusionnées : plusieurs parents, plusieurs projections ; même histoire, deux ancrages = deux contextes.
//
// CONTEXTE = { application, donnee, parent, structure, episodePartiel, temoins, chemins }
//   application : copie canonique { operation, liaisons } ; donnee : l'identité liée D ; parent : null (directe) ou copie de l'épisode P
//     (depart, arrivee, chemin, relationValeur[, valeurs]) ; structure : [{ operation, entrees }] au format exact de famille.structure.
//   episodePartiel : ce qui est DÉJÀ connu du futur épisode, et rien d'autre — { depart, chemin } où le dernier élément de chemin est
//     { de, operation, entrees } SANS execution ni vers ; aucune arrivee, aucune relationValeur, aucune valeurs. Aucun substitut, aucun
//     champ vide : une propriété absente est une propriété inconnue.
//   temoins : la couverture universelle de la famille vécue de même structure (identités réelles de ses épisodes : [depart, arrivee, …vers]),
//     [] si aucune expérience de cette structure n'existe (la trace existe alors et dit « jamais vécue » ; ce n'est pas « non calculée »).
//   chemins : les chemins OUVERTS de l'histoire : les chemins de propriété de constatsParChemin(famille) que l'épisode partiel ne possède
//     PAS (règle générale par parcourirStructure + égalité de chemins de couverture-occurrences : aucun nom de champ) ; pour chacun, TOUS
//     les constats historiques { type, valeur?, couverture } et la couverture du chemin — conteneurs sans valeur, couvertures partielles
//     et identités conservés tels quels. Aucun vote, majorité, seuil, score, confiance, sélection, qualificatif.
// ORDRE : projections par donnée liée (unités de code) puis directe avant prolongements (ordre des épisodes de episodesDeTransformation) ;
// déterministe. Les trois lectures d'une confrontation future (rejoint / autre constat / chemin absent / type différent) restent possibles
// à partir de la trace seule ; la confrontation elle-même n'est PAS codée ici.
// ERREURS : application mal formée → TypeError ; les autres erreurs sont celles des vues composées (aucun résultat partiel).
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
// Ce module ne connaît aucun nom d'opération ni de champ d'épisode : il compose episodesDeTransformation, famillesDEpisodes,
// constatsParChemin, parcourirStructure et l'égalité de chemins.
import { episodesDeTransformation } from './episodes-de-transformation.js';
import { famillesDEpisodes } from './familles-episodes.js';
import { constatsParChemin } from './constats-par-chemin.js';
import { parcourirStructure } from './parcours-structure.js';
import { memesCouvertures } from './couverture-occurrences.js';

const NOM = 'contextesProspectifs';

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

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

// Copie canonique de l'application : liaisons triées par entree, identités collectives triées ; aucune autre clé.
function copierApplication(application) {
  if (application === null || typeof application !== 'object' || Array.isArray(application)) refuser('application doit être un objet');
  const operation = chaineNonVide(lirePropre(application, 'operation', 'application'), 'application.operation');
  const brutes = lirePropre(application, 'liaisons', 'application');
  if (!Array.isArray(brutes) || brutes.length === 0) refuser('application.liaisons doit être un tableau non vide');
  const liaisons = brutes.map((brute, rang) => {
    const nom = `application.liaisons[${rang}]`;
    if (brute === null || typeof brute !== 'object' || Array.isArray(brute)) refuser(`${nom} doit être un objet`);
    const entree = chaineNonVide(lirePropre(brute, 'entree', nom), `${nom}.entree`);
    if (Object.hasOwn(brute, 'donnees')) {
      const ids = lirePropre(brute, 'donnees', nom);
      if (!Array.isArray(ids) || ids.length === 0) refuser(`${nom}.donnees doit être un tableau non vide`);
      const donnees = ids.map((id, k) => chaineNonVide(id, `${nom}.donnees[${k}]`)).sort(comparerCodes);
      if (new Set(donnees).size !== donnees.length) refuser(`${nom}.donnees contient une identité dupliquée`);
      return { entree, donnees };
    }
    return { entree, donnee: chaineNonVide(lirePropre(brute, 'donnee', nom), `${nom}.donnee`) };
  }).sort((a, b) => comparerCodes(a.entree, b.entree));
  for (let i = 1; i < liaisons.length; i += 1) if (liaisons[i].entree === liaisons[i - 1].entree) refuser('application.liaisons contient une entrée dupliquée');
  return { operation, liaisons };
}

const copierEtape = (etape) => ({ de: etape.de, execution: etape.execution, operation: etape.operation, entrees: [...etape.entrees], vers: etape.vers });
const copierEpisode = (episode) => structuredClone(episode); // copie structurelle complète : ce module ne connaît pas les champs d'un épisode
const structureDe = (etapes) => etapes.map((e) => ({ operation: e.operation, entrees: [...e.entrees] }));
const memeStructure = (a, b) => a.length === b.length && a.every((e, i) => e.operation === b[i].operation && e.entrees.length === b[i].entrees.length && e.entrees.every((x, k) => x === b[i].entrees[k]));
const identiteEpisode = (episode) => [episode.depart, episode.arrivee, ...episode.chemin.map((e) => e.vers)];

export function contextesProspectifs(application, lignesValeurs, lignesExecutions, descriptions) {
  const propre = copierApplication(application);
  const { episodes } = episodesDeTransformation(lignesValeurs, lignesExecutions, descriptions);
  const { familles } = famillesDEpisodes(episodes);

  // 1. Données liées et rôles empruntés par chacune.
  const roles = new Map(); // donnee -> Set(entree)
  for (const liaison of propre.liaisons) {
    for (const donnee of Object.hasOwn(liaison, 'donnees') ? liaison.donnees : [liaison.donnee]) {
      if (!roles.has(donnee)) roles.set(donnee, new Set());
      roles.get(donnee).add(liaison.entree);
    }
  }

  // 2. Une projection par donnée (directe) et par épisode parent dont la donnée est l'arrivée.
  const contextes = [];
  for (const donnee of [...roles.keys()].sort(comparerCodes)) {
    const etape = { operation: propre.operation, entrees: [...roles.get(donnee)].sort(comparerCodes) };
    const projections = [{ parent: null, structure: [etape], episodePartiel: { depart: donnee, chemin: [{ de: donnee, ...etape }] } }];
    for (const parent of episodes.filter((e) => e.arrivee === donnee)) {
      projections.push({
        parent: copierEpisode(parent),
        structure: [...structureDe(parent.chemin), etape],
        episodePartiel: { depart: parent.depart, chemin: [...parent.chemin.map(copierEtape), { de: donnee, ...etape }] },
      });
    }
    for (const projection of projections) {
      // 3. Histoire : la famille vécue de même structure, si elle existe.
      const famille = familles.find((f) => memeStructure(f.structure, projection.structure));
      let temoins = [];
      let chemins = [];
      if (famille !== undefined) {
        const histoire = constatsParChemin(famille.episodes.map((e) => ({ chemin: identiteEpisode(e), contenu: e })));
        temoins = histoire.universelle;
        // 4. Chemins ouverts : ceux que l'épisode partiel ne possède pas encore (aucun nom de champ).
        const connus = parcourirStructure(projection.episodePartiel).map((o) => o.chemin);
        chemins = histoire.chemins.filter((c) => !connus.some((k) => memesCouvertures([k], [c.chemin])));
      }
      contextes.push({
        application: { operation: propre.operation, liaisons: propre.liaisons.map((l) => (Object.hasOwn(l, 'donnees') ? { entree: l.entree, donnees: [...l.donnees] } : { ...l })) },
        donnee,
        parent: projection.parent,
        structure: projection.structure.map((e) => ({ operation: e.operation, entrees: [...e.entrees] })),
        episodePartiel: projection.episodePartiel,
        temoins,
        chemins,
      });
    }
  }
  return contextes;
}
// === FIN_LANGAGE_CONTEXTE_PROSPECTIF ===
