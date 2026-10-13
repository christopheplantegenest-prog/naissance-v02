// v0.64.2 — FONDATION DANS L'EXPÉRIENCE D'ATTENTE (décision ChatGPT « DÉCISION v0.64.2 », 13/10/2026).
// experiencesDAttentes expose la fondation d'une attente conditionnée (copie sans transformation) ; une attente .74 n'en reçoit aucune.
// Cas 55/77 (K9→77, Q4→55, K9→?) avec réponses 77 / 55 / 99 ; immutabilité K0/K1 ; regroupement ; sonde « primitives existantes ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { experiencesDAttentes, elementsDExperiences, regrouperExperiences } from '../app/langage/experiences-attentes.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { partagerCouvertures } from '../app/langage/partition-couvertures.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';

// Monde réel ; avant chaque message, repos jusqu'au plafond (comme le protocole du téléphone).
function monde() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); await consequenceReception(magasin, d.reception); await traiterOccasion(magasin, d.reception.id); }
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function repos() { for (let c = await lireCapacite(magasin); c.valeur < 3; c = await lireCapacite(magasin)) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  async function message(texte, idEmission = null) {
    await repos();
    const avant = (await magasin.lireTout('emissions')).length;
    await tour(texte, idEmission);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).slice(avant).filter((e) => ex.find((q) => q.id === e.idExecution).operation === 'symbolesDeChaine').at(-1);
  }
  async function experiences() {
    const v = await lireExecutionsVecues(magasin);
    return experiencesDAttentes(await magasin.lireTout('attentesProspectives'), await magasin.lireTout('contextesProspectifs'), v.valeurs, v.executions, v.descriptions);
  }
  return { magasin, message, experiences };
}
async function cas5577() {
  const w = monde();
  for (const [x, y] of [['K9', '77'], ['Q4', '55']]) { const E = await w.message(x); await w.message(y, E.id); }
  const E = await w.message('K9');
  return { w, E };
}
// MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : l'expérience porte avant.description (dont structure et chemin, l'ancien critère) et avant.preuve (dont la fondation) ; la ligne persistée
// porte description / preuve / references.
const surArrivee = (E) => (a) => a.idDesignation === E.id && a.avant.description.chemin.join('.') === 'valeurs.arrivee' && a.avant.description.structure.length === 2;
const lignesArrivee = async (w, E) => (await w.magasin.lireTout('attentesProspectives')).filter((a) => a.references.idDesignation === E.id && a.description.chemin.join('.') === 'valeurs.arrivee' && a.description.structure.length === 2);

test('55/77 : réponses 77 / 55 / 99 — deux expériences distinctes sur le même critère ; la conditionnée porte sa fondation K9 ↔ 77 (copie exacte de la ligne), la .74 n’en porte aucune', async () => {
  for (const [reponse, s74, sCond] of [['77', 'autre', 'realisee'], ['55', 'realisee', 'autre'], ['99', 'autre', 'autre']]) {
    const { w, E } = await cas5577();
    const lignes = await lignesArrivee(w, E);
    assert.deepEqual(lignes.map((a) => [Object.hasOwn(a.preuve, 'fondation'), a.description.constat.valeur]).sort(), [[false, '55'], [true, '77']]);
    await w.message(reponse, E.id);
    const { experiences } = await w.experiences();
    const deux = experiences.filter(surArrivee(E));
    assert.equal(deux.length, 2);
    const u = deux.find((e) => !Object.hasOwn(e.avant.preuve, 'fondation')); const c = deux.find((e) => Object.hasOwn(e.avant.preuve, 'fondation'));
    assert.deepEqual([u.avant.description.constat.valeur, u.apres.statut, u.apres.reel.valeur], ['55', s74, reponse], reponse);
    assert.deepEqual([c.avant.description.constat.valeur, c.apres.statut, c.apres.reel.valeur], ['77', sCond, reponse], reponse);
    assert.deepEqual(c.avant.preuve.fondation, lignes.find((a) => a.preuve.fondation).preuve.fondation, 'fondation recopiée sans transformation');
    assert.deepEqual(c.avant.preuve.fondation[0].conditions.map((k) => [k.chemin.join('.'), k.valeur]), [['valeurs.depart', 'K9']]);
    assert.deepEqual(c.avant.preuve.fondation[0].constats.map((k) => `${k.chemin.join('.')}=${k.valeur}`).sort(), ['valeurs.arrivee=77', 'valeurs.depart=K9']);
    // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : avant = { description, preuve } ; .74 : ni relation ni fondation ; conditionnée : relation dans la description, fondation dans la preuve
    assert.deepEqual([Object.keys(u.avant), Object.keys(u.avant.description), Object.keys(u.avant.preuve)], [['description', 'preuve'], ['structure', 'chemin', 'constat'], ['temoinsContexte', 'unitesIssues']], 'forme .74');
    assert.deepEqual([Object.keys(c.avant), Object.keys(c.avant.description), Object.keys(c.avant.preuve)], [['description', 'preuve'], ['structure', 'chemin', 'constat', 'relation'], ['temoinsContexte', 'unitesIssues', 'fondation']]); // MISE À JOUR DÉLIBÉRÉE v0.64.5 : + relation (description structurée, persistée à K0)
    assert.deepEqual([u.avant.description.structure, u.avant.description.chemin], [c.avant.description.structure, c.avant.description.chemin], 'même critère (structure, chemin) : seule la fondation et le constat les distinguent');
  }
});

test('K0/K1 : la fondation de l’expérience est celle de l’attente écrite AVANT la réponse ; une réponse et des échanges ultérieurs ne la changent jamais', async () => {
  const { w, E } = await cas5577();
  const k0 = structuredClone((await lignesArrivee(w, E)).find((a) => a.preuve.fondation).preuve.fondation); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  await w.message('77', E.id);
  const k1 = (await w.experiences()).experiences.find((e) => surArrivee(E)(e) && e.avant.preuve.fondation);
  assert.deepEqual(k1.avant.preuve.fondation, k0);
  // la suite de l'histoire change la famille (K9 → 88 rend la classe K9 ↔ 77 inexacte pour l'avenir) ; l'expérience passée reste fondée sur K0
  const E2 = await w.message('K9'); await w.message('88', E2.id); await w.message('Q4');
  const k2 = (await w.experiences()).experiences.find((e) => e.id === k1.id);
  assert.deepEqual(k2.avant.preuve.fondation, k0);
  assert.equal(k2.apres.statut, 'realisee');
  assert.deepEqual((await lignesArrivee(w, E2)).filter((a) => a.preuve.fondation).map((a) => a.description.constat.valeur), ['77'], 'K9 n°3, formé avant sa réponse 88 : classe K9 ↔ 77 de l’histoire antérieure');
});

test('REGROUPEMENT : regrouperExperiences inchangée — un sélecteur sur « avant.fondation » est refusé quand une expérience n’en a pas (aucune valeur absente inventée) ; sur les seules conditionnées, chaque fondation complète est sa propre clé ; le sélecteur « avant » sépare les deux sources', async () => {
  const { w, E } = await cas5577();
  await w.message('77', E.id);
  const { experiences } = await w.experiences();
  // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : la fondation est lue à avant.preuve.fondation ; l'ancien critère est [avant.description.structure, avant.description.chemin]
  assert.throws(() => regrouperExperiences(experiences, [['avant', 'preuve', 'fondation']]), TypeError);
  const cond = experiences.filter((e) => Object.hasOwn(e.avant.preuve, 'fondation'));
  assert.ok(cond.length > 0);
  const g = regrouperExperiences(cond, [['avant', 'preuve', 'fondation']]);
  assert.ok(g.every((x) => x.experiences.every((e) => JSON.stringify(e.avant.preuve.fondation) === JSON.stringify(x.cle[0]))));
  const deux = experiences.filter(surArrivee(E));
  assert.equal(regrouperExperiences(deux, [['avant', 'description', 'structure'], ['avant', 'description', 'chemin']]).length, 1);
  assert.equal(regrouperExperiences(deux, [['avant']]).length, 2);
});

test('SONDE « PRIMITIVES EXISTANTES » : constatsParChemin sur les éléments d’expérience rend la PRÉSENCE de la fondation comme couverture ; partagerCouvertures la croise avec le statut — « fondée ainsi → réalisée » se distingue de « fondée autrement → autre » sans score ni compteur', async () => {
  const { w, E } = await cas5577();
  await w.message('77', E.id);
  const { experiences } = await w.experiences();
  const cpc = constatsParChemin(elementsDExperiences(experiences));
  const au = (ch) => cpc.chemins.find((c) => JSON.stringify(c.chemin) === JSON.stringify(ch));
  const presence = au(['avant', 'preuve', 'fondation']).constats.flatMap((c) => c.couverture); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  const statut = (v) => au(['apres', 'statut']).constats.find((c) => c.valeur === v).couverture;
  const idCond = experiences.find((e) => surArrivee(E)(e) && e.avant.preuve.fondation).id;
  const id74 = experiences.find((e) => surArrivee(E)(e) && !e.avant.preuve.fondation).id;
  assert.ok(partagerCouvertures(presence, statut('realisee')).communs.some((t) => t[0] === idCond));
  const sansFondation = partagerCouvertures(cpc.universelle, presence).seulementA;
  assert.ok(partagerCouvertures(sansFondation, statut('autre')).communs.some((t) => t[0] === id74));
  // la condition elle-même est un constat ordinaire, avec sa couverture
  const conditions = au(['avant', 'preuve', 'fondation', 0, 'conditions', 0, 'valeur']).constats;
  assert.ok(conditions.some((c) => c.valeur === 'K9' && c.couverture.some((t) => t[0] === idCond)));
});
