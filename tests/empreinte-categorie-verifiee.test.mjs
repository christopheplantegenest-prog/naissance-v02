// v0.63.58 — « VÉRIFIER LA PREUVE DU CONTRAT DE CATÉGORIE » (décision ChatGPT, 06/10/2026).
// resoudreContexteObservation vérifie STRICTEMENT empreintesCategoriesDonnees (lignes 8 clés) avec la SEULE source empreinteContratEntreesProduction() ;
// les lignes 6/7 restent sous le régime historique (garantie faible), sans preuve inventée ni mutation. Aucun snapshot entrées(P).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { CATEGORIE_ENTREES_PRODUCTION, empreinteContratEntreesProduction, contratEntreesProduction, canoniserContratCategorie } from '../app/langage/empreinte-categorie-entrees.js';
import { PREFIXE_IDENTITE_ENTREES, estIdentiteEntrees, FORME_ENTREES_PRODUCTION } from '../app/langage/entrees-donnee.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
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
const CLES8 = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'empreintesContratsRelationnels', 'possibilites']; // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
const PREUVE = () => [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: empreinteContratEntreesProduction() }];
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


// ---------------------------------------------------------------------------- montage : copie temporaire du code (jamais le dépôt) avec dérive du contrat
async function contexteDeCopie(modifier) {
  const dossier = mkdtempSync(join(tmpdir(), 'ctx58-'));
  cpSync(join(RACINE, 'app', 'langage'), dossier, { recursive: true });
  modifier(dossier);
  const m = await import(pathToFileURL(join(dossier, 'contexte-observation.js')).href);
  const c = await import(pathToFileURL(join(dossier, 'empreinte-categorie-entrees.js')).href);
  return { resoudre: m.resoudreContexteObservation, empreinte: c.empreinteContratEntreesProduction(), nettoyer: () => rmSync(dossier, { recursive: true, force: true }) };
}
const patcher = (dossier, fichier, de, vers) => {
  const p = join(dossier, fichier); const s = readFileSync(p, 'utf8');
  assert.equal(s.includes(de), true, `motif introuvable : ${de}`);
  writeFileSync(p, s.replace(de, vers));
};
const sans = (o, ...cles) => { const c = { ...o }; for (const k of cles) delete c[k]; return c; };
const en7 = (o, id) => ({ ...sans(o, 'empreintesContratsRelationnels', 'empreintesCategoriesDonnees'), id }); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
const en6 = (o, id) => ({ ...sans(o, 'empreintesContratsRelationnels', 'empreintesCategoriesDonnees', 'empreintesOperationsExaminees'), id }); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
const avec = (l, ...obs) => ({ ...l, observations: [...l.observations, ...obs] });
const resoudreCopie = (resoudre, l, id) => resoudre(id, l.observations, l.valeurs, l.executions, C16);
const refus = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const CAT = /contrat de la catégorie|empreintesCategoriesDonnees/;

// ============================================================================ A. PREUVE CORRECTE
test('A1. TEST CENTRAL : une observation réelle 8 clés sous le contrat courant est rendue : { observation: MÊME référence, univers }, sans mutation', async () => {
  const { l, Y } = await chaine();
  const O = Y.observation; const avant = JSON.stringify(l);
  const r = contexte(l, O.id);
  assert.deepEqual(Object.keys(r), ['observation', 'univers']);
  assert.equal(r.observation, l.observations.find((x) => x.id === O.id), 'la ligne persistée elle-même, jamais copiée');
  assert.deepEqual(r.univers.map((u) => u.donnee.identite), O.donneesExaminees);
  assert.equal(JSON.stringify(l), avant, 'aucune mutation des lignes');
  assert.deepEqual(Object.keys(r.observation), CLES8);
});
test('A2. toutes les observations 8 clés de la chaîne réelle (avant et après des productions) sont rendues', async () => {
  const { l } = await chaine();
  assert.ok(l.observations.length >= 2);
  for (const o of l.observations) { assert.deepEqual(Object.keys(o), CLES8); assert.equal(contexte(l, o.id).observation, o); }
});

// ============================================================================ B. PREUVE PÉRIMÉE (CHANGEMENT CENTRAL)
test('B1. TEST CENTRAL : même observation, SEULE l\'empreinte de catégorie remplacée par un autre hex64 valide : TypeError (v0.63.57 la rendait encore)', async () => {
  const { l, Y } = await chaine();
  const perimee = { ...Y.observation, id: 'obs-perimee', empreintesCategoriesDonnees: [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('c') }] };
  assert.notEqual(H('c'), empreinteContratEntreesProduction());
  const lignes = avec(l, perimee);
  refus(() => contexte(lignes, 'obs-perimee'), /contrat de la catégorie « entrees-de-production » a changé/);
  assert.deepEqual(contexte(lignes, Y.observation.id).univers.map((u) => u.donnee), contexte(l, Y.observation.id).univers.map((u) => u.donnee), 'les autres lignes sont inchangées');
});
test('B2. la preuve est refusée AVANT de rendre un univers : une preuve périmée sur des données non résolubles est refusée pour sa PREUVE (pas pour la résolution)', async () => {
  const { l, Y } = await chaine();
  const perimee = { ...Y.observation, id: 'obs-p2', empreintesCategoriesDonnees: [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('d') }] };
  const lignes = avec(l, perimee);
  refus(() => resoudreContexteObservation('obs-p2', lignes.observations, [], [], C16), /contrat de la catégorie/);
  const bonne = { ...Y.observation, id: 'obs-b2' };
  refus(() => resoudreContexteObservation('obs-b2', avec(l, bonne).observations, [], [], C16), /non résoluble/);
});
test('B3. aucun résultat partiel : la refus ne rend rien, ne mute ni ligne ni contrat', async () => {
  const { l, Y } = await chaine();
  const perimee = gelProfond({ ...clone(Y.observation), id: 'obs-p3', empreintesCategoriesDonnees: [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: H('e') }] });
  const lignes = avec(l, perimee); const avant = JSON.stringify(lignes); const contrat = JSON.stringify(contratEntreesProduction());
  let rendu = 'rien';
  try { rendu = contexte(lignes, 'obs-p3'); } catch (e) { assert.ok(e instanceof TypeError); }
  assert.equal(rendu, 'rien');
  assert.equal(JSON.stringify(lignes), avant); assert.equal(JSON.stringify(contratEntreesProduction()), contrat);
});

// ============================================================================ C. ABSENCE vs PRÉSENCE INVALIDE
test('C1. A. champ ABSENT sur ligne 6/7 : régime historique accepté (rendue, aucune preuve inventée)', async () => {
  const { l, Y } = await chaine();
  const o7 = en7(Y.observation, 'o-7'); const o6 = en6(Y.observation, 'o-6');
  const lignes = avec(l, o7, o6);
  for (const o of [o7, o6]) { const r = contexte(lignes, o.id); assert.equal(r.observation, o); assert.equal('empreintesCategoriesDonnees' in r.observation, false); }
  assert.deepEqual(Object.keys(o7), CLES7.map((k) => k)); assert.deepEqual(Object.keys(o6), CLES6);
});
const INVALIDES = {
  'B. présente mais undefined': () => undefined,
  'C. tableau vide': () => [],
  'D. mauvais format de hash (court)': () => [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: 'abc' }],
  'D2. hash hex64 MAJUSCULES': () => [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: empreinteContratEntreesProduction().toUpperCase() }],
  'D3. hash non chaîne': () => [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: 12 }],
  'E. mauvaise catégorie': () => [{ categorie: 'autre-categorie', empreinte: empreinteContratEntreesProduction() }],
  'E2. catégorie absente': () => [{ empreinte: empreinteContratEntreesProduction(), x: 1 }],
  'F. entrée supplémentaire': () => [...PREUVE(), { categorie: 'autre', empreinte: H('1') }],
  'F2. même entrée en double': () => [...PREUVE(), ...PREUVE()],
  'G. clé supplémentaire dans l\'entrée': () => [{ ...PREUVE()[0], extra: 1 }],
  'G2. clé manquante dans l\'entrée': () => [{ categorie: CATEGORIE_ENTREES_PRODUCTION }],
  'H. null': () => null,
  'I. chaîne': () => 'entrees-de-production',
  'J. objet au lieu d\'un tableau': () => ({ 0: PREUVE()[0], length: 1 }),
  'K. entrée null': () => [null],
  'L. entrée tableau': () => [[]],
  'M. entrée chaîne': () => ['x'],
  'N. prototype non simple': () => [Object.assign(Object.create({ heritage: 1 }), PREUVE()[0])],
  'O. tableau creux': () => new Array(1),
  'P. accesseur sur l\'élément': () => { const t = []; Object.defineProperty(t, 0, { get: () => PREUVE()[0], enumerable: true }); return t; },
  'Q. accesseur sur empreinte': () => { const e = { categorie: CATEGORIE_ENTREES_PRODUCTION }; Object.defineProperty(e, 'empreinte', { get: () => empreinteContratEntreesProduction(), enumerable: true }); return [e]; },
  'R. accesseur sur categorie': () => { const e = { empreinte: empreinteContratEntreesProduction() }; Object.defineProperty(e, 'categorie', { get: () => CATEGORIE_ENTREES_PRODUCTION, enumerable: true }); return [e]; },
};
for (const [nom, fabrique] of Object.entries(INVALIDES)) {
  test(`C2. PRÉSENCE INVALIDE refusée, sans repli vers le régime ancien — ${nom}`, async () => {
    const { l, Y } = await chaine();
    const o = { ...Y.observation, id: 'o-inv', empreintesCategoriesDonnees: fabrique() };
    assert.equal(Object.prototype.hasOwnProperty.call(o, 'empreintesCategoriesDonnees'), true);
    refus(() => contexte(avec(l, o), 'o-inv'), /empreintesCategoriesDonnees|mal formée/);
  });
}
test('C3. un 8e champ avec symbole ou clé étrangère reste refusé (clés closes)', async () => {
  const { l, Y } = await chaine();
  refus(() => contexte(avec(l, { ...Y.observation, id: 'o-x', extra: 1 }), 'o-x'), /mal formée/);
  refus(() => contexte(avec(l, { ...Y.observation, id: 'o-s', [Symbol('s')]: 1 }), 'o-s'), /mal formée/);
});
test('C4. catégories SANS preuve des opérations (hybride) : toujours refusé', async () => {
  const { l, Y } = await chaine();
  refus(() => contexte(avec(l, { ...sans(Y.observation, 'empreintesOperationsExaminees'), id: 'o-h' }), 'o-h'), /exige empreintesOperationsExaminees/);
});

// ============================================================================ D. DÉRIVES RÉELLES DU CONTRAT (copie temporaire) : seule la PREUVE de catégorie fait refuser
async function demontrerDerive(modifier, rang = null) { // MISE À JOUR DÉLIBÉRÉE v0.63.59 : `rang` choisit une observation de la chaîne (par défaut la dernière, qui contient des entrées(P))
  const { l, Y } = await chaine();
  const O = rang === null ? Y.observation : l.observations[rang];
  const copie = await contexteDeCopie(modifier);
  try {
    assert.notEqual(copie.empreinte, empreinteContratEntreesProduction(), 'le contrat courant de la copie a bien dérivé');
    const ligne8 = { ...O, id: 'o-8' };               // porte la preuve v1
    const ligne7 = en7(O, 'o-7');                      // même ligne, sans preuve de catégorie
    const ligne6 = en6(O, 'o-6');
    const lignes = avec(l, ligne8, ligne7, ligne6);
    refus(() => resoudreCopie(copie.resoudre, lignes, 'o-8'), /contrat de la catégorie « entrees-de-production » a changé/);
    // même ligne, mêmes atomes, mêmes empreintes d'OPÉRATIONS : c'est donc bien la preuve de catégorie qui refuse
    const r7 = resoudreCopie(copie.resoudre, lignes, 'o-7'); const r6 = resoudreCopie(copie.resoudre, lignes, 'o-6');
    assert.equal(r7.observation, ligne7); assert.equal(r6.observation, ligne6);
    assert.deepEqual(ligne8.possibilites, ligne7.possibilites, 'possibilités persistées identiques');
    assert.deepEqual(ligne8.empreintesOperationsExaminees, ligne7.empreintesOperationsExaminees);
    assert.deepEqual(r7.univers.map((u) => u.donnee.identite), O.donneesExaminees);
    // et sous le code RÉEL (non dérivé), la ligne 8 clés est rendue
    assert.equal(contexte(lignes, 'o-8').observation, ligne8);
    return copie;
  } finally { copie.nettoyer(); }
}
test('D1. J10-CATÉGORIE : forme v1 → v2 (entree chaine → nombre), mêmes atomes C16 : la preuve v1 est REFUSÉE ; la même ligne sans preuve de catégorie (7 clés) est rendue (garantie faible)', async () => {
  const forme = "entree: { forme: 'scalaire', genre: 'chaine' },";
  await demontrerDerive((d) => patcher(d, 'entrees-donnee.js', forme, "entree: { forme: 'scalaire', genre: 'nombre' },"));
  const v2 = await contexteDeCopie((d) => patcher(d, 'entrees-donnee.js', forme, "entree: { forme: 'scalaire', genre: 'nombre' },"));
  v2.nettoyer();
  const atomes = (f) => possibilitesDeLiaison([{ identite: 'sonde', forme: clone(f) }], C16).map((a) => `${a.operation}.${a.entree}`).sort();
  assert.deepEqual(atomes(FORME_ENTREES_PRODUCTION), ['couvrirSequence.elements', 'parcourirStructure.valeur']);
});
test('D2. DÉRIVE D\'ACCÈS : { champ: \'entrees\' } → autre chose : la preuve refuse, les atomes et les empreintes d\'opérations sont intacts', async () => {
  await demontrerDerive((d) => patcher(d, 'entrees-donnee.js', "Object.freeze({ champ: 'entrees' })", "Object.freeze({ champ: 'provenance' })"));
});
test('D3. DÉRIVE D\'IDENTITÉ (préfixe) : la preuve refuse', async () => {
  // MISE À JOUR DÉLIBÉRÉE v0.63.59 : les observations contenant entrées(P) portent des identités à l'ANCIEN préfixe, que le code dérivé ne sait plus résoudre ; on démontre donc sur la
  // PREMIÈRE observation (sans production, donc sans entrées(P)) que seule la preuve refuse, puis que la ligne avec entrées(P) est refusée aussi.
  await demontrerDerive((d) => patcher(d, 'entrees-donnee.js', "'entrees-de-production:'", "'entrees-de-prod:'"), 0);
  const { l, Y } = await chaine();
  const copie = await contexteDeCopie((d) => patcher(d, 'entrees-donnee.js', "'entrees-de-production:'", "'entrees-de-prod:'"));
  try {
    refus(() => resoudreCopie(copie.resoudre, avec(l, { ...Y.observation, id: 'o-8' }), 'o-8'), /contrat de la catégorie/);
    refus(() => resoudreCopie(copie.resoudre, avec(l, en7(Y.observation, 'o-7')), 'o-7'), /non résoluble/); // la même ligne sans preuve de catégorie n'est PAS rendue : son univers n'est plus résoluble
  } finally { copie.nettoyer(); }
});
test('D4. DÉRIVE D\'IDENTITÉ (comportement sondé, préfixe identique) : la preuve refuse', async () => {
  await demontrerDerive((d) => patcher(d, 'entrees-donnee.js', "  if (idProduction.startsWith(PREFIXE_IDENTITE_ENTREES)) refuser(NOM,", "  if (false) refuser(NOM,"));
  await demontrerDerive((d) => patcher(d, 'entrees-donnee.js', "return reste.length > 0 && !reste.startsWith(PREFIXE_IDENTITE_ENTREES);", "return reste.length > 0;"));
});
test('D5. une copie NON dérivée accepte la ligne 8 clés (le montage est fidèle)', async () => {
  const { l, Y } = await chaine();
  const copie = await contexteDeCopie(() => {});
  try {
    assert.equal(copie.empreinte, empreinteContratEntreesProduction());
    assert.equal(resoudreCopie(copie.resoudre, avec(l, { ...Y.observation, id: 'o-ok' }), 'o-ok').observation.id, 'o-ok');
  } finally { copie.nettoyer(); }
});
test('D6. une dérive NEUTRE (commentaire, reformatage) ne refuse pas : on protège le contrat, pas l\'implémentation', async () => {
  const { l, Y } = await chaine();
  const copie = await contexteDeCopie((d) => patcher(d, 'entrees-donnee.js', "const NOM = 'identiteEntreesProduction';", "// commentaire ajouté\nconst NOM = 'identiteEntreesProduction';"));
  try { assert.equal(resoudreCopie(copie.resoudre, avec(l, { ...Y.observation, id: 'o-n' }), 'o-n').observation.id, 'o-n'); } finally { copie.nettoyer(); }
});

// ============================================================================ E. RÉGIME 6/7 : GARANTIE FAIBLE HISTORIQUE
test('E1. sous une dérive NEUTRE de la catégorie, une ligne 6 ou 7 clés est encore reconstruite (garantie faible : elle n\'a jamais prétendu posséder cette preuve) ; aucune empreinte inventée, aucune mutation', async () => {
  const { l, Y } = await chaine();
  const o7 = gelProfond(en7(clone(Y.observation), 'e-7')); const o6 = gelProfond(en6(clone(Y.observation), 'e-6'));
  const lignes = avec(l, o7, o6); const avant = JSON.stringify(lignes);
  const copie = await contexteDeCopie((d) => patcher(d, 'entrees-donnee.js', "entree: { forme: 'scalaire', genre: 'chaine' },", "entree: { forme: 'scalaire', genre: 'nombre' },"));
  try {
    for (const o of [o7, o6]) {
      const r = resoudreCopie(copie.resoudre, lignes, o.id);
      assert.equal(r.observation, o);
      assert.equal(Reflect.ownKeys(r.observation).includes('empreintesCategoriesDonnees'), false);
    }
    assert.deepEqual(Object.keys(o7), CLES7); assert.deepEqual(Object.keys(o6), CLES6);
    assert.equal(JSON.stringify(lignes), avant);
  } finally { copie.nettoyer(); }
});
test('E2. les lignes 6 et 7 clés restent lisibles sous le code réel, et le régime 7 clés vérifie toujours la preuve des opérations', async () => {
  const { l, Y } = await chaine();
  const o7 = en7(Y.observation, 'f-7'); const o6 = en6(Y.observation, 'f-6');
  assert.equal(contexte(avec(l, o7, o6), 'f-7').observation, o7);
  assert.equal(contexte(avec(l, o7, o6), 'f-6').observation, o6);
  const o7p = clone(o7); o7p.id = 'f-7p'; o7p.empreintesOperationsExaminees[0].empreinte = H('0');
  refus(() => contexte(avec(l, o7p), 'f-7p'), /contrat mécanique/);
});
test('E3. aucune migration : 6/7 ne deviennent jamais 8 ; la lecture ne persiste rien (magasin identique avant/après)', async () => {
  const w = monde(); await w.tour('a');
  const o = (await w.lire()).observations[0];
  const avant = JSON.stringify(await w.lire());
  const l = await w.lire();
  contexte(avec(l, en6(o, 'g-6'), en7(o, 'g-7')), 'g-6'); contexte(avec(l, en6(o, 'g-6'), en7(o, 'g-7')), 'g-7'); contexte(l, o.id);
  assert.equal(JSON.stringify(await w.lire()), avant);
});

// ============================================================================ F. INTERACTION AVEC LA PREUVE DES OPÉRATIONS
test('F1. quatre combinaisons : ops valides + cat valide → accepte ; ops invalides + cat valide → refuse ; ops valides + cat invalide → refuse ; les deux invalides → refuse sans résultat partiel', async () => {
  const { l, Y } = await chaine();
  const ok = { ...clone(Y.observation), id: 'x-ok' };
  const opsKo = clone(Y.observation); opsKo.id = 'x-ops'; opsKo.empreintesOperationsExaminees[0].empreinte = H('0');
  const catKo = clone(Y.observation); catKo.id = 'x-cat'; catKo.empreintesCategoriesDonnees[0].empreinte = H('2');
  const deux = clone(Y.observation); deux.id = 'x-deux'; deux.empreintesOperationsExaminees[0].empreinte = H('0'); deux.empreintesCategoriesDonnees[0].empreinte = H('2');
  const lignes = avec(l, ok, opsKo, catKo, deux);
  assert.equal(contexte(lignes, 'x-ok').observation, lignes.observations.find((x) => x.id === 'x-ok'));
  refus(() => contexte(lignes, 'x-ops'), /contrat mécanique/);
  refus(() => contexte(lignes, 'x-cat'), /contrat de la catégorie/);
  refus(() => contexte(lignes, 'x-deux'), /contrat mécanique/); // ORDRE DÉTERMINISTE DOCUMENTÉ : la preuve des opérations est vérifiée avant celle de la catégorie
});
test('F2. ORDRE DÉTERMINISTE : la STRUCTURE de la preuve de catégorie est contrôlée avant le catalogue ; sa COMPARAISON après les empreintes d\'opérations et avant la reconstruction', async () => {
  const { l, Y } = await chaine();
  const struct = { ...Y.observation, id: 'y-s', empreintesCategoriesDonnees: [] };
  refus(() => resoudreContexteObservation('y-s', avec(l, struct).observations, l.valeurs, l.executions, []), /empreintesCategoriesDonnees/);
  const valide = { ...Y.observation, id: 'y-v' };
  refus(() => resoudreContexteObservation('y-v', avec(l, valide).observations, l.valeurs, l.executions, []), /catalogue fourni/);
  const code = lu('app', 'langage', 'contexte-observation.js');
  assert.match(code, /ORDRE EXACT DES CONTRÔLES \(v0\.63\.58\)/);
  const nu = sansCommentaires(code);
  const pos = (m) => nu.indexOf(m);
  assert.ok(pos('const preuve = avecEmpreintes') < pos('lirePreuveCategories(lirePropre') && pos('lirePreuveCategories(lirePropre') < pos('const persistees = new Map()'));
  assert.ok(pos('empreintesDesContrats(sousCatalogue)') < pos('empreinteContratEntreesProduction()') && pos('empreinteContratEntreesProduction()') < pos('resoudreIdentitesDonnees(donneesExaminees'));
});

// ============================================================================ G. SOURCE UNIQUE DU RECALCUL
test('G1. le contexte recalcule UNIQUEMENT par empreinteContratEntreesProduction() : ni forme, ni accès, ni préfixe, ni sondes, ni hachage, ni canonisation', () => {
  const code = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
  assert.match(code, /empreinteContratEntreesProduction\(\)/);
  assert.equal(/canoniqueContrat|contratEntreesProduction|canoniserContratCategorie|FORME_ENTREES|ACCES_ENTREES|PREFIXE_IDENTITE|entrees-donnee|sha256|crypto|entreesDeProduction/.test(code), false);
  assert.deepEqual([...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./empreinte-categorie-entrees.js', './empreinte-contrats.js', './possibilites-liaison.js', './resoudre-identites.js']);
  assert.equal(/persistee\.categorie === |categorie !== CATEGORIE_ENTREES_PRODUCTION/.test(code), true);
});
test('G2. dormance : le contexte n\'est toujours importé par aucun mécanisme du dépôt', () => {
  const sources = [];
  const parcourir = (d) => { for (const n of readdirSync(d)) { const q = join(d, n); if (statSync(q).isDirectory()) parcourir(q); else if (/\.(m?js|html)$/.test(n)) sources.push(q); } };
  parcourir(join(RACINE, 'app'));
  const importeurs = sources.filter((f) => /contexte-observation/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1).split('\\').join('/'));
  assert.deepEqual(importeurs.filter((f) => f !== 'app/langage/contexte-observation.js'), [], 'aucun importeur : le contexte reste dormant');
});

// ============================================================================ H. SNAPSHOT TOUJOURS INCHANGÉ
test('H1. MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) est présente dans les nouveaux snapshots ; les lignes 8 clés et leur version 7 clés ont mêmes données et mêmes atomes ; seule la preuve de catégorie diffère', async () => {
  const { l } = await chaine();
  let avecEntrees = 0;
  for (const o of l.observations) {
    const r8 = contexte(l, o.id); const r7 = contexte(avec(l, en7(o, 'h-7')), 'h-7');
    assert.deepEqual(r8.univers.map((u) => u.donnee), r7.univers.map((u) => u.donnee));
    assert.equal(r8.univers.length, o.donneesExaminees.length);
    assert.equal(r8.observation.possibilites.length, r7.observation.possibilites.length);
    if (o.donneesExaminees.some((id) => estIdentiteEntrees(id))) avecEntrees += 1;
  }
  assert.ok(avecEntrees > 0);
});

// ============================================================================ I. PURETÉ
test('I1. pureté : objets profondément gelés acceptés ; deux appels identiques ; synchrone ; aucun effet', async () => {
  const { l } = await chaine();
  const g = gelProfond(clone(l)); const avant = JSON.stringify(g);
  const o = g.observations[g.observations.length - 1];
  const r1 = resoudreContexteObservation(o.id, g.observations, g.valeurs, g.executions, gelProfond(clone(C16)));
  const r2 = resoudreContexteObservation(o.id, g.observations, g.valeurs, g.executions, gelProfond(clone(C16)));
  assert.equal(r1 instanceof Promise, false);
  assert.equal(r1.observation, o); assert.deepEqual(r1.univers, r2.univers);
  assert.equal(JSON.stringify(g), avant);
});
test('I2. pureté statique : ni horloge, ni hasard, ni identité, ni magasin, ni écriture, ni asynchronisme', () => {
  const code = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'setTimeout']) assert.equal(code.includes(interdit), false, interdit);
});

// ============================================================================ J. AUCUN AUTRE EFFET
test('J1. pas de table, de migration, de version ni de nouvelle opération ; producteur et validation d\'écriture inchangés', () => {
  assert.equal(VERSION_BASE, 19); assert.equal(SCHEMA_SAUVEGARDE, 9); assert.equal(TABLES.length, 22);
  assert.equal(C16.length, 16); assert.equal(Object.keys(TABLE_OPERATIONS).length, 16);
  assert.equal(/empreintesCategoriesDonnees|categorie/.test(sansCommentaires(lu('app', 'langage', 'resoudre-identites.js'))), false);
});
