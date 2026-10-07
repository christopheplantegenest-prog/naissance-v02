// === DEBUT_TEST_FORMES_EXTENSION ===
// v0.63.3 — ÉTAPE 6, décision ChatGPT « EXTENSION MINIMALE DU LANGAGE DE FORMES » (04/10/2026) : (1) la forme
// `quelconque` (valeur non contrainte), (2) le fait `peutEtreNull` côté ENTRÉE (distinct d'`omissible`), et les règles
// correspondantes de fournieGarantitAttendue(). Depuis v0.63.4 les descripteurs des trois contrats réels
// sont importés de la source unique de production (app/langage/descriptions-operations.js) : aucune copie n'est redéclarée ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { fournieGarantitAttendue as g } from '../app/langage/garantie-forme.js';
import { couvrirSequence } from '../app/langage/sequence-plages.js';
import { decrireValeursObservees } from '../app/langage/valeurs-observees.js';
import { decrireStructureIdentifiee } from '../app/langage/structure-identifiee.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const sc = (genre) => (genre === undefined ? { forme: 'scalaire' } : { forme: 'scalaire', genre });
const ob = (champs) => (champs === undefined ? { forme: 'objet' } : { forme: 'objet', champs });
const co = (elements) => (elements === undefined ? { forme: 'collection' } : { forme: 'collection', elements });
const Q = { forme: 'quelconque' };
const avec = (forme, faits) => ({ ...forme, ...faits });
const op = (sortie, entrees = {}, nom = 'operation_de_test') => ({ nom, entrees, sortie });
const refuse = (d, motif) => assert.throws(() => valider(d), (e) => e instanceof TypeError && (motif ? motif.test(e.message) : true), 'devait refuser avec un TypeError');
const refuseG = (f, a, motif) => assert.throws(() => g(f, a), (e) => e instanceof TypeError && (motif ? motif.test(e.message) : true), 'devait lever un TypeError');

// ============================================================================ A. LA FORME `quelconque`
test('A1. quelconque est acceptée partout où une forme l\'est : champ d\'entrée, sortie racine, champ de sortie, élément de collection, champ d\'objet', () => {
  assert.deepEqual(valider(op(sc(), { x: Q })).entrees.x, { forme: 'quelconque' });
  assert.deepEqual(valider(op(Q)).sortie, { forme: 'quelconque' });
  assert.deepEqual(valider(op(ob({ y: Q }))).sortie.champs.y, { forme: 'quelconque' });
  assert.deepEqual(valider(op(co(Q))).sortie.elements, { forme: 'quelconque' });
  assert.deepEqual(valider(op(sc(), { o: ob({ q: Q }) })).entrees.o.champs.q, { forme: 'quelconque' });
});
test('A2. quelconque n\'accepte NI genre, NI champs, NI elements, NI aucune autre propriété', () => {
  for (const extra of [{ genre: 'chaine' }, { champs: {} }, { champs: { a: sc() } }, { elements: sc() }, { elements: Q }, { autre: 1 }, { genre: undefined }]) {
    refuse(op(sc(), { x: { ...Q, ...extra } }), /quelconque|n'est pas permise/);
    refuse(op({ ...Q, ...extra }), /n'est pas permise/);
  }
});
test('A3. la forme est exacte : variantes de casse, valeurs voisines et types non chaîne sont refusées', () => {
  for (const f of ['Quelconque', 'QUELCONQUE', 'quelconques', 'any', 'tout', '', null, undefined, 5, ['quelconque'], {}]) refuse(op(sc(), { x: { forme: f } }), /forme doit valoir/);
});
test('A4. faits sur un champ quelconque : omissible en entrée ; peutManquer / peutEtreNull en sortie ; mauvais côté refusé', () => {
  assert.equal(valider(op(sc(), { x: { ...Q, omissible: true } })).entrees.x.omissible, true);
  const s = valider(op(ob({ y: { ...Q, peutManquer: true, peutEtreNull: true } }))).sortie.champs.y;
  assert.deepEqual(s, { forme: 'quelconque', peutManquer: true, peutEtreNull: true });
  refuse(op(ob({ y: { ...Q, omissible: true } })), /omissible/);
  refuse(op(sc(), { x: { ...Q, peutManquer: true } }), /peutManquer/);
});
test('A5. les faits restent interdits à la racine de la sortie et sur un élément de collection, y compris pour quelconque', () => {
  for (const fait of ['peutManquer', 'peutEtreNull']) {
    refuse(op({ ...Q, [fait]: true }), new RegExp(fait));
    refuse(op(co({ ...Q, [fait]: true })), new RegExp(fait));
  }
});
test('A6. la copie est indépendante et fidèle : rien de plus, rien de moins ; entrée gelée acceptée ; sortie neuve', () => {
  const d = op(co(Q), { x: { ...Q, omissible: true } });
  const gele = (x) => { Object.freeze(x); if (x && typeof x === 'object') Object.values(x).forEach(gele); return x; };
  gele(d);
  const r = valider(d);
  assert.deepEqual(r, d);
  assert.notEqual(r.sortie.elements, d.sortie.elements);
  assert.notEqual(r.entrees.x, d.entrees.x);
  r.sortie.elements.forme = 'modifiee';
  assert.equal(d.sortie.elements.forme, 'quelconque');
});
test('A7. quelconque dans une forme qui se contient elle-même : le cycle reste refusé', () => {
  const a = { forme: 'objet', champs: {} };
  a.champs.soi = a;
  refuse(op(a), /cycle/);
  const c = { forme: 'collection' }; c.elements = c;
  refuse(op(c), /cycle/);
});
test('A8. une forme quelconque réutilisée à deux endroits sans cycle est copiée deux fois, indépendamment', () => {
  const partage = { forme: 'quelconque' };
  const r = valider(op(ob({ a: partage, b: partage })));
  assert.notEqual(r.sortie.champs.a, r.sortie.champs.b);
});

// ============================================================================ B. `peutEtreNull` CÔTÉ ENTRÉE
test('B1. un champ d\'entrée peut déclarer peutEtreNull, seul ou avec omissible : les quatre combinaisons sont conservées telles quelles', () => {
  for (const om of [undefined, false, true]) for (const pn of [undefined, false, true]) {
    const champ = { ...sc('chaine'), ...(om === undefined ? {} : { omissible: om }), ...(pn === undefined ? {} : { peutEtreNull: pn }) };
    const r = valider(op(sc(), { x: champ })).entrees.x;
    assert.deepEqual(r, champ, `om=${om} pn=${pn}`);
    assert.equal('omissible' in r, om !== undefined);
    assert.equal('peutEtreNull' in r, pn !== undefined);
  }
});
test('B2. absent ≠ null : omissible n\'implique jamais peutEtreNull, et inversement ; aucune propriété undefined n\'existe', () => {
  assert.equal('peutEtreNull' in valider(op(sc(), { x: { ...sc(), omissible: true } })).entrees.x, false);
  assert.equal('omissible' in valider(op(sc(), { x: { ...sc(), peutEtreNull: true } })).entrees.x, false);
  for (const nom of ['undefined', 'peutEtreUndefined', 'presentUndefined', 'nullable', 'optionnel']) refuse(op(sc(), { x: { ...sc(), [nom]: true } }), /n'est pas permis|n'est pas permise/);
});
test('B3. peutEtreNull d\'entrée est permis sur toute forme de champ (scalaire, objet, collection, quelconque) et dans un objet imbriqué', () => {
  for (const f of [sc(), sc('nombre'), ob(), ob({ a: sc() }), co(), co(sc()), Q]) {
    assert.equal(valider(op(sc(), { x: { ...f, peutEtreNull: true } })).entrees.x.peutEtreNull, true);
  }
  const r = valider(op(sc(), { o: ob({ n: { ...sc('chaine'), peutEtreNull: true, omissible: true } }) }));
  assert.deepEqual(r.entrees.o.champs.n, { forme: 'scalaire', genre: 'chaine', omissible: true, peutEtreNull: true });
});
test('B4. valeur non booléenne refusée', () => {
  for (const v of ['true', 1, 0, null, undefined, {}, []]) refuse(op(sc(), { x: { ...sc(), peutEtreNull: v } }), /peutEtreNull/);
});
test('B5. peutEtreNull d\'entrée reste interdit où aucun champ n\'existe : élément de collection d\'entrée ; peutManquer d\'entrée reste refusé', () => {
  refuse(op(sc(), { x: co({ ...sc(), peutEtreNull: true }) }), /peutEtreNull/);
  refuse(op(sc(), { x: { ...sc(), peutManquer: true } }), /peutManquer/);
});
test('B6. côté sortie, rien ne change : peutEtreNull et peutManquer autorisés sur un champ ; omissible refusé', () => {
  const s = valider(op(ob({ y: { ...sc(), peutEtreNull: true } }))).sortie.champs.y;
  assert.equal(s.peutEtreNull, true);
  refuse(op(ob({ y: { ...sc(), omissible: true } })), /omissible/);
});

// ============================================================================ C. RÈGLES DE GARANTIE
test('C1. quelconque FOURNIE ne garantit rien de plus précis (conservateur)', () => {
  for (const attendue of [sc('chaine'), sc(), sc('nombre'), ob(), ob({ a: sc() }), co(), co(sc('chaine'))]) assert.equal(g(Q, attendue), false, JSON.stringify(attendue));
});
test('C2. toute forme fournie garantit une attendue quelconque : l\'attendue ne contraint rien (justification : une attendue non contrainte est satisfaite par n\'importe quelle valeur)', () => {
  for (const fournie of [sc('chaine'), sc('nombre'), sc('booleen'), sc(), ob(), ob({ a: sc('chaine') }), co(), co(sc('chaine')), co(ob({ a: sc() })), Q]) assert.equal(g(fournie, Q), true, JSON.stringify(fournie));
});
test('C3. quelconque -> quelconque : true ; objet -> quelconque : true ; collection -> quelconque : true ; chaîne -> quelconque : true', () => {
  assert.equal(g(Q, Q), true);
  assert.equal(g(ob({ a: sc() }), Q), true);
  assert.equal(g(co(sc('chaine')), Q), true);
  assert.equal(g(sc('chaine'), Q), true);
});
test('C4. dans un objet : champ fourni précis -> champ attendu quelconque : true ; champ fourni quelconque -> champ attendu précis : false', () => {
  assert.equal(g(ob({ a: sc('chaine') }), ob({ a: Q })), true);
  assert.equal(g(ob({ a: Q }), ob({ a: sc('chaine') })), false);
  assert.equal(g(ob({ a: Q }), ob({ a: Q })), true);
});
test('C5. la PRÉSENCE d\'un champ reste exigée même quand sa forme est quelconque (R3 inchangée)', () => {
  assert.equal(g(ob({ b: sc() }), ob({ a: Q })), false);
  assert.equal(g(ob(), ob({ a: Q })), false, 'fournie sans champs décrits face à un champ exigé');
  assert.equal(g(ob({ a: Q }), ob()), true, 'attendue sans champs décrits : rien n\'est exigé');
});
test('C6. collections : éléments précis -> éléments quelconques : true ; éléments quelconques -> précis : false ; éléments non décrits -> quelconques : false (conservateur, voir R4)', () => {
  assert.equal(g(co(sc('chaine')), co(Q)), true);
  assert.equal(g(co(Q), co(sc('chaine'))), false);
  assert.equal(g(co(Q), co(Q)), true);
  assert.equal(g(co(), co(Q)), false, 'éléments non décrits : inconnus, donc rien n\'est garanti face à une description, même quelconque');
  assert.equal(g(co(sc()), co()), true);
});
test('C7. fournisseur nullable -> consommateur NON nullable : false', () => {
  assert.equal(g(avec(sc('chaine'), { peutEtreNull: true }), sc('chaine')), false);
  assert.equal(g(avec(sc('chaine'), { peutEtreNull: true }), avec(sc('chaine'), { omissible: true })), false, 'omissible n\'accepte pas null');
  assert.equal(g(avec(Q, { peutEtreNull: true }), Q), false, 'même face à une attendue quelconque');
  assert.equal(g(avec(sc('chaine'), { peutEtreNull: true }), Q), false);
});
test('C8. fournisseur NON nullable -> consommateur nullable : true ; fournisseur nullable -> consommateur nullable : true', () => {
  const nul = (f) => avec(f, { peutEtreNull: true });
  assert.equal(g(sc('chaine'), nul(sc('chaine'))), true);
  assert.equal(g(nul(sc('chaine')), nul(sc('chaine'))), true);
  assert.equal(g(nul(Q), nul(Q)), true);
  assert.equal(g(nul(sc('chaine')), nul(Q)), true);
  assert.equal(g(nul(ob({ a: sc() })), nul(ob({ a: sc() }))), true);
});
test('C9. accepter null ne sauve JAMAIS deux formes qui diffèrent : chaîne -> nombre reste false, y compris si les deux côtés sont nullables', () => {
  const nul = (f) => avec(f, { peutEtreNull: true });
  assert.equal(g(sc('chaine'), nul(sc('nombre'))), false);
  assert.equal(g(nul(sc('chaine')), nul(sc('nombre'))), false);
  assert.equal(g(nul(ob({ a: sc() })), nul(co())), false);
  assert.equal(g(nul(Q), nul(sc('chaine'))), false);
  assert.equal(g(nul(sc()), nul(ob())), false);
  assert.equal(g(ob({ a: sc('chaine') }), ob({ a: nul(sc('nombre')) })), false);
  assert.equal(g(ob({}), nul(ob({ a: sc() }))), false);
});
test('C10. omissible et nullable restent INDÉPENDANTS : table complète (fournie peutManquer × peutEtreNull, attendue omissible × peutEtreNull)', () => {
  for (const pm of [false, true]) for (const pn of [false, true]) for (const om of [false, true]) for (const an of [false, true]) {
    const f = avec(sc('chaine'), { peutManquer: pm, peutEtreNull: pn });
    const a = avec(sc('chaine'), { omissible: om, peutEtreNull: an });
    const attendu = !(pn && !an) && !(pm && !om);
    assert.equal(g(f, a), attendu, `pm=${pm} pn=${pn} om=${om} an=${an}`);
    const fq = avec(Q, { peutManquer: pm, peutEtreNull: pn });
    const aq = avec(Q, { omissible: om, peutEtreNull: an });
    assert.equal(g(fq, aq), attendu, `quelconque pm=${pm} pn=${pn} om=${om} an=${an}`);
  }
});
test('C11. un fait absent vaut false (inchangé) : fournie sans fait face à une attendue nullable ou omissible : true', () => {
  assert.equal(g(sc('chaine'), avec(sc('chaine'), { peutEtreNull: false })), true);
  assert.equal(g(avec(sc('chaine'), { peutEtreNull: false }), avec(sc('chaine'), { peutEtreNull: false })), true);
  assert.equal(g(avec(sc('chaine'), { peutEtreNull: false }), sc('chaine')), true);
});
test('C12. nullabilité imbriquée : un champ profond nullable côté fournie sans acceptation côté attendue fait échouer toute la garantie', () => {
  const fournie = ob({ a: ob({ b: avec(sc('chaine'), { peutEtreNull: true }) }) });
  assert.equal(g(fournie, ob({ a: ob({ b: sc('chaine') }) })), false);
  assert.equal(g(fournie, ob({ a: ob({ b: avec(sc('chaine'), { peutEtreNull: true }) }) })), true);
  assert.equal(g(fournie, ob({ a: ob({ b: avec(Q, { peutEtreNull: true }) }) })), true);
});
test('C13. validation conservée : omissible sur la fournie et peutManquer sur l\'attendue restent refusés ; peutEtreNull attendu accepté ; quelconque avec genre refusé', () => {
  refuseG(avec(sc(), { omissible: true }), sc(), /omissible/);
  refuseG(sc(), avec(sc(), { peutManquer: true }), /peutManquer/);
  assert.doesNotThrow(() => g(sc(), avec(sc(), { peutEtreNull: true })));
  refuseG({ ...Q, genre: 'chaine' }, sc());
  refuseG(sc(), { ...Q, champs: {} });
  refuseG(Q, { ...Q, elements: Q });
});
test('C14. aucune mutation des arguments (gelés acceptés) et sortie exactement booléenne', () => {
  const gele = (x) => { Object.freeze(x); if (x && typeof x === 'object') Object.values(x).forEach(gele); return x; };
  const f = gele(ob({ a: avec(Q, { peutEtreNull: true, peutManquer: true }) }));
  const a = gele(ob({ a: avec(Q, { peutEtreNull: true, omissible: true }) }));
  assert.strictEqual(g(f, a), true);
  assert.strictEqual(g(Q, sc()), false);
});

// ============================================================================ D. TROIS CONTRATS RÉELS (descripteurs importés de la source unique de production)
const nombre = sc('nombre'), chaine = sc('chaine'), bool = sc('booleen');
const nullable = (f) => avec(f, { peutEtreNull: true });
// Les trois descripteurs viennent de la SOURCE UNIQUE de production (v0.63.4) : ils ne sont plus redéclarés ici.
const DESCRIPTIONS = Object.fromEntries(DESCRIPTIONS_OPERATIONS.map((d) => [d.nom, d]));
const D_COUVRIR = DESCRIPTIONS.couvrirSequence;
const D_VALEURS = DESCRIPTIONS.decrireValeursObservees;
const D_STRUCTURE = DESCRIPTIONS.decrireStructureIdentifiee;
// Vérificateur de conformité (TESTS SEULEMENT) : une valeur réelle respecte-t-elle une forme ? « undefined présent » n'est
// PAS représentable : une propriété présente valant undefined n'est conforme à aucun champ (voir la dette, test E).
function conforme(valeur, forme, fait = {}) {
  if (valeur === undefined) return false;
  if (valeur === null) return fait.peutEtreNull === true;
  switch (forme.forme) {
    case 'quelconque': return true;
    case 'scalaire': return typeof valeur === ({ chaine: 'string', nombre: 'number', booleen: 'boolean' }[forme.genre] || typeof valeur) && ['string', 'number', 'boolean'].includes(typeof valeur);
    case 'collection': return Array.isArray(valeur) && (forme.elements === undefined || valeur.every((v) => conforme(v, forme.elements)));
    case 'objet': {
      if (typeof valeur !== 'object' || Array.isArray(valeur)) return false;
      if (forme.champs === undefined) return true;
      return Object.entries(forme.champs).every(([nom, champ]) => {
        if (!Object.prototype.hasOwnProperty.call(valeur, nom)) return champ.omissible === true || champ.peutManquer === true;
        return conforme(valeur[nom], champ, champ);
      });
    }
    default: return false;
  }
}

test('D0. les trois descripteurs de production respectent le langage étendu : validés par la primitive existante, copie identique', () => {
  for (const d of [D_COUVRIR, D_VALEURS, D_STRUCTURE]) assert.deepEqual(valider(d), d, d.nom);
});
test('D1. (A) element et etiquette de couvrirSequence sont décrits comme quelconque (et nullables : JSON null est admis), sans prétendre qu\'ils sont scalaires', () => {
  const s = valider(D_COUVRIR).sortie.elements.champs;
  assert.deepEqual(s.element, { forme: 'quelconque', peutEtreNull: true });
  assert.deepEqual(s.couvertures.elements.champs.etiquette, { forme: 'quelconque', peutEtreNull: true });
  assert.deepEqual(valider(D_COUVRIR).entrees.plages.elements.champs.etiquette, { forme: 'quelconque', peutEtreNull: true });
  assert.equal(JSON.stringify(valider(D_COUVRIR)).includes('"scalaire","genre"') && false, false);
  assert.notEqual(s.element.forme, 'scalaire');
});
test('D2. (B) la valeur d\'entrée de decrireValeursObservees est scalaire + omissible + peutEtreNull, deux faits indépendants', () => {
  const v = valider(D_VALEURS).entrees.paires.elements.champs.valeur;
  assert.deepEqual(v, { forme: 'scalaire', omissible: true, peutEtreNull: true });
  assert.notEqual(v.omissible, v.peutEtreNull === undefined);
});
test('D3. les descripteurs sont HONNÊTES : les sorties et entrées réelles de couvrirSequence / decrireValeursObservees / decrireStructureIdentifiee y sont conformes', () => {
  const entreeCs = { elements: ['ou', 'tu', { a: [1, null] }, null], plages: [{ debut: 0, longueur: 1, etiquette: 'type' }, { debut: 0, longueur: 2, etiquette: { k: [1] } }, { debut: 3, longueur: 1, etiquette: null }] };
  assert.ok(conforme(entreeCs.elements, D_COUVRIR.entrees.elements));
  assert.ok(conforme(entreeCs.plages, D_COUVRIR.entrees.plages));
  const sortieCs = couvrirSequence(entreeCs);
  assert.ok(conforme(sortieCs, D_COUVRIR.sortie), 'sortie réelle de couvrirSequence');
  assert.equal(sortieCs[3].element, null, 'null est bien une valeur réelle de element');
  const paires = [{ id: 'a', valeur: 'x' }, { id: 'b', valeur: null }, { id: 'c' }, { id: 'd', valeur: 7 }, { id: 'e', valeur: true }];
  assert.ok(conforme(paires, D_VALEURS.entrees.paires), 'entrées réelles acceptées par decrireValeursObservees');
  const sortieV = decrireValeursObservees(paires);
  assert.ok(conforme(sortieV, D_VALEURS.sortie), 'sortie réelle de decrireValeursObservees');
  assert.deepEqual(sortieV.nonResolus, ['c']);
  const elements = [{ id: 'a', texte: 'le chat dort ici' }, { id: 'b', texte: 'le chien dort ici' }];
  assert.ok(conforme(elements, D_STRUCTURE.entrees.elements));
  const echec = decrireStructureIdentifiee([{ id: 'a', texte: 'un deux' }, { id: 'b', texte: 'un deux trois' }]);
  const succes = decrireStructureIdentifiee(elements);
  assert.equal(echec.rapport.ok, false); assert.equal(succes.rapport.ok, true);
  assert.ok(conforme(echec, D_STRUCTURE.sortie), 'sortie réelle (échec)');
  assert.ok(conforme(succes, D_STRUCTURE.sortie), 'sortie réelle (succès)');
});
test('D4. (C) incompatibilités directes : couvrirSequence -> decrireValeursObservees et -> decrireStructureIdentifiee restent FAUSSES', () => {
  assert.equal(g(D_COUVRIR.sortie, D_VALEURS.entrees.paires), false);
  assert.equal(g(D_COUVRIR.sortie, D_STRUCTURE.entrees.elements), false);
});
test('D5. ... pour la VRAIE raison : leurs champs ne correspondent pas (id/valeur, puis id/texte) ; ajouter ces seuls champs, avec la bonne forme, suffit à inverser le verdict', () => {
  const element = D_COUVRIR.sortie.elements.champs;
  const avecChamps = (extra) => co(ob({ ...element, ...extra }));
  assert.equal(g(avecChamps({ id: chaine }), D_VALEURS.entrees.paires), false, 'id seul ne suffit pas : valeur doit aussi être déclarée');
  assert.equal(g(avecChamps({ id: chaine, valeur: sc('chaine') }), D_VALEURS.entrees.paires), true);
  assert.equal(g(avecChamps({ id: chaine, texte: chaine }), D_STRUCTURE.entrees.elements), true);
  assert.equal(g(avecChamps({ id: nombre, texte: chaine }), D_STRUCTURE.entrees.elements), false, 'mauvaise forme du champ id');
  assert.equal(g(avecChamps({ id: chaine }), D_STRUCTURE.entrees.elements), false, 'texte manque');
});
test('D6. l\'extension ne rend pas ces incompatibilités vraies par accident : même avec quelconque et nullabilité, ni position, ni element, ni couvertures ne tiennent lieu de id/valeur/texte', () => {
  const nulPartout = co(ob({ position: nullable(Q), element: nullable(Q), couvertures: nullable(Q) }));
  assert.equal(g(nulPartout, D_VALEURS.entrees.paires), false);
  assert.equal(g(nulPartout, D_STRUCTURE.entrees.elements), false);
  assert.equal(g(co(Q), D_VALEURS.entrees.paires), false, 'éléments quelconques ne garantissent aucun champ');
  assert.equal(g(Q, D_VALEURS.entrees.paires), false);
});
test('D7. null à l\'entrée de decrireValeursObservees : un fournisseur dont la valeur peut être null est maintenant garanti (le contrat réel l\'accepte) ; il ne l\'était pas avant l\'extension', () => {
  const fournisseur = co(ob({ id: chaine, valeur: avec(sc(), { peutEtreNull: true, peutManquer: true }) }));
  assert.equal(g(fournisseur, D_VALEURS.entrees.paires), true);
  const entreeSansNull = co(ob({ id: chaine, valeur: avec(sc(), { omissible: true }) }));
  assert.equal(g(fournisseur, entreeSansNull), false, 'un consommateur qui ne déclare pas accepter null n\'est pas garanti');
  const reel = decrireValeursObservees([{ id: 'a', valeur: null }, { id: 'b' }]);
  assert.deepEqual(reel.valeurs, [{ valeur: null, ids: ['a'] }]);
  assert.deepEqual(reel.nonResolus, ['b']);
});
test('D8. consommateur d\'une étiquette : exigence quelconque nullable satisfaite par couvrirSequence ; exigence chaîne non', () => {
  const couvertures = D_COUVRIR.sortie.elements.champs.couvertures;
  assert.equal(g(couvertures, co(ob({ etiquette: nullable(Q) }))), true);
  assert.equal(g(couvertures, co(ob({ etiquette: Q }))), false, 'l\'étiquette peut être null, le consommateur ne l\'accepte pas');
  assert.equal(g(couvertures, co(ob({ etiquette: chaine }))), false);
});

// ============================================================================ E. DETTE `undefined` (délibérée)
test('E1. le langage ne représente toujours pas « undefined présent » : aucun fait, aucune forme, aucun genre ne le nomme', () => {
  for (const nom of ['undefined', 'peutEtreUndefined', 'presentUndefined']) {
    refuse(op(sc(), { x: { ...sc(), [nom]: true } }));
    refuse(op(ob({ y: { ...sc(), [nom]: true } })));
  }
  refuse(op(sc(), { x: { forme: 'undefined' } }), /forme doit valoir/);
  refuse(op(sc(), { x: { ...sc(), genre: 'undefined' } }), /genre/);
});
test('E2. la perte est réelle et reste SIGNALÉE : decrireValeursObservees distingue absent / undefined présent / null ; le descripteur ne distingue qu\'absent (omissible) et null (peutEtreNull)', () => {
  const r = decrireValeursObservees([{ id: 'absent' }, { id: 'indef', valeur: undefined }, { id: 'nul', valeur: null }]);
  assert.deepEqual(r.nonResolus, ['absent']);
  assert.equal(r.valeurs.length, 2);
  assert.deepEqual(r.valeurs.map((v) => v.ids), [['indef'], ['nul']]);
  assert.ok(r.valeurs.some((v) => v.valeur === undefined), 'undefined présent est une valeur observée distincte');
  const v = valider(D_VALEURS).entrees.paires.elements.champs.valeur;
  assert.deepEqual(Object.keys(v).sort(), ['forme', 'omissible', 'peutEtreNull']);
  assert.equal(conforme(undefined, sc(), v), false, 'le vérificateur de tests refuse lui aussi « undefined présent » : non représentable');
});
test('E3. « omissible » ne masque PAS undefined : omissible et peutEtreNull ne couvrent pas à eux deux « undefined présent » (un fournisseur peutManquer + peutEtreNull n\'exprime pas cette valeur)', () => {
  const f = co(ob({ id: chaine, valeur: avec(sc(), { peutManquer: true, peutEtreNull: true }) }));
  assert.equal(g(f, D_VALEURS.entrees.paires), true, 'garanti pour absent et null, comme déclaré');
  assert.equal(JSON.stringify(f).includes('undefined'), false);
});

// ============================================================================ F. DORMANCE ET PÉRIMÈTRE
const RACINE = join(import.meta.dirname, '..');
function fichiersJs(dossier) {
  const sortie = [];
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom);
    if (statSync(p).isDirectory()) sortie.push(...fichiersJs(p));
    else if (/\.(js|mjs)$/.test(nom)) sortie.push(p);
  }
  return sortie;
}
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

test('F1. aucun fichier de production ne reçoit de descripteur ni ne consulte les formes : seuls formes-operation.js, garantie-forme.js, (v0.63.12) productions-decrites.js et (v0.63.13) possibilites-liaison.js les nomment', () => {
  const fautifs = [];
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const rel = relative(RACINE, f).split('\\').join('/');
    if (rel === 'app/langage/formes-operation.js' || rel === 'app/langage/garantie-forme.js' || rel === 'app/langage/productions-decrites.js' || rel === 'app/langage/possibilites-liaison.js' || rel === 'app/langage/donnee-de-source.js' || rel === 'app/langage/groupes-candidats.js' || rel === 'app/langage/conformite-application.js' || rel === 'app/langage/empreinte-contrats.js' || rel === 'app/langage/applications-sollicitables.js' || rel === 'app/langage/empreinte-relations.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.61 : + applications-sollicitables.js, empreinte-relations.js // MISE À JOUR DÉLIBÉRÉE v0.63.51 : + empreinte-contrats.js (gardé par tests/empreinte-contrats.test.mjs) ; v0.63.40 : + conformite-application.js ; v0.63.15 : + donnee-de-source.js (gardé par tests/donnee-de-source.test.mjs) ; // v0.63.12 : + productions-decrites.js (gardé par tests/productions-decrites.test.mjs) ; v0.63.13 : + possibilites-liaison.js (gardé par tests/possibilites-liaison.test.mjs)
    if (/validerDescripteurOperation|fournieGarantitAttendue|formes-operation|garantie-forme/.test(sansCommentaires(readFileSync(f, 'utf8')))) fautifs.push(rel);
  }
  assert.deepEqual(fautifs, []);
});
test('F2. aucune capacité du registre ne porte de descripteur : CAPACITES garde ses clés de rôle, rien d\'autre', async () => {
  const { CAPACITES } = await import('../app/langage/registre.js');
  for (const [nom, c] of Object.entries(CAPACITES)) assert.deepEqual(Object.keys(c).sort(), ['invoquer', 'representer', 'roles'], nom);
});
test('F3. formes-operation.js et garantie-forme.js n\'importent toujours que ce qu\'ils importaient (rien, et formes-operation) ; export unique inchangé', () => {
  const fo = sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', 'formes-operation.js'), 'utf8'));
  const ga = sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', 'garantie-forme.js'), 'utf8'));
  assert.deepEqual(fo.match(/^\s*import\b.*$/gm), ["import { SCHEMA_RELATIONS } from './relations-schema.js';"]); // MISE À JOUR DÉLIBÉRÉE v0.63.61 : formes-operation.js importe un module de DONNÉE PURE (relations-schema.js) pour la clé facultative `relations`
  assert.deepEqual(ga.match(/^\s*import\b.*$/gm), ["import { validerDescripteurOperation } from './formes-operation.js';"]);
  assert.deepEqual(fo.match(/^export .*$/gm), ['export function validerDescripteurOperation(descripteur) {']);
  assert.deepEqual(ga.match(/^export .*$/gm), ['export function fournieGarantitAttendue(fournie, attendue) {']);
});
test('F4. pas de vocabulaire interdit dans le code des deux modules : union, enum, dictionnaire, entier, borne, générique, projection, adaptateur, catalogue, registre', () => {
  for (const f of ['formes-operation.js', 'garantie-forme.js']) {
    const code = sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', f), 'utf8'));
    for (const mot of [/\bunion\b/i, /\benum\b/i, /dictionnaire/i, /entier/i, /\bborne/i, /g[ée]n[ée]rique/i, /projec/i, /adaptateur/i, /catalogue/i, /registre/i, /renomm/i, /nonVide/i, /unicit/i, /cardinal/i]) {
      assert.equal(mot.test(code), false, `${f} ne doit pas contenir ${mot}`);
    }
  }
});
test('F5. VERSION_BASE, SCHEMA_SAUVEGARDE et les tables ne changent pas dans cette version', async () => {
  const conn = await import('../app/langage/connaissances.js');
  const sauv = await import('../app/memoire/sauvegarde.js');
  assert.equal(conn.VERSION_BASE, 20); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables)
  assert.equal(sauv.SCHEMA_SAUVEGARDE, 10); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables)
});
// === FIN_TEST_FORMES_EXTENSION ===
