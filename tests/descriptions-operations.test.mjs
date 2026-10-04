// === DEBUT_TEST_DESCRIPTIONS_OPERATIONS ===
// v0.63.4 — ÉTAPE 6, décision ChatGPT « PREMIER ENSEMBLE RÉEL DE DESCRIPTIONS D'OPÉRATIONS » (04/10/2026). Preuves que
// app/langage/descriptions-operations.js est une DONNÉE PURE ET DORMANTE : un seul tableau, gelé en profondeur, de
// descripteurs valides, sans fonction ni chemin ni dispatch, nommé par aucun autre fichier de production, importé par
// personne, inaccessible depuis le démarrage de l'application, et HONNÊTE (le lien avec les vraies fonctions n'existe
// qu'ici, en test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/descriptions-operations.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { couvrirSequence } from '../app/langage/sequence-plages.js';
import { decrireStructureIdentifiee } from '../app/langage/structure-identifiee.js';
import { decrireValeursObservees } from '../app/langage/valeurs-observees.js';
import { CONTRATS, DESCRIPTIONS, conformite, produireScenarios } from './contrats-observes.mjs';

const RACINE = join(import.meta.dirname, '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'descriptions-operations.js');
const SOURCE = readFileSync(CHEMIN, 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const D = module.DESCRIPTIONS_OPERATIONS;
const NOMS = ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees'];
const FONCTIONS = { couvrirSequence, decrireStructureIdentifiee, decrireValeursObservees };

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
test('A1. UN seul export, un tableau de trois descripteurs', () => {
  assert.deepEqual(Object.keys(module), ['DESCRIPTIONS_OPERATIONS']);
  assert.equal(Array.isArray(D), true);
  assert.equal(D.length, 3);
});
test('A2. chaque élément EST directement un descripteur { nom, entrees, sortie } (aucune enveloppe) identique à ce que valide la primitive du langage de formes', () => {
  for (const d of D) {
    assert.deepEqual(Object.keys(d), ['nom', 'entrees', 'sortie'], d.nom);
    assert.deepEqual(valider(d), d, `${d.nom} : validerDescripteurOperation renvoie une copie identique`);
  }
});
test('A3. noms uniques, non vides, ordre déterministe par nom en unités de code ; ce sont exactement les trois primitives retenues', () => {
  const noms = D.map((d) => d.nom);
  assert.deepEqual(noms, NOMS);
  assert.equal(new Set(noms).size, noms.length, 'noms uniques');
  for (const n of noms) assert.equal(typeof n === 'string' && n.trim().length > 0, true);
  for (let i = 1; i < noms.length; i += 1) assert.equal(noms[i - 1] < noms[i], true, `${noms[i - 1]} < ${noms[i]} (unités de code)`);
  assert.deepEqual([...noms].sort(), noms);
});
test('A4. ni catégorie, ni id distinct, ni version, ni priorité, ni poids, ni fonction, ni chemin, ni clé de dispatch : le vocabulaire des clés reste celui du langage de formes', () => {
  for (const d of D) assert.deepEqual(Object.keys(d), ['nom', 'entrees', 'sortie']);
  const interdites = ['categorie', 'category', 'identifiant', 'version', 'priorite', 'poids', 'ordre', 'rang', 'score', 'fonction', 'module', 'chemin', 'dispatch', 'invoquer', 'representer', 'callback', 'roles', 'undefined'];
  for (const d of D) for (const c of cles(d)) assert.equal(interdites.includes(c), false, `${d.nom} : clé interdite « ${c} »`);
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
  assert.deepEqual(fautifs, []);
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
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) pile.push(resolve(dirname(f), m[1] || m[2]));
  }
  assert.ok(vus.size > 20, `le parcours atteint bien l'application (${vus.size} fichiers)`);
  for (const interdit of [MODULE_DESCRIPTIF, ...MODULES_DECRITS, 'app/langage/formes-operation.js', 'app/langage/garantie-forme.js']) {
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
test('F6. aucune persistance, aucune UI, aucun schéma : VERSION_BASE 14, SCHEMA_SAUVEGARDE 4, TABLES inchangées ; le module n\'écrit nulle part', async () => {
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 14);
  assert.equal(sauv.SCHEMA_SAUVEGARDE, 4);
  assert.equal(/indexedDB|objectStore|localStorage|\.put\(|\.add\(|\.delete\(|document\.|window\./.test(CODE), false);
});
test('F7. aucune API de consultation : pas de recherche par nom, pas de find exporté, pas de sélection ni de classement dans le module', () => {
  assert.equal(/\.find\(|\.filter\(|\.sort\(|\.map\(|\.reduce\(|chercher|rechercher|selection|choisir|classer|trier|priorit|pertinen|decouvr|explor/i.test(CODE), false);
  assert.deepEqual(Object.keys(module), ['DESCRIPTIONS_OPERATIONS']);
});
// === FIN_TEST_DESCRIPTIONS_OPERATIONS ===
