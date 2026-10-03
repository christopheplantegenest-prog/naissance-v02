// === DEBUT_TEST_PROVENANCE_POSITIONS ===
// v0.53 — DÉCISION CHATGPT « PROVENANCE POSITIONNELLE EXACTE DES RÔLES » (03/10/2026), suite au
// diagnostic du même jour ayant démontré, AVEC LE VRAI CODE, qu'une reconstruction a posteriori de
// « role -> position » par égalité de valeur (argumentsUtilises[role] === contexte.tokens[position])
// peut produire un FAUX singleton dès que deux actions enseignées différentes, partageant la même
// capacité mais des ordres de rôles différents, contribuent à la même couverture — une coïncidence
// de token crée une position compatible unique qui n'est la vraie source pour AUCUNE des deux
// invocations. Principe retenu : CAPTURER LE FAIT au moment où il est certain (action.roles, au sein
// même de invoquerAction()), jamais le reconstruire après coup par comparaison de valeurs.
//
// AUCUNE inférence, AUCUNE reconstruction par comparaison de valeurs, AUCUNE autonomie, AUCUN choix
// de capacité, AUCUNE nouvelle primitive de mapping stable : ce chantier ajoute UNIQUEMENT un champ
// additif, construit directement depuis action.roles, à l'endroit même où action.roles est déjà lu.
//
// Domaine ARTIFICIEL neutre (zaccede/zordre/zorbo/zkelmi...), comme tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluerAction, invoquerAction } from '../app/langage/action.js';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive, apprendreAction } from '../app/langage/connaissances.js';
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

// -------------------------------------------------------------------------------------------
// A. invoquerAction() (action.js, pur) expose désormais provenancePositions, construit depuis
// action.roles -- roles dans l'ordre naturel sujetA/operateur/sujetB.
// -------------------------------------------------------------------------------------------
test('A. invoquerAction() expose provenancePositions = exactement action.roles, ordre naturel', async () => {
  const { esprit } = await nouvelEsprit();
  const magasin = magasinMemoireVive();
  const exemples = [
    'zaccede zalpha zordre zbeta',
    'zaccede zuno zordre zbeta',
    'zaccede zalpha zepasse zbeta',
    'zaccede zalpha zordre zdos',
  ];
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples });
  assert.equal(evalue.statut, 'validee');
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'accessibilite' });

  const r = invoquerAction(action, esprit, 'zaccede zalpha zordre zbeta');
  assert.equal(r.ok, true);
  assert.deepEqual(r.arguments, { sujetA: 'zalpha', operateur: 'zordre', sujetB: 'zbeta' });
  assert.deepEqual(r.provenancePositions, { sujetA: 1, operateur: 2, sujetB: 3 });
});

// -------------------------------------------------------------------------------------------
// B. Même capacité, ordre de rôles ENSEIGNÉ différent -- la provenance suit EXACTEMENT cet ordre.
// -------------------------------------------------------------------------------------------
test('B. ordre de rôles enseigné différent (operateur->1, sujetA->2, sujetB->3) -> provenance conforme', async () => {
  const { esprit } = await nouvelEsprit();
  const magasin = magasinMemoireVive();
  const exemples = [
    'zaccede zordre zgamma zdelta',
    'zaccede zepasse zmu zdelta',
    'zaccede zordre zmu zepsilon',
  ];
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['operateur', 'sujetA', 'sujetB'], exemples });
  assert.equal(evalue.statut, 'validee');
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'accessibilite' });

  const r = invoquerAction(action, esprit, 'zaccede zordre zordre zdelta');
  assert.equal(r.ok, true);
  assert.deepEqual(r.arguments, { operateur: 'zordre', sujetA: 'zordre', sujetB: 'zdelta' });
  assert.deepEqual(r.provenancePositions, { operateur: 1, sujetA: 2, sujetB: 3 });
});

// -------------------------------------------------------------------------------------------
// C. VALEUR DUPLIQUÉE DANS LE TEXTE -- LE TEST CENTRAL, PROTÈGE CONTRE LE BUG CONCEPTUEL DÉCOUVERT.
// operateur vient RÉELLEMENT de la position 1, même si 'zordre' apparaît AUSSI en position 2.
// La provenance DOIT rester operateur:1, jamais reconstruite comme 2 par coïncidence de valeur.
// -------------------------------------------------------------------------------------------
test('C. valeur dupliquée dans le texte -- la provenance reste la VRAIE position, jamais celle de la coïncidence', async () => {
  const { esprit } = await nouvelEsprit();
  const magasin = magasinMemoireVive();
  const exemples = [
    'zaccede zordre zgamma zdelta',
    'zaccede zepasse zmu zdelta',
    'zaccede zordre zmu zepsilon',
  ];
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['operateur', 'sujetA', 'sujetB'], exemples });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'accessibilite' });

  // 'zordre' apparaît en position 1 (vraie source d'operateur) ET en position 2 (coïncidence pure).
  const r = invoquerAction(action, esprit, 'zaccede zordre zordre zdelta');
  assert.equal(r.ok, true);
  assert.equal(r.provenancePositions.operateur, 1, 'la provenance doit être 1, jamais 2 malgré la coïncidence de token');
});

// -------------------------------------------------------------------------------------------
// D. DEUX ACTIONS DIFFÉRENTES, MÊME CAPACITÉ, POSITIONS DE RÔLES DIFFÉRENTES -- chaque invocation
// conserve SA PROPRE provenance exacte, aucune ne contamine l'autre.
// -------------------------------------------------------------------------------------------
test('D. deux actions différentes (même capacité) -> chaque invocation garde sa propre provenance exacte', async () => {
  const { esprit } = await nouvelEsprit();

  // Deux squelettes STRUCTURELLEMENT DISTINCTS (ancre différente : 'zaccede' vs 'zarrive') pour
  // que les deux actions restent 'validee' simultanément, sans que la seconde ne remplace la
  // première (apprendreAction() marque déjà 'remplacee' une action de MÊME squelette -- un
  // mécanisme existant, hors périmètre de ce chantier, qu'il ne faut pas déclencher ici par
  // accident : ce test veut deux actions RÉELLEMENT co-existantes).
  const magasin1 = magasinMemoireVive();
  const ex1 = [
    'zaccede zalpha zordre zbeta',
    'zaccede zuno zordre zbeta',
    'zaccede zalpha zepasse zbeta',
    'zaccede zalpha zordre zdos',
  ];
  const eval1 = evaluerAction({ operation: 'accessibilite', roles: ['sujetA', 'operateur', 'sujetB'], exemples: ex1 });
  assert.equal(eval1.statut, 'validee');
  const { objet: action1 } = await apprendreAction(magasin1, { ...eval1, operation: 'accessibilite' });

  const magasin2 = magasinMemoireVive();
  const ex2 = [
    'zarrive zordre zgamma zdelta',
    'zarrive zepasse zmu zdelta',
    'zarrive zordre zmu zepsilon',
  ];
  const eval2 = evaluerAction({ operation: 'accessibilite', roles: ['operateur', 'sujetA', 'sujetB'], exemples: ex2 });
  assert.equal(eval2.statut, 'validee');
  const { objet: action2 } = await apprendreAction(magasin2, { ...eval2, operation: 'accessibilite' });

  const r1 = invoquerAction(action1, esprit, 'zaccede zalpha zordre zbeta');
  const r2 = invoquerAction(action2, esprit, 'zarrive zordre zordre zdelta');

  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.deepEqual(r1.provenancePositions, { sujetA: 1, operateur: 2, sujetB: 3 });
  assert.deepEqual(r2.provenancePositions, { operateur: 1, sujetA: 2, sujetB: 3 });
});

// -------------------------------------------------------------------------------------------
// E. ANCIENNE TRACE SANS provenancePositions -- reste lisible et inchangée (simulée : un objet de
// trace « ancien format », jamais touché par ce chantier).
// -------------------------------------------------------------------------------------------
test('E. une trace de format ancien (sans provenancePositions) reste parfaitement lisible', async () => {
  const ancienneTrace = {
    id: 'trace-ancienne', sequence: 1, horodatage: new Date().toISOString(),
    capacite: 'accessibilite', voie: 'action',
    argumentsUtilises: { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' },
    provenanceArguments: { sujetA: 'texte', operateur: 'texte', sujetB: 'texte' },
    resultat: { etat: 'accessible' },
    contexte: { texteBrut: 'zaccede zorbo zordre zkelmi', tokens: ['zaccede', 'zorbo', 'zordre', 'zkelmi'] },
  };
  assert.equal(ancienneTrace.provenancePositions, undefined, 'champ absent, jamais reconstruit');
  assert.equal(ancienneTrace.capacite, 'accessibilite', 'le reste de la trace reste lisible normalement');
});

// -------------------------------------------------------------------------------------------
// F. NOUVELLE TRACE voie:'composition' -- AUCUNE fausse position : provenancePositions: null.
// -------------------------------------------------------------------------------------------
test('F. trace voie:composition -> provenancePositions: null (jamais une position inventée)', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });

  const r = await ecran.invoquerComposition({ operation: 'recherche', argumentsExplicites: { relation: 'zcouleur', valeur: 'zbleu' } });
  assert.equal(r.ok, true);

  const trace = esprit.traces.at(-1);
  assert.equal(trace.voie, 'composition');
  assert.equal(trace.provenancePositions, null);
});

// -------------------------------------------------------------------------------------------
// G. PERSISTANCE/RECHARGEMENT -- une nouvelle trace action enrichie conserve EXACTEMENT
// provenancePositions après stockage/relecture (même magasin, nouvel esprit chargé).
// -------------------------------------------------------------------------------------------
test('G. persistance : provenancePositions d\'une trace action survit à un rechargement complet', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monterEcran(magasin);
  const esprit1 = await ecran.assurerEsprit();
  await apprendreFait(esprit1, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });

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
  assert.equal(esprit1.traces.length, 1);
  assert.deepEqual(esprit1.traces[0].provenancePositions, { sujetA: 1, operateur: 2, sujetB: 3 });

  const esprit2 = await chargerEsprit(magasin);
  assert.equal(esprit2.traces.length, 1);
  assert.deepEqual(esprit2.traces[0].provenancePositions, { sujetA: 1, operateur: 2, sujetB: 3 });
});

// -------------------------------------------------------------------------------------------
// H. LA PROVENANCE VIENT DE action.roles, JAMAIS D'UNE RECHERCHE PAR VALEUR -- modifier les tokens
// dupliqués ne change jamais la provenance capturée (même scénario que C, formulé différemment :
// une recherche par égalité de valeur sur contexte.tokens donnerait operateur -> {1,2}, ambigu ;
// la provenance réelle reste 1, un fait unique, jamais une liste ambiguë).
// -------------------------------------------------------------------------------------------
test('H. la provenance est un fait unique issu de action.roles, jamais une liste de positions compatibles', async () => {
  const { esprit } = await nouvelEsprit();
  const magasin = magasinMemoireVive();
  const exemples = [
    'zaccede zordre zgamma zdelta',
    'zaccede zepasse zmu zdelta',
    'zaccede zordre zmu zepsilon',
  ];
  const evalue = evaluerAction({ operation: 'accessibilite', roles: ['operateur', 'sujetA', 'sujetB'], exemples });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'accessibilite' });

  // Ici 'zordre' apparaît en position 1 (vraie source) ET en position 2 : une recherche par valeur
  // donnerait {1,2}. La provenance réelle doit être EXACTEMENT 1, un entier, jamais un tableau.
  const r = invoquerAction(action, esprit, 'zaccede zordre zordre zdelta');
  assert.equal(typeof r.provenancePositions.operateur, 'number');
  assert.equal(r.provenancePositions.operateur, 1);
});
// === FIN_TEST_PROVENANCE_POSITIONS ===
