// === DEBUT_TEST_GROUPES_CANDIDATS ===
// v0.63.21 — décision ChatGPT « GROUPES COMPLETS DE CANDIDATS » (05/10/2026). Preuves que app/langage/groupes-candidats.js
// regroupe les possibilités atomiques en [{ operation, entrees:[{ entree, donnees }] }] canonique, ne garde que les opérations dont
// TOUTES les entrées requises ont au moins un candidat, conserve TOUS les candidats, ne matérialise aucun produit cartésien,
// ne choisit rien, ne lit aucune valeur, et reste dormant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/groupes-candidats.js';
import { enregistrerExecutionOperation, magasinMemoireVive, VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

// v0.63.23 : toute NOUVELLE exécution provient d'une désignation. Aide de TEST (la primitive n'a aucune compatibilité) : construit une
// désignation explicite cohérente avec l'entrée si celle-ci est valable, sinon une désignation valide quelconque (l'erreur attendue
// reste alors celle de l'entrée elle-même). Copie les DESCRIPTEURS : aucun accesseur n'est jamais exécuté.
let compteurDesignations = 0;
function avecDesignation(e) {
  if (e === null || typeof e !== 'object' || Array.isArray(e)) return e;
  const d = Object.getOwnPropertyDescriptors(e);
  if ('designation' in d) return e;
  const val = (c) => (d[c] !== undefined && 'value' in d[c] ? d[c].value : undefined);
  const plat = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  const chaine = (x) => typeof x === 'string' && x.length > 0;
  const lia = val('liaisons');
  const valable = Array.isArray(lia) && lia.length > 0 && (() => {
    const noms = new Set();
    for (let i = 0; i < lia.length; i += 1) {
      const pd = Object.getOwnPropertyDescriptor(lia, String(i));
      if (!pd || !('value' in pd) || !plat(pd.value) || Reflect.ownKeys(pd.value).length !== 2) return false;
      const e = Object.getOwnPropertyDescriptor(pd.value, 'entree'); const dd = Object.getOwnPropertyDescriptor(pd.value, 'donnee');
      if (!e || !dd || !('value' in e) || !('value' in dd) || !chaine(e.value) || !chaine(dd.value) || noms.has(e.value)) return false;
      noms.add(e.value);
    }
    return true;
  })();
  const operation = chaine(val('operation')) ? val('operation') : 'parcourirStructure';
  const designation = { id: `designation-application-test-${++compteurDesignations}`, operation, liaisons: valable ? lia.map((l) => ({ entree: l.entree, donnee: l.donnee })) : [{ entree: 'valeur', donnee: 'message-1' }] };
  return Object.create(Object.getPrototypeOf(e), { ...d, designation: { value: designation, enumerable: true, writable: true, configurable: true } });
}
const exec = (m, e) => enregistrerExecutionOperation(m, avecDesignation(e));

const { groupesDeCandidats: groupes } = module;
const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const SOURCE = lu('app', 'langage', 'groupes-candidats.js');
const CODE = sansCommentaires(SOURCE);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const at = (donnee, operation, entree) => ({ donnee, operation, entree });
const sc = () => ({ forme: 'scalaire' });
const desc = (nom, ...entrees) => ({ nom, entrees: Object.fromEntries(entrees.map((e) => [e, sc()])), sortie: sc() });
const O = desc('O', 'a', 'b');
let graine = 20261105;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const melanger = (t) => { const r = t.slice(); for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(alea() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

// ---------------------------------------------------------------- A. SURFACE ET SORTIE
test('A1. un seul export : groupesDeCandidats', () => {
  assert.deepEqual(Object.keys(module), ['groupesDeCandidats']);
  assert.equal(typeof groupes, 'function');
});
test('A2. zéro possibilité, zéro description, ou les deux : []', () => {
  assert.deepEqual(groupes([], []), []);
  assert.deepEqual(groupes([], [O]), []);
  assert.deepEqual(groupes([], DESCRIPTIONS_OPERATIONS), []);
});
test('A3. cas une entrée : un candidat → un groupe d\'une entrée, exactement la sortie attendue', () => {
  const r = groupes([at('message-1', 'parcourirStructure', 'valeur')], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(r, [{ operation: 'parcourirStructure', entrees: [{ entree: 'valeur', donnees: ['message-1'] }] }]);
});
test('A4. sortie : objets simples, clés exactes {operation, entrees}, {entree, donnees}, aucun autre champ', () => {
  const r = groupes([at('A', 'O', 'a'), at('B', 'O', 'b')], [O]);
  assert.deepEqual(Object.keys(r[0]), ['operation', 'entrees']);
  assert.deepEqual(Object.keys(r[0].entrees[0]), ['entree', 'donnees']);
  assert.equal(Object.getPrototypeOf(r[0]), Object.prototype);
  for (const interdit of ['id', 'nombreApplications', 'forme', 'valeur', 'score', 'raison', 'confiance', 'provenance', 'liaisons', 'statut']) {
    assert.equal(interdit in r[0], false, interdit);
    assert.equal(interdit in r[0].entrees[0], false, interdit);
  }
});

// ---------------------------------------------------------------- B. COMPLÉTUDE
test('B1. multi-entrées : a:[A,B], b:[C,D,E] → UN groupe à 2+3 candidats, jamais six applications', () => {
  const atomes = [at('A', 'O', 'a'), at('B', 'O', 'a'), at('C', 'O', 'b'), at('D', 'O', 'b'), at('E', 'O', 'b')];
  const r = groupes(atomes, [O]);
  assert.deepEqual(r, [{ operation: 'O', entrees: [{ entree: 'a', donnees: ['A', 'B'] }, { entree: 'b', donnees: ['C', 'D', 'E'] }] }]);
  assert.equal(r.length, 1);
  assert.equal(JSON.stringify(r).includes('liaisons'), false);
});
test('B2. une entrée requise sans candidat : l\'opération entière est ABSENTE (ni groupe partiel, ni entrée vide)', () => {
  assert.deepEqual(groupes([at('A', 'O', 'a')], [O]), []);
  assert.deepEqual(groupes([at('A', 'O', 'b')], [O]), []);
  const r = groupes([at('A', 'O', 'a'), at('X', 'P', 'p')], [O, desc('P', 'p')]);
  assert.deepEqual(r, [{ operation: 'P', entrees: [{ entree: 'p', donnees: ['X'] }] }]);
});
test('B3. une même donnée sur plusieurs entrées est conservée : memesCouvertures a:[A,B], b:[A,B]', () => {
  const atomes = ['A', 'B'].flatMap((d) => [at(d, 'memesCouvertures', 'a'), at(d, 'memesCouvertures', 'b')]);
  assert.deepEqual(groupes(atomes, DESCRIPTIONS_OPERATIONS), [{ operation: 'memesCouvertures', entrees: [{ entree: 'a', donnees: ['A', 'B'] }, { entree: 'b', donnees: ['A', 'B'] }] }]);
});
test('B4. plusieurs données sur une entrée : tous les candidats restent, aucune liaison', () => {
  const r = groupes([at('B', 'P', 'p'), at('A', 'P', 'p'), at('C', 'P', 'p')], [desc('P', 'p')]);
  assert.deepEqual(r[0].entrees[0].donnees, ['A', 'B', 'C']);
});
test('B5. une opération sans entrée ne produit jamais de groupe', () => {
  assert.deepEqual(groupes([], [desc('Vide')]), []);
});
test('B6. description jamais utilisée pour ses formes : deux descriptions de formes opposées donnent le même groupe', () => {
  const d1 = { nom: 'O', entrees: { a: { forme: 'scalaire', genre: 'chaine' } }, sortie: sc() };
  const d2 = { nom: 'O', entrees: { a: { forme: 'collection' } }, sortie: { forme: 'objet' } };
  assert.deepEqual(groupes([at('A', 'O', 'a')], [d1]), groupes([at('A', 'O', 'a')], [d2]));
});

// ---------------------------------------------------------------- C. CANONICITÉ
test('C1. même ensemble de possibilités dans n\'importe quel ordre : sortie deepEqual identique', () => {
  const atomes = [at('A', 'O', 'a'), at('B', 'O', 'a'), at('C', 'O', 'b'), at('D', 'O', 'b'), at('A', 'P', 'p'), at('Z', 'P', 'p')];
  const attendu = groupes(atomes, [O, desc('P', 'p')]);
  for (let i = 0; i < 30; i += 1) {
    assert.deepEqual(groupes(melanger(atomes), melanger([O, desc('P', 'p')])), attendu);
  }
  assert.deepEqual(attendu.map((g) => g.operation), ['O', 'P']);
});
test('C2. tri par unités de code (jamais localeCompare) : majuscules avant minuscules, accents après', () => {
  const atomes = ['b', 'B', 'a', 'é', 'e', 'Z'].map((d) => at(d, 'P', 'p'));
  assert.deepEqual(groupes(atomes, [desc('P', 'p')])[0].entrees[0].donnees, ['B', 'Z', 'a', 'b', 'e', 'é']);
  const ops = ['b', 'B', 'a'].map((nom) => desc(nom, 'x'));
  assert.deepEqual(groupes(['b', 'B', 'a'].map((o) => at('D', o, 'x')), ops).map((g) => g.operation), ['B', 'a', 'b']);
  const entrees = desc('E', 'b', 'B', 'a');
  assert.deepEqual(groupes(['b', 'B', 'a'].map((e) => at('D', 'E', e)), [entrees])[0].entrees.map((e) => e.entree), ['B', 'a', 'b']);
});
test('C3. deux appels identiques : sorties égales mais objets distincts ; entrées non modifiées', () => {
  const atomes = [at('B', 'O', 'a'), at('A', 'O', 'b')];
  const ds = [O];
  const avant = JSON.stringify([atomes, ds]);
  const r1 = groupes(atomes, ds);
  const r2 = groupes(atomes, ds);
  assert.deepEqual(r1, r2);
  assert.notEqual(r1, r2);
  assert.notEqual(r1[0].entrees[0].donnees, r2[0].entrees[0].donnees);
  assert.equal(JSON.stringify([atomes, ds]), avant);
});
test('C4. entrées gelées en profondeur acceptées', () => {
  const geler = (x) => { if (x !== null && typeof x === 'object') { for (const k of Object.keys(x)) geler(x[k]); Object.freeze(x); } return x; };
  assert.equal(groupes(geler([at('A', 'O', 'a'), at('B', 'O', 'b')]), geler([O])).length, 1);
});

// ---------------------------------------------------------------- D. VALIDATION
test('D1. possibilites et descriptions : tableaux exigés', () => {
  for (const v of [null, undefined, {}, 'x', 1]) { refuse(() => groupes(v, [])); refuse(() => groupes([], v)); }
});
test('D2. tableaux creux refusés (possibilités comme descriptions)', () => {
  refuse(() => groupes(new Array(1), [O]), /creux/);
  refuse(() => groupes([], new Array(1)), /creux/);
});
test('D3. atome : objet simple avec exactement donnee/operation/entree ; null, tableau, primitif, champ manquant refusés', () => {
  for (const v of [null, [], 'x', 3, undefined]) refuse(() => groupes([v], [O]));
  refuse(() => groupes([{ donnee: 'A', operation: 'O' }], [O]), /entree/);
  refuse(() => groupes([{ operation: 'O', entree: 'a' }], [O]), /donnee/);
  refuse(() => groupes([{ donnee: 'A', entree: 'a' }], [O]), /operation/);
});
test('D4. clé étrangère refusée (chaîne, symbole, non énumérable)', () => {
  refuse(() => groupes([{ ...at('A', 'O', 'a'), score: 1 }], [O]), /étranger/);
  refuse(() => groupes([{ ...at('A', 'O', 'a'), [Symbol('s')]: 1 }], [O]), /étranger/);
  const x = at('A', 'O', 'a');
  Object.defineProperty(x, 'cache', { value: 1, enumerable: false });
  refuse(() => groupes([x], [O]), /étranger/);
});
test('D5. chaînes non vides, sans coercition ni trim', () => {
  for (const v of ['', 0, 1, null, undefined, {}, [], true]) {
    refuse(() => groupes([{ donnee: v, operation: 'O', entree: 'a' }], [O]), /donnee/);
    refuse(() => groupes([{ donnee: 'A', operation: v, entree: 'a' }], [O]), /operation/);
    refuse(() => groupes([{ donnee: 'A', operation: 'O', entree: v }], [O]), /entree/);
  }
  refuse(() => groupes([at('A', 'O ', 'a')], [O]), /inconnue/);
  refuse(() => groupes([at('A', 'O', ' a')], [O]), /inconnue/);
  assert.deepEqual(groupes([at(' A ', 'O', 'a'), at('B', 'O', 'b')], [O])[0].entrees[0].donnees, [' A '], 'aucun trim sur l\'identité');
});
test('D6. accesseurs refusés SANS être exécutés (champ d\'atome, rang, description)', () => {
  const piege = () => { throw new Error('exécuté'); };
  for (const champ of ['donnee', 'operation', 'entree']) {
    const x = at('A', 'O', 'a');
    Object.defineProperty(x, champ, { get: piege, enumerable: true });
    refuse(() => groupes([x], [O]), /accesseur/);
  }
  const t = [];
  Object.defineProperty(t, 0, { get: piege, enumerable: true });
  refuse(() => groupes(t, [O]), /accesseur/);
  const d = [];
  Object.defineProperty(d, 0, { get: piege, enumerable: true });
  refuse(() => groupes([], d), /accesseur/);
});
test('D7. propriétés héritées refusées', () => {
  for (const champ of ['donnee', 'operation', 'entree']) {
    const base = at('A', 'O', 'a');
    const x = Object.create({ [champ]: base[champ] });
    for (const k of Object.keys(base)) if (k !== champ) x[k] = base[k];
    refuse(() => groupes([x], [O]), /champ « /);
  }
});
test('D8. atome répété à l\'identique : TypeError, jamais fusionné ; mêmes donnée/opération mais autre entrée : légitime', () => {
  refuse(() => groupes([at('A', 'O', 'a'), at('A', 'O', 'a')], [O]), /répète/);
  assert.equal(groupes([at('A', 'O', 'a'), at('A', 'O', 'b')], [O]).length, 1);
});
test('D9. opération inconnue ou entrée inconnue : TypeError, jamais ignorée', () => {
  refuse(() => groupes([at('A', 'Inconnue', 'a')], [O]), /opération inconnue/);
  refuse(() => groupes([at('A', 'O', 'zzz')], [O]), /entrée inconnue/);
  refuse(() => groupes([at('A', '__proto__', 'a')], [O]), /opération inconnue/);
  refuse(() => groupes([at('A', 'O', 'constructor')], [O]), /entrée inconnue/);
  refuse(() => groupes([at('A', 'O', 'toString')], [O]), /entrée inconnue/);
});
test('D10. descriptions invalides ou de même nom : TypeError', () => {
  refuse(() => groupes([], [{ nom: 'X' }]), /descriptions\[0\]/);
  refuse(() => groupes([], [O, O]), /même nom/);
});
test('D11. entrée omissible au niveau de l\'entrée : TypeError explicite (même sans atome) ; omissible:false accepté', () => {
  const om = { nom: 'Q', entrees: { a: { forme: 'scalaire', omissible: true } }, sortie: sc() };
  refuse(() => groupes([], [om]), /omissible/);
  refuse(() => groupes([at('A', 'Q', 'a')], [om]), /omissible/);
  const non = { nom: 'Q', entrees: { a: { forme: 'scalaire', omissible: false } }, sortie: sc() };
  assert.equal(groupes([at('A', 'Q', 'a')], [non]).length, 1);
});
test('D12. omissible imbriqué dans une forme (decrireValeursObservees.paires) : sans effet sur la complétude', () => {
  const r = groupes([at('P1', 'decrireValeursObservees', 'paires')], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(r, [{ operation: 'decrireValeursObservees', entrees: [{ entree: 'paires', donnees: ['P1'] }] }]);
});

// ---------------------------------------------------------------- E. CHAÎNE RÉELLE
test('E1. exécutions réelles → productionsDecrites → possibilitesDeLiaison → groupesDeCandidats : groupes multi-entrées complets', async () => {
  const m = magasinMemoireVive();
  const faire = (operation) => exec(m, { operation, liaisons: [{ entree: 'x', donnee: 'src' }], resultat: null });
  const A = await faire('normaliserCouverture');
  const B = await faire('normaliserCouverture');
  const U = await faire('parcourirStructure');
  const lignes = (await m.lireTout('executionsOperations'));
  assert.equal(lignes.length, 3);
  const productions = productionsDecrites(lignes, DESCRIPTIONS_OPERATIONS);
  const possibilites = possibilitesDeLiaison(productions, DESCRIPTIONS_OPERATIONS);
  const r = groupes(possibilites, DESCRIPTIONS_OPERATIONS);
  const ab = [A.id, B.id].sort();
  const parNom = Object.fromEntries(r.map((g) => [g.operation, g.entrees]));
  assert.deepEqual(parNom.memesCouvertures, [{ entree: 'a', donnees: ab }, { entree: 'b', donnees: ab }]);
  assert.deepEqual(parNom.partagerCouvertures, [{ entree: 'a', donnees: ab }, { entree: 'b', donnees: ab }]);
  assert.deepEqual(parNom.resoudreCouverture, [{ entree: 'couverture', donnees: ab }, { entree: 'univers', donnees: [U.id] }]);
  assert.deepEqual(parNom.parcourirStructure, [{ entree: 'valeur', donnees: [A.id, B.id, U.id].sort() }]);
  assert.deepEqual(parNom.normaliserCouverture, [{ entree: 'chemins', donnees: ab }]);
  assert.equal('couvrirSequence' in parNom, false, 'plages sans candidat → absente');
  assert.deepEqual(r.map((g) => g.operation), Object.keys(parNom).slice().sort());
});
test('E2. couvrirSequence (elements:[A,B,U], plages: aucun) est ABSENTE ; c\'est précisément l\'atome elements qui existe', async () => {
  const m = magasinMemoireVive();
  const A = await exec(m, { operation: 'normaliserCouverture', liaisons: [{ entree: 'x', donnee: 's' }], resultat: [] });
  const p = possibilitesDeLiaison(productionsDecrites([A], DESCRIPTIONS_OPERATIONS), DESCRIPTIONS_OPERATIONS);
  assert.equal(p.some((a) => a.operation === 'couvrirSequence' && a.entree === 'elements'), true);
  assert.equal(p.some((a) => a.operation === 'couvrirSequence' && a.entree === 'plages'), false);
  assert.equal(groupes(p, DESCRIPTIONS_OPERATIONS).some((g) => g.operation === 'couvrirSequence'), false);
});

// ---------------------------------------------------------------- F. CONTINUITÉ VERS UNE APPLICATION PRÉCISE (TEST SEUL)
test('F1. un candidat choisi à la main par entrée donne {operation, liaisons} directement acceptable par enregistrerExecutionOperation', async () => {
  const m = magasinMemoireVive();
  const faire = (operation) => exec(m, { operation, liaisons: [{ entree: 'x', donnee: 'src' }], resultat: null });
  const A = await faire('normaliserCouverture');
  const B = await faire('normaliserCouverture');
  const groupe = groupes(possibilitesDeLiaison(productionsDecrites(await m.lireTout('executionsOperations'), DESCRIPTIONS_OPERATIONS), DESCRIPTIONS_OPERATIONS), DESCRIPTIONS_OPERATIONS)
    .find((g) => g.operation === 'memesCouvertures');
  // Sélection MANUELLE, dans le test uniquement : le dernier candidat de chaque entrée.
  const application = { operation: groupe.operation, liaisons: groupe.entrees.map((e) => ({ entree: e.entree, donnee: e.donnees[e.donnees.length - 1] })) };
  assert.deepEqual(Object.keys(application), ['operation', 'liaisons']);
  const ligne = await exec(m, { ...application, resultat: { fictif: true } });
  assert.equal(ligne.operation, 'memesCouvertures');
  assert.deepEqual(ligne.liaisons, application.liaisons);
  assert.deepEqual(ligne.liaisons.map((l) => l.donnee), [[A.id, B.id].sort()[1], [A.id, B.id].sort()[1]]);
});
test('F2. groupesDeCandidats ne sélectionne jamais : aucune clé d\'application dans le module', () => {
  assert.equal(/liaisons|enregistrerExecutionOperation|resultat/.test(CODE), false);
});

// ---------------------------------------------------------------- G. STATIQUE
test('G1. un seul import (langage de formes) ; ni valeurDePorteur, ACCES_TRACE, DESCRIPTION_SOURCE_MESSAGE, TABLE_OPERATIONS, invoquerOperation, fournieGarantitAttendue, connaissances', () => {
  assert.deepEqual(CODE.match(/^import\b[^;]*;/gm), ["import { validerDescripteurOperation } from './formes-operation.js';"]);
  assert.equal(/valeurDePorteur|ACCES_TRACE|DESCRIPTION_SOURCE_MESSAGE|TABLE_OPERATIONS|invoquerOperation|fournieGarantitAttendue|garantie-forme|connaissances|acces-valeur|acces-trace|table-operations|invocation-operations/.test(SOURCE), false);
  assert.equal(/\bimport\s*\(|\brequire\s*\(/.test(CODE), false);
});
test('G2. pas de calcul de combinaison, pas de score, pas de choix, pas de comparaison localisée', () => {
  assert.equal(/localeCompare|toLowerCase|toUpperCase|normalize|trim\(|RegExp|\.match\(|\.replace\(|\.test\(/.test(CODE), false);
  assert.equal(/score|priorite|pertinen|curiosit|choisir|selection|sélection|random|Math\./i.test(CODE), false);
  assert.equal((CODE.match(/for \(/g) || []).length >= 1 && /\.flatMap\(|reduce\(|\*=/.test(CODE), false, 'aucun produit');
  assert.equal(/\beval\b|new Function|Date|Math|JSON\./.test(CODE), false);
});
test('G3. tri par comparaison de code-units uniquement', () => {
  assert.match(CODE, /const comparer = \(a, b\) => \(a < b \? -1 : a > b \? 1 : 0\);/);
  assert.equal((CODE.match(/\.sort\(/g) || []).length, 3);
  assert.equal((CODE.match(/\.sort\(comparer\)/g) || []).length, 3);
});
test('G4. lecture sûre par descripteurs ; aucune lecture directe de donnee/operation/entree sur l\'atome', () => {
  assert.equal(/\batome\.(donnee|operation|entree)\b/.test(CODE), false);
  assert.match(CODE, /Object\.getOwnPropertyDescriptor\(objet, champ\)/);
  assert.match(CODE, /Object\.getOwnPropertyDescriptor\(tableau, rang\)/);
});

// ---------------------------------------------------------------- H. DORMANCE ET INVARIANTS
test('H1. dormance par graphe d\'imports depuis app/main.js : groupes-candidats inatteignable ; aucun fichier de production ne le référence', () => {
  const vus = new Set();
  const pile = [resolve(RACINE, 'app/main.js')];
  while (pile.length > 0) {
    const f = pile.pop();
    if (vus.has(f) || !existsSync(f)) continue;
    vus.add(f);
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:import|export)[^'"`;]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|^import\s*['"](\.[^'"]+)['"]/gm)) { const c = resolve(dirname(f), m[1] || m[2] || m[3]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|table-operations)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs)
  }
  assert.ok(vus.size > 50);
  assert.equal([...vus].some((f) => f.endsWith('/groupes-candidats.js')), false);
  assert.equal([...vus].some((f) => f.endsWith('/connaissances.js')), true, 'sanity : le graphe atteint connaissances.js');
});
test('H2. aucun fichier de app/ (hors lui-même) ne mentionne groupesDeCandidats ou groupes-candidats', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const tous = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? tous(p) : p.endsWith('.js') ? [p] : []; });
  const mentions = tous(join(RACINE, 'app')).filter((f) => /groupesDeCandidats|groupes-candidats/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1));
  assert.deepEqual(mentions, ['app/langage/applications-sollicitables.js', 'app/langage/groupes-candidats.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.35 : + applications-sollicitables.js (fonction pure de l'outil de sollicitation ; seul importeur, gardé par tests/sollicitation-ui.test.mjs)
});
test('H3. persistance, descriptions et table d\'opérations inchangées', () => {
  assert.equal(VERSION_BASE, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(SCHEMA_SAUVEGARDE, 9); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(TABLES.length, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 (symbolesDeChaine décrite) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
});
// === FIN_TEST_GROUPES_CANDIDATS ===
