// === DEBUT_LANGAGE_ISSUE_CONTEXTE_PROSPECTIF ===
// v0.63.73 — « CONFRONTER UN CONTEXTE PROSPECTIF À SON ISSUE RÉELLE » (décision ChatGPT, 07/10/2026). VUE PURE, SYNCHRONE, DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question, posée APRÈS coup :
//
//   « pour ce contexte prospectif figé, l'application désignée a-t-elle produit un épisode, et qu'est devenu chacun des chemins qui étaient
//     encore ouverts avant l'issue ? »
//
// NOM : « issue d'un contexte prospectif ». Le mot « confrontation » est déjà pris dans le dépôt (capacité confronter / confronterValeurs,
// états egal/different/inconnu/conflit — une comparaison de faits) ; « issue » dit seulement : ce qui est effectivement advenu après.
//
// issueDuContexteProspectif(contexte, lignesValeurs, lignesExecutions, descriptions) -> issue
//   contexte : UNE ligne persistée de contextesProspectifs, lue telle quelle (SEULE autorité sur « avant » : famille, témoins, constats et
//     chemins ouverts ne sont JAMAIS recalculés ; seuls idDesignation, episodePartiel.depart, structure, temoins, chemins sont lus).
//   lignesValeurs / lignesExecutions / descriptions : le magasin actuel, pour reconstruire les épisodes (episodesDeTransformation) : c'est
//     la SEULE autorité sur « après ».
//
// ISSUE : l'exécution dont idDesignation est celui du contexte ; aucune → { idContexte, idDesignation, issue: null } et RIEN d'autre (ni
//   chemins, ni absence, ni résultat fictif : « aucune issue » est distinct de « issue avec chemin absent »). Une exécution → l'ÉPISODE réel :
//   celui dont l'arrivée est cette exécution, le départ est episodePartiel.depart, la structure est celle du contexte ET dont les étapes DÉJÀ
//   CONNUES (toutes sauf la dernière) portent exactement les identités (execution, vers) que episodePartiel.chemin avait figées avant l'issue ;
//   exactement un (zéro ou plusieurs : TypeError, l'ancrage ne tient plus). Deux contextes d'une même exécution (directe / prolongement) ont des
//   départs ou structures différents : chacun retrouve SON épisode, jamais fusionnés.
//   MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 02 (branche, base v0.63.76) : l'ancrage par (arrivée, départ, structure) seuls était AMBIGU dès
//   qu'une même donnée est traversée deux fois par la même opération (deux exécutions de même structure, « losange » : P → sDC₁ → E et P → sDC₂ → E),
//   ce qui arrive dès que l'extérieur sollicite une seconde fois une application déjà exécutée ; le contexte possédait pourtant déjà, dans
//   episodePartiel.chemin, les identités des étapes connues. Elles sont désormais exigées ; aucune autre règle ne change.
//
// CHEMINS : pour chaque chemin ouvert persisté { chemin, constats, couverture } du contexte, on cherche ce même chemin (égalité typée de
//   couverture-occurrences) parmi les occurrences de parcourirStructure(épisode réel) — les mêmes règles de types et de valeurs que
//   produireConstatsStructurels — et on rend { chemin, statut, constats, couverture[, reel, correspondants] } :
//   - 'absent'   : le chemin n'existe pas dans l'épisode réel (l'absence porte sur le chemin ; aucun constat ABSENT) ;
//   - 'retrouve' : reel = { type[, valeur] } observé ; correspondants = les constats historiques égaux au réel (memesConstats, l'égalité du
//                  producteur : même chemin relatif, même type, même présence de valeur, Object.is), avec leurs couvertures historiques ;
//   - 'nouveau'  : reel observé, correspondants = [] (aucun constat historique égal) ; les constats historiques et leurs témoins restent là.
//   Conteneurs (objet, tableau, nul) : même mécanisme (constats sans valeur). Identités futures : même mécanisme (en général 'nouveau').
//   Aucun vote, majorité, seuil, score, confiance, attendu, confirmé/contredit, réussi/échoué : la vue décrit, elle ne juge pas.
//
// SORTIE (issue présente) : { idContexte, idDesignation, issue: { idExecution, episode }, temoins, chemins }
//   temoins : copie des témoins FIGÉS du contexte (une histoire vide se lit : temoins [] et chemins [] avec une issue présente).
//   Rien n'est persisté : « avant » (contexte figé) et « après » (exécutions persistées) sont deux vérités déjà écrites ; la vue est
//   entièrement recalculable et IMMUABLE : ajouter des expériences après l'issue ne change ni l'épisode réel ni le contexte.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves (l'épisode
// réel est l'objet neuf rendu par episodesDeTransformation). NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par test).
import { episodesDeTransformation } from './episodes-de-transformation.js';
import { parcourirStructure } from './parcours-structure.js';
import { memesCouvertures } from './couverture-occurrences.js';
import { memesConstats } from './constats-structurels.js';

const NOM = 'issueDuContexteProspectif';
export const STATUTS_CHEMIN = Object.freeze(['retrouve', 'nouveau', 'absent']);

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

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

const memeStructure = (a, b) => a.length === b.length && a.every((e, i) => e.operation === b[i].operation && e.entrees.length === b[i].entrees.length && e.entrees.every((x, k) => x === b[i].entrees[k]));
const copierConstat = (constat) => {
  const copie = { type: constat.type };
  if (Object.hasOwn(constat, 'valeur')) copie.valeur = constat.valeur;
  return copie;
};

export function issueDuContexteProspectif(contexte, lignesValeurs, lignesExecutions, descriptions) {
  if (contexte === null || typeof contexte !== 'object' || Array.isArray(contexte)) refuser('contexte doit être un objet (une ligne de contextesProspectifs)');
  const idContexte = chaineNonVide(lirePropre(contexte, 'id', 'contexte'), 'contexte.id');
  const idDesignation = chaineNonVide(lirePropre(contexte, 'idDesignation', 'contexte'), 'contexte.idDesignation');
  const episodePartiel = lirePropre(contexte, 'episodePartiel', 'contexte');
  if (episodePartiel === null || typeof episodePartiel !== 'object') refuser('contexte.episodePartiel doit être un objet');
  const depart = chaineNonVide(lirePropre(episodePartiel, 'depart', 'contexte.episodePartiel'), 'contexte.episodePartiel.depart');
  const structure = lirePropre(contexte, 'structure', 'contexte');
  const temoins = lirePropre(contexte, 'temoins', 'contexte');
  const chemins = lirePropre(contexte, 'chemins', 'contexte');
  if (!Array.isArray(structure) || structure.length === 0 || !Array.isArray(temoins) || !Array.isArray(chemins)) refuser('contexte.structure (non vide), temoins et chemins doivent être des tableaux');
  if (!Array.isArray(lignesExecutions)) refuser('lignesExecutions doit être un tableau');

  // 1. L'issue : l'exécution de cette désignation (zéro ou une ; plusieurs : l'ancrage ne tient plus).
  const executions = lignesExecutions.filter((e) => e !== null && typeof e === 'object' && e.idDesignation === idDesignation);
  if (executions.length > 1) refuser(`${executions.length} exécutions portent la désignation « ${idDesignation} »`);
  if (executions.length === 0) return { idContexte, idDesignation, issue: null };
  const idExecution = chaineNonVide(lirePropre(executions[0], 'id', 'exécution'), 'exécution.id');

  // 2. L'épisode réel : arrivée = cette exécution, départ et structure = ceux du contexte (exactement un).
  const { episodes } = episodesDeTransformation(lignesValeurs, lignesExecutions, descriptions);
  const connues = lirePropre(episodePartiel, 'chemin', 'contexte.episodePartiel');
  if (!Array.isArray(connues) || connues.length !== structure.length) refuser('contexte.episodePartiel.chemin doit être un tableau de même longueur que la structure');
  const memesEtapesConnues = (chemin) => connues.slice(0, -1).every((etape, i) => chemin[i].execution === etape.execution && chemin[i].vers === etape.vers);
  const candidats = episodes.filter((e) => e.arrivee === idExecution && e.depart === depart && memeStructure(e.chemin.map((x) => ({ operation: x.operation, entrees: x.entrees })), structure) && memesEtapesConnues(e.chemin));
  if (candidats.length !== 1) refuser(`${candidats.length} épisode(s) réel(s) correspondent au contexte « ${idContexte} » (exécution « ${idExecution} », départ « ${depart} ») : il en faut exactement un`);
  const [episode] = candidats;

  // 3. Chaque chemin ouvert : absent / retrouvé / nouveau, par les primitives du producteur de constats.
  const occurrences = parcourirStructure(episode);
  const resultats = chemins.map((ouvert, rang) => {
    const nom = `contexte.chemins[${rang}]`;
    if (ouvert === null || typeof ouvert !== 'object') refuser(`${nom} doit être un objet`);
    const chemin = lirePropre(ouvert, 'chemin', nom);
    const constats = lirePropre(ouvert, 'constats', nom);
    const couverture = lirePropre(ouvert, 'couverture', nom);
    if (!Array.isArray(chemin) || !Array.isArray(constats) || !Array.isArray(couverture)) refuser(`${nom} doit porter chemin, constats et couverture (tableaux)`);
    const base = { chemin: structuredClone(chemin), constats: structuredClone(constats), couverture: structuredClone(couverture) };
    const occurrence = occurrences.find((o) => memesCouvertures([o.chemin], [chemin]));
    if (occurrence === undefined) return { ...base, statut: 'absent' };
    const reel = copierConstat(occurrence);
    const correspondants = constats.filter((c) => memesConstats({ chemin, ...copierConstat(c) }, occurrence)).map((c) => structuredClone(c));
    return { ...base, statut: correspondants.length > 0 ? 'retrouve' : 'nouveau', reel, correspondants };
  });
  return { idContexte, idDesignation, issue: { idExecution, episode }, temoins: structuredClone(temoins), chemins: resultats };
}
// === FIN_LANGAGE_ISSUE_CONTEXTE_PROSPECTIF ===
