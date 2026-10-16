// === DEBUT_TEST_STRATEGIES_INDEPENDANTES ===
// MISE À JOUR DÉLIBÉRÉE — répartition de l'outillage de tests pour parallélisation, non cognitive (16/10/2026) : les tests F, I et S de
// tests/strategies.test.mjs (mondes PROPRES, sans le monde A partagé) sont déplacés ici À L'IDENTIQUE, pour que `node --test` (3 fichiers en parallèle)
// répartisse mieux la charge. Même harnais (copie mécanique de monde / lotAncien92 / occurrencesProuvees / copie), mêmes assertions, aucune réduction.
// v0.63.91 — STRATÉGIES = APPLICATIONS (décision ChatGPT « DÉCISION FINALE — PASSAGE AU CODE », 11/10/2026). Une production historique est une
// OCCURRENCE ; son application { operation, liaisons } est la STRATÉGIE ; une preuve B2 est une expérience d'une occurrence. evaluer compte les
// STRATÉGIES (0 → rien, 1 → engagement, 2+ → silence ; aucune rotation). L'émission d'une initiative cite l'OCCURRENCE SUPPORT (première preuve dans
// l'ordre causal de la chaîne d'état) : aucune nouvelle exécution. Tests obligatoires A…I de la décision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES } from '../app/langage/connaissances.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationAvecOrigine } from '../app/langage/execution-sollicitee.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { lireCapacite, tourActif, peutAgir } from '../app/langage/capacite.js';
import { lireRelation, consequenceReception } from '../app/langage/relation.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { BESOIN_RELATION, BESOIN_CAPACITE, lireBesoins, moyensConnus, moyensParStrategie, cleApplication } from '../app/langage/besoins.js';
import { traiterOccasion, relireEpisode, evaluer } from '../app/langage/episode-propre.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : RECONSTITUTION D'UNE BASE ANCIENNE. Depuis .93, le lot ne relance plus une application déjà exécutée : une vie
// .93 ne crée JAMAIS plusieurs occurrences d'une même application stricte par le lot. Les stratégies .91 doivent pourtant continuer à lire
// correctement les bases ANCIENNES (vécues sous .60–.92) qui en contiennent (test D7 de la décision DT6). Les tours `ancien` reproduisent donc, À
// L'IDENTIQUE et uniquement pour CONSTRUIRE CE PASSÉ, le lot v0.63.92 (copie de son corps : toutes les applications déterminées, connues ou non).
// Ce n'est pas une réémission artificielle du présent : c'est la fixture d'une histoire réelle antérieure à .93 ; tout ce qui suit est vécu en .93.
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
function monde(depart = 0, magasinInitial = null) {
  const magasin = magasinInitial ?? magasinMemoireVive(); let n = depart; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null, { ancien = false } = {}) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin); const porte = !peutAgir(avant);
      const lot = porte ? { applications: [], choixAFaire: [], resultats: [] } : await (ancien ? lotAncien92 : executerApplicationsDeterminees)({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      if (lot.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage });
      return { ...lot, emises, echecEmission: echec };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation; let reception = null;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); reception = d.reception; await consequenceReception(magasin, d.reception); }
    const episodes = []; for (const ev of [s.observation.id, reception ? reception.id : null].filter(Boolean)) episodes.push(await traiterOccasion(magasin, ev));
    return { ...s, reception, episodes };
  }
  async function tick() { const t = await tickPropre(magasin); return { ...t, episode: await traiterOccasion(magasin, t.tick.id) }; }
  return { magasin, tour, tick, ticks: async (k) => { const o = []; for (let i = 0; i < k; i += 1) o.push(await tick()); return o; }, vecu: () => lireExecutionsVecues(magasin) };
}
const rows = (w, t) => w.magasin.lireTout(t);
const relation = async (m) => (await lireBesoins(m)).find((b) => b.besoin === 'relation');
async function cleDe(w, idExecution) { return cleApplication((await rows(w, 'executionsOperations')).find((x) => x.id === idExecution)); }
async function ticks(w, k) { for (let i = 0; i < k; i += 1) await w.tick(); }
// n occurrences PROUVÉES d'une même application elementsObservables (le lot .92 la réexécutait à chaque message : DT6 — BASE ANCIENNE, voir
// lotAncien92) ; on ne répond qu'aux émissions de cette application exacte (clé), à r > 0. Rend la clé et les productions répondues dans l'ordre.
async function occurrencesProuvees(w, n, cle = null) {
  const repondues = [];
  for (let i = 0; i < 40 && repondues.length < n; i += 1) {
    await ticks(w, 2);
    const s = await w.tour(`m${i}`, null, { ancien: true }); // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : tour de la base ANCIENNE (lot .92)
    const e = s.emises.find((x) => x.operation === 'elementsObservables');
    if (!e) continue;
    const k = await cleDe(w, e.idExecution);
    if (cle === null) { if (i < 2) continue; cle = k; }
    if (k !== cle) continue;
    await w.tick();
    const r = await w.tour(`r${i}`, e.idEmission, { ancien: true }); // MISE À JOUR DÉLIBÉRÉE v0.63.94 : la base ANCIENNE est vécue entièrement sous le lot .92 (réponses comprises)
    assert.ok(r.reception, 'réception déclarée');
    repondues.push(e.idExecution);
  }
  assert.equal(repondues.length, n, `${n} occurrences prouvées construites`);
  return { cle, repondues };
}
const copie = async (m) => { const n = magasinMemoireVive(); await n.remplacerTout(Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await m.lireTout(t)])))); return n; };
const resumeRelecture = (r) => ({ resultat: r.resultat, candidats: r.candidats.map((c) => [cleApplication(c.application), c.production, c.occurrences]), D: r.engagements.map((d) => d.id), cout: r.cout && r.cout.id, emission: r.emission && r.emission.id });

test('F. ancien épisode .88 à production exacte → toujours « engagement », même quand d\'autres occurrences de la même application apparaissent ensuite', async () => {
  const w = monde(); const s0 = await w.tour('bonjour Pixel'); const par = s0.emises.find((e) => e.operation === 'parcourirStructure');
  await w.tick(); await w.tour('merci', par.idEmission);
  const t = await w.tick(); assert.equal(t.episode.statut, 'engagement'); const O = t.episode.observation;
  assert.equal(t.episode.engagement.liaisons[0].donnee, par.idExecution, 'D porte la production exacte (format .88)');
  const avant = resumeRelecture(await relireEpisode(w.magasin, O)); assert.equal(avant.resultat, 'engagement');
  await occurrencesProuvees(w, 2);
  assert.deepEqual(resumeRelecture(await relireEpisode(w.magasin, O)), avant);
  assert.deepEqual(resumeRelecture(await relireEpisode(await copie(w.magasin), O)), avant);
});

test('I. comportements .88 inchangés : 0 candidat → silence ; besoin non motivé (réception) → aucune occasion ; saturation → aucune occasion ; moyensConnus inchangé', async () => {
  const w = monde(); await w.tour('bonjour Pixel');
  const t0 = await w.tick(); assert.equal(t0.episode.statut, 'aucun acte - 0 candidat'); assert.equal((await rows(w, 'emissions')).filter((e) => e.idObservation === t0.episode.observation.id).length, 0);
  const { repondues } = await occurrencesProuvees(w, 1);
  const vecu = await lireExecutionsVecues(w.magasin);
  assert.deepEqual((await relation(w.magasin)).moyens, moyensConnus(vecu, BESOIN_RELATION).moyens, 'les moyens (productions) restent exactement ceux de moyensConnus');
  assert.deepEqual(moyensParStrategie(vecu, BESOIN_CAPACITE).strategies, [], 'B1 : aucune stratégie (satisfactions sans production)');
  // la réponse a ramené r à 0 : pas d'occasion (satisfaction)
  const recs = await rows(w, 'receptions'); const r = await traiterOccasion(w.magasin, recs.at(-1).id); assert.equal(r.statut, 'aucune occasion');
  // saturation : r 3 → 3, aucune occasion, aucune émission nouvelle
  await ticks(w, 3); const n0 = (await rows(w, 'emissions')).length; const tSat = await w.tick(); assert.equal(tSat.episode.statut, 'aucune occasion'); assert.equal((await rows(w, 'emissions')).length, n0);
  assert.ok(repondues.length === 1);
});

test('S. statique : la stratégie est l\'application stricte (cleApplication), sans id ni hash ; evaluer compte les stratégies ; (v0.63.92 : rotation entre stratégies présente) ; lot .60 : chaque application NOUVELLE exécutée une fois (MISE À JOUR DÉLIBÉRÉE v0.63.93 : DT6 corrigé, les applications déjà exécutées ne sont plus relancées)', () => {
  const b = sansCommentaires(lu('app', 'langage', 'besoins.js')); const e = sansCommentaires(lu('app', 'langage', 'episode-propre.js'));
  assert.match(b, /export function cleApplication\(execution\)/); assert.match(b, /\[l\.entree, 'collective', l\.donnees\]/); assert.match(b, /\[l\.entree, 'ordinaire', l\.donnee\]/);
  assert.match(e, /for \(const s of b\.strategies\)/); assert.match(e, /export function rotationDActualisation\(/, 'MISE À JOUR DÉLIBÉRÉE v0.63.92 : la rotation d\'actualisation entre stratégies existe désormais (tests/rotation.test.mjs)');
  assert.equal(/executionsOperations|enregistrerExecutionOperation|executerApplication/.test(e), false, 'l\'épisode propre ne crée aucune exécution');
  const lot = lu('app', 'langage', 'execution-mecanique.js'); assert.match(lot, /exécutées UNE FOIS CHACUNE/);
  assert.equal(cleApplication({ operation: 'op', liaisons: [{ entree: 'e', donnees: ['a', 'b'] }] }) === cleApplication({ operation: 'op', liaisons: [{ entree: 'e', donnees: ['b', 'a'] }] }), false, 'suite EXACTE (ordre persisté)');
  assert.equal(cleApplication({ operation: 'op', liaisons: [{ entree: 'e', donnee: 'a' }] }) === cleApplication({ operation: 'op', liaisons: [{ entree: 'e', donnees: ['a'] }] }), false, 'ordinaire ≠ collective');
});
// === FIN_TEST_STRATEGIES_INDEPENDANTES ===
