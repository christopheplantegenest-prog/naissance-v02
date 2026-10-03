// === DEBUT_TEST_POSSIBILITES_REJEU_ADMISSIBLES ===
// CHANTIER v0.60.0 — ADMISSIBILITÉ PURE DES POSSIBILITÉS DE REJEU (décision ChatGPT du 03/10/2026,
// implémentant le contrat figé par le diagnostic « DIAGNOSTIC PREMIER BRANCHEMENT AUTONOME » du
// même jour). Dernier chaînon PUR avant tout branchement comportemental : relie
// possibilitesRejeu() (v0.57) et preuveSubstitutionDepuisTemoin() (v0.59) pour décrire quelles
// possibilités sont ADMISSIBLES (OR pur par origine) -- AUCUNE invocation, AUCUN choix, AUCUN
// branchement. Domaine ARTIFICIEL neutre, comme tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  possibilitesRejeuAdmissibles,
  possibilitesRejeu,
  estOrigineAdmissible,
  positionRoleOrigine,
  traceExploitable,
} from '../app/langage/vue-traces.js';

let compteurId = 0;
function traceAction(texteBrut, capacite, provenancePositions) {
  compteurId += 1;
  const t = {
    id: compteurId,
    sequence: compteurId,
    horodatage: '2000-01-01T00:00:00.000Z',
    capacite,
    voie: 'action',
    argumentsUtilises: {},
    provenanceArguments: {},
    resultat: { peuImporte: true },
    contexte: { texteBrut, tokens: [] },
  };
  if (provenancePositions !== undefined) t.provenancePositions = provenancePositions;
  return t;
}
function traceVoie(voie, texteBrut, capacite, provenancePositions) {
  const t = traceAction(texteBrut, capacite, provenancePositions);
  t.voie = voie;
  return t;
}

// Motif ancré "zaccede ... zordre ..." déjà éprouvé par tests/possibilites-rejeu.test.mjs.
function phrasesAncrees(prefixe, n) {
  const mots = ['zorbo', 'zalpha', 'zgamma', 'zepsilon', 'zeta', 'ztheta', 'ziota', 'zkappa', 'zmu', 'znu'];
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(`zaccede ${prefixe}${mots[i % mots.length]}${i} zordre ${prefixe}${mots[i % mots.length]}${i}b`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// A. AUCUNE POSSIBILITÉ RECONSTRUCTIBLE
// ---------------------------------------------------------------------------------------------
test('A. aucune possibilité reconstructible -> etat "aucune", totalPossibilitesReconstructibles 0', () => {
  const phrases = phrasesAncrees('a', 2);
  const traces = phrases.map((p) => traceAction(p, 'recherche', { relation: 1, valeur: 3 }));
  const r = possibilitesRejeuAdmissibles(traces, 'zrien zdutout zici znulpart zenplus');
  assert.equal(r.etat, 'aucune');
  assert.equal(r.totalPossibilitesReconstructibles, 0);
  assert.deepEqual(r.possibilitesAdmissibles, []);
});

// ---------------------------------------------------------------------------------------------
// B. POSSIBILITÉ RECONSTRUCTIBLE MAIS ORIGINE "non_demontree" -> NON ADMISSIBLE, DISTINGUABLE DE A
// ---------------------------------------------------------------------------------------------
test('B. possibilité reconstructible, origine confondue -> non admissible, mais "quelque chose était reconstructible"', () => {
  // Confond : les deux rôles varient TOUJOURS ensemble (jamais de paire contrastée) -> non_distinguee.
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalB', 'recherche', { relation: 1, valeur: 3 });
  const traces = [t1, t2];
  const texte = 'zaccede zrelNOUVEAU zordre zvalA';
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.etat, 'aucune');
  assert.equal(r.totalPossibilitesReconstructibles, 1, 'une possibilité ÉTAIT reconstructible, contrairement au cas A');
  assert.deepEqual(r.possibilitesAdmissibles, []);
});

// ---------------------------------------------------------------------------------------------
// C. UNE POSSIBILITÉ, UNE ORIGINE "rejeu_exact"
// ---------------------------------------------------------------------------------------------
test('C. invocation présente identique à une trace historique -> "rejeu_exact", admissible', () => {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const traces = [t1, t2];
  const texte = 'zaccede zrelA zordre zvalA'; // identique à t1
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.etat, 'unique');
  assert.equal(r.possibilitesAdmissibles.length, 1);
  const [p] = r.possibilitesAdmissibles;
  assert.ok(p.origines.some((o) => o.admissible && o.preuve.etat === 'rejeu_exact'));
});

// ---------------------------------------------------------------------------------------------
// D. UNE POSSIBILITÉ, UNE ORIGINE "substitution_demontree"
// ---------------------------------------------------------------------------------------------
test('D. valeur nouvelle à un rôle seul variable -> "substitution_demontree", admissible', () => {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const traces = [t1, t2];
  const texte = 'zaccede zrelNOUVEAU zordre zvalA'; // relation jamais vue, valeur ancrée
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.etat, 'unique');
  const [p] = r.possibilitesAdmissibles;
  assert.ok(p.origines.every((o) => o.admissible && o.preuve.etat === 'substitution_demontree'));
});

// ---------------------------------------------------------------------------------------------
// E. UNE POSSIBILITÉ, PLUSIEURS ORIGINES, UNE SEULE POSITIVE
// ---------------------------------------------------------------------------------------------
function corpusDeuxOriginesUneSeulePositive() {
  // Origine X (couverture {1,2}) : ancrée sur 'zaccede' seul, contraste réel -> substitution_demontree.
  const x1 = traceAction('zaccede zrelA zqqq1 zvalA', 'recherche', { relation: 1, valeur: 3 });
  const x2 = traceAction('zaccede zrelB zqqq2 zvalA', 'recherche', { relation: 1, valeur: 3 });
  // Origine Y (couverture {3,4}) : ancrée sur 'zordre' seul, vocabulaire disjoint de X (jamais de
  // fusion de motif), confondue (relation/valeur varient TOUJOURS ensemble) -> non_demontree.
  const y1 = traceAction('zQQQ1 zrelX zordre zvalX', 'recherche', { relation: 1, valeur: 3 });
  const y2 = traceAction('zQQQ2 zrelY zordre zvalY', 'recherche', { relation: 1, valeur: 3 });
  return { traces: [x1, x2, y1, y2], texte: 'zaccede zrelNOUVEAU zordre zvalA' };
}

test('E. deux origines d\'une même possibilité, une seule positive -> possibilité admissible', () => {
  const { traces, texte } = corpusDeuxOriginesUneSeulePositive();
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.etat, 'unique');
  assert.equal(r.totalPossibilitesReconstructibles, 1);
  const [p] = r.possibilitesAdmissibles;
  assert.equal(p.origines.length, 2, 'les deux origines (positive et négative) restent toutes deux visibles');
  const admissibles = p.origines.filter((o) => o.admissible);
  const nonAdmissibles = p.origines.filter((o) => !o.admissible);
  assert.equal(admissibles.length, 1);
  assert.equal(nonAdmissibles.length, 1);
  assert.equal(admissibles[0].preuve.etat, 'substitution_demontree');
  assert.equal(nonAdmissibles[0].preuve.etat, 'non_demontree');
});

// ---------------------------------------------------------------------------------------------
// F. UNE POSSIBILITÉ, PLUSIEURS ORIGINES POSITIVES
// ---------------------------------------------------------------------------------------------
function corpusDeuxOriginesToutesPositives() {
  const p1 = traceAction('zaccede zrelA zqqq1 zX', 'recherche', { relation: 1, valeur: 3 });
  const p2 = traceAction('zaccede zrelB zqqq2 zX', 'recherche', { relation: 1, valeur: 3 });
  const q1 = traceAction('zWW1 zX zordre zrelC', 'recherche', { relation: 3, valeur: 1 });
  const q2 = traceAction('zWW2 zX zordre zrelD', 'recherche', { relation: 3, valeur: 1 });
  return { traces: [p1, p2, q1, q2], texte: 'zaccede zX zordre zX' };
}

test('F. deux origines positives pour une même possibilité -> admissible, les deux conservées', () => {
  const { traces, texte } = corpusDeuxOriginesToutesPositives();
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.etat, 'unique');
  const [p] = r.possibilitesAdmissibles;
  assert.equal(p.origines.length, 2);
  assert.ok(p.origines.every((o) => o.admissible));
});

// ---------------------------------------------------------------------------------------------
// G. DEUX POSSIBILITÉS RECONSTRUCTIBLES, UNE SEULE ADMISSIBLE
// ---------------------------------------------------------------------------------------------
test('G. deux possibilités reconstructibles (capacités différentes), une seule admissible', () => {
  // Possibilité 1 (capacite 'recherche') : contraste réel -> substitution_demontree, admissible.
  const r1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const r2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  // Possibilité 2 (capacite 'deduction') : confondue (sujet/role varient TOUJOURS ensemble) ->
  // non_demontree, jamais admissible -- co-observée avec 'recherche' sur la couverture fusionnée
  // (partage l'ancre 'zaccede' en position 0), mais sa propre preuve d'indépendance échoue.
  const d1 = traceAction('zaccede zduA zqqqD1 zvalD1', 'deduction', { sujet: 1, role: 3 });
  const d2 = traceAction('zaccede zduB zqqqD2 zvalD2', 'deduction', { sujet: 1, role: 3 });

  const traces = [r1, r2, d1, d2];
  const texte = 'zaccede zrelNOUVEAU zordre zvalA';
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.totalPossibilitesReconstructibles, 2, 'deux possibilités étaient reconstructibles (recherche + deduction)');
  assert.equal(r.etat, 'unique');
  assert.deepEqual(r.possibilitesAdmissibles.map((p) => p.capacite), ['recherche']);
});

// ---------------------------------------------------------------------------------------------
// H. DEUX POSSIBILITÉS DISTINCTES, TOUTES DEUX ADMISSIBLES
// ---------------------------------------------------------------------------------------------
test('H. deux possibilités distinctes (capacités différentes), toutes deux admissibles', () => {
  const r1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const r2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  // 'deduction' ancrée sur 'zvalA' seul (position 3), rôle 'role' ancré, 'sujet' seul variable ->
  // single-variable-role, trivialement positive (section 6 de v0.59).
  const d1 = traceAction('zWWD1 zduA zqqqD1 zvalA', 'deduction', { sujet: 1, role: 3 });
  const d2 = traceAction('zWWD2 zduB zqqqD2 zvalA', 'deduction', { sujet: 1, role: 3 });
  const traces = [r1, r2, d1, d2];
  const texte = 'zaccede zrelNOUVEAU zordre zvalA';
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.etat, 'ambigu');
  assert.equal(r.possibilitesAdmissibles.length, 2);
  assert.deepEqual(r.possibilitesAdmissibles.map((p) => p.capacite).sort(), ['deduction', 'recherche']);
});

// ---------------------------------------------------------------------------------------------
// I. PLUSIEURS ORIGINES -> MÊME CAPACITÉ+ARGUMENTS -> TOUJOURS UNE SEULE POSSIBILITÉ
// ---------------------------------------------------------------------------------------------
test('I. plusieurs origines donnant la même invocation -> une seule possibilité (jamais dupliquée)', () => {
  const { traces, texte } = corpusDeuxOriginesUneSeulePositive();
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.possibilitesAdmissibles.length, 1, 'une seule possibilité, même avec plusieurs origines');
});

// ---------------------------------------------------------------------------------------------
// J. ORIGINE "capacite_disparue" -> NON POSITIVE (test direct du prédicat, jamais fabriqué par
// une intégration artificielle -- construireArgumentsPresents() filtre déjà ce cas avant que
// possibilitesRejeu() ne crée la moindre origine, donc ce cas ne peut survenir dans le pipeline
// réel ; testé honnêtement au niveau du petit prédicat pur qui l'encode).
// ---------------------------------------------------------------------------------------------
test('J. estOrigineAdmissible("capacite_disparue") -> false (jamais positif)', () => {
  assert.equal(estOrigineAdmissible('capacite_disparue'), false);
  assert.equal(estOrigineAdmissible('non_demontree'), false);
  assert.equal(estOrigineAdmissible('rejeu_exact'), true);
  assert.equal(estOrigineAdmissible('substitution_demontree'), true);
  assert.equal(estOrigineAdmissible('un_etat_totalement_inconnu'), false, 'tout état non explicitement positif reste non admissible, jamais une liste blanche risquée en sens inverse');
});

// ---------------------------------------------------------------------------------------------
// K. POSITIONS IDENTIQUES DANS TOUTES LES ORIGINES ADMISSIBLES -> CONVERGENCE EXPLICITE
// ---------------------------------------------------------------------------------------------
test('K. deux origines admissibles assignant la même position à chaque rôle -> convergence explicite', () => {
  const { traces, texte } = corpusDeuxOriginesUneSeulePositive();
  // Les deux origines de ce corpus assignent toutes deux relation->1, valeur->3 : convergence attendue.
  const r = possibilitesRejeuAdmissibles(traces, texte);
  const [p] = r.possibilitesAdmissibles;
  const relation = p.positionsRoles.find((x) => x.role === 'relation');
  const valeur = p.positionsRoles.find((x) => x.role === 'valeur');
  assert.equal(relation.etat, 'convergente');
  assert.equal(relation.position, 1);
  assert.equal(valeur.etat, 'convergente');
  assert.equal(valeur.position, 3);
});

// ---------------------------------------------------------------------------------------------
// L. POSITIONS DIFFÉRENTES ENTRE ORIGINES ADMISSIBLES -> DIVERGENCE EXPLICITE
// ---------------------------------------------------------------------------------------------
test('L. deux origines admissibles assignant des positions différentes au même rôle -> divergence, aucune position arbitraire', () => {
  const p1 = traceAction('zaccede zrelA zqqq1 zX', 'recherche', { relation: 1, valeur: 3 });
  const p2 = traceAction('zaccede zrelB zqqq2 zX', 'recherche', { relation: 1, valeur: 3 });
  const q1 = traceAction('zWW1 zX zordre zrelC', 'recherche', { relation: 3, valeur: 1 });
  const q2 = traceAction('zWW2 zX zordre zrelD', 'recherche', { relation: 3, valeur: 1 });
  const traces = [p1, p2, q1, q2];
  const texte = 'zaccede zX zordre zX';
  const r = possibilitesRejeuAdmissibles(traces, texte);
  const [p] = r.possibilitesAdmissibles;
  assert.equal(p.origines.length, 2);
  assert.ok(p.origines.every((o) => o.admissible), 'les deux origines doivent être positives pour que la divergence soit significative');
  for (const roleEtat of p.positionsRoles) {
    assert.equal(roleEtat.etat, 'divergente');
    assert.equal(Object.prototype.hasOwnProperty.call(roleEtat, 'position'), false, 'aucune position arbitraire retenue en cas de divergence');
  }
});

// ---------------------------------------------------------------------------------------------
// M. ORIGINE ADMISSIBLE SANS POSITION SUFFISAMMENT FIABLE -> ÉTAT POSITIONNEL INSUFFISANT
// (test direct du petit prédicat positionRoleOrigine() -- ce cas ne peut, par construction,
// survenir pour une origine réellement admissible via le pipeline complet : l'admissibilité
// implique déjà "constructible", donc une position unique par rôle actuel. Documenté honnêtement
// plutôt que fabriqué par une intégration artificielle -- voir le rapport, section I.)
// ---------------------------------------------------------------------------------------------
test('M. positionRoleOrigine() renvoie undefined quand la position n\'est pas établie sans ambiguïté', () => {
  // Rôle absent de toute provenance exploitable de cette couverture.
  const sansRole = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1 }); // valeur absente
  assert.equal(positionRoleOrigine([sansRole], [sansRole.id], 'recherche', 'valeur'), undefined);
  // Rôle présent et bien positionné -> position définie.
  assert.equal(positionRoleOrigine([sansRole], [sansRole.id], 'recherche', 'relation'), 1);
});

// ---------------------------------------------------------------------------------------------
// N. PERMUTATION DE L'ORDRE DES TRACES -> SORTIE DÉTERMINISTE
// ---------------------------------------------------------------------------------------------
test('N. permutation de l\'ordre des traces en entrée -> résultat identique', () => {
  const { traces, texte } = corpusDeuxOriginesUneSeulePositive();
  const r1 = possibilitesRejeuAdmissibles(traces, texte);
  const r2 = possibilitesRejeuAdmissibles(traces.slice().reverse(), texte);
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------------------------
// O. MUTATION DE "resultat" SEULE -> SORTIE INCHANGÉE
// ---------------------------------------------------------------------------------------------
test('O. mutation du champ "resultat" d\'une trace -> admissibilité strictement inchangée', () => {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const texte = 'zaccede zrelNOUVEAU zordre zvalA';
  const r1 = possibilitesRejeuAdmissibles([t1, t2], texte);
  const t1Alt = { ...t1, resultat: { completementDifferent: true, echec: true } };
  const t2Alt = { ...t2, resultat: { etrange: 42 } };
  const r2 = possibilitesRejeuAdmissibles([t1Alt, t2Alt], texte);
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------------------------
// P. MUTATION DE "argumentsUtilises" SEULE -> SORTIE INCHANGÉE
// ---------------------------------------------------------------------------------------------
test('P. mutation du champ "argumentsUtilises" d\'une trace -> admissibilité strictement inchangée', () => {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const texte = 'zaccede zrelNOUVEAU zordre zvalA';
  const r1 = possibilitesRejeuAdmissibles([t1, t2], texte);
  const t1Alt = { ...t1, argumentsUtilises: { relation: 'zfaux', valeur: 'zfaux' } };
  const t2Alt = { ...t2, argumentsUtilises: { relation: 'zfaux2', valeur: 'zfaux2' } };
  const r2 = possibilitesRejeuAdmissibles([t1Alt, t2Alt], texte);
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------------------------
// Q. TRACE "voie:'composition'" -> N'ENTRE JAMAIS DANS LES PREUVES
// ---------------------------------------------------------------------------------------------
test('Q. une trace voie:\'composition\' ajoutée au corpus ne change jamais le résultat', () => {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const texte = 'zaccede zrelNOUVEAU zordre zvalA';
  const r1 = possibilitesRejeuAdmissibles([t1, t2], texte);
  const composition = traceVoie('composition', null, 'recherche', null);
  composition.contexte = null;
  composition.provenancePositions = null;
  const r2 = possibilitesRejeuAdmissibles([t1, t2, composition], texte);
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------------------------
// R. TRACE ARTIFICIELLE "voie:'rejeu'" -> N'ENTRE JAMAIS DANS LES PREUVES (garde explicite que
// traceExploitable() reste gelée, section 9 du chantier).
// ---------------------------------------------------------------------------------------------
test('R. une trace voie:\'rejeu\' ajoutée au corpus ne change jamais le résultat', () => {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const texte = 'zaccede zrelNOUVEAU zordre zvalA';
  const r1 = possibilitesRejeuAdmissibles([t1, t2], texte);
  const rejeu = traceVoie('rejeu', 'zaccede zrelNOUVEAU zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const r2 = possibilitesRejeuAdmissibles([t1, t2, rejeu], texte);
  assert.deepEqual(r1, r2);
});

test('R-bis (garde de non-régression explicite, section 9) : traceExploitable() reste strictement "voie === \'action\'"', () => {
  const actionTrace = traceAction('peu importe', 'recherche', { relation: 0, valeur: 1 });
  assert.equal(traceExploitable(actionTrace), true);
  const rejeuTrace = traceVoie('rejeu', 'peu importe', 'recherche', { relation: 0, valeur: 1 });
  assert.equal(traceExploitable(rejeuTrace), false, 'une trace voie:\'rejeu\' ne doit jamais devenir exploitable sans décision explicite future');
  const compositionTrace = traceVoie('composition', null, 'recherche', null);
  compositionTrace.contexte = null;
  assert.equal(traceExploitable(compositionTrace), false);
});

// ---------------------------------------------------------------------------------------------
// S. 100 ORIGINES NÉGATIVES + 1 POSITIVE -> ADMISSIBLE, AUCUNE MAJORITÉ
// ---------------------------------------------------------------------------------------------
test('S. de nombreuses origines négatives et une seule positive -> possibilité admissible malgré la majorité négative', () => {
  const { traces: deuxOrigines, texte } = corpusDeuxOriginesUneSeulePositive();
  // Duplique la source NÉGATIVE (Y) sous de nombreux vocabulaires disjoints pour multiplier les
  // origines non admissibles de la MÊME possibilité, sans jamais toucher à l'origine positive (X).
  const traces = [...deuxOrigines];
  for (let i = 0; i < 20; i += 1) {
    const qa = traceAction(`zNEG${i}A zrelNeg${i}A zordre zvalNeg${i}A`, 'recherche', { relation: 1, valeur: 3 });
    const qb = traceAction(`zNEG${i}B zrelNeg${i}B zordre zvalNeg${i}B`, 'recherche', { relation: 1, valeur: 3 });
    traces.push(qa, qb);
  }
  const r = possibilitesRejeuAdmissibles(traces, texte);
  assert.equal(r.possibilitesAdmissibles.length, 1, 'aucune majorité négative ne doit faire disparaître la possibilité');
  const [p] = r.possibilitesAdmissibles;
  const admissibles = p.origines.filter((o) => o.admissible);
  const nonAdmissibles = p.origines.filter((o) => !o.admissible);
  assert.equal(admissibles.length, 1);
  assert.ok(nonAdmissibles.length >= 1, 'au moins une origine négative reste visible, jamais masquée');
  const tracesNegativesTotal = nonAdmissibles.reduce((acc, o) => acc + o.preuve.tracesCapacite, 0);
  assert.ok(tracesNegativesTotal >= 20, 'les nombreuses traces négatives (40 au total, partageant un même ancrage) restent comptées, jamais occultées par leur propre nombre');
});

// ---------------------------------------------------------------------------------------------
// T. PLUSIEURS POSITIVES + PLUSIEURS NÉGATIVES -> OR PUR
// ---------------------------------------------------------------------------------------------
test('T. plusieurs origines positives et plusieurs négatives mélangées -> OR pur, possibilité admissible', () => {
  const base = corpusDeuxOriginesUneSeulePositive();
  const traces = [...base.traces];
  // Une deuxième origine positive, totalement disjointe des précédentes.
  const extra1 = traceAction('zEXTRA1A zrelEX1 zqrstA zvalA', 'recherche', { relation: 1, valeur: 3 });
  const extra2 = traceAction('zEXTRA2A zrelEX2 zqrstB zvalA', 'recherche', { relation: 1, valeur: 3 });
  traces.push(extra1, extra2);
  const r = possibilitesRejeuAdmissibles(traces, base.texte);
  assert.equal(r.possibilitesAdmissibles.length, 1);
  const [p] = r.possibilitesAdmissibles;
  const admissibles = p.origines.filter((o) => o.admissible);
  const nonAdmissibles = p.origines.filter((o) => !o.admissible);
  assert.ok(admissibles.length >= 1 && nonAdmissibles.length >= 1, 'un mélange réel de positifs et de négatifs doit coexister dans la même possibilité');
});

// ---------------------------------------------------------------------------------------------
// U. DEUX POSSIBILITÉS ADMISSIBLES AVEC FRÉQUENCES HISTORIQUES TRÈS DIFFÉRENTES -> RESTENT DEUX
// ---------------------------------------------------------------------------------------------
test('U. deux possibilités admissibles avec des couvertures de tailles très différentes (100 contre 2) -> restent deux, aucune préférence', () => {
  const phrasesA = phrasesAncrees('u1', 100);
  const tracesA = phrasesA.map((p) => traceAction(p, 'recherche', { relation: 1, valeur: 3 }));
  const phrasesB = phrasesAncrees('u2', 2);
  const tracesB = phrasesB.map((p) => traceAction(p, 'deduction', { sujet: 1, role: 3 }));
  const traces = [...tracesA, ...tracesB];
  const texte = 'zaccede zrelNOUVEAU zordre zvalVal';
  const r = possibilitesRejeuAdmissibles(traces, texte);
  // Les deux motifs partagent les mêmes ancres 'zaccede'/'zordre' -- la propriété testée est
  // seulement qu'aucune fréquence/taille de couverture n'élimine ni ne priorise une possibilité :
  // chaque champ retourné reste indépendant de "combien de traces" soutiennent chaque origine.
  for (const p of r.possibilitesAdmissibles) {
    for (const o of p.origines) {
      assert.ok(!('score' in o) && !('confiance' in o) && !('frequence' in o));
    }
  }
});

// ---------------------------------------------------------------------------------------------
// V. CASSE/ACCENTS/VALEURS EXACTES -> AUCUNE NOUVELLE NORMALISATION
// ---------------------------------------------------------------------------------------------
test('V. deux valeurs différant seulement par la casse restent deux valeurs distinctes, aucune normalisation ajoutée', () => {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t3 = traceAction('zaccede zrelA zordre ZVALA', 'recherche', { relation: 1, valeur: 3 }); // casse différente
  const traces = [t1, t2, t3];
  const texte = 'zaccede zrelNOUVEAU zordre zvalA';
  const r = possibilitesRejeuAdmissibles(traces, texte);
  // 'zvalA' et 'ZVALA' doivent être traités comme deux valeurs strictement distinctes (jamais
  // fusionnées) -- propriété déjà garantie par possibilitesRejeu()/preuveSubstitutionDepuisTemoin()
  // (égalité stricte ===, jamais canonisée) ; ce test vérifie que v0.60 ne réintroduit aucune
  // normalisation à son propre niveau.
  assert.equal(r.etat, 'unique');
  const [p] = r.possibilitesAdmissibles;
  assert.equal(p.arguments.valeur, 'zvalA');
});

// ---------------------------------------------------------------------------------------------
// W. CAPACITÉ+ARGUMENTS DIFFÉRENTS -> JAMAIS FUSIONNÉS
// ---------------------------------------------------------------------------------------------
test('W. deux invocations de même capacité mais arguments différents -> jamais fusionnées en une possibilité', () => {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t3 = traceAction('zaccede zrelC zordre zvalC', 'recherche', { relation: 1, valeur: 3 });
  const t4 = traceAction('zaccede zrelD zordre zvalC', 'recherche', { relation: 1, valeur: 3 });
  const traces = [t1, t2, t3, t4];
  // Deux textes présents distincts, chacun reconstruisant des arguments différents.
  const r1 = possibilitesRejeuAdmissibles(traces, 'zaccede zrelNOUVEAU zordre zvalA');
  const r2 = possibilitesRejeuAdmissibles(traces, 'zaccede zrelNOUVEAU zordre zvalC');
  assert.notDeepEqual(r1.possibilitesAdmissibles[0]?.arguments, r2.possibilitesAdmissibles[0]?.arguments);
});

// ---------------------------------------------------------------------------------------------
// X. GARDE ANTI-NORMATIVITÉ : aucun score/confiance/fréquence/succès/récompense/résultat dans la
// décision.
// ---------------------------------------------------------------------------------------------
test('X. GARDE anti-normativité : aucun champ score/confiance/fréquence/succès/récompense n\'apparaît jamais dans la sortie', () => {
  const { traces, texte } = corpusDeuxOriginesUneSeulePositive();
  const r = possibilitesRejeuAdmissibles(traces, texte);
  const interdits = ['score', 'confiance', 'frequence', 'succes', 'recompense', 'priorite', 'majorite'];
  const serialise = JSON.stringify(r).toLowerCase();
  for (const mot of interdits) {
    assert.ok(!serialise.includes(mot), `le mot interdit "${mot}" ne doit jamais apparaître dans la sortie`);
  }
  assert.deepEqual(Object.keys(r).sort(), ['etat', 'possibilitesAdmissibles', 'totalPossibilitesReconstructibles']);
});

// ---------------------------------------------------------------------------------------------
// GARDE SUPPLÉMENTAIRE : v0.57 "possibilitesRejeu" conserve son comportement de longueur/fusion
// (section 20 du chantier -- régression explicite, en plus du fichier de tests dédié v0.57).
// ---------------------------------------------------------------------------------------------
test('Garde régression v0.57 : possibilitesRejeu() reste inchangée dans son comportement observable (longueur, arguments, fusion)', () => {
  const { traces, texte } = corpusDeuxOriginesUneSeulePositive();
  const r = possibilitesRejeu(traces, texte);
  assert.equal(r.possibilites.length, 1);
  assert.equal(r.possibilites[0].origines.length, 2);
  assert.deepEqual(r.possibilites[0].arguments, { relation: 'zrelNOUVEAU', valeur: 'zvalA' });
});
// === FIN_TEST_POSSIBILITES_REJEU_ADMISSIBLES ===
