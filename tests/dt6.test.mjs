// === DEBUT_TEST_DT6 ===
// v0.63.93 — DT6 : LE LOT MÉCANIQUE N'EXÉCUTE QUE LES APPLICATIONS DÉTERMINÉES NOUVELLES (décisions ChatGPT « DÉCISION DT6 — PASSAGE AU CODE » et
// « DÉCISION POINT D'ÉTAPE v0.63.93 / DT6 — OPTION 2 », 12/10/2026). Une application déjà exécutée (clé stricte .91 cleApplication, lue sur les
// porteurs de l'univers) est ignorée comme déjà exécutée : ni choixAFaire, ni retirée de l'observation, rendue en diagnostic `dejaExecutees`.
// B1 : un tour n'est actif que s'il exécute au moins une application NOUVELLE. Le bouton extérieur .77 reste hors B1. Tests D1–D12, OBSERVER ≠ AGIR,
// diagnostic seulement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES } from '../app/langage/connaissances.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee, executerApplicationAvecOrigine } from '../app/langage/execution-sollicitee.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { lireCapacite, tourActif, peutAgir } from '../app/langage/capacite.js';
import { lireRelation, consequenceReception } from '../app/langage/relation.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { BESOIN_RELATION, lireBesoins, moyensParStrategie, cleApplication } from '../app/langage/besoins.js';
import { traiterOccasion, relireEpisode, rotationDActualisation } from '../app/langage/episode-propre.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');

// RECONSTITUTION D'UNE BASE ANCIENNE (D7, D12) : copie À L'IDENTIQUE du corps du lot v0.63.92 (toutes les applications déterminées, connues ou non).
// Utilisée UNIQUEMENT pour construire un passé vécu sous .60–.92 ; tout ce qui suit dans ces tests est vécu sous .93.
async function lotAncien92({ observation, univers }, { magasin, table }) {
  const descriptions = DESCRIPTIONS_OPERATIONS;
  const { applications, choixAFaire } = applicationsSollicitables(observation, descriptions, univers);
  const resultats = [];
  for (const application of applications) {
    const r = await executerApplicationAvecOrigine({ observation, application, univers }, { magasin, table, descriptions }, 'mecanique');
    resultats.push({ operation: application.operation, statut: r.statut, designation: r.designation, execution: r.execution, erreur: r.erreur });
  }
  return { applications, choixAFaire, resultats };
}

// Le PIPELINE RÉEL de main.js : observation → porte B1 → lot (.93) → émission → tourActif si ≥ 1 exécution NOUVELLE ; réception → conséquence B2 ;
// événements → traiterOccasion ; tick idem. `ancien` : lot .92 (base ancienne) ; `coutFixture` : primitive B1 de fixture (prérequis d'état c).
function monde(depart = 0, magasinInitial = null) {
  const magasin = magasinInitial ?? magasinMemoireVive(); let n = depart; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null, { ancien = false, coutFixture = false } = {}) {
    let capacite = null;
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin); const porte = !peutAgir(avant);
      const lot = porte ? { applications: [], choixAFaire: [], resultats: [], dejaExecutees: [] } : await (ancien ? lotAncien92 : executerApplicationsDeterminees)({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      let variation = null;
      if (lot.resultats.some((r) => r.statut === 'executee') || (coutFixture && !porte)) variation = (await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage })).variation;
      capacite = { avant: avant.valeur, apres: (await lireCapacite(magasin)).valeur, porte, variation };
      return { ...lot, emises, echecEmission: echec, capacite };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation; let reception = null;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); reception = d.reception; await consequenceReception(magasin, d.reception); }
    const episodes = []; for (const ev of [s.observation.id, reception ? reception.id : null].filter(Boolean)) episodes.push(await traiterOccasion(magasin, ev));
    return { ...s, capacite, reception, episodes };
  }
  // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : depuis .94, chaque message est une donnée NOUVELLE qui apporte ses propres applications
  // (déterminées relativement à l'observation). « La MÊME application » (.93) se teste donc en OBSERVANT DE NOUVEAU LA MÊME DONNÉE (même identité,
  // fixture : le pont crée toujours une identité neuve), par le même pipeline (porte, lot, émission, tourActif) — sans nouvelle valeur ni réception.
  async function reobserver(s) {
    const message = { id: s.observation.idMessage, texte: (await magasin.lireTout('valeursDonnees')).find((v) => v.id === s.observation.idMessage).valeur };
    const o = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
    const avant = await lireCapacite(magasin); const porte = !peutAgir(avant);
    const lot = porte ? { applications: [], choixAFaire: [], resultats: [], dejaExecutees: [], relatives: [] } : await executerApplicationsDeterminees({ observation: o.observation, univers: o.univers }, { magasin, table: TABLE_OPERATIONS });
    const { emises } = await emettreLot(lot, { magasin, idObservation: o.observation.id });
    let variation = null;
    if (lot.resultats.some((r) => r.statut === 'executee')) variation = (await tourActif(magasin, { idObservation: o.observation.id, horodatage: o.observation.horodatage })).variation;
    return { observation: o.observation, univers: o.univers, automatiques: lot.resultats, dejaExecutees: lot.dejaExecutees, relatives: lot.relatives, applications: lot.applications, choixAFaire: lot.choixAFaire, emises, capacite: { avant: avant.valeur, apres: (await lireCapacite(magasin)).valeur, porte, variation } };
  }
  async function tick() { const t = await tickPropre(magasin); return { ...t, episode: await traiterOccasion(magasin, t.tick.id) }; }
  async function exterieur(s, application) { return executerApplicationSollicitee({ observation: s.observation, application, univers: s.univers }, { magasin, table: TABLE_OPERATIONS }); }
  return { magasin, tour, reobserver, tick, exterieur, ticks: async (k) => { const o = []; for (let i = 0; i < k; i += 1) o.push(await tick()); return o; }, vecu: () => lireExecutionsVecues(magasin), compteur: () => n }; // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : `compteur` expose la valeur courante du compteur d'identités, pour qu'une copie reparte EXACTEMENT de l'instantané (jamais à zéro)
}
const rows = (w, t) => w.magasin.lireTout(t);
const compte = async (w) => ({ obs: (await rows(w, 'observationsPossibilites')).length, ex: (await rows(w, 'executionsOperations')).length, em: (await rows(w, 'emissions')).length, d: (await rows(w, 'designations')).length, vc: (await rows(w, 'variationsCapacite')).length, att: (await rows(w, 'attentesProspectives')).length, ctx: (await rows(w, 'contextesProspectifs')).length });
const coutsDe = async (w, idObservation) => (await rows(w, 'variationsCapacite')).filter((v) => v.cause.type === 'tour' && v.cause.id === idObservation);
const copie = async (m) => { const x = magasinMemoireVive(); await x.remplacerTout(Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await m.lireTout(t)])))); return x; };
const clesExecutees = async (w) => new Set((await rows(w, 'executionsOperations')).map((x) => cleApplication(x)));
const SATURATION = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max'];
// Monde saturé : 3 tours actifs (2, 4, 9 applications NOUVELLES), puis un repos pour rouvrir la porte (c = 1) : au tour suivant, la seule application
// déterminée est déjà exécutée.
async function sature(w) { const t = []; for (const m of SATURATION.slice(0, 3)) t.push(await w.tour(m)); await w.tick(); return t; }

// MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : copie PROFONDE (structuredClone des 35 tables lues par lireTout, puis remplacerTout dans un magasin neuf). `tablesDe` prend un instantané cloné ; `magasinDepuis` le reclone dans un magasin neuf : la base mémoïsée n'est jamais remise à un test, même en lecture.
const tablesDe = async (m) => structuredClone(Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await m.lireTout(t)]))));
const magasinDepuis = async (tables) => { const x = magasinMemoireVive(); await x.remplacerTout(structuredClone(tables)); return x; };
const instantane = async (w, reste = {}) => ({ tables: await tablesDe(w.magasin), n: w.compteur(), ...structuredClone(reste) });
// MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : le préfixe stabilisé (sature, tour « bonjour Max », tick, reobserver(s0), tick — voir D2) était reconstruit 6 fois (D2, D5, D6, D9, D11, DIAGNOSTIC) ; il est construit UNE fois (promesse mémoïsée, au premier appel) puis jeté ; chaque test reçoit un monde NEUF sur une copie profonde, le compteur d'identités repris exactement, et un `s0` cloné (reobserver ne lit que s.observation.idMessage). D11 (« ne pas toucher ») garde sa construction propre.
let PREFIXE = null;
function prefixeStabilise() {
  if (!PREFIXE) PREFIXE = (async () => { const w = monde(); await sature(w); const s0 = await w.tour('bonjour Max'); await w.tick(); await w.reobserver(s0); await w.tick(); return instantane(w, { s0 }); })();
  return PREFIXE.then(async (b) => ({ w: monde(b.n, await magasinDepuis(b.tables)), s0: structuredClone(b.s0) }));
}

test('D1. application NOUVELLE → exécutée (origine mecanique), émise, UN coût B1 (cause = observation du tour)', async () => {
  const w = monde(); const s1 = await w.tour('bonjour Pixel');
  assert.deepEqual(s1.dejaExecutees, []);
  assert.equal(s1.automatiques.length, 2); for (const r of s1.automatiques) { assert.equal(r.statut, 'executee'); assert.equal(r.designation.origine, 'mecanique'); }
  assert.deepEqual(s1.emises.map((e) => e.idExecution).sort(), s1.automatiques.map((r) => r.execution.id).sort());
  assert.equal((await coutsDe(w, s1.observation.id)).length, 1); assert.equal(s1.capacite.avant, 3); assert.equal(s1.capacite.apres, 2);
});

test('D2. la MÊME application au tour suivant → aucune exécution, aucune émission, aucun coût du lot ; elle est rendue en diagnostic « déjà exécutée » (MISE À JOUR DÉLIBÉRÉE v0.63.94 : la même donnée observée de nouveau)', async () => {
  const { w, s0 } = await prefixeStabilise(); assert.ok(s0.automatiques.length > 0); // stabilisation : la chaîne produite par s0 rend elementsObservables nouvelle une fois // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : préfixe mémoïsé, copie profonde
  const avant = await compte(w);
  const s = await w.reobserver(s0);
  assert.equal(s.capacite.porte, false); assert.ok(s.capacite.avant > 0);
  assert.deepEqual(s.automatiques, []); assert.deepEqual(s.emises, []); assert.equal(s.capacite.variation, null); assert.equal(s.capacite.apres, s.capacite.avant);
  assert.ok(s.dejaExecutees.length >= 3, 'structure ET relatives à O, toutes déjà exécutées');
  const cles = await clesExecutees(w); for (const d of s.dejaExecutees) assert.ok(cles.has(cleApplication(d)), 'clé stricte .91 d\'une exécution persistée');
  assert.equal((await coutsDe(w, s.observation.id)).length, 0);
  const apres = await compte(w); assert.equal(apres.ex, avant.ex); assert.equal(apres.em, avant.em); assert.equal(apres.d, avant.d); assert.equal(apres.vc, avant.vc);
});

test('D3. connue + nouvelles dans le MÊME lot → seules les nouvelles sont exécutées, exactement UN coût (la connue l\'est par une sollicitation extérieure .77 faite porte fermée)', async () => {
  const w = monde(); await w.tour('bonjour Pixel');
  for (const k of [1, 2]) await tourActif(w.magasin, { idObservation: `fixture-cout-${k}`, horodatage: new Date().toISOString() }); // fixture : c = 0
  const s2 = await w.tour('bonjour Luna'); assert.equal(s2.capacite.porte, true); assert.deepEqual(s2.automatiques, []);
  const connue = s2.applications.find((a) => a.operation === 'elementsObservables'); assert.ok(connue);
  assert.equal((await w.exterieur(s2, connue)).statut, 'executee');
  await w.tick(); // c 0 → 1
  const s3 = await w.tour('bonjour Pixel');
  assert.deepEqual(s3.dejaExecutees.map((d) => cleApplication(d)), [cleApplication(connue)]);
  assert.ok(s3.automatiques.length >= 2); for (const r of s3.automatiques) { assert.equal(r.statut, 'executee'); assert.notEqual(cleApplication({ operation: r.operation, liaisons: r.designation.liaisons }), cleApplication(connue), 'la connue n\'est pas relancée'); }
  assert.equal(s3.emises.length, s3.automatiques.length);
  assert.equal((await coutsDe(w, s3.observation.id)).length, 1, 'exactement un coût'); assert.equal(s3.capacite.avant, 1); assert.equal(s3.capacite.apres, 0);
});

test('D4. plusieurs NOUVELLES → toutes exécutées, toutes émises, UN seul coût', async () => {
  const w = monde(); const t = await sature(w);
  assert.deepEqual(t.map((s) => s.automatiques.length), [2, 5, 10]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : + les applications déterminées relativement à l'observation assert.deepEqual(t.map((s) => s.dejaExecutees.length), [0, 0, 0]);
  for (const s of t) { assert.equal(s.emises.length, s.automatiques.length); assert.equal((await coutsDe(w, s.observation.id)).length, 1); }
  assert.deepEqual(t.map((s) => [s.capacite.avant, s.capacite.apres]), [[3, 2], [2, 1], [1, 0]]);
});

test('D5. connue + INDÉTERMINÉES → aucune « fausse nouvelle » : les choix à faire ne sont ni exécutés ni désignés (MISE À JOUR DÉLIBÉRÉE v0.63.94 : même donnée observée de nouveau ; et, pour une donnée nouvelle, seuls ses propres liens à O sont désignés)', async () => {
  const { w, s0 } = await prefixeStabilise(); // stabilisation (voir D2) // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : préfixe mémoïsé, copie profonde
  const s = await w.reobserver(s0);
  assert.ok(s.choixAFaire.length > 0); assert.ok(s.dejaExecutees.length > 0); assert.deepEqual(s.automatiques, []);
  assert.equal((await rows(w, 'designations')).filter((d) => d.idObservation === s.observation.id).length, 0);
  for (const d of (await rows(w, 'designations')).filter((x) => x.idObservation === s0.observation.id && s0.choixAFaire.includes(x.operation))) assert.equal(d.liaisons[0].donnee, s0.observation.idMessage, `${d.operation} : seulement la donnée de O`);
});

test('D6. bouton extérieur « Exécuter » (.77) sur une application CONNUE → toujours possible, hors B1 (aucun coût), aucune émission ; le lot suivant ne la relance pas', async () => {
  const { w, s0 } = await prefixeStabilise(); // stabilisation (voir D2) // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : préfixe mémoïsé, copie profonde
  const s = await w.reobserver(s0); const connue = s.dejaExecutees.find((d) => d.operation === 'elementsObservables');
  const avant = await compte(w);
  const r = await w.exterieur(s, { operation: connue.operation, liaisons: connue.liaisons });
  assert.equal(r.statut, 'executee'); assert.equal(r.designation.origine, 'exterieure');
  const apres = await compte(w); assert.equal(apres.ex, avant.ex + 1); assert.equal(apres.vc, avant.vc, 'hors B1'); assert.equal(apres.em, avant.em, 'aucune émission');
  const s2 = await w.reobserver(s0); assert.deepEqual(s2.automatiques, []); // MISE À JOUR DÉLIBÉRÉE v0.63.94 : même donnée observée de nouveau
  const s3 = await w.tour('bonjour Luna'); assert.equal(s3.automatiques.some((x) => cleApplication({ operation: x.operation, liaisons: x.designation.liaisons }) === cleApplication(connue)), false, 'jamais relancée par le lot');
});

// Base ANCIENNE (lot .92) : n occurrences prouvées de la même application elementsObservables.
// MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : baseAncienne(2) et baseAncienne(3) étaient construites séparément (D12, D7). La boucle testant `repondues.length < n` en tête d'itération, l'état de baseAncienne(2) est EXACTEMENT celui de baseAncienne(3) juste après le 2e push : la base est construite UNE fois (promesse mémoïsée, au premier appel), avec un instantané (tables clonées, compteur, cle, repondues clonés) après le 2e push et un à l'état final ; le monde d'origine est jeté. baseAncienne(n) rend un monde NEUF sur une copie profonde de l'instantané n, compteur repris exactement.
let BASE_ANCIENNE = null;
function instantanesBaseAncienne() {
  if (BASE_ANCIENNE) return BASE_ANCIENNE;
  BASE_ANCIENNE = (async () => {
    const n = 3; const instantanes = {};
    const w = monde(); await w.tour('bonjour Pixel', null, { ancien: true });
    let cle = null; const repondues = [];
    for (let i = 0; i < 30 && repondues.length < n; i += 1) {
      await w.ticks(2);
      const s = await w.tour(`m${i}`, null, { ancien: true }); const e = s.emises.find((x) => x.operation === 'elementsObservables'); if (!e) continue;
      const k = cleApplication((await rows(w, 'executionsOperations')).find((x) => x.id === e.idExecution));
      if (cle === null) { if (i < 2) continue; cle = k; } if (k !== cle) continue;
      await w.tick(); await w.tour(`r${i}`, e.idEmission, { ancien: true }); repondues.push(e.idExecution);
      if (repondues.length === 2) instantanes[2] = await instantane(w, { cle, repondues });
    }
    assert.equal(repondues.length, n);
    instantanes[3] = await instantane(w, { cle, repondues });
    return instantanes;
  })();
  return BASE_ANCIENNE;
}
async function baseAncienne(n) {
  const b = (await instantanesBaseAncienne())[n]; assert.ok(b, `instantané n=${n}`);
  assert.equal(b.repondues.length, n);
  return { w: monde(b.n, await magasinDepuis(b.tables)), cle: b.cle, repondues: structuredClone(b.repondues) };
}
const resumeStrategies = (vecu) => moyensParStrategie(vecu, BESOIN_RELATION).strategies.map((s) => ({ cle: cleApplication(s.application), occurrences: [...s.occurrences].sort(), support: s.occurrenceSupport, preuves: s.preuves.map((p) => p.reception) }));

test('D7. BASE ANCIENNE avec occurrences DT6 → stratégies et supports IDENTIQUES ; la vie .93 qui suit ne crée aucune nouvelle occurrence de ces applications', async () => {
  const { w, cle, repondues } = await baseAncienne(3);
  const avant = resumeStrategies(await w.vecu());
  const st = avant.find((s) => s.cle === cle); assert.deepEqual(st.occurrences, [...repondues].sort()); assert.equal(st.support, repondues[0]);
  const neuf = monde(100000, await copie(w.magasin)); assert.deepEqual(resumeStrategies(await neuf.vecu()), avant, 'lecture .93 de la base ancienne');
  const nCle = async (x) => (await rows(x, 'executionsOperations')).filter((e) => cleApplication(e) === cle).length; const n0 = await nCle(neuf);
  for (const m of ['m', 'm', 'autre', 'm']) { const s = await neuf.tour(m); for (const r of s.automatiques) assert.notEqual(cleApplication({ operation: r.operation, liaisons: r.designation.liaisons }), cle); } // MISE À JOUR DÉLIBÉRÉE v0.63.94 : chaque message apporte ses propres applications ; jamais l'application connue
  assert.equal(await nCle(neuf), n0, 'aucune nouvelle occurrence de l\'application connue');
  assert.deepEqual(resumeStrategies(await neuf.vecu()), avant);
});

test('D8. rotation .92 INCHANGÉE : mêmes règles pures (ordre des noms, successeur, collision → silence) ; episode-propre.js et besoins.js ignorent dejaExecutees', () => {
  const strat = (operation, id = operation) => ({ operation, production: `p-${id}`, application: { operation, liaisons: [{ entree: 'e', donnee: `d-${id}` }] } });
  const A = strat('parcourirStructure'); const B = strat('symbolesDeChaine');
  const r0 = rotationDActualisation([B, A], []); assert.equal(r0.ordonnable, true); assert.deepEqual(r0.ordre, ['parcourirStructure', 'symbolesDeChaine']); assert.equal(r0.actualisee.operation, 'parcourirStructure');
  assert.equal(rotationDActualisation([A, B], [{ cle: cleApplication(A.application) }]).actualisee.operation, 'symbolesDeChaine');
  assert.equal(rotationDActualisation([A, B], [{ cle: cleApplication(B.application) }]).actualisee.operation, 'parcourirStructure');
  assert.equal(rotationDActualisation([strat('elementsObservables', 1), strat('elementsObservables', 2)], []).ordonnable, false);
  for (const f of ['episode-propre.js', 'besoins.js', 'capacite.js', 'environnement-conversation.js', 'emission.js']) assert.equal(/dejaExecutees/.test(lu('app', 'langage', f)), false, f);
});

test('D9. (MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE) la MÊME donnée observée 10 fois → aucune croissance du lot ; 10 messages de même TEXTE → 10 identités : chacun n\'ajoute QUE ses propres applications (liées à SA donnée), un coût par message, jamais de réexécution', async () => {
  const { w, s0 } = await prefixeStabilise(); // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : préfixe mémoïsé, copie profonde
  const avant = await compte(w); // stabilisation (voir D2)
  for (let i = 0; i < 10; i += 1) { const s = await w.reobserver(s0); assert.deepEqual(s.automatiques, []); assert.ok(s.dejaExecutees.length > 0); }
  const apres = await compte(w);
  assert.equal(apres.obs, avant.obs + 10);
  for (const k of ['ex', 'em', 'd', 'vc', 'att', 'ctx']) assert.equal(apres[k], avant[k], k);
  const ids = new Set(); const cles = await clesExecutees(w);
  for (let i = 0; i < 5; i += 1) {
    await w.tick(); const s = await w.tour('bonjour Max'); ids.add(s.observation.idMessage);
    assert.equal((await coutsDe(w, s.observation.id)).length, 1);
    for (const r of s.automatiques) { const k = cleApplication({ operation: r.operation, liaisons: r.designation.liaisons }); assert.equal(cles.has(k), false, 'jamais une réexécution'); cles.add(k); }
    for (const a of s.relatives) assert.equal(a.liaisons[0].donnee, s.observation.idMessage);
  }
  assert.equal(ids.size, 5, 'cinq identités distinctes pour un même texte');
});

test('D10. avec ticks et réponses → les occasions et les initiatives .92 continuent', async () => {
  const w = monde(); const s1 = await w.tour('bonjour Pixel'); const A = s1.emises[0];
  await w.tick(); await w.tour('merci', A.idEmission); await w.tour('x'); await w.tour('y');
  const statuts = []; for (let i = 0; i < 4; i += 1) statuts.push((await w.tick()).episode.statut);
  assert.ok(statuts.includes('engagement'), statuts.join(','));
  const E = (await rows(w, 'emissions')).filter((e) => e.idExecution === A.idExecution).at(-1);
  await w.tour('réponse', E.id);
  const t = await w.tick(); assert.equal(t.episode.statut, 'engagement'); assert.ok(t.episode.emission);
});

test('D11. REDÉMARRAGE : une application connue reste connue (magasin neuf, mêmes lignes) — aucun relancement (MISE À JOUR DÉLIBÉRÉE v0.63.94 : même donnée observée de nouveau)', async () => {
  const w = monde(); await sature(w); const s0 = await w.tour('bonjour Max'); await w.tick(); await w.reobserver(s0); await w.tick(); // stabilisation (voir D2)
  const s = await w.reobserver(s0);
  const neuf = monde(100000, await copie(w.magasin)); const s2 = await neuf.reobserver(s0);
  assert.deepEqual(s2.automatiques, []); assert.deepEqual(s2.dejaExecutees.map((d) => cleApplication(d)), s.dejaExecutees.map((d) => cleApplication(d)));
  assert.equal((await coutsDe(neuf, s2.observation.id)).length, 0);
});

test('D12. ANCIENS ÉPISODES lisibles : un engagement vécu sur base ancienne se relit à l\'identique après la vie .93 et après redémarrage', async () => {
  const { w } = await baseAncienne(2);
  const t = await w.tick(); assert.equal(t.episode.statut, 'engagement'); const O = t.episode.observation;
  const resume = (r) => ({ resultat: r.resultat, candidats: r.candidats.map((c) => [cleApplication(c.application), c.production]), D: r.engagements.map((d) => d.id), cout: r.cout && r.cout.id, emission: r.emission && r.emission.id });
  const avant = resume(await relireEpisode(w.magasin, O)); assert.equal(avant.resultat, 'engagement');
  for (const m of ['a', 'a', 'b']) await w.tour(m); await w.ticks(2);
  assert.deepEqual(resume(await relireEpisode(w.magasin, O)), avant);
  assert.deepEqual(resume(await relireEpisode(await copie(w.magasin), O)), avant);
});

test('OBSERVER ≠ AGIR (MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE, formulation validée : observer un message ne coûte rien EN SOI ; si l\'observation permet une application NOUVELLE déterminée, Naissance agit et le tour coûte B1 ; sinon, aucun coût). Porte fermée : N messages → N observations, 0 acte, 0 coût ; même donnée observée de nouveau, porte ouverte : 0 acte, 0 coût ; message nouveau, porte ouverte : acte, 1 coût ; puis les ticks modifient encore les besoins, ouvrent une occasion et produisent une initiative .92', async () => {
  const w = monde(); const s1 = await w.tour('bonjour Pixel'); const A = s1.emises[0];
  await w.tick(); await w.tour('merci', A.idEmission); await w.tour('x');
  for (const k of [1, 2, 3]) if ((await lireCapacite(w.magasin)).valeur > 0) await tourActif(w.magasin, { idObservation: `fixture-cout-${k}`, horodatage: new Date().toISOString() }); // fixture : c = 0
  assert.equal((await lireCapacite(w.magasin)).valeur, 0);
  const N = 5; let avant = await compte(w); const rAvant = (await lireRelation(w.magasin)).valeur;
  for (let i = 0; i < N; i += 1) { const s = await w.tour('bonjour Max'); assert.equal(s.capacite.porte, true); assert.deepEqual(s.automatiques, []); assert.equal(s.capacite.variation, null); }
  let apres = await compte(w);
  assert.equal(apres.obs, avant.obs + N, 'N observations'); assert.equal(apres.ex, avant.ex, '0 acte'); assert.equal(apres.em, avant.em); assert.equal(apres.vc, avant.vc, '0 coût');
  assert.equal((await lireCapacite(w.magasin)).valeur, 0, 'c inchangé'); assert.equal((await lireRelation(w.magasin)).valeur, rAvant, 'r inchangé par les messages');
  // le temps propre remonte c ; une initiative peut reprendre cette capacité (même capacité B1 : aucune priorité) — on remonte jusqu'à c > 0
  const ticks = []; for (let i = 0; i < 8 && (await lireCapacite(w.magasin)).valeur === 0; i += 1) ticks.push(await w.tick());
  assert.ok(ticks.some((t) => t.episode.statut === 'engagement'), 'les initiatives .92 continuent');
  const c0 = (await lireCapacite(w.magasin)).valeur; assert.ok(c0 > 0);
  const sNouveau = await w.tour('il fait beau'); assert.ok(sNouveau.automatiques.length > 0, 'message nouveau, porte ouverte : acte'); assert.equal((await coutsDe(w, sNouveau.observation.id)).length, 1, 'un seul coût');
  await w.tick(); await w.reobserver(sNouveau); await w.tick(); // stabilisation (voir D2)
  avant = await compte(w);
  const deja = await w.reobserver(sNouveau); assert.equal(deja.capacite.porte, false);
  assert.deepEqual(deja.automatiques, []); assert.equal(deja.capacite.variation, null, 'même donnée de nouveau : 0 acte, 0 coût');
  apres = await compte(w); assert.equal(apres.ex, avant.ex); assert.equal(apres.vc, avant.vc);
  // AGIR par le temps propre reste possible : le tick modifie r, ouvre une occasion, et l'initiative .92 a lieu (si une capacité est disponible)
  const t = await w.tick();
  assert.ok(t.relation.apres >= t.relation.avant);
  assert.ok(['engagement', 'aucune occasion', 'aucun acte - capacite insuffisante'].includes(t.episode.statut), t.episode.statut);
});

test('DIAGNOSTIC SEULEMENT : dejaExecutees (et relatives) ne sont ni mémoire, ni production, ni désignation, ni attente, ni acte, ni coût — la même donnée observée de nouveau n\'écrit que son observation ; seuls trois fichiers nomment dejaExecutees', async () => {
  const { w, s0 } = await prefixeStabilise(); // stabilisation (voir D2) // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : préfixe mémoïsé, copie profonde
  const photo = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await w.magasin.lireTout(t)).length])));
  const avant = await photo(); const s = await w.reobserver(s0); const apres = await photo();
  assert.ok(s.dejaExecutees.length > 0);
  const changees = TABLES.filter((t) => apres[t] !== avant[t]).sort();
  assert.deepEqual(changees, ['observationsPossibilites'], JSON.stringify(changees)); // MISE À JOUR DÉLIBÉRÉE v0.63.94 : la même donnée n'a pas de nouvelle valeur
  const tout = JSON.stringify(await Promise.all(TABLES.map((t) => w.magasin.lireTout(t))));
  assert.equal(tout.includes('dejaExecutees'), false, 'jamais persisté'); assert.equal(tout.includes('"relatives"'), false, 'jamais persisté');
  const nommeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /dejaExecutees/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(nommeurs, ['app/conversation/ecran.js', 'app/langage/contexte-sollicitation.js', 'app/langage/execution-mecanique.js']);
  const lot = sansCommentaires(lu('app', 'langage', 'execution-mecanique.js'));
  assert.match(lot, /import \{ cleApplication \} from '\.\/besoins\.js';/, 'clé stricte .91 (aucune seconde définition)');
  assert.equal(/function cleApplication|JSON\.stringify/.test(lot), false, 'aucune définition divergente de la clé');
  assert.equal(/enregistrer|ecrire|tourActif|emettre/.test(lot.split('const dejaExecutees')[1]), false, 'aucune écriture à partir des déjà exécutées');
});
// === FIN_TEST_DT6 ===
