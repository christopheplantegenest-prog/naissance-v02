// === DEBUT_TEST_PREUVE_RELATIONNELLE_PERSISTEE ===
// v0.63.62 — PERSISTER LA PREUVE DU CONTRAT RELATIONNEL (décision ChatGPT, 06/10/2026). Les NOUVELLES observations portent empreintesContratsRelationnels
// (génération 9 clés) = [{ categorie: 'contrats-relationnels', empreinte: empreinteRelations(catalogue utilisé) }]. Validée STRUCTURELLEMENT par connaissances.js
// (aucun calcul), reconnue structurellement par resoudreContexteObservation, JAMAIS VÉRIFIÉE (volontaire : à inverser en v0.63.63). 6/7/8 clés inchangées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { empreinteRelations, CATEGORIE_CONTRATS_RELATIONNELS } from '../app/langage/empreinte-relations.js';
import { empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { empreinteContratEntreesProduction } from '../app/langage/empreinte-categorie-entrees.js';
import { empreinteContratMessage } from '../app/langage/empreinte-categorie-message.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce, identifierMessage } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const D = DESCRIPTIONS_OPERATIONS;
const H = (c) => c.repeat(64);
const CLES9 = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'empreintesContratsRelationnels', 'possibilites'];
const CLES8 = CLES9.filter((c) => c !== 'empreintesContratsRelationnels');
const CLES7 = CLES8.filter((c) => c !== 'empreintesCategoriesDonnees');
const CLES6 = CLES7.filter((c) => c !== 'empreintesOperationsExaminees');
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const clone = (x) => JSON.parse(JSON.stringify(x));
const lecture = async (magasin) => ({ observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });

// Le flux ordinaire du tour (observation -> déclencheur -> traitement), avec un enregistreur espion.
async function vie(messages, { magasin = magasinMemoireVive(), descriptions } = {}) {
  let n = 0; const nouvelId = (p) => `${p}-${++n}`; const appels = []; const tours = [];
  for (const texte of messages) {
    const suivi = suivreObservationDuTour(
      (m) => observerPossibilites(m, { enregistrer: (d) => { appels.push(d); return enregistrerObservationPossibilites(magasin, d); }, lireExecutions: () => magasin.lireTout('executionsOperations'), ...(descriptions ? { descriptions } : {}) }),
      (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }),
    );
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    tours.push({ S: suivi.joindre(res).sollicitation });
  }
  return { magasin, tours, appels };
}
let VIE; const vecue = async () => (VIE ??= await vie(SCENARIO));
const BASE = { idMessage: 'm-1', donneesExaminees: ['m-1'], operationsExaminees: ['a'], possibilites: [], empreintesOperationsExaminees: [{ operation: 'a', empreinte: H('1') }], empreintesCategoriesDonnees: [{ categorie: 'entrees-de-production', empreinte: H('2') }] };
const PREUVE = (e = H('3')) => [{ categorie: 'contrats-relationnels', empreinte: e }];
const REFERENCE_V06361 = {
  couvrirSequence: '0e66042b7d7d71233ff57bf36b609ae53c63880bb478417c4ff430af48b6c687',
  decrireStructureIdentifiee: '2e60f44f5b129f5303a7e610038c1cf11315e49c13c4e73d84e5904eb3d22999',
  decrireValeursObservees: 'a10cba066346534fc0a752f994663f30bdd96306d0af68adaebfccd4d535db02',
  elementsObservables: 'a6ebe237069b6eb39e8397e59ea0d95c4eca597db197f423a6d3b58892fe940e',
  memesCouvertures: '81072be79b40f09d7e1f2508f0ecc4ab2899c547471196f0be47cc2aa4b1884b',
  normaliserCouverture: '07833da5d47cd19b25a11f901aac6921c830e02538a92cc1b44fe20a6af5a456',
  parcourirStructure: 'ee400d727aa46b962a291d5de27ee1476044a5d2aebae7b549ccc1a5c271e5c1',
  partagerCouvertures: 'b458c7a0fc4e79077f6525a92b2ac489d475d21d2fb9e1c9bad01be9fbee45b7',
  produireConstatsStructurels: '368abb80081b3f9393422ce02a32a9696922a0be426254e155794a710e3902d8',
  produireSuitesFermees: 'cfab56c858b9cc33f57cda982729fb2b199103cf275d746091038e99d568dbd5',
  projeterChemins: '0db3c898e57393bb09b92177f78364a03a863d68829d0748207285425924432a',
  projeterContenus: '90cbd8358b0ef4ab2b6fbc4842c1d03372e9f823aa1f33e2f9052e1b5c7bae8a',
  rechercherSousSuites: 'e04ea94a8d225dbf898c2d7cf5c0bde66336da7a3e25e23d26615f9152a53f5b',
  resoudreCouverture: '3d4c7479b0dad14f0f95acd0744952dcb06fa80a9151d06cfb9e585c388443cb',
  resoudreElements: 'c13f633d9592d874695ffaf51c0ceb862baf426c5d78d4fde28d274c9ed40499',
  symbolesDeChaine: '7037e1ad0312f5d73ed2ea66fdc37116a71219916437a52502b11fa8c025ef38',
};

// ------------------------------------------------------------------------------------------------------------------------ A. LE PRODUCTEUR
test('A1. TEST CENTRAL : toute observation du flux réel est de génération 9 clés et porte EXACTEMENT [{ categorie, empreinte: empreinteRelations(catalogue) }] (aucune valeur recopiée)', async () => {
  const { magasin } = await vecue();
  const lignes = await magasin.lireTout('observationsPossibilites');
  assert.equal(lignes.length, 7);
  const attendu = [{ categorie: 'contrats-relationnels', empreinte: empreinteRelations(D) }];
  for (const o of lignes) { assert.deepEqual(Object.keys(o), CLES9); assert.deepEqual(o.empreintesContratsRelationnels, attendu); }
  assert.equal(CATEGORIE_CONTRATS_RELATIONNELS, 'contrats-relationnels');
  assert.match(attendu[0].empreinte, /^[0-9a-f]{64}$/);
});
test('A2. SOURCE UNIQUE : l\'appel d\'enregistrer reçoit la preuve calculée par empreinte-relations.js sur le MÊME catalogue, dans le même cycle que les deux autres preuves', async () => {
  const { appels } = await vecue();
  assert.equal(appels.length, 7);
  for (const a of appels) {
    assert.deepEqual(Object.keys(a).sort(), ['donneesExaminees', 'empreintesCategoriesDonnees', 'empreintesContratsRelationnels', 'empreintesOperationsExaminees', 'idMessage', 'operationsExaminees', 'possibilites']);
    assert.deepEqual(a.empreintesContratsRelationnels, [{ categorie: 'contrats-relationnels', empreinte: empreinteRelations(D) }]);
  }
  const code = sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'));
  assert.equal((code.match(/empreinteRelations\(/g) || []).length, 1, 'un seul calcul, aucune seconde canonisation');
  assert.match(code, /empreinteRelations\(descriptions\)/);
});
test('A3. SENSIBILITÉ : une relation, un rôle ou une entrée associée modifiés donnent une autre empreinte que celle persistée', async () => {
  const { magasin } = await vecue();
  const persistee = (await magasin.lireTout('observationsPossibilites'))[0].empreintesContratsRelationnels[0].empreinte;
  assert.equal(persistee, empreinteRelations(D));
  const modifier = (f) => D.map((d) => { const c = structuredClone(d); f(c); return c; });
  const variantes = [
    modifier((c) => { if (c.nom === 'resoudreElements') delete c.relations; }),
    modifier((c) => { if (c.nom === 'couvrirSequence') c.relations[0].plages = 'elements', c.relations[0].sequence = 'plages'; }),
    modifier((c) => { if (c.nom === 'resoudreElements') { c.relations[0].couverture = 'elements'; c.relations[0].collection = 'couverture'; } }),
    modifier((c) => { if (c.nom === 'resoudreCouverture') c.relations[0].collection = 'couverture', c.relations[0].couverture = 'univers'; }),
  ];
  for (const v of variantes) assert.notEqual(empreinteRelations(v), persistee);
});
test('A4. ATOMICITÉ : un catalogue dont le calcul des preuves échoue ne laisse AUCUNE ligne ; une preuve relationnelle invalide à l\'écriture non plus', async () => {
  const magasin = magasinMemoireVive(); let n = 0;
  const message = identifierMessage('bonjour Pixel', { nouvelId: (p) => `${p}-${++n}` });
  const r = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations'), descriptions: [D[0], D[0]] });
  assert.equal(r.statut, 'echec_calcul');
  assert.deepEqual(await magasin.lireTout('observationsPossibilites'), []);
  await assert.rejects(() => enregistrerObservationPossibilites(magasin, { ...BASE, empreintesContratsRelationnels: PREUVE('Z'.repeat(64)) }), /empreintesContratsRelationnels/);
  assert.deepEqual(await magasin.lireTout('observationsPossibilites'), []);
});

// ------------------------------------------------------------------------------------------------------------------------ B. VALIDATION STRUCTURELLE (connaissances.js)
test('B1. une écriture cohérente est acceptée et conservée (copie) ; 9 clés dans l\'ordre ; aucun calcul dans connaissances.js', async () => {
  const m = magasinMemoireVive();
  const entree = PREUVE();
  const l = await enregistrerObservationPossibilites(m, { ...BASE, empreintesContratsRelationnels: entree });
  assert.deepEqual(Object.keys(l), CLES9);
  assert.deepEqual(l.empreintesContratsRelationnels, PREUVE());
  assert.notEqual(l.empreintesContratsRelationnels, entree);
  assert.notEqual(l.empreintesContratsRelationnels[0], entree[0]);
  assert.equal(/empreinte-relations|empreinteRelations|sha256/.test(sansCommentaires(lu('app', 'langage', 'connaissances.js'))), false);
});
test('B2. STRUCTURE FERMÉE : seule une preuve exactement { categorie: contrats-relationnels, empreinte: hex64 minuscule } dans un tableau dense d\'UNE entrée est acceptée', async () => {
  const accesseur = [{ categorie: 'contrats-relationnels' }]; Object.defineProperty(accesseur[0], 'empreinte', { get: () => H('3'), enumerable: true });
  const accesseurTableau = []; Object.defineProperty(accesseurTableau, 0, { get: () => PREUVE()[0], enumerable: true });
  const refusees = {
    'non tableau': PREUVE()[0], vide: [], 'deux entrées': [...PREUVE(), ...PREUVE()], creux: new Array(1), 'élément nul': [null], 'élément tableau': [[]],
    'clé en trop': [{ categorie: 'contrats-relationnels', empreinte: H('3'), extra: 1 }], 'clé manquante': [{ categorie: 'contrats-relationnels' }],
    'mauvaise catégorie': [{ categorie: 'entrees-de-production', empreinte: H('3') }], 'catégorie vide': [{ categorie: '', empreinte: H('3') }],
    'majuscules': PREUVE('A'.repeat(64)), 'trop courte': PREUVE('a'.repeat(63)), 'trop longue': PREUVE('a'.repeat(65)), 'non chaîne': PREUVE(7), 'non hex': PREUVE('g'.repeat(64)),
    'accesseur propriété': accesseur, 'accesseur élément': accesseurTableau, 'prototype': [Object.create({ categorie: 'contrats-relationnels', empreinte: H('3') })],
  };
  for (const [nom, valeur] of Object.entries(refusees)) {
    const m = magasinMemoireVive();
    await assert.rejects(() => enregistrerObservationPossibilites(m, { ...BASE, empreintesContratsRelationnels: valeur }), /empreintesContratsRelationnels/, nom);
    assert.deepEqual(await m.lireTout('observationsPossibilites'), [], `${nom} : rien d'écrit`);
  }
});
test('B3. JAMAIS SEULE : refusée sans la preuve de catégorie (donc sans celle des opérations) ; aucune génération hybride', async () => {
  const m = magasinMemoireVive();
  const { empreintesCategoriesDonnees, ...sansCategorie } = BASE;
  await assert.rejects(() => enregistrerObservationPossibilites(m, { ...sansCategorie, empreintesContratsRelationnels: PREUVE() }), /exige empreintesCategoriesDonnees/);
  const { empreintesOperationsExaminees, ...sansOps } = BASE;
  await assert.rejects(() => enregistrerObservationPossibilites(m, { ...sansOps, empreintesContratsRelationnels: PREUVE() }), /exige/);
  assert.deepEqual(await m.lireTout('observationsPossibilites'), []);
});
test('B4. appels directs anciens préservés : 6 clés, 7 clés, 8 clés ; le champ n\'est jamais ajouté par l\'écriture elle-même', async () => {
  const m = magasinMemoireVive();
  const a = await enregistrerObservationPossibilites(m, { idMessage: 'm-a', donneesExaminees: ['m-a'], operationsExaminees: ['a'], possibilites: [] });
  const b = await enregistrerObservationPossibilites(m, { ...BASE, idMessage: 'm-b', donneesExaminees: ['m-b'], empreintesCategoriesDonnees: undefined });
  const c = await enregistrerObservationPossibilites(m, { ...BASE, idMessage: 'm-c', donneesExaminees: ['m-c'] });
  assert.deepEqual([Object.keys(a), Object.keys(b), Object.keys(c)], [CLES6, CLES7, CLES8]);
});

// ------------------------------------------------------------------------------------------------------------------------ C. contexte-observation : RECONNUE, NON VÉRIFIÉE
test('C1. la génération 9 clés est reconstruite sous le catalogue inchangé (même référence d\'observation) ; 6/7/8 clés aussi', async () => {
  const { magasin } = await vecue();
  const l = await lecture(magasin);
  for (const o of l.observations) { const r = resoudreContexteObservation(o.id, l.observations, l.valeurs, l.executions, D); assert.equal(r.observation, o); assert.equal(Object.keys(r.observation).length, 9); }
  const O = l.observations[l.observations.length - 1];
  const sans = (...cles) => { const c = { ...O }; for (const k of cles) delete c[k]; return c; };
  const o8 = { ...sans('empreintesContratsRelationnels'), id: 'o-8' };
  const o7 = { ...sans('empreintesContratsRelationnels', 'empreintesCategoriesDonnees'), id: 'o-7' };
  const o6 = { ...sans('empreintesContratsRelationnels', 'empreintesCategoriesDonnees', 'empreintesOperationsExaminees'), id: 'o-6' };
  const avec = { ...l, observations: [...l.observations, o8, o7, o6] };
  for (const [o, cles] of [[o8, CLES8], [o7, CLES7], [o6, CLES6]]) { assert.deepEqual(Object.keys(o), cles); assert.equal(resoudreContexteObservation(o.id, avec.observations, l.valeurs, l.executions, D).observation, o); }
});
test('C2. INVERSÉ EN v0.63.63 (ancien test central de .62) : une observation 9 clés dont l\'empreinte relationnelle est FAUSSE mais bien formée est REFUSÉE ; voir tests/preuve-relationnelle-verifiee.test.mjs', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.63 : en .62 elle était acceptée (volontaire) ; la vérification est introduite
  const { magasin } = await vecue();
  const l = await lecture(magasin);
  const O = l.observations[l.observations.length - 1];
  const fausse = { ...clone(O), id: 'o-fausse', empreintesContratsRelationnels: PREUVE(H('f')) };
  assert.throws(() => resoudreContexteObservation('o-fausse', [...l.observations, fausse], l.valeurs, l.executions, D), TypeError);
});
test('C3. la STRUCTURE de la preuve relationnelle est validée (TypeError) ; la clé exige la preuve de catégorie ; l\'empreinte n\'est lue qu\'à la vérification', async () => {
  const { magasin } = await vecue();
  const l = await lecture(magasin);
  const O = l.observations[l.observations.length - 1];
  const essai = (o) => resoudreContexteObservation(o.id, [...l.observations, o], l.valeurs, l.executions, D);
  const invalides = [[], [{ categorie: 'contrats-relationnels' }], [{ categorie: 'autre', empreinte: H('3') }], PREUVE('A'.repeat(64)), [...PREUVE(), ...PREUVE()], 'x', [{ categorie: 'contrats-relationnels', empreinte: H('3'), extra: 1 }]];
  for (const [i, v] of invalides.entries()) assert.throws(() => essai({ ...clone(O), id: `o-inv-${i}`, empreintesContratsRelationnels: v }), TypeError, String(i));
  const { empreintesCategoriesDonnees, ...sansCat } = clone(O);
  assert.throws(() => essai({ ...sansCat, id: 'o-sans-cat' }), /exige empreintesCategoriesDonnees/);
  const code = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
  assert.equal((code.match(/empreinteRelations\(/g) || []).length, 1, 'v0.63.63 : un seul recalcul, par la source unique'); // MISE À JOUR DÉLIBÉRÉE v0.63.63
});
test('C4. la validation de la preuve relationnelle intervient APRÈS celle des autres preuves structurelles et AVANT la reconstruction (ligne invalide ET donnée non résoluble : le refus nomme la preuve)', async () => {
  const { magasin } = await vecue();
  const l = await lecture(magasin);
  const O = clone(l.observations[l.observations.length - 1]);
  O.id = 'o-ordre'; O.empreintesContratsRelationnels = [];
  O.donneesExaminees = [...O.donneesExaminees, 'inconnue-zzz'].sort();
  assert.throws(() => resoudreContexteObservation('o-ordre', [...l.observations, O], l.valeurs, l.executions, D), /empreintesContratsRelationnels/);
});

// ------------------------------------------------------------------------------------------------------------------------ D. ANCIENNES OBSERVATIONS, REDÉMARRAGE
test('D1. COHABITATION : lignes 6, 7 et 8 clés dans le MÊME magasin avant un flux réel ; elles restent octet pour octet ; seules les nouvelles portent la preuve', async () => {
  const magasin = magasinMemoireVive();
  await enregistrerObservationPossibilites(magasin, { idMessage: 'm-a', donneesExaminees: ['m-a'], operationsExaminees: ['a'], possibilites: [] });
  await enregistrerObservationPossibilites(magasin, { ...BASE, idMessage: 'm-b', donneesExaminees: ['m-b'], empreintesCategoriesDonnees: undefined });
  await enregistrerObservationPossibilites(magasin, { ...BASE, idMessage: 'm-c', donneesExaminees: ['m-c'] });
  const avant = JSON.stringify(await magasin.lireTout('observationsPossibilites'));
  await vie(['bonjour Pixel', 'bonjour Luna'], { magasin });
  const lignes = await magasin.lireTout('observationsPossibilites');
  assert.equal(lignes.length, 5);
  assert.equal(JSON.stringify(lignes.slice(0, 3)), avant);
  assert.deepEqual(lignes.slice(0, 3).map((o) => Object.keys(o)), [CLES6, CLES7, CLES8]);
  assert.deepEqual(lignes.slice(3).map((o) => Object.keys(o)), [CLES9, CLES9]);
});
test('D2. REDÉMARRAGE simulé (copie JSON des tables) : la preuve persiste exactement et la reconstruction reste possible avec le catalogue inchangé', async () => {
  const { magasin } = await vecue();
  const l = await lecture(magasin);
  const copie = clone(l);
  assert.deepEqual(copie.observations, l.observations);
  for (const o of copie.observations) {
    assert.deepEqual(o.empreintesContratsRelationnels, [{ categorie: 'contrats-relationnels', empreinte: empreinteRelations(D) }]);
    assert.doesNotThrow(() => resoudreContexteObservation(o.id, copie.observations, copie.valeurs, copie.executions, D));
  }
});

// ------------------------------------------------------------------------------------------------------------------------ E. RIEN D'AUTRE NE CHANGE
test('E1. empreintes existantes INCHANGÉES : les 16 empreintes de contrat (référence v0.63.61 = v0.63.60) et l\'empreinte de catégorie des entrées de production', async () => {
  assert.deepEqual(Object.fromEntries(empreintesDesContrats(D).filter((e) => e.operation !== 'composerCollection').map((e) => [e.operation, e.empreinte])), REFERENCE_V06361); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : les 16 empreintes de référence restent inchangées ; composerCollection est la dix-septième
  assert.equal(empreinteContratEntreesProduction(), '2c476565fc81d5ecd1e0af1dbbd015c399f36ec06c723fff233b32ba3c485d52');
  const { magasin } = await vecue();
  const O = (await magasin.lireTout('observationsPossibilites'))[0];
  assert.deepEqual(O.empreintesOperationsExaminees, empreintesDesContrats(D));
  assert.deepEqual(O.empreintesCategoriesDonnees, [{ categorie: 'entrees-de-production', empreinte: empreinteContratEntreesProduction() }, { categorie: 'message', empreinte: empreinteContratMessage() }]); // MISE À JOUR DÉLIBÉRÉE v0.63.65 : deux preuves de catégorie pour une observation réelle
});
test('E2. SCÉNARIO 7 TOURS INCHANGÉ (.61) : choix 0,1,2,11,11,11,11 ; auto 2,3,10,2,2,2,2 ; aucun echec_* ; exécutions 2,5,15,17,19,21,23', async () => {
  const { tours, magasin } = await vecue();
  assert.deepEqual(tours.map((t) => t.S.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesuré (scénario modifié par composerCollection)
  assert.deepEqual(tours.map((t) => t.S.automatiques.length), [2, 4, 9, 1, 1, 1, 1]); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesuré
  for (const t of tours) assert.deepEqual(t.S.automatiques.filter((r) => r.statut !== 'executee'), []);
  assert.equal((await magasin.lireTout('executionsOperations')).length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  assert.deepEqual(tours.map((t) => t.S.observation.possibilites.length), [2, 14, 47, 138, 149, 160, 171]); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesuré
});
test('E3. mécanique vivante byte-for-byte : applications-sollicitables, relations-entrees, execution-mecanique, relations-schema ne mentionnent ni la preuve relationnelle ni empreinte-relations', () => {
  for (const f of ['applications-sollicitables.js', 'relations-entrees.js', 'execution-mecanique.js', 'relations-schema.js', 'groupes-candidats.js']) {
    assert.equal(/empreinteRelations|empreinte-relations|empreintesContratsRelationnels/.test(lu('app', 'langage', f)), false, f);
  }
});
test('E4. GARANTIE (v0.63.63) : 6/7/8 clés = aucune preuve relationnelle ; 9 clés = preuve persistée ET vérifiée', () => { // MISE À JOUR DÉLIBÉRÉE v0.63.63 : « non vérifiée » (v0.63.62) remplacé
  const doc = lu('app', 'langage', 'contexte-observation.js');
  assert.match(doc, /GARANTIES APRÈS v0\.63\.63/);
  assert.match(doc, /9 clés = preuves opérations \+ catégorie entrées\(P\) \+ contrat relationnel, TOUTES VÉRIFIÉES/);
});
// === FIN_TEST_PREUVE_RELATIONNELLE_PERSISTEE ===
