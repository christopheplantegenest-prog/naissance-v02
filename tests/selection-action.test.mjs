// === DEBUT_TEST_SELECTION_ACTION ===
// v0.41 — DÉCISION CHATGPT « PROCHAINE CAPACITÉ GÉNÉRALE DE RAISONNEMENT » (02/10). Les deux
// nouvelles capacités du registre (proprietesCommunes, recherche — selection.js) RECONNUES et
// INVOQUÉES via le même mécanisme générique B1/B2 que « confrontation » (v0.38) : AUCUN changement
// nécessaire à action.js, ni à l'extraction B1 — mêmes formes de rôles simples, à un seul jeton par
// position variable. Ce fichier mime exactement tests/action-apprise.test.mjs, limité aux deux
// nouvelles capacités (le reste du contrat — opération inconnue, rôles dupliqués/manquants/en trop,
// incertitude, ambiguïté — est déjà couvert là-bas et n'a pas besoin d'être redit ici).
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zcouleur...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { apprendreAction } from '../app/langage/connaissances.js';
import { proprietesCommunes, sujetsAvec } from '../app/langage/selection.js';
import { evaluerAction, invoquerAction, reconnaitreActions } from '../app/langage/action.js';
import { monterEcranLangage } from '../app/langage/ecran.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
function monterEcran(magasin = magasinMemoireVive()) {
  return { magasin, ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true }) };
}

// ---------------------------------------------------------------------------------------------
// proprietesCommunes — apprise, reconnue, invoquée, résultat identique à l'appel direct
// ---------------------------------------------------------------------------------------------
const EXEMPLES_COMMUNES = [
  'zcommun zorbo zkelmi',
  'zcommun ztoro zkelmi', // position 0 seule varie par rapport au premier
  'zcommun zorbo zautre', // position 1 seule varie par rapport au premier
];

test('proprietesCommunes : apprise avec les rôles (sujetA, sujetB) → validée', () => {
  const r = evaluerAction({ operation: 'proprietesCommunes', roles: ['sujetA', 'sujetB'], exemples: EXEMPLES_COMMUNES });
  assert.equal(r.ok, true);
  assert.equal(r.statut, 'validee');
});

test('proprietesCommunes : rôle manquant → refus (même garde-fou générique que confrontation)', () => {
  const r = evaluerAction({ operation: 'proprietesCommunes', roles: ['sujetA'], exemples: EXEMPLES_COMMUNES });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'roles_incorrects');
});

test('proprietesCommunes : invocation depuis une phrase apprise → résultat identique à l\'appel direct', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'ztaille', valeur: 'zgrand' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'ztaille', valeur: 'zpetit' });

  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'proprietesCommunes', roles: ['sujetA', 'sujetB'], exemples: EXEMPLES_COMMUNES });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'proprietesCommunes' });
  assert.equal(action.statut, 'validee');

  const r = invoquerAction(action, esprit, 'zcommun zorbo zkelmi');
  assert.equal(r.ok, true);
  const attendu = proprietesCommunes(esprit, { sujetA: 'zorbo', sujetB: 'zkelmi' });
  assert.deepEqual(r.resultat, attendu);
  assert.deepEqual(r.resultat.identiques.map((x) => x.relation), ['zcouleur']);
  assert.deepEqual(r.resultat.differentes.map((x) => x.relation), ['ztaille']);
});

test('proprietesCommunes : reconnue par reconnaitreActions() une fois validée', async () => {
  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'proprietesCommunes', roles: ['sujetA', 'sujetB'], exemples: EXEMPLES_COMMUNES });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'proprietesCommunes' });
  const reco = reconnaitreActions([action], 'zcommun zorbo zkelmi');
  assert.equal(reco.etat, 'unique');
  assert.equal(reco.action.operation, 'proprietesCommunes');
});

// ---------------------------------------------------------------------------------------------
// recherche — apprise, reconnue, invoquée, résultat identique à l'appel direct
// ---------------------------------------------------------------------------------------------
const EXEMPLES_RECHERCHE = [
  'zcherche zcouleur zrouge',
  'zcherche ztaille zrouge', // position 0 seule varie
  'zcherche zcouleur zbleu', // position 1 seule varie
];

test('recherche : apprise avec les rôles (relation, valeur) → validée', () => {
  const r = evaluerAction({ operation: 'recherche', roles: ['relation', 'valeur'], exemples: EXEMPLES_RECHERCHE });
  assert.equal(r.ok, true);
  assert.equal(r.statut, 'validee');
});

test('recherche : invocation depuis une phrase apprise → résultat identique à l\'appel direct, y compris liste vide', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'rouge' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'rouge' });
  await apprendreFait(esprit, { sujet: 'ztoro', relation: 'zcouleur', valeur: 'bleu' });

  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'recherche', roles: ['relation', 'valeur'], exemples: EXEMPLES_RECHERCHE });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'recherche' });
  assert.equal(action.statut, 'validee');

  const r = invoquerAction(action, esprit, 'zcherche zcouleur rouge');
  assert.equal(r.ok, true);
  assert.deepEqual(r.resultat, { sujets: sujetsAvec(esprit, { relation: 'zcouleur', valeur: 'rouge' }) });
  assert.deepEqual(r.resultat.sujets.sort(), ['zkelmi', 'zorbo']);

  const rVide = invoquerAction(action, esprit, 'zcherche zcouleur zjaune');
  assert.equal(rVide.ok, true);
  assert.deepEqual(rVide.resultat.sujets, [], 'aucun sujet trouvé : une liste vide, jamais un refus');
});

test('recherche : opération absente de l\'enseignement ne gêne jamais "proprietesCommunes" ni "confrontation" : deux actions de capacités différentes coexistent sans ambiguïté', async () => {
  const magasin = magasinMemoireVive();
  const evalueCommunes = evaluerAction({ operation: 'proprietesCommunes', roles: ['sujetA', 'sujetB'], exemples: EXEMPLES_COMMUNES });
  const { objet: actionCommunes } = await apprendreAction(magasin, { ...evalueCommunes, operation: 'proprietesCommunes' });
  const evalueRecherche = evaluerAction({ operation: 'recherche', roles: ['relation', 'valeur'], exemples: EXEMPLES_RECHERCHE });
  const { objet: actionRecherche } = await apprendreAction(magasin, { ...evalueRecherche, operation: 'recherche' });

  const actions = [actionCommunes, actionRecherche];
  assert.equal(reconnaitreActions(actions, 'zcommun zorbo zkelmi').action.operation, 'proprietesCommunes');
  assert.equal(reconnaitreActions(actions, 'zcherche zcouleur rouge').action.operation, 'recherche');
});
// ---------------------------------------------------------------------------------------------
// RACCORD CONVERSATIONNEL BOUT EN BOUT (ecran.js : confirmerAction/tenterReconnaissanceAction, même
// mécanisme générique que B3/v0.39 pour « confrontation » — preuve que ces deux nouvelles capacités
// sont réellement testables depuis la conversation, sans aucun changement à ecran.js/main.js).
// ---------------------------------------------------------------------------------------------
test('RACCORD — proprietesCommunes enseignée puis invoquée via le canal pédagogique réel (confirmerAction/tenterReconnaissanceAction)', async () => {
  const { magasin, ecran } = monterEcran();
  await apprendreFait(await ecran.assurerEsprit(), { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(await ecran.assurerEsprit(), { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });

  const evalue = evaluerAction({ operation: 'proprietesCommunes', roles: ['sujetA', 'sujetB'], exemples: EXEMPLES_COMMUNES });
  assert.equal(evalue.statut, 'validee');
  const conf = await ecran.confirmerAction({
    operation: 'proprietesCommunes', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  assert.match(conf.explication, /J'ai appris/);

  const reco = await ecran.tenterReconnaissanceAction('zcommun zorbo zkelmi');
  assert.equal(reco.reconnu, true);
  assert.equal(reco.ok, true);
  assert.match(reco.texte, /propriétés communes/);
  assert.match(reco.texte, /identiques \(zcouleur\)/);
});

test('RACCORD — recherche enseignée puis invoquée, y compris le cas "aucun sujet trouvé" (jamais une incompréhension)', async () => {
  const { ecran } = monterEcran();
  await apprendreFait(await ecran.assurerEsprit(), { sujet: 'zorbo', relation: 'zcouleur', valeur: 'rouge' });

  const evalue = evaluerAction({ operation: 'recherche', roles: ['relation', 'valeur'], exemples: EXEMPLES_RECHERCHE });
  await ecran.confirmerAction({
    operation: 'recherche', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });

  const trouve = await ecran.tenterReconnaissanceAction('zcherche zcouleur rouge');
  assert.equal(trouve.ok, true);
  assert.match(trouve.texte, /zorbo/);

  const rien = await ecran.tenterReconnaissanceAction('zcherche zcouleur jaune');
  assert.equal(rien.ok, true);
  assert.match(rien.texte, /aucun sujet trouvé/);
});
// === FIN_TEST_SELECTION_ACTION ===
