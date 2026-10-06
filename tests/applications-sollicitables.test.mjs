// === DEBUT_TEST_APPLICATIONS_SOLLICITABLES ===
// v0.63.35 — OUTIL DE SOLLICITATION (décision ChatGPT, 05/10/2026), partie PURE : applicationsSollicitables (applications DÉTERMINÉES d'une
// observation, produit cartésien jamais matérialisé) et suivreObservationDuTour (contexte exact d'un tour, en mémoire, propre à chaque tour).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as moduleApps from '../app/langage/applications-sollicitables.js';
import * as moduleCtx from '../app/langage/contexte-sollicitation.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { magasinMemoireVive, enregistrerObservationPossibilites } from '../app/langage/connaissances.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { identifierMessage } from '../app/langage/pont.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE_APPS = sansCommentaires(lu('app', 'langage', 'applications-sollicitables.js'));
const CODE_CTX = sansCommentaires(lu('app', 'langage', 'contexte-sollicitation.js'));

const obs = (possibilites, id = 'obs-1') => ({ id, possibilites });
const atome = (donnee, operation, entree) => ({ donnee, operation, entree });
async function tourReel(magasin, texte, n) {
  let k = n * 100;
  const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
  const retour = await observerPossibilites(message, {
    enregistrer: (d) => enregistrerObservationPossibilites(magasin, d),
    lireExecutions: () => magasin.lireTout('executionsOperations'),
  });
  assert.equal(retour.statut, 'ecrite');
  return { message, retour, observation: retour.observation, univers: retour.univers };
}

test('A1. exports exacts : une seule fonction par module, synchrone', () => {
  assert.deepEqual(Object.keys(moduleApps), ['applicationsSollicitables']);
  assert.deepEqual(Object.keys(moduleCtx), ['suivreObservationDuTour']);
  assert.equal(applicationsSollicitables.constructor.name, 'Function');
  assert.equal(suivreObservationDuTour.constructor.name, 'Function');
});
test('B1. CAS « bonjour Pixel » : DEUX applications déterminées sur le message (parcourirStructure, symbolesDeChaine), aucun choix à faire', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38 : symbolesDeChaine est décrite ; les deux sont présentées, aucune n'est préférée
  const m = magasinMemoireVive();
  const t = await tourReel(m, 'bonjour Pixel', 1);
  const r = applicationsSollicitables(t.observation);
  assert.deepEqual(r, { applications: [
    { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: t.message.id }] },
    { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: t.message.id }] },
  ], choixAFaire: [] });
  assert.deepEqual(Object.keys(r), ['applications', 'choixAFaire']);
});
test('B2. TOUR SUIVANT après une exécution sollicitée : les productions apparaissent ; parcourirStructure a deux candidats → « choix à faire » ; symbolesDeChaine reste déterminée (seul le message est une chaîne), aucune application inventée', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38
  const m = magasinMemoireVive();
  const t1 = await tourReel(m, 'bonjour Pixel', 1);
  const [app1] = applicationsSollicitables(t1.observation).applications;
  const x = await executerApplicationSollicitee({ observation: t1.observation, application: app1, univers: t1.univers }, { magasin: m, table: TABLE_OPERATIONS });
  assert.equal(x.statut, 'executee');
  const t2 = await tourReel(m, 'salut Pixel', 2);
  assert.equal(t2.observation.possibilites.some((a) => a.donnee === x.execution.id), true, 'la production du tour 1 est dans les possibilités du tour 2');
  const r = applicationsSollicitables(t2.observation);
  // MISE À JOUR DÉLIBÉRÉE v0.63.45 : la production de parcourirStructure (éléments {chemin, type, valeur}) porte un `chemin` collection de scalaires : elle est l'UNIQUE candidate de projeterChemins.elements, qui devient donc une application déterminée (collision de forme acceptée, aucune sélection ajoutée). Aucune application n'est exécutée par cette garde.
  assert.deepEqual(r.applications, [{ operation: 'projeterChemins', liaisons: [{ entree: 'elements', donnee: x.execution.id }] }, { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: t2.message.id }] }]);
  assert.deepEqual(r.choixAFaire, ['parcourirStructure']);
});
test('C1. PRODUIT CARTÉSIEN : a = A1..A3, b = B1..B4 → aucune des 12 applications, aucun candidat choisi, « choix à faire » seulement', () => {
  const a = ['A1', 'A2', 'A3'].map((d) => atome(d, 'memesCouvertures', 'a'));
  const b = ['B1', 'B2', 'B3', 'B4'].map((d) => atome(d, 'memesCouvertures', 'b'));
  const r = applicationsSollicitables(obs([...a, ...b]));
  assert.deepEqual(r, { applications: [], choixAFaire: ['memesCouvertures'] });
  assert.equal(JSON.stringify(r).includes('A1'), false);
  assert.equal(JSON.stringify(r).includes('B1'), false);
});
test('C2. UNE entrée multiple suffit pour exclure l\'opération (a singleton, b à deux candidats)', () => {
  const r = applicationsSollicitables(obs([atome('A1', 'memesCouvertures', 'a'), atome('B1', 'memesCouvertures', 'b'), atome('B2', 'memesCouvertures', 'b')]));
  assert.deepEqual(r, { applications: [], choixAFaire: ['memesCouvertures'] });
});
test('D1. PLUSIEURS SINGLETONS : toutes présentées, ordre canonique de groupesDeCandidats, indépendant de l\'ordre d\'arrivée', () => {
  const liste = [
    atome('Y', 'partagerCouvertures', 'b'), atome('X', 'partagerCouvertures', 'a'),
    atome('Q', 'memesCouvertures', 'b'), atome('P', 'memesCouvertures', 'a'),
  ];
  const r1 = applicationsSollicitables(obs(liste));
  const r2 = applicationsSollicitables(obs([...liste].reverse()));
  assert.deepEqual(r1, r2);
  assert.deepEqual(r1, {
    applications: [
      { operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'P' }, { entree: 'b', donnee: 'Q' }] },
      { operation: 'partagerCouvertures', liaisons: [{ entree: 'a', donnee: 'X' }, { entree: 'b', donnee: 'Y' }] },
    ],
    choixAFaire: [],
  });
});
test('D2. MÉLANGE : les singletons sont présentés, les multiples seulement signalés, chacun dans son ordre canonique', () => {
  const r = applicationsSollicitables(obs([
    atome('P', 'memesCouvertures', 'a'), atome('Q', 'memesCouvertures', 'b'),
    atome('X1', 'partagerCouvertures', 'a'), atome('X2', 'partagerCouvertures', 'a'), atome('Y', 'partagerCouvertures', 'b'),
    atome('M', 'parcourirStructure', 'valeur'),
  ]));
  assert.deepEqual(r.applications.map((a) => a.operation), ['memesCouvertures', 'parcourirStructure']);
  assert.deepEqual(r.choixAFaire, ['partagerCouvertures']);
});
test('D3. OPÉRATION INCOMPLÈTE (une seule des deux entrées a un candidat) : absente, ni application ni « choix à faire »', () => {
  assert.deepEqual(applicationsSollicitables(obs([atome('A1', 'memesCouvertures', 'a')])), { applications: [], choixAFaire: [] });
  assert.deepEqual(applicationsSollicitables(obs([])), { applications: [], choixAFaire: [] });
});
test('D4. UNE MÊME DONNÉE dans deux entrées reste une application déterminée (une liaison par entrée)', () => {
  const r = applicationsSollicitables(obs([atome('D', 'memesCouvertures', 'a'), atome('D', 'memesCouvertures', 'b')]));
  assert.deepEqual(r.applications, [{ operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: 'D' }, { entree: 'b', donnee: 'D' }] }]);
});
test('E1. PURETÉ : l\'observation n\'est pas modifiée, la sortie est neuve à chaque appel, aucune référence partagée', () => {
  const o = obs([atome('P', 'memesCouvertures', 'a'), atome('Q', 'memesCouvertures', 'b')]);
  const avant = JSON.stringify(o);
  const r1 = applicationsSollicitables(o); const r2 = applicationsSollicitables(o);
  assert.equal(JSON.stringify(o), avant);
  assert.notEqual(r1, r2); assert.notEqual(r1.applications[0], r2.applications[0]); assert.notEqual(r1.applications[0].liaisons, r2.applications[0].liaisons);
  assert.deepEqual(r1, r2);
});
test('E2. ENTRÉE INVALIDE : TypeError, jamais ignorée', () => {
  for (const mauvais of [null, undefined, 'x', 3, [], { id: 'o' }, { possibilites: 'x' }, { possibilites: [null] }, { possibilites: [{ donnee: 'A', operation: 'inconnue', entree: 'a' }] }]) {
    assert.throws(() => applicationsSollicitables(mauvais), TypeError);
  }
  assert.throws(() => applicationsSollicitables({ get possibilites() { return []; } }), TypeError);
});
test('E3. CATALOGUE PRÉSENTÉ : le second paramètre est transmis ; par défaut DESCRIPTIONS_OPERATIONS (10)', () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 16); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
  assert.throws(() => applicationsSollicitables(obs([atome('M', 'parcourirStructure', 'valeur')]), []), TypeError);
  assert.equal(applicationsSollicitables(obs([atome('M', 'parcourirStructure', 'valeur')]), DESCRIPTIONS_OPERATIONS).applications.length, 1);
});
test('F1. STATIQUE : seul groupesDeCandidats et le catalogue sont importés ; aucun applicationUnique, aucune sélection [0], aucune boucle d\'essai, aucun état', () => {
  assert.deepEqual(CODE_APPS.match(/^import .*$/gm), [
    "import { groupesDeCandidats } from './groupes-candidats.js';",
    "import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';",
  ]);
  assert.equal(/applicationUnique|application-unique|\[0\]|\.find\(|\.sort\(|\.filter\(|break|Math\.|Date\b|await|async|magasin|localStorage|indexedDB|lireTout|ecrire|enregistrer|executer|invoquer|\btexte\b/.test(CODE_APPS), false);
  assert.equal(/\.length === 1/.test(CODE_APPS), true, 'la détermination est constatée par donnees.length === 1');
  assert.equal(/\blet\b/.test(CODE_APPS.replace(/const /g, '')), false, 'aucun état modifiable hors tableaux de sortie');
});

// ---------------------------------------------------------------------------------------------- suivreObservationDuTour
const retourEcrit = (n) => ({ statut: 'ecrite', observation: obs([atome(`M${n}`, 'parcourirStructure', 'valeur')], `obs-${n}`), univers: [{ donnee: { identite: `M${n}` }, porteur: { n }, acces: {} }] });

test('G1. CAPTURE EXACTE : le retour de l\'observateur est rendu tel quel (même référence) ; la paire est jointe avec les MÊMES références', async () => {
  const retour = retourEcrit(1);
  const suivi = suivreObservationDuTour(async () => retour);
  const rendu = await suivi.observer({ id: 'm' });
  assert.equal(rendu, retour);
  const resultat = { texte: 'ok' };
  const j = suivi.joindre(resultat);
  assert.notEqual(j, resultat);
  assert.equal(j.texte, 'ok');
  assert.equal(j.sollicitation.observation, retour.observation);
  assert.equal(j.sollicitation.univers, retour.univers);
  assert.deepEqual(j.sollicitation.applications, [{ operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'M1' }] }]);
  assert.deepEqual(j.sollicitation.choixAFaire, []);
  assert.deepEqual(Object.keys(j.sollicitation), ['observation', 'univers', 'applications', 'choixAFaire']);
  assert.equal('sollicitation' in resultat, false, 'le résultat d\'origine n\'est pas modifié');
});
test('G2. CONTEXTES CROISÉS : deux tours, deux fermetures ; le contexte du tour 1 reste exactement C1 après le tour 2', async () => {
  const r1 = retourEcrit(1); const r2 = retourEcrit(2);
  const s1 = suivreObservationDuTour(async () => r1);
  const s2 = suivreObservationDuTour(async () => r2);
  await s1.observer({}); const j1 = s1.joindre({ texte: 'un' });
  await s2.observer({}); const j2 = s2.joindre({ texte: 'deux' });
  assert.equal(j1.sollicitation.observation, r1.observation); assert.equal(j1.sollicitation.univers, r1.univers);
  assert.equal(j2.sollicitation.observation, r2.observation); assert.equal(j2.sollicitation.univers, r2.univers);
  const j1bis = s1.joindre({ texte: 'un-bis' });
  assert.equal(j1bis.sollicitation.observation, r1.observation, 'jamais « le dernier contexte »');
});
test('G3. AUCUN CONTEXTE si l\'observation n\'est pas écrite (tout autre statut, retour non objet) : le résultat est rendu inchangé (même référence)', async () => {
  for (const retour of [{ statut: 'echec_lecture', observation: null, univers: null }, { statut: 'sans_message', observation: null, univers: null }, { statut: 'ecrite', observation: null, univers: [] }, { statut: 'ecrite', observation: {}, univers: null }, null, undefined, 'x']) {
    const suivi = suivreObservationDuTour(async () => retour);
    const rendu = await suivi.observer({});
    assert.equal(rendu, retour);
    const resultat = { texte: 'ok' };
    assert.equal(suivi.joindre(resultat), resultat);
  }
  const suivi = suivreObservationDuTour(async () => retourEcrit(1));
  const sansAppel = { texte: 'ok' };
  assert.equal(suivi.joindre(sansAppel), sansAppel, 'observateur jamais appelé : aucun contexte');
});
test('G4. RÉSULTAT NON OBJET (chaîne, tableau, null) : rendu tel quel, jamais enveloppé', async () => {
  const suivi = suivreObservationDuTour(async () => retourEcrit(1));
  await suivi.observer({});
  assert.equal(suivi.joindre('réponse'), 'réponse');
  assert.equal(suivi.joindre(null), null);
  const tab = ['x']; assert.equal(suivi.joindre(tab), tab);
});
test('G5. L\'ERREUR de l\'observateur se propage telle quelle et ne laisse AUCUN contexte', async () => {
  const boom = new Error('boum');
  const suivi = suivreObservationDuTour(async () => { throw boom; });
  await assert.rejects(() => suivi.observer({}), (e) => e === boom);
  const resultat = { texte: 'ok' };
  assert.equal(suivi.joindre(resultat), resultat);
});
test('G6. Observation inexploitable par applicationsSollicitables : pas de zone, le tour n\'est jamais cassé', async () => {
  const suivi = suivreObservationDuTour(async () => ({ statut: 'ecrite', observation: { id: 'o' }, univers: [] }));
  await suivi.observer({});
  const resultat = { texte: 'ok' };
  assert.equal(suivi.joindre(resultat), resultat);
});
test('G7. paramètre invalide : TypeError ; le message est transmis à l\'observateur sans transformation', async () => {
  assert.throws(() => suivreObservationDuTour(null), TypeError);
  assert.throws(() => suivreObservationDuTour({}), TypeError);
  let recu = null; const m = { id: 'm', texte: 't' };
  const suivi = suivreObservationDuTour(async (x) => { recu = x; return null; });
  await suivi.observer(m);
  assert.equal(recu, m);
});
test('G8. STATIQUE : contexte-sollicitation n\'importe que la fonction pure ; aucune lecture de texte, aucune persistance, aucun registre global, aucun appel d\'observation ou d\'exécution', () => {
  assert.deepEqual(CODE_CTX.match(/^import .*$/gm), ["import { applicationsSollicitables } from './applications-sollicitables.js';"]);
  assert.equal(/\.texte|\btexte\b|magasin|localStorage|indexedDB|lireTout|ecrire|enregistrer|executer|invoquer|observerPossibilites|universValeurs|globalThis|window|Date\b|Math\./.test(CODE_CTX), false);
});
// === FIN_TEST_APPLICATIONS_SOLLICITABLES ===
