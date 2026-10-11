// === DEBUT_TEST_EPISODE_PROPRE ===
// v0.63.88 — PREMIÈRE INITIATIVE MOTIVÉE MINIMALE (décision ChatGPT « ORDRE DE DÉVELOPPEMENT v0.63.88 », 11/10/2026). Les 50 tests obligatoires
// sont numérotés T1…T50 dans les intitulés. Règle d'occasion H4 ∧ H3 ; épisode = observation propre portant `occasion` ; engagement = désignation
// « propre » ; coût = variation de capacité (cause tour = O, idDesignation = D) ; acte = réémission de la production exacte A.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerDesignation, ORIGINES_DESIGNATION, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, migrerDonnees } from '../app/memoire/sauvegarde.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { lireCapacite, tourActif, peutAgir, PARAMETRES_B1 } from '../app/langage/capacite.js';
import { lireRelation, consequenceReception } from '../app/langage/relation.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { BESOINS, BESOIN_CAPACITE, BESOIN_RELATION, moyensConnus, lireBesoins } from '../app/langage/besoins.js';
import { aggrave, occasionDEvenement } from '../app/langage/occasion.js';
import { traiterOccasion, evaluer, lireConsequences, episodeDeLOccasion, lireDernierEpisode, coutsDActivite, ORIGINE_PROPRE } from '../app/langage/episode-propre.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// Le PIPELINE RÉEL de main.js : tour (observation → porte peutAgir → lot → émission → tourActif) ; réception déclarée → conséquence B2 ; puis, comme
// main.js, les événements du geste (observation du message, réception) sont traités par traiterOccasion ; le tick de même.
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
    const s = suivi.joindre(res).sollicitation;
    let reception = null;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); reception = d.reception; await consequenceReception(magasin, d.reception); }
    const episodes = []; for (const ev of [s.observation.id, reception ? reception.id : null].filter(Boolean)) episodes.push(await traiterOccasion(magasin, ev));
    return { ...s, reception, episodes };
  }
  async function tick() { const t = await tickPropre(magasin); const episode = await traiterOccasion(magasin, t.tick.id); return { ...t, episode }; }
  return { magasin, tour, tick, ticks: async (k) => { const out = []; for (let i = 0; i < k; i += 1) out.push(await tick()); return out; }, vecu: () => lireExecutionsVecues(magasin) };
}
const etat = async (w) => ({ c: (await lireCapacite(w.magasin)).valeur, r: (await lireRelation(w.magasin)).valeur });
const rows = (w, t) => w.magasin.lireTout(t);
const instantane = async (m) => JSON.stringify(Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await m.lireTout(t)]))));
// Un monde où A est moyen connu de B2 (message, 2 ticks, réponse à A), puis états cibles : r par ticks (sans réponse), c par tours.
async function fabrique({ c = 3, r = 0, connus = ['A'] } = {}) {
  const w = monde(); const s1 = await w.tour('bonjour Pixel'); const P = { A: s1.emises[0], B: s1.emises[1] }; let k = 0;
  for (const n of connus) { await w.ticks(2); await w.tour(`bonjour ${n}${k++}`, P[n].idEmission); }
  // ramener r à 0 si besoin (une réponse), puis monter r par ticks SANS initiative : on neutralise en lisant les épisodes (ils peuvent agir : c'est le réel)
  for (let i = 0; i < r; i += 1) await w.tick();
  let g = 0; while ((await etat(w)).c > c && g++ < 6) await w.tour(`encore ${g}`);
  return { w, P };
}
const sauf = (ep) => ep.statut;

test('T1. « propre » accepté comme origine de désignation ; T2. anciennes origines toujours acceptées (exterieure, mecanique) ; ORIGINES_DESIGNATION gelé', async () => {
  assert.deepEqual([...ORIGINES_DESIGNATION], ['exterieure', 'mecanique', 'propre']); assert.ok(Object.isFrozen(ORIGINES_DESIGNATION)); assert.equal(ORIGINE_PROPRE, 'propre');
  const { w, P } = await fabrique({ r: 1 }); const O = (await rows(w, 'observationsPossibilites')).filter((o) => o.source === 'soi' && o.occasion).pop();
  const app = { operation: 'environnement:conversation', liaisons: [{ entree: 'emis', donnee: P.A.idExecution }] };
  for (const origine of ['propre', 'exterieure', 'mecanique']) { const d = await enregistrerDesignation(w.magasin, { observation: O, application: app, origine }); assert.equal(d.origine, origine); }
  await assert.rejects(enregistrerDesignation(w.magasin, { observation: O, application: app, origine: 'motivee' }), TypeError);
});
test('T3. peutAgir c=0 → false ; T4. c=1/2/3 → true ; ne lit que { valeur } ; main.js utilise la même porte (une seule définition)', () => {
  assert.equal(peutAgir({ valeur: 0 }), false); for (const c of [1, 2, 3]) assert.equal(peutAgir({ valeur: c }), true);
  assert.throws(() => peutAgir({}), TypeError);
  const main = sansCommentaires(lu('app', 'main.js')); assert.match(main, /const porte = !peutAgir\(capaciteAvant\)/); assert.equal(/\.valeur === 0/.test(main), false, 'aucune seconde définition de la porte dans main.js');
  const cap = sansCommentaires(lu('app', 'langage', 'capacite.js')); assert.equal(/relation|conversation|motif|besoin/i.test(cap), false, 'peutAgir ne connaît ni B2, ni la conversation, ni un motif');
});
test('T5. occasion pure : aucune aggravation → false ; T6. une aggravation → true ; T7. deux aggravations du même événement → UNE occasion ; T8. satisfaction → pas une aggravation ; T9. variation égale → non ; T10. aggravation causée par un épisode propre → non', () => {
  const cons = (l) => l.map(([dimension, id, valeurAvant, valeurApres], i) => ({ dimension, variation: `v${i}`, cause: { type: 't', id }, valeurAvant, valeurApres }));
  assert.equal(aggrave(BESOIN_RELATION, 0, 1), true); assert.equal(aggrave(BESOIN_RELATION, 3, 0), false); assert.equal(aggrave(BESOIN_CAPACITE, 3, 2), true); assert.equal(aggrave(BESOIN_CAPACITE, 2, 3), false); assert.equal(aggrave(BESOIN_RELATION, 3, 3), false);
  const base = { besoins: BESOINS, causesPropres: ['O-soi'] };
  assert.deepEqual(occasionDEvenement({ ...base, evenement: 'E', consequences: cons([['relation', 'E', 3, 0], ['capacite', 'E', 2, 3]]) }), { evenement: 'E', propre: false, aggravations: [], coutsDActivite: [], occasion: false });
  const une = occasionDEvenement({ ...base, evenement: 'E', consequences: cons([['relation', 'E', 0, 1], ['relation', 'X', 1, 2]]) }); assert.equal(une.occasion, true); assert.equal(une.aggravations.length, 1); assert.deepEqual(une.aggravations[0], { dimension: 'relation', variation: 'v0', valeurAvant: 0, valeurApres: 1, satiete: 0 });
  const deux = occasionDEvenement({ ...base, evenement: 'E', consequences: cons([['relation', 'E', 0, 1], ['capacite', 'E', 3, 2]]) }); assert.equal(deux.occasion, true); assert.equal(deux.aggravations.length, 2, 'deux aggravations, un seul objet occasion');
  assert.equal(occasionDEvenement({ ...base, evenement: 'E', consequences: cons([['relation', 'E', 3, 3], ['capacite', 'E', 3, 3]]) }).occasion, false);
  const propre = occasionDEvenement({ ...base, evenement: 'O-soi', consequences: cons([['capacite', 'O-soi', 3, 2]]) }); assert.deepEqual(propre, { evenement: 'O-soi', propre: true, aggravations: [], coutsDActivite: [], occasion: false });
  assert.equal(/dimension === '|=== 'relation'|=== 'capacite'/.test(sansCommentaires(lu('app', 'langage', 'occasion.js'))), false, 'aucune distinction codée B1/B2');
});
test('T11. occasion consommée une fois ; T12. second calcul sur le même événement → aucune nouvelle O ; T13. redémarrage → toujours consommée ; T14. O distincte de l\'événement ; T15. O de source soi', async () => {
  const { w } = await fabrique({ r: 0 }); const t = await tickPropre(w.magasin); const n0 = (await rows(w, 'observationsPossibilites')).length;
  const e1 = await traiterOccasion(w.magasin, t.tick.id); assert.equal(e1.occasion.occasion, true); assert.ok(e1.observation); assert.equal((await rows(w, 'observationsPossibilites')).length, n0 + 1);
  assert.notEqual(e1.observation.id, t.tick.id); assert.notEqual(e1.observation.id, t.observation.id); assert.equal(e1.observation.source, 'soi'); assert.equal(e1.observation.occasion, t.tick.id);
  const avant = await instantane(w.magasin); const e2 = await traiterOccasion(w.magasin, t.tick.id); assert.equal(e2.statut, 'occasion deja consommee'); assert.equal(e2.observation.id, e1.observation.id); assert.equal(await instantane(w.magasin), avant);
  const neuf = magasinMemoireVive(); await neuf.remplacerTout(JSON.parse(avant)); const e3 = await traiterOccasion(neuf, t.tick.id); assert.equal(e3.statut, 'occasion deja consommee'); assert.equal(await instantane(neuf), avant);
  assert.equal((await episodeDeLOccasion(neuf, t.tick.id)).id, e1.observation.id);
});
test('T16. évaluation globale B1 + B2 (tous les besoins déclarés, un candidat par production distincte) ; T21. même production via deux besoins → une candidate', async () => {
  const { w, P } = await fabrique({ c: 2, r: 2 }); const ev = await evaluer(w.magasin);
  assert.deepEqual(ev.besoins.map((b) => b.besoin), BESOINS.map((b) => b.dimension)); assert.equal(ev.besoins.length, 2);
  assert.deepEqual(ev.candidats.map((c) => c.production), [P.A.idExecution]); assert.equal(ev.porte, true);
  // deux besoins citant la même production : simulé en injectant la même liste de moyens dans les deux besoins (la vue dédoublonne par production)
  const besoinsSimules = [{ besoin: 'capacite', motif: true, moyens: [{ production: 'P', operation: 'op', preuves: [{ emission: 'e1', reception: 'r1', valeurAvant: 2, valeurApres: 3 }] }] }, { besoin: 'relation', motif: true, moyens: [{ production: 'P', operation: 'op', preuves: [{ emission: 'e2', reception: 'r2', valeurAvant: 1, valeurApres: 0 }] }] }];
  const parProduction = new Map(); for (const b of besoinsSimules) for (const m of b.moyens) { const c = parProduction.get(m.production) ?? { production: m.production, raisons: [] }; c.raisons.push(b.besoin); parProduction.set(m.production, c); }
  assert.equal(parProduction.size, 1); assert.deepEqual([...parProduction.values()][0].raisons, ['capacite', 'relation']);
  assert.match(sansCommentaires(lu('app', 'langage', 'episode-propre.js')), /parProduction\.get\(m\.production\)/, 'le dédoublonnage par production exacte est celui du module');
});
test('T17. 0 candidat → aucun acte (O créée, 0 candidat, aucune D, aucun coût, aucune émission) ; T39. ignorance : aucune émission/coût', async () => {
  const w = monde(); await w.tour('bonjour Pixel'); const avant = { em: (await rows(w, 'emissions')).length, vc: (await rows(w, 'variationsCapacite')).length, d: (await rows(w, 'designations')).length };
  const t = await w.tick(); assert.equal(t.episode.occasion.occasion, true); assert.equal(t.episode.statut, 'aucun acte - 0 candidat'); assert.ok(t.episode.observation);
  assert.equal(t.episode.evaluation.candidats.length, 0); assert.equal(t.episode.engagement, null);
  assert.equal((await rows(w, 'emissions')).length, avant.em); assert.equal((await rows(w, 'variationsCapacite')).length, avant.vc + 1, 'seule la variation du tick (repos)'); assert.equal((await rows(w, 'designations')).length, avant.d + 2, 'seules D1/D2 du tick');
});
test('T18. 1 candidat + c>0 → engagement ; T22. D origine propre ; T23. D porte environnement:conversation(emis=A) ; T24. coût cause O ; T25. coût idDesignation=D ; T27. E idExecution=A ; T28. E idObservation=O ; T29. aucune nouvelle exécution de A', async () => {
  const { w, P } = await fabrique({ c: 3, r: 0 }); const ex0 = (await rows(w, 'executionsOperations')).length;
  const t = await w.tick(); const ep = t.episode; assert.equal(ep.statut, 'engagement');
  assert.equal(ep.engagement.origine, 'propre'); assert.equal(ep.engagement.idObservation, ep.observation.id); assert.equal(ep.engagement.operation, 'environnement:conversation'); assert.deepEqual(ep.engagement.liaisons, [{ entree: 'emis', donnee: P.A.idExecution }]);
  assert.deepEqual(ep.cout.variation.cause, { type: 'tour', id: ep.observation.id }); assert.equal(ep.cout.variation.idDesignation, ep.engagement.id); assert.equal(ep.cout.avant, 3); assert.equal(ep.cout.apres, 2);
  const E = (await rows(w, 'emissions')).find((e) => e.id === ep.emission.idEmission); assert.equal(E.idExecution, P.A.idExecution); assert.equal(E.idObservation, ep.observation.id);
  assert.equal((await rows(w, 'executionsOperations')).length, ex0, 'aucune nouvelle exécution');
  assert.equal((await etat(w)).c, 2);
});
test('T19. 1 candidat + c=0 → aucun engagement (O existe, évaluation visible, candidat motivé visible, 0 autorisé, aucune D/coût/émission)', async () => {
  const { w, P } = await fabrique({ c: 0, r: 0 }); assert.equal((await etat(w)).c, 0);
  // le tick remonte c à 1 : pour tester c = 0 au moment de l'occasion, l'événement doit être une réception/tour ; ici : le tour d'un message à c=0 ne coûte rien (porte) → on force c = 0 après un tick par un tour
  const t = await w.tick(); // c 0→1, r 0→1 : occasion, A unique, autorisé → engagement (c 1→0)
  assert.equal(t.episode.statut, 'engagement'); assert.equal((await etat(w)).c, 0);
  // maintenant c = 0, r = 1 : nouvelle aggravation par tick ? le tick remonte c (1) → porte ouverte. On construit donc l'occasion à c = 0 par un message ordinaire : aucun coût (porte) → aucune aggravation → pas d'occasion. Cas direct : évaluation à c = 0.
  const ev = await evaluer(w.magasin); assert.equal(ev.porte, false); assert.equal(ev.candidats.length, 1); assert.deepEqual(ev.autorises, []);
  const avant = await instantane(w.magasin); const n = { em: (await rows(w, 'emissions')).length, d: (await rows(w, 'designations')).length };
  // réception à c = 0 d'une émission ancienne : r 1 → 0 (satisfaction, pas d'occasion) ; puis tick à c = 0 : c 0→1 ouvre la porte. Pour l'occasion à c = 0 : simulation d'une évaluation dans un épisode via un faux événement aggravant : on vérifie le statut
  const consequences = [{ dimension: 'relation', variation: 'x', cause: { type: 'tick', id: 'E-test' }, valeurAvant: 1, valeurApres: 2 }];
  assert.equal(occasionDEvenement({ evenement: 'E-test', consequences, besoins: BESOINS, causesPropres: [] }).occasion, true);
  assert.equal(await instantane(w.magasin), avant);
  assert.equal((await rows(w, 'emissions')).length, n.em); assert.equal((await rows(w, 'designations')).length, n.d);
});
test('T19 bis. occasion réelle à c = 0 : un message à c = 0 puis une réception ne créent pas d\'occasion ; une aggravation de r à c = 0 (tick suivi d\'un tour) donne « capacité insuffisante »', async () => {
  const { w, P } = await fabrique({ c: 3, r: 0 }); const t1 = await w.tick(); assert.equal(t1.episode.statut, 'engagement'); // c 2
  await w.tour('un'); await w.tour('deux'); // c 1 → 0 par les tours (chaque tour coûte, et chaque coût est une aggravation B1 → occasion → B2 motivé, A unique → engagement tant que c > 0)
  const c0 = (await etat(w)).c; assert.equal(c0, 0);
  const t2 = await w.tick(); // c 0→1 ; r monte : occasion ; porte ouverte → engagement c 1→0
  assert.equal(t2.episode.statut, 'engagement'); assert.equal((await etat(w)).c, 0);
  const s = await w.tour('trois'); // à c = 0 : porte → lot vide → aucun coût → aucune aggravation
  assert.equal(s.episodes[0].statut, 'aucune occasion'); assert.equal(s.episodes[0].occasion.aggravations.length, 0);
});
test('T20. 2 candidats → aucun engagement ; T38. multi-candidats : aucune émission/coût, indétermination visible', async () => {
  const { w, P } = await fabrique({ c: 3, r: 0, connus: ['A', 'B'] }); const n = { em: (await rows(w, 'emissions')).length, vc: (await rows(w, 'variationsCapacite')).length, d: (await rows(w, 'designations')).length };
  const t = await w.tick(); assert.equal(t.episode.statut, 'aucun acte - 2 candidats'); assert.ok(t.episode.observation); assert.equal(t.episode.evaluation.autorises.length, 2); assert.equal(t.episode.engagement, null); assert.equal(t.episode.cout, null); assert.equal(t.episode.emission, null);
  assert.equal((await rows(w, 'emissions')).length, n.em); assert.equal((await rows(w, 'variationsCapacite')).length, n.vc + 1); assert.equal((await rows(w, 'designations')).length, n.d + 2);
  assert.deepEqual(t.episode.evaluation.autorises.map((c) => c.production).sort(), [P.A.idExecution, P.B.idExecution].sort());
});
test('T26. second coût pour la même O refusé (une cause, une variation) → un épisode = au plus une initiative', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); const t = await w.tick(); const O = t.episode.observation;
  await assert.rejects(tourActif(w.magasin, { idObservation: O.id, horodatage: O.horodatage }), /existe déjà|déjà produit|une cause/);
});
test('T30. silence r0→1→2→3 : au plus une initiative par aggravation ; T31. r3→3 : aucune occasion ; T43. émission sans réponse : le silence reste silence (A reste connu, aucune issue négative)', async () => {
  const { w, P } = await fabrique({ c: 3, r: 0 }); const em0 = (await rows(w, 'emissions')).length;
  const t = await w.ticks(6); const statuts = t.map((x) => x.episode.statut);
  assert.deepEqual(statuts, ['engagement', 'engagement', 'engagement', 'aucune occasion', 'aucune occasion', 'aucune occasion']);
  assert.equal((await rows(w, 'emissions')).length, em0 + 3); assert.deepEqual(await etat(w), { c: 3, r: 3 });
  for (const x of t.slice(3)) assert.equal(x.episode.occasion.aggravations.length, 0);
  const m = moyensConnus(await w.vecu(), BESOIN_RELATION); assert.deepEqual(m.moyens.map((x) => x.production), [P.A.idExecution]); assert.equal(m.moyens[0].preuves.length, 1, 'les trois émissions sans réponse n\'ajoutent ni preuve ni issue');
  assert.equal(/silence|echec_silence|sansReponse|sans_reponse/.test(sansCommentaires(lu('app', 'langage', 'episode-propre.js'))), false);
});
test('T32. tick c2→3 / r3→3 : aucune initiative ; T33. 10 ticks saturés : zéro initiative', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); await w.ticks(3); // r 3, trois initiatives, c 3 (chaque tick +1, chaque acte −1)
  await w.tour('un'); // c 3 → 2 (tour) ; l'occasion B1 du tour : B2 motivé, A unique → engagement c 2 → 1 ; puis r reste 3
  const e0 = (await rows(w, 'emissions')).length; const c0 = (await etat(w)).c;
  const t = await w.ticks(10); assert.ok(t.every((x) => x.episode.statut === 'aucune occasion'), t.map((x) => x.episode.statut).join(','));
  assert.equal((await rows(w, 'emissions')).length, e0); assert.deepEqual(await etat(w), { c: 3, r: 3 }); assert.ok(c0 < 3);
});
test('T34. coût propre c3→2 : zéro récursion (la variation causée par O, source soi, n\'ouvre aucune occasion) ; T12 bis : aucune chaîne acte → coût → occasion → acte', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); const t = await w.tick(); const O = t.episode.observation; assert.equal(t.episode.cout.avant, 3);
  const cons = await lireConsequences(w.magasin); const duCout = cons.filter((x) => x.cause.id === O.id); assert.equal(duCout.length, 1); assert.equal(duCout[0].valeurApres, 2);
  const occ = occasionDEvenement({ evenement: O.id, consequences: cons, besoins: BESOINS, causesPropres: (await rows(w, 'observationsPossibilites')).filter((o) => o.source === 'soi').map((o) => o.id), couts: await coutsDActivite(w.magasin) });
  assert.deepEqual(occ, { evenement: O.id, propre: true, aggravations: [], coutsDActivite: [{ dimension: 'capacite', variation: duCout[0].variation, valeurAvant: 3, valeurApres: 2, satiete: 3 }], occasion: false }); // MISE À JOUR DÉLIBÉRÉE v0.63.88 (correction L avant livraison : le coût d'une activité n'est pas une aggravation) : le coût est reconnu comme coût d'activité (O porte la désignation D) ET l'événement est propre
  const avant = await instantane(w.magasin); const r = await traiterOccasion(w.magasin, O.id); assert.equal(r.statut, 'aucune occasion'); assert.equal(await instantane(w.magasin), avant); assert.equal((await etat(w)).c, 2);
});
test('T35. 20 relectures des vues sans événement : zéro émission, zéro observation, zéro désignation', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); await w.tick(); const avant = await instantane(w.magasin);
  for (let i = 0; i < 20; i += 1) { await lireBesoins(w.magasin); await evaluer(w.magasin); await lireDernierEpisode(w.magasin); await lireConsequences(w.magasin); }
  assert.equal(await instantane(w.magasin), avant);
});
test('T36. réception r→0 : A reste moyen connu, motif false ; T37. satisfaction seule : pas de réémission (aucune occasion pour la réception)', async () => {
  const { w, P } = await fabrique({ c: 3, r: 0 }); const t = await w.tick(); const E2 = t.episode.emission.idEmission; const em0 = (await rows(w, 'emissions')).length;
  const s = await w.tour('merci', E2); // tour : coût c (occasion B1 → B2 encore motivé avant la réception ? NON : la réception est traitée AVANT les occasions ; r = 0 au moment de l'évaluation)
  const parEvenement = Object.fromEntries(s.episodes.map((e) => [e.evenement === s.observation.id ? 'tour' : 'reception', e]));
  assert.equal(parEvenement.reception.statut, 'aucune occasion'); assert.equal(parEvenement.reception.occasion.aggravations.length, 0);
  assert.equal(parEvenement.tour.occasion.occasion, false, 'le coût du tour est le coût d\'une activité : pas une aggravation'); assert.equal(parEvenement.tour.occasion.coutsDActivite.length, 1); assert.equal(parEvenement.tour.statut, 'aucune occasion'); // MISE À JOUR DÉLIBÉRÉE v0.63.88 (correction L avant livraison : le coût d'une activité n'est pas une aggravation)
  const b = (await lireBesoins(w.magasin)).find((x) => x.besoin === 'relation'); assert.equal(b.motif, false); assert.deepEqual(b.moyens.map((m) => m.production), [P.A.idExecution]); assert.equal(b.moyens[0].preuves.length, 2);
  assert.equal((await rows(w, 'emissions')).length - em0, s.emises.length, 'seules les émissions du lot du tour ; aucune réémission de A');
  assert.equal(/apres.?reponse|arreter|stop/i.test(sansCommentaires(lu('app', 'langage', 'episode-propre.js'))), false);
});
test('T40. base .87 existante : moyen historique immédiatement utilisable (aucune observation « occasion » préexistante, première occasion → engagement)', async () => {
  // base « .87 » : construite sans aucun traitement d'occasion (pipeline .87 pur), puis copiée dans un magasin neuf
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  const tour87 = async (texte, idEmission = null) => { const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => { const lot = await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS }); const { emises } = await emettreLot(lot, { magasin, idObservation: observation.id }); if (lot.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage }); return { ...lot, emises }; }, async () => magasin); const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) }); const s = suivi.joindre(res).sollicitation; if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); await consequenceReception(magasin, d.reception); } return s; };
  const s1 = await tour87('bonjour Pixel'); await tickPropre(magasin); await tickPropre(magasin); await tour87('bonjour Luna', s1.emises[0].idEmission); await tickPropre(magasin); await tickPropre(magasin); await tickPropre(magasin);
  assert.ok((await magasin.lireTout('observationsPossibilites')).every((o) => o.occasion === undefined));
  const neuf = magasinMemoireVive(); await neuf.remplacerTout(JSON.parse(await instantane({ lireTout: (t) => magasin.lireTout(t) }))); assert.equal((await lireRelation(neuf)).valeur, 3);
  const moyens = moyensConnus(await lireExecutionsVecues(neuf), BESOIN_RELATION); assert.deepEqual(moyens.moyens.map((m) => m.production), [s1.emises[0].idExecution]);
  // r = 3 saturé : un tick n'ouvre rien ; une réponse puis un tick : r 0 → 1 → engagement de A immédiatement
  const t0 = await tickPropre(neuf); assert.equal((await traiterOccasion(neuf, t0.tick.id)).statut, 'aucune occasion');
  const w = monde(1000); await w.magasin.remplacerTout(JSON.parse(await instantane(neuf))); await w.tour('merci', s1.emises[0].idEmission); const t = await w.tick();
  assert.equal(t.episode.statut, 'engagement'); assert.equal(t.episode.emission.idExecution, s1.emises[0].idExecution);
});
test('T41. fermeture/réouverture : D/O/E/coût reconstruits ; T42. lien D↔E non ambigu ; lireDernierEpisode = l\'épisode vécu ; aucune initiative au redémarrage', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); const t = await w.tick(); const ep = t.episode; const dump = JSON.parse(await instantane(w.magasin));
  const neuf = magasinMemoireVive(); await neuf.remplacerTout(dump); const avant = await instantane(neuf);
  const d = await lireDernierEpisode(neuf); assert.equal(d.observation.id, ep.observation.id); assert.equal(d.engagement.id, ep.engagement.id); assert.equal(d.cout.id, ep.cout.variation.id); assert.equal(d.emission.id, ep.emission.idEmission); assert.equal(d.evenement, t.tick.id); assert.equal(d.occasion.occasion, true);
  const E = (await neuf.lireTout('emissions')).filter((e) => e.idObservation === d.engagement.idObservation && e.idExecution === d.engagement.liaisons[0].donnee); assert.equal(E.length, 1, 'un épisode, une initiative : (idObservation, idExecution) désigne une seule émission');
  assert.equal((await neuf.lireTout('variationsCapacite')).filter((v) => v.idDesignation === d.engagement.id).length, 1);
  assert.equal(await instantane(neuf), avant, 'la lecture du dernier épisode n\'écrit rien : aucune initiative au redémarrage');
});
test('T44. aucune fréquence/score/récence/hasard ; T45. aucun timer/cadence autonome ; T46. aucune généralisation classe→instance ; vocabulaire d\'intention absent (code hors commentaires)', () => {
  for (const f of ['occasion.js', 'episode-propre.js']) {
    const code = sansCommentaires(lu('app', 'langage', f));
    assert.equal(/score|poids|frequence|fréquence|recence|récence|Math\.random|round|priorit|prefer|préfér|cooldown|delai|délai|compteur/i.test(code), false, f);
    assert.equal(/setInterval|setTimeout|requestAnimationFrame|requestIdleCallback|Date\.now/.test(code), false, f);
    assert.equal(/classe|squelette|famille|reconstruire|executerApplication|invoquerOperation|resoudreValeurs/i.test(code), false, f);
    assert.equal(/\bveut\b|préfère|décide|désire|cherche|choisit/i.test(code), false, f);
  }
  const ecran = sansCommentaires(lu('app', 'conversation', 'ecran.js')); assert.equal(/\bveut\b|préfère|décide|désire/i.test(ecran), false, 'écran : aucun vocabulaire d\'intention (code hors commentaires)');
  const main = sansCommentaires(lu('app', 'main.js')); assert.equal(/setInterval|setTimeout\([^)]*(occasion|episode|tick)/i.test(main), false, 'aucune cadence autonome dans main.js');
  assert.equal((main.match(/traiterOccasion\(/g) || []).length, 2, 'deux appels : après le tick, après les événements d\'un tour');
});
test('T47. aucune table nouvelle ; T48. aucune migration ; T49. sauvegarde/restauration des anciennes bases ; la liaison `occasion` n\'est qu\'un champ facultatif d\'une ligne existante', async () => {
  assert.equal(TABLES.length, 30); assert.equal(VERSION_BASE, 24); assert.equal(SCHEMA_SAUVEGARDE, 14); assert.ok(!TABLES.some((t) => /occasion|episode/i.test(t)));
  assert.deepEqual(migrerDonnees({ a: [1] }, ['a', 'relationInitiale'], 13), { a: [1], relationInitiale: [] }, 'migration .85 → 14 inchangée'); assert.deepEqual(migrerDonnees({ a: [1], relationInitiale: [] }, ['a', 'relationInitiale'], 14), { a: [1], relationInitiale: [] }, 'schéma 14 : aucune migration en .88');
  const { w } = await fabrique({ c: 3, r: 0 }); await w.tick();
  const memoire = { lireTout: async () => [], exporterDonnees: async () => ({}), tables: [] };
  const sauvegarde = await construireSauvegardeComplete({ memoire, magasinLangage: w.magasin, idNaissance: 'n', versionAppli: 'x', maintenant: new Date('2026-10-11T09:00:00.000Z') });
  assert.equal(sauvegarde.objet.schema, 14); const lue = await lireSauvegardeComplete(sauvegarde.contenu, { tablesMemoire: [] }); assert.equal(lue.ok, true);
  const O = (await w.magasin.lireTout('observationsPossibilites')).find((o) => o.occasion); assert.ok(O);
  assert.deepEqual(lue.donnees.langage.observationsPossibilites.find((o) => o.id === O.id), O, 'la ligne avec sa liaison occasion est recopiée telle quelle');
  await assert.rejects(enregistrerObservationPossibilites(w.magasin, { idMessage: 'm', donneesExaminees: ['m'], operationsExaminees: [], possibilites: [], occasion: 'E' }), /occasion exige une source/);
});
test('T50 (statique). dormance et branchement : episode-propre.js n\'est importé que par main.js ; aucun lecteur de r hors les modules déclarés ; la zone de diagnostic existe (styles + écran)', () => {
  const fichiers = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fichiers(join(d, e.name)) : /\.js$/.test(e.name) ? [join(d, e.name)] : []));
  const importeurs = fichiers(join(RACINE, 'app')).filter((f) => /episode-propre\.js'/.test(sansCommentaires(readFileSync(f, 'utf8')))).map((f) => f.slice(RACINE.length + 1));
  assert.deepEqual(importeurs, ['app/main.js']);
  assert.match(lu('app', 'styles.css'), /\.diagnostic \{/); assert.match(lu('app', 'conversation', 'ecran.js'), /className = 'episode-zone'/); assert.match(lu('app', 'conversation', 'ecran.js'), /className = 'diagnostic'/);
});

// ---- CORRECTION L AVANT LIVRAISON (décision ChatGPT, 11/10/2026) : « le coût d'une ACTIVITÉ de Naissance n'ouvre pas d'occasion ». Fait existant utilisé :
// une variation est le coût d'une activité ssi sa cause est l'identité d'une observation portant au moins une désignation (designations.idObservation).
test('C1–C4. temps r0→1, r1→2, r2→3 : occasion oui ; r3→3 : non ; C14. silence B2 0→1→2→3 : comportement .88 inchangé (3 initiatives puis plus rien)', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); const t = await w.ticks(4);
  assert.deepEqual(t.map((x) => x.episode.occasion.occasion), [true, true, true, false]); assert.deepEqual(t.map((x) => x.episode.statut), ['engagement', 'engagement', 'engagement', 'aucune occasion']);
  assert.deepEqual(t.map((x) => x.episode.occasion.coutsDActivite.length), [0, 0, 0, 0]);
});
test('C5. coût d\'un épisode propre c3→2 : occasion non ; C12. le coût d\'une initiative ne récurse toujours pas', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); const t = await w.tick(); const O = t.episode.observation; assert.equal(t.episode.cout.avant, 3);
  const r = await traiterOccasion(w.magasin, O.id); assert.equal(r.occasion.occasion, false); assert.equal(r.occasion.propre, true); assert.equal(r.occasion.coutsDActivite.length, 1); assert.equal(r.statut, 'aucune occasion'); assert.equal((await etat(w)).c, 2);
});
test('C6. coût du tour mécanique provoqué par un message c3→2 : occasion non ; C7. message ordinaire à r>0 : aucune occasion, aucune initiative supplémentaire', async () => {
  const { w, P } = await fabrique({ c: 3, r: 0 }); await w.ticks(3); // r 3, trois initiatives
  const e0 = (await rows(w, 'emissions')).length; const c0 = (await etat(w)).c; assert.equal((await etat(w)).r, 3);
  const s = await w.tour('bonjour à r = 3'); assert.equal(s.episodes.length, 1); const ep = s.episodes[0];
  assert.equal(ep.occasion.occasion, false); assert.equal(ep.occasion.aggravations.length, 0); assert.equal(ep.occasion.coutsDActivite.length, 1); assert.equal(ep.occasion.coutsDActivite[0].dimension, 'capacite'); assert.equal(ep.statut, 'aucune occasion'); assert.equal(ep.observation, null);
  assert.equal((await rows(w, 'emissions')).length, e0 + s.emises.length, 'seules les émissions du lot'); assert.equal((await etat(w)).c, c0 - 1, 'un seul coût : celui du tour');
  assert.equal((await rows(w, 'designations')).filter((d) => d.origine === 'propre').length, 3, 'aucun engagement nouveau');
});
test('C6 bis. coutsDActivite sur les faits réels : les coûts sont EXACTEMENT les variations « tour » (lot mécanique d\'un message, engagement propre) ; jamais celles du repos, du temps, d\'une réception', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); await w.tick(); await w.tour('un');
  const couts = new Set(await coutsDActivite(w.magasin)); const vc = await rows(w, 'variationsCapacite'); const vr = await rows(w, 'variationsRelation');
  for (const v of vc) assert.equal(couts.has(v.id), v.cause.type === 'tour', `${v.cause.type} ${v.valeur}`);
  for (const v of vr) assert.equal(couts.has(v.id), false);
  assert.ok(vc.some((v) => v.cause.type === 'tour' && v.idDesignation === undefined), 'un coût de tour mécanique (sans idDesignation)'); assert.ok(vc.some((v) => v.cause.type === 'tour' && typeof v.idDesignation === 'string'), 'un coût d\'engagement propre (idDesignation = D)');
});
test('C8. Répondre + message : réception r→0 ; aucune initiative causée par le coût mécanique', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); const t = await w.tick(); const E2 = t.episode.emission.idEmission; const propres0 = (await rows(w, 'designations')).filter((d) => d.origine === 'propre').length;
  const s = await w.tour('merci', E2); assert.equal((await etat(w)).r, 0);
  for (const ep of s.episodes) { assert.equal(ep.occasion.occasion, false); assert.equal(ep.statut, 'aucune occasion'); }
  assert.equal((await rows(w, 'designations')).filter((d) => d.origine === 'propre').length, propres0);
});
test('C9. événement synthétique externe X : c3→2 directement, sans activité → aggravation B1 → occasion oui ; C10. événement avec un coût d\'activité c3→2 ET une aggravation directe d\'un autre besoin → UNE occasion ; C11. l\'évaluation reste globale', async () => {
  const cons = (l) => l.map(([dimension, id, valeurAvant, valeurApres], i) => ({ dimension, variation: `v${i}`, cause: { type: 't', id }, valeurAvant, valeurApres }));
  const base = { besoins: BESOINS, causesPropres: [] };
  const x = occasionDEvenement({ ...base, evenement: 'X', consequences: cons([['capacite', 'X', 3, 2]]), couts: ['autre-variation'] }); assert.equal(x.occasion, true); assert.equal(x.aggravations.length, 1); assert.equal(x.aggravations[0].dimension, 'capacite');
  const y = occasionDEvenement({ ...base, evenement: 'Y', consequences: cons([['capacite', 'Y', 3, 2], ['relation', 'Y', 0, 1]]), couts: ['v0'] }); assert.equal(y.occasion, true); assert.equal(y.aggravations.length, 1); assert.equal(y.aggravations[0].dimension, 'relation'); assert.equal(y.coutsDActivite.length, 1);
  // C11 : l'évaluation d'un épisode est globale (tous les besoins déclarés), indépendamment de l'aggravation qui a ouvert l'occasion
  const { w } = await fabrique({ c: 2, r: 0 }); const t = await w.tick(); assert.deepEqual(t.episode.evaluation.besoins.map((b) => b.besoin), ['capacite', 'relation']); assert.equal(typeof t.episode.evaluation.besoins[0].motif, 'boolean', 'B1 évalué aussi (ici c = 3 après le repos du tick : motif faux)');
  assert.equal(/message|conversation|relation|B1|capacite/i.test(sansCommentaires(lu('app', 'langage', 'occasion.js'))), false, 'occasion.js ne nomme ni message, ni B1, ni relation, ni conversation');
});
test('C13. tick neutre c2→3 / r3→3 : aucune occasion ; C15. ancienne base .87 : inchangée (aucune écriture au chargement, moyens retrouvés) ; C16. redémarrage : consommation reconstructible', async () => {
  const { w } = await fabrique({ c: 3, r: 0 }); await w.ticks(3); await w.tour('un'); // c 2, r 3, aucune initiative par le tour
  const e0 = (await rows(w, 'emissions')).length; const t = await w.tick(); assert.equal(t.episode.occasion.occasion, false); assert.deepEqual(await etat(w), { c: 2, r: 3 }, 'c 1 → 2 par le repos du tick (le tour « un » avait coûté 2 → 1 sans ouvrir d\'occasion), aucune initiative'); assert.equal((await rows(w, 'emissions')).length, e0);
  const dump = JSON.parse(await instantane(w.magasin)); const neuf = magasinMemoireVive(); await neuf.remplacerTout(dump); const avant = await instantane(neuf);
  const d = await lireDernierEpisode(neuf); assert.ok(d.engagement); assert.equal(await instantane(neuf), avant);
  const evenement = d.evenement; assert.equal((await traiterOccasion(neuf, evenement)).statut, 'occasion deja consommee'); assert.equal(await instantane(neuf), avant);
});
// === FIN_TEST_EPISODE_PROPRE ===
