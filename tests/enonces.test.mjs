// === DEBUT_TEST_ENONCES ===
// v0.62.0 — ÉTAPE 6 : « CONSERVATION BRUTE D'UN ÉNONCÉ ENVOYÉ EN RÉPONSE À UNE TRACE » (décision
// ChatGPT, 03/10/2026). Teste la table 'enonces' et la primitive enregistrerEnonceSurTrace() :
// un fait brut {id, idTrace, texte, horodatage, origine}, sans valence ni interprétation, sans
// consommateur. Le point de capture (main.js / pont.js) est testé dans capture-enonce.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  magasinMemoireVive, enregistrerEnonceSurTrace, enregistrerExperience, enregistrerActe, enregistrerTrace,
  TABLES, CLE, VERSION_BASE,
} from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { apresNouveauVecu } from '../app/langage/vecu.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
function monterEcran(magasin = magasinMemoireVive()) {
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  return { magasin, ecran };
}
async function traceDeTest(magasin, voie = 'action') {
  return enregistrerTrace(magasin, {
    capacite: 'confrontation', voie, argumentsUtilises: {}, provenanceArguments: {}, resultat: {},
    contexte: voie === 'composition' ? null : { texteBrut: 'x', tokens: [] },
  });
}
async function comptes(magasin) {
  return Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, (await magasin.lireTout(t)).length])));
}

// --- A. schéma ---------------------------------------------------------------------------------
// MISE À JOUR DÉLIBÉRÉE (v0.62.4) : VERSION_BASE passe à 13 (table 'observationsComposition' ajoutée).
// MISE À JOUR DÉLIBÉRÉE (v0.63.0) : VERSION_BASE passe à 14 (table 'observationsLangage' ajoutée).
// MISE À JOUR DÉLIBÉRÉE (v0.63.16) : VERSION_BASE passe à 15 (table 'observationsPossibilites' ajoutée).
test('A. table "enonces" déclarée, clé "id", VERSION_BASE 15', () => {
  assert.ok(TABLES.includes('enonces'));
  assert.equal(CLE.enonces, 'id');
  assert.equal(VERSION_BASE, 18); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
});

// --- B. forme de l'objet -----------------------------------------------------------------------
test('B. objet exactement {id, idTrace, texte, horodatage, origine}, origine "interface" par défaut', async () => {
  const magasin = magasinMemoireVive();
  const trace = await traceDeTest(magasin);
  const e = await enregistrerEnonceSurTrace(magasin, { idTrace: trace.id, texte: 'Non, c\'était plutôt une déduction.' });
  assert.deepEqual(Object.keys(e).sort(), ['horodatage', 'id', 'idTrace', 'origine', 'texte']);
  assert.equal(e.idTrace, trace.id);
  assert.equal(e.origine, 'interface');
  assert.ok(typeof e.id === 'string' && e.id.length > 0 && e.id !== trace.id);
  assert.ok(!Number.isNaN(Date.parse(e.horodatage)));
  assert.deepEqual(await magasin.lireTout('enonces'), [e]);
});

// --- C. texte conservé à l'identique -----------------------------------------------------------
test('C. texte conservé OCTET POUR OCTET (espaces, guillemets, accents, marqueurs) -- aucun trim ni normalisation', async () => {
  const magasin = magasinMemoireVive();
  const trace = await traceDeTest(magasin);
  for (const texte of ['  Action: quand je dis « Le ciel est bleu », réponds « déduction ».  ', 'Cours : x\ny', 'Éa  é\t?', '🙂 ok']) {
    // eslint-disable-next-line no-await-in-loop
    const e = await enregistrerEnonceSurTrace(magasin, { idTrace: trace.id, texte });
    assert.equal(e.texte, texte);
  }
});

// --- D. validations ----------------------------------------------------------------------------
test('D. idTrace invalide refusé (absent, vide, blanc, non-chaîne) -- rien n\'est écrit', async () => {
  const magasin = magasinMemoireVive();
  for (const idTrace of [undefined, null, '', '   ', 5, {}, ['a']]) {
    // eslint-disable-next-line no-await-in-loop
    await assert.rejects(() => enregistrerEnonceSurTrace(magasin, { idTrace, texte: 'x' }), /idTrace/);
  }
  await assert.rejects(() => enregistrerEnonceSurTrace(magasin), /idTrace/);
  assert.deepEqual(await magasin.lireTout('enonces'), []);
});

test('E. texte invalide refusé (absent, vide, blanc, non-chaîne) -- rien n\'est écrit', async () => {
  const magasin = magasinMemoireVive();
  for (const texte of [undefined, null, '', '   \n\t', 5, {}]) {
    // eslint-disable-next-line no-await-in-loop
    await assert.rejects(() => enregistrerEnonceSurTrace(magasin, { idTrace: 't1', texte }), /texte/);
  }
  assert.deepEqual(await magasin.lireTout('enonces'), []);
});

test('F. origine fournie doit être une chaîne non vide', async () => {
  const magasin = magasinMemoireVive();
  for (const origine of ['', '  ', 3, null]) {
    // eslint-disable-next-line no-await-in-loop
    await assert.rejects(() => enregistrerEnonceSurTrace(magasin, { idTrace: 't1', texte: 'x', origine }), /origine/);
  }
  const ok = await enregistrerEnonceSurTrace(magasin, { idTrace: 't1', texte: 'x', origine: 'autre' });
  assert.equal(ok.origine, 'autre');
});

test('G. aucune vérification que la trace existe (référence honorée même si introuvable)', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerEnonceSurTrace(magasin, { idTrace: 'trace-qui-n-existe-pas', texte: 'x' });
  assert.equal(e.idTrace, 'trace-qui-n-existe-pas');
  assert.equal((await magasin.lireTout('enonces')).length, 1);
});

test('H. l\'horodatage ne peut pas être fourni par l\'appelant', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerEnonceSurTrace(magasin, { idTrace: 't1', texte: 'x', horodatage: '1999-01-01T00:00:00.000Z' });
  assert.notEqual(e.horodatage, '1999-01-01T00:00:00.000Z');
});

// --- I. aucun dédoublonnage --------------------------------------------------------------------
test('I. même texte + même trace envoyés deux fois = deux énoncés distincts (ids distincts)', async () => {
  const magasin = magasinMemoireVive();
  const trace = await traceDeTest(magasin);
  const a = await enregistrerEnonceSurTrace(magasin, { idTrace: trace.id, texte: 'même texte' });
  const b = await enregistrerEnonceSurTrace(magasin, { idTrace: trace.id, texte: 'même texte' });
  assert.notEqual(a.id, b.id);
  assert.equal((await magasin.lireTout('enonces')).length, 2);
});

test('J. rejeu, composition et action sont traités à l\'identique (la capture ne dépend que d\'idTrace)', async () => {
  const magasin = magasinMemoireVive();
  for (const voie of ['action', 'rejeu', 'composition']) {
    // eslint-disable-next-line no-await-in-loop
    const trace = await traceDeTest(magasin, voie);
    // eslint-disable-next-line no-await-in-loop
    const e = await enregistrerEnonceSurTrace(magasin, { idTrace: trace.id, texte: `suite ${voie}` });
    assert.equal(e.idTrace, trace.id);
    assert.deepEqual(Object.keys(e).sort(), ['horodatage', 'id', 'idTrace', 'origine', 'texte']);
  }
});

// --- K. aucune autre table touchée, aucune valence ---------------------------------------------
test('K. n\'écrit que dans "enonces" ; traces, experiences, actes strictement inchangées', async () => {
  const magasin = magasinMemoireVive();
  const trace = await traceDeTest(magasin);
  await enregistrerExperience(magasin, { texteRecu: 'a', texteRepondu: 'b', date: new Date().toISOString(), source: 'test', referenceTrace: { idTrace: trace.id } });
  await enregistrerActe(magasin, { idTrace: trace.id });
  const avant = await comptes(magasin);
  const traceAvant = JSON.stringify(await magasin.lireTout('traces'));
  const expAvant = JSON.stringify(await magasin.lireTout('experiences'));
  const actesAvant = JSON.stringify(await magasin.lireTout('actes'));
  await enregistrerEnonceSurTrace(magasin, { idTrace: trace.id, texte: 'suite' });
  const apres = await comptes(magasin);
  for (const t of TABLES) assert.equal(apres[t], t === 'enonces' ? avant[t] + 1 : avant[t], `table ${t}`);
  assert.equal(JSON.stringify(await magasin.lireTout('traces')), traceAvant);
  assert.equal(JSON.stringify(await magasin.lireTout('experiences')), expAvant);
  assert.equal(JSON.stringify(await magasin.lireTout('actes')), actesAvant);
});

test('L. aucun champ de valence, d\'interprétation ou dérivé de la trace', async () => {
  const magasin = magasinMemoireVive();
  const trace = await traceDeTest(magasin);
  const e = await enregistrerEnonceSurTrace(magasin, { idTrace: trace.id, texte: 'suite' });
  for (const interdit of ['correct', 'incorrect', 'jugement', 'correction', 'approbation', 'rejet', 'score', 'confiance',
    'recompense', 'capacite', 'voie', 'contexte', 'resultat', 'statut', 'idExperience', 'idEnonce', 'idAction']) {
    assert.ok(!(interdit in e), `champ interdit « ${interdit} »`);
  }
});

test('M. apresNouveauVecu reste fermé au type "enonce" (aucun consommateur du vécu)', async () => {
  const magasin = magasinMemoireVive();
  await enregistrerEnonceSurTrace(magasin, { idTrace: 't1', texte: 'x' });
  await assert.rejects(() => apresNouveauVecu({ type: 'enonce', id: 'x' }));
});

// --- N. anciennes données conservées (migration additive) -------------------------------------
test('N. les données des anciennes tables restent lisibles après ajout de "enonces"', async () => {
  const magasin = magasinMemoireVive();
  await enregistrerExperience(magasin, { texteRecu: 'bonjour', texteRepondu: 'salut', date: new Date().toISOString(), source: 'test' });
  const trace = await traceDeTest(magasin);
  await enregistrerActe(magasin, { idTrace: trace.id });
  await enregistrerEnonceSurTrace(magasin, { idTrace: trace.id, texte: 'suite' });
  assert.equal((await magasin.lireTout('experiences')).length, 1);
  assert.equal((await magasin.lireTout('traces')).length, 1);
  assert.equal((await magasin.lireTout('actes')).length, 1);
  assert.equal((await magasin.lireTout('enonces')).length, 1);
});

// --- O. écran du langage -----------------------------------------------------------------------
test('O. ecran.enregistrerEnonceSurTrace() persiste avec origine "interface" et ne touche que "enonces"', async () => {
  const { magasin, ecran } = monterEcran();
  const trace = await traceDeTest(magasin);
  const avant = await comptes(magasin);
  const e = await ecran.enregistrerEnonceSurTrace(trace.id, 'Non, c\'était plutôt une déduction.');
  assert.equal(e.origine, 'interface');
  assert.equal(e.idTrace, trace.id);
  assert.equal(e.texte, 'Non, c\'était plutôt une déduction.');
  const apres = await comptes(magasin);
  for (const t of TABLES) assert.equal(apres[t], t === 'enonces' ? avant[t] + 1 : avant[t], `table ${t}`);
});

test('P. ecran.enregistrerEnonceSurTrace() relaie le refus d\'un idTrace invalide sans rien écrire', async () => {
  const { magasin, ecran } = monterEcran();
  await assert.rejects(() => ecran.enregistrerEnonceSurTrace('', 'x'), /idTrace/);
  assert.deepEqual(await magasin.lireTout('enonces'), []);
});

// --- Q. NON-BRANCHEMENT : aucun mécanisme de choix ne lit 'enonces' ----------------------------
function fichiersJs(dossier) {
  const sortie = [];
  for (const nom of fs.readdirSync(dossier, { withFileTypes: true })) {
    const chemin = path.join(dossier, nom.name);
    if (nom.isDirectory()) sortie.push(...fichiersJs(chemin));
    else if (/\.js$/.test(nom.name)) sortie.push(chemin);
  }
  return sortie;
}
test('Q. NON-BRANCHEMENT : seuls connaissances.js, ecran.js(langage), pont.js, main.js (et un commentaire de sauvegarde.js) mentionnent "enonce"', () => {
  const autorises = new Set([
    'app/langage/connaissances.js', 'app/langage/ecran.js', 'app/langage/pont.js', 'app/main.js',
    'app/memoire/sauvegarde.js', // commentaire du schéma 2 seulement : la sauvegarde itère TABLES, génériquement.
    // MISE À JOUR DÉLIBÉRÉE (v0.62.5) : vue PURE et DORMANTE vueReactionsSurCompositions() -- reçoit des tableaux
    // déjà lus, n'importe rien, ne touche aucun magasin et n'est importée par aucun fichier (gardé par
    // tests/reactions-compositions.test.mjs). Elle ne décide rien : ce n'est pas un branchement décisionnel.
    'app/langage/reactions-compositions.js',
  ].map((p) => path.join(RACINE, p)));
  const fautifs = fichiersJs(path.join(RACINE, 'app')).filter((f) => /enonce/i.test(fs.readFileSync(f, 'utf8')) && !autorises.has(f));
  assert.deepEqual(fautifs.map((f) => path.relative(RACINE, f)), []);
});

test('R. les mécanismes de choix et de découverte de F ne lisent pas "enonces"', () => {
  for (const f of ['app/langage/vue-traces.js', 'app/langage/retours-par-capacite.js', 'app/langage/retours-par-structure.js',
    'app/langage/retours-traces.js', 'app/langage/action.js', 'app/langage/registre.js', 'app/langage/vecu.js',
    'app/langage/induction.js', 'app/langage/extraction.js']) {
    const src = fs.readFileSync(path.join(RACINE, f), 'utf8');
    assert.ok(!/enonce/i.test(src), `${f} ne doit pas référencer « enonce »`);
  }
  // Dans ecran.js (langage), tenterRejeuAutonome / tenterReconnaissanceAction ne lisent jamais la table.
  const ecran = fs.readFileSync(path.join(RACINE, 'app/langage/ecran.js'), 'utf8');
  const lectures = ecran.match(/lireTout\(\s*['"]enonces['"]\s*\)/g);
  assert.equal(lectures, null, 'aucune lecture de la table "enonces" dans ecran.js');
});
// === FIN_TEST_ENONCES ===
