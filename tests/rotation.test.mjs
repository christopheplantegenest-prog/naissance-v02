// === DEBUT_TEST_ROTATION ===
// v0.63.92 — ROTATION D'ACTUALISATION ENTRE STRATÉGIES (décision ChatGPT « DÉCISION APRÈS MINI-CONCEPTION ROTATION », 12/10/2026). 2+ stratégies
// autorisées aux noms d'opération TOUS distincts → actualisation du successeur (ordre des noms) du dernier engagement de la chaîne c appartenant à L ;
// sinon la première ; noms en collision → silence pour toute l'occasion. Ni préférence, ni score, ni hasard. Tests obligatoires R0…R18.
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
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { lireCapacite, tourActif, peutAgir } from '../app/langage/capacite.js';
import { lireRelation, consequenceReception } from '../app/langage/relation.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { BESOIN_RELATION, BESOIN_CAPACITE, lireBesoins, moyensConnus, moyensParStrategie, cleApplication } from '../app/langage/besoins.js';
import { traiterOccasion, relireEpisode, evaluer, rotationDActualisation, engagementsParChaine } from '../app/langage/episode-propre.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

function monde(depart = 0, magasinInitial = null) {
  const magasin = magasinInitial ?? magasinMemoireVive(); let n = depart; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin); const porte = !peutAgir(avant);
      const lot = porte ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
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

import { DESCRIPTIONS_SOI } from '../app/langage/projection-soi.js';
import { DESCRIPTION_SOURCE_SOI } from '../app/langage/source-soi.js';
const rows = (w, t) => w.magasin.lireTout(t);
const copie = async (m) => { const n = magasinMemoireVive(); await n.remplacerTout(Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await m.lireTout(t)])))); return n; };
const strat = (operation, id = operation) => ({ operation, production: `p-${id}`, application: { operation, liaisons: [{ entree: 'e', donnee: `d-${id}` }] } });
const eng = (c) => ({ cle: cleApplication(c.application) });
const nomDe = (r) => (r.actualisee ? r.actualisee.operation : null);

// ------------------------------------------------------------------------------------------------ règle pure
test('R2. 2 stratégies, opérations distinctes, aucun P → la première par nom ; R3. P = A → B ; R4. P = B → A', () => {
  const A = strat('parcourirStructure'); const B = strat('symbolesDeChaine');
  const r2 = rotationDActualisation([B, A], []); assert.equal(r2.ordonnable, true); assert.deepEqual(r2.ordre, ['parcourirStructure', 'symbolesDeChaine']); assert.equal(nomDe(r2), 'parcourirStructure'); assert.equal(r2.precedent, null);
  assert.equal(nomDe(rotationDActualisation([A, B], [eng(A)])), 'symbolesDeChaine');
  assert.equal(nomDe(rotationDActualisation([A, B], [eng(B)])), 'parcourirStructure');
  assert.equal(nomDe(rotationDActualisation([A, B], [eng(B), eng(A)])), 'symbolesDeChaine', 'le DERNIER engagement de la chaîne compte');
});
test('R5/R6. 3 stratégies → rotation circulaire (A → B → C → A) ; R7. apparition → insertion selon le nom ; R8. disparition de P → dernier engagement encore membre de L', () => {
  const A = strat('a-op'); const B = strat('b-op'); const C = strat('c-op');
  assert.equal(nomDe(rotationDActualisation([C, A, B], [eng(A)])), 'b-op'); assert.equal(nomDe(rotationDActualisation([C, A, B], [eng(B)])), 'c-op'); assert.equal(nomDe(rotationDActualisation([C, A, B], [eng(C)])), 'a-op');
  // {A, C} puis apparition de B : successeur de P = A dans le NOUVEL ordre → B
  assert.equal(nomDe(rotationDActualisation([A, C], [eng(A)])), 'c-op'); assert.equal(nomDe(rotationDActualisation([A, C, B], [eng(A)])), 'b-op');
  // {A, B, C} → {A, C} : P = B a disparu → on remonte au dernier engagement encore membre (A) → C ; aucun membre engagé → L[0]
  assert.equal(nomDe(rotationDActualisation([A, C], [eng(A), eng(B)])), 'c-op'); assert.equal(nomDe(rotationDActualisation([A, C], [eng(B)])), 'a-op');
});
test('R11. 2 stratégies de MÊME opération → silence ; R12. 3 stratégies dont 2 partagent une opération → silence TOTAL (aucun retrait partiel)', () => {
  const E1 = strat('elementsObservables', 'x'); const E2 = strat('elementsObservables', 'y'); const P = strat('parcourirStructure');
  const r11 = rotationDActualisation([E1, E2], []); assert.equal(r11.ordonnable, false); assert.equal(r11.actualisee, null);
  const r12 = rotationDActualisation([E1, P, E2], [eng(P)]); assert.equal(r12.ordonnable, false); assert.equal(r12.actualisee, null);
});
test('R13. la rotation porte sur les STRATÉGIES, jamais sur les occurrences : un engagement via une autre occurrence de la même application compte comme cette stratégie', () => {
  const A = strat('parcourirStructure'); const B = strat('symbolesDeChaine');
  const autreOccurrenceDeA = { cle: cleApplication({ operation: A.operation, liaisons: A.application.liaisons }) };
  assert.equal(nomDe(rotationDActualisation([A, B], [autreOccurrenceDeA])), 'symbolesDeChaine');
});
test('R18. aucune horloge, aucun hasard, aucun hash, aucune fréquence : engagementsParChaine suit la chaîne c (idEtatAvant), indépendamment de l\'ordre des lignes et des horodatages', () => {
  const ex = [{ id: 'x1', operation: 'op1', liaisons: [{ entree: 'e', donnee: 'd1' }] }, { id: 'x2', operation: 'op2', liaisons: [{ entree: 'e', donnee: 'd2' }] }];
  const des = [{ id: 'D1', origine: 'propre', liaisons: [{ entree: 'emis', donnee: 'x1' }] }, { id: 'D2', origine: 'propre', liaisons: [{ entree: 'emis', donnee: 'x2' }] }, { id: 'Dm', origine: 'mecanique', liaisons: [{ entree: 'x', donnee: 'x1' }] }];
  const v = [{ id: 'v1', idEtatAvant: 'capacite-initiale-0', valeur: 2, idDesignation: 'D2', horodatage: '2030-01-01T00:00:00Z', cause: { id: 'o1' } }, { id: 'v2', idEtatAvant: 'etat-propre-v1', valeur: 3, horodatage: '2001-01-01T00:00:00Z', cause: { id: 't' } }, { id: 'v3', idEtatAvant: 'etat-propre-v2', valeur: 2, idDesignation: 'D1', horodatage: '1990-01-01T00:00:00Z', cause: { id: 'o2' } }];
  const ordre = (l) => engagementsParChaine({ variationsCapacite: l, designations: des, executions: ex }).map((e) => e.designation);
  assert.deepEqual(ordre(v), ['D2', 'D1']); assert.deepEqual(ordre([...v].reverse()), ['D2', 'D1']);
  assert.deepEqual(engagementsParChaine({ variationsCapacite: v, designations: des, executions: ex, jusquA: 'etat-propre-v2' }).map((e) => e.designation), ['D2'], 'fermeture à un état : la chaîne s\'arrête avant');
  const code = sansCommentaires(lu('app', 'langage', 'episode-propre.js')); const corps = code.slice(code.indexOf('const comparerCodes'), code.indexOf('function candidatsMotives('));
  assert.ok(corps.length > 200);
  assert.equal(/Date\b|horodatage|Math\.random|sha256|preuves\.length|occurrences\.length|localeCompare/.test(corps), false);
  assert.equal(/meilleur|préfér|prefer|score|récompens/i.test(code), false);
});

// ------------------------------------------------------------------------------------------------ chaîne réelle
// Monde : « bonjour Pixel » → A = symbolesDeChaine, B = parcourirStructure (stratégies d'opérations distinctes, comme la base de Christophe à deux noms).
async function mondeAB() {
  const w = monde(); const s0 = await w.tour('bonjour Pixel');
  const A = s0.emises.find((e) => e.operation === 'symbolesDeChaine'); const B = s0.emises.find((e) => e.operation === 'parcourirStructure');
  await w.tick(); await w.tour('a', A.idEmission);           // A connue (r → 0)
  const t1 = await w.tick(); assert.equal(t1.episode.statut, 'engagement', '1 stratégie : .91 inchangé (R1)'); assert.equal(t1.episode.engagement.liaisons[0].donnee, A.idExecution);
  await w.tour('b', B.idEmission);                           // B connue (r → 0) ; dernier engagement = A
  return { w, A, B };
}
const faitsDe = async (w, O) => ({ D: (await rows(w, 'designations')).filter((d) => d.idObservation === O.id && d.origine === 'propre'), couts: (await rows(w, 'variationsCapacite')).filter((v) => v.cause.id === O.id), ems: (await rows(w, 'emissions')).filter((e) => e.idObservation === O.id) });

test('R0. 0 stratégie → silence ; R1. 1 stratégie → .91 inchangé ; R3 réel : {A, B}, P = A (symbolesDeChaine) → parcourirStructure, puis alternance ; R15 aucune exécution ; R16 1 D, 1 coût, 1 émission par occasion', async () => {
  const w0 = monde(); await w0.tour('bonjour Pixel'); assert.equal((await w0.tick()).episode.statut, 'aucun acte - 0 candidat');
  const { w, A, B } = await mondeAB();
  const suite = [];
  for (let k = 0; k < 4; k += 1) {
    const nExec = (await rows(w, 'executionsOperations')).length;
    const t = await w.tick(); assert.equal(t.episode.statut, 'engagement', `occasion ${k + 1}`);
    assert.equal(t.episode.evaluation.rotation.ordonnable, true);
    const f = await faitsDe(w, t.episode.observation); assert.equal(f.D.length, 1); assert.equal(f.couts.length, 1); assert.equal(f.ems.length, 1); assert.equal(f.couts[0].idDesignation, f.D[0].id);
    assert.equal((await rows(w, 'executionsOperations')).length, nExec, 'aucune nouvelle exécution');
    suite.push(f.ems[0].idExecution === A.idExecution ? 'A' : f.ems[0].idExecution === B.idExecution ? 'B' : '?');
    if (k === 1) await w.tour('reponse', f.ems[0].id); // réponse à l'émission motivée : r → 0 (permet une 4e occasion)
  }
  assert.deepEqual(suite, ['B', 'A', 'B', 'A'], 'après P = A : parcourirStructure, symbolesDeChaine, …');
});
test('R14. réponse à l\'émission motivée → nouvelle preuve de la MÊME stratégie (pas de nouvelle stratégie) ; R9. redémarrage → même décision ; R10. enrichissement après O → relecture inchangée', async () => {
  const { w, A, B } = await mondeAB();
  const jumeau = monde(500000, await copie(w.magasin)); // R9 : même vécu dans un magasin neuf (redémarrage)
  const t = await w.tick(); const E = t.episode.emission; const O = t.episode.observation; assert.equal(E.idExecution, B.idExecution);
  const tj = await jumeau.tick(); assert.equal(tj.episode.statut, 'engagement'); assert.equal(tj.episode.emission.idExecution, E.idExecution); assert.deepEqual(tj.episode.evaluation.rotation.ordre, t.episode.evaluation.rotation.ordre); assert.equal(tj.episode.evaluation.rotation.precedent, t.episode.evaluation.rotation.precedent);
  const avant = (await lireBesoins(w.magasin)).find((b) => b.besoin === 'relation').strategies; assert.equal(avant.length, 2);
  await w.tour('merci', E.idEmission);
  const apres = (await lireBesoins(w.magasin)).find((b) => b.besoin === 'relation').strategies; assert.equal(apres.length, 2);
  const sB = apres.find((s) => s.operation === 'parcourirStructure'); assert.ok(sB.preuves.some((p) => p.emission === E.idEmission)); assert.equal(sB.occurrenceSupport, B.idExecution);
  // R10 : relecture de O inchangée après enrichissement et redémarrage
  const relu = await relireEpisode(w.magasin, O); assert.equal(relu.resultat, 'engagement'); assert.equal(relu.rotation.actualisee.production, B.idExecution); assert.equal(relu.rotation.precedent, 'symbolesDeChaine');
  const resume = (r) => [r.resultat, r.rotation.precedent, r.rotation.actualisee.production, r.engagements.map((d) => d.id)];
  await w.ticks(2); await w.tour('encore');
  assert.deepEqual(resume(await relireEpisode(w.magasin, O)), resume(relu)); assert.deepEqual(resume(await relireEpisode(await copie(w.magasin), O)), resume(relu));
  assert.ok(A);
});
test('R17. ancien O (vécu sous la règle .89–.91) à plusieurs stratégies SANS D → « plusieurs candidats sans engagement », jamais une incohérence', async () => {
  const { w } = await mondeAB();
  const t = await tickPropre(w.magasin);
  const vecu = await lireExecutionsVecues(w.magasin); const presents = new Set(vecu.descriptions.map((d) => d.nom)); const descriptions = [...vecu.descriptions, ...DESCRIPTIONS_SOI.filter((d) => !presents.has(d.nom))];
  const c = await lireCapacite(w.magasin), r = await lireRelation(w.magasin);
  const o = await observerPossibilites({ id: c.idEtat, valeur: c.valeur, source: DESCRIPTION_SOURCE_SOI }, { enregistrer: (d) => enregistrerObservationPossibilites(w.magasin, { ...d, occasion: t.tick.id }), lireExecutions: async () => vecu.executions, descriptions, descriptionSource: DESCRIPTION_SOURCE_SOI, source: 'soi', complements: [{ id: r.idEtat, valeur: r.valeur, source: DESCRIPTION_SOURCE_SOI }] });
  const relu = await relireEpisode(w.magasin, o.observation);
  assert.equal(relu.autorises.length, 2); assert.equal(relu.rotation.ordonnable, true); assert.equal(relu.engagements.length, 0);
  assert.equal(relu.resultat, 'plusieurs candidats sans engagement');
  assert.equal((await traiterOccasion(w.magasin, t.tick.id)).statut, 'occasion deja consommee', 'l\'ancien O reste consommé : aucune initiative rétroactive');
});
test('R11 réel. deux stratégies elementsObservables d\'entrées différentes (+ A, B non motivés) → non ordonnable → SILENCE : aucune D, aucun coût, aucune émission', async () => {
  const w = monde(); await w.tour('bonjour Pixel');
  const cles = new Map();
  for (let i = 0; i < 8 && cles.size < 2; i += 1) {
    for (let k = 0; k < 3; k += 1) await w.tick();
    // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : l'ancienne fixture prenait l'émission elementsObservables du tour `m${i}` ; à partir du 3e tour, c'était une
    // RÉÉMISSION DT6. La fixture cherche désormais, parmi TOUTES les émissions réelles du lot, une production elementsObservables d'application stricte
    // non encore prouvée : le lot exécute légitimement DEUX applications elementsObservables distinctes (2e et 3e tours, entrées différentes) ; aucune
    // réexécution n'est nécessaire.
    await w.tour(`m${i}`);
    const execs = await rows(w, 'executionsOperations');
    const trouvee = (await rows(w, 'emissions')).map((em) => [em, execs.find((y) => y.id === em.idExecution)]).find(([, x]) => x && x.operation === 'elementsObservables' && !cles.has(cleApplication(x)));
    if (!trouvee) continue;
    const [e, x] = trouvee; const k = cleApplication(x);
    await w.tick(); await w.tour(`r${i}`, e.id); cles.set(k, x.id);
  }
  assert.equal(cles.size, 2, 'deux applications elementsObservables distinctes, prouvées');
  for (let k = 0; k < 3; k += 1) await w.tick();
  await w.tour('reset', (await rows(w, 'emissions')).find((e) => e.idExecution === [...cles.values()][0]).id);
  const t = await w.tick(); const ev = t.episode.evaluation;
  assert.equal(ev.autorises.length, 2); assert.equal(ev.rotation.ordonnable, false); assert.equal(t.episode.statut, 'aucun acte - 2 candidats');
  const f = await faitsDe(w, t.episode.observation); assert.equal(f.D.length, 0); assert.equal(f.couts.length, 0); assert.equal(f.ems.length, 0);
  assert.equal((await relireEpisode(w.magasin, t.episode.observation)).resultat, 'plusieurs candidats sans engagement');
});
// === FIN_TEST_ROTATION ===
