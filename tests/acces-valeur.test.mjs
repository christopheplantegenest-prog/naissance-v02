// === DEBUT_TEST_ACCES_VALEUR ===
// v0.63.17 — ÉTAPE 7, décision ChatGPT « ACCÈS PUR À LA VALEUR D'UNE DONNÉE PORTÉE » (05/10/2026). Preuves que
// app/langage/acces-valeur.js rend la valeur RÉELLE d'un porteur pour une donnée désignée, par descripteurs de propriété propre,
// identité vérifiée AVANT la lecture du champ de valeur, sans jamais lire donnee.forme, sans copie ni coercition, sans connaître
// message/trace/opération ; que les déclarations d'accès (message : texte ; trace : resultat) sont gelées et descriptives ;
// et que tout reste dormant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as module from '../app/langage/acces-valeur.js';
import * as moduleTrace from '../app/langage/acces-trace.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { donneeDeSource } from '../app/langage/donnee-de-source.js';
import { identifierMessage } from '../app/langage/pont.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const { valeurDePorteur: val } = module;
const { ACCES_TRACE } = moduleTrace;
const RACINE = join(import.meta.dirname, '..');
const NOM = 'app/langage/acces-valeur.js';
const NOM_TRACE = 'app/langage/acces-trace.js';
const SRC = readFileSync(join(RACINE, NOM), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SRC);
const CODE_SANS_CHAINES = CODE.replace(/`[^`]*`|'[^']*'/g, "''");
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const piegeSur = (objet, champ) => { Object.defineProperty(objet, champ, { enumerable: true, get() { throw new Error(`accesseur ${String(champ)} exécuté`); } }); return objet; };
// Proxy qui enregistre chaque descripteur demandé ET chaque lecture directe.
function espion(cible, journal, nom) {
  return new Proxy(cible, {
    getOwnPropertyDescriptor(c, k) { journal.push(`${nom}.desc:${String(k)}`); return Reflect.getOwnPropertyDescriptor(c, k); },
    get(c, k, r) { journal.push(`${nom}.get:${String(k)}`); return Reflect.get(c, k, r); },
    has(c, k) { journal.push(`${nom}.has:${String(k)}`); return Reflect.has(c, k); },
  });
}

// ============================================================================ A. CONTRAT ET CAS NOMINAUX
test('A1. exactement un export : valeurDePorteur(porteur, donnee, acces), trois paramètres', () => {
  assert.deepEqual(Object.keys(module), ['valeurDePorteur']);
  assert.equal(val.length, 3);
  assert.deepEqual(Object.keys(moduleTrace), ['ACCES_TRACE']);
});
test('A2. cas nominal minimal', () => {
  assert.equal(val({ id: 'A', contenu: 123 }, { identite: 'A' }, { champ: 'contenu' }), 123);
});
test('A3. l\'accès est lu à CHAQUE appel (aucune mémoire entre appels)', () => {
  const p = { id: 'A', v: 1 };
  assert.equal(val(p, { identite: 'A' }, { champ: 'v' }), 1);
  p.v = 2;
  assert.equal(val(p, { identite: 'A' }, { champ: 'v' }), 2);
  assert.equal(val({ id: 'B', v: 9 }, { identite: 'B' }, { champ: 'v' }), 9);
});
test('A4. valeurs rendues EXACTEMENT : null, undefined présent, 0, -0, false, chaîne vide, NaN', () => {
  const lire = (v) => val({ id: 'A', c: v }, { identite: 'A' }, { champ: 'c' });
  assert.equal(lire(null), null);
  assert.equal(lire(undefined), undefined);
  assert.equal(lire(0), 0);
  assert.equal(Object.is(lire(-0), -0), true);
  assert.equal(lire(false), false);
  assert.equal(lire(''), '');
  assert.equal(Number.isNaN(lire(NaN)), true);
  const s = Symbol('s'); assert.equal(lire(s), s);
});
test('A5. objet et tableau : MÊME référence, aucune copie, aucun gel', () => {
  const obj = { x: 1 }; const tab = [1, [2]];
  assert.equal(val({ id: 'B', payload: obj }, { identite: 'B' }, { champ: 'payload' }), obj);
  assert.equal(val({ id: 'T', resultat: tab }, { identite: 'T' }, ACCES_TRACE), tab);
  assert.equal(Object.isFrozen(obj), false);
  assert.equal(Object.isFrozen(tab), false);
});
test('A6. la valeur peut être une fonction ou un objet à getters : rendue telle quelle, non exécutée', () => {
  const f = () => 1; const o = piegeSur({}, 'k');
  assert.equal(val({ id: 'A', c: f }, { identite: 'A' }, { champ: 'c' }), f);
  assert.equal(val({ id: 'A', c: o }, { identite: 'A' }, { champ: 'c' }), o);
});

// ============================================================================ B. IDENTITÉ
test('B1. identités différentes : TypeError', () => {
  refuse(() => val({ id: 'A', c: 1 }, { identite: 'B' }, { champ: 'c' }), /correspond/);
});
test('B2. identités différentes : le champ de valeur n\'est JAMAIS lu (ni descripteur, ni get)', () => {
  const j = [];
  const p = espion({ id: 'A', c: 1 }, j, 'p');
  refuse(() => val(p, { identite: 'B' }, { champ: 'c' }), /correspond/);
  assert.equal(j.some((l) => l.endsWith(':c')), false, j.join(' | '));
  const piege = piegeSur({ id: 'A' }, 'c');
  refuse(() => val(piege, { identite: 'B' }, { champ: 'c' }), /correspond/);
});
test('B3. ordre exact en cas nominal : id, puis champ de valeur ; aucune lecture directe (get) sur le porteur', () => {
  const j = [];
  const p = espion({ id: 'A', c: 7 }, j, 'p');
  assert.equal(val(p, { identite: 'A' }, { champ: 'c' }), 7);
  assert.deepEqual(j, ['p.desc:id', 'p.desc:c']);
});
test('B4. pas de trim, pas de coercition, pas de préfixe interprété, pas de casse', () => {
  const lire = (a, b) => val({ id: a, c: 1 }, { identite: b }, { champ: 'c' });
  refuse(() => lire('A ', 'A'));
  refuse(() => lire('a', 'A'));
  refuse(() => lire('message-1', '1'));
  refuse(() => lire('1', 1), /chaîne/);
  refuse(() => lire(1, '1'), /chaîne/);
  refuse(() => lire(new String('A'), 'A'), /chaîne/);
  refuse(() => lire('A', new String('A')), /chaîne/);
});
test('B5. identités vides, absentes ou non chaînes refusées', () => {
  for (const mauvais of ['', undefined, null, 0, false, {}, [], Symbol('s')]) {
    refuse(() => val({ id: mauvais, c: 1 }, { identite: 'A' }, { champ: 'c' }), /chaîne non vide/);
    refuse(() => val({ id: 'A', c: 1 }, { identite: mauvais }, { champ: 'c' }), /chaîne non vide/);
  }
  refuse(() => val({ c: 1 }, { identite: 'A' }, { champ: 'c' }), /pas de champ/);
  refuse(() => val({ id: 'A', c: 1 }, {}, { champ: 'c' }), /pas de champ/);
});
test('B6. identités vides des DEUX côtés ne s\'égalent pas (pas de "" === "")', () => {
  refuse(() => val({ id: '', c: 1 }, { identite: '' }, { champ: 'c' }), /chaîne non vide/);
});
test('B7. accesseurs sur porteur.id et donnee.identite : refusés SANS exécution', () => {
  refuse(() => val(piegeSur({ c: 1 }, 'id'), { identite: 'A' }, { champ: 'c' }), /accesseur/);
  refuse(() => val({ id: 'A', c: 1 }, piegeSur({}, 'identite'), { champ: 'c' }), /accesseur/);
});
test('B8. id et identite hérités refusés', () => {
  refuse(() => val(Object.create({ id: 'A', c: 1 }), { identite: 'A' }, { champ: 'c' }), /pas de champ/);
  refuse(() => val({ id: 'A', c: 1 }, Object.create({ identite: 'A' }), { champ: 'c' }), /pas de champ/);
});

// ============================================================================ C. DÉCLARATION D'ACCÈS
test('C1. déclaration : objet non nul requis', () => {
  for (const mauvais of [undefined, null, 'c', 1, [], () => 1]) refuse(() => val({ id: 'A', c: 1 }, { identite: 'A' }, mauvais), /objet/);
});
test('C2. champ absent, vide, non chaîne : refusés', () => {
  refuse(() => val({ id: 'A', c: 1 }, { identite: 'A' }, {}), /pas de champ/);
  refuse(() => val({ id: 'A', '': 1 }, { identite: 'A' }, { champ: '' }), /chaîne non vide/);
  for (const mauvais of [undefined, null, 1, true, {}, ['c'], Symbol('c'), new String('c')]) {
    refuse(() => val({ id: 'A', c: 1 }, { identite: 'A' }, { champ: mauvais }), /chaîne non vide/);
  }
});
test('C3. champ hérité ou accesseur dans la déclaration : refusés sans exécution', () => {
  refuse(() => val({ id: 'A', c: 1 }, { identite: 'A' }, Object.create({ champ: 'c' })), /pas de champ/);
  refuse(() => val({ id: 'A', c: 1 }, { identite: 'A' }, piegeSur({}, 'champ')), /accesseur/);
});
test('C4. aucun chemin : « a.b » est un NOM de champ, pas un chemin ; tableau de segments refusé', () => {
  assert.equal(val({ id: 'A', 'a.b': 5, a: { b: 6 } }, { identite: 'A' }, { champ: 'a.b' }), 5);
  refuse(() => val({ id: 'A', a: { b: 6 } }, { identite: 'A' }, { champ: 'a.b' }), /pas de champ/);
  refuse(() => val({ id: 'A', a: { b: 6 } }, { identite: 'A' }, { champ: ['a', 'b'] }), /chaîne/);
});
test('C5. pas de trim ni coercition du champ', () => {
  refuse(() => val({ id: 'A', c: 1 }, { identite: 'A' }, { champ: ' c' }), /pas de champ/);
  refuse(() => val({ id: 'A', c: 1 }, { identite: 'A' }, { champ: 'c ' }), /pas de champ/);
  refuse(() => val({ id: 'A', c: 1 }, { identite: 'A' }, { champ: 'C' }), /pas de champ/);
  refuse(() => val({ id: 'A', 1: 'x' }, { identite: 'A' }, { champ: 1 }), /chaîne/);
});
test('C6. autres clés de la déclaration ignorées (défaut, repli, chemin ne font rien)', () => {
  refuse(() => val({ id: 'A' }, { identite: 'A' }, { champ: 'c', defaut: 1, repli: 2, chemin: ['c'] }), /pas de champ/);
  assert.equal(val({ id: 'A', c: 3 }, { identite: 'A' }, { champ: 'c', defaut: 1 }), 3);
});

// ============================================================================ D. LECTURE : PROPRE + DONNÉE
test('D1. ABSENCE ≠ UNDEFINED', () => {
  assert.equal(val({ id: 'A', valeur: undefined }, { identite: 'A' }, { champ: 'valeur' }), undefined);
  refuse(() => val({ id: 'A' }, { identite: 'A' }, { champ: 'valeur' }), /pas de champ/);
});
test('D2. champ hérité refusé (prototype ordinaire, Object.prototype, classe)', () => {
  const base = { c: 1 };
  refuse(() => val(Object.assign(Object.create(base), { id: 'A' }), { identite: 'A' }, { champ: 'c' }), /pas de champ/);
  refuse(() => val({ id: 'A' }, { identite: 'A' }, { champ: 'toString' }), /pas de champ/);
  refuse(() => val({ id: 'A' }, { identite: 'A' }, { champ: 'hasOwnProperty' }), /pas de champ/);
  class P { constructor() { this.id = 'A'; } get v() { return 1; } m() {} }
  refuse(() => val(new P(), { identite: 'A' }, { champ: 'v' }), /pas de champ/);
  refuse(() => val(new P(), { identite: 'A' }, { champ: 'm' }), /pas de champ/);
});
test('D3. accesseur sur le champ de valeur : refusé SANS exécution (getter seul, setter seul, getter/setter)', () => {
  refuse(() => val(piegeSur({ id: 'A' }, 'c'), { identite: 'A' }, { champ: 'c' }), /accesseur/);
  const so = { id: 'A' }; Object.defineProperty(so, 'c', { set() { throw new Error('setter'); }, enumerable: true });
  refuse(() => val(so, { identite: 'A' }, { champ: 'c' }), /accesseur/);
  const gs = { id: 'A' }; Object.defineProperty(gs, 'c', { get() { throw new Error('g'); }, set() { throw new Error('s'); } });
  refuse(() => val(gs, { identite: 'A' }, { champ: 'c' }), /accesseur/);
});
test('D4. propriété de donnée non énumérable ou non écrivable : lue (seul le type DONNÉE compte)', () => {
  const p = { id: 'A' }; Object.defineProperty(p, 'c', { value: 5, enumerable: false, writable: false, configurable: false });
  assert.equal(val(p, { identite: 'A' }, { champ: 'c' }), 5);
});
test('D5. objets sans prototype : porteur, donnée et déclaration', () => {
  const nu = (o) => Object.assign(Object.create(null), o);
  assert.equal(val(nu({ id: 'A', c: 4 }), nu({ identite: 'A' }), nu({ champ: 'c' })), 4);
  refuse(() => val(nu({ id: 'A' }), nu({ identite: 'A' }), nu({ champ: 'toString' })), /pas de champ/);
  refuse(() => val(nu({ id: 'A' }), nu({ identite: 'A' }), nu({ champ: 'c' })), /pas de champ/);
});
test('D6. clés inhabituelles : unicode, espaces, chaîne numérique, très longue', () => {
  for (const k of ['é', 'a b', '0', '1', '😀', 'x'.repeat(5000), '\u0000', 'a\nb']) {
    const p = { id: 'A' }; Object.defineProperty(p, k, { value: k + '!', enumerable: true });
    assert.equal(val(p, { identite: 'A' }, { champ: k }), k + '!', JSON.stringify(k).slice(0, 20));
  }
});
test('D7. champ « __proto__ » PROPRE de donnée (via JSON.parse / defineProperty) : lu ; non propre : refusé', () => {
  const p = JSON.parse('{"id":"A","__proto__":{"danger":true}}');
  assert.equal(Object.getOwnPropertyDescriptor(p, '__proto__') !== undefined, true);
  const v = val(p, { identite: 'A' }, { champ: '__proto__' });
  assert.deepEqual(v, { danger: true });
  assert.equal(v, Object.getOwnPropertyDescriptor(p, '__proto__').value);
  refuse(() => val({ id: 'A' }, { identite: 'A' }, { champ: '__proto__' }), /pas de champ/);
  refuse(() => val(Object.assign(Object.create(null), { id: 'A' }), { identite: 'A' }, { champ: '__proto__' }), /pas de champ/);
});
test('D8. champ « constructor » : lu seulement s\'il est PROPRE', () => {
  refuse(() => val({ id: 'A' }, { identite: 'A' }, { champ: 'constructor' }), /pas de champ/);
  refuse(() => val([], { identite: 'A' }, { champ: 'constructor' }), /objet/);
  const p = { id: 'A', constructor: 'propre' };
  assert.equal(val(p, { identite: 'A' }, { champ: 'constructor' }), 'propre');
  assert.equal(val(p, { identite: 'A' }, { champ: 'id' }), 'A');
});
test('D9. champ « prototype », « length », « id » : aucun nom privilégié ni interdit', () => {
  assert.equal(val({ id: 'A', prototype: 1 }, { identite: 'A' }, { champ: 'prototype' }), 1);
  assert.equal(val({ id: 'A', length: 2 }, { identite: 'A' }, { champ: 'length' }), 2);
  assert.equal(val({ id: 'A' }, { identite: 'A' }, { champ: 'id' }), 'A');
});
test('D10. le porteur n\'est pas modifié (objet gelé et objet ordinaire)', () => {
  const p = Object.freeze({ id: 'A', c: [1] });
  assert.deepEqual(val(p, { identite: 'A' }, { champ: 'c' }), [1]);
  const q = { id: 'A', c: 1 }; const avant = JSON.stringify(q);
  val(q, { identite: 'A' }, { champ: 'c' });
  assert.equal(JSON.stringify(q), avant);
});
test('D11. porteur ou donnée tableau / null / primitive : TypeError', () => {
  for (const mauvais of [null, undefined, 'A', 1, [], () => 1]) {
    refuse(() => val(mauvais, { identite: 'A' }, { champ: 'c' }), /objet/);
    refuse(() => val({ id: 'A', c: 1 }, mauvais, { champ: 'c' }), /objet/);
  }
});
test('D12. appel avec trop peu d\'arguments : TypeError, jamais undefined', () => {
  refuse(() => val(), /objet/);
  refuse(() => val({ id: 'A' }), /objet/);
  refuse(() => val({ id: 'A' }, { identite: 'A' }), /objet/);
});

// ============================================================================ E. FORME JAMAIS LUE
test('E1. donnee.forme n\'est jamais lue : accesseur piégé, Proxy espion', () => {
  const d = piegeSur({ identite: 'A' }, 'forme');
  assert.equal(val({ id: 'A', c: 1 }, d, { champ: 'c' }), 1);
  const j = [];
  const e = espion({ identite: 'A', forme: { forme: 'scalaire', genre: 'chaine' } }, j, 'd');
  assert.equal(val({ id: 'A', c: 1 }, e, { champ: 'c' }), 1);
  assert.deepEqual(j, ['d.desc:identite']);
});
test('E2. forme invalide ou absente dans la donnée : sans effet', () => {
  for (const forme of [undefined, null, 42, { forme: 'inconnue' }, 'chaine']) {
    assert.equal(val({ id: 'A', c: 1 }, { identite: 'A', forme }, { champ: 'c' }), 1);
  }
});
test('E3. forme chaîne déclarée, valeur 42 : rend 42 (aucune validation valeur→forme)', () => {
  const forme = { forme: 'scalaire', genre: 'chaine' };
  for (const v of [42, true, null, undefined, {}, [], Symbol.iterator]) {
    assert.equal(val({ id: 'A', c: v }, { identite: 'A', forme }, { champ: 'c' }), v);
  }
});

// ============================================================================ F. SOURCE MESSAGE RÉELLE
test('F1. DESCRIPTION_SOURCE_MESSAGE : forme + acces {champ:texte}, gel profond', () => {
  assert.deepEqual(Object.keys(DESCRIPTION_SOURCE_MESSAGE), ['forme', 'acces']);
  assert.deepEqual(DESCRIPTION_SOURCE_MESSAGE.acces, { champ: 'texte' });
  assert.deepEqual(DESCRIPTION_SOURCE_MESSAGE.forme, { forme: 'scalaire', genre: 'chaine' });
  assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_MESSAGE), true);
  assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_MESSAGE.forme), true);
  assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_MESSAGE.acces), true);
  assert.throws(() => { 'use strict'; DESCRIPTION_SOURCE_MESSAGE.acces.champ = 'autre'; }, TypeError);
});
test('F2. donneeDeSource ignore acces : sortie EXACTEMENT { identite, forme }', () => {
  const m = identifierMessage('Bonjour', { nouvelId: (p) => `${p}-1` });
  const d = donneeDeSource(m, DESCRIPTION_SOURCE_MESSAGE);
  assert.deepEqual(Object.keys(d).sort(), ['forme', 'identite']);
  assert.deepEqual(d, { identite: m.id, forme: { forme: 'scalaire', genre: 'chaine' } });
  const sans = donneeDeSource(m, { forme: DESCRIPTION_SOURCE_MESSAGE.forme });
  assert.deepEqual(d, sans);
  const j = [];
  donneeDeSource(m, espion({ forme: DESCRIPTION_SOURCE_MESSAGE.forme, acces: { champ: 'texte' } }, j, 'desc'));
  assert.equal(j.some((l) => l.includes('acces')), false, j.join(' | '));
});
test('F3. message réel : identifierMessage → donneeDeSource → valeurDePorteur rend exactement \'Bonjour\'', () => {
  const m = identifierMessage('Bonjour', { nouvelId: (p) => `${p}-1` });
  const d = donneeDeSource(m, DESCRIPTION_SOURCE_MESSAGE);
  assert.equal(val(m, d, DESCRIPTION_SOURCE_MESSAGE.acces), 'Bonjour');
});
test('F4. message réel : chaînes particulières rendues sans normalisation', () => {
  for (const t of ['', ' ', '  a  ', 'é\u0301', '\u0000', 'x'.repeat(10000), 'a\r\nb']) {
    const m = identifierMessage(t, { nouvelId: (p) => `${p}-1` });
    if (m === null) continue; // identifierMessage peut refuser certains textes : sans objet ici
    const d = donneeDeSource(m, DESCRIPTION_SOURCE_MESSAGE);
    assert.equal(val(m, d, DESCRIPTION_SOURCE_MESSAGE.acces), t, JSON.stringify(t).slice(0, 20));
  }
});
test('F5. message de M2 ne livre pas la valeur de M1 (D1/D2)', () => {
  const g = (() => { let n = 0; return (p) => `${p}-${++n}`; })();
  const m1 = identifierMessage('un', { nouvelId: g }); const m2 = identifierMessage('deux', { nouvelId: g });
  const d1 = donneeDeSource(m1, DESCRIPTION_SOURCE_MESSAGE);
  assert.equal(val(m1, d1, DESCRIPTION_SOURCE_MESSAGE.acces), 'un');
  refuse(() => val(m2, d1, DESCRIPTION_SOURCE_MESSAGE.acces), /correspond/);
});

// ============================================================================ G. GÉNÉRALITÉ
test('G1. sources fictives A, B et trace fictive T : aucun code spécial message/texte/resultat', () => {
  assert.equal(val({ id: 'A', contenu: 123 }, { identite: 'A', forme: { forme: 'scalaire', genre: 'nombre' } }, { champ: 'contenu' }), 123);
  const payload = { x: 1 };
  assert.equal(val({ id: 'B', payload }, { identite: 'B', forme: { forme: 'objet' } }, { champ: 'payload' }), payload);
  const resultat = [{ chemin: [] }, 2];
  assert.equal(val({ id: 'T', resultat }, { identite: 'T', forme: { forme: 'collection' } }, ACCES_TRACE), resultat);
});
test('G2. un MÊME porteur, deux déclarations : deux valeurs distinctes', () => {
  const p = { id: 'A', texte: 'a', contenu: 'b' };
  assert.equal(val(p, { identite: 'A' }, { champ: 'texte' }), 'a');
  assert.equal(val(p, { identite: 'A' }, { champ: 'contenu' }), 'b');
});
test('G3. mauvaise déclaration pour le porteur : TypeError (« texte » sur la source A)', () => {
  refuse(() => val({ id: 'A', contenu: 123 }, { identite: 'A' }, DESCRIPTION_SOURCE_MESSAGE.acces), /pas de champ/);
  refuse(() => val({ id: 'A', texte: 'x' }, { identite: 'A' }, ACCES_TRACE), /pas de champ/);
});
test('G4. trace réaliste : resultat copie JSON ; resultat absent = aucune valeur ; resultat null/undefined présents rendus', () => {
  const trace = { id: 'trace-1', sequence: 1, capacite: 'recherche', resultat: { a: [1, 2] } };
  assert.deepEqual(val(trace, { identite: 'trace-1' }, ACCES_TRACE), { a: [1, 2] });
  refuse(() => val({ id: 'trace-2', sequence: 1 }, { identite: 'trace-2' }, ACCES_TRACE), /pas de champ/);
  assert.equal(val({ id: 't', resultat: null }, { identite: 't' }, ACCES_TRACE), null);
  assert.equal(val({ id: 't', resultat: undefined }, { identite: 't' }, ACCES_TRACE), undefined);
});

// ============================================================================ H. SOURCE MENSONGÈRE
test('H1. forme déclarée, accès déclaré, valeur réelle : trois informations distinctes', () => {
  const description = { forme: { forme: 'scalaire', genre: 'chaine' }, acces: { champ: 'contenu' } };
  const porteur = { id: 'A', contenu: 42 };
  const d = donneeDeSource(porteur, description);
  assert.deepEqual(d, { identite: 'A', forme: { forme: 'scalaire', genre: 'chaine' } });
  assert.equal(val(porteur, d, description.acces), 42);
});

// ============================================================================ I. DÉCLARATION TRACE
test('I1. ACCES_TRACE : {champ:\'resultat\'}, gelée, sans fonction', () => {
  assert.deepEqual(ACCES_TRACE, { champ: 'resultat' });
  assert.equal(Object.isFrozen(ACCES_TRACE), true);
  assert.deepEqual(Object.keys(ACCES_TRACE), ['champ']);
  assert.equal(JSON.stringify(ACCES_TRACE), '{"champ":"resultat"}');
  assert.throws(() => { 'use strict'; ACCES_TRACE.champ = 'autre'; }, TypeError);
});
test('I2. la déclaration trace n\'est PAS dupliquée dans les 9 descriptions d\'opérations', () => {
  const texte = JSON.stringify(DESCRIPTIONS_OPERATIONS);
  assert.equal(/acces|champ":"resultat|resultat/.test(texte), false);
  const src = readFileSync(join(RACINE, 'app', 'langage', 'descriptions-operations.js'), 'utf8');
  assert.equal(/ACCES_TRACE|acces-trace|acces-valeur|valeurDePorteur/.test(src), false);
});
test('I3. acces-trace.js : aucun import, aucun appel, une seule constante', () => {
  const src = sansCommentaires(readFileSync(join(RACINE, NOM_TRACE), 'utf8'));
  assert.equal(/^\s*import\b/m.test(src), false);
  assert.deepEqual(src.match(/^export .*$/gm), ["export const ACCES_TRACE = Object.freeze({ champ: 'resultat' });"]);
});

// ============================================================================ J. STATIQUE / DORMANCE
test('J1. exports uniques ; la primitive n\'importe RIEN', () => {
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function valeurDePorteur(porteur, donnee, acces) {']);
  assert.equal(/^\s*import\b/m.test(CODE), false);
  assert.equal(/\bawait\b|\basync\b|\bimport\s*\(/.test(CODE), false);
});
test('J2. la primitive ne connaît ni message, ni trace, ni texte, ni resultat, ni opération, ni catalogue, ni forme', () => {
  assert.equal(/'texte'|"texte"|'resultat'|"resultat"|'forme'|"forme"|\.forme\b|message|trace|catalogue|operation|opération|parcourirStructure/i.test(CODE), false);
});
test('J3. aucune copie, coercition, trim, repli, inspection de valeur dans la primitive', () => {
  assert.equal(/JSON\.|structuredClone|\.trim\(|String\(|Number\(|Boolean\(|\?\?|\?\.|\.slice\(|Object\.assign|\.\.\./.test(CODE_SANS_CHAINES), false);
  assert.equal(CODE_SANS_CHAINES.includes('typeof valeur'), true); // seul typeof : sur la valeur passée à exiger*, jamais sur la valeur lue du porteur
  assert.equal(/typeof\s+(?!valeur\b)/.test(CODE_SANS_CHAINES), false);
  assert.equal(/\bin\b\s+\w+\)/.test(CODE.replace("'value' in propriete", '')), false);
  assert.equal(/Reflect\.|Proxy|\.call\(|\.apply\(|eval|new Function/.test(CODE), false);
});
test('J4. lecture exclusivement par Object.getOwnPropertyDescriptor ; jamais porteur[...] ni acces.champ en lecture directe', () => {
  assert.match(CODE, /Object\.getOwnPropertyDescriptor\(objet, champ\)/);
  assert.equal(/porteur\[|donnee\[|acces\[|porteur\.|donnee\.|acces\./.test(CODE_SANS_CHAINES), false);
  assert.equal(/\bhasOwn|hasOwnProperty|\.id\b|\.identite\b|\.champ\b/.test(CODE_SANS_CHAINES), false);
});
test('J5. l\'identité est comparée AVANT la lecture du champ de valeur (ordre dans le source)', () => {
  const iComparaison = CODE.indexOf('identitePorteur !== identiteDonnee');
  const iLecture = CODE.indexOf("return lireChampPropre(porteur, champ, 'porteur')");
  assert.ok(iComparaison > 0 && iLecture > iComparaison);
  assert.equal(CODE.split("lireChampPropre(porteur, ").length - 1, 2); // id + champ de valeur, rien d'autre
});
test('J6. aucun fichier de production ne référence ces modules ni leurs exports (ni sw, worker, index, manifeste)', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f);
    if (r === NOM || r === NOM_TRACE) continue;
    const src = readFileSync(f, 'utf8');
    // MISE À JOUR DÉLIBÉRÉE v0.63.24 : observation-possibilites.js DÉCLARE (sans jamais la lire) la convention d'accès ACCES_TRACE dans la
    // représentation locale { donnee, porteur, acces } de l'univers ; il n'appelle ni n'importe jamais la primitive d'accès pur.
    if (r === 'app/langage/observation-possibilites.js') {
      assert.equal(/acces-valeur|valeurDePorteur/.test(src), false, r);
      assert.equal((src.match(/ACCES_TRACE/g) || []).length > 0, true);
      continue;
    }
    // MISE À JOUR DÉLIBÉRÉE v0.63.26 : valeurs-application.js est le SEUL consommateur de valeurDePorteur (dormant, jamais importé) ; il ne
    // connaît ni ACCES_TRACE ni acces-trace.
    if (r === 'app/langage/valeurs-application.js') {
      assert.equal(/acces-trace|ACCES_TRACE/.test(src), false, r);
      assert.equal(/from '\.\/acces-valeur\.js'/.test(src), true);
      continue;
    }
    // MISE À JOUR DÉLIBÉRÉE v0.63.48 : resoudre-identites.js (dormant, jamais importé) DÉCLARE les conventions d'accès ACCES_TRACE et
    // ACCES_VALEUR_DONNEE dans les éléments { donnee, porteur, acces } qu'il rend ; il n'importe ni n'appelle la primitive d'accès pur
    // (il en cite seulement le nom dans un commentaire : la valeur se lit par valeurDePorteur, côté appelant).
    if (r === 'app/langage/resoudre-identites.js') {
      assert.equal(/from '\.\/acces-valeur\.js'/.test(src), false, r);
      assert.equal(/from '\.\/acces-trace\.js'/.test(src), true);
      continue;
    }
    // MISE À JOUR DÉLIBÉRÉE v0.63.55 : entrees-donnee.js (constantes pures, dormant) DÉCLARE l'accès ACCES_ENTREES_PRODUCTION et nomme, en
    // commentaire seulement, valeurDePorteur et ACCES_TRACE (pour dire qu'on ne réutilise pas celui-ci) ; il n'importe rien.
    if (r === 'app/langage/entrees-donnee.js') {
      assert.equal(/^import /m.test(src), false, r);
      continue;
    }
    // MISE À JOUR DÉLIBÉRÉE v0.63.68 : retours-de-valeur.js (vue pure, dormante, jamais importée) lit la valeur d'une donnée résolue par valeurDePorteur (second consommateur dormant, après valeurs-application.js).
    // MISE À JOUR DÉLIBÉRÉE v0.63.69 : la logique est passée dans episodes-de-transformation.js (vue générale dormante, seule source de vérité) qui importe valeurDePorteur ;
    // retours-de-valeur.js n'est plus qu'une projection et ne cite la primitive qu'en commentaire.
    if (r === 'app/langage/episodes-de-transformation.js') {
      assert.equal(/from '\.\/acces-valeur\.js'/.test(src), true);
      continue;
    }
    if (r === 'app/langage/retours-de-valeur.js') {
      assert.equal(/from '\.\/acces-valeur\.js'/.test(src), false);
      continue;
    }
    assert.equal(/acces-valeur|acces-trace|valeurDePorteur|ACCES_TRACE/.test(src), false, r);
  }
  for (const autre of ['app/index.html', 'app/sw.js', 'sw.js', 'worker.js', 'index.html', 'app/manifest.webmanifest']) {
    let src; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; }
    assert.equal(/acces-valeur|acces-trace/.test(src), false, autre);
  }
});
test('J7. le tour (main.js, pont.js, ecran.js, observation-possibilites.js) n\'appelle ni la primitive ni les déclarations d\'accès', () => {
  for (const n of ['app/main.js', 'app/langage/pont.js', 'app/langage/ecran.js', 'app/langage/productions-decrites.js', 'app/langage/possibilites-liaison.js']) {
    assert.equal(/acces-valeur|acces-trace|valeurDePorteur|ACCES_TRACE|DESCRIPTION_SOURCE_MESSAGE\.acces/.test(readFileSync(join(RACINE, n), 'utf8')), false, n);
  }
  // v0.63.24 : l'observateur déclare les accès mais n'appelle JAMAIS la primitive d'accès pur (aucune valeur lue)
  assert.equal(/acces-valeur|valeurDePorteur/.test(readFileSync(join(RACINE, 'app/langage/observation-possibilites.js'), 'utf8')), false);
});
test('J8. VERSION_BASE 15, SCHEMA_SAUVEGARDE 5, 19 tables : aucune persistance ajoutée', async () => {
  const connaissances = await import('../app/langage/connaissances.js');
  assert.equal(connaissances.TABLES.length, 28); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables)
  assert.match(readFileSync(join(RACINE, 'app', 'langage', 'connaissances.js'), 'utf8'), /VERSION_BASE\s*=\s*23\b/); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentesProspectives (21 / 11 / 24) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contextesProspectifs (20 / 10 / 23) // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables)
  assert.match(readFileSync(join(RACINE, 'app', 'memoire', 'sauvegarde.js'), 'utf8'), /SCHEMA_SAUVEGARDE\s*=\s*13\b/); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentesProspectives (21 / 11 / 24) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contextesProspectifs (20 / 10 / 23) // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables)
});
test('J9. observation-possibilites : comportement inchangé (la table ne contient aucun accès ni valeur)', async () => {
  const { observerPossibilites } = await import('../app/langage/observation-possibilites.js');
  const lignes = [];
  const m = identifierMessage('Bonjour', { nouvelId: (p) => `${p}-1` });
  const etat = await observerPossibilites(m, { enregistrer: async (d) => { lignes.push(d); return { ...d, id: 'o' }; }, lireExecutions: async () => [] }); // v0.63.24 : contrat { statut, observation, univers } + lecture injectée
  assert.equal(etat.statut, 'ecrite');
  assert.deepEqual(Object.keys(lignes[0]).sort(), ['donneesExaminees', 'empreintesCategoriesDonnees', 'empreintesContratsRelationnels', 'empreintesOperationsExaminees', 'idMessage', 'operationsExaminees', 'possibilites']); // MISE À JOUR DÉLIBÉRÉE v0.63.52 : + empreintesOperationsExaminees (nouvelle génération de ligne, écrite par observerPossibilites) // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
  assert.equal(JSON.stringify(lignes[0]).includes('Bonjour'), false);
  assert.equal(JSON.stringify(lignes[0]).includes('texte'), false);
});
// === FIN_TEST_ACCES_VALEUR ===
