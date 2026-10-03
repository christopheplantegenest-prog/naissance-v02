// === DEBUT_TEST_RETOURS_TRACES ===
// ÉTAPE 5.4 — CHANTIER « VUE DESCRIPTIVE TRACE → EXPÉRIENCES RÉFÉRENCÉES → INTERPRÉTATIONS ».
// vueRetoursSurTrace() est une primitive PURE, DORMANTE : aucune écriture IndexedDB, aucune lecture
// directe du magasin -- elle reçoit explicitement les tableaux déjà lus par l'appelant. Lien T↔E
// UNIQUEMENT par égalité stricte d'id (jamais proximité temporelle/séquence/timestamp/similarité/
// résultat/capacité/voie/arguments). Ne transforme jamais les interprétations (aucune sémantique
// nouvelle sur 'jugement-christophe', aucun score, aucune résolution de contradiction).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { vueRetoursSurTrace } from '../app/langage/retours-traces.js';

function trace(id, extra = {}) {
  return {
    id, sequence: 1, horodatage: '2026-10-03T10:00:00.000Z',
    capacite: 'confrontation', voie: 'action',
    argumentsUtilises: { sujetA: 'zorbo' }, provenanceArguments: { sujetA: 'texte' },
    resultat: { etat: 'inconnu' }, contexte: null, provenancePositions: null,
    ...extra,
  };
}

function experience(id, { referenceTrace = null, interpretations = [], date = '2026-10-03T11:00:00.000Z', texteRecu = 'Quelle est ma couleur ?', texteRepondu = 'Je ne sais pas.' } = {}) {
  return { id, texteRecu, texteRepondu, date, source: 'laboratoire', referenceMemoire: null, referenceTrace, interpretations };
}

function jugement(valeur, date = '2026-10-03T12:00:00.000Z') {
  return { id: `interpretation-${date}-${valeur}`, dateInterpretation: date, origine: 'jugement-christophe', donnees: { jugement: valeur, date } };
}

// A. T sans expérience référencée.
test('A. trace trouvée, aucune expérience ne la référence → liste vide', () => {
  const T = trace('trace-1');
  const r = vueRetoursSurTrace('trace-1', [T], []);
  assert.equal(r.etat, 'trouvee');
  assert.deepEqual(r.trace, T);
  assert.deepEqual(r.experiences, []);
});

// B. T avec une E référencée sans jugement.
test('B. une expérience référencée sans aucune interprétation', () => {
  const T = trace('trace-1');
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' } });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  assert.equal(r.experiences.length, 1);
  assert.equal(r.experiences[0].id, 'exp-1');
  assert.deepEqual(r.experiences[0].interpretations, []);
});

// C/D. T avec E → ✓ / ✗.
test('C. une expérience jugée correcte : interprétation exposée telle quelle', () => {
  const T = trace('trace-1');
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, interpretations: [jugement('correct')] });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  assert.equal(r.experiences[0].interpretations.length, 1);
  assert.equal(r.experiences[0].interpretations[0].donnees.jugement, 'correct');
});

test('D. une expérience jugée incorrecte : interprétation exposée telle quelle', () => {
  const T = trace('trace-1');
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, interpretations: [jugement('incorrect')] });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  assert.equal(r.experiences[0].interpretations[0].donnees.jugement, 'incorrect');
});

// E/F. ✓ puis ✗ (et l'inverse) : les deux conservés, dans l'ordre réel, jamais fusionnés/résolus.
test('E. ✓ puis ✗ : les deux interprétations conservées, dans l\'ordre réel', () => {
  const T = trace('trace-1');
  const E = experience('exp-1', {
    referenceTrace: { idTrace: 'trace-1' },
    interpretations: [jugement('correct', '2026-10-03T12:00:00.000Z'), jugement('incorrect', '2026-10-03T13:00:00.000Z')],
  });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  assert.equal(r.experiences[0].interpretations.length, 2);
  assert.deepEqual(r.experiences[0].interpretations.map((i) => i.donnees.jugement), ['correct', 'incorrect']);
});

test('F. ✗ puis ✓ : ordre conservé (jamais trié par valeur de jugement)', () => {
  const T = trace('trace-1');
  const E = experience('exp-1', {
    referenceTrace: { idTrace: 'trace-1' },
    interpretations: [jugement('incorrect', '2026-10-03T12:00:00.000Z'), jugement('correct', '2026-10-03T13:00:00.000Z')],
  });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  assert.deepEqual(r.experiences[0].interpretations.map((i) => i.donnees.jugement), ['incorrect', 'correct']);
});

// G. T avec plusieurs E différentes.
test('G. plusieurs expériences référencent la même trace : toutes distinctes, jamais fusionnées', () => {
  const T = trace('trace-1');
  const E1 = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, date: '2026-10-03T09:00:00.000Z', texteRecu: 'Question A ?' });
  const E2 = experience('exp-2', { referenceTrace: { idTrace: 'trace-1' }, date: '2026-10-03T10:00:00.000Z', texteRecu: 'Question B ?' });
  const r = vueRetoursSurTrace('trace-1', [T], [E1, E2]);
  assert.equal(r.experiences.length, 2);
  assert.deepEqual(r.experiences.map((e) => e.id).sort(), ['exp-1', 'exp-2']);
});

// H. deux T avec même capacité/résultat/arguments mais ids différents : aucune confusion.
test('H. deux traces identiques en tout sauf l\'id : aucune confusion possible', () => {
  const T1 = trace('trace-1');
  const T2 = trace('trace-2'); // mêmes capacite/voie/arguments/résultat que T1
  const E1 = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' } });
  const E2 = experience('exp-2', { referenceTrace: { idTrace: 'trace-2' } });
  const r1 = vueRetoursSurTrace('trace-1', [T1, T2], [E1, E2]);
  assert.deepEqual(r1.experiences.map((e) => e.id), ['exp-1']);
  const r2 = vueRetoursSurTrace('trace-2', [T1, T2], [E1, E2]);
  assert.deepEqual(r2.experiences.map((e) => e.id), ['exp-2']);
});

// I. E référence T1 mais ressemble textuellement à T2 : reste sur T1 (aucune similarité de texte).
test('I. ressemblance textuelle entre deux traces n\'influence jamais le rattachement (identité stricte)', () => {
  const T1 = trace('trace-1', { argumentsUtilises: { sujetA: 'zorbo' } });
  const T2 = trace('trace-2', { argumentsUtilises: { sujetA: 'zorbo' } }); // argument IDENTIQUE
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' } });
  const r2 = vueRetoursSurTrace('trace-2', [T1, T2], [E]);
  assert.deepEqual(r2.experiences, [], 'E référence trace-1, jamais trace-2, malgré la ressemblance des arguments');
});

// J. E sans referenceTrace : ignorée.
test('J. une expérience sans referenceTrace est ignorée', () => {
  const T = trace('trace-1');
  const E1 = experience('exp-1', { referenceTrace: null });
  const E2 = experience('exp-2'); // referenceTrace absent par défaut (undefined dans ce fixture)
  delete E2.referenceTrace;
  const r = vueRetoursSurTrace('trace-1', [T], [E1, E2]);
  assert.deepEqual(r.experiences, []);
});

// K. E referenceTrace invalide (idTrace absent/non-string) : ignorée.
test('K. referenceTrace présent mais idTrace absent/invalide : ignorée', () => {
  const T = trace('trace-1');
  const E1 = experience('exp-1', { referenceTrace: {} });
  const E2 = experience('exp-2', { referenceTrace: { idTrace: 42 } });
  const E3 = experience('exp-3', { referenceTrace: { idTrace: '' } });
  const r = vueRetoursSurTrace('trace-1', [T], [E1, E2, E3]);
  assert.deepEqual(r.experiences, []);
});

// L. idTrace demandé introuvable.
test('L. idTrace demandé ne correspond à aucune trace fournie → état "introuvable", trace null', () => {
  const r = vueRetoursSurTrace('trace-fantome', [trace('trace-1')], []);
  assert.equal(r.etat, 'introuvable');
  assert.equal(r.trace, null);
});

// M. E référence un id introuvable : ne recrée jamais T (reste null), même si des expériences existent.
test('M. une expérience référence un id introuvable : T reste null, jamais reconstruite depuis E', () => {
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-fantome' } });
  const r = vueRetoursSurTrace('trace-fantome', [trace('trace-1')], [E]);
  assert.equal(r.etat, 'introuvable');
  assert.equal(r.trace, null, 'T ne doit jamais être fabriquée à partir de referenceTrace d\'une expérience');
});

// N/O/P. voies action/rejeu/composition : traitement descriptif identique, aucune distinction.
for (const voie of ['action', 'rejeu', 'composition']) {
  test(`voie "${voie}" : décrite sans distinction (contrairement à traceExploitable())`, () => {
    const T = trace(`trace-${voie}`, { voie });
    const E = experience(`exp-${voie}`, { referenceTrace: { idTrace: `trace-${voie}` } });
    const r = vueRetoursSurTrace(`trace-${voie}`, [T], [E]);
    assert.equal(r.etat, 'trouvee');
    assert.equal(r.trace.voie, voie);
    assert.equal(r.experiences.length, 1);
  });
}

// Q. interprétation autre que jugement-christophe : conservée telle quelle (aucun filtre).
test('Q. une interprétation d\'origine "comprendre" (ou toute autre) est conservée, pas seulement les jugements', () => {
  const T = trace('trace-1');
  const autre = { id: 'interpretation-x', dateInterpretation: '2026-10-03T11:30:00.000Z', origine: 'comprendre', donnees: { etat: 'compris', sujet: 'moi' } };
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, interpretations: [autre, jugement('correct')] });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  assert.equal(r.experiences[0].interpretations.length, 2);
  assert.equal(r.experiences[0].interpretations[0].origine, 'comprendre');
  assert.deepEqual(r.experiences[0].interpretations[0].donnees, { etat: 'compris', sujet: 'moi' });
});

// R. mutation du résultat retourné ne modifie jamais les entrées.
test('R. muter le résultat retourné ne modifie jamais la trace/l\'expérience fournies en entrée', () => {
  const T = trace('trace-1');
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, interpretations: [jugement('correct')] });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  r.trace.resultat.etat = 'MUTE';
  r.experiences[0].texteRecu = 'MUTE';
  r.experiences[0].interpretations[0].donnees.jugement = 'MUTE';
  r.experiences[0].interpretations.push({ id: 'intrus', origine: 'x', donnees: {} });
  assert.equal(T.resultat.etat, 'inconnu');
  assert.equal(E.texteRecu, 'Quelle est ma couleur ?');
  assert.equal(E.interpretations[0].donnees.jugement, 'correct');
  assert.equal(E.interpretations.length, 1, 'pousser dans le tableau retourné ne doit jamais atteindre le tableau original');
});

// S. muter les entrées APRÈS le calcul ne doit pas réécrire rétroactivement la vue déjà retournée.
test('S. muter les entrées après l\'appel ne modifie pas une vue déjà calculée (copie défensive)', () => {
  const T = trace('trace-1');
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, interpretations: [jugement('correct')] });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  T.resultat.etat = 'MUTE-APRES';
  E.interpretations[0].donnees.jugement = 'MUTE-APRES';
  E.interpretations.push(jugement('incorrect'));
  assert.equal(r.trace.resultat.etat, 'inconnu');
  assert.equal(r.experiences[0].interpretations[0].donnees.jugement, 'correct');
  assert.equal(r.experiences[0].interpretations.length, 1);
});

// T. ordre d'entrée différent : la sortie reste identique (tri déterministe interne, jamais
// l'ordre accidentel du tableau fourni). Ordre choisi et documenté : date croissante, puis id.
test('T. l\'ordre des expériences en sortie est déterministe, indépendant de l\'ordre d\'entrée', () => {
  const T = trace('trace-1');
  const E1 = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, date: '2026-10-03T09:00:00.000Z' });
  const E2 = experience('exp-2', { referenceTrace: { idTrace: 'trace-1' }, date: '2026-10-03T10:00:00.000Z' });
  const E3 = experience('exp-3', { referenceTrace: { idTrace: 'trace-1' }, date: '2026-10-03T08:00:00.000Z' });
  const rA = vueRetoursSurTrace('trace-1', [T], [E1, E2, E3]);
  const rB = vueRetoursSurTrace('trace-1', [T], [E3, E2, E1]);
  const rC = vueRetoursSurTrace('trace-1', [T], [E2, E1, E3]);
  const ordreAttendu = ['exp-3', 'exp-1', 'exp-2']; // date croissante
  assert.deepEqual(rA.experiences.map((e) => e.id), ordreAttendu);
  assert.deepEqual(rB.experiences.map((e) => e.id), ordreAttendu);
  assert.deepEqual(rC.experiences.map((e) => e.id), ordreAttendu);
});

test('T (bis) : à date strictement égale, départage par id (ordre lexicographique), jamais par position d\'entrée', () => {
  const T = trace('trace-1');
  const Eb = experience('exp-b', { referenceTrace: { idTrace: 'trace-1' }, date: '2026-10-03T09:00:00.000Z' });
  const Ea = experience('exp-a', { referenceTrace: { idTrace: 'trace-1' }, date: '2026-10-03T09:00:00.000Z' });
  const r1 = vueRetoursSurTrace('trace-1', [T], [Eb, Ea]);
  const r2 = vueRetoursSurTrace('trace-1', [T], [Ea, Eb]);
  assert.deepEqual(r1.experiences.map((e) => e.id), ['exp-a', 'exp-b']);
  assert.deepEqual(r2.experiences.map((e) => e.id), ['exp-a', 'exp-b']);
});

// ---------------------------------------------------------------------------------------------
// contre-exemples supplémentaires
// ---------------------------------------------------------------------------------------------

test('contre-exemple : aucune agrégation, aucun score, aucune conversion correct/incorrect → autre chose', () => {
  const T = trace('trace-1');
  const E = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, interpretations: [jugement('correct'), jugement('incorrect')] });
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  const cles = Object.keys(r);
  assert.deepEqual(cles.sort(), ['etat', 'experiences', 'trace']);
  for (const key of ['score', 'moyenne', 'ratio', 'majorite', 'confiance', 'positif', 'negatif']) {
    assert.ok(!(key in r), `aucune clé "${key}" ne doit apparaître dans la sortie`);
    assert.ok(!(key in r.experiences[0]), `aucune clé "${key}" ne doit apparaître sur une expérience de la sortie`);
  }
});

test('contre-exemple : aucune déduction depuis trace.resultat (identique, jugements différents malgré tout)', () => {
  const T = trace('trace-1', { resultat: { etat: 'inconnu' } });
  const E1 = experience('exp-1', { referenceTrace: { idTrace: 'trace-1' }, interpretations: [jugement('correct')] });
  const E2 = experience('exp-2', { referenceTrace: { idTrace: 'trace-1' }, interpretations: [jugement('incorrect')] });
  const r = vueRetoursSurTrace('trace-1', [T], [E1, E2]);
  assert.equal(r.experiences.length, 2); // les deux faits bruts, sans aucune résolution/majorité
});

test('contre-exemple : projection de l\'expérience limitée aux champs attendus, rien de plus', () => {
  const T = trace('trace-1');
  const E = { ...experience('exp-1', { referenceTrace: { idTrace: 'trace-1' } }), champInattendu: 'bruit' };
  const r = vueRetoursSurTrace('trace-1', [T], [E]);
  assert.deepEqual(Object.keys(r.experiences[0]).sort(), ['id', 'interpretations', 'referenceTrace', 'texteRecu', 'texteRepondu'].sort());
});

// ---------------------------------------------------------------------------------------------
// GARDE STATIQUE : primitive totalement DORMANTE (section 13 du cadrage).
// ---------------------------------------------------------------------------------------------
test('[STATIQUE] vueRetoursSurTrace() n\'est importée par aucun autre fichier de app/ (dormante)', () => {
  const fichiers = fs.readdirSync(new URL('../app', import.meta.url), { recursive: true })
    .filter((f) => typeof f === 'string' && f.endsWith('.js') && !f.includes('retours-traces.js'));
  for (const f of fichiers) {
    const chemin = new URL(`../app/${f}`, import.meta.url);
    let src;
    try { src = fs.readFileSync(chemin, 'utf8'); } catch { continue; }
    assert.ok(!src.includes('retours-traces'), `${f} ne doit jamais importer retours-traces.js`);
    assert.ok(!src.includes('vueRetoursSurTrace'), `${f} ne doit jamais appeler vueRetoursSurTrace()`);
  }
});

// GARDE STATIQUE : la primitive elle-même ne doit jamais importer quoi que ce soit qui lise
// IndexedDB/le magasin (aucune dépendance à connaissances.js, par exemple).
test('[STATIQUE] retours-traces.js n\'importe aucun accès au magasin (pure, entrées explicites)', () => {
  const src = fs.readFileSync(new URL('../app/langage/retours-traces.js', import.meta.url), 'utf8');
  assert.ok(!/from\s+['"].*connaissances\.js['"]/.test(src), 'aucune dépendance à connaissances.js (IndexedDB)');
  assert.ok(!/\bindexedDB\b/.test(src), 'aucune utilisation réelle de indexedDB (une mention en commentaire de conception n\'est pas une dépendance)');
});
// === FIN_TEST_RETOURS_TRACES ===
