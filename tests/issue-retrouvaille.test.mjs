// v0.64.33 — « CONFRONTER UNE RELATION RETROUVÉE À CE QUI EST ARRIVÉ » (GO ChatGPT « GO DÉVELOPPEMENT v0.64.33 », 16/10/2026 ; diagnostic
// pré-v0.64.33 approuvé). RELECTURE ACTUELLE : la relation retrouvée à T2 (groupe figé du contexte, statut 'retrouvee') est confrontée à ce
// que le MÊME acte a réellement produit — réalisée, autre, absente, confrontation incomplète, ou rien encore — même quand aucune attente ne
// l'a reformulée ; rien n'est écrit, la retrouvaille historique ne change jamais. Tests T1–T18 du GO, Diagnostic et gardes.
// Harnais : celui de tests/retrouvailles.test.mjs (VRAI flux : tours, ticks, capacité), recopié à l'identique.
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
  const magasin = instrumenter(base ?? magasinMemoireVive(), { journal, aveugle }); let n = 0; const nouvelId = (p) => `${p}-r33-${++n}`;
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

import { confronterRetrouvaille, confrontationsDesRetrouvailles, STATUTS_ISSUE_RETROUVAILLE } from '../app/langage/issue-retrouvaille.js';
import * as VUE_ISSUE from '../app/langage/issue-retrouvaille.js';
import { issuesDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { memesRelations } from '../app/langage/relations-formulees.js';
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


// ---------------------------------------------------------------------------------------------------------------- outils v0.64.33
// Pont Diagnostic COMPLET (même code que main.js) : groupes, attentes, et issues relues aujourd'hui.
async function pontComplet(magasin) {
  const [contextes, lignes] = await Promise.all([magasin.lireTout('contextesProspectifs'), magasin.lireTout('attentesProspectives')]);
  let issues;
  try { issues = confrontationsDesRetrouvailles(contextes, await lireExecutionsVecues(magasin)); } catch (err) { issues = { erreur: err && err.message ? err.message : String(err) }; }
  return { relues: relireRetrouvailles(contextes), attentes: attentesEcritesParContexte(lignes), issues };
}
const lire = (magasin, table) => (magasin.lireBrut ?? magasin.lireTout)(table);
const ctx = async (magasin, id) => (await lire(magasin, 'contextesProspectifs')).find((c) => c.id === id);
const attentesAvecR = async (magasin, c, r) => (await lire(magasin, 'attentesProspectives')).filter((l) => (l.references ? l.references.idContexte : l.idContexte) === c.id && avecRelation(l) && memesRelations(l.description.relation, r));
const avecGroupe = (c, retrouvaille) => ({ ...structuredClone(c), retrouvaille });
// Monde « coût 2 à quatre » (diagnostic pré-v0.64.33) : R 2→1 retrouvée à « quatre », issue réelle 2→0 ; ensuite, à « six » et « neuf »,
// R 2→1 est encore retrouvée mais aucune attente ne la porte (l'histoire contient 2→1 et 2→0).
const JUSQUA_QUATRE = SCENARIO.slice(0, SCENARIO.findIndex((p) => p[1] === 'quatre'));
let mondeCout2 = null;
const vecuCout2 = () => (mondeCout2 ??= vivre([...JUSQUA_QUATRE, ['msg', 'quatre', 2], ['tick', 3], ['msg', 'cinq'], ['msg', 'six'], ['msg', 'sept'], ['tick', 3], ['msg', 'huit'], ['msg', 'neuf']]));
const ARRIVEE_1 = { valeurs: { arrivee: 1 } };

// ================================================================================================================ T1 / T9
test('T1 / T9. R 2→1 retrouvée à T2, tour réellement passé à 1 → realisee, réel { valeurs: { arrivee: 1 } } ; t2 = copie exacte du groupe persisté ; même statut que l\'issue de l\'attente conditionnée de même relation', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const six = await ctx(w.magasin, tourDe(etapes, 'six').id);
  const r = confronterRetrouvaille(six, v);
  assert.deepEqual(r.t2, { statut: 'retrouvee', relation: six.retrouvaille.relations[0].relation });
  assert.equal(r.idContexte, six.id); assert.equal(Object.hasOwn(r, 'idActe'), false);
  assert.equal(r.aujourdhui.issues.length, 1);
  assert.deepEqual(r.aujourdhui.issues[0], { idExecution: r.aujourdhui.issues[0].idExecution, statut: 'realisee', reel: ARRIVEE_1 });
  assert.match(r.aujourdhui.issues[0].idExecution, /^variation-capacite-/, 'la conséquence est la variation persistée, projetée (aucun bandeau, aucun humain)');
  const [a] = await attentesAvecR(w.magasin, six, r.t2.relation);
  assert.deepEqual(issuesDeLAttenteProspective(a, six, v.valeurs, v.executions, v.descriptions).map((i) => i.statut), ['realisee'], 'contrat équivalent à celui de l\'issue d\'attente pour une feuille');
  // T9 : tous les soi:tour retrouvés du scénario partagé
  for (const e of etapes) for (const c of e.contextes.filter((x) => vue(x.structure) === 'soi:tour(etat)' && x.retrouvaille.statut === 'retrouvee')) {
    const x = confronterRetrouvaille(c, v);
    assert.deepEqual(x.aujourdhui.issues.map((i) => i.statut), ['realisee'], e.etiquette);
  }
});

// ================================================================================================================ T2 / T4
test('T2 / T4. coût 2 à « quatre » : R 2→1 retrouvée, réel 2→0 → autre + réel { valeurs: { arrivee: 0 } } ; ensuite « six » et « neuf » : R retrouvée, AUCUNE attente portant R, confrontation réalisée quand même', async () => {
  const { w, etapes } = await vecuCout2(); const v = await vecu(w.magasin);
  assert.equal((await lireCapacite(w.magasin)).valeur >= 0, true);
  const quatre = tourDe(etapes, 'quatre');
  assert.equal(await departDe(w.magasin, quatre), 2);
  const q = confronterRetrouvaille(quatre, v);
  assert.deepEqual(q.t2.relation.attendu, ARRIVEE_1);
  assert.deepEqual(q.aujourdhui.issues.map(({ statut, reel }) => ({ statut, reel })), [{ statut: 'autre', reel: { valeurs: { arrivee: 0 } } }]);
  for (const etiquette of ['six', 'neuf']) {
    const c = tourDe(etapes, etiquette);
    assert.equal(await departDe(w.magasin, c), 2, etiquette);
    assert.equal(c.retrouvaille.statut, 'retrouvee', etiquette);
    assert.deepEqual(c.retrouvaille.relations[0].relation.attendu, ARRIVEE_1);
    assert.deepEqual(await attentesAvecR(w.magasin, c, c.retrouvaille.relations[0].relation), [], `${etiquette} : aucune attente ne porte R`);
    assert.deepEqual(confronterRetrouvaille(c, v).aujourdhui.issues.map(({ statut, reel }) => ({ statut, reel })), [{ statut: 'realisee', reel: ARRIVEE_1 }], etiquette);
  }
  // la confrontation de « quatre » (autre) n'a rien changé aux retrouvailles suivantes : elles ne lisent aucune issue
  assert.equal(tourDe(etapes, 'six').retrouvaille.statut, 'retrouvee');
});

// ================================================================================================================ T3
test('T3. rien encore : l\'acte n\'a aucune conséquence vécue → issues [] (aucune conclusion) ; distinct de absente', async () => {
  const { w, etapes } = await vivre(SCENARIO.slice(0, SCENARIO.findIndex((p) => p[1] === 'six') + 1));
  const six = tourDe(etapes, 'six');
  const sans = await redemarrer(w.magasin, (d) => ({ ...d, variationsCapacite: d.variationsCapacite.filter((x) => !(x.cause && x.cause.id === six.idDesignation)) }));
  const r = confronterRetrouvaille(await ctx(sans, six.id), await vecu(sans));
  assert.equal(r.t2.statut, 'retrouvee');
  assert.deepEqual(r.aujourdhui, { issues: [] });
  assert.deepEqual(confronterRetrouvaille(six, await vecu(w.magasin)).aujourdhui.issues.map((i) => i.statut), ['realisee'], 'avec sa conséquence : realisee');
});

// ================================================================================================================ T5 / T6 / T7
test('T5 / T6 / T7. abstention, aucune, non-effectuee → RIEN n\'est confronté ; aucune candidate désignée après coup ; aucune relation reconstruite', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const six = tourDe(etapes, 'six');
  const g21 = await ligneR(w.magasin, 'soi:tour', 2, ARRIVEE(1));
  const x = forger(g21); const y = forger(g21, { relation: avecAttendu(R(g21), ARRIVEE(0)) });
  const abst = retrouvailleDuContexte(sansGroupe(six), [x, y], v);
  assert.equal(abst.statut, 'abstention'); assert.equal(abst.relations.length, 2);
  const r5 = confronterRetrouvaille(avecGroupe(six, abst), v);
  assert.deepEqual(r5, { idContexte: six.id, t2: { statut: 'abstention' }, aujourdhui: { confrontation: 'aucune-relation-unique' } }, 'le futur (2→1) correspond à x : x n\'est pas désignée');
  // T6 : « deux » (départ 2, T2 = aucune) : son futur 2→1 ressemble à la R formulée ensuite → aucune retrouvaille rétroactive
  const deux = tourDe(etapes, 'deux');
  assert.equal(deux.retrouvaille.statut, 'aucune');
  assert.deepEqual(confronterRetrouvaille(deux, v), { idContexte: deux.id, t2: { statut: 'aucune' }, aujourdhui: { confrontation: 'aucune-relation-unique' } });
  // T7
  const ne = confronterRetrouvaille(avecGroupe(six, { statut: 'non-effectuee', relations: [], nonComparees: [] }), v);
  assert.deepEqual(ne, { idContexte: six.id, t2: { statut: 'non-effectuee' }, aujourdhui: { confrontation: 'aucune-relation-unique' } });
  // aucune relation n'apparaît dans ces sorties
  for (const s of [r5, ne]) assert.doesNotMatch(JSON.stringify(s), /arrivee|relation"/);
});

// ================================================================================================================ T8
test('T8. plusieurs formulations → UNE confrontation, identique quel que soit le nombre de formulations ; la vue ne lit pas les formulations', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const six = tourDe(etapes, 'six');
  assert.equal(six.retrouvaille.relations[0].formulations.length, 2);
  const avec = (ids) => avecGroupe(six, { ...six.retrouvaille, relations: [{ ...six.retrouvaille.relations[0], formulations: ids }] });
  const une = confronterRetrouvaille(avec(['attente-a']), v);
  const trois = confronterRetrouvaille(avec(['attente-a', 'attente-b', 'attente-c']), v);
  assert.deepEqual(trois, une); assert.equal(une.aujourdhui.issues.length, 1);
  assert.doesNotMatch(JSON.stringify(une), /attente-a|formulations/, 'aucune formulation transportée');
  assert.doesNotMatch(sansCommentaires(lu('app', 'langage', 'issue-retrouvaille.js')), /formulations/);
});

// ================================================================================================================ T10
test('T10. relationValeur : soi:temps et soi:repos { depart: 3 } → { relationValeur: « egale » } réalisée ; attendu « differente » forgé → autre (differente est une VALEUR, jamais un statut)', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const tous = etapes.flatMap((e) => e.contextes);
  const temps = tous.filter((c) => vue(c.structure) === 'soi:temps(etat)' && c.retrouvaille.statut === 'retrouvee');
  const repos = tous.filter((c) => vue(c.structure) === 'soi:repos(etat)' && c.retrouvaille.statut === 'retrouvee' && Object.hasOwn(c.retrouvaille.relations[0].relation.attendu, 'relationValeur'));
  assert.ok(temps.length > 0 && repos.length > 0);
  for (const c of [...temps, ...repos]) assert.deepEqual(confronterRetrouvaille(c, v).aujourdhui.issues.map(({ statut, reel }) => ({ statut, reel })), [{ statut: 'realisee', reel: { relationValeur: 'egale' } }]);
  const r = temps[0].retrouvaille.relations[0];
  const autre = confronterRetrouvaille(avecGroupe(temps[0], { ...temps[0].retrouvaille, relations: [{ ...r, relation: { ...r.relation, attendu: { relationValeur: 'differente' } } }] }), v);
  assert.deepEqual(autre.aujourdhui.issues.map(({ statut, reel }) => ({ statut, reel })), [{ statut: 'autre', reel: { relationValeur: 'egale' } }]);
  assert.deepEqual(STATUTS_ISSUE_RETROUVAILLE, ['realisee', 'autre', 'absente', 'incomplete']);
});

// ================================================================================================================ T11 / T12
test('T11 / T12. REDÉMARRAGE : T2 relue identique depuis le contexte persisté, issue recalculée identique ; RELECTURE CHANGÉE (autre vécu, autre code) : l\'issue change, la retrouvaille persistée jamais — et la vue n\'écrit rien', async () => {
  const { w, etapes } = await vecuPartage();
  const avant = await pontComplet(w.magasin);
  const neuf = await redemarrer(w.magasin);
  const apres = await pontComplet(neuf);
  assert.deepEqual(apres, avant);
  assert.ok(apres.issues.some((i) => i.t2.statut === 'retrouvee' && i.aujourdhui.issues.length === 1));
  // T12 : une relecture différente (ici : vécu privé des projections de soi, comme le ferait un code de projection changé)
  const six = await ctx(neuf, tourDe(etapes, 'six').id);
  const figee = structuredClone(six.retrouvaille);
  const journal = [];
  const instr = instrumenter(neuf, { journal });
  const v = await vecu(instr);
  const changee = confronterRetrouvaille(six, { ...v, executions: v.executions.filter((e) => !/^variation-/.test(e.id)) });
  assert.deepEqual(changee.aujourdhui, { issues: [] }, 'l\'issue relue dépend de la relecture actuelle');
  assert.deepEqual(changee.t2.relation, figee.relations[0].relation, 'T2 ne dépend que du contexte persisté');
  await pontComplet(instr);
  assert.deepEqual(journal.filter((e) => e.op === 'ecrire'), [], 'aucune écriture');
  assert.deepEqual((await ctx(neuf, six.id)).retrouvaille, figee, 'groupe persisté inchangé');
});

// ================================================================================================================ T13–T16 multi-feuilles
test('T13–T16. MULTI-FEUILLES (contrat des primitives) : toutes égales → realisee ; toutes observables, une autre → autre ; une partie seulement observable → incomplete, AUCUNE conclusion globale ; aucun chemin nécessaire → absente', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const six = tourDe(etapes, 'six');
  const r = six.retrouvaille.relations[0];
  const avecAttenduR = (attendu) => confronterRetrouvaille(avecGroupe(six, { ...six.retrouvaille, relations: [{ ...r, relation: { ...r.relation, attendu } }] }), v).aujourdhui.issues;
  // l'épisode réel de six porte relationValeur « differente » (attente .74 de six) et valeurs.arrivee 1
  assert.deepEqual(avecAttenduR({ relationValeur: 'differente', valeurs: { arrivee: 1 } }).map(({ statut, reel }) => ({ statut, reel })), [{ statut: 'realisee', reel: { relationValeur: 'differente', valeurs: { arrivee: 1 } } }], 'T13');
  assert.deepEqual(avecAttenduR({ relationValeur: 'differente', valeurs: { arrivee: 0 } }).map(({ statut, reel }) => ({ statut, reel })), [{ statut: 'autre', reel: { relationValeur: 'differente', valeurs: { arrivee: 1 } } }], 'T14');
  const partiel = avecAttenduR({ valeurs: { arrivee: 0, inexistante: 5 } });
  assert.equal(partiel.length, 1);
  assert.deepEqual({ ...partiel[0], idExecution: undefined }, { idExecution: undefined, statut: 'incomplete', observes: [{ chemin: ['valeurs', 'arrivee'], type: 'nombre', valeur: 1 }], nonObserves: [['valeurs', 'inexistante']] }, 'T15 : même l\'écart observé sur arrivee ne devient pas « autre » global');
  assert.equal(Object.hasOwn(partiel[0], 'reel'), false);
  assert.deepEqual(avecAttenduR({ inexistante: { encore: 1 } }).map((i) => i.statut), ['absente'], 'T16');
  assert.deepEqual(avecAttenduR({ valeurs: { arrivee: { sous: 1 } } }).map((i) => i.statut), ['absente'], 'T16 : le chemin nécessaire valeurs › arrivee › sous n\'existe pas (arrivee est un nombre)');
  assert.equal(Object.hasOwn(avecAttenduR({ inexistante: 1 })[0], 'reel'), false, 'absente : aucun pseudo-réel');
  // un attendu sans aucune valeur n'est pas confrontable : erreur de relecture pour CE contexte, rien n'est conclu
  const vide = confronterRetrouvaille(avecGroupe(six, { ...six.retrouvaille, relations: [{ ...r, relation: { ...r.relation, attendu: { valeurs: {} } } }] }), v);
  assert.match(vide.aujourdhui.erreur, /aucune valeur/);
});

// ================================================================================================================ vécu illisible
test('INDÉTERMINABLE : vécu illisible → { erreur } pour les contextes retrouvee, aucune conclusion ; la relecture des groupes, elle, reste entière', async () => {
  const { w, etapes } = await vecuPartage(); const v = await vecu(w.magasin);
  const six = tourDe(etapes, 'six');
  const casse = { ...v, descriptions: [] };
  const r = confronterRetrouvaille(six, casse);
  assert.equal(r.t2.statut, 'retrouvee'); assert.equal(typeof r.aujourdhui.erreur, 'string'); assert.equal(Object.hasOwn(r.aujourdhui, 'issues'), false);
  assert.throws(() => confronterRetrouvaille(six, { valeurs: [] }), TypeError);
  assert.throws(() => confronterRetrouvaille({ id: 'c', idDesignation: 'a' }, v), /aucun groupe/);
});

// ================================================================================================================ T17 / T18 gardes
test('T17. GARDE STATIQUE : la vue n\'est importée que par le pont Diagnostic de main.js ; aucun module de retrouvaille, d\'attente, de besoin, de stratégie ni de décision ne la lit ; elle n\'écrit rien', () => {
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /issue-retrouvaille\.js'/.test(readFileSync(f, 'utf8'))).map(rel).sort();
  assert.deepEqual(importeurs, ['app/langage/issues-vecues.js', 'app/main.js']); // MISE À JOUR DÉLIBÉRÉE v0.66.5 (C1, issue vécue d'une retrouvaille) : + issues-vecues.js, écrivain de l'issue vécue : il appelle confronterRetrouvaille pour UNE conséquence et conserve statut et réel rendus ; la vue elle-même reste pure et n'écrit rien
  for (const f of fichiersJs(join(RACINE, 'app')).filter((x) => rel(x) !== 'app/main.js' && rel(x) !== 'app/langage/issue-retrouvaille.js' && rel(x) !== 'app/langage/issues-vecues.js' /* MISE À JOUR DÉLIBÉRÉE v0.66.5 (C1) : l'écrivain de l'issue vécue nomme confronterRetrouvaille */)) assert.doesNotMatch(sansCommentaires(readFileSync(f, 'utf8')), /confronterRetrouvaille|confrontationsDesRetrouvailles/, rel(f));
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.equal((main.match(/confrontationsDesRetrouvailles\(/g) || []).length, 1);
  const k = main.indexOf('retrouvailles: async () => {'); const pont = main.slice(k, main.indexOf('\n    },', k));
  assert.match(pont, /confrontationsDesRetrouvailles\(contextes, await lireExecutionsVecues\(e\.magasin\)\)/, 'appelée dans le seul pont Diagnostic');
  const code = sansCommentaires(lu('app', 'langage', 'issue-retrouvaille.js'));
  assert.doesNotMatch(code, /magasin|lireTout|ecrire|enregistrer|Date|Math\.|setTimeout|horodatage/);
  assert.deepEqual(Object.keys(VUE_ISSUE).sort(), ['STATUTS_ISSUE_RETROUVAILLE', 'confrontationsDesRetrouvailles', 'confronterRetrouvaille']);
  // les modules de la retrouvaille ne lisent toujours aucune issue
  for (const m of ['retrouvailles', 'retrouvaille-forme', 'retrouvailles-persistees']) assert.doesNotMatch(sansCommentaires(lu('app', 'langage', `${m}.js`)), /issue/i, m);
});

test('T18. AUCUN COMPTE, CUMUL NI REGROUPEMENT ENTRE ACTES : une sortie par contexte, chacune ne dépendant que de son contexte (permutation de la table → mêmes sorties permutées) ; vocabulaire sans valence', async () => {
  const { w } = await vecuPartage(); const v = await vecu(w.magasin);
  const lignes = await lire(w.magasin, 'contextesProspectifs');
  const avant = confrontationsDesRetrouvailles(lignes, v);
  assert.equal(avant.length, lignes.filter((l) => Object.hasOwn(l, 'retrouvaille')).length);
  assert.deepEqual(confrontationsDesRetrouvailles([...lignes].reverse(), v), [...avant].reverse());
  for (const s of avant) assert.deepEqual(s, confronterRetrouvaille(lignes.find((l) => l.id === s.idContexte), v));
  const code = sansCommentaires(lu('app', 'langage', 'issue-retrouvaille.js'));
  assert.doesNotMatch(code, /compte|cumul|frequen|confiance|score|vote|majorit|succes|echec|fiab|regle|probab|\.sort\(|reduce\(/i);
  const ecran = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  const i = ecran.indexOf('const LIBELLE_ISSUE_RETROUVAILLE'); const bloc = ecran.slice(i, ecran.indexOf('function creerSectionRetrouvailles(', i));
  assert.doesNotMatch(bloc, /succès|échec|erreur de|confiance|fiable|règle|probab|bonne|mauvaise/i);
});

// ================================================================================================================ Diagnostic
test('D1. DIAGNOSTIC : sous chaque contexte, « RELATION RETROUVÉE À T2 — PERSISTÉE » puis « ISSUE DE CETTE RETROUVAILLE — RELUE AUJOURD\'HUI » (réalisée / autre / rien encore) ; autres statuts : rien n\'est confronté ; copié par « Copier le diagnostic » ; vécu illisible : ligne d\'erreur, groupes intacts', async () => {
  const { w, etapes } = await vecuCout2();
  const appels = { n: 0 };
  let copie = null;
  const { zone } = await ecranAvec(capaciteDe(() => pontComplet(w.magasin), appels), async (t) => { copie = t; });
  await basculer(zone, true);
  const boutonCopier = trouver(zone, (e) => e.tag === 'button' && e._cls.has('bouton-copier-diagnostic'));
  await Promise.all(boutonCopier.listeners.click.map((f) => f()));
  assert.equal(appels.n, 1);
  const court = (id) => { const x = id.match(/^([a-z-]+?)-\d{10,}-(\d+-\d+)$/); return x ? `${x[1]}…${x[2]}` : id; };
  const blocDe = (c) => { const l = copie.split('\n'); const i = l.findIndex((x) => x.includes(`contexte ${court(c.id)} ·`)); const j = l.findIndex((x, k) => k > i && x.trim().startsWith('contexte ')); return l.slice(i, j < 0 ? undefined : j).map((x) => x.trim()); };
  const quatre = blocDe(tourDe(etapes, 'quatre'));
  assert.equal(quatre[1], 'RELATION RETROUVÉE À T2 — PERSISTÉE');
  assert.ok(quatre.includes('relation : domaine soi:tour(etat) · connu { valeurs: { depart: 2 } } · attendu { valeurs: { arrivee: 1 } }'));
  const k = quatre.indexOf('ISSUE DE CETTE RETROUVAILLE — RELUE AUJOURD\'HUI (faits persistés, code actuel ; rien n\'est écrit)');
  assert.ok(k > quatre.findIndex((x) => x.startsWith('attentes de ce contexte')), 'l\'issue relue vient APRÈS le groupe persisté et ses attentes');
  assert.match(quatre[k + 1], /^conséquence variation-capacite…\d+-\d+ : autre — réel \{ valeurs: \{ arrivee: 0 \} \}$/);
  assert.match(blocDe(tourDe(etapes, 'six')).join('\n'), /conséquence variation-capacite…\d+-\d+ : réalisée — réel \{ valeurs: \{ arrivee: 1 \} \}/);
  const deux = blocDe(tourDe(etapes, 'deux'));
  assert.ok(deux.includes('aucune relation retrouvée à T2 : rien n\'est confronté'));
  assert.equal(deux.some((x) => x.startsWith('ISSUE DE CETTE')), false);
  assert.doesNotMatch(copie, /succès|échec|confiance|fiable/);
  // rien encore, abstention, vécu illisible (pont simulé à partir des vraies sorties)
  const reel = await pontComplet(w.magasin);
  const cible = reel.issues.find((i) => i.t2.statut === 'retrouvee');
  const variantes = [
    [{ ...cible, aujourdhui: { issues: [] } }, 'rien n\'est encore arrivé dans cet acte (aucune conséquence vécue) : aucune conclusion'],
    [{ ...cible, aujourdhui: { erreur: 'x' } }, 'issue non relue — confrontation indéterminable : x'],
    [{ ...cible, aujourdhui: { issues: [{ idExecution: 'e', statut: 'incomplete', observes: [{ chemin: ['valeurs', 'arrivee'], type: 'nombre', valeur: 1 }], nonObserves: [['valeurs', 'z']] }] } }, 'conséquence e : confrontation incomplète, aucune conclusion — observé : valeurs › arrivee = 1 ; non observé : valeurs › z'],
    [{ ...cible, aujourdhui: { issues: [{ idExecution: 'e', statut: 'absente' }] } }, 'conséquence e : absente — aucun chemin attendu n\'existe dans ce qui est arrivé'],
    [{ ...cible, t2: { statut: 'abstention' }, aujourdhui: { confrontation: 'aucune-relation-unique' } }, 'abstention à T2 — aucune relation unique retrouvée : rien n\'est confronté, aucune candidate n\'est désignée après coup'],
  ];
  for (const [issue, attendu] of variantes) {
    const { zone: z } = await ecranAvec(capaciteDe(async () => ({ ...reel, issues: reel.issues.map((i) => (i.idContexte === cible.idContexte ? issue : i)) }), { n: 0 }));
    await basculer(z, true);
    assert.ok(texteDiagnostic(z).split('\n').map((x) => x.trim()).includes(attendu), attendu);
  }
  const { zone: z2 } = await ecranAvec(capaciteDe(async () => ({ ...reel, issues: { erreur: 'vécu cassé' } }), { n: 0 }));
  await basculer(z2, true);
  const t2 = texteDiagnostic(z2);
  assert.match(t2, /issue non relue — vécu illisible : vécu cassé/);
  assert.match(t2, /relation : domaine soi:tour\(etat\) · connu \{ valeurs: \{ depart: 2 \} \}/, 'les groupes restent lus');
});

test('G. BASE / SCHÉMA / TABLES inchangés : 29 / 19 / 35 ; aucune table, aucune écriture d\'issue', () => {
  assert.equal(VERSION_BASE, 30); assert.equal(SCHEMA_SAUVEGARDE, 20); assert.equal(TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.doesNotMatch(TABLES.filter((t) => t !== 'issuesRetrouvailles').join(','), /issue|confront/i); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
});
