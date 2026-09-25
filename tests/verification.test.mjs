// v0.17.4 — GABARITS + VERIFICATION : un moteur GÉNÉRIQUE de correspondance de sous-séquences
// contiguës (contraintes {mot} ou {rôle}), et des DONNÉES (dans bagage.js) qui l'utilisent pour
// représenter deux familles françaises : « est-ce que » et l'inversion (« est-il », « es-tu »,
// « sont-ils », « peut-elle », « veux-tu »…). Le moteur lui-même ne connaît AUCUN mot français.
//
// PÉRIMÈTRE STRICT : `type` devient QUESTION_INFORMATION | VERIFICATION | AFFIRMATION. QUESTION_INFORMATION
// reste PRIORITAIRE (aucune régression sur v0.17.2/v0.17.3). Le « -t- » euphonique (a-t-il, va-t-il,
// parle-t-il) est une LIMITE CONNUE, volontairement non traitée. Aucun changement de repondre(),
// aucune négation, aucune valeur proposée, aucune demande indirecte, aucun changement de decouper().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre, QUESTION_INFORMATION, AFFIRMATION, VERIFICATION } from '../app/langage/comprendre.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';

const lex = {
  ...LEXIQUE_DEPART,
  telephone: { role: 'relation', relation: 'telephone' },
  manteau: { role: 'relation', relation: 'manteau' },
};
const c = (phrase) => comprendre(phrase, { lexique: lex, prenomsConnus: new Set() });

// ============================================================================ 1. LES 6 CAS ROUGES (formes visées)
test('ROUGE → VERT — « Est-ce que mon manteau est bleu ? » : VERIFICATION', () => {
  assert.equal(c('Est-ce que mon manteau est bleu ?').type, VERIFICATION);
});
test('ROUGE → VERT — « Mon manteau est-il bleu ? » : VERIFICATION', () => {
  assert.equal(c('Mon manteau est-il bleu ?').type, VERIFICATION);
});
test('ROUGE → VERT — « Es-tu content ? » : VERIFICATION (nouvelle forme, pure donnée)', () => {
  assert.equal(c('Es-tu content ?').type, VERIFICATION);
});
test('ROUGE → VERT — « Sont-ils prêts ? » : VERIFICATION', () => {
  assert.equal(c('Sont-ils prêts ?').type, VERIFICATION);
});
test('ROUGE → VERT — « Peut-elle venir ? » : VERIFICATION', () => {
  assert.equal(c('Peut-elle venir ?').type, VERIFICATION);
});
test('ROUGE → VERT — « Veux-tu partir ? » : VERIFICATION', () => {
  assert.equal(c('Veux-tu partir ?').type, VERIFICATION);
});

// ============================================================================ 2. type INDÉPENDANT de la réussite de la compréhension
test('VERIFICATION est reconnu même si sujet ET relation restent introuvables (états partiel/incompris)', () => {
  const r1 = c('Es-tu content ?'); // sujet=naissance (tu), relation=null (« content » inconnu) → partiel
  assert.equal(r1.type, VERIFICATION);
  assert.equal(r1.etat, 'partiel');
  const r2 = c('Sont-ils prêts ?'); // « ils » ne résout aucun sujet, « prêts » inconnu → incompris
  assert.equal(r2.type, VERIFICATION);
  assert.equal(r2.etat, 'incompris');
});

// ============================================================================ 3. PRIORITÉ — QUESTION_INFORMATION reste prioritaire (aucune régression)
test('PRIORITÉ — un interrogatif dans le groupe l’emporte toujours sur un gabarit de vérification', () => {
  // Phrase artificielle contenant À LA FOIS un interrogatif et une séquence d'inversion.
  const r = c('Quel est-il, mon manteau ?');
  assert.equal(r.type, QUESTION_INFORMATION, 'jamais VERIFICATION quand un interrogatif est présent dans le groupe');
});
test('VERROU — « Quel est mon manteau ? » reste QUESTION_INFORMATION (« est » présent, sans effet)', () => {
  assert.equal(c('Quel est mon manteau ?').type, QUESTION_INFORMATION);
});
test('VERROU — « Mon manteau est bleu. » reste AFFIRMATION', () => {
  assert.equal(c('Mon manteau est bleu.').type, AFFIRMATION);
});
test('VERROU — « Tu sais quel est mon manteau ? » : QUESTION_INFORMATION, calculée sur le groupe pertinent (v0.17.2)', () => {
  const r = c('Tu sais quel est mon manteau ?');
  assert.equal(r.type, QUESTION_INFORMATION);
  assert.equal(r.sujet, 'moi');
});

// ============================================================================ 4. PIÈGES — un mot isolé (verbe seul, pronom seul) ne suffit jamais
test('PIÈGE — la seule présence de « est » (sans pronom adjacent) ne déclenche pas VERIFICATION', () => {
  assert.equal(c('Mon manteau est bleu.').type, AFFIRMATION);
});
test('PIÈGE — la seule présence de « il », non adjacente à un verbe conjugué, ne déclenche pas VERIFICATION', () => {
  const r = c('Il ment. Mon manteau est bleu.');
  assert.equal(r.type, AFFIRMATION, '« il » et « est » sont présents mais PAS adjacents : jamais un simple mot isolé qui décide');
});
test('PIÈGE — « Il est content. Quel est mon manteau ? » reste QUESTION_INFORMATION sur le manteau, jamais VERIFICATION', () => {
  const r = c('Il est content. Quel est mon manteau ?');
  assert.equal(r.type, QUESTION_INFORMATION);
  assert.equal(r.relation, 'manteau');
});

// ============================================================================ 5. LIMITE CONNUE — le « -t- » euphonique n'est PAS couvert (volontairement)
test('LIMITE CONNUE — « A-t-il un manteau ? » n’est PAS reconnu comme VERIFICATION (documenté, non corrigé)', () => {
  assert.notEqual(c('A-t-il un manteau ?').type, VERIFICATION);
});
test('LIMITE CONNUE — « Va-t-il bien ? » n’est PAS reconnu comme VERIFICATION', () => {
  assert.notEqual(c('Va-t-il bien ?').type, VERIFICATION);
});

// ============================================================================ 6. NON-RÉGRESSION EXPLICITE (v0.17.2 / v0.17.3)
test('VERROU — sujet/relation/état/type inchangés sur un échantillon large des chantiers précédents', () => {
  const lexPortee = { ...LEXIQUE_DEPART, telephone: { role: 'relation', relation: 'telephone' }, manteau: { role: 'relation', relation: 'manteau' }, lampe: { role: 'relation', relation: 'lampe' } };
  const cc = (p) => comprendre(p, { lexique: lexPortee, prenomsConnus: new Set() });
  const attendus = [
    ['Tu sais quel est mon manteau ?', 'moi', 'manteau', QUESTION_INFORMATION],
    ['La lampe est blanche. Quel est mon manteau ?', 'moi', 'manteau', QUESTION_INFORMATION],
    ['Quel est mon téléphone ?', 'moi', 'telephone', QUESTION_INFORMATION],
    ['Mon téléphone ?', 'moi', 'telephone', AFFIRMATION],
    ['Quel est ton téléphone ?', 'naissance', 'telephone', QUESTION_INFORMATION],
    ['Tu peux me rappeler mon téléphone', 'naissance', 'telephone', AFFIRMATION],
  ];
  for (const [p, sujet, relation, type] of attendus) {
    const r = cc(p);
    assert.equal(r.sujet, sujet, p);
    assert.equal(r.relation, relation, p);
    assert.equal(r.type, type, p);
  }
});

// ============================================================================ 7. LE MOTEUR NE DOIT CONTENIR AUCUN MOT NI RÔLE FRANÇAIS EN DUR (statique)
test('STATIQUE — comprendre.js contient un mécanisme générique, les mots/gabarits français viennent de bagage.js', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'comprendre.js'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const motFrancaisEnDur of ["'est-ce'", "'est'", "'il'", "'elle'", "'tu'", "'sont'", "'peut'", "'veux'"]) {
    assert.ok(!code.includes(motFrancaisEnDur), `comprendre.js ne doit contenir aucun mot français en dur (trouvé : ${motFrancaisEnDur})`);
  }
  assert.match(src, /from '\.\/bagage\.js'/, 'les gabarits doivent venir de bagage.js, pas être codés dans comprendre.js');
});

test('type reste un champ MORT : repondre() ne le lit toujours pas', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'esprit.js'), 'utf8');
  assert.doesNotMatch(src, /\.type\b/);
});
