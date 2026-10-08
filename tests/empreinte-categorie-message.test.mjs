// === DEBUT_TEST_EMPREINTE_CATEGORIE_MESSAGE ===
// v0.63.65 — « ÉTENDRE LA PREUVE DES CATÉGORIES DE DONNÉES À LA SOURCE MESSAGE » (décision ChatGPT, 06/10/2026).
// Le contrat de REPRÉSENTATION de la catégorie message (catégorie, identité observée, forme, accès vivant, accès historique) est une ENTRÉE de plus de empreintesCategoriesDonnees (aucune famille
// de preuves de plus, aucun champ de plus). Deux formats lisibles : ANCIEN [entrées(P)] (8/9 clés historiques, jamais réinterprété) et NOUVEAU [entrées(P), message].
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as module from '../app/langage/empreinte-categorie-message.js';
import { CATEGORIE_MESSAGE, contratMessage, canoniqueContratMessage, empreinteContratMessage } from '../app/langage/empreinte-categorie-message.js';
import { CATEGORIE_ENTREES_PRODUCTION, empreinteContratEntreesProduction, canoniserContratCategorie } from '../app/langage/empreinte-categorie-entrees.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { ACCES_VALEUR_DONNEE } from '../app/langage/valeur-donnee.js';
import { sha256Hex } from '../app/langage/sha256.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const CODE = sansCommentaires(lu('app', 'langage', 'empreinte-categorie-message.js'));
const clone = (v) => JSON.parse(JSON.stringify(v));
const HEX64 = /^[0-9a-f]{64}$/;
const E = () => ({ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: empreinteContratEntreesProduction() });
const M = () => ({ categorie: CATEGORIE_MESSAGE, empreinte: empreinteContratMessage() });
const H = (c) => c.repeat(64);

async function vieUnTour() {
  const magasin = magasinMemoireVive(); let n = 0;
  const message = identifierMessage('bonjour', { nouvelId: (p) => `${p}-${++n}` });
  await enregistrerValeurDonnee(magasin, { id: message.id, valeur: message.texte });
  const r = await observerPossibilites(message, { enregistrer: (o) => enregistrerObservationPossibilites(magasin, o), lireExecutions: () => magasin.lireTout('executionsOperations') });
  assert.equal(r.statut, 'ecrite');
  const l = { observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') };
  return { magasin, observation: r.observation, l };
}
const contexte = (l, id, observationModifiee) => resoudreContexteObservation(id, observationModifiee ? [observationModifiee] : l.observations, l.valeurs, l.executions, DESCRIPTIONS_OPERATIONS);

// ============================================================================ A. LE CONTRAT
test('A1. CONTRAT : { categorie, identite: { sondes }, forme, acces: { vivant, historique } } ; forme et accès LUS dans les sources réelles ; objet NEUF à chaque appel', () => {
  const c = contratMessage();
  assert.deepEqual(Object.keys(c).sort(), ['acces', 'categorie', 'forme', 'identite']);
  assert.equal(c.categorie, 'message'); assert.equal(CATEGORIE_MESSAGE, 'message');
  assert.deepEqual(c.forme, DESCRIPTION_SOURCE_MESSAGE.forme);
  assert.deepEqual(c.acces, { vivant: DESCRIPTION_SOURCE_MESSAGE.acces, historique: ACCES_VALEUR_DONNEE });
  assert.deepEqual(Object.keys(c.identite), ['sondes']);
  assert.deepEqual(c.identite.sondes, [{ id: 'x', identite: 'x' }, { id: '', identite: null }, { id: ' x ', identite: ' x ' }, { id: 'a:b', identite: 'a:b' }, { id: 1, identite: null }]);
  c.forme.genre = 'nombre'; c.acces.vivant.champ = 'z'; c.identite.sondes.pop();
  assert.deepEqual(contratMessage().forme, { forme: 'scalaire', genre: 'chaine' });
  assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_MESSAGE.forme), true);
  assert.notEqual(contratMessage(), contratMessage());
});
test('A2. EMPREINTE : SHA-256 complet (64 hexadécimaux minuscules) de la chaîne canonique ; stable ; différente de celle des entrées de production ; valeur de référence v0.63.65', () => {
  const e = empreinteContratMessage();
  assert.match(e, HEX64);
  assert.equal(e, sha256Hex(canoniqueContratMessage()));
  assert.equal(e, empreinteContratMessage());
  assert.notEqual(e, empreinteContratEntreesProduction());
  assert.equal(e, 'efc082c9d28594129f55ae1c8c0dd64b4e3efe980aa5e7e2cff95d2166d13dcf');
  assert.equal(empreinteContratEntreesProduction(), '2c476565fc81d5ecd1e0af1dbbd015c399f36ec06c723fff233b32ba3c485d52', 'l\'empreinte des entrées de production est INCHANGÉE');
});
test('A3. CANONISATION : ordre de construction sans effet, MÊME canonisation que la catégorie entrées (canoniserContratCategorie), refus des types non canonisables', () => {
  const c = contratMessage();
  const renverse = { acces: c.acces, forme: c.forme, identite: c.identite, categorie: c.categorie };
  assert.equal(canoniserContratCategorie(renverse), canoniqueContratMessage());
  assert.throws(() => canoniserContratCategorie({ ...c, forme: undefined }), TypeError);
});

// ============================================================================ B. CHAQUE ÉLÉMENT DU CONTRAT CHANGE L'EMPREINTE
const VARIANTES = {
  'forme': (c) => { c.forme.genre = 'nombre'; },
  'forme (objet)': (c) => { c.forme = { forme: 'objet' }; },
  'accès vivant': (c) => { c.acces.vivant.champ = 'contenu'; },
  'accès historique': (c) => { c.acces.historique.champ = 'v'; },
  'identité (sonde trim)': (c) => { c.identite.sondes[2].identite = 'x'; },
  'identité (sonde coercition)': (c) => { c.identite.sondes[4].identite = '1'; },
  'identité (sonde vide)': (c) => { c.identite.sondes[1].identite = ''; },
  'catégorie': (c) => { c.categorie = 'messages'; },
  'champ ajouté': (c) => { c.acces.supplement = true; },
};
for (const [nom, derive] of Object.entries(VARIANTES)) {
  test(`B. DÉRIVE « ${nom} » : l'empreinte change`, () => {
    const c = contratMessage(); derive(c);
    const e = sha256Hex(canoniserContratCategorie(c));
    assert.match(e, HEX64);
    assert.notEqual(e, empreinteContratMessage());
  });
}
test('B2. les variantes sont toutes DISTINCTES entre elles et de la référence', () => {
  const vues = new Set([empreinteContratMessage()]);
  for (const derive of Object.values(VARIANTES)) { const c = contratMessage(); derive(c); vues.add(sha256Hex(canoniserContratCategorie(c))); }
  assert.equal(vues.size, 1 + Object.keys(VARIANTES).length);
});

// ============================================================================ C. SOURCE UNIQUE, PAS DE typeof, DORMANCE
test('C1. SOURCE UNIQUE : le module lit DESCRIPTION_SOURCE_MESSAGE, ACCES_VALEUR_DONNEE et donneeDeSource ; il ne recopie AUCUNE constante (ni texte, valeur, scalaire, chaine, champ), n\'emploie aucun typeof, aucune canonisation ni hachage propre', () => {
  assert.deepEqual([...CODE.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./donnee-de-source.js', './empreinte-categorie-entrees.js', './sha256.js', './source-message.js', './valeur-donnee.js']);
  assert.match(CODE, /DESCRIPTION_SOURCE_MESSAGE\.forme/); assert.match(CODE, /DESCRIPTION_SOURCE_MESSAGE\.acces/); assert.match(CODE, /ACCES_VALEUR_DONNEE/); assert.match(CODE, /donneeDeSource\(/);
  for (const copie of ["'texte'", "'valeur'", "'scalaire'", "'chaine'", "'champ'", '"texte"', '"valeur"', 'typeof', 'sha256Hex(JSON', 'createHash', 'crypto']) assert.equal(CODE.includes(copie), false, copie);
  assert.deepEqual(Object.keys(module).sort(), ['CATEGORIE_MESSAGE', 'canoniqueContratMessage', 'contratMessage', 'empreinteContratMessage']);
});
test('C2. PURETÉ : ni horloge, hasard, identité générée, magasin, asynchronisme, état global', () => {
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'setTimeout', 'require(', 'fetch']) assert.equal(CODE.includes(interdit), false, interdit);
});
test('C3. L\'identité de message (génération, préfixe du pont) N\'EST PAS importée : ni pont, ni identifierMessage, ni PREFIXE_MESSAGE ; ni catalogue ni table d\'opérations', () => {
  assert.equal(/pont|identifierMessage|PREFIXE_MESSAGE|descriptions-operations|table-operations/.test(CODE), false);
});
test('C4. AUCUN AUTRE EFFET : pas de table, de migration ni de persistance de plus ; catalogue (16) et table (16) inchangés', () => {
  assert.equal(VERSION_BASE, 22); assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
});

// ============================================================================ D. VÉRIFICATION HISTORIQUE (resoudreContexteObservation)
test('D1. NOUVELLE observation (deux preuves) : lue ; ANCIENNE (une preuve entrées(P)) : lue EXACTEMENT de la même façon (la preuve message n\'est jamais supposée) ; mêmes univers', async () => {
  const { observation, l } = await vieUnTour();
  assert.deepEqual(observation.empreintesCategoriesDonnees, [E(), M()]);
  const nouvelle = contexte(l, observation.id);
  assert.equal(nouvelle.observation, l.observations[0], 'même référence');
  const ancienne = { ...observation, id: 'ancienne', empreintesCategoriesDonnees: [E()] };
  const lAncien = { ...l, observations: [ancienne] };
  const c = contexte(lAncien, 'ancienne');
  assert.deepEqual(c.univers.map((e) => [e.donnee, e.acces]), nouvelle.univers.map((e) => [e.donnee, e.acces]));
});
test('D2. preuve message FAUSSE sur une nouvelle observation -> TypeError AVANT toute reconstruction (même avec des valeurs historiques absentes, l\'erreur est celle de la preuve)', async () => {
  const { observation, l } = await vieUnTour();
  const fausse = { ...observation, empreintesCategoriesDonnees: [E(), { categorie: CATEGORIE_MESSAGE, empreinte: H('c') }] };
  assert.throws(() => resoudreContexteObservation(fausse.id, [fausse], [], [], DESCRIPTIONS_OPERATIONS), /catégorie « message » a changé/);
  const fauxEntrees = { ...observation, empreintesCategoriesDonnees: [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('c') }, M()] };
  assert.throws(() => resoudreContexteObservation(fauxEntrees.id, [fauxEntrees], [], [], DESCRIPTIONS_OPERATIONS), /catégorie « entrees-de-production » a changé/, 'l\'ordre des vérifications : entrées(P) puis message');
  const deux = { ...observation, empreintesCategoriesDonnees: [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('c') }, { categorie: CATEGORIE_MESSAGE, empreinte: H('d') }] };
  assert.throws(() => resoudreContexteObservation(deux.id, [deux], [], [], DESCRIPTIONS_OPERATIONS), /entrees-de-production/);
  assert.ok(contexte(l, observation.id));
});
test('D3. DÉRIVES réelles du contrat message (forme, accès vivant, accès historique, identité) : la ligne portait l\'empreinte du contrat d\'avant -> refus AVANT reconstruction, atomes identiques', async () => {
  const { observation, l } = await vieUnTour();
  for (const [nom, derive] of Object.entries(VARIANTES).filter(([n]) => n !== 'catégorie' && n !== 'champ ajouté')) {
    const c = contratMessage(); derive(c);
    const ligne = { ...observation, empreintesCategoriesDonnees: [E(), { categorie: CATEGORIE_MESSAGE, empreinte: sha256Hex(canoniserContratCategorie(c)) }] };
    assert.deepEqual(ligne.possibilites, observation.possibilites, `${nom} : atomes identiques`);
    assert.throws(() => resoudreContexteObservation(ligne.id, [ligne], [], [], DESCRIPTIONS_OPERATIONS), /catégorie « message » a changé/, nom);
  }
  assert.ok(contexte(l, observation.id));
});
const CAS_REFUSES = {
  'message seul': () => [M()],
  'ordre inversé': () => [M(), E()],
  'entrées(P) dupliquée': () => [E(), E()],
  'message dupliqué': () => [E(), M(), M()],
  'trois entrées': () => [E(), M(), { categorie: 'autre', empreinte: H('a') }],
  'catégorie inconnue': () => [E(), { categorie: 'autre', empreinte: H('a') }],
  'tableau vide': () => [],
  'entrée en trop dans l\'objet': () => [E(), { ...M(), extra: 1 }],
  'clé manquante': () => [E(), { categorie: CATEGORIE_MESSAGE }],
  'empreinte non hexadécimale': () => [E(), { categorie: CATEGORIE_MESSAGE, empreinte: 'z'.repeat(64) }],
  'empreinte en majuscules': () => [E(), { categorie: CATEGORIE_MESSAGE, empreinte: empreinteContratMessage().toUpperCase() }],
  'empreinte trop courte': () => [E(), { categorie: CATEGORIE_MESSAGE, empreinte: 'a'.repeat(63) }],
  'entrée non objet': () => [E(), 'message'],
  'entrée tableau': () => [E(), []],
  'entrée null': () => [E(), null],
  'tableau creux': () => { const t = [E(), M()]; delete t[1]; return t; },
  'accesseur': () => { const t = [E()]; Object.defineProperty(t, 1, { get() { return M(); }, enumerable: true }); return t; },
  'prototype non simple': () => [E(), Object.assign(Object.create({ heritage: 1 }), M())],
  'non tableau': () => ({ 0: E(), 1: M(), length: 2 }),
};
for (const [nom, fabrique] of Object.entries(CAS_REFUSES)) {
  test(`D4. FORMAT : « ${nom} » est refusé par la lecture historique ET par le stockage (aucune ligne écrite)`, async () => {
    const { observation, l } = await vieUnTour();
    const ligne = { ...observation, empreintesCategoriesDonnees: fabrique() };
    assert.throws(() => resoudreContexteObservation(ligne.id, [ligne], l.valeurs, l.executions, DESCRIPTIONS_OPERATIONS), TypeError);
    const magasin = magasinMemoireVive();
    const { id, horodatage, ...entree } = observation;
    await assert.rejects(() => enregistrerObservationPossibilites(magasin, { ...entree, empreintesCategoriesDonnees: fabrique() }), Error);
    assert.equal((await magasin.lireTout('observationsPossibilites')).length, 0);
  });
}
test('D5. FORMATS ACCEPTÉS par le stockage : ancien [entrées(P)] et nouveau [entrées(P), message] ; la preuve relationnelle reste EXACTEMENT une entrée ; copies indépendantes', async () => {
  const { observation } = await vieUnTour();
  const { id, horodatage, ...entree } = observation;
  for (const preuve of [[E()], [E(), M()]]) {
    const magasin = magasinMemoireVive();
    const ecrite = await enregistrerObservationPossibilites(magasin, { ...entree, empreintesCategoriesDonnees: preuve });
    assert.deepEqual(ecrite.empreintesCategoriesDonnees, preuve);
    assert.notEqual(ecrite.empreintesCategoriesDonnees, preuve);
    preuve[0].empreinte = H('f');
    assert.equal(ecrite.empreintesCategoriesDonnees[0].empreinte, empreinteContratEntreesProduction());
  }
  const magasin = magasinMemoireVive();
  await assert.rejects(() => enregistrerObservationPossibilites(magasin, { ...entree, empreintesContratsRelationnels: [entree.empreintesContratsRelationnels[0], entree.empreintesContratsRelationnels[0]] }), Error);
});
test('D6. ORDRE : la STRUCTURE de la preuve de catégorie (deux entrées comprises) est contrôlée avant le catalogue ; sa COMPARAISON après les empreintes d\'opérations et avant la reconstruction', async () => {
  const { observation } = await vieUnTour();
  const structureKo = { ...observation, empreintesCategoriesDonnees: [M(), E()] };
  assert.throws(() => resoudreContexteObservation(structureKo.id, [structureKo], [], [], [{ nom: 'catalogue invalide' }]), /ordre canonique|doit être/);
  const opsKo = { ...observation, empreintesOperationsExaminees: observation.empreintesOperationsExaminees.map((p, i) => (i === 0 ? { ...p, empreinte: H('1') } : p)), empreintesCategoriesDonnees: [E(), { categorie: CATEGORIE_MESSAGE, empreinte: H('2') }] };
  assert.throws(() => resoudreContexteObservation(opsKo.id, [opsKo], [], [], DESCRIPTIONS_OPERATIONS), /contrat mécanique/);
});
test('D7. une ligne qui porte la preuve message sans empreintesOperationsExaminees est mal formée (aucune génération hybride) ; la clé reste empreintesCategoriesDonnees (9 clés, rien de plus)', async () => {
  const { observation } = await vieUnTour();
  const { empreintesOperationsExaminees, ...sans } = observation;
  assert.throws(() => resoudreContexteObservation(sans.id, [sans], [], [], DESCRIPTIONS_OPERATIONS), /exige empreintesOperationsExaminees/);
  assert.equal(Object.keys(observation).length, 9);
});

// ============================================================================ E. PERSISTANCE ATOMIQUE DES DEUX PREUVES
test('E1. une observation RÉELLE porte [entrées(P), message] dans CET ordre, rendues telles quelles par leurs sources ; aucune autre clé', async () => {
  const { observation } = await vieUnTour();
  assert.deepEqual(Object.keys(observation), ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'empreintesContratsRelationnels', 'possibilites']);
  assert.deepEqual(observation.empreintesCategoriesDonnees, [{ categorie: 'entrees-de-production', empreinte: empreinteContratEntreesProduction() }, { categorie: 'message', empreinte: empreinteContratMessage() }]);
});
test('E2. ATOMICITÉ : si le calcul de la preuve message échoue (copie temporaire du code dont la primitive lève), echec_calcul, enregistrer n\'est JAMAIS appelé, aucune ligne, aucune observation partielle', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'obs65-'));
  try {
    cpSync(join(RACINE, 'app', 'langage'), dossier, { recursive: true });
    const p = join(dossier, 'empreinte-categorie-message.js');
    const s = readFileSync(p, 'utf8');
    assert.equal(s.includes('export function empreinteContratMessage() {'), true);
    writeFileSync(p, s.replace('export function empreinteContratMessage() {', "export function empreinteContratMessage() {\n  throw new TypeError('panne simulée');"));
    const { observerPossibilites: observer } = await import(pathToFileURL(join(dossier, 'observation-possibilites.js')).href);
    let appels = 0;
    const magasin = magasinMemoireVive();
    const message = identifierMessage('bonjour', { nouvelId: (q) => `${q}-1` });
    const r = await observer(message, { enregistrer: (o) => { appels += 1; return enregistrerObservationPossibilites(magasin, o); }, lireExecutions: () => magasin.lireTout('executionsOperations') });
    assert.deepEqual({ statut: r.statut, observation: r.observation, univers: r.univers }, { statut: 'echec_calcul', observation: null, univers: null });
    assert.equal(appels, 0);
    assert.equal((await magasin.lireTout('observationsPossibilites')).length, 0);
  } finally { rmSync(dossier, { recursive: true, force: true }); }
});
test('E3. le producteur reçoit les DEUX preuves dans le même appel d\'enregistrer (un seul appel) ; le code les calcule dans le même bloc que les preuves des opérations et relationnelle', async () => {
  const magasin = magasinMemoireVive(); const recus = [];
  const message = identifierMessage('bonjour', { nouvelId: (q) => `${q}-1` });
  await observerPossibilites(message, { enregistrer: (o) => { recus.push(o); return enregistrerObservationPossibilites(magasin, o); }, lireExecutions: () => magasin.lireTout('executionsOperations') });
  assert.equal(recus.length, 1);
  assert.deepEqual(recus[0].empreintesCategoriesDonnees, [E(), M()]);
  const code = sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'));
  assert.match(code, /empreinteContratMessage\(\)/);
  assert.equal(/canoniqueContrat|contratMessage|canoniserContratCategorie|sha256|sondes/.test(code), false);
  const bloc = code.slice(code.indexOf('empreintesCategoriesDonnees = ['), code.indexOf('empreintesContratsRelationnels = ['));
  assert.match(bloc, /empreinteContratEntreesProduction\(\)[\s\S]*empreinteContratMessage\(\)/);
});

// ============================================================================ F. DORMANCE ET LIMITES
test('F1. DORMANCE : le module n\'est nommé que par ses importeurs attendus ; ni pont, ni esprit, ni sollicitation, ni exécution, ni main, ni applications-sollicitables', () => {
  for (const f of ['app/main.js', 'app/langage/applications-sollicitables.js', 'app/langage/execution-mecanique.js', 'app/langage/execution-sollicitee.js', 'app/langage/contexte-sollicitation.js', 'app/langage/pont.js', 'app/langage/groupes-candidats.js', 'app/langage/connaissances.js', 'app/langage/resoudre-identites.js']) {
    assert.equal(/empreinte-categorie-message|empreinteContratMessage|CATEGORIE_MESSAGE/.test(sansCommentaires(lu(...f.split('/')))), false, f);
  }
  const formes = sansCommentaires(lu('app', 'langage', 'formes-rencontrees.js'));
  assert.deepEqual([...formes.matchAll(/from '([^']+)'/g)].map((m) => m[1]).filter((i) => /message/.test(i)), ['./empreinte-categorie-message.js']);
  assert.equal(/empreinteContratMessage/.test(formes), false, 'la vue ne calcule aucune empreinte : elle ne reconnaît que le NOM de la catégorie');
});
// === FIN_TEST_EMPREINTE_CATEGORIE_MESSAGE ===
