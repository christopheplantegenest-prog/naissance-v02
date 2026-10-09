// === DEBUT_TEST_CAPTURE_ENONCE ===
// v0.62.0 — ÉTAPE 6 : POINT DE CAPTURE d'un énoncé envoyé en réponse à une trace (décision ChatGPT,
// 03/10/2026). Invariant testé : si une référence explicite existe, {idTrace, texte} est TENTÉ en
// persistance AVANT que n'importe quel chemin de traitement puisse consommer le message ; le
// traitement garde exactement son comportement antérieur ; un échec de persistance ne bloque jamais
// la conversation et n'est jamais un faux succès. main.js (non testable : aucun export, couplage DOM)
// ne fait qu'appeler traiterTourAvecEnonce() de pont.js -- vérifié statiquement ci-dessous.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  capturerEnonceAvantTraitement, traiterTourAvecEnonce, appliquerAbstentionSiReferenceIgnoree, referenceTraceCapturable,
  MESSAGE_REFERENCE_IGNOREE, MESSAGE_ENONCE_NON_CONSERVE,
} from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerEnonceSurTrace } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const MAIN_BRUT = fs.readFileSync(path.join(ICI, '..', 'app', 'main.js'), 'utf8');
// Code seul : les lignes de commentaire pur (// ...) sont retirées, elles citent volontairement ces noms.
const MAIN = MAIN_BRUT.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

const REF = { idTrace: 'trace-1' };
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});

// Simule main.js : capture puis traitement ; le journal enregistre l'ORDRE réel des appels.
function banc({ resultat = { texte: 'ok' }, erreurTraitement = null, erreurCapture = null } = {}) {
  const journal = [];
  const enonces = [];
  const deps = {
    enregistrerEnonce: async (idTrace, texte) => {
      journal.push('capture:debut');
      if (erreurCapture) { journal.push('capture:echec'); throw erreurCapture; }
      enonces.push({ idTrace, texte });
      journal.push('capture:fin');
    },
    traiter: async () => {
      journal.push('traitement');
      if (erreurTraitement) throw erreurTraitement;
      return typeof resultat === 'function' ? resultat() : resultat;
    },
  };
  return { journal, enonces, deps };
}

// --- A. référence exploitable ------------------------------------------------------------------
test('A. referenceTraceCapturable : seulement {idTrace} chaîne non vide', () => {
  assert.equal(referenceTraceCapturable(REF), true);
  for (const r of [null, undefined, {}, { idTrace: '' }, { idTrace: '  ' }, { idTrace: 5 }, 'trace-1', 0]) {
    assert.equal(referenceTraceCapturable(r), false, JSON.stringify(r));
  }
});

// --- B. ORDRE : capture AVANT traitement, pour chaque famille de chemin ------------------------
const CHEMINS = [
  ['marqueur Action: (enseignement)', { texte: 'Il me faut, après « Action : »…' }],
  ['marqueur Transformation:', { texte: 'Il me faut au moins deux exemples' }],
  ['marqueur Cours:', { texte: 'Il me faut le contenu du cours' }],
  ['action enseignée unique', { texte: 'Résultat', local: true, idTrace: 'trace-9' }],
  ['action ambiguë (abstention locale)', { texte: 'Je ne peux pas répondre localement : ambigu' }],
  ['rejeu autonome', { texte: 'Résultat', local: true, idTrace: 'trace-10' }],
  ['pont COMPRIS (laboratoire)', { texte: 'réponse', local: true, laboratoire: true, idExperience: 'exp-1' }],
  ['tentative PARTIEL/INCOMPRIS + LLM', { texte: 'réponse LLM', idExperience: 'exp-2' }],
  ['LLM direct (aucune expérience)', { texte: 'Ah, bien sûr ! Dans mes souvenirs…' }],
];
for (const [nom, resultat] of CHEMINS) {
  test(`B. ${nom} : exactement 1 capture, AVANT le traitement, texte exact, résultat transmis sans changement`, async () => {
    const texte = 'Non, c\'était plutôt une déduction.';
    const b = banc({ resultat });
    const sortie = await traiterTourAvecEnonce(texte, REF, b.deps);
    assert.deepEqual(b.journal, ['capture:debut', 'capture:fin', 'traitement']);
    assert.deepEqual(b.enonces, [{ idTrace: 'trace-1', texte }]);
    // Le résultat du traitement garde toutes ses propriétés (aucune perte, aucun remplacement du texte).
    for (const [k, v] of Object.entries(resultat)) assert.deepEqual(sortie[k], v, `propriété ${k}`);
    assert.equal(sortie.texte, resultat.texte);
  });
}

// --- C. SANS référence : comportement strictement antérieur ------------------------------------
test('C. sans référence (null, undefined, invalide) : aucune capture, traitement seul, résultat strictement identique', async () => {
  for (const ref of [null, undefined, {}, { idTrace: '' }, { idTrace: 3 }]) {
    const resultat = { texte: 'x' };
    const b = banc({ resultat });
    // eslint-disable-next-line no-await-in-loop
    const sortie = await traiterTourAvecEnonce('bonjour', ref, b.deps);
    assert.deepEqual(b.journal, ['traitement'], JSON.stringify(ref));
    assert.deepEqual(b.enonces, []);
    // Comportement historique de l'abstention : identique à l'appel direct à l'ancienne enveloppe.
    assert.deepEqual(sortie, appliquerAbstentionSiReferenceIgnoree(resultat, ref));
  }
});

// --- D. ÉCHEC DE CAPTURE : non bloquant, note sobre, jamais de faux succès ---------------------
test('D. échec de persistance : le traitement a lieu une fois, la note sobre est ajoutée, aucune exception', async () => {
  const b = banc({ erreurCapture: new Error('disque plein'), resultat: { texte: 'réponse', actions: ['déjà là'] } });
  const sortie = await traiterTourAvecEnonce('suite', REF, b.deps);
  assert.deepEqual(b.journal, ['capture:debut', 'capture:echec', 'traitement']);
  assert.equal(sortie.texte, 'réponse');
  assert.deepEqual(sortie.actions, ['déjà là', MESSAGE_ENONCE_NON_CONSERVE]);
  assert.ok(!sortie.actions.includes(MESSAGE_REFERENCE_IGNOREE), 'pas de seconde alerte (ancien message)');
});

test('D2. échec de capture ET expérience créée : la note d\'échec est quand même affichée (l\'énoncé n\'est pas conservé)', async () => {
  const b = banc({ erreurCapture: new Error('x'), resultat: { texte: 'r', idExperience: 'exp-3' } });
  const sortie = await traiterTourAvecEnonce('suite', REF, b.deps);
  assert.deepEqual(sortie.actions, [MESSAGE_ENONCE_NON_CONSERVE]);
  assert.equal(sortie.idExperience, 'exp-3');
});

test('D3. capturerEnonceAvantTraitement ne lève jamais : état "echec" avec la raison (même sans dépendance)', async () => {
  const r1 = await capturerEnonceAvantTraitement('x', REF, { enregistrerEnonce: async () => { throw new Error('boum'); } });
  assert.deepEqual(r1, { etat: 'echec', raison: 'boum' });
  const r2 = await capturerEnonceAvantTraitement('x', REF, {});
  assert.equal(r2.etat, 'echec');
  const r3 = await capturerEnonceAvantTraitement('x', REF, { enregistrerEnonce: async () => { throw 'texte brut'; } });
  assert.deepEqual(r3, { etat: 'echec', raison: 'texte brut' });
});

test('D4. échec de capture et résultat non objet (chaîne) : traverse sans casse', async () => {
  const b = banc({ erreurCapture: new Error('x'), resultat: 'juste une chaîne' });
  assert.equal(await traiterTourAvecEnonce('suite', REF, b.deps), 'juste une chaîne');
});

// --- E. ERREUR DE TRAITEMENT : capture déjà faite, erreur propagée telle quelle ----------------
test('E. le traitement lève (fournisseur en erreur, annulation) : l\'énoncé reste conservé, la même erreur se propage', async () => {
  const erreur = Object.assign(new Error('gemini ne répond pas'), { code: 'annule', actions: ['fait avant'] });
  const b = banc({ erreurTraitement: erreur });
  await assert.rejects(() => traiterTourAvecEnonce('suite', REF, b.deps), (e) => e === erreur);
  assert.deepEqual(b.enonces, [{ idTrace: 'trace-1', texte: 'suite' }]);
  assert.deepEqual(b.journal, ['capture:debut', 'capture:fin', 'traitement']);
  assert.deepEqual(erreur.actions, ['fait avant'], 'l\'erreur n\'est pas modifiée');
});

// --- F. RENVOI : chaque soumission est un nouvel événement -------------------------------------
test('F. même texte + même trace soumis deux fois = deux captures (aucun dédoublonnage)', async () => {
  const b = banc();
  await traiterTourAvecEnonce('même texte', REF, b.deps);
  await traiterTourAvecEnonce('même texte', REF, b.deps);
  assert.equal(b.enonces.length, 2);
  assert.deepEqual(b.enonces[0], b.enonces[1]);
});

// --- G. ENVELOPPE DE SORTIE (Q5) ----------------------------------------------------------------
test('G1. énoncé conservé, aucune expérience : AUCUNE alerte (l\'ancien message serait mensonger)', () => {
  const r = appliquerAbstentionSiReferenceIgnoree({ texte: 'x' }, REF, 'conserve');
  assert.deepEqual(r, { texte: 'x' });
});
test('G2. historique intact sans 3e argument ou avec "aucune" : message d\'abstention si aucune expérience', () => {
  for (const etat of [undefined, 'aucune']) {
    const r = appliquerAbstentionSiReferenceIgnoree({ texte: 'x' }, REF, etat);
    assert.deepEqual(r.actions, [MESSAGE_REFERENCE_IGNOREE]);
  }
  assert.deepEqual(appliquerAbstentionSiReferenceIgnoree({ texte: 'x', idExperience: 'e' }, REF), { texte: 'x', idExperience: 'e' });
  assert.deepEqual(appliquerAbstentionSiReferenceIgnoree({ texte: 'x' }, null), { texte: 'x' });
});
test('G3. la conservation normale reste silencieuse sur tous les chemins (aucune note ajoutée)', async () => {
  for (const [, resultat] of CHEMINS) {
    const b = banc({ resultat });
    // eslint-disable-next-line no-await-in-loop
    const sortie = await traiterTourAvecEnonce('suite', REF, b.deps);
    assert.deepEqual(sortie.actions, resultat.actions, 'aucune note supplémentaire en cas de succès');
  }
});

// --- H. BOUT EN BOUT avec le vrai écran du langage et un vrai magasin --------------------------
function monterEcran(magasin) {
  return monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
}
test('H1. bout en bout : l\'énoncé est persisté AVANT le traitement et relisible, une seule fois', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monterEcran(magasin);
  let vuPendantTraitement = null;
  const sortie = await traiterTourAvecEnonce('Non, c\'était plutôt une déduction.', REF, {
    enregistrerEnonce: (idTrace, texte) => ecran.enregistrerEnonceSurTrace(idTrace, texte),
    traiter: async () => { vuPendantTraitement = await magasin.lireTout('enonces'); return { texte: 'hors sujet' }; },
  });
  assert.equal(vuPendantTraitement.length, 1, 'déjà persisté quand le traitement démarre');
  assert.equal(vuPendantTraitement[0].texte, 'Non, c\'était plutôt une déduction.');
  assert.equal(vuPendantTraitement[0].idTrace, 'trace-1');
  assert.deepEqual(sortie, { texte: 'hors sujet' });
  assert.equal((await magasin.lireTout('enonces')).length, 1);
});
test('H2. bout en bout : un magasin qui refuse l\'écriture de "enonces" -> note sobre, traitement unique', async () => {
  const magasin = magasinMemoireVive();
  const ecrire = magasin.ecrire.bind(magasin);
  magasin.ecrire = async (table, objet) => { if (table === 'enonces') throw new Error('quota dépassé'); return ecrire(table, objet); };
  const ecran = monterEcran(magasin);
  let appels = 0;
  const sortie = await traiterTourAvecEnonce('suite', REF, {
    enregistrerEnonce: (idTrace, texte) => ecran.enregistrerEnonceSurTrace(idTrace, texte),
    traiter: async () => { appels += 1; return { texte: 'ok' }; },
  });
  assert.equal(appels, 1);
  assert.deepEqual(sortie.actions, [MESSAGE_ENONCE_NON_CONSERVE]);
  assert.deepEqual(await magasin.lireTout('enonces'), []);
});
test('H3. la primitive directe et la voie écran produisent la même forme d\'objet', async () => {
  const magasin = magasinMemoireVive();
  const ecran = monterEcran(magasin);
  const viaEcran = await ecran.enregistrerEnonceSurTrace('t1', 'x');
  const direct = await enregistrerEnonceSurTrace(magasin, { idTrace: 't1', texte: 'x', origine: 'interface' });
  assert.deepEqual(Object.keys(viaEcran).sort(), Object.keys(direct).sort());
});

// --- I. CÂBLAGE DE main.js (statique : main.js n'a aucun export) --------------------------------
test('I1. main.js : traiterTour() n\'est appelé qu\'UNE fois (dans la fermeture passée à traiterTourAvecEnonce) et jamais directement', () => {
  const appels = MAIN.match(/traiterTour\(/g) || [];
  // 1 définition « async function traiterTour( », 1 appel dans la fermeture, 0 autre.
  assert.equal(appels.length, 2, 'définition + une seule fermeture');
  assert.match(MAIN, /async function traiterTour\(texte, options, referenceTrace\)/);
  assert.match(MAIN, /traiter: \(\) => traiterTour\(texte, options, referenceTrace\)/);
});
test('I2. main.js : le wrapper repondre passe par traiterTourAvecEnonce avec le MÊME texte, et délègue à ecranLangage', () => {
  assert.match(MAIN, /import \{[^}]*traiterTourAvecEnonce[^}]*\} from '\.\/langage\/pont\.js'/);
  assert.match(MAIN, /const resultat = await traiterTourAvecEnonce\(texte, referenceTrace, \{/); // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le résultat est joint au contexte du tour (suivi.joindre) avant d'être rendu
  assert.match(MAIN, /const joint = suivi\.joindre\(resultat\);/); assert.match(MAIN, /return joint;/); // MISE À JOUR DÉLIBÉRÉE v0.63.81 (J-B) : le résultat joint est rendu tel quel, sauf si le message portait une référence d'ÉMISSION (geste « Répondre » sur une ligne émise) : la réception déclarée lui est alors adjointe (clé reception), rien d'autre
  assert.match(MAIN, /enregistrerEnonce: \(idTrace, texteEnonce\) => ecranLangage\.enregistrerEnonceSurTrace\(idTrace, texteEnonce\)/);
  assert.ok(!/await traiterTour\(/.test(MAIN), 'aucun appel direct à traiterTour');
  assert.ok(!/=\s*appliquerAbstentionSiReferenceIgnoree\(/.test(MAIN) && !/return appliquerAbstentionSiReferenceIgnoree\(/.test(MAIN), 'main.js n\'applique plus l\'enveloppe directement');
});
test('I3. main.js : esprit.repondre n\'est atteint que depuis traiterTour (donc après la capture)', () => {
  const apresDef = MAIN.slice(MAIN.indexOf('async function traiterTour('));
  const avantWrapper = apresDef.slice(0, apresDef.indexOf('const conversation = monterConversation('));
  assert.match(avantWrapper, /esprit\.repondre\(texte, options\)/);
  const horsTour = MAIN.slice(0, MAIN.indexOf('async function traiterTour(')) + apresDef.slice(apresDef.indexOf('const conversation = monterConversation('));
  assert.ok(!/esprit\.repondre\(/.test(horsTour), 'aucun autre appel à esprit.repondre hors de traiterTour');
});
// === FIN_TEST_CAPTURE_ENONCE ===
