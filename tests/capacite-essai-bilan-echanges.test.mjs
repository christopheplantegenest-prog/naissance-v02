// Capacité en essai « bilan-echanges » (classe E) : catalogue livré, module executer, règles statiques du robot.
// Outillage non cognitif : la capacité ne lit que des copies des tables emissions et receptions et n'écrit que dans la zone d'essai.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { executer } from '../app/capacites-essai/bilan-echanges.js';
import * as M from '../app/capacites-essai/bilan-echanges.js';
import * as R from '../app/essais/registre-essais.js';
import { analyserSource } from '../app/essais/analyse.js';
import { TABLES } from '../app/langage/connaissances.js';

const URL_MODULE = new URL('../app/capacites-essai/bilan-echanges.js', import.meta.url);
const URL_CATALOGUE = new URL('../app/capacites-essai/catalogue.json', import.meta.url);
const source = readFileSync(URL_MODULE, 'utf8');
const catalogue = JSON.parse(readFileSync(URL_CATALOGUE, 'utf8'));
const lignes = (n) => Array.from({ length: n }, (_, i) => ({ id: `l${i}`, texte: 'x' }));
const ligneDe = (r) => {
  assert.ok(r && Array.isArray(r.lignes));
  assert.equal(r.lignes.length, 1);
  return r.lignes[0];
};

test('executer compte les lignes d\'émissions et de réceptions lues', () => {
  const l = ligneDe(executer({ lues: { emissions: lignes(5), receptions: lignes(3) }, miennes: [], contexte: {} }));
  assert.equal(l.donnees.emissions, 5);
  assert.equal(l.donnees.receptions, 3);
  assert.equal(l.donnees.ecart, 2);
});

test('ecart = emissions - receptions, négatif quand les réceptions dépassent les émissions', () => {
  const l = ligneDe(executer({ lues: { emissions: lignes(1), receptions: lignes(4) }, miennes: [] }));
  assert.equal(l.donnees.ecart, -3);
  const z = ligneDe(executer({ lues: { emissions: [], receptions: [] }, miennes: [] }));
  assert.equal(z.donnees.ecart, 0);
});

test('numero = plus grand numéro entier de miennes + 1 ; 1 au départ ; lignes mal formées ignorées', () => {
  assert.equal(ligneDe(executer({ lues: {}, miennes: [] })).donnees.numero, 1);
  const miennes = [
    { cle: '2', donnees: { numero: 2 } },
    { cle: '7', donnees: { numero: 7 } },
    { cle: '4', donnees: { numero: 4 } },
  ];
  assert.equal(ligneDe(executer({ lues: {}, miennes })).donnees.numero, 8);
  const malFormees = [
    null, undefined, 3, 'x', [], { cle: 'a' }, { donnees: null }, { donnees: [] }, { donnees: { numero: '99' } },
    { donnees: { numero: 50.5 } }, { donnees: { numero: Number.NaN } }, { donnees: { numero: Infinity } }, { donnees: { numero: -4 } },
    { cle: '3', donnees: { numero: 3 } },
  ];
  assert.equal(ligneDe(executer({ lues: {}, miennes: malFormees })).donnees.numero, 4);
  assert.equal(ligneDe(executer({ lues: {}, miennes: [null, { donnees: { numero: '5' } }] })).donnees.numero, 1);
  assert.equal(ligneDe(executer({ lues: {}, miennes: 'pas un tableau' })).donnees.numero, 1);
});

test('entrée vide, undefined, null ou mal formée : aucune erreur, comptes à 0, numéro 1', () => {
  const entrees = [undefined, null, {}, [], 'x', 12, { lues: null }, { lues: 'x' }, { lues: [] },
    { lues: { emissions: 'abc', receptions: { length: 3 } } }, { lues: { emissions: null, receptions: 7 } }, { miennes: null, lues: {} }];
  for (const entree of entrees) {
    let r;
    assert.doesNotThrow(() => { r = executer(entree); }, JSON.stringify(entree));
    const l = ligneDe(r);
    assert.deepEqual(l, { cle: '1', donnees: { numero: 1, emissions: 0, receptions: 0, ecart: 0 } }, JSON.stringify(entree));
  }
  assert.doesNotThrow(() => executer());
  // une seule table absente : l'autre est comptée
  assert.deepEqual(ligneDe(executer({ lues: { receptions: lignes(2) } })).donnees, { numero: 1, emissions: 0, receptions: 2, ecart: -2 });
});

test('résultat : exactement une ligne, cle = String(numero), donnees sans autre champ', () => {
  const r = executer({ lues: { emissions: lignes(2), receptions: lignes(1) }, miennes: [{ cle: '9', donnees: { numero: 9 } }], contexte: { quand: 't' } });
  assert.deepEqual(Object.keys(r), ['lignes']);
  const l = ligneDe(r);
  assert.deepEqual(Object.keys(l).sort(), ['cle', 'donnees']);
  assert.equal(l.cle, String(l.donnees.numero));
  assert.equal(l.cle, '10');
  assert.deepEqual(Object.keys(l.donnees).sort(), ['ecart', 'emissions', 'numero', 'receptions']);
  assert.deepEqual(l.donnees, { numero: 10, emissions: 2, receptions: 1, ecart: 1 });
  assert.match(l.cle, R.RE_CLE);
  // la ligne respecte les invariants déclarés (champs, unique sur numero) avec les lignes déjà écrites
  const decl = R.declarationsLivrees(catalogue, { tables: TABLES }).declarations.find((x) => x.id === 'bilan-echanges'); // MISE À JOUR DÉLIBÉRÉE v0.66.13 : l'entrée est cherchée par son id (le catalogue peut contenir d'autres capacités en essai)
  const etat = { installe: '2026-01-01T00:00:00.000Z' };
  const deja = [{ id: 'a', horodatage: '2026-01-02T00:00:00.000Z', cle: '9', donnees: { numero: 9, emissions: 0, receptions: 0, ecart: 0 } }];
  assert.equal(R.violationInvariants(decl, etat, deja, [{ id: 'b', horodatage: '2026-01-03T00:00:00.000Z', ...l }]), null);
});

test('catalogue : recevable par declarationsLivrees (TABLES), module dérivé, déclencheur manuel seulement, aucun champ de plus', () => {
  assert.deepEqual(Object.keys(catalogue).sort(), ['capacites', 'format', 'v']);
  assert.equal(catalogue.format, R.FORMAT_CATALOGUE);
  assert.equal(catalogue.v, 1);
  assert.equal(catalogue.capacites.filter((c) => c && c.id === 'bilan-echanges').length, 1); // MISE À JOUR DÉLIBÉRÉE v0.66.13 : l'entrée est cherchée par son id (le catalogue peut contenir d'autres capacités en essai)
  const brut = catalogue.capacites.find((c) => c && c.id === 'bilan-echanges');
  assert.deepEqual(Object.keys(brut).sort(), ['declencheurs', 'delaiMs', 'description', 'effet', 'id', 'invariants', 'lit', 'maxLignes', 'titre']);
  assert.equal(Object.hasOwn(brut, 'module'), false);
  assert.equal(brut.id, 'bilan-echanges');
  assert.equal(brut.titre, 'Bilan des échanges');
  assert.equal(typeof brut.description, 'string');
  assert.ok(brut.description.length > 0);
  assert.deepEqual(brut.lit, ['emissions', 'receptions']);
  assert.equal(brut.effet, 'zone-essai');
  assert.deepEqual(brut.declencheurs, ['manuel']);
  assert.equal(brut.declencheurs.includes('apres-tour'), false);
  assert.equal(brut.delaiMs, 2000);
  assert.equal(brut.maxLignes, 1);
  assert.deepEqual(brut.invariants, [
    { type: 'champs', champs: ['numero', 'emissions', 'receptions', 'ecart'] },
    { type: 'unique', champ: 'numero' },
    { type: 'apres-installation' },
  ]);
  for (const t of brut.lit) assert.ok(TABLES.includes(t), t);

  const { declarations, refus } = R.declarationsLivrees(catalogue, { tables: TABLES });
  assert.deepEqual(refus, []);
  assert.equal(declarations.filter((x) => x.id === 'bilan-echanges').length, 1); // MISE À JOUR DÉLIBÉRÉE v0.66.13 : l'entrée est cherchée par son id (le catalogue peut contenir d'autres capacités en essai)
  const d = declarations.find((x) => x.id === 'bilan-echanges');
  assert.equal(d.id, 'bilan-echanges');
  assert.equal(d.module, '../capacites-essai/bilan-echanges.js');
  assert.equal(d.module, `${R.DOSSIER_CAPACITES}bilan-echanges.js`);
  assert.deepEqual([...d.declencheurs], ['manuel']);
  assert.equal(d.livree, true);
  assert.equal(R.validerDeclaration(d, TABLES), null);
  assert.equal(R.CATALOGUE.some((x) => x.id === d.id), false, 'identifiant distinct du catalogue figé');
});

test('analyse statique : analyserSource ne rend aucun refus ; règles strictes du robot (classe E) respectées', () => {
  const a = analyserSource(source);
  assert.deepEqual(a.refus, []);
  assert.deepEqual(a.imports, []);

  assert.ok(statSync(URL_MODULE).size <= 20000, 'au plus 20 Ko');
  assert.equal(/[^\x09\x0a\x0d\x20-\x7e]/.test(source), false, 'ASCII imprimable seul');
  assert.equal(source.includes('`'), false, 'aucun gabarit de texte');
  assert.equal(/\\[ux]/.test(source), false, 'aucune séquence d\'échappement unicode ou hexadécimale');
  assert.equal(/['"]\s*\+|\+\s*['"]/.test(source), false, 'aucune concaténation de textes');
  assert.equal((source.match(/^export function executer\(/gm) || []).length, 1, 'export function executer');
  assert.equal((source.match(/\bexport\b/g) || []).length, 1, 'un seul export');
  assert.deepEqual(Object.keys(M), ['executer']);
  const MOTS = ['import', 'require', 'eval', 'Function', 'constructor', 'prototype', '__proto__', 'globalThis', 'self', 'window', 'document',
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'ServiceWorker', 'BroadcastChannel', 'postMessage',
    'importScripts', 'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'requestAnimationFrame', 'Promise', 'async', 'await',
    'then', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'navigator', 'location', 'crypto', 'Reflect', 'Proxy', 'Symbol',
    'WebAssembly', 'Atomics', 'SharedArrayBuffer', 'Intl', 'fromCharCode', 'fromCodePoint', 'join', 'concat', 'replace', 'replaceAll',
    'raw', 'defineProperty', 'getPrototypeOf', 'setPrototypeOf', 'getOwnPropertyDescriptor', 'with', 'arguments', 'callee', 'bind',
    'apply', 'call', 'this', 'new', 'class', 'debugger', 'atob', 'btoa', 'escape', 'unescape', 'decodeURI', 'decodeURIComponent'];
  const trouves = MOTS.filter((m) => new RegExp(`\\b${m}\\b`).test(source));
  assert.deepEqual(trouves, []);
  assert.match(source, /for \(const /, 'boucles for...of');
  assert.match(source, /Number\.isInteger/);
  assert.match(source, /Array\.isArray/);
});
