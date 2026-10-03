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

// MISE À JOUR DÉLIBÉRÉE (03/10/2026, chantier « ACTE EXPLICITE PERSISTANT PORTANT SUR UNE TRACE ») :
// même discipline que la mise à jour du test PINGLÉ de tests/sauvegarde-complete.test.mjs lors du
// chantier « RÉFÉRENCE EXPLICITE ENTRE VÉCUS » — ce contrat est VOLONTAIREMENT rigide pour forcer à
// se poser consciemment la question à chaque table ajoutée ; l'ajout de 'actes' et le passage à
// VERSION_BASE=11 sont ici intentionnels et documentés, jamais un contournement silencieux.
test('contrat PINGLÉ (03/10, mis à jour) : tables "traces" et "actes" présentes, clé "id", VERSION_BASE incrémentée à 11', () => {
  assert.equal(VERSION_BASE, 11, 'VERSION_BASE doit être incrémentée dès qu\'une table est ajoutée (incident v0.43.0).');
  assert.ok(TABLES.includes('traces'), 'la table "traces" doit exister (observation passive des raisonnements).');
  assert.ok(TABLES.includes('actes'), 'la table "actes" doit exister (acte explicite persistant portant sur une trace).');
  assert.deepEqual(
    [...TABLES].sort(),
    ['actes', 'actions', 'experiences', 'faits', 'gabaritsTypes', 'hypotheses', 'journal', 'lexique', 'liaisons',
      'patrons', 'proprietes', 'propositions', 'regles', 'traces', 'transformations'].sort(),
  );
  assert.equal(CLE.traces, 'id');
  assert.equal(CLE.actes, 'id');
});

test('contrat : chaque table déclarée possède une clé (invariant général, reconfirmé pour "traces")', () => {
  for (const t of TABLES) assert.ok(typeof CLE[t] === 'string' && CLE[t].length > 0, `CLE["${t}"] manquante.`);
});
// === FIN_TEST_TRACES_SCHEMA ===
