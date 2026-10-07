// v0.63.32 — observateur de suites contiguës fermées (dormant). Preuves : définition des séquences et barrières, égalité typée, fermeture
// par OCCURRENCES (contre-test : la fermeture par couverture échoue), dérivabilité exacte de toute suite omise depuis UN groupe fermé
// (référence brute dans le test seulement), multiplicité et chevauchements, parents, imbrication, null, permutations, équivalence avec les
// symboles observés par l'observateur de valeurs, performance mesurée sans seuil, dormance, absence de texte, versions inchangées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { produireSuitesFermees } from '../app/langage/suites-fermees.js';
import * as module from '../app/langage/suites-fermees.js';
import { produireConstatsValeurs } from '../app/langage/constats-valeurs.js';
import { universValeurs } from '../app/langage/univers-valeurs.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SRC = readFileSync(join(RACINE, 'app', 'langage', 'suites-fermees.js'), 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const el = (id, contenu) => ({ chemin: [id], contenu });
const EL = (...contenus) => contenus.map((c, i) => el(`M${i + 1}`, c));
const car = (texte) => [...texte]; // test seulement : tableau de symboles construit à la main

// ---------- RÉFÉRENCE BRUTE (test seulement : énumère tout) ----------
const cleSymbole = (x) => (Object.is(x, -0) ? 'n:-0' : `${typeof x === 'string' ? 's' : typeof x === 'number' ? 'n' : 'b'}:${String(x)}`);
function sequencesRef(contenu, parent = [], sortie = []) { // définition naïve, indépendante du module
  if (contenu !== null && typeof contenu === 'object' && !Array.isArray(contenu)) {
    for (const cle of Object.keys(contenu)) sequencesRef(contenu[cle], [...parent, cle], sortie);
    return sortie;
  }
  if (!Array.isArray(contenu)) return sortie;
  let courante = null;
  contenu.forEach((x, i) => {
    if (x !== null && typeof x === 'object') { courante = null; sequencesRef(x, [...parent, i], sortie); return; }
    if (x === null) { courante = null; return; }
    if (courante === null) { courante = { parent, debut: i, symboles: [] }; sortie.push(courante); }
    courante.symboles.push(x);
  });
  return sortie;
}
function faitsRef(elements) {
  const faits = new Map();
  for (const { chemin, contenu } of elements) {
    for (const s of sequencesRef(contenu)) {
      for (let d = 0; d < s.symboles.length; d += 1) {
        for (let f = d + 1; f <= s.symboles.length; f += 1) {
          const tr = s.symboles.slice(d, f);
          const cle = tr.map(cleSymbole).join('|');
          if (!faits.has(cle)) faits.set(cle, { contenu: tr, occ: new Map() });
          const o = { element: chemin[0], parent: s.parent, debut: s.debut + d };
          faits.get(cle).occ.set(`${o.element}#${JSON.stringify(o.parent)}#${o.debut}`, o);
        }
      }
    }
  }
  return faits;
}
const cleOcc = (o) => `${Array.isArray(o.element) ? o.element[0] : o.element}#${JSON.stringify(o.parent)}#${o.debut}`;
function fermesRef(faits) { // fermeture PAR OCCURRENCES : aucune extension d'un symbole ne garde exactement le même nombre d'occurrences
  const non = new Set();
  for (const [cle, f] of faits) {
    if (f.contenu.length < 2) continue;
    const gauche = f.contenu.slice(1).map(cleSymbole).join('|');
    const droite = f.contenu.slice(0, -1).map(cleSymbole).join('|');
    if (faits.get(gauche).occ.size === f.occ.size) non.add(gauche);
    if (faits.get(droite).occ.size === f.occ.size) non.add(droite);
  }
  return [...faits.keys()].filter((c) => !non.has(c));
}
function fermesParCouvertureRef(faits) { // FAUX volontairement : fermeture par couverture seule
  const couv = (f) => [...new Set([...f.occ.values()].map((o) => o.element))].sort().join(',');
  const non = new Set();
  for (const [, f] of faits) {
    if (f.contenu.length < 2) continue;
    const gauche = f.contenu.slice(1).map(cleSymbole).join('|');
    const droite = f.contenu.slice(0, -1).map(cleSymbole).join('|');
    if (couv(faits.get(gauche)) === couv(f)) non.add(gauche);
    if (couv(faits.get(droite)) === couv(f)) non.add(droite);
  }
  return [...faits.keys()].filter((c) => !non.has(c));
}
const resume = (g) => `${g.contenu.map(cleSymbole).join('|')} :: ${g.occurrences.map(cleOcc).sort().join(' ')}`;
const resumeRef = (f) => `${f.contenu.map(cleSymbole).join('|')} :: ${[...f.occ.values()].map(cleOcc).sort().join(' ')}`;
const couvDe = (occ) => [...new Set(occ.map((o) => (Array.isArray(o.element) ? o.element[0] : o.element)))].sort();
// Reconstruit un fait depuis UN groupe fermé : tranche + occurrences décalées + couverture. Rend null si aucun groupe ne convient.
function reconstruire(groupes, cibleCle, cibleOcc) {
  for (const g of groupes) {
    for (let d = 0; d + 0 <= g.contenu.length; d += 1) {
      for (let f = d + 1; f <= g.contenu.length; f += 1) {
        const tr = g.contenu.slice(d, f);
        if (tr.map(cleSymbole).join('|') !== cibleCle) continue;
        const occ = g.occurrences.map((o) => ({ element: o.element, parent: o.parent, debut: o.debut + d }));
        const a = occ.map(cleOcc).sort().join(' ');
        if (a === [...cibleOcc.values()].map(cleOcc).sort().join(' ')) return { tr, occ, couverture: couvDe(occ) };
      }
    }
  }
  return null;
}
function verifierTout(elements) {
  const sortie = produireSuitesFermees(elements);
  const faits = faitsRef(elements);
  const fermes = fermesRef(faits);
  assert.deepEqual(sortie.map(resume).sort(), fermes.map((c) => resumeRef(faits.get(c))).sort());
  for (const g of sortie) assert.deepEqual(g.couverture.map((c) => c[0]).sort(), couvDe(g.occurrences));
  for (const [cle, f] of faits) {
    const r = reconstruire(sortie, cle, f.occ);
    assert.ok(r, `fait non reconstructible depuis UN groupe fermé : ${cle}`);
    assert.deepEqual(r.couverture, couvDe([...f.occ.values()]));
  }
  return { sortie, faits, fermes };
}
const ids = (c) => c.map((x) => x[0]);

test('A1. [] donne [] ; forme exacte { contenu, occurrences:[{element,parent,debut}], couverture }', () => {
  assert.deepEqual(produireSuitesFermees([]), []);
  assert.deepEqual(produireSuitesFermees(EL([])), []);
  assert.deepEqual(produireSuitesFermees(EL('a', {}, null)), []);
  const r = produireSuitesFermees([el('D1', ['x'])]);
  assert.deepEqual(r, [{ contenu: ['x'], occurrences: [{ element: ['D1'], parent: [], debut: 0 }], couverture: [['D1']] }]);
  assert.deepEqual(Object.keys(r[0]), ['contenu', 'occurrences', 'couverture']);
  assert.deepEqual(Object.keys(r[0].occurrences[0]), ['element', 'parent', 'debut']);
});
test('A2. export unique ; fonction synchrone', () => {
  assert.deepEqual(Object.keys(module), ['produireSuitesFermees']);
  assert.ok(Array.isArray(produireSuitesFermees([])));
});
test('B1. aaaa / aaa : 4 groupes exacts ["a"], ["a","a"], 3, 4 avec toutes leurs occurrences chevauchantes', () => {
  const r = produireSuitesFermees(EL(car('aaaa'), car('aaa')));
  assert.equal(r.length, 4);
  const attendu = (n, o1, o2) => [n, [...o1.map((d) => `M1@${d}`), ...o2.map((d) => `M2@${d}`)]];
  const lu = r.map((g) => [g.contenu.length, g.occurrences.map((o) => `${o.element[0]}@${o.debut}`)]);
  assert.deepEqual(lu, [attendu(1, [0, 1, 2, 3], [0, 1, 2]), attendu(2, [0, 1, 2], [0, 1]), attendu(3, [0, 1], [0]), attendu(4, [0], [])]);
  for (const g of r) assert.ok(g.contenu.every((s) => s === 'a'));
  assert.deepEqual(r.map((g) => ids(g.couverture)), [['M1', 'M2'], ['M1', 'M2'], ['M1', 'M2'], ['M1']]);
  verifierTout(EL(car('aaaa'), car('aaa')));
});
test('B2. la multiplicité différente casse la fermeture : "aa" n\'est pas dérivable depuis "aaaa" seul (5 ≠ occurrences décalées)', () => {
  const r = produireSuitesFermees(EL(car('aaaa'), car('aaa')));
  const aa = r.find((g) => g.contenu.length === 2);
  assert.equal(aa.occurrences.length, 5);
  assert.equal(r.find((g) => g.contenu.length === 4).occurrences.length, 1);
});
test('C1. Pixel construit à la main : groupe fermé P,i,x,e,l couvre M1,M2,M3 ; M4 absent ; occurrences M1@8, M2@6, M3@0', () => {
  const E = EL(car('bonjour Pixel'), car('salut Pixel'), car('Pixel arrive'), car('au revoir'));
  const r = produireSuitesFermees(E);
  const pixel = r.find((g) => g.contenu.join('') === 'Pixel');
  assert.ok(pixel);
  assert.deepEqual(pixel.contenu, ['P', 'i', 'x', 'e', 'l']);
  assert.deepEqual(ids(pixel.couverture), ['M1', 'M2', 'M3']);
  assert.deepEqual(pixel.occurrences, [
    { element: ['M1'], parent: [], debut: 8 }, { element: ['M2'], parent: [], debut: 6 }, { element: ['M3'], parent: [], debut: 0 },
  ]);
  const avecEspace = r.find((g) => g.contenu.join('') === ' Pixel');
  assert.deepEqual(avecEspace.occurrences.map((o) => `${o.element[0]}@${o.debut}`), ['M1@7', 'M2@5']);
  assert.ok(!r.some((g) => g.contenu.join('') === 'Pixe'), 'Pixe, Pix, Pi, P sont dérivées, non fermées');
  verifierTout(E);
});
test('C2. Pixel : P, Pi, Pix, Pixe, Pixel se reconstruisent exactement depuis le groupe unique, avec la bonne couverture', () => {
  const E = EL(car('bonjour Pixel'), car('salut Pixel'), car('Pixel arrive'), car('au revoir'));
  const r = produireSuitesFermees(E);
  const faits = faitsRef(E);
  for (const mot of ['P', 'Pi', 'Pix', 'Pixe', 'Pixel']) {
    const cle = car(mot).map((c) => cleSymbole(c)).join('|');
    const rec = reconstruire(r, cle, faits.get(cle).occ);
    assert.ok(rec, mot);
    assert.deepEqual(rec.couverture, ['M1', 'M2', 'M3']);
    assert.equal(rec.occ.length, 3);
  }
});
test('D1. numérique : [1,2,3,4] / [8,2,3,9] donne [2,3] avec A@1, B@1', () => {
  const r = produireSuitesFermees(EL([1, 2, 3, 4], [8, 2, 3, 9]));
  const g = r.find((x) => x.contenu.length === 2 && x.contenu[0] === 2);
  assert.deepEqual(g.contenu, [2, 3]);
  assert.deepEqual(g.occurrences, [{ element: ['M1'], parent: [], debut: 1 }, { element: ['M2'], parent: [], debut: 1 }]);
  verifierTout(EL([1, 2, 3, 4], [8, 2, 3, 9]));
});
test('D2. types : [true,7,"x"] / [0,7,"x",false] : [7,"x"] partagé ; 7/"7", true/"true", 0/-0 jamais fusionnés', () => {
  const E = EL([true, 7, 'x'], [0, 7, 'x', false]);
  const r = produireSuitesFermees(E);
  const g = r.find((x) => x.contenu.length === 2 && x.contenu[0] === 7);
  assert.deepEqual(g.contenu, [7, 'x']);
  assert.deepEqual(ids(g.couverture), ['M1', 'M2']);
  verifierTout(E);
  assert.equal(produireSuitesFermees(EL([7], ['7'])).length, 2);
  assert.equal(produireSuitesFermees(EL([true], ['true'])).length, 2);
  const z = produireSuitesFermees(EL([0], [-0]));
  assert.equal(z.length, 2);
  assert.ok(z.some((x) => Object.is(x.contenu[0], 0)) && z.some((x) => Object.is(x.contenu[0], -0)));
  assert.equal(produireSuitesFermees(EL([7, 'x'], ['7', 'x'])).length, 3); // [7,"x"], ["7","x"] et « x » seul, partagé
  verifierTout(EL([0, 1, -0], [-0, 1, 0], [true, 'true', 1, '1']));
});
test('E1. parents : {a:[1,2,3], b:[1,2,4]} : parents ["a"] et ["b"], jamais de séquence à travers deux parents', () => {
  const E = EL({ a: [1, 2, 3], b: [1, 2, 4] });
  const r = produireSuitesFermees(E);
  const g12 = r.find((x) => x.contenu.length === 2 && x.contenu[0] === 1);
  assert.deepEqual(g12.occurrences, [{ element: ['M1'], parent: ['a'], debut: 0 }, { element: ['M1'], parent: ['b'], debut: 0 }]);
  assert.ok(!r.some((x) => x.contenu.length > 3));
  assert.ok(!r.some((x) => x.contenu.includes(3) && x.contenu.includes(4)));
  verifierTout(E);
});
test('E2. objet : les scalaires enfants d\'un objet et la racine scalaire ne forment aucune séquence', () => {
  assert.deepEqual(produireSuitesFermees(EL({ a: 1, b: 2 }, 'x', 5, true)), []);
});
test('F1. imbrication [1,2,[1,2,3],3] : racine [1,2] puis [3] ; parent [2] : [1,2,3]', () => {
  const E = EL([1, 2, [1, 2, 3], 3]);
  const r = produireSuitesFermees(E);
  const g12 = r.find((x) => x.contenu.length === 2 && x.contenu[1] === 2);
  assert.deepEqual(g12.occurrences, [{ element: ['M1'], parent: [], debut: 0 }, { element: ['M1'], parent: [2], debut: 0 }]);
  const g123 = r.find((x) => x.contenu.length === 3);
  assert.deepEqual(g123.occurrences, [{ element: ['M1'], parent: [2], debut: 0 }]);
  assert.ok(r.some((x) => x.contenu.length === 1 && x.contenu[0] === 3 && x.occurrences.some((o) => o.parent.length === 0 && o.debut === 3)));
  assert.ok(!r.some((x) => x.contenu.length >= 2 && x.occurrences.some((o) => o.parent.length === 0 && o.debut === 1)));
  verifierTout(E);
});
test('F2. null et conteneurs sont des barrières, jamais des symboles : [1,2,null,2,3] → [1,2],[2,3], pas [1,2,2,3]', () => {
  const E = EL([1, 2, null, 2, 3]);
  const r = produireSuitesFermees(E);
  assert.ok(!r.some((g) => g.contenu.length > 2));
  assert.ok(r.some((g) => g.contenu.join() === '1,2') && r.some((g) => g.contenu.join() === '2,3'));
  assert.ok(r.every((g) => g.contenu.every((s) => s !== null && typeof s !== 'object')));
  const g2 = r.find((g) => g.contenu.join() === '2');
  assert.deepEqual(g2.occurrences.map((o) => o.debut), [1, 3]);
  verifierTout(E);
});
test('F3. exemple du contrat [1,2,null,3,[7,8],9,"x"] → [1,2], [3], [7,8], [9,"x"]', () => {
  const r = produireSuitesFermees(EL([1, 2, null, 3, [7, 8], 9, 'x']));
  const parLongueur = r.filter((g) => g.contenu.length >= 2).map((g) => g.contenu);
  assert.deepEqual(parLongueur, [[1, 2], [7, 8], [9, 'x']]);
  assert.deepEqual(r.find((g) => g.contenu.join() === '3').occurrences, [{ element: ['M1'], parent: [], debut: 3 }]);
  assert.ok(!r.some((g) => g.contenu.includes(8) && g.contenu.includes(9)));
  verifierTout(EL([1, 2, null, 3, [7, 8], 9, 'x']));
});
test('G1. chaînes brutes : jamais parcourues ni décomposées', () => {
  const r = produireSuitesFermees(EL(['bonjour Pixel'], ['salut Pixel']));
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((g) => g.contenu), [['bonjour Pixel'], ['salut Pixel']]);
  assert.deepEqual(produireSuitesFermees(EL(['abc', 'abc'], ['abc'])).map((g) => [g.contenu, g.occurrences.length]), [[['abc'], 3], [['abc', 'abc'], 1]]);
});
test('H1. DÉRIVABILITÉ : corpus ababa/aba, abcab/abc, abab/bab, abcXabc/abcYabc, aaaa/aaa, a^7/aa — brute force exact', () => {
  for (const [a, b] of [['ababa', 'aba'], ['abcab', 'abc'], ['abab', 'bab'], ['abcXabc', 'abcYabc'], ['aaaa', 'aaa'], ['aaaaaaa', 'aa'], ['aaaa', 'aa']]) {
    const E = EL(car(a), car(b));
    const { sortie, faits, fermes } = verifierTout(E);
    assert.equal(sortie.length, fermes.length);
    assert.ok(sortie.length <= faits.size);
  }
});
test('H2. DÉRIVABILITÉ : corpus numérique typé avec nulls, imbrications et parents', () => {
  verifierTout(EL([1, 2, 3, 4], [8, 2, 3, 9], [2, 3, 2, 3], [null, 2, 3]));
  verifierTout(EL({ a: [1, '1', true], b: [1, '1', 'x', [1, '1']] }, [true, 1, '1', true, 1, '1']));
});
test('H3. FUZZ : 300 corpus aléatoires (alphabet typé, null, imbrications) égaux à la référence brute', () => {
  let graine = 12345;
  const alea = (n) => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine % n; };
  const alphabet = [1, '1', true, 0, -0, 'a', 2];
  const tab = (prof) => Array.from({ length: alea(9) }, () => { const t = alea(12); return t === 0 ? null : t === 1 && prof < 2 ? tab(prof + 1) : alphabet[alea(alphabet.length)]; });
  for (let i = 0; i < 300; i += 1) verifierTout(EL(...Array.from({ length: 1 + alea(3) }, () => (alea(5) === 0 ? { k: tab(0), z: tab(0) } : tab(0)))));
});
test('I1. CONTRE-TEST : la fermeture par COUVERTURE seule échoue (ababa/aba)', () => {
  const E = EL(car('ababa'), car('aba'));
  const faits = faitsRef(E);
  const faux = fermesParCouvertureRef(faits).map((c) => faits.get(c));
  const bons = fermesRef(faits);
  assert.notDeepEqual(faux.map(resumeRef).sort(), bons.map((c) => resumeRef(faits.get(c))).sort());
  // "a" a 5 occurrences, "ab" 3 : même couverture {M1,M2}, occurrences différentes
  assert.equal(faits.get('s:a').occ.size, 5);
  assert.equal(faits.get('s:a|s:b').occ.size, 3);
  assert.deepEqual(couvDe([...faits.get('s:a').occ.values()]), couvDe([...faits.get('s:a|s:b').occ.values()]));
  // avec les seuls groupes fermés par couverture, "a" n'est pas reconstructible depuis UN groupe
  const groupesFaux = faux.map((f) => ({ contenu: f.contenu, occurrences: [...f.occ.values()], couverture: [] }));
  assert.equal(reconstruire(groupesFaux, 's:a', faits.get('s:a').occ), null);
  // le module, lui, garde "a" fermé
  assert.ok(produireSuitesFermees(E).some((g) => g.contenu.join() === 'a' && g.occurrences.length === 5));
});
test('J1. singletons et longueur 1 conservés : aucun seuil (suite unique de 6 symboles → 1 groupe ; deux éléments disjoints → 2)', () => {
  assert.equal(produireSuitesFermees(EL([1, 2, 3, 4, 5, 6])).length, 1);
  assert.equal(produireSuitesFermees(EL([1], [2])).length, 2);
  assert.deepEqual(produireSuitesFermees(EL([1, 2], [3])).map((g) => g.contenu), [[1, 2], [3]]);
});
test('J2. plusieurs occurrences dans un élément : conservées, couverture sans doublon', () => {
  const r = produireSuitesFermees(EL([5, 6, 5, 6, 5, 6, 9]));
  const g = r.find((x) => x.contenu.join() === '5,6');
  assert.equal(g.occurrences.length, 3);
  assert.deepEqual(g.couverture, [['M1']]);
});
test('K1. ordre sans sens : permutations des éléments et des clés d\'objet donnent la même sortie', () => {
  const E = EL(car('ababa'), car('aba'), { z: [1, 2, 3], a: [1, 2, 4] });
  const ref = JSON.stringify(produireSuitesFermees(E));
  assert.equal(JSON.stringify(produireSuitesFermees([E[2], E[0], E[1]])), ref);
  assert.equal(JSON.stringify(produireSuitesFermees([E[1], E[2], E[0]])), ref);
  const inv = [el('M3', { a: [1, 2, 4], z: [1, 2, 3] }), E[0], E[1]];
  assert.equal(JSON.stringify(produireSuitesFermees(inv)), ref);
});
test('K2. identités opaques : aucune inférence depuis le nom ; doublon = TypeError', () => {
  const a = produireSuitesFermees([el('2026-01-01', [1, 2]), el('message-7', [1, 2])]);
  assert.deepEqual(ids(a[0].couverture), ['2026-01-01', 'message-7']);
  assert.throws(() => produireSuitesFermees([el('A', [1]), el('A', [1])]), TypeError);
  assert.throws(() => produireSuitesFermees([{ chemin: 'A', contenu: [1] }]), TypeError);
});
test('L1. validation : entrée non tableau, élément invalide, accesseur, contenu hors domaine', () => {
  for (const mauvais of [null, undefined, 3, 'x', {}]) assert.throws(() => produireSuitesFermees(mauvais), TypeError);
  assert.throws(() => produireSuitesFermees([null]), TypeError);
  assert.throws(() => produireSuitesFermees([[]]), TypeError);
  assert.throws(() => produireSuitesFermees([{ chemin: ['A'] }]), TypeError);
  assert.throws(() => produireSuitesFermees([{ chemin: ['A'], get contenu() { return [1]; } }]), TypeError);
  assert.throws(() => produireSuitesFermees([el('A', [1]), el('B', [undefined])]), TypeError);
  assert.throws(() => produireSuitesFermees([el('A', [NaN])]), TypeError);
  assert.throws(() => produireSuitesFermees([el('A', [1, new Date(0)])]), TypeError);
  assert.throws(() => produireSuitesFermees(new Array(2)), TypeError);
});
test('L2. accepte directement la sortie de la vue des valeurs persistées', () => {
  const univers = universValeurs([{ id: 'V1', valeur: [1, 2, 3] }, { id: 'V2', valeur: [0, 2, 3] }], []);
  const r = produireSuitesFermees(univers);
  assert.deepEqual(r.find((g) => g.contenu.length === 2).contenu, [2, 3]);
});
test('M1. entrée jamais modifiée (gelée) ; sortie neuve, sans partage de structure', () => {
  const gel = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gel(v[k]); } return v; };
  const E = gel(EL(car('ababa'), car('aba')));
  const r = produireSuitesFermees(E);
  const vus = new Set();
  for (const g of r) {
    for (const x of [g, g.contenu, g.occurrences, g.couverture, ...g.occurrences, ...g.occurrences.map((o) => o.element), ...g.occurrences.map((o) => o.parent), ...g.couverture]) {
      assert.ok(!vus.has(x)); vus.add(x);
      assert.ok(!Object.isFrozen(x));
    }
  }
  assert.equal(JSON.stringify(E), JSON.stringify(EL(car('ababa'), car('aba'))));
});
test('N1. AUCUNE NOUVELLE PERCEPTION : chaque symbole de chaque occurrence est une valeur vue par l\'observateur de valeurs, à ce chemin exact', () => {
  const corpus = EL({ a: [1, '1', true, null, 0, -0], b: [[1, 2], 'x', 'x'] }, [1, '1', true, 0, -0, [3, 4], 'x', 'x'], 'racine', { k: 5 });
  const suites = produireSuitesFermees(corpus);
  const valeurs = produireConstatsValeurs(corpus);
  const vu = new Set();
  for (const c of valeurs) for (const o of c.occurrences) vu.add(`${o.element[0]}#${JSON.stringify(o.chemin)}#${cleSymbole(c.constat.valeur)}`);
  const utilises = new Set();
  for (const g of suites) {
    for (const o of g.occurrences) {
      g.contenu.forEach((s, i) => {
        const cle = `${o.element[0]}#${JSON.stringify([...o.parent, o.debut + i])}#${cleSymbole(s)}`;
        assert.ok(vu.has(cle), cle);
        utilises.add(cle);
      });
    }
  }
  // et réciproquement : tout symbole vu à un chemin dont le dernier segment est un indice et qui est dans une séquence est utilisé
  const attendus = [...vu].filter((k) => /^[^#]+#\[(?:.*,)?\d+\]#/.test(k));
  assert.deepEqual([...utilises].sort(), attendus.sort());
});
test('O1. PERFORMANCE mesurée, sans seuil ajouté : a^300, (ab)^100, corpus pseudo-réaliste', () => {
  const mesures = [];
  const mesurer = (nom, E) => { const t = Date.now(); const r = produireSuitesFermees(E); mesures.push({ nom, groupes: r.length, occurrences: r.reduce((n, g) => n + g.occurrences.length, 0), ms: Date.now() - t }); return r; };
  const a300 = mesurer('a^300', EL(Array(300).fill('a')));
  assert.equal(a300.length, 300);
  assert.equal(a300.reduce((n, g) => n + g.occurrences.length, 0), 45150); // dette quadratique documentée : n(n+1)/2
  const ab = mesurer('(ab)^100', EL(Array.from({ length: 200 }, (_, i) => (i % 2 ? 'b' : 'a'))));
  assert.ok(ab.length > 0);
  let graine = 7; const alea = (n) => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine % n; };
  const vocabulaire = Array.from({ length: 60 }, (_, i) => `s${i}`);
  const E = Array.from({ length: 100 }, (_, i) => el(`E${String(i).padStart(3, '0')}`, Array.from({ length: 30 + alea(30) }, () => vocabulaire[alea(vocabulaire.length)])));
  mesurer('pseudo-réaliste 100 éléments', E);
  assert.ok(mesures.every((m) => m.groupes > 0 && Number.isFinite(m.ms)));
  if (process.env.MESURES_SUITES) console.log(JSON.stringify(mesures));
});
test('P1. statique : imports exacts, aucune connaissance linguistique, aucun temps/magasin/async, aucune décomposition de chaîne', () => {
  assert.deepEqual(CODE.match(/^\s*import\b.*$/gm), [
    'import { parcourirStructure } from \'./parcours-structure.js\';',
    'import { normaliserCouverture } from \'./couverture-occurrences.js\';',
    'import { resoudreCouverture } from \'./resolution-couverture.js\';',
  ]);
  for (const nom of ['tokeniser', 'decouper', 'repererMotifs', 'decrireStructureIdentifiee', 'extraction', 'induction', 'bagage', 'observationsLangage',
    'toLowerCase', 'toUpperCase', 'normalize', 'split', 'trim', 'RegExp', 'JSON', 'Date', 'horodatage', 'magasin', 'lireTout', 'ecrire', 'await', 'async', 'localStorage',
    'produireConstatsStructurels', 'produireConstatsValeurs', 'universValeurs', 'DESCRIPTIONS_OPERATIONS', 'TABLE_OPERATIONS', 'score', 'seuil', 'frequence', 'Array\\.from', 'codePointAt', 'charAt', 'localeCompare']) {
    assert.ok(!new RegExp(`\\b${nom}\\b`).test(CODE), nom);
  }
  assert.ok(!/\.\.\.\s*valeur\b/.test(CODE) && !/\[\.\.\.\s*(?:occurrence\.)?valeur/.test(CODE));
});
test('Q1. MISE À JOUR DÉLIBÉRÉE v0.63.42 : décrite au catalogue et invocable par la table (seuls ce fichier, le catalogue et la table la nomment) ; atteinte depuis main.js SEULEMENT par la table ; aucune persistance', () => {
  const parcourir = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? parcourir(p) : [p]; });
  const racine = join(RACINE, 'app');
  const nommant = parcourir(racine).filter((p) => /\.(js|mjs|html)$/.test(p)).filter((p) => /suites-fermees|produireSuitesFermees/.test(readFileSync(p, 'utf8'))).map((p) => relative(RACINE, p));
  assert.deepEqual(nommant, ['app/langage/descriptions-operations.js', 'app/langage/suites-fermees.js', 'app/langage/table-operations.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : + catalogue et table
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 (symbolesDeChaine) ; la primitive de ce fichier reste absente du catalogue (assertions suivantes) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) ; MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.ok(DESCRIPTIONS_OPERATIONS.some((d) => d.nom === 'produireSuitesFermees')); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : décrite
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 (symbolesDeChaine) ; la primitive de ce fichier reste absente de la table (assertion suivante) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) ; MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.ok('produireSuitesFermees' in TABLE_OPERATIONS); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : invocable
  const vus = new Set(); const pile = [join(racine, 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) pile.push(resolve(dirname(f), m[1] || m[2]));
  }
  assert.equal([...vus].some((f) => relative(RACINE, f) === 'app/langage/suites-fermees.js'), true); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : atteinte via table-operations.js (outil de sollicitation) ; seul importeur :
  const importeurs = parcourir(racine).filter((p) => /\.js$/.test(p) && /from '\.\/suites-fermees\.js'/.test(readFileSync(p, 'utf8'))).map((p) => relative(RACINE, p));
  assert.deepEqual(importeurs, ['app/langage/table-operations.js']);
});
test('R1. versions inchangées : VERSION_BASE 19, SCHEMA 9, TABLES 22, aucune table nouvelle', () => {
  assert.equal(VERSION_BASE, 20); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 10); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables)
  assert.equal(TABLES.length, 23); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables)
  assert.ok(!TABLES.some((t) => /suite/i.test(t)));
});
