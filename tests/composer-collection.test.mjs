// v0.63.67 — composerCollection : composer mécaniquement une collection homogène ORDONNÉE (décision ChatGPT, 06/10/2026). Preuves : la règle générale (collection
// de chaînes primitives -> juxtaposition dans l'ordre) ; vide, chaîne vide, Unicode, doublons, chaînes de plusieurs caractères ; homogénéité stricte, aucune coercition ;
// ordre conservé ; pureté ; description de catalogue exacte et entrée de table ; indépendance statique (la transformation ne voit que sa propre entrée) ; chemin
// mécanique ordinaire sans branchement ; cas R ; sonde S -> R -> S' avec l'égalité de valeurs scalaires EXISTANTE ; provenance par les traces existantes ;
// deuxième usage indépendant ; effet vivant mesuré sur le scénario à 7 tours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/composer-collection.js';
import { composerCollection } from '../app/langage/composer-collection.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { invoquerOperation } from '../app/langage/invocation-operations.js';
import { validerDescripteurOperation } from '../app/langage/formes-operation.js';
import { decrireValeursObservees } from '../app/langage/valeurs-observees.js';
import { decrireStructureIdentifiee } from '../app/langage/structure-identifiee.js';
import { sousDonneesDeclarees } from '../app/langage/sous-donnees.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'composer-collection.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^composerCollection : /.test(e.message));
const DESCRIPTION = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === 'composerCollection');
const R = ['b', 'o', 'n', 'j', 'o', 'u', 'r', ' ', 'P', 'i', 'x', 'e', 'l'];

// ------------------------------------------------------------------------------------------------------------------------ A. CONTRAT
test('A1. export nommé unique, fonction à un paramètre', () => {
  assert.deepEqual(Object.keys(module), ['composerCollection']);
  assert.equal(typeof composerCollection, 'function');
  assert.equal(composerCollection.length, 1);
  assert.equal(composerCollection.constructor.name, 'Function', 'synchrone');
});
test('A2. RÈGLE GÉNÉRALE : une collection de chaînes primitives donne la chaîne obtenue en les juxtaposant dans l\'ordre reçu', () => {
  assert.equal(composerCollection(['a', 'b', 'c']), 'abc');
  assert.equal(composerCollection(['ab', 'cd']), 'abcd', 'chaînes de plusieurs caractères : aucune hypothèse « un élément = un caractère »');
  assert.equal(composerCollection(['bonjour', ' ', 'Pixel']), 'bonjour Pixel');
  assert.equal(composerCollection(['seul']), 'seul');
});
test('A3. CAS LIMITES : [] -> « », [«»] -> « », [«a», «»] -> « a », chaînes vides neutres où qu\'elles soient', () => {
  assert.equal(composerCollection([]), '');
  assert.equal(composerCollection(['']), '');
  assert.equal(composerCollection(['', '']), '');
  assert.equal(composerCollection(['a', '']), 'a');
  assert.equal(composerCollection(['', 'a']), 'a');
  assert.equal(composerCollection(['a', '', 'b']), 'ab');
});
test('A4. DOUBLONS conservés ; UNICODE conservé tel quel (aucune normalisation) ; hors plan de base ; substituts isolés ; combinant', () => {
  assert.equal(composerCollection(['x', 'x']), 'xx');
  assert.equal(composerCollection(['é', '\u{1F600}']), 'é\u{1F600}');
  assert.equal(composerCollection(['e', '\u0301']), 'e\u0301', 'le combinant reste une suite distincte : aucune fusion ni normalisation');
  assert.notEqual(composerCollection(['e', '\u0301']), '\u00e9', 'pas de normalisation NFC');
  assert.equal(composerCollection(['\uD800']), '\uD800', 'substitut isolé conservé');
  assert.equal(composerCollection(['a', '\uD800', 'b']), 'a\uD800b');
  assert.equal(composerCollection(['\uD83D', '\uDE00']), '\u{1F600}', 'juxtaposition d\'unités de code : deux moitiés consécutives se retrouvent ensemble');
});
test('A5. ORDRE : il fait partie de la donnée, jamais de tri ni de déduplication', () => {
  assert.equal(composerCollection(['a', 'b']), 'ab');
  assert.equal(composerCollection(['b', 'a']), 'ba');
  assert.equal(composerCollection(['c', 'a', 'b', 'a']), 'caba');
  const entree = ['z', 'a'];
  composerCollection(entree);
  assert.deepEqual(entree, ['z', 'a'], 'l\'entrée n\'est pas modifiée');
});

// ------------------------------------------------------------------------------------------------------------------------ B. HOMOGÉNÉITÉ : REFUS, JAMAIS DE COERCITION
test('B1. un élément d\'un autre genre refuse la collection ENTIÈRE (TypeError, aucun résultat partiel)', () => {
  for (const c of [['a', 1], ['a', null], ['a', undefined], ['a', true], [{}, {}], [['a']], ['a', {}], [1, 2], [true, false], [null], [undefined], [0], [-0], [NaN], [[]], [Symbol.iterator]]) refuse(() => composerCollection(c));
});
test('B2. objets String, objets à toString / valueOf, nombres : aucune lecture implicite, aucune coercition', () => {
  let lu = 0;
  const piege = { toString() { lu += 1; return 'x'; }, valueOf() { lu += 1; return 'x'; } };
  refuse(() => composerCollection([piege]));
  refuse(() => composerCollection(['a', piege]));
  refuse(() => composerCollection([new String('a')]));
  refuse(() => composerCollection([1, 'a']));
  assert.equal(lu, 0, 'toString / valueOf jamais appelés');
});
test('B3. ce qui n\'est pas une collection est refusé : chaîne, objet, nombre, null, undefined, objet de type tableau', () => {
  for (const c of ['abc', {}, { length: 1, 0: 'a' }, 7, null, undefined, true, new Set(['a'])]) refuse(() => composerCollection(c));
  assert.throws(() => composerCollection(), TypeError);
});
test('B4. tableau creux et accesseur refusés, sans exécuter l\'accesseur', () => {
  const creux = ['a', 'b']; creux.length = 3;
  refuse(() => composerCollection(creux));
  const trou = []; trou[1] = 'a';
  refuse(() => composerCollection(trou));
  let execute = false;
  const accesseur = ['a'];
  Object.defineProperty(accesseur, 1, { enumerable: true, get() { execute = true; return 'b'; } });
  refuse(() => composerCollection(accesseur));
  assert.equal(execute, false, 'l\'accesseur n\'est pas exécuté');
});
test('B5. un tableau gelé est accepté et reste intact', () => {
  const g = Object.freeze(['a', 'b']);
  assert.equal(composerCollection(g), 'ab');
  assert.deepEqual(g, ['a', 'b']);
});

// ------------------------------------------------------------------------------------------------------------------------ C. PURETÉ ET INDÉPENDANCE STATIQUE
test('C1. déterministe, sans état : deux appels identiques rendent la même chaîne primitive', () => {
  const a = composerCollection(['ab', 'cd']); const b = composerCollection(['ab', 'cd']);
  assert.equal(a, b);
  assert.equal(typeof a, 'string');
  assert.equal(composerCollection(['x']), composerCollection(['x']));
});
test('C2. GARDE D\'INDÉPENDANCE : le module n\'importe rien et ne nomme ni opération voisine, ni historique, ni expérience, ni origine, ni cycle, ni inverse, ni apprentissage, ni attente', () => {
  assert.equal(/^import\b|\bimport\(|\brequire\(/m.test(SRC), false);
  for (const mot of ['symbolesDeChaine', 'symboles-de-chaine', 'correspondancesExperiences', 'formesEntreesRencontrees', 'valeursDonnees', 'origine', 'cycle', 'inverse', 'apprentissage', 'attente']) {
    assert.equal(new RegExp(mot, 'i').test(SRC), false, `${mot} dans le module`);
    assert.equal(new RegExp(mot, 'i').test(JSON.stringify(DESCRIPTION)), false, `${mot} dans la description`);
  }
  for (const interdit of ['Date', 'Math.random', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'crypto', 'setTimeout', 'sort(', 'toString', 'valueOf', 'String(', 'Number(', 'JSON.', '.join(', 'normalize']) assert.equal(CODE.includes(interdit), false, interdit);
  assert.equal(/\blet\s+\w+\s*=\s*(?!'')/.test(CODE.replace(/let (composition|rang)\b/g, '')), false, 'aucun état modifiable de module');
});
test('C3. DORMANCE : seuls le module, le catalogue et la table nomment la primitive ; ni main, ni pont, ni exécution mécanique, ni esprit', () => {
  const nommants = fichiersJs(join(RACINE, 'app')).filter((f) => /composer-collection|composerCollection/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1).split('\\').join('/')).sort();
  assert.deepEqual(nommants, ['app/langage/composer-collection.js', 'app/langage/descriptions-operations.js', 'app/langage/table-operations.js']);
  for (const f of ['app/main.js', 'app/langage/pont.js', 'app/langage/execution-mecanique.js', 'app/langage/applications-sollicitables.js', 'app/langage/contexte-sollicitation.js', 'app/langage/groupes-candidats.js']) {
    assert.equal(/composer-collection|composerCollection/.test(readFileSync(join(RACINE, f), 'utf8')), false, f);
  }
});

// ------------------------------------------------------------------------------------------------------------------------ D. DESCRIPTION ET TABLE
test('D1. description de catalogue exacte : entrée « elements » = collection de chaînes ; sortie = une chaîne ; aucune relation ; valide', () => {
  assert.deepEqual(DESCRIPTION, {
    nom: 'composerCollection',
    entrees: { elements: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } } },
    sortie: { forme: 'scalaire', genre: 'chaine' },
  });
  assert.doesNotThrow(() => validerDescripteurOperation(DESCRIPTION));
  assert.equal(Object.hasOwn(DESCRIPTION, 'relations'), false);
  assert.equal(Object.isFrozen(DESCRIPTION), true);
  assert.equal(DESCRIPTIONS_OPERATIONS.map((d) => d.nom).indexOf('composerCollection'), 0, 'ordre code-unit par nom : première');
});
test('D2. entrée de table : positionnelle, un seul paramètre « elements », la fonction réelle, gelée', () => {
  const e = TABLE_OPERATIONS.composerCollection;
  assert.equal(e.fonction, composerCollection);
  assert.equal(e.appel, 'positionnel');
  assert.deepEqual([...e.parametres], ['elements']);
  assert.equal(Object.isFrozen(e), true);
  assert.equal(invoquerOperation(TABLE_OPERATIONS, 'composerCollection', { elements: ['ab', 'cd'] }), 'abcd');
});
test('D3. la sortie réelle est conforme à la sortie décrite (une chaîne primitive), y compris pour [] et [«»]', () => {
  for (const c of [['a'], [], [''], ['ab', 'cd'], ['\uD800']]) assert.equal(typeof composerCollection(c), 'string');
});

// ------------------------------------------------------------------------------------------------------------------------ E. CAS R ET SONDE S -> R -> S' (aucune connaissance de S dans l'opération)
test('E1. CAS R : la composition des treize symboles donne « bonjour Pixel », sans recevoir ni connaître l\'entrée d\'origine', () => {
  assert.equal(composerCollection(R), 'bonjour Pixel');
  assert.equal(composerCollection.length, 1);
});
test('E2. SONDE S -> symbolesDeChaine -> R -> composerCollection -> S\' ; S\' = S en valeur, constaté par le mécanisme EXISTANT de comparaison de valeurs scalaires (decrireValeursObservees), sans nouvelle primitive d\'égalité', () => {
  for (const S of ['bonjour Pixel', '', 'a', 'a\u{1F600}é', 'e\u0301', 'x\uD800y', 'bonjour  Luna ']) {
    const Rr = symbolesDeChaine(S);
    const Sp = composerCollection(Rr);
    const r = decrireValeursObservees([{ id: 'S', valeur: S }, { id: 'Sprime', valeur: Sp }]);
    assert.equal(r.nombreValeurs, 1, JSON.stringify(S));
    assert.deepEqual(r.valeurs[0].ids.slice().sort(), ['S', 'Sprime']);
    assert.deepEqual(r.nonResolus, []); assert.deepEqual(r.ambigus, []);
  }
  const different = decrireValeursObservees([{ id: 'S', valeur: 'bonjour Pixel' }, { id: 'Sprime', valeur: composerCollection(symbolesDeChaine('bonjour Luna')) }]);
  assert.equal(different.nombreValeurs, 2, 'une autre entrée ne se rejoint pas');
});
test('E3. COMPARAISON : elle n\'est jamais faite par l\'opération (elle ne reçoit que la collection) ; deux collections différentes composées donnent deux chaînes différentes', () => {
  assert.notEqual(composerCollection(['a', 'b']), composerCollection(['b', 'a']));
  assert.equal(composerCollection(['ab']), composerCollection(['a', 'b']), 'même composition à partir de collections différentes : la fonction ne les distingue pas, ce n\'est pas son rôle');
});

// ------------------------------------------------------------------------------------------------------------------------ F. CHEMIN MÉCANIQUE ORDINAIRE, PROVENANCE
async function vie(messages) {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`; const tours = [];
  for (const texte of messages) {
    const suivi = suivreObservationDuTour(
      (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }),
      (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }),
    );
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    tours.push(suivi.joindre(res).sollicitation);
  }
  return { magasin, tours, executions: await magasin.lireTout('executionsOperations'), designations: await magasin.lireTout('designations'), valeurs: await magasin.lireTout('valeursDonnees') };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
let VIE7;
const vie7 = async () => (VIE7 ??= await vie(SCENARIO));

test('F1. PREMIER EFFET VIVANT : composerCollection devient possible au TOUR 2 (la production de symbolesDeChaine du tour 1 est la seule collection de chaînes), est DÉTERMINÉE, s\'exécute mécaniquement par le flux ordinaire et produit « bonjour Pixel »', async () => {
  const w = await vie(['bonjour Pixel']);
  assert.equal(w.executions.some((e) => e.operation === 'composerCollection'), false, 'tour 1 : aucune collection de chaînes encore');
  assert.deepEqual(w.tours[0].choixAFaire, []);
  const w2 = await vie(['bonjour Pixel', 'bonjour Luna']);
  const t2 = w2.tours[1];
  assert.equal(t2.choixAFaire.includes('composerCollection'), false);
  const r = t2.automatiques.find((x) => x.operation === 'composerCollection');
  assert.ok(r); assert.equal(r.statut, 'executee'); assert.equal(r.designation.origine, 'mecanique');
  assert.equal(r.execution.resultat, 'bonjour Pixel');
});
test('F2. PROVENANCE par les traces EXISTANTES, sans nouveau champ : message-1 -> exécution symbolesDeChaine -> exécution composerCollection ; mêmes ids dans la désignation et l\'exécution', async () => {
  const w = await vie(['bonjour Pixel', 'bonjour Luna']);
  const msg = w.valeurs.find((v) => v.valeur === 'bonjour Pixel');
  const sym = w.executions.find((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === msg.id);
  assert.ok(sym); assert.deepEqual(sym.resultat, R);
  const comp = w.executions.find((e) => e.operation === 'composerCollection');
  assert.ok(comp);
  assert.deepEqual(comp.liaisons, [{ entree: 'elements', donnee: sym.id }]);
  const des = w.designations.find((d) => d.id === comp.idDesignation);
  assert.deepEqual(des.liaisons, comp.liaisons); assert.equal(des.operation, 'composerCollection');
  assert.deepEqual(Object.keys(comp).sort(), Object.keys(sym).sort(), 'aucun champ de provenance de plus que les autres exécutions');
  assert.equal(comp.resultat, msg.valeur, 'S\' = S en valeur : constat fait ici, hors de l\'opération');
  // la valeur de l'entrée d'origine n'est écrite nulle part dans la ligne de composition
  assert.equal(JSON.stringify(comp).includes('message-'), false);
});
test('F3. EFFET SUR LE SCÉNARIO À 7 TOURS (mesuré, non corrigé) : composerCollection s\'exécute une fois (tour 2) ; ensuite sa production (une chaîne) est une seconde candidate de symbolesDeChaine, qui passe en choix ; composerCollection devient un choix (deux collections) ; aucun echec_*', async () => {
  const w = await vie7();
  assert.deepEqual(w.tours.map((t) => t.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(w.tours.map((t) => t.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(w.executions.length, 19);
  assert.equal(w.executions.filter((e) => e.operation === 'composerCollection').length, 1);
  assert.equal(w.executions.filter((e) => e.operation === 'symbolesDeChaine').length, 2, 'tours 1 et 2 seulement');
  for (const t of w.tours) for (const r of t.automatiques) assert.equal(String(r.statut).startsWith('echec_'), false);
  assert.equal(w.tours[2].choixAFaire.includes('composerCollection'), true);
  assert.equal(w.tours[2].choixAFaire.includes('symbolesDeChaine'), true);
  assert.deepEqual(w.tours[3].automatiques.map((r) => r.operation), ['elementsObservables']);
});

// ------------------------------------------------------------------------------------------------------------------------ G. DEUXIÈME USAGE INDÉPENDANT
test('G1. DEUXIÈME USAGE : une collection de chaînes issue d\'une AUTRE opération existante (decrireStructureIdentifiee.couverture) passe par le même contrat, sans cas spécial', () => {
  const sortie = decrireStructureIdentifiee([{ id: 'a', texte: 'x' }, { id: 'b', texte: 'y' }]);
  assert.deepEqual(sortie.couverture, ['a', 'b']);
  assert.equal(invoquerOperation(TABLE_OPERATIONS, 'composerCollection', { elements: sortie.couverture }), 'ab');
  const decrite = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === 'decrireStructureIdentifiee');
  assert.deepEqual(decrite.sortie.champs.couverture, DESCRIPTION.entrees.elements, 'la forme décrite de ce champ est EXACTEMENT la forme d\'entrée de composerCollection');
  assert.ok(sousDonneesDeclarees(decrite.sortie).some((s) => s.chemin.length === 1 && s.chemin[0] === 'couverture'), 'ce champ est une sous-donnée exposable par le mécanisme existant');
});
test('G2. TROISIÈME : une collection de chaînes libre (mots) se compose avec le même contrat', () => {
  assert.equal(composerCollection(['le', ' ', 'chat']), 'le chat');
  assert.equal(composerCollection(['2026', '-', '10', '-', '06']), '2026-10-06');
});
// === FIN_TEST_COMPOSER_COLLECTION ===
