// === DEBUT_LANGAGE_ISSUES_VECUES ===
// v0.66.5 — C1 « ISSUE VÉCUE D'UNE RETROUVAILLE » (écrivain). CONSERVER, au moment où la conséquence d'un acte arrive, ce que la confrontation
// de la relation retrouvée à T2 rend pour CETTE conséquence. Historique d'une observation : rien n'est décidé, rien n'est préféré.
//
// conserverIssuesVecues(magasin, { idDesignation, idExecution }) -> Promise<[ligne écrite]>
//   1. lit les lignes de contextesProspectifs de CET acte (idDesignation égal) dont le groupe retrouvaille porte le statut 'retrouvee' ;
//      s'il n'y en a aucune : RIEN d'autre n'est lu ni calculé (ni le vécu, ni la confrontation) ; rendu [] ;
//   2. sinon lit le vécu actuel (lireExecutionsVecues) et, pour chaque contexte retenu (ordre de la table, sans signification), appelle
//      confronterRetrouvaille (vue existante, inchangée) ;
//   3. pour l'issue dont idExecution est EXACTEMENT celle reçue, écrit UNE ligne (enregistrerIssueRetrouvaille, mode ajout) :
//      id 'issue-retrouvaille/' + idContexte + '/' + idExecution ; observe = { statut[, reel] } tels que rendus. Issue introuvable (rien
//      encore, vécu illisible, autre conséquence) : rien n'est écrit pour ce contexte.
// ERREURS ABSORBÉES : aucune erreur (entrée invalide, lecture, confrontation, écriture refusée) ne remonte à l'appelant ; elle n'empêche
// jamais l'écriture de la conséquence, qui a lieu AVANT et ailleurs. Une erreur sur un contexte n'empêche pas les autres.
// AUCUN score, compte, fréquence, confiance, préférence ni décision ; aucune ligne rétroactive (seul l'appel au moment de la conséquence
// écrit) ; aucune sélection : chaque contexte retrouvé de l'acte est traité, chacun pour lui-même.
import { enregistrerIssueRetrouvaille } from './connaissances.js';
import { lireExecutionsVecues } from './executions-vecues.js';
import { confronterRetrouvaille } from './issue-retrouvaille.js';

const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const retrouveeDeLActe = (ligne, idDesignation) => objetSimple(ligne) && chaineNonVide(ligne.id) && ligne.idDesignation === idDesignation
  && Object.hasOwn(ligne, 'retrouvaille') && objetSimple(ligne.retrouvaille) && ligne.retrouvaille.statut === 'retrouvee';

async function conserverPourContexte(magasin, contexte, vecu, idDesignation, idExecution) {
  const sortie = confronterRetrouvaille(contexte, vecu);
  const aujourdhui = objetSimple(sortie) ? sortie.aujourdhui : null;
  if (!objetSimple(aujourdhui) || !Array.isArray(aujourdhui.issues)) return null;
  const issue = aujourdhui.issues.find((i) => objetSimple(i) && i.idExecution === idExecution);
  if (issue === undefined) return null;
  const observe = Object.hasOwn(issue, 'reel') ? { statut: issue.statut, reel: issue.reel } : { statut: issue.statut };
  return enregistrerIssueRetrouvaille(magasin, {
    id: ['issue-retrouvaille', contexte.id, idExecution].join('/'),
    idContexte: contexte.id,
    idDesignation,
    idExecution,
    horodatage: new Date().toISOString(),
    observe,
  });
}

export async function conserverIssuesVecues(magasin, entree) {
  const ecrites = [];
  try {
    if (!objetSimple(entree)) return ecrites;
    const { idDesignation, idExecution } = entree;
    if (!chaineNonVide(idDesignation) || !chaineNonVide(idExecution)) return ecrites;
    const lignes = await magasin.lireTout('contextesProspectifs');
    if (!Array.isArray(lignes)) return ecrites;
    const retenus = lignes.filter((l) => retrouveeDeLActe(l, idDesignation));
    if (retenus.length === 0) return ecrites;
    const vecu = await lireExecutionsVecues(magasin);
    for (const contexte of retenus) {
      try {
        const ligne = await conserverPourContexte(magasin, contexte, vecu, idDesignation, idExecution);
        if (ligne !== null) ecrites.push(ligne);
      } catch {
        // absorbée : ce contexte n'a pas de ligne ; les autres suivent
      }
    }
  } catch {
    // absorbée : rien ne remonte à l'appelant
  }
  return ecrites;
}
// === FIN_LANGAGE_ISSUES_VECUES ===
