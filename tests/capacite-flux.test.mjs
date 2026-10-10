// === DEBUT_TEST_CAPACITE_FLUX ===
// v0.63.84 — B1 DANS LE FLUX RÉEL (décision ChatGPT « SONDE 1 VALIDÉE — INTÉGRATION DE B1 », 10/10/2026). Harnais = câblage exact de main.js :
// observation → porte « c === 0 ? » → lot mécanique (inchangé à c > 0) → émissions → tour actif (contextes/attentes sur soi, puis variation) ;
// bouton « Repos » = tickRepos. Vérifie : lot IDENTIQUE avec et sans B1 tant que c > 0 (aucun biais par l'ordre du lot : le lot a lieu entièrement
// ou pas du tout) ; porte à c = 0 (observation écrite, aucune désignation, exécution, émission ni variation) ; récupération uniquement par repos ;
// attentes sur soi présentées dans la bulle (attentes-du-tour) ; attentes du monde inchangées ; rien de soi dans les tables du monde ; redémarrage.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { emettreLot } from '../app/langage/environnement-conversation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES } from '../app/langage/connaissances.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { lireCapacite, tourActif, tickRepos, PARAMETRES_B1 } from '../app/langage/capacite.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { identiteEtatApres } from '../app/langage/projection-soi.js';

let compteur = 0;
// avecB1 = true : câblage de main.js v0.63.84 ; false : câblage v0.63.83 (aucune porte, aucune variation).
function monde(avecB1, magasin = magasinMemoireVive()) {
  const nouvelId = (p) => `${p}-${++compteur}`;
  const tours = [];
  async function tour(texte) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      if (!avecB1) {
        const lot = await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
        const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
        return { ...lot, emises, echecEmission: echec };
      }
      const capaciteAvant = await lireCapacite(magasin);
      const porte = capaciteAvant.valeur === 0;
      const lot = porte ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      let capacite = { avant: capaciteAvant.valeur, apres: capaciteAvant.valeur, plafond: PARAMETRES_B1.plafond, porte, variation: null, echec: null };
      if (lot.resultats.some((r) => r && r.statut === 'executee')) {
        try { const t = await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage }); capacite = { ...capacite, apres: t.apres, variation: t.variation }; } catch (e) { capacite = { ...capacite, echec: e }; }
      }
      return { ...lot, emises, echecEmission: echec, capacite };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    tours.push({ texte, s });
    return s;
  }
  const repos = () => tickRepos(magasin);
  const photo = async () => { const t = {}; for (const nom of TABLES) t[nom] = await magasin.lireTout(nom); return t; };
  return { magasin, tour, tours, repos, photo };
}
const MESSAGES = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const resume = (s) => ({ auto: s.automatiques.map((r) => [r.operation, r.statut]), choix: [...s.choixAFaire], emises: s.emises.map((e) => e.operation) });

test('A. SANS BIAIS PAR L\'ORDRE DU LOT : tant que c > 0 (3 premiers tours), applications, ordre, statuts, classes à choisir et émissions sont IDENTIQUES avec et sans B1 ; les attentes du monde (jalon 1) sont identiques ; chaque tour actif écrit exactement une variation « tour » de cause = observation', async () => {
  const sans = monde(false); const avec = monde(true);
  for (const m of MESSAGES.slice(0, 3)) { await sans.tour(m); await avec.tour(m); }
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(resume(avec.tours[i].s), resume(sans.tours[i].s));
    const monde_ = (a) => a.filter((x) => !x.operation.startsWith('soi:')).map((x) => [x.operation, x.chemin, x.constat, x.issue ? x.issue.statut : null]);
    assert.deepEqual(monde_(avec.tours[i].s.attentes), monde_(sans.tours[i].s.attentes));
    const c = avec.tours[i].s.capacite;
    assert.equal(c.porte, false); assert.equal(c.avant, 3 - i); assert.equal(c.apres, 2 - i); assert.equal(c.plafond, 3);
    assert.equal(c.variation.cause.type, 'tour'); assert.equal(c.variation.cause.id, avec.tours[i].s.observation.id); assert.equal(c.echec, null);
  }
  assert.deepEqual(avec.tours.map((t) => t.s.automatiques.length), [2, 4, 9]);
  const p = await avec.photo();
  assert.equal(p.variationsCapacite.length, 3); assert.equal(p.capaciteInitiale.length, 1); assert.equal(p.capaciteInitiale[0].valeur, 3);
  assert.equal((await sans.photo()).variationsCapacite.length, 0);
  assert.equal(sans.tours[0].s.capacite, null);
});

test('B. PORTE À c = 0 : le 4e tour est OBSERVÉ (observation écrite, univers, classes à choisir) mais aucun acte mécanique : aucune désignation, aucune exécution, aucune émission, aucune variation ; c reste 0 ; un 5e message à c = 0 : même chose (un message n\'est pas un repos)', async () => {
  const w = monde(true);
  for (const m of MESSAGES.slice(0, 3)) await w.tour(m);
  const avant = await w.photo();
  const s4 = await w.tour(MESSAGES[3]);
  const apres = await w.photo();
  assert.equal(s4.capacite.porte, true); assert.equal(s4.capacite.avant, 0); assert.equal(s4.capacite.apres, 0); assert.equal(s4.capacite.variation, null);
  assert.deepEqual(s4.automatiques, []); assert.deepEqual(s4.emises, []); assert.ok(s4.univers.length > 0); assert.ok(s4.choixAFaire.length > 0);
  assert.equal(apres.observationsPossibilites.length, avant.observationsPossibilites.length + 1);
  assert.equal(apres.valeursDonnees.length, avant.valeursDonnees.length + 1);
  for (const t of ['designations', 'executionsOperations', 'emissions', 'receptions', 'variationsCapacite', 'contextesProspectifs', 'attentesProspectives']) assert.equal(apres[t].length, avant[t].length, t);
  const s5 = await w.tour(MESSAGES[4]);
  assert.equal(s5.capacite.porte, true); assert.equal((await lireCapacite(w.magasin)).valeur, 0);
  assert.equal((await w.photo()).variationsCapacite.length, 3);
  // les applications déterminées restent présentées (sollicitation extérieure possible, hors B1) : rien n'est retiré de l'univers
  assert.ok(s5.applications.length + s5.choixAFaire.length > 0);
});

test('C. RÉCUPÉRATION UNIQUEMENT PAR REPOS, PUIS REPRISE SANS RÈGLE : repos → c = 1 → le message suivant agit à nouveau (lot complet, émissions) → c = 0 ; 3 repos → 3 ; repos à 3 → 3 (saturation, variation egale)', async () => {
  const w = monde(true);
  for (const m of MESSAGES.slice(0, 3)) await w.tour(m);
  await w.tour(MESSAGES[3]);
  const r = await w.repos(); assert.equal(r.avant, 0); assert.equal(r.apres, 1); assert.equal(r.variation.cause.type, 'repos');
  const s = await w.tour(MESSAGES[4]);
  assert.equal(s.capacite.porte, false); assert.equal(s.capacite.avant, 1); assert.equal(s.capacite.apres, 0);
  assert.ok(s.automatiques.filter((x) => x.statut === 'executee').length >= 1); assert.equal(s.emises.length, s.automatiques.filter((x) => x.statut === 'executee').length);
  const r2 = await w.repos(); const r3 = await w.repos(); const r4 = await w.repos(); const r5 = await w.repos();
  assert.deepEqual([r2.apres, r3.apres, r4.apres, r5.apres], [1, 2, 3, 3]); assert.equal(r5.avant, 3);
  const c = await lireCapacite(w.magasin); assert.equal(c.valeur, 3); assert.equal(c.nombreVariations, 9); assert.equal(c.idEtat, identiteEtatApres(r5.variation));
});

test('D. ATTENTES SUR SOI AVANT L\'ISSUE, PRÉSENTÉES DANS LA BULLE : dès le 3e tour actif, la zone des attentes du tour porte « soi:tour — relationValeur = differente → realisee », écrite avant la variation ; le vécu contient les exécutions soi et les données d\'état déclarées, hors univers du tour', async () => {
  const w = monde(true);
  const s1 = await w.tour(MESSAGES[0]); const s2 = await w.tour(MESSAGES[1]); const s3 = await w.tour(MESSAGES[2]);
  assert.equal(s1.attentes.filter((a) => a.operation === 'soi:tour').length, 0);
  assert.equal(s2.attentes.filter((a) => a.operation === 'soi:tour').length, 0);
  const soi = s3.attentes.filter((a) => a.operation === 'soi:tour');
  assert.ok(soi.length >= 1);
  const rel = soi.find((a) => a.chemin === 'relationValeur');
  assert.ok(rel); assert.deepEqual(rel.constat, { type: 'chaine', valeur: 'differente' }); assert.equal(rel.issue.statut, 'realisee'); assert.equal(rel.issue.idExecution, s3.capacite.variation.id);
  assert.equal(rel.idDesignation, s3.observation.id); assert.ok(rel.horodatageAttente <= s3.capacite.variation.horodatage);
  const v = await lireExecutionsVecues(w.magasin);
  assert.equal(v.executions.filter((e) => e.operation === 'soi:tour').length, 3);
  assert.equal(v.valeurs.filter((l) => l.source).length, 4); assert.equal(v.valeurs.filter((l) => !l.source).length, 3);
  // l'état propre n'entre pas dans l'univers du tour (observation .16 : message courant + productions réelles)
  assert.equal(s3.univers.some((u) => u.donnee.identite.startsWith('etat-propre-') || u.donnee.identite.startsWith('variation-capacite-') || u.donnee.identite.startsWith('capacite-initiale-')), false);
});

test('E. RIEN DE SOI DANS LES TABLES DU MONDE ; les exécutions soi ne sont dans aucune table ; redémarrage (nouveau magasin, mêmes lignes) : même capacité, même porte, même vécu', async () => {
  const w = monde(true);
  for (const m of MESSAGES.slice(0, 4)) await w.tour(m);
  await w.repos();
  const p = await w.photo();
  const soi = (l) => JSON.stringify(l).includes('soi:') || JSON.stringify(l).includes('etat-propre-');
  for (const t of ['valeursDonnees', 'executionsOperations', 'designations', 'emissions', 'receptions', 'observationsPossibilites']) assert.equal(p[t].some(soi), false, t);
  assert.equal(p.executionsOperations.some((e) => e.operation.startsWith('soi:')), false);
  assert.ok(p.contextesProspectifs.some((c) => c.application.operation === 'soi:tour'));
  // redémarrage
  const autre = magasinMemoireVive();
  for (const t of TABLES) for (const ligne of [...p[t]].reverse()) await autre.ecrire(t, JSON.parse(JSON.stringify(ligne)));
  const a = await lireCapacite(w.magasin); const b = await lireCapacite(autre);
  assert.deepEqual(b, a); assert.equal(a.valeur, 1);
  const vA = await lireExecutionsVecues(w.magasin); const vB = await lireExecutionsVecues(autre);
  const tri = (l) => [...l].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(tri(vB.executions), tri(vA.executions)); assert.deepEqual(tri(vB.valeurs), tri(vA.valeurs)); assert.deepEqual(vB.descriptions, vA.descriptions);
  // la suite continue à l'identique sur le magasin redémarré : un message agit (c = 1 → 0)
  const w2 = monde(true, autre);
  const s = await w2.tour(MESSAGES[4]);
  assert.equal(s.capacite.avant, 1); assert.equal(s.capacite.apres, 0); assert.equal(s.capacite.porte, false);
});
// === FIN_TEST_CAPACITE_FLUX ===
