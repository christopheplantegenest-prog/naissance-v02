// === DEBUT_TEST_DEDUCTION_ACTION ===
// v0.42 — DÉCISION CHATGPT « DÉDUCTION DÉTERMINISTE MULTI-FAITS » (02/10). La nouvelle capacité du
// registre (deduction — deduction.js) RECONNUE et INVOQUÉE via le même mécanisme générique B1/B2 que
// « confrontation »/« proprietesCommunes »/« recherche » (v0.38/v0.41) : AUCUN changement nécessaire
// à action.js, ni à l'extraction B1 — mêmes formes de rôles simples, à un seul jeton par position
// variable. Ce fichier mime exactement tests/selection-action.test.mjs, limité à la nouvelle
// capacité (le reste du contrat — opération inconnue, rôles dupliqués/manquants/en trop, incertitude,
// ambiguïté — est déjà couvert dans tests/action-apprise.test.mjs et n'a pas besoin d'être redit ici).
//
// Les RÈGLES et les FAITS eux-mêmes sont posés directement via apprendreRegle()/apprendreFait()
// (mécanismes déjà existants et déjà testés ailleurs — tests/deduction.test.mjs pour la primitive
// deduire() elle-même) : seule la capacité « deduction » (l'ACTION apprise qui la rend joignable
// depuis une phrase) est sous test ici.
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zrole...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait, apprendreRegle } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { apprendreAction } from '../app/langage/connaissances.js';
import { deduire } from '../app/langage/deduction.js';
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
// deduction — apprise, reconnue, invoquée, résultat identique à l'appel direct
// ---------------------------------------------------------------------------------------------
const EXEMPLES_DEDUCTION = [
  'zdeduit zorbo zrole1',
  'zdeduit zkelmi zrole1', // position 0 seule varie par rapport au premier
  'zdeduit zorbo zrole2', // position 1 seule varie par rapport au premier
];

test('deduction : apprise avec les rôles (sujet, role) → validée', () => {
  const r = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: EXEMPLES_DEDUCTION });
  assert.equal(r.ok, true);
  assert.equal(r.statut, 'validee');
});

test('deduction : rôle manquant → refus (même garde-fou générique que confrontation)', () => {
  const r = evaluerAction({ operation: 'deduction', roles: ['sujet'], exemples: EXEMPLES_DEDUCTION });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'roles_incorrects');
});

test('deduction : invocation depuis une phrase apprise → résultat identique à l\'appel direct', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRegle(esprit, {
    role: 'zrole1', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zfroid',
  });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });

  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: EXEMPLES_DEDUCTION });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'deduction' });
  assert.equal(action.statut, 'validee');

  const r = invoquerAction(action, esprit, 'zdeduit zorbo zrole1');
  assert.equal(r.ok, true);
  const attendu = deduire(esprit, { sujet: 'zorbo', role: 'zrole1' });
  assert.deepEqual(r.resultat, attendu);
  assert.equal(r.resultat.resultat, 'zfroid');
});

test('deduction : invocation sans règle applicable → résultat honnête, jamais une erreur ni un résultat deviné', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zrouge' });

  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: EXEMPLES_DEDUCTION });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'deduction' });

  const r = invoquerAction(action, esprit, 'zdeduit zorbo zroleInconnu');
  assert.equal(r.ok, true);
  assert.equal(r.resultat.resultat, null);
  assert.ok(!r.resultat.conflit);
});

test('deduction : reconnue par reconnaitreActions() une fois validée', async () => {
  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: EXEMPLES_DEDUCTION });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'deduction' });
  const reco = reconnaitreActions([action], 'zdeduit zorbo zrole1');
  assert.equal(reco.etat, 'unique');
  assert.equal(reco.action.operation, 'deduction');
});

// ---------------------------------------------------------------------------------------------
// RACCORD CONVERSATIONNEL BOUT EN BOUT (ecran.js : confirmerAction/tenterReconnaissanceAction, même
// mécanisme générique que B3/v0.39/v0.41 — preuve que cette capacité est réellement testable depuis
// la conversation, sans aucun changement à ecran.js/main.js).
// ---------------------------------------------------------------------------------------------
test('RACCORD — deduction enseignée puis invoquée via le canal pédagogique réel (confirmerAction/tenterReconnaissanceAction)', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreRegle(esprit, {
    role: 'zrole1',
    conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }, { propriete: 'ztaille', valeur: 'zgrand' }],
    resultat: 'zvoilier',
  });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'ztaille', valeur: 'zgrand' });

  const evalue = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: EXEMPLES_DEDUCTION });
  assert.equal(evalue.statut, 'validee');
  const conf = await ecran.confirmerAction({
    operation: 'deduction', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  assert.match(conf.explication, /J'ai appris/);

  const reco = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  assert.equal(reco.reconnu, true);
  assert.equal(reco.ok, true);
  assert.match(reco.texte, /déduction locale/);
  assert.match(reco.texte, /zvoilier/);
});

test('RACCORD — deduction invoquée sans règle applicable → texte honnête, jamais une incompréhension', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zrouge' });

  const evalue = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: EXEMPLES_DEDUCTION });
  await ecran.confirmerAction({
    operation: 'deduction', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });

  const rien = await ecran.tenterReconnaissanceAction('zdeduit zorbo zroleInconnu');
  assert.equal(rien.ok, true);
  assert.match(rien.texte, /aucune règle applicable/);
});
// === FIN_TEST_DEDUCTION_ACTION ===
