// === DEBUT_TEST_VALEURS_APPLICATION ===
// v0.63.26 — « RÉSOUDRE LES VALEURS D'UNE APPLICATION — PUR — DORMANT — AUCUNE EXÉCUTION » (décision ChatGPT, 05/10/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { resoudreValeursApplication } from '../app/langage/valeurs-application.js';
import * as module_ from '../app/langage/valeurs-application.js';
import { applicationUnique } from '../app/langage/application-unique.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { invoquerOperation } from '../app/langage/invocation-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { ACCES_TRACE } from '../app/langage/acces-trace.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const SRC = lu('app', 'langage', 'valeurs-application.js');
const CODE = sansCommentaires(SRC);
const app = (operation, ...liaisons) => ({ operation, liaisons: liaisons.map(([entree, donnee]) => ({ entree, donnee })) });
const copie = (x) => JSON.parse(JSON.stringify(x));
const ACC_T = { champ: 'texte' };
const ACC_R = { champ: 'resultat' };
// élément d'univers : porteur { id, texte | resultat }
const el = (id, valeur, acces = ACC_R, champ = acces.champ) => ({ donnee: { identite: id, forme: { forme: 'scalaire' } }, porteur: { id, [champ]: valeur }, acces });

// Élément dont le porteur est un Proxy COMPTANT toute consultation de ses propriétés (valeurDePorteur lit par descripteurs : un
// accesseur ne s'exécuterait jamais, il serait refusé ; seul un espion détecte une lecture).
function espion(id, valeur, compteur) {
  const cible = { id, resultat: valeur };
  const porteur = new Proxy(cible, {
    getOwnPropertyDescriptor(c, k) { compteur.n += 1; return Reflect.getOwnPropertyDescriptor(c, k); },
    get(c, k) { compteur.n += 1; return Reflect.get(c, k); },
    has(c, k) { compteur.n += 1; return Reflect.has(c, k); },
    ownKeys(c) { compteur.n += 1; return Reflect.ownKeys(c); },
  });
  const acces = new Proxy({ champ: 'resultat' }, {
    getOwnPropertyDescriptor(c, k) { compteur.n += 1; return Reflect.getOwnPropertyDescriptor(c, k); },
    get(c, k) { compteur.n += 1; return Reflect.get(c, k); },
  });
  return { donnee: { identite: id, forme: {} }, porteur, acces };
}

// ============================================================================ A. CONTRAT
test('A1. un seul export : resoudreValeursApplication ; seul import : acces-valeur.js', () => {
  assert.deepEqual(Object.keys(module_), ['resoudreValeursApplication']);
  assert.deepEqual(CODE.match(/^\s*import\b[^;]*;/gm).map((l) => l.trim()), ["import { valeurDePorteur } from './acces-valeur.js';"]);
});
test('A2. message courant : { operation, valeurs:{ valeur: texte } } exactement', () => {
  const M = { id: 'M', texte: 'bonjour' };
  const univers = [{ donnee: { identite: 'M', forme: { forme: 'scalaire' } }, porteur: M, acces: DESCRIPTION_SOURCE_MESSAGE.acces }];
  const r = resoudreValeursApplication(app('parcourirStructure', ['valeur', 'M']), univers);
  assert.deepEqual(r, { operation: 'parcourirStructure', valeurs: { valeur: 'bonjour' } });
  assert.deepEqual(Object.keys(r), ['operation', 'valeurs']);
});
test('A3. production X : valeurs.valeur === X.resultat (même référence)', () => {
  const resultat = [{ a: 1 }];
  const X = { id: 'X', operation: 'parcourirStructure', resultat };
  const r = resoudreValeursApplication(app('parcourirStructure', ['valeur', 'X']), [{ donnee: { identite: 'X', forme: {} }, porteur: X, acces: ACCES_TRACE }]);
  assert.equal(r.valeurs.valeur, resultat);
});
test('A4. plusieurs entrées : a←A, b←B', () => {
  const r = resoudreValeursApplication(app('memesCouvertures', ['b', 'B'], ['a', 'A']), [el('A', 1), el('B', 2)]);
  assert.deepEqual(r, { operation: 'memesCouvertures', valeurs: { a: 1, b: 2 } });
  assert.deepEqual(Object.keys(r.valeurs), ['a', 'b']);
});
test('A5. même donnée sur deux entrées : même valeur / même référence, sans erreur', () => {
  const v = { x: 1 };
  const r = resoudreValeursApplication(app('o', ['a', 'A'], ['b', 'A']), [el('A', v)]);
  assert.equal(r.valeurs.a, v); assert.equal(r.valeurs.b, v);
});
test('A6. aucune transformation : valeur rendue telle quelle (objet, tableau, null, nombre, chaîne vide)', () => {
  for (const v of [{ k: 1 }, [1, 2], null, 0, '', false]) {
    assert.equal(resoudreValeursApplication(app('o', ['a', 'A']), [el('A', v)]).valeurs.a, v);
  }
});
test('A7. valeur undefined rendue : propriété PRÉSENTE (≠ donnée absente)', () => {
  const r = resoudreValeursApplication(app('o', ['a', 'A']), [el('A', undefined)]);
  assert.equal(Object.prototype.hasOwnProperty.call(r.valeurs, 'a'), true);
  assert.equal(r.valeurs.a, undefined);
  assert.deepEqual(Object.keys(r.valeurs), ['a']);
});
test('A8. univers vide + application : TypeError (donnée absente)', () => {
  assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A']), []), TypeError);
});

// ============================================================================ B. JOINTURE PAR IDENTITÉ SEULE
test('B1. jointure par identité : ni index, ni ordre, ni forme, ni origine, ni horodatage', () => {
  const univers = [el('Z', 'z'), el('A', 'a'), el('M', 'm')];
  univers[0].donnee.forme = { forme: 'autre' }; univers[0].origine = undefined;
  const r = resoudreValeursApplication(app('o', ['x', 'A'], ['y', 'Z']), [...univers].reverse().map((e) => ({ donnee: e.donnee, porteur: e.porteur, acces: e.acces })));
  assert.deepEqual(r.valeurs, { x: 'a', y: 'z' });
});
test('B2. porteur et accès de CHAQUE donnée : celui de la donnée demandée, jamais celui d\'une voisine', () => {
  const univers = [el('M', 'texte-m', ACC_T), el('X', 'res-x', ACC_R)];
  assert.deepEqual(resoudreValeursApplication(app('o', ['a', 'X'], ['b', 'M']), univers).valeurs, { a: 'res-x', b: 'texte-m' });
});
test('B3. identités dupliquées : TypeError — jamais première ni dernière, même si la duplication n\'est pas demandée', () => {
  assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A']), [el('A', 1), el('A', 2)]), TypeError);
  assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A']), [el('A', 1), el('B', 2), el('B', 3)]), TypeError);
});
test('B4. aucune confusion entre donnée absente et valeur undefined', () => {
  assert.throws(() => resoudreValeursApplication(app('o', ['a', 'B']), [el('A', undefined)]), TypeError);
  assert.doesNotThrow(() => resoudreValeursApplication(app('o', ['a', 'A']), [el('A', undefined)]));
});
test('B5. une seule donnée absente suffit : aucune sortie partielle, AUCUNE lecture (espion)', () => {
  const c = { n: 0 };
  assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A'], ['b', 'ABSENTE']), [espion('A', 1, c)]), TypeError);
  assert.equal(c.n, 0);
});

// ============================================================================ C. VALIDATION DE L'APPLICATION
test('C1. application invalide : TypeError', () => {
  const U = [el('A', 1)];
  const mauvaises = [undefined, null, 'x', [], {}, { operation: 'o' }, { liaisons: [] }, { operation: '', liaisons: [{ entree: 'a', donnee: 'A' }] },
    { operation: 3, liaisons: [{ entree: 'a', donnee: 'A' }] }, { operation: 'o', liaisons: [] }, { operation: 'o', liaisons: {} },
    { operation: 'o', liaisons: [null] }, { operation: 'o', liaisons: [{ entree: 'a' }] }, { operation: 'o', liaisons: [{ donnee: 'A' }] },
    { operation: 'o', liaisons: [{ entree: '', donnee: 'A' }] }, { operation: 'o', liaisons: [{ entree: 'a', donnee: '' }] },
    { operation: 'o', liaisons: [{ entree: 'a', donnee: 3 }] }, { operation: 'o', liaisons: [{ entree: 'a', donnee: 'A' }, { entree: 'a', donnee: 'A' }] },
    { operation: 'o', liaisons: [{ entree: 'a', donnee: 'A', x: 1 }] }, { operation: 'o', liaisons: [{ entree: 'a', donnee: 'A' }], score: 1 },
    { operation: 'o', liaisons: new Array(1) }];
  for (const m of mauvaises) assert.throws(() => resoudreValeursApplication(m, U), TypeError, JSON.stringify(m));
});
test('C2. application : accesseur / héritage / symbole refusés sans exécution', () => {
  let n = 0; const piege = { get() { n += 1; return 'x'; }, enumerable: true };
  const a1 = { liaisons: [{ entree: 'a', donnee: 'A' }] }; Object.defineProperty(a1, 'operation', piege);
  const a2 = { operation: 'o' }; Object.defineProperty(a2, 'liaisons', piege);
  const a3 = { operation: 'o', liaisons: [{ entree: 'a' }] }; Object.defineProperty(a3.liaisons[0], 'donnee', piege);
  const a4 = { operation: 'o', liaisons: [] }; Object.defineProperty(a4.liaisons, 0, piege);
  const a5 = Object.create({ operation: 'o', liaisons: [{ entree: 'a', donnee: 'A' }] });
  const a6 = app('o', ['a', 'A']); a6[Symbol('s')] = 1;
  for (const a of [a1, a2, a3, a4, a5, a6]) assert.throws(() => resoudreValeursApplication(a, [el('A', 1)]), TypeError);
  assert.equal(n, 0);
});
test('C3. l\'ordre reçu des liaisons n\'a aucun sens', () => {
  const U = [el('A', 1), el('B', 2), el('C', 3)];
  const r1 = resoudreValeursApplication(app('o', ['a', 'A'], ['b', 'B'], ['c', 'C']), U);
  const r2 = resoudreValeursApplication(app('o', ['c', 'C'], ['a', 'A'], ['b', 'B']), U);
  assert.deepEqual(r1, r2); assert.deepEqual(Object.keys(r1.valeurs), Object.keys(r2.valeurs));
});

// ============================================================================ D. VALIDATION DE L'UNIVERS
test('D1. univers invalide : TypeError', () => {
  const A = app('o', ['a', 'A']);
  const mauvais = [undefined, null, {}, 'x', [null], ['x'], [[]], [{}], [{ donnee: {}, porteur: {}, acces: {} }],
    [{ ...el('A', 1), score: 1 }], [{ porteur: {}, acces: {} }], [{ donnee: { identite: 'A' }, acces: {} }], [{ donnee: { identite: 'A' }, porteur: {} }],
    [{ donnee: null, porteur: {}, acces: {} }], [{ donnee: [], porteur: {}, acces: {} }], [{ donnee: { identite: '' }, porteur: {}, acces: {} }],
    [{ donnee: { identite: 3 }, porteur: {}, acces: {} }], new Array(1)];
  for (const m of mauvais) assert.throws(() => resoudreValeursApplication(A, m), TypeError, JSON.stringify(m));
});
test('D2. univers : accesseur / héritage / symbole / creux refusés sans exécution', () => {
  let n = 0; const piege = { get() { n += 1; return 'x'; }, enumerable: true };
  const e1 = { porteur: {}, acces: {} }; Object.defineProperty(e1, 'donnee', piege);
  const e2 = { donnee: {}, acces: {} }; Object.defineProperty(e2, 'porteur', piege);
  const e3 = { donnee: { identite: 'A' }, porteur: {} }; Object.defineProperty(e3, 'acces', piege);
  const e4 = { donnee: {}, porteur: {}, acces: {} }; Object.defineProperty(e4.donnee, 'identite', piege);
  const e5 = Object.create(el('A', 1));
  const e6 = el('A', 1); e6[Symbol('s')] = 1;
  const e7 = { donnee: Object.create({ identite: 'A' }), porteur: {}, acces: {} };
  const e8 = []; Object.defineProperty(e8, 0, piege);
  for (const u of [[e1], [e2], [e3], [e4], [e5], [e6], [e7], e8]) assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A']), u), TypeError);
  assert.equal(n, 0);
});
test('D3. forme jamais interprétée : forme absente, invalide ou piégée ne change rien', () => {
  let n = 0;
  const e = el('A', 5); Object.defineProperty(e.donnee, 'forme', { get() { n += 1; return 'x'; }, enumerable: true });
  assert.equal(resoudreValeursApplication(app('o', ['a', 'A']), [e]).valeurs.a, 5);
  const e2 = { donnee: { identite: 'A' }, porteur: { id: 'A', resultat: 6 }, acces: ACC_R };
  assert.equal(resoudreValeursApplication(app('o', ['a', 'A']), [e2]).valeurs.a, 6);
  assert.equal(n, 0);
});

// ============================================================================ E. VALIDATION AVANT LECTURE, PAS DE LECTURE INUTILE
test('E1. univers structurellement invalide : AUCUNE lecture de valeur avant l\'échec (espion)', () => {
  for (const pire of [null, { donnee: { identite: '' }, porteur: {}, acces: {} }, el('A', 2) /* identité dupliquée */, { ...el('B', 1), score: 1 }]) {
    const c = { n: 0 };
    assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A']), [espion('A', 1, c), pire]), TypeError);
    assert.equal(c.n, 0);
  }
});
test('E2. application invalide ou donnée demandée absente : aucune lecture de valeur (espion)', () => {
  const c = { n: 0 };
  assert.throws(() => resoudreValeursApplication({ operation: '', liaisons: [] }, [espion('A', 1, c)]), TypeError);
  assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A'], ['b', 'Q']), [espion('A', 1, c)]), TypeError);
  assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A'], ['a', 'A']), [espion('A', 1, c)]), TypeError);
  assert.equal(c.n, 0);
});
test('E3. porteurs NON demandés jamais consultés (porteur, acces, valeur) ; le demandé l\'est', () => {
  const inutiles = { n: 0 }; const utile = { n: 0 };
  const r = resoudreValeursApplication(app('o', ['a', 'A']), [espion('X', 1, inutiles), espion('A', 42, utile), espion('Y', 2, inutiles), espion('Z', 3, inutiles)]);
  assert.equal(r.valeurs.a, 42); assert.equal(inutiles.n, 0); assert.ok(utile.n > 0);
});
test('E4. erreurs de valeurDePorteur propagées telles quelles (identité incompatible, champ absent, accès invalide, accesseur)', () => {
  const U1 = [{ donnee: { identite: 'A' }, porteur: { id: 'AUTRE', resultat: 1 }, acces: ACC_R }];
  const U2 = [{ donnee: { identite: 'A' }, porteur: { id: 'A' }, acces: ACC_R }];
  const U3 = [{ donnee: { identite: 'A' }, porteur: { id: 'A', resultat: 1 }, acces: {} }];
  const porteur = { id: 'A' }; Object.defineProperty(porteur, 'resultat', { get() { throw new Error('lu'); }, enumerable: true });
  const U4 = [{ donnee: { identite: 'A' }, porteur, acces: ACC_R }];
  for (const U of [U1, U2, U3, U4]) assert.throws(() => resoudreValeursApplication(app('o', ['a', 'A']), U), TypeError);
});

// ============================================================================ F. OBJET valeurs
test('F1. noms dangereux : __proto__, constructor, toString… propriétés propres de donnée, prototype intact', () => {
  const noms = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'prototype'];
  const U = [el('A', 'va')];
  for (const nom of noms) {
    const r = resoudreValeursApplication(app('o', [nom, 'A']), U);
    const d = Object.getOwnPropertyDescriptor(r.valeurs, nom);
    assert.equal(d.value, 'va'); assert.equal(d.enumerable, true);
    assert.equal(Object.getPrototypeOf(r.valeurs), Object.prototype);
    assert.deepEqual(Reflect.ownKeys(r.valeurs), [nom]);
    assert.equal({}.va, undefined); assert.equal(Object.prototype.hasOwnProperty.call(Object.prototype, 'va'), false);
  }
  const r = resoudreValeursApplication(app('o', ['__proto__', 'A'], ['a', 'A']), U);
  assert.deepEqual(Reflect.ownKeys(r.valeurs).sort(), ['__proto__', 'a']);
  assert.equal(Object.getPrototypeOf(r.valeurs), Object.prototype);
});
test('F2. exactement une propriété propre par entrée ; objets neufs à chaque appel ; ni valeurs ni résultat partagés', () => {
  const U = [el('A', 1), el('B', 2)];
  const a = app('o', ['a', 'A'], ['b', 'B']);
  const r1 = resoudreValeursApplication(a, U); const r2 = resoudreValeursApplication(a, U);
  assert.notEqual(r1, r2); assert.notEqual(r1.valeurs, r2.valeurs);
  assert.deepEqual(Reflect.ownKeys(r1.valeurs), ['a', 'b']);
  r1.valeurs.a = 99; r1.operation = 'z';
  assert.equal(resoudreValeursApplication(a, U).valeurs.a, 1);
});
test('F3. entrées inchangées : application, liaisons, univers, donnees, porteurs, acces', () => {
  const U = [el('A', { k: [1] }), el('B', 'b')];
  const a = app('o', ['b', 'B'], ['a', 'A']);
  const avantU = copie(U); const avantA = copie(a);
  const gel = (x) => { if (x && typeof x === 'object') { Object.freeze(x); Object.values(x).forEach(gel); } return x; };
  resoudreValeursApplication(a, U);
  assert.deepEqual(U, avantU); assert.deepEqual(a, avantA);
  assert.doesNotThrow(() => resoudreValeursApplication(gel(copie(a)), gel(U.map((e) => ({ donnee: copie(e.donnee), porteur: copie(e.porteur), acces: copie(e.acces) })))));
});
test('F4. complexité linéaire : 20 000 données, 20 000 liaisons en temps borné', () => {
  const U = []; const liaisons = [];
  for (let i = 0; i < 20000; i += 1) { U.push(el(`d${i}`, i)); liaisons.push([`e${i}`, `d${i}`]); }
  const t = Date.now();
  const r = resoudreValeursApplication(app('o', ...liaisons), U);
  assert.equal(Object.keys(r.valeurs).length, 20000); assert.equal(r.valeurs.e19999, 19999);
  assert.ok(Date.now() - t < 3000);
});

// ============================================================================ G. CHAÎNE RÉELLE ET COMPATIBILITÉ invoquerOperation
async function chaine(lignesExec, message) {
  const magasin = magasinMemoireVive();
  for (const l of lignesExec) await magasin.ecrire('executionsOperations', l);
  const r = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
  return { r, magasin };
}
test('G1. CHAÎNE message seul : observer → groupes → applicationUnique « plusieurs » (parcourirStructure ET symbolesDeChaine) → le test précise parcourirStructure à la main → valeurs : texte ; rien désigné/exécuté', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38
  const M = { id: 'M', texte: 'bonjour le monde' };
  const { r, magasin } = await chaine([], M);
  const groupes = groupesDeCandidats(r.observation.possibilites, DESCRIPTIONS_OPERATIONS);
  assert.equal(applicationUnique(groupes).etat, 'plusieurs');
  const res = resoudreValeursApplication(app('parcourirStructure', ['valeur', 'M']), r.univers);
  assert.deepEqual(res, { operation: 'parcourirStructure', valeurs: { valeur: 'bonjour le monde' } });
  assert.deepEqual(resoudreValeursApplication(app('symbolesDeChaine', ['chaine', 'M']), r.univers), { operation: 'symbolesDeChaine', valeurs: { chaine: 'bonjour le monde' } });
  for (const t of TABLES.filter((x) => x === 'designations' || x === 'executionsOperations')) assert.deepEqual(await magasin.lireTout(t), []);
});
test('G2. CHAÎNE message + production : application précisée À LA MAIN (le test choisit) → valeur du bon porteur', async () => {
  const X = { id: 'X', horodatage: 'h', idDesignation: 'd', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'M0' }], resultat: [{ chemin: [] }] }; // MISE À JOUR DÉLIBÉRÉE v0.63.59 : liaisons réelles (au moins une), entrées(P) exposée pour toute production présente
  const { r } = await chaine([X], { id: 'N', texte: 'suite' });
  assert.equal(applicationUnique(groupesDeCandidats(r.observation.possibilites, DESCRIPTIONS_OPERATIONS)).etat, 'plusieurs');
  assert.equal(resoudreValeursApplication(app('parcourirStructure', ['valeur', 'X']), r.univers).valeurs.valeur, X.resultat);
  assert.equal(resoudreValeursApplication(app('parcourirStructure', ['valeur', 'N']), r.univers).valeurs.valeur, 'suite');
});
test('G3. COMPATIBILITÉ invoquerOperation : parcourirStructure (1 argument positionnel)', () => {
  const V = { a: [1, 2] };
  const { operation, valeurs } = resoudreValeursApplication(app('parcourirStructure', ['valeur', 'V']), [el('V', V)]);
  assert.deepEqual(invoquerOperation(TABLE_OPERATIONS, operation, valeurs), TABLE_OPERATIONS.parcourirStructure.fonction(V));
});
test('G4. COMPATIBILITÉ invoquerOperation : memesCouvertures (2 arguments positionnels, ordre des paramètres respecté)', () => {
  const A = [['a']]; const B = [['a'], ['b']];
  const { operation, valeurs } = resoudreValeursApplication(app('memesCouvertures', ['b', 'B'], ['a', 'A']), [el('B', B), el('A', A)]);
  assert.equal(invoquerOperation(TABLE_OPERATIONS, operation, valeurs), TABLE_OPERATIONS.memesCouvertures.fonction(A, B));
  const inv = resoudreValeursApplication(app('memesCouvertures', ['a', 'B'], ['b', 'A']), [el('B', B), el('A', A)]);
  assert.equal(invoquerOperation(TABLE_OPERATIONS, inv.operation, inv.valeurs), TABLE_OPERATIONS.memesCouvertures.fonction(B, A));
});
test('G5. COMPATIBILITÉ invoquerOperation : couvrirSequence (convention objet)', () => {
  const elements = ['a', 'b']; const plages = [];
  const { operation, valeurs } = resoudreValeursApplication(app('couvrirSequence', ['plages', 'P'], ['elements', 'E']), [el('E', elements), el('P', plages)]);
  assert.deepEqual(invoquerOperation(TABLE_OPERATIONS, operation, valeurs), TABLE_OPERATIONS.couvrirSequence.fonction({ elements, plages }));
});
test('G6. valeurs ne porte QUE les paramètres : la table d\'invocation accepte exactement (aucune clé en trop)', () => {
  const { operation, valeurs } = resoudreValeursApplication(app('parcourirStructure', ['valeur', 'V']), [el('V', 'x')]);
  assert.deepEqual(Reflect.ownKeys(valeurs), TABLE_OPERATIONS[operation].parametres);
});

// ============================================================================ H. SÉPARATION, DORMANCE, VERSIONS
test('H1. le module ne connaît ni applicationUnique, ni catalogue, ni table, ni magasin, ni désignation, ni exécution, ni invocation', () => {
  assert.equal(/applicationUnique|application-unique|groupesDeCandidats|groupes-candidats|TABLE_OPERATIONS|table-operations|DESCRIPTIONS_OPERATIONS|descriptions-operations|invoquerOperation|invocation-operations|enregistrerDesignation|enregistrerExecutionOperation|magasin|ecrire|lireTout|etat|plusieurs|unique/.test(CODE), false);
  assert.equal(/Math\.random|Date\b|score|\.at\(|async|await|JSON\.|structuredClone|\.slice\(|\.concat\(/.test(CODE), false, 'aucune copie ni transformation de valeur');
  // MISE À JOUR DÉLIBÉRÉE v0.63.39 : `.map(` est autorisé pour les deux SEULES constructions de l'entrée collective (liste des éléments retenus, éléments { identite, valeur }) ; une valeur ordinaire n'est jamais copiée ni transformée.
  assert.equal((CODE.match(/\.map\(/g) || []).length, 2);
  assert.equal(/\.forme\b|'forme'/.test(CODE), false, 'forme jamais interprétée');
});
test('H2. aucun fichier de production n\'importe ni ne nomme valeurs-application / resoudreValeursApplication', () => {
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => rel(f) !== 'app/langage/valeurs-application.js' && rel(f) !== 'app/langage/applications-sollicitables.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.61 : applications-sollicitables.js résout les valeurs de chaque combinaison pour juger les relations */ && rel(f) !== 'app/langage/execution-sollicitee.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.34 : execution-sollicitee.js (primitive d'exécution sollicitée, dormante) importe ces primitives. */ && /valeurs-application|resoudreValeursApplication/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel);
  assert.deepEqual(nommant, []);
});
test('H3. graphe d\'imports depuis main.js : valeurs-application, application-unique, acces-valeur, invocation-operations, table-operations inatteignables', () => {
  const vus = new Set();
  const visiter = (f) => {
    if (vus.has(f)) return; vus.add(f);
    let s; try { s = sansCommentaires(readFileSync(f, 'utf8')); } catch { return; }
    for (const m of s.matchAll(/(?:import|export)\b[^;]*?from\s+'(\.[^']+)'|import\(\s*'(\.[^']+)'\s*\)/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations)\.js$/.test(c))) visiter(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs)
  };
  visiter(join(RACINE, 'app', 'main.js'));
  const atteints = new Set([...vus].map(rel));
  for (const n of ['valeurs-application', 'application-unique', 'acces-valeur', 'invocation-operations', 'table-operations', 'groupes-candidats']) assert.equal(atteints.has(`app/langage/${n}.js`), false, n);
});
test('H4. applicationUnique et groupes-candidats ne l\'importent pas ; seul valeurs-application importe acces-valeur', () => {
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /from '\.\/acces-valeur\.js'/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel);
  assert.deepEqual(importeurs, ['app/langage/episodes-de-transformation.js', 'app/langage/valeurs-application.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.69 : retours-de-valeur.js remplacé par episodes-de-transformation.js (vue dormante, seule source de vérité). MISE À JOUR DÉLIBÉRÉE v0.63.68 : + retours-de-valeur.js (vue dormante, jamais importée) ; applicationUnique et groupes-candidats ne l'importent toujours pas
});
test('H5. versions inchangées : VERSION_BASE 18, SCHEMA 8, 21 tables', () => {
  assert.equal(VERSION_BASE, 21); assert.equal(SCHEMA_SAUVEGARDE, 11); assert.equal(TABLES.length, 24); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables)
});
// === FIN_TEST_VALEURS_APPLICATION ===
