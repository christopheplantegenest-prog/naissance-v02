// Tests du module non cognitif app/outils/taille.js : formaterTaille(octets).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as module_ from '../app/outils/taille.js';
import { formaterTaille } from '../app/outils/taille.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN = join(RACINE, 'app', 'outils', 'taille.js');
const SOURCE = readFileSync(CHEMIN, 'utf8');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });

test('taille : exemples de la demande', () => {
  assert.equal(formaterTaille(0), '0 o');
  assert.equal(formaterTaille(1536), '1,5 Ko');
  assert.equal(formaterTaille(1048576), '1 Mo');
});

test('taille : unité o, sous 1024', () => {
  assert.equal(formaterTaille(1), '1 o');
  assert.equal(formaterTaille(1023), '1023 o');
});

test('taille : unité Ko, de 1024 à 1048575', () => {
  assert.equal(formaterTaille(1024), '1 Ko');
  assert.equal(formaterTaille(1048575), '1023,9 Ko');
});

test('taille : unité Mo, de 1048576 à 1073741823', () => {
  assert.equal(formaterTaille(1048576), '1 Mo');
  assert.equal(formaterTaille(1073741823), '1023,9 Mo');
});

test('taille : unité Go, dès 1073741824 et sans unité au-delà', () => {
  assert.equal(formaterTaille(1073741824), '1 Go');
  assert.equal(formaterTaille(1099511627776), '1024 Go');
});

test('taille : troncature vers le bas au dixième, jamais de « ,0 »', () => {
  assert.equal(formaterTaille(1126), '1 Ko');
  assert.equal(formaterTaille(1127), '1,1 Ko');
  assert.equal(formaterTaille(2047), '1,9 Ko');
  assert.equal(formaterTaille(1610612736), '1,5 Go');
  assert.equal(formaterTaille(1536.7), '1,5 Ko');
  assert.equal(formaterTaille(0.5), '0,5 o');
  assert.equal(formaterTaille(-0), '0 o');
  for (const v of [0, 1024, 1126, 1048576, 1073741824, 1099511627776]) assert.doesNotMatch(formaterTaille(v), /,0/);
});

test('taille : grandes valeurs sans exposant ni séparateur de milliers', () => {
  assert.equal(formaterTaille(Number.MAX_SAFE_INTEGER), '8388607,9 Go');
  assert.match(formaterTaille(Number.MAX_VALUE), /^\d+ Go$/);
});

test('taille : format strict, séparateur U+0020 unique, virgule, sans espace en bord', () => {
  for (const v of [0, 0.5, 1, 1023, 1024, 1127, 1536, 1048575, 1048576, 1073741823, 1073741824, 1610612736, 1099511627776, Number.MAX_SAFE_INTEGER, Number.MAX_VALUE]) {
    const texte = formaterTaille(v);
    assert.match(texte, /^\d+(,\d)? (o|Ko|Mo|Go)$/, texte);
    assert.equal(texte, texte.trim());
    assert.equal((texte.match(/ /g) || []).length, 1, texte);
    assert.ok(!texte.includes('.'), texte);
  }
});

test('taille : une valeur négative lève une RangeError en français', () => {
  for (const v of [-1, -0.5, -1024, -1048576]) {
    assert.throws(() => formaterTaille(v), (e) => e instanceof RangeError && /taille/.test(e.message) && /négative/.test(e.message), String(v));
  }
});

test('taille : une valeur non number, NaN ou infinie lève une TypeError en français', () => {
  for (const v of ['1536', '', true, null, undefined, {}, [], [1536], 10n, Symbol('s'), NaN, Infinity, -Infinity, new Number(1536)]) {
    assert.throws(() => formaterTaille(v), (e) => e instanceof TypeError && /taille/.test(e.message) && /nombre/.test(e.message), String(typeof v));
  }
  assert.throws(() => formaterTaille(), (e) => e instanceof TypeError && /taille/.test(e.message) && /nombre/.test(e.message));
});

test('taille : aucune conversion implicite de la valeur reçue', () => {
  let appels = 0;
  const piege = { valueOf() { appels++; return 1536; }, toString() { appels++; return '1536'; } };
  assert.throws(() => formaterTaille(piege), TypeError);
  assert.equal(appels, 0);
});

test('taille : garde statique, un seul export formaterTaille et aucun import', () => {
  assert.deepEqual(Object.keys(module_), ['formaterTaille']);
  assert.equal(typeof module_.formaterTaille, 'function');
  assert.doesNotMatch(SOURCE, /\bimport\b/);
  assert.doesNotMatch(SOURCE, /\brequire\s*\(/);
  assert.equal((SOURCE.match(/\bexport\b/g) || []).length, 1);
  assert.match(SOURCE, /^export function formaterTaille\(octets\) \{$/m);
});

test('taille : garde statique, ni horloge, ni hasard, ni réseau, ni stockage, ni locale, ni atelier', () => {
  for (const interdit of [/\bDate\b/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /localStorage/, /sessionStorage/, /indexedDB/, /performance\./, /WebSocket/, /toLocaleString/, /\bIntl\b/, /atelier/i]) {
    assert.doesNotMatch(SOURCE, interdit, String(interdit));
  }
});

test('taille : garde statique, module dormant, nommé par aucun autre fichier de app/ ni sw.js, app/sw.js, index.html', () => {
  const autres = fichiersJs(join(RACINE, 'app')).filter((f) => f !== CHEMIN);
  const cibles = [...autres, join(RACINE, 'sw.js'), join(RACINE, 'app', 'sw.js'), join(RACINE, 'index.html'), join(RACINE, 'app', 'index.html')].filter((f) => existsSync(f));
  const nommants = cibles.filter((f) => /taille\.js/.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f).split(sep).join('/'));
  assert.deepEqual(nommants, []);
});
