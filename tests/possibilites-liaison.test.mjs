// === DEBUT_TEST_POSSIBILITES_LIAISON ===
// v0.63.13 — ÉTAPE 6, décision ChatGPT « POSSIBILITÉS ATOMIQUES DE LIAISON » (04/10/2026). Preuves que
// app/langage/possibilites-liaison.js rend exactement [{ donnee, operation, entree }] : un atome par (production, entrée) dont
// la forme garantit la forme attendue (relation de garantie du langage de formes, jamais recopiée), sans liste de liaisons, sans
// application, sans combinaison, sans unicité entre entrées, sans filtre, sans choix, sans valeur, et que la chaîne
// exécutions → productions → possibilités n'est assemblée QUE dans ce fichier. Les noms d'opérations de ce fichier sont des
// ORACLES ; le module n'en emploie aucun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/possibilites-liaison.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { fournieGarantitAttendue as garantit } from '../app/langage/garantie-forme.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { CAPACITES } from '../app/langage/registre.js';
import { enregistrerTrace, enregistrerExecutionOperation } from '../app/langage/connaissances.js';

// v0.63.23 : toute NOUVELLE exécution provient d'une désignation. Aide de TEST (la primitive n'a aucune compatibilité) : construit une
// désignation explicite cohérente avec l'entrée si celle-ci est valable, sinon une désignation valide quelconque (l'erreur attendue
// reste alors celle de l'entrée elle-même). Copie les DESCRIPTEURS : aucun accesseur n'est jamais exécuté.
let compteurDesignations = 0;
function avecDesignation(e) {
  if (e === null || typeof e !== 'object' || Array.isArray(e)) return e;
  const d = Object.getOwnPropertyDescriptors(e);
  if ('designation' in d) return e;
  const val = (c) => (d[c] !== undefined && 'value' in d[c] ? d[c].value : undefined);
  const plat = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  const chaine = (x) => typeof x === 'string' && x.length > 0;
  const lia = val('liaisons');
  const valable = Array.isArray(lia) && lia.length > 0 && (() => {
    const noms = new Set();
    for (let i = 0; i < lia.length; i += 1) {
      const pd = Object.getOwnPropertyDescriptor(lia, String(i));
      if (!pd || !('value' in pd) || !plat(pd.value) || Reflect.ownKeys(pd.value).length !== 2) return false;
      const e = Object.getOwnPropertyDescriptor(pd.value, 'entree'); const dd = Object.getOwnPropertyDescriptor(pd.value, 'donnee');
      if (!e || !dd || !('value' in e) || !('value' in dd) || !chaine(e.value) || !chaine(dd.value) || noms.has(e.value)) return false;
      noms.add(e.value);
    }
    return true;
  })();
  const operation = chaine(val('operation')) ? val('operation') : 'parcourirStructure';
  const designation = { id: `designation-application-test-${++compteurDesignations}`, operation, liaisons: valable ? lia.map((l) => ({ entree: l.entree, donnee: l.donnee })) : [{ entree: 'valeur', donnee: 'message-1' }] };
  return Object.create(Object.getPrototypeOf(e), { ...d, designation: { value: designation, enumerable: true, writable: true, configurable: true } });
}
const exec = (m, e) => enregistrerExecutionOperation(m, avecDesignation(e));

const { possibilitesDeLiaison: possibilites } = module;
const RACINE = join(import.meta.dirname, '..');
const NOM_MODULE = 'app/langage/possibilites-liaison.js';
const SOURCE = readFileSync(join(RACINE, NOM_MODULE), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const geler = (x) => { if (x !== null && typeof x === 'object') { for (const k of Object.keys(x)) geler(x[k]); Object.freeze(x); } return x; };
const copie = (x) => JSON.parse(JSON.stringify(x));
let graine = 20261013;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const entier = (n) => Math.floor(alea() * n);
const melanger = (t) => { const r = t.slice(); for (let i = r.length - 1; i > 0; i -= 1) { const j = entier(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };

const sc = (genre) => (genre ? { forme: 'scalaire', genre } : { forme: 'scalaire' });
const Q = { forme: 'quelconque' };
const desc = (nom, entrees, sortie = sc()) => ({ nom, entrees, sortie });
const prod = (identite, forme, extra = {}) => ({ identite, forme, ...extra });
const atome = (donnee, operation, entree) => ({ donnee, operation, entree });
const catalogue = DESCRIPTIONS_OPERATIONS;
const parNom = (n) => catalogue.find((d) => d.nom === n);
const cheminForme = { forme: 'collection', elements: { forme: 'scalaire' } };
const PAPIER = valider({
  nom: 'relationsParentEnfant',
  entrees: { univers: { forme: 'collection', elements: { forme: 'objet', champs: { chemin: { forme: 'collection', elements: { forme: 'scalaire' } } } } } },
  sortie: { forme: 'collection', elements: { forme: 'objet', champs: { parent: cheminForme, enfant: cheminForme } } },
});
const FORME_UNIVERS = valider(parNom('parcourirStructure')).sortie;
const FORME_COUVERTURE = valider(parNom('normaliserCouverture')).sortie;
const ENTREE_UNIVERS = valider(parNom('resoudreCouverture')).entrees.univers; // forme d'ENTRÉE (faits côté entrée) : la sortie d'univers porte peutManquer et ne peut pas servir d'entrée
const nbEntrees = (ds) => ds.reduce((n, d) => n + Object.keys(d.entrees).length, 0);

// ============================================================================ A. CONTRAT
test('A1. exactement un export : possibilitesDeLiaison(productions, descriptions)', () => {
  assert.deepEqual(Object.keys(module), ['possibilitesDeLiaison']);
  assert.equal(typeof possibilites, 'function'); assert.equal(possibilites.length, 2);
});
test('A2. atome : { donnee, operation, entree } exactement, trois chaînes, objets simples, tableau neuf', () => {
  const r = possibilites([prod('D', sc('chaine'))], [desc('op', { e: sc('chaine') })]);
  assert.ok(Array.isArray(r)); assert.equal(r.length, 1);
  assert.deepEqual(Object.keys(r[0]), ['donnee', 'operation', 'entree']);
  assert.equal(Object.getPrototypeOf(r[0]), Object.prototype);
  assert.deepEqual(r[0], atome('D', 'op', 'e'));
  for (const v of Object.values(r[0])) assert.equal(typeof v, 'string');
});
test('A3. contenu interdit absent de l\'atome : ni forme, valeur, score, priorité, raison, liaisons, application, liste', () => {
  const [a] = possibilites([prod('D', sc())], [desc('op', { e: sc() })]);
  for (const interdit of ['forme', 'valeur', 'score', 'priorite', 'raison', 'liaisons', 'liaison', 'application', 'entrees', 'donnees', 'complete', 'partielle', 'id', 'identite', 'nom']) assert.equal(Object.hasOwn(a, interdit), false, interdit);
});
test('A4. la sortie est neuve à chaque appel : deux appels égaux, objets distincts', () => {
  const p = [prod('D', sc())], d = [desc('op', { e: sc() })];
  const a = possibilites(p, d), b = possibilites(p, d);
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a[0], b[0]);
});

// ============================================================================ B. VALIDATION
test('B1. productions ou descriptions qui ne sont pas des tableaux : TypeError', () => {
  for (const v of [undefined, null, {}, 'a', 3, () => 1]) {
    refuse(() => possibilites(v, []), /productions doit être un tableau/);
    refuse(() => possibilites([], v), /descriptions doit être un tableau/);
  }
});
test('B2. production non objet, sans « identite » ou « forme » propres : TypeError', () => {
  for (const v of [null, undefined, [], 'a', 3, true]) refuse(() => possibilites([v], []), /productions\[0\] doit être un objet/);
  refuse(() => possibilites([{ forme: sc() }], []), /identite/);
  refuse(() => possibilites([{ identite: 'D' }], []), /forme/);
  refuse(() => possibilites([Object.create({ identite: 'D', forme: sc() })], []), /champ « identite » propre/);
  refuse(() => possibilites([Object.assign(Object.create({ forme: sc() }), { identite: 'D' })], []), /champ « forme » propre/);
});
test('B3. identite = chaîne non vide : ni vide, ni nombre, ni null, ni undefined, ni objet', () => {
  for (const v of ['', 0, 1, null, undefined, {}, [], true]) refuse(() => possibilites([{ identite: v, forme: sc() }], []), /identite doit être une chaîne non vide/);
});
test('B4. forme invalide selon le langage existant : TypeError enrobé du rang, jamais « incompatible »', () => {
  for (const f of [undefined, null, 'x', 3, [], {}, { forme: 'inconnue' }, { forme: 'scalaire', genre: 'x' }, { forme: 'quelconque', champs: {} }, { forme: 'objet', champs: { a: { forme: 'inconnue' } } }]) {
    refuse(() => possibilites([{ identite: 'D', forme: f }], [desc('op', { e: sc() })]), /productions\[0\]\.forme/);
  }
});
test('B5. fait de champ à la racine d\'une production (peutManquer, peutEtreNull, omissible) : refusé, une production est une sortie racine', () => {
  for (const f of [{ ...sc(), peutManquer: true }, { ...sc(), peutEtreNull: true }, { ...sc(), omissible: true }]) refuse(() => possibilites([{ identite: 'D', forme: f }], []), /productions\[0\]\.forme/);
});
test('B6. production invalide refusée MÊME sans description et MÊME si elle serait incompatible', () => {
  refuse(() => possibilites([{ identite: 'D', forme: { forme: 'inconnue' } }], []));
  refuse(() => possibilites([prod('A', sc()), { identite: 'B', forme: { forme: 'inconnue' } }], [desc('op', { e: sc('nombre') })]));
});
test('B7. accesseur sur « identite », sur « forme » ou sur un rang : rejeté SANS être exécuté', () => {
  let appels = 0;
  const piege = (v) => () => { appels += 1; return v; };
  refuse(() => possibilites([{ get identite() { return piege('D')(); }, forme: sc() }], []), /accesseur/);
  refuse(() => possibilites([{ identite: 'D', get forme() { return piege(sc())(); } }], []), /accesseur/);
  const rang = []; Object.defineProperty(rang, 0, { get: piege({}), enumerable: true, configurable: true });
  refuse(() => possibilites(rang, []), /accesseur/);
  const rangD = []; Object.defineProperty(rangD, 0, { get: piege({}), enumerable: true, configurable: true });
  refuse(() => possibilites([], rangD), /accesseur/);
  assert.equal(appels, 0);
});
test('B8. tableaux creux rejetés', () => {
  refuse(() => possibilites(new Array(1), []), /creux/);
  refuse(() => possibilites([], new Array(1)), /creux/);
});
test('B9. description invalide : TypeError du langage de formes enrobée du rang ; refusée même sans production', () => {
  refuse(() => possibilites([], [{ nom: 'op', entrees: {} }]), /descriptions\[0\] : .*sortie/);
  refuse(() => possibilites([], [desc('ok', {}), { nom: ' ', entrees: {}, sortie: sc() }]), /descriptions\[1\]/);
  refuse(() => possibilites([], [desc('op', { e: { forme: 'inconnue' } })]), /descriptions\[0\]/);
  refuse(() => possibilites([], [desc('op', { e: { ...sc(), peutManquer: true } })]), /descriptions\[0\]/);
  refuse(() => possibilites([], [null]), /descriptions\[0\]/);
});
test('B10. identités de production dupliquées : TypeError, jamais fusionnées, même si les formes sont identiques ou incompatibles', () => {
  refuse(() => possibilites([prod('D', sc()), prod('D', sc())], [desc('op', { e: sc() })]), /même identité/);
  refuse(() => possibilites([prod('D', sc()), prod('D', sc('nombre'))], []), /même identité/);
});
test('B11. noms de descriptions dupliqués : TypeError, jamais un choix silencieux ; même sans production', () => {
  refuse(() => possibilites([], [desc('op', { e: sc() }), desc('op', { e: sc() })]), /même nom/);
  refuse(() => possibilites([prod('D', sc())], [desc('op', { e: sc('chaine') }), desc('autre', {}), desc('op', { e: sc('nombre') })]), /même nom/);
});
test('B12. champs supplémentaires de production ignorés sans être lus ; aucune erreur partielle ni mutation', () => {
  let lectures = 0;
  const p = { identite: 'D', forme: sc() };
  for (const c of ['valeur', 'resultat', 'contenu', 'trace', 'horodatage']) Object.defineProperty(p, c, { get() { lectures += 1; throw new Error(c); }, enumerable: true });
  assert.equal(possibilites([p], [desc('op', { e: sc() })]).length, 1);
  assert.equal(lectures, 0);
  const ps = [prod('A', sc()), prod('A', sc())], ds = [desc('op', { e: sc() })];
  const avant = copie([ps, ds]);
  refuse(() => possibilites(ps, ds));
  assert.deepEqual(copie([ps, ds]), avant);
});
test('B13. les messages ne contiennent jamais d\'identité de donnée, de nom d\'opération ni de nom d\'entrée', () => {
  for (const f of [
    () => possibilites([prod('SECRET-ID', sc()), prod('SECRET-ID', sc())], []),
    () => possibilites([], [desc('SECRET-NOM', {}), desc('SECRET-NOM', {})]),
    () => possibilites([{ identite: 'SECRET-ID', forme: { forme: 'inconnue' } }], []),
  ]) {
    try { f(); assert.fail('doit lever'); } catch (e) { assert.equal(/SECRET/.test(e.message), false, e.message); }
  }
});

// ============================================================================ C. ZÉROS
test('C1. aucune production, aucune description, ou aucune des deux : []', () => {
  assert.deepEqual(possibilites([], []), []);
  assert.deepEqual(possibilites([], [desc('op', { e: sc() })]), []);
  assert.deepEqual(possibilites([prod('D', sc())], []), []);
});
test('C2. aucun compatible : []', () => {
  assert.deepEqual(possibilites([prod('D', sc('chaine'))], [desc('op', { e: sc('nombre') }), desc('autre', { x: { forme: 'collection' } })]), []);
});
test('C3. opération sans entrée : aucun atome, aucune « application vide » ; les autres opérations restent traitées', () => {
  assert.deepEqual(possibilites([prod('D', sc())], [desc('vide', {})]), []);
  assert.deepEqual(possibilites([prod('D', sc())], [desc('vide', {}), desc('op', { e: sc() })]), [atome('D', 'op', 'e')]);
});

// ============================================================================ D. UNE ENTRÉE (sur les vraies formes)
const TROIS = [parNom('parcourirStructure'), parNom('normaliserCouverture'), PAPIER];
test('D1. un univers et une couverture × parcourirStructure, normaliserCouverture, relationsParentEnfant (papier) : EXACTEMENT ces quatre atomes', () => {
  const r = possibilites([prod('U', FORME_UNIVERS), prod('C', FORME_COUVERTURE)], TROIS);
  assert.deepEqual(r, [
    atome('C', 'normaliserCouverture', 'chemins'),
    atome('C', 'parcourirStructure', 'valeur'),
    atome('U', 'parcourirStructure', 'valeur'),
    atome('U', 'relationsParentEnfant', 'univers'),
  ]);
});
test('D2. une donnée compatible avec parcourirStructure.valeur : atome exact', () => {
  assert.deepEqual(possibilites([prod('X', sc('nombre'))], [parNom('parcourirStructure')]), [atome('X', 'parcourirStructure', 'valeur')]);
});
test('D3. une couverture compatible avec normaliserCouverture.chemins : atome exact', () => {
  assert.deepEqual(possibilites([prod('C', FORME_COUVERTURE)], [parNom('normaliserCouverture')]), [atome('C', 'normaliserCouverture', 'chemins')]);
});
test('D4. un univers compatible avec relationsParentEnfant.univers (descripteur PAPIER) : atome exact ; sans le papier, rien', () => {
  assert.deepEqual(possibilites([prod('U', FORME_UNIVERS)], [PAPIER]), [atome('U', 'relationsParentEnfant', 'univers')]);
  assert.deepEqual(possibilites([prod('U', FORME_UNIVERS)], [parNom('normaliserCouverture')]), []);
});

// ============================================================================ E. PLUSIEURS ENTRÉES
test('E1. deux couvertures × partagerCouvertures : EXACTEMENT quatre atomes C1→a, C1→b, C2→a, C2→b, aucun objet de combinaison', () => {
  const r = possibilites([prod('C2', FORME_COUVERTURE), prod('C1', FORME_COUVERTURE)], [parNom('partagerCouvertures')]);
  assert.deepEqual(r, [
    atome('C1', 'partagerCouvertures', 'a'), atome('C2', 'partagerCouvertures', 'a'),
    atome('C1', 'partagerCouvertures', 'b'), atome('C2', 'partagerCouvertures', 'b'),
  ]);
  assert.equal(r.length, 4);
  for (const a of r) assert.deepEqual(Object.keys(a), ['donnee', 'operation', 'entree']);
  assert.equal(JSON.stringify(r).includes('['), true, 'la sortie est une liste plate d\'atomes');
  assert.equal(r.some((a) => Array.isArray(a.donnee) || Array.isArray(a.entree)), false);
});
test('E2. une même donnée est candidate à PLUSIEURS entrées de la même opération : deux atomes distincts, aucune unicité imposée', () => {
  const r = possibilites([prod('C', FORME_COUVERTURE)], [parNom('partagerCouvertures')]);
  assert.deepEqual(r, [atome('C', 'partagerCouvertures', 'a'), atome('C', 'partagerCouvertures', 'b')]);
  const r2 = possibilites([prod('C', FORME_COUVERTURE)], [parNom('memesCouvertures')]);
  assert.deepEqual(r2, [atome('C', 'memesCouvertures', 'a'), atome('C', 'memesCouvertures', 'b')]);
});
test('E3. une seule entrée satisfaite sur deux : un seul atome, l\'autre entrée ne produit rien ; AUCUN indice d\'application partielle', () => {
  const r = possibilites([prod('S', sc('chaine'))], [desc('op', { a: sc('chaine'), b: sc('nombre') })]);
  assert.deepEqual(r, [atome('S', 'op', 'a')]);
});
test('E4. toutes les entrées sans donnée : aucun atome pour l\'opération (pas d\'objet vide)', () => {
  assert.deepEqual(possibilites([prod('S', sc('booleen'))], [desc('op', { a: sc('chaine'), b: sc('nombre') })]), []);
});

// ============================================================================ F. resoudreCouverture
test('F1. un univers et une couverture × resoudreCouverture : atomes séparés (univers→univers, couverture→couverture), aucune combinaison', () => {
  const r = possibilites([prod('C', FORME_COUVERTURE), prod('U', FORME_UNIVERS)], [parNom('resoudreCouverture')]);
  assert.deepEqual(r, [atome('C', 'resoudreCouverture', 'couverture'), atome('U', 'resoudreCouverture', 'univers')]);
  assert.equal(r.length, 2);
});
test('F2. l\'univers n\'occupe pas « couverture » et la couverture n\'occupe pas « univers » : la forme décide, pas le nom', () => {
  assert.deepEqual(possibilites([prod('U', FORME_UNIVERS)], [parNom('resoudreCouverture')]).map((a) => a.entree), ['univers']);
  assert.deepEqual(possibilites([prod('C', FORME_COUVERTURE)], [parNom('resoudreCouverture')]).map((a) => a.entree), ['couverture']);
});
test('F3. deux univers et deux couvertures × resoudreCouverture : quatre atomes, pas de quatre applications', () => {
  const r = possibilites([prod('U1', FORME_UNIVERS), prod('U2', FORME_UNIVERS), prod('C1', FORME_COUVERTURE), prod('C2', FORME_COUVERTURE)], [parNom('resoudreCouverture')]);
  assert.deepEqual(r, [atome('C1', 'resoudreCouverture', 'couverture'), atome('C2', 'resoudreCouverture', 'couverture'), atome('U1', 'resoudreCouverture', 'univers'), atome('U2', 'resoudreCouverture', 'univers')]);
});

// ============================================================================ G. COMPATIBILITÉ LARGE
test('G1. une production précise face à une entrée « quelconque » produit l\'atome, sans filtre de vraisemblance', () => {
  const formes = [sc(), sc('chaine'), { forme: 'objet' }, { forme: 'collection', elements: sc('nombre') }, FORME_UNIVERS, FORME_COUVERTURE, Q];
  for (const f of formes) assert.deepEqual(possibilites([prod('D', f)], [desc('op', { e: Q })]), [atome('D', 'op', 'e')]);
});
test('G2. une entrée « quelconque » qui accepte null / omissible n\'est pas une raison de filtrer', () => {
  assert.deepEqual(possibilites([prod('D', sc('nombre'))], [desc('op', { e: { ...Q, omissible: true, peutEtreNull: true } })]), [atome('D', 'op', 'e')]);
});
test('G3. une production « quelconque » n\'est candidate qu\'à une entrée « quelconque » (relation du langage), jamais à une entrée précise', () => {
  assert.deepEqual(possibilites([prod('D', Q)], [desc('op', { p: sc('chaine'), q: Q, o: { forme: 'objet' } })]), [atome('D', 'op', 'q')]);
});
test('G4. les dix sorties du catalogue face aux entrées « quelconque » de parcourirStructure.valeur : dix atomes, y compris les absurdes', () => {
  const ps = catalogue.map((d) => prod(`id-${d.nom}`, valider(d).sortie));
  const r = possibilites(ps, [parNom('parcourirStructure')]);
  assert.equal(r.length, 15); // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
  assert.equal(new Set(r.map((a) => a.donnee)).size, 15); // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12
});

// ============================================================================ H. INCOMPATIBILITÉ
test('H1. formes incompatibles : aucun atome (scalaire/objet, genres différents, éléments différents, champ manquant)', () => {
  const cas = [
    [sc('chaine'), sc('nombre')], [sc('chaine'), { forme: 'objet' }], [{ forme: 'objet' }, { forme: 'collection' }], [sc(), sc('chaine')],
    [{ forme: 'collection', elements: sc('chaine') }, { forme: 'collection', elements: sc('nombre') }], [{ forme: 'collection' }, { forme: 'collection', elements: sc() }],
    [{ forme: 'objet', champs: { a: sc() } }, { forme: 'objet', champs: { b: sc() } }],
  ];
  for (const [fournie, attendue] of cas) assert.deepEqual(possibilites([prod('D', fournie)], [desc('op', { e: attendue })]), [], JSON.stringify([fournie, attendue]));
});
test('H2. faits de champ : une sortie qui peut manquer / être null ne garantit pas une entrée stricte, mais l\'entrée omissible / acceptant null oui', () => {
  const objet = { forme: 'objet', champs: { a: { ...sc('chaine'), peutManquer: true, peutEtreNull: true } } };
  const stricte = { forme: 'objet', champs: { a: sc('chaine') } };
  const souple = { forme: 'objet', champs: { a: { ...sc('chaine'), omissible: true, peutEtreNull: true } } };
  assert.deepEqual(possibilites([prod('D', objet)], [desc('op', { s: stricte })]), []);
  assert.deepEqual(possibilites([prod('D', objet)], [desc('op', { s: stricte, t: souple })]), [atome('D', 'op', 't')]);
});

// ============================================================================ I. MÊME DONNÉE / PLUSIEURS OPÉRATIONS ; J. PLUSIEURS DONNÉES / MÊME ENTRÉE
test('I1. une donnée et plusieurs opérations : tous les atomes compatibles, triés par opération', () => {
  const r = possibilites([prod('D', sc('chaine'))], [desc('zeta', { e: sc('chaine') }), desc('alpha', { e: sc() }), desc('mu', { e: sc('nombre') })]);
  assert.deepEqual(r, [atome('D', 'alpha', 'e'), atome('D', 'zeta', 'e')]);
});
test('J1. plusieurs données et la même entrée : tous conservés, deux données de même forme restent deux atomes', () => {
  const r = possibilites([prod('B', sc('chaine')), prod('A', sc('chaine')), prod('C', sc('nombre'))], [desc('op', { e: sc('chaine') })]);
  assert.deepEqual(r, [atome('A', 'op', 'e'), atome('B', 'op', 'e')]);
});
test('J2. plusieurs données × plusieurs opérations × plusieurs entrées : produit complet des compatibilités, sans autre filtre', () => {
  const ps = [prod('P1', sc('chaine')), prod('P2', sc('nombre')), prod('P3', FORME_COUVERTURE)];
  const ds = [desc('o1', { x: sc(), y: sc('chaine') }), desc('o2', { z: Q }), desc('o3', { w: FORME_COUVERTURE })];
  assert.deepEqual(possibilites(ps, ds), [
    atome('P1', 'o1', 'x'), atome('P2', 'o1', 'x'), atome('P1', 'o1', 'y'),
    atome('P1', 'o2', 'z'), atome('P2', 'o2', 'z'), atome('P3', 'o2', 'z'),
    atome('P3', 'o3', 'w'),
  ].sort((a, b) => (a.operation < b.operation ? -1 : a.operation > b.operation ? 1 : a.entree < b.entree ? -1 : a.entree > b.entree ? 1 : a.donnee < b.donnee ? -1 : 1)));
});

// ============================================================================ K. ORDRE
test('K1. ordre = (operation, entree, donnee) par unités de code, sans localeCompare : majuscules avant minuscules, « é » après « z »', () => {
  const ds = [desc('b', { y: sc(), x: sc() }), desc('B', { y: sc() }), desc('é', { e: sc() }), desc('z', { e: sc() })];
  const r = possibilites([prod('d2', sc()), prod('D1', sc()), prod('é', sc())], ds);
  const cle = (a) => [a.operation, a.entree, a.donnee];
  const attendu = r.map(cle).sort((p, q) => { for (let i = 0; i < 3; i += 1) { if (p[i] < q[i]) return -1; if (p[i] > q[i]) return 1; } return 0; });
  assert.deepEqual(r.map(cle), attendu);
  assert.deepEqual(r.map((a) => a.operation).filter((o, i, t) => t.indexOf(o) === i), ['B', 'b', 'z', 'é']);
  assert.deepEqual(r.filter((a) => a.operation === 'b' && a.entree === 'x').map((a) => a.donnee), ['D1', 'd2', 'é']);
});
test('K2. permutation des productions ET des descriptions ET de l\'ordre des entrées d\'une description : sortie identique', () => {
  const ds = [desc('a', { x: sc(), y: sc('chaine'), z: Q }), desc('b', { p: FORME_COUVERTURE, q: ENTREE_UNIVERS }), desc('c', { r: sc('nombre') })];
  const ps = [prod('1', sc('chaine')), prod('2', sc('nombre')), prod('3', FORME_COUVERTURE), prod('4', FORME_UNIVERS), prod('5', Q), prod('6', { forme: 'collection' })];
  const attendu = possibilites(ps, ds);
  assert.ok(attendu.length > 10);
  for (let i = 0; i < 60; i += 1) {
    const ds2 = melanger(ds).map((d) => ({ nom: d.nom, entrees: Object.fromEntries(melanger(Object.entries(d.entrees))), sortie: d.sortie }));
    assert.deepEqual(possibilites(melanger(ps), ds2), attendu);
  }
});
test('K3. l\'ordre ne porte aucun sens : il ne dépend ni de la taille de la forme, ni du nombre d\'entrées', () => {
  const r = possibilites([prod('a', FORME_UNIVERS), prod('b', sc())], [desc('z', { e: Q }), desc('y', { e: Q, f: Q })]);
  assert.deepEqual(r.map((a) => `${a.operation}.${a.entree}.${a.donnee}`), ['y.e.a', 'y.e.b', 'y.f.a', 'y.f.b', 'z.e.a', 'z.e.b']);
});

// ============================================================================ L. GEL / AUCUNE MUTATION
test('L1. entrées gelées en profondeur acceptées ; aucune entrée n\'est modifiée, ordre des tableaux conservé', () => {
  const ps = geler([prod('B', FORME_COUVERTURE), prod('A', FORME_UNIVERS)]);
  const ds = geler([desc('z', { a: FORME_COUVERTURE }), desc('y', { b: Q })]);
  const avant = copie([ps, ds]);
  const r = possibilites(ps, ds);
  assert.ok(r.length > 0);
  assert.deepEqual(copie([ps, ds]), avant);
  assert.deepEqual(ps.map((p) => p.identite), ['B', 'A']);
  assert.deepEqual(ds.map((d) => d.nom), ['z', 'y']);
});
test('L2. entrées non gelées : aucune propriété ajoutée, retirée ou modifiée ; la sortie n\'est pas gelée et ne partage rien avec l\'entrée', () => {
  const ps = [prod('A', { forme: 'objet', champs: { a: sc() } })];
  const ds = [desc('o', { e: { forme: 'objet', champs: { a: sc() } } })];
  const avant = copie([ps, ds]);
  const r = possibilites(ps, ds);
  assert.deepEqual(copie([ps, ds]), avant);
  assert.equal(Object.isFrozen(r), false); assert.equal(Object.isFrozen(r[0]), false);
  r[0].donnee = 'X'; r.push(1);
  assert.deepEqual(possibilites(ps, ds), [atome('A', 'o', 'e')]);
});
test('L3. aucun état gardé entre appels', () => {
  const d = [desc('op', { e: sc('chaine') })];
  const a = possibilites([prod('T', sc('chaine'))], d);
  possibilites([prod('U', sc('chaine')), prod('V', sc('chaine'))], [desc('op', { e: sc('nombre') })]);
  assert.deepEqual(possibilites([prod('T', sc('chaine'))], d), a);
  assert.deepEqual(possibilites([], d), []);
});

// ============================================================================ M. IDENTITÉ TYPÉE
test('M1. identités et noms comparés tels quels : casse, espaces, normalisation Unicode, coercition — aucune fusion, aucun trim', () => {
  const ids = ['a', 'A', 'a ', ' a', '1', 'é', 'e\u0301', 'a\u0000'];
  const r = possibilites(ids.map((id) => prod(id, sc())), [desc('op', { e: sc() })]);
  assert.equal(r.length, ids.length);
  assert.deepEqual(r.map((a) => a.donnee).sort(), [...ids].sort());
  assert.equal(new Set(r.map((a) => a.donnee)).size, ids.length);
});
test('M2. une identité non chaîne n\'est jamais coercée : 1 ≠ « 1 », null, true, objet à toString', () => {
  for (const v of [1, 1n, null, true, { toString: () => 'D' }, ['D'], Symbol('D')]) refuse(() => possibilites([{ identite: v, forme: sc() }], []));
});
test('M3. noms d\'opération et d\'entrée conservés tels quels dans l\'atome (pas de normalisation, pas de trim, « __proto__ » est un nom comme un autre)', () => {
  const r = possibilites([prod('D', sc())], [desc('Op ', { 'E ': sc(), __proto__x: sc() })]);
  assert.deepEqual(r.map((a) => [a.operation, a.entree]).sort(), [['Op ', 'E '], ['Op ', '__proto__x']].sort());
  const entrees = JSON.parse('{"__proto__": {"forme": "scalaire"}}');
  assert.deepEqual(possibilites([prod('D', sc())], [{ nom: 'op', entrees, sortie: sc() }]).map((a) => a.entree), ['__proto__']);
});

// ============================================================================ N. INTÉGRATION (TEST SEULEMENT)
const ex = (id, operation) => ({ id, operation });
test('N1. chaîne exécution fictive de parcourirStructure → productionsDecrites → possibilités : atomes de la forme d\'univers', () => {
  const productions = productionsDecrites([ex('T', 'parcourirStructure')], catalogue);
  const r = possibilites(productions, catalogue);
  assert.deepEqual(r, [
    atome('T', 'couvrirSequence', 'elements'),
    atome('T', 'parcourirStructure', 'valeur'),
    atome('T', 'projeterChemins', 'elements'), // MISE À JOUR DÉLIBÉRÉE v0.63.45 : la sortie de parcourirStructure (éléments portant un `chemin` collection de scalaires) garantit projeterChemins.elements (collision de forme acceptée)
    atome('T', 'resoudreCouverture', 'univers'),
  ]);
});
test('N2. même chaîne avec plusieurs exécutions fictives (dont une inconnue et une répétée) : exactement les atomes de leurs formes', () => {
  const productions = productionsDecrites([ex('T1', 'parcourirStructure'), ex('T2', 'normaliserCouverture'), ex('T3', 'parcourirStructure'), ex('T4', 'inconnue')], catalogue);
  assert.equal(productions.length, 3);
  const r = possibilites(productions, catalogue);
  const d = (donnee, operation, entree) => atome(donnee, operation, entree);
  assert.deepEqual(r, [
    d('T1', 'couvrirSequence', 'elements'), d('T2', 'couvrirSequence', 'elements'), d('T3', 'couvrirSequence', 'elements'),
    d('T2', 'memesCouvertures', 'a'), d('T2', 'memesCouvertures', 'b'), d('T2', 'normaliserCouverture', 'chemins'),
    d('T1', 'parcourirStructure', 'valeur'), d('T2', 'parcourirStructure', 'valeur'), d('T3', 'parcourirStructure', 'valeur'),
    d('T2', 'partagerCouvertures', 'a'), d('T2', 'partagerCouvertures', 'b'),
    d('T1', 'projeterChemins', 'elements'), d('T3', 'projeterChemins', 'elements'), // MISE À JOUR DÉLIBÉRÉE v0.63.45 : les sorties de parcourirStructure portent un `chemin` : candidates de projeterChemins.elements (collision de forme acceptée)
    d('T2', 'rechercherSousSuites', 'motifs'), // MISE À JOUR DÉLIBÉRÉE v0.63.44 : la sortie de normaliserCouverture (collection de collections de scalaires) garantit aussi rechercherSousSuites.motifs (collision de forme acceptée)
    d('T2', 'resoudreCouverture', 'couverture'), d('T1', 'resoudreCouverture', 'univers'), d('T3', 'resoudreCouverture', 'univers'),
  ]);
});
test('N3. chaîne avec le descripteur papier : l\'univers produit par parcourirStructure devient candidat à relationsParentEnfant.univers', () => {
  const ds = [...catalogue, PAPIER];
  const r = possibilites(productionsDecrites([ex('T', 'parcourirStructure')], ds), ds);
  assert.deepEqual(r.filter((a) => a.operation === 'relationsParentEnfant'), [atome('T', 'relationsParentEnfant', 'univers')]);
  assert.equal(r.length, 5); // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 4 → 5 (+ projeterChemins.elements)
});
test('N4. chaîne avec une opération papier qui produit une couverture : ses atomes sont ceux d\'une couverture', () => {
  const papier = desc('fabrique', {}, FORME_COUVERTURE);
  const ds = [...catalogue, papier];
  const r = possibilites(productionsDecrites([ex('F', 'fabrique')], ds), ds);
  assert.deepEqual(r.map((a) => `${a.operation}.${a.entree}`), ['couvrirSequence.elements', 'memesCouvertures.a', 'memesCouvertures.b', 'normaliserCouverture.chemins', 'parcourirStructure.valeur', 'partagerCouvertures.a', 'partagerCouvertures.b', 'rechercherSousSuites.motifs', 'resoudreCouverture.couverture']); // MISE À JOUR DÉLIBÉRÉE v0.63.44 : + rechercherSousSuites.motifs (collision de forme avec une couverture, acceptée)
  for (const a of r) assert.equal(a.donnee, 'F');
});
test('N5. chaîne avec de vraies exécutions enregistrées (persistance simulée) : l\'identité de la donnée est ligne.id, aucun résultat n\'intervient', async () => {
  const lignes = [];
  const magasin = { ecrire: async (table, objet) => { lignes.push(objet); } };
  const t1 = await exec(magasin, { operation: 'normaliserCouverture', liaisons: [{ entree: 'chemins', donnee: 'm' }], resultat: 'incompatible' });
  const r = possibilites(productionsDecrites(lignes, catalogue), catalogue);
  assert.equal(r.length, 9); // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 8 → 9 (+ rechercherSousSuites)
  for (const a of r) assert.equal(a.donnee, t1.id);
});
test('N6. (v0.63.24) le SEUL assembleur de production est observation-possibilites.js (univers élargi observé) ; aucun autre fichier n\'importe les deux modules', () => {
  const importeurs = [];
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const src = readFileSync(f, 'utf8');
    if (/productions-decrites/.test(src) && /possibilites-liaison/.test(src)) importeurs.push(rel(f));
  }
  assert.deepEqual(importeurs, ['app/langage/observation-possibilites.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.24
});

// ============================================================================ O. MONDE ACTUEL
test('O1. (v0.63.20) 5 CAPACITES réelles tracées (anciennes traces) : productionsDecrites les REFUSE (pas de champ « operation »), jamais interprétées', async () => {
  const lignes = [];
  const magasin = { ecrire: async (table, objet) => { lignes.push(objet); } };
  for (const capacite of Object.keys(CAPACITES)) await enregistrerTrace(magasin, { capacite, voie: 'action', argumentsUtilises: {}, provenanceArguments: {}, resultat: { etat: 'ok' } });
  assert.equal(lignes.length, 5);
  assert.throws(() => productionsDecrites(lignes, catalogue), (e) => e instanceof TypeError && /champ « operation » propre/.test(e.message));
});
test('O2. le catalogue (dix noms, sans relationsParentEnfant) et CAPACITES (cinq clés) sont inchangés', () => {
  assert.deepEqual(catalogue.map((d) => d.nom), ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'elementsObservables', 'memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'produireSuitesFermees', 'projeterChemins', 'projeterContenus', 'rechercherSousSuites', 'resoudreCouverture', 'symbolesDeChaine']); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : + symbolesDeChaine // MISE À JOUR DÉLIBÉRÉE v0.63.43 : + projeterContenus // MISE À JOUR DÉLIBÉRÉE v0.63.44 : + rechercherSousSuites
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
});

// ============================================================================ P. GÉNÉRALITÉ
const genForme = (profondeur = 0) => {
  const t = entier(profondeur >= 2 ? 3 : 5);
  if (t === 0) return sc(['chaine', 'nombre', 'booleen', undefined][entier(4)]);
  if (t === 1) return Q;
  if (t === 2) return { forme: 'objet' };
  if (t === 3) return entier(3) === 0 ? { forme: 'collection' } : { forme: 'collection', elements: genForme(profondeur + 1) };
  const champs = {};
  for (let i = 0; i < entier(3) + 1; i += 1) champs[`c${entier(3)}`] = genForme(profondeur + 1);
  return { forme: 'objet', champs };
};
const genChamp = (cote) => {
  const f = genForme(0);
  return cote === 'entree' ? { ...f, ...(entier(4) === 0 ? { omissible: true } : {}) } : f;
};
test('P1. GÉNÉRAL (oracle indépendant) : sur des formes et des descripteurs aléatoires qui ne correspondent à aucune opération du dépôt, l\'ensemble des atomes = l\'ensemble des couples où la relation de garantie dit vrai', () => {
  for (let essai = 0; essai < 150; essai += 1) {
    const ps = [];
    for (let i = 0; i < entier(6); i += 1) ps.push(prod(`d${i}`, genForme(0)));
    const ds = [];
    for (let i = 0; i < entier(4); i += 1) {
      const entrees = {};
      for (let j = 0; j < entier(4); j += 1) entrees[`e${j}`] = genChamp('entree');
      ds.push(desc(`o${i}`, entrees, genForme(0)));
    }
    const attendu = new Set();
    for (const d of ds) for (const [e, champ] of Object.entries(d.entrees)) for (const p of ps) if (garantit(p.forme, champ)) attendu.add(JSON.stringify([d.nom, e, p.identite]));
    const r = possibilites(ps, ds);
    assert.equal(r.length, attendu.size);
    assert.deepEqual(new Set(r.map((a) => JSON.stringify([a.operation, a.entree, a.donnee]))), attendu);
    assert.equal(r.length <= ps.length * nbEntrees(ds), true);
  }
});
test('P2. renommage : renommer les identités, les opérations et les entrées renomme les atomes SANS changer leur nombre ni leur structure', () => {
  const ps = [prod('a', FORME_COUVERTURE), prod('b', FORME_UNIVERS), prod('c', sc('chaine'))];
  const ds = [parNom('partagerCouvertures'), parNom('resoudreCouverture'), desc('o', { x: sc() })];
  const base = possibilites(ps, ds);
  const ren = (s) => `zz-${s}-ZZ`;
  const ps2 = ps.map((p) => prod(ren(p.identite), p.forme));
  const ds2 = ds.map((d) => ({ nom: ren(d.nom), entrees: Object.fromEntries(Object.entries(d.entrees).map(([k, v]) => [ren(k), v])), sortie: d.sortie }));
  const r2 = possibilites(ps2, ds2);
  assert.equal(r2.length, base.length);
  assert.deepEqual(new Set(r2.map((a) => JSON.stringify([a.donnee, a.operation, a.entree]))), new Set(base.map((a) => JSON.stringify([ren(a.donnee), ren(a.operation), ren(a.entree)]))));
});
test('P3. le résultat ne dépend QUE des formes : deux productions de même forme et d\'identités différentes ont exactement les mêmes entrées candidates', () => {
  const r = possibilites([prod('p', FORME_UNIVERS), prod('q', FORME_UNIVERS)], [...catalogue, PAPIER]);
  const de = (id) => r.filter((a) => a.donnee === id).map((a) => `${a.operation}.${a.entree}`);
  assert.deepEqual(de('p'), de('q'));
  assert.ok(de('p').length >= 3);
});
test('P4. descripteurs entièrement papier, sans aucun lien avec le dépôt : mécanisme identique', () => {
  const ps = [prod('zorg', { forme: 'collection', elements: { forme: 'objet', champs: { blip: sc('nombre') } } })];
  const ds = [desc('flurb', { gnu: { forme: 'collection', elements: { forme: 'objet', champs: { blip: sc() } } }, gna: sc() })];
  assert.deepEqual(possibilites(ps, ds), [atome('zorg', 'flurb', 'gnu')]);
});

// ============================================================================ Q. EXPLOSION : MESURE SEULEMENT
test('Q1. borne supérieure P × nombre total d\'entrées : respectée et atteinte avec des entrées « quelconque » ; mesure sur le catalogue', () => {
  const ds = [desc('o1', { a: Q, b: Q }), desc('o2', { c: Q })];
  const ps = ['1', '2', '3', '4'].map((i) => prod(i, sc()));
  assert.equal(possibilites(ps, ds).length, ps.length * nbEntrees(ds));
  const toutes = [...catalogue, PAPIER];
  const universelles = catalogue.map((d) => prod(`i-${d.nom}`, valider(d).sortie));
  const r = possibilites(universelles, toutes);
  const borne = universelles.length * nbEntrees(toutes);
  assert.equal(nbEntrees(toutes), 21); // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 20 → 21 (+ projeterChemins.elements) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 18 → 20 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 17 → 18 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 14 → 15 (+ symbolesDeChaine.chaine) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 15 → 16 (+ elementsObservables.elements) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 16 → 17 (+ produireSuitesFermees.elements)
  assert.equal(borne, 315); // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 280 → 315 (15 × 21) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 234 → 280 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 204 → 234 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 10 × 15 ; MISE À JOUR DÉLIBÉRÉE v0.63.41 : 11 × 16 ; MISE À JOUR DÉLIBÉRÉE v0.63.42 : 12 × 17
  assert.ok(r.length <= borne);
  assert.ok(r.length > 0 && r.length < borne, `atomes mesurés : ${r.length} / borne ${borne} — aucune limite imposée par la primitive`);
});
test('Q2. aucune limite arbitraire : mille productions × une entrée « quelconque » donnent mille atomes', () => {
  const ps = []; for (let i = 0; i < 1000; i += 1) ps.push(prod(`id-${String(i).padStart(4, '0')}`, sc()));
  assert.equal(possibilites(ps, [desc('o', { e: Q })]).length, 1000);
});

// ============================================================================ R. STATIQUE : PURETÉ ET GARDES
const NOMS_CONNUS = [...catalogue.map((d) => d.nom), 'relationsParentEnfant', ...Object.keys(CAPACITES)];
test('R1. exactement deux importations (formes-operation, garantie-forme), une seule exportation, aucun import dynamique ni require', () => {
  assert.deepEqual((CODE.match(/^\s*import\b[^;]*;/gm) || []).map((l) => l.trim()), [
    "import { validerDescripteurOperation } from './formes-operation.js';",
    "import { fournieGarantitAttendue } from './garantie-forme.js';",
  ]);
  assert.equal((CODE.match(/^\s*import\b/gm) || []).length, 2);
  assert.equal(/\bimport\s*\(/.test(CODE), false);
  assert.equal(/\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function possibilitesDeLiaison(productions, descriptions) {']);
  assert.equal(/export\s*\{|export\s+default|module\.exports/.test(CODE), false);
});
test('R2. n\'importe ni le catalogue, ni productions-decrites, ni connaissances, ni registre, ni une primitive : pas dans le code, pas dans les commentaires', () => {
  assert.equal(/DESCRIPTIONS_OPERATIONS|descriptions-operations|productions-decrites|productionsDecrites|connaissances|registre|CAPACITES|composition\.js|parcours-structure|couverture-occurrences|resolution-couverture|constats-structurels|partition-couvertures|relations-parent-enfant|contrats-observes/.test(SOURCE), false);
});
test('R3. ne connaît AUCUN nom d\'opération ni de capacité : ni dans le code, ni dans les commentaires', () => {
  for (const nom of NOMS_CONNUS) assert.equal(SOURCE.includes(nom), false, nom);
  assert.equal(/(===|!==)\s*'(?!string'|object')/.test(CODE), false, 'aucune comparaison à un littéral autre que les types');
});
test('R4. ne recopie aucune règle de compatibilité : aucune comparaison de formes, de genres, de champs, d\'éléments ; aucune forme littérale', () => {
  // MISE À JOUR DÉLIBÉRÉE v0.63.39 : l'entrée collective est lue par UNE seule ligne autorisée (fait `collectif` + chemin elements.champs.valeur) ; elle est retirée avant le contrôle, qui reste identique pour tout le reste.
  const LIGNE_COLLECTIVE = "const cible = attendue.collectif === true ? attendue.elements.champs.valeur : attendue;";
  assert.equal((CODE.split(LIGNE_COLLECTIVE).length - 1), 1, 'une seule lecture du fait collectif');
  const CODE_SANS = CODE.replace(LIGNE_COLLECTIVE, '');
  assert.equal(/\.genre|\.champs|\.elements|\.peutManquer|\.peutEtreNull|\.omissible|\.forme\s*[=!]==|'(scalaire|objet|collection|quelconque|chaine|nombre|booleen)'/.test(CODE_SANS), false);
  assert.equal((CODE.match(/fournieGarantitAttendue\(/g) || []).length, 1);
  assert.match(CODE, /fournieGarantitAttendue\(donnee\.forme, cible\)/);
});
test('R5. n\'examine aucune valeur ni résultat : aucun mot « valeur » ou « resultat » utilisé comme lecture, ni conformite ni JSON', () => {
  assert.equal(/resultat|\.valeur|conformite|instancesDecrites|formesDecrites|JSON\./.test(CODE.replace("const cible = attendue.collectif === true ? attendue.elements.champs.valeur : attendue;", '')), false); // MISE À JOUR DÉLIBÉRÉE v0.63.39 : seule la ligne collective (chemin de FORME `champs.valeur`, aucune valeur lue) est exclue
});
test('R6. validation par le langage existant : une validation par description, une par production, aucune copie manuelle', () => {
  assert.equal((CODE.match(/validerDescripteurOperation\(/g) || []).length, 2);
  assert.equal(/structuredClone|Object\.assign|\.\.\.|JSON/.test(CODE), false);
});
test('R7. la lecture sûre se fait par descripteur de propriété (jamais d\'accès direct à identite, forme ni à un rang)', () => {
  assert.equal(/\bproduction\.(identite|forme)\b/.test(CODE), false);
  assert.match(CODE, /Object\.getOwnPropertyDescriptor\(tableau, rang\)/);
  assert.match(CODE, /Object\.getOwnPropertyDescriptor\(objet, champ\)/);
});
test('R8. aucun accès mémoire / IndexedDB / localStorage / réseau / horloge / aléa / DOM / async', () => {
  assert.equal(/indexedDB|IndexedDB|localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|Date\b|Math\.random|performance\.now|crypto|document\.|window\.|navigator|process\.|readFile|writeFile|setTimeout|setInterval|await\b|async\b|Promise/.test(CODE), false);
});
test('R9. aucun état global, aucun registre, aucun stockage, aucune table de module', () => {
  assert.equal(/^(let|var)\s/m.test(CODE), false);
  assert.equal(/^const\s+\w+\s*=\s*new\s+(Map|Set|WeakMap|WeakSet)/m.test(CODE), false);
  assert.equal(/^const\s+\w+\s*=\s*(\[|\{)/m.test(CODE), false);
  assert.equal(/globalThis|global\.|Symbol|memo|cache|registre|registry/i.test(CODE), false);
});
test('R10. aucun dispatch, aucune exécution, aucune sélection, aucune combinaison, aucune limite arbitraire', () => {
  assert.equal(/\beval\b|new Function|Function\(|\.call\(|\.apply\(|\.bind\(|\[\s*\w+\s*\]\s*\(/.test(CODE), false);
  assert.equal(/score|priorite|priorité|pertinen|interet|préférence|preference|curiosit|attention|choisir|selection|sélection|\.filter\(|\.slice\(|\.splice\(|Math\.min|Math\.max|limite|plafond|break\b|return atomes\.slice/i.test(CODE), false);
  assert.equal(/\.flatMap|\.reduce|combin|cartesi/i.test(CODE), false);
});
test('R11. aucune approximation de comparaison : pas de normalisation, de casse, de trim, de localeCompare ; un seul tri par unités de code', () => {
  assert.equal(/toLowerCase|toUpperCase|normalize|trim\(|\.includes\(|startsWith|endsWith|indexOf|localeCompare|RegExp|\.match\(|\.replace\(|\.test\(|split\(/.test(CODE), false);
  assert.equal((CODE.match(/\.sort\(/g) || []).length, 1);
  assert.match(CODE, /const comparer = \(a, b\) => \(a < b \? -1 : a > b \? 1 : 0\);/);
  assert.match(CODE, /atomes\.sort\(\(a, b\) => comparer\(a\.operation, b\.operation\) \|\| comparer\(a\.entree, b\.entree\) \|\| comparer\(a\.donnee, b\.donnee\)\)/);
});

test('R12. une erreur n\'est jamais transformée en « incompatible » : exactement deux try (validation d\'une description, d\'une forme de production), jamais autour de la relation de garantie ; aucune énumération héritée', () => {
  assert.equal((CODE.match(/\btry\s*\{/g) || []).length, 2);
  assert.equal((CODE.match(/\bcatch\b/g) || []).length, 2);
  const apres = CODE.slice(CODE.indexOf('const atomes = []'));
  assert.equal(/\b(try|catch)\b/.test(apres), false, 'aucun try/catch après la construction des données');
  assert.equal(/\bfor\s*\(\s*(const|let|var)\s+\w+\s+in\b/.test(CODE), false, 'jamais for…in : seules les clés propres sont énumérées');
  assert.match(CODE, /for \(const entree of Object\.keys\(operation\.entrees\)\)/);
});

// ============================================================================ S. DORMANCE
function fichiersJs(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const c = join(dossier, nom);
    if (statSync(c).isDirectory()) { if (nom !== 'node_modules') fichiersJs(c, sortie); } else if (nom.endsWith('.js')) sortie.push(c);
  }
  return sortie;
}
const rel = (f) => relative(RACINE, f).split('\\').join('/');
test('S1. AUCUN fichier de production (ni sw, worker, index, manifeste) ne référence ce module ni son export', () => {
  const fautifs = [];
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (rel(f) === NOM_MODULE) continue;
    if (/possibilites-liaison|possibilitesDeLiaison/.test(readFileSync(f, 'utf8'))) fautifs.push(rel(f));
  }
  assert.deepEqual(fautifs, ['app/langage/observation-possibilites.js'], 'v0.63.16 : SEUL référenceur = l\'observation des possibilités');
  for (const autre of ['app/index.html', 'app/sw.js', 'sw.js', 'worker.js', 'index.html', 'app/manifest.webmanifest']) {
    let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; }
    assert.equal(/possibilites-liaison|possibilitesDeLiaison/.test(src), false, autre);
  }
});
test('S2. (v0.63.24) depuis app/main.js : relations-parent-enfant reste INACCESSIBLE ; productions-decrites est désormais atteinte par l\'observation (voulu)', () => {
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
  assert.equal([...vus].some((f) => rel(f) === 'app/langage/productions-decrites.js'), true, 'v0.63.24 : atteinte via observation-possibilites.js');
  for (const interdit of ['app/langage/relations-parent-enfant.js']) { // v0.63.16 : ce module, formes, garantie et catalogue sont atteignables via observation-possibilites.js
    assert.equal([...vus].some((f) => rel(f) === interdit), false, `${interdit} ne doit pas être atteignable`);
  }
});
test('S3. le seul module de production qui importe ce module est… aucun ; ce module n\'est pas dans la coquille hors ligne', () => {
  assert.equal(/possibilites-liaison/.test(readFileSync(join(RACINE, 'app', 'sw.js'), 'utf8')), false);
});
test('S4. les importeurs de formes-operation.js et de garantie-forme.js sont les seuls attendus (liste fermée)', () => {
  const importeursFormes = fichiersJs(join(RACINE, 'app')).filter((f) => rel(f) !== 'app/langage/formes-operation.js' && /formes-operation/.test(readFileSync(f, 'utf8'))).map(rel).sort();
  assert.deepEqual(importeursFormes, ['app/langage/conformite-application.js', 'app/langage/donnee-de-source.js', 'app/langage/garantie-forme.js', 'app/langage/groupes-candidats.js', 'app/langage/possibilites-liaison.js', 'app/langage/productions-decrites.js']);
  const importeursGarantie = fichiersJs(join(RACINE, 'app')).filter((f) => rel(f) !== 'app/langage/garantie-forme.js' && /garantie-forme/.test(readFileSync(f, 'utf8'))).map(rel).sort();
  assert.deepEqual(importeursGarantie, ['app/langage/possibilites-liaison.js']);
});
// === FIN_TEST_POSSIBILITES_LIAISON ===
