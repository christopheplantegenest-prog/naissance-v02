// v0.64.9 — « UNE INTENSION DÉCOUVERTE COMME RÉFÉRENT » (autorisation ChatGPT « v0.64.9 », 13/10/2026).
// Preuves : identité par intension (redécouverte disjointe, preuves différentes, croissance, contenus voisins, même couverture / contenus
// différents, 7 ≠ "7", 0 ≠ -0) ; T0 → T2 sans porteur commun : l'intension découverte dans H1, séparée de H1, sert sur T2 et les nouvelles
// manifestations portent ce même référent ; permutations sans effet ; aucune sémantique propre (délégation exacte à suites-fermees et
// rechercherSousSuites) ; pureté et gel ; dormance.
// LIMITE (non testée parce que non acquise) : le référent n'est PAS une donnée de la boucle ; aucun fait persisté ne le référence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/referents-suites.js';
import { referentDeSuite, memeReferent, resoudreReferent, referentsDecouverts, manifestationsDuReferent } from '../app/langage/referents-suites.js';
import { produireSuitesFermees } from '../app/langage/suites-fermees.js';
import { rechercherSousSuites } from '../app/langage/rechercher-sous-suites.js';
import { elementsObservables } from '../app/langage/elements-observables.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const car = (s) => s.split('');
const el = (id, s) => ({ chemin: [id], contenu: typeof s === 'string' ? car(s) : s });
const R = (s) => referentDeSuite(typeof s === 'string' ? car(s) : s);
const trouver = (refs, s) => refs.filter((r) => memeReferent(r, R(s)));
// Ensemble de référents (sans ordre) : chaque référent de a a exactement un égal dans b, et inversement.
const memesEnsembles = (a, b) => a.length === b.length && a.every((x) => b.filter((y) => memeReferent(x, y)).length === 1) && b.every((y) => a.filter((x) => memeReferent(x, y)).length === 1);
const cleManif = (m) => `${m.referent.suite.length}|${m.element.join('/')}|${m.debut}`;
const decouvrir = (elements) => referentsDecouverts(produireSuitesFermees(elements));

const H1 = [el('a1', 'bonjour'), el('a2', 'bonjour')];
const H2 = [el('b1', 'xbonjour'), el('b2', 'bonjourz'), el('b3', 'bonjour')];

test('A1. contrat : cinq fonctions exportées ; référent = { suite } gelé, sans autre clé ; résolution = copie neuve de l\'intension', () => {
  assert.deepEqual(Object.keys(module).sort(), ['manifestationsDuReferent', 'memeReferent', 'referentDeSuite', 'referentsDecouverts', 'resoudreReferent']);
  const contenu = car('bonjour');
  const r = referentDeSuite(contenu);
  assert.deepEqual(Reflect.ownKeys(r), ['suite']);
  assert.deepEqual(r.suite, contenu);
  assert.notEqual(r.suite, contenu);
  assert.ok(Object.isFrozen(r) && Object.isFrozen(r.suite));
  const s = resoudreReferent(r);
  assert.deepEqual(s, contenu);
  assert.notEqual(s, r.suite);
  assert.equal(Object.isFrozen(s), false);
  // Un référent écrit à la main (même valeur) est le même référent : l'identité est la valeur, pas l'objet.
  assert.equal(memeReferent(r, { suite: car('bonjour') }), true);
});

test('A2. redécouverte disjointe (test décisif 1) : H1 et H2 n\'ont aucune identité commune et découvrent « bonjour » → MÊME référent', () => {
  const r1 = trouver(decouvrir(H1), 'bonjour');
  const r2 = trouver(decouvrir(H2), 'bonjour');
  assert.equal(r1.length, 1);
  assert.equal(r2.length, 1);
  assert.equal(memeReferent(r1[0], r2[0]), true);
  // Les preuves diffèrent (témoins disjoints), sans effet sur l'identité.
  const c1 = produireSuitesFermees(H1).find((s) => s.contenu.join('') === 'bonjour').couverture;
  const c2 = produireSuitesFermees(H2).find((s) => s.contenu.join('') === 'bonjour').couverture;
  assert.equal(c1.some((t) => c2.some((u) => u[0] === t[0])), false);
});

test('B1. contenus voisins (test décisif 2) : « bon » et « bonjour », découverts dans le même calcul, sont deux référents, quel que soit l\'ordre', () => {
  const H = [el('g1', 'bonjour'), el('g2', 'bonjour'), el('g3', 'bonsoir')];
  for (const E of [H, [...H].reverse()]) {
    const refs = decouvrir(E);
    assert.equal(trouver(refs, 'bon').length, 1);
    assert.equal(trouver(refs, 'bonjour').length, 1);
    assert.equal(memeReferent(R('bon'), R('bonjour')), false);
    // Elles partagent des manifestations (même élément, même début) sans se confondre.
    const mb = manifestationsDuReferent(R('bon'), E).map((m) => `${m.element}|${m.debut}`);
    const mj = manifestationsDuReferent(R('bonjour'), E).map((m) => `${m.element}|${m.debut}`);
    assert.ok(mj.every((k) => mb.includes(k)));
  }
});

test('C1. croissance (test décisif 3) : une nouvelle manifestation, puis une nouvelle intension J, ne changent pas le référent de « bonjour »', () => {
  const T0 = decouvrir(H1);
  const T1 = decouvrir([...H1, el('a3', 'oh bonjour')]);
  const T2 = decouvrir([...H1, el('a3', 'oh bonjour'), el('a4', 'bonsoir'), el('a5', 'bonsoir')]);
  const [r0] = trouver(T0, 'bonjour');
  const [r1] = trouver(T1, 'bonjour');
  const [r2] = trouver(T2, 'bonjour');
  assert.equal(memeReferent(r0, r1), true);
  assert.equal(memeReferent(r0, r2), true);
  assert.deepEqual(r0, r2); // même valeur structurée, strictement
  assert.equal(trouver(T0, 'bonsoir').length, 0);
  assert.equal(trouver(T2, 'bonsoir').length, 1); // J apparaît à côté, sans remplacer
  // Seules les manifestations augmentent.
  assert.equal(manifestationsDuReferent(r0, H1).length, 2);
  assert.equal(manifestationsDuReferent(r0, [...H1, el('a3', 'oh bonjour')]).length, 3);
});

test('D1. preuve différente (test décisif 4) : même contenu, couvertures et occurrences différentes → même référent ; la preuve n\'est jamais lue', () => {
  const s1 = produireSuitesFermees(H1).find((s) => s.contenu.join('') === 'bonjour');
  const s2 = produireSuitesFermees(H2).find((s) => s.contenu.join('') === 'bonjour');
  assert.notDeepEqual(s1.couverture, s2.couverture);
  assert.notDeepEqual(s1.occurrences, s2.occurrences);
  const [r1] = referentsDecouverts([s1]);
  const [r2] = referentsDecouverts([s2]);
  assert.equal(memeReferent(r1, r2), true);
  // Items réduits au seul contenu : même résultat. Preuve piégée (accesseurs qui lèvent) : jamais touchée.
  const piege = { contenu: car('bonjour') };
  for (const cle of ['occurrences', 'couverture']) Object.defineProperty(piege, cle, { get() { throw new Error(`preuve lue : ${cle}`); }, enumerable: true });
  const [r3] = referentsDecouverts([piege]);
  assert.equal(memeReferent(r1, r3), true);
});

test('E1. même couverture, contenus différents (test décisif 5) → référents différents', () => {
  const E = [el('h1', 'bonjour'), el('h2', 'bonsoir')];
  const sorties = produireSuitesFermees(E);
  const bon = sorties.find((s) => s.contenu.join('') === 'bon');
  const o = sorties.find((s) => s.contenu.join('') === 'o');
  assert.deepEqual(bon.couverture, o.couverture);
  const refs = referentsDecouverts([bon, o]);
  assert.equal(refs.length, 2);
  assert.equal(memeReferent(refs[0], refs[1]), false);
});

test('F1. 7 ≠ "7" (test décisif 6), true ≠ "true" : exactement comme suites-fermees', () => {
  assert.equal(memeReferent(R([7]), R(['7'])), false);
  assert.equal(memeReferent(R([true]), R(['true'])), false);
  assert.equal(memeReferent(R([7, 'x']), R(['7', 'x'])), false);
  const refs = decouvrir([el('k1', [7, 'x']), el('k2', ['7', 'x'])]);
  assert.equal(refs.length, produireSuitesFermees([el('k1', [7, 'x']), el('k2', ['7', 'x'])]).length); // 3 : [7,"x"], ["7","x"], ["x"]
  assert.equal(trouver(refs, [7, 'x']).length, 1);
  assert.equal(trouver(refs, ['7', 'x']).length, 1);
});

test('G1. 0 ≠ -0 (test décisif 7) : exactement le contrat de suites-fermees (deux suites distinctes) ; -0 survit à la copie et à la résolution', () => {
  assert.equal(produireSuitesFermees([el('z1', [0]), el('z2', [-0])]).length, 2);
  const refs = decouvrir([el('z1', [0]), el('z2', [-0])]);
  assert.equal(refs.length, 2);
  assert.equal(memeReferent(R([0]), R([-0])), false);
  assert.equal(memeReferent(R([-0]), R([-0])), true);
  assert.ok(Object.is(R([-0]).suite[0], -0));
  assert.ok(Object.is(resoudreReferent(R([-0]))[0], -0));
  const m = manifestationsDuReferent(R([-0]), [el('z1', [0, -0, 0]), el('z2', [-0])]);
  assert.deepEqual(m.map((x) => [x.element[0], x.debut]), [['z1', 1], ['z2', 0]]);
});

test('H1. T0 → T2 SANS PORTEUR COMMUN (test décisif 8) : l\'intension découverte dans H1, séparée de H1, sert sur T2 ; chaque manifestation porte CE référent', () => {
  // T0 : découverte collective dans H1 (éléments observables : chemins = identités de données).
  const H1o = elementsObservables([{ identite: 'msg-1', valeur: car('bonjour') }, { identite: 'msg-2', valeur: car('bonjour toi') }]);
  const [r0] = trouver(decouvrir(H1o), 'bonjour');
  // T1 : on ne garde QUE la valeur (copie structurée) ; H1, la sortie de découverte, la collection M et la preuve sont abandonnées.
  const gardee = structuredClone(r0);
  // T2 : données nouvelles, aucune identité commune avec H1.
  const T2 = elementsObservables([{ identite: 'msg-9', valeur: car('oh bonjour') }, { identite: 'msg-8', valeur: car('rien') }]);
  assert.equal(T2.some((e) => H1o.some((h) => h.chemin[0] === e.chemin[0])), false);
  const m = manifestationsDuReferent(gardee, T2);
  assert.equal(m.length, 1);
  assert.deepEqual(m[0].element, ['msg-9']);
  assert.equal(m[0].debut, 3);
  assert.equal(memeReferent(m[0].referent, r0), true);
  // La même intension redécouverte ailleurs (H2) est ce même référent : la manifestation de T2 la désigne aussi.
  const [r2] = trouver(decouvrir(H2), 'bonjour');
  assert.equal(memeReferent(m[0].referent, r2), true);
  // Le rattachement ne contient ni collection M, ni indice, ni preuve : seulement { referent, element, debut }.
  assert.deepEqual(Object.keys(m[0]).sort(), ['debut', 'element', 'referent']);
  assert.deepEqual(Reflect.ownKeys(m[0].referent), ['suite']);
  // Mêmes positions que la primitive existante.
  const brut = rechercherSousSuites([car('bonjour')], T2)[0].occurrences;
  assert.deepEqual(m.map((x) => [x.element, x.debut]), brut.map((o) => [o.element, o.debut]));
});

test('H2. manifestation : le référent porté est canonique (gelé, partagé) même si un référent écrit à la main est fourni ; chemins copiés', () => {
  const E = [el('p1', 'bon bon')];
  const m = manifestationsDuReferent({ suite: car('bon') }, E);
  assert.equal(m.length, 2);
  assert.equal(m[0].referent, m[1].referent);
  assert.ok(Object.isFrozen(m[0].referent) && Object.isFrozen(m[0].referent.suite));
  assert.notEqual(m[0].element, E[0].chemin);
  assert.deepEqual(manifestationsDuReferent(R('xyz'), E), []); // absence : aucune manifestation, aucune erreur
});

test('I1. permutation (test décisif 9) : éléments et items permutés → mêmes ENSEMBLES de référents et de manifestations', () => {
  const E = [el('a1', 'bonjour'), el('a2', 'bonjour'), el('b1', 'xbonjour'), el('b2', 'bonjourz'), el('g3', 'bonsoir')];
  const permutations = [E, [...E].reverse(), [E[2], E[0], E[4], E[1], E[3]]];
  const base = decouvrir(E);
  for (const P of permutations) {
    assert.ok(memesEnsembles(base, decouvrir(P)));
    assert.ok(memesEnsembles(base, referentsDecouverts([...produireSuitesFermees(P)].reverse())));
    for (const r of base) {
      const a = manifestationsDuReferent(r, E).map(cleManif).sort();
      const b = manifestationsDuReferent(r, P).map(cleManif).sort();
      assert.deepEqual(a, b);
    }
  }
});

test('J1. deux sorties qui contiennent S → un seul référent S ; contenus différents jamais réunis', () => {
  const refs = referentsDecouverts([...produireSuitesFermees(H1), ...produireSuitesFermees(H2)]);
  assert.equal(trouver(refs, 'bonjour').length, 1);
  assert.equal(trouver(refs, 'o').length, 1);
  assert.equal(trouver(refs, 'xbonjour').length, 1);
  for (let i = 0; i < refs.length; i += 1) for (let j = i + 1; j < refs.length; j += 1) assert.equal(memeReferent(refs[i], refs[j]), false);
});

test('K1. validation : hors du domaine des suites fermées → TypeError, aucun résultat partiel', () => {
  for (const mauvais of [[], [null], [NaN], [Infinity], [1, [2]], [{ a: 1 }], 'abc', 7, null, undefined, { 0: 'a', length: 1 }]) {
    assert.throws(() => referentDeSuite(mauvais), TypeError, JSON.stringify(mauvais));
  }
  assert.throws(() => referentDeSuite([1, , 2]), TypeError); // eslint-disable-line no-sparse-arrays
  const accesseur = ['a'];
  Object.defineProperty(accesseur, '0', { get() { return 'a'; } });
  assert.throws(() => referentDeSuite(accesseur), TypeError);
  for (const r of [null, [], 'bon', {}, { suite: [] }, { suite: ['a'], autre: 1 }, { suites: ['a'] }, { suite: [null] }]) {
    assert.throws(() => memeReferent(r, R('a')), TypeError);
    assert.throws(() => memeReferent(R('a'), r), TypeError);
    assert.throws(() => resoudreReferent(r), TypeError);
    assert.throws(() => manifestationsDuReferent(r, H1), TypeError);
  }
  assert.throws(() => referentsDecouverts('x'), TypeError);
  assert.throws(() => referentsDecouverts([{ contenu: car('ok') }, { contenu: [null] }]), TypeError);
  assert.throws(() => referentsDecouverts([{ autre: 1 }]), TypeError);
  assert.throws(() => manifestationsDuReferent(R('a'), [{ contenu: ['a'] }]), TypeError); // erreur de rechercherSousSuites propagée
  // Domaine admis = celui de suites-fermees : chaînes, nombres finis (négatifs, décimaux), booléens.
  assert.deepEqual(R([1.5, -3, true, 'x']).suite, [1.5, -3, true, 'x']);
});

test('L1. pureté (test décisif 10) : entrées jamais modifiées ; sorties neuves et gelées ; déterminisme', () => {
  const E = structuredClone(H2);
  const sortie = produireSuitesFermees(E);
  const avant = structuredClone(sortie);
  const refs = referentsDecouverts(sortie);
  assert.deepEqual(sortie, avant);
  assert.deepEqual(E, H2);
  for (const r of refs) {
    assert.ok(Object.isFrozen(r) && Object.isFrozen(r.suite));
    assert.ok(sortie.every((s) => s.contenu !== r.suite));
  }
  assert.throws(() => { 'use strict'; refs[0].suite.push('z'); }, TypeError);
  const m1 = manifestationsDuReferent(refs[0], E);
  const m2 = manifestationsDuReferent(refs[0], E);
  assert.deepEqual(m1, m2);
  assert.deepEqual(E, H2);
  const contenu = car('bon');
  referentDeSuite(contenu);
  assert.deepEqual(contenu, car('bon'));
  assert.equal(Object.isFrozen(contenu), false);
});

test('M1. aucune sémantique propre : le module délègue à suites-fermees et rechercherSousSuites, n\'utilise ni sérialisation ni égalité maison', () => {
  const code = readFileSync(join(RACINE, 'app', 'langage', 'referents-suites.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  const imports = [...code.matchAll(/^\s*import\b[^;]*from\s+'([^']+)'/gm)].map((x) => x[1]).sort();
  assert.deepEqual(imports, ['./rechercher-sous-suites.js', './suites-fermees.js']);
  assert.equal(/JSON\.|Object\.is\b|===\s*-0|typeof\s+\w+\s*===\s*'(?:number|string|boolean)'|nouvelId|Date|Math\.random|\.sort\(|hash/i.test(code), false);
  // La même décision que les primitives sur un échantillon : égalité de référents <=> rechercherSousSuites trouve l'un au début 0 de l'autre.
  const echantillon = [[7], ['7'], [0], [-0], [true], ['true'], car('bon'), car('bonjour'), [1.5, -3]];
  for (const a of echantillon) for (const b of echantillon) {
    const attendu = a.length === b.length && rechercherSousSuites([a], [{ chemin: ['x'], contenu: b }])[0].occurrences.length > 0;
    assert.equal(memeReferent(R(a), R(b)), attendu);
  }
});

test('M2. dormance (test décisif 11) : aucun fichier de app/ n\'importe ni ne nomme le module ; ni pont, ni main, ni interface, ni catalogue — MISE À JOUR DÉLIBÉRÉE v0.64.11 (admission des référents de suites) : SEUL donnees-referents-suites.js l\'importe (et lui est admis par l\'observation)', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f.endsWith(join('langage', 'referents-suites.js'))) continue;
    // MISE À JOUR DÉLIBÉRÉE v0.64.10 : donnees-referents-suites.js (pur, dormant, lui-même importé par aucun fichier de app/) réutilise ce module (référents, résolution, découverte) au lieu d'une seconde sémantique.
    if (f.endsWith(join('langage', 'donnees-referents-suites.js'))) { assert.equal(/from '\.\/referents-suites\.js'/.test(readFileSync(f, 'utf8')), true); continue; }
    // MISE À JOUR DÉLIBÉRÉE v0.64.11 (admission des référents de suites) : le motif porte sur CE module (import direct « ./referents-suites.js ») et ses exports ; « donnees-referents-suites » (importé par l'observation, le résolveur,
    // le contexte et l'empreinte de catégorie) n'est pas ce module. Seul donnees-referents-suites.js l'importe, toujours.
    assert.equal(/\.\/referents-suites\.js|referentDeSuite|memeReferent|resoudreReferent|referentsDecouverts|manifestationsDuReferent/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const f of [['index.html'], ['sw.js']]) {
    let texte = '';
    try { texte = readFileSync(join(RACINE, ...f), 'utf8'); } catch { texte = ''; }
    assert.equal(/referents-suites/.test(texte), false, f.join('/'));
  }
});
