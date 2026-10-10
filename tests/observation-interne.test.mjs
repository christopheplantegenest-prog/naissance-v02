// === DEBUT_TEST_OBSERVATION_INTERNE ===
// v0.63.85 — OBSERVATION INTERNE DU TICK + IDENTITÉ PROPRE DE LA CONSÉQUENCE B1 (décision ChatGPT du 10/10/2026, sondes X1/X2).
// Ordre prospectif obligatoire au bouton « Repos » : tick T → observation interne O (datum = état propre AVANT conséquence, source déclarée soi,
// forme nombre) → désignation D de soi:repos(etat) parmi les possibilités de O → variation V (idDesignation = D.id) → exécution projetée
// { id: V.id, idDesignation: D.id } → issue .73 calculable. Aucun déclencheur mécanique, aucune émission, aucun tourActif. Compatibilité .84.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerVariationCapacite, enregistrerCapaciteInitiale, enregistrerDesignation, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { lireCapacite, tickRepos, tourActif, SOURCE_OBSERVATION_INTERNE, ORIGINE_CONSEQUENCE } from '../app/langage/capacite.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { projeterSoi, identiteEtatApres, DESCRIPTIONS_SOI } from '../app/langage/projection-soi.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { issueDuContexteProspectif } from '../app/langage/issue-contexte-prospectif.js';
import { issueDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { DESCRIPTION_SOURCE_SOI } from '../app/langage/source-soi.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const comptes = async (magasin) => Object.fromEntries(await Promise.all(['observationsPossibilites', 'designations', 'variationsCapacite', 'executionsOperations', 'emissions', 'contextesProspectifs', 'attentesProspectives', 'valeursDonnees'].map(async (t) => [t, (await magasin.lireTout(t)).length])));
// un magasin qui journalise l'ORDRE des écritures
function magasinJournalise() {
  const m = magasinMemoireVive(); const journal = [];
  const ecrire = m.ecrire.bind(m);
  m.ecrire = async (table, ligne) => { journal.push([table, ligne.id]); return ecrire(table, ligne); };
  return { magasin: m, journal };
}

test('1-2. base neuve : le premier Repos écrit l\'origine (c = 3), observe, désigne, varie (3 → 3 : saturation dès l\'origine) ; retour complet { tick, observation, univers, designation, variation, prospection }', async () => {
  const magasin = magasinMemoireVive();
  assert.deepEqual(await comptes(magasin), { observationsPossibilites: 0, designations: 0, variationsCapacite: 0, executionsOperations: 0, emissions: 0, contextesProspectifs: 0, attentesProspectives: 0, valeursDonnees: 0 });
  const r = await tickRepos(magasin);
  assert.equal(r.avant, 3); assert.equal(r.apres, 3);
  assert.match(r.tick.id, /^tick-propre-/); assert.equal(r.variation.cause.id, r.tick.id); assert.equal(r.variation.cause.type, 'repos');
  assert.match(r.observation.id, /^observation-possibilites-/); assert.match(r.designation.id, /^designation-application-/); assert.match(r.variation.id, /^variation-capacite-/);
  assert.deepEqual(await comptes(magasin), { observationsPossibilites: 1, designations: 1, variationsCapacite: 1, executionsOperations: 0, emissions: 0, contextesProspectifs: 1, attentesProspectives: 0, valeursDonnees: 0 });
  assert.equal((await lireCapacite(magasin)).valeur, 3);
  // 0 → 1 : après trois tours actifs
  const m2 = magasinMemoireVive(); const h = () => new Date().toISOString();
  await tourActif(m2, { idObservation: 'o-1', horodatage: h() }); await tourActif(m2, { idObservation: 'o-2', horodatage: h() }); await tourActif(m2, { idObservation: 'o-3', horodatage: h() });
  const r2 = await tickRepos(m2); assert.equal(r2.avant, 0); assert.equal(r2.apres, 1);
});

test('3-4. ORDRE RÉEL DES ÉCRITURES : observation interne AVANT désignation AVANT contexte AVANT variation (journal du magasin et horodatages) ; la désignation porte idObservation = O.id, l\'application soi:repos(etat = état d\'avant), origine mecanique', async () => {
  const { magasin, journal } = magasinJournalise();
  const r = await tickRepos(magasin);
  const tables = journal.map(([t]) => t);
  assert.deepEqual(tables, ['capaciteInitiale', 'observationsPossibilites', 'designations', 'contextesProspectifs', 'variationsCapacite']);
  assert.equal(journal[1][1], r.observation.id); assert.equal(journal[2][1], r.designation.id); assert.equal(journal[4][1], r.variation.id);
  assert.ok(r.observation.horodatage <= r.designation.horodatage && r.designation.horodatage <= r.variation.horodatage);
  assert.equal(r.designation.idObservation, r.observation.id);
  assert.equal(r.designation.operation, 'soi:repos'); assert.deepEqual(r.designation.liaisons, [{ entree: 'etat', donnee: r.variation.idEtatAvant }]); assert.equal(r.designation.origine, ORIGINE_CONSEQUENCE);
  assert.equal(r.variation.idEtatAvant, r.observation.idMessage);
  // le contexte prospectif est ancré sur D, et son idObservation est O
  const [ctx] = await magasin.lireTout('contextesProspectifs');
  assert.equal(ctx.idDesignation, r.designation.id); assert.equal(ctx.idObservation, r.observation.id); assert.equal(ctx.application.operation, 'soi:repos');
});

test('O. L\'OBSERVATION INTERNE : source \'soi\', idMessage = identité de l\'état propre d\'AVANT (aucune fausse chaîne : la donnée observée est un nombre), catalogue réel + DESCRIPTIONS_SOI examinés, possibilités de soi:repos ET soi:tour sur l\'état (observées, non exécutées) ; les observations de tour n\'ont pas de champ source', async () => {
  const magasin = magasinMemoireVive();
  const r = await tickRepos(magasin);
  const o = r.observation;
  assert.equal(o.source, SOURCE_OBSERVATION_INTERNE); assert.equal(SOURCE_OBSERVATION_INTERNE, 'soi');
  assert.equal(o.idMessage, r.variation.idEtatAvant); assert.match(o.idMessage, /^capacite-initiale-/);
  assert.deepEqual(o.donneesExaminees, [o.idMessage]);
  assert.equal(o.operationsExaminees.length, DESCRIPTIONS_OPERATIONS.length + DESCRIPTIONS_SOI.length);
  assert.ok(o.possibilites.some((a) => a.operation === 'soi:repos' && a.entree === 'etat' && a.donnee === o.idMessage));
  assert.ok(o.possibilites.some((a) => a.operation === 'soi:tour' && a.entree === 'etat' && a.donnee === o.idMessage));
  for (const a of o.possibilites) assert.equal(typeof a.donnee, 'string');
  // le datum de l'univers rendu est l'état propre, forme nombre, porteur { id, valeur, source } : aucun champ texte
  assert.equal(r.univers.length, 1); assert.deepEqual(r.univers[0].donnee, { identite: o.idMessage, forme: { forme: 'scalaire', genre: 'nombre' } });
  assert.equal(r.univers[0].porteur.valeur, 3); assert.equal(Object.hasOwn(r.univers[0].porteur, 'texte'), false); assert.deepEqual(r.univers[0].acces, { champ: 'valeur' });
  // une observation de tour (message) reste exactement comme avant : pas de champ source
  const t = await observerPossibilites({ id: 'message-1', texte: 'bonjour' }, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
  assert.equal(t.statut, 'ecrite'); assert.equal(Object.hasOwn(t.observation, 'source'), false); assert.deepEqual(t.univers[0].acces, DESCRIPTION_SOURCE_MESSAGE.acces);
  // enregistrerObservationPossibilites : source facultative, refusée si vide
  await assert.rejects(() => enregistrerObservationPossibilites(magasin, { idMessage: 'x', donneesExaminees: ['x'], operationsExaminees: [], possibilites: [], source: '' }), /source/);
});

test('5-6. LA PROJECTION UTILISE LA DÉSIGNATION : exécution projetée { id: V.id, idDesignation: D.id, soi:repos(etat = état d\'avant) → nouvel état } ; issue .73 calculable (exactement une exécution par désignation), pour 5 repos ; aucune collision', async () => {
  const magasin = magasinMemoireVive();
  const repos = []; for (let i = 0; i < 5; i++) repos.push(await tickRepos(magasin));
  const v = await lireExecutionsVecues(magasin);
  for (const r of repos) {
    const ex = v.executions.find((e) => e.id === r.variation.id);
    assert.deepEqual(ex, { id: r.variation.id, horodatage: r.variation.horodatage, idDesignation: r.designation.id, operation: 'soi:repos', liaisons: [{ entree: 'etat', donnee: r.variation.idEtatAvant }], resultat: r.variation.valeur });
    assert.equal(v.executions.filter((e) => e.idDesignation === r.designation.id).length, 1);
    assert.equal(v.executions.some((e) => e.idDesignation === r.tick.id), false, 'plus aucune exécution projetée sous l\'identité du tick');
  }
  const contextes = await magasin.lireTout('contextesProspectifs');
  assert.equal(contextes.length, 5);
  for (const c of contextes) { const i = issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions); assert.notEqual(i.issue, null); assert.equal(i.issue.idExecution, repos.find((r) => r.designation.id === c.idDesignation).variation.id); }
});

test('7-9. ATTENTE .74 SUR RÉPÉTITION, PLUSIEURS REPOS, SATURATION : après des tours actifs (c = 0), repos 0→1→2→3 puis 3→3 ; attente « relationValeur = differente » écrite avant la variation dès le 3e repos, réalisée, puis démentie à la saturation ; c reste 3', async () => {
  const magasin = magasinMemoireVive(); const h = () => new Date().toISOString();
  for (const o of ['o-1', 'o-2', 'o-3']) await tourActif(magasin, { idObservation: o, horodatage: h() });
  const r1 = await tickRepos(magasin), r2 = await tickRepos(magasin), r3 = await tickRepos(magasin), r4 = await tickRepos(magasin), r5 = await tickRepos(magasin);
  assert.deepEqual([r1, r2, r3, r4, r5].map((r) => [r.avant, r.apres]), [[0, 1], [1, 2], [2, 3], [3, 3], [3, 3]]);
  const attentes = await magasin.lireTout('attentesProspectives'); const contextes = await magasin.lireTout('contextesProspectifs'); const v = await lireExecutionsVecues(magasin);
  const rel = (r) => attentes.filter((a) => a.idDesignation === r.designation.id && a.chemin.join('.') === 'relationValeur');
  assert.equal(rel(r1).length, 0); assert.equal(rel(r2).length, 0); assert.equal(rel(r3).length, 1); assert.equal(rel(r4).length, 1); assert.equal(rel(r5).length, 0);
  for (const a of attentes.filter((x) => /^designation-application-/.test(x.idDesignation))) { const r = [r1, r2, r3, r4, r5].find((x) => x.designation.id === a.idDesignation); assert.ok(r); assert.ok(a.horodatage <= r.variation.horodatage, 'attente écrite avant la variation'); }
  const issue = (a) => issueDeLAttenteProspective(a, contextes.find((c) => c.id === a.idContexte), v.valeurs, v.executions, v.descriptions);
  assert.equal(issue(rel(r3)[0]).statut, 'realisee'); const d = issue(rel(r4)[0]); assert.equal(d.statut, 'autre'); assert.deepEqual(d.reel, { type: 'chaine', valeur: 'egale' });
  assert.equal((await lireCapacite(magasin)).valeur, 3); assert.equal((await lireCapacite(magasin)).nombreVariations, 8);
});

test('10-12. AUCUN DÉCLENCHEUR : l\'observation interne a des possibilités déterminées (parcourirStructure accepte toute donnée) et, avec un passé, des applications déterminées sur les productions — rien n\'est exécuté : aucune exécution, aucune désignation autre que soi:repos, aucune émission, aucun tourActif (c ne baisse jamais à cause d\'un repos)', async () => {
  const magasin = magasinMemoireVive(); const h = () => new Date().toISOString();
  // un passé réel : productions dans executionsOperations (via tourActif seulement ici : aucune exécution réelle ; on vérifie le cas pur)
  const r0 = await tickRepos(magasin);
  assert.ok(r0.observation.possibilites.some((a) => a.operation === 'parcourirStructure'), 'une possibilité déterminée observée sur l\'état lui-même');
  const avant = await comptes(magasin);
  for (let i = 0; i < 3; i++) await tickRepos(magasin);
  const apres = await comptes(magasin);
  assert.equal(apres.executionsOperations, avant.executionsOperations); assert.equal(apres.emissions, 0);
  assert.equal(apres.designations - avant.designations, 3); assert.ok((await magasin.lireTout('designations')).every((d) => d.operation === 'soi:repos'));
  assert.ok((await magasin.lireTout('variationsCapacite')).every((v) => v.cause.type === 'repos'));
  // garde statique : capacite.js n'importe ni n'appelle le déclencheur, l'exécution sollicitée, l'émission, et n'appelle tourActif qu'en export
  const cap = sansCommentaires(lu('app', 'langage', 'capacite.js'));
  assert.equal(/execution-mecanique|executerApplicationsDeterminees|execution-sollicitee|executerApplication|emettreLot|emettreProduction|environnement-conversation|invoquerOperation|setTimeout|setInterval/.test(cap), false);
  assert.equal((cap.match(/tourActif\(/g) || []).length, 1, 'tourActif est déclaré, jamais appelé dans capacite.js');
  const obs = sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'));
  assert.equal(/execution-mecanique|executerApplicationsDeterminees|tourActif|capacite\.js/.test(obs), false);
  // main.js : le déclencheur reste câblé UNIQUEMENT dans suivreObservationDuTour (tour), jamais sur capacite.repos
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.equal((main.match(/executerApplicationsDeterminees\(/g) || []).length, 1);
  assert.match(main, /repos: async \(\) => \{\s*const e = await ecranLangage\.assurerEsprit\(\);\s*return tickRepos\(e\.magasin\);\s*\}/);
});

test('13. HISTORIQUE .84 RELU SANS MODIFICATION : des variations sans idDesignation (lignes .84) restent projetées sous cause.id ; aucune désignation n\'est reconstruite ; une variation .85 à côté porte sa désignation ; les deux issues sont calculables', async () => {
  const magasin = magasinMemoireVive();
  const o = await enregistrerCapaciteInitiale(magasin, { valeur: 3 });
  // lignes « .84 » : écrites par la primitive SANS idDesignation (comme avant)
  const v1 = await enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: 'observation-ancienne-1' }, idEtatAvant: o.id, valeur: 2 });
  const v2 = await enregistrerVariationCapacite(magasin, { cause: { type: 'repos', id: 'tick-propre-ancien-1' }, idEtatAvant: identiteEtatApres(v1), valeur: 3 });
  assert.equal(Object.hasOwn(v1, 'idDesignation'), false); assert.equal(Object.hasOwn(v2, 'idDesignation'), false);
  const avant = JSON.stringify(await magasin.lireTout('variationsCapacite'));
  const r = await tickRepos(magasin); // ligne .85
  assert.equal(JSON.stringify((await magasin.lireTout('variationsCapacite')).slice(0, 2)), avant, 'les anciennes lignes ne sont pas touchées');
  assert.equal((await magasin.lireTout('designations')).length, 1, 'aucune désignation rétroactive');
  const p = projeterSoi(o, await magasin.lireTout('variationsCapacite'));
  assert.equal(p.executions.find((e) => e.id === v1.id).idDesignation, 'observation-ancienne-1');
  assert.equal(p.executions.find((e) => e.id === v2.id).idDesignation, 'tick-propre-ancien-1');
  assert.equal(p.executions.find((e) => e.id === r.variation.id).idDesignation, r.designation.id);
  const v = await lireExecutionsVecues(magasin);
  for (const c of await magasin.lireTout('contextesProspectifs')) assert.notEqual(issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions).issue, null);
  assert.equal((await lireCapacite(magasin)).valeur, 3); assert.equal((await lireCapacite(magasin)).nombreVariations, 3);
  // idDesignation vide refusé ; une désignation ne peut avoir qu'une issue
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'repos', id: 't-x' }, idEtatAvant: identiteEtatApres(r.variation), valeur: 3, idDesignation: '' }), /idDesignation/);
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'repos', id: 't-y' }, idEtatAvant: identiteEtatApres(r.variation), valeur: 3, idDesignation: r.designation.id }), /une désignation, une issue/);
});

test('14. FERMETURE / RECONSTRUCTION : un nouveau magasin recevant les mêmes lignes (ordre inversé) donne la même capacité, les mêmes exécutions projetées (idDesignation compris), les mêmes issues ; VERSION_BASE 23, SCHEMA 13, 28 tables (aucune table nouvelle)', async () => {
  const magasin = magasinMemoireVive(); const h = () => new Date().toISOString();
  await tourActif(magasin, { idObservation: 'o-1', horodatage: h() }); await tickRepos(magasin); await tickRepos(magasin); await tourActif(magasin, { idObservation: 'o-2', horodatage: h() }); await tickRepos(magasin);
  const autre = magasinMemoireVive();
  for (const t of TABLES) for (const ligne of [...(await magasin.lireTout(t))].reverse()) await autre.ecrire(t, JSON.parse(JSON.stringify(ligne)));
  assert.deepEqual(await lireCapacite(autre), await lireCapacite(magasin));
  const tri = (l) => [...l].sort((x, y) => x.id.localeCompare(y.id));
  const vA = await lireExecutionsVecues(magasin), vB = await lireExecutionsVecues(autre);
  assert.deepEqual(tri(vB.executions), tri(vA.executions)); assert.deepEqual(tri(vB.valeurs), tri(vA.valeurs));
  const issues = async (m, v) => (await m.lireTout('contextesProspectifs')).map((c) => issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions).issue?.idExecution ?? null).sort();
  assert.deepEqual(await issues(autre, vB), await issues(magasin, vA));
  assert.equal(VERSION_BASE, 23); assert.equal(SCHEMA_SAUVEGARDE, 13); assert.equal(TABLES.length, 28);
});

test('15. DEUX CONSÉQUENCES DÉSIGNÉES DANS UNE MÊME OBSERVATION : D1 = soi:repos(etat), D2 = soi:tour(etat) sur l\'observation interne d\'un même tick ; deux exécutions projetées (idDesignation D1 / D2), deux épisodes, deux issues calculables, zéro refus .73 ; la même identité pour les deux = refus (contrôle)', async () => {
  const magasin = magasinMemoireVive();
  const r = await tickRepos(magasin); // D1 réelle, V1 réelle
  const d2 = await enregistrerDesignation(magasin, { observation: r.observation, application: { operation: 'soi:tour', liaisons: [{ entree: 'etat', donnee: r.variation.idEtatAvant }] }, origine: 'mecanique' });
  assert.notEqual(d2.id, r.designation.id); assert.equal(d2.idObservation, r.observation.id);
  // seconde conséquence (dimension fictive) projetée à la main : même état d'avant, sa propre identité, idDesignation = D2
  const v = await lireExecutionsVecues(magasin);
  const V2 = { id: 'variation-fictive-1', horodatage: r.variation.horodatage, idDesignation: d2.id, operation: 'soi:tour', liaisons: [{ entree: 'etat', donnee: r.variation.idEtatAvant }], resultat: 2 };
  const executions = [...v.executions, V2]; const valeurs = [...v.valeurs, { id: 'etat-variation-fictive-1', valeur: 2, source: DESCRIPTION_SOURCE_SOI }];
  const descriptions = [...DESCRIPTIONS_OPERATIONS, ...DESCRIPTIONS_SOI];
  const { episodes } = episodesDeTransformation(valeurs, executions, descriptions);
  assert.equal(episodes.length, 2); assert.deepEqual(episodes.map((e) => e.chemin[0].operation).sort(), ['soi:repos', 'soi:tour']);
  const c2 = contextesProspectifs({ operation: 'soi:tour', liaisons: [{ entree: 'etat', donnee: r.variation.idEtatAvant }] }, v.valeurs, v.executions, descriptions).map((c, i) => ({ id: `d2/c${i}`, idDesignation: d2.id, idObservation: r.observation.id, ...c }));
  assert.equal(c2.length, 1);
  const [c1] = await magasin.lireTout('contextesProspectifs');
  assert.equal(issueDuContexteProspectif(c1, valeurs, executions, descriptions).issue.idExecution, r.variation.id);
  assert.equal(issueDuContexteProspectif(c2[0], valeurs, executions, descriptions).issue.idExecution, 'variation-fictive-1');
  // contrôle : si les deux conséquences portaient la même désignation, .73 refuserait les deux
  const partage = executions.map((e) => (e.id === 'variation-fictive-1' ? { ...e, idDesignation: r.designation.id } : e));
  assert.throws(() => issueDuContexteProspectif(c1, valeurs, partage, descriptions), /2 exécutions portent la désignation/);
});

test('L. LECTEUR DORMANT : la reconstruction d\'une observation (contexte-observation.js, clés closes) REFUSE une observation interne (dix clés) au lieu de la lire comme un message ; une observation de tour est toujours reconstruite', async () => {
  const magasin = magasinMemoireVive();
  const r = await tickRepos(magasin);
  const v = await lireExecutionsVecues(magasin);
  assert.throws(() => resoudreContexteObservation(r.observation.id, [r.observation], v.valeurs, [], [...DESCRIPTIONS_OPERATIONS, ...DESCRIPTIONS_SOI]), /mal formée|clés/);
  const t = await observerPossibilites({ id: 'message-1', texte: 'bonjour' }, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') });
  const ctx = resoudreContexteObservation(t.observation.id, [t.observation], [{ id: 'message-1', valeur: 'bonjour' }], [], DESCRIPTIONS_OPERATIONS);
  assert.ok(ctx);
});
// === FIN_TEST_OBSERVATION_INTERNE ===
