// Tests du module non cognitif app/outils/duree.js : formaterDuree(ms).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as module_ from '../app/outils/duree.js';
import { formaterDuree } from '../app/outils/duree.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHEMIN = join(RACINE, 'app', 'outils', 'duree.js');
const SOURCE = readFileSync(CHEMIN, 'utf8');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });

test('duree : exemples de la demande', () => {
  assert.equal(formaterDuree(3723000), '1 h 2 min 3 s');
  assert.equal(formaterDuree(45000), '45 s');
  assert.equal(formaterDuree(0), '0 s');
});

test('duree : les unités nulles sont omises', () => {
  assert.equal(formaterDuree(3600000), '1 h');
  assert.equal(formaterDuree(3603000), '1 h 3 s');
  assert.equal(formaterDuree(60000), '1 min');
  assert.equal(formaterDuree(3660000), '1 h 1 min');
  assert.equal(formaterDuree(59000), '59 s');
  assert.equal(formaterDuree(3599000), '59 min 59 s');
});

test('duree : millisecondes tronquées vers le bas, -0 donne 0 s', () => {
  assert.equal(formaterDuree(999), '0 s');
  assert.equal(formaterDuree(1000), '1 s');
  assert.equal(formaterDuree(1999), '1 s');
  assert.equal(formaterDuree(45999.7), '45 s');
  assert.equal(formaterDuree(0.5), '0 s');
  assert.equal(formaterDuree(-0), '0 s');
});

test('duree : pas d\'unité jour, minutes et secondes entre 0 et 59', () => {
  assert.equal(formaterDuree(90000000), '25 h');
  assert.equal(formaterDuree(86400000), '24 h');
  assert.equal(formaterDuree(86399000), '23 h 59 min 59 s');
  assert.equal(formaterDuree(90061000), '25 h 1 min 1 s');
  for (const ms of [0, 59000, 60000, 3599000, 3600000, 3723000, 86399999, 90061000, 123456789]) {
    const texte = formaterDuree(ms);
    const min = texte.match(/(\d+) min/);
    const s = texte.match(/(\d+) s$/);
    if (min) assert.ok(Number(min[1]) >= 0 && Number(min[1]) <= 59, texte);
    if (s) assert.ok(Number(s[1]) >= 0 && Number(s[1]) <= 59, texte);
  }
});

test('duree : séparateur U+0020 unique, sans espace en début ni en fin', () => {
  for (const ms of [0, 999, 45000, 60000, 3600000, 3603000, 3660000, 3723000, 90000000, 90061000]) {
    const texte = formaterDuree(ms);
    assert.match(texte, /^\d+ (h|min|s)( \d+ (h|min|s))*$/, texte);
    assert.equal(texte, texte.trim());
    assert.ok(!/ {2}/.test(texte), texte);
    for (const c of texte) assert.ok(/[0-9hmins ]/.test(c), `caractère inattendu U+${c.codePointAt(0).toString(16)}`);
  }
});

test('duree : une valeur négative lève une RangeError en français', () => {
  for (const v of [-1, -1000, -0.5, -3723000]) {
    assert.throws(() => formaterDuree(v), (e) => e instanceof RangeError && /durée/.test(e.message) && /négative/.test(e.message));
  }
});

test('duree : une valeur non number, NaN ou infinie lève une TypeError en français', () => {
  for (const v of ['45000', '', true, false, null, undefined, {}, [], [45000], 10n, Symbol('s'), NaN, Infinity, -Infinity, new Number(45000)]) {
    assert.throws(() => formaterDuree(v), (e) => e instanceof TypeError && /durée/.test(e.message) && /nombre/.test(e.message), String(typeof v));
  }
  assert.throws(() => formaterDuree(), TypeError);
});

test('duree : aucune conversion implicite de la valeur reçue', () => {
  let appels = 0;
  const piege = { valueOf() { appels++; return 45000; }, toString() { appels++; return '45000'; } };
  assert.throws(() => formaterDuree(piege), TypeError);
  assert.equal(appels, 0);
});

test('duree : garde statique, un seul export formaterDuree et aucun import', () => {
  assert.deepEqual(Object.keys(module_), ['formaterDuree']);
  assert.equal(typeof module_.formaterDuree, 'function');
  assert.doesNotMatch(SOURCE, /\bimport\b/);
  assert.doesNotMatch(SOURCE, /\brequire\s*\(/);
  assert.equal((SOURCE.match(/\bexport\b/g) || []).length, 1);
  assert.match(SOURCE, /^export function formaterDuree\(ms\) \{$/m);
});

test('duree : garde statique, ni horloge, ni hasard, ni réseau, ni stockage, ni atelier', () => {
  for (const interdit of [/\bDate\b/, /Math\.random/, /\bfetch\b/, /XMLHttpRequest/, /localStorage/, /sessionStorage/, /indexedDB/, /performance\./, /WebSocket/, /atelier/i]) {
    assert.doesNotMatch(SOURCE, interdit, String(interdit));
  }
});

test('duree : garde statique, module dormant, nommé par aucun autre fichier de app/ ni sw.js, app/sw.js, index.html', () => {
  const autres = fichiersJs(join(RACINE, 'app')).filter((f) => f !== CHEMIN);
  const cibles = [...autres, join(RACINE, 'sw.js'), join(RACINE, 'app', 'sw.js'), join(RACINE, 'index.html'), join(RACINE, 'app', 'index.html')].filter((f) => existsSync(f));
  const nommants = cibles.filter((f) => /duree\.js/.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f).split(sep).join('/'));
  assert.deepEqual(nommants, []);
});
