// v0.63.52 — « PERSISTER LA PREUVE DES CONTRATS EXAMINÉS » (décision ChatGPT, 06/10/2026).
// Une NOUVELLE observation porte empreintesOperationsExaminees = empreintesDesContrats(catalogue examiné). Rien n'est vérifié à la lecture.
// Anciennes lignes : intactes, sans empreinte inventée. F1 seulement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { sha256Hex } from '../app/langage/sha256.js';
import { contratCanonique, empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const C16 = DESCRIPTIONS_OPERATIONS;
const clone = (v) => JSON.parse(JSON.stringify(v));
const CLES_ANCIENNE = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'possibilites'];
const CLES_GEN7 = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'possibilites']; // génération v0.63.52 (écrite par un appel direct avec la seule preuve des opérations)
// MISE À JOUR DÉLIBÉRÉE v0.63.57 : le FLUX VIVANT écrit désormais la troisième génération (8 clés : + empreintesCategoriesDonnees).
const CLES_NOUVELLE = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'possibilites'];
const NOUVELLE_OP = { nom: 'nouvelleOperationSansHistoire', entrees: { x: { forme: 'scalaire', genre: 'chaine' } }, sortie: { forme: 'scalaire', genre: 'chaine' } };
const modifier = (nom, f, catalogue = C16) => catalogue.map((d) => { if (d.nom !== nom) return d; const c = clone(d); f(c); return c; });
const parNom = (liste) => Object.fromEntries(liste.map((p) => [p.operation, p.empreinte]));

// Monde : un magasin, des tours réels ; `ancien` simule le format d'avant v0.63.52 (même appel d'écriture, sans le champ).
function monde({ ancien = false, descriptions = C16 } = {}) {
  const magasin = magasinMemoireVive();
  let n = 0;
  const recus = [];
  const enregistrer = (o) => {
    recus.push(o);
    if (ancien) { const { empreintesOperationsExaminees, empreintesCategoriesDonnees, ...sans } = o; return enregistrerObservationPossibilites(magasin, sans); }
    return enregistrerObservationPossibilites(magasin, o);
  };
  async function tour(texte) {
    let k = (n += 1) * 100;
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    await enregistrerValeurDonnee(magasin, { id: message.id, valeur: message.texte });
    const r = await observerPossibilites(message, { enregistrer, lireExecutions: () => magasin.lireTout('executionsOperations'), descriptions });
    assert.equal(r.statut, 'ecrite');
    return r;
  }
  async function lancer(texteTour, operation) {
    const t = await tour(texteTour);
    const application = applicationsSollicitables(t.observation, descriptions, t.univers).applications.find((a) => a.operation === operation);
    assert.ok(application, operation);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS, descriptions });
    assert.equal(r.statut, 'executee');
    return r;
  }
  const lire = async () => ({ observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
  return { magasin, tour, lancer, lire, recus };
}
async function chaine(options) {
  const w = monde(options);
  await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const Y = await w.tour('message Y');
  await w.tour('suivant');
  return { w, Y };
}

// ============================================================================ A. ÉCRITURE D'UN TOUR RÉEL SOUS C16
test('A1. TOUR RÉEL C16 : operationsExaminees = les 16 noms ; empreintesOperationsExaminees = empreintesDesContrats(C16) en égalité profonde ; clés dans l\'ordre de la nouvelle génération', async () => {
  const { w, Y } = await chaine();
  const o = Y.observation;
  assert.deepEqual(Object.keys(o), CLES_NOUVELLE);
  assert.equal(o.operationsExaminees.length, 16);
  assert.deepEqual(o.operationsExaminees, C16.map((d) => d.nom).sort());
  assert.deepEqual(o.empreintesOperationsExaminees, empreintesDesContrats(C16));
  const l = await w.lire();
  assert.deepEqual(l.observations.find((x) => x.id === o.id), o, 'la ligne PERSISTÉE est la ligne rendue');
});
test('A2. chaque paire correspond au contrat réellement examiné : empreinte = SHA-256 du contrat canonique de la description du MÊME nom', async () => {
  const { Y } = await chaine();
  for (const { operation, empreinte } of Y.observation.empreintesOperationsExaminees) {
    const description = C16.find((d) => d.nom === operation);
    assert.ok(description, operation);
    assert.equal(empreinte, sha256Hex(contratCanonique(description)), operation);
    assert.match(empreinte, /^[0-9a-f]{64}$/);
  }
});
test('A3. MÊME CATALOGUE pour les trois : un catalogue fourni à observerPossibilites donne operationsExaminees, possibilites ET empreintes (aucun second catalogue implicite)', async () => {
  const sous = C16.filter((d) => ['symbolesDeChaine', 'parcourirStructure'].includes(d.nom));
  const w = monde({ descriptions: sous });
  const r = await w.tour('bonjour');
  assert.deepEqual(r.observation.operationsExaminees, ['parcourirStructure', 'symbolesDeChaine']);
  assert.deepEqual(r.observation.empreintesOperationsExaminees, empreintesDesContrats(sous));
  assert.deepEqual(r.observation.empreintesOperationsExaminees.map((p) => p.operation), r.observation.operationsExaminees);
  // un contrat modifié passé au calcul est celui qui est prouvé (et non DESCRIPTIONS_OPERATIONS)
  const j10 = modifier('partagerCouvertures', (d) => { d.sortie.champs.supplementaire = { forme: 'scalaire', genre: 'nombre', peutManquer: true }; });
  const w2 = monde({ descriptions: j10 });
  const r2 = await w2.tour('bonjour');
  assert.deepEqual(r2.observation.empreintesOperationsExaminees, empreintesDesContrats(j10));
  assert.notDeepEqual(parNom(r2.observation.empreintesOperationsExaminees).partagerCouvertures, parNom(empreintesDesContrats(C16)).partagerCouvertures);
});
test('A4. l\'appel d\'enregistrer reçoit exactement les six champs métier, dont les empreintes TELLES QUE RENDUES par la primitive (égalité profonde, ordre de la primitive)', async () => {
  const w = monde();
  await w.tour('x');
  assert.equal(w.recus.length, 1);
  assert.deepEqual(Object.keys(w.recus[0]), ['idMessage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'possibilites']); // MISE À JOUR DÉLIBÉRÉE v0.63.57 : + empreintesCategoriesDonnees
  assert.deepEqual(w.recus[0].empreintesOperationsExaminees, empreintesDesContrats(C16));
});
test('A5. catalogue vide : une observation écrite porte [] (ensemble vide = ensemble vide), jamais une clé absente', async () => {
  const w = monde({ descriptions: [] });
  const r = await w.tour('x');
  assert.deepEqual(r.observation.operationsExaminees, []);
  assert.deepEqual(r.observation.empreintesOperationsExaminees, []);
});

// ============================================================================ B. INVARIANTS (refus plutôt qu'observation contradictoire)
const BASE_ENTREE = { idMessage: 'M', donneesExaminees: ['M'], operationsExaminees: ['a', 'b'], possibilites: [] };
const H = (c) => c.repeat(64);
const BONNES = [{ operation: 'a', empreinte: H('a') }, { operation: 'b', empreinte: H('0') }];
test('B1. une écriture cohérente est acceptée ; les paires sont conservées (copies, même ordre), la ligne a la nouvelle génération', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerObservationPossibilites(m, { ...BASE_ENTREE, empreintesOperationsExaminees: BONNES });
  assert.deepEqual(Object.keys(l), CLES_GEN7); // MISE À JOUR DÉLIBÉRÉE v0.63.57 : appel direct avec la seule preuve des opérations = génération 7 clés
  assert.deepEqual(l.empreintesOperationsExaminees, BONNES);
  assert.notEqual(l.empreintesOperationsExaminees, BONNES);
  assert.notEqual(l.empreintesOperationsExaminees[0], BONNES[0]);
});
test('B2. INCOHÉRENCES refusées (Error), et RIEN n\'est écrit : non tableau, longueur différente, opération absente, opération étrangère, doublon, désordre, nom vide, hex invalide (majuscule, court, long, non hex), paire à clé étrangère, paire non objet, creux, accesseur', async () => {
  const sparse = [BONNES[0]]; sparse.length = 2;
  const accesseur = [BONNES[0]]; Object.defineProperty(accesseur, 1, { enumerable: true, get() { return BONNES[1]; } });
  const cas = {
    nonTableau: 'x', objet: {}, nul: null,
    trop_court: [BONNES[0]], trop_long: [...BONNES, { operation: 'c', empreinte: H('c') }],
    etrangere: [BONNES[0], { operation: 'z', empreinte: H('1') }],
    doublon: [BONNES[0], BONNES[0]],
    desordre: [BONNES[1], BONNES[0]],
    nomVide: [BONNES[0], { operation: '', empreinte: H('1') }],
    nomNonChaine: [BONNES[0], { operation: 3, empreinte: H('1') }],
    majuscule: [BONNES[0], { operation: 'b', empreinte: H('A') }],
    court: [BONNES[0], { operation: 'b', empreinte: H('a').slice(1) }],
    long: [BONNES[0], { operation: 'b', empreinte: `${H('a')}0` }],
    nonHex: [BONNES[0], { operation: 'b', empreinte: H('g') }],
    empreinteNonChaine: [BONNES[0], { operation: 'b', empreinte: 5 }],
    cleEtrangere: [BONNES[0], { operation: 'b', empreinte: H('1'), extra: 1 }],
    cleManquante: [BONNES[0], { operation: 'b' }],
    pairesNonObjets: ['a', 'b'], pairesTableaux: [['a'], ['b']], pairesNulles: [null, null],
    creux: sparse, accesseur,
  };
  for (const [nom, valeur] of Object.entries(cas)) {
    const m = magasinMemoireVive();
    await assert.rejects(() => enregistrerObservationPossibilites(m, { ...BASE_ENTREE, empreintesOperationsExaminees: valeur }), Error, nom);
    assert.deepEqual(await m.lireTout('observationsPossibilites'), [], `${nom} : rien d'écrit`);
  }
});
test('B3. COHÉRENCE AVEC operationsExaminees : même nombre, mêmes noms, même ordre (l\'ordre d\'entrée de operationsExaminees est canonisé avant la comparaison)', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerObservationPossibilites(m, { ...BASE_ENTREE, operationsExaminees: ['b', 'a'], empreintesOperationsExaminees: BONNES });
  assert.deepEqual(l.operationsExaminees, ['a', 'b']);
  assert.deepEqual(l.empreintesOperationsExaminees.map((p) => p.operation), l.operationsExaminees);
  await assert.rejects(() => enregistrerObservationPossibilites(m, { ...BASE_ENTREE, operationsExaminees: ['a', 'c'], empreintesOperationsExaminees: BONNES }), /ne correspond pas/);
});
test('B4. aucun calcul dans l\'écriture : enregistrerObservationPossibilites ne nomme ni la primitive d\'empreinte ni SHA-256 (il VALIDE et conserve, il ne canonise pas)', () => {
  const code = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  assert.equal(/empreinte-contrats|empreintesDesContrats|contratCanonique|sha256/i.test(code), false);
});

// ============================================================================ C. AJOUT FUTUR : C16 PUIS C17
test('C1. O écrite sous C16 ; C17 = C16 + N : O garde exactement ses 16 empreintes, C17 en donne 17, les 16 anciennes paires sont identiques, la paire de N n\'est que dans C17, O est rendue sous C17 sans changement', async () => {
  const { w, Y } = await chaine();
  const l = await w.lire();
  const O = l.observations.find((x) => x.id === Y.observation.id);
  const avant = JSON.stringify(O);
  const C17 = [...C16, NOUVELLE_OP];
  const e16 = empreintesDesContrats(C16); const e17 = empreintesDesContrats(C17);
  assert.equal(O.empreintesOperationsExaminees.length, 16);
  assert.equal(e17.length, 17);
  assert.deepEqual(e17.filter((p) => p.operation !== NOUVELLE_OP.nom), e16);
  assert.deepEqual(O.empreintesOperationsExaminees, e16);
  assert.equal(O.empreintesOperationsExaminees.some((p) => p.operation === NOUVELLE_OP.nom), false, 'aucune empreinte de N rétroactive');
  assert.equal(O.operationsExaminees.includes(NOUVELLE_OP.nom), false);
  const r = resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, C17);
  assert.equal(r.observation, O, 'même référence');
  assert.equal(JSON.stringify(O), avant, 'O inchangée');
  assert.equal(JSON.stringify((await w.lire()).observations.find((x) => x.id === O.id)), avant, 'et inchangée dans le magasin');
});

// ============================================================================ D. J10 / J10b SANS MODIFIER O
test('D1. J10 sur une observation NOUVELLE : O ne change pas ; empreinte persistée ≠ empreinte recalculée du contrat modifié (cette opération seulement) ; MISE À JOUR DÉLIBÉRÉE v0.63.53 : le contexte est désormais REFUSÉ (v0.63.52 : rendu)', async () => {
  const { w, Y } = await chaine();
  const l = await w.lire();
  const O = l.observations.find((x) => x.id === Y.observation.id);
  const avant = JSON.stringify(O);
  const derive = modifier('partagerCouvertures', (d) => { d.sortie.champs.supplementaire = { forme: 'scalaire', genre: 'nombre', peutManquer: true }; });
  const persistee = parNom(O.empreintesOperationsExaminees); const recalculee = parNom(empreintesDesContrats(derive));
  assert.notEqual(persistee.partagerCouvertures, recalculee.partagerCouvertures);
  assert.deepEqual(Object.keys(persistee).filter((n) => persistee[n] !== recalculee[n]), ['partagerCouvertures']);
  assert.throws(() => resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, derive), TypeError); // MISE À JOUR DÉLIBÉRÉE v0.63.53 (v0.63.52 : doesNotThrow)
  assert.equal(JSON.stringify(O), avant);
});
test('D2. J10b (entrée insatisfiable ajoutée) sur une observation NOUVELLE : O ne change pas ; persistée ≠ recalculée pour memesCouvertures seulement ; MISE À JOUR DÉLIBÉRÉE v0.63.53 : le contexte est désormais REFUSÉ (v0.63.52 : rendu)', async () => {
  const { w, Y } = await chaine();
  const l = await w.lire();
  const O = l.observations.find((x) => x.id === Y.observation.id);
  const avant = JSON.stringify(O);
  const derive = modifier('memesCouvertures', (d) => { d.entrees.c = { forme: 'scalaire', genre: 'booleen' }; });
  const persistee = parNom(O.empreintesOperationsExaminees); const recalculee = parNom(empreintesDesContrats(derive));
  assert.deepEqual(Object.keys(persistee).filter((n) => persistee[n] !== recalculee[n]), ['memesCouvertures']);
  assert.throws(() => resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, derive), TypeError); // MISE À JOUR DÉLIBÉRÉE v0.63.53 (v0.63.52 : doesNotThrow)
  assert.equal(JSON.stringify(O), avant);
});

// ============================================================================ E. resoudreContexteObservation EN v0.63.52 : DEUX GÉNÉRATIONS RECONNUES, RIEN VÉRIFIÉ
test('E1. les deux générations sont reconnues (clés closes : 6 ou 6 + empreintesOperationsExaminees) ; toute autre clé reste refusée', async () => {
  const { w, Y } = await chaine();
  const l = await w.lire();
  const O = l.observations.find((x) => x.id === Y.observation.id);
  assert.doesNotThrow(() => resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, C16));
  const { empreintesOperationsExaminees, empreintesCategoriesDonnees, ...ancienne } = O;
  const rA = resoudreContexteObservation(O.id, [ancienne, ...l.observations.filter((x) => x.id !== O.id)], l.valeurs, l.executions, C16);
  assert.equal(rA.observation, ancienne);
  for (const etrange of [{ ...O, extra: 1 }, { ...ancienne, extra: 1 }, { ...ancienne, empreinte: 'x' }]) {
    assert.throws(() => resoudreContexteObservation(O.id, [etrange], l.valeurs, l.executions, C16), TypeError);
  }
});
test('E2. MISE À JOUR DÉLIBÉRÉE v0.63.53 (v0.63.52 : « contenu ni lu ni vérifié ») : une preuve fausse est désormais REFUSÉE ; tests détaillés dans tests/preuve-contrats-historiques.test.mjs', async () => {
  const { w, Y } = await chaine();
  const l = await w.lire();
  const O = l.observations.find((x) => x.id === Y.observation.id);
  const fausse = { ...O, empreintesOperationsExaminees: [{ operation: 'rien', empreinte: 'pas hex' }] };
  assert.throws(() => resoudreContexteObservation(O.id, [fausse], l.valeurs, l.executions, C16), TypeError);
});

// ============================================================================ F. ANCIEN FORMAT
test('F1. ANCIENNE GÉNÉRATION : une ligne écrite sans empreintes garde ses six clés ; aucune empreinte inventée ; lisible comme avant', async () => {
  const { w, Y } = await chaine({ ancien: true });
  const o = Y.observation;
  assert.deepEqual(Object.keys(o), CLES_ANCIENNE);
  assert.equal('empreintesOperationsExaminees' in o, false);
  const l = await w.lire();
  const avant = JSON.stringify(l.observations);
  const r = resoudreContexteObservation(o.id, l.observations, l.valeurs, l.executions, C16);
  assert.equal(r.observation, l.observations.find((x) => x.id === o.id));
  assert.equal(JSON.stringify(l.observations), avant, 'la lecture n\'ajoute aucun champ');
  assert.equal(JSON.stringify((await w.lire()).observations), avant, 'ni dans le magasin');
});
test('F2. COHABITATION : une ligne ancienne puis des lignes nouvelles dans le MÊME magasin ; le flux normal ne réécrit pas l\'ancienne ; aucune empreinte n\'est calculée pour elle', async () => {
  const magasin = magasinMemoireVive();
  const ancienne = await enregistrerObservationPossibilites(magasin, { ...BASE_ENTREE });
  const figee = JSON.stringify(ancienne);
  const message = identifierMessage('bonjour', { nouvelId: (p) => `${p}-1` });
  await enregistrerValeurDonnee(magasin, { id: message.id, valeur: message.texte });
  const r = await observerPossibilites(message, { enregistrer: (o) => enregistrerObservationPossibilites(magasin, o), lireExecutions: () => magasin.lireTout('executionsOperations') });
  assert.equal(r.statut, 'ecrite');
  const lignes = await magasin.lireTout('observationsPossibilites');
  assert.equal(lignes.length, 2);
  assert.equal(JSON.stringify(lignes.find((x) => x.id === ancienne.id)), figee);
  assert.deepEqual(Object.keys(lignes.find((x) => x.id === ancienne.id)), CLES_ANCIENNE);
  assert.deepEqual(Object.keys(lignes.find((x) => x.id === r.observation.id)), CLES_NOUVELLE);
});
test('F3. les appelants directs de l\'écriture (sans le champ) continuent d\'écrire l\'ancienne génération : le champ n\'est jamais ajouté par l\'écriture elle-même', async () => {
  const m = magasinMemoireVive();
  const l = await enregistrerObservationPossibilites(m, { ...BASE_ENTREE, operationsExaminees: [] });
  assert.deepEqual(Object.keys(l), CLES_ANCIENNE);
});

// ============================================================================ G. TAILLE (documentaire)
test('G1. TAILLE d\'une observation réelle sous C16 : avant (sans empreintes) vs après ; le surcoût est exactement celui de 16 paires complètes (hex64, aucune troncature)', async () => {
  const { Y } = await chaine();
  const apres = JSON.stringify(Y.observation);
  const { empreintesOperationsExaminees, empreintesCategoriesDonnees, ...ancienne } = Y.observation;
  const avant = JSON.stringify(ancienne);
  const surcout = apres.length - avant.length;
  // MISE À JOUR DÉLIBÉRÉE v0.63.57 : le surcoût comprend aussi la preuve de catégorie (une entrée { categorie, empreinte }).
  assert.equal(surcout, `,"empreintesOperationsExaminees":${JSON.stringify(empreintesOperationsExaminees)}`.length + `,"empreintesCategoriesDonnees":${JSON.stringify(empreintesCategoriesDonnees)}`.length);
  assert.ok(surcout > 16 * 64);
  assert.ok(empreintesOperationsExaminees.every((p) => p.empreinte.length === 64));
});

// ============================================================================ H. AUCUN AUTRE EFFET
test('H1. AUCUN AUTRE EFFET : ni table, ni migration, ni VERSION_BASE, ni schéma ; MISE À JOUR DÉLIBÉRÉE v0.63.53 : empreinte-contrats est aussi importé par contexte-observation.js (lecture), jamais par l’écriture ni les autres consommateurs', () => {
  assert.equal(VERSION_BASE, 19);
  assert.equal(SCHEMA_SAUVEGARDE, 9);
  assert.equal(TABLES.length, 22);
  assert.equal(/empreinte-contrats\.js/.test(sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'))), true);
  for (const f of ['connaissances.js', 'pont.js', 'applications-sollicitables.js', 'execution-sollicitee.js', 'groupes-candidats.js']) {
    assert.equal(/empreinte-contrats|sha256/.test(sansCommentaires(lu('app', 'langage', f))), false, f);
  }
});
