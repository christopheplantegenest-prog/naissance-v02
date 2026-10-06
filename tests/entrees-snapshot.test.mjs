// v0.63.59 — « EXPOSER entrées(P) DANS LES NOUVEAUX SNAPSHOTS » (décision ChatGPT, 06/10/2026).
// Pour chaque EXÉCUTION P présente dans l'univers d'une NOUVELLE observation, la donnée adjacente entrées(P) (v0.63.55) appartient au même univers.
// Ni message, ni sous-donnée α2, ni entrées(P) elle-même. Énumération mécanique. La provenance devient une donnée VIVANTE : désignée, résolue, exécutée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { CATEGORIE_ENTREES_PRODUCTION, empreinteContratEntreesProduction, contratEntreesProduction, canoniserContratCategorie } from '../app/langage/empreinte-categorie-entrees.js';
import { PREFIXE_IDENTITE_ENTREES, estIdentiteEntrees, FORME_ENTREES_PRODUCTION, ACCES_ENTREES_PRODUCTION, identiteEntreesProduction } from '../app/langage/entrees-donnee.js';
import { entreesDeProduction } from '../app/langage/entrees-production.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { resoudreValeursApplication } from '../app/langage/valeurs-application.js';
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
const CLES8 = ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'possibilites'];
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
    const application = liaisons ? { operation, liaisons } : applicationsSollicitables(t.observation, descriptions).applications.find((a) => a.operation === operation);
    assert.ok(application, operation);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS, descriptions });
    assert.equal(r.statut, 'executee');
    return r;
  }
  const lire = async () => ({ observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
  return { magasin, tour, lancer, lire, recus };
}

const idEnt = identiteEntreesProduction;
let CACHE = null;
async function chaine() {
  if (CACHE) return CACHE;
  const w = monde();
  const E = {};
  E.A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  E.B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  E.P = await w.lancer('tour P', 'elementsObservables');
  E.S = await w.lancer('tour S', 'produireSuitesFermees', [{ entree: 'elements', donnee: E.P.execution.id }]);
  E.M = await w.lancer('tour M', 'projeterContenus', [{ entree: 'elements', donnee: E.S.execution.id }]);
  E.H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: E.P.execution.id }]);
  E.Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: E.H.execution.id }, { entree: 'b', donnee: E.H.execution.id }]);
  E.PY = await w.lancer('tour PY', 'elementsObservables');
  E.R = await w.lancer('tour R', 'rechercherSousSuites', [{ entree: 'motifs', donnee: E.M.execution.id }, { entree: 'elements', donnee: E.PY.execution.id }]);
  E.T1 = await w.tour('tour après R');
  assert.equal(E.T1.statut, 'ecrite');
  // la provenance DEVIENT une donnée : parcourirStructure(entrées(R)) par désignation réelle, avec l'univers réel du tour
  E.X = await w.lancer('tour X', 'parcourirStructure', [{ entree: 'valeur', donnee: idEnt(E.R.execution.id) }]);
  E.T3 = await w.tour('tour après X');
  assert.equal(E.T3.statut, 'ecrite');
  const l = await w.lire();
  CACHE = { w, E, l };
  return CACHE;
}
const executionsDe = (o, l) => o.donneesExaminees.filter((id) => l.executions.some((e) => e.id === id));
const sousDonneesDe = (l) => l.executions.flatMap((e) => (e.sousDonnees || []).map((s) => s.id));
const entreesDe = (o) => o.donneesExaminees.filter((id) => id.startsWith(PREFIXE_IDENTITE_ENTREES));
const refus = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const sansEntrees = (o) => ({ ...o, donneesExaminees: o.donneesExaminees.filter((d) => !estIdentiteEntrees(d)), possibilites: o.possibilites.filter((a) => !estIdentiteEntrees(a.donnee)) });
const contexte = (l, id, lignes = l.observations) => resoudreContexteObservation(id, lignes, l.valeurs, l.executions, C16);

// ============================================================================ A. RÈGLE D'ÉNUMÉRATION
test('A1. pour CHAQUE exécution P présente : entrées(P) présente exactement une fois ; aucune autre identité d\'entrées ; aucune pour message, sous-donnée ni entrées(P) (pas de récursion)', async () => {
  const { l } = await chaine();
  const sous = new Set(sousDonneesDe(l));
  assert.ok(sous.size >= 3);
  let avecExec = 0;
  for (const o of l.observations) {
    const executions = executionsDe(o, l);
    assert.deepEqual(entreesDe(o).sort(), executions.map((p) => idEnt(p)).sort());
    assert.equal(new Set(o.donneesExaminees).size, o.donneesExaminees.length, 'aucun doublon');
    for (const id of o.donneesExaminees) {
      if (sous.has(id) || id === o.idMessage) assert.equal(o.donneesExaminees.includes(PREFIXE_IDENTITE_ENTREES + id), false, `aucune entrées(${id})`);
      assert.equal(id.startsWith(PREFIXE_IDENTITE_ENTREES + PREFIXE_IDENTITE_ENTREES), false);
      if (estIdentiteEntrees(id)) assert.equal(o.donneesExaminees.includes(idEnt(id.slice(PREFIXE_IDENTITE_ENTREES.length))), true);
    }
    if (executions.length > 0) avecExec += 1;
  }
  assert.ok(avecExec >= 8);
});
test('A2. aucune SÉLECTION : la règle ne dépend ni de l\'opération, ni de la valeur, ni de la forme, ni de la récence, ni du texte (toutes les opérations de la chaîne y sont)', async () => {
  const { l } = await chaine();
  const o = l.observations[l.observations.length - 1];
  const operations = new Set(l.executions.map((e) => e.operation));
  assert.ok(operations.size >= 7);
  for (const e of l.executions) assert.equal(o.donneesExaminees.includes(idEnt(e.id)), true, `${e.operation} ${e.id}`);
  const code = sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'));
  const debut = code.indexOf('for (const production of productions) {\n      if (!lignes.has(production.identite)) continue;');
  assert.ok(debut > 0, 'la seule condition d\'énumération est : la production est une EXÉCUTION (porteuse d\'une ligne)');
  const bloc = code.slice(debut, code.indexOf('\n    }', debut) + 6);
  assert.equal((bloc.match(/\bif \(/g) || []).length, 1);
});

// ============================================================================ B. ÉQUIVALENCE AVEC resoudreIdentitesDonnees
test('B1. entrées(P) du snapshot = ce que resoudreIdentitesDonnees([idEntrees(P)]) rend explicitement (donnee, porteur, acces) ; la valeur vient de entreesDeProduction', async () => {
  const { l, E } = await chaine();
  const univers = E.T3.univers;
  const ents = univers.filter((u) => estIdentiteEntrees(u.donnee.identite));
  assert.equal(ents.length, l.executions.length);
  for (const u of ents) {
    const [r] = resoudreIdentitesDonnees([u.donnee.identite], l.valeurs, l.executions, C16);
    assert.deepEqual(u.donnee, r.donnee); assert.deepEqual(u.porteur, r.porteur); assert.deepEqual(u.acces, r.acces);
    assert.deepEqual(u.acces, ACCES_ENTREES_PRODUCTION); assert.deepEqual(u.donnee.forme, FORME_ENTREES_PRODUCTION);
    assert.deepEqual(valeurDePorteur(u.porteur, u.donnee, u.acces), entreesDeProduction(u.donnee.identite.slice(PREFIXE_IDENTITE_ENTREES.length), l.executions));
    assert.notEqual(u.donnee.forme, FORME_ENTREES_PRODUCTION, 'copie, jamais la constante partagée');
    assert.deepEqual(Object.keys(u.porteur), ['id', 'entrees']);
  }
});
test('B2. les entrées sont une COPIE : modifier la valeur rendue ne touche ni la ligne d\'exécution ni la constante', async () => {
  const { l, E } = await chaine();
  const u = E.T3.univers.find((x) => x.donnee.identite === idEnt(E.R.execution.id));
  const ligne = l.executions.find((e) => e.id === E.R.execution.id);
  assert.notEqual(u.porteur.entrees, ligne.liaisons);
  assert.deepEqual(u.porteur.entrees, ligne.liaisons);
  assert.equal(Object.isFrozen(FORME_ENTREES_PRODUCTION), true);
});

// ============================================================================ C. ORDRE DANS L'UNIVERS
test('C1. ORDRE RÉEL : message, puis productions (ordre canonique de productionsDecrites, sous-données comprises), PUIS le bloc entrées(P) dans l\'ordre canonique de P ; l\'univers v0.63.58 est un PRÉFIXE', async () => {
  const { l, E } = await chaine();
  const ids = E.T3.univers.map((u) => u.donnee.identite);
  const productions = [E.T3.observation.idMessage, ...productionsDecritesIds(l)];
  const exec = l.executions.map((e) => e.id).sort();
  assert.deepEqual(ids, [...productions, ...exec.map((p) => idEnt(p))]);
  assert.equal(ids[0], E.T3.observation.idMessage);
  const premierEntrees = ids.findIndex((x) => estIdentiteEntrees(x));
  assert.equal(ids.slice(0, premierEntrees).some((x) => estIdentiteEntrees(x)), false);
  assert.equal(ids.slice(premierEntrees).every((x) => estIdentiteEntrees(x)), true, 'bloc contigu, après toutes les productions et sous-données');
  assert.deepEqual(E.T3.observation.donneesExaminees, [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), 'la liste PERSISTÉE est triée canoniquement par le magasin (comportement inchangé) : le même ENSEMBLE que l\'univers local');
});
function productionsDecritesIds(l) {
  const ids = [...l.executions.map((e) => e.id), ...sousDonneesDe(l)];
  return ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// ============================================================================ D. TOUR PRODUCTEUR (honnêteté temporelle)
test('D1. P créée à partir de O1 : O1 ne contient NI P NI entrées(P) ; O2 contient P ET entrées(P)', async () => {
  const w = monde();
  const t1 = await w.tour('x');
  const application = applicationsSollicitables(t1.observation, C16).applications.find((a) => a.operation === 'symbolesDeChaine');
  const r = await executerApplicationSollicitee({ observation: t1.observation, application, univers: t1.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS, descriptions: C16 });
  assert.equal(r.statut, 'executee');
  const P = r.execution.id;
  assert.equal(t1.observation.donneesExaminees.includes(P), false); assert.equal(t1.observation.donneesExaminees.includes(idEnt(P)), false);
  assert.equal(t1.univers.some((u) => u.donnee.identite === P || u.donnee.identite === idEnt(P)), false);
  const t2 = await w.tour('y');
  assert.equal(t2.observation.donneesExaminees.includes(P), true); assert.equal(t2.observation.donneesExaminees.includes(idEnt(P)), true);
  const lignes = (await w.lire()).observations;
  assert.equal(lignes.find((o) => o.id === t1.observation.id).donneesExaminees.includes(idEnt(P)), false, 'O1 reste inchangée dans le magasin');
});

// ============================================================================ E. α2
test('E1. Q (trois sous-données) : Q présente, ses sous-données présentes comme avant, entrées(Q) exactement une fois, AUCUNE entrées(D1/D2/D3)', async () => {
  const { l, E } = await chaine();
  const ligneQ = l.executions.find((e) => e.id === E.Q.execution.id);
  const sd = ligneQ.sousDonnees.map((s) => s.id);
  assert.equal(sd.length, 3);
  const o = E.T3.observation;
  for (const d of [E.Q.execution.id, ...sd]) assert.equal(o.donneesExaminees.includes(d), true);
  assert.equal(o.donneesExaminees.filter((d) => d === idEnt(E.Q.execution.id)).length, 1);
  for (const d of sd) { assert.equal(o.donneesExaminees.includes(idEnt(d)), false); assert.equal(o.possibilites.some((a) => a.donnee === idEnt(d)), false); }
  refus(() => resoudreIdentitesDonnees([idEnt(sd[0])], l.valeurs, l.executions, C16), /sous-donnée|source/);
});

// ============================================================================ F. CAS R
test('F1. R n\'apparaît pas dans son observation productrice ; au tour suivant R ET entrées(R) sont présentes ; valeur exacte : elements → P_Y, motifs → M', async () => {
  const { l, E } = await chaine();
  const R = E.R.execution.id;
  assert.equal(E.R.designation.idObservation !== undefined, true);
  const Oprod = l.observations.find((o) => o.id === E.R.designation.idObservation);
  assert.equal(Oprod.donneesExaminees.includes(R), false); assert.equal(Oprod.donneesExaminees.includes(idEnt(R)), false);
  const u = E.T1.univers.find((x) => x.donnee.identite === idEnt(R));
  assert.ok(u, 'entrées(R) au tour suivant');
  assert.equal(E.T1.observation.donneesExaminees.includes(R), true);
  assert.deepEqual(valeurDePorteur(u.porteur, u.donnee, u.acces), [{ entree: 'elements', donnee: E.PY.execution.id }, { entree: 'motifs', donnee: E.M.execution.id }]);
});
test('F2. les possibilités permettent parcourirStructure.valeur = idEntrees(R) et couvrirSequence.elements (par la FORME seule)', async () => {
  const { E } = await chaine();
  const a = E.T1.observation.possibilites.filter((p) => p.donnee === idEnt(E.R.execution.id)).map((p) => `${p.operation}.${p.entree}`).sort();
  assert.deepEqual(a, ['couvrirSequence.elements', 'parcourirStructure.valeur']);
});

// ============================================================================ G. DÉSIGNATION RÉELLE, RÉSOLUTION, EXÉCUTION
test('G1. TEST CENTRAL : parcourirStructure(valeur = entrées(R)) est désignée par les mécanismes normaux (enregistrerDesignation ACCEPTE), résolue depuis l\'univers réel, exécutée', async () => {
  const { w, l, E } = await chaine();
  const R = E.R.execution.id; const X = E.X;
  assert.equal(X.statut, 'executee');
  assert.deepEqual(X.designation.liaisons, [{ entree: 'valeur', donnee: idEnt(R) }]);
  assert.equal(X.designation.operation, 'parcourirStructure');
  assert.equal(l.observations.find((o) => o.id === X.designation.idObservation).donneesExaminees.includes(idEnt(R)), true, 'observation réelle qui contient entrées(R)');
  assert.equal(l.executions.find((e) => e.id === X.execution.id).idDesignation, X.designation.id);
  assert.equal((await w.magasin.lireTout('designations')).some((d) => d.id === X.designation.id), true);
  // la résolution depuis l'univers REEL du tour retrouve la valeur
  const tour = await w.tour('contrôle de résolution');
  const valeurs = resoudreValeursApplication({ operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: idEnt(R) }] }, tour.univers);
  assert.equal(valeurs.operation, 'parcourirStructure');
  assert.deepEqual(Object.keys(valeurs.valeurs), ['valeur']);
  assert.deepEqual(valeurs.valeurs.valeur, entreesDeProduction(R, l.executions));
});
test('G2. aucun contournement : l\'application n\'est possible que parce qu\'entrées(R) figure dans les possibilités PERSISTÉES de l\'observation (sinon la désignation refuse)', async () => {
  const { w, l, E } = await chaine();
  const O = l.observations.find((o) => o.id === E.X.designation.idObservation);
  assert.equal(O.possibilites.some((a) => a.donnee === idEnt(E.R.execution.id) && a.operation === 'parcourirStructure' && a.entree === 'valeur'), true);
  const ancienne = sansEntrees(O);
  const t = await w.tour('x');
  const sansProv = { ...t, observation: { ...t.observation, possibilites: t.observation.possibilites.filter((a) => !estIdentiteEntrees(a.donnee)) } };
  let refuse = false;
  try {
    const r = await executerApplicationSollicitee({ observation: sansProv.observation, application: { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: idEnt(E.R.execution.id) }] }, univers: t.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS, descriptions: C16 });
    refuse = r.statut !== 'executee';
  } catch { refuse = true; }
  assert.equal(refuse, true, 'une observation SANS la possibilité refuse');
  assert.ok(ancienne.possibilites.length < O.possibilites.length);
  assert.equal((await w.magasin.lireTout('executionsOperations')).filter((e) => e.operation === 'parcourirStructure').length >= 1, true);
});

// ============================================================================ H. PRODUCTION ISSUE DE LA PROVENANCE
test('H1. X issue de parcourirStructure(entrées(R)) : au tour suivant X présente, entrées(X) présente et contient idEntrees(R) comme entrée ; toujours AUCUNE entrées(entrées(R))', async () => {
  const { l, E } = await chaine();
  const X = E.X.execution.id; const R = E.R.execution.id;
  const o = E.T3.observation;
  assert.equal(o.donneesExaminees.includes(X), true); assert.equal(o.donneesExaminees.includes(idEnt(X)), true);
  const u = E.T3.univers.find((x) => x.donnee.identite === idEnt(X));
  assert.deepEqual(valeurDePorteur(u.porteur, u.donnee, u.acces), [{ entree: 'valeur', donnee: idEnt(R) }]);
  assert.equal(o.donneesExaminees.some((d) => d.startsWith(PREFIXE_IDENTITE_ENTREES + PREFIXE_IDENTITE_ENTREES)), false);
  refus(() => idEnt(idEnt(R)), /préfixe réservé/);
  assert.equal(l.executions.some((e) => e.id.startsWith(PREFIXE_IDENTITE_ENTREES)), false);
});

// ============================================================================ I. COÛT MESURÉ ET APPLICATIONS SOLLICITABLES
test('I1. COÛT MESURÉ : sur la chaîne réelle (les 10 premières observations = chaîne de référence du diagnostic : 64→109 données, 356→446 atomes ; dernière de référence 13→22 données, 83→101 atomes), données et atomes par observation = recalcul indépendant ; le retrait du bloc entrées(P) redonne exactement l\'état v0.63.58', async () => {
  const { l } = await chaine();
  let totalDonnees = 0; let totalAtomes = 0; let totalDonneesAvant = 0; let totalAtomesAvant = 0;
  for (const o of l.observations) {
    const donnees = resoudreIdentitesDonnees(o.donneesExaminees, l.valeurs, l.executions, C16).map((x) => x.donnee);
    assert.equal(o.possibilites.length, possibilitesDeLiaison(donnees, C16).length);
    const avant = donnees.filter((d) => !estIdentiteEntrees(d.identite));
    assert.equal(avant.length, 1 + executionsDe(o, l).length + o.donneesExaminees.filter((d) => sousDonneesDe(l).includes(d)).length);
    assert.equal(donnees.length - avant.length, executionsDe(o, l).length);
    const atomesAvant = possibilitesDeLiaison(avant, C16);
    assert.equal(o.possibilites.length - atomesAvant.length, 2 * executionsDe(o, l).length, 'chaque entrées(P) apporte EXACTEMENT 2 atomes sous C16');
    if (l.observations.indexOf(o) >= 10) continue;
    totalDonnees += donnees.length; totalAtomes += o.possibilites.length; totalDonneesAvant += avant.length; totalAtomesAvant += atomesAvant.length;
  }
  const o = l.observations[l.observations.length - 1];
  assert.deepEqual([o.donneesExaminees.length, o.possibilites.length], [24, 107], 'dernière observation de CETTE chaîne (une production X de plus que la chaîne de référence)');
  const ref = l.observations[9];
  assert.deepEqual([ref.donneesExaminees.length, ref.possibilites.length], [22, 101], 'la dernière observation de la chaîne de référence : 13 → 22 données, 83 → 101 atomes');
  assert.deepEqual([totalDonneesAvant, totalAtomesAvant, totalDonnees, totalAtomes], [64, 356, 109, 446]);
  assert.ok(totalDonnees > totalDonneesAvant && totalAtomes > totalAtomesAvant);
});
test('I2. applicationsSollicitables / choixAFaire : mêmes NOMBRES qu\'avant l\'exposition, sur chaque observation (aucun nouveau choixAFaire dû à l\'exposition)', async () => {
  const { l } = await chaine();
  for (const o of l.observations) {
    const apres = applicationsSollicitables(o, C16); const avant = applicationsSollicitables(sansEntrees(o), C16);
    assert.equal(apres.applications.length, avant.applications.length, o.id);
    assert.deepEqual(apres.choixAFaire, avant.choixAFaire, o.id);
    assert.deepEqual(apres.applications.map((a) => a.operation), avant.applications.map((a) => a.operation));
  }
});

// ============================================================================ J. COLLECTIFS
test('J1. elementsObservables.elements n\'est PAS compatible avec la forme des entrées : ses ensembles collectifs sont inchangés (aucune spécialisation)', async () => {
  const { l } = await chaine();
  for (const o of l.observations) {
    assert.equal(o.possibilites.some((a) => a.operation === 'elementsObservables' && estIdentiteEntrees(a.donnee)), false);
    const apres = o.possibilites.filter((a) => a.operation === 'elementsObservables').map((a) => `${a.donnee}|${a.entree}`).sort();
    const avant = sansEntrees(o).possibilites.filter((a) => a.operation === 'elementsObservables').map((a) => `${a.donnee}|${a.entree}`).sort();
    assert.deepEqual(apres, avant);
  }
  const ops = new Set(l.observations[l.observations.length - 1].possibilites.filter((a) => estIdentiteEntrees(a.donnee)).map((a) => `${a.operation}.${a.entree}`));
  assert.deepEqual([...ops].sort(), ['couvrirSequence.elements', 'parcourirStructure.valeur']);
});

// ============================================================================ K. PREUVE DE CATÉGORIE ET RECONSTRUCTION HISTORIQUE
test('K1. toute observation qui contient entrées(P) est une observation 8 clés portant la preuve correcte (mécanisme v0.63.57 inchangé)', async () => {
  const { l } = await chaine();
  for (const o of l.observations) {
    assert.deepEqual(Object.keys(o), CLES8);
    assert.deepEqual(o.empreintesCategoriesDonnees, PREUVE());
  }
  assert.ok(l.observations.some((o) => entreesDe(o).length > 0));
});
test('K2. « redémarrage » simulé : sur une COPIE JSON des tables, resoudreContexteObservation reconstruit exactement identités, formes, valeurs, accès et possibilités du tour vivant', async () => {
  const { l, E } = await chaine();
  const copie = JSON.parse(JSON.stringify(l));
  const r = resoudreContexteObservation(E.T3.observation.id, copie.observations, copie.valeurs, copie.executions, C16);
  const parId = new Map(E.T3.univers.map((u) => [u.donnee.identite, u]));
  assert.deepEqual(r.univers.map((u) => u.donnee.identite), E.T3.observation.donneesExaminees, 'ordre = celui de donneesExaminees persistée');
  assert.deepEqual([...parId.keys()].sort(), [...r.univers.map((u) => u.donnee.identite)].sort());
  assert.equal(r.univers.filter((u) => estIdentiteEntrees(u.donnee.identite)).length, copie.executions.length);
  r.univers.forEach((u) => {
    const v = parId.get(u.donnee.identite);
    assert.deepEqual(u.donnee, v.donnee);
    if (u.donnee.identite !== E.T3.observation.idMessage) assert.deepEqual(u.acces, v.acces); // le message est relu par l'accès de la table de valeurs (équivalence déjà établie en v0.63.49 : même forme, même valeur)
    assert.deepEqual(valeurDePorteur(u.porteur, u.donnee, u.acces), valeurDePorteur(v.porteur, v.donnee, v.acces));
  });
  assert.deepEqual(r.observation.possibilites, E.T3.observation.possibilites);
  for (const o of copie.observations) assert.equal(resoudreContexteObservation(o.id, copie.observations, copie.valeurs, copie.executions, C16).observation, o);
});
test('K3. la preuve de catégorie est vérifiée AVANT reconstruction (comme en .58) sur une observation qui contient entrées(P) : preuve périmée → refus', async () => {
  const { l, E } = await chaine();
  const o = { ...clone(E.T3.observation), id: 'o-perimee' }; o.empreintesCategoriesDonnees[0].empreinte = H('7');
  refus(() => contexte(l, 'o-perimee', [...l.observations, o]), /contrat de la catégorie/);
  const ok = { ...clone(E.T3.observation), id: 'o-ok' };
  assert.equal(contexte(l, 'o-ok', [...l.observations, ok]).univers.length, ok.donneesExaminees.length);
});

// ============================================================================ L. ANCIENNES OBSERVATIONS
test('L1. une observation 8 clés de .57/.58 (preuve présente, SANS entrées(P)) reste exactement ainsi : lisible, jamais complétée ; une 6/7 clés aussi', async () => {
  const { l, E } = await chaine();
  const o57 = { ...sansEntrees(E.T3.observation), id: 'o-57' };
  const o7 = { ...sansEntrees(E.T3.observation), id: 'o-7' }; delete o7.empreintesCategoriesDonnees;
  const o6 = { ...o7, id: 'o-6' }; delete o6.empreintesOperationsExaminees;
  const lignes = [...l.observations, o57, o7, o6];
  const avant = JSON.stringify(lignes);
  for (const o of [o57, o7, o6]) {
    const r = contexte(l, o.id, lignes);
    assert.equal(r.observation, o);
    assert.equal(r.univers.some((u) => estIdentiteEntrees(u.donnee.identite)), false, 'jamais entrées(P) rétroactivement');
    assert.deepEqual(r.univers.map((u) => u.donnee.identite), o.donneesExaminees);
  }
  assert.deepEqual(Object.keys(o57), CLES8); assert.deepEqual(Object.keys(o7), CLES7); assert.deepEqual(Object.keys(o6), CLES6);
  assert.equal(JSON.stringify(lignes), avant);
});
test('L2. un tour nouveau n\'altère aucune observation déjà persistée (immuables) ; seule la nouvelle porte entrées(P)', async () => {
  const w = monde();
  await w.lancer('a', 'symbolesDeChaine');
  const avant = JSON.stringify((await w.lire()).observations);
  const t = await w.tour('b');
  const apres = (await w.lire()).observations;
  assert.equal(JSON.stringify(apres.slice(0, -1)), avant);
  assert.equal(entreesDe(t.observation).length, 1);
});

// ============================================================================ M. ÉCHECS ET COLLISIONS
test('M1. ÉCHEC : une production présente aux liaisons invalides → echec_executions, enregistrer JAMAIS appelé, aucune observation, pas de snapshot partiel', async () => {
  const mauvaises = [
    { liaisons: [] }, { liaisons: undefined }, { liaisons: 'x' },
    { liaisons: [{ entree: 'valeur' }] }, { liaisons: [{ entree: 'valeur', donnee: '' }] },
    { liaisons: [{ entree: 'b', donnee: 'M0' }, { entree: 'a', donnee: 'M0' }] }, // non triées
    { liaisons: [{ entree: 'valeur', donnee: 'M0' }, { entree: 'valeur', donnee: 'M1' }] }, // entrée dupliquée
    { liaisons: [{ entree: 'valeur', donnee: 'M0', extra: 1 }] },
  ];
  for (const m of mauvaises) {
    const magasin = magasinMemoireVive(); let appels = 0;
    const ligne = { id: 'execution-bad', horodatage: 'h', idDesignation: 'd', operation: 'parcourirStructure', resultat: [1], ...m };
    if (m.liaisons === undefined) delete ligne.liaisons;
    const msg = { id: 'm-1', texte: 'x' };
    const r = await observerPossibilites(msg, { enregistrer: (o) => { appels += 1; return enregistrerObservationPossibilites(magasin, o); }, lireExecutions: async () => [ligne] });
    assert.deepEqual({ statut: r.statut, observation: r.observation, univers: r.univers }, { statut: 'echec_executions', observation: null, univers: null }, JSON.stringify(m));
    assert.equal(appels, 0); assert.equal((await magasin.lireTout('observationsPossibilites')).length, 0);
  }
});
test('M2. ÉCHEC : une seule production invalide parmi plusieurs bonnes fait échouer TOUT le snapshot (jamais P présente sans entrées(P))', async () => {
  const bonne = (id) => ({ id, horodatage: 'h', idDesignation: 'd', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'M0' }], resultat: [1] });
  const r = await observerPossibilites({ id: 'm-1', texte: 'x' }, { enregistrer: async (o) => o, lireExecutions: async () => [bonne('execution-a'), { ...bonne('execution-b'), liaisons: [] }, bonne('execution-c')] });
  assert.equal(r.statut, 'echec_executions'); assert.equal(r.observation, null);
});
test('M3. COLLISION de préfixe : identité d\'exécution, de sous-donnée ou de message dans le préfixe réservé → refus, aucune priorité silencieuse, rien écrit', async () => {
  const bonne = (id, plus = {}) => ({ id, horodatage: 'h', idDesignation: 'd', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'M0' }], resultat: [1], ...plus });
  const cas = [
    ['exécution', { id: 'm-1', texte: 'x' }, [bonne(PREFIXE_IDENTITE_ENTREES + 'execution-a')], 'echec_executions'],
    ['exécution = identité dérivée d\'une autre', { id: 'm-1', texte: 'x' }, [bonne('execution-a'), bonne(idEnt('execution-a'))], 'echec_executions'],
    ['sous-donnée', { id: 'm-1', texte: 'x' }, [bonne('execution-q', { operation: 'partagerCouvertures', liaisons: [{ entree: 'a', donnee: 'M0' }, { entree: 'b', donnee: 'M0' }], resultat: { communs: [], seulementA: [], seulementB: [] }, sousDonnees: [{ id: PREFIXE_IDENTITE_ENTREES + 'sd-1', chemin: ['communs'] }, { id: 'sd-2', chemin: ['seulementA'] }, { id: 'sd-3', chemin: ['seulementB'] }] })], 'echec_executions'],
    ['message', { id: PREFIXE_IDENTITE_ENTREES + 'm-1', texte: 'x' }, [], 'echec_donnee'],
  ];
  for (const [nom, message, lignes, statut] of cas) {
    let appels = 0;
    const r = await observerPossibilites(message, { enregistrer: async (o) => { appels += 1; return o; }, lireExecutions: async () => lignes });
    assert.equal(r.statut, statut, nom); assert.equal(appels, 0, nom);
  }
});

// ============================================================================ N. PÉRIMÈTRE
test('N1. aucune table, migration, version ni opération ; entrées(P) n\'est JAMAIS persistée (la ligne ne porte que des identités et des atomes) ; resoudre-identites.js et connaissances.js inchangés', async () => {
  assert.equal(VERSION_BASE, 19); assert.equal(SCHEMA_SAUVEGARDE, 9); assert.equal(TABLES.length, 22);
  assert.equal(C16.length, 16); assert.equal(Object.keys(TABLE_OPERATIONS).length, 16);
  const { l } = await chaine();
  for (const o of l.observations) { assert.equal(JSON.stringify(o).includes('"entrees"'), false); assert.equal(JSON.stringify(o).includes('"liaisons"'), false); }
  assert.equal(/entrees-donnee|entreesDeProduction|identiteEntreesProduction/.test(sansCommentaires(lu('app', 'langage', 'connaissances.js'))), false);
});
test('N2. le producteur ne lit ni resultat ni idDesignation pour entrées(P) (entreesDeProduction ne lit que id, operation, liaisons) et reste asynchrone-propre : aucun nouvel effet', async () => {
  const piege = { id: 'execution-p', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'M0' }] };
  Object.defineProperty(piege, 'resultat', { enumerable: true, get() { throw new Error('resultat lu'); } });
  Object.defineProperty(piege, 'idDesignation', { enumerable: true, get() { throw new Error('idDesignation lu'); } });
  const r = await observerPossibilites({ id: 'm-1', texte: 'x' }, { enregistrer: async (o) => ({ ...o }), lireExecutions: async () => [piege] });
  assert.equal(r.statut, 'ecrite');
  assert.equal(r.observation.donneesExaminees.includes(idEnt('execution-p')), true);
});
