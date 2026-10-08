// === DEBUT_TEST_INVOCATION_OPERATIONS ===
// v0.63.18 — ÉTAPE 8, décision ChatGPT « INVOCATION MÉCANIQUE DES OPÉRATIONS DÉCRITES » (05/10/2026). Preuves que
// app/langage/invocation-operations.js appelle l'implémentation désignée par une TABLE FERMÉE selon sa convention JS (positionnel /
// objet), sans connaître aucune opération, sans choisir, sans avaler d'erreur, résultat brut par référence ; que
// app/langage/table-operations.js contient exactement les 9 opérations décrites, gelée, cohérente avec le catalogue (par TESTS, jamais
// par dépendance runtime) ; l'équivalence des 9 appels avec l'appel direct ; et que tout reste dormant.
// MISE À JOUR DÉLIBÉRÉE v0.63.38 (décision ChatGPT, 05/10/2026) : la table compte DIX opérations, symbolesDeChaine s'ajoute (appel
// positionnel, paramètre « chaine »). Gardes mises à jour : F1, F6, G11, H6 (dix noms, neuf modules importés) ; G13 prouve l'équivalence
// du nouvel appel avec l'appel direct. Aucune interdiction n'est affaiblie, aucun test n'est effacé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as module from '../app/langage/invocation-operations.js';
import * as moduleTable from '../app/langage/table-operations.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { couvrirSequence } from '../app/langage/sequence-plages.js';
import { decrireStructureIdentifiee } from '../app/langage/structure-identifiee.js';
import { decrireValeursObservees } from '../app/langage/valeurs-observees.js';
import { memesCouvertures, normaliserCouverture } from '../app/langage/couverture-occurrences.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { partagerCouvertures } from '../app/langage/partition-couvertures.js';
import { produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { resoudreCouverture } from '../app/langage/resolution-couverture.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';

const { invoquerOperation: inv } = module;
const { TABLE_OPERATIONS: TABLE } = moduleTable;
const RACINE = join(import.meta.dirname, '..');
const NOM = 'app/langage/invocation-operations.js';
const NOM_TABLE = 'app/langage/table-operations.js';
const SRC = readFileSync(join(RACINE, NOM), 'utf8');
const SRC_TABLE = readFileSync(join(RACINE, NOM_TABLE), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SRC);
const CODE_TABLE = sansCommentaires(SRC_TABLE);
const CODE_SANS_CHAINES = CODE.replace(/`[^`]*`|'[^']*'/g, "''");
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const piegeSur = (objet, champ) => { Object.defineProperty(objet, champ, { enumerable: true, get() { throw new Error(`accesseur ${String(champ)} exécuté`); } }); return objet; };
const entree = (fonction, appel, parametres) => ({ fonction, appel, parametres });
const NOMS_TABLE = ['composerCollection', 'couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'elementsObservables', 'memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'produireSuitesFermees', 'projeterChemins', 'projeterContenus', 'rechercherSousSuites', 'resoudreCouverture', 'resoudreElements', 'symbolesDeChaine']; // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements (après resoudreCouverture) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : + projeterContenus // MISE À JOUR DÉLIBÉRÉE v0.63.44 : + rechercherSousSuites // MISE À JOUR DÉLIBÉRÉE v0.63.67 : + composerCollection (avant couvrirSequence)

// ============================================================================ A. TABLES FACTICES : APPEL
test('A1. un seul export : invoquerOperation(table, nom, valeurs), trois paramètres', () => {
  assert.deepEqual(Object.keys(module), ['invoquerOperation']);
  assert.equal(inv.length, 3);
  assert.deepEqual(Object.keys(moduleTable), ['TABLE_OPERATIONS']);
});
test('A2. fonction à 1 argument, positionnel', () => {
  const t = { f: entree((x) => ['un', x], 'positionnel', ['x']) };
  assert.deepEqual(inv(t, 'f', { x: 5 }), ['un', 5]);
});
test('A3. fonction à 2 arguments : l\'ordre vient de parametres, jamais de valeurs', () => {
  const t = { g: entree((a, b) => [a, b], 'positionnel', ['a', 'b']) };
  assert.deepEqual(inv(t, 'g', { a: 1, b: 2 }), [1, 2]);
  assert.deepEqual(inv(t, 'g', { b: 2, a: 1 }), [1, 2]);
  const t2 = { g: entree((a, b) => [a, b], 'positionnel', ['b', 'a']) };
  assert.deepEqual(inv(t2, 'g', { a: 1, b: 2 }), [2, 1]);
});
test('A4. nombre exact d\'arguments transmis (arguments.length)', () => {
  const vu = [];
  const t = { f: entree(function () { vu.push(arguments.length); return 0; }, 'positionnel', ['a', 'b', 'c']) };
  inv(t, 'f', { a: 1, b: 2, c: 3 });
  assert.deepEqual(vu, [3]);
  const t0 = { f: entree(function () { vu.push(arguments.length); return 0; }, 'positionnel', []) };
  inv(t0, 'f', {});
  assert.deepEqual(vu, [3, 0]);
});
test('A5. appel objet : UN argument, objet neuf contenant exactement les paramètres', () => {
  const vus = [];
  const t = { o: entree(function (x) { vus.push([arguments.length, x]); return x; }, 'objet', ['elements', 'plages']) };
  const valeurs = { plages: 'P', elements: 'E' };
  const r = inv(t, 'o', valeurs);
  assert.equal(vus[0][0], 1);
  assert.deepEqual(r, { elements: 'E', plages: 'P' });
  assert.notEqual(r, valeurs);
  assert.deepEqual(Object.keys(r).sort(), ['elements', 'plages']);
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
  for (const k of Object.keys(r)) assert.equal('value' in Object.getOwnPropertyDescriptor(r, k), true);
});
test('A6. appel objet : valeurs n\'est jamais transmis ; un prototype exotique de valeurs ne fuit pas', () => {
  const t = { o: entree((x) => x, 'objet', ['a']) };
  const valeurs = Object.assign(Object.create(null), { a: 1 });
  const r = inv(t, 'o', valeurs);
  assert.notEqual(r, valeurs);
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
  assert.equal('toString' in valeurs, false);
});
test('A7. appel objet : l\'objet neuf est neuf à chaque appel', () => {
  const t = { o: entree((x) => x, 'objet', ['a']) };
  const v = { a: 1 };
  assert.notEqual(inv(t, 'o', v), inv(t, 'o', v));
});
test('A8. appel objet : paramètre nommé « __proto__ » ou « constructor » devient une propriété PROPRE de l\'objet neuf', () => {
  const t = { o: entree((x) => x, 'objet', ['__proto__', 'constructor']) };
  const valeurs = Object.create(null);
  Object.defineProperty(valeurs, '__proto__', { value: 1, enumerable: true });
  valeurs.constructor = 2;
  const r = inv(t, 'o', valeurs);
  assert.equal(Object.getOwnPropertyDescriptor(r, '__proto__').value, 1);
  assert.equal(Object.getOwnPropertyDescriptor(r, 'constructor').value, 2);
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
});
test('A9. résultat objet / tableau : MÊME référence ; undefined → undefined ; null → null ; fonction, symbole, 0, -0, NaN', () => {
  const o = { a: 1 }; const tab = [1];
  const t = (r) => ({ f: entree(() => r, 'positionnel', []) });
  assert.equal(inv(t(o), 'f', {}), o);
  assert.equal(inv(t(tab), 'f', {}), tab);
  assert.equal(inv(t(undefined), 'f', {}), undefined);
  assert.equal(inv(t(null), 'f', {}), null);
  assert.equal(Object.is(inv(t(-0), 'f', {}), -0), true);
  assert.equal(Number.isNaN(inv(t(NaN), 'f', {})), true);
  const s = Symbol('s'); assert.equal(inv(t(s), 'f', {}), s);
  const fn = () => 1; assert.equal(inv(t(fn), 'f', {}), fn);
  assert.equal(Object.isFrozen(o), false);
});
test('A10. les valeurs passées sont transmises par référence (aucune copie en entrée)', () => {
  const E = [1]; let vu;
  const t = { f: entree((x) => { vu = x; return 0; }, 'positionnel', ['x']) };
  inv(t, 'f', { x: E });
  assert.equal(vu, E);
});
test('A11. fonction appelée sans this (undefined en mode strict) et une seule fois', () => {
  let n = 0; let ce = 'jamais';
  const t = { f: entree(function () { 'use strict'; n += 1; ce = this; return 1; }, 'positionnel', []) };
  inv(t, 'f', {});
  assert.equal(n, 1); assert.equal(ce, undefined);
});

// ============================================================================ B. ERREURS DE L'OPÉRATION
test('B1. une fonction qui lève : EXACTEMENT la même erreur se propage (identité, pas de message modifié)', () => {
  const sentinelle = new RangeError('sentinelle');
  const t = { f: entree(() => { throw sentinelle; }, 'positionnel', []) };
  let attrapee;
  try { inv(t, 'f', {}); } catch (e) { attrapee = e; }
  assert.equal(attrapee, sentinelle);
  const tt = new TypeError('type'); const t2 = { f: entree(() => { throw tt; }, 'objet', ['a']) };
  try { inv(t2, 'f', { a: 1 }); assert.fail(); } catch (e) { assert.equal(e, tt); }
  for (const bizarre of [42, 'chaine', null, undefined, { x: 1 }]) {
    const t3 = { f: entree(() => { throw bizarre; }, 'positionnel', []) };
    try { inv(t3, 'f', {}); assert.fail(); } catch (e) { assert.equal(e, bizarre); }
  }
});
test('B2. aucune enveloppe : pas de try/catch ni de classe d\'erreur dans la primitive', () => {
  assert.equal(/\btry\b|\bcatch\b|\bfinally\b|class\s+\w+\s+extends|new\s+(?!TypeError\b)\w*Error/.test(CODE_SANS_CHAINES), false);
});

// ============================================================================ C. NOM
test('C1. opération inconnue / nom invalide : TypeError', () => {
  const t = { f: entree(() => 1, 'positionnel', []) };
  refuse(() => inv(t, 'g', {}), /pas de champ/);
  for (const mauvais of [undefined, null, 1, '', {}, [], Symbol('f'), new String('f')]) refuse(() => inv(t, mauvais, {}), /chaîne non vide/);
});
test('C2. noms dangereux : __proto__, constructor, toString, hasOwnProperty, valueOf, prototype : inconnus (propriété propre de donnée seulement)', () => {
  const t = { f: entree(() => 1, 'positionnel', []) };
  for (const nom of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 'prototype', 'isPrototypeOf', '__defineGetter__']) {
    refuse(() => inv(t, nom, {}), /pas de champ/);
    refuse(() => inv(TABLE, nom, {}), /pas de champ/);
  }
  refuse(() => inv(Object.create({ f: entree(() => 1, 'positionnel', []) }), 'f', {}), /pas de champ/);
});
test('C3. entrée de table accesseur : refusée sans exécution', () => {
  refuse(() => inv(piegeSur({}, 'f'), 'f', {}), /accesseur/);
});
test('C4. table invalide : null, tableau, primitive', () => {
  for (const mauvais of [null, undefined, [], 'f', 1]) refuse(() => inv(mauvais, 'f', {}), /table doit être un objet/);
});
test('C5. nom propre « __proto__ » dans une table factice : sélectionné comme propriété propre', () => {
  const t = JSON.parse('{"__proto__": {"fonction": null}}');
  refuse(() => inv(t, '__proto__', {}), /appelable/);
  const t2 = Object.create(null); Object.defineProperty(t2, '__proto__', { value: entree(() => 'ok', 'positionnel', []), enumerable: true });
  assert.equal(inv(t2, '__proto__', {}), 'ok');
});

// ============================================================================ D. VALIDATION DE L'ENTRÉE DE TABLE
test('D1. entrée non objet : TypeError', () => {
  for (const mauvais of [null, undefined, 1, 'f', [], () => 1]) refuse(() => inv({ f: mauvais }, 'f', {}), /entrée de table doit être un objet/);
});
test('D2. fonction absente ou non appelable : TypeError', () => {
  refuse(() => inv({ f: { appel: 'positionnel', parametres: [] } }, 'f', {}), /pas de champ/);
  for (const mauvais of [undefined, null, 'f', 1, {}, [], Symbol('f')]) refuse(() => inv({ f: entree(mauvais, 'positionnel', []) }, 'f', {}), /appelable/);
  refuse(() => inv({ f: entree(class A {}, 'positionnel', []) }, 'f', {}), /./); // une classe lève à l'appel : erreur de la fonction, pas masquée
});
test('D3. appel absent ou inconnu : TypeError', () => {
  refuse(() => inv({ f: { fonction: () => 1, parametres: [] } }, 'f', {}), /pas de champ/);
  for (const mauvais of ['Positionnel', 'objets', 'positional', '', undefined, null, 1, ['objet']]) refuse(() => inv({ f: entree(() => 1, mauvais, []) }, 'f', {}), /appel inconnu/);
});
test('D4. parametres : absent, non tableau, élément vide / non chaîne / doublon / creux : TypeError', () => {
  refuse(() => inv({ f: { fonction: () => 1, appel: 'positionnel' } }, 'f', {}), /pas de champ/);
  for (const mauvais of [undefined, null, 'a', { 0: 'a', length: 1 }, 1]) refuse(() => inv({ f: entree(() => 1, 'positionnel', mauvais) }, 'f', {}), /tableau/);
  for (const mauvais of [[''], [1], [null], [undefined], [['a']], [Symbol('a')], [new String('a')]]) refuse(() => inv({ f: entree(() => 1, 'positionnel', mauvais) }, 'f', {}), /chaîne non vide/);
  refuse(() => inv({ f: entree(() => 1, 'positionnel', ['a', 'a']) }, 'f', { a: 1 }), /doublon/);
  const creux = []; creux.length = 1;
  refuse(() => inv({ f: entree(() => 1, 'positionnel', creux) }, 'f', {}), /pas de champ/);
});
test('D5. entrée de table avec accesseurs (fonction, appel, parametres) : refusés sans exécution', () => {
  for (const champ of ['fonction', 'appel', 'parametres']) {
    const e = entree(() => 1, 'positionnel', []); delete e[champ]; piegeSur(e, champ);
    refuse(() => inv({ f: e }, 'f', {}), /accesseur/);
  }
});
test('D6. éléments de parametres en accesseur : refusés sans exécution', () => {
  const p = ['a']; Object.defineProperty(p, 0, { get() { throw new Error('exécuté'); } });
  refuse(() => inv({ f: entree(() => 1, 'positionnel', p) }, 'f', { a: 1 }), /accesseur/);
});
test('D7. clés additionnelles dans l\'entrée de table : ignorées sans effet (aucune politique lue)', () => {
  const e = { ...entree((x) => x, 'positionnel', ['x']), priorite: 9, score: 1, description: 'x' };
  assert.equal(inv({ f: e }, 'f', { x: 3 }), 3);
});
test('D8. la validation de la table précède tout appel et toute lecture de valeurs', () => {
  let appels = 0;
  const e = entree(() => { appels += 1; }, 'positionnel', ['a', 'a']);
  refuse(() => inv({ f: e }, 'f', piegeSur({}, 'a')), /doublon/);
  assert.equal(appels, 0);
});

// ============================================================================ E. VALEURS
test('E1. valeurs invalides : null, undefined, tableau, primitive, fonction', () => {
  const t = { f: entree(() => 1, 'positionnel', []) };
  for (const mauvais of [null, undefined, [], 'a', 1, () => 1]) refuse(() => inv(t, 'f', mauvais), /valeurs doit être un objet/);
  refuse(() => inv(t, 'f'), /valeurs doit être un objet/);
});
test('E2. paramètre manquant : TypeError AVANT appel', () => {
  let appels = 0;
  const t = { g: entree(() => { appels += 1; }, 'positionnel', ['a', 'b']), o: entree(() => { appels += 1; }, 'objet', ['a', 'b']) };
  refuse(() => inv(t, 'g', { a: 1 }), /pas de champ « b »/);
  refuse(() => inv(t, 'g', {}), /pas de champ/);
  refuse(() => inv(t, 'o', { b: 1 }), /pas de champ « a »/);
  assert.equal(appels, 0);
});
test('E3. paramètre étranger : TypeError AVANT appel (positionnel et objet)', () => {
  let appels = 0;
  const t = { g: entree(() => { appels += 1; }, 'positionnel', ['a']), o: entree(() => { appels += 1; }, 'objet', ['a']) };
  refuse(() => inv(t, 'g', { a: 1, x: 2 }), /étrangère/);
  refuse(() => inv(t, 'o', { a: 1, x: 2 }), /étrangère/);
  refuse(() => inv(t, 'g', { x: 2 }), /étrangère/);
  assert.equal(appels, 0);
});
test('E4. symbole étranger et non-énumérable étranger : TypeError', () => {
  let appels = 0;
  const t = { g: entree(() => { appels += 1; }, 'positionnel', ['a']) };
  refuse(() => inv(t, 'g', { a: 1, [Symbol('s')]: 2 }), /étrangère/);
  const ne = { a: 1 }; Object.defineProperty(ne, 'cache', { value: 1, enumerable: false });
  refuse(() => inv(t, 'g', ne), /étrangère/);
  const nes = { a: 1 }; Object.defineProperty(nes, Symbol('c'), { value: 1, enumerable: false });
  refuse(() => inv(t, 'g', nes), /étrangère/);
  assert.equal(appels, 0);
});
test('E5. symbole comme clé attendue impossible (parametres = chaînes) ; une clé étrangère n\'est PAS lue (getter étranger non exécuté)', () => {
  const t = { g: entree(() => 1, 'positionnel', ['a']) };
  refuse(() => inv(t, 'g', piegeSur({ a: 1 }, 'etranger')), /étrangère/);
  const sym = {}; Object.defineProperty(sym, Symbol('x'), { get() { throw new Error('exécuté'); }, enumerable: true });
  sym.a = 1;
  refuse(() => inv(t, 'g', sym), /étrangère/);
});
test('E6. undefined PRÉSENT : transmis (présent) ; absent : TypeError', () => {
  const vus = [];
  const t = { g: entree(function (a, b) { vus.push([arguments.length, a, b]); return 0; }, 'positionnel', ['a', 'b']), o: entree((x) => x, 'objet', ['a']) };
  inv(t, 'g', { a: undefined, b: 2 });
  assert.deepEqual(vus, [[2, undefined, 2]]);
  const r = inv(t, 'o', { a: undefined });
  assert.equal(Object.hasOwn(r, 'a'), true);
  assert.equal(r.a, undefined);
  refuse(() => inv(t, 'g', { b: 2 }), /pas de champ « a »/);
  refuse(() => inv(t, 'o', {}), /pas de champ/);
});
test('E7. getter sur un paramètre attendu : TypeError SANS exécution (positionnel et objet)', () => {
  const t = { g: entree(() => 1, 'positionnel', ['a']), o: entree(() => 1, 'objet', ['a']) };
  refuse(() => inv(t, 'g', piegeSur({}, 'a')), /accesseur/);
  refuse(() => inv(t, 'o', piegeSur({}, 'a')), /accesseur/);
  const so = {}; Object.defineProperty(so, 'a', { set() { throw new Error('s'); }, enumerable: true });
  refuse(() => inv(t, 'g', so), /accesseur/);
});
test('E8. propriété héritée = absente (paramètre attendu hérité : TypeError ; prototype Object.prototype)', () => {
  const t = { g: entree(() => 1, 'positionnel', ['a']), h: entree(() => 1, 'positionnel', ['toString']) };
  refuse(() => inv(t, 'g', Object.create({ a: 1 })), /pas de champ/);
  refuse(() => inv(t, 'h', {}), /pas de champ/);
  assert.equal(inv(t, 'h', { toString: 5 }), 1);
});
test('E9. valeurs sans prototype acceptées ; valeurs gelées acceptées ; non mutées', () => {
  const t = { g: entree((a) => a, 'positionnel', ['a']) };
  assert.equal(inv(t, 'g', Object.assign(Object.create(null), { a: 7 })), 7);
  const gele = Object.freeze({ a: [1] });
  assert.deepEqual(inv(t, 'g', gele), [1]);
  assert.deepEqual(Object.keys(gele), ['a']);
});
test('E10. clés inhabituelles comme paramètres (unicode, espace, numérique, longue)', () => {
  for (const k of ['é', 'a b', '0', '😀', 'x'.repeat(2000)]) {
    const t = { f: entree((v) => v, 'positionnel', [k]), o: entree((v) => v[k], 'objet', [k]) };
    const v = {}; Object.defineProperty(v, k, { value: k + '!', enumerable: true });
    assert.equal(inv(t, 'f', v), k + '!');
    assert.equal(inv(t, 'o', v), k + '!');
  }
});
test('E11. lecture de valeurs uniquement par descripteur : espion sur valeurs, jamais de get', () => {
  const j = [];
  const v = new Proxy({ a: 1, b: 2 }, {
    getOwnPropertyDescriptor(c, k) { j.push(`desc:${String(k)}`); return Reflect.getOwnPropertyDescriptor(c, k); },
    get(c, k, r) { j.push(`get:${String(k)}`); return Reflect.get(c, k, r); },
    ownKeys(c) { j.push('ownKeys'); return Reflect.ownKeys(c); },
  });
  const t = { g: entree((a, b) => [a, b], 'positionnel', ['b', 'a']) };
  assert.deepEqual(inv(t, 'g', v), [2, 1]);
  assert.equal(j.some((l) => l.startsWith('get:')), false, j.join(' | '));
  assert.equal(j[0], 'ownKeys');
});
test('E12. une clé étrangère est refusée AVANT toute lecture d\'une valeur attendue', () => {
  const j = [];
  const v = new Proxy({ a: 1, x: 2 }, {
    getOwnPropertyDescriptor(c, k) { j.push(`desc:${String(k)}`); return Reflect.getOwnPropertyDescriptor(c, k); },
  });
  const t = { g: entree(() => 1, 'positionnel', ['a']) };
  refuse(() => inv(t, 'g', v), /étrangère/);
  assert.deepEqual(j, []);
});

// ============================================================================ F. TABLE RÉELLE : FORME ET COHÉRENCE
test('F1. la table contient EXACTEMENT les 10 noms, ordre code-unit, relationsParentEnfant ABSENTE', () => {
  assert.deepEqual(Object.keys(TABLE), NOMS_TABLE);
  assert.deepEqual(Object.keys(TABLE), [...Object.keys(TABLE)].sort());
  assert.equal(Object.hasOwn(TABLE, 'relationsParentEnfant'), false);
  refuse(() => inv(TABLE, 'relationsParentEnfant', { univers: [] }), /pas de champ/);
});
test('F2. noms de la table === noms des descriptions (ensemble égal, rien en trop ni en moins)', () => {
  assert.deepEqual([...Object.keys(TABLE)].sort(), DESCRIPTIONS_OPERATIONS.map((d) => d.nom).sort());
});
test('F3. pour chaque nom : ensemble(parametres) === ensemble(clés de description.entrees), sans doublon ni nom vide', () => {
  for (const d of DESCRIPTIONS_OPERATIONS) {
    const p = TABLE[d.nom].parametres;
    assert.equal(new Set(p).size, p.length, d.nom);
    for (const n of p) assert.equal(typeof n === 'string' && n.length > 0, true, d.nom);
    assert.deepEqual([...p].sort(), Object.keys(d.entrees).sort(), d.nom);
  }
});
test('F4. fonction.name === nom ; positionnel : length === parametres.length ; objet : length === 1', () => {
  for (const nom of NOMS_TABLE) {
    const e = TABLE[nom];
    assert.equal(typeof e.fonction, 'function', nom);
    assert.equal(e.fonction.name, nom);
    if (e.appel === 'positionnel') assert.equal(e.fonction.length, e.parametres.length, nom);
    else assert.equal(e.fonction.length, 1, nom);
  }
});
test('F5. exactement trois clés par entrée ; appel reconnu ; couvrirSequence seule en objet', () => {
  for (const nom of NOMS_TABLE) {
    assert.deepEqual(Object.keys(TABLE[nom]), ['fonction', 'appel', 'parametres'], nom);
    assert.equal(['positionnel', 'objet'].includes(TABLE[nom].appel), true);
  }
  assert.deepEqual(NOMS_TABLE.filter((n) => TABLE[n].appel === 'objet'), ['couvrirSequence']);
});
test('F6. liste exacte des 10 entrées demandées (appel + parametres + fonction)', () => {
  const attendu = {
    couvrirSequence: ['objet', ['elements', 'plages'], couvrirSequence],
    decrireStructureIdentifiee: ['positionnel', ['elements'], decrireStructureIdentifiee],
    decrireValeursObservees: ['positionnel', ['paires'], decrireValeursObservees],
    memesCouvertures: ['positionnel', ['a', 'b'], memesCouvertures],
    normaliserCouverture: ['positionnel', ['chemins'], normaliserCouverture],
    parcourirStructure: ['positionnel', ['valeur'], parcourirStructure],
    partagerCouvertures: ['positionnel', ['a', 'b'], partagerCouvertures],
    produireConstatsStructurels: ['positionnel', ['elements'], produireConstatsStructurels],
    resoudreCouverture: ['positionnel', ['univers', 'couverture'], resoudreCouverture],
    symbolesDeChaine: ['positionnel', ['chaine'], symbolesDeChaine], // MISE À JOUR DÉLIBÉRÉE v0.63.38
  };
  for (const [nom, [appel, parametres, fonction]] of Object.entries(attendu)) {
    assert.equal(TABLE[nom].appel, appel, nom);
    assert.deepEqual(TABLE[nom].parametres, parametres, nom);
    assert.equal(TABLE[nom].fonction, fonction, nom);
  }
});
test('F7. table, entrées et parametres gelés en profondeur ; écriture refusée', () => {
  assert.equal(Object.isFrozen(TABLE), true);
  for (const nom of NOMS_TABLE) {
    assert.equal(Object.isFrozen(TABLE[nom]), true, nom);
    assert.equal(Object.isFrozen(TABLE[nom].parametres), true, nom);
  }
  assert.throws(() => { 'use strict'; TABLE.parcourirStructure.appel = 'objet'; }, TypeError);
  assert.throws(() => { 'use strict'; TABLE.resoudreCouverture.parametres.reverse(); }, TypeError);
  assert.throws(() => { 'use strict'; TABLE.nouvelle = {}; }, TypeError);
});
test('F8. la table ne contient aucune information de décision ni forme : JSON des entrées = seulement appel + parametres', () => {
  for (const nom of NOMS_TABLE) {
    const clair = JSON.parse(JSON.stringify(TABLE[nom]));
    assert.deepEqual(Object.keys(clair).sort(), ['appel', 'parametres']);
  }
  assert.equal(/priorite|priorité|score|pertinence|preference|préférence|condition|libelle|rôle|role|sortie|forme\b|nullab/i.test(CODE_TABLE), false);
});
test('F9. la description n\'a reçu ni fonction, ni module, ni convention JS', () => {
  const texte = JSON.stringify(DESCRIPTIONS_OPERATIONS);
  assert.equal(/fonction|appel|parametres|positionnel|invoquer/.test(texte), false);
  for (const d of DESCRIPTIONS_OPERATIONS) assert.deepEqual(Object.keys(d), ['couvrirSequence', 'resoudreCouverture', 'resoudreElements'].includes(d.nom) ? ['nom', 'entrees', 'relations', 'sortie'] : ['nom', 'entrees', 'sortie']); // MISE À JOUR DÉLIBÉRÉE v0.63.61 : clé facultative `relations` (trois opérations), données pures
  const src = readFileSync(join(RACINE, 'app', 'langage', 'descriptions-operations.js'), 'utf8');
  assert.equal(/table-operations|invocation-operations|TABLE_OPERATIONS|invoquerOperation/.test(src), false);
});

// ============================================================================ G. ÉQUIVALENCE DES 10 (invocateur = appel direct littéral)
const E_STRUCT = [{ id: 'a', texte: 'x' }, { id: 'b', texte: 'y' }];
const UNIVERS = [{ chemin: [0] }, { chemin: [1] }, { chemin: [2] }];
test('G1. couvrirSequence (objet)', () => {
  const elements = ['x', 'y', 'z']; const plages = [{ debut: 0, longueur: 2, etiquette: 'A' }, { debut: 1, longueur: 2, etiquette: null }];
  assert.deepEqual(inv(TABLE, 'couvrirSequence', { elements, plages }), couvrirSequence({ elements, plages }));
  assert.deepEqual(inv(TABLE, 'couvrirSequence', { plages, elements }), couvrirSequence({ elements, plages }));
  assert.equal(inv(TABLE, 'couvrirSequence', { elements, plages }).length, 3);
});
test('G2. decrireStructureIdentifiee', () => {
  assert.deepEqual(inv(TABLE, 'decrireStructureIdentifiee', { elements: E_STRUCT }), decrireStructureIdentifiee(E_STRUCT));
});
test('G3. decrireValeursObservees (undefined présent dans les paires conservé)', () => {
  const paires = [{ id: 'a', valeur: 1 }, { id: 'b', valeur: null }, { id: 'c', valeur: undefined }];
  assert.deepEqual(inv(TABLE, 'decrireValeursObservees', { paires }), decrireValeursObservees(paires));
});
test('G4. memesCouvertures : sensible à l\'ordre des paramètres, indépendant de l\'ordre des propriétés', () => {
  const A = [[0], [1]]; const B = [[1]];
  assert.equal(inv(TABLE, 'memesCouvertures', { a: A, b: A }), true);
  assert.equal(inv(TABLE, 'memesCouvertures', { a: A, b: B }), memesCouvertures(A, B));
  assert.equal(inv(TABLE, 'memesCouvertures', { b: B, a: A }), memesCouvertures(A, B));
  assert.equal(inv(TABLE, 'memesCouvertures', { a: A, b: B }), false);
});
test('G5. normaliserCouverture', () => {
  const chemins = [[1], [0], [0, 1]];
  assert.deepEqual(inv(TABLE, 'normaliserCouverture', { chemins }), normaliserCouverture(chemins));
});
test('G6. parcourirStructure (cas de référence : \'Bonjour\')', () => {
  assert.deepEqual(inv(TABLE, 'parcourirStructure', { valeur: 'Bonjour' }), parcourirStructure('Bonjour'));
  assert.deepEqual(inv(TABLE, 'parcourirStructure', { valeur: 'Bonjour' }), [{ chemin: [], type: 'chaine', valeur: 'Bonjour' }]);
  const objet = { a: [1, 'b'], c: null };
  assert.deepEqual(inv(TABLE, 'parcourirStructure', { valeur: objet }), parcourirStructure(objet));
  refuse(() => inv(TABLE, 'parcourirStructure', { valeur: undefined }), /undefined/); // l'opération juge ; l'invocateur transmet
});
test('G7. partagerCouvertures : positionnel, asymétrique (seulementA / seulementB), deux ordres de propriétés', () => {
  const A = [[0], [1]]; const B = [[1], [2]];
  const direct = partagerCouvertures(A, B);
  assert.deepEqual(inv(TABLE, 'partagerCouvertures', { a: A, b: B }), direct);
  assert.deepEqual(inv(TABLE, 'partagerCouvertures', { b: B, a: A }), direct);
  assert.notDeepEqual(inv(TABLE, 'partagerCouvertures', { a: B, b: A }), direct);
  assert.deepEqual(direct.seulementA, [[0]]);
  assert.deepEqual(direct.seulementB, [[2]]);
});
test('G8. produireConstatsStructurels', () => {
  const elements = [{ chemin: [0], contenu: 'x' }, { chemin: [1], contenu: null }];
  assert.deepEqual(inv(TABLE, 'produireConstatsStructurels', { elements }), produireConstatsStructurels(elements));
});
test('G9. resoudreCouverture : un test capable de tuer une permutation des paramètres', () => {
  const couverture = [[2], [0]];
  const direct = resoudreCouverture(UNIVERS, couverture);
  assert.deepEqual(direct, [{ chemin: [0] }, { chemin: [2] }]);
  assert.deepEqual(inv(TABLE, 'resoudreCouverture', { univers: UNIVERS, couverture }), direct);
  assert.deepEqual(inv(TABLE, 'resoudreCouverture', { couverture, univers: UNIVERS }), direct);
  // permutation (couverture, univers) : l'opération refuse ou rend autre chose, jamais l'équivalent
  const permute = { fonction: TABLE.resoudreCouverture.fonction, appel: 'positionnel', parametres: ['couverture', 'univers'] };
  let rendu; try { rendu = inv({ resoudreCouverture: permute }, 'resoudreCouverture', { univers: UNIVERS, couverture }); } catch (e) { rendu = e; }
  assert.notDeepEqual(rendu, direct);
});
test('G10. couvrirSequence : une permutation des clés de l\'objet ne change rien ; une entrée étrangère est refusée (la fonction l\'ignorerait)', () => {
  assert.deepEqual(couvrirSequence({ elements: [], plages: [], x: 1 }), []); // la fonction ignore le champ étranger : seul l'invocateur protège
  refuse(() => inv(TABLE, 'couvrirSequence', { elements: [], plages: [], x: 1 }), /étrangère/);
  assert.deepEqual(parcourirStructure('Bonjour', 42), parcourirStructure('Bonjour')); // idem pour un argument en trop
  refuse(() => inv(TABLE, 'parcourirStructure', { valeur: 'Bonjour', extra: 42 }), /étrangère/);
});
test('G11. les 10 passent par le MÊME code : aucune branche par nom, résultat bien appelé une fois par invocation', () => {
  let n = 0;
  const comptee = (f) => (...a) => { n += 1; return f(...a); };
  const t = Object.fromEntries(NOMS_TABLE.map((nom) => [nom, { ...TABLE[nom], fonction: comptee(TABLE[nom].fonction) }]));
  inv(t, 'parcourirStructure', { valeur: 'x' });
  inv(t, 'memesCouvertures', { a: [], b: [] });
  inv(t, 'couvrirSequence', { elements: [], plages: [] });
  assert.equal(n, 3);
});
test('G12. les erreurs de l\'opération réelle se propagent telles quelles', () => {
  let erreurDirecte; try { couvrirSequence({ elements: 1, plages: [] }); } catch (e) { erreurDirecte = e; }
  let erreurInvoquee; try { inv(TABLE, 'couvrirSequence', { elements: 1, plages: [] }); } catch (e) { erreurInvoquee = e; }
  assert.equal(erreurInvoquee instanceof TypeError, true);
  assert.equal(erreurInvoquee.message, erreurDirecte.message);
});
test('G13. symbolesDeChaine (v0.63.38) : positionnel, un paramètre « chaine » ; résultat identique à l\'appel direct, symboles rendus par la fonction elle-même ; un argument étranger et une entrée non chaîne sont refusés', () => {
  for (const chaine of ['', 'ab c', 'a\u{1F600}e\u0301\uD800']) {
    assert.deepEqual(inv(TABLE, 'symbolesDeChaine', { chaine }), symbolesDeChaine(chaine), JSON.stringify(chaine));
  }
  assert.deepEqual(inv(TABLE, 'symbolesDeChaine', { chaine: 'a\u{1F600}' }), ['a', '\u{1F600}']);
  refuse(() => inv(TABLE, 'symbolesDeChaine', { chaine: 'x', extra: 1 }), /étrangère/);
  refuse(() => inv(TABLE, 'symbolesDeChaine', { chaine: 42 }), /chaîne est attendue/); // l'opération juge ; l'invocateur transmet
});
test('G13. entrées non mutées par l\'invocation (valeurs réelles)', () => {
  const elements = [{ chemin: [0], contenu: { a: 1 } }];
  const avant = JSON.stringify(elements);
  inv(TABLE, 'produireConstatsStructurels', { elements });
  assert.equal(JSON.stringify(elements), avant);
});

// ============================================================================ H. STATIQUE / SÉCURITÉ / DORMANCE
test('H1. la primitive n\'importe RIEN ; n\'est ni async ni dynamique ; aucun nom d\'opération, forme, message, trace', () => {
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function invoquerOperation(table, nom, valeurs) {']);
  assert.equal(/^\s*import\b/m.test(CODE), false);
  assert.equal(/\bawait\b|\basync\b|\bimport\s*\(/.test(CODE), false);
  for (const nom of NOMS_TABLE) assert.equal(CODE.includes(nom), false, nom);
  assert.equal(/relationsParentEnfant|DESCRIPTIONS_OPERATIONS|descriptions-operations|formes-operation|message|trace|possibilit|catalogue|score|priorité|priorit/i.test(CODE), false);
});
test('H2. sécurité du nom : ni eval, ni Function, ni import construit, ni namespace, ni Reflect.get / accès par crochets sur le nom', () => {
  assert.equal(/\beval\b|new\s+Function|\bFunction\s*\(|import\s*\(|import\s+\*|require\s*\(|globalThis|window|self\./.test(CODE), false);
  assert.equal(/Reflect\.(get|apply|construct)\b|\.call\(|\.apply\(|\.bind\(|\bwith\b/.test(CODE), false);
  assert.equal(/table\[|valeurs\[|entree\[|nom\]/.test(CODE_SANS_CHAINES), false);
  assert.equal(/\bin\s+(table|entree|valeurs)\b|hasOwnProperty|\.hasOwn\b/.test(CODE_SANS_CHAINES), false);
});
test('H3. aucune copie / sérialisation / normalisation / validation de sortie dans la primitive', () => {
  assert.equal(/JSON\.|structuredClone|\.trim\(|\.slice\(|Object\.assign|\?\?|\?\.|resultat|sortie/.test(CODE_SANS_CHAINES), false);
  assert.equal(/\.\.\.(?!lues)/.test(CODE_SANS_CHAINES), false);
});
test('H4. lectures par descripteur uniquement ; clés étrangères via Reflect.ownKeys', () => {
  assert.match(CODE, /Object\.getOwnPropertyDescriptor\(objet, champ\)/);
  assert.match(CODE, /Reflect\.ownKeys\(valeurs\)/);
  assert.equal(CODE.split('Object.getOwnPropertyDescriptor').length - 1, 1);
});
test('H5. ordre dans le source : validation de la table, puis valeurs / étrangères, puis lecture des paramètres, puis appel unique', () => {
  const i = (s) => CODE.indexOf(s);
  assert.ok(i("lireChampPropre(table, nom, 'table')") > 0);
  assert.ok(i("lireChampPropre(entree, 'fonction'") > i("lireChampPropre(table, nom, 'table')"));
  assert.ok(i("const parametres = lireParametres(entree") > i("lireChampPropre(entree, 'appel'"));
  assert.ok(i('Reflect.ownKeys(valeurs)') > i("const parametres = lireParametres(entree"));
  assert.ok(i('const lues = parametres.map') > i('Reflect.ownKeys(valeurs)'));
  assert.ok(i('return fonction(argument)') > i('const lues'));
  assert.equal(CODE.split('fonction(').length - 1, 2); // deux sites d'appel : objet et positionnel, rien d'autre
});
test('H6. la table : imports nommés statiques uniquement, 9 modules, pas de relations-parent-enfant, pas de descriptions, pas de capacités, pas d\'invocateur', () => {
  const imports = CODE_TABLE.match(/^import\b[^;]*;/gm);
  assert.equal(imports.length, 16); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 14 → 15 (+ resoudre-elements.js) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 13 → 14 (+ projeter-chemins.js) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : + symboles-de-chaine.js // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 9 → 10 (+ elements-observables.js) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 10 → 11 (+ suites-fermees.js) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 11 → 12 (+ projeter-contenus.js) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 12 → 13 (+ rechercher-sous-suites.js) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 15 → 16 (+ composerCollection)
  assert.deepEqual(imports.map((l) => l.match(/from '([^']+)'/)[1]).sort(), [
    './composer-collection.js', './constats-structurels.js', './couverture-occurrences.js', './elements-observables.js', './parcours-structure.js', './partition-couvertures.js', './projeter-chemins.js', './projeter-contenus.js', './rechercher-sous-suites.js',
    './resolution-couverture.js', './resoudre-elements.js', './sequence-plages.js', './structure-identifiee.js', './suites-fermees.js', './symboles-de-chaine.js', './valeurs-observees.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : + composerCollection (composer-collection.js) // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudre-elements.js ; MISE À JOUR DÉLIBÉRÉE v0.63.42 : + suites-fermees.js
  for (const l of imports) assert.match(l, /^import \{[^}*]+\} from '\.\/[a-z-]+\.js';$/);
  assert.equal(/import\s*\*|import\(|relations-parent-enfant|relationsParentEnfant|descriptions-operations|DESCRIPTIONS_OPERATIONS|registre|invocation-operations|invoquerOperation|formes-operation|garantie-forme/.test(SRC_TABLE), false);
  assert.deepEqual(CODE_TABLE.match(/^export .*$/gm), ['export const TABLE_OPERATIONS = Object.freeze({']);
  assert.equal(/'[^']*\.js'/.test(CODE_TABLE.replace(/^import .*$/gm, '')), false); // aucun chemin de module sous forme de chaîne hors import
});
test('H7. aucun fichier de production (hors les deux nouveaux) ne référence primitive, table ni leurs exports (ni sw, worker, index, manifeste)', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f);
    if (r === NOM || r === NOM_TABLE) continue;
    if (r === 'app/langage/execution-sollicitee.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.34 : execution-sollicitee.js (primitive d'exécution sollicitée, dormante) importe ces primitives.
    if (r === 'app/main.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.35 : main.js passe TABLE_OPERATIONS à l'outil de sollicitation (surSollicitation) ; gardé par tests/sollicitation-ui.test.mjs
    const src = readFileSync(f, 'utf8');
    assert.equal(/invocation-operations|table-operations|invoquerOperation|TABLE_OPERATIONS/.test(src), false, r);
  }
  for (const autre of ['app/index.html', 'app/sw.js', 'sw.js', 'worker.js', 'index.html', 'app/manifest.webmanifest']) {
    let src; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; }
    assert.equal(/invocation-operations|table-operations/.test(src), false, autre);
  }
});
test('H8. dormance absolue : aucun des modules du tour, de l\'esprit ou des vues ne référence ni invoquer ni la table', () => {
  for (const n of ['app/langage/pont.js', // MISE À JOUR DÉLIBÉRÉE v0.63.35 : app/main.js retiré (voir H7)
     'app/langage/ecran.js', 'app/langage/observation-possibilites.js', 'app/langage/possibilites-liaison.js',
    'app/langage/productions-decrites.js', 'app/langage/esprit.js', 'app/langage/action.js', 'app/langage/composition.js', 'app/langage/registre.js']) {
    assert.equal(/invocation-operations|table-operations|invoquerOperation|TABLE_OPERATIONS/.test(readFileSync(join(RACINE, n), 'utf8')), false, n);
  }
});
test('H9. ni la primitive ni la table ne sont atteignables depuis app/main.js (imports statiques transitifs)', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]/g)) {
      const cible = join(f, '..', m[1] ?? m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations)\.js$/.test(cible))) pile.push(cible); // MISE À JOUR DÉLIBÉRÉE v0.63.35 : entrées de l'outil de développement écartées (gardées par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs)
    }
  }
  const atteints = [...vus].map(rel);
  for (const n of [NOM, NOM_TABLE]) assert.equal(atteints.includes(n), false, n);
});
test('H10. VERSION_BASE 15, SCHEMA_SAUVEGARDE 5, 19 tables ; valeurDePorteur et observation inchangés (comportement du tour intact)', async () => {
  const connaissances = await import('../app/langage/connaissances.js');
  assert.equal(connaissances.TABLES.length, 24); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables)
  assert.match(readFileSync(join(RACINE, 'app', 'langage', 'connaissances.js'), 'utf8'), /VERSION_BASE\s*=\s*21\b/); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentesProspectives (21 / 11 / 24) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contextesProspectifs (20 / 10 / 23) // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.match(readFileSync(join(RACINE, 'app', 'memoire', 'sauvegarde.js'), 'utf8'), /SCHEMA_SAUVEGARDE\s*=\s*11\b/); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentesProspectives (21 / 11 / 24) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contextesProspectifs (20 / 10 / 23) // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  const acces = readFileSync(join(RACINE, 'app', 'langage', 'acces-valeur.js'), 'utf8');
  assert.equal(/invocation|table-operations/.test(acces), false);
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
});
// === FIN_TEST_INVOCATION_OPERATIONS ===
