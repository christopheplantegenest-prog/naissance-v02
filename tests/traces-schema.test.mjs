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
// MISE À JOUR DÉLIBÉRÉE (03/10/2026, v0.62.0, ÉTAPE 6 « CONSERVATION BRUTE D'UN ÉNONCÉ ENVOYÉ EN
// RÉPONSE À UNE TRACE ») : ajout de 'enonces' et passage à VERSION_BASE=12, intentionnels et documentés.
// MISE À JOUR DÉLIBÉRÉE (03/10/2026, v0.62.4, « OBSERVATIONS DE COMPOSITION ») : ajout de
// 'observationsComposition' et passage à VERSION_BASE=13, intentionnels et documentés.
// MISE À JOUR DÉLIBÉRÉE (04/10/2026, v0.63.0, « OBSERVATION PASSIVE DE LA COMPRÉHENSION ») : ajout de
// 'observationsLangage' et passage à VERSION_BASE=14, intentionnels et documentés.
// MISE À JOUR DÉLIBÉRÉE (04/10/2026, v0.63.16, « OBSERVATION DES POSSIBILITÉS ») : ajout de
// 'observationsPossibilites' et passage à VERSION_BASE=15, intentionnels et documentés.
test('contrat PINGLÉ (04/10, v0.63.0) : tables "traces", "actes", "enonces", "observationsComposition" et "observationsLangage" présentes, clé "id", VERSION_BASE incrémentée à 19 (v0.63.27 : + valeursDonnees ; v0.63.22 : + designations ; v0.63.19 : + executionsOperations ; v0.63.16 : + observationsPossibilites)', () => {
  assert.equal(VERSION_BASE, 23, 'VERSION_BASE doit être incrémentée dès qu\'une table est ajoutée (incident v0.43.0).'); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables)
  assert.ok(TABLES.includes('traces'), 'la table "traces" doit exister (observation passive des raisonnements).');
  assert.ok(TABLES.includes('actes'), 'la table "actes" doit exister (acte explicite persistant portant sur une trace).');
  assert.ok(TABLES.includes('enonces'), 'la table "enonces" doit exister (énoncé envoyé en réponse à une trace).');
  assert.ok(TABLES.includes('observationsComposition'), 'la table "observationsComposition" doit exister (observation d\'une composition).');
  assert.ok(TABLES.includes('observationsLangage'), 'la table "observationsLangage" doit exister (observation passive de la compréhension).');
  assert.deepEqual(
    [...TABLES].sort(),
    ['actes', 'actions', 'designations', 'enonces', 'experiences', 'faits', 'gabaritsTypes', 'hypotheses', 'journal', 'lexique', 'liaisons',
      'executionsOperations', 'observationsComposition', 'observationsLangage', 'observationsPossibilites', 'patrons', 'proprietes', 'propositions', 'regles', 'traces', 'transformations', 'valeursDonnees', 'emissions', 'receptions', 'contextesProspectifs', 'attentesProspectives', 'capaciteInitiale', 'variationsCapacite'].sort(), /* MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1) : + capaciteInitiale, variationsCapacite */ // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentesProspectives // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contextesProspectifs
  );
  assert.equal(CLE.traces, 'id');
  assert.equal(CLE.actes, 'id');
  assert.equal(CLE.enonces, 'id');
  assert.equal(CLE.observationsComposition, 'id');
  assert.equal(CLE.observationsLangage, 'id');
  assert.equal(CLE.observationsPossibilites, 'id');
  assert.equal(CLE.designations, 'id'); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : table designations (base 17)
  assert.equal(CLE.valeursDonnees, 'id'); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(CLE.executionsOperations, 'id'); // MISE À JOUR DÉLIBÉRÉE v0.63.19 : table executionsOperations (base 16)
});

test('contrat : chaque table déclarée possède une clé (invariant général, reconfirmé pour "traces")', () => {
  for (const t of TABLES) assert.ok(typeof CLE[t] === 'string' && CLE[t].length > 0, `CLE["${t}"] manquante.`);
});
// === FIN_TEST_TRACES_SCHEMA ===
