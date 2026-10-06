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
  const X = await exec(magasinMemoireVive(), entree());
  const P = productionsDecrites([X], DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 1);
  assert.deepEqual(Object.keys(P[0]).sort(), ['forme', 'identite']);
  assert.equal(P[0].identite, X.id);
  assert.deepEqual(P[0].forme, sortieDecrite('parcourirStructure'));
});
test('A2. aucune nouvelle identité ; deux exécutions de la même opération : deux productions distinctes, même forme', async () => {
  const m = magasinMemoireVive();
  const X = await exec(m, entree());
  const Y = await exec(m, entree());
  const P = productionsDecrites([Y, X], DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 2);
  assert.deepEqual(P.map((p) => p.identite).sort(), [X.id, Y.id].sort());
  assert.notEqual(P[0].identite, P[1].identite);
  assert.deepEqual(P[0].forme, P[1].forme);
  assert.notEqual(P[0].forme, P[1].forme, 'copies neuves, jamais partagées');
});
test('A3. deux exécutions de même id : toujours refusées', async () => {
  const X = await exec(magasinMemoireVive(), entree());
  assert.throws(() => productionsDecrites([X, { ...X }], DESCRIPTIONS_OPERATIONS), (e) => e instanceof TypeError && /même identité/.test(e.message));
});
test('A4. opération inconnue : exécution valide, aucune production, aucune erreur supplémentaire', async () => {
  const m = magasinMemoireVive();
  const X = await exec(m, entree('operationInconnue'));
  const Y = await exec(m, entree());
  const P = productionsDecrites([X, Y], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(P.map((p) => p.identite), [Y.id]);
  assert.deepEqual(productionsDecrites([X], DESCRIPTIONS_OPERATIONS), []);
});
test('A5. correspondance par égalité stricte uniquement : aucune table d\'opérations, aucune inférence', async () => {
  const X = await exec(magasinMemoireVive(), entree('ParcourirStructure'));
  assert.deepEqual(productionsDecrites([X], DESCRIPTIONS_OPERATIONS), []);
  const papier = { nom: 'inventee', entrees: {}, sortie: { forme: 'scalaire', genre: 'chaine' } };
  const Z = await exec(magasinMemoireVive(), entree('inventee'));
  assert.deepEqual(productionsDecrites([Z], [papier])[0].forme, { forme: 'scalaire', genre: 'chaine' }, 'une description seule suffit, même sans implémentation');
});

// ---------------------------------------------------------------- B. CHAMPS JAMAIS LUS
test('B1. resultat, liaisons et horodatage ne sont JAMAIS lus : getters piégés (qui lèvent) sur la ligne', async () => {
  const X = await exec(magasinMemoireVive(), entree());
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
    const X = await exec(m, entree('parcourirStructure', resultat));
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
  assert.equal((CODE.match(/lireChampPropre\(execution, '/g) || []).length, 3); // MISE À JOUR DÉLIBÉRÉE v0.63.46 : 2 -> 3 (lecture de la clé optionnelle `sousDonnees`, propriété propre de donnée ; `resultat` toujours jamais lu)
  assert.match(CODE, /lireChampPropre\(execution, 'operation', rang\)/);
  assert.match(CODE, /parNom\.get\(operation\)/);
  assert.equal(/function productionsDecrites\(executions, descriptions\)/.test(CODE), true, 'aucun paramètre supplémentaire (pas de nom de champ)');
});

// ---------------------------------------------------------------- D. CHAÎNE COMPLÈTE
test('D1. chaîne immédiate : X → productionsDecrites → valeurDePorteur(X, P[0], ACCES_TRACE) → X.resultat', async () => {
  const X = await exec(magasinMemoireVive(), entree());
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
  const X = await exec(m, entree());
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
  const X = await exec(m, entree('parcourirStructure', R));
  const Y = await exec(m, entree('parcourirStructure', [{ chemin: [], type: 'nombre', valeur: 1 }]));
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
  const X = await exec(m, entree());
  const Y = await exec(m, entree());
  const P = productionsDecrites([X], DESCRIPTIONS_OPERATIONS);
  assert.throws(() => valeurDePorteur(Y, P[0], ACCES_TRACE), TypeError);
});

// ---------------------------------------------------------------- E. BOUCLE VERS LES POSSIBILITÉS
test('E1. P est directement une donnée de possibilitesDeLiaison : atomes {donnee: X.id, operation, entree} exacts, rien n\'est exécuté ni choisi', async () => {
  const X = await exec(magasinMemoireVive(), entree());
  const P = productionsDecrites([X], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(atomes(P), [
    `${X.id}|couvrirSequence.elements`,
    `${X.id}|parcourirStructure.valeur`,
    `${X.id}|projeterChemins.elements`, // MISE À JOUR DÉLIBÉRÉE v0.63.45 : la production fictive X porte un `chemin` : elle devient candidate de projeterChemins.elements (collision de forme acceptée)
    `${X.id}|resoudreCouverture.univers`,
  ]);
});
test('E2. une production de forme couverture (normaliserCouverture) devient candidate à ses opérations compatibles ; production inconnue : aucune', async () => {
  const m = magasinMemoireVive();
  const X = await exec(m, entree('normaliserCouverture', ['a']));
  const U = await exec(m, entree('operationInconnue'));
  const r = atomes(productionsDecrites([X, U], DESCRIPTIONS_OPERATIONS));
  assert.equal(r.length, 10); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 9 → 10 (+ resoudreElements.couverture : collection de collections de scalaire, collision de forme acceptée) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 8 → 9 (+ rechercherSousSuites)
  for (const a of r) assert.equal(a.startsWith(`${X.id}|`), true);
  assert.equal(r.some((a) => a.includes(U.id)), false);
});
test('E3. la boucle ne lit ni resultat ni liaisons : mêmes atomes pour deux résultats différents', async () => {
  const m = magasinMemoireVive();
  const X = await exec(m, entree('parcourirStructure', null));
  const Y = await exec(m, entree('parcourirStructure', { autre: 1 }));
  const a = atomes(productionsDecrites([X], DESCRIPTIONS_OPERATIONS)).map((s) => s.split('|')[1]);
  const b = atomes(productionsDecrites([Y], DESCRIPTIONS_OPERATIONS)).map((s) => s.split('|')[1]);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------- F. INVARIANTS ET DORMANCE
test('F1. descriptions, table d\'opérations, ACCES_TRACE et persistance inchangés', () => {
  assert.deepEqual(ACCES_TRACE, { champ: 'resultat' });
  assert.deepEqual(DESCRIPTIONS_OPERATIONS.map((d) => d.nom), ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'elementsObservables', 'memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'produireSuitesFermees', 'projeterChemins', 'projeterContenus', 'rechercherSousSuites', 'resoudreCouverture', 'resoudreElements', 'symbolesDeChaine']); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements (après resoudreCouverture) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : + symbolesDeChaine (10 descriptions) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : + projeterContenus // MISE À JOUR DÉLIBÉRÉE v0.63.44 : + rechercherSousSuites
  assert.equal(VERSION_BASE, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(SCHEMA_SAUVEGARDE, 9); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(TABLES.length, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(/table-operations|invocation-operations|acces-valeur|acces-trace|connaissances/.test(CODE), false, 'le module n\'importe que le langage de formes');
  assert.equal((CODE.match(/^import\b/gm) || []).length, 2); // MISE À JOUR DÉLIBÉRÉE v0.63.46 : 1 -> 2 (+ sous-donnees.js, module pur sans import)
});
test('F2. graphe d\'imports depuis app/main.js (v0.63.24 : productions-decrites et acces-trace y sont désormais ATTEINTS, voulu : univers élargi observé) ; acces-valeur, invocation-operations, table-operations, groupes-candidats restent inatteignables', () => {
  const vus = new Set();
  const pile = [resolve(RACINE, 'app/main.js')];
  while (pile.length > 0) {
    const f = pile.pop();
    if (vus.has(f) || !existsSync(f)) continue;
    vus.add(f);
    const src = lu(...f.slice(RACINE.length + 1).split('/'));
    for (const m of src.matchAll(/(?:import|export)[^'"`;]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|^import\s*['"](\.[^'"]+)['"]/gm)) { const c = resolve(dirname(f), m[1] || m[2] || m[3]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|table-operations)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs)
  }
  assert.ok(vus.size > 50, 'le graphe est réellement parcouru');
  for (const n of ['acces-valeur', 'invocation-operations', 'table-operations', 'groupes-candidats']) {
    assert.equal([...vus].some((f) => f.endsWith(`/${n}.js`)), false, n);
  }
  for (const n of ['productions-decrites', 'acces-trace']) assert.equal([...vus].some((f) => f.endsWith(`/${n}.js`)), true, `v0.63.24 : ${n} est atteint par l'observation`);
  assert.equal([...vus].some((f) => f.endsWith('/connaissances.js')), true, 'sanity : le graphe atteint bien connaissances.js');
});
test('F3. aucun fichier de production ne mentionne enregistrerExecutionOperation hors connaissances.js (aucun appel dans le tour)', () => {
  for (const n of ['main.js', 'langage/pont.js', 'langage/ecran.js', 'langage/observation-possibilites.js', 'langage/action.js', 'langage/composition.js', 'langage/esprit.js']) {
    const f = join(RACINE, 'app', n);
    if (!existsSync(f)) continue;
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    assert.equal(/enregistrerExecutionOperation/.test(code), false, n);
    // MISE À JOUR DÉLIBÉRÉE v0.63.24 : seule l'observation LIT les productions décrites ; aucun autre module du tour ne les nomme
    if (n !== 'langage/observation-possibilites.js') assert.equal(/productionsDecrites|productions-decrites/.test(code), false, n);
  }
});
// === FIN_TEST_EXECUTION_PRODUCTION ===
