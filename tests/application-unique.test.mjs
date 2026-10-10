// === DEBUT_TEST_APPLICATION_UNIQUE ===
// v0.63.25 — « DÉTERMINER L'UNICITÉ D'UNE APPLICATION — PUR — DORMANT — AUCUNE EXÉCUTION » (décision ChatGPT, 05/10/2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { applicationUnique } from '../app/langage/application-unique.js';
import * as module_ from '../app/langage/application-unique.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const SRC = lu('app', 'langage', 'application-unique.js');
const CODE = sansCommentaires(SRC);
const g = (operation, ...entrees) => ({ operation, entrees: entrees.map(([entree, ...donnees]) => ({ entree, donnees })) });
const copie = (x) => JSON.parse(JSON.stringify(x));

// ============================================================================ A. CONTRAT ET ÉTATS
test('A1. un seul export : applicationUnique ; aucun import', () => {
  assert.deepEqual(Object.keys(module_), ['applicationUnique']);
  assert.equal(/^\s*import\b/m.test(CODE), false);
});
test('A2. cas 0 : [] → aucune, application null', () => {
  assert.deepEqual(applicationUnique([]), { etat: 'aucune', application: null });
});
test('A3. cas 1 : une entrée, un candidat → unique, application exacte', () => {
  assert.deepEqual(applicationUnique([g('parcourirStructure', ['valeur', 'M'])]), { etat: 'unique', application: { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'M' }] } });
});
test('A4. cas >1 : une entrée, deux candidats → plusieurs, application null (aucun candidat choisi)', () => {
  assert.deepEqual(applicationUnique([g('parcourirStructure', ['valeur', 'A', 'B'])]), { etat: 'plusieurs', application: null });
});
test('A5. multi-entrées : a=[A], b=[B] → unique a←A, b←B', () => {
  assert.deepEqual(applicationUnique([g('memesCouvertures', ['a', 'A'], ['b', 'B'])]), { etat: 'unique', application: { operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'B' }] } });
});
test('A6. multi-entrées : a=[A,B], b=[C] ; a=[A,B], b=[C,D] ; a=[A], b=[C,D] → plusieurs', () => {
  for (const x of [g('o', ['a', 'A', 'B'], ['b', 'C']), g('o', ['a', 'A', 'B'], ['b', 'C', 'D']), g('o', ['a', 'A'], ['b', 'C', 'D'])]) {
    assert.deepEqual(applicationUnique([x]), { etat: 'plusieurs', application: null });
  }
});
test('A7. DEUX GROUPES UNIQUES (O1 a=[A], O2 x=[X]) → plusieurs, application null (jamais O1 ou O2)', () => {
  for (const ordre of [[g('O1', ['a', 'A']), g('O2', ['x', 'X'])], [g('O2', ['x', 'X']), g('O1', ['a', 'A'])]]) {
    assert.deepEqual(applicationUnique(ordre), { etat: 'plusieurs', application: null });
  }
});
test('A8. un groupe unique + un groupe multiple → plusieurs ; trois groupes uniques → plusieurs', () => {
  assert.equal(applicationUnique([g('O1', ['a', 'A']), g('O2', ['x', 'X', 'Y'])]).etat, 'plusieurs');
  assert.equal(applicationUnique([g('O1', ['a', 'A']), g('O2', ['x', 'X']), g('O3', ['y', 'Y'])]).etat, 'plusieurs');
});
test('A9. même donnée sur plusieurs entrées : valide, exactement une application a←A, b←A', () => {
  assert.deepEqual(applicationUnique([g('o', ['a', 'A'], ['b', 'A'])]).application.liaisons, [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'A' }]);
  assert.equal(applicationUnique([g('o', ['a', 'A'], ['b', 'A'])]).etat, 'unique');
});
test('A10. même donnée dans deux groupes différents : permis (identités non uniques globalement), mais deux applications → plusieurs', () => {
  assert.equal(applicationUnique([g('O1', ['a', 'A']), g('O2', ['x', 'A'])]).etat, 'plusieurs');
});

// ============================================================================ B. PERMUTATIONS / CANONIQUE / COPIE
test('B1. permutation des groupes, des entrées, des données : même état, même application', () => {
  const unique = [g('memesCouvertures', ['b', 'B'], ['a', 'A'])];
  const ref = applicationUnique(unique);
  assert.deepEqual(applicationUnique([g('memesCouvertures', ['a', 'A'], ['b', 'B'])]), ref);
  assert.deepEqual(ref.application.liaisons.map((l) => l.entree), ['a', 'b']);
  const multi = [g('O1', ['a', 'A', 'B']), g('O2', ['x', 'X'])];
  const perm = [g('O2', ['x', 'X']), g('O1', ['a', 'B', 'A'])];
  assert.deepEqual(applicationUnique(multi), applicationUnique(perm));
});
test('B2. ordre lexical non préféré : liaisons triées par entree, mais jamais un candidat choisi', () => {
  assert.equal(applicationUnique([g('o', ['z', 'Z1', 'Z2'], ['a', 'A'])]).application, null);
  assert.deepEqual(applicationUnique([g('o', ['z', 'Z'], ['a', 'A'], ['m', 'M'])]).application.liaisons.map((l) => l.entree), ['a', 'm', 'z']);
});
test('B3. copie neuve : modifier la sortie ne touche pas l\'entrée ; aucune référence conservée ; appels indépendants', () => {
  const entree = [g('o', ['a', 'A'])];
  const avant = copie(entree);
  const r1 = applicationUnique(entree); const r2 = applicationUnique(entree);
  assert.notEqual(r1, r2); assert.notEqual(r1.application, r2.application); assert.notEqual(r1.application.liaisons, r2.application.liaisons);
  r1.application.liaisons[0].donnee = 'X'; r1.application.operation = 'zzz';
  assert.deepEqual(entree, avant);
  assert.equal(applicationUnique(entree).application.liaisons[0].donnee, 'A');
  assert.notEqual(r2.application.liaisons[0], entree[0].entrees[0]);
});
test('B4. entrée non modifiée (ni ordre ni contenu)', () => {
  const entree = [g('O2', ['y', 'Y2', 'Y1'], ['x', 'X']), g('O1', ['a', 'A'])];
  const avant = copie(entree);
  applicationUnique(entree);
  assert.deepEqual(entree, avant);
});

// ============================================================================ C. VALIDATION STRICTE
test('C1. entrée non-tableau / groupe invalide / entrée invalide / donnée invalide : TypeError', () => {
  const mauvais = [undefined, null, {}, 'x', 3,
    [null], [[]], ['x'], [{}], [{ operation: 'o' }], [{ entrees: [] }],
    [{ operation: '', entrees: [{ entree: 'a', donnees: ['A'] }] }], [{ operation: 3, entrees: [{ entree: 'a', donnees: ['A'] }] }],
    [{ operation: 'o', entrees: [] }], [{ operation: 'o', entrees: {} }], [{ operation: 'o', entrees: [null] }],
    [{ operation: 'o', entrees: [{ entree: 'a' }] }], [{ operation: 'o', entrees: [{ donnees: ['A'] }] }],
    [{ operation: 'o', entrees: [{ entree: '', donnees: ['A'] }] }], [{ operation: 'o', entrees: [{ entree: 'a', donnees: [] }] }],
    [{ operation: 'o', entrees: [{ entree: 'a', donnees: {} }] }], [{ operation: 'o', entrees: [{ entree: 'a', donnees: [''] }] }],
    [{ operation: 'o', entrees: [{ entree: 'a', donnees: [3] }] }], [{ operation: 'o', entrees: [{ entree: 'a', donnees: [null] }] }],
  ];
  for (const m of mauvais) assert.throws(() => applicationUnique(m), TypeError, JSON.stringify(m));
});
test('C2. doublons : opération entre groupes, entrée dans un groupe, donnée dans une entrée → TypeError', () => {
  assert.throws(() => applicationUnique([g('o', ['a', 'A']), g('o', ['b', 'B'])]), TypeError);
  assert.throws(() => applicationUnique([g('o', ['a', 'A'], ['a', 'B'])]), TypeError);
  assert.throws(() => applicationUnique([g('o', ['a', 'A', 'A'])]), TypeError);
});
test('C3. clé étrangère, symbole, héritage, accesseur : TypeError sans exécution du getter', () => {
  let lu_ = 0;
  const piege = () => ({ get() { lu_ += 1; return 'x'; }, enumerable: true });
  const groupeAcc = {}; Object.defineProperty(groupeAcc, 'operation', piege()); groupeAcc.entrees = [{ entree: 'a', donnees: ['A'] }];
  const entreeAcc = { operation: 'o', entrees: [{ entree: 'a' }] }; Object.defineProperty(entreeAcc.entrees[0], 'donnees', piege());
  const tabAcc = [g('o', ['a', 'A'])]; Object.defineProperty(tabAcc, 0, piege());
  const donneesAcc = [g('o', ['a', 'A'])]; Object.defineProperty(donneesAcc[0].entrees[0].donnees, 0, piege());
  const entreesAcc = { operation: 'o' }; Object.defineProperty(entreesAcc, 'entrees', piege());
  const herite = Object.create({ operation: 'o', entrees: [{ entree: 'a', donnees: ['A'] }] });
  const heriteEntree = { operation: 'o', entrees: [Object.create({ entree: 'a', donnees: ['A'] })] };
  const sym = g('o', ['a', 'A']); sym[Symbol('s')] = 1; const symG = g('o', ['a', 'A']); symG.entrees[0][Symbol('s')] = 1;
  const etranger = { ...g('o', ['a', 'A']), score: 1 }; const etrangerE = g('o', ['a', 'A']); etrangerE.entrees[0].poids = 2;
  for (const m of [[groupeAcc], [entreeAcc], tabAcc, donneesAcc, [entreesAcc], [herite], [heriteEntree], [symG], [etranger], [etrangerE]]) {
    assert.throws(() => applicationUnique(m), TypeError);
  }
  assert.equal(lu_, 0, 'aucun accesseur exécuté');
  void sym;
});
test('C4. tableaux creux refusés (groupes, entrees, donnees)', () => {
  assert.throws(() => applicationUnique(new Array(1)), TypeError);
  const e = g('o', ['a', 'A']); e.entrees = new Array(1);
  assert.throws(() => applicationUnique([e]), TypeError);
  const d = g('o', ['a', 'A']); d.entrees[0].donnees = new Array(1);
  assert.throws(() => applicationUnique([d]), TypeError);
});
test('C5. un groupe invalide n\'est pas ignoré même si l\'espace est déjà « plusieurs »', () => {
  assert.throws(() => applicationUnique([g('O1', ['a', 'A', 'B']), { operation: '', entrees: [] }]), TypeError);
  assert.throws(() => applicationUnique([g('O1', ['a', 'A']), g('O2', ['x', 'X']), null]), TypeError);
});

// ============================================================================ D. PAS DE CHOIX, PAS DE PRODUIT, COMPLEXITÉ
test('D1. code : aucun choix (first/last/random/score/poids/récence), aucun produit cartésien, aucune horloge', () => {
  assert.equal(/Math\.random|Date\b|score|poids|frequence|fréquence|recent|récent|choisir|\.at\(|flatMap|\.reduce\(|\.concat\(|crypto/.test(CODE), false);
  assert.equal(/\[0\]/.test(CODE.replace(/e\.donnees\[0\]/g, '')), false, 'seul le candidat unique d\'une entrée à une donnée est lu par rang');
});
test('D2. plusieurs ⇒ application null dans TOUS les cas multiples (jamais une application partielle)', () => {
  const cas = [[g('o', ['a', 'A', 'B'])], [g('O1', ['a', 'A']), g('O2', ['x', 'X'])], [g('o', ['a', 'A', 'B'], ['b', 'C', 'D'])]];
  for (const c of cas) { const r = applicationUnique(c); assert.equal(r.etat, 'plusieurs'); assert.equal(r.application, null); assert.deepEqual(Object.keys(r), ['etat', 'application']); }
});
test('D3. aucun nombre exact exposé : la sortie ne contient que etat + application', () => {
  for (const c of [[], [g('o', ['a', 'A'])], [g('o', ['a', 'A', 'B'])]]) assert.deepEqual(Object.keys(applicationUnique(c)), ['etat', 'application']);
});
test('D4. pas de produit cartésien : 400 entrées à 2 candidats (2^400 applications) répondu instantanément', () => {
  const entrees = []; for (let i = 0; i < 400; i += 1) entrees.push([`e${String(i).padStart(3, '0')}`, 'A', 'B']);
  const t = Date.now();
  assert.equal(applicationUnique([g('o', ...entrees)]).etat, 'plusieurs');
  assert.ok(Date.now() - t < 2000);
});
test('D5. linéarité : 2000 groupes uniques → plusieurs ; 2000 entrées à 1 candidat → unique ; temps borné', () => {
  const t = Date.now();
  const groupes = []; for (let i = 0; i < 2000; i += 1) groupes.push(g(`op${i}`, ['a', 'A']));
  assert.equal(applicationUnique(groupes).etat, 'plusieurs');
  const entrees = []; for (let i = 0; i < 2000; i += 1) entrees.push([`e${i}`, 'A']);
  const r = applicationUnique([g('o', ...entrees)]);
  assert.equal(r.etat, 'unique'); assert.equal(r.application.liaisons.length, 2000);
  assert.ok(Date.now() - t < 3000);
});
test('D6. aucun état : appels répétés identiques', () => {
  const e = [g('o', ['a', 'A'])];
  assert.deepEqual(applicationUnique(e), applicationUnique(e));
  applicationUnique([g('o', ['a', 'A', 'B'])]);
  assert.equal(applicationUnique(e).etat, 'unique');
});

// ============================================================================ E. CHAÎNE AVEC LES PRIMITIVES RÉELLES
async function observation(lignesExec, message) {
  const magasin = magasinMemoireVive();
  for (const l of lignesExec) await magasin.ecrire('executionsOperations', l);
  const r = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
  return { r, magasin };
}
const exec = (id) => ({ id, horodatage: 'h', idDesignation: `d-${id}`, operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'M0' }], resultat: [1] }); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : liaisons réelles (au moins une), entrées(P) exposée pour toute production présente
test('E1. CHAÎNE RÉELLE message seul : observation → groupes → DEUX candidats (parcourirStructure.valeur←M et symbolesDeChaine.chaine←M) → plusieurs, application null ; aucune désignation écrite', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38 : symbolesDeChaine est décrite, le message seul n'a donc plus une seule application déterminée
  const { r, magasin } = await observation([], { id: 'M', texte: 'bonjour' });
  const groupes = groupesDeCandidats(r.observation.possibilites, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(groupes, [
    { operation: 'parcourirStructure', entrees: [{ entree: 'valeur', donnees: ['M'] }] },
    { operation: 'symbolesDeChaine', entrees: [{ entree: 'chaine', donnees: ['M'] }] },
  ]);
  assert.deepEqual(applicationUnique(groupes), { etat: 'plusieurs', application: null });
  assert.deepEqual(await magasin.lireTout('designations'), []);
  assert.deepEqual(await magasin.lireTout('executionsOperations'), []);
});
test('E2. PREMIÈRE CONCURRENCE : message N + production X → parcourirStructure.valeur=[N,X] (+ symbolesDeChaine.chaine=[N]) → plusieurs, application null', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38 : + groupe symbolesDeChaine
  const { r } = await observation([exec('X')], { id: 'N', texte: 'suite' });
  const groupes = groupesDeCandidats(r.observation.possibilites, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(groupes, [
    { operation: 'parcourirStructure', entrees: [{ entree: 'valeur', donnees: ['N', 'X', 'entrees-de-production:X'] }] }, // MISE À JOUR DÉLIBÉRÉE v0.63.59 : + entrées(X)
    { operation: 'projeterChemins', entrees: [{ entree: 'elements', donnees: ['X'] }] }, // MISE À JOUR DÉLIBÉRÉE v0.63.45 : + groupe projeterChemins (la forme de la production fictive X porte un `chemin` ; collision de forme acceptée, aucune sélection)
    { operation: 'symbolesDeChaine', entrees: [{ entree: 'chaine', donnees: ['N'] }] },
  ]);
  assert.deepEqual(applicationUnique(groupes), { etat: 'plusieurs', application: null });
});
test('E3. chaîne réelle : plusieurs productions → plusieurs ; permutation de l\'insertion → même état', async () => {
  const a = await observation([exec('X'), exec('Y'), exec('Z')], { id: 'N', texte: 't' });
  const b = await observation([exec('Z'), exec('X'), exec('Y')], { id: 'N', texte: 't' });
  const ra = applicationUnique(groupesDeCandidats(a.r.observation.possibilites, DESCRIPTIONS_OPERATIONS));
  const rb = applicationUnique(groupesDeCandidats(b.r.observation.possibilites, DESCRIPTIONS_OPERATIONS));
  assert.deepEqual(ra, { etat: 'plusieurs', application: null }); assert.deepEqual(rb, ra);
});
test('E4. l\'état unique ne persiste ni ne décide : rien écrit par la primitive (tables inchangées après l\'appel)', async () => {
  const { magasin } = await observation([], { id: 'M', texte: 'x' });
  const avant = JSON.stringify(await Promise.all(TABLES.map((t) => magasin.lireTout(t))));
  applicationUnique([g('parcourirStructure', ['valeur', 'M'])]);
  assert.equal(JSON.stringify(await Promise.all(TABLES.map((t) => magasin.lireTout(t)))), avant);
});

// ============================================================================ F. DORMANCE, VERSIONS
test('F1. aucun fichier de production n\'importe ni ne nomme application-unique / applicationUnique', () => {
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => rel(f) !== 'app/langage/application-unique.js' && /application-unique|applicationUnique/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel);
  assert.deepEqual(nommant, []);
});
test('F2. graphe d\'imports depuis main.js : application-unique et groupes-candidats inatteignables', () => {
  const vus = new Set();
  const visiter = (f) => {
    if (vus.has(f)) return; vus.add(f);
    let s; try { s = sansCommentaires(readFileSync(f, 'utf8')); } catch { return; }
    for (const m of s.matchAll(/(?:import|export)\b[^;]*?from\s+'(\.[^']+)'|import\(\s*'(\.[^']+)'\s*\)/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations|environnement-conversation|capacite|tick-propre|relation|besoins)\.js$/.test(c))) visiter(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + environnement-conversation.js (l'émission est un acte prospectif : ce module vivant atteint la chaîne .72/.74 comme execution-sollicitee.js ; exclu du parcours au même titre) // MISE À JOUR DÉLIBÉRÉE v0.63.84 : + capacite.js (B1 : module vivant du besoin primitif, atteint depuis main.js ; il importe la chaîne .72/.74 et executions-vecues comme environnement-conversation.js ; exclu du parcours au même titre, son atteinte est gardée par tests/capacite.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.86 : + tick-propre.js, relation.js (B2 : modules vivants atteints depuis main.js ; ils importent la chaîne .72/.74 et executions-vecues via prospection-soi.js, comme capacite.js ; exclus du parcours au même titre, gardés par tests/relation.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.87 (besoins déclarés) : + besoins dans l'exclusion des imports de main.js (module de LECTURE PURE, même statut que capacite/relation : il atteint le vécu projeté, jamais un mécanisme d'action)
  };
  visiter(join(RACINE, 'app', 'main.js'));
  const atteints = new Set([...vus].map(rel));
  for (const n of ['application-unique', 'groupes-candidats']) assert.equal(atteints.has(`app/langage/${n}.js`), false, n);
});
test('F3. aucune écriture, aucun magasin, aucune désignation/exécution dans le module', () => {
  assert.equal(/magasin|ecrire|lireTout|enregistrer|invoquer|executer|localStorage|indexedDB|fetch\(|await|async/.test(CODE), false);
});
test('F4. versions inchangées : VERSION_BASE 18, SCHEMA 8, 21 tables', () => {
  assert.equal(VERSION_BASE, 24); assert.equal(SCHEMA_SAUVEGARDE, 14); assert.equal(TABLES.length, 30); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables)
});
// === FIN_TEST_APPLICATION_UNIQUE ===
