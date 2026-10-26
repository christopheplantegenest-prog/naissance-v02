// === DEBUT_LANGAGE_PROSPECTION_SOI ===
// v0.63.86 — CE QUI EST COMMUN AUX CONSÉQUENCES SUR SOI (B1 capacité, B2 relation) : décision ChatGPT du 10/10/2026 (B2 après v0.63.85).
// Une CONSÉQUENCE SUR SOI est une application DÉSIGNÉE (table designations, idObservation = l'observation interne qui a constaté l'état d'avant,
// origine 'mecanique' : aucun choix) dont l'issue sera une variation d'un état propre. AVANT cette issue, exactement comme pour un acte réel
// (.72/.74) ou une émission (.83) : contextes prospectifs puis attentes, ancrés sur la DÉSIGNATION (jamais sur l'événement causal : .73 exige une
// issue par désignation, et un même événement peut avoir plusieurs conséquences). Un TypeError des vues = « calcul non effectué », jamais une panne.
import { enregistrerContexteProspectif, enregistrerAttenteProspective } from './connaissances.js';
import { contextesProspectifs } from './contexte-prospectif.js';
import { attentesDuContexteProspectif } from './attentes-prospectives.js';
import { attentesConditionneesDesContextes } from './attentes-conditionnees.js';
import { retrouvaillesDesContextes } from './retrouvailles.js';
import { rappelsDesContextes } from './rappels.js';
import { episodesDeTransformation } from './episodes-de-transformation.js';
import { lireExecutionsVecues } from './executions-vecues.js';

export const SOURCE_OBSERVATION_INTERNE = 'soi';
export const ORIGINE_CONSEQUENCE = 'mecanique';

// L'acte prospectif d'une conséquence désignée : la désignation elle-même (id, idObservation, operation, horodatage).
export function acteDeConsequence(designation) {
  return { id: designation.id, idObservation: designation.idObservation, operation: designation.operation, horodatage: designation.horodatage };
}

export async function prospecterConsequence(magasin, designation) {
  const acte = acteDeConsequence(designation);
  const application = { operation: designation.operation, liaisons: designation.liaisons.map((l) => ({ ...l })) };
  let vecu = null;
  let vueEpisodes = null;
  let contextes = [];
  try {
    vecu = await lireExecutionsVecues(magasin);
    // v0.64.1 — la vue des épisodes du vécu « avant » est calculée UNE fois ici, sur les lignes exactes de contextesProspectifs, puis transmise
    // explicitement aux contextes et aux attentes conditionnées (aucun recalcul identique ; .74 inchangé).
    vueEpisodes = episodesDeTransformation(vecu.valeurs, vecu.executions, vecu.descriptions);
    contextes = contextesProspectifs(application, vecu.valeurs, vecu.executions, vecu.descriptions, vueEpisodes);
  } catch (erreur) {
    if (!(erreur instanceof TypeError)) throw erreur;
    contextes = [];
  }
  const lignes = [];
  // v0.64.31 — RETROUVAILLE-1 : AVANT toute attente de l'acte, UNE lecture de attentesProspectives, puis, pour chaque contexte, la retrouvaille
  // (calcul pur, même vécu « avant »), écrite DANS la ligne du contexte. Elle n'influence rien de ce qui suit (attentes, issue) : les lignes
  // d'attentes produites sont exactement celles d'avant. Une garantie violée (attente de l'acte déjà présente) lève : jamais masquée.
  const retrouvailles = contextes.length === 0 ? [] : retrouvaillesDesContextes(contextes, acte, await magasin.lireTout('attentesProspectives'), vecu);
  // v0.66.14 — C2 « RAPPEL DES ISSUES DÉJÀ VÉCUES » : pour chaque contexte retrouvé, le rappel (historique de ce qui est déjà arrivé après la
  // même relation retrouvée, calculé sur les tables AVANT toute écriture de cet acte), écrit DANS la ligne du contexte s'il n'est pas null. Il
  // n'est lu par rien de ce qui suit (attentes, issue) : seul le Diagnostic le relira.
  const rappels = await rappelsDesContextes(magasin, retrouvailles, acte);
  for (let k = 0; k < contextes.length; k += 1) lignes.push(await enregistrerContexteProspectif(magasin, { designation: acte, contexte: contextes[k], retrouvaille: retrouvailles[k], ...(rappels[k] === null ? {} : { rappel: rappels[k] }) }));
  if (lignes.length === 0) return { contextes: 0, attentes: 0 };
  const anterieurs = await magasin.lireTout('contextesProspectifs');
  let nombreAttentes = 0;
  for (const contexte of lignes) {
    let attentes = [];
    try {
      attentes = attentesDuContexteProspectif(contexte, acte, anterieurs, vecu.valeurs, vecu.executions, vecu.descriptions);
    } catch (erreur) {
      if (!(erreur instanceof TypeError)) throw erreur;
      attentes = [];
    }
    for (const attente of attentes) { await enregistrerAttenteProspective(magasin, { designation: acte, contexte, attente }); nombreAttentes += 1; }
  }
  // v0.64.1 — ATTENTES CONDITIONNÉES PAR LA PARTIE CONNUE (source distincte de .74, champ `fondation`) : même vécu « avant », même ancrage,
  // écrites APRÈS les attentes .74, sans rien changer à celles-ci ni au flux. Un passé non résoluble (TypeError) = aucune attente conditionnée.
  let conditionnees = [];
  try {
    conditionnees = attentesConditionneesDesContextes(lignes, acte, vecu.valeurs, vecu.executions, vecu.descriptions, vueEpisodes);
  } catch (erreur) {
    if (!(erreur instanceof TypeError)) throw erreur;
    conditionnees = [];
  }
  // une sortie par contexte, dans l'ordre des contextes transmis (rang k ↔ lignes[k]).
  for (let k = 0; k < conditionnees.length; k += 1) for (const attente of conditionnees[k].attentes) await enregistrerAttenteProspective(magasin, { designation: acte, contexte: lignes[k], attente });
  return { contextes: lignes.length, attentes: nombreAttentes };
}
// === FIN_LANGAGE_PROSPECTION_SOI ===
