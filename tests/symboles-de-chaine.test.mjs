// v0.63.37 — symbolesDeChaine : points de code Unicode d'une chaîne (pur, dormant). Preuves : ASCII, précomposés, combinant, hors BMP,
// substitut isolé, chaîne vide, refus des non-chaînes, dormance (aucun importeur dans app/), garde statique (aucun mot interdit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';
import * as module from '../app/langage/symboles-de-chaine.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'symboles-de-chaine.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });

test('export nommé unique : symbolesDeChaine', () => {
  assert.deepEqual(Object.keys(module), ['symbolesDeChaine']);
  assert.equal(typeof symbolesDeChaine, 'function');
});

test('ASCII : un élément chaîne par caractère', () => {
  assert.deepEqual(symbolesDeChaine('abc'), ['a', 'b', 'c']);
  assert.deepEqual(symbolesDeChaine(' A1'), [' ', 'A', '1']);
});

test('accents précomposés conservés, casse conservée', () => {
  assert.deepEqual(symbolesDeChaine('éÀ'), ['é', 'À']);
});

test('accent combinant : deux éléments, non fusionnés', () => {
  const r = symbolesDeChaine('é');
  assert.deepEqual(r, ['e', '́']);
  assert.equal(r.length, 2);
});

test('emoji hors BMP : UN seul élément', () => {
  const r = symbolesDeChaine('a😀b');
  assert.deepEqual(r, ['a', '😀', 'b']);
  assert.equal(r[1].length, 2);
});

test('substituts isolés conservés tels quels, un élément chacun', () => {
  assert.deepEqual(symbolesDeChaine('\uD800'), ['\uD800']);
  assert.deepEqual(symbolesDeChaine('\uDC00'), ['\uDC00']);
  assert.deepEqual(symbolesDeChaine('a\uD800b'), ['a', '\uD800', 'b']);
  assert.deepEqual(symbolesDeChaine('\uDC00\uD800'), ['\uDC00', '\uD800']);
});

test('chaîne vide : tableau vide', () => {
  assert.deepEqual(symbolesDeChaine(''), []);
});

test('sortie : chaînes (pas des entiers), tableau neuf à chaque appel', () => {
  const a = symbolesDeChaine('ab');
  assert.ok(a.every((x) => typeof x === 'string'));
  assert.notEqual(a, symbolesDeChaine('ab'));
});

test('aucune normalisation : formes précomposée et décomposée restent distinctes', () => {
  assert.notDeepEqual(symbolesDeChaine('é'), symbolesDeChaine('é'));
});

test('entrée non chaîne : TypeError explicite, sans coercition', () => {
  for (const v of [undefined, null, 42, 0, true, {}, ['a'], Symbol('s'), 1n, () => 'a', new String('abc')]) {
    assert.throws(() => symbolesDeChaine(v), TypeError, String(typeof v));
  }
  assert.throws(() => symbolesDeChaine(), /chaîne est attendue/);
  assert.throws(() => symbolesDeChaine(null), /null/);
});

test('dormance : seul table-operations.js importe symboles-de-chaine', () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38 : la table mécanique des opérations l'importe désormais (invocable) ; aucun autre fichier de app/
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => f !== CHEMIN && /symboles-de-chaine/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(importeurs.map((f) => f.slice(RACINE.length + 1)), ['app/langage/table-operations.js']);
});

test('garde statique : aucun mot interdit, ni temps, magasin, asynchronisme', () => {
  const interdits = ['normalize', 'split', 'trim', 'RegExp', 'toLowerCase', 'toUpperCase', 'codePointAt', 'charAt', 'localeCompare',
    'Date', 'performance', 'setTimeout', 'setInterval', 'indexedDB', 'localStorage', 'sessionStorage', 'async', 'await', 'Promise', 'fetch', 'Math.random'];
  for (const m of interdits) assert.equal(new RegExp(`\\b${m.replace('.', '\\.')}\\b`).test(CODE), false, m);
  assert.equal(/\/[^/\n*][^/\n]*\/[gimsuy]*\s*[.;,)]/.test(CODE.replace(/`[^`]*`/g, '').replace(/'[^'\n]*'/g, '')), false, 'littéral d\'expression régulière');
  assert.equal(/^\s*import\b/m.test(CODE), false, 'aucun import');
  assert.equal(/\bArray\.from\(chaine\)/.test(CODE), true);
});
