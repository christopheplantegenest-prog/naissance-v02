// v0.63.51 — « EMPREINTE DÉTERMINISTE DES CONTRATS D'OPÉRATIONS » (décision ChatGPT, 06/10/2026) : sha256Hex, contratCanonique, empreintesDesContrats.
// Primitives pures, synchrones, dormantes. F1 seulement : détecter une dérive de contrat, jamais reconstruire un ancien contrat.
// Aucune persistance, aucun branchement : resoudreContexteObservation et observerPossibilites ne sont pas modifiées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import * as moduleSha from '../app/langage/sha256.js';
import * as moduleEmpreinte from '../app/langage/empreinte-contrats.js';
import { sha256Hex } from '../app/langage/sha256.js';
import { contratCanonique, empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { verifierApplicationAuCatalogue } from '../app/langage/conformite-application.js';
import { preparerSousDonnees } from '../app/langage/sous-donnees.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const CODE_SHA = sansCommentaires(lu('app', 'langage', 'sha256.js'));
const CODE_EMP = sansCommentaires(lu('app', 'langage', 'empreinte-contrats.js'));
const refuse = (f) => assert.throws(f, TypeError);
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const C16 = DESCRIPTIONS_OPERATIONS;
const BASE = empreintesDesContrats(C16);
const parNom = (liste) => Object.fromEntries(liste.map((p) => [p.operation, p.empreinte]));
const EMP = parNom(BASE);
// Modifie UNE description (copie) et rend le catalogue complet.
const modifier = (nom, f, catalogue = C16) => catalogue.map((d) => { if (d.nom !== nom) return d; const c = clone(d); const r = f(c); return r === undefined ? c : r; });
// Opérations dont la paire diffère (changée, ajoutée ou retirée) entre deux catalogues.
const differences = (catalogue) => {
  const a = EMP; const b = parNom(empreintesDesContrats(catalogue));
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((nom) => a[nom] !== b[nom]).sort();
};

// ============================================================================ A. SHA-256 (vecteurs standards, indépendants du catalogue)
test('A1. VECTEURS SHA-256 standards (FIPS 180-4) : chaîne vide, "abc", message de 448 bits, message de 896 bits, un million de « a »', () => {
  assert.equal(sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(sha256Hex('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'), 'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1');
  assert.equal(sha256Hex('a'.repeat(1000000)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});
test('A2. CONFRONTATION à node:crypto (utilisé SEULEMENT dans ce test) : toutes les longueurs de 0 à 300 octets (frontières de bloc 55/56/57, 63/64/65, 119/120/121…) et quelques grandes', () => {
  for (let n = 0; n <= 300; n += 1) {
    const octets = new Uint8Array(n).map((_, i) => (i * 31 + n) & 0xff);
    assert.equal(sha256Hex(octets), createHash('sha256').update(octets).digest('hex'), `${n} octets`);
  }
  for (const n of [1000, 4095, 4096, 4097, 65536]) {
    const octets = new Uint8Array(n).map((_, i) => (i * 7 + 3) & 0xff);
    assert.equal(sha256Hex(octets), createHash('sha256').update(octets).digest('hex'), `${n} octets`);
  }
});
test('A3. CHAÎNES : encodage UTF-8 (accents, euro, émoji hors plan de base) identique à node:crypto ; chaîne et octets UTF-8 équivalents', () => {
  for (const texte of ['é', 'à la carte', '€', '😀', 'nom-é-€-😀-fin', 'ligne\nsuivante\r\n', '\u0000', '\uffff']) {
    assert.equal(sha256Hex(texte), createHash('sha256').update(texte, 'utf8').digest('hex'), JSON.stringify(texte));
    assert.equal(sha256Hex(new TextEncoder().encode(texte)), sha256Hex(texte));
  }
});
test('A4. SORTIE : 64 caractères hexadécimaux minuscules ; déterministe ; deux entrées différentes, deux empreintes', () => {
  const h = sha256Hex('contrat');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(sha256Hex('contrat'), h);
  assert.notEqual(sha256Hex('contrat '), h);
  assert.notEqual(sha256Hex('Contrat'), h);
});
test('A5. REFUS : ni nombre, ni null, ni objet, ni tableau ordinaire ; substitut UTF-16 isolé (haut ou bas) refusé ; paire valide acceptée ; Uint8Array non muté', () => {
  for (const mauvais of [undefined, null, 12, {}, [], ['a'], true, Symbol('x')]) refuse(() => sha256Hex(mauvais));
  for (const isole of ['\ud800', 'a\ud800', '\ud800a', '\udc00', 'a\udc00b', '\udc00\ud800']) refuse(() => sha256Hex(isole));
  assert.equal(sha256Hex('\ud83d\ude00'), sha256Hex('😀'));
  const octets = new Uint8Array([1, 2, 3, 4]);
  const copie = [...octets];
  sha256Hex(octets);
  assert.deepEqual([...octets], copie);
});
test('A6. un module, un export : sha256Hex ; synchrone (ne rend pas de promesse)', () => {
  assert.deepEqual(Object.keys(moduleSha), ['sha256Hex']);
  assert.equal(sha256Hex('x') instanceof Promise, false);
});

// ============================================================================ B. CANONISATION (testée SÉPARÉMENT du hachage)
test('B1. contratCanonique : chaîne JSON, clés triées à tous les niveaux (noms d\'entrées et de champs compris), indépendante de l\'ordre d\'écriture', () => {
  const a = { nom: 'op', entrees: { z: { forme: 'scalaire', genre: 'chaine' }, a: { forme: 'objet', champs: { y: { forme: 'scalaire' }, b: { forme: 'scalaire' } } } }, sortie: { forme: 'collection', elements: { forme: 'scalaire', genre: 'nombre' } } };
  const b = { sortie: { elements: { genre: 'nombre', forme: 'scalaire' }, forme: 'collection' }, entrees: { a: { champs: { b: { forme: 'scalaire' }, y: { forme: 'scalaire' } }, forme: 'objet' }, z: { genre: 'chaine', forme: 'scalaire' } }, nom: 'op' };
  const ca = contratCanonique(a);
  assert.equal(ca, contratCanonique(b));
  assert.equal(ca, '{"entrees":{"a":{"champs":{"b":{"forme":"scalaire"},"y":{"forme":"scalaire"}},"forme":"objet"},"z":{"forme":"scalaire","genre":"chaine"}},"nom":"op","sortie":{"elements":{"forme":"scalaire","genre":"nombre"},"forme":"collection"}}');
});
test('B2. FAITS D\'ENTRÉE false SUPPRIMÉS (omissible, peutEtreNull, collectif) ; faits d\'entrée true CONSERVÉS ; faits de SORTIE conservés TELS QUELS (true ET false : l\'équivalence n\'est pas démontrée côté sortie)', () => {
  const avecFaux = { nom: 'op', entrees: { a: { forme: 'scalaire', omissible: false, peutEtreNull: false }, b: { forme: 'scalaire', omissible: true, peutEtreNull: true } }, sortie: { forme: 'objet', champs: { x: { forme: 'scalaire', peutManquer: false, peutEtreNull: false }, y: { forme: 'scalaire', peutManquer: true, peutEtreNull: true } } } };
  const sansFauxEntree = { nom: 'op', entrees: { a: { forme: 'scalaire' }, b: { forme: 'scalaire', omissible: true, peutEtreNull: true } }, sortie: { forme: 'objet', champs: { x: { forme: 'scalaire', peutManquer: false, peutEtreNull: false }, y: { forme: 'scalaire', peutManquer: true, peutEtreNull: true } } } };
  assert.equal(contratCanonique(avecFaux), contratCanonique(sansFauxEntree), 'côté entrée : false = absent');
  const c = contratCanonique(avecFaux);
  assert.match(c, /"b":\{"forme":"scalaire","omissible":true,"peutEtreNull":true\}/);
  assert.match(c, /"x":\{"forme":"scalaire","peutEtreNull":false,"peutManquer":false\}/, 'côté sortie : false conservé');
  assert.match(c, /"y":\{"forme":"scalaire","peutEtreNull":true,"peutManquer":true\}/);
  const sortieSansFaux = { ...avecFaux, sortie: { forme: 'objet', champs: { x: { forme: 'scalaire' }, y: { forme: 'scalaire', peutManquer: true, peutEtreNull: true } } } };
  assert.notEqual(contratCanonique(avecFaux), contratCanonique(sortieSansFaux), 'côté sortie : false explicite != absent');
  const collectif = { forme: 'collection', collectif: false, elements: { forme: 'objet', champs: { identite: { forme: 'scalaire', genre: 'chaine' }, valeur: { forme: 'quelconque' } } } };
  const d = (e) => ({ nom: 'c', entrees: { elements: e }, sortie: { forme: 'scalaire' } });
  const sansFait = clone(collectif); delete sansFait.collectif;
  assert.equal(contratCanonique(d(collectif)), contratCanonique(d(sansFait)), 'collectif:false = entrée ordinaire = fait absent');
  assert.notEqual(contratCanonique(d({ ...collectif, collectif: true })), contratCanonique(d(sansFait)), 'collectif:true est conservé');
});
test('B3. UNIQUEMENT les faits : un NOM d\'entrée ou de champ identique à un nom de fait est conservé, et une valeur false qui n\'est pas un fait n\'est jamais supprimée', () => {
  const d = { nom: 'op', entrees: { omissible: { forme: 'scalaire' }, collectif: { forme: 'scalaire' } }, sortie: { forme: 'objet', champs: { peutManquer: { forme: 'scalaire' }, peutEtreNull: { forme: 'scalaire' } } } };
  const c = JSON.parse(contratCanonique(d));
  assert.deepEqual(Object.keys(c.entrees), ['collectif', 'omissible']);
  assert.deepEqual(Object.keys(c.sortie.champs), ['peutEtreNull', 'peutManquer']);
  const f = { nom: 'op', entrees: { a: { forme: 'scalaire' } }, sortie: { forme: 'scalaire', genre: 'booleen' } };
  assert.equal(JSON.parse(contratCanonique(f)).sortie.genre, 'booleen');
});
test('B4. la forme canonique est une description VALIDE et IDEMPOTENTE : toute description du catalogue, canonisée puis relue, se recanonise à l\'identique', () => {
  for (const d of C16) {
    const c = contratCanonique(d);
    const relue = JSON.parse(c);
    assert.doesNotThrow(() => valider(relue), d.nom);
    assert.equal(contratCanonique(relue), c, d.nom);
    assert.equal(relue.nom, d.nom);
  }
});
test('B5. aucun tableau dans un contrat canonique (aucun ordre de collection à conserver) ; noms non ASCII conservés ; le catalogue n\'est pas muté', () => {
  for (const d of C16) assert.equal(contratCanonique(d).includes('['), false, d.nom);
  assert.match(contratCanonique({ nom: 'opération-é', entrees: {}, sortie: { forme: 'scalaire' } }), /"nom":"opération-é"/);
  const gele = gelProfond(clone(C16));
  contratCanonique(gele[0]);
  assert.deepEqual(gele, C16);
});
test('B6. contratCanonique refuse ce que le validateur refuse (rien n\'est réparé) : TypeError', () => {
  for (const mauvais of [null, undefined, 'x', [], { nom: '', entrees: {}, sortie: { forme: 'scalaire' } }, { nom: ' ', entrees: {}, sortie: { forme: 'scalaire' } }, { nom: 'x', entrees: {} }, { nom: 'x', entrees: {}, sortie: { forme: 'scalaire' }, extra: 1 }, { nom: 'x', entrees: { a: { forme: 'inconnue' } }, sortie: { forme: 'scalaire' } }, { nom: 'x', entrees: { a: { forme: 'scalaire', omissible: 'oui' } }, sortie: { forme: 'scalaire' } }, { nom: 'x', entrees: { a: { forme: 'scalaire', peutManquer: true } }, sortie: { forme: 'scalaire' } }]) {
    refuse(() => contratCanonique(mauvais));
  }
});

// ============================================================================ C. CONTRAT DE LA PRIMITIVE
test('C1. SORTIE : [ { operation, empreinte } ] exactement deux clés, SHA-256 hex64 du contrat canonique, trié par nom, une paire par opération du catalogue (16)', () => {
  assert.deepEqual(Object.keys(moduleEmpreinte).sort(), ['contratCanonique', 'empreintesDesContrats']);
  assert.equal(BASE.length, 16);
  for (const p of BASE) {
    assert.deepEqual(Object.keys(p), ['operation', 'empreinte']);
    assert.match(p.empreinte, /^[0-9a-f]{64}$/);
    const d = C16.find((x) => x.nom === p.operation);
    assert.equal(p.empreinte, sha256Hex(contratCanonique(d)), `${p.operation} = SHA-256 du contrat canonique`);
  }
  const noms = BASE.map((p) => p.operation);
  assert.deepEqual(noms, [...noms].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  assert.deepEqual(noms, C16.map((d) => d.nom).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  assert.equal(new Set(BASE.map((p) => p.empreinte)).size, 16, 'seize contrats, seize empreintes');
});
test('C2. synchrone ; nouvel objet à chaque appel ; déterministe ; catalogue gelé en profondeur accepté et inchangé', () => {
  const a = empreintesDesContrats(C16); const b = empreintesDesContrats(C16);
  assert.equal(a instanceof Promise, false);
  assert.deepEqual(a, b);
  assert.notEqual(a, b); assert.notEqual(a[0], b[0]);
  const gele = gelProfond(clone(C16));
  assert.deepEqual(empreintesDesContrats(gele), a);
  assert.deepEqual(gele, C16);
});
test('C3. L\'ORDRE DU CATALOGUE n\'a aucune influence (inversé, mélangé)', () => {
  assert.deepEqual(empreintesDesContrats([...C16].reverse()), BASE);
  const melange = [...C16].sort((x, y) => (x.nom.length - y.nom.length) || (x.nom < y.nom ? 1 : -1));
  assert.deepEqual(empreintesDesContrats(melange), BASE);
});
test('C4. L\'ORDRE DES CLÉS n\'a aucune influence : chaque descripteur réécrit avec toutes ses clés inversées à tous les niveaux donne la même empreinte', () => {
  const inverse = (v) => (Array.isArray(v) ? v.map(inverse) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, inverse(v[k])])) : v);
  const renverse = C16.map(inverse);
  assert.notEqual(JSON.stringify(renverse), JSON.stringify(C16), 'les sérialisations brutes diffèrent (une empreinte naïve du JSON direct changerait)');
  assert.deepEqual(empreintesDesContrats(renverse), BASE);
});
test('C5. AJOUT D\'UNE OPÉRATION : les 16 paires anciennes sont inchangées, une seule paire nouvelle apparaît, aucune ancienne n\'est recalculée', () => {
  const N = { nom: 'longueurChaine', entrees: { chaine: { forme: 'scalaire', genre: 'chaine' } }, sortie: { forme: 'scalaire', genre: 'nombre' } };
  const apres = empreintesDesContrats([...C16, N]);
  assert.equal(apres.length, 17);
  for (const p of BASE) assert.deepEqual(apres.find((x) => x.operation === p.operation), p);
  assert.deepEqual(differences([...C16, N]), ['longueurChaine']);
  assert.equal(apres.find((x) => x.operation === 'longueurChaine').empreinte, sha256Hex(contratCanonique(N)));
});
test('C6. catalogue vide : [] ; une seule description : une paire', () => {
  assert.deepEqual(empreintesDesContrats([]), []);
  assert.equal(empreintesDesContrats([C16[0]]).length, 1);
});

// ============================================================================ D. MATRICE DES MUTATIONS (ne changent QUE l'opération concernée)
test('D1. CHANGENT l\'empreinte de l\'opération concernée, et d\'elle seule', () => {
  const cas = {
    'renommage': [modifier('resoudreElements', (d) => { d.nom = 'resoudreElements2'; }), ['resoudreElements', 'resoudreElements2']],
    'entrée ajoutée insatisfiable': [modifier('memesCouvertures', (d) => { d.entrees.c = { forme: 'scalaire', genre: 'booleen' }; }), ['memesCouvertures']],
    'entrée ajoutée avec omissible:true': [modifier('memesCouvertures', (d) => { d.entrees.c = { forme: 'scalaire', genre: 'booleen', omissible: true }; }), ['memesCouvertures']],
    'entrée existante rendue omissible': [modifier('memesCouvertures', (d) => { d.entrees.a.omissible = true; }), ['memesCouvertures']],
    'entrée réellement modifiée (forme)': [modifier('memesCouvertures', (d) => { d.entrees.a = { forme: 'quelconque' }; }), ['memesCouvertures']],
    'entrée retirée': [modifier('memesCouvertures', (d) => { delete d.entrees.b; }), ['memesCouvertures']],
    'entrée renommée': [modifier('memesCouvertures', (d) => { d.entrees.a2 = d.entrees.a; delete d.entrees.a; }), ['memesCouvertures']],
    'entrée : genre modifié': [modifier('symbolesDeChaine', (d) => { d.entrees.chaine.genre = 'nombre'; }), ['symbolesDeChaine']],
    'entrée : peutEtreNull ajouté': [modifier('memesCouvertures', (d) => { d.entrees.a.peutEtreNull = true; }), ['memesCouvertures']],
    'collectif RETIRÉ': [modifier('elementsObservables', (d) => { delete d.entrees.elements.collectif; }), ['elementsObservables']],
    'sortie modifiée visiblement': [modifier('symbolesDeChaine', (d) => { d.sortie = { forme: 'collection', elements: { forme: 'scalaire', genre: 'nombre' } }; }), ['symbolesDeChaine']],
    'sortie modifiée sans changement d\'atomes (J10)': [modifier('partagerCouvertures', (d) => { d.sortie.champs.supplementaire = { forme: 'scalaire', genre: 'nombre', peutManquer: true }; }), ['partagerCouvertures']],
    'champ de sortie devenu optionnel': [modifier('partagerCouvertures', (d) => { d.sortie.champs.communs.peutManquer = true; }), ['partagerCouvertures']],
    'champ de sortie peutEtreNull': [modifier('partagerCouvertures', (d) => { d.sortie.champs.communs.peutEtreNull = true; }), ['partagerCouvertures']],
    'champ de sortie retiré': [modifier('partagerCouvertures', (d) => { delete d.sortie.champs.seulementB; }), ['partagerCouvertures']],
    'éléments de sortie modifiés': [modifier('projeterChemins', (d) => { d.sortie.elements = { forme: 'quelconque' }; }), ['projeterChemins']],
    'opération retirée': [C16.filter((d) => d.nom !== 'resoudreElements'), ['resoudreElements']],
  };
  for (const [nom, [catalogue, attendues]] of Object.entries(cas)) assert.deepEqual(differences(catalogue), attendues, nom);
});
test('D2. COLLECTIF AJOUTÉ : la même entrée avec et sans collectif:true a deux empreintes', () => {
  const entree = { forme: 'collection', elements: { forme: 'objet', champs: { identite: { forme: 'scalaire', genre: 'chaine' }, valeur: { forme: 'scalaire', genre: 'chaine' } } } };
  const d = (e) => ({ nom: 'agreger', entrees: { elements: e }, sortie: { forme: 'scalaire', genre: 'nombre' } });
  const ordinaire = empreintesDesContrats([d(entree)])[0].empreinte;
  const collectif = empreintesDesContrats([d({ ...entree, collectif: true })])[0].empreinte;
  assert.notEqual(ordinaire, collectif);
  assert.notEqual(contratCanonique(d(entree)), contratCanonique(d({ ...entree, collectif: true })));
});
// Ajoute à chaque champ d'ENTRÉE (racine d'entrée et champs d'objet) tous les faits d'entrée valant false.
const ajouterFauxEntree = (forme, racine) => {
  if (forme.forme === 'objet' && forme.champs) for (const nom of Object.keys(forme.champs)) ajouterFauxEntree(forme.champs[nom], false);
  if (forme.forme === 'collection' && forme.elements) ajouterFauxEntree(forme.elements, null);
  if (racine === null) return; // un élément de collection ne porte aucun fait
  for (const fait of ['omissible', 'peutEtreNull']) if (!(fait in forme)) forme[fait] = false;
  if (racine === true && forme.collectif === undefined) forme.collectif = false;
};
const avecFauxEntree = (catalogue) => catalogue.map((d) => { const x = clone(d); for (const nom of Object.keys(x.entrees)) if (x.entrees[nom].collectif !== true) ajouterFauxEntree(x.entrees[nom], true); return x; });
test('D3. NE CHANGENT PAS l\'empreinte : faits d\'ENTRÉE false explicites partout où le langage les admet, ordre des clés, ordre des descripteurs', () => {
  const faux = avecFauxEntree(C16);
  assert.notEqual(JSON.stringify(faux), JSON.stringify(clone(C16)), 'des faits false ont bien été ajoutés');
  for (const d of faux) assert.doesNotThrow(() => valider(d), d.nom);
  assert.deepEqual(empreintesDesContrats(faux), BASE);
  assert.deepEqual(empreintesDesContrats([...faux].reverse()), BASE);
});
test('D3b. CHANGE l\'empreinte (prudence, faux positif assumé) : un fait de SORTIE false écrit explicitement, car il n\'est pas équivalent à son absence pour tous les consommateurs (E2)', () => {
  const derive = modifier('partagerCouvertures', (d) => { d.sortie.champs.communs.peutManquer = false; });
  assert.deepEqual(differences(derive), ['partagerCouvertures']);
});
test('D4. DISTINCTION : deux descripteurs qui ne diffèrent que par un nom d\'entrée ont des empreintes différentes (aucune collision accidentelle de la canonisation)', () => {
  const d = (nom) => ({ nom: 'op', entrees: { [nom]: { forme: 'scalaire' } }, sortie: { forme: 'scalaire' } });
  assert.notEqual(contratCanonique(d('a')), contratCanonique(d('b')));
  assert.notEqual(empreintesDesContrats([d('a')])[0].empreinte, empreintesDesContrats([d('b')])[0].empreinte);
});

// ============================================================================ E. L'ÉQUIVALENCE false = absent EST VRAIE POUR TOUS LES CONSOMMATEURS
function monde() {
  const magasin = magasinMemoireVive();
  let n = 0;
  async function tour(texte) {
    let k = (n += 1) * 100;
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    await enregistrerValeurDonnee(magasin, { id: message.id, valeur: message.texte });
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
  const lire = async () => ({ observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations'), designations: await magasin.lireTout('designations') });
  return { magasin, tour, lancer, lire };
}
async function chaine() {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: P.execution.id }]);
  const Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: H.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  const Y = await w.tour('message Y');
  await w.tour('suivant');
  return { w, A, B, P, H, Q, Y };
}
test('E1. faits d\'ENTRÉE false explicites vs absents : tous les consommateurs du dépôt se comportent identiquement (possibilités, productions décrites, applications sollicitables, conformité, sous-données α2, contexte)', async () => {
  const c = await chaine();
  const l = await c.w.lire();
  const faux = avecFauxEntree(C16);
  assert.notEqual(JSON.stringify(faux), JSON.stringify(clone(C16)));
  const O = l.observations.find((o) => o.id === c.Y.observation.id);
  const ctxBase = resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, C16);
  const ctxFaux = resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, faux);
  assert.deepEqual(ctxFaux.univers, ctxBase.univers, 'contexte reconstruit identique');
  const donnees = ctxBase.univers.map((e) => e.donnee);
  assert.deepEqual(possibilitesDeLiaison(donnees, faux), possibilitesDeLiaison(donnees, C16), 'atomes identiques');
  assert.deepEqual(productionsDecrites(l.executions, faux), productionsDecrites(l.executions, C16), 'productions décrites (formes, sous-données) identiques');
  assert.deepEqual(applicationsSollicitables(O, faux), applicationsSollicitables(O, C16), 'applications et choixAFaire identiques');
  for (const a of applicationsSollicitables(O, C16).applications) assert.doesNotThrow(() => verifierApplicationAuCatalogue(a, faux), a.operation);
  const compteur = () => { let k = 0; return (p) => `${p}-${(k += 1)}`; };
  const produit = l.executions.find((x) => x.operation === 'partagerCouvertures').resultat;
  assert.deepEqual(preparerSousDonnees(faux, 'partagerCouvertures', produit, compteur()), preparerSousDonnees(C16, 'partagerCouvertures', produit, compteur()), 'sous-données α2 identiques');
  assert.deepEqual(empreintesDesContrats(faux), BASE, 'et une seule empreinte par contrat');
});
test('E2. PREUVE POUR LA SORTIE : un fait de sortie false explicite sur un champ exposé comme sous-donnée α2 N\'EST PAS équivalent à son absence (le comportement en aval diffère), donc il n\'est pas supprimé de la forme canonique', async () => {
  const c = await chaine();
  const l = await c.w.lire();
  const derive = modifier('partagerCouvertures', (d) => { d.sortie.champs.communs.peutManquer = false; });
  assert.doesNotThrow(() => valider(derive.find((d) => d.nom === 'partagerCouvertures')), 'le descripteur est VALIDE');
  const donneesBase = productionsDecrites(l.executions, C16);
  assert.doesNotThrow(() => possibilitesDeLiaison(donneesBase, C16));
  const donneesDerive = productionsDecrites(l.executions, derive);
  assert.notDeepEqual(donneesDerive, donneesBase, 'la forme de la sous-donnée exposée porte le fait écrit');
  refuse(() => possibilitesDeLiaison(donneesDerive, derive)); // un fait à la racine d'une forme de donnée est refusé en aval
});

// ============================================================================ F. J10 ET J10b : CE QUE v0.63.50 NE VOYAIT PAS
// MISE À JOUR DÉLIBÉRÉE v0.63.53 : F1 et F2 décrivent la garantie FAIBLE v0.63.50 ; elles lisent donc des lignes de génération ANCIENNE (la preuve retirée).
// La garantie forte des lignes nouvelles est éprouvée dans tests/preuve-contrats-historiques.test.mjs.
const enAncienne = (l) => ({ ...l, observations: l.observations.map((o) => { const { empreintesOperationsExaminees, ...sans } = o; return sans; }) });
test('F1. J10 : sortie productrice modifiée sans aucun changement d\'atome — v0.63.50 rend le contexte comme fidèle, l\'empreinte de l\'opération change', async () => {
  const c = await chaine();
  const l = enAncienne(await c.w.lire());
  const derive = modifier('partagerCouvertures', (d) => { d.sortie.champs.supplementaire = { forme: 'scalaire', genre: 'nombre', peutManquer: true }; });
  const base = resoudreContexteObservation(c.Y.observation.id, l.observations, l.valeurs, l.executions, C16);
  const rendu = resoudreContexteObservation(c.Y.observation.id, l.observations, l.valeurs, l.executions, derive); // pas de refus : limite de v0.63.50
  const formeQ = (r) => r.univers.find((e) => e.donnee.identite === c.Q.execution.id).donnee.forme;
  assert.notDeepEqual(formeQ(rendu), formeQ(base), 'la forme de la production Q a changé');
  assert.deepEqual(new Set(rendu.observation.possibilites.map((p) => JSON.stringify(p))), new Set(base.observation.possibilites.map((p) => JSON.stringify(p))), 'aucun atome ne bouge');
  assert.deepEqual(differences(derive), ['partagerCouvertures'], 'l\'empreinte, elle, voit la dérive : et seulement elle');
});
test('F2. J10b (TEST CENTRAL) : entrée insatisfiable ajoutée à une opération historique — aucun atome ne change, les applications / choixAFaire changent, l\'empreinte DOIT changer', async () => {
  const c = await chaine();
  const l = enAncienne(await c.w.lire());
  const O = l.observations.find((o) => o.id === c.Y.observation.id);
  const derive = modifier('memesCouvertures', (d) => { d.entrees.c = { forme: 'scalaire', genre: 'booleen' }; });
  const univers = resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, C16).univers;
  const donnees = univers.map((e) => e.donnee);
  assert.deepEqual(possibilitesDeLiaison(donnees, derive).filter((p) => p.operation === 'memesCouvertures'), possibilitesDeLiaison(donnees, C16).filter((p) => p.operation === 'memesCouvertures'), 'aucun atome ne change (l\'entrée c n\'a aucun candidat)');
  assert.doesNotThrow(() => resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, derive), 'v0.63.50 rend le contexte comme fidèle');
  const avant = applicationsSollicitables(O, C16); const apres = applicationsSollicitables(O, derive);
  assert.equal(avant.choixAFaire.includes('memesCouvertures'), true);
  assert.equal(apres.choixAFaire.includes('memesCouvertures'), false, 'l\'ambiguïté historique disparaît avec le catalogue dérivé');
  assert.deepEqual(differences(derive), ['memesCouvertures'], 'l\'empreinte est la SEULE information qui le révèle');
});

// ============================================================================ G. REFUS DU CATALOGUE
test('G1. catalogue non tableau, tableau creux, rang accesseur : TypeError', () => {
  for (const mauvais of [undefined, null, 'x', {}, 12, new Set(), { length: 1, 0: C16[0] }]) refuse(() => empreintesDesContrats(mauvais));
  const creux = [C16[0]]; creux.length = 2;
  refuse(() => empreintesDesContrats(creux));
  const accesseur = []; Object.defineProperty(accesseur, 0, { get() { throw new Error('exécuté'); }, enumerable: true }); accesseur.length = 1;
  assert.throws(() => empreintesDesContrats(accesseur), (e) => e instanceof TypeError);
});
test('G2. descripteur invalide, nom vide ou blanc, propriété inconnue, fait invalide ou du mauvais côté, forme invalide : TypeError qui nomme le rang', () => {
  const valide = { nom: 'ok', entrees: {}, sortie: { forme: 'scalaire' } };
  const invalides = [null, 3, 'x', [], {}, { ...valide, nom: '' }, { ...valide, nom: '   ' }, { ...valide, extra: 1 }, { nom: 'ok', entrees: {} }, { ...valide, entrees: { a: { forme: 'scalaire', omissible: 1 } } }, { ...valide, entrees: { a: { forme: 'scalaire', peutManquer: false } } }, { ...valide, sortie: { forme: 'objet', champs: { a: { forme: 'scalaire', omissible: true } } } }, { ...valide, sortie: { forme: 'cube' } }, { ...valide, entrees: { a: { forme: 'collection', elements: { forme: 'scalaire', omissible: true } } } }];
  for (const mauvais of invalides) {
    assert.throws(() => empreintesDesContrats([valide, mauvais]), (e) => e instanceof TypeError && /descriptions\[1\]/.test(e.message), JSON.stringify(mauvais));
  }
});
test('G3. deux descriptions de même nom : TypeError (jamais fusionnées ni départagées), même identiques', () => {
  refuse(() => empreintesDesContrats([C16[0], C16[0]]));
  refuse(() => empreintesDesContrats([...C16, clone(C16[3])]));
  refuse(() => empreintesDesContrats([{ nom: 'x', entrees: {}, sortie: { forme: 'scalaire' } }, { nom: 'x', entrees: {}, sortie: { forme: 'scalaire', genre: 'nombre' } }]));
});

// ============================================================================ H. DORMANCE, PURETÉ, PÉRIMÈTRE
test('H1. DORMANCE : aucun fichier de app/ ne nomme ces modules ni leurs fonctions en dehors d\'eux-mêmes ; ni catalogue, ni table d\'opérations', () => {
  const sources = [];
  const parcourir = (dossier) => { for (const nom of readdirSync(dossier)) { const chemin = join(dossier, nom); if (statSync(chemin).isDirectory()) parcourir(chemin); else if (/\.(m?js|html)$/.test(nom)) sources.push(chemin); } };
  parcourir(join(RACINE, 'app'));
  const nommants = (motif) => sources.filter((f) => motif.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f).split('\\').join('/')).sort();
  assert.deepEqual(nommants(/empreinte-contrats|empreintesDesContrats|contratCanonique/), ['app/langage/contexte-observation.js', 'app/langage/empreinte-contrats.js', 'app/langage/observation-possibilites.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.53 : + contexte-observation.js (vérifie la preuve) ; v0.63.52 : observation-possibilites.js (écrit la preuve)
  // MISE À JOUR DÉLIBÉRÉE v0.63.56 : empreinte-categorie-entrees.js (primitive pure, dormante) réutilise sha256Hex (jamais réimplémenté) pour l'empreinte du
  // contrat de la catégorie « entrées d'une production ». Elle n'est importée par aucun mécanisme.
  assert.deepEqual(nommants(/\.\/sha256\.js|langage\/sha256|sha256Hex/), ['app/langage/empreinte-categorie-entrees.js', 'app/langage/empreinte-contrats.js', 'app/langage/sha256.js']);
  assert.equal(C16.length, 16);
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 16);
  assert.equal(C16.some((d) => /empreinte|sha|contrat/i.test(d.nom)), false);
});
test('H2. IMPORTS : sha256.js n\'importe rien ; empreinte-contrats.js n\'importe que formes-operation.js et sha256.js', () => {
  assert.deepEqual([...CODE_SHA.matchAll(/from '([^']+)'/g)].map((m) => m[1]), []);
  assert.deepEqual([...CODE_EMP.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./formes-operation.js', './sha256.js']);
});
test('H3. PURETÉ : ni horloge, ni hasard, ni identité générée, ni magasin, ni écriture, ni asynchronisme, ni crypto, ni état global', () => {
  for (const code of [CODE_SHA, CODE_EMP]) {
    for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'crypto', 'subtle', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'setTimeout', 'require(']) {
      assert.equal(code.includes(interdit), false, `« ${interdit} » ne doit pas figurer dans le code`);
    }
  }
});
test('H4. MISE À JOUR DÉLIBÉRÉE v0.63.52 : une observation écrite porte désormais empreintesOperationsExaminees (v0.63.51 : six clés, aucune empreinte) ; seul observation-possibilites.js cite ces modules ; resoudreContexteObservation, connaissances et pont ne les citent pas ; versions et schéma inchangés', async () => {
  const c = await chaine();
  const l = await c.w.lire();
  for (const o of l.observations) assert.deepEqual(Object.keys(o), ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'possibilites']);
  for (const fichier of ['connaissances.js', 'pont.js']) // MISE À JOUR DÉLIBÉRÉE v0.63.53 : contexte-observation.js retiré de la liste (il vérifie désormais la preuve)
   {
    assert.equal(/empreinte-contrats|empreintesDesContrats|contratCanonique|sha256/i.test(sansCommentaires(lu('app', 'langage', fichier))), false, fichier);
  }
  assert.equal(VERSION_BASE, 19);
  assert.equal(SCHEMA_SAUVEGARDE, 9);
  assert.equal(TABLES.length, 22);
});
test('H5. ANCIENNES OBSERVATIONS : aucune empreinte n\'est calculée ni attribuée rétroactivement ; le contexte d\'une observation existante est rendu exactement comme avant', async () => {
  const c = await chaine();
  const l = await c.w.lire();
  const avant = JSON.stringify(l.observations);
  const r = resoudreContexteObservation(c.Y.observation.id, l.observations, l.valeurs, l.executions, C16);
  empreintesDesContrats(C16);
  assert.equal(JSON.stringify(l.observations), avant, 'les lignes sont inchangées');
  assert.equal(r.observation, l.observations.find((o) => o.id === c.Y.observation.id));
  assert.equal('empreinte' in r.observation, false);
});
