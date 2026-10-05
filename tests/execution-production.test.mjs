// === DEBUT_TEST_EXECUTION_PRODUCTION ===
// v0.63.20 — décision ChatGPT « UNE EXÉCUTION DEVIENT UNE PRODUCTION DÉCRITE » (05/10/2026). Preuves que la chaîne dormante
//   exécution persistée X → production P = { identite: X.id, forme: description.sortie } → valeurDePorteur(X, P, ACCES_TRACE) → X.resultat
// est fermée, immédiatement ET après relecture, que P est directement une donnée de possibilitesDeLiaison, que `capacite` a disparu
// du contrat de productionsDecrites, que resultat/liaisons/horodatage ne sont jamais lus, et que rien n'est branché dans le tour.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { enregistrerExecutionOperation, enregistrerTrace, magasinMemoireVive, VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { validerDescripteurOperation } from '../app/langage/formes-operation.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { ACCES_TRACE } from '../app/langage/acces-trace.js';

const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const MODULE = lu('app', 'langage', 'productions-decrites.js');
const CODE = sansCommentaires(MODULE);
const R = [{ chemin: [], type: 'chaine', valeur: 'Bonjour' }];
const entree = (operation = 'parcourirStructure', resultat = R) => ({ operation, liaisons: [{ entree: 'valeur', donnee: 'message-1' }], resultat });
const sortieDecrite = (nom) => validerDescripteurOperation(DESCRIPTIONS_OPERATIONS.find((d) => d.nom === nom)).sortie;
const atomes = (P) => possibilitesDeLiaison(P, DESCRIPTIONS_OPERATIONS).map((a) => `${a.donnee}|${a.operation}.${a.entree}`);

// ---------------------------------------------------------------- A. CONTRAT ET IDENTITÉ
test('A1. une VRAIE ligne v0.63.19 est directement acceptée : une production {identite: X.id, forme: sortie décrite}', async () => {
  const X = await enregistrerExecutionOperation(magasinMemoireVive(), entree());
  const P = productionsDecrites([X], DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 1);
  assert.deepEqual(Object.keys(P[0]).sort(), ['forme', 'identite']);
  assert.equal(P[0].identite, X.id);
  assert.deepEqual(P[0].forme, sortieDecrite('parcourirStructure'));
});
test('A2. aucune nouvelle identité ; deux exécutions de la même opération : deux productions distinctes, même forme', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, entree());
  const Y = await enregistrerExecutionOperation(m, entree());
  const P = productionsDecrites([Y, X], DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 2);
  assert.deepEqual(P.map((p) => p.identite).sort(), [X.id, Y.id].sort());
  assert.notEqual(P[0].identite, P[1].identite);
  assert.deepEqual(P[0].forme, P[1].forme);
  assert.notEqual(P[0].forme, P[1].forme, 'copies neuves, jamais partagées');
});
test('A3. deux exécutions de même id : toujours refusées', async () => {
  const X = await enregistrerExecutionOperation(magasinMemoireVive(), entree());
  assert.throws(() => productionsDecrites([X, { ...X }], DESCRIPTIONS_OPERATIONS), (e) => e instanceof TypeError && /même identité/.test(e.message));
});
test('A4. opération inconnue : exécution valide, aucune production, aucune erreur supplémentaire', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, entree('operationInconnue'));
  const Y = await enregistrerExecutionOperation(m, entree());
  const P = productionsDecrites([X, Y], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(P.map((p) => p.identite), [Y.id]);
  assert.deepEqual(productionsDecrites([X], DESCRIPTIONS_OPERATIONS), []);
});
test('A5. correspondance par égalité stricte uniquement : aucune table d\'opérations, aucune inférence', async () => {
  const X = await enregistrerExecutionOperation(magasinMemoireVive(), entree('ParcourirStructure'));
  assert.deepEqual(productionsDecrites([X], DESCRIPTIONS_OPERATIONS), []);
  const papier = { nom: 'inventee', entrees: {}, sortie: { forme: 'scalaire', genre: 'chaine' } };
  const Z = await enregistrerExecutionOperation(magasinMemoireVive(), entree('inventee'));
  assert.deepEqual(productionsDecrites([Z], [papier])[0].forme, { forme: 'scalaire', genre: 'chaine' }, 'une description seule suffit, même sans implémentation');
});

// ---------------------------------------------------------------- B. CHAMPS JAMAIS LUS
test('B1. resultat, liaisons et horodatage ne sont JAMAIS lus : getters piégés (qui lèvent) sur la ligne', async () => {
  const X = await enregistrerExecutionOperation(magasinMemoireVive(), entree());
  const piege = () => { throw new Error('lu !'); };
  const piegee = { id: X.id, operation: X.operation };
  for (const champ of ['resultat', 'liaisons', 'horodatage']) Object.defineProperty(piegee, champ, { get: piege, enumerable: true });
  const P = productionsDecrites([piegee], DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 1);
  assert.equal(P[0].identite, X.id);
  const proxy = new Proxy({ id: 'Q', operation: 'parcourirStructure' }, { get(c, k) { if (k !== 'id' && k !== 'operation') throw new Error('lu ' + String(k)); return c[k]; } });
  assert.equal(productionsDecrites([{ id: 'P', operation: 'parcourirStructure', resultat: proxy }], DESCRIPTIONS_OPERATIONS).length, 1);
});
test('B2. la forme est indépendante du résultat : résultats variés (null, incompatible, absent) → même forme', async () => {
  const m = magasinMemoireVive();
  const formes = [];
  for (const resultat of [null, 'texte', 42, { n: 1 }, []]) {
    const X = await enregistrerExecutionOperation(m, entree('parcourirStructure', resultat));
    formes.push(productionsDecrites([X], DESCRIPTIONS_OPERATIONS)[0].forme);
  }
  for (const f of formes) assert.deepEqual(f, sortieDecrite('parcourirStructure'));
});
test('B3. accesseur sur id ou operation : refusé sans exécution', () => {
  const piege = () => { throw new Error('exécuté'); };
  assert.throws(() => productionsDecrites([{ id: 'T', get operation() { return piege(); } }], DESCRIPTIONS_OPERATIONS), (e) => e instanceof TypeError && /accesseur/.test(e.message));
  assert.throws(() => productionsDecrites([{ get id() { return piege(); }, operation: 'x' }], DESCRIPTIONS_OPERATIONS), (e) => e instanceof TypeError && /accesseur/.test(e.message));
  assert.throws(() => productionsDecrites([Object.assign(Object.create({ operation: 'x' }), { id: 'T' })], DESCRIPTIONS_OPERATIONS), (e) => e instanceof TypeError && /champ « operation » propre/.test(e.message));
});

// ---------------------------------------------------------------- C. ANCIENNES TRACES
test('C1. une ancienne trace {id, capacite, …} sans operation : refus clair, jamais interprétée', async () => {
  const lignes = [];
  const t = await enregistrerTrace({ ecrire: async (table, o) => { lignes.push(o); } }, { capacite: 'parcourirStructure', voie: 'composition', argumentsUtilises: {}, provenanceArguments: {}, resultat: null });
  assert.equal(t.capacite, 'parcourirStructure');
  assert.throws(() => productionsDecrites(lignes, DESCRIPTIONS_OPERATIONS), (e) => e instanceof TypeError && /champ « operation » propre/.test(e.message));
  assert.throws(() => productionsDecrites([{ id: 'T', capacite: 'parcourirStructure' }], DESCRIPTIONS_OPERATIONS), TypeError);
});
test('C2. une structure portant les deux champs : operation utilisée, capacite ignorée sans lecture', () => {
  const piege = () => { throw new Error('capacite lue'); };
  const o = { id: 'T', operation: 'parcourirStructure' };
  Object.defineProperty(o, 'capacite', { get: piege, enumerable: true });
  const P = productionsDecrites([o], DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 1);
  assert.deepEqual(productionsDecrites([{ id: 'T', operation: 'x', capacite: 'parcourirStructure' }], DESCRIPTIONS_OPERATIONS), [], 'capacite ne vaut pas operation');
});
test('C3. `capacite` a disparu du contrat du module : ni lecture, ni validation, ni message, ni commentaire', () => {
  assert.equal(/capacit/i.test(MODULE), false);
  assert.equal(/operation\s*(\|\||\?\?)|(\|\||\?\?)\s*operation/.test(CODE), false, 'aucun repli');
  assert.equal((CODE.match(/lireChampPropre\(execution, '/g) || []).length, 2);
  assert.match(CODE, /lireChampPropre\(execution, 'operation', rang\)/);
  assert.match(CODE, /parNom\.get\(operation\)/);
  assert.equal(/function productionsDecrites\(executions, descriptions\)/.test(CODE), true, 'aucun paramètre supplémentaire (pas de nom de champ)');
});

// ---------------------------------------------------------------- D. CHAÎNE COMPLÈTE
test('D1. chaîne immédiate : X → productionsDecrites → valeurDePorteur(X, P[0], ACCES_TRACE) → X.resultat', async () => {
  const X = await enregistrerExecutionOperation(magasinMemoireVive(), entree());
  const P = productionsDecrites([X], DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 1);
  assert.equal(P[0].identite, X.id);
  assert.deepEqual(P[0].forme, sortieDecrite('parcourirStructure'));
  const valeur = valeurDePorteur(X, P[0], ACCES_TRACE);
  assert.deepEqual(valeur, X.resultat);
  assert.deepEqual(valeur, R);
});
test('D2. chaîne après relecture depuis executionsOperations (frontière de persistance)', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, entree());
  const relues = await m.lireTout('executionsOperations');
  assert.equal(relues.length, 1);
  const Xr = relues[0];
  assert.deepEqual(Xr, X);
  const P = productionsDecrites([Xr], DESCRIPTIONS_OPERATIONS);
  assert.equal(P[0].identite, X.id);
  assert.deepEqual(P[0].forme, sortieDecrite('parcourirStructure'));
  assert.deepEqual(valeurDePorteur(Xr, P[0], ACCES_TRACE), R);
});
test('D3. chaîne après aller-retour JSON complet (comme la sauvegarde) et avec plusieurs lignes : le porteur se retrouve par P.identite dans le tableau fourni', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, entree('parcourirStructure', R));
  const Y = await enregistrerExecutionOperation(m, entree('parcourirStructure', [{ chemin: [], type: 'nombre', valeur: 1 }]));
  const lignes = JSON.parse(JSON.stringify(await m.lireTout('executionsOperations')));
  const P = productionsDecrites(lignes, DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 2);
  for (const p of P) {
    const porteur = lignes.find((l) => l.id === p.identite);
    assert.deepEqual(valeurDePorteur(porteur, p, ACCES_TRACE), porteur.resultat);
  }
  assert.deepEqual(valeurDePorteur(lignes.find((l) => l.id === X.id), P.find((p) => p.identite === X.id), ACCES_TRACE), R);
  assert.notDeepEqual(X.resultat, Y.resultat);
});
test('D4. une identité qui n\'est pas celle du porteur est refusée avant lecture', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, entree());
  const Y = await enregistrerExecutionOperation(m, entree());
  const P = productionsDecrites([X], DESCRIPTIONS_OPERATIONS);
  assert.throws(() => valeurDePorteur(Y, P[0], ACCES_TRACE), TypeError);
});

// ---------------------------------------------------------------- E. BOUCLE VERS LES POSSIBILITÉS
test('E1. P est directement une donnée de possibilitesDeLiaison : atomes {donnee: X.id, operation, entree} exacts, rien n\'est exécuté ni choisi', async () => {
  const X = await enregistrerExecutionOperation(magasinMemoireVive(), entree());
  const P = productionsDecrites([X], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(atomes(P), [
    `${X.id}|couvrirSequence.elements`,
    `${X.id}|parcourirStructure.valeur`,
    `${X.id}|resoudreCouverture.univers`,
  ]);
});
test('E2. une production de forme couverture (normaliserCouverture) devient candidate à ses opérations compatibles ; production inconnue : aucune', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, entree('normaliserCouverture', ['a']));
  const U = await enregistrerExecutionOperation(m, entree('operationInconnue'));
  const r = atomes(productionsDecrites([X, U], DESCRIPTIONS_OPERATIONS));
  assert.equal(r.length, 8);
  for (const a of r) assert.equal(a.startsWith(`${X.id}|`), true);
  assert.equal(r.some((a) => a.includes(U.id)), false);
});
test('E3. la boucle ne lit ni resultat ni liaisons : mêmes atomes pour deux résultats différents', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, entree('parcourirStructure', null));
  const Y = await enregistrerExecutionOperation(m, entree('parcourirStructure', { autre: 1 }));
  const a = atomes(productionsDecrites([X], DESCRIPTIONS_OPERATIONS)).map((s) => s.split('|')[1]);
  const b = atomes(productionsDecrites([Y], DESCRIPTIONS_OPERATIONS)).map((s) => s.split('|')[1]);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------- F. INVARIANTS ET DORMANCE
test('F1. descriptions, table d\'opérations, ACCES_TRACE et persistance inchangés', () => {
  assert.deepEqual(ACCES_TRACE, { champ: 'resultat' });
  assert.deepEqual(DESCRIPTIONS_OPERATIONS.map((d) => d.nom), ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'resoudreCouverture']);
  assert.equal(VERSION_BASE, 17);
  assert.equal(SCHEMA_SAUVEGARDE, 7);
  assert.equal(TABLES.length, 21);
  assert.equal(/table-operations|invocation-operations|acces-valeur|acces-trace|connaissances/.test(CODE), false, 'le module n\'importe que le langage de formes');
  assert.equal((CODE.match(/^import\b/gm) || []).length, 1);
});
test('F2. dormance par graphe d\'imports depuis app/main.js : productions-decrites, acces-valeur, acces-trace, invocation-operations, table-operations inatteignables', () => {
  const vus = new Set();
  const pile = [resolve(RACINE, 'app/main.js')];
  while (pile.length > 0) {
    const f = pile.pop();
    if (vus.has(f) || !existsSync(f)) continue;
    vus.add(f);
    const src = lu(...f.slice(RACINE.length + 1).split('/'));
    for (const m of src.matchAll(/(?:import|export)[^'"`;]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|^import\s*['"](\.[^'"]+)['"]/gm)) pile.push(resolve(dirname(f), m[1] || m[2] || m[3]));
  }
  assert.ok(vus.size > 50, 'le graphe est réellement parcouru');
  for (const n of ['productions-decrites', 'acces-valeur', 'acces-trace', 'invocation-operations', 'table-operations']) {
    assert.equal([...vus].some((f) => f.endsWith(`/${n}.js`)), false, n);
  }
  assert.equal([...vus].some((f) => f.endsWith('/connaissances.js')), true, 'sanity : le graphe atteint bien connaissances.js');
});
test('F3. aucun fichier de production ne mentionne enregistrerExecutionOperation hors connaissances.js (aucun appel dans le tour)', () => {
  for (const n of ['main.js', 'langage/pont.js', 'langage/ecran.js', 'langage/observation-possibilites.js', 'langage/action.js', 'langage/composition.js', 'langage/esprit.js']) {
    const f = join(RACINE, 'app', n);
    if (existsSync(f)) assert.equal(/enregistrerExecutionOperation|productionsDecrites|productions-decrites/.test(sansCommentaires(readFileSync(f, 'utf8'))), false, n);
  }
});
// === FIN_TEST_EXECUTION_PRODUCTION ===
