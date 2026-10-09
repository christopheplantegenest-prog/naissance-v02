// v0.63.28 — vue pure de l'univers historique des valeurs (dormante). Tests : contrat, validation, tout-ou-rien, collisions,
// absence de sélection/catalogue/tokenisation, compatibilité dormante avec l'observateur structurel, dormance, versions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { universValeurs } from '../app/langage/univers-valeurs.js';
import * as module from '../app/langage/univers-valeurs.js';
import { produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const SRC = readFileSync(new URL('../app/langage/univers-valeurs.js', import.meta.url), 'utf8');
const m = (id, valeur) => ({ id, valeur });
const x = (id, resultat, extra = {}) => ({ id, resultat, ...extra });
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const ids = (vue) => vue.map((e) => e.chemin[0]);

test('A1. contrat : [] [] -> [] ; forme exacte { chemin:[id], contenu }', () => {
  assert.deepEqual(universValeurs([], []), []);
  const r = universValeurs([m('M1', 'bonjour')], [x('X1', { a: 1 })]);
  assert.equal(r.length, 2);
  for (const e of r) { assert.deepEqual(Object.keys(e), ['chemin', 'contenu']); assert.equal(e.chemin.length, 1); }
  assert.deepEqual(r, [{ chemin: ['M1'], contenu: 'bonjour' }, { chemin: ['X1'], contenu: { a: 1 } }]);
});
test('A2. export unique, fonction synchrone', () => {
  assert.deepEqual(Object.keys(module), ['universValeurs']);
  assert.equal(universValeurs.constructor.name, 'Function');
  assert.ok(Array.isArray(universValeurs([], [])));
});
test('B1. toutes les exécutions retenues : opération inconnue, ligne minimale, ancienne ligne sans idDesignation', () => {
  const r = universValeurs([], [
    x('X', { a: 1 }, { operation: 'operation-disparue', liaisons: [], horodatage: 1 }),
    x('Y', 5),
    { id: 'Z', operation: 'longueur', resultat: 'ab', horodatage: 3, liaisons: [] },
  ]);
  assert.deepEqual(ids(r), ['X', 'Y', 'Z']);
});
test('B2. messages seuls / exécutions seules acceptés', () => {
  assert.deepEqual(ids(universValeurs([m('M', 'a')], [])), ['M']);
  assert.deepEqual(ids(universValeurs([], [x('X', 'a')])), ['X']);
});
test('B3. aucun autre champ lu : accesseur sur un champ non lu non exécuté, champs étrangers ignorés', () => {
  let lu = 0;
  const ligne = { id: 'X', resultat: 1 };
  Object.defineProperty(ligne, 'operation', { get() { lu += 1; return 'z'; }, enumerable: true });
  Object.defineProperty(ligne, 'horodatage', { get() { lu += 1; return 1; }, enumerable: true });
  const ligneM = { id: 'M', valeur: 'a', source: 'peu importe' };
  Object.defineProperty(ligneM, 'resultat', { get() { lu += 1; return 1; } });
  assert.deepEqual(universValeurs([ligneM], [ligne]), [{ chemin: ['M'], contenu: 'a' }, { chemin: ['X'], contenu: 1 }]);
  assert.equal(lu, 0);
});
test('B4. valeur message lue dans `valeur` seulement ; résultat dans `resultat` seulement', () => {
  const r = universValeurs([{ id: 'M', valeur: 'v', resultat: 'faux' }], [{ id: 'X', resultat: 'r', valeur: 'faux' }]);
  assert.deepEqual(r, [{ chemin: ['M'], contenu: 'v' }, { chemin: ['X'], contenu: 'r' }]);
  assert.throws(() => universValeurs([{ id: 'M', resultat: 'a' }], []), TypeError);
  assert.throws(() => universValeurs([], [{ id: 'X', valeur: 'a' }]), TypeError);
});
test('C1. duplicats de valeur : deux identités, deux éléments', () => {
  const r = universValeurs([m('M1', 'bonjour'), m('M2', 'bonjour')], [x('X1', 'bonjour')]);
  assert.equal(r.length, 3);
});
test('C2. aucune sélection : tout type, toute taille, tout contenu reste', () => {
  const vue = universValeurs([m('M1', ''), m('M2', 'z'.repeat(5000))], [x('X1', null), x('X2', []), x('X3', {}), x('X4', 0), x('X5', false)]);
  assert.equal(vue.length, 7);
});
test('D1. hétérogénéité : chaîne, nombre, booléen, null, tableau, objet', () => {
  const r = universValeurs([m('A', 'txt')], [x('B', 3.5), x('C', true), x('D', null), x('E', [1, 'a', [null]]), x('F', { k: { l: [] } })]);
  assert.deepEqual(r.map((e) => e.contenu), ['txt', 3.5, true, null, [1, 'a', [null]], { k: { l: [] } }]);
  assert.doesNotThrow(() => produireConstatsStructurels(r));
});
test('E1. identités : chaîne non vide', () => {
  for (const mauvais of ['', 1, null, undefined, {}, [], Symbol('s'), true]) {
    assert.throws(() => universValeurs([{ id: mauvais, valeur: 'a' }], []), TypeError);
    assert.throws(() => universValeurs([], [{ id: mauvais, resultat: 'a' }]), TypeError);
  }
  assert.throws(() => universValeurs([{ valeur: 'a' }], []), TypeError);
});
test('E2. collisions : doublon source 1, source 2, inter-tables, quelle que soit la valeur', () => {
  assert.throws(() => universValeurs([m('A', 'a'), m('A', 'a')], []), TypeError);
  assert.throws(() => universValeurs([m('A', 'a'), m('A', 'b')], []), TypeError);
  assert.throws(() => universValeurs([], [x('A', 1), x('A', 1)]), TypeError);
  assert.throws(() => universValeurs([], [x('A', 1), x('A', 2)]), TypeError);
  assert.throws(() => universValeurs([m('A', 'a')], [x('A', 'a')]), TypeError);
  assert.throws(() => universValeurs([m('A', 'a')], [x('A', 'b')]), TypeError);
});
test('F1. valeur : propriété obligatoire, domaine JSON de parcourirStructure', () => {
  const sym = Symbol('s');
  const cycle = {}; cycle.c = cycle;
  const creux = [1, , 3]; // eslint-disable-line no-sparse-arrays
  const accesseur = {}; Object.defineProperty(accesseur, 'a', { get() { return 1; }, enumerable: true });
  const cacheeNonEnum = {}; Object.defineProperty(cacheeNonEnum, 'a', { value: 1, enumerable: false });
  const symboleCle = { [sym]: 1 };
  class C { constructor() { this.a = 1; } }
  const battery = [undefined, NaN, Infinity, -Infinity, 1n, sym, () => 1, new Date(0), new Map(), new Set(), /x/, new C(),
    creux, cycle, accesseur, cacheeNonEnum, symboleCle, [undefined], { a: undefined }, [NaN], { a: [() => 1] }, Object.assign([1], { extra: 1 }),
    null, 'a', '', true, false, 0, -0, 1.5, [], {}, [1, [2, { a: null }]], Object.create(null)];
  for (const v of battery) {
    let attendu = true;
    try { parcourirStructure(v); } catch { attendu = false; }
    let obtenu = true;
    try { universValeurs([], [{ id: 'X', resultat: v }]); } catch (e) { assert.ok(e instanceof TypeError); obtenu = false; }
    assert.equal(obtenu, attendu, `équivalence avec parcourirStructure pour ${String(typeof v)}`);
    let obtenuM = true;
    try { universValeurs([{ id: 'M', valeur: v }], []); } catch { obtenuM = false; }
    assert.equal(obtenuM, attendu);
  }
});
test('F2. resultat: undefined refusé (propriété présente mais hors domaine) ; propriété absente refusée', () => {
  assert.throws(() => universValeurs([], [{ id: 'X', resultat: undefined }]), TypeError);
  assert.throws(() => universValeurs([], [{ id: 'X' }]), TypeError);
});
test('F3. aucun héritage ni accesseur sur les lignes ; lignes non objets ; entrées non tableaux / creuses', () => {
  const herite = Object.create({ id: 'X', resultat: 1 });
  assert.throws(() => universValeurs([], [herite]), TypeError);
  let exec = 0;
  const acc = {}; Object.defineProperty(acc, 'id', { get() { exec += 1; return 'X'; }, enumerable: true }); acc.resultat = 1;
  assert.throws(() => universValeurs([], [acc]), TypeError);
  const acc2 = { id: 'X' }; Object.defineProperty(acc2, 'resultat', { get() { exec += 1; return 1; }, enumerable: true });
  assert.throws(() => universValeurs([], [acc2]), TypeError);
  assert.equal(exec, 0);
  for (const l of [null, undefined, 'x', 3, [], () => 1]) {
    assert.throws(() => universValeurs([l], []), TypeError);
    assert.throws(() => universValeurs([], [l]), TypeError);
  }
  for (const t of [null, undefined, {}, 'ab', new Set(), { length: 0 }]) {
    assert.throws(() => universValeurs(t, []), TypeError);
    assert.throws(() => universValeurs([], t), TypeError);
  }
  assert.throws(() => universValeurs([, m('A', 'a')], []), TypeError); // eslint-disable-line no-sparse-arrays
  const sup = [m('A', 'a')]; sup.extra = 1;
  assert.throws(() => universValeurs(sup, []), TypeError);
  const accT = []; Object.defineProperty(accT, 0, { get() { exec += 1; return m('A', 'a'); }, enumerable: true });
  assert.throws(() => universValeurs(accT, []), TypeError);
  assert.equal(exec, 0);
  assert.throws(() => universValeurs([m('A', 'a')]), TypeError);
});
test('G1. tout ou rien : une seule ligne invalide, n\'importe où, aucune vue', () => {
  const bonnesM = [m('M1', 'a'), m('M2', 'b')];
  const bonnesX = [x('X1', 1), x('X2', 2)];
  assert.throws(() => universValeurs([...bonnesM, m('M3', undefined)], bonnesX), TypeError);
  assert.throws(() => universValeurs(bonnesM, [...bonnesX, x('X3', NaN)]), TypeError);
  assert.throws(() => universValeurs(bonnesM, [x('X3', 1n), ...bonnesX]), TypeError);
  assert.throws(() => universValeurs(bonnesM, [...bonnesX, x('M1', 3)]), TypeError);
  assert.equal(universValeurs(bonnesM, bonnesX).length, 4);
});
test('H1. ordre sans sens : permutations équivalentes, tri par identité (unités de code), pas par source ni chronologie', () => {
  const M = [m('b', 1), m('a', 'x'), m('B', 'y')];
  const X = [x('c', 2, { horodatage: 1 }), x('A', 3, { horodatage: 99 }), x('aa', 4)];
  const ref = universValeurs(M, X);
  assert.deepEqual(ids(ref), ['A', 'B', 'a', 'aa', 'b', 'c']);
  assert.deepEqual(universValeurs([...M].reverse(), [...X].reverse()), ref);
  assert.deepEqual(universValeurs([M[1], M[2], M[0]], [X[1], X[2], X[0]]), ref);
  // mêmes identités/valeurs, sources échangées : même vue
  assert.deepEqual(universValeurs([m('X', 1)], [x('M', 2)]), universValeurs([m('M', 2)], [x('X', 1)]));
});
test('I1. références : contenu = référence exacte, sortie neuve, entrées jamais mutées (profondément gelées)', () => {
  const resultat = { a: [1, { b: 2 }] };
  const Mi = gelProfond([m('M1', 'a')]);
  const Xi = gelProfond([x('X1', resultat)]);
  const r = universValeurs(Mi, Xi);
  assert.equal(r[1].contenu, Xi[0].resultat);
  assert.notEqual(r[1], Xi[0]);
  assert.notEqual(r[1].chemin, Xi[0].chemin);
  assert.notEqual(r, Mi);
  r.push(1); r[0].chemin.push('z');
  assert.deepEqual(Mi, [m('M1', 'a')]);
  assert.deepEqual(universValeurs(Mi, Xi).length, 2);
});
test('I2. deux appels : sorties distinctes, chemins distincts', () => {
  const a = universValeurs([m('M', 'a')], []);
  const b = universValeurs([m('M', 'a')], []);
  assert.notEqual(a, b); assert.notEqual(a[0], b[0]); assert.notEqual(a[0].chemin, b[0].chemin);
});
test('J1. DORMANT : D1/D2/D3 -> P fait émerger p="x" couvrant exactement D1 et D2, sans sélection préalable', () => {
  const vue = universValeurs([], [x('D3', { p: 'y', q: 3 }), x('D1', { p: 'x', q: 1 }), x('D2', { p: 'x', q: 2 })]);
  const constats = produireConstatsStructurels(vue);
  const c = constats.find((e) => e.constat.type === 'chaine' && e.constat.valeur === 'x' && JSON.stringify(e.constat.chemin) === JSON.stringify(['p']));
  assert.ok(c);
  assert.deepEqual([...c.couverture].map((p) => p[0]).sort(), ['D1', 'D2']);
  assert.equal(constats.filter((e) => e.constat.valeur === 'y').length, 1);
  assert.deepEqual(entrees(constats, 'y'), ['D3']);
});
function entrees(constats, valeur) {
  const c = constats.find((e) => e.constat.valeur === valeur);
  return c.couverture.map((p) => p[0]).sort();
}
test('J2. mélange messages + exécutions : le constat partagé couvre des identités des deux sources', () => {
  const vue = universValeurs([m('M1', 'bonjour')], [x('X1', 'bonjour'), x('X2', 'autre')]);
  const constats = produireConstatsStructurels(vue);
  const c = constats.find((e) => e.constat.valeur === 'bonjour');
  assert.deepEqual(c.couverture.map((p) => p[0]).sort(), ['M1', 'X1']);
});
test('K1. messages bruts : P ne trouve pas « Pixel » commun (chaînes atomiques)', () => {
  const vue = universValeurs([m('M1', 'bonjour Pixel'), m('M2', 'salut Pixel')], []);
  const constats = produireConstatsStructurels(vue);
  assert.ok(!constats.some((e) => JSON.stringify(e).includes('Pixel') && e.couverture.length === 2));
  assert.ok(!constats.some((e) => e.constat.valeur === 'Pixel'));
  assert.ok(constats.every((e) => e.couverture.length < 2 || e.constat.type !== 'chaine'));
});
test('L1. statique : aucun import, ni catalogue, ni tokenisation, ni appel de P, ni temps/magasin/async', () => {
  const code = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.ok(!/^\s*import\b/m.test(code));
  for (const nom of ['DESCRIPTIONS_OPERATIONS', 'productionsDecrites', 'groupesDeCandidats', 'applicationUnique', 'resoudreValeursApplication', 'TABLE_OPERATIONS',
    'tokeniser', 'decouper', 'decrireStructureIdentifiee', 'extraction', 'observationsLangage', 'produireConstatsStructurels', 'parcourirStructure',
    'horodatage', 'magasin', 'lireTout', 'ecrire', 'await', 'async', 'Date', 'nouvelId', 'idDesignation', 'operation', 'localStorage']) {
    assert.ok(!new RegExp(`\\b${nom}\\b`).test(code), nom);
  }
  assert.ok(!/\.(filter|find|slice|reduce)\(/.test(code));
});
test('M1. dormance : aucun fichier de app/ n\'importe univers-valeurs ; main/pont/observation ne le nomment pas', () => {
  const parcourir = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? parcourir(p) : [p]; });
  const racine = new URL('../app', import.meta.url).pathname;
  const fichiers = parcourir(racine).filter((p) => /\.(js|mjs)$/.test(p));
  const nommant = fichiers.filter((p) => /univers-valeurs|universValeurs/.test(readFileSync(p, 'utf8'))).map((p) => relative(racine, p));
  assert.deepEqual(nommant, ['langage/resoudre-identites.js', 'langage/univers-valeurs.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.48 : resoudre-identites.js (dormant) cite universValeurs dans un COMMENTAIRE (invariant d'unicité) ; il ne l'importe pas
});
test('N1. versions inchangées : VERSION_BASE 19, SCHEMA 9, TABLES 22, aucune table nouvelle', () => {
  assert.equal(VERSION_BASE, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.ok(!TABLES.some((t) => /univers|vue/i.test(t)));
});
