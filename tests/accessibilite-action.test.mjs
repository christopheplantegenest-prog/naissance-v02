// === DEBUT_TEST_ACCESSIBILITE_ACTION ===
// v0.44 — DÉCISION CHATGPT « COMPARATEUR LOGIQUE GÉNÉRAL / ACCESSIBILITÉ TRANSITIVE » (02/10),
// ARCHITECTURE X. La nouvelle capacité du registre (accessibilite — accessibilite.js) RECONNUE et
// INVOQUÉE via le même mécanisme générique B1/B2 que « confrontation »/« proprietesCommunes »/
// « recherche »/« deduction » : AUCUN changement nécessaire à action.js, ni à l'extraction B1 — même
// forme de rôles simples, à un seul jeton par position variable. Ce fichier mime exactement
// tests/deduction-action.test.mjs, limité à la nouvelle capacité.
//
// Couvre aussi, en RACCORD, les mécanismes demandés explicitement par la décision ChatGPT : que
// cette capacité rejoigne SANS AUCUNE logique particulière les résultats référencés (composition.js)
// et les liaisons scalaires (son résultat { etat } est un simple texte, donc immédiatement éligible),
// exactement comme tests/composition-ecran.test.mjs le prouve déjà pour deduction/confrontation —
// ici avec une TROISIÈME capacité, sans qu'aucune des deux premières n'ait eu besoin de changer.
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zordre...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { apprendreAction } from '../app/langage/connaissances.js';
import { estAccessible } from '../app/langage/accessibilite.js';
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
// accessibilite — apprise, reconnue, invoquée, résultat identique à l'appel direct
// ---------------------------------------------------------------------------------------------
const EXEMPLES_ACCESSIBILITE = [
  'zaccede zorbo zordre zkelmi',
  'zaccede zfulgo zordre zkelmi', // position 0 seule varie par rapport au premier
  'zaccede zorbo zinverse zkelmi', // position 1 seule varie par rapport au premier
  'zaccede zorbo zordre zvex', // position 2 seule varie par rapport au premier
];

test('accessibilite : apprise avec les rôles (sujetA, operateur, sujetB) → validée', () => {
  const r = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples: EXEMPLES_ACCESSIBILITE });
  assert.equal(r.ok, true);
  assert.equal(r.statut, 'validee');
});

test('accessibilite : invocation depuis une phrase apprise → résultat identique à l\'appel direct', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });

  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples: EXEMPLES_ACCESSIBILITE });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'accessibilite' });
  assert.equal(action.statut, 'validee');

  const r = invoquerAction(action, esprit, 'zaccede zorbo zordre zkelmi');
  assert.equal(r.ok, true);
  const attendu = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' });
  assert.deepEqual(r.resultat, attendu);
  assert.equal(r.resultat.etat, 'accessible');
});

test('accessibilite : reconnue par reconnaitreActions() une fois validée', async () => {
  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples: EXEMPLES_ACCESSIBILITE });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'accessibilite' });
  const reco = reconnaitreActions([action], 'zaccede zorbo zordre zkelmi');
  assert.equal(reco.etat, 'unique');
  assert.equal(reco.action.operation, 'accessibilite');
});

// ---------------------------------------------------------------------------------------------
// RACCORD CONVERSATIONNEL BOUT EN BOUT (ecran.js : confirmerAction/tenterReconnaissanceAction, même
// mécanisme générique que B3/v0.39/v0.41/v0.42 — preuve que cette capacité est réellement testable
// depuis la conversation, sans aucun changement à ecran.js/main.js).
// ---------------------------------------------------------------------------------------------
test('RACCORD — accessibilite enseignée puis invoquée via le canal pédagogique réel (confirmerAction/tenterReconnaissanceAction)', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zordre', valeur: 'zvex' });

  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples: EXEMPLES_ACCESSIBILITE });
  assert.equal(evalue.statut, 'validee');
  const conf = await ecran.confirmerAction({
    operation: 'accessibilite', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  assert.match(conf.explication, /J'ai appris/);

  const reco = await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zvex');
  assert.equal(reco.reconnu, true);
  assert.equal(reco.ok, true);
  assert.match(reco.texte, /accessibilité locale/);
  assert.match(reco.texte, /accessible/);
});

test('RACCORD — relation jamais enseignée → texte honnête (inconnu), jamais une incompréhension', async () => {
  const { ecran } = monterEcran();
  await ecran.assurerEsprit();

  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples: EXEMPLES_ACCESSIBILITE });
  await ecran.confirmerAction({
    operation: 'accessibilite', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });

  const rien = await ecran.tenterReconnaissanceAction('zaccede zorbo zinverse zvex');
  assert.equal(rien.ok, true);
  assert.match(rien.texte, /inconnu/);
});

// ---------------------------------------------------------------------------------------------
// RÉSULTATS RÉFÉRENCÉS + LIAISONS SCALAIRES (composition.js) — sans AUCUNE logique particulière à
// cette capacité : son résultat { etat } est un texte simple, donc une source de liaison valide
// comme n'importe quelle autre. Démontré ici avec une TROISIÈME capacité (deduction → accessibilite),
// sans qu'aucune des deux n'ait eu besoin de changer.
// ---------------------------------------------------------------------------------------------
test('RACCORD — invoquerComposition : le rôle "sujetB" d\'accessibilite résolu depuis le dernier résultat de deduction, via une liaison apprise', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  const { apprendreRegle } = await import('../app/langage/esprit.js');
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(esprit, { role: 'zroleCible', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zkelmi' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });

  // Invocation EXPLICITE de "deduction" (capacité SOURCE), dont le résultat doit devenir référençable.
  const d = await ecran.invoquerComposition({ operation: 'deduction', argumentsExplicites: { sujet: 'zorbo', role: 'zroleCible' } });
  assert.equal(d.ok, true);
  assert.equal(esprit.derniersResultats.get('deduction').resultat, 'zkelmi');

  // Une liaison : deduction.resultat → accessibilite.sujetB.
  const evalLiaison = ecran.evaluerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'accessibilite', role: 'sujetB',
  });
  assert.equal(evalLiaison.ok, true);
  await ecran.confirmerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'accessibilite', role: 'sujetB',
  });

  // Invocation EXPLICITE de la capacité CIBLE : le rôle "sujetB" est omis des arguments explicites —
  // il doit être résolu depuis le dernier résultat de "deduction" ('zkelmi').
  const r = await ecran.invoquerComposition({
    operation: 'accessibilite',
    argumentsExplicites: { sujetA: 'zorbo', operateur: 'zordre' },
  });
  assert.equal(r.ok, true);
  assert.match(r.texte, /accessible/);
});
// === FIN_TEST_ACCESSIBILITE_ACTION ===
