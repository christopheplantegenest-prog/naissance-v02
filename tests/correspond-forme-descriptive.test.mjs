// === DEBUT_TEST_CORRESPOND_FORME_DESCRIPTIVE ===
// PRIMITIVE PURE DE CORRESPONDANCE FORME DESCRIPTIVE / TEXTE PRÉSENT (décision ChatGPT, 03/10/2026,
// suite au diagnostic « CORRESPONDANCE FORME DESCRIPTIVE / TEXTE PRÉSENT » du même jour). Ces tests
// figent le contrat exact : seuls rapport.n et rapport.ancres sont utilisés (jamais
// positionsVariables/diversite/occurrences/exemplesDistincts/couverture, jamais capacité/arguments/
// résultat), tokenisation strictement celle de tokeniser() existant, AUCUNE canonisation
// supplémentaire. Une forme sans ancre (rapport.ancres.length===0) ne correspond JAMAIS — décision
// de conception explicite et définitive pour ce chantier, alignée sur le garde-fou déjà présent dans
// correspondSquelette() (transformation.js). AUCUN branchement testé ici : voir plus bas la
// vérification explicite de non-branchement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { correspondFormeDescriptive, vueDescriptive } from '../app/langage/vue-traces.js';

function rapport(n, ancres) {
  // Un rapport MINIMAL, conforme au contrat réel de decrireStructure() (ancres:[{position,jeton}]),
  // mais enrichi de champs que le contrat interdit explicitement de lire (section M) : leur
  // présence/valeur ne doit jamais influencer correspondFormeDescriptive().
  return {
    ok: true, n, ancres, positionsVariables: [], diversite: {}, occurrences: 0, exemplesDistincts: 0,
  };
}

function traceAction(id, texteBrut, capacite = 'quelque-capacite') {
  return { id, voie: 'action', capacite, contexte: { texteBrut, tokens: [] } };
}

// --- A/B/C : forme "zaccede * zordre *" -----------------------------------------------------------
const formeAccedeOrdre = rapport(4, [{ position: 0, jeton: 'zaccede' }, { position: 2, jeton: 'zordre' }]);

test('correspondFormeDescriptive() : A. toutes les ancres correspondent -> true', () => {
  assert.equal(correspondFormeDescriptive(formeAccedeOrdre, 'zaccede zalpha zordre zbeta'), true);
});

test('correspondFormeDescriptive() : B. une ancre violée -> false', () => {
  assert.equal(correspondFormeDescriptive(formeAccedeOrdre, 'zaccede zalpha zautre zbeta'), false);
});

test('correspondFormeDescriptive() : C. arité différente (token supplémentaire) -> false', () => {
  assert.equal(correspondFormeDescriptive(formeAccedeOrdre, 'zaccede zalpha zordre zbeta zextra'), false);
});

// --- D : forme "zaccede * * *" ---------------------------------------------------------------------
const formeAccedeSeul = rapport(4, [{ position: 0, jeton: 'zaccede' }]);

test('correspondFormeDescriptive() : D. une seule ancre, positions variables sans contrainte -> true', () => {
  assert.equal(correspondFormeDescriptive(formeAccedeSeul, 'zaccede x y z'), true);
});

// --- E/F : forme entièrement variable (ancres=[]) ---------------------------------------------------
const formeEntierementVariable = rapport(3, []);

test('correspondFormeDescriptive() : E. forme entièrement variable (ancres=[]) -> false, décision explicite', () => {
  assert.equal(correspondFormeDescriptive(formeEntierementVariable, 'nimporte quoi ici'), false);
});

test('correspondFormeDescriptive() : F. forme entièrement variable, même avec la bonne arité -> false quand même', () => {
  assert.equal(correspondFormeDescriptive(formeEntierementVariable, 'un deux trois'), false);
  assert.equal(correspondFormeDescriptive(formeEntierementVariable, 'un deux trois quatre'), false);
});

// --- G/H : forme entièrement ancrée (duplicata exact) ------------------------------------------------
const formeEntierementAncree = rapport(4, [
  { position: 0, jeton: 'zaccede' }, { position: 1, jeton: 'zorbo' },
  { position: 2, jeton: 'zordre' }, { position: 3, jeton: 'zkelmi' },
]);

test('correspondFormeDescriptive() : G. forme entièrement ancrée, texte exact -> true', () => {
  assert.equal(correspondFormeDescriptive(formeEntierementAncree, 'zaccede zorbo zordre zkelmi'), true);
});

test('correspondFormeDescriptive() : H. forme entièrement ancrée, un seul token différent -> false', () => {
  assert.equal(correspondFormeDescriptive(formeEntierementAncree, 'zaccede zorbo zordre zautrechose'), false);
});

// --- I : diversité historique jamais un vocabulaire fermé ---------------------------------------------
test('correspondFormeDescriptive() : I. position variable, token jamais observé historiquement -> true si les ancres correspondent', () => {
  // Le rapport ne porte même pas de diversite ici (positionsVariables/diversite volontairement
  // absents de ce rapport minimal), pour démontrer qu'ils ne sont jamais consultés.
  const forme = { ok: true, n: 3, ancres: [{ position: 0, jeton: 'zaime' }] };
  assert.equal(correspondFormeDescriptive(forme, 'zaime les elephants'), true);
});

// --- J : deux formes concurrentes, appels séparés, aucune priorité -------------------------------------
test('correspondFormeDescriptive() : J. texte correspondant à une forme large ET une forme entièrement ancrée -> true pour chacune, séparément', () => {
  const texte = 'zaccede zorbo zordre zkelmi';
  assert.equal(correspondFormeDescriptive(formeAccedeOrdre, texte), true);
  assert.equal(correspondFormeDescriptive(formeEntierementAncree, texte), true);
});

// --- K : texte vide/null/undefined ------------------------------------------------------------------
test('correspondFormeDescriptive() : K. texte vide/null/undefined -> false (arité 0, sans exception spéciale)', () => {
  assert.equal(correspondFormeDescriptive(formeAccedeSeul, ''), false);
  assert.equal(correspondFormeDescriptive(formeAccedeSeul, null), false);
  assert.equal(correspondFormeDescriptive(formeAccedeSeul, undefined), false);
});

// --- L : ponctuation/casse/accents, comportement strict de tokeniser() --------------------------------
test('correspondFormeDescriptive() : L. casse/accents sensibles, ponctuation tokenisée séparément (comportement de tokeniser())', () => {
  const formeAccent = rapport(2, [{ position: 0, jeton: 'Été' }]);
  assert.equal(correspondFormeDescriptive(formeAccent, 'Été chaud'), true);
  assert.equal(correspondFormeDescriptive(formeAccent, 'ete chaud'), false); // sensible à l'accent/casse
  const formePonctuation = rapport(3, [{ position: 1, jeton: '.' }]);
  assert.equal(correspondFormeDescriptive(formePonctuation, 'bonjour . oui'), true);
});

// --- M : diversite/occurrences/exemplesDistincts/positionsVariables n'influencent jamais le résultat ---
test('correspondFormeDescriptive() : M. modifier diversite/occurrences/exemplesDistincts/positionsVariables seuls ne change jamais le résultat', () => {
  const texte = 'zaccede zalpha zordre zbeta';
  const base = correspondFormeDescriptive(formeAccedeOrdre, texte);
  const variante = correspondFormeDescriptive({
    ...formeAccedeOrdre,
    positionsVariables: [1, 3],
    diversite: { 1: { valeursDistinctes: ['zalpha', 'zautre'], nombre: 2 } },
    occurrences: 999,
    exemplesDistincts: 999,
  }, texte);
  assert.equal(base, true);
  assert.equal(variante, true);

  const texteFaux = 'zaccede zalpha zautre zbeta';
  const baseFaux = correspondFormeDescriptive(formeAccedeOrdre, texteFaux);
  const varianteFaux = correspondFormeDescriptive({
    ...formeAccedeOrdre,
    positionsVariables: [],
    diversite: null,
    occurrences: 1,
    exemplesDistincts: 1,
  }, texteFaux);
  assert.equal(baseFaux, false);
  assert.equal(varianteFaux, false);
});

// --- N : contrat réel entre vueDescriptive() et correspondFormeDescriptive() ---------------------------
test('correspondFormeDescriptive() : N. utilisée directement sur un rapport RÉELLEMENT produit par vueDescriptive()', () => {
  const traces = [
    traceAction('n1', 'zaccede zorbo zordre zkelmi'),
    traceAction('n2', 'zaccede zalpha zordre zbeta'),
    traceAction('n3', 'zaccede zgamma zordre zdelta'),
  ];
  const vue = vueDescriptive(traces);
  assert.ok(vue.length >= 1);
  const element = vue.find((e) => e.rapport.ancres.length > 0);
  assert.ok(element, 'au moins un élément avec ancres doit exister pour ce corpus');
  assert.equal(correspondFormeDescriptive(element.rapport, 'zaccede znouveau zordre zbeta'), true);
  assert.equal(correspondFormeDescriptive(element.rapport, 'zautrechose znouveau zordre zbeta'), false);
});
// === FIN_TEST_CORRESPOND_FORME_DESCRIPTIVE ===
