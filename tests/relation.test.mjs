// === DEBUT_TEST_RELATION ===
// v0.63.86 — B2 : ÉTAT RELATIONNEL RÉEL + EXPÉRIENCE + ATTENTES (décision ChatGPT « APRÈS VALIDATION TÉLÉPHONE v0.63.85 », 10/10/2026).
// Les 24 tests obligatoires de la décision sont numérotés T1…T24 dans les intitulés. Modèle : r ∈ [0, 3], origine 0, tick → min(3, r + 1),
// réception DÉCLARÉE → 0 (0 → 0 est un vrai fait « egale »), message ordinaire : rien, silence : rien. Tick = UNE observation interne (c puis r)
// → D1 soi:repos(c) → D2 soi:temps(r) → contextes/attentes → V1, V2 → issues .73 distinctes. Réception → observation interne → D soi:reception(etat, recu)
// → variation (cause = la réception, idDesignation = D). Aucune orientation, aucune initiative, aucune cadence, aucune somme c/r.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerCapaciteInitiale, enregistrerVariationCapacite, enregistrerRelationInitiale, enregistrerVariationRelation, TABLES, CLE, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE, FORMAT_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, migrerDonnees } from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { lireCapacite, tourActif, PARAMETRES_B1 } from '../app/langage/capacite.js';
import { lireRelation, consequenceReception, applicationTemps, PARAMETRES_B2, CAUSE_TICK, CAUSE_RECEPTION } from '../app/langage/relation.js';
import { tickPropre, tickRepos } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { projeterRelation, projeterSoi, identiteEtatRelationApres, DESCRIPTIONS_SOI, PREFIXE_ETAT_RELATION } from '../app/langage/projection-soi.js';
import { issueDuContexteProspectif } from '../app/langage/issue-contexte-prospectif.js';
import { issueDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { DESCRIPTION_SOURCE_SOI } from '../app/langage/source-soi.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fichiersJs(join(d, e.name)) : /\.js$/.test(e.name) ? [join(d, e.name)] : []));
const rel = (f) => f.slice(RACINE.length + 1);
const comptes = async (m, tables) => Object.fromEntries(await Promise.all(tables.map(async (t) => [t, (await m.lireTout(t)).length])));
const CL = 'elementsObservables';

// Le PIPELINE RÉEL d'un tour (main.js) : observation du message → porte B1 → lot mécanique (.60) → émission (.83) → tourActif (.84) ; puis, si le
// message répond à une émission (geste « Répondre ») : réception déclarée → conséquence B2 (relation.js), exactement comme main.js.
function harnais() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin); const porte = avant.valeur === 0;
      const lot = porte ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      let capacite = { avant: avant.valeur, apres: avant.valeur, porte, variation: null };
      if (lot.resultats.some((r) => r.statut === 'executee')) { const t = await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage }); capacite = { ...capacite, apres: t.apres, variation: t.variation }; }
      return { ...lot, emises, echecEmission: echec, capacite };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    let reception = null, relation = null;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); reception = d.reception; relation = await consequenceReception(magasin, d.reception); }
    const emission = (s.emises.find((e) => e.operation === CL) ?? s.emises[0])?.idEmission ?? null; // la production la plus « observable » émise ce tour, sinon la première
    return { ...s, resultats: s.automatiques, emission, reception, relation, r: (await lireRelation(magasin)).valeur, c: (await lireCapacite(magasin)).valeur };
  }
  return { magasin, tour, tick: () => tickPropre(magasin) };
}

test('T1. BASE NEUVE : c = 3, r = 0 ; PARAMETRES_B2 gelés (plafond 3, montée 1 : paramètres primitifs provisoires) ; causes « tick » et « reception » ; deux tables en dernier (clé id), VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables ; l\'origine r = 0 est écrite UNE fois, au premier besoin de la lire, jamais avant', async () => {
  assert.deepEqual(PARAMETRES_B2, { plafond: 3, montee: 1 }); assert.ok(Object.isFrozen(PARAMETRES_B2));
  assert.equal(CAUSE_TICK, 'tick'); assert.equal(CAUSE_RECEPTION, 'reception');
  assert.deepEqual(TABLES.slice(-2), ['relationInitiale', 'variationsRelation']); assert.equal(CLE.relationInitiale, 'id'); assert.equal(CLE.variationsRelation, 'id');
  assert.equal(TABLES.length, 30); assert.equal(VERSION_BASE, 24); assert.equal(SCHEMA_SAUVEGARDE, 14);
  const magasin = magasinMemoireVive();
  assert.equal((await magasin.lireTout('relationInitiale')).length, 0);
  const c = await lireCapacite(magasin); assert.equal(c.valeur, PARAMETRES_B1.plafond); assert.equal(c.valeur, 3);
  assert.equal((await magasin.lireTout('relationInitiale')).length, 0, 'lire c n\'écrit rien pour r');
  const r = await lireRelation(magasin); assert.equal(r.valeur, 0); assert.equal(r.nombreVariations, 0); assert.equal(r.derniere, null); assert.match(r.idEtat, /^relation-initiale-/);
  const origines = await magasin.lireTout('relationInitiale'); assert.equal(origines.length, 1); assert.equal(origines[0].valeur, 0); assert.equal(origines[0].id, r.idEtat);
  const r2 = await lireRelation(magasin); assert.deepEqual(r2, r); assert.equal((await magasin.lireTout('relationInitiale')).length, 1);
  assert.equal((await magasin.lireTout('variationsRelation')).length, 0);
});

test('T2 + T24. HISTORIQUE .85 : un magasin portant des lignes B1 .84 (sans idDesignation) et .85 (avec idDesignation) voit B2 apparaître à r = 0 SANS modifier l\'histoire (tables B1 et exécutions projetées B1 identiques avant/après) ; aucune reconstruction rétroactive de r ; l\'ancienne projection B1 reste lisible', async () => {
  const magasin = magasinMemoireVive();
  const o = await enregistrerCapaciteInitiale(magasin, { valeur: 3 });
  const v1 = await enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: 'obs-84-1' }, idEtatAvant: o.id, valeur: 2 });                    // ligne .84 (pas d'idDesignation)
  const v2 = await enregistrerVariationCapacite(magasin, { cause: { type: 'repos', id: 'tick-85-1' }, idEtatAvant: `etat-propre-${v1.id}`, valeur: 3, idDesignation: 'designation-application-85-1' }); // ligne .85
  assert.equal(v1.idDesignation, undefined); assert.equal(v2.idDesignation, 'designation-application-85-1');
  const avantB1 = JSON.stringify([await magasin.lireTout('capaciteInitiale'), await magasin.lireTout('variationsCapacite')]);
  const vecuAvant = await lireExecutionsVecues(magasin);
  const soiAvant = vecuAvant.executions.filter((e) => /^soi:/.test(e.operation));
  assert.deepEqual(soiAvant.map((e) => [e.operation, e.idDesignation]), [['soi:tour', 'obs-84-1'], ['soi:repos', 'designation-application-85-1']]); // T24 : .84 → cause.id ; .85 → idDesignation
  assert.equal((await magasin.lireTout('relationInitiale')).length, 0, 'aucune origine B2 tant que personne ne la lit');
  const r = await lireRelation(magasin); assert.equal(r.valeur, 0); assert.equal(r.nombreVariations, 0);
  assert.equal(JSON.stringify([await magasin.lireTout('capaciteInitiale'), await magasin.lireTout('variationsCapacite')]), avantB1, 'l\'histoire B1 n\'est pas touchée');
  const vecu = await lireExecutionsVecues(magasin);
  assert.deepEqual(vecu.executions.filter((e) => /^soi:(tour|repos)$/.test(e.operation)), soiAvant, 'la projection B1 est inchangée');
  assert.equal(vecu.executions.filter((e) => /^soi:(temps|reception)$/.test(e.operation)).length, 0, 'aucune exécution B2 inventée pour le passé');
  assert.equal(vecu.valeurs.filter((v) => v.id.startsWith(PREFIXE_ETAT_RELATION)).length, 0);
  assert.equal(vecu.valeurs.filter((v) => v.id === r.idEtat).length, 1, 'la donnée d\'état relationnel courante est projetée (origine)');
  assert.equal((await lireCapacite(magasin)).valeur, 3);
});

test('T3-T7. TICK : UNE observation interne (données [c, r], source soi, forme nombre, idMessage = identité de c), DEUX désignations distinctes (D1 soi:repos(c), D2 soi:temps(r)) sur la même observation, DEUX exécutions projetées distinctes { id: V.id, idDesignation: D.id }, DEUX issues .73 calculables, ZÉRO collision « 2 exécutions » ; l\'identité du tick n\'est jamais un idDesignation ; ordre réel des écritures : O → D1 → D2 → contextes → V1 → V2', async () => {
  const magasin = magasinMemoireVive(); const journal = []; const ecrire = magasin.ecrire.bind(magasin);
  magasin.ecrire = async (table, ligne) => { journal.push(table); return ecrire(table, ligne); };
  await tourActif(magasin, { idObservation: 'o-1', horodatage: new Date().toISOString() }); journal.length = 0; // c = 2 pour que la conséquence B1 bouge
  const t = await tickPropre(magasin);
  assert.match(t.tick.id, /^tick-propre-/);
  assert.equal(t.observation.source, 'soi'); assert.equal(t.observation.donneesExaminees.length, 2); assert.equal(t.observation.idMessage, t.observation.donneesExaminees[0]);
  assert.deepEqual(t.univers.map((u) => u.porteur.valeur), [2, 0]); assert.deepEqual(t.univers.map((u) => u.donnee.identite), t.observation.donneesExaminees);
  for (const u of t.univers) assert.deepEqual(u.porteur.source, DESCRIPTION_SOURCE_SOI);
  assert.equal(t.univers.length, 2);
  const observations = await magasin.lireTout('observationsPossibilites'); assert.equal(observations.length, 1, 'une seule observation interne pour les deux conséquences');
  const d1 = t.designation, d2 = t.relation.designation;
  assert.notEqual(d1.id, d2.id); assert.equal(d1.idObservation, t.observation.id); assert.equal(d2.idObservation, t.observation.id);
  assert.equal(d1.operation, 'soi:repos'); assert.equal(d2.operation, 'soi:temps'); assert.equal(d1.origine, 'mecanique'); assert.equal(d2.origine, 'mecanique');
  assert.equal(d1.liaisons[0].donnee, t.observation.donneesExaminees[0]); assert.equal(d2.liaisons[0].donnee, t.observation.donneesExaminees[1]); assert.match(d1.liaisons[0].donnee, /^etat-propre-/); assert.match(d2.liaisons[0].donnee, /^relation-initiale-/);
  assert.deepEqual(applicationTemps({ idEtat: d2.liaisons[0].donnee }), { operation: 'soi:temps', liaisons: [{ entree: 'etat', donnee: d2.liaisons[0].donnee }] });
  assert.ok(t.observation.possibilites.some((p) => p.operation === 'soi:repos')); assert.ok(t.observation.possibilites.some((p) => p.operation === 'soi:temps'));
  assert.equal(t.variation.idDesignation, d1.id); assert.equal(t.relation.variation.idDesignation, d2.id);
  assert.deepEqual(t.variation.cause, { type: 'repos', id: t.tick.id }); assert.deepEqual(t.relation.variation.cause, { type: 'tick', id: t.tick.id });
  assert.notEqual(t.variation.idDesignation, t.tick.id); assert.notEqual(t.relation.variation.idDesignation, t.tick.id);
  assert.equal(t.avant, 2); assert.equal(t.apres, 3); assert.equal(t.relation.avant, 0); assert.equal(t.relation.apres, 1);
  // deux exécutions projetées distinctes
  const vecu = await lireExecutionsVecues(magasin);
  const e1 = vecu.executions.find((e) => e.id === t.variation.id), e2 = vecu.executions.find((e) => e.id === t.relation.variation.id);
  assert.ok(e1 && e2); assert.notEqual(e1.id, e2.id); assert.equal(e1.idDesignation, d1.id); assert.equal(e2.idDesignation, d2.id); assert.equal(e1.operation, 'soi:repos'); assert.equal(e2.operation, 'soi:temps');
  assert.equal(vecu.executions.filter((e) => e.idDesignation === d1.id).length, 1); assert.equal(vecu.executions.filter((e) => e.idDesignation === d2.id).length, 1);
  assert.equal(vecu.executions.filter((e) => e.idDesignation === t.tick.id).length, 0);
  // deux issues .73 calculables, aucun refus
  const contextes = (await magasin.lireTout('contextesProspectifs')).filter((k) => k.idDesignation !== 'o-1'); assert.equal(contextes.length, 2); // (le contexte du tour actif préalable est écarté)
  assert.deepEqual(contextes.map((k) => k.idDesignation), [d1.id, d2.id]); assert.deepEqual(contextes.map((k) => k.application.operation), ['soi:repos', 'soi:temps']);
  const issues = contextes.map((k) => issueDuContexteProspectif(k, vecu.valeurs, vecu.executions, vecu.descriptions));
  assert.deepEqual(issues.map((i) => i.issue.idExecution), [t.variation.id, t.relation.variation.id]);
  // ordre réel des écritures
  const sansTables = journal.filter((x) => x !== 'capaciteInitiale' && x !== 'relationInitiale');
  assert.deepEqual(sansTables, ['observationsPossibilites', 'designations', 'designations', 'contextesProspectifs', 'contextesProspectifs', 'variationsCapacite', 'variationsRelation']);
  assert.equal(tickRepos, tickPropre);
});

test('T8 + T21. TICKS : r 0 → 1 → 2 → 3 → 3 → 3 ; la saturation est un vrai fait vécu « egale » : au 3e tick l\'attente « relationValeur = differente » existe et se réalise ; au 4e elle est écrite puis démentie (réel « egale », statut « autre ») ; au 5e, deux issues vécues → plus d\'attente directe ; aucune autre variation que les ticks', async () => {
  const magasin = magasinMemoireVive();
  const t = []; for (let i = 0; i < 5; i++) t.push(await tickPropre(magasin));
  assert.deepEqual(t.map((x) => [x.relation.avant, x.relation.apres]), [[0, 1], [1, 2], [2, 3], [3, 3], [3, 3]]);
  const r = await lireRelation(magasin); assert.equal(r.valeur, 3); assert.equal(r.nombreVariations, 5); assert.equal(r.derniere.id, t[4].relation.variation.id);
  const variations = await magasin.lireTout('variationsRelation'); assert.ok(variations.every((v) => v.cause.type === 'tick'));
  assert.deepEqual(variations.map((v) => v.valeur), [1, 2, 3, 3, 3]);
  for (let i = 1; i < variations.length; i++) assert.equal(variations[i].idEtatAvant, identiteEtatRelationApres(variations[i - 1]), 'un pas à la fois : chaque variation part de l\'état produit par la précédente');
  const contextes = await magasin.lireTout('contextesProspectifs'); const attentes = await magasin.lireTout('attentesProspectives'); const v = await lireExecutionsVecues(magasin);
  const relV = (x) => attentes.filter((a) => a.idDesignation === x.relation.variation.idDesignation && a.chemin.join('.') === 'relationValeur');
  assert.equal(relV(t[0]).length, 0); assert.equal(relV(t[1]).length, 0); assert.equal(relV(t[2]).length, 1); assert.equal(relV(t[3]).length, 1); assert.equal(relV(t[4]).length, 0);
  const issue = (a) => issueDeLAttenteProspective(a, contextes.find((k) => k.id === a.idContexte), v.valeurs, v.executions, v.descriptions);
  assert.equal(relV(t[2])[0].constat.valeur, 'differente'); assert.equal(issue(relV(t[2])[0]).statut, 'realisee');
  const dementie = issue(relV(t[3])[0]); assert.equal(dementie.statut, 'autre'); assert.deepEqual(dementie.reel, { type: 'chaine', valeur: 'egale' }); assert.equal(dementie.issue.idExecution, t[3].relation.variation.id);
  for (const a of relV(t[3])) assert.ok(a.horodatage <= t[3].relation.variation.horodatage, 'attente écrite AVANT la variation');
  // l'épisode de saturation est bien « egale » dans les constats génériques
  const { episodes } = episodesDeTransformation(v.valeurs, v.executions, v.descriptions);
  const sat = episodes.filter((e) => e.chemin.length === 1 && e.chemin[0].operation === 'soi:temps' && e.chemin[0].execution === t[4].relation.variation.id);
  assert.equal(sat.length, 1); assert.equal(sat[0].relationValeur, 'egale'); assert.deepEqual(sat[0].valeurs, { depart: 3, arrivee: 3 });
  const premiers = episodes.filter((e) => e.chemin.length === 1 && e.chemin[0].operation === 'soi:temps').map((e) => e.relationValeur); assert.deepEqual(premiers.sort(), ['differente', 'differente', 'differente', 'egale', 'egale']);
});

test('T9-T10 + T16-T17. RÉCEPTION DÉCLARÉE à r = 3 : 3 → 0 ; à r = 0 : 0 → 0 (variation réelle, cause = la réception, désignation propre soi:reception(etat, recu = la réception), observation interne dont l\'univers est le vécu projeté) ; l\'identité de la réception n\'est jamais idDesignation ; aucune exécution, aucune émission causées par le tick ni par la conséquence B2', async () => {
  const h = harnais();
  const s1 = await h.tour('bonjour Pixel'); assert.ok(s1.emission); assert.equal(s1.r, 0);
  await h.tick(); await h.tick(); await h.tick(); assert.equal((await lireRelation(h.magasin)).valeur, 3);
  const avant = await comptes(h.magasin, ['executionsOperations', 'emissions', 'receptions', 'designations', 'observationsPossibilites']);
  const t = await h.tick(); // T17 : le tick à saturation n'exécute ni n'émet rien
  const apresTick = await comptes(h.magasin, ['executionsOperations', 'emissions', 'receptions', 'designations', 'observationsPossibilites']);
  assert.deepEqual(apresTick, { ...avant, designations: avant.designations + 2, observationsPossibilites: avant.observationsPossibilites + 1 });
  assert.equal(t.relation.avant, 3); assert.equal(t.relation.apres, 3);
  // T9 : réception à r = 3
  const s2 = await h.tour('bonjour Luna', s1.emission);
  assert.ok(s2.reception); assert.equal(s2.reception.idEmission, s1.emission); assert.equal(s2.relation.avant, 3); assert.equal(s2.relation.apres, 0); assert.equal(s2.r, 0);
  const v = s2.relation.variation; assert.deepEqual(v.cause, { type: 'reception', id: s2.reception.id }); assert.equal(v.valeur, 0);
  const d = s2.relation.designation; assert.equal(v.idDesignation, d.id); assert.notEqual(d.id, s2.reception.id); assert.match(d.id, /^designation-application-/);
  assert.equal(d.operation, 'soi:reception'); assert.equal(d.origine, 'mecanique'); assert.deepEqual(d.liaisons.map((l) => l.entree), ['etat', 'recu']); assert.equal(d.liaisons[1].donnee, s2.reception.id);
  assert.equal(d.idObservation, s2.relation.observation.id); assert.equal(s2.relation.observation.source, 'soi'); assert.equal(s2.relation.observation.idMessage, v.idEtatAvant);
  assert.equal(s2.relation.univers.find((u) => u.donnee.identite === v.idEtatAvant)?.porteur.valeur, 3, 'l\'état d\'AVANT est le datum de l\'observation interne');
  assert.ok(s2.relation.univers.some((u) => u.donnee.identite === s2.reception.id), 'la réception est dans l\'univers de l\'observation interne (production projetée de environnement:conversation)');
  assert.ok(s2.relation.observation.possibilites.some((p) => p.operation === 'soi:reception' && p.entree === 'recu' && p.donnee === s2.reception.id), 'la possibilité soi:reception(recu = la réception) est constatée par l\'observation interne');
  // T16 : la conséquence B2 n'a rien exécuté ni émis au-delà du tour lui-même (le tour réel a ses propres exécutions/émissions)
  const vecu = await lireExecutionsVecues(h.magasin);
  const e = vecu.executions.find((x) => x.id === v.id); assert.ok(e); assert.equal(e.operation, 'soi:reception'); assert.equal(e.idDesignation, d.id);
  assert.equal(vecu.executions.filter((x) => x.idDesignation === s2.reception.id).length, 0, 'la réception n\'est pas un idDesignation');
  assert.equal(vecu.executions.filter((x) => x.idDesignation === d.id).length, 1);
  const kR = (await h.magasin.lireTout('contextesProspectifs')).filter((k) => k.idDesignation === d.id); assert.ok(kR.length >= 1);
  for (const k of kR) assert.equal(issueDuContexteProspectif(k, vecu.valeurs, vecu.executions, vecu.descriptions).issue.idExecution, v.id);
  // T10 : réception à r = 0 → 0 → 0, vrai fait
  assert.ok(s2.emission);
  const s3 = await h.tour('bonjour Max', s2.emission);
  assert.equal(s3.relation.avant, 0); assert.equal(s3.relation.apres, 0); assert.equal(s3.relation.variation.valeur, 0); assert.equal(s3.relation.variation.idEtatAvant, identiteEtatRelationApres(v));
  assert.notEqual(s3.relation.designation.id, d.id); assert.equal(s3.relation.designation.liaisons[1].donnee, s3.reception.id);
  const vecu3 = await lireExecutionsVecues(h.magasin);
  const { episodes } = episodesDeTransformation(vecu3.valeurs, vecu3.executions, vecu3.descriptions);
  const ep = episodes.filter((x) => x.chemin.length === 1 && x.chemin[0].operation === 'soi:reception' && /^(relation-initiale-|etat-relation-)/.test(x.depart)); // départ = l'état relationnel (l'autre départ possible est la réception elle-même, liaison recu)
  assert.equal(ep.length, 2, 'deux épisodes soi:reception depuis l\'état (3 → 0 puis 0 → 0)');
  assert.equal(episodes.filter((x) => x.chemin.length === 1 && x.chemin[0].operation === 'soi:reception' && x.depart === s2.reception.id).length, 1, 'et un épisode depuis la réception (liaison recu) : la chaîne générique du monde vers soi');
  assert.deepEqual(ep.map((x) => x.relationValeur).sort(), ['differente', 'egale']); assert.deepEqual(ep.map((x) => x.valeurs.arrivee), [0, 0]);
  assert.equal((await lireRelation(h.magasin)).nombreVariations, 6);
});

test('T11. MESSAGE ORDINAIRE (sans « Répondre ») : aucune variation de type réception, r inchangé, aucune observation interne, aucune désignation soi:* ; T12. RÉPONSE TARDIVE : une émission ancienne, des ticks jusqu\'à r = 3, puis la réponse à cette émission → r 3 → 0 au moment RÉEL de la déclaration (horodatage postérieur aux ticks, idEtatAvant = l\'état saturé), aucun antidatage', async () => {
  const h = harnais();
  const s1 = await h.tour('bonjour Pixel'); const em = s1.emission; assert.ok(em);
  await h.tick(); await h.tick(); assert.equal((await lireRelation(h.magasin)).valeur, 2);
  const avant = await comptes(h.magasin, ['variationsRelation', 'designations', 'observationsPossibilites', 'receptions']);
  const s2 = await h.tour('bonjour Luna'); // message ordinaire
  assert.equal(s2.reception, null); assert.equal(s2.relation, null); assert.equal(s2.r, 2);
  const apres = await comptes(h.magasin, ['variationsRelation', 'designations', 'observationsPossibilites', 'receptions']);
  assert.equal(apres.variationsRelation, avant.variationsRelation); assert.equal(apres.receptions, avant.receptions);
  assert.equal(apres.observationsPossibilites, avant.observationsPossibilites + 1, 'la seule observation nouvelle est celle du message (source message)');
  assert.ok((await h.magasin.lireTout('designations')).filter((d) => d.operation === 'soi:reception').length === 0);
  await h.tick(); const t4 = await h.tick(); assert.equal(t4.relation.apres, 3);
  // T12 : réponse tardive à l'émission du premier tour
  const s3 = await h.tour('bonjour Pixel', em);
  assert.equal(s3.reception.idEmission, em); assert.equal(s3.relation.avant, 3); assert.equal(s3.relation.apres, 0); assert.equal(s3.r, 0);
  assert.equal(s3.relation.variation.idEtatAvant, identiteEtatRelationApres(t4.relation.variation), 'la satisfaction part de l\'état saturé réel, pas d\'un état passé');
  assert.ok(s3.relation.variation.horodatage >= t4.relation.variation.horodatage); assert.ok(s3.reception.horodatage >= t4.relation.variation.horodatage);
  const variations = await h.magasin.lireTout('variationsRelation'); assert.deepEqual(variations.map((v) => v.cause.type), ['tick', 'tick', 'tick', 'tick', 'reception']);
  assert.deepEqual(variations.map((v) => v.valeur), [1, 2, 3, 3, 0]);
});

test('T13. RÉCEPTIONS MULTIPLES d\'une même émission : B2 cohérent (1re : r → 0 ; 2e : 0 → 0, deux causes réelles distinctes, deux désignations, deux variations) ; la limite .73 de l\'ÉMISSION est documentée telle quelle (deux exécutions projetées portent la désignation de l\'émission → issue d\'émission non calculable), AUCUNE correction', async () => {
  const h = harnais();
  const s1 = await h.tour('bonjour Pixel'); const em = s1.emission; assert.ok(em);
  await h.tick(); await h.tick();
  const s2 = await h.tour('bonjour Luna', em); assert.equal(s2.relation.avant, 2); assert.equal(s2.relation.apres, 0);
  const s3 = await h.tour('bonjour Max', em); assert.equal(s3.relation.avant, 0); assert.equal(s3.relation.apres, 0);
  assert.notEqual(s2.reception.id, s3.reception.id); assert.notEqual(s2.relation.designation.id, s3.relation.designation.id); assert.notEqual(s2.relation.variation.id, s3.relation.variation.id);
  assert.equal(s3.relation.variation.idEtatAvant, identiteEtatRelationApres(s2.relation.variation));
  const vecu = await lireExecutionsVecues(h.magasin);
  // B2 : chaque conséquence a sa propre issue calculable
  const contextes = await h.magasin.lireTout('contextesProspectifs');
  for (const s of [s2, s3]) { const k = contextes.filter((x) => x.idDesignation === s.relation.designation.id); assert.ok(k.length >= 1); for (const x of k) assert.equal(issueDuContexteProspectif(x, vecu.valeurs, vecu.executions, vecu.descriptions).issue.idExecution, s.relation.variation.id); } // plusieurs contextes par conséquence (un par structure d'amont de la réception : conversation, elementsObservables > conversation, …), tous calculables
  // limite .73 de l'émission, inchangée : deux réceptions projetées sous la désignation de l'émission
  const projeteesEmission = vecu.executions.filter((e) => e.idDesignation === em);
  assert.equal(projeteesEmission.length, 2);
  const kEm = contextes.filter((x) => x.idDesignation === em);
  assert.ok(kEm.length >= 1, 'l\'émission a ses contextes prospectifs (.83)');
  for (const k of kEm) assert.throws(() => issueDuContexteProspectif(k, vecu.valeurs, vecu.executions, vecu.descriptions), /2 exécutions portent la désignation/); // LIMITE CONNUE, INCHANGÉE (décision du 10/10 : pas de correction opportuniste) : l'issue de l'émission reste non calculable quand deux réceptions y répondent
});

test('T14-T15. c = 0, r = 3 : un message est observé mais B1 bloque l\'activité mécanique (porte, aucune exécution, aucune émission, aucun tourActif) ; r reste 3 (aucune réception, aucun tick) ; un tick : c 0 → 1 ET r 3 → 3 (deux conséquences indépendantes, aucune somme) ; une réception ramène ensuite r à 0 indépendamment de c', async () => {
  const h = harnais();
  const s1 = await h.tour('bonjour Pixel'); const s2 = await h.tour('bonjour Luna'); const s3 = await h.tour('bonjour Max');
  assert.equal(s3.c, 0); assert.ok(s3.emission || s2.emission || s1.emission);
  for (let i = 0; i < 3; i++) await h.tick(); // c 0 → 3 ; r 0 → 3
  const sA = await h.tour('bonjour Pixel'); const sB = await h.tour('bonjour Luna'); const sC = await h.tour('bonjour Max'); // c 3 → 0 ; r reste 3
  assert.equal(sC.c, 0); assert.equal(sC.r, 3);
  const avant = await comptes(h.magasin, ['executionsOperations', 'emissions', 'variationsCapacite', 'variationsRelation']);
  const s4 = await h.tour('bonjour Pixel et Luna'); // T14 : porte
  assert.equal(s4.capacite.porte, true); assert.equal(s4.resultats.length, 0); assert.equal(s4.emises.length, 0); assert.equal(s4.capacite.variation, null);
  assert.deepEqual(await comptes(h.magasin, ['executionsOperations', 'emissions', 'variationsCapacite', 'variationsRelation']), avant);
  assert.equal(s4.c, 0); assert.equal(s4.r, 3);
  const t = await h.tick(); // T15
  assert.equal(t.avant, 0); assert.equal(t.apres, 1); assert.equal(t.relation.avant, 3); assert.equal(t.relation.apres, 3);
  const em = sC.emission || sB.emission || sA.emission; assert.ok(em);
  const s5 = await h.tour('bonjour Max', em); // réception à c = 1
  assert.equal(s5.relation.avant, 3); assert.equal(s5.relation.apres, 0);
  assert.equal(s5.c, 0, 'c a payé le tour actif (1 → 0), indépendamment de r');
});

test('T16-T18 (statique). AUCUN DÉCLENCHEUR, AUCUNE CADENCE, AUCUNE ORIENTATION : relation.js, tick-propre.js, prospection-soi.js n\'appellent ni le déclencheur mécanique, ni l\'émission, ni tourActif, ni setInterval/setTimeout ; aucun mécanisme de décision (exécution mécanique, émission, environnement, sollicitation, pont, esprit) ne lit r ; main.js n\'importe de B2 que lireRelation, consequenceReception, PARAMETRES_B2 et ne compare jamais r ; aucune somme c/r ; vocabulaire : aucun mot psychologique', () => {
  const soi = ['relation.js', 'tick-propre.js', 'prospection-soi.js', 'projection-soi.js'].map((f) => [f, sansCommentaires(lu('app', 'langage', f))]);
  for (const [f, code] of soi) {
    assert.equal(/setInterval|setTimeout|requestAnimationFrame|requestIdleCallback/.test(code), false, f);
    assert.equal(/executerApplicationsDeterminees|executerApplicationAvecOrigine|emettreLot|enregistrerEmission|enregistrerExecutionOperation|tourActif\(|execution-mecanique|environnement-conversation|emission\.js/.test(code), false, f);
    assert.equal(/solitude|bonheur|tristesse|affection|joie|peur|manque|envie|désir|desir|plaisir|douleur|récompense|recompense|punition|score|préfér|prefer/i.test(code), false, `vocabulaire : ${f}`);
    assert.equal(/\.valeur\s*\+\s*\w+\.valeur|c\.valeur\s*[+\-*/]\s*r\.valeur|r\.valeur\s*[+\-*/]\s*c\.valeur/.test(code), false, `aucune somme c/r : ${f}`);
  }
  // T18 : personne ne LIT r pour décider
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f); if (/\/(relation|tick-propre|executions-vecues|projection-soi|connaissances|prospection-soi)\.js$/.test(r) || r === 'app/memoire/sauvegarde.js') continue; // sauvegarde.js : export/import des tables, aucune décision
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    if (r === 'app/main.js') continue;
    assert.equal(/lireRelation|variationsRelation|relationInitiale|relation\.js/.test(code), false, `${r} ne lit ni ne nomme l'état relationnel`);
  }
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.match(main, /^import \{ lireRelation, consequenceReception, PARAMETRES_B2 \} from '\.\/langage\/relation\.js';$/m);
  assert.equal((main.match(/lireRelation\(/g) || []).length, 1, 'une seule lecture de r dans main.js : la présentation (capacite.lire)');
  assert.equal((main.match(/consequenceReception\(/g) || []).length, 1, 'une seule conséquence B2 dans main.js : après une réception déclarée');
  assert.equal(/relation\.valeur\s*[<>=!]|\.relation\.valeur\s*[<>=!]|r\.valeur\s*[<>=!]|PARAMETRES_B2\.plafond\s*[<>=!]/.test(main), false, 'main.js ne compare jamais r');
  assert.equal(/setInterval|setTimeout\([^)]*(tick|repos|relation)/i.test(main), false);
  const ecran = lu('app', 'conversation', 'ecran.js');
  assert.equal(/solitude|bonheur|tristesse|affection/i.test(ecran), false, 'aucun vocabulaire psychologique à l\'écran');
  // le tick n'est appelé que par le bouton Repos (dispositif de validation)
  assert.equal((main.match(/tickPropre\(/g) || []).length, 1);
  assert.match(main, /repos: async \(\) => \{\s*const e = await ecranLangage\.assurerEsprit\(\);\s*return tickPropre\(e\.magasin\);\s*\}/);
});

test('T19-T20. EXPÉRIENCE GÉNÉRIQUE : après quelques réceptions, les familles mixtes « environnement:conversation > soi:reception » (et leurs prolongements elementsObservables > …) apparaissent sans pont spécial ; une attente « valeurs.arrivee = 0 » existe sur la conséquence soi:reception AVANT sa variation et se réalise ; aucune attente n\'est fabriquée pour une émission silencieuse', async () => {
  const h = harnais();
  let s = await h.tour('bonjour Pixel'); let em = s.emission; await h.tick(); await h.tick();
  s = await h.tour('bonjour Luna', em); em = s.emission; await h.tick();
  s = await h.tour('bonjour Max', em); em = s.emission; await h.tick(); await h.tick(); await h.tick();
  const silencieuse = s.emises.find((e) => e.idEmission !== em)?.idEmission; // une émission du même tour qui ne recevra JAMAIS de réponse
  s = await h.tour('au revoir Pixel', em); em = s.emission; await h.tick();
  const derniere = await h.tour('bonjour Luna', em);
  const v = await lireExecutionsVecues(h.magasin);
  const { episodes } = episodesDeTransformation(v.valeurs, v.executions, v.descriptions); const { familles } = famillesDEpisodes({ episodes });
  const mixtes = familles.filter((f) => f.structure.some((k) => k.operation === 'soi:reception') && f.structure.some((k) => !k.operation.startsWith('soi:'))).map((f) => f.structure.map((k) => k.operation).join('>'));
  assert.ok(mixtes.includes('environnement:conversation>soi:reception'), mixtes.join(' ; '));
  assert.ok(mixtes.some((m) => /^elementsObservables>environnement:conversation>soi:reception$/.test(m)), mixtes.join(' ; '));
  // T20 : attente valeurs.arrivee = 0 écrite avant la dernière variation de réception, réalisée
  const contextes = await h.magasin.lireTout('contextesProspectifs'); const attentes = await h.magasin.lireTout('attentesProspectives');
  const d = derniere.relation.designation.id; const att = attentes.filter((a) => a.idDesignation === d && a.chemin.join('.') === 'valeurs.arrivee');
  assert.ok(att.length >= 1, 'une attente valeurs.arrivee sur la conséquence soi:reception');
  for (const a of att) {
    assert.deepEqual(a.constat, { type: 'nombre', valeur: 0 }); assert.ok(a.horodatage <= derniere.relation.variation.horodatage);
    const issue = issueDeLAttenteProspective(a, contextes.find((k) => k.id === a.idContexte), v.valeurs, v.executions, v.descriptions);
    assert.equal(issue.statut, 'realisee'); assert.equal(issue.issue.idExecution, derniere.relation.variation.id);
  }
  // silence : aucune attente, aucun contexte, aucune variation ne concerne l'émission restée sans réponse
  assert.ok(silencieuse);
  assert.equal(v.executions.filter((e) => e.idDesignation === silencieuse).length, 0);
  assert.equal(attentes.filter((a) => a.idDesignation === silencieuse).length, 0);
  assert.equal((await h.magasin.lireTout('variationsRelation')).filter((x) => x.cause.type === 'reception').length, 4);
  const toutesIssues = contextes.filter((k) => /^soi:/.test(k.application.operation)).map((k) => { try { return issueDuContexteProspectif(k, v.valeurs, v.executions, v.descriptions).issue ? 'ok' : 'sans'; } catch { return 'refus'; } });
  assert.equal(toutesIssues.filter((x) => x === 'refus').length, 0, 'aucun refus .73 sur les conséquences sur soi');
});

test('T22. FERMETURE / RECHARGEMENT : un nouveau magasin recevant les mêmes lignes (ordre inversé) reconstruit c et r identiquement, les mêmes exécutions projetées (B1 et B2, idDesignation compris), les mêmes issues ; projeterRelation est déterministe et refuse une fourche', async () => {
  const h = harnais();
  let s = await h.tour('bonjour Pixel'); await h.tick(); await h.tick(); s = await h.tour('bonjour Luna', s.emission); await h.tick(); await h.tour('bonjour Max', s.emission);
  const autre = magasinMemoireVive();
  for (const t of TABLES) for (const ligne of [...(await h.magasin.lireTout(t))].reverse()) await autre.ecrire(t, JSON.parse(JSON.stringify(ligne)));
  assert.deepEqual(await lireRelation(autre), await lireRelation(h.magasin)); assert.deepEqual(await lireCapacite(autre), await lireCapacite(h.magasin));
  const tri = (l) => [...l].sort((x, y) => x.id.localeCompare(y.id));
  const vA = await lireExecutionsVecues(h.magasin), vB = await lireExecutionsVecues(autre);
  assert.deepEqual(tri(vB.executions), tri(vA.executions)); assert.deepEqual(tri(vB.valeurs), tri(vA.valeurs)); assert.deepEqual(vB.descriptions.map((d) => d.nom).sort(), vA.descriptions.map((d) => d.nom).sort());
  const issues = async (m, v) => (await m.lireTout('contextesProspectifs')).map((c) => { try { return issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions).issue?.idExecution ?? null; } catch { return 'refus'; } }).sort();
  assert.deepEqual(await issues(autre, vB), await issues(h.magasin, vA));
  // projection pure déterministe
  const origine = (await h.magasin.lireTout('relationInitiale'))[0], variations = await h.magasin.lireTout('variationsRelation');
  const p1 = projeterRelation(origine, variations), p2 = projeterRelation(origine, [...variations].reverse());
  assert.deepEqual(tri(p1.executions), tri(p2.executions)); assert.deepEqual(tri(p1.valeurs), tri(p2.valeurs)); assert.equal(p1.executions.length, variations.length); assert.equal(p1.valeurs.length, variations.length + 1);
  assert.deepEqual(p1.executions.map((e) => e.operation), variations.map((v) => (v.cause.type === 'tick' ? 'soi:temps' : 'soi:reception'))); assert.deepEqual(p1.executions.map((e) => e.idDesignation), variations.map((v) => v.idDesignation));
  assert.throws(() => projeterRelation(origine, [...variations, { ...variations[0], id: 'doublon' }]), TypeError);
  assert.ok(DESCRIPTIONS_SOI.some((d) => d.nom === 'soi:temps') && DESCRIPTIONS_SOI.some((d) => d.nom === 'soi:reception'));
  assert.equal(typeof projeterSoi, 'function');
});

test('T23. SAUVEGARDE / RESTAURATION : schéma 14 ; la sauvegarde complète exporte relationInitiale et variationsRelation et les relit ; une sauvegarde .85 (schéma 13, sans ces tables) est acceptée et complétée par des tables VIDES (aucune donnée inventée) ; une sauvegarde de schéma 14 incomplète est refusée', async () => {
  const magasin = magasinMemoireVive(); await tickPropre(magasin); await tickPropre(magasin);
  const memoire = { lireTout: async () => [], exporterDonnees: async () => ({}), tables: [] };
  const sauvegarde = await construireSauvegardeComplete({ memoire, magasinLangage: magasin, idNaissance: 'n', versionAppli: 'x', maintenant: new Date('2026-10-10T09:00:00.000Z') });
  assert.equal(sauvegarde.objet.schema, 14); assert.equal(sauvegarde.objet.donnees.langage.relationInitiale.length, 1); assert.equal(sauvegarde.objet.donnees.langage.variationsRelation.length, 2);
  const lu14 = await lireSauvegardeComplete(sauvegarde.contenu, { tablesMemoire: [] });
  assert.equal(lu14.ok, true); assert.equal(lu14.donnees.langage.variationsRelation.length, 2); assert.deepEqual(lu14.donnees.langage.variationsRelation.map((v) => v.valeur), [1, 2]);
  const restaure = magasinMemoireVive(); for (const t of TABLES) for (const l of lu14.donnees.langage[t]) await restaure.ecrire(t, l);
  assert.deepEqual(await lireRelation(restaure), await lireRelation(magasin));
  // sauvegarde .85 : schéma 13, sans les deux tables
  const langage85 = { ...sauvegarde.objet.donnees.langage }; delete langage85.relationInitiale; delete langage85.variationsRelation;
  const donnees85 = { ...sauvegarde.objet.donnees, langage: langage85 };
  const f85 = { ...sauvegarde.objet, schema: 13, donnees: donnees85, empreinte: await empreinte(JSON.stringify(donnees85)) };
  const lu13 = await lireSauvegardeComplete(JSON.stringify(f85), { tablesMemoire: [] });
  assert.equal(lu13.ok, true, lu13.erreur); assert.deepEqual(lu13.donnees.langage.relationInitiale, []); assert.deepEqual(lu13.donnees.langage.variationsRelation, []);
  assert.deepEqual(migrerDonnees({ a: [1] }, ['a', 'relationInitiale'], 13), { a: [1], relationInitiale: [] });
  const r85 = magasinMemoireVive(); for (const t of TABLES) for (const l of lu13.donnees.langage[t]) await r85.ecrire(t, l);
  assert.equal((await lireRelation(r85)).valeur, 0, 'après une restauration .85, B2 repart de r = 0 au premier besoin');
  // schéma courant incomplet : refus
  const f14 = { ...sauvegarde.objet, donnees: donnees85, empreinte: f85.empreinte };
  const refus = await lireSauvegardeComplete(JSON.stringify(f14), { tablesMemoire: [] }); assert.equal(refus.ok, false);
  assert.equal(FORMAT_SAUVEGARDE, 'naissance-sauvegarde-complete');
});

test('V. VISIBILITÉ TÉLÉPHONE (statique) : bandeau « capacité c = X / 3 — relation r = Y / 3 » ; bulle de Repos « tick T / B1 : c X → Y / B2 : r A → B » avec les identités des conséquences ; réception « relation : r A → 0 — cause : réception <id> » ; main.js transmet l\'état r à la présentation (capacite.lire) et la conséquence B2 telle quelle', () => {
  const ecran = lu('app', 'conversation', 'ecran.js'); const main = sansCommentaires(lu('app', 'main.js'));
  assert.match(ecran, /relation r = \$\{c\.relation\.valeur\} \/ \$\{c\.relation\.plafond\}/);
  assert.match(ecran, /`tick \$\{r\.variation\.cause\.id\}\\nB1 : c \$\{r\.avant\} → \$\{r\.apres\}/); assert.match(ecran, /\\nB2 : r \$\{b2\.avant\} → \$\{b2\.apres\}/);
  assert.match(ecran, /conséquence B2 désignée/); assert.match(ecran, /variation B2/);
  assert.match(ecran, /relation : r \$\{[^}]+\} → \$\{[^}]+\} — cause : réception \$\{/);
  assert.match(ecran, /relation : r \$\{[^}]+\} → \$\{[^}]+\} \(cause : réception \$\{/);
  assert.match(main, /relation: \{ valeur: r\.valeur, plafond: PARAMETRES_B2\.plafond/);
  assert.match(main, /relation = \{ \.\.\.\(await consequenceReception\(e\.magasin, declaree\.reception\)\), echec: null \}/);
  assert.equal(/\bdesignation\b/i.test(main), false, 'main.js ne manipule aucune désignation : il transmet le résultat de la conséquence tel quel');
});
// === FIN_TEST_RELATION ===
