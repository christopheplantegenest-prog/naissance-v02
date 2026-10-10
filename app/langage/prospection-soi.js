// === DEBUT_LANGAGE_PROSPECTION_SOI ===
// v0.63.86 — CE QUI EST COMMUN AUX CONSÉQUENCES SUR SOI (B1 capacité, B2 relation) : décision ChatGPT du 10/10/2026 (B2 après v0.63.85).
// Une CONSÉQUENCE SUR SOI est une application DÉSIGNÉE (table designations, idObservation = l'observation interne qui a constaté l'état d'avant,
// origine 'mecanique' : aucun choix) dont l'issue sera une variation d'un état propre. AVANT cette issue, exactement comme pour un acte réel
// (.72/.74) ou une émission (.83) : contextes prospectifs puis attentes, ancrés sur la DÉSIGNATION (jamais sur l'événement causal : .73 exige une
// issue par désignation, et un même événement peut avoir plusieurs conséquences). Un TypeError des vues = « calcul non effectué », jamais une panne.
import { enregistrerContexteProspectif, enregistrerAttenteProspective } from './connaissances.js';
import { contextesProspectifs } from './contexte-prospectif.js';
import { attentesDuContexteProspectif } from './attentes-prospectives.js';
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
  let contextes = [];
  try {
    vecu = await lireExecutionsVecues(magasin);
    contextes = contextesProspectifs(application, vecu.valeurs, vecu.executions, vecu.descriptions);
  } catch (erreur) {
    if (!(erreur instanceof TypeError)) throw erreur;
    contextes = [];
  }
  const lignes = [];
  for (const contexte of contextes) lignes.push(await enregistrerContexteProspectif(magasin, { designation: acte, contexte }));
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
  return { contextes: lignes.length, attentes: nombreAttentes };
}
// === FIN_LANGAGE_PROSPECTION_SOI ===
