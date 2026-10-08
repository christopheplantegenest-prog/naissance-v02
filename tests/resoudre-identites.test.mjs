// === DEBUT_TEST_RESOUDRE_IDENTITES ===
// v0.63.48 — RÉSOLUTION HISTORIQUE D'IDENTITÉS (décision ChatGPT, 06/10/2026, après le diagnostic « associer deux données sans perdre leur forme »).
// Preuves : le contrat de resoudreIdentitesDonnees (message, exécution, sous-donnée α2, mélange, ordre, doublons, inconnu, collisions, entrées mal formées,
// aucune mutation) ; l'ÉQUIVALENCE avec la représentation que observerPossibilites place dans `univers` ; le cas central (un ancien message, absent de
// l'univers courant, est résolu avec sa valeur et sa forme) ; l'absence totale d'effet (snapshot, possibilités, désignations, exécutions, tables) ; la dormance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import * as module from '../app/langage/resoudre-identites.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { ACCES_VALEUR_DONNEE } from '../app/langage/valeur-donnee.js';
import { ACCES_TRACE } from '../app/langage/acces-trace.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { formeSousDonnee } from '../app/langage/sous-donnees.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const CODE = sansCommentaires(lu('app', 'langage', 'resoudre-identites.js'));
const refuse = (f) => assert.throws(f, TypeError);
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const sortieDe = (nom) => valider(DESCRIPTIONS_OPERATIONS.find((d) => d.nom === nom)).sortie;

// Lignes synthétiques : un message, une exécution de symbolesDeChaine, une exécution de partagerCouvertures portant trois sous-données.
const MSG = (id = 'M1', valeur = 'bonjour') => ({ id, valeur });
const EXEC = (id = 'X1', resultat = ['a', 'b']) => ({ id, operation: 'symbolesDeChaine', resultat });
const RESULTAT_Q = { communs: [['a']], seulementA: [['c']], seulementB: [['b']] };
const EXEC_Q = (id = 'Q1') => ({ id, operation: 'partagerCouvertures', resultat: RESULTAT_Q, sousDonnees: [{ id: 'S-communs', chemin: ['communs'] }, { id: 'S-seulementA', chemin: ['seulementA'] }, { id: 'S-seulementB', chemin: ['seulementB'] }] });
const resoudre = (ids, valeurs = [], executions = [], descriptions = DESCRIPTIONS_OPERATIONS) => resoudreIdentitesDonnees(ids, valeurs, executions, descriptions);

// ============================================================================ A. LE CONTRAT
test('A1. contrat : une seule fonction exportée, synchrone ; aucune identité -> [] ; élément = { donnee: { identite, forme }, porteur, acces } exactement', () => {
  assert.deepEqual(Object.keys(module), ['resoudreIdentitesDonnees']);
  assert.equal(resoudreIdentitesDonnees.constructor.name, 'Function');
  assert.deepEqual(resoudre([]), []);
  const [e] = resoudre(['M1'], [MSG()]);
  assert.deepEqual(Object.keys(e), ['donnee', 'porteur', 'acces']);
  assert.deepEqual(Object.keys(e.donnee), ['identite', 'forme']);
});
test('A2. MESSAGE : porteur = la LIGNE (même référence), acces = ACCES_VALEUR_DONNEE (même référence), forme chaîne, valeur exacte par valeurDePorteur', () => {
  const ligne = MSG('M1', 'bonjour Pixel');
  const [e] = resoudre(['M1'], [ligne]);
  assert.equal(e.porteur, ligne);
  assert.equal(e.acces, ACCES_VALEUR_DONNEE);
  assert.deepEqual(e.donnee, { identite: 'M1', forme: { forme: 'scalaire', genre: 'chaine' } });
  assert.deepEqual(e.donnee.forme, DESCRIPTION_SOURCE_MESSAGE.forme);
  assert.notEqual(e.donnee.forme, DESCRIPTION_SOURCE_MESSAGE.forme, 'copie neuve de la forme');
  assert.equal(valeurDePorteur(e.porteur, e.donnee, e.acces), 'bonjour Pixel');
});
test('A3. EXÉCUTION : porteur = la LIGNE, acces = ACCES_TRACE, forme = sortie déclarée du catalogue (copie neuve), résultat exact (même référence)', () => {
  const ligne = EXEC('X1', ['a', 'b']);
  const [e] = resoudre(['X1'], [], [ligne]);
  assert.equal(e.porteur, ligne);
  assert.equal(e.acces, ACCES_TRACE);
  assert.deepEqual(e.donnee, { identite: 'X1', forme: sortieDe('symbolesDeChaine') });
  assert.notEqual(e.donnee.forme, DESCRIPTIONS_OPERATIONS.find((d) => d.nom === 'symbolesDeChaine').sortie);
  assert.equal(valeurDePorteur(e.porteur, e.donnee, e.acces), ligne.resultat);
});
test('A4. SOUS-DONNÉE α2 : porteur synthétique { id, resultat: sous-valeur PAR RÉFÉRENCE }, acces = ACCES_TRACE, forme = formeSousDonnee du descripteur courant', () => {
  const ligne = EXEC_Q();
  const [e] = resoudre(['S-seulementA'], [], [ligne]);
  assert.deepEqual(Object.keys(e.porteur), ['id', 'resultat']);
  assert.equal(e.porteur.id, 'S-seulementA');
  assert.equal(e.porteur.resultat, ligne.resultat.seulementA);
  assert.notEqual(e.porteur, ligne);
  assert.equal(e.acces, ACCES_TRACE);
  assert.deepEqual(e.donnee, { identite: 'S-seulementA', forme: formeSousDonnee(sortieDe('partagerCouvertures'), ['seulementA']) });
  assert.equal(valeurDePorteur(e.porteur, e.donnee, e.acces), ligne.resultat.seulementA);
  // l'exécution porteuse elle-même reste résoluble (production entière) avec sa forme d'objet
  const [entiere] = resoudre(['Q1'], [], [ligne]);
  assert.equal(entiere.porteur, ligne);
  assert.deepEqual(entiere.donnee.forme, sortieDe('partagerCouvertures'));
});
test('A5. MÉLANGE [sous-donnée, message, exécution, exécution porteuse] : quatre éléments dans CET ordre (aucun tri, aucun regroupement par type)', () => {
  const r = resoudre(['S-communs', 'M1', 'X1', 'Q1'], [MSG()], [EXEC(), EXEC_Q()]);
  assert.deepEqual(r.map((e) => e.donnee.identite), ['S-communs', 'M1', 'X1', 'Q1']);
  assert.deepEqual(r.map((e) => e.acces), [ACCES_TRACE, ACCES_VALEUR_DONNEE, ACCES_TRACE, ACCES_TRACE]);
  const ordre = resoudre(['X1', 'S-communs', 'M1'], [MSG()], [EXEC(), EXEC_Q()]).map((e) => e.donnee.identite);
  assert.deepEqual(ordre, ['X1', 'S-communs', 'M1'], 'ordre demandé, pas l\'ordre alphabétique ni celui des lignes');
});
test('A6. DOUBLONS : [X1, X1] donne DEUX éléments ; objets, donnee et formes distincts ; même porteur ; la collection n\'est jamais dédupliquée', () => {
  const ligne = EXEC();
  const r = resoudre(['X1', 'X1', 'M1', 'X1'], [MSG()], [ligne]);
  assert.equal(r.length, 4);
  assert.notEqual(r[0], r[1]); assert.notEqual(r[0].donnee, r[1].donnee); assert.notEqual(r[0].donnee.forme, r[1].donnee.forme);
  assert.deepEqual(r[0], r[1]);
  assert.equal(r[0].porteur, ligne); assert.equal(r[1].porteur, ligne); assert.equal(r[3].porteur, ligne);
  r[0].donnee.forme.forme = 'modifiee';
  assert.equal(r[1].donnee.forme.forme, 'collection', 'la forme d\'une position n\'alias pas celle d\'une autre');
  const sous = resoudre(['S-communs', 'S-communs'], [], [EXEC_Q()]);
  assert.equal(sous.length, 2); assert.notEqual(sous[0].porteur, sous[1].porteur);
  assert.equal(sous[0].porteur.resultat, sous[1].porteur.resultat);
});
test('A7. une identité non demandée n\'est pas résolue ; les lignes non demandées ne produisent rien', () => {
  assert.deepEqual(resoudre(['X1'], [MSG('M1'), MSG('M2')], [EXEC('X1'), EXEC('X2')]).map((e) => e.donnee.identite), ['X1']);
});

// ============================================================================ B. INCONNU ET COLLISIONS
test('B1. IDENTITÉ INCONNUE : TypeError, aucun résultat partiel (même si les autres sont connues)', () => {
  refuse(() => resoudre(['inconnue'], [MSG()], [EXEC()]));
  refuse(() => resoudre(['M1', 'X1', 'inconnue'], [MSG()], [EXEC()]));
  refuse(() => resoudre(['M1'], [], []));
});
test('B2. forme indéterminée : une exécution dont l\'opération n\'est plus décrite, ou une sous-donnée non exposable, est REFUSÉE (jamais devinée) ; elle n\'empêche pas de résoudre les autres', () => {
  const disparue = { id: 'XD', operation: 'operation-disparue', resultat: 1 };
  refuse(() => resoudre(['XD'], [], [disparue]));
  assert.deepEqual(resoudre(['X1'], [], [disparue, EXEC()]).map((e) => e.donnee.identite), ['X1']);
  const sansCatalogue = DESCRIPTIONS_OPERATIONS.filter((d) => d.nom !== 'partagerCouvertures');
  refuse(() => resoudre(['S-communs'], [], [EXEC_Q()], sansCatalogue));
  refuse(() => resoudre(['Q1'], [], [EXEC_Q()], sansCatalogue));
  assert.deepEqual(resoudre(['X1'], [], [EXEC_Q(), EXEC()], sansCatalogue).map((e) => e.donnee.identite), ['X1']);
});
test('B3. FORME DU CATALOGUE COURANT : la forme suit le catalogue présenté (rien n\'est persisté) ; un catalogue modifié donne une autre forme', () => {
  const autre = DESCRIPTIONS_OPERATIONS.map((d) => (d.nom === 'symbolesDeChaine' ? { ...d, sortie: { forme: 'scalaire', genre: 'nombre' } } : d));
  const [e] = resoudre(['X1'], [], [EXEC()], autre);
  assert.deepEqual(e.donnee.forme, { forme: 'scalaire', genre: 'nombre' });
  assert.deepEqual(resoudre(['X1'], [], [EXEC()])[0].donnee.forme, sortieDe('symbolesDeChaine'));
});
test('B4. COLLISIONS d\'identité : message + exécution, message + sous-donnée, deux messages, deux exécutions, exécution + sous-donnée, deux sous-données : TypeError, même pour une identité NON demandée', () => {
  refuse(() => resoudre(['M1'], [MSG('X1')], [EXEC('X1')]));
  refuse(() => resoudre(['M1'], [MSG('S-communs')], [EXEC_Q()]));
  refuse(() => resoudre(['M1'], [MSG('M1'), MSG('M1', 'autre')]));
  refuse(() => resoudre(['X1'], [], [EXEC('X1'), EXEC('X1', ['z'])]));
  refuse(() => resoudre(['X1'], [], [EXEC('S-communs'), EXEC_Q()]));
  const deux = EXEC_Q(); deux.sousDonnees[1].id = 'S-communs';
  refuse(() => resoudre(['Q1'], [], [deux]));
  const deuxLignes = [EXEC_Q('Q1'), EXEC_Q('Q2')];
  refuse(() => resoudre(['Q1'], [], deuxLignes));
  refuse(() => resoudre(['X1'], [MSG('M2')], [EXEC('X1'), EXEC('M2')]), 'collision sur une identité non demandée');
});

// ============================================================================ C. ENTRÉES MAL FORMÉES
test('C1. paramètres : un tableau chacun ; identités = chaînes non vides ; aucun repli, aucune valeur par défaut', () => {
  for (const mauvais of [undefined, null, 'x', 1, {}, new Set()]) {
    refuse(() => resoudreIdentitesDonnees(mauvais, [], [], DESCRIPTIONS_OPERATIONS));
    refuse(() => resoudreIdentitesDonnees([], mauvais, [], DESCRIPTIONS_OPERATIONS));
    refuse(() => resoudreIdentitesDonnees([], [], mauvais, DESCRIPTIONS_OPERATIONS));
    refuse(() => resoudreIdentitesDonnees([], [], [], mauvais));
  }
  refuse(() => resoudreIdentitesDonnees([], [], []));
  for (const mauvais of ['', 1, null, undefined, {}, ['M1']]) refuse(() => resoudre([mauvais], [MSG()]));
});
test('C2. tableaux creux ou à accesseur refusés SANS exécuter l\'accesseur ; lignes non objets refusées', () => {
  let appels = 0;
  const creux = ['M1', , 'X1']; // eslint-disable-line no-sparse-arrays
  refuse(() => resoudre(creux, [MSG()], [EXEC()]));
  const accesseur = ['M1']; Object.defineProperty(accesseur, 0, { get() { appels += 1; return 'M1'; }, enumerable: true });
  refuse(() => resoudre(accesseur, [MSG()]));
  const valeursAcc = []; Object.defineProperty(valeursAcc, 0, { get() { appels += 1; return MSG(); }, enumerable: true });
  refuse(() => resoudre(['M1'], valeursAcc));
  refuse(() => resoudre(['M1'], [MSG(), null]));
  refuse(() => resoudre(['M1'], [MSG(), 'texte']));
  refuse(() => resoudre(['M1'], [MSG(), [1]]));
  refuse(() => resoudre(['X1'], [], [EXEC(), null]));
  refuse(() => resoudre(['X1'], [], [EXEC(), 3]));
  assert.equal(appels, 0);
});
test('C3. ligne de message sans `id` propre (ou id vide, ou accesseur) : refusée pour TOUTES les lignes, demandées ou non ; `valeur` absente ou accesseur : refusée si la ligne est demandée', () => {
  refuse(() => resoudre(['M1'], [MSG(), { valeur: 'x' }]));
  refuse(() => resoudre(['M1'], [MSG(), { id: '', valeur: 'x' }]));
  refuse(() => resoudre(['M1'], [MSG(), { id: 3, valeur: 'x' }]));
  let appels = 0;
  const accId = { valeur: 'x' }; Object.defineProperty(accId, 'id', { get() { appels += 1; return 'M9'; }, enumerable: true });
  refuse(() => resoudre(['M1'], [MSG(), accId]));
  refuse(() => resoudre(['M1'], [{ id: 'M1' }]));
  const accValeur = { id: 'M1' }; Object.defineProperty(accValeur, 'valeur', { get() { appels += 1; return 'x'; }, enumerable: true });
  refuse(() => resoudre(['M1'], [accValeur]));
  assert.equal(appels, 0);
  assert.deepEqual(resoudre(['M1'], [MSG(), { id: 'M2' }]).map((e) => e.donnee.identite), ['M1'], 'une valeur absente d\'une ligne NON demandée n\'est pas lue');
  assert.equal(resoudre(['M1'], [{ id: 'M1', valeur: undefined }])[0].porteur.valeur, undefined, 'une `valeur` présente valant undefined est une propriété propre : acceptée (contrat de valeurDePorteur)');
});
test('C4. ligne d\'exécution : id / operation absents ou mal typés refusés par productionsDecrites ; `resultat` absent refusé si l\'exécution est demandée ; sous-valeur illisible refusée', () => {
  refuse(() => resoudre(['X1'], [], [EXEC(), { operation: 'symbolesDeChaine', resultat: 1 }]));
  refuse(() => resoudre(['X1'], [], [EXEC(), { id: 'X2', resultat: 1 }]));
  refuse(() => resoudre(['X1'], [], [EXEC(), { id: 'X2', operation: 3, resultat: 1 }]));
  refuse(() => resoudre(['X1'], [], [{ id: 'X1', operation: 'symbolesDeChaine' }]));
  assert.deepEqual(resoudre(['X1'], [], [EXEC(), { id: 'X2', operation: 'symbolesDeChaine' }]).map((e) => e.donnee.identite), ['X1'], '`resultat` d\'une ligne non demandée n\'est pas lu');
  const sansResultat = { id: 'Q1', operation: 'partagerCouvertures', sousDonnees: [{ id: 'S1', chemin: ['communs'] }] };
  refuse(() => resoudre(['S1'], [], [sansResultat]));
  const illisible = { id: 'Q1', operation: 'partagerCouvertures', resultat: 5, sousDonnees: [{ id: 'S1', chemin: ['communs'] }] };
  refuse(() => resoudre(['S1'], [], [illisible]));
  const champAbsent = { id: 'Q1', operation: 'partagerCouvertures', resultat: { seulementA: [] }, sousDonnees: [{ id: 'S1', chemin: ['communs'] }] };
  refuse(() => resoudre(['S1'], [], [champAbsent]));
  const mauvaiseSous = { id: 'Q1', operation: 'partagerCouvertures', resultat: RESULTAT_Q, sousDonnees: [] };
  refuse(() => resoudre(['Q1'], [], [mauvaiseSous]));
  const etrangere = { id: 'Q1', operation: 'partagerCouvertures', resultat: RESULTAT_Q, sousDonnees: [{ id: 'S1', chemin: ['communs'], en_plus: 1 }] };
  refuse(() => resoudre(['Q1'], [], [etrangere]));
});
test('C5. catalogue invalide ou doublonné : TypeError (productionsDecrites), jamais une résolution partielle', () => {
  refuse(() => resoudre(['X1'], [], [EXEC()], [{ nom: 'a' }]));
  refuse(() => resoudre(['X1'], [], [EXEC()], [...DESCRIPTIONS_OPERATIONS, DESCRIPTIONS_OPERATIONS[0]]));
  refuse(() => resoudre(['X1'], [], [EXEC()], [null]));
});
test('C6. tout-ou-rien : une identité inconnue en dernière position ne laisse AUCUN résultat ; l\'erreur est toujours un TypeError de ce module ou des mécanismes existants', () => {
  let erreur = null;
  try { resoudre(['M1', 'X1', 'nulle part'], [MSG()], [EXEC()]); } catch (e) { erreur = e; }
  assert.ok(erreur instanceof TypeError);
  assert.match(erreur.message, /resoudreIdentitesDonnees/);
});

// ============================================================================ D. PURETÉ
test('D1. AUCUNE MUTATION : entrées gelées en profondeur acceptées, rien n\'est modifié, les porteurs restent les objets d\'origine', () => {
  const valeurs = gelProfond([MSG('M1', 'a')]);
  const executions = gelProfond([EXEC('X1'), EXEC_Q('Q1')]);
  const identites = gelProfond(['M1', 'X1', 'S-communs']);
  const avant = JSON.stringify({ valeurs, executions, identites });
  const catalogueAvant = JSON.stringify(DESCRIPTIONS_OPERATIONS);
  const r = resoudreIdentitesDonnees(identites, valeurs, executions, DESCRIPTIONS_OPERATIONS);
  assert.equal(JSON.stringify({ valeurs, executions, identites }), avant);
  assert.equal(JSON.stringify(DESCRIPTIONS_OPERATIONS), catalogueAvant);
  assert.equal(r[0].porteur, valeurs[0]); assert.equal(r[1].porteur, executions[0]);
});
test('D2. DÉTERMINISME : deux appels identiques donnent des résultats profondément égaux, composés d\'objets distincts', () => {
  const a = resoudre(['M1', 'X1', 'S-communs'], [MSG()], [EXEC(), EXEC_Q()]);
  const b = resoudre(['M1', 'X1', 'S-communs'], [MSG()], [EXEC(), EXEC_Q()]);
  assert.deepEqual(a, b);
  assert.notEqual(a[1].donnee, b[1].donnee);
});

// ============================================================================ E. LA CHAÎNE RÉELLE
// Un monde réel : chaque tour conserve la valeur de son message (comme traiterTourAvecEnonce), observe les possibilités, puis une opération est exécutée.
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
    assert.ok(application, `${operation} : application attendue`);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
    assert.equal(r.statut, 'executee', `${operation} : ${r.erreur && r.erreur.message}`);
    return { ...r, t };
  }
  const lire = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
  return { magasin, tour, lancer, lire };
}
async function etatAvecSousDonnees() {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: P.execution.id }]);
  const Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: H.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  const ligneQ = (await w.magasin.lireTout('executionsOperations')).find((l) => l.id === Q.execution.id);
  const sous = Object.fromEntries(ligneQ.sousDonnees.map((s) => [s.chemin[0], s.id]));
  return { w, A, B, P, H, Q, sous };
}
test('E1. CAS CENTRAL : un ANCIEN message, absent de l\'univers courant et de donneesExaminees, est résolu avec sa valeur exacte et sa forme d\'origine', async () => {
  const m = await etatAvecSousDonnees();
  const ancien = m.A.t.message.id;
  const courant = await m.w.tour('message courant');
  assert.equal(courant.observation.donneesExaminees.includes(ancien), false, 'un ancien message n\'est pas dans le snapshot courant');
  assert.equal(courant.univers.some((e) => e.donnee.identite === ancien), false);
  const { valeurs, executions } = await m.w.lire();
  const [e] = resoudreIdentitesDonnees([ancien], valeurs, executions, DESCRIPTIONS_OPERATIONS);
  assert.equal(e.donnee.identite, ancien);
  assert.deepEqual(e.donnee.forme, { forme: 'scalaire', genre: 'chaine' });
  assert.equal(valeurDePorteur(e.porteur, e.donnee, e.acces), 'bonjour Pixel');
  assert.equal(e.acces, ACCES_VALEUR_DONNEE);
  // le résultat de cette résolution n'est entré dans aucun snapshot : le tour suivant l'ignore toujours
  const suivant = await m.w.tour('encore un tour');
  assert.equal(suivant.observation.donneesExaminees.includes(ancien), false);
});
test('E2. ÉQUIVALENCE avec observerPossibilites : pour chaque production et sous-donnée du snapshot, l\'élément résolu est identique (donnee, porteur, acces) à celui de l\'univers du tour ; pour le message, même forme et même valeur', async () => {
  const m = await etatAvecSousDonnees();
  const t = await m.w.tour('tour de comparaison');
  const { valeurs, executions } = await m.w.lire();
  const identites = t.univers.map((e) => e.donnee.identite);
  assert.equal(identites.length, 1 + executions.length + executions.reduce((s, l) => s + (l.sousDonnees ? l.sousDonnees.length : 0), 0) + executions.length); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : + entrées(P) pour chaque exécution
  const resolus = resoudreIdentitesDonnees(identites, valeurs, executions, DESCRIPTIONS_OPERATIONS);
  assert.equal(resolus.length, t.univers.length);
  resolus.forEach((r, i) => {
    const u = t.univers[i];
    assert.deepEqual(r.donnee, u.donnee, `donnee ${u.donnee.identite}`);
    if (i === 0) {
      assert.equal(valeurDePorteur(r.porteur, r.donnee, r.acces), valeurDePorteur(u.porteur, u.donnee, u.acces));
      assert.deepEqual(u.acces, DESCRIPTION_SOURCE_MESSAGE.acces);
      return;
    }
    assert.deepEqual(r.acces, u.acces, `acces ${u.donnee.identite}`);
    assert.deepEqual(r.porteur, u.porteur, `porteur ${u.donnee.identite}`);
    assert.deepEqual(valeurDePorteur(r.porteur, r.donnee, r.acces), valeurDePorteur(u.porteur, u.donnee, u.acces), `valeur ${u.donnee.identite}`); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : égalité PROFONDE (entrées(P) = copie validée à chaque résolution)
  });
  const parId = new Map(executions.map((l) => [l.id, l]));
  for (const r of resolus.slice(1)) if (parId.has(r.donnee.identite)) assert.equal(r.porteur, parId.get(r.donnee.identite), 'exécution : la ligne elle-même');
  assert.ok(Object.values(m.sous).every((id) => identites.includes(id)), 'les trois sous-données de Q figurent bien dans la comparaison');
});
test('E3. SOUS-DONNÉES RÉELLES de Q : valeur = la référence exacte du champ de la ligne persistée ; forme du descripteur courant', async () => {
  const m = await etatAvecSousDonnees();
  const { valeurs, executions } = await m.w.lire();
  const ligneQ = executions.find((l) => l.id === m.Q.execution.id);
  for (const champ of ['communs', 'seulementA', 'seulementB']) {
    const [e] = resoudreIdentitesDonnees([m.sous[champ]], valeurs, executions, DESCRIPTIONS_OPERATIONS);
    assert.equal(valeurDePorteur(e.porteur, e.donnee, e.acces), ligneQ.resultat[champ]);
    assert.deepEqual(e.donnee.forme, formeSousDonnee(sortieDe('partagerCouvertures'), [champ]));
  }
});
test('E4. NON-RÉGRESSION CONCEPTUELLE : résoudre n\'ajoute rien — mêmes tables (lignes et contenus), mêmes observations, aucune désignation ni exécution, aucune possibilité de plus dans l\'observation suivante', async () => {
  const m = await etatAvecSousDonnees();
  const tables = ['valeursDonnees', 'executionsOperations', 'designations', 'observationsPossibilites'];
  const lireTables = async () => JSON.stringify(await Promise.all(tables.map((t) => m.w.magasin.lireTout(t))));
  const avant = await lireTables();
  const { valeurs, executions } = await m.w.lire();
  const toutes = [m.A.t.message.id, m.B.t.message.id, m.A.execution.id, m.Q.execution.id, ...Object.values(m.sous)];
  assert.equal(resoudreIdentitesDonnees(toutes, valeurs, executions, DESCRIPTIONS_OPERATIONS).length, toutes.length);
  assert.equal(await lireTables(), avant, 'aucune écriture');
  // deux mondes identiques, l'un avec résolution entre les tours, l'autre sans : mêmes snapshots et mêmes possibilités
  const sans = await etatAvecSousDonnees();
  const avec = await etatAvecSousDonnees();
  const lv = await avec.w.lire();
  resoudreIdentitesDonnees([avec.A.t.message.id, avec.Q.execution.id], lv.valeurs, lv.executions, DESCRIPTIONS_OPERATIONS);
  const gabarit = (o) => ({ donnees: o.donneesExaminees.length, operations: o.operationsExaminees, possibilites: o.possibilites.length, atomes: o.possibilites.map((p) => `${p.operation}.${p.entree}`).sort() });
  const ts = await sans.w.tour('après'); const ta = await avec.w.tour('après');
  assert.deepEqual(gabarit(ta.observation), gabarit(ts.observation));
  assert.equal((await avec.w.magasin.lireTout('designations')).length, (await sans.w.magasin.lireTout('designations')).length);
  assert.equal((await avec.w.magasin.lireTout('executionsOperations')).length, (await sans.w.magasin.lireTout('executionsOperations')).length);
  assert.ok(!ta.observation.donneesExaminees.includes(avec.A.t.message.id), 'l\'ancien message résolu n\'entre pas dans donneesExaminees');
  assert.equal(ta.univers.some((e) => e.donnee.identite === avec.A.t.message.id), false);
});

// ============================================================================ F. DORMANCE ET PÉRIMÈTRE
test('F1. DORMANCE : aucun fichier de app/ ne nomme le module ni la fonction en dehors de lui-même ; ni catalogue, ni table d\'opérations', () => {
  const parcourir = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? parcourir(p) : [p]; });
  const nommant = parcourir(join(RACINE, 'app')).filter((p) => /\.(js|mjs|html)$/.test(p)).filter((p) => /resoudre-identites|resoudreIdentitesDonnees/.test(readFileSync(p, 'utf8'))).map((p) => relative(RACINE, p)).sort();
  // MISE À JOUR DÉLIBÉRÉE v0.63.49 : contexte-observation.js (primitive pure, dormante) importe resoudre-identites.js pour reconstruire l'univers
  // d'une observation persistée (jamais réimplémenté). Il n'est lui-même importé par aucun mécanisme.
  // MISE À JOUR DÉLIBÉRÉE v0.63.55 : entrees-donnee.js (constantes d'identité dérivée, pures, dormantes) nomme resoudreIdentitesDonnees dans un commentaire.
  assert.deepEqual(nommant, ['app/langage/contexte-observation.js', 'app/langage/entrees-donnee.js', 'app/langage/episodes-de-transformation.js', 'app/langage/resoudre-identites.js', 'app/langage/retours-de-valeur.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.69 : + episodes-de-transformation.js (vue dormante, seule source de vérité) ; retours-de-valeur.js ne la cite plus qu'en commentaire. MISE À JOUR DÉLIBÉRÉE v0.63.68 : retours-de-valeur.js (vue dormante) résout les valeurs par cette primitive
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => /identit/i.test(d.nom)), false);
});
test('F2. IMPORTS : exactement les helpers existants ; aucun magasin, aucune persistance, aucune horloge, aucun hasard, aucune génération d\'identité', () => {
  const imports = [...lu('app', 'langage', 'resoudre-identites.js').matchAll(/^import .* from '(.+)';$/gm)].map((x) => x[1]).sort();
  // MISE À JOUR DÉLIBÉRÉE v0.63.55 : + entrees-donnee.js (identité, forme, accès de la donnée adjacente) et entrees-production.js (valeur validée et copiée).
  assert.deepEqual(imports, ['./acces-trace.js', './donnee-de-source.js', './entrees-donnee.js', './entrees-production.js', './productions-decrites.js', './source-message.js', './sous-donnees.js', './valeur-donnee.js']);
  for (const interdit of [/indexedDB/i, /magasin/i, /\bDate\b/, /Math\.random/, /nouvelId/, /\bfetch\b/, /localStorage/, /globalThis|window|document/, /\bawait\b|\basync\b|Promise/, /\bsort\(/, /\bnew Set\(\s*identites/])
    assert.equal(interdit.test(CODE), false, String(interdit));
});
test('F3. AUCUN TERME DU DOMAINE : ni RC, ni condition, ni issue, ni paire, ni attente, ni temporalité, ni sélection implicite (dernier, premier)', () => {
  for (const terme of [/\bRC\b/, /rechercherSousSuites/, /condition/i, /\bissue\b/i, /paire/i, /attente/i, /derni[eè]re?/i, /premi[eè]re?/i, /temporel/i, /hypoth[eè]se/i, /causal/i, /exp[eé]rience/i])
    assert.equal(terme.test(CODE), false, String(terme));
});
test('F4. versions et schéma inchangés : VERSION_BASE 19, SCHEMA 9, 22 tables, aucune table nouvelle ; aucune observation, désignation ou exécution écrite par le module', () => {
  assert.equal(VERSION_BASE, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 03 : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(/ecrire|enregistrer/.test(CODE), false);
});
// === FIN_TEST_RESOUDRE_IDENTITES ===
