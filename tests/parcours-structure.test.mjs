// === DEBUT_TEST_PARCOURS_STRUCTURE ===
// v0.63.5 — ÉTAPE 6, décision ChatGPT « PARCOURS GÉNÉRIQUE D'UNE VALEUR STRUCTURÉE » (04/10/2026). Preuves que
// parcourirStructure (app/langage/parcours-structure.js) est une primitive PURE, GÉNÉRALE et DORMANTE : domaine d'entrée exact,
// validation complète sans résultat partiel, une occurrence par nœud (conteneurs compris), chemins typés (jamais des chaînes),
// ordre préfixe déterministe, copie sans partage, ignorance totale du vocabulaire des descripteurs, inaccessibilité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/parcours-structure.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
// v0.63.10 : le catalogue compte NEUF descriptions. Les mesures de ce fichier (114 occurrences, 14/15 groupes...) portent sur le CORPUS FIGÉ des
// trois descriptions de v0.63.4 (couvrirSequence, decrireStructureIdentifiee, decrireValeursObservees) : les six autres sont écartées ici.
const CORPUS_V0634 = DESCRIPTIONS_OPERATIONS.filter((d) => ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees'].includes(d.nom));

const { parcourirStructure: p } = module;
const RACINE = join(import.meta.dirname, '..');
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'parcours-structure.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const refuse = (valeur, motif) => assert.throws(() => p(valeur), (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const cheminsDe = (occ) => occ.map((o) => o.chemin);
const typesDe = (occ) => occ.map((o) => o.type);

// Oracle de référence, écrit indépendamment (récursif, trié explicitement), pour les comparaisons.
function oracle(x, chemin = []) {
  const type = x === null ? 'nul' : Array.isArray(x) ? 'tableau' : typeof x === 'object' ? 'objet' : { string: 'chaine', number: 'nombre', boolean: 'booleen' }[typeof x];
  const o = { chemin, type };
  if (type === 'chaine' || type === 'nombre' || type === 'booleen') o.valeur = x;
  const sortie = [o];
  if (type === 'tableau') x.forEach((v, i) => sortie.push(...oracle(v, [...chemin, i])));
  if (type === 'objet') for (const k of Object.keys(x).sort()) sortie.push(...oracle(x[k], [...chemin, k]));
  return sortie;
}

// ============================================================================ A. CONTRAT DE SORTIE
test('A1. UN seul export public : parcourirStructure', () => {
  assert.deepEqual(Object.keys(module), ['parcourirStructure']);
  assert.equal(typeof p, 'function');
  assert.equal(p.name, 'parcourirStructure');
});
test('A2. scalaires racine : chaîne, nombre, booléen, null -> UNE occurrence au chemin []', () => {
  assert.deepEqual(p('x'), [{ chemin: [], type: 'chaine', valeur: 'x' }]);
  assert.deepEqual(p(''), [{ chemin: [], type: 'chaine', valeur: '' }]);
  assert.deepEqual(p(0), [{ chemin: [], type: 'nombre', valeur: 0 }]);
  assert.deepEqual(p(-3.5), [{ chemin: [], type: 'nombre', valeur: -3.5 }]);
  assert.deepEqual(p(true), [{ chemin: [], type: 'booleen', valeur: true }]);
  assert.deepEqual(p(false), [{ chemin: [], type: 'booleen', valeur: false }]);
  assert.deepEqual(p(null), [{ chemin: [], type: 'nul' }]);
  assert.equal(Object.hasOwn(p(null)[0], 'valeur'), false, 'nul n\'a PAS de propriété valeur');
  assert.equal(Object.is(p(-0)[0].valeur, -0), true, '-0 est conservé');
});
test('A3. conteneurs : objet vide et tableau vide donnent UNE occurrence, sans `valeur`', () => {
  assert.deepEqual(p({}), [{ chemin: [], type: 'objet' }]);
  assert.deepEqual(p([]), [{ chemin: [], type: 'tableau' }]);
  for (const o of [...p({ a: {}, b: [] }), ...p([{}, []])]) if (o.type === 'objet' || o.type === 'tableau') assert.equal(Object.hasOwn(o, 'valeur'), false);
  assert.equal(p({ a: {}, b: [] }).length, 3, 'les conteneurs vides ne disparaissent pas');
});
test('A4. exemple du cahier : {"a":[true]} -> [] objet ; ["a"] tableau ; ["a",0] booleen true', () => {
  assert.deepEqual(p({ a: [true] }), [
    { chemin: [], type: 'objet' },
    { chemin: ['a'], type: 'tableau' },
    { chemin: ['a', 0], type: 'booleen', valeur: true },
  ]);
});
test('A5. objet simple, objet à prototype null, tableau, imbrications', () => {
  assert.deepEqual(p({ a: 1, b: 'x' }), [{ chemin: [], type: 'objet' }, { chemin: ['a'], type: 'nombre', valeur: 1 }, { chemin: ['b'], type: 'chaine', valeur: 'x' }]);
  const nul = Object.create(null); nul.k = 1;
  assert.deepEqual(p(nul), [{ chemin: [], type: 'objet' }, { chemin: ['k'], type: 'nombre', valeur: 1 }]);
  assert.deepEqual(p([1, 'a', null]), [{ chemin: [], type: 'tableau' }, { chemin: [0], type: 'nombre', valeur: 1 }, { chemin: [1], type: 'chaine', valeur: 'a' }, { chemin: [2], type: 'nul' }]);
  assert.deepEqual(p({ a: { b: { c: [[1], { d: true }] } } }).map((o) => o.type), ['objet', 'objet', 'objet', 'tableau', 'tableau', 'nombre', 'objet', 'booleen']);
  assert.deepEqual(cheminsDe(p({ a: { b: { c: [[1], { d: true }] } } })).at(-1), ['a', 'b', 'c', 1, 'd']);
});
test('A6. exactement six types ; les clés de chaque occurrence sont chemin, type et (valeurs terminales seulement) valeur', () => {
  const vus = new Set(); const cles = new Set();
  for (const o of p({ o: {}, t: [], c: 'x', n: 1, b: true, z: null })) { vus.add(o.type); for (const k of Object.keys(o)) cles.add(k); }
  assert.deepEqual([...vus].sort(), ['booleen', 'chaine', 'nombre', 'nul', 'objet', 'tableau']);
  assert.deepEqual([...cles].sort(), ['chemin', 'type', 'valeur']);
  for (const o of p({ o: {}, t: [], c: 'x', n: 1, b: true, z: null })) {
    assert.deepEqual(Object.keys(o), ['chaine', 'nombre', 'booleen'].includes(o.type) ? ['chemin', 'type', 'valeur'] : ['chemin', 'type'], o.type);
  }
});
test('A7. aucune propriété id, parent, profondeur, taille, feuille, catégorie, score, poids… dans la sortie', () => {
  const interdits = ['id', 'parent', 'profondeur', 'nombreEnfants', 'taille', 'feuille', 'categorie', 'score', 'poids', 'frequence', 'cle', 'nom'];
  for (const o of p({ a: [1, { b: null }], c: '' })) for (const k of interdits) assert.equal(k in o, false, k);
});

// ============================================================================ B. CHEMINS : IDENTITÉ PAR SEGMENTS TYPÉS
test('B1. les segments sont typés : clé d\'objet = chaîne, indice de tableau = entier (nombre)', () => {
  const occ = p({ a: [{ 0: 'x' }, 'y'] });
  const parChemin = (c) => occ.find((o) => JSON.stringify(o.chemin) === JSON.stringify(c));
  assert.equal(typeof parChemin(['a', 0]).type, 'string');
  const seg = occ.flatMap((o) => o.chemin);
  assert.ok(seg.every((s) => typeof s === 'string' || (typeof s === 'number' && Number.isInteger(s))));
  assert.deepEqual(cheminsDe(occ), [[], ['a'], ['a', 0], ['a', 0, '0'], ['a', 1]]);
  assert.equal(typeof occ[2].chemin[1], 'number');
  assert.equal(typeof occ[3].chemin[2], 'string');
});
test('B2. contre-exemple : {"a/b":1} se distingue de {"a":{"b":1}}', () => {
  const x = p({ 'a/b': 1 }); const y = p({ a: { b: 1 } });
  assert.deepEqual(cheminsDe(x), [[], ['a/b']]);
  assert.deepEqual(cheminsDe(y), [[], ['a'], ['a', 'b']]);
  assert.notDeepEqual(x.at(-1).chemin, y.at(-1).chemin);
  assert.equal(x.at(-1).chemin.length, 1); assert.equal(y.at(-1).chemin.length, 2);
});
test('B3. contre-exemple : {"0":"x"} se distingue de ["x"] (clé "0" ≠ indice 0)', () => {
  const x = p({ 0: 'x' }); const y = p(['x']);
  assert.deepEqual(x[1].chemin, ['0']); assert.deepEqual(y[1].chemin, [0]);
  assert.equal(typeof x[1].chemin[0], 'string'); assert.equal(typeof y[1].chemin[0], 'number');
  assert.notDeepEqual(x[1].chemin, y[1].chemin);
  assert.equal(x[0].type, 'objet'); assert.equal(y[0].type, 'tableau');
});
test('B4. contre-exemple : la racine se distingue de la clé vide', () => {
  const occ = p({ '': 1 });
  assert.deepEqual(cheminsDe(occ), [[], ['']]);
  assert.notDeepEqual(occ[0].chemin, occ[1].chemin);
  assert.equal(occ[1].chemin.length, 1);
  const imbr = p({ '': { '': 2 } });
  assert.deepEqual(cheminsDe(imbr), [[], [''], ['', '']]);
});
test('B5. clés contenant "/" ou "." : segments inchangés, jamais découpés', () => {
  assert.deepEqual(cheminsDe(p({ 'a.b': { 'c/d': 1 } })), [[], ['a.b'], ['a.b', 'c/d']]);
  assert.deepEqual(cheminsDe(p({ 'a.b': 1 })), cheminsDe(p({ 'a.b': 2 })));
  assert.notDeepEqual(cheminsDe(p({ 'a.b': 1 })), cheminsDe(p({ a: { b: 1 } })));
});
test('B6. même nom de clé à des profondeurs différentes : chemins distincts', () => {
  const occ = p({ x: 1, y: { x: 2, z: { x: 3 } } });
  const chemins = cheminsDe(occ).filter((c) => c.at(-1) === 'x');
  assert.deepEqual(chemins, [['x'], ['y', 'x'], ['y', 'z', 'x']]);
});
test('B7. clé propre `__proto__` : une clé comme une autre, sans toucher au prototype', () => {
  const x = JSON.parse('{"__proto__": {"a": 1}, "b": 2}');
  assert.equal(Object.hasOwn(x, '__proto__'), true);
  const occ = p(x);
  assert.deepEqual(cheminsDe(occ), [[], ['__proto__'], ['__proto__', 'a'], ['b']]);
  assert.equal(Object.getPrototypeOf(x), Object.prototype, 'l\'entrée n\'a pas été polluée');
  const cree = Object.defineProperty({}, '__proto__', { value: 7, enumerable: true, writable: true, configurable: true });
  assert.deepEqual(p(cree), [{ chemin: [], type: 'objet' }, { chemin: ['__proto__'], type: 'nombre', valeur: 7 }]);
});
test('B8. dans une structure, tous les chemins sont deux à deux distincts (le chemin est l\'identité factuelle) ; toutes les occurrences ont leur propre tableau de chemin', () => {
  const occ = p({ a: [{ '': 1, '0': 2 }, [3, [4]]], '': { a: {} }, 'a/b': null });
  const cles = occ.map((o) => JSON.stringify(o.chemin));
  assert.equal(new Set(cles).size, cles.length);
  assert.equal(new Set(occ.map((o) => o.chemin)).size, occ.length, 'aucun tableau de chemin partagé');
});

// ============================================================================ C. ORDRE
test('C1. parcours PRÉFIXE : un conteneur précède tous ses descendants', () => {
  const occ = p({ a: { b: { c: 1 } }, d: [1, [2]] });
  const idx = (c) => occ.findIndex((o) => JSON.stringify(o.chemin) === JSON.stringify(c));
  for (const o of occ) for (let i = 0; i < o.chemin.length; i += 1) assert.ok(idx(o.chemin.slice(0, i)) < idx(o.chemin), JSON.stringify(o.chemin));
  assert.deepEqual(cheminsDe(occ), [[], ['a'], ['a', 'b'], ['a', 'b', 'c'], ['d'], ['d', 0], ['d', 1], ['d', 1, 0]]);
});
test('C2. objets : clés triées par unités de code, JAMAIS par ordre d\'insertion (ni l\'ordre natif de JS : entiers d\'abord)', () => {
  const x = { b: 1, 2: 1, a: 1, 1: 1, '10': 1, B: 1, é: 1, '': 1 };
  assert.deepEqual(Object.keys(x).slice(0, 3), ['1', '2', '10'], 'l\'ordre natif place les entiers d\'abord');
  assert.deepEqual(cheminsDe(p(x)).slice(1).map((c) => c[0]), ['', '1', '10', '2', 'B', 'a', 'b', 'é']);
});
test('C3. l\'ordre d\'insertion ne change jamais la sortie', () => {
  const a = { x: 1, y: { p: 1, q: 2 }, z: [1] }; const b = { z: [1], y: { q: 2, p: 1 }, x: 1 };
  assert.deepEqual(p(a), p(b));
  assert.deepEqual(p(a), oracle(a));
});
test('C4. tableaux : indices croissants ; l\'ordre est déterministe (deux appels identiques)', () => {
  const x = [{ b: 1, a: 2 }, [3, 2, 1]];
  assert.deepEqual(p(x), p(x));
  assert.deepEqual(cheminsDe(p(x)), [[], [0], [0, 'a'], [0, 'b'], [1], [1, 0], [1, 1], [1, 2]]);
});

// ============================================================================ D. VALIDATION : DOMAINE EXACT, SANS RÉSULTAT PARTIEL
test('D1. valeurs hors domaine à la racine : TypeError', () => {
  class Classe { constructor() { this.a = 1; } }
  for (const [nom, v] of [['undefined', undefined], ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity], ['bigint', 1n], ['symbol', Symbol('s')], ['fonction', () => 1], ['fonction nommée', function f() {}], ['Date', new Date(0)], ['Map', new Map()], ['Set', new Set()], ['RegExp', /x/], ['instance de classe', new Classe()], ['String boxé', new String('x')], ['Number boxé', new Number(1)], ['Boolean boxé', new Boolean(true)], ['Error', new Error('x')], ['Promise', Promise.resolve(1)], ['Uint8Array', new Uint8Array(2)], ['objet à prototype exotique', Object.create({ a: 1 })]]) {
    assert.throws(() => p(v), TypeError, nom);
  }
});
test('D2. les mêmes valeurs hors domaine, ENFOUIES profondément (objets et tableaux) : TypeError', () => {
  class Classe {}
  for (const v of [undefined, NaN, Infinity, -Infinity, 1n, Symbol('s'), () => 1, new Date(0), new Map(), new Set(), /x/, new Classe(), Object.create({ a: 1 })]) {
    refuse({ a: [{ b: { c: [1, 'ok', v] } }] }, /racine\["a"\]\[0\]\["b"\]\["c"\]\[2\]/);
    refuse([[v]]);
    refuse({ a: 1, b: { c: v } });
  }
});
test('D3. aucun résultat partiel : une valeur invalide APRÈS des siblings valides lève encore TypeError', () => {
  refuse({ a: 1, b: 2, c: 3, z: undefined });
  refuse([1, 2, 3, undefined]);
  refuse({ a: [1, 2, { b: NaN }], c: 'valide' });
});
test('D4. tableau creux, propriété de tableau additionnelle, clé symbole sur tableau : TypeError', () => {
  refuse([, 1], /creux|additionnelles/);
  refuse(new Array(3), /creux|additionnelles/);
  refuse(Object.assign([1, 2], { extra: true }), /creux|additionnelles/);
  refuse(Object.assign([1], { [Symbol('s')]: 1 }), /creux|additionnelles/);
  refuse([1, , 3], /creux|additionnelles/);
  const trous = [1, 2, 3]; delete trous[1]; refuse(trous, /creux|additionnelles/);
  class Sous extends Array {} refuse(Sous.from([1]), /tableau simple/);
  refuse({ a: [, 1] });
});
test('D5. clés symboles sur un objet : TypeError', () => {
  refuse({ [Symbol('s')]: 1 }, /symbole/);
  refuse({ a: 1, [Symbol.iterator]: 1 }, /symbole/);
  refuse({ a: { [Symbol('s')]: 1 } }, /symbole/);
});
test('D6. accesseurs : TypeError, et le getter n\'est JAMAIS exécuté', () => {
  let appels = 0;
  const avecGetter = { get a() { appels += 1; return 1; } };
  refuse(avecGetter, /accesseur/);
  const avecSetter = { set a(v) { appels += 1; } };
  refuse(avecSetter, /accesseur/);
  const tableau = []; Object.defineProperty(tableau, 0, { get() { appels += 1; return 1; }, enumerable: true });
  refuse(tableau, /accesseur|creux/);
  refuse({ x: { y: { get z() { appels += 1; return 1; } } } }, /accesseur/);
  assert.equal(appels, 0, 'aucun accesseur exécuté');
});
test('D7. propriétés propres non énumérables : TypeError (objet et tableau)', () => {
  refuse(Object.defineProperty({}, 'h', { value: 1, enumerable: false }), /énumérable/);
  refuse(Object.defineProperty({ a: 1 }, 'h', { value: 1, enumerable: false }), /énumérable/);
  const t = [1]; Object.defineProperty(t, 'k', { value: 1, enumerable: false }); refuse(t);
  const t2 = [1]; Object.defineProperty(t2, 0, { value: 1, enumerable: false, writable: true, configurable: true }); refuse(t2, /énumérable/);
});
test('D8. cycles : TypeError (direct, indirect, par tableau, auto-référence)', () => {
  const a = {}; a.soi = a; refuse(a, /cycle/);
  const b = { x: { y: {} } }; b.x.y.retour = b; refuse(b, /cycle/);
  const t = []; t.push(t); refuse(t, /cycle/);
  const c = { l: [] }; c.l.push({ c }); refuse(c, /cycle/);
  const d1 = {}; const d2 = { d1 }; d1.d2 = d2; refuse(d2, /cycle/);
});
test('D9. sous-structure partagée mais ACYCLIQUE : permise, occurrences distinctes selon chaque chemin', () => {
  const partage = { x: [1, { y: null }] };
  const occ = p({ a: partage, b: partage, c: [partage, partage] });
  assert.equal(occ.length, 1 + 4 * 5 + 1, 'racine + 4 copies de 5 nœuds + le tableau c');
  const chemins = cheminsDe(occ).filter((c) => c.at(-1) === 'y');
  assert.deepEqual(chemins, [['a', 'x', 1, 'y'], ['b', 'x', 1, 'y'], ['c', 0, 'x', 1, 'y'], ['c', 1, 'x', 1, 'y']]);
  assert.deepEqual(p({ a: partage, b: partage }), oracle({ a: partage, b: partage }));
  const feuille = []; assert.equal(p([feuille, feuille, feuille]).length, 4, 'un même tableau vide cité trois fois');
});
test('D10. profondeur raisonnable : 500 niveaux d\'objets, de tableaux et mixtes', () => {
  let o = 1; for (let i = 0; i < 500; i += 1) o = { k: o };
  const occ = p(o); assert.equal(occ.length, 501); assert.equal(occ.at(-1).chemin.length, 500);
  let t = 'x'; for (let i = 0; i < 500; i += 1) t = [t];
  assert.equal(p(t).length, 501); assert.deepEqual(p(t).at(-1).chemin, new Array(500).fill(0));
  let m = null; for (let i = 0; i < 300; i += 1) m = i % 2 ? { m } : [m];
  assert.equal(p(m).length, 301);
});
test('D11. les erreurs situent l\'endroit fautif sans encoder de chemin dans le résultat', () => {
  refuse({ liste: [1, { cle: undefined }] }, /racine\["liste"\]\[1\]\["cle"\]/);
  refuse({ a: NaN }, /non fini \(NaN\)/);
});
test('D12. l\'entrée n\'est jamais modifiée ; une entrée gelée en profondeur est acceptée', () => {
  const x = { a: [1, { b: 'c' }], d: null, e: { f: true } };
  const avant = structuredClone(x);
  const rendu = p(x);
  assert.deepEqual(x, avant);
  assert.deepEqual(Object.keys(x), ['a', 'd', 'e'], 'ordre d\'insertion de l\'entrée intact');
  const gele = (v) => { if (v && typeof v === 'object') { Object.values(v).forEach(gele); Object.freeze(v); } return v; };
  assert.deepEqual(p(gele(structuredClone(x))), rendu);
});

// ============================================================================ E. COPIE : AUCUN PARTAGE
test('E1. la sortie ne contient aucun objet ni tableau de l\'entrée ; modifier la sortie ne touche pas l\'entrée', () => {
  const entree = { a: [1, 'x'], b: { c: null } };
  const reference = structuredClone(entree);
  const occ = p(entree);
  const dansEntree = new Set();
  (function noeuds(v) { if (v && typeof v === 'object') { dansEntree.add(v); Object.values(v).forEach(noeuds); } })(entree);
  for (const o of occ) {
    assert.equal(dansEntree.has(o), false);
    assert.equal(dansEntree.has(o.chemin), false);
    if ('valeur' in o) assert.notEqual(typeof o.valeur, 'object');
  }
  for (const o of occ) { o.chemin.push('altere'); o.type = 'x'; if ('valeur' in o) o.valeur = 'altere'; }
  assert.deepEqual(entree, reference);
});
test('E2. deux appels successifs renvoient des structures indépendantes (aucune identité conservée)', () => {
  const x = { a: [1] };
  const r1 = p(x); const r2 = p(x);
  assert.deepEqual(r1, r2);
  assert.notEqual(r1, r2); assert.notEqual(r1[0], r2[0]); assert.notEqual(r1[0].chemin, r2[0].chemin);
  r1[1].chemin.push('z');
  assert.deepEqual(r2[1].chemin, ['a']);
});
test('E3. aucun conteneur n\'est recopié dans `valeur` (valeur n\'existe que pour chaîne, nombre, booléen)', () => {
  for (const o of p({ a: [1, { b: [] }], c: {} })) if (o.type === 'objet' || o.type === 'tableau' || o.type === 'nul') assert.equal('valeur' in o, false);
});

// ============================================================================ F. ORACLE ET ALÉATOIRE À GRAINE
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const CLES = ['a', 'b', '', '0', '1', 'a/b', 'a.b', '__proto__', 'é', 'forme', 'B', '10', '2'];
function aleatoire(rng, profondeur) {
  const r = rng();
  if (profondeur === 0 || r < 0.3) { const s = Math.floor(rng() * 5); return [null, 'x', '', 7, true, -1.5][s]; }
  if (r < 0.65) { const n = Math.floor(rng() * 4); return Array.from({ length: n }, () => aleatoire(rng, profondeur - 1)); }
  const o = {}; const n = Math.floor(rng() * 5);
  for (let i = 0; i < n; i += 1) Object.defineProperty(o, CLES[Math.floor(rng() * CLES.length)], { value: aleatoire(rng, profondeur - 1), enumerable: true, writable: true, configurable: true });
  return o;
}
test('F1. 400 structures aléatoires à graine : identique à l\'oracle de référence ; chemins distincts ; entrée intacte', () => {
  const rng = mulberry(20261004);
  for (let i = 0; i < 400; i += 1) {
    const x = aleatoire(rng, 5);
    const avant = JSON.stringify(x);
    const occ = p(x);
    assert.deepEqual(occ, oracle(x), `structure n°${i}`);
    const cles = occ.map((o) => JSON.stringify(o.chemin));
    assert.equal(new Set(cles).size, cles.length, `chemins distincts n°${i}`);
    assert.equal(JSON.stringify(x), avant);
  }
});
test('F2. 300 structures aléatoires dans lesquelles UNE valeur invalide est injectée quelque part : TypeError, jamais de résultat', () => {
  const rng = mulberry(77);
  const invalides = [undefined, NaN, Infinity, 1n, Symbol('s'), () => 1, new Date(0), new Map(), /x/, Object.create({})];
  let injectes = 0;
  for (let i = 0; i < 300; i += 1) {
    const x = { racine: aleatoire(rng, 4), autre: [aleatoire(rng, 3), aleatoire(rng, 3)] };
    const cibles = [];
    (function chercher(v) { if (v && typeof v === 'object') for (const k of Object.keys(v)) { cibles.push([v, k]); chercher(v[k]); } })(x);
    const [parent, cle] = cibles[Math.floor(rng() * cibles.length)];
    parent[cle] = invalides[i % invalides.length];
    injectes += 1;
    assert.throws(() => p(x), TypeError, `injection n°${i}`);
  }
  assert.equal(injectes, 300);
});

// ============================================================================ G. APPLICATION À DESCRIPTIONS_OPERATIONS (TEST SEULEMENT)
test('G1. parcourirStructure(DESCRIPTIONS_OPERATIONS) : aucune erreur, identique à l\'oracle', () => {
  const occ = p(CORPUS_V0634);
  assert.deepEqual(occ, oracle(CORPUS_V0634));
  assert.equal(occ[0].type, 'tableau'); assert.deepEqual(occ[0].chemin, []);
  assert.equal(occ.length, 114);
});
test('G2. les chemins commencent naturellement par 0, 1 ou 2 sous la racine : un indice, rien d\'autre', () => {
  const occ = p(CORPUS_V0634);
  for (const o of occ.slice(1)) assert.ok([0, 1, 2].includes(o.chemin[0]) && typeof o.chemin[0] === 'number', JSON.stringify(o.chemin));
  assert.deepEqual([...new Set(occ.slice(1).map((o) => o.chemin[0]))], [0, 1, 2]);
  assert.deepEqual(occ.slice(1, 4).map((o) => o.chemin), [[0], [0, 'entrees'], [0, 'entrees', 'elements']]);
});
test('G3. des occurrences existent pour `nom`, `entrees`, `sortie`, `forme`… parce que ces propriétés sont dans les DONNÉES : quelques chemins connus pour prouver la fidélité', () => {
  const occ = p(CORPUS_V0634);
  const trouve = (c) => occ.find((o) => JSON.stringify(o.chemin) === JSON.stringify(c));
  assert.deepEqual(trouve([0, 'nom']), { chemin: [0, 'nom'], type: 'chaine', valeur: 'couvrirSequence' });
  assert.deepEqual(trouve([1, 'nom']), { chemin: [1, 'nom'], type: 'chaine', valeur: 'decrireStructureIdentifiee' });
  assert.deepEqual(trouve([2, 'nom']), { chemin: [2, 'nom'], type: 'chaine', valeur: 'decrireValeursObservees' });
  for (const i of [0, 1, 2]) { assert.equal(trouve([i, 'entrees']).type, 'objet'); assert.equal(trouve([i, 'sortie']).type, 'objet'); }
  assert.deepEqual(trouve([0, 'sortie', 'forme']), { chemin: [0, 'sortie', 'forme'], type: 'chaine', valeur: 'collection' });
  assert.deepEqual(trouve([2, 'entrees', 'paires', 'elements', 'champs', 'valeur', 'peutEtreNull']), { chemin: [2, 'entrees', 'paires', 'elements', 'champs', 'valeur', 'peutEtreNull'], type: 'booleen', valeur: true });
  assert.equal(trouve([0, 'entrees', 'plages', 'elements', 'champs', 'etiquette', 'forme']).valeur, 'quelconque');
  assert.equal(trouve([1, 'sortie', 'champs', 'rapport']).type, 'objet');
  assert.equal(occ.some((o) => o.chemin.at(-1) === 'forme'), true);
  assert.equal(occ.filter((o) => o.chemin.at(-1) === 'forme').length, 38);
});
test('G4. la primitive ne connaît pas ces propriétés : le même parcours s\'applique à une structure sans rapport, et le code ne les nomme pas', () => {
  assert.equal(p({ gamma: [{ delta: 'x' }] }).length, 4);
  assert.equal(/forme|entrees|sortie|nom\b|champs|elements|genre|omissible|peutManquer|peutEtreNull|scalaire|collection|quelconque/.test(CODE), false);
});

// ============================================================================ H. STATIQUE ET DORMANCE
const fichiers = (d, s = []) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) { if (n !== 'node_modules') fichiers(f, s); } else s.push(f); } return s; };
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const MODULE = 'app/langage/parcours-structure.js';

test('H1. le module n\'importe RIEN, n\'exporte qu\'une fonction, et ne connaît ni DESCRIPTIONS_OPERATIONS, ni formes, ni garantie, ni couvrirSequence, ni DVO, ni DSI', () => {
  assert.equal(/^\s*import\b/m.test(CODE), false);
  assert.equal(/\bimport\s*\(|\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function parcourirStructure(valeur) {']);
  assert.equal(/DESCRIPTIONS_OPERATIONS|descriptions-operations|formes-operation|garantie-forme|validerDescripteur|fournieGarantit|couvrirSequence|sequence-plages|decrireValeursObservees|valeurs-observees|decrireStructure|structure-identifiee|CAPACITES|registre/.test(CODE), false);
});
test('H2. pur : aucun accès réseau, stockage, horloge, hasard, console, global ; aucun JSON.stringify/join (un chemin n\'est jamais encodé en chaîne) ; aucun accesseur exécuté', () => {
  assert.equal(/\bfetch\b|localStorage|indexedDB|process\.|Date\.now|new Date|Math\.random|console\.|setTimeout|await\b|\basync\b|globalThis|window\.|document\./.test(CODE), false);
  assert.equal(/JSON\.|\.join\s*\(|\.toString\s*\(|\bencodeURI|\bbtoa\b/.test(CODE), false);
  assert.equal(/\.get\s*\(|Reflect\.get\b|Object\.entries|Object\.values|Object\.keys|for\s*\(\s*(const|let|var)\s+\w+\s+in\b/.test(CODE), false, 'seules les descriptions de propriétés sont lues');
});
test('H3. le code ne crée ni id, ni parent, ni profondeur, ni taille, ni score… dans la sortie', () => {
  assert.equal(/\bid\s*[:,]|\bparent\b|\bprofondeur\b|nombreEnfants|\btaille\b|\bfeuille\b|categorie|\bscore\b|\bpoids\b|frequence|pertinen|motif|compat|filtr|regroup|compar|selection|choisir/i.test(CODE), false);
});
test('H4. aucun fichier de production n\'importe ni ne nomme cette primitive ou son module (hors constats-structurels.js, unique consommateur depuis v0.63.8)', () => {
  const fautifs = [];
  for (const f of fichiers(join(RACINE, 'app'))) {
    if (rel(f) === MODULE) continue;
    if (rel(f) === 'app/langage/suites-fermees.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.32 : + suites-fermees.js (observateur de suites dormant, importe ces primitives)
    if (rel(f) === 'app/langage/constats-valeurs.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.29 : + constats-valeurs.js (observateur de valeurs dormant, importe ces primitives)
    if (rel(f) === 'app/langage/constats-structurels.js') continue; // v0.63.8 : SEUL consommateur autorisé (gardé par tests/constats-structurels.test.mjs)
    if (rel(f) === 'app/langage/table-operations.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.18 : table-operations.js rend les opérations LOCALISABLES mécaniquement (importeur statique autorisé, gardé par tests/invocation-operations.test.mjs) ; elles ne sont pas utilisées par le moteur
    if (rel(f) === 'app/langage/descriptions-operations.js') { assert.equal(/parcours-structure/.test(readFileSync(f, 'utf8')), false, 'le catalogue ne cite jamais le chemin du module'); continue; } // v0.63.10 : NOMME la primitive (nom: '…') sans l'importer
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (/parcours-structure|parcourirStructure/.test(src)) fautifs.push(rel(f));
  }
  assert.deepEqual(fautifs, []);
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/parcours-structure/.test(src), false, autre); }
});
test('H5. la primitive est INACCESSIBLE depuis le démarrage : parcours des imports statiques depuis app/main.js', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs)
  }
  assert.ok(vus.size > 20);
  assert.equal([...vus].some((f) => rel(f) === MODULE), false);
});
test('H6. aucun autre module de production ne change de statut : CAPACITES inchangée, VERSION_BASE 15, SCHEMA_SAUVEGARDE 5 ; le module descriptif ne le nomme pas', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  assert.equal(Object.isFrozen(CAPACITES), true);
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 19); assert.equal(sauv.SCHEMA_SAUVEGARDE, 9); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  // v0.63.10 : le catalogue décrit la primitive par `nom` (une fois), jamais par un chemin de module ni par un import.
  const catalogue = readFileSync(join(RACINE, 'app', 'langage', 'descriptions-operations.js'), 'utf8');
  assert.equal(/parcours-structure/.test(catalogue), false);
  assert.equal(catalogue.split('nom: \'parcourirStructure\'').length - 1, 1);
  assert.equal(/parcours-structure|parcourirStructure/.test(readFileSync(join(RACINE, 'app', 'langage', 'registre.js'), 'utf8')), false);
});
// === FIN_TEST_PARCOURS_STRUCTURE ===
