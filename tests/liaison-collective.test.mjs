// === DEBUT_TEST_LIAISON_COLLECTIVE ===
// v0.63.39 — LIAISON COLLECTIVE MINIMALE (décision ChatGPT, 05/10/2026). Mécanisme général et DORMANT : le fait `collectif: true` sur l'UNIQUE
// entrée d'une opération. L'entrée reçoit l'ENSEMBLE COMPLET des données dont la forme garantit la forme de `valeur`, sous forme de
// collection d'éléments { identite, valeur } triés par identité ; la liaison persistée est { entree, donnees:[ids] } ; la désignation
// exige l'ensemble EXACT. Aucune opération réelle du catalogue n'est collective : tout est prouvé ici avec des descripteurs de PAPIER.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { applicationUnique } from '../app/langage/application-unique.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { resoudreValeursApplication } from '../app/langage/valeurs-application.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { invoquerOperation } from '../app/langage/invocation-operations.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { magasinMemoireVive, enregistrerDesignation, enregistrerExecutionOperation, enregistrerObservationPossibilites } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)), String(f));
const SC = (genre) => (genre === undefined ? { forme: 'scalaire' } : { forme: 'scalaire', genre });
const COLL_CHAINES = { forme: 'collection', elements: SC('chaine') };

// Descripteur de PAPIER : entrée collective unique, valeur = collection de chaînes.
const elementsPapier = (valeur = COLL_CHAINES, identite = SC('chaine')) => ({ forme: 'objet', champs: { identite, valeur } });
const entreeCollective = (extra = {}, valeur) => ({ forme: 'collection', collectif: true, elements: elementsPapier(valeur), ...extra });
const PAPIER = Object.freeze({ nom: 'rassembler', entrees: { elements: entreeCollective() }, sortie: SC('chaine') });
const ORDINAIRE = Object.freeze({ nom: 'ordinaire', entrees: { x: COLL_CHAINES }, sortie: SC('nombre') });
const CATALOGUE = [ORDINAIRE, PAPIER];

// Données de papier : A, B, C (collections de chaînes, compatibles) ; T (chaîne, incompatible).
const donnee = (identite, forme) => ({ identite, forme });
const A = donnee('execution-A', COLL_CHAINES);
const B = donnee('execution-B', COLL_CHAINES);
const C = donnee('execution-C', COLL_CHAINES);
const T = donnee('message-T', SC('chaine'));
const VALEURS = { 'execution-A': ['b', 'o'], 'execution-B': ['s', 'a'], 'execution-C': [], 'message-T': 'texte' };
const univers = (donnees) => donnees.map((d) => ({ donnee: d, porteur: { id: d.identite, valeur: VALEURS[d.identite] }, acces: { champ: 'valeur' } }));
const idsDe = (atomes, operation = 'rassembler') => atomes.filter((a) => a.operation === operation).map((a) => a.donnee);
const TABLE_PAPIER = Object.freeze({
  rassembler: Object.freeze({ fonction: (elements) => elements.map((e) => `${e.identite}=${JSON.stringify(e.valeur)}`).join(';'), appel: 'positionnel', parametres: Object.freeze(['elements']) }),
  ordinaire: Object.freeze({ fonction: (x) => x.length, appel: 'positionnel', parametres: Object.freeze(['x']) }),
});

// ============================================================================ A. CONTRAT DU DESCRIPTEUR
test('A1. un descripteur collectif bien formé est accepté ; le fait est conservé tel quel ; collectif:false = entrée ordinaire', () => {
  const v = valider(PAPIER);
  assert.equal(v.entrees.elements.collectif, true);
  assert.deepEqual(v.entrees.elements.elements, elementsPapier());
  assert.equal(valider({ nom: 'o', entrees: { x: { ...COLL_CHAINES, collectif: false } }, sortie: SC() }).entrees.x.collectif, false);
  const quelconque = valider({ nom: 'q', entrees: { e: entreeCollective({}, { forme: 'quelconque' }) }, sortie: SC() });
  assert.equal(quelconque.entrees.e.collectif, true);
});
test('A2. collectif MAL FORMÉ refusé (aucune réparation) : plusieurs entrées, forme, éléments, champs, genre, faits, imbrication, sortie', () => {
  const d = (entrees, sortie = SC()) => ({ nom: 'p', entrees, sortie });
  refuse(() => valider(d({ elements: entreeCollective(), autre: SC('chaine') })), /UNIQUE entrée/);
  refuse(() => valider(d({ elements: { forme: 'scalaire', collectif: true } })), /collection/);
  refuse(() => valider(d({ elements: { forme: 'collection', collectif: true } })), /collection/);
  refuse(() => valider(d({ elements: { forme: 'collection', collectif: true, elements: SC('chaine') } })), /objets/);
  refuse(() => valider(d({ elements: { forme: 'collection', collectif: true, elements: { forme: 'objet' } } })), /objets/);
  refuse(() => valider(d({ elements: { forme: 'collection', collectif: true, elements: { forme: 'objet', champs: { identite: SC('chaine') } } } })), /exactement/);
  refuse(() => valider(d({ elements: { forme: 'collection', collectif: true, elements: { forme: 'objet', champs: { identite: SC('chaine'), valeur: SC(), extra: SC() } } } })), /exactement/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), elements: { forme: 'objet', champs: { id: SC('chaine'), valeur: SC() } } } })), /exactement/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), elements: elementsPapier(COLL_CHAINES, SC('nombre')) } })), /identite/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), elements: elementsPapier(COLL_CHAINES, { forme: 'scalaire' }) } })), /identite/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), omissible: true } })), /omissible/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), peutEtreNull: true } })), /omissible/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), elements: elementsPapier({ ...COLL_CHAINES, peutEtreNull: true }) } })), /fait/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), elements: elementsPapier({ ...COLL_CHAINES, omissible: true }) } })), /fait/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), elements: elementsPapier(COLL_CHAINES, { ...SC('chaine'), omissible: true }) } })), /fait/);
  refuse(() => valider(d({ elements: { ...entreeCollective(), collectif: 'oui' } })), /booléen/);
  refuse(() => valider(d({ elements: entreeCollective({}, { ...COLL_CHAINES, collectif: true }) })), /fait/);
  refuse(() => valider(d({ x: { forme: 'objet', champs: { c: { ...COLL_CHAINES, collectif: true } } } })), /racine/);
  refuse(() => valider(d({ x: { forme: 'collection', elements: { forme: 'objet', champs: { c: { ...SC('chaine'), collectif: true } } } } })), /racine/);
  refuse(() => valider(d({ elements: entreeCollective() }, { forme: 'objet', champs: { c: { ...SC('chaine'), collectif: true } } })), /collectif/);
  refuse(() => valider(d({ x: SC('chaine') }, { ...SC(), collectif: true })), /collectif/);
});

// ============================================================================ B. POSSIBILITÉS ET GROUPES
test('B1. une SEULE donnée compatible : un atome ordinaire { donnee, operation, entree } ; l\'incompatible n\'en produit pas', () => {
  const atomes = possibilitesDeLiaison([A, T], CATALOGUE);
  assert.deepEqual(atomes.filter((a) => a.operation === 'rassembler'), [{ donnee: 'execution-A', operation: 'rassembler', entree: 'elements' }]);
  assert.deepEqual(Object.keys(atomes[0]), ['donnee', 'operation', 'entree']);
});
test('B2. PLUSIEURS compatibles : un atome par donnée compatible, aucune omise ; ordre déterministe indépendant de l\'ordre d\'arrivée', () => {
  const tous = [C, T, A, B];
  const ref = possibilitesDeLiaison(tous, CATALOGUE);
  assert.deepEqual(idsDe(ref), ['execution-A', 'execution-B', 'execution-C']);
  for (const permutation of [[A, B, C, T], [T, C, B, A], [B, T, A, C]]) assert.deepEqual(possibilitesDeLiaison(permutation, CATALOGUE), ref);
});
test('B3. ZÉRO compatible : aucun atome, aucun groupe, aucune application (opération NON APPLICABLE, jamais une collection vide)', () => {
  const atomes = possibilitesDeLiaison([T], CATALOGUE);
  assert.deepEqual(idsDe(atomes), []);
  const groupes = groupesDeCandidats(atomes, CATALOGUE);
  assert.equal(groupes.some((g) => g.operation === 'rassembler'), false);
  assert.deepEqual(applicationUnique(groupes), { etat: 'aucune', application: null });
  assert.deepEqual(applicationsSollicitables({ id: 'obs', possibilites: atomes }, CATALOGUE), { applications: [], choixAFaire: [] });
  assert.deepEqual(applicationsSollicitables({ id: 'obs', possibilites: [] }, CATALOGUE), { applications: [], choixAFaire: [] });
});
test('B4. groupesDeCandidats : l\'entrée collective porte `collectif: true` et TOUTES les données ; l\'entrée ordinaire garde sa forme exacte (sans la clé)', () => {
  const groupes = groupesDeCandidats(possibilitesDeLiaison([A, B, C], CATALOGUE), CATALOGUE);
  assert.deepEqual(groupes, [
    { operation: 'ordinaire', entrees: [{ entree: 'x', donnees: ['execution-A', 'execution-B', 'execution-C'] }] },
    { operation: 'rassembler', entrees: [{ entree: 'elements', donnees: ['execution-A', 'execution-B', 'execution-C'], collectif: true }] },
  ]);
  assert.equal('collectif' in groupes[0].entrees[0], false);
});

// ============================================================================ C. APPLICATION UNIQUE / SOLLICITABLES
test('C1. une entrée collective est TOUJOURS déterminée : une ou plusieurs données donnent une application { entree, donnees:[ids triés] } et jamais « choix à faire »', () => {
  for (const donnees of [[A], [A, B, C], [C, A, B]]) {
    const obs = { id: 'obs', possibilites: possibilitesDeLiaison(donnees, [PAPIER]) };
    const r = applicationsSollicitables(obs, [PAPIER]);
    const ids = donnees.map((d) => d.identite).sort();
    assert.deepEqual(r, { applications: [{ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ids }] }], choixAFaire: [] });
    assert.deepEqual(applicationUnique(groupesDeCandidats(obs.possibilites, [PAPIER])), { etat: 'unique', application: { operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ids }] } });
  }
});
test('C2. coexistence avec une opération ordinaire à candidats multiples : l\'ordinaire reste « choix à faire », la collective est proposée', () => {
  const obs = { id: 'obs', possibilites: possibilitesDeLiaison([A, B], CATALOGUE) };
  const r = applicationsSollicitables(obs, CATALOGUE);
  assert.deepEqual(r.choixAFaire, ['ordinaire']);
  assert.deepEqual(r.applications.map((a) => a.operation), ['rassembler']);
  assert.deepEqual(applicationUnique(groupesDeCandidats(obs.possibilites, CATALOGUE)), { etat: 'plusieurs', application: null });
});
test('C3. applicationUnique refuse un groupe collectif mal formé (collectif:false, non booléen, parmi plusieurs entrées)', () => {
  const g = (entrees) => [{ operation: 'x', entrees }];
  refuse(() => applicationUnique(g([{ entree: 'e', donnees: ['a'], collectif: false }])), /true/);
  refuse(() => applicationUnique(g([{ entree: 'e', donnees: ['a'], collectif: 1 }])), /true/);
  refuse(() => applicationUnique(g([{ entree: 'e', donnees: ['a'], collectif: true }, { entree: 'f', donnees: ['a'] }])), /unique entrée/);
  assert.deepEqual(applicationUnique(g([{ entree: 'e', donnees: ['b', 'a'], collectif: true }])), { etat: 'unique', application: { operation: 'x', liaisons: [{ entree: 'e', donnees: ['a', 'b'] }] } });
});

// ============================================================================ D. RÉSOLUTION
test('D1. résolution : [{ identite, valeur }] triés par identité ; identités et valeurs EXACTES (même référence de valeur) ; ordre des ids fournis sans effet', () => {
  const u = univers([C, T, A, B]);
  const r = resoudreValeursApplication({ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['execution-C', 'execution-A', 'execution-B'] }] }, u);
  assert.deepEqual(r, { operation: 'rassembler', valeurs: { elements: [
    { identite: 'execution-A', valeur: ['b', 'o'] }, { identite: 'execution-B', valeur: ['s', 'a'] }, { identite: 'execution-C', valeur: [] },
  ] } });
  assert.equal(r.valeurs.elements[0].valeur, VALEURS['execution-A']);
  assert.deepEqual(Object.keys(r.valeurs.elements[0]), ['identite', 'valeur']);
});
test('D2. résolution : donnée absente de l\'univers, doublon, tableau vide, forme mêlée → TypeError ; l\'ancienne liaison { entree, donnee } est inchangée', () => {
  const u = univers([A, B]);
  refuse(() => resoudreValeursApplication({ operation: 'o', liaisons: [{ entree: 'e', donnees: ['execution-A', 'execution-Z'] }] }, u), /absente/);
  refuse(() => resoudreValeursApplication({ operation: 'o', liaisons: [{ entree: 'e', donnees: ['execution-A', 'execution-A'] }] }, u), /répète/);
  refuse(() => resoudreValeursApplication({ operation: 'o', liaisons: [{ entree: 'e', donnees: [] }] }, u), /non vide/);
  refuse(() => resoudreValeursApplication({ operation: 'o', liaisons: [{ entree: 'e', donnees: ['execution-A'], donnee: 'execution-A' }] }, u), /étranger/);
  refuse(() => resoudreValeursApplication({ operation: 'o', liaisons: [{ entree: 'e', donnees: 'execution-A' }] }, u), /tableau/);
  assert.deepEqual(resoudreValeursApplication({ operation: 'ordinaire', liaisons: [{ entree: 'x', donnee: 'execution-B' }] }, u), { operation: 'ordinaire', valeurs: { x: ['s', 'a'] } });
});

// ============================================================================ E. DÉSIGNATION ET EXÉCUTION (persistance)
const observation = (donnees, catalogue = CATALOGUE) => ({ id: 'obs-1', possibilites: possibilitesDeLiaison(donnees, catalogue) });
const designer = (magasin, obs, liaisons, operation = 'rassembler') => enregistrerDesignation(magasin, { observation: obs, application: { operation, liaisons }, origine: 'exterieure' });
test('E1. désignation : l\'ENSEMBLE EXACT est accepté ; les identités sont conservées et triées dans la ligne persistée', async () => {
  const m = magasinMemoireVive();
  const ligne = await designer(m, observation([A, B, C, T]), [{ entree: 'elements', donnees: ['execution-C', 'execution-A', 'execution-B'] }]);
  assert.deepEqual(ligne.liaisons, [{ entree: 'elements', donnees: ['execution-A', 'execution-B', 'execution-C'] }]);
  assert.deepEqual((await m.lireTout('designations'))[0].liaisons, ligne.liaisons);
});
test('E2. désignation : SOUS-ENSEMBLE refusé, donnée incompatible injectée refusée, donnée inconnue refusée, doublon refusé, vide refusé, formes mêlées refusées — aucune ligne écrite', async () => {
  const m = magasinMemoireVive();
  const obs = observation([A, B, C, T]);
  const essai = (donnees, motif) => assert.rejects(designer(m, obs, [{ entree: 'elements', donnees }]), (e) => e instanceof TypeError && motif.test(e.message));
  await essai(['execution-A', 'execution-B'], /ensemble exact/);
  await essai(['execution-A'], /ensemble exact/);
  await essai(['execution-A', 'execution-B', 'execution-C', 'message-T'], /ensemble exact/);
  await essai(['execution-A', 'execution-B', 'execution-Z'], /ensemble exact/);
  await essai(['execution-A', 'execution-A', 'execution-B', 'execution-C'], /dupliquée/);
  await essai([], /au moins une/);
  await assert.rejects(designer(m, obs, [{ entree: 'elements', donnees: ['execution-A', 'execution-B', 'execution-C'], donnee: 'execution-A' }]), /étranger/);
  assert.deepEqual(await m.lireTout('designations'), []);
});
test('E3. désignation : l\'ancien format { entree, donnee } reste accepté et inchangé (même résultat qu\'avant)', async () => {
  const m = magasinMemoireVive();
  const ligne = await designer(m, observation([A, B, T]), [{ entree: 'x', donnee: 'execution-A' }], 'ordinaire');
  assert.deepEqual(ligne.liaisons, [{ entree: 'x', donnee: 'execution-A' }]);
  assert.equal('donnees' in ligne.liaisons[0], false);
  await assert.rejects(designer(m, observation([A, B, T]), [{ entree: 'x', donnee: 'message-T' }], 'ordinaire'), TypeError);
});
test('E4. chaîne COMPLÈTE de papier : désignation → résolution → invocation → exécution ; la ligne d\'exécution porte la liaison collective exacte, le résultat est celui de l\'opération', async () => {
  const m = magasinMemoireVive();
  const obs = observation([A, B, C, T]);
  const [app] = applicationsSollicitables(obs, CATALOGUE).applications;
  assert.deepEqual(app, { operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['execution-A', 'execution-B', 'execution-C'] }] });
  const r = await executerApplicationSollicitee({ observation: obs, application: app, univers: univers([A, B, C, T]) }, { magasin: m, table: TABLE_PAPIER, descriptions: CATALOGUE });
  assert.equal(r.statut, 'executee');
  assert.deepEqual(r.designation.liaisons, app.liaisons);
  assert.deepEqual(r.execution.liaisons, app.liaisons);
  assert.equal(r.execution.idDesignation, r.designation.id);
  assert.equal(r.execution.resultat, 'execution-A=["b","o"];execution-B=["s","a"];execution-C=[]');
});
test('E5. exécution : sous-ensemble refusé dès la désignation (aucune exécution) ; une ligne d\'exécution qui diffère de sa désignation est refusée (collective ou ordinaire)', async () => {
  const m = magasinMemoireVive();
  const obs = observation([A, B, C]);
  const r = await executerApplicationSollicitee({ observation: obs, application: { operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['execution-A'] }] }, univers: univers([A, B, C]) }, { magasin: m, table: TABLE_PAPIER, descriptions: CATALOGUE });
  assert.equal(r.statut, 'echec_designation');
  assert.deepEqual(await m.lireTout('executionsOperations'), []);
  const desig = await designer(m, obs, [{ entree: 'elements', donnees: ['execution-A', 'execution-B', 'execution-C'] }]);
  const exec = (liaisons) => enregistrerExecutionOperation(m, { designation: desig, operation: 'rassembler', liaisons, resultat: 'r' });
  await assert.rejects(exec([{ entree: 'elements', donnees: ['execution-A', 'execution-B'] }]), TypeError);
  await assert.rejects(exec([{ entree: 'elements', donnee: 'execution-A' }]), TypeError);
  await assert.rejects(exec([{ entree: 'elements', donnees: ['execution-A', 'execution-A', 'execution-B'] }]), /dupliquée/);
  const ok = await exec([{ entree: 'elements', donnees: ['execution-C', 'execution-B', 'execution-A'] }]);
  assert.deepEqual(ok.liaisons, [{ entree: 'elements', donnees: ['execution-A', 'execution-B', 'execution-C'] }]);
});
test('E6. ANCIENNES lignes : une exécution ordinaire { entree, donnee } est toujours écrite, lue, et reste une production décrite ; les deux formats coexistent dans la même table', async () => {
  const m = magasinMemoireVive();
  const obs = observation([A, B]);
  const desigOrdinaire = await designer(m, obs, [{ entree: 'x', donnee: 'execution-A' }], 'ordinaire');
  const x1 = await enregistrerExecutionOperation(m, { designation: desigOrdinaire, operation: 'ordinaire', liaisons: [{ entree: 'x', donnee: 'execution-A' }], resultat: 2 });
  const desigCollective = await designer(m, obs, [{ entree: 'elements', donnees: ['execution-A', 'execution-B'] }]);
  const x2 = await enregistrerExecutionOperation(m, { designation: desigCollective, operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['execution-A', 'execution-B'] }], resultat: 's' });
  const lignes = await m.lireTout('executionsOperations');
  assert.deepEqual(lignes.map((l) => l.id).sort(), [x1.id, x2.id].sort());
  assert.deepEqual(lignes.find((l) => l.id === x1.id).liaisons, [{ entree: 'x', donnee: 'execution-A' }]);
});

// ============================================================================ F. PREUVE « COLLECTIF ≠ CHOIX »
test('F1. l\'ensemble est une FONCTION du catalogue et de l\'univers seuls : permutations, ajout d\'une donnée compatible (elle entre), ajout d\'une incompatible (sans effet) ; aucune donnée compatible n\'est jamais omise', () => {
  const D = donnee('execution-D', COLL_CHAINES);
  const base = idsDe(possibilitesDeLiaison([A, B], [PAPIER]));
  assert.deepEqual(base, ['execution-A', 'execution-B']);
  assert.deepEqual(idsDe(possibilitesDeLiaison([A, B, D], [PAPIER])), ['execution-A', 'execution-B', 'execution-D']);
  assert.deepEqual(idsDe(possibilitesDeLiaison([A, B, T], [PAPIER])), base);
  for (let tour = 0; tour < 30; tour += 1) {
    const melange = [A, B, C, D, T].map((d) => [Math.sin(tour * 7 + d.identite.length * 3 + d.identite.charCodeAt(10)), d]).sort((x, y) => x[0] - y[0]).map(([, d]) => d);
    const obs = { id: 'o', possibilites: possibilitesDeLiaison(melange, [PAPIER]) };
    assert.deepEqual(applicationsSollicitables(obs, [PAPIER]).applications, [{ operation: 'rassembler', liaisons: [{ entree: 'elements', donnees: ['execution-A', 'execution-B', 'execution-C', 'execution-D'] }] }]);
  }
});
test('F2. valeur `quelconque` : l\'entrée collective prend TOUT l\'univers (limite assumée, documentée) ; aucune sélection par le mécanisme', () => {
  const tout = { nom: 'tout', entrees: { e: entreeCollective({}, { forme: 'quelconque' }) }, sortie: SC() };
  assert.deepEqual(idsDe(possibilitesDeLiaison([A, T, B], [tout]), 'tout'), ['execution-A', 'execution-B', 'message-T']);
});

// ============================================================================ G. INVARIANTS DU PRODUIT
test('G1. MISE À JOUR DÉLIBÉRÉE v0.63.41 : le catalogue RÉEL a EXACTEMENT UNE entrée collective (elementsObservables.elements, première opération collective réelle) ; la table réelle ne connaît pas le fait ; aucune écriture du fait ailleurs dans le produit', () => {
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
  const collectives = [];
  for (const d of DESCRIPTIONS_OPERATIONS) for (const [nom, e] of Object.entries(d.entrees)) if ('collectif' in e) { assert.equal(e.collectif, true); collectives.push(`${d.nom}.${nom}`); }
  assert.deepEqual(collectives, ['elementsObservables.elements']);
  const code = (f) => readFileSync(join(RACINE, 'app', 'langage', f), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal((code('descriptions-operations.js').match(/collectif/g) || []).length, 1);
  assert.equal(/collectif/.test(code('table-operations.js')), false);
  assert.equal(/collectif/.test(code('elements-observables.js')), false);
});
test('G2. opérations ORDINAIRES inchangées : mêmes atomes, mêmes groupes (sans clé `collectif`), mêmes applications qu\'avant sur le catalogue réel', () => {
  const m = identifierMessage('bonjour Pixel', { nouvelId: (p) => `${p}-1` });
  const atomes = [{ donnee: m.id, operation: 'parcourirStructure', entree: 'valeur' }, { donnee: m.id, operation: 'symbolesDeChaine', entree: 'chaine' }];
  assert.deepEqual(possibilitesDeLiaison([{ identite: m.id, forme: SC('chaine') }], DESCRIPTIONS_OPERATIONS), atomes);
  const groupes = groupesDeCandidats(atomes, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(groupes, [
    { operation: 'parcourirStructure', entrees: [{ entree: 'valeur', donnees: [m.id] }] },
    { operation: 'symbolesDeChaine', entrees: [{ entree: 'chaine', donnees: [m.id] }] },
  ]);
  assert.deepEqual(applicationsSollicitables({ id: 'o', possibilites: atomes }), { applications: [
    { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: m.id }] },
    { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: m.id }] },
  ], choixAFaire: [] });
});
test('G3. observations inchangées : observerPossibilites écrit la même ligne (mêmes clés, mêmes atomes) ; le message seul donne les deux mêmes atomes ordinaires', async () => {
  const m = magasinMemoireVive();
  const message = identifierMessage('bonjour Pixel', { nouvelId: (p) => `${p}-9` });
  const r = await observerPossibilites(message, { enregistrer: (d) => enregistrerObservationPossibilites(m, d), lireExecutions: () => m.lireTout('executionsOperations') });
  assert.equal(r.statut, 'ecrite');
  assert.deepEqual(r.observation.possibilites, [
    { donnee: message.id, operation: 'parcourirStructure', entree: 'valeur' },
    { donnee: message.id, operation: 'symbolesDeChaine', entree: 'chaine' },
  ]);
  assert.deepEqual(Object.keys(r.observation).sort(), ['donneesExaminees', 'horodatage', 'id', 'idMessage', 'operationsExaminees', 'possibilites']);
});
test('G4. l\'invocateur est INCHANGÉ : il reçoit la valeur déjà résolue (le tableau d\'éléments) comme n\'importe quelle valeur', () => {
  const source = readFileSync(join(RACINE, 'app', 'langage', 'invocation-operations.js'), 'utf8');
  assert.equal(/collectif|identite|donnees/.test(source.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), false);
  assert.equal(invoquerOperation(TABLE_PAPIER, 'rassembler', { elements: [{ identite: 'i', valeur: ['x'] }] }), 'i=["x"]');
});
// === FIN_TEST_LIAISON_COLLECTIVE ===
