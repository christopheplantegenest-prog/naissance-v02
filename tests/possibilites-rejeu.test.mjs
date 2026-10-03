// Chantier « PRIMITIVE PURE DE RECENSEMENT DES POSSIBILITÉS DE REJEU » (décision ChatGPT du
// 03/10/2026, implémentant le contrat figé par le diagnostic du même jour « DIAGNOSTIC PREMIER CHOIX
// AUTONOME »). Primitive PURE répondant UNIQUEMENT à : « pour CE texte présent, quelles invocations
// concrètes DISTINCTES puis-je reconstruire depuis mes traces passées ? » Elle ne choisit rien,
// n'invoque rien, ne recommande rien, n'utilise aucun score/fréquence/priorité.
//
// RÉUTILISE STRICTEMENT, SANS DUPLICATION : vueDescriptive() (découverte des formes),
// cooccurrencesSituationAction() (capacités historiquement observées par couverture EXACTE, jamais
// un rapprochement par forme seule), correspondFormeDescriptive() (v0.52), construireArgumentsPresents()
// (v0.56). Domaine ARTIFICIEL neutre (zaccede/zordre/...), comme tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { possibilitesRejeu } from '../app/langage/vue-traces.js';

// Fabrique une trace voie:'action' au format EXACT de enregistrerTrace() (connaissances.js),
// même convention que tests/cooccurrences-situation-action.test.mjs, enrichie de provenancePositions
// (v0.53) quand fournie.
function traceAction(id, texteBrut, capacite, provenancePositions) {
  const t = {
    id, sequence: id, horodatage: '2000-01-01T00:00:00.000Z',
    capacite, voie: 'action', argumentsUtilises: {}, provenanceArguments: {},
    resultat: { peuImporte: true },
    contexte: { texteBrut, tokens: [] },
  };
  if (provenancePositions !== undefined) t.provenancePositions = provenancePositions;
  return t;
}
// Trace ANTÉRIEURE à v0.53 : provenancePositions absent du tout (jamais reconstruite).
function traceAncienne(id, texteBrut, capacite) {
  return traceAction(id, texteBrut, capacite, undefined);
}

// Un groupe de phrases à l'ancrage "zaccede ... zordre ..." (n=4, ancres en 0 et 2, variables en 1
// et 3) -- motif déjà PROUVÉ fiable dans tests/cooccurrences-situation-action.test.mjs (2 phrases
// suffisent, seuilMin=2 par défaut de repererMotifs()).
function phrasesAncrees(prefixe, n) {
  const mots = ['zorbo', 'zalpha', 'zgamma', 'zepsilon', 'zeta', 'ztheta', 'ziota', 'zkappa', 'zmu', 'znu'];
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push(`zaccede ${prefixe}${mots[i % mots.length]}${i} zordre ${prefixe}${mots[i % mots.length]}${i}b`);
  }
  return out;
}

const TEXTE = 'zaccede zvalRel zordre zvalVal';

// ============================================================================ A
test('A. aucune forme correspondante -> []', () => {
  const phrases = phrasesAncrees('a', 2);
  const traces = phrases.map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const r = possibilitesRejeu(traces, 'zrien zdutout zici znulpart zenplus');
  assert.deepEqual(r.possibilites, []);
});

// ============================================================================ B
test('B. une forme -> une capacité constructible -> 1', () => {
  const phrases = phrasesAncrees('b', 3);
  const traces = phrases.map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const r = possibilitesRejeu(traces, TEXTE);
  assert.equal(r.possibilites.length, 1);
  assert.equal(r.possibilites[0].capacite, 'recherche');
  assert.deepEqual(r.possibilites[0].arguments, { relation: 'zvalRel', valeur: 'zvalVal' });
  assert.equal(r.possibilites[0].origines.length, 1);
});

// ============================================================================ C
test('C. une forme -> A constructible + B incomplète -> seulement A', () => {
  const phrasesA = phrasesAncrees('c1', 2).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  // "deduction" : rôle "role" jamais observé -> incomplet.
  const phrasesB = phrasesAncrees('c2', 2).map((p, i) => traceAction(i + 3, p, 'deduction', { sujet: 1 }));
  const r = possibilitesRejeu([...phrasesA, ...phrasesB], TEXTE);
  assert.equal(r.possibilites.length, 1);
  assert.equal(r.possibilites[0].capacite, 'recherche');
});

// ============================================================================ D
test('D. une forme -> A + B constructibles -> 2', () => {
  const phrasesA = phrasesAncrees('d1', 2).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const phrasesB = phrasesAncrees('d2', 2).map((p, i) => traceAction(i + 3, p, 'deduction', { sujet: 1, role: 3 }));
  const r = possibilitesRejeu([...phrasesA, ...phrasesB], TEXTE);
  assert.equal(r.possibilites.length, 2);
  const capacites = r.possibilites.map((p) => p.capacite).sort();
  assert.deepEqual(capacites, ['deduction', 'recherche']);
});

// --- Corpus "forme large + sous-forme (doublon exact)" --------------------------------------------
// Vérifié empiriquement (vueDescriptive() appelée directement) : une phrase DUPLIQUÉE littéralement
// (id1 et id3) au sein d'un corpus par ailleurs variable (id2) produit RÉELLEMENT deux éléments
// vueDescriptive() distincts -- la forme LARGE (couverture {1,2,3}, ancres 0/2 seulement, comme le
// reste de ce fichier de tests) et une forme ÉTROITE strictement plus spécifique (couverture {1,3},
// TOUTES les positions ancrées puisque id1 et id3 sont byte-identiques). C'est le mécanisme RÉEL,
// déjà documenté dans l'en-tête de vueDescriptive() (section 14 de son propre diagnostic), qui
// produit deux couvertures différentes pour un même capital de traces -- jamais deux groupes
// disjoints partageant un même mot d'ancrage, qui seraient au contraire FUSIONNÉS en une seule
// couverture par repererMotifs() (tout gabarit à 1 jeton partagé suffit à les relier).
function corpusLargeEtroit(prefixe) {
  const dup = `zaccede ${prefixe}orbo zordre ${prefixe}kelmi`;
  const autre = `zaccede ${prefixe}alpha zordre ${prefixe}beta`;
  const traces = [
    traceAction(1, dup, 'recherche', { relation: 1, valeur: 3 }),
    traceAction(2, autre, 'recherche', { relation: 1, valeur: 3 }),
    traceAction(3, dup, 'recherche', { relation: 1, valeur: 3 }),
  ];
  return { traces, texte: dup, relation: `${prefixe}orbo`, valeur: `${prefixe}kelmi` };
}

// ============================================================================ E
test('E. deux formes (large + sous-forme) -> même A, mêmes arguments -> fusion 1, deux origines', () => {
  const { traces, texte, relation, valeur } = corpusLargeEtroit('e');
  const r = possibilitesRejeu(traces, texte);
  assert.equal(r.possibilites.length, 1);
  assert.deepEqual(r.possibilites[0].arguments, { relation, valeur });
  assert.equal(r.possibilites[0].origines.length, 2);
});

// ============================================================================ F
test('F. deux formes -> même A, arguments différents -> 2', () => {
  // Vocabulaires DISJOINTS (aucun mot partagé) : repererMotifs() ne peut alors JAMAIS rapprocher les
  // deux groupes (aucun gabarit mot-exact commun), donc aucune fusion de couverture -- vérifié
  // empiriquement. g1 ancré sur 'zaccede'/'zordre' (positions 0,2) ; g2 ancré uniquement sur le mot
  // 'zvalRel' du texte présent lui-même (position 1) -- les deux correspondent au MÊME texte présent
  // sans jamais se chevaucher en traces.
  const g1 = phrasesAncrees('f1', 2).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const g2 = [
    traceAction(3, 'zA1 zvalRel zB1 zC1', 'recherche', { relation: 3, valeur: 1 }),
    traceAction(4, 'zA2 zvalRel zB2 zC2', 'recherche', { relation: 3, valeur: 1 }),
  ];
  const r = possibilitesRejeu([...g1, ...g2], TEXTE);
  assert.equal(r.possibilites.length, 2);
  const relations = r.possibilites.map((p) => p.arguments.relation).sort();
  assert.deepEqual(relations, ['zvalRel', 'zvalVal']);
});

// ============================================================================ G
test('G. deux formes -> A et B -> 2', () => {
  const g1 = phrasesAncrees('g1', 2).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const g2 = phrasesAncrees('g2', 2).map((p, i) => traceAction(i + 3, p, 'deduction', { sujet: 1, role: 3 }));
  const r = possibilitesRejeu([...g1, ...g2], TEXTE);
  assert.equal(r.possibilites.length, 2);
  assert.deepEqual(r.possibilites.map((p) => p.capacite).sort(), ['deduction', 'recherche']);
});

// ============================================================================ H
test('H. forme large + sous-forme (doublon exact) -> même invocation -> fusion', () => {
  // Même mécanisme que E, réutilisé ici pour sa propre lettre : la forme LARGE (couverture {1,2,3})
  // et sa SOUS-FORME strictement plus spécifique produite par le DOUBLON EXACT (id1≡id3, couverture
  // {1,3}) sont deux éléments RÉELS et distincts de vueDescriptive() (vérifié empiriquement), jamais
  // une fusion artificielle. Aucune des deux ne « gagne » : les deux origines sont conservées.
  const { traces, texte, relation, valeur } = corpusLargeEtroit('h');
  const r = possibilitesRejeu(traces, texte);
  assert.equal(r.possibilites.length, 1);
  assert.deepEqual(r.possibilites[0].arguments, { relation, valeur });
  assert.equal(r.possibilites[0].origines.length, 2, 'la forme large et sa sous-forme (doublon exact) restent deux origines, jamais une seule retenue au détriment de l\'autre');
  const tailles = r.possibilites[0].origines.map((o) => o.couverture.length).sort((a, b) => a - b);
  assert.deepEqual(tailles, [2, 3], 'la sous-forme (doublon exact, couverture 2) et la forme large (couverture 3) coexistent bien');
});

// ============================================================================ I
test('I. une seule observation de A dans une couverture plus large -> possibilité conservée', () => {
  const phrases = phrasesAncrees('i', 4);
  const traces = [
    traceAction(1, phrases[0], 'zCapaciteFantome', { x: 1 }),
    traceAction(2, phrases[1], 'zCapaciteFantome', { x: 1 }),
    traceAction(3, phrases[2], 'zCapaciteFantome', { x: 1 }),
    traceAction(4, phrases[3], 'recherche', { relation: 1, valeur: 3 }), // seule trace "recherche" ici
  ];
  const r = possibilitesRejeu(traces, TEXTE);
  assert.equal(r.possibilites.length, 1);
  assert.equal(r.possibilites[0].capacite, 'recherche');
  assert.equal(r.possibilites[0].origines[0].tracesCapacite, 1);
});

// ============================================================================ J
test('J. nombreuses traces sans provenance + une précise -> conservée, stats non masquées', () => {
  const phrases = phrasesAncrees('j', 6);
  const anciennes = phrases.slice(0, 5).map((p, i) => traceAncienne(i + 1, p, 'recherche'));
  const precise = traceAction(6, phrases[5], 'recherche', { relation: 1, valeur: 3 });
  const r = possibilitesRejeu([...anciennes, precise], TEXTE);
  assert.equal(r.possibilites.length, 1);
  assert.equal(r.possibilites[0].origines[0].tracesAvecProvenance, 1);
  assert.equal(r.possibilites[0].origines[0].tracesSansProvenance, 5, 'les 5 anciennes restent visibles, jamais cachées');
});

// ============================================================================ K
test('K. deux possibilités avec fréquences 100 contre 1 -> toujours 2, aucune priorité', () => {
  const phrasesA = phrasesAncrees('k1', 100);
  const tracesA = phrasesA.map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const phrasesB = phrasesAncrees('k2', 1);
  const tracesB = [traceAction(101, phrasesB[0], 'deduction', { sujet: 1, role: 3 })];
  const r = possibilitesRejeu([...tracesA, ...tracesB], TEXTE);
  assert.equal(r.possibilites.length, 2, 'aucune fréquence ne doit faire disparaître la possibilité minoritaire');
  assert.deepEqual(r.possibilites.map((p) => p.capacite).sort(), ['deduction', 'recherche']);
  for (const p of r.possibilites) {
    assert.deepEqual(Object.keys(p).sort(), ['arguments', 'capacite', 'origines'], 'aucun champ score/priorité/confiance');
  }
});

// ============================================================================ L
test('L. capacité historique disparue -> éliminée', () => {
  const fantome = phrasesAncrees('l1', 2).map((p, i) => traceAction(i + 1, p, 'zCapaciteDisparueDepuisLongtemps', { x: 1 }));
  const reelle = phrasesAncrees('l2', 2).map((p, i) => traceAction(i + 3, p, 'recherche', { relation: 1, valeur: 3 }));
  const r = possibilitesRejeu([...fantome, ...reelle], TEXTE);
  assert.equal(r.possibilites.length, 1);
  assert.equal(r.possibilites[0].capacite, 'recherche');
});

// ============================================================================ M
test('M. formes correspondantes mais aucune reconstruction complète -> []', () => {
  // "accessibilite" exige {sujetA, operateur, sujetB} ; seul sujetA est jamais fourni -> incomplet.
  const traces = phrasesAncrees('m', 3).map((p, i) => traceAction(i + 1, p, 'accessibilite', { sujetA: 1 }));
  const r = possibilitesRejeu(traces, TEXTE);
  assert.deepEqual(r.possibilites, []);
});

// ============================================================================ N
// NOTE HONNÊTE : avec le registre réel (CAPACITES, registre.js), CAPACITES[capacite].roles est un
// tableau FIGÉ (Object.freeze) unique par capacité -- construireArgumentsPresents() construit donc
// TOUJOURS l'objet "arguments" en itérant ce même ordre, pour une même capacité. Il ne peut donc
// JAMAIS exister, avec le registre actuel, deux reconstructions de la MÊME capacité dont l'objet
// "arguments" différerait par l'ORDRE d'insertion de ses clés -- vérifié par lecture du code, jamais
// supposé. La déduplication ci-dessous est néanmoins implémentée de façon insensible à cet ordre (clé
// de déduplication construite sur les rôles TRIÉS, jamais sur l'ordre d'insertion JS), par discipline
// défensive -- ce test exerce la fusion réelle (équivalente à E) et documente pourquoi un cas où
// l'ordre diffère RÉELLEMENT ne peut pas être construit honnêtement ici.
test('N. mêmes arguments, ordre des clés sans incidence (garde défensif, ordre réel toujours identique pour une même capacité) -> fusion', () => {
  const g1 = phrasesAncrees('n1', 2).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const g2 = phrasesAncrees('n2', 2).map((p, i) => traceAction(i + 3, p, 'recherche', { relation: 1, valeur: 3 }));
  const r = possibilitesRejeu([...g1, ...g2], TEXTE);
  assert.equal(r.possibilites.length, 1);
  assert.deepEqual(Object.keys(r.possibilites[0].arguments), ['relation', 'valeur']);
});

// ============================================================================ O
test('O. ordre des traces inversé/permuté -> même sortie', () => {
  const phrasesA = phrasesAncrees('o1', 2).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const phrasesB = phrasesAncrees('o2', 2).map((p, i) => traceAction(i + 3, p, 'deduction', { sujet: 1, role: 3 }));
  const traces = [...phrasesA, ...phrasesB];
  const r1 = possibilitesRejeu(traces, TEXTE);
  const r2 = possibilitesRejeu(traces.slice().reverse(), TEXTE);
  assert.deepEqual(r1, r2);
});

// ============================================================================ P
test('P. deux couvertures différentes (large/sous-forme) -> jamais fusionnées avant reconstruction, seulement au niveau invocation', () => {
  const { traces, texte } = corpusLargeEtroit('p');
  const r = possibilitesRejeu(traces, texte);
  assert.equal(r.possibilites.length, 1);
  const [o1, o2] = r.possibilites[0].origines;
  assert.notDeepEqual(o1.couverture.slice().sort(), o2.couverture.slice().sort(), 'deux couvertures réellement distinctes ({1,2,3} vs {1,3}), jamais fusionnées avant reconstruction -- seule la fusion AU NIVEAU DE L\'INVOCATION, après coup, les réunit');
});

// ============================================================================ Q
test('Q. même capacité, mêmes rôles, valeur ne différant que par la casse -> NE PAS fusionner', () => {
  const texte = 'zaccede ZVAL zordre zval';
  const g1 = phrasesAncrees('q1', 2).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  // Vocabulaire disjoint (ancré sur 'ZVAL', le mot du texte présent à la position 1) : jamais fusionné
  // avec g1 par repererMotifs() -- aucun mot d'ancrage partagé.
  const g2 = [
    traceAction(3, 'zD1 ZVAL zE1 zF1', 'recherche', { relation: 3, valeur: 0 }),
    traceAction(4, 'zD2 ZVAL zE2 zF2', 'recherche', { relation: 3, valeur: 0 }),
  ];
  const r = possibilitesRejeu([...g1, ...g2], texte);
  assert.equal(r.possibilites.length, 2, 'ZVAL et zval sont des chaînes différentes : jamais fusionnées par une casse ignorée');
  const relations = r.possibilites.map((p) => p.arguments.relation).sort();
  assert.deepEqual(relations, ['ZVAL', 'zval']);
});

// ============================================================================ R
test('R. arguments identiques par contenu mais produits par deux reconstructions distinctes (large/sous-forme) -> fusion (identité par contenu, jamais par référence)', () => {
  // Réutilise le mécanisme large/sous-forme (E/H/P) : deux appels RÉELLEMENT séparés à
  // construireArgumentsPresents() (un par élément de vueDescriptive(), donc deux objets "arguments"
  // JS physiquement distincts en mémoire) produisent ici un contenu identique -- la fusion doit se
  // faire sur ce CONTENU, jamais sur une égalité de référence d'objet (qui échouerait toujours, deux
  // literals différents n'étant jamais le même objet).
  const { traces, texte } = corpusLargeEtroit('r');
  const r = possibilitesRejeu(traces, texte);
  assert.equal(r.possibilites.length, 1, 'deux objets "arguments" distincts en mémoire, mais de même contenu, doivent fusionner');
  assert.equal(r.possibilites[0].origines.length, 2, 'les deux reconstructions (large + sous-forme) sont réellement distinctes avant la fusion');
});

// ============================================================================ GARDE ANTI-NORMATIVITÉ
test('[GARDE] changer les occurrences/la taille de couverture sans changer les invocations reconstructibles ne crée aucune priorité ni ne supprime une possibilité', () => {
  const phrasesA2 = phrasesAncrees('garde1', 2).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const phrasesB2 = phrasesAncrees('garde2', 2).map((p, i) => traceAction(i + 3, p, 'deduction', { sujet: 1, role: 3 }));
  const base = possibilitesRejeu([...phrasesA2, ...phrasesB2], TEXTE);

  // Variante : "recherche" obtient BEAUCOUP plus de traces/une couverture bien plus grande, sans que
  // l'invocation reconstructible (mêmes positions, donc mêmes arguments) ne change.
  const phrasesAGrand = phrasesAncrees('gardeGrand', 20).map((p, i) => traceAction(i + 1, p, 'recherche', { relation: 1, valeur: 3 }));
  const variante = possibilitesRejeu([...phrasesAGrand, ...phrasesB2.map((t) => ({ ...t, id: t.id + 100 }))], TEXTE);

  assert.equal(base.possibilites.length, 2);
  assert.equal(variante.possibilites.length, 2, 'ni la taille de couverture ni le nombre d\'occurrences ne doivent faire disparaître une possibilité');
  const clesBase = base.possibilites.map((p) => `${p.capacite}:${JSON.stringify(p.arguments)}`).sort();
  const clesVariante = variante.possibilites.map((p) => `${p.capacite}:${JSON.stringify(p.arguments)}`).sort();
  assert.deepEqual(clesBase, clesVariante, 'les invocations distinctes reconstructibles restent les mêmes, quelle que soit la taille des couvertures');
});
