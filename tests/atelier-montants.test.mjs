// v0.65.3 — AT-4 « ÉCRAN ATELIER OFF / MANUEL » (GO « AUTORISATION AT-4 », 17/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune
// acquisition. Frontière écran ↔ registre AT-2 : 1 USD = 1 000 000 microdollars ; lecture par chaînes et entiers seulement (point ou
// virgule, 6 décimales au plus, refus stricts, rien n'est arrondi) ; écriture exacte à virgule (2 à 6 décimales) ; aller-retour exact ;
// pureté ; base / schéma / tables inchangés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/montants.js';
import { lireUSD, ecrireUSD } from '../app/atelier/montants.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(RACINE, 'app', 'atelier', 'montants.js'), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CODE = sansCommentaires(SRC);
const refus = (t) => { const r = lireUSD(t); assert.equal(typeof r, 'object', `refus attendu pour ${String(t)}`); assert.equal(r.refus, true); assert.equal(typeof r.raison, 'string'); assert.ok(Object.isFrozen(r)); };

test('lecture : entiers, point et virgule, 1 à 6 décimales, en microdollars exacts', () => {
  const cas = [['0', 0], ['1', 1000000], ['80', 80000000], ['12,5', 12500000], ['12.5', 12500000], ['12,50', 12500000], ['0,01', 10000], ['0.000001', 1], ['0,000001', 1],
    ['999999,999999', 999999999999], ['100', 100000000], ['0,10', 100000], ['7,123456', 7123456], ['0,0', 0]];
  for (const [t, m] of cas) assert.equal(lireUSD(t), m, t);
});
test('lecture : refus stricts, rien n\'est corrigé ni arrondi', () => {
  for (const t of ['', ' 1', '1 ', '+1', '-1', '1e3', '1E3', '05', '00', '00,5', '1 000', '1.000,00', '1,000.00', '1,2,3', '1..2', '5,', ',5', '.5', '5.', '0,0000001',
    '1,1234567', '1000000', 'Infinity', 'NaN', '0x10', '١', '１', '1\n', '12,5 USD', '$12', '12€', '½']) refus(t);
  for (const v of [null, undefined, 12, 12.5, 0n, {}, [], true]) refus(v);
});
test('écriture exacte : virgule, 2 à 6 décimales, sans arrondi', () => {
  const cas = [[0, '0,00'], [1, '0,000001'], [10, '0,00001'], [10000, '0,01'], [100000, '0,10'], [1000000, '1,00'], [12500000, '12,50'], [7123456, '7,123456'],
    [80000000, '80,00'], [999999999999, '999999,999999'], [Number.MAX_SAFE_INTEGER, '9007199254,740991']];
  for (const [m, t] of cas) assert.equal(ecrireUSD(m), t, String(m));
});
test('écriture : entier sûr >= 0 exigé (TypeError sinon)', () => {
  for (const v of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Infinity, '1', null, undefined, 1n]) assert.throws(() => ecrireUSD(v), TypeError, String(v));
});
test('aller-retour exact : lireUSD(ecrireUSD(m)) === m sur les bornes et un balayage', () => {
  const valeurs = [0, 1, 9, 10, 99, 100, 999, 1000, 10000, 99999, 100000, 999999, 1000000, 1000001, 80000000, 123456789, 999999999999];
  for (let m = 0; m < 3000000; m += 997) valeurs.push(m);
  for (const m of valeurs) assert.equal(lireUSD(ecrireUSD(m)), m, String(m));
  for (const t of ['0,00', '12,50', '7,123456', '0,000001', '999999,999999']) assert.equal(ecrireUSD(lireUSD(t)), t, t);
});
test('pureté : deux exports, aucun import, aucun nombre à virgule ni conversion de chaîne par l\'interpréteur, aucune entrée/sortie', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['ecrireUSD', 'lireUSD']);
  assert.doesNotMatch(CODE, /\bimport\b|\brequire\(/);
  for (const m of [/parseFloat/, /parseInt/, /\bNumber\(/, /toFixed/, /Math\./, /\+\s*texte/, /\*\s*1\b/, /\bDate\b/, /\bfetch\b/, /localStorage/, /indexedDB/, /\bdocument\b/, /\bnavigator\b/, /\bglobalThis\b/, /\bwindow\b/, /\basync\b/, /\bawait\b/]) assert.equal(m.test(CODE), false, String(m));
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  assert.match(SRC, /1 USD = 1 000 000 microdollars/);
  assert.doesNotMatch(SRC, /\bcents?\b|centimes?/i);
});
test('base cognitive inchangée : VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables', () => {
  assert.equal(VERSION_BASE, 29);
  assert.equal(SCHEMA_SAUVEGARDE, 19);
  assert.equal(TABLES.length, 35);
});
