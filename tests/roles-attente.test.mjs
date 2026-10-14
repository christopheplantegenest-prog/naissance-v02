// v0.64.7 — « PRÉSERVER LES RÔLES DE L'ATTENTE » (décision ChatGPT « DÉCISION v0.64.7 », 13/10/2026).
// Preuves : contrat de rolesDeLAttente (deux formes lues explicitement, refus des ambiguïtés) ; les quatre producteurs écrivent des lignes par rôles ;
// projection .64.7 → .64.6 sans perte ni ajout ; lecture compatible (lignes plates .64.6 et .64.1–.64.4) ; preuves n↔m ; relation sans preuve ;
// observation naïve et observation par rôle ; co-couvertures en sonde ; pluralité des issues inchangée ; anti-triche par renommage ; dormance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/roles-attente.js';
import { rolesDeLAttente, GROUPES_ATTENTE } from '../app/langage/roles-attente.js';
import { experiencesDAttentes, elementsDExperiences, regrouperExperiences } from '../app/langage/experiences-attentes.js';
import { issuesDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { attentesDesResultats } from '../app/langage/attentes-du-tour.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { coCouverturesDeDescriptions } from '../app/langage/co-couvertures-descriptions.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { attentePlate, issuePlate, experiencePlate } from './projection-attente.mjs';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'roles-attente.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^rolesDeLAttente : /.test(e.message));
const k = (x) => JSON.stringify(x);

// Monde réel (même protocole que le téléphone) : avant chaque message, repos jusqu'au plafond ; une réponse est déclarée sur une émission.
function monde() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); await consequenceReception(magasin, d.reception); await traiterOccasion(magasin, d.reception.id); }
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function repos() { for (let c = await lireCapacite(magasin); c.valeur < 3; c = await lireCapacite(magasin)) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  async function message(texte, idEmission = null) {
    await repos();
    const avant = (await magasin.lireTout('emissions')).length;
    await tour(texte, idEmission);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).slice(avant).filter((e) => ex.find((q) => q.id === e.idExecution).operation === 'symbolesDeChaine').at(-1);
  }
  const lignes = () => magasin.lireTout('attentesProspectives');
  async function experiences(L = null) {
    const v = await lireExecutionsVecues(magasin);
    return experiencesDAttentes(L ?? await lignes(), await magasin.lireTout('contextesProspectifs'), v.valeurs, v.executions, v.descriptions);
  }
  return { magasin, message, lignes, experiences };
}
async function vecu(paires, present = null) {
  const w = monde();
  for (const [x, y] of paires) { const E = await w.message(x); await w.message(y, E.id); }
  const E = present === null ? null : await w.message(present);
  return { w, E };
}
// Vécu de référence de ce fichier (court : le robot exécute toute la suite en une fois) : K9→77, Q4→55, K9→77, K9→77 — la relation K9 → 77 est formée
// deux fois avec deux fondations différentes ; quatre producteurs, attentes .74 et conditionnées.
let REF = null;
async function reference() {
  if (REF) return REF;
  const { w } = await vecu([['K9', '77'], ['Q4', '55'], ['K9', '77'], ['K9', '77']]);
  REF = { w, lignes: await w.lignes(), ...(await w.experiences()) };
  return REF;
}
const ope = (a) => a.description.structure.at(-1).operation;
const producteur = (a) => (ope(a) === 'soi:tour' ? 'capacite' : ope(a).startsWith('soi:') ? 'prospection-soi' : ope(a).startsWith('environnement:') ? 'environnement-conversation' : 'execution-sollicitee');

// ================================================================================================================ A. CONTRAT
test('A1. rolesDeLAttente : export unique (et GROUPES_ATTENTE gelé) ; pure, sans import, sans magasin ni horloge ; VERSION_BASE et SCHEMA_SAUVEGARDE inchangés (même table, même clé)', () => {
  assert.deepEqual(Object.keys(module).sort(), ['GROUPES_ATTENTE', 'rolesDeLAttente']);
  assert.equal(rolesDeLAttente.length, 1);
  assert.deepEqual(GROUPES_ATTENTE, ['description', 'preuve', 'references']); assert.equal(Object.isFrozen(GROUPES_ATTENTE), true);
  assert.deepEqual([...SRC.matchAll(/^import .* from '(.+)';$/gm)], []);
  assert.equal(/\bDate\b|Math\.random|\bawait\b|\basync\b|magasin\.|lireTout|ecrire|globalThis|WeakMap/.test(CODE), false);
  assert.deepEqual(CODE.split('\n').filter((l) => /^(let|var) /.test(l)), []);
  assert.equal(/statut|realisee|probab|score|confian|majorit|vote|prefer|préfér/i.test(CODE), false);
  assert.equal(VERSION_BASE, 25); assert.equal(SCHEMA_SAUVEGARDE, 15); // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 24 → 25 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 14 → 15 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables)
});

test('A2. FORME STRUCTURÉE : la ligne écrite par .64.7 est lue telle quelle (copies neuves) ; entrées gelées intactes', async () => {
  const { lignes } = await reference();
  for (const a of lignes) {
    assert.deepEqual(Object.keys(a), ['id', 'horodatage', 'idObservation', 'description', 'preuve', 'references']);
    const r = rolesDeLAttente(a);
    assert.deepEqual(r, { occurrence: { id: a.id, horodatage: a.horodatage, idObservation: a.idObservation }, description: a.description, preuve: a.preuve, references: a.references });
    assert.notEqual(r.description, a.description); assert.notEqual(r.preuve, a.preuve);
  }
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const g = gel(structuredClone(lignes[0])); const fige = k(g); rolesDeLAttente(g); assert.equal(k(g), fige);
});

test('A3. FORME PLATE HISTORIQUE (.64.6, et .64.1–.64.4 : fondation sans relation) : lue par le rangement fixe, mêmes groupes que la forme .64.7 de la même attente', async () => {
  const { lignes } = await reference();
  for (const a of lignes) assert.deepEqual(rolesDeLAttente(attentePlate(a)), rolesDeLAttente(a), a.id);
  const c = lignes.find((a) => a.preuve.fondation);
  const { relation, ...sansRelation } = attentePlate(c);
  const lue = rolesDeLAttente(sansRelation);
  assert.deepEqual(lue.preuve.fondation, c.preuve.fondation); assert.equal(Object.hasOwn(lue.description, 'relation'), false, 'une ligne .64.1–.64.4 reste lisible, sans relation inventée');
});

test('A4. REFUS (aucune ambiguïté silencieuse, aucun repli) : forme mêlée ; clé inconnue ; groupe manquant ; clé au mauvais rôle ; relation sans fondation ; .64.7 fondation sans relation ; accesseur', async () => {
  const { lignes } = await reference();
  const u = lignes.find((a) => !a.preuve.fondation); const c = lignes.find((a) => a.preuve.fondation);
  refuse(() => rolesDeLAttente(null)); refuse(() => rolesDeLAttente([]));
  const { id, ...sansId } = u; refuse(() => rolesDeLAttente(sansId));
  refuse(() => rolesDeLAttente({ ...u, chemin: u.description.chemin }), 'mêlée');
  refuse(() => rolesDeLAttente({ ...u, source: 'x' }), 'clé inconnue');
  refuse(() => rolesDeLAttente({ ...attentePlate(u), source: 'x' }), 'clé inconnue (plate)');
  const { preuve, ...sansPreuve } = u; refuse(() => rolesDeLAttente(sansPreuve));
  refuse(() => rolesDeLAttente({ ...u, description: { ...u.description, temoinsContexte: [] } }), 'preuve dans la description');
  refuse(() => rolesDeLAttente({ ...u, references: { ...u.references, idObservation: 'x' } }), 'occurrence dans les références');
  refuse(() => rolesDeLAttente({ ...u, description: { ...u.description, relation: c.description.relation } }), 'relation sans fondation');
  const { relation, ...dSans } = c.description; refuse(() => rolesDeLAttente({ ...c, description: dSans }), '.64.7 : fondation sans relation');
  refuse(() => rolesDeLAttente({ ...attentePlate(u), relation: c.description.relation }), 'plate : relation sans fondation');
  const piege = { ...u }; Object.defineProperty(piege, 'preuve', { get: () => u.preuve, enumerable: true }); refuse(() => rolesDeLAttente(piege));
});

// ================================================================================================================ B. PRODUCTEURS ET PROJECTION
test('B1. LES QUATRE PRODUCTEURS (capacite, prospection-soi, environnement-conversation, execution-sollicitee) écrivent des lignes par rôles ; .74 et conditionnées ; aucune ligne plate', async () => {
  const { lignes } = await reference();
  const parProducteur = {};
  for (const a of lignes) {
    assert.deepEqual(Object.keys(a), ['id', 'horodatage', 'idObservation', 'description', 'preuve', 'references']);
    assert.deepEqual(Object.keys(a.references), ['idContexte', 'idDesignation']);
    assert.deepEqual(Object.keys(a.description), a.preuve.fondation ? ['structure', 'chemin', 'constat', 'relation'] : ['structure', 'chemin', 'constat']);
    assert.deepEqual(Object.keys(a.preuve), a.preuve.fondation ? ['temoinsContexte', 'unitesIssues', 'fondation'] : ['temoinsContexte', 'unitesIssues']);
    const p = producteur(a); parProducteur[p] = parProducteur[p] ?? { u: 0, c: 0 }; parProducteur[p][a.preuve.fondation ? 'c' : 'u'] += 1;
  }
  assert.deepEqual(Object.keys(parProducteur).sort(), ['capacite', 'environnement-conversation', 'execution-sollicitee', 'prospection-soi'], k(parProducteur));
  for (const [p, n] of Object.entries(parProducteur)) assert.ok(n.u > 0, `${p} : attentes .74`);
  assert.ok(Object.values(parProducteur).some((n) => n.c > 0), 'des attentes conditionnées');
});

test('B2. PROJECTION .64.7 → .64.6 : chaque ligne se projette sur l’ordre exact des clés .64.6, sans information ajoutée ni perdue (aller-retour exact, même nombre de feuilles)', async () => {
  const { lignes } = await reference();
  for (const a of lignes) {
    const p = attentePlate(a);
    assert.deepEqual(Object.keys(p), ['id', 'horodatage', 'idDesignation', 'idObservation', 'idContexte', 'structure', 'chemin', 'constat', 'temoinsContexte', 'unitesIssues', ...(a.preuve.fondation ? ['fondation', 'relation'] : [])]);
    assert.equal(parcourirStructure(p).filter((o) => !['objet', 'tableau'].includes(o.type)).length, parcourirStructure(a).filter((o) => !['objet', 'tableau'].includes(o.type)).length);
    const r = rolesDeLAttente(p);
    assert.deepEqual({ id: r.occurrence.id, horodatage: r.occurrence.horodatage, idObservation: r.occurrence.idObservation, description: r.description, preuve: r.preuve, references: r.references }, a);
  }
});

test('B3. LECTURE COMPATIBLE : une table mêlant lignes plates (.64.6) et structurées donne les mêmes issues, les mêmes expériences et les mêmes lignes de tour ; rien n’est réécrit', async () => {
  const { w, lignes, experiences } = await reference();
  const melange = lignes.map((a, i) => (i % 2 === 0 ? attentePlate(a) : a));
  assert.deepEqual((await w.experiences(melange)).experiences, experiences);
  const v = await lireExecutionsVecues(w.magasin); const C = await w.magasin.lireTout('contextesProspectifs');
  for (const [i, a] of lignes.entries()) {
    const c = C.find((x) => x.id === a.references.idContexte);
    let attendu; try { attendu = issuesDeLAttenteProspective(a, c, v.valeurs, v.executions, v.descriptions); } catch (e) { attendu = e.message; }
    let obtenu; try { obtenu = issuesDeLAttenteProspective(melange[i], c, v.valeurs, v.executions, v.descriptions); } catch (e) { obtenu = e.message; }
    assert.deepEqual(obtenu, attendu);
  }
  const resultats = [...new Set(lignes.map((a) => a.references.idDesignation))].map((id) => ({ operation: 'x', designation: { id } }));
  assert.deepEqual(attentesDesResultats(resultats, melange, C, v.valeurs, v.executions, v.descriptions), attentesDesResultats(resultats, lignes, C, v.valeurs, v.executions, v.descriptions));
  // un magasin contenant des lignes plates : relues telles quelles, jamais migrées
  const m = magasinMemoireVive(); for (const a of melange) await m.ecrire('attentesProspectives', a);
  assert.deepEqual(await m.lireTout('attentesProspectives'), melange);
});

test('B4. PROJECTION DES VUES : issue et expérience .64.7 projetées = formes .64.6 (mêmes valeurs : description depuis l’issue, preuve depuis la ligne)', async () => {
  const { w, lignes, experiences } = await reference();
  const v = await lireExecutionsVecues(w.magasin); const C = await w.magasin.lireTout('contextesProspectifs');
  for (const e of experiences) {
    const a = lignes.find((x) => x.id === e.id);
    const p = experiencePlate(e); const plat = attentePlate(a);
    assert.deepEqual(p.critere, { structure: plat.structure, chemin: plat.chemin });
    assert.deepEqual(p.avant, { constat: plat.constat, temoinsContexte: plat.temoinsContexte, unitesIssues: plat.unitesIssues, ...(plat.fondation ? { fondation: plat.fondation, relation: plat.relation } : {}) });
    const [i] = issuesDeLAttenteProspective(a, C.find((x) => x.id === a.references.idContexte), v.valeurs, v.executions, v.descriptions);
    assert.deepEqual(issuePlate(i, a).statut, e.apres.statut);
  }
});

// ================================================================================================================ C. PREUVES N↔M ET RELATION SANS PREUVE
test('C1. PLUSIEURS PREUVES, UNE DESCRIPTION : des lignes de même description exacte (relation comprise) portent des preuves différentes ; la description se compare seule', async () => {
  const { lignes } = await reference();
  const cond = lignes.filter((a) => a.preuve.fondation);
  const parDescription = new Map(); for (const a of cond) parDescription.set(k(a.description), [...(parDescription.get(k(a.description)) ?? []), a]);
  const multiples = [...parDescription.values()].filter((g) => new Set(g.map((a) => k(a.preuve))).size > 1);
  assert.ok(multiples.length > 0, 'au moins une description soutenue par plusieurs preuves');
  for (const g of multiples) { assert.ok(g.every((a) => k(a.description) === k(g[0].description))); assert.ok(new Set(g.map((a) => k(a.preuve.fondation))).size > 1 || new Set(g.map((a) => k(a.preuve.temoinsContexte))).size > 1); }
});

test('C2. UNE PREUVE, PLUSIEURS DESCRIPTIONS (vécu réel : oui→oui ×2) : une même fondation exacte soutient « valeurs.arrivee = oui » ET « relationValeur = egale » ; relation preuve ↔ description non 1→1', async () => {
  const { w, E } = await vecu([['oui', 'oui'], ['salut', 'non'], ['oui', 'oui'], ['bonjour', 'merci']], 'oui');
  const L = (await w.lignes()).filter((a) => a.references.idDesignation === E.id && a.preuve.fondation);
  const parFondation = new Map(); for (const a of L) parFondation.set(k(a.preuve.fondation), [...(parFondation.get(k(a.preuve.fondation)) ?? []), a]);
  const partagee = [...parFondation.values()].find((g) => new Set(g.map((a) => k(a.description))).size >= 2);
  assert.ok(partagee, 'une fondation exacte, plusieurs descriptions distinctes');
  assert.deepEqual(partagee.map((a) => `${a.description.chemin.join('.')}=${a.description.constat.valeur}`).sort(), ['relationValeur=egale', 'valeurs.arrivee=oui']);
  assert.notDeepEqual(partagee[0].description.relation, partagee[1].description.relation);
});

test('C3. RELATION SANS PREUVE : extraite de la description, elle ne contient aucune identité historique, se compare entre occurrences et regroupe les expériences sans consulter la preuve ; la preuve reste intacte et séparée', async () => {
  const { lignes, experiences } = await reference();
  const ids = new Set(lignes.flatMap((a) => [a.id, a.idObservation, a.references.idContexte, a.references.idDesignation, ...parcourirStructure(a.preuve).filter((o) => o.type === 'chaine').map((o) => o.valeur)]));
  for (const a of lignes.filter((x) => x.preuve.fondation)) {
    for (const o of parcourirStructure(a.description.relation)) if (o.type === 'chaine') assert.equal(ids.has(o.valeur) && /-\d{10,}|^(message|reception|execution|designation|contexte|attente)/.test(o.valeur), false, o.valeur);
  }
  const sansPreuve = experiences.filter((e) => e.avant.description.relation).map((e) => ({ ...e, avant: { description: e.avant.description } }));
  const g1 = regrouperExperiences(sansPreuve, [['avant', 'description', 'relation']]);
  const g2 = regrouperExperiences(experiences.filter((e) => e.avant.description.relation), [['avant', 'description', 'relation']]);
  assert.deepEqual(g1.map((g) => [g.cle, g.couverture]), g2.map((g) => [g.cle, g.couverture]), 'la preuve n’entre pas dans la comparaison');
  assert.ok(g1.some((g) => g.couverture.length > 1), 'une même relation sur plusieurs occurrences');
  for (const e of experiences) assert.deepEqual(e.avant.preuve, lignes.find((a) => a.id === e.id).preuve, 'preuve accessible séparément, intacte');
});

// ================================================================================================================ D. OBSERVATION
test('D1. OBSERVATION NAÏVE DE L’EXPÉRIENCE ENTIÈRE : chaque occurrence du parcours appartient à UNE région (racine : occurrence/références ; avant.description ; avant.preuve ; apres) ; les régions ne se recouvrent pas', async () => {
  const { experiences } = await reference();
  const region = (c) => (c.length === 0 ? 'racine' : c.length === 1 && c[0] !== 'avant' && c[0] !== 'apres' ? 'references' : c[0] === 'apres' ? 'apres' : c.length === 1 ? 'avant' : c[1]);
  const total = {};
  for (const e of experiences) for (const o of parcourirStructure(e)) { const r = region(o.chemin); total[r] = (total[r] ?? 0) + 1; }
  assert.deepEqual(Object.keys(total).sort(), ['apres', 'avant', 'description', 'preuve', 'racine', 'references']);
  assert.equal(total.racine, experiences.length); assert.equal(total.avant, experiences.length); assert.equal(total.references, 4 * experiences.length);
  assert.ok(total.preuve > total.description, 'la preuve (témoins, couvertures) est la plus volumineuse');
});

test('D2. OBSERVATION PAR RÔLE (sans sélecteur métier : seulement la POSITION avant.description) : les éléments décrits n’embarquent ni les références de l’expérience, ni ses témoins, ni ses couvertures ; la preuve s’observe de même, séparément', async () => {
  const { experiences, lignes } = await reference();
  const role = (e, position) => position.reduce((o, c) => o[c], e);
  const elements = (position) => experiences.map((e) => ({ chemin: [e.id], contenu: structuredClone(role(e, position)) }));
  const desc = constatsParChemin(elements(['avant', 'description']));
  const preuve = constatsParChemin(elements(['avant', 'preuve']));
  for (const e of experiences) {
    const propres = new Set([e.id, e.idContexte, e.idDesignation, e.idExecution]);
    for (const o of parcourirStructure(e.avant.description)) assert.equal(o.type === 'chaine' && propres.has(o.valeur), false);
    assert.deepEqual(parcourirStructure(e.avant.description), parcourirStructure(rolesDeLAttente(lignes.find((a) => a.id === e.id)).description), 'exactement la description de la ligne');
  }
  // aucun chemin observé sous la description n'est un chemin de la preuve, et inversement
  const ch = (cpc) => new Set(cpc.chemins.filter((c) => c.chemin.length > 0).map((c) => k(c.chemin))); // la racine de chaque élément est commune par construction
  const D = ch(desc); const P = ch(preuve);
  assert.equal([...D].filter((c) => P.has(c)).length, 0);
  assert.ok(D.has(k(['constat', 'type'])) && D.has(k(['chemin', 0])));
});

test('D3. SONDE CO-COUVERTURES (coCouverturesDeDescriptions inchangée, non branchée) : descriptions = sous-objets avant.description.relation et constats d’apres ; aucune classe ne contient une valeur de preuve ou de référence', async () => {
  const { experiences, lignes } = await reference();
  const X = experiences.filter((e) => e.avant.description.relation);
  const groupes = regrouperExperiences(X, [['avant', 'description', 'relation']]);
  const cpc = constatsParChemin(X.map((e) => ({ chemin: [e.id], contenu: e.apres })));
  const descriptions = [...groupes.map((g) => ({ description: { relation: g.cle[0] }, couverture: g.couverture })), ...cpc.chemins.flatMap((c) => c.constats.filter((q) => Object.hasOwn(q, 'valeur')).map((q) => ({ description: { chemin: c.chemin, valeur: q.valeur }, couverture: q.couverture })))];
  const classes = coCouverturesDeDescriptions(descriptions, cpc.universelle);
  const interdits = new Set(lignes.flatMap((a) => [a.id, a.idObservation, a.references.idContexte, a.references.idDesignation, ...parcourirStructure(a.preuve).filter((o) => o.type === 'chaine').map((o) => o.valeur)]));
  for (const c of classes) for (const d of c.descriptions) for (const o of parcourirStructure(d)) assert.equal(o.type === 'chaine' && interdits.has(o.valeur) && /-\d{10,}/.test(o.valeur), false, k(d));
  assert.ok(Array.isArray(classes));
});

// ================================================================================================================ E. ANTI-TRICHE, PLURALITÉ, DORMANCE
test('E1. ANTI-TRICHE : après renommage opaque de TOUTES les clés (ligne et expérience), les quatre rôles restent quatre positions distinctes, avec exactement les mêmes feuilles qu’avant', async () => {
  const { lignes, experiences } = await reference();
  const noms = new Map(); const opaque = (c) => { if (!noms.has(c)) noms.set(c, `k${noms.size}`); return noms.get(c); };
  const renommer = (x) => (Array.isArray(x) ? x.map(renommer) : x !== null && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([c, v]) => [opaque(c), renommer(v)])) : x);
  const feuilles = (x) => parcourirStructure(x).filter((o) => !['objet', 'tableau'].includes(o.type)).map((o) => k([o.type, o.valeur])).sort();
  for (const a of lignes) {
    const R = renommer(a);
    const enfantsObjets = Object.values(R).filter((v) => v !== null && typeof v === 'object' && !Array.isArray(v));
    const scalaires = Object.values(R).filter((v) => typeof v !== 'object');
    assert.equal(enfantsObjets.length, 3, 'trois sous-objets : description, preuve, références'); assert.equal(scalaires.length, 3, 'occurrence à la racine');
    assert.deepEqual(enfantsObjets.map(feuilles), [a.description, a.preuve, a.references].map(feuilles), 'chaque position garde exactement ses données');
  }
  for (const e of experiences) {
    const R = renommer(e); const avant = Object.values(R).find((v) => v !== null && typeof v === 'object' && Object.values(v).length === 2 && Object.values(v).every((x) => x && typeof x === 'object'));
    assert.ok(avant, 'avant : deux sous-objets (description, preuve) même sans noms');
    assert.deepEqual(Object.values(avant).map(feuilles), [e.avant.description, e.avant.preuve].map(feuilles));
  }
});

test('E2. PLURALITÉ DES ISSUES INCHANGÉE (non corrigée ici) : une double réponse fait toujours refuser experiencesDAttentes, avec le message de .64.6', async () => {
  const { w } = await vecu([['K9', '77'], ['Q4', '55']]);
  const E = await w.message('K9'); await w.message('77', E.id); await w.message('77', E.id);
  await assert.rejects(w.experiences(), /2 exécutions portent la désignation/);
});

test('E3. DORMANCE : seuls issue-attente-prospective, experiences-attentes, attentes-du-tour et confrontations-attentes (v0.64.8) importent roles-attente ; aucun mécanisme de décision ne lit les rôles ; calcul et persistance ne l’importent pas', () => {
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /from '\.\/roles-attente\.js'/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1)).sort();
  assert.deepEqual(importeurs, ['app/langage/attentes-du-tour.js', 'app/langage/confrontations-attentes.js', 'app/langage/experiences-attentes.js', 'app/langage/issue-attente-prospective.js']); // MISE À JOUR DÉLIBÉRÉE v0.64.8 (confrontation comme unité du vécu) : + confrontations-attentes.js (vue pure dormante)
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/roles-attente/.test(s), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});

test('E4. ÉLÉMENTS D’EXPÉRIENCES : contenu { avant: { description, preuve }, apres } ; les références restent hors du contenu ; constatsParChemin lit la description et la preuve à des chemins distincts', async () => {
  const { experiences } = await reference();
  const el = elementsDExperiences(experiences);
  assert.ok(el.every((x) => k(Object.keys(x.contenu)) === k(['avant', 'apres']) && k(Object.keys(x.contenu.avant)) === k(['description', 'preuve'])));
  const cpc = constatsParChemin(el);
  assert.ok(cpc.chemins.some((c) => k(c.chemin) === k(['avant', 'description', 'constat', 'type'])));
  assert.ok(cpc.chemins.some((c) => c.chemin[0] === 'avant' && c.chemin[1] === 'preuve'));
  assert.equal(cpc.chemins.some((c) => c.chemin.some((s) => s === 'idContexte' || s === 'idDesignation' || s === 'idExecution')), false);
});
