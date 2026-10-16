// === DEBUT_LANGAGE_RETROUVAILLES_PERSISTEES ===
// v0.64.31 — RETROUVAILLE-1, part DIAGNOSTIC (GO ChatGPT « GO DÉVELOPPEMENT RETROUVAILLE-1 — v0.64.31 », 16/10/2026). LECTURE SEULE, SANS
// RECALCUL : rend visible le groupe `retrouvaille` FIGÉ sur chaque ligne de contextesProspectifs. Lu UNIQUEMENT par le pont Diagnostic de
// main.js, à l'ouverture de sa section ; aucun tour, aucune décision ne le lit.
//
// Deux lectures STRICTEMENT séparées, qui ne reçoivent pas les mêmes entrées :
//
// relireRetrouvailles(lignesContextes) -> { contextes: [E], illisibles: [{ rang, idContexte, erreur }] }
//   lignesContextes : la table contextesProspectifs ENTIÈRE ; ordre = celui de la table, sans signification ; aucun tri, filtre ni fusion.
//   E = { idContexte, idActe, horodatage, operation, groupe }
//     groupe = { statut: 'persiste', retrouvaille }  — copie validée (validerRetrouvaille) du groupe écrit avant toute attente de l'acte ;
//            | { statut: 'anterieur' }               — ligne sans groupe : écrite avant v0.64.31, distincte de 'non-effectuee' ; jamais
//                                                      reconstruite ;
//            | { statut: 'invalide', erreur }         — groupe présent mais hors forme : montré comme tel, jamais réparé.
//   Cette fonction ne reçoit ni les attentes, ni le vécu : elle ne PEUT rien recalculer, et l'affichage du groupe ne dépend d'aucune attente.
//
// attentesEcritesParContexte(lignesAttentes) -> [{ idContexte, idAttente, horodatage }]
//   Pour la preuve d'ordre affichée À CÔTÉ du groupe : les attentes qui référencent chaque contexte (references.idContexte, ou idContexte
//   d'une ligne plate), avec leur horodatage persisté, dans l'ordre de la table. Rien d'autre n'est lu ; une ligne sans contexte lisible est
//   ignorée (elle n'a rien à prouver ici).
//
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
import { validerRetrouvaille } from './retrouvaille-forme.js';

const NOM = 'retrouvaillesPersistees';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaine = (x) => typeof x === 'string' && x.length > 0;
const message = (erreur) => (erreur && typeof erreur.message === 'string' ? erreur.message : String(erreur));

function operationDe(structure) {
  if (!Array.isArray(structure) || structure.length === 0) return null;
  const derniere = structure[structure.length - 1];
  return objetSimple(derniere) && chaine(derniere.operation) ? derniere.operation : null;
}

export function relireRetrouvailles(lignesContextes) {
  if (!Array.isArray(lignesContextes)) refuser('lignesContextes doit être un tableau');
  const contextes = [];
  const illisibles = [];
  lignesContextes.forEach((ligne, rang) => {
    if (!objetSimple(ligne) || !chaine(ligne.id) || !chaine(ligne.idDesignation)) {
      illisibles.push({ rang, idContexte: objetSimple(ligne) && chaine(ligne.id) ? ligne.id : null, erreur: 'ligne de contexte sans identité lisible' });
      return;
    }
    let groupe;
    if (!Object.hasOwn(ligne, 'retrouvaille')) groupe = { statut: 'anterieur' };
    else {
      try { groupe = { statut: 'persiste', retrouvaille: validerRetrouvaille(ligne.retrouvaille) }; } catch (erreur) { groupe = { statut: 'invalide', erreur: message(erreur) }; }
    }
    contextes.push({ idContexte: ligne.id, idActe: ligne.idDesignation, horodatage: typeof ligne.horodatage === 'string' ? ligne.horodatage : null, operation: operationDe(ligne.structure), groupe });
  });
  return { contextes, illisibles };
}

export function attentesEcritesParContexte(lignesAttentes) {
  if (!Array.isArray(lignesAttentes)) refuser('lignesAttentes doit être un tableau');
  const sortie = [];
  for (const ligne of lignesAttentes) {
    if (!objetSimple(ligne) || !chaine(ligne.id)) continue;
    const idContexte = objetSimple(ligne.references) ? ligne.references.idContexte : ligne.idContexte;
    if (!chaine(idContexte)) continue;
    sortie.push({ idContexte, idAttente: ligne.id, horodatage: typeof ligne.horodatage === 'string' ? ligne.horodatage : null });
  }
  return sortie;
}
// === FIN_LANGAGE_RETROUVAILLES_PERSISTEES ===
