// === DEBUT_TEST_TRACES_SCHEMA ===
// v0.46 — « OBSERVATION PASSIVE DES TENTATIVES DE RAISONNEMENT ». Contrat PINGLÉ, daté, volontairement
// rigide (même discipline que tests/action-apprise.test.mjs pour le registre des capacités) : le
// précédent v0.43.0 a démontré qu'ajouter un store IndexedDB SANS incrémenter VERSION_BASE casse le
// téléphone réel (« object store was not found »). Ce test lie EXPLICITEMENT la liste des tables, la
// table CLE et VERSION_BASE : toucher l'une sans toucher consciemment les deux autres fait échouer ce
// test, qui oblige à se poser la question à chaque fois plutôt que de l'oublier en silence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TABLES, CLE, VERSION_BASE } from '../app/langage/connaissances.js';

test('contrat PINGLÉ (02/10) : table "traces" présente, clé "id", VERSION_BASE incrémentée à 10', () => {
  assert.equal(VERSION_BASE, 10, 'VERSION_BASE doit être incrémentée dès qu\'une table est ajoutée (incident v0.43.0).');
  assert.ok(TABLES.includes('traces'), 'la table "traces" doit exister (observation passive des raisonnements).');
  assert.deepEqual(
    [...TABLES].sort(),
    ['actions', 'experiences', 'faits', 'gabaritsTypes', 'hypotheses', 'journal', 'lexique', 'liaisons',
      'patrons', 'proprietes', 'propositions', 'regles', 'traces', 'transformations'].sort(),
  );
  assert.equal(CLE.traces, 'id');
});

test('contrat : chaque table déclarée possède une clé (invariant général, reconfirmé pour "traces")', () => {
  for (const t of TABLES) assert.ok(typeof CLE[t] === 'string' && CLE[t].length > 0, `CLE["${t}"] manquante.`);
});
// === FIN_TEST_TRACES_SCHEMA ===
