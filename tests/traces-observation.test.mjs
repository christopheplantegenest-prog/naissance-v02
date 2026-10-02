// === DEBUT_TEST_TRACES_OBSERVATION ===
// v0.46 — DÉCISION CHATGPT « OBSERVATION PASSIVE DES TENTATIVES DE RAISONNEMENT » (02/10). Couvre
// la capacité d'OBSERVER et CONSERVER fidèlement ce qui vient réellement de se produire lors d'une
// invocation de capacité — AUCUNE autonomie, AUCUNE sélection, AUCUN apprentissage ici : une simple
// mémoire d'événements, jamais interprétés.
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zordre...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait, apprendreRegle } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { evaluerAction, invoquerAction } from '../app/langage/action.js';
import { apprendreAction } from '../app/langage/connaissances.js';

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

// -------------------------------------------------------------------------------------------
// AUCUNE INVOCATION → AUCUNE TRACE PARASITE
// -------------------------------------------------------------------------------------------
test('un esprit neuf, sans aucune invocation, ne possède aucune trace', async () => {
  const { esprit } = await nouvelEsprit();
  assert.deepEqual(esprit.traces, []);
});

// -------------------------------------------------------------------------------------------
// INVOCATION EXPLICITE (Compose:/invoquerComposition) — ARGUMENTS EXPLICITES
// -------------------------------------------------------------------------------------------
test('invocation explicite (recherche, résultat en LISTE) → une trace, résultat brut conservé tel quel', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });

  const r = await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  assert.equal(r.ok, true);

  assert.equal(esprit.traces.length, 1);
  const trace = esprit.traces[0];
  assert.equal(trace.capacite, 'recherche');
  assert.equal(trace.voie, 'composition');
  assert.deepEqual(trace.argumentsUtilises, { relation: 'zcouleur', valeur: 'zbleu' });
  assert.deepEqual(trace.provenanceArguments, { relation: 'explicite', valeur: 'explicite' });
  assert.deepEqual(trace.resultat, { sujets: ['zorbo', 'zkelmi'] });
});

test('invocation explicite (deduction, résultat scalaire + objet "regle") → résultat brut conservé', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(esprit, { role: 'zroleA', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zkelmi' });

  const r = await ecran.invoquerComposition({ operation: 'deduction', argumentsExplicites: { sujet: 'zorbo', role: 'zroleA' } });
  assert.equal(r.ok, true);

  const trace = esprit.traces.at(-1);
  assert.equal(trace.capacite, 'deduction');
  assert.equal(trace.resultat.resultat, 'zkelmi');
  assert.ok(trace.resultat.regle && trace.resultat.regle.resultat === 'zkelmi');
  assert.deepEqual(trace.provenanceArguments, { sujet: 'explicite', role: 'explicite' });
});

// -------------------------------------------------------------------------------------------
// ARGUMENT FOURNI PAR LIAISON → valeur RÉSOLUE conservée, provenance 'liaison'
// -------------------------------------------------------------------------------------------
test('argument résolu par une liaison apprise → la VALEUR RÉSOLUE (pas l\'entrée textuelle) est conservée, provenance "liaison"', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(esprit, { role: 'zroleCible', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zkelmi' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });

  // Invocation 1 : deduction, dont le résultat devient référençable.
  await ecran.invoquerComposition({ operation: 'deduction', argumentsExplicites: { sujet: 'zorbo', role: 'zroleCible' } });

  const evalLiaison = ecran.evaluerLiaison({ capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'accessibilite', role: 'sujetB' });
  assert.equal(evalLiaison.ok, true);
  await ecran.confirmerLiaison({ capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'accessibilite', role: 'sujetB' });

  // Invocation 2 : accessibilite, "sujetB" OMIS des arguments explicites → résolu par la liaison.
  const r = await ecran.invoquerComposition({ operation: 'accessibilite', argumentsExplicites: { sujetA: 'zorbo', operateur: 'zordre' } });
  assert.equal(r.ok, true);

  const trace = esprit.traces.at(-1);
  assert.equal(trace.capacite, 'accessibilite');
  assert.deepEqual(trace.argumentsUtilises, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' });
  assert.deepEqual(trace.provenanceArguments, { sujetA: 'explicite', operateur: 'explicite', sujetB: 'liaison' });
  assert.equal(trace.resultat.etat, 'accessible');
});

// -------------------------------------------------------------------------------------------
// VOIE "ACTION APPRISE" (reconnaissance en conversation, hors Compose:) → également tracée
// -------------------------------------------------------------------------------------------
test('invocation via une action apprise reconnue en conversation (voie "action") → une trace, provenance "texte"', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });

  const exemples = [
    'zaccede zorbo zordre zkelmi',
    'zaccede zfulgo zordre zkelmi',
    'zaccede zorbo zinverse zkelmi',
    'zaccede zorbo zordre zvex',
  ];
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples });
  assert.equal(evalue.statut, 'validee');
  await ecran.confirmerAction({ operation: 'accessibilite', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut });

  const reco = await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zkelmi');
  assert.equal(reco.ok, true);

  assert.equal(esprit.traces.length, 1);
  const trace = esprit.traces[0];
  assert.equal(trace.capacite, 'accessibilite');
  assert.equal(trace.voie, 'action');
  assert.deepEqual(trace.argumentsUtilises, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' });
  assert.deepEqual(trace.provenanceArguments, { sujetA: 'texte', operateur: 'texte', sujetB: 'texte' });
  assert.equal(trace.resultat.etat, 'accessible');
});

test('invoquerAction (action.js, hors ecran.js) continue de fonctionner seule, sans magasin ni trace — pureté inchangée', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  const magasin = magasinMemoireVive();
  const exemples = [
    'zaccede zorbo zordre zkelmi',
    'zaccede zfulgo zordre zkelmi',
    'zaccede zorbo zinverse zkelmi',
    'zaccede zorbo zordre zvex',
  ];
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'accessibilite' });

  const r = invoquerAction(action, esprit, 'zaccede zorbo zordre zkelmi');
  assert.equal(r.ok, true);
  assert.deepEqual(r.arguments, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' });
  assert.deepEqual(esprit.traces, []); // action.js lui-même n'écrit toujours rien dans esprit (invoqué hors ecran.js, aucune trace ajoutée).
});

// -------------------------------------------------------------------------------------------
// DEUX INVOCATIONS SUCCESSIVES → ORDRE RECONSTRUCTIBLE
// -------------------------------------------------------------------------------------------
test('deux invocations successives → séquence strictement croissante, ordre réel reconstructible', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });

  await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zrouge' } });

  assert.equal(esprit.traces.length, 2);
  assert.ok(esprit.traces[0].sequence < esprit.traces[1].sequence);
  assert.deepEqual(esprit.traces[0].resultat, { sujets: ['zorbo'] });
  assert.deepEqual(esprit.traces[1].resultat, { sujets: [] });
});

// -------------------------------------------------------------------------------------------
// PERSISTANCE : REDÉMARRAGE/RECHARGEMENT → TRACES TOUJOURS PRÉSENTES
// -------------------------------------------------------------------------------------------
test('persistance : un rechargement complet de l\'esprit depuis le même magasin conserve les traces', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monterEcran(magasin);
  const esprit1 = await ecran.assurerEsprit();
  await apprendreFait(esprit1, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  assert.equal(esprit1.traces.length, 1);

  const esprit2 = await chargerEsprit(magasin);
  assert.equal(esprit2.traces.length, 1);
  assert.equal(esprit2.traces[0].capacite, 'recherche');
  assert.deepEqual(esprit2.traces[0].resultat, { sujets: ['zorbo'] });
});

// -------------------------------------------------------------------------------------------
// UNE TRACE NE MODIFIE JAMAIS LE RÉSULTAT RÉELLEMENT RENVOYÉ PAR LA CAPACITÉ (non-aliasing)
// -------------------------------------------------------------------------------------------
test('une trace est une copie : la muter ne change ni un futur résultat, ni l\'état interne de l\'esprit', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });

  await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  const trace = esprit.traces.at(-1);
  const resultatAvant = esprit.derniersResultats.get('recherche');
  assert.deepEqual(resultatAvant, { sujets: ['zorbo'] });
  trace.resultat.sujets.push('INTRUS');
  trace.argumentsUtilises.relation = 'INTRUS';

  // Muter la trace APRÈS coup ne doit toucher ni le dernier résultat conservé par composition.js,
  // ni une nouvelle invocation réelle de la même capacité.
  assert.deepEqual(esprit.derniersResultats.get('recherche'), { sujets: ['zorbo'] });
  const r2 = await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  assert.equal(r2.ok, true);
  assert.deepEqual(esprit.derniersResultats.get('recherche'), { sujets: ['zorbo'] });
});

// -------------------------------------------------------------------------------------------
// AUCUNE SÉLECTION/INVOCATION AUTOMATIQUE INTRODUITE — l'observation reste un pur effet de bord
// -------------------------------------------------------------------------------------------
test('observer une invocation ne déclenche jamais, par effet de bord, une autre invocation ni une liaison', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });

  await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  assert.deepEqual(esprit.liaisons, []);
  assert.equal(esprit.derniersResultats.size, 1);
  assert.equal(esprit.traces.length, 1);
});
// === FIN_TEST_TRACES_OBSERVATION ===
