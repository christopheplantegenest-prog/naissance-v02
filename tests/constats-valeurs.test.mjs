// v0.63.29 — observateur de valeurs indépendant de la position (dormant). Preuves : regroupement par type + valeur, chemins conservés,
// multiplicité, couverture sans doublon, conteneurs et null ignorés, 7≠"7", 0≠-0, chaînes atomiques, comparaison avec le producteur de
// constats structurels, ordre canonique, dormance, aucune connaissance linguistique, versions inchangées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { produireConstatsValeurs } from '../app/langage/constats-valeurs.js';
import * as module from '../app/langage/constats-valeurs.js';
import { produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { universValeurs } from '../app/langage/univers-valeurs.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SRC = readFileSync(join(RACINE, 'app', 'langage', 'constats-valeurs.js'), 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const el = (id, contenu) => ({ chemin: [id], contenu });
const trouver = (r, type, valeur) => r.find((x) => x.constat.type === type && Object.is(x.constat.valeur, valeur));
const ids = (couverture) => couverture.map((c) => c[0]);
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };

test('A1. [] donne [] ; forme exacte { constat:{type,valeur}, occurrences:[{element,chemin}], couverture }', () => {
  assert.deepEqual(produireConstatsValeurs([]), []);
  const r = produireConstatsValeurs([el('D1', ['Pixel'])]);
  assert.equal(r.length, 1);
  assert.deepEqual(Object.keys(r[0]), ['constat', 'occurrences', 'couverture']);
  assert.deepEqual(Object.keys(r[0].constat), ['type', 'valeur']);
  assert.deepEqual(Object.keys(r[0].occurrences[0]), ['element', 'chemin']);
  assert.deepEqual(r, [{ constat: { type: 'chaine', valeur: 'Pixel' }, occurrences: [{ element: ['D1'], chemin: [0] }], couverture: [['D1']] }]);
});
test('A2. export unique ; fonction synchrone', () => {
  assert.deepEqual(Object.keys(module), ['produireConstatsValeurs']);
  assert.ok(Array.isArray(produireConstatsValeurs([])));
});
test('B1. TEST CENTRAL : Pixel déplacé ["je","vois","Pixel"] / ["Pixel","arrive"] / ["aucun","personnage"]', () => {
  const r = produireConstatsValeurs([el('D1', ['je', 'vois', 'Pixel']), el('D2', ['Pixel', 'arrive']), el('D3', ['aucun', 'personnage'])]);
  const p = trouver(r, 'chaine', 'Pixel');
  assert.ok(p);
  assert.deepEqual(ids(p.couverture), ['D1', 'D2']);
  assert.deepEqual(p.occurrences, [{ element: ['D1'], chemin: [2] }, { element: ['D2'], chemin: [0] }]);
  assert.ok(!p.couverture.some((c) => c[0] === 'D3'));
  assert.equal(r.length, 6);
});
test('B2. position identique ["bonjour","Pixel"] / ["salut","Pixel"] : un seul constat Pixel, occurrences [1] et [1]', () => {
  const r = produireConstatsValeurs([el('D1', ['bonjour', 'Pixel']), el('D2', ['salut', 'Pixel'])]);
  const p = r.filter((x) => x.constat.valeur === 'Pixel');
  assert.equal(p.length, 1);
  assert.deepEqual(ids(p[0].couverture), ['D1', 'D2']);
  assert.deepEqual(p[0].occurrences.map((o) => o.chemin), [[1], [1]]);
});
test('C1. COMPARAISON avec les constats structurels : déplacé = aucun Pixel partagé là, partagé ici', () => {
  const elements = [el('D1', ['je', 'vois', 'Pixel']), el('D2', ['Pixel', 'arrive'])];
  const structurels = produireConstatsStructurels(elements);
  assert.equal(structurels.some((x) => x.constat.valeur === 'Pixel' && x.couverture.length >= 2), false);
  const valeurs = produireConstatsValeurs(elements);
  assert.equal(trouver(valeurs, 'chaine', 'Pixel').couverture.length, 2);
  // position identique : les deux vues voient le fait partagé
  const memes = [el('D1', ['bonjour', 'Pixel']), el('D2', ['salut', 'Pixel'])];
  assert.equal(produireConstatsStructurels(memes).some((x) => x.constat.valeur === 'Pixel' && x.couverture.length === 2), true);
  assert.equal(trouver(produireConstatsValeurs(memes), 'chaine', 'Pixel').couverture.length, 2);
});
test('D1. multiplicité : ["Pixel","Pixel"] / ["Pixel"] : couverture {D1,D2}, 3 occurrences', () => {
  const r = produireConstatsValeurs([el('D2', ['Pixel']), el('D1', ['Pixel', 'Pixel'])]);
  const p = trouver(r, 'chaine', 'Pixel');
  assert.deepEqual(ids(p.couverture), ['D1', 'D2']);
  assert.deepEqual(p.occurrences, [{ element: ['D1'], chemin: [0] }, { element: ['D1'], chemin: [1] }, { element: ['D2'], chemin: [0] }]);
});
test('D2. même valeur à plusieurs profondeurs : {a:"Pixel", b:{c:"Pixel"}}', () => {
  const p = trouver(produireConstatsValeurs([el('D1', { a: 'Pixel', b: { c: 'Pixel' } })]), 'chaine', 'Pixel');
  assert.deepEqual(p.occurrences.map((o) => o.chemin), [['a'], ['b', 'c']]);
  assert.deepEqual(p.couverture, [['D1']]);
});
test('E1. conteneurs ignorés : aucun constat de type objet/tableau ; null ignoré (pas de valeur)', () => {
  const r = produireConstatsValeurs([el('D1', { a: [1, { b: null }], c: [] }), el('D2', null), el('D3', [])]);
  assert.deepEqual(r.map((x) => x.constat.type), ['nombre']);
  assert.ok(!r.some((x) => x.constat.valeur === null || x.constat.valeur === undefined));
  assert.ok(!r.some((x) => ['objet', 'tableau', 'nul'].includes(x.constat.type)));
  for (const x of r) assert.ok(Object.hasOwn(x.constat, 'valeur'));
});
test('E2. contenus sans occurrence de valeur : l\'élément reste une identité valide, aucun constat', () => {
  assert.deepEqual(produireConstatsValeurs([el('D1', []), el('D2', {}), el('D3', null)]), []);
});
test('F1. singletons conservés : ["Pixel"] / ["Lapin"] donne deux constats, aucun seuil', () => {
  const r = produireConstatsValeurs([el('D1', ['Pixel']), el('D2', ['Lapin'])]);
  assert.equal(r.length, 2);
  for (const x of r) assert.equal(x.couverture.length, 1);
});
test('G1. chaînes brutes : "je vois Pixel" / "Pixel arrive" donnent deux valeurs distinctes, aucun Pixel', () => {
  const r = produireConstatsValeurs([el('D1', 'je vois Pixel'), el('D2', 'Pixel arrive')]);
  assert.equal(r.length, 2);
  assert.equal(trouver(r, 'chaine', 'Pixel'), undefined);
  assert.deepEqual(r.map((x) => x.constat.valeur), ['je vois Pixel', 'Pixel arrive']);
  for (const x of r) assert.deepEqual(x.occurrences.map((o) => o.chemin), [[]]);
});
test('G2. aucune normalisation : casse, accents, blancs restent distincts', () => {
  const r = produireConstatsValeurs([el('D1', ['Pixel', 'pixel', 'PIXEL', 'é', 'e', ' a', 'a'])]);
  assert.equal(r.length, 7);
});
test('H1. types : 7 ≠ "7", true ≠ "true", false ≠ "false", 1 ≠ true', () => {
  const r = produireConstatsValeurs([el('D1', [7, '7', true, 'true', false, 'false', 1, 0, '']), el('D2', [7, true, 'true', 1])]);
  assert.equal(r.length, 9);
  assert.deepEqual(ids(trouver(r, 'nombre', 7).couverture), ['D1', 'D2']);
  assert.deepEqual(ids(trouver(r, 'chaine', '7').couverture), ['D1']);
  assert.deepEqual(ids(trouver(r, 'booleen', true).couverture), ['D1', 'D2']);
  assert.deepEqual(ids(trouver(r, 'chaine', 'true').couverture), ['D1', 'D2']);
  assert.deepEqual(ids(trouver(r, 'nombre', 1).couverture), ['D1', 'D2']);
  assert.deepEqual(ids(trouver(r, 'booleen', false).couverture), ['D1']);
});
test('H2. 0 et -0 : deux constats distincts (Object.is, comme les constats structurels)', () => {
  const r = produireConstatsValeurs([el('D1', [0, -0]), el('D2', [-0, 0, 0])]);
  assert.equal(r.length, 2);
  const zero = trouver(r, 'nombre', 0); const moinsZero = trouver(r, 'nombre', -0);
  assert.notEqual(zero, moinsZero);
  assert.deepEqual(zero.occurrences.map((o) => `${o.element[0]}${o.chemin[0]}`), ['D10', 'D21', 'D22']);
  assert.deepEqual(moinsZero.occurrences.map((o) => `${o.element[0]}${o.chemin[0]}`), ['D11', 'D20']);
  const sp = produireConstatsStructurels([el('D1', [0, -0])]).filter((x) => x.constat.type === 'nombre');
  assert.equal(sp.length, 2);
});
test('H3. nombres finis, flottants : 1.5 = 1.5, 1.5 ≠ 1.50000001', () => {
  const r = produireConstatsValeurs([el('D1', [1.5, 1.50000001]), el('D2', [1.5])]);
  assert.equal(trouver(r, 'nombre', 1.5).couverture.length, 2);
  assert.equal(r.length, 2);
});
test('I1. hétérogénéité : objets, tableaux, scalaires, imbrications, dans un même appel', () => {
  const r = produireConstatsValeurs([el('A', 'x'), el('B', ['x', { k: ['x', 1] }]), el('C', 3), el('D', { k: true })]);
  assert.deepEqual(ids(trouver(r, 'chaine', 'x').couverture), ['A', 'B']);
  assert.deepEqual(trouver(r, 'chaine', 'x').occurrences.map((o) => [o.element[0], o.chemin]), [['A', []], ['B', [0]], ['B', [1, 'k', 0]]]);
});
test('I2. accepte directement la sortie de la vue des valeurs persistées, sans adaptateur', () => {
  const vue = universValeurs([{ id: 'M1', valeur: 'bonjour' }], [{ id: 'X1', resultat: ['je', 'Pixel'] }, { id: 'X2', resultat: ['Pixel', 'x'] }]);
  const r = produireConstatsValeurs(vue);
  assert.deepEqual(ids(trouver(r, 'chaine', 'Pixel').couverture), ['X1', 'X2']);
  assert.deepEqual(ids(trouver(r, 'chaine', 'bonjour').couverture), ['M1']);
});
test('J1. identités : doublon = TypeError, jamais fusionné, même contenu ou non', () => {
  assert.throws(() => produireConstatsValeurs([el('D1', ['a']), el('D1', ['a'])]), TypeError);
  assert.throws(() => produireConstatsValeurs([el('D1', ['a']), el('D1', ['b'])]), TypeError);
  assert.doesNotThrow(() => produireConstatsValeurs([el('D1', ['a']), el('D2', ['a'])]));
});
test('J2. deux éléments distincts de même contenu : deux expériences, pas de déduplication par contenu', () => {
  const p = trouver(produireConstatsValeurs([el('D1', ['a']), el('D2', ['a'])]), 'chaine', 'a');
  assert.deepEqual(ids(p.couverture), ['D1', 'D2']);
  assert.equal(p.occurrences.length, 2);
});
test('J3. le chemin d\'identité ne participe pas au regroupement ; identité typée (0 ≠ "0")', () => {
  const r = produireConstatsValeurs([{ chemin: [0], contenu: ['a'] }, { chemin: ['0'], contenu: ['a'] }, { chemin: ['x', 1], contenu: ['a'] }]);
  const p = trouver(r, 'chaine', 'a');
  assert.equal(r.length, 1);
  assert.equal(p.couverture.length, 3);
});
test('K1. validation : entrée non tableau, élément invalide, accesseurs, champ absent, contenu hors domaine', () => {
  for (const mauvais of [null, undefined, {}, 'ab', 3]) assert.throws(() => produireConstatsValeurs(mauvais), TypeError);
  for (const e of [null, 3, 'x', [], undefined]) assert.throws(() => produireConstatsValeurs([e]), TypeError);
  assert.throws(() => produireConstatsValeurs([{ chemin: ['A'] }]), TypeError);
  assert.throws(() => produireConstatsValeurs([{ contenu: 'a' }]), TypeError);
  assert.throws(() => produireConstatsValeurs([Object.create({ chemin: ['A'], contenu: 'a' })]), TypeError);
  let exec = 0;
  const acc = { chemin: ['A'] }; Object.defineProperty(acc, 'contenu', { get() { exec += 1; return 'a'; }, enumerable: true });
  assert.throws(() => produireConstatsValeurs([acc]), TypeError);
  const acc2 = { contenu: 'a' }; Object.defineProperty(acc2, 'chemin', { get() { exec += 1; return ['A']; }, enumerable: true });
  assert.throws(() => produireConstatsValeurs([acc2]), TypeError);
  assert.equal(exec, 0);
  assert.throws(() => produireConstatsValeurs([, el('A', 'a')]), TypeError); // eslint-disable-line no-sparse-arrays
  for (const c of [undefined, NaN, Infinity, 1n, Symbol('s'), () => 1, new Date(0), new Map(), [1, , 3], [undefined], { a: undefined }]) {
    assert.throws(() => produireConstatsValeurs([el('A', c)]), TypeError);
  }
  assert.throws(() => produireConstatsValeurs([el('A', 'a'), el('B', NaN)]), TypeError); // tout ou rien
  for (const c of ['A', null, [{}], [undefined], [1.5]]) assert.throws(() => produireConstatsValeurs([{ chemin: c, contenu: 'a' }]), TypeError); // identité invalide : la validité appartient à la couverture
});
test('K2. équivalence du domaine avec parcourirStructure (accepté ici ⟺ accepté par le parcours)', () => {
  const cycle = {}; cycle.c = cycle;
  for (const c of [null, 'a', 0, -0, true, [], {}, [1, [2]], { a: { b: 'c' } }, undefined, NaN, cycle, [NaN], new Set(), { [Symbol('s')]: 1 }]) {
    let attendu = true; try { parcourirStructure(c); } catch { attendu = false; }
    let obtenu = true; try { produireConstatsValeurs([el('A', c)]); } catch { obtenu = false; }
    assert.equal(obtenu, attendu);
  }
});
test('L1. ordre sans sens : permutations des éléments, des clés et des tableaux d\'entrée donnent la même sortie', () => {
  const E = [el('D2', ['Pixel', 'arrive']), el('D1', ['je', 'vois', 'Pixel']), el('D3', ['aucun', 'Pixel', 'x']), el('A', { k: 'Pixel', j: 'vois' })];
  const ref = produireConstatsValeurs(E);
  assert.deepEqual(produireConstatsValeurs([...E].reverse()), ref);
  assert.deepEqual(produireConstatsValeurs([E[2], E[0], E[3], E[1]]), ref);
  assert.deepEqual(produireConstatsValeurs([el('D1', { b: 1, a: 1 })]), produireConstatsValeurs([el('D1', { a: 1, b: 1 })]));
  const p = trouver(ref, 'chaine', 'Pixel');
  assert.deepEqual(p.occurrences.map((o) => o.element[0]), ['A', 'D1', 'D2', 'D3']);
});
test('L2. ordre des constats = première rencontre en ordre canonique ; aucun tri par valeur, fréquence ou type', () => {
  const r = produireConstatsValeurs([el('B', ['z', 'z', 'z']), el('A', ['y', 'x'])]);
  assert.deepEqual(r.map((x) => x.constat.valeur), ['y', 'x', 'z']);
});
test('M1. aucune perte de position : on reconstruit où, dans quels éléments et combien de fois', () => {
  const r = produireConstatsValeurs([el('D1', ['Pixel', { a: 'Pixel' }, 'Pixel']), el('D2', ['x', 'Pixel'])]);
  const p = trouver(r, 'chaine', 'Pixel');
  const parElement = {};
  for (const o of p.occurrences) (parElement[o.element[0]] ||= []).push(o.chemin);
  assert.deepEqual(parElement, { D1: [[0], [1, 'a'], [2]], D2: [[1]] });
  assert.deepEqual(ids(p.couverture), ['D1', 'D2']);
});
test('N1. entrée jamais modifiée (profondément gelée) ; sortie neuve, indépendante de l\'entrée', () => {
  const entree = gelProfond([el('D1', ['Pixel', ['a']]), el('D2', ['Pixel'])]);
  const copie = JSON.stringify(entree);
  const r = produireConstatsValeurs(entree);
  assert.equal(JSON.stringify(entree), copie);
  r[0].occurrences[0].chemin.push('x'); r[0].occurrences[0].element.push('x'); r[0].couverture[0].push('x'); r[0].constat.valeur = 'z';
  assert.equal(JSON.stringify(entree), copie);
  const r2 = produireConstatsValeurs(entree);
  assert.notEqual(r2, r);
  assert.deepEqual(r2[0].occurrences[0].chemin, [0]);
  assert.deepEqual(r2[0].occurrences[0].element, ['D1']);
});
test('N2. les occurrences d\'un même constat ne partagent aucune structure entre elles', () => {
  const p = trouver(produireConstatsValeurs([el('D1', ['a', 'a'])]), 'chaine', 'a');
  assert.notEqual(p.occurrences[0].element, p.occurrences[1].element);
  assert.notEqual(p.occurrences[0].chemin, p.occurrences[1].chemin);
});
test('O1. complexité : 20 000 occurrences terminent vite, sans comparaison deux à deux', () => {
  const E = []; for (let i = 0; i < 2000; i += 1) E.push(el(`E${String(i).padStart(5, '0')}`, Array.from({ length: 10 }, (_, k) => `v${(i + k) % 500}`)));
  const t0 = Date.now();
  const r = produireConstatsValeurs(E);
  assert.equal(r.length, 500);
  assert.equal(r.reduce((n, x) => n + x.occurrences.length, 0), 20000);
  assert.ok(Date.now() - t0 < 5000);
});
test('P1. statique : imports exacts, aucune connaissance linguistique, aucun temps/magasin/async', () => {
  assert.deepEqual(CODE.match(/^\s*import\b.*$/gm), [
    'import { parcourirStructure } from \'./parcours-structure.js\';',
    'import { normaliserCouverture } from \'./couverture-occurrences.js\';',
    'import { resoudreCouverture } from \'./resolution-couverture.js\';',
  ]);
  for (const nom of ['tokeniser', 'decouper', 'repererMotifs', 'decrireStructureIdentifiee', 'extraction', 'induction', 'bagage', 'observationsLangage',
    'toLowerCase', 'toUpperCase', 'normalize', 'split', 'trim', 'RegExp', 'JSON', 'Date', 'horodatage', 'magasin', 'lireTout', 'ecrire', 'await', 'async', 'localStorage',
    'produireConstatsStructurels', 'universValeurs', 'DESCRIPTIONS_OPERATIONS', 'TABLE_OPERATIONS', 'score', 'seuil', 'frequence']) {
    assert.ok(!new RegExp(`\\b${nom}\\b`).test(CODE), nom);
  }
  assert.ok(!/\.sort\(|\.filter\(|\.slice\(/.test(CODE));
});
test('Q1. dormance : seul ce fichier nomme la primitive ; absente du catalogue et de la table ; inaccessible depuis main.js', () => {
  const parcourir = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? parcourir(p) : [p]; });
  const racine = join(RACINE, 'app');
  const nommant = parcourir(racine).filter((p) => /\.(js|mjs|html)$/.test(p)).filter((p) => /constats-valeurs|produireConstatsValeurs/.test(readFileSync(p, 'utf8'))).map((p) => relative(RACINE, p));
  assert.deepEqual(nommant, ['app/langage/constats-valeurs.js']);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 11); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 (symbolesDeChaine) ; la primitive de ce fichier reste absente du catalogue (assertions suivantes) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables)
  assert.ok(!DESCRIPTIONS_OPERATIONS.some((d) => /Valeurs$/.test(d.nom) && d.nom === 'produireConstatsValeurs'));
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 11); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 (symbolesDeChaine) ; la primitive de ce fichier reste absente de la table (assertion suivante)
  assert.ok(!('produireConstatsValeurs' in TABLE_OPERATIONS));
  const vus = new Set(); const pile = [join(racine, 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) pile.push(resolve(dirname(f), m[1] || m[2]));
  }
  assert.equal([...vus].some((f) => relative(RACINE, f) === 'app/langage/constats-valeurs.js'), false);
  const uv = readFileSync(join(racine, 'langage', 'univers-valeurs.js'), 'utf8');
  assert.ok(!/constats-valeurs|produireConstatsValeurs/.test(uv));
});
test('R1. versions inchangées : VERSION_BASE 19, SCHEMA 9, TABLES 22, aucune table nouvelle', () => {
  assert.equal(VERSION_BASE, 19);
  assert.equal(SCHEMA_SAUVEGARDE, 9);
  assert.equal(TABLES.length, 22);
  assert.ok(!TABLES.some((t) => /constats|valeurs-observ/i.test(t)));
});
