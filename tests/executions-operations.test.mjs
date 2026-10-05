// === DEBUT_TEST_EXECUTIONS_OPERATIONS ===
// v0.63.19 — décision ChatGPT « FAIT PERSISTANT D'EXÉCUTION D'UNE OPÉRATION » (05/10/2026). Preuves que la table
// executionsOperations (clé id) et sa primitive d'écriture enregistrerExecutionOperation (connaissances.js) conservent le fait
// minimal « cette opération a produit ce résultat à partir de ces données » : { id, horodatage, operation, liaisons, resultat },
// rien d'autre ; liaisons normalisées (copie, ordre canonique) ; résultat en copie JSON ; écriture tout-ou-rien ; accès par
// descripteurs ; migration 15 → 16 / sauvegarde 5 → 6 ; anciennes traces et productionsDecrites intactes ; chaînage par
// valeurDePorteur + ACCES_TRACE ; et dormance absolue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  enregistrerExecutionOperation, enregistrerTrace, magasinMemoireVive, ouvrirIndexedDB, TABLES, CLE, VERSION_BASE, NOM_BASE,
} from '../app/langage/connaissances.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees } from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { ACCES_TRACE } from '../app/langage/acces-trace.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const T = 'executionsOperations';
const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CONN = lu('app', 'langage', 'connaissances.js');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const sha = (s) => createHash('sha256').update(s).digest('hex');
const refuse = (p, motif) => assert.rejects(p, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(motif));
const piegeSur = (objet, champ) => { Object.defineProperty(objet, champ, { enumerable: true, get() { throw new Error(`accesseur ${String(champ)} exécuté`); } }); return objet; };
const R = [{ chemin: [], type: 'chaine', valeur: 'Bonjour' }];
const valide = (extra = {}) => ({ operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'message-1' }], resultat: R, ...extra });
// Magasin espion : compte les écritures, ne conserve rien d'autre.
function espion(echec = null) {
  const ecrits = [];
  return { ecrits, async ecrire(table, objet) { if (echec) throw echec; ecrits.push([table, objet]); }, async lireTout() { return []; } };
}

// ============================================================================ A. SCHÉMA EXACT
test('A1. la ligne contient EXACTEMENT { id, horodatage, operation, liaisons, resultat }', async () => {
  const m = magasinMemoireVive();
  const x = await enregistrerExecutionOperation(m, valide());
  assert.deepEqual(Object.keys(x).sort(), ['horodatage', 'id', 'liaisons', 'operation', 'resultat']);
  assert.equal('sequence' in x, false);
  for (const interdit of ['succes', 'erreur', 'tentative', 'statut', 'argumentsUtilises', 'valeurs', 'forme', 'idMessage', 'capacite', 'voie', 'contexte']) assert.equal(interdit in x, false, interdit);
  assert.equal(x.operation, 'parcourirStructure');
  assert.deepEqual(x.liaisons, [{ entree: 'valeur', donnee: 'message-1' }]);
  assert.deepEqual(x.resultat, R);
});
test('A2. id = nouvelId(\'execution-operation\') ; deux écritures, deux identités ; l\'identité est interne', async () => {
  const m = magasinMemoireVive();
  const a = await enregistrerExecutionOperation(m, valide());
  const b = await enregistrerExecutionOperation(m, valide());
  assert.match(a.id, /^execution-operation-\d+-\d+-\d+$/);
  assert.notEqual(a.id, b.id);
  assert.equal((await m.lireTout(T)).length, 2);
  refuse(enregistrerExecutionOperation(m, valide({ id: 'force' })), /étranger/);
});
test('A3. horodatage ISO créé à l\'écriture, proche de maintenant ; non fourni', async () => {
  const avant = Date.now();
  const x = await enregistrerExecutionOperation(magasinMemoireVive(), valide());
  assert.match(x.horodatage, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(new Date(x.horodatage).toISOString(), x.horodatage);
  assert.ok(Date.parse(x.horodatage) >= avant - 1 && Date.parse(x.horodatage) <= Date.now() + 1);
  refuse(enregistrerExecutionOperation(magasinMemoireVive(), valide({ horodatage: 'x' })), /étranger/);
});
test('A4. la valeur rendue = la ligne écrite (contrat sur la VALEUR, pas sur ===)', async () => {
  const m = magasinMemoireVive();
  const x = await enregistrerExecutionOperation(m, valide());
  const [relue] = await m.lireTout(T);
  assert.deepEqual(relue, x);
  assert.deepEqual(JSON.parse(JSON.stringify(x)), x); // reste intégralement représentable en JSON (sauvegarde)
});
test('A5. la clé de table est id', () => {
  assert.equal(CLE[T], 'id');
  assert.ok(TABLES.includes(T));
});

// ============================================================================ B. OPERATION
test('B1. operation : chaîne non vide, sans coercition ni trim ; le nom n\'est PAS vérifié contre les descriptions', async () => {
  for (const mauvais of ['', undefined, null, 1, true, {}, [], Symbol('o'), new String('o')]) await refuse(enregistrerExecutionOperation(espion(), valide({ operation: mauvais })), /operation|chaîne non vide/);
  const x = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ operation: ' espace ' }));
  assert.equal(x.operation, ' espace ');
  const y = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ operation: 'inconnueDeTous' }));
  assert.equal(y.operation, 'inconnueDeTous');
  const z = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ operation: 'relationsParentEnfant' }));
  assert.equal(z.operation, 'relationsParentEnfant');
});
test('B2. operation absente : TypeError', async () => {
  const { operation, ...sans } = valide();
  await refuse(enregistrerExecutionOperation(espion(), sans), /pas de champ « operation »/);
});

// ============================================================================ C. LIAISONS
test('C1. liaisons : tableau, au moins une ; objet, null, chaîne, tableau vide : refusés', async () => {
  for (const mauvais of [undefined, null, 'x', 1, {}, { length: 1, 0: { entree: 'a', donnee: 'b' } }]) await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: mauvais })), /tableau/);
  await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [] })), /au moins une/);
});
test('C2. chaque élément : objet simple ; null, primitive, tableau, fonction refusés', async () => {
  for (const mauvais of [null, undefined, 'a', 1, [], [['entree', 'a']], () => 1]) await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [mauvais] })), /objet/);
});
test('C3. entree et donnee : chaînes non vides propres de donnée ; sans coercition ni trim', async () => {
  for (const mauvais of ['', undefined, null, 1, true, {}, [], Symbol('s'), new String('a')]) {
    await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [{ entree: mauvais, donnee: 'm' }] })), /chaîne non vide|pas de champ/);
    await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [{ entree: 'e', donnee: mauvais }] })), /chaîne non vide|pas de champ/);
  }
  await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [{ entree: 'e' }] })), /pas de champ « donnee »/);
  await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [{ donnee: 'd' }] })), /pas de champ « entree »/);
  const x = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ liaisons: [{ entree: ' e ', donnee: ' d ' }] }));
  assert.deepEqual(x.liaisons, [{ entree: ' e ', donnee: ' d ' }]);
});
test('C4. entrée dupliquée refusée (même donnée ou donnée différente)', async () => {
  await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [{ entree: 'a', donnee: 'm1' }, { entree: 'a', donnee: 'm2' }] })), /dupliquée/);
  await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [{ entree: 'a', donnee: 'm1' }, { entree: 'b', donnee: 'm2' }, { entree: 'a', donnee: 'm1' }] })), /dupliquée/);
});
test('C5. la MÊME donnée peut être liée à deux entrées différentes (memesCouvertures(A, A))', async () => {
  const x = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ operation: 'memesCouvertures', liaisons: [{ entree: 'b', donnee: 'p1' }, { entree: 'a', donnee: 'p1' }] }));
  assert.deepEqual(x.liaisons, [{ entree: 'a', donnee: 'p1' }, { entree: 'b', donnee: 'p1' }]);
});
test('C6. ordre canonique par unités de code de entree, quel que soit l\'ordre fourni', async () => {
  const entrees = ['univers', 'a', 'Z', 'é', 'b', 'couverture', 'B'];
  const liaisons = entrees.map((e, i) => ({ entree: e, donnee: `d${i}` }));
  const attendu = [...entrees].sort((p, q) => (p < q ? -1 : p > q ? 1 : 0));
  for (const ordre of [liaisons, [...liaisons].reverse(), [...liaisons].sort(() => 0.5 - Math.random())]) {
    const x = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ liaisons: ordre }));
    assert.deepEqual(x.liaisons.map((l) => l.entree), attendu);
    assert.deepEqual(x.liaisons.map((l) => l.donnee), attendu.map((e) => `d${entrees.indexOf(e)}`));
  }
  assert.deepEqual(attendu.slice(0, 3), ['B', 'Z', 'a']); // majuscules avant minuscules : unités de code, pas locale
});
test('C7. COPIE des liaisons : objets fournis non conservés, et mutation ultérieure sans effet sur la ligne', async () => {
  const fournies = [{ entree: 'a', donnee: 'd1' }, { entree: 'b', donnee: 'd2' }];
  const m = magasinMemoireVive();
  const x = await enregistrerExecutionOperation(m, valide({ liaisons: fournies }));
  assert.notEqual(x.liaisons, fournies);
  for (let i = 0; i < 2; i += 1) assert.notEqual(x.liaisons[i], fournies[i]);
  fournies[0].donnee = 'modifie'; fournies.push({ entree: 'c', donnee: 'x' }); fournies[1].entree = 'zz';
  assert.deepEqual(x.liaisons, [{ entree: 'a', donnee: 'd1' }, { entree: 'b', donnee: 'd2' }]);
  assert.deepEqual((await m.lireTout(T))[0].liaisons, [{ entree: 'a', donnee: 'd1' }, { entree: 'b', donnee: 'd2' }]);
});
test('C8. aucun champ étranger dans une liaison : la valeur d\'entrée ne peut PAS être persistée', async () => {
  for (const extra of [{ valeur: 'Bonjour' }, { forme: { forme: 'quelconque' } }, { porteur: {} }, { [Symbol('s')]: 1 }]) {
    await refuse(enregistrerExecutionOperation(espion(), valide({ liaisons: [{ entree: 'valeur', donnee: 'message-1', ...extra }] })), /étranger/);
  }
});
test('C9. la complétude n\'est PAS vérifiée (une seule liaison pour memesCouvertures est enregistrée)', async () => {
  const x = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'p1' }] }));
  assert.deepEqual(x.liaisons, [{ entree: 'a', donnee: 'p1' }]);
  const y = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ operation: 'parcourirStructure', liaisons: [{ entree: 'nimporte', donnee: 'p1' }] }));
  assert.equal(y.liaisons[0].entree, 'nimporte');
});
test('C10. grand nombre de liaisons : toutes conservées et triées', async () => {
  const liaisons = Array.from({ length: 200 }, (_, i) => ({ entree: `e${String(199 - i).padStart(3, '0')}`, donnee: `d${i}` }));
  const x = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ liaisons }));
  assert.equal(x.liaisons.length, 200);
  assert.equal(x.liaisons[0].entree, 'e000');
  assert.equal(x.liaisons[199].entree, 'e199');
});

// ============================================================================ D. ENTRÉE : CHAMPS ÉTRANGERS, ACCESSEURS, HÉRITAGE
test('D1. entrée : objet simple ; null, tableau, primitive refusés', async () => {
  for (const mauvais of [null, undefined, [], 'x', 1, () => 1]) await refuse(enregistrerExecutionOperation(espion(), mauvais), /entrée doit être un objet/);
  await refuse(enregistrerExecutionOperation(espion()), /entrée doit être un objet/);
});
test('D2. champs étrangers de l\'entrée refusés : valeurs, argumentsUtilises, porteur, forme, succes, erreur, statut, idMessage, symboles, non-énumérables', async () => {
  for (const extra of ['valeurs', 'argumentsUtilises', 'porteur', 'forme', 'succes', 'erreur', 'tentative', 'statut', 'idMessage', 'sequence', 'capacite']) {
    await refuse(enregistrerExecutionOperation(espion(), valide({ [extra]: 1 })), /étranger/);
  }
  await refuse(enregistrerExecutionOperation(espion(), valide({ [Symbol('s')]: 1 })), /étranger/);
  const ne = valide(); Object.defineProperty(ne, 'cache', { value: 1, enumerable: false });
  await refuse(enregistrerExecutionOperation(espion(), ne), /étranger/);
});
test('D3. getters piégés : operation, liaisons, liaison.entree, liaison.donnee, resultat, élément de liaisons — jamais exécutés, aucune écriture', async () => {
  const m = espion();
  const sans = (champ) => { const o = valide(); delete o[champ]; return o; };
  await refuse(enregistrerExecutionOperation(m, piegeSur(sans('operation'), 'operation')), /accesseur/);
  await refuse(enregistrerExecutionOperation(m, piegeSur(sans('liaisons'), 'liaisons')), /accesseur/);
  await refuse(enregistrerExecutionOperation(m, piegeSur(sans('resultat'), 'resultat')), /accesseur/);
  await refuse(enregistrerExecutionOperation(m, valide({ liaisons: [piegeSur({ donnee: 'd' }, 'entree')] })), /accesseur/);
  await refuse(enregistrerExecutionOperation(m, valide({ liaisons: [piegeSur({ entree: 'e' }, 'donnee')] })), /accesseur/);
  const tab = [{ entree: 'a', donnee: 'd' }]; Object.defineProperty(tab, 0, { get() { throw new Error('exécuté'); }, enumerable: true });
  await refuse(enregistrerExecutionOperation(m, valide({ liaisons: tab })), /accesseur/);
  const so = {}; Object.defineProperty(so, 'operation', { set() { throw new Error('s'); }, enumerable: true }); so.liaisons = valide().liaisons; so.resultat = 1;
  await refuse(enregistrerExecutionOperation(m, so), /accesseur/);
  assert.equal(m.ecrits.length, 0);
});
test('D4. propriétés héritées refusées (entrée, liaison, tableau creux) ; objets sans prototype acceptés', async () => {
  const m = espion();
  await refuse(enregistrerExecutionOperation(m, Object.create(valide())), /pas de champ|étranger/);
  await refuse(enregistrerExecutionOperation(m, valide({ liaisons: [Object.create({ entree: 'e', donnee: 'd' })] })), /pas de champ/);
  const creux = []; creux.length = 1;
  await refuse(enregistrerExecutionOperation(m, valide({ liaisons: creux })), /pas de champ/);
  const nu = (o) => Object.assign(Object.create(null), o);
  const x = await enregistrerExecutionOperation(magasinMemoireVive(), nu({ operation: 'op', liaisons: [nu({ entree: 'e', donnee: 'd' })], resultat: nu({ a: 1 }) }));
  assert.deepEqual(x.liaisons, [{ entree: 'e', donnee: 'd' }]);
  assert.deepEqual(x.resultat, { a: 1 });
  assert.equal(m.ecrits.length, 0);
});
test('D5. resultat absent : TypeError (distinct de undefined présent, tous deux refusés)', async () => {
  const { resultat, ...sans } = valide();
  await refuse(enregistrerExecutionOperation(espion(), sans), /pas de champ « resultat »/);
  await refuse(enregistrerExecutionOperation(espion(), valide({ resultat: undefined })), /aucune valeur JSON/);
});

// ============================================================================ E. COPIE JSON DU RÉSULTAT
const ecrire = async (resultat) => enregistrerExecutionOperation(magasinMemoireVive(), valide({ resultat }));
test('E1. valeurs JSON de base conservées à l\'identique', async () => {
  for (const v of [null, 'chaîne', '', true, false, 0, 1, -1, 1.5, 1e21, { a: 1 }, [1, 2], [], {}, { a: { b: [1, { c: null }] } }, [[[]]]]) {
    assert.deepEqual((await ecrire(v)).resultat, v, JSON.stringify(v));
  }
});
test('E2. racine null : conservée (null est une valeur)', async () => {
  assert.equal((await ecrire(null)).resultat, null);
});
test('E3. racine undefined, fonction, symbole : TypeError (aucune valeur JSON), jamais SyntaxError', async () => {
  for (const v of [undefined, () => 1, function f() {}, Symbol('s'), class A {}]) {
    await assert.rejects(ecrire(v), (e) => e instanceof TypeError && !(e instanceof SyntaxError) && /aucune valeur JSON/.test(e.message), String(typeof v));
  }
});
test('E4. BigInt (racine ou imbriqué) : TypeError', async () => {
  for (const v of [10n, { a: 10n }, [1, 10n]]) await refuse(ecrire(v), /représentable en JSON/);
});
test('E5. structure cyclique : TypeError (objet, tableau, cycle indirect)', async () => {
  const a = {}; a.moi = a;
  const t = []; t.push(t);
  const b = { x: {} }; b.x.retour = b;
  for (const v of [a, t, b, { dedans: a }]) await refuse(ecrire(v), /cyclique/);
});
test('E6. même sous-objet référencé deux fois (non cyclique) : accepté et dédoublonné par la copie', async () => {
  const partage = { v: 1 };
  const x = await ecrire({ a: partage, b: partage, c: [partage, partage] });
  assert.deepEqual(x.resultat, { a: { v: 1 }, b: { v: 1 }, c: [{ v: 1 }, { v: 1 }] });
  assert.notEqual(x.resultat.a, x.resultat.b);
});
test('E7. undefined / fonction / symbole IMBRIQUÉS : propriété omise (objet), null (élément de tableau) — transformation JSON assumée', async () => {
  const x = await ecrire({ a: undefined, b: () => 1, c: Symbol('s'), d: 1, t: [undefined, () => 1, Symbol('s'), 2] });
  assert.deepEqual(x.resultat, { d: 1, t: [null, null, null, 2] });
  assert.equal(Object.hasOwn(x.resultat, 'a'), false);
});
test('E8. NaN / Infinity / -Infinity / -0 : comportement réel de la copie JSON (null, null, null, 0), racine et imbriqués', async () => {
  assert.equal((await ecrire(NaN)).resultat, null);
  assert.equal((await ecrire(Infinity)).resultat, null);
  assert.equal((await ecrire(-Infinity)).resultat, null);
  const zero = (await ecrire(-0)).resultat;
  assert.equal(Object.is(zero, 0), true);
  assert.deepEqual((await ecrire({ a: NaN, b: [Infinity, -0] })).resultat, { a: null, b: [null, 0] });
});
test('E9. trous de tableau : null (JSON) ; propriétés de symbole et non énumérables ignorées', async () => {
  const creux = [1, , 3]; // eslint-disable-line no-sparse-arrays
  assert.deepEqual((await ecrire(creux)).resultat, [1, null, 3]);
  const o = { visible: 1, [Symbol('s')]: 2 }; Object.defineProperty(o, 'cache', { value: 3, enumerable: false });
  assert.deepEqual((await ecrire(o)).resultat, { visible: 1 });
});
test('E10. aucune référence à l\'original : copie profonde, mutation ultérieure sans effet', async () => {
  const original = { liste: [{ a: 1 }], n: { m: [1, 2] } };
  const m = magasinMemoireVive();
  const x = await enregistrerExecutionOperation(m, valide({ resultat: original }));
  assert.notEqual(x.resultat, original);
  assert.notEqual(x.resultat.liste, original.liste);
  assert.notEqual(x.resultat.liste[0], original.liste[0]);
  assert.notEqual(x.resultat.n.m, original.n.m);
  original.liste[0].a = 99; original.n.m.push(3); original.nouveau = true;
  assert.deepEqual(x.resultat, { liste: [{ a: 1 }], n: { m: [1, 2] } });
  assert.deepEqual((await m.lireTout(T))[0].resultat, { liste: [{ a: 1 }], n: { m: [1, 2] } });
});
test('E11. getters imbriqués dans resultat : refusés SANS exécution (propriété, élément de tableau, profondeur)', async () => {
  const log = [];
  const pg = (o, c) => { Object.defineProperty(o, c, { enumerable: true, get() { log.push(c); throw new Error('exécuté'); } }); return o; };
  const m = espion();
  await refuse(enregistrerExecutionOperation(m, valide({ resultat: pg({}, 'a') })), /accesseur/);
  await refuse(enregistrerExecutionOperation(m, valide({ resultat: { x: [pg({}, 'b')] } })), /accesseur/);
  const tab = [1]; Object.defineProperty(tab, 1, { enumerable: true, get() { log.push('i'); throw new Error('exécuté'); } });
  await refuse(enregistrerExecutionOperation(m, valide({ resultat: { t: tab } })), /accesseur/);
  assert.deepEqual(log, []);
  assert.equal(m.ecrits.length, 0);
});
test('E12. accesseur NON énumérable ou de symbole : ignoré par JSON, donc sans effet ni exécution', async () => {
  const o = { a: 1 };
  Object.defineProperty(o, 'invisible', { enumerable: false, get() { throw new Error('exécuté'); } });
  Object.defineProperty(o, Symbol('s'), { enumerable: true, get() { throw new Error('exécuté'); } });
  assert.deepEqual((await ecrire(o)).resultat, { a: 1 });
});
test('E13. toJSON : méthode propre, héritée ou Date refusée sans exécution (aucun code, aucune transformation silencieuse)', async () => {
  let appels = 0;
  await refuse(ecrire({ toJSON() { appels += 1; return 1; } }), /toJSON/);
  class C { toJSON() { appels += 1; return 2; } }
  await refuse(ecrire({ dedans: new C() }), /toJSON/);
  await refuse(ecrire(new Date(0)), /toJSON/);
  await refuse(ecrire([new Date(0)]), /toJSON/);
  assert.equal(appels, 0);
});
test('E14. instances de classe sans toJSON, Map, Set : JSON les aplatit (objet de ses propriétés propres / {}) — transformation JSON assumée', async () => {
  class P { constructor() { this.a = 1; } }
  assert.deepEqual((await ecrire(new P())).resultat, { a: 1 });
  assert.deepEqual((await ecrire(new Map([[1, 2]]))).resultat, {});
  assert.deepEqual((await ecrire(new Set([1]))).resultat, {});
});
test('E15. clés spéciales : « __proto__ » propre (JSON.parse) préservée comme donnée, sans pollution', async () => {
  const o = JSON.parse('{"__proto__": {"danger": true}, "a": 1}');
  const x = await ecrire(o);
  assert.equal(Object.getOwnPropertyDescriptor(x.resultat, '__proto__').value.danger, true);
  assert.equal(({}).danger, undefined);
  assert.equal(Object.getPrototypeOf(x.resultat), Object.prototype);
});
test('E16. profondeur raisonnable acceptée (500 niveaux)', async () => {
  let v = 1; for (let i = 0; i < 500; i += 1) v = { v };
  const x = await ecrire(v);
  let d = 0; let c = x.resultat; while (typeof c === 'object') { c = c.v; d += 1; }
  assert.equal(d, 500);
});
test('E17. résultats réels des opérations : copie JSON identique à la valeur si elle est déjà du JSON', async () => {
  const { parcourirStructure } = await import('../app/langage/parcours-structure.js');
  const reel = parcourirStructure({ a: [1, 'b'], c: null });
  const x = await ecrire(reel);
  assert.deepEqual(x.resultat, reel);
  assert.notEqual(x.resultat, reel);
});

// ============================================================================ F. ATOMICITÉ / IMMUABILITÉ
test('F1. TOUT OU RIEN : chaque échec de validation ou de copie laisse zéro écriture', async () => {
  const m = espion();
  const cas = [
    valide({ operation: '' }), valide({ liaisons: [] }), valide({ liaisons: [{ entree: 'a', donnee: '' }] }),
    valide({ liaisons: [{ entree: 'a', donnee: 'd' }, { entree: 'a', donnee: 'e' }] }), valide({ resultat: undefined }),
    valide({ resultat: 1n }), valide({ resultat: (() => { const c = {}; c.c = c; return c; })() }), valide({ extra: 1 }),
    valide({ liaisons: [{ entree: 'a', donnee: 'd' }, null] }),
  ];
  for (const c of cas) await assert.rejects(enregistrerExecutionOperation(m, c), TypeError);
  assert.equal(m.ecrits.length, 0);
  await enregistrerExecutionOperation(m, valide());
  assert.equal(m.ecrits.length, 1);
});
test('F2. validation COMPLÈTE avant la première écriture : une liaison invalide en dernier rang empêche toute écriture', async () => {
  const m = espion();
  await refuse(enregistrerExecutionOperation(m, valide({ liaisons: [{ entree: 'a', donnee: 'd' }, { entree: 'b', donnee: 'd' }, { entree: 'c' }] })), /pas de champ/);
  await refuse(enregistrerExecutionOperation(m, valide({ resultat: { ok: 1, mauvais: 5n } })), /représentable/);
  assert.equal(m.ecrits.length, 0);
});
test('F3. UN seul appel de magasin.ecrire par fait, sur la table executionsOperations', async () => {
  const m = espion();
  const x = await enregistrerExecutionOperation(m, valide());
  assert.equal(m.ecrits.length, 1);
  assert.equal(m.ecrits[0][0], T);
  assert.deepEqual(m.ecrits[0][1], x);
});
test('F4. une panne d\'écriture se propage telle quelle ; aucune ligne', async () => {
  const sentinelle = new Error('panne');
  await assert.rejects(enregistrerExecutionOperation(espion(sentinelle), valide()), (e) => e === sentinelle);
  const m = magasinMemoireVive();
  const casse = { ...m, async ecrire() { throw sentinelle; } };
  await assert.rejects(enregistrerExecutionOperation(casse, valide()), (e) => e === sentinelle);
  assert.deepEqual(await m.lireTout(T), []);
});
test('F5. IMMUABLE : jamais de mise à jour — une deuxième écriture identique crée une deuxième ligne et ne touche pas la première', async () => {
  const m = magasinMemoireVive();
  const a = await enregistrerExecutionOperation(m, valide());
  const instantane = JSON.stringify(a);
  const b = await enregistrerExecutionOperation(m, valide());
  assert.notEqual(a.id, b.id);
  const lignes = await m.lireTout(T);
  assert.equal(lignes.length, 2);
  assert.equal(JSON.stringify(lignes.find((l) => l.id === a.id)), instantane);
});
test('F6. la primitive ne lit ni ne modifie aucune autre table', async () => {
  const lectures = []; const ecritures = [];
  const base = magasinMemoireVive();
  const m = { async lireTout(t) { lectures.push(t); return base.lireTout(t); }, async ecrire(t, o) { ecritures.push(t); return base.ecrire(t, o); }, async supprimer(t) { ecritures.push(`suppr:${t}`); } };
  await enregistrerExecutionOperation(m, valide());
  assert.deepEqual(lectures, []);
  assert.deepEqual(ecritures, [T]);
});
test('F7. le magasin reçoit un objet que l\'appelant ne peut pas retrouver ailleurs : liaisons / resultat nouveaux', async () => {
  const entree = valide();
  const m = espion();
  await enregistrerExecutionOperation(m, entree);
  const ligne = m.ecrits[0][1];
  assert.notEqual(ligne.liaisons, entree.liaisons);
  assert.notEqual(ligne.resultat, entree.resultat);
  assert.notEqual(ligne.liaisons[0], entree.liaisons[0]);
});

// ============================================================================ G. PERSISTANCE / MIGRATION / SAUVEGARDE
test('G1. VERSION_BASE 16, SCHEMA_SAUVEGARDE 6, 20 tables sans doublon', () => {
  assert.equal(VERSION_BASE, 16);
  assert.equal(SCHEMA_SAUVEGARDE, 6);
  assert.equal(TABLES.length, 20);
  assert.equal(new Set(TABLES).size, 20);
  assert.equal(TABLES[TABLES.length - 1], T);
});
test('G2. migration 15 → 16 (IndexedDB simulée) : crée SEULEMENT executionsOperations, aucune donnée existante touchée', async () => {
  const existants = TABLES.filter((t) => t !== T);
  const donnees = new Map(existants.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null; let nom = null;
  const fabrique = { open(n, v) {
    nom = n; version = v;
    const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) };
    const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
    Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); });
    return r;
  } };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nom, NOM_BASE); assert.equal(version, 16);
  assert.deepEqual(crees, [[T, 'id']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});
const maintenant = new Date('2026-10-05T09:00:00Z');
async function etat() {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  const x = await enregistrerExecutionOperation(magasinLangage, valide({ resultat: { a: [1, null, 'é'] } }));
  const y = await enregistrerExecutionOperation(magasinLangage, valide({ operation: 'memesCouvertures', liaisons: [{ entree: 'b', donnee: x.id }, { entree: 'a', donnee: 'message-1' }], resultat: true }));
  await magasinLangage.ecrire('journal', { id: 'j1', texte: 'ancien' });
  return { memoire, magasinLangage, x, y };
}
async function enSchema(fichier, schema, sansTables = []) {
  const f = JSON.parse(fichier.contenu); f.schema = schema;
  for (const t of sansTables) delete f.donnees.langage[t];
  f.empreinte = await empreinte(JSON.stringify(f.donnees)); return f;
}
test('G3. sauvegarde schéma 6 : la table est exportée et restaurée à l\'identique (aller-retour, empreinte valide)', async () => {
  const { memoire, magasinLangage, x, y } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.19', maintenant });
  assert.equal(fichier.objet.schema, 6);
  const ids = (l) => l.map((e) => e.id).sort();
  assert.deepEqual(ids(fichier.objet.donnees.langage[T]), ids([x, y]));
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  const neuf = magasinMemoireVive();
  await neuf.ecrire(T, { id: 'residu', horodatage: 'x', operation: 'x', liaisons: [], resultat: 1 });
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  const apres = await neuf.lireTout(T);
  assert.deepEqual(apres.sort((p, q) => (p.id < q.id ? -1 : 1)), [x, y].sort((p, q) => (p.id < q.id ? -1 : 1)));
  assert.deepEqual(await neuf.lireTout('journal'), [{ id: 'j1', texte: 'ancien' }]);
});
test('G4. la valeur lue après restauration est IDENTIQUE à celle d\'avant (copie JSON = représentation stable)', async () => {
  const { memoire, magasinLangage, x } = await etat();
  const avant = valeurDePorteur(x, { identite: x.id }, ACCES_TRACE);
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.19', maintenant });
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  const relue = (await neuf.lireTout(T)).find((l) => l.id === x.id);
  assert.deepEqual(valeurDePorteur(relue, { identite: x.id }, ACCES_TRACE), avant);
  assert.equal(JSON.stringify(relue), JSON.stringify(x));
});
test('G5. ANCIENNES sauvegardes (schémas 1 à 5, sans la table) : importables, table VIDE, aucune reconstruction rétroactive', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.19', maintenant });
  for (const schema of [1, 2, 3, 4, 5]) {
    const ancienne = await enSchema(fichier, schema, [T]);
    const lue = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
    assert.equal(lue.ok, true, `schéma ${schema} : ${lue.erreur}`);
    assert.deepEqual(lue.donnees.langage[T], []);
    assert.deepEqual(lue.donnees.langage.journal, [{ id: 'j1', texte: 'ancien' }]);
    const neuf = magasinMemoireVive();
    await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
    assert.deepEqual(await neuf.lireTout(T), []);
  }
});
test('G6. schéma courant (6) STRICT : sans la table = refus « incomplet » ; schéma futur (7) = refus « plus récente »', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.19', maintenant });
  const incomplet = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 6, [T])), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(incomplet.ok, false); assert.match(incomplet.erreur, /incomplet.*executionsOperations/);
  const futur = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 7)), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(futur.ok, false); assert.match(futur.erreur, /plus récente/);
});
test('G7. migrerDonnees : complète par [] pour un schéma < 6 seulement, ne fabrique jamais de ligne', () => {
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 5)[T], []);
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 1)[T], []);
  assert.equal(Object.prototype.hasOwnProperty.call(migrerDonnees({ faits: [] }, [T], 6), T), false);
  assert.deepEqual(migrerDonnees({ [T]: [{ id: 'z' }] }, [T], 5)[T], [{ id: 'z' }]);
});
test('G8. une ligne falsifiée dans le fichier est détectée par l\'empreinte', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.19', maintenant });
  const f = JSON.parse(fichier.contenu); f.donnees.langage[T][0].resultat = 'falsifié';
  const lue = await lireSauvegardeComplete(JSON.stringify(f), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, false);
});

// ============================================================================ H. ANCIENNES TRACES ET productionsDecrites INTACTES
test('H1. enregistrerTrace : code source strictement inchangé (empreinte pinglée depuis v0.63.18)', () => {
  const a = CONN.indexOf('export async function enregistrerTrace(');
  const b = CONN.indexOf('\n}\n', a) + 3;
  assert.equal(sha(CONN.slice(a, b)), '6df6f24c1fd3c9b8d678320437be590f98ba386347ab6e74d96acf914f5a424b');
});
test('H2. ACCES_TRACE : fichier inchangé et valeur inchangée (v0.63.20 : productionsDecrites lit désormais `operation`, voir execution-production.test.mjs)', () => {
  assert.equal(sha(lu('app', 'langage', 'acces-trace.js')), 'ab24a86f9e0432a4a4089d4c3ff03f0fbfa48ae70bb41d60092975b1c54510f7');
  assert.deepEqual(ACCES_TRACE, { champ: 'resultat' });
});
test('H3. (v0.63.20) productionsDecrites lit directement la ligne du nouveau fait', async () => {
  const x = await enregistrerExecutionOperation(magasinMemoireVive(), valide());
  const p = productionsDecrites([x], DESCRIPTIONS_OPERATIONS);
  assert.equal(p.length, 1);
  assert.equal(p[0].identite, x.id);
});
test('H4. écrire un fait d\'exécution ne crée, ne modifie ni ne lit aucune trace, aucun acte, aucun énoncé', async () => {
  const m = magasinMemoireVive();
  const t = await enregistrerTrace(m, { capacite: 'recherche', voie: 'action', argumentsUtilises: { a: 1 }, provenanceArguments: { a: 'texte' }, resultat: { r: 1 } });
  const avant = JSON.stringify(await m.lireTout('traces'));
  for (let i = 0; i < 3; i += 1) await enregistrerExecutionOperation(m, valide());
  assert.equal(JSON.stringify(await m.lireTout('traces')), avant);
  assert.equal((await m.lireTout('traces'))[0].id, t.id);
  for (const autre of TABLES.filter((x) => x !== T && x !== 'traces')) assert.deepEqual(await m.lireTout(autre), [], autre);
});
test('H5. format de trace inchangé : mêmes clés exactes qu\'avant', async () => {
  const t = await enregistrerTrace(magasinMemoireVive(), { capacite: 'recherche', voie: 'action', argumentsUtilises: {}, provenanceArguments: {}, resultat: 1 });
  assert.deepEqual(Object.keys(t).sort(), ['argumentsUtilises', 'capacite', 'contexte', 'horodatage', 'id', 'provenanceArguments', 'provenanceLiaisons', 'provenancePositions', 'resultat', 'sequence', 'voie']);
});
test('H6. descriptions et invocateur/table inchangés (empreintes) : aucune fonction ajoutée aux descriptions', () => {
  assert.equal(sha(lu('app', 'langage', 'descriptions-operations.js')), 'e0f2a3be84cc2d01df0e28d1fa9c78ed0905917764010a6500244a56009a5ab4');
  assert.equal(sha(lu('app', 'langage', 'invocation-operations.js')), '52504461974a5cc06dffd59d45e228218085ce9a5418910e363b23dd72843fcc');
  assert.equal(sha(lu('app', 'langage', 'table-operations.js')), '3edb73f7ea26a0abf4d5319a8d4de2780f301575eb214c60b833c63f227c3e2a');
  assert.equal(sha(lu('app', 'langage', 'acces-valeur.js')), '71ca3b0e87729237c0a1cea89c22235da568103b0763005346cbdd8cf4d7aa38');
});

// ============================================================================ I. CHAÎNAGE STRUCTUREL (sans productionsDecrites)
test('I1. valeurDePorteur(X, {identite: X.id, forme: <quelconque>}, ACCES_TRACE) rend la COPIE persistée R', async () => {
  const original = { liste: [{ a: 1 }] };
  const X = await enregistrerExecutionOperation(magasinMemoireVive(), valide({ resultat: original }));
  const v = valeurDePorteur(X, { identite: X.id, forme: { forme: 'quelconque' } }, ACCES_TRACE);
  assert.equal(v, X.resultat);
  assert.deepEqual(v, original);
  assert.notEqual(v, original);
  const autre = valeurDePorteur(X, { identite: X.id, forme: 'nimporte quoi, jamais lue' }, ACCES_TRACE);
  assert.equal(autre, X.resultat);
});
test('I2. l\'identité de la donnée produite EST X.id : une autre identité est refusée avant lecture', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, valide());
  const Y = await enregistrerExecutionOperation(m, valide({ resultat: 'autre' }));
  assert.throws(() => valeurDePorteur(X, { identite: Y.id }, ACCES_TRACE), TypeError);
  assert.equal(valeurDePorteur(Y, { identite: Y.id }, ACCES_TRACE), 'autre');
});
test('I3. la ligne relue du magasin sert de porteur (même valeur) ; valeur null et valeur fausse rendues telles quelles', async () => {
  const m = magasinMemoireVive();
  const X = await enregistrerExecutionOperation(m, valide({ resultat: null }));
  const F = await enregistrerExecutionOperation(m, valide({ resultat: false }));
  const [relueX, relueF] = [(await m.lireTout(T)).find((l) => l.id === X.id), (await m.lireTout(T)).find((l) => l.id === F.id)];
  assert.equal(valeurDePorteur(relueX, { identite: X.id }, ACCES_TRACE), null);
  assert.equal(valeurDePorteur(relueF, { identite: F.id }, ACCES_TRACE), false);
});
test('I4. une chaîne : le fait B porte l\'identité du fait A comme donnée liée ; aucune table de recherche identité→valeur', async () => {
  const m = magasinMemoireVive();
  const A = await enregistrerExecutionOperation(m, valide());
  const B = await enregistrerExecutionOperation(m, valide({ operation: 'normaliserCouverture', liaisons: [{ entree: 'chemins', donnee: A.id }], resultat: [[0]] }));
  assert.deepEqual(B.liaisons, [{ entree: 'chemins', donnee: A.id }]);
  assert.deepEqual(valeurDePorteur(A, { identite: A.id }, ACCES_TRACE), R);
  assert.deepEqual(valeurDePorteur(B, { identite: B.id }, ACCES_TRACE), [[0]]);
});

// ============================================================================ J. STATIQUE / DORMANCE
test('J1. la primitive n\'est NOMMÉE que par connaissances.js (code, hors commentaires) ; aucun autre fichier de production ne référence la table ni la primitive', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f);
    if (r === 'app/langage/connaissances.js') continue;
    assert.equal(/enregistrerExecutionOperation|executionsOperations|execution-operation/.test(sansCommentaires(readFileSync(f, 'utf8'))), false, r);
  }
  for (const autre of ['app/index.html', 'app/sw.js', 'sw.js', 'worker.js', 'index.html', 'app/manifest.webmanifest']) {
    let src; try { src = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; }
    assert.equal(/executionsOperations|enregistrerExecutionOperation/.test(src), false, autre);
  }
});
test('J2. dormance : aucun appel depuis main, pont, ecran, observation, invocation, table, possibilités, productions, action, composition, esprit', () => {
  for (const n of ['app/main.js', 'app/langage/pont.js', 'app/langage/ecran.js', 'app/langage/observation-possibilites.js', 'app/langage/invocation-operations.js',
    'app/langage/table-operations.js', 'app/langage/possibilites-liaison.js', 'app/langage/productions-decrites.js', 'app/langage/action.js',
    'app/langage/composition.js', 'app/langage/esprit.js', 'app/langage/vue-traces.js', 'app/langage/registre.js', 'app/langage/donnee-de-source.js', 'app/langage/acces-valeur.js']) {
    assert.equal(/enregistrerExecutionOperation|executionsOperations|execution-operation/.test(lu(...n.split('/'))), false, n);
  }
});
test('J3. dans connaissances.js, la primitive n\'a aucun appelant et la table n\'est lue par aucune fonction du fichier', () => {
  const code = sansCommentaires(CONN);
  assert.equal((code.match(/enregistrerExecutionOperation\(/g) || []).length, 1); // la seule occurrence est la définition
  assert.equal((code.match(/export async function enregistrerExecutionOperation\(/g) || []).length, 1);
  assert.equal((code.match(/'executionsOperations'/g) || []).length, 2); // TABLES + écriture (la clé de CLE n'est pas quotée)
  assert.equal(/lireTout\(\s*['"]executionsOperations/.test(code), false);
});
test('J4. connaissances.js n\'importe ni les descriptions, ni la table d\'opérations, ni l\'invocateur, ni l\'accès pur, ni productionsDecrites', () => {
  const imports = CONN.match(/^import\b[^;]*;/gm) || [];
  for (const l of imports) assert.equal(/descriptions-operations|table-operations|invocation-operations|acces-valeur|acces-trace|productions-decrites|possibilites-liaison|formes-operation/.test(l), false, l);
});
test('J5. la primitive n\'utilise ni importation dynamique, ni eval, ni sérialiseur riche', () => {
  const a = CONN.indexOf('function champPropreDonnee(');
  const b = CONN.indexOf('// === FIN_LANGAGE_CONNAISSANCES ===');
  const corps = sansCommentaires(CONN.slice(a, b));
  assert.equal(/\beval\b|new\s+Function|import\s*\(|structuredClone|BigInt\(|Proxy|Reflect\.apply/.test(corps), false);
  assert.equal((corps.match(/JSON\.parse\(/g) || []).length, 1);
  assert.equal((corps.match(/JSON\.stringify\(/g) || []).length, 1);
  assert.equal((corps.match(/magasin\.ecrire\(/g) || []).length, 1);
  assert.equal(/magasin\.(lireTout|supprimer|vider|remplacerTout)/.test(corps), false);
});
test('J6. aucune valeur d\'entrée, forme, porteur, convention d\'appel ni statut dans la ligne (source de l\'objet écrit)', () => {
  const a = CONN.indexOf("const objet = {\n    id: nouvelId('execution-operation')");
  assert.ok(a > 0);
  const b = CONN.indexOf("await magasin.ecrire('executionsOperations'");
  const bloc = CONN.slice(a, b);
  assert.deepEqual([...bloc.matchAll(/^\s+(\w+)[,:]/gm)].map((m) => m[1]), ['id', 'horodatage', 'operation', 'liaisons', 'resultat']);
});
// === FIN_TEST_EXECUTIONS_OPERATIONS ===
