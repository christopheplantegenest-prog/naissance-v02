// v0.64.7 — PROJECTION DE VÉRIFICATION (décision ChatGPT « DÉCISION v0.64.7 », point 13) : nouvelle représentation → ancienne forme plate .64.6.
// OUTIL DE TEST UNIQUEMENT (aucun module de app/ ne l'importe) : il sert à prouver « projection(.64.7) = .64.6 » et à garder lisibles, sans
// rien affaiblir, les assertions historiques écrites sur la forme plate. Il n'ajoute aucune information et n'en retire aucune : chaque clé
// plate est lue à UNE position de la forme structurée, et l'ordre des clés est exactement celui que .64.6 écrivait.

// Ligne persistée { id, horodatage, idObservation, description, preuve, references } ou sortie de calculateur { description, preuve, references }
//   -> ligne plate .64.6 (ordre : id, horodatage, idDesignation, idObservation, idContexte, structure, chemin, constat, temoinsContexte,
//      unitesIssues[, fondation][, relation]) ; sans occurrence : ordre de sortie des calculateurs .64.6.
export function attentePlate(a) {
  const { description: d, preuve: p, references: r } = a;
  const plate = {};
  if (Object.hasOwn(a, 'id')) {
    plate.id = a.id;
    if (Object.hasOwn(a, 'horodatage')) plate.horodatage = a.horodatage;
    plate.idDesignation = r.idDesignation;
    if (Object.hasOwn(a, 'idObservation')) plate.idObservation = a.idObservation;
  }
  Object.assign(plate, { idContexte: r.idContexte, idDesignation: r.idDesignation, structure: d.structure, chemin: d.chemin, constat: d.constat, temoinsContexte: p.temoinsContexte, unitesIssues: p.unitesIssues });
  if (Object.hasOwn(p, 'fondation')) plate.fondation = p.fondation;
  if (Object.hasOwn(d, 'relation')) plate.relation = d.relation;
  return plate;
}

// Sortie de issueDeLAttenteProspective .64.7 + la ligne d'attente (la preuve n'est plus dans l'issue : elle vient de la ligne)
//   -> sortie .64.6 { idAttente, idContexte, idDesignation, structure, chemin, constat, temoinsContexte, unitesIssues[, fondation][, relation],
//      issue[, statut][, reel] }.
export function issuePlate(issue, ligne) {
  const p = ligne.preuve;
  const plate = {
    idAttente: issue.idAttente, idContexte: issue.references.idContexte, idDesignation: issue.references.idDesignation,
    structure: issue.description.structure, chemin: issue.description.chemin, constat: issue.description.constat,
    temoinsContexte: p.temoinsContexte, unitesIssues: p.unitesIssues,
  };
  if (Object.hasOwn(p, 'fondation')) plate.fondation = p.fondation;
  if (Object.hasOwn(issue.description, 'relation')) plate.relation = issue.description.relation;
  plate.issue = issue.issue;
  if (Object.hasOwn(issue, 'statut')) plate.statut = issue.statut;
  if (Object.hasOwn(issue, 'reel')) plate.reel = issue.reel;
  return plate;
}

// Expérience .64.7 { id, idContexte, idDesignation, idExecution, avant: { description, preuve }, apres }
//   -> expérience .64.6 { id, idContexte, idDesignation, idExecution, critere: { structure, chemin }, avant: { constat, temoinsContexte,
//      unitesIssues[, fondation][, relation] }, apres }.
export function experiencePlate(e) {
  const { description: d, preuve: p } = e.avant;
  const avant = { constat: d.constat, temoinsContexte: p.temoinsContexte, unitesIssues: p.unitesIssues };
  if (Object.hasOwn(p, 'fondation')) avant.fondation = p.fondation;
  if (Object.hasOwn(d, 'relation')) avant.relation = d.relation;
  return { id: e.id, idContexte: e.idContexte, idDesignation: e.idDesignation, idExecution: e.idExecution, critere: { structure: d.structure, chemin: d.chemin }, avant, apres: e.apres };
}
