// === DEBUT_TEST_EMISSION_ACTE_PROSPECTIF ===
// v0.63.83 — L'ÉMISSION EST UN ACTE PROSPECTIF (décision ChatGPT, 09/10/2026) + branchement de LECTURE des exécutions vécues.
// Flux réel de J-B (lot → émission de chaque production → réception par le geste « Répondre »). À chaque émission réelle : acte persisté
// d'abord, puis contextes prospectifs de « environnement:conversation(emis = production) » et attentes A = B écrits AVANT toute réception
// possible, ancrés sur l'identité de l'émission ; plus tard, une réception déclarée est projetée en exécution environnementale et l'issue se
// calcule avec les mécanismes génériques inchangés. Aucune valence, aucune règle, aucune sélection, aucune interprétation du silence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { executionsVecues, lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { lireAttentesDuLot } from '../app/langage/attentes-du-tour.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerContexteProspectif, enregistrerAttenteProspective, enregistrerReception, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { issueDuContexteProspectif } from '../app/langage/issue-contexte-prospectif.js';
import { issueDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { attentePlate } from './projection-attente.mjs'; // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : projection de vérification vers la forme plate .64.6 (même information)

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const ENV = 'environnement:conversation';
const estEnv = (l) => Array.isArray(l.structure) && l.structure.some((s) => s.operation === ENV);

// ---------------------------------------------------------------------------------------------------- harnais = câblage de main.js (J-B)
let compteur = 0;
// MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chaque message est désormais traité ; le scénario ORDINAIRE émet de vraies productions NOUVELLES
// à chaque tour (elementsObservables sur un ensemble de chaînes agrandi, etc.). La fixture d'enrichissement extérieur introduite en .93 (sollicitation
// .77 de symbolesDeChaine sur le message) est RETIRÉE : elle doublait désormais une application que le lot exécute lui-même.
function monde(magasin = magasinMemoireVive()) {
  const nouvelId = (p) => `${p}-${++compteur}`;
  const ex2 = () => magasin.lireTout('executionsOperations');
  const tours = [];
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), async ({ observation, univers }) => {
      const lot = await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      return { ...lot, emises, echecEmission: echec };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    const reception = idEmission ? await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }) : null;
    tours.push({ texte, s, reception });
    return s;
  }
  const photo = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), emissions: await magasin.lireTout('emissions'), receptions: await magasin.lireTout('receptions'), contextes: await magasin.lireTout('contextesProspectifs'), attentes: (await magasin.lireTout('attentesProspectives')).map(attentePlate) /* MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) */, designations: await magasin.lireTout('designations') });
  return { magasin, tour, tours, photo };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna', 'encore', 'fin'];
// « Christophe » répond « oui » à l'émission de elementsObservables du tour précédent
async function vivre(n, { repondre = true, texte = 'oui' } = {}, magasin = undefined) {
  const w = monde(magasin); let enAttente = null;
  for (const t of SCENARIO.slice(0, n)) {
    const s = await w.tour(enAttente && repondre ? texte : t, repondre ? enAttente : null);
    const cible = s.emises.find((e) => e.operation === 'elementsObservables'); enAttente = cible ? cible.idEmission : null;
  }
  return w;
}
const issuesDe = (attentes, contextes, v) => attentes.map((a) => issueDeLAttenteProspective(a, contextes.find((c) => c.id === a.idContexte), v.valeurs, v.executions, v.descriptions));

// ============================================================================================================== A. PREMIER ACTE
test('A. PREMIER ACTE SANS PASSÉ RELATIONNEL : les émissions écrivent des contextes (à témoins vides : « jamais vécue ») ancrés sur l\'émission, et AUCUNE attente ; même après 9 tours sans réception : contextes oui, attentes d\'émission zéro', async () => {
  const w = await vivre(9, { repondre: false });
  const p = await w.photo();
  assert.equal(p.receptions.length, 0);
  const ctxEm = p.contextes.filter(estEnv);
  assert.ok(ctxEm.length > 0);
  for (const c of ctxEm) {
    assert.ok(p.emissions.some((e) => e.id === c.idDesignation), 'ancré sur une émission');
    assert.equal(c.application.operation, ENV); assert.deepEqual(c.temoins, []); assert.deepEqual(c.chemins, []);
    assert.equal(p.designations.some((d) => d.id === c.idDesignation), false, 'jamais une ligne de designations');
  }
  assert.equal(p.attentes.filter(estEnv).length, 0, 'aucune attente inventée');
  // les contextes/attentes des OPÉRATIONS sont strictement ceux du scénario ordinaire (test .74 C2) : MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE :
  // 70 (chaque message est traité) ; .93 : 0 ; .92 : 28 (réexécutions)
  const w7 = await vivre(7, { repondre: false }); const p7 = await w7.photo();
  assert.equal(p7.attentes.filter((a) => !estEnv(a)).length, 70); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
  assert.deepEqual(w7.tours.map((t) => t.s.choixAFaire.length), [0, 1, 5, 13, 13, 13, 13]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
});

// ============================================================================================================== B. ATTENTE AVANT RÉCEPTION
test('B. EXPÉRIENCES ANTÉRIEURES SUFFISANTES : des attentes d\'émission sont ÉCRITES (table attentesProspectives, idDesignation = émission) AVANT toute réception de cette émission ; leur horodatage précède la réception ; elles anticipent la relation (non_comparable) et le texte constant (« oui ») ; pour les classes jamais répondues, au plus des attentes sur le seul canal (MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : scénario dédié)', async () => {
  const w = await vivre(7); // MISE À JOUR DÉLIBÉRÉE v0.63.94 : scénario ORDINAIRE (les messages traités donnent des productions nouvelles émises) ; .93 : scénario dédié enrichi par l'extérieur
  const p = await w.photo();
  const att = p.attentes.filter(estEnv);
  assert.ok(att.length > 0);
  for (const a of att) {
    const em = p.emissions.find((e) => e.id === a.idDesignation); assert.ok(em, 'ancrée sur une émission');
    assert.ok(a.horodatage >= em.horodatage, 'après l\'acte');
    const r = p.receptions.find((x) => x.idEmission === a.idDesignation);
    if (r) assert.ok(a.horodatage < r.horodatage, 'AVANT la réception de cette émission');
    // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : dans le scénario dédié, d'autres classes (symbolesDeChaine) sont émises APRÈS la première réponse (dans l'ancien
    // scénario, aucune ne l'était : seules les réémissions DT6 de elementsObservables suivaient). Mesuré : leurs seules attentes portent sur la structure à
    // UN pas « environnement:conversation » (le canal, quel que soit le produit émis) ; toute structure qui nomme une opération du monde reste propre à la
    // classe répondue.
    if (p.executions.find((x) => x.id === em.idExecution).operation !== 'elementsObservables') assert.deepEqual(a.structure.map((k) => k.operation), [ENV], 'classe jamais répondue : seulement le canal');
  }
  assert.ok(att.some((a) => a.chemin.join('.') === 'relationValeur' && a.constat.valeur === 'non_comparable'));
  assert.ok(att.some((a) => a.chemin.join('.') === 'valeurs.arrivee' && a.constat.valeur === 'oui'));
  assert.equal(/reussite|réussite|recompense|récompense|score|preference|préférence|positi|negati|négati/i.test(JSON.stringify(att)), false);
});

// ============================================================================================================== C/D/E. ISSUES
test('C. RÉCEPTION IMMÉDIATE : issue null avant, puis réalisée (relation, texte) / autre (identités) après — calculée par les mécanismes existants sur les exécutions vécues ; D. RÉCEPTION TARDIVE : même attente historique, issue calculable au recalcul ; E. SILENCE : issue null après deux tours (MISE À JOUR DÉLIBÉRÉE v0.63.93 : trois → deux), aucun statut', async () => {
  const w = await vivre(6); // MISE À JOUR DÉLIBÉRÉE v0.63.94 : scénario ORDINAIRE (les messages traités donnent des productions nouvelles émises) ; .93 : scénario dédié enrichi par l'extérieur
  const p = await w.photo();
  const derniere = p.emissions.filter((e) => p.executions.find((x) => x.id === e.idExecution)?.operation === 'elementsObservables').at(-1);
  const att = p.attentes.filter((a) => a.idDesignation === derniere.id);
  assert.ok(att.length > 0);
  let v = await lireExecutionsVecues(w.magasin);
  for (const r of issuesDe(att, p.contextes, v)) { assert.equal(r.issue, null); assert.equal(Object.hasOwn(r, 'statut'), false); }
  // C. réponse immédiate
  await w.tour('oui', derniere.id);
  v = await lireExecutionsVecues(w.magasin);
  const apres = issuesDe(att, p.contextes, v);
  assert.ok(apres.every((r) => r.issue !== null));
  assert.ok(att.every((a, i) => a.chemin.join('.') !== 'relationValeur' || apres[i].statut === 'realisee'));
  assert.ok(att.some((a, i) => a.chemin.join('.') === 'valeurs.arrivee' && apres[i].statut === 'realisee' && apres[i].reel.valeur === 'oui'));
  assert.ok(att.some((a, i) => /^(arrivee|chemin\.\d+\.(execution|vers))$/.test(a.chemin.join('.')) && apres[i].statut === 'autre'));
  // D. tardive : une émission plus ancienne, jamais répondue, répondue maintenant (3 tours après)
  const ancienne = p.emissions.filter((e) => p.executions.find((x) => x.id === e.idExecution)?.operation === 'elementsObservables').at(-2);
  const attAnc = (await w.photo()).attentes.filter((a) => a.idDesignation === ancienne.id);
  const avantTard = issuesDe(attAnc, p.contextes, v);
  await w.tour('fin'); // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : un tour intermédiaire au lieu de deux (scénario dédié plus riche, donc plus lent : budget de temps du robot ; la propriété testée — issue calculable au recalcul, attente historique intacte — ne dépend pas du nombre de tours)
  await w.tour('oui', ancienne.id);
  v = await lireExecutionsVecues(w.magasin);
  const apresTard = issuesDe(attAnc, (await w.photo()).contextes, v);
  if (attAnc.length > 0) { assert.ok(avantTard.every((r) => r.issue === null)); assert.ok(apresTard.every((r) => r.issue !== null)); }
  assert.deepEqual((await w.photo()).attentes.filter((a) => a.idDesignation === ancienne.id), attAnc, 'même attente historique, rien de réécrit');
  // E. silence : l'émission du dernier tour (« oui ») n'est jamais répondue
  const pFin = await w.photo();
  const muette = pFin.emissions.filter((e) => pFin.executions.find((x) => x.id === e.idExecution)?.operation === 'elementsObservables').at(-1);
  const attMuette = pFin.attentes.filter((a) => a.idDesignation === muette.id);
  assert.ok(attMuette.length > 0);
  await w.tour('ter'); await w.tour('quater'); // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : deux tours de silence au lieu de trois (même raison de budget ; le silence ne produit jamais d'issue, quel que soit le nombre de tours)
  v = await lireExecutionsVecues(w.magasin);
  for (const r of issuesDe(attMuette, pFin.contextes, v)) { assert.equal(r.issue, null); assert.equal(Object.hasOwn(r, 'statut'), false); assert.equal(Object.hasOwn(r, 'reel'), false); }
});

// ============================================================================================================== F. PLUSIEURS RÉCEPTIONS
test('F. PLUSIEURS RÉCEPTIONS POUR UNE ÉMISSION : les deux réceptions sont représentées (deux exécutions vécues), mais l\'invariant existant « une issue par acte » (.73) REFUSE de calculer l\'issue — refus explicite, rien de choisi ; la présentation (jalon 1) montre « issue non calculable » tel quel', async () => {
  const w = await vivre(6); // MISE À JOUR DÉLIBÉRÉE v0.63.94 : scénario ORDINAIRE (les messages traités donnent des productions nouvelles émises) ; .93 : scénario dédié enrichi par l'extérieur
  const p = await w.photo();
  const derniere = p.emissions.filter((e) => p.executions.find((x) => x.id === e.idExecution)?.operation === 'elementsObservables').at(-1);
  const att = p.attentes.filter((a) => a.idDesignation === derniere.id); assert.ok(att.length > 0);
  await w.tour('oui', derniere.id); await w.tour('oui encore', derniere.id);
  const v = await lireExecutionsVecues(w.magasin);
  assert.equal(v.executions.filter((x) => x.idDesignation === derniere.id).length, 2);
  assert.throws(() => issueDeLAttenteProspective(att[0], p.contextes.find((c) => c.id === att[0].idContexte), v.valeurs, v.executions, v.descriptions), /2 exécutions portent la désignation/);
  const lu = await lireAttentesDuLot({ resultats: [], emises: [{ idEmission: derniere.id }] }, w.magasin);
  assert.ok(lu.attentes.length > 0); assert.ok(lu.attentes.every((l) => l.issue === null && /2 exécutions portent la désignation/.test(l.erreur)));
});

// ============================================================================================================== G. GARDE TEMPORELLE
test('G. GARDE TEMPORELLE : une réception de l\'émission courante ne peut jamais contribuer à ses contextes/attentes — (1) ordre réel : contexte et attente écrits avant que la réception existe ; (2) primitives : contexte ou attente REFUSÉS si une réception déclarée de cet acte existe déjà ; (3) les unités d\'issue d\'une attente sont toutes antérieures à l\'acte', async () => {
  const w = await vivre(6);
  const p = await w.photo();
  for (const a of p.attentes.filter(estEnv).filter((x) => !Object.hasOwn(x, 'fondation'))) { // MISE À JOUR DÉLIBÉRÉE v0.64.1 : unités [idContexte, idExecution, …] de la source .74 ; la source conditionnée (unités = identités d'épisodes, filtre temporel propre) est gardée dans attentes-conditionnees.test.mjs
    for (const u of a.unitesIssues) { const c = p.contextes.find((x) => x.id === u[0]); assert.ok(c); const r = p.receptions.find((x) => x.idEmission === c.idDesignation); assert.ok(r && r.horodatage < a.horodatage, 'unité antérieure'); assert.notEqual(c.idDesignation, a.idDesignation); }
  }
  const derniere = p.emissions.at(-1);
  await enregistrerReception(w.magasin, { environnement: 'conversation', idDonnee: p.valeurs.at(-1).id, idEmission: derniere.id });
  const acte = { id: derniere.id, idObservation: derniere.idObservation, operation: ENV, horodatage: derniere.horodatage };
  const ctx = contextesProspectifs({ operation: ENV, liaisons: [{ entree: 'emis', donnee: derniere.idExecution }] }, p.valeurs, p.executions, DESCRIPTIONS_OPERATIONS);
  await assert.rejects(enregistrerContexteProspectif(w.magasin, { designation: acte, contexte: ctx[0] }), /une réception déclarée existe déjà/);
  const c0 = p.contextes.find((c) => c.idDesignation === derniere.id);
  const attente = { description: { structure: c0.structure, chemin: ['relationValeur'], constat: { type: 'chaine', valeur: 'x' } }, preuve: { temoinsContexte: [], unitesIssues: [[c0.id]] }, references: { idContexte: c0.id, idDesignation: derniere.id } }; // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  await assert.rejects(enregistrerAttenteProspective(w.magasin, { designation: acte, contexte: c0, attente }), /une réception déclarée existe déjà/);
  // une désignation d'opération ordinaire reste gardée par executionsOperations exactement comme avant
  const d = p.designations.at(-1);
  await assert.rejects(enregistrerContexteProspectif(w.magasin, { designation: d, contexte: { ...ctx[0], application: { operation: d.operation, liaisons: d.liaisons } } }), /son exécution existe déjà/);
});

// ============================================================================================================== H. REDÉMARRAGE
test('H. REDÉMARRAGE : les faits persistés copiés dans un magasin neuf donnent les mêmes exécutions vécues, les mêmes attentes antérieures et la même issue retrouvée ; rien n\'a été écrit pour les projections', async () => {
  const w = await vivre(7); // MISE À JOUR DÉLIBÉRÉE v0.63.94 : scénario ORDINAIRE (les messages traités donnent des productions nouvelles émises) ; .93 : scénario dédié enrichi par l'extérieur
  const p = await w.photo();
  const v1 = await lireExecutionsVecues(w.magasin);
  const neuf = magasinMemoireVive();
  for (const t of TABLES) for (const ligne of await w.magasin.lireTout(t)) await neuf.ecrire(t, ligne);
  const v2 = await lireExecutionsVecues(neuf);
  assert.deepEqual(v2.executions, v1.executions); assert.deepEqual(v2.descriptions, v1.descriptions);
  assert.deepEqual((await neuf.lireTout('attentesProspectives')).map(attentePlate), p.attentes); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  const att = p.attentes.filter(estEnv).filter((a) => p.receptions.some((r) => r.idEmission === a.idDesignation));
  assert.ok(att.length > 0);
  assert.deepEqual(issuesDe(att, p.contextes, v2), issuesDe(att, p.contextes, v1));
  assert.ok(issuesDe(att, p.contextes, v2).every((r) => r.issue !== null));
  assert.equal(p.executions.some((x) => x.operation.startsWith('environnement:')), false, 'aucune exécution synthétique persistée');
  // la suite ordinaire reprend sur le magasin neuf sans migration ni réécriture
  const w2 = monde(neuf); await w2.tour('reprise');
  assert.equal((await neuf.lireTout('attentesProspectives')).length >= p.attentes.length, true);
});

// ============================================================================================================== I. INVARIANTS
test('I. INVARIANTS : choix et exécutions identiques avec ou sans réceptions ; toutes les productions sont émises (aucune sélection) ; aucune origine \'experience\' ; aucune table ni version nouvelle ; aucun lecteur d\'idDesignation ne consulte la table designations ; executionsVecues est pure', async () => {
  const sans = await vivre(7, { repondre: false }); const avec = await vivre(7);
  assert.deepEqual(avec.tours.map((t) => t.s.choixAFaire), sans.tours.map((t) => t.s.choixAFaire));
  assert.deepEqual(avec.tours.map((t) => t.s.automatiques.map((r) => [r.operation, r.statut])), sans.tours.map((t) => t.s.automatiques.map((r) => [r.operation, r.statut])));
  const pa = await avec.photo(); const ps = await sans.photo();
  assert.equal(pa.executions.length, ps.executions.length); assert.equal(pa.emissions.length, pa.executions.length); assert.equal(ps.emissions.length, ps.executions.length);
  assert.equal(VERSION_BASE, 28); assert.equal(SCHEMA_SAUVEGARDE, 18); assert.equal(TABLES.length, 34); // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 24 → 25 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 14 → 15 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 30 → 31 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.17 : 25 → 26 / 15 → 16 / 31 → 32 (+ table decisionsFormes : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables)
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    assert.equal(/origine:\s*['"]experience['"]|ORIGINE_EXPERIENCE/.test(code), false, rel(f));
  }
  for (const m of ['issue-contexte-prospectif', 'attentes-prospectives', 'issue-attente-prospective', 'experiences-attentes', 'contexte-prospectif', 'attentes-du-tour', 'executions-vecues', 'environnement-conversation']) {
    assert.equal(/lireTout\(\s*['"]designations['"]|['"]designations['"]/.test(sansCommentaires(lu('app', 'langage', `${m}.js`))), false, `${m} ne consulte pas la table designations`);
  }
  const vecues = sansCommentaires(lu('app', 'langage', 'executions-vecues.js'));
  assert.equal(/\.ecrire\(|new Date|Math\.random|prefer|préfér|score|recompense|récompense|silence|ignor|rejet/i.test(vecues), false);
  const faits = { valeurs: Object.freeze([]), executions: Object.freeze([]), emissions: Object.freeze([]), receptions: Object.freeze([]) };
  assert.deepEqual(executionsVecues(faits, Object.freeze([])), { valeurs: [], executions: [], descriptions: [] }); // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1) : la vue rend aussi `valeurs` (lignes réelles + données d'état projetées ; sans origine de capacité : les lignes réelles seules)
  assert.equal(/prefer|préfér|score|recompense|récompense|reussite|réussite|positi|negati|négati|utile|ignor|silence|rejet/i.test(sansCommentaires(lu('app', 'langage', 'environnement-conversation.js'))), false);
});
// === FIN_TEST_EMISSION_ACTE_PROSPECTIF ===
