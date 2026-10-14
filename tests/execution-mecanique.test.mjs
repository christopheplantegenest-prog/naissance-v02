// v0.63.60 — EXÉCUTER MÉCANIQUEMENT CE QUI NE DEMANDE AUCUN CHOIX (décision ChatGPT, 06/10/2026). Preuves : le déclencheur consomme le résultat réel de
// applicationsSollicitables ; toutes les applications déterminées sont exécutées une fois, par le chemin normal (désignation d'origine 'mecanique' →
// résolution → invocation → exécution) ; les choixAFaire restent inertes ; un seul lot par observation (aucune boucle) ; un échec n'est jamais masqué
// et n'empêche pas les suivantes ; l'ordre est l'ordre mécanique de groupesDeCandidats ; sans le déclencheur, rien n'est désigné.
import { test } from 'node:test';
import { cleApplication } from '../app/langage/besoins.js';
import { applicationsRelativesA } from '../app/langage/determination-relative.js'; // v0.63.94
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js'; // v0.63.94
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/execution-mecanique.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee, executerApplicationAvecOrigine } from '../app/langage/execution-sollicitee.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, ORIGINES_DESIGNATION, VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SRC = readFileSync(join(RACINE, 'app', 'langage', 'execution-mecanique.js'), 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const MAIN = readFileSync(join(RACINE, 'app', 'main.js'), 'utf8');
const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Le flux ordinaire du tour, tel que main.js le câble (observation → déclencheur → traitement), sans DOM ni Gemini.
async function vie(messages, { magasin = magasinMemoireVive(), declencheur = true, table = TABLE_OPERATIONS } = {}) {
  let n = 0;
  const nouvelId = (p) => `${p}-${++n}`;
  const tours = [];
  for (const texte of messages) {
    const suivi = suivreObservationDuTour(
      (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }),
      declencheur ? (c) => executerApplicationsDeterminees(c, { magasin, table }) : null,
    );
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const joint = suivi.joindre(res);
    const observations = await magasin.lireTout('observationsPossibilites');
    tours.push({ texte, joint, sollicitation: joint.sollicitation, observation: observations[observations.length - 1], observations: observations.length, designations: await magasin.lireTout('designations'), executions: await magasin.lireTout('executionsOperations') });
  }
  return { magasin, tours };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
let SCENARIO_VECU;
const scenario = async () => (SCENARIO_VECU ??= await vie(SCENARIO));

test('A1. export unique, asynchrone, deux paramètres ; origine de désignation « mecanique » = deuxième valeur de la liste fermée, gelée', () => {
  assert.deepEqual(Object.keys(module), ['executerApplicationsDeterminees']);
  assert.equal(executerApplicationsDeterminees.constructor.name, 'AsyncFunction');
  assert.equal(executerApplicationsDeterminees.length, 2);
  assert.deepEqual([...ORIGINES_DESIGNATION], ['exterieure', 'mecanique', 'propre']); // MISE À JOUR DÉLIBÉRÉE v0.63.88 (épisode propre, première initiative motivée minimale) : + « propre » (l'application a été retenue par le mécanisme interne : engagement d'un épisode propre)
  assert.equal(Object.isFrozen(ORIGINES_DESIGNATION), true);
  assert.equal(VERSION_BASE, 25); assert.equal(TABLES.length, 31); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 24 → 25 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 30 → 31 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables)
});
test('A2. entrées invalides : TypeError avant tout effet', async () => {
  const magasin = magasinMemoireVive();
  for (const e of [null, undefined, 'x', []]) await assert.rejects(executerApplicationsDeterminees(e, { magasin, table: TABLE_OPERATIONS }), TypeError);
  await assert.rejects(executerApplicationsDeterminees({ observation: { id: 'o' }, univers: [] }, { magasin, table: TABLE_OPERATIONS }), TypeError);
  assert.deepEqual(await magasin.lireTout('designations'), []);
});

test('B1. TOUR 1 « bonjour Pixel », SANS CLIC : parcourirStructure(message) et symbolesDeChaine(message) sont exécutées par le flux ordinaire', async () => {
  const { tours: [t] } = await vie(['bonjour Pixel']);
  const S = t.sollicitation;
  assert.deepEqual(S.automatiques.map((r) => [r.operation, r.statut]), [['parcourirStructure', 'executee'], ['symbolesDeChaine', 'executee']]);
  assert.deepEqual(S.choixAFaire, []);
  assert.deepEqual(S.applications, [], 'déjà exécutées : plus présentées comme à solliciter');
  assert.equal(S.echecDeclenchement, null);
  assert.equal(t.designations.length, 2); assert.equal(t.executions.length, 2);
  const idMessage = t.observation.idMessage;
  for (const d of t.designations) {
    assert.equal(d.origine, 'mecanique');
    assert.equal(d.idObservation, t.observation.id);
    assert.equal(d.liaisons.length, 1); assert.equal(d.liaisons[0].donnee, idMessage);
  }
  const parOp = Object.fromEntries(t.executions.map((x) => [x.operation, x]));
  assert.deepEqual(parOp.parcourirStructure.resultat, [{ chemin: [], type: 'chaine', valeur: 'bonjour Pixel' }]);
  assert.equal(Array.isArray(parOp.symbolesDeChaine.resultat), true);
});
test('B2. PROVENANCE complète : exécution → idDesignation → désignation (origine, observation) → liaisons, comme le bouton développeur', async () => {
  const { magasin, tours: [t] } = await vie(['bonjour Pixel']);
  const observations = await magasin.lireTout('observationsPossibilites');
  for (const x of t.executions) {
    const d = t.designations.find((y) => y.id === x.idDesignation);
    assert.ok(d, 'désignation retrouvée');
    assert.equal(d.operation, x.operation);
    assert.deepEqual(d.liaisons, x.liaisons);
    assert.ok(observations.some((o) => o.id === d.idObservation));
    assert.equal('origine' in x, false, "l'origine reste portée par la désignation seule");
  }
});

test('C1. SCÉNARIO 7 TOURS sans clic : mesures par tour (déterministes)', async () => {
  const { tours } = await scenario();
  const mesures = tours.map((t) => ({ choix: t.sollicitation.choixAFaire.length, auto: t.sollicitation.automatiques.length, ok: t.sollicitation.automatiques.filter((r) => r.statut === 'executee').length }));
  assert.deepEqual(mesures, [
    { choix: 0, auto: 2, ok: 2 }, { choix: 1, auto: 5, ok: 5 }, { choix: 5, auto: 10, ok: 10 }, { choix: 13, auto: 3, ok: 3 },
    { choix: 13, auto: 3, ok: 3 }, { choix: 13, auto: 3, ok: 3 }, { choix: 13, auto: 3, ok: 3 },
  ]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : à partir du 2e tour, le message est traité (parcourirStructure, puis aussi symbolesDeChaine, déterminées relativement à l'observation) ; elementsObservables porte sur l'ensemble des chaînes, qui grandit : 3 applications nouvelles par tour en régime ; les choix restent des choix (1 → 1, 4 → 5 : parcourirStructure reste à choisir au tour 3) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : l'ancien scénario (choix 0,1,2,11,11,11,11 ; auto 2,3,10,2,2,2,2 ; 23 exécutions) change réellement : composerCollection devient déterminée au tour 2 (une seule collection de chaînes, R) et sa production (une chaîne) devient une seconde candidate de symbolesDeChaine.chaine, qui passe en choix dès le tour 3 : chiffres mesurés, rien n'a été corrigé pour garder les anciens. // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : le lot ne réexécute plus une application stricte déjà exécutée (elementsObservables sur le même ensemble, tours 4–7) ; chiffres mesurés (auto 1,1,1,1 → 0,0,0,0)
  assert.deepEqual(tours.map((t) => (t.sollicitation.dejaExecutees || []).map((d) => d.operation)), [[], [], [], [], [], [], []]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chaque tour apporte des applications NOUVELLES (sur la donnée observée, et elementsObservables sur un ensemble agrandi) ; // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : le lot ne réexécute plus une application stricte déjà exécutée (elementsObservables sur le même ensemble, tours 4–7) ; chiffres mesurés
  assert.deepEqual(tours.map((t) => t.observation.donneesExaminees.length), [1, 5, 15, 40, 46, 52, 58]); // MISE À JOUR DÉLIBÉRÉE v0.64.11 (admission des référents de suites) : + 2 référents acquis dès le 4e tour ; choix / automatiques / exécutions INCHANGÉS (assertions ci-dessus et ci-dessous) // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : le lot ne réexécute plus une application stricte déjà exécutée (elementsObservables sur le même ensemble, tours 4–7) ; chiffres mesurés (le vécu n'est plus agrandi par les réexécutions) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 11 → 13 au tour 3, 38/42/46 → 36/38/40 (symbolesDeChaine n'est plus exécutée après le tour 2, composerCollection s'ajoute) // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.deepEqual(tours.map((t) => t.observation.possibilites.length), [2, 14, 53, 154, 177, 200, 223]); // MISE À JOUR DÉLIBÉRÉE v0.64.11 (admission des référents de suites) : + 4 atomes (2 par référent) // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : le lot ne réexécute plus une application stricte déjà exécutée (elementsObservables sur le même ensemble, tours 4–7) ; chiffres mesurés // MISE À JOUR DÉLIBÉRÉE v0.63.67 : possibilités mesurées avec la dix-septième opération // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.deepEqual(tours.map((t) => t.executions.length), [2, 7, 17, 20, 23, 26, 29]); // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : le lot ne réexécute plus une application stricte déjà exécutée (elementsObservables sur le même ensemble, tours 4–7) ; chiffres mesurés // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19 exécutions au total // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.deepEqual(tours.map((t) => t.designations.length), [2, 7, 17, 20, 23, 26, 29]); // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : le lot ne réexécute plus une application stricte déjà exécutée (elementsObservables sur le même ensemble, tours 4–7) ; chiffres mesurés // MISE À JOUR DÉLIBÉRÉE v0.63.67 : idem // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.deepEqual(tours.map((t) => t.observation.donneesExaminees.filter((i) => i.startsWith('entrees-de-production:')).length), [0, 2, 7, 17, 20, 23, 26]); // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : le lot ne réexécute plus une application stricte déjà exécutée (elementsObservables sur le même ensemble, tours 4–7) ; chiffres mesurés // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesuré // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
});
test('C2. SOURCE UNIQUE : à chaque tour, applications déterminées (PAR STRUCTURE + RELATIVEMENT À L\'OBSERVATION) = NOUVELLES (exécutées) + DÉJÀ EXÉCUTÉES (non relancées) ; une ligne de choixAFaire n\'est désignée que par sa détermination relative à O', async () => {
  // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : le lot exécute, dans cet ordre, les applications nouvelles déterminées par structure
  // (applicationsSollicitables) puis celles déterminées relativement à l'observation (applicationsRelativesA, liaison causale = O.idMessage).
  // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : nouveau contrat .60 : « toutes les applications déterminées NOUVELLES sont exécutées une fois par lot ».
  const { tours } = await scenario();
  for (const t of tours) {
    const { applications: parStructure, choixAFaire } = applicationsSollicitables(t.observation, undefined, t.sollicitation.univers);
    const relatives = applicationsRelativesA(t.observation, DESCRIPTIONS_OPERATIONS, t.sollicitation.univers);
    assert.deepEqual(t.sollicitation.relatives, relatives, 'le lot rend exactement la détermination relative pure');
    const determinees = [...parStructure, ...relatives];
    const deja = new Set((t.sollicitation.dejaExecutees || []).map((d) => cleApplication(d)));
    const applications = determinees.filter((a) => !deja.has(cleApplication(a)));
    assert.equal(applications.length + deja.size, determinees.length, 'déterminées = nouvelles + déjà exécutées');
    for (const d of t.sollicitation.dejaExecutees || []) assert.equal(t.designations.some((x) => x.idObservation === t.observation.id && x.operation === d.operation), false, `${d.operation} : déjà exécutée, aucune désignation`);
    assert.deepEqual(t.sollicitation.automatiques.map((r) => r.operation), applications.map((a) => a.operation));
    const designees = t.designations.filter((d) => d.idObservation === t.observation.id).map((d) => d.operation);
    assert.deepEqual(designees.sort(comparer), applications.map((a) => a.operation).sort(comparer));
    const ops = new Set(relatives.map((a) => a.operation));
    for (const op of choixAFaire) if (!ops.has(op)) assert.equal(designees.includes(op), false, `${op} reste inerte`);
    for (const a of relatives) { assert.ok(choixAFaire.includes(a.operation), 'la relative vient d\'un choix, qui reste un choix'); assert.ok(a.liaisons.some((l) => l.donnee === t.observation.idMessage)); }
    for (const a of applications) {
      const r = t.sollicitation.automatiques.find((x) => x.operation === a.operation);
      assert.deepEqual(r.designation.liaisons, a.liaisons.map((l) => (l.donnees ? { entree: l.entree, donnees: [...l.donnees].sort(comparer) } : l)).sort((x, y) => comparer(x.entree, y.entree)));
    }
  }
});
test('C3. TOUR 2 : les productions du tour 1 sont présentes ; parcourirStructure devient un choix (plusieurs candidats) — MISE À JOUR DÉLIBÉRÉE v0.63.94 : elle reste un choix ET est exécutée sur la donnée observée (déterminée relativement à l\'observation) ; les autres candidats ne sont pas désignés', async () => {
  const { tours } = await scenario();
  const t2 = tours[1];
  assert.deepEqual(t2.sollicitation.choixAFaire, ['parcourirStructure']);
  assert.deepEqual(t2.sollicitation.automatiques.map((r) => r.operation), ['composerCollection', 'elementsObservables', 'projeterChemins', 'symbolesDeChaine', 'parcourirStructure']); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : + parcourirStructure(valeur = message du tour 2), après les déterminées par structure
  assert.deepEqual(t2.designations.filter((d) => d.idObservation === t2.observation.id && d.operation === 'parcourirStructure').map((d) => d.liaisons), [[{ entree: 'valeur', donnee: t2.observation.idMessage }]]); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : + composerCollection, déterminée dès le tour 2 (une seule collection de chaînes : la production de symbolesDeChaine du tour 1)
  assert.equal(t2.designations.filter((d) => d.idObservation === t2.observation.id && d.operation === 'parcourirStructure').length, 1); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
});
test('D1. AUCUNE BOUCLE DANS LE MÊME TOUR : une observation par tour ; les productions d\'un tour sont absentes de SON observation et présentes à la suivante', async () => {
  const { tours } = await scenario();
  tours.forEach((t, i) => assert.equal(t.observations, i + 1));
  for (let i = 0; i + 1 < tours.length; i += 1) {
    const avant = new Set(tours[i].observation.donneesExaminees);
    const nouvelles = tours[i + 1].executions.filter((x) => !tours[i].executions.some((y) => y.id === x.id));
    const cetteFournee = tours[i].executions.filter((x) => i === 0 || !tours[i - 1].executions.some((y) => y.id === x.id));
    for (const x of cetteFournee) assert.equal(avant.has(x.id), false, 'absente de l\'observation qui l\'a produite');
    for (const x of cetteFournee) assert.equal(new Set(tours[i + 1].observation.donneesExaminees).has(x.id), true, 'présente au tour suivant');
    assert.ok(nouvelles.length >= 0);
  }
});
test('E1. EXACTEMENT UNE FOIS : par tour, une seule désignation par opération déterminée ; joindre() répété ne ré-exécute rien', async () => {
  const w = await vie(['bonjour Pixel', 'bonjour Luna']);
  for (const t of w.tours) {
    const ops = t.designations.filter((d) => d.idObservation === t.observation.id).map((d) => d.operation);
    assert.equal(new Set(ops).size, ops.length);
  }
  const avant = (await w.magasin.lireTout('designations')).length;
  await w.tours[1].joint;
  assert.equal((await w.magasin.lireTout('designations')).length, avant);
});
test('E2. BOUTON : une application exécutée automatiquement n\'est plus présentée ; un clic explicite reste possible, passe par le même chemin et s\'écrit « exterieure » (décision humaine distincte)', async () => {
  const w = await vie(['bonjour Pixel']);
  const t = w.tours[0];
  assert.deepEqual(t.sollicitation.applications, []);
  const r = await executerApplicationSollicitee({ observation: t.observation, application: { operation: 'symbolesDeChaine', liaisons: t.designations.find((d) => d.operation === 'symbolesDeChaine').liaisons }, univers: t.sollicitation.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS });
  assert.equal(r.statut, 'executee');
  assert.equal(r.designation.origine, 'exterieure');
});

test('F1. TOUR 3 (v0.63.61, remplace l\'ancien échec de resoudreElements) : le couple (couverture, éléments) sans rapport est écarté AVANT désignation ; aucune désignation, aucun échec ; resoudreCouverture (MISE À JOUR DÉLIBÉRÉE v0.63.94) reste un choix à deux combinaisons valides', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.61 : avant, resoudreElements était désignée puis échouait (« rang canonique 0 est absent de l'univers ») ; la relation couvertureDansChemins l'élimine avant classification. L'indépendance des échecs reste prouvée par F2.
  const { tours } = await scenario();
  const t3 = tours[2];
  const autos = t3.sollicitation.automatiques;
  assert.deepEqual(autos.filter((r) => r.statut !== 'executee'), [], 'aucun échec');
  assert.equal(autos.some((r) => r.operation === 'resoudreElements'), false);
  assert.equal(t3.designations.some((d) => d.operation === 'resoudreElements'), false);
  assert.equal(t3.sollicitation.choixAFaire.includes('resoudreElements'), false);
  assert.equal(t3.sollicitation.applications.some((a) => a.operation === 'resoudreElements'), false);
  // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : le message du tour 2 est traité (parcourirStructure), ce qui ajoute un univers candidat :
  // resoudreCouverture a désormais 2 combinaisons VALIDES (3 brutes, 1 écartée par la relation avant désignation) → elle reste un CHOIX, non désignée.
  // Le cas « 1 combinaison valide → application déterminée et exécutée » reste couvert par relations-entrees E1 (synthétique).
  assert.equal(autos.some((r) => r.operation === 'resoudreCouverture'), false);
  assert.equal(t3.sollicitation.choixAFaire.includes('resoudreCouverture'), true);
  assert.equal(t3.designations.some((d) => d.idObservation === t3.observation.id && d.operation === 'resoudreCouverture'), false);
  assert.equal(t3.sollicitation.choixAFaire.includes('symbolesDeChaine'), true);
});
test('F2. ÉCHEC D\'UNE OPÉRATION (table truquée) : A réussit, B échoue, C est tentée ; aucune transaction globale ; résultat déterministe', async () => {
  const table = { ...TABLE_OPERATIONS, parcourirStructure: Object.freeze({ fonction: () => { throw new Error('panne B'); }, appel: 'positionnel', parametres: Object.freeze(['valeur']) }) };
  const w1 = await vie(['bonjour Pixel'], { table }); const w2 = await vie(['bonjour Pixel'], { table });
  for (const w of [w1, w2]) {
    const rs = w.tours[0].sollicitation.automatiques;
    assert.deepEqual(rs.map((r) => [r.operation, r.statut]), [['parcourirStructure', 'echec_invocation'], ['symbolesDeChaine', 'executee']]);
    assert.equal(rs[0].erreur.message, 'panne B');
    assert.equal(w.tours[0].designations.length, 2); assert.equal(w.tours[0].executions.length, 1);
  }
});
test('F3. ÉCHEC DU DÉCLENCHEUR : jamais avalé en silence (echecDeclenchement) mais ne bloque pas le tour ; l\'observation est rendue telle quelle', async () => {
  const retour = { statut: 'ecrite', observation: { id: 'o', possibilites: [] }, univers: [] };
  const suivi = suivreObservationDuTour(async () => retour, async () => { throw new Error('boum'); });
  assert.equal(await suivi.observer({}), retour);
  const j = suivi.joindre({ texte: 'ok' });
  assert.equal(j.texte, 'ok'); assert.equal(j.sollicitation.echecDeclenchement.message, 'boum'); assert.deepEqual(j.sollicitation.automatiques, []);
});

test('G1. ORDRE : l\'ordre mécanique de groupesDeCandidats (tri canonique par nom d\'opération, une fois chaque opération) — MISE À JOUR DÉLIBÉRÉE v0.63.94 : d\'abord les déterminées par structure, puis les déterminées relativement à l\'observation, chacune dans cet ordre', async () => {
  const { tours } = await scenario();
  for (const t of tours) {
    const relatives = new Set((t.sollicitation.relatives || []).map((a) => a.operation));
    const ops = t.sollicitation.automatiques.map((r) => r.operation).filter((op) => !relatives.has(op));
    const opsRel = t.sollicitation.automatiques.map((r) => r.operation).filter((op) => relatives.has(op));
    assert.deepEqual(t.sollicitation.automatiques.map((r) => r.operation), [...ops, ...opsRel]);
    assert.deepEqual(opsRel, [...opsRel].sort(comparer));
    assert.deepEqual(ops, [...ops].sort(comparer));
    assert.equal(new Set(ops).size, ops.length);
  }
});

test('H1. ORIGINE après « redémarrage » : une désignation mécanique se distingue d\'une désignation explicitement sollicitée ; les anciennes lignes sans origine ne sont jamais lues comme « mecanique »', async () => {
  const w = await vie(['bonjour Pixel']);
  const t = w.tours[0];
  const x = await executerApplicationSollicitee({ observation: t.observation, application: { operation: 'symbolesDeChaine', liaisons: t.designations.find((d) => d.operation === 'symbolesDeChaine').liaisons }, univers: t.sollicitation.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS });
  assert.equal(x.statut, 'executee');
  const relu = JSON.parse(JSON.stringify(await w.magasin.lireTout('designations')));
  assert.deepEqual(relu.map((d) => d.origine).sort(comparer), ['exterieure', 'mecanique', 'mecanique']);
  const ancienne = { id: 'designation-ancienne', horodatage: '2026-01-01T00:00:00.000Z', idObservation: 'o', operation: 'x', liaisons: [{ entree: 'e', donnee: 'd' }] };
  await w.magasin.ecrire('designations', ancienne);
  const apres = await w.magasin.lireTout('designations');
  assert.equal('origine' in apres.find((d) => d.id === 'designation-ancienne'), false);
  assert.equal(apres.filter((d) => d.origine === 'mecanique').length, 2);
});
test('H2. refus : une origine inconnue reste refusée par enregistrerDesignation (aucune écriture)', async () => {
  const w = await vie(['bonjour Pixel'], { declencheur: false });
  const t = w.tours[0];
  const { applications } = applicationsSollicitables(t.observation);
  await assert.rejects(executerApplicationAvecOrigine({ observation: t.observation, application: applications[0], univers: t.sollicitation.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS }, 'naissance').then((r) => { if (r.statut === 'echec_designation') throw r.erreur; return r; }), TypeError);
  assert.deepEqual(await w.magasin.lireTout('designations'), []);
  await assert.rejects(executerApplicationAvecOrigine({ observation: t.observation, application: applications[0], univers: t.sollicitation.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS }, ''), TypeError);
});

test('I1. ÉQUIVALENCE clic / automatique : même opération, mêmes liaisons, même résultat, même structure de provenance (hors identité, horodatage, origine)', async () => {
  const w = await vie(['bonjour Pixel', 'bonjour Luna'], { declencheur: false });
  for (const t of w.tours) {
    const { applications } = applicationsSollicitables(t.observation);
    const manuel = magasinMemoireVive(); const auto = magasinMemoireVive();
    const clic = [];
    for (const application of applications) clic.push(await executerApplicationSollicitee({ observation: t.observation, application, univers: t.sollicitation.univers }, { magasin: manuel, table: TABLE_OPERATIONS }));
    const lot = await executerApplicationsDeterminees({ observation: t.observation, univers: t.sollicitation.univers }, { magasin: auto, table: TABLE_OPERATIONS });
    assert.equal(lot.resultats.length, clic.length);
    const norm = (r) => ({ statut: r.statut, operation: r.designation && r.designation.operation, liaisons: r.designation && r.designation.liaisons, idObservation: r.designation && r.designation.idObservation, resultat: r.execution && r.execution.resultat, exLiaisons: r.execution && r.execution.liaisons, lien: r.execution && r.execution.idDesignation === r.designation.id, sous: r.execution && (r.execution.sousDonnees || []).length });
    assert.deepEqual(lot.resultats.map(norm), clic.map(norm));
    assert.deepEqual(clic.map((r) => r.designation.origine), clic.map(() => 'exterieure'));
    assert.deepEqual(lot.resultats.map((r) => r.designation.origine), clic.map(() => 'mecanique'));
    // même clés de ligne persistée
    for (let i = 0; i < clic.length; i += 1) assert.deepEqual(Object.keys(lot.resultats[i].designation), Object.keys(clic[i].designation));
    for (let i = 0; i < clic.length; i += 1) assert.deepEqual(Object.keys(lot.resultats[i].execution), Object.keys(clic[i].execution));
  }
});

test('J1. SANS déclencheur : comportement antérieur inchangé (aucune désignation, aucune exécution, applications présentées au bouton)', async () => {
  const w = await vie(['bonjour Pixel', 'bonjour Luna'], { declencheur: false });
  assert.equal(w.tours[1].designations.length, 0); assert.equal(w.tours[1].executions.length, 0);
  assert.deepEqual(w.tours[0].sollicitation.applications.map((a) => a.operation), ['parcourirStructure', 'symbolesDeChaine']);
  assert.deepEqual(w.tours[0].sollicitation.automatiques, []);
});
test('J2. sous-catégorie : le déclencheur n\'est appelé qu\'après une observation ÉCRITE (jamais sur un autre statut)', async () => {
  let appels = 0;
  for (const retour of [{ statut: 'echec_lecture', observation: null, univers: null }, { statut: 'sans_message', observation: null, univers: null }]) {
    const suivi = suivreObservationDuTour(async () => retour, async () => { appels += 1; return { resultats: [] }; });
    await suivi.observer({});
  }
  assert.equal(appels, 0);
});

test('K1. GARDES STATIQUES : aucune sélection, aucun score, aucune boucle, aucune relecture ; câblage unique dans main.js', () => {
  assert.equal(/\b(while|do)\b\s*[({]/.test(CODE), false);
  assert.equal(/observerPossibilites|enregistrerObservationPossibilites|lireTout|Math\.random|\.sort\(|\.find\(|\.filter\(|\.reduce\(|score|pertinen|prefer|\[0\]|texte|message|Pixel/i.test(CODE), false);
  assert.equal((CODE.match(/executerApplicationAvecOrigine\(/g) || []).length, 1);
  assert.equal((CODE.match(/applicationsSollicitables\(/g) || []).length, 1);
  assert.equal((MAIN.match(/executerApplicationsDeterminees\(/g) || []).length, 1);
  assert.equal((MAIN.match(/suivreObservationDuTour\(/g) || []).length, 1);
});
test('K2. execution-sollicitee.js : l\'origine « exterieure » reste écrite en dur UNIQUEMENT pour l\'export sollicité ; enregistrerDesignation reste appelée une seule fois', () => {
  const s = readFileSync(join(RACINE, 'app', 'langage', 'execution-sollicitee.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal((s.match(/enregistrerDesignation\(/g) || []).length, 1);
  assert.equal((s.match(/'exterieure'/g) || []).length, 1);
  assert.equal(/'mecanique'/.test(s), false);
  assert.match(s, /return executerApplicationAvecOrigine\(entree, dependances, ORIGINE_SOLLICITATION\);/);
});
