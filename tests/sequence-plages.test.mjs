// === DEBUT_TEST_SEQUENCE_PLAGES ===
// v0.63.2 — primitive pure et dormante couvrirSequence() (app/langage/sequence-plages.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { couvrirSequence } from '../app/langage/sequence-plages.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const P = (debut, longueur, etiquette) => ({ debut, longueur, etiquette });
const refuse = (entree, motif) => assert.throws(() => couvrirSequence(entree), (e) => e instanceof TypeError && (!motif || motif.test(e.message)));

// --- 1. cas conceptuels ---------------------------------------------------------------------------------
test('1a. séquence vide sans plage -> tableau vide', () => {
  assert.deepEqual(couvrirSequence({ elements: [], plages: [] }), []);
});
test('1b. positions sans couverture : une entrée par position, couvertures vides', () => {
  assert.deepEqual(couvrirSequence({ elements: ['a', 'b'], plages: [] }), [
    { position: 0, element: 'a', couvertures: [] }, { position: 1, element: 'b', couvertures: [] },
  ]);
});
test('1c. plage d\'un seul élément', () => {
  const r = couvrirSequence({ elements: ['a', 'b', 'c'], plages: [P(1, 1, 'x')] });
  assert.deepEqual(r.map((e) => e.couvertures.length), [0, 1, 0]);
  assert.deepEqual(r[1].couvertures, [{ etiquette: 'x', debut: 1, longueur: 1 }]);
});
test('1d. plage couvrant plusieurs éléments : chaque position la porte, avec debut/longueur de la plage entière', () => {
  const r = couvrirSequence({ elements: ['a', 'b', 'c', 'd'], plages: [P(1, 2, 'x')] });
  assert.deepEqual(r.map((e) => e.couvertures.length), [0, 1, 1, 0]);
  assert.deepEqual(r[2].couvertures, [{ etiquette: 'x', debut: 1, longueur: 2 }]);
});
test('1e. plages qui se chevauchent : la position commune porte les deux, dans l\'ordre des plages', () => {
  const r = couvrirSequence({ elements: [1, 2, 3, 4], plages: [P(0, 3, 'A'), P(2, 2, 'B')] });
  assert.deepEqual(r.map((e) => e.couvertures.map((c) => c.etiquette)), [['A'], ['A'], ['A', 'B'], ['B']]);
});
test('1f. deux plages exactement identiques, étiquettes différentes : deux couvertures', () => {
  const r = couvrirSequence({ elements: ['a'], plages: [P(0, 1, 'x'), P(0, 1, 'y')] });
  assert.deepEqual(r[0].couvertures.map((c) => c.etiquette), ['x', 'y']);
});
test('1g. deux plages identiques, MÊME étiquette : deux occurrences conservées, aucune déduplication', () => {
  const r = couvrirSequence({ elements: ['a'], plages: [P(0, 1, 'x'), P(0, 1, 'x')] });
  assert.equal(r[0].couvertures.length, 2);
  assert.deepEqual(r[0].couvertures[0], r[0].couvertures[1]);
});
test('1h. type + relation sur une position : DEUX couvertures, jamais fusionnées', () => {
  const r = couvrirSequence({ elements: ['ou'], plages: [P(0, 1, 'type'), P(0, 1, 'relation')] });
  assert.deepEqual(r[0].couvertures.map((c) => c.etiquette), ['type', 'relation']);
  assert.equal(r[0].couvertures.length, 2);
});
test('1i. plages adjacentes : aucune position partagée', () => {
  const r = couvrirSequence({ elements: [1, 2, 3, 4], plages: [P(0, 2, 'A'), P(2, 2, 'B')] });
  assert.deepEqual(r.map((e) => e.couvertures.map((c) => c.etiquette)), [['A'], ['A'], ['B'], ['B']]);
});
test('1j. première et dernière positions', () => {
  const r = couvrirSequence({ elements: [1, 2, 3], plages: [P(0, 1, 'premier'), P(2, 1, 'dernier')] });
  assert.deepEqual(r.map((e) => e.couvertures.map((c) => c.etiquette)), [['premier'], [], ['dernier']]);
});
test('1k. plage couvrant toute la séquence', () => {
  const r = couvrirSequence({ elements: ['a', 'b'], plages: [P(0, 2, 'tout')] });
  assert.deepEqual(r.map((e) => e.couvertures.length), [1, 1]);
});
test('1l. l\'ordre des couvertures est celui des plages d\'entrée (aucun tri sur les étiquettes)', () => {
  const r = couvrirSequence({ elements: ['a'], plages: [P(0, 1, 'z'), P(0, 1, 'a'), P(0, 1, 'm')] });
  assert.deepEqual(r[0].couvertures.map((c) => c.etiquette), ['z', 'a', 'm']);
  const inverse = couvrirSequence({ elements: ['a'], plages: [P(0, 1, 'm'), P(0, 1, 'a'), P(0, 1, 'z')] });
  assert.deepEqual(inverse[0].couvertures.map((c) => c.etiquette), ['m', 'a', 'z']);
});
test('1m. sortie exactement { position, element, couvertures:[{etiquette,debut,longueur}] } : aucun autre champ', () => {
  const [e] = couvrirSequence({ elements: ['a'], plages: [P(0, 1, 'x')] });
  assert.deepEqual(Object.keys(e), ['position', 'element', 'couvertures']);
  assert.deepEqual(Object.keys(e.couvertures[0]), ['etiquette', 'debut', 'longueur']);
});
test('1n. les propriétés additionnelles d\'une plage ou de l\'entrée sont ignorées et jamais recopiées', () => {
  const r = couvrirSequence({ elements: ['a'], plages: [{ debut: 0, longueur: 1, etiquette: 'x', poids: 9, role: 'sujet' }], autre: 1 });
  assert.deepEqual(r[0].couvertures[0], { etiquette: 'x', debut: 0, longueur: 1 });
});
test('1o. étiquettes et éléments de types JSON variés sont recopiés sans interprétation', () => {
  const eti = [null, 0, -0.5, '', 'texte', true, false, [], {}, [1, [2, { a: null }]], { a: { b: [1, 'x'] } }];
  const r = couvrirSequence({ elements: eti, plages: eti.map((e, i) => P(i, 1, e)) });
  r.forEach((e, i) => { assert.deepEqual(e.element, eti[i]); assert.deepEqual(e.couvertures[0].etiquette, eti[i]); });
});

// --- 2. validation --------------------------------------------------------------------------------------
test('2a. entrée non conforme', () => {
  for (const x of [undefined, null, 5, 'texte', [], () => {}, new Map(), true]) refuse(x);
});
test('2b. elements / plages absents ou non tableaux', () => {
  refuse({ plages: [] }, /elements/);
  refuse({ elements: [] }, /plages/);
  for (const x of ['abc', 5, null, {}, new Set()]) { refuse({ elements: x, plages: [] }, /elements/); refuse({ elements: [], plages: x }, /plages/); }
});
test('2c. debut non entier / négatif / absent', () => {
  for (const d of [1.5, -1, '0', NaN, Infinity, undefined, null, 2 ** 60]) refuse({ elements: ['a', 'b'], plages: [{ debut: d, longueur: 1, etiquette: 'x' }] }, /debut/);
});
test('2d. longueur zéro, négative, non entière, absente', () => {
  for (const l of [0, -1, 1.5, '1', NaN, Infinity, undefined, null]) refuse({ elements: ['a', 'b'], plages: [P(0, l, 'x')] }, /longueur/);
});
test('2e. plage hors bornes : jamais rognée', () => {
  refuse({ elements: ['a', 'b'], plages: [P(2, 1, 'x')] }, /dépasse/);
  refuse({ elements: ['a', 'b'], plages: [P(1, 2, 'x')] }, /dépasse/);
  refuse({ elements: ['a', 'b'], plages: [P(0, 3, 'x')] }, /dépasse/);
  refuse({ elements: [], plages: [P(0, 1, 'x')] }, /dépasse/);
});
test('2f. plage non objet simple', () => {
  for (const p of [null, 5, 'x', [], [0, 1, 'x'], new Map(), undefined]) refuse({ elements: ['a'], plages: [p] }, /plages\[0\]/);
});
test('2g. étiquette obligatoire (même undefined explicite refusé : non JSON)', () => {
  refuse({ elements: ['a'], plages: [{ debut: 0, longueur: 1 }] }, /etiquette/);
  refuse({ elements: ['a'], plages: [{ debut: 0, longueur: 1, etiquette: undefined }] }, /etiquette/);
});
test('2g2. une « etiquette » seulement HÉRITÉE (prototype pollué) n\'est pas une étiquette propre : refusée', () => {
  Object.prototype.etiquette = 'heritee';
  try {
    refuse({ elements: ['a'], plages: [{ debut: 0, longueur: 1 }] }, /etiquette/);
  } finally { delete Object.prototype.etiquette; }
});
test('2h. étiquette ou élément non JSON-compatible : fonction, symbole, bigint, NaN, Infinity, Date, Map, classe, undefined imbriqué', () => {
  class K { constructor() { this.a = 1; } }
  const mauvais = [() => 1, Symbol('s'), 10n, NaN, Infinity, -Infinity, new Date(0), new Map(), new Set(), new K(), /re/, [undefined], { a: undefined }, { f() {} }, { a: [NaN] }];
  for (const m of mauvais) {
    refuse({ elements: ['a'], plages: [P(0, 1, m)] });
    refuse({ elements: [m], plages: [] });
  }
});
test('2i. cycle (objet et tableau) refusé ; sous-structure partagée sans cycle acceptée', () => {
  const o = { a: 1 }; o.soi = o;
  const t = []; t.push(t);
  refuse({ elements: [o], plages: [] }, /cycle/);
  refuse({ elements: ['a'], plages: [P(0, 1, t)] }, /cycle/);
  const partage = { z: 1 };
  const r = couvrirSequence({ elements: [{ a: partage, b: partage }], plages: [] });
  assert.deepEqual(r[0].element, { a: { z: 1 }, b: { z: 1 } });
  assert.notEqual(r[0].element.a, r[0].element.b);
});
test('2j. tableau creux, accesseur, clé symbole, propriété non énumérable refusés', () => {
  const creux = [1, , 3]; // eslint-disable-line no-sparse-arrays
  refuse({ elements: creux, plages: [] }, /creux/);
  refuse({ elements: ['a'], plages: [P(0, 1, creux)] }, /creux/);
  const plagesCreuses = [P(0, 1, 'x'), , P(0, 1, 'y')]; // eslint-disable-line no-sparse-arrays
  refuse({ elements: ['a'], plages: plagesCreuses }, /absente/);
  refuse({ elements: [{ get a() { return 1; } }], plages: [] }, /accesseur/);
  refuse({ elements: [{ [Symbol('k')]: 1 }], plages: [] }, /symbole/);
  const ne = {}; Object.defineProperty(ne, 'a', { value: 1, enumerable: false });
  refuse({ elements: [ne], plages: [] }, /énumérable/);
  const tabProp = [1]; tabProp.extra = 2;
  refuse({ elements: [tabProp], plages: [] }, /creux|additionnelles/);
});
test('2k. une erreur de validation survient AVANT toute sortie (aucun résultat partiel)', () => {
  assert.throws(() => couvrirSequence({ elements: ['a', 'b'], plages: [P(0, 1, 'ok'), P(5, 1, 'hors')] }), TypeError);
});

// --- 3. copie / mutabilité ------------------------------------------------------------------------------
test('3a. muter l\'entrée APRÈS l\'appel ne change pas la sortie', () => {
  const e0 = { m: ['x'] }; const et = { k: [1] };
  const entree = { elements: [e0], plages: [P(0, 1, et)] };
  const r = couvrirSequence(entree);
  const avant = JSON.stringify(r);
  e0.m.push('y'); et.k.push(2); entree.elements.push('z'); entree.plages[0].debut = 9; entree.plages.push(P(0, 1, 'n'));
  assert.equal(JSON.stringify(r), avant);
});
test('3b. muter la sortie ne change ni l\'entrée ni une autre position', () => {
  const eti = { k: [1] }; const elt = { m: [1] };
  const entree = { elements: [elt, 'b'], plages: [P(0, 2, eti)] };
  const instantane = JSON.stringify(entree);
  const r = couvrirSequence(entree);
  r[0].element.m.push(99); r[0].couvertures[0].etiquette.k.push(99); r[0].couvertures[0].debut = 42; r[0].couvertures.push('x');
  assert.equal(JSON.stringify(entree), instantane);
  assert.deepEqual(r[1].couvertures[0].etiquette, { k: [1] }, 'la couverture de la position 1 est indépendante de celle de la position 0');
  assert.notEqual(r[0].couvertures[0].etiquette, r[1].couvertures[0].etiquette);
});
test('3c. aucune référence partagée entre sortie et entrée', () => {
  const elt = { a: [1] }; const eti = { b: {} };
  const r = couvrirSequence({ elements: [elt], plages: [P(0, 1, eti)] });
  assert.notEqual(r[0].element, elt); assert.notEqual(r[0].element.a, elt.a);
  assert.notEqual(r[0].couvertures[0].etiquette, eti); assert.notEqual(r[0].couvertures[0].etiquette.b, eti.b);
});
test('3d. entrée gelée acceptée et non modifiée ; sortie non gelée', () => {
  const entree = Object.freeze({ elements: Object.freeze([Object.freeze({ a: 1 })]), plages: Object.freeze([Object.freeze(P(0, 1, Object.freeze({ b: 2 })))]) });
  const r = couvrirSequence(entree);
  assert.equal(Object.isFrozen(r), false); assert.equal(Object.isFrozen(r[0].element), false);
  assert.equal(Object.isFrozen(r[0].couvertures[0].etiquette), false);
});
test('3e. clé « __proto__ » recopiée comme propriété propre, sans polluer de prototype', () => {
  const elt = JSON.parse('{"__proto__":{"pollue":true},"a":1}');
  const r = couvrirSequence({ elements: [elt], plages: [P(0, 1, JSON.parse('{"__proto__":{"p":1}}'))] });
  assert.equal(Object.getPrototypeOf(r[0].element), Object.prototype);
  assert.equal(r[0].element.pollue, undefined);
  assert.ok(Object.prototype.hasOwnProperty.call(r[0].element, '__proto__'));
  assert.equal({}.pollue, undefined);
  assert.equal({}.p, undefined);
});
test('3f. la sortie survit à JSON (persistance possible) : aller-retour identique', () => {
  const r = couvrirSequence({ elements: ['ou', { a: [1] }], plages: [P(0, 1, 'type'), P(0, 2, { n: null })] });
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
});

// --- 4. déterminisme ------------------------------------------------------------------------------------
test('4a. mêmes entrées -> mêmes sorties ; sortie neuve à chaque appel', () => {
  const e = { elements: ['a', 'b', 'c'], plages: [P(0, 2, 'x'), P(1, 2, 'y')] };
  const a = couvrirSequence(e); const b = couvrirSequence(e);
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a[0], b[0]);
});
test('4b. une entrée par position, position = indice, ordre naturel', () => {
  const r = couvrirSequence({ elements: Array.from({ length: 50 }, (_, i) => `e${i}`), plages: [P(10, 5, 'x')] });
  assert.equal(r.length, 50);
  r.forEach((e, i) => { assert.equal(e.position, i); assert.equal(e.element, `e${i}`); });
  assert.deepEqual(r.map((e) => e.couvertures.length).join(''), '0'.repeat(10) + '1'.repeat(5) + '0'.repeat(35));
});
test('4c. propriété : sur 2000 cas pseudo-aléatoires, couverture(position) = plages dont debut <= position < debut+longueur, dans l\'ordre', () => {
  let graine = 12345;
  const alea = (n) => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
  for (let c = 0; c < 2000; c += 1) {
    const n = alea(12);
    const plages = [];
    if (n > 0) for (let k = alea(6); k > 0; k -= 1) { const d = alea(n); plages.push(P(d, 1 + alea(n - d), `e${alea(4)}`)); }
    const r = couvrirSequence({ elements: Array.from({ length: n }, (_, i) => i), plages });
    for (let i = 0; i < n; i += 1) {
      const attendu = plages.filter((p) => i >= p.debut && i < p.debut + p.longueur).map((p) => ({ etiquette: p.etiquette, debut: p.debut, longueur: p.longueur }));
      assert.deepEqual(r[i].couvertures, attendu);
    }
  }
});

// --- 5. cas analogue à la provenance (démonstration uniquement) ------------------------------------------
test('5. cas analogue à la provenance : « ou » type + relation, « tu » sujet', () => {
  const r = couvrirSequence({ elements: ['ou', 'tu', 'veux'], plages: [P(0, 1, 'type'), P(0, 1, 'relation'), P(1, 1, 'sujet')] });
  assert.equal(r[0].couvertures.length, 2);
  assert.deepEqual(r[0].couvertures.map((c) => c.etiquette), ['type', 'relation']);
  assert.equal(r[1].couvertures.length, 1);
  assert.equal(r[1].couvertures[0].etiquette, 'sujet');
  assert.equal(r[2].couvertures.length, 0);
});

// --- 6. indépendance et dormance statiques --------------------------------------------------------------
function fichiersJs(dossier) {
  const sortie = [];
  for (const nom of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, nom.name);
    if (nom.isDirectory()) sortie.push(...fichiersJs(p));
    else if (/\.(js|mjs)$/.test(nom.name)) sortie.push(p);
  }
  return sortie;
}
const sansCommentairesPurs = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const SOURCE = fs.readFileSync(path.join(RACINE, 'app', 'langage', 'sequence-plages.js'), 'utf8');

test('6a. le module n\'importe RIEN', () => {
  assert.equal(/^\s*import\s/m.test(SOURCE), false);
  assert.equal(/\brequire\s*\(|\bimport\s*\(/.test(sansCommentairesPurs(SOURCE)), false);
});
test('6b. le code (hors commentaires) ne connaît ni langage, ni provenance, ni états, ni tokens, ni observations, ni rôles', () => {
  const code = sansCommentairesPurs(SOURCE);
  assert.equal(/provenance|comprendre|compris|partiel|incompris|token|jeton|observation|sujet|relation|decouper|valeursObservees|role|score|ratio|poids|priorit|qualit|confiance/i.test(code), false);
});
test('6c. aucun fichier de app/ ne référence ce module ni sa fonction (v0.63.4 : le SEUL fichier autorisé à NOMMER la fonction est le module descriptif app/langage/descriptions-operations.js, qui ne l\'importe pas : voir tests/descriptions-operations.test.mjs)', () => {
  const fautifs = [];
  for (const f of fichiersJs(path.join(RACINE, 'app'))) {
    const rel = path.relative(RACINE, f).split(path.sep).join('/');
    if (rel === 'app/langage/sequence-plages.js') continue;
    if (rel === 'app/langage/descriptions-operations.js') continue; // dérogation v0.63.4 : nommer sans importer (garanti ailleurs)
    if (rel === 'app/langage/table-operations.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.18 : table-operations.js rend les opérations LOCALISABLES mécaniquement (importeur statique autorisé, gardé par tests/invocation-operations.test.mjs) ; elles ne sont pas utilisées par le moteur
    if (/sequence-plages|couvrirSequence/.test(sansCommentairesPurs(fs.readFileSync(f, 'utf8')))) fautifs.push(rel);
  }
  assert.deepEqual(fautifs, []);
});
test('6d. le module ne fait aucune entrée/sortie ni horloge ni hasard', () => {
  const code = sansCommentairesPurs(SOURCE);
  assert.equal(/\bfetch\b|localStorage|indexedDB|process\.|Date\.now|new Date|Math\.random|console\.|setTimeout|await\b|\basync\b/.test(code), false);
});
test('6e. l\'unique export est couvrirSequence', async () => {
  const m = await import('../app/langage/sequence-plages.js');
  assert.deepEqual(Object.keys(m), ['couvrirSequence']);
});
// === FIN_TEST_SEQUENCE_PLAGES ===
