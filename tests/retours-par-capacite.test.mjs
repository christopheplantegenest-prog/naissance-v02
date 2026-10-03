// === DEBUT_TEST_RETOURS_PAR_CAPACITE ===
// ÉTAPE 5.8 — « JONCTION FORME + CAPACITÉ + RETOURS HUMAINS BRUTS » (décision ChatGPT, 03/10/2026,
// suite au diagnostic 5.7). Ces tests figent le contrat exact du cadrage : l'unité descriptive
// devient F+capacité (jamais F seule), par JONCTION stricte de cooccurrencesSituationAction() et
// vueRetoursParStructure(), sans aucune agrégation/score/majorité/attente/verdict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vueRetoursParFormeEtCapacite } from '../app/langage/retours-par-capacite.js';
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
function experience(id, idTrace, {
  date = '2026-01-01T00:00:00.000Z', interpretations = [], texteRecu = 'recu', texteRepondu = 'repondu',
} = {}) {
  return {
    id, texteRecu, texteRepondu,
    referenceTrace: idTrace != null ? { idTrace } : null,
    interpretations, date,
  };
}
// Corpus de base : une forme F unique, deux capacités A et B, deux traces chacune.
function corpusDeuxCapacites() {
  return [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'A' }),
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'A' }),
    traceAction('t3', 'zaccede zuno zordre zdos', { capacite: 'B' }),
    traceAction('t4', 'zaccede zfoo zordre zbar', { capacite: 'B' }),
  ];
}
// Corpus du contre-exemple 13 du cadrage : A répète exactement le même texte, B varie.
function corpusContreExemple13() {
  return [
    traceAction('t1', 'zpivot z1 zmid x', { capacite: 'A' }),
    traceAction('t2', 'zpivot z1 zmid x', { capacite: 'A' }), // répétition EXACTE de t1
    traceAction('t3', 'zpivot z2 zmid y', { capacite: 'B' }),
    traceAction('t4', 'zpivot z3 zmid z', { capacite: 'B' }),
  ];
}
function formeDeCouverture(vue, idsAttendus) {
  const cle = idsAttendus.slice().sort().join(',');
  const e = vue.find((el) => el.couverture.slice().sort().join(',') === cle);
  assert.ok(e, `aucun élément de couverture ${cle}`);
  return e;
}
function parCapacite(vue, couvertureIds, capacite) {
  const elements = vue.filter((el) => el.couverture.slice().sort().join(',') === couvertureIds.slice().sort().join(',') && el.capacite === capacite);
  assert.equal(elements.length, 1, `exactement un élément attendu pour capacité ${capacite}`);
  return elements[0];
}

// --- A/B. UNE SEULE CAPACITÉ VS DEUX CAPACITÉS --------------------------------------------------
test('A. F avec une seule capacité -> un seul élément F+capacité', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'A' }),
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'A' }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, []);
  assert.equal(vue.length, 1);
  assert.equal(vue[0].capacite, 'A');
  assert.deepEqual(vue[0].sousGroupe, ['t1', 't2']);
});
test('B. F avec capacités A et B -> deux éléments distincts', () => {
  const traces = corpusDeuxCapacites();
  const vue = vueRetoursParFormeEtCapacite(traces, []);
  assert.equal(vue.length, 2);
  assert.deepEqual(vue.map((e) => e.capacite).sort(), ['A', 'B']);
});

// --- C. SÉPARATION STRICTE MÊME À JUGEMENTS OPPOSÉS ----------------------------------------------
test('C. même F : A->✓, B->✗, séparation stricte', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [
    experience('eA', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('eB', 't3', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  const b = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'B');
  assert.deepEqual(a.evenements, [{ idTrace: 't1', idExperience: 'eA', jugement: 'correct', date: '2026-01-02T00:00:00.000Z' }]);
  assert.deepEqual(b.evenements, [{ idTrace: 't3', idExperience: 'eB', jugement: 'incorrect', date: '2026-01-02T00:00:00.000Z' }]);
});

// --- D/E. MÊMES ARGUMENTS / MÊME RESULTAT : AUCUNE FUSION ----------------------------------------
test('D. même F : A et B avec mêmes arguments -> toujours deux éléments séparés', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'A', argumentsUtilises: { x: 1 } }),
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'A', argumentsUtilises: { x: 1 } }),
    traceAction('t3', 'zaccede zuno zordre zdos', { capacite: 'B', argumentsUtilises: { x: 1 } }),
    traceAction('t4', 'zaccede zfoo zordre zbar', { capacite: 'B', argumentsUtilises: { x: 1 } }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, []);
  assert.equal(vue.length, 2);
});
test('E. même F : A et B avec même resultat -> toujours deux éléments séparés', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'A', resultat: { ok: true } }),
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'A', resultat: { ok: true } }),
    traceAction('t3', 'zaccede zuno zordre zdos', { capacite: 'B', resultat: { ok: true } }),
    traceAction('t4', 'zaccede zfoo zordre zbar', { capacite: 'B', resultat: { ok: true } }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, []);
  assert.equal(vue.length, 2);
});

// --- F/G/H. TRACE SANS E / AVEC E SANS J / AVEC JUGEMENT -----------------------------------------
test('F/G/H. trace A sans E, trace A avec E sans J, trace A avec E->✓ : distinction conservée', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'A' }), // sans E
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'A' }), // E sans J
    traceAction('t3', 'zaccede zuno zordre zdos', { capacite: 'A' }), // E -> ✓
    traceAction('t4', 'zaccede zfoo zordre zbar', { capacite: 'A' }),
  ];
  const experiences = [
    experience('e2', 't2', { interpretations: [] }),
    experience('e3', 't3', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  const t1 = a.traces.find((t) => t.idTrace === 't1');
  const t2 = a.traces.find((t) => t.idTrace === 't2');
  const t3 = a.traces.find((t) => t.idTrace === 't3');
  assert.deepEqual(t1.experiences, []);
  assert.equal(t2.experiences.length, 1);
  assert.equal(t2.experiences[0].interpretations.length, 0);
  assert.ok(!a.evenements.some((e) => e.idTrace === 't2'));
  assert.ok(a.evenements.some((e) => e.idTrace === 't3' && e.jugement === 'correct'));
  assert.notDeepEqual(t1.experiences, t2.experiences);
});

// --- I/J. CONTRADICTIONS --------------------------------------------------------------------------
test('I. trace A avec E->✓ puis ✗ : deux événements', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [experience('e1', 't1', {
    interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z'), jugement('incorrect', '2026-01-03T00:00:00.000Z')],
  })];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  assert.equal(a.evenements.length, 2);
});
test('J. trace A avec E1->✓ et E2->✗ : deux expériences distinctes', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 't1', { interpretations: [jugement('incorrect', '2026-01-03T00:00:00.000Z')] }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  assert.equal(a.evenements.length, 2);
  assert.ok(a.evenements.some((e) => e.idExperience === 'e1'));
  assert.ok(a.evenements.some((e) => e.idExperience === 'e2'));
});

// --- K. DEUX FORMES DIFFÉRENTES, MÊME CAPACITÉ A : RESTENT DISTINCTES ----------------------------
test('K. deux formes différentes avec même capacité A -> restent distinctes', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'A' }),
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'A' }),
    traceAction('t5', 'cherche zbleu zforme zronde', { capacite: 'A' }),
    traceAction('t6', 'cherche zvert zforme zcarre', { capacite: 'A' }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, []);
  assert.equal(vue.length, 2);
  assert.ok(vue.every((e) => e.capacite === 'A'));
  const couvertures = vue.map((e) => e.couverture.slice().sort().join(','));
  assert.notEqual(couvertures[0], couvertures[1]);
});

// --- L/M/N. RÉPÉTITIONS/VARIATION DU SOUS-GROUPE (contre-exemple 13 du cadrage) ------------------
test('L/M/N. diversité globale de F (venant de B) jamais attribuée à A (contre-exemple 13)', () => {
  const traces = corpusContreExemple13();
  const vue = vueRetoursParFormeEtCapacite(traces, []);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  const b = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'B');
  // A : deux répétitions EXACTES du même texte -> aucune variation réelle.
  assert.equal(a.rapportSousGroupe.ok, true);
  assert.equal(a.rapportSousGroupe.occurrences, 2);
  assert.equal(a.rapportSousGroupe.exemplesDistincts, 1);
  // B : deux exemples textuellement distincts -> variation réelle propre à B.
  assert.equal(b.rapportSousGroupe.ok, true);
  assert.equal(b.rapportSousGroupe.occurrences, 2);
  assert.equal(b.rapportSousGroupe.exemplesDistincts, 2);
  // La diversité globale de F (qui existe, portée par B) n'est JAMAIS attribuée à A.
  assert.notDeepEqual(a.rapportSousGroupe, b.rapportSousGroupe);
});

// --- O/P. REJEU : EXCLU DU SOUS-GROUPE, MÊME CONTRAIRE ------------------------------------------
test('O. action A + plusieurs rejeux A -> rejeux exclus du sous-groupe (aucune augmentation)', () => {
  const sansRejeu = corpusDeuxCapacites();
  const avecRejeux = [
    ...sansRejeu,
    traceRejeu('r1', 'zaccede zorbo zordre zkelmi', { capacite: 'A' }),
    traceRejeu('r2', 'zaccede zalpha zordre zbeta', { capacite: 'A' }),
  ];
  const vueSans = vueRetoursParFormeEtCapacite(sansRejeu, []);
  const vueAvec = vueRetoursParFormeEtCapacite(avecRejeux, []);
  assert.deepEqual(vueAvec, vueSans); // aucune augmentation de couverture/diversité/sousGroupe.
});
test('P. rejeu A avec retour contraire -> n\'entre jamais dans les événements de F+A', () => {
  const traces = [...corpusDeuxCapacites(), traceRejeu('r1', 'zaccede zorbo zordre zkelmi', { capacite: 'A' })];
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e-rejeu', 'r1', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  assert.ok(!a.evenements.some((e) => e.idTrace === 'r1'));
  assert.deepEqual(a.sousGroupe, ['t1', 't2']);
  // Le retour du rejeu reste disponible ailleurs, via 5.4, jamais perdu.
  const direct = vueRetoursSurTrace('r1', traces, experiences);
  assert.equal(direct.experiences.length, 1);
});

// --- Q. COMPOSITION : N'ENTRE JAMAIS -------------------------------------------------------------
test('Q. composition A avec ✓ -> n\'entre jamais dans F+A', () => {
  const traces = [...corpusDeuxCapacites(), traceComposition('c1', { capacite: 'A' })];
  const experiences = [experience('e-c1', 'c1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] })];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  assert.ok(!a.sousGroupe.includes('c1'));
  assert.ok(!a.evenements.some((e) => e.idTrace === 'c1'));
});

// --- R. FUITE D'EXPÉRIENCE HORS SOUS-GROUPE -------------------------------------------------------
test('R. expérience référant une trace hors sous-groupe -> aucune fuite', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [experience('e-hors', 'zzz-inconnue', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] })];
  const avec = vueRetoursParFormeEtCapacite(traces, experiences);
  const sans = vueRetoursParFormeEtCapacite(traces, []);
  assert.deepEqual(avec, sans);
});

// --- S/T. RÉPÉTITIONS / CONTRADICTIONS : JAMAIS DÉDUPLIQUÉES -------------------------------------
test('S. jugements identiques répétés -> événements distincts', () => {
  const traces = corpusDeuxCapacites();
  const meme = '2026-01-02T00:00:00.000Z';
  const experiences = [experience('e1', 't1', { interpretations: [jugement('correct', meme), jugement('correct', meme)] })];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  assert.equal(a.evenements.length, 2);
});
test('T. jugements contradictoires -> événements distincts', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [experience('e1', 't1', {
    interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z'), jugement('correct', '2026-01-03T00:00:00.000Z')],
  })];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const a = parCapacite(vue, ['t1', 't2', 't3', 't4'], 'A');
  assert.equal(a.evenements.length, 2);
});

// --- U/V. PERMUTATIONS : DÉTERMINISME -------------------------------------------------------------
function canonique(vue) {
  return vue
    .map((e) => ({ capacite: e.capacite, couverture: e.couverture, sousGroupe: e.sousGroupe, provenance: e.provenance, traces: e.traces, evenements: e.evenements }))
    .sort((a, b) => (a.couverture.join(',') + a.capacite).localeCompare(b.couverture.join(',') + b.capacite));
}
test('U. permutation de l\'ordre des traces -> même vue canonique', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 't3', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] }),
  ];
  const original = canonique(vueRetoursParFormeEtCapacite(traces, experiences));
  const inverse = canonique(vueRetoursParFormeEtCapacite([...traces].reverse(), experiences));
  const melange = canonique(vueRetoursParFormeEtCapacite([traces[2], traces[0], traces[3], traces[1]], experiences));
  assert.deepEqual(inverse, original);
  assert.deepEqual(melange, original);
});
test('V. permutation de l\'ordre des expériences -> même vue canonique', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 't1', { interpretations: [jugement('incorrect', '2026-01-03T00:00:00.000Z')] }),
    experience('e3', 't3', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
  ];
  const original = canonique(vueRetoursParFormeEtCapacite(traces, experiences));
  const inverse = canonique(vueRetoursParFormeEtCapacite(traces, [...experiences].reverse()));
  const melange = canonique(vueRetoursParFormeEtCapacite(traces, [experiences[2], experiences[0], experiences[1]]));
  assert.deepEqual(inverse, original);
  assert.deepEqual(melange, original);
});

// --- W/X. PURETÉ / IMMUTABILITÉ --------------------------------------------------------------------
test('W. aucune mutation des traces/experiences reçues', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] })];
  const avant = JSON.stringify({ traces, experiences });
  vueRetoursParFormeEtCapacite(traces, experiences);
  assert.equal(JSON.stringify({ traces, experiences }), avant);
});
test('X. mutation du résultat retourné ne modifie jamais les entrées', () => {
  const traces = corpusDeuxCapacites();
  const experiences = [experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] })];
  const avant = JSON.stringify({ traces, experiences });
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  vue[0].evenements.push({ idTrace: 'fabrique', idExperience: 'x', jugement: 'correct', date: 'x' });
  vue[0].sousGroupe.push('fabrique');
  delete vue[0].traces[0].trace.capacite;
  assert.equal(JSON.stringify({ traces, experiences }), avant);
});

// --- Y/Z. CONTRAT : AUCUN SCORE/RATIO/MAJORITÉ, AUCUNE COMPARAISON DE resultat --------------------
const CHAMPS_INTERDITS = [
  'score', 'confiance', 'majorite', 'ratio', 'frequence', 'positif', 'negatif',
  'succes', 'echec', 'bon', 'mauvais', 'recompense', 'penalite', 'attente', 'verdict', 'utile',
  'regulier', 'fiable', 'candidat', 'valide',
];
test('Y. aucun champ score/ratio/majorité/attente/verdict à aucun niveau', () => {
  const traces = corpusContreExemple13();
  const experiences = [
    experience('e1', 't1', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e2', 't2', { interpretations: [jugement('correct', '2026-01-02T00:00:00.000Z')] }),
    experience('e3', 't3', { interpretations: [jugement('incorrect', '2026-01-02T00:00:00.000Z')] }),
  ];
  const vue = vueRetoursParFormeEtCapacite(traces, experiences);
  const texte = JSON.stringify(vue).toLowerCase();
  for (const champ of CHAMPS_INTERDITS) {
    assert.ok(!texte.includes(champ), `champ interdit détecté : ${champ}`);
  }
});
test('Z. trace.resultat jamais lu/comparé par cette primitive (résultats différents n\'influent sur rien)', () => {
  const traces = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'A', resultat: { v: 1 } }),
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'A', resultat: { v: 2 } }),
  ];
  const tracesMemeResultat = [
    traceAction('t1', 'zaccede zorbo zordre zkelmi', { capacite: 'A', resultat: { v: 1 } }),
    traceAction('t2', 'zaccede zalpha zordre zbeta', { capacite: 'A', resultat: { v: 1 } }),
  ];
  const vue1 = vueRetoursParFormeEtCapacite(traces, []);
  const vue2 = vueRetoursParFormeEtCapacite(tracesMemeResultat, []);
  // Seul resultat diffère entre les deux corpus -- la description produite (hors trace brute
  // elle-même, pass-through) ne doit jamais en dépendre : sousGroupe/rapportSousGroupe/evenements
  // identiques dans les deux cas.
  assert.deepEqual(vue1.map((e) => ({ sousGroupe: e.sousGroupe, rapportSousGroupe: e.rapportSousGroupe, evenements: e.evenements })),
    vue2.map((e) => ({ sousGroupe: e.sousGroupe, rapportSousGroupe: e.rapportSousGroupe, evenements: e.evenements })));
});

// --- STATIQUE : RÉUTILISATION STRICTE, DORMANCE TOTALE --------------------------------------------
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(ICI, '../app/langage/retours-par-capacite.js'), 'utf8');

test('[STATIQUE] réutilise strictement cooccurrencesSituationAction(), vueRetoursParStructure(), decrireStructure()', () => {
  assert.ok(SOURCE.includes("from './vue-traces.js'"));
  assert.ok(SOURCE.includes('cooccurrencesSituationAction'));
  assert.ok(SOURCE.includes("from './retours-par-structure.js'"));
  assert.ok(SOURCE.includes('vueRetoursParStructure'));
  assert.ok(SOURCE.includes("from './extraction.js'"));
  assert.ok(SOURCE.includes('decrireStructure'));
  assert.ok(!/from '\.\/induction\.js'/.test(SOURCE));
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
test('[STATIQUE] vueRetoursParFormeEtCapacite() n\'est importée par aucun autre fichier de app/ (dormante)', () => {
  const appDir = path.join(ICI, '../app');
  const fichiers = listerFichiersJs(appDir).filter((p) => !p.endsWith('retours-par-capacite.js'));
  for (const f of fichiers) {
    const contenu = readFileSync(f, 'utf8');
    assert.ok(!contenu.includes('retours-par-capacite'), `${f} référence retours-par-capacite`);
    assert.ok(!contenu.includes('vueRetoursParFormeEtCapacite'), `${f} référence vueRetoursParFormeEtCapacite`);
  }
});
test('[STATIQUE] retours-par-capacite.js n\'importe aucun accès au magasin', () => {
  assert.ok(!/\bindexedDB\b/.test(SOURCE));
});
// === FIN_TEST_RETOURS_PAR_CAPACITE ===
