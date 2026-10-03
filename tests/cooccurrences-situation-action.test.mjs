// === DEBUT_TEST_COOCCURRENCES_SITUATION_ACTION ===
// PRIMITIVE PURE DE COOCCURRENCE SITUATION-ACTION (décision ChatGPT « PRIMITIVE PURE DE COOCCURRENCE
// SITUATION-ACTION », 03/10/2026, suite au diagnostic « CONTRAT DES COOCCURRENCES SITUATION-ACTION »
// du même jour). Ces tests figent le contrat exact défini par ce diagnostic : réutilisation stricte
// de vueDescriptive() (AUCUN recalcul de repererMotifs()/decrireStructure()/couverture/forme),
// enrichissement postérieur par trace.capacite uniquement, AUCUNE lecture de resultat/
// argumentsUtilises/provenanceArguments/sequence/horodatage, AUCUNE comparaison avant/après (ce
// chantier décrit un état, jamais un changement). AUCUN branchement testé ici : voir
// vecu-orchestration-traces.test.mjs et vecu.test.mjs, seuls garants du branchement réel inchangé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cooccurrencesSituationAction } from '../app/langage/vue-traces.js';

function traceAction(id, texteBrut, capacite, extra = {}) {
  return {
    id, voie: 'action', capacite,
    argumentsUtilises: {}, provenanceArguments: {}, resultat: { peuImporte: true },
    sequence: 0, horodatage: '2000-01-01T00:00:00.000Z',
    contexte: { texteBrut, tokens: [] }, ...extra,
  };
}
function traceComposition(id, capacite, extra = {}) {
  return {
    id, voie: 'composition', capacite,
    argumentsUtilises: {}, provenanceArguments: {}, resultat: { peuImporte: true },
    sequence: 0, horodatage: '2000-01-01T00:00:00.000Z',
    contexte: null, ...extra,
  };
}
function traceAncienneSansContexte(id, capacite, extra = {}) {
  const t = traceAction(id, 'texte-sans-interet', capacite, extra);
  delete t.contexte;
  return t;
}

// Projection déterministe pour comparer deux rapports sans dépendre de l'ordre d'itération interne.
function trier(rapport) {
  return rapport
    .map((e) => ({
      couverture: e.couverture.slice().sort(),
      forme: e.forme,
      capacites: e.capacites.slice(),
      excluesCapaciteInvalide: e.excluesCapaciteInvalide,
    }))
    .sort((a, b) => a.couverture.join(',').localeCompare(b.couverture.join(',')));
}

// --- A. même forme -> même capacité répétée --------------------------------------------------
test('cooccurrencesSituationAction() : A. même forme, même capacité répétée', () => {
  const traces = [
    traceAction('a1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('a2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceAction('a3', 'zaccede zgamma zordre zdelta', 'accessibilite'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  assert.equal(rapport.length, 1);
  assert.deepEqual(rapport[0].couverture.slice().sort(), ['a1', 'a2', 'a3']);
  assert.deepEqual(rapport[0].capacites, [{ capacite: 'accessibilite', occurrences: 3 }]);
  assert.equal(rapport[0].excluesCapaciteInvalide, 0);
});

// --- B. même forme -> deux capacités différentes ----------------------------------------------
test('cooccurrencesSituationAction() : B. même forme, deux capacités différentes conservées (pas de fusion/choix)', () => {
  const traces = [
    traceAction('b1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('b2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceAction('b3', 'zaccede zgamma zordre zdelta', 'recherche'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  assert.equal(rapport.length, 1);
  assert.deepEqual(rapport[0].capacites, [
    { capacite: 'accessibilite', occurrences: 2 },
    { capacite: 'recherche', occurrences: 1 },
  ]);
});

// --- C. deux formes -> même capacité : jamais fusionnées ----------------------------------------
test('cooccurrencesSituationAction() : C. deux formes distinctes, même capacité -> jamais fusionnées', () => {
  const traces = [
    traceAction('c1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('c2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceAction('c3', 'zcherche zorbo zdans zkelmi', 'accessibilite'),
    traceAction('c4', 'zcherche zalpha zdans zbeta', 'accessibilite'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  assert.ok(rapport.length >= 2, 'au moins deux éléments descriptifs distincts attendus');
  const formes = new Set(rapport.map((e) => e.forme));
  assert.ok(formes.size >= 2, 'les formes distinctes ne doivent pas être fusionnées en une seule');
  for (const e of rapport) {
    assert.deepEqual(e.capacites, [{ capacite: 'accessibilite', occurrences: 2 }]);
  }
});

// --- D. répétition exacte créant un sous-groupe descriptif ---------------------------------------
test('cooccurrencesSituationAction() : D. répétition exacte -> sous-groupe descriptif séparé, chacun avec son propre compte', () => {
  const traces = [
    traceAction('d1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('d2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceAction('d3', 'zaccede zorbo zordre zkelmi', 'accessibilite'), // répétition exacte de d1
  ];
  const rapport = trier(cooccurrencesSituationAction(traces));
  assert.equal(rapport.length, 2);
  const large = rapport.find((e) => e.couverture.length === 3);
  const etroit = rapport.find((e) => e.couverture.length === 2);
  assert.ok(large && etroit);
  assert.deepEqual(large.capacites, [{ capacite: 'accessibilite', occurrences: 3 }]);
  assert.deepEqual(etroit.capacites, [{ capacite: 'accessibilite', occurrences: 2 }]);
});

// --- E. motifs redondants, même couverture : aucun double comptage -------------------------------
test('cooccurrencesSituationAction() : E. motifs redondants menant à la même couverture -> un seul élément, aucun double comptage', () => {
  const traces = [
    traceAction('e1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('e2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  assert.equal(rapport.length, 1);
  assert.deepEqual(rapport[0].capacites, [{ capacite: 'accessibilite', occurrences: 2 }]);
});

// --- F. trace composition ignorée ----------------------------------------------------------------
test('cooccurrencesSituationAction() : F. trace composition exclue du corpus (jamais comptée, jamais visible)', () => {
  const traces = [
    traceAction('f1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('f2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceComposition('f3', 'accessibilite'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  for (const e of rapport) assert.ok(!e.couverture.includes('f3'));
  const total = rapport.reduce((s, e) => s + e.capacites.reduce((s2, c) => s2 + c.occurrences, 0), 0);
  const rapportSansComposition = cooccurrencesSituationAction([traces[0], traces[1]]);
  const totalSans = rapportSansComposition.reduce((s, e) => s + e.capacites.reduce((s2, c) => s2 + c.occurrences, 0), 0);
  assert.equal(total, totalSans);
});

// --- G. ancienne trace sans contexte ignorée -------------------------------------------------------
test('cooccurrencesSituationAction() : G. ancienne trace sans champ contexte exclue du corpus', () => {
  const traces = [
    traceAction('g1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('g2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceAncienneSansContexte('g3', 'accessibilite'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  for (const e of rapport) assert.ok(!e.couverture.includes('g3'));
});

// --- H1. capacité vide ------------------------------------------------------------------------------
test('cooccurrencesSituationAction() : H1. capacité "" -> trace participe à la forme, exclue du comptage, signalée', () => {
  const traces = [
    traceAction('h1', 'zaccede zorbo zordre zkelmi', ''),
    traceAction('h2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  assert.equal(rapport.length, 1);
  assert.deepEqual(rapport[0].couverture.slice().sort(), ['h1', 'h2']);
  assert.deepEqual(rapport[0].capacites, [{ capacite: 'accessibilite', occurrences: 1 }]);
  assert.equal(rapport[0].excluesCapaciteInvalide, 1);
});

// --- H2. capacité absente --------------------------------------------------------------------------
test('cooccurrencesSituationAction() : H2. capacité absente (undefined) -> même traitement que H1', () => {
  const traces = [
    traceAction('h3', 'zaccede zorbo zordre zkelmi', undefined),
    traceAction('h4', 'zaccede zalpha zordre zbeta', 'accessibilite'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  assert.equal(rapport.length, 1);
  assert.deepEqual(rapport[0].capacites, [{ capacite: 'accessibilite', occurrences: 1 }]);
  assert.equal(rapport[0].excluesCapaciteInvalide, 1);
});

// --- I. ordre des traces inversé/mélangé : résultat identique --------------------------------------
test('cooccurrencesSituationAction() : I. ordre des traces en entrée ne change jamais le rapport', () => {
  const traces = [
    traceAction('i1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('i2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceAction('i3', 'zaccede zgamma zordre zdelta', 'recherche'),
    traceAction('i4', 'zaccede zorbo zordre zkelmi', 'accessibilite'), // répétition exacte de i1
  ];
  const r1 = trier(cooccurrencesSituationAction(traces));
  const r2 = trier(cooccurrencesSituationAction([...traces].reverse()));
  const r3 = trier(cooccurrencesSituationAction([traces[2], traces[0], traces[3], traces[1]]));
  assert.deepEqual(r1, r2);
  assert.deepEqual(r1, r3);
});

// --- J. changement complet de resultat : rapport identique -----------------------------------------
test('cooccurrencesSituationAction() : J. "resultat" totalement différent -> rapport strictement identique (jamais lu)', () => {
  const t1 = [
    traceAction('j1', 'zaccede zorbo zordre zkelmi', 'accessibilite', { resultat: { succes: true, valeur: 42 } }),
    traceAction('j2', 'zaccede zalpha zordre zbeta', 'accessibilite', { resultat: null }),
  ];
  const t2 = [
    traceAction('j1', 'zaccede zorbo zordre zkelmi', 'accessibilite', { resultat: { echec: 'autre-chose-completement-different', liste: [1, 2, 3] } }),
    traceAction('j2', 'zaccede zalpha zordre zbeta', 'accessibilite', { resultat: 'une-chaine-arbitraire' }),
  ];
  assert.deepEqual(cooccurrencesSituationAction(t1), cooccurrencesSituationAction(t2));
});

// --- K. changement de argumentsUtilises/provenanceArguments/sequence/horodatage : rapport identique --
test('cooccurrencesSituationAction() : K. argumentsUtilises/provenanceArguments/sequence/horodatage différents -> rapport identique (jamais lus)', () => {
  const t1 = [
    traceAction('k1', 'zaccede zorbo zordre zkelmi', 'accessibilite', {
      argumentsUtilises: { role: 'x' }, provenanceArguments: { role: 'texte' }, sequence: 1, horodatage: '2026-01-01T00:00:00.000Z',
    }),
    traceAction('k2', 'zaccede zalpha zordre zbeta', 'accessibilite', {
      argumentsUtilises: {}, provenanceArguments: {}, sequence: 2, horodatage: '2026-01-02T00:00:00.000Z',
    }),
  ];
  const t2 = [
    traceAction('k1', 'zaccede zorbo zordre zkelmi', 'accessibilite', {
      argumentsUtilises: { role: 'tout-autre-chose', autre: [9, 9] }, provenanceArguments: { role: 'liaison' }, sequence: 999, horodatage: '1999-12-31T23:59:59.000Z',
    }),
    traceAction('k2', 'zaccede zalpha zordre zbeta', 'accessibilite', {
      argumentsUtilises: { z: true }, provenanceArguments: { z: 'liaison' }, sequence: 1000, horodatage: '2030-06-15T12:00:00.000Z',
    }),
  ];
  assert.deepEqual(cooccurrencesSituationAction(t1), cooccurrencesSituationAction(t2));
});

// --- L. capacités triées alphabétiquement, jamais par fréquence --------------------------------------
test('cooccurrencesSituationAction() : L. capacités triées par nom, jamais par fréquence décroissante', () => {
  const traces = [
    traceAction('l1', 'zaccede zorbo zordre zkelmi', 'zrecherche'), // nom alphabétiquement après, mais 1 seule occurrence
    traceAction('l2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceAction('l3', 'zaccede zgamma zordre zdelta', 'accessibilite'),
    traceAction('l4', 'zaccede zuno zordre zdos', 'accessibilite'),
  ];
  const rapport = cooccurrencesSituationAction(traces);
  assert.equal(rapport.length, 1);
  // accessibilite (3 occurrences) doit précéder zrecherche (1 occurrence) uniquement parce que 'a' < 'z',
  // jamais parce qu'elle est plus fréquente.
  assert.deepEqual(rapport[0].capacites, [
    { capacite: 'accessibilite', occurrences: 3 },
    { capacite: 'zrecherche', occurrences: 1 },
  ]);
});

// --- Corpus réel t1-t7 (section 12 du diagnostic) ----------------------------------------------------
test('cooccurrencesSituationAction() : corpus réel t1-t7, homogénéité revérifiée sous le contrat exact', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', 'accessibilite'),
    traceAction('t2', 'zaccede zalpha zordre zbeta', 'accessibilite'),
    traceAction('t3', 'zaccede zuno zordre zdos', 'accessibilite'),
    traceAction('t4', 'zaccede zfoo zautre zbar', 'accessibilite'),
    traceAction('t5', 'zaccede zorbo zordre zkelmi', 'accessibilite'), // répétition exacte de t1
    traceAction('t6', 'cherche zcouleur zbleu', 'recherche'),
    traceAction('t7', 'cherche zforme zvert', 'recherche'),
  ];
  const rapport = trier(cooccurrencesSituationAction(traces));
  assert.equal(rapport.length, 4);

  const large = rapport.find((e) => e.couverture.length === 5);
  assert.deepEqual(large.couverture, ['t1', 't2', 't3', 't4', 't5']);
  assert.deepEqual(large.capacites, [{ capacite: 'accessibilite', occurrences: 5 }]);

  const moyen = rapport.find((e) => e.couverture.length === 4);
  assert.deepEqual(moyen.couverture, ['t1', 't2', 't3', 't5']);
  assert.deepEqual(moyen.capacites, [{ capacite: 'accessibilite', occurrences: 4 }]);

  const etroit = rapport.find((e) => e.couverture.length === 2 && e.couverture.includes('t1'));
  assert.deepEqual(etroit.couverture, ['t1', 't5']);
  assert.deepEqual(etroit.capacites, [{ capacite: 'accessibilite', occurrences: 2 }]);

  const recherche = rapport.find((e) => e.couverture.includes('t6'));
  assert.deepEqual(recherche.couverture, ['t6', 't7']);
  assert.deepEqual(recherche.capacites, [{ capacite: 'recherche', occurrences: 2 }]);

  for (const e of rapport) assert.equal(e.excluesCapaciteInvalide, 0);
});
// === FIN_TEST_COOCCURRENCES_SITUATION_ACTION ===
