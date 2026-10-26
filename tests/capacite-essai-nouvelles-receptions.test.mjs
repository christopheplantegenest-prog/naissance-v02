// Capacité en essai « nouvelles-receptions » (classe E) : entrée de catalogue livrée, module executer, règles statiques du robot.
// Outillage non cognitif : la capacité ne lit qu'une copie de la table receptions et n'écrit que dans la zone d'essai.
// Le test cherche l'entrée par son identifiant : il n'impose ni nombre ni position de capacités et ne vérifie aucune autre capacité.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { executer } from '../app/capacites-essai/nouvelles-receptions.js';
import * as M from '../app/capacites-essai/nouvelles-receptions.js';
import * as R from '../app/essais/registre-essais.js';
import { analyserSource } from '../app/essais/analyse.js';
import { TABLES } from '../app/langage/connaissances.js';

const ID = 'nouvelles-receptions';
const URL_MODULE = new URL('../app/capacites-essai/nouvelles-receptions.js', import.meta.url);
const URL_CATALOGUE = new URL('../app/capacites-essai/catalogue.json', import.meta.url);
const source = readFileSync(URL_MODULE, 'utf8');
const catalogue = JSON.parse(readFileSync(URL_CATALOGUE, 'utf8'));
const lignes = (n) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, texte: 'x' }));
const ligneDe = (r) => {
  assert.ok(r && Array.isArray(r.lignes));
  assert.equal(r.lignes.length, 1);
  return r.lignes[0];
};

test('première exécution, miennes vide, 3 réceptions : numero 1, total 3, nouvelles 3, cle « 1 »', () => {
  const l = ligneDe(executer({ lues: { receptions: lignes(3) }, miennes: [], contexte: {} }));
  assert.deepEqual(l, { cle: '1', donnees: { numero: 1, total: 3, nouvelles: 3 } });
  assert.equal(typeof l.cle, 'string');
});

test('miennes non triée (2, 5, 3) : P = numéro 5 (total 4) ; 7 réceptions -> numero 6, total 7, nouvelles 3', () => {
  const miennes = [
    { cle: '2', donnees: { numero: 2, total: 9, nouvelles: 1 } },
    { cle: '5', donnees: { numero: 5, total: 4, nouvelles: 0 } },
    { cle: '3', donnees: { numero: 3, total: 1, nouvelles: 1 } },
  ];
  const l = ligneDe(executer({ lues: { receptions: lignes(7) }, miennes }));
  assert.deepEqual(l, { cle: '6', donnees: { numero: 6, total: 7, nouvelles: 3 } });
  // l'ordre de miennes est sans effet
  const l2 = ligneDe(executer({ lues: { receptions: lignes(7) }, miennes: [miennes[2], miennes[1], miennes[0]] }));
  assert.deepEqual(l2, l);
});

test('total qui baisse (P.total 10, 4 réceptions) : nouvelles = total', () => {
  const l = ligneDe(executer({ lues: { receptions: lignes(4) }, miennes: [{ cle: '1', donnees: { numero: 1, total: 10, nouvelles: 10 } }] }));
  assert.deepEqual(l.donnees, { numero: 2, total: 4, nouvelles: 4 });
  // total égal : aucune nouvelle
  const e = ligneDe(executer({ lues: { receptions: lignes(4) }, miennes: [{ cle: '1', donnees: { numero: 1, total: 4, nouvelles: 4 } }] }));
  assert.deepEqual(e.donnees, { numero: 2, total: 4, nouvelles: 0 });
  // P.total à 0 : entier positif ou nul accepté
  const z = ligneDe(executer({ lues: { receptions: lignes(2) }, miennes: [{ cle: '1', donnees: { numero: 1, total: 0, nouvelles: 0 } }] }));
  assert.deepEqual(z.donnees, { numero: 2, total: 2, nouvelles: 2 });
});

test('P.total non entier, négatif ou absent : nouvelles = total', () => {
  const mauvais = [2.5, -1, '3', null, undefined, Number.NaN, Infinity, [], {}, true];
  for (const t of mauvais) {
    const l = ligneDe(executer({ lues: { receptions: lignes(5) }, miennes: [{ cle: '4', donnees: { numero: 4, total: t, nouvelles: 0 } }] }));
    assert.deepEqual(l.donnees, { numero: 5, total: 5, nouvelles: 5 }, String(t));
  }
  const sansTotal = ligneDe(executer({ lues: { receptions: lignes(5) }, miennes: [{ cle: '4', donnees: { numero: 4 } }] }));
  assert.deepEqual(sansTotal.donnees, { numero: 5, total: 5, nouvelles: 5 });
});

test('lignes mal formées de miennes ignorées pour le choix de P', () => {
  const malFormees = [
    null, undefined, 3, 'x', [], { cle: 'a' }, { donnees: null }, { donnees: [] }, { donnees: { numero: '99', total: 0 } },
    { donnees: { numero: 50.5, total: 0 } }, { donnees: { numero: Number.NaN, total: 0 } }, { donnees: { numero: Infinity, total: 0 } },
    { donnees: { numero: -4, total: 0 } }, { donnees: { numero: 0, total: 0 } },
    { cle: '3', donnees: { numero: 3, total: 2, nouvelles: 2 } },
  ];
  const l = ligneDe(executer({ lues: { receptions: lignes(6) }, miennes: malFormees }));
  assert.deepEqual(l, { cle: '4', donnees: { numero: 4, total: 6, nouvelles: 4 } });
  // seulement des lignes mal formées : aucune P
  const sansP = ligneDe(executer({ lues: { receptions: lignes(2) }, miennes: [null, { donnees: { numero: '5', total: 1 } }] }));
  assert.deepEqual(sansP, { cle: '1', donnees: { numero: 1, total: 2, nouvelles: 2 } });
  const pasTableau = ligneDe(executer({ lues: { receptions: lignes(2) }, miennes: 'pas un tableau' }));
  assert.deepEqual(pasTableau, { cle: '1', donnees: { numero: 1, total: 2, nouvelles: 2 } });
});

test('entrée undefined, null, objet vide, nombre, réceptions non tableau : aucune erreur, numero 1, total 0, nouvelles 0', () => {
  const entrees = [undefined, null, {}, 12, 'x', [], { lues: null }, { lues: 'x' }, { lues: [] }, { lues: {} },
    { lues: { receptions: 'abc' } }, { lues: { receptions: { length: 3 } } }, { lues: { receptions: 7 } }, { lues: { receptions: null } },
    { miennes: null, lues: {} }];
  for (const entree of entrees) {
    let r;
    assert.doesNotThrow(() => { r = executer(entree); }, JSON.stringify(entree));
    assert.deepEqual(ligneDe(r), { cle: '1', donnees: { numero: 1, total: 0, nouvelles: 0 } }, JSON.stringify(entree));
  }
  assert.doesNotThrow(() => executer());
  assert.deepEqual(ligneDe(executer()), { cle: '1', donnees: { numero: 1, total: 0, nouvelles: 0 } });
});

test('résultat : une seule ligne, seulement cle et donnees, donnees avec exactement numero, total, nouvelles', () => {
  const r = executer({ lues: { receptions: lignes(2), emissions: lignes(9) }, miennes: [{ cle: '9', donnees: { numero: 9, total: 1, nouvelles: 1 } }], contexte: { quand: 't' } });
  assert.deepEqual(Object.keys(r), ['lignes']);
  const l = ligneDe(r);
  assert.deepEqual(Object.keys(l).sort(), ['cle', 'donnees']);
  assert.deepEqual(Object.keys(l.donnees).sort(), ['nouvelles', 'numero', 'total']);
  assert.equal(l.cle, String(l.donnees.numero));
  assert.equal(l.cle, '10');
  assert.deepEqual(l.donnees, { numero: 10, total: 2, nouvelles: 1 });
  assert.match(l.cle, R.RE_CLE);
  // la ligne respecte les invariants déclarés (champs, unique sur numero, après installation) avec les lignes déjà écrites
  const decl = R.declarationsLivrees(catalogue, { tables: TABLES }).declarations.find((x) => x.id === ID);
  assert.ok(decl);
  const etat = { installe: '2026-01-01T00:00:00.000Z' };
  const deja = [{ id: 'a', horodatage: '2026-01-02T00:00:00.000Z', cle: '9', donnees: { numero: 9, total: 1, nouvelles: 1 } }];
  assert.equal(R.violationInvariants(decl, etat, deja, [{ id: 'b', horodatage: '2026-01-03T00:00:00.000Z', ...l }]), null);
});

test('catalogue : declarationsLivrees (TABLES) sans refus ; entrée trouvée par id, module dérivé, déclencheur apres-tour seulement', () => {
  assert.equal(catalogue.format, R.FORMAT_CATALOGUE);
  assert.equal(catalogue.v, 1);
  assert.ok(Array.isArray(catalogue.capacites));
  assert.equal(catalogue.capacites.filter((c) => c && c.id === ID).length, 1);
  const brut = catalogue.capacites.find((c) => c && c.id === ID);
  assert.deepEqual(Object.keys(brut).sort(), ['declencheurs', 'delaiMs', 'description', 'effet', 'id', 'invariants', 'lit', 'maxLignes', 'titre']);
  assert.equal(Object.hasOwn(brut, 'module'), false);
  assert.equal(brut.titre, 'Nouvelles réceptions');
  assert.equal(typeof brut.description, 'string');
  assert.ok(brut.description.length > 0);
  assert.deepEqual(brut.lit, ['receptions']);
  assert.equal(brut.effet, 'zone-essai');
  assert.deepEqual(brut.declencheurs, ['apres-tour']);
  assert.equal(brut.delaiMs, 2000);
  assert.equal(brut.maxLignes, 1);
  assert.deepEqual(brut.invariants, [
    { type: 'champs', champs: ['numero', 'total', 'nouvelles'] },
    { type: 'unique', champ: 'numero' },
    { type: 'apres-installation' },
  ]);
  for (const t of brut.lit) assert.ok(TABLES.includes(t), t);

  const { declarations, refus } = R.declarationsLivrees(catalogue, { tables: TABLES });
  assert.deepEqual(refus, []);
  assert.equal(declarations.filter((x) => x.id === ID).length, 1);
  const d = declarations.find((x) => x.id === ID);
  assert.equal(d.module, '../capacites-essai/nouvelles-receptions.js');
  assert.equal(d.module, `${R.DOSSIER_CAPACITES}${ID}.js`);
  assert.deepEqual([...d.declencheurs], ['apres-tour']);
  assert.equal(d.livree, true);
  assert.equal(R.validerDeclaration(d, TABLES), null);
  assert.equal(R.CATALOGUE.some((x) => x.id === d.id), false, 'identifiant distinct du catalogue figé');
});

test('capacité inactive après installation : absente des essais actifs d\'un registre vide', () => {
  const r = { v: 1, essais: {}, journal: [] };
  assert.equal(R.etatDe(r, ID), 'inactif');
  const { declarations } = R.declarationsLivrees(catalogue, { tables: TABLES });
  assert.equal(R.essaisActifs(r, declarations).includes(ID), false);
});

test('analyse statique : analyserSource sans refus ; règles strictes du robot (classe E) respectées', () => {
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
  assert.equal(/\bimport\b/.test(source), false, 'aucun import');
  assert.deepEqual(Object.keys(M), ['executer']);
  const MOTS = ['import', 'require', 'eval', 'Function', 'constructor', 'prototype', '__proto__', 'globalThis', 'self', 'window', 'document',
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'ServiceWorker', 'BroadcastChannel', 'postMessage',
    'importScripts', 'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'requestAnimationFrame', 'Promise', 'async', 'await',
    'then', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'navigator', 'location', 'crypto', 'Reflect', 'Proxy', 'Symbol',
    'WebAssembly', 'Atomics', 'SharedArrayBuffer', 'Intl', 'fromCharCode', 'fromCodePoint', 'join', 'concat', 'replace', 'replaceAll',
    'raw', 'defineProperty', 'getPrototypeOf', 'setPrototypeOf', 'getOwnPropertyDescriptor', 'with', 'arguments', 'callee', 'bind',
    'apply', 'call', 'this', 'new', 'class', 'debugger', 'atob', 'btoa', 'escape', 'unescape', 'decodeURI', 'decodeURIComponent', 'process'];
  // mot entier
  assert.deepEqual(MOTS.filter((m) => new RegExp(`\\b${m}\\b`).test(source)), []);
  // même à l'intérieur d'un autre mot ou d'un commentaire
  assert.deepEqual(MOTS.filter((m) => source.includes(m)), []);
  assert.match(source, /for \(const /, 'boucles for...of');
  assert.match(source, /Number\.isInteger/);
  assert.match(source, /Array\.isArray/);
});
