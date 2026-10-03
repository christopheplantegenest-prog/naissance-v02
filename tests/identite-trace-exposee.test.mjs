// === DEBUT_TEST_IDENTITE_TRACE_EXPOSEE ===
// CHANTIER « EXPOSER L'IDENTITÉ DE LA TRACE PRODUITE PAR UN TOUR » (décision ChatGPT, 03/10/2026).
// Référence officielle : commit b5e0f15648117dcea7ec56d14af433bddd57f2d6, VERSION 0.61.2,
// VERSION_BASE 10, 1451/1451 ×2.
//
// OBJECTIF UNIQUE (section 1 du cadrage) : quand un tour produit RÉELLEMENT une trace (voie
// 'action'/'rejeu'/'composition'), exposer `idTrace: trace.id` sur l'objet retourné — AUCUN autre
// changement. L'id EXPOSÉ est STRICTEMENT celui de la trace effectivement persistée/poussée
// PENDANT ce tour (jamais retrouvé après coup, jamais une recherche, jamais la dernière de
// e.traces) : la fonction lit directement la variable locale `trace` qu'elle vient elle-même de
// construire quelques lignes plus haut dans son propre corps — c'est la CONSERVATION de l'identité,
// pas sa RECONSTRUCTION (section 2 du cadrage).
//
// Ce chantier teste la couche ecran.js (dynamique, invocation réelle) pour les trois voies, PUIS
// la couche main.js (statique, lecture de source) pour le simple transport additif vers le retour
// conversationnel — exactement le même principe que les autres tests "statiques" déjà présents
// dans ce dépôt (comprendre.js ne référence jamais B1, etc.) : main.js n'est jamais importé dans
// les tests (effets de bord DOM au chargement du module), donc son contenu se vérifie par lecture
// de source, comme c'est déjà la convention établie ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { apprendreFait, apprendreRegle } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { apprendreAction } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { evaluerAction } from '../app/langage/action.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
function monter(magasin = magasinMemoireVive()) {
  return { magasin, ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true }) };
}

const EXEMPLES_VALIDES = [
  'zact zorbo zcouleur zbleu',
  'zact ztoro zcouleur zbleu',
  'zact zorbo ztaille zbleu',
  'zact zorbo zcouleur zrouge',
];
const ROLES_VALIDES = ['sujetA', 'relation', 'sujetB'];

let compteurId = 0;
function traceAction(texteBrut, capacite, provenancePositions, voie = 'action') {
  compteurId += 1;
  return {
    id: compteurId, sequence: compteurId, horodatage: '2000-01-01T00:00:00.000Z',
    capacite, voie, argumentsUtilises: {}, provenanceArguments: {},
    resultat: { peuImporte: true }, contexte: voie === 'action' ? { texteBrut, tokens: [] } : null,
    provenancePositions,
  };
}
function corpusRejeuUnique() {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  return { traces: [t1, t2], texte: 'zaccede zrelNOUVEAU zordre zvalA' };
}
function corpusRejeuAucune() {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  return { traces: [t1, t2], texte: 'zrien zdutout zici znulpart zenplus' };
}
function corpusRejeuAmbigu() {
  const r1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const r2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const d1 = traceAction('zWWD1 zduA zqqqD1 zvalA', 'deduction', { sujet: 1, role: 3 });
  const d2 = traceAction('zWWD2 zduB zqqqD2 zvalA', 'deduction', { sujet: 1, role: 3 });
  return { traces: [r1, r2, d1, d2], texte: 'zaccede zrelNOUVEAU zordre zvalA' };
}
function corpusRejeuDeduction() {
  const d1 = traceAction('zduA zancre zvalA', 'deduction', { sujet: 0, role: 2 });
  const d2 = traceAction('zduB zancre zvalA', 'deduction', { sujet: 0, role: 2 });
  return { traces: [d1, d2], texte: 'zduNOUVEAU zancre zvalA' };
}

// ============================================================================ VOIE ACTION
test('A/B. action enseignée, invocation réelle réussie -> idTrace présent et EXACTEMENT égal à l\'id de la trace poussée', async () => {
  const { ecran } = monter();
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(e, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'zbleu' });
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  const avant = e.traces.length;
  const r = await ecran.tenterReconnaissanceAction('zact zalpha zcouleur zbeta');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, true);
  assert.equal(e.traces.length, avant + 1);
  const traceCreee = e.traces[e.traces.length - 1];
  assert.equal(traceCreee.voie, 'action');
  assert.equal(r.idTrace, traceCreee.id, 'idTrace doit être EXACTEMENT l\'id de la trace réellement poussée ce tour-ci');
});

test('G. action non reconnue (aucun squelette) -> {reconnu:false}, aucun idTrace (champ absent)', async () => {
  const { ecran } = monter();
  await ecran.assurerEsprit();
  const r = await ecran.tenterReconnaissanceAction('une phrase totalement sans rapport');
  assert.deepEqual(r, { reconnu: false });
  assert.ok(!('idTrace' in r));
});

test('H. action ambiguë (deux squelettes VALIDÉS correspondent à la même entrée, corpus identique à action-ecran.test.mjs #7) -> aucun idTrace', async () => {
  const { ecran } = monter();
  const action1 = evaluerAction({
    operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'],
    exemples: ['zconfronte zorbo zcouleur zbleu', 'zconfronte ztoro zcouleur zbleu', 'zconfronte zorbo ztaille zbleu', 'zconfronte zorbo zcouleur zrouge'],
  });
  await ecran.confirmerAction({ operation: 'confrontation', roles: action1.roles, n: action1.n, exemples: action1.exemples, statut: action1.statut });
  const action2 = evaluerAction({
    operation: 'confrontation', roles: ['sujetA', 'sujetB', 'relation'],
    exemples: ['zalpha zorbo2 zcouleur2 zkelmi', 'zbeta zorbo2 zcouleur2 zkelmi', 'zalpha ztoro2 zcouleur2 zkelmi', 'zalpha zorbo2 ztaille2 zkelmi'],
  });
  await ecran.confirmerAction({ operation: 'confrontation', roles: action2.roles, n: action2.n, exemples: action2.exemples, statut: action2.statut });
  const r = await ecran.tenterReconnaissanceAction('zconfronte zorbo zcouleur zkelmi');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'ambigu');
  assert.ok(!('idTrace' in r), 'une ambiguïté n\'invoque jamais rien : aucune trace, donc aucun idTrace');
});

// ============================================================================ VOIE REJEU
test('C/D. rejeu autonome, invocation réelle réussie -> idTrace présent et EXACTEMENT égal à l\'id de la trace "rejeu" poussée', async () => {
  const { traces, texte } = corpusRejeuUnique();
  const { ecran } = (() => {
    const m = magasinMemoireVive();
    return { ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => m, confirmer: () => true }) };
  })();
  const e = await ecran.assurerEsprit();
  for (const t of traces) e.traces.push(t);
  const avant = e.traces.length;
  const r = await ecran.tenterRejeuAutonome(texte);
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, true);
  assert.equal(e.traces.length, avant + 1);
  const traceCreee = e.traces[e.traces.length - 1];
  assert.equal(traceCreee.voie, 'rejeu');
  assert.equal(r.idTrace, traceCreee.id);
});

test('I. rejeu "aucune possibilité admissible" -> {reconnu:false}, aucun idTrace', async () => {
  const { traces, texte } = corpusRejeuAucune();
  const m = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => m, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  for (const t of traces) e.traces.push(t);
  const r = await ecran.tenterRejeuAutonome(texte);
  assert.deepEqual(r, { reconnu: false });
  assert.ok(!('idTrace' in r));
});

test('J. rejeu "ambigu" -> aucun idTrace', async () => {
  const { traces, texte } = corpusRejeuAmbigu();
  const m = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => m, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  for (const t of traces) e.traces.push(t);
  const r = await ecran.tenterRejeuAutonome(texte);
  assert.deepEqual(r, { reconnu: false });
  assert.ok(!('idTrace' in r));
});

test('L. exception RÉELLE de capacite.invoquer() pendant un rejeu -> propagée, aucune trace, donc aucun idTrace nulle part', async () => {
  const { traces, texte } = corpusRejeuDeduction();
  const m = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => m, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  for (const t of traces) e.traces.push(t);
  const avant = e.traces.length;
  e.regles = undefined;
  await assert.rejects(() => ecran.tenterRejeuAutonome(texte), /filter/);
  assert.equal(e.traces.length, avant, 'aucune trace créée après une exception réelle de la capacité');
});

test('M. échec de persistance (magasin.ecrire) pendant un rejeu, APRÈS invocation réussie -> exception propagée, aucune trace, aucun idTrace', async () => {
  const { traces, texte } = corpusRejeuUnique();
  const m = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => m, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  for (const t of traces) e.traces.push(t);
  const avant = e.traces.length;
  const original = e.magasin.ecrire;
  e.magasin.ecrire = async (table, objet) => {
    if (table === 'traces') throw new Error('panne simulée pendant la persistance de la trace');
    return original.call(e.magasin, table, objet);
  };
  await assert.rejects(() => ecran.tenterRejeuAutonome(texte), /panne simulée/);
  assert.equal(e.traces.length, avant, 'aucune trace poussée dans e.traces si la persistance échoue avant le push : contrat existant inchangé (section 7 du cadrage)');
});

// ============================================================================ VOIE COMPOSITION
test('E/F. composition explicite, invocation réelle réussie -> idTrace présent et EXACTEMENT égal à l\'id de la trace "composition" poussée', async () => {
  const { ecran } = monter();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(esprit, { role: 'zrole1', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zcouleur' });
  const magasin = esprit.magasin;
  const EXEMPLES_DEDUCTION = ['zdeduit zorbo zrole1', 'zdeduit zkelmi zrole1', 'zdeduit zorbo zrole2'];
  const evalue = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: EXEMPLES_DEDUCTION });
  await apprendreAction(magasin, { ...evalue, operation: 'deduction' });
  esprit.actions = await magasin.lireTout('actions');
  await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  await ecran.confirmerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  const avant = esprit.traces.length;
  const r = await ecran.invoquerComposition({
    operation: 'confrontation',
    argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' },
  });
  assert.equal(r.ok, true);
  const dernieresTraces = await magasin.lireTout('traces');
  const traceComposition = dernieresTraces.filter((t) => t.voie === 'composition');
  assert.equal(traceComposition.length, 1);
  assert.equal(r.idTrace, traceComposition[0].id);
  assert.equal(esprit.traces.length, avant + 1);
  assert.equal(esprit.traces[esprit.traces.length - 1].id, r.idTrace);
});

test('K. composition échouée avant invocation (rôle non résolu) -> aucun idTrace', async () => {
  const { ecran } = monter();
  await ecran.assurerEsprit();
  const r = await ecran.invoquerComposition({
    operation: 'confrontation',
    argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' },
  });
  assert.equal(r.ok, false);
  assert.ok(!('idTrace' in r));
});

test('K-bis. composition : opération inconnue -> aucun idTrace', async () => {
  const { ecran } = monter();
  await ecran.assurerEsprit();
  const r = await ecran.invoquerComposition({ operation: 'zinexistante', argumentsExplicites: {} });
  assert.equal(r.ok, false);
  assert.ok(!('idTrace' in r));
});

// ============================================================================ N/O/P/Q/R/S/T — PROPAGATION DANS main.js (STATIQUE)
const mainJs = fs.readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');

test('N. transformation : contrat historique, main.js ne propage jamais idTrace pour cette voie (statique)', () => {
  const bloc = mainJs.slice(
    mainJs.indexOf('const reconnaissance = await ecranLangage.tenterReconnaissanceTransformation'),
    mainJs.indexOf('const reconnaissanceAction = await ecranLangage.tenterReconnaissanceAction'),
  );
  assert.ok(!bloc.includes('idTrace'), 'la voie transformation ne crée jamais de trace : aucun idTrace ne doit y être propagé');
});

test('O. voie conversationnelle (idExperience) : inchangée, jamais fusionnée ni renommée (statique)', () => {
  assert.ok(mainJs.includes('idExperience: experience.id'), 'idExperience doit rester le nom utilisé pour la voie expérience, inchangé');
  assert.ok(!mainJs.includes('idTrace: experience.id'), 'idTrace et idExperience ne doivent jamais être fusionnés');
});

test('P. main.js propage idTrace pour les voies action/rejeu/composition quand il est présent (statique)', () => {
  const blocAction = mainJs.slice(
    mainJs.indexOf('const reconnaissanceAction = await ecranLangage.tenterReconnaissanceAction'),
    mainJs.indexOf('const reconnaissanceRejeu = await ecranLangage.tenterRejeuAutonome'),
  );
  assert.ok(blocAction.includes('idTrace'), 'le bloc action doit transporter idTrace vers le retour du tour');
  const blocRejeu = mainJs.slice(
    mainJs.indexOf('const reconnaissanceRejeu = await ecranLangage.tenterRejeuAutonome'),
    mainJs.indexOf('const reconnaissanceRejeu = await ecranLangage.tenterRejeuAutonome') + 700,
  );
  assert.ok(blocRejeu.includes('idTrace'), 'le bloc rejeu doit transporter idTrace vers le retour du tour');
  assert.ok(mainJs.includes('r.idTrace') || mainJs.includes('invocation.idTrace'), 'composerDepuisBloc doit transporter idTrace depuis invoquerComposition()');
});

test('Q. aucune recherche de "dernière trace" ajoutée dans main.js par ce chantier (statique)', () => {
  assert.ok(!mainJs.includes('e.traces[e.traces.length'));
  assert.ok(!mainJs.includes('.traces.slice(-1)'));
  assert.ok(!mainJs.includes('traces.at(-1)'));
});

test('R. aucun consommateur de idTrace ajouté par ce chantier (statique) : aucun bouton, aucune UI, aucune expérience créée depuis une trace', () => {
  assert.ok(!mainJs.includes('referenceTrace'), 'ce chantier ne doit jamais remplir referenceTrace lui-même');
});

test('S. referenceTrace reste dormante : connaissances.js inchangé par ce chantier (statique, contrôle de non-régression)', () => {
  const src = fs.readFileSync(new URL('../app/langage/connaissances.js', import.meta.url), 'utf8');
  assert.ok(src.includes('referenceTrace: referenceTrace ? { idTrace: referenceTrace.idTrace } : null'));
});

test('T. traceExploitable()/possibilitesRejeuAdmissibles() inchangées par ce chantier (statique)', () => {
  const src = fs.readFileSync(new URL('../app/langage/vue-traces.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('idTrace'), 'vue-traces.js ne doit jamais connaître idTrace : rejeu/preuves restent inchangés');
});
// === FIN_TEST_IDENTITE_TRACE_EXPOSEE ===
