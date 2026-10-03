// === DEBUT_TEST_RETOURS_PAR_STRUCTURE ===
// ÉTAPE 5.6 — « JONCTION DES STRUCTURES DE TRACE AVEC LEURS RETOURS HUMAINS BRUTS » (décision
// ChatGPT, 03/10/2026, suite au diagnostic 5.5 « QUE PEUT-ON APPRENDRE DE PLUSIEURS CHAÎNES
// TRACE → EXPÉRIENCE → JUGEMENT ? »). Ces tests figent le contrat exact du cadrage : une JONCTION
// pure entre vueDescriptive() (forme/couverture) et vueRetoursSurTrace() (identité T→E→J), sans
// aucun deuxième moteur de motifs/structure/correspondance/jugement, sans agrégat, sans sémantique
// de récompense.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vueRetoursParStructure } from '../app/langage/retours-par-structure.js';
import { vueRetoursSurTrace } from '../app/langage/retours-traces.js';

function traceAction(id, texteBrut, extra = {}) {
  return {
    id, voie: 'action', capacite: 'cap', resultat: {}, argumentsUtilises: {},
    contexte: { texteBrut, tokens: [] }, ...extra,
  };
}
function traceRejeu(id, texteBrut, extra = {}) {
  return {
    id, voie: 'rejeu', capacite: 'cap', resultat: {}, argumentsUtilises: {},
    contexte: { texteBrut, tokens: [] }, ...extra,
  };
}
function traceComposition(id, extra = {}) {
  return {
    id, voie: 'composition', capacite: 'cap', resultat: {}, argumentsUtilises: {},
    contexte: null, ...extra,
  };
}
function jugement(valeur, date) {
  return { origine: 'jugement-christophe', donnees: { jugement: valeur, date } };
}
function autre(date = '2026-01-01T00:00:00.000Z') {
  return { origine: 'attente-hypothese', donnees: { hypotheseId: 'h1', attendu: 'correct', date } };
}
function experience(id, idTrace, {
  date = '2026-01-01T00:00:00.000Z', interpretations = [], texteRecu = 'recu', texteRepondu = 'repondu',
} = {}) {
  return {
    id, texteRecu, texteRepondu,
    referenceTrace: idTrace != null ? { idTrace } : null,
    interpretations, date,
  };
}
// Motif de base réutilisé par la plupart des tests : deux traces action partageant exactement
// "zaccede ? zordre ?" (ancres position 0/2, variables position 1/3) -- vérifié indépendamment
// (vueDescriptive([a1,a2])) avant l'écriture de ces tests : produit TOUJOURS un seul élément de
// couverture ['a1','a2'] triée.
function motifBase(idA, idB) {
  return [
    traceAction(idA, 'zaccede zorbo zordre zkelmi'),
    traceAction(idB, 'zaccede zalpha zordre zbeta'),
  ];
}
function unSeulElement(vue) {
  assert.equal(vue.length, 1);
  return vue[0];
}
function traceDeCouverture(element, idTrace) {
  const t = element.traces.find((x) => x.idTrace === idTrace);
  assert.ok(t, `aucune entrée de couverture pour ${idTrace}`);
  return t;
}

// --- A. AUCUNE FORME ------------------------------------------------------------------------
test('A. aucune trace -> aucune forme -> []', () => {
  assert.deepEqual(vueRetoursParStructure([], []), []);
});
test('A. une seule trace exploitable (seuilMin non atteint) -> []', () => {
  assert.deepEqual(vueRetoursParStructure([traceAction('x', 'zaccede zorbo zordre zkelmi')], []), []);
});

// --- B. UNE FORME, AUCUNE E ------------------------------------------------------------------
test('B. une forme, aucune expérience référencée -> traces présentes, experiences/evenements vides', () => {
  const traces = motifBase('a1', 'a2');
  const element = unSeulElement(vueRetoursParStructure(traces, []));
  assert.deepEqual(element.couverture, ['a1', 'a2']);
  assert.equal(element.traces.length, 2);
  for (const t of element.traces) {
    assert.deepEqual(t.experiences, []);
  }
  assert.deepEqual(element.evenements, []);
});

// --- C. UNE FORME, E SANS JUGEMENT ------------------------------------------------------------
test('C. E référencée sans aucun jugement -> experiences non vide, aucun événement', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [experience('e1', 'a1', { interpretations: [] })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  const ta1 = traceDeCouverture(element, 'a1');
  assert.equal(ta1.experiences.length, 1);
  assert.equal(ta1.experiences[0].id, 'e1');
  assert.deepEqual(element.evenements, []);
});

// --- D/E. UN SEUL JUGEMENT ---------------------------------------------------------------------
test('D. E -> ✓ : un événement correct', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [experience('e1', 'a1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.deepEqual(element.evenements, [{ idTrace: 'a1', idExperience: 'e1', jugement: 'correct', date: '2026-01-02T00:00:00.000Z' }]);
});
test('E. E -> ✗ : un événement incorrect', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [experience('e1', 'a2', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.deepEqual(element.evenements, [{ idTrace: 'a2', idExperience: 'e1', jugement: 'incorrect', date: '2026-01-02T00:00:00.000Z' }]);
});

// --- F/G. JUGEMENTS SUCCESSIFS SUR LA MÊME E ---------------------------------------------------
test('F. E -> ✓ puis ✗ : deux événements distincts, aucune fusion', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [experience('e1', 'a1', {
    interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z'), jugement('incorrect', '2026-01-03T00:00:00.000Z')],
  })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.deepEqual(element.evenements, [
    { idTrace: 'a1', idExperience: 'e1', jugement: 'correct', date: '2026-01-02T00:00:00.000Z' },
    { idTrace: 'a1', idExperience: 'e1', jugement: 'incorrect', date: '2026-01-03T00:00:00.000Z' },
  ]);
});
test('G. E -> ✗ puis ✓ : les deux conservés, dans l\'ordre de leur date', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [experience('e1', 'a1', {
    interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z'), jugement('correct', '2026-01-03T00:00:00.000Z')],
  })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.deepEqual(element.evenements, [
    { idTrace: 'a1', idExperience: 'e1', jugement: 'incorrect', date: '2026-01-02T00:00:00.000Z' },
    { idTrace: 'a1', idExperience: 'e1', jugement: 'correct', date: '2026-01-03T00:00:00.000Z' },
  ]);
});
test('deux jugements de même date exacte sur la même E -> aucun n\'est perdu (tri par position)', () => {
  const traces = motifBase('a1', 'a2');
  const meme = '2026-01-02T00:00:00.000Z';
  const experiences = [experience('e1', 'a1', {
    interpretations: [jugement('incorrect', meme), jugement('correct', meme)],
  })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.equal(element.evenements.length, 2);
  assert.deepEqual(element.evenements, [
    { idTrace: 'a1', idExperience: 'e1', jugement: 'incorrect', date: meme },
    { idTrace: 'a1', idExperience: 'e1', jugement: 'correct', date: meme },
  ]);
});

// --- H. PLUSIEURS E POUR UNE MÊME T -------------------------------------------------------------
test('H. plusieurs expériences pour la même T -> un événement par expérience', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [
    experience('e1', 'a1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 'a1', { interpretations: [jugement('incorrect', '2026-01-03T00:00:00.000Z')] }),
  ];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.equal(element.evenements.length, 2);
  assert.ok(element.evenements.some((e) => e.idExperience === 'e1' && e.jugement === 'correct'));
  assert.ok(element.evenements.some((e) => e.idExperience === 'e2' && e.jugement === 'incorrect'));
});

// --- I. PLUSIEURS T DANS UNE MÊME COUVERTURE, RETOURS DIFFÉRENTS -------------------------------
test('I. plusieurs T dans une même couverture, retours différents -> rattachés à leur propre idTrace', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [
    experience('e1', 'a1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 'a2', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] }),
  ];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.ok(element.evenements.some((e) => e.idTrace === 'a1' && e.jugement === 'correct'));
  assert.ok(element.evenements.some((e) => e.idTrace === 'a2' && e.jugement === 'incorrect'));
});

// --- J/K. TROIS ÉTATS D'UNE TRACE COUVERTE : SANS E / AVEC E SANS JUGEMENT / AVEC JUGEMENT -----
test('J/K. T sans E, T avec E sans jugement, T avec jugement : les trois restent distincts', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi'),
    traceAction('t2', 'zaccede zalpha zordre zbeta'),
    traceAction('t3', 'zaccede zuno zordre zdos'),
    traceAction('t4', 'zaccede zfoo zordre zbar'),
  ];
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }), // t1 : avec jugement
    experience('e2', 't4', { interpretations: [] }), // t4 : E référencée, sans jugement
    // t2 : aucune E (non référencée du tout)
    // t3 : laissée totalement sans aucune référence
  ];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.equal(element.couverture.length, 4);

  const t1 = traceDeCouverture(element, 't1');
  assert.equal(t1.experiences.length, 1);
  assert.ok(element.evenements.some((e) => e.idTrace === 't1' && e.jugement === 'correct'));

  const t4 = traceDeCouverture(element, 't4');
  assert.equal(t4.experiences.length, 1);
  assert.equal(t4.experiences[0].interpretations.length, 0);
  assert.ok(!element.evenements.some((e) => e.idTrace === 't4'));

  const t2 = traceDeCouverture(element, 't2');
  assert.deepEqual(t2.experiences, []);

  const t3 = traceDeCouverture(element, 't3');
  assert.deepEqual(t3.experiences, []);

  // t2 (aucune E) et t4 (E sans jugement) ne doivent JAMAIS être confondus : experiences vide
  // pour l'une, non vide (mais sans événement) pour l'autre.
  assert.notDeepEqual(t2.experiences, t4.experiences);
});

// --- L. EXPÉRIENCE SANS referenceTrace : IGNORÉE ------------------------------------------------
test('L. expérience sans referenceTrace -> totalement ignorée', () => {
  const traces = motifBase('a1', 'a2');
  const sansRef = { id: 'orpheline', texteRecu: 'x', texteRepondu: 'y', referenceTrace: null, interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')], date: '2026-01-01T00:00:00.000Z' };
  const avecOrpheline = vueRetoursParStructure(traces, [sansRef]);
  const sansOrpheline = vueRetoursParStructure(traces, []);
  assert.deepEqual(avecOrpheline, sansOrpheline);
});

// --- M. EXPÉRIENCE RÉFÉRENÇANT UNE TRACE HORS COUVERTURE : NE FUIT PAS --------------------------
test('M. expérience référençant une trace hors couverture -> ne fuit jamais dans la forme', () => {
  const traces = motifBase('a1', 'a2');
  const horsCouverture = experience('e-hors', 'zzz-inconnue', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] });
  const avec = vueRetoursParStructure(traces, [horsCouverture]);
  const sans = vueRetoursParStructure(traces, []);
  assert.deepEqual(avec, sans);
});

// --- N/O/P/Q. DEUX FORMES DISTINCTES, AUCUNE FUSION MÊME À CHAMPS PARTAGÉS ----------------------
test('N/O/P/Q. deux formes distinctes (même capacité/arguments/resultat) -> retours jamais fusionnés', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'memeCap', argumentsUtilises: { x: 1 }, resultat: { ok: true } }),
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'memeCap', argumentsUtilises: { x: 1 }, resultat: { ok: true } }),
    traceAction('t3', 'zaccede zuno zordre zdos', { capacite: 'memeCap', argumentsUtilises: { x: 1 }, resultat: { ok: true } }),
    traceAction('t4', 'zaccede zfoo zordre zbar', { capacite: 'memeCap', argumentsUtilises: { x: 1 }, resultat: { ok: true } }),
    traceAction('t5', 'cherche zbleu zforme zronde', { capacite: 'memeCap', argumentsUtilises: { x: 1 }, resultat: { ok: true } }),
    traceAction('t6', 'cherche zvert zforme zcarre', { capacite: 'memeCap', argumentsUtilises: { x: 1 }, resultat: { ok: true } }),
  ];
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 't5', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] }),
  ];
  const vue = vueRetoursParStructure(traces, experiences);
  assert.equal(vue.length, 2); // jamais fusionnées malgré capacite/argumentsUtilises/resultat identiques.
  const forme1 = vue.find((e) => e.couverture.includes('t1'));
  const forme2 = vue.find((e) => e.couverture.includes('t5'));
  assert.deepEqual(forme1.couverture, ['t1', 't2', 't3', 't4']);
  assert.deepEqual(forme2.couverture, ['t5', 't6']);
  assert.ok(forme1.evenements.every((e) => ['t1', 't2', 't3', 't4'].includes(e.idTrace)));
  assert.ok(forme2.evenements.every((e) => ['t5', 't6'].includes(e.idTrace)));
  assert.equal(forme1.evenements.length, 1);
  assert.equal(forme2.evenements.length, 1);
});

// --- R/S. TRACES REJEU/COMPOSITION : VISIBLES VIA 5.4 SEULEMENT, JAMAIS DE FORME ICI -------------
test('R. trace rejeu référencée -> aucune forme ici, mais vueRetoursSurTrace() la décrit toujours isolément', () => {
  const traces = [...motifBase('a1', 'a2'), traceRejeu('r1', 'zaccede zorbo zordre zkelmi')];
  const experiences = [experience('e1', 'r1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] })];
  const vue = vueRetoursParStructure(traces, experiences);
  for (const element of vue) {
    assert.ok(!element.couverture.includes('r1'));
    assert.ok(!element.traces.some((t) => t.idTrace === 'r1'));
    assert.ok(!element.evenements.some((e) => e.idTrace === 'r1'));
  }
  // Non-interférence : la primitive 5.4, elle, continue de décrire r1 directement.
  const direct = vueRetoursSurTrace('r1', traces, experiences);
  assert.equal(direct.etat, 'trouvee');
  assert.equal(direct.experiences.length, 1);
});
test('S. trace composition référencée -> même principe (aucune forme, visible via 5.4 isolément)', () => {
  const traces = [...motifBase('a1', 'a2'), traceComposition('c1')];
  const experiences = [experience('e1', 'c1', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] })];
  const vue = vueRetoursParStructure(traces, experiences);
  for (const element of vue) {
    assert.ok(!element.couverture.includes('c1'));
  }
  const direct = vueRetoursSurTrace('c1', traces, experiences);
  assert.equal(direct.etat, 'trouvee');
  assert.equal(direct.experiences.length, 1);
});

// --- T. RÉPÉTITION EXACTE DE DEUX ÉVÉNEMENTS PERSISTÉS : DEUX ÉVÉNEMENTS CONSERVÉS --------------
test('T. deux interprétations jugement-christophe strictement identiques -> jamais dédupliquées', () => {
  const traces = motifBase('a1', 'a2');
  const meme = '2026-01-02T00:00:00.000Z';
  const experiences = [experience('e1', 'a1', { interpretations: [jugement('correct', meme), jugement('correct', meme)] })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.equal(element.evenements.length, 2);
  assert.deepEqual(element.evenements[0], element.evenements[1]);
});

// --- U/V. PERMUTATIONS : DÉTERMINISME INDÉPENDANT DE L'ORDRE D'ENTRÉE ---------------------------
// Canonicalisation pour la comparaison UNIQUEMENT : `forme` (déjà triée par signatureForme(),
// vue-traces.js) et `couverture` sont garanties déterministes par vueDescriptive() elle-même ; le
// `rapport` BRUT, lui, a toujours exposé un ordre interne dépendant de l'ordre de première rencontre
// dans le corpus reçu (fait déjà documenté et accepté AVANT ce chantier -- voir projectionCanonique()
// dans vue-traces.test.mjs, qui ne compare jamais non plus le rapport brut). Cette primitive ne
// recalcule ni ne corrige cette garantie déjà existante : elle la REÇOIT telle quelle.
function canonique(vue) {
  return vue
    .map((e) => ({ forme: e.forme, couverture: e.couverture, traces: e.traces, evenements: e.evenements }))
    .sort((a, b) => a.couverture.join(',').localeCompare(b.couverture.join(',')));
}
test('U. permutation de l\'ordre des traces -> même forme/couverture/traces/évenements', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi'),
    traceAction('t2', 'zaccede zalpha zordre zbeta'),
    traceAction('t3', 'zaccede zuno zordre zdos'),
    traceAction('t4', 'zaccede zfoo zordre zbar'),
  ];
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 't3', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] }),
  ];
  const original = canonique(vueRetoursParStructure(traces, experiences));
  const inverse = canonique(vueRetoursParStructure([...traces].reverse(), experiences));
  const melange = canonique(vueRetoursParStructure([traces[2], traces[0], traces[3], traces[1]], experiences));
  assert.deepEqual(inverse, original);
  assert.deepEqual(melange, original);
});
test('V. permutation de l\'ordre des expériences -> résultat identique', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [
    experience('e1', 'a1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 'a1', { interpretations: [jugement('incorrect', '2026-01-03T00:00:00.000Z')] }),
    experience('e3', 'a2', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
  ];
  const original = vueRetoursParStructure(traces, experiences);
  const inverse = vueRetoursParStructure(traces, [...experiences].reverse());
  const melange = vueRetoursParStructure(traces, [experiences[2], experiences[0], experiences[1]]);
  assert.deepEqual(inverse, original);
  assert.deepEqual(melange, original);
});

// --- W. INTERPRÉTATION AUTRE QUE jugement-christophe : NE DEVIENT PAS ÉVÉNEMENT J ----------------
test('W. interprétation d\'une autre origine -> jamais un événement J, mais E reste visible', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [experience('e1', 'a1', { interpretations: [autre()] })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.deepEqual(element.evenements, []);
  const ta1 = traceDeCouverture(element, 'a1');
  assert.equal(ta1.experiences.length, 1);
  assert.equal(ta1.experiences[0].interpretations.length, 1);
  assert.equal(ta1.experiences[0].interpretations[0].origine, 'attente-hypothese');
});

// --- X. JUGEMENT MALFORMÉ/NON EXPLOITABLE : COMPORTEMENT CONSERVATEUR, AUCUNE FABRICATION -------
test('X. jugement de valeur/date non conformes -> exposé tel quel, jamais corrigé ni filtré, jamais de crash', () => {
  const traces = motifBase('a1', 'a2');
  const malforme = { origine: 'jugement-christophe', donnees: { jugement: 'peut-etre', date: 'date-invalide' } };
  const experiences = [experience('e1', 'a1', { interpretations: [malforme] })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.deepEqual(element.evenements, [{ idTrace: 'a1', idExperience: 'e1', jugement: 'peut-etre', date: 'date-invalide' }]);
});
test('X. donnees absent sur une interprétation jugement-christophe -> exposé sans fabriquer de valeur, aucun crash', () => {
  const traces = motifBase('a1', 'a2');
  const sansDonnees = { origine: 'jugement-christophe' };
  const experiences = [experience('e1', 'a1', { interpretations: [sansDonnees] })];
  const element = unSeulElement(vueRetoursParStructure(traces, experiences));
  assert.deepEqual(element.evenements, [{ idTrace: 'a1', idExperience: 'e1', jugement: undefined, date: undefined }]);
});

// --- Y/Z. PURETÉ / IMMUTABILITÉ ------------------------------------------------------------------
test('Y. aucune mutation des traces/experiences reçues', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [experience('e1', 'a1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] })];
  const avant = JSON.stringify({ traces, experiences });
  vueRetoursParStructure(traces, experiences);
  assert.equal(JSON.stringify({ traces, experiences }), avant);
});
test('Z. mutation du résultat retourné ne modifie jamais les entrées', () => {
  const traces = motifBase('a1', 'a2');
  const experiences = [experience('e1', 'a1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] })];
  const avant = JSON.stringify({ traces, experiences });
  const vue = vueRetoursParStructure(traces, experiences);
  vue[0].evenements.push({ idTrace: 'fabrique', idExperience: 'x', jugement: 'correct', date: 'x' });
  vue[0].traces[0].experiences.push({ fabrique: true });
  delete vue[0].traces[0].trace.capacite;
  assert.equal(JSON.stringify({ traces, experiences }), avant);
});

// --- CONTRAT DE SORTIE : AUCUN CHAMP AGRÉGÉ/SCORE/SÉMANTIQUE DE RÉCOMPENSE -----------------------
const CHAMPS_INTERDITS = [
  'score', 'confiance', 'majorite', 'ratio', 'frequence', 'positif', 'negatif',
  'succes', 'echec', 'bon', 'mauvais', 'recompense', 'penalite', 'attente', 'verdict', 'utile',
];
test('contrat : aucun champ agrégé/score/sémantique de récompense à aucun niveau de la sortie', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi'),
    traceAction('t2', 'zaccede zalpha zordre zbeta'),
    traceAction('t3', 'zaccede zuno zordre zdos'),
    traceAction('t4', 'zaccede zfoo zordre zbar'),
  ];
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e3', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e4', 't1', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] }),
  ];
  const vue = vueRetoursParStructure(traces, experiences);
  const texte = JSON.stringify(vue);
  for (const champ of CHAMPS_INTERDITS) {
    assert.ok(!texte.toLowerCase().includes(champ), `champ interdit détecté : ${champ}`);
  }
  // Champs exacts attendus à chaque niveau -- ni plus, ni moins.
  assert.deepEqual(Object.keys(vue[0]).sort(), ['couverture', 'evenements', 'forme', 'rapport', 'traces']);
  assert.deepEqual(Object.keys(vue[0].traces[0]).sort(), ['etat', 'experiences', 'idTrace', 'trace']);
  assert.deepEqual(Object.keys(vue[0].evenements[0]).sort(), ['date', 'idExperience', 'idTrace', 'jugement']);
});

// --- STATIQUE : RÉUTILISATION STRICTE, AUCUN DEUXIÈME MOTEUR, DORMANCE TOTALE --------------------
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(ICI, '../app/langage/retours-par-structure.js'), 'utf8');

test('[STATIQUE] réutilise strictement vueDescriptive() et vueRetoursSurTrace(), aucun import d\'un autre moteur', () => {
  assert.ok(SOURCE.includes("from './vue-traces.js'"));
  assert.ok(SOURCE.includes('vueDescriptive'));
  assert.ok(SOURCE.includes("from './retours-traces.js'"));
  assert.ok(SOURCE.includes('vueRetoursSurTrace'));
  assert.ok(!/from '\.\/induction\.js'/.test(SOURCE));
  assert.ok(!/from '\.\/extraction\.js'/.test(SOURCE));
  assert.ok(!/from '\.\/connaissances\.js'/.test(SOURCE));
});

function listerFichiersJs(dir) {
  const out = [];
  for (const entree of readdirSync(dir)) {
    const p = path.join(dir, entree);
    if (statSync(p).isDirectory()) out.push(...listerFichiersJs(p));
    else if (entree.endsWith('.js')) out.push(p);
  }
  return out;
}
// MISE À JOUR DÉLIBÉRÉE (ÉTAPE 5.8, décision ChatGPT « CHANTIER — JONCTION FORME + CAPACITÉ +
// RETOURS HUMAINS BRUTS », 03/10/2026) : le cadrage de 5.8 demande EXPLICITEMENT de réutiliser
// vueRetoursParStructure() plutôt que de réimplémenter la jonction identité T→E→J. Même principe
// déjà appliqué en 5.6 à la garde de vueRetoursSurTrace() (tests/retours-traces.test.mjs) :
// retours-par-capacite.js devient son premier et unique consommateur légitime -- jamais un
// branchement comportemental. La garde reste stricte pour tout autre fichier.
test('[STATIQUE] vueRetoursParStructure() n\'est importée par aucun autre fichier de app/ que sa primitive sœur dormante (dormante)', () => {
  const appDir = path.join(ICI, '../app');
  const fichiers = listerFichiersJs(appDir)
    .filter((p) => !p.endsWith('retours-par-structure.js') && !p.endsWith('retours-par-capacite.js'));
  for (const f of fichiers) {
    const contenu = readFileSync(f, 'utf8');
    assert.ok(!contenu.includes('retours-par-structure'), `${f} référence retours-par-structure`);
    assert.ok(!contenu.includes('vueRetoursParStructure'), `${f} référence vueRetoursParStructure`);
  }
});
test('[STATIQUE] retours-par-structure.js n\'importe aucun accès au magasin', () => {
  assert.ok(!/\bindexedDB\b/.test(SOURCE));
});
// === FIN_TEST_RETOURS_PAR_STRUCTURE ===
