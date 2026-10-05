// === DEBUT_TEST_GARANTIE_FORME ===
// v0.62.8 — ÉTAPE 6, décision ChatGPT « FORME FOURNIE -> FORME ATTENDUE » (04/10/2026). Teste la primitive PURE ET
// DORMANTE fournieGarantitAttendue(fournie, attendue) -> true | false, qui répond uniquement à : « la forme fournie
// garantit-elle ce que réclame la forme attendue ? ». Les contrats réels ci-dessous n'existent QUE dans ces tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fournieGarantitAttendue as g } from '../app/langage/garantie-forme.js';
import { validerDescripteurOperation } from '../app/langage/formes-operation.js';
import { CONTRATS } from './contrats-observes.mjs';

const sc = (genre) => (genre === undefined ? { forme: 'scalaire' } : { forme: 'scalaire', genre });
const ob = (champs) => (champs === undefined ? { forme: 'objet' } : { forme: 'objet', champs });
const co = (elements) => (elements === undefined ? { forme: 'collection' } : { forme: 'collection', elements });
const avec = (forme, faits) => ({ ...forme, ...faits });
const refuse = (f, a, motif) => assert.throws(() => g(f, a), (e) => e instanceof TypeError && (motif ? motif.test(e.message) : true), 'devait lever un TypeError');
const gele = (x) => { Object.freeze(x); if (x && typeof x === 'object') Object.values(x).forEach(gele); return x; };

// ============================================================================ A. R0 : LES FAITS
test('A1. table peutManquer (fournie) × omissible (attendue) : seul (oui, non) est refusé', () => {
  for (const [pm, om, attendu] of [[false, false, true], [false, true, true], [true, true, true], [true, false, false]]) {
    assert.equal(g(avec(sc('chaine'), { peutManquer: pm }), avec(sc('chaine'), { omissible: om })), attendu, `pm=${pm} om=${om}`);
  }
  assert.equal(g(avec(sc('chaine'), { peutManquer: true }), sc('chaine')), false, 'omissible absent = non omissible');
  assert.equal(g(avec(sc('chaine'), { peutManquer: true }), avec(sc('chaine'), { omissible: true })), true);
});

test('A2. peutEtreNull côté fournie : toujours false, que l\'attendue soit omissible ou non', () => {
  for (const om of [undefined, false, true]) {
    const a = om === undefined ? sc('chaine') : avec(sc('chaine'), { omissible: om });
    assert.equal(g(avec(sc('chaine'), { peutEtreNull: true }), a), false, `omissible=${om}`);
    assert.equal(g(avec(sc('chaine'), { peutEtreNull: true, peutManquer: true }), a), false);
  }
});

test('A3. faits absents ≡ false : même résultat, côté fournie comme côté attendue', () => {
  const nus = sc('chaine');
  assert.equal(g(avec(nus, { peutEtreNull: false }), nus), g(nus, nus));
  assert.equal(g(avec(nus, { peutManquer: false }), nus), g(nus, nus));
  assert.equal(g(nus, avec(nus, { omissible: false })), g(nus, nus));
  assert.equal(g(avec(nus, { peutManquer: false, peutEtreNull: false }), avec(nus, { omissible: false })), true);
  assert.equal(g(avec(nus, { peutManquer: true }), avec(nus, { omissible: false })), false, 'omissible:false = non omissible');
});

test('A4. R0 s\'applique à la racine ET aux champs imbriqués', () => {
  const f = (faits) => ob({ a: avec(sc('chaine'), faits) });
  const a = (faits) => ob({ a: avec(sc('chaine'), faits) });
  assert.equal(g(f({ peutManquer: true }), a({})), false);
  assert.equal(g(f({ peutManquer: true }), a({ omissible: true })), true);
  assert.equal(g(f({ peutEtreNull: true }), a({ omissible: true })), false);
  assert.equal(g(avec(f({}), { peutEtreNull: true }), a({})), false, 'racine nullable');
  assert.equal(g(avec(f({}), { peutManquer: true }), a({})), false, 'racine pouvant manquer face à une racine non omissible');
  assert.equal(g(avec(f({}), { peutManquer: true }), avec(a({}), { omissible: true })), true);
});

test('A5. les faits ne changent pas la comparaison des formes : un champ omissible garde sa forme à vérifier', () => {
  assert.equal(g(ob({ a: sc('nombre') }), ob({ a: avec(sc('chaine'), { omissible: true }) })), false);
  assert.equal(g(avec(sc('nombre'), { peutManquer: true }), avec(sc('chaine'), { omissible: true })), false);
});

// ============================================================================ B. R1 : FORMES
test('B1. grille 3×3 des formes : seule la diagonale est true (aucune projection, aucune itération implicite)', () => {
  const formes = { scalaire: sc(), objet: ob(), collection: co() };
  for (const [nf, f] of Object.entries(formes)) for (const [na, a] of Object.entries(formes)) assert.equal(g(f, a), nf === na, `${nf} -> ${na}`);
});

// ============================================================================ C. R2 : SCALAIRES
test('C1. grille des genres : même genre true ; genres différents false ; attendue sans genre accepte tout scalaire ; fournie sans genre ne garantit aucun genre', () => {
  const genres = [undefined, 'chaine', 'nombre', 'booleen'];
  for (const gf of genres) for (const ga of genres) {
    const attendu = ga === undefined ? true : gf === ga;
    assert.equal(g(sc(gf), sc(ga)), attendu, `fournie ${gf} -> attendue ${ga}`);
  }
});
test('C2. aucune coercition : nombre -> chaine, booleen -> chaine, chaine -> nombre : false', () => {
  assert.equal(g(sc('nombre'), sc('chaine')), false);
  assert.equal(g(sc('booleen'), sc('chaine')), false);
  assert.equal(g(sc('chaine'), sc('nombre')), false);
});

// ============================================================================ D. R3 : OBJETS
test('D1. cas de la décision : {id,texte,origine} -> {id,texte} true ; {id} -> {id,texte} false', () => {
  const idtxt = ob({ id: sc('chaine'), texte: sc('chaine') });
  assert.equal(g(ob({ id: sc('chaine'), texte: sc('chaine'), origine: sc('chaine') }), idtxt), true);
  assert.equal(g(ob({ id: sc('chaine') }), idtxt), false);
});
test('D2. R3 corrigée : champ attendu omissible mais non déclaré par la fournie -> false', () => {
  const attendue = ob({ id: sc('chaine'), texte: avec(sc('chaine'), { omissible: true }) });
  assert.equal(g(ob({ id: sc('chaine') }), attendue), false);
  assert.equal(g(ob({ id: sc('chaine'), texte: sc('chaine') }), attendue), true);
  assert.equal(g(ob({ id: sc('chaine'), texte: avec(sc('chaine'), { peutManquer: true }) }), attendue), true);
  assert.equal(g(ob({ id: sc('chaine'), texte: sc('nombre') }), attendue), false, 'un champ omissible déclaré garde sa forme');
  assert.equal(g(ob(), attendue), false, 'fournie sans champs ne déclare rien');
  assert.equal(g(ob({}), attendue), false);
});
test('D3. champ attendu non omissible non déclaré -> false', () => {
  assert.equal(g(ob({ a: sc() }), ob({ b: sc() })), false);
  assert.equal(g(ob({ a: sc() }), ob({ a: sc(), b: sc() })), false);
  assert.equal(g(ob({ texte: sc() }), ob({ id: sc() })), false, 'aucun traitement particulier de id');
  assert.equal(g(ob({ id: sc() }), ob({ texte: sc() })), false);
  assert.equal(g(ob(), ob({ id: sc() })), false);
});
test('D4. champs supplémentaires de la fournie : ignorés (y compris à tous les niveaux)', () => {
  assert.equal(g(ob({ a: sc(), b: sc('nombre'), c: co() }), ob({ a: sc() })), true);
  assert.equal(g(ob({ a: ob({ x: sc(), y: sc() }) }), ob({ a: ob({ x: sc() }) })), true);
  assert.equal(g(co(ob({ id: sc('chaine'), texte: sc('chaine'), origine: sc('chaine') })), co(ob({ id: sc('chaine'), texte: sc('chaine') }))), true);
});
test('D5. objet sans champs et champs {} : même comportement dans la relation (quatre positions)', () => {
  const sans = ob(); const vide = ob({}); const plein = ob({ a: sc() });
  for (const f of [sans, vide]) for (const a of [sans, vide]) assert.equal(g(f, a), true);
  for (const f of [sans, vide]) assert.equal(g(f, plein), false);
  for (const a of [sans, vide]) assert.equal(g(plein, a), true);
});
test('D6. récursion objet dans objet : une divergence profonde suffit à refuser', () => {
  const attendue = ob({ a: ob({ b: ob({ c: sc('chaine') }) }) });
  assert.equal(g(ob({ a: ob({ b: ob({ c: sc('chaine'), d: sc() }) }) }), attendue), true);
  assert.equal(g(ob({ a: ob({ b: ob({ c: sc('nombre') }) }) }), attendue), false);
  assert.equal(g(ob({ a: ob({ b: ob({}) }) }), attendue), false);
  assert.equal(g(ob({ a: ob({ b: ob({ c: avec(sc('chaine'), { peutEtreNull: true }) }) }) }), attendue), false);
  assert.equal(g(ob({ a: ob({ b: ob({ c: avec(sc('chaine'), { peutManquer: true }) }) }) }), attendue), false);
});

// ============================================================================ E. R4 : COLLECTIONS
test('E1. les quatre positions de `elements`', () => {
  assert.equal(g(co(), co()), true, 'ni l\'un ni l\'autre ne décrit');
  assert.equal(g(co(sc('chaine')), co()), true, 'attendue sans elements : toute collection');
  assert.equal(g(co(), co(sc('chaine'))), false, 'fournie sans elements : éléments non garantis');
  assert.equal(g(co(sc('chaine')), co(sc('chaine'))), true);
  assert.equal(g(co(sc('nombre')), co(sc('chaine'))), false);
});
test('E2. collection de chaînes ≠ collection d\'objets {id,texte} ≠ collection d\'objets {id,valeur}', () => {
  const chaines = co(sc('chaine')); const idTexte = co(ob({ id: sc('chaine'), texte: sc('chaine') })); const idValeur = co(ob({ id: sc('chaine'), valeur: sc() }));
  assert.equal(g(chaines, idTexte), false); assert.equal(g(idTexte, chaines), false);
  assert.equal(g(idTexte, idValeur), false); assert.equal(g(idValeur, idTexte), false);
  assert.equal(g(idTexte, idTexte), true);
});
test('E3. collection de collections, et collection d\'objets contenant une collection', () => {
  assert.equal(g(co(co(sc('chaine'))), co(co(sc('chaine')))), true);
  assert.equal(g(co(co(sc('nombre'))), co(co(sc('chaine')))), false);
  assert.equal(g(co(co()), co(co(sc()))), false);
  assert.equal(g(co(ob({ ids: co(sc('chaine')), z: sc() })), co(ob({ ids: co(sc('chaine')) }))), true);
});
test('E4. collection ↔ objet ou scalaire : false (collection directe ≠ objet contenant une collection)', () => {
  assert.equal(g(co(sc('chaine')), ob({ valeurs: co(sc('chaine')) })), false);
  assert.equal(g(ob({ valeurs: co(sc('chaine')) }), co(sc('chaine'))), false);
  assert.equal(g(co(sc('chaine')), sc('chaine')), false);
});
test('E5. les éléments d\'une collection ne portent aucun fait : un fait sur un élément est un TypeError', () => {
  refuse(co(avec(sc(), { peutEtreNull: true })), co());
  refuse(co(), co(avec(sc(), { omissible: true })));
});

// ============================================================================ F. CONTRATS OBSERVÉS (source unique : tests/contrats-observes.mjs) ET CAS SYNTHÉTIQUES
// v0.62.9 : les contrats « réels » ne sont plus redéfinis ici. Ils viennent de l'outil de tests partagé, dont
// tests/contrats-observes.test.mjs prouve la fidélité aux fonctions réelles. Les attendues marquées « synthétique »
// sont écrites à la main pour isoler UN fait : elles ne prétendent décrire aucune opération.
const RECHERCHE = CONTRATS.recherche;
const DEDUCTION = CONTRATS.deduction;
const VALEURS = CONTRATS.decrireValeursObservees;
const STRUCTURE_ID = CONTRATS.decrireStructureIdentifiee;
const MOTIFS = CONTRATS.repererMotifs;

test('F-A. recherche.sujets (collection<chaine>) -> rôle scalaire de deduction : false (collection vs scalaire)', () => {
  assert.equal(g(RECHERCHE.sortie.champs.sujets, DEDUCTION.entrees.sujet), false);
});
test('F-B. decrireValeursObservees.valeurs -> decrireStructureIdentifiee.elements : false (les éléments observés sont {valeur, ids} ; id et texte manquent)', () => {
  assert.equal(g(VALEURS.sortie.champs.valeurs, STRUCTURE_ID.entrees.elements), false);
});
test('F-C. la collection ids (collection<chaine>) de valeurs[] -> decrireStructureIdentifiee.elements : false', () => {
  const ids = VALEURS.sortie.champs.valeurs.elements.champs.ids;
  assert.equal(g(ids, STRUCTURE_ID.entrees.elements), false);
});
test('F-D. collection d\'objets {id,texte} (synthétique) -> decrireStructureIdentifiee.elements : true ; champ supplémentaire ignoré', () => {
  assert.equal(g(co(ob({ id: sc('chaine'), texte: sc('chaine') })), STRUCTURE_ID.entrees.elements), true);
  assert.equal(g(co(ob({ id: sc('chaine'), texte: sc('chaine'), origine: sc('chaine') })), STRUCTURE_ID.entrees.elements), true);
});
test('F-E. repererMotifs (sortie collection directe, couverture = collection de scalaires SANS genre car elle peut contenir un id absent) : true vers une attendue de même exigence, false vers une chaîne imposée, false vers un objet', () => {
  assert.equal(g(MOTIFS.sortie, co(ob({ couverture: co(sc()) }))), true, 'synthétique');
  assert.equal(g(MOTIFS.sortie, co(ob({ couverture: co(sc('chaine')) }))), false, 'v0.62.8 donnait true avec une fixture couverture<chaine> que le code ne tient pas');
  assert.equal(g(MOTIFS.sortie, ob({ couverture: co(sc()) })), false, 'synthétique : un objet n\'est pas une collection');
  assert.equal(g(MOTIFS.sortie, MOTIFS.entrees.corpus), false);
});
test('F-F. decrireStructureIdentifiee.couverture (collection<chaine>) -> attendue synthétique collection d\'identifiants : true ; sans genre : true ; autre genre : false', () => {
  assert.equal(g(STRUCTURE_ID.sortie.champs.couverture, co(sc('chaine'))), true);
  assert.equal(g(STRUCTURE_ID.sortie.champs.couverture, co(sc())), true);
  assert.equal(g(STRUCTURE_ID.sortie.champs.couverture, co(sc('nombre'))), false);
});
test('F-G. CHANGEMENT v0.62.9 : nombreValeurs (nombre) -> les deux rôles de capacité, scalaires SANS genre (le code n\'exige pas de chaîne) : true ; forme ≠ pertinence', () => {
  assert.equal(g(VALEURS.sortie.champs.nombreValeurs, RECHERCHE.entrees.valeur), true);
  assert.equal(g(VALEURS.sortie.champs.nombreValeurs, DEDUCTION.entrees.sujet), true, 'v0.62.8 donnait false : la fixture imposait un genre chaîne que le code n\'impose pas');
  assert.equal(g(VALEURS.sortie.champs.nombreValeurs, sc('chaine')), false, 'synthétique : un genre imposé reste respecté');
});
test('F-H. FAUX NÉGATIF VOLONTAIRE connu : deduction.resultat (nullable) -> recherche.valeur est false, alors que le branchement fonctionne en vrai avec null', () => {
  assert.equal(g(DEDUCTION.sortie.champs.resultat, RECHERCHE.entrees.valeur), false);
  assert.equal(g({ ...DEDUCTION.sortie.champs.resultat, peutEtreNull: false }, RECHERCHE.entrees.valeur), true, 'le seul fait peutEtreNull explique le refus');
  assert.equal(g(sc('chaine'), RECHERCHE.entrees.valeur), true);
});
test('F-I. CORRIGÉ v0.62.9 : conflit est un BOOLÉEN qui peut manquer (pas un objet) : false vers une entrée obligatoire, true vers une entrée omissible du même genre, false vers un objet ou vers recherche.valeur', () => {
  const conflit = DEDUCTION.sortie.champs.conflit;
  assert.deepEqual(conflit, { forme: 'scalaire', genre: 'booleen', peutManquer: true });
  assert.equal(g(conflit, sc('booleen')), false, 'synthétique obligatoire : peutManquer');
  assert.equal(g(conflit, avec(sc('booleen'), { omissible: true })), true, 'synthétique omissible');
  assert.equal(g(conflit, avec(ob(), { omissible: true })), false, 'v0.62.8 donnait true : conflit était décrit comme un objet, il est un booléen');
  assert.equal(g(conflit, MOTIFS.entrees.options), false, 'v0.62.8 donnait true pour la même raison');
  assert.equal(g(conflit, RECHERCHE.entrees.valeur), false, 'valeur est obligatoire : conflit peut manquer');
});

// ============================================================================ G. VALIDATION : TypeError, jamais false
test('G1. entrée invalide : TypeError, jamais false (chaque argument)', () => {
  for (const mauvais of [null, undefined, [], 'chaine', 3, true, () => 1, {}, { forme: 'union' }, { forme: 'scalaire', genre: 'entier' }, { forme: 'objet', genre: 'chaine' },
    { forme: 'collection', champs: {} }, { forme: 'scalaire', extra: 1 }, { forme: 'objet', champs: { a: null } }, { forme: 'scalaire', peutManquer: 1 }]) {
    refuse(mauvais, sc()); refuse(sc(), mauvais);
  }
});
test('G2. argument manquant : TypeError', () => {
  assert.throws(() => g(), TypeError);
  assert.throws(() => g(sc()), TypeError);
});
test('G3. faits du mauvais côté : omissible sur la fournie, peutManquer sur l\'attendue (v0.63.3 : peutEtreNull est permis sur l\'attendue)', () => {
  refuse(avec(sc(), { omissible: true }), sc(), /omissible/);
  refuse(sc(), avec(sc(), { peutManquer: true }), /peutManquer/);
  assert.doesNotThrow(() => g(sc(), avec(sc(), { peutEtreNull: true })));
  refuse(ob({ a: avec(sc(), { omissible: true }) }), ob({ a: sc() }), /omissible/);
  refuse(ob({ a: sc() }), ob({ a: avec(sc(), { peutManquer: true }) }), /peutManquer/);
});
test('G4. permuter les arguments d\'un cas où la fournie porte des faits de sortie : TypeError (côtés non interchangeables)', () => {
  const sortie = avec(sc('chaine'), { peutManquer: true }); const entree = avec(sc('chaine'), { omissible: true });
  assert.equal(g(sortie, entree), true);
  refuse(entree, sortie);
});
test('G5. cycles : TypeError (aucune récursion infinie)', () => {
  const c = { forme: 'collection' }; c.elements = c;
  refuse(c, co()); refuse(co(), c);
  const o = { forme: 'objet', champs: {} }; o.champs.soi = o;
  refuse(o, ob()); refuse(ob(), o);
});
test('G6. le résultat est exactement true ou false', () => {
  for (const [f, a] of [[sc(), sc()], [sc(), ob()], [ob({ a: sc() }), ob({ a: sc() })], [co(), co(sc())]]) assert.equal(typeof g(f, a), 'boolean');
});
test('G7. aucun argument n\'est modifié (entrées gelées acceptées, instantané identique)', () => {
  const f = gele(ob({ a: avec(sc('chaine'), { peutManquer: true }), b: co(ob({ c: sc() })) }));
  const a = gele(ob({ a: avec(sc('chaine'), { omissible: true }), b: co(ob({ c: sc() })) }));
  const avant = JSON.stringify([f, a]);
  assert.equal(g(f, a), true);
  assert.equal(JSON.stringify([f, a]), avant);
  const mutable = ob({ a: sc() });
  g(mutable, ob({ a: sc() }));
  assert.deepEqual(mutable, ob({ a: sc() }));
});
test('G8. déterministe, et indépendant de l\'ordre de déclaration des champs', () => {
  const f1 = ob({ a: sc('chaine'), b: co(sc()), c: sc('nombre') }); const f2 = ob({ c: sc('nombre'), b: co(sc()), a: sc('chaine') });
  const a1 = ob({ a: sc('chaine'), c: sc() }); const a2 = ob({ c: sc(), a: sc('chaine') });
  for (const f of [f1, f2]) for (const a of [a1, a2]) assert.equal(g(f, a), true);
  assert.equal(g(f1, a1), g(f1, a1));
});
test('G9. un champ nommé __proto__ est un champ ordinaire (pas de contournement du prototype)', () => {
  const avecProto = (forme) => ob(JSON.parse(`{"__proto__": ${JSON.stringify(forme)}}`));
  assert.equal(g(avecProto(sc('chaine')), avecProto(sc('chaine'))), true);
  assert.equal(g(avecProto(sc('nombre')), avecProto(sc('chaine'))), false);
  assert.equal(g(ob({ a: sc() }), avecProto(sc())), false);
  assert.equal(g(ob({ toString: sc() }), ob({ hasOwnProperty: sc() })), false, 'un nom hérité du prototype n\'est pas un champ déclaré');
});

// ============================================================================ H. PROPRIÉTÉS (domaines explicites)
const feuilles = [sc(), sc('chaine'), sc('nombre'), ob(), co()];
const niveau1 = [...feuilles.map((x) => co(x)), ob({}),
  ...feuilles.map((x) => ob({ a: x })), ...feuilles.map((x) => ob({ b: x })),
  ...feuilles.flatMap((x) => feuilles.map((y) => ob({ a: x, b: y})))];
const UNIVERS = [...feuilles, ...niveau1]; // formes SANS fait : 46
const MATRICE = UNIVERS.map((f) => UNIVERS.map((a) => g(f, a)));
// miroir : lit une forme de SORTIE comme forme d'ENTRÉE (peutManquer devient omissible, peutEtreNull disparaît).
function miroir(x) {
  if (Array.isArray(x) || x === null || typeof x !== 'object') return x;
  const r = {};
  for (const [k, v] of Object.entries(x)) {
    if (k === 'peutEtreNull') continue;
    if (k === 'peutManquer') { r.omissible = v; continue; }
    r[k] = k === 'champs' ? Object.fromEntries(Object.entries(v).map(([n, c]) => [n, miroir(c)])) : k === 'elements' ? miroir(v) : v;
  }
  return r;
}
const contientNull = (x) => (x && typeof x === 'object') && (x.peutEtreNull === true || Object.values(x.champs || {}).some(contientNull) || (x.elements ? contientNull(x.elements) : false));

test('H0. l\'univers de propriétés compte 46 formes sans fait', () => { assert.equal(UNIVERS.length, 46); });

test('H1. réflexivité par miroir : X -> miroir(X) vaut true exactement quand X ne contient aucun peutEtreNull', () => {
  const nullable = (forme) => avec(forme, { peutEtreNull: true });
  const peutManquer = (forme) => avec(forme, { peutManquer: true });
  const famille = [...UNIVERS,
    nullable(sc('chaine')), peutManquer(sc('chaine')), avec(sc(), { peutManquer: true, peutEtreNull: true }),
    ob({ a: nullable(sc()) }), ob({ a: peutManquer(sc()), b: peutManquer(co(sc())) }), co(ob({ a: nullable(sc()) })),
    ob({ a: ob({ b: nullable(sc('nombre')) }) }), ob({ a: avec(ob({ b: sc() }), { peutManquer: true }) }),
    avec(ob({ a: sc() }), { peutEtreNull: false }), avec(sc(), { peutManquer: false, peutEtreNull: false })];
  for (const x of famille) assert.equal(g(x, miroir(x)), !contientNull(x), JSON.stringify(x));
});

test('H1b. sans fait : toute forme se garantit elle-même (réflexivité littérale, sur ce domaine seulement)', () => {
  UNIVERS.forEach((x, i) => assert.equal(MATRICE[i][i], true, JSON.stringify(x)));
});

test('H2. transitivité sur les formes sans fait : F->M et M->A impliquent F->A (tous les triplets de l\'univers)', () => {
  const n = UNIVERS.length; let verifies = 0;
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
    if (!MATRICE[i][j]) continue;
    for (let k = 0; k < n; k += 1) {
      if (!MATRICE[j][k]) continue;
      verifies += 1;
      assert.equal(MATRICE[i][k], true, `${JSON.stringify(UNIVERS[i])} -> ${JSON.stringify(UNIVERS[j])} -> ${JSON.stringify(UNIVERS[k])}`);
    }
  }
  assert.ok(verifies > 500, `le test doit réellement exercer des chaînes (${verifies})`);
});

test('H2b. transitivité avec peutManquer, par miroir : F->miroir(M) et M->miroir(A) impliquent F->miroir(A)', () => {
  const champ = (pm) => (pm ? avec(sc('chaine'), { peutManquer: true }) : sc('chaine'));
  const W = [champ(false), champ(true), ob({}), ob({ a: champ(false) }), ob({ a: champ(true) }), ob({ a: champ(false), b: champ(false) }),
    ob({ a: champ(true), b: champ(false) }), ob({ a: champ(false), b: champ(true) }), ob({ a: champ(true), b: champ(true) }), co(champ(false)), co(sc('chaine'))];
  // les éléments de collection ne portent pas de fait : co(champ(true)) est volontairement hors de l'univers
  let verifies = 0;
  for (const f of W) for (const m of W) {
    if (!g(f, miroir(m))) continue;
    for (const a of W) {
      if (!g(m, miroir(a))) continue;
      verifies += 1;
      assert.equal(g(f, miroir(a)), true, `${JSON.stringify(f)} / ${JSON.stringify(m)} / ${JSON.stringify(a)}`);
    }
  }
  assert.ok(verifies > 50, `chaînes exercées : ${verifies}`);
});

test('H3. non-symétrie : l\'univers contient de nombreuses paires orientées, et le cas {id,texte,origine} / {id,texte}', () => {
  let asymetriques = 0; let symetriquesDistinctes = 0;
  UNIVERS.forEach((x, i) => UNIVERS.forEach((y, j) => {
    if (MATRICE[i][j] && !MATRICE[j][i]) asymetriques += 1;
    if (i !== j && MATRICE[i][j] && MATRICE[j][i] && JSON.stringify(x) !== JSON.stringify(y)) symetriquesDistinctes += 1;
  }));
  assert.ok(asymetriques > 100, `paires orientées : ${asymetriques}`);
  assert.ok(symetriquesDistinctes >= 2, 'ob() et ob({}) se garantissent mutuellement tout en restant des descriptions distinctes');
  const riche = ob({ id: sc('chaine'), texte: sc('chaine'), origine: sc('chaine') }); const pauvre = ob({ id: sc('chaine'), texte: sc('chaine') });
  assert.equal(g(riche, pauvre), true);
  assert.equal(g(pauvre, riche), false);
});

test('H4. monotonie : un champ en plus côté fournie ne change jamais le résultat ; une exigence en plus côté attendue ne fait jamais passer de false à true', () => {
  const ajouter = (x, nom, forme) => (x.forme !== 'objet' ? x : { forme: 'objet', champs: { ...(x.champs || {}), [nom]: forme } });
  UNIVERS.forEach((f, i) => UNIVERS.forEach((a, j) => {
    for (const extra of feuilles) {
      assert.equal(g(ajouter(f, 'z', extra), a), MATRICE[i][j], 'champ en plus côté fournie');
      if (a.forme === 'objet' && MATRICE[i][j] === false) assert.equal(g(f, ajouter(a, 'z', extra)), false, 'exigence en plus côté attendue');
      if (a.forme === 'objet' && g(f, ajouter(a, 'z', extra))) assert.equal(MATRICE[i][j], true);
    }
  }));
});

test('H5. fait absent ≡ false : substituer l\'un à l\'autre ne change aucun résultat (fournie et attendue, racine et champs)', () => {
  const etats = [undefined, false, true];
  const fait = (nom, v) => (v === undefined ? {} : { [nom]: v });
  const resultats = {};
  for (const pm of etats) for (const pn of etats) for (const om of etats) {
    const f = avec(sc('chaine'), { ...fait('peutManquer', pm), ...fait('peutEtreNull', pn) }); const a = avec(sc('chaine'), fait('omissible', om));
    const r1 = g(f, a); const r2 = g(ob({ k: f }), ob({ k: a }));
    assert.equal(r1, r2, 'racine et champ imbriqué donnent la même réponse');
    resultats[`${pm}|${pn}|${om}`] = r1;
  }
  for (const pm of [undefined, false]) for (const pn of [undefined, false]) for (const om of [undefined, false]) {
    assert.equal(resultats[`${pm}|${pn}|${om}`], true);
  }
  for (const pm of etats) for (const pn of etats) for (const om of etats) {
    const norm = (v) => (v === true);
    const attendu = !norm(pn) && !(norm(pm) && !norm(om));
    assert.equal(resultats[`${pm}|${pn}|${om}`], attendu, `${pm}|${pn}|${om}`);
  }
});

test('H6. invariance à l\'ordre des champs : renverser l\'ordre de déclaration ne change aucun résultat', () => {
  const renverse = (x) => (x.forme === 'objet' && x.champs ? { forme: 'objet', champs: Object.fromEntries(Object.entries(x.champs).reverse().map(([k, v]) => [k, renverse(v)])) } : x.forme === 'collection' && x.elements ? co(renverse(x.elements)) : x);
  UNIVERS.forEach((f, i) => UNIVERS.forEach((a, j) => assert.equal(g(renverse(f), renverse(a)), MATRICE[i][j])));
});

test('H7. orientation : sur l\'univers, permuter les arguments inverse le résultat de chaque paire asymétrique', () => {
  UNIVERS.forEach((f, i) => UNIVERS.forEach((a, j) => {
    if (MATRICE[i][j] !== MATRICE[j][i]) assert.equal(g(a, f), MATRICE[j][i]);
  }));
  const pauvre = ob({ id: sc('chaine') }); const riche = ob({ id: sc('chaine'), texte: sc('chaine') });
  assert.notEqual(g(riche, pauvre), g(pauvre, riche));
});

// ============================================================================ I. STATIQUE : DORMANCE ET PURETÉ
const RACINE = join(import.meta.dirname, '..');
const sansCommentaires = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
function fichiersJs(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) { if (nom !== 'node_modules') fichiersJs(chemin, sortie); } else if (nom.endsWith('.js')) sortie.push(chemin);
  }
  return sortie;
}
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'garantie-forme.js'), 'utf8');
const CODE = sansCommentaires(SOURCE);

test('I1. DORMANT : aucun fichier de production (registre, composition, action, ecran, vue-traces, main, sw, worker, index) n\'importe ni ne nomme la primitive ou son module', () => {
  const fichiers = [...fichiersJs(join(RACINE, 'app')), join(RACINE, 'sw.js'), join(RACINE, 'worker.js'), join(RACINE, 'index.html')];
  for (const f of fichiers) {
    if (f.endsWith('garantie-forme.js')) continue;
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    if (relative(RACINE, f).split('\\').join('/') === 'app/langage/possibilites-liaison.js') continue; // v0.63.13 : SEUL importeur de la relation de garantie (gardé par tests/possibilites-liaison.test.mjs, S4)
    assert.equal(/garantie-forme|fournieGarantitAttendue/.test(src), false, `${relative(RACINE, f)} ne doit jamais l'utiliser`);
  }
  for (const nom of ['registre.js', 'composition.js', 'action.js', 'ecran.js', 'vue-traces.js', 'main.js']) {
    assert.ok(fichiersJs(join(RACINE, 'app')).find((f) => f.endsWith(`/${nom}`)), `${nom} doit exister pour que la preuve soit réelle`);
  }
});

test('I2. une seule importation (validerDescripteurOperation depuis formes-operation.js), une seule exportation, aucun import dynamique ni require', () => {
  assert.deepEqual((CODE.match(/^\s*import\b[^;]*;/gm) || []).map((l) => l.trim()), ["import { validerDescripteurOperation } from './formes-operation.js';"]);
  assert.equal((CODE.match(/^\s*import\b/gm) || []).length, 1);
  assert.equal(/\bimport\s*\(/.test(CODE), false);
  assert.equal(/\brequire\s*\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/^export .*$/gm), ['export function fournieGarantitAttendue(fournie, attendue) {']);
  assert.equal((CODE.match(/formes-operation/g) || []).length, 1, 'une seule mention du module, dans l\'import');
});

test('I3. la validation est celle de formes-operation.js : le module ne la reproduit pas et n\'avale aucune erreur', () => {
  assert.equal((CODE.match(/validerDescripteurOperation\(/g) || []).length, 2, 'un appel par argument');
  for (const interdit of ['try', 'catch', 'finally', 'instanceof', 'typeof', 'Array.isArray', 'new TypeError', 'throw ']) assert.equal(CODE.includes(interdit), false, `le code ne doit pas contenir « ${interdit} »`);
});

test('I4. aucun accès à CAPACITES, magasin, IndexedDB, localStorage, réseau, horloge ou aléa ; aucune exécution d\'opération', () => {
  for (const interdit of ['CAPACITES', 'registre', 'magasin', 'lireTout', '.ecrire', 'supprimer(', 'indexedDB', 'IndexedDB', 'localStorage', 'sessionStorage', 'fetch(', 'await ', 'async ', 'Date.now', 'new Date', 'Math.random', 'process.', 'globalThis', 'window', 'document',
    'invoquer', 'representer', 'executer', '.call(', '.apply(', 'eval(', 'new Function']) {
    assert.equal(CODE.includes(interdit), false, `le code ne doit pas contenir « ${interdit} »`);
  }
});

test('I5. aucun vocabulaire de compatibilité entre opérations, de lien, de composition, de projection, de jointure, d\'itération, de sélection ou de planification', () => {
  for (const mot of [/compatib/i, /peutLier/i, /peutComposer/i, /\blier\b/i, /liaison/i, /composition/i, /composer/i, /projec/i, /jointure/i, /it[ée]ration/i, /s[ée]lection/i, /planif/i, /branch/i, /suivre/i, /enchain/i]) {
    assert.equal(mot.test(SOURCE), false, `le module ne doit pas contenir ${mot}`);
  }
});

test('I6. aucun vocabulaire de valeur, de trace, de capacité, d\'id, d\'opération réelle', () => {
  for (const mot of [/score/i, /reward/i, /r[ée]compense/i, /pr[ée]f[ée]rence/i, /\bcorrect/i, /jugement/i, /valence/i, /feedback/i, /majorit/i, /confiance/i, /seuil/i, /\bratio\b/i, /pertinen/i,
    /trace/i, /corpus/i, /observation/i, /v[ée]cu/i, /capacit/i, /\bid\b/i, /catalogue/i, /\bregistre/i]) {
    assert.equal(mot.test(SOURCE), false, `le module ne doit pas contenir ${mot}`);
  }
  for (const nom of ['confrontation', 'proprietesCommunes', 'recherche', 'deduction', 'accessibilite', 'repererMotifs', 'decrireValeursObservees', 'decrireStructure', 'sujetA', 'texteRecu', 'couverture', 'origine']) {
    assert.equal(SOURCE.includes(nom), false, `le module ne doit pas nommer « ${nom} »`);
  }
});

test('I7. aucune coercition, aucune mutation, aucun résultat structuré', () => {
  for (const interdit of ['String(', 'Number(', 'Boolean(', 'parseInt', 'parseFloat', 'toString', '+ \'\'', 'JSON.', 'Object.freeze', 'Object.assign', 'delete ', 'structuredClone', '.push(', '.sort(', '.splice(',
    'chemin', 'raison', 'ecart', 'diagnostic', 'detail']) {
    assert.equal(CODE.includes(interdit), false, `le code ne doit pas contenir « ${interdit} »`);
  }
  assert.equal((CODE.match(/return (true|false)\b/g) || []).length >= 6, true);
  assert.equal(/return \{/.test(CODE), false, 'aucun retour objet');
});

test('I8. les règles sont figées dans le code (R0 sur les deux faits, R1 sur la forme, R2 sur le genre, R3 sur la déclaration, R4 sur les éléments)', () => {
  assert.match(CODE, /if \(f\.peutEtreNull === true && a\.peutEtreNull !== true\) return false;/);
  assert.match(CODE, /if \(a\.forme === 'quelconque'\) return true;/);
  assert.match(CODE, /if \(f\.peutManquer === true && a\.omissible !== true\) return false;/);
  assert.match(CODE, /if \(f\.forme !== a\.forme\) return false;/);
  assert.match(CODE, /return a\.genre === undefined \|\| f\.genre === a\.genre;/);
  assert.match(CODE, /if \(f\.champs === undefined \|\| !Object\.hasOwn\(f\.champs, nom\)\) return false;/);
  assert.match(CODE, /if \(a\.elements === undefined\) return true;/);
  assert.match(CODE, /if \(f\.elements === undefined\) return false;/);
});

test('I9. formes-operation.js est inchangé : export unique, aucune mention du nouveau module ; les fichiers de production voisins ignorent aussi la nouvelle dépendance', () => {
  const fo = readFileSync(join(RACINE, 'app', 'langage', 'formes-operation.js'), 'utf8');
  assert.deepEqual(sansCommentaires(fo).match(/^export .*$/gm), ['export function validerDescripteurOperation(descripteur) {']);
  assert.equal(/garantie-forme|fournieGarantitAttendue/.test(fo), false);
  assert.equal((sansCommentaires(fo).match(/^\s*import\b/gm) || []).length, 0, 'formes-operation.js reste sans import');
  const test07 = readFileSync(join(RACINE, 'tests', 'formes-operation.test.mjs'), 'utf8');
  assert.match(test07, /const IMPORTEURS_AUTORISES = \['app\/langage\/garantie-forme\.js', 'app\/langage\/productions-decrites\.js', 'app\/langage\/possibilites-liaison\.js', 'app\/langage\/donnee-de-source\.js', 'app\/langage\/groupes-candidats\.js'\];/, 'exception fermée à quatre fichiers (v0.63.15 : + donnee-de-source.js) (v0.63.12 : + productions-decrites.js ; v0.63.13 : + possibilites-liaison.js)');
});

test('I10. garantie-forme.js, productions-decrites.js (v0.63.12) et possibilites-liaison.js (v0.63.13) sont les seuls fichiers de production qui nomment formes-operation.js (les exceptions de G1 sont réellement utilisées)', () => {
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => !f.endsWith('formes-operation.js') && /formes-operation/.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f).split('\\').join('/'));
  assert.deepEqual(nommant.sort(), ['app/langage/donnee-de-source.js', 'app/langage/garantie-forme.js', 'app/langage/groupes-candidats.js', 'app/langage/possibilites-liaison.js', 'app/langage/productions-decrites.js']);
});
// === FIN_TEST_GARANTIE_FORME ===
