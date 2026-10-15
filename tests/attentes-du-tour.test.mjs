// === DEBUT_TEST_ATTENTES_DU_TOUR ===
// v0.63.78 — JALON 1 DE LA REPRISE (décision ChatGPT, 09/10/2026) : rendre visibles, dans la zone « Sollicitation (outil de développement) »,
// les attentes prospectives que les exécutions d'un tour ont écrites AVANT leur issue, puis l'issue de chacune (réalisée / autre / absente), ou
// « sans issue » si rien n'est advenu. Lecture seule, aucune règle, aucun mécanisme modifié.
// Quatre familles : A. présentation pure (attentesDesResultats) ; B. flux réel 7 tours (même scénario que attentes-prospectives C2) ;
// C. écran (faux DOM) ; D. gardes statiques et comportement vivant inchangé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.attrs = {}; }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c) { this.appendChild(c); }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(sel) { const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, '')); const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; }; return parcourir(this); }
}
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;

const { attentesDesResultats, lireAttentesDuLot } = await import('../app/langage/attentes-du-tour.js');
const { monterConversation } = await import('../app/conversation/ecran.js');
const { suivreObservationDuTour } = await import('../app/langage/contexte-sollicitation.js');
const { executerApplicationsDeterminees } = await import('../app/langage/execution-mecanique.js');
const { observerPossibilites } = await import('../app/langage/observation-possibilites.js');
const { traiterTourAvecEnonce } = await import('../app/langage/pont.js');
const { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES, VERSION_BASE } = await import('../app/langage/connaissances.js');
const { TABLE_OPERATIONS } = await import('../app/langage/table-operations.js');
const { DESCRIPTIONS_OPERATIONS } = await import('../app/langage/descriptions-operations.js');
const { SCHEMA_SAUVEGARDE } = await import('../app/memoire/sauvegarde.js');

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const MODULE = lu('app', 'langage', 'attentes-du-tour.js');
const CODE = sansCommentaires(MODULE);
const T = 'attentesProspectives';
const tous = (e, r = []) => { for (const c of e.children) { r.push(c); tous(c, r); } return r; };

// ------------------------------------------------------------------------------------------------------- flux réel (même harnais que .74 C2)
let compteurIds = 0;
// MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chaque message est traité ; le scénario ORDINAIRE porte désormais des attentes du lot écrites par
// des applications mécaniques NOUVELLES. La fixture d'enrichissement extérieur de .93 (scénario dédié) est RETIRÉE : elle doublait une application
// que le lot exécute lui-même. Les tests A2, A3, B1 bis, B2, B4, C4 portent sur le scénario ordinaire.
async function rejouer(scenario, { lecteur = 'magasin', magasin = magasinMemoireVive() } = {}) {
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const tours = []; const ex2 = () => magasin.lireTout('executionsOperations');
  for (const t of scenario) {
    const lireMagasin = lecteur === 'magasin' ? async () => magasin : lecteur === 'echec' ? async () => { throw new Error('magasin indisponible'); } : null;
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }), lireMagasin);
    const res = await traiterTourAvecEnonce(t, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    tours.push(suivi.joindre(res).sollicitation);
  }
  return { tours, magasin, attentes: await magasin.lireTout(T), executions: await ex2(), contextes: await magasin.lireTout('contextesProspectifs'), valeurs: await magasin.lireTout('valeursDonnees') };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const CLES_LIGNE = ['idAttente', 'idDesignation', 'operation', 'horodatageAttente', 'structure', 'chemin', 'constat', 'issue'];

// ============================================================================================================== A. PRÉSENTATION PURE
test('A1. exports exacts ; refus des entrées non tabulaires ; aucun résultat -> aucune ligne (aucune lecture)', async () => {
  const module = await import('../app/langage/attentes-du-tour.js');
  assert.deepEqual(Object.keys(module).sort(), ['attentesDesResultats', 'lireAttentesDuLot']);
  assert.throws(() => attentesDesResultats(null, [], [], [], [], []), /resultats doit être un tableau/);
  assert.throws(() => attentesDesResultats([], {}, [], [], [], []), /lignesAttentes doit être un tableau/);
  assert.throws(() => attentesDesResultats([], [], [], [], [], null), /descriptions doit être un tableau/);
  assert.deepEqual(attentesDesResultats([], [{ id: 'a', idDesignation: 'd' }], [], [], [], DESCRIPTIONS_OPERATIONS), []);
  let lectures = 0;
  const magasin = { lireTout: async () => { lectures += 1; return []; } };
  assert.deepEqual(await lireAttentesDuLot({ resultats: [] }, magasin), { attentes: [], echec: null });
  assert.deepEqual(await lireAttentesDuLot(null, magasin), { attentes: [], echec: null });
  assert.equal(lectures, 0, 'sans exécution dans le lot, rien n\'est lu');
});

test('A2. (MISE À JOUR DÉLIBÉRÉE v0.63.94 : scénario ordinaire, lot = applications mécaniques NOUVELLES ; .93 : scénario dédié) seules les attentes des désignations du lot sont présentées, dans l\'ordre de la table ; une attente sans exécution -> issue null (« sans issue ») ; forme exacte des lignes', async () => {
  const { tours, attentes, contextes, valeurs, executions } = await rejouer(SCENARIO.slice(0, 4));
  const lot = tours[3]; assert.deepEqual(lot.dejaExecutees, []); assert.ok(lot.automatiques.length > 0 && lot.automatiques.every((r) => r.designation.origine === 'mecanique'));
  const ids = new Set(lot.automatiques.map((r) => r.designation.id));
  const attendues = attentes.filter((a) => ids.has(a.references.idDesignation)); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : idDesignation est une référence de la ligne
  assert.ok(attendues.length > 0);
  const lignes = attentesDesResultats(lot.automatiques, attentes, contextes, valeurs, executions, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(lignes.map((l) => l.idAttente), attendues.map((a) => a.id), 'ordre persistant, rien d\'autre');
  for (const l of lignes) {
    assert.deepEqual(Object.keys(l), CLES_LIGNE);
    assert.equal(typeof l.operation, 'string');
    assert.match(l.structure, /^[A-Za-z]+\([^)]*\)(>[A-Za-z]+\([^)]*\))*$/);
    assert.notEqual(l.issue, null);
    assert.ok(['realisee', 'autre', 'absente'].includes(l.issue.statut));
    assert.ok(l.horodatageAttente <= l.issue.horodatageExecution, 'attente écrite AVANT l\'exécution');
  }
  // une attente dont la désignation n'a pas d'exécution (exécution retirée du magasin lu) : issue null, aucun statut inventé
  const sansExec = executions.filter((e) => !ids.has(e.idDesignation));
  const lignes2 = attentesDesResultats(lot.automatiques, attentes, contextes, valeurs, sansExec, DESCRIPTIONS_OPERATIONS);
  assert.equal(lignes2.length, lignes.length);
  for (const l of lignes2) assert.equal(l.issue, null);
});

test('A3. (MISE À JOUR DÉLIBÉRÉE v0.63.94 : scénario ordinaire, lot = applications mécaniques NOUVELLES ; .93 : scénario dédié) pureté : entrées gelées intactes ; deux appels identiques -> sorties égales et non partagées ; une attente dont le contexte manque porte `erreur` sans gêner les autres', async () => {
  const { tours, attentes, contextes, valeurs, executions } = await rejouer(SCENARIO.slice(0, 4));
  const lot = tours[3];
  const geler = (x) => { if (x !== null && typeof x === 'object') { Object.freeze(x); for (const v of Object.values(x)) geler(v); } return x; };
  const args = [lot.automatiques, attentes, contextes, valeurs, executions, DESCRIPTIONS_OPERATIONS].map((x) => geler(structuredClone(x)));
  const avant = JSON.stringify(args);
  const l1 = attentesDesResultats(...args); const l2 = attentesDesResultats(...args);
  assert.deepEqual(l1, l2); assert.notEqual(l1[0], l2[0]); assert.notEqual(l1[0].constat, l2[0].constat);
  assert.equal(JSON.stringify(args), avant);
  const lignes = attentesDesResultats(lot.automatiques, attentes, [], valeurs, executions, DESCRIPTIONS_OPERATIONS);
  assert.equal(lignes.length, l1.length);
  for (const l of lignes) { assert.equal(l.issue, null); assert.match(l.erreur, /introuvable/); }
});

// ============================================================================================================== B. FLUX RÉEL
test('B1. SCÉNARIO RÉEL 7 tours (MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chaque message est traité ; les attentes du lot reviennent, portées par des applications NOUVELLES — .93 : 0 partout ; .92 : 0,0,0,16,4,4,4 par réexécutions) : 70 attentes (0,0,8,26,10,12,14), aucune application déjà exécutée', async () => {
  const { tours, attentes, executions } = await rejouer(SCENARIO);
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 5, 13, 13, 13, 13]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 5, 10, 3, 3, 3, 3]); // était [2, 4, 9, 1, 1, 1, 1] : le « 1 » était la réexécution DT6 // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.deepEqual(tours.map((s) => s.dejaExecutees.length), [0, 0, 0, 0, 0, 0, 0]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.equal(executions.length, 29); assert.equal(attentes.length, 70); // étaient 19 et 28 // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
  assert.deepEqual(tours.map((s) => s.attentes.length), [0, 0, 8, 26, 10, 12, 14]); // était [0, 0, 0, 16, 4, 4, 4] // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
  assert.deepEqual(tours.map((s) => s.echecAttentes), [null, null, null, null, null, null, null]);
});

test('B1 bis. MÉCANISME DES ATTENTES DU LOT (MISE À JOUR DÉLIBÉRÉE v0.63.94 : scénario ordinaire ; les désignations testées sont MÉCANIQUES et NOUVELLES) : la bulle de chaque tour porte EXACTEMENT les attentes écrites par son lot, chacune avec son issue, écrite avant l\'exécution ; les deux statuts (réalisée / autre) apparaissent', async () => {
  const { tours, attentes, executions } = await rejouer(SCENARIO);
  assert.ok(attentes.length > 0); assert.ok(tours.slice(1).every((s) => s.automatiques.length > 0));
  for (const s of tours) {
    assert.deepEqual(s.dejaExecutees, [], 'aucune application déjà exécutée : chaque désignation du lot est NOUVELLE');
    for (const r of s.automatiques) { assert.equal(r.statut, 'executee'); assert.equal(r.designation.origine, 'mecanique'); }
    const ids = new Set(s.automatiques.map((r) => r.designation.id));
    assert.deepEqual(s.attentes.map((a) => a.idAttente), attentes.filter((a) => ids.has(a.references.idDesignation)).map((a) => a.id));
    for (const a of s.attentes) {
      assert.deepEqual(Object.keys(a), CLES_LIGNE);
      assert.notEqual(a.issue, null, 'l\'exécution a eu lieu dans le même lot : l\'issue est disponible');
      assert.ok(a.horodatageAttente <= a.issue.horodatageExecution);
      assert.ok(['realisee', 'autre'].includes(a.issue.statut));
      if (a.issue.statut === 'realisee') assert.deepEqual(a.issue.reel, a.constat); else assert.notDeepEqual(a.issue.reel, a.constat);
    }
  }
  // toute attente persistée appartient à une désignation MÉCANIQUE du lot (l'extérieur n'écrit que pour ses propres désignations)
  const parLot = new Set(tours.flatMap((s) => s.automatiques.map((r) => r.designation.id)));
  const duLot = attentes.filter((a) => parLot.has(a.references.idDesignation));
  assert.equal(tours.flatMap((s) => s.attentes).length, duLot.length);
  const statuts = {}; for (const a of tours.flatMap((s) => s.attentes)) statuts[a.issue.statut] = (statuts[a.issue.statut] ?? 0) + 1;
  assert.ok(statuts.realisee > 0 && statuts.autre > 0, JSON.stringify(statuts));
  assert.ok(executions.length > 15);
});

test('B2. SCÉNARIO PLUS LONG (MISE À JOUR DÉLIBÉRÉE v0.63.94 : 8 tours, scénario ordinaire ; .93 : 13 tours enrichis par l\'extérieur) : les deux statuts coexistent et sont présentés tels que la vue .75 les rend ; « autre » porte toujours le constat réel ; la présentation ne qualifie jamais', async () => {
  const { tours } = await rejouer(['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'a', 'bb']); // MISE À JOUR DÉLIBÉRÉE v0.63.94 : 8 tours au lieu de 13 (chaque message est désormais traité : budget de temps du robot ; les deux statuts coexistent déjà) // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : scénario dédié (univers enrichi par l'extérieur ; attentes des applications mécaniques NOUVELLES du lot)
  const toutes = tours.flatMap((s) => s.attentes);
  assert.ok(toutes.length > 28);
  const autres = toutes.filter((a) => a.issue !== null && a.issue.statut === 'autre');
  const realisees = toutes.filter((a) => a.issue !== null && a.issue.statut === 'realisee');
  assert.ok(realisees.length > 0 && autres.length > 0);
  for (const a of autres) { assert.ok(Object.hasOwn(a.issue, 'reel')); assert.notDeepEqual(a.issue.reel, a.constat); }
  for (const a of realisees) assert.deepEqual(a.issue.reel, a.constat);
  for (const a of toutes) assert.deepEqual(Object.keys(a), CLES_LIGNE);
  assert.equal(/reussite|réussite|confiance|score|recompense|récompense|preference|préférence|probab|croyance/i.test(CODE), false);
});

test('B3. SANS lecteur de magasin : attentes [] et echecAttentes null, tout le reste identique ; LECTEUR EN ÉCHEC : echecAttentes porte l\'erreur, le tour et le lot sont intacts', async () => {
  const sans = await rejouer(SCENARIO.slice(0, 5), { lecteur: null });
  const avec = await rejouer(SCENARIO.slice(0, 5));
  const echec = await rejouer(SCENARIO.slice(0, 5), { lecteur: 'echec' });
  for (let i = 0; i < 5; i += 1) {
    assert.deepEqual(sans.tours[i].attentes, []); assert.equal(sans.tours[i].echecAttentes, null);
    assert.deepEqual(echec.tours[i].attentes, []);
    assert.match(echec.tours[i].echecAttentes.message, /magasin indisponible/); // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : la branche « lot vide » n'était jamais exercée avant .93 (chaque tour réexécutait) ; mesuré : l'accès au magasin (lireMagasin) est demandé après tout lot, même vide, et son échec est rendu tel quel (code .78 inchangé)
    for (const s of [sans, avec, echec]) {
      assert.deepEqual(s.tours[i].automatiques.map((r) => [r.operation, r.statut]), avec.tours[i].automatiques.map((r) => [r.operation, r.statut]));
      assert.deepEqual(s.tours[i].choixAFaire, avec.tours[i].choixAFaire);
    }
  }
  // les tables persistées sont identiques quel que soit le lecteur : la présentation n'écrit rien
  for (const s of [sans, echec]) {
    assert.equal(s.attentes.length, avec.attentes.length); assert.equal(s.executions.length, avec.executions.length); assert.equal(s.contextes.length, avec.contextes.length);
  }
});

test('B4. (MISE À JOUR DÉLIBÉRÉE v0.63.94 : scénario ordinaire, lot = applications mécaniques NOUVELLES ; .93 : scénario dédié) lireAttentesDuLot : huit lectures exactes (MISE À JOUR DÉLIBÉRÉE v0.63.84 : + capaciteInitiale, variationsCapacite), aucune écriture ; un échec de lecture est rendu dans echec, jamais levé', async () => {
  const { tours, magasin } = await rejouer(SCENARIO.slice(0, 4));
  const lues = []; let ecritures = 0;
  const espion = { lireTout: async (t) => { lues.push(t); return magasin.lireTout(t); }, ecrire: async () => { ecritures += 1; } };
  const lu1 = await lireAttentesDuLot({ resultats: tours[3].automatiques }, espion);
  assert.deepEqual(lues.sort(), ['attentesProspectives', 'capaciteInitiale', 'contextesProspectifs', 'emissions', 'executionsOperations', 'receptions', 'relationInitiale', 'valeursDonnees', 'variationsCapacite', 'variationsRelation']); // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (projection de r dans les exécutions vécues : dix lectures) ; // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1) : + capaciteInitiale, variationsCapacite (projection « soi » dans les exécutions vécues) ; // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + emissions, receptions (exécutions vécues : réelles + réceptions déclarées projetées, via lireExecutionsVecues)
  assert.equal(ecritures, 0); assert.equal(lu1.echec, null); assert.equal(lu1.attentes.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : mesuré, scénario ordinaire (lot = applications mécaniques NOUVELLES) // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
  const casse = { lireTout: async (t) => { if (t === 'contextesProspectifs') throw new Error('boum'); return magasin.lireTout(t); } };
  const lu2 = await lireAttentesDuLot({ resultats: tours[3].automatiques }, casse);
  assert.deepEqual(lu2.attentes, []); assert.match(lu2.echec.message, /boum/);
});

// ============================================================================================================== C. ÉCRAN
async function coquille(repondreFn) {
  const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: repondreFn, surSollicitation: async () => ({ statut: 'executee' }), surActe: null, surJugement: null });
  await conv.recharger();
  const soumettre = async (texte) => { champ.value = texte; await formulaire.listeners.submit[0]({ preventDefault() {} }); };
  const bullesIA = () => liste.children.filter((c) => c._cls.has('message-ia'));
  return { soumettre, bullesIA };
}
const ligneAttente = (sur) => ({ idAttente: 'att-1', idDesignation: 'des-1', operation: 'elementsObservables', horodatageAttente: '2026-10-09T14:03:21.120Z', structure: 'elementsObservables(elements)', chemin: 'relationValeur', constat: { type: 'chaine', valeur: 'egale' }, issue: null, ...sur });
const base = { observation: { id: 'obs-1', possibilites: [] }, univers: [{}], applications: [], choixAFaire: [], automatiques: [{ operation: 'elementsObservables', statut: 'executee', designation: { id: 'des-1' }, execution: { id: 'exe-1' }, erreur: null }], echecDeclenchement: null, echecAttentes: null };

test('C1. ÉCRAN : une attente réalisée -> une ligne « attente écrite avant l\'exécution (hh:mm:ss) : chemin = constat [structure] → issue (hh:mm:ss) : réalisée — réel : … », après la ligne automatique, sans bouton', async () => {
  const sollicitation = { ...base, attentes: [ligneAttente({ issue: { idExecution: 'exe-1', horodatageExecution: '2026-10-09T14:03:21.340Z', statut: 'realisee', reel: { type: 'chaine', valeur: 'egale' } } })] };
  const { soumettre, bullesIA } = await coquille(async () => ({ texte: 'ok', sollicitation }));
  await soumettre('bonjour Pixel');
  const zone = tous(bullesIA()[0]).find((c) => c.tag === 'details' && c._cls.has('sollicitation-dev')); // MISE À JOUR DÉLIBÉRÉE v0.63.90 (ergonomie : la zone Sollicitation est désormais DANS le dépliant « détails du tour » ; on la désigne par sa classe, contenu inchangé)
  const lignes = zone.children.filter((c) => c._cls.has('sollicitation-ligne'));
  assert.deepEqual(lignes.map((l) => l.textContent), [
    'elementsObservables — exécutée automatiquement',
    'elementsObservables — attente écrite avant l\'exécution (14:03:21) : relationValeur = chaine "egale" [elementsObservables(elements)] → issue (14:03:21) : réalisée — réel : chaine "egale"',
  ]);
  assert.ok(lignes[1]._cls.has('sollicitation-attente'));
  assert.equal(tous(zone).filter((c) => c.tag === 'button').length, 0);
});

test('C2. ÉCRAN : « autre » avec le constat réel ; « absente » sans réel ; « sans issue » quand rien n\'est advenu ; une erreur de vue est montrée telle quelle ; echecAttentes aussi', async () => {
  const sollicitation = { ...base, attentes: [
    ligneAttente({ idAttente: 'a1', issue: { idExecution: 'x', horodatageExecution: '2026-10-09T14:03:22.000Z', statut: 'autre', reel: { type: 'chaine', valeur: 'differente' } } }),
    ligneAttente({ idAttente: 'a2', chemin: 'arrivee', constat: { type: 'objet' }, issue: { idExecution: 'x', horodatageExecution: null, statut: 'absente' } }),
    ligneAttente({ idAttente: 'a3', issue: null }),
    ligneAttente({ idAttente: 'a4', issue: null, erreur: 'contexte « c » introuvable.' }),
  ], echecAttentes: new Error('magasin indisponible') };
  const { soumettre, bullesIA } = await coquille(async () => ({ texte: 'ok', sollicitation }));
  await soumettre('bonjour Pixel');
  const zone = tous(bullesIA()[0]).find((c) => c.tag === 'details' && c._cls.has('sollicitation-dev')); // MISE À JOUR DÉLIBÉRÉE v0.63.90 (ergonomie : la zone Sollicitation est désormais DANS le dépliant « détails du tour » ; on la désigne par sa classe, contenu inchangé)
  const textes = zone.children.filter((c) => c._cls.has('sollicitation-attente')).map((l) => l.textContent);
  assert.equal(textes.length, 5);
  assert.match(textes[0], /→ issue \(14:03:22\) : autre — réel : chaine "differente"$/);
  assert.match(textes[1], /: arrivee = objet \[elementsObservables\(elements\)\] → issue \(\?\) : absente$/);
  assert.match(textes[2], /→ sans issue$/);
  assert.match(textes[3], /→ issue non calculable : contexte « c » introuvable\.$/);
  assert.equal(textes[4], 'attentes non lisibles : magasin indisponible');
});

test('C3. ÉCRAN : sans attentes (tours 1 à 3 du scénario réel) la zone est EXACTEMENT celle de v0.63.77 ; une bulle restaurée n\'a aucune zone', async () => {
  const sollicitation = { ...base, attentes: [] };
  const { soumettre, bullesIA } = await coquille(async () => ({ texte: 'ok', sollicitation }));
  await soumettre('bonjour Pixel');
  const zone = tous(bullesIA()[0]).find((c) => c.tag === 'details' && c._cls.has('sollicitation-dev')); // MISE À JOUR DÉLIBÉRÉE v0.63.90 (ergonomie : la zone Sollicitation est désormais DANS le dépliant « détails du tour » ; on la désigne par sa classe, contenu inchangé)
  assert.deepEqual(zone.children.filter((c) => c._cls.has('sollicitation-ligne')).map((l) => l.textContent), ['elementsObservables — exécutée automatiquement']);
  const { soumettre: s2, bullesIA: b2 } = await coquille(async () => ({ texte: 'ok' }));
  await s2('bonjour'); assert.equal(tous(b2()[0]).filter((c) => c.tag === 'details').length, 0);
});

test('C4. BOUT EN BOUT (MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE) : le scénario ORDINAIRE rendu par l\'écran porte une ligne par attente du lot (0,0,8,26,10,12,14), aucune « déjà exécutée » ; chaque ligne (applications mécaniques NOUVELLES) est « réalisée » ou « autre » avec le réel', async () => {
  const ordinaire = await rejouer(SCENARIO);
  let i = 0;
  const { soumettre, bullesIA } = await coquille(async () => ({ texte: 'ok', sollicitation: ordinaire.tours[i++] }));
  for (const t of SCENARIO) await soumettre(t);
  const lignesDe = (cls) => bullesIA().map((b) => tous(b).filter((c) => c._cls.has(cls)).map((l) => l.textContent));
  assert.deepEqual(lignesDe('sollicitation-attente').map((l) => l.length), [0, 0, 8, 26, 10, 12, 14]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
  assert.deepEqual(lignesDe('sollicitation-deja').map((l) => l.length), [0, 0, 0, 0, 0, 0, 0]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  for (const l of lignesDe('sollicitation-deja').flat()) assert.equal(l, 'elementsObservables — déjà exécutée (non relancée)');
  const dedie = await rejouer(SCENARIO);
  let k = 0;
  const ecran2 = await coquille(async () => ({ texte: 'ok', sollicitation: dedie.tours[k++] }));
  for (const t of SCENARIO) await ecran2.soumettre(t);
  const parBulle = ecran2.bullesIA().map((b) => tous(b).filter((c) => c._cls.has('sollicitation-attente')).map((l) => l.textContent));
  assert.deepEqual(parBulle.map((l) => l.length), dedie.tours.map((s) => s.attentes.length));
  assert.ok(parBulle.flat().length > 0);
  for (const l of parBulle.flat()) { assert.match(l, /^[A-Za-z]+ — attente écrite avant l'exécution \(\d\d:\d\d:\d\d\) : .+ → issue \(\d\d:\d\d:\d\d\) : (réalisée|autre) — réel : /); }
  assert.ok(parBulle.flat().some((l) => / : réalisée /.test(l))); assert.ok(parBulle.flat().some((l) => / : autre /.test(l)));
});

// ============================================================================================================== D. GARDES
test('D1. STATIQUE : attentes-du-tour.js n\'importe que la vue .75 et le catalogue ; aucune écriture, aucune horloge, aucun hasard, aucun choix ; importé SEULEMENT par contexte-sollicitation.js', () => {
  assert.deepEqual(MODULE.match(/^import .*$/gm), ["import { issueDeLAttenteProspective } from './issue-attente-prospective.js';", "import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';", "import { rolesDeLAttente } from './roles-attente.js';", "import { lireExecutionsVecues } from './executions-vecues.js';"]); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : + lecture des lignes par rôles // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + executions-vecues.js (lecture seule des exécutions vécues)
  assert.equal(/\.ecrire\(|supprimer|vider|remplacerTout|new Date|Date\.now|Math\.random|localStorage|indexedDB|enregistrer[A-Z]|executer[A-Z]|invoquer|applicationsSollicitables|groupesDeCandidats|\.sort\(/.test(CODE), false);
  assert.deepEqual(CODE.match(/lireTout\('([^']+)'\)/g), ["lireTout('attentesProspectives')", "lireTout('contextesProspectifs')"]); // MISE À JOUR DÉLIBÉRÉE v0.63.83 : valeurs et exécutions (réelles + projetées) viennent de lireExecutionsVecues
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /from '\.\/attentes-du-tour\.js'|from '\.\/langage\/attentes-du-tour\.js'/.test(readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(importeurs, ['app/langage/contexte-sollicitation.js']);
  for (const autre of ['app/main.js', 'app/conversation/ecran.js', 'app/langage/pont.js', 'app/langage/esprit.js', 'app/langage/execution-sollicitee.js', 'app/langage/execution-mecanique.js', 'app/langage/applications-sollicitables.js']) {
    assert.equal(/attentes-du-tour|lireAttentesDuLot|attentesDesResultats/.test(sansCommentaires(lu(...autre.split('/')))), false, autre);
  }
});

const sansPontDiagnostic = (code) => { const i = code.indexOf('attentesConditionnees: async () => {'); const j = code.indexOf('return relireIssuesAujourdhui(', i); return i < 0 || j < 0 ? code : code.slice(0, i) + code.slice(code.indexOf('\n', j)); }; // MISE À JOUR DÉLIBÉRÉE v0.64.28 : le pont Diagnostic de main.js (attentesConditionnees / issuesAujourdhui, lecture seule à l'ouverture de sa section) est retiré du code examiné, et seulement lui ; son contenu est gardé par tests/attentes-conditionnees-persistees.test.mjs
test('D2. STATIQUE : contexte-sollicitation.js ne lit le magasin que par la fonction injectée (jamais nommée dans son code) ; main.js passe exactement un accès en lecture ; ecran.js n\'importe toujours rien du langage', () => {
  const ctx = sansCommentaires(lu('app', 'langage', 'contexte-sollicitation.js'));
  assert.equal((ctx.match(/lireAttentesDuLot\(/g) || []).length, 1);
  assert.equal(/magasin|lireTout|ecrire/.test(ctx), false);
  assert.match(ctx, /lireAttentesDuLot\(lot, await lireMagasin\(\)\)/);
  const main = sansPontDiagnostic(sansCommentaires(lu('app', 'main.js'))); // MISE À JOUR DÉLIBÉRÉE v0.64.28 : hors du seul pont Diagnostic de main.js (sansPontDiagnostic : lecture seule à l'ouverture de sa section, gardée par tests/attentes-conditionnees-persistees.test.mjs)
  assert.equal((main.match(/async \(\) => \(await ecranLangage\.assurerEsprit\(\)\)\.magasin\)/g) || []).length, 1);
  assert.equal(/attentesProspectives|contextesProspectifs|issueDeLAttenteProspective/.test(main), false);
  const ecran = sansCommentaires(lu('app', 'conversation', 'ecran.js')).replace('RELU AUJOURD\\\'HUI — avec le magasin et le code actuels', ''); // MISE À JOUR DÉLIBÉRÉE v0.64.28 : seul le libellé affiché imposé par le GO (« RELU AUJOURD'HUI — avec le magasin et le code actuels ») est retiré ; ecran.js n'accède toujours à aucun magasin
  assert.equal(/attentesProspectives|contextesProspectifs|issueDeLAttenteProspective|lireTout|magasin/.test(ecran), false);
  assert.equal((ecran.match(/sollicitation-attente/g) || []).length, 2, 'lignes d\'attente + ligne d\'échec de lecture');
});

test('D3. INVARIANTS : aucune table, aucune version de base, aucun schéma, aucune opération ajoutée ; le mécanisme des attentes (.74/.75) est intact (empreinte des deux fichiers)', () => {
  assert.equal(VERSION_BASE, 29); assert.equal(SCHEMA_SAUVEGARDE, 19); assert.equal(TABLES.length, 35); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A) : + tables emissions et receptions (faits persistés, aucune règle) ; le jalon 1 reste inchangé // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 24 → 25 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 14 → 15 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 30 → 31 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.17 : 25 → 26 / 15 → 16 / 31 → 32 (+ table decisionsFormes : VERSION_BASE 26, SCHEMA_SAUVEGARDE 16, 32 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables)
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
  assert.equal(/v0\.63\.78/.test(lu('app', 'langage', 'attentes-prospectives.js')), false);
  assert.equal(/v0\.63\.78/.test(lu('app', 'langage', 'issue-attente-prospective.js')), false);
  assert.equal(/v0\.63\.78/.test(lu('app', 'langage', 'execution-sollicitee.js')), false);
  assert.equal(/v0\.63\.78/.test(lu('app', 'langage', 'execution-mecanique.js')), false);
});
// === FIN_TEST_ATTENTES_DU_TOUR ===
