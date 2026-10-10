// === DEBUT_TEST_DESCRIPTIONS_OPERATIONS ===
// v0.63.4 — ÉTAPE 6, décision ChatGPT « PREMIER ENSEMBLE RÉEL DE DESCRIPTIONS D'OPÉRATIONS » (04/10/2026). Preuves que
// app/langage/descriptions-operations.js est une DONNÉE PURE ET DORMANTE : un seul tableau, gelé en profondeur, de
// descripteurs valides, sans fonction ni chemin ni dispatch, nommé par aucun autre fichier de production, importé par
// personne, inaccessible depuis le démarrage de l'application, et HONNÊTE (le lien avec les vraies fonctions n'existe
// qu'ici, en test).
//
// v0.63.10 — le tableau compte désormais NEUF descripteurs (memesCouvertures, normaliserCouverture, parcourirStructure,
// partagerCouvertures, produireConstatsStructurels, resoudreCouverture s'ajoutent aux trois de v0.63.4). Sections G à K :
// formes exactes des six nouvelles descriptions, ordre des entrées (lu dans la signature réelle), duplication littérale mesurée,
// compatibilités structurelles diagnostiquées (TESTS SEULEMENT), honnêteté sur valeurs réelles, approximations conservées.
//
// MISE À JOUR DÉLIBÉRÉE v0.63.38 (décision ChatGPT, 05/10/2026) — le tableau compte désormais DIX descripteurs : symbolesDeChaine
// s'ajoute aux neuf précédents. Gardes mises à jour : A1 et L5 (décompte 9 → 10), A3 (liste exacte des noms), D1 (table des vraies
// fonctions), H1 (duplication mesurée : trois formes de plus, aucune ne coïncide avec chemin, couverture ou occurrence). Aucune
// interdiction n'est affaiblie, aucun test n'est effacé. La section M ajoute les preuves propres au nouveau descripteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/descriptions-operations.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { couvrirSequence } from '../app/langage/sequence-plages.js';
import { decrireStructureIdentifiee } from '../app/langage/structure-identifiee.js';
import { decrireValeursObservees } from '../app/langage/valeurs-observees.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { normaliserCouverture, memesCouvertures } from '../app/langage/couverture-occurrences.js';
import { resoudreCouverture } from '../app/langage/resolution-couverture.js';
import { resoudreElements } from '../app/langage/resoudre-elements.js'; // MISE À JOUR DÉLIBÉRÉE v0.63.47
import { produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { partagerCouvertures } from '../app/langage/partition-couvertures.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';
import { composerCollection } from '../app/langage/composer-collection.js'; // MISE À JOUR DÉLIBÉRÉE v0.63.67 : + composerCollection (dix-septième description)
import { elementsObservables } from '../app/langage/elements-observables.js'; // MISE À JOUR DÉLIBÉRÉE v0.63.41
import { produireSuitesFermees } from '../app/langage/suites-fermees.js'; // MISE À JOUR DÉLIBÉRÉE v0.63.42
import { projeterChemins } from '../app/langage/projeter-chemins.js'; // MISE À JOUR DÉLIBÉRÉE v0.63.45
import { projeterContenus } from '../app/langage/projeter-contenus.js'; // MISE À JOUR DÉLIBÉRÉE v0.63.43
import { rechercherSousSuites } from '../app/langage/rechercher-sous-suites.js'; // MISE À JOUR DÉLIBÉRÉE v0.63.44
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { CONTRATS, DESCRIPTIONS, conformite, produireScenarios } from './contrats-observes.mjs';

const RACINE = join(import.meta.dirname, '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'descriptions-operations.js');
const SOURCE = readFileSync(CHEMIN, 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const D = module.DESCRIPTIONS_OPERATIONS;
const NOMS_V0634 = ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees'];
const NOMS_V06310 = ['memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'resoudreCouverture'];
const NOMS_V06338 = ['symbolesDeChaine'];
const NOMS = [...NOMS_V0634, ...NOMS_V06310, ...NOMS_V06338].concat(['composerCollection', 'elementsObservables', 'produireSuitesFermees', 'projeterChemins', 'projeterContenus', 'rechercherSousSuites', 'resoudreElements']).sort(); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements ; MISE À JOUR DÉLIBÉRÉE v0.63.41 : + elementsObservables ; MISE À JOUR DÉLIBÉRÉE v0.63.42 : + produireSuitesFermees (ordre code-unit par nom)
const FONCTIONS = { composerCollection, couvrirSequence, decrireStructureIdentifiee, decrireValeursObservees, elementsObservables, memesCouvertures, normaliserCouverture, parcourirStructure, partagerCouvertures, produireConstatsStructurels, produireSuitesFermees, projeterChemins, projeterContenus, rechercherSousSuites, resoudreCouverture, resoudreElements, symbolesDeChaine }; // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements // MISE À JOUR DÉLIBÉRÉE v0.63.41 : + elementsObservables // MISE À JOUR DÉLIBÉRÉE v0.63.43 : + projeterContenus

function fichiers(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) { if (nom !== 'node_modules') fichiers(p, sortie); } else sortie.push(p);
  }
  return sortie;
}
const rel = (f) => relative(RACINE, f).split('\\').join('/');
function noeuds(x, sortie = []) {
  if (x !== null && typeof x === 'object') { sortie.push(x); for (const v of Object.values(x)) noeuds(v, sortie); }
  return sortie;
}
function cles(x, sortie = new Set()) {
  if (x !== null && typeof x === 'object') for (const [k, v] of Object.entries(x)) { sortie.add(k); cles(v, sortie); }
  return sortie;
}

// ============================================================================ A. CONTRAT DU TABLEAU
test('A1. UN seul export, un tableau de dix descripteurs (trois de v0.63.4, six de v0.63.10, un de v0.63.38)', () => {
  assert.deepEqual(Object.keys(module), ['DESCRIPTIONS_OPERATIONS']);
  assert.equal(Array.isArray(D), true);
  assert.equal(D.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
});
// MISE À JOUR DÉLIBÉRÉE v0.63.61 : trois descripteurs portent la clé facultative `relations` (relations entre entrées, gardées par tests/relations-entrees.test.mjs) ; les 13 autres ont exactement les trois clés d'origine.
const AVEC_RELATIONS = ['couvrirSequence', 'resoudreCouverture', 'resoudreElements'];
const clesAttendues = (d) => (AVEC_RELATIONS.includes(d.nom) ? ['nom', 'entrees', 'relations', 'sortie'] : ['nom', 'entrees', 'sortie']);
test('A2. chaque élément EST directement un descripteur { nom, entrees, sortie } (aucune enveloppe) identique à ce que valide la primitive du langage de formes', () => {
  for (const d of D) {
    assert.deepEqual(Object.keys(d), clesAttendues(d), d.nom);
    assert.deepEqual(valider(d), d, `${d.nom} : validerDescripteurOperation renvoie une copie identique`);
  }
});
test('A3. noms uniques, non vides, ordre déterministe par nom en unités de code ; ce sont exactement les dix primitives retenues, dans cet ordre exact', () => {
  const noms = D.map((d) => d.nom);
  assert.deepEqual(noms, ['composerCollection', 'couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'elementsObservables', 'memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'produireSuitesFermees', 'projeterChemins', 'projeterContenus', 'rechercherSousSuites', 'resoudreCouverture', 'resoudreElements', 'symbolesDeChaine']); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements (après resoudreCouverture) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : + projeterContenus (après produireSuitesFermees, avant resoudreCouverture) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : + rechercherSousSuites // MISE À JOUR DÉLIBÉRÉE v0.63.45 : + projeterChemins
  assert.deepEqual(noms, NOMS);
  assert.equal(new Set(noms).size, noms.length, 'noms uniques');
  for (const n of noms) assert.equal(typeof n === 'string' && n.trim().length > 0, true);
  for (let i = 1; i < noms.length; i += 1) assert.equal(noms[i - 1] < noms[i], true, `${noms[i - 1]} < ${noms[i]} (unités de code)`);
  assert.deepEqual([...noms].sort(), noms);
});
test('A4. ni catégorie, ni id distinct, ni version, ni priorité, ni poids, ni fonction, ni chemin, ni clé de dispatch : le vocabulaire des clés reste celui du langage de formes', () => {
  for (const d of D) assert.deepEqual(Object.keys(d), clesAttendues(d));
  const interdites = ['categorie', 'category', 'identifiant', 'version', 'priorite', 'poids', 'ordre', 'rang', 'score', 'fonction', 'module', 'dispatch', 'invoquer', 'representer', 'callback', 'roles', 'undefined'];
  for (const d of D) for (const c of cles(d)) assert.equal(interdites.includes(c), false, `${d.nom} : clé interdite « ${c} »`);
  // v0.63.10 : `chemin` n'est PLUS interdit comme clé de donnée : c'est le nom d'un CHAMP réel (occurrence, élément d'univers). Il reste
  // interdit partout ailleurs : chaque clé « chemin » doit être un champ directement déclaré sous un objet `champs`, jamais une clé de
  // descripteur, de forme ou de fait, et jamais un chemin de module (voir C4 / C5).
  (function controlerChemin(x, parentEstChamps = false) {
    if (x === null || typeof x !== 'object') return;
    for (const [k, v] of Object.entries(x)) {
      if (k === 'chemin') assert.equal(parentEstChamps, true, 'la clé « chemin » n\'est admise que comme nom de champ décrit');
      controlerChemin(v, k === 'champs');
    }
  })(D);
  for (const d of D) { assert.equal('chemin' in d, false); assert.equal('chemin' in d.entrees, false, `${d.nom} : « chemin » n'est pas une entrée`); }
  // `id` n'est interdit que comme clé du descripteur lui-même : les champs ordinaires `id` (entrées / sorties décrites) sont des champs réels.
  for (const d of D) assert.equal('id' in d, false);
});
test('A5. JSON.stringify / parse préserve la valeur ; aucune fonction, aucun undefined, aucun nombre, aucun symbole dans les données', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(D)), D);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(D))), JSON.stringify(D));
  for (const n of noeuds(D)) for (const v of Object.values(n)) assert.equal(['string', 'boolean', 'object'].includes(typeof v), true, typeof v);
  assert.equal(JSON.stringify(D).includes('undefined'), false);
});

// ============================================================================ B. GEL EN PROFONDEUR
test('B1. le tableau ET tous ses descendants sont gelés (Object.isFrozen récursif)', () => {
  const tous = noeuds(D);
  assert.equal(Object.isFrozen(D), true);
  assert.ok(tous.length > 40, 'le parcours atteint bien tous les niveaux');
  for (const n of tous) assert.equal(Object.isFrozen(n), true);
});
test('B2. aucune référence partagée entre deux endroits du tableau (chaque nœud est distinct)', () => {
  const tous = noeuds(D);
  assert.equal(new Set(tous).size, tous.length);
});
test('B3. toute tentative de modification, à tous les niveaux, est refusée (modules en mode strict)', () => {
  assert.throws(() => { D.push({}); }, TypeError);
  assert.throws(() => { D[0] = {}; }, TypeError);
  assert.throws(() => { D[0].nom = 'x'; }, TypeError);
  assert.throws(() => { D[0].nouveau = 1; }, TypeError);
  assert.throws(() => { delete D[0].sortie; }, TypeError);
  assert.throws(() => { D[2].sortie.champs.valeurs.elements.champs.valeur.peutManquer = false; }, TypeError);
  assert.throws(() => { D[2].sortie.champs.nouveau = {}; }, TypeError);
  assert.throws(() => { D[0].entrees.plages.elements.champs.etiquette.peutEtreNull = false; }, TypeError);
});
test('B4. le gel ne donne aucune signification supplémentaire : ni propriété cachée, ni non-énumérable, ni accesseur, ni symbole', () => {
  for (const n of noeuds(D)) {
    assert.deepEqual(Object.getOwnPropertySymbols(n), []);
    for (const nom of Object.getOwnPropertyNames(n)) {
      const d = Object.getOwnPropertyDescriptor(n, nom);
      if (Array.isArray(n) && nom === 'length') continue;
      assert.equal(d.enumerable, true, nom);
      assert.equal('value' in d, true, `${nom} n'est pas un accesseur`);
    }
  }
});

// ============================================================================ C. DESCRIPTION ≠ EXÉCUTION (statique)
test('C1. le module n\'importe RIEN et n\'exporte qu\'UNE donnée', () => {
  assert.equal(/^\s*import\b/m.test(CODE), false);
  assert.equal(/\brequire\s*\(|\bimport\s*\(/.test(CODE), false, 'aucun import dynamique');
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export const DESCRIPTIONS_OPERATIONS = geler(['], 'un seul export, sans autre helper exporté');
});
test('C2. aucun eval, aucun constructeur de fonction, aucun callback, aucune flèche, aucun async', () => {
  assert.equal(/\beval\b|new\s+Function|\bFunction\s*\(|=>|\basync\b|\bawait\b|\bsetTimeout\b|\bsetInterval\b|\.then\s*\(|\.call\s*\(|\.apply\s*\(|\.bind\s*\(/.test(CODE), false);
});
test('C3. la seule fonction du fichier est le helper PRIVÉ de gel (aucune fonction d\'opération) ; elle n\'apparaît dans aucune donnée exportée', () => {
  assert.deepEqual(CODE.match(/\bfunction\s+\w+/g), ['function geler']);
  for (const nom of NOMS) assert.equal(new RegExp(`function\\s+${nom}\\b`).test(CODE), false, nom);
  for (const n of noeuds(D)) for (const v of Object.values(n)) assert.notEqual(typeof v, 'function');
  assert.equal('geler' in module, false);
});
test('C4. aucun chemin de module, aucune extension .js, aucune URL, aucune clé de dispatch ni vocabulaire d\'exécution dans le code', () => {
  assert.equal(/\.{1,2}\/|\.js\b|\.mjs\b|https?:|\bfrom\b/.test(CODE), false, 'aucun chemin');
  assert.equal(/\binvoquer\b|\brepresenter\b|\bCAPACITES\b|\bregistre\b|\bdispatch\b|\bexecuter\b|\bappeler\b|\bcallback\b|\bhandler\b/i.test(CODE), false);
  assert.equal(/Date\.now|new Date|Math\.random|localStorage|sessionStorage|indexedDB|\bfetch\b|\bprocess\./.test(CODE), false, 'aucune horloge, aucun hasard, aucune persistance, aucun réseau');
});
test('C5. les fonctions décrites ne sont pas atteignables depuis les données : aucune chaîne du tableau n\'est un chemin, et un nom de primitive n\'y apparaît que comme valeur de `nom`', () => {
  const valeurs = [];
  (function parcourir(x) { if (typeof x === 'string') valeurs.push(x); else if (x && typeof x === 'object') for (const v of Object.values(x)) parcourir(v); })(D);
  for (const v of valeurs) assert.equal(/[/\\]|\.js$/.test(v), false, v);
  for (const nom of NOMS) {
    const occurrences = JSON.stringify(D).split(`"${nom}"`).length - 1;
    assert.equal(occurrences, 1, `${nom} n'apparaît qu'une fois, comme nom`);
    assert.equal(D.find((d) => d.nom === nom) !== undefined, true);
  }
});

// ============================================================================ D. LIEN AVEC LE CODE RÉEL : TESTS SEULEMENT
test('D1. chaque nom est exactement le nom de la fonction réelle qu\'il décrit', () => {
  for (const d of D) {
    assert.equal(typeof FONCTIONS[d.nom], 'function', d.nom);
    assert.equal(d.nom, FONCTIONS[d.nom].name);
  }
  assert.deepEqual(Object.keys(FONCTIONS).sort(), NOMS);
});
test('D2. contrats-observes lit CES objets de production eux-mêmes (aucune seconde définition des trois descripteurs)', () => {
  for (const d of D) {
    assert.equal(DESCRIPTIONS[d.nom], d, d.nom);
    assert.equal(CONTRATS[d.nom], d, d.nom);
  }
  const outil = readFileSync(join(RACINE, 'tests', 'contrats-observes.mjs'), 'utf8');
  for (const nom of NOMS) assert.equal(new RegExp(`contrat\\('${nom}'`).test(outil), false, nom);
  const ext = readFileSync(join(RACINE, 'tests', 'formes-extension.test.mjs'), 'utf8');
  assert.equal(/nom:\s*'(couvrirSequence|decrireValeursObservees|decrireStructureIdentifiee)'/.test(ext), false, 'formes-extension ne redéclare plus aucun descripteur');
  for (const f of ['garantie-forme.test.mjs', 'formes-operation.test.mjs', 'contrats-observes.test.mjs']) {
    const src = readFileSync(join(RACINE, 'tests', f), 'utf8');
    assert.equal(/nom:\s*'(couvrirSequence|decrireValeursObservees|decrireStructureIdentifiee)'/.test(src), false, f);
  }
});
test('D3. les sorties RÉELLES de chaque scénario (une image JSON si le scénario le demande) sont conformes à la description de production', async () => {
  const SC = await produireScenarios();
  for (const nom of NOMS) {
    assert.ok(SC[nom].length >= 3, nom);
    for (const s of SC[nom]) {
      const vue = s.image === 'json' ? JSON.parse(JSON.stringify(s.sortie)) : s.sortie;
      assert.deepEqual(conformite(vue, DESCRIPTIONS[nom].sortie, `${nom}/${s.nom}`), [], `${nom}/${s.nom}`);
    }
  }
});
test('D4. une description falsifiée (nom, forme, fait) n\'est PAS conforme : le lien test ↔ fonction n\'est pas décoratif', async () => {
  const SC = await produireScenarios();
  const copie = JSON.parse(JSON.stringify(DESCRIPTIONS.decrireStructureIdentifiee.sortie));
  copie.champs.couverture = { forme: 'scalaire', genre: 'chaine' };
  assert.ok(conformite(SC.decrireStructureIdentifiee[0].sortie, copie).length > 0);
  assert.notEqual('decrireStructure', FONCTIONS.decrireStructureIdentifiee.name);
  const seq = JSON.parse(JSON.stringify(DESCRIPTIONS.couvrirSequence.sortie));
  delete seq.elements.champs.element.peutEtreNull;
  assert.ok(conformite(SC.couvrirSequence[0].sortie, seq).length > 0);
});

// ============================================================================ E. CONTENU : CONTRATS EXACTS ET LIMITES NON PORTÉES
const par = (nom) => D.find((d) => d.nom === nom);
test('E1. couvrirSequence : contrat de v0.63.3 repris tel quel (elements non détaillée ; etiquette et element = quelconque + peutEtreNull)', () => {
  const d = par('couvrirSequence');
  assert.deepEqual(Object.keys(d.entrees), ['elements', 'plages']);
  assert.deepEqual(d.entrees.elements, { forme: 'collection' });
  assert.deepEqual(d.entrees.plages.elements.champs.etiquette, { forme: 'quelconque', peutEtreNull: true });
  assert.deepEqual(Object.keys(d.entrees.plages.elements.champs).sort(), ['debut', 'etiquette', 'longueur']);
  assert.deepEqual(d.sortie.elements.champs.element, { forme: 'quelconque', peutEtreNull: true });
  assert.deepEqual(d.sortie.elements.champs.couvertures.elements.champs.etiquette, { forme: 'quelconque', peutEtreNull: true });
  assert.deepEqual(d.sortie.elements.champs.position, { forme: 'scalaire', genre: 'nombre' });
  assert.equal(d.sortie.forme, 'collection', 'sortie directe qui est elle-même une collection');
  for (const n of noeuds(d)) assert.equal('omissible' in n || 'peutManquer' in n, false, 'rien d\'omissible ni de manquant dans couvrirSequence');
});
test('E2. decrireValeursObservees : entrée `paires` (nom du paramètre réel) ; valeur = scalaire + omissible + peutEtreNull ; sortie valeur = scalaire + peutManquer + peutEtreNull, jamais quelconque', () => {
  const d = par('decrireValeursObservees');
  assert.deepEqual(Object.keys(d.entrees), ['paires']);
  assert.deepEqual(d.entrees.paires.elements.champs.valeur, { forme: 'scalaire', omissible: true, peutEtreNull: true });
  assert.deepEqual(d.entrees.paires.elements.champs.id, { forme: 'scalaire', genre: 'chaine' });
  const v = d.sortie.champs.valeurs.elements.champs.valeur;
  assert.deepEqual(v, { forme: 'scalaire', peutManquer: true, peutEtreNull: true });
  assert.notEqual(v.forme, 'quelconque');
  assert.equal(JSON.stringify(d).includes('quelconque'), false);
  assert.deepEqual(Object.keys(d.sortie.champs).sort(), ['ambigus', 'nombreValeurs', 'nonResolus', 'valeurs']);
});
test('E3. decrireStructureIdentifiee : contrat de contrats-observes repris sans précision nouvelle (rapport reste un objet non décrit)', () => {
  const d = par('decrireStructureIdentifiee');
  assert.deepEqual(Object.keys(d.entrees), ['elements']);
  assert.deepEqual(d.entrees.elements.elements.champs, { id: { forme: 'scalaire', genre: 'chaine' }, texte: { forme: 'scalaire', genre: 'chaine' } });
  assert.deepEqual(d.sortie.champs.rapport, { forme: 'objet' });
});
test('E4. LIMITES TESTÉES mais NON portées par les descriptions : aucun fait ni forme pour undefined, non-vide, fini, unicité, héritage ; et pourtant le comportement réel existe', () => {
  const toutes = JSON.stringify(D);
  for (const interdit of ['undefined', 'nonVide', 'non_vide', 'fini', 'unique', 'unicite', 'herite', 'entier', 'borne']) assert.equal(toutes.includes(interdit), false, interdit);
  const refuse = (f) => { try { f(); return false; } catch (e) { return e instanceof TypeError; } };
  assert.equal(refuse(() => decrireValeursObservees([{ id: '', valeur: 1 }])), true, 'id vide refusé : non exprimé');
  assert.equal(refuse(() => decrireValeursObservees([{ id: 'a', valeur: NaN }])), true, 'NaN refusé : non exprimé');
  assert.equal(refuse(() => decrireValeursObservees([{ id: 'a', valeur: Infinity }])), true);
  assert.deepEqual(decrireValeursObservees([{ id: 'a', valeur: 1 }, { id: 'a', valeur: 2 }]).ambigus, ['a'], 'ids dupliqués : rapportés, non exprimés');
  assert.deepEqual(decrireValeursObservees([Object.assign(Object.create({ valeur: 1 }), { id: 'a' })]).nonResolus, ['a'], 'propriété héritée = absente : non exprimé');
  const indef = decrireValeursObservees([{ id: 'a', valeur: undefined }]);
  assert.equal(Object.hasOwn(indef.valeurs[0], 'valeur'), true, 'undefined présent : produit, non exprimé');
  assert.equal(refuse(() => decrireStructureIdentifiee([{ id: '', texte: 'a b' }])), true, 'id vide refusé aussi par decrireStructureIdentifiee');
  assert.equal(refuse(() => couvrirSequence({ elements: ['a'], plages: [{ debut: 0.5, longueur: 1, etiquette: null }] })), true, 'entier exigé : non exprimé');
});

// ============================================================================ F. DORMANCE : GARDES AMENDÉES ET INACCESSIBILITÉ
const MODULES_DECRITS = ['app/langage/sequence-plages.js', 'app/langage/structure-identifiee.js', 'app/langage/valeurs-observees.js'];
const MODULE_DESCRIPTIF = 'app/langage/descriptions-operations.js';
const PRODUCTION = fichiers(join(RACINE, 'app'));

test('F1. le SEUL fichier de production qui NOMME ces primitives (ou leurs modules) est le module descriptif ; les trois modules décrits se nomment eux-mêmes', () => {
  const fautifs = [];
  for (const f of PRODUCTION.filter((x) => /\.(js|mjs|html|webmanifest)$/.test(x))) {
    const r = rel(f);
    if (r === MODULE_DESCRIPTIF || MODULES_DECRITS.includes(r)) continue;
    if (r === 'app/langage/relations-entrees.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.61 : relations-entrees.js (registre des deux relations mécaniques) réutilise le prédicat de sequence-plages.js
    if (r === 'app/langage/episodes-de-transformation.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.69 : la vue générale dormante des épisodes importe decrireValeursObservees (retours-de-valeur.js n'est plus qu'une projection)
    if (r === 'app/langage/retours-de-valeur.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.68 : la vue dormante des retours de valeur importe decrireValeursObservees pour le constat d'égalité (jamais importée)
    if (r === 'app/langage/table-operations.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.18 : table-operations.js rend les opérations LOCALISABLES mécaniquement (importeur statique autorisé, gardé par tests/invocation-operations.test.mjs) ; elles ne sont pas utilisées par le moteur
    if (/sequence-plages|couvrirSequence|structure-identifiee|decrireStructureIdentifiee|valeurs-observees|decrireValeursObservees/.test(sansCommentaires(readFileSync(f, 'utf8')))) fautifs.push(r);
  }
  assert.deepEqual(fautifs, []);
  for (const nom of NOMS) assert.equal(CODE.includes(`'${nom}'`), true, `${nom} est nommé dans le module descriptif`);
});
test('F2. le module descriptif ne NOMME ces primitives que par `nom`, jamais par un chemin de module (il n\'importe aucun des trois modules décrits)', () => {
  for (const m of ['sequence-plages', 'structure-identifiee', 'valeurs-observees']) assert.equal(CODE.includes(m), false, m);
  for (const m of ['formes-operation', 'garantie-forme', 'registre']) assert.equal(CODE.includes(m), false, m);
});
test('F3. AUCUN fichier de production ne référence le module descriptif ni son export (hors lui-même)', () => {
  const fautifs = [];
  for (const f of PRODUCTION) {
    const r = rel(f);
    if (r === MODULE_DESCRIPTIF) continue;
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (/descriptions-operations|DESCRIPTIONS_OPERATIONS/.test(src)) fautifs.push(r);
  }
  assert.deepEqual(fautifs.sort(), ['app/langage/applications-sollicitables.js', 'app/langage/attentes-du-tour.js', 'app/langage/execution-mecanique.js', 'app/langage/execution-sollicitee.js', 'app/langage/executions-vecues.js', 'app/langage/observation-possibilites.js', 'app/langage/tick-propre.js'], /* MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : l'observation interne du tick vit dans tick-propre.js (capacite.js ne la fait plus) ; relation.js prend le catalogue du vécu projeté, pas le module descriptif */ /* // MISE À JOUR DÉLIBÉRÉE v0.63.85 (observation interne du tick, sondes X1/X2) : capacite.js passe le catalogue réel (+ DESCRIPTIONS_SOI) à l'observation interne du tick */ '// MISE À JOUR DÉLIBÉRÉE v0.63.83 : + executions-vecues.js (catalogue par défaut à enrichir des canaux). MISE À JOUR DÉLIBÉRÉE v0.63.78 (jalon 1) : + attentes-du-tour.js (catalogue par défaut transmis à la vue des issues, lecture seule). MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique.js (catalogue par défaut du déclencheur mécanique, même rôle que applications-sollicitables) ; MISE À JOUR DÉLIBÉRÉE v0.63.40 : + execution-sollicitee.js (catalogue par défaut du contrôle de conformité application ↔ catalogue, avant toute désignation) ; v0.63.16 : référenceur = l\'observation des possibilités (gardé par tests/observations-possibilites.test.mjs) ; MISE À JOUR DÉLIBÉRÉE v0.63.35 : + applications-sollicitables.js (catalogue par défaut de la fonction pure de l\'outil de sollicitation)');
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/descriptions-operations/.test(src), false, autre); }
});
test('F4. le module descriptif est INACCESSIBLE depuis le démarrage : parcours des imports statiques depuis app/main.js, ni lui, ni les modules décrits, ni le langage de formes n\'y figurent', () => {
  const vus = new Set();
  const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations|environnement-conversation|capacite|tick-propre|relation)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + environnement-conversation.js (l'émission est un acte prospectif : ce module vivant atteint la chaîne .72/.74 comme execution-sollicitee.js ; exclu du parcours au même titre) // MISE À JOUR DÉLIBÉRÉE v0.63.84 : + capacite.js (B1 : module vivant du besoin primitif, atteint depuis main.js ; il importe la chaîne .72/.74 et executions-vecues comme environnement-conversation.js ; exclu du parcours au même titre, son atteinte est gardée par tests/capacite.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.86 : + tick-propre.js, relation.js (B2 : modules vivants atteints depuis main.js ; ils importent la chaîne .72/.74 et executions-vecues via prospection-soi.js, comme capacite.js ; exclus du parcours au même titre, gardés par tests/relation.test.mjs)
  }
  assert.ok(vus.size > 20, `le parcours atteint bien l'application (${vus.size} fichiers)`);
  // v0.63.16 : le catalogue, le langage de formes et la garantie sont atteignables (via observation-possibilites.js) ; les modules décrits, non.
  for (const interdit of [...MODULES_DECRITS]) {
    assert.equal([...vus].some((f) => rel(f) === interdit), false, `${interdit} ne doit pas être atteignable`);
  }
  assert.equal([...vus].some((f) => /\.test\.|tests\//.test(rel(f))), false);
});
test('F5. CAPACITES strictement inchangée : mêmes cinq capacités, mêmes clés par entrée, gelée ; aucune primitive descriptive dans registre.js', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  assert.equal(Object.isFrozen(CAPACITES), true);
  for (const [nom, c] of Object.entries(CAPACITES)) { assert.deepEqual(Object.keys(c).sort(), ['invoquer', 'representer', 'roles'], nom); assert.equal(Object.isFrozen(c), true, nom); }
  const registre = readFileSync(join(RACINE, 'app', 'langage', 'registre.js'), 'utf8');
  assert.equal(/couvrirSequence|decrireValeursObservees|decrireStructureIdentifiee|descriptions-operations|sequence-plages|valeurs-observees|structure-identifiee/.test(registre), false);
  for (const nom of NOMS) assert.equal(nom in CAPACITES, false, nom);
});
test('F6. aucune persistance, aucune UI, aucun schéma : VERSION_BASE 15, SCHEMA_SAUVEGARDE 5 (v0.63.16), TABLES ; le module n\'écrit nulle part', async () => {
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 24); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables)
  assert.equal(sauv.SCHEMA_SAUVEGARDE, 14); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables)
  assert.equal(/indexedDB|objectStore|localStorage|\.put\(|\.add\(|\.delete\(|document\.|window\./.test(CODE), false);
});
test('F7. aucune API de consultation : pas de recherche par nom, pas de find exporté, pas de sélection ni de classement dans le module', () => {
  // MISE À JOUR DÉLIBÉRÉE v0.63.44 : le NOM de l'opération décrite « rechercherSousSuites » (une description parmi les autres, pas une API de consultation) est retiré du texte examiné ; le motif de la garde est inchangé et s'applique à tout le reste du module.
  assert.equal(/\.find\(|\.filter\(|\.sort\(|\.map\(|\.reduce\(|chercher|rechercher|selection|choisir|classer|trier|priorit|pertinen|decouvr|explor/i.test(CODE.replace("nom: 'rechercherSousSuites',", '')), false);
  assert.deepEqual(Object.keys(module), ['DESCRIPTIONS_OPERATIONS']);
});

// ============================================================================ G. v0.63.10 — LES SIX NOUVELLES DESCRIPTIONS : FORMES EXACTES
// Formes attendues, reconstruites ICI de façon indépendante du catalogue (aucune référence partagée avec lui).
const seg = () => ({ forme: 'scalaire' });
const chemin = () => ({ forme: 'collection', elements: seg() });
const couverture = () => ({ forme: 'collection', elements: chemin() });
const occurrence = () => ({
  forme: 'objet',
  champs: { chemin: chemin(), type: { forme: 'scalaire', genre: 'chaine' }, valeur: { forme: 'scalaire', peutManquer: true } },
});
const elementChemin = () => ({ forme: 'objet', champs: { chemin: chemin() } });
const ATTENDU = {
  memesCouvertures: { nom: 'memesCouvertures', entrees: { a: couverture(), b: couverture() }, sortie: { forme: 'scalaire', genre: 'booleen' } },
  normaliserCouverture: { nom: 'normaliserCouverture', entrees: { chemins: couverture() }, sortie: couverture() },
  parcourirStructure: { nom: 'parcourirStructure', entrees: { valeur: { forme: 'quelconque', peutEtreNull: true } }, sortie: { forme: 'collection', elements: occurrence() } },
  partagerCouvertures: {
    nom: 'partagerCouvertures',
    entrees: { a: couverture(), b: couverture() },
    sortie: { forme: 'objet', champs: { communs: couverture(), seulementA: couverture(), seulementB: couverture() } },
  },
  produireConstatsStructurels: {
    nom: 'produireConstatsStructurels',
    entrees: { elements: { forme: 'collection', elements: { forme: 'objet', champs: { chemin: chemin(), contenu: { forme: 'quelconque', peutEtreNull: true } } } } },
    sortie: { forme: 'collection', elements: { forme: 'objet', champs: { constat: occurrence(), couverture: couverture() } } },
  },
  resoudreCouverture: {
    nom: 'resoudreCouverture',
    entrees: { univers: { forme: 'collection', elements: elementChemin() }, couverture: couverture() },
    sortie: { forme: 'collection', elements: elementChemin() },
  },
};
test('G1. les six nouvelles descriptions ont EXACTEMENT les formes décidées (aucun champ en plus ni en moins, aucun fait en plus)', () => {
  assert.deepEqual(Object.keys(ATTENDU).sort(), [...NOMS_V06310].sort());
  for (const nom of NOMS_V06310) { const { relations, ...reste } = par(nom); assert.deepEqual(reste, ATTENDU[nom], nom); assert.equal(relations === undefined, !AVEC_RELATIONS.includes(nom), nom); } // MISE À JOUR DÉLIBÉRÉE v0.63.61 : la clé facultative `relations` est vérifiée séparément (tests/relations-entrees.test.mjs)
});
test('G2. ORDRE DES ENTRÉES : les clés de `entrees` suivent, dans l\'ordre, les paramètres de la signature réelle (lue dans la fonction), pour chacune des six', () => {
  const parametres = (f) => f.toString().match(/^function\s+\w+\(([^)]*)\)/)[1].split(',').map((x) => x.trim()).filter(Boolean);
  for (const nom of NOMS_V06310) assert.deepEqual(Object.keys(par(nom).entrees), parametres(FONCTIONS[nom]), nom);
  assert.deepEqual(Object.keys(par('memesCouvertures').entrees), ['a', 'b']);
  assert.deepEqual(Object.keys(par('partagerCouvertures').entrees), ['a', 'b']);
  assert.deepEqual(Object.keys(par('resoudreCouverture').entrees), ['univers', 'couverture']);
  assert.deepEqual(Object.keys(par('normaliserCouverture').entrees), ['chemins']);
  assert.deepEqual(Object.keys(par('parcourirStructure').entrees), ['valeur']);
  assert.deepEqual(Object.keys(par('produireConstatsStructurels').entrees), ['elements']);
  // `entrees` décrit des formes nommées : ce n'est pas un protocole d'appel (aucune fonction, aucun appel par objet n'est créé).
  assert.equal(NOMS_V06310.every((nom) => FONCTIONS[nom].length === Object.keys(par(nom).entrees).length), true, 'arité réelle = nombre d\'entrées décrites');
});
test('G3. SEGMENT = scalaire SANS genre ; ni string seul, ni number seul, ni quelconque ; aucune union, aucun tuple, aucun alias', () => {
  const segments = [];
  (function parcourir(x) {
    if (x && typeof x === 'object') {
      if (x.forme === 'collection' && x.elements && x.elements.forme === 'scalaire' && !('genre' in x.elements)) segments.push(x);
      for (const v of Object.values(x)) parcourir(v);
    }
  })(D.filter((d) => NOMS_V06310.includes(d.nom)));
  assert.equal(segments.length, 16, 'seize formes chemin dans les six nouvelles descriptions');
  for (const c of segments) assert.deepEqual(c, chemin());
  const six = JSON.stringify(D.filter((d) => NOMS_V06310.includes(d.nom)));
  for (const interdit of ['union', 'tuple', 'alias', 'ref', 'reference', '$ref', 'couverture"', 'occurrence', 'chemin"']) {
    if (interdit === 'chemin"' || interdit === 'couverture"') continue; // ce sont des NOMS DE CHAMPS ou d\'entrées, vérifiés ailleurs
    assert.equal(six.includes(`"${interdit}"`), false, interdit);
  }
  // `genre` n'apparaît dans les six que pour `type` (chaine) des occurrences et la sortie de memesCouvertures (booleen).
  const genres = [];
  for (const d of D.filter((x) => NOMS_V06310.includes(x.nom))) {
    (function parcourir(x, trace) { if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (k === 'genre') genres.push(`${d.nom}:${trace}=${v}`); parcourir(v, `${trace}.${k}`); } })(d, 'd');
  }
  assert.deepEqual(genres.sort(), [
    'memesCouvertures:d.sortie=booleen',
    'parcourirStructure:d.sortie.elements.champs.type=chaine',
    'produireConstatsStructurels:d.sortie.elements.champs.constat.champs.type=chaine',
  ]);
});
test('G4. ABSENT ≠ NULL ≠ QUELCONQUE : valeur d\'occurrence = scalaire peutManquer SANS peutEtreNull ; contenu = quelconque + peutEtreNull ; valeur de parcourirStructure = quelconque + peutEtreNull', () => {
  const occ = par('parcourirStructure').sortie.elements;
  assert.deepEqual(occ.champs.valeur, { forme: 'scalaire', peutManquer: true });
  assert.equal('peutEtreNull' in occ.champs.valeur, false, 'valeur n\'est PAS nullable');
  assert.equal('omissible' in occ.champs.valeur, false);
  assert.deepEqual(par('parcourirStructure').entrees.valeur, { forme: 'quelconque', peutEtreNull: true });
  assert.deepEqual(par('produireConstatsStructurels').entrees.elements.elements.champs.contenu, { forme: 'quelconque', peutEtreNull: true });
  const constat = par('produireConstatsStructurels').sortie.elements.champs.constat;
  assert.deepEqual(constat.champs.valeur, { forme: 'scalaire', peutManquer: true });
  assert.deepEqual(Object.keys(occ.champs), ['chemin', 'type', 'valeur']);
});
test('G5. UNIVERS DE resoudreCouverture : seulement { chemin } (ni type, ni valeur) ; la sortie n\'est pas enrichie ; ce n\'est pas une occurrence complète', () => {
  const d = par('resoudreCouverture');
  assert.deepEqual(Object.keys(d.entrees.univers.elements.champs), ['chemin']);
  assert.deepEqual(Object.keys(d.sortie.elements.champs), ['chemin']);
  assert.notDeepEqual(d.entrees.univers.elements, par('parcourirStructure').sortie.elements);
  const sources = JSON.stringify(d);
  assert.equal(sources.includes('"type"') || sources.includes('"valeur"'), false);
});
test('G6. partagerCouvertures : exactement { communs, seulementA, seulementB }, trois couvertures, aucun champ supplémentaire ; memesCouvertures : booléen', () => {
  const d = par('partagerCouvertures');
  assert.deepEqual(Object.keys(d.sortie.champs), ['communs', 'seulementA', 'seulementB']);
  for (const c of Object.values(d.sortie.champs)) assert.deepEqual(c, couverture());
  assert.deepEqual(par('memesCouvertures').sortie, { forme: 'scalaire', genre: 'booleen' });
});
test('G7. rien de comportemental n\'est décrit : ni canonicalisation, ni doublon, ni ordre, ni unicité, ni validation (aucun fait ni mot de ce vocabulaire dans les six)', () => {
  const six = JSON.stringify(D.filter((d) => NOMS_V06310.includes(d.nom)));
  for (const mot of ['canon', 'doublon', 'ordre', 'unique', 'unicite', 'valid', 'trie', 'json', 'compatible']) assert.equal(new RegExp(mot, 'i').test(six), false, mot);
});

// ============================================================================ H. DUPLICATION LITTÉRALE MESURÉE (acceptée, jamais réduite par un mécanisme)
test('H1. DUPLICATION MESURÉE : 103 formes dans le catalogue, 16 chemins, 11 couvertures, 2 occurrences complètes — répétés littéralement, sans aucune référence partagée', () => {
  const egal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let formes = 0; let chemins = 0; let couvertures = 0; let occurrences = 0;
  (function parcourir(x) {
    if (x && typeof x === 'object') {
      if (!Array.isArray(x) && typeof x.forme === 'string') {
        formes += 1;
        if (egal(x, chemin())) chemins += 1;
        if (egal(x, couverture())) couvertures += 1;
        if (egal(x, occurrence())) occurrences += 1;
      }
      for (const v of Object.values(x)) parcourir(v);
    }
  })(D);
  // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 100 → 103 formes (symbolesDeChaine : entrée scalaire, sortie collection, éléments scalaires). Aucune des trois ne coïncide avec chemin, couverture ou occurrence : 16 / 11 / 2 inchangés.
  assert.deepEqual({ formes, chemins, couvertures, occurrences }, { formes: 183, chemins: 36, couvertures: 16, occurrences: 2 }); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 180 → 183 formes (composerCollection : entrée collection, éléments scalaires, sortie scalaire ; aucune ne coïncide avec chemin, couverture ou occurrence) // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 165 → 180 formes, 31 → 36 chemins, 15 → 16 couvertures (+ resoudreElements, mesuré) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 158 → 165 formes, 29 → 31 chemins, 14 → 15 couvertures (+ projeterChemins, mesuré) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 140 → 158 formes, 24 → 29 chemins, 13 → 14 couvertures (+ rechercherSousSuites : 18 formes ; aucune occurrence complète) ; MISE À JOUR DÉLIBÉRÉE v0.63.43 : 133 → 140 formes, 22 → 24 chemins, 12 → 13 couvertures (+ projeterContenus : 7 formes dont 2 collections de scalaire sans genre et 1 collection de collections de scalaire ; aucune occurrence complète) ; MISE À JOUR DÉLIBÉRÉE v0.63.42 : 114 → 133 formes (+ produireSuitesFermees : 19 formes dont 5 chemins et 1 couverture), chemins 17 → 22, couvertures 11 → 12 ; // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 103 → 114 formes (+ elementsObservables : 11 formes dont un chemin), chemins 16 → 17
  const tous = noeuds(D);
  assert.equal(new Set(tous).size, tous.length, 'chaque copie est un objet distinct');
});
test('H2. le langage de formes ne reçoit AUCUN nom `chemin`, `couverture`, `occurrence` : ces mots ne sont que des noms de champs / d\'entrées du catalogue ; la forme d\'un chemin et d\'une couverture est celle d\'une collection', () => {
  // Aucune forme « chemin », « couverture » ou « occurrence » n'existe dans le langage : le validateur les rejette comme formes inconnues.
  for (const nom of ['chemin', 'couverture', 'occurrence', 'union', 'tuple', 'alias', 'reference']) {
    assert.throws(() => valider({ nom: 'x', entrees: { a: { forme: nom } }, sortie: { forme: 'quelconque' } }), TypeError, nom);
  }
  // Identité structurelle ≠ identité de concept : un chemin et un autre champ collection de scalaires ont la même forme.
  assert.equal(fournieGarantitAttendue(chemin(), par('decrireStructureIdentifiee').sortie.champs.couverture), false, 'collection de scalaire sans genre ne garantit pas une collection de chaînes');
  assert.equal(fournieGarantitAttendue(par('decrireStructureIdentifiee').sortie.champs.couverture, chemin()), true, 'une collection de chaînes garantit structurellement un chemin : coïncidence de forme, pas de concept');
});

// ============================================================================ I. COMPATIBILITÉS STRUCTURELLES (TESTS SEULEMENT, aucun sélecteur de champ en production)
const sortieDe = (nom) => par(nom).sortie;
const entreeDe = (nom, cle) => par(nom).entrees[cle];
const champDe = (nom, ...cles) => cles.reduce((f, c) => f.champs[c], par(nom).sortie);
test('I1. normaliserCouverture.sortie → memesCouvertures.a/b → partagerCouvertures.a/b → resoudreCouverture.couverture : garantie VRAIE', () => {
  const s = sortieDe('normaliserCouverture');
  for (const [op, cle] of [['memesCouvertures', 'a'], ['memesCouvertures', 'b'], ['partagerCouvertures', 'a'], ['partagerCouvertures', 'b'], ['resoudreCouverture', 'couverture']]) {
    assert.equal(fournieGarantitAttendue(s, entreeDe(op, cle)), true, `${op}.${cle}`);
  }
  assert.equal(fournieGarantitAttendue(s, entreeDe('normaliserCouverture', 'chemins')), true);
});
test('I2. parcourirStructure.sortie → resoudreCouverture.univers : garantie VRAIE (l\'occurrence porte au moins `chemin`) ; l\'inverse est FAUX (un univers { chemin } ne garantit pas type)', () => {
  assert.equal(fournieGarantitAttendue(sortieDe('parcourirStructure'), entreeDe('resoudreCouverture', 'univers')), true);
  const occurrenceAttendue = { forme: 'collection', elements: { forme: 'objet', champs: { chemin: chemin(), type: { forme: 'scalaire', genre: 'chaine' } } } };
  assert.equal(fournieGarantitAttendue(entreeDe('resoudreCouverture', 'univers'), occurrenceAttendue), false, 'un univers { chemin } ne garantit pas un type');
  assert.equal(fournieGarantitAttendue(sortieDe('resoudreCouverture'), occurrenceAttendue), false, 'la sortie de resoudre ne garantit pas des occurrences complètes');
  assert.equal(fournieGarantitAttendue(occurrenceAttendue, entreeDe('resoudreCouverture', 'univers')), true);
});
test('I3. CHAMPS communs / seulementA / seulementB → normaliserCouverture.chemins : VRAI ; la SORTIE ENTIÈRE de partagerCouvertures n\'est PAS une couverture : FAUX', () => {
  for (const cle of ['communs', 'seulementA', 'seulementB']) assert.equal(fournieGarantitAttendue(champDe('partagerCouvertures', cle), entreeDe('normaliserCouverture', 'chemins')), true, cle);
  assert.equal(fournieGarantitAttendue(sortieDe('partagerCouvertures'), entreeDe('normaliserCouverture', 'chemins')), false);
});
test('I4. champ couverture d\'un élément de produireConstatsStructurels.sortie → partagerCouvertures.a/b : VRAI ; la sortie entière : FAUX ; le langage SAIT représenter, il ne sait pas SÉLECTIONNER un champ', () => {
  const champCouverture = sortieDe('produireConstatsStructurels').elements.champs.couverture;
  for (const cle of ['a', 'b']) {
    assert.equal(fournieGarantitAttendue(champCouverture, entreeDe('partagerCouvertures', cle)), true, cle);
    assert.equal(fournieGarantitAttendue(sortieDe('produireConstatsStructurels'), entreeDe('partagerCouvertures', cle)), false, cle);
  }
  assert.equal(fournieGarantitAttendue(sortieDe('memesCouvertures'), entreeDe('partagerCouvertures', 'a')), false, 'un booléen n\'est pas une couverture');
});
test('I5. le contenu opaque : `quelconque` attend toute forme (sous réserve de null, R0) ; une fournie `quelconque` ne garantit rien de plus précis ; null ne passe que si l\'attendue le déclare', () => {
  const contenu = entreeDe('produireConstatsStructurels', 'elements').elements.champs.contenu;
  const valeur = entreeDe('parcourirStructure', 'valeur');
  assert.equal(fournieGarantitAttendue({ forme: 'scalaire', genre: 'chaine' }, valeur), true);
  assert.equal(fournieGarantitAttendue(chemin(), valeur), true);
  assert.equal(fournieGarantitAttendue({ forme: 'quelconque' }, contenu), true);
  assert.equal(fournieGarantitAttendue({ forme: 'quelconque', peutEtreNull: true }, contenu), true);
  assert.equal(fournieGarantitAttendue({ forme: 'quelconque', peutEtreNull: true }, { forme: 'quelconque' }), false, 'null possible face à une attendue non nullable');
  assert.equal(fournieGarantitAttendue({ forme: 'quelconque' }, { forme: 'scalaire' }), false, 'une valeur non contrainte ne garantit pas un scalaire');
});

// ============================================================================ J. HONNÊTETÉ SUR VALEURS RÉELLES (même oracle de conformité que pour les trois premières)
const entrees = (nom, ...vals) => Object.keys(par(nom).entrees).map((cle, i) => [cle, vals[i]]);
function entreeConforme(nom, ...vals) {
  const v = [];
  for (const [cle, valeur] of entrees(nom, ...vals)) {
    const forme = par(nom).entrees[cle];
    if (valeur === null) { if (forme.peutEtreNull !== true) v.push(`${nom}.${cle}: null refusé par la description`); continue; }
    v.push(...conformite(valeur, forme, `${nom}.${cle}`));
  }
  return v;
}
test('J1. entrées RÉELLES acceptées par la fonction ET par la description : chemin racine [], chemins chaîne et nombre, couverture vide [], contenu null, -0', () => {
  const couvertures = [[], [[]], [['a']], [['a', 0], ['b', 12], [0], ['0']], [[-0]], [[''], ['a', 'b', 'c']]];
  for (const c of couvertures) {
    assert.deepEqual(entreeConforme('normaliserCouverture', c), [], JSON.stringify(c));
    assert.doesNotThrow(() => normaliserCouverture(c));
    assert.deepEqual(entreeConforme('memesCouvertures', c, c), []);
    assert.doesNotThrow(() => memesCouvertures(c, c));
    assert.deepEqual(entreeConforme('partagerCouvertures', c, c), []);
    assert.doesNotThrow(() => partagerCouvertures(c, c));
    assert.deepEqual(entreeConforme('resoudreCouverture', c.map((x) => ({ chemin: x })), c), []);
    assert.doesNotThrow(() => resoudreCouverture(c.map((x) => ({ chemin: x })), c));
  }
  const contenus = [null, 0, -0, '', 'x', true, [], {}, [1, null, { a: [] }], { a: { b: [null] } }];
  for (const contenu of contenus) {
    assert.deepEqual(entreeConforme('parcourirStructure', contenu), [], String(contenu));
    assert.doesNotThrow(() => parcourirStructure(contenu));
    const elements = [{ chemin: [], contenu }, { chemin: [0], contenu: null }];
    assert.deepEqual(entreeConforme('produireConstatsStructurels', elements), []);
    assert.doesNotThrow(() => produireConstatsStructurels(elements));
  }
});
test('J2. sorties RÉELLES conformes : occurrence avec valeur et sans valeur, contenu null, -0, partition avec parties vides, couverture vide, résultat de resoudre avec champs supplémentaires (passage des références)', () => {
  const verifier = (nom, sortie) => assert.deepEqual(conformite(sortie, par(nom).sortie, nom), [], nom);
  const occ = parcourirStructure({ a: [1, 'x', true, null, -0], b: {}, c: '' });
  verifier('parcourirStructure', occ);
  assert.equal(occ.some((o) => Object.hasOwn(o, 'valeur')), true);
  assert.equal(occ.some((o) => !Object.hasOwn(o, 'valeur')), true);
  verifier('parcourirStructure', parcourirStructure(null));
  verifier('parcourirStructure', parcourirStructure(-0));
  verifier('normaliserCouverture', normaliserCouverture([]));
  verifier('normaliserCouverture', normaliserCouverture([[], ['a', 0], [-0]].slice(0, 2)));
  verifier('memesCouvertures', memesCouvertures([], []));
  verifier('memesCouvertures', memesCouvertures([['a']], [['b']]));
  for (const [a, b] of [[[], []], [[['a']], [['a']]], [[['a']], []], [[], [['a']]], [[['a'], ['b']], [['b'], ['c']]]]) verifier('partagerCouvertures', partagerCouvertures(a, b));
  const partage = partagerCouvertures([['a']], [['a']]);
  assert.deepEqual([partage.seulementA, partage.seulementB], [[], []], 'parties vides');
  const univers = parcourirStructure({ a: 1, b: [null] });
  const resolu = resoudreCouverture(univers, univers.map((o) => o.chemin));
  verifier('resoudreCouverture', resolu);
  assert.equal(resolu.some((o) => 'type' in o), true, 'les références originales (avec type) sont rendues : objets ouverts, champs supplémentaires tolérés');
  assert.equal(resolu.every((o) => univers.includes(o)), true);
  verifier('resoudreCouverture', resoudreCouverture(univers, []));
  const constats = produireConstatsStructurels([{ chemin: ['p'], contenu: { a: null, b: -0 } }, { chemin: [], contenu: null }]);
  verifier('produireConstatsStructurels', constats);
  assert.equal(constats.some((c) => Object.hasOwn(c.constat, 'valeur')), true);
  assert.equal(constats.some((c) => !Object.hasOwn(c.constat, 'valeur')), true);
  verifier('produireConstatsStructurels', produireConstatsStructurels([]));
});
test('J3. une sortie mal formée est REFUSÉE par chaque description (le lien test ↔ forme n\'est pas décoratif) : valeur null, type absent, champ de partition manquant ou en trop (champ en trop non détecté : objets ouverts), segment objet', () => {
  const faux = (nom, sortie) => assert.ok(conformite(sortie, par(nom).sortie, nom).length > 0, `${nom} ${JSON.stringify(sortie)}`);
  faux('parcourirStructure', [{ chemin: [], type: 'nul', valeur: null }]);
  faux('parcourirStructure', [{ chemin: [] }]);
  faux('parcourirStructure', [{ type: 'nul' }]);
  faux('parcourirStructure', [{ chemin: [{}], type: 'nul' }]);
  faux('parcourirStructure', [{ chemin: [], type: 3 }]);
  faux('partagerCouvertures', { communs: [], seulementA: [] });
  faux('partagerCouvertures', { communs: [], seulementA: [], seulementB: {} });
  faux('partagerCouvertures', { communs: [[]], seulementA: [], seulementB: [['a'], 'x'] });
  faux('memesCouvertures', 1);
  faux('normaliserCouverture', [['a'], 'b']);
  faux('resoudreCouverture', [{ type: 'x' }]);
  faux('produireConstatsStructurels', [{ constat: { chemin: [], type: 'nul' } }]);
  faux('produireConstatsStructurels', [{ couverture: [] }]);
  // Les objets sont OUVERTS : une clé en plus est tolérée par la conformité (la clôture des clés est contrôlée par contrats-observes).
  assert.deepEqual(conformite({ communs: [], seulementA: [], seulementB: [], extra: 1 }, par('partagerCouvertures').sortie), []);
});

// ============================================================================ K. APPROXIMATIONS CONSERVÉES (testées, NON corrigées)
test('K1. SEGMENT : la description sur-accepte booléen, négatif, non-entier, NaN, Infinity ; la fonction les REFUSE (approximation connue, non corrigée)', () => {
  const refuse = (f) => { try { f(); return false; } catch (e) { return e instanceof TypeError; } };
  for (const mauvais of [true, false, -1, 1.5, NaN, Infinity]) {
    assert.deepEqual(entreeConforme('normaliserCouverture', [[mauvais]]), [], `la description accepte ${String(mauvais)}`);
    assert.equal(refuse(() => normaliserCouverture([[mauvais]])), true, `la fonction refuse ${String(mauvais)}`);
  }
  assert.equal(entreeConforme('normaliserCouverture', [[{}]]).length > 0, true, 'un objet n\'est pas un segment : refusé aussi par la description');
  assert.equal(entreeConforme('normaliserCouverture', [[[]]]).length > 0, true, 'un tableau n\'est pas un segment : refusé aussi par la description');
  assert.equal(entreeConforme('normaliserCouverture', [[null]]).length > 0, true, 'null n\'est pas un segment (aucun fait sur un élément)');
});
test('K2. UNICITÉ des chemins : doublons acceptés par la description, refusés par la fonction (non exprimé)', () => {
  const refuse = (f) => { try { f(); return false; } catch (e) { return e instanceof TypeError; } };
  assert.deepEqual(entreeConforme('normaliserCouverture', [['a'], ['a']]), []);
  assert.equal(refuse(() => normaliserCouverture([['a'], ['a']])), true);
  assert.equal(refuse(() => normaliserCouverture([[0], [-0]])), true, '0 et -0 sont une même identité : doublon');
});
test('K3. CONTENU quelconque + nullable : la description sur-accepte NaN, Date, fonction, bigint, Symbol ; parcourirStructure les refuse', () => {
  const refuse = (f) => { try { f(); return false; } catch (e) { return e instanceof TypeError; } };
  for (const mauvais of [NaN, Infinity, new Date(0), () => 1, 10n, Symbol('s')]) {
    assert.equal(refuse(() => parcourirStructure(mauvais)), true, String(typeof mauvais));
  }
  assert.deepEqual(conformite(NaN, par('parcourirStructure').entrees.valeur), [], 'quelconque accepte toute valeur définie : structure non contrainte ici');
  assert.equal(refuse(() => parcourirStructure(undefined)), true, 'undefined refusé des deux côtés');
  assert.ok(conformite(undefined, par('parcourirStructure').entrees.valeur).length > 0);
});
test('K4. `valeur` conditionnelle au type, propriétés propres / accesseurs / cycles, et « undefined présent » : NON exprimés ; l\'occurrence d\'un objet ne porte pas de valeur mais la description ne l\'impose pas', () => {
  const occ = parcourirStructure({ a: 1 });
  const objet = occ.find((o) => o.type !== 'nombre' && o.type !== 'chaine' && o.type !== 'booleen');
  assert.ok(objet && !Object.hasOwn(objet, 'valeur'));
  assert.deepEqual(conformite([{ chemin: [], type: 'objet', valeur: 'x' }], par('parcourirStructure').sortie), [], 'une valeur sur un objet serait acceptée par la description (conditionnel au type non exprimé)');
  const refuse = (f) => { try { f(); return false; } catch (e) { return e instanceof TypeError; } };
  const accesseur = { get chemin() { return []; }, contenu: 1 };
  assert.equal(refuse(() => produireConstatsStructurels([accesseur])), true, 'accesseur refusé par la fonction');
  assert.deepEqual(entreeConforme('produireConstatsStructurels', [accesseur]), [], 'accepté par la description : non exprimé');
  const cycle = {}; cycle.a = cycle;
  assert.equal(refuse(() => parcourirStructure(cycle)), true, 'cycle refusé par la fonction');
  assert.deepEqual(entreeConforme('parcourirStructure', cycle), [], 'accepté par la description : non exprimé');
  assert.equal(refuse(() => produireConstatsStructurels([{ chemin: [], contenu: undefined }])), true, 'undefined présent refusé');
});

// ============================================================================ L. DORMANCE v0.63.10 : le catalogue n'a franchi QUE le niveau A
const MODULES_SIX = ['parcours-structure', 'couverture-occurrences', 'resolution-couverture', 'constats-structurels', 'partition-couvertures'];
test('L1. le catalogue n\'importe aucune des six fonctions ni aucun de leurs modules, ne contient aucune fonction, et son code ne nomme aucun module', () => {
  for (const m of MODULES_SIX) assert.equal(CODE.includes(m), false, m);
  assert.equal(/^\s*import\b/m.test(CODE), false);
  for (const nom of NOMS_V06310) assert.equal(CODE.includes(`nom: '${nom}'`), true, nom);
  for (const nom of NOMS_V06310) assert.equal(new RegExp(`function\\s+${nom}\\b|=>|\\b${nom}\\s*\\(`).test(CODE), false, nom);
});
test('L2. les six modules décrits ne référencent pas le catalogue ; aucun fichier de production autre que le catalogue ne NOMME les six primitives ; aucun fichier de production ne référence le catalogue', () => {
  const fautifs = [];
  const modules = MODULES_SIX.map((m) => `app/langage/${m}.js`);
  const exceptions = new Set([MODULE_DESCRIPTIF, ...modules, 'app/langage/tick-propre.js', /* MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : le tick (observation interne, catalogue réel + DESCRIPTIONS_SOI) vit dans tick-propre.js */ 'app/langage/capacite.js', /* // MISE À JOUR DÉLIBÉRÉE v0.63.85 (observation interne du tick, sondes X1/X2) : capacite.js passe le catalogue réel (+ DESCRIPTIONS_SOI) à l'observation interne du tick */ 'app/langage/relations-parent-enfant.js', 'app/langage/table-operations.js', 'app/langage/constats-valeurs.js', 'app/langage/suites-fermees.js', 'app/langage/resoudre-elements.js', 'app/langage/relations-entrees.js', 'app/langage/constats-par-chemin.js', 'app/langage/contexte-prospectif.js', 'app/langage/issue-contexte-prospectif.js', 'app/langage/consequences-emissions.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions, issu de l'expérience d'autonomie 03) : + consequences-emissions.js (vue pure dormante des conséquences déclarées des émissions ; importe normaliserCouverture) */, 'app/langage/attentes-prospectives.js', 'app/langage/issue-attente-prospective.js', 'app/langage/experiences-attentes.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.76 : + experiences-attentes.js (vue pure dormante : les issues d'attentes comme collection d'expériences ; importe issue-attente-prospective et couverture-occurrences (normaliserCouverture)) // MISE À JOUR DÉLIBÉRÉE v0.63.75 : + issue-attente-prospective.js (vue pure dormante : issue d'une attente prospective ; importe couverture-occurrences (memesCouvertures), constats-structurels (memesConstats), issue-contexte-prospectif) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : + attentes-prospectives.js (calcul pur des attentes A = B, appelé par execution-sollicitee.js avant l'issue ; importe couverture-occurrences, constats-structurels (memesConstats), constats-par-chemin, issue-contexte-prospectif) // MISE À JOUR DÉLIBÉRÉE v0.63.73 : + issue-contexte-prospectif.js (vue pure dormante : issue d'un contexte prospectif ; importe parcourirStructure, couverture-occurrences, constats-structurels) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : + contexte-prospectif.js (calcul pur du contenu prospectif, appelé par execution-sollicitee.js avant l'issue ; importe parcourirStructure, couverture-occurrences et constats-par-chemin) // MISE À JOUR DÉLIBÉRÉE v0.63.71 : + constats-par-chemin.js (vue dormante : regroupe les constats structurels par chemin ; importe constats-structurels.js et couverture-occurrences.js) // MISE À JOUR DÉLIBÉRÉE v0.63.61 : + relations-entrees.js (registre relationnel, importe resolution-couverture.js) // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudre-elements.js (fonction propre, importe resolution-couverture.js pour réutiliser la résolution) // MISE À JOUR DÉLIBÉRÉE v0.63.32 : + suites-fermees.js (observateur de suites dormant, importe ces primitives) ; MISE À JOUR DÉLIBÉRÉE v0.63.29 : + constats-valeurs.js ; MISE À JOUR DÉLIBÉRÉE v0.63.18 : table-operations.js rend les opérations LOCALISABLES mécaniquement (importeur statique autorisé, gardé par tests/invocation-operations.test.mjs) ; elles ne sont pas utilisées par le moteur. // v0.63.11 : importeur de couverture-occurrences, non décrit au catalogue (gardé par tests/relations-parent-enfant.test.mjs)
  for (const f of PRODUCTION.filter((x) => /\.(js|mjs|html|webmanifest)$/.test(x))) {
    const r = rel(f);
    const src = sansCommentaires(readFileSync(f, 'utf8'));
    if (/descriptions-operations|DESCRIPTIONS_OPERATIONS/.test(src) && r !== MODULE_DESCRIPTIF && r !== 'app/langage/observation-possibilites.js' && r !== 'app/langage/applications-sollicitables.js' && r !== 'app/langage/execution-sollicitee.js' && r !== 'app/langage/execution-mecanique.js' && r !== 'app/langage/tick-propre.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : catalogue réel (+ DESCRIPTIONS_SOI) passé à l'observation interne du tick, désormais dans tick-propre.js */ && r !== 'app/langage/attentes-du-tour.js' /* MISE À JOUR DÉLIBÉRÉE v0.63.78 (jalon 1) : catalogue par défaut de la présentation des attentes */ && r !== 'app/langage/executions-vecues.js' /* // MISE À JOUR DÉLIBÉRÉE v0.63.83 : catalogue par défaut des exécutions vécues */) fautifs.push(`${r} référence le catalogue`); // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique.js (catalogue par défaut du déclencheur) ; MISE À JOUR DÉLIBÉRÉE v0.63.40 : + execution-sollicitee.js (catalogue par défaut du contrôle de conformité) ; v0.63.16 : + observation-possibilites.js ; MISE À JOUR DÉLIBÉRÉE v0.63.35 : + applications-sollicitables.js
    if (!exceptions.has(r) && /parcourirStructure|normaliserCouverture|memesCouvertures|resoudreCouverture|produireConstatsStructurels|partagerCouvertures|parcours-structure|couverture-occurrences|resolution-couverture|constats-structurels|partition-couvertures/.test(src)) fautifs.push(`${r} nomme une primitive`);
  }
  assert.deepEqual(fautifs, []);
});
test('L3. les six modules décrits sont INACCESSIBLES depuis app/main.js (ni eux, ni le catalogue) : aucune nouvelle opération atteignable', () => {
  const vus = new Set();
  const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop();
    if (vus.has(f)) continue;
    vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations|environnement-conversation|capacite|tick-propre|relation)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + environnement-conversation.js (l'émission est un acte prospectif : ce module vivant atteint la chaîne .72/.74 comme execution-sollicitee.js ; exclu du parcours au même titre) // MISE À JOUR DÉLIBÉRÉE v0.63.84 : + capacite.js (B1 : module vivant du besoin primitif, atteint depuis main.js ; il importe la chaîne .72/.74 et executions-vecues comme environnement-conversation.js ; exclu du parcours au même titre, son atteinte est gardée par tests/capacite.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.86 : + tick-propre.js, relation.js (B2 : modules vivants atteints depuis main.js ; ils importent la chaîne .72/.74 et executions-vecues via prospection-soi.js, comme capacite.js ; exclus du parcours au même titre, gardés par tests/relation.test.mjs)
  }
  for (const m of MODULES_SIX) assert.equal([...vus].some((f) => rel(f) === `app/langage/${m}.js`), false, m);
  assert.equal([...vus].some((f) => rel(f) === MODULE_DESCRIPTIF), true, 'v0.63.16 : le catalogue est atteignable, uniquement via observation-possibilites.js');
});
test('L4. aucune consultation, aucun lookup, aucune sélection : le seul export reste le tableau ; CAPACITES ne contient aucune des six', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(module), ['DESCRIPTIONS_OPERATIONS']);
  for (const nom of NOMS_V06310) assert.equal(nom in CAPACITES, false, nom);
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  const registre = readFileSync(join(RACINE, 'app', 'langage', 'registre.js'), 'utf8');
  assert.equal(/parcourirStructure|normaliserCouverture|memesCouvertures|resoudreCouverture|produireConstatsStructurels|partagerCouvertures/.test(registre), false);
});
test('L5. ordre du catalogue = ordre code-unit par nom, SANS signification : aucune autre clé d\'ordre ; dix noms, tous uniques', () => {
  const noms = D.map((d) => d.nom);
  assert.equal(noms.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.deepEqual([...noms].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), noms);
  for (const d of D) assert.deepEqual(Object.keys(d), clesAttendues(d)); // MISE À JOUR DÉLIBÉRÉE v0.63.61 : + clé facultative `relations` pour trois opérations
});

// ============================================================================ M. symbolesDeChaine (v0.63.38)
const SDC = D.find((d) => d.nom === 'symbolesDeChaine');
test('M1. symbolesDeChaine : forme exacte du descripteur (une entrée « chaine » scalaire chaîne ; sortie collection de scalaires chaîne) et validité', () => {
  assert.deepEqual(SDC, {
    nom: 'symbolesDeChaine',
    entrees: { chaine: { forme: 'scalaire', genre: 'chaine' } },
    sortie: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } },
  });
  assert.doesNotThrow(() => valider(SDC));
  assert.equal(Object.isFrozen(SDC) && Object.isFrozen(SDC.entrees.chaine) && Object.isFrozen(SDC.sortie.elements), true);
});
test('M2. le nom de l\'entrée est le nom réel du paramètre de la fonction (lu dans la signature)', () => {
  const signature = /export function symbolesDeChaine\(([^)]*)\)/.exec(readFileSync(join(RACINE, 'app', 'langage', 'symboles-de-chaine.js'), 'utf8'));
  assert.deepEqual(signature[1].split(',').map((x) => x.trim()), Object.keys(SDC.entrees));
});
test('M3. sorties RÉELLES conformes à la sortie décrite (chaîne vide, ASCII, hors BMP, combinant, substitut isolé) ; entrées non chaînes hors description', () => {
  for (const c of ['', 'bonjour Pixel', 'a\u{1F600}b', 'e\u0301', 'x\uD800y']) assert.deepEqual(conformite(symbolesDeChaine(c), SDC.sortie), [], JSON.stringify(c));
  for (const c of [42, null, undefined, ['a'], { a: 1 }]) assert.throws(() => symbolesDeChaine(c), TypeError);
});
test('M4. compatibilités structurelles (TESTS SEULEMENT) : sa sortie fournit « collection de chaînes » ; sa sortie ne garantit ni parcourirStructure.valeur strict ni une chaîne ; rien d\'autre ne fournit une chaîne sauf ce qui est déclaré', () => {
  assert.equal(fournieGarantitAttendue(SDC.sortie, { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } }), true);
  assert.equal(fournieGarantitAttendue(SDC.sortie, SDC.entrees.chaine), false, 'une collection de chaînes n\'est pas une chaîne : aucune boucle sur elle-même');
  assert.equal(fournieGarantitAttendue(SDC.sortie, { forme: 'collection', elements: { forme: 'scalaire', genre: 'nombre' } }), false);
});
// === FIN_TEST_DESCRIPTIONS_OPERATIONS ===
