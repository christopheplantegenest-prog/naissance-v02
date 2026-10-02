// === DEBUT_TEST_INTERROGATIF_RELATIF ===
// v0.34 — LOT 2, DÉCISION CHATGPT « CHANTIER v0.34.0 » : un mot de rôle INTERROGATIF (bagage.js) peut
// aussi être employé comme RELATIF ordinaire à l'intérieur d'une clause déjà commencée (« ... quoi QUI
// peut produire... », diagnostic automatisé post-v0.33, famille 3). groupePertinent() (comprendre.js)
// démarrait auparavant un nouveau groupe à CHAQUE mot interrogatif, sans jamais vérifier que ce groupe
// était réellement une clause autonome -- perdant le sujet placé AVANT le mot relatif.
// MÉCANISME RETENU (aucune connaissance du mot « qui » lui-même, aucune règle « si qui est précédé
// d'un nom ») : un groupe ouvert par un mot interrogatif n'est retenu comme groupe PERTINENT que s'il
// porte LUI-MÊME un sujet reconnu (trouverSujet) ; sinon, il est fusionné avec le groupe précédent, un
// groupe à la fois, jusqu'à ce qu'un sujet apparaisse ou qu'il n'y ait plus rien à fusionner (repli sur
// l'ancien comportement -- toujours une abstention saine).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre, COMPRIS, PARTIEL, INCOMPRIS } from '../app/langage/comprendre.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';

const lex = {
  ...LEXIQUE_DEPART,
  zrel1: { role: 'relation', relation: 'peut posseder' },
  posseder: { role: 'relation', relation: 'peut posseder' },
  produire: { role: 'relation', relation: 'peut produire' },
};
const sujetsConnus = new Set(['zalpha', 'zintermediaire', 'neril', 'talo']);

test('LOT 2 — NON-RÉGRESSION : « Qui est mon fils ? » reste une VRAIE question interrogative (sujet moi, relation fils)', () => {
  const r = comprendre('Qui est mon fils ?', { lexique: LEXIQUE_DEPART });
  assert.equal(r.sujet, 'moi');
  assert.equal(r.relation, 'fils');
  assert.equal(r.etat, COMPRIS);
});

test('LOT 2 — CAS RÉEL (isolé) — « Un zalpha peut posséder quoi qui peut produire ? » : le sujet « zalpha » n\'est plus perdu', () => {
  const r = comprendre('Un zalpha peut posseder quoi qui peut produire ?', { lexique: lex, sujetsConnus });
  assert.equal(r.sujet, 'zalpha', 'avant ce lot, le mot relatif "qui" tronquait la phrase et perdait "zalpha"');
});

test('LOT 2 — reproduction EXACTE du cas néril/talo/séra : « quoi » inconnu, « qui » relatif, le sujet « neril » doit être retrouvé', () => {
  const r = comprendre('Un neril peut posseder quoi qui peut produire du sera ?', { lexique: lex, sujetsConnus });
  assert.equal(r.sujet, 'neril');
});

test('LOT 2 — PIÈGE (segmentation.test.mjs, non-régression) : deux VRAIES clauses interrogatives, le DERNIER sujet l\'emporte', () => {
  const lexManteau = { ...LEXIQUE_DEPART, couleur: { role: 'relation', relation: 'couleur' }, manteau: { role: 'relation', relation: 'manteau' } };
  const r = comprendre('Quelle est ta couleur, quel est mon manteau ?', { lexique: lexManteau });
  assert.equal(r.sujet, 'moi');
  assert.equal(r.relation, 'manteau');
});

test('LOT 2 — ambiguïté réelle (aucun sujet nulle part, même après fusion complète) → abstention, jamais un choix arbitraire', () => {
  const r = comprendre('Qui peut produire quoi qui peut posseder ?', { lexique: lex, sujetsConnus: new Set() });
  assert.equal(r.sujet, null);
});

test('LOT 2 — aucune réponse confiante à une mauvaise sous-partie : repondre() reste une abstention honnête sur le cas néril', async () => {
  const { magasinMemoireVive } = await import('../app/langage/connaissances.js');
  const { chargerEsprit, apprendreFait, repondre } = await import('../app/langage/esprit.js');
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'neril', relation: 'peut posseder', valeur: 'un talo' });
  await apprendreFait(esprit, { sujet: 'talo', relation: 'peut produire', valeur: 'sera' });
  const r = repondre(esprit, 'Un neril peut posseder quoi qui peut produire du sera ?');
  assert.notEqual(r.texte, 'sera', 'jamais une réponse confiante à la mauvaise sous-partie de la phrase');
  assert.notEqual(r.etat, 'compris', 'tant que le Lot 3 (relations multi-mots) n\'est pas fait, une abstention honnête est attendue ici');
});
// === FIN_TEST_INTERROGATIF_RELATIF ===
