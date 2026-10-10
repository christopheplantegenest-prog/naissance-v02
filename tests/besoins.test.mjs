// === DEBUT_TEST_BESOINS ===
// v0.63.87 — BESOINS DÉCLARÉS + MOTIF ACTUEL + MOYENS CONNUS (décision ChatGPT « APRÈS SONDE « INITIATIVE MOTIVÉE » », 10/10/2026).
// Les 28 tests obligatoires de la décision sont numérotés N1…N28 dans les intitulés. AUCUNE initiative, AUCUN choix, AUCUNE émission supplémentaire :
// les vues sont PURES ; chaque test qui lit vérifie que le magasin reste strictement identique.
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
import { lireCapacite, tourActif, PARAMETRES_B1 } from '../app/langage/capacite.js';
import { lireRelation, consequenceReception } from '../app/langage/relation.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { DESCRIPTIONS_SOI } from '../app/langage/projection-soi.js';
import { BESOIN_CAPACITE, BESOIN_RELATION, BESOINS, motifDuBesoin, moyensConnus, lireBesoins } from '../app/langage/besoins.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

// Le PIPELINE RÉEL d'un tour (main.js), identique à celui de relation.test.mjs : observation → porte B1 → lot → émission → tourActif ; puis, si le
// message répond à une émission (geste « Répondre »), réception déclarée → conséquence B2.
function monde() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin); const porte = avant.valeur === 0;
      const lot = porte ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      if (lot.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage });
      return { ...lot, emises, echecEmission: echec };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    let reception = null;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); reception = d.reception; await consequenceReception(magasin, d.reception); }
    return { ...s, reception };
  }
  return { magasin, tour, ticks: async (k) => { for (let i = 0; i < k; i += 1) await tickPropre(magasin); }, vecu: () => lireExecutionsVecues(magasin) };
}
const instantane = async (m) => JSON.stringify(Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await m.lireTout(t)]))));
const rel = async (w) => moyensConnus(await w.vecu(), BESOIN_RELATION);
const cap = async (w) => moyensConnus(await w.vecu(), BESOIN_CAPACITE);
const prods = (res) => res.moyens.map((m) => m.production);
const unMonde = async () => { const w = monde(); const s = await w.tour('bonjour Pixel'); assert.ok(s.emises.length >= 2, 'le tour émet au moins deux productions'); return { w, A: s.emises[0], B: s.emises[1], emises: s.emises }; };

test('N1. DÉCLARATION B1 : { dimension capacite, satiété = plafond actuel PARAMETRES_B1 (3) } — gelée, minimale (deux champs), sans stratégie', () => {
  assert.deepEqual(BESOIN_CAPACITE, { dimension: 'capacite', satiete: 3 }); assert.equal(BESOIN_CAPACITE.satiete, PARAMETRES_B1.plafond);
  assert.ok(Object.isFrozen(BESOIN_CAPACITE)); assert.deepEqual(Object.keys(BESOIN_CAPACITE).sort(), ['dimension', 'satiete']);
});
test('N2. DÉCLARATION B2 : { dimension relation, satiété 0 } — la même valeur que celle où la réception déclarée ramène r (cohérence gardée) ; BESOINS = [B1, B2], gelés', async () => {
  assert.deepEqual(BESOIN_RELATION, { dimension: 'relation', satiete: 0 }); assert.ok(Object.isFrozen(BESOIN_RELATION)); assert.deepEqual(BESOIN_RELATION && Object.keys(BESOIN_RELATION).sort(), ['dimension', 'satiete']);
  assert.deepEqual(BESOINS, [BESOIN_CAPACITE, BESOIN_RELATION]); assert.ok(Object.isFrozen(BESOINS));
  const { w, A } = await unMonde(); await w.ticks(2); const d = await declarerReceptionConversation({ idDonnee: (await w.magasin.lireTout('valeursDonnees'))[0].id, idEmission: A.idEmission }, { magasin: w.magasin });
  const x = await consequenceReception(w.magasin, d.reception); assert.equal(x.apres, BESOIN_RELATION.satiete);
});
test('N3. MOTIF B2 : r = 0 → motif faux (booléen exact), sortie { besoin, valeurActuelle, satiete, motif } seulement', () => {
  const m = motifDuBesoin(BESOIN_RELATION, { valeur: 0 });
  assert.deepEqual(m, { besoin: 'relation', valeurActuelle: 0, satiete: 0, motif: false }); assert.equal(typeof m.motif, 'boolean');
});
test('N4. MOTIF B2 : r = 1, 2, 3 → motif vrai, sans gradation (même sortie hors valeurActuelle)', () => {
  for (const r of [1, 2, 3]) assert.deepEqual(motifDuBesoin(BESOIN_RELATION, { valeur: r }), { besoin: 'relation', valeurActuelle: r, satiete: 0, motif: true });
});
test('N5. MOTIF B1 : c = 3 → faux ; c = 0, 1, 2 → vrai (la vue ne dit PAS que B1 demande du repos : aucun champ d\'action)', () => {
  assert.equal(motifDuBesoin(BESOIN_CAPACITE, { valeur: 3 }).motif, false);
  for (const c of [0, 1, 2]) assert.equal(motifDuBesoin(BESOIN_CAPACITE, { valeur: c }).motif, true);
  assert.deepEqual(Object.keys(motifDuBesoin(BESOIN_CAPACITE, { valeur: 1 })).sort(), ['besoin', 'motif', 'satiete', 'valeurActuelle']);
  assert.throws(() => motifDuBesoin({ dimension: 'inconnue', satiete: 0 }, { valeur: 0 }), TypeError); assert.throws(() => motifDuBesoin(BESOIN_RELATION, {}), TypeError);
});
test('N6. IGNORANCE : r = 3 et aucune réception vécue → motif vrai, moyens connus = [] ; aucun repli (aucune émission ajoutée, rien d\'écrit)', async () => {
  const { w } = await unMonde(); await w.ticks(3);
  const avant = await instantane(w.magasin); const b = (await lireBesoins(w.magasin)).find((x) => x.besoin === 'relation'); const apres = await instantane(w.magasin);
  assert.equal(b.valeurActuelle, 3); assert.equal(b.motif, true); assert.deepEqual(b.moyens, []); assert.equal(apres, avant);
});
test('N7. ÉMISSION SANS RÉCEPTION : une production émise n\'est PAS un moyen', async () => {
  const { w, emises } = await unMonde(); await w.ticks(2);
  assert.ok(emises.length >= 2); assert.deepEqual(prods(await rel(w)), []);
});
test('N8. RÉCEPTION 3 → 0 : la production reçue devient un moyen connu, avec une preuve (avant 3, après 0)', async () => {
  const { w, A } = await unMonde(); await w.ticks(3); await w.tour('bonjour Luna', A.idEmission);
  const m = await rel(w); assert.deepEqual(prods(m), [A.idExecution]);
  assert.equal(m.moyens[0].preuves.length, 1); assert.equal(m.moyens[0].preuves[0].valeurAvant, 3); assert.equal(m.moyens[0].preuves[0].valeurApres, 0);
});
test('N9. RÉCEPTION 1 → 0 : moyen connu', async () => {
  const { w, A } = await unMonde(); await w.ticks(1); assert.equal((await lireRelation(w.magasin)).valeur, 1); await w.tour('bonjour Luna', A.idEmission);
  const m = await rel(w); assert.deepEqual(prods(m), [A.idExecution]); assert.equal(m.moyens[0].preuves[0].valeurAvant, 1);
});
test('N10. RÉCEPTION 0 → 0 : fait vécu (variation écrite) mais PAS une preuve de transition vers la satiété', async () => {
  const { w, A } = await unMonde(); await w.tour('bonjour Luna', A.idEmission);
  const v = await w.magasin.lireTout('variationsRelation'); assert.equal(v.length, 1); assert.equal(v[0].valeur, 0); assert.equal(v[0].cause.type, 'reception');
  const m = await rel(w); assert.deepEqual(m.moyens, []); assert.deepEqual(m.satisfactionsSansProduction, []);
});
test('N11. RÉPONSE TARDIVE : B n\'est un moyen qu\'APRÈS la réception réelle ; A, jamais répondu, ne l\'est pas', async () => {
  const { w, B } = await unMonde(); await w.ticks(3);
  assert.deepEqual(prods(await rel(w)), []); await w.tour('au revoir Pixel', B.idEmission);
  assert.deepEqual(prods(await rel(w)), [B.idExecution]);
});
test('N12. A répondue, B silencieuse : moyens connus = { A } (B émise, jamais reçue, absente)', async () => {
  const { w, A, B } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission);
  const p = prods(await rel(w)); assert.deepEqual(p, [A.idExecution]); assert.ok(!p.includes(B.idExecution));
});
test('N13. A et B répondues : { A, B } ; aucun ordre de préférence (ordre lexical des identités, indépendant de l\'ordre vécu)', async () => {
  const { w, A, B } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', B.idEmission); await w.ticks(2); await w.tour('bonjour Max', A.idEmission);
  const p = prods(await rel(w)); assert.deepEqual([...p].sort(), [A.idExecution, B.idExecution].sort()); assert.deepEqual(p, [...p].sort(), 'ordre = ordre lexical des identités');
});
test('N14. A, DEUX réussites : A UNE fois, DEUX preuves (jamais un score)', async () => {
  const { w, A } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission); await w.ticks(1); await w.tour('bonjour Max', A.idEmission);
  const m = await rel(w); assert.equal(m.moyens.length, 1); assert.equal(m.moyens[0].production, A.idExecution); assert.equal(m.moyens[0].preuves.length, 2);
  assert.notEqual(m.moyens[0].preuves[0].reception, m.moyens[0].preuves[1].reception); assert.ok(!('score' in m.moyens[0]) && !('compte' in m.moyens[0]));
});
test('N15. r = 0 APRÈS APPRENTISSAGE : motif faux, mais A reste un moyen connu (la mémoire demeure)', async () => {
  const { w, A } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission);
  const b = (await lireBesoins(w.magasin)).find((x) => x.besoin === 'relation'); assert.equal(b.valeurActuelle, 0); assert.equal(b.motif, false); assert.deepEqual(b.moyens.map((m) => m.production), [A.idExecution]);
});
test('N16. r REMONTE : motif vrai, A reste connu, AUCUNE émission automatique', async () => {
  const { w, A } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission);
  const e0 = (await w.magasin.lireTout('emissions')).length; await w.ticks(3);
  const b = (await lireBesoins(w.magasin)).find((x) => x.besoin === 'relation'); assert.equal(b.motif, true); assert.deepEqual(b.moyens.map((m) => m.production), [A.idExecution]);
  assert.equal((await w.magasin.lireTout('emissions')).length, e0);
});
test('N17. POSSIBILITÉS soi:reception JAMAIS VÉCUES : structurellement possibles (catalogue), absentes du vécu → ignorées', async () => {
  const { w } = await unMonde(); await w.ticks(3);
  assert.ok(DESCRIPTIONS_SOI.some((d) => d.nom === 'soi:reception'));
  const v = await w.vecu(); assert.ok(!v.executions.some((e) => e.operation === 'soi:reception')); assert.deepEqual((await rel(w)).moyens, []);
});
test('N18. CLASSE SEULE JAMAIS CANDIDATE : une production non répondue de même opération qu\'une répondue reste hors ensemble ; aucune classe en sortie', async () => {
  const { w, A, emises } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission);
  const m = await rel(w); assert.deepEqual(prods(m), [A.idExecution]);
  const memeClasse = emises.filter((e) => e.idExecution !== A.idExecution && e.operation === A.operation);
  assert.ok(!memeClasse.some((e) => prods(m).includes(e.idExecution)));
  assert.ok(!/classe|squelette|famille/i.test(JSON.stringify(m)));
});
test('N19. B1 NE FABRIQUE PAS DE PRODUCTION CANDIDATE : moyens = [] ; la satisfaction (soi:repos) est exposée comme expérience, pas comme action', async () => {
  const { w } = await unMonde(); await w.ticks(2);
  const m = await cap(w); assert.deepEqual(m.moyens, []); assert.ok(m.satisfactionsSansProduction.length >= 1);
  assert.ok(m.satisfactionsSansProduction.every((x) => x.operation === 'soi:repos' && x.valeurApres === 3 && x.valeurAvant < 3));
  const motif = (await lireBesoins(w.magasin)).find((x) => x.besoin === 'capacite'); assert.deepEqual(motif.moyens, []);
});
test('N20. LECTURE RÉPÉTÉE : zéro écriture (magasin strictement identique) ; entrées profondément gelées acceptées', async () => {
  const { w, A } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission); await w.ticks(1);
  const avant = await instantane(w.magasin);
  for (let i = 0; i < 3; i += 1) await lireBesoins(w.magasin);
  assert.equal(await instantane(w.magasin), avant);
  const gel = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(gel); } return o; };
  const v = gel(structuredClone(await w.vecu())); const a = moyensConnus(v, BESOIN_RELATION); const b = moyensConnus(v, BESOIN_RELATION); assert.deepEqual(a, b);
});
test('N21. AUCUN APPEL d\'émission / déclencheur / tourActif / écriture : source de besoins.js (hors commentaires) ; aucune nouvelle émission ni exécution après lecture', async () => {
  const src = sansCommentaires(lu('app', 'langage', 'besoins.js'));
  for (const interdit of ['emettreLot', 'emettreProduction', 'executerApplications', 'tourActif', 'tickPropre', 'tickRepos', 'enregistrer', 'ecrire(', 'environnement-conversation', 'execution-mecanique', 'Math.random', 'Date.now', 'new Date']) assert.ok(!src.includes(interdit), `besoins.js ne doit pas contenir « ${interdit} »`);
  const { w } = await unMonde(); await w.ticks(3); const n = async () => [(await w.magasin.lireTout('emissions')).length, (await w.magasin.lireTout('executionsOperations')).length, (await w.magasin.lireTout('receptions')).length];
  const avant = await n(); await lireBesoins(w.magasin); assert.deepEqual(await n(), avant);
});
test('N22. c et r INCHANGÉS après calcul (valeur, état, nombre de variations)', async () => {
  const { w, A } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission); await w.ticks(1);
  const f = async () => { const c = await lireCapacite(w.magasin), r = await lireRelation(w.magasin); return [c.valeur, c.idEtat, c.nombreVariations, r.valeur, r.idEtat, r.nombreVariations]; };
  const avant = await f(); await lireBesoins(w.magasin); await lireBesoins(w.magasin); assert.deepEqual(await f(), avant);
});
test('N23. RECONSTRUCTION APRÈS RECHARGEMENT : base copiée (JSON) dans un magasin neuf → même résultat', async () => {
  const { w, A } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission); await w.ticks(2);
  const donnees = JSON.parse(await instantane(w.magasin)); const neuf = magasinMemoireVive(); await neuf.remplacerTout(donnees);
  assert.deepEqual(await lireBesoins(neuf), await lireBesoins(w.magasin));
});
test('N24. BASE .86 EXISTANTE : les moyens historiques sont retrouvés SANS migration (mêmes 30 tables, même base, même schéma de sauvegarde ; aucune table ajoutée)', async () => {
  const { w, A } = await unMonde(); await w.ticks(3); await w.tour('bonjour Luna', A.idEmission);
  assert.equal(TABLES.length, 30); assert.equal(VERSION_BASE, 24); assert.equal(SCHEMA_SAUVEGARDE, 14); assert.deepEqual(TABLES.slice(-2), ['relationInitiale', 'variationsRelation']);
  const ancienne = JSON.parse(await instantane(w.magasin)); assert.deepEqual(Object.keys(ancienne), [...TABLES]);
  const base = magasinMemoireVive(); await base.remplacerTout(ancienne);
  const b = (await lireBesoins(base)).find((x) => x.besoin === 'relation'); assert.deepEqual(b.moyens.map((m) => m.production), [A.idExecution]);
});
test('N25. SAUVEGARDE : aucune nouvelle donnée persistante (déclarations statiques, vues pures) — besoins.js n\'écrit rien et la lecture laisse les 30 tables identiques', async () => {
  const { w } = await unMonde(); await w.ticks(1); const avant = await instantane(w.magasin); await lireBesoins(w.magasin); assert.equal(await instantane(w.magasin), avant);
  assert.ok(!TABLES.some((t) => /besoin|moyen|motif/i.test(t)));
});
test('N26. PREUVES : plusieurs preuves conservent leurs identités RÉELLES (production, émission, réception, variation existent dans les tables)', async () => {
  const { w, A } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission); await w.ticks(1); await w.tour('bonjour Max', A.idEmission);
  const T = async (t) => new Set((await w.magasin.lireTout(t)).map((x) => x.id)); const [em, re, va, ex] = [await T('emissions'), await T('receptions'), await T('variationsRelation'), await T('executionsOperations')];
  const m = (await rel(w)).moyens[0]; assert.equal(m.preuves.length, 2);
  for (const p of m.preuves) { assert.ok(ex.has(p.production)); assert.ok(em.has(p.emission)); assert.ok(re.has(p.reception)); assert.ok(va.has(p.transformation)); assert.equal(p.operation, 'soi:reception'); assert.ok(p.valeurAvant !== 0 && p.valeurApres === 0); }
});
test('N27. CONNU ≠ POSSIBLE : plusieurs productions existent, une seule est connue ; les autres restent hors ensemble (jamais « seul moyen possible »)', async () => {
  const { w, A, emises } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission);
  const existantes = (await w.magasin.lireTout('executionsOperations')).length; const m = await rel(w);
  assert.ok(existantes > m.moyens.length); assert.equal(m.moyens.length, 1); assert.ok(emises.length > m.moyens.length);
  assert.ok(!/seul|unique|possible|solution/i.test(JSON.stringify(m)));
});
test('N28. AUCUN SCORE / POIDS / FRÉQUENCE / PRÉFÉRENCE dans la sortie : clés fermées, aucun champ numérique hors valeurs d\'état', async () => {
  const { w, A, B } = await unMonde(); await w.ticks(2); await w.tour('bonjour Luna', A.idEmission); await w.ticks(2); await w.tour('bonjour Max', B.idEmission);
  const cles = new Set(); const nombres = new Set();
  (function parcourir(o, k) { if (typeof o === 'number') nombres.add(k); else if (Array.isArray(o)) o.forEach((x) => parcourir(x, k)); else if (o && typeof o === 'object') for (const [c, v] of Object.entries(o)) { cles.add(c); parcourir(v, c); } })(await lireBesoins(w.magasin), '');
  assert.ok(![...cles].some((c) => /score|poids|weight|frequence|fréquence|compte|nombre|rang|priorit|prefer|préfér|urgence|intensit|distance|recompense|récompense|utilit/i.test(c)), [...cles].join(','));
  assert.deepEqual([...nombres].sort(), ['satiete', 'valeurActuelle', 'valeurApres', 'valeurAvant']);
});
// === FIN_TEST_BESOINS ===
