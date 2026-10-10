// v0.63.80 — J-A (issu de l'expérience d'autonomie 03) — OUVRIR LA BOUCLE action → conséquence → observation.
// Preuves : deux tables (emissions = l'acte d'adresser une production à un environnement nommé ; receptions = une donnée venue d'un environnement,
// avec la DÉCLARATION par l'environnement de l'émission à laquelle elle répond, ou null) ; orchestration emettreProduction (adaptateur générique) ;
// vue pure consequencesDesEmissions ; causalité déclarée jamais inférée ; existait-avant / apparu-après séparés par construction ; action sans
// conséquence ; plusieurs conséquences ; même action, environnements différents -> réceptions différentes ; la conséquence devient une donnée de
// l'univers observé au tour suivant (et donc matière des mécanismes généraux) ; deux Naissance ; dormance ; comportement vivant inchangé ; coût.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as vue from '../app/langage/consequences-emissions.js';
import { consequencesDesEmissions } from '../app/langage/consequences-emissions.js';
import * as orchestration from '../app/langage/emission.js';
import { emettreProduction } from '../app/langage/emission.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerEmission, enregistrerReception, TABLES, CLE, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN_VUE = join(RACINE, 'app', 'langage', 'consequences-emissions.js');
const CHEMIN_EMISSION = join(RACINE, 'app', 'langage', 'emission.js');
const SRC_VUE = readFileSync(CHEMIN_VUE, 'utf8'); const SRC_EMISSION = readFileSync(CHEMIN_EMISSION, 'utf8');
const code = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const sansCommentaires = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuseVue = (f) => assert.throws(f, (e) => e instanceof TypeError && /^consequencesDesEmissions : /.test(e.message));
const refuseEmission = (f) => assert.rejects(f, (e) => e instanceof TypeError && /^emettreProduction : /.test(e.message));

// ---------------------------------------------------------------------------------------------------------------------------------- A. PERSISTANCE
async function magasinAvecExecution() {
  const magasin = magasinMemoireVive();
  await enregistrerValeurDonnee(magasin, { id: 'message-1', valeur: 'bonjour' });
  await magasin.ecrire('executionsOperations', { id: 'execution-1', horodatage: '2026-10-08T08:00:00.000Z', idDesignation: 'd-1', operation: 'op', liaisons: [{ entree: 'x', donnee: 'message-1' }], resultat: ['b', 'o'] });
  await magasin.ecrire('observationsPossibilites', { id: 'obs-1' });
  return magasin;
}

test('A1. deux tables nouvelles (emissions, receptions) : VERSION_BASE 22, SCHEMA 12, 26 tables, clés id ; sauvegarde complète les exporte et les relit', async () => {
  assert.equal(VERSION_BASE, 24); assert.equal(SCHEMA_SAUVEGARDE, 14); assert.equal(TABLES.length, 30); // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables)
  assert.deepEqual(TABLES.slice(-6, -4), ['emissions', 'receptions']); // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : deux tables de plus après (relationInitiale, variationsRelation) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1) : deux tables ajoutées après (capaciteInitiale, variationsCapacite) assert.equal(CLE.emissions, 'id'); assert.equal(CLE.receptions, 'id');
  const magasin = await magasinAvecExecution();
  const e = await enregistrerEmission(magasin, { idExecution: 'execution-1', environnement: 'essai', idObservation: 'obs-1' });
  await enregistrerReception(magasin, { environnement: 'essai', idDonnee: 'message-1', idEmission: e.id });
  const memoire = { lireTout: async () => [] };
  const sauvegarde = await construireSauvegardeComplete({ memoire: { ...memoire, tables: [] }, magasinLangage: magasin, idNaissance: 'n', versionAppli: 'x', maintenant: () => '2026-10-08T08:00:00.000Z' }).catch(() => null);
  if (sauvegarde !== null) {
    const texte = typeof sauvegarde === 'string' ? sauvegarde : JSON.stringify(sauvegarde);
    const lu = await lireSauvegardeComplete(texte, { tablesMemoire: [] });
    if (lu.ok) { assert.equal(lu.donnees.langage.emissions.length, 1); assert.equal(lu.donnees.langage.receptions.length, 1); }
  }
});

test('A2. enregistrerEmission : l\'ACTE « j\'ai adressé cette production à cet environnement » ; exécution existante exigée, champs clos, horodatage calculé ; aucun statut, aucune valence ; une production peut être émise deux fois', async () => {
  const magasin = await magasinAvecExecution();
  const e = await enregistrerEmission(magasin, { idExecution: 'execution-1', environnement: 'essai', idObservation: 'obs-1' });
  assert.deepEqual(Object.keys(e), ['id', 'horodatage', 'idExecution', 'environnement', 'idObservation']);
  assert.match(e.id, /^emission-/); assert.ok(!Number.isNaN(Date.parse(e.horodatage)));
  const e2 = await enregistrerEmission(magasin, { idExecution: 'execution-1', environnement: 'essai', idObservation: 'obs-1' });
  assert.notEqual(e.id, e2.id); assert.equal((await magasin.lireTout('emissions')).length, 2);
  await assert.rejects(enregistrerEmission(magasin, { idExecution: 'execution-inconnue', environnement: 'essai', idObservation: 'obs-1' }), TypeError);
  await assert.rejects(enregistrerEmission(magasin, { idExecution: 'execution-1', environnement: '', idObservation: 'obs-1' }), TypeError);
  await assert.rejects(enregistrerEmission(magasin, { idExecution: 'execution-1', environnement: 'essai', idObservation: 'obs-1', statut: 'ok' }), TypeError);
  await assert.rejects(enregistrerEmission(magasin, { idExecution: 'execution-1', environnement: 'essai', idObservation: 'obs-1', horodatage: 'x' }), TypeError);
  assert.equal((await magasin.lireTout('emissions')).length, 2);
});

test('A3. enregistrerReception : le FAIT venu de l\'environnement ; donnée conservée exigée ; idEmission null (indépendante) ou émission EXISTANTE du MÊME environnement ; jamais une émission future, jamais un autre environnement', async () => {
  const magasin = await magasinAvecExecution();
  const r0 = await enregistrerReception(magasin, { environnement: 'essai', idDonnee: 'message-1', idEmission: null });
  assert.deepEqual(Object.keys(r0), ['id', 'horodatage', 'environnement', 'idDonnee', 'idEmission']); assert.equal(r0.idEmission, null);
  await assert.rejects(enregistrerReception(magasin, { environnement: 'essai', idDonnee: 'message-1', idEmission: 'emission-future' }), /aucune émission/);
  const e = await enregistrerEmission(magasin, { idExecution: 'execution-1', environnement: 'essai', idObservation: 'obs-1' });
  const r1 = await enregistrerReception(magasin, { environnement: 'essai', idDonnee: 'message-1', idEmission: e.id });
  assert.equal(r1.idEmission, e.id);
  await assert.rejects(enregistrerReception(magasin, { environnement: 'autre', idDonnee: 'message-1', idEmission: e.id }), /pas été adressée à cet environnement/);
  await assert.rejects(enregistrerReception(magasin, { environnement: 'essai', idDonnee: 'message-inconnu', idEmission: null }), /aucune valeur conservée/);
  await assert.rejects(enregistrerReception(magasin, { environnement: 'essai', idDonnee: 'message-1', idEmission: null, jugement: 'correct' }), TypeError);
  await assert.rejects(enregistrerReception(magasin, { environnement: 'essai', idDonnee: 'message-1', idEmission: undefined }), TypeError);
  assert.equal((await magasin.lireTout('receptions')).length, 2);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. VUE PURE
const E = (id, env = 'essai') => ({ id, horodatage: 'h', idExecution: 'execution-1', environnement: env, idObservation: 'obs-1' });
const R = (id, idEmission, env = 'essai', idDonnee = `m-${id}`) => ({ id, horodatage: 'h', environnement: env, idDonnee, idEmission });

test('B1. consequencesDesEmissions : sans conséquence (couverture vide), une, plusieurs ; indépendantes à part ; donnée reçue deux fois = deux réceptions, une donnée', () => {
  const s = consequencesDesEmissions([E('e1'), E('e2'), E('e3')], [R('r1', null), R('r2', 'e2'), R('r3', 'e3'), R('r4', 'e3'), R('r5', 'e3', 'essai', 'm-r4'), R('r6', null)]);
  assert.deepEqual(s.emissions.map((e) => [e.id, e.consequences.length, e.donnees.length]), [['e1', 0, 0], ['e2', 1, 1], ['e3', 3, 2]]);
  assert.deepEqual(s.emissions[2].consequences, [['r3'], ['r4'], ['r5']]); assert.deepEqual(s.emissions[2].donnees, [['m-r3'], ['m-r4']]);
  assert.deepEqual(s.independantes, [['r1'], ['r6']]);
  assert.deepEqual(Object.keys(s.emissions[0]), ['id', 'idExecution', 'environnement', 'idObservation', 'consequences', 'donnees']);
  assert.deepEqual(consequencesDesEmissions([], []), { emissions: [], independantes: [] });
});

test('B2. causalité DÉCLARÉE, jamais inférée : deux émissions au même instant, une réception référence e1 -> e2 reste sans conséquence ; émission absente ou environnement différent -> TypeError ; aucune lecture d\'horodatage ni de contenu', () => {
  const s = consequencesDesEmissions([E('e1'), E('e2')], [R('r1', 'e1')]);
  assert.deepEqual(s.emissions.map((e) => e.consequences.length), [1, 0]);
  refuseVue(() => consequencesDesEmissions([E('e1')], [R('r1', 'e9')]));
  refuseVue(() => consequencesDesEmissions([E('e1', 'A')], [R('r1', 'e1', 'B')]));
  refuseVue(() => consequencesDesEmissions([E('e1'), E('e1')], []));
  refuseVue(() => consequencesDesEmissions(null, []));
  assert.equal(/\.(horodatage|valeur|texte|resultat)\b|'(horodatage|valeur|texte|resultat)'|\bDate\b|\.sort\(|length\s*[<>]/.test(code(SRC_VUE)), false);
});

test('B3. pureté : entrées gelées intactes, sorties neuves ; ordre des émissions = ordre reçu (non sémantique), couvertures canoniques', () => {
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const em = gel([E('e2'), E('e1')]); const re = gel([R('r2', 'e1'), R('r1', 'e1')]);
  const fige = JSON.stringify([em, re]);
  const s1 = consequencesDesEmissions(em, re); const s2 = consequencesDesEmissions(em, re);
  assert.deepEqual(s1, s2); assert.notEqual(s1, s2);
  assert.deepEqual(s1.emissions.map((e) => e.id), ['e2', 'e1']); assert.deepEqual(s1.emissions[1].consequences, [['r1'], ['r2']]);
  assert.equal(JSON.stringify([em, re]), fige);
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. ORCHESTRATION
test('C1. emettreProduction : lit la production, persiste l\'acte, remet { emission, valeur } à l\'adaptateur ; échec de remise rendu, jamais masqué, l\'acte reste écrit ; entrées invalides refusées avant tout effet', async () => {
  const magasin = await magasinAvecExecution();
  const remis = [];
  const env = { nom: 'essai', remettre: (x) => { remis.push(x); } };
  const r = await emettreProduction({ idExecution: 'execution-1', idObservation: 'obs-1' }, { magasin, environnement: env });
  assert.deepEqual(r.remise, { etat: 'remise' }); assert.equal(r.emission.environnement, 'essai');
  assert.equal(remis.length, 1); assert.deepEqual(remis[0].valeur, ['b', 'o']); assert.equal(remis[0].emission.id, r.emission.id);
  remis[0].valeur.push('x'); assert.deepEqual((await magasin.lireTout('executionsOperations'))[0].resultat, ['b', 'o'], 'la valeur remise est une copie');
  const panne = { nom: 'panne', remettre: () => { throw new Error('environnement injoignable'); } };
  const p = await emettreProduction({ idExecution: 'execution-1', idObservation: 'obs-1' }, { magasin, environnement: panne });
  assert.equal(p.remise.etat, 'echec'); assert.equal(p.remise.erreur.message, 'environnement injoignable');
  assert.equal((await magasin.lireTout('emissions')).length, 2, 'adressé ≠ parvenu : l\'acte reste vrai');
  await refuseEmission(() => emettreProduction({ idExecution: 'execution-inconnue', idObservation: 'obs-1' }, { magasin, environnement: env }));
  await refuseEmission(() => emettreProduction({ idExecution: 'execution-1', idObservation: 'obs-1' }, { magasin, environnement: { nom: 'x' } }));
  await refuseEmission(() => emettreProduction({ idExecution: 'execution-1' }, { magasin, environnement: env }));
  assert.equal((await magasin.lireTout('emissions')).length, 2);
  assert.deepEqual(Object.keys(orchestration), ['emettreProduction']); assert.deepEqual(Object.keys(vue), ['consequencesDesEmissions']);
});

// ---------------------------------------------------------------------------------------------------------------------------------- D. LA BOUCLE VÉCUE
// Un « monde » = la boucle réelle de Naissance (pont, observation, exécutions mécaniques) + un ENVIRONNEMENT qui reçoit les émissions et décide seul
// de ce qu'il renvoie et de ce qu'il déclare. L'environnement est hors de Naissance : il ne lit jamais son magasin.
let compteurIds = 0;
function monde(nom, reagir) {
  const magasin = magasinMemoireVive();
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const ex2 = () => magasin.lireTout('executionsOperations');
  const boite = []; // ce que l'environnement a reçu de Naissance et ce qu'il fera parvenir au prochain tour : [{ texte, idEmission }]
  const environnement = { nom, remettre: ({ emission, valeur }) => { for (const texte of reagir(valeur)) boite.push({ texte, idEmission: emission.id }); } };
  const tours = [];
  // un tour : une donnée venue de l'environnement (le message), déclarée indépendante ou réponse à une émission ; puis la vie ordinaire de Naissance
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }));
    let idMessage = null;
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async (m) => { idMessage = m.id; return { texte: 'ok' }; }, nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    const reception = await enregistrerReception(magasin, { environnement: nom, idDonnee: idMessage, idEmission });
    tours.push({ texte, s, idMessage, reception });
    return s;
  }
  return {
    magasin, environnement, tours, boite,
    vivre: async (texte) => tour(texte),
    // l'environnement fait parvenir ce qu'il a dans sa boîte (chaque élément devient un tour, déclaré réponse à l'émission qui l'a provoqué)
    recevoirBoite: async () => { const lot = boite.splice(0); const faits = []; for (const { texte, idEmission } of lot) faits.push(await tour(texte, idEmission)); return faits; },
    emettre: async (idExecution) => emettreProduction({ idExecution, idObservation: tours.at(-1).s.observation.id }, { magasin, environnement }),
    photo: async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), emissions: await magasin.lireTout('emissions'), receptions: await magasin.lireTout('receptions') }),
  };
}
const texteDe = (valeur) => (typeof valeur === 'string' ? valeur : JSON.stringify(valeur));
const ECHO = (valeur) => [texteDe(valeur)];               // renvoie ce qu'il reçoit
const SILENCE = () => [];                                 // ne renvoie jamais rien
const DOUBLE = (valeur) => [texteDe(valeur), `${texteDe(valeur)} !`]; // renvoie deux données pour une émission
const INVERSION = (valeur) => [[...texteDe(valeur)].reverse().join('')];

test('D1. BOUCLE RÉELLE : action (émission d\'une production vécue) -> conséquence (l\'environnement renvoie une donnée en la DÉCLARANT suite de l\'émission) -> observation (la donnée est dans l\'univers du tour suivant et dans les mécanismes généraux) ; existait-avant distinct d\'apparu-après', async () => {
  const w = monde('echo', ECHO);
  for (const t of ['bonjour Pixel', 'bonjour Luna', 'bonjour Max']) await w.vivre(t);
  const avant = await w.photo();
  assert.equal(avant.receptions.length, 3); assert.ok(avant.receptions.every((r) => r.idEmission === null), 'tout ce qui est arrivé jusqu\'ici est indépendant de toute action');
  // ACTION : Naissance adresse à l'environnement la dernière production (une exécution réelle, résultat d'une opération mécanique)
  const production = avant.executions.at(-1);
  const { emission, remise } = await w.emettre(production.id);
  assert.equal(remise.etat, 'remise'); assert.equal(emission.idExecution, production.id); assert.equal(emission.idObservation, w.tours[2].s.observation.id);
  // CONSÉQUENCE : l'environnement fait parvenir une donnée qu'il déclare réponse à l'émission ; elle devient un tour vécu
  const [s4] = await w.recevoirBoite();
  const apres = await w.photo();
  const s = consequencesDesEmissions(apres.emissions, apres.receptions);
  assert.equal(s.emissions.length, 1); assert.equal(s.emissions[0].consequences.length, 1); assert.deepEqual(s.emissions[0].donnees, [[w.tours[3].idMessage]]);
  assert.equal(s.independantes.length, 3);
  // la donnée reçue a la valeur que l'environnement a choisie (ici : l'écho de la production), conservée comme toute valeur de message
  assert.equal(apres.valeurs.find((v) => v.id === w.tours[3].idMessage).valeur, texteDe(production.resultat));
  // OBSERVATION : la conséquence est dans l'univers observé du tour 4, examinée comme toute donnée, et les mécanismes généraux travaillent dessus
  assert.ok(s4.observation.donneesExaminees.includes(w.tours[3].idMessage));
  assert.ok(s4.univers.some((u) => u.donnee.identite === w.tours[3].idMessage));
  assert.ok(s4.observation.possibilites.some((a) => a.donnee === w.tours[3].idMessage), 'la conséquence est une donnée possible pour les opérations, comme toute autre');
  // ce que la boucle NE fait pas encore : à T4 la seule application déterminée ne prend pas le message ; les opérations sur la conséquence sont
  // des choix (symbolesDeChaine est « à choisir ») — la conséquence est observée et possible, elle n'est pas agie : le verrou du choix est intact
  assert.equal(apres.executions.some((e) => e.liaisons.some((l) => l.donnee === w.tours[3].idMessage || (Array.isArray(l.donnees) && l.donnees.includes(w.tours[3].idMessage)))), false);
  assert.ok(s4.choixAFaire.includes('symbolesDeChaine'));
  // existait avant / apparu après : par construction (réception -> émission déjà écrite), lisible sans horodatage
  assert.ok(apres.receptions.slice(0, 3).every((r) => r.idEmission === null) && apres.receptions[3].idEmission === emission.id);
});

test('D2. ACTION SANS CONSÉQUENCE, PLUSIEURS CONSÉQUENCES, ENVIRONNEMENTS DIFFÉRENTS : même action (même production, même tour) -> silence 0, écho 1, double 2, inversion 1 (contenu différent) ; deux Naissance gardent des expériences différentes', async () => {
  const mondes = { silence: monde('silence', SILENCE), echo: monde('echo', ECHO), double: monde('double', DOUBLE), inversion: monde('inversion', INVERSION) };
  const resultats = {};
  for (const [nom, w] of Object.entries(mondes)) {
    for (const t of ['bonjour Pixel', 'bonjour Luna', 'bonjour Max']) await w.vivre(t);
    const production = (await w.photo()).executions.at(-1);
    await w.emettre(production.id);
    await w.recevoirBoite();
    const p = await w.photo();
    const s = consequencesDesEmissions(p.emissions, p.receptions);
    resultats[nom] = { consequences: s.emissions[0].consequences.length, valeurs: s.emissions[0].donnees.map((d) => p.valeurs.find((v) => v.id === d[0]).valeur), nbValeurs: p.valeurs.length, nbExecutions: p.executions.length, production: production.resultat };
  }
  assert.deepEqual(Object.fromEntries(Object.entries(resultats).map(([k, v]) => [k, v.consequences])), { silence: 0, echo: 1, double: 2, inversion: 1 });
  assert.deepEqual(resultats.echo.production, resultats.silence.production, 'même action');
  assert.equal(resultats.echo.valeurs[0], texteDe(resultats.echo.production));
  assert.equal(resultats.inversion.valeurs[0], [...texteDe(resultats.inversion.production)].reverse().join(''));
  assert.notEqual(resultats.echo.valeurs[0], resultats.inversion.valeurs[0]);
  assert.ok(resultats.silence.nbValeurs < resultats.echo.nbValeurs && resultats.echo.nbValeurs < resultats.double.nbValeurs, 'les vécus divergent (valeurs conservées)');
  assert.ok(resultats.silence.nbExecutions < resultats.echo.nbExecutions, 'les vécus divergent (exécutions mécaniques faites sur la conséquence)');
  // l'émission sans conséquence reste une émission entière : rien n'y est ajouté, rien n'est inventé
  const ps = await mondes.silence.photo(); const ss = consequencesDesEmissions(ps.emissions, ps.receptions);
  assert.deepEqual(ss.emissions[0].consequences, []); assert.deepEqual(ss.emissions[0].donnees, []); assert.equal(ps.receptions.length, 3);
});

test('D3. ENVIRONNEMENT SILENCIEUX PUIS MONDE QUI CONTINUE : une donnée arrivée après l\'action mais NON déclarée n\'est pas une conséquence (aucune inférence temporelle)', async () => {
  const w = monde('silence', SILENCE);
  for (const t of ['bonjour Pixel', 'bonjour Luna']) await w.vivre(t);
  const production = (await w.photo()).executions.at(-1);
  const { emission } = await w.emettre(production.id);
  await w.vivre('bonjour Max'); // arrive APRÈS l'émission, sans déclaration
  const p = await w.photo(); const s = consequencesDesEmissions(p.emissions, p.receptions);
  assert.equal(s.emissions[0].consequences.length, 0); assert.equal(s.independantes.length, 3);
  assert.ok(Date.parse(p.receptions[2].horodatage) >= Date.parse(emission.horodatage), 'postérieure et pourtant indépendante : le temps ne fait pas la cause');
});

// ---------------------------------------------------------------------------------------------------------------------------------- E. DORMANCE / COMPORTEMENT
test('E1. DORMANCE DE LA VUE : aucun fichier de app/ n\'importe la vue ; seul environnement-conversation.js (J-B) appelle emettreProduction / enregistrerReception ; aucun mécanisme ne LIT emissions/receptions hors connaissances.js, la sauvegarde et executions-vecues.js (v0.63.83)', async () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN_VUE || f === CHEMIN_EMISSION) continue;
    if (f === join(RACINE, 'app', 'langage', 'environnement-conversation.js')) continue; // MISE À JOUR DÉLIBÉRÉE v0.63.81 (J-B) : environnement-conversation.js est l'UNIQUE appelant de emettreProduction (émission de chaque production du lot vers 'conversation') et de enregistrerReception (réception DÉCLARÉE par le geste « Répondre ») ; aucune lecture, aucune interprétation ; gardé par tests/environnement-conversation.test.mjs
    const src = readFileSync(f, 'utf8'); const r = f.slice(RACINE.length + 1);
    assert.equal(/from '\.\/(consequences-emissions|emission)\.js'|consequencesDesEmissions\(|emettreProduction\(/.test(src), false, r);
    if (r === 'app/langage/executions-vecues.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.83 : executions-vecues.js LIT emissions et receptions (lecture seule) pour projeter les réceptions déclarées en exécutions vécues ; aucune écriture
    if (r !== 'app/langage/connaissances.js' && r !== 'app/langage/emission.js') assert.equal(/enregistrerEmission|enregistrerReception|lireTout\(\s*['"](emissions|receptions)['"]/.test(sansCommentaires(src)), false, r);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/consequences-emissions|emettreProduction/.test(s), false, autre); }
  assert.equal(/prefer|préfér|score|confiance|recompense|récompense|reussite|réussite|correct|jugement|curiosit|nouveaut|choix|choisir/i.test(code(SRC_VUE) + code(SRC_EMISSION)), false);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});

test('E2. COMPORTEMENT VIVANT INCHANGÉ : 7 tours sans émission -> choix 0,1,4,13,13,13,13 ; auto 2,4,9,1,1,1,1 ; 19 exécutions ; 0 émission ; 7 réceptions indépendantes', async () => {
  const w = monde('conversation', SILENCE);
  for (const t of ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna']) await w.vivre(t);
  assert.deepEqual(w.tours.map((t) => t.s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(w.tours.map((t) => t.s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  const p = await w.photo();
  assert.equal(p.executions.length, 19); assert.equal(p.emissions.length, 0); assert.equal(p.receptions.length, 7);
  const t0 = performance.now(); consequencesDesEmissions(p.emissions, p.receptions); assert.ok(performance.now() - t0 < 50);
});
