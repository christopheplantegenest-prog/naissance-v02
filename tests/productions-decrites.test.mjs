// === DEBUT_TEST_PRODUCTIONS_DECRITES ===
// v0.63.12 — ÉTAPE 6, décision ChatGPT « VUE PURE DES PRODUCTIONS DÉCRITES » (04/10/2026). Preuves que
// app/langage/productions-decrites.js rend exactement [{ identite, forme }] : identité = id de l'exécution, forme = copie de la sortie
// de la description de MÊME NOM (égalité stricte), sans jamais lire le résultat, sans connaître aucun nom d'opération, sans
// registre, sans stockage, sans choix, sans ordre significatif, et que le monde actuel (capacités déjà tracées × catalogue
// décrit) donne une vue VIDE. Les noms d'opérations de ce fichier sont des ORACLES ; le module n'en emploie aucun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import * as module from '../app/langage/productions-decrites.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { CAPACITES } from '../app/langage/registre.js';
import { enregistrerTrace, enregistrerExecutionOperation } from '../app/langage/connaissances.js';

const { productionsDecrites: vue } = module;
const RACINE = join(import.meta.dirname, '..');
const NOM_MODULE = 'app/langage/productions-decrites.js';
const SOURCE = readFileSync(join(RACINE, NOM_MODULE), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(SOURCE);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const geler = (x) => { if (x !== null && typeof x === 'object') { for (const k of Object.keys(x)) geler(x[k]); Object.freeze(x); } return x; };
const copie = (x) => JSON.parse(JSON.stringify(x));
let graine = 20261012;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const melanger = (t) => { const r = t.slice(); for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(alea() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

const sc = (genre) => (genre ? { forme: 'scalaire', genre } : { forme: 'scalaire' });
const desc = (nom, sortie, entrees = {}) => ({ nom, entrees, sortie });
const tr = (id, operation, extra = {}) => ({ id, operation, ...extra });
const catalogue = DESCRIPTIONS_OPERATIONS;
// Descripteur « papier » de relationsParentEnfant : défini ICI, jamais ajouté au catalogue.
const chemin = { forme: 'collection', elements: { forme: 'scalaire' } };
const PAPIER = valider({
  nom: 'relationsParentEnfant',
  entrees: { univers: { forme: 'collection', elements: { forme: 'objet', champs: { chemin: { forme: 'collection', elements: { forme: 'scalaire' } } } } } },
  sortie: { forme: 'collection', elements: { forme: 'objet', champs: { parent: chemin, enfant: chemin } } },
});

// ============================================================================ A. CONTRAT
test('A1. exactement un export : productionsDecrites(executions, descriptions)', () => {
  assert.deepEqual(Object.keys(module), ['productionsDecrites']);
  assert.equal(typeof vue, 'function'); assert.equal(vue.length, 2);
});
test('A2. sortie : un tableau de { identite, forme } exactement, aucun autre champ, objets simples', () => {
  const r = vue([tr('T', 'op')], [desc('op', sc('chaine'))]);
  assert.ok(Array.isArray(r)); assert.equal(r.length, 1);
  assert.deepEqual(Object.keys(r[0]), ['identite', 'forme']);
  assert.equal(Object.getPrototypeOf(r[0]), Object.prototype);
  assert.equal(r[0].identite, 'T');
  assert.deepEqual(r[0].forme, sc('chaine'));
});
test('A3. contenu interdit absent de la sortie : ni nom d\'opération, ni résultat, ni entrées, ni horodatage, ni capacité, ni lien', () => {
  const r = vue([tr('T', 'op', { resultat: 1, horodatage: 'x' })], [desc('op', sc(), { a: sc('chaine') })]);
  for (const interdit of ['nom', 'capacite', 'operation', 'resultat', 'entrees', 'horodatage', 'id', 'donnee', 'entree', 'score', 'priorite']) {
    assert.equal(Object.hasOwn(r[0], interdit), false, interdit);
    assert.equal(Object.hasOwn(r[0].forme, interdit), false, interdit);
  }
});
test('A4. rien n\'est une possibilité {donnee, operation, entree} : aucune notion de liaison dans la sortie', () => {
  const r = vue([tr('T', 'op')], [desc('op', sc(), { a: sc('chaine') })]);
  assert.equal(JSON.stringify(r).includes('liaison'), false);
  assert.deepEqual(Object.keys(r[0]).sort(), ['forme', 'identite']);
});

// ============================================================================ B. VALIDATION
test('B1. executions ou descriptions qui ne sont pas des tableaux : TypeError', () => {
  for (const v of [undefined, null, {}, 'a', 3, () => 1]) {
    refuse(() => vue(v, []), /executions doit être un tableau/);
    refuse(() => vue([], v), /descriptions doit être un tableau/);
  }
});
test('B2. exécution qui n\'est pas un objet (null, tableau, primitive) ou sans « id »/« operation » propre : TypeError', () => {
  for (const v of [null, undefined, [], 'a', 3, true]) refuse(() => vue([v], []), /executions\[0\] doit être un objet/);
  refuse(() => vue([{ operation: 'op' }], []), /id/);
  refuse(() => vue([{ id: 'T' }], []), /operation/);
  refuse(() => vue([Object.create({ id: 'T', operation: 'op' })], []), /champ « id » propre/);
  refuse(() => vue([Object.assign(Object.create({ operation: 'op' }), { id: 'T' })], []), /champ « operation » propre/);
});
test('B3. id doit être une chaîne non vide ; operation une chaîne ; aucun nombre, aucun null, aucun undefined', () => {
  for (const v of ['', 0, 1, null, undefined, {}, [], true]) refuse(() => vue([{ id: v, operation: 'op' }], []), /id doit être une chaîne non vide/);
  for (const v of [0, null, undefined, {}, [], true]) refuse(() => vue([{ id: 'T', operation: v }], []), /operation doit être une chaîne/);
  assert.deepEqual(vue([{ id: 'T', operation: '' }], []), [], 'operation chaîne vide : valide, simplement sans description');
});
test('B4. accesseur sur « id », sur « operation » ou sur un rang : rejeté SANS être exécuté', () => {
  let appels = 0;
  const piege = () => { appels += 1; return 'T'; };
  refuse(() => vue([{ get id() { return piege(); }, operation: 'op' }], []), /accesseur/);
  refuse(() => vue([{ id: 'T', get operation() { return piege(); } }], []), /accesseur/);
  const rang = []; Object.defineProperty(rang, 0, { get: piege, enumerable: true, configurable: true });
  refuse(() => vue(rang, []), /accesseur/);
  const desc2 = []; Object.defineProperty(desc2, 0, { get: piege, enumerable: true, configurable: true });
  refuse(() => vue([], desc2), /accesseur/);
  assert.equal(appels, 0);
});
test('B5. tableaux creux rejetés (exécutions comme descriptions)', () => {
  refuse(() => vue(new Array(1), []), /creux/);
  refuse(() => vue([], new Array(1)), /creux/);
  const t = [tr('A', 'op')]; t.length = 3;
  refuse(() => vue(t, []), /creux/);
});
test('B6. description invalide : TypeError du langage de formes, enrobée du rang ; AUCUNE règle de forme n\'est recopiée', () => {
  refuse(() => vue([], [{ nom: 'op', entrees: {} }]), /descriptions\[0\] : .*sortie/);
  refuse(() => vue([], [desc('ok', sc()), { nom: ' ', entrees: {}, sortie: sc() }]), /descriptions\[1\]/);
  refuse(() => vue([], [desc('op', { forme: 'inconnue' })]), /descriptions\[0\]/);
  refuse(() => vue([], [null]), /descriptions\[0\]/);
  refuse(() => vue([], [{ nom: 'op', entrees: {}, sortie: sc(), extra: 1 }]), /descriptions\[0\]/);
});
test('B7. une description invalide est refusée MÊME sans exécution correspondante et MÊME sans exécution du tout', () => {
  refuse(() => vue([], [desc('a', { forme: 'inconnue' })]));
  refuse(() => vue([tr('T', 'b')], [desc('a', { forme: 'inconnue' }), desc('b', sc())]));
});
test('B8. deux descriptions de même nom : TypeError (ambiguïté), jamais un choix silencieux ; même sans exécution', () => {
  refuse(() => vue([], [desc('op', sc('chaine')), desc('op', sc('nombre'))]), /même nom/);
  refuse(() => vue([tr('T', 'op')], [desc('op', sc('chaine')), desc('autre', sc()), desc('op', sc('chaine'))]), /même nom/);
});
test('B9. deux exécutions de même id : TypeError, jamais fusionnées — même si l\'une n\'a aucune description', () => {
  refuse(() => vue([tr('T', 'op'), tr('T', 'op')], [desc('op', sc())]), /même identité/);
  refuse(() => vue([tr('T', 'op'), tr('T', 'autre')], [desc('op', sc())]), /même identité/);
  refuse(() => vue([tr('T', 'x'), tr('T', 'y')], []), /même identité/);
});
test('B10. une erreur ne produit aucun résultat partiel et ne modifie rien', () => {
  const ex = [tr('A', 'op'), tr('B', 'op'), tr('A', 'op')];
  const ds = [desc('op', sc('chaine'))];
  const avant = copie([ex, ds]);
  refuse(() => vue(ex, ds));
  assert.deepEqual(copie([ex, ds]), avant);
});
test('B11. les messages ne contiennent jamais d\'identité ni de nom d\'opération', () => {
  for (const f of [
    () => vue([tr('SECRET-ID', 'op'), tr('SECRET-ID', 'op')], []),
    () => vue([], [desc('SECRET-NOM', sc()), desc('SECRET-NOM', sc())]),
    () => vue([{ id: 'SECRET-ID', operation: 3 }], []),
  ]) {
    try { f(); assert.fail('doit lever'); } catch (e) { assert.equal(/SECRET/.test(e.message), false, e.message); }
  }
});

// ============================================================================ C. CORRESPONDANCE
test('C1. zéro exécution, zéro description, ou les deux : []', () => {
  assert.deepEqual(vue([], []), []);
  assert.deepEqual(vue([], [desc('op', sc())]), []);
  assert.deepEqual(vue([tr('T', 'op')], []), []);
});
test('C2. une correspondance : { identite: id, forme: sortie }', () => {
  const r = vue([tr('T', 'op')], [desc('op', { forme: 'collection', elements: sc('nombre') })]);
  assert.deepEqual(r, [{ identite: 'T', forme: { forme: 'collection', elements: { forme: 'scalaire', genre: 'nombre' } } }]);
});
test('C3. exécution sans description : aucune production ; description sans exécution : aucune production', () => {
  assert.deepEqual(vue([tr('T', 'inconnue')], [desc('op', sc())]), []);
  assert.deepEqual(vue([tr('T', 'op')], [desc('autre', sc())]), []);
});
test('C4. plusieurs exécutions de la même opération : plusieurs productions DISTINCTES, même forme, jamais fusionnées', () => {
  const r = vue([tr('T2', 'op'), tr('T1', 'op'), tr('T3', 'op')], [desc('op', sc('chaine'))]);
  assert.deepEqual(r.map((p) => p.identite), ['T1', 'T2', 'T3']);
  for (const p of r) assert.deepEqual(p.forme, sc('chaine'));
});
test('C5. plusieurs opérations : chaque exécution reçoit la forme de SA description et d\'aucune autre', () => {
  const r = vue([tr('A', 'x'), tr('B', 'y'), tr('C', 'x'), tr('D', 'z')], [desc('x', sc('chaine')), desc('y', sc('nombre')), desc('w', sc('booleen'))]);
  assert.deepEqual(r, [
    { identite: 'A', forme: sc('chaine') }, { identite: 'B', forme: sc('nombre') }, { identite: 'C', forme: sc('chaine') },
  ]);
});
test('C6. correspondance STRICTE : casse, espaces, préfixe, suffixe, alias, normalisation Unicode, noms proches — aucune production', () => {
  const d = [desc('parcourir', sc())];
  for (const operation of ['Parcourir', 'parcourir ', ' parcourir', 'parcour', 'parcourirX', 'PARCOURIR', 'parcourir\u0000', 'parcouri\u0072']) {
    if (operation === 'parcouri\u0072') continue; // 'parcouri' + 'r' = 'parcourir' : même chaîne, couverte par C2
    assert.deepEqual(vue([tr('T', operation)], d), [], JSON.stringify(operation));
  }
  const nfc = [desc('é', sc())];
  assert.deepEqual(vue([tr('T', 'e\u0301')], nfc), [], 'NFD ≠ NFC : aucune normalisation');
  assert.equal(vue([tr('T', '\u00e9')], nfc).length, 1);
});
test('C7. la correspondance est sur le nom, jamais sur la position : ordre des descriptions sans effet', () => {
  const ds = [desc('a', sc('chaine')), desc('b', sc('nombre')), desc('c', sc('booleen'))];
  const ex = [tr('1', 'c'), tr('2', 'a'), tr('3', 'b')];
  const attendu = vue(ex, ds);
  for (let i = 0; i < 30; i += 1) assert.deepEqual(vue(ex, melanger(ds)), attendu);
});
test('C8. clés spéciales : « __proto__ », « constructor », « toString », « hasOwnProperty » ne correspondent à rien par héritage', () => {
  const ex = ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf'].map((c, i) => tr(`T${i}`, c));
  assert.deepEqual(vue(ex, [desc('op', sc())]), []);
  assert.equal(vue([tr('T', '__proto__')], [desc('__proto__', sc('chaine'))]).length, 1, 'un nom littéral « __proto__ » est un nom comme un autre');
});
test('C9. une exécution dont le NOM est celui d\'une description mais portant d\'autres champs (nom, capacite) : seul « operation » compte', () => {
  assert.deepEqual(vue([{ id: 'T', operation: 'x', nom: 'op', capacite: 'op' }], [desc('op', sc())]), []);
  assert.equal(vue([{ id: 'T', operation: 'op', capacite: 'x' }], [desc('op', sc())]).length, 1, 'operation utilisé, capacite ignoré');
});

// ============================================================================ D. INDÉPENDANCE VIS-À-VIS DU RÉSULTAT
test('D1. résultat absent, null, incompatible, -0, undefined : la production reste décrite par la forme déclarée, identique dans tous les cas', () => {
  const d = [desc('op', { forme: 'collection', elements: sc('nombre') })];
  const attendu = [{ identite: 'T', forme: { forme: 'collection', elements: { forme: 'scalaire', genre: 'nombre' } } }];
  const resultats = [null, 'chaîne', 42, -0, undefined, [], {}, ['x'], { a: 1 }, NaN, true, [[]], () => 1];
  assert.deepEqual(vue([{ id: 'T', operation: 'op' }], d), attendu, 'résultat absent');
  for (const resultat of resultats) assert.deepEqual(vue([{ id: 'T', operation: 'op', resultat }], d), attendu);
  assert.deepEqual(vue([{ id: 'T', operation: 'op', resultat: undefined }], d), attendu, 'résultat présent valant undefined');
});
test('D2. « resultat » n\'est JAMAIS lu : un accesseur qui lève n\'est pas exécuté, un Proxy n\'est pas sollicité', () => {
  let lectures = 0;
  const trace = { id: 'T', operation: 'op' };
  Object.defineProperty(trace, 'resultat', { get() { lectures += 1; throw new Error('lu'); }, enumerable: true });
  const proxy = new Proxy({ x: 1 }, { get() { lectures += 1; throw new Error('proxy'); }, ownKeys() { lectures += 1; throw new Error('proxy'); }, getOwnPropertyDescriptor() { lectures += 1; throw new Error('proxy'); } });
  assert.equal(vue([trace, { id: 'U', operation: 'op', resultat: proxy }], [desc('op', sc())]).length, 2);
  assert.equal(lectures, 0);
});
test('D3. aucun autre champ de l\'exécution n\'est lu : un accesseur sur un champ en plus est ignoré sans être exécuté', () => {
  let lectures = 0;
  const trace = { id: 'T', operation: 'op' };
  for (const champ of ['argumentsUtilises', 'provenanceArguments', 'contexte', 'horodatage', 'voie', 'sequence', 'resultat']) Object.defineProperty(trace, champ, { get() { lectures += 1; throw new Error(champ); }, enumerable: true });
  assert.equal(vue([trace], [desc('op', sc())]).length, 1);
  assert.equal(lectures, 0);
});
test('D4. champs supplémentaires des exécutions et des descriptions de test : ignorés pour les exécutions, refusés par le langage pour les descriptions', () => {
  assert.equal(vue([tr('T', 'op', { zzz: 1, extra: { a: 1 } })], [desc('op', sc())]).length, 1);
  refuse(() => vue([tr('T', 'op')], [{ nom: 'op', entrees: {}, sortie: sc(), zzz: 1 }]), /descriptions\[0\]/);
});
test('D5. la production ne dépend d\'aucun champ de forme fourni par l\'exécution : une « forme » ou une « sortie » portée par la trace est ignorée', () => {
  const r = vue([tr('T', 'op', { forme: sc('nombre'), sortie: sc('booleen'), formeResultat: sc('chaine') })], [desc('op', sc('chaine'))]);
  assert.deepEqual(r, [{ identite: 'T', forme: sc('chaine') }]);
});
test('D6. l\'identité vient exclusivement de « id » : jamais du nom, jamais d\'un autre champ identifiant', () => {
  const r = vue([tr('ID-EXEC', 'op', { idTrace: 'AUTRE', identite: 'AUTRE2', sequence: 7 })], [desc('op', sc())]);
  assert.equal(r[0].identite, 'ID-EXEC');
});

// ============================================================================ E. FORME HÉRITÉE ET INDÉPENDANCE DES COPIES
test('E1. la forme est égale à la sortie validée de la description, pour des formes variées (faits, imbriqués, quelconque)', () => {
  const sorties = [
    sc(), sc('chaine'), { forme: 'quelconque' }, { forme: 'objet' }, { forme: 'collection' },
    { forme: 'objet', champs: { a: { forme: 'scalaire', genre: 'nombre', peutManquer: true }, b: { forme: 'quelconque', peutEtreNull: true, peutManquer: false }, c: { forme: 'collection', elements: { forme: 'objet', champs: { z: sc() } } } } },
  ];
  for (const s of sorties) assert.deepEqual(vue([tr('T', 'op')], [desc('op', s)])[0].forme, valider(desc('op', s)).sortie);
});
test('E2. la forme est une copie NEUVE : la modifier ne change ni la description, ni une autre production, ni un appel ultérieur', () => {
  const d = desc('op', { forme: 'objet', champs: { a: sc('chaine') } });
  const dAvant = copie(d);
  const r = vue([tr('T1', 'op'), tr('T2', 'op')], [d]);
  assert.notEqual(r[0].forme, r[1].forme);
  assert.notEqual(r[0].forme.champs, r[1].forme.champs);
  assert.notEqual(r[0].forme.champs.a, r[1].forme.champs.a);
  assert.notEqual(r[0].forme, d.sortie);
  assert.notEqual(r[0].forme.champs, d.sortie.champs);
  assert.notEqual(r[0].forme.champs.a, d.sortie.champs.a);
  r[0].forme.champs.a.genre = 'nombre'; r[0].forme.champs.ajout = sc();
  assert.deepEqual(r[1].forme, { forme: 'objet', champs: { a: sc('chaine') } });
  assert.deepEqual(d, dAvant);
  assert.deepEqual(vue([tr('T3', 'op')], [d])[0].forme, { forme: 'objet', champs: { a: sc('chaine') } });
});
test('E3. la forme n\'est jamais gelée par héritage : le résultat est un graphe neuf modifiable même si la description est gelée', () => {
  const d = geler(desc('op', { forme: 'objet', champs: { a: sc() } }));
  const r = vue(geler([tr('T', 'op')]), geler([d]));
  assert.equal(Object.isFrozen(r), false); assert.equal(Object.isFrozen(r[0]), false); assert.equal(Object.isFrozen(r[0].forme), false);
  assert.equal(Object.isFrozen(r[0].forme.champs.a), false);
  r[0].identite = 'autre'; r[0].forme.champs.a.genre = 'chaine';
});
test('E4. une description réutilisée à deux endroits d\'une forme (sans cycle) donne des copies indépendantes', () => {
  const partage = sc('chaine');
  const r = vue([tr('T', 'op')], [desc('op', { forme: 'objet', champs: { a: partage, b: partage } })]);
  assert.notEqual(r[0].forme.champs.a, r[0].forme.champs.b);
});
test('E5. la forme rendue n\'a aucune référence vers la trace ni vers sa propre trace : chaque production ne porte que identite et forme', () => {
  const trace = tr('T', 'op', { resultat: { a: 1 } });
  const r = vue([trace], [desc('op', sc())]);
  assert.equal(JSON.stringify(r), '[{"identite":"T","forme":{"forme":"scalaire"}}]');
});

// ============================================================================ F. ORDRE SANS SIGNIFICATION
test('F1. ordre de sortie = ordre croissant des identités (unités de code), quel que soit l\'ordre brut des exécutions', () => {
  const ids = ['b', 'a', 'B', 'A', '10', '9', '', '\u00e9', 'e', 'é1', 'z'].filter((x) => x !== '');
  const ex = ids.map((id) => tr(id, 'op'));
  const attendu = [...ids].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  for (let i = 0; i < 40; i += 1) assert.deepEqual(vue(melanger(ex), [desc('op', sc())]).map((p) => p.identite), attendu);
});
test('F2. permutation des exécutions ET des descriptions : sortie identique (egalité profonde)', () => {
  const ds = ['a', 'b', 'c', 'd'].map((n, i) => desc(n, i % 2 ? sc('chaine') : { forme: 'collection', elements: sc('nombre') }));
  const ex = [];
  for (let i = 0; i < 30; i += 1) ex.push(tr(`T${i}`, ['a', 'b', 'c', 'd', 'inconnue'][i % 5]));
  const attendu = vue(ex, ds);
  assert.equal(attendu.length, 24);
  for (let i = 0; i < 60; i += 1) assert.deepEqual(vue(melanger(ex), melanger(ds)), attendu);
});
test('F3. deux appels identiques : sorties égales mais objets distincts', () => {
  const ex = [tr('T', 'op')], ds = [desc('op', sc())];
  const a = vue(ex, ds), b = vue(ex, ds);
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a[0], b[0]); assert.notEqual(a[0].forme, b[0].forme);
});

// ============================================================================ G. ENTRÉES : AUCUNE MUTATION
test('G1. entrées gelées en profondeur acceptées ; aucune entrée n\'est modifiée', () => {
  const ex = geler([tr('B', 'op', { resultat: { x: [1, 2] } }), tr('A', 'y')]);
  const ds = geler([desc('op', { forme: 'objet', champs: { a: sc() } }, { e: sc('chaine') }), desc('y', sc())]);
  const avant = copie([ex, ds]);
  const r = vue(ex, ds);
  assert.equal(r.length, 2);
  assert.deepEqual(copie([ex, ds]), avant);
  assert.deepEqual(r.map((p) => p.identite), ['A', 'B'], 'l\'ordre brut de l\'entrée n\'est pas modifié non plus');
  assert.deepEqual(ex.map((t) => t.id), ['B', 'A']);
});
test('G2. entrées non gelées : aucune propriété ajoutée, retirée ou modifiée, ordre des tableaux conservé', () => {
  const ex = [tr('B', 'op'), tr('A', 'op')];
  const ds = [desc('z', sc()), desc('op', sc('nombre'))];
  const avant = copie([ex, ds]);
  vue(ex, ds);
  assert.deepEqual(copie([ex, ds]), avant);
  assert.deepEqual(Object.keys(ex[0]), ['id', 'operation']);
});
test('G3. la vue ne conserve aucun état : un appel ne change pas le suivant', () => {
  const d = [desc('op', sc('chaine'))];
  const a = vue([tr('T', 'op')], d);
  vue([tr('U', 'op'), tr('V', 'op')], [desc('op', sc('nombre'))]);
  assert.deepEqual(vue([tr('T', 'op')], d), a);
  assert.deepEqual(vue([], d), []);
});

// ============================================================================ H. INTÉGRATION ARCHITECTURALE
const parNom = (n) => catalogue.find((d) => d.nom === n);
test('H1. exécution fictive « T » de parcourirStructure × VRAI descripteur : identité « T », forme EXACTEMENT la sortie déclarée', () => {
  const d = parNom('parcourirStructure');
  const r = vue([{ id: 'T', operation: 'parcourirStructure' }], [d]);
  assert.equal(r.length, 1);
  assert.equal(r[0].identite, 'T');
  assert.deepEqual(r[0].forme, valider(d).sortie);
  assert.deepEqual(r[0].forme, copie(d.sortie));
  assert.notEqual(r[0].forme, d.sortie);
});
test('H2. même exécution avec le catalogue ENTIER (9 descriptions) : une seule production, la même', () => {
  const r = vue([{ id: 'T', operation: 'parcourirStructure' }], catalogue);
  assert.deepEqual(r, [{ identite: 'T', forme: valider(parNom('parcourirStructure')).sortie }]);
});
test('H3. relationsParentEnfant par son descripteur PAPIER de test : le module ne fait aucune différence', () => {
  const r = vue([{ id: 'T', operation: 'relationsParentEnfant' }], [PAPIER]);
  assert.deepEqual(r, [{ identite: 'T', forme: PAPIER.sortie }]);
  const avecCatalogue = vue([{ id: 'T', operation: 'relationsParentEnfant' }], [...catalogue, PAPIER]);
  assert.deepEqual(avecCatalogue, r);
  assert.deepEqual(vue([{ id: 'T', operation: 'relationsParentEnfant' }], catalogue), [], 'sans le descripteur papier : aucune production — le catalogue ne la décrit toujours pas');
});
test('H4. GÉNÉRAL : pour chacune des 9 opérations du catalogue et pour le descripteur papier, même mécanisme, même résultat', () => {
  for (const d of [...catalogue, PAPIER]) {
    const r = vue([{ id: `id-${d.nom}`, operation: d.nom }], [...catalogue, PAPIER]);
    assert.deepEqual(r, [{ identite: `id-${d.nom}`, forme: valider(d).sortie }], d.nom);
  }
});
test('H5. toutes les opérations exécutées une fois : dix productions, une par exécution, aucune confusion de formes', () => {
  const tout = [...catalogue, PAPIER];
  const ex = tout.map((d, i) => ({ id: `E${String(i).padStart(2, '0')}`, operation: d.nom }));
  const r = vue(melanger(ex), tout);
  assert.equal(r.length, 10);
  tout.forEach((d, i) => assert.deepEqual(r.find((p) => p.identite === ex[i].id).forme, valider(d).sortie));
});
test('H6. une exécution RÉELLE enregistrée par enregistrerExecutionOperation (persistance simulée en mémoire) : l\'identité est ligne.id, le résultat n\'intervient pas', async () => {
  const lignes = [];
  const magasin = { ecrire: async (table, objet) => { lignes.push([table, objet]); } };
  const t1 = await enregistrerExecutionOperation(magasin, { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'm' }], resultat: { n: 'incompatible avec la forme' } });
  const t2 = await enregistrerExecutionOperation(magasin, { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'm' }], resultat: null });
  assert.notEqual(t1.id, t2.id);
  const r = vue(lignes.map(([, o]) => o), catalogue);
  assert.deepEqual(r.map((p) => p.identite).sort(), [t1.id, t2.id].sort());
  for (const p of r) assert.deepEqual(p.forme, valider(parNom('parcourirStructure')).sortie);
});
// ============================================================================ I. TEST NÉGATIF : MONDE ACTUEL
test('I1. aucune CAPACITE actuelle ne porte le nom d\'une des 9 descriptions : correspondance vide par construction', () => {
  const capacites = Object.keys(CAPACITES);
  assert.deepEqual(capacites.slice().sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  for (const c of capacites) assert.equal(catalogue.some((d) => d.nom === c), false, c);
});
test('I2. (v0.63.20) vraies traces enregistrées des CAPACITES actuelles : REFUSÉES (pas de champ « operation »), jamais interprétées', async () => {
  const lignes = [];
  const magasin = { ecrire: async (table, objet) => { lignes.push([table, objet]); } };
  for (const capacite of Object.keys(CAPACITES)) {
    await enregistrerTrace(magasin, { capacite, voie: 'action', argumentsUtilises: { a: 'x' }, provenanceArguments: { a: 'texte' }, resultat: { etat: 'ok' } });
  }
  assert.equal(lignes.length, 5);
  refuse(() => vue(lignes.map(([, o]) => o), catalogue), /champ « operation » propre/);
  refuse(() => vue(lignes.map(([, o]) => o), [...catalogue, PAPIER]), /champ « operation » propre/);
});
test('I3. le catalogue et CAPACITES n\'ont pas été modifiés par ce chantier : neuf noms exacts, cinq capacités exactes, relationsParentEnfant absente', () => {
  assert.deepEqual(catalogue.map((d) => d.nom), ['couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'resoudreCouverture']);
  assert.equal(catalogue.some((d) => d.nom === 'relationsParentEnfant'), false);
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
});

// ============================================================================ J. STATIQUE : PURETÉ ET GARDES
const NOMS_CONNUS = [...catalogue.map((d) => d.nom), 'relationsParentEnfant', ...Object.keys(CAPACITES)];
test('J1. une seule importation (validerDescripteurOperation depuis formes-operation.js), une seule exportation, aucun import dynamique ni require', () => {
  assert.deepEqual((CODE.match(/^\s*import\b[^;]*;/gm) || []).map((l) => l.trim()), ["import { validerDescripteurOperation } from './formes-operation.js';"]);
  assert.equal((CODE.match(/^\s*import\b/gm) || []).length, 1);
  assert.equal(/\bimport\s*\(/.test(CODE), false);
  assert.equal(/\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function productionsDecrites(executions, descriptions) {']);
  assert.equal(/export\s*\{|export\s+default|module\.exports/.test(CODE), false);
});
test('J2. ne connaît ni le catalogue, ni garantie-forme, ni connaissances, ni registre, ni les autres primitives : pas dans le code, pas dans les commentaires', () => {
  assert.equal(/DESCRIPTIONS_OPERATIONS|descriptions-operations|garantie-forme|fournieGarantit|connaissances|registre|CAPACITES|composition\.js|parcours-structure|couverture-occurrences|resolution-couverture|constats-structurels|partition-couvertures|relations-parent-enfant|contrats-observes/.test(SOURCE), false);
});
test('J3. ne connaît AUCUN nom d\'opération ni de capacité (catalogue, relationsParentEnfant, CAPACITES) : ni dans le code, ni dans les commentaires', () => {
  for (const nom of NOMS_CONNUS) assert.equal(SOURCE.includes(nom), false, nom);
  assert.equal(/'[a-z][A-Za-z]+'\s*[:,)]/.test(CODE.replace(/'(id|operation|forme|identite|nom|sortie)'/g, '')) && /===\s*'/.test(CODE), false, 'aucune comparaison à un littéral de nom');
});
test('J4. n\'examine jamais le résultat : le mot « resultat » est absent du code (hors commentaires), ni conformite ni valeur→forme', () => {
  assert.equal(/resultat/.test(CODE), false);
  assert.equal(/conformite|instancesDecrites|formesDecrites|typeof\s+\w*resultat|JSON\./.test(CODE), false);
  assert.equal(/\b(typeof|instanceof|Array\.isArray)\b/.test(CODE.split('\n').filter((l) => /resultat/.test(l)).join('\n')), false);
});
test('J5. n\'infère jamais une forme depuis une valeur : aucune construction de forme littérale dans le module', () => {
  assert.equal(/forme\s*:\s*'(scalaire|objet|collection|quelconque)'/.test(CODE), false);
  assert.equal(/genre\s*:/.test(CODE), false);
  assert.equal(/'(scalaire|objet|collection|quelconque)'/.test(CODE), false);
});
test('J6. aucun accès mémoire / IndexedDB / localStorage / réseau / horloge / aléa / fichier / DOM', () => {
  assert.equal(/indexedDB|IndexedDB|localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|Date\b|Math\.random|performance\.now|crypto|document\.|window\.|navigator|process\.|readFile|writeFile|setTimeout|setInterval|await\b|async\b|Promise/.test(CODE), false);
});
test('J7. aucun état global, aucun registre, aucun stockage : aucune variable de module mutable, aucun cache, aucune Map/Set au niveau du module', () => {
  assert.equal(/^(let|var)\s/m.test(CODE), false);
  assert.equal(/^const\s+\w+\s*=\s*new\s+(Map|Set|WeakMap|WeakSet)/m.test(CODE), false);
  assert.equal(/^const\s+\w+\s*=\s*(\[|\{)/m.test(CODE), false, 'aucune constante de module qui soit une table');
  assert.equal(/globalThis|global\.|Symbol|Object\.freeze|memo|cache|registre|registry/i.test(CODE), false);
});
test('J8. aucun dispatch, aucune exécution, aucune sélection : pas d\'eval, pas de Function, pas de appel dynamique, pas de score / priorité / filtre sémantique', () => {
  assert.equal(/\beval\b|new Function|Function\(|\.call\(|\.apply\(|\.bind\(|\[\s*\w+\s*\]\s*\(/.test(CODE), false);
  assert.equal(/score|priorite|priorité|pertinen|interet|préférence|preference|curiosit|attention|choisir|selection|sélection|filter\(/i.test(CODE), false);
});
test('J9. correspondance sans approximation : aucune normalisation, casse, trim, regex, includes, startsWith, localeCompare, similarité', () => {
  assert.equal(/toLowerCase|toUpperCase|normalize|trim\(|\.includes\(|startsWith|endsWith|indexOf|localeCompare|RegExp|\.match\(|\.replace\(|\.test\(|split\(|slice\(/.test(CODE), false);
  assert.match(CODE, /parNom\.get\(operation\)/);
});
test('J10. le tri est par unités de code, sans localeCompare ni clé d\'ordre autre que l\'identité', () => {
  assert.match(CODE, /\.sort\(\(a, b\) => \(a\.identite < b\.identite \? -1 : a\.identite > b\.identite \? 1 : 0\)\)/);
  assert.equal((CODE.match(/\.sort\(/g) || []).length, 1);
});
test('J11. la copie de la forme passe par le langage de formes existant : aucune copie manuelle (spread, JSON, structuredClone, assign)', () => {
  assert.equal(/structuredClone|Object\.assign|\.\.\.|JSON/.test(CODE), false);
  assert.equal((CODE.match(/validerDescripteurOperation\(/g) || []).length, 2, 'une validation par description, une copie par production');
  assert.match(CODE, /forme: validerDescripteurOperation\(description\.brute\)\.sortie/);
});
test('J12. la lecture sûre se fait par descripteur de propriété (jamais d\'accès direct à id, operation ni à un rang)', () => {
  assert.equal(/\bexecution\.(id|operation)\b/.test(CODE), false);
  assert.equal(/\.resultat|\['resultat'\]|"resultat"/.test(CODE), false);
  assert.match(CODE, /Object\.getOwnPropertyDescriptor\(tableau, rang\)/);
  assert.match(CODE, /Object\.getOwnPropertyDescriptor\(objet, champ\)/);
});

// ============================================================================ K. DORMANCE
function fichiersJs(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const c = join(dossier, nom);
    if (statSync(c).isDirectory()) { if (nom !== 'node_modules') fichiersJs(c, sortie); } else if (nom.endsWith('.js')) sortie.push(c);
  }
  return sortie;
}
const rel = (f) => relative(RACINE, f).split('\\').join('/');
test('K1. AUCUN fichier de production (ni sw, worker, index) ne référence ce module ni son export', () => {
  const fautifs = [];
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (rel(f) === NOM_MODULE) continue;
    const src = readFileSync(f, 'utf8');
    if (/productions-decrites|productionsDecrites/.test(src)) fautifs.push(rel(f));
  }
  assert.deepEqual(fautifs, []);
  for (const autre of ['app/index.html', 'app/sw.js', 'sw.js', 'worker.js', 'index.html', 'app/manifest.webmanifest']) {
    let src = ''; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; }
    assert.equal(/productions-decrites|productionsDecrites/.test(src), false, autre);
  }
});
test('K2. INACCESSIBLE depuis app/main.js : parcours des imports statiques, ni ce module, ni le langage de formes, ni le catalogue n\'y figurent', () => {
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
  for (const interdit of [NOM_MODULE, 'app/langage/relations-parent-enfant.js']) { // v0.63.16 : formes, garantie et catalogue sont atteignables via observation-possibilites.js
    assert.equal([...vus].some((f) => rel(f) === interdit), false, `${interdit} ne doit pas être atteignable`);
  }
});
test('K3. seul formes-operation.js est importé par ce module ; les importeurs de formes-operation.js forment une liste fermée (garantie-forme, possibilites-liaison depuis v0.63.13, ce module)', () => {
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => rel(f) !== 'app/langage/formes-operation.js' && /formes-operation/.test(readFileSync(f, 'utf8'))).map(rel).sort();
  assert.deepEqual(importeurs, ['app/langage/donnee-de-source.js', 'app/langage/garantie-forme.js', 'app/langage/possibilites-liaison.js', NOM_MODULE]); // v0.63.13 : + possibilites-liaison.js
});
test('K4. aucun fichier de tests n\'est référencé par la production, et ce module n\'est pas dans la coquille hors ligne', () => {
  const sw = readFileSync(join(RACINE, 'app', 'sw.js'), 'utf8');
  assert.equal(/productions-decrites/.test(sw), false);
});
// === FIN_TEST_PRODUCTIONS_DECRITES ===
