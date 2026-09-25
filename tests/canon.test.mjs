// v0.17.1 — canoniser() : l'identité d'un mot, cohérente avec ce que decouper() calcule déjà pour
// un mot simple, mais SANS jamais découper ni tronquer (voir canon.js pour le pourquoi).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canoniser, CANON_VERSION } from '../app/langage/canon.js';
import { decouper } from '../app/langage/comprendre.js';

test('mots simples : identique à decouper(x)[0] pour tout mot accentué, capitalisé, ou ASCII', () => {
  for (const x of ['téléphone', 'Téléphone', 'TÉLÉPHONE', 'frère', 'forêt', 'garçon', 'naïf', 'noël',
    'couleur', 'Sac', 'chaîne', 'là', 'où', 'sûr', 'moi', 'naissance', 'fils', 'nom', 'a', 'à']) {
    assert.equal(canoniser(x), decouper(x)[0], x);
  }
});

test('AUCUNE troncature ni découpage : tiret et apostrophe conservés (contrairement à decouper)', () => {
  assert.equal(canoniser('Jean-Pierre'), 'jean-pierre');
  assert.equal(canoniser('porte-monnaie'), 'porte-monnaie');
  assert.equal(canoniser('porte‑monnaie'), 'porte-monnaie', 'tiret typographique unifié en tiret simple');
  assert.equal(canoniser('l’ami'), "l'ami");
  assert.equal(canoniser("L'AMI"), "l'ami");
  assert.equal(canoniser('cœur'), 'cœur', 'jamais réduit à « c »');
  assert.equal(canoniser('Œuf'), 'œuf', 'jamais réduit à « uf »');
  assert.notEqual(canoniser('cœur'), decouper('cœur')[0], 'ici canoniser diffère de decouper : c’est voulu, pas un bug');
});

test('espaces : multiples et insécables réduits, bords retirés', () => {
  assert.equal(canoniser('  pomme   de  terre  '), 'pomme de terre');
  assert.equal(canoniser('pomme\u00A0de\u00A0terre'), 'pomme de terre');
});

test('idempotence : canoniser(canoniser(x)) === canoniser(x)', () => {
  for (const x of ['Téléphone', 'Jean-Pierre', "L'AMI", '  Sac  ', 'cœur', '']) {
    assert.equal(canoniser(canoniser(x)), canoniser(x), x);
  }
});

test('NFC et NFD du même mot donnent la même identité', () => {
  assert.equal(canoniser('été'), canoniser('e\u0301te\u0301'));
});

test('entrées vides ou absentes → chaîne vide, jamais une exception', () => {
  assert.equal(canoniser(''), '');
  assert.equal(canoniser(undefined), '');
  assert.equal(canoniser(null), '');
  assert.equal(canoniser('   '), '');
});

test('CANON_VERSION est exportée (permet de faire évoluer le modèle sans migration de données)', () => {
  assert.equal(typeof CANON_VERSION, 'number');
});

test('STATIQUE — canon.js n’importe rien (module pur, autonome)', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'canon.js'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /^import /m);
});
