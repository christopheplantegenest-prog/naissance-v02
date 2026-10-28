// Ticket 40, jalon « mode-local-source » : préférence « mode local » gardée sur l'appareil (app/reglages/mode-local.js)
// et coupure du moteur externe à la source, dans le SEUL point de passage app/fournisseurs/registre.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLE_MODE_LOCAL, lireModeLocal, ecrireModeLocal, texteEtatModeLocal,
  REPONSE_SANS_VOIE_LOCALE, MESSAGE_MOTEUR_COUPE, MESSAGE_COURS_REFUSE, MESSAGE_TEST_BLOQUE,
  MESSAGE_RANGEMENT_BLOQUE, MESSAGE_PLUS_FORT_REFUSE, erreurModeLocal,
} from '../app/reglages/mode-local.js';
import * as modeLocal from '../app/reglages/mode-local.js';
// erreurModeLocal est définie dans mode-local.js et rend directement une ErreurFournisseur (code « reglage ») ;
// le registre (seul point de passage) la réutilise telle quelle, sans exporter de doublon.
import * as registre from '../app/fournisseurs/registre.js';
import { obtenirFournisseur, FOURNISSEUR_PAR_DEFAUT, listerFournisseurs } from '../app/fournisseurs/registre.js';
import * as gemini from '../app/fournisseurs/gemini.js';
import { ErreurFournisseur, enErreurFournisseur, CODES_REGLAGES } from '../app/fournisseurs/erreurs.js';
import { CLE_STOCKAGE, modifierFournisseur, lireReglages, reglagesDe } from '../app/reglages/stockage.js';
import { executerAvecRepli, verifierModeles } from '../app/fournisseurs/fiabilite.js';
import { CLE_SANTE } from '../app/fournisseurs/sante.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (p) => relative(RACINE, p).split(sep).join('/');

function stockageMemoire(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    cles: () => [...m.keys()].sort(),
    brut: (k) => (m.has(k) ? m.get(k) : null),
  };
}

const MODELES = [{ id: 'models/gemini-2.5-flash', nom: 'Gemini 2.5 Flash' }, { id: 'models/gemini-2.0-flash', nom: 'Gemini 2.0 Flash' }];

function avecCle(stockage) {
  modifierFournisseur('gemini', { cle: 'AQ.cle-essai', methode: 'entete', modele: 'models/gemini-2.5-flash', modeles: MODELES, testeLe: '2026-10-01T00:00:00.000Z' }, stockage);
  return stockage;
}

// Espion du réseau : compte chaque appel ; répond comme Gemini (texte « ok », liste de modèles).
function poserEspion() {
  const appels = [];
  const avant = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    appels.push({ url: String(url), options });
    const corps = String(url).includes(':generateContent')
      ? { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }
      : { models: [{ name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent'] }] };
    return { ok: true, status: 200, text: async () => JSON.stringify(corps) };
  };
  return { appels, retirer: () => { globalThis.fetch = avant; } };
}

function poserLocalStorage(stockage) {
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: stockage, configurable: true, writable: true });
  return () => {
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant);
    else delete globalThis.localStorage;
  };
}

const ARGS = (stockage) => {
  const p = reglagesDe(lireReglages(stockage), 'gemini');
  return { cle: p.cle, methode: p.methode, modele: p.modele };
};

async function cinqAppels(f, acces) {
  const resultats = {};
  const historique = [{ role: 'moi', texte: 'bonjour' }];
  for (const [nom, appel] of [
    ['envoyer', () => f.envoyer({ ...acces, historique })],
    ['generer', () => f.generer({ ...acces, entree: 'bonjour', instructions: 'JSON' })],
    ['converser', () => f.converser({ ...acces, historique, actions: [], executer: async () => ({}) })],
    ['sonder', () => f.sonder({ ...acces })],
  ]) {
    try { await appel(); resultats[nom] = { ok: true }; } catch (e) { resultats[nom] = { ok: false, e }; }
  }
  resultats.tester = await f.tester({ cle: acces.cle });
  return resultats;
}

// ---------------------------------------------------------------------------- préférence
test('mode local : clé propre, distincte des réglages du fournisseur', () => {
  assert.equal(CLE_MODE_LOCAL, 'naissance-ia.mode-local.v1');
  assert.notEqual(CLE_MODE_LOCAL, CLE_STOCKAGE);
  assert.equal(CLE_STOCKAGE, 'naissance-ia.reglages.v1');
});

test('mode local : désactivé par défaut (stockage vide, absent, illisible, valeurs invalides)', () => {
  assert.equal(lireModeLocal(stockageMemoire()), false);
  assert.equal(lireModeLocal(null), false);
  assert.equal(lireModeLocal(undefined), false, 'stockage absent dans Node (localStorage indisponible)');
  for (const brut of ['', '{', 'true', '"actif"', 'null', '[]', '[true]', '{"actif":"oui"}', '{"actif":1}', '{"actif":"true"}', '{"actif":false}', '{}', '{"actif":true,"autre":1}', '{"Actif":true}']) {
    assert.equal(lireModeLocal(stockageMemoire({ [CLE_MODE_LOCAL]: brut })), false, brut);
  }
  const casse = { getItem: () => { throw new Error('stockage indisponible'); }, setItem: () => { throw new Error('plein'); } };
  assert.equal(lireModeLocal(casse), false);
  assert.equal(ecrireModeLocal(true, casse), false);
  assert.equal(ecrireModeLocal(true, null), false);
  // La valeur stockée sous une AUTRE clé n'active rien.
  assert.equal(lireModeLocal(stockageMemoire({ [CLE_STOCKAGE]: '{"actif":true}' })), false);
});

test('mode local : true seulement après ecrireModeLocal(true) ; ecrireModeLocal(false) le désactive', () => {
  const s = stockageMemoire();
  assert.equal(lireModeLocal(s), false);
  assert.equal(ecrireModeLocal(true, s), true);
  assert.equal(s.brut(CLE_MODE_LOCAL), '{"actif":true}');
  assert.equal(lireModeLocal(s), true);
  assert.equal(ecrireModeLocal(false, s), true);
  assert.equal(s.brut(CLE_MODE_LOCAL), '{"actif":false}');
  assert.equal(lireModeLocal(s), false);
  // Toute autre valeur que true écrit {"actif":false} (aucune activation par une valeur « vraie » quelconque).
  for (const v of ['oui', 1, {}, 'true', undefined, null]) {
    assert.equal(ecrireModeLocal(v, s), true);
    assert.equal(s.brut(CLE_MODE_LOCAL), '{"actif":false}');
    assert.equal(lireModeLocal(s), false);
  }
});

test('mode local : ecrireModeLocal n\'écrit que sa clé ; les réglages du fournisseur restent identiques octet pour octet', () => {
  const s = avecCle(stockageMemoire());
  const avant = s.brut(CLE_STOCKAGE);
  assert.ok(avant && avant.includes('AQ.cle-essai'));
  ecrireModeLocal(true, s);
  assert.equal(s.brut(CLE_STOCKAGE), avant);
  assert.deepEqual(s.cles(), [CLE_MODE_LOCAL, CLE_STOCKAGE].sort());
  ecrireModeLocal(false, s);
  assert.equal(s.brut(CLE_STOCKAGE), avant);
  assert.deepEqual(s.cles(), [CLE_MODE_LOCAL, CLE_STOCKAGE].sort());
  // Lire ne change rien non plus.
  lireModeLocal(s);
  assert.equal(s.brut(CLE_STOCKAGE), avant);
});

test('mode local : texte d\'état, erreur « reglage » et textes fixes', () => {
  assert.equal(texteEtatModeLocal(true), 'Mode local actif');
  assert.equal(texteEtatModeLocal(false), 'Mode local inactif');
  assert.equal(texteEtatModeLocal('oui'), 'Mode local inactif');
  // erreurModeLocal() de mode-local.js rend DIRECTEMENT une ErreurFournisseur de code « reglage ».
  const e = erreurModeLocal();
  assert.ok(e instanceof ErreurFournisseur);
  assert.equal(e.name, 'ErreurFournisseur');
  assert.equal(e.code, 'reglage');
  assert.ok(CODES_REGLAGES.has(e.code), 'renvoi vers les Réglages');
  assert.equal(e.message, MESSAGE_MOTEUR_COUPE);
  assert.equal(e.detail, '');
  assert.notEqual(erreurModeLocal(), e, 'une erreur neuve à chaque appel');
  assert.equal(modeLocal.erreurModeLocal, erreurModeLocal);
  // Passée dans la couche commune, elle reste telle quelle (ni « inconnu » ni « Erreur inattendue. »).
  assert.equal(enErreurFournisseur(e), e);
  assert.equal(enErreurFournisseur(e).code, 'reglage');
  assert.equal(enErreurFournisseur(e).message, MESSAGE_MOTEUR_COUPE);
  // Le registre n'exporte pas de doublon homonyme.
  assert.equal('erreurModeLocal' in registre, false, 'aucun erreurModeLocal exporté par le registre');
  assert.equal(REPONSE_SANS_VOIE_LOCALE, "Je n'ai pas de réponse locale à ce message.");
  assert.equal(MESSAGE_MOTEUR_COUPE, "Mode local : aucun moteur externe n'est appelé. Décoche la case du mode local dans les Réglages pour le réutiliser.");
  assert.equal(MESSAGE_COURS_REFUSE, "Sans moteur externe, je ne peux pas décomposer ce cours : rien n'a été appelé, rien n'a été retenu.");
  assert.equal(MESSAGE_TEST_BLOQUE, "Test de clé bloqué : le mode local est en cours, aucun appel au fournisseur. Rien n'a été enregistré.");
  assert.equal(MESSAGE_RANGEMENT_BLOQUE, "mode local en cours : aucun moteur externe n'est appelé, rien n'a été rangé.");
  assert.equal(MESSAGE_PLUS_FORT_REFUSE, "Sans moteur externe, je ne peux pas demander à un modèle plus fort : rien n'a été appelé.");
});

// ---------------------------------------------------------------------------- coupure à la source
test('registre : mode local inactif → le vrai fournisseur, inchangé (identité du module)', () => {
  const s = stockageMemoire();
  assert.equal(obtenirFournisseur('gemini', s), gemini);
  assert.equal(obtenirFournisseur('inconnu', s), gemini);
  assert.equal(FOURNISSEUR_PAR_DEFAUT, 'gemini');
  assert.deepEqual(listerFournisseurs(), [{ id: gemini.id, nom: gemini.nom }]);
});

test('registre : mode local actif → fournisseur coupé, mêmes id, nom, lienCle, aideCle, ordonnerModeles', () => {
  const s = stockageMemoire();
  ecrireModeLocal(true, s);
  const f = obtenirFournisseur('gemini', s);
  assert.notEqual(f, gemini);
  for (const k of ['id', 'nom', 'lienCle', 'aideCle', 'ordonnerModeles']) assert.equal(f[k], gemini[k], k);
  for (const k of ['tester', 'envoyer', 'generer', 'converser', 'sonder']) {
    assert.equal(typeof f[k], 'function', k);
    assert.notEqual(f[k], gemini[k], k);
  }
  assert.ok(Object.isFrozen(f));
  assert.deepEqual(listerFournisseurs(), [{ id: gemini.id, nom: gemini.nom }], 'la liste ne change pas');
});

test('registre : clé et modèle enregistrés + mode actif → 0 appel fetch pour envoyer/generer/converser/sonder/tester, code « reglage » ; inactif → fetch atteint de nouveau', async () => {
  const s = avecCle(stockageMemoire());
  const reglagesAvant = s.brut(CLE_STOCKAGE);
  const espion = poserEspion();
  try {
    ecrireModeLocal(true, s);
    const f = obtenirFournisseur('gemini', s);
    const r = await cinqAppels(f, ARGS(s));
    for (const nom of ['envoyer', 'generer', 'converser', 'sonder']) {
      assert.equal(r[nom].ok, false, nom);
      assert.ok(r[nom].e instanceof ErreurFournisseur, nom);
      assert.equal(r[nom].e.code, 'reglage', nom);
      assert.equal(r[nom].e.message, MESSAGE_MOTEUR_COUPE, nom);
    }
    assert.equal(r.tester.ok, false);
    assert.deepEqual(r.tester.essais, []);
    assert.equal(r.tester.erreur.code, 'reglage');
    assert.equal(espion.appels.length, 0, 'aucun appel réseau en mode local');
    assert.equal(s.brut(CLE_STOCKAGE), reglagesAvant, 'réglages du fournisseur intacts');

    // Décocher : le vrai fournisseur revient, intact, et le réseau est de nouveau atteint.
    ecrireModeLocal(false, s);
    const vrai = obtenirFournisseur('gemini', s);
    assert.equal(vrai, gemini);
    const texte = await vrai.envoyer({ ...ARGS(s), historique: [{ role: 'moi', texte: 'bonjour' }] });
    assert.equal(texte, '{"ok":true}');
    assert.ok(espion.appels.length >= 1, 'au moins un appel espionné après désactivation');
    assert.match(espion.appels[0].url, /generativelanguage\.googleapis\.com/);
    const avantTester = espion.appels.length;
    const t = await vrai.tester({ cle: 'AQ.cle-essai' });
    assert.equal(t.ok, true);
    assert.ok(espion.appels.length > avantTester);

    // Recocher : de nouveau coupé, sans aucun nouvel appel.
    ecrireModeLocal(true, s);
    const n = espion.appels.length;
    await assert.rejects(obtenirFournisseur('gemini', s).envoyer({ ...ARGS(s), historique: [{ role: 'moi', texte: 'x' }] }), (e) => e.code === 'reglage');
    assert.equal(espion.appels.length, n);
  } finally {
    espion.retirer();
  }
});

test('registre : même preuve SANS clé enregistrée (0 appel en mode local)', async () => {
  const s = stockageMemoire();
  const espion = poserEspion();
  try {
    ecrireModeLocal(true, s);
    const f = obtenirFournisseur(lireReglages(s).fournisseur, s);
    const r = await cinqAppels(f, { cle: undefined, methode: undefined, modele: undefined });
    for (const nom of ['envoyer', 'generer', 'converser', 'sonder']) {
      assert.equal(r[nom].ok, false, nom);
      assert.equal(r[nom].e.code, 'reglage', nom);
    }
    assert.equal(r.tester.ok, false);
    assert.equal(r.tester.erreur.code, 'reglage');
    assert.deepEqual(r.tester.essais, []);
    // Même avec une clé fournie directement à tester (champ de saisie) : aucun appel.
    const t = await f.tester({ cle: 'AQ.cle-essai' });
    assert.equal(t.erreur.code, 'reglage');
    assert.equal(espion.appels.length, 0);
    assert.equal(s.brut(CLE_STOCKAGE), null, 'aucun réglage du fournisseur écrit');
  } finally {
    espion.retirer();
  }
});

test('registre : sans paramètre, la préférence est lue dans localStorage à chaque appel', async () => {
  const s = avecCle(stockageMemoire());
  const restaurer = poserLocalStorage(s);
  const espion = poserEspion();
  try {
    assert.equal(lireModeLocal(), false);
    assert.equal(obtenirFournisseur('gemini'), gemini);
    assert.equal(ecrireModeLocal(true), true);
    assert.equal(s.brut(CLE_MODE_LOCAL), '{"actif":true}');
    const f = obtenirFournisseur('gemini');
    assert.notEqual(f, gemini);
    await assert.rejects(f.generer({ ...ARGS(s), entree: 'x' }), (e) => e.code === 'reglage');
    assert.equal(espion.appels.length, 0);
    ecrireModeLocal(false);
    assert.equal(obtenirFournisseur('gemini'), gemini);
  } finally {
    espion.retirer();
    restaurer();
  }
});

test('fiabilité : executerAvecRepli et verifierModeles sur le fournisseur coupé → 0 appel, aucune relance ni repli', async () => {
  for (const s of [avecCle(stockageMemoire()), stockageMemoire()]) {
    const espion = poserEspion();
    try {
      ecrireModeLocal(true, s);
      const f = obtenirFournisseur('gemini', s);
      const acces = ARGS(s);
      const modeles = [...MODELES];
      const prefere = 'models/gemini-2.5-flash';
      let taches = 0;
      let attentes = 0;
      const etapes = [];
      await assert.rejects(
        executerAvecRepli({
          fournisseur: f, prefere, modeles, stockage: s,
          attendre: async () => { attentes += 1; },
          surEtape: (e) => etapes.push(e),
          tache: async (m) => { taches += 1; return f.converser({ ...acces, modele: m, historique: [{ role: 'moi', texte: 'x' }] }); },
        }),
        (e) => e instanceof ErreurFournisseur && e.code === 'reglage',
      );
      assert.equal(taches, 1, 'une seule tentative : arrêt immédiat');
      assert.equal(attentes, 0, 'aucune relance');
      assert.deepEqual(etapes.map((e) => e.type), ['essai'], 'aucun repli de modèle');
      assert.equal(s.brut(CLE_SANTE), null, 'aucun modèle pénalisé');

      const verif = await verifierModeles({ fournisseur: f, acces, prefere, modeles, stockage: s });
      assert.equal(verif.modele, null);
      assert.equal(verif.essais.length, 1);
      assert.equal(verif.erreur.code, 'reglage');
      assert.equal(s.brut(CLE_SANTE), null);
      assert.equal(espion.appels.length, 0);
    } finally {
      espion.retirer();
    }
  }
});

// ---------------------------------------------------------------------------- gardes statiques
test('garde statique : gemini.js importé uniquement par app/fournisseurs/registre.js', () => {
  const importeurs = [];
  for (const p of fichiersJs(join(RACINE, 'app'))) {
    const src = readFileSync(p, 'utf8');
    if (/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](?:[^'"]*\/)?gemini\.js['"]/.test(src)) importeurs.push(rel(p));
  }
  assert.deepEqual(importeurs, ['app/fournisseurs/registre.js']);
});

test('garde statique : mode-local.js sans fetch, sans import du registre ; le registre lit la préférence', () => {
  const src = readFileSync(join(RACINE, 'app', 'reglages', 'mode-local.js'), 'utf8');
  assert.doesNotMatch(src, /fetch/);
  assert.doesNotMatch(src, /(?:\bfrom\s*|\bimport\s*\(?\s*)['"][^'"]*registre[^'"]*['"]/);
  assert.doesNotMatch(src, /XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
  assert.doesNotMatch(src, /(?:\bfrom\s*|\bimport\s*\(?\s*)['"][^'"]*gemini[^'"]*['"]/);
  // Seul import permis : la classe commune des erreurs ('../fournisseurs/erreurs.js', qui n'importe rien).
  const imports = [...src.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual(imports, ['../fournisseurs/erreurs.js'], 'seul import permis : erreurs.js');
  assert.doesNotMatch(src, /\bimport\s*\(/, 'aucun import dynamique');
  assert.equal(src.split('\n').filter((l) => /^\s*import\b/.test(l)).length, 1);
  const erreurs = readFileSync(join(RACINE, 'app', 'fournisseurs', 'erreurs.js'), 'utf8');
  assert.doesNotMatch(erreurs, /^\s*import\b|\bimport\s*\(/m, 'erreurs.js n\'importe rien');
  assert.doesNotMatch(erreurs, /fetch/);
  assert.doesNotMatch(src, /\bgemini\b|anthropic|openai|generativelanguage|api[_-]?key/i, 'aucune mention de modèle externe');
  const registre = readFileSync(join(RACINE, 'app', 'fournisseurs', 'registre.js'), 'utf8');
  assert.match(registre, /import \{ lireModeLocal, erreurModeLocal \} from '\.\.\/reglages\/mode-local\.js'/);
  assert.doesNotMatch(registre, /export\s+(?:async\s+)?function\s+erreurModeLocal\b/, 'aucun doublon homonyme');
  assert.doesNotMatch(registre, /fetch\s*\(/);
});

test('garde statique : aucune table, aucune migration, aucune écriture IndexedDB dans les fichiers du jalon', () => {
  for (const f of [['app', 'reglages', 'mode-local.js'], ['app', 'fournisseurs', 'registre.js']]) {
    const src = readFileSync(join(RACINE, ...f), 'utf8');
    assert.doesNotMatch(src, /indexedDB|createObjectStore|SCHEMA|BASE\b|TABLES/, f.join('/'));
  }
});
