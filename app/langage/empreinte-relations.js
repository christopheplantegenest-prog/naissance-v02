// === DEBUT_LANGAGE_EMPREINTE_RELATIONS ===
// v0.63.61 — EMPREINTE SÉPARÉE ET DORMANTE DES CONTRATS RELATIONNELS (décision ChatGPT, 06/10/2026). Équivalent, pour les relations entre entrées, de la phase
// .56 (empreinte de contrat de catégorie) : SÉPARÉE du contrat historique des empreintes (qui ne lit que nom, entrees, sortie : leurs 16 empreintes
// restent EXACTEMENT celles de v0.63.60, gardé par test). Elle couvre exactement : quelles opérations déclarent des relations, le nom de chaque relation,
// l'association rôle -> entrée. Canonisation déterministe : opérations triées par nom (unités de code), relations triées par nom puis par associations,
// rôles dans l'ordre alphabétique ; texte JSON ; SHA-256 hex minuscule. Ajout, suppression, changement de nom, de rôle ou d'entrée associée la change.
// v0.63.62 : PERSISTÉE par observerPossibilites (seul importeur) dans les NOUVELLES observations (génération 9 clés, champ empreintesContratsRelationnels) ;
// toujours NON VÉRIFIÉE à la reconstruction historique (v0.63.63). Elle ne garantit donc pas encore la fidélité relationnelle des observations historiques.
import { validerDescripteurOperation } from './formes-operation.js';
import { sha256Hex } from './sha256.js';

// v0.63.62 : nom de la CATÉGORIE de la preuve relationnelle persistée dans les observations (génération 9 clés). Constante partagée avec le producteur
// d'observation ; les modules de validation structurelle en gardent une copie littérale (validation structurelle, aucun import).
export const CATEGORIE_CONTRATS_RELATIONNELS = 'contrats-relationnels';

const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function canoniqueRelations(descriptions) {
  if (!Array.isArray(descriptions)) throw new TypeError('canoniqueRelations : descriptions doit être un tableau de descripteurs d\'opération.');
  const noms = new Set();
  const operations = [];
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    const place = Object.getOwnPropertyDescriptor(descriptions, String(rang));
    if (place === undefined || !('value' in place)) throw new TypeError(`canoniqueRelations : descriptions[${rang}] absent ou accesseur.`);
    let valide;
    try { valide = validerDescripteurOperation(place.value); } catch (erreur) { throw new TypeError(`canoniqueRelations : descriptions[${rang}] : ${erreur.message}`); }
    if (noms.has(valide.nom)) throw new TypeError(`canoniqueRelations : deux descriptions portent le même nom (rang ${rang}).`);
    noms.add(valide.nom);
    if (valide.relations === undefined) continue;
    const relations = valide.relations.map((r) => {
      const associations = {};
      for (const role of Object.keys(r).filter((c) => c !== 'relation').sort(comparer)) associations[role] = r[role];
      return { relation: r.relation, roles: associations };
    }).sort((a, b) => comparer(JSON.stringify(a), JSON.stringify(b)));
    operations.push({ operation: valide.nom, relations });
  }
  operations.sort((a, b) => comparer(a.operation, b.operation));
  return JSON.stringify(operations);
}

export function empreinteRelations(descriptions) {
  return sha256Hex(canoniqueRelations(descriptions));
}
// === FIN_LANGAGE_EMPREINTE_RELATIONS ===
