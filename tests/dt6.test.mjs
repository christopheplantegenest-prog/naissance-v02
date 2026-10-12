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
  async function tick() { const t = await tickPropre(magasin); return { ...t, episode: await traiterOccasion(magasin, t.tick.id) }; }
  async function exterieur(s, application) { return executerApplicationSollicitee({ observation: s.observation, application, univers: s.univers }, { magasin, table: TABLE_OPERATIONS }); }
  return { magasin, tour, tick, exterieur, ticks: async (k) => { const o = []; for (let i = 0; i < k; i += 1) o.push(await tick()); return o; }, vecu: () => lireExecutionsVecues(magasin) };
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

test('D1. application NOUVELLE → exécutée (origine mecanique), émise, UN coût B1 (cause = observation du tour)', async () => {
  const w = monde(); const s1 = await w.tour('bonjour Pixel');
  assert.deepEqual(s1.dejaExecutees, []);
  assert.equal(s1.automatiques.length, 2); for (const r of s1.automatiques) { assert.equal(r.statut, 'executee'); assert.equal(r.designation.origine, 'mecanique'); }
  assert.deepEqual(s1.emises.map((e) => e.idExecution).sort(), s1.automatiques.map((r) => r.execution.id).sort());
  assert.equal((await coutsDe(w, s1.observation.id)).length, 1); assert.equal(s1.capacite.avant, 3); assert.equal(s1.capacite.apres, 2);
});

test('D2. la MÊME application au tour suivant → aucune exécution, aucune émission, aucun coût du lot ; elle est rendue en diagnostic « déjà exécutée »', async () => {
  const w = monde(); await sature(w); const avant = await compte(w);
  const s = await w.tour('bonjour Max');
  assert.equal(s.capacite.porte, false); assert.equal(s.capacite.avant, 1);
  assert.deepEqual(s.automatiques, []); assert.deepEqual(s.emises, []); assert.equal(s.capacite.variation, null); assert.equal(s.capacite.apres, 1);
  assert.equal(s.dejaExecutees.length, 1); assert.equal(s.dejaExecutees[0].operation, 'elementsObservables');
  assert.ok((await clesExecutees(w)).has(cleApplication(s.dejaExecutees[0])), 'clé stricte .91 d\'une exécution persistée');
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
  assert.deepEqual(t.map((s) => s.automatiques.length), [2, 4, 9]); assert.deepEqual(t.map((s) => s.dejaExecutees.length), [0, 0, 0]);
  for (const s of t) { assert.equal(s.emises.length, s.automatiques.length); assert.equal((await coutsDe(w, s.observation.id)).length, 1); }
  assert.deepEqual(t.map((s) => [s.capacite.avant, s.capacite.apres]), [[3, 2], [2, 1], [1, 0]]);
});

test('D5. connue + INDÉTERMINÉES → aucune « fausse nouvelle » : les choix à faire ne sont ni exécutés ni désignés', async () => {
  const w = monde(); await sature(w);
  const s = await w.tour('bonjour Max');
  assert.ok(s.choixAFaire.length > 0); assert.equal(s.dejaExecutees.length, 1); assert.deepEqual(s.automatiques, []);
  assert.equal((await rows(w, 'designations')).filter((d) => d.idObservation === s.observation.id).length, 0);
});

test('D6. bouton extérieur « Exécuter » (.77) sur une application CONNUE → toujours possible, hors B1 (aucun coût), aucune émission ; le lot suivant ne la relance pas', async () => {
  const w = monde(); await sature(w);
  const s = await w.tour('bonjour Max'); const connue = s.dejaExecutees[0];
  const avant = await compte(w);
  const r = await w.exterieur(s, { operation: connue.operation, liaisons: connue.liaisons });
  assert.equal(r.statut, 'executee'); assert.equal(r.designation.origine, 'exterieure');
  const apres = await compte(w); assert.equal(apres.ex, avant.ex + 1); assert.equal(apres.vc, avant.vc, 'hors B1'); assert.equal(apres.em, avant.em, 'aucune émission');
  const s2 = await w.tour('bonjour Max'); assert.deepEqual(s2.automatiques, []);
});

// Base ANCIENNE (lot .92) : n occurrences prouvées de la même application elementsObservables.
async function baseAncienne(n) {
  const w = monde(); await w.tour('bonjour Pixel', null, { ancien: true });
  let cle = null; const repondues = [];
  for (let i = 0; i < 30 && repondues.length < n; i += 1) {
    await w.ticks(2);
    const s = await w.tour(`m${i}`, null, { ancien: true }); const e = s.emises.find((x) => x.operation === 'elementsObservables'); if (!e) continue;
    const k = cleApplication((await rows(w, 'executionsOperations')).find((x) => x.id === e.idExecution));
    if (cle === null) { if (i < 2) continue; cle = k; } if (k !== cle) continue;
    await w.tick(); await w.tour(`r${i}`, e.idEmission, { ancien: true }); repondues.push(e.idExecution);
  }
  assert.equal(repondues.length, n);
  return { w, cle, repondues };
}
const resumeStrategies = (vecu) => moyensParStrategie(vecu, BESOIN_RELATION).strategies.map((s) => ({ cle: cleApplication(s.application), occurrences: [...s.occurrences].sort(), support: s.occurrenceSupport, preuves: s.preuves.map((p) => p.reception) }));

test('D7. BASE ANCIENNE avec occurrences DT6 → stratégies et supports IDENTIQUES ; la vie .93 qui suit ne crée aucune nouvelle occurrence de ces applications', async () => {
  const { w, cle, repondues } = await baseAncienne(3);
  const avant = resumeStrategies(await w.vecu());
  const st = avant.find((s) => s.cle === cle); assert.deepEqual(st.occurrences, [...repondues].sort()); assert.equal(st.support, repondues[0]);
  const neuf = monde(100000, await copie(w.magasin)); assert.deepEqual(resumeStrategies(await neuf.vecu()), avant, 'lecture .93 de la base ancienne');
  const nCle = async (x) => (await rows(x, 'executionsOperations')).filter((e) => cleApplication(e) === cle).length; const n0 = await nCle(neuf);
  for (const m of ['m', 'm', 'autre', 'm']) { const s = await neuf.tour(m); assert.equal(s.automatiques.filter((r) => r.operation === 'elementsObservables').length, 0); }
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

test('D9. 10 messages IDENTIQUES après saturation → aucune croissance du lot (exécutions, désignations, émissions, coûts, contextes, attentes)', async () => {
  const w = monde(); await sature(w); const avant = await compte(w);
  for (let i = 0; i < 10; i += 1) { const s = await w.tour('bonjour Max'); assert.deepEqual(s.automatiques, []); assert.equal(s.dejaExecutees.length, 1); }
  const apres = await compte(w);
  assert.equal(apres.obs, avant.obs + 10);
  for (const k of ['ex', 'em', 'd', 'vc', 'att', 'ctx']) assert.equal(apres[k], avant[k], k);
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

test('D11. REDÉMARRAGE : une application connue reste connue (magasin neuf, mêmes lignes) — aucun relancement', async () => {
  const w = monde(); await sature(w);
  const s = await w.tour('bonjour Max');
  const neuf = monde(100000, await copie(w.magasin)); const s2 = await neuf.tour('bonjour Max');
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

test('OBSERVER ≠ AGIR. après saturation, N messages ordinaires identiques → N observations, 0 exécution du lot, 0 émission mécanique, 0 coût B1 du lot, c inchangé ; puis les ticks modifient encore les besoins, ouvrent une occasion et produisent une initiative .92', async () => {
  const w = monde(); const s1 = await w.tour('bonjour Pixel'); const A = s1.emises[0];
  await w.tick(); await w.tour('merci', A.idEmission); await w.tour('x'); // saturation (2, 4, 9)
  const ticksAvant = []; for (let i = 0; i < 8; i += 1) ticksAvant.push(await w.tick()); // r monte jusqu'au plafond (initiatives), puis c remonte
  const E = ticksAvant.map((t) => t.episode.emission).filter(Boolean).at(-1); assert.ok(E, 'une initiative a eu lieu');
  await w.tour('oui', E.idEmission); // réponse à l'initiative : r → 0 (preuve), sans exécution du lot
  const c0 = (await lireCapacite(w.magasin)).valeur; const r0 = (await lireRelation(w.magasin)).valeur; assert.ok(c0 > 0, 'porte ouverte : le test n\'est pas trivial'); assert.equal(r0, 0);
  const avant = await compte(w); const N = 10;
  for (let i = 0; i < N; i += 1) { const s = await w.tour('bonjour Max'); assert.equal(s.capacite.porte, false); assert.deepEqual(s.automatiques, []); assert.deepEqual(s.emises, []); assert.equal(s.capacite.variation, null); }
  const apres = await compte(w);
  assert.equal(apres.obs, avant.obs + N, 'N observations supplémentaires');
  assert.equal(apres.ex, avant.ex, '0 nouvelle executionOperation'); assert.equal(apres.em, avant.em, '0 émission'); assert.equal(apres.vc, avant.vc, '0 coût B1');
  assert.equal((await lireCapacite(w.magasin)).valeur, c0, 'c inchangé'); assert.equal((await lireRelation(w.magasin)).valeur, r0);
  // AGIR reste possible par le temps propre : le tick modifie r, ouvre une occasion, et l'initiative .92 a lieu
  const t = await w.tick();
  assert.equal(t.relation.avant, 0); assert.equal(t.relation.apres, 1);
  assert.equal(t.episode.statut, 'engagement'); assert.ok(t.episode.occasion.occasion); assert.ok(t.episode.emission);
  assert.equal((await rows(w, 'emissions')).length, apres.em + 1);
});

test('DIAGNOSTIC SEULEMENT : dejaExecutees n\'est ni mémoire, ni production, ni désignation, ni attente, ni acte, ni coût — un tour « déjà exécutée » n\'écrit que son observation et son message ; seuls trois fichiers le nomment', async () => {
  const w = monde(); await sature(w);
  const photo = async () => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await w.magasin.lireTout(t)).length])));
  const avant = await photo(); const s = await w.tour('bonjour Max'); const apres = await photo();
  assert.equal(s.dejaExecutees.length, 1);
  const changees = TABLES.filter((t) => apres[t] !== avant[t]).sort();
  assert.deepEqual(changees, ['observationsPossibilites', 'valeursDonnees'], JSON.stringify(changees));
  assert.equal(JSON.stringify(await Promise.all(TABLES.map((t) => w.magasin.lireTout(t)))).includes('dejaExecutees'), false, 'jamais persisté');
  const nommeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /dejaExecutees/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(nommeurs, ['app/conversation/ecran.js', 'app/langage/contexte-sollicitation.js', 'app/langage/execution-mecanique.js']);
  const lot = sansCommentaires(lu('app', 'langage', 'execution-mecanique.js'));
  assert.match(lot, /import \{ cleApplication \} from '\.\/besoins\.js';/, 'clé stricte .91 (aucune seconde définition)');
  assert.equal(/function cleApplication|JSON\.stringify/.test(lot), false, 'aucune définition divergente de la clé');
  assert.equal(/enregistrer|ecrire|tourActif|emettre/.test(lot.split('const dejaExecutees')[1]), false, 'aucune écriture à partir des déjà exécutées');
});
// === FIN_TEST_DT6 ===
