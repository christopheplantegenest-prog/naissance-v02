// === DEBUT_TEST_IDENTITE_MESSAGE ===
// v0.63.14 — ÉTAPE 6, décision ChatGPT « IDENTITÉ DU MESSAGE ENTRANT AVANT TRAITEMENT » (04/10/2026). Preuves que :
//  - un ENVOI = une identité { id, texte } (jamais un brouillon, une frappe, une dictée, un envoi refusé ni vide) ;
//  - elle naît AVANT la capture d'énoncé et avant toute analyse / reconnaissance / aiguillage ;
//  - elle ne change aucune réponse, aucune branche, aucune persistance, et n'est lue par aucune décision ;
//  - elle ne réutilise ni l'id d'énoncé, ni celui d'observation, de trace, d'expérience ou de journal ;
//  - rien n'est persisté, aucune forme n'est déclarée, aucune primitive de v0.63.12/13 n'est appelée.
// Même faux DOM minimal que tests/reference-experience-ui.test.mjs (dupliqué volontairement : suites indépendantes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

class Faux {
  constructor(tag) {
    this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this.attrs = {};
    this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = '';
    this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.placeholder = '';
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
  focus() {}
  querySelector(sel) {
    const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, ''));
    const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; };
    return parcourir(this);
  }
  click() { for (const f of this.listeners.click || []) f(); }
}
globalThis.document = { createElement: (tag) => new Faux(tag) };
globalThis.window = globalThis;

const attendre = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const { monterConversation } = await import('../app/conversation/ecran.js');
const { fauxStockage } = await import('./outils.mjs');
const { lireBrouillon } = await import('../app/conversation/brouillon.js');
const {
  identifierMessage, PREFIXE_MESSAGE, traiterTourAvecEnonce, capturerEnonceAvantTraitement, tenterPontLangage,
} = await import('../app/langage/pont.js');
const { nouvelId, magasinMemoireVive, enregistrerEnonceSurTrace, TABLES } = await import('../app/langage/connaissances.js');

const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const PONT = lu('app', 'langage', 'pont.js');
const PONT_CODE = sansCommentaires(PONT);
const MAIN_CODE = sansCommentaires(lu('app', 'main.js'));
const REF = { idTrace: 'trace-1' };
const copie = (x) => JSON.parse(JSON.stringify(x));

// Générateur déterministe observable (pour compter et ordonner les identifications).
function generateur(journal = []) {
  let n = 0;
  const f = (prefixe) => { n += 1; journal.push(`identification:${prefixe}`); return `${prefixe}-test-${n}`; };
  f.appels = () => n;
  return f;
}

// ============================================================================ A. identifierMessage
test('A1. objet minimal { id, texte } exactement, gelé, texte = la MÊME chaîne, aucun autre champ', () => {
  const m = identifierMessage('bonjour', { nouvelId: generateur() });
  assert.deepEqual(Object.keys(m), ['id', 'texte']);
  assert.equal(m.id, 'message-test-1'); assert.equal(m.texte, 'bonjour');
  assert.equal(Object.isFrozen(m), true);
  assert.throws(() => { 'use strict'; m.texte = 'autre'; }, TypeError);
  for (const interdit of ['forme', 'type', 'intention', 'analyse', 'resultat', 'operation', 'possibilites', 'score', 'statut', 'identite', 'origine', 'horodatage', 'date']) assert.equal(Object.hasOwn(m, interdit), false, interdit);
});
test('A2. préfixe « message » : celui d\'aucun autre objet (énoncé, observation, acte, expérience, action, liaison, transformation, trace)', () => {
  assert.equal(PREFIXE_MESSAGE, 'message');
  const m = identifierMessage('x', { nouvelId });
  assert.match(m.id, /^message-\d+-\d+-\d+$/);
  const autres = ['enonce', 'observation-langage', 'observation-composition', 'acte', 'experience', 'action', 'liaison', 'transformation', 'trace'];
  for (const p of autres) assert.equal(m.id.startsWith(`${p}-`), false, p);
  const reels = new Set([...(lu('app', 'langage', 'connaissances.js') + lu('app', 'langage', 'ecran.js')).matchAll(/nouvelId\('([a-z-]+)'/g)].map((x) => x[1]));
  assert.equal(reels.has('message'), false, 'aucun autre objet ne porte déjà ce préfixe');
});
test('A3. le texte n\'est ni normalisé ni rogné ni copié : espaces, retours, NFD, vide, très long, sauts de ligne', () => {
  const g = generateur();
  for (const t of ['  a  ', '\n\tb\n', 'é', '', 'x'.repeat(100000), 'Ligne1\r\nLigne2', '\u0000']) {
    const m = identifierMessage(t, { nouvelId: g });
    assert.equal(m.texte, t);
  }
});
test('A4. non bloquant : sans générateur, générateur qui lève, id non chaîne ou vide → null', () => {
  assert.equal(identifierMessage('x'), null);
  assert.equal(identifierMessage('x', {}), null);
  assert.equal(identifierMessage('x', { nouvelId: null }), null);
  assert.equal(identifierMessage('x', { nouvelId: () => { throw new Error('boum'); } }), null);
  for (const v of [undefined, null, 3, {}, '', ['a']]) assert.equal(identifierMessage('x', { nouvelId: () => v }), null);
});
test('A5. identités successives distinctes avec le vrai générateur (même texte, même milliseconde)', () => {
  const ids = new Set();
  for (let i = 0; i < 500; i += 1) ids.add(identifierMessage('même texte', { nouvelId }).id);
  assert.equal(ids.size, 500);
});
test('A6. le texte reçu n\'est pas lu au-delà du stockage : un String exotique n\'est pas converti (aucune coercition)', () => {
  const exotique = { toString() { throw new Error('converti'); } };
  assert.equal(identifierMessage(exotique, { nouvelId: generateur() }).texte, exotique);
});

// ============================================================================ B. ORDRE DANS LE TOUR (traiterTourAvecEnonce)
function banc({ resultat = { texte: 'ok' }, erreurTraitement = null, erreurCapture = null, avecId = true } = {}) {
  const journal = [];
  const enonces = [];
  const recus = [];
  const deps = {
    enregistrerEnonce: async (idTrace, texte) => {
      journal.push('capture:debut');
      if (erreurCapture) { journal.push('capture:echec'); throw erreurCapture; }
      enonces.push({ idTrace, texte });
      journal.push('capture:fin');
    },
    traiter: async (...args) => {
      journal.push('traitement');
      recus.push(args);
      if (erreurTraitement) throw erreurTraitement;
      return typeof resultat === 'function' ? resultat() : resultat;
    },
  };
  if (avecId) deps.nouvelId = generateur(journal);
  return { journal, enonces, recus, deps };
}
const CHEMINS = [
  ['marqueur Cours:', { texte: 'Il me faut le contenu du cours' }],
  ['marqueur Action:', { texte: 'Il me faut, après « Action : »…' }],
  ['marqueur Compose:', { texte: 'Il me faut, après « Compose : », le nom de l\'opération.' }],
  ['marqueur Transformation:', { texte: 'Il me faut au moins deux exemples' }],
  ['action enseignée reconnue', { texte: 'Résultat', local: true, idTrace: 'trace-9' }],
  ['rejeu autonome', { texte: 'Résultat', local: true, idTrace: 'trace-10' }],
  ['voie ordinaire COMPRIS (laboratoire)', { texte: 'réponse', local: true, laboratoire: true, idExperience: 'exp-1' }],
  ['voie ordinaire PARTIEL/INCOMPRIS + LLM', { texte: 'réponse LLM', idExperience: 'exp-2' }],
  ['Gemini direct (aucune expérience)', { texte: 'Ah, bien sûr ! Dans mes souvenirs…' }],
];
for (const [nom, resultat] of CHEMINS) {
  test(`B1. ${nom} : exactement 1 identification, AVANT le traitement, texte exact transmis, résultat strictement inchangé`, async () => {
    const texte = '  Non, c\'était plutôt une déduction. ';
    const b = banc({ resultat });
    const sortie = await traiterTourAvecEnonce(texte, null, b.deps);
    assert.deepEqual(b.journal, ['identification:message', 'traitement']);
    assert.equal(b.deps.nouvelId.appels(), 1);
    assert.equal(b.recus.length, 1); assert.equal(b.recus[0].length, 1);
    assert.deepEqual(b.recus[0][0], { id: 'message-test-1', texte });
    assert.deepEqual(sortie, resultat);
  });
  test(`B2. ${nom} : mêmes résultat et mêmes appels avec et sans générateur (l'identité n'influence aucune décision)`, async () => {
    const avec = banc({ resultat });
    const sans = banc({ resultat, avecId: false });
    const a = await traiterTourAvecEnonce('texte', REF, avec.deps);
    const s = await traiterTourAvecEnonce('texte', REF, sans.deps);
    assert.deepEqual(a, s);
    assert.deepEqual(avec.journal.filter((x) => !x.startsWith('identification')), sans.journal);
    assert.deepEqual(avec.enonces, sans.enonces);
    assert.equal(sans.recus[0][0], null);
  });
}
test('B3. avec référence de trace : identification, PUIS capture de l\'énoncé, PUIS traitement — l\'identité précède même la capture', async () => {
  const b = banc();
  await traiterTourAvecEnonce('suite', REF, b.deps);
  assert.deepEqual(b.journal, ['identification:message', 'capture:debut', 'capture:fin', 'traitement']);
  assert.deepEqual(b.enonces, [{ idTrace: 'trace-1', texte: 'suite' }]);
});
test('B4. sans référence : aucune capture, une identification, un traitement', async () => {
  const b = banc();
  await traiterTourAvecEnonce('suite', null, b.deps);
  assert.deepEqual(b.journal, ['identification:message', 'traitement']);
  assert.deepEqual(b.enonces, []);
});
test('B5. le message général et l\'énoncé sont deux choses : le message ne réutilise ni n\'altère les arguments de la capture', async () => {
  const b = banc();
  const m = [];
  b.deps.traiter = async (message) => { m.push(message); return { texte: 'ok' }; };
  await traiterTourAvecEnonce('suite', REF, b.deps);
  assert.equal(b.enonces[0].idTrace, 'trace-1'); assert.equal(b.enonces[0].texte, 'suite');
  assert.equal(m[0].id.startsWith('message-'), true);
  assert.notEqual(m[0].id, b.enonces[0].idTrace);
  assert.equal(Object.keys(b.enonces[0]).includes('id'), false, 'l\'identité du message n\'est pas passée à enregistrerEnonce');
});
test('B6. un générateur qui lève ne bloque pas le tour : même réponse, même ordre (sans identification)', async () => {
  const b = banc({ avecId: false });
  b.deps.nouvelId = () => { throw new Error('boum'); };
  const sortie = await traiterTourAvecEnonce('suite', REF, b.deps);
  assert.deepEqual(sortie, { texte: 'ok' });
  assert.deepEqual(b.journal, ['capture:debut', 'capture:fin', 'traitement']);
  assert.equal(b.recus[0][0], null);
});
test('B7. échec de capture et erreur de traitement : comportement antérieur inchangé (note sobre / propagation de l\'erreur)', async () => {
  const b = banc({ erreurCapture: new Error('stockage') });
  const sortie = await traiterTourAvecEnonce('suite', REF, b.deps);
  assert.equal(sortie.actions.length, 1);
  const erreur = new Error('traitement');
  const c = banc({ erreurTraitement: erreur });
  await assert.rejects(() => traiterTourAvecEnonce('suite', REF, c.deps), (e) => e === erreur);
  assert.deepEqual(c.journal, ['identification:message', 'capture:debut', 'capture:fin', 'traitement'], 'l\'identité a bien existé avant l\'erreur');
});
test('B8. deux tours consécutifs du même texte : deux identités, un tour = une identité', async () => {
  const b = banc();
  await traiterTourAvecEnonce('même texte', null, b.deps);
  await traiterTourAvecEnonce('même texte', null, b.deps);
  assert.equal(b.deps.nouvelId.appels(), 2);
  assert.deepEqual(b.recus.map((r) => r[0].id), ['message-test-1', 'message-test-2']);
});
test('B9. le traitement ne reçoit que le message en argument : aucun argument supplémentaire, texte inchangé', async () => {
  const b = banc();
  await traiterTourAvecEnonce('t', null, b.deps);
  assert.equal(b.recus[0].length, 1);
  assert.equal(Object.isFrozen(b.recus[0][0]), true);
});

// ============================================================================ C. AVANT TOUTE ANALYSE : le vrai tenterPontLangage derrière l'identification
test('C1. le premier appel d\'analyse du vrai tenterPontLangage (assurerEsprit) vient APRÈS l\'identification', async () => {
  const journal = [];
  const deps = {
    nouvelId: generateur(journal),
    enregistrerEnonce: async () => { journal.push('capture'); },
    traiter: async () => tenterPontLangage('Quel est mon nom ?', {
      assurerEsprit: async () => { journal.push('analyse:assurerEsprit'); throw new Error('arret'); },
      journaliser: async () => { journal.push('journal'); return [1, 2]; },
      enregistrerExperience: async () => { journal.push('experience'); return { id: 'e' }; },
      ajouterInterpretation: async () => ({}),
    }),
  };
  await assert.rejects(() => traiterTourAvecEnonce('Quel est mon nom ?', REF, deps), /arret/);
  assert.deepEqual(journal, ['identification:message', 'capture', 'analyse:assurerEsprit']);
});
test('C2. un message sans « ? » (voie observée) : identification d\'abord, puis l\'analyse silencieuse', async () => {
  const journal = [];
  const deps = {
    nouvelId: generateur(journal),
    enregistrerEnonce: async () => {},
    traiter: async () => tenterPontLangage('une présentation', {
      assurerEsprit: async () => { journal.push('analyse:assurerEsprit'); throw new Error('avalee'); },
      journaliser: async () => [1, 2], enregistrerExperience: async () => ({ id: 'e' }), ajouterInterpretation: async () => ({}),
      observer: async () => { journal.push('observation'); return null; },
    }).then(() => ({ texte: 'ok' })),
  };
  await traiterTourAvecEnonce('une présentation', null, deps);
  assert.deepEqual(journal, ['identification:message', 'analyse:assurerEsprit']);
});
test('C3. aucune capacité, reconnaissance ni capture n\'est atteinte avant l\'identification (ordre exhaustif sur un traitement qui tente tout)', async () => {
  const journal = [];
  const deps = {
    nouvelId: generateur(journal),
    enregistrerEnonce: async () => { journal.push('capture'); },
    traiter: async () => {
      for (const etape of ['marqueurs', 'reconnaissance:transformation', 'reconnaissance:action', 'rejeu', 'analyse', 'capacite', 'trace', 'gemini']) journal.push(etape);
      return { texte: 'ok' };
    },
  };
  await traiterTourAvecEnonce('x', REF, deps);
  assert.equal(journal[0], 'identification:message');
  assert.equal(journal.indexOf('identification:message') < journal.indexOf('capture'), true);
  assert.equal(journal.indexOf('capture') < journal.indexOf('marqueurs'), true);
});

// ============================================================================ D. RÉPONSE À UNE TRACE : DEUX CHOSES DISTINCTES, RIEN DE PERSISTÉ
async function tout(magasin) {
  const r = {};
  for (const t of TABLES) r[t] = await magasin.lireTout(t);
  return r;
}
test('D1. avec le VRAI enregistrerEnonceSurTrace : l\'énoncé garde son id (« enonce-… »), le message le sien (« message-… »), et seul `enonces` est écrit', async () => {
  const magasin = magasinMemoireVive();
  let messageVu = null;
  await traiterTourAvecEnonce('Non, plutôt une déduction.', REF, {
    nouvelId,
    enregistrerEnonce: (idTrace, texte) => enregistrerEnonceSurTrace(magasin, { idTrace, texte, origine: 'interface' }),
    traiter: async (message) => { messageVu = message; return { texte: 'ok', idExperience: 'exp' }; },
  });
  const t = await tout(magasin);
  assert.equal(t.enonces.length, 1);
  assert.match(t.enonces[0].id, /^enonce-/);
  assert.match(messageVu.id, /^message-/);
  assert.notEqual(t.enonces[0].id, messageVu.id);
  assert.deepEqual(Object.keys(t.enonces[0]).sort(), ['horodatage', 'id', 'idTrace', 'origine', 'texte']);
  for (const nom of TABLES) if (nom !== 'enonces') assert.equal(t[nom].length, 0, `${nom} reste vide`);
  assert.equal(JSON.stringify(t).includes(messageVu.id), false, 'l\'identité du message n\'est persistée nulle part');
});
test('D2. sans référence de trace : AUCUNE écriture (ni énoncé, ni autre) ; l\'identité existe pendant le tour seulement', async () => {
  const magasin = magasinMemoireVive();
  let messageVu = null;
  await traiterTourAvecEnonce('bonjour', null, {
    nouvelId,
    enregistrerEnonce: (idTrace, texte) => enregistrerEnonceSurTrace(magasin, { idTrace, texte, origine: 'interface' }),
    traiter: async (message) => { messageVu = message; return { texte: 'ok' }; },
  });
  assert.match(messageVu.id, /^message-/);
  const t = await tout(magasin);
  for (const nom of TABLES) assert.equal(t[nom].length, 0, nom);
});
test('D3. les lignes écrites sont identiques avec et sans générateur (hors id et horodatage)', async () => {
  const lignes = async (avecId) => {
    const magasin = magasinMemoireVive();
    await traiterTourAvecEnonce('même texte', REF, {
      ...(avecId ? { nouvelId } : {}),
      enregistrerEnonce: (idTrace, texte) => enregistrerEnonceSurTrace(magasin, { idTrace, texte, origine: 'interface' }),
      traiter: async () => ({ texte: 'ok' }),
    });
    return (await tout(magasin)).enonces.map(({ id, horodatage, ...reste }) => reste);
  };
  assert.deepEqual(await lignes(true), await lignes(false));
});
test('D4. la capture d\'énoncé garde son périmètre : sans référence, capturerEnonceAvantTraitement ne tente rien', async () => {
  let appels = 0;
  const r = await capturerEnonceAvantTraitement('x', null, { enregistrerEnonce: async () => { appels += 1; } });
  assert.deepEqual(r, { etat: 'aucune' });
  assert.equal(appels, 0);
});

// ============================================================================ E. NIVEAU UI (faux DOM) : un envoi = une identité
function monterStockage() { const s = fauxStockage(); globalThis.localStorage = s; return s; }
async function coquille({ repondreFn = async () => ({ texte: 'réponse', local: true }), etat = async () => 'pret', voix = null, peutPlusFort = false } = {}) {
  monterStockage();
  const liste = new Faux('div');
  const formulaire = new Faux('form');
  const champ = new Faux('textarea');
  const bouton = new Faux('button');
  const micro = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : sel === '[data-micro]' ? micro : null);
  formulaire.requestSubmit = () => formulaire.listeners.submit[0]({ preventDefault() {} });
  const identites = [];
  const appels = [];
  // Reproduit EXACTEMENT le câblage de main.js : repondre -> traiterTourAvecEnonce(texte, referenceTrace, { enregistrerEnonce, traiter, nouvelId }).
  const repondre = async (texte, options) => {
    const referenceTrace = (options && options.referenceTrace) || null;
    appels.push({ texte, options });
    return traiterTourAvecEnonce(texte, referenceTrace, {
      enregistrerEnonce: async () => {},
      traiter: async (message) => { identites.push(message); return repondreFn(texte, options); },
      nouvelId,
    });
  };
  const conv = monterConversation({
    liste, formulaire, chargerRecents: async () => [], etat, naitre: async () => {}, ouvrirReglages() {},
    repondre, voix, peutDemanderPlusFort: () => peutPlusFort,
  });
  await conv.recharger();
  const soumettre = async (texte) => { champ.value = texte; await formulaire.listeners.submit[0]({ preventDefault() {} }); };
  const tous = (racine, tag) => { const r = []; const p = (e) => e.children.forEach((c) => { if (c.tag === tag) r.push(c); p(c); }); p(racine); return r; };
  return { champ, formulaire, bouton, micro, liste, soumettre, identites, appels, conv, tous };
}
test('E1. message clavier normal : une identité, texte = le texte envoyé (rogné par l\'interface comme avant), chaîne', async () => {
  const c = await coquille();
  await c.soumettre('  bonjour  ');
  assert.equal(c.identites.length, 1);
  assert.equal(c.identites[0].texte, 'bonjour', 'même texte que celui reçu par traiterTour avant v0.63.14 (rogné par l\'interface)');
  assert.equal(c.appels[0].texte, 'bonjour');
  assert.equal(typeof c.identites[0].texte, 'string');
});
test('E2. message vide ou blanc : aucun tour engagé, aucune identité', async () => {
  const c = await coquille();
  await c.soumettre(''); await c.soumettre('   '); await c.soumettre('\n\t');
  assert.equal(c.identites.length, 0); assert.equal(c.appels.length, 0);
});
test('E3. envoi refusé (état non prêt) : aucune identité, aucun tour', async () => {
  const c = await coquille({ etat: async () => 'sans-moteur' });
  await c.soumettre('bonjour');
  assert.equal(c.identites.length, 0); assert.equal(c.appels.length, 0);
});
test('E4. deux envois du même texte : deux identités distinctes ; un envoi : une seule', async () => {
  const c = await coquille();
  await c.soumettre('même texte');
  assert.equal(c.identites.length, 1);
  await c.soumettre('même texte');
  assert.equal(c.identites.length, 2);
  assert.notEqual(c.identites[0].id, c.identites[1].id);
  assert.equal(c.identites[0].texte, c.identites[1].texte);
});
test('E5. brouillon sans envoi : saisie, corrections, restauration — aucune identité', async () => {
  const c = await coquille();
  c.champ.value = 'brouillon'; (c.champ.listeners.input || []).forEach((f) => f());
  c.champ.value = 'brouillon corrigé'; (c.champ.listeners.input || []).forEach((f) => f());
  assert.equal(c.identites.length, 0); assert.equal(c.appels.length, 0);
  c.champ.value = ''; (c.champ.listeners.input || []).forEach((f) => f());
  assert.equal(c.identites.length, 0);
});
test('E6. brouillon restauré au démarrage : aucune identité tant que la personne n\'appuie pas sur Envoyer ; puis une seule', async () => {
  const s = monterStockage();
  s.setItem('naissance-ia.message-en-attente.v1', JSON.stringify({ texte: 'message resté', date: '2026-10-04T10:00:00.000Z' }));
  globalThis.localStorage = s;
  const liste = new Faux('div'), formulaire = new Faux('form'), champ = new Faux('textarea'), bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const identites = [];
  const conv = monterConversation({
    liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {},
    repondre: (texte, options) => traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async (m) => { identites.push(m); return { texte: 'ok' }; }, nouvelId }),
  });
  await conv.recharger();
  assert.equal(champ.value, 'message resté');
  assert.equal(identites.length, 0);
  await formulaire.listeners.submit[0]({ preventDefault() {} });
  assert.equal(identites.length, 1);
  assert.equal(identites[0].texte, 'message resté');
});
test('E7. voix : le texte dicté est recopié dans le champ, sans envoi — aucune identité ; envoyé ensuite par le MÊME chemin : une identité de même forme', async () => {
  const voix = {
    ecouteDisponible: async () => true, lectureDisponible: async () => false, ecouter: async () => 'bonjour dicté',
    arreterEcoute() {}, arreterLecture: async () => {}, lire: async () => {}, enLecture: false,
  };
  const c = await coquille({ voix });
  await attendre();
  c.micro.click();
  await attendre(20);
  assert.equal(c.champ.value, 'bonjour dicté');
  assert.equal(c.identites.length, 0, 'la dictée n\'est pas un envoi');
  await c.formulaire.listeners.submit[0]({ preventDefault() {} });
  assert.equal(c.identites.length, 1);
  assert.deepEqual(Object.keys(c.identites[0]), ['id', 'texte']);
  assert.match(c.identites[0].id, /^message-/);
  assert.equal(c.identites[0].texte, 'bonjour dicté');
  const clavier = await coquille();
  await clavier.soumettre('bonjour dicté');
  assert.deepEqual(Object.keys(clavier.identites[0]), Object.keys(c.identites[0]));
  assert.equal(clavier.identites[0].id.replace(/\d+/g, 'N'), c.identites[0].id.replace(/\d+/g, 'N'), 'aucune source « voix » distincte');
});
test('E8. échec puis « Réessayer » : le premier essai a engagé un tour (identité), le nouvel envoi demandé par la personne en a une NOUVELLE', async () => {
  let essais = 0;
  const c = await coquille({ repondreFn: async () => { essais += 1; if (essais === 1) throw new Error('réseau'); return { texte: 'ok', local: true }; } });
  await c.soumettre('message à réessayer');
  assert.equal(c.identites.length, 1);
  const reessayer = c.tous(c.liste, 'button').find((b) => b.textContent === 'Réessayer');
  assert.ok(reessayer, 'bouton Réessayer');
  reessayer.click();
  await attendre(30);
  assert.equal(c.identites.length, 2, 'aucun rejeu automatique : un clic = un nouvel envoi');
  assert.notEqual(c.identites[0].id, c.identites[1].id);
  assert.equal(c.identites[1].texte, 'message à réessayer');
  assert.equal(lireBrouillon(), null, 'le brouillon est effacé après le succès');
});
test('E9. un échec seul ne rejoue RIEN automatiquement : une seule identité tant que la personne ne fait rien', async () => {
  const c = await coquille({ repondreFn: async () => { throw new Error('réseau'); } });
  await c.soumettre('un seul essai');
  await attendre(50);
  assert.equal(c.identites.length, 1);
  assert.equal(c.appels.length, 1);
});
test('E10. « Demander à un modèle plus fort » (reprise) : action explicite de la personne = nouvel envoi = nouvelle identité ; le texte repris est celui de la question', async () => {
  const c = await coquille({ repondreFn: async (t, o) => ({ texte: 'réponse locale', local: true, idQuestion: 7 }), peutPlusFort: true });
  await c.soumettre('une question');
  assert.equal(c.identites.length, 1);
  const plusFort = c.tous(c.liste, 'button').find((b) => b.textContent === 'Demander à un modèle plus fort');
  assert.ok(plusFort);
  plusFort.click();
  await attendre(30);
  assert.equal(c.identites.length, 2);
  assert.notEqual(c.identites[0].id, c.identites[1].id);
  assert.equal(c.identites[1].texte, 'une question');
  assert.equal(c.appels[1].options.reprise !== undefined || c.appels[1].options.forcerExterne === true, true);
});
test('E11. envoi pendant qu\'un tour est en cours (occupé) : ignoré, donc aucune identité supplémentaire', async () => {
  let debloquer; const attente = new Promise((r) => { debloquer = r; });
  const c = await coquille({ repondreFn: async () => { await attente; return { texte: 'ok', local: true }; } });
  const premier = c.soumettre('premier');
  await attendre();
  await c.soumettre('second pendant l\'attente');
  assert.equal(c.identites.length, 1);
  debloquer(); await premier; await attendre();
  assert.equal(c.identites.length, 1);
});
test('E12. réponse à une trace (référence sélectionnée) : le message général a son identité, l\'énoncé la sienne, deux choses', async () => {
  monterStockage();
  const liste = new Faux('div'), formulaire = new Faux('form'), champ = new Faux('textarea'), bouton = new Faux('button');
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const magasin = magasinMemoireVive();
  const identites = [];
  const conv = monterConversation({
    liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {},
    repondre: (texte, options) => traiterTourAvecEnonce(texte, (options && options.referenceTrace) || null, {
      enregistrerEnonce: (idTrace, t) => enregistrerEnonceSurTrace(magasin, { idTrace, texte: t, origine: 'interface' }),
      traiter: async (m) => { identites.push(m); return { texte: 'réponse locale', local: true, idTrace: 'trace-1' }; },
      nouvelId,
    }),
  });
  await conv.recharger();
  champ.value = 'première question'; await formulaire.listeners.submit[0]({ preventDefault() {} });
  const bulles = liste.children.filter((c) => c._cls.has('message-ia'));
  const tousBoutons = []; const p = (e) => e.children.forEach((c) => { if (c.tag === 'button') tousBoutons.push(c); p(c); }); p(bulles.at(-1));
  tousBoutons.find((b) => b.textContent === 'Répondre').click();
  champ.value = 'Non, plutôt une déduction.'; await formulaire.listeners.submit[0]({ preventDefault() {} });
  assert.equal(identites.length, 2);
  const lignes = await magasin.lireTout('enonces');
  assert.equal(lignes.length, 1, 'un seul énoncé : seul le message envoyé EN RÉPONSE à la trace est capturé');
  assert.equal(lignes[0].idTrace, 'trace-1');
  assert.notEqual(lignes[0].id, identites[1].id);
  assert.match(lignes[0].id, /^enonce-/); assert.match(identites[1].id, /^message-/);
});

// ============================================================================ F. STATIQUE : MODIFICATIONS ACTIVES EXACTES
test('F1. main.js : seules deux modifications actives — l\'import de nouvelId et son passage à traiterTourAvecEnonce ; les lignes épinglées sont inchangées', () => {
  assert.match(MAIN_CODE, /^import \{ nouvelId, ouvrirIndexedDB as ouvrirLangage,/m);
  assert.match(MAIN_CODE, /return traiterTourAvecEnonce\(texte, referenceTrace, \{/);
  assert.match(MAIN_CODE, /traiter: \(\) => traiterTour\(texte, options, referenceTrace\),\n\s+nouvelId,\n(\s+\/\/ v0\.63\.16[^\n]*\n)?\s+observerPossibilites: /); // v0.63.16 : + observerPossibilites (gardé par tests/observations-possibilites.test.mjs)
  assert.equal((MAIN_CODE.match(/\bnouvelId\b/g) || []).length, 2, 'import + passage, rien d\'autre');
  assert.equal(/identifierMessage|PREFIXE_MESSAGE/.test(MAIN_CODE), false, 'main.js n\'identifie rien lui-même');
  assert.match(MAIN_CODE, /async function traiterTour\(texte, options, referenceTrace\) \{/);
});
test('F2. main.js : AVANT traiterTourAvecEnonce, le corps de repondre ne contient que la lecture de la référence (aucune analyse, aucun appel)', () => {
  const debut = MAIN_CODE.indexOf('repondre: async (texte, options) => {');
  const fin = MAIN_CODE.indexOf('return traiterTourAvecEnonce(');
  assert.ok(debut > 0 && fin > debut);
  const avant = MAIN_CODE.slice(debut + 'repondre: async (texte, options) => {'.length, fin).trim();
  assert.equal(avant, 'const referenceTrace = (options && options.referenceTrace) || null;');
});
test('F3. main.js : esprit.repondre, les reconnaissances et le pont ne sont atteints que depuis traiterTour (donc après l\'identification)', () => {
  const horsTour = MAIN_CODE.slice(0, MAIN_CODE.indexOf('async function traiterTour(')) + MAIN_CODE.slice(MAIN_CODE.indexOf('const conversation = monterConversation('));
  assert.equal(/tenterPontLangage\(|tenterReconnaissance(Action|Transformation)\(|tenterRejeuAutonome\(|esprit\.repondre\(/.test(horsTour), false);
});
test('F4. pont.js : dans traiterTourAvecEnonce, l\'identification est la PREMIÈRE instruction, avant la capture et le traitement ; le message n\'est utilisé que comme argument de traiter', () => {
  const debut = PONT_CODE.indexOf('export async function traiterTourAvecEnonce(');
  const corps = PONT_CODE.slice(debut, PONT_CODE.indexOf('\n}\n', debut));
  const lignes = corps.split('\n').map((l) => l.trim()).filter(Boolean);
  assert.equal(lignes[0], 'export async function traiterTourAvecEnonce(texte, referenceTrace, { enregistrerEnonce, traiter, nouvelId, observerPossibilites, enregistrerValeur }) {'); // v0.63.16 : + observerPossibilites (injecté) ; v0.63.27 : + enregistrerValeur (injecté)
  assert.equal(lignes[1], 'const message = identifierMessage(texte, { nouvelId });');
  assert.equal(corps.indexOf('identifierMessage(') < corps.indexOf('observerPossibilites(message)'), true);
  assert.equal(corps.indexOf('identifierMessage(') < corps.indexOf('conserverValeurMessage(message'), true); // v0.63.27
  assert.equal(corps.indexOf('conserverValeurMessage(message') < corps.indexOf('observerPossibilites(message)'), true, 'v0.63.27 : la valeur est conservée AVANT l\'observation');
  assert.equal(corps.indexOf('observerPossibilites(message)') < corps.indexOf('capturerEnonceAvantTraitement('), true, 'v0.63.16 : l\'observation s\'insère entre l\'identité et la capture');
  assert.equal(corps.indexOf('identifierMessage(') < corps.indexOf('capturerEnonceAvantTraitement('), true);
  assert.equal(corps.indexOf('capturerEnonceAvantTraitement(') < corps.indexOf('traiter(message)'), true);
  assert.equal((corps.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n').match(/\bmessage\b/g) || []).length, 5, 'déclaration (const message), test non nul, conserverValeurMessage(message), observerPossibilites(message), traiter(message)'); // v0.63.27
  assert.match(corps, /const resultat = await traiter\(message\);/);
  assert.match(corps, /return appliquerAbstentionSiReferenceIgnoree\(resultat, referenceTrace, capture\.etat\);/);
});
test('F5. identifierMessage : aucune lecture, normalisation, persistance, forme ni décision ; pas de mémoire, pas d\'horloge, pas de compteur local', () => {
  const debut = PONT_CODE.indexOf('export function identifierMessage(');
  const corps = PONT_CODE.slice(debut, PONT_CODE.indexOf('\n}\n', debut));
  assert.equal(/\.trim\(|\.slice\(|toLowerCase|normalize|\.replace\(|\.split\(|\.match\(|\.test\(|JSON|ecrire|magasin|localStorage|indexedDB|Date\b|Math\.random|crypto|\+\+|\+= *1|forme|score|choisir/.test(corps), false);
  assert.match(corps, /const id = nouvelId\(PREFIXE_MESSAGE\);/);
  assert.match(corps, /return Object\.freeze\(\{ id, texte \}\);/);
});
test('F6. aucun autre fichier de production ne connaît l\'identification ; pont.js n\'importe pas la mémoire ; la conversation (UI) et le brouillon ignorent nouvelId', () => {
  assert.equal(/connaissances/.test(PONT_CODE.split('\n').filter((l) => /^\s*import\b/.test(l)).join('\n')), false);
  for (const f of [['app', 'conversation', 'ecran.js'], ['app', 'conversation', 'brouillon.js'], ['app', 'langage', 'ecran.js'], ['app', 'langage', 'connaissances.js'], ['app', 'esprit', 'esprit.js'], ['app', 'memoire', 'memoire.js']]) {
    const src = sansCommentaires(lu(...f));
    assert.equal(/identifierMessage|PREFIXE_MESSAGE|nouvelId\('message'/.test(src), false, f.join('/'));
  }
  assert.equal(/nouvelId/.test(sansCommentaires(lu('app', 'conversation', 'ecran.js'))), false, 'l\'interface ne crée aucune identité : le tour la crée à l\'envoi');
  assert.equal(/nouvelId/.test(sansCommentaires(lu('app', 'conversation', 'brouillon.js'))), false);
});
test('F7. INTERDITS : le chemin du tour n\'appelle aucune primitive de v0.63.x ; aucun import du catalogue, des productions, des possibilités, du parcours, des formes', () => {
  for (const f of [['app', 'main.js'], ['app', 'langage', 'pont.js']]) {
    const src = sansCommentaires(lu(...f));
    assert.equal(/possibilites-liaison|possibilitesDeLiaison|productions-decrites|productionsDecrites|descriptions-operations|DESCRIPTIONS_OPERATIONS|parcours-structure|parcourirStructure|formes-operation|garantie-forme|relations-parent-enfant|validerDescripteurOperation/.test(src), false, f.join('/'));
  }
});
test('F8. aucune persistance nouvelle : tables = 19 depuis v0.63.16 (aucune table « messages »), VERSION_BASE 15, SCHEMA_SAUVEGARDE 5', async () => {
  const { VERSION_BASE } = await import('../app/langage/connaissances.js');
  assert.equal(VERSION_BASE, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(TABLES.length, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
  assert.equal(TABLES.some((t) => /message/i.test(t)), false);
  assert.match(lu('app', 'memoire', 'sauvegarde.js'), /SCHEMA_SAUVEGARDE\s*=\s*9\b/); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22)
});
test('F9. pas de forme : aucune déclaration {identite, forme} ni appel du langage de formes dans l\'identification', () => {
  const debut = PONT_CODE.indexOf('export function identifierMessage(');
  const corps = PONT_CODE.slice(debut, PONT_CODE.indexOf('\n}\n', debut));
  assert.equal(/identite|forme|genre|scalaire|chaine/.test(corps), false);
});
// === FIN_TEST_IDENTITE_MESSAGE ===
