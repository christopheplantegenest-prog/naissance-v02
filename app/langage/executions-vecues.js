// === DEBUT_LANGAGE_EXECUTIONS_VECUES ===
// v0.63.83 — « LES RÉCEPTIONS DÉCLARÉES SONT DES TRANSFORMATIONS VÉCUES » (décision ChatGPT, 09/10/2026). LECTURE SEULE, RECALCUL PUR.
// v0.63.84 — « L'ÉTAT PROPRE EST UNE TRANSFORMATION VÉCUE » (B1, décision ChatGPT du 10/10/2026) : la projection « soi » s'ajoute ici, et nulle part ailleurs.
//
// Le point UNIQUE où les mécanismes d'expérience (.69 épisodes → .70 familles → .71 constats → .72 contextes → .74 attentes → .73/.75 issues)
// reçoivent leurs exécutions ET leurs lignes de valeurs. Jusqu'à .82 : la table executionsOperations seule. Depuis .83 : les exécutions réelles
// PLUS les exécutions synthétiques de projeterEnvironnements (une par réception DÉCLARÉE). Depuis .84 : PLUS la projection de l'état propre
// (projeterSoi) — une exécution synthétique « soi:tour / soi:repos (etat = état d'avant) → nouvel état » par variation de capacité persistée, et
// les DONNÉES D'ÉTAT elles-mêmes (origine et états d'après), lignes { id, valeur, source } concaténées aux messages (resoudre-identites.js lit la
// déclaration de source portée : aucune donnée d'état n'est prise pour un message). Les mécanismes restent inchangés : ils lisent un univers de
// faits enrichi, rien d'autre. Les données du monde et les données de soi ne se mélangent dans aucun épisode (aucune exécution ne relie les unes
// aux autres) : les familles sont disjointes, les attentes du monde ne changent pas.
//
// executionsVecues({ valeurs, executions, emissions, receptions, capaciteInitiale = [], variationsCapacite = [] }, descriptions)
//   -> { valeurs, executions, descriptions }   (pur)
//   valeurs : [...valeurs, ...données d'état projetées] ; executions : [...réelles, ...environnements, ...soi] (tableaux neufs ; les lignes
//   réelles sont les objets reçus, jamais modifiés) ; descriptions : [...descriptions, ...canaux, ...soi:*]. Une émission sans réception n'ajoute
//   RIEN ; une réception indépendante (idEmission null) n'ajoute rien ; sans origine de capacité (table vide), RIEN de soi n'est ajouté ; aucune
//   causalité par le temps, l'ordre ou le contenu ; aucune valence ; aucun statut.
//   Si une projection refuse (fait incohérent), l'erreur (TypeError) se propage : l'appelant décide (les appelants de la chaîne prospective
//   traitent déjà un TypeError comme « calcul non effectué », jamais comme une panne).
//
// lireExecutionsVecues(magasin, descriptions = DESCRIPTIONS_OPERATIONS) -> Promise<{ valeurs, executions, descriptions }>
//   Lit les six tables (valeursDonnees, executionsOperations, emissions, receptions, capaciteInitiale, variationsCapacite) et applique
//   executionsVecues. Rien n'est écrit : les lignes synthétiques ne sont JAMAIS persistées ; elles sont recalculées à chaque lecture à partir des
//   faits persistés, sous les identités de ces faits (réception, émission, production ; variation, cause, état dérivé) — donc identiques d'une
//   lecture à l'autre et après redémarrage.
import { projeterEnvironnements } from './episodes-environnement.js';
import { projeterSoi } from './projection-soi.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';

export function executionsVecues(faits, descriptions) {
  if (faits === null || typeof faits !== 'object') throw new TypeError('executionsVecues : faits doit être un objet { valeurs, executions, emissions, receptions[, capaciteInitiale, variationsCapacite] }.');
  const { valeurs, executions, emissions, receptions } = faits;
  const capaciteInitiale = Object.hasOwn(faits, 'capaciteInitiale') ? faits.capaciteInitiale : [];
  const variationsCapacite = Object.hasOwn(faits, 'variationsCapacite') ? faits.variationsCapacite : [];
  for (const [nom, l] of [['valeurs', valeurs], ['executions', executions], ['emissions', emissions], ['receptions', receptions], ['capaciteInitiale', capaciteInitiale], ['variationsCapacite', variationsCapacite]]) if (!Array.isArray(l)) throw new TypeError(`executionsVecues : ${nom} doit être un tableau.`);
  if (!Array.isArray(descriptions)) throw new TypeError('executionsVecues : descriptions doit être un tableau.');
  const projection = projeterEnvironnements(emissions, receptions, valeurs);
  if (capaciteInitiale.length > 1) throw new TypeError('executionsVecues : plusieurs origines de capacité (une seule attendue).');
  const soi = capaciteInitiale.length === 1 ? projeterSoi(capaciteInitiale[0], variationsCapacite) : { valeurs: [], executions: [], descriptions: [] };
  return {
    valeurs: [...valeurs, ...soi.valeurs],
    executions: [...executions, ...projection.executions, ...soi.executions],
    descriptions: [...descriptions, ...projection.descriptions, ...soi.descriptions],
  };
}

export async function lireExecutionsVecues(magasin, descriptions = DESCRIPTIONS_OPERATIONS) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') throw new TypeError('lireExecutionsVecues : magasin doit offrir lireTout.');
  const [valeurs, executions, emissions, receptions, capaciteInitiale, variationsCapacite] = await Promise.all([
    magasin.lireTout('valeursDonnees'),
    magasin.lireTout('executionsOperations'),
    magasin.lireTout('emissions'),
    magasin.lireTout('receptions'),
    magasin.lireTout('capaciteInitiale'),
    magasin.lireTout('variationsCapacite'),
  ]);
  return executionsVecues({ valeurs, executions, emissions, receptions, capaciteInitiale, variationsCapacite }, descriptions);
}
// === FIN_LANGAGE_EXECUTIONS_VECUES ===
