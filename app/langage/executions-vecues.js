// === DEBUT_LANGAGE_EXECUTIONS_VECUES ===
// v0.63.83 — « LES RÉCEPTIONS DÉCLARÉES SONT DES TRANSFORMATIONS VÉCUES » (décision ChatGPT, 09/10/2026). LECTURE SEULE, RECALCUL PUR.
//
// Le point UNIQUE où les mécanismes d'expérience (.69 épisodes → .70 familles → .71 constats → .72 contextes → .74 attentes → .73/.75 issues)
// reçoivent leurs exécutions. Jusqu'ici : la table executionsOperations seule. Désormais : les exécutions réelles PLUS les exécutions
// synthétiques de projeterEnvironnements (v0.63.82) — une par réception DÉCLARÉE (idEmission explicite), « environnement:<nom>(emis =
// production émise) → valeur reçue » —, et le catalogue PLUS la description de chaque environnement ayant répondu. Les mécanismes restent
// inchangés : ils lisent un univers d'exécutions enrichi, rien d'autre.
//
// executionsVecues({ valeurs, executions, emissions, receptions }, descriptions) -> { executions, descriptions }   (pur)
//   executions : [...réelles, ...synthétiques] (tableaux neufs ; les lignes réelles sont les objets reçus, jamais modifiés) ;
//   descriptions : [...descriptions, ...descriptions de canal]. Une émission sans réception n'ajoute RIEN ; une réception indépendante
//   (idEmission null) n'ajoute rien ; aucune causalité par le temps, l'ordre ou le contenu ; aucune valence ; aucun statut.
//   Si la projection refuse (réception incohérente), l'erreur (TypeError) se propage : l'appelant décide (les appelants de la chaîne
//   prospective traitent déjà un TypeError comme « calcul non effectué », jamais comme une panne).
//
// lireExecutionsVecues(magasin, descriptions = DESCRIPTIONS_OPERATIONS) -> Promise<{ valeurs, executions, descriptions }>
//   Lit les quatre tables (valeursDonnees, executionsOperations, emissions, receptions) et applique executionsVecues. Rien n'est écrit :
//   les exécutions synthétiques ne sont JAMAIS persistées ; elles sont recalculées à chaque lecture à partir des faits persistés, sous les
//   identités de ces faits (réception, émission, production) — donc identiques d'une lecture à l'autre et après redémarrage.
import { projeterEnvironnements } from './episodes-environnement.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';

export function executionsVecues(faits, descriptions) {
  if (faits === null || typeof faits !== 'object') throw new TypeError('executionsVecues : faits doit être un objet { valeurs, executions, emissions, receptions }.');
  const { valeurs, executions, emissions, receptions } = faits;
  for (const [nom, l] of [['valeurs', valeurs], ['executions', executions], ['emissions', emissions], ['receptions', receptions]]) if (!Array.isArray(l)) throw new TypeError(`executionsVecues : ${nom} doit être un tableau.`);
  if (!Array.isArray(descriptions)) throw new TypeError('executionsVecues : descriptions doit être un tableau.');
  const projection = projeterEnvironnements(emissions, receptions, valeurs);
  return { executions: [...executions, ...projection.executions], descriptions: [...descriptions, ...projection.descriptions] };
}

export async function lireExecutionsVecues(magasin, descriptions = DESCRIPTIONS_OPERATIONS) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') throw new TypeError('lireExecutionsVecues : magasin doit offrir lireTout.');
  const [valeurs, executions, emissions, receptions] = await Promise.all([
    magasin.lireTout('valeursDonnees'),
    magasin.lireTout('executionsOperations'),
    magasin.lireTout('emissions'),
    magasin.lireTout('receptions'),
  ]);
  const vecues = executionsVecues({ valeurs, executions, emissions, receptions }, descriptions);
  return { valeurs, executions: vecues.executions, descriptions: vecues.descriptions };
}
// === FIN_LANGAGE_EXECUTIONS_VECUES ===
