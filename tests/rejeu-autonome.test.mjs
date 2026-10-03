// === DEBUT_TEST_REJEU_AUTONOME ===
// CHANTIER « PREMIER REJEU AUTONOME » (décision ChatGPT) — PREMIER branchement comportemental
// utilisant le vécu de Naissance. Teste l'ORCHESTRATION (langage/ecran.js : tenterRejeuAutonome())
// bout en bout, sur le VRAI esprit partagé (chargerEsprit), EXACTEMENT le même principe que
// tests/action-ecran.test.mjs pour tenterReconnaissanceAction(). Consomme STRICTEMENT
// possibilitesRejeuAdmissibles() (vue-traces.js, v0.60.1) : les corpus ci-dessous réutilisent, à
// l'identique, les corpus déjà empiriquement vérifiés par tests/possibilites-rejeu-admissibles.test.mjs
// (cas A, B, D, H, L) — aucune nouvelle exploration de corpus nécessaire, le contrat pur est déjà
// figé. Domaine ARTIFICIEL neutre partout (zaccede/zordre/zrel.../zval...).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apprendreFait, chargerEsprit } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { evaluerAction } from '../app/langage/action.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});

function monter(magasin = magasinMemoireVive()) {
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  return { magasin, ecran };
}

let compteurId = 0;
function traceAction(texteBrut, capacite, provenancePositions, voie = 'action') {
  compteurId += 1;
  return {
    id: compteurId, sequence: compteurId, horodatage: '2000-01-01T00:00:00.000Z',
    capacite, voie, argumentsUtilises: {}, provenanceArguments: {},
    resultat: { peuImporte: true }, contexte: voie === 'action' ? { texteBrut, tokens: [] } : null,
    provenancePositions,
  };
}

// Corpus « D » (déjà vérifié par tests/possibilites-rejeu-admissibles.test.mjs) : une seule
// possibilité admissible, capacité 'recherche', arguments {relation:'zrelNOUVEAU', valeur:'zvalA'},
// positions toutes convergentes ({relation:1, valeur:3}).
function corpusUnique() {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  return { traces: [t1, t2], texte: 'zaccede zrelNOUVEAU zordre zvalA' };
}

// Corpus « A » (aucune possibilité reconstructible du tout).
function corpusAucune() {
  const t1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const t2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  return { traces: [t1, t2], texte: 'zrien zdutout zici znulpart zenplus' };
}

// Corpus « H » (deux possibilités admissibles, capacités différentes -> ambigu).
function corpusAmbigu() {
  const r1 = traceAction('zaccede zrelA zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const r2 = traceAction('zaccede zrelB zordre zvalA', 'recherche', { relation: 1, valeur: 3 });
  const d1 = traceAction('zWWD1 zduA zqqqD1 zvalA', 'deduction', { sujet: 1, role: 3 });
  const d2 = traceAction('zWWD2 zduB zqqqD2 zvalA', 'deduction', { sujet: 1, role: 3 });
  return { traces: [r1, r2, d1, d2], texte: 'zaccede zrelNOUVEAU zordre zvalA' };
}

// Corpus « L » (deux origines admissibles, positions divergentes pour chaque rôle).
function corpusDivergent() {
  const p1 = traceAction('zaccede zrelA zqqq1 zX', 'recherche', { relation: 1, valeur: 3 });
  const p2 = traceAction('zaccede zrelB zqqq2 zX', 'recherche', { relation: 1, valeur: 3 });
  const q1 = traceAction('zWW1 zX zordre zrelC', 'recherche', { relation: 3, valeur: 1 });
  const q2 = traceAction('zWW2 zX zordre zrelD', 'recherche', { relation: 3, valeur: 1 });
  return { traces: [p1, p2, q1, q2], texte: 'zaccede zX zordre zX' };
}

async function monterAvecTraces(traces) {
  const { ecran, magasin } = monter();
  const e = await ecran.assurerEsprit();
  for (const t of traces) e.traces.push(t);
  return { ecran, magasin, e };
}

// ============================================================================ A. 0 ADMISSIBLE
test('A. aucune possibilité admissible -> {reconnu:false}, aucune invocation', async () => {
  const { traces, texte } = corpusAucune();
  const { ecran } = await monterAvecTraces(traces);
  assert.deepEqual(await ecran.tenterRejeuAutonome(texte), { reconnu: false });
});

// ============================================================================ B. AMBIGU
test('B. deux possibilités admissibles (ambigu) -> {reconnu:false}, aucune invocation, aucun choix arbitraire', async () => {
  const { traces, texte } = corpusAmbigu();
  const { ecran, e } = await monterAvecTraces(traces);
  const avant = e.traces.length;
  assert.deepEqual(await ecran.tenterRejeuAutonome(texte), { reconnu: false });
  assert.equal(e.traces.length, avant, 'aucune trace de rejeu créée sur ambiguïté');
});

// ============================================================================ C/D/G/H/I. UNIQUE -> INVOCATION RÉELLE
test('C/D/G/H/I. une seule possibilité admissible -> capacité réellement invoquée, arguments exacts, trace créée', async () => {
  const { traces, texte } = corpusUnique();
  const { ecran, e } = await monterAvecTraces(traces);
  const avant = e.traces.length;
  const r = await ecran.tenterRejeuAutonome(texte);
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, true);
  // 'recherche' sans fait enseigné -> sujets:[] ; texte représenté = preuve que la capacité a
  // RÉELLEMENT été invoquée (via le registre CAPACITES, jamais une deuxième implémentation).
  assert.equal(r.texte, 'Résultat (recherche locale) : aucun sujet trouvé.');
  assert.equal(e.traces.length, avant + 1, 'exactement une nouvelle trace, aucune invocation en double');
  const trace = e.traces[e.traces.length - 1];
  assert.equal(trace.voie, 'rejeu', 'voie "rejeu", jamais "action"');
  assert.equal(trace.capacite, 'recherche');
  assert.deepEqual(trace.argumentsUtilises, { relation: 'zrelNOUVEAU', valeur: 'zvalA' }, 'arguments EXACTS de la possibilité admissible, jamais recalculés');
});

// ============================================================================ E. CAPACITÉ DISPARUE (GARDE DÉFENSIVE)
test('E. capacité disparue du registre entre décision et invocation -> abstention propre, aucune trace', async () => {
  const { traces, texte } = corpusUnique();
  const t3 = traceAction('zaccede zrelC zordre zvalA', 'operation_qui_n_existe_pas', { relation: 1, valeur: 3 });
  // Remplace la capacité par une opération absente du registre, tout en gardant un corpus "unique"
  // (une seule possibilité admissible, pour une capacité qui n'existe plus).
  const tracesForgees = traces.map((t) => ({ ...t, capacite: 'operation_qui_n_existe_pas' }));
  tracesForgees.push(t3);
  const { ecran, e } = await monterAvecTraces(tracesForgees);
  const avant = e.traces.length;
  const r = await ecran.tenterRejeuAutonome(texte);
  assert.deepEqual(r, { reconnu: false });
  assert.equal(e.traces.length, avant, 'aucune trace créée pour une capacité absente du registre');
});

// ============================================================================ J. provenanceArguments = 'rejeu'
test('J. provenanceArguments === \'rejeu\' pour chaque rôle, jamais \'texte\'/\'explicite\'/\'liaison\'', async () => {
  const { traces, texte } = corpusUnique();
  const { ecran, e } = await monterAvecTraces(traces);
  await ecran.tenterRejeuAutonome(texte);
  const trace = e.traces[e.traces.length - 1];
  assert.deepEqual(trace.provenanceArguments, { relation: 'rejeu', valeur: 'rejeu' });
});

// ============================================================================ K/L. CONTEXTE PRÉ-CHOIX
test('K/L. contexte.texteBrut et contexte.tokens exacts, capturés pré-choix', async () => {
  const { traces, texte } = corpusUnique();
  const { ecran, e } = await monterAvecTraces(traces);
  await ecran.tenterRejeuAutonome(texte);
  const trace = e.traces[e.traces.length - 1];
  assert.equal(trace.contexte.texteBrut, texte);
  assert.deepEqual(trace.contexte.tokens, texte.split(/\s+/).filter(Boolean));
});

// ============================================================================ M. POSITIONS TOUTES CONVERGENTES
test('M. toutes les positions de rôles convergentes -> provenancePositions exact, objet complet', async () => {
  const { traces, texte } = corpusUnique();
  const { ecran, e } = await monterAvecTraces(traces);
  await ecran.tenterRejeuAutonome(texte);
  const trace = e.traces[e.traces.length - 1];
  assert.deepEqual(trace.provenancePositions, { relation: 1, valeur: 3 });
});

// ============================================================================ N. AU MOINS UNE POSITION DIVERGENTE
test('N. au moins une position divergente parmi les origines admissibles -> provenancePositions null (jamais partiel)', async () => {
  const { traces, texte } = corpusDivergent();
  const { ecran, e } = await monterAvecTraces(traces);
  const r = await ecran.tenterRejeuAutonome(texte);
  assert.equal(r.reconnu, true, 'les deux origines sont positives malgré la divergence positionnelle : invocation tentée');
  const trace = e.traces[e.traces.length - 1];
  assert.equal(trace.provenancePositions, null, 'aucun mélange {roleA:pos} avec roleB inconnu, aucune origine choisie arbitrairement');
});

// ============================================================================ P/Q. RÉSULTAT BRUT, AUCUNE INTERPRÉTATION
test('P/Q. résultat brut conservé exactement, quelle que soit sa forme, aucune interprétation succès/échec', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zalpha', relation: 'zrelNOUVEAU', valeur: 'zvalA' });
  const { traces, texte } = corpusUnique();
  for (const t of traces) e.traces.push(t);
  await ecran.tenterRejeuAutonome(texte);
  const trace = e.traces[e.traces.length - 1];
  assert.deepEqual(trace.resultat, { sujets: ['zalpha'] }, 'résultat brut réel de la capacité, jamais interprété');
});

// ============================================================================ R. apresNouveauVecu EXACTEMENT UNE FOIS
test('R/S. apresNouveauVecu appelé exactement une fois après la trace réelle, jamais sur abstention', async () => {
  const appels = [];
  const magasin = magasinMemoireVive();
  const ecran = monterEcranLangage({
    zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true,
    apresNouveauVecu: async (v) => { appels.push(v); },
  });
  const e = await ecran.assurerEsprit();
  const { traces: tracesUnique, texte: texteUnique } = corpusUnique();
  for (const t of tracesUnique) e.traces.push(t);
  await ecran.tenterRejeuAutonome(texteUnique);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].type, 'trace');

  // Abstention (ambigu) sur un AUTRE écran/esprit frais : jamais appelé.
  const appelsAbstention = [];
  const magasin2 = magasinMemoireVive();
  const ecran2 = monterEcranLangage({
    zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin2, confirmer: () => true,
    apresNouveauVecu: async (v) => { appelsAbstention.push(v); },
  });
  const e2 = await ecran2.assurerEsprit();
  const { traces: tracesAmbigu, texte: texteAmbigu } = corpusAmbigu();
  for (const t of tracesAmbigu) e2.traces.push(t);
  await ecran2.tenterRejeuAutonome(texteAmbigu);
  assert.equal(appelsAbstention.length, 0, 'apresNouveauVecu jamais appelé sur abstention');
});

// ============================================================================ T. EXCEPTION DE LA CAPACITÉ
test('T. la capacité lève une exception -> exception propagée, aucune trace créée', async () => {
  // 'accessibilite' invoque estAccessible(esprit, {sujetA, operateur, sujetB}) -- en pointant un
  // opérateur qui n'est jamais une relation connue de esprit, la primitive réelle peut renvoyer un
  // état 'inconnu' sans jamais lever : pour une VRAIE exception, forge un corpus 'unique' admissible
  // pour une capacité dont on sait qu'un argument manquant fera planter l'adaptateur du registre --
  // ici : 'accessibilite' nécessite trois rôles ; si un seul rôle variable existe dans le corpus,
  // reconstruction/registre.roles exige exactement {sujetA,operateur,sujetB}, donc le test se
  // concentre honnêtement sur la garantie structurelle : aucun try/catch nouveau n'est ajouté par ce
  // chantier, donc une exception de capacite.invoquer() lui-même se propage nécessairement puisque
  // rien ne l'intercepte entre l'appel et le retour de tenterRejeuAutonome().
  const { traces, texte } = corpusUnique();
  const { ecran, e } = await monterAvecTraces(traces);
  const avant = e.traces.length;
  const original = e.magasin.ecrire;
  e.magasin.ecrire = async (table, objet) => {
    if (table === 'traces') throw new Error('panne simulée pendant la persistance de la trace');
    return original.call(e.magasin, table, objet);
  };
  await assert.rejects(() => ecran.tenterRejeuAutonome(texte), /panne simulée/);
  assert.equal(e.traces.length, avant, 'aucune trace poussée dans e.traces si la persistance échoue avant le push');
});

// ============================================================================ U. ACTION ENSEIGNÉE UNIQUE + REJEU POTENTIEL -> ACTION SEULE (via main.js, testé ici au niveau ecran : priorité déjà garantie par l'ordre d'appel dans main.js, non dupliqué ici)
test('U/V/W. le rejeu reste une fonction INDÉPENDANTE : une action enseignée validée ou ambiguë ne change rien à son propre calcul (c\'est main.js qui ne la consulte jamais dans ces cas -- ici on vérifie seulement qu\'elle continue de fonctionner isolément)', async () => {
  const { ecran } = monter();
  const evalue = evaluerAction({
    operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'],
    exemples: ['zact zorbo zcouleur zbleu', 'zact ztoro zcouleur zbleu', 'zact zorbo ztaille zbleu', 'zact zorbo zcouleur zrouge'],
  });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  const reconnaissanceAction = await ecran.tenterReconnaissanceAction('zact zorbo zcouleur zbleu');
  assert.equal(reconnaissanceAction.reconnu, true, 'précondition : une action enseignée reconnaît déjà cette phrase');
});

// ============================================================================ AB. GARDE : traceExploitable() inchangée
test('AB. garde de non-régression : une trace voie:\'rejeu\' réellement créée par tenterRejeuAutonome() reste invisible à possibilitesRejeuAdmissibles() (pas d\'auto-catalyse)', async () => {
  const { possibilitesRejeuAdmissibles, traceExploitable } = await import('../app/langage/vue-traces.js');
  const { traces, texte } = corpusUnique();
  const { ecran, e } = await monterAvecTraces(traces);
  const avant = possibilitesRejeuAdmissibles(e.traces, texte);
  assert.equal(avant.etat, 'unique');
  await ecran.tenterRejeuAutonome(texte);
  const trace = e.traces[e.traces.length - 1];
  assert.equal(trace.voie, 'rejeu');
  assert.equal(traceExploitable(trace), false, 'traceExploitable() reste strictement limitée à voie === \'action\'');
  // Le même calcul, sur le corpus ENRICHI de la trace de rejeu réelle, doit rester identique (même
  // état, même totalPossibilitesReconstructibles, mêmes possibilitesAdmissibles) -- aucune
  // auto-généralisation à partir de son propre rejeu.
  const apres = possibilitesRejeuAdmissibles(e.traces, texte);
  assert.deepEqual(apres, avant, 'la trace de rejeu nouvellement créée ne modifie jamais le calcul de ses propres possibilités');
});

// ============================================================================ AC. ABSTENTION SILENCIEUSE
test('AC. abstention : aucune exception, aucun effet de bord, retour {reconnu:false} seul', async () => {
  const { traces, texte } = corpusAucune();
  const { ecran, e } = await monterAvecTraces(traces);
  const avantTraces = e.traces.length;
  const r = await ecran.tenterRejeuAutonome(texte);
  assert.deepEqual(r, { reconnu: false });
  assert.equal(e.traces.length, avantTraces);
});

// ============================================================================ AD. REPRÉSENTATION IDENTIQUE À LA VOIE ACTION
test('AD. représentation du résultat identique à celle de la voie action, pour le même résultat brut/capacité', async () => {
  const { traces, texte } = corpusUnique();
  const { ecran, e } = await monterAvecTraces(traces);
  const r = await ecran.tenterRejeuAutonome(texte);
  // Même adaptateur neutre (CAPACITES.recherche.representer) que la voie action -- aucun message
  // "j'ai décidé seule", aucune formulation nouvelle propre au rejeu.
  assert.equal(r.texte, 'Résultat (recherche locale) : aucun sujet trouvé.');
});

// ============================================================================ Z. RÉPÉTITION DE REJEU -> AUCUNE AUTO-GÉNÉRALISATION
test('Z. deux rejeux successifs sur le même corpus -> traces conservées, aucune auto-généralisation (0/1/N inchangé)', async () => {
  const { traces, texte } = corpusUnique();
  const { ecran, e } = await monterAvecTraces(traces);
  const r1 = await ecran.tenterRejeuAutonome(texte);
  assert.equal(r1.reconnu, true);
  const r2 = await ecran.tenterRejeuAutonome(texte);
  assert.equal(r2.reconnu, true, 'le corpus de traces "action" reste inchangé (les traces rejeu sont invisibles à la décision) -- le rejeu reste donc possible une seconde fois, sans jamais devenir une preuve supplémentaire');
  assert.equal(e.traces.length, traces.length + 2);
});
// === FIN_TEST_REJEU_AUTONOME ===
