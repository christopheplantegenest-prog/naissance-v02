// === DEBUT_TEST_VECU_ORCHESTRATION_TRACES ===
// v0.49 — POINT D'ORCHESTRATION COMMUN DU VÉCU (décision ChatGPT, 03/10/2026). Vérifie que la
// branche "trace" (voie 'action' ET voie 'composition') traverse désormais apresNouveauVecu()
// (vecu.js) — { type:'trace', id }, rien de plus — SANS aucune régression observable : même texte
// renvoyé, même contenu de trace, exactement un appel, après que la trace existe déjà (persistée
// ET déjà dans e.traces). Domaine artificiel neutre (zorbo/zkelmi/zordre...), comme les autres
// chantiers "traces".
import test from 'node:test';
import assert from 'node:assert/strict';
import { apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { evaluerAction } from '../app/langage/action.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
function monterEcran({ apresNouveauVecu } = {}) {
  const magasin = magasinMemoireVive();
  const opts = { zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true };
  if (apresNouveauVecu) opts.apresNouveauVecu = apresNouveauVecu;
  return { magasin, ecran: monterEcranLangage(opts) };
}

const EXEMPLES_ACCESSIBILITE = [
  'zaccede zorbo zordre zkelmi',
  'zaccede zfulgo zordre zkelmi',
  'zaccede zorbo zinverse zkelmi',
  'zaccede zorbo zordre zvex',
];

async function apprendreActionAccessibilite(ecran) {
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples: EXEMPLES_ACCESSIBILITE });
  assert.equal(evalue.statut, 'validee');
  await ecran.confirmerAction({ operation: 'accessibilite', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut });
}

test('voie action : apresNouveauVecu({type:"trace",id}) est appelé exactement une fois, APRÈS que la trace existe déjà', async () => {
  const appels = [];
  const { ecran } = monterEcran({ apresNouveauVecu: async (evt) => { appels.push(evt); } });
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreActionAccessibilite(ecran);

  const reco = await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zkelmi');
  assert.equal(reco.ok, true);

  const trace = esprit.traces.at(-1);
  assert.equal(appels.length, 1);
  assert.deepEqual(appels[0], { type: 'trace', id: trace.id });
});

test('voie composition : apresNouveauVecu({type:"trace",id}) est appelé exactement une fois', async () => {
  const appels = [];
  const { ecran } = monterEcran({ apresNouveauVecu: async (evt) => { appels.push(evt); } });
  const r = await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  assert.equal(r.ok, true);

  const esprit = await ecran.assurerEsprit();
  const trace = esprit.traces.at(-1);
  assert.equal(trace.voie, 'composition');
  assert.equal(appels.length, 1);
  assert.deepEqual(appels[0], { type: 'trace', id: trace.id });
});

test('aucune régression : le texte renvoyé par une invocation réussie (voie action) est inchangé', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreActionAccessibilite(ecran);
  const reco = await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zkelmi');
  assert.equal(reco.texte, 'Résultat (accessibilité locale) : accessible.');
});

test('aucune régression : sans injection explicite, la vraie apresNouveauVecu() (vecu.js) est utilisée par défaut et n\'empêche rien', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreActionAccessibilite(ecran);
  const reco = await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zkelmi');
  assert.equal(reco.ok, true);
  assert.equal(esprit.traces.length, 1);
});

test('échecs : action non reconnue, ambiguë ou invocation échouée ne déclenchent toujours aucun événement "trace"', async () => {
  const appels = [];
  const { ecran } = monterEcran({ apresNouveauVecu: async (evt) => { appels.push(evt); } });
  const esprit = await ecran.assurerEsprit();
  // Action non reconnue (rien enseigné) : reconnu=false, aucune trace, aucun événement.
  const reco1 = await ecran.tenterReconnaissanceAction('phrase totalement inconnue zzz');
  assert.equal(reco1.reconnu, false);
  assert.equal(appels.length, 0);
  assert.equal(esprit.traces.length, 0);
});
// === FIN_TEST_VECU_ORCHESTRATION_TRACES ===
