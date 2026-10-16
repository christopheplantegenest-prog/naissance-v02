// === DEBUT_LANGAGE_ISSUE_RETROUVAILLE ===
// v0.64.33 — « CONFRONTER UNE RELATION RETROUVÉE À CE QUI EST ARRIVÉ » (GO ChatGPT « GO DÉVELOPPEMENT v0.64.33 », 16/10/2026 ; diagnostic
// pré-v0.64.33 approuvé). VUE PURE, SYNCHRONE, DÉTERMINISTE : une RELECTURE ACTUELLE, jamais persistée.
//
// QUESTION UNIQUE, posée APRÈS coup pour UN contexte prospectif persisté :
//   « la relation retrouvée à T2 (groupe `retrouvaille` figé dans la ligne de contexte, statut 'retrouvee') : qu'est-il advenu, dans ce que ce
//     MÊME acte a réellement produit, aux chemins de son attendu ? »
// SOURCE : contexte.retrouvaille, et JAMAIS une attente : la confrontation existe même quand aucune attente ne porte R (cas T4). La relation
// est la copie persistée à T2, relue par validerRetrouvaille ; elle n'est jamais recalculée. Ses formulations ne sont pas lues.
//
// confronterRetrouvaille(contexte, vecu) -> sortie
//   contexte : UNE ligne persistée de contextesProspectifs ; vecu : { valeurs, executions, descriptions } — le vécu ACTUEL (sortie de
//   lireExecutionsVecues : faits persistés + projections soi / environnements). La vue des épisodes n'est calculée que si une relation est
//   à confronter (episodesDeTransformation, puis issuesDuContexteProspectifSurVue).
//   sortie = { idContexte, t2: { statut[, relation] }, aujourdhui }
//     t2 : ce qui avait été retrouvé, COPIÉ du groupe persisté (relation seulement si statut 'retrouvee').
//     aujourdhui :
//       statut ≠ 'retrouvee' (aucune, abstention, non-effectuee) → { confrontation: 'aucune-relation-unique' } : RIEN n'est confronté. En
//         abstention, les relations copiées ne sont jamais confrontées : aucune n'est désignée après coup, l'incertitude de T2 reste entière.
//       statut 'retrouvee' → { issues: [issue] } — une par conséquence vécue de l'acte (issuesDuContexteProspectifSurVue), ordre sans
//         signification ; issues [] = RIEN ENCORE (aucune conséquence observable pour le moment : aucune conclusion) ;
//         | { erreur } — vécu illisible pour ce contexte (la vue des issues refuse) : confrontation indéterminable, rien n'est conclu.
//     issue = { idExecution, statut, … } :
//       les chemins NÉCESSAIRES sont ceux des occurrences à valeur de parcourirStructure(R.attendu) — exactement les chemins que la retrouvaille
//       a établis ouverts à T2 (point d) ;
//       'realisee'   : tous présents dans l'épisode réel ; reel = reconstruireStructure(restreindreParcours(parcourirStructure(épisode réel),
//                      chemins de TOUTES les occurrences de R.attendu)) — la projection même de relationFondatrice — et memesRelations(reel,
//                      R.attendu) ;
//       'autre'      : tous présents, la projection réelle n'est pas égale (reel rendu) ;
//       'absente'    : AUCUN chemin nécessaire n'existe dans l'épisode réel (même contrat que issue-attente : l'absence porte sur le chemin ;
//                      aucun pseudo-réel) ;
//       'incomplete' : une partie seulement des chemins nécessaires existe : AUCUNE conclusion globale (ni réalisée, ni autre, ni absente) ;
//                      observes = [{ chemin, type[, valeur] }] (constats réels des chemins présents), nonObserves = [chemin].
//   Une projection réelle exige que chaque occurrence de R.attendu existe dans l'épisode réel ; si un conteneur de R.attendu manquait alors
//   que toutes les feuilles nécessaires sont présentes (forme réelle incompatible), le cas est 'incomplete' (rien n'est deviné).
// Lexique repris de la vue des issues d'attentes v0.63.75 (realisee / autre / absente) ; « differente » est une VALEUR vécue (relationValeur), jamais un
// statut. Aucun succès, échec, erreur de règle, confiance, compte, cumul, regroupement entre actes ni préférence.
//
// confrontationsDesRetrouvailles(lignesContextes, vecu) -> [sortie]
//   Une sortie par ligne de contexte PORTANT un groupe retrouvaille valide (ordre de la table, sans signification) ; les lignes sans groupe
//   (antérieures à v0.64.31) ou à groupe hors forme ne produisent rien : elles n'ont rien de retrouvé à T2 à confronter. UNE vue des
//   épisodes pour tout l'appel, calculée au premier contexte 'retrouvee' (aucun cache, aucun état entre deux appels).
//
// N'INFLUENCE RIEN : lue UNIQUEMENT par le pont Diagnostic de main.js (garde statique). Ni la retrouvaille, ni les attentes, ni les besoins, ni
// une stratégie, ni une décision ne la lit. Rien n'est écrit : la retrouvaille de T2 reste l'histoire figée ; l'issue est relue aujourd'hui,
// depuis les faits persistés, avec le code courant.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
import { validerRetrouvaille } from './retrouvaille-forme.js';
import { issuesDuContexteProspectifSurVue } from './issue-contexte-prospectif.js';
import { episodesDeTransformation } from './episodes-de-transformation.js';
import { memesRelations } from './relations-formulees.js';
import { parcourirStructure } from './parcours-structure.js';
import { restreindreParcours } from './restriction-parcours.js';
import { reconstruireStructure } from './reconstruction-structure.js';
import { memesCouvertures } from './couverture-occurrences.js';

const NOM = 'issueRetrouvaille';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;
export const STATUTS_ISSUE_RETROUVAILLE = Object.freeze(['realisee', 'autre', 'absente', 'incomplete']);

const message = (erreur) => (erreur && typeof erreur.message === 'string' ? erreur.message : String(erreur));
const present = (occurrences, chemin) => occurrences.find((o) => memesCouvertures([o.chemin], [chemin]));
const constat = (o) => (Object.hasOwn(o, 'valeur') ? { chemin: [...o.chemin], type: o.type, valeur: o.valeur } : { chemin: [...o.chemin], type: o.type });

// UNE conséquence : l'épisode réel confronté aux chemins de R.attendu.
function confronterEpisode(attendu, episode) {
  const occurrencesAttendu = parcourirStructure(attendu);
  const necessaires = occurrencesAttendu.filter((o) => Object.hasOwn(o, 'valeur')).map((o) => o.chemin);
  if (necessaires.length === 0) refuser('l\'attendu de la relation ne porte aucune valeur');
  const reelles = parcourirStructure(episode);
  const trouves = necessaires.map((c) => present(reelles, c));
  if (trouves.every((o) => o === undefined)) return { statut: 'absente' };
  const tousLesChemins = occurrencesAttendu.map((o) => o.chemin);
  if (trouves.some((o) => o === undefined) || tousLesChemins.some((c) => present(reelles, c) === undefined)) {
    return {
      statut: 'incomplete',
      observes: trouves.filter((o) => o !== undefined).map(constat),
      nonObserves: necessaires.filter((c, k) => trouves[k] === undefined).map((c) => [...c]),
    };
  }
  const reel = reconstruireStructure(restreindreParcours(reelles, tousLesChemins));
  return { statut: memesRelations(reel, attendu) ? 'realisee' : 'autre', reel };
}

function exigerVecu(vecu) {
  if (!objetSimple(vecu) || !Array.isArray(vecu.valeurs) || !Array.isArray(vecu.executions) || !Array.isArray(vecu.descriptions)) refuser('vecu doit porter valeurs, executions et descriptions (tableaux)');
}
// obtenirVue : la vue des épisodes du vécu, calculée au premier besoin (peut lever : vécu illisible).
function confronter(contexte, vecu, obtenirVue) {
  if (!objetSimple(contexte) || !chaineNonVide(contexte.id)) refuser('contexte doit être une ligne de contexte identifiée');
  if (!Object.hasOwn(contexte, 'retrouvaille')) refuser('ce contexte ne porte aucun groupe retrouvaille');
  const g = validerRetrouvaille(contexte.retrouvaille); // copie validée : la ligne persistée n'est jamais touchée
  const base = { idContexte: contexte.id };
  if (g.statut !== 'retrouvee') return { ...base, t2: { statut: g.statut }, aujourdhui: { confrontation: 'aucune-relation-unique' } };
  const { relation } = g.relations[0];
  const t2 = { statut: 'retrouvee', relation: structuredClone(relation) };
  let issues;
  try {
    issues = issuesDuContexteProspectifSurVue(contexte, vecu.executions, obtenirVue()).map((i) => ({ idExecution: i.issue.idExecution, ...confronterEpisode(relation.attendu, i.issue.episode) }));
  } catch (erreur) {
    if (!(erreur instanceof TypeError)) throw erreur;
    return { ...base, t2, aujourdhui: { erreur: message(erreur) } };
  }
  return { ...base, t2, aujourdhui: { issues } };
}

const vueParesseuse = (vecu) => { let vue = null; return () => (vue === null ? (vue = episodesDeTransformation(vecu.valeurs, vecu.executions, vecu.descriptions)) : vue); };

export function confronterRetrouvaille(contexte, vecu) {
  exigerVecu(vecu);
  return confronter(contexte, vecu, vueParesseuse(vecu));
}

export function confrontationsDesRetrouvailles(lignesContextes, vecu) {
  if (!Array.isArray(lignesContextes)) refuser('lignesContextes doit être un tableau');
  exigerVecu(vecu);
  const obtenirVue = vueParesseuse(vecu);
  const sortie = [];
  for (const ligne of lignesContextes) {
    if (!objetSimple(ligne) || !chaineNonVide(ligne.id) || !Object.hasOwn(ligne, 'retrouvaille')) continue;
    try { validerRetrouvaille(ligne.retrouvaille); } catch { continue; } // groupe hors forme : la relecture des groupes le montre déjà
    sortie.push(confronter(ligne, vecu, obtenirVue));
  }
  return sortie;
}
// === FIN_LANGAGE_ISSUE_RETROUVAILLE ===
