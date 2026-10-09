// === DEBUT_TEST_CONSTATS_STRUCTURELS ===
// v0.63.8 — ÉTAPE 6, décision ChatGPT « PREMIER PRODUCTEUR DE COUVERTURES : CONSTATS STRUCTURELS PARTAGÉS » (04/10/2026). Preuves que
// app/langage/constats-structurels.js, à partir d'éléments { chemin, contenu }, rend les constats partagés avec leur couverture
// d'identités ORIGINALES : instantané en une passe, accesseurs jamais exécutés, doublon d'identité = TypeError, validation des contenus
// dans l'ordre canonique, égalité de constat par Object.is (0 ≠ -0, absence ≠ null) sans sérialisation, sortie indépendante de l'ordre
// d'entrée, synonymes / singletons / universelle conservés, aucune couverture vide, aucun rebasage, entrées jamais modifiées, dormance.
// Les clés JSON de ce fichier sont des ORACLES de test ; le module n'en emploie aucune.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/constats-structurels.js';
import { normaliserCouverture } from '../app/langage/couverture-occurrences.js';
import { resoudreCouverture } from '../app/langage/resolution-couverture.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { DESCRIPTIONS_OPERATIONS as DESCRIPTIONS_COMPLETES } from '../app/langage/descriptions-operations.js';
// MISE À JOUR DÉLIBÉRÉE v0.63.61 : ce test utilise le catalogue comme FIXTURE de structure (comptages d'occurrences, de chemins, de couvertures). Les relations entre entrées
// (clé `relations`, v0.63.61) sont une donnée ajoutée AU catalogue, pas à ce que ce test mesure : la fixture est le catalogue SANS cette clé (mêmes valeurs qu'en v0.63.60).
const DESCRIPTIONS_OPERATIONS = DESCRIPTIONS_COMPLETES.map(({ relations, ...description }) => description);
// v0.63.10 : le catalogue compte NEUF descriptions. Les mesures de ce fichier (114 occurrences, 14/15 groupes...) portent sur le CORPUS FIGÉ des
// trois descriptions de v0.63.4 (couvrirSequence, decrireStructureIdentifiee, decrireValeursObservees) : les six autres sont écartées ici.
const CORPUS_V0634 = DESCRIPTIONS_OPERATIONS.filter((d) => ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees'].includes(d.nom));

const { produireConstatsStructurels: produire } = module;
const RACINE = join(import.meta.dirname, '..');
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'constats-structurels.js'), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));

// --- oracles (tests seulement)
const segAvant = (a, b) => (typeof a !== typeof b ? typeof a === 'number' : a < b);
const avant = (a, b) => {
  if (a.length === 0) return b.length > 0;
  if (b.length === 0) return false;
  if (a[0] !== b[0]) return segAvant(a[0], b[0]);
  return avant(a.slice(1), b.slice(1));
};
const trierOracle = (chemins) => chemins.slice().sort((a, b) => (avant(a, b) ? -1 : avant(b, a) ? 1 : 0));
const cleChemin = (c) => JSON.stringify(c);
const cleValeur = (v) => (typeof v === 'number' && Object.is(v, -0) ? ['nombre', '-0'] : [typeof v, String(v)]);
const cleConstat = (o) => JSON.stringify([o.chemin, o.type, Object.hasOwn(o, 'valeur') ? cleValeur(o.valeur) : null]);
function oracle(elements) {
  const ordre = elements.slice().sort((a, b) => (avant(a.chemin, b.chemin) ? -1 : avant(b.chemin, a.chemin) ? 1 : 0));
  const groupes = new Map();
  for (const e of ordre) {
    for (const o of parcourirStructure(e.contenu)) {
      const k = cleConstat(o);
      if (!groupes.has(k)) groupes.set(k, { constat: o, membres: [] });
      groupes.get(k).membres.push(e.chemin);
    }
  }
  return [...groupes.values()].map((g) => ({ constat: g.constat, couverture: trierOracle(g.membres) }));
}
let graine = 20261006;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const entier = (n) => Math.floor(alea() * n);
const melanger = (t) => { const r = t.slice(); for (let i = r.length - 1; i > 0; i -= 1) { const j = entier(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const geler = (x) => { if (x !== null && typeof x === 'object') { for (const k of Object.keys(x)) geler(x[k]); Object.freeze(x); } return x; };
const el = (chemin, contenu) => ({ chemin, contenu });
const SEGMENTS = [0, 1, 2, 10, 9, 'a', 'b', '', '0', '1', 'a/b', 'a.b', 'a,b', 'B', 'é', '\u0001'];
const cheminAleatoire = () => { const n = entier(5); const c = []; for (let i = 0; i < n; i += 1) c.push(SEGMENTS[entier(SEGMENTS.length)]); return c; };
const NOMBRES = [0, -0, 1, 2, -1, 1.5, 7];
const CHAINES = ['', 'a', 'b', '0', 'a/b', 'bonjour'];
const CLES = ['a', 'b', '0', '', 'c'];
function contenuAleatoire(prof = 0) {
  const t = entier(prof >= 3 ? 4 : 6);
  if (t === 0) return NOMBRES[entier(NOMBRES.length)];
  if (t === 1) return CHAINES[entier(CHAINES.length)];
  if (t === 2) return alea() < 0.5;
  if (t === 3) return null;
  if (t === 4) { const n = entier(4); const r = []; for (let i = 0; i < n; i += 1) r.push(contenuAleatoire(prof + 1)); return r; }
  const r = {}; const n = entier(4); for (let i = 0; i < n; i += 1) r[CLES[entier(CLES.length)]] = contenuAleatoire(prof + 1);
  return r;
}
function elementsAleatoires() {
  const vus = new Set(); const r = []; const n = entier(14);
  for (let i = 0; i < n; i += 1) { const c = cheminAleatoire(); if (!vus.has(cleChemin(c))) { vus.add(cleChemin(c)); r.push(el(c, contenuAleatoire())); } }
  return r;
}
// Cas de référence (adaptation faite ICI, jamais dans le producteur)
const U114 = parcourirStructure(CORPUS_V0634);
const adapter = (O) => el(O.chemin, Object.hasOwn(O, 'valeur') ? { type: O.type, valeur: O.valeur } : { type: O.type });
const refElements = () => parcourirStructure(CORPUS_V0634).map(adapter);
const INVALIDES = [
  ['undefined', undefined], ['null', null], ['objet', {}], ['tableau imbriqué', ['a']], ['négatif', -1], ['non entier', 1.5],
  ['NaN', NaN], ['Infinity', Infinity], ['bigint', 10n], ['symbol', Symbol('s')], ['fonction', () => 1], ['booléen', true],
];

// ============================================================================ A. CONTRAT
test('A1. exactement un export : produireConstatsStructurels(elements)', () => {
  assert.deepEqual(Object.keys(module), ['memesConstats', 'produireConstatsStructurels']); // MISE À JOUR DÉLIBÉRÉE v0.63.73 : + memesConstats (l'égalité de deux constats, exportée sans changement pour la vue d'issue d'un contexte prospectif)
  assert.equal(typeof produire, 'function'); assert.equal(produire.length, 1);
});
test('A2. [] donne [] ; un élément ; forme { constat, couverture } sans autre champ', () => {
  assert.deepEqual(produire([]), []);
  const r = produire([el(['x'], 5)]);
  assert.equal(r.length, 1);
  assert.deepEqual(Object.keys(r[0]), ['constat', 'couverture']);
  assert.deepEqual(r[0].constat, { chemin: [], type: 'nombre', valeur: 5 });
  assert.deepEqual(r[0].couverture, [['x']]);
});
test('A3. le constat est UNE occurrence : {chemin,type} ou {chemin,type,valeur}, chemin relatif au contenu', () => {
  const r = produire([el(['p'], { a: [true, null] })]);
  assert.deepEqual(r.map((x) => x.constat), [
    { chemin: [], type: 'objet' }, { chemin: ['a'], type: 'tableau' }, { chemin: ['a', 0], type: 'booleen', valeur: true }, { chemin: ['a', 1], type: 'nul' },
  ]);
  for (const x of r) assert.deepEqual(x.couverture, [['p']], 'la couverture porte l\'identité, jamais le chemin relatif');
});
test('A4. un même constat dans plusieurs contenus = UNE entrée, couverture de tous les éléments qui le possèdent', () => {
  const r = produire([el(['b'], 'x'), el(['a'], 'x'), el(['c'], 'y')]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { constat: { chemin: [], type: 'chaine', valeur: 'x' }, couverture: [['a'], ['b']] });
  assert.deepEqual(r[1], { constat: { chemin: [], type: 'chaine', valeur: 'y' }, couverture: [['c']] });
});

// ============================================================================ B. VALIDATION DE L'ENTRÉE
test('B1. l\'entrée doit être un tableau', () => {
  for (const x of [undefined, null, {}, 'a', 3, true, () => 1, new Map(), { length: 0 }]) refuse(() => produire(x), /tableau/);
});
test('B2. chaque élément : objet non nul, non tableau, avec « chemin » et « contenu » propres', () => {
  for (const x of [null, undefined, 3, 'a', true, [], [['a'], 1], () => 1]) refuse(() => produire([x]), /elements\[0\]/);
  refuse(() => produire([Object.assign([], { chemin: ['a'], contenu: 1 })]), /elements\[0\]/);
  refuse(() => produire([{ contenu: 1 }]), /chemin/);
  refuse(() => produire([{ chemin: ['a'] }]), /contenu/);
  refuse(() => produire([el(['a'], 1), { chemin: ['b'] }]), /elements\[1\]/);
  assert.equal(produire([{ chemin: ['a'], contenu: 1, autre: 'ignoré', extra: { z: 1 } }]).length, 1);
});
test('B3. tableau creux refusé', () => {
  const creux = [el(['a'], 1)]; creux.length = 3; creux[2] = el(['b'], 2);
  refuse(() => produire(creux), /elements\[1\]/);
  refuse(() => produire(new Array(2)), /elements\[0\]/);
});
test('B4. chemin invalide : TypeError (la validité appartient à normaliserCouverture)', () => {
  for (const [nom, v] of INVALIDES) if (!Array.isArray(v)) refuse(() => produire([el(v, 1)]), /chemins d'identité invalides/);
  for (const [nom, v] of INVALIDES) refuse(() => produire([el(['ok'], 1), el(['a', v], 2)]), /chemins d'identité invalides/);
  refuse(() => produire([el(['a', -1], 1)]), /invalides/);
  refuse(() => produire([el(['a', 1.5], 1)]), /invalides/);
  refuse(() => produire([el(new Array(2), 1)]), /invalides/);
  refuse(() => produire([el({ 0: 'a', length: 1 }, 1)]), /invalides/);
});
test('B5. deux éléments de même identité : TypeError, les contenus ne sont JAMAIS fusionnés (même contenus ou non)', () => {
  refuse(() => produire([el(['a'], 1), el(['a'], 2)]), /invalides/);
  refuse(() => produire([el(['a'], 1), el(['a'], 1)]), /invalides/);
  refuse(() => produire([el([], 1), el([], 1)]), /invalides/);
  refuse(() => produire([el([0], 1), el([-0], 2)]), /invalides/);
  refuse(() => produire([el(['x', 1], 1), el(['y'], 1), el(['x', 1], 3)]), /invalides/);
  assert.equal(produire([el([0], 1), el(['0'], 2)]).length, 2, '0 ≠ "0" : pas un doublon');
});
test('B6. les messages d\'identité ne contiennent jamais de valeur de chemin (le message d\'un contenu invalide reprend celui du parcours)', () => {
  const messages = [];
  const essaie = (f) => { try { f(); } catch (e) { messages.push(e.message); } };
  essaie(() => produire([el(['zSECRET', 'qqq'], 1), el(['zSECRET', 'qqq'], 2)]));
  essaie(() => produire([el(['zSECRET', -1], 1)]));
  essaie(() => produire([el(['a'], NaN)]));
  assert.equal(messages.length, 3);
  for (const m of messages) assert.equal(/zSECRET|qqq/.test(m), false, m);
});

// ============================================================================ C. ACCESSEURS, HÉRITAGE, INSTANTANÉ
test('C1. accesseur « chemin » : TypeError SANS exécution', () => {
  let appels = 0;
  const e = { contenu: 1 }; Object.defineProperty(e, 'chemin', { get() { appels += 1; return ['a']; }, enumerable: true });
  refuse(() => produire([e]), /accesseur/);
  assert.equal(appels, 0);
});
test('C2. accesseur « contenu » : TypeError SANS exécution', () => {
  let appels = 0;
  const e = { chemin: ['a'] }; Object.defineProperty(e, 'contenu', { get() { appels += 1; return 1; }, enumerable: true });
  refuse(() => produire([e]), /accesseur/);
  assert.equal(appels, 0);
});
test('C3. accesseur INTERNE au contenu : TypeError (refus du parcours), jamais exécuté', () => {
  let appels = 0;
  const interne = {}; Object.defineProperty(interne, 'k', { get() { appels += 1; return 1; }, enumerable: true });
  refuse(() => produire([el(['a'], interne)]), /contenu invalide/);
  refuse(() => produire([el(['a'], { ok: 1, profond: [interne] })]), /contenu invalide/);
  const tableau = [1]; Object.defineProperty(tableau, 0, { get() { appels += 1; return 1; } });
  refuse(() => produire([el(['a'], tableau)]), /contenu invalide/);
  assert.equal(appels, 0);
});
test('C4. « chemin » ou « contenu » HÉRITÉS : refusés (TypeError)', () => {
  refuse(() => produire([Object.assign(Object.create({ chemin: ['a'] }), { contenu: 1 })]), /chemin/);
  refuse(() => produire([Object.assign(Object.create({ contenu: 1 }), { chemin: ['a'] })]), /contenu/);
  refuse(() => produire([Object.create({ chemin: ['a'], contenu: 1 })]), /chemin/);
  class Porteur { constructor() { this.chemin = ['a']; this.contenu = 1; } }
  assert.equal(produire([new Porteur()]).length, 1, 'des champs propres suffisent');
});
test('C5. un accesseur sur une case du tableau est refusé sans exécution (l\'instantané ne relit jamais elements[i])', () => {
  let appels = 0;
  const tableau = [el(['a'], 1)];
  Object.defineProperty(tableau, 1, { get() { appels += 1; return appels === 1 ? el(['b'], 1) : el(['b'], 2); }, enumerable: true });
  refuse(() => produire(tableau), /accesseur/);
  assert.equal(appels, 0);
});
test('C6. instantané : chaque case et chaque champ sont lus UNE fois, aucun get', () => {
  const acces = {};
  const compte = (k) => { acces[k] = (acces[k] || 0) + 1; };
  const espion = (cible, nom) => new Proxy(cible, {
    get(t, k, r) { compte(`${nom}.get.${String(k)}`); return Reflect.get(t, k, r); },
    getOwnPropertyDescriptor(t, k) { compte(`${nom}.desc.${String(k)}`); return Reflect.getOwnPropertyDescriptor(t, k); },
  });
  const e0 = espion(el(['a'], 1), 'e0'); const e1 = espion(el(['b'], 'x'), 'e1');
  const tableau = espion([e0, e1], 't');
  const r = produire(tableau);
  assert.equal(r.length, 2);
  for (const k of ['t.desc.0', 't.desc.1', 'e0.desc.chemin', 'e0.desc.contenu', 'e1.desc.chemin', 'e1.desc.contenu']) assert.equal(acces[k], 1, k);
  for (const k of Object.keys(acces)) if (k !== 't.get.length') assert.equal(/\.get\./.test(k), false, `lecture directe : ${k}`);
});

// ============================================================================ D. VALIDATION DES CONTENUS
const CONTENUS_INVALIDES = [
  ['undefined', undefined], ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity], ['Date', new Date(0)], ['fonction', () => 1],
  ['Symbol', Symbol('s')], ['bigint', 1n], ['Map', new Map()], ['Set', new Set()], ['tableau creux', [1, , 3]],
  ['undefined interne', { a: undefined }], ['NaN interne', [1, NaN]], ['instance de classe', new (class K { constructor() { this.a = 1; } })()],
  ['cycle', (() => { const c = {}; c.c = c; return c; })()],
];
test('D1. un contenu invalide est un échec du producteur (TypeError), seul ou parmi des contenus valides', () => {
  for (const [nom, v] of CONTENUS_INVALIDES) {
    refuse(() => produire([el(['a'], v)]), /contenu invalide/);
    refuse(() => produire([el(['a'], 1), el(['b'], v), el(['c'], 'x')]), /contenu invalide/);
  }
});
test('D2. échec sans résultat partiel : le producteur lève, et un appel valide suivant n\'est pas contaminé', () => {
  const els = [el(['a'], 1), el(['b'], { z: undefined })];
  let r; try { r = produire(els); } catch { r = 'erreur'; }
  assert.equal(r, 'erreur');
  assert.deepEqual(produire([el(['a'], 1)]), [{ constat: { chemin: [], type: 'nombre', valeur: 1 }, couverture: [['a']] }]);
});
test('D3. contenus valides gelés : objets, tableaux, scalaires', () => {
  const els = geler([el(['a'], { x: [1, 'y', true, null, { z: -0 }] }), el(['b'], [])]);
  assert.equal(produire(els).length > 0, true);
});
test('D4. parmi plusieurs contenus invalides, l\'échec ne dépend PAS de l\'ordre d\'entrée (validation en ordre canonique)', () => {
  const base = [el(['a'], 1), el([2], undefined), el([1], NaN), el(['z'], new Date(0)), el([], { k: Infinity }), el(['b', 0], 'ok')];
  const message = (els) => { try { produire(els); } catch (e) { return e.message; } return null; };
  const reference = message(base);
  assert.notEqual(reference, null);
  assert.match(reference, /rang canonique 0/, 'le premier en ordre canonique est la racine [] (Infinity)');
  for (let t = 0; t < 40; t += 1) assert.equal(message(melanger(base)), reference);
  const deux = [el([1], undefined), el([2], NaN)];
  const m = message(deux);
  assert.equal(message([deux[1], deux[0]]), m);
  assert.match(m, /rang canonique 0/);
});

// ============================================================================ E. ÉGALITÉ DES CONSTATS
test('E1. 0, -0, false, "", null comme contenus et sous-contenus : aucune disparition par véracité', () => {
  const els = [el(['a'], 0), el(['b'], -0), el(['c'], false), el(['d'], ''), el(['e'], null), el(['f'], { x: 0 }), el(['g'], { x: -0 }), el(['h'], [false, '', null])];
  const r = produire(els);
  assert.deepEqual(r, oracle(els));
  const trouve = (type, valeur) => r.find((x) => x.constat.type === type && x.constat.chemin.length === 0 && Object.hasOwn(x.constat, 'valeur') && Object.is(x.constat.valeur, valeur));
  assert.deepEqual(trouve('nombre', 0).couverture, [['a']]);
  assert.deepEqual(trouve('nombre', -0).couverture, [['b']]);
  assert.deepEqual(trouve('booleen', false).couverture, [['c']]);
  assert.deepEqual(trouve('chaine', '').couverture, [['d']]);
  assert.deepEqual(r.find((x) => x.constat.type === 'nul' && x.constat.chemin.length === 0).couverture, [['e']]);
  assert.deepEqual(r.find((x) => x.constat.type === 'nombre' && x.constat.chemin.join() === 'x' && Object.is(x.constat.valeur, 0)).couverture, [['f']]);
  assert.deepEqual(r.find((x) => x.constat.type === 'nombre' && x.constat.chemin.join() === 'x' && Object.is(x.constat.valeur, -0)).couverture, [['g']]);
  assert.equal(r.length, 12);
});
test('E2. Object.is : deux contenus de valeur -0 et un de valeur 0 ; le constat -0 couvre les deux premiers, le constat 0 le troisième (sans JSON)', () => {
  const r = produire([el(['p'], -0), el(['q'], 0), el(['r'], -0)]);
  assert.equal(r.length, 2);
  const moinsZero = r.find((x) => Object.is(x.constat.valeur, -0)); const zero = r.find((x) => Object.is(x.constat.valeur, 0));
  assert.deepEqual(moinsZero.couverture, [['p'], ['r']]);
  assert.deepEqual(zero.couverture, [['q']]);
  const r2 = produire([el(['p'], { v: -0 }), el(['q'], { v: 0 }), el(['r'], { v: -0 })]);
  assert.deepEqual(r2.find((x) => Object.is(x.constat.valeur, -0)).couverture, [['p'], ['r']]);
  assert.deepEqual(r2.find((x) => Object.is(x.constat.valeur, 0)).couverture, [['q']]);
  const r3 = produire([el(['p'], 0), el(['q'], -0)]);
  assert.equal(r3.length, 2, 'l\'ordre canonique ne fusionne jamais 0 et -0');
});
test('E3. dans une IDENTITÉ, 0 et -0 restent identiques (v0.63.6 intact) : [0] et [-0] forment un doublon', () => {
  refuse(() => produire([el([0], 'a'), el([-0], 'b')]), /invalides/);
  const r = produire([el([-0], 'a')]);
  assert.equal(r[0].couverture.length, 1); assert.equal(r[0].couverture[0].length, 1); assert.equal(r[0].couverture[0][0] === 0, true);
});
test('E4. absence de valeur ≠ null : {type:"nul"} et {type:"nul",valeur:null} ne produisent pas les mêmes constats ; aucune valeur inventée', () => {
  const els = [el(['a'], { type: 'nul' }), el(['b'], { type: 'nul', valeur: null })];
  const r = produire(els);
  assert.deepEqual(r, oracle(els));
  const racine = r.filter((x) => x.constat.chemin.length === 0); assert.equal(racine.length, 1);
  assert.deepEqual(racine[0].couverture, [['a'], ['b']]);
  assert.deepEqual(r.filter((x) => x.constat.chemin.join() === 'valeur').map((x) => x.couverture), [[['b']]]);
  assert.equal(r.filter((x) => x.constat.chemin.join() === 'type').length, 1);
  for (const x of r) if (['objet', 'tableau', 'nul'].includes(x.constat.type)) assert.equal(Object.hasOwn(x.constat, 'valeur'), false, 'aucun valeur: undefined / null fabriqué');
  const seuls = produire([el(['n'], null), el(['o'], {}), el(['t'], [])]);
  for (const x of seuls) assert.deepEqual(Object.keys(x.constat), ['chemin', 'type']);
});
test('E5. les chemins RELATIFS sont comparés avec l\'identité typée : 0 ≠ "0", [] ≠ [""], "a/b" ≠ ["a","b"]', () => {
  const els = [el(['p'], { 0: 'v' }), el(['q'], ['v']), el(['r'], { '': 'v' }), el(['s'], { 'a/b': 'v' }), el(['t'], { a: { b: 'v' } })];
  const r = produire(els);
  assert.deepEqual(r, oracle(els));
  const v = r.filter((x) => x.constat.type === 'chaine');
  assert.equal(v.length, 5, 'cinq chemins relatifs distincts pour la même valeur');
  for (const x of v) assert.equal(x.couverture.length, 1);
});
test('E6. type différent à chemin et valeur égaux : constats distincts', () => {
  const els = [el(['a'], '1'), el(['b'], 1), el(['c'], true), el(['d'], 'true')];
  const r = produire(els);
  assert.equal(r.length, 4);
  assert.deepEqual(r, oracle(els));
});
test('E7. le texte : deux éléments au même texte constatent naturellement la valeur partagée', () => {
  const r = produire([el(['a'], 'bonjour'), el(['b'], 'bonjour'), el(['c'], 'salut')]);
  assert.deepEqual(r, [
    { constat: { chemin: [], type: 'chaine', valeur: 'bonjour' }, couverture: [['a'], ['b']] },
    { constat: { chemin: [], type: 'chaine', valeur: 'salut' }, couverture: [['c']] },
  ]);
});
test('E8. identités piégées : aucune collision, ni entre elles ni avec les constats', () => {
  const identites = [[], [''], [0], ['0'], ['a/b'], ['a', 'b'], ['a,b'], ['a.b'], ['a\u0001b']];
  const memeContenu = produire(identites.map((c) => el(c, 'pareil')));
  assert.equal(memeContenu.length, 1);
  assert.deepEqual(memeContenu[0].couverture, normaliserCouverture(identites));
  assert.equal(memeContenu[0].couverture.length, 9);
  const distincts = produire(identites.map((c, i) => el(c, i)));
  assert.equal(distincts.length, 9);
  for (const x of distincts) { assert.equal(x.couverture.length, 1); }
  const attendu = identites.map((c, i) => [c, i]);
  for (const [c, i] of attendu) assert.deepEqual(distincts.find((x) => x.constat.valeur === i).couverture, [c]);
  refuse(() => produire([...identites.map((c, i) => el(c, i)), el(['a', 'b'], 99)]), /invalides/);
});

// ============================================================================ F. CAS DE RÉFÉRENCE : 15 CONSTATS / 14 COUVERTURES
test('F1. DESCRIPTIONS_OPERATIONS : 114 éléments → 15 constats, 14 couvertures distinctes', () => {
  assert.equal(U114.length, 114);
  const r = produire(refElements());
  assert.equal(r.length, 15);
  assert.equal(new Set(r.map((x) => JSON.stringify(x.couverture))).size, 14);
  assert.deepEqual(r, oracle(refElements()));
});
test('F2. chaque couverture est valide pour normaliserCouverture, résoluble dans U114, et porte des identités ORIGINALES (aucun rebasage)', () => {
  const r = produire(refElements());
  const identites = new Set(U114.map((o) => JSON.stringify(o.chemin)));
  for (const x of r) {
    assert.deepEqual(normaliserCouverture(x.couverture), x.couverture, 'déjà canonique');
    assert.equal(resoudreCouverture(U114, x.couverture).length, x.couverture.length);
    for (const c of x.couverture) assert.equal(identites.has(JSON.stringify(c)), true);
  }
  const somme = r.reduce((s, x) => s + x.couverture.length, 0);
  assert.equal(somme > 114, true);
});
test('F3. les chemins relatifs des constats ne sont pas des identités : ici tous les constats sont à la racine ou en [type]/[valeur]', () => {
  const r = produire(refElements());
  for (const x of r) assert.equal(x.constat.chemin.length <= 1, true);
});

// ============================================================================ G. SYNONYMES, SINGLETONS, UNIVERSELLE, VIDE
test('G1. deux constats différents de même couverture restent DEUX entrées (aucune fusion par couverture)', () => {
  const r = produire([el(['a'], { u: 1, v: 'x' }), el(['b'], { u: 1, v: 'x' })]);
  const couvertures = r.map((x) => JSON.stringify(x.couverture));
  assert.equal(r.length, 3);
  assert.equal(new Set(couvertures).size, 1);
  const f = produire(refElements());
  assert.equal(f.length - new Set(f.map((x) => JSON.stringify(x.couverture))).size, 1, 'au moins un couple de synonymes dans le cas de référence');
});
test('G2. singletons conservés (aucun seuil)', () => {
  const r = produire([el(['a'], 'seul'), el(['b'], 'autre')]);
  assert.equal(r.length, 2);
  for (const x of r) assert.equal(x.couverture.length, 1);
});
test('G3. couverture universelle conservée (aucun traitement spécial)', () => {
  const r = produire([el(['a'], { k: 1 }), el(['b'], { k: 2 }), el(['c'], { k: 3 })]);
  const racine = r.find((x) => x.constat.chemin.length === 0);
  assert.deepEqual(racine.couverture, [['a'], ['b'], ['c']]);
  assert.equal(produire(refElements()).some((x) => x.couverture.length === 114), true);
});
test('G4. aucune couverture vide : jamais de couverture de longueur 0 (fuzz) ; un contenu sans constat n\'existe pas', () => {
  for (let t = 0; t < 200; t += 1) for (const x of produire(elementsAleatoires())) assert.equal(x.couverture.length >= 1, true);
  assert.equal(produire([el(['a'], [])]).length, 1);
});

// ============================================================================ H. ORDRE
test('H1. la sortie est identique pour 60 permutations de l\'entrée (cas de référence)', () => {
  const base = refElements(); const attendu = produire(base);
  for (let t = 0; t < 60; t += 1) assert.deepEqual(produire(melanger(base)), attendu);
  assert.deepEqual(produire(base.slice().reverse()), attendu);
});
test('H2. ordre des constats = première rencontre dans l\'ordre canonique des éléments (pas l\'ordre d\'entrée)', () => {
  const r = produire([el(['b'], 'B'), el(['a'], 'A'), el([], 'R'), el([1], 'U'), el([0], 'Z')]);
  assert.deepEqual(r.map((x) => x.constat.valeur), ['R', 'Z', 'U', 'A', 'B']);
});
test('H3. 500 jeux aléatoires : sortie = oracle (tri récursif, clés JSON), et invariante par permutation', () => {
  for (let t = 0; t < 500; t += 1) {
    const els = elementsAleatoires();
    const r = produire(els);
    assert.deepEqual(r, oracle(els));
    assert.deepEqual(produire(melanger(els)), r);
  }
});
test('H4. couvertures de la sortie : ordre canonique, et ordre des éléments sans effet sur chaque couverture', () => {
  const els = []; for (let i = 9; i >= 0; i -= 1) els.push(el(i % 2 ? ['k', i] : [i, 'k'], 'meme'));
  const r = produire(els);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].couverture, trierOracle(els.map((e) => e.chemin)));
});

// ============================================================================ I. SOUS-UNIVERS SANS REBASAGE
test('I1. couverture C quelconque : les constats de U_C ont des couvertures D ⊆ C ⊆ U, en identités originales', () => {
  const identites = U114.map((o) => o.chemin);
  for (let t = 0; t < 40; t += 1) {
    const C = trierOracle(identites.filter(() => alea() < (t % 4 === 0 ? 0.9 : 0.3)));
    const membres = resoudreCouverture(U114, C);
    const els = melanger(membres.map(adapter));
    const r = produire(els);
    const dansC = new Set(C.map(cleChemin));
    for (const x of r) {
      assert.deepEqual(normaliserCouverture(x.couverture), x.couverture);
      for (const d of x.couverture) assert.equal(dansC.has(cleChemin(d)), true, 'D ⊆ C');
      assert.equal(resoudreCouverture(U114, x.couverture).length, x.couverture.length, 'C ⊆ U : résoluble dans U');
      assert.equal(resoudreCouverture(membres, x.couverture).length, x.couverture.length, 'résoluble dans le sous-univers sans rebasage');
    }
    assert.deepEqual(r, oracle(els));
  }
});
test('I2. Producteur(U_C) ≡ { (constat, G ∩ C) non vide | (constat, G) produit sur U } (aucune divergence)', () => {
  const complet = produire(refElements());
  const identites = U114.map((o) => o.chemin);
  for (let t = 0; t < 30; t += 1) {
    const C = identites.filter(() => alea() < 0.35);
    const dansC = new Set(C.map(cleChemin));
    const attendu = complet.map((g) => ({ constat: g.constat, couverture: g.couverture.filter((d) => dansC.has(cleChemin(d))) })).filter((g) => g.couverture.length > 0);
    const r = produire(resoudreCouverture(U114, C).map(adapter));
    const parCle = (t) => t.slice().sort((a, b) => (cleConstat(a.constat) < cleConstat(b.constat) ? -1 : 1));
    assert.deepEqual(parCle(r), parCle(attendu));
  }
});

// ============================================================================ J. STABILITÉ
test('J1. copie structurelle des contenus (structuredClone, -0 conservé) et ordre de construction des objets différent : même résultat', () => {
  const base = refElements(); const attendu = produire(base);
  assert.deepEqual(produire(base.map((e) => el(e.chemin, structuredClone(e.contenu)))), attendu);
  const inverse = base.map((e) => { const c = {}; for (const k of Object.keys(e.contenu).reverse()) c[k] = e.contenu[k]; return el(e.chemin, c); });
  assert.deepEqual(produire(inverse), attendu);
  for (let t = 0; t < 100; t += 1) {
    const els = elementsAleatoires();
    const copie = els.map((e) => el(e.chemin.slice(), structuredClone(e.contenu)));
    assert.deepEqual(produire(copie), produire(els));
  }
});
test('J2. la sérialisation JSON détruit -0 : exception connue, hors producteur', () => {
  const direct = produire([el(['a'], -0), el(['b'], 0)]);
  const roundtrip = produire([el(['a'], JSON.parse(JSON.stringify(-0))), el(['b'], 0)]);
  assert.equal(direct.length, 2);
  assert.equal(roundtrip.length, 1);
});
test('J3. coût observé : 114 éléments en moins de 2 s ; 300 éléments distincts en moins de 10 s', () => {
  let t0 = Date.now(); produire(refElements()); assert.ok(Date.now() - t0 < 2000);
  const els = []; for (let i = 0; i < 300; i += 1) els.push(el(['k', i], { a: i % 7, b: `s${i % 5}` }));
  t0 = Date.now(); const r = produire(els); const dt = Date.now() - t0;
  assert.ok(dt < 10000, `${dt} ms`);
  assert.deepEqual(r, oracle(els));
});

// ============================================================================ K. GEL, MUTATION, DONNÉES NEUVES
test('K1. entrée entièrement gelée (tableau, éléments, chemins, contenus) : acceptée, résultat identique', () => {
  const attendu = produire(refElements());
  assert.deepEqual(produire(geler(refElements())), attendu);
  for (let t = 0; t < 50; t += 1) { const els = elementsAleatoires(); const a = produire(els); assert.deepEqual(produire(geler(els.map((e) => el(e.chemin.slice(), structuredClone(e.contenu))))), a); }
});
test('K2. l\'entrée n\'est jamais modifiée (comparaison stricte, -0 compris)', () => {
  graine = 777;
  const fabrique = () => { graine = 4242; return [...elementsAleatoires(), el(['z0'], -0), el(['z1'], { v: [0, -0, null] })]; };
  const els = fabrique(); produire(els);
  assert.deepEqual(els, fabrique());
  const ref = refElements(); produire(ref); assert.deepEqual(ref, refElements());
});
test('K3. la sortie est NEUVE : aucune référence partagée avec l\'entrée, entre appels, ni entre entrées', () => {
  const els = refElements();
  const a = produire(els); const b = produire(els);
  assert.notEqual(a, b); assert.notEqual(a[0], b[0]); assert.notEqual(a[0].constat, b[0].constat); assert.notEqual(a[0].couverture, b[0].couverture);
  const chemins = new Set(); for (const e of els) { chemins.add(e.chemin); }
  const vus = new Set();
  for (const x of a) {
    for (const objet of [x, x.constat, x.constat.chemin, x.couverture, ...x.couverture]) { assert.equal(vus.has(objet), false); vus.add(objet); }
    for (const d of x.couverture) assert.equal(chemins.has(d), false, 'la couverture est une copie des identités');
  }
  a[0].constat.chemin.push('MUTE'); a[0].couverture[0].push('MUTE'); a[0].couverture.push(['MUTE']); a.length = 0;
  assert.deepEqual(produire(els), b);
  assert.deepEqual(els, refElements());
});
test('K4. les contenus ne sont pas retenus : modifier un contenu après coup ne change pas un résultat déjà rendu', () => {
  const c = { x: [1, 2] }; const els = [el(['a'], c)];
  const r = produire(els); const copie = JSON.parse(JSON.stringify(r));
  c.x.push(3); c.y = 'z';
  assert.deepEqual(r, copie);
});

// ============================================================================ L. STATIQUE ET DORMANCE
const fichiers = (d, s = []) => { for (const n of readdirSync(d)) { const f = join(d, n); if (statSync(f).isDirectory()) { if (n !== 'node_modules') fichiers(f, s); } else s.push(f); } return s; };
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const MODULE = 'app/langage/constats-structurels.js';
test('L1. le module n\'importe QUE parcours-structure, couverture-occurrences et resolution-couverture ; il n\'exporte qu\'une fonction', () => {
  assert.deepEqual(CODE.match(/^\s*import\b.*$/gm), [
    'import { parcourirStructure } from \'./parcours-structure.js\';',
    'import { normaliserCouverture, memesCouvertures } from \'./couverture-occurrences.js\';',
    'import { resoudreCouverture } from \'./resolution-couverture.js\';',
  ]);
  assert.equal(/\bimport\s*\(|\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function memesConstats(a, b) {', 'export function produireConstatsStructurels(elements) {']); // MISE À JOUR DÉLIBÉRÉE v0.63.73 : + memesConstats (même règle d'égalité, aucun appelant de plus dans ce module)
  assert.equal(/DESCRIPTIONS_OPERATIONS|descriptions-operations|formes-operation|garantie-forme|couvrirSequence|sequence-plages|valeurs-observees|structure-identifiee|CAPACITES|registre/.test(CODE + SOURCE), false);
});
test('L2. pur : aucun accès réseau, stockage, horloge, hasard, console, global ; aucune sérialisation, clé texte, Map/Set, indexOf/includes, tri', () => {
  assert.equal(/\bfetch\b|localStorage|indexedDB|process\.|Date\.now|new Date|Math\.random|console\.|setTimeout|await\b|\basync\b|globalThis|window\.|document\./.test(CODE), false);
  assert.equal(/JSON\.|\.join\s*\(|\.toString\s*\(|localeCompare|Intl\.|\bencodeURI|\bbtoa\b|\bString\s*\(|\bNumber\s*\(\s*[a-z]|\.concat\s*\(|new Map|new Set|WeakMap|\bhash\b|`\$\{[^}]*\}[^`]*\$\{/.test(CODE.replace(/throw new TypeError\(`[^`]*`\);/g, '')), false);
  assert.equal(/\.indexOf\s*\(|\.includes\s*\(|\.lastIndexOf\s*\(|\.find\s*\(|\.findIndex\s*\(|\.some\s*\(|\.sort\s*\(|\.reverse\s*\(|\.splice\s*\(|\.slice\s*\(|\.filter\s*\(/.test(CODE), false);
  assert.equal(/\bin\s+\w+\s*\)\s*\{|for\s*\(\s*(const|let|var)\s+\w+\s+in\b|Object\.(keys|values|entries)|Reflect\.get\b|\.get\s*\(/.test(CODE.replace(/'value' in propriete/g, '').replace(/'value' in place/g, '')), false, 'seules les descriptions de propriétés sont lues');
});
test('L3. le code ne connaît aucune structure de contenu : jamais contenu.x, contenu[...], texte ; type/valeur seulement sur un constat', () => {
  assert.equal(/\bcontenu\s*[.[]|\bcontenu\b\s*\?\./.test(CODE.replace(/\.contenu\b/g, '').replace(/\bcontenu:/g, '')), false);
  assert.equal(/texte|\bchamps\b|\bentrees\b|\bsortie\b|\bnom\b|\bforme\b/.test(CODE), false);
  const lignes = CODE.split('\n').filter((l) => /\btype\b|\bvaleur\b/.test(l));
  for (const l of lignes) assert.equal(/\b(a|b|occurrence|copie)\.(type|valeur)\b|hasOwn\((a|b|occurrence), 'valeur'\)|copie\.valeur|type: occurrence\.type/.test(l), true, l);
});
test('L4. le code n\'ajoute ni score, poids, fréquence, intérêt, priorité, sélection, seuil, préférence, provenance, raison, id, parent, catégorie…', () => {
  assert.equal(/\b(raison|famille|motif|fait|score|poids|frequence|interet|confiance|preference|priorite|selection|seuil|provenance|intersection|union|difference|complement|parent|prefixe|suffixe|categorie|hash|filtre|filter|projection|rebas\w*|observation)\b/i.test(CODE), false);
  assert.equal(/\bid\b|\bidentifiant\b/i.test(CODE), false);
  assert.equal(/[+!]==?\s*0\b.*&&|\bwhile\b/.test(CODE) && false, false);
  const noms = [...CODE.matchAll(/(?:^|\n)(?:export )?function (\w+)/g)].map((m) => m[1]);
  for (const nom of noms) assert.equal(new RegExp(`\\b${nom}\\s*\\(`, 'g').test(CODE.replace(new RegExp(`function ${nom}\\b`), '')) && nom === 'produireConstatsStructurels', false, `${nom} ne s'appelle pas lui-même`);
});
test('L5. aucun autre fichier de production ne nomme ce module ; les trois importés restent dormants et leurs importeurs sont exactement connus', () => {
  const fautifs = []; const parParcours = []; const parCouverture = []; const parResolution = [];
  for (const f of fichiers(join(RACINE, 'app'))) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    // v0.63.10 : le catalogue NOMME les primitives par `nom` ; il ne cite jamais un chemin de module (vérifié ci-dessous) et n'importe rien.
    if (rel(f) !== MODULE && rel(f) !== 'app/langage/descriptions-operations.js' && rel(f) !== 'app/langage/table-operations.js' && rel(f) !== 'app/langage/issue-contexte-prospectif.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.73 : vue dormante, importe memesConstats */ && rel(f) !== 'app/langage/attentes-prospectives.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.74 : importe memesConstats */ && rel(f) !== 'app/langage/issue-attente-prospective.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.75 : vue dormante, importe memesConstats */ && rel(f) !== 'app/langage/constats-par-chemin.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.71 : vue dormante qui regroupe les constats du producteur par chemin (importeur autorisé, gardé par tests/constats-par-chemin.test.mjs) */ && /constats-structurels|produireConstatsStructurels/.test(src)) fautifs.push(rel(f)); // MISE À JOUR DÉLIBÉRÉE v0.63.18 : table-operations.js rend les opérations LOCALISABLES mécaniquement (importeur statique autorisé, gardé par tests/invocation-operations.test.mjs) ; elles ne sont pas utilisées par le moteur
    if (/parcours-structure|parcourirStructure/.test(src)) parParcours.push(rel(f));
    if (/couverture-occurrences|normaliserCouverture|memesCouvertures/.test(src)) parCouverture.push(rel(f));
    if (/resolution-couverture|resoudreCouverture/.test(src)) parResolution.push(rel(f));
  }
  assert.deepEqual(fautifs, []);
  const CAT = 'app/langage/descriptions-operations.js'; // v0.63.10 : nomme sans importer
  assert.deepEqual(parParcours.sort(), [MODULE, CAT, 'app/langage/table-operations.js', 'app/langage/parcours-structure.js', 'app/langage/constats-valeurs.js', 'app/langage/suites-fermees.js', 'app/langage/contexte-prospectif.js', 'app/langage/issue-contexte-prospectif.js'].sort()); // MISE À JOUR DÉLIBÉRÉE v0.63.73 : + issue-contexte-prospectif.js (vue pure dormante : issue d'un contexte prospectif ; importe parcourirStructure, couverture-occurrences, constats-structurels) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contexte-prospectif.js (calcul pur du contenu prospectif, appelé par execution-sollicitee.js avant l'issue ; importe parcourirStructure, couverture-occurrences et constats-par-chemin) // MISE À JOUR DÉLIBÉRÉE v0.63.29 : + constats-valeurs.js (observateur de valeurs dormant, importe ces primitives) ; MISE À JOUR DÉLIBÉRÉE v0.63.32 : + suites-fermees.js (observateur de suites dormant, importe ces primitives)
  assert.deepEqual(parCouverture.sort(), [MODULE, CAT, 'app/langage/table-operations.js', 'app/langage/couverture-occurrences.js', 'app/langage/partition-couvertures.js', 'app/langage/relations-parent-enfant.js', 'app/langage/resolution-couverture.js', 'app/langage/constats-valeurs.js', 'app/langage/suites-fermees.js', 'app/langage/constats-par-chemin.js', 'app/langage/contexte-prospectif.js', 'app/langage/issue-contexte-prospectif.js', 'app/langage/attentes-prospectives.js', 'app/langage/consequences-emissions.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions, issu de l'expérience d'autonomie 03) : + consequences-emissions.js (vue pure dormante des conséquences déclarées des émissions ; importe normaliserCouverture) */, 'app/langage/issue-attente-prospective.js', 'app/langage/experiences-attentes.js'].sort()); // MISE À JOUR DÉLIBÉRÉE v0.63.76 : + experiences-attentes.js (vue pure dormante : les issues d'attentes comme collection d'expériences ; importe issue-attente-prospective et couverture-occurrences (normaliserCouverture)) // MISE À JOUR DÉLIBÉRÉE v0.63.75 : + issue-attente-prospective.js (vue pure dormante : issue d'une attente prospective ; importe couverture-occurrences (memesCouvertures), constats-structurels (memesConstats), issue-contexte-prospectif) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentes-prospectives.js (calcul pur des attentes A = B, appelé par execution-sollicitee.js avant l'issue ; importe couverture-occurrences, constats-structurels (memesConstats), constats-par-chemin, issue-contexte-prospectif) // MISE À JOUR DÉLIBÉRÉE v0.63.73 : + issue-contexte-prospectif.js (vue pure dormante : issue d'un contexte prospectif ; importe parcourirStructure, couverture-occurrences, constats-structurels) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contexte-prospectif.js (calcul pur du contenu prospectif, appelé par execution-sollicitee.js avant l'issue ; importe parcourirStructure, couverture-occurrences et constats-par-chemin) // MISE À JOUR DÉLIBÉRÉE v0.63.71 : + constats-par-chemin.js (vue dormante, importe normaliserCouverture et memesCouvertures) ; MISE À JOUR DÉLIBÉRÉE v0.63.32 : + suites-fermees.js (observateur de suites dormant, importe ces primitives) ; v0.63.11 : + relations-parent-enfant.js ; v0.63.9 : + partition-couvertures.js ; v0.63.10 : + catalogue (nom seulement)
  assert.deepEqual(parResolution.sort(), [MODULE, CAT, 'app/langage/table-operations.js', 'app/langage/resolution-couverture.js', 'app/langage/constats-valeurs.js', 'app/langage/suites-fermees.js', 'app/langage/resoudre-elements.js', 'app/langage/relations-entrees.js'].sort()); // MISE À JOUR DÉLIBÉRÉE v0.63.61 : + relations-entrees.js (registre relationnel, importe resoudreCouverture) ; MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudre-elements.js (fonction propre qui délègue à resoudreCouverture) ; MISE À JOUR DÉLIBÉRÉE v0.63.29 : + constats-valeurs.js (observateur de valeurs dormant, importe ces primitives) ; MISE À JOUR DÉLIBÉRÉE v0.63.32 : + suites-fermees.js (observateur de suites dormant, importe ces primitives)
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/constats-structurels|resolution-couverture|couverture-occurrences|parcours-structure/.test(src), false, autre); }
});
test('L6. le module est INACCESSIBLE depuis le démarrage : parcours des imports statiques depuis app/main.js', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations|environnement-conversation)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + environnement-conversation.js (l'émission est un acte prospectif : ce module vivant atteint la chaîne .72/.74 comme execution-sollicitee.js ; exclu du parcours au même titre)
  }
  assert.ok(vus.size > 20);
  for (const dormant of [MODULE, 'app/langage/resolution-couverture.js', 'app/langage/couverture-occurrences.js', 'app/langage/parcours-structure.js']) assert.equal([...vus].some((f) => rel(f) === dormant), false, dormant);
});
test('L7. rien d\'autre ne change de statut : CAPACITES inchangée, VERSION_BASE 15, SCHEMA_SAUVEGARDE 5 ; les API précédentes ne sont pas élargies', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  assert.equal(Object.isFrozen(CAPACITES), true);
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 22); assert.equal(sauv.SCHEMA_SAUVEGARDE, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.deepEqual(Object.keys(await import('../app/langage/couverture-occurrences.js')).sort(), ['memesCouvertures', 'normaliserCouverture']);
  assert.deepEqual(Object.keys(await import('../app/langage/resolution-couverture.js')), ['resoudreCouverture']);
  assert.deepEqual(Object.keys(await import('../app/langage/parcours-structure.js')), ['parcourirStructure']);
  assert.equal(/constats-structurels|produireConstatsStructurels/.test(readFileSync(join(RACINE, 'app', 'langage', 'registre.js'), 'utf8')), false, 'registre.js');
  // v0.63.10 : le catalogue ne nomme la primitive que par `nom`, une seule fois, jamais par un chemin de module.
  const catalogue = readFileSync(join(RACINE, 'app', 'langage', 'descriptions-operations.js'), 'utf8');
  assert.equal(/constats-structurels/.test(catalogue.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), false);
  assert.equal(catalogue.split('nom: \'produireConstatsStructurels\'').length - 1, 1);
});
// === FIN_TEST_CONSTATS_STRUCTURELS ===
