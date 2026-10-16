// v0.64.8 — « LA CONFRONTATION COMME UNITÉ DU VÉCU » (décision ChatGPT « v0.64.8 », 13/10/2026).
// Preuves : contrat et dormance de confrontationsDAttentes ; identité [attente, conséquence] ; avant = description seule ; après { domaine, chemin
// [, constat] } et absence non ambiguë ; aucune confrontation sans conséquence ; pluralité (double réponse) sans TypeError, ajout sans réécriture ;
// stabilité et permutations ; exécutions réelles et synthétiques ; comparaison avec l'ancienne vue sur un vécu sans double réponse ; preuve permutée
// sans effet ; première expérience (angle mort de formation, non corrigé) ; sondes d'éléments et de co-couvertures sans règle de décision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/confrontations-attentes.js';
import { confrontationsDAttentes } from '../app/langage/confrontations-attentes.js';
import { experiencesDAttentes } from '../app/langage/experiences-attentes.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { memesConstats } from '../app/langage/constats-structurels.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { coCouverturesDeDescriptions } from '../app/langage/co-couvertures-descriptions.js';
import { normaliserCouverture } from '../app/langage/couverture-occurrences.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES } from '../app/langage/connaissances.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'confrontations-attentes.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f, motif = /^confrontationsDAttentes : /) => assert.throws(f, (e) => e instanceof TypeError && motif.test(e.message));
const k = (x) => JSON.stringify(x);
const ensemble = (cs) => cs.map(k).sort();
const statutDerive = (c) => (!Object.hasOwn(c.apres, 'constat') ? 'absente' : memesConstats({ chemin: c.avant.chemin, ...c.avant.constat }, { chemin: c.apres.chemin, ...c.apres.constat }) ? 'realisee' : 'autre');

// ------------------------------------------------------------------------------------------------ monde réel (protocole du téléphone)
function monde() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); await consequenceReception(magasin, d.reception); await traiterOccasion(magasin, d.reception.id); }
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function repos() { for (let c = await lireCapacite(magasin); c.valeur < 3; c = await lireCapacite(magasin)) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  async function message(texte, idEmission = null) {
    await repos();
    const avant = (await magasin.lireTout('emissions')).length;
    await tour(texte, idEmission);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).slice(avant).filter((e) => ex.find((q) => q.id === e.idExecution).operation === 'symbolesDeChaine').at(-1);
  }
  async function photo() {
    const v = await lireExecutionsVecues(magasin);
    return structuredClone({ attentes: await magasin.lireTout('attentesProspectives'), contextes: await magasin.lireTout('contextesProspectifs'), v });
  }
  return { magasin, message, photo };
}
const vue = (p, attentes = p.attentes) => confrontationsDAttentes(attentes, p.contextes, p.v.valeurs, p.v.executions, p.v.descriptions);
const ancienne = (p) => experiencesDAttentes(p.attentes, p.contextes, p.v.valeurs, p.v.executions, p.v.descriptions);

// Monde de la décision : K9→77, Q4→55, K9→77, puis K9 émis (K0), répondu 77 (K1), puis 99 (K2).
// MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : gel récursif (Object.freeze) des photos et des vues partagées, pour qu'aucun test ne puisse les muter.
const geler = (x) => { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); for (const v of Object.values(x)) geler(v); } return x; };
// MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : promesse mémoïsée (construction au PREMIER appel, quel que soit le test) ; E cloné, K0/K1/K2 (déjà structuredClone par photo) et E GELÉS EN PROFONDEUR ; le monde d'origine est jeté.
let MONDE = null;
function mondeDecision() {
  if (MONDE) return MONDE;
  MONDE = (async () => {
    const w = monde();
    for (const [x, y] of [['K9', '77'], ['Q4', '55'], ['K9', '77']]) { const E = await w.message(x); await w.message(y, E.id); }
    const E = await w.message('K9');
    const K0 = await w.photo();
    await w.message('77', E.id); const K1 = await w.photo();
    await w.message('99', E.id); const K2 = await w.photo();
    return geler({ E: structuredClone(E), K0, K1, K2 });
  })();
  return MONDE;
}
// MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : vue(K1) et vue(K2) (≈ 1 s chacune) étaient recalculées 5 fois ; UNE vue de référence par photo, calculée au premier appel par un appel réel à la fonction, puis GELÉE EN PROFONDEUR, réutilisée là où le test ne fait que lire. A2 (sortie brute), B2 (stabilité entre recalculs), B3/B4 (variantes permutées) et C2 (monde neuf) gardent leurs appels réels.
let VUES = null;
async function vuesDecision() {
  const M = await mondeDecision();
  if (!VUES) VUES = geler({ K1: vue(M.K1), K2: vue(M.K2) });
  return VUES;
}

// ------------------------------------------------------------------------------------------------ monde synthétique (absence d'un chemin)
const ch = { forme: 'scalaire', genre: 'chaine' };
const coll = { forme: 'collection', elements: ch };
const DESC_NC = [{ nom: 'eclater', entrees: { x: ch }, sortie: coll }, { nom: 'recoller', entrees: { elements: coll }, sortie: { forme: 'quelconque' } }];
function mondeSynthetique(n, issues, courante) {
  let seq = 0; const h = () => `2026-10-08T06:00:${String(++seq).padStart(2, '0')}.000Z`;
  const lien = (entree, donnee) => ({ entree, donnee });
  const ex = (id, operation, liaisons, resultat, idDesignation = `d-${id}`) => ({ id, horodatage: h(), idDesignation, operation, liaisons, resultat });
  const M = []; const E = []; const contextes = []; const attentes = []; let numero = 0;
  for (let i = 1; i <= n + 1; i += 1) {
    M.push({ id: `m${i}`, valeur: `v${i}` });
    E.push(ex(`R${i}`, 'eclater', [lien('x', `m${i}`)], ['v', String(i)]));
    const designation = { id: `d-S${i}`, horodatage: h(), idObservation: `o${i}`, operation: 'recoller', liaisons: [lien('elements', `R${i}`)] };
    const nouveaux = contextesProspectifs({ operation: 'recoller', liaisons: [lien('elements', `R${i}`)] }, M, E, DESC_NC).map((c) => ({ id: `c${i}-${c.parent ? 'p' : 'd'}`, horodatage: h(), idDesignation: `d-S${i}`, idObservation: `o${i}`, ...c }));
    contextes.push(...nouveaux);
    for (const c of nouveaux) for (const a of attentesDuContexteProspectif(c, designation, contextes, M, E, DESC_NC)) attentes.push({ id: `a${++numero}`, horodatage: h(), idObservation: `o${i}`, ...a });
    if (i <= n) E.push(ex(`S${i}`, 'recoller', [lien('elements', `R${i}`)], issues[i - 1], `d-S${i}`));
  }
  E.push(ex(`S${n + 1}`, 'recoller', [lien('elements', `R${n + 1}`)], courante, `d-S${n + 1}`));
  return { attentes, contextes, v: { valeurs: M, executions: E, descriptions: DESC_NC } };
}

// ================================================================================================ A. CONTRAT
test('A1. export unique confrontationsDAttentes (5 paramètres, synchrone) ; imports exacts : vue plurielle des issues + lecture par rôles ; aucun statut, aucune écriture, aucun état', () => {
  assert.deepEqual(Object.keys(module), ['confrontationsDAttentes']);
  assert.equal(confrontationsDAttentes.length, 5); assert.equal(confrontationsDAttentes.constructor.name, 'Function');
  assert.deepEqual([...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort(), ['./issue-attente-prospective.js', './roles-attente.js']);
  assert.equal(/statut|realisee|'autre'|absente|memesConstats|issueDuContexteProspectif|episodesDeTransformation|parcourirStructure/.test(CODE), false, 'aucune confrontation réimplémentée, aucun statut');
  assert.equal(/preuve|temoinsContexte|unitesIssues|fondation|horodatage|idObservation/.test(CODE), false, 'ni preuve ni occurrence (autre que l’id) lues');
  assert.equal(/\bDate\b|Math\.random|\bawait\b|\basync\b|magasin|\.ecrire|\.lireTout|globalThis|WeakMap/.test(CODE), false);
  assert.deepEqual(CODE.split('\n').filter((l) => /^(let|var) /.test(l)), []);
  assert.equal(/relationValeur|egale|differente|arrivee|depart|symbolesDeChaine|environnement:|soi:|score|probab|confian|recompense|récompense/i.test(CODE), false);
});

test('A2. UNITÉ : { identite: [attente.id, conséquence.id], avant, apres } ; avant = description exacte ; apres = { domaine, chemin[, constat] } ; X porte l’acte visé par A', async () => {
  const { K1 } = await mondeDecision();
  const { confrontations } = vue(K1);
  assert.ok(confrontations.length > 0);
  for (const c of confrontations) {
    assert.deepEqual(Object.keys(c), ['identite', 'avant', 'apres']);
    const a = K1.attentes.find((x) => x.id === c.identite[0]); const X = K1.v.executions.find((x) => x.id === c.identite[1]);
    assert.ok(a && X); assert.equal(c.identite.length, 2);
    assert.equal(X.idDesignation, a.references.idDesignation, 'A et X partagent l’identité de l’acte');
    assert.ok(a.horodatage <= X.horodatage, 'ordre causal');
    assert.deepEqual(c.avant, a.description); assert.notEqual(c.avant, a.description);
    assert.deepEqual(Object.keys(c.apres), Object.hasOwn(c.apres, 'constat') ? ['domaine', 'chemin', 'constat'] : ['domaine', 'chemin']);
    assert.deepEqual([c.apres.domaine, c.apres.chemin], [a.description.structure, a.description.chemin]);
  }
  assert.equal(new Set(confrontations.map((c) => k(c.identite))).size, confrontations.length, 'identités uniques');
});

test('A3. AUCUNE CONSÉQUENCE → AUCUNE CONFRONTATION : à K0 les attentes de l’acte en cours sont dans sansConsequence, aucune pseudo-confrontation', async () => {
  const { E, K0, K1 } = await mondeDecision();
  const miennes = K0.attentes.filter((a) => a.references.idDesignation === E.id).map((a) => a.id);
  assert.ok(miennes.length > 0);
  const r0 = vue(K0);
  assert.equal(r0.confrontations.some((c) => miennes.includes(c.identite[0])), false);
  for (const id of miennes) assert.ok(r0.sansConsequence.includes(id));
  const r1 = (await vuesDecision()).K1; // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : lecture seule de la vue de référence gelée
  for (const id of miennes) { assert.equal(r1.sansConsequence.includes(id), false); assert.equal(r1.confrontations.filter((c) => c.identite[0] === id).length, 1); }
  assert.equal(r1.sansConsequence.length + new Set(r1.confrontations.map((c) => c.identite[0])).size, K1.attentes.length, 'chaque attente : confrontée ou sans conséquence');
});

test('A4. ABSENCE : conséquence présente mais chemin attendu absent → confrontation dont l’après n’a pas de constat ; jamais confondue avec « aucune conséquence »', () => {
  const w = mondeSynthetique(3, ['x', 'x', 'x'], ['pas', 'comparable']);
  const { confrontations, sansConsequence } = vue(w);
  const absentes = confrontations.filter((c) => !Object.hasOwn(c.apres, 'constat'));
  assert.ok(absentes.length > 0);
  for (const c of absentes) { assert.equal(c.identite[1], 'S4'); assert.deepEqual(c.apres, { domaine: c.avant.structure, chemin: c.avant.chemin }); assert.equal(statutDerive(c), 'absente'); }
  assert.ok(absentes.some((c) => c.avant.chemin.join('.') === 'valeurs.arrivee'));
  assert.equal(sansConsequence.length, 0, 'toutes les attentes ont une conséquence : aucune n’est « sans conséquence »');
  assert.equal(JSON.stringify(confrontations).includes('ABSENT'), false);
});

// ================================================================================================ B. PLURALITÉ, IDENTITÉ, ORDRE
test('B1. PLURALITÉ (monde de la décision) : deux réponses → deux confrontations par attente de l’acte, sans TypeError ; même avant, après propre ; les confrontations de K1 restent strictement identiques à K2 ; l’ancienne vue refuse toujours', async () => {
  const { E, K1, K2 } = await mondeDecision();
  const V = await vuesDecision(); const c1 = V.K1.confrontations; const c2 = V.K2.confrontations; // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : lecture seule des vues de référence gelées
  const miennes = K2.attentes.filter((a) => a.references.idDesignation === E.id);
  for (const a of miennes) {
    const deux = c2.filter((c) => c.identite[0] === a.id);
    assert.equal(deux.length, 2);
    assert.notEqual(deux[0].identite[1], deux[1].identite[1]);
    assert.deepEqual(deux[0].avant, deux[1].avant);
    assert.deepEqual(deux.map((c) => c.apres.domaine), [a.description.structure, a.description.structure]);
  }
  const arrivee = c2.filter((c) => miennes.some((a) => a.id === c.identite[0] && a.preuve.fondation) && c.avant.chemin.join('.') === 'valeurs.arrivee');
  assert.deepEqual(arrivee.map((c) => `${c.apres.constat.valeur}:${statutDerive(c)}`).sort(), ['77:realisee', '99:autre']);
  for (const c of c1) assert.ok(c2.some((d) => k(d) === k(c)), 'K1 inchangée à K2');
  const nouvellesSurAnciennes = c2.filter((c) => K1.attentes.some((a) => a.id === c.identite[0]) && !c1.some((d) => k(d) === k(c)));
  assert.deepEqual(nouvellesSurAnciennes.map((c) => c.identite[0]).sort(), miennes.map((a) => a.id).sort(), 'sur les attentes existantes, la deuxième réponse ajoute exactement une confrontation par attente de l’acte, et ne réécrit rien');
  assert.throws(() => ancienne(K2), /2 exécutions portent la désignation/, 'témoin de l’ancienne limite');
});

test('B2. IDENTITÉ : ne dépend que de [attente.id, conséquence.id] — stable entre recalculs ; inchangée si l’occurrence (horodatage, idObservation) ou la preuve changent ; conséquences réelles ET synthétiques (réception, variation)', async () => {
  const { K2 } = await mondeDecision();
  const r = vue(K2); assert.deepEqual(vue(K2), r);
  const autres = K2.attentes.map((a) => ({ ...a, horodatage: 'x', idObservation: 'y' }));
  assert.deepEqual(vue(K2, autres), r);
  const sortes = new Set(r.confrontations.map((c) => K2.v.executions.find((x) => x.id === c.identite[1]).operation.split(':')[0]));
  assert.ok(sortes.has('environnement') && sortes.has('soi'), [...sortes].join(','));
  assert.ok([...sortes].some((s) => !['environnement', 'soi'].includes(s)), 'exécutions réelles du catalogue');
});

test('B3. ORDRE SANS SIGNIFICATION : attentes, contextes, exécutions et valeurs permutés → même ensemble de confrontations, même contenu ; même liste sansConsequence (ensemble)', async () => {
  const { K2 } = await mondeDecision();
  const r = (await vuesDecision()).K2; // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : référence gelée ; la permutation `inv` reste un appel réel
  const inv = confrontationsDAttentes([...K2.attentes].reverse(), [...K2.contextes].reverse(), [...K2.v.valeurs].reverse(), [...K2.v.executions].reverse(), K2.v.descriptions);
  assert.deepEqual(ensemble(inv.confrontations), ensemble(r.confrontations));
  assert.deepEqual([...inv.sansConsequence].sort(), [...r.sansConsequence].sort());
});

test('B4. PREUVE ABSENTE ET SANS EFFET : permuter les preuves entre attentes de même sorte ne change aucune confrontation ; la preuve reste lisible dans la ligne (identite[0])', async () => {
  const { K2 } = await mondeDecision();
  const r = (await vuesDecision()).K2; // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : référence gelée ; la vue aux preuves permutées reste un appel réel
  const perm = (xs) => xs.map((a, i) => ({ ...a, preuve: xs[(i + 1) % xs.length].preuve }));
  const u = K2.attentes.filter((a) => !a.preuve.fondation); const c = K2.attentes.filter((a) => a.preuve.fondation);
  assert.deepEqual(ensemble(vue(K2, [...perm(u), ...perm(c)]).confrontations), ensemble(r.confrontations));
  for (const x of r.confrontations) assert.ok(K2.attentes.find((a) => a.id === x.identite[0]).preuve);
  assert.equal(/temoinsContexte|unitesIssues|fondation/.test(JSON.stringify(r.confrontations)), false);
});

// ================================================================================================ C. ANCIENNE VUE, PREMIÈRE EXPÉRIENCE
test('C1. COMPARAISON (vécu sans double réponse, K1) : chaque expérience ancienne ↔ UNE confrontation [id, idExecution] ; même avant, même réel, même statut dérivé ; mêmes attentes sans issue', async () => {
  const { K1 } = await mondeDecision();
  const { experiences, sansIssue } = ancienne(K1);
  const { confrontations, sansConsequence } = (await vuesDecision()).K1; // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : lecture seule de la vue de référence gelée
  assert.equal(confrontations.length, experiences.length);
  assert.deepEqual([...sansConsequence].sort(), [...sansIssue].sort());
  for (const e of experiences) {
    const c = confrontations.find((x) => k(x.identite) === k([e.id, e.idExecution]));
    assert.ok(c, e.id);
    assert.deepEqual(c.avant, e.avant.description);
    assert.deepEqual(c.apres.constat, e.apres.reel);
    assert.equal(statutDerive(c), e.apres.statut);
  }
});

test('C2. PREMIÈRE EXPÉRIENCE (angle mort de FORMATION, non corrigé) : la première émission n’a aucune attente, donc sa réponse ne crée aucune confrontation ; une attente existante est confrontée dès sa première conséquence', async () => {
  const w = monde();
  const E1 = await w.message('K9');
  assert.equal((await w.photo()).attentes.filter((a) => a.references.idDesignation === E1.id).length, 0, 'aucune attente sans histoire');
  await w.message('77', E1.id);
  const p = await w.photo();
  assert.equal(vue(p).confrontations.some((c) => p.v.executions.find((x) => x.id === c.identite[1]).idDesignation === E1.id), false);
  const { K1, E } = await mondeDecision();
  assert.ok((await vuesDecision()).K1.confrontations.some((c) => K1.v.executions.find((x) => x.id === c.identite[1]).idDesignation === E.id), 'première conséquence → confrontation'); // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : lecture seule de la vue de référence gelée (le monde neuf `w` ci-dessus reste neuf)
});

test('C3. ERREURS : entrées non tabulaires, contexte absent → TypeError de la vue ; ligne illisible → TypeError de la lecture par rôles ; aucun résultat partiel', async () => {
  const { K1 } = await mondeDecision();
  refuse(() => confrontationsDAttentes(null, K1.contextes, K1.v.valeurs, K1.v.executions, K1.v.descriptions));
  refuse(() => confrontationsDAttentes(K1.attentes, {}, K1.v.valeurs, K1.v.executions, K1.v.descriptions));
  refuse(() => confrontationsDAttentes(K1.attentes, [], K1.v.valeurs, K1.v.executions, K1.v.descriptions));
  refuse(() => confrontationsDAttentes([{ ...K1.attentes[0], source: 'x' }], K1.contextes, K1.v.valeurs, K1.v.executions, K1.v.descriptions), /^rolesDeLAttente : /);
});

// ================================================================================================ D. SONDES (aucune règle de décision)
test('D1. SONDE ÉLÉMENTS : { chemin: identite, contenu } est formable sans identité nouvelle (identités composites acceptées) ; contenu A = { avant, apres } — aucune valeur de preuve ni de référence n’y devient un constat', async () => {
  const { K2 } = await mondeDecision();
  const { confrontations } = (await vuesDecision()).K2; // MISE À JOUR DÉLIBÉRÉE — optimisation de l’outillage de tests, non cognitive (chantier GO ChatGPT 16/10/2026) : lecture seule de la vue de référence gelée
  assert.doesNotThrow(() => normaliserCouverture(confrontations.map((c) => c.identite)));
  const cpc = constatsParChemin(confrontations.map((c) => ({ chemin: c.identite, contenu: { avant: c.avant, apres: c.apres } })));
  assert.equal(cpc.universelle.length, confrontations.length);
  // aucune position de preuve ni de référence n'apparaît parmi les chemins observés ; et le contenu d'une confrontation ne contient ni sa propre
  // identité, ni les références ou l'occurrence de son attente. (Une attente PORTANT sur une identité passée — chemin « arrivee » — engage une
  // valeur d'identité : c'est du contenu attendu, pas une référence de raccord ; voir le rapport .64.7.)
  assert.equal(cpc.chemins.some((c) => c.chemin.some((s) => ['preuve', 'temoinsContexte', 'unitesIssues', 'fondation', 'references', 'idContexte', 'idDesignation', 'idObservation', 'horodatage', 'identite'].includes(s))), false);
  for (const c of confrontations) {
    const a = K2.attentes.find((x) => x.id === c.identite[0]);
    const propres = new Set([c.identite[0], a.idObservation, a.references.idContexte, a.references.idDesignation]);
    for (const o of parcourirStructure({ avant: c.avant, apres: c.apres })) assert.equal(o.type === 'chaine' && propres.has(o.valeur), false, o.valeur);
    // l'identité de la conséquence n'apparaît, au plus, que comme CONSTAT RÉEL d'un chemin d'identité (ex. « arrivee » d'un épisode soi:* : la
    // production de la variation porte l'identité de la variation) — c'est ce qui a été trouvé, jamais une référence ajoutée
    for (const o of parcourirStructure({ avant: c.avant, apres: c.apres })) if (o.type === 'chaine' && o.valeur === c.identite[1]) assert.deepEqual(o.chemin, ['apres', 'constat', 'valeur']);
  }
  // variante B (confrontation entière moins l'identité) : identique à A, car la confrontation ne porte rien d'autre
  assert.deepEqual(confrontations.map(({ identite, ...reste }) => reste), confrontations.map((c) => ({ avant: c.avant, apres: c.apres })));
});

test('D2. SONDE TROIS MONDES (formes v0.64.8) : avant composite (relation) et après décrits sans preuve ni référence ; coCouverturesDeDescriptions inchangée et non branchée', () => {
  const D = [{ operation: 'f', entrees: ['e'] }];
  const R = { domaine: D, connu: { valeurs: { depart: 'K9' } }, attendu: { valeurs: { arrivee: '77' } } };
  const S = { domaine: D, connu: { valeurs: { depart: 'Q4' } }, attendu: { valeurs: { arrivee: '55' } } };
  let n = 0;
  const cf = (rel, reel) => { n += 1; const att = rel === R ? '77' : '55'; return { identite: [`a${n}`, `x${n}`], avant: { structure: D, chemin: ['valeurs', 'arrivee'], constat: { type: 'chaine', valeur: att }, relation: rel }, apres: { domaine: D, chemin: ['valeurs', 'arrivee'], constat: { type: 'chaine', valeur: reel } } }; };
  const classes = (X) => {
    const cpc = constatsParChemin(X.map((c) => ({ chemin: c.identite, contenu: c.apres })));
    const parRel = new Map(); for (const c of X) { const kk = k(c.avant.relation); parRel.set(kk, [...(parRel.get(kk) ?? []), c.identite]); }
    const desc = [...[...parRel].map(([r, ids]) => ({ description: { avant: JSON.parse(r) }, couverture: normaliserCouverture(ids) })), ...cpc.chemins.flatMap((c) => c.constats.filter((q) => Object.hasOwn(q, 'valeur')).map((q) => ({ description: { apres: c.chemin, valeur: q.valeur }, couverture: q.couverture })))];
    return coCouverturesDeDescriptions(desc, cpc.universelle);
  };
  const A = classes([cf(R, '77'), cf(R, '77'), cf(R, '77')]);
  const B = classes([cf(R, '77'), cf(R, '77'), cf(R, '99')]);
  const C = classes([cf(R, '99'), cf(R, '99'), cf(S, '55'), cf(S, '55')]);
  assert.deepEqual(A, [], 'tout est universel : aucune classe');
  assert.ok(B.every((c) => c.descriptions.every((d) => !Object.hasOwn(d, 'avant'))), 'R universelle : aucune classe avec R');
  assert.equal(C.length, 2); assert.ok(C.every((c) => c.descriptions.some((d) => Object.hasOwn(d, 'avant')) && c.descriptions.some((d) => Object.hasOwn(d, 'apres'))));
  for (const c of [...A, ...B, ...C]) assert.equal(/^a\d|^x\d/.test(JSON.stringify(c.descriptions)), false, 'aucune identité dans les descriptions');
  for (const f of fichiersJs(join(RACINE, 'app'))) if (!f.endsWith('co-couvertures-descriptions.js')) assert.equal(/coCouverturesDeDescriptions/.test(readFileSync(f, 'utf8')), false, f);
});

// ================================================================================================ E. DORMANCE
test('E1. DORMANCE : aucun fichier de app/ (choix, initiative, besoin, stratégie, production, émission, observation…) n’importe ni ne nomme la vue ; ni sw.js, ni worker.js, ni index.html ; catalogue et tables inchangés', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    assert.equal(/confrontations-attentes|confrontationsDAttentes/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/confrontations-attentes/.test(s), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); assert.equal(TABLES.length, 35); // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 30 → 31 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.17 : 25 → 26 / 15 → 16 / 31 → 32 (+ table decisionsFormes : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables)
});
