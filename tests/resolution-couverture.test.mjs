// === DEBUT_TEST_RESOLUTION_COUVERTURE ===
// v0.63.7 — ÉTAPE 6, décision ChatGPT « RÉSOLUTION PURE D'UNE COUVERTURE DANS UN UNIVERS » (04/10/2026). Preuves que
// app/langage/resolution-couverture.js résout une couverture existante dans son univers, sans rien découvrir, observer ni produire :
// un seul export, identité = chemin typé (via v0.63.6, sans troisième définition), doublon d'univers / de couverture / chemin absent =
// TypeError sans résultat partiel, sortie = occurrences ORIGINALES dans l'ordre canonique de la couverture, entrées jamais modifiées,
// aucune raison, aucun rebasage, inaccessibilité depuis le démarrage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/resolution-couverture.js';
import { normaliserCouverture } from '../app/langage/couverture-occurrences.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
// v0.63.10 : le catalogue compte NEUF descriptions. Les mesures de ce fichier (114 occurrences, 14/15 groupes...) portent sur le CORPUS FIGÉ des
// trois descriptions de v0.63.4 (couvrirSequence, decrireStructureIdentifiee, decrireValeursObservees) : les six autres sont écartées ici.
const CORPUS_V0634 = DESCRIPTIONS_OPERATIONS.filter((d) => ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees'].includes(d.nom));

const { resoudreCouverture: resoudre } = module;
const RACINE = join(import.meta.dirname, '..');
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'resolution-couverture.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));

// Clé d'ORACLE (tests seulement) : JSON d'un tableau de chaînes/entiers = injectif et typé. Jamais utilisée par le module.
const cle = (c) => JSON.stringify(c);
const segAvant = (a, b) => (typeof a !== typeof b ? typeof a === 'number' : a < b);
const avant = (a, b) => {
  if (a.length === 0) return b.length > 0;
  if (b.length === 0) return false;
  if (a[0] !== b[0]) return segAvant(a[0], b[0]);
  return avant(a.slice(1), b.slice(1));
};
const trierOracle = (chemins) => chemins.slice().sort((a, b) => (avant(a, b) ? -1 : avant(b, a) ? 1 : 0));
let graine = 20261005;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const entier = (n) => Math.floor(alea() * n);
const melanger = (t) => { const r = t.slice(); for (let i = r.length - 1; i > 0; i -= 1) { const j = entier(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const geler = (x) => { if (x !== null && typeof x === 'object') { for (const k of Object.keys(x)) geler(x[k]); Object.freeze(x); } return x; };
const occ = (chemin, type = 'chaine', valeur = undefined) => (valeur === undefined ? { chemin, type } : { chemin, type, valeur });
const memeSequence = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const SEGMENTS = [0, 1, 2, 10, 9, 'a', 'b', '', '0', '1', 'a/b', 'a.b', 'a,b', 'B', 'é', '\u0001'];
function cheminAleatoire() { const n = entier(5); const c = []; for (let i = 0; i < n; i += 1) c.push(SEGMENTS[entier(SEGMENTS.length)]); return c; }
function universAleatoire() { const vus = new Set(); const r = []; const n = entier(25); for (let i = 0; i < n; i += 1) { const c = cheminAleatoire(); if (!vus.has(cle(c))) { vus.add(cle(c)); r.push(occ(c, 'chaine', `v${i}`)); } } return r; }

const INVALIDES = [
  ['undefined', undefined], ['null', null], ['objet', {}], ['tableau imbriqué', ['a']], ['négatif', -1], ['non entier', 1.5],
  ['NaN', NaN], ['Infinity', Infinity], ['bigint', 10n], ['symbol', Symbol('s')], ['fonction', () => 1], ['booléen', true],
];

// ============================================================================ A. CONTRAT
test('A1. exactement un export : resoudreCouverture(univers, couverture)', () => {
  assert.deepEqual(Object.keys(module), ['resoudreCouverture']);
  assert.equal(typeof resoudre, 'function'); assert.equal(resoudre.length, 2);
});
test('A2. couverture vide (tout univers valide), racine, un membre, plusieurs membres, universelle', () => {
  assert.deepEqual(resoudre([], []), []);
  const u = [occ([]), occ([0]), occ([0, 'a']), occ(['x'])];
  assert.deepEqual(resoudre(u, []), []);
  assert.equal(resoudre(u, [[]]).length, 1); assert.equal(resoudre(u, [[]])[0], u[0]);
  assert.equal(resoudre(u, [[0, 'a']])[0], u[2]);
  const r = resoudre(u, [['x'], [0]]);
  assert.equal(r.length, 2); assert.equal(r[0], u[1]); assert.equal(r[1], u[3]);
  const tout = resoudre(u, u.map((o) => o.chemin));
  assert.equal(tout.length, 4);
  assert.deepEqual(tout.map((o) => o.chemin), [[], [0], [0, 'a'], ['x']]);
});
test('A3. la racine est une occurrence comme les autres : [[]] résout exactement le chemin []', () => {
  const u = [occ(['a']), occ([]), occ([0])];
  const r = resoudre(u, [[]]);
  assert.equal(r.length, 1); assert.equal(r[0], u[1]);
  assert.deepEqual(resoudre([occ([])], [[]]), [occ([])]);
  refuse(() => resoudre([occ(['a'])], [[]]), /absent/);
});
test('A4. la sortie est un NOUVEAU tableau plat, sans propriété additionnelle, contenant les occurrences ORIGINALES (même référence)', () => {
  const u = [occ([0], 'objet'), occ([1], 'nombre', 4)];
  const r = resoudre(u, [[0], [1]]);
  assert.notEqual(r, u); assert.equal(Array.isArray(r), true);
  assert.deepEqual(Object.keys(r), ['0', '1']);
  assert.equal(r[0], u[0]); assert.equal(r[1], u[1]);
  const r2 = resoudre(u, [[0], [1]]);
  assert.notEqual(r, r2); assert.equal(memeSequence(r, r2), true);
  r.length = 0; r2.push('x');
  assert.equal(u.length, 2); assert.equal(resoudre(u, [[0]]).length, 1);
});
test('A5. le type et la valeur ne sont NI lus NI validés : une occurrence au type absurde est rendue telle quelle', () => {
  const bizarre = { chemin: ['a'], type: 42, valeur: Symbol('s'), autre: () => 1 };
  const sans = { chemin: ['b'] };
  const u = [bizarre, sans];
  const r = resoudre(u, [['a'], ['b']]);
  assert.equal(r[0], bizarre); assert.equal(r[1], sans);
  const piege = { chemin: ['c'] };
  Object.defineProperty(piege, 'type', { get() { throw new Error('type lu'); }, enumerable: true });
  Object.defineProperty(piege, 'valeur', { get() { throw new Error('valeur lue'); }, enumerable: true });
  assert.equal(resoudre([piege], [['c']])[0], piege);
});

// ============================================================================ B. VALIDATION MINIMALE DE L'UNIVERS (§5)
test('B1. un univers qui n\'est pas un tableau est refusé', () => {
  for (const mauvais of [undefined, null, {}, 'abc', 3, () => [], new Set([occ([])])]) refuse(() => resoudre(mauvais, []), /univers/);
});
test('B2. un élément qui n\'est pas un objet est refusé (même avec une couverture vide) ; un trou aussi', () => {
  for (const mauvais of [null, undefined, 3, 'a', [], ['chemin'], true, () => 1]) {
    refuse(() => resoudre([occ(['a']), mauvais], []), /univers\[1\]/);
    refuse(() => resoudre([mauvais], [['a']]), /univers\[0\]/);
  }
  const creux = [occ(['a'])]; creux[2] = occ(['b']);
  refuse(() => resoudre(creux, []), /univers\[1\]/);
});
test('B3. le champ « chemin » doit être PROPRE à l\'élément et être une donnée (jamais un accesseur exécuté)', () => {
  refuse(() => resoudre([{}], []), /univers\[0\]/);
  refuse(() => resoudre([{ type: 'chaine' }], []), /chemin/);
  const heritier = Object.create({ chemin: ['a'] });
  refuse(() => resoudre([heritier], []), /propre/);
  let appels = 0;
  const accesseur = {}; Object.defineProperty(accesseur, 'chemin', { get() { appels += 1; return ['a']; }, enumerable: true });
  refuse(() => resoudre([accesseur], []), /accesseur/);
  assert.equal(appels, 0, 'l\'accesseur n\'est jamais exécuté');
});
test('B4. les chemins de l\'univers doivent respecter le contrat de v0.63.6 : chaque segment invalide est refusé, à toute position', () => {
  for (const [nom, mauvais] of INVALIDES) {
    refuse(() => resoudre([occ([mauvais])], []), /univers/);
    refuse(() => resoudre([occ(['a']), occ(['b', 0, mauvais])], []), /univers/);
    refuse(() => resoudre([occ(['a', mauvais, 'z'])], [['a']]), /univers/);
  }
  for (const mauvais of [undefined, null, 'a', 0, {}, 7]) refuse(() => resoudre([{ chemin: mauvais }], []), /univers/);
});
test('B5. un doublon dans l\'univers est un TypeError (direct, non adjacent, racine, long) — même avec une couverture vide', () => {
  refuse(() => resoudre([occ(['a']), occ(['a'])], []), /univers.*égaux/);
  refuse(() => resoudre([occ(['a']), occ(['b']), occ(['a'])], [['b']]), /univers.*égaux/);
  refuse(() => resoudre([occ([]), occ([])], [[]]), /univers.*égaux/);
  refuse(() => resoudre([occ([0, 'a', 'b', 2]), occ([1]), occ([0, 'a', 'b', 2])], []), /univers.*égaux/);
  refuse(() => resoudre([occ([0]), occ(['0']), occ([0])], []), /univers.*égaux/);
  const u = [occ([0]), occ(['0'])];
  assert.equal(resoudre(u, [[0]])[0], u[0]); assert.equal(resoudre(u, [['0']])[0], u[1]);
});
test('B6. l\'univers est validé AVANT la couverture ; les messages ne portent que des positions', () => {
  refuse(() => resoudre([occ(['a']), occ(['a'])], 'pas un tableau'), /univers/);
  refuse(() => resoudre([{}], [['a', undefined]]), /univers\[0\]/);
  for (const secret of ['SECRET-chemin', 'SECRET-segment']) {
    try { resoudre([occ([secret]), occ([secret])], []); assert.fail('attendu'); } catch (e) { assert.equal(e.message.includes(secret), false); }
    try { resoudre([occ(['ok'])], [[secret]]); assert.fail('attendu'); } catch (e) { assert.equal(e.message.includes(secret), false); }
  }
});

// ============================================================================ C. VALIDATION DE LA COUVERTURE (v0.63.6)
test('C1. une couverture qui n\'est pas un tableau de chemins valides est refusée', () => {
  const u = [occ(['a']), occ([0])];
  for (const mauvais of [undefined, null, {}, 'a', 3]) refuse(() => resoudre(u, mauvais), /couverture/);
  for (const mauvais of [undefined, null, 'a', 3, {}]) refuse(() => resoudre(u, [mauvais]), /couverture/);
  for (const [nom, mauvais] of INVALIDES) { refuse(() => resoudre(u, [['a', mauvais]]), /couverture/); refuse(() => resoudre(u, [[0], ['a', mauvais]]), /couverture/); }
  const creuse = [['a']]; creuse[2] = [0];
  refuse(() => resoudre(u, creuse), /couverture/);
});
test('C2. un doublon dans la couverture est un TypeError (jamais ignoré, compté ou fusionné)', () => {
  const u = [occ(['a']), occ(['b']), occ([0]), occ([])];
  refuse(() => resoudre(u, [['a'], ['a']]), /égaux/);
  refuse(() => resoudre(u, [['a'], ['b'], ['a']]), /égaux/);
  refuse(() => resoudre(u, [[], []]), /égaux/);
  refuse(() => resoudre(u, [[0], ['a'], [0]]), /égaux/);
  assert.equal(resoudre(u, [[0], ['b']]).length, 2);
});

// ============================================================================ D. CHEMIN ABSENT (§7)
test('D1. un chemin valide de la couverture absent de l\'univers est un TypeError : aucun résultat, ni partiel, ni liste d\'absents', () => {
  const u = [occ(['a']), occ(['b']), occ([0])];
  refuse(() => resoudre(u, [['a'], ['zzz']]), /absent/);
  refuse(() => resoudre(u, [['zzz']]), /absent/);
  refuse(() => resoudre(u, [['a'], ['b'], [0], ['c']]), /absent/);
  refuse(() => resoudre(u, [[]]), /absent/);
  refuse(() => resoudre([], [['a']]), /absent/);
  refuse(() => resoudre(u, [['a', 'b']]), /absent/);
  refuse(() => resoudre(u, [[0, 'a']]), /absent/);
  let sortie; try { sortie = resoudre(u, [['a'], ['zzz']]); } catch { sortie = 'erreur'; }
  assert.equal(sortie, 'erreur');
});
test('D2. 0 absent quand seul "0" existe (et inversement) ; préfixe et prolongement ne sont pas le chemin', () => {
  refuse(() => resoudre([occ(['0'])], [[0]]), /absent/);
  refuse(() => resoudre([occ([0])], [['0']]), /absent/);
  refuse(() => resoudre([occ([''])], [[]]), /absent/);
  refuse(() => resoudre([occ([])], [['']]), /absent/);
  refuse(() => resoudre([occ(['a', 'b'])], [['a']]), /absent/);
  refuse(() => resoudre([occ(['a'])], [['a', 'b']]), /absent/);
});
test('D3. le message désigne un rang canonique, jamais la valeur du chemin demandé', () => {
  const u = [occ(['a']), occ(['b'])];
  try { resoudre(u, [['b'], ['zSECRET'], ['a']]); assert.fail('attendu'); } catch (e) {
    assert.equal(e instanceof TypeError, true); assert.equal(e.message.includes('SECRET'), false);
    assert.match(e.message, /rang canonique 2/, 'a < b < zSECRET dans l\'ordre canonique');
  }
});

// ============================================================================ E. IDENTITÉ TYPÉE (§3, §13)
test('E1. [0] et ["0"] dans le même univers restent deux occurrences distinctes', () => {
  const nombre = occ([0], 'nombre', 1); const chaine = occ(['0'], 'chaine', 'x');
  const u = [chaine, nombre];
  assert.equal(resoudre(u, [[0]])[0], nombre); assert.equal(resoudre(u, [['0']])[0], chaine);
  const deux = resoudre(u, [['0'], [0]]);
  assert.equal(deux.length, 2); assert.equal(deux[0], nombre); assert.equal(deux[1], chaine);
});
test('E2. [], [""], ["a/b"], ["a","b"], ["a,b"], ["a","b"], ["a.b"], "\\u0001", "|" : aucune collision', () => {
  const chemins = [[], [''], ['a/b'], ['a', 'b'], ['a,b'], ['a.b'], ['a\u0001b'], ['a|b'], ['ab'], ['a', ''], ['', 'a'], [0, 0], ['0', '0'], [0, '0'], ['0', 0], ['00'], [0], ['0']];
  const u = chemins.map((c, i) => occ(c, 'nombre', i));
  for (let i = 0; i < chemins.length; i += 1) {
    const r = resoudre(u, [chemins[i]]);
    assert.equal(r.length, 1); assert.equal(r[0], u[i], cle(chemins[i]));
  }
  const tous = resoudre(melanger(u), melanger(chemins));
  assert.equal(tous.length, chemins.length);
  assert.deepEqual(tous.map((o) => cle(o.chemin)).sort(), chemins.map(cle).sort());
  // un univers qui ne contient QUE l'une des deux écritures refuse l'autre
  refuse(() => resoudre([occ(['a/b'])], [['a', 'b']]), /absent/);
  refuse(() => resoudre([occ(['a,b'])], [['a', 'b']]), /absent/);
  refuse(() => resoudre([occ(['a', 'b'])], [['a/b']]), /absent/);
  refuse(() => resoudre([occ([''])], [[]]), /absent/);
});

// ============================================================================ F. ORDRE DE SORTIE (§8)
test('F1. la sortie suit l\'ordre canonique de la couverture : ni l\'ordre brut de la couverture, ni l\'ordre de l\'univers', () => {
  const u = [occ(['z']), occ(['a']), occ([1]), occ([0]), occ([]), occ([0, 'a'])];
  const brut = [['z'], [0, 'a'], [1], ['a'], [0]];
  const r = resoudre(u, brut);
  assert.deepEqual(r.map((o) => o.chemin), [[0], [0, 'a'], [1], ['a'], ['z']]);
  assert.equal(memeSequence(r.map((o) => o.chemin), brut), false, 'pas l\'ordre brut');
  assert.equal(memeSequence(r, u.filter((o) => brut.some((c) => cle(c) === cle(o.chemin)))), false, 'pas l\'ordre de l\'univers');
});
test('F2. deux représentations de la même couverture donnent la même séquence de membres (200 mélanges de U et de C)', () => {
  for (let t = 0; t < 200; t += 1) {
    const u = universAleatoire(); if (!u.length) continue;
    const c = melanger(u.filter(() => alea() < 0.5).map((o) => o.chemin));
    const ref = resoudre(u, c);
    const attendu = trierOracle(c).map((p) => u.find((o) => cle(o.chemin) === cle(p)));
    assert.equal(memeSequence(ref, attendu), true);
    for (let k = 0; k < 4; k += 1) assert.equal(memeSequence(resoudre(melanger(u), melanger(c)), ref), true);
  }
});
test('F3. préfixes et types mélangés : nombres avant chaînes, préfixe avant prolongement', () => {
  const u = [occ(['a']), occ([0, 'a']), occ([]), occ(['0']), occ([0]), occ([10]), occ([9]), occ(['B'])];
  const r = resoudre(u, u.map((o) => o.chemin));
  assert.deepEqual(r.map((o) => o.chemin), [[], [0], [0, 'a'], [9], [10], ['0'], ['B'], ['a']]);
});

// ============================================================================ G. ENTRÉES JAMAIS MODIFIÉES (§14)
test('G1. univers gelé, couverture gelée, chemins gelés : acceptés, rien n\'est modifié', () => {
  const u = geler([occ([], 'objet'), occ([0], 'nombre', 1), occ([0, 'a'], 'chaine', 'x'), occ(['b'], 'booleen', true)]);
  const c = geler([[0, 'a'], [], ['b']]);
  const avantU = cle(u); const avantC = cle(c);
  const r = resoudre(u, c);
  assert.equal(r.length, 3); assert.equal(cle(u), avantU); assert.equal(cle(c), avantC);
  for (const x of r) assert.equal(u.includes(x), true);
});
test('G2. entrées non gelées : jamais mutées (ordre, contenu, longueur, identités, chemins) — y compris sur erreur', () => {
  const u = [occ(['z']), occ(['a']), occ([1]), occ([0])];
  const c = [['z'], [1], ['a']];
  const refU = u.slice(); const refC = c.map((p) => p.slice()); const copieU = cle(u);
  resoudre(u, c);
  assert.equal(memeSequence(u, refU), true); assert.deepEqual(c, refC); assert.equal(cle(u), copieU);
  try { resoudre(u, [...c, ['absent']]); } catch { /* attendu */ }
  assert.equal(memeSequence(u, refU), true); assert.deepEqual(c, refC);
  try { resoudre([...u, occ(['z'])], c); } catch { /* attendu */ }
  assert.equal(memeSequence(u, refU), true);
});
test('G3. aucun état entre appels : deux appels identiques donnent les mêmes références', () => {
  const u = [occ(['a']), occ(['b'])];
  const a = resoudre(u, [['b'], ['a']]); resoudre(u, [['a']]);
  try { resoudre(u, [['x']]); } catch { /* attendu */ }
  const b = resoudre(u, [['a'], ['b']]);
  assert.equal(memeSequence(a, b), true);
});

// ============================================================================ H. LES 114 OCCURRENCES (§15)
const U114 = parcourirStructure(CORPUS_V0634);
const estConteneur = (o) => o.type === 'objet' || o.type === 'tableau';
const cheminsDe = (pred) => U114.filter(pred).map((o) => o.chemin);
const moyenne = U114.filter((o, i) => i % 2 === 0).map((o) => o.chemin);
const grande = U114.filter((o, i) => i % 7 !== 0).map((o) => o.chemin);
const CAS = {
  vide: [], racine: [[]],
  feuilles: cheminsDe((o) => !estConteneur(o)).slice(0, 4),
  conteneurs: cheminsDe(estConteneur).slice(0, 4),
  booleens: cheminsDe((o) => o.type === 'booleen'),
  moyenne, grande, universelle: U114.map((o) => o.chemin),
};
test('H1. U = 114 occurrences : nombre exact, chaque membre correspond au chemin demandé, aucune perte, aucune addition', () => {
  assert.equal(U114.length, 114);
  for (const [nom, c] of Object.entries(CAS)) {
    const r = resoudre(U114, c);
    assert.equal(r.length, c.length, nom);
    const attendu = trierOracle(c);
    assert.deepEqual(r.map((o) => o.chemin), attendu, nom);
    for (const m of r) assert.equal(U114.includes(m), true, nom + ' : membre de U (même référence)');
    assert.equal(new Set(r).size, r.length, nom + ' : aucun membre répété');
    const demandes = new Set(c.map(cle));
    for (const m of r) assert.equal(demandes.has(cle(m.chemin)), true, nom + ' : aucune addition');
    for (const p of c) assert.equal(r.some((m) => cle(m.chemin) === cle(p)), true, nom + ' : aucune perte');
  }
  assert.equal(CAS.booleens.length, 7); assert.equal(CAS.universelle.length, 114);
  assert.equal(resoudre(U114, CAS.universelle).length, 114);
});
test('H2. indépendance de l\'ordre initial de C et de l\'ordre de U (50 mélanges par couverture)', () => {
  for (const [nom, c] of Object.entries(CAS)) {
    const ref = resoudre(U114, c);
    for (let k = 0; k < 50; k += 1) assert.equal(memeSequence(resoudre(melanger(U114), melanger(c)), ref), true, nom);
  }
});
test('H3. l\'univers universel rend exactement les 114 occurrences de U dans l\'ordre canonique ; la racine vient en premier', () => {
  const r = resoudre(U114, CAS.universelle);
  assert.deepEqual(r.map((o) => o.chemin), normaliserCouverture(CAS.universelle));
  assert.deepEqual(r[0].chemin, []);
  assert.equal(new Set(r).size, 114);
});
test('H4. sur le vrai univers, un chemin absent est refusé (rien de partiel)', () => {
  refuse(() => resoudre(U114, [...CAS.booleens, ['absent']]), /absent/);
  refuse(() => resoudre(U114, [...CAS.feuilles, [0, 'inexistant']]), /absent/);
  refuse(() => resoudre(U114.slice(1), [[]]), /absent/);
});

// ============================================================================ I. SOUS-UNIVERS SANS REBASAGE (§16)
test('I1. D ⊆ C avec les chemins ORIGINAUX : resoudre(U,D) = sélection de D parmi les membres de C (mêmes références, même ordre)', () => {
  for (const [nom, c] of Object.entries(CAS)) {
    const membres = resoudre(U114, c);
    for (let k = 0; k < 20; k += 1) {
      const d = melanger(c.filter(() => alea() < 0.5));
      const dirigee = resoudre(U114, d);
      const ensemble = new Set(d.map(cle));
      const selection = membres.filter((m) => ensemble.has(cle(m.chemin)));
      assert.equal(memeSequence(dirigee, selection), true, nom);
      assert.equal(memeSequence(resoudre(membres, d), dirigee), true, nom + ' : les membres de C sont eux-mêmes un univers valide');
    }
  }
});
test('I2. les chemins de la sous-couverture ne sont jamais rebasés : un chemin hors de C mais dans U est absent du sous-univers', () => {
  const c = CAS.booleens; const membres = resoudre(U114, c);
  const horsC = U114.find((o) => !c.some((p) => cle(p) === cle(o.chemin)));
  refuse(() => resoudre(membres, [horsC.chemin]), /absent/);
  assert.equal(resoudre(U114, [horsC.chemin])[0], horsC);
  refuse(() => resoudre(membres, [[0]]), /absent/, 'l\'indice dans le sous-univers n\'est pas un chemin');
  assert.deepEqual(resoudre(membres, []), []);
});

// ============================================================================ J. FUZZ SUR OBJETS TYPÉS
test('J1. 400 univers/couvertures aléatoires : la sortie égale l\'oracle (recherche par clé JSON, tri récursif)', () => {
  for (let t = 0; t < 400; t += 1) {
    const u = universAleatoire(); const idx = new Map(u.map((o) => [cle(o.chemin), o]));
    const c = melanger(u.filter(() => alea() < 0.4).map((o) => o.chemin));
    const attendu = trierOracle(c).map((p) => idx.get(cle(p)));
    assert.equal(memeSequence(resoudre(melanger(u), c), attendu), true);
    if (u.length) {
      const intrus = cheminAleatoire();
      if (!idx.has(cle(intrus)) && !c.some((p) => cle(p) === cle(intrus))) refuse(() => resoudre(u, [...c, intrus]), /absent/);
    }
  }
});
test('J2. univers de 300 occurrences, couverture de 300 chemins : résout dans un temps raisonnable', () => {
  const u = []; for (let i = 0; i < 300; i += 1) u.push(occ(['k', i, i % 2 ? 'a' : 'b'], 'nombre', i));
  const t0 = Date.now(); const r = resoudre(u, melanger(u.map((o) => o.chemin))); const dt = Date.now() - t0;
  assert.equal(r.length, 300); assert.ok(dt < 5000, `${dt} ms`);
});

// ============================================================================ K. RAISON
test('K1. deux raisons fictives synonymes (même couverture) donnent exactement le même résultat ; le module ne reçoit aucune raison', () => {
  const raisonA = (u) => u.filter((o) => o.type === 'booleen').map((o) => o.chemin);
  const raisonB = (u) => u.filter((o) => o.chemin.at(-1) === 'peutEtreNull' || o.type === 'booleen').map((o) => o.chemin);
  const cA = raisonA(U114); const cB = raisonB(U114);
  assert.equal(cA.length, 7);
  assert.deepEqual(trierOracle(cA), trierOracle(cB));
  assert.equal(memeSequence(resoudre(U114, cA), resoudre(U114, cB)), true);
  assert.equal(resoudre.length, 2);
  const sortie = resoudre(U114, cA);
  assert.equal(sortie.every((o) => Object.keys(o).every((k) => ['chemin', 'type', 'valeur'].includes(k))), true, 'aucune propriété ajoutée aux occurrences');
});

// ============================================================================ L. STATIQUE ET DORMANCE
const fichiers = (d, s = []) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) { if (n !== 'node_modules') fichiers(f, s); } else s.push(f); } return s; };
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const MODULE = 'app/langage/resolution-couverture.js';
test('L1. le module n\'importe QUE normaliserCouverture et memesCouvertures de couverture-occurrences.js, et n\'exporte qu\'une fonction', () => {
  assert.deepEqual(CODE.match(/^\s*import\b.*$/gm), ['import { normaliserCouverture, memesCouvertures } from \'./couverture-occurrences.js\';']);
  assert.equal(/\bimport\s*\(|\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function resoudreCouverture(univers, couverture) {']);
  assert.equal(/parcourirStructure|parcours-structure|DESCRIPTIONS_OPERATIONS|descriptions-operations|formes-operation|garantie-forme|couvrirSequence|sequence-plages|valeurs-observees|structure-identifiee|CAPACITES|registre/.test(CODE + SOURCE), false);
});
test('L2. pur : aucun accès réseau, stockage, horloge, hasard, console, global ; aucun JSON, join, conversion en chaîne, clé texte, Map/Set, indexOf/includes, tri', () => {
  assert.equal(/\bfetch\b|localStorage|indexedDB|process\.|Date\.now|new Date|Math\.random|console\.|setTimeout|await\b|\basync\b|globalThis|window\.|document\./.test(CODE), false);
  assert.equal(/JSON\.|\.join\s*\(|\.toString\s*\(|localeCompare|Intl\.|\bencodeURI|\bbtoa\b|\bString\s*\(|\bNumber\s*\(\s*[a-z]|\.concat\s*\(|new Map|new Set|\bhash\b/.test(CODE), false);
  assert.equal(/\.indexOf\s*\(|\.includes\s*\(|\.lastIndexOf\s*\(|\.find\s*\(|\.findIndex\s*\(|\.some\s*\(|\.sort\s*\(|\.reverse\s*\(|\.splice\s*\(|\.slice\s*\(/.test(CODE), false, 'ni égalité cachée, ni ordre propre, ni copie');
  assert.equal(/===\s*chemin|chemin\w*\[\w+\]\s*[!=]==|\.length\s*[!=]==\s*\w+\.length/.test(CODE), false, 'aucune égalité de chemins redéfinie');
});
test('L3. le code ne crée ni raison, ni fait, ni famille, ni score, ni intersection/union, ni id, ni rebasage, ni observation', () => {
  assert.equal(/\b(raison|description|famille|motif|fait|score|poids|frequence|confiance|preference|priorite|hash|intersection|union|difference|complement|image|parent|suffixe|generateur|selection|observation|recursion|rebas\w*|filtre|filter|provenance)\b/i.test(CODE), false);
  assert.equal(/\bid\b|\bidentifiant\b/i.test(CODE), false);
  assert.equal(/\.type\b|\.valeur\b|\btype\s*:|\bvaleur\s*:/.test(CODE), false, 'le type et la valeur ne sont jamais lus');
});
test('L4. aucun fichier de production n\'importe ni ne nomme ce module (hors constats-structurels.js, v0.63.8) ; seuls lui et ce consommateur nomment couverture-occurrences', () => {
  const fautifs = []; const importeurs = [];
  for (const f of fichiers(join(RACINE, 'app'))) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (rel(f) !== MODULE && rel(f) !== 'app/langage/constats-structurels.js' && rel(f) !== 'app/langage/constats-valeurs.js' && rel(f) !== 'app/langage/descriptions-operations.js' && rel(f) !== 'app/langage/table-operations.js' && /resolution-couverture|resoudreCouverture/.test(src)) fautifs.push(rel(f)); // v0.63.8 : constats-structurels.js, seul consommateur autorisé ; v0.63.10 : le catalogue nomme (nom: '…'), vérifié en L6
    if (/couverture-occurrences|normaliserCouverture|memesCouvertures/.test(src) && rel(f) !== 'app/langage/descriptions-operations.js') importeurs.push(rel(f)); // v0.63.10 : le catalogue ne CITE aucun module (vérifié ailleurs)
  }
  assert.deepEqual(fautifs, []);
  assert.deepEqual(importeurs.sort(), ['app/langage/constats-structurels.js', 'app/langage/constats-valeurs.js', 'app/langage/couverture-occurrences.js', 'app/langage/partition-couvertures.js', 'app/langage/relations-parent-enfant.js', MODULE, 'app/langage/table-operations.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.29 : + constats-valeurs.js (observateur de valeurs dormant, importe ces primitives) // v0.63.9 : + partition-couvertures.js ; v0.63.11 : + relations-parent-enfant.js
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/resolution-couverture|couverture-occurrences/.test(src), false, autre); }
});
test('L5. le module est INACCESSIBLE depuis le démarrage : parcours des imports statiques depuis app/main.js', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) pile.push(resolve(dirname(f), m[1] || m[2]));
  }
  assert.ok(vus.size > 20);
  for (const dormant of [MODULE, 'app/langage/couverture-occurrences.js', 'app/langage/parcours-structure.js']) assert.equal([...vus].some((f) => rel(f) === dormant), false, dormant);
});
test('L6. rien d\'autre ne change de statut : CAPACITES inchangée, VERSION_BASE 15, SCHEMA_SAUVEGARDE 5 ; les API de v0.63.6 ne sont pas élargies', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  assert.equal(Object.isFrozen(CAPACITES), true);
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 19); assert.equal(sauv.SCHEMA_SAUVEGARDE, 9); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  const couv = await import('../app/langage/couverture-occurrences.js');
  assert.deepEqual(Object.keys(couv).sort(), ['memesCouvertures', 'normaliserCouverture']);
  for (const f of ['parcours-structure.js', 'registre.js']) assert.equal(/resolution-couverture|resoudreCouverture/.test(readFileSync(join(RACINE, 'app', 'langage', f), 'utf8')), false, f);
  // v0.63.10 : le catalogue nomme la primitive par `nom` (une fois), jamais par un chemin de module.
  const catalogue = readFileSync(join(RACINE, 'app', 'langage', 'descriptions-operations.js'), 'utf8');
  assert.equal(/resolution-couverture/.test(catalogue), false);
  assert.equal(catalogue.split('nom: \'resoudreCouverture\'').length - 1, 1);
});
// === FIN_TEST_RESOLUTION_COUVERTURE ===
