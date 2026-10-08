// === DEBUT_LANGAGE_ISSUE_ATTENTE_PROSPECTIVE ===
// v0.63.75 — « ISSUE D'UNE ATTENTE PROSPECTIVE » (décision ChatGPT, 08/10/2026). VUE PURE, SYNCHRONE, DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question, posée APRÈS coup :
//
//   « pour cette attente écrite avant l'issue, qu'est devenu, dans l'épisode réel du contexte qu'elle visait, le constat précis qui avait été
//     engagé au chemin engagé ? »
//
// NOM : « issue d'une attente prospective » (même mot qu'en .73 : ce qui est effectivement advenu après). STATUTS : 'realisee' (le chemin existe
// et son constat réel est le constat engagé), 'autre' (le chemin existe mais porte un autre constat), 'absente' (le chemin n'existe pas dans
// l'épisode réel). Diagnostic lexical : « retrouve/nouveau/absent » sont les statuts d'issue d'un CONTEXTE (.73) ; « different/egal » sont les états
// de l'ancienne capacité confronter ; « differente » est en outre une VALEUR vécue du monde observé (relation de valeur) — un statut homonyme
// rendrait les lectures ambiguës et tomberait sous la garde anti-sémantique. « autre » dit seulement : un constat qui n'est pas celui engagé.
//
// issueDeLAttenteProspective(attente, contexte, lignesValeurs, lignesExecutions, descriptions) -> issue
//   attente  : UNE ligne persistée de attentesProspectives : l'AUTORITÉ sur « avant » (constat engagé, témoins A, unités B) — rien n'est recalculé ;
//   contexte : la ligne persistée de contextesProspectifs référencée par attente.idContexte (même idDesignation) ;
//   lignesValeurs / lignesExecutions / descriptions : le magasin actuel, pour l'issue du contexte (issueDuContexteProspectif : SEULE autorité sur
//     « après », aucune sémantique parallèle). Le chemin engagé est retrouvé parmi les chemins ouverts de l'issue DE CE contexte.
//
// SORTIE : { idAttente, idContexte, idDesignation, structure, chemin, constat, temoinsContexte, unitesIssues, issue, statut?, reel? }
//   - constat, temoinsContexte, unitesIssues, structure, chemin : copies de l'attente (ce sur quoi elle était fondée reste observable) ;
//   - issue : null si aucune exécution ne porte idDesignation (ni démentie, ni absente, ni échec : rien n'est advenu) — alors ni statut ni reel ;
//     sinon { idExecution } ;
//   - statut : 'realisee' | 'autre' | 'absente' ; reel : { type[, valeur] } le constat réel du chemin (présent pour 'realisee' — même identique —
//     et 'autre' ; absent pour 'absente' : l'absence porte sur le chemin, aucun pseudo-constat).
//   L'égalité est memesConstats (égalité du producteur de constats) : un constat sans valeur { type:'objet' } se confronte comme un scalaire.
// Chaque attente est confrontée seule : rien n'agrège plusieurs attentes d'une même exécution. Aucun vote, score, réussite, échec, récompense.
// IMMUTABILITÉ : attente figée + contexte figé + exécution persistée ⇒ issue recalculable à l'identique ; rien n'est persisté (aucune table).
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par test). Aucun nom de champ ni d'opération dans le code.
import { issueDuContexteProspectif } from './issue-contexte-prospectif.js';
import { memesCouvertures } from './couverture-occurrences.js';
import { memesConstats } from './constats-structurels.js';

const NOM = 'issueDeLAttenteProspective';
export const STATUTS_ATTENTE = Object.freeze(['realisee', 'autre', 'absente']);

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lirePropre(objet, champ, nom) {
  if (objet === null || typeof objet !== 'object' || Array.isArray(objet)) refuser(`${nom} doit être un objet`);
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

const copierConstat = (constat) => {
  const copie = { type: constat.type };
  if (Object.hasOwn(constat, 'valeur')) copie.valeur = constat.valeur;
  return copie;
};

export function issueDeLAttenteProspective(attente, contexte, lignesValeurs, lignesExecutions, descriptions) {
  const idAttente = chaineNonVide(lirePropre(attente, 'id', 'attente'), 'attente.id');
  const idContexte = chaineNonVide(lirePropre(attente, 'idContexte', 'attente'), 'attente.idContexte');
  const idDesignation = chaineNonVide(lirePropre(attente, 'idDesignation', 'attente'), 'attente.idDesignation');
  const chemin = lirePropre(attente, 'chemin', 'attente');
  const constat = lirePropre(attente, 'constat', 'attente');
  const structure = lirePropre(attente, 'structure', 'attente');
  const temoinsContexte = lirePropre(attente, 'temoinsContexte', 'attente');
  const unitesIssues = lirePropre(attente, 'unitesIssues', 'attente');
  if (!Array.isArray(chemin) || !Array.isArray(structure) || !Array.isArray(temoinsContexte) || !Array.isArray(unitesIssues)) refuser('attente.chemin, structure, temoinsContexte et unitesIssues doivent être des tableaux');
  chaineNonVide(lirePropre(constat, 'type', 'attente.constat'), 'attente.constat.type');
  if (chaineNonVide(lirePropre(contexte, 'id', 'contexte'), 'contexte.id') !== idContexte) refuser('le contexte n\'est pas celui que l\'attente référence');
  if (lirePropre(contexte, 'idDesignation', 'contexte') !== idDesignation) refuser('le contexte et l\'attente ne portent pas la même désignation');

  const base = {
    idAttente, idContexte, idDesignation,
    structure: structuredClone(structure), chemin: structuredClone(chemin), constat: copierConstat(constat),
    temoinsContexte: structuredClone(temoinsContexte), unitesIssues: structuredClone(unitesIssues),
  };
  // 1. L'issue du contexte (seule autorité sur « après »).
  const issue = issueDuContexteProspectif(contexte, lignesValeurs, lignesExecutions, descriptions);
  if (issue.issue === null) return { ...base, issue: null };
  // 2. Le chemin engagé parmi les chemins ouverts de l'issue de ce contexte.
  const confronte = issue.chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
  if (confronte === undefined) refuser(`le chemin engagé n'est pas un chemin ouvert du contexte « ${idContexte} »`);
  if (confronte.statut === 'absent') return { ...base, issue: { idExecution: issue.issue.idExecution }, statut: 'absente' };
  const reel = copierConstat(confronte.reel);
  const realisee = memesConstats({ chemin, ...copierConstat(constat) }, { chemin, ...reel });
  return { ...base, issue: { idExecution: issue.issue.idExecution }, statut: realisee ? 'realisee' : 'autre', reel };
}
// === FIN_LANGAGE_ISSUE_ATTENTE_PROSPECTIVE ===
