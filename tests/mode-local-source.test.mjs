// Jalon « mode-local-source » (ticket-40) : préférence « mode local » sur l'appareil et coupure du fournisseur à la
// source (app/fournisseurs/registre.js, seul importeur de gemini.js). Aucun réseau réel : globalThis.fetch est espionné.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CLE_MODE_LOCAL, lireModeLocal, ecrireModeLocal, texteEtatModeLocal, erreurModeLocal,
  REPONSE_SANS_VOIE_LOCALE, MESSAGE_MOTEUR_COUPE, MESSAGE_COURS_REFUSE, MESSAGE_TEST_BLOQUE,
  MESSAGE_RANGEMENT_BLOQUE, MESSAGE_PLUS_FORT_REFUSE,
} from '../app/reglages/mode-local.js';
import { obtenirFournisseur, listerFournisseurs, FOURNISSEUR_PAR_DEFAUT } from '../app/fournisseurs/registre.js';
import * as gemini from '../app/fournisseurs/gemini.js';
import { ErreurFournisseur, CODES_REGLAGES } from '../app/fournisseurs/erreurs.js';
import { executerAvecRepli, verifierModeles } from '../app/fournisseurs/fiabilite.js';
import { CLE_STOCKAGE, lireReglages, reglagesDe } from '../app/reglages/stockage.js';
import { CLE_SANTE } from '../app/fournisseurs/sante.js';
import { fetchCompte } from '../app/fournisseurs/compteur.js';

const RACINE = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function fauxStockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    m,
  };
}

// Stockage de l'appareil simulé (globalThis.localStorage), le temps d'un test.
function avecAppareil(stockage) {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: stockage, configurable: true, writable: true });
  return () => {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant);
    else delete globalThis.localStorage;
  };
}

// Espion du réseau : chaque appel est noté ; la réponse imite un generateContent réussi.
function espionReseau() {
  const avant = globalThis.fetch;
  const appels = [];
  globalThis.fetch = async (url, options) => {
    appels.push({ url: String(url), options });
    const corps = String(url).includes('/models?')
      ? { models: [{ name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] }] }
      : { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] };
    return { ok: true, status: 200, text: async () => JSON.stringify(corps) };
  };
  return { appels, restaurer: () => { globalThis.fetch = avant; } };
}

const REGLAGES_AVEC_CLE = JSON.stringify({
  fournisseur: 'gemini',
  parFournisseur: { gemini: { cle: 'AQ.cle-essai', methode: 'entete', modele: 'gemini-2.5-flash', modeles: [{ id: 'gemini-2.5-flash', nom: 'Gemini 2.5 Flash' }, { id: 'gemini-2.0-flash', nom: 'Gemini 2.0 Flash' }], testeLe: '2026-10-01T10:00:00.000Z' } },
});

const historique = [{ role: 'moi', texte: 'bonjour' }];

// Les cinq chemins du fournisseur vers le réseau, avec les accès enregistrés (comme main.js et l'écran des Réglages).
function cinqAppels(f, acces) {
  return {
    envoyer: () => f.envoyer({ historique, ...acces }),
    generer: () => f.generer({ instructions: 'i', entree: 'e', ...acces }),
    converser: () => f.converser({ historique, ...acces }),
    sonder: () => f.sonder({ ...acces }),
    tester: () => f.tester({ cle: acces.cle || 'AQ.cle-essai' }),
  };
}

async function verifierCoupe(f, acces, appels) {
  for (const [nom, appel] of Object.entries(cinqAppels(f, acces))) {
    if (nom === 'tester') {
      const r = await appel();
      assert.equal(r.ok, false, nom);
      assert.deepEqual(r.essais, [], nom);
      assert.ok(r.erreur instanceof ErreurFournisseur, nom);
      assert.equal(r.erreur.code, 'reglage', nom);
      assert.equal(r.erreur.message, MESSAGE_MOTEUR_COUPE, nom);
    } else {
      await assert.rejects(appel(), (e) => e instanceof ErreurFournisseur && e.code === 'reglage' && e.message === MESSAGE_MOTEUR_COUPE, nom);
    }
    assert.equal(appels.length, 0, `${nom} : aucun appel réseau`);
  }
}

// ============================================================================================ A. PRÉFÉRENCE
test('A1. lireModeLocal : false par défaut (stockage vide, illisible, autre forme, stockage absent ou cassé) ; true seulement après ecrireModeLocal(true)', () => {
  const s = fauxStockage();
  assert.equal(lireModeLocal(s), false);
  for (const brut of ['{pas du json', '{"actif":"oui"}', '{"actif":1}', '{"actif":false}', 'true', '[true]', '{}', 'null', '"actif"', '']) {
    s.setItem(CLE_MODE_LOCAL, brut);
    assert.equal(lireModeLocal(s), false, brut);
  }
  assert.equal(lireModeLocal(null), false);
  assert.equal(lireModeLocal(undefined), false);
  assert.equal(lireModeLocal({}), false);
  assert.equal(lireModeLocal({ getItem: () => { throw new Error('bloqué'); } }), false);
  const s2 = fauxStockage();
  assert.equal(ecrireModeLocal(true, s2), true);
  assert.equal(s2.getItem(CLE_MODE_LOCAL), '{"actif":true}');
  assert.equal(lireModeLocal(s2), true);
  assert.equal(ecrireModeLocal(false, s2), true);
  assert.equal(s2.getItem(CLE_MODE_LOCAL), '{"actif":false}');
  assert.equal(lireModeLocal(s2), false);
  assert.equal(ecrireModeLocal('oui', s2), true);
  assert.equal(lireModeLocal(s2), false, 'seul true active');
  assert.equal(ecrireModeLocal(true, { setItem: () => { throw new Error('plein'); } }), false);
  assert.equal(ecrireModeLocal(true, null), false);
});

test('A2. clé propre et distincte : ecrireModeLocal n\'écrit que naissance-ia.mode-local.v1 ; les réglages du fournisseur restent identiques octet pour octet', () => {
  assert.equal(CLE_MODE_LOCAL, 'naissance-ia.mode-local.v1');
  assert.notEqual(CLE_MODE_LOCAL, CLE_STOCKAGE);
  assert.equal(CLE_STOCKAGE, 'naissance-ia.reglages.v1');
  const s = fauxStockage();
  s.setItem(CLE_STOCKAGE, REGLAGES_AVEC_CLE);
  ecrireModeLocal(true, s);
  assert.equal(s.getItem(CLE_STOCKAGE), REGLAGES_AVEC_CLE);
  ecrireModeLocal(false, s);
  assert.equal(s.getItem(CLE_STOCKAGE), REGLAGES_AVEC_CLE);
  assert.deepEqual([...s.m.keys()].sort(), [CLE_MODE_LOCAL, CLE_STOCKAGE].sort());
  // La lecture n'écrit jamais rien : aucune activation automatique.
  const vide = fauxStockage();
  lireModeLocal(vide); lireModeLocal(vide);
  assert.equal(vide.m.size, 0);
});

test('A3. texte d\'état, erreur du mode local et textes fixes', () => {
  assert.equal(texteEtatModeLocal(true), 'Mode local actif');
  assert.equal(texteEtatModeLocal(false), 'Mode local inactif');
  assert.equal(texteEtatModeLocal(undefined), 'Mode local inactif');
  const e = erreurModeLocal();
  assert.ok(e instanceof ErreurFournisseur);
  assert.equal(e.code, 'reglage');
  assert.ok(CODES_REGLAGES.has(e.code));
  assert.equal(e.message, MESSAGE_MOTEUR_COUPE);
  assert.notEqual(erreurModeLocal(), e, 'une erreur neuve à chaque appel');
  assert.equal(REPONSE_SANS_VOIE_LOCALE, "Je n'ai pas de réponse locale à ce message.");
  assert.equal(MESSAGE_MOTEUR_COUPE, "Mode local : aucun moteur externe n'est appelé. Décoche la case du mode local dans les Réglages pour le réutiliser.");
  assert.equal(MESSAGE_COURS_REFUSE, "Sans moteur externe, je ne peux pas décomposer ce cours : rien n'a été appelé, rien n'a été retenu.");
  assert.equal(MESSAGE_TEST_BLOQUE, "Test de clé bloqué : le mode local est en cours, aucun appel au fournisseur. Rien n'a été enregistré.");
  assert.equal(MESSAGE_RANGEMENT_BLOQUE, "mode local en cours : aucun moteur externe n'est appelé, rien n'a été rangé.");
  assert.equal(MESSAGE_PLUS_FORT_REFUSE, "Sans moteur externe, je ne peux pas demander à un modèle plus fort : rien n'a été appelé.");
});

// ============================================================================================ B. COUPURE À LA SOURCE (avec clé)
test('B1. clé et modèle enregistrés, mode local actif : envoyer, generer, converser, sonder, tester font zéro appel fetch et échouent avec le code « reglage »', async () => {
  const s = fauxStockage();
  s.setItem(CLE_STOCKAGE, REGLAGES_AVEC_CLE);
  const restaurerAppareil = avecAppareil(s);
  const reseau = espionReseau();
  try {
    assert.equal(ecrireModeLocal(true), true);
    const r = lireReglages();
    const f = obtenirFournisseur(r.fournisseur);
    const p = reglagesDe(r, f.id);
    assert.equal(p.cle, 'AQ.cle-essai');
    assert.notEqual(f, gemini);
    assert.equal(f.id, gemini.id);
    assert.equal(f.nom, gemini.nom);
    assert.equal(f.lienCle, gemini.lienCle);
    assert.equal(f.aideCle, gemini.aideCle);
    assert.equal(f.ordonnerModeles, gemini.ordonnerModeles);
    await verifierCoupe(f, { cle: p.cle, methode: p.methode, modele: p.modele }, reseau.appels);
    // Même à travers le compteur d'appels (fetchFn compté, comme dans main.js) : rien.
    await assert.rejects(f.envoyer({ historique, cle: p.cle, methode: p.methode, modele: p.modele, fetchFn: fetchCompte({ type: 'conversation', fournisseur: f, stockage: s }) }), (e) => e.code === 'reglage');
    assert.equal(reseau.appels.length, 0);
    // Le stockage explicite donne le même résultat ; listerFournisseurs et le fournisseur par défaut sont inchangés.
    assert.equal(obtenirFournisseur('gemini', s), f);
    assert.equal(obtenirFournisseur('inconnu', s), f);
    assert.deepEqual(listerFournisseurs(), [{ id: gemini.id, nom: gemini.nom }]);
    assert.equal(FOURNISSEUR_PAR_DEFAUT, 'gemini');
    // Rien n'a été écrit dans les réglages du fournisseur.
    assert.equal(s.getItem(CLE_STOCKAGE), REGLAGES_AVEC_CLE);
  } finally {
    reseau.restaurer();
    restaurerAppareil();
  }
});

test('B2. après ecrireModeLocal(false) : obtenirFournisseur rend de nouveau le vrai fournisseur, intact, et envoyer atteint fetch', async () => {
  const s = fauxStockage();
  s.setItem(CLE_STOCKAGE, REGLAGES_AVEC_CLE);
  const restaurerAppareil = avecAppareil(s);
  const reseau = espionReseau();
  try {
    ecrireModeLocal(true);
    const coupe = obtenirFournisseur('gemini');
    await assert.rejects(coupe.envoyer({ historique, cle: 'AQ.cle-essai', methode: 'entete', modele: 'gemini-2.5-flash' }), (e) => e.code === 'reglage');
    assert.equal(reseau.appels.length, 0);
    ecrireModeLocal(false);
    const f = obtenirFournisseur('gemini');
    assert.equal(f, gemini, 'le vrai fournisseur, inchangé');
    assert.equal(f.envoyer, gemini.envoyer);
    const p = reglagesDe(lireReglages(), f.id);
    const texte = await f.envoyer({ historique, cle: p.cle, methode: p.methode, modele: p.modele });
    assert.equal(texte, '{"ok":true}');
    assert.ok(reseau.appels.length >= 1);
    assert.match(reseau.appels[0].url, /models\/gemini-2\.5-flash:generateContent/);
    const n = reseau.appels.length;
    const t = await f.tester({ cle: p.cle });
    assert.equal(t.ok, true);
    assert.ok(reseau.appels.length > n, 'le test de clé atteint de nouveau le réseau');
    // Réactiver coupe de nouveau, désactiver rend de nouveau le vrai : aucune perte.
    ecrireModeLocal(true);
    assert.notEqual(obtenirFournisseur('gemini'), gemini);
    ecrireModeLocal(false);
    assert.equal(obtenirFournisseur('gemini'), gemini);
  } finally {
    reseau.restaurer();
    restaurerAppareil();
  }
});

test('B3. mode local jamais écrit (défaut) : le vrai fournisseur ; stockage de l\'appareil absent : le vrai fournisseur', () => {
  const s = fauxStockage();
  const restaurer = avecAppareil(s);
  try {
    assert.equal(obtenirFournisseur('gemini'), gemini);
    assert.equal(s.m.size, 0, 'obtenirFournisseur n\'écrit rien');
  } finally { restaurer(); }
  const restaurer2 = avecAppareil(undefined);
  try {
    assert.equal(obtenirFournisseur('gemini'), gemini);
  } finally { restaurer2(); }
});

// ============================================================================================ C. SANS CLÉ, FIABILITÉ
test('C1. sans clé enregistrée, mode local actif : même résultat, zéro appel fetch', async () => {
  const s = fauxStockage();
  const restaurerAppareil = avecAppareil(s);
  const reseau = espionReseau();
  try {
    ecrireModeLocal(true);
    const r = lireReglages();
    const f = obtenirFournisseur(r.fournisseur);
    const p = reglagesDe(r, f.id);
    assert.equal(p.cle, undefined);
    await verifierCoupe(f, { cle: p.cle, methode: p.methode, modele: p.modele }, reseau.appels);
    await verifierCoupe(f, { cle: 'AQ.saisie', methode: 'entete', modele: 'gemini-2.5-flash' }, reseau.appels);
    assert.equal(s.getItem(CLE_STOCKAGE), null, 'aucun réglage du fournisseur créé');
  } finally {
    reseau.restaurer();
    restaurerAppareil();
  }
});

test('C2. executerAvecRepli sur le fournisseur coupé : zéro appel fetch, un seul essai, aucune relance, aucun repli de modèle, aucune santé notée', async () => {
  const s = fauxStockage();
  s.setItem(CLE_STOCKAGE, REGLAGES_AVEC_CLE);
  ecrireModeLocal(true, s);
  const reseau = espionReseau();
  try {
    const f = obtenirFournisseur('gemini', s);
    const p = reglagesDe(lireReglages(s), f.id);
    const etapes = []; const attentes = []; const taches = [];
    await assert.rejects(executerAvecRepli({
      fournisseur: f, prefere: p.modele, modeles: p.modeles, stockage: s,
      tache: (m, signal) => { taches.push(m); return f.converser({ historique, cle: p.cle, methode: p.methode, modele: m, signal }); },
      attendre: async (ms) => { attentes.push(ms); },
      surEtape: (e) => etapes.push(e),
    }), (e) => e instanceof ErreurFournisseur && e.code === 'reglage');
    assert.equal(reseau.appels.length, 0);
    assert.deepEqual(taches, ['gemini-2.5-flash']);
    assert.deepEqual(attentes, []);
    assert.deepEqual(etapes.map((e) => e.type), ['essai']);
    assert.equal(s.getItem(CLE_SANTE), null, 'aucun modèle pénalisé');
    // generer (rangement, enseignement) : idem.
    await assert.rejects(executerAvecRepli({
      fournisseur: f, prefere: p.modele, modeles: p.modeles, stockage: s,
      tache: (m) => f.generer({ instructions: 'i', entree: 'e', cle: p.cle, methode: p.methode, modele: m }),
      attendre: async (ms) => { attentes.push(ms); },
    }), (e) => e.code === 'reglage');
    assert.equal(reseau.appels.length, 0);
    assert.deepEqual(attentes, []);
  } finally {
    reseau.restaurer();
  }
});

test('C3. verifierModeles sur le fournisseur coupé : zéro appel fetch, arrêt au premier essai avec le code « reglage »', async () => {
  for (const reglages of [REGLAGES_AVEC_CLE, null]) {
    const s = fauxStockage();
    if (reglages) s.setItem(CLE_STOCKAGE, reglages);
    ecrireModeLocal(true, s);
    const reseau = espionReseau();
    try {
      const f = obtenirFournisseur('gemini', s);
      const v = await verifierModeles({
        fournisseur: f, acces: { cle: 'AQ.cle-essai', methode: 'entete' }, stockage: s,
        prefere: 'gemini-2.5-flash', modeles: [{ id: 'gemini-2.5-flash' }, { id: 'gemini-2.0-flash' }],
      });
      assert.equal(v.modele, null);
      assert.equal(v.essais.length, 1);
      assert.equal(v.essais[0].ok, false);
      assert.equal(v.essais[0].code, 'reglage');
      assert.equal(v.erreur.code, 'reglage');
      assert.equal(reseau.appels.length, 0);
      assert.equal(s.getItem(CLE_SANTE), null);
    } finally {
      reseau.restaurer();
    }
  }
});

// ============================================================================================ D. GARDES STATIQUES
function fichiersJs(dossier) {
  const out = [];
  for (const n of readdirSync(dossier)) {
    const p = join(dossier, n);
    if (statSync(p).isDirectory()) out.push(...fichiersJs(p));
    else if (/\.(m?js)$/.test(n)) out.push(p);
  }
  return out;
}
const rel = (f) => relative(RACINE, f).split(sep).join('/');

test('D1. gemini.js n\'est importé, dans app/, que par app/fournisseurs/registre.js (seul point de passage)', () => {
  const importeurs = fichiersJs(join(RACINE, 'app'))
    .filter((f) => /(?:from\s*|import\s*\(?\s*)['"][^'"]*gemini\.js['"]/.test(readFileSync(f, 'utf8')))
    .map(rel);
  assert.deepEqual(importeurs, ['app/fournisseurs/registre.js']);
  const registre = readFileSync(join(RACINE, 'app', 'fournisseurs', 'registre.js'), 'utf8');
  assert.deepEqual(registre.match(/^import .*$/gm), [
    "import * as gemini from './gemini.js';",
    "import { lireModeLocal, erreurModeLocal } from '../reglages/mode-local.js';",
  ]);
  assert.equal(/\bfetch\b/.test(registre), false);
});

test('D2. mode-local.js : ni fetch, ni registre, ni réseau ; seul import : la classe d\'erreur commune des fournisseurs', () => {
  const code = readFileSync(join(RACINE, 'app', 'reglages', 'mode-local.js'), 'utf8');
  assert.equal(/fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(code), false);
  assert.equal(/registre/.test(code), false);
  assert.equal(/gemini/.test(code), false);
  assert.equal(/import\s*\(/.test(code), false);
  assert.deepEqual(code.match(/^import .*$/gm), ["import { ErreurFournisseur } from '../fournisseurs/erreurs.js';"]);
  // Une seule clé de stockage, la sienne ; jamais celle des réglages du fournisseur.
  assert.deepEqual(code.match(/naissance-ia\.[a-z0-9.-]+/g), ['naissance-ia.mode-local.v1']);
  assert.equal(/CLE_STOCKAGE|reglages\.v1/.test(code), false);
  // Aucune activation automatique : un seul setItem, dans ecrireModeLocal.
  assert.equal((code.match(/setItem\(/g) || []).length, 1);
  const i = code.indexOf('export function ecrireModeLocal(');
  const j = code.indexOf('export function texteEtatModeLocal(');
  assert.ok(i >= 0 && j > i);
  assert.ok(code.indexOf('setItem(') > i && code.indexOf('setItem(') < j);
});

test('D3. aucune table, aucune migration : mode-local.js et registre.js ne déclarent ni VERSION_BASE, ni SCHEMA_SAUVEGARDE, ni TABLES, ni indexedDB', () => {
  for (const f of [join(RACINE, 'app', 'reglages', 'mode-local.js'), join(RACINE, 'app', 'fournisseurs', 'registre.js')]) {
    const code = readFileSync(f, 'utf8');
    assert.equal(/VERSION_BASE|SCHEMA_SAUVEGARDE|\bTABLES\b|indexedDB/.test(code), false, rel(f));
  }
});
