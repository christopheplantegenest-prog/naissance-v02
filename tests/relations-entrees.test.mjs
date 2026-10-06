// === DEBUT_TEST_RELATIONS_ENTREES ===
// v0.63.61 — RELATIONS MÉCANIQUES ENTRE ENTRÉES (décision ChatGPT, 06/10/2026). Deux relations seulement (couvertureDansChemins, plagesDansSequence), déclarées par la
// clé facultative `relations` des descripteurs, implémentées par un registre qui RÉUTILISE les fonctions des corps, jugées AVANT désignation par applicationsSollicitables
// (qui reçoit l'univers). Les 16 empreintes historiques restent celles de v0.63.60 ; l'empreinte relationnelle est séparée et DORMANTE.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { SCHEMA_RELATIONS } from '../app/langage/relations-schema.js';
import { REGISTRE_RELATIONS, relationsSatisfaites } from '../app/langage/relations-entrees.js';
import { canoniqueRelations, empreinteRelations } from '../app/langage/empreinte-relations.js';
import { empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { validerDescripteurOperation } from '../app/langage/formes-operation.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { invoquerOperation } from '../app/langage/invocation-operations.js';
import { applicationsSollicitables, classerCombinaisons } from '../app/langage/applications-sollicitables.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { resoudreValeursApplication } from '../app/langage/valeurs-application.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiers = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiers(p) : [p]; });
const PRODUCTION = fichiers(join(RACINE, 'app')).filter((p) => /\.(js|mjs|html)$/.test(p));
const rel = (p) => relative(RACINE, p).split('\\').join('/');
const D = DESCRIPTIONS_OPERATIONS;
const SANS_RELATIONS = D.map(({ relations, ...d }) => d);
const par = (nom) => D.find((d) => d.nom === nom);

// ------------------------------------------------------------------------------------------------------------------------ A. DÉCLARATION
test('A1. exactement trois opérations déclarent des relations ; les treize autres n\'ont AUCUNE clé relations', () => {
  assert.deepEqual(D.filter((d) => Object.hasOwn(d, 'relations')).map((d) => d.nom), ['couvrirSequence', 'resoudreCouverture', 'resoudreElements']);
  assert.equal(D.filter((d) => !Object.hasOwn(d, 'relations')).length, 13);
  assert.deepEqual(par('resoudreElements').relations, [{ relation: 'couvertureDansChemins', couverture: 'couverture', collection: 'elements' }]);
  assert.deepEqual(par('resoudreCouverture').relations, [{ relation: 'couvertureDansChemins', couverture: 'couverture', collection: 'univers' }]);
  assert.deepEqual(par('couvrirSequence').relations, [{ relation: 'plagesDansSequence', plages: 'plages', sequence: 'elements' }]);
  for (const d of D) assert.doesNotThrow(() => validerDescripteurOperation(d), d.nom);
});
test('A2. le schéma ne connaît que DEUX relations, avec leurs rôles ; le registre implémente exactement les mêmes', () => {
  assert.deepEqual(Object.keys(SCHEMA_RELATIONS).sort(), ['couvertureDansChemins', 'plagesDansSequence']);
  assert.deepEqual([...SCHEMA_RELATIONS.couvertureDansChemins], ['couverture', 'collection']);
  assert.deepEqual([...SCHEMA_RELATIONS.plagesDansSequence], ['plages', 'sequence']);
  assert.deepEqual(Object.keys(REGISTRE_RELATIONS).sort(), Object.keys(SCHEMA_RELATIONS).sort());
  assert.equal(Object.isFrozen(SCHEMA_RELATIONS) && Object.isFrozen(REGISTRE_RELATIONS), true);
});
const base = () => ({ nom: 'x', entrees: { a: { forme: 'quelconque' }, b: { forme: 'quelconque' }, c: { forme: 'quelconque' } }, sortie: { forme: 'quelconque' } });
const avec = (relations) => ({ ...base(), relations });
const BONNE = { relation: 'couvertureDansChemins', couverture: 'a', collection: 'b' };
test('A3. validation stricte : relations absente = comportement actuel ; présente = tableau dense non vide de déclarations closes', () => {
  assert.deepEqual(validerDescripteurOperation(base()), { nom: 'x', entrees: validerDescripteurOperation(base()).entrees, sortie: validerDescripteurOperation(base()).sortie });
  assert.equal(Object.hasOwn(validerDescripteurOperation(base()), 'relations'), false);
  assert.deepEqual(validerDescripteurOperation(avec([BONNE])).relations, [BONNE]);
  const refusees = [
    ['non tableau', { ...BONNE }], ['tableau vide', []], ['trou', [, BONNE]], ['null', [null]], ['tableau en élément', [[BONNE]]], ['nom inconnu', [{ ...BONNE, relation: 'inconnue' }]],
    ['clé en trop', [{ ...BONNE, extra: 'a' }]], ['rôle manquant', [{ relation: 'couvertureDansChemins', couverture: 'a' }]], ['mauvais rôle', [{ relation: 'couvertureDansChemins', couverture: 'a', sequence: 'b' }]],
    ['entrée inexistante', [{ ...BONNE, collection: 'zzz' }]], ['même entrée deux rôles', [{ ...BONNE, collection: 'a' }]], ['entrée non chaîne', [{ ...BONNE, collection: 3 }]],
    ['relation dupliquée', [BONNE, { ...BONNE }]], ['entrée héritée', [{ ...BONNE, collection: 'toString' }]],
  ];
  for (const [nom, rels] of refusees) assert.throws(() => validerDescripteurOperation(avec(rels)), TypeError, nom);
  const accesseur = { relation: 'couvertureDansChemins', couverture: 'a' }; Object.defineProperty(accesseur, 'collection', { get: () => 'b', enumerable: true });
  assert.throws(() => validerDescripteurOperation(avec([accesseur])), TypeError, 'propriété accesseur');
  const tableauAccesseur = [BONNE]; Object.defineProperty(tableauAccesseur, 0, { get: () => BONNE, enumerable: true });
  assert.throws(() => validerDescripteurOperation(avec(tableauAccesseur)), TypeError, 'élément accesseur');
  assert.throws(() => validerDescripteurOperation(avec([Object.create({ relation: 'couvertureDansChemins', couverture: 'a', collection: 'b' })])), TypeError, 'prototype');
  assert.doesNotThrow(() => validerDescripteurOperation(avec([BONNE, { relation: 'plagesDansSequence', plages: 'a', sequence: 'c' }])), 'deux relations distinctes');
});

// ------------------------------------------------------------------------------------------------------------------------ B. REGISTRE ET SOURCE UNIQUE
test('B1. couvertureDansChemins : sémantique EXACTE de resolution-couverture (égalité segment par segment, types, doublons refusés, couverture vide valide, aucune coercion)', () => {
  const el = (chemin) => ({ chemin, contenu: ['c'] });
  const R = REGISTRE_RELATIONS.couvertureDansChemins;
  const collection = [el(['a']), el(['a', 'b']), el([0])];
  assert.equal(R({ couverture: [['a'], ['a', 'b']], collection }), true);
  assert.equal(R({ couverture: [], collection }), true, 'couverture vide valide');
  assert.equal(R({ couverture: [['z']], collection }), false, 'chemin absent');
  assert.equal(R({ couverture: [['a'], ['a']], collection }), false, 'doublon refusé');
  assert.equal(R({ couverture: [['0']], collection }), false, 'aucune coercion : \'0\' n\'est pas 0');
  assert.equal(R({ couverture: [[0]], collection }), true, 'entier strict');
  assert.equal(R({ couverture: 'a', collection }), false);
});
test('B2. plagesDansSequence : debut + longueur <= n, validations de couvrirSequence ; vrai ssi couvrirSequence accepte', () => {
  const R = REGISTRE_RELATIONS.plagesDansSequence;
  const sequence = ['a', 'b', 'c'];
  for (const [plages, attendu] of [[[{ debut: 0, longueur: 3, etiquette: null }], true], [[{ debut: 1, longueur: 2, etiquette: null }], true], [[{ debut: 2, longueur: 2, etiquette: null }], false], [[], true], [[{ debut: -1, longueur: 1, etiquette: null }], false], [[{ debut: 0.5, longueur: 1, etiquette: null }], false], [[{ debut: 3, longueur: 0, etiquette: null }], false]]) {
    let invocation = true; try { invoquerOperation(TABLE_OPERATIONS, 'couvrirSequence', { elements: sequence, plages }); } catch { invocation = false; }
    assert.equal(R({ sequence, plages }), invocation, JSON.stringify(plages));
    assert.equal(R({ sequence, plages }), attendu, JSON.stringify(plages));
  }
});
test('B3. SOURCE UNIQUE : le registre appelle resoudreCouverture et plagesDansSequence ; les corps appellent les MÊMES fonctions (aucune règle recopiée)', () => {
  const registre = sansCommentaires(lu('app', 'langage', 'relations-entrees.js'));
  assert.match(registre, /import \{ resoudreCouverture \} from '\.\/resolution-couverture\.js'/);
  assert.match(registre, /import \{ plagesDansSequence \} from '\.\/sequence-plages\.js'/);
  assert.match(registre, /resoudreCouverture\(collection, couverture\)/);
  const plages = sansCommentaires(lu('app', 'langage', 'sequence-plages.js'));
  assert.equal((plages.match(/lirePlages\(/g) || []).length >= 3, true, 'définition + corps de couvrirSequence + prédicat');
  assert.match(plages.slice(plages.indexOf('export function couvrirSequence')), /lirePlages\(plages, /);
  assert.match(plages.slice(plages.indexOf('export function plagesDansSequence')), /lirePlages\(plages, /);
  assert.match(sansCommentaires(lu('app', 'langage', 'resoudre-elements.js')), /import \{ resoudreCouverture as resoudreChemins \} from '\.\/resolution-couverture\.js'[\s\S]*resoudreChemins\(/);
  assert.equal(/\bnumber\b|typeof/.test(registre.replace(/typeof valeursParEntree/g, '')), false, 'le registre ne revérifie aucun type');
});
test('B4. relationsSatisfaites : toutes les relations déclarées doivent être satisfaites ; entrées/relations mal formées refusées', () => {
  const rels = par('resoudreElements').relations;
  const elements = [{ chemin: ['a'], contenu: ['x'] }];
  assert.equal(relationsSatisfaites(rels, { couverture: [['a']], elements }), true);
  assert.equal(relationsSatisfaites(rels, { couverture: [['b']], elements }), false);
  assert.throws(() => relationsSatisfaites(rels, { couverture: [['a']] }), TypeError, 'valeur d\'entrée absente');
  assert.throws(() => relationsSatisfaites('x', {}), TypeError);
  assert.throws(() => relationsSatisfaites([{ relation: 'inconnue' }], {}), TypeError);
});

// ------------------------------------------------------------------------------------------------------------------------ C. EMPREINTES HISTORIQUES INCHANGÉES
const REFERENCE_V06360 = {
  couvrirSequence: '0e66042b7d7d71233ff57bf36b609ae53c63880bb478417c4ff430af48b6c687',
  decrireStructureIdentifiee: '2e60f44f5b129f5303a7e610038c1cf11315e49c13c4e73d84e5904eb3d22999',
  decrireValeursObservees: 'a10cba066346534fc0a752f994663f30bdd96306d0af68adaebfccd4d535db02',
  elementsObservables: 'a6ebe237069b6eb39e8397e59ea0d95c4eca597db197f423a6d3b58892fe940e',
  memesCouvertures: '81072be79b40f09d7e1f2508f0ecc4ab2899c547471196f0be47cc2aa4b1884b',
  normaliserCouverture: '07833da5d47cd19b25a11f901aac6921c830e02538a92cc1b44fe20a6af5a456',
  parcourirStructure: 'ee400d727aa46b962a291d5de27ee1476044a5d2aebae7b549ccc1a5c271e5c1',
  partagerCouvertures: 'b458c7a0fc4e79077f6525a92b2ac489d475d21d2fb9e1c9bad01be9fbee45b7',
  produireConstatsStructurels: '368abb80081b3f9393422ce02a32a9696922a0be426254e155794a710e3902d8',
  produireSuitesFermees: 'cfab56c858b9cc33f57cda982729fb2b199103cf275d746091038e99d568dbd5',
  projeterChemins: '0db3c898e57393bb09b92177f78364a03a863d68829d0748207285425924432a',
  projeterContenus: '90cbd8358b0ef4ab2b6fbc4842c1d03372e9f823aa1f33e2f9052e1b5c7bae8a',
  rechercherSousSuites: 'e04ea94a8d225dbf898c2d7cf5c0bde66336da7a3e25e23d26615f9152a53f5b',
  resoudreCouverture: '3d4c7479b0dad14f0f95acd0744952dcb06fa80a9151d06cfb9e585c388443cb',
  resoudreElements: 'c13f633d9592d874695ffaf51c0ceb862baf426c5d78d4fde28d274c9ed40499',
  symbolesDeChaine: '7037e1ad0312f5d73ed2ea66fdc37116a71219916437a52502b11fa8c025ef38',
};
test('C1. NON-RÉGRESSION : les 16 empreintes de contrat sont EXACTEMENT celles de v0.63.60 (valeurs de référence mesurées sur v0.63.60), et identiques avec ou sans la clé relations', () => {
  const mesure = Object.fromEntries(empreintesDesContrats(D).map((e) => [e.operation, e.empreinte]));
  assert.deepEqual(mesure, REFERENCE_V06360);
  assert.equal(Object.keys(mesure).length, 16);
  assert.deepEqual(empreintesDesContrats(SANS_RELATIONS), empreintesDesContrats(D));
});

// ------------------------------------------------------------------------------------------------------------------------ D. EMPREINTE RELATIONNELLE DORMANTE
test('D1. empreinte relationnelle : déterministe, ne couvre QUE les relations ; ajout, suppression, nom, rôle, entrée la changent ; ordre des opérations/relations sans effet', () => {
  const e0 = empreinteRelations(D);
  assert.match(e0, /^[0-9a-f]{64}$/);
  assert.equal(empreinteRelations(D), e0);
  assert.equal(empreinteRelations([...D].reverse()), e0, 'ordre des opérations sans effet');
  const modifier = (f) => D.map((d) => { const c = structuredClone(d); f(c); return c; });
  const sansRel = (nom) => modifier((c) => { if (c.nom === nom) delete c.relations; });
  const diff = new Set([e0]);
  for (const v of [
    sansRel('couvrirSequence'), sansRel('resoudreElements'), sansRel('resoudreCouverture'),
    modifier((c) => { if (c.nom === 'resoudreElements') c.relations[0].relation = 'plagesDansSequence', delete c.relations[0].couverture, delete c.relations[0].collection, c.relations[0].plages = 'couverture', c.relations[0].sequence = 'elements'; }),
    modifier((c) => { if (c.nom === 'resoudreElements') { c.relations[0].couverture = 'elements'; c.relations[0].collection = 'couverture'; } }),
    modifier((c) => { if (c.nom === 'couvrirSequence') c.relations.push({ relation: 'plagesDansSequence', plages: 'elements', sequence: 'plages' }); }),
    modifier((c) => { if (c.nom === 'symbolesDeChaine') c.relations = [{ relation: 'couvertureDansChemins', couverture: 'chaine', collection: 'chaine' }]; }),
  ]) {
    try { const e = empreinteRelations(v); assert.equal(diff.has(e), false); diff.add(e); } catch (erreur) { if (!(erreur instanceof TypeError)) throw erreur; }
  }
  assert.equal(diff.size >= 6, true);
  assert.equal(empreinteRelations(SANS_RELATIONS), empreinteRelations(SANS_RELATIONS.map((d) => ({ ...d }))));
  assert.equal(canoniqueRelations(SANS_RELATIONS), '[]');
  const changeLeNom = modifier((c) => { if (c.nom === 'couvrirSequence') c.relations[0].plages = 'elements'; c.nom === 'couvrirSequence' && (c.relations[0].sequence = 'plages'); });
  assert.notEqual(empreinteRelations(changeLeNom), e0, 'échange des entrées associées');
  assert.equal(empreinteRelations(modifier((c) => { c.entrees = { ...c.entrees }; })), e0, 'les entrées/sorties ne comptent pas');
});
test('D2. DORMANCE : aucun fichier de production n\'importe ni ne nomme l\'empreinte relationnelle ; rien n\'est persisté (format 8 clés inchangé)', () => {
  const nommants = PRODUCTION.filter((p) => /empreinte-relations|empreinteRelations|canoniqueRelations/.test(readFileSync(p, 'utf8'))).map(rel);
  assert.deepEqual(nommants, ['app/langage/empreinte-relations.js']);
  const persistance = ['connaissances.js', 'observation-possibilites.js', 'contexte-observation.js'].map((f) => lu('app', 'langage', f)).join('\n');
  assert.equal(/relations(?!Nommees)/i.test(sansCommentaires(persistance)), false, 'ni persistée ni vérifiée dans les observations');
});

// ------------------------------------------------------------------------------------------------------------------------ E. CLASSIFICATION
const el = (chemin) => ({ chemin, contenu: ['c'] });
const univ = (id, valeur) => ({ donnee: { identite: id, forme: { forme: 'quelconque' } }, porteur: { id, v: valeur }, acces: { champ: 'v' } });
const atome = (donnee, operation, entree) => ({ donnee, operation, entree });
const observation = (possibilites) => ({ id: 'o', possibilites });
const SEQ = ['a', 'b', 'c'];
test('E1. couvrirSequence synthétique : même prédicat avant désignation et dans l\'invocation ; invalide éliminé, valide conservé ; 0 → rien, 1 → application, >1 → choix', () => {
  const U = [univ('S', SEQ), univ('P1', [{ debut: 0, longueur: 2, etiquette: null }]), univ('P2', [{ debut: 2, longueur: 2, etiquette: null }]), univ('P3', [{ debut: 1, longueur: 2, etiquette: null }])];
  const at = (...ids) => observation([atome('S', 'couvrirSequence', 'elements'), ...ids.map((i) => atome(i, 'couvrirSequence', 'plages'))]);
  const resultat = (ids) => classerCombinaisons(at(...ids), D, U).find((c) => c.operation === 'couvrirSequence');
  assert.equal(resultat(['P1', 'P2', 'P3']).brutes, 3);
  assert.equal(resultat(['P1', 'P2', 'P3']).valides.length, 2);
  assert.equal(resultat(['P2']).valides.length, 0);
  assert.deepEqual(applicationsSollicitables(at('P2'), D, U), { applications: [], choixAFaire: [] }, 'zéro valide : ni application ni choix');
  const un = applicationsSollicitables(at('P1', 'P2'), D, U);
  assert.deepEqual(un.choixAFaire, []);
  assert.deepEqual(un.applications, [{ operation: 'couvrirSequence', liaisons: [{ entree: 'elements', donnee: 'S' }, { entree: 'plages', donnee: 'P1' }] }]);
  assert.deepEqual(applicationsSollicitables(at('P1', 'P2', 'P3'), D, U), { applications: [], choixAFaire: ['couvrirSequence'] });
  for (const id of ['P1', 'P2', 'P3']) {
    const { valeurs } = resoudreValeursApplication({ operation: 'couvrirSequence', liaisons: [{ entree: 'elements', donnee: 'S' }, { entree: 'plages', donnee: id }] }, U);
    let invocation = true; try { invoquerOperation(TABLE_OPERATIONS, 'couvrirSequence', valeurs); } catch { invocation = false; }
    assert.equal(relationsSatisfaites(par('couvrirSequence').relations, valeurs), invocation, id);
  }
  assert.equal(resultat(['P1', 'P2', 'P3']).valides.every((v) => v.find((l) => l.entree === 'plages').donnee !== 'P2'), true);
});
test('E2. API : l\'univers est requis dès qu\'une opération qui déclare des relations a un groupe complet ; sans relation déclarée il n\'est pas consulté ; sans univers valide = TypeError', () => {
  const obs = observation([atome('S', 'couvrirSequence', 'elements'), atome('P', 'couvrirSequence', 'plages')]);
  assert.throws(() => applicationsSollicitables(obs, D), TypeError);
  assert.throws(() => applicationsSollicitables(obs, D, 'x'), TypeError);
  assert.doesNotThrow(() => applicationsSollicitables(observation([atome('M', 'parcourirStructure', 'valeur')]), D));
  assert.doesNotThrow(() => applicationsSollicitables(obs, SANS_RELATIONS));
  assert.deepEqual(applicationsSollicitables(obs, SANS_RELATIONS).applications.map((a) => a.operation), ['couvrirSequence'], 'sans relation : classification de forme seule (comportement .60)');
});
test('E3. COLLECTIFS : une entrée collective reste UNE liaison { entree, donnees } ; les relations jugent les valeurs effectivement fournies', () => {
  const U = [univ('X1', SEQ), univ('X2', SEQ)];
  const obs = observation([atome('X1', 'elementsObservables', 'elements'), atome('X2', 'elementsObservables', 'elements')]);
  const r = applicationsSollicitables(obs, D, U);
  const liaison = r.applications.find((a) => a.operation === 'elementsObservables');
  if (liaison) assert.deepEqual(liaison.liaisons.map((l) => Object.keys(l)), [['entree', 'donnees']]);
  assert.equal(classerCombinaisons(obs, D, U).filter((c) => c.operation === 'elementsObservables').every((c) => c.brutes === 1), true);
});
test('E4. PROVENANCE : la validité ne dépend que des VALEURS (identités, exécutions productrices, entrées(P) ne sont jamais lues) ; deux porteurs de même valeur sont équivalents', () => {
  const code = ['applications-sollicitables.js', 'relations-entrees.js'].map((f) => sansCommentaires(lu('app', 'langage', f))).join('\n');
  assert.equal(/idDesignation|idExecution|executions|entrees-de-production|ancetre|origine|provenance|lireTout|observationsPossibilites/.test(code), false);
  const mesure = (ids) => { const U = [univ(ids[0], SEQ), univ(ids[1], [{ debut: 0, longueur: 2, etiquette: null }])]; return classerCombinaisons(observation([atome(ids[0], 'couvrirSequence', 'elements'), atome(ids[1], 'couvrirSequence', 'plages')]), D, U).find((c) => c.operation === 'couvrirSequence').valides.length; };
  assert.equal(mesure(['S', 'P']), 1);
  assert.equal(mesure(['execution-77', 'entrees-de-production:zzz']), 1);
});

// ------------------------------------------------------------------------------------------------------------------------ F. FLUX RÉEL
async function vie(messages, { descriptions } = {}) {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`; const tours = [];
  for (const texte of messages) {
    const dependances = descriptions ? { magasin, table: TABLE_OPERATIONS, descriptions } : { magasin, table: TABLE_OPERATIONS };
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), (c) => executerApplicationsDeterminees(c, dependances));
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const S = suivi.joindre(res).sollicitation;
    tours.push({ texte, S, designations: await magasin.lireTout('designations'), executions: await magasin.lireTout('executionsOperations') });
  }
  return tours;
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
let VIE; const vecue = async () => (VIE ??= await vie(SCENARIO));
let VIE60; const vecue60 = async () => (VIE60 ??= await vie(SCENARIO, { descriptions: SANS_RELATIONS }));
const couples = (S, operation, catalogue = D) => {
  const g = groupesDeCandidats(S.observation.possibilites, DESCRIPTIONS_OPERATIONS).find((x) => x.operation === operation);
  if (!g) return [];
  const [a, b] = g.entrees; const sortie = [];
  for (const da of a.donnees) for (const db of b.donnees) sortie.push([{ entree: a.entree, donnee: da }, { entree: b.entree, donnee: db }]);
  return sortie;
};
test('F1. T3 resoudreElements (TEST CENTRAL, déclencheur réel) : 1 couple brut, 0 valide ; aucune application, aucun choix, aucune désignation, aucun echec_invocation', async () => {
  const t3 = (await vecue())[2];
  assert.equal(couples(t3.S, 'resoudreElements').length, 1);
  const c = classerCombinaisons(t3.S.observation, D, t3.S.univers).find((x) => x.operation === 'resoudreElements');
  assert.equal(c.brutes, 1); assert.equal(c.valides.length, 0);
  assert.equal(t3.S.applications.some((a) => a.operation === 'resoudreElements'), false);
  assert.equal(t3.S.choixAFaire.includes('resoudreElements'), false);
  assert.equal(t3.designations.some((d) => d.operation === 'resoudreElements'), false);
  assert.deepEqual(t3.S.automatiques.filter((r) => r.statut !== 'executee'), []);
  assert.equal(t3.S.echecDeclenchement == null, true);
});
test('F2. T3 resoudreCouverture : 2 couples bruts, 1 valide → UNE application déterminée, désignée par le déclencheur (origine mecanique) et exécutée avec succès', async () => {
  const t3 = (await vecue())[2];
  const c = classerCombinaisons(t3.S.observation, D, t3.S.univers).find((x) => x.operation === 'resoudreCouverture');
  assert.equal(c.brutes, 2); assert.equal(c.valides.length, 1);
  assert.equal(t3.S.choixAFaire.includes('resoudreCouverture'), false);
  const r = t3.S.automatiques.filter((x) => x.operation === 'resoudreCouverture');
  assert.equal(r.length, 1); assert.equal(r[0].statut, 'executee'); assert.equal(r[0].designation.origine, 'mecanique');
  assert.equal(t3.executions.some((x) => x.idDesignation === r[0].designation.id), true);
});
test('F3. T4 : resoudreElements 12 bruts → 4 valides, choixAFaire ; resoudreCouverture (monde .60 : 18 → 9), choixAFaire ; couvertures vides valides ; aucun choix résolu', async () => {
  const t60 = (await vecue60())[3];
  const mesure = (S, op) => classerCombinaisons(S.observation, D, S.univers).find((x) => x.operation === op);
  assert.deepEqual([mesure(t60.S, 'resoudreElements').brutes, mesure(t60.S, 'resoudreElements').valides.length], [12, 4]);
  assert.deepEqual([mesure(t60.S, 'resoudreCouverture').brutes, mesure(t60.S, 'resoudreCouverture').valides.length], [18, 9]);
  for (const op of ['resoudreElements', 'resoudreCouverture']) {
    assert.equal(applicationsSollicitables(t60.S.observation, D, t60.S.univers).choixAFaire.includes(op), true, op);
    assert.equal(t60.designations.filter((d) => d.idObservation === t60.S.observation.id).some((d) => d.operation === op), false, `${op} inerte (choix non résolu)`);
  }
  const vides = mesure(t60.S, 'resoudreElements').valides.filter((v) => resoudreValeursApplication({ operation: 'resoudreElements', liaisons: v }, t60.S.univers).valeurs.couverture.length === 0);
  assert.equal(vides.length, 4, 'les couvertures vides restent valides (aucun filtre de pertinence)');
  const t = (await vecue())[3];
  assert.deepEqual([mesure(t.S, 'resoudreElements').brutes, mesure(t.S, 'resoudreElements').valides.length, mesure(t.S, 'resoudreCouverture').brutes, mesure(t.S, 'resoudreCouverture').valides.length], [12, 4, 24, 14], 'monde .61 : T3 a produit une couverture de plus');
});
test('F4. ACCORD RELATION / INVOCATION sur les 195 couples du diagnostic (monde .60 : T3–T7, resoudreElements + resoudreCouverture) : aucune divergence', async () => {
  const tours = await vecue60();
  let total = 0;
  for (const t of tours.slice(2)) {
    for (const operation of ['resoudreElements', 'resoudreCouverture']) {
      for (const liaisons of couples(t.S, operation)) {
        total += 1;
        const { valeurs } = resoudreValeursApplication({ operation, liaisons }, t.S.univers);
        let invocation = true; try { invoquerOperation(TABLE_OPERATIONS, operation, valeurs); } catch { invocation = false; }
        assert.equal(relationsSatisfaites(par(operation).relations, valeurs), invocation, `${operation} ${JSON.stringify(liaisons)}`);
      }
    }
  }
  assert.equal(total, 195);
});
test('F5. DÉCLENCHEUR : il n\'exécute que des applications relationnellement valides et uniques ; plus aucun echec_invocation dans les 7 tours ; choixAFaire ne contient que des combinaisons valides', async () => {
  const tours = await vecue();
  for (const t of tours) {
    assert.deepEqual(t.S.automatiques.filter((r) => r.statut !== 'executee'), [], t.texte);
    const classes = classerCombinaisons(t.S.observation, D, t.S.univers);
    for (const op of t.S.choixAFaire) { const c = classes.find((x) => x.operation === op); assert.equal(c.valides === null ? c.brutes > 1 : c.valides.length > 1, true, op); }
    assert.deepEqual(t.S.automatiques.map((r) => r.operation), applicationsSollicitables(t.S.observation, D, t.S.univers).applications.map((a) => a.operation), 'exactement les applications relationnellement uniques');
  }
});
test('F6. SCÉNARIO 7 TOURS (.61) : mesures par tour, sans clic', async () => {
  const tours = await vecue();
  assert.deepEqual(tours.map((t) => [t.S.choixAFaire.length, t.S.automatiques.length]), [[0, 2], [1, 3], [2, 10], [11, 2], [11, 2], [11, 2], [11, 2]]);
  assert.deepEqual(tours.map((t) => t.executions.length), [2, 5, 15, 17, 19, 21, 23]);
  assert.deepEqual(tours.map((t) => t.designations.length), [2, 5, 15, 17, 19, 21, 23]);
});
test('F7. PAS DE BOUCLE DANS LE TOUR : le déclencheur ne relit aucune observation et ne réclasse rien après ses exécutions (une classification, un lot)', () => {
  const code = sansCommentaires(lu('app', 'langage', 'execution-mecanique.js'));
  assert.equal((code.match(/applicationsSollicitables\(/g) || []).length, 1);
  assert.equal(/while|do \{|observerPossibilites|observationsPossibilites/.test(code), false);
});
// === FIN_TEST_RELATIONS_ENTREES ===
