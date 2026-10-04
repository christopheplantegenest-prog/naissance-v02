// === DEBUT_TEST_VALEURS_OBSERVEES ===
// v0.62.2 — ÉTAPE 6 : « VALEURS OBSERVÉES D'UNE PROPRIÉTÉ » (décision ChatGPT D10/D11/D12, 03/10/2026).
// Teste la primitive pure, générale et DORMANTE decrireValeursObservees() (app/langage/valeurs-observees.js) :
// étant donné des identités auxquelles l'appelant a déjà associé une valeur, quelles valeurs existent et
// quelles identités portent chacune. Aucune dépendance aux traces/énoncés/arités : les tests utilisent des
// valeurs sans signification (7, 11, "A", "rouge"...). Aucun score/majorité/préférence/sélection n'existe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decrireValeursObservees } from '../app/langage/valeurs-observees.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

// Construit [{id:'m1', valeur:v1}, ...] (m1, m2, ... dans l'ordre).
const paires = (vals) => vals.map((valeur, i) => ({ id: `m${i + 1}`, valeur }));
const decrire = (vals) => decrireValeursObservees(paires(vals));
const lignes = (r) => r.valeurs.map((l) => [l.valeur, l.ids]);

// --- 1. les contre-exemples demandés ------------------------------------------------------------
test('7,7,7,11 : deux valeurs, deux ensembles', () => {
  const r = decrire([7, 7, 7, 11]);
  assert.deepEqual(lignes(r), [[7, ['m1', 'm2', 'm3']], [11, ['m4']]]);
  assert.equal(r.nombreValeurs, 2);
  assert.deepEqual(r.nonResolus, []);
  assert.deepEqual(r.ambigus, []);
});

test('7,11,7,11 : deux valeurs, deux ensembles entrelacés', () => {
  const r = decrire([7, 11, 7, 11]);
  assert.deepEqual(lignes(r), [[7, ['m1', 'm3']], [11, ['m2', 'm4']]]);
  assert.equal(r.nombreValeurs, 2);
});

test('7,7,7,7 : une seule valeur', () => {
  const r = decrire([7, 7, 7, 7]);
  assert.deepEqual(lignes(r), [[7, ['m1', 'm2', 'm3', 'm4']]]);
  assert.equal(r.nombreValeurs, 1);
});

test('7,8,9,10 : quatre valeurs', () => {
  const r = decrire([7, 8, 9, 10]);
  assert.deepEqual(lignes(r), [[7, ['m1']], [8, ['m2']], [9, ['m3']], [10, ['m4']]]);
  assert.equal(r.nombreValeurs, 4);
});

test('"A","A","B","B" : valeurs textuelles, aucune différence avec le numérique', () => {
  const r = decrire(['A', 'A', 'B', 'B']);
  assert.deepEqual(lignes(r), [['A', ['m1', 'm2']], ['B', ['m3', 'm4']]]);
  assert.equal(r.nombreValeurs, 2);
});

test('"rouge","bleu","rouge" : la même primitive, sans savoir ce que représentent les valeurs', () => {
  const r = decrireValeursObservees([{ id: 'a', valeur: 'rouge' }, { id: 'b', valeur: 'bleu' }, { id: 'c', valeur: 'rouge' }]);
  assert.deepEqual(lignes(r), [['rouge', ['a', 'c']], ['bleu', ['b']]]);
});

test('"A","A" : répétition = une valeur portée par deux identités', () => {
  assert.deepEqual(lignes(decrire(['A', 'A'])), [['A', ['m1', 'm2']]]);
});

test('"A" : un seul membre est un cas valide, sans rien conclure', () => {
  const r = decrire(['A']);
  assert.deepEqual(lignes(r), [['A', ['m1']]]);
  assert.equal(r.nombreValeurs, 1);
  assert.deepEqual(Object.keys(r).sort(), ['ambigus', 'nombreValeurs', 'nonResolus', 'valeurs']);
});

test('entrée vide : aucune valeur, aucune erreur', () => {
  assert.deepEqual(decrireValeursObservees([]), { valeurs: [], nombreValeurs: 0, nonResolus: [], ambigus: [] });
});

// --- 2. égalité typée, null, undefined, booléens --------------------------------------------------
test('7 et "7" sont deux valeurs distinctes (aucune conversion en chaîne)', () => {
  const r = decrire([7, '7']);
  assert.equal(r.nombreValeurs, 2);
  assert.deepEqual(lignes(r), [[7, ['m1']], ['7', ['m2']]]);
  assert.equal(typeof r.valeurs[0].valeur, 'number');
  assert.equal(typeof r.valeurs[1].valeur, 'string');
});

test('autres confusions refusées : true/"true", ""/undefined, 0/"0"/false, ""/null', () => {
  assert.equal(decrire([true, 'true']).nombreValeurs, 2);
  assert.equal(decrire(['', undefined]).nombreValeurs, 2);
  assert.equal(decrire([0, '0', false]).nombreValeurs, 3);
  assert.equal(decrire(['', null]).nombreValeurs, 2);
});

test('null/null : UNE valeur null portée par deux identités', () => {
  const r = decrire([null, null]);
  assert.deepEqual(lignes(r), [[null, ['m1', 'm2']]]);
  assert.equal(r.nombreValeurs, 1);
});

test('undefined/undefined : UNE valeur undefined explicitement observée (jamais écartée)', () => {
  const r = decrire([undefined, undefined]);
  assert.equal(r.nombreValeurs, 1);
  assert.equal(r.valeurs[0].valeur, undefined);
  assert.deepEqual(r.valeurs[0].ids, ['m1', 'm2']);
  assert.deepEqual(r.nonResolus, []);
});

test('null/undefined : DEUX valeurs distinctes (undefined n\'est pas transformé en null)', () => {
  const r = decrire([null, undefined]);
  assert.equal(r.nombreValeurs, 2);
  assert.deepEqual(r.valeurs.map((l) => l.valeur), [null, undefined]);
  assert.equal(Object.is(r.valeurs[1].valeur, undefined), true);
});

test('valeur explicitement undefined ≠ propriété absente : observée vs non résolue', () => {
  const r = decrireValeursObservees([{ id: 'a', valeur: undefined }, { id: 'b' }, { id: 'c', valeur: 7 }]);
  assert.deepEqual(r.valeurs.map((l) => [l.valeur, l.ids]), [[undefined, ['a']], [7, ['c']]]);
  assert.deepEqual(r.nonResolus, ['b']);
  assert.deepEqual(r.ambigus, []);
  assert.equal(r.nombreValeurs, 2);
});

test('une propriété `valeur` seulement héritée n\'est pas une valeur observée', () => {
  const entree = Object.create({ valeur: 7 });
  entree.id = 'h';
  const r = decrireValeursObservees([entree]);
  assert.deepEqual(r.nonResolus, ['h']);
  assert.deepEqual(r.valeurs, []);
});

test('boolean true/false : deux valeurs', () => {
  const r = decrire([true, false, true]);
  assert.deepEqual(lignes(r), [[true, ['m1', 'm3']], [false, ['m2']]]);
});

test('nombres : 0 et -0 ne font qu\'une valeur (===), 1.5 ≠ 1', () => {
  assert.equal(decrire([0, -0]).nombreValeurs, 1);
  assert.equal(decrire([1, 1.5]).nombreValeurs, 2);
});

// --- 3. ordre, déterminisme ------------------------------------------------------------------------
test('l\'ordre des entrées reçues ne change jamais la sortie', () => {
  const base = paires([7, 11, 7, 'x', null, 11, undefined, true]);
  const attendu = decrireValeursObservees(base);
  const permutations = [base.slice().reverse(), [...base.slice(3), ...base.slice(0, 3)], [base[4], base[0], base[7], base[2], base[1], base[6], base[3], base[5]]];
  for (const p of permutations) assert.deepEqual(decrireValeursObservees(p), attendu);
});

test('ordre des lignes = plus petite identité de chaque groupe, jamais la valeur (valeurs hétérogènes)', () => {
  const r = decrireValeursObservees([
    { id: 'z', valeur: 1 }, { id: 'a', valeur: 'x' }, { id: 'm', valeur: null }, { id: 'b', valeur: 1 },
  ]);
  assert.deepEqual(r.valeurs.map((l) => [l.valeur, l.ids]), [['x', ['a']], [1, ['b', 'z']], [null, ['m']]]);
  // même résultat si les valeurs « grandes » étaient numériquement ou lexicalement dans l'autre sens
  const r2 = decrireValeursObservees([{ id: 'z', valeur: 'x' }, { id: 'a', valeur: 1 }, { id: 'b', valeur: 'x' }]);
  assert.deepEqual(r2.valeurs.map((l) => l.valeur), [1, 'x']);
});

test('ids triés dans chaque ligne (ordre des unités de code, comme les couvertures du dépôt)', () => {
  const r = decrireValeursObservees([{ id: 'b', valeur: 1 }, { id: 'B', valeur: 1 }, { id: 'a', valeur: 1 }, { id: 'a1', valeur: 1 }]);
  assert.deepEqual(r.valeurs[0].ids, ['B', 'a', 'a1', 'b']);
});

// --- 4. ids invalides ou dupliqués ----------------------------------------------------------------
test('ids invalides : TypeError explicite, jamais corrigés ni écartés', () => {
  for (const id of [undefined, null, '', 1, 0, true, {}, [], ['a']]) {
    assert.throws(() => decrireValeursObservees([{ id, valeur: 7 }]), TypeError, `id ${JSON.stringify(id)}`);
  }
  assert.throws(() => decrireValeursObservees([{ valeur: 7 }]), TypeError);
  assert.doesNotThrow(() => decrireValeursObservees([{ id: ' ', valeur: 7 }]), 'aucune normalisation : « » + espace est un id (non vide)');
});

test('entrées invalides : non tableau, entrée non objet : TypeError explicite', () => {
  for (const x of [undefined, null, 'abc', 7, {}, new Set()]) assert.throws(() => decrireValeursObservees(x), TypeError);
  for (const e of [null, undefined, 7, 'a', true, ['a', 7]]) assert.throws(() => decrireValeursObservees([e]), TypeError);
});

test('valeurs hors contrat étroit : objets, tableaux, NaN, ±Infinity, bigint, symbol, fonction : TypeError', () => {
  const interdites = [{}, { a: 1 }, [], [1], NaN, Infinity, -Infinity, 10n, Symbol('s'), () => 1, new Date(0)];
  for (const valeur of interdites) assert.throws(() => decrireValeursObservees([{ id: 'a', valeur }]), TypeError, String(typeof valeur));
});

test('ids dupliqués avec valeurs DIFFÉRENTES : aucun écrasement, rapportés comme ambigus, absents des groupes', () => {
  const r = decrireValeursObservees([{ id: 'a', valeur: 7 }, { id: 'b', valeur: 7 }, { id: 'a', valeur: 11 }]);
  assert.deepEqual(r.ambigus, ['a']);
  assert.deepEqual(r.valeurs.map((l) => [l.valeur, l.ids]), [[7, ['b']]]);
  assert.equal(r.nombreValeurs, 1, 'ni 7 ni 11 ne sont attribués à « a »');
  assert.deepEqual(r.nonResolus, []);
});

test('ids dupliqués avec la MÊME valeur : également rapportés (aucune fusion silencieuse)', () => {
  const r = decrireValeursObservees([{ id: 'a', valeur: 7 }, { id: 'a', valeur: 7 }, { id: 'b', valeur: 7 }]);
  assert.deepEqual(r.ambigus, ['a']);
  assert.deepEqual(r.valeurs.map((l) => [l.valeur, l.ids]), [[7, ['b']]]);
});

test('id dupliqué dont une entrée est incomplète : ambigu, jamais « non résolu » ni valeur choisie', () => {
  const r = decrireValeursObservees([{ id: 'a' }, { id: 'a', valeur: 7 }, { id: 'c' }]);
  assert.deepEqual(r.ambigus, ['a']);
  assert.deepEqual(r.nonResolus, ['c']);
  assert.deepEqual(r.valeurs, []);
});

test('un id triplé reste UNE identité ambiguë (listée une fois)', () => {
  const r = decrireValeursObservees([{ id: 'a', valeur: 1 }, { id: 'a', valeur: 2 }, { id: 'a', valeur: 3 }]);
  assert.deepEqual(r.ambigus, ['a']);
  assert.equal(r.nombreValeurs, 0);
});

test('ids « exotiques » mais valides : __proto__, constructor, caractères spéciaux', () => {
  const r = decrireValeursObservees([{ id: '__proto__', valeur: 1 }, { id: 'constructor', valeur: 1 }, { id: 'é\u0000', valeur: 2 }]);
  assert.deepEqual(r.valeurs.map((l) => [l.valeur, l.ids]), [[1, ['__proto__', 'constructor']], [2, ['é\u0000']]]);
});

// --- 5. pureté ---------------------------------------------------------------------------------------
test('pureté : entrée gelée acceptée, jamais mutée, sortie indépendante de l\'entrée', () => {
  const entrees = paires([7, 11, 7, undefined, null]).map((e) => Object.freeze(e));
  Object.freeze(entrees);
  const avant = JSON.stringify(entrees);
  const r = decrireValeursObservees(entrees);
  assert.equal(JSON.stringify(entrees), avant);
  r.valeurs[0].ids.push('intrus');
  r.nonResolus.push('x');
  const r2 = decrireValeursObservees(entrees);
  assert.deepEqual(r2.valeurs[0].ids, ['m1', 'm3']);
  assert.deepEqual(r2.nonResolus, []);
  assert.notEqual(r, r2);
});

test('déterminisme : deux appels identiques donnent la même sortie', () => {
  const e = paires([7, 11, 7, 'a', null]);
  assert.deepEqual(decrireValeursObservees(e), decrireValeursObservees(e));
});

// --- 6. aucun score, majorité, préférence, sélection -----------------------------------------------
test('aucun résultat ne contient score, majorité, préférence, dominance, sélection, fréquence qualifiée', () => {
  const cas = [decrire([7, 7, 7, 11]), decrire(['A']), decrire([7, 11, 7, 11]), decrireValeursObservees([])];
  const interdits = /score|majorit|dominan|prefer|préfér|select|sélect|choix|choisi|meilleur|confiance|frequence|fréquence|gagnant|principal|plus ?grand/i;
  for (const r of cas) {
    assert.deepEqual(Object.keys(r).sort(), ['ambigus', 'nombreValeurs', 'nonResolus', 'valeurs']);
    for (const ligne of r.valeurs) assert.deepEqual(Object.keys(ligne).sort(), ['ids', 'valeur']);
    assert.equal(interdits.test(JSON.stringify(Object.keys(r))), false);
  }
  // 7,7,7,11 : le groupe le plus nombreux n'est ni marqué ni placé par sa taille (le 11 vient en premier ici)
  const r = decrireValeursObservees([{ id: 'a', valeur: 11 }, { id: 'b', valeur: 7 }, { id: 'c', valeur: 7 }, { id: 'd', valeur: 7 }]);
  assert.deepEqual(r.valeurs.map((l) => l.valeur), [11, 7]);
});

// --- 7. indépendance et non-branchement statiques ------------------------------------------------------
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
const SOURCE = fs.readFileSync(path.join(RACINE, 'app', 'langage', 'valeurs-observees.js'), 'utf8');

test('7a. le module n\'importe RIEN (indépendance totale)', () => {
  assert.equal(/^\s*import\s/m.test(SOURCE), false);
  assert.equal(/\brequire\s*\(|\bimport\s*\(/.test(sansCommentairesPurs(SOURCE)), false);
});

test('7b. le code (hors commentaires) ne connaît ni arites, ni traces, ni énoncés, ni capacités, ni textes', () => {
  const code = sansCommentairesPurs(SOURCE);
  assert.equal(/arite|vueElementsNonDecrits|trace|enonce|experience|capacite|texteBrut|token|jeton/i.test(code), false);
});

test('7c. aucun fichier de app/ ne référence ce module ni sa fonction (v0.63.4 : le SEUL fichier autorisé à NOMMER la fonction est le module descriptif app/langage/descriptions-operations.js, qui ne l\'importe pas : voir tests/descriptions-operations.test.mjs)', () => {
  const fautifs = [];
  for (const f of fichiersJs(path.join(RACINE, 'app'))) {
    const rel = path.relative(RACINE, f).split(path.sep).join('/');
    if (rel === 'app/langage/valeurs-observees.js') continue;
    if (rel === 'app/langage/descriptions-operations.js') continue; // dérogation v0.63.4 : nommer sans importer (garanti ailleurs)
    if (/valeurs-observees|decrireValeursObservees/.test(sansCommentairesPurs(fs.readFileSync(f, 'utf8')))) fautifs.push(rel);
  }
  assert.deepEqual(fautifs, []);
});

test('7d. vueElementsNonDecrits n\'est PAS branchée à cette primitive (frontière de version)', () => {
  const vt = sansCommentairesPurs(fs.readFileSync(path.join(RACINE, 'app', 'langage', 'vue-traces.js'), 'utf8'));
  assert.equal(/valeurs-observees|decrireValeursObservees/.test(vt), false);
});
// === FIN_TEST_VALEURS_OBSERVEES ===
