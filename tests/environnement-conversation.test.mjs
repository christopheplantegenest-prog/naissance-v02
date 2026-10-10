// === DEBUT_TEST_ENVIRONNEMENT_CONVERSATION ===
// v0.63.81 — J-B (décision ChatGPT, 09/10/2026) : la boucle visible et réelle — production → acte d'émission persisté → ligne adressée à
// Christophe → « Répondre » sur CETTE émission → son message = donnée normale ET réception DÉCLARÉE rattachée à l'idEmission exact.
// Quatre familles : A. emettreLot / declarerReceptionConversation (module) ; B. flux réel (harnais = câblage de main.js) ; C. écran (faux DOM) ;
// D. gardes statiques (main.js, pont.js intact, aucune interprétation, aucune règle).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

class Faux {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.attrs = {}; }
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
  querySelector(sel) { const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, '')); const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; }; return parcourir(this); }
}
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;

const { emettreLot, declarerReceptionConversation, NOM_ENVIRONNEMENT_CONVERSATION } = await import('../app/langage/environnement-conversation.js');
const { consequencesDesEmissions } = await import('../app/langage/consequences-emissions.js');
const { monterConversation } = await import('../app/conversation/ecran.js');
const { suivreObservationDuTour } = await import('../app/langage/contexte-sollicitation.js');
const { executerApplicationsDeterminees } = await import('../app/langage/execution-mecanique.js');
const { observerPossibilites } = await import('../app/langage/observation-possibilites.js');
const { traiterTourAvecEnonce } = await import('../app/langage/pont.js');
const { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerEnonceSurTrace, TABLES, VERSION_BASE } = await import('../app/langage/connaissances.js');
const { TABLE_OPERATIONS } = await import('../app/langage/table-operations.js');
const { DESCRIPTIONS_OPERATIONS } = await import('../app/langage/descriptions-operations.js');
const { SCHEMA_SAUVEGARDE } = await import('../app/memoire/sauvegarde.js');

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const MODULE = lu('app', 'langage', 'environnement-conversation.js');
const MAIN = lu('app', 'main.js'); const MAIN_CODE = sansCommentaires(MAIN);
const ECRAN = lu('app', 'conversation', 'ecran.js'); const ECRAN_CODE = sansCommentaires(ECRAN);
const PONT = lu('app', 'langage', 'pont.js');
const tous = (e, r = []) => { for (const c of e.children) { r.push(c); tous(c, r); } return r; };
const clic = (b) => Promise.all((b.listeners.click || []).map((f) => f()));

// ------------------------------------------------------------------------------------------------------- harnais = câblage réel de main.js
let compteurIds = 0;
function monde() {
  const magasin = magasinMemoireVive();
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const ex2 = () => magasin.lireTout('executionsOperations');
  const tours = [];
  async function tour(texte, { referenceTrace = null, referenceEmission = null, traiter = async () => ({ texte: 'ok' }) } = {}) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), async ({ observation, univers }) => {
      const lot = await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises, echec } = await emettreLot(lot, { magasin, idObservation: observation.id });
      return { ...lot, emises, echecEmission: echec };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, referenceTrace, { enregistrerEnonce: (idTrace, t) => enregistrerEnonceSurTrace(magasin, { idTrace, texte: t }), traiter, nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const joint = suivi.joindre(res);
    let sortie = joint;
    if (joint !== null && typeof joint === 'object' && referenceEmission && typeof referenceEmission.idEmission === 'string' && referenceEmission.idEmission.length > 0) {
      const idDonnee = joint.sollicitation && joint.sollicitation.observation ? joint.sollicitation.observation.idMessage : null;
      const declaree = await declarerReceptionConversation({ idDonnee, idEmission: referenceEmission.idEmission }, { magasin });
      sortie = { ...joint, reception: { idEmission: referenceEmission.idEmission, idDonnee, reception: declaree.reception, echec: declaree.echec } };
    }
    tours.push(sortie);
    return sortie;
  }
  const photo = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), emissions: await magasin.lireTout('emissions'), receptions: await magasin.lireTout('receptions'), enonces: await magasin.lireTout('enonces'), attentes: await magasin.lireTout('attentesProspectives') });
  return { magasin, tour, tours, photo };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];

// ============================================================================================================== A. MODULE
test('A1. exports exacts ; emettreLot : CHAQUE production exécutée du lot est émise (aucune sélection), dans l\'ordre du lot ; l\'acte est persisté AVANT la remise ; lignes { idEmission, idExecution, operation, valeur, remise }', async () => {
  const m = await import('../app/langage/environnement-conversation.js');
  assert.deepEqual(Object.keys(m).sort(), ['NOM_ENVIRONNEMENT_CONVERSATION', 'declarerReceptionConversation', 'emettreLot']);
  assert.equal(NOM_ENVIRONNEMENT_CONVERSATION, 'conversation');
  const w = monde();
  const s = (await w.tour('bonjour Pixel')).sollicitation;
  const p = await w.photo();
  assert.equal(s.automatiques.length, 2); assert.equal(s.emises.length, 2); assert.equal(s.echecEmission, null);
  assert.deepEqual(s.emises.map((e) => e.operation), s.automatiques.map((r) => r.operation));
  assert.deepEqual(s.emises.map((e) => e.idExecution), s.automatiques.map((r) => r.execution.id));
  assert.equal(p.emissions.length, 2);
  for (const e of s.emises) {
    assert.deepEqual(Object.keys(e), ['idEmission', 'idExecution', 'operation', 'valeur', 'remise']);
    const ligne = p.emissions.find((x) => x.id === e.idEmission);
    assert.ok(ligne, 'émission persistée'); assert.equal(ligne.idExecution, e.idExecution); assert.equal(ligne.environnement, 'conversation'); assert.equal(ligne.idObservation, s.observation.id);
    assert.deepEqual(e.valeur, p.executions.find((x) => x.id === e.idExecution).resultat);
    assert.equal(e.remise, 'remise');
  }
  // lot vide ou résultats non exécutés : rien n'est émis
  assert.deepEqual(await emettreLot({ resultats: [] }, { magasin: w.magasin, idObservation: 'o' }), { emises: [], echec: null });
  assert.deepEqual(await emettreLot({ resultats: [{ operation: 'x', statut: 'echec', execution: null }] }, { magasin: w.magasin, idObservation: 'o' }), { emises: [], echec: null });
  assert.equal((await w.photo()).emissions.length, 2);
});

test('A2. emettreLot : ordre réel = persister puis remettre (l\'adaptateur voit une émission déjà écrite) ; échec d\'émission RENDU, les émissions faites restent', async () => {
  const w = monde();
  await w.tour('bonjour Pixel');
  const p = await w.photo();
  const lot = { resultats: [{ operation: 'a', statut: 'executee', execution: { id: p.executions[0].id } }, { operation: 'b', statut: 'executee', execution: { id: 'execution-inexistante' } }, { operation: 'c', statut: 'executee', execution: { id: p.executions[1].id } }] };
  const r = await emettreLot(lot, { magasin: w.magasin, idObservation: 'obs-x' });
  assert.equal(r.emises.length, 1); assert.equal(r.emises[0].operation, 'a');
  assert.match(r.echec.message, /aucune exécution « execution-inexistante »/);
  assert.equal((await w.photo()).emissions.length, 3, '2 du tour + 1 avant l\'échec ; rien après');
});

test('A3. declarerReceptionConversation : fait brut { environnement:\'conversation\', idDonnee, idEmission } ; refus RENDU (jamais levé) pour émission inconnue, donnée non conservée, référence vide ; plusieurs réceptions sur une même émission', async () => {
  const w = monde();
  const s = (await w.tour('bonjour Pixel')).sollicitation;
  const idE = s.emises[0].idEmission; const idM = s.observation.idMessage;
  const ok = await declarerReceptionConversation({ idDonnee: idM, idEmission: idE }, { magasin: w.magasin });
  assert.equal(ok.echec, null); assert.deepEqual(Object.keys(ok.reception), ['id', 'horodatage', 'environnement', 'idDonnee', 'idEmission']);
  assert.equal(ok.reception.environnement, 'conversation'); assert.equal(ok.reception.idDonnee, idM); assert.equal(ok.reception.idEmission, idE);
  const ok2 = await declarerReceptionConversation({ idDonnee: idM, idEmission: idE }, { magasin: w.magasin });
  assert.notEqual(ok2.reception.id, ok.reception.id);
  const r1 = await declarerReceptionConversation({ idDonnee: idM, idEmission: 'emission-inconnue' }, { magasin: w.magasin });
  assert.equal(r1.reception, null); assert.match(r1.echec.message, /aucune émission « emission-inconnue »/);
  const r2 = await declarerReceptionConversation({ idDonnee: 'message-inconnu', idEmission: idE }, { magasin: w.magasin });
  assert.equal(r2.reception, null); assert.match(r2.echec.message, /aucune valeur conservée/);
  const r3 = await declarerReceptionConversation({ idDonnee: null, idEmission: idE }, { magasin: w.magasin });
  assert.equal(r3.reception, null); assert.match(r3.echec.message, /identité conservée/);
  const r4 = await declarerReceptionConversation({ idDonnee: idM, idEmission: '' }, { magasin: w.magasin });
  assert.equal(r4.reception, null); assert.match(r4.echec.message, /référence d'émission vide/);
  assert.equal((await w.photo()).receptions.length, 2);
  assert.equal(/prefer|préfér|score|confiance|recompense|récompense|reussite|réussite|correct|jugement|positi|négati|negati|utile|ignor|choix|choisir/i.test(sansCommentaires(MODULE)), false);
});

// ============================================================================================================== B. FLUX RÉEL
test('B1. RÉPONSE IMMÉDIATE : T1 émet ; T2 porte { idEmission } de T1 → une réception dont idDonnee = identité du message de T2 et idEmission = celui de T1, exact ; la vue la rattache ; le message de T2 est aussi une donnée normale (observée, exécutée)', async () => {
  const w = monde();
  const t1 = await w.tour('bonjour Pixel');
  const idE = t1.sollicitation.emises[1].idEmission;
  const t2 = await w.tour('bonjour Luna', { referenceEmission: { idEmission: idE } });
  assert.equal(t2.texte, 'ok');
  assert.equal(t2.reception.echec, null); assert.equal(t2.reception.idEmission, idE); assert.equal(t2.reception.idDonnee, t2.sollicitation.observation.idMessage);
  const p = await w.photo();
  assert.equal(p.receptions.length, 1); assert.equal(p.receptions[0].idEmission, idE); assert.equal(p.receptions[0].idDonnee, t2.sollicitation.observation.idMessage);
  assert.ok(p.valeurs.some((v) => v.id === t2.sollicitation.observation.idMessage && v.valeur === 'bonjour Luna'));
  const vue = consequencesDesEmissions(p.emissions, p.receptions);
  assert.deepEqual(vue.emissions.find((e) => e.id === idE).consequences, [[p.receptions[0].id]]);
  assert.deepEqual(vue.emissions.filter((e) => e.id !== idE).map((e) => e.consequences), [[], [], [], [], []]);
  assert.deepEqual(vue.independantes, []);
  assert.equal(t2.sollicitation.automatiques.length, 4, 'le tour de réponse a été observé et exécuté normalement');
});

test('B2. RÉPONSE À UNE ÉMISSION ANCIENNE : la référence de T1 utilisée à T4 reste rattachée à l\'émission de T1 ; MESSAGE ORDINAIRE : aucune réception ; PLUSIEURS réceptions sur une même émission', async () => {
  const w = monde();
  const t1 = await w.tour('bonjour Pixel'); const idE = t1.sollicitation.emises[0].idEmission;
  const t2 = await w.tour('bonjour Luna'); const t3 = await w.tour('bonjour Pixel');
  assert.equal(t2.reception, undefined); assert.equal(t3.reception, undefined);
  assert.equal((await w.photo()).receptions.length, 0, 'sans référence : aucune réception');
  const t4 = await w.tour('bonjour Max', { referenceEmission: { idEmission: idE } });
  assert.equal(t4.reception.echec, null); assert.equal(t4.reception.reception.idEmission, idE);
  const t5 = await w.tour('encore', { referenceEmission: { idEmission: idE } });
  assert.equal(t5.reception.echec, null);
  const p = await w.photo();
  assert.deepEqual(p.receptions.map((r) => r.idEmission), [idE, idE]);
  assert.deepEqual(p.receptions.map((r) => r.idDonnee), [t4.sollicitation.observation.idMessage, t5.sollicitation.observation.idMessage]);
  const vue = consequencesDesEmissions(p.emissions, p.receptions);
  assert.equal(vue.emissions.find((e) => e.id === idE).consequences.length, 2);
});

test('B3. RÉFÉRENCE INVALIDE : émission inexistante → refus rendu, aucune réception, tour intact (texte, observation, exécutions, émissions du tour)', async () => {
  const w = monde();
  await w.tour('bonjour Pixel');
  const t2 = await w.tour('bonjour Luna', { referenceEmission: { idEmission: 'emission-0-0-0' } });
  assert.equal(t2.texte, 'ok'); assert.equal(t2.reception.reception, null); assert.match(t2.reception.echec.message, /aucune émission/);
  assert.equal(t2.sollicitation.automatiques.length, 4); assert.equal(t2.sollicitation.emises.length, 4);
  const p = await w.photo();
  assert.equal(p.receptions.length, 0); assert.equal(p.emissions.length, 6);
});

test('B4. COEXISTENCE trace- / emission- : une référence de TRACE écrit un énoncé (v0.62, pont.js intact) et aucune réception ; une référence d\'ÉMISSION écrit une réception et aucun énoncé', async () => {
  const w = monde();
  const t1 = await w.tour('bonjour Pixel'); const idE = t1.sollicitation.emises[0].idEmission;
  await w.tour('Action: test', { referenceTrace: { idTrace: 'trace-123' } });
  let p = await w.photo();
  assert.equal(p.enonces.length, 1); assert.equal(p.enonces[0].idTrace, 'trace-123'); assert.equal(p.receptions.length, 0);
  await w.tour('bonjour Luna', { referenceEmission: { idEmission: idE } });
  p = await w.photo();
  assert.equal(p.enonces.length, 1); assert.equal(p.receptions.length, 1); assert.equal(p.receptions[0].idEmission, idE);
  const debut = PONT.indexOf('export async function traiterTourAvecEnonce(');
  assert.equal(createHash('sha256').update(PONT.slice(debut, PONT.indexOf('\n}\n', debut))).digest('hex'), '2ebc0bc5fba9a6f6640ad50dba2fa7cefe62b3014c1dcb46e440daa9894bd4ea', 'pont.js INCHANGÉ');
});

test('B5. AUCUN EFFET SUR LE CHOIX NI L\'EXÉCUTION : scénario 7 tours avec réceptions à chaque tour vs sans → mêmes choix, mêmes exécutions automatiques, mêmes nombres d\'exécutions et d\'attentes ; émissions = exécutions', async () => {
  const sans = monde(); const avec = monde();
  for (const t of SCENARIO) await sans.tour(t);
  let precedente = null;
  for (const t of SCENARIO) { const r = await avec.tour(t, precedente ? { referenceEmission: { idEmission: precedente } } : {}); precedente = r.sollicitation.emises[0].idEmission; }
  assert.deepEqual(sans.tours.map((t) => t.sollicitation.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(avec.tours.map((t) => t.sollicitation.choixAFaire.length), sans.tours.map((t) => t.sollicitation.choixAFaire.length));
  assert.deepEqual(avec.tours.map((t) => t.sollicitation.automatiques.map((r) => [r.operation, r.statut])), sans.tours.map((t) => t.sollicitation.automatiques.map((r) => [r.operation, r.statut])));
  assert.deepEqual(avec.tours.map((t) => t.sollicitation.emises.length), [2, 4, 9, 1, 1, 1, 1]);
  const ps = await sans.photo(); const pa = await avec.photo();
  assert.equal(ps.executions.length, 19); assert.equal(pa.executions.length, 19);
  assert.equal(ps.emissions.length, 19); assert.equal(pa.emissions.length, 19);
  const horsEnv = (l) => l.filter((a) => !a.structure.some((s) => s.operation.startsWith('environnement:')));
  assert.equal(horsEnv(ps.attentes).length, 28); assert.equal(horsEnv(pa.attentes).length, 28); // MISE À JOUR DÉLIBÉRÉE v0.63.83 : les attentes des OPÉRATIONS restent 28 dans les deux mondes ; les émissions sont des actes prospectifs : sans réception elles n'écrivent AUCUNE attente, avec réceptions déclarées elles en écrivent (sur des structures passant par environnement:conversation), sans effet sur le choix ni l'exécution
  assert.equal(ps.attentes.length, 28); assert.ok(pa.attentes.length > 28);
  assert.equal(ps.receptions.length, 0); assert.equal(pa.receptions.length, 6);
  for (const r of pa.receptions) assert.ok(pa.emissions.some((e) => e.id === r.idEmission));
});

// ============================================================================================================== C. ÉCRAN
async function coquille(repondreFn) {
  const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: repondreFn, surSollicitation: async () => ({ statut: 'executee' }), surActe: null, surJugement: null });
  await conv.recharger();
  const soumettre = async (texte) => { champ.value = texte; await formulaire.listeners.submit[0]({ preventDefault() {} }); };
  const bullesIA = () => liste.children.filter((c) => c._cls.has('message-ia'));
  const bandeau = () => formulaire.children.find((c) => c._cls.has('bandeau-reference'));
  return { soumettre, bullesIA, bandeau, champ };
}
const emise = (n, op = 'symbolesDeChaine') => ({ idEmission: `emission-${n}`, idExecution: `execution-operation-${n}`, operation: op, valeur: ['b', 'o'], remise: 'remise' });
const resultatAvec = (emises, extra = {}) => ({ texte: 'ok', sollicitation: { observation: { id: 'obs', idMessage: 'message-1', possibilites: [] }, univers: [{}], applications: [], choixAFaire: [], automatiques: [], echecDeclenchement: null, attentes: [], echecAttentes: null, emises, echecEmission: null }, ...extra });

test('C1. ÉCRAN : chaque émission du tour = une ligne « Naissance → toi : <valeur> » avec UN bouton « Répondre » ; zone « Émissions (outil de développement) » listant idEmission, exécution, opération ; sans émission : rien', async () => {
  const { soumettre, bullesIA } = await coquille(async () => resultatAvec([emise(1), emise(2, 'parcourirStructure')]));
  await soumettre('bonjour Pixel');
  const b = bullesIA()[0];
  const lignes = b.children.filter((c) => c._cls.has('emission-naissance'));
  assert.equal(lignes.length, 2);
  assert.equal(lignes[0].children[0].textContent, 'Naissance → toi : ["b","o"]');
  assert.deepEqual(lignes.map((l) => l.children[1].textContent), ['Répondre', 'Répondre']);
  const zone = tous(b).find((c) => c.tag === 'details' && c._cls.has('emissions-dev'));
  assert.equal(zone.children[0].textContent, 'Émissions (outil de développement)');
  assert.deepEqual(zone.children.slice(1).map((l) => l.textContent), [
    'émission emission-1 — production execution-operation-1 (symbolesDeChaine) — remise : remise',
    'émission emission-2 — production execution-operation-2 (parcourirStructure) — remise : remise',
  ]);
  const { soumettre: s2, bullesIA: b2 } = await coquille(async () => resultatAvec([]));
  await s2('bonjour');
  assert.equal(tous(b2()[0]).filter((c) => c._cls.has('emission-naissance') || c._cls.has('emissions-dev')).length, 0);
});

test('C2. ÉCRAN : « Répondre » sur une émission → bandeau « En réponse à Naissance » ; l\'envoi transporte options.referenceEmission = { idEmission } EXACT et referenceTrace null ; puis la référence est close ; le message suivant n\'en porte aucune', async () => {
  const recus = [];
  let n = 0;
  const { soumettre, bullesIA, bandeau } = await coquille(async (texte, options) => { recus.push({ texte, referenceEmission: options.referenceEmission, referenceTrace: options.referenceTrace }); n += 1; return resultatAvec(n === 1 ? [emise(7)] : []); });
  await soumettre('bonjour Pixel');
  const bouton = bullesIA()[0].children.find((c) => c._cls.has('emission-naissance')).children[1];
  await clic(bouton);
  assert.equal(bandeau().hidden, false); assert.equal(bandeau().children[0].textContent, 'En réponse à Naissance');
  await soumettre('oui');
  assert.deepEqual(recus[1], { texte: 'oui', referenceEmission: { idEmission: 'emission-7' }, referenceTrace: null });
  assert.equal(bandeau().hidden, true);
  await soumettre('encore');
  assert.deepEqual(recus[2], { texte: 'encore', referenceEmission: null, referenceTrace: null });
});

test('C3. ÉCRAN : ANCIENNE BULLE — le « Répondre » de la bulle 1 cliqué après le tour 2 transporte l\'émission de la bulle 1 ; TRACE ET ÉMISSION exclusives : le dernier geste gagne, l\'autre référence est nulle ; « Annuler la référence » annule les deux', async () => {
  const recus = []; let n = 0;
  const { soumettre, bullesIA, bandeau } = await coquille(async (texte, options) => { recus.push({ referenceEmission: options.referenceEmission, referenceTrace: options.referenceTrace }); n += 1; return resultatAvec([emise(n)], { idTrace: `trace-${n}` }); });
  await soumettre('un'); await soumettre('deux');
  const [b1, b2] = bullesIA();
  await clic(b1.children.find((c) => c._cls.has('emission-naissance')).children[1]);
  await soumettre('réponse à 1');
  assert.deepEqual(recus[2], { referenceEmission: { idEmission: 'emission-1' }, referenceTrace: null });
  // trace puis émission : l'émission gagne
  const repondreTrace = tous(b2).find((c) => c._cls.has('reference-reponse')).children[0];
  await clic(repondreTrace); assert.equal(bandeau().children[0].textContent, 'En réponse à cette tentative');
  await clic(b2.children.find((c) => c._cls.has('emission-naissance')).children[1]); assert.equal(bandeau().children[0].textContent, 'En réponse à Naissance');
  await soumettre('x');
  assert.deepEqual(recus[3], { referenceEmission: { idEmission: 'emission-2' }, referenceTrace: null });
  // émission puis trace : la trace gagne (v0.62 intact)
  await clic(b2.children.find((c) => c._cls.has('emission-naissance')).children[1]); await clic(repondreTrace);
  await soumettre('y');
  assert.deepEqual(recus[4], { referenceEmission: null, referenceTrace: { idTrace: 'trace-2' } });
  // annuler
  await clic(b1.children.find((c) => c._cls.has('emission-naissance')).children[1]);
  await clic(bandeau().children[1]); assert.equal(bandeau().hidden, true);
  await soumettre('z');
  assert.deepEqual(recus[5], { referenceEmission: null, referenceTrace: null });
});

test('C4. ÉCRAN : la réception déclarée du message envoyé est montrée dans la zone de développement de la réponse (rattachée, ou refus tel quel) ; un échec d\'émission aussi', async () => {
  const { soumettre, bullesIA } = await coquille(async () => resultatAvec([], { reception: { idEmission: 'emission-1', idDonnee: 'message-9', reception: { id: 'reception-5' }, echec: null } }));
  await soumettre('oui');
  let zone = tous(bullesIA()[0]).find((c) => c._cls.has('emissions-dev'));
  assert.equal(zone.children[1].textContent, 'réception reception-5 — ton message message-9 rattaché à l\'émission emission-1');
  assert.ok(zone.children[1]._cls.has('reception-ligne'));
  const { soumettre: s2, bullesIA: b2 } = await coquille(async () => resultatAvec([], { reception: { idEmission: 'emission-x', idDonnee: 'message-9', reception: null, echec: new Error('aucune émission « emission-x »') } }));
  await s2('oui');
  zone = tous(b2()[0]).find((c) => c._cls.has('emissions-dev'));
  assert.equal(zone.children[1].textContent, 'réception refusée pour l\'émission emission-x : aucune émission « emission-x »');
  const { soumettre: s3, bullesIA: b3 } = await coquille(async () => { const r = resultatAvec([]); r.sollicitation.echecEmission = new Error('boum'); return r; });
  await s3('oui');
  zone = tous(b3()[0]).find((c) => c._cls.has('emissions-dev'));
  assert.equal(zone.children[1].textContent, 'émission en échec : boum');
});

// ============================================================================================================== D. GARDES
test('D1. main.js : câblage exact — import du module ; emettreLot UNE fois dans le déclencheur après le lot ; declarerReceptionConversation UNE fois, seulement si options.referenceEmission.idEmission est une chaîne non vide, avec observation.idMessage ; aucune lecture des tables, aucune interprétation', () => {
  assert.match(MAIN_CODE, /^import \{ emettreLot, declarerReceptionConversation \} from '\.\/langage\/environnement-conversation\.js';$/m);
  assert.equal((MAIN_CODE.match(/emettreLot\(/g) || []).length, 1);
  assert.equal((MAIN_CODE.match(/declarerReceptionConversation\(/g) || []).length, 1);
  assert.match(MAIN_CODE, /const referenceEmission = \(options && options\.referenceEmission\) \|\| null;/);
  assert.match(MAIN_CODE, /typeof referenceEmission\.idEmission === 'string' && referenceEmission\.idEmission\.length > 0/);
  assert.match(MAIN_CODE, /joint\.sollicitation\.observation\.idMessage/);
  assert.match(MAIN_CODE, /declarerReceptionConversation\(\{ idDonnee, idEmission: referenceEmission\.idEmission \}, \{ magasin: e\.magasin \}\)/);
  assert.equal(/lireTout\(\s*['"](emissions|receptions)['"]|consequencesDesEmissions|enregistrerEmission|enregistrerReception/.test(MAIN_CODE), false);
  assert.equal(/prefer|préfér|score|recompense|récompense|reussite|réussite|positi|négati|negati|utile|ignor/i.test(MAIN_CODE.slice(MAIN_CODE.indexOf('const referenceEmission'), MAIN_CODE.indexOf('return joint;'))), false);
});

test('D2. ecran.js : la référence d\'émission vit en mémoire seulement (jamais dans le brouillon : brouillon.js inchangé, aucune clé referenceEmission écrite) ; definirReferenceEmission n\'est appelée que par le bouton d\'une ligne émise ; aucun import nouveau', () => {
  assert.equal(/referenceEmission/.test(lu('app', 'conversation', 'brouillon.js')), false);
  assert.equal(/garderBrouillon\([^)]*referenceEmission/.test(ECRAN_CODE), false);
  assert.equal((ECRAN_CODE.match(/definirReferenceEmission\(/g) || []).length, 2, 'définition + un appel (le bouton de la ligne émise)');
  assert.match(ECRAN_CODE, /bouton_\('Répondre', \(\) => definirReferenceEmission\(em\.idEmission\)\)/);
  assert.match(ECRAN_CODE, /referenceEmission: reprise \? null : referenceEmission,/);
  assert.deepEqual(ECRAN_CODE.match(/^import .*$/gm), [
    "import { texteEnHtml } from './texte.js';",
    "import { lireBrouillon, garderBrouillon, effacerBrouillon } from './brouillon.js';",
    "import { CODES_REGLAGES, enErreurFournisseur } from '../fournisseurs/erreurs.js';",
    "import { libelleEtape } from '../fournisseurs/fiabilite.js';",
  ]);
  assert.equal(/lireTout|magasin|emissions\b.*\.filter|enregistrer/.test(ECRAN_CODE.slice(ECRAN_CODE.indexOf('function zoneEmissions('), ECRAN_CODE.indexOf('function zoneSollicitation('))), false);
});

test('D3. INVARIANTS : seul environnement-conversation.js appelle emettreProduction / enregistrerReception ; aucune origine \'experience\' ; catalogue 17 ; base 22 / schéma 12 / 26 tables ; le jalon 1 et J-A sont intacts', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f); const code = sansCommentaires(readFileSync(f, 'utf8'));
    if (r === 'app/langage/environnement-conversation.js' || r === 'app/langage/connaissances.js' || r === 'app/langage/emission.js') continue;
    assert.equal(/emettreProduction\(|enregistrerReception\(|emettreLot\(|declarerReceptionConversation\(/.test(code) && r !== 'app/main.js', false, r);
    assert.equal(/origine:\s*['"]experience['"]|ORIGINE_EXPERIENCE|executerApplicationAvecOrigine\([^)]*['"]experience['"]/.test(code), false, r); // aucune origine de désignation 'experience' (J-C non commencé)
  }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
  assert.equal(VERSION_BASE, 23); assert.equal(SCHEMA_SAUVEGARDE, 13); assert.equal(TABLES.length, 28); // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables)
  for (const f of ['attentes-du-tour', 'attentes-prospectives', 'issue-attente-prospective', 'emission', 'consequences-emissions', 'execution-mecanique', 'execution-sollicitee']) assert.equal(/v0\.63\.81/.test(lu('app', 'langage', `${f}.js`)), false, f);
});
// === FIN_TEST_ENVIRONNEMENT_CONVERSATION ===
