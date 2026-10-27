// ATELIER 3 — BOUCLE FERMÉE (GO ChatGPT « ATELIER 3 — GO CONSTRUCTION », 27/10/2026). Tout est éprouvé ici SANS appel payant :
//  1. scénario d'acceptation : forme, forme canonique identique en JavaScript et en Python, verdict (contre-épreuve sur la base) ;
//  2. joueur NAVIGATEUR réel (Chromium, Playwright) sur de petites applications et sur la vraie application ; réseau coupé ;
//  3. joueur ANDROID sur un faux adb (l'émulateur réel ne tourne que sur les machines GitHub : limite déclarée) ;
//  4. noyau : enveloppe 40 $/demande et 100 $/mois, pilote (reprises automatiques, lots, relivraison, résultat), scénario gelé ;
//  5. robot : voie élargie (coupée par défaut), admissibilité, lecture du scénario dans le journal, robot.yml ;
//  6. BOUT EN BOUT (faux GitHub local, dépôt Git nu, deballer.py, livraison_auto.py et joueur RÉELS) : une demande va jusqu'au
//     résultat « acquis » sans aucun geste de Christophe ; contre-épreuves : scénario rouge = rien n'est livré et résultat « echec » ;
//     interrupteur coupé = V4 et /valider ; main avancée = livraison refaite sur la tête ; conflit = lot repris ; journal falsifié refusé.
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance (D-007).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { ecrireFaits } from '../app/atelier/verification.js';
import { annotationsFaits } from '../app/atelier/retour.js';
import { etatBudget } from '../app/atelier/budget.js';
import * as N from '../outils-atelier/auto-autonome-noyau.mjs';
import * as S from '../outils-atelier/auto-scenario.mjs';
import { contexte, github, avancer, agent, bilan, veille, lireJournal, ecrireJournal, lireAcceptation, messageAgent } from '../outils-atelier/auto-autonome.mjs';
import { outilsEtape, PROFILS } from '../outils-atelier/auto-agent.mjs';
import * as E from '../app/capacites/etat.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const WF = join(RACINE, '.github', 'workflows');
const lire = (p) => readFileSync(join(RACINE, p), 'utf8');
// Navigateur réel : Playwright doit être résolu depuis le dépôt (node_modules ou NODE_PATH), comme le fait le joueur. Là où il n'existe pas
// (contrôle du robot, vérification AT-5 : le juge réel tourne dans le job « acceptation »), ces épreuves sont SAUTÉES en le disant ;
// la preuve atelier-3-preuve.yml pose ATELIER_EXIGER_NAVIGATEUR=1 : un Playwright absent y devient un ÉCHEC, jamais un saut.
const NAVIGATEUR = (() => { try { createRequire(join(RACINE, 'package.json')).resolve('playwright'); return true; } catch { return false; } })();
const AVEC_NAVIGATEUR = { skip: !NAVIGATEUR && process.env.ATELIER_EXIGER_NAVIGATEUR !== '1' ? 'Playwright absent de cet environnement (le robot joue le scénario dans son job « acceptation »)' : false };
const DEPOT = 'christopheplantegenest-prog/naissance-v02';
const USD = 1_000_000;
const ENV_GIT = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GITHUB_') && !/proxy/i.test(k))), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', NO_PROXY: '*' };
const hache = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
function g(d, ...a) {
  const r = spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: ENV_GIT });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}
function python(code, args = [], input = '') {
  const r = spawnSync('python3', ['-I', '-B', '-c', code, ...args], { input, encoding: 'utf8', env: ENV_GIT, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}
const PY_MODULE = (nom) => `import importlib.util, json, sys\nspec = importlib.util.spec_from_file_location("m", "${join(WF, nom)}")\nm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)\n`;

// ------------------------------------------------------------------------------------------------ données d'essai
const TEXTE = 'Bonjour de l\'Atelier 3';
const SCENARIO = {
  but: 'Toucher « Saluer » affiche la salutation, qui disparaît au rechargement',
  navigateur: [{ action: 'toucher', texte: 'Saluer' }, { action: 'voir', texte: TEXTE }, { action: 'recharger' }, { action: 'ne_pas_voir', texte: TEXTE }],
  android: null,
};
const INDEX = '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><title>Naissance</title></head>\n<body><p>Naissance</p><div id="zone"></div>\n<script type="module" src="./accueil.js"></script>\n</body></html>\n';
const MAIN_BASE = "// application d'essai\ndocument.documentElement.dataset.demarrage = 'ok';\n";
const MAIN_CAND = (texte = TEXTE) => `// application d'essai\nimport { salutation } from './salut.js';\nconst b = document.createElement('button');\nb.textContent = 'Saluer';\nb.onclick = () => { document.getElementById('zone').textContent = salutation(${JSON.stringify(texte)}); };\ndocument.body.append(b);\ndocument.documentElement.dataset.demarrage = 'ok';\n`;
const SALUT = 'export const salutation = (t) => t;\n';
const TEST_SALUT = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { salutation } from '../app/salut.js';\ntest('salutation', () => { assert.equal(salutation('a'), 'a'); });\n";
const VERSION_JS = "export const VERSION = '0.66.14'; // VERSION_AUTO\n";
const FIXTURE = { VERSION: '0.66.14\n', 'ETAT.md': '# État\n\n## Historique\n', 'signature/naissance.jks': 'cle-fictive\n', 'CLAUDE.md': '# règles\n', 'app/index.html': INDEX, 'app/accueil.js': MAIN_BASE, 'app/version.js': VERSION_JS, 'tests/base.test.mjs': "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('base', () => { assert.equal(1, 1); });\n" };
const PLAN = (x = {}) => ({ description: 'Bouton Saluer', missions: [{ id: 'saluer', titre: 'Bouton Saluer', comportement: 'Un bouton Saluer affiche une salutation.', criteres: ['le bouton affiche la salutation.'], tests: ['tests/salut.test.mjs'], autorises: ['app/accueil.js', 'app/salut.js'], cognitive: true }], scenario: SCENARIO, suite: null, ...x });

function appliDans(dossier, fichiers) {
  for (const [f, c] of Object.entries(fichiers)) { mkdirSync(dirname(join(dossier, f)), { recursive: true }); writeFileSync(join(dossier, f), c); }
  return dossier;
}

// ------------------------------------------------------------------------------------------------ 1. scénario : forme et verdict
test('scénario : forme exacte exigée (actions, clés, observations probantes, Android en ASCII, attentes bornées)', () => {
  const ok = S.lireScenario(SCENARIO);
  assert.ok(ok.scenario, ok.raison);
  assert.deepEqual(Object.keys(ok.scenario), ['but', 'navigateur', 'android']);
  const avecAndroid = S.lireScenario({ ...SCENARIO, android: [{ action: 'lancer' }, { action: 'ecran_eteint' }, { action: 'attendre', ms: 600000 }, { action: 'journal_contient', texte: 'tache-de-fond' }, { action: 'processus_vivant' }] });
  assert.ok(avecAndroid.scenario, avecAndroid.raison);
  for (const [s, motif] of [
    [{ ...SCENARIO, autre: 1 }, /clés android, but, navigateur/],
    [{ ...SCENARIO, but: ' x' }, /scénario\.but/],
    [{ ...SCENARIO, navigateur: [] }, /1 à 40 étapes/],
    [{ ...SCENARIO, navigateur: [{ action: 'executer', code: 'x' }] }, /action inconnue/],
    [{ ...SCENARIO, navigateur: [{ action: 'voir', texte: 'Bonjour', selecteur: '#x' }] }, /clés action, texte attendues/],
    [{ ...SCENARIO, navigateur: [{ action: 'toucher', texte: 'Saluer' }] }, /au moins une observation positive/],
    [{ ...SCENARIO, navigateur: [{ action: 'ne_pas_voir', texte: 'Erreur' }] }, /au moins une observation positive/],
    [{ ...SCENARIO, navigateur: [{ action: 'voir', texte: 'Version 0.66.15' }] }, /sans numéro de version/],
    [{ ...SCENARIO, navigateur: [{ action: 'voir', texte: 'ab' }] }, /3 caractères au moins/],
    [{ ...SCENARIO, navigateur: [{ action: 'attendre', ms: 60000 }, { action: 'voir', texte: 'abc' }] }, /ms entier de 1 à 15000/],
    [{ ...SCENARIO, navigateur: [{ action: 'touche', touche: 'F12' }, { action: 'voir', texte: 'abc' }] }, /touche inconnue/],
    [{ ...SCENARIO, navigateur: [{ action: 'voir', texte: 'a\nb c' }] }, /une ligne/],
    [{ ...SCENARIO, android: [{ action: 'ecrire', texte: 'Été' }, { action: 'voir', texte: 'abc' }] }, /ASCII simple/],
    [{ ...SCENARIO, android: [{ action: 'attendre', ms: 900000 }, { action: 'attendre', ms: 900000 }, { action: 'voir', texte: 'abc' }] }, /attente totale/],
  ]) assert.match(S.lireScenario(s).raison ?? 'accepté', motif, JSON.stringify(s).slice(0, 120));
});

test('scénario : forme canonique et empreinte identiques en JavaScript et en Python (le robot recalcule l\'empreinte gelée)', () => {
  const s = S.lireScenario({ ...SCENARIO, but: 'Accents « é à ç » et "guillemets" \\ barre', navigateur: [{ action: 'ecrire', champ: 'Écris ton message', texte: 'Où est Léa ? 😀' }, { action: 'voir', texte: 'Léa est là' }] }).scenario;
  const py = python('import json, sys, hashlib\ns = json.load(sys.stdin)\nc = json.dumps(s, ensure_ascii=False, sort_keys=True, separators=(",", ":"))\nprint(json.dumps({"c": c, "h": hashlib.sha256(c.encode("utf-8")).hexdigest()}))', [], JSON.stringify(s));
  assert.equal(py.c, S.canonique(s));
  assert.equal(py.h, S.empreinteScenario(s));
});

test('scénario : verdict — candidat vert ET base rouge exigés ; base verte = non probant ; Android absent ou rouge = pas « ok »', () => {
  const sc = S.lireScenario(SCENARIO).scenario;
  const ok = { verdict: 'ok', motif: '' };
  const ko = { verdict: 'echec', motif: 'étape 1' };
  assert.equal(S.verdictAcceptation({ scenario: sc, candidat: ok, base: ko }).verdict, 'ok');
  assert.equal(S.verdictAcceptation({ scenario: sc, candidat: ko, base: ko }).verdict, 'echec');
  assert.equal(S.verdictAcceptation({ scenario: sc, candidat: ok, base: ok }).verdict, 'non-probant');
  assert.equal(S.verdictAcceptation({ scenario: sc, candidat: ok, base: null }).verdict, 'impossible');
  assert.equal(S.verdictAcceptation({ scenario: sc, candidat: null, base: ko }).verdict, 'impossible');
  const scA = { ...sc, android: [{ action: 'lancer' }, { action: 'voir', texte: 'Naissance' }] };
  assert.equal(S.verdictAcceptation({ scenario: scA, candidat: ok, base: ko, android: null }).verdict, 'impossible');
  assert.equal(S.verdictAcceptation({ scenario: scA, candidat: ok, base: ko, android: ko }).verdict, 'echec');
  assert.equal(S.verdictAcceptation({ scenario: scA, candidat: ok, base: ko, android: ok }).verdict, 'ok');
  assert.match(S.verdictAcceptation({ scenario: scA, candidat: ok, base: ko, android: ok }).motif, /émulateur Android verts/);
});

// ------------------------------------------------------------------------------------------------ 2. joueur navigateur réel
test('JOUEUR NAVIGATEUR (Chromium réel) : vert sur le candidat, rouge sur la base, réseau extérieur coupé, stockage neuf', AVEC_NAVIGATEUR, async () => {
  const T = mkdtempSync(join(tmpdir(), 'scenario-nav-'));
  try {
    const base = appliDans(join(T, 'base'), { 'app/index.html': INDEX, 'app/accueil.js': MAIN_BASE });
    const cand = appliDans(join(T, 'cand'), { 'app/index.html': INDEX, 'app/accueil.js': MAIN_CAND(), 'app/salut.js': SALUT });
    const sc = S.lireScenario(SCENARIO).scenario;
    const rc = await S.jouerNavigateur({ scenario: sc, racine: cand, delaiObservation: 3000 });
    assert.equal(rc.verdict, 'ok', rc.motif);
    assert.equal(rc.etapes.length, 4);
    const rb = await S.jouerNavigateur({ scenario: sc, racine: base, delaiObservation: 1500 });
    assert.equal(rb.verdict, 'echec');
    assert.match(rb.motif, /étape 1 \(toucher « Saluer »\)/);
    assert.equal(S.verdictAcceptation({ scenario: sc, candidat: rc, base: rb }).verdict, 'ok');
    // Une capacité qui viendrait d'un service extérieur ne passe pas : le réseau hors de l'application est coupé pendant la preuve.
    const ext = appliDans(join(T, 'ext'), { 'app/index.html': INDEX, 'app/accueil.js': "fetch('https://example.com/r').then((r) => r.text()).then(() => { document.getElementById('zone').textContent = 'Réponse du service'; }, () => {});\ndocument.documentElement.dataset.demarrage = 'ok';\n" });
    const re = await S.jouerNavigateur({ scenario: { but: 'x', navigateur: [{ action: 'voir', texte: 'Réponse du service' }], android: null }, racine: ext, delaiObservation: 2000 });
    assert.equal(re.verdict, 'echec');
    // Même un autre serveur LOCAL (autre origine) est coupé : seule l'application servie par le joueur répond.
    const autre = createServer((q, rep) => { rep.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }); rep.end('Réponse locale'); });
    await new Promise((r) => autre.listen(0, '127.0.0.1', r));
    try {
      const loc = appliDans(join(T, 'loc'), { 'app/index.html': INDEX, 'app/accueil.js': `fetch('http://127.0.0.1:${autre.address().port}/r').then((r) => r.text()).then((t) => { document.getElementById('zone').textContent = t; }, () => { document.getElementById('zone').textContent = 'Requête refusée'; });\ndocument.documentElement.dataset.demarrage = 'ok';\n` });
      const rl = await S.jouerNavigateur({ scenario: { but: 'x', navigateur: [{ action: 'voir', texte: 'Requête refusée' }, { action: 'ne_pas_voir', texte: 'Réponse locale' }], android: null }, racine: loc, delaiObservation: 3000 });
      assert.equal(rl.verdict, 'ok', rl.motif);
    } finally {
      autre.close();
    }
    // Stockage neuf à chaque passage : une donnée écrite au premier passage n'existe plus au second.
    const st = appliDans(join(T, 'st'), { 'app/index.html': INDEX, 'app/accueil.js': "const n = Number(localStorage.getItem('n') ?? 0) + 1; localStorage.setItem('n', String(n)); document.getElementById('zone').textContent = `Passage numéro ${n}`;\ndocument.documentElement.dataset.demarrage = 'ok';\n" });
    const sn = { but: 'x', navigateur: [{ action: 'voir', texte: 'Passage numéro 1' }, { action: 'recharger' }, { action: 'voir', texte: 'Passage numéro 2' }], android: null };
    assert.equal((await S.jouerNavigateur({ scenario: sn, racine: st, delaiObservation: 3000 })).verdict, 'ok');
    assert.equal((await S.jouerNavigateur({ scenario: sn, racine: st, delaiObservation: 3000 })).verdict, 'ok');
    // Racine sans application : impossible (jamais un succès par défaut).
    assert.equal((await S.jouerNavigateur({ scenario: sc, racine: T })).verdict, 'impossible');
  } finally {
    rmSync(T, { recursive: true, force: true });
  }
});

test('JOUEUR NAVIGATEUR sur la VRAIE application de ce dépôt : naissance, Réglages, rechargement (état conservé) ; presse-papiers', AVEC_NAVIGATEUR, async () => {
  const sc = S.lireScenario({ but: 'Naître puis retrouver l\'état après rechargement', navigateur: [
    { action: 'voir', texte: "Naissance n'est pas encore née. Comment t'appelles-tu ?" }, { action: 'ecrire', champ: 'Ton prénom', texte: 'Christophe' },
    { action: 'toucher', texte: 'Faire naître Naissance' }, { action: 'voir', texte: 'Ouvrir les Réglages' }, { action: 'toucher', texte: 'Ouvrir les Réglages' },
    { action: 'voir', texte: 'Atelier — capacités →' }, { action: 'recharger' }, { action: 'ne_pas_voir', texte: "Naissance n'est pas encore née. Comment t'appelles-tu ?" },
  ], android: null }).scenario;
  const r = await S.jouerNavigateur({ scenario: sc, racine: RACINE });
  assert.equal(r.verdict, 'ok', `${r.motif} ${JSON.stringify(r.etapes)}`);
  // Presse-papiers : ce que le geste a réellement copié, lu par le joueur.
  const T = mkdtempSync(join(tmpdir(), 'scenario-pp-'));
  try {
    const app = appliDans(join(T, 'pp'), { 'app/index.html': INDEX, 'app/accueil.js': "const b = document.createElement('button'); b.textContent = 'Copier'; b.onclick = () => navigator.clipboard.writeText('rappel des issues vécues'); document.body.append(b);\ndocument.documentElement.dataset.demarrage = 'ok';\n" });
    const pp = (t) => ({ but: 'x', navigateur: [{ action: 'toucher', texte: 'Copier' }, { action: 'presse_papiers', texte: t }], android: null });
    assert.equal((await S.jouerNavigateur({ scenario: pp('issues vécues'), racine: app, delaiObservation: 3000 })).verdict, 'ok');
    assert.equal((await S.jouerNavigateur({ scenario: pp('autre chose'), racine: app, delaiObservation: 1500 })).verdict, 'echec');
  } finally {
    rmSync(T, { recursive: true, force: true });
  }
});

test('JOUEUR : CLI verdict — annotation ACCEPTATION lisible par l\'opérateur ; empreinte différente de celle du journal = impossible', () => {
  const T = mkdtempSync(join(tmpdir(), 'scenario-cli-'));
  try {
    writeFileSync(join(T, 's.json'), JSON.stringify(SCENARIO));
    writeFileSync(join(T, 'c.json'), JSON.stringify({ verdict: 'ok', motif: '4 étape(s)', etapes: [1, 2, 3, 4] }));
    writeFileSync(join(T, 'b.json'), JSON.stringify({ verdict: 'echec', motif: 'étape 1', etapes: [1] }));
    const emp = S.empreinteScenario(S.lireScenario(SCENARIO).scenario);
    const r = spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-scenario.mjs'), 'verdict', '--scenario', join(T, 's.json'), '--empreinte', emp, '--candidat', join(T, 'c.json'), '--base', join(T, 'b.json')], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(r.status, 0, r.stderr);
    const x = /^::notice title=([^:]+)::(.*)$/m.exec(r.stdout);
    const a = lireAcceptation([{ title: x[1], message: x[2], annotation_level: 'notice' }]);
    assert.deepEqual([a.verdict, a.empreinte], ['ok', emp]);
    const faux = spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-scenario.mjs'), 'verdict', '--scenario', join(T, 's.json'), '--empreinte', '0'.repeat(64), '--candidat', join(T, 'c.json'), '--base', join(T, 'b.json')], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(faux.status, 1);
    assert.match(faux.stdout, /"verdict":"impossible","motif":"empreinte du scénario différente de celle du journal"/);
    // Annotations ambiguës ou illisibles : aucun verdict (jamais un succès supposé).
    assert.equal(lireAcceptation([{ title: 'ACCEPTATION', message: '{"v":1,"verdict":"ok","motif":"x"}', annotation_level: 'warning' }]), null);
    assert.equal(lireAcceptation([1, 2].map(() => ({ title: 'ACCEPTATION', message: '{"v":1,"verdict":"ok","motif":"x"}', annotation_level: 'notice' }))), null);
    assert.equal(lireAcceptation([{ title: 'ACCEPTATION', message: '{"v":1,"verdict":"parfait","motif":"x"}', annotation_level: 'notice' }]), null);
  } finally {
    rmSync(T, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------------------------------------ 3. joueur Android (faux adb)
function fauxAdb({ ecran = [], appareil = 'device', installation = 'Success', processus = '4242', journal = '' } = {}) {
  const appels = [];
  const xml = () => `<?xml version="1.0"?><hierarchy>${ecran.map(([t, b]) => `<node text="${t.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" content-desc="" bounds="${b}" />`).join('')}</hierarchy>`;
  const adb = (args) => {
    appels.push(args.join(' '));
    if (args[0] === 'get-state') return { code: appareil === 'device' ? 0 : 1, sortie: `${appareil}\n` };
    if (args[0] === 'install') return { code: installation === 'Success' ? 0 : 1, sortie: installation };
    if (args[0] === 'exec-out') return { code: 0, sortie: xml() };
    if (args[0] === 'logcat') return { code: 0, sortie: args[1] === '-d' ? journal : '' };
    if (args[0] === 'shell' && args[1] === 'pidof') return { code: 0, sortie: processus };
    return { code: 0, sortie: '' };
  };
  return { adb, appels };
}
test('JOUEUR ANDROID (faux adb) : installation, lancement, toucher au centre de l\'élément, écran éteint, journal système, processus ; émulateur absent = impossible', async () => {
  const sc = S.lireScenario({ ...SCENARIO, android: [{ action: 'lancer' }, { action: 'toucher', texte: 'Démarrer la veille' }, { action: 'ecran_eteint' }, { action: 'attendre', ms: 600000 }, { action: 'journal_contient', texte: 'veille: tour 3' }, { action: 'processus_vivant' }, { action: 'ecran_allume' }, { action: 'voir', texte: 'Veille active' }] }).scenario;
  const dormir = async () => {};
  const f = fauxAdb({ ecran: [['Démarrer la veille', '[100,200][300,260]'], ['Veille active', '[0,0][10,10]']], journal: 'I Capacitor/Console: veille: tour 3\n' });
  const r = await S.jouerAndroid({ scenario: sc, apk: '/tmp/app.apk', paquet: 'io.github.essai.naissance', adb: f.adb, dormir, delaiObservation: 0 });
  assert.equal(r.verdict, 'ok', r.motif);
  assert.ok(f.appels.includes('install -r -g /tmp/app.apk'));
  assert.ok(f.appels.includes('shell input tap 200 230'), f.appels.join('\n'));
  assert.ok(f.appels.includes('shell input keyevent KEYCODE_SLEEP'));
  assert.ok(f.appels.includes('shell monkey -p io.github.essai.naissance -c android.intent.category.LAUNCHER 1'));
  const sansJournal = await S.jouerAndroid({ scenario: sc, apk: 'a', paquet: 'io.github.essai.naissance', adb: fauxAdb({ ecran: [['Démarrer la veille', '[0,0][2,2]']], journal: '' }).adb, dormir, delaiObservation: 0 });
  assert.equal(sansJournal.verdict, 'echec');
  assert.match(sansJournal.motif, /étape 5 \(journal_contient « veille: tour 3 »\) : texte absent du journal système/);
  const mort = await S.jouerAndroid({ scenario: sc, apk: 'a', paquet: 'io.github.essai.naissance', adb: fauxAdb({ ecran: [['Démarrer la veille', '[0,0][2,2]']], journal: 'veille: tour 3', processus: '' }).adb, dormir, delaiObservation: 0 });
  assert.match(mort.motif, /processus de l'application absent/);
  assert.equal((await S.jouerAndroid({ scenario: sc, apk: 'a', paquet: 'io.github.essai.naissance', adb: fauxAdb({ appareil: 'offline' }).adb, dormir })).verdict, 'impossible');
  assert.equal((await S.jouerAndroid({ scenario: sc, apk: 'a', paquet: 'io.github.essai.naissance', adb: fauxAdb({ installation: 'Failure [INSTALL_FAILED]' }).adb, dormir })).verdict, 'impossible');
  assert.equal((await S.jouerAndroid({ scenario: sc, apk: 'a', paquet: 'pas un paquet', adb: fauxAdb().adb, dormir })).verdict, 'impossible');
  assert.deepEqual(S.noeudsEcran('<node text="A &amp; B" content-desc="icône" bounds="[0,0][4,8]" />'), [{ texte: 'A & B', centre: [2, 4] }, { texte: 'icône', centre: [2, 4] }]);
});

// ------------------------------------------------------------------------------------------------ 4. noyau
const Q = '2026-10-27T10:00:00Z';
const BASE_SHA = 'a'.repeat(40);
const DEM = ['demande', { issue: 50, titre: 'Atelier : saluer', texte: 'Un bouton qui salue.', base: { sha: BASE_SHA, version: '0.66.14' }, pilote: true }];
const PLAN_LU = () => N.lirePlan(PLAN(), { issue: 50, demande: { texte: 'x', base: { sha: BASE_SHA, version: '0.66.14' } }, exigerScenario: true }).plan;
const EV_PLAN = (plan = PLAN_LU(), v = '0.66.15') => ['plan', { plan, version: v, scenario_sha256: S.empreinteScenario(plan.scenario) }];
const chantier = (evs) => evs.reduce((j, [type, donnees]) => { const r = N.appliquerChantier(j, { type, quand: Q, donnees }); if (r.refuse) throw new Error(`${type} : ${r.raison}`); return r; }, []);
const refus = (evs, [type, donnees]) => N.appliquerChantier(chantier(evs), { type, quand: Q, donnees });
const pil = (evs, opts) => N.etapePilote(N.etatChantier(chantier(evs)), opts);
const C = (m = 'saluer', t = 1) => ['candidat', { mission: m, tentative: t, branche: `atelier/ticket-50/${m}/${t}`, commit: 'c'.repeat(40), fichiers: [{ chemin: 'app/salut.js', etat: 'cree' }] }];
const V = (m = 'saluer', t = 1, verdict = 'verification-technique-conforme') => ['verification', { mission: m, tentative: t, verdict, raisons: [], cognitive: false, migration: null }];
const A = (m = 'saluer', t = 1) => ['avis', { mission: m, tentative: t, conforme: true, objections: [] }];
const LIV = (v = '0.66.15', parent = BASE_SHA) => ['livraison', { version: v, depot: 'd'.repeat(40), branche: 'livraison/ticket-50-1', colis_sha256: 'e'.repeat(64), parent }];
const ACC = (verdict = 'ok') => ({ verdict, motif: verdict === 'ok' ? 'navigateur vert, contre-épreuve rouge sur la base' : 'navigateur : étape 2' });
const JUSQU_AU_COLIS = [DEM, EV_PLAN(), ['avis-scenario', { conforme: true, objections: [] }], C(), V(), A(), ['validation', { par: 'acceptation' }], LIV()];

test('NOYAU : plan d\'un chantier piloté = scénario exigé, gelé avec son empreinte ; falsification refusée ; avis indépendant avant tout développement', () => {
  const d = { issue: 50, demande: { texte: 'x', base: { sha: BASE_SHA, version: '0.66.14' } } };
  assert.match(N.lirePlan({ description: 'x', missions: PLAN().missions }, { ...d, exigerScenario: true }).raison, /scénario d'acceptation exigé/);
  assert.ok(N.lirePlan({ description: 'x', missions: PLAN().missions }, d).plan, 'un plan sans scénario reste lisible hors pilote');
  assert.match(N.lirePlan(PLAN({ suite: 'x'.repeat(1501) }), { ...d, exigerScenario: true }).raison, /plan\.suite/);
  assert.match(N.lirePlan(PLAN({ scenario: { ...SCENARIO, navigateur: [{ action: 'voir', texte: 'v0.66.15 livrée' }] } }), { ...d, exigerScenario: true }).raison, /sans numéro de version/);
  assert.equal(N.lirePlan(PLAN({ suite: 'la suite' }), { ...d, exigerScenario: true }).plan.suite, 'la suite');
  // Empreinte falsifiée ou scénario changé sans elle : le journal refuse.
  const p = PLAN_LU();
  assert.match(refus([DEM], ['plan', { plan: p, version: '0.66.15', scenario_sha256: '0'.repeat(64) }]).raison, /empreinte différente/);
  assert.match(refus([DEM], ['plan', { plan: { ...p, scenario: { ...p.scenario, but: 'autre chose' } }, version: '0.66.15', scenario_sha256: S.empreinteScenario(p.scenario) }]).raison, /empreinte différente/);
  // Le scénario gelé ne se remplace pas : un second plan est refusé.
  assert.match(refus([DEM, EV_PLAN()], EV_PLAN()).raison, /plan déjà adopté/);
  // Avis indépendant (étape payante « scenario ») AVANT tout développement ; non conforme = nouvelle planification avec ses objections.
  assert.equal(pil([DEM, EV_PLAN()]).etape, 'scenario');
  const rejete = N.etatChantier(chantier([DEM, EV_PLAN(), ['avis-scenario', { conforme: false, objections: ['un simple texte ne prouve rien'] }]]));
  assert.equal(rejete.plan, null);
  assert.deepEqual(rejete.objectionsScenario, ['un simple texte ne prouve rien']);
  assert.equal(N.etapePilote(rejete).etape, 'planifier');
  assert.equal(pil([DEM, EV_PLAN(), ['avis-scenario', { conforme: true, objections: [] }]]).etape, 'developper');
  // Deux avis ratés (incident) : une reprise automatique, puis un résultat « echec » sans question.
  const tour = (n, etape = 'scenario') => [['tour', { execution: `t-${n}`, etape, maximum: USD, run: '1' }], ['tour-clos', { execution: `t-${n}`, montant: USD, issue: 'echec' }]];
  const rates = [DEM, EV_PLAN(), ...tour(1), ...tour(2)];
  assert.deepEqual([pil(rates).etape, pil(rates).raison], ['reprendre-auto', 'avis-impossible']);
  const repris = [...rates, ['bloque', { raison: 'avis-impossible', question: 'q' }], ['reprise', { par: 'pilote' }]];
  assert.equal(pil(repris).etape, 'scenario');
  assert.deepEqual([pil([...repris, ...tour(3), ...tour(4)]).etape, pil([...repris, ...tour(3), ...tour(4)]).statut], ['conclure', 'echec']);
  // « pilote » et « acceptation » ne sont admis que pour un chantier piloté.
  const DEM0 = ['demande', { ...DEM[1], pilote: undefined }];
  delete DEM0[1].pilote;
  assert.match(refus([DEM0], ['reprise', { par: 'pilote' }]).raison, /auteur illisible/);
  assert.match(refus([DEM0, ['plan', { plan: PLAN_LU(), version: '0.66.15', scenario_sha256: S.empreinteScenario(PLAN_LU().scenario) }]], ['validation', { par: 'acceptation' }]).raison, /auteur illisible/);
});

test('NOYAU — PILOTE : chaque blocage récupérable est repris une fois sans Christophe, puis conclut ; migration et budget concluent aussitôt', () => {
  const base = [DEM, EV_PLAN(), ['avis-scenario', { conforme: true, objections: [] }]];
  // Question : deux réponses automatiques prudentes, puis « impossible » (jamais un faux succès).
  const q = (n) => ['bloque', { raison: 'question', question: `Question ${n} ?` }];
  let evs = [...base, ['sans-candidat', { mission: 'saluer', tentative: 1, raison: 'question : ?' }], q(1)];
  let p = pil(evs);
  assert.deepEqual([p.etape, p.reponse], ['reprendre-auto', N.REPONSE_AUTO]);
  evs = [...evs, ['reprise', { par: 'pilote', reponse: p.reponse }], ['sans-candidat', { mission: 'saluer', tentative: 2, raison: 'question : ?' }], q(2), ['reprise', { par: 'pilote', reponse: N.REPONSE_AUTO }], ['sans-candidat', { mission: 'saluer', tentative: 3, raison: 'question : ?' }], q(3)];
  p = pil(evs);
  assert.deepEqual([p.etape, p.statut], ['conclure', 'impossible']);
  assert.match(p.resume, /Question 3 \?/);
  // Tentatives épuisées : une reprise automatique (3 tentatives de plus, avec le retour), puis « echec ».
  const echec = (t) => ['sans-candidat', { mission: 'saluer', tentative: t, raison: 'tests rouges' }];
  evs = [...base, echec(1), echec(2), echec(3)];
  p = pil(evs);
  assert.deepEqual([p.etape, p.raison, p.bloquer.raison], ['reprendre-auto', 'tentatives-epuisees', 'tentatives-epuisees']);
  evs = [...evs, ['bloque', p.bloquer], ['reprise', { par: 'pilote' }]];
  assert.deepEqual([pil(evs).etape, pil(evs).tentative], ['developper', 4]);
  evs = [...evs, echec(4), echec(5), echec(6)];
  assert.deepEqual([pil(evs).etape, pil(evs).statut], ['conclure', 'echec']);
  // Planification impossible : une reprise (deux essais de plus), puis « impossible ».
  const pe = ['planification-echouee', { raison: 'x' }];
  evs = [DEM, pe, pe];
  assert.equal(pil(evs).etape, 'reprendre-auto');
  evs = [...evs, ['bloque', { raison: 'planification-impossible', question: 'q' }], ['reprise', { par: 'pilote' }], pe, pe];
  assert.deepEqual([pil(evs).etape, pil(evs).statut], ['conclure', 'impossible']);
  // Migration : protection renforcée, « decision-requise » sans reprise.
  const mig = [...base, C(), ['verification', { mission: 'saluer', tentative: 1, verdict: 'verification-technique-conforme', raisons: [], cognitive: true, migration: 'TABLES dans app/memoire/base.js' }]];
  assert.deepEqual([pil(mig).etape, pil(mig).statut], ['conclure', 'decision-requise']);
  // Budget de la demande épuisé : résultat « budget-epuise » ; plafond du mois : attente du mois suivant (veille), pas de résultat.
  assert.deepEqual([pil([...base, ['bloque', { raison: 'plafond-chantier', question: 'q' }]]).statut], ['budget-epuise']);
  assert.deepEqual(pil([...base, ['bloque', { raison: 'budget', question: 'q' }]]), { etape: 'aucune', raison: 'bloque' });
  // /stop de Christophe : respecté (le pilote ne reprend jamais un chantier arrêté par lui).
  assert.equal(pil([...base, ['arret', { par: N.PROPRIETAIRE_ID }]]).raison, 'arret');
  // Chantier d'avant le pilote : rien ne change (prochaineEtape).
  const DEM0 = ['demande', { issue: 50, titre: 'x', texte: 'x', base: DEM[1].base }];
  assert.deepEqual(pil([DEM0, pe, pe]), N.prochaineEtape(N.etatChantier(chantier([DEM0, pe, pe]))));
  assert.equal(pil([DEM0, pe, pe]).etape, 'bloquer');
});

test('NOYAU — LIVRAISON : acquis exige le verdict d\'acceptation ; scénario rouge = echec ; main avancée = relivraison (2 fois) ; validation par le scénario seulement avec la voie élargie', () => {
  const avantValidation = JUSQU_AU_COLIS.slice(0, 6);
  assert.equal(pil(avantValidation).raison, 'attente-validation', 'voie élargie coupée : /valider de Christophe, comme avant');
  assert.equal(pil(avantValidation, { elargie: true }).etape, 'valider-auto');
  assert.equal(pil(JUSQU_AU_COLIS).raison, 'attente-livraison');
  const acquis = pil([...JUSQU_AU_COLIS, ['livre', { conclusion: 'livre', acceptation: ACC('ok') }]]);
  assert.deepEqual([acquis.etape, acquis.statut], ['conclure', 'acquis']);
  assert.deepEqual(acquis.preuve, { versions: ['0.66.15'], acceptations: [{ verdict: 'ok', motif: 'navigateur vert, contre-épreuve rouge sur la base' }] });
  // Livré mais verdict illisible : jamais « acquis ».
  assert.equal(pil([...JUSQU_AU_COLIS, ['livre', { conclusion: 'livre', acceptation: null }]]).statut, 'livre-sans-preuve');
  // Scénario rouge : le robot n'a rien livré ; résultat « echec » avec la preuve.
  const rouge = pil([...JUSQU_AU_COLIS, ['livre', { conclusion: 'echec', acceptation: ACC('echec') }]]);
  assert.deepEqual([rouge.etape, rouge.statut, rouge.preuve.refusee.verdict], ['conclure', 'echec', 'echec']);
  assert.match(rouge.resume, /Scénario d'acceptation : echec/);
  assert.equal(pil([...JUSQU_AU_COLIS, ['livre', { conclusion: 'echec', acceptation: ACC('non-probant') }]]).statut, 'echec');
  // Main avancée pendant le passage : relivraison sur la nouvelle tête (2 fois au plus), puis echec.
  const ma = ['livre', { conclusion: 'main-a-avance', acceptation: null }];
  let evs = [...JUSQU_AU_COLIS, ma];
  assert.deepEqual(pil(evs), { etape: 'relivrer', raison: 'main-a-avance' });
  evs = [...evs, ['relivraison', { raison: 'main-a-avance' }]];
  assert.equal(pil(evs).etape, 'livrer');
  evs = [...evs, LIV('0.66.16'), ma, ['relivraison', { raison: 'main-a-avance' }], LIV('0.66.17'), ma];
  assert.deepEqual([pil(evs).etape, pil(evs).statut], ['conclure', 'echec']);
  // Conflit avec main (livrer) : le lot repart de la tête de main une fois.
  const conflit = [...JUSQU_AU_COLIS.slice(0, 7), ['bloque', { raison: 'conflit-main', question: 'q' }]];
  assert.deepEqual(pil(conflit), { etape: 'lot', raison: 'conflit-main' });
});

test('NOYAU — LOTS : une demande trop grande se livre en lots successifs (identifiants neufs, base = tête de main), puis « acquis » avec toutes les preuves', () => {
  const plan1 = PLAN_LU();
  plan1.suite = 'ajouter un bouton Au revoir';
  let evs = [DEM, EV_PLAN(plan1), ['avis-scenario', { conforme: true, objections: [] }], C(), V(), A(), ['validation', { par: 'acceptation' }], LIV(), ['livre', { conclusion: 'livre', acceptation: ACC() }]];
  assert.deepEqual(pil(evs), { etape: 'lot', raison: 'suite' });
  const B2 = { sha: 'b'.repeat(40), version: '0.66.15' };
  evs = [...evs, ['lot', { base: B2, raison: 'suite' }]];
  const e = N.etatChantier(chantier(evs));
  assert.deepEqual([e.lots, e.plan, e.demande.base.sha, e.idsPasses], [2, null, 'b'.repeat(40), ['saluer']]);
  assert.equal(N.etapePilote(e).etape, 'planifier');
  // Un identifiant déjà employé est refusé (les branches atelier/ticket-N/<mission>/<k> restent uniques).
  assert.match(refus(evs, EV_PLAN(PLAN_LU(), '0.66.16')).raison, /déjà employé/);
  const plan2 = { ...PLAN_LU(), missions: PLAN_LU().missions.map((m) => ({ ...m, id: 'l2-saluer' })) };
  evs = [...evs, EV_PLAN(plan2, '0.66.16'), ['avis-scenario', { conforme: true, objections: [] }], C('l2-saluer'), V('l2-saluer'), A('l2-saluer'), ['validation', { par: 'acceptation' }], ['livraison', { version: '0.66.16', depot: 'f'.repeat(40), branche: 'livraison/ticket-50-2', colis_sha256: 'e'.repeat(64), parent: 'b'.repeat(40) }], ['livre', { conclusion: 'livre', acceptation: ACC() }]];
  const fin = pil(evs);
  assert.deepEqual([fin.statut, fin.preuve.versions], ['acquis', ['0.66.15', '0.66.16']]);
  assert.equal(N.etatChantier(chantier(evs)).livraisons, 2);
  // Quatre lots au plus : au-delà, la demande finit en « echec » avec ce qui reste.
  const e4 = N.etatChantier(chantier(evs.slice(0, 9)));
  e4.lots = N.MAX_LOTS;
  assert.equal(N.etapePilote(e4).statut, 'echec');
  assert.match(N.etapePilote(e4).resume, /reste : ajouter un bouton Au revoir/);
});

test('ENVELOPPE : 40 $ par demande (cumulés sur tous ses lots et tous les mois), 100 $ par mois ; la sonde réserve 6 $ ; arrêt net', () => {
  let j = [];
  const reserver = (k, etape, dep, quand = Q) => N.reserverTour(j, { quand, execution: `ticket-50-${k}`, issue: 50, etape, depenseChantier: dep, plafond: N.PLAFOND_DEMANDE });
  let r = reserver(1, 'sonder', 0);
  assert.equal(r.maximum, 6 * USD);
  j = r.journal;
  assert.equal(etatBudget(j).chantiers['ticket-50'].plafond, 40 * USD);
  j = N.inscrireCout(j, { quand: Q, execution: 'ticket-50-1', montant: 6 * USD }).journal;
  // 39 $ déjà dépensés par la demande : la réserve se réduit à 1 $ ; à 39,5 $ : refus « plafond-chantier » -> résultat budget-epuise.
  r = reserver(2, 'developper', 39 * USD);
  assert.equal(r.maximum, 1 * USD);
  assert.equal(reserver(3, 'developper', 39_500_000).refus, 'plafond-chantier');
  // Le mois suivant ne rouvre pas la demande : le plafond est cumulé.
  assert.equal(N.reserverTour(r.journal, { quand: '2026-11-02T10:00:00Z', execution: 'ticket-50-9', issue: 50, etape: 'developper', depenseChantier: 39_500_000, plafond: N.PLAFOND_DEMANDE }).refus, 'engagement-ouvert');
  // Le plafond du mois s'applique aussi à une demande : 100 $ au total.
  let jm = [];
  for (let k = 0; k < 12; k += 1) {
    const x = N.reserverTour(jm, { quand: Q, execution: `m-${k}`, issue: 100 + k, etape: 'developper', plafond: N.PLAFOND_DEMANDE });
    if (x.refus) { assert.equal(x.refus, 'budget'); break; }
    jm = N.inscrireCout(x.journal, { quand: Q, execution: `m-${k}`, montant: x.maximum }).journal;
  }
  assert.ok(etatBudget(jm).consommeCycle <= 100 * USD);
  assert.throws(() => N.reserverTour([], { quand: Q, execution: 'x', issue: 1, etape: 'avis', plafond: 1000 * USD }), /plafond du chantier ou de la demande/);
  // Un chantier d'avant le pilote garde 25 $.
  assert.equal(N.PLAFOND_CHANTIER, 25 * USD);
});

test('ÉCRAN (app/capacites) : le résultat de la demande est lu et affiché ; un état d\'avant l\'Atelier 3 se relit à l\'identique', () => {
  const evs = [...JUSQU_AU_COLIS, ['livre', { conclusion: 'livre', acceptation: ACC() }]];
  const p = pil(evs);
  const e = N.etatChantier(chantier([...evs, ['resultat', { statut: p.statut, resume: p.resume, preuve: p.preuve }], ['termine', {}]]));
  const corps = `<!-- atelier-autonome-etat situation= -->\n${N.texteEtat(e, null)}\n${N.donneesEtat(e, null)}\n`;
  assert.match(corps, /\*\*Résultat : ✅ ACQUIS \(preuve de fonctionnement jouée par le robot\)\*\*/);
  const d = E.lireDonnees(corps);
  assert.deepEqual(d.resultat, { statut: 'acquis', resume: p.resume, versions: ['0.66.15'], acceptations: ['ok'] });
  assert.deepEqual(d.scenario, { but: SCENARIO.but, android: false, relu: true });
  assert.equal(d.plafond, 40 * USD);
  const r = E.resumer({ number: 50, title: 'Atelier : saluer', state: 'open' }, [{ body: corps, user: { login: 'github-actions[bot]' } }]);
  assert.deepEqual(r.situation, { code: 'resultat', libelle: 'Acquis : preuve de fonctionnement verte' });
  assert.deepEqual(E.commandesPossibles(r), []);
  // Ancien état (sans pilote) : aucune clé nouvelle.
  const DEM0 = ['demande', { issue: 50, titre: 'x', texte: 'x', base: DEM[1].base }];
  const vieux = E.lireDonnees(N.donneesEtat(N.etatChantier(chantier([DEM0])), null));
  assert.equal(['pilote', 'scenario', 'resultat', 'lot'].some((k) => Object.hasOwn(vieux, k)), false);
  // Et le commentaire brut d'un chantier d'avant reste celui de main, octet pour octet (aucune clé ATELIER 3 émise).
  assert.doesNotMatch(N.donneesEtat(N.etatChantier(chantier([DEM0])), null), /"(pilote|lot|scenario|resultat)":/);
});

// ------------------------------------------------------------------------------------------------ 5. robot : voie élargie, admissibilité, journal
const PY_VOIE = `${PY_MODULE('livraison_auto.py')}
out = []
for f in json.load(sys.stdin):
    out.append(list(m.choisir_voie_complete(f)))
print(json.dumps(out))`;
test('ROBOT — voie élargie : coupée par défaut (V4 en mode ombre) ; « auto » seulement avec l\'interrupteur, un scénario gelé, une classe E/O/S admissible, venant de l\'Atelier', () => {
  const sc = 'a'.repeat(64);
  const F = { decision: 'controler', evenement: 'workflow_dispatch', depot: 'b'.repeat(40), acteur: 'github-actions[bot]', classe: 'S', e_auto: 'non', e_auto_motif: 'classe S', apk: 'true', interrupteur: '', e_elargie: 'oui', scenario: sc, interrupteur_elargie: 'actif', ticket: '50' };
  const r = python(PY_VOIE, [], JSON.stringify([
    { ...F, interrupteur_elargie: '' }, F, { ...F, classe: 'O' }, { ...F, classe: 'E', e_auto: 'non' }, { ...F, classe: 'R' }, { ...F, e_elargie: 'non', e_elargie_motif: 'test existant modifié : tests/x.test.mjs' },
    { ...F, scenario: '' }, { ...F, acteur: 'christopheplantegenest-prog' }, { ...F, apk: 'false' }, { ...F, doute: 'ticket fermé' }, { ...F, doute: 'ticket fermé', interrupteur_elargie: '' },
    { ...F, classe: 'E', e_auto: 'oui', interrupteur: 'actif' }, { ...F, decision: 'refuser' }, { ...F, interrupteur_elargie: 'oui' },
  ]));
  assert.deepEqual(r.map((x) => [x[0], x[2]]), [['v4', ''], ['auto', 'elargie'], ['auto', 'elargie'], ['auto', 'elargie'], ['v4', ''], ['v4', ''], ['v4', ''], ['v4', ''], ['v4', ''], ['arret', ''], ['v4', ''], ['auto', 'e-stricte'], ['v4', ''], ['v4', '']]);
  assert.match(r[0][1], /interrupteur ATELIER_VOIE_ELARGIE coupé \(mode ombre\)/);
  assert.match(r[5][1], /test existant modifié/);
  assert.match(r[6][1], /aucun scénario d'acceptation gelé/);
});

const PY_ELARGIE = `${PY_MODULE('classer.py')}
sortie = []
for cas in json.load(sys.stdin):
    avant = cas["avant"]; apres = dict(avant)
    for p, v in cas["apres"].items():
        if v is None: apres.pop(p, None)
        else: apres[p] = v
    ch = []
    for p in sorted(set(avant) | set(apres)):
        if p not in apres: ch.append({"chemin": p, "statut": "D"})
        elif p not in avant: ch.append({"chemin": p, "statut": "A"})
        elif avant[p] != apres[p]: ch.append({"chemin": p, "statut": "M"})
    la = lambda p: avant[p].encode() if p in avant else None
    lb = lambda p: apres[p].encode() if p in apres else None
    r = m.classer(ch, la, lb, lambda: sorted(apres))
    sortie.append([r["classe"], r["elargie"]])
print(json.dumps(sortie))`;
test('ROBOT — admissibilité à la voie élargie : app/ applicatif hors socle + nouveaux tests ; jamais le socle cognitif ni le branchement, un test existant modifié, une suppression, une migration, le natif, l\'atelier, ni davantage de stockage, de réseau ou de détection du robot', () => {
  const avant = { 'app/accueil.js': MAIN_BASE, 'app/main.js': "import './accueil.js';\n", 'app/memoire/memoire.js': 'export const x = 0;\n', 'app/reglages/ecran.js': "import { lireStockage } from './stockage.js';\nconst p = localStorage.getItem('p');\n", 'app/memoire/base.js': "export const TABLES = ['a'];\nexport const x = 1;\n", 'tests/base.test.mjs': FIXTURE['tests/base.test.mjs'], 'outils-android/preparer.mjs': '// natif\n' };
  const r = python(PY_ELARGIE, [], JSON.stringify([
    { avant, apres: { 'app/accueil.js': MAIN_CAND(), 'app/salut.js': SALUT, 'tests/salut.test.mjs': TEST_SALUT } },
    { avant, apres: { 'app/memoire/base.js': "export const TABLES = ['a'];\nexport const x = 2;\n" } },
    { avant, apres: { 'app/memoire/base.js': "export const TABLES = ['a', 'b'];\nexport const x = 1;\n" } },
    { avant, apres: { 'app/salut.js': "export const SCHEMA_SAUVEGARDE = 9;\n" } },
    { avant, apres: { 'tests/base.test.mjs': `${FIXTURE['tests/base.test.mjs']}// MISE À JOUR DÉLIBÉRÉE vX : justification longue\n` } },
    { avant, apres: { 'app/accueil.js': null } },
    { avant, apres: { 'outils-android/preparer.mjs': '// natif modifié\n' } },
    { avant, apres: { 'capacitor.config.json': '{}' } },
    { avant, apres: { 'app/capacites/ecran.js': 'x' } },
    { avant, apres: { 'app/atelier/ecran.js': 'x' } },
    // Socle renforcé (point 4) et garde-fous contre un scénario insuffisant (point 2).
    { avant, apres: { 'app/main.js': "import './salut.js';\n" } },
    { avant, apres: { 'app/langage/nouveau-module.js': 'export const x = 1;\n' } },
    { avant, apres: { 'app/memoire/memoire.js': 'export const x = 1;\n' } },
    { avant, apres: { 'app/accueil.js': `${MAIN_BASE}import { oublier } from './memoire/memoire.js';\n` } },
    { avant, apres: { 'app/outil-neuf.js': 'export const lire = () => localStorage.getItem("cle");\n' } },
    { avant, apres: { 'app/outil-neuf.js': 'export const envoyer = (t) => fetch("https://x.example", { body: t });\n' } },
    { avant, apres: { 'app/outil-neuf.js': 'export const sousRobot = () => navigator.webdriver === true;\n' } },
    { avant, apres: { 'app/reglages/ecran.js': `${avant['app/reglages/ecran.js']}const f = window.fetch;\n` } },
    { avant, apres: { 'app/reglages/ecran.js': `${avant['app/reglages/ecran.js']}export const autre = () => lireStockage();\n` } },
  ]));
  assert.deepEqual(r[0], ['S', null]);
  // Point 4 : un module cognitif, même sans migration, n'est JAMAIS admissible (protection renforcée : V4).
  assert.match(r[1][1], /socle cognitif ou branchement/);
  assert.match(r[2][1], /socle cognitif ou branchement/);
  assert.match(r[3][1], /migration/);
  assert.match(r[4][1], /test existant modifié/);
  assert.match(r[5][1], /changement D/);
  assert.match(r[6][1], /hors de app\/ applicatif/);
  assert.match(r[7][1], /hors de app\/ applicatif/);
  assert.match(r[8][1], /hors de app\/ applicatif/);
  assert.match(r[9][1], /hors de app\/ applicatif/, 'l\'écran de l\'atelier reste hors de la voie élargie');
  for (const k of [10, 11, 12]) assert.match(r[k][1], /socle cognitif ou branchement/, `cas ${k}`);
  assert.match(r[13][1], /nouvel import de « app\/memoire\/memoire\.js »/);
  assert.match(r[14][1], /davantage « localStorage »/);
  assert.match(r[15][1], /davantage « fetch »/);
  assert.match(r[16][1], /davantage « webdriver »/);
  assert.match(r[17][1], /davantage « fetch »/);
  assert.deepEqual(r[18], ['S', null], 'un fichier qui employait déjà localStorage peut évoluer sans l\'employer davantage');
});

const PY_JOURNAL = `${PY_MODULE('livraison_auto.py')}
out = []
for cas in json.load(sys.stdin):
    try:
        r = m.scenario_du_journal(cas["journal"], cas["depot"])
        out.append(None if r is None else [r[1], r[2]])
    except m.Doute as d:
        out.append("doute: " + str(d))
print(json.dumps(out))`;
test('ROBOT — scénario lu dans le journal : plan COURANT, empreinte recalculée, avis indépendant conforme, dépôt inscrit après le plan ; sinon doute', () => {
  const j = chantier(JUSQU_AU_COLIS);
  const dep = 'd'.repeat(40);
  const falsifie = structuredClone(j);
  falsifie[1].donnees.plan.scenario.navigateur[1].texte = 'Naissance';
  const sansAvis = j.filter((e) => e.type !== 'avis-scenario');
  const autreLot = [...j, { n: 99, type: 'lot', quand: Q, donnees: {} }];
  const vieux = structuredClone(j);
  delete vieux[1].donnees.plan.scenario;
  const r = python(PY_JOURNAL, [], JSON.stringify([{ journal: j, depot: dep }, { journal: j, depot: 'e'.repeat(40) }, { journal: falsifie, depot: dep }, { journal: sansAvis, depot: dep }, { journal: autreLot, depot: dep }, { journal: vieux, depot: dep }, { journal: 'x', depot: dep }]));
  assert.deepEqual(r[0], [S.empreinteScenario(PLAN_LU().scenario), false]);
  assert.match(r[1], /dépôt absent du journal/);
  assert.match(r[2], /empreinte du scénario différente/);
  assert.match(r[3], /sans avis indépendant conforme/);
  assert.match(r[4], /aucun plan dans le lot courant/);
  assert.equal(r[5], null);
  assert.match(r[6], /journal du chantier illisible/);
});

test('ROBOT — robot.yml : job « acceptation » sans secret, joueur copié hors du dépôt AVANT le colis, contre-épreuve sur la base, livraison bloquée par un scénario non vert', () => {
  const y = lire('.github/workflows/robot.yml');
  const debut = y.indexOf('\n  acceptation:\n');
  const job = y.slice(debut, y.indexOf('\n  opposition:\n'));
  assert.ok(debut > 0);
  assert.match(job, /permissions:\n {6}contents: read\n {4}outputs:/);
  assert.doesNotMatch(job, /secrets\.|environment:|GH_TOKEN|github\.token/);
  const i = (t) => { const k = job.indexOf(t); assert.ok(k > 0, t); return k; };
  assert.ok(i('cp outils-atelier/auto-scenario.mjs') < i('Contre-épreuve sur la base') && i('Contre-épreuve sur la base') < i('deballer.py appliquer') && i('deballer.py appliquer') < i('Scénario sur l\'application livrable'));
  for (const run of job.split('run:').slice(1)) assert.doesNotMatch(run.split('\n      - ')[0], /\$\{\{/);
  assert.match(job, /working-directory: \$\{\{ runner\.temp \}\}\/juge\n[\s\S]*node auto-scenario\.mjs navigateur/);
  assert.match(job, /- name: Verdict d'acceptation \(annotation ACCEPTATION\)\n\s+id: verdict\n\s+if: always\(\)/);
  const liv = y.slice(y.indexOf('\n  livraison:\n'), y.indexOf('\n  site:\n'));
  assert.match(liv, /\(needs\.inventaire\.outputs\.scenario_sha256 == '' \|\| needs\.acceptation\.result == 'success'\)/);
  assert.match(liv, /ROBOT_REGLE: \$\{\{ needs\.inventaire\.outputs\.regle \}\}/);
  assert.match(liv, /ACC_VERDICT: \$\{\{ needs\.acceptation\.outputs\.verdict \}\}/);
  assert.equal(y.match(/vars\.ATELIER_VOIE_ELARGIE/g).length, 1);
  assert.equal(y.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n').match(/livraison-essai/g).length, 1, 'aucun nouvel environnement sans réviseur');
  // La règle de voie (e-stricte ou elargie) ne vient que de l'inventaire, jamais du colis ni de l'acceptation.
  assert.equal((y.match(/ROBOT_REGLE:/g) || []).length, 1);
  // Atelier : la variable du pilote a une valeur par défaut « actif », la voie élargie aucune.
  const a = lire('.github/workflows/atelier-chantier.yml');
  assert.match(a, /ATELIER_PILOTE: \$\{\{ vars\.ATELIER_PILOTE \|\| 'actif' \}\}/);
  assert.doesNotMatch(a, /ATELIER_VOIE_ELARGIE \|\|/);
  assert.match(a.slice(a.indexOf('\n  veille:\n')), /checks: read/);
});

test('ROBOT — deballer.py livrer : la voie élargie est REVÉRIFIÉE (classe, admissibilité, verdict « ok » du même scénario), sinon rien n\'est livré', () => {
  const py = lire('.github/workflows/deballer.py');
  const bloc = py.slice(py.indexOf('if voie == "auto" and regle == "elargie":'), py.indexOf('elif voie == "auto" and (refus is not None'));
  assert.match(bloc, /classification\["classe"\] not in \("E", "O", "S"\)/);
  assert.match(bloc, /classification\.get\("elargie"\) is not None/);
  assert.match(bloc, /os\.environ\.get\("ACC_VERDICT", ""\) != "ok"/);
  assert.match(bloc, /os\.environ\.get\("ACC_EMPREINTE", ""\) != empreinte/);
  assert.match(py, /if voie == "auto" and regle not in \("", "e-stricte", "elargie"\):\n\s+raise Arret/);
});

// ------------------------------------------------------------------------------------------------ 6. agent : sonde
// GO « ATELIER 3 — PRÉPARATION », point 3 : les vérifications indépendantes sont hors d'atteinte de l'agent, à chaque couche.
test('INDÉPENDANCE — juge, règles et scénario hors d\'atteinte de l\'agent : plan, colis, robot, journal', () => {
  // 1. Plan : aucune mission ne peut viser le juge, les règles du robot, les gardes de l'atelier ou la porte d'essai.
  const demande = { texte: 'x', base: { sha: BASE_SHA, version: '0.66.14' } };
  for (const chemin of ['outils-atelier/auto-scenario.mjs', 'outils-atelier/auto-autonome-noyau.mjs', '.github/workflows/classer.py', '.github/workflows/robot.yml', 'tests/atelier-3-boucle.test.mjs', 'app/essais/verrou.js']) {
    const p = PLAN(); p.missions[0].autorises = [chemin];
    assert.match(N.lirePlan(p, { issue: 50, demande }).raison ?? '', /refusé/, chemin);
  }
  // 2. Colis : .github est interdit, le juge est un chemin privilégié (PR P1 seulement), comme tout outils-atelier/auto-*.mjs.
  const r = python(`${PY_MODULE('deballer.py')}
print(json.dumps([".github" in m.DOSSIERS_INTERDITS, any(x.match("outils-atelier/auto-scenario.mjs") for x in m.PRIVILEGIES_MOTIFS)]))`);
  assert.deepEqual(r, [true, true]);
  // 3. Robot : le juge et le scénario sont copiés depuis la BASE (main), hors du dépôt, AVANT que le colis soit appliqué ; le verdict
  //    est calculé sans secret ; la livraison relit l'empreinte du scénario dans le JOURNAL (pas dans le colis).
  const y = lire('.github/workflows/robot.yml');
  const job = y.slice(y.indexOf('\n  acceptation:\n'), y.indexOf('\n  opposition:\n'));
  assert.match(job, /ref: \$\{\{ needs\.inventaire\.outputs\.base_sha \}\}/);
  assert.ok(job.indexOf('cp outils-atelier/auto-scenario.mjs "$RUNNER_TEMP/juge/') < job.indexOf('deballer.py appliquer'));
  assert.doesNotMatch(job.slice(job.indexOf('deballer.py appliquer')), /node (?!auto-scenario\.mjs)|npm (?!install)|npx /);
  const lpy = lire('.github/workflows/livraison_auto.py');
  assert.match(lpy, /def scenario_du_journal/);
  // 4. Journal : le scénario est gelé par son empreinte au plan ; aucune étape ultérieure ne peut le remplacer (test « NOYAU : plan … »).
  assert.ok(N.TYPES_CHANTIER.includes('avis-scenario') && !N.TYPES_CHANTIER.includes('scenario'));
});

test('PREUVE RÉELLE — atelier-3-preuve.yml : sans secret, lecture seule, PR de cette branche seulement ; émulateur réel avec un scénario vert ET une contre-épreuve rouge', () => {
  const y = lire('.github/workflows/atelier-3-preuve.yml');
  assert.match(y, /^permissions:\n {2}contents: read\n/m);
  assert.doesNotMatch(y, /secrets\.|GH_TOKEN|github\.token|environment:|contents: write|pull_request_target/);
  assert.equal((y.match(/github\.event\.pull_request\.head\.ref == 'depot\/atelier-3' && github\.event\.pull_request\.head\.repo\.full_name == github\.repository/g) || []).length, 2);
  for (const run of y.split('run: |').slice(1)) assert.doesNotMatch(run.split('\n      - ')[0], /\$\{\{/);
  assert.match(y, /\[ "\$v" = ok \] && \[ "\$r" = echec \]/);
  // Émulateur : un seul script protégé (.github), chaque phase bornée, échec publié en annotation ; dans le robot, copié AVANT le colis.
  const em = lire('.github/workflows/demarrer-emulateur.sh');
  assert.match(em, /timeout 300 "\$ADB" wait-for-device \|\| echec/);
  assert.match(em, /::error title=Émulateur Android/);
  assert.doesNotMatch(em, /secrets|GH_TOKEN|curl|wget/);
  assert.match(y, /timeout-minutes: 35\n[\s\S]*bash \.github\/workflows\/demarrer-emulateur\.sh "\$RUNNER_TEMP"/);
  const r = lire('.github/workflows/robot.yml');
  assert.ok(r.indexOf('cp .github/workflows/demarrer-emulateur.sh "$RUNNER_TEMP/juge/') < r.indexOf('python3 -I .github/workflows/deballer.py appliquer'));
  assert.match(r, /bash "\$RUNNER_TEMP\/juge\/demarrer-emulateur\.sh" "\$RUNNER_TEMP"/);
  assert.match(y, /ATELIER_EXIGER_NAVIGATEUR=1 node --test tests\/\*\.test\.mjs/, 'sur GitHub, un navigateur absent est un échec, pas un saut');
});

test('AGENT — sonde : brouillon jetable dans app/ et tests/ seulement, suite complète, plan avec scénario ; jamais l\'atelier ni les protections', async () => {
  const T = mkdtempSync(join(tmpdir(), 'sonde-'));
  try {
    appliDans(T, FIXTURE);
    const o = outilsEtape({ etape: 'sonder', racine: T, autorises: ['app/', 'outils-android/'], contexte: { issue: 50, demande: { texte: 'x', base: { sha: BASE_SHA, version: '0.66.14' } }, exigerScenario: true }, suiteComplete: () => ({ code: 1, resume: { total: 3, reussis: 2, echecs: 1 }, sortie: 'not ok 2 - garde\n' }) });
    assert.deepEqual(o.outils.map((x) => x.name), ['lister', 'lire', 'chercher', 'ecrire', 'remplacer', 'executer_tests', 'sonder_suite', 'proposer_plan']);
    assert.match((await o.executer('ecrire', { chemin: 'app/salut.js', contenu: SALUT })).texte, /écrit/);
    for (const p of ['outils-atelier/auto-scenario.mjs', 'app/atelier/x.js', '.github/workflows/robot.yml', 'package.json', 'tests/atelier-3-boucle.test.mjs', 'VERSION']) assert.match((await o.executer('ecrire', { chemin: p, contenu: 'x' })).erreur, /écriture refusée/, p);
    assert.match((await o.executer('sonder_suite', {})).texte, /suite complète : tests 3, réussis 2, échecs 1\nnot ok 2 - garde/);
    assert.match((await o.executer('proposer_plan', { plan: { description: 'x', missions: PLAN().missions, suite: null } })).erreur, /scénario d'acceptation exigé/);
    assert.equal((await o.executer('proposer_plan', { plan: PLAN() })).fin.plan.scenario.but, SCENARIO.but);
    assert.deepEqual(PROFILS.sonder.maxAppels, 60);
    // Avis sur le scénario : lecture et rendre_avis seulement.
    assert.deepEqual(outilsEtape({ etape: 'scenario', racine: T }).outils.map((x) => x.name), ['lister', 'lire', 'chercher', 'rendre_avis']);
    // Les consignes nomment la méthode par sonde et le scénario gelé (lecture seule pour le développeur).
    const m = messageAgent({ etape: 'planifier', issue: 50, demande: { titre: 't', texte: 'x', base: { sha: BASE_SHA, version: '0.66.14' } }, version: '0.66.15', pilote: true, lot: 1 });
    assert.match(m, /PAR SONDE/);
    assert.match(m, /DOIT ÉCHOUER sur la version actuelle/);
    assert.match(messageAgent({ etape: 'scenario', issue: 50, demande: { titre: 't', texte: 'x' }, plan: PLAN_LU() }), /AVIS INDÉPENDANT SUR LE SCÉNARIO/);
  } finally {
    rmSync(T, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------------------------------------ 7. bout en bout
function fauxGithub() {
  const etat = { tickets: new Map(), commentaires: [], relances: [], runs: [], idc: 1, idr: 1000 };
  const runDe = (workflow, extra) => { const r = { id: etat.idr += 1, path: `.github/workflows/${workflow}`, status: 'completed', conclusion: 'success', created_at: new Date().toISOString(), ...extra }; etat.runs.push(r); return r; };
  const serveur = createServer((req, res) => {
    let b = '';
    req.on('data', (x) => { b += x; });
    req.on('end', () => {
      const corps = b ? JSON.parse(b) : null;
      const u = new URL(req.url, 'http://x');
      const p = u.pathname.replace(`/repos/${DEPOT}`, '');
      const envoyer = (code, v) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(v === undefined ? '' : JSON.stringify(v)); };
      let m;
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)$/.exec(p))) return etat.tickets.has(Number(m[1])) ? envoyer(200, etat.tickets.get(Number(m[1]))) : envoyer(404, {});
      if (req.method === 'GET' && p === '/issues') return envoyer(200, [...etat.tickets.values()]);
      if (req.method === 'POST' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) { const c = { id: etat.idc += 1, ticket: Number(m[1]), body: corps.body, created_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), user: { login: 'github-actions[bot]', id: 41898282 } }; etat.commentaires.push(c); return envoyer(201, c); }
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) { const page = Number(u.searchParams.get('page') ?? 1); return envoyer(200, page > 1 ? [] : etat.commentaires.filter((c) => c.ticket === Number(m[1]))); }
      if (req.method === 'PATCH' && (m = /^\/issues\/comments\/(\d+)$/.exec(p))) { const c = etat.commentaires.find((x) => x.id === Number(m[1])); c.body = corps.body; return envoyer(200, c); }
      if (req.method === 'POST' && (m = /^\/actions\/workflows\/([a-z.-]+)\/dispatches$/.exec(p))) {
        etat.relances.push({ workflow: m[1], entrees: corps.inputs });
        if (m[1] === 'atelier-verification.yml') runDe(m[1], { at5: etat.faitsPour(corps.inputs) });
        if (m[1] === 'robot.yml') runDe(m[1], { status: 'in_progress', depot: corps.inputs.depot });
        return envoyer(204);
      }
      if (req.method === 'GET' && (m = /^\/actions\/workflows\/([a-z.-]+)\/runs$/.exec(p))) return envoyer(200, { workflow_runs: etat.runs.filter((r) => r.path.endsWith(m[1])).reverse() });
      if (req.method === 'GET' && (m = /^\/actions\/runs\/(\d+)$/.exec(p))) return envoyer(200, etat.runs.find((r) => r.id === Number(m[1])) ?? { id: Number(m[1]), status: 'completed' });
      if (req.method === 'GET' && (m = /^\/actions\/runs\/(\d+)\/attempts\/1\/jobs$/.exec(p))) {
        const run = etat.runs.find((r) => r.id === Number(m[1]));
        const noms = run?.path.endsWith('robot.yml') ? ['Inventaire (confiance, sans code du colis)', 'Contrôle (code du colis, sorties non fiables)', 'Acceptation (scénario figé avant le développement, joué par le robot)'] : ['faits-git', 'execution', 'assemblage'];
        return envoyer(200, { jobs: noms.map((name, i) => ({ id: Number(m[1]) * 10 + i, name })) });
      }
      if (req.method === 'GET' && (m = /^\/check-runs\/(\d+)\/annotations$/.exec(p))) {
        const run = etat.runs.find((r) => r.id === Math.floor(Number(m[1]) / 10));
        let lignes = [];
        if (run.path.endsWith('robot.yml')) lignes = Number(m[1]) % 10 === 2 && run.acceptation ? [run.acceptation] : [];
        else lignes = Number(m[1]) % 10 === 2 ? annotationsFaits('at5', run.at5) : [];
        return envoyer(200, lignes.map((l) => { const x = /^::notice title=([^:]+)::(.*)$/.exec(l); return { title: x[1], message: x[2], annotation_level: 'notice' }; }));
      }
      return envoyer(404, { message: `inconnu ${req.method} ${p}` });
    });
  });
  return { etat, serveur };
}
function faitsAt5(nu, d) {
  const brut = g(nu, 'diff', '--name-status', '--no-renames', d.base, d.candidat).split('\n').filter(Boolean).map((l) => l.split('\t'));
  return ecrireFaits({
    demande: { ...d },
    diff: { fichiers: brut.map(([s, chemin]) => ({ chemin, etat: { A: 'cree', M: 'modifie' }[s], mode: '100644' })), refuses: [], statut: 'etabli', tests_modifies: [], tests_supprimes: [], zones_touchees: [] },
    erreurs_techniques: [],
    execution: { code: 0, deballer_sha256: '5'.repeat(64), delai_ms: 300000, duree_tests_ms: 1000, fichiers_injectes: ['app/sw.js', 'app/version.js'], injection_relue: true, statut: 'executee', verifier_sha256: '4'.repeat(64), version_injectee: d.version_candidat },
    identite: { base_ancetre: true, base_est_commit: true, base_sur_main: true, base_tag: d.base, branche_existe: true, branche_pointe: d.candidat, branche_pointe_fin: d.candidat, commits: 1, constats: [], est_commit: true, fusions: 0, main: d.base, merge_base: d.base,
      segment: { commits: 0, fichiers: [], fusions: 0, hors_outillage: [], refuses: [], statut: 'etabli' }, statut: 'etablie', tag_ancetre_base: true, tag_candidat_libre: true, version_fichier_base: d.version_base },
    protocole: 'atelier-faits-2',
    provenance: { depot: DEPOT, run_id: '40000000009', verificateur_sha: d.base, workflow_ref: `${DEPOT}/.github/workflows/atelier-verification.yml@refs/heads/main` },
    robot: { erreurs: [], fumee: 'ok', json: 'ok', syntaxe: 'ok' },
    tests: { annules: 0, echecs: 0, ignores: 0, reussis: 10, statut: 'executes', total: 10 },
  }, hache);
}
const usage = { input_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 300 };
const tour = (bs) => ({ emis: true, inconnu: false, statut: 200, json: { content: bs.map(([name, input], i) => ({ type: 'tool_use', id: `u${i}`, name, input })), stop_reason: 'tool_use', usage } });
const fauxClient = (reponses) => ({ compter: async () => 5000, envoyer: async () => reponses.shift() });

function preparer() {
  const T = mkdtempSync(join(tmpdir(), 'atelier3-'));
  const nu = join(T, 'distant.git');
  g(T, 'init', '-q', '--bare', '-b', 'main', nu);
  const graine = join(T, 'graine');
  g(T, 'clone', '-q', nu, graine);
  appliDans(graine, FIXTURE);
  g(graine, 'add', '-A');
  g(graine, 'commit', '-q', '-m', 'base');
  g(graine, 'tag', '-a', 'v0.66.14', '-m', 'v0.66.14');
  g(graine, 'push', '-q', 'origin', 'main', 'v0.66.14');
  const op = join(T, 'operateur');
  g(T, 'clone', '-q', nu, op);
  return { T, nu, op, graine, base: g(nu, 'rev-parse', 'main') };
}
const ctxDe = (op, url, run, elargie = 'actif') => contexte({ GITHUB_REPOSITORY: DEPOT, ATELIER_API_GITHUB: url, ATELIER_RACINE: op, ATELIER_PAUSE_MS: '1', GITHUB_RUN_ID: String(run), ATELIER_PILOTE: 'actif', ATELIER_ELARGIE: elargie });
async function tourAgent(ctx, gh, T, nu, consigne, reponses, nom) {
  const travail = join(T, `travail-${nom}`);
  g(T, 'clone', '-q', nu, travail);
  g(travail, 'checkout', '-q', JSON.parse(readFileSync(consigne, 'utf8')).depart);
  const r = await agent({ consigne, travail, racineOutil: RACINE, client: fauxClient(reponses), suiteComplete: () => ({ code: 0, resume: { total: 11, reussis: 11, echecs: 0 }, sortie: '' }) });
  writeFileSync(join(T, `resultat-${nom}.json`), JSON.stringify(r));
  return bilan(ctx, gh, { consigne, resultat: join(T, `resultat-${nom}.json`) });
}
function lancer(cmd, args, options) {
  return new Promise((ok) => {
    const p = spawn(cmd, args, options);
    let texte = '';
    p.stdout.on('data', (x) => { texte += x; });
    p.stderr.on('data', (x) => { texte += x; });
    p.on('close', (code) => ok({ status: code, texte }));
  });
}
// Un job du robot : copie fraîche du dépôt nu extraite sur D', sorties GITHUB_OUTPUT relues (ou une copie donnée, pour enchaîner des étapes).
async function job({ T, nu, depot, nom, cmd = 'python3', args, env = {}, dossier = null, cwd = null }) {
  const d = dossier ?? join(T, nom);
  if (!dossier) { g(T, 'clone', '-q', nu, d); g(d, 'checkout', '-q', depot); }
  const temp = join(T, 'runner');
  mkdirSync(join(temp, 'controle-apk'), { recursive: true });
  const sortie = join(temp, `sortie-${nom}`);
  writeFileSync(sortie, '');
  const resume = join(temp, `resume-${nom}`);
  writeFileSync(resume, '');
  const r = await lancer(cmd, args, { cwd: cwd ?? d, env: { ...ENV_GIT, RUNNER_TEMP: temp, GITHUB_OUTPUT: sortie, GITHUB_STEP_SUMMARY: resume, GITHUB_REPOSITORY: DEPOT, ...env } });
  const sorties = Object.fromEntries(readFileSync(sortie, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { code: r.status, sorties, texte: r.texte, resume: readFileSync(resume, 'utf8'), d };
}
const py = (script, commande) => ['-I', join(WF, script), commande];
// Le passage du robot, job par job, dans l'ordre de robot.yml (contrôle simulé : verdict ok sur l'arbre attendu ; acceptation RÉELLE).
async function passageRobot({ T, nu, depot, url, elargie = 'actif', n = 1 }) {
  const api = { GITHUB_API_URL: url, PROPRIETAIRE_ID: String(N.PROPRIETAIRE_ID), GH_TOKEN: 'jeton-fictif' };
  const atelier = { EVENEMENT: 'workflow_dispatch', ACTEUR: 'github-actions[bot]', ROBOT_DEPOT: depot };
  const dep = await job({ T, nu, depot, nom: `depot-${n}`, args: py('deballer.py', 'depot'), env: { ROBOT_DEPOT: depot } });
  assert.equal(dep.code, 0, dep.texte);
  const inv = await job({ T, nu, depot, nom: `inventaire-${n}`, args: py('deballer.py', 'inventaire2') });
  const s = inv.sorties;
  const sc = await job({ T, nu, depot, nom: `scenario-${n}`, args: py('livraison_auto.py', 'scenario'), env: { ...atelier, SCENARIO_ESSAIS: '1' } });
  assert.equal(sc.code, 0, sc.texte);
  const voie = await job({ T, nu, depot, nom: `voie-${n}`, args: py('livraison_auto.py', 'voie'), env: {
    ...api, ...atelier, INV_DECISION: s.decision, INV_CLASSE: s.classe, INV_E_AUTO: s.e_auto, INV_E_AUTO_MOTIF: s.e_auto_motif, INV_APK: s.apk, INTERRUPTEUR: '',
    INV_E_ELARGIE: s.e_elargie, INV_E_ELARGIE_MOTIF: s.e_elargie_motif, SCENARIO_SHA256: sc.sorties.scenario_sha256, SCENARIO_MOTIF: sc.sorties.scenario_motif, INTERRUPTEUR_ELARGIE: elargie } });
  assert.equal(voie.code, 0, voie.texte);
  const out = { inv: s, sc: sc.sorties, voie: voie.sorties, acceptation: null, livraison: null };
  if (s.decision !== 'controler' || voie.sorties.voie === 'arret') return out;
  // Job « acceptation » : joueur copié hors du dépôt, contre-épreuve sur la base, colis appliqué par deballer.py, scénario, verdict.
  if (sc.sorties.scenario_sha256) {
    const d = join(T, `acceptation-${n}`);
    g(T, 'clone', '-q', nu, d);
    g(d, 'checkout', '-q', depot);
    const juge = join(T, `juge-${n}`);
    mkdirSync(juge);
    cpSync(join(RACINE, 'outils-atelier', 'auto-scenario.mjs'), join(juge, 'auto-scenario.mjs')); // la base d'essai n'a pas l'outillage
    writeFileSync(join(juge, 'scenario.json'), Buffer.from(sc.sorties.scenario, 'base64'));
    const joueur = (nom, args) => job({ T, nu, depot, nom, dossier: d, cwd: juge, cmd: process.execPath, args: ['auto-scenario.mjs', ...args] });
    const emp = sc.sorties.scenario_sha256;
    await joueur(`base-${n}`, ['navigateur', '--scenario', 'scenario.json', '--empreinte', emp, '--racine', d, '--sortie', 'base.json', '--outils', RACINE]);
    const app = await job({ T, nu, depot, nom: `appliquer-${n}`, dossier: d, args: py('deballer.py', 'appliquer'), env: { INV_BASE_SHA: s.base_sha, INV_ARBRE: s.arbre_attendu, INV_ZIP_SHA256: s.zip_sha256 } });
    assert.equal(app.code, 0, app.texte);
    await joueur(`candidat-${n}`, ['navigateur', '--scenario', 'scenario.json', '--empreinte', emp, '--racine', d, '--sortie', 'candidat.json', '--outils', RACINE]);
    const v = await joueur(`verdict-${n}`, ['verdict', '--scenario', 'scenario.json', '--empreinte', emp, '--candidat', 'candidat.json', '--base', 'base.json', '--android', 'android.json']);
    out.acceptation = { code: v.code, verdict: v.sorties.verdict, annotation: /^::notice title=ACCEPTATION::.*$/m.exec(v.texte)?.[0] ?? null, base: JSON.parse(readFileSync(join(juge, 'base.json'), 'utf8')), candidat: JSON.parse(readFileSync(join(juge, 'candidat.json'), 'utf8')) };
    if (v.code !== 0) return out; // robot.yml : scénario présent et non vert = aucune livraison, quelle que soit la voie
  }
  if (voie.sorties.voie === 'v4') return out; // la V4 attend Christophe (non simulée ici)
  for (let k = 0; k < 2; k += 1) {
    const o = await job({ T, nu, depot, nom: `opposition-${n}-${k}`, args: py('livraison_auto.py', 'opposition'), env: { ...api, TICKET: voie.sorties.ticket, DEPUIS: voie.sorties.depuis } });
    assert.equal(o.code, 0, o.texte);
  }
  writeFileSync(join(T, 'runner', 'controle-apk', 'app.apk'), 'apk-fictif');
  out.livraison = await job({ T, nu, depot, nom: `livraison-${n}`, args: py('deballer.py', 'livrer'), env: {
    ROBOT_DEPOT: depot, ROBOT_VOIE: voie.sorties.voie, ROBOT_REGLE: voie.sorties.regle, INV_SCENARIO_SHA256: sc.sorties.scenario_sha256, ACC_VERDICT: out.acceptation?.verdict ?? '', ACC_EMPREINTE: sc.sorties.scenario_sha256,
    INV_DECISION: s.decision, INV_MOTIF: s.motif ?? '', INV_BASE_SHA: s.base_sha, INV_ZIP_BLOB: s.zip_blob, INV_ZIP_SHA256: s.zip_sha256,
    INV_ARBRE: s.arbre_attendu, INV_VERSION: s.version, CTL_VERDICT: 'ok', CTL_MOTIF: '', CTL_ARBRE: s.arbre_attendu, CTL_APK_SHA256: hache('apk-fictif') } });
  return out;
}
// Fin du passage, vue par GitHub : le passage du robot est terminé, son annotation ACCEPTATION publiée.
function terminerPassage(etat, p) {
  for (const r of etat.runs.filter((x) => x.path.endsWith('robot.yml') && x.status !== 'completed')) { r.status = 'completed'; r.acceptation = p.acceptation?.annotation ?? null; }
}
async function jusquAuDepot({ ctx, gh, T, nu, etat, ticket, mainCand = MAIN_CAND(), apresAvis = () => {} }) {
  etat.tickets.set(ticket, { number: ticket, state: 'open', title: 'Atelier : bouton Saluer', body: 'Un bouton qui salue, la salutation disparaît au rechargement.', user: { id: N.PROPRIETAIRE_ID, login: 'christopheplantegenest-prog' } });
  const consigne = join(T, `consigne-${ticket}.json`);
  const pas = async () => avancer(ctx, gh, { ticket, consigne });
  assert.equal((await pas()).etape, 'planifier');
  assert.equal(JSON.parse(readFileSync(consigne, 'utf8')).maximum, 6 * USD, 'planification par sonde : réserve 6 $');
  await tourAgent(ctx, gh, T, nu, consigne, [tour([['ecrire', { chemin: 'app/salut.js', contenu: SALUT }]]), tour([['sonder_suite', {}]]), tour([['proposer_plan', { plan: PLAN() }]])], `plan-${ticket}`);
  assert.equal((await pas()).etape, 'scenario');
  await tourAgent(ctx, gh, T, nu, consigne, [tour([['rendre_avis', { conforme: true, objections: [] }]])], `scenario-${ticket}`);
  assert.equal((await pas()).etape, 'developper');
  assert.match(messageAgent(JSON.parse(readFileSync(consigne, 'utf8'))), /SCÉNARIO D'ACCEPTATION GELÉ/);
  const b = await tourAgent(ctx, gh, T, nu, consigne, [tour([['ecrire', { chemin: 'app/accueil.js', contenu: mainCand }], ['ecrire', { chemin: 'app/salut.js', contenu: SALUT }], ['ecrire', { chemin: 'tests/salut.test.mjs', contenu: TEST_SALUT }]]), tour([['terminer', { statut: 'candidat', resume: 'bouton ajouté' }]])], `dev-${ticket}`);
  assert.deepEqual(b.evenements, ['candidat']);
  const v = await pas();
  assert.equal(v.verdict, 'verification-technique-conforme', v.raisons?.join('\n'));
  assert.equal((await pas()).etape, 'avis');
  await tourAgent(ctx, gh, T, nu, consigne, [tour([['rendre_avis', { conforme: true, objections: [] }]])], `avis-${ticket}`);
  await apresAvis();
  return { consigne, pas };
}

test('BOUT EN BOUT : « Atelier : bouton Saluer » -> sonde -> scénario gelé et relu -> développement -> validation PAR LE SCÉNARIO -> robot (acceptation RÉELLE, voie élargie) -> ACQUIS, sans aucun geste de Christophe', AVEC_NAVIGATEUR, async () => {
  const { T, nu, op, base } = preparer();
  const { etat, serveur } = fauxGithub();
  etat.faitsPour = (d) => faitsAt5(nu, d);
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  try {
    const ctx = ctxDe(op, url, 300);
    const gh = github(ctx);
    const { pas } = await jusquAuDepot({ ctx, gh, T, nu, etat, ticket: 60 });
    // Mission cognitive : validée par le scénario (voie élargie active), pas par /valider.
    assert.equal((await pas()).etape, 'valider-auto');
    const l = await pas();
    assert.equal(l.etape, 'livrer');
    assert.equal(l.parent, base);
    const e1 = N.etatChantier(lireJournal(ctx).chantier(60));
    assert.equal(e1.livraison.depot, l.depot, 'dépôt inscrit au journal (avant le lancement du robot)');
    assert.deepEqual(etat.relances.at(-1), { workflow: 'robot.yml', entrees: { depot: l.depot } });

    const p = await passageRobot({ T, nu, depot: l.depot, url });
    assert.equal(p.inv.classe, 'S');
    assert.equal(p.inv.e_elargie, 'oui', p.inv.e_elargie_motif);
    assert.equal(p.sc.scenario_sha256, e1.scenarioSha);
    assert.deepEqual([p.voie.voie, p.voie.regle, p.voie.ticket], ['auto', 'elargie', '60']);
    assert.equal(p.acceptation.base.verdict, 'echec', 'contre-épreuve : rouge sur la base');
    assert.equal(p.acceptation.candidat.verdict, 'ok', p.acceptation.candidat.motif);
    assert.equal(p.acceptation.verdict, 'ok');
    assert.equal(p.livraison.sorties.livre, 'true', p.livraison.texte);
    const livre = g(nu, 'rev-parse', 'main');
    assert.equal(g(nu, 'rev-parse', `${livre}^`), l.depot);
    assert.equal(g(nu, 'show', `${livre}:app/salut.js`), SALUT.trim());

    terminerPassage(etat, p);
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 60 : livraison livre (acceptation ok)']);
    const c = await pas();
    assert.deepEqual([c.etape, c.statut], ['conclure', 'acquis']);
    const e = N.etatChantier(lireJournal(ctx).chantier(60));
    assert.equal(e.termine, true);
    assert.deepEqual(e.resultat.preuve.versions, ['0.66.15']);
    // Le résultat est publié dans le ticket et lu par l'écran de Naissance.
    const dernier = etat.commentaires.filter((x) => x.ticket === 60).at(-1).body;
    assert.match(dernier, /Résultat : ✅ ACQUIS/);
    const r = E.resumer(etat.tickets.get(60), etat.commentaires.filter((x) => x.ticket === 60));
    assert.equal(r.situation.code, 'resultat');
    assert.equal(r.etat.resultat.statut, 'acquis');
    assert.ok(r.etat.depense > 0 && r.etat.depense <= 40 * USD);
    // Zéro geste : aucun commentaire de Christophe, aucune approbation (voie élargie), aucune question posée.
    assert.equal(etat.commentaires.filter((x) => x.user.id === N.PROPRIETAIRE_ID).length, 0);
    assert.equal(N.etatChantier(lireJournal(ctx).chantier(60)).reponses.length, 0);
  } finally {
    serveur.close();
    rmSync(T, { recursive: true, force: true });
  }
});

test('CONTRE-ÉPREUVES de bout en bout : scénario ROUGE (rien n\'est livré, résultat « echec ») ; interrupteur coupé (/valider et V4 restent) ; journal falsifié refusé', AVEC_NAVIGATEUR, async () => {
  const { T, nu, op, base } = preparer();
  const { etat, serveur } = fauxGithub();
  etat.faitsPour = (d) => faitsAt5(nu, d);
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  try {
    // a. Le candidat affiche autre chose que ce que le scénario attend : contre-épreuve rouge, candidat rouge, AUCUNE livraison.
    const ctx = ctxDe(op, url, 400);
    const gh = github(ctx);
    const { pas } = await jusquAuDepot({ ctx, gh, T, nu, etat, ticket: 61, mainCand: MAIN_CAND('Salut') });
    assert.equal((await pas()).etape, 'valider-auto');
    const l = await pas();
    const p = await passageRobot({ T, nu, depot: l.depot, url, n: 2 });
    assert.equal(p.voie.voie, 'auto');
    assert.equal(p.acceptation.verdict, 'echec');
    assert.match(p.acceptation.candidat.motif, /étape 2 \(voir « Bonjour de l'Atelier 3 »\)/);
    assert.equal(p.livraison, null);
    assert.equal(g(nu, 'rev-parse', 'main'), base, 'rien n\'est écrit sur main');
    terminerPassage(etat, p);
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 61 : livraison echec (acceptation echec)']);
    const c = await pas();
    assert.deepEqual([c.etape, c.statut], ['conclure', 'echec']);
    assert.match(etat.commentaires.filter((x) => x.ticket === 61).at(-1).body, /Résultat : ❌ ÉCHEC\*\* — Scénario d'acceptation : echec/);
    // Même avec la voie élargie FORCÉE à la livraison, deballer.py refuse sans un verdict « ok » du même scénario.
    const force = await job({ T, nu, depot: l.depot, nom: 'livraison-forcee', args: py('deballer.py', 'livrer'), env: {
      ROBOT_DEPOT: l.depot, ROBOT_VOIE: 'auto', ROBOT_REGLE: 'elargie', INV_SCENARIO_SHA256: p.sc.scenario_sha256, ACC_VERDICT: 'echec', ACC_EMPREINTE: p.sc.scenario_sha256,
      INV_DECISION: 'controler', INV_BASE_SHA: p.inv.base_sha, INV_ZIP_BLOB: p.inv.zip_blob, INV_ZIP_SHA256: p.inv.zip_sha256, INV_ARBRE: p.inv.arbre_attendu, INV_VERSION: p.inv.version, CTL_VERDICT: 'ok', CTL_ARBRE: p.inv.arbre_attendu, CTL_APK_SHA256: hache('apk-fictif') } });
    assert.equal(force.code, 1);
    assert.match(force.resume, /voie élargie : verdict d'acceptation absent, négatif ou d'un autre scénario, rien n'est livré/);
    const autre = await job({ T, nu, depot: l.depot, nom: 'livraison-autre-scenario', args: py('deballer.py', 'livrer'), env: {
      ROBOT_DEPOT: l.depot, ROBOT_VOIE: 'auto', ROBOT_REGLE: 'elargie', INV_SCENARIO_SHA256: p.sc.scenario_sha256, ACC_VERDICT: 'ok', ACC_EMPREINTE: '0'.repeat(64),
      INV_DECISION: 'controler', INV_BASE_SHA: p.inv.base_sha, INV_ZIP_BLOB: p.inv.zip_blob, INV_ZIP_SHA256: p.inv.zip_sha256, INV_ARBRE: p.inv.arbre_attendu, INV_VERSION: p.inv.version, CTL_VERDICT: 'ok', CTL_ARBRE: p.inv.arbre_attendu, CTL_APK_SHA256: hache('apk-fictif') } });
    assert.equal(autre.code, 1);
    assert.equal(g(nu, 'rev-parse', 'main'), base);

    // b. Interrupteur de la voie élargie COUPÉ (état livré par la PR) : la mission cognitive attend /valider, et le robot prend la V4.
    const ctx2 = ctxDe(op, url, 500, '');
    const gh2 = github(ctx2);
    const s2 = await jusquAuDepot({ ctx: ctx2, gh: gh2, T, nu, etat, ticket: 62 });
    const a = await s2.pas();
    assert.equal(a.raison, 'attente-validation');
    assert.match(etat.commentaires.filter((x) => x.ticket === 62).at(-1).body, /valider en écrivant `\/valider`/);
    const j62 = lireJournal(ctx2).chantier(62);
    await ecrireJournal(ctx2, () => ({ chantiers: { 62: N.appliquerChantier(j62, { type: 'validation', quand: Q, donnees: { par: N.PROPRIETAIRE_ID } }) }, message: '/valider (simulé)' }));
    const l2 = await s2.pas();
    const p2 = await passageRobot({ T, nu, depot: l2.depot, url, elargie: '', n: 3 });
    assert.equal(p2.voie.voie, 'v4');
    assert.match(p2.voie.voie_motif, /interrupteur ATELIER_VOIE_ELARGIE coupé \(mode ombre\)/);
    assert.equal(p2.acceptation.verdict, 'ok', 'le scénario est joué aussi sur la voie V4');
    assert.equal(p2.livraison, null, 'la V4 attend Christophe');

    // c. Journal falsifié (scénario modifié après son gel, empreinte inchangée) : l'opérateur refuse de le rejouer, le robot n'en lit rien.
    const j = lireJournal(ctx2).chantier(62);
    const faux = structuredClone(j);
    faux.find((x) => x.type === 'plan').donnees.plan.scenario.navigateur[1].texte = 'Naissance';
    await ecrireJournal(ctx2, () => ({ chantiers: { 62: faux }, message: 'falsification' }));
    await assert.rejects(avancer(ctx2, gh2, { ticket: 62, consigne: join(T, 'c62.json') }), /empreinte différente/);
    const p3 = await passageRobot({ T, nu, depot: l2.depot, url, n: 4 });
    assert.equal(p3.sc.scenario_sha256, '');
    assert.match(p3.sc.scenario_motif, /empreinte du scénario différente/);
    assert.equal(p3.voie.voie, 'v4', 'sans scénario gelé lisible : jamais la voie élargie');
  } finally {
    serveur.close();
    rmSync(T, { recursive: true, force: true });
  }
});

test('MAIN AVANCÉE pendant le chantier : fichiers disjoints = colis refait sur la tête de main et livré ; conflit = lot repris depuis main (sans question)', AVEC_NAVIGATEUR, async () => {
  const { T, nu, op, graine } = preparer();
  const { etat, serveur } = fauxGithub();
  etat.faitsPour = (d) => faitsAt5(nu, d);
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  const pousserMain = (f, c, msg) => { g(graine, 'pull', '-q', 'origin', 'main'); writeFileSync(join(graine, f), c); g(graine, 'add', '-A'); g(graine, 'commit', '-q', '-m', msg); g(graine, 'push', '-q', 'origin', 'main'); return g(graine, 'rev-parse', 'HEAD'); };
  try {
    const ctx = ctxDe(op, url, 600);
    const gh = github(ctx);
    // a. Une PR d'outillage fusionnée pendant le chantier (fichier sans rapport) : le colis repart de la nouvelle tête, le robot livre.
    let tete = null;
    const s = await jusquAuDepot({ ctx, gh, T, nu, etat, ticket: 63, apresAvis: () => { tete = pousserMain('docs.md', 'outillage\n', 'PR outillage'); } });
    assert.equal((await s.pas()).etape, 'valider-auto');
    const l = await s.pas();
    assert.equal(l.etape, 'livrer');
    assert.equal(l.parent, tete);
    assert.equal(g(nu, 'rev-parse', `${l.depot}^`), tete);
    const p = await passageRobot({ T, nu, depot: l.depot, url, n: 5 });
    assert.equal(p.acceptation.verdict, 'ok');
    assert.equal(p.livraison.sorties.livre, 'true', p.livraison.texte);
    assert.equal(g(nu, 'show', 'main:docs.md'), 'outillage');
    terminerPassage(etat, p);
    await veille(ctx, gh);
    assert.equal((await s.pas()).statut, 'acquis');

    // b. Main change les MÊMES lignes que le candidat : conflit -> le lot repart de la tête de main (plan neuf, identifiants l2-…).
    const s2 = await jusquAuDepot({ ctx, gh, T, nu, etat, ticket: 64, mainCand: MAIN_CAND('Bonjour de nouveau'), apresAvis: () => { pousserMain('app/accueil.js', "// application d'essai modifiée ailleurs\ndocument.documentElement.dataset.demarrage = 'ok';\n", 'changement concurrent'); } });
    assert.equal((await s2.pas()).etape, 'valider-auto');
    const bloc = await s2.pas();
    assert.deepEqual([bloc.etape, bloc.raison], ['bloquer', 'conflit-main']);
    const lot = await s2.pas();
    assert.deepEqual([lot.etape, lot.raison], ['lot', 'conflit-main']);
    const e = N.etatChantier(lireJournal(ctx).chantier(64));
    assert.deepEqual([e.lots, e.plan, e.demande.base.sha], [2, null, g(nu, 'rev-parse', 'main')]);
    assert.equal(etat.commentaires.filter((x) => x.user.id === N.PROPRIETAIRE_ID).length, 0);
  } finally {
    serveur.close();
    rmSync(T, { recursive: true, force: true });
  }
});
