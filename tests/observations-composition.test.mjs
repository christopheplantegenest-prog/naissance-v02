// === DEBUT_TEST_OBSERVATIONS_COMPOSITION ===
// v0.62.4 — ÉTAPE 6, décision ChatGPT « OBSERVATIONS DE COMPOSITION » (03/10/2026), suite aux diagnostics
// « ÉTAT DES CANDIDATES À T » et « CONTRAT ». Une observation de composition conserve, AU MOMENT T et
// sans rien reconstruire plus tard, les rôles réellement examinés et l'état de TOUTES les liaisons
// candidates de chaque rôle lié -- y compris quand la capacité cible n'est jamais invoquée (abstention),
// cas où aucune trace n'existe. Elle ne décide rien : `.find`, valeurLiee, choix, abstention, rejeu et
// provenanceLiaisons restent strictement inchangés. Table DORMANTE : aucun consommateur décisionnel.
//
// Ces tests exercent les VRAIS appels sur le vrai écran de langage (comme provenance-liaisons.test.mjs).
// Domaine ARTIFICIEL neutre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { apprendreFait, apprendreRegle, chargerEsprit } from '../app/langage/esprit.js';
import {
  magasinMemoireVive, apprendreAction, enregistrerObservationComposition, ouvrirIndexedDB,
  TABLES, CLE, VERSION_BASE, NOM_BASE,
} from '../app/langage/connaissances.js';
import { evaluerAction } from '../app/langage/action.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import {
  enregistrerResultat, invoquerAvecLiaisons, valeurLiee, observerCandidates,
  creerCollecteurObservation, instantaneObservation,
} from '../app/langage/composition.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import {
  SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete,
} from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});

const T_OBS = 'observationsComposition';

// Magasin dont l'écriture de certaines tables peut être coupée à volonté.
function magasinFragile() {
  const base = magasinMemoireVive();
  const pannes = new Set();
  return {
    pannes,
    ...base,
    async ecrire(table, objet) {
      if (pannes.has(table)) throw new Error(`PANNE ${table}`);
      return base.ecrire(table, objet);
    },
  };
}

async function monter({ liaisons = [] } = {}) {
  const magasin = magasinFragile();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(e, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(e, { role: 'zrole1', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zcouleur' });
  await apprendreRegle(e, { role: 'zrole2', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'ztaille' });
  const ev = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: ['zdeduit zorbo zrole1', 'zdeduit zkelmi zrole1', 'zdeduit zorbo zrole2'] });
  await apprendreAction(magasin, { ...ev, operation: 'deduction' });
  e.actions = await magasin.lireTout('actions');
  for (const l of liaisons) await ecran.confirmerLiaison(l);
  return { magasin, ecran, e };
}

const L = (capaciteSource, champ, role = 'relation', capaciteCible = 'confrontation') => ({ capaciteSource, champ, capaciteCible, role });

// SOURCES réelles (valeurs connues du domaine artificiel).
const SOURCES = {
  deduction: (c) => c.ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1'), // deduction.resultat = 'zcouleur'
  accessibilite: (c) => c.ecran.invoquerComposition({ operation: 'accessibilite', argumentsExplicites: { sujetA: 'zorbo', operateur: 'zcouleur', sujetB: 'zkelmi' } }), // etat = 'inaccessible'
  recherche: (c) => c.ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } }), // sujets = [...] (non scalaire)
  confrontation: (c) => c.ecran.invoquerComposition({ operation: 'confrontation', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi', relation: 'zcouleur' } }), // etat 'egal', valeurA = valeurB = 'zbleu'
  confrontationInconnue: (c) => c.ecran.invoquerComposition({ operation: 'confrontation', argumentsExplicites: { sujetA: 'zinconnu', sujetB: 'zkelmi', relation: 'zcouleur' } }), // valeurA = null
};
async function lancer(c, noms) {
  const ids = {};
  for (const n of noms) { const r = await SOURCES[n](c); ids[n] = r.idTrace; }
  return ids;
}
const composerB = (ecran, extra = {}) => ecran.invoquerComposition({
  operation: 'confrontation', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi', ...extra },
});
const observations = (magasin) => magasin.lireTout(T_OBS);
const traceDe = async (magasin, id) => (await magasin.lireTout('traces')).find((t) => t.id === id);
const EXPL = [{ role: 'sujetA', explicite: true }, { role: 'sujetB', explicite: true }];
const comptes = async (magasin) => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await magasin.lireTout(t)).length])));

// ============================================================================ CONTRAT TABLE / SCHÉMA
// MISE À JOUR DÉLIBÉRÉE (v0.63.0) : VERSION_BASE 14, SCHEMA_SAUVEGARDE 4, 18 tables ('observationsLangage' ajoutée).
test('contrat : table "observationsComposition" (clé id), VERSION_BASE 15, SCHEMA_SAUVEGARDE 5, 19 tables (v0.63.16)', () => {
  assert.ok(TABLES.includes(T_OBS));
  assert.equal(CLE[T_OBS], 'id');
  assert.equal(VERSION_BASE, 16); // MISE À JOUR DÉLIBÉRÉE v0.63.19 : + executionsOperations (16 / 6 / 20)
  assert.equal(SCHEMA_SAUVEGARDE, 6); // MISE À JOUR DÉLIBÉRÉE v0.63.19 : + executionsOperations (16 / 6 / 20)
  assert.equal(TABLES.length, 20); // MISE À JOUR DÉLIBÉRÉE v0.63.19 : + executionsOperations (16 / 6 / 20)
});

// MISE À JOUR DÉLIBÉRÉE (v0.63.0) : la base simulée est toujours celle d'avant 'observationsComposition' ; la version
// courante étant 14, la mise à niveau crée désormais AUSSI 'observationsLangage'. Le cas 13 -> 14 est testé à part.
test('migration 12 -> 16 (IndexedDB simulée) : crée SEULEMENT les magasins manquants, ne touche aucune donnée existante', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.19 : + executionsOperations (base 16, schéma 6)
  const magasinsExistants = TABLES.filter((t) => t !== T_OBS && t !== 'observationsLangage' && t !== 'observationsPossibilites' && t !== 'executionsOperations');
  const donnees = new Map(magasinsExistants.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = [];
  let versionDemandee = null;
  let nomDemande = null;
  const fabrique = {
    open(nom, version) {
      nomDemande = nom; versionDemandee = version;
      const db = {
        objectStoreNames: { contains: (t) => donnees.has(t) },
        createObjectStore: (t, opts) => { crees.push([t, opts.keyPath]); donnees.set(t, []); },
        onversionchange: null,
        close() {},
        transaction: () => ({}),
      };
      const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); });
      return r;
    },
  };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nomDemande, NOM_BASE);
  assert.equal(versionDemandee, 16, 'la version doit être incrémentée pour déclencher onupgradeneeded');
  assert.deepEqual(crees, [[T_OBS, 'id'], ['observationsLangage', 'id'], ['observationsPossibilites', 'id'], ['executionsOperations', 'id']], 'seuls les magasins manquants sont créés');
  for (const t of magasinsExistants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], `données de ${t} intactes`);
});

async function etatSauvegarde() {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  const obs = await enregistrerObservationComposition(magasinLangage, {
    operation: 'confrontation', idTrace: null, roleNonResolu: 'relation',
    roles: [{ role: 'sujetA', explicite: true }, { role: 'relation', candidates: [{ idLiaison: 'l1', etat: 'utilisable', idTraceSource: null, valeur: null }] }],
  });
  return { memoire, magasinLangage, obs };
}
async function enSchemaAncien(fichier, schema, sansTables) {
  const f = JSON.parse(fichier.contenu);
  f.schema = schema;
  for (const t of sansTables) delete f.donnees.langage[t];
  f.empreinte = await empreinte(JSON.stringify(f.donnees));
  return f;
}
const maintenant = new Date('2026-10-03T20:00:00Z');

test('sauvegarde (schéma courant) : la table est exportée et restaurée à l\'identique (aller-retour complet)', async () => {
  const { memoire, magasinLangage, obs } = await etatSauvegarde();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.4', maintenant });
  assert.equal(fichier.objet.schema, 6); // MISE À JOUR DÉLIBÉRÉE v0.63.19 : + executionsOperations (base 16, schéma 6)
  assert.deepEqual(fichier.objet.donnees.langage[T_OBS], [obs]);
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lu.donnees });
  assert.deepEqual(await neuf.lireTout(T_OBS), [obs]);
});

test('migration schéma 2 -> 3 : sauvegarde de schéma 2 sans la table = importable, table VIDE, anciennes données inchangées', async () => {
  const { memoire, magasinLangage } = await etatSauvegarde();
  await magasinLangage.ecrire('journal', { id: 'j1', texte: 'ancien' });
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.3', maintenant });
  const ancienne = await enSchemaAncien(fichier, 2, [T_OBS]);
  const lu = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  assert.deepEqual(lu.donnees.langage[T_OBS], [], 'aucune reconstruction rétroactive');
  assert.deepEqual(lu.donnees.langage.journal, [{ id: 'j1', texte: 'ancien' }]);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lu.donnees });
  assert.deepEqual(await neuf.lireTout(T_OBS), []);
  assert.deepEqual(await neuf.lireTout('journal'), [{ id: 'j1', texte: 'ancien' }]);
});

test('schéma courant (6) reste STRICT (table manquante = refus) et un schéma futur (7) est refusé', async () => {
  const { memoire, magasinLangage } = await etatSauvegarde();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.4', maintenant });
  const incomplet = await enSchemaAncien(fichier, 6, [T_OBS]);
  const lu = await lireSauvegardeComplete(JSON.stringify(incomplet), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, false);
  assert.match(lu.erreur, /incomplet.*observationsComposition/);
  const futur = await enSchemaAncien(fichier, 7, []);
  const lu2 = await lireSauvegardeComplete(JSON.stringify(futur), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu2.ok, false);
  assert.match(lu2.erreur, /plus récente/);
});

// ============================================================================ PRIMITIVE DE PERSISTANCE
test('primitive : forme exacte {id, horodatage, operation, idTrace, roleNonResolu, roles}, id/horodatage internes', async () => {
  const magasin = magasinMemoireVive();
  const roles = [{ role: 'a', explicite: true }, { role: 'b', candidates: [] }];
  const o = await enregistrerObservationComposition(magasin, { operation: 'confrontation', roleNonResolu: 'b', roles });
  assert.deepEqual(Object.keys(o).sort(), ['horodatage', 'id', 'idTrace', 'operation', 'roleNonResolu', 'roles']);
  assert.match(o.id, /^observation-composition-/);
  assert.equal(o.idTrace, null);
  assert.equal(Number.isNaN(Date.parse(o.horodatage)), false);
  assert.deepEqual(await magasin.lireTout(T_OBS), [o]);
  roles[1].candidates.push('MUTATION'); // copie : plus de lien avec l'entrée
  assert.deepEqual(o.roles[1].candidates, []);
});

test('primitive : refuse tout-explicite, états inconnus, clés incohérentes avec l\'état, ids invalides (aucune écriture)', async () => {
  const magasin = magasinMemoireVive();
  const ok = [{ role: 'r', candidates: [{ idLiaison: 'l', etat: 'aucun_resultat' }] }];
  const mauvais = [
    { operation: '', roles: ok },
    { operation: 'x', roles: [{ role: 'a', explicite: true }] },
    { operation: 'x', roles: [] },
    { operation: 'x', roles: 'nope' },
    { operation: 'x', idTrace: '', roles: ok },
    { operation: 'x', idTrace: 7, roles: ok },
    { operation: 'x', roleNonResolu: '', roles: ok },
    { operation: 'x', roles: [{ role: 'r', candidates: [{ idLiaison: 'l', etat: 'valeur_disponible', idTraceSource: null, valeur: 1 }] }] },
    { operation: 'x', roles: [{ role: 'r', candidates: [{ idLiaison: 'l', etat: 'aucun_resultat', idTraceSource: null }] }] },
    { operation: 'x', roles: [{ role: 'r', candidates: [{ idLiaison: 'l', etat: 'champ_absent' }] }] },
    { operation: 'x', roles: [{ role: 'r', candidates: [{ idLiaison: 'l', etat: 'utilisable', idTraceSource: null }] }] },
    { operation: 'x', roles: [{ role: 'r', candidates: [{ idLiaison: 'l', etat: 'champ_absent', idTraceSource: null, valeur: 1 }] }] },
    { operation: 'x', roles: [{ role: 'r' }] },
    { operation: 'x', roles: [{ role: '', candidates: [] }] },
  ];
  for (const m of mauvais) await assert.rejects(() => enregistrerObservationComposition(magasin, m), /Observation invalide/);
  assert.deepEqual(await observations(magasin), []);
});

// ============================================================================ CAS A-I (VRAI mécanisme)
test('A. aucune liaison : candidates [], abstention, idTrace null, roleNonResolu "relation"', async () => {
  const c = await monter();
  const b = await composerB(c.ecran);
  assert.equal(b.ok, false);
  const [o] = await observations(c.magasin);
  assert.equal((await observations(c.magasin)).length, 1);
  assert.deepEqual(o.roles, [...EXPL, { role: 'relation', candidates: [] }]);
  assert.equal(o.idTrace, null);
  assert.equal(o.roleNonResolu, 'relation');
  assert.equal(o.operation, 'confrontation');
  assert.equal((await c.magasin.lireTout('traces')).length, 0, 'aucune trace d\'abstention');
});

test('B. une liaison utilisable : réussite, trace B, observation après la trace (idTrace = trace B, roleNonResolu null)', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  const ids = await lancer(c, ['deduction']);
  const b = await composerB(c.ecran);
  assert.equal(b.ok, true);
  const os = await observations(c.magasin);
  assert.equal(os.length, 1);
  const [o] = os;
  assert.equal(o.idTrace, b.idTrace);
  assert.equal(o.roleNonResolu, null);
  assert.deepEqual(o.roles, [...EXPL, { role: 'relation', candidates: [{
    idLiaison: c.e.liaisons[0].id, etat: 'utilisable', idTraceSource: ids.deduction, valeur: 'zcouleur',
  }] }]);
  assert.equal((await traceDe(c.magasin, b.idTrace)).argumentsUtilises.relation, 'zcouleur');
});

test('C1. une liaison, aucun_resultat : abstention, clé idTraceSource ABSENTE, pas de valeur', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  const b = await composerB(c.ecran);
  assert.equal(b.ok, false);
  const [o] = await observations(c.magasin);
  const cand = o.roles[2].candidates[0];
  assert.deepEqual(cand, { idLiaison: c.e.liaisons[0].id, etat: 'aucun_resultat' });
  assert.equal(Object.prototype.hasOwnProperty.call(cand, 'idTraceSource'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(cand, 'valeur'), false);
  assert.equal(o.roleNonResolu, 'relation');
});

test('C2. champ_absent : idTraceSource PRÉSENT (exécution dont le résultat a été examiné), pas de valeur', async () => {
  const c = await monter({ liaisons: [L('deduction', 'zchampInexistant')] });
  const ids = await lancer(c, ['deduction']);
  assert.equal((await composerB(c.ecran)).ok, false);
  const cand = (await observations(c.magasin))[0].roles[2].candidates[0];
  assert.deepEqual(cand, { idLiaison: c.e.liaisons[0].id, etat: 'champ_absent', idTraceSource: ids.deduction });
  assert.equal(Object.prototype.hasOwnProperty.call(cand, 'valeur'), false);
});

test('C3. champ_non_scalaire : idTraceSource présent, la valeur (liste) n\'est JAMAIS conservée', async () => {
  const c = await monter({ liaisons: [L('recherche', 'sujets')] });
  const ids = await lancer(c, ['recherche']);
  assert.equal((await composerB(c.ecran)).ok, false);
  const cand = (await observations(c.magasin))[0].roles[2].candidates[0];
  assert.deepEqual(cand, { idLiaison: c.e.liaisons[0].id, etat: 'champ_non_scalaire', idTraceSource: ids.recherche });
});

test('D. deux utilisables (valeurs différentes) : observation L1 + L2, provenanceLiaisons = L1 seule, valeur utilisée = celle de L1', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat'), L('accessibilite', 'etat')] });
  const ids = await lancer(c, ['deduction', 'accessibilite']);
  const b = await composerB(c.ecran);
  assert.equal(b.ok, true);
  const [o] = await observations(c.magasin);
  const [l1, l2] = c.e.liaisons;
  assert.deepEqual(o.roles[2].candidates, [
    { idLiaison: l1.id, etat: 'utilisable', idTraceSource: ids.deduction, valeur: 'zcouleur' },
    { idLiaison: l2.id, etat: 'utilisable', idTraceSource: ids.accessibilite, valeur: 'inaccessible' },
  ]);
  const tr = await traceDe(c.magasin, b.idTrace);
  assert.deepEqual(tr.provenanceLiaisons, { relation: { idTraceSource: ids.deduction, idLiaison: l1.id } }, 'provenance inchangée : L1 seule');
  assert.equal(tr.argumentsUtilises.relation, 'zcouleur', 'choix inchangé (.find : la première)');
});

test('E (TEST CENTRAL). L1 aucun_resultat puis L2 utilisable : comportement ACTUEL = abstention ; l\'observation conserve L1 ET L2', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat'), L('accessibilite', 'etat')] });
  const ids = await lancer(c, ['accessibilite']);
  const nbTraces = (await c.magasin.lireTout('traces')).length;
  const b = await composerB(c.ecran);
  assert.equal(b.ok, false, 'abstention inchangée : L2 n\'est jamais choisie');
  assert.match(b.texte, /aucun_resultat/);
  assert.equal((await c.magasin.lireTout('traces')).length, nbTraces, 'aucune trace B');
  const os = await observations(c.magasin);
  assert.equal(os.length, 1);
  const [l1, l2] = c.e.liaisons;
  assert.deepEqual(os[0].roles[2].candidates, [
    { idLiaison: l1.id, etat: 'aucun_resultat' },
    { idLiaison: l2.id, etat: 'utilisable', idTraceSource: ids.accessibilite, valeur: 'inaccessible' },
  ]);
  assert.equal(os[0].idTrace, null);
  assert.equal(os[0].roleNonResolu, 'relation');
});

test('F. L1 utilisable, L2 inutilisable : réussite avec L1 ; observation des deux', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat'), L('accessibilite', 'etat')] });
  const ids = await lancer(c, ['deduction']);
  const b = await composerB(c.ecran);
  assert.equal(b.ok, true);
  const [o] = await observations(c.magasin);
  const [l1, l2] = c.e.liaisons;
  assert.deepEqual(o.roles[2].candidates, [
    { idLiaison: l1.id, etat: 'utilisable', idTraceSource: ids.deduction, valeur: 'zcouleur' },
    { idLiaison: l2.id, etat: 'aucun_resultat' },
  ]);
});

test('G. deux inutilisables pour des raisons différentes : les deux états distincts sont conservés', async () => {
  const c = await monter({ liaisons: [L('deduction', 'zchampInexistant'), L('recherche', 'sujets'), L('accessibilite', 'etat')] });
  const ids = await lancer(c, ['deduction', 'recherche']);
  assert.equal((await composerB(c.ecran)).ok, false);
  const [o] = await observations(c.magasin);
  const [l1, l2, l3] = c.e.liaisons;
  assert.deepEqual(o.roles[2].candidates, [
    { idLiaison: l1.id, etat: 'champ_absent', idTraceSource: ids.deduction },
    { idLiaison: l2.id, etat: 'champ_non_scalaire', idTraceSource: ids.recherche },
    { idLiaison: l3.id, etat: 'aucun_resultat' },
  ]);
});

test('H. deux utilisables avec la MÊME valeur (même source) : deux candidates distinctes, valeurs identiques, provenance L1', async () => {
  const c = await monter({ liaisons: [L('confrontation', 'valeurA'), L('confrontation', 'valeurB')] });
  const ids = await lancer(c, ['confrontation']);
  const b = await composerB(c.ecran);
  assert.equal(b.ok, true);
  const [o] = await observations(c.magasin);
  const [l1, l2] = c.e.liaisons;
  assert.deepEqual(o.roles[2].candidates, [
    { idLiaison: l1.id, etat: 'utilisable', idTraceSource: ids.confrontation, valeur: 'zbleu' },
    { idLiaison: l2.id, etat: 'utilisable', idTraceSource: ids.confrontation, valeur: 'zbleu' },
  ]);
  assert.equal((await traceDe(c.magasin, b.idTrace)).provenanceLiaisons.relation.idLiaison, l1.id);
});

test('ORDRE des candidates = ordre d\'apprentissage des liaisons (inverser l\'apprentissage inverse l\'observation)', async () => {
  const c = await monter({ liaisons: [L('accessibilite', 'etat'), L('deduction', 'resultat')] });
  await lancer(c, ['deduction', 'accessibilite']);
  await composerB(c.ecran);
  const [o] = await observations(c.magasin);
  assert.deepEqual(o.roles[2].candidates.map((x) => x.idLiaison), c.e.liaisons.map((l) => l.id));
  assert.deepEqual(o.roles[2].candidates.map((x) => x.valeur), ['inaccessible', 'zcouleur']);
});

test('VALEUR null RÉELLE : etat utilisable, clé valeur PRÉSENTE avec null ; idTraceSource conservé', async () => {
  const c = await monter({ liaisons: [L('confrontation', 'valeurA')] });
  const ids = await lancer(c, ['confrontationInconnue']);
  assert.equal(c.e.derniersResultats.get('confrontation').valeurA, null, 'précondition');
  await composerB(c.ecran);
  const cand = (await observations(c.magasin))[0].roles[2].candidates[0];
  assert.equal(cand.etat, 'utilisable');
  assert.equal(Object.prototype.hasOwnProperty.call(cand, 'valeur'), true);
  assert.equal(cand.valeur, null);
  assert.equal(cand.idTraceSource, ids.confrontationInconnue);
});

test('idTraceSource: null (panne de la trace source) : candidate utilisable avec idTraceSource null, JAMAIS une ancienne origine', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  await lancer(c, ['deduction']);
  c.magasin.pannes.add('traces');
  await assert.rejects(() => c.ecran.tenterReconnaissanceAction('zdeduit zkelmi zrole1'), /PANNE traces/);
  c.magasin.pannes.delete('traces');
  const b = await composerB(c.ecran);
  assert.equal(b.ok, true);
  const cand = (await observations(c.magasin))[0].roles[2].candidates[0];
  assert.equal(cand.etat, 'utilisable');
  assert.equal(cand.idTraceSource, null);
  assert.equal(Object.prototype.hasOwnProperty.call(cand, 'idTraceSource'), true);
});

// ============================================================================ RÔLES
test('rôle explicite AVANT un rôle lié : présent comme {role, explicite:true}, sans candidates ni valeur d\'argument', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  await lancer(c, ['deduction']);
  await composerB(c.ecran);
  const [o] = await observations(c.magasin);
  assert.deepEqual(o.roles.slice(0, 2), EXPL);
  assert.equal(JSON.stringify(o).includes('zorbo'), false, 'aucune valeur d\'argument explicite conservée');
});

test('TOUT explicite : AUCUNE observation (la trace normale suffit), table inchangée', async () => {
  const c = await monter();
  const avant = await comptes(c.magasin);
  const b = await composerB(c.ecran, { relation: 'zcouleur' });
  assert.equal(b.ok, true);
  const apres = await comptes(c.magasin);
  assert.equal(apres[T_OBS], 0);
  for (const t of TABLES) assert.equal(apres[t], t === 'traces' ? avant[t] + 1 : avant[t], `table ${t}`);
});

test('opération inconnue : AUCUNE observation (rien n\'a été examiné)', async () => {
  const c = await monter();
  const r = await c.ecran.invoquerComposition({ operation: 'zinconnue', argumentsExplicites: {} });
  assert.equal(r.ok, false);
  assert.deepEqual(await observations(c.magasin), []);
});

test('rôle APRÈS le blocage : ABSENT (jamais observé par anticipation), même si un argument explicite le concerne', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat', 'sujetB', 'accessibilite')] }); // une liaison existe pour sujetB, mais sujetB n'est jamais atteint
  await lancer(c, ['deduction']);
  const r = await c.ecran.invoquerComposition({ operation: 'accessibilite', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' } });
  assert.equal(r.ok, false);
  const [o] = await observations(c.magasin);
  assert.equal(o.roleNonResolu, 'operateur');
  assert.deepEqual(o.roles, [{ role: 'sujetA', explicite: true }, { role: 'operateur', candidates: [] }]);
  assert.equal(o.roles.some((x) => x.role === 'sujetB'), false);
});

test('PLUSIEURS rôles liés avec des situations différentes : une entrée par rôle, dans l\'ordre de la capacité', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat', 'sujetA'), L('accessibilite', 'etat', 'relation')] });
  const ids = await lancer(c, ['deduction']);
  const r = await c.ecran.invoquerComposition({ operation: 'confrontation', argumentsExplicites: { sujetB: 'zkelmi' } });
  assert.equal(r.ok, false);
  const [o] = await observations(c.magasin);
  // confrontation : sujetA (liaison, utilisable) puis sujetB (explicite) puis relation (liaison, aucun_resultat -> blocage)
  assert.deepEqual(o.roles, [
    { role: 'sujetA', candidates: [{ idLiaison: c.e.liaisons[0].id, etat: 'utilisable', idTraceSource: ids.deduction, valeur: 'zcouleur' }] },
    { role: 'sujetB', explicite: true },
    { role: 'relation', candidates: [{ idLiaison: c.e.liaisons[1].id, etat: 'aucun_resultat' }] },
  ]);
  assert.equal(o.roleNonResolu, 'relation');
});

// ============================================================================ MOMENT T
test('cible = source : l\'observation conserve l\'état ANTÉRIEUR à la réécriture de derniersResultats par la cible', async () => {
  const c = await monter({ liaisons: [L('confrontation', 'etat')] });
  const ids = await lancer(c, ['confrontation']);
  const resultatAvant = c.e.derniersResultats.get('confrontation');
  assert.equal(resultatAvant.etat, 'egal');
  const b = await composerB(c.ecran);
  assert.equal(b.ok, true);
  assert.notEqual(c.e.derniersResultats.get('confrontation'), resultatAvant, 'précondition : la cible a réécrit sa propre entrée');
  const [o] = await observations(c.magasin);
  assert.equal(o.roles[2].candidates[0].valeur, 'egal');
  assert.equal(o.roles[2].candidates[0].idTraceSource, ids.confrontation, 'la trace source de T, pas la trace B');
  assert.notEqual(o.roles[2].candidates[0].idTraceSource, b.idTrace);
});

test('un deuxième Compose = une AUTRE observation (append-only, aucun dédoublonnage, aucune mise à jour)', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  await composerB(c.ecran); // abstention
  const [premiere] = await observations(c.magasin);
  await lancer(c, ['deduction']);
  const b = await composerB(c.ecran); // réussite
  const os = await observations(c.magasin);
  assert.equal(os.length, 2);
  assert.deepEqual(os.find((o) => o.id === premiere.id), premiere, 'la première observation n\'a pas été réécrite');
  assert.equal(os.find((o) => o.id !== premiere.id).idTrace, b.idTrace);
  assert.equal(premiere.roles[2].candidates[0].etat, 'aucun_resultat', 'l\'histoire vécue à T n\'est pas recalculée');
});

// ============================================================================ PANNES
test('PANNE d\'écriture de l\'observation (réussite) : composition, trace, texte et Map strictement identiques, aucune exception', async () => {
  const ref = await monter({ liaisons: [L('deduction', 'resultat')] });
  await lancer(ref, ['deduction']);
  const bRef = await composerB(ref.ecran);
  const trRef = await traceDe(ref.magasin, bRef.idTrace);

  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  await lancer(c, ['deduction']);
  c.magasin.pannes.add(T_OBS);
  const b = await composerB(c.ecran);
  assert.equal(b.ok, true);
  assert.equal(b.texte, bRef.texte);
  const tr = await traceDe(c.magasin, b.idTrace);
  for (const k of ['capacite', 'voie', 'argumentsUtilises', 'provenanceArguments', 'resultat', 'contexte', 'provenancePositions']) assert.deepEqual(tr[k], trRef[k], k);
  assert.deepEqual(Object.keys(tr.provenanceLiaisons), ['relation']);
  assert.equal(c.e.originesResultats.get('confrontation').idTrace, b.idTrace, 'origine de B notée normalement');
  assert.deepEqual(await observations(c.magasin), []);
});

test('PANNE d\'écriture de l\'observation (abstention) : même texte d\'abstention, aucune exception, rien écrit', async () => {
  const ref = await monter({ liaisons: [L('deduction', 'resultat')] });
  const bRef = await composerB(ref.ecran);
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  c.magasin.pannes.add(T_OBS);
  const b = await composerB(c.ecran);
  assert.equal(b.ok, false);
  assert.equal(b.texte, bRef.texte);
  assert.deepEqual(await observations(c.magasin), []);
});

test('PANNE de la trace B : observation écrite (idTrace null, roleNonResolu null) PUIS exception originale relancée telle quelle', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  const ids = await lancer(c, ['deduction']);
  c.magasin.pannes.add('traces');
  await assert.rejects(() => composerB(c.ecran), (err) => err instanceof Error && err.message === 'PANNE traces');
  c.magasin.pannes.delete('traces');
  const os = await observations(c.magasin);
  assert.equal(os.length, 1);
  assert.equal(os[0].idTrace, null);
  assert.equal(os[0].roleNonResolu, null);
  assert.equal(os[0].roles[2].candidates[0].idTraceSource, ids.deduction);
  assert.equal(c.e.derniersResultats.has('confrontation'), true, 'comportement antérieur : Map[B] déjà écrit');
  assert.equal(c.e.originesResultats.has('confrontation'), false, 'aucune origine inventée');
});

test('PANNE de la trace B ET de l\'observation : seule l\'exception originale sort', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  await lancer(c, ['deduction']);
  c.magasin.pannes.add('traces');
  c.magasin.pannes.add(T_OBS);
  await assert.rejects(() => composerB(c.ecran), (err) => err.message === 'PANNE traces');
  assert.deepEqual(await observations(c.magasin), []);
});

test('EXCEPTION d\'une capacité : AUCUNE observation, l\'exception se propage comme avant', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  await lancer(c, ['deduction']);
  c.e.faits = null; // casse confronter() APRÈS résolution des rôles (la résolution ne lit pas esprit.faits)
  await assert.rejects(() => composerB(c.ecran), TypeError);
  assert.deepEqual(await observations(c.magasin), []);
});

test('ÉCHEC DU COLLECTEUR (niveau écran) : observation abandonnée (aucune observation partielle), composition normale', async () => {
  const c = await monter({ liaisons: [L('deduction', 'resultat')] });
  const ids = await lancer(c, ['deduction']);
  const l = c.e.liaisons[0];
  const id = l.id;
  let lectures = 0;
  Object.defineProperty(l, 'id', { get() { lectures += 1; if (lectures === 1) throw new Error('boom collecteur'); return id; }, configurable: true, enumerable: true });
  const b = await composerB(c.ecran);
  assert.equal(b.ok, true, 'la composition fonctionne comme avant');
  assert.deepEqual(await observations(c.magasin), [], 'aucune observation partielle');
  const tr = await traceDe(c.magasin, b.idTrace);
  assert.deepEqual(tr.provenanceLiaisons, { relation: { idTraceSource: ids.deduction, idLiaison: id } });
});

test('ÉCHEC DU COLLECTEUR (invoquerAvecLiaisons) : même retour qu\'avec ou sans collecteur', async () => {
  const faireEsprit = async () => {
    const e = await chargerEsprit(magasinMemoireVive());
    e.liaisons = [{ id: 'l1', statut: 'validee', capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'accessibilite', role: 'operateur' }];
    enregistrerResultat(e, 'deduction', { resultat: 'zcouleur' });
    return e;
  };
  const args = { operation: 'accessibilite', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' } };
  const sans = invoquerAvecLiaisons(await faireEsprit(), args);
  const casse = { get roles() { throw new Error('collecteur cassé'); }, roleNonResolu: null, abandonnee: false };
  const avec = invoquerAvecLiaisons(await faireEsprit(), { ...args, collecteur: casse });
  assert.deepEqual(avec, sans);
  assert.equal(instantaneObservation(casse), null);
  // Un collecteur null / absent est inoffensif.
  assert.deepEqual(invoquerAvecLiaisons(await faireEsprit(), { ...args, collecteur: null }), sans);
});

test('le collecteur ne MODIFIE PAS le retour de invoquerAvecLiaisons (réussite et abstention : deepEqual avec / sans)', async () => {
  const etat = async () => {
    const e = await chargerEsprit(magasinMemoireVive());
    e.liaisons = [{ id: 'l1', statut: 'validee', capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'recherche', role: 'valeur' }];
    return e;
  };
  for (const avecResultat of [false, true]) {
    const e1 = await etat(); const e2 = await etat();
    if (avecResultat) { enregistrerResultat(e1, 'deduction', { resultat: 'v' }); enregistrerResultat(e2, 'deduction', { resultat: 'v' }); }
    const args = { operation: 'recherche', argumentsExplicites: { relation: 'zcouleur' } };
    const sans = invoquerAvecLiaisons(e1, args);
    const col = creerCollecteurObservation();
    const avec = invoquerAvecLiaisons(e2, { ...args, collecteur: col });
    assert.deepEqual(avec, sans);
    assert.equal(instantaneObservation(col).roles.length, 2);
  }
});

// ============================================================================ PURETÉ + COHÉRENCE AVEC valeurLiee
function esprit({ liaisons, derniers = null, origines = null }) {
  return { liaisons, derniersResultats: derniers, originesResultats: origines };
}
const liaison = (id, src, champ, extra = {}) => ({ id, statut: 'validee', capaciteSource: src, champ, capaciteCible: 'confrontation', role: 'relation', ...extra });
const Q = { capaciteCible: 'confrontation', role: 'relation' };

test('PURETÉ : observerCandidates n\'écrit nulle part (liaisons, Map, résultats, originesResultats) et ne fait que has/get sur la Map', () => {
  const journal = [];
  const base = new Map([['deduction', { resultat: 'x', n: 1 }], ['recherche', { sujets: ['a'] }]]);
  const espion = new Proxy(base, {
    get(t, k) {
      const v = Reflect.get(t, k, t);
      if (typeof v === 'function') return (...a) => { journal.push(String(k)); return v.apply(t, a); };
      return v;
    },
  });
  const res = base.get('deduction');
  const origines = new Map([['deduction', { resultat: res, idTrace: 'trace-1' }]]);
  const liaisons = [liaison('l1', 'deduction', 'resultat'), liaison('l2', 'recherche', 'sujets'), liaison('l3', 'accessibilite', 'etat'), liaison('l4', 'deduction', 'zz')];
  const e = esprit({ liaisons, derniers: espion, origines });
  const instantane = () => JSON.stringify([e.liaisons, [...base], [...origines]]);
  const refs = [...liaisons, ...base.values(), ...origines.values()];
  const avant = instantane();
  const cands = observerCandidates(e, Q);
  assert.equal(cands.length, 4);
  assert.equal(instantane(), avant);
  assert.deepEqual([...liaisons, ...base.values(), ...origines.values()].map((x, i) => x === refs[i]), refs.map(() => true));
  assert.equal(e.liaisons, liaisons);
  assert.ok(journal.length > 0 && journal.every((m) => m === 'has' || m === 'get'), `appels Map: ${journal}`);
  assert.equal(base.size, 2);
  assert.equal(origines.size, 1);
});

test('PURETÉ : aucune invocation de capacité (une capacité qui lèverait n\'est jamais appelée), esprit sans derniersResultats toléré', () => {
  const e = { liaisons: [liaison('l1', 'deduction', 'resultat')] };
  assert.deepEqual(observerCandidates(e, Q), [{ idLiaison: 'l1', etat: 'aucun_resultat' }]);
  assert.deepEqual(Object.keys(e), ['liaisons'], 'n\'ajoute aucune propriété (ni derniersResultats ni originesResultats)');
  const sansListe = { derniersResultats: new Map() };
  assert.deepEqual(observerCandidates(sansListe, Q), []);
});

const CAS_COHERENCE = [
  ['aucune liaison', [], new Map()],
  ['autre couple (cible / rôle) ignoré', [liaison('x', 'deduction', 'resultat', { role: 'sujetA' })], new Map([['deduction', { resultat: 'v' }]])],
  ['liaison non validée ignorée', [liaison('x', 'deduction', 'resultat', { statut: 'proposee' })], new Map([['deduction', { resultat: 'v' }]])],
  ['aucun_resultat', [liaison('l1', 'deduction', 'resultat')], new Map()],
  ['derniersResultats absent', [liaison('l1', 'deduction', 'resultat')], undefined],
  ['résultat source null -> champ_absent', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', null]])],
  ['champ_absent', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { autre: 1 }]])],
  ['champ valeur undefined -> champ_absent', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { resultat: undefined }]])],
  ['champ_non_scalaire (liste)', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { resultat: ['a'] }]])],
  ['champ_non_scalaire (objet)', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { resultat: { a: 1 } }]])],
  ['constructor', [liaison('l1', 'deduction', 'constructor')], new Map([['deduction', { resultat: 'v' }]])],
  ['__proto__', [liaison('l1', 'deduction', '__proto__')], new Map([['deduction', { resultat: 'v' }]])],
  ['toString', [liaison('l1', 'deduction', 'toString')], new Map([['deduction', { resultat: 'v' }]])],
  ['utilisable chaîne', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { resultat: 'v' }]])],
  ['utilisable chaîne vide', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { resultat: '' }]])],
  ['utilisable null', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { resultat: null }]])],
  ['utilisable false', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { resultat: false }]])],
  ['utilisable 0', [liaison('l1', 'deduction', 'resultat')], new Map([['deduction', { resultat: 0 }]])],
  ['première inutilisable + seconde utilisable', [liaison('l1', 'recherche', 'sujets'), liaison('l2', 'deduction', 'resultat')], new Map([['deduction', { resultat: 'v' }]])],
  ['deux utilisables', [liaison('l1', 'deduction', 'resultat'), liaison('l2', 'deduction', 'resultat')], new Map([['deduction', { resultat: 'v' }]])],
];
for (const [nom, liaisons, derniers] of CAS_COHERENCE) {
  test(`COHÉRENCE (test de dérive permanent) : première candidate observée <-> valeurLiee — ${nom}`, () => {
    const e = esprit({ liaisons, derniers });
    const cands = observerCandidates(e, Q);
    const vl = valeurLiee(e, Q);
    if (cands.length === 0) {
      assert.equal(vl.ok, false);
      assert.equal(vl.raison, 'aucune_liaison');
      return;
    }
    const premiere = cands[0];
    assert.equal(vl.liaison.id, premiere.idLiaison, '`.find` désigne exactement la première candidate observée');
    if (premiere.etat === 'utilisable') {
      assert.equal(vl.ok, true);
      assert.ok(Object.is(vl.valeur, premiere.valeur));
    } else {
      assert.equal(vl.ok, false);
      assert.equal(vl.raison, premiere.etat, 'raison de valeurLiee = état observé');
    }
    // Nombre de candidates = nombre de liaisons validées du couple (jamais autre chose).
    assert.equal(cands.length, liaisons.filter((l) => l.statut === 'validee' && l.capaciteCible === Q.capaciteCible && l.role === Q.role).length);
  });
}

test('VALEURS LIMITES : NaN / Infinity / -0 sont une limite JSON CONNUE et assumée (aucune capacité actuelle n\'en produit)', async () => {
  const cands = observerCandidates(esprit({
    liaisons: [liaison('l1', 'deduction', 'resultat')], derniers: new Map([['deduction', { resultat: NaN }]]),
  }), Q);
  assert.ok(Number.isNaN(cands[0].valeur), 'à T, en mémoire : NaN fidèle');
  const magasin = magasinMemoireVive();
  const o = await enregistrerObservationComposition(magasin, {
    operation: 'confrontation', roleNonResolu: 'relation', roles: [{ role: 'relation', candidates: cands }],
  });
  assert.equal(o.roles[0].candidates[0].valeur, null, 'LIMITE DOCUMENTÉE : NaN -> null à la copie JSON');
  assert.equal(JSON.stringify([-0, Infinity]), '[0,null]');
});

test('AUCUN résultat de capacité du registre ne contient de nombre : la limite NaN/Infinity/-0 est inatteignable aujourd\'hui', async () => {
  const c = await monter();
  await lancer(c, ['deduction', 'accessibilite', 'recherche', 'confrontation', 'confrontationInconnue']);
  const aplatir = (v, sortie = []) => {
    if (typeof v === 'number') sortie.push(v);
    else if (Array.isArray(v)) v.forEach((x) => aplatir(x, sortie));
    else if (v && typeof v === 'object') Object.values(v).forEach((x) => aplatir(x, sortie));
    return sortie;
  };
  for (const [capacite, resultat] of c.e.derniersResultats) assert.deepEqual(aplatir(resultat), [], `${capacite} ne produit aucun nombre`);
});

// ============================================================================ CHOIX / .find / REJEU INCHANGÉS
test('valeurLiee est STRICTEMENT inchangée (texte pinglé) : `.find` sur la première liaison validée', () => {
  const attendu = `function valeurLiee(esprit, { capaciteCible, role }) {
  const liaison = (esprit.liaisons || []).find((l) => l.statut === 'validee'
    && l.capaciteCible === capaciteCible && l.role === role);
  if (!liaison) return { ok: false, raison: 'aucune_liaison' };
  const derniersResultats = esprit.derniersResultats;
  if (!derniersResultats || !derniersResultats.has(liaison.capaciteSource)) {
    return { ok: false, raison: 'aucun_resultat', liaison };
  }
  const resultatSource = derniersResultats.get(liaison.capaciteSource);
  const valeur = resultatSource ? resultatSource[liaison.champ] : undefined;
  if (valeur === undefined) return { ok: false, raison: 'champ_absent', liaison };
  if (!estScalaire(valeur)) return { ok: false, raison: 'champ_non_scalaire', liaison };
  return { ok: true, valeur, liaison };
}`;
  assert.equal(valeurLiee.toString(), attendu);
});

test('CHOIX inchangé : plusieurs candidates utilisables -> toujours la première ; E -> abstention ; l\'observation n\'influence rien', async () => {
  const avecObs = await monter({ liaisons: [L('accessibilite', 'etat'), L('deduction', 'resultat')] });
  await lancer(avecObs, ['deduction', 'accessibilite']);
  const b = await composerB(avecObs.ecran);
  assert.equal((await traceDe(avecObs.magasin, b.idTrace)).argumentsUtilises.relation, 'inaccessible', 'la première liaison apprise (accessibilite)');
  // Même scénario SANS aucune écriture possible dans la table : résultat identique.
  const sansObs = await monter({ liaisons: [L('accessibilite', 'etat'), L('deduction', 'resultat')] });
  sansObs.magasin.pannes.add(T_OBS);
  await lancer(sansObs, ['deduction', 'accessibilite']);
  const b2 = await composerB(sansObs.ecran);
  assert.equal((await traceDe(sansObs.magasin, b2.idTrace)).argumentsUtilises.relation, 'inaccessible');
  assert.equal(b2.texte, b.texte);
});

test('ACTION et REJEU n\'écrivent AUCUNE observation et n\'en lisent aucune (table inchangée)', async () => {
  const c = await monter();
  const avant = await comptes(c.magasin);
  const r = await c.ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  assert.equal(r.reconnu, true);
  let n = 1000;
  const faux = (texteBrut) => {
    n += 1;
    return {
      id: n, sequence: n, horodatage: '2000-01-01T00:00:00.000Z', capacite: 'deduction', voie: 'action',
      argumentsUtilises: {}, provenanceArguments: {}, resultat: { peuImporte: true },
      contexte: { texteBrut, tokens: [] }, provenancePositions: { sujet: 1, role: 3 },
    };
  };
  c.e.traces.push(faux('zaccede zsA zordre zvalA'), faux('zaccede zsB zordre zvalA'));
  const rejeu = await c.ecran.tenterRejeuAutonome('zaccede zsNEW zordre zvalA');
  assert.equal(rejeu.reconnu, true, 'précondition : un VRAI rejeu a eu lieu');
  const apres = await comptes(c.magasin);
  assert.equal(apres[T_OBS], 0);
  assert.equal(apres[T_OBS], avant[T_OBS]);
});

test('provenanceLiaisons INCHANGÉ : même contenu avec ou sans observation possible (champs de la trace B identiques)', async () => {
  const a = await monter({ liaisons: [L('deduction', 'resultat'), L('accessibilite', 'etat')] });
  const ia = await lancer(a, ['deduction', 'accessibilite']);
  const ba = await composerB(a.ecran);
  const ta = await traceDe(a.magasin, ba.idTrace);
  assert.deepEqual(ta.provenanceLiaisons, { relation: { idTraceSource: ia.deduction, idLiaison: a.e.liaisons[0].id } });
  assert.deepEqual(Object.keys(ta).sort(), ['argumentsUtilises', 'capacite', 'contexte', 'horodatage', 'id', 'provenanceArguments', 'provenanceLiaisons', 'provenancePositions', 'resultat', 'sequence', 'voie']);
  assert.equal(Object.prototype.hasOwnProperty.call(ta, 'observation'), false, 'la trace ne porte aucun champ d\'observation');
});

// ============================================================================ TABLE DORMANTE
function sourcesApp(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) { if (nom !== 'node_modules') sourcesApp(chemin, sortie); } else if (nom.endsWith('.js')) sortie.push(chemin);
  }
  return sortie;
}

const sansCommentaires = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

test('DORMANTE : aucun fichier de l\'app ne lit la table ; seul connaissances.js la nomme dans son code, seuls connaissances.js et ecran.js touchent la primitive', () => {
  const racine = join(import.meta.dirname, '..', 'app');
  const fichiers = sourcesApp(racine);
  const rel = (f) => relative(racine, f).split('\\').join('/');
  const nommant = fichiers.filter((f) => sansCommentaires(readFileSync(f, 'utf8')).includes(T_OBS)).map(rel).sort();
  assert.deepEqual(nommant, ['langage/connaissances.js']);
  const primitive = fichiers.filter((f) => sansCommentaires(readFileSync(f, 'utf8')).includes('enregistrerObservationComposition')).map(rel).sort();
  assert.deepEqual(primitive, ['langage/connaissances.js', 'langage/ecran.js']);
  for (const f of fichiers) {
    assert.equal(/lireTout\(\s*['"`]observationsComposition/.test(readFileSync(f, 'utf8')), false, `${f} ne lit jamais la table`);
  }
  // ecran.js n'appelle que la primitive d'écriture ; jamais de lecture des observations.
  const ecran = sansCommentaires(readFileSync(join(racine, 'langage', 'ecran.js'), 'utf8'));
  const lignes = ecran.split('\n').filter((l) => /ObservationComposition|observerCandidates|instantaneObservation/.test(l));
  assert.ok(lignes.length > 0);
  for (const l of lignes) assert.equal(/lireTout|\.filter\(|\.find\(/.test(l), false, `ligne suspecte : ${l}`);
});

test('DORMANTE : rejeu, vue-traces, sélection, induction, registre, action ne mentionnent ni la table ni la fonction sœur', () => {
  const racine = join(import.meta.dirname, '..', 'app', 'langage');
  for (const nom of ['vue-traces.js', 'selection.js', 'induction.js', 'registre.js', 'action.js', 'retours-traces.js', 'retours-par-capacite.js', 'retours-par-structure.js', 'valeurs-observees.js', 'regles.js', 'deduction.js', 'confrontation.js', 'accessibilite.js', 'pont.js']) {
    const src = readFileSync(join(racine, nom), 'utf8');
    assert.equal(/observationsComposition|observerCandidates|ObservationComposition|instantaneObservation/.test(src), false, `${nom} ne doit jamais connaître l'observation`);
  }
});

test('DORMANTE : composition.js n\'écrit jamais dans le magasin (aucun `magasin`/`.ecrire(` hors commentaires)', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'app', 'langage', 'composition.js'), 'utf8');
  const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.equal(/\.ecrire\(|esprit\.magasin|\.magasin\b/.test(code), false);
});
// === FIN_TEST_OBSERVATIONS_COMPOSITION ===
