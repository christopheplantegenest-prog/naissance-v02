// v0.64.31 — RETROUVAILLE-1 « RETROUVER UNE RELATION DANS LE PRÉSENT AVANT L'ATTENTE » (GO ChatGPT « GO DÉVELOPPEMENT RETROUVAILLE-1 —
// v0.64.31 », 16/10/2026 ; conception approuvée : travail/v0.64.31/). Avant d'écrire toute nouvelle attente pour un acte, chaque contexte
// prospectif porte le groupe `retrouvaille` : la relation persistée dont le domaine et la partie connue correspondent EXACTEMENT au présent,
// sur un attendu encore ouvert ; abstention si plusieurs relations distinctes restent compatibles ou si une comparaison pertinente est
// impossible. Tests T1–T19 de la conception, TA–TJ des ajustements, Diagnostic et gardes.
// Le vécu est produit par le VRAI flux (harnais de tests/relations-formulees.test.mjs : tours, émissions, ticks, capacité) ; les cas qui
// n'apparaissent pas naturellement passent par le VRAI calcul (retrouvailleDuContexte) sur des contextes RÉELS et des lignes forgées à
// partir de lignes réelles, ou par le VRAI écrivain.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as CALCUL from '../app/langage/retrouvailles.js';
import * as FORME from '../app/langage/retrouvaille-forme.js';
import * as VUE from '../app/langage/retrouvailles-persistees.js';
import { retrouvailleDuContexte, retrouvaillesDesContextes } from '../app/langage/retrouvailles.js';
import { validerRetrouvaille, CAUSES_ABSTENTION, STATUTS_RETROUVAILLE } from '../app/langage/retrouvaille-forme.js';
import { relireRetrouvailles, attentesEcritesParContexte } from '../app/langage/retrouvailles-persistees.js';
import { partieConnueEpisode } from '../app/langage/episodes-de-transformation.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerContexteProspectif, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { lireCapacite, peutAgir, tourActif, PARAMETRES_B1 } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { texteDiagnostic, MARQUE_NON_OUVERTE } from '../app/conversation/texte-diagnostic.js';
import { attentePlate } from './projection-attente.mjs';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(js|html)$/.test(p) ? [p] : []; });
const rel = (f) => f.slice(RACINE.length + 1);
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const avecRelation = (l) => l.description && Object.hasOwn(l.description, 'relation');

// ---------------------------------------------------------------------------------------------------------------- magasin instrumenté
// journal : chaque lecture et écriture, dans l'ordre réel ; lireBrut : lecture non instrumentée.
function instrumenter(magasin, { journal, aveugle = false }) {
  const lireTout = magasin.lireTout.bind(magasin);
  const ecrire = magasin.ecrire.bind(magasin);
  magasin.lireBrut = lireTout;
  magasin.lireTout = async (table) => {
    const lignes = aveugle && table === 'attentesProspectives' ? [] : await lireTout(table);
    if (journal) journal.push({ op: 'lire', table, ids: lignes.map((l) => l.id), idsActes: lignes.map((l) => (l.references ? l.references.idDesignation : l.idDesignation)) });
    return lignes;
  };
  magasin.ecrire = async (table, objet) => {
    if (journal) journal.push({ op: 'ecrire', table, id: objet.id, objet: structuredClone(objet) });
    return ecrire(table, objet);
  };
  return magasin;
}

// ---------------------------------------------------------------------------------------------------------------- vécu réel
function monde({ journal = null, aveugle = false, magasin: base = null } = {}) {
  const magasin = instrumenter(base ?? magasinMemoireVive(), { journal, aveugle }); let n = 0; const nouvelId = (p) => `${p}-r31-${++n}`;
  async function tour(texte, cout = PARAMETRES_B1.coutTourActif) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage }, { ...PARAMETRES_B1, coutTourActif: cout });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function tick(k) { for (let i = 0; i < k; i += 1) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  // Une étape : ses contextes NOUVEAUX (ordre de la table).
  async function etape([genre, x, cout]) {
    const avant = new Set((await magasin.lireBrut('contextesProspectifs')).map((c) => c.id));
    if (genre === 'msg') await tour(x, cout); else await tick(x);
    return (await magasin.lireBrut('contextesProspectifs')).filter((c) => !avant.has(c.id));
  }
  return { magasin, tour, tick, etape };
}
// Scénario sondé (16/10/2026) : c 3 → 2 → 1, Repos, c 2 → 1, Repos, … ; « sept » à c = 1 donne le premier départ 1 de soi:tour.
const SCENARIO = [['msg', 'bonjour'], ['msg', 'salut'], ['tick', 3], ['msg', 'un'], ['msg', 'deux'], ['tick', 3], ['msg', 'trois'], ['msg', 'quatre'], ['tick', 3], ['msg', 'cinq'], ['msg', 'six'], ['msg', 'sept']];
async function vivre(plan, options) {
  const w = monde(options); const etapes = [];
  for (const p of plan) etapes.push({ etiquette: p[1], contextes: await w.etape(p) });
  return { w, etapes };
}
let partage = null;
const JOURNAL = [];
const vecuPartage = () => (partage ??= vivre(SCENARIO, { journal: JOURNAL })); // lecture seule pour tous les tests qui le partagent

const tourDe = (etapes, etiquette) => etapes.find((e) => e.etiquette === etiquette).contextes.find((c) => vue(c.structure) === 'soi:tour(etat)');
const departDe = async (magasin, c) => { const v = await lireExecutionsVecues(magasin); return partieConnueEpisode(c.episodePartiel, v.valeurs, v.executions, v.descriptions).valeurs.depart; };
const sansGroupe = (c) => { const { retrouvaille, ...reste } = c; return reste; };
// La relation réelle d'une ligne (copie) et la ligne réelle qui porte R (opération, départ, attendu) dans la table.
const R = (l) => structuredClone(l.description.relation);
async function ligneR(magasin, operation, depart, attendu) {
  return (await magasin.lireBrut('attentesProspectives')).find((l) => avecRelation(l) && vue(l.description.relation.domaine) === `${operation}(etat)` && l.description.relation.connu.valeurs.depart === depart && JSON.stringify(l.description.relation.attendu) === JSON.stringify(attendu));
}
// Ligne FORGÉE à partir d'une ligne réelle : autre identité, autre acte ; relation et preuve au choix.
let forgees = 0;
function forger(gabarit, { id, relation, preuve } = {}) {
  const l = structuredClone(gabarit);
  forgees += 1;
  l.id = id === undefined ? `attente-forgee-${forgees}` : id;
  if (id === null) delete l.id;
  l.references = { ...l.references, idDesignation: `acte-forge-${forgees}` };
  if (relation !== undefined) l.description.relation = relation;
  if (preuve !== undefined) l.preuve = preuve;
  delete l.reconnaissance;
  return l;
}
const ARRIVEE = (v) => ({ valeurs: { arrivee: v } });
const avecConnu = (r, depart) => ({ ...structuredClone(r), connu: { valeurs: { depart } } });
const avecAttendu = (r, attendu) => ({ ...structuredClone(r), attendu });
async function vecu(magasin) { return lireExecutionsVecues(magasin); }
async function contexteDepart(magasin, etapes, depart) {
  for (const e of etapes) { const c = e.contextes.find((x) => vue(x.structure) === 'soi:tour(etat)'); if (c && await departDe(magasin, c) === depart) return c; }
  throw new Error(`aucun contexte soi:tour au départ ${depart}`);
}
// Pont Diagnostic (même code que main.js : deux lectures, deux fonctions séparées).
async function pontRetrouvailles(magasin) {
  const [contextes, lignes] = await Promise.all([magasin.lireTout('contextesProspectifs'), magasin.lireTout('attentesProspectives')]);
  return { relues: relireRetrouvailles(contextes), attentes: attentesEcritesParContexte(lignes) };
}
async function redemarrer(magasin, modifier = (d) => d) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await (magasin.lireBrut ?? magasin.lireTout)(t)));
  const neuf = magasinMemoireVive();
  await neuf.remplacerTout(modifier(donnees));
  return neuf;
}

// ================================================================================================================ T1 / cible téléphone
test('T1. VRAI FLUX : soi:tour départ 2 → retrouvee {depart:2}→{arrivee:1} ; formulations = les deux lignes 2→1 antérieures ; l\'instantané lu ne contenait aucune attente de l\'acte ; le contexte est écrit AVANT toute attente de l\'acte, et la 1re attente conditionnée de l\'acte le référence', async () => {
  const { w, etapes } = await vecuPartage();
  const deux = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const lignes21 = (await w.magasin.lireBrut('attentesProspectives')).filter((l) => avecRelation(l) && vue(l.description.relation.domaine) === 'soi:tour(etat)' && l.description.relation.connu.valeurs.depart === 2);
  const six = tourDe(etapes, 'six');
  assert.equal(await departDe(w.magasin, six), 2);
  const g = six.retrouvaille;
  assert.equal(g.statut, 'retrouvee');
  assert.deepEqual(g.relations.map((r) => r.relation), [R(deux)]);
  assert.deepEqual(g.relations[0].relation, { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: { valeurs: { arrivee: 1 } } });
  // les deux formulations antérieures (« deux », sans antécédent ; « quatre », reconnue v0.64.29), jamais celle de l'acte présent
  const avantSix = lignes21.filter((l) => l.references.idDesignation !== six.idDesignation);
  assert.equal(avantSix.length, 2);
  assert.deepEqual(g.relations[0].formulations, avantSix.map((l) => l.id));
  assert.deepEqual(g.nonComparees, []);
  assert.equal(Object.hasOwn(g, 'causes'), false);
  // ordre réel (journal) : lecture de l'instantané → écriture du contexte (groupe compris) → attentes de l'acte
  const iCtx = JOURNAL.findIndex((e) => e.op === 'ecrire' && e.table === 'contextesProspectifs' && e.id === six.id);
  assert.deepEqual(JOURNAL[iCtx].objet.retrouvaille, g, 'le groupe est écrit AVEC le contexte, une seule fois');
  const lecture = JOURNAL.slice(0, iCtx).findLast((e) => e.op === 'lire' && e.table === 'attentesProspectives');
  assert.equal(lecture.idsActes.includes(six.idDesignation), false, 'l\'instantané ne contenait aucune attente de l\'acte');
  for (const id of g.relations[0].formulations) assert.ok(lecture.ids.includes(id));
  const attentesActe = JOURNAL.map((e, i) => ({ e, i })).filter(({ e }) => e.op === 'ecrire' && e.table === 'attentesProspectives' && e.objet.references.idDesignation === six.idDesignation);
  assert.ok(attentesActe.length > 0);
  assert.ok(attentesActe.every(({ i }) => i > iCtx), 'toute attente de l\'acte est écrite après la retrouvaille');
  const premiere = attentesActe.find(({ e }) => avecRelation(e.objet)).e.objet;
  assert.equal(premiere.references.idContexte, six.id);
  assert.deepEqual(premiere.description.relation, g.relations[0].relation, 'K0 formule ensuite la même relation, sans avoir lu le groupe');
});

// ================================================================================================================ T2–T11 sur contextes réels
test('T2. présent départ 3, seules R 2→1 et 1→0 persistées → aucune', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c3 = await contexteDepart(w.magasin, etapes, 3);
  const r10 = avecAttendu(avecConnu(R(g21), 1), ARRIVEE(0));
  assert.deepEqual(retrouvailleDuContexte(sansGroupe(c3), [forger(g21), forger(g21, { relation: r10 })], v), { statut: 'aucune', relations: [], nonComparees: [] });
});

test('T3. même connu, domaine différent : soi:repos et soi:temps ne se confondent jamais (vrai flux et calcul)', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const tous = etapes.flatMap((e) => e.contextes);
  for (const c of tous.filter((x) => ['soi:repos(etat)', 'soi:temps(etat)'].includes(vue(x.structure)))) {
    for (const r of c.retrouvaille.relations) assert.equal(vue(r.relation.domaine), vue(c.structure), 'le domaine retrouvé est exactement celui du présent');
  }
  const temps = await ligneR(w.magasin, 'soi:temps', 3, { relationValeur: 'egale' });
  const cRepos = tous.find((x) => vue(x.structure) === 'soi:repos(etat)' && x.retrouvaille.statut === 'retrouvee' && x.retrouvaille.relations[0].relation.connu.valeurs.depart === 3);
  assert.ok(temps && cRepos, 'les deux domaines ont le même connu {depart:3}');
  assert.equal(retrouvailleDuContexte(sansGroupe(cRepos), [forger(temps)], v).statut, 'aucune', 'une R soi:temps n\'est pas retrouvée pour soi:repos');
});

test('T4. même domaine, connu différent → aucune ; T7. R formulée une seule fois → retrouvee', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  assert.equal(retrouvailleDuContexte(sansGroupe(c2), [forger(g21, { relation: avecAttendu(avecConnu(R(g21), 3), ARRIVEE(2)) })], v).statut, 'aucune');
  const une = forger(g21);
  assert.deepEqual(retrouvailleDuContexte(sansGroupe(c2), [une], v), { statut: 'retrouvee', relations: [{ relation: R(g21), formulations: [une.id] }], nonComparees: [] });
});

test('T5. trois lignes de la même R → une relation, trois formulations (ordre de l\'instantané) ; aucun code ne lit formulations.length pour décider', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  const trois = [forger(g21), forger(g21), forger(g21)];
  const g = retrouvailleDuContexte(sansGroupe(c2), trois, v);
  assert.equal(g.statut, 'retrouvee'); assert.equal(g.relations.length, 1);
  assert.deepEqual(g.relations[0].formulations, trois.map((l) => l.id));
  assert.deepEqual(retrouvailleDuContexte(sansGroupe(c2), [...trois].reverse(), v).relations[0].formulations, [...trois].reverse().map((l) => l.id), 'ordre sans signification : seul l\'ordre de lecture change');
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    if (rel(f) === 'app/langage/retrouvaille-forme.js') { for (const l of code.split('\n').filter((x) => /formulations\.length/.test(x))) assert.match(l, /refuser\(/, 'la forme ne lit la longueur que pour refuser (liste non vide, sans répétition)'); continue; }
    assert.doesNotMatch(code, /formulations\.length|formulations\[/, rel(f));
  }
});

test('T6 / TC. R1 (D,K,X) et R2 (D,K,Y) compatibles et distinctes → abstention [relations-distinctes], les deux copiées', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  const x = forger(g21); const y = forger(g21, { relation: avecAttendu(R(g21), ARRIVEE(0)) });
  assert.deepEqual(retrouvailleDuContexte(sansGroupe(c2), [x, y], v), {
    statut: 'abstention', relations: [{ relation: R(g21), formulations: [x.id] }, { relation: avecAttendu(R(g21), ARRIVEE(0)), formulations: [y.id] }], nonComparees: [], causes: ['relations-distinctes'],
  });
});

test('T8. lignes pré-v0.64.7 (plate), pré-v0.64.29 (sans reconnaissance), v0.64.29 sans et avec antécédents : même statut, UN candidat', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const reelles = (await w.magasin.lireBrut('attentesProspectives')).filter((l) => avecRelation(l) && vue(l.description.relation.domaine) === 'soi:tour(etat)' && l.description.relation.connu.valeurs.depart === 2);
  const avecAntecedent = reelles.find((l) => l.reconnaissance.formulationsAnterieures.length > 0);
  const sansAntecedent = reelles.find((l) => l.reconnaissance.formulationsAnterieures.length === 0);
  const pre29 = forger(sansAntecedent);
  const plate = attentePlate(forger(sansAntecedent));
  assert.equal(Object.hasOwn(plate, 'description'), false);
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  const instantane = [plate, pre29, sansAntecedent, avecAntecedent];
  const g = retrouvailleDuContexte(sansGroupe(c2), instantane, v);
  assert.equal(g.statut, 'retrouvee');
  assert.deepEqual(g.relations, [{ relation: R(sansAntecedent), formulations: instantane.map((l) => l.id) }]);
  for (const seule of instantane) assert.equal(retrouvailleDuContexte(sansGroupe(c2), [seule], v).statut, 'retrouvee', 'chaque forme seule donne le même statut');
});

test('T9. même R, témoins / fondations différents → même candidat ; changer témoins ou fondation ne change pas le groupe', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  const a = forger(g21, { id: 'attente-a' }); const b = forger(g21, { id: 'attente-b' });
  const autrePreuve = structuredClone(g21.preuve);
  autrePreuve.temoinsContexte = [['execution-autre']]; autrePreuve.unitesIssues = [['execution-autre']]; autrePreuve.fondation[0].couverture = [['execution-autre'], ['execution-autre-2']];
  const b2 = forger(g21, { id: 'attente-b', preuve: autrePreuve });
  const g1 = retrouvailleDuContexte(sansGroupe(c2), [a, b], v); const g2 = retrouvailleDuContexte(sansGroupe(c2), [a, b2], v);
  assert.deepEqual(g1, g2);
  assert.deepEqual(g1.relations[0].formulations, ['attente-a', 'attente-b']);
});

test('T10. 2→1 et 1→0 persistées : départ 2 → seulement 2→1 ; départ 1 → seulement 1→0 ; jamais de fusion', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const r10 = forger(g21, { relation: avecAttendu(avecConnu(R(g21), 1), ARRIVEE(0)) }); const r21 = forger(g21);
  const c2 = await contexteDepart(w.magasin, etapes, 2); const c1 = await contexteDepart(w.magasin, etapes, 1);
  assert.deepEqual(retrouvailleDuContexte(sansGroupe(c2), [r10, r21], v).relations, [{ relation: R(g21), formulations: [r21.id] }]);
  assert.deepEqual(retrouvailleDuContexte(sansGroupe(c1), [r10, r21], v).relations, [{ relation: r10.description.relation, formulations: [r10.id] }]);
  assert.equal(c1.retrouvaille.statut, 'aucune', 'vrai flux : premier départ 1, aucune R 1→0 persistée');
});

test('T11. chemins de l\'attendu respectés exactement : attendu {valeurs:{arrivee}} sur soi:tour ; un chemin d\'attendu non ouvert ne correspond jamais ; un attendu sans valeur non plus', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  for (const attendu of [{ valeurs: { inconnu: 1 } }, { autre: { arrivee: 1 } }, { valeurs: {} }, {}]) {
    assert.equal(retrouvailleDuContexte(sansGroupe(c2), [forger(g21, { relation: avecAttendu(R(g21), attendu) })], v).statut, 'aucune', JSON.stringify(attendu));
  }
  // vrai flux : soi:temps retrouve un attendu { relationValeur }, soi:tour un attendu { valeurs: { arrivee } } — chacun sur ses chemins ouverts
  const tous = etapes.flatMap((e) => e.contextes);
  const temps = tous.find((c) => vue(c.structure) === 'soi:temps(etat)' && c.retrouvaille.statut === 'retrouvee');
  assert.deepEqual(temps.retrouvaille.relations[0].relation.attendu, { relationValeur: 'egale' });
  // relationValeur est un chemin OUVERT du présent soi:tour : une R { relationValeur } y est retrouvée ; avec la R { valeurs: { arrivee } },
  // ce sont deux relations distinctes compatibles → abstention (jamais un choix entre elles)
  const rv = forger(g21, { relation: avecAttendu(R(g21), { relationValeur: 'egale' }) }); const ar = forger(g21);
  assert.deepEqual(retrouvailleDuContexte(sansGroupe(c2), [rv], v).relations.map((r) => r.relation.attendu), [{ relationValeur: 'egale' }]);
  const deux = retrouvailleDuContexte(sansGroupe(c2), [ar, rv], v);
  assert.equal(deux.statut, 'abstention'); assert.deepEqual(deux.causes, ['relations-distinctes']);
});

// ================================================================================================================ T12 futur jamais lu
test('T12. (a) deux mondes identiques jusqu\'à l\'acte, issue réelle différente ensuite (coût 1 ou 2 : arrivée 1 ou 0) → groupes STRICTEMENT identiques ; (b) valeur attendue historique forgée (1 → 0) → R toujours retrouvée, copie restituée avec 0', async () => {
  const jusqua = SCENARIO.slice(0, SCENARIO.findIndex((p) => p[1] === 'quatre'));
  const groupe = async (cout) => {
    const { w, etapes } = await vivre([...jusqua, ['msg', 'quatre', cout]]);
    const c = tourDe(etapes, 'quatre');
    const table = (await w.magasin.lireBrut('attentesProspectives')).map((l) => l.id);
    const rang = (id) => table.indexOf(id);
    return { w, c, forme: { ...c.retrouvaille, relations: c.retrouvaille.relations.map((r) => ({ relation: r.relation, formulations: r.formulations.map(rang) })), nonComparees: c.retrouvaille.nonComparees.map(rang) } };
  };
  const un = await groupe(1); const deux = await groupe(2);
  assert.equal((await lireCapacite(un.w.magasin)).valeur, 1); assert.equal((await lireCapacite(deux.w.magasin)).valeur, 0, 'issues réelles différentes');
  assert.equal(un.forme.statut, 'retrouvee');
  assert.deepEqual(un.forme, deux.forme);
  // (b)
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const reelle = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const forgee = forger(reelle, { relation: avecAttendu(R(reelle), ARRIVEE(0)) });
  const g = retrouvailleDuContexte(sansGroupe(await contexteDepart(w.magasin, etapes, 2)), [forgee], v);
  assert.equal(g.statut, 'retrouvee');
  assert.deepEqual(g.relations[0].relation.attendu, ARRIVEE(0), 'sélection indépendante de la valeur attendue ; R copiée telle quelle');
});

// ================================================================================================================ T13 aucune influence
test('T13. AUCUNE INFLUENCE : même scénario, retrouvaille aveuglée (instantané vide) → toutes les tables identiques hors groupes retrouvaille et reconnaissance ; les groupes, eux, diffèrent', async () => {
  const canonique = (donnees) => {
    const noms = new Map();
    const texte = JSON.stringify(donnees, (cle, valeur) => (cle === 'reconnaissance' || cle === 'retrouvaille' || cle === 'issuesRetrouvailles' ? undefined : valeur)); // MISE À JOUR DÉLIBÉRÉE v0.66.5 (C1) : la table issuesRetrouvailles conserve ce que la confrontation des groupes retrouvaille rend ; elle diffère quand les groupes diffèrent et est exclue comme eux ; toutes les autres tables restent comparées
    return texte.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, 'H').replace(/[a-z][a-z-]*-\d{13}-\d+-\d+/g, (id) => { if (!noms.has(id)) noms.set(id, `#${noms.size}`); return noms.get(id); });
  };
  const tables = async (m) => { const o = {}; for (const t of TABLES) o[t] = await m.lireBrut(t); return o; };
  const plan = SCENARIO.slice(0, 8);
  const reel = await vivre(plan); const aveugle = await vivre(plan, { aveugle: true });
  const tr = await tables(reel.w.magasin); const ta = await tables(aveugle.w.magasin);
  assert.equal(canonique(tr), canonique(ta), 'ni acte, ni attente, ni issue, ni besoin, ni décision ne change');
  assert.ok(tr.contextesProspectifs.some((c) => c.retrouvaille.statut === 'retrouvee'));
  assert.ok(ta.contextesProspectifs.every((c) => c.retrouvaille.statut === 'aucune' || c.retrouvaille.statut === 'non-effectuee'));
});

// ================================================================================================================ T14 / T15 relecture
test('T14. REDÉMARRAGE (remplacerTout d\'un export) : retrouvee, aucune et abstention relues identiques ; table des attentes INACCESSIBLE pendant la relecture des groupes, sans effet ; jamais de recalcul', async () => {
  const { w } = await vecuPartage();
  const m = await redemarrer(w.magasin);
  // + un contexte en abstention, par le VRAI écrivain
  const modele = (await m.lireTout('contextesProspectifs')).find((c) => vue(c.structure) === 'soi:tour(etat)');
  const contexte = Object.fromEntries(['application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins'].map((k) => [k, modele[k]]));
  const R1 = { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: ARRIVEE(1) };
  const abst = { statut: 'abstention', relations: [{ relation: R1, formulations: ['attente-x'] }, { relation: avecAttendu(R1, ARRIVEE(0)), formulations: ['attente-y'] }], nonComparees: ['attente-z'], causes: ['relations-distinctes', 'comparaison-incomplete'] };
  await enregistrerContexteProspectif(m, { designation: { id: 'acte-abstention', idObservation: 'observation-abstention', operation: 'soi:tour' }, contexte, retrouvaille: abst });
  const avant = relireRetrouvailles(await m.lireTout('contextesProspectifs'));
  assert.deepEqual(new Set(avant.contextes.map((x) => x.groupe.statut === 'persiste' && x.groupe.retrouvaille.statut)), new Set(['retrouvee', 'aucune', 'abstention']));
  const m2 = await redemarrer(m);
  const lireTout = m2.lireTout.bind(m2);
  m2.lireTout = async (t) => { if (t === 'attentesProspectives') throw new Error('table des attentes aveuglée'); return lireTout(t); };
  const apres = relireRetrouvailles(await m2.lireTout('contextesProspectifs'));
  assert.deepEqual(apres, avant);
  assert.deepEqual(apres.contextes.find((x) => x.idActe === 'acte-abstention').groupe.retrouvaille, abst);
  // la relecture n'importe que la forme : elle ne PEUT pas rescanner
  assert.deepEqual([...sansCommentaires(lu('app', 'langage', 'retrouvailles-persistees.js')).matchAll(/^import .* from '(.+)';$/gm)].map((x) => x[1]), ['./retrouvaille-forme.js']);
});

test('T15. après écriture : modifier ou supprimer les lignes sources → groupe relu inchangé (copie de R, jamais une référence vivante)', async () => {
  const { w, etapes } = await vecuPartage();
  const six = tourDe(etapes, 'six');
  const m = await redemarrer(w.magasin, (d) => {
    const sources = new Set(six.retrouvaille.relations[0].formulations);
    d.attentesProspectives = d.attentesProspectives.filter((l) => !sources.has(l.id) || l.id !== [...sources][0]);
    for (const l of d.attentesProspectives) if (sources.has(l.id)) l.description.relation.attendu = ARRIVEE(3);
    return d;
  });
  const relu = relireRetrouvailles(await m.lireTout('contextesProspectifs')).contextes.find((x) => x.idContexte === six.id);
  assert.deepEqual(relu.groupe, { statut: 'persiste', retrouvaille: six.retrouvaille });
});

// ================================================================================================================ T17 / T18 / T19
test('T17. LES QUATRE PRODUCTEURS (capacite, prospection-soi, environnement-conversation, execution-sollicitee) : chaque contexte écrit porte un groupe valide, écrit avec lui, avant toute attente de son acte ; aucune formulation de l\'acte lui-même', async () => {
  const { w } = await vecuPartage();
  const contextes = await w.magasin.lireBrut('contextesProspectifs');
  const designations = new Set((await w.magasin.lireBrut('designations')).map((d) => d.id));
  const emissions = new Set((await w.magasin.lireBrut('emissions')).map((d) => d.id));
  const attentes = await w.magasin.lireBrut('attentesProspectives');
  const parId = new Map(attentes.map((a) => [a.id, a]));
  const familles = { capacite: 0, 'prospection-soi': 0, 'environnement-conversation': 0, 'execution-sollicitee': 0 };
  for (const c of contextes) {
    assert.deepEqual(validerRetrouvaille(c.retrouvaille), c.retrouvaille);
    const famille = vue(c.structure) === 'soi:tour(etat)' ? 'capacite' : ['soi:repos(etat)', 'soi:temps(etat)'].includes(vue(c.structure)) ? 'prospection-soi' : emissions.has(c.idDesignation) ? 'environnement-conversation' : designations.has(c.idDesignation) ? 'execution-sollicitee' : 'inconnu';
    familles[famille] += 1;
    const iCtx = JOURNAL.findIndex((e) => e.op === 'ecrire' && e.table === 'contextesProspectifs' && e.id === c.id);
    assert.ok(iCtx >= 0);
    assert.equal(JOURNAL.slice(0, iCtx).some((e) => e.op === 'ecrire' && e.table === 'attentesProspectives' && e.objet.references.idDesignation === c.idDesignation), false, `${famille} : aucune attente de l'acte avant la retrouvaille`);
    for (const r of c.retrouvaille.relations) for (const id of r.formulations) assert.notEqual(parId.get(id).references.idDesignation, c.idDesignation);
  }
  for (const [famille, n] of Object.entries(familles)) assert.ok(n > 0, famille);
  assert.ok(contextes.some((c) => vue(c.structure) !== 'soi:tour(etat)' && c.retrouvaille.statut === 'retrouvee'), 'un autre producteur retrouve aussi');
});

test('T18. ORDRE : (a) instantané contenant une attente de l\'acte → TypeError, rien calculé ; (b) écrivain alors qu\'une attente de l\'acte existe → refus, aucune écriture ; sans groupe, l\'écrivain reste inchangé', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const deLActe = { ...forger(g21), references: { idContexte: 'x', idDesignation: c2.idDesignation } };
  assert.throws(() => retrouvaillesDesContextes([sansGroupe(c2)], { id: c2.idDesignation }, [deLActe], v), (e) => e instanceof TypeError && /existe déjà/.test(e.message));
  assert.throws(() => retrouvaillesDesContextes([sansGroupe(c2)], { id: c2.idDesignation }, [attentePlate(deLActe)], v), TypeError, 'forme plate lue aussi');
  // (b)
  const m = magasinMemoireVive();
  const contexte = Object.fromEntries(['application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins'].map((k) => [k, c2[k]]));
  await m.ecrire('attentesProspectives', { ...forger(g21), references: { idContexte: 'x', idDesignation: 'acte-X' } });
  const entree = { designation: { id: 'acte-X', idObservation: 'observation-X', operation: 'soi:tour' }, contexte };
  await assert.rejects(enregistrerContexteProspectif(m, { ...entree, retrouvaille: { statut: 'aucune', relations: [], nonComparees: [] } }), /retrouvaille doit précéder toute attente de l'acte/);
  assert.deepEqual(await m.lireTout('contextesProspectifs'), []);
  const sans = await enregistrerContexteProspectif(m, entree);
  assert.equal(Object.hasOwn(sans, 'retrouvaille'), false, 'un appel sans groupe garde la forme d\'avant');
});

test('T19. INDÉPENDANCE DE LA RECONSTRUCTION : R persistée (étrangère), histoire des épisodes non admissible → retrouvee, alors que K0 ne produit aucune attente conditionnée pour cet acte', async () => {
  const { w: source } = await vecuPartage();
  const g21 = await ligneR(source.magasin, 'soi:tour', 2, ARRIVEE(1));
  const w = monde();
  await w.etape(['msg', 'bonjour']);
  const etrangere = forger(g21, { id: 'attente-etrangere' });
  await w.magasin.ecrire('attentesProspectives', etrangere);
  const c = (await w.etape(['msg', 'salut'])).find((x) => vue(x.structure) === 'soi:tour(etat)');
  assert.equal(await departDe(w.magasin, c), 2);
  assert.deepEqual(c.retrouvaille, { statut: 'retrouvee', relations: [{ relation: R(g21), formulations: ['attente-etrangere'] }], nonComparees: [] });
  assert.equal((await w.magasin.lireBrut('attentesProspectives')).some((l) => avecRelation(l) && l.references.idDesignation === c.idDesignation), false, 'K0 : aucune attente conditionnée (histoire insuffisante)');
});

// ================================================================================================================ TA–TJ
test('TA / TB / TI. ligne pertinente illisible (id valide) : avec une R compatible → abstention [comparaison-incomplete], R copiée ; sans R compatible → abstention, jamais aucune ; avec deux R distinctes → les deux causes, ordre canonique', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c2 = sansGroupe(await contexteDepart(w.magasin, etapes, 2));
  const illisible = { ...forger(g21), champEtranger: 1 }; // rolesDeLAttente refuse (clé inconnue) ; la relation brute est présente
  assert.throws(() => FORME.validerRetrouvaille({ statut: 'aucune', relations: [], nonComparees: [illisible.id] }), TypeError);
  const ok = forger(g21);
  assert.deepEqual(retrouvailleDuContexte(c2, [ok, illisible], v), { statut: 'abstention', relations: [{ relation: R(g21), formulations: [ok.id] }], nonComparees: [illisible.id], causes: ['comparaison-incomplete'] });
  assert.deepEqual(retrouvailleDuContexte(c2, [illisible], v), { statut: 'abstention', relations: [], nonComparees: [illisible.id], causes: ['comparaison-incomplete'] });
  const y = forger(g21, { relation: avecAttendu(R(g21), ARRIVEE(0)) });
  assert.deepEqual(retrouvailleDuContexte(c2, [illisible, ok, y], v).causes, ['relations-distinctes', 'comparaison-incomplete']);
  const acteIllisible = forger(g21); acteIllisible.references = { ...acteIllisible.references, idDesignation: '' };
  assert.equal(retrouvailleDuContexte(c2, [acteIllisible], v).statut, 'abstention', 'acte non représentable : non comparée');
});

test('TD / TE. présent illisible → non-effectuee, tout vide, AUCUNE ligne lue ; contexte ancien sans groupe ≠ non-effectuee (relecture et libellés distincts)', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const c2 = sansGroupe(await contexteDepart(w.magasin, etapes, 2));
  const illisible = { ...c2, episodePartiel: { ...c2.episodePartiel, depart: 'valeur-inconnue' } };
  const piege = new Proxy([], { get(cible, cle) { if (cle === 'length' || cle === Symbol.iterator || /^\d+$/.test(String(cle)) || typeof cible[cle] === 'function') throw new Error('ligne lue'); return cible[cle]; } });
  assert.deepEqual(retrouvailleDuContexte(illisible, piege, v), { statut: 'non-effectuee', relations: [], nonComparees: [] });
  const r = relireRetrouvailles([{ ...c2, id: 'c-ancien', idDesignation: 'a1' }, { ...c2, id: 'c-ne', idDesignation: 'a2', retrouvaille: { statut: 'non-effectuee', relations: [], nonComparees: [] } }]);
  assert.deepEqual(r.contextes.map((x) => x.groupe), [{ statut: 'anterieur' }, { statut: 'persiste', retrouvaille: { statut: 'non-effectuee', relations: [], nonComparees: [] } }]);
});

test('TF / TH. une R compatible parmi des lignes à domaine, connu ou chemin d\'attendu différents, des attentes sans relation, et une ligne au domaine différent dont l\'attendu n\'est pas parcourable → retrouvee', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c2 = sansGroupe(await contexteDepart(w.magasin, etapes, 2));
  const sansRelation = (await w.magasin.lireBrut('attentesProspectives')).filter((l) => !avecRelation(l)).slice(0, 3);
  assert.equal(sansRelation.length, 3);
  const autreDomaine = forger(g21, { relation: { ...R(g21), domaine: [{ operation: 'soi:repos', entrees: ['etat'] }] } });
  const autreConnu = forger(g21, { relation: avecConnu(R(g21), 3) });
  const autreChemin = forger(g21, { relation: avecAttendu(R(g21), { valeurs: { inconnu: 1 } }) });
  const nonParcourable = forger(g21, { relation: { ...R(g21), domaine: [{ operation: 'soi:repos', entrees: ['etat'] }], attendu: { valeurs: { arrivee: new Map() } } } });
  assert.throws(() => FORME.validerRetrouvaille({ statut: 'retrouvee', relations: [{ relation: nonParcourable.description.relation, formulations: ['x'] }], nonComparees: [] }), TypeError, 'attendu non parcourable');
  const ok = forger(g21);
  const g = retrouvailleDuContexte(c2, [...sansRelation, autreDomaine, autreConnu, autreChemin, nonParcourable, ok], v);
  assert.deepEqual(g, { statut: 'retrouvee', relations: [{ relation: R(g21), formulations: [ok.id] }], nonComparees: [] });
  // même attendu non parcourable, MÊME domaine : la comparaison est impossible → non comparée (jamais éliminée en silence)
  const memeDomaine = forger(g21, { relation: { ...R(g21), attendu: { valeurs: { arrivee: new Map() } } } });
  assert.deepEqual(retrouvailleDuContexte(c2, [memeDomaine, ok], v).nonComparees, [memeDomaine.id]);
});

test('TG. ligne à relation brute dont l\'id est absent, vide ou non-chaîne → abstention [comparaison-incomplete, ligne-non-identifiable] ; aucune identité inventée', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const c2 = sansGroupe(await contexteDepart(w.magasin, etapes, 2));
  const ok = forger(g21);
  for (const id of [null, '', 42, { id: 'x' }]) {
    const l = forger(g21, { id });
    const g = retrouvailleDuContexte(c2, [l, ok], v);
    assert.deepEqual(g, { statut: 'abstention', relations: [{ relation: R(g21), formulations: [ok.id] }], nonComparees: [], causes: ['comparaison-incomplete', 'ligne-non-identifiable'] }, String(id));
  }
});

test('TJ. GARDES DE FORME : groupe forgé incohérent → TypeError à la validation, refusé par l\'écrivain (aucune écriture), montré « invalide » par la relecture (jamais réparé)', async () => {
  const R1 = { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: ARRIVEE(1) };
  const R2 = avecAttendu(R1, ARRIVEE(0));
  const incoherents = [
    { statut: 'retrouvee', relations: [{ relation: R1, formulations: ['a'] }, { relation: R2, formulations: ['b'] }], nonComparees: [] },
    { statut: 'retrouvee', relations: [], nonComparees: [] },
    { statut: 'aucune', relations: [], nonComparees: ['a'] },
    { statut: 'aucune', relations: [], nonComparees: [], causes: ['comparaison-incomplete'] },
    { statut: 'non-effectuee', relations: [{ relation: R1, formulations: ['a'] }], nonComparees: [] },
    { statut: 'abstention', relations: [{ relation: R1, formulations: ['a'] }], nonComparees: [], causes: ['relations-distinctes'] },
    { statut: 'abstention', relations: [], nonComparees: ['a'], causes: ['comparaison-incomplete', 'comparaison-incomplete'] },
    { statut: 'abstention', relations: [], nonComparees: [], causes: [] },
    { statut: 'abstention', relations: [], nonComparees: ['a'], causes: ['ligne-non-identifiable'] },
    { statut: 'abstention', relations: [{ relation: R1, formulations: ['a'] }, { relation: R2, formulations: ['b'] }], nonComparees: ['c'], causes: ['comparaison-incomplete', 'relations-distinctes'] },
    { statut: 'abstention', relations: [{ relation: R1, formulations: ['a'] }, { relation: R1, formulations: ['b'] }], nonComparees: [], causes: ['relations-distinctes'] },
    { statut: 'retrouvee', relations: [{ relation: R1, formulations: [] }], nonComparees: [] },
    { statut: 'retrouvee', relations: [{ relation: R1, formulations: ['a', 'a'] }], nonComparees: [] },
    { statut: 'retrouvee', relations: [{ relation: { ...R1, poids: 1 }, formulations: ['a'] }], nonComparees: [] },
    { statut: 'retrouvee', relations: [{ relation: R1, formulations: ['a'], score: 1 }], nonComparees: [] },
    { statut: 'trouvee', relations: [], nonComparees: [] },
    { statut: 'aucune', relations: [], nonComparees: [], frequence: 0 },
    { statut: 'aucune', relations: [] },
  ];
  const { w, etapes } = await vecuPartage();
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  const contexte = Object.fromEntries(['application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins'].map((k) => [k, c2[k]]));
  const m = magasinMemoireVive();
  for (const [i, g] of incoherents.entries()) {
    assert.throws(() => validerRetrouvaille(g), TypeError, JSON.stringify(g));
    await assert.rejects(enregistrerContexteProspectif(m, { designation: { id: `acte-${i}`, idObservation: 'o', operation: 'soi:tour' }, contexte, retrouvaille: g }), TypeError);
    const relu = relireRetrouvailles([{ ...c2, retrouvaille: g }]).contextes[0].groupe;
    assert.equal(relu.statut, 'invalide'); assert.match(relu.erreur, /^retrouvaille : /);
  }
  assert.deepEqual(await m.lireTout('contextesProspectifs'), []);
  // un groupe cohérent passe, copie neuve
  const bon = { statut: 'abstention', relations: [{ relation: R1, formulations: ['a'] }, { relation: R2, formulations: ['b'] }], nonComparees: ['c'], causes: ['relations-distinctes', 'comparaison-incomplete'] };
  const copie = validerRetrouvaille(bon); assert.deepEqual(copie, bon); assert.notEqual(copie.relations[0].relation, R1);
});

// ================================================================================================================ Diagnostic
// DOM factice : même forme que tests/copie-diagnostic.test.mjs.
class Faux {
  get parentNode() { return this.parent; }
  get textContent() { return this._texte; }
  set textContent(v) { this._texte = String(v); this.children = []; }
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.attrs = {}; this.open = false; this.type = ''; }
  get tagName() { return this.tag.toUpperCase(); }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c, ref) { if (c.parent) c.remove(); c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  focus() {}
  scrollIntoView() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
}
const trouver = (e, f) => (f(e) ? e : (e.children || []).map((c) => trouver(c, f)).find(Boolean) || null);
const basculer = async (e, ouvert) => { e.open = ouvert; await Promise.all((e.listeners.toggle || []).map((f) => f())); await new Promise((r) => setTimeout(r, 0)); };
async function ecranAvec(capacite, copier) {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  globalThis.window = globalThis;
  const { monterConversation } = await import('../app/conversation/ecran.js');
  const page = new Faux('main'); const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  page.append(liste, formulaire);
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: async () => ({ texte: 'ok' }), capacite, ...(copier ? { copier } : {}) });
  await conv.recharger();
  const zone = page.children.find((c) => c._cls.has('diagnostic'));
  return { zone, section: trouver(zone, (e) => e._cls.has('retrouvailles-zone')) };
}
const capaciteDe = (retrouvailles, appels) => ({
  lire: async () => ({ valeur: 2, plafond: 3, derniere: null, besoins: [] }), repos: async () => ({}),
  retrouvailles: async () => { appels.n += 1; return retrouvailles(); },
});

test('D1. DIAGNOSTIC : section dépliée « Relations retrouvées avant l\'attente », relue à chaque ouverture du panneau, copiée par « Copier le diagnostic » SANS navigation ; libellés des ajustements ; preuve d\'ordre à côté du groupe ; contextes antérieurs dans un bloc paresseux', async () => {
  const { w, etapes } = await vecuPartage();
  const m = await redemarrer(w.magasin);
  const c2 = await contexteDepart(w.magasin, etapes, 2);
  const contexte = Object.fromEntries(['application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins'].map((k) => [k, c2[k]]));
  const R1 = { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: ARRIVEE(1) };
  await enregistrerContexteProspectif(m, { designation: { id: 'acte-abstention', idObservation: 'o', operation: 'soi:tour' }, contexte, retrouvaille: { statut: 'abstention', relations: [{ relation: R1, formulations: ['attente-x'] }, { relation: avecAttendu(R1, ARRIVEE(0)), formulations: ['attente-y'] }], nonComparees: ['attente-z'], causes: ['relations-distinctes', 'comparaison-incomplete', 'ligne-non-identifiable'] } });
  await enregistrerContexteProspectif(m, { designation: { id: 'acte-ne', idObservation: 'o', operation: 'soi:tour' }, contexte, retrouvaille: { statut: 'non-effectuee', relations: [], nonComparees: [] } });
  await enregistrerContexteProspectif(m, { designation: { id: 'acte-ancien', idObservation: 'o', operation: 'soi:tour' }, contexte }); // sans groupe : forme d'avant v0.64.31
  const appels = { n: 0 };
  let copie = null;
  const { zone, section } = await ecranAvec(capaciteDe(() => pontRetrouvailles(m), appels), async (t) => { copie = t; });
  assert.ok(section); assert.equal(section.open, true, 'dépliée');
  assert.equal(appels.n, 0, 'rien n\'est lu avant l\'ouverture du panneau');
  await basculer(zone, true);
  assert.equal(appels.n, 1);
  const boutonCopier = trouver(zone, (e) => e.tag === 'button' && e._cls.has('bouton-copier-diagnostic'));
  await Promise.all(boutonCopier.listeners.click.map((f) => f()));
  assert.equal(appels.n, 1, 'la copie ne relit rien');
  assert.equal(copie, texteDiagnostic(zone));
  const six = tourDe(etapes, 'six');
  const court = (id) => { const x = id.match(/^([a-z-]+?)-\d{10,}-(\d+-\d+)$/); return x ? `${x[1]}…${x[2]}` : id; };
  for (const attendu of [
    'Relations retrouvées avant l\'attente',
    'relation retrouvée avant toute attente de cet acte',
    'relation : domaine soi:tour(etat) · connu { valeurs: { depart: 2 } } · attendu { valeurs: { arrivee: 1 } }',
    `  formulations : ${six.retrouvaille.relations[0].formulations.map(court).join(', ')}`,
    'aucune relation compatible',
    'ABSTENTION — plusieurs relations compatibles',
    'ABSTENTION — comparaison incomplète',
    'ligne sans identité',
    'non comparée (ligne illisible) : attente attente-z',
    'retrouvaille non effectuée — présent illisible',
    'Contextes antérieurs à v0.64.31 — retrouvaille non effectuée historiquement',
  ]) assert.ok(copie.includes(attendu), attendu);
  assert.match(copie, new RegExp(`contexte ${court(six.id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · acte ${court(six.idDesignation).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · soi:tour · persisté le \\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d:\\d\\d\\.\\d{3}, relu tel quel`));
  const premiere = (await m.lireTout('attentesProspectives')).find((a) => a.references.idContexte === six.id);
  assert.ok(copie.includes(`attentes de ce contexte : ${court(premiere.id)} (`), 'preuve d\'ordre : les attentes écrites ensuite pour ce contexte');
  // le bloc des contextes antérieurs n'est construit que s'il est ouvert (« acte-ancien » n'apparaît qu'après)
  const lignes = copie.split('\n'); const k = lignes.findIndex((l) => l.includes('Contextes antérieurs à v0.64.31'));
  assert.equal(lignes[k + 1].trim(), MARQUE_NON_OUVERTE);
  assert.equal(copie.includes('retrouvaille non effectuée historiquement — contexte antérieur à v0.64.31'), false);
  const anterieurs = trouver(section, (e) => e.tag === 'details' && e !== section && e.children[0] && /Contextes antérieurs/.test(e.children[0].textContent));
  await basculer(anterieurs, true);
  assert.equal(appels.n, 1, 'ouvrir le bloc ne relit rien');
  assert.ok(texteDiagnostic(zone).includes('acte acte-ancien · soi:tour : retrouvaille non effectuée historiquement — contexte antérieur à v0.64.31'));
  // TE / T16 : anterieur, non-effectuee et aucune ont trois libellés distincts
  // réouverture du panneau : relecture fraîche, une seule section
  await basculer(zone, false); await basculer(zone, true);
  assert.equal(appels.n, 2);
  assert.equal(texteDiagnostic(zone).split('\n').filter((l) => l === 'Relations retrouvées avant l\'attente').length, 1);
});

test('D2. DIAGNOSTIC : lecture impossible → une ligne d\'erreur, rien d\'autre ; groupe hors forme → montré « hors forme », jamais réparé ; sans pont, pas de section', async () => {
  const appels = { n: 0 };
  const { zone } = await ecranAvec(capaciteDe(async () => { throw new Error('magasin fermé'); }, appels));
  await basculer(zone, true);
  assert.ok(texteDiagnostic(zone).includes('retrouvailles non lisibles : magasin fermé'));
  const { zone: z2 } = await ecranAvec(capaciteDe(async () => ({ relues: relireRetrouvailles([{ id: 'contexte-1', idDesignation: 'acte-1', structure: [{ operation: 'soi:tour', entrees: ['etat'] }], retrouvaille: { statut: 'retrouvee', relations: [], nonComparees: [] } }]), attentes: [] }), appels));
  await basculer(z2, true);
  assert.match(texteDiagnostic(z2), /groupe retrouvaille hors forme \(montré tel quel, jamais réparé\) : retrouvaille : retrouvee : exactement une relation/);
  const { section } = await ecranAvec({ lire: async () => ({ valeur: 2, plafond: 3, derniere: null, besoins: [] }), repos: async () => ({}) });
  assert.equal(section, null);
});

// ================================================================================================================ gardes
test('G1. MODULES : exports et imports exacts ; calcul, forme et relecture séparés ; importeurs exactement connus', () => {
  assert.deepEqual(Object.keys(CALCUL).sort(), ['retrouvailleDuContexte', 'retrouvaillesDesContextes']);
  assert.deepEqual(Object.keys(FORME).sort(), ['CAUSES_ABSTENTION', 'STATUTS_RETROUVAILLE', 'ligneDeLActe', 'validerRetrouvaille']);
  assert.deepEqual(Object.keys(VUE).sort(), ['attentesEcritesParContexte', 'relireRetrouvailles']);
  assert.deepEqual(STATUTS_RETROUVAILLE, ['retrouvee', 'aucune', 'abstention', 'non-effectuee']);
  assert.deepEqual(CAUSES_ABSTENTION, ['relations-distinctes', 'comparaison-incomplete', 'ligne-non-identifiable']);
  const imports = (m) => [...sansCommentaires(lu('app', 'langage', `${m}.js`)).matchAll(/^import .* from '(.+)';$/gm)].map((x) => x[1]);
  assert.deepEqual(imports('retrouvailles'), ['./roles-attente.js', './relations-formulees.js', './parcours-structure.js', './restriction-parcours.js', './reconstruction-structure.js', './episodes-de-transformation.js', './contexte-prospectif.js', './couverture-occurrences.js', './retrouvaille-forme.js']);
  assert.deepEqual(imports('retrouvaille-forme'), ['./relations-formulees.js']);
  assert.deepEqual(imports('retrouvailles-persistees'), ['./retrouvaille-forme.js']);
  const importeurs = (m) => fichiersJs(join(RACINE, 'app')).filter((f) => new RegExp(`from '\\.{1,2}/(langage/)?${m}\\.js'`).test(readFileSync(f, 'utf8'))).map(rel).sort();
  assert.deepEqual(importeurs('retrouvailles'), ['app/langage/capacite.js', 'app/langage/environnement-conversation.js', 'app/langage/execution-sollicitee.js', 'app/langage/prospection-soi.js']);
  assert.deepEqual(importeurs('retrouvaille-forme'), ['app/langage/connaissances.js', 'app/langage/issue-retrouvaille.js', 'app/langage/retrouvailles-persistees.js', 'app/langage/retrouvailles.js']); // MISE À JOUR DÉLIBÉRÉE v0.64.33 (« CONFRONTER UNE RELATION RETROUVÉE À CE QUI EST ARRIVÉ ») : + la vue pure issue-retrouvaille.js, qui relit le groupe par la forme (jamais par le calcul)
  assert.deepEqual(importeurs('retrouvailles-persistees'), ['app/main.js']);
  for (const autre of ['sw.js', 'index.html']) { let s = ''; try { s = lu(autre); } catch { continue; } assert.doesNotMatch(s, /retrouvaille/, autre); }
  assert.equal(VERSION_BASE, 30); assert.equal(SCHEMA_SAUVEGARDE, 20); assert.equal(TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
});

test('G2. AUCUN COMPTEUR, FRÉQUENCE, VOTE, SCORE, RÉCENCE, PRÉFÉRENCE, HASARD, HORLOGE ; la reconnaissance, les témoins, les fondations, les issues et les horodatages ne sont jamais lus par le calcul', () => {
  for (const m of ['retrouvailles', 'retrouvaille-forme', 'retrouvailles-persistees']) {
    const code = sansCommentaires(lu('app', 'langage', `${m}.js`));
    assert.doesNotMatch(code, /Math\.|Date|random|score|poids|vote|majorit|frequen|compteur|recen|prefer|\.sort\(|reduce\(|setTimeout|lireTout|ecrire\(|magasin/i, m);
    assert.doesNotMatch(code, /reconnaissance|formulationsAnterieures|temoins|fondation|unitesIssues|issue/i, m);
  }
  const calcul = sansCommentaires(lu('app', 'langage', 'retrouvailles.js'));
  assert.doesNotMatch(calcul, /horodatage/);
  for (const l of calcul.split('\n').filter((x) => /\.length/.test(x))) assert.match(l, /contextes\.length === 0|feuilles\.length > 0|relations\.length >= 2|nonComparees\.length > 0 \|\||causes\.length > 0\)|relations\.length === 1 \?|x\.length > 0;/, l); // vide / non vide, et « au moins deux relations distinctes » (règle d'abstention) : jamais un nombre comparé à un seuil de décision
});

test('G3. LECTEURS DU GROUPE : seuls l\'écrivain, la forme, le calcul, les quatre producteurs (transmission), la relecture, le pont et l\'écran nomment la retrouvaille ; aucun mécanisme d\'action, de choix, de besoin ni d\'issue ne la lit', () => {
  const lecteurs = fichiersJs(join(RACINE, 'app')).filter((f) => /retrouvaille/i.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(lecteurs, ['app/conversation/ecran.js', 'app/langage/capacite.js', 'app/langage/connaissances.js', 'app/langage/environnement-conversation.js', 'app/langage/execution-sollicitee.js', 'app/langage/issue-retrouvaille.js', 'app/langage/issues-vecues.js', 'app/langage/prospection-soi.js', 'app/langage/retrouvaille-forme.js', 'app/langage/retrouvailles-persistees.js', 'app/langage/retrouvailles.js', 'app/main.js']); // MISE À JOUR DÉLIBÉRÉE v0.66.5 (C1, issue vécue d'une retrouvaille) : + issues-vecues.js, écrivain de l'issue vécue : il lit le statut 'retrouvee' du groupe pour retenir les contextes de l'acte et appelle la vue confronterRetrouvaille ; il n'écrit ni ne modifie jamais le groupe // MISE À JOUR DÉLIBÉRÉE v0.64.33 : + issue-retrouvaille.js, vue de RELECTURE lue par le seul pont Diagnostic (gardée par tests/issue-retrouvaille.test.mjs) ; elle lit le groupe, ne l'écrit ni ne le modifie
  // dans les producteurs : UNE lecture de l'instantané, UN calcul, transmis tel quel à l'écrivain, AVANT toute attente
  for (const p of ['capacite', 'prospection-soi', 'environnement-conversation', 'execution-sollicitee']) {
    const code = sansCommentaires(lu('app', 'langage', `${p}.js`));
    assert.equal((code.match(/retrouvaillesDesContextes\(/g) || []).length, 1, p);
    assert.equal((code.match(/retrouvailles\[k\]/g) || []).length, 1, p);
    assert.equal((code.match(/retrouvaille/g) || []).length, 6, `${p} : import (2), constante, appel, transmission (2) — rien d'autre`);
    assert.ok(code.indexOf('retrouvaillesDesContextes(contextes') < code.indexOf('enregistrerContexteProspectif(magasin'), p);
    assert.ok(code.indexOf('enregistrerContexteProspectif(magasin') < code.indexOf('enregistrerAttenteProspective('), p);
  }
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  const i = conn.indexOf('export async function enregistrerContexteProspectif('); const bloc = conn.slice(i, conn.indexOf('\n}\n', i));
  assert.equal((conn.replace(/issuesRetrouvailles|enregistrerIssueRetrouvaille|lireIssuesRetrouvailles|'issue-retrouvaille'/g, '').match(/retrouvaille/gi) || []).length, (bloc.match(/retrouvaille/gi) || []).length + 2, 'seul l\'écrivain des contextes (et la ligne d\'import) nomme le groupe'); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1) : le nom de la table 'issuesRetrouvailles' (TABLES, CLE) n'est pas une lecture du groupe et n'est pas compté // MISE À JOUR DÉLIBÉRÉE v0.66.5 (C1) : ni les noms de l'écrivain et du lecteur de la table (enregistrerIssueRetrouvaille, lireIssuesRetrouvailles), ni le préfixe d'identité 'issue-retrouvaille' ne lisent le groupe : ils ne sont pas comptés
  // pont : deux lectures, deux fonctions de relecture, rien d'autre
  const main = sansCommentaires(lu('app', 'main.js'));
  const k = main.indexOf('retrouvailles: async () => {'); const pont = main.slice(k, main.indexOf('\n    },', k));
  assert.deepEqual(pont.match(/lireTout\('(\w+)'\)/g), ["lireTout('contextesProspectifs')", "lireTout('attentesProspectives')"]);
  assert.match(pont, /relues: relireRetrouvailles\(contextes\), attentes: attentesEcritesParContexte\(lignes\)/);
  assert.ok(k > main.indexOf('attentesConditionnees: async () => {') && k < main.indexOf('issuesAujourdhui: async () => {'), 'dans le pont Diagnostic');
  const ecran = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  assert.equal((ecran.match(/capacite\.retrouvailles\(/g) || []).length, 1);
  const raf = ecran.slice(ecran.indexOf('async function rafraichirCapacite()'), ecran.indexOf('async function rafraichirCapacite()') + 6000);
  assert.doesNotMatch(raf, /retrouvaille/i, 'aucun rafraîchissement ne relit les groupes');
});
