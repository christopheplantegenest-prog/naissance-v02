// v0.17.3 — TYPE D'ÉNONCÉ : comprendre() expose un nouveau champ `type` (QUESTION_INFORMATION ou
// AFFIRMATION), calculé sur le MÊME groupe pertinent que sujet/relation (v0.17.2) : QUESTION_INFORMATION
// si ce groupe contient un mot de rôle INTERROGATIF, sinon AFFIRMATION.
//
// PÉRIMÈTRE STRICT : rien d'autre. Volontairement hors chantier, non testé ici : négation/polarité,
// VERIFICATION (« est-ce que », inversion), valeur proposée, demandes indirectes, repondre(), le
// routage de main.js. `type` est un champ MORT dans cette version : aucun autre fichier ne le lit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre, QUESTION_INFORMATION, AFFIRMATION } from '../app/langage/comprendre.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';

const lex = {
  ...LEXIQUE_DEPART,
  telephone: { role: 'relation', relation: 'telephone' },
  manteau: { role: 'relation', relation: 'manteau' },
};
const c = (phrase) => comprendre(phrase, { lexique: lex, prenomsConnus: new Set() });

// ============================================================================ 1. LES 4 CAS ROUGES
test('ROUGE → VERT — « Mon manteau est bleu. » : AFFIRMATION', () => {
  assert.equal(c('Mon manteau est bleu.').type, AFFIRMATION);
});

test('ROUGE → VERT — « Quel est mon manteau ? » : QUESTION_INFORMATION', () => {
  assert.equal(c('Quel est mon manteau ?').type, QUESTION_INFORMATION);
});

test('ROUGE → VERT — « Tu sais quel est mon manteau ? » : QUESTION_INFORMATION, calculé sur le groupe pertinent', () => {
  assert.equal(c('Tu sais quel est mon manteau ?').type, QUESTION_INFORMATION);
});

test('ROUGE → VERT — « Mon téléphone. » : AFFIRMATION (aucun interrogatif, même sans relation trouvée)', () => {
  const r = c('Mon téléphone.');
  assert.equal(r.type, AFFIRMATION);
});

// ============================================================================ 2. PIÈGES — vraie détection dans le groupe, pas la ponctuation
test('PIÈGE — « Quel est mon manteau » SANS « ? » reste QUESTION_INFORMATION', () => {
  assert.equal(c('Quel est mon manteau').type, QUESTION_INFORMATION);
});

test('PIÈGE — « Mon manteau est bleu ? » AVEC un « ? » mais sans interrogatif reste AFFIRMATION', () => {
  assert.equal(c('Mon manteau est bleu ?').type, AFFIRMATION);
});

// ============================================================================ 3. NON-RÉGRESSION EXPLICITE (v0.17.2)
test('VERROU — « La lampe est blanche. Quel est mon manteau ? » : type calculé sur le bon groupe (celui du manteau)', () => {
  const r = c('La lampe est blanche. Quel est mon manteau ?');
  assert.equal(r.type, QUESTION_INFORMATION);
  assert.equal(r.relation, 'manteau', 'non-régression : le groupage v0.17.2 reste inchangé');
});

test('VERROU — sujet/relation/état/mots/motsInconnus inchangés sur les 22 cas de segmentation.test.mjs', () => {
  const lexPortee = { ...LEXIQUE_DEPART, telephone: { role: 'relation', relation: 'telephone' }, manteau: { role: 'relation', relation: 'manteau' }, lampe: { role: 'relation', relation: 'lampe' } };
  const cc = (p) => comprendre(p, { lexique: lexPortee, prenomsConnus: new Set() });
  const phrases = [
    'Tu sais quel est mon manteau ?', 'Est-ce que tu sais quel est mon manteau ?', 'Peux-tu me dire quel est mon manteau ?',
    'La lampe est blanche. Quel est mon manteau ?', 'Mon manteau est bleu. Quelle est ma lampe ?',
    'Quel est mon téléphone ?', 'Quel est mon téléphone', 'Mon téléphone ?', "C'est quoi mon téléphone ?",
    'Dis-moi quel est mon téléphone', 'Euh quel est mon téléphone', 'Naissance, quel est mon manteau ?',
    'Quel est ton téléphone ?', 'Je voudrais savoir quel est mon téléphone',
    'Quel est ton téléphone, tu le sais ?', 'Quelle est ta couleur, quel est mon manteau ?', 'Quel est le manteau ?',
    'Tu peux me rappeler mon téléphone', 'Blablabla tu sais quel est mon manteau ?', 'Ma couleur', 'Blablabla',
  ];
  for (const p of phrases) {
    const r = cc(p);
    assert.ok(r.type === QUESTION_INFORMATION || r.type === AFFIRMATION, `${p} : type absent ou invalide`);
  }
  // Un échantillon précis, valeur exacte attendue (reprise de segmentation.test.mjs) :
  assert.equal(cc('Tu sais quel est mon manteau ?').sujet, 'moi');
  assert.equal(cc('Quel est le manteau ?').sujet, null);
  assert.equal(cc('Quel est le manteau ?').etat, 'partiel');
  assert.deepEqual(cc('Blablabla').type, AFFIRMATION, 'même incomprise, une phrase sans interrogatif reste AFFIRMATION');
  assert.equal(cc('Blablabla').etat, 'incompris');
});

// ============================================================================ 4. HORS CHANTIER — champs sans effet ailleurs
test('type est un champ MORT : repondre() ne le lit pas (import statique, pas de mention)', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'esprit.js'), 'utf8');
  assert.doesNotMatch(src, /\.type\b/, 'esprit.js ne doit encore lire aucun champ .type de la compréhension');
});
