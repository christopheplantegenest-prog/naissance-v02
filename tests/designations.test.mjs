// === DEBUT_TEST_DESIGNATIONS ===
// v0.63.22 — décision ChatGPT « FAIT PERSISTANT DE DÉSIGNATION — DORMANT — AUCUNE POLITIQUE DE CHOIX » (05/10/2026).
// Preuves que la table designations (clé id) et enregistrerDesignation (connaissances.js) conservent le seul fait
// « dans cette observation, cette application DÉJÀ désignée devait être tentée » : { id, horodatage, idObservation, operation,
// liaisons }, rien d'autre ; appartenance exacte aux possibilités fournies ; liaisons canoniques en copie ; tout ou rien ; aucune
// politique de choix ; executionsOperations inchangée ; migration 16 → 17 / sauvegarde 6 → 7 ; dormance absolue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import {
  enregistrerDesignation as enregistrerDesignationBrut, ORIGINES_DESIGNATION, enregistrerExecutionOperation, magasinMemoireVive, ouvrirIndexedDB, TABLES, CLE, VERSION_BASE, NOM_BASE,
} from '../app/langage/connaissances.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees } from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';
import { invoquerOperation } from '../app/langage/invocation-operations.js';

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


// v0.63.33 : l'origine est OBLIGATOIRE et sans défaut dans la primitive. Aide de TEST seulement : les tests antérieurs à v0.63.33 ne portent pas
// sur la provenance ; ils passent par cette enveloppe qui ajoute explicitement origine:'exterieure' (en copiant les DESCRIPTEURS : aucun
// accesseur exécuté) sauf si l'entrée porte déjà une clé `origine`. Les tests de provenance (section P) appellent la primitive brute.
function enregistrerDesignation(m, e) {
  if (e === null || typeof e !== 'object' || Array.isArray(e) || Reflect.ownKeys(e).includes('origine')) return enregistrerDesignationBrut(m, e);
  return enregistrerDesignationBrut(m, Object.create(Object.getPrototypeOf(e), { ...Object.getOwnPropertyDescriptors(e), origine: { value: 'exterieure', enumerable: true, writable: true, configurable: true } }));
}

const T = 'designations';
const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CONN = lu('app', 'langage', 'connaissances.js');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const refuse = (p, motif) => assert.rejects(p, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const piegeSur = (objet, champ) => { Object.defineProperty(objet, champ, { enumerable: true, get() { throw new Error(`accesseur ${String(champ)} exécuté`); } }); return objet; };
const at = (donnee, operation, entree) => ({ donnee, operation, entree });
function espion(echec = null) {
  const ecrits = [];
  return { ecrits, async ecrire(table, objet) { if (echec) throw echec; ecrits.push([table, objet]); }, async lireTout() { return []; } };
}
const POSS = () => [
  at('A', 'memesCouvertures', 'a'), at('B', 'memesCouvertures', 'b'), at('C', 'parcourirStructure', 'valeur'),
  at('X', 'parcourirStructure', 'valeur'), at('message-1', 'parcourirStructure', 'valeur'), at('execution-operation-1', 'parcourirStructure', 'valeur'),
];
const OBS = (extra = {}) => ({ id: 'observation-possibilites-1', idMessage: 'message-1', horodatage: '2026-10-05T08:00:00.000Z', donneesExaminees: ['A'], operationsExaminees: ['x'], possibilites: POSS(), ...extra });
const APP = (extra = {}) => ({ operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'X' }], ...extra });

// ============================================================================ A. RÉUSSITE ET SCHÉMA EXACT
test('A1. TEST CENTRAL — réussite : application choisie MANUELLEMENT par le test, ligne exacte, clés closes', async () => {
  const m = magasinMemoireVive();
  const obs = OBS();
  const x = await enregistrerDesignation(m, { observation: obs, application: APP() });
  assert.deepEqual(Object.keys(x).sort(), ['horodatage', 'id', 'idObservation', 'liaisons', 'operation', 'origine']); // MISE À JOUR DÉLIBÉRÉE v0.63.33 : + origine
  assert.equal(x.origine, 'exterieure');
  assert.match(x.id, /^designation-application-\d+-\d+-\d+$/);
  assert.equal(Number.isNaN(Date.parse(x.horodatage)), false);
  assert.equal(x.idObservation, obs.id);
  assert.equal(x.operation, 'parcourirStructure');
  assert.deepEqual(x.liaisons, [{ entree: 'valeur', donnee: 'X' }]);
  for (const interdit of ['possibilites', 'groupes', 'candidatsNonChoisis', 'succes', 'echec', 'erreur', 'statut', 'resultat', 'score', 'raison', 'idMessage', 'idExecution']) assert.equal(interdit in x, false, interdit);
  assert.deepEqual(await m.lireTout(T), [x]);
});
test('A2. la désignation reste indépendante : exécution écrite ensuite, DANS LE TEST seulement, ne modifie pas la ligne (provenance à sens unique)', async () => {
  const m = magasinMemoireVive();
  const x = await enregistrerDesignation(m, { observation: OBS(), application: APP() });
  const avant = JSON.stringify(await m.lireTout(T));
  const e = await enregistrerExecutionOperation(m, { designation: x, operation: x.operation, liaisons: x.liaisons, resultat: [{ chemin: [], type: 'chaine', valeur: 'X' }] });
  assert.equal(JSON.stringify(await m.lireTout(T)), avant);
  assert.equal(e.idDesignation, x.id);
  assert.equal(Object.keys(e).sort().join(), 'horodatage,id,idDesignation,liaisons,operation,resultat');
  assert.equal('idExecution' in x, false);
  assert.notEqual(x.id, e.id);
});
test('A3. échec APRÈS désignation : tentative ultérieure qui lève, aucune executionOperation, ligne présente et inchangée, aucune cause', async () => {
  const m = magasinMemoireVive();
  const x = await enregistrerDesignation(m, { observation: OBS(), application: APP() });
  const copie = JSON.parse(JSON.stringify(x));
  let leve = false;
  try { await invoquerOperation(null, null); } catch { leve = true; }
  try { throw new Error('tentative ultérieure'); } catch { leve = true; }
  assert.equal(leve, true);
  assert.deepEqual(await m.lireTout('executionsOperations'), []);
  assert.deepEqual(await m.lireTout(T), [copie]);
  assert.equal(JSON.stringify(Object.keys(x).sort()), JSON.stringify(['horodatage', 'id', 'idObservation', 'liaisons', 'operation', 'origine'])); // MISE À JOUR DÉLIBÉRÉE v0.63.33 : + origine
  assert.equal(/Error|tentative/.test(JSON.stringify(await m.lireTout(T))), false);
});
test('A4. deux désignations de la même application : deux lignes, deux identités, aucune fusion', async () => {
  const m = magasinMemoireVive();
  const a = await enregistrerDesignation(m, { observation: OBS(), application: APP() });
  const b = await enregistrerDesignation(m, { observation: OBS(), application: APP() });
  assert.notEqual(a.id, b.id);
  assert.equal((await m.lireTout(T)).length, 2);
});
test('A5. l\'id n\'est ni message.id, ni observation.id, ni identité d\'exécution', async () => {
  const x = await enregistrerDesignation(magasinMemoireVive(), { observation: OBS(), application: APP() });
  assert.equal(/^(message|observation-possibilites|execution-operation)-/.test(x.id), false);
});

// ============================================================================ B. APPARTENANCE
test('B1. appartenance : memesCouvertures a←A, b←B acceptée ; a←B, b←A refusée', async () => {
  const m = magasinMemoireVive();
  const ok = await enregistrerDesignation(m, { observation: OBS(), application: { operation: 'memesCouvertures', liaisons: [{ entree: 'b', donnee: 'B' }, { entree: 'a', donnee: 'A' }] } });
  assert.deepEqual(ok.liaisons, [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'B' }]);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: { operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'B' }, { entree: 'b', donnee: 'A' }] } }), /n'est pas une possibilité/);
  assert.equal((await m.lireTout(T)).length, 1);
});
test('B2. une opération différente utilisant une paire donnee/entree existante est refusée', async () => {
  const m = magasinMemoireVive();
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: { operation: 'parcourirStructure', liaisons: [{ entree: 'a', donnee: 'A' }] } }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: { operation: 'memesCouvertures', liaisons: [{ entree: 'valeur', donnee: 'C' }] } }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: { operation: 'inconnue', liaisons: [{ entree: 'valeur', donnee: 'C' }] } }));
  assert.deepEqual(await m.lireTout(T), []);
});
test('B3. donnée étrangère, entrée étrangère : refusées ; liaison valide + liaison étrangère : tout refusé', async () => {
  const m = magasinMemoireVive();
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 'Z' }] }) }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: 'autre', donnee: 'X' }] }) }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: { operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'Z' }] } }));
  assert.deepEqual(await m.lireTout(T), []);
});
test('B4. la même donnée sur plusieurs entrées est valide (A sur a et b)', async () => {
  const poss = [at('A', 'memesCouvertures', 'a'), at('A', 'memesCouvertures', 'b')];
  const x = await enregistrerDesignation(magasinMemoireVive(), { observation: OBS({ possibilites: poss }), application: { operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'A' }] } });
  assert.deepEqual(x.liaisons, [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'A' }]);
});
test('B5. une entrée ne peut apparaître qu\'une fois (même avec deux données possibles)', async () => {
  const m = magasinMemoireVive();
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 'X' }, { entree: 'valeur', donnee: 'C' }] }) }), /dupliquée/);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 'X' }, { entree: 'valeur', donnee: 'X' }] }) }), /dupliquée/);
  assert.deepEqual(await m.lireTout(T), []);
});
test('B6. une application partielle d\'une opération à deux entrées est ACCEPTÉE (complétude hors périmètre, aucun statut « partiel »)', async () => {
  const x = await enregistrerDesignation(magasinMemoireVive(), { observation: OBS(), application: { operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'A' }] } });
  assert.deepEqual(Object.keys(x).sort(), ['horodatage', 'id', 'idObservation', 'liaisons', 'operation', 'origine']); // MISE À JOUR DÉLIBÉRÉE v0.63.33 : + origine
});

// ============================================================================ C. VALIDATION
test('C1. au moins une liaison, tableau dense, chaînes non vides sans trim', async () => {
  const m = magasinMemoireVive();
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [] }) }), /au moins une liaison/);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: 'valeur' }) }));
  const creux = [{ entree: 'valeur', donnee: 'X' }]; creux.length = 2;
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: creux }) }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ operation: '' }) }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: '', donnee: 'X' }] }) }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: '' }] }) }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 'X ' }] }) }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 3 }] }) }));
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [null] }) }));
  assert.deepEqual(await m.lireTout(T), []);
});
test('C2. clés closes : application, liaison, entrée, atome — toute clé étrangère refusée', async () => {
  const m = magasinMemoireVive();
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ score: 1 }) }), /étranger/);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 'X', forme: 'f' }] }) }), /étranger/);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP(), raison: 'x' }), /étranger/);
  await refuse(enregistrerDesignation(m, { observation: OBS({ possibilites: [{ ...at('X', 'parcourirStructure', 'valeur'), extra: 1 }] }), application: APP() }), /étranger/);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ [Symbol('s')]: 1 }) }), /étranger/);
  assert.deepEqual(await m.lireTout(T), []);
});
test('C3. observation : id chaîne non vide, possibilites tableau dense d\'atomes exacts non vides', async () => {
  const m = magasinMemoireVive();
  await refuse(enregistrerDesignation(m, { observation: OBS({ id: '' }), application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: OBS({ id: 7 }), application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: { possibilites: POSS() }, application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: { id: 'o' }, application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: OBS({ possibilites: 'x' }), application: APP() }));
  const creux = POSS(); creux.length += 1;
  await refuse(enregistrerDesignation(m, { observation: OBS({ possibilites: creux }), application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: OBS({ possibilites: [at('', 'parcourirStructure', 'valeur'), ...POSS()] }), application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: OBS({ possibilites: [{ donnee: 'X', operation: 'parcourirStructure' }, ...POSS()] }), application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: OBS({ possibilites: [null] }), application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: null, application: APP() }));
  await refuse(enregistrerDesignation(m, { observation: [], application: APP() }));
  assert.deepEqual(await m.lireTout(T), []);
});
test('C4. ACCESSEURS : jamais exécutés (observation, id, possibilites, atome, application, liaisons, liaison, entrée)', async () => {
  const m = magasinMemoireVive();
  const essais = [
    () => ({ observation: piegeSur(OBS(), 'id'), application: APP() }),
    () => ({ observation: piegeSur(OBS(), 'possibilites'), application: APP() }),
    () => ({ observation: OBS({ possibilites: [piegeSur(at('X', 'parcourirStructure', 'valeur'), 'donnee')] }), application: APP() }),
    () => ({ observation: OBS({ possibilites: (() => { const t = POSS(); Object.defineProperty(t, '0', { enumerable: true, get() { throw new Error('rang exécuté'); } }); return t; })() }), application: APP() }),
    () => ({ observation: OBS(), application: piegeSur(APP(), 'operation') }),
    () => ({ observation: OBS(), application: piegeSur(APP(), 'liaisons') }),
    () => ({ observation: OBS(), application: APP({ liaisons: [piegeSur({ entree: 'valeur', donnee: 'X' }, 'donnee')] }) }),
    () => ({ observation: OBS(), application: APP({ liaisons: [piegeSur({ entree: 'valeur', donnee: 'X' }, 'entree')] }) }),
    () => piegeSur({ application: APP() }, 'observation'),
    () => piegeSur({ observation: OBS() }, 'application'),
  ];
  for (const f of essais) await refuse((async () => enregistrerDesignation(m, f()))(), /accesseur/);
  assert.deepEqual(await m.lireTout(T), []);
});
test('C5. propriétés HÉRITÉES refusées (observation, id, possibilites, application, operation, liaisons, liaison)', async () => {
  const m = magasinMemoireVive();
  const heritant = (propres, herites) => Object.assign(Object.create(herites), propres);
  const { id, ...sansId } = OBS();
  await refuse(enregistrerDesignation(m, { observation: heritant(sansId, { id }), application: APP() }), /champ « id » propre/);
  const { possibilites, ...sansPoss } = OBS();
  await refuse(enregistrerDesignation(m, { observation: heritant(sansPoss, { possibilites }), application: APP() }), /possibilites/);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: heritant({ liaisons: APP().liaisons }, { operation: 'parcourirStructure' }) }), /operation/);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: heritant({ operation: 'parcourirStructure' }, { liaisons: APP().liaisons }) }), /liaisons/);
  await refuse(enregistrerDesignation(m, { observation: OBS(), application: APP({ liaisons: [heritant({ entree: 'valeur' }, { donnee: 'X' })] }) }), /donnee/);
  await refuse(enregistrerDesignation(m, heritant({ observation: OBS() }, { application: APP() })), /application/);
  await refuse(enregistrerDesignation(m, heritant({ application: APP() }, { observation: OBS() })), /observation/);
  assert.deepEqual(await m.lireTout(T), []);
});

// ============================================================================ D. CANONICITÉ ET IMMUTABILITÉ
test('D1. liaisons canoniques : tri par entree en unités de code, quel que soit l\'ordre reçu', async () => {
  const poss = [at('1', 'O', 'b'), at('2', 'O', 'a'), at('3', 'O', 'B'), at('4', 'O', 'é')];
  const m = magasinMemoireVive();
  const permutations = [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1]];
  for (const p of permutations) {
    const liaisons = p.map((i) => ({ entree: poss[i].entree, donnee: poss[i].donnee }));
    const x = await enregistrerDesignation(m, { observation: OBS({ possibilites: poss }), application: { operation: 'O', liaisons } });
    assert.deepEqual(x.liaisons.map((l) => l.entree), ['B', 'a', 'b', 'é']);
  }
});
test('D2. entrée reçue non modifiée (observation, application, liaisons, ordre)', async () => {
  const obs = OBS(); const app = { operation: 'memesCouvertures', liaisons: [{ entree: 'b', donnee: 'B' }, { entree: 'a', donnee: 'A' }] };
  const avantO = JSON.stringify(obs); const avantA = JSON.stringify(app);
  await enregistrerDesignation(magasinMemoireVive(), { observation: obs, application: app });
  assert.equal(JSON.stringify(obs), avantO); assert.equal(JSON.stringify(app), avantA);
});
test('D3. IMMUABLE : modifier les objets fournis après écriture ne modifie pas la ligne persistée ; l\'objet écrit est une copie neuve', async () => {
  const m = magasinMemoireVive();
  const obs = OBS(); const lia = { entree: 'valeur', donnee: 'X' }; const app = { operation: 'parcourirStructure', liaisons: [lia] };
  const x = await enregistrerDesignation(m, { observation: obs, application: app });
  const avant = JSON.parse(JSON.stringify(x));
  lia.donnee = 'Z'; lia.entree = 'q'; app.operation = 'autre'; app.liaisons.push({ entree: 'n', donnee: 'n' }); obs.id = 'modifié'; obs.possibilites.length = 0;
  assert.deepEqual(JSON.parse(JSON.stringify(await m.lireTout(T)))[0], avant);
  assert.notEqual(x.liaisons, app.liaisons); assert.notEqual(x.liaisons[0], lia);
  assert.deepEqual((await m.lireTout(T))[0], avant);
});
test('D4. aucune possibilité recopiée : la ligne ne contient qu\'idObservation (aucune donnée de l\'observation hors celle de la liaison)', async () => {
  const x = await enregistrerDesignation(magasinMemoireVive(), { observation: OBS(), application: APP() });
  const json = JSON.stringify(x);
  for (const absent of ['"A"', '"B"', '"C"', 'message-1', 'execution-operation-1', 'memesCouvertures', 'donneesExaminees']) assert.equal(json.includes(absent), false, absent);
});

// ============================================================================ E. NON-CHOIX
test('E1. TEST DE NON-CHOIX : sans application, la primitive refuse et n\'écrit rien (jamais d\'application fabriquée depuis l\'observation)', async () => {
  const e = espion();
  await refuse(enregistrerDesignation(e, { observation: OBS() }), /application/);
  await refuse(enregistrerDesignation(e, { observation: OBS(), application: undefined }));
  await refuse(enregistrerDesignation(e, { observation: OBS(), application: null }));
  await refuse(enregistrerDesignation(e, { observation: OBS({ possibilites: [at('X', 'parcourirStructure', 'valeur')] }) }));
  await refuse(enregistrerDesignation(e, { observation: OBS() , application: {} }));
  await refuse(enregistrerDesignation(e, { observation: OBS(), application: { operation: 'parcourirStructure' } }));
  await refuse(enregistrerDesignation(e, { observation: OBS(), application: { liaisons: [] } }));
  await refuse(enregistrerDesignation(e, { observation: OBS() }, undefined));
  await refuse(enregistrerDesignation(e, undefined));
  assert.deepEqual(e.ecrits, []);
});
test('E2. l\'application enregistrée est TOUJOURS celle fournie, quelle que soit la position, l\'origine ou la répétition des possibilités', async () => {
  const bases = POSS();
  const ordres = [bases, bases.slice().reverse(), [...bases, ...bases], bases.slice(2), [bases[3], ...bases.slice(0, 3), bases[5], bases[4]]];
  for (const donnee of ['X', 'C', 'message-1', 'execution-operation-1']) {
    for (const possibilites of ordres) {
      const x = await enregistrerDesignation(magasinMemoireVive(), { observation: OBS({ possibilites }), application: APP({ liaisons: [{ entree: 'valeur', donnee }] }) });
      assert.deepEqual(x.liaisons, [{ entree: 'valeur', donnee }]);
    }
  }
});
test('E3. aucune politique dans le code (hors commentaires) : ni hasard, ni première/dernière, ni score, ni compte, ni préférence d\'origine', () => {
  const a = CONN.indexOf('// === FAIT PERSISTANT DE DÉSIGNATION'); const b = CONN.indexOf('// === FIN_LANGAGE_CONNAISSANCES');
  const code = sansCommentaires(CONN.slice(a, b));
  assert.equal(/Math\.random|crypto|getRandomValues|\.at\(|\bscore\b|\bpoids\b|\bpriorite\b|reduce\(|\.find\(|\.shift\(|\.pop\(|possibles\.keys\(\)\.next|\[0\]|\.length\s*-\s*1|message-|execution-operation|\.sort\(\(a, b\) => comparerCodes\(a\.donnee/.test(code), false);
  assert.equal((code.match(/\.sort\(/g) || []).length, 1); // le seul tri : canonicalisation des liaisons de l'APPLICATION fournie
  assert.match(code, /liaisons\.sort\(\(a, b\) => comparerCodes\(a\.entree, b\.entree\)\)/);
  assert.equal(/possibilites\.(sort|slice|filter|map|find)/.test(code), false);
});
test('E4. le code n\'importe ni DESCRIPTIONS_OPERATIONS, ni groupesDeCandidats, ni invoquerOperation, ni formes ; n\'écrit qu\'une fois ; n\'ouvre aucune autre table', () => {
  const imports = (CONN.match(/^import\b[^;]*;/gm) || []).join('\n');
  assert.equal(/descriptions-operations|groupes-candidats|invocation-operations|table-operations|formes-operation|possibilites-liaison|productions-decrites|acces-valeur|acces-trace|DESCRIPTIONS_OPERATIONS|groupesDeCandidats|invoquerOperation/.test(imports), false);
  const a = CONN.indexOf('// === FAIT PERSISTANT DE DÉSIGNATION'); const b = CONN.indexOf('// === FIN_LANGAGE_CONNAISSANCES');
  const code = sansCommentaires(CONN.slice(a, b));
  assert.equal(/DESCRIPTIONS_OPERATIONS|groupesDeCandidats|invoquerOperation|validerDescripteur|productionsDecrites|possibilitesDeLiaison|executionsOperations|observationsPossibilites|enregistrerExecutionOperation/.test(code), false);
  assert.equal((code.match(/magasin\.ecrire\(/g) || []).length, 1);
  assert.match(code, /magasin\.ecrire\('designations', objet\)/);
  assert.equal(/magasin\.(lireTout|lire|supprimer|vider|remplacerTout)/.test(code), false);
  assert.equal(/\beval\b|new\s+Function|import\s*\(|structuredClone|Proxy/.test(code), false);
});
test('E5. la primitive ne va pas chercher l\'observation : le magasin n\'est jamais lu, même avec un magasin qui lève à la lecture', async () => {
  const m = { ecrits: [], async ecrire(t, o) { this.ecrits.push([t, o]); }, async lireTout() { throw new Error('lecture interdite'); }, async lire() { throw new Error('lecture interdite'); } };
  await enregistrerDesignation(m, { observation: OBS(), application: APP() });
  assert.equal(m.ecrits.length, 1);
  assert.equal(m.ecrits[0][0], T);
});
test('E6. la source de l\'objet écrit contient exactement id, horodatage, idObservation, operation, liaisons, origine', () => { // MISE À JOUR DÉLIBÉRÉE v0.63.33 : + origine
  const a = CONN.indexOf("const objet = {\n    id: nouvelId('designation-application')");
  assert.ok(a > 0);
  const b = CONN.indexOf("await magasin.ecrire('designations'");
  assert.deepEqual([...CONN.slice(a, b).matchAll(/^\s+(\w+)[,:]/gm)].map((m) => m[1]), ['id', 'horodatage', 'idObservation', 'operation', 'liaisons', 'origine']);
  assert.match(CONN.slice(a, b), /idObservation,\n/);
  assert.match(CONN.slice(a, b), /liaisons,\n    origine,\n/); // origine copiée telle que fournie, jamais calculée ici // observation.id lu et copié tel quel, jamais recréé
});

// ============================================================================ F. ATOMICITÉ
test('F1. TOUT OU RIEN : chaque échec de validation laisse zéro écriture', async () => {
  const e = espion();
  const cas = [
    { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 'X' }, { entree: 'valeur', donnee: 'X' }] }) },
    { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 'X' }, { entree: 'zz', donnee: 'X' }] }) },
    { observation: OBS({ id: '' }), application: APP() },
    { observation: OBS(), application: APP({ liaisons: [] }) },
    { observation: OBS(), application: APP({ liaisons: [{ entree: 'valeur', donnee: 'X' }, null] }) },
  ];
  for (const c of cas) await refuse(enregistrerDesignation(e, c));
  assert.deepEqual(e.ecrits, []);
});
test('F2. UN seul appel d\'écriture, sur la table designations, avec la ligne retournée', async () => {
  const e = espion();
  const x = await enregistrerDesignation(e, { observation: OBS(), application: APP() });
  assert.equal(e.ecrits.length, 1);
  assert.equal(e.ecrits[0][0], T);
  assert.equal(e.ecrits[0][1], x);
});
test('F3. une panne d\'écriture se propage telle quelle ; aucune ligne', async () => {
  const panne = new Error('disque plein');
  const e = espion(panne);
  await assert.rejects(enregistrerDesignation(e, { observation: OBS(), application: APP() }), (err) => err === panne);
  const m = magasinMemoireVive();
  assert.deepEqual(await m.lireTout(T), []);
});
test('F4. validation COMPLÈTE avant l\'écriture : une liaison invalide en dernier rang empêche toute écriture', async () => {
  const e = espion();
  const liaisons = [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'B' }, { entree: 'c', donnee: 'C' }];
  await refuse(enregistrerDesignation(e, { observation: OBS(), application: { operation: 'memesCouvertures', liaisons } }));
  assert.deepEqual(e.ecrits, []);
});

// ============================================================================ G. PERSISTANCE
test('G1. VERSION_BASE 19, SCHEMA_SAUVEGARDE 9, 22 tables sans doublon, designations avant-dernière (valeursDonnees ajoutée en v0.63.27), clé id', () => { // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(VERSION_BASE, 19); assert.equal(SCHEMA_SAUVEGARDE, 9); assert.equal(TABLES.length, 22);
  assert.equal(new Set(TABLES).size, 22);
  assert.equal(TABLES[20], T); assert.equal(TABLES[19], 'executionsOperations'); assert.equal(TABLES[21], 'valeursDonnees'); assert.equal(CLE[T], 'id');
  assert.equal(CLE.executionsOperations, 'id');
});
test('G2. migration 16 → 19 (IndexedDB simulée) : crée SEULEMENT designations et valeursDonnees, aucune donnée existante touchée', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  const existants = TABLES.filter((t) => t !== T && t !== 'valeursDonnees');
  const donnees = new Map(existants.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null; let nom = null;
  const fabrique = { open(n, v) {
    nom = n; version = v;
    const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) };
    const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
    Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); });
    return r;
  } };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nom, NOM_BASE); assert.equal(version, 19);
  assert.deepEqual(crees, [[T, 'id'], ['valeursDonnees', 'id']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});
const maintenant = new Date('2026-10-05T09:00:00Z');
async function etat() {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  const x = await enregistrerDesignation(magasinLangage, { observation: OBS(), application: APP() });
  const y = await enregistrerDesignation(magasinLangage, { observation: OBS({ id: 'observation-possibilites-2' }), application: { operation: 'memesCouvertures', liaisons: [{ entree: 'b', donnee: 'B' }, { entree: 'a', donnee: 'A' }] } });
  await magasinLangage.ecrire('journal', { id: 'j1', texte: 'ancien' });
  return { memoire, magasinLangage, x, y };
}
async function enSchema(fichier, schema, sansTables = []) {
  const f = JSON.parse(fichier.contenu); f.schema = schema;
  for (const t of sansTables) delete f.donnees.langage[t];
  f.empreinte = await empreinte(JSON.stringify(f.donnees)); return f;
}
test('G3. sauvegarde schéma 7 : designations exportée et restaurée à l\'identique (aller-retour JSON, empreinte valide)', async () => {
  const { memoire, magasinLangage, x, y } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.22', maintenant });
  assert.equal(fichier.objet.schema, 9);
  const ids = (l) => l.map((e) => e.id).sort();
  assert.deepEqual(ids(fichier.objet.donnees.langage[T]), ids([x, y]));
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  const neuf = magasinMemoireVive();
  await neuf.ecrire(T, { id: 'residu', horodatage: 'x', idObservation: 'x', operation: 'x', liaisons: [] });
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  const tri = (l) => l.slice().sort((p, q) => (p.id < q.id ? -1 : 1));
  const apres = tri(await neuf.lireTout(T));
  assert.deepEqual(apres, tri([x, y]));
  assert.equal(JSON.stringify(apres.find((l) => l.id === x.id)), JSON.stringify(x));
  assert.deepEqual(await neuf.lireTout('journal'), [{ id: 'j1', texte: 'ancien' }]);
});
test('G4. ANCIENNES sauvegardes (schémas 1 à 6, sans la table) : importables, designations = [], aucune reconstruction', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.22', maintenant });
  for (const schema of [1, 2, 3, 4, 5, 6]) {
    const ancienne = await enSchema(fichier, schema, [T]);
    const lue = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
    assert.equal(lue.ok, true, `schéma ${schema} : ${lue.erreur}`);
    assert.deepEqual(lue.donnees.langage[T], []);
    assert.deepEqual(lue.donnees.langage.journal, [{ id: 'j1', texte: 'ancien' }]);
    const neuf = magasinMemoireVive();
    await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
    assert.deepEqual(await neuf.lireTout(T), []);
  }
});
test('G5. schéma courant (9) STRICT : sans designations = refus « incomplet » ; schéma futur (10) = refus « plus récente »', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.22', maintenant });
  const incomplet = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 9, [T])), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(incomplet.ok, false); assert.match(incomplet.erreur, /incomplet.*designations/);
  const futur = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 10)), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(futur.ok, false); assert.match(futur.erreur, /plus récente/);
});
test('G6. migrerDonnees : complète par [] pour un schéma < 9 seulement ; ne fabrique jamais de ligne', () => {
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 6)[T], []);
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 1)[T], []);
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 7)[T], []);
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 8)[T], []);
  assert.equal(Object.prototype.hasOwnProperty.call(migrerDonnees({ faits: [] }, [T], 9), T), false);
  assert.deepEqual(migrerDonnees({ [T]: [{ id: 'z' }] }, [T], 6)[T], [{ id: 'z' }]);
});
test('G7. une ligne falsifiée dans le fichier est détectée par l\'empreinte', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.22', maintenant });
  const f = JSON.parse(fichier.contenu); f.donnees.langage[T][0].operation = 'falsifiée';
  const lue = await lireSauvegardeComplete(JSON.stringify(f), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, false);
});
test('G8. enregistrerDesignation : empreinte du source pinglée (v0.63.33 : + origine, MISE À JOUR DÉLIBÉRÉE) ; aucune exécution n\'est écrite par elle', () => {
  const a = CONN.indexOf('export async function enregistrerDesignation('); const b = CONN.indexOf('\n}\n', a) + 3;
  assert.equal(createHash('sha256').update(CONN.slice(a, b)).digest('hex'), '6a5a7fa2ac80e7705370c127ecd4b773c6d3e75f1a4b9bc3e28ba50a83911ffa');
  assert.equal(/executionsOperations|enregistrerExecutionOperation/.test(sansCommentaires(CONN.slice(a, b))), false);
});

// ============================================================================ H. DORMANCE
test('H1. seul connaissances.js nomme la primitive, la table ou l\'identité (code hors commentaires)', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f);
    if (r === 'app/langage/connaissances.js') continue;
    assert.equal(/enregistrerDesignation|designations|designation-application/.test(sansCommentaires(readFileSync(f, 'utf8'))), false, r);
  }
  for (const autre of ['app/index.html', 'app/sw.js', 'sw.js', 'worker.js', 'index.html', 'app/manifest.webmanifest']) {
    let src; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; }
    assert.equal(/enregistrerDesignation|designations/.test(src), false, autre);
  }
});
test('H2. aucun branchement depuis main, pont, ecran, observation-possibilites, action, composition (ni autre module de langage)', () => {
  for (const n of ['app/main.js', 'app/langage/pont.js', 'app/langage/ecran.js', 'app/langage/observation-possibilites.js', 'app/langage/action.js',
    'app/langage/composition.js', 'app/langage/esprit.js', 'app/langage/invocation-operations.js', 'app/langage/table-operations.js',
    'app/langage/possibilites-liaison.js', 'app/langage/productions-decrites.js', 'app/langage/groupes-candidats.js', 'app/langage/vue-traces.js',
    'app/langage/registre.js', 'app/langage/donnee-de-source.js', 'app/langage/acces-valeur.js']) {
    assert.equal(/enregistrerDesignation|designations|designation-application/.test(lu(...n.split('/'))), false, n);
  }
});
test('H3. dans connaissances.js, la primitive n\'a aucun appelant et la table n\'est lue par aucune fonction', () => {
  const code = sansCommentaires(CONN);
  assert.equal((code.match(/enregistrerDesignation\(/g) || []).length, 1);
  assert.equal((code.match(/export async function enregistrerDesignation\(/g) || []).length, 1);
  assert.equal((code.match(/'designations'/g) || []).length, 2); // TABLES + écriture
  assert.equal(/lireTout\(\s*['"]designations/.test(code), false);
});
test('H4. graphe d\'imports depuis app/main.js : aucun fichier atteint n\'appelle enregistrerDesignation (connaissances.js l\'exporte sans l\'appeler)', () => {
  const vus = new Set(); const pile = [resolve(RACINE, 'app/main.js')];
  while (pile.length > 0) {
    const f = pile.pop();
    if (vus.has(f) || !existsSync(f)) continue;
    vus.add(f);
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:import|export)[^'"`;]*?from\s*['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)|^import\s*['"](\.[^'"]+)['"]/gm)) pile.push(resolve(dirname(f), m[1] || m[2] || m[3]));
  }
  assert.ok(vus.size > 50);
  for (const f of vus) {
    if (f.endsWith('/app/langage/connaissances.js')) continue;
    assert.equal(/enregistrerDesignation/.test(readFileSync(f, 'utf8')), false, f);
  }
  assert.equal(/\bdesignation\b/i.test(sansCommentaires(lu('app', 'main.js'))), false);
  for (const f of ['app/groupes-candidats.js']) assert.equal(existsSync(join(RACINE, f)), false);
  assert.equal([...vus].some((f) => f.endsWith('/groupes-candidats.js')), false);
});
test('H5. la phrase de non-complétude est documentée dans le code', () => {
  assert.match(CONN, /enregistrerDesignation garantit l'appartenance des liaisons à l'observation fournie ; elle ne prouve pas à elle seule\s*\n\/\/ que l'application contient toutes les entrées exigées par la description de l'opération\./);
});
// === FIN_TEST_DESIGNATIONS ===
