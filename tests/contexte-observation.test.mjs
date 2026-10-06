// v0.63.49 — « CONTEXTE D'UNE OBSERVATION PERSISTÉE » (décision ChatGPT, 06/10/2026) : resoudreContexteObservation, primitive pure et dormante.
// Preuves : un contexte historique n'est rendu que s'il est FIDÈLE (mêmes possibilités avec le catalogue fourni) ; la dérive du catalogue est
// REFUSÉE ; l'application disponible dans O(Y) reste retrouvable, résoluble et exécutable avec les formes d'origine ; rien n'est pollué.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import * as module from '../app/langage/contexte-observation.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { resoudreValeursApplication } from '../app/langage/valeurs-application.js';
import { verifierApplicationAuCatalogue } from '../app/langage/conformite-application.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const CODE = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
const refuse = (f) => assert.throws(f, TypeError);
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const clone = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------- monde réel : chaque tour conserve la valeur du message, observe, puis exécute.
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
  const lire = async () => ({
    observations: await magasin.lireTout('observationsPossibilites'),
    valeurs: await magasin.lireTout('valeursDonnees'),
    executions: await magasin.lireTout('executionsOperations'),
  });
  return { magasin, tour, lancer, lire };
}
// A,B -> P -> H -> Q (chaîne réelle) ; puis Y = un message arrivé APRÈS, dont l'observation O(Y) contient toutes ces productions.
async function chaine() {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: P.execution.id }]);
  const Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: H.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  const Y = await w.tour('message Y');
  return { w, A, B, P, H, Q, Y };
}
async function tables(w) {
  const toutes = ['observationsPossibilites', 'valeursDonnees', 'executionsOperations', 'designations'];
  return JSON.stringify(await Promise.all(toutes.map((t) => w.magasin.lireTout(t))));
}
const contexte = (id, l, descriptions = DESCRIPTIONS_OPERATIONS) => resoudreContexteObservation(id, l.observations, l.valeurs, l.executions, descriptions);

// Petit jeu minimal, sans magasin, pour les refus structurels.
function mini() {
  const valeurs = [{ id: 'M1', valeur: 'bonjour' }];
  const executions = [{ id: 'X1', operation: 'symbolesDeChaine', resultat: ['a', 'b'] }];
  const univers = resoudreIdentitesDonnees(['M1', 'X1'], valeurs, executions, DESCRIPTIONS_OPERATIONS);
  const possibilites = possibilitesDeLiaison(univers.map((e) => e.donnee), DESCRIPTIONS_OPERATIONS);
  const observation = {
    id: 'O1', idMessage: 'M1', horodatage: '2026-10-06T10:00:00.000Z',
    donneesExaminees: ['M1', 'X1'], operationsExaminees: DESCRIPTIONS_OPERATIONS.map((d) => d.nom).sort(), possibilites,
  };
  return { valeurs, executions, observation };
}
const appel = (m, observation = m.observation, descriptions = DESCRIPTIONS_OPERATIONS) => resoudreContexteObservation(observation.id, [observation], m.valeurs, m.executions, descriptions);

// ============================================================================ A. CONTRAT
test('A1. contrat : une seule fonction exportée, synchrone ; sortie exactement { observation, univers }', () => {
  assert.deepEqual(Object.keys(module), ['resoudreContexteObservation']);
  const m = mini();
  const r = appel(m);
  assert.equal(r instanceof Promise, false);
  assert.deepEqual(Object.keys(r), ['observation', 'univers']);
});
test('A2. observation = EXACTEMENT la ligne persistée (même référence, jamais copiée) ; univers = exactement donneesExaminees, dans leur ordre', () => {
  const m = mini();
  const r = appel(m);
  assert.equal(r.observation, m.observation);
  assert.deepEqual(r.univers.map((e) => e.donnee.identite), m.observation.donneesExaminees);
  assert.deepEqual(r.univers, resoudreIdentitesDonnees(m.observation.donneesExaminees, m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS));
  for (const e of r.univers) assert.deepEqual(Object.keys(e), ['donnee', 'porteur', 'acces']);
});
test('A3. l\'identité demandée sélectionne UNE observation parmi plusieurs : aucune autre n\'est lue ni choisie', () => {
  const m = mini();
  const autre = { ...clone(m.observation), id: 'O2', donneesExaminees: ['M1'], possibilites: [] , operationsExaminees: [...m.observation.operationsExaminees] };
  // O2 est mal formée au sens de la fidélité (possibilités vides alors que M1 est candidate) : elle ne gêne PAS O1, elle n'est jamais examinée
  const r = resoudreContexteObservation('O1', [autre, m.observation], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS);
  assert.equal(r.observation, m.observation);
  refuse(() => resoudreContexteObservation('O2', [autre, m.observation], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS));
});
test('A4. paramètres : idObservation chaîne non vide, quatre tableaux ; aucun repli, aucune valeur par défaut', () => {
  const m = mini();
  for (const mauvais of [undefined, null, '', 12, {}, []]) refuse(() => resoudreContexteObservation(mauvais, [m.observation], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS));
  for (const rang of [1, 2, 3, 4]) {
    const args = ['O1', [m.observation], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS];
    for (const mauvais of [undefined, null, {}, 'x']) { const a = [...args]; a[rang] = mauvais; refuse(() => resoudreContexteObservation(...a)); }
  }
  refuse(() => resoudreContexteObservation('O1', [m.observation], m.valeurs, m.executions)); // catalogue obligatoire
});

// ============================================================================ B. REFUS
test('B1. observation inconnue, ligne d\'observation sans id propre / id vide / accesseur / non objet, tableau creux : TypeError', () => {
  const m = mini();
  refuse(() => resoudreContexteObservation('absente', [m.observation], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS));
  refuse(() => resoudreContexteObservation('O1', [], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS));
  for (const mauvaise of [null, 3, 'x', [], {}, { id: '' }, { id: 4 }, { get id() { throw new Error('exécuté'); } }]) {
    assert.throws(() => resoudreContexteObservation('O1', [m.observation, mauvaise], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS), (e) => e instanceof TypeError);
  }
  // tableau creux
  const creux = [m.observation]; creux.length = 2;
  refuse(() => resoudreContexteObservation('O1', creux, m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS));
});
test('B2. OBSERVATION DUPLIQUÉE : deux lignes de même id (même identique) = ambiguïté, TypeError, jamais premier ni dernier', () => {
  const m = mini();
  refuse(() => resoudreContexteObservation('O1', [m.observation, clone(m.observation)], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS));
  const autre = { ...clone(m.observation), id: 'O2' };
  refuse(() => resoudreContexteObservation('O1', [m.observation, autre, clone(autre)], m.valeurs, m.executions, DESCRIPTIONS_OPERATIONS)); // doublon sur une autre id : refusé aussi
});
test('B3. LIGNE MAL FORMÉE : clé manquante, clé étrangère, idMessage/horodatage non chaîne, données ou opérations non tableaux ou avec doublon ou chaîne vide, accesseur', () => {
  const m = mini();
  const essai = (modifie) => refuse(() => appel(m, modifie(clone(m.observation))));
  for (const cle of ['idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'possibilites']) essai((o) => { delete o[cle]; return o; });
  essai((o) => ({ ...o, etranger: 1 }));
  essai((o) => ({ ...o, idMessage: '' }));
  essai((o) => ({ ...o, idMessage: 7 }));
  essai((o) => ({ ...o, horodatage: null }));
  essai((o) => ({ ...o, donneesExaminees: 'M1' }));
  essai((o) => ({ ...o, donneesExaminees: ['M1', 'X1', 'X1'] }));
  essai((o) => ({ ...o, donneesExaminees: ['M1', ''] }));
  essai((o) => ({ ...o, operationsExaminees: o.operationsExaminees.concat(o.operationsExaminees[0]) }));
  essai((o) => ({ ...o, operationsExaminees: {} }));
  essai((o) => ({ ...o, possibilites: {} }));
  const accesseur = clone(m.observation); Object.defineProperty(accesseur, 'idMessage', { get() { throw new Error('exécuté'); }, enumerable: true });
  refuse(() => appel(m, accesseur));
});
test('B4. idMessage absent de donneesExaminees : ce n\'est pas une observation que observerPossibilites aurait écrite, TypeError', () => {
  const m = mini();
  refuse(() => appel(m, { ...clone(m.observation), idMessage: 'X1x' }));
  refuse(() => appel(m, { ...clone(m.observation), idMessage: 'ABSENT' }));
});
test('B5. POSSIBILITÉ PERSISTÉE MAL FORMÉE : non objet, tableau, champ manquant/étranger/vide/non chaîne, accesseur, doublon', () => {
  const m = mini();
  const atome = m.observation.possibilites[0];
  assert.ok(atome, 'le jeu minimal a au moins une possibilité');
  const avec = (nouvelles) => ({ ...clone(m.observation), possibilites: nouvelles });
  const reste = clone(m.observation.possibilites).slice(1);
  for (const mauvais of [null, 3, 'x', [], { donnee: atome.donnee, operation: atome.operation }, { ...atome, extra: 1 }, { ...atome, entree: '' }, { ...atome, donnee: 4 }]) refuse(() => appel(m, avec([mauvais, ...reste])));
  refuse(() => appel(m, avec([atome, atome, ...reste])));
  const accesseur = { donnee: atome.donnee, operation: atome.operation }; Object.defineProperty(accesseur, 'entree', { get() { throw new Error('exécuté'); }, enumerable: true });
  refuse(() => appel(m, avec([accesseur, ...reste])));
});
test('B6. DONNÉE EXAMINÉE NON RÉSOLUBLE : valeur de message absente, exécution absente, forme indéterminée : TypeError, aucun contexte partiel', () => {
  const m = mini();
  refuse(() => resoudreContexteObservation('O1', [m.observation], [], m.executions, DESCRIPTIONS_OPERATIONS));
  refuse(() => resoudreContexteObservation('O1', [m.observation], m.valeurs, [], DESCRIPTIONS_OPERATIONS));
  refuse(() => resoudreContexteObservation('O1', [m.observation], m.valeurs, [{ id: 'X1', operation: 'inconnueDuCatalogue', resultat: [] }], DESCRIPTIONS_OPERATIONS));
  refuse(() => appel(m, { ...clone(m.observation), donneesExaminees: ['M1', 'X1', 'Z9'], possibilites: m.observation.possibilites }));
});
test('B7. COLLISION D\'IDENTITÉ héritée de v0.63.48 : un message et une exécution de même identité (même non examinée), TypeError', () => {
  const m = mini();
  refuse(() => resoudreContexteObservation('O1', [m.observation], [...m.valeurs, { id: 'X1', valeur: 'collision' }], m.executions, DESCRIPTIONS_OPERATIONS));
  refuse(() => resoudreContexteObservation('O1', [m.observation], [...m.valeurs, { id: 'Zzz', valeur: 'a' }], [...m.executions, { id: 'Zzz', operation: 'symbolesDeChaine', resultat: [] }], DESCRIPTIONS_OPERATIONS));
});
test('B8. TOUT-OU-RIEN : aucun refus ne laisse une sortie partielle ; les erreurs sont des TypeError de ce module', () => {
  const m = mini();
  let erreur = null;
  try { appel(m, { ...clone(m.observation), possibilites: [] }); } catch (e) { erreur = e; }
  assert.ok(erreur instanceof TypeError);
  assert.match(erreur.message, /^resoudreContexteObservation : /);
});

// ============================================================================ C. ÉQUIVALENCE DES POSSIBILITÉS (ensembles, pas JSON)
test('C1. l\'ORDRE des possibilités persistées ne compte pas (ensemble) ; ni l\'ordre de donneesExaminees/operationsExaminees dans la ligne', () => {
  const m = mini();
  const o = clone(m.observation);
  o.possibilites.reverse();
  assert.equal(appel(m, o).observation, o);
  const o2 = { ...clone(m.observation), operationsExaminees: [...m.observation.operationsExaminees].reverse() };
  assert.equal(appel(m, o2).observation, o2);
});
test('C2. aucun champ technique n\'est comparé : id, horodatage et clés des atomes dans un autre ordre n\'influencent pas', () => {
  const m = mini();
  const o = { ...clone(m.observation), id: 'AUTRE-ID', horodatage: 'n\'importe quoi' };
  o.possibilites = o.possibilites.map((a) => ({ entree: a.entree, donnee: a.donnee, operation: a.operation }));
  assert.equal(appel(m, o).observation, o);
});
test('C3. un atome persisté EN PLUS (jamais recalculé) ou EN MOINS (recalculé mais non persisté) : REFUS', () => {
  const m = mini();
  const o = clone(m.observation);
  refuse(() => appel(m, { ...o, possibilites: o.possibilites.slice(1) })); // un atome manque
  refuse(() => appel(m, { ...o, possibilites: [...o.possibilites, { donnee: 'M1', operation: 'symbolesDeChaine', entree: 'inventee' }] })); // un atome de trop
  refuse(() => appel(m, { ...o, possibilites: [] }));
  refuse(() => appel(m, { ...o, possibilites: o.possibilites.map((a, i) => (i === 0 ? { ...a, entree: a.entree + 'x' } : a)) }));
  refuse(() => appel(m, { ...o, possibilites: o.possibilites.map((a, i) => (i === 0 ? { ...a, donnee: 'X1' === a.donnee ? 'M1' : 'X1' } : a)) }));
});
test('C4. une observation sans AUCUNE possibilité est fidèle si et seulement si le recalcul est vide aussi (liste vide ≠ calcul non effectué)', () => {
  const valeurs = [{ id: 'M1', valeur: 'x' }];
  const descriptions = [{ nom: 'opSansEntree', entrees: {}, sortie: { forme: 'scalaire', genre: 'nombre' } }];
  const o = { id: 'O1', idMessage: 'M1', horodatage: 'h', donneesExaminees: ['M1'], operationsExaminees: ['opSansEntree'], possibilites: [] };
  assert.equal(resoudreContexteObservation('O1', [o], valeurs, [], descriptions).observation, o);
  const avecPossibilite = [{ nom: 'opSansEntree', entrees: { c: { forme: 'scalaire', genre: 'chaine' } }, sortie: { forme: 'scalaire', genre: 'nombre' } }];
  refuse(() => resoudreContexteObservation('O1', [o], valeurs, [], avecPossibilite));
});

// ============================================================================ D. operationsExaminees ET CATALOGUE
test('D1. OPÉRATIONS EXAMINÉES = ensemble des noms du catalogue fourni : un nom en moins ou en plus dans le catalogue est REFUSÉ, même si les possibilités resteraient identiques', () => {
  const m = mini();
  const sansOp = DESCRIPTIONS_OPERATIONS.filter((d) => d.nom !== 'resoudreCouverture');
  refuse(() => appel(m, m.observation, sansOp));
  const enPlus = [...DESCRIPTIONS_OPERATIONS, { nom: 'operationNouvelle', entrees: { x: { forme: 'scalaire', genre: 'booleen' } }, sortie: { forme: 'scalaire', genre: 'nombre' } }];
  refuse(() => appel(m, m.observation, enPlus));
  // l'ordre du catalogue n'a aucune signification
  assert.equal(appel(m, m.observation, [...DESCRIPTIONS_OPERATIONS].reverse()).observation, m.observation);
});
test('D2. une opération renommée (même forme) : le nom examiné n\'existe plus, REFUS', () => {
  const m = mini();
  const renomme = DESCRIPTIONS_OPERATIONS.map((d) => (d.nom === 'symbolesDeChaine' ? { ...d, nom: 'symbolesDeChaine2' } : d));
  refuse(() => appel(m, m.observation, renomme));
});
test('D3. même noms mais une FORME d\'entrée modifiée : les possibilités recalculées changent, REFUS (la dérive de forme est détectée par le recalcul)', () => {
  const m = mini();
  const derive = DESCRIPTIONS_OPERATIONS.map((d) => {
    if (d.nom !== 'symbolesDeChaine') return d;
    const entrees = {};
    for (const cle of Object.keys(d.entrees)) entrees[cle] = { forme: 'scalaire', genre: 'nombre' };
    return { ...d, entrees };
  });
  refuse(() => appel(m, m.observation, derive));
});
test('D4. même noms mais une SORTIE modifiée : la forme de X1 change, donc ses possibilités : REFUS', () => {
  const m = mini();
  const derive = DESCRIPTIONS_OPERATIONS.map((d) => (d.nom === 'symbolesDeChaine' ? { ...d, sortie: { forme: 'scalaire', genre: 'nombre' } } : d));
  refuse(() => appel(m, m.observation, derive));
});
test('D5. un catalogue invalide ou doublonné : TypeError (jamais un contexte)', () => {
  const m = mini();
  refuse(() => appel(m, m.observation, [...DESCRIPTIONS_OPERATIONS, DESCRIPTIONS_OPERATIONS[0]]));
  refuse(() => appel(m, m.observation, [{ nom: 'x' }]));
  refuse(() => appel(m, m.observation, [null]));
});

// ============================================================================ E. TEST CENTRAL 1 — RECONSTRUCTION FIDÈLE SUR UNE VRAIE CHAÎNE
test('E1. CENTRAL 1 : après plusieurs tours, O(Y) est rendue EXACTEMENT (même référence) avec un univers = exactement ses donneesExaminees, formes précises, possibilités recalculées équivalentes', async () => {
  const c = await chaine();
  for (let i = 1; i <= 3; i += 1) await c.w.tour(`tour ultérieur ${i}`); // plusieurs tours après Y
  const l = await c.w.lire();
  const ligneY = l.observations.find((o) => o.id === c.Y.observation.id);
  assert.ok(ligneY);
  const r = contexte(ligneY.id, l);
  assert.equal(r.observation, ligneY);
  assert.deepEqual(r.univers.map((e) => e.donnee.identite), c.Y.observation.donneesExaminees);
  assert.ok(r.observation.donneesExaminees.includes(c.Y.message.id), 'Y historique présent');
  assert.ok(r.observation.donneesExaminees.includes(c.Q.execution.id), 'la production Q (ex. RC) est présente');
  // formes : celles qu'avait l'univers VIVANT du tour de Y
  assert.deepEqual(r.univers.map((e) => e.donnee), c.Y.univers.map((e) => e.donnee).sort((a, b) => (a.identite < b.identite ? -1 : a.identite > b.identite ? 1 : 0)));
  const forme = (identite) => r.univers.find((e) => e.donnee.identite === identite).donnee.forme;
  assert.equal(forme(c.Y.message.id).forme, 'scalaire');
  assert.notDeepEqual(forme(c.Q.execution.id), forme(c.A.execution.id), 'la forme précise de Q n\'est pas celle de A');
  // possibilités recalculées == persistées (ensembles)
  const recalculees = possibilitesDeLiaison(r.univers.map((e) => e.donnee), DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(recalculees, ligneY.possibilites);
  // les ANCIENS messages (A, B) ne sont pas dans O(Y), les messages ultérieurs non plus
  assert.equal(r.univers.some((e) => e.donnee.identite === c.A.t.message.id), false);
  assert.equal(r.univers.some((e) => e.donnee.identite === c.B.t.message.id), false);
});
test('E2. CHAQUE observation de la chaîne réelle (toutes sont fidèles) est reconstruite ; chacune avec SON propre univers', async () => {
  const c = await chaine();
  await c.w.tour('dernier');
  const l = await c.w.lire();
  assert.ok(l.observations.length >= 7);
  const tailles = [];
  for (const o of l.observations) {
    const r = contexte(o.id, l);
    assert.equal(r.observation, o);
    assert.equal(r.univers.length, o.donneesExaminees.length);
    tailles.push(r.univers.length);
  }
  assert.ok(new Set(tailles).size > 1, 'les univers diffèrent d\'une observation à l\'autre (aucun univers commun fabriqué)');
});
test('E3. ÉQUIVALENCE AVEC LE TOUR VIVANT : élément par élément, donnee/porteur/acces identiques à l\'univers que observerPossibilites avait construit à l\'époque (message : même forme et même valeur)', async () => {
  const c = await chaine();
  await c.w.tour('suivant');
  const l = await c.w.lire();
  const r = contexte(c.Y.observation.id, l);
  const vivant = new Map(c.Y.univers.map((e) => [e.donnee.identite, e]));
  assert.equal(r.univers.length, vivant.size);
  for (const e of r.univers) {
    const v = vivant.get(e.donnee.identite);
    assert.ok(v, e.donnee.identite);
    assert.deepEqual(e.donnee, v.donnee);
    assert.equal(valeurDePorteur(e.porteur, e.donnee, e.acces), valeurDePorteur(v.porteur, v.donnee, v.acces) );
  }
});

// ============================================================================ F. TEST CENTRAL 2 — EXÉCUTION HISTORIQUE
test('F1. CENTRAL 2 : une application disponible dans O(Y) est retrouvée mécaniquement dans le contexte rendu, conforme au catalogue, ses valeurs se résolvent, les formes d\'origine sont conservées', async () => {
  const c = await chaine();
  await c.w.tour('plus tard');
  const l = await c.w.lire();
  const r = contexte(c.Y.observation.id, l);
  const sollicitables = applicationsSollicitables(r.observation);
  assert.ok(sollicitables.applications.length > 0);
  // applications ordinaires ({ entree, donnee }) qui consomment une PRODUCTION ANCIENNE de la chaîne (P) : disponibles dans O(Y), absentes du tour courant
  const avecQ = sollicitables.applications.filter((a) => a.liaisons.every((b) => typeof b.donnee === 'string') && a.liaisons.some((b) => b.donnee === c.P.execution.id));
  assert.ok(avecQ.length > 0, 'une application disponible dans O(Y) porte la production ancienne P');
  const vivantes = applicationsSollicitables(c.Y.observation);
  assert.deepEqual(sollicitables, vivantes, 'mêmes applications que celles de l\'observation écrite à l\'époque');
  for (const application of avecQ) {
    verifierApplicationAuCatalogue(application, DESCRIPTIONS_OPERATIONS);
    const historique = resoudreValeursApplication(application, r.univers);
    const origine = resoudreValeursApplication(application, c.Y.univers);
    assert.deepEqual(historique, origine, `valeurs de ${application.operation} identiques à celles du tour d'origine`);
    for (const liaison of application.liaisons) {
      const e = r.univers.find((x) => x.donnee.identite === liaison.donnee);
      const v = c.Y.univers.find((x) => x.donnee.identite === liaison.donnee);
      assert.deepEqual(e.donnee.forme, v.donnee.forme, 'forme d\'origine conservée');
    }
  }
});
test('F2. CENTRAL 2 (suite) : l\'application historique s\'exécute à travers la chaîne existante avec observation + univers du contexte (le contexte reste pur ; l\'écriture est celle d\'executerApplicationSollicitee)', async () => {
  const c = await chaine();
  await c.w.tour('plus tard');
  const l = await c.w.lire();
  const r = contexte(c.Y.observation.id, l);
  const application = applicationsSollicitables(r.observation).applications.find((a) => a.operation === 'projeterChemins' && a.liaisons.length === 1 && a.liaisons[0].donnee === c.P.execution.id);
  assert.ok(application, 'application projeterChemins(P) disponible dans O(Y)');
  const avant = await tables(c.w);
  const execution = await executerApplicationSollicitee({ observation: r.observation, application, univers: r.univers }, { magasin: c.w.magasin, table: TABLE_OPERATIONS });
  assert.equal(execution.statut, 'executee', execution.erreur && execution.erreur.message);
  assert.notEqual(await tables(c.w), avant, 'l\'exécution écrit ses lignes (désignation + exécution), pas le contexte');
  const designations = await c.w.magasin.lireTout('designations');
  assert.equal(designations.filter((d) => d.idObservation === c.Y.observation.id).length, 1, 'la désignation est honnêtement rattachée à O(Y)');
  assert.deepEqual(execution.execution.resultat, c.H.execution.resultat, 'même résultat que l\'exécution d\'origine de la même application');
});

// ============================================================================ G. TEST CENTRAL 3 — DÉRIVE DE CATALOGUE
test('G1. CENTRAL 3 : retrait de resoudreElements (dérive déjà mesurée) -> REFUS ; le catalogue d\'origine rend le contexte', async () => {
  const c = await chaine();
  await c.w.tour('suivant');
  const l = await c.w.lire();
  contexte(c.Y.observation.id, l); // le catalogue d'origine est fidèle
  const derive = DESCRIPTIONS_OPERATIONS.filter((d) => d.nom !== 'resoudreElements');
  assert.equal(derive.length, DESCRIPTIONS_OPERATIONS.length - 1);
  refuse(() => contexte(c.Y.observation.id, l, derive));
});
test('G2. dérive de FORME avec les mêmes noms : modifier la sortie de elementsObservables change les formes de l\'univers et les possibilités : REFUS', async () => {
  const c = await chaine();
  const l = await c.w.lire();
  const derive = DESCRIPTIONS_OPERATIONS.map((d) => (d.nom === 'symbolesDeChaine' ? { ...d, sortie: { forme: 'scalaire', genre: 'nombre' } } : d));
  assert.equal(derive.length, DESCRIPTIONS_OPERATIONS.length);
  refuse(() => contexte(c.Y.observation.id, l, derive));
});
test('G3. une observation d\'une autre époque (avant l\'existence de Q) reste fidèle avec le catalogue d\'origine : la dérive est celle du CATALOGUE, jamais celle des données ultérieures', async () => {
  const c = await chaine();
  await c.w.tour('suivant');
  const l = await c.w.lire();
  const ancienne = c.A.t.observation; // observation du tour A : seulement le message A, aucune production
  const r = contexte(ancienne.id, l);
  assert.deepEqual(r.univers.map((e) => e.donnee.identite), ancienne.donneesExaminees);
  assert.equal(r.univers.length, 1);
});

// ============================================================================ H. TEST CENTRAL 4 — PAS DE POLLUTION
test('H1. CENTRAL 4 : résoudre O(Y) n\'écrit rien (aucune table ne change)', async () => {
  const c = await chaine();
  const avant = await tables(c.w);
  const l = await c.w.lire();
  contexte(c.Y.observation.id, l);
  contexte(c.Y.observation.id, l);
  assert.equal(await tables(c.w), avant);
});
test('H2. CENTRAL 4 : deux mondes identiques, l\'un avec résolution entre les tours, l\'autre sans : mêmes donneesExaminees, mêmes possibilités, aucune désignation ni exécution de plus, aucun ancien message dans le snapshot', async () => {
  const sans = await chaine();
  const avec = await chaine();
  const l = await avec.w.lire();
  const r = contexte(avec.Y.observation.id, l);
  assert.ok(r.univers.length > 0);
  const ts = await sans.w.tour('après'); const ta = await avec.w.tour('après');
  const gabarit = (o) => ({ donnees: o.donneesExaminees.length, operations: o.operationsExaminees, possibilites: o.possibilites.map((p) => `${p.operation}.${p.entree}`).sort() });
  assert.deepEqual(gabarit(ta.observation), gabarit(ts.observation));
  assert.equal((await avec.w.magasin.lireTout('designations')).length, (await sans.w.magasin.lireTout('designations')).length);
  assert.equal((await avec.w.magasin.lireTout('executionsOperations')).length, (await sans.w.magasin.lireTout('executionsOperations')).length);
  assert.equal((await avec.w.magasin.lireTout('observationsPossibilites')).length, (await sans.w.magasin.lireTout('observationsPossibilites')).length);
  assert.equal(ta.observation.donneesExaminees.includes(avec.A.t.message.id), false, 'ancien message absent du snapshot courant');
  assert.equal(ta.observation.donneesExaminees.includes(avec.Y.message.id), false, 'Y historique absent du snapshot courant');
  assert.equal(ta.univers.some((e) => e.donnee.identite === avec.Y.message.id), false);
});
test('H3. AUCUNE MUTATION : entrées gelées en profondeur acceptées ; la ligne rendue reste la ligne gelée ; déterminisme (deux appels, mêmes sorties profondément égales)', async () => {
  const c = await chaine();
  const l = await c.w.lire();
  const gele = { observations: gelProfond(clone(l.observations)), valeurs: gelProfond(clone(l.valeurs)), executions: gelProfond(clone(l.executions)) };
  const a = contexte(c.Y.observation.id, gele);
  const b = contexte(c.Y.observation.id, gele);
  assert.equal(a.observation, b.observation);
  assert.deepEqual(a, b);
  assert.notEqual(a.univers, b.univers);
  assert.notEqual(a.univers[0], b.univers[0]);
  assert.equal(Object.isFrozen(a.univers), false, 'le tableau rendu est neuf et à l\'appelant');
});

// ============================================================================ I. DORMANCE ET PÉRIMÈTRE
test('I1. DORMANCE : aucun fichier de app/ ne nomme le module ni la fonction en dehors de lui-même ; ni catalogue, ni table d\'opérations', () => {
  const sources = [];
  const parcourir = (dossier) => {
    for (const nom of readdirSync(dossier)) {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.(m?js|html)$/.test(nom)) sources.push(chemin);
    }
  };
  parcourir(join(RACINE, 'app'));
  const nommants = sources.filter((f) => /contexte-observation|resoudreContexteObservation/.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f).split('\\').join('/'));
  assert.deepEqual(nommants, ['app/langage/contexte-observation.js']);
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => d.nom === 'resoudreContexteObservation'), false);
  assert.equal(Object.keys(TABLE_OPERATIONS).includes('resoudreContexteObservation'), false);
});
test('I2. IMPORTS : exactement resoudre-identites.js et possibilites-liaison.js ; ni magasin, ni horloge, ni hasard, ni génération d\'identité', () => {
  const imports = [...CODE.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./possibilites-liaison.js', './resoudre-identites.js']);
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.']) {
    assert.equal(CODE.includes(interdit), false, `« ${interdit} » ne doit pas figurer dans le code`);
  }
});
test('I3. AUCUN TERME DU DOMAINE ni sélection implicite : ni RC, condition, issue, paire, attente, expérience, ni dernier/premier/pertinent', () => {
  for (const terme of ['RC', 'condition', 'issue', 'paire', 'attente', 'experience', 'expérience', 'derniere', 'dernière', 'premiere', 'première', 'pertinent', 'candidate', 'choisir', 'sort(']) {
    assert.equal(CODE.includes(terme), false, `« ${terme} » ne doit pas figurer dans le code`);
  }
});
test('I4. versions et schéma inchangés : VERSION_BASE 19, SCHEMA 9, 22 tables, aucune table nouvelle', () => {
  assert.equal(VERSION_BASE, 19);
  assert.equal(SCHEMA_SAUVEGARDE, 9);
  assert.equal(TABLES.length, 22);
});
