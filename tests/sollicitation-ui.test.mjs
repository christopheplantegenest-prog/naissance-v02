// === DEBUT_TEST_SOLLICITATION_UI ===
// v0.63.35 — PREMIÈRE SOLLICITATION EXTÉRIEURE RÉELLE DEPUIS L'INTERFACE (décision ChatGPT, 05/10/2026). OUTIL DE DÉVELOPPEMENT.
// Même discipline que tests/premier-acte-ui.test.mjs : faux DOM minimal pour app/conversation/ecran.js ; plus la chaîne réelle de bout en bout
// (suivreObservationDuTour + observerPossibilites + executerApplicationSollicitee + magasin en mémoire) et des gardes statiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';

class Faux {
  constructor(tag) {
    this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this.attrs = {};
    this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = '';
    this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0;
  }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() {
    const s = this._cls;
    return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) };
  }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c) { this.appendChild(c); }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(sel) {
    const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, ''));
    const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; };
    return parcourir(this);
  }
}
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;

const { monterConversation } = await import('../app/conversation/ecran.js');
const { suivreObservationDuTour } = await import('../app/langage/contexte-sollicitation.js');
const { applicationsSollicitables } = await import('../app/langage/applications-sollicitables.js');
const { executerApplicationSollicitee } = await import('../app/langage/execution-sollicitee.js');
const { observerPossibilites } = await import('../app/langage/observation-possibilites.js');
const { identifierMessage } = await import('../app/langage/pont.js');
const { magasinMemoireVive, enregistrerObservationPossibilites, TABLES, VERSION_BASE } = await import('../app/langage/connaissances.js');
const { TABLE_OPERATIONS } = await import('../app/langage/table-operations.js');
const { DESCRIPTIONS_OPERATIONS } = await import('../app/langage/descriptions-operations.js');
const { SCHEMA_SAUVEGARDE } = await import('../app/memoire/sauvegarde.js');

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const ECRAN = lu('app', 'conversation', 'ecran.js');
const ECRAN_CODE = sansCommentaires(ECRAN);
const MAIN_CODE = sansCommentaires(lu('app', 'main.js'));
const PONT = lu('app', 'langage', 'pont.js');

const tous = (e, r = []) => { for (const c of e.children) { r.push(c); tous(c, r); } return r; };
const boutonsDe = (e) => tous(e).filter((c) => c.tag === 'button');
const clic = (b) => Promise.all((b.listeners.click || []).map((f) => f()));
const attendre = () => new Promise((r) => setTimeout(r, 5));

async function coquille(repondreFn, { surSollicitation = null, chargerRecents = async () => [], surActe = null, surJugement = null } = {}) {
  const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({ liste, formulaire, chargerRecents, etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: repondreFn, surSollicitation, surActe, surJugement });
  await conv.recharger();
  const soumettre = async (texte) => { champ.value = texte; await formulaire.listeners.submit[0]({ preventDefault() {} }); };
  const bullesIA = () => liste.children.filter((c) => c._cls.has('message-ia'));
  const zones = (bulle) => tous(bulle).filter((c) => c.tag === 'details');
  return { liste, soumettre, bullesIA, zones };
}
const contexte = (n, applications, choixAFaire = []) => ({ observation: { id: `obs-${n}`, possibilites: [] }, univers: [{ n }], applications, choixAFaire });
const appUne = (operation, donnee = 'M') => ({ operation, liaisons: [{ entree: 'valeur', donnee }] });

// ---------------------------------------------------------------------------------------------------------------- A. PRÉSENCE
test('A1. SANS contexte (réponse ordinaire) : aucune zone de sollicitation', async () => {
  const c = await coquille(async () => ({ texte: 'ok', local: true }), { surSollicitation: async () => ({}) });
  await c.soumettre('bonjour');
  assert.equal(c.zones(c.bullesIA().at(-1)).length, 0);
});
test('A2. sans dépendance surSollicitation : aucune zone même si la réponse porte un contexte', async () => {
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, [appUne('parcourirStructure')]) }));
  await c.soumettre('bonjour');
  assert.equal(c.zones(c.bullesIA().at(-1)).length, 0);
});
test('A3. ANCIENNE BULLE (restaurée depuis la mémoire, sans contexte vivant) : aucune zone', async () => {
  const c = await coquille(async () => ({ texte: 'ok' }), {
    surSollicitation: async () => ({ statut: 'executee' }),
    chargerRecents: async () => [{ role: 'user', texte: 'bonjour Pixel', date: '2026-10-05T10:00:00Z' }, { role: 'ia', texte: 'Salut', date: '2026-10-05T10:00:01Z' }],
  });
  assert.equal(c.bullesIA().length >= 1, true, 'sanity : une bulle de réponse restaurée existe');
  for (const b of c.bullesIA()) assert.equal(c.zones(b).length, 0);
});
test('A4. AVEC contexte : UNE zone repliée (details) nommée exactement « Sollicitation (outil de développement) », dans la ligne d\'actions de la bulle', async () => {
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, [appUne('parcourirStructure')]) }), { surSollicitation: async () => ({ statut: 'executee' }) });
  await c.soumettre('bonjour Pixel');
  const [zone, ...autres] = c.zones(c.bullesIA().at(-1));
  assert.equal(autres.length, 0);
  assert.equal(zone.children[0].tag, 'summary');
  assert.equal(zone.children[0].textContent, 'Sollicitation (outil de développement)');
  assert.equal(zone.parent._cls.has('actions-message'), true);
  assert.equal(zone.attrs.open, undefined, 'repliée : jamais ouverte par le code');
});

// ---------------------------------------------------------------------------------------------------------------- B. LIGNES
test('B1. « bonjour Pixel » : une ligne « parcourirStructure » (nom technique EXACT) + un bouton « Exécuter », rien d\'autre', async () => {
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, [appUne('parcourirStructure')]) }), { surSollicitation: async () => ({ statut: 'executee' }) });
  await c.soumettre('bonjour Pixel');
  const [zone] = c.zones(c.bullesIA().at(-1));
  const lignes = zone.children.slice(1);
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].children[0].textContent, 'parcourirStructure');
  assert.deepEqual(boutonsDe(zone).map((b) => b.textContent), ['Exécuter']);
  const texteZone = tous(zone).map((e) => e.textContent).join(' ');
  assert.equal(/utile|conseill|recommand|appris|intéressant|probable|bon|meilleur|préf/i.test(texteZone), false, 'aucun libellé évaluatif');
});
test('B2. PRODUIT CARTÉSIEN : « choix à faire », AUCUN bouton Exécuter pour cette opération', async () => {
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, [], ['memesCouvertures']) }), { surSollicitation: async () => ({ statut: 'executee' }) });
  await c.soumettre('x');
  const [zone] = c.zones(c.bullesIA().at(-1));
  assert.deepEqual(boutonsDe(zone), []);
  assert.equal(tous(zone).some((e) => e.textContent === 'memesCouvertures — choix à faire'), true);
});
test('B3. PLUSIEURS SINGLETONS : deux lignes, deux boutons, dans l\'ordre reçu (aucun tri) ; le clic sur la SECONDE exécute exactement la seconde', async () => {
  const appels = [];
  const apps = [appUne('memesCouvertures', 'P'), appUne('partagerCouvertures', 'X')];
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, apps) }), { surSollicitation: async (e) => { appels.push(e); return { statut: 'executee' }; } });
  await c.soumettre('x');
  const [zone] = c.zones(c.bullesIA().at(-1));
  assert.deepEqual(zone.children.slice(1).map((l) => l.children[0].textContent), ['memesCouvertures', 'partagerCouvertures']);
  const boutons = boutonsDe(zone);
  assert.equal(boutons.length, 2);
  await clic(boutons[1]);
  assert.equal(appels.length, 1);
  assert.equal(appels[0].application, apps[1]);
});
test('B4. AUCUNE application et aucun choix : texte factuel, aucun bouton', async () => {
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, []) }), { surSollicitation: async () => ({}) });
  await c.soumettre('x');
  const [zone] = c.zones(c.bullesIA().at(-1));
  assert.deepEqual(boutonsDe(zone), []);
  assert.equal(tous(zone).some((e) => e.textContent === 'aucune application déterminée'), true);
});

// ---------------------------------------------------------------------------------------------------------------- C. APPEL
test('C1. CLIC : surSollicitation reçoit EXACTEMENT { observation, application, univers } du tour (mêmes références), une seule fois, rien d\'autre', async () => {
  const appels = [];
  const ctx = contexte(1, [appUne('parcourirStructure')]);
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: ctx }), { surSollicitation: async (e) => { appels.push(e); return { statut: 'executee', designation: {}, execution: {}, erreur: null }; } });
  await c.soumettre('bonjour Pixel');
  const [zone] = c.zones(c.bullesIA().at(-1));
  await clic(boutonsDe(zone)[0]);
  assert.equal(appels.length, 1);
  assert.deepEqual(Object.keys(appels[0]), ['observation', 'application', 'univers']);
  assert.equal(appels[0].observation, ctx.observation);
  assert.equal(appels[0].application, ctx.applications[0]);
  assert.equal(appels[0].univers, ctx.univers);
});
test('C2. CONTEXTES CROISÉS : tour 1 (C1), tour 2 (C2) ; le clic sur la bulle 1 APRÈS le tour 2 utilise encore exactement C1', async () => {
  const appels = [];
  const ctx1 = contexte(1, [appUne('parcourirStructure', 'M1')]); const ctx2 = contexte(2, [appUne('parcourirStructure', 'M2')]);
  const suite = [ctx1, ctx2];
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: suite.shift() }), { surSollicitation: async (e) => { appels.push(e); return { statut: 'executee' }; } });
  await c.soumettre('un'); await c.soumettre('deux');
  const [b1, b2] = c.bullesIA();
  await clic(boutonsDe(c.zones(b1)[0])[0]);
  assert.equal(appels[0].observation, ctx1.observation); assert.equal(appels[0].univers, ctx1.univers); assert.equal(appels[0].application, ctx1.applications[0]);
  assert.notEqual(appels[0].observation, ctx2.observation); assert.notEqual(appels[0].univers, ctx2.univers);
  await clic(boutonsDe(c.zones(b2)[0])[0]);
  assert.equal(appels[1].observation, ctx2.observation);
});
test('C3. Le clic n\'écrit AUCUN autre signal : ni « Marquer », ni jugement, ni référence ; le champ de saisie n\'est pas touché', async () => {
  let actes = 0; let jugements = 0;
  const c = await coquille(async () => ({ texte: 'ok', idTrace: 't1', sollicitation: contexte(1, [appUne('parcourirStructure')]) }), {
    surSollicitation: async () => ({ statut: 'executee' }), surActe: async () => { actes += 1; }, surJugement: async () => { jugements += 1; },
  });
  await c.soumettre('x');
  const bulle = c.bullesIA().at(-1);
  const zone = c.zones(bulle)[0];
  await clic(boutonsDe(zone)[0]);
  assert.equal(actes, 0); assert.equal(jugements, 0);
  assert.equal(boutonsDe(bulle).some((b) => b.textContent === 'Marquer'), true, 'sanity : « Marquer » existe, séparé');
  assert.equal(boutonsDe(zone).some((b) => b.textContent === 'Marquer'), false);
});

// ---------------------------------------------------------------------------------------------------------------- D. STATUTS
const statutDe = (zone) => tous(zone).find((e) => e._cls.has('sollicitation-statut')).textContent;
test('D1. SUCCÈS : « Exécutée »', async () => {
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, [appUne('parcourirStructure')]) }), { surSollicitation: async () => ({ statut: 'executee', designation: {}, execution: {}, erreur: null }) });
  await c.soumettre('x');
  const [zone] = c.zones(c.bullesIA().at(-1));
  await clic(boutonsDe(zone)[0]);
  assert.equal(statutDe(zone), 'Exécutée');
});
test('D2. ÉCHECS : statut brut + message de l\'erreur d\'origine + « sollicitation conservée » (désignation écrite) ou « aucune trace écrite » (désignation null)', async () => {
  const cas = [
    [{ statut: 'echec_designation', designation: null, execution: null, erreur: new TypeError('étrangère') }, 'echec_designation : étrangère — aucune trace écrite'],
    [{ statut: 'echec_resolution', designation: { id: 'd' }, execution: null, erreur: new Error('porteur') }, 'echec_resolution : porteur — sollicitation conservée'],
    [{ statut: 'echec_invocation', designation: { id: 'd' }, execution: null, erreur: new Error('boum') }, 'echec_invocation : boum — sollicitation conservée'],
    [{ statut: 'echec_execution', designation: { id: 'd' }, execution: null, erreur: new Error('panne') }, 'echec_execution : panne — sollicitation conservée'],
    [{ statut: 'echec_execution', designation: { id: 'd' }, execution: null, erreur: null }, 'echec_execution — sollicitation conservée'],
  ];
  for (const [retour, attendu] of cas) {
    const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, [appUne('parcourirStructure')]) }), { surSollicitation: async () => retour });
    await c.soumettre('x');
    const [zone] = c.zones(c.bullesIA().at(-1));
    await clic(boutonsDe(zone)[0]);
    assert.equal(statutDe(zone), attendu);
  }
});
test('D3. surSollicitation LÈVE (erreur de programmation) : message affiché, aucune exception non gérée, bouton réactivé', async () => {
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, [appUne('parcourirStructure')]) }), { surSollicitation: async () => { throw new TypeError('entrée invalide'); } });
  await c.soumettre('x');
  const [zone] = c.zones(c.bullesIA().at(-1));
  const b = boutonsDe(zone)[0];
  await clic(b);
  assert.equal(statutDe(zone), 'Sollicitation non exécutée : entrée invalide');
  assert.equal(b.disabled, false);
});

// ---------------------------------------------------------------------------------------------------------------- E. DOUBLE APPUI
test('E1. Pendant UN appel : bouton désactivé, un second appui est ignoré ; après résolution : réactivé ; deux appuis volontaires successifs = DEUX appels distincts (aucune déduplication)', async () => {
  let liberer; let appels = 0;
  const c = await coquille(async () => ({ texte: 'ok', sollicitation: contexte(1, [appUne('parcourirStructure')]) }), {
    surSollicitation: () => { appels += 1; return new Promise((r) => { liberer = () => r({ statut: 'executee' }); }); },
  });
  await c.soumettre('x');
  const [zone] = c.zones(c.bullesIA().at(-1));
  const b = boutonsDe(zone)[0];
  const p1 = clic(b);
  assert.equal(b.disabled, true);
  const p2 = clic(b); // double tap accidentel pendant l'appel
  assert.equal(appels, 1);
  liberer(); await Promise.all([p1, p2]);
  assert.equal(b.disabled, false);
  assert.equal(appels, 1);
  const p3 = clic(b); assert.equal(appels, 2); liberer(); await p3; // deuxième sollicitation VOLONTAIRE
  assert.equal(appels, 2);
  assert.equal(b.disabled, false);
});

// ---------------------------------------------------------------------------------------------------------------- F. BOUT EN BOUT RÉEL
// Reproduit le câblage de main.js (garanti identique en substance par les gardes S ci-dessous) avec un magasin en mémoire.
async function monterReel() {
  const magasin = magasinMemoireVive();
  let k = 0;
  const repondre = async (texte) => {
    const suivi = suivreObservationDuTour((message) => observerPossibilites(message, {
      enregistrer: (d) => enregistrerObservationPossibilites(magasin, d),
      lireExecutions: () => magasin.lireTout('executionsOperations'),
    }));
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    await suivi.observer(message);
    return suivi.joindre({ texte: `réponse à ${texte}`, local: true });
  };
  const surSollicitation = ({ observation, application, univers }) => executerApplicationSollicitee({ observation, application, univers }, { magasin, table: TABLE_OPERATIONS });
  const c = await coquille(repondre, { surSollicitation });
  return { magasin, ...c };
}
test('F1. TÉLÉPHONE : « bonjour Pixel » → parcourirStructure [Exécuter] → « Exécutée » ; désignation origine exterieure + exécution liée exactement à elle', async () => {
  const w = await monterReel();
  await w.soumettre('bonjour Pixel');
  const [zone] = w.zones(w.bullesIA().at(-1));
  assert.equal(zone.children[1].children[0].textContent, 'parcourirStructure');
  assert.equal((await w.magasin.lireTout('designations')).length, 0, 'rien n\'est écrit avant le geste');
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 0);
  await clic(boutonsDe(zone)[0]);
  assert.equal(statutDe(zone), 'Exécutée');
  const d = await w.magasin.lireTout('designations'); const x = await w.magasin.lireTout('executionsOperations');
  assert.equal(d.length, 1); assert.equal(x.length, 1);
  assert.equal(d[0].origine, 'exterieure');
  assert.equal(d[0].operation, 'parcourirStructure');
  assert.equal(x[0].idDesignation, d[0].id);
  assert.deepEqual(x[0].resultat, [{ chemin: [], type: 'chaine', valeur: 'bonjour Pixel' }]);
  assert.equal('origine' in x[0], false);
});
test('F2. TOUR SUIVANT : la production de l\'exécution apparaît dans le contexte du nouveau tour ; parcourirStructure a deux candidats → « choix à faire » ; symbolesDeChaine (déterminée) garde SON bouton, aucun bouton pour parcourirStructure', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38
  const w = await monterReel();
  await w.soumettre('bonjour Pixel');
  await clic(boutonsDe(w.zones(w.bullesIA().at(-1))[0])[0]);
  const x = (await w.magasin.lireTout('executionsOperations'))[0];
  await w.soumettre('salut Pixel');
  const zone2 = w.zones(w.bullesIA().at(-1))[0];
  assert.equal(boutonsDe(zone2).length, 1, 'un seul bouton : symbolesDeChaine ; parcourirStructure n\'en a aucun');
  assert.equal(tous(zone2).some((e) => e.textContent === 'parcourirStructure — choix à faire'), true);
  const obs = (await w.magasin.lireTout('observationsPossibilites')).at(-1);
  assert.equal(obs.possibilites.some((a) => a.donnee === x.id), true);
});
test('F3. DEUX APPUIS VOLONTAIRES = deux désignations et deux exécutions distinctes (D1 != D2, X1.idDesignation = D1.id, X2.idDesignation = D2.id)', async () => {
  const w = await monterReel();
  await w.soumettre('bonjour Pixel');
  const b = boutonsDe(w.zones(w.bullesIA().at(-1))[0])[0];
  await clic(b); await clic(b);
  const d = await w.magasin.lireTout('designations'); const x = await w.magasin.lireTout('executionsOperations');
  assert.equal(d.length, 2); assert.equal(x.length, 2);
  assert.notEqual(d[0].id, d[1].id);
  assert.deepEqual(x.map((e) => e.idDesignation).sort(), d.map((e) => e.id).sort());
});
test('F4. CONTEXTES CROISÉS RÉELS : le clic sur la bulle 1 après le tour 2 désigne l\'observation du tour 1 (idObservation), pas celle du tour 2', async () => {
  const w = await monterReel();
  await w.soumettre('bonjour Pixel'); await w.soumettre('salut Pixel');
  const observations = await w.magasin.lireTout('observationsPossibilites');
  assert.equal(observations.length, 2);
  const [b1] = w.bullesIA();
  await clic(boutonsDe(w.zones(b1)[0])[0]);
  const d = await w.magasin.lireTout('designations');
  assert.equal(d[0].idObservation, observations[0].id);
  assert.notEqual(d[0].idObservation, observations[1].id);
});

// ---------------------------------------------------------------------------------------------------------------- S. STATIQUE
test('S1. ecran.js : aucun import du langage, de la table ni de la persistance ; la zone ne rappelle ni observation, ni univers, ni lecture de texte, ni sélection', () => {
  const imports = ECRAN_CODE.match(/^import .*$/gm);
  assert.deepEqual(imports, [
    "import { texteEnHtml } from './texte.js';",
    "import { lireBrouillon, garderBrouillon, effacerBrouillon } from './brouillon.js';",
    "import { CODES_REGLAGES, enErreurFournisseur } from '../fournisseurs/erreurs.js';",
    "import { libelleEtape } from '../fournisseurs/fiabilite.js';",
  ]);
  const debut = ECRAN_CODE.indexOf('function zoneSollicitation(');
  const fin = ECRAN_CODE.indexOf('function boutonEcouter(');
  assert.ok(debut > 0 && fin > debut);
  const corps = ECRAN_CODE.slice(debut, fin);
  assert.equal(/observerPossibilites|universValeurs|lireTout|ecrire|magasin|TABLE_OPERATIONS|groupesDeCandidats|applicationUnique|applicationsSollicitables|executerApplicationSollicitee|enregistrerDesignation|localStorage|indexedDB|querySelector|\.find\(|\.filter\(|\.sort\(|\[0\]|\.at\(|\.texte\b|options\.|referenceActuelle|champ\./.test(corps), false);
  assert.equal(/surActe|surJugement|definirReference/.test(corps), false);
  assert.equal((corps.match(/surSollicitation\(/g) || []).length, 1);
  assert.match(corps, /await surSollicitation\(\{ observation, application, univers \}\)/);
  assert.match(corps, /const \{ observation, univers, applications, choixAFaire \} = contexte;/);
  assert.equal(/\bfor \(const application of applications\)/.test(corps), true);
  assert.equal((ECRAN_CODE.match(/zoneSollicitation\(/g) || []).length, 2, 'définition + un seul appel');
  assert.match(ECRAN_CODE, /if \(options\.sollicitation && surSollicitation\) actions\.appendChild\(zoneSollicitation\(options\.sollicitation\)\);/);
});
test('S2. pont.js INCHANGÉ : la ligne d\'observation d\'origine est intacte et pont.js ignore tout de l\'outil', () => {
  assert.match(PONT, /try \{ await observerPossibilites\(message\); \} catch \{ \/\* observation : jamais bloquante \*\/ \}/);
  assert.equal(/sollicit|Sollicit|executerApplication|applicationsSollicitables|contexte-sollicitation|univers/.test(sansCommentaires(PONT)), false);
  // Empreinte du CORPS de traiterTourAvecEnonce (v0.63.35 : pont.js est INCHANGÉ ; toute modification, même d'une ligne, doit être délibérée et signalée).
  const debut = PONT.indexOf('export async function traiterTourAvecEnonce(');
  const corps = PONT.slice(debut, PONT.indexOf('\n}\n', debut));
  assert.equal(createHash('sha256').update(corps).digest('hex'), '2ebc0bc5fba9a6f6640ad50dba2fa7cefe62b3014c1dcb46e440daa9894bd4ea');
});
test('S3. main.js : imports exacts de l\'outil ; la primitive n\'est appelée que dans surSollicitation avec la table ; aucun calcul d\'application, aucune relecture', () => {
  assert.match(MAIN_CODE, /^import \{ suivreObservationDuTour \} from '\.\/langage\/contexte-sollicitation\.js';$/m);
  assert.match(MAIN_CODE, /^import \{ executerApplicationSollicitee \} from '\.\/langage\/execution-sollicitee\.js';$/m);
  assert.match(MAIN_CODE, /^import \{ TABLE_OPERATIONS \} from '\.\/langage\/table-operations\.js';$/m);
  assert.equal((MAIN_CODE.match(/executerApplicationSollicitee\(/g) || []).length, 1);
  assert.equal((MAIN_CODE.match(/TABLE_OPERATIONS/g) || []).length, 2, 'import + une seule utilisation');
  assert.match(MAIN_CODE, /surSollicitation: async \(\{ observation, application, univers \}\) => \{\n\s+const e = await ecranLangage\.assurerEsprit\(\);\n\s+return executerApplicationSollicitee\(\{ observation, application, univers \}, \{ magasin: e\.magasin, table: TABLE_OPERATIONS \}\);\n\s+\},/);
  assert.equal(/applicationsSollicitables|groupesDeCandidats|applicationUnique|universValeurs|enregistrerDesignation|enregistrerExecutionOperation|resoudreValeursApplication|invoquerOperation/.test(MAIN_CODE), false);
  assert.equal((MAIN_CODE.match(/suivreObservationDuTour\(/g) || []).length, 1);
  assert.equal((MAIN_CODE.match(/observerPossibilites: suivi\.observer,/g) || []).length, 1);
  assert.equal((MAIN_CODE.match(/return suivi\.joindre\(resultat\);/g) || []).length, 1);
  // le contexte est local à CHAQUE appel de repondre : le suivi est créé DANS repondre, jamais au niveau du module
  const debutRepondre = MAIN_CODE.indexOf('repondre: async (texte, options) => {');
  assert.ok(MAIN_CODE.indexOf('const suivi = suivreObservationDuTour(') > debutRepondre);
  assert.equal(/\bsuivi\b/.test(MAIN_CODE.slice(0, debutRepondre)), false);
  assert.equal((MAIN_CODE.match(/surSollicitation/g) || []).length, 1);
});
test('S4. GRAPHE D\'IMPORTS depuis main.js : l\'outil atteint exactement ses modules ; application-unique, observateur V, univers des valeurs restent INATTEIGNABLES ; constats-structurels et (v0.63.42) suites-fermees seulement via la table', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')]; const importeurs = new Map();
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of sansCommentaires(src).matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const c = resolve(dirname(f), m[1] || m[2]); pile.push(c);
      if (!importeurs.has(rel(c))) importeurs.set(rel(c), new Set());
      importeurs.get(rel(c)).add(rel(f));
    }
  }
  const atteints = new Set([...vus].map(rel));
  for (const n of ['contexte-sollicitation', 'applications-sollicitables', 'groupes-candidats', 'execution-sollicitee', 'table-operations', 'valeurs-application', 'invocation-operations']) assert.equal(atteints.has(`app/langage/${n}.js`), true, n);
  for (const n of ['application-unique', 'constats-valeurs', 'univers-valeurs']) assert.equal(atteints.has(`app/langage/${n}.js`), false, n); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : suites-fermees.js sort de la liste des inatteignables : il est décrit et invocable, donc atteint SEULEMENT via la table (assertion suivante), comme constats-structurels
  assert.equal(atteints.has('app/langage/suites-fermees.js'), true);
  assert.deepEqual([...importeurs.get('app/main.js') || []], []);
  assert.deepEqual([...importeurs.get('app/langage/contexte-sollicitation.js')], ['app/main.js']);
  assert.deepEqual([...importeurs.get('app/langage/execution-sollicitee.js')], ['app/main.js']);
  assert.deepEqual([...importeurs.get('app/langage/table-operations.js')], ['app/main.js']);
  assert.deepEqual([...importeurs.get('app/langage/applications-sollicitables.js')], ['app/langage/contexte-sollicitation.js']);
  assert.deepEqual([...importeurs.get('app/langage/groupes-candidats.js')], ['app/langage/applications-sollicitables.js']);
  assert.deepEqual([...importeurs.get('app/langage/constats-structurels.js')], ['app/langage/table-operations.js']);
  assert.deepEqual([...importeurs.get('app/langage/suites-fermees.js')], ['app/langage/table-operations.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : suites-fermees.js : seulement via la table
  assert.equal(atteints.has('app/conversation/ecran.js'), true);
  assert.equal([...vus].some((f) => /\.test\.|tests\//.test(rel(f))), false);
});
test('S5. AUCUN mécanisme actif ne LIT les désignations pour décider : la table n\'est nommée que par la persistance et l\'écriture ; aucune lecture hors connaissances.js', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = rel(f); const code = sansCommentaires(lu(...r.split('/')));
    if (/lireTout\(\s*['"`]designations['"`]\s*\)|lireDesignation|designations\.(find|filter|sort|at|map)\b/.test(code)) assert.fail(`${r} lit les désignations`);
    if (/['"`]designations['"`]/.test(code)) assert.ok(['app/langage/connaissances.js'].includes(r), `${r} nomme la table des désignations`);
  }
});
test('S6. INVARIANTS : catalogue 10, table 10, BASE 19 / schéma 9 / 22 tables, aucune table ni persistance d\'état d\'interface ; P/V/S et texte non touchés', () => {
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 12); assert.equal(Object.keys(TABLE_OPERATIONS).length, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
  assert.equal(VERSION_BASE, 19); assert.equal(SCHEMA_SAUVEGARDE, 9); assert.equal(TABLES.length, 22);
  assert.equal(TABLES.some((t) => /sollicit|contexte|univers|ui/i.test(t)), false);
  for (const f of ['app/langage/applications-sollicitables.js', 'app/langage/contexte-sollicitation.js']) {
    assert.equal(/localStorage|sessionStorage|indexedDB|ecrire\(|magasin|JSON\.stringify|codePointAt|points de code|Array\.from\(\s*texte/.test(sansCommentaires(lu(...f.split('/')))), false, f);
  }
  const zone = ECRAN_CODE.slice(ECRAN_CODE.indexOf('function zoneSollicitation('), ECRAN_CODE.indexOf('function boutonEcouter('));
  assert.equal(/localStorage|sessionStorage|indexedDB|\.open\b|setAttribute\('open'/.test(zone), false, 'état ouvert/fermé jamais conservé');
  for (const f of ['constats-structurels', 'constats-valeurs', 'suites-fermees', 'univers-valeurs']) {
    assert.equal(/sollicit|Sollicit/.test(lu('app', 'langage', `${f}.js`)), false, f);
  }
  for (const d of DESCRIPTIONS_OPERATIONS) assert.equal(/sollicit/i.test(d.nom), false);
});
// === FIN_TEST_SOLLICITATION_UI ===
