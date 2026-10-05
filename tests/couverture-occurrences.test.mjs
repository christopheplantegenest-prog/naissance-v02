// === DEBUT_TEST_COUVERTURE_OCCURRENCES ===
// v0.63.6 — ÉTAPE 6, décision ChatGPT « COUVERTURE PURE D'OCCURRENCES » (04/10/2026). Preuves que app/langage/couverture-occurrences.js
// est une primitive PURE, GÉNÉRALE et DORMANTE : deux exports seulement, chemins valides (chaînes et entiers >= 0, jamais transformés),
// doublon = TypeError, égalité typée sans jamais encoder un chemin en chaîne, ordre de représentation déterministe indépendant de
// l'ordre d'entrée, copie sans partage, ignorance totale de la raison et de l'univers, inaccessibilité depuis le démarrage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/couverture-occurrences.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
// v0.63.10 : le catalogue compte NEUF descriptions. Les mesures de ce fichier (114 occurrences, 14/15 groupes...) portent sur le CORPUS FIGÉ des
// trois descriptions de v0.63.4 (couvrirSequence, decrireStructureIdentifiee, decrireValeursObservees) : les six autres sont écartées ici.
const CORPUS_V0634 = DESCRIPTIONS_OPERATIONS.filter((d) => ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees'].includes(d.nom));

const { normaliserCouverture: norm, memesCouvertures: memes } = module;
const RACINE = join(import.meta.dirname, '..');
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'couverture-occurrences.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));

// Clé d'ORACLE (tests seulement) : JSON d'un tableau de chaînes/entiers = injectif et typé. Jamais utilisée par le module.
const cle = (c) => JSON.stringify(c);
const cles = (cov) => cov.map(cle).sort();
// Oracle d'ordre, écrit autrement que le module (récursif, sur les têtes).
const segAvant = (a, b) => (typeof a !== typeof b ? typeof a === 'number' : a < b);
const avant = (a, b) => {
  if (a.length === 0) return b.length > 0;
  if (b.length === 0) return false;
  if (a[0] !== b[0]) return segAvant(a[0], b[0]);
  return avant(a.slice(1), b.slice(1));
};
let graine = 20261004;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const entier = (n) => Math.floor(alea() * n);
const melanger = (t) => { const r = t.slice(); for (let i = r.length - 1; i > 0; i -= 1) { const j = entier(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const geler = (x) => { if (x !== null && typeof x === 'object') { for (const k of Object.keys(x)) geler(x[k]); Object.freeze(x); } return x; };
const SEGMENTS = [0, 1, 2, 10, 9, 'a', 'b', '', '0', '1', 'a/b', 'a.b', 'a,b', 'B', 'é', '\u0001'];
function cheminAleatoire() { const n = entier(5); const c = []; for (let i = 0; i < n; i += 1) c.push(SEGMENTS[entier(SEGMENTS.length)]); return c; }
function couvertureAleatoire() { const vus = new Set(); const r = []; const n = entier(12); for (let i = 0; i < n; i += 1) { const c = cheminAleatoire(); if (!vus.has(cle(c))) { vus.add(cle(c)); r.push(c); } } return r; }

// ============================================================================ A. CONTRAT
test('A1. exactement deux exports : normaliserCouverture et memesCouvertures', () => {
  assert.deepEqual(Object.keys(module).sort(), ['memesCouvertures', 'normaliserCouverture']);
  assert.equal(typeof norm, 'function'); assert.equal(typeof memes, 'function');
  assert.equal(norm.length, 1); assert.equal(memes.length, 2);
});
test('A2. couverture vide, racine, un chemin, plusieurs chemins', () => {
  assert.deepEqual(norm([]), []);
  assert.deepEqual(norm([[]]), [[]]);
  assert.deepEqual(norm([['a']]), [['a']]);
  assert.deepEqual(norm([[0, 'a'], [1, 'a']]), [[0, 'a'], [1, 'a']]);
  assert.deepEqual(norm([[1, 'a'], [0, 'a']]), [[0, 'a'], [1, 'a']]);
});
test('A3. la sortie est un nouveau tableau plat de nouveaux tableaux, sans propriété additionnelle', () => {
  const sortie = norm([[0, 'a'], [], ['x']]);
  assert.equal(Array.isArray(sortie), true);
  assert.deepEqual(Object.keys(sortie), ['0', '1', '2']);
  for (const c of sortie) { assert.equal(Array.isArray(c), true); assert.equal(Object.getPrototypeOf(c), Array.prototype); assert.deepEqual(Object.keys(c), c.map((_, i) => String(i))); }
});
test('A4. préfixes [], [0], [0,"a"] : conservés, jamais fusionnés', () => {
  assert.deepEqual(norm([[0, 'a'], [0], []]), [[], [0], [0, 'a']]);
  assert.equal(memes([[], [0], [0, 'a']], [[0, 'a'], [], [0]]), true);
  assert.equal(memes([[0]], [[0, 'a']]), false);
  assert.equal(memes([[]], [[0]]), false);
});

// ============================================================================ B. VALIDATION (§2)
const INVALIDES = [
  ['undefined', undefined], ['null', null], ['objet', {}], ['objet avec clé', { a: 1 }], ['tableau imbriqué', ['a']], ['tableau imbriqué vide', []],
  ['négatif', -1], ['négatif -1000', -1000], ['non entier 1.5', 1.5], ['non entier 0.1', 0.1], ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity],
  ['bigint', 10n], ['bigint 0', 0n], ['symbol', Symbol('s')], ['fonction', () => 1], ['booléen true', true], ['booléen false', false],
  ['String objet', new String('a')], ['Number objet', new Number(1)], ['Date', new Date(0)],
];
test('B1. chaque segment invalide est REJETÉ (TypeError), à toute position du chemin et de la couverture', () => {
  for (const [nom, mauvais] of INVALIDES) {
    refuse(() => norm([[mauvais]]), /couverture\[0\]\[0\]/);
    refuse(() => norm([['a', mauvais]]), /couverture\[0\]\[1\]/);
    refuse(() => norm([['a'], [0, 'b', mauvais]]), /couverture\[1\]\[2\]/);
    refuse(() => memes([[mauvais]], [['a']]), /couverture a\[0\]\[0\]/);
    refuse(() => memes([['a']], [[mauvais]]), /couverture b\[0\]\[0\]/);
    assert.ok(nom);
  }
});
test('B2. un chemin qui n\'est pas un tableau, une couverture qui n\'est pas un tableau : TypeError', () => {
  for (const mauvais of [undefined, null, 'a', 0, 1, true, {}, { length: 0 }, () => [], Symbol('s'), 10n, new Map(), new Set()]) {
    refuse(() => norm([mauvais]), /couverture\[0\]/);
    refuse(() => norm(mauvais), /tableau de chemins/);
    refuse(() => memes(mauvais, []), /couverture a/);
    refuse(() => memes([], mauvais), /couverture b/);
  }
  refuse(() => norm(), /tableau de chemins/);
  refuse(() => memes([]), /couverture b/);
  refuse(() => memes(), /couverture a/);
});
test('B3. tableau creux (couverture ou chemin) : TypeError, jamais comblé ni ignoré', () => {
  refuse(() => norm(new Array(2)), /couverture\[0\]/);
  const creux = [['a']]; creux[3] = ['b']; refuse(() => norm(creux), /couverture\[1\]/);
  const chemin = ['a']; chemin[2] = 'b'; refuse(() => norm([chemin]), /couverture\[0\]\[1\]/);
  refuse(() => norm([new Array(1)]), /couverture\[0\]\[0\]/);
});
test('B4. segments valides : chaînes quelconques (vide comprise), entiers >= 0 ; rien n\'est transformé', () => {
  const valides = [[], [''], ['0'], [0], ['a', 'b'], [0, 1, 2], ['é', '\u0000', '\uD83D\uDE00'], [Number.MAX_SAFE_INTEGER], [2 ** 40, 'z']];
  for (const c of valides) assert.deepEqual(norm([c]), [c]);
  const sortie = norm([[0], ['0']]);
  assert.equal(sortie.some((c) => c[0] === 0 && typeof c[0] === 'number'), true);
  assert.equal(sortie.some((c) => c[0] === '0' && typeof c[0] === 'string'), true);
});
test('B5. -0 : accepté (entier >= 0), égal à 0 par identité primitive ; donc [0] et [-0] sont un DOUBLON', () => {
  assert.equal(norm([[-0]]).length, 1);
  refuse(() => norm([[0], [-0]]), /doublon/);
  assert.equal(memes([[0]], [[-0]]), true);
});
test('B6. la validation est complète : un segment invalide tardif empêche tout résultat (aucun filtrage silencieux)', () => {
  const grosse = []; for (let i = 0; i < 50; i += 1) grosse.push([i, 'x']);
  grosse.push([0, 'y', NaN]);
  refuse(() => norm(grosse), /couverture\[50\]\[2\]/);
  let resultat; try { resultat = norm(grosse); } catch { resultat = 'erreur'; }
  assert.equal(resultat, 'erreur');
});
test('B7. aucune valeur n\'est lue par un accesseur de tableau ou convertie : les messages d\'erreur ne contiennent que des positions', () => {
  let lectures = 0;
  const piege = { toString() { lectures += 1; return 'x'; }, valueOf() { lectures += 1; return 1; } };
  refuse(() => norm([[piege]]), /couverture\[0\]\[0\]/);
  refuse(() => norm([[Symbol('secret-à-ne-pas-afficher')]]), /couverture\[0\]\[0\]/);
  assert.equal(lectures, 0);
});

// ============================================================================ C. ÉGALITÉ TYPÉE (§4)
test('C1. contre-exemples d\'identité : jamais de confusion entre deux chemins distincts', () => {
  const paires = [
    [[0], ['0']], [[], ['']], [['a/b'], ['a', 'b']], [['a,b'], ['a', 'b']], [['a.b'], ['a', 'b']], [['a\u0001b'], ['a', 'b']], [['a|b'], ['a', 'b']],
    [['a b'], ['a', 'b']], [['a\u0000b'], ['a', 'b']], [[1, 2], ['1', '2']], [[1, 2], ['1,2']], [[12], [1, 2]], [['', ''], ['']], [[0, 'a'], ['0', 'a']],
    [['x', 0], ['x', '0']], [['0'], ['0', '']], [[], [0]],
  ];
  for (const [p, q] of paires) {
    assert.equal(memes([p], [q]), false, `${cle(p)} contre ${cle(q)}`);
    assert.equal(norm([p, q]).length, 2);
    assert.equal(memes([p, q], [q, p]), true);
    assert.equal(memes([p], [p.slice()]), true);
  }
});
test('C2. les exemples du cahier des charges', () => {
  assert.equal(memes([[0, 'a'], [1, 'a']], [[1, 'a'], [0, 'a']]), true);
  assert.equal(memes([[0]], [['0']]), false);
  assert.equal(memes([[]], [['']]), false);
  assert.equal(memes([['a/b']], [['a', 'b']]), false);
});
test('C3. clé vide, "/", ".", "," dans des couvertures complètes', () => {
  const a = [[], [''], ['/'], ['.'], [','], ['a/b'], ['a', 'b'], ['a.b'], ['a,b']];
  assert.equal(norm(a).length, 9);
  assert.equal(memes(a, melanger(a)), true);
  assert.equal(memes(a, a.slice(0, 8)), false);
  assert.equal(memes(a.slice(1), a.slice(0, 8)), false);
});
test('C4. memesCouvertures : réflexive, symétrique, vide contre vide, vide contre racine, inclusion stricte, tailles différentes', () => {
  assert.equal(memes([], []), true);
  assert.equal(memes([], [[]]), false);
  assert.equal(memes([[]], []), false);
  assert.equal(memes([[]], [[]]), true);
  assert.equal(memes([['a']], [['a'], ['b']]), false);
  assert.equal(memes([['a'], ['b']], [['a']]), false);
  assert.equal(memes([['a'], ['b']], [['a'], ['c']]), false);
  for (let i = 0; i < 300; i += 1) {
    const a = couvertureAleatoire(); const b = couvertureAleatoire();
    assert.equal(memes(a, a), true);
    assert.equal(memes(a, b), memes(b, a));
    const attendu = cles(a).length === cles(b).length && cles(a).every((k, j) => k === cles(b)[j]);
    assert.equal(memes(a, b), attendu);
    assert.equal(memes(a, melanger(a)), true);
  }
});
test('C5. memesCouvertures rend strictement un booléen', () => {
  assert.equal(memes([], []), true); assert.equal(memes([['a']], [['b']]), false);
  assert.equal(typeof memes([['a']], [['a']]), 'boolean');
});

// ============================================================================ D. DOUBLONS (§3)
test('D1. doublon direct, non adjacent, de racine, de chemin long : TypeError', () => {
  refuse(() => norm([['a'], ['a']]), /doublon/);
  refuse(() => norm([['a'], ['b'], ['a']]), /doublon/);
  refuse(() => norm([[], [0], []]), /doublon/);
  refuse(() => norm([[0, 'a', 'b', 'c'], [1], [0, 'a', 'b', 'c']]), /doublon/);
  refuse(() => norm([[0], ['0'], [0]]), /doublon/);
  refuse(() => norm([[''], ['x'], ['']]), /doublon/);
  refuse(() => memes([['a'], ['a']], [['a']]), /couverture a.*doublon/);
  refuse(() => memes([['a']], [['a'], ['a']]), /couverture b.*doublon/);
  refuse(() => memes([['a'], ['a']], [['a'], ['a']]), /doublon/);
});
test('D2. le message de doublon donne les deux rangs d\'origine', () => {
  refuse(() => norm([['z'], ['a'], ['m'], ['a']]), /rangs 1 et 3/);
  refuse(() => norm([['a'], ['b'], ['c'], ['b']]), /rangs 1 et 3/);
});
test('D3. le doublon n\'est ni conservé, ni compté, ni supprimé en silence : aucun résultat', () => {
  for (const entree of [[['a'], ['a']], [[0], [1], [0]], [[], []]]) {
    let sortie = 'aucune'; try { sortie = norm(entree); } catch (e) { sortie = e; }
    assert.equal(sortie instanceof TypeError, true);
  }
});
test('D4. 300 couvertures aléatoires dont UN chemin est dupliqué (position quelconque) : toujours TypeError ; sans doublon : jamais', () => {
  for (let i = 0; i < 300; i += 1) {
    const base = couvertureAleatoire();
    assert.doesNotThrow(() => norm(base));
    if (base.length === 0) continue;
    const copie = base.slice(); copie.splice(entier(copie.length + 1), 0, base[entier(base.length)].slice());
    refuse(() => norm(copie), /doublon/);
  }
});
test('D5. un chemin invalide est signalé avant un doublon ; les erreurs ne modifient pas l\'entrée', () => {
  const e = [['a'], ['a'], [NaN]];
  const avantE = cle(e.map((c) => c.map(String)));
  refuse(() => norm(e), /couverture\[2\]\[0\]/);
  assert.equal(cle(e.map((c) => c.map(String))), avantE);
});

// ============================================================================ E. ORDRE DE REPRÉSENTATION (§5)
test('E1. lexicographique : préfixes avant prolongements, plus court avant plus long', () => {
  assert.deepEqual(norm([[1], [0, 'a', 'x'], [0, 'a'], [0], []]), [[], [0], [0, 'a'], [0, 'a', 'x'], [1]]);
  assert.deepEqual(norm([['a', 'b'], ['a'], []]), [[], ['a'], ['a', 'b']]);
  assert.deepEqual(norm([[0, 0], [0], [0, 0, 0]]), [[0], [0, 0], [0, 0, 0]]);
});
test('E2. nombres avant chaînes, quelle que soit leur valeur', () => {
  assert.deepEqual(norm([['0'], [5], [0], ['']]), [[0], [5], [''], ['0']]);
  assert.deepEqual(norm([['a'], [10 ** 9]]), [[10 ** 9], ['a']]);
  assert.deepEqual(norm([[1, 'a'], ['0', 'a'], [1, 0]]), [[1, 0], [1, 'a'], ['0', 'a']]);
});
test('E3. nombres par ordre numérique, JAMAIS lexical', () => {
  assert.deepEqual(norm([[10], [9], [100], [2], [1]]), [[1], [2], [9], [10], [100]]);
  assert.deepEqual(norm([[0, 10], [0, 9], [0, 2]]), [[0, 2], [0, 9], [0, 10]]);
  assert.deepEqual(norm([[2 ** 40], [3], [2 ** 40 - 1]]), [[3], [2 ** 40 - 1], [2 ** 40]]);
});
test('E4. chaînes par unités de code, JAMAIS par localeCompare (casse, accents, substituts)', () => {
  assert.deepEqual(norm([['a'], ['B'], ['Z'], ['é'], ['a1'], ['b'], ['']]), [[''], ['B'], ['Z'], ['a'], ['a1'], ['b'], ['é']]);
  assert.deepEqual(norm([['\uFF5E'], ['\uD83D\uDE00'], ['z']]), [['z'], ['\uD83D\uDE00'], ['\uFF5E']]);
  assert.deepEqual(norm([['ab'], ['a'], ['aB']]), [['a'], ['aB'], ['ab']]);
});
test('E5. l\'ordre ne dépend pas de l\'ordre d\'entrée : 400 couvertures aléatoires × 5 mélanges, contre un oracle indépendant', () => {
  for (let i = 0; i < 400; i += 1) {
    const base = couvertureAleatoire();
    const reference = norm(base);
    for (let m = 0; m < 5; m += 1) assert.deepEqual(norm(melanger(base)), reference);
    for (let k = 1; k < reference.length; k += 1) assert.equal(avant(reference[k - 1], reference[k]), true, `${cle(reference[k - 1])} avant ${cle(reference[k])}`);
    assert.deepEqual(cles(reference), cles(base));
  }
});
test('E6. l\'ordre est une convention de représentation : memesCouvertures n\'en dépend pas, et deux ordres d\'entrée donnent la même identité', () => {
  const base = [[2, 'a'], ['z'], [], [0], ['0'], [10]];
  assert.equal(memes(base, base.slice().reverse()), true);
  assert.deepEqual(norm(base), norm(base.slice().reverse()));
});

// ============================================================================ F. COPIE, NON-MUTATION (§5)
test('F1. l\'entrée n\'est jamais modifiée (ni son ordre, ni ses chemins) : même après sort interne', () => {
  const entree = [['z', 1], [3], ['a'], [], [1, 'b'], [0]];
  const instantane = entree.map((c) => c.slice());
  norm(entree);
  assert.deepEqual(entree, instantane);
  memes(entree, entree.slice().reverse());
  assert.deepEqual(entree, instantane);
  for (let i = 0; i < 100; i += 1) { const c = couvertureAleatoire(); const s = c.map((x) => x.slice()); norm(c); memes(c, melanger(c)); assert.deepEqual(c, s); }
});
test('F2. aucune référence de chemin n\'est partagée avec l\'entrée ; muter la sortie ou l\'entrée ensuite ne touche pas l\'autre', () => {
  const entree = [['a', 1], ['b'], []];
  const sortie = norm(entree);
  for (const c of sortie) for (const d of entree) assert.notEqual(c, d);
  sortie[0].push('POLLUTION'); sortie.pop();
  assert.deepEqual(entree, [['a', 1], ['b'], []]);
  const sortie2 = norm(entree);
  entree[0][0] = 'MUTATION'; entree.length = 0;
  assert.deepEqual(sortie2, [[], ['a', 1], ['b']]);
});
test('F3. deux appels successifs rendent deux résultats indépendants', () => {
  const entree = [['a'], ['b']];
  const x = norm(entree); const y = norm(entree);
  assert.notEqual(x, y); assert.notEqual(x[0], y[0]);
  x[0][0] = 'ZZ';
  assert.deepEqual(y, [['a'], ['b']]);
});
test('F4. entrée gelée et chemins gelés : acceptés, jamais modifiés', () => {
  const gelee = geler([[0, 'a'], ['x'], []]);
  const sortie = norm(gelee);
  assert.deepEqual(sortie, [[], [0, 'a'], ['x']]);
  assert.equal(Object.isFrozen(gelee), true); assert.equal(Object.isFrozen(gelee[0]), true);
  assert.equal(Object.isFrozen(sortie), false);
  assert.equal(memes(gelee, geler([[], ['x'], [0, 'a']])), true);
  assert.equal(memes(geler([]), geler([])), true);
});
test('F5. la sortie ne contient que des chemins : aucun champ de raison, d\'identité ou d\'univers', () => {
  const sortie = norm([['a'], [0]]);
  assert.deepEqual(Object.getOwnPropertyNames(sortie).sort(), ['0', '1', 'length']);
  assert.equal(Object.getOwnPropertySymbols(sortie).length, 0);
  for (const c of sortie) { assert.deepEqual(Object.getOwnPropertyNames(c).sort(), c.map((_, i) => String(i)).concat(['length']).sort()); assert.equal(Object.getOwnPropertySymbols(c).length, 0); }
});
test('F6. couverture volumineuse : 20000 chemins distincts, tri correct et rapide', () => {
  const grosse = []; for (let i = 0; i < 20000; i += 1) grosse.push([i % 7, 'k' + (i % 13), i]);
  const t0 = Date.now(); const sortie = norm(melanger(grosse)); const duree = Date.now() - t0;
  assert.equal(sortie.length, 20000);
  for (let k = 1; k < sortie.length; k += 1) assert.equal(avant(sortie[k - 1], sortie[k]), true);
  assert.ok(duree < 5000, `durée ${duree} ms`);
});

// ============================================================================ G. APPLICATION À parcourirStructure (§11) — TESTS SEULEMENT
const U = parcourirStructure(CORPUS_V0634);
const CHEMINS = U.map((o) => o.chemin);
test('G1. les 114 chemins de DESCRIPTIONS_OPERATIONS : acceptés, 114 rendus, sans doublon, chaque chemin typé préservé', () => {
  assert.equal(CHEMINS.length, 114);
  const sortie = norm(CHEMINS);
  assert.equal(sortie.length, 114);
  assert.equal(new Set(sortie.map(cle)).size, 114);
  assert.deepEqual(cles(sortie), cles(CHEMINS));
  for (const c of sortie) for (const s of c) assert.ok(typeof s === 'string' || (typeof s === 'number' && Number.isInteger(s) && s >= 0));
  const typesEntree = CHEMINS.map((c) => c.map((s) => typeof s).join('/')).sort();
  const typesSortie = sortie.map((c) => c.map((s) => typeof s).join('/')).sort();
  assert.deepEqual(typesSortie, typesEntree);
});
test('G2. indépendante de l\'ordre initial : 60 mélanges de U ; mêmes résultats et memesCouvertures vrai', () => {
  const reference = norm(CHEMINS);
  for (let i = 0; i < 60; i += 1) { const m = melanger(CHEMINS); assert.deepEqual(norm(m), reference); assert.equal(memes(m, CHEMINS), true); }
});
test('G3. entrée gelée (la sortie même de parcourirStructure) : non modifiée', () => {
  const copie = parcourirStructure(CORPUS_V0634).map((o) => o.chemin);
  geler(copie);
  assert.equal(norm(copie).length, 114);
});
test('G4. la racine est un chemin comme un autre ; elle précède tout', () => {
  const sortie = norm(CHEMINS);
  assert.deepEqual(sortie[0], []);
  assert.equal(memes([[]], [CHEMINS[0]]), true);
});
test('G5. quelques couvertures réelles des diagnostics (calculées ici, sans importer de générateur en production)', () => {
  const dans = (pred) => CHEMINS.filter(pred);
  const couvertures = {
    enfantsDeLaRacine: dans((c) => c.length === 1),
    chaines: U.filter((o) => o.type === 'chaine').map((o) => o.chemin),
    booleens: U.filter((o) => o.type === 'booleen').map((o) => o.chemin),
    placeUnEgaleSortie: dans((c) => c.length > 1 && c[1] === 'sortie'),
    contientForme: dans((c) => c.includes('forme')),
    arite6: dans((c) => c.length === 6),
    descendantsDe0: dans((c) => c[0] === 0),
  };
  for (const [nom, cov] of Object.entries(couvertures)) {
    const n = norm(cov);
    assert.equal(n.length, cov.length, nom);
    assert.equal(memes(cov, melanger(cov)), true, nom);
    assert.equal(memes(cov, cov.slice(1)), cov.length === 0 ? false : false, nom);
  }
  assert.equal(couvertures.enfantsDeLaRacine.length, 3);
  assert.equal(couvertures.booleens.length, 7);
  assert.equal(couvertures.contientForme.length >= 38, true);
  // groupes « enfants d'un même parent » : 53 groupes, qui, avec la racine, partitionnent U
  const parents = new Map();
  for (const c of CHEMINS) if (c.length > 0) { const k = cle(c.slice(0, -1)); (parents.get(k) || parents.set(k, []).get(k)).push(c); }
  assert.equal(parents.size, 53);
  let total = 1;
  for (const g of parents.values()) { assert.equal(norm(g).length, g.length); total += g.length; }
  assert.equal(total, 114);
  // aucune confusion entre deux groupes distincts
  const groupes = [...parents.values()];
  for (let i = 0; i < groupes.length; i += 1) for (let j = i + 1; j < groupes.length; j += 1) assert.equal(memes(groupes[i], groupes[j]), false);
});
test('G6. deux univers qui partagent un chemin : la validité ne prouve pas l\'univers (hors contrat, documenté) — chemins identiques égaux', () => {
  const A = parcourirStructure({ x: 1 }).map((o) => o.chemin); const B = parcourirStructure({ x: 's', y: [2] }).map((o) => o.chemin);
  assert.equal(memes([['x']], [['x']]), true);
  assert.equal(norm([['x']]).length, 1);
  assert.equal(A.some((c) => c[0] === 'x'), true); assert.equal(B.some((c) => c[0] === 'x'), true);
  assert.equal(/univers/.test(CODE), false);
});

// ============================================================================ H. SYNONYMES (§12) — TESTS SEULEMENT
test('H1. deux « raisons » fictives différentes qui désignent le même ensemble : memesCouvertures vrai ; la raison n\'entre jamais dans le module', () => {
  const raisonA = (c) => c[0] === 1;                                                    // « premier segment égal à 1 »
  const raisonB = (c) => c.length >= 1 && !(c[0] !== 1);                                // formulée autrement
  const raisonC = (c) => cle(c.slice(0, 1)) === cle([1]);                               // encore autrement (oracle de test)
  const covA = CHEMINS.filter(raisonA); const covB = CHEMINS.filter(raisonB); const covC = CHEMINS.filter(raisonC);
  assert.ok(covA.length > 1);
  assert.equal(memes(covA, covB), true); assert.equal(memes(covB, covC), true); assert.equal(memes(covA, melanger(covC)), true);
  assert.equal(memes(covA, CHEMINS.filter((c) => c[0] === 0)), false);
  assert.equal(norm.length, 1); assert.equal(memes.length, 2);
  assert.equal(/raison|description|famille|motif/.test(CODE), false);
});

// ============================================================================ I. STATIQUE ET DORMANCE (§15, §14)
const fichiers = (d, s = []) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) { if (n !== 'node_modules') fichiers(f, s); } else s.push(f); } return s; };
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const MODULE = 'app/langage/couverture-occurrences.js';

test('I1. le module n\'importe RIEN et n\'exporte que deux fonctions ; il ne connaît ni parcourirStructure, ni DESCRIPTIONS_OPERATIONS, ni formes, ni garantie, ni couvrirSequence, ni DVO, ni DSI', () => {
  assert.equal(/^\s*import\b/m.test(CODE), false);
  assert.equal(/\bimport\s*\(|\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function normaliserCouverture(chemins) {', 'export function memesCouvertures(a, b) {']);
  assert.equal(/parcourirStructure|parcours-structure|DESCRIPTIONS_OPERATIONS|descriptions-operations|formes-operation|garantie-forme|couvrirSequence|sequence-plages|decrireValeursObservees|valeurs-observees|decrireStructure|structure-identifiee|CAPACITES|registre/.test(CODE), false);
});
test('I2. pur : aucun accès réseau, stockage, horloge, hasard, console, global ; aucun JSON, join, localeCompare, conversion en chaîne ou clé texte', () => {
  assert.equal(/\bfetch\b|localStorage|indexedDB|process\.|Date\.now|new Date|Math\.random|console\.|setTimeout|await\b|\basync\b|globalThis|window\.|document\./.test(CODE), false);
  assert.equal(/JSON\.|\.join\s*\(|\.toString\s*\(|localeCompare|Intl\.|\bencodeURI|\bbtoa\b|\bString\s*\(|\bNumber\s*\(\s*[a-z]|\.concat\s*\(|new Map|new Set|\bhash\b/.test(CODE), false);
  assert.equal(/\.indexOf\s*\(|\.includes\s*\(|\.lastIndexOf\s*\(/.test(CODE), false, 'aucune égalité cachée par includes/indexOf');
});
test('I3. le code ne crée ni raison, ni description, ni famille, ni univers, ni id, ni hash, ni score… et ne combine rien', () => {
  assert.equal(/\b(raison|description|famille|motif|fait|score|poids|frequence|confiance|preference|priorite|univers|hash|intersection|union|difference|complement|image|parent|suffixe|generateur|selection|filtre|filter)\b/i.test(CODE), false);
  assert.equal(/\bid\b|\bidentifiant\b/i.test(CODE), false);
});
test('I4. aucun fichier de production n\'importe ni ne nomme ce module ou ses deux fonctions (hors resolution-couverture.js depuis v0.63.7, constats-structurels.js depuis v0.63.8 et partition-couvertures.js depuis v0.63.9)', () => {
  const fautifs = [];
  for (const f of fichiers(join(RACINE, 'app'))) {
    if (rel(f) === MODULE) continue;
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (rel(f) === 'app/langage/resolution-couverture.js') continue; // v0.63.7 : importeur autorisé (gardé par tests/resolution-couverture.test.mjs)
    if (rel(f) === 'app/langage/constats-structurels.js') continue; // v0.63.8 : importeur autorisé (gardé par tests/constats-structurels.test.mjs)
    if (rel(f) === 'app/langage/constats-valeurs.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.29 : + constats-valeurs.js (observateur de valeurs dormant, importe ces primitives)
    if (rel(f) === 'app/langage/partition-couvertures.js') continue; // v0.63.9 : importeur autorisé (gardé par tests/partition-couvertures.test.mjs)
    if (rel(f) === 'app/langage/relations-parent-enfant.js') continue; // v0.63.11 : importeur autorisé (gardé par tests/relations-parent-enfant.test.mjs)
    if (rel(f) === 'app/langage/table-operations.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.18 : table-operations.js rend les opérations LOCALISABLES mécaniquement (importeur statique autorisé, gardé par tests/invocation-operations.test.mjs) ; elles ne sont pas utilisées par le moteur
    if (rel(f) === 'app/langage/descriptions-operations.js') { assert.equal(/couverture-occurrences/.test(src), false, 'le catalogue ne cite jamais le chemin du module'); continue; } // v0.63.10 : NOMME les deux fonctions (nom: '…') sans importer
    if (/couverture-occurrences|normaliserCouverture|memesCouvertures/.test(src)) fautifs.push(rel(f));
  }
  assert.deepEqual(fautifs, []);
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/couverture-occurrences/.test(src), false, autre); }
});
test('I5. le module est INACCESSIBLE depuis le démarrage : parcours des imports statiques depuis app/main.js', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) pile.push(resolve(dirname(f), m[1] || m[2]));
  }
  assert.ok(vus.size > 20);
  assert.equal([...vus].some((f) => rel(f) === MODULE), false);
  assert.equal([...vus].some((f) => rel(f) === 'app/langage/parcours-structure.js'), false);
});
test('I6. rien d\'autre ne change de statut : CAPACITES inchangée, VERSION_BASE 15, SCHEMA_SAUVEGARDE 5 ; parcours-structure ne nomme pas ce module', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  assert.equal(Object.isFrozen(CAPACITES), true);
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 19); assert.equal(sauv.SCHEMA_SAUVEGARDE, 9); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  for (const f of ['parcours-structure.js', 'registre.js']) assert.equal(/couverture-occurrences|normaliserCouverture|memesCouvertures/.test(readFileSync(join(RACINE, 'app', 'langage', f), 'utf8')), false, f);
  // v0.63.10 : le catalogue nomme les deux fonctions par `nom` (une fois chacune), sans chemin de module.
  const catalogue = readFileSync(join(RACINE, 'app', 'langage', 'descriptions-operations.js'), 'utf8');
  assert.equal(/couverture-occurrences/.test(catalogue), false);
  for (const nom of ['normaliserCouverture', 'memesCouvertures']) assert.equal(catalogue.split(`nom: '${nom}'`).length - 1, 1, nom);
});
// === FIN_TEST_COUVERTURE_OCCURRENCES ===
