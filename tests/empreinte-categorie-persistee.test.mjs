// v0.63.57 — « PERSISTER LA PREUVE DU CONTRAT DE CATÉGORIE DANS LES NOUVELLES OBSERVATIONS » (décision ChatGPT, 06/10/2026).
// Une NOUVELLE observation (flux vivant) porte empreintesCategoriesDonnees = [{ categorie, empreinte }] rendue telle quelle par
// empreinteContratEntreesProduction(). ÉCRIRE D'ABORD : rien n'est vérifié à la lecture (v0.63.58). Aucune donnée entrées(P) dans les snapshots.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { CATEGORIE_ENTREES_PRODUCTION, empreinteContratEntreesProduction, contratEntreesProduction, canoniserContratCategorie } from '../app/langage/empreinte-categorie-entrees.js';
import { CATEGORIE_MESSAGE, empreinteContratMessage } from '../app/langage/empreinte-categorie-message.js';
import { PREFIXE_IDENTITE_ENTREES, estIdentiteEntrees } from '../app/langage/entrees-donnee.js';
import { sha256Hex } from '../app/langage/sha256.js';
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
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const HEX64 = /^[0-9a-f]{64}$/;
const CLES6 = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'possibilites'];
const CLES7 = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'possibilites'];
const CLES8 = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'possibilites'];
const CLES9 = [...CLES8.slice(0, 7), 'empreintesContratsRelationnels', 'possibilites']; // MISE À JOUR DÉLIBÉRÉE v0.63.62 : observation réelle = 9 clés (CLES9)
const PREUVE = () => [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: empreinteContratEntreesProduction() }];
// MISE À JOUR DÉLIBÉRÉE v0.63.65 : une observation RÉELLE porte désormais DEUX preuves (entrées(P) puis message) ; PREUVE() reste le format ANCIEN (une entrée), toujours accepté à l'écriture.
const PREUVE2 = () => [...PREUVE(), { categorie: CATEGORIE_MESSAGE, empreinte: empreinteContratMessage() }];
const H = (c) => c.repeat(64);
const BASE = { idMessage: 'M', donneesExaminees: ['M'], operationsExaminees: ['a', 'b'], possibilites: [] };
const BONNES = [{ operation: 'a', empreinte: H('a') }, { operation: 'b', empreinte: H('0') }];

function monde({ descriptions = C16, enregistrerSur = (o) => o } = {}) {
  const magasin = magasinMemoireVive();
  let n = 0;
  const recus = [];
  const enregistrer = (o) => { recus.push(o); return enregistrerObservationPossibilites(magasin, enregistrerSur(o)); };
  async function tour(texte) {
    let k = (n += 1) * 100;
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    await enregistrerValeurDonnee(magasin, { id: message.id, valeur: message.texte });
    const r = await observerPossibilites(message, { enregistrer, lireExecutions: () => magasin.lireTout('executionsOperations'), descriptions });
    return r;
  }
  async function lancer(texteTour, operation, liaisons) {
    const t = await tour(texteTour);
    assert.equal(t.statut, 'ecrite');
    const application = liaisons ? { operation, liaisons } : applicationsSollicitables(t.observation, descriptions, t.univers).applications.find((a) => a.operation === operation);
    assert.ok(application, operation);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS, descriptions });
    assert.equal(r.statut, 'executee');
    return r;
  }
  const lire = async () => ({ observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
  return { magasin, tour, lancer, lire, recus };
}
let CACHE = null;
async function chaine() {
  if (CACHE) return CACHE;
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const Y = await w.tour('message Y');
  assert.equal(Y.statut, 'ecrite');
  const l = await w.lire();
  CACHE = { w, A, B, P, Y, l };
  return CACHE;
}
const contexte = (l, id) => resoudreContexteObservation(id, l.observations, l.valeurs, l.executions, C16);

// ============================================================================ A. FLUX VIVANT
test('A1. TEST CENTRAL : une observation réelle porte exactement [{ categorie, empreinte: empreinteContratEntreesProduction() }] (aucune valeur recopiée), 8 clés dans l\'ordre', async () => {
  const { Y, w } = await chaine();
  const o = Y.observation;
  assert.deepEqual(Object.keys(o), CLES9); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : observation réelle = 9 clés (CLES9)
  assert.deepEqual(o.empreintesCategoriesDonnees, PREUVE2()); // MISE À JOUR DÉLIBÉRÉE v0.63.65 : deux preuves (entrées(P), message), ordre canonique
  assert.equal(o.empreintesCategoriesDonnees.length, 2);
  assert.equal(o.empreintesCategoriesDonnees[0].categorie, CATEGORIE_ENTREES_PRODUCTION);
  assert.match(o.empreintesCategoriesDonnees[0].empreinte, HEX64);
  const l = await w.lire();
  assert.deepEqual(l.observations.find((x) => x.id === o.id), o, 'la ligne PERSISTÉE est la ligne rendue');
});
test('A2. TOUTES les observations du flux (chaque tour, avant et après des productions) portent la preuve ; aucune n\'est de génération ancienne', async () => {
  const { l } = await chaine();
  assert.ok(l.observations.length >= 2, `observations: ${l.observations.length}`);
  for (const o of l.observations) { assert.deepEqual(Object.keys(o), CLES9); assert.deepEqual(o.empreintesCategoriesDonnees, PREUVE2()); } // MISE À JOUR DÉLIBÉRÉE v0.63.62 : observation réelle = 9 clés (CLES9)
});
test('A3. SOURCE UNIQUE : l\'appel d\'enregistrer reçoit la preuve de catégorie telle que rendue par la primitive, dans le même cycle que la preuve des opérations (même objet reçu, 8 champs métier)', async () => {
  const w = monde();
  await w.tour('x');
  assert.equal(w.recus.length, 1);
  assert.deepEqual(Object.keys(w.recus[0]), ['idMessage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'empreintesContratsRelationnels', 'possibilites']); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
  assert.deepEqual(w.recus[0].empreintesCategoriesDonnees, PREUVE2());
  assert.deepEqual(w.recus[0].empreintesOperationsExaminees, empreintesDesContrats(C16));
});
test('A4. la preuve est SHA-256 du contrat canonique de la catégorie (recalculé dans le TEST à partir des primitives, pas copié)', async () => {
  const { Y } = await chaine();
  assert.equal(Y.observation.empreintesCategoriesDonnees[0].empreinte, sha256Hex(canoniserContratCategorie(contratEntreesProduction())));
});

// ============================================================================ B. VALIDATION À L'ÉCRITURE (format seulement)
const ecrire = (m, categories, extra = {}) => enregistrerObservationPossibilites(m, { ...BASE, empreintesOperationsExaminees: BONNES, ...(categories === undefined ? {} : { empreintesCategoriesDonnees: categories }), ...extra });
const nbLignes = async (m) => (await m.lireTout('observationsPossibilites')).length;
test('B1. une écriture cohérente est acceptée ; la preuve est conservée (copie), la ligne a la troisième génération', async () => {
  const m = magasinMemoireVive();
  const entree = PREUVE();
  const l = await ecrire(m, entree);
  assert.deepEqual(Object.keys(l), CLES8);
  assert.deepEqual(l.empreintesCategoriesDonnees, PREUVE());
  assert.notEqual(l.empreintesCategoriesDonnees, entree); assert.notEqual(l.empreintesCategoriesDonnees[0], entree[0]);
  entree[0].empreinte = H('f');
  assert.deepEqual((await m.lireTout('observationsPossibilites'))[0].empreintesCategoriesDonnees, PREUVE(), 'modifier l\'entrée après coup ne touche pas la ligne');
});
test('B2. entrée GELÉE acceptée ; objet sans prototype accepté ; l\'entrée n\'est jamais mutée', async () => {
  const m = magasinMemoireVive();
  const gelee = gelProfond(PREUVE());
  await ecrire(m, gelee);
  const nu = Object.create(null); nu.categorie = CATEGORIE_ENTREES_PRODUCTION; nu.empreinte = H('1');
  await ecrire(m, [nu]);
  assert.equal(await nbLignes(m), 2);
  assert.deepEqual(gelee, PREUVE());
});
test('B3. FORMAT REFUSÉ, rien n\'est écrit : non tableau, vide, deux entrées, tableau creux, élément accesseur', async () => {
  const m = magasinMemoireVive();
  const creux = new Array(1);
  const accesseur = []; Object.defineProperty(accesseur, 0, { get() { return PREUVE()[0]; }, enumerable: true });
  const deux = [...PREUVE(), { categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('1') }];
  for (const mauvais of [null, 'x', 3, {}, PREUVE()[0], [], deux, creux, accesseur]) await assert.rejects(() => ecrire(m, mauvais), Error, JSON.stringify(mauvais));
  assert.equal(await nbLignes(m), 0);
});
test('B4. FORMAT REFUSÉ : entrée non objet, tableau, objet non simple, clé en trop, clé manquante, clé symbole', async () => {
  const m = magasinMemoireVive();
  class Preuve { constructor() { this.categorie = CATEGORIE_ENTREES_PRODUCTION; this.empreinte = H('1'); } }
  const sym = { categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('1') }; sym[Symbol('s')] = 1;
  const variantes = [[null], ['x'], [3], [[]], [new Preuve()], [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('1'), autre: 1 }], [{ categorie: CATEGORIE_ENTREES_PRODUCTION }], [{ empreinte: H('1') }], [{}], [sym]];
  for (const v of variantes) await assert.rejects(() => ecrire(m, v), Error);
  assert.equal(await nbLignes(m), 0);
});
test('B5. CATÉGORIE exactement « entrees-de-production » : autre nom, casse, espaces, non-chaîne, absence : refusés', async () => {
  const m = magasinMemoireVive();
  for (const categorie of ['autre', 'Entrees-de-production', ' entrees-de-production', 'entrees-de-production ', 'entrees-de-production:', '', null, undefined, 3, ['entrees-de-production']])
    await assert.rejects(() => ecrire(m, [{ categorie, empreinte: H('1') }]), Error, String(categorie));
  assert.equal(await nbLignes(m), 0);
});
test('B6. EMPREINTE exactement 64 hexadécimaux minuscules : majuscules, 63, 65, non hexa, espaces, non-chaîne : refusés', async () => {
  const m = magasinMemoireVive();
  for (const empreinte of [H('A'), 'a'.repeat(63), 'a'.repeat(65), 'g'.repeat(64), ` ${'a'.repeat(63)}`, `${'a'.repeat(64)}\n`, '', null, undefined, 3, ['a'.repeat(64)]])
    await assert.rejects(() => ecrire(m, [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte }]), Error, String(empreinte));
  assert.equal(await nbLignes(m), 0);
});
test('B7. aucune propriété par ACCESSEUR dans la preuve (categorie ou empreinte)', async () => {
  const m = magasinMemoireVive();
  const a = {}; Object.defineProperty(a, 'categorie', { get() { return CATEGORIE_ENTREES_PRODUCTION; }, enumerable: true }); a.empreinte = H('1');
  const b = { categorie: CATEGORIE_ENTREES_PRODUCTION }; Object.defineProperty(b, 'empreinte', { get() { return H('1'); }, enumerable: true });
  await assert.rejects(() => ecrire(m, [a]), /accesseur/);
  await assert.rejects(() => ecrire(m, [b]), /accesseur/);
  assert.equal(await nbLignes(m), 0);
});
test('B8. la validation vérifie le FORMAT, elle ne RECALCULE pas : un hex64 quelconque est conservé tel quel ; connaissances.js n\'importe pas le module de contrat', async () => {
  const m = magasinMemoireVive();
  const l = await ecrire(m, [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('7') }]);
  assert.equal(l.empreintesCategoriesDonnees[0].empreinte, H('7'));
  assert.notEqual(H('7'), empreinteContratEntreesProduction());
  const code = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  assert.equal(/empreinte-categorie-entrees|empreinteContratEntreesProduction|contratEntreesProduction|canoniserContratCategorie|sha256/.test(code), false);
  assert.equal(code.includes("'entrees-de-production'"), true);
  assert.equal(code.match(/'entrees-de-production'/g).length, 1, 'un seul littéral de validation côté stockage (égalité au nom de catégorie vérifiée ci-dessous)');
  assert.equal(CATEGORIE_ENTREES_PRODUCTION, 'entrees-de-production');
});
test('B9. la preuve de catégorie n\'est acceptée QU\'AVEC la preuve des opérations (jamais seule : pas de génération hybride) ; rien n\'est écrit', async () => {
  const m = magasinMemoireVive();
  await assert.rejects(() => enregistrerObservationPossibilites(m, { ...BASE, empreintesCategoriesDonnees: PREUVE() }), /exige empreintesOperationsExaminees/);
  assert.equal(await nbLignes(m), 0);
});
test('B10. la validation de la preuve des opérations est inchangée (paires incohérentes toujours refusées)', async () => {
  const m = magasinMemoireVive();
  await assert.rejects(() => enregistrerObservationPossibilites(m, { ...BASE, empreintesOperationsExaminees: [BONNES[0]], empreintesCategoriesDonnees: PREUVE() }), /une paire par opération/);
  assert.equal(await nbLignes(m), 0);
});

// ============================================================================ C. GÉNÉRATIONS 6 / 7 / 8 CLÉS
test('C1. TROIS générations lisibles par resoudreContexteObservation : 6 clés (garantie faible), 7 clés (preuve des opérations), 8 clés ; aucun champ inventé, aucune mutation', async () => {
  const w = monde();
  await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const l = await w.lire();
  const O8 = l.observations[l.observations.length - 1];
  const O6 = (() => { const { empreintesOperationsExaminees, empreintesCategoriesDonnees, empreintesContratsRelationnels, ...s } = O8; return { ...s, id: 'obs-6' }; })(); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
  const O7 = (() => { const { empreintesCategoriesDonnees, empreintesContratsRelationnels, ...s } = O8; return { ...s, id: 'obs-7' }; })(); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
  assert.deepEqual(Object.keys(O6), CLES6); assert.deepEqual(Object.keys(O7), CLES7); assert.deepEqual(Object.keys(O8), CLES9); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : observation réelle = 9 clés (CLES9)
  const lignes = { ...l, observations: [...l.observations, O6, O7] };
  const avant = JSON.stringify(lignes);
  const c6 = contexte(lignes, 'obs-6'); const c7 = contexte(lignes, 'obs-7'); const c8 = contexte(lignes, O8.id);
  assert.equal(c6.observation, O6); assert.equal(c7.observation, O7); assert.equal(c8.observation, O8, 'même référence, jamais copiée');
  assert.deepEqual(c6.univers.map((u) => u.donnee), c8.univers.map((u) => u.donnee));
  assert.deepEqual(c7.univers.map((u) => u.donnee), c8.univers.map((u) => u.donnee));
  assert.equal(JSON.stringify(lignes), avant, 'aucune mutation, aucune réécriture');
  assert.deepEqual(Object.keys(O6), CLES6, 'aucun champ inventé'); assert.deepEqual(Object.keys(O7), CLES7);
});
test('C2. appels directs anciens préservés : sans preuve = 6 clés ; avec la seule preuve des opérations = 7 clés ; avec les deux = 8 clés ; le champ n\'est jamais ajouté par l\'écriture elle-même', async () => {
  const m = magasinMemoireVive();
  const a = await enregistrerObservationPossibilites(m, { ...BASE });
  const b = await enregistrerObservationPossibilites(m, { ...BASE, empreintesOperationsExaminees: BONNES });
  const c = await ecrire(m, PREUVE());
  assert.deepEqual(Object.keys(a), CLES6); assert.deepEqual(Object.keys(b), CLES7); assert.deepEqual(Object.keys(c), CLES8);
});
test('C3. COHABITATION dans le MÊME magasin : lignes 6 puis 7 puis 8 clés ; le flux normal ne réécrit pas les anciennes (octet pour octet) ; il écrit 8 clés', async () => {
  const magasin = magasinMemoireVive();
  const a6 = await enregistrerObservationPossibilites(magasin, { ...BASE });
  const a7 = await enregistrerObservationPossibilites(magasin, { ...BASE, empreintesOperationsExaminees: BONNES });
  const f6 = JSON.stringify(a6); const f7 = JSON.stringify(a7);
  const message = identifierMessage('bonjour', { nouvelId: (p) => `${p}-1` });
  await enregistrerValeurDonnee(magasin, { id: message.id, valeur: message.texte });
  const r = await observerPossibilites(message, { enregistrer: (o) => enregistrerObservationPossibilites(magasin, o), lireExecutions: () => magasin.lireTout('executionsOperations') });
  assert.equal(r.statut, 'ecrite');
  const lignes = await magasin.lireTout('observationsPossibilites');
  assert.equal(lignes.length, 3);
  assert.equal(JSON.stringify(lignes.find((x) => x.id === a6.id)), f6);
  assert.equal(JSON.stringify(lignes.find((x) => x.id === a7.id)), f7);
  assert.deepEqual(Object.keys(lignes.find((x) => x.id === r.observation.id)), CLES9); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : observation réelle = 9 clés (CLES9)
});

// ============================================================================ D. CONTEXTE HISTORIQUE EN v0.63.57 : STRUCTURE SEULEMENT
test('D1. la clé des catégories est reconnue STRUCTURELLEMENT : une ligne 8 clés est reconstruite selon les règles v0.63.53, comme la même ligne sans cette clé', async () => {
  const { l, Y } = await chaine();
  const O8 = Y.observation;
  const { empreintesCategoriesDonnees, empreintesContratsRelationnels, ...s7 } = O8; // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
  const lignes = { ...l, observations: [...l.observations, { ...s7, id: 'obs-7' }] };
  const c8 = contexte(lignes, O8.id); const c7 = contexte(lignes, 'obs-7');
  assert.deepEqual(c8.univers, c7.univers);
  assert.deepEqual(c8.univers.map((u) => u.donnee.identite), O8.donneesExaminees);
});
test('D2. MISE À JOUR DÉLIBÉRÉE v0.63.58 : la preuve de catégorie est désormais VÉRIFIÉE — une ligne 8 clés dont l\'empreinte est remplacée par un autre hex64 valide est REFUSÉE (v0.63.57 la rendait encore ; voir empreinte-categorie-verifiee.test.mjs)', async () => {
  const { l, Y } = await chaine();
  const perimee = { ...Y.observation, id: 'obs-perimee', empreintesCategoriesDonnees: [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('c') }] };
  assert.notEqual(perimee.empreintesCategoriesDonnees[0].empreinte, empreinteContratEntreesProduction());
  const lignes = { ...l, observations: [...l.observations, perimee] };
  assert.throws(() => contexte(lignes, 'obs-perimee'), (e) => e instanceof TypeError && /contrat de la catégorie/.test(e.message));
});
test('D3. MISE À JOUR DÉLIBÉRÉE v0.63.58 : la VALEUR de la clé est désormais lue et validée STRICTEMENT par le contexte (toute valeur invalide est refusée) ; la clé n\'est lue que par lirePropre', async () => {
  const { l, Y } = await chaine();
  for (const [i, valeur] of [[0, 'n\'importe quoi'], [1, []], [2, null], [3, [{ categorie: 'autre', empreinte: H('1') }]]]) {
    const o = { ...Y.observation, id: `obs-v${i}`, empreintesCategoriesDonnees: valeur };
    const lignes = { ...l, observations: [...l.observations, o] };
    assert.throws(() => contexte(lignes, o.id), (e) => e instanceof TypeError, `valeur ${i}`);
  }
  const code = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
  assert.equal(/lirePropre\([^)]*CLE_CATEGORIES/.test(code), true);
});
test('D4. les autres clés restent refusées : catégories SANS preuve des opérations (hybride), clé étrangère, clé manquante', async () => {
  const { l, Y } = await chaine();
  const O8 = Y.observation;
  const { empreintesOperationsExaminees, ...hybride } = O8;
  const variantes = { hybride: { ...hybride, id: 'o-h' }, etrangere: { ...O8, id: 'o-e', autre: 1 }, manquante: (() => { const { possibilites, ...s } = O8; return { ...s, id: 'o-m' }; })() };
  for (const [nom, o] of Object.entries(variantes)) {
    const lignes = { ...l, observations: [...l.observations, o] };
    assert.throws(() => contexte(lignes, o.id), (e) => e instanceof TypeError && /mal formée/.test(e.message), nom);
  }
});
test('D5. la vérification des opérations (v0.63.53) est INCHANGÉE sur une ligne 8 clés : une preuve d\'opérations périmée est toujours refusée', async () => {
  const { l, Y } = await chaine();
  const o = clone(Y.observation); o.id = 'o-ops'; o.empreintesOperationsExaminees[0].empreinte = H('0');
  const lignes = { ...l, observations: [...l.observations, o] };
  assert.throws(() => contexte(lignes, o.id), (e) => e instanceof TypeError && /contrat mécanique/.test(e.message));
});

// ============================================================================ E. IMMUTABILITÉ HISTORIQUE
test('E1. O1 garde exactement sa preuve initiale quand un autre contrat de catégorie existe ensuite : aucune mise à jour rétroactive', async () => {
  const m = magasinMemoireVive();
  const O1 = await ecrire(m, PREUVE());
  const fige = JSON.stringify(O1);
  const autreContrat = contratEntreesProduction(); autreContrat.acces.champ = 'provenance';
  const autreEmpreinte = sha256Hex(canoniserContratCategorie(autreContrat));
  assert.notEqual(autreEmpreinte, empreinteContratEntreesProduction());
  const O2 = await ecrire(m, [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: autreEmpreinte }]);
  const lignes = await m.lireTout('observationsPossibilites');
  assert.equal(JSON.stringify(lignes.find((x) => x.id === O1.id)), fige);
  assert.equal(lignes.find((x) => x.id === O2.id).empreintesCategoriesDonnees[0].empreinte, autreEmpreinte);
  assert.notEqual(O1.empreintesCategoriesDonnees[0].empreinte, O2.empreintesCategoriesDonnees[0].empreinte);
});
test('E2. une observation du flux, relue après d\'autres tours et d\'autres productions, est identique octet pour octet', async () => {
  const w = monde();
  await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const O1 = (await w.lire()).observations[0];
  const fige = JSON.stringify(O1);
  await w.lancer('salut Pixel', 'symbolesDeChaine'); await w.lancer('tour P', 'elementsObservables'); await w.tour('fin');
  assert.equal(JSON.stringify((await w.lire()).observations.find((x) => x.id === O1.id)), fige);
});

// ============================================================================ F. SNAPSHOT INCHANGÉ
test('F1. MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) est désormais exposée dans les nouveaux snapshots (une par exécution présente) ; v0.63.57 ne l\'exposait pas', async () => {
  const { l } = await chaine();
  for (const o of l.observations) {
    const executions = o.donneesExaminees.filter((id) => l.executions.some((e) => e.id === id));
    const entrees = o.donneesExaminees.filter((id) => estIdentiteEntrees(id));
    assert.deepEqual(entrees.sort(), executions.map((p) => PREFIXE_IDENTITE_ENTREES + p).sort());
    assert.deepEqual(contexte(l, o.id).univers.map((u) => u.donnee.identite), o.donneesExaminees);
  }
});
test('F2. le nombre de données et d\'atomes est celui du calcul indépendant : données = message + productions décrites ; atomes = possibilitesDeLiaison sur ces données (rien en plus)', async () => {
  const { l } = await chaine();
  const { resoudreIdentitesDonnees } = await import('../app/langage/resoudre-identites.js');
  const { possibilitesDeLiaison } = await import('../app/langage/possibilites-liaison.js');
  for (const o of l.observations) {
    const donnees = resoudreIdentitesDonnees(o.donneesExaminees, l.valeurs, l.executions, C16).map((x) => x.donnee);
    const atomes = possibilitesDeLiaison(donnees, C16);
    assert.equal(o.possibilites.length, atomes.length);
    assert.equal(o.donneesExaminees.length, donnees.length);
  }
});
test('F3. MISE À JOUR DÉLIBÉRÉE v0.63.59 : observation-possibilites.js utilise les constantes et la dérivation de v0.63.55 (sans les redéfinir) pour entrées(P) ; il n\'appelle toujours pas resoudreIdentitesDonnees', () => {
  const code = sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'));
  assert.equal(/productionDesEntrees|estIdentiteEntrees|resoudreIdentitesDonnees/.test(code), false);
  assert.equal(/identiteEntreesProduction\(/.test(code) && /entreesDeProduction\(/.test(code), true);
});

// ============================================================================ G. ÉCHEC DU CALCUL
test('G1. échec du CALCUL de la preuve de catégorie : echec_calcul, enregistrer n\'est JAMAIS appelé, aucune observation (copie temporaire du code dont la primitive lève)', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'obs57-'));
  try {
    cpSync(join(RACINE, 'app', 'langage'), dossier, { recursive: true });
    const p = join(dossier, 'empreinte-categorie-entrees.js');
    const s = readFileSync(p, 'utf8');
    assert.equal(s.includes('export function empreinteContratEntreesProduction() {'), true);
    writeFileSync(p, s.replace('export function empreinteContratEntreesProduction() {', "export function empreinteContratEntreesProduction() {\n  throw new TypeError('panne simulée');"));
    const { observerPossibilites: observer } = await import(pathToFileURL(join(dossier, 'observation-possibilites.js')).href);
    let appels = 0;
    const magasin = magasinMemoireVive();
    const message = identifierMessage('bonjour', { nouvelId: (q) => `${q}-1` });
    const r = await observer(message, { enregistrer: (o) => { appels += 1; return enregistrerObservationPossibilites(magasin, o); }, lireExecutions: () => magasin.lireTout('executionsOperations') });
    assert.deepEqual({ statut: r.statut, observation: r.observation, univers: r.univers }, { statut: 'echec_calcul', observation: null, univers: null });
    assert.equal(appels, 0);
    assert.equal(await nbLignes(magasin), 0);
  } finally { rmSync(dossier, { recursive: true, force: true }); }
});
test('G2. échec de l\'ÉCRITURE (le producteur transmet une preuve de catégorie invalide) : echec_ecriture, aucune observation persistée, le tour ne lève pas', async () => {
  const w = monde({ enregistrerSur: (o) => ({ ...o, empreintesCategoriesDonnees: [{ categorie: 'autre', empreinte: H('1') }] }) });
  const r = await w.tour('x');
  assert.deepEqual({ statut: r.statut, observation: r.observation, univers: r.univers }, { statut: 'echec_ecriture', observation: null, univers: null });
  assert.equal((await w.lire()).observations.length, 0);
});
test('G3. testable seulement par copie temporaire du code : aucune API n\'a été ajoutée pour injecter une panne (observerPossibilites garde ses paramètres)', () => {
  assert.equal(/panne|simul|injecter/i.test(sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'))), false);
  assert.equal(observerPossibilites.length, 1 + 0, 'signature inchangée : (message, options)');
});

// ============================================================================ H. INTERACTION AVEC LES EMPREINTES D'OPÉRATIONS
test('H1. les deux preuves sont DISTINCTES et indépendantes : empreintesOperationsExaminees inchangée (= empreintesDesContrats du catalogue examiné), preuve de catégorie indépendante du catalogue', async () => {
  const sous = C16.filter((d) => ['symbolesDeChaine', 'elementsObservables'].includes(d.nom));
  const complet = monde(); const reduit = monde({ descriptions: sous }); const vide = monde({ descriptions: [] });
  const [a, b, c] = [await complet.tour('x'), await reduit.tour('x'), await vide.tour('x')];
  assert.deepEqual(a.observation.empreintesOperationsExaminees, empreintesDesContrats(C16));
  assert.deepEqual(b.observation.empreintesOperationsExaminees, empreintesDesContrats(sous));
  assert.deepEqual(c.observation.empreintesOperationsExaminees, []);
  for (const o of [a, b, c]) assert.deepEqual(o.observation.empreintesCategoriesDonnees, PREUVE2());
  assert.equal(JSON.stringify(a.observation.empreintesOperationsExaminees).includes(CATEGORIE_ENTREES_PRODUCTION), false, 'les systèmes ne sont pas fusionnés');
});
test('H2. changer le contrat d\'UNE opération ne change que la preuve des opérations ; la preuve de catégorie reste identique', async () => {
  const modifiee = C16.map((d) => { if (d.nom !== 'symbolesDeChaine') return d; const c = clone(d); c.entrees.chaine.peutEtreNull = true; return c; });
  const a = await monde().tour('x'); const b = await monde({ descriptions: modifiee }).tour('x');
  assert.notDeepEqual(a.observation.empreintesOperationsExaminees, b.observation.empreintesOperationsExaminees);
  assert.deepEqual(a.observation.empreintesCategoriesDonnees, b.observation.empreintesCategoriesDonnees);
});

// ============================================================================ I. AUCUN AUTRE EFFET
test('I1. PAS de table, de migration ni de version : VERSION_BASE 19, schéma 9, 22 tables, catalogue 16 ; la ligne tient dans la table existante (relecture JSON stable)', async () => {
  assert.equal(VERSION_BASE, 20); assert.equal(SCHEMA_SAUVEGARDE, 10); assert.equal(TABLES.length, 23); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables)
  assert.equal(C16.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  const { Y } = await chaine();
  assert.deepEqual(JSON.parse(JSON.stringify(Y.observation)), Y.observation);
});
test('I2. MISE À JOUR DÉLIBÉRÉE v0.63.58 : resoudre-identites.js ne nomme pas la preuve ; seuls le producteur (écriture) et le contexte (vérification) importent le module de contrat ; aucun autre consommateur', () => {
  const sources = [];
  const parcourir = (d) => { for (const n of readdirSync(d)) { const q = join(d, n); if (statSync(q).isDirectory()) parcourir(q); else if (/\.(m?js|html)$/.test(n)) sources.push(q); } };
  parcourir(join(RACINE, 'app'));
  const importeurs = sources.filter((f) => /empreinteContratEntreesProduction|CATEGORIE_ENTREES_PRODUCTION/.test(sansCommentaires(readFileSync(f, 'utf8')))).map((f) => f.slice(RACINE.length + 1).split('\\').join('/')).sort();
  assert.deepEqual(importeurs, ['app/langage/contexte-observation.js', 'app/langage/empreinte-categorie-entrees.js', 'app/langage/observation-possibilites.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.58 : + contexte-observation.js (vérifie la preuve)
  assert.equal(/empreintesCategoriesDonnees/.test(sansCommentaires(lu('app', 'langage', 'resoudre-identites.js'))), false);
});
test('I3. SURCOÛT mesuré : la preuve ajoute exactement la clé sérialisée (v0.63.65 : deux entrées { categorie, empreinte })', async () => {
  const { Y } = await chaine();
  const { empreintesCategoriesDonnees, ...sans } = Y.observation; // MISE À JOUR DÉLIBÉRÉE v0.63.62 : la preuve relationnelle (9 clés) reste dans `sans` : seul le surcoût de la preuve de catégorie est mesuré
  const surcout = JSON.stringify(Y.observation).length - JSON.stringify(sans).length;
  assert.equal(surcout, `,"empreintesCategoriesDonnees":${JSON.stringify(empreintesCategoriesDonnees)}`.length);
  assert.ok(surcout > 64 && surcout < 300); // MISE À JOUR DÉLIBÉRÉE v0.63.65 : deux entrées (borne portée de 200 à 300)
});
