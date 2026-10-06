// === DEBUT_TEST_FORMES_OPERATION ===
// v0.62.7 — ÉTAPE 6, décision ChatGPT « FORMES D'OPÉRATION » (04/10/2026). Teste le module PUR ET DORMANT
// validerDescripteurOperation() : il répond seulement « ce descripteur respecte-t-il notre langage de
// formes ? » (copie indépendante ou TypeError). Les contrats réels ci-dessous n'existent QUE dans ces tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { CONTRATS } from './contrats-observes.mjs';

const sc = (genre) => (genre === undefined ? { forme: 'scalaire' } : { forme: 'scalaire', genre });
const ob = (champs) => (champs === undefined ? { forme: 'objet' } : { forme: 'objet', champs });
const co = (elements) => (elements === undefined ? { forme: 'collection' } : { forme: 'collection', elements });
const op = (sortie, entrees = {}, nom = 'operation_de_test') => ({ nom, entrees, sortie });
const sortieAvecChamp = (champ) => op(ob({ x: champ }));
const refuse = (d, motif) => assert.throws(() => valider(d), (e) => e instanceof TypeError && (motif ? motif.test(e.message) : true), 'devait refuser avec un TypeError');

// ============================================================================ A. LES TROIS FORMES
test('A1. scalaire sans genre = scalaire primitif non précisé ; chaque genre est accepté tel quel', () => {
  assert.deepEqual(valider(op(sc())).sortie, { forme: 'scalaire' });
  for (const g of ['chaine', 'nombre', 'booleen']) assert.deepEqual(valider(op(sc(g))).sortie, { forme: 'scalaire', genre: g });
  assert.equal('genre' in valider(op(sc())).sortie, false, 'aucun genre inventé');
});

test('A2. objet sans champs = intérieur non décrit ; objet avec champs ; objet à champs vides reste distinct de « non décrit »', () => {
  assert.deepEqual(valider(op(ob())).sortie, { forme: 'objet' });
  assert.deepEqual(valider(op(ob({ a: sc('chaine'), b: sc() }))).sortie, { forme: 'objet', champs: { a: { forme: 'scalaire', genre: 'chaine' }, b: { forme: 'scalaire' } } });
  assert.deepEqual(valider(op(ob({}))).sortie, { forme: 'objet', champs: {} });
  assert.notDeepEqual(valider(op(ob({}))).sortie, valider(op(ob())).sortie);
});

test('A3. collection sans éléments = éléments non décrits ; collection de scalaires / d\'objets', () => {
  assert.deepEqual(valider(op(co())).sortie, { forme: 'collection' });
  assert.deepEqual(valider(op(co(sc('chaine')))).sortie, { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } });
  assert.deepEqual(valider(op(co(ob()))).sortie, { forme: 'collection', elements: { forme: 'objet' } });
});

test('A4. récursion : collection -> objet -> champ ids -> collection -> chaine', () => {
  const d = op(co(ob({ ids: co(sc('chaine')) })));
  assert.deepEqual(valider(d), d);
  assert.deepEqual(valider(d).sortie.elements.champs.ids.elements, { forme: 'scalaire', genre: 'chaine' });
});

test('A5. une collection DIRECTE se distingue d\'un objet contenant un champ collection', () => {
  const directe = valider(op(co(sc('chaine')))).sortie;
  const enveloppee = valider(op(ob({ valeurs: co(sc('chaine')) }))).sortie;
  assert.notDeepEqual(directe, enveloppee);
  assert.equal(directe.forme, 'collection');
  assert.equal(enveloppee.forme, 'objet');
});

test('A6. collection de chaînes ≠ collection d\'objets {id,texte} ≠ collection d\'objets {id,valeur} (la forme des éléments est portée)', () => {
  const a = valider(op(co(sc('chaine')))).sortie;
  const b = valider(op(co(ob({ id: sc('chaine'), texte: sc('chaine') })))).sortie;
  const c = valider(op(co(ob({ id: sc('chaine'), valeur: sc() })))).sortie;
  assert.notDeepEqual(a, b); assert.notDeepEqual(b, c); assert.notDeepEqual(a, c);
});

test('A7. le descripteur d\'opération est exactement { nom, entrees, sortie } ; entrees peut être vide', () => {
  const r = valider({ nom: 'op', entrees: {}, sortie: sc() });
  assert.deepEqual(Object.keys(r), ['nom', 'entrees', 'sortie']);
  assert.deepEqual(r.entrees, {});
  assert.equal(r.nom, 'op');
});

// ============================================================================ B. NULL / ABSENCE (les quatre cas)
const champSortie = (faits) => valider(sortieAvecChamp({ ...sc('chaine'), ...faits })).sortie.champs.x;

test('B1. A -- champ de sortie toujours présent mais nullable : peutEtreNull seul', () => {
  assert.deepEqual(champSortie({ peutEtreNull: true }), { forme: 'scalaire', genre: 'chaine', peutEtreNull: true });
});
test('B2. B -- champ de sortie pouvant manquer mais non nullable : peutManquer seul', () => {
  assert.deepEqual(champSortie({ peutManquer: true }), { forme: 'scalaire', genre: 'chaine', peutManquer: true });
});
test('B3. C -- champ pouvant manquer ET nullable : les deux propriétés ne s\'excluent pas', () => {
  assert.deepEqual(champSortie({ peutManquer: true, peutEtreNull: true }), { forme: 'scalaire', genre: 'chaine', peutManquer: true, peutEtreNull: true });
});
test('B4. D -- champ obligatoire non nullable : aucun fait', () => {
  assert.deepEqual(champSortie({}), { forme: 'scalaire', genre: 'chaine' });
});
test('B5. les quatre descriptions sont deux à deux DISTINCTES, y compris après sérialisation', () => {
  const quatre = [champSortie({ peutEtreNull: true }), champSortie({ peutManquer: true }), champSortie({ peutManquer: true, peutEtreNull: true }), champSortie({})];
  const jsons = quatre.map((q) => JSON.stringify(q));
  assert.equal(new Set(jsons).size, 4);
});
test('B6. un fait absent reste absent, un fait écrit false reste false (aucune normalisation)', () => {
  const r = champSortie({ peutManquer: false });
  assert.equal('peutEtreNull' in r, false);
  assert.equal(r.peutManquer, false);
  assert.notDeepEqual(champSortie({ peutManquer: false }), champSortie({}));
});
test('B7. ENTRÉES : omissible est accepté seul, sans devenir nullable ; peutManquer reste refusé (v0.63.3 : peutEtreNull y est désormais permis, voir tests/formes-extension.test.mjs)', () => {
  const r = valider(op(sc(), { a: { ...sc('chaine'), omissible: true }, b: sc('chaine') }));
  assert.deepEqual(r.entrees, { a: { forme: 'scalaire', genre: 'chaine', omissible: true }, b: { forme: 'scalaire', genre: 'chaine' } });
  assert.equal(Object.values(r.entrees).some((c) => 'peutEtreNull' in c || 'peutManquer' in c), false, 'aucun fait nullable n\'est INVENTÉ par la copie');
  refuse(op(sc(), { a: { ...sc(), peutManquer: true } }), /peutManquer/);
});
test('B8. SORTIE : omissible est refusé (fait d\'entrée sur une sortie)', () => {
  refuse(sortieAvecChamp({ ...sc(), omissible: true }), /omissible/);
});
test('B9. les faits portent aussi sur des champs imbriqués, du bon côté dans chaque cas', () => {
  const s = valider(op(co(ob({ y: { ...sc(), peutEtreNull: true } })))).sortie;
  assert.equal(s.elements.champs.y.peutEtreNull, true);
  const e = valider(op(sc(), { liste: co(ob({ y: { ...sc(), omissible: true } })) })).entrees.liste;
  assert.equal(e.elements.champs.y.omissible, true);
  refuse(op(sc(), { liste: co(ob({ y: { ...sc(), peutManquer: true } })) }), /peutManquer/);
});
test('B10. aucun fait sur la sortie racine ni sur un élément de collection', () => {
  refuse(op({ ...sc(), peutEtreNull: true }), /peutEtreNull/);
  refuse(op({ ...sc(), peutManquer: true }), /peutManquer/);
  refuse(op(co({ ...sc(), peutEtreNull: true })), /peutEtreNull/);
  refuse(op(sc(), { a: co({ ...sc(), omissible: true }) }), /omissible/);
});
test('B11. un fait doit être un vrai booléen (ni 1, ni "true", ni null, ni undefined)', () => {
  for (const v of [1, 0, 'true', null, undefined, {}, []]) {
    refuse(sortieAvecChamp({ ...sc(), peutManquer: v }), /peutManquer/);
    refuse(sortieAvecChamp({ ...sc(), peutEtreNull: v }), /peutEtreNull/);
    refuse(op(sc(), { a: { ...sc(), omissible: v } }), /omissible/);
  }
});
test('B12. undefined n\'a pas de notion propre : aucune propriété de ce nom n\'existe', () => {
  refuse(sortieAvecChamp({ ...sc(), peutEtreUndefined: true }));
  refuse(sortieAvecChamp({ ...sc(), undefined: true }));
});

// ============================================================================ C. REFUS (TypeError, rien n'est réparé)
test('C1. forme inconnue, absente ou de mauvais type', () => {
  refuse(op({ forme: 'union' }), /forme/);
  refuse(op({ forme: 'Scalaire' }), /forme/);
  refuse(op({}), /forme/);
  refuse(op({ forme: 3 }), /forme/);
  refuse(op({ forme: undefined }), /forme/);
});
test('C2. genre scalaire inconnu ; genre sur objet / collection ; genre non chaîne', () => {
  refuse(op({ forme: 'scalaire', genre: 'entier' }), /genre/);
  refuse(op({ forme: 'scalaire', genre: 'Chaine' }), /genre/);
  refuse(op({ forme: 'scalaire', genre: null }), /genre/);
  refuse(op({ forme: 'scalaire', genre: undefined }), /genre/);
  refuse(op({ forme: 'objet', genre: 'chaine' }), /genre/);
  refuse(op({ forme: 'collection', genre: 'chaine' }), /genre/);
});
test('C3. champs sur scalaire ou collection ; éléments sur scalaire ou objet', () => {
  refuse(op({ forme: 'scalaire', champs: {} }), /champs/);
  refuse(op({ forme: 'collection', champs: {} }), /champs/);
  refuse(op({ forme: 'scalaire', elements: sc() }), /elements/);
  refuse(op({ forme: 'objet', elements: sc() }), /elements/);
});
test('C4. champs / éléments de mauvaise nature', () => {
  refuse(op({ forme: 'objet', champs: [] }), /objet simple/);
  refuse(op({ forme: 'objet', champs: null }), /objet simple/);
  refuse(op({ forme: 'objet', champs: 'a' }), /objet simple/);
  refuse(op({ forme: 'objet', champs: { a: 'scalaire' } }), /objet simple/);
  refuse(op({ forme: 'objet', champs: { a: null } }), /objet simple/);
  refuse(op({ forme: 'objet', champs: { '': sc() } }), /vide/);
  refuse(op({ forme: 'collection', elements: [] }), /objet simple/);
  refuse(op({ forme: 'collection', elements: null }), /objet simple/);
  refuse(op({ forme: 'collection', elements: 'chaine' }), /objet simple/);
  refuse(op({ forme: 'collection', elements: undefined }), /objet simple/);
});
test('C5. propriété inconnue sur une forme, sur un champ ou sur le descripteur', () => {
  refuse(op({ forme: 'scalaire', description: 'x' }), /description/);
  refuse(op(ob({ a: { ...sc(), exemple: 1 } })), /exemple/);
  refuse({ nom: 'op', entrees: {}, sortie: sc(), version: 1 }, /version/);
});
test('C6. nom d\'opération invalide', () => {
  for (const nom of [undefined, null, '', '   ', '\n', 3, true, {}, [], () => 1]) refuse({ nom, entrees: {}, sortie: sc() }, /nom/);
  refuse({ entrees: {}, sortie: sc() }, /nom/);
});
test('C7. entrees ou sortie absentes, ou entrees qui n\'est pas un objet simple', () => {
  refuse({ nom: 'op', sortie: sc() }, /entrees/);
  refuse({ nom: 'op', entrees: {} }, /sortie/);
  for (const e of [null, undefined, [], 'a', 3, true]) refuse({ nom: 'op', entrees: e, sortie: sc() });
  for (const s of [null, undefined, [], 'a', 3, true]) refuse({ nom: 'op', entrees: {}, sortie: s });
});
test('C8. descripteur lui-même invalide : null, undefined, tableau, chaîne, nombre, fonction', () => {
  for (const d of [null, undefined, [], 'op', 3, true, () => 1]) refuse(d);
});
test('C9. objets de classe, objets à propriété symbole ou à accesseur : refusés', () => {
  class Forme { constructor() { this.forme = 'scalaire'; } }
  refuse(op(new Forme()), /classe/);
  refuse(op({ forme: 'scalaire', [Symbol('s')]: 1 }), /symbole/);
  const accesseur = { forme: 'scalaire' };
  Object.defineProperty(accesseur, 'genre', { get() { return 'chaine'; }, enumerable: true });
  refuse(op(accesseur), /accesseur/);
});
test('C10. un objet sans prototype est un objet simple valide', () => {
  const nu = Object.assign(Object.create(null), { forme: 'scalaire', genre: 'nombre' });
  assert.deepEqual(valider(op(nu)).sortie, { forme: 'scalaire', genre: 'nombre' });
});
test('C11. aucune réparation : le refus ne dépend pas de l\'ordre et ne renvoie jamais de valeur partielle', () => {
  const invalide = op(ob({ ok: sc('chaine'), mauvais: sc('entier') }));
  assert.throws(() => valider(invalide), TypeError);
  let r; try { r = valider(invalide); } catch { /* attendu */ }
  assert.equal(r, undefined);
});

// ============================================================================ D. CYCLES
test('D1. une collection qui se contient elle-même est refusée (pas de récursion infinie)', () => {
  const c = { forme: 'collection' }; c.elements = c;
  refuse(op(c), /cycle/);
});
test('D2. un objet qui se contient par ses champs, directement ou en profondeur', () => {
  const o = { forme: 'objet', champs: {} }; o.champs.soi = o;
  refuse(op(o), /cycle/);
  const a = { forme: 'objet', champs: {} }; const b = { forme: 'collection', elements: a }; a.champs.b = b;
  refuse(op(b), /cycle/);
});
test('D3. un cycle côté entrées est aussi refusé', () => {
  const c = { forme: 'collection' }; c.elements = c;
  refuse(op(sc(), { a: c }), /cycle/);
});
test('D4. une même forme réutilisée à deux endroits SANS cycle est acceptée et copiée deux fois, indépendamment', () => {
  const partagee = ob({ id: sc('chaine') });
  const r = valider(op(ob({ a: partagee, b: partagee, c: co(partagee) })));
  assert.deepEqual(r.sortie.champs.a, r.sortie.champs.b);
  assert.notEqual(r.sortie.champs.a, r.sortie.champs.b);
  assert.notEqual(r.sortie.champs.a.champs, r.sortie.champs.c.elements.champs);
  r.sortie.champs.a.champs.id.genre = 'nombre';
  assert.equal(r.sortie.champs.b.champs.id.genre, 'chaine');
});

// ============================================================================ E. COPIE / IMMUTABILITÉ / JSON
test('E1. muter l\'entrée après validation ne modifie pas la copie', () => {
  const d = op(ob({ ids: co(sc('chaine')) }), { e: { ...co(ob({ id: sc('chaine') })), omissible: true } });
  const r = valider(d);
  const avant = JSON.stringify(r);
  d.nom = 'autre'; d.sortie.champs.ids.elements.genre = 'nombre'; d.sortie.champs.nouveau = sc(); d.entrees.e.omissible = false; d.entrees.e.elements.champs.id.genre = 'booleen';
  assert.equal(JSON.stringify(r), avant);
});
test('E2. muter la copie ne modifie pas l\'entrée', () => {
  const d = op(ob({ ids: co(sc('chaine')) }));
  const avant = JSON.stringify(d);
  const r = valider(d);
  r.nom = 'x'; r.sortie.champs.ids.elements.genre = 'nombre'; delete r.sortie.champs.ids; r.entrees.z = sc();
  assert.equal(JSON.stringify(d), avant);
});
test('E3. aucune référence partagée entre entrée et copie', () => {
  const d = op(ob({ a: sc('chaine') }), { e: sc() });
  const r = valider(d);
  assert.notEqual(r, d); assert.notEqual(r.entrees, d.entrees); assert.notEqual(r.sortie, d.sortie);
  assert.notEqual(r.sortie.champs, d.sortie.champs); assert.notEqual(r.sortie.champs.a, d.sortie.champs.a); assert.notEqual(r.entrees.e, d.entrees.e);
});
test('E4. le descripteur validé est JSON-sérialisable à l\'identique et ne contient aucune fonction', () => {
  const r = valider(op(co(ob({ id: sc('chaine'), v: { ...sc(), peutManquer: true, peutEtreNull: true } })), { e: { ...sc('chaine'), omissible: true } }));
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  const parcourir = (x) => { assert.notEqual(typeof x, 'function'); assert.notEqual(typeof x, 'undefined'); if (x && typeof x === 'object') Object.values(x).forEach(parcourir); };
  parcourir(r);
});
test('E5. un descripteur gelé est accepté ; la copie, elle, n\'est pas gelée', () => {
  const gele = (x) => { Object.freeze(x); if (x && typeof x === 'object') Object.values(x).forEach(gele); return x; };
  const r = valider(gele(op(ob({ a: sc() }), { e: sc('nombre') })));
  assert.equal(Object.isFrozen(r), false); assert.equal(Object.isFrozen(r.sortie.champs), false);
});
test('E6. valider est idempotente et déterministe', () => {
  const d = op(co(ob({ id: sc('chaine'), t: { ...sc(), peutEtreNull: true } })), { a: { ...sc('chaine'), omissible: true } });
  const r1 = valider(d); const r2 = valider(r1);
  assert.deepEqual(r1, r2); assert.equal(JSON.stringify(r1), JSON.stringify(valider(d)));
});
test('E7. l\'ordre des champs est conservé ; un champ nommé __proto__ reste un champ ordinaire, sans toucher au prototype', () => {
  const r = valider(op(ob({ z: sc(), a: sc(), m: sc() })));
  assert.deepEqual(Object.keys(r.sortie.champs), ['z', 'a', 'm']);
  const d = op({ forme: 'objet', champs: JSON.parse('{"__proto__": {"forme": "scalaire"}, "b": {"forme": "scalaire"}}') });
  const r2 = valider(d);
  assert.deepEqual(Object.keys(r2.sortie.champs), ['__proto__', 'b']);
  assert.equal(Object.getPrototypeOf(r2.sortie.champs), Object.prototype);
  assert.equal(({}).forme, undefined, 'Object.prototype non pollué');
});
test('E8. le nom est conservé tel quel (aucune normalisation)', () => {
  assert.equal(valider({ nom: '  Ré cherche  ', entrees: {}, sortie: sc() }).nom, '  Ré cherche  ');
});

// ============================================================================ F. CONTRATS OBSERVÉS -- DANS LES TESTS SEULEMENT
// v0.62.9 : les contrats des fonctions réelles viennent de la source unique tests/contrats-observes.mjs ; leur fidélité
// aux fonctions réelles est prouvée dans tests/contrats-observes.test.mjs. Ici on prouve seulement que le
// vocabulaire de v0.62.7 les accepte tels quels et les rend identiques (aucune normalisation).
test('F1. recherche : entrées scalaires non précisées ; sortie objet avec sujets = collection de chaînes', () => {
  const r = valider(CONTRATS.recherche);
  assert.deepEqual(r, CONTRATS.recherche);
  assert.deepEqual(Object.keys(r.entrees), ['relation', 'valeur']);
  assert.equal(r.entrees.valeur.genre, undefined);
  assert.deepEqual(r.sortie.champs.sujets, { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } });
});

test('F2. decrireStructureIdentifiee : elements = collection<objet{id:chaine, texte:chaine}> ; sortie = objet{couverture, rapport:objet}', () => {
  const r = valider(CONTRATS.decrireStructureIdentifiee);
  assert.deepEqual(r, CONTRATS.decrireStructureIdentifiee);
  assert.deepEqual(r.sortie.champs.rapport, { forme: 'objet' }, 'rapport reste un objet dont l\'intérieur n\'est pas décrit');
  assert.deepEqual(Object.keys(r.sortie.champs).sort(), ['couverture', 'rapport']);
});

test('F3. deduction : AUCUN champ ok ; resultat = présent mais nullable ; conflit = booléen qui peut manquer ; candidats et regle peuvent manquer (descriptions distinctes)', () => {
  const r = valider(CONTRATS.deduction);
  assert.deepEqual(r, CONTRATS.deduction);
  assert.equal('ok' in r.sortie.champs, false, 'v0.62.7 décrivait à tort un champ ok que la fonction ne rend pas');
  assert.deepEqual(r.sortie.champs.resultat, { forme: 'scalaire', genre: 'chaine', peutEtreNull: true });
  assert.deepEqual(r.sortie.champs.conflit, { forme: 'scalaire', genre: 'booleen', peutManquer: true });
  assert.equal(r.sortie.champs.candidats.peutManquer, true);
  assert.equal(r.sortie.champs.regle.peutManquer, true);
  assert.notDeepEqual(r.sortie.champs.resultat, r.sortie.champs.conflit);
  assert.equal('peutManquer' in r.sortie.champs.resultat, false);
  assert.equal('peutEtreNull' in r.sortie.champs.conflit, false);
});

test('F4. repererMotifs : sortie collection DIRECTE d\'objets contenant une couverture ; options omissible et non nullable', () => {
  const r = valider(CONTRATS.repererMotifs);
  assert.deepEqual(r, CONTRATS.repererMotifs);
  assert.equal(r.sortie.forme, 'collection');
  assert.deepEqual(Object.keys(r.sortie.elements.champs).sort(), ['cle', 'couverture', 'gabarit']);
  assert.equal(r.entrees.options.omissible, true);
  assert.equal('peutEtreNull' in r.entrees.options, false);
});

test('F4b. decrireValeursObservees : les éléments de valeurs sont {valeur, ids} (jamais id) ; nonResolus et ambigus sont décrits', () => {
  const r = valider(CONTRATS.decrireValeursObservees);
  assert.deepEqual(r, CONTRATS.decrireValeursObservees);
  assert.deepEqual(Object.keys(r.sortie.champs.valeurs.elements.champs).sort(), ['ids', 'valeur']);
  assert.deepEqual(Object.keys(r.sortie.champs).sort(), ['ambigus', 'nombreValeurs', 'nonResolus', 'valeurs']);
});

test('F5. EXEMPLE GÉNÉRIQUE (non une opération réelle) : une classe d\'identités (.ids) et une collection {id,valeur} se décrivent avec le même vocabulaire, sans notion d\'id', () => {
  const classe = valider(op(ob({ ids: co(sc('chaine')) }))).sortie;
  const idValeur = valider(op(co(ob({ id: sc('chaine'), valeur: { ...sc(), peutEtreNull: true } })))).sortie;
  assert.equal(classe.champs.ids.forme, 'collection');
  assert.equal(idValeur.elements.champs.valeur.peutEtreNull, true);
  assert.equal(JSON.stringify(idValeur).includes('"id":{"forme":"scalaire","genre":"chaine"}'), true, 'id est un champ ordinaire de chaîne');
});

// ============================================================================ G. STATIQUE : DORMANCE ET PURETÉ
const RACINE = join(import.meta.dirname, '..');
const sansCommentaires = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
function fichiersJs(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) { if (nom !== 'node_modules') fichiersJs(chemin, sortie); } else if (nom.endsWith('.js')) sortie.push(chemin);
  }
  return sortie;
}
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'formes-operation.js'), 'utf8');
const CODE = sansCommentaires(SOURCE);

// v0.62.8 : exception EXPLICITE ET FERMÉE -- un seul fichier de production peut importer ce module, pour réutiliser
// sa validation (garantie-forme.js -> formes-operation.js). Aucun autre fichier ne peut l'importer ni le nommer.
const IMPORTEURS_AUTORISES = ['app/langage/garantie-forme.js', 'app/langage/productions-decrites.js', 'app/langage/possibilites-liaison.js', 'app/langage/donnee-de-source.js', 'app/langage/groupes-candidats.js', 'app/langage/conformite-application.js', 'app/langage/empreinte-contrats.js', 'app/langage/applications-sollicitables.js', 'app/langage/empreinte-relations.js']; // MISE À JOUR DÉLIBÉRÉE v0.63.61 : + applications-sollicitables.js (lit les relations déclarées du descripteur validé) et empreinte-relations.js (empreinte dormante des relations, gardée par tests/relations-entrees.test.mjs) ; v0.63.51 : + empreinte-contrats.js (empreinte des contrats, gardé par tests/empreinte-contrats.test.mjs) ; v0.63.40 : + conformite-application.js (contrôle application ↔ catalogue, gardé par tests/conformite-application.test.mjs) ; v0.63.12 : + productions-decrites.js (gardé par tests/productions-decrites.test.mjs) ; v0.63.13 : + possibilites-liaison.js (gardé par tests/possibilites-liaison.test.mjs)
const IMPORT_FORMES = "import { validerDescripteurOperation } from './formes-operation.js';";
const IMPORTS_ATTENDUS = { 'app/langage/empreinte-contrats.js': [IMPORT_FORMES, "import { sha256Hex } from './sha256.js';"], 'app/langage/empreinte-relations.js': [IMPORT_FORMES, "import { sha256Hex } from './sha256.js';"], 'app/langage/applications-sollicitables.js': ["import { groupesDeCandidats } from './groupes-candidats.js';", "import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';", IMPORT_FORMES, "import { resoudreValeursApplication } from './valeurs-application.js';", "import { relationsSatisfaites } from './relations-entrees.js';"], 'app/langage/possibilites-liaison.js': [IMPORT_FORMES, "import { fournieGarantitAttendue } from './garantie-forme.js';"], 'app/langage/productions-decrites.js': [IMPORT_FORMES, "import { sousDonneesCanoniques, formeSousDonnee } from './sous-donnees.js';"] }; // MISE À JOUR DÉLIBÉRÉE v0.63.46 : productions-decrites.js importe aussi sous-donnees.js (module pur, sans import) ; il reste un importeur du langage de formes, la liste fermée ne change pas // seul importeur à deux dépendances : le langage de formes ET sa relation de garantie
test('G1. DORMANT : seul garantie-forme.js (exception fermée) connaît le module ; registre, composition, action, ecran, vue-traces, main, sw, worker, index l\'ignorent', () => {
  const fichiers = [...fichiersJs(join(RACINE, 'app')), join(RACINE, 'sw.js'), join(RACINE, 'worker.js'), join(RACINE, 'index.html')];
  for (const f of fichiers) {
    if (f.endsWith('formes-operation.js')) continue;
    const rel = relative(RACINE, f).split('\\').join('/');
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (IMPORTEURS_AUTORISES.includes(rel)) {
      const code = sansCommentaires(src);
      assert.deepEqual(code.match(/^\s*import\b[^;]*;/gm).map((l) => l.trim()), IMPORTS_ATTENDUS[rel] || [IMPORT_FORMES], `${rel} : exactement ces dépendances et aucune autre`);
      continue;
    }
    assert.equal(/formes-operation|validerDescripteurOperation/.test(src), false, `${rel} ne doit jamais l'utiliser`);
  }
  assert.deepEqual(IMPORTEURS_AUTORISES, ['app/langage/garantie-forme.js', 'app/langage/productions-decrites.js', 'app/langage/possibilites-liaison.js', 'app/langage/donnee-de-source.js', 'app/langage/groupes-candidats.js', 'app/langage/conformite-application.js', 'app/langage/empreinte-contrats.js', 'app/langage/applications-sollicitables.js', 'app/langage/empreinte-relations.js'], 'MISE À JOUR DÉLIBÉRÉE v0.63.61 : + applications-sollicitables.js, empreinte-relations.js ; MISE À JOUR DÉLIBÉRÉE v0.63.51 : + empreinte-contrats.js ; v0.63.40 : + conformite-application.js ; la liste autorisée reste fermée à quatre fichiers (v0.63.15 : + donnee-de-source.js)');
  for (const nom of ['registre.js', 'composition.js', 'action.js', 'ecran.js', 'vue-traces.js', 'main.js']) {
    const chemin = fichiersJs(join(RACINE, 'app')).find((f) => f.endsWith(`/${nom}`));
    assert.ok(chemin, `${nom} doit exister pour que la preuve soit réelle`);
  }
});

test('G2. INDÉPENDANT : aucun import, statique ni dynamique, aucun require', () => {
  assert.deepEqual(CODE.match(/^\s*import\b.*$/gm), ["import { SCHEMA_RELATIONS } from './relations-schema.js';"]); // MISE À JOUR DÉLIBÉRÉE v0.63.61 : formes-operation.js importe désormais UN module de DONNÉE PURE (relations-schema.js : noms de relations et rôles, aucune fonction) pour valider la clé facultative `relations`
  assert.equal(/\bimport\s*\(/.test(CODE), false);
  assert.equal(/\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function validerDescripteurOperation(descripteur) {'], 'une seule exportation');
});

test('G3. aucun import de CAPACITES, aucun accès magasin / IndexedDB / localStorage / réseau / horloge / aléa', () => {
  for (const interdit of ['CAPACITES', 'registre', 'magasin', 'lireTout', '.ecrire', 'supprimer(', 'indexedDB', 'IndexedDB', 'localStorage', 'sessionStorage', 'fetch(', 'await ', 'async ', 'Date.now', 'new Date', 'Math.random', 'process.', 'globalThis', 'window', 'document']) {
    assert.equal(CODE.includes(interdit), false, `le code ne doit pas contenir « ${interdit} »`);
  }
});

test('G4. aucune exécution d\'opération, aucune fonction de compatibilité, aucune itération « pour chaque sortie, invoquer »', () => {
  for (const interdit of ['invoquer', 'representer', 'executer', 'appliquer', 'compatible', 'peutLier', 'peutComposer', 'projeter', 'projection', 'jointure', 'iterer', 'iteration', 'selectionner', 'selection', 'lier(', 'composer', '.call(', '.apply(', 'eval(', 'new Function']) {
    assert.equal(CODE.toLowerCase().includes(interdit.toLowerCase()), false, `le code ne doit pas contenir « ${interdit} »`);
  }
  assert.equal(/\.(map|forEach|reduce|flatMap)\(\s*(?:async\s*)?\(?\s*\w*\s*\)?\s*=>\s*\w+\(/.test(CODE) && /invoq/i.test(CODE), false);
});

test('G5. aucun vocabulaire de valeur (score, récompense, préférence, jugement, majorité, confiance, seuil, ratio…)', () => {
  for (const mot of [/score/i, /reward/i, /r[ée]compense/i, /pr[ée]f[ée]rence/i, /\bcorrect/i, /incorrect/i, /jugement/i, /valence/i, /feedback/i, /majorit/i, /confiance/i, /seuil/i, /\bratio\b/i, /pertinen/i, /utile/i, /meilleur/i]) {
    assert.equal(mot.test(SOURCE), false, `le module ne doit pas contenir ${mot}`);
  }
});

test('G6. aucune notion de trace, corpus, observation, vécu, capacité, id, ni type avancé (enum, union, générique, cardinalité)', () => {
  for (const mot of [/trace/i, /corpus/i, /observation/i, /v[ée]cu/i, /capacit/i, /\bid\b/i, /\benum\b/i, /\bunion\b/i, /intersection/i, /g[ée]n[ée]rique/i, /cardinalit/i, /\bmin\b/i, /\bmax\b/i, /dictionnaire/i, /catalogue/i, /\bregistre/i]) {
    assert.equal(mot.test(SOURCE), false, `le module ne doit pas contenir ${mot}`);
  }
});

test('G7. aucun catalogue d\'opérations réelles dans le module (ni nom de capacité, ni nom de primitive)', () => {
  for (const nom of ['confrontation', 'proprietesCommunes', 'recherche', 'deduction', 'accessibilite', 'repererMotifs', 'decrireValeursObservees', 'decrireStructure', 'tokeniser', 'sujetA', 'texteRecu', 'couverture']) {
    assert.equal(SOURCE.includes(nom), false, `le module ne doit pas nommer « ${nom} »`);
  }
});

test('G8. le vocabulaire est exactement quatre formes (v0.63.3 : + quelconque), trois genres, trois faits (omissible, peutManquer, peutEtreNull ; aucune forme ni fait supplémentaire dans le code)', () => {
  assert.match(CODE, /const FORMES = \['scalaire', 'objet', 'collection', 'quelconque'\];/);
  assert.match(CODE, /const GENRES = \['chaine', 'nombre', 'booleen'\];/);
  assert.match(CODE, /const FAITS = \{ entree: \['omissible', 'peutEtreNull', 'collectif'\], sortie: \['peutManquer', 'peutEtreNull'\] \};/); // MISE À JOUR DÉLIBÉRÉE v0.63.39 : + fait `collectif` (entrée seulement, contrat fermé, tests dans formes-collectif.test.mjs)
  assert.equal(/nullable|undefined|nonVide|optionnel/.test(CODE.replace(/typeof [a-z]+ !== 'undefined'/g, '')), false);
});

test('G9. le module ne modifie ni ne gèle l\'entrée (aucune mutation, aucun freeze, aucun JSON.parse / structuredClone / spread de l\'entrée)', () => {
  for (const interdit of ['Object.freeze', 'Object.assign', 'structuredClone', 'JSON.parse', 'JSON.stringify', 'delete ']) assert.equal(CODE.includes(interdit), false, interdit);
});

test('G10. les fichiers à ne pas toucher sont inchangés : VERSION_BASE, SCHEMA_SAUVEGARDE, CAPACITES gardent leur forme', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['accessibilite', 'confrontation', 'deduction', 'proprietesCommunes', 'recherche']);
  assert.equal(Object.isFrozen(CAPACITES), true);
});
// === FIN_TEST_FORMES_OPERATION ===
