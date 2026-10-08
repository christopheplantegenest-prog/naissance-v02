// v0.63.54 — « EXPOSER LES ENTRÉES PERSISTÉES D'UNE PRODUCTION » (décision ChatGPT, 06/10/2026) : entreesDeProduction, primitive pure et dormante.
// Elle rend les liaisons d'entrée persistées d'une production, rien d'autre : ni observation, ni passé, ni donnée du moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import * as module from '../app/langage/entrees-production.js';
import { entreesDeProduction } from '../app/langage/entrees-production.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { sousValeurConforme, indexSousDonnees } from '../app/langage/sous-donnees.js';
import { validerDescripteurOperation } from '../app/langage/formes-operation.js';
import { DESCRIPTIONS_OPERATIONS as C16 } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { ACCES_VALEUR_DONNEE } from '../app/langage/valeur-donnee.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const CODE = sansCommentaires(lu('app', 'langage', 'entrees-production.js'));
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)));
const clone = (v) => JSON.parse(JSON.stringify(v));
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const FORME_LIAISONS = { forme: 'collection', elements: { forme: 'objet', champs: { entree: { forme: 'scalaire', genre: 'chaine' }, donnee: { forme: 'scalaire', genre: 'chaine', peutManquer: true }, donnees: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' }, peutManquer: true } } } };

// ---- chaîne réelle (mêmes mécanismes que le flux vivant)
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
    const application = liaisons ? { operation, liaisons } : applicationsSollicitables(t.observation, undefined, t.univers).applications.find((a) => a.operation === operation);
    assert.ok(application, operation);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
    assert.equal(r.statut, 'executee', `${operation} : ${r.erreur && r.erreur.message}`);
    return { ...r, t };
  }
  const lire = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations'), designations: await magasin.lireTout('designations'), observations: await magasin.lireTout('observationsPossibilites') });
  return { magasin, tour, lancer, lire };
}
let CACHE = null;
async function chaine() {
  if (CACHE) return CACHE;
  const w = monde(); const E = {};
  E.A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  E.B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  E.P = await w.lancer('tour P', 'elementsObservables');
  E.S = await w.lancer('tour S', 'produireSuitesFermees', [{ entree: 'elements', donnee: E.P.execution.id }]);
  E.M = await w.lancer('tour M', 'projeterContenus', [{ entree: 'elements', donnee: E.S.execution.id }]);
  E.H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: E.P.execution.id }]);
  E.Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: E.H.execution.id }, { entree: 'b', donnee: E.H.execution.id }]);
  E.AY = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  E.PY = await w.lancer('tour PY', 'elementsObservables');
  E.R = await w.lancer('tour R', 'rechercherSousSuites', [{ entree: 'motifs', donnee: E.M.execution.id }, { entree: 'elements', donnee: E.PY.execution.id }]);
  const l0 = await w.lire();
  const sousCommuns = l0.executions.find((e) => e.id === E.Q.execution.id).sousDonnees.find((s) => s.chemin[0] === 'communs').id;
  E.N = await w.lancer('tour N', 'normaliserCouverture', [{ entree: 'chemins', donnee: sousCommuns }]);
  const l = await w.lire();
  CACHE = { w, E, l, sousCommuns, id: (k) => E[k].execution.id, ligne: (k) => l.executions.find((e) => e.id === E[k].execution.id) };
  return CACHE;
}
const L = (id, liaisons, extra = {}) => ({ id, operation: 'symbolesDeChaine', idDesignation: 'designation-1', liaisons, resultat: ['x'], ...extra });

// ============================================================================ A. CONTRAT
test('A1. export unique : entreesDeProduction ; synchrone (ne rend pas une promesse), rend un tableau', async () => {
  assert.deepEqual(Object.keys(module), ['entreesDeProduction']);
  assert.equal(entreesDeProduction.length, 2);
  const r = entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnee: 'm1' }])]);
  assert.equal(typeof r.then, 'undefined');
  assert.ok(Array.isArray(r));
  assert.equal(CODE.includes('async ') || CODE.includes('await ') || CODE.includes('Promise'), false);
});
test('A2. ORDINAIRE et COLLECTIVE : copie structurelle exacte, mêmes noms, mêmes identités, même regroupement, même ordre ; clés { entree, donnee } / { entree, donnees }', () => {
  const brut = [{ entree: 'a', donnee: 'm1' }, { entree: 'b', donnees: ['x1', 'x2', 'x3'] }, { entree: 'c', donnee: 'm1' }];
  const r = entreesDeProduction('e1', [L('e1', brut)]);
  assert.deepEqual(r, brut);
  assert.deepEqual(r.map((x) => Object.keys(x)), [['entree', 'donnee'], ['entree', 'donnees'], ['entree', 'donnee']]);
  assert.equal(r.length, 3, 'une liaison collective n\'est jamais éclatée');
});
test('A3. une collective à UNE seule identité reste collective (donnees:[x]) ; elle n\'est pas confondue avec une ordinaire', () => {
  const r = entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnees: ['x1'] }, { entree: 'b', donnee: 'x1' }])]);
  assert.deepEqual(r, [{ entree: 'a', donnees: ['x1'] }, { entree: 'b', donnee: 'x1' }]);
});

// ============================================================================ B. IDENTITÉ ET LIGNES
test('B1. identité invalide : TypeError', () => {
  const lignes = [L('e1', [{ entree: 'a', donnee: 'm1' }])];
  for (const mauvais of [undefined, null, '', 3, {}, [], ['e1'], Symbol('e1'), true]) refuse(() => entreesDeProduction(mauvais, lignes), /identiteProduction/);
});
test('B2. lignesExecutions invalide : non tableau, creux, rang accesseur, ligne non objet, id absent / accesseur / vide / non chaîne : TypeError', () => {
  for (const mauvais of [undefined, null, 'x', {}, 3]) refuse(() => entreesDeProduction('e1', mauvais), /lignesExecutions/);
  const creux = [L('e1', [{ entree: 'a', donnee: 'm1' }])]; creux.length = 2;
  refuse(() => entreesDeProduction('e1', creux), /creux/);
  const acc = [L('e1', [{ entree: 'a', donnee: 'm1' }])]; Object.defineProperty(acc, 1, { enumerable: true, get() { return L('e2', [{ entree: 'a', donnee: 'm1' }]); } });
  refuse(() => entreesDeProduction('e1', acc), /accesseur/);
  for (const ligne of [null, 3, 'x', [], undefined]) refuse(() => entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnee: 'm1' }]), ligne]));
  const sansId = L('x', [{ entree: 'a', donnee: 'm1' }]); delete sansId.id;
  const idAcc = L('x', [{ entree: 'a', donnee: 'm1' }]); delete idAcc.id; Object.defineProperty(idAcc, 'id', { enumerable: true, get() { return 'e1'; } });
  for (const autre of [sansId, idAcc, L('', [{ entree: 'a', donnee: 'm1' }]), L(7, [{ entree: 'a', donnee: 'm1' }])]) refuse(() => entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnee: 'm1' }]), autre]));
});
test('B3. AUCUNE exécution correspondante : TypeError (table vide comprise)', () => {
  refuse(() => entreesDeProduction('e1', []), /aucune exécution/);
  refuse(() => entreesDeProduction('e9', [L('e1', [{ entree: 'a', donnee: 'm1' }])]), /aucune exécution/);
});
test('B4. PLUSIEURS exécutions de même identité : TypeError, même si leurs liaisons sont identiques, quel que soit l\'ordre', () => {
  const l1 = L('e1', [{ entree: 'a', donnee: 'm1' }]); const l2 = L('e1', [{ entree: 'a', donnee: 'm1' }]); const l3 = L('e1', [{ entree: 'b', donnee: 'm2' }]);
  refuse(() => entreesDeProduction('e1', [l1, l2]), /2 exécutions/);
  refuse(() => entreesDeProduction('e1', [l3, l1]), /2 exécutions/);
  refuse(() => entreesDeProduction('e1', [l1, L('e2', [{ entree: 'a', donnee: 'm1' }]), l2]), /2 exécutions/);
});
test('B5. ligne correspondante MAL FORMÉE : operation / liaisons absents, vides, non chaînes ou accesseurs : TypeError', () => {
  const bonnes = [{ entree: 'a', donnee: 'm1' }];
  for (const champ of ['operation', 'liaisons']) {
    const sans = L('e1', bonnes); delete sans[champ];
    refuse(() => entreesDeProduction('e1', [sans]), new RegExp(champ));
    const acc = L('e1', bonnes); delete acc[champ]; Object.defineProperty(acc, champ, { enumerable: true, get() { return champ === 'liaisons' ? bonnes : 'x'; } });
    refuse(() => entreesDeProduction('e1', [acc]), /accesseur/);
  }
  for (const [champ, v] of [['operation', ''], ['operation', 3]]) refuse(() => entreesDeProduction('e1', [L('e1', bonnes, { [champ]: v })]));
});
test('B6. LES AUTRES lignes ne sont lues que par leur id : une ligne voisine sans operation, sans liaisons, à liaisons invalides, ou avec un resultat illisible ne gêne pas', () => {
  const voisine = { id: 'e2', liaisons: 'n\'importe quoi' }; Object.defineProperty(voisine, 'resultat', { enumerable: true, get() { throw new Error('lu'); } });
  assert.deepEqual(entreesDeProduction('e1', [voisine, L('e1', [{ entree: 'a', donnee: 'm1' }])]), [{ entree: 'a', donnee: 'm1' }]);
});
test('B7. ni ordre des lignes, ni horodatage : mélange et horodatages absents, identiques ou contradictoires donnent le même résultat', () => {
  const cible = L('e5', [{ entree: 'a', donnee: 'm1' }, { entree: 'b', donnees: ['x', 'y'] }]);
  const autres = ['e1', 'e2', 'e3', 'e4'].map((id) => L(id, [{ entree: 'a', donnee: 'm1' }]));
  const attendu = entreesDeProduction('e5', [...autres, cible]);
  for (const ordre of [[cible, ...autres], [...autres].reverse().concat([cible]), [autres[2], cible, autres[0], autres[3], autres[1]]]) assert.deepEqual(entreesDeProduction('e5', ordre), attendu);
  assert.deepEqual(entreesDeProduction('e5', [...autres, { ...cible, horodatage: '1999-01-01T00:00:00.000Z' }]), attendu);
  assert.deepEqual(entreesDeProduction('e5', [...autres.map((l, i) => ({ ...l, horodatage: i })), { ...cible, horodatage: 'pas une date' }]), attendu);
});

// ============================================================================ C. VALIDATION DES LIAISONS (invariants de l'écriture actuelle)
test('C1. liaisons invalides refusées : non tableau, vide, creux, accesseur, entrée non objet / tableau, clé étrangère, deux variantes, aucune variante, clé symbole', () => {
  const ok = { entree: 'a', donnee: 'm1' };
  const creux = [ok]; creux.length = 2;
  const acc = [ok]; Object.defineProperty(acc, 1, { enumerable: true, get() { return { entree: 'b', donnee: 'm2' }; } });
  const symb = { entree: 'a', donnee: 'm1' }; symb[Symbol('s')] = 1;
  const cas = { nonTableau: 'x', objet: {}, nul: null, vide: [], creux, acc, nonObjet: ['x'], tableau: [[]], nul2: [null], etrangere: [{ ...ok, extra: 1 }], deuxVariantes: [{ entree: 'a', donnee: 'm1', donnees: ['m1'] }], aucune: [{ entree: 'a' }], sansEntree: [{ donnee: 'm1' }], symbole: [symb] };
  for (const [nom, liaisons] of Object.entries(cas)) refuse(() => entreesDeProduction('e1', [L('e1', liaisons)]), undefined, nom);
});
test('C2. valeurs invalides refusées : entree / donnee / identité de collective vides ou non chaînes ; collective vide, non tableau, creuse, avec accesseur', () => {
  const colCreuse = ['x', 'y']; colCreuse.length = 3;
  const colAcc = ['x']; Object.defineProperty(colAcc, 1, { enumerable: true, get() { return 'y'; } });
  const cas = [
    [{ entree: '', donnee: 'm1' }], [{ entree: 3, donnee: 'm1' }], [{ entree: 'a', donnee: '' }], [{ entree: 'a', donnee: 3 }], [{ entree: 'a', donnee: null }],
    [{ entree: 'a', donnees: [] }], [{ entree: 'a', donnees: 'x' }], [{ entree: 'a', donnees: ['x', ''] }], [{ entree: 'a', donnees: ['x', 3] }], [{ entree: 'a', donnees: colCreuse }], [{ entree: 'a', donnees: colAcc }],
  ];
  for (const liaisons of cas) refuse(() => entreesDeProduction('e1', [L('e1', liaisons)]));
  const accEntree = { donnee: 'm1' }; Object.defineProperty(accEntree, 'entree', { enumerable: true, get() { return 'a'; } });
  refuse(() => entreesDeProduction('e1', [L('e1', [accEntree])]), /accesseur/);
});
test('C3. invariants de l\'écriture : doublon dans une collective, collective non triée, liaisons non triées par entree, entree dupliquée : TypeError', () => {
  refuse(() => entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnees: ['x', 'x'] }])]), /strictement triée/);
  refuse(() => entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnees: ['y', 'x'] }])]), /strictement triée/);
  refuse(() => entreesDeProduction('e1', [L('e1', [{ entree: 'b', donnee: 'm1' }, { entree: 'a', donnee: 'm1' }])]), /strictement triée/);
  refuse(() => entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnee: 'm1' }, { entree: 'a', donnee: 'm2' }])]), /strictement triée/);
  refuse(() => entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnee: 'm1' }, { entree: 'a', donnees: ['m2'] }])]), /strictement triée/);
});
test('C4. l\'ordre est celui des UNITÉS DE CODE (invariant de l\'écriture), non un ordre lexical local : « Z » < « a » < « é »', () => {
  const brut = [{ entree: 'Z', donnee: 'm1' }, { entree: 'a', donnees: ['B', 'a', 'é'] }, { entree: 'é', donnee: 'm1' }];
  assert.deepEqual(entreesDeProduction('e1', [L('e1', brut)]), brut);
  refuse(() => entreesDeProduction('e1', [L('e1', [{ entree: 'a', donnee: 'm1' }, { entree: 'Z', donnee: 'm1' }])]));
});
test('C5. aucun trim ni normalisation : les identités sont rendues telles quelles', () => {
  const brut = [{ entree: ' a ', donnee: ' m1 ' }, { entree: 'b', donnees: [' x', 'y '] }];
  assert.deepEqual(entreesDeProduction('e1', [L('e1', brut)]), brut);
});

// ============================================================================ D. COPIE ET IMMUTABILITÉ
test('D1. ligne source profondément gelée acceptée ; sortie modifiable sans toucher la ligne ; modifier donnees dans la sortie ne touche pas la collective persistée', () => {
  const source = gelProfond(L('e1', [{ entree: 'a', donnee: 'm1' }, { entree: 'b', donnees: ['x', 'y'] }]));
  const avant = JSON.stringify(source);
  const r = entreesDeProduction('e1', gelProfond([source]));
  assert.equal(Object.isFrozen(r), false); assert.equal(Object.isFrozen(r[1]), false); assert.equal(Object.isFrozen(r[1].donnees), false);
  r[1].donnees.push('z'); r[1].donnees[0] = 'ZZ'; r[0].donnee = 'autre'; r.push({ entree: 'c', donnee: 'm' }); r[0].extra = 1; r.length = 1;
  assert.equal(JSON.stringify(source), avant);
});
test('D2. aucun objet ni tableau partagé avec la ligne source ; deux appels : objets distincts, profondément égaux', () => {
  const source = L('e1', [{ entree: 'a', donnee: 'm1' }, { entree: 'b', donnees: ['x', 'y'] }]);
  const r1 = entreesDeProduction('e1', [source]); const r2 = entreesDeProduction('e1', [source]);
  assert.notEqual(r1, source.liaisons); assert.notEqual(r1, r2);
  for (let i = 0; i < r1.length; i += 1) { assert.notEqual(r1[i], source.liaisons[i]); assert.notEqual(r1[i], r2[i]); }
  assert.notEqual(r1[1].donnees, source.liaisons[1].donnees); assert.notEqual(r1[1].donnees, r2[1].donnees);
  assert.deepEqual(r1, r2); assert.deepEqual(r1, source.liaisons);
  r1[1].donnees.push('z');
  assert.deepEqual(entreesDeProduction('e1', [source])[1].donnees, ['x', 'y']);
});
test('D3. aucune mutation des lignes ni de la table, déterministe', () => {
  const table = [L('e1', [{ entree: 'a', donnee: 'm1' }]), L('e2', [{ entree: 'b', donnees: ['x'] }])];
  const avant = JSON.stringify(table);
  const a = entreesDeProduction('e2', table); const b = entreesDeProduction('e2', table);
  assert.deepEqual(a, b); assert.equal(JSON.stringify(table), avant);
});

// ============================================================================ E. MESSAGE ET SOUS-DONNÉE
test('E1. MESSAGE : refusé (« aucune exécution correspondante ») avec seulement lignesExecutions ; aucune lecture de valeursDonnees ; aucun cas spécial', async () => {
  const c = await chaine();
  const m1 = c.l.valeurs[0].id;
  refuse(() => entreesDeProduction(m1, c.l.executions), /aucune exécution correspondante/);
  assert.equal(entreesDeProduction.length, 2, 'la primitive ne reçoit pas de valeurs de données');
  for (const v of c.l.valeurs) refuse(() => entreesDeProduction(v.id, c.l.executions), /aucune exécution correspondante/);
  assert.equal(/valeursDonnees|\.valeur\b|'valeur'/.test(CODE), false, 'le code ne lit pas de valeur de donnée');
});
test('E2. SOUS-DONNÉE α2 : refusée, y compris pour les trois sous-données de Q ; pas de remontée au parent, pas d\'entrées héritées', async () => {
  const c = await chaine();
  const sous = c.ligne('Q').sousDonnees;
  assert.equal(sous.length, 3);
  for (const s of sous) {
    refuse(() => entreesDeProduction(s.id, c.l.executions), /sous-donnée/);
    let rendu = null;
    try { rendu = entreesDeProduction(s.id, c.l.executions); } catch { /* attendu */ }
    assert.equal(rendu, null);
  }
  assert.notDeepEqual(entreesDeProduction(c.id('Q'), c.l.executions), []);
});
test('E3. le refus d\'une sous-donnée ne dépend pas de la lecture tolérante : sousDonnees illisibles ailleurs, la table reste utilisable et le refus reste un TypeError', () => {
  const piege = { id: 'e2', liaisons: [{ entree: 'a', donnee: 'm1' }] }; Object.defineProperty(piege, 'sousDonnees', { enumerable: true, get() { throw new Error('lu'); } });
  refuse(() => entreesDeProduction('sous-x', [piege, L('e1', [{ entree: 'a', donnee: 'm1' }])]), /aucune exécution correspondante/);
  assert.deepEqual(entreesDeProduction('e1', [piege, L('e1', [{ entree: 'a', donnee: 'm1' }])]), [{ entree: 'a', donnee: 'm1' }]);
});

// ============================================================================ F. FORME GÉNÉRALE
test('F1. la sortie est conforme à « collection de { entree: chaine, donnee: chaine peutManquer, donnees: collection de chaine peutManquer } », forme exprimable par le langage ; elle n\'est PAS devenue une donnée du moteur', async () => {
  assert.doesNotThrow(() => validerDescripteurOperation({ nom: 'x', entrees: { a: { forme: 'scalaire', genre: 'chaine' } }, sortie: FORME_LIAISONS }));
  const c = await chaine();
  for (const e of c.l.executions) assert.doesNotThrow(() => sousValeurConforme(entreesDeProduction(e.id, c.l.executions), FORME_LIAISONS, 'liaisons'), e.operation);
  assert.equal(C16.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(C16.some((d) => /entrees|liaisons|provenance/i.test(d.nom)), false);
});

// ============================================================================ G. CAS R, COMPOSITION, ARBRE
test('G1. CAS R : exactement elements → P_Y et motifs → M, dans l\'ordre canonique persisté ; égal à la ligne persistée ; aucune connaissance de M ni de P_Y', async () => {
  const c = await chaine();
  const r = entreesDeProduction(c.id('R'), c.l.executions);
  assert.deepEqual(r, [{ entree: 'elements', donnee: c.id('PY') }, { entree: 'motifs', donnee: c.id('M') }]);
  assert.deepEqual(r, c.ligne('R').liaisons);
  assert.equal(/motifs|elements|rechercherSousSuites|symbolesDeChaine|elementsObservables/.test(CODE), false);
});
test('G2. COMPOSITION : les identités extraites DANS LE TEST se résolvent par resoudreIdentitesDonnees avec leurs formes exactes (M : sortie de projeterContenus ; P_Y : sortie d\'elementsObservables)', async () => {
  const c = await chaine();
  const ids = entreesDeProduction(c.id('R'), c.l.executions).flatMap((x) => (x.donnees === undefined ? [x.donnee] : x.donnees));
  const r = resoudreIdentitesDonnees(ids, c.l.valeurs, c.l.executions, C16);
  const forme = (nom) => C16.find((d) => d.nom === nom).sortie;
  const parId = Object.fromEntries(r.map((e) => [e.donnee.identite, e]));
  assert.deepEqual(parId[c.id('M')].donnee.forme, forme('projeterContenus'));
  assert.deepEqual(parId[c.id('PY')].donnee.forme, forme('elementsObservables'));
  assert.equal(r.length, 2);
});
test('G3. ARBRE COMPLET depuis la seule identité de R, jusqu\'aux messages, par entreesDeProduction + resoudreIdentitesDonnees ; la récursion s\'arrête sur « aucune exécution » et le message est reconnu par l\'accès rendu par resoudreIdentitesDonnees', async () => {
  const c = await chaine();
  const feuilles = [];
  function arbre(id) {
    const [element] = resoudreIdentitesDonnees([id], c.l.valeurs, c.l.executions, C16);
    let liaisons;
    try { liaisons = entreesDeProduction(id, c.l.executions); } catch (e) {
      assert.match(e.message, /aucune exécution correspondante/);
      assert.deepEqual(element.acces, ACCES_VALEUR_DONNEE, 'la feuille est un message, reconnu par son accès');
      feuilles.push(id);
      return { message: id };
    }
    return { production: id, entrees: liaisons.map((x) => (x.donnees === undefined ? { entree: x.entree, de: [arbre(x.donnee)] } : { entree: x.entree, collectif: true, de: x.donnees.map(arbre) })) };
  }
  const t = arbre(c.id('R'));
  const m = (k) => c.E[k].execution.liaisons[0].donnee;
  const msg = (k) => ({ message: m(k) });
  const A = { production: c.id('A'), entrees: [{ entree: 'chaine', de: [msg('A')] }] };
  const B = { production: c.id('B'), entrees: [{ entree: 'chaine', de: [msg('B')] }] };
  const AY = { production: c.id('AY'), entrees: [{ entree: 'chaine', de: [msg('AY')] }] };
  const P = { production: c.id('P'), entrees: [{ entree: 'elements', collectif: true, de: [A, B] }] };
  const attendu = {
    production: c.id('R'),
    entrees: [
      { entree: 'elements', de: [{ production: c.id('PY'), entrees: [{ entree: 'elements', collectif: true, de: [A, B, AY] }] }] },
      { entree: 'motifs', de: [{ production: c.id('M'), entrees: [{ entree: 'elements', de: [{ production: c.id('S'), entrees: [{ entree: 'elements', de: [P] }] }] }] }] },
    ],
  };
  assert.deepEqual(t, attendu);
  assert.equal(new Set(feuilles).size, 3, 'trois messages distincts atteints');
});
test('G4. l\'arbre reste identique avec la table d\'exécutions dans l\'ordre inverse', async () => {
  const c = await chaine();
  const profil = (id, lignes) => { try { return entreesDeProduction(id, lignes).map((x) => [x.entree, (x.donnees || [x.donnee]).map((d) => profil(d, lignes))]); } catch { return 'feuille'; } };
  assert.deepEqual(profil(c.id('R'), [...c.l.executions].reverse()), profil(c.id('R'), c.l.executions));
});

// ============================================================================ H. COLLECTIVES
test('H1. P et P_Y : UNE liaison collective, toutes les identités, sans doublon, jamais éclatée ; P_Y absorbe A, B et A_Y', async () => {
  const c = await chaine();
  const p = entreesDeProduction(c.id('P'), c.l.executions); const py = entreesDeProduction(c.id('PY'), c.l.executions);
  assert.deepEqual(p, [{ entree: 'elements', donnees: [c.id('A'), c.id('B')].sort() }]);
  assert.deepEqual(py, [{ entree: 'elements', donnees: [c.id('A'), c.id('B'), c.id('AY')].sort() }]);
  for (const r of [p, py]) { assert.equal(r.length, 1); assert.equal(new Set(r[0].donnees).size, r[0].donnees.length); assert.equal('donnee' in r[0], false); }
});
test('H2. une donnée qui remplit deux entrées ORDINAIRES est conservée deux fois (Q : a = H, b = H) ; ce n\'est pas un doublon', async () => {
  const c = await chaine();
  assert.deepEqual(entreesDeProduction(c.id('Q'), c.l.executions), [{ entree: 'a', donnee: c.id('H') }, { entree: 'b', donnee: c.id('H') }]);
});

// ============================================================================ I. α2 COMME ENTRÉE D'UNE AUTRE PRODUCTION
test('I1. N = normaliserCouverture(chemins = sous-donnée « communs » de Q) : entreesDeProduction(N) rend chemins → idSousDonnee ; entreesDeProduction(idSousDonnee) reste refusée (asymétrie voulue)', async () => {
  const c = await chaine();
  assert.deepEqual(entreesDeProduction(c.id('N'), c.l.executions), [{ entree: 'chemins', donnee: c.sousCommuns }]);
  refuse(() => entreesDeProduction(c.sousCommuns, c.l.executions), /sous-donnée/);
  const [element] = resoudreIdentitesDonnees([c.sousCommuns], c.l.valeurs, c.l.executions, C16);
  assert.deepEqual(element.donnee.forme, C16.find((d) => d.nom === 'partagerCouvertures').sortie.champs.communs, 'la sous-donnée se résout, avec sa forme exacte');
  assert.equal(indexSousDonnees(c.l.executions).get(c.sousCommuns).execution.id, c.id('Q'), 'la relation vers le parent existe ailleurs (inchangée), pas ici');
  assert.equal(entreesDeProduction(c.id('N'), c.l.executions).some((x) => x.donnee === c.id('Q')), false, 'N ne nomme pas Q');
});

// ============================================================================ J. DORMANCE
test('J1. DORMANCE : aucun fichier de app/ ne nomme la primitive en dehors d\'elle-même ; aucune importation ; aucun flux vivant ne l\'appelle', () => {
  const sources = [];
  const parcourir = (dossier) => { for (const nom of readdirSync(dossier)) { const chemin = join(dossier, nom); if (statSync(chemin).isDirectory()) parcourir(chemin); else if (/\.(m?js|html)$/.test(nom)) sources.push(chemin); } };
  parcourir(join(RACINE, 'app'));
  const nommants = sources.filter((f) => /entrees-production|entreesDeProduction/.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f).split('\\').join('/'));
  // MISE À JOUR DÉLIBÉRÉE v0.63.55 : resoudre-identites.js (primitive dormante) l'importe pour la valeur de la donnée adjacente « entrées d'une
  // production ». Aucun flux vivant ne l'appelle.
  assert.deepEqual(nommants, ['app/langage/entrees-production.js', 'app/langage/episodes-de-transformation.js', 'app/langage/observation-possibilites.js', 'app/langage/resoudre-identites.js', 'app/langage/retours-de-valeur.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.69 : + episodes-de-transformation.js (vue dormante, seule source de vérité du graphe) ; retours-de-valeur.js ne la cite plus qu'en commentaire. MISE À JOUR DÉLIBÉRÉE v0.63.68 : retours-de-valeur.js (vue dormante) lit les liaisons persistées par cette primitive // MISE À JOUR DÉLIBÉRÉE v0.63.59 : observation-possibilites.js l'appelle pour exposer entrées(P) dans les nouveaux snapshots
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = lu(autre); } catch { continue; } assert.equal(/entrees-production|entreesDeProduction/.test(s), false, autre); }
  assert.equal(/\bimport\b/.test(CODE), false, 'aucune importation');
});
test('J2. PURETÉ : ni horloge, ni hasard, ni identité générée, ni magasin, ni écriture, ni asynchronisme, ni état global', () => {
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'crypto', 'setTimeout', 'require(']) assert.equal(CODE.includes(interdit), false, `« ${interdit} » ne doit pas figurer dans le code`);
  assert.equal(/\blet\b[^;]*=\s*(\[\]|\{\})/.test(CODE.split('export function')[0]), false, 'aucun état de module');
});
test('J3. AUCUN AUTRE EFFET : pas de table, pas de migration, VERSION_BASE, schéma et catalogue inchangés ; les observations gardent leurs sept clés ; resoudreContexteObservation et observerPossibilites ne citent pas la primitive', async () => {
  assert.equal(VERSION_BASE, 21); assert.equal(SCHEMA_SAUVEGARDE, 11); assert.equal(TABLES.length, 24); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables)
  const c = await chaine();
  for (const o of c.l.observations) assert.deepEqual(Object.keys(o), ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'empreintesCategoriesDonnees', 'empreintesContratsRelationnels', 'possibilites']); // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
  for (const f of ['contexte-observation.js', 'connaissances.js', 'execution-sollicitee.js', 'pont.js', 'applications-sollicitables.js', 'groupes-candidats.js']) assert.equal(/entrees-production|entreesDeProduction/.test(lu('app', 'langage', f)), false, f);
});
