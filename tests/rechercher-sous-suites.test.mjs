// === DEBUT_TEST_RECHERCHER_SOUS_SUITES ===
// v0.63.44 — rechercherSousSuites (B2) : recherche MÉCANIQUE de sous-suites contiguës (décision ChatGPT, 06/10/2026, après le cadrage B2). Preuves : le contrat de
// la fonction pure (égalité typée Object.is, chevauchements, absence conservée, doublons, motif vide, refus) ; le descripteur et la table ; la chaîne réelle
// A + B -> P -> S -> M puis C -> P' -> R avec les mécanismes existants ; la preuve A/A2 (la reconnaissance dépend de la valeur, pas de l'identité) ; le POINT FIXE
// projeterContenus(R) = M (B2 n'est jamais un filtre) ; les ambiguïtés laissées en « choix à faire » ; les compatibilités mesurées ; ce qui n'est PAS touché.
// Les textes ne sont que les DONNÉES du scénario : aucune règle ne les connaît.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { rechercherSousSuites } from '../app/langage/rechercher-sous-suites.js';
import { projeterContenus } from '../app/langage/projeter-contenus.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { verifierApplicationAuCatalogue } from '../app/langage/conformite-application.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites } from '../app/langage/connaissances.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const NOM = 'rechercherSousSuites';
const DESCRIPTION = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === NOM);
const CS = { forme: 'collection', elements: { forme: 'scalaire' } };
const E = (chemin, contenu, extra = {}) => ({ chemin, contenu, ...extra });
const debuts = (motif, contenu) => rechercherSousSuites([motif], [E(['E'], contenu)])[0].occurrences.map((o) => o.debut);

// ============================================================================ A. LA FONCTION PURE
test('A1. contrat : une entrée par motif reçu, dans l\'ordre, avec le motif lui-même (même référence) ; occurrences { element: chemin (même référence), debut } ; champs en plus ignorés', () => {
  const m1 = ['a', 'b'];
  const m2 = ['z'];
  const chemin = ['E'];
  const contenu = ['x', 'a', 'b', 'a', 'b'];
  const r = rechercherSousSuites([m1, m2], [E(chemin, contenu, { couverture: [['Q']], occurrences: [], inconnu: 1 })]);
  assert.equal(r.length, 2);
  assert.equal(r[0].contenu, m1);
  assert.equal(r[1].contenu, m2);
  assert.deepEqual(Object.keys(r[0]).sort(), ['contenu', 'occurrences']);
  assert.deepEqual(r[0].occurrences, [{ element: ['E'], debut: 1 }, { element: ['E'], debut: 3 }]);
  assert.equal(r[0].occurrences[0].element, chemin);
  assert.deepEqual(Object.keys(r[0].occurrences[0]).sort(), ['debut', 'element']); // pas de `parent`
  assert.deepEqual(r[1], { contenu: ['z'], occurrences: [] });
  assert.equal(rechercherSousSuites.length, 2);
});
test('A2. CHEVAUCHEMENTS comptés ; occurrences multiples toutes conservées ; motif plus long ou absent : aucune occurrence, jamais d\'erreur', () => {
  assert.deepEqual(debuts(['a', 'a'], ['a', 'a', 'a']), [0, 1]);
  assert.deepEqual(debuts(['a', 'b', 'a'], ['a', 'b', 'a', 'b', 'a']), [0, 2]);
  assert.deepEqual(debuts(['o'], [...'bonjour Pixel']), [1, 4]);
  assert.deepEqual(debuts(['a', 'b', 'c'], ['a', 'b']), []);
  assert.deepEqual(debuts(['z'], ['a', 'b']), []);
  assert.deepEqual(debuts(['a'], []), []);
  assert.deepEqual(debuts(['a', 'b'], ['a', 'x', 'b']), []); // contiguïté : jamais une sous-suite non contiguë
});
test('A3. ÉGALITÉ : même type ET Object.is — 7 ≠ "7", true ≠ "true", 0 ≠ -0, NaN = NaN ; les listes se comparent terme à terme, jamais concaténées', () => {
  assert.deepEqual(debuts([1], ['1', 1]), [1]);
  assert.deepEqual(debuts(['1'], ['1', 1]), [0]);
  assert.deepEqual(debuts([true], ['true', true, 1]), [1]);
  assert.deepEqual(debuts([0], [-0, 0]), [1]);
  assert.deepEqual(debuts([-0], [-0, 0]), [0]);
  assert.deepEqual(debuts([NaN], [NaN, 1]), [0]);
  assert.deepEqual(debuts(['a', 'bc'], ['ab', 'c']), []);
  assert.deepEqual(debuts(['ab', 'c'], ['ab', 'c']), [0]);
  assert.deepEqual(debuts(['ab'], ['a', 'b']), []);
});
test('A4. ABSENCE CONSTATÉE : un motif absent produit quand même son entrée (occurrences: []) ; motifs dupliqués conservés ; aucun motif -> aucune entrée', () => {
  const r = rechercherSousSuites([['a'], ['q'], ['a'], ['q']], [E(['E'], ['a', 'b'])]);
  assert.deepEqual(r.map((x) => x.occurrences.length), [1, 0, 1, 0]);
  assert.deepEqual(r[0], r[2]);
  assert.deepEqual(r[1], r[3]);
  assert.deepEqual(rechercherSousSuites([], [E(['E'], ['a'])]), []);
  assert.deepEqual(rechercherSousSuites([['a']], []), [{ contenu: ['a'], occurrences: [] }]);
});
test('A5. MOTIF VIDE : définition uniforme — une occurrence à chaque position 0..n (n + 1), position 0 dans un contenu vide ; accepté sans cas particulier', () => {
  assert.deepEqual(debuts([], ['a', 'b', 'c']), [0, 1, 2, 3]);
  assert.deepEqual(debuts([], []), [0]);
  assert.equal(debuts([], [...'bonjour Pixel']).length, 14);
  const r = rechercherSousSuites([[], ['a']], [E(['E'], ['a']), E(['F'], [])]);
  assert.deepEqual(r[0].occurrences, [{ element: ['E'], debut: 0 }, { element: ['E'], debut: 1 }, { element: ['F'], debut: 0 }]);
  assert.deepEqual(r[1].occurrences, [{ element: ['E'], debut: 0 }]);
});
test('A6. ÉLÉMENTS : traités indépendamment selon leur `chemin` (même contenu, deux entrées) ; ordre des éléments reçu puis débuts croissants ; aucune unicité de chemin exigée', () => {
  const r = rechercherSousSuites([['a']], [E(['Y'], ['a', 'a']), E(['X'], ['a']), E(['Y'], ['a'])]);
  assert.deepEqual(r[0].occurrences, [
    { element: ['Y'], debut: 0 }, { element: ['Y'], debut: 1 }, { element: ['X'], debut: 0 }, { element: ['Y'], debut: 0 },
  ]);
  const memeContenu = rechercherSousSuites([['a', 'b']], [E(['P'], ['a', 'b']), E(['Q'], ['a', 'b'])])[0].occurrences;
  assert.deepEqual(memeContenu, [{ element: ['P'], debut: 0 }, { element: ['Q'], debut: 0 }]);
});
test('A7. NI TRI NI FILTRE : l\'ordre des motifs est celui reçu ; inverser les motifs donne les mêmes entrées par contenu ; entrée jamais modifiée', () => {
  const motifs = [['c'], ['a', 'b'], ['b'], []];
  const elements = [E(['E'], ['a', 'b', 'c'])];
  const avant = JSON.stringify([motifs, elements]);
  const r = rechercherSousSuites(motifs, elements);
  assert.equal(JSON.stringify([motifs, elements]), avant);
  assert.deepEqual(r.map((x) => x.contenu), motifs);
  const inverse = rechercherSousSuites([...motifs].reverse(), elements);
  assert.deepEqual([...inverse].reverse(), r);
});
test('A8. la fonction ne lit NI couverture NI occurrences NI un champ en plus : des accesseurs sur ces champs ne sont jamais exécutés', () => {
  let lus = 0;
  const element = { chemin: ['E'], contenu: ['a'] };
  for (const cle of ['couverture', 'occurrences', 'parent', 'autre']) Object.defineProperty(element, cle, { enumerable: true, get() { lus += 1; return []; } });
  assert.deepEqual(rechercherSousSuites([['a']], [element]), [{ contenu: ['a'], occurrences: [{ element: ['E'], debut: 0 }] }]);
  assert.equal(lus, 0);
});
test('A9. refus (TypeError, aucun résultat partiel, AVANT tout calcul) : entrées non tableaux, creux, accesseurs, motif non collection ou à scalaire non primitif (null refusé), élément non objet, chemin / contenu absent, hérité, accesseur ou non collection', () => {
  const refus = (motifs, elements) => assert.throws(() => rechercherSousSuites(motifs, elements), TypeError);
  const ok = [E(['E'], ['a'])];
  for (const v of [undefined, null, 'abc', 5, {}]) { refus(v, ok); refus([['a']], v); }
  refus(new Array(2), ok);
  refus([['a']], new Array(1));
  const accMotifs = [['a']];
  Object.defineProperty(accMotifs, 0, { get() { throw new Error('exécuté'); }, enumerable: true });
  refus(accMotifs, ok);
  const accElements = [E(['E'], ['a'])];
  Object.defineProperty(accElements, 0, { get() { throw new Error('exécuté'); }, enumerable: true });
  refus([['a']], accElements);
  for (const m of [null, undefined, 'a', 3, {}, { length: 1, 0: 'a' }, new Array(2)]) refus([m], ok);
  for (const s of [null, undefined, {}, ['a'], () => 1, Symbol('x')]) { refus([['a', s]], ok); refus([['a']], [E(['E'], ['a', s])]); refus([['a']], [E(['E', s], ['a'])]); }
  for (const e of [null, undefined, 'x', 3, [], [E(['E'], ['a'])]]) refus([['a']], [e]);
  refus([['a']], [{ contenu: ['a'] }]);
  refus([['a']], [{ chemin: ['E'] }]);
  refus([['a']], [Object.create({ chemin: ['E'], contenu: ['a'] })]);
  for (const c of [null, 'abc', 4, {}]) { refus([['a']], [{ chemin: c, contenu: ['a'] }]); refus([['a']], [{ chemin: ['E'], contenu: c }]); }
  for (const cle of ['chemin', 'contenu']) {
    const acc = { chemin: ['E'], contenu: ['a'] };
    Object.defineProperty(acc, cle, { get() { throw new Error('exécuté'); }, enumerable: true });
    refus([['a']], [acc]);
  }
  refus([['a']], [E(['E'], ['a']), { chemin: ['F'], contenu: 'invalide en second' }]); // rien n'est rendu
});

// ============================================================================ B. CATALOGUE ET TABLE
test('B1. descripteur EXACT : deux entrées ordinaires `motifs` et `elements`, sans genre ; sortie { contenu, occurrences : [{ element, debut (nombre) }] } ; aucune entrée collective, aucun `parent`', () => {
  assert.deepEqual(DESCRIPTION, {
    nom: NOM,
    entrees: {
      motifs: { forme: 'collection', elements: CS },
      elements: { forme: 'collection', elements: { forme: 'objet', champs: { chemin: CS, contenu: CS } } },
    },
    sortie: { forme: 'collection', elements: { forme: 'objet', champs: {
      contenu: CS,
      occurrences: { forme: 'collection', elements: { forme: 'objet', champs: { element: CS, debut: { forme: 'scalaire', genre: 'nombre' } } } },
    } } },
  });
  const texte = JSON.stringify(DESCRIPTION);
  assert.equal(texte.includes('collectif'), false);
  assert.equal(texte.includes('parent'), false);
  assert.equal(texte.includes('chaine'), false);
  assert.doesNotThrow(() => valider(DESCRIPTION));
});
test('B2. table : appel positionnel, paramètres « motifs » puis « elements », la fonction réelle ; catalogue et table comptent QUATORZE entrées au même ordre ; après projeterContenus, avant resoudreCouverture', () => {
  assert.deepEqual({ appel: TABLE_OPERATIONS[NOM].appel, parametres: [...TABLE_OPERATIONS[NOM].parametres] }, { appel: 'positionnel', parametres: ['motifs', 'elements'] });
  assert.equal(TABLE_OPERATIONS[NOM].fonction, rechercherSousSuites);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 14);
  assert.deepEqual(Object.keys(TABLE_OPERATIONS), DESCRIPTIONS_OPERATIONS.map((d) => d.nom));
  const noms = DESCRIPTIONS_OPERATIONS.map((d) => d.nom);
  assert.equal(noms[noms.indexOf(NOM) - 1], 'projeterContenus');
  assert.equal(noms[noms.indexOf(NOM) + 1], 'resoudreCouverture');
});
test('B3. COMPATIBILITÉS MESURÉES : producteurs de `motifs` = projeterContenus et normaliserCouverture ; producteurs de `elements` = elementsObservables seul ; consommateurs de la sortie R = trois entrées, jamais B2, produireSuitesFermees, elementsObservables ni produireConstatsStructurels', () => {
  const d = valider(DESCRIPTION);
  const qui = (entree) => DESCRIPTIONS_OPERATIONS.filter((x) => fournieGarantitAttendue(valider(x).sortie, d.entrees[entree])).map((x) => x.nom).sort();
  assert.deepEqual(qui('motifs'), ['normaliserCouverture', 'projeterContenus']);
  assert.deepEqual(qui('elements'), ['elementsObservables']);
  const consommateurs = [];
  for (const x of DESCRIPTIONS_OPERATIONS) for (const [entree, forme] of Object.entries(valider(x).entrees)) if (fournieGarantitAttendue(d.sortie, forme)) consommateurs.push(`${x.nom}.${entree}`);
  assert.deepEqual(consommateurs.sort(), ['couvrirSequence.elements', 'parcourirStructure.valeur', 'projeterContenus.elements']);
  for (const [op, e] of [[NOM, 'motifs'], [NOM, 'elements'], ['produireSuitesFermees', 'elements'], ['elementsObservables', 'elements'], ['produireConstatsStructurels', 'elements']]) {
    assert.equal(fournieGarantitAttendue(d.sortie, valider(DESCRIPTIONS_OPERATIONS.find((x) => x.nom === op)).entrees[e]), false, `${op}.${e}`);
  }
});

// ============================================================================ C. LA CHAÎNE RÉELLE
async function tour(magasin, texte, n) {
  let k = n * 100;
  const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
  const r = await observerPossibilites(message, {
    enregistrer: (d) => enregistrerObservationPossibilites(magasin, d),
    lireExecutions: () => magasin.lireTout('executionsOperations'),
  });
  assert.equal(r.statut, 'ecrite');
  return { message, observation: r.observation, univers: r.univers };
}
const executer = (t, application, magasin) => executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
const appDe = (t, operation) => applicationsSollicitables(t.observation).applications.find((a) => a.operation === operation);
let compteur = 0;
async function etape(w, operation, liaisons) {
  const t = await tour(w.magasin, `tour ${++compteur}`, 10 + compteur);
  const r = liaisons ? await executer(t, { operation, liaisons }, w.magasin) : await executer(t, appDe(t, operation), w.magasin);
  assert.equal(r.statut, 'executee', `${operation} : ${r.erreur && r.erreur.message}`);
  return r;
}
async function chaine() {
  const w = { magasin: magasinMemoireVive() };
  const t1 = await tour(w.magasin, 'bonjour Pixel', 1);
  w.rA = await executer(t1, appDe(t1, 'symbolesDeChaine'), w.magasin);
  const t2 = await tour(w.magasin, 'salut Pixel', 2);
  w.rB = await executer(t2, appDe(t2, 'symbolesDeChaine'), w.magasin);
  w.rP = await etape(w, 'elementsObservables');
  w.rS = await etape(w, 'produireSuitesFermees');
  w.rM = await etape(w, 'projeterContenus', [{ entree: 'elements', donnee: w.rS.execution.id }]);
  const t3 = await tour(w.magasin, 'bonsoir Pixel', 30);
  w.rC = await executer(t3, appDe(t3, 'symbolesDeChaine'), w.magasin);
  w.rPp = await etape(w, 'elementsObservables');
  Object.assign(w, { idA: w.rA.execution.id, idB: w.rB.execution.id, idC: w.rC.execution.id, idP: w.rP.execution.id, idS: w.rS.execution.id, idM: w.rM.execution.id, idPp: w.rPp.execution.id });
  return w;
}
const liste = (texte) => symbolesDeChaine(texte);
const lier = (idM, idE) => [{ entree: 'motifs', donnee: idM }, { entree: 'elements', donnee: idE }];
const parElement = (r, w) => {
  const noms = new Map([[w.idA, 'A'], [w.idB, 'B'], [w.idC, 'C'], [w.idA2, 'A2']]);
  return r.map((m) => {
    const o = {};
    for (const x of m.occurrences) { assert.equal(x.element.length, 1); (o[noms.get(x.element[0])] ??= []).push(x.debut); }
    return o;
  });
};

test('C1. ÉTAT DE DÉPART : M = les six listes ; la situation P\' contient A, B et C (chemins = identités des trois productions)', async () => {
  const w = await chaine();
  assert.deepEqual(w.rM.execution.resultat, [liste('bonjour Pixel'), liste('o'), liste('u'), liste(' Pixel'), liste('l'), liste('salut Pixel')]);
  assert.deepEqual(w.rPp.execution.resultat.map((e) => e.chemin), [[w.idA], [w.idB], [w.idC]]);
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 7); // A, B, P, S, M, C, P'
});
test('C2. ambiguïtés : P et P\' candidats de `elements` -> « choix à faire », aucune application déterminée, aucune sélection automatique ; `motifs` n\'a que M', async () => {
  const w = await chaine();
  const t = await tour(w.magasin, 'observation', 60);
  const candidats = (entree) => t.observation.possibilites.filter((p) => p.operation === NOM && p.entree === entree).map((p) => p.donnee).sort();
  assert.deepEqual(candidats('elements'), [w.idP, w.idPp].sort());
  assert.deepEqual(candidats('motifs'), [w.idM]);
  const { applications, choixAFaire } = applicationsSollicitables(t.observation);
  assert.equal(applications.some((a) => a.operation === NOM), false);
  assert.equal(choixAFaire.includes(NOM), true);
  const g = groupesDeCandidats(t.observation.possibilites, DESCRIPTIONS_OPERATIONS).find((x) => x.operation === NOM);
  assert.deepEqual(g.entrees.map((e) => [e.entree, [...e.donnees].sort()]).sort(), [['elements', [w.idP, w.idPp].sort()], ['motifs', [w.idM]]]);
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 7); // rien n'a été exécuté en plus
});
test('C3. RÉSULTAT EXACT de rechercherSousSuites(M, P\') : les SIX motifs conservés, dans l\'ordre de M, avec leurs occurrences dans A, B et C (listes, jamais chaînes)', async () => {
  const w = await chaine();
  const r = await etape(w, NOM, lier(w.idM, w.idPp));
  const R = r.execution.resultat;
  assert.equal(R.length, 6);
  assert.deepEqual(R.map((m) => m.contenu), w.rM.execution.resultat);
  assert.deepEqual(parElement(R, w), [
    { A: [0] },
    { A: [1, 4], C: [1, 4] },
    { A: [5], B: [3] },
    { A: [7], B: [5], C: [7] },
    { A: [12], B: [2, 10], C: [12] },
    { B: [0] },
  ]);
  assert.deepEqual(R, rechercherSousSuites(w.rM.execution.resultat, w.rPp.execution.resultat)); // identique à l'appel direct
  for (const m of R) assert.equal(Array.isArray(m.contenu), true);
  assert.deepEqual(R[3].contenu, [' ', 'P', 'i', 'x', 'e', 'l']);
  assert.equal(R.filter((m) => m.occurrences.some((o) => o.element[0] === w.idC)).length, 3); // « o », « Pixel », « l » : les trois autres sont absents de C
});
test('C4. PREUVE A / A2 : une nouvelle production A2, de contenu identique à A mais d\'identité différente, est reconnue aux MÊMES positions ; A et A2 restent deux éléments distincts', async () => {
  const w = await chaine();
  const tA2 = await tour(w.magasin, 'bonjour Pixel', 40);
  const rA2 = await executer(tA2, appDe(tA2, 'symbolesDeChaine'), w.magasin);
  assert.equal(rA2.statut, 'executee');
  w.idA2 = rA2.execution.id;
  assert.notEqual(w.idA2, w.idA);
  assert.deepEqual(rA2.execution.resultat, w.rA.execution.resultat);
  const rP2 = await etape(w, 'elementsObservables');
  assert.deepEqual(rP2.execution.resultat.map((e) => e.chemin), [[w.idA], [w.idB], [w.idC], [w.idA2]]);
  const r = await etape(w, NOM, lier(w.idM, rP2.execution.id));
  const par = parElement(r.execution.resultat, w);
  assert.deepEqual(par.map((o) => o.A), [[0], [1, 4], [5], [7], [12], undefined]);
  assert.deepEqual(par.map((o) => o.A2), par.map((o) => o.A));
  assert.equal(par.every((o, i) => (o.A === undefined) === (o.A2 === undefined)), true);
  for (const m of r.execution.resultat) for (const x of m.occurrences) assert.equal([w.idA, w.idB, w.idC, w.idA2].includes(x.element[0]), true);
  assert.equal(r.execution.resultat.some((m) => m.occurrences.some((x) => x.element[0] === w.idA2)), true);
});
test('C5. POINT FIXE : projeterContenus(R) = M — valeur et ordre — avec la chaîne réelle ; B2 ne filtre jamais (motifs absents conservés)', async () => {
  const w = await chaine();
  const r = await etape(w, NOM, lier(w.idM, w.idPp));
  assert.deepEqual(projeterContenus(r.execution.resultat), w.rM.execution.resultat);
  const rB1 = await etape(w, 'projeterContenus', [{ entree: 'elements', donnee: r.execution.id }]); // B1 sur R, par les mécanismes réels
  assert.deepEqual(rB1.execution.resultat, w.rM.execution.resultat);
  assert.equal(r.execution.resultat.filter((m) => m.occurrences.length === 0).length, 0); // dans P' (qui contient A et B) chaque motif de M est trouvé : voir l'absence ci-dessous
  const seulC = rechercherSousSuites(w.rM.execution.resultat, w.rPp.execution.resultat.filter((e) => e.chemin[0] === w.idC));
  assert.equal(seulC.filter((m) => m.occurrences.length === 0).length, 3); // restreinte à C par un appel direct : trois motifs absents, conservés
  assert.deepEqual(projeterContenus(seulC), w.rM.execution.resultat);
});
test('C6. POINT FIXE sur des cas limites : doublons, motif vide, absents ; projeterContenus ∘ rechercherSousSuites = identité sur les motifs, quels que soient les éléments', () => {
  const motifs = [['a'], [], ['a'], ['z', 'z'], ['b', 'a'], []];
  for (const elements of [[], [E(['E'], [])], [E(['E'], ['a', 'b', 'a'])], [E(['E'], ['a']), E(['F'], ['a']), E(['G'], ['q'])]]) {
    assert.deepEqual(projeterContenus(rechercherSousSuites(motifs, elements)), motifs);
    assert.equal(rechercherSousSuites(motifs, elements).length, motifs.length);
  }
});
test('C7. PROVENANCE : production ordinaire ; liaisons { motifs: idM, elements: idP\' } ; la valeur de R ne contient aucune identité de condition (le motif) ; les chemins des éléments sont ceux de la situation ; R -> M -> S -> P -> A, B et R -> P\' -> A, B, C restent remontables', async () => {
  const w = await chaine();
  const r = await etape(w, NOM, lier(w.idM, w.idPp));
  const lignes = await w.magasin.lireTout('executionsOperations');
  assert.equal(lignes.length, 8);
  const ligne = lignes.find((l) => l.id === r.execution.id);
  assert.deepEqual(Object.keys(ligne).sort(), ['horodatage', 'id', 'idDesignation', 'liaisons', 'operation', 'resultat']);
  assert.equal(ligne.operation, NOM);
  assert.deepEqual(ligne.liaisons, [{ entree: 'elements', donnee: w.idPp }, { entree: 'motifs', donnee: w.idM }]); // persistées dans l'ordre des NOMS d'entrée (convention de la désignation), pas dans l'ordre de l'appel
  assert.deepEqual(ligne.resultat, r.execution.resultat);
  const designation = (await w.magasin.lireTout('designations')).find((d) => d.id === ligne.idDesignation);
  assert.equal(designation.origine, 'exterieure');
  assert.deepEqual(designation.liaisons, ligne.liaisons);
  assert.deepEqual(JSON.parse(JSON.stringify(ligne.resultat)), ligne.resultat);
  for (const m of r.execution.resultat) assert.equal(/execution-operation|message-/.test(JSON.stringify(m.contenu)), false); // les motifs restent purs
  const parId = new Map(lignes.map((l) => [l.id, l]));
  assert.deepEqual(parId.get(w.idM).liaisons, [{ entree: 'elements', donnee: w.idS }]);
  assert.deepEqual(parId.get(w.idS).liaisons, [{ entree: 'elements', donnee: w.idP }]);
  assert.deepEqual(parId.get(w.idP).liaisons, [{ entree: 'elements', donnees: [w.idA, w.idB] }]);
  assert.deepEqual(parId.get(w.idPp).liaisons, [{ entree: 'elements', donnees: [w.idA, w.idB, w.idC] }]);
});
test('C8. TOUR SUIVANT après R : les possibilités portant R sont exactement trois ; R n\'est candidate ni de B2, ni de produireSuitesFermees, ni d\'elementsObservables ; plusieurs M ou plusieurs situations restent un « choix à faire »', async () => {
  const w = await chaine();
  const r = await etape(w, NOM, lier(w.idM, w.idPp));
  const t = await tour(w.magasin, 'après R', 70);
  assert.deepEqual(t.observation.possibilites.filter((p) => p.donnee === r.execution.id).map((p) => `${p.operation}.${p.entree}`).sort(), ['couvrirSequence.elements', 'parcourirStructure.valeur', 'projeterContenus.elements']);
  const candidatsMotifs = t.observation.possibilites.filter((p) => p.operation === NOM && p.entree === 'motifs').map((p) => p.donnee);
  assert.deepEqual(candidatsMotifs, [w.idM]);
  // un second M (même valeur, autre production) : `motifs` devient ambiguë, jamais résolue
  const m2 = await etape(w, 'projeterContenus', [{ entree: 'elements', donnee: w.idS }]);
  const t2 = await tour(w.magasin, 'après M2', 71);
  assert.deepEqual(t2.observation.possibilites.filter((p) => p.operation === NOM && p.entree === 'motifs').map((p) => p.donnee).sort(), [w.idM, m2.execution.id].sort());
  const { applications, choixAFaire } = applicationsSollicitables(t2.observation);
  assert.equal(applications.some((a) => a.operation === NOM), false);
  assert.equal(choixAFaire.includes(NOM), true);
  for (const a of applications) assert.equal(verifierApplicationAuCatalogue(a, DESCRIPTIONS_OPERATIONS), true);
  // une liaison qui lie `elements` à autre chose que sa forme est refusée par le catalogue réel (aucune confusion M / P')
  assert.equal((await executer(t2, { operation: NOM, liaisons: lier(w.idPp, w.idM) }, w.magasin)).statut !== 'executee', true);
});

// ============================================================================ D. CE QUI N'EST PAS TOUCHÉ
function fichiers(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules' || nom === '.git') continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, sortie); else sortie.push(chemin);
  }
  return sortie;
}
test('D1. NON TOUCHÉS : projeter-contenus.js, suites-fermees.js, elements-observables.js ; la fonction n\'importe rien, ne trie ni ne filtre ni ne concatène ; seuls catalogue, table et module la nomment (hors tests)', () => {
  const code = (f) => readFileSync(join(RACINE, 'app', 'langage', f), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/^\s*import\b/m.test(code('rechercher-sous-suites.js')), false);
  assert.equal(/descriptions-operations|table-operations|DESCRIPTIONS_OPERATIONS|TABLE_OPERATIONS|couverture|\.sort\(|\.filter\(|\.slice\(|\.concat\(|\.join\(|JSON\.|String\(|\.push\(\.\.\./.test(code('rechercher-sous-suites.js')), false);
  assert.equal(/rechercherSousSuites|rechercher-sous-suites/.test(code('projeter-contenus.js') + code('suites-fermees.js') + code('elements-observables.js')), false);
  // MISE À JOUR DÉLIBÉRÉE v0.63.44 (refus du robot) : ETAT.md est le journal écrit par le robot, qui cite les noms des livraisons passées ; ce n'est pas du code. Seul ce fichier est exclu du balayage.
  const nommant = fichiers(RACINE).filter((f) => !f.includes(`${join(RACINE, 'tests')}`) && !f.endsWith('.zip') && !f.endsWith(join(RACINE, 'ETAT.md')) && /rechercherSousSuites|rechercher-sous-suites/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(nommant.map((f) => f.slice(RACINE.length + 1)).sort(), ['app/langage/descriptions-operations.js', 'app/langage/rechercher-sous-suites.js', 'app/langage/table-operations.js'].sort());
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => /ConstatsValeurs/.test(d.nom)), false);
});
test('D2. dormance : aucun chemin actif n\'atteint rechercherSousSuites (ni main.js, ni le pont, ni l\'interface, ni sw/worker/index) ; le code de la fonction ne contient aucune notion de condition, connaissance, importance, apprentissage ou suite fermée', () => {
  for (const f of [['app', 'main.js'], ['app', 'langage', 'pont.js'], ['app', 'langage', 'ecran.js'], ['index.html'], ['sw.js'], ['worker.js']]) {
    assert.equal(/rechercherSousSuites|rechercher-sous-suites/.test(readFileSync(join(RACINE, ...f), 'utf8')), false, f.join('/'));
  }
  const code = readFileSync(join(RACINE, 'app', 'langage', 'rechercher-sous-suites.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/condition|connaissance|importance|apprentissage|fermee|motif linguistique/i.test(code), false);
});
// === FIN_TEST_RECHERCHER_SOUS_SUITES ===
