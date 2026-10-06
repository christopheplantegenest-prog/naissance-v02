// === DEBUT_TEST_RESOUDRE_ELEMENTS ===
// v0.63.47 — SÉLECTION D'ÉLÉMENTS IDENTIFIÉS EN CONSERVANT LEUR FORME (décision ChatGPT, 06/10/2026, après le diagnostic « cadrage de R ∩ N »).
// Preuves : le contrat de la fonction (égalité des chemins typés, ordre canonique de la couverture, références ORIGINALES, erreurs sans résultat partiel,
// couverture vide, éléments de contenu identique distincts) ; le catalogue et la table ; le chaînage mesuré ; la chaîne réelle A,B -> P -> S -> M ; C -> P' ;
// H, H', Q -> N = sous-donnée Q.seulementA ; E = resoudreElements(P', N) ; rechercherSousSuites(M, E) (cas C, cas A2, cas multi) ; « choix à faire » ;
// ce qui n'est PAS touché (aucun filtre d'occurrences, aucun champ spécial, aucune sous-donnée α2 pour une sortie collection).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { resoudreElements } from '../app/langage/resoudre-elements.js';
import { resoudreCouverture } from '../app/langage/resolution-couverture.js';
import { normaliserCouverture, memesCouvertures } from '../app/langage/couverture-occurrences.js';
import { rechercherSousSuites } from '../app/langage/rechercher-sous-suites.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { invoquerOperation } from '../app/langage/invocation-operations.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { sousDonneesDeclarees } from '../app/langage/sous-donnees.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const NOM = 'resoudreElements';
const DESCRIPTION = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === NOM);
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const CODE = sansCommentaires(lu('app', 'langage', 'resoudre-elements.js'));
const E = (chemin, contenu) => ({ chemin, contenu });
const refuse = (f) => assert.throws(f, TypeError);

// ============================================================================ A. LE CONTRAT DE LA FONCTION
test('A1. les éléments dont le chemin appartient à la couverture, dans l\'ordre CANONIQUE de la couverture (pas celui de `elements`, pas celui de la couverture donnée)', () => {
  const a = E(['a'], ['x']); const b = E(['b', 1], ['y']); const c = E(['c'], ['z']);
  const r = resoudreElements([c, b, a], [['b', 1], ['a']]);
  assert.deepEqual(r, [a, b]);
  assert.deepEqual(r, resoudreElements([a, b, c], [['a'], ['b', 1]]), 'même sortie quel que soit l\'ordre de elements et de la couverture');
  assert.deepEqual(r.map((x) => x.chemin), normaliserCouverture([['b', 1], ['a']]));
});
test('A2. RÉFÉRENCES : les éléments retournés sont les ORIGINAUX (objet, chemin et contenu : aucune copie) ; le tableau retourné est neuf ; les entrées ne sont pas modifiées', () => {
  const a = E(['a'], ['x', 1]); const b = E(['b'], []); const elements = [a, b]; const couverture = [['b'], ['a']];
  const avant = JSON.stringify([elements, couverture]);
  const r = resoudreElements(elements, couverture);
  assert.equal(r.length, 2);
  assert.equal(r[0], a); assert.equal(r[1], b);
  assert.equal(r[0].chemin, a.chemin); assert.equal(r[0].contenu, a.contenu);
  assert.equal(r[1].chemin, b.chemin); assert.equal(r[1].contenu, b.contenu);
  assert.notEqual(r, elements);
  assert.equal(JSON.stringify([elements, couverture]), avant);
  assert.equal(Object.isFrozen(r), false, 'aucun gel : un tableau ordinaire');
});
test('A3. ÉGALITÉ des chemins typés, exactement celle de resoudreCouverture : 0 ≠ "0", [] ≠ [""], ["a/b"] ≠ ["a","b"] ; le contenu n\'est JAMAIS comparé', () => {
  const zero = E([0], ['x']); const chaineZero = E(['0'], ['x']); const racine = E([], ['x']); const vide = E([''], ['x']); const slash = E(['a/b'], ['x']); const deux = E(['a', 'b'], ['x']);
  const tous = [zero, chaineZero, racine, vide, slash, deux];
  for (const cible of tous) {
    const r = resoudreElements(tous, [cible.chemin]);
    assert.equal(r.length, 1); assert.equal(r[0], cible);
    assert.deepEqual(r, resoudreCouverture(tous, [cible.chemin]), 'même résultat que la résolution de couverture');
  }
  assert.equal(memesCouvertures([[0]], [['0']]), false);
});
test('A4. DEUX ÉLÉMENTS DE CONTENU IDENTIQUE restent DISTINCTS : seul le chemin décide (A2 et A)', () => {
  const a = E(['A'], ['b', 'o']); const a2 = E(['A2'], ['b', 'o']);
  assert.deepEqual(resoudreElements([a, a2], [['A2']]), [a2]);
  assert.equal(resoudreElements([a, a2], [['A2']])[0], a2);
  assert.deepEqual(resoudreElements([a, a2], [['A'], ['A2']]), [a, a2]);
  assert.deepEqual(resoudreElements([a, a2], [['A']]), [a]);
});
test('A5. MULTI : plusieurs chemins dans la couverture -> TOUS les éléments correspondants, aucun premier, aucun dernier, aucun « courant »', () => {
  const els = ['p', 'q', 'r', 's', 't'].map((n, i) => E([n], [i]));
  assert.deepEqual(resoudreElements(els, [['t'], ['p'], ['r']]), [els[0], els[2], els[4]]);
  assert.deepEqual(resoudreElements(els, els.map((e) => e.chemin)), els);
  assert.equal(resoudreElements(els, [['q'], ['s']]).length, 2);
});
test('A6. COUVERTURE VIDE -> collection vide valide (même pour elements vide) ; elements vide + couverture non vide -> refus (chemin absent)', () => {
  assert.deepEqual(resoudreElements([E(['a'], ['x'])], []), []);
  assert.deepEqual(resoudreElements([], []), []);
  assert.ok(Array.isArray(resoudreElements([], [])));
  refuse(() => resoudreElements([], [['a']]));
});
test('A7. DOUBLON dans la couverture -> TypeError (aucune déduplication) ; chemin ABSENT de elements -> TypeError ; aucun résultat partiel', () => {
  const els = [E(['a'], ['x']), E(['b'], ['y'])];
  refuse(() => resoudreElements(els, [['a'], ['a']]));
  refuse(() => resoudreElements(els, [['a'], ['a'], ['b']]));
  refuse(() => resoudreElements(els, [['a'], ['z']]));
  refuse(() => resoudreElements(els, [['z']]));
  refuse(() => resoudreElements(els, [['0'], ['a']]));
  let sortie;
  assert.throws(() => { sortie = resoudreElements(els, [['a'], ['z']]); }, TypeError);
  assert.equal(sortie, undefined, 'aucun résultat partiel');
});
test('A8. STRUCTURE invalide -> TypeError : entrées non tableaux, trous, éléments non objets, chemin ou contenu absent / hérité / accesseur / non collection / non scalaire', () => {
  const ok = [E(['a'], ['x'])];
  for (const mauvais of [null, undefined, 'a', 3, {}, { length: 0 }]) { refuse(() => resoudreElements(mauvais, [])); refuse(() => resoudreElements(ok, mauvais)); }
  refuse(() => resoudreElements([null], [])); refuse(() => resoudreElements(['a'], [])); refuse(() => resoudreElements([[['a'], ['x']]], []));
  refuse(() => resoudreElements([, E(['a'], [])], [])); // trou
  refuse(() => resoudreElements([{ contenu: ['x'] }], []));
  refuse(() => resoudreElements([{ chemin: ['a'] }], []));
  refuse(() => resoudreElements([Object.create({ chemin: ['a'], contenu: [] })], []));
  refuse(() => resoudreElements([{ chemin: 'a', contenu: [] }], []));
  refuse(() => resoudreElements([{ chemin: ['a'], contenu: 'x' }], []));
  refuse(() => resoudreElements([{ chemin: ['a'], contenu: null }], []));
  refuse(() => resoudreElements([{ chemin: ['a'], contenu: [{}] }], []));
  refuse(() => resoudreElements([{ chemin: ['a'], contenu: [null] }], []));
  refuse(() => resoudreElements([{ chemin: ['a'], contenu: [, 1] }], []));
  refuse(() => resoudreElements([{ chemin: [{}], contenu: [] }], []));
  const accesseur = { chemin: ['a'] }; Object.defineProperty(accesseur, 'contenu', { get() { throw new Error('exécuté !'); }, enumerable: true });
  refuse(() => resoudreElements([accesseur], []));
  refuse(() => resoudreElements(ok, [['a'], 3])); refuse(() => resoudreElements(ok, [null])); refuse(() => resoudreElements(ok, [[{}]]));
  refuse(() => resoudreElements([E(['a'], ['x']), E(['a'], ['y'])], [['a']])); // deux éléments de même chemin : ambigu, jamais choisi
  assert.deepEqual(resoudreElements([{ chemin: ['a'], contenu: ['x'], extra: { libre: true } }], [['a']]).map((e) => e.extra), [{ libre: true }], 'champs en plus tolérés et conservés');
});
test('A9. même mécanique que resoudreCouverture pour les chemins : sur des éléments valides, résultat identique ; le contenu n\'est lu que pour être validé', () => {
  const els = [E(['b', 1], ['y']), E([], []), E(['a'], ['x', 2, true]), E([0], ['z'])];
  for (const couv of [[], [['a']], [['b', 1], []], normaliserCouverture(els.map((e) => e.chemin))]) assert.deepEqual(resoudreElements(els, couv), resoudreCouverture(els, couv));
});
test('A10. PURETÉ : sortie déterministe, aucune mémoire entre appels', () => {
  const els = [E(['a'], ['x']), E(['b'], ['y'])];
  const premiere = resoudreElements(els, [['b'], ['a']]);
  for (let i = 0; i < 5; i += 1) assert.deepEqual(resoudreElements(els, [['b'], ['a']]), premiere);
  assert.deepEqual(resoudreElements(els, []), []);
  assert.deepEqual(resoudreElements(els, [['a']]), [els[0]]);
});
test('A11. LE CODE : un import (resolution-couverture), aucune égalité redéfinie, aucune copie, aucun filtre, aucune connaissance du domaine', () => {
  assert.deepEqual(CODE.match(/^import\b.*$/gm), ["import { resoudreCouverture as resoudreChemins } from './resolution-couverture.js';"]);
  assert.equal(/\bfetch\b|localStorage|indexedDB|process\.|Date\.now|new Date|Math\.random|console\.|await\b|\basync\b|globalThis|window\.|document\./.test(CODE), false);
  assert.equal(/\.map\s*\(|\.filter\s*\(|\.slice\s*\(|\.concat\s*\(|\.sort\s*\(|\bstructuredClone\b|JSON\.|\.\.\.|Object\.assign|Object\.fromEntries|new Set|new Map/.test(CODE), false, 'ni copie, ni filtre, ni ordre propre');
  assert.equal(/===\s*chemin|\.indexOf\s*\(|\.includes\s*\(|\.some\s*\(|\.find\s*\(/.test(CODE), false, 'aucune égalité de chemins redéfinie');
  assert.equal(/\b(motif|motifs|occurrence|occurrences|nouveaut\w*|reconnu\w*|message|situation|attente|experience|issue|seuil|reponse)/i.test(CODE), false, 'aucun mot du domaine');
});

// ============================================================================ B. CATALOGUE ET TABLE
test('B1. descripteur : entrées elements (collection de {chemin, contenu}) et couverture (collection de collection de scalaire) ; sortie = collection de {chemin, contenu} ; 16e entrée, après resoudreCouverture', () => {
  assert.deepEqual(Object.keys(DESCRIPTION).sort(), ['entrees', 'nom', 'sortie']);
  assert.deepEqual(Object.keys(DESCRIPTION.entrees), ['elements', 'couverture']);
  const CS = { forme: 'collection', elements: { forme: 'scalaire' } };
  const ELEMENT = { forme: 'objet', champs: { chemin: CS, contenu: CS } };
  assert.deepEqual(DESCRIPTION.entrees.elements, { forme: 'collection', elements: ELEMENT });
  assert.deepEqual(DESCRIPTION.entrees.couverture, { forme: 'collection', elements: CS });
  assert.deepEqual(DESCRIPTION.sortie, { forme: 'collection', elements: ELEMENT });
  assert.deepEqual(DESCRIPTION.sortie.elements, DESCRIPTION.entrees.elements.elements, 'la sortie conserve EXACTEMENT la forme de l\'élément d\'entrée');
  assert.doesNotThrow(() => valider(DESCRIPTION));
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 16);
  const noms = DESCRIPTIONS_OPERATIONS.map((d) => d.nom);
  assert.equal(noms[noms.indexOf(NOM) - 1], 'resoudreCouverture');
  assert.equal(noms[noms.indexOf(NOM) + 1], 'symbolesDeChaine');
  assert.deepEqual([...noms].sort(), noms, 'ordre code-unit par nom');
  assert.equal(JSON.stringify(DESCRIPTION).includes('collectif'), false, 'aucune entrée collective');
});
test('B2. table : appel positionnel, paramètres « elements » puis « couverture », la fonction réelle ; seize entrées au même ordre de noms ; resoudreCouverture INCHANGÉE (un seul descripteur, une seule fonction)', () => {
  assert.deepEqual({ appel: TABLE_OPERATIONS[NOM].appel, parametres: [...TABLE_OPERATIONS[NOM].parametres] }, { appel: 'positionnel', parametres: ['elements', 'couverture'] });
  assert.equal(TABLE_OPERATIONS[NOM].fonction, resoudreElements);
  assert.equal(Object.isFrozen(TABLE_OPERATIONS[NOM]), true); assert.equal(Object.isFrozen(TABLE_OPERATIONS[NOM].parametres), true);
  assert.deepEqual(Object.keys(TABLE_OPERATIONS), DESCRIPTIONS_OPERATIONS.map((d) => d.nom));
  assert.equal(TABLE_OPERATIONS.resoudreCouverture.fonction, resoudreCouverture);
  assert.deepEqual([...TABLE_OPERATIONS.resoudreCouverture.parametres], ['univers', 'couverture']);
  assert.equal(DESCRIPTIONS_OPERATIONS.filter((d) => d.nom === 'resoudreCouverture').length, 1);
});
test('B3. invocable par la table : même résultat que l\'appel direct ; erreurs de la fonction propagées', () => {
  const els = [E(['a'], ['x']), E(['b'], ['y'])];
  const r = invoquerOperation(TABLE_OPERATIONS, NOM, { elements: els, couverture: [['b']] });
  assert.deepEqual(r, [els[1]]); assert.equal(r[0], els[1]);
  assert.throws(() => invoquerOperation(TABLE_OPERATIONS, NOM, { elements: els, couverture: [['z']] }), TypeError);
});

// ============================================================================ C. CHAÎNAGE MESURÉ
const garantit = (sortie, entree) => fournieGarantitAttendue(sortie, entree);
test('C1. PRODUCTEURS compatibles : elements <- elementsObservables (et la sortie de cette opération elle-même) ; couverture <- normaliserCouverture, projeterChemins, projeterContenus (et sous-données de partagerCouvertures)', () => {
  const d = valider(DESCRIPTION);
  const qui = (entree) => DESCRIPTIONS_OPERATIONS.filter((x) => garantit(valider(x).sortie, d.entrees[entree])).map((x) => x.nom).sort();
  assert.deepEqual(qui('elements'), ['elementsObservables', NOM]);
  assert.deepEqual(qui('couverture'), ['normaliserCouverture', 'projeterChemins', 'projeterContenus']);
  const partage = valider(DESCRIPTIONS_OPERATIONS.find((x) => x.nom === 'partagerCouvertures'));
  const sd = sousDonneesDeclarees(partage.sortie);
  assert.deepEqual(sd.map((s) => s.chemin), [['communs'], ['seulementA'], ['seulementB']]);
  for (const s of sd) assert.equal(garantit(s.forme, d.entrees.couverture), true, `sous-donnée ${s.chemin} compatible avec couverture`);
  assert.equal(garantit(partage.sortie, d.entrees.couverture), false, 'la production entière (objet) n\'est pas une couverture');
  for (const nom of ['produireSuitesFermees', 'rechercherSousSuites', 'parcourirStructure', 'symbolesDeChaine']) assert.equal(garantit(valider(DESCRIPTIONS_OPERATIONS.find((x) => x.nom === nom)).sortie, d.entrees.elements), false, nom);
});
test('C2. CONSOMMATEURS compatibles de la sortie : GARANTIE compatible avec rechercherSousSuites.elements ; aussi toutes les autres entrées dont la forme est naturellement garantie ; rien d\'exclu', () => {
  const d = valider(DESCRIPTION);
  const garanties = [];
  for (const x of DESCRIPTIONS_OPERATIONS) for (const [entree, forme] of Object.entries(valider(x).entrees)) if (garantit(d.sortie, forme)) garanties.push(`${x.nom}.${entree}`);
  assert.deepEqual(garanties.sort(), [
    'couvrirSequence.elements', 'parcourirStructure.valeur', 'produireConstatsStructurels.elements', 'produireSuitesFermees.elements', 'projeterChemins.elements',
    'projeterContenus.elements', 'rechercherSousSuites.elements', 'resoudreCouverture.univers', 'resoudreElements.elements',
  ]);
  assert.equal(garantit(d.sortie, valider(DESCRIPTIONS_OPERATIONS.find((x) => x.nom === 'rechercherSousSuites')).entrees.elements), true);
  assert.equal(garantit(d.sortie, d.entrees.elements), true, 'la sortie est de la forme d\'entrée : chaînable avec elle-même (collision de forme acceptée)');
  assert.equal(garantit(d.sortie, d.entrees.couverture), false);
});
test('C3. COLLISIONS NATURELLES de la forme, acceptées : l\'entrée `elements` est garantie par la sortie de resoudreElements ; la forme de sortie de resoudreCouverture (sans `contenu`) ne garantit PAS elements', () => {
  const d = valider(DESCRIPTION);
  const rc = valider(DESCRIPTIONS_OPERATIONS.find((x) => x.nom === 'resoudreCouverture'));
  assert.equal(garantit(rc.sortie, d.entrees.elements), false);
  assert.equal(garantit(d.sortie, rc.entrees.univers), true, 'la sortie de resoudreElements peut servir d\'univers de resoudreCouverture');
});

// ============================================================================ D. LA CHAÎNE RÉELLE
function monde() {
  const magasin = magasinMemoireVive();
  let n = 0;
  async function tour(texte) {
    let k = (n += 1) * 100;
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    const r = await observerPossibilites(message, { enregistrer: (o) => enregistrerObservationPossibilites(magasin, o), lireExecutions: () => magasin.lireTout('executionsOperations') });
    assert.equal(r.statut, 'ecrite');
    return { message, observation: r.observation, univers: r.univers };
  }
  async function lancer(texteTour, operation, liaisons) {
    const t = await tour(texteTour);
    const application = liaisons ? { operation, liaisons } : applicationsSollicitables(t.observation).applications.find((a) => a.operation === operation);
    assert.ok(application, `${operation} : application attendue`);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
    assert.equal(r.statut, 'executee', `${operation} : ${r.erreur && r.erreur.message}`);
    return { ...r, t };
  }
  return { magasin, tour, lancer };
}
// A, B -> P -> S -> M ; puis les textes nouveaux (C, ...) -> P' ; H = chemins(P), H' = chemins(P') ; Q = partagerCouvertures(H', H).
async function chaine(nouveaux = ['bonsoir Pixel']) {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const S = await w.lancer('tour S', 'produireSuitesFermees', [{ entree: 'elements', donnee: P.execution.id }]);
  const M = await w.lancer('tour M', 'projeterContenus', [{ entree: 'elements', donnee: S.execution.id }]);
  const nouvelles = [];
  for (const texte of nouveaux) nouvelles.push(await w.lancer(texte, 'symbolesDeChaine'));
  const Pp = await w.lancer("tour P'", 'elementsObservables');
  const H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: P.execution.id }]);
  const Hp = await w.lancer("tour H'", 'projeterChemins', [{ entree: 'elements', donnee: Pp.execution.id }]);
  const Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: Hp.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  const ligneQ = (await w.magasin.lireTout('executionsOperations')).find((l) => l.id === Q.execution.id);
  const N = ligneQ.sousDonnees.find((r) => r.chemin[0] === 'seulementA').id;
  const id = { A: A.execution.id, B: B.execution.id, P: P.execution.id, S: S.execution.id, M: M.execution.id, Pp: Pp.execution.id, Q: Q.execution.id, N, nouvelles: nouvelles.map((x) => x.execution.id) };
  return { w, A, B, P, S, M, Pp, H, Hp, Q, nouvelles, id };
}
const liaisonsE = (m) => [{ entree: 'elements', donnee: m.id.Pp }, { entree: 'couverture', donnee: m.id.N }];
const etapeE = (m) => m.w.lancer('tour E', NOM, liaisonsE(m));
const etapeRC = (m, E) => m.w.lancer('tour RC', 'rechercherSousSuites', [{ entree: 'motifs', donnee: m.id.M }, { entree: 'elements', donnee: E.execution.id }]);
const nomsDe = (m) => new Map([[m.id.A, 'A'], [m.id.B, 'B'], ...m.id.nouvelles.map((i, k) => [i, ['C', 'D', 'F'][k]])]);
const lecture = (RC, noms) => RC.map((x) => Object.fromEntries(Object.entries(x.occurrences.reduce((acc, o) => { (acc[noms.get(o.element[0])] ??= []).push(o.debut); return acc; }, {}))));
const liste = (texte) => symbolesDeChaine(texte);

const MC = await chaine();
test('D1. ÉTAT : N (sous-donnée Q.seulementA) vaut [[C]] ; P\' = [A, B, C] ; M = les six motifs ; aucune écriture par la sélection', async () => {
  const { w, id } = MC;
  const lignes = await w.magasin.lireTout('executionsOperations');
  const ligneQ = lignes.find((l) => l.id === id.Q);
  assert.deepEqual(ligneQ.resultat.seulementA, [[id.nouvelles[0]]]);
  assert.deepEqual(MC.Pp.execution.resultat.map((e) => e.chemin), [[id.A], [id.B], [id.nouvelles[0]]]);
  assert.deepEqual(MC.M.execution.resultat, [liste('bonjour Pixel'), liste('o'), liste('u'), liste(' Pixel'), liste('l'), liste('salut Pixel')]);
});
test('D2. « choix à faire » : elements a plusieurs candidats (P, P\'), couverture en a plusieurs (H, H\', M et les sous-données de Q) ; aucune application déterminée, aucune sélection automatique, aucune préférence', async () => {
  const m = await chaine();
  const t = await m.w.tour('observation');
  const candidats = (entree) => new Set(t.observation.possibilites.filter((p) => p.operation === NOM && p.entree === entree).map((p) => p.donnee));
  const ex = candidats('elements'); const co = candidats('couverture');
  assert.deepEqual([...ex].sort(), [m.id.P, m.id.Pp].sort());
  for (const d of [m.H.execution.id, m.Hp.execution.id, m.id.M, m.id.N]) assert.equal(co.has(d), true, d);
  assert.ok(co.size >= 6, 'H, H\', M et trois sous-données de Q au moins');
  const { applications, choixAFaire } = applicationsSollicitables(t.observation);
  assert.equal(applications.some((a) => a.operation === NOM), false);
  assert.equal(choixAFaire.includes(NOM), true);
  // la sortie de la sélection est elle-même candidate de plusieurs opérations
  const E = await etapeE(m);
  const t2 = await m.w.tour('après E');
  const ops = t2.observation.possibilites.filter((p) => p.donnee === E.execution.id).map((p) => `${p.operation}.${p.entree}`).sort();
  assert.deepEqual(ops, ['couvrirSequence.elements', 'parcourirStructure.valeur', 'produireConstatsStructurels.elements', 'produireSuitesFermees.elements', 'projeterChemins.elements',
    'projeterContenus.elements', 'rechercherSousSuites.elements', 'resoudreCouverture.univers', 'resoudreElements.elements']);
  assert.equal(applicationsSollicitables(t2.observation).applications.some((a) => a.operation === 'rechercherSousSuites'), false, 'rechercherSousSuites : toujours « choix à faire » (P, P\', E)');
});
test('D3. CAS C : E = resoudreElements(P\', N) contient EXACTEMENT l\'élément C ; rechercherSousSuites(M, E) : o -> C@1,C@4 ; Pixel -> C@7 ; l -> C@12 ; les trois autres motifs conservés avec des occurrences vides', async () => {
  const m = await chaine();
  const Eex = await etapeE(m);
  const C = m.nouvelles[0].execution.id;
  assert.deepEqual(Eex.execution.resultat.map((e) => e.chemin), [[C]]);
  assert.equal(Eex.execution.resultat.length, 1);
  assert.deepEqual(Eex.execution.resultat, [m.Pp.execution.resultat.find((e) => e.chemin[0] === C)], 'l\'élément C de P\', avec son contenu');
  assert.deepEqual(Eex.execution.resultat[0].contenu, liste('bonsoir Pixel'));
  assert.deepEqual(Eex.execution.resultat, resoudreElements(m.Pp.execution.resultat, [[C]]));
  const RC = await etapeRC(m, Eex);
  const R = RC.execution.resultat;
  assert.equal(R.length, 6, 'aucune entrée vide supprimée');
  assert.deepEqual(R.map((x) => x.contenu), MC.M.execution.resultat);
  assert.deepEqual(R.map((x) => x.occurrences), [
    [], [{ element: [C], debut: 1 }, { element: [C], debut: 4 }], [], [{ element: [C], debut: 7 }], [{ element: [C], debut: 12 }], [],
  ]);
  assert.deepEqual(R, rechercherSousSuites(m.M.execution.resultat, Eex.execution.resultat), 'identique à l\'appel direct');
  assert.deepEqual(lecture(R, nomsDe(m)), [{}, { C: [1, 4] }, {}, { C: [7] }, { C: [12] }, {}]);
});
test('D4. CAS A2 : A2 = même contenu que A, identité différente ; N = [[A2]] ; E contient A2 et PAS A ; rechercherSousSuites(M, E) : bonjour Pixel -> A2@0 ; o -> A2@1,A2@4 ; u -> A2@5 ; Pixel -> A2@7 ; l -> A2@12 ; salut Pixel -> []', async () => {
  const m = await chaine(['bonjour Pixel']);
  const A2 = m.id.nouvelles[0];
  const ligneQ = (await m.w.magasin.lireTout('executionsOperations')).find((l) => l.id === m.id.Q);
  assert.deepEqual(ligneQ.resultat.seulementA, [[A2]], 'N = [[A2]]');
  assert.deepEqual(m.Pp.execution.resultat.find((e) => e.chemin[0] === A2).contenu, m.Pp.execution.resultat.find((e) => e.chemin[0] === m.id.A).contenu, 'même contenu que A');
  assert.notEqual(A2, m.id.A);
  const Eex = await etapeE(m);
  assert.deepEqual(Eex.execution.resultat.map((e) => e.chemin), [[A2]]);
  assert.equal(Eex.execution.resultat.some((e) => e.chemin[0] === m.id.A), false, 'A absent : seule l\'identité décide, jamais le contenu');
  const R = (await etapeRC(m, Eex)).execution.resultat;
  assert.equal(R.length, 6);
  assert.deepEqual(lecture(R, nomsDe(m)).map((o) => Object.keys(o).length === 0 ? {} : { A2: o.C }), [{ A2: [0] }, { A2: [1, 4] }, { A2: [5] }, { A2: [7] }, { A2: [12] }, {}]);
  assert.deepEqual(R.map((x) => x.occurrences.map((o) => [o.element[0] === A2, o.debut])), [[[true, 0]], [[true, 1], [true, 4]], [[true, 5]], [[true, 7]], [[true, 12]], []]);
  assert.deepEqual(R[5].occurrences, []); // « salut Pixel » : aucune occurrence dans A2
});
test('D5. MULTI : N contient plusieurs chemins (C et D) -> E contient les deux éléments, rien d\'autre ; les occurrences sont celles de CES éléments, sans premier ni dernier', async () => {
  const m = await chaine(['bonsoir Pixel', 'bonne nuit']);
  const [C, D] = m.id.nouvelles;
  const ligneQ = (await m.w.magasin.lireTout('executionsOperations')).find((l) => l.id === m.id.Q);
  assert.deepEqual(ligneQ.resultat.seulementA, normaliserCouverture([[C], [D]]));
  const Eex = await etapeE(m);
  assert.deepEqual(Eex.execution.resultat.map((e) => e.chemin), normaliserCouverture([[C], [D]]));
  assert.equal(Eex.execution.resultat.length, 2);
  assert.equal(Eex.execution.resultat.some((e) => e.chemin[0] === m.id.A || e.chemin[0] === m.id.B), false);
  const R = (await etapeRC(m, Eex)).execution.resultat;
  const directe = rechercherSousSuites(m.M.execution.resultat, m.Pp.execution.resultat.filter((e) => e.chemin[0] === C || e.chemin[0] === D));
  assert.deepEqual(R.map((x) => x.occurrences.map((o) => [o.element[0], o.debut]).sort()), directe.map((x) => x.occurrences.map((o) => [o.element[0], o.debut]).sort()));
  const touches = new Set(R.flatMap((x) => x.occurrences.map((o) => o.element[0])));
  assert.deepEqual([...touches].sort(), [C, D].sort(), 'les occurrences viennent des DEUX éléments');
  assert.equal(R.length, 6);
});
test('D6. COUVERTURE VIDE dans la chaîne : N vide -> E = [] ; rechercherSousSuites(M, []) donne TOUS les motifs de M avec des occurrences vides (comportement existant inchangé)', async () => {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  await w.lancer('salut Pixel', 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const S = await w.lancer('tour S', 'produireSuitesFermees', [{ entree: 'elements', donnee: P.execution.id }]);
  const M = await w.lancer('tour M', 'projeterContenus', [{ entree: 'elements', donnee: S.execution.id }]);
  const H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: P.execution.id }]);
  const Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: H.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  const ligneQ = (await w.magasin.lireTout('executionsOperations')).find((l) => l.id === Q.execution.id);
  assert.deepEqual(ligneQ.resultat.seulementA, []);
  const N = ligneQ.sousDonnees.find((r) => r.chemin[0] === 'seulementA').id;
  const Eex = await w.lancer('tour E', NOM, [{ entree: 'elements', donnee: P.execution.id }, { entree: 'couverture', donnee: N }]);
  assert.deepEqual(Eex.execution.resultat, []);
  const RC = await w.lancer('tour RC', 'rechercherSousSuites', [{ entree: 'motifs', donnee: M.execution.id }, { entree: 'elements', donnee: Eex.execution.id }]);
  assert.equal(RC.execution.resultat.length, M.execution.resultat.length);
  assert.deepEqual(RC.execution.resultat.map((x) => x.contenu), M.execution.resultat);
  for (const x of RC.execution.resultat) assert.deepEqual(x.occurrences, []);
  assert.ok(A.execution.id);
});
test('D7. ERREUR dans la chaîne : une couverture qui désigne un chemin absent de `elements` -> exécution REFUSÉE (echec_execution), aucune ligne en plus ; avec P (sans C) et N = [[C]]', async () => {
  const m = await chaine();
  const avant = (await m.w.magasin.lireTout('executionsOperations')).length;
  const t = await m.w.tour('tour refus');
  const r = await executerApplicationSollicitee({ observation: t.observation, application: { operation: NOM, liaisons: [{ entree: 'elements', donnee: m.id.P }, { entree: 'couverture', donnee: m.id.N }] }, univers: t.univers }, { magasin: m.w.magasin, table: TABLE_OPERATIONS });
  assert.notEqual(r.statut, 'executee');
  assert.equal((await m.w.magasin.lireTout('executionsOperations')).length, avant, 'aucun résultat partiel, aucune ligne');
});
test('D8. AUCUNE sous-donnée α2 pour la sortie (une collection) ; la ligne de E ne porte pas `sousDonnees`', async () => {
  const m = await chaine();
  const Eex = await etapeE(m);
  assert.deepEqual(sousDonneesDeclarees(DESCRIPTION.sortie), []);
  const ligne = (await m.w.magasin.lireTout('executionsOperations')).find((l) => l.id === Eex.execution.id);
  assert.equal(Object.hasOwn(ligne, 'sousDonnees'), false);
  assert.deepEqual(Object.keys(ligne).sort(), ['horodatage', 'id', 'idDesignation', 'liaisons', 'operation', 'resultat']);
});

// ============================================================================ E. CE QUI N'EST PAS TOUCHÉ
test('E1. resoudreCouverture INCHANGÉE : un seul descripteur (univers { chemin }, sortie collection de { chemin }), aucun second descripteur', () => {
  const d = DESCRIPTIONS_OPERATIONS.find((x) => x.nom === 'resoudreCouverture');
  assert.deepEqual(Object.keys(d.entrees), ['univers', 'couverture']);
  assert.deepEqual(d.sortie.elements.champs, { chemin: { forme: 'collection', elements: { forme: 'scalaire' } } });
  assert.deepEqual(d.entrees.univers.elements.champs, { chemin: { forme: 'collection', elements: { forme: 'scalaire' } } });
});
test('E2. DORMANCE : seuls resolution-couverture.js (importé), le catalogue et la table nomment le module ; main.js ne l\'atteint que par la table ; aucun terme du domaine, aucune persistance', () => {
  const parcourir = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? parcourir(p) : [p]; });
  const nommant = parcourir(join(RACINE, 'app')).filter((p) => /\.(js|mjs|html)$/.test(p)).filter((p) => /resoudre-elements|resoudreElements/.test(readFileSync(p, 'utf8'))).map((p) => relative(RACINE, p)).sort();
  assert.deepEqual(nommant, ['app/langage/descriptions-operations.js', 'app/langage/resoudre-elements.js', 'app/langage/table-operations.js']);
  const table = lu('app', 'langage', 'table-operations.js');
  assert.equal((table.match(/resoudre-elements\.js/g) || []).length, 1);
  assert.equal(/resoudreElements|resoudre-elements/.test(sansCommentaires(lu('app', 'langage', 'descriptions-operations.js')).replace(/nom: 'resoudreElements'/, '')), false, 'le catalogue ne cite aucun module');
});
// === FIN_TEST_RESOUDRE_ELEMENTS ===
