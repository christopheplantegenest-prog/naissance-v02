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
// MISE À JOUR DÉLIBÉRÉE v0.63.96 — PLURALITÉ DES ISSUES (décision ChatGPT « AUTORISATION DE CODER v0.63.96 », 12/10/2026) : une attente dont le
// contexte a PLUSIEURS conséquences (une émission, plusieurs réceptions déclarées) a une issue par conséquence, chacune confrontée seule.
//   issueDeLAttenteProspective(attente, contexte, valeurs, executions, descriptions) — sans ancre : contrat historique STRICTEMENT inchangé ;
//   issueDeLAttenteProspective(…, idExecution) — l'issue de l'attente pour CETTE conséquence (issue de contexte ancrée, même sortie) ;
//   issuesDeLAttenteProspective(…) -> [issue] : une par conséquence (issuesDuContexteProspectif), [] si aucune ; ordre sans signification.
// MISE À JOUR DÉLIBÉRÉE v0.64.7 — « PRÉSERVER LES RÔLES DE L'ATTENTE » (décision ChatGPT « DÉCISION v0.64.7 », 13/10/2026). La SORTIE ne remet plus
// les rôles à plat et ne transporte plus la preuve :
//   { idAttente, references: { idContexte, idDesignation }, description: { structure, chemin, constat[, relation] }, issue, statut?, reel? }
//   issue / statut / reel : inchangés (même confrontation, même memesConstats, même issue de contexte). La preuve (temoinsContexte, unitesIssues,
//   fondation) n'a jamais servi à confronter : elle se lit dans la ligne persistée (rolesDeLAttente), pas ici.
// (Historique, avant .64.7 :) Aucune agrégation, aucun vote, aucune première ni dernière conséquence. unitesIssues est recopiée telle quelle, quelle que soit sa forme
// (ancienne [idContexte, …chemin] ou [idContexte, idExecution, …chemin]) : rien n'est migré.
import { issueDuContexteProspectif, issuesDuContexteProspectif } from './issue-contexte-prospectif.js';
import { memesCouvertures } from './couverture-occurrences.js';
import { memesConstats } from './constats-structurels.js';
import { rolesDeLAttente } from './roles-attente.js';

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

// v0.64.7 — la ligne est lue par rôles (rolesDeLAttente : forme structurée .64.7 ou forme plate historique, lues explicitement). L'issue
// consomme la DESCRIPTION (structure, chemin, constat ; relation transportée) et les RÉFÉRENCES (idContexte, idDesignation), plus l'id de
// l'occurrence. La PREUVE n'est ni lue pour confronter ni recopiée dans la sortie : elle reste dans la ligne persistée.
function lireAttente(attente, contexte) {
  const roles = rolesDeLAttente(attente);
  const idAttente = chaineNonVide(roles.occurrence.id, 'attente.id');
  const { description, references } = roles;
  const idContexte = chaineNonVide(references.idContexte, 'attente.idContexte');
  const idDesignation = chaineNonVide(references.idDesignation, 'attente.idDesignation');
  const { chemin, constat, structure } = description;
  if (!Array.isArray(chemin) || !Array.isArray(structure)) refuser('attente.chemin et structure doivent être des tableaux');
  chaineNonVide(lirePropre(constat, 'type', 'attente.constat'), 'attente.constat.type');
  if (chaineNonVide(lirePropre(contexte, 'id', 'contexte'), 'contexte.id') !== idContexte) refuser('le contexte n\'est pas celui que l\'attente référence');
  if (lirePropre(contexte, 'idDesignation', 'contexte') !== idDesignation) refuser('le contexte et l\'attente ne portent pas la même désignation');

  const copieDescription = { structure, chemin, constat: copierConstat(constat) };
  // v0.64.5 — la relation fondatrice structurée est transportée exactement (jamais recalculée) ; elle fait partie de la description.
  if (Object.hasOwn(description, 'relation')) copieDescription.relation = description.relation;
  const base = { idAttente, references: { idContexte, idDesignation }, description: copieDescription };
  return { base, chemin, constat, idContexte };
}

// Confronte l'attente à UNE issue de son contexte (sortie inchangée depuis .75).
function confronter({ base, chemin, constat, idContexte }, issue) {
  if (issue.issue === null) return { ...base, issue: null };
  // 2. Le chemin engagé parmi les chemins ouverts de l'issue de ce contexte.
  const confronte = issue.chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
  if (confronte === undefined) refuser(`le chemin engagé n'est pas un chemin ouvert du contexte « ${idContexte} »`);
  if (confronte.statut === 'absent') return { ...base, issue: { idExecution: issue.issue.idExecution }, statut: 'absente' };
  const reel = copierConstat(confronte.reel);
  const realisee = memesConstats({ chemin, ...copierConstat(constat) }, { chemin, ...reel });
  return { ...base, issue: { idExecution: issue.issue.idExecution }, statut: realisee ? 'realisee' : 'autre', reel };
}

export function issueDeLAttenteProspective(attente, contexte, lignesValeurs, lignesExecutions, descriptions, idExecution = null) {
  const lue = lireAttente(attente, contexte);
  // 1. L'issue du contexte (seule autorité sur « après ») — v0.63.96 : ancrée sur une conséquence si idExecution est fourni.
  return confronter(lue, issueDuContexteProspectif(contexte, lignesValeurs, lignesExecutions, descriptions, idExecution));
}

// v0.63.96 — une issue par conséquence du contexte, chacune confrontée seule. [] si aucune conséquence.
export function issuesDeLAttenteProspective(attente, contexte, lignesValeurs, lignesExecutions, descriptions) {
  const lue = lireAttente(attente, contexte);
  return issuesDuContexteProspectif(contexte, lignesValeurs, lignesExecutions, descriptions).map((issue) => confronter(lue, issue));
}
// === FIN_LANGAGE_ISSUE_ATTENTE_PROSPECTIVE ===
