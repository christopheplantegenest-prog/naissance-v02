// === DEBUT_TEST_EXTRACTION ===
// v0.37.0 — DÉCISION CHATGPT « LOT B1 : EXTRACTION PURE » (02/10), premier des trois lots de la
// primitive B (« action interne paramétrée apprise »). B1 ne construit QUE la primitive générale
// d'extraction des parties variables d'une phrase reconnue par un squelette appris — AUCUN nom
// sémantique de rôle, AUCUNE opération, AUCUN registre, AUCUNE persistance, AUCUN raccord
// comprendre()/repondre(), AUCUNE UI : ce fichier de tests n'importe donc jamais esprit.js ni
// comprendre.js, seulement extraction.js (nouveau, pur et isolé) et transformation.js (inchangé).
//
// Réutilise STRICTEMENT tokeniser()/calculerAncres()/correspondSquelette() (transformation.js) :
// aucun deuxième algorithme de reconnaissance de squelette n'est créé ici.
//
// Exemple directeur du cadrage (reproduit tel quel) :
//   "za alpha avec beta" / "za gamma avec delta" → ancres {0:"za", 2:"avec"}, variables {1, 3}
//   "za toto avec titi" → { 1: "toto", 3: "titi" }

import test from 'node:test';
import assert from 'node:assert/strict';
import { construireSquelette, extraireVariables } from '../app/langage/extraction.js';

// ---------------------------------------------------------------------------------------------
// FAMILLE 1/2/8 — EXTRACTION CORRECTE DE PLUSIEURS POSITIONS VARIABLES, POSITION EXACTE CONSERVÉE
// ---------------------------------------------------------------------------------------------
test('1/2/8. extraction de plusieurs positions variables, aux positions exactes (exemple directeur du cadrage)', () => {
  const { ok, squelette } = construireSquelette(['za alpha avec beta', 'za gamma avec delta']);
  assert.ok(ok);
  const r = extraireVariables(squelette, 'za toto avec titi');
  assert.deepEqual(r, { 1: 'toto', 3: 'titi' });
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 3 — ENTRÉE NOUVELLE DE MÊME SQUELETTE (jamais vue dans les exemples d'apprentissage)
// ---------------------------------------------------------------------------------------------
test('3. entrée totalement nouvelle, jamais vue, de même squelette → extraction correcte', () => {
  const { squelette } = construireSquelette(['za alpha avec beta', 'za gamma avec delta']);
  const r = extraireVariables(squelette, 'za un avec deux');
  assert.deepEqual(r, { 1: 'un', 3: 'deux' });
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 4 — ANCRE DIFFÉRENTE → AUCUNE CORRESPONDANCE
// ---------------------------------------------------------------------------------------------
test('4. un mot d\'ancre non respecté (« avec » devenu « chez ») → aucune correspondance, jamais une extraction partielle', () => {
  const { squelette } = construireSquelette(['za alpha avec beta', 'za gamma avec delta']);
  assert.equal(extraireVariables(squelette, 'za toto chez titi'), null);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 5 — ARITÉ DIFFÉRENTE → AUCUNE CORRESPONDANCE
// ---------------------------------------------------------------------------------------------
test('5. arité différente (un jeton de plus) → aucune correspondance', () => {
  const { squelette } = construireSquelette(['za alpha avec beta', 'za gamma avec delta']);
  assert.equal(extraireVariables(squelette, 'za toto avec titi en plus'), null);
});

test('5bis. arité différente (un jeton de moins) → aucune correspondance', () => {
  const { squelette } = construireSquelette(['za alpha avec beta', 'za gamma avec delta']);
  assert.equal(extraireVariables(squelette, 'za toto'), null);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 6 — AUCUNE ANCRE → SQUELETTE NON ÉLIGIBLE (même garde-fou que transformation.js)
// ---------------------------------------------------------------------------------------------
test('6. exemples sans aucune position invariante → squelette non éligible, extraction toujours null', () => {
  const { ok, squelette } = construireSquelette(['alpha beta', 'gamma delta']);
  assert.ok(ok, 'construireSquelette reste pure : elle ne juge pas l\'éligibilité, seulement l\'arité');
  // Aucune ancre : n'importe quelle entrée de même arité "correspondrait", donc aucune n'est éligible.
  assert.equal(extraireVariables(squelette, 'alpha beta'), null);
  assert.equal(extraireVariables(squelette, 'un deux'), null);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 7 — UNE SEULE POSITION VARIABLE
// ---------------------------------------------------------------------------------------------
test('7. une seule position variable parmi plusieurs ancres', () => {
  const { squelette } = construireSquelette(['za alpha fixe', 'za beta fixe']);
  const r = extraireVariables(squelette, 'za toto fixe');
  assert.deepEqual(r, { 1: 'toto' });
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 9 — PONCTUATION / TOKENISATION : COMPORTEMENT STRICTEMENT IDENTIQUE À tokeniser()
// ---------------------------------------------------------------------------------------------
test('9. ponctuation déjà isolée en jetons par tokeniser() : aucune nouvelle politique introduite', () => {
  const { squelette } = construireSquelette(['za alpha, avec beta.', 'za gamma, avec delta.']);
  // tokeniser() isole la ponctuation en jetons à part (RE_JETON, transformation.js) : la virgule et
  // le point sont des positions à part entière, et ici invariantes (toujours "," et ".") -- donc des
  // ancres comme n'importe quel autre jeton, sans traitement spécial introduit par extraction.js.
  const r = extraireVariables(squelette, 'za toto, avec titi.');
  assert.deepEqual(r, { 1: 'toto', 4: 'titi' });
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 10 — AUCUNE MUTATION DES EXEMPLES OU DE L'ENTRÉE
// ---------------------------------------------------------------------------------------------
test('10. aucune mutation des exemples fournis ni de l\'entrée, jamais', () => {
  const exemples = Object.freeze(['za alpha avec beta', 'za gamma avec delta']);
  const entree = 'za toto avec titi';
  const { squelette } = construireSquelette(exemples);
  const squeletteAvant = JSON.stringify(squelette);
  extraireVariables(squelette, entree);
  assert.equal(JSON.stringify(squelette), squeletteAvant, 'le squelette ne doit jamais être modifié par une extraction');
  assert.equal(entree, 'za toto avec titi', 'la chaîne d\'entrée (immuable en JS) ne peut de toute façon pas être mutée, vérifié par surcroît');
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 11 — RÉSULTAT DÉTERMINISTE, INDÉPENDANT DE L'ORDRE D'APPEL
// ---------------------------------------------------------------------------------------------
test('11. résultat déterministe : plusieurs appels, dans n\'importe quel ordre, donnent toujours le même résultat', () => {
  const { squelette } = construireSquelette(['za alpha avec beta', 'za gamma avec delta']);
  const r1 = extraireVariables(squelette, 'za toto avec titi');
  const r2 = extraireVariables(squelette, 'za un avec deux');
  const r1bis = extraireVariables(squelette, 'za toto avec titi');
  const r2bis = extraireVariables(squelette, 'za un avec deux');
  assert.deepEqual(r1, r1bis);
  assert.deepEqual(r2, r2bis);
  assert.deepEqual(r1, { 1: 'toto', 3: 'titi' });
});

// ---------------------------------------------------------------------------------------------
// GARDE-FOUS SUPPLÉMENTAIRES SUR construireSquelette() (même discipline que induireTransformation())
// ---------------------------------------------------------------------------------------------
test('construireSquelette : un seul exemple → insuffisant (même plancher que induireTransformation)', () => {
  const r = construireSquelette(['za alpha avec beta']);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'insuffisant');
});

test('construireSquelette : arités incompatibles entre exemples → refus explicite', () => {
  const r = construireSquelette(['za alpha avec beta', 'za gamma avec delta en trop']);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'arites_incompatibles');
});

// === FIN_TEST_EXTRACTION ===
