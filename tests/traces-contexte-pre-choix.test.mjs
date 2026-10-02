// === DEBUT_TEST_TRACES_CONTEXTE_PRE_CHOIX ===
// v0.47 — DÉCISION CHATGPT « CONTEXTE PRÉ-CHOIX » (02/10). Complète les traces de raisonnement de la
// voie "action" avec le CONTEXTE RÉEL disponible AVANT le choix de la capacité : le texte brut reçu
// (tenterReconnaissanceAction(texte), ecran.js) et sa tokenisation générique capacité-agnostique
// (tokeniser(), transformation.js, réutilisé tel quel, aucun nouveau tokenizer). AUCUNE sélection
// automatique, AUCUNE similarité, AUCUNE induction sur les traces : on conserve uniquement un champ
// supplémentaire, additif, jamais comparé ni interprété ici.
//
// Frontière conceptuelle stricte, vérifiée par ces tests : le contexte ne contient JAMAIS de capacité,
// de rôle, de squelette d'action, ni rien venant du résultat. La voie "composition" (Compose:) reste
// HONNÊTEMENT dépourvue de contexte pré-choix (contexte: null, jamais un faux contexte reconstruit à
// partir du bloc structurel, qui contient déjà la capacité choisie).
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zordre...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { evaluerAction } from '../app/langage/action.js';
import { tokeniser } from '../app/langage/transformation.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
function monterEcran(magasin = magasinMemoireVive()) {
  return { magasin, ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true }) };
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

// -------------------------------------------------------------------------------------------
// VOIE "ACTION" : texte brut ET tokens conservés, exactement ceux du texte REÇU AVANT choix
// -------------------------------------------------------------------------------------------
test('voie action : le texte brut reçu avant reconnaissance est conservé tel quel dans le contexte', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreActionAccessibilite(ecran);

  const texteEnvoye = 'zaccede zorbo zordre zkelmi';
  const reco = await ecran.tenterReconnaissanceAction(texteEnvoye);
  assert.equal(reco.ok, true);

  const trace = esprit.traces.at(-1);
  assert.equal(trace.voie, 'action');
  assert.ok(trace.contexte, 'le contexte ne doit pas être absent sur une trace fraîche de voie action');
  assert.equal(trace.contexte.texteBrut, texteEnvoye);
});

test('voie action : les tokens conservés sont produits par tokeniser() existant, aucun nouveau tokenizer', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreActionAccessibilite(ecran);

  const texteEnvoye = 'zaccede zorbo zordre zkelmi';
  await ecran.tenterReconnaissanceAction(texteEnvoye);

  const trace = esprit.traces.at(-1);
  assert.deepEqual(trace.contexte.tokens, tokeniser(texteEnvoye));
});

test('voie action : le contexte ne contient AUCUNE capacité, rôle ou information de résultat', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreActionAccessibilite(ecran);

  await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zkelmi');

  const trace = esprit.traces.at(-1);
  assert.deepEqual(Object.keys(trace.contexte).sort(), ['texteBrut', 'tokens']);
  assert.ok(!('etat' in trace.contexte));
  assert.ok(!('capacite' in trace.contexte));
  assert.ok(!('sujetA' in trace.contexte) && !('operateur' in trace.contexte) && !('sujetB' in trace.contexte));
});

// -------------------------------------------------------------------------------------------
// VOIE "COMPOSITION" : honnêtement dépourvue de contexte — jamais un faux contexte reconstruit
// -------------------------------------------------------------------------------------------
test('voie composition : aucun faux contexte n\'est créé — contexte explicitement null', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });

  const r = await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  assert.equal(r.ok, true);

  const trace = esprit.traces.at(-1);
  assert.equal(trace.voie, 'composition');
  assert.equal(trace.contexte, null);
});

// -------------------------------------------------------------------------------------------
// COMPATIBILITÉ DES ANCIENNES TRACES (v0.46.1, sans champ "contexte")
// -------------------------------------------------------------------------------------------
test('une ancienne trace v0.46.1 sans champ "contexte" reste lisible normalement (absence = inconnu, pas une erreur)', async () => {
  const magasin = magasinMemoireVive();
  // Simule une trace telle qu'écrite par v0.46.1, SANS le champ "contexte" (jamais reconstruit a posteriori).
  const ancienneTrace = {
    id: 'trace-ancienne-1', sequence: 1, horodatage: new Date(0).toISOString(),
    capacite: 'recherche', voie: 'composition',
    argumentsUtilises: { relation: 'zcouleur', valeur: 'zbleu' },
    provenanceArguments: { relation: 'explicite', valeur: 'explicite' },
    resultat: { sujets: ['zorbo'] },
  };
  await magasin.ecrire('traces', ancienneTrace);

  const esprit = await chargerEsprit(magasin);
  assert.equal(esprit.traces.length, 1);
  assert.equal(esprit.traces[0].id, 'trace-ancienne-1');
  assert.ok(!('contexte' in esprit.traces[0]), 'une ancienne trace ne doit jamais se voir attribuer un contexte reconstruit');
});

// -------------------------------------------------------------------------------------------
// PERSISTANCE / RECHARGEMENT
// -------------------------------------------------------------------------------------------
test('persistance : le contexte d\'une trace de voie action survit à un rechargement complet de l\'esprit', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monterEcran(magasin);
  const esprit1 = await ecran.assurerEsprit();
  await apprendreFait(esprit1, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreActionAccessibilite(ecran);
  await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zkelmi');

  const esprit2 = await chargerEsprit(magasin);
  assert.equal(esprit2.traces.length, 1);
  assert.equal(esprit2.traces[0].contexte.texteBrut, 'zaccede zorbo zordre zkelmi');
  assert.deepEqual(esprit2.traces[0].contexte.tokens, tokeniser('zaccede zorbo zordre zkelmi'));
});

// -------------------------------------------------------------------------------------------
// AUCUNE MODIFICATION DU RÉSULTAT VISIBLE, AUCUNE INVOCATION/COMPARAISON AUTOMATIQUE
// -------------------------------------------------------------------------------------------
test('le résultat visible de l\'action et le comportement du moteur restent strictement inchangés', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreActionAccessibilite(ecran);

  const reco = await ecran.tenterReconnaissanceAction('zaccede zorbo zordre zkelmi');
  assert.equal(reco.reconnu, true);
  assert.equal(reco.ok, true);
  assert.match(reco.texte, /accessibilité locale/);
  assert.match(reco.texte, /accessible/);
  // Aucune comparaison/induction/sélection : une seule trace, aucune liaison créée.
  assert.equal(esprit.traces.length, 1);
  assert.deepEqual(esprit.liaisons, []);
});
// === FIN_TEST_TRACES_CONTEXTE_PRE_CHOIX ===
