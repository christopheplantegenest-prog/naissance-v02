// === DEBUT_TEST_OBSERVATIONS_POSSIBILITES ===
// v0.63.16 — ÉTAPE 6, décision ChatGPT « OBSERVATION DES POSSIBILITÉS AU MOMENT VÉCU » (04/10/2026). Preuves que, pour chaque
// message engagé dans un tour : (1) une ligne { id, idMessage, horodatage, donneesExaminees, operationsExaminees, possibilites }
// est écrite APRÈS l'identité et AVANT la capture d'énoncé et tout traitement ; (2) elle vient exclusivement des primitives
// existantes ; (3) le cas zéro est une ligne avec liste vide, jamais une ligne absente, et un échec n'écrit jamais de liste vide ;
// (4) l'état vécu est conservé, jamais recalculé ; (5) la table entre dans la sauvegarde ; (6) rien n'est lu pour décider.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  magasinMemoireVive, enregistrerObservationPossibilites, enregistrerEnonceSurTrace, ouvrirIndexedDB, TABLES, CLE, VERSION_BASE, NOM_BASE, nouvelId,
} from '../app/langage/connaissances.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import * as moduleObservation from '../app/langage/observation-possibilites.js';
import { identifierMessage, traiterTourAvecEnonce, tenterPontLangage } from '../app/langage/pont.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { donneeDeSource } from '../app/langage/donnee-de-source.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees } from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';

const T = 'observationsPossibilites';
const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const OBS = lu('app', 'langage', 'observation-possibilites.js');
const OBS_CODE = sansCommentaires(OBS);
const PONT_CODE = sansCommentaires(lu('app', 'langage', 'pont.js'));
const MAIN_CODE = sansCommentaires(lu('app', 'main.js'));
const copie = (x) => JSON.parse(JSON.stringify(x));
const gen = () => { let n = 0; return (p) => `${p}-t-${++n}`; };
const NOMS_CATALOGUE = DESCRIPTIONS_OPERATIONS.map((d) => d.nom);
const sc = (genre) => ({ forme: 'scalaire', genre });
const desc = (nom, entrees) => ({ nom, entrees, sortie: { forme: 'scalaire' } });
const maintenant = new Date('2026-10-04T12:00:00Z');
// Magasin + observateur réel (comme main.js) sur un magasin en mémoire.
function banc(descriptions) {
  const magasin = magasinMemoireVive();
  const enregistrer = (donnees) => enregistrerObservationPossibilites(magasin, donnees);
  const lireExecutions = () => magasin.lireTout('executionsOperations'); // v0.63.24 : lecture injectée, comme main.js
  const observer = async (message) => (await observerPossibilites(message, descriptions === undefined ? { enregistrer, lireExecutions } : { enregistrer, lireExecutions, descriptions })).statut; // statut seul : les tests historiques comparent des chaînes (contrat objet testé dans univers-observe.test.mjs)
  return { magasin, enregistrer, observer };
}
const lignes = (magasin) => magasin.lireTout(T);

// ============================================================================ A. SCHÉMA ET ÉCRITURE
test('A1. table déclarée : clé « id », 19 tables, VERSION_BASE 15, SCHEMA_SAUVEGARDE 5', () => {
  assert.ok(TABLES.includes(T)); assert.equal(CLE[T], 'id');
  assert.equal(TABLES.length, 21); assert.equal(new Set(TABLES).size, 21); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
  assert.equal(VERSION_BASE, 18); assert.equal(SCHEMA_SAUVEGARDE, 8); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
});
test('A2. ligne : exactement { id, idMessage, horodatage, donneesExaminees, operationsExaminees, possibilites } ; id propre ≠ idMessage', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerObservationPossibilites(m, { idMessage: 'message-1', donneesExaminees: ['message-1'], operationsExaminees: ['op'], possibilites: [{ donnee: 'message-1', operation: 'op', entree: 'e' }] });
  assert.deepEqual(Object.keys(l), ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'possibilites']);
  assert.match(l.id, /^observation-possibilites-/);
  assert.notEqual(l.id, l.idMessage);
  assert.equal(l.idMessage, 'message-1');
  assert.ok(!Number.isNaN(Date.parse(l.horodatage)));
  assert.deepEqual(await lignes(m), [l]);
});
test('A3. horodatage posé À L\'ÉCRITURE, jamais fourni par l\'appelant', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerObservationPossibilites(m, { idMessage: 'x', donneesExaminees: [], operationsExaminees: [], possibilites: [], horodatage: '1999-01-01T00:00:00.000Z', id: 'impose' });
  assert.notEqual(l.horodatage, '1999-01-01T00:00:00.000Z'); assert.notEqual(l.id, 'impose');
  assert.deepEqual(Object.keys(l), ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'possibilites']);
});
test('A4. CANONICITÉ : ensembles triés par unités de code (sans localeCompare), quel que soit l\'ordre reçu ; atomes triés (operation, entree, donnee)', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerObservationPossibilites(m, {
    idMessage: 'M', donneesExaminees: ['b', 'B', 'a', 'é'], operationsExaminees: ['z', 'Z', 'a'],
    possibilites: [
      { donnee: 'd2', operation: 'op2', entree: 'e1' }, { donnee: 'd1', operation: 'op2', entree: 'e1' },
      { donnee: 'd1', operation: 'op1', entree: 'e2' }, { donnee: 'd1', operation: 'op1', entree: 'e1' },
    ],
  });
  assert.deepEqual(l.donneesExaminees, ['B', 'a', 'b', 'é']);
  assert.deepEqual(l.operationsExaminees, ['Z', 'a', 'z']);
  assert.deepEqual(l.possibilites.map((a) => `${a.operation}.${a.entree}.${a.donnee}`), ['op1.e1.d1', 'op1.e2.d1', 'op2.e1.d1', 'op2.e1.d2']);
  assert.equal(/localeCompare/.test(sansCommentaires(lu('app', 'langage', 'connaissances.js'))), false);
});
test('A5. ordre d\'entrée sans influence : deux permutations donnent des lignes identiques (hors id/horodatage)', async () => {
  const a = [{ donnee: 'd', operation: 'o1', entree: 'x' }, { donnee: 'd', operation: 'o2', entree: 'y' }];
  const m = magasinMemoireVive();
  const l1 = await enregistrerObservationPossibilites(m, { idMessage: 'M', donneesExaminees: ['d', 'e'], operationsExaminees: ['o1', 'o2'], possibilites: a });
  const l2 = await enregistrerObservationPossibilites(m, { idMessage: 'M', donneesExaminees: ['e', 'd'], operationsExaminees: ['o2', 'o1'], possibilites: [...a].reverse() });
  const f = ({ id, horodatage, ...reste }) => reste;
  assert.deepEqual(f(l1), f(l2));
});
test('A6. aucun doublon accepté (données, opérations, atomes) ; rien n\'est écrit en cas de refus', async () => {
  const m = magasinMemoireVive();
  const ok = { idMessage: 'M', donneesExaminees: ['d'], operationsExaminees: ['o'], possibilites: [] };
  await assert.rejects(() => enregistrerObservationPossibilites(m, { ...ok, donneesExaminees: ['d', 'd'] }), /doublon/);
  await assert.rejects(() => enregistrerObservationPossibilites(m, { ...ok, operationsExaminees: ['o', 'o'] }), /doublon/);
  const a = { donnee: 'd', operation: 'o', entree: 'e' };
  await assert.rejects(() => enregistrerObservationPossibilites(m, { ...ok, possibilites: [a, { ...a }] }), /doublon/);
  assert.deepEqual(await lignes(m), []);
});
test('A7. validations : idMessage chaîne non vide, tableaux de chaînes non vides, atomes à trois chaînes non vides', async () => {
  const m = magasinMemoireVive();
  const ok = { idMessage: 'M', donneesExaminees: ['d'], operationsExaminees: ['o'], possibilites: [] };
  for (const idMessage of [undefined, null, '', 1, {}]) await assert.rejects(() => enregistrerObservationPossibilites(m, { ...ok, idMessage }), /idMessage/);
  for (const bad of [undefined, null, 'x', [''], [1], [null]]) {
    await assert.rejects(() => enregistrerObservationPossibilites(m, { ...ok, donneesExaminees: bad }));
    await assert.rejects(() => enregistrerObservationPossibilites(m, { ...ok, operationsExaminees: bad }));
  }
  for (const bad of [undefined, null, 'x', [null], [[]], [{ donnee: 'd', operation: 'o' }], [{ donnee: 'd', operation: '', entree: 'e' }], [{ donnee: 1, operation: 'o', entree: 'e' }]]) {
    await assert.rejects(() => enregistrerObservationPossibilites(m, { ...ok, possibilites: bad }));
  }
  await assert.rejects(() => enregistrerObservationPossibilites(m));
  assert.deepEqual(await lignes(m), []);
});
test('A8. copies : modifier les entrées ou la valeur rendue après coup ne change pas la ligne persistée ; atomes à trois clés seulement', async () => {
  const m = magasinMemoireVive();
  const atome = { donnee: 'd', operation: 'o', entree: 'e', parasite: 'x' };
  const entree = { idMessage: 'M', donneesExaminees: ['d'], operationsExaminees: ['o'], possibilites: [atome] };
  const l = await enregistrerObservationPossibilites(m, entree);
  atome.donnee = 'MODIFIE'; entree.donneesExaminees.push('z'); entree.possibilites.push({});
  assert.deepEqual(l.possibilites, [{ donnee: 'd', operation: 'o', entree: 'e' }]);
  assert.deepEqual(l.donneesExaminees, ['d']);
  assert.deepEqual(Object.keys(l.possibilites[0]), ['donnee', 'operation', 'entree']);
});
test('A9. liste vide préservée EXACTEMENT (possibilites: [] est une ligne, pas une absence)', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerObservationPossibilites(m, { idMessage: 'M', donneesExaminees: ['M'], operationsExaminees: ['o'], possibilites: [] });
  assert.deepEqual(l.possibilites, []);
  assert.equal((await lignes(m)).length, 1);
});
test('A10. aucune clé de texte, de forme, de résultat, de score ni de choix ne peut entrer dans la ligne', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerObservationPossibilites(m, { idMessage: 'M', donneesExaminees: ['M'], operationsExaminees: ['o'], possibilites: [], texte: 'secret', forme: sc('chaine'), score: 1, choix: 'o', resultat: 1, reponse: 'r', catalogue: [] });
  assert.equal(JSON.stringify(l).includes('secret'), false);
  for (const cle of ['texte', 'forme', 'score', 'choix', 'resultat', 'reponse', 'catalogue']) assert.equal(cle in l, false, cle);
});

// ============================================================================ B. L'OBSERVATEUR (primitives existantes seulement)
// v0.63.24 : ces tests historiques décrivent l'observation d'un message SEUL (zéro exécution). Le contrat est maintenant
// { statut, observation, univers } avec lecture injectée ; cette aide fournit « zéro exécution » et ne compare que le statut.
// Le contrat complet (une production, plusieurs, échecs de lecture, retour de la ligne) est prouvé dans tests/univers-observe.test.mjs.
const observer0 = async (message, options) => (await observerPossibilites(message, { lireExecutions: async () => [], ...(options || {}) })).statut;
test('B1. un seul export : observer0(message, { enregistrer, descriptions })', () => {
  assert.deepEqual(Object.keys(moduleObservation), ['observerPossibilites']);
});
test('B2. CAS RÉEL : message scalaire chaîne + 9 DESCRIPTIONS_OPERATIONS + aucune production → données [message.id], 9 noms exacts, possibilités = celles de possibilitesDeLiaison', async () => {
  const { magasin, observer } = banc();
  const message = identifierMessage('Quel est mon nom ?', { nouvelId: gen() });
  assert.equal(await observer(message), 'ecrite');
  const [l] = await lignes(magasin);
  assert.equal((await lignes(magasin)).length, 1);
  assert.equal(l.idMessage, message.id);
  assert.deepEqual(l.donneesExaminees, [message.id]);
  assert.equal(NOMS_CATALOGUE.length, 9);
  assert.deepEqual(l.operationsExaminees, [...NOMS_CATALOGUE].sort());
  const attendu = possibilitesDeLiaison([donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE)], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(l.possibilites, attendu);
  assert.deepEqual(l.possibilites, [{ donnee: message.id, operation: 'parcourirStructure', entree: 'valeur' }], 'constaté aujourd\'hui : UN atome (calculé, non codé en dur dans le module)');
});
test('B3. CAS ZÉRO : catalogue papier incompatible → UNE ligne présente avec possibilites: []', async () => {
  const { magasin, observer } = banc([desc('seulementNombre', { n: sc('nombre') }), desc('seulementBooleen', { b: sc('booleen') })]);
  const message = identifierMessage('x', { nouvelId: gen() });
  assert.equal(await observer(message), 'ecrite');
  const ls = await lignes(magasin);
  assert.equal(ls.length, 1);
  assert.deepEqual(ls[0].possibilites, []);
  assert.deepEqual(ls[0].operationsExaminees, ['seulementBooleen', 'seulementNombre']);
  assert.deepEqual(ls[0].donneesExaminees, [message.id]);
});
test('B4. CAS ZÉRO : catalogue VIDE → ligne avec données examinées, aucune opération, aucune possibilité', async () => {
  const { magasin, observer } = banc([]);
  assert.equal(await observer(identifierMessage('x', { nouvelId: gen() })), 'ecrite');
  const [l] = await lignes(magasin);
  assert.deepEqual([l.operationsExaminees, l.possibilites], [[], []]);
  assert.equal(l.donneesExaminees.length, 1);
});
test('B5. CAS MULTIPLE : plusieurs atomes → UNE seule ligne contenant l\'ensemble complet (aucune ligne par atome)', async () => {
  const { magasin, observer } = banc([desc('o1', { a: sc('chaine'), b: sc('chaine'), c: sc('nombre') }), desc('o2', { a: { forme: 'quelconque' } })]);
  const message = identifierMessage('x', { nouvelId: gen() });
  await observer(message);
  const ls = await lignes(magasin);
  assert.equal(ls.length, 1);
  assert.deepEqual(ls[0].possibilites.map((a) => `${a.operation}.${a.entree}`), ['o1.a', 'o1.b', 'o2.a']);
  assert.ok(ls[0].possibilites.every((a) => a.donnee === message.id));
});
test('B6. HISTORIQUE : observation avec le catalogue C1, puis catalogue C2 → la ligne C1 reste INCHANGÉE (conservée, jamais recalculée)', async () => {
  const magasin = magasinMemoireVive();
  const enregistrer = (d) => enregistrerObservationPossibilites(magasin, d);
  const C1 = [desc('ancienne', { e: sc('chaine') })];
  const C2 = [desc('ancienne', { e: sc('nombre') }), desc('nouvelle', { e: sc('chaine') })];
  const identifiants = gen();
  const m1 = identifierMessage('un', { nouvelId: identifiants });
  await observer0(m1, { enregistrer, descriptions: C1 });
  const avant = copie((await lignes(magasin))[0]);
  assert.deepEqual(avant.operationsExaminees, ['ancienne']);
  assert.equal(avant.possibilites.length, 1);
  const m2 = identifierMessage('deux', { nouvelId: identifiants });
  await observer0(m2, { enregistrer, descriptions: C2 });
  const ls = await lignes(magasin);
  assert.equal(ls.length, 2);
  assert.deepEqual(copie(ls.find((l) => l.idMessage === m1.id)), avant, 'ligne C1 strictement inchangée');
  const l2 = ls.find((l) => l.idMessage === m2.id);
  assert.deepEqual(l2.operationsExaminees, ['ancienne', 'nouvelle']);
  assert.deepEqual(l2.possibilites.map((a) => a.operation), ['nouvelle']);
});
test('B7. le texte n\'est JAMAIS lu : un accesseur « texte » qui lève ne change rien ; le texte n\'est pas persisté', async () => {
  const { magasin, observer } = banc();
  const piege = { id: 'message-piege' };
  Object.defineProperty(piege, 'texte', { enumerable: true, get() { throw new Error('texte lu'); } });
  assert.equal(await observer(piege), 'ecrite');
  const [l] = await lignes(magasin);
  assert.deepEqual(l.donneesExaminees, ['message-piege']);
  const m2 = identifierMessage('TEXTE-A-NE-PAS-PERSISTER', { nouvelId: gen() });
  await observer(m2);
  assert.equal(JSON.stringify(await lignes(magasin)).includes('TEXTE-A-NE-PAS-PERSISTER'), false);
});
test('B8. le texte ne change pas le résultat : "", "123", JSON → même ensemble de possibilités (hors identité)', async () => {
  const vus = [];
  for (const texte of ['', '123', '{"a":1}', 'une phrase']) {
    const { magasin, observer } = banc();
    await observer(identifierMessage(texte, { nouvelId: gen() }));
    const [l] = await lignes(magasin);
    vus.push(JSON.stringify([l.operationsExaminees, l.possibilites.map((a) => [a.operation, a.entree])]));
  }
  assert.equal(new Set(vus).size, 1);
});
test('B9. ÉCHEC DE CONSTRUCTION DE DONNÉE : message sans id / id vide / id accesseur → \'echec_donnee\', RIEN écrit, enregistrer jamais appelé', async () => {
  let appels = 0;
  const enregistrer = async () => { appels += 1; };
  for (const message of [{}, { id: '' }, { id: 3 }, { get id() { return 'x'; } }]) assert.equal(await observer0(message, { enregistrer }), 'echec_donnee');
  assert.equal(appels, 0);
});
test('B10. ÉCHEC DE CALCUL : descriptions invalides / noms dupliqués → \'echec_calcul\', RIEN écrit (jamais une ligne vide)', async () => {
  let appels = 0;
  const enregistrer = async () => { appels += 1; };
  const message = identifierMessage('x', { nouvelId: gen() });
  for (const descriptions of [[{ nom: 'cassee' }], [desc('d', {}), desc('d', {})], [null], 'pas un tableau']) {
    assert.equal(await observer0(message, { enregistrer, descriptions }), 'echec_calcul');
  }
  assert.equal(appels, 0, 'aucune observation vide écrite après un échec de calcul');
});
test('B11. ÉCHEC D\'ÉCRITURE : enregistrer lève / rejette / absent → \'echec_ecriture\', aucune exception ne sort', async () => {
  const message = identifierMessage('x', { nouvelId: gen() });
  assert.equal(await observer0(message, { enregistrer: async () => { throw new Error('disque plein'); } }), 'echec_ecriture');
  assert.equal(await observer0(message, { enregistrer: () => { throw new Error('sync'); } }), 'echec_ecriture');
  assert.equal(await observer0(message, {}), 'echec_ecriture');
  assert.equal(await observer0(message), 'echec_ecriture');
});
test('B12. message absent (identité non créée) → \'sans_message\', rien écrit', async () => {
  let appels = 0;
  for (const message of [null, undefined, 'texte', 3]) assert.equal(await observer0(message, { enregistrer: async () => { appels += 1; } }), 'sans_message');
  assert.equal(appels, 0);
});
test('B13. les trois échecs sont distincts et la valeur rendue est l\'une des cinq chaînes documentées', async () => {
  const message = identifierMessage('x', { nouvelId: gen() });
  const etats = new Set([
    await observer0(message, { enregistrer: async () => ({}) }), // v0.63.24 : un enregistreur doit rendre la ligne écrite
    await observer0({}, { enregistrer: async () => {} }),
    await observer0(message, { enregistrer: async () => {}, descriptions: [null] }),
    await observer0(message, { enregistrer: async () => { throw new Error('x'); } }),
    await observer0(null, { enregistrer: async () => {} }),
  ]);
  assert.deepEqual([...etats].sort(), ['echec_calcul', 'echec_donnee', 'echec_ecriture', 'ecrite', 'sans_message']);
});
test('B14. appel unique de enregistrer, avec exactement les cinq champs métier (sans id ni horodatage : posés par l\'écriture)', async () => {
  const recus = [];
  await observer0(identifierMessage('x', { nouvelId: gen() }), { enregistrer: async (d) => { recus.push(d); } });
  assert.equal(recus.length, 1);
  assert.deepEqual(Object.keys(recus[0]), ['idMessage', 'donneesExaminees', 'operationsExaminees', 'possibilites']);
});

// ============================================================================ C. ORDRE TEMPOREL DANS LE TOUR
function bancTour({ resultat = { texte: 'ok' }, erreurObservation = null, observationLente = false, avecObservation = true } = {}) {
  const journal = [];
  const deps = {
    nouvelId: (p) => { journal.push('identification'); return `${p}-t-${journal.length}`; },
    enregistrerEnonce: async () => { journal.push('capture'); },
    traiter: async (message) => { journal.push('traitement'); journal.messageTraite = message; return resultat; },
  };
  if (avecObservation) {
    deps.observerPossibilites = async (message) => {
      journal.push('observation:debut'); journal.messageObserve = message;
      if (observationLente) await new Promise((r) => setTimeout(r, 15));
      if (erreurObservation) { journal.push('observation:echec'); throw erreurObservation; }
      journal.push('observation:fin');
    };
  }
  return { journal, deps };
}
test('C1. ORDRE : ENVOI → identification → observation → capture d\'énoncé → traitement (réponse à une trace)', async () => {
  const b = bancTour();
  await traiterTourAvecEnonce('suite', { idTrace: 'trace-1' }, b.deps);
  assert.deepEqual(b.journal.filter((x) => typeof x === 'string'), ['identification', 'observation:debut', 'observation:fin', 'capture', 'traitement']);
});
test('C2. ORDRE sans référence de trace (voie ordinaire, marqueurs, rejeu… : un seul site d\'appel) : identification → observation → traitement', async () => {
  const b = bancTour();
  await traiterTourAvecEnonce('bonjour', null, b.deps);
  assert.deepEqual(b.journal.filter((x) => typeof x === 'string'), ['identification', 'observation:debut', 'observation:fin', 'traitement']);
});
test('C3. l\'observation est ATTENDUE jusqu\'au bout avant la capture et le traitement (même lente)', async () => {
  const b = bancTour({ observationLente: true });
  await traiterTourAvecEnonce('suite', { idTrace: 'trace-1' }, b.deps);
  assert.deepEqual(b.journal.filter((x) => typeof x === 'string'), ['identification', 'observation:debut', 'observation:fin', 'capture', 'traitement']);
});
test('C4. observation et traitement reçoivent LE MÊME objet message ; le texte est inchangé', async () => {
  const b = bancTour();
  await traiterTourAvecEnonce('  texte  tel quel ', null, b.deps);
  assert.equal(b.journal.messageObserve, b.journal.messageTraite);
  assert.equal(b.journal.messageTraite.texte, '  texte  tel quel ');
});
test('C5. une observation qui lève ou rejette ne bloque JAMAIS le tour : capture et traitement ont lieu, résultat identique', async () => {
  const sans = bancTour({ avecObservation: false });
  const r0 = await traiterTourAvecEnonce('suite', { idTrace: 'trace-1' }, sans.deps);
  const echec = bancTour({ erreurObservation: new Error('boum') });
  const r1 = await traiterTourAvecEnonce('suite', { idTrace: 'trace-1' }, echec.deps);
  assert.deepEqual(r1, r0);
  assert.deepEqual(echec.journal.filter((x) => typeof x === 'string'), ['identification', 'observation:debut', 'observation:echec', 'capture', 'traitement']);
  const synchrone = bancTour();
  synchrone.deps.observerPossibilites = () => { throw new Error('sync'); };
  assert.deepEqual(await traiterTourAvecEnonce('suite', null, synchrone.deps), r0);
});
test('C6. NON-INFLUENCE : avec ou sans observation, même résultat, même traitement, mêmes arguments (une seule valeur : le message)', async () => {
  const resultat = { texte: 'réponse', actions: [{ a: 1 }], idTrace: 't' };
  const a = bancTour({ avecObservation: false, resultat }); const b = bancTour({ resultat });
  const ra = await traiterTourAvecEnonce('x', null, a.deps); const rb = await traiterTourAvecEnonce('x', null, b.deps);
  assert.deepEqual(rb, ra);
  assert.equal(a.journal.messageTraite.texte, b.journal.messageTraite.texte);
});
test('C7. erreur de traitement : se propage telle quelle, l\'observation a bien eu lieu avant', async () => {
  const b = bancTour(); const erreur = new Error('traitement');
  b.deps.traiter = async () => { b.journal.push('traitement'); throw erreur; };
  await assert.rejects(() => traiterTourAvecEnonce('x', null, b.deps), (e) => e === erreur);
  assert.deepEqual(b.journal.filter((x) => typeof x === 'string'), ['identification', 'observation:debut', 'observation:fin', 'traitement']);
});
test('C8. observateur facultatif : absent → comportement de v0.63.14 inchangé (aucun appel)', async () => {
  const b = bancTour({ avecObservation: false });
  await traiterTourAvecEnonce('x', null, b.deps);
  assert.deepEqual(b.journal.filter((x) => typeof x === 'string'), ['identification', 'traitement']);
});
test('C9. sans identité (nouvelId absent) : l\'observateur reçoit null → \'sans_message\', le tour continue', async () => {
  const magasin = magasinMemoireVive();
  const observer = (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
  let recu = 'jamais';
  const deps = { enregistrerEnonce: async () => {}, traiter: async (m) => { recu = m; return { texte: 'ok' }; }, observerPossibilites: observer };
  const r = await traiterTourAvecEnonce('x', null, deps);
  assert.equal(recu, null); assert.deepEqual(r, { texte: 'ok' });
  assert.deepEqual(await lignes(magasin), []);
});
test('C10. le VRAI tenterPontLangage derrière l\'observation : observation écrite AVANT la première analyse (assurerEsprit)', async () => {
  const journal = [];
  const magasin = magasinMemoireVive();
  const deps = {
    nouvelId: gen(),
    observerPossibilites: async (m) => { journal.push('observation'); await observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }); journal.push(`lignes:${(await lignes(magasin)).length}`); },
    enregistrerEnonce: async () => { journal.push('capture'); },
    traiter: async () => tenterPontLangage('Quel est mon nom ?', {
      assurerEsprit: async () => { journal.push('analyse:assurerEsprit'); throw new Error('arret'); },
      journaliser: async () => [1, 2], enregistrerExperience: async () => ({ id: 'e' }), ajouterInterpretation: async () => ({}),
    }),
  };
  await assert.rejects(() => traiterTourAvecEnonce('Quel est mon nom ?', { idTrace: 'trace-1' }, deps), /arret/);
  assert.deepEqual(journal, ['observation', 'lignes:1', 'capture', 'analyse:assurerEsprit']);
});

// ============================================================================ D. MESSAGES RÉELS : une ligne par envoi, rattachée à message.id
function tourReel(magasin, identifiants = gen()) {
  const traces = [];
  return {
    traces,
    envoyer: (texte, ref = null) => traiterTourAvecEnonce(texte, ref, {
      nouvelId: identifiants,
      observerPossibilites: (message) => observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }),
      enregistrerEnonce: (idTrace, texteEnonce) => enregistrerEnonceSurTrace(magasin, { idTrace, texte: texteEnonce, origine: 'interface' }),
      traiter: async (message) => { traces.push(message); return { texte: 'ok' }; },
    }),
  };
}
test('D1. un envoi = une ligne ; deux envois du même texte = deux lignes, deux idMessage distincts', async () => {
  const magasin = magasinMemoireVive(); const t = tourReel(magasin);
  await t.envoyer('même texte');
  assert.equal((await lignes(magasin)).length, 1);
  await t.envoyer('même texte');
  const ls = await lignes(magasin);
  assert.equal(ls.length, 2);
  assert.notEqual(ls[0].idMessage, ls[1].idMessage);
  assert.deepEqual(ls.map((l) => l.idMessage).sort(), t.traces.map((m) => m.id).sort());
});
test('D2. aucun envoi (brouillon, vide) : aucune ligne', async () => {
  const magasin = magasinMemoireVive(); tourReel(magasin);
  assert.deepEqual(await lignes(magasin), []);
});
test('D3. RÉPONSE À UNE TRACE : ligne rattachée à message.id (≠ enonce.id), écrite AVANT l\'énoncé', async () => {
  const magasin = magasinMemoireVive();
  const ordre = [];
  const ecrire = magasin.ecrire.bind(magasin);
  magasin.ecrire = async (table, objet) => { ordre.push(table); return ecrire(table, objet); };
  const t = tourReel(magasin);
  await t.envoyer('ma réponse', { idTrace: 'trace-7' });
  assert.deepEqual(ordre.filter((x) => x === T || x === 'enonces'), [T, 'enonces']);
  const [l] = await lignes(magasin); const [e] = await magasin.lireTout('enonces');
  assert.equal(l.idMessage, t.traces[0].id);
  assert.notEqual(l.idMessage, e.id); assert.notEqual(l.id, e.id);
  assert.equal(e.idTrace, 'trace-7');
  assert.equal(JSON.stringify(l).includes('ma réponse'), false);
});
test('D4. le message n\'est pas persisté : seule la table des observations de possibilités reçoit une écriture pour un envoi ordinaire', async () => {
  const magasin = magasinMemoireVive(); const ecrites = [];
  const ecrire = magasin.ecrire.bind(magasin);
  magasin.ecrire = async (table, objet) => { ecrites.push(table); return ecrire(table, objet); };
  await tourReel(magasin).envoyer('bonjour');
  assert.deepEqual(ecrites, [T]);
});
test('D5. clavier et voix passent par le même chemin : une dictée envoyée donne la même forme de ligne qu\'une saisie', async () => {
  const magasin = magasinMemoireVive(); const t = tourReel(magasin);
  await t.envoyer('saisie clavier'); await t.envoyer('texte dicté puis envoyé');
  const ls = await lignes(magasin);
  const forme = (l) => JSON.stringify([Object.keys(l), l.operationsExaminees, l.possibilites.map((a) => [a.operation, a.entree])]);
  assert.equal(forme(ls[0]), forme(ls[1]));
});

// ============================================================================ E. SAUVEGARDE / RESTAURATION / MIGRATION
async function etat() {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  const reel = await enregistrerObservationPossibilites(magasinLangage, { idMessage: 'message-1', donneesExaminees: ['message-1'], operationsExaminees: NOMS_CATALOGUE, possibilites: [{ donnee: 'message-1', operation: 'parcourirStructure', entree: 'valeur' }] });
  const zero = await enregistrerObservationPossibilites(magasinLangage, { idMessage: 'message-2', donneesExaminees: ['message-2'], operationsExaminees: ['x'], possibilites: [] });
  await magasinLangage.ecrire('journal', { id: 'j1', texte: 'ancien' });
  return { memoire, magasinLangage, reel, zero };
}
async function enSchema(fichier, schema, sansTables = []) {
  const f = JSON.parse(fichier.contenu); f.schema = schema;
  for (const t of sansTables) delete f.donnees.langage[t];
  f.empreinte = await empreinte(JSON.stringify(f.donnees)); return f;
}
test('E1. migration 14 → 17 (IndexedDB simulée) : crée SEULEMENT les magasins manquants (celui-ci + executionsOperations + designations), aucune donnée existante touchée', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.22 : la table designations (schéma 7, base 17) s'ajoute ; ce test reste le garant de SA table
  const existants = TABLES.filter((t) => t !== T && t !== 'executionsOperations' && t !== 'designations');
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
  assert.equal(nom, NOM_BASE); assert.equal(version, 18);
  assert.deepEqual(crees, [[T, 'id'], ['executionsOperations', 'id'], ['designations', 'id']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});
test('E2. export : la nouvelle sauvegarde (schéma 7) contient les lignes, y compris la liste vide, à l\'identique', async () => {
  const { memoire, magasinLangage, reel, zero } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.16', maintenant });
  assert.equal(fichier.objet.schema, 8); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : la table designations (schéma 7, base 17) s'ajoute ; ce test reste le garant de SA table
  assert.deepEqual(fichier.objet.donnees.langage[T].map((l) => l.id).sort(), [reel.id, zero.id].sort());
  assert.deepEqual(fichier.objet.donnees.langage[T].find((l) => l.id === zero.id).possibilites, []);
});
test('E3. aller-retour complet : import → restauration identique (liste vide préservée), empreinte valide', async () => {
  const { memoire, magasinLangage, reel, zero } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.16', maintenant });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  const neuf = magasinMemoireVive();
  await neuf.ecrire(T, { id: 'residu', idMessage: 'x', horodatage: 'x', donneesExaminees: [], operationsExaminees: [], possibilites: [] });
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lu.donnees });
  const apres = await neuf.lireTout(T);
  assert.deepEqual(apres.sort((a, b) => (a.id < b.id ? -1 : 1)), [reel, zero].sort((a, b) => (a.id < b.id ? -1 : 1)));
  assert.deepEqual(apres.find((l) => l.id === zero.id).possibilites, []);
  assert.deepEqual(await neuf.lireTout('journal'), [{ id: 'j1', texte: 'ancien' }]);
});
test('E4. ANCIENNES sauvegardes (schémas 1 à 5, sans la table) : importables, table VIDE, aucune reconstruction rétroactive', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.15', maintenant });
  for (const schema of [1, 2, 3, 4, 5]) {
    const ancienne = await enSchema(fichier, schema, [T, 'executionsOperations', 'designations']); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : la table designations (schéma 7, base 17) s'ajoute ; ce test reste le garant de SA table
    const lu = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
    assert.equal(lu.ok, true, `schéma ${schema} : ${lu.erreur}`);
    assert.deepEqual(lu.donnees.langage[T], []);
    assert.deepEqual(lu.donnees.langage.journal, [{ id: 'j1', texte: 'ancien' }]);
  }
});
test('E5. schéma courant (8) STRICT : sans la table = refus « incomplet » ; schéma futur (9) = refus « plus récente »', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.16', maintenant });
  const incomplet = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 8, [T])), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(incomplet.ok, false); assert.match(incomplet.erreur, /incomplet.*observationsPossibilites/);
  const futur = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 9)), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(futur.ok, false); assert.match(futur.erreur, /plus récente/);
});
test('E6. migrerDonnees : complète par [] pour un schéma < 7 seulement, ne fabrique jamais de ligne', () => {
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 4)[T], []);
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 5)[T], []);
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 6)[T], []); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : la table designations (schéma 7, base 17) s'ajoute ; ce test reste le garant de SA table
  assert.equal(Object.prototype.hasOwnProperty.call(migrerDonnees({ faits: [] }, [T], 8), T), false);
});

// ============================================================================ F. GARDES STATIQUES / DORMANCE DÉCISIONNELLE
test('F1. main.js : câblage exact — import de l\'observateur et de l\'écriture réelle, injection dans traiterTourAvecEnonce, rien d\'autre', () => {
  assert.match(MAIN_CODE, /^import \{ observerPossibilites \} from '\.\/langage\/observation-possibilites\.js';$/m);
  assert.match(MAIN_CODE, /enregistrerObservationPossibilites as enregistrerObservationPossibilitesReelle/);
  assert.equal((MAIN_CODE.match(/observerPossibilites\(/g) || []).length, 1, 'un seul appel dans main.js');
  assert.equal((MAIN_CODE.match(/enregistrerObservationPossibilitesReelle\(/g) || []).length, 1);
  assert.match(MAIN_CODE, /observerPossibilites: \(message\) => observerPossibilites\(message, \{\s*enregistrer: async \(donnees\) => \{\s*const e = await ecranLangage\.assurerEsprit\(\);\s*return enregistrerObservationPossibilitesReelle\(e\.magasin, donnees\);\s*\},\s*lireExecutions: async \(\) => \{\s*const e = await ecranLangage\.assurerEsprit\(\);\s*return e\.magasin\.lireTout\('executionsOperations'\);\s*\},\s*\}\),/); // MISE À JOUR DÉLIBÉRÉE v0.63.24
  assert.equal(/possibilitesDeLiaison|donneeDeSource|DESCRIPTION_SOURCE_MESSAGE|DESCRIPTIONS_OPERATIONS|productionsDecrites/.test(MAIN_CODE), false);
});
test('F2. pont.js : l\'observation est entre l\'identité et la capture, dans un try/catch muet, sans importer l\'observateur', () => {
  const debut = PONT_CODE.indexOf('export async function traiterTourAvecEnonce(');
  const corps = PONT_CODE.slice(debut, PONT_CODE.indexOf('\n}\n', debut));
  assert.ok(corps.indexOf('identifierMessage(') < corps.indexOf('await observerPossibilites(message)'));
  assert.ok(corps.indexOf('await observerPossibilites(message)') < corps.indexOf('capturerEnonceAvantTraitement('));
  assert.match(corps, /try \{ await observerPossibilites\(message\); \} catch \{ \/\* observation : jamais bloquante \*\/ \}/);
  assert.equal(/observation-possibilites|possibilites-liaison|donnee-de-source|descriptions-operations/.test(PONT_CODE), false);
});
test('F3. observation-possibilites.js : imports exacts (les six modules, v0.63.24), aucun texte lu, aucune mémoire, aucune décision', () => {
  assert.deepEqual(OBS_CODE.match(/^\s*import\b[^;]*;/gm).map((l) => l.trim()), [
    "import { donneeDeSource } from './donnee-de-source.js';",
    "import { DESCRIPTION_SOURCE_MESSAGE } from './source-message.js';",
    "import { possibilitesDeLiaison } from './possibilites-liaison.js';",
    "import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';",
    "import { productionsDecrites } from './productions-decrites.js';",
    "import { ACCES_TRACE } from './acces-trace.js';",
  ]);
  assert.equal(/\.texte|texte\b|localStorage|indexedDB|connaissances|magasin|ecrire|lireTout|score|choisir|executer|switch|Date\b|nouvelId|Math\.random/.test(OBS_CODE), false);
  assert.equal(/formes-operation|garantie-forme|fournieGarantitAttendue|validerDescripteurOperation|relations-parent-enfant/.test(OBS_CODE), false, 'aucune logique de forme ni production recopiée');
});
test('F4. le seul importeur de observation-possibilites.js est main.js ; aucun autre fichier de production ne le nomme', () => {
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => rel(f) !== 'app/langage/observation-possibilites.js' && /observation-possibilites\.js|observerPossibilites/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(importeurs, ['app/langage/pont.js', 'app/main.js'], 'pont.js : paramètre injecté seulement ; main.js : seul importeur');
  for (const autre of ['app/sw.js', 'sw.js', 'worker.js', 'index.html', 'app/index.html']) { let s = ''; try { s = lu(autre); } catch { continue; } assert.equal(/observation-possibilites/.test(s), false, autre); }
});
test('F5. AUCUN CONSOMMATEUR : seule connaissances.js (déclaration + écriture) nomme la table ; personne ne la lit pour décider', () => {
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => /observationsPossibilites/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(nommant, ['app/langage/connaissances.js']);
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  assert.equal((conn.match(/observationsPossibilites/g) || []).length, 3, 'TABLES, CLE, écriture');
  assert.equal(/lireTout\('observationsPossibilites'\)/.test(conn), false);
});
test('F6. le catalogue est inchangé : 9 descriptions, relationsParentEnfant HORS catalogue ; CAPACITES inchangée', async () => {
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 9);
  assert.equal(NOMS_CATALOGUE.includes('relationsParentEnfant'), false);
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
});
test('F7. aucune production d\'opération fabriquée ni lecteur de traces ajouté : productionsDecrites et tables de traces non lues', () => {
  assert.equal(/'traces'|"traces"|CAPACITES|valeurDePorteur|acces-valeur/.test(OBS_CODE), false); // v0.63.24 : productionsDecrites + ACCES_TRACE autorisés, jamais la valeur
});
test('F8. l\'écriture ne dépend que de nouvelId et de l\'horloge d\'écriture ; aucun texte/forme dans le code de la fonction d\'écriture', () => {
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  const debut = conn.indexOf('export async function enregistrerObservationPossibilites(');
  const corps = conn.slice(debut, conn.indexOf('\n}\n', debut));
  assert.match(corps, /id: nouvelId\('observation-possibilites'\),/);
  assert.match(corps, /horodatage: new Date\(\)\.toISOString\(\),/);
  assert.equal(/texte|forme|score|choix/.test(corps), false);
});
// === FIN_TEST_OBSERVATIONS_POSSIBILITES ===
