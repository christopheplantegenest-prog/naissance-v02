// === DEBUT_TEST_COMPOSITION_ECRAN ===
// v0.43 — DÉCISION CHATGPT « RÉFÉRENÇABILITÉ ET RÉUTILISATION SCALAIRE DES RÉSULTATS » (02/10).
// RACCORD CONVERSATIONNEL BOUT EN BOUT (ecran.js : confirmerLiaison/invoquerComposition, et le
// crochet générique dans tenterReconnaissanceAction), même mécanisme général que B3/v0.39/v0.41/v0.42
// -- preuve que ce mécanisme est réellement testable depuis la conversation, sans aucun changement à
// action.js/main.js au-delà des nouveaux marqueurs structurels. Ce fichier mime la structure de
// tests/selection-action.test.mjs et tests/deduction-action.test.mjs.
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zrole...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apprendreFait, apprendreRegle } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { apprendreAction } from '../app/langage/connaissances.js';
import { evaluerAction } from '../app/langage/action.js';
import { monterEcranLangage } from '../app/langage/ecran.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
function monterEcran(magasin = magasinMemoireVive()) {
  return { magasin, ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true }) };
}

const EXEMPLES_DEDUCTION = ['zdeduit zorbo zrole1', 'zdeduit zkelmi zrole1', 'zdeduit zorbo zrole2'];

test('RACCORD — une liaison apprise (confirmerLiaison) se retrouve bien dans esprit.liaisons, statut validee', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  const eval1 = ecran.evaluerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  assert.equal(eval1.ok, true);
  const conf = await ecran.confirmerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  assert.match(conf.explication, /J'ai appris une liaison/);
  assert.equal(esprit.liaisons.length, 1);
  assert.equal(esprit.liaisons[0].statut, 'validee');
});

test('RACCORD — invoquerComposition : un rôle résolu par une liaison, après une invocation ORDINAIRE (texte naturel) de la capacité source', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(esprit, { role: 'zrole1', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zcouleur' });

  // La capacité SOURCE (deduction) est invoquée par la voie ORDINAIRE, déjà existante (Action:/Rôles:
  // puis reconnaissance naturelle) -- exactement comme dans tests/deduction-action.test.mjs. C'est
  // CETTE invocation ordinaire qui doit laisser son résultat référençable (crochet générique dans
  // tenterReconnaissanceAction), sans qu'aucune liaison n'existe encore à cet instant.
  const magasin = esprit.magasin;
  const evalue = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: EXEMPLES_DEDUCTION });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'deduction' });
  esprit.actions = await magasin.lireTout('actions');
  const reco = await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  assert.equal(reco.reconnu, true);
  assert.equal(reco.ok, true);
  assert.equal(esprit.derniersResultats.get('deduction').resultat, 'zcouleur');

  // Maintenant seulement, la liaison est enseignée et confirmée.
  await ecran.confirmerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });

  // Invocation EXPLICITE de la capacité CIBLE, « avec liaisons » : le rôle "relation" est omis des
  // arguments explicites -- il doit être résolu depuis le dernier résultat de "deduction".
  const r = await ecran.invoquerComposition({
    operation: 'confrontation',
    argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' },
  });
  assert.equal(r.ok, true);
  assert.match(r.texte, /égal/);
});

test('RACCORD — invoquerComposition : rôle non résolu (ni explicite, ni liaison) → texte honnête, jamais une incompréhension', async () => {
  const { ecran } = monterEcran();
  await ecran.assurerEsprit();
  const r = await ecran.invoquerComposition({
    operation: 'confrontation',
    argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' },
  });
  assert.equal(r.ok, false);
  assert.match(r.texte, /relation/);
});

test('RACCORD — invoquerComposition : opération inconnue → texte honnête', async () => {
  const { ecran } = monterEcran();
  await ecran.assurerEsprit();
  const r = await ecran.invoquerComposition({ operation: 'zinexistante', argumentsExplicites: {} });
  assert.equal(r.ok, false);
  assert.match(r.texte, /pas une opération interne autorisée/);
});
// === FIN_TEST_COMPOSITION_ECRAN ===
