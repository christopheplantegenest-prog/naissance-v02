// === DEBUT_TEST_LIEN_EXECUTION_DESIGNATION ===
// v0.63.23 — décision ChatGPT « LIEN EXÉCUTION → DÉSIGNATION — DORMANT — AUCUNE EXÉCUTION ACTIVE » (05/10/2026). Preuves que
// enregistrerExecutionOperation reçoit la LIGNE de désignation, vérifie sa cohérence (operation + liaisons canoniques), persiste
// idDesignation = designation.id sans jamais le recréer ni le chercher, refuse toute exécution sans désignation, laisse la ligne
// designations intacte, reste compatible avec productionsDecrites et valeurDePorteur, préserve les anciennes lignes telles quelles
// (aucune provenance fabriquée) et reste absolument dormante.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  enregistrerDesignation, enregistrerExecutionOperation, magasinMemoireVive, ouvrirIndexedDB, TABLES, CLE, VERSION_BASE, NOM_BASE,
} from '../app/langage/connaissances.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees } from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { ACCES_TRACE } from '../app/langage/acces-trace.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const T = 'executionsOperations';
const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CONN = lu('app', 'langage', 'connaissances.js');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const refuse = (p, motif) => assert.rejects(p, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const piegeSur = (objet, champ) => { Object.defineProperty(objet, champ, { enumerable: true, get() { throw new Error(`accesseur ${String(champ)} exécuté`); } }); return objet; };
const at = (donnee, operation, entree) => ({ donnee, operation, entree });
const R = [{ chemin: [], type: 'chaine', valeur: 'Bonjour' }];
const OBS = (extra = {}) => ({ id: 'observation-possibilites-1', idMessage: 'message-1', possibilites: [at('message-1', 'parcourirStructure', 'valeur'), at('A', 'memesCouvertures', 'a'), at('B', 'memesCouvertures', 'b'), at('A', 'memesCouvertures', 'b')], ...extra });
const APP = (extra = {}) => ({ operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'message-1' }], ...extra });
const APP2 = () => ({ operation: 'memesCouvertures', liaisons: [{ entree: 'b', donnee: 'B' }, { entree: 'a', donnee: 'A' }] });
const des = (m, application = APP(), observation = OBS()) => enregistrerDesignation(m, { observation, application, origine: 'exterieure' }); // MISE À JOUR DÉLIBÉRÉE v0.63.33 : origine explicite obligatoire
const lire = (d, c) => (d !== null && typeof d === 'object' ? d[c] : undefined);
const ex = (d, extra = {}) => ({ designation: d, ...('operation' in extra ? {} : { operation: lire(d, 'operation') }), ...('liaisons' in extra ? {} : { liaisons: lire(d, 'liaisons') }), resultat: R, ...extra });
function espion(echec = null) {
  const ecrits = [];
  return { ecrits, async ecrire(table, objet) { if (echec) throw echec; ecrits.push([table, objet]); }, async lireTout() { throw new Error('lecture interdite'); }, async lire() { throw new Error('lecture interdite'); } };
}
const DES = (extra = {}) => ({ id: 'designation-application-1', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'message-1' }], ...extra });

// ============================================================================ A. CONTRAT
test('A1. la ligne contient EXACTEMENT { id, horodatage, idDesignation, operation, liaisons, resultat } et idDesignation = designation.id', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const x = await enregistrerExecutionOperation(m, ex(d));
  assert.deepEqual(Object.keys(x), ['id', 'horodatage', 'idDesignation', 'operation', 'liaisons', 'resultat']);
  assert.equal(x.idDesignation, d.id);
  assert.match(x.id, /^execution-operation-\d+-\d+-\d+$/);
  assert.notEqual(x.idDesignation, x.id);
  assert.equal(Number.isNaN(Date.parse(x.horodatage)), false);
  assert.deepEqual(x.liaisons, [{ entree: 'valeur', donnee: 'message-1' }]);
  assert.deepEqual(x.resultat, R);
  for (const interdit of ['idObservation', 'succes', 'echec', 'erreur', 'statut', 'score', 'designation', 'idExecution']) assert.equal(interdit in x, false, interdit);
  assert.deepEqual(await m.lireTout(T), [x]);
});
test('A2. le contrat d\'entrée est clos : { designation, operation, liaisons, resultat } et rien d\'autre', async () => {
  const e = espion();
  await refuse(enregistrerExecutionOperation(e, { ...ex(DES()), idDesignation: 'x' }), /étranger/);
  await refuse(enregistrerExecutionOperation(e, { ...ex(DES()), score: 1 }), /étranger/);
  await refuse(enregistrerExecutionOperation(e, { ...ex(DES()), [Symbol('s')]: 1 }), /étranger/);
  const { resultat, ...sansResultat } = ex(DES());
  await refuse(enregistrerExecutionOperation(e, sansResultat), /resultat/);
  assert.deepEqual(e.ecrits, []);
});
test('A3. idDesignation seul (sans la ligne de désignation) est refusé : jamais un id fourni aveuglément', async () => {
  const e = espion();
  await refuse(enregistrerExecutionOperation(e, { idDesignation: 'designation-application-1', operation: 'parcourirStructure', liaisons: DES().liaisons, resultat: R }), /étranger|designation/);
  await refuse(enregistrerExecutionOperation(e, { designation: 'designation-application-1', operation: 'parcourirStructure', liaisons: DES().liaisons, resultat: R }), /désignation|designation/);
  assert.deepEqual(e.ecrits, []);
});
test('A4. deux exécutions de la même désignation : deux lignes, deux identités, même idDesignation (aucune fusion)', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const a = await enregistrerExecutionOperation(m, ex(d));
  const b = await enregistrerExecutionOperation(m, ex(d));
  assert.notEqual(a.id, b.id);
  assert.equal(a.idDesignation, b.idDesignation);
  assert.equal((await m.lireTout(T)).length, 2);
});

// ============================================================================ B. EXÉCUTION SANS DÉSIGNATION
test('B1. designation absente / null / undefined / primitive / tableau / vide : TypeError, aucune écriture', async () => {
  const e = espion();
  const { designation, ...sans } = ex(DES());
  await refuse(enregistrerExecutionOperation(e, sans), /designation/);
  for (const v of [null, undefined, 'x', 3, [], [DES()], true, () => DES()]) await refuse(enregistrerExecutionOperation(e, { ...sans, designation: v }));
  await refuse(enregistrerExecutionOperation(e, { ...sans, designation: {} }), /designation/);
  await refuse(enregistrerExecutionOperation(e, { operation: 'parcourirStructure', liaisons: DES().liaisons, resultat: R }), /designation/);
  assert.deepEqual(e.ecrits, []);
});
test('B2. désignation invalide : id, operation, liaisons absents / vides / non chaînes / sans entrées', async () => {
  const e = espion();
  const base = DES();
  for (const [champ, v] of [['id', ''], ['id', 7], ['id', null], ['operation', ''], ['operation', 3], ['liaisons', []], ['liaisons', 'valeur'], ['liaisons', null], ['liaisons', [{ entree: '', donnee: 'd' }]], ['liaisons', [{ entree: 'e', donnee: 3 }]], ['liaisons', [null]]]) {
    await refuse(enregistrerExecutionOperation(e, ex({ ...base, [champ]: v }, { operation: base.operation, liaisons: base.liaisons })));
  }
  for (const champ of ['id', 'operation', 'liaisons']) {
    const d = DES(); delete d[champ];
    await refuse(enregistrerExecutionOperation(e, ex(d, { operation: 'parcourirStructure', liaisons: base.liaisons })), new RegExp(`pas de champ « ${champ} »`));
  }
  assert.deepEqual(e.ecrits, []);
});
test('B3. désignation : accesseurs refusés SANS exécution (id, operation, liaisons, éléments, entree, donnee)', async () => {
  const e = espion();
  const sans = (champ) => { const d = DES(); delete d[champ]; return d; };
  const lia = DES().liaisons;
  await refuse(enregistrerExecutionOperation(e, ex(piegeSur(sans('id'), 'id'), { operation: 'parcourirStructure', liaisons: lia })), /accesseur/);
  await refuse(enregistrerExecutionOperation(e, ex(piegeSur(sans('operation'), 'operation'), { operation: 'parcourirStructure', liaisons: lia })), /accesseur/);
  await refuse(enregistrerExecutionOperation(e, ex(piegeSur(sans('liaisons'), 'liaisons'), { operation: 'parcourirStructure', liaisons: lia })), /accesseur/);
  await refuse(enregistrerExecutionOperation(e, ex(DES({ liaisons: [piegeSur({ donnee: 'message-1' }, 'entree')] }), { operation: 'parcourirStructure', liaisons: lia })), /accesseur/);
  await refuse(enregistrerExecutionOperation(e, ex(DES({ liaisons: [piegeSur({ entree: 'valeur' }, 'donnee')] }), { operation: 'parcourirStructure', liaisons: lia })), /accesseur/);
  const tab = [{ entree: 'valeur', donnee: 'message-1' }]; Object.defineProperty(tab, 0, { get() { throw new Error('exécuté'); }, enumerable: true });
  await refuse(enregistrerExecutionOperation(e, ex(DES({ liaisons: tab }), { operation: 'parcourirStructure', liaisons: lia })), /accesseur/);
  const d = { operation: 'parcourirStructure', liaisons: lia }; Object.defineProperty(d, 'id', { set() { throw new Error('s'); }, enumerable: true });
  await refuse(enregistrerExecutionOperation(e, ex(d, { operation: 'parcourirStructure', liaisons: lia })), /accesseur/);
  await refuse(enregistrerExecutionOperation(e, piegeSur({ operation: 'parcourirStructure', liaisons: lia, resultat: R }, 'designation')), /accesseur/);
  assert.deepEqual(e.ecrits, []);
});
test('B4. désignation : propriétés héritées refusées (id, operation, liaisons)', async () => {
  const e = espion();
  const lia = DES().liaisons;
  await refuse(enregistrerExecutionOperation(e, ex(Object.create(DES()), { operation: 'parcourirStructure', liaisons: lia })), /pas de champ/);
  await refuse(enregistrerExecutionOperation(e, ex(Object.assign(Object.create({ id: 'designation-application-1' }), { operation: 'parcourirStructure', liaisons: lia }), { operation: 'parcourirStructure', liaisons: lia })), /pas de champ « id »/);
  await refuse(enregistrerExecutionOperation(e, ex(DES({ liaisons: [Object.create({ entree: 'valeur', donnee: 'message-1' })] }), { operation: 'parcourirStructure', liaisons: lia })), /pas de champ/);
  assert.deepEqual(e.ecrits, []);
});
test('B5. la désignation ne doit lire NI horodatage NI idObservation : accesseurs piégés sur ces champs jamais exécutés ; les autres champs sont ignorés', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const piegee = { id: d.id, operation: d.operation, liaisons: d.liaisons };
  Object.defineProperty(piegee, 'horodatage', { enumerable: true, get() { throw new Error('horodatage lu'); } });
  Object.defineProperty(piegee, 'idObservation', { enumerable: true, get() { throw new Error('idObservation lu'); } });
  Object.defineProperty(piegee, 'champInconnu', { enumerable: true, get() { throw new Error('champ lu'); } });
  const x = await enregistrerExecutionOperation(m, ex(piegee, { operation: d.operation, liaisons: d.liaisons }));
  assert.equal(x.idDesignation, d.id);
  assert.equal(Object.keys(x).includes('idObservation'), false);
});
test('B6. une désignation gelée / sans prototype est acceptée et n\'est jamais modifiée', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const nu = Object.assign(Object.create(null), { id: d.id, operation: d.operation, liaisons: d.liaisons.map((l) => Object.freeze({ ...l })) });
  Object.freeze(nu); Object.freeze(nu.liaisons);
  const avant = JSON.stringify(nu);
  const x = await enregistrerExecutionOperation(m, ex(nu, { operation: d.operation, liaisons: d.liaisons }));
  assert.equal(JSON.stringify(nu), avant);
  assert.equal(x.idDesignation, d.id);
});

// ============================================================================ C. COHÉRENCE
async function incoherent(entreeModifiee, motif) {
  const e = espion();
  await refuse(enregistrerExecutionOperation(e, entreeModifiee), motif);
  assert.deepEqual(e.ecrits, []);
}
test('C1. opération différente (mêmes liaisons) : refusée, aucune écriture', async () => {
  await incoherent(ex(DES(), { operation: 'memesCouvertures' }), /operation diffère/);
  await incoherent(ex(DES({ operation: 'memesCouvertures' }), { operation: 'parcourirStructure' }), /operation diffère/);
  await incoherent(ex(DES(), { operation: 'parcourirstructure' }), /operation diffère/);
});
test('C2. bonne opération, mauvaise donnée : refusée', async () => {
  await incoherent(ex(DES(), { liaisons: [{ entree: 'valeur', donnee: 'message-2' }] }), /liaisons diffèrent/);
});
test('C3. bonne donnée, mauvaise entrée : refusée', async () => {
  await incoherent(ex(DES(), { liaisons: [{ entree: 'autre', donnee: 'message-1' }] }), /liaisons diffèrent/);
});
test('C4. liaison manquante / supplémentaire : refusée (comparaison complète, jamais partielle)', async () => {
  const d = DES({ operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'B' }] });
  await incoherent(ex(d, { liaisons: [{ entree: 'a', donnee: 'A' }] }), /nombre/);
  await incoherent(ex(DES(), { liaisons: [{ entree: 'valeur', donnee: 'message-1' }, { entree: 'extra', donnee: 'x' }] }), /nombre/);
  await incoherent(ex(DES({ operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'A' }] }), { operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'B' }] }), /nombre/);
  await incoherent(ex(d, { liaisons: [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'A' }] }), /liaisons diffèrent/);
  await incoherent(ex(d, { liaisons: [{ entree: 'a', donnee: 'B' }, { entree: 'b', donnee: 'A' }] }), /liaisons diffèrent/);
});
test('C5. doublon d\'entrée : refusé côté exécution comme côté désignation', async () => {
  await incoherent(ex(DES(), { liaisons: [{ entree: 'valeur', donnee: 'message-1' }, { entree: 'valeur', donnee: 'message-1' }] }), /dupliquée/);
  await incoherent(ex(DES({ liaisons: [{ entree: 'valeur', donnee: 'message-1' }, { entree: 'valeur', donnee: 'message-1' }] }), {}), /dupliquée/);
});
test('C6. l\'ORDRE des liaisons n\'a aucun sens : comparaison après normalisation canonique, ligne écrite canonique', async () => {
  const m = magasinMemoireVive();
  const d = await des(m, APP2());
  const inverse = [{ entree: 'b', donnee: 'B' }, { entree: 'a', donnee: 'A' }];
  const droit = [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'B' }];
  for (const [ld, le] of [[inverse, droit], [droit, inverse], [inverse, inverse], [droit, droit]]) {
    const x = await enregistrerExecutionOperation(m, { designation: { id: d.id, operation: d.operation, liaisons: ld }, operation: d.operation, liaisons: le, resultat: R });
    assert.deepEqual(x.liaisons, droit);
    assert.equal(x.idDesignation, d.id);
  }
});
test('C7. aucune clé étrangère dans une liaison de désignation ou d\'exécution', async () => {
  await incoherent(ex(DES({ liaisons: [{ entree: 'valeur', donnee: 'message-1', forme: 'f' }] }), {}), /étranger/);
  await incoherent(ex(DES(), { liaisons: [{ entree: 'valeur', donnee: 'message-1', forme: 'f' }] }), /étranger/);
});
test('C8. la cohérence est testée AVANT toute copie du résultat : un résultat invalide n\'écrase pas l\'erreur de cohérence, et inversement rien n\'est écrit', async () => {
  await incoherent(ex(DES(), { operation: 'memesCouvertures', resultat: undefined }), /operation diffère/);
  await incoherent(ex(DES(), { resultat: undefined }), /aucune valeur JSON/);
});

// ============================================================================ D. AUCUNE RECHERCHE
test('D1. la primitive ne lit JAMAIS le magasin : un magasin qui lève à la lecture ne gêne pas ; une seule écriture, table executionsOperations', async () => {
  const e = espion();
  const x = await enregistrerExecutionOperation(e, ex(DES()));
  assert.equal(e.ecrits.length, 1);
  assert.equal(e.ecrits[0][0], T);
  assert.equal(e.ecrits[0][1], x);
  assert.equal(x.idDesignation, 'designation-application-1');
});
test('D2. aucune recherche de désignation semblable / première / dernière : plusieurs désignations dans le magasin, celle FOURNIE est portée, même inconnue du magasin', async () => {
  const m = magasinMemoireVive();
  const d1 = await des(m); const d2 = await des(m); const d3 = await des(m);
  for (const fournie of [d1, d2, d3]) {
    const x = await enregistrerExecutionOperation(m, ex(fournie));
    assert.equal(x.idDesignation, fournie.id);
  }
  const inconnue = { id: 'designation-application-hors-magasin', operation: d1.operation, liaisons: d1.liaisons };
  assert.equal((await enregistrerExecutionOperation(m, ex(inconnue))).idDesignation, 'designation-application-hors-magasin');
});
test('D3. DÉSIGNATION IDENTIQUE DEUX FOIS (test central) : D1 et D2 même observation, même opération, mêmes liaisons ; l\'exécution écrite avec D2 porte D2.id, aucune inférence par contenu ne peut sélectionner D1', async () => {
  const m = magasinMemoireVive();
  const obs = OBS();
  const D1 = await des(m, APP(), obs);
  const D2 = await des(m, APP(), obs);
  assert.notEqual(D1.id, D2.id);
  assert.equal(D1.idObservation, D2.idObservation);
  assert.equal(D1.operation, D2.operation);
  assert.deepEqual(D1.liaisons, D2.liaisons);
  const X = await enregistrerExecutionOperation(m, ex(D2));
  assert.equal(X.idDesignation, D2.id);
  assert.notEqual(X.idDesignation, D1.id);
  const Y = await enregistrerExecutionOperation(m, ex(D1));
  assert.equal(Y.idDesignation, D1.id);
  // sens inverse (ordre d'écriture inversé) : aucune dépendance à l'ordre des lignes
  const m2 = magasinMemoireVive();
  const E2 = await des(m2, APP(), obs); const E1 = await des(m2, APP(), obs);
  assert.equal((await enregistrerExecutionOperation(m2, ex(E2))).idDesignation, E2.id);
  assert.equal((await enregistrerExecutionOperation(m2, ex(E1))).idDesignation, E1.id);
});
test('D4. le code de la primitive ne lit de la désignation que id, operation, liaisons ; ni horodatage, ni idObservation, ni magasin', () => {
  const a = CONN.indexOf('export async function enregistrerExecutionOperation('); const b = CONN.indexOf('// === FAIT PERSISTANT DE DÉSIGNATION');
  const code = sansCommentaires(CONN.slice(a, b));
  assert.deepEqual([...code.matchAll(/champPropreDonnee\(designation, '(\w+)'/g)].map((m) => m[1]), ['id', 'operation', 'liaisons']);
  assert.equal(/designation\.(horodatage|idObservation)|idObservation|\bhorodatage'/.test(code.replace(/horodatage: new Date\(\)\.toISOString\(\),/, '')), false);
  assert.equal(/magasin\.(lireTout|lire|supprimer|vider|remplacerTout)|designations/.test(code), false);
  assert.equal((code.match(/magasin\.ecrire\(/g) || []).length, 1);
  assert.match(code, /idDesignation,\n/); // idDesignation = designation.id lu et copié, jamais recréé
  assert.equal(/nouvelId\('designation|Math\.random|\.sort\(\(a, b\) => comparerCodes\(a\.donnee|\.find\(|\.at\(|\[0\]|\.pop\(|\.shift\(|reduce\(/.test(code), false);
  assert.equal((code.match(/nouvelId\(/g) || []).length, 1); // l'unique identité créée est celle de l'exécution
});
test('D5. la primitive n\'importe ni descriptions, ni groupes, ni invocation, ni table d\'opérations, ni productions', () => {
  const imports = (CONN.match(/^import\b[^;]*;/gm) || []).join('\n');
  assert.equal(/descriptions-operations|groupes-candidats|invocation-operations|table-operations|productions-decrites|possibilites-liaison|acces-valeur|acces-trace|formes-operation/.test(imports), false);
});

// ============================================================================ E. DÉSIGNATION INTACTE
test('E1. la ligne designations n\'est JAMAIS modifiée par l\'exécution : ni idExecution, ni statut, ni résultat, ni succès ; l\'objet fourni non plus', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const avantMagasin = JSON.stringify(await m.lireTout('designations'));
  const avantObjet = JSON.stringify(d);
  await enregistrerExecutionOperation(m, ex(d));
  await enregistrerExecutionOperation(m, ex(d));
  assert.equal(JSON.stringify(await m.lireTout('designations')), avantMagasin);
  assert.equal(JSON.stringify(d), avantObjet);
  assert.deepEqual(Object.keys(d), ['id', 'horodatage', 'idObservation', 'operation', 'liaisons', 'origine']); // MISE À JOUR DÉLIBÉRÉE v0.63.33 : + origine
});
test('E2. une désignation sans résultat reste possible : désignation seule, aucune exécution ; échec de la copie du résultat : désignation conservée, aucune exécution', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  assert.deepEqual(await m.lireTout(T), []);
  await refuse(enregistrerExecutionOperation(m, ex(d, { resultat: undefined })), /aucune valeur JSON/);
  const cyc = {}; cyc.moi = cyc;
  await refuse(enregistrerExecutionOperation(m, ex(d, { resultat: cyc })), /cyclique/);
  assert.deepEqual(await m.lireTout(T), []);
  assert.deepEqual(await m.lireTout('designations'), [d]);
});
test('E3. échec d\'écriture de l\'exécution : se propage tel quel, désignation intacte', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const panne = new Error('disque plein');
  const e = { ...espion(panne) };
  await assert.rejects(enregistrerExecutionOperation(e, ex(d)), (err) => err === panne);
  assert.deepEqual(await m.lireTout('designations'), [d]);
});

// ============================================================================ F. RÉSULTAT (politique v0.63.19 conservée)
test('F1. résultat : copie JSON, seulement après succès, mêmes transformations et refus', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const original = { a: [1, NaN, undefined, 'é'], b: { c: -0 } };
  const x = await enregistrerExecutionOperation(m, ex(d, { resultat: original }));
  assert.deepEqual(x.resultat, { a: [1, null, null, 'é'], b: { c: 0 } });
  assert.notEqual(x.resultat, original);
  original.a.push(9);
  assert.deepEqual((await m.lireTout(T))[0].resultat.a, [1, null, null, 'é']);
  assert.equal((await enregistrerExecutionOperation(m, ex(d, { resultat: null }))).resultat, null);
  const e = espion();
  for (const refus of [undefined, () => 1, Symbol('s'), 10n, { toJSON() { return 1; } }, new Date(0), piegeSur({}, 'v')]) await assert.rejects(enregistrerExecutionOperation(e, ex(d, { resultat: refus })), TypeError);
  assert.deepEqual(e.ecrits, []);
});
test('F2. TOUT OU RIEN : chaque échec laisse zéro écriture, un seul appel d\'écriture au succès', async () => {
  const e = espion();
  const d = DES();
  const cas = [ex(d, { operation: '' }), ex(d, { liaisons: [] }), ex(d, { liaisons: [{ entree: 'valeur', donnee: 'message-1' }, null] }), ex(d, { resultat: undefined }), ex({ ...d, id: '' }), ex(null)];
  for (const c of cas) await assert.rejects(enregistrerExecutionOperation(e, c), TypeError);
  assert.deepEqual(e.ecrits, []);
  await enregistrerExecutionOperation(e, ex(d));
  assert.equal(e.ecrits.length, 1);
});
test('F3. COPIE : les liaisons écrites sont neuves ; muter la désignation ou l\'entrée après coup ne change pas la ligne persistée', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const entree = ex(d);
  const x = await enregistrerExecutionOperation(m, entree);
  const photo = JSON.parse(JSON.stringify(x));
  entree.liaisons[0].donnee = 'autre'; entree.operation = 'autre'; d.id = 'modifié'; d.liaisons.push({ entree: 'z', donnee: 'z' });
  assert.deepEqual(JSON.parse(JSON.stringify((await m.lireTout(T))[0])), photo);
  assert.notEqual(x.liaisons, entree.liaisons);
});

// ============================================================================ G. CHAÎNE DE PROVENANCE
test('G1. chaîne complète, dormante, sans recherche : observation → désignation → exécution → productionsDecrites → donnée', async () => {
  const m = magasinMemoireVive();
  const obs = OBS();
  const D = await enregistrerDesignation(m, { observation: obs, application: APP(), origine: 'exterieure' }); // v0.63.33
  const X = await enregistrerExecutionOperation(m, { designation: D, operation: D.operation, liaisons: D.liaisons, resultat: R });
  const P = productionsDecrites(await m.lireTout(T), DESCRIPTIONS_OPERATIONS);
  assert.equal(P.length, 1);
  assert.equal(P[0].identite, X.id);
  assert.equal(X.idDesignation, D.id);
  assert.equal(D.idObservation, obs.id);
  // relecture mécanique par égalité d'identités
  const lignesX = await m.lireTout(T); const lignesD = await m.lireTout('designations');
  const x = lignesX.find((l) => l.id === P[0].identite);
  const d = lignesD.find((l) => l.id === x.idDesignation);
  assert.equal(d.idObservation, obs.id);
  assert.equal(lignesX.filter((l) => l.id === P[0].identite).length, 1);
  assert.equal(lignesD.filter((l) => l.id === x.idDesignation).length, 1);
  assert.deepEqual(valeurDePorteur(x, { identite: P[0].identite }, ACCES_TRACE), R);
});
test('G2. la chaîne survit à un aller-retour de sauvegarde (identités et liens identiques)', async () => {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  const obs = OBS();
  const D = await enregistrerDesignation(magasinLangage, { observation: obs, application: APP(), origine: 'exterieure' }); // v0.63.33
  const X = await enregistrerExecutionOperation(magasinLangage, { designation: D, operation: D.operation, liaisons: D.liaisons, resultat: R });
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.23', maintenant: new Date('2026-10-05T10:00:00Z') });
  assert.equal(fichier.objet.schema, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  const [x] = await neuf.lireTout(T); const [d] = await neuf.lireTout('designations');
  assert.equal(JSON.stringify(x), JSON.stringify(X));
  assert.equal(JSON.stringify(d), JSON.stringify(D));
  assert.equal(x.idDesignation, d.id);
  assert.equal(d.idObservation, obs.id);
});

// ============================================================================ H. COMPATIBILITÉ
test('H1. productionsDecrites ne lit que id + operation : un accesseur piégé sur idDesignation (comme sur resultat, liaisons, horodatage) n\'est jamais exécuté', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const X = await enregistrerExecutionOperation(m, ex(d));
  const piegee = { id: X.id, operation: X.operation };
  for (const champ of ['idDesignation', 'resultat', 'liaisons', 'horodatage']) Object.defineProperty(piegee, champ, { enumerable: true, get() { throw new Error(`${champ} lu`); } });
  const P = productionsDecrites([piegee], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(P.map((p) => p.identite), [X.id]);
  assert.deepEqual(productionsDecrites([X], DESCRIPTIONS_OPERATIONS).map((p) => p.identite), [X.id]);
  assert.deepEqual(Object.keys(productionsDecrites([X], DESCRIPTIONS_OPERATIONS)[0]).sort(), ['forme', 'identite']);
});
test('H2. valeurDePorteur + ACCES_TRACE rendent le resultat sans dépendre d\'idDesignation (accesseur piégé non lu)', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  const X = await enregistrerExecutionOperation(m, ex(d));
  assert.deepEqual(valeurDePorteur(X, { identite: X.id }, ACCES_TRACE), R);
  const piegee = { id: X.id, resultat: X.resultat };
  Object.defineProperty(piegee, 'idDesignation', { enumerable: true, get() { throw new Error('idDesignation lu'); } });
  assert.deepEqual(valeurDePorteur(piegee, { identite: X.id }, ACCES_TRACE), R);
  const sans = { id: X.id, resultat: X.resultat };
  assert.deepEqual(valeurDePorteur(sans, { identite: X.id }, ACCES_TRACE), R);
});
test('H3. productions-decrites.js et acces-valeur.js ne mentionnent ni designation ni idDesignation', () => {
  for (const f of ['productions-decrites.js', 'acces-valeur.js', 'acces-trace.js', 'possibilites-liaison.js', 'groupes-candidats.js']) {
    assert.equal(/idDesignation|designation/i.test(sansCommentaires(lu('app', 'langage', f))), false, f);
  }
});

// ============================================================================ I. PERSISTANCE ET ANCIEN FORMAT
test('I1. VERSION_BASE 19, SCHEMA_SAUVEGARDE 9, 22 tables (v0.63.23 n\'ajoutait aucune table ; valeursDonnees vient de v0.63.27)', () => { // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(VERSION_BASE, 22); assert.equal(SCHEMA_SAUVEGARDE, 12); assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(TABLES[19], T); assert.equal(TABLES[20], 'designations'); assert.equal(CLE[T], 'id');
});
test('I2. migration 18 → 19 (IndexedDB simulée, base déjà complète) : ne crée AUCUN magasin, ne touche aucune donnée existante', async () => {
  const donnees = new Map(TABLES.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null; let nom = null;
  const fabrique = { open(n, v) {
    nom = n; version = v;
    const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) };
    const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
    Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); });
    return r;
  } };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nom, NOM_BASE); assert.equal(version, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.deepEqual(crees, []);
  for (const t of TABLES) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});
const LEGACY = [
  { id: 'execution-operation-1-1-1', horodatage: '2026-10-05T07:00:00.000Z', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'message-1' }], resultat: R },
  { id: 'execution-operation-2-2-2', horodatage: '2026-10-05T07:01:00.000Z', operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'x' }, { entree: 'b', donnee: 'y' }], resultat: true },
];
async function sauvegardeAvecLegacy() {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  for (const l of LEGACY) await magasinLangage.ecrire(T, JSON.parse(JSON.stringify(l)));
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.23', maintenant: new Date('2026-10-05T10:00:00Z') });
  return { fichier, magasinLangage };
}
async function enSchema(fichier, schema, sansTables = []) {
  const f = JSON.parse(fichier.contenu); f.schema = schema;
  for (const t of sansTables) delete f.donnees.langage[t];
  f.empreinte = await empreinte(JSON.stringify(f.donnees)); return f;
}
test('I3. ANCIEN FORMAT : des lignes executionsOperations sans idDesignation (sauvegarde de schéma 7 ou 6) restent EXACTEMENT telles quelles ; aucune désignation ni idDesignation fabriqués ; designations absente = []', async () => {
  const { fichier } = await sauvegardeAvecLegacy();
  for (const schema of [6, 7]) {
    const ancienne = await enSchema(fichier, schema, ['designations']);
    const lue = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
    assert.equal(lue.ok, true, `schéma ${schema} : ${lue.erreur}`);
    assert.deepEqual(lue.donnees.langage[T], LEGACY);
    assert.equal(lue.donnees.langage[T].some((l) => 'idDesignation' in l), false);
    assert.deepEqual(lue.donnees.langage.designations, []);
    const neuf = magasinMemoireVive();
    await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
    assert.equal(JSON.stringify(await neuf.lireTout(T)), JSON.stringify(LEGACY));
    assert.deepEqual(await neuf.lireTout('designations'), []);
  }
});
test('I4. fichier de schéma 9 contenant d\'anciennes lignes sans idDesignation : importé tel quel (la sauvegarde ne valide pas les lignes une à une, aucune suppression silencieuse)', async () => {
  const { fichier } = await sauvegardeAvecLegacy();
  assert.equal(fichier.objet.schema, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  assert.equal(JSON.stringify(lue.donnees.langage[T]), JSON.stringify(LEGACY));
});
test('I5. les anciennes lignes alimentent TOUJOURS productionsDecrites et valeurDePorteur (lecture id + operation / resultat seulement)', async () => {
  const P = productionsDecrites(LEGACY, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(P.map((p) => p.identite).sort(), LEGACY.map((l) => l.id).sort());
  assert.equal(valeurDePorteur(LEGACY[1], { identite: LEGACY[1].id }, ACCES_TRACE), true);
});
test('I6. schéma courant (9) STRICT : une table manquante est un refus ; schéma futur (10) refusé ; migrerDonnees ne fabrique aucune ligne', async () => {
  const { fichier } = await sauvegardeAvecLegacy();
  const incomplet = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 12, ['designations'])), { tablesMemoire: TABLES_MEMOIRE }); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : schéma courant 11 : schéma courant 10
  assert.equal(incomplet.ok, false); assert.match(incomplet.erreur, /incomplet.*designations/);
  const futur = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 13)), { tablesMemoire: TABLES_MEMOIRE }); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : courant 11, futur 12 // MISE À JOUR DÉLIBÉRÉE v0.63.72 : le schéma courant est 10 (+ contextesProspectifs) ; le futur refusé est 11 // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(futur.ok, false); assert.match(futur.erreur, /plus récente/);
  const bloc = { [T]: LEGACY };
  const migre = migrerDonnees(bloc, ['designations', T], 7);
  assert.deepEqual(migre.designations, []);
  assert.equal(migre[T], LEGACY);
});
test('I7. une exécution écrite par la primitive N\'EST PAS reconnue comme ancien format : elle porte toujours idDesignation (toute nouvelle ligne vient d\'une désignation)', async () => {
  const m = magasinMemoireVive();
  const d = await des(m);
  for (let i = 0; i < 3; i += 1) assert.equal(typeof (await enregistrerExecutionOperation(m, ex(d))).idDesignation, 'string');
  assert.equal((await m.lireTout(T)).every((l) => l.idDesignation === d.id), true);
});

// ============================================================================ J. DORMANCE
test('J1. aucun fichier de app/ hors connaissances.js ne nomme enregistrerExecutionOperation, executionsOperations ou idDesignation (code hors commentaires)', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f);
    if (r === 'app/langage/connaissances.js') continue;
    if (r === 'app/langage/execution-sollicitee.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.34 : execution-sollicitee.js (primitive d'exécution sollicitée, dormante) importe ces primitives.
    if (r === 'app/langage/correspondances-experiences.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.66 : correspondances-experiences.js (vue pure et dormante) relaie le champ idDesignation des expériences historiques que la vue .65 lui fournit ; elle ne lit aucune table et n'écrit rien.
    if (r === 'app/langage/experiences-attentes.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.76 : experiences-attentes.js (vue pure dormante) recopie idDesignation depuis l'issue de l'attente ; aucune lecture d'exécution par elle-même
    if (r === 'app/langage/issue-attente-prospective.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.75 : issue-attente-prospective.js (vue pure dormante) vérifie l'ancrage attente/contexte par idDesignation ; aucune lecture d'exécution par elle-même
    if (r === 'app/langage/episodes-environnement.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.82 (projection environnementale, issue de l'expérience d'autonomie 04) : episodes-environnement.js (vue pure dormante) : écrit idDesignation (= l'émission) sur ses exécutions synthétiques, jamais persistées
    if (r === 'app/langage/emission.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : emission.js lit executionsOperations pour émettre une production réellement produite (aucune écriture d'exécution)
    if (r === 'app/langage/attentes-prospectives.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.74 : attentes-prospectives.js (calcul pur) lit le lien idDesignation des exécutions passées pour exclure l'issue courante et les issues postérieures
    if (r === 'app/langage/issue-contexte-prospectif.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.73 : issue-contexte-prospectif.js (vue pure et dormante) lit le lien idDesignation d'une exécution pour retrouver l'issue d'un contexte prospectif ; jamais la primitive d'écriture
    if (r === 'app/langage/executions-vecues.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.83 : executions-vecues.js lit executionsOperations (lecture seule) pour composer les exécutions vécues.
    if (r === 'app/langage/attentes-du-tour.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.78 (jalon 1) : attentes-du-tour.js (présentation, lecture seule) lit la table des exécutions et relie une attente à son résultat par idDesignation pour afficher son issue ; jamais la primitive d'écriture.
    if (r === 'app/langage/formes-rencontrees.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.64 : formes-rencontrees.js (vue pure et dormante, lecture seule) lit le lien idDesignation d'une exécution persistée pour retrouver son observation ; elle n'écrit rien.
    // v0.63.24 : main.js LIT la table executionsOperations (lecture seule de l'univers) ; jamais la primitive d'écriture ni idDesignation.
    const code = sansCommentaires(readFileSync(f, 'utf8')).replace(/e\.magasin\.lireTout\('executionsOperations'\)/g, r === 'app/main.js' ? '' : 'NON_AUTORISÉ');
    assert.equal(/enregistrerExecutionOperation|executionsOperations|execution-operation|idDesignation/.test(code), false, r);
  }
});
test('J2. main, pont, ecran, observation-possibilites, action, composition (et esprit, invocation, table) ne créent aucune executionOperation ni ne nomment la désignation', () => {
  for (const n of ['app/main.js', 'app/langage/pont.js', 'app/langage/ecran.js', 'app/langage/observation-possibilites.js', 'app/langage/action.js', 'app/langage/composition.js',
    'app/langage/esprit.js', 'app/langage/invocation-operations.js', 'app/langage/table-operations.js']) {
    const brut = sansCommentaires(lu(...n.split('/'))); // v0.63.24 : code seul (les commentaires de l'observateur nomment la table)
    assert.equal(/enregistrerExecutionOperation|execution-operation|enregistrerDesignation|idDesignation/.test(brut), false, n);
    assert.equal(/executionsOperations/.test(n === 'app/main.js' ? brut.replace(/e\.magasin\.lireTout\('executionsOperations'\)/g, '') : brut), false, n);
  }
});
test('J3. dans connaissances.js : aucun appelant des deux primitives et aucune lecture des tables executionsOperations / designations', () => {
  const code = sansCommentaires(CONN);
  assert.equal((code.match(/enregistrerExecutionOperation\(/g) || []).length, 1);
  assert.equal((code.match(/enregistrerDesignation\(/g) || []).length, 1);
  assert.equal(/lireTout\(\s*['"]designations/.test(code), false);
  assert.equal((code.match(/lireTout\(\s*['"]executionsOperations/g) || []).length, 3); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : une seule lecture, dans enregistrerContexteProspectif (refus si l'exécution de la désignation existe déjà) ; les deux primitives de .19/.22 ne lisent toujours rien // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 1 → 2 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 2 → 3 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal((code.match(/'executionsOperations'/g) || []).length, 5); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : TABLES + écriture + cette lecture // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 3 → 4 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 4 → 5 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
});
test('J4. aucun hasard, score, préférence, retour humain, fait d\'échec ni amorçage dans la primitive d\'exécution', () => {
  const a = CONN.indexOf('export async function enregistrerExecutionOperation('); const b = CONN.indexOf('// === FAIT PERSISTANT DE DÉSIGNATION');
  const code = sansCommentaires(CONN.slice(a, b));
  assert.equal(/Math\.random|crypto|\bscore\b|priorit|prefer|préfér|amorc|bootstrap|groupesDeCandidats|invoquerOperation|DESCRIPTIONS_OPERATIONS|statut|succes|echec|erreur:/i.test(code), false);
});
test('J5. source de l\'objet écrit : exactement id, horodatage, idDesignation, operation, liaisons, resultat', () => {
  const a = CONN.indexOf("const objet = {\n    id: nouvelId('execution-operation')");
  assert.ok(a > 0);
  const b = CONN.indexOf("await magasin.ecrire('executionsOperations'");
  assert.deepEqual([...CONN.slice(a, b).matchAll(/^\s+(\w+)[,:]/gm)].map((m) => m[1]), ['id', 'horodatage', 'idDesignation', 'operation', 'liaisons', 'resultat']);
});
// === FIN_TEST_LIEN_EXECUTION_DESIGNATION ===
