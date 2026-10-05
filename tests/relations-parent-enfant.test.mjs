// === DEBUT_TEST_RELATIONS_PARENT_ENFANT ===
// v0.63.11 — ÉTAPE 6, décision ChatGPT « RELATION STRUCTURELLE PARENT → ENFANT » (04/10/2026). Preuves que
// app/langage/relations-parent-enfant.js rend exactement [{ parent, enfant }] (copies neuves, ordre canonique de l'enfant), uniquement
// quand le parent IMMÉDIAT est dans l'univers (jamais d'« ancêtre le plus proche »), avec l'identité typée de v0.63.6 (sans
// sérialisation), sans lire type / valeur / contenu, sans dépendre de l'ordre brut, sans jamais modifier l'entrée, et que segment,
// profondeur, ancêtres, sous-arbres et reconstruction se calculent DANS LES TESTS SEULEMENT. Les clés JSON de ce fichier sont des
// ORACLES ; le module n'en emploie aucune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/relations-parent-enfant.js';
import { normaliserCouverture } from '../app/langage/couverture-occurrences.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const { relationsParentEnfant: relations } = module;
const RACINE = join(import.meta.dirname, '..');
const NOM_MODULE = 'app/langage/relations-parent-enfant.js';
const SOURCE = readFileSync(join(RACINE, NOM_MODULE), 'utf8');
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
const oracle = (chemins) => {
  const presents = new Set(chemins.map(cle));
  return trierOracle(chemins).filter((c) => c.length > 0 && presents.has(cle(c.slice(0, -1)))).map((c) => ({ parent: c.slice(0, -1), enfant: c }));
};
let graine = 20261011;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const entier = (n) => Math.floor(alea() * n);
const melanger = (t) => { const r = t.slice(); for (let i = r.length - 1; i > 0; i -= 1) { const j = entier(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const geler = (x) => { if (x !== null && typeof x === 'object') { for (const k of Object.keys(x)) geler(x[k]); Object.freeze(x); } return x; };
const U = (...chemins) => chemins.map((chemin) => ({ chemin }));
const SEGMENTS = [0, 1, 2, 10, 9, 'a', 'b', '', '0', '1', 'a/b', 'a.b', 'a,b', 'B', 'é', '\u0001', 'a|b'];
const cheminAleatoire = () => { const n = entier(5); const c = []; for (let i = 0; i < n; i += 1) c.push(SEGMENTS[entier(SEGMENTS.length)]); return c; };
const universAleatoire = () => { const vus = new Set(); const r = []; const n = entier(30); for (let i = 0; i < n; i += 1) { const c = cheminAleatoire(); if (!vus.has(cle(c))) { vus.add(cle(c)); r.push(c); } } return r; };
const VALEURS = [
  ['objet vide', {}], ['tableau vide', []], ['objet imbriqué', { a: { b: { c: 1 } }, z: 'x' }], ['tableau imbriqué', [[1, [2, [3]]], []]],
  ['mélange', { b: [1, { a: [null, true] }], a: {}, c: [[], {}] }], ['chaîne', 'x'], ['null', null], ['booléen', false], ['nombre', 7], ['-0', -0],
  ['vides imbriqués', { a: [], b: {}, c: [[], {}] }],
];
const INVALIDES = [['undefined', undefined], ['null', null], ['objet', {}], ['chaîne', 'a'], ['nombre', 3], ['fonction', () => 1]];

// ============================================================================ A. CONTRAT
test('A1. exactement un export : relationsParentEnfant(univers)', () => {
  assert.deepEqual(Object.keys(module), ['relationsParentEnfant']);
  assert.equal(typeof relations, 'function'); assert.equal(relations.length, 1);
});
test('A2. sortie : un tableau de { parent, enfant } exactement, deux tableaux, aucun autre champ, objets simples', () => {
  const r = relations(U([], ['x'], ['x', 0]));
  assert.equal(Array.isArray(r), true); assert.equal(r.length, 2);
  for (const p of r) {
    assert.deepEqual(Object.keys(p), ['parent', 'enfant']);
    assert.deepEqual(Object.getOwnPropertyNames(p), ['parent', 'enfant']);
    assert.equal(Object.getPrototypeOf(p), Object.prototype);
    assert.equal(Object.getOwnPropertySymbols(p).length, 0);
    assert.equal(Array.isArray(p.parent) && Array.isArray(p.enfant), true);
  }
});
test('A3. contenu interdit absent de la sortie : ni segment, profondeur, type, valeur, contenu, nombreEnfants, racine, ancetre, descendant, sousArbre, couverture, raison, score', () => {
  const interdits = ['segment', 'profondeur', 'type', 'valeur', 'contenu', 'nombreEnfants', 'racine', 'ancetre', 'descendant', 'sousArbre', 'couverture', 'raison', 'score'];
  for (const p of relations(parcourirStructure({ a: [1, { b: null }], c: 'x' }))) for (const k of interdits) assert.equal(k in p, false, k);
});

// ============================================================================ B. LECTURE SÛRE ET VALIDATION DÉLÉGUÉE
test('B1. univers non tableau : TypeError', () => { for (const [, v] of INVALIDES) refuse(() => relations(v), /univers doit être un tableau/); });
test('B2. élément qui n\'est pas un objet (null, tableau, primitive) ou sans « chemin » propre : TypeError', () => {
  for (const mauvais of [null, undefined, 3, 'a', true, [], [['a']], () => 1]) refuse(() => relations([mauvais]), /univers\[0\]/);
  refuse(() => relations([{ id: 1 }]), /n'a pas de champ « chemin » propre/);
  refuse(() => relations([{ chemin: ['a'] }, { x: 1 }]), /univers\[1\]/);
});
test('B3. chemin HÉRITÉ rejeté ; chemin ACCESSEUR rejeté SANS être exécuté', () => {
  const herite = Object.create({ chemin: ['a'] });
  refuse(() => relations([herite]), /n'a pas de champ « chemin » propre/);
  let appels = 0;
  const accesseur = { get chemin() { appels += 1; return ['a']; } };
  refuse(() => relations([accesseur]), /accesseur/);
  const proto = Object.create({ get chemin() { appels += 1; return ['a']; } });
  refuse(() => relations([proto]), /n'a pas de champ « chemin » propre/);
  assert.equal(appels, 0, 'aucun accesseur exécuté');
});
test('B4. univers creux rejeté ; accesseur sur un RANG de l\'univers rejeté sans être exécuté', () => {
  const creux = [{ chemin: [] }, , { chemin: ['a'] }]; // eslint-disable-line no-sparse-arrays
  refuse(() => relations(creux), /creux/);
  let appels = 0;
  const avecAccesseur = [{ chemin: [] }];
  Object.defineProperty(avecAccesseur, 1, { get() { appels += 1; return { chemin: ['a'] }; }, enumerable: true, configurable: true });
  refuse(() => relations(avecAccesseur), /accesseur/);
  assert.equal(appels, 0);
  refuse(() => relations(new Array(3)), /creux/);
});
test('B5. type, valeur, contenu, id ne sont NI lus NI validés : des accesseurs qui lèvent ne sont jamais exécutés ; les champs en plus sont ignorés', () => {
  const piege = (nom) => ({ chemin: ['a'], get [nom]() { throw new Error(`lu : ${nom}`); } });
  for (const nom of ['type', 'valeur', 'contenu', 'id']) assert.deepEqual(relations([{ chemin: [] }, piege(nom)]), [{ parent: [], enfant: ['a'] }], nom);
  assert.deepEqual(relations([{ chemin: [], type: 5, valeur: {}, contenu: undefined, id: null }, { chemin: ['a'], type: [], extra: () => 1 }]), [{ parent: [], enfant: ['a'] }]);
  const symbole = Symbol('s');
  assert.deepEqual(relations([{ chemin: [] }, { chemin: ['a'], [symbole]: 1 }]).length, 1);
});
test('B6. chemins invalides (délégués à normaliserCouverture) : TypeError « univers : chemins invalides »', () => {
  for (const c of ['a', 3, null, undefined, {}, [{}], [[]], [-1], [1.5], [NaN], [Infinity], [10n], [Symbol('s')], [undefined], [null], [true]]) {
    refuse(() => relations([{ chemin: c }]), /^univers : chemins invalides/);
  }
});
test('B7. doublon : TypeError, jamais fusionné ; [0] et [-0] forment un doublon ; [] deux fois aussi', () => {
  refuse(() => relations(U(['a'], ['a'])), /doublon|égaux/);
  refuse(() => relations(U([0], [-0])), /égaux/);
  refuse(() => relations(U([], [])), /égaux/);
  refuse(() => relations(U(['a'], ['b'], ['a'])), /égaux/);
  assert.doesNotThrow(() => relations(U([0], ['0'])), '[0] et ["0"] sont deux identités');
});
test('B8. les messages ne contiennent jamais de valeur de chemin', () => {
  const messages = [];
  for (const f of [() => relations(U(['zSECRET'], ['zSECRET'])), () => relations(U(['zSECRET', -1])), () => relations(U(['zSECRET', {}]))]) { try { f(); } catch (e) { messages.push(e.message); } }
  assert.equal(messages.length, 3);
  for (const m of messages) assert.equal(/zSECRET/.test(m), false, m);
});
test('B9. l\'erreur ne produit aucun résultat partiel et l\'univers n\'est pas modifié', () => {
  const univers = U([], ['a'], ['a', 'b'], ['a', 'b']);
  const avantCopie = cle(univers);
  refuse(() => relations(univers));
  assert.equal(cle(univers), avantCopie);
});

// ============================================================================ C. DÉFINITION EXACTE DU PARENT
test('C1. parent = le chemin sans son dernier segment, exactement un retiré', () => {
  assert.deepEqual(relations(U([], ['a'], ['a', 'b'], ['a', 'b', 'c'])), [
    { parent: [], enfant: ['a'] }, { parent: ['a'], enfant: ['a', 'b'] }, { parent: ['a', 'b'], enfant: ['a', 'b', 'c'] },
  ]);
});
test('C2. racine : jamais enfant ; parent d\'un chemin de longueur 1 sans traitement spécial', () => {
  assert.deepEqual(relations(U([])), []);
  assert.deepEqual(relations(U([], [0])), [{ parent: [], enfant: [0] }]);
  assert.equal(relations(U([], ['a'], ['b'])).every((p) => p.enfant.length > 0), true);
  for (const p of relations(U([], ['a'], ['a', 'b']))) assert.notDeepEqual(p.enfant, []);
});
test('C3. un enfant sans racine dans l\'univers : pas de paire (la racine n\'est pas inventée)', () => {
  assert.deepEqual(relations(U(['a'])), []);
  assert.deepEqual(relations(U([0], ['a'], ['b', 'c'])), []);
});
test('C4. plusieurs enfants d\'un même parent : une paire par enfant, parent copié à chaque fois', () => {
  const r = relations(U(['p'], ['p', 'x'], ['p', 'y'], ['p', 0]));
  assert.deepEqual(r, [{ parent: ['p'], enfant: ['p', 0] }, { parent: ['p'], enfant: ['p', 'x'] }, { parent: ['p'], enfant: ['p', 'y'] }]);
});
test('C5. un parent n\'est pas un enfant d\'un autre seulement parce qu\'il le précède : l\'identité est typée et complète', () => {
  assert.deepEqual(relations(U(['a'], ['ab'], ['ab', 'c'])), [{ parent: ['ab'], enfant: ['ab', 'c'] }]);
  assert.deepEqual(relations(U(['a', 'b'], ['a', 'bc'])), []);
});

// ============================================================================ D. IDENTITÉ TYPÉE (aucune sérialisation)
test('D1. [] != [""] : « "" » est un enfant de [], et [""] n\'est PAS la racine', () => {
  assert.deepEqual(relations(U([], [''])), [{ parent: [], enfant: [''] }]);
  assert.deepEqual(relations(U([''], ['', 'x'])), [{ parent: [''], enfant: ['', 'x'] }]);
  assert.deepEqual(relations(U([''], ['x'])), [], '["x"] n\'a pas pour parent [""] ');
  assert.deepEqual(relations(U([''], ['', ''])), [{ parent: [''], enfant: ['', ''] }]);
});
test('D2. [0] != ["0"] : le parent est recherché avec son TYPE de segment', () => {
  assert.deepEqual(relations(U([0], [0, 'x'])), [{ parent: [0], enfant: [0, 'x'] }]);
  assert.deepEqual(relations(U(['0'], ['0', 'x'])), [{ parent: ['0'], enfant: ['0', 'x'] }]);
  assert.deepEqual(relations(U([0], ['0', 'x'])), [], 'le parent de ["0","x"] est ["0"], absent');
  assert.deepEqual(relations(U(['0'], [0, 'x'])), [], 'le parent de [0,"x"] est [0], absent');
  assert.deepEqual(relations(U([], [0], ['0'])), [{ parent: [], enfant: [0] }, { parent: [], enfant: ['0'] }]);
});
test('D3. ["a/b"], ["a,b"], ["a.b"], ["a|b"], ["a\\u0001b"] != ["a","b"] : aucun séparateur n\'est interprété', () => {
  for (const s of ['a/b', 'a,b', 'a.b', 'a|b', 'a\u0001b']) {
    assert.deepEqual(relations(U([s], ['a', 'b'])), [], s);
    assert.deepEqual(relations(U(['a'], [s])), [], s);
    assert.deepEqual(relations(U([s], [s, 'x'])), [{ parent: [s], enfant: [s, 'x'] }], s);
    assert.deepEqual(relations(U(['a'], ['a', 'b'], [s])), [{ parent: ['a'], enfant: ['a', 'b'] }], s);
  }
  assert.deepEqual(relations(U([], ['a'], ['a', 'b'], ['a/b'])).map((p) => cle(p.enfant)), [cle(['a']), cle(['a', 'b']), cle(['a/b'])]);
});
test('D4. préfixes : ["a"] n\'est pas préfixe immédiat de ["a","b","c"] ; ["a","b"] ne l\'est pas de ["a","bc"]', () => {
  assert.deepEqual(relations(U(['a'], ['a', 'b', 'c'])), []);
  assert.deepEqual(relations(U(['a', 'b'], ['a', 'bc', 'd'], ['a', 'b', 'd'])), [{ parent: ['a', 'b'], enfant: ['a', 'b', 'd'] }]);
});
test('D5. caractères délicats : U+0001, "|", chaînes vides répétées, accents, casse', () => {
  const univers = U([], ['\u0001'], ['\u0001', '|'], ['|'], ['|', '\u0001'], ['é'], ['E'], ['é', ''], ['', '']);
  assert.deepEqual(relations(univers), oracle(univers.map((u) => u.chemin)));
});

// ============================================================================ E. -0
test('E1. [0] et [-0] sont une même identité : le parent [-0] est trouvé pour l\'enfant [0, "x"] ; la représentation est celle de l\'élément porteur', () => {
  const r = relations(U([-0], [0, 'x']));
  assert.equal(r.length, 1);
  assert.equal(Object.is(r[0].parent[0], -0), true, 'parent : représentation de l\'élément parent');
  assert.equal(Object.is(r[0].enfant[0], 0), true, 'enfant : représentation de l\'élément enfant');
  const s = relations(U([0], [-0, 'x']));
  assert.equal(Object.is(s[0].parent[0], 0), true);
  assert.equal(Object.is(s[0].enfant[0], -0), true);
});
test('E2. un enfant [-0] sous la racine conserve sa représentation ; -0 en milieu de chemin', () => {
  const r = relations(U([], [-0]));
  assert.equal(r.length, 1);
  assert.equal(Object.is(r[0].enfant[0], -0), true);
  const m = relations(U([0], [0, -0], [0, 0, 5]));
  assert.equal(m.length, 2, '[0,0] et [0,-0] sont une même identité : le parent de [0,0,5] est [0,-0]');
  assert.equal(Object.is(m[1].parent[1], -0), true, 'représentation de l\'élément parent');
});
test('E3. [0,0] et [0,-0] dans le même univers : doublon refusé', () => {
  refuse(() => relations(U([0, 0], [0, -0])), /égaux/);
});

// ============================================================================ F. UNIVERS NON CLOS
test('F1. cas obligatoire : ["a"] et ["a","b","c"] — le second n\'a PAS de paire', () => {
  assert.deepEqual(relations([{ chemin: ['a'] }, { chemin: ['a', 'b', 'c'] }]), []);
});
test('F2. jamais d\'« ancêtre le plus proche présent » : l\'enfant n\'est pas rattaché à un ancêtre plus lointain', () => {
  const r = relations(U([], ['a'], ['a', 'b', 'c'], ['d', 'e']));
  assert.deepEqual(r, [{ parent: [], enfant: ['a'] }]);
  for (const p of r) assert.equal(p.enfant.length - p.parent.length, 1, 'le parent est toujours à un segment de l\'enfant');
});
test('F3. le parent est ajouté plus tard : la paire apparaît (seule la présence du parent compte)', () => {
  assert.deepEqual(relations(U(['a'], ['a', 'b', 'c'])), []);
  assert.deepEqual(relations(U(['a'], ['a', 'b', 'c'], ['a', 'b'])), [{ parent: ['a'], enfant: ['a', 'b'] }, { parent: ['a', 'b'], enfant: ['a', 'b', 'c'] }]);
});
test('F4. sous-ensemble d\'un univers complet : seules subsistent les arêtes dont les deux extrémités sont présentes', () => {
  const complet = parcourirStructure({ a: [1, { b: null }], c: { d: 'x' } }).map((o) => o.chemin);
  for (let t = 0; t < 30; t += 1) {
    const sous = complet.filter(() => alea() < 0.6);
    assert.deepEqual(relations(sous.map((chemin) => ({ chemin }))), oracle(sous));
  }
});

// ============================================================================ G. UNIVERS COMPLET : |U| − 1 PAIRES
test('G1. pour U = parcourirStructure(valeur) : |U| − 1 paires, chaque non-racine est enfant exactement une fois, la racine jamais', () => {
  for (const [nom, v] of VALEURS) {
    const O = parcourirStructure(v);
    const r = relations(O);
    assert.equal(r.length, O.length - 1, nom);
    const enfants = r.map((p) => cle(p.enfant));
    assert.equal(new Set(enfants).size, enfants.length, `${nom} : aucun enfant en double`);
    const attendus = O.filter((o) => o.chemin.length > 0).map((o) => cle(o.chemin)).sort();
    assert.deepEqual([...enfants].sort(), attendus, nom);
    assert.equal(r.some((p) => p.enfant.length === 0), false, nom);
  }
});
test('G2. valeurs structurées aléatoires : |U| − 1 paires, égales à l\'oracle', () => {
  const contenu = (prof = 0) => {
    const t = entier(prof >= 3 ? 4 : 6);
    if (t === 0) return entier(5); if (t === 1) return ['', 'a', 'b'][entier(3)]; if (t === 2) return alea() < 0.5; if (t === 3) return null;
    if (t === 4) { const r = []; for (let i = 0, n = entier(4); i < n; i += 1) r.push(contenu(prof + 1)); return r; }
    const r = {}; for (let i = 0, n = entier(4); i < n; i += 1) r[['a', 'b', '0', '', 'c'][entier(5)]] = contenu(prof + 1); return r;
  };
  for (let t = 0; t < 120; t += 1) {
    const O = parcourirStructure(contenu());
    const r = relations(O);
    assert.equal(r.length, O.length - 1);
    assert.deepEqual(r, oracle(O.map((o) => o.chemin)));
  }
});

// ============================================================================ H. CAS LIMITES
test('H1. univers [] → [] ; seulement la racine → [] ; racine + un enfant', () => {
  assert.deepEqual(relations([]), []);
  assert.deepEqual(relations(U([])), []);
  assert.deepEqual(relations(U([], ['a'])), [{ parent: [], enfant: ['a'] }]);
  assert.deepEqual(relations(U(['a'], [])), [{ parent: [], enfant: ['a'] }], 'ordre brut inversé');
});
test('H2. objets / tableaux vides, imbriqués, mélange, racines scalaires, null, booléen, -0', () => {
  assert.deepEqual(relations(parcourirStructure({})), []);
  assert.deepEqual(relations(parcourirStructure([])), []);
  assert.deepEqual(relations(parcourirStructure({ a: { b: {} } })).map((p) => cle(p.enfant)), [cle(['a']), cle(['a', 'b'])]);
  assert.deepEqual(relations(parcourirStructure([[], [[]]])).map((p) => cle(p.enfant)), [cle([0]), cle([1]), cle([1, 0])]);
  for (const v of ['x', 7, null, false, -0, '']) assert.deepEqual(relations(parcourirStructure(v)), [], String(v));
  assert.equal(relations(parcourirStructure({ a: [-0] }))[1].enfant[1] === 0, true);
  assert.equal(Object.is(relations(parcourirStructure({ a: [-0] }))[1].enfant[1], 0), true, 'chemin d\'index entier, jamais -0 (la valeur -0 n\'est pas dans le chemin)');
});
test('H3. univers permuté et univers gelé en profondeur : mêmes résultats, aucune erreur', () => {
  const O = parcourirStructure({ a: [1, { b: null }], c: { d: 'x' }, e: [] });
  const attendu = relations(O);
  assert.deepEqual(relations(geler(structuredClone(O))), attendu);
  assert.deepEqual(relations(Object.freeze(melanger(O))), attendu);
  assert.deepEqual(relations(geler(structuredClone(melanger(O)))), attendu);
});

// ============================================================================ I. CATALOGUE RÉEL (TESTS SEULEMENT)
const OCC = parcourirStructure(DESCRIPTIONS_OPERATIONS);
const REL = relations(OCC);
test('I1. catalogue : 281 occurrences, 280 relations ; aucun de ces nombres n\'est codé dans la primitive', () => {
  assert.equal(OCC.length, 281); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 270 → 281 (+ symbolesDeChaine)
  assert.equal(REL.length, 280); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 269 → 280
  assert.equal(REL.length, OCC.length - 1);
  assert.equal(/\b(269|270|280|281|9|10)\b/.test(CODE), false);
});
test('I2. dix enfants directs de la racine ; chaque non-racine est enfant exactement une fois', () => {
  const fils = REL.filter((p) => p.parent.length === 0);
  assert.equal(fils.length, 10); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10
  assert.deepEqual(fils.map((p) => p.enfant), [[0], [1], [2], [3], [4], [5], [6], [7], [8], [9]]);
  const enfants = REL.map((p) => cle(p.enfant));
  assert.equal(new Set(enfants).size, 280); // MISE À JOUR DÉLIBÉRÉE v0.63.38
  assert.deepEqual([...enfants].sort(), OCC.filter((o) => o.chemin.length > 0).map((o) => cle(o.chemin)).sort());
});
test('I3. égal à l\'oracle indépendant, ordre canonique du chemin enfant', () => {
  assert.deepEqual(REL, oracle(OCC.map((o) => o.chemin)));
  assert.deepEqual(REL.map((p) => p.enfant), normaliserCouverture(OCC.map((o) => o.chemin)).filter((c) => c.length > 0));
});

// ============================================================================ J. NEUF SOUS-ARBRES (fermeture descendante : DANS LE TEST)
function enfantsPar(paires) {
  const m = new Map();
  for (const p of paires) { const k = cle(p.parent); if (!m.has(k)) m.set(k, []); m.get(k).push(p.enfant); }
  return m;
}
function sousArbre(m, chemin) { const r = [chemin]; for (const e of m.get(cle(chemin)) || []) r.push(...sousArbre(m, e)); return r; }
test('J1. la fermeture descendante depuis chacun des dix enfants de la racine donne 44, 24, 45, 18, 15, 21, 36, 39, 27, 11', () => {
  const m = enfantsPar(REL);
  const racines = (m.get(cle([])) || []);
  assert.equal(racines.length, 10); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10
  assert.deepEqual(racines.map((c) => sousArbre(m, c).length), [44, 24, 45, 18, 15, 21, 36, 39, 27, 11]); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : + 11 (symbolesDeChaine, dernier par ordre de nom)
});
test('J2. les sous-arbres égalent les ensembles « chemin préfixé par [i] » (oracle de test) et recouvrent tout l\'univers avec la racine', () => {
  const m = enfantsPar(REL);
  const vus = new Set([cle([])]);
  for (const c of m.get(cle([]))) {
    const sa = sousArbre(m, c).map(cle).sort();
    const prefixe = OCC.filter((o) => o.chemin[0] === c[0]).map((o) => cle(o.chemin)).sort();
    assert.deepEqual(sa, prefixe, cle(c));
    for (const x of sa) { assert.equal(vus.has(x), false); vus.add(x); }
  }
  assert.equal(vus.size, OCC.length);
});

// ============================================================================ K. RECONSTRUCTION (ORACLE DE TEST, JAMAIS PRODUCTION)
function reconstruire(O, paires) {
  const parChemin = new Map(O.map((o) => [cle(o.chemin), o]));
  const m = enfantsPar(paires);
  const noeud = (o) => {
    if (o.type === 'nul') return null;
    if (o.type === 'chaine' || o.type === 'booleen' || o.type === 'nombre') return o.valeur;
    const fils = m.get(cle(o.chemin)) || [];
    if (o.type === 'tableau') { const r = []; for (const e of fils) r[e[e.length - 1]] = noeud(parChemin.get(cle(e))); return r; }
    const r = {}; for (const e of fils) r[e[e.length - 1]] = noeud(parChemin.get(cle(e))); return r;
  };
  return noeud(O.find((o) => o.chemin.length === 0));
}
const trierCles = (v) => (Array.isArray(v) ? v.map(trierCles) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, trierCles(v[k])])) : v);
test('K1. occurrences + relations reconstruisent exactement la topologie ET les valeurs : catalogue, objets, tableaux, vides imbriqués, racines scalaires, null, -0', () => {
  const cas = [['catalogue', DESCRIPTIONS_OPERATIONS], ...VALEURS, ['racine {}', {}], ['racine []', []], ['chaîne vide', ''], ['tableau de null', [null, null]], ['objet clé vide', { '': { '': [] } }]];
  for (const [nom, v] of cas) {
    const O = parcourirStructure(v);
    const rec = reconstruire(O, relations(O));
    if (Object.is(v, -0)) { assert.equal(Object.is(rec, -0), true, nom); continue; }
    assert.deepEqual(rec, trierCles(JSON.parse(JSON.stringify(v))), nom);
    assert.equal(cle(rec), cle(trierCles(JSON.parse(JSON.stringify(v)))), nom);
  }
});
test('K2. la TOPOLOGIE seule (sans valeurs) est exacte : mêmes nœuds, mêmes arêtes ; les types restent nécessaires pour distinguer {} , [] et une feuille', () => {
  const O = parcourirStructure({ a: [], b: {}, c: 1 });
  const r = relations(O);
  assert.equal(r.length, 3);
  assert.deepEqual(r.map((p) => cle(p.enfant)), [cle(['a']), cle(['b']), cle(['c'])]);
  assert.equal(cle(relations(parcourirStructure({ a: 1, b: 1, c: 1 }))), cle(r.map((p) => p)), 'même topologie pour des types différents : les types ne sont PAS dans la relation');
});

// ============================================================================ L. SEGMENT, PROFONDEUR, ANCÊTRES (TESTS SEULEMENT)
test('L1. le dernier segment de l\'enfant après le préfixe parent est récupérable sans être stocké', () => {
  for (const p of REL) {
    assert.equal(p.enfant.length, p.parent.length + 1);
    assert.deepEqual(p.enfant.slice(0, p.parent.length), p.parent);
    const segment = p.enfant[p.enfant.length - 1];
    assert.deepEqual([...p.parent, segment], p.enfant);
    assert.equal('segment' in p, false);
  }
});
test('L2. profondeur par répétition parentale = longueur du chemin ; fermeture des parents = relation d\'ancêtre attendue', () => {
  const parDe = new Map(REL.map((p) => [cle(p.enfant), p.parent]));
  let ancetres = 0;
  for (const o of OCC) {
    let n = 0; let c = o.chemin; const chaine = [];
    while (parDe.has(cle(c))) { c = parDe.get(cle(c)); chaine.push(cle(c)); n += 1; }
    assert.equal(n, o.chemin.length, cle(o.chemin));
    assert.deepEqual(c, [], 'on remonte toujours à la racine');
    const attendus = o.chemin.map((_, i) => cle(o.chemin.slice(0, i)));
    assert.deepEqual(chaine, attendus.reverse(), 'ancêtres du plus proche au plus lointain');
    ancetres += n;
  }
  assert.equal(ancetres, 1359, // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 1327 → 1359
     'paires ancêtre → descendant du catalogue');
});
test('L3. même parent : les enfants d\'un parent partagent exactement le préfixe parent', () => {
  const m = enfantsPar(REL);
  let paires = 0;
  for (const [, fils] of m) for (let i = 0; i < fils.length; i += 1) for (let j = i + 1; j < fils.length; j += 1) { assert.deepEqual(fils[i].slice(0, -1), fils[j].slice(0, -1)); paires += 1; }
  assert.equal(paires, 198); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 183 → 198
});

// ============================================================================ M. INVARIANCE À L'ORDRE
test('M1. permuter l\'univers de nombreuses fois : la sortie reste identique (valeur ET ordre)', () => {
  const attendu = relations(OCC);
  for (let t = 0; t < 40; t += 1) assert.deepEqual(relations(melanger(OCC)), attendu);
  for (let t = 0; t < 60; t += 1) {
    const chemins = universAleatoire();
    const base = relations(U(...chemins));
    assert.deepEqual(base, oracle(chemins));
    assert.deepEqual(relations(U(...melanger(chemins))), base);
    assert.deepEqual(relations(U(...chemins.slice().reverse())), base);
  }
});
test('M2. l\'ordre de sortie est l\'ordre canonique de l\'enfant (aucune signification) et se lit sur le chemin enfant seul', () => {
  const r = relations(U(['b'], [], ['a', 'z'], ['a'], [0], [1], ['b', 0], [0, 'x']));
  assert.deepEqual(r.map((p) => p.enfant), normaliserCouverture(r.map((p) => p.enfant)));
});

// ============================================================================ N. GÉNÉRALITÉ : RENOMMAGE
test('N1. seule la structure des chemins compte : renommer tous les segments chaîne par une bijection donne la relation renommée', () => {
  const renom = (s) => (typeof s === 'string' ? `Z${[...s].reverse().join('')}Z` : s);
  const renommee = OCC.map((o) => ({ chemin: o.chemin.map(renom), type: 'zzz', valeur: 0, nom: 'x', entrees: 1, sortie: 2, forme: 3 }));
  const a = relations(renommee);
  const b = REL.map((p) => ({ parent: p.parent.map(renom), enfant: p.enfant.map(renom) }));
  assert.equal(a.length, b.length);
  assert.deepEqual([...a].map((p) => cle(p.enfant)).sort(), b.map((p) => cle(p.enfant)).sort());
  const parA = new Map(a.map((p) => [cle(p.enfant), cle(p.parent)]));
  for (const p of b) assert.equal(parA.get(cle(p.enfant)), cle(p.parent));
});
test('N2. la sortie est la même que les objets portent ou non type, valeur, contenu, id, nom, entrees, sortie, forme', () => {
  const nus = OCC.map((o) => ({ chemin: o.chemin }));
  const charges = OCC.map((o) => ({ ...o, id: 'i', contenu: { x: 1 }, nom: 'n', entrees: [], sortie: {}, forme: 'f' }));
  assert.deepEqual(relations(nus), REL);
  assert.deepEqual(relations(charges), REL);
});

// ============================================================================ O. COPIES NEUVES, ENTRÉE INTACTE
test('O1. jamais les tableaux de l\'entrée : parent et enfant sont des copies neuves, jamais partagées entre deux paires', () => {
  const univers = U([], ['a'], ['a', 'b'], ['a', 'c']);
  const entrees = new Set(univers.map((u) => u.chemin));
  const r = relations(univers);
  const vus = new Set();
  for (const p of r) for (const c of [p.parent, p.enfant]) { assert.equal(entrees.has(c), false); assert.equal(vus.has(c), false); vus.add(c); }
  assert.equal(vus.size, r.length * 2);
});
test('O2. modifier la sortie ne modifie pas l\'univers ; l\'univers n\'est jamais modifié', () => {
  const univers = U([], ['a'], ['a', 'b']);
  const avantCopie = cle(univers);
  const r = relations(univers);
  r[0].parent.push('X'); r[1].enfant.push('Y'); r[1].parent[0] = 'Z'; r.pop();
  assert.equal(cle(univers), avantCopie);
  assert.deepEqual(relations(univers), [{ parent: [], enfant: ['a'] }, { parent: ['a'], enfant: ['a', 'b'] }]);
  const gele = geler(U([], ['a']));
  assert.doesNotThrow(() => relations(gele));
});
test('O3. modifier l\'univers après coup ne modifie pas une sortie déjà rendue', () => {
  const univers = U([], ['a'], ['a', 'b']);
  const r = relations(univers);
  const instantane = cle(r);
  univers[1].chemin.push('Q'); univers.length = 0;
  assert.equal(cle(r), instantane);
});

// ============================================================================ P. ORACLE ALÉATOIRE
test('P1. univers aléatoires (segments piégeux, préfixes, 0 / "0", "" ) : égal à l\'oracle indépendant', () => {
  for (let t = 0; t < 300; t += 1) {
    const chemins = universAleatoire();
    assert.deepEqual(relations(U(...chemins)), oracle(chemins));
  }
});
test('P2. coût : le catalogue (270 chemins) se traite en un temps raisonnable', () => {
  const t0 = Date.now();
  relations(OCC);
  assert.ok(Date.now() - t0 < 5000);
});

// ============================================================================ Q. GARDES STATIQUES ET DORMANCE
function fichiers(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) { if (nom !== 'node_modules') fichiers(p, sortie); } else sortie.push(p);
  }
  return sortie;
}
const rel = (f) => relative(RACINE, f).split('\\').join('/');
test('Q1. le module n\'importe que couverture-occurrences.js et n\'exporte que relationsParentEnfant', () => {
  assert.deepEqual(CODE.match(/^\s*import\b.*$/gm).map((l) => l.trim()), ["import { normaliserCouverture, memesCouvertures } from './couverture-occurrences.js';"]);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function relationsParentEnfant(univers) {']);
  assert.equal(/\brequire\s*\(|\bimport\s*\(/.test(CODE), false);
});
test('Q2. aucune sérialisation ni égalité de chaînes : ni JSON, ni join, ni String(), ni hachage, ni Map / Set, ni toString, ni template de chemin', () => {
  assert.equal(/JSON|\.join\s*\(|\bString\s*\(|\.toString|\bhash|\bMap\b|\bSet\b|WeakMap|WeakSet|Object\.is|\.sort\s*\(|localeCompare|\.concat\b|\.indexOf\b|\.includes\b/i.test(CODE), false);
  assert.equal(/\$\{[^}]*(chemin|enfant|parent|attendu)[^}]*\}/.test(CODE.replace(/TypeError\([^\n]*\n?/g, '')), false, 'aucun chemin interpolé hors messages');
});
test('Q3. vocabulaire : la primitive ne connaît ni le catalogue, ni parcourirStructure, ni les producteurs, ni CAPACITES, ni nom / entrees / sortie / forme / opération', () => {
  assert.equal(/DESCRIPTIONS_OPERATIONS|descriptions-operations|parcourirStructure|parcours-structure|produireConstatsStructurels|constats-structurels|partagerCouvertures|partition-couvertures|resoudreCouverture|resolution-couverture|CAPACITES|registre|formes-operation|garantie-forme|couvrirSequence|decrireValeursObservees|decrireStructureIdentifiee/.test(CODE), false);
  assert.equal(/DESCRIPTIONS_OPERATIONS|descriptions-operations|parcourirStructure|parcours-structure|produireConstatsStructurels|constats-structurels|partagerCouvertures|partition-couvertures|CAPACITES|registre|formes-operation|garantie-forme/.test(SOURCE), false, 'même les commentaires ne nomment que resoudreCouverture (contrat repris)');
  assert.equal(/\.(nom|entrees|sortie|forme|champs|elements|type|valeur|contenu|id)\b|['"](nom|entrees|sortie|forme|type|valeur|contenu)['"]/.test(CODE), false);
  assert.equal(/ancetre|descendant|sousArbre|profondeur|nombreEnfants|segment|raison|score|priorite|interet|preference|attention|curiosite|fermeture|bfs|dfs/i.test(CODE), false);
});
test('Q4. aucun I/O, horloge, hasard, persistance, async, eval ; aucune fonction exportée autre que la primitive', () => {
  assert.equal(/Date\.now|new Date|Math\.random|localStorage|sessionStorage|indexedDB|\bfetch\b|\bprocess\.|\beval\b|new\s+Function|\basync\b|\bawait\b|setTimeout|setInterval|document\.|window\.|console\./.test(CODE), false);
  assert.deepEqual(CODE.match(/\bfunction\s+\w+/g), ['function lireCheminPropre', 'function relationsParentEnfant']);
});
test('Q5. aucun fichier de production n\'importe ni ne nomme ce module ou sa fonction ; le catalogue ne la décrit pas (décision v0.63.11)', () => {
  const fautifs = [];
  for (const f of fichiers(join(RACINE, 'app'))) {
    if (rel(f) === NOM_MODULE) continue;
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (/relations-parent-enfant|relationsParentEnfant/.test(src)) fautifs.push(rel(f));
  }
  assert.deepEqual(fautifs, []);
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/relations-parent-enfant/.test(src), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 10); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => d.nom === 'relationsParentEnfant'), false);
});
test('Q6. le module est INACCESSIBLE depuis le démarrage : parcours des imports statiques depuis app/main.js', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|table-operations)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs)
  }
  assert.ok(vus.size > 20);
  assert.equal([...vus].some((f) => rel(f) === NOM_MODULE), false);
  assert.equal([...vus].some((f) => rel(f) === 'app/langage/couverture-occurrences.js'), false);
});
test('Q7. les seuls importeurs de couverture-occurrences sont exactement connus (ce module en fait partie) ; aucun autre module existant n\'importe celui-ci', () => {
  const importeurs = [];
  for (const f of fichiers(join(RACINE, 'app'))) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (/from\s*'\.\/couverture-occurrences\.js'/.test(src)) importeurs.push(rel(f));
  }
  assert.deepEqual(importeurs.sort(), ['app/langage/constats-structurels.js', 'app/langage/constats-valeurs.js', 'app/langage/partition-couvertures.js', NOM_MODULE, 'app/langage/resolution-couverture.js', 'app/langage/suites-fermees.js', 'app/langage/table-operations.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.18 : table-operations.js rend les opérations LOCALISABLES mécaniquement (importeur statique autorisé, gardé par tests/invocation-operations.test.mjs) ; elles ne sont pas utilisées par le moteur // MISE À JOUR DÉLIBÉRÉE v0.63.32 : + suites-fermees.js (observateur de suites dormant, importe ces primitives)
});
test('Q8. rien d\'autre ne change de statut : CAPACITES inchangée, VERSION_BASE 15, SCHEMA_SAUVEGARDE 5 ; les API précédentes ne sont pas élargies', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  assert.equal(Object.isFrozen(CAPACITES), true);
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 19); assert.equal(sauv.SCHEMA_SAUVEGARDE, 9); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.deepEqual(Object.keys(await import('../app/langage/couverture-occurrences.js')).sort(), ['memesCouvertures', 'normaliserCouverture']);
  assert.deepEqual(Object.keys(await import('../app/langage/resolution-couverture.js')), ['resoudreCouverture']);
  assert.deepEqual(Object.keys(await import('../app/langage/parcours-structure.js')), ['parcourirStructure']);
  assert.deepEqual(Object.keys(await import('../app/langage/constats-structurels.js')), ['produireConstatsStructurels']);
  assert.deepEqual(Object.keys(await import('../app/langage/partition-couvertures.js')), ['partagerCouvertures']);
  for (const f of ['registre.js', 'descriptions-operations.js', 'parcours-structure.js', 'couverture-occurrences.js', 'resolution-couverture.js', 'constats-structurels.js', 'partition-couvertures.js']) {
    assert.equal(/relations-parent-enfant|relationsParentEnfant/.test(readFileSync(join(RACINE, 'app', 'langage', f), 'utf8')), false, f);
  }
});
// === FIN_TEST_RELATIONS_PARENT_ENFANT ===
