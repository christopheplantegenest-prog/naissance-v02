// === DEBUT_TEST_CONFORMITE_APPLICATION ===
// v0.63.40 — CONFORMITÉ APPLICATION ↔ CATALOGUE (décision ChatGPT, 06/10/2026). verifierApplicationAuCatalogue : contrôle pur du MODE de liaison
// (entrée ordinaire → { entree, donnee } ; entrée collective → { entree, donnees:[…] }) et de la couverture exacte des entrées. Branché
// UNIQUEMENT à l'étape 0 de executerApplicationSollicitee, avant toute désignation persistante. Aucune opération collective réelle : papier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { verifierApplicationAuCatalogue as verifier } from '../app/langage/conformite-application.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { magasinMemoireVive, enregistrerDesignation } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && /^verifierApplicationAuCatalogue : /.test(e.message) && (motif === undefined || motif.test(e.message)), String(f));
const SC = (genre) => ({ forme: 'scalaire', genre });
const COLL = { forme: 'collection', elements: SC('chaine') };
const PAPIER = { nom: 'rassembler', entrees: { elements: { forme: 'collection', collectif: true, elements: { forme: 'objet', champs: { identite: SC('chaine'), valeur: COLL } } } }, sortie: SC('chaine') };
const DEUX = { nom: 'deux', entrees: { a: COLL, b: COLL }, sortie: SC('nombre') };
const CATALOGUE = [PAPIER, DEUX];
const donnee = (identite, forme) => ({ identite, forme });
const A = donnee('execution-A', COLL);
const B = donnee('execution-B', COLL);
const observation = (ds) => ({ id: 'obs-1', possibilites: possibilitesDeLiaison(ds, CATALOGUE) });
const univers = (ds) => ds.map((d) => ({ donnee: d, porteur: { id: d.identite, valeur: [] }, acces: { champ: 'valeur' } }));

test('A1. ordinaire conforme : { entree, donnee } sur chaque entrée ordinaire, toutes liées', () => {
  assert.equal(verifier({ operation: 'deux', liaisons: [{ entree: 'a', donnee: 'x' }, { entree: 'b', donnee: 'y' }] }, CATALOGUE), true);
  assert.equal(verifier({ operation: 'deux', liaisons: [{ entree: 'b', donnee: 'y' }, { entree: 'a', donnee: 'x' }] }, CATALOGUE), true);
});
test('A2. collectif conforme : { entree, donnees:[…] } non vide, sans doublon', () => {
  assert.equal(verifier({ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['u', 'v'] }] }, CATALOGUE), true);
  assert.equal(verifier({ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['u'] }] }, CATALOGUE), true);
});
test('B1. ordinaire sur entrée collective : refusé', () => {
  refuse(() => verifier({ operation: 'rassembler', liaisons: [{ entree: 'elements', donnee: 'u' }] }, CATALOGUE), /collective/);
});
test('B2. collectif sur entrée ordinaire : refusé', () => {
  refuse(() => verifier({ operation: 'deux', liaisons: [{ entree: 'a', donnees: ['x'] }, { entree: 'b', donnee: 'y' }] }, CATALOGUE), /ordinaire/);
});
test('B3. entrée inconnue, opération inconnue : refusées', () => {
  refuse(() => verifier({ operation: 'deux', liaisons: [{ entree: 'a', donnee: 'x' }, { entree: 'zzz', donnee: 'y' }] }, CATALOGUE), /n'existe pas/);
  refuse(() => verifier({ operation: 'inconnue', liaisons: [{ entree: 'a', donnee: 'x' }] }, CATALOGUE), /inconnue/);
});
test('B4. entrée manquante, entrée dupliquée : refusées', () => {
  refuse(() => verifier({ operation: 'deux', liaisons: [{ entree: 'a', donnee: 'x' }] }, CATALOGUE), /ne lie pas/);
  refuse(() => verifier({ operation: 'deux', liaisons: [{ entree: 'a', donnee: 'x' }, { entree: 'a', donnee: 'y' }] }, CATALOGUE), /plusieurs fois/);
});
test('B5. forme de l\'application : clés étrangères, deux clés ensemble, vides, doublons, creux, accesseurs, non-objets refusés', () => {
  const ok = [{ entree: 'a', donnee: 'x' }, { entree: 'b', donnee: 'y' }];
  refuse(() => verifier({ operation: 'deux', liaisons: ok, extra: 1 }, CATALOGUE));
  refuse(() => verifier({ operation: 'deux' }, CATALOGUE));
  refuse(() => verifier(null, CATALOGUE));
  refuse(() => verifier({ operation: 'deux', liaisons: [] }, CATALOGUE));
  refuse(() => verifier({ operation: 'deux', liaisons: [{ entree: 'a', donnee: 'x', donnees: ['x'] }, { entree: 'b', donnee: 'y' }] }, CATALOGUE));
  refuse(() => verifier({ operation: 'deux', liaisons: [{ entree: 'a', donnee: '' }, { entree: 'b', donnee: 'y' }] }, CATALOGUE));
  refuse(() => verifier({ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: [] }] }, CATALOGUE));
  refuse(() => verifier({ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['u', 'u'] }] }, CATALOGUE), /répète/);
  refuse(() => verifier({ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['u', 3] }] }, CATALOGUE));
  refuse(() => verifier({ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: new Array(1) }] }, CATALOGUE), /creux/);
  refuse(() => verifier({ operation: 'rassembler', liaisons: [{ entree: 'elements', get donnees() { throw new Error('exécuté'); } }] }, CATALOGUE), /accesseur/);
  refuse(() => verifier({ operation: 'deux', liaisons: [null, { entree: 'b', donnee: 'y' }] }, CATALOGUE));
  refuse(() => verifier({ operation: 'deux', liaisons: ok }, 'pas un catalogue'));
  refuse(() => verifier({ operation: 'deux', liaisons: ok }, [DEUX, DEUX]), /même nom/);
});
test('C1. ancienne application ordinaire du catalogue RÉEL acceptée ; l\'application n\'est ni copiée ni modifiée', () => {
  const app = Object.freeze({ operation: 'parcourirStructure', liaisons: Object.freeze([Object.freeze({ entree: 'valeur', donnee: 'message-1' })]) });
  assert.equal(verifier(app, DESCRIPTIONS_OPERATIONS), true);
  assert.deepEqual(app, { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'message-1' }] });
});
test('C2. application issue de applicationsSollicitables acceptée SANS transformation (collective et ordinaire)', () => {
  const obs = observation([A, B]);
  const { applications } = applicationsSollicitables(obs, CATALOGUE);
  assert.ok(applications.length >= 1);
  for (const app of applications) assert.equal(verifier(app, CATALOGUE), true);
});
test('D1. étape 0 : une application non conforme est refusée par executerApplicationSollicitee AVANT toute écriture (désignation comprise)', async () => {
  const obs = observation([A, B]);
  const m = magasinMemoireVive();
  for (const application of [
    { operation: 'rassembler', liaisons: [{ entree: 'elements', donnee: 'execution-A' }] },
    { operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['execution-A', 'execution-A'] }] },
    { operation: 'inconnue', liaisons: [{ entree: 'elements', donnee: 'execution-A' }] },
  ]) {
    const r = await executerApplicationSollicitee({ observation: obs, application, univers: univers([A, B]) }, { magasin: m, table: TABLE_OPERATIONS, descriptions: CATALOGUE });
    assert.equal(r.statut, 'echec_designation');
  }
  assert.deepEqual(await m.lireTout('designations'), []);
  assert.deepEqual(await m.lireTout('executionsOperations'), []);
});
test('D2. PREUVE DE LA FRONTIÈRE : avec l\'étape 0, une liaison ordinaire sur entrée collective n\'écrit rien', async () => {
  const obs = observation([A]);
  const application = { operation: 'rassembler', liaisons: [{ entree: 'elements', donnee: 'execution-A' }] };
  refuse(() => verifier(application, CATALOGUE), /collective/);
  const m = magasinMemoireVive();
  const r = await executerApplicationSollicitee({ observation: obs, application, univers: univers([A]) }, { magasin: m, table: TABLE_OPERATIONS, descriptions: CATALOGUE });
  assert.equal(r.statut, 'echec_designation');
  assert.match(String(r.erreur && r.erreur.message), /^verifierApplicationAuCatalogue : /);
  assert.deepEqual(await m.lireTout('designations'), []);
  // CONSTAT : la persistance seule ne connaît pas le catalogue (elle accepte cette liaison) ; c'est exactement pourquoi la frontière est l'étape 0.
  const nue = magasinMemoireVive();
  const ligne = await enregistrerDesignation(nue, { observation: obs, application, origine: 'exterieure' });
  assert.deepEqual(ligne.liaisons, [{ entree: 'elements', donnee: 'execution-A' }]);
});
test('E1. STATIQUE : conformite-application.js ne dépend que du langage de formes, ne lit ni observation ni univers ni magasin, n\'est importé que par execution-sollicitee.js', () => {
  const src = readFileSync(join(RACINE, 'app', 'langage', 'conformite-application.js'), 'utf8');
  const code = src.replace(/\/\/.*$/gm, '');
  assert.deepEqual(code.match(/^\s*import\b.*$/gm).map((l) => l.trim()), ["import { validerDescripteurOperation } from './formes-operation.js';"]);
  assert.equal(/\b(await|async|Promise|setTimeout|Date|Math|JSON|localStorage|magasin|observation|univers|DESCRIPTIONS_OPERATIONS)\b/.test(code), false);
  const importeurs = [];
  const parcourir = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) parcourir(f); else if (/\.js$/.test(e.name) && /conformite-application/.test(readFileSync(f, 'utf8')) && e.name !== 'conformite-application.js') importeurs.push(f.slice(RACINE.length + 1)); } };
  parcourir(join(RACINE, 'app'));
  assert.deepEqual(importeurs, ['app/langage/execution-sollicitee.js']);
});
test('E2. le fait « collectif » reste dans le catalogue seul : l\'observation des possibilités ne le mentionne pas', () => {
  const obs = readFileSync(join(RACINE, 'app', 'langage', 'observation-possibilites.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.equal(/collectif/.test(obs), false);
});
test('E3. enregistrerDesignation n\'est appelé en production que par execution-sollicitee.js (frontière unique avant la persistance)', () => {
  const appelants = [];
  const parcourir = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) parcourir(f); else if (/\.js$/.test(e.name) && /enregistrerDesignation\(/.test(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')) && e.name !== 'connaissances.js') appelants.push(f.slice(RACINE.length + 1)); } };
  parcourir(join(RACINE, 'app'));
  assert.deepEqual(appelants, ['app/langage/capacite.js', 'app/langage/execution-sollicitee.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.85 (observation interne du tick, sondes X1/X2) : capacite.js désigne la conséquence B1 du tick (application soi:repos(etat) parmi les possibilités de l'observation interne, origine 'mecanique') : seconde frontière, même primitive, même contrôle des possibilités
});
// === FIN_TEST_CONFORMITE_APPLICATION ===
