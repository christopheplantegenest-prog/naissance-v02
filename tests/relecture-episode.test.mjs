// === DEBUT_TEST_RELECTURE_EPISODE ===
// v0.63.89 — RELECTURE HISTORIQUE D'UN ÉPISODE PROPRE (décision ChatGPT « ACCORD — SONDE « INDÉTERMINATION VÉCUE » », 11/10/2026). Vue PURE :
// l'univers de O est fermé par les IDENTITÉS de donneesExaminees ; aucune donnée nouvelle, aucune notion persistée d'indétermination ; le
// comportement de .88 (0 → rien, 1 autorisé → engagement, 2+ → rien) est inchangé. Tests de NON-RÉÉCRITURE DU PASSÉ.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
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
import { DESCRIPTIONS_SOI } from '../app/langage/projection-soi.js';
import { DESCRIPTION_SOURCE_SOI } from '../app/langage/source-soi.js';
import { BESOINS, lireBesoins } from '../app/langage/besoins.js';
import { traiterOccasion, relireEpisode, relectureEpisode, lireDernierEpisode, lireDernierEvenement, etatsParDimension, lireConsequences, coutsDActivite, RESULTATS_RELECTURE } from '../app/langage/episode-propre.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

function monde(depart = 0) {
  const magasin = magasinMemoireVive(); let n = depart; const nouvelId = (p) => `${p}-${++n}`;
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
const rows = (w, t) => w.magasin.lireTout(t);
const instantane = async (m) => JSON.stringify(Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await m.lireTout(t)]))));
const resume = (r) => ({ resultat: r.resultat, etats: Object.fromEntries(Object.entries(r.etats).map(([k, v]) => [k, v ? v.valeur : null])), motifs: r.besoins.map((b) => [b.besoin, b.motif]), moyens: r.besoins.map((b) => [b.besoin, b.moyens.map((m) => [m.production, m.preuves.length])]), candidats: r.candidats.map((c) => c.production), porte: r.porte, autorises: r.autorises.length, D: r.engagements.length, cout: r.cout ? r.cout.valeur : null, emission: r.emission ? r.emission.id : null });
// Monde de la sonde : I0 (0 candidat), I2 (engagement), I3 (2 candidats), puis évolutions.
async function mondeI() {
  const w = monde(); const s = await w.tour('bonjour Pixel'); const [A, B] = s.emises;
  const I0 = (await w.tick()).episode; assert.equal(I0.statut, 'aucun acte - 0 candidat');
  await w.tour('merci', A.idEmission); await w.tour('x'); await w.tour('y'); while ((await lireCapacite(w.magasin)).valeur > 0) await w.tour('z');
  const I2 = (await w.tick()).episode; assert.equal(I2.statut, 'engagement');
  await w.tick(); await w.tour('merci bis', B.idEmission);
  const I3 = (await w.tick()).episode; assert.equal(I3.statut, 'aucun acte - 2 candidats');
  return { w, A, B, I0, I2, I3 };
}
async function evoluer(w, A) {
  const s2 = await w.tour('bonjour Luna'); const C = s2.emises[0];
  await w.tick(); await w.tour('re', (await rows(w, 'emissions')).filter((e) => e.idExecution === A.idExecution)[0].id); // nouvelle preuve pour A
  await w.tick(); await w.tour('troisième', C.idEmission); // troisième moyen C
  await w.ticks(3); // satisfaction puis nouveau cycle : r 3
  return C;
}

test('R1. RELECTURE FIDÈLE juste après : I0 → « aucun candidat » ; I2 → « engagement » (D, coût, E) ; I3 → « plusieurs candidats sans engagement » ; états, motifs, porte et moyens tels qu\'à O', async () => {
  const { w, A, B, I0, I2, I3 } = await mondeI();
  const r0 = resume(await relireEpisode(w.magasin, I0.observation)); assert.equal(r0.resultat, 'aucun candidat'); assert.deepEqual(r0.etats, { capacite: 3, relation: 1 }); assert.deepEqual(r0.candidats, []); assert.equal(r0.porte, true);
  const r2 = resume(await relireEpisode(w.magasin, I2.observation)); assert.equal(r2.resultat, 'engagement'); assert.deepEqual(r2.etats, { capacite: 1, relation: 1 }); assert.deepEqual(r2.candidats, [A.idExecution]); assert.equal(r2.D, 1); assert.equal(r2.cout, 0); assert.equal(r2.emission, I2.emission.idEmission);
  const r3 = resume(await relireEpisode(w.magasin, I3.observation)); assert.equal(r3.resultat, 'plusieurs candidats sans engagement'); assert.deepEqual(r3.candidats.sort(), [A.idExecution, B.idExecution].sort()); assert.equal(r3.autorises, 2); assert.equal(r3.D, 0); assert.equal(r3.cout, null); assert.equal(r3.emission, null);
  assert.deepEqual(r3.motifs, [['capacite', true], ['relation', true]]);
  assert.deepEqual(Object.values(RESULTATS_RELECTURE).sort(), ['aucun candidat', 'capacite insuffisante', 'engagement', 'incoherence', 'plusieurs candidats sans engagement']);
});
test('R2. NON-RÉÉCRITURE DU PASSÉ : apprendre C après O ne change pas {A, B} à I3 ; une nouvelle preuve pour A après O ne modifie pas les preuves visibles à O ; satisfaction + nouveau cycle : rien ; I0 et I2 inchangés', async () => {
  const { w, A, B, I0, I2, I3 } = await mondeI();
  const avant = { I0: resume(await relireEpisode(w.magasin, I0.observation)), I2: resume(await relireEpisode(w.magasin, I2.observation)), I3: resume(await relireEpisode(w.magasin, I3.observation)) };
  const C = await evoluer(w, A);
  const maintenant = (await lireBesoins(w.magasin)).find((b) => b.besoin === 'relation'); assert.equal(maintenant.moyens.length, 3); assert.equal(maintenant.moyens.find((m) => m.production === A.idExecution).preuves.length, 2);
  const apres = { I0: resume(await relireEpisode(w.magasin, I0.observation)), I2: resume(await relireEpisode(w.magasin, I2.observation)), I3: resume(await relireEpisode(w.magasin, I3.observation)) };
  assert.deepEqual(apres, avant);
  assert.deepEqual(apres.I3.candidats.sort(), [A.idExecution, B.idExecution].sort()); assert.ok(!apres.I3.candidats.includes(C.idExecution));
  assert.deepEqual(apres.I3.moyens.find((m) => m[0] === 'relation')[1].find((m) => m[0] === A.idExecution)[1], 1, 'A : UNE preuve à O, même si A en a deux maintenant');
});
test('R3. REDÉMARRAGE : relecture identique dans un magasin neuf ; aucune écriture par la relecture ; lireDernierEpisode = I3 relu', async () => {
  const { w, A, I0, I2, I3 } = await mondeI(); await evoluer(w, A);
  const avant = { I0: resume(await relireEpisode(w.magasin, I0.observation)), I2: resume(await relireEpisode(w.magasin, I2.observation)), I3: resume(await relireEpisode(w.magasin, I3.observation)) };
  const neuf = magasinMemoireVive(); await neuf.remplacerTout(JSON.parse(await instantane(w.magasin))); const photo = await instantane(neuf);
  const apres = { I0: resume(await relireEpisode(neuf, I0.observation)), I2: resume(await relireEpisode(neuf, I2.observation)), I3: resume(await relireEpisode(neuf, I3.observation)) };
  assert.deepEqual(apres, avant); assert.equal(await instantane(neuf), photo);
  const dernier = await lireDernierEpisode(neuf); assert.ok(dernier.observation.occasion); assert.ok(['plusieurs candidats sans engagement', 'aucun candidat'].includes(dernier.resultat));
});
test('R4. FERMETURE PAR IDENTITÉS, pas par horodatage : les exécutions relues pour O sont exactement celles de donneesExaminees ; une exécution postérieure n\'y figure pas', async () => {
  const { w, A, I3 } = await mondeI(); const nO = I3.observation.donneesExaminees.length; await evoluer(w, A);
  const vecu = await w.vecu(); const examinees = new Set(I3.observation.donneesExaminees);
  const relu = await relireEpisode(w.magasin, I3.observation);
  const preuves = relu.besoins.find((b) => b.besoin === 'relation').moyens.flatMap((m) => m.preuves);
  for (const p of preuves) { assert.ok(examinees.has(p.production), 'production examinée par O'); assert.ok(examinees.has(p.reception), 'réception examinée par O'); assert.ok(examinees.has(p.transformation), 'transformation examinée par O'); }
  assert.ok(vecu.executions.some((e) => !examinees.has(e.id)), 'des exécutions postérieures existent'); assert.equal(I3.observation.donneesExaminees.length, nO, 'O n\'a pas changé');
  assert.match(sansCommentaires(lu('app', 'langage', 'episode-propre.js')), /examinees\.has\(e\.id\)/); assert.equal(/horodatage\s*[<>]/.test(sansCommentaires(lu('app', 'langage', 'episode-propre.js')).split('export function relectureEpisode')[1].split('export async function relireEpisode')[0]), false, 'aucune comparaison d\'horodatage dans la reconstruction');
});
test('R5. RÉSULTATS FACTUELS : « capacite insuffisante » (O à c = 0 avec un candidat motivé) ; « incoherence » (1 candidat autorisé sans D, ou D sans candidat) ; aucun vocabulaire psychologique', async () => {
  const { w, A } = await mondeI();
  // O synthétique à c = 0, r > 0 avec A connu : même construction que l'épisode (observation propre), sans acte
  await w.ticks(0); while ((await lireCapacite(w.magasin)).valeur > 0) await w.tour('z'); // c 0 ; r vaut ce qu'il vaut (≥ 1 ici)
  const vecu = await w.vecu(); const presents = new Set(vecu.descriptions.map((d) => d.nom)); const descriptions = [...vecu.descriptions, ...DESCRIPTIONS_SOI.filter((d) => !presents.has(d.nom))];
  const c = await lireCapacite(w.magasin), r = await lireRelation(w.magasin); assert.equal(c.valeur, 0); assert.ok(r.valeur > 0);
  const o = await observerPossibilites({ id: c.idEtat, valeur: c.valeur, source: DESCRIPTION_SOURCE_SOI }, { enregistrer: (d) => enregistrerObservationPossibilites(w.magasin, { ...d, occasion: 'evenement-synthetique' }), lireExecutions: async () => vecu.executions, descriptions, descriptionSource: DESCRIPTION_SOURCE_SOI, source: 'soi', complements: [{ id: r.idEtat, valeur: r.valeur, source: DESCRIPTION_SOURCE_SOI }] });
  const r5 = await relireEpisode(w.magasin, o.observation); assert.equal(r5.resultat, 'capacite insuffisante'); assert.equal(r5.porte, false); assert.ok(r5.candidats.length >= 1); assert.equal(r5.autorises.length, 0);
  // incohérence : même O, mais relue avec une capacité à O > 0 simulée (pure) : 1 candidat autorisé et aucune D
  const base = { observation: o.observation, vecu: await w.vecu(), consequences: await lireConsequences(w.magasin), couts: await coutsDActivite(w.magasin), causesPropres: [], designations: await rows(w, 'designations'), variationsCapacite: await rows(w, 'variationsCapacite'), emissions: await rows(w, 'emissions'), etatsParDimension: await etatsParDimension(w.magasin) };
  const vecuC1 = { ...base.vecu, valeurs: base.vecu.valeurs.map((v) => (v.id === c.idEtat ? { ...v, valeur: 1 } : v)) };
  const inco = relectureEpisode({ ...base, vecu: vecuC1 }); if (inco.candidats.length === 1) assert.equal(inco.resultat, 'incoherence'); else assert.equal(inco.resultat, 'plusieurs candidats sans engagement');
  const incoD = relectureEpisode({ ...base, designations: [...base.designations, { id: 'd-fictive', idObservation: o.observation.id, origine: 'propre', operation: 'environnement:conversation', liaisons: [{ entree: 'emis', donnee: 'production-fictive' }] }] }); assert.equal(incoD.resultat, 'incoherence');
  assert.equal(/hesit|hésit|choix|préfér|prefer|indetermination|indétermination|veut|désir/i.test(sansCommentaires(lu('app', 'langage', 'episode-propre.js'))), false, 'aucun vocabulaire psychologique dans le module');
});
test('R6. PURETÉ ET COMPORTEMENT .88 INCHANGÉ : relectureEpisode sur entrées gelées ; relecture sans écriture ; 0 → rien, 1 autorisé → engagement, 2+ → rien (mêmes statuts qu\'en .88) ; aucune table, aucune migration', async () => {
  const { w, A, I0, I2, I3 } = await mondeI();
  assert.equal(I0.statut, 'aucun acte - 0 candidat'); assert.equal(I2.statut, 'engagement'); assert.equal(I3.statut, 'aucun acte - 2 candidats');
  const gel = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(gel); } return o; };
  const base = gel(structuredClone({ observation: I3.observation, vecu: await w.vecu(), consequences: await lireConsequences(w.magasin), couts: await coutsDActivite(w.magasin), causesPropres: [], designations: await rows(w, 'designations'), variationsCapacite: await rows(w, 'variationsCapacite'), emissions: await rows(w, 'emissions') }));
  const etats = await etatsParDimension(w.magasin); const a = relectureEpisode({ ...base, etatsParDimension: etats }); const b = relectureEpisode({ ...base, etatsParDimension: etats }); assert.deepEqual(resume(a), resume(b));
  const avant = await instantane(w.magasin); for (let i = 0; i < 5; i += 1) { await relireEpisode(w.magasin, I3.observation); await lireDernierEpisode(w.magasin); await lireDernierEvenement(w.magasin); } assert.equal(await instantane(w.magasin), avant);
  assert.equal(TABLES.length, 30); assert.equal(VERSION_BASE, 24); assert.equal(SCHEMA_SAUVEGARDE, 14);
});
test('R7. DERNIER ÉVÉNEMENT consultable même sans épisode : après un tick saturé (aucune occasion) → { evenement = tick, occasion non, episode null } ; après un tick aggravant → episode relu', async () => {
  const { w, A } = await mondeI(); await w.ticks(3); // r 3
  const t = await w.tick(); assert.equal(t.episode.statut, 'aucune occasion');
  const ev = await lireDernierEvenement(w.magasin); assert.equal(ev.evenement, t.tick.id); assert.equal(ev.type, 'tick'); assert.equal(ev.occasion.occasion, false); assert.equal(ev.episode, null);
  await w.tour('merci', (await rows(w, 'emissions')).filter((e) => e.idExecution === A.idExecution)[0].id); const t2 = await w.tick(); assert.equal(t2.episode.occasion.occasion, true);
  const ev2 = await lireDernierEvenement(w.magasin); assert.equal(ev2.evenement, t2.tick.id, 'le coût de l\'initiative (cause O, activité propre) n\'est pas un événement : le dernier événement reste le tick'); assert.ok(ev2.episode); assert.equal(ev2.episode.observation.id, t2.episode.observation.id); assert.equal(ev2.episode.resultat, 'plusieurs candidats sans engagement', 'A et B connus : indétermination relue');
});
test('R8. AFFICHAGE : identités raccourcies à l\'affichage seulement (courtId dans ecran.js, aucune écriture) ; diagnostic replié par défaut ; dépliants de détails ; zone « dernier événement » ; aucune identité persistée modifiée', async () => {
  const ecran = lu('app', 'conversation', 'ecran.js'); const code = sansCommentaires(ecran);
  assert.match(code, /zoneDiagnostic\.open = false/); assert.match(code, /const courtId = /); assert.match(code, /className = 'evenement-zone'/); assert.match(code, /function depliant\(/);
  assert.equal(/courtId\([^)]*\)\s*[,)]?\s*\}\s*\)\s*;?\s*await\s+\w+\.(ecrire|enregistrer)/.test(code), false);
  for (const f of ['app/langage/episode-propre.js', 'app/langage/besoins.js', 'app/langage/occasion.js', 'app/langage/connaissances.js']) assert.equal(/courtId|raccourci/.test(sansCommentaires(lu(...f.split('/')))), false, `${f} ne raccourcit aucune identité`);
  const { w, I3 } = await mondeI(); const ids = JSON.stringify(await rows(w, 'observationsPossibilites')); assert.ok(ids.includes(I3.observation.id)); assert.equal(/…/.test(ids), false);
});
// === FIN_TEST_RELECTURE_EPISODE ===
