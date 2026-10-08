// === DEBUT_TEST_PARTITION_COUVERTURES ===
// v0.63.9 — ÉTAPE 6, décision ChatGPT « PARTITION ÉLÉMENTAIRE DE DEUX COUVERTURES » (04/10/2026). Preuves que
// app/langage/partition-couvertures.js rend exactement { communs, seulementA, seulementB } (couvertures normalisées, [] admise),
// sans classer la relation, sans univers, sans constat, avec l'identité typée de v0.63.6 (sans sérialisation), sans dépendre de l'ordre
// brut des entrées, sans jamais modifier les entrées, et que les classifications (égal, inclus, disjoint, chevauchement, universel)
// se lisent sur les trois parties DANS LES TESTS SEULEMENT. Les clés JSON de ce fichier sont des ORACLES ; le module n'en emploie aucune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/partition-couvertures.js';
import { normaliserCouverture, memesCouvertures } from '../app/langage/couverture-occurrences.js';
import { produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { DESCRIPTIONS_OPERATIONS as DESCRIPTIONS_COMPLETES } from '../app/langage/descriptions-operations.js';
// MISE À JOUR DÉLIBÉRÉE v0.63.61 : ce test utilise le catalogue comme FIXTURE de structure (comptages d'occurrences, de chemins, de couvertures). Les relations entre entrées
// (clé `relations`, v0.63.61) sont une donnée ajoutée AU catalogue, pas à ce que ce test mesure : la fixture est le catalogue SANS cette clé (mêmes valeurs qu'en v0.63.60).
const DESCRIPTIONS_OPERATIONS = DESCRIPTIONS_COMPLETES.map(({ relations, ...description }) => description);
// v0.63.10 : le catalogue compte NEUF descriptions. Les mesures de ce fichier (114 occurrences, 14/15 groupes...) portent sur le CORPUS FIGÉ des
// trois descriptions de v0.63.4 (couvrirSequence, decrireStructureIdentifiee, decrireValeursObservees) : les six autres sont écartées ici.
const CORPUS_V0634 = DESCRIPTIONS_OPERATIONS.filter((d) => ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees'].includes(d.nom));

const { partagerCouvertures: partager } = module;
const RACINE = join(import.meta.dirname, '..');
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'partition-couvertures.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));

// --- oracles (tests seulement)
const cle = (c) => JSON.stringify(c);
const segAvant = (a, b) => (typeof a !== typeof b ? typeof a === 'number' : a < b);
const avant = (a, b) => {
  if (a.length === 0) return b.length > 0;
  if (b.length === 0) return false;
  if (a[0] !== b[0]) return segAvant(a[0], b[0]);
  return avant(a.slice(1), b.slice(1));
};
const trierOracle = (chemins) => chemins.slice().sort((x, y) => (avant(x, y) ? -1 : avant(y, x) ? 1 : 0));
const dans = (liste, c) => liste.some((q) => cle(q) === cle(c));
const oracle = (a, b) => {
  const A = trierOracle(a); const B = trierOracle(b);
  return { communs: A.filter((p) => dans(B, p)), seulementA: A.filter((p) => !dans(B, p)), seulementB: B.filter((p) => !dans(A, p)) };
};
let graine = 20261007;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const entier = (n) => Math.floor(alea() * n);
const melanger = (t) => { const r = t.slice(); for (let i = r.length - 1; i > 0; i -= 1) { const j = entier(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const geler = (x) => { if (x !== null && typeof x === 'object') { for (const k of Object.keys(x)) geler(x[k]); Object.freeze(x); } return x; };
const SEGMENTS = [0, 1, 2, 10, 9, 'a', 'b', '', '0', '1', 'a/b', 'a.b', 'a,b', 'B', 'é', '\u0001', 'a|b'];
const cheminAleatoire = () => { const n = entier(4); const c = []; for (let i = 0; i < n; i += 1) c.push(SEGMENTS[entier(SEGMENTS.length)]); return c; };
const reserve = () => { const vus = new Set(); const r = []; for (let i = 0; i < 40; i += 1) { const c = cheminAleatoire(); if (!vus.has(cle(c))) { vus.add(cle(c)); r.push(c); } } return r; };
const INVALIDES = [
  ['undefined', undefined], ['null', null], ['objet', {}], ['chaîne', 'a'], ['nombre', 3], ['booléen', true], ['fonction', () => 1],
  ['segment objet', [{}]], ['segment tableau', [[['a']]]], ['négatif', [[-1]]], ['non entier', [[1.5]]], ['NaN', [[NaN]]],
  ['Infinity', [[Infinity]]], ['bigint', [[10n]]], ['symbol', [[Symbol('s')]]], ['chemin non tableau', ['a']], ['undefined segment', [[undefined]]],
];
const PIEGES = [[], [''], [0], ['0'], ['a/b'], ['a', 'b'], ['a,b'], ['a.b'], ['a\u0001b'], ['a|b']];
const memes = (x, y) => memesCouvertures(x, y);
// lecture dans les tests seulement
const lit = (r) => (r.communs.length === 0 ? 'disjointes' : r.seulementA.length === 0 && r.seulementB.length === 0 ? 'égales' : r.seulementA.length === 0 ? 'A inclus' : r.seulementB.length === 0 ? 'B inclus' : 'chevauchement strict');
const adapter = (O) => ({ chemin: O.chemin, contenu: Object.hasOwn(O, 'valeur') ? { type: O.type, valeur: O.valeur } : { type: O.type } });

// ============================================================================ A. CONTRAT
test('A1. exactement un export : partagerCouvertures(a, b)', () => {
  assert.deepEqual(Object.keys(module), ['partagerCouvertures']);
  assert.equal(typeof partager, 'function'); assert.equal(partager.length, 2);
});
test('A2. sortie : exactement { communs, seulementA, seulementB }, trois tableaux, aucun autre champ', () => {
  const r = partager([['x'], ['y']], [['y'], ['z']]);
  assert.deepEqual(Object.keys(r), ['communs', 'seulementA', 'seulementB']);
  for (const k of Object.keys(r)) assert.equal(Array.isArray(r[k]), true);
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
  assert.deepEqual(Object.getOwnPropertyNames(r), ['communs', 'seulementA', 'seulementB']);
  assert.equal(Object.getOwnPropertySymbols(r).length, 0);
});

// ============================================================================ B. VALIDATION DÉLÉGUÉE
test('B1. entrée invalide (a ou b) : TypeError, aucun résultat', () => {
  for (const [nom, v] of INVALIDES) {
    refuse(() => partager(v, [['x']]), /^a : /);
    refuse(() => partager([['x']], v), /^b : /);
    refuse(() => partager(v, v), /^a : /);
  }
});
test('B2. doublon dans a ou dans b : TypeError (jamais fusionné en silence), [0] et [-0] forment un doublon', () => {
  refuse(() => partager([['x'], ['x']], [['y']]), /^a : /);
  refuse(() => partager([['y']], [['x'], ['x']]), /^b : /);
  refuse(() => partager([[0], [-0]], []), /^a : /);
  refuse(() => partager([], [[], []]), /^b : /);
});
test('B3. l\'entrée brute n\'est jamais utilisée sans normalisation : une entrée non canonique donne la même sortie, un doublon brut est refusé', () => {
  const a = [['b'], [1], ['a'], [], [0]]; const b = [['a'], [0], ['c']];
  assert.deepEqual(partager(a, b), partager(a.slice().reverse(), b.slice().reverse()));
  assert.deepEqual(partager(a, b), partager(normaliserCouverture(a), normaliserCouverture(b)));
});
test('B4. les messages ne contiennent jamais de valeur de chemin', () => {
  const messages = [];
  for (const f of [() => partager([['zSECRET'], ['zSECRET']], []), () => partager([], [['zSECRET', -1]]), () => partager([['zSECRET', {}]], [])]) { try { f(); } catch (e) { messages.push(e.message); } }
  assert.equal(messages.length, 3);
  for (const m of messages) assert.equal(/zSECRET/.test(m), false, m);
});

// ============================================================================ C. CAS ÉLÉMENTAIRES
test('C1. cas égal : tout est commun, rien n\'est exclusif — la primitive ne dit pas « égal »', () => {
  const A = [['a'], ['b', 1], []];
  const r = partager(A, A);
  assert.deepEqual(r, { communs: normaliserCouverture(A), seulementA: [], seulementB: [] });
  assert.deepEqual(partager(A, melanger(A)), r);
  assert.equal(lit(r), 'égales');
});
test('C2. cas disjoint', () => {
  const r = partager([['a'], ['b']], [['c'], [0]]);
  assert.deepEqual(r, { communs: [], seulementA: [['a'], ['b']], seulementB: [[0], ['c']] });
  assert.equal(lit(r), 'disjointes');
});
test('C3. inclusion A ⊂ B puis B ⊂ A', () => {
  const r = partager([['a']], [['a'], ['b'], ['c']]);
  assert.deepEqual(r, { communs: [['a']], seulementA: [], seulementB: [['b'], ['c']] });
  assert.equal(lit(r), 'A inclus');
  const s = partager([['a'], ['b'], ['c']], [['a']]);
  assert.deepEqual(s, { communs: [['a']], seulementA: [['b'], ['c']], seulementB: [] });
  assert.equal(lit(s), 'B inclus');
});
test('C4. chevauchement strict A = {x,y}, B = {y,z} avec de vrais chemins typés', () => {
  const x = [0, 'nom']; const y = ['entrees', 3]; const z = ['sortie'];
  const r = partager([x, y], [z, y]);
  assert.deepEqual(r, { communs: [y], seulementA: [x], seulementB: [z] });
  assert.equal(lit(r), 'chevauchement strict');
});
test('C5. cas vides : [] et [], [] et C, C et [] — aucune erreur, [] est une partie valide', () => {
  assert.deepEqual(partager([], []), { communs: [], seulementA: [], seulementB: [] });
  const C = [['a'], [1]];
  assert.deepEqual(partager([], C), { communs: [], seulementA: [], seulementB: [[1], ['a']] });
  assert.deepEqual(partager(C, []), { communs: [], seulementA: [[1], ['a']], seulementB: [] });
  assert.deepEqual(partager([[]], []), { communs: [], seulementA: [[]], seulementB: [] });
  assert.deepEqual(partager([[]], [[]]), { communs: [[]], seulementA: [], seulementB: [] });
});

// ============================================================================ D. INVARIANTS, ORACLE, SYMÉTRIE
test('D1. 600 couples aléatoires : sortie = oracle indépendant ; parties disjointes ; unions = A et B ; rien d\'inventé, de perdu, de dupliqué', () => {
  const pool = reserve();
  for (let t = 0; t < 600; t += 1) {
    const a = pool.filter(() => alea() < 0.4); const b = pool.filter(() => alea() < 0.4);
    const r = partager(melanger(a), melanger(b));
    const o = oracle(a, b);
    assert.deepEqual(r, o);
    const toutes = [...r.communs, ...r.seulementA, ...r.seulementB];
    assert.equal(new Set(toutes.map(cle)).size, toutes.length, 'aucune duplication entre les trois parties');
    for (const p of r.communs) { assert.equal(dans(r.seulementA, p), false); assert.equal(dans(r.seulementB, p), false); }
    for (const p of r.seulementA) assert.equal(dans(r.seulementB, p), false);
    assert.deepEqual(trierOracle([...r.communs, ...r.seulementA]), trierOracle(a));
    assert.deepEqual(trierOracle([...r.communs, ...r.seulementB]), trierOracle(b));
    for (const p of toutes) assert.equal(dans(a, p) || dans(b, p), true, 'aucun chemin nouveau');
    for (const p of [...a, ...b]) assert.equal(dans(toutes, p), true, 'aucun chemin perdu');
    for (const part of [r.communs, r.seulementA, r.seulementB]) assert.deepEqual(part, normaliserCouverture(part), 'canonique');
  }
});
test('D2. l\'ordre brut des entrées n\'a aucune influence (40 permutations)', () => {
  const pool = reserve(); const a = pool.filter((_, i) => i % 2 === 0); const b = pool.filter((_, i) => i % 3 === 0);
  const attendu = partager(a, b);
  for (let t = 0; t < 40; t += 1) assert.deepEqual(partager(melanger(a), melanger(b)), attendu);
});
test('D3. symétrie : communs identiques ; seulementA ↔ seulementB échangés', () => {
  const pool = reserve();
  for (let t = 0; t < 300; t += 1) {
    const a = pool.filter(() => alea() < 0.4); const b = pool.filter(() => alea() < 0.4);
    const ab = partager(a, b); const ba = partager(b, a);
    assert.deepEqual(ab.communs, ba.communs); assert.deepEqual(ab.seulementA, ba.seulementB); assert.deepEqual(ab.seulementB, ba.seulementA);
  }
});
test('D4. partager(A, A) donne A / [] / [] pour toute couverture', () => {
  const pool = reserve();
  for (let t = 0; t < 100; t += 1) { const a = pool.filter(() => alea() < 0.5); assert.deepEqual(partager(a, a), { communs: trierOracle(a), seulementA: [], seulementB: [] }); }
});

// ============================================================================ E. IDENTITÉ TYPÉE
test('E1. dix identités piégées : aucune collision, chacune n\'est commune qu\'avec elle-même', () => {
  for (let i = 0; i < PIEGES.length; i += 1) {
    for (let j = 0; j < PIEGES.length; j += 1) {
      const r = partager([PIEGES[i]], [PIEGES[j]]);
      if (i === j) assert.deepEqual(r, { communs: [PIEGES[i]], seulementA: [], seulementB: [] }, `${i}`);
      else assert.deepEqual(r, { communs: [], seulementA: [PIEGES[i]], seulementB: [PIEGES[j]] }, `${i}/${j}`);
    }
    const r = partager(PIEGES, [PIEGES[i]]);
    assert.deepEqual(r.communs, [PIEGES[i]]); assert.equal(r.seulementA.length, PIEGES.length - 1); assert.deepEqual(r.seulementB, []);
  }
});
test('E2. préfixes distincts : ["a"] ≠ ["a","b"] ; [] ≠ [""] ; 0 ≠ "0"', () => {
  assert.deepEqual(partager([['a']], [['a', 'b']]), { communs: [], seulementA: [['a']], seulementB: [['a', 'b']] });
  assert.deepEqual(partager([[]], [['']]), { communs: [], seulementA: [[]], seulementB: [['']] });
  assert.deepEqual(partager([[0]], [['0']]), { communs: [], seulementA: [[0]], seulementB: [['0']] });
  assert.deepEqual(partager([[1, 2]], [[1], [2], ['1', '2']]).communs, []);
});
test('E3. -0 : [0] et [-0] désignent le même chemin (contrat v0.63.6 intact)', () => {
  const r = partager([[0]], [[-0]]);
  assert.equal(r.communs.length, 1); assert.equal(r.seulementA.length, 0); assert.equal(r.seulementB.length, 0);
  assert.equal(memes(r.communs, [[0]]), true); assert.equal(memes(r.communs, [[-0]]), true);
  const s = partager([[-0], ['x']], [[0]]);
  assert.equal(memes(s.communs, [[0]]), true); assert.deepEqual(s.seulementA, [['x']]); assert.deepEqual(s.seulementB, []);
  assert.equal(Object.is(s.communs[0][0], -0), true, 'communs reprend la représentation de A');
  assert.equal(Object.is(partager([[0]], [[-0]]).communs[0][0], 0), true);
  assert.equal(memes(partager([[0]], [[-0]]).communs, partager([[-0]], [[0]]).communs), true, 'symétrie au sens de l\'identité');
  assert.equal(memes([[0]], [[-0]]), true);
});

// ============================================================================ F. ENTRÉES NON MODIFIÉES, SORTIES NEUVES
test('F1. couvertures et chemins gelés acceptés ; rien n\'est modifié', () => {
  const a = geler([['a', 1], ['b'], []]); const b = geler([['b'], ['c', 0]]);
  assert.deepEqual(partager(a, b), { communs: [['b']], seulementA: [[], ['a', 1]], seulementB: [['c', 0]] });
  assert.deepEqual(a, [['a', 1], ['b'], []]); assert.deepEqual(b, [['b'], ['c', 0]]);
  assert.equal(Object.isFrozen(partager(a, b).communs), false, 'sortie neuve et non gelée');
});
test('F2. la sortie est NEUVE : aucune référence partagée avec les entrées ni entre les parties ; la modifier ne touche rien', () => {
  const a = [['a'], ['b']]; const b = [['b'], ['c']];
  const r = partager(a, b); const vus = new Set([a, b, ...a, ...b]);
  for (const part of [r.communs, r.seulementA, r.seulementB]) { assert.equal(vus.has(part), false); vus.add(part); for (const p of part) { assert.equal(vus.has(p), false); vus.add(p); } }
  r.communs[0].push('MUTE'); r.seulementA.push(['MUTE']); r.seulementB.length = 0;
  assert.deepEqual(a, [['a'], ['b']]); assert.deepEqual(b, [['b'], ['c']]);
  assert.deepEqual(partager(a, b), { communs: [['b']], seulementA: [['a']], seulementB: [['c']] });
});

// ============================================================================ G. CAS RÉEL v0.63.8 : 14 GROUPES, 91 PAIRES
const U114 = parcourirStructure(CORPUS_V0634);
const refResultat = produireConstatsStructurels(U114.map(adapter));
const GROUPES = []; for (const x of refResultat) if (!GROUPES.some((g) => memes(g, x.couverture))) GROUPES.push(x.couverture);
const UNIVERSELLE = normaliserCouverture(U114.map((o) => o.chemin));
test('G1. 14 groupes distincts, 91 paires : chaque partition égale l\'oracle', () => {
  assert.equal(GROUPES.length, 14);
  let paires = 0;
  for (let i = 0; i < GROUPES.length; i += 1) for (let j = i + 1; j < GROUPES.length; j += 1) { paires += 1; assert.deepEqual(partager(GROUPES[i], GROUPES[j]), oracle(GROUPES[i], GROUPES[j])); }
  assert.equal(paires, 91);
});
test('G2. lecture des trois sorties (dans le TEST seulement) : 22 inclusions, 69 disjointes, 22 avec communs, 0 chevauchement strict', () => {
  const compte = {};
  for (let i = 0; i < GROUPES.length; i += 1) for (let j = i + 1; j < GROUPES.length; j += 1) { const k = lit(partager(GROUPES[i], GROUPES[j])); compte[k] = (compte[k] || 0) + 1; }
  assert.equal((compte['A inclus'] || 0) + (compte['B inclus'] || 0), 22);
  assert.equal(compte.disjointes, 69);
  assert.equal(91 - compte.disjointes, 22);
  assert.equal(compte['chevauchement strict'] || 0, 0);
  assert.equal(compte['égales'] || 0, 0);
});
test('G3. tailles lues par .length dans le test seulement ; la sortie ne porte aucun champ de taille', () => {
  const r = partager(GROUPES[0], GROUPES[1]);
  assert.deepEqual(Object.keys(r), ['communs', 'seulementA', 'seulementB']);
  assert.equal(r.communs.length + r.seulementA.length, GROUPES[0].length);
  assert.equal(r.communs.length + r.seulementB.length, GROUPES[1].length);
});

// ============================================================================ H. CAS NON LAMINAIRE PRODUIT RÉELLEMENT
test('H1. x={p:1}, y={p:1,q:2}, z={q:2} via produireConstatsStructurels : communs {y}, seulementA {x}, seulementB {z}', () => {
  const produits = produireConstatsStructurels([
    { chemin: ['x'], contenu: { p: 1 } }, { chemin: ['y'], contenu: { p: 1, q: 2 } }, { chemin: ['z'], contenu: { q: 2 } },
  ]);
  const de = (c) => produits.find((e) => e.constat.chemin.length === 1 && e.constat.chemin[0] === c).couverture;
  const A = de('p'); const B = de('q');
  assert.deepEqual(A, [['x'], ['y']]); assert.deepEqual(B, [['y'], ['z']]);
  const r = partager(A, B);
  assert.deepEqual(r, { communs: [['y']], seulementA: [['x']], seulementB: [['z']] });
  assert.equal(lit(r), 'chevauchement strict');
  assert.deepEqual(partager(B, A), { communs: [['y']], seulementA: [['z']], seulementB: [['x']] });
});

// ============================================================================ I. UNIVERSALITÉ SANS CAS SPÉCIAL
test('I1. couverture universelle fournie comme A : partager(U, C) donne communs = C, seulementA = U\\C, seulementB = [] pour les 14 groupes', () => {
  let universels = 0;
  for (const C of GROUPES) {
    const r = partager(UNIVERSELLE, C);
    assert.deepEqual(r.communs, C); assert.deepEqual(r.seulementB, []);
    assert.equal(r.communs.length + r.seulementA.length, 114);
    assert.deepEqual(r, oracle(UNIVERSELLE, C));
    if (r.seulementA.length === 0) universels += 1;
    const s = partager(C, UNIVERSELLE);
    assert.deepEqual(s.communs, C); assert.deepEqual(s.seulementA, []); assert.deepEqual(s.seulementB, r.seulementA);
  }
  assert.equal(universels, 1, 'une seule couverture ne laisse rien à U\\C');
});

// ============================================================================ J. COÛT
test('J1. coût : deux couvertures de 114 chemins en moins de 2 s ; 400 × 400 en moins de 10 s', () => {
  let t0 = Date.now(); partager(UNIVERSELLE, UNIVERSELLE); assert.ok(Date.now() - t0 < 2000);
  const a = []; const b = []; for (let i = 0; i < 400; i += 1) { a.push(['k', i]); b.push(['k', i + 200]); }
  t0 = Date.now(); const r = partager(a, b); const dt = Date.now() - t0;
  assert.ok(dt < 10000, `${dt} ms`);
  assert.equal(r.communs.length, 200); assert.equal(r.seulementA.length, 200); assert.equal(r.seulementB.length, 200);
});

// ============================================================================ K. STATIQUE ET DORMANCE
const fichiers = (d, s = []) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) { if (n !== 'node_modules') fichiers(f, s); } else s.push(f); } return s; };
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const MODULE = 'app/langage/partition-couvertures.js';
test('K1. le module n\'importe QUE normaliserCouverture et memesCouvertures de couverture-occurrences.js, et n\'exporte qu\'une fonction', () => {
  assert.deepEqual(CODE.match(/^\s*import\b.*$/gm), ['import { normaliserCouverture, memesCouvertures } from \'./couverture-occurrences.js\';']);
  assert.equal(/\bimport\s*\(|\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function partagerCouvertures(a, b) {']);
  assert.equal(/parcourirStructure|parcours-structure|resolution-couverture|resoudreCouverture|constats-structurels|DESCRIPTIONS_OPERATIONS|CAPACITES|registre/.test(CODE + SOURCE), false);
});
test('K2. pur : aucun accès réseau, stockage, horloge, hasard, console, global ; aucune sérialisation, clé texte, Map/Set, tri, indexOf/includes', () => {
  assert.equal(/\bfetch\b|localStorage|indexedDB|process\.|Date\.now|new Date|Math\.random|console\.|setTimeout|await\b|\basync\b|globalThis|window\.|document\./.test(CODE), false);
  assert.equal(/JSON\.|\.join\s*\(|\.toString\s*\(|localeCompare|Intl\.|\bencodeURI|\bbtoa\b|\bString\s*\(|\bNumber\s*\(\s*[a-z]|\.concat\s*\(|new Map|new Set|WeakMap|\bhash\b|\bcl[eé]\b/.test(CODE), false);
  assert.equal(/\.indexOf\s*\(|\.includes\s*\(|\.lastIndexOf\s*\(|\.find\s*\(|\.findIndex\s*\(|\.some\s*\(|\.every\s*\(|\.sort\s*\(|\.reverse\s*\(|\.splice\s*\(|\.slice\s*\(|\.filter\s*\(|\.map\s*\(/.test(CODE), false);
  assert.equal(/===\s*\w*chemin|\.length\s*[!=]==\s*\w+\.length|Object\.is\b|Object\.(keys|values|entries)/.test(CODE), false, 'aucune égalité de chemins redéfinie');
});
test('K3. aucune classification, aucun compteur, aucun choix, aucune raison dans le code', () => {
  assert.equal(/\b(egal|égal|egaux|égaux|inclus\w*|inclusion|disjoint\w*|chevauch\w*|univers\w*|singleton|taille|cardinal\w*|nombre|compteur|union|intersection|difference|complement|score|poids|frequence|interet|preference|priorite|seuil|selection|choix|raison|constat|provenance|rang|matrice|rebas\w*|parent|categorie)\b/i.test(CODE), false);
  assert.equal(/\bid\b|\bidentifiant\b|\.type\b|\.valeur\b|\bcontenu\b/i.test(CODE), false);
});
test('K4. aucun fichier de production ne nomme ce module ; les importeurs de couverture-occurrences sont exactement connus', () => {
  const fautifs = []; const importeurs = [];
  for (const f of fichiers(join(RACINE, 'app'))) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (rel(f) !== MODULE && rel(f) !== 'app/langage/descriptions-operations.js' && rel(f) !== 'app/langage/table-operations.js' && /partition-couvertures|partagerCouvertures/.test(src)) fautifs.push(rel(f)); // MISE À JOUR DÉLIBÉRÉE v0.63.18 : table-operations.js rend les opérations LOCALISABLES mécaniquement (importeur statique autorisé, gardé par tests/invocation-operations.test.mjs) ; elles ne sont pas utilisées par le moteur. // v0.63.10 : le catalogue nomme la primitive (nom: '…'), vérifié en K6
    if (/couverture-occurrences|normaliserCouverture|memesCouvertures/.test(src) && rel(f) !== 'app/langage/descriptions-operations.js') importeurs.push(rel(f)); // v0.63.10 : le catalogue ne CITE pas le module (K6), il nomme des fonctions
  }
  assert.deepEqual(fautifs, []);
  assert.deepEqual(importeurs.sort(), ['app/langage/constats-structurels.js', 'app/langage/constats-valeurs.js', 'app/langage/couverture-occurrences.js', MODULE, 'app/langage/relations-parent-enfant.js', 'app/langage/resolution-couverture.js', 'app/langage/suites-fermees.js', 'app/langage/table-operations.js', 'app/langage/constats-par-chemin.js', 'app/langage/contexte-prospectif.js', 'app/langage/issue-contexte-prospectif.js', 'app/langage/attentes-prospectives.js'].sort()); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentes-prospectives.js (calcul pur des attentes A = B, appelé par execution-sollicitee.js avant l'issue ; importe couverture-occurrences, constats-structurels (memesConstats), constats-par-chemin, issue-contexte-prospectif) // MISE À JOUR DÉLIBÉRÉE v0.63.73 : + issue-contexte-prospectif.js (vue pure dormante : issue d'un contexte prospectif ; importe parcourirStructure, couverture-occurrences, constats-structurels) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contexte-prospectif.js (calcul pur du contenu prospectif, appelé par execution-sollicitee.js avant l'issue ; importe parcourirStructure, couverture-occurrences et constats-par-chemin) // MISE À JOUR DÉLIBÉRÉE v0.63.71 : + constats-par-chemin.js (vue dormante, importe normaliserCouverture et memesCouvertures) // v0.63.11 : + relations-parent-enfant.js // MISE À JOUR DÉLIBÉRÉE v0.63.32 : + suites-fermees.js (observateur de suites dormant, importe ces primitives)
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/partition-couvertures|couverture-occurrences/.test(src), false, autre); }
});
test('K5. le module est INACCESSIBLE depuis le démarrage : parcours des imports statiques depuis app/main.js', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs)
  }
  assert.ok(vus.size > 20);
  for (const dormant of [MODULE, 'app/langage/couverture-occurrences.js', 'app/langage/constats-structurels.js']) assert.equal([...vus].some((f) => rel(f) === dormant), false, dormant);
});
test('K6. rien d\'autre ne change de statut : CAPACITES inchangée, VERSION_BASE 15, SCHEMA_SAUVEGARDE 5 ; les API précédentes ne sont pas élargies', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  assert.equal(Object.isFrozen(CAPACITES), true);
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 21); assert.equal(sauv.SCHEMA_SAUVEGARDE, 11); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables)
  assert.deepEqual(Object.keys(await import('../app/langage/couverture-occurrences.js')).sort(), ['memesCouvertures', 'normaliserCouverture']);
  assert.deepEqual(Object.keys(await import('../app/langage/resolution-couverture.js')), ['resoudreCouverture']);
  assert.deepEqual(Object.keys(await import('../app/langage/constats-structurels.js')), ['memesConstats', 'produireConstatsStructurels']); // MISE À JOUR DÉLIBÉRÉE v0.63.73 : + memesConstats (égalité des constats exportée, inchangée)
  for (const f of ['registre.js', 'constats-structurels.js', 'resolution-couverture.js', 'parcours-structure.js']) assert.equal(/partition-couvertures|partagerCouvertures/.test(readFileSync(join(RACINE, 'app', 'langage', f), 'utf8')), false, f);
  // v0.63.10 : le catalogue nomme la primitive par `nom` (une fois), jamais par un chemin de module.
  const catalogue = readFileSync(join(RACINE, 'app', 'langage', 'descriptions-operations.js'), 'utf8');
  assert.equal(/partition-couvertures/.test(catalogue), false);
  assert.equal(catalogue.split('nom: \'partagerCouvertures\'').length - 1, 1);
});
// === FIN_TEST_PARTITION_COUVERTURES ===
