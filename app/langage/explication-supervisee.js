// === DEBUT_LANGAGE_EXPLICATION_SUPERVISEE ===
// v0.64.20 — NOYAU COMMUN « EXPLIQUER UN RÉSULTAT SUPERVISÉ » (GO ChatGPT « v0.64.20 », 15/10/2026), extrait TEL QUEL de reponses-attendues.js
// (v0.64.19, comportement inchangé) pour servir à DEUX clients : les formes de question (reponses-attendues.js) et les formes de correction
// (corrections-apprises.js). Les chemins des faits (v0.64.16-18) ne sont pas réécrits sur ce noyau.
//
// Un EXEMPLE = { idMessage, texte, resultat } : un message naturel et le résultat supervisé qu'il devait produire (une chaîne). Le CLIENT dit
// seulement comment un exemple peut être EXPLIQUÉ (explicationsDe : groupe -> [{ id, regle }]) ; le noyau, lui, décide sans rien savoir du sens :
//   - INDÉPENDANCE : des messages aux jetons canoniques identiques forment UN SEUL exemple ; s'ils portent des résultats canoniques différents,
//     l'exemple est CONTRADICTOIRE et ne sert jamais. Représentant = le message de plus petite identité.
//   - INDUCTION : pour chaque explication de l'exemple cible, les exemples (non contradictoires) dont l'explication la contient aussi ; retenue
//     seulement si au moins DEUX exemples la soutiennent ET si chaque position de rôle y prend au moins deux valeurs canoniques ; 0 retenue :
//     abstention ('insuffisant' ou 'role-non-demontre') ; 2+ : abstention ('plusieurs-explications'). Aucun score, aucune fréquence, aucun ordre.
// Pur : n'écrit rien, ne lit aucune table, n'invoque rien lui-même (seul explicationsDe, fourni par le client, peut lire).
import { canoniser } from './canon.js';
import { tokeniser, reassembler, calculerAncres } from './transformation.js';

const LETTRES = ['X', 'Y', 'Z', 'W'];
export const plusPetit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const cleTexte = (texte) => tokeniser(texte).map(canoniser).join('\u0000');

// grouperExemples([{ idMessage, texte, resultat }]) -> [{ cle, representant, membres, contradictoire }]
export function grouperExemples(exemples) {
  const groupes = new Map();
  for (const x of exemples) {
    const cle = cleTexte(x.texte);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(x);
  }
  return [...groupes.entries()].map(([cle, membres]) => {
    const tries = [...membres].sort((a, b) => plusPetit(a.idMessage, b.idMessage));
    return { cle, representant: tries[0], membres: tries.map((m) => m.idMessage), contradictoire: new Set(tries.map((m) => canoniser(m.resultat))).size > 1 };
  });
}

// retenirExplication(cible, autres, explicationsDe) -> { explication: { id, regle }, soutiens } | { raison }
//   cible : groupe NON contradictoire ; autres : les autres groupes (les contradictoires sont ignorés ici) ; explicationsDe(groupe) recalculée à
//   chaque appel (revalidation : rien n'est mis en cache). soutiens : groupes triés par identité de représentant.
export function retenirExplication(cible, autres, explicationsDe) {
  const candidates = explicationsDe(cible);
  if (!candidates.length) return { raison: 'aucune-explication' };
  const autresExpliques = autres.filter((g) => g !== cible && !g.contradictoire).map((g) => ({ g, ids: new Set(explicationsDe(g).map((e) => e.id)) }));
  const verdicts = candidates.map((c) => {
    const soutiens = [cible, ...autresExpliques.filter((a) => a.ids.has(c.id)).map((a) => a.g)];
    const varies = c.regle.roles.every(({ position }) => new Set(soutiens.map((g) => canoniser(tokeniser(g.representant.texte)[position]))).size >= 2);
    return { c, soutiens, retenue: soutiens.length >= 2 && varies };
  });
  const retenues = verdicts.filter((v) => v.retenue);
  if (retenues.length > 1) return { raison: 'plusieurs-explications' };
  if (!retenues.length) return { raison: verdicts.some((v) => v.soutiens.length >= 2) ? 'role-non-demontre' : 'insuffisant' };
  const [{ c, soutiens }] = retenues;
  return { explication: c, soutiens: [...soutiens].sort((a, b) => plusPetit(a.representant.idMessage, b.representant.idMessage)) };
}

// Forme lisible d'une règle : rôles remplacés par X, Y… dans l'ordre des positions ; ancres telles quelles. -> { lettres: { nom: lettre }, forme }
export function formeAvecLettres(regle) {
  const lettres = Object.fromEntries(regle.roles.map((r, i) => [r.nom, LETTRES[i]]));
  const parPosition = new Map(regle.roles.map((r) => [r.position, lettres[r.nom]]));
  const jetons = Array.from({ length: regle.n }, (_, i) => (parPosition.has(i) ? parPosition.get(i) : regle.ancres.find((a) => a.position === i).jeton));
  return { lettres, forme: reassembler(jetons) };
}

// Cohérence STRUCTURELLE d'une règle avec ses exemples, sans registre : mêmes arités, ancres recalculées (calculerAncres, transformation.js)
// identiques à celles de la règle, et positions de rôles = exactement les positions non ancrées.
export function ancresCoherentes(regle, textes) {
  if (!textes.every((t) => tokeniser(t).length === regle.n)) return false;
  const ancres = calculerAncres({ n: regle.n, exemples: textes.map((entree) => ({ entree })) });
  if (JSON.stringify(ancres) !== JSON.stringify(regle.ancres)) return false;
  const ancrees = new Set(ancres.map((a) => a.position));
  const libres = Array.from({ length: regle.n }, (_, i) => i).filter((i) => !ancrees.has(i));
  return JSON.stringify(libres) === JSON.stringify(regle.roles.map((r) => r.position).sort((a, b) => a - b));
}

// Reconnaissance d'un texte par une règle (ancres exactes, même arité) -> { nomDeRole: jeton } | null.
export function valeursSelonRegle(regle, texte) {
  const jetons = tokeniser(texte);
  if (jetons.length !== regle.n) return null;
  if (!regle.ancres.every(({ position, jeton }) => jetons[position] === jeton)) return null;
  return Object.fromEntries(regle.roles.map(({ position, nom }) => [nom, jetons[position]]));
}
// === FIN_LANGAGE_EXPLICATION_SUPERVISEE ===
