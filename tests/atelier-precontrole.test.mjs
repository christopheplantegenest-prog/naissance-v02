// GO « ATELIER 3 — CORRECTION P1 SOUS CONDITIONS » (27/10/2026) : outillage non cognitif, aucune acquisition de Naissance (D-007).
// Défauts réels révélés après le ticket 33 (D1 rejouée) et la préparation de v0.66.15 :
//  1. le robot refusait TOUTE base depuis la PR 30 : le joueur de scénario (privilégié) chargeait Playwright dynamiquement ;
//  2. AT-5 refusait l'identité de tout candidat (code applicatif sur main depuis v0.66.14) et l'Atelier relançait quand même l'agent
//     (6 tentatives, 2,17 $) pour un défaut extérieur au candidat.
// Ces tests jouent le VRAI deballer.py sur une COPIE DE L'ARBRE RÉEL du dépôt (fichiers privilégiés compris), là où les fixtures
// synthétiques des tests précédents ne contenaient pas le joueur : c'est ce trou qui avait laissé passer le défaut 1.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireFaits } from '../app/atelier/verification.js';
import { annotationsFaits } from '../app/atelier/retour.js';
import { etatBudget } from '../app/atelier/budget.js';
import { etatChantier, etapePilote, PROPRIETAIRE_ID } from '../outils-atelier/auto-autonome-noyau.mjs';
import { contexte, github, avancer, agent, bilan, commande, lireJournal } from '../outils-atelier/auto-autonome.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const WF = join(RACINE, '.github', 'workflows');
const DEPOT = 'christopheplantegenest-prog/naissance-v02';
const ENV_GIT = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GITHUB_') && !k.startsWith('PRECONTROLE_'))), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
const hache = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const LIGNE_TOLEREE = "try { return nodeModule.createRequire(path.join(outils ?? process.cwd(), 'package.json'))('playwright'); } catch { return import('playwright'); }";
function g(d, ...a) {
  const r = spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: ENV_GIT, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}
function deballer(dossier, commande, env = {}) {
  const temp = mkdtempSync(join(tmpdir(), 'runner-'));
  const sortie = join(temp, 'sortie');
  writeFileSync(sortie, '');
  const r = spawnSync('python3', ['-I', '-B', join(WF, 'deballer.py'), commande], { cwd: dossier, encoding: 'utf8', env: { ...ENV_GIT, RUNNER_TEMP: temp, GITHUB_OUTPUT: sortie, GITHUB_STEP_SUMMARY: join(temp, 'resume'), ...env } });
  const sorties = Object.fromEntries(readFileSync(sortie, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  rmSync(temp, { recursive: true, force: true });
  return { code: r.status, sorties, texte: `${r.stdout}${r.stderr}`, json: (() => { try { return JSON.parse(r.stdout.trim().split('\n').pop()); } catch { return null; } })() };
}
const precontrole = (d, base, version = null) => deballer(d, 'precontrole', { PRECONTROLE_BASE: base, ...(version ? { PRECONTROLE_VERSION: version } : {}) });

// Zip minimal (méthode « stocké ») : _livraison.json + fichiers donnés.
function zip(entrees) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; };
  const locaux = [];
  const centraux = [];
  let decalage = 0;
  for (const [nom, contenu] of entrees) {
    const n = Buffer.from(nom, 'utf8');
    const b = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu, 'utf8');
    const l = Buffer.alloc(30); l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(0x0800, 6); l.writeUInt32LE(crc(b), 14); l.writeUInt32LE(b.length, 18); l.writeUInt32LE(b.length, 22); l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt32LE(crc(b), 16); c.writeUInt32LE(b.length, 20); c.writeUInt32LE(b.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE((0o100644 << 16) >>> 0, 38); c.writeUInt32LE(decalage, 42);
    locaux.push(l, n, b);
    centraux.push(c, n);
    decalage += 30 + n.length + b.length;
  }
  const central = Buffer.concat(centraux);
  const fin = Buffer.alloc(22); fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entrees.length, 8); fin.writeUInt16LE(entrees.length, 10); fin.writeUInt32LE(central.length, 12); fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...locaux, central, fin]);
}

// ------------------------------------------------------------------------------------------------ copie de l'arbre réel
let T;
let MODELE; // dépôt git de l'arbre réel, étiqueté v<VERSION> sur sa tête
let VERSION_REELLE;
const suivante = (v) => { const [a, b, c] = v.split('.').map(Number); return `${a}.${b}.${c + 1}`; };
before(() => {
  T = mkdtempSync(join(tmpdir(), 'precontrole-'));
  MODELE = join(T, 'modele');
  cpSync(RACINE, MODELE, { recursive: true, filter: (s) => !s.split(sep).includes('.git') && !s.split(sep).includes('node_modules') && !s.split(sep).includes('__pycache__') });
  g(T, 'init', '-q', '-b', 'main', MODELE);
  g(MODELE, 'add', '-A');
  g(MODELE, 'commit', '-q', '-m', 'arbre réel');
  VERSION_REELLE = readFileSync(join(MODELE, 'VERSION'), 'utf8').trim();
  g(MODELE, 'tag', '-a', `v${VERSION_REELLE}`, '-m', 'version publiée');
});
after(() => { if (T) rmSync(T, { recursive: true, force: true }); });
let n = 0;
function copie() {
  const d = join(T, `copie-${n += 1}`);
  g(T, 'clone', '-q', MODELE, d);
  g(d, 'fetch', '-q', '--tags', 'origin');
  return d;
}
function commit(d, fichiers, message = 'changement') {
  for (const [f, c] of Object.entries(fichiers)) { mkdirSync(dirname(join(d, f)), { recursive: true }); writeFileSync(join(d, f), c); }
  g(d, 'add', '-A');
  g(d, 'commit', '-q', '-m', message);
  return g(d, 'rev-parse', 'HEAD');
}
// Dépôt D' : un seul zip ajouté à la racine (un fichier identique à la base, version suivante), comme une publication sans changement.
function deposer(d, entrees = null) {
  const v = suivante(readFileSync(join(d, 'VERSION'), 'utf8').trim());
  const z = zip(entrees ?? [['_livraison.json', JSON.stringify({ version: v, apk: true, description: 'publication' })], ['app/index.html', readFileSync(join(d, 'app', 'index.html'))]]);
  writeFileSync(join(d, `publication-v${v}.zip`), z);
  g(d, 'add', '-A');
  g(d, 'commit', '-q', '-m', 'dépôt');
  return v;
}

// ------------------------------------------------------------------------------------------------ 1. inventaire du robot
test('BASE RÉELLE ACCEPTÉE : précontrôle « ok » sur l\'arbre réel étiqueté, et l\'inventaire du robot (deballer.py réel) contrôle une publication sans changement', () => {
  const d = copie();
  const base = g(d, 'rev-parse', 'HEAD');
  const p = precontrole(d, base, suivante(VERSION_REELLE));
  assert.equal(p.code, 0, p.texte);
  assert.deepEqual(p.json, { statut: 'ok', motifs: [] }, p.texte);
  const v = deposer(d);
  const inv = deballer(d, 'inventaire2');
  assert.equal(inv.sorties.decision, 'controler', inv.texte);
  assert.equal(inv.sorties.version, v);
  assert.equal(inv.sorties.classe, 'S', 'aucun changement de contenu : voie V4');
  assert.deepEqual(JSON.parse(inv.sorties.chemins).map((x) => x.split(' ')[1]).filter((x) => !x.endsWith('.zip')).sort(), ['VERSION', 'app/sw.js', 'app/version.js', 'package.json'], 'seule la version change');
});

test('CHARGEMENT DYNAMIQUE : la ligne tolérée est la seule du joueur ; une ligne de plus, une ligne changée ou un autre fichier privilégié = base refusée', () => {
  const py = readFileSync(join(WF, 'deballer.py'), 'utf8');
  assert.ok(py.includes(`"${LIGNE_TOLEREE.slice(0, LIGNE_TOLEREE.indexOf('catch'))}"\n    "catch { return import('playwright'); }")`), 'tolérance d\'UNE ligne exacte');
  const joueur = readFileSync(join(RACINE, 'outils-atelier', 'auto-scenario.mjs'), 'utf8');
  assert.deepEqual(joueur.split('\n').filter((l) => /\bimport\s*\(|\brequire\s*\(|\bcreateRequire\b/.test(l)).map((l) => l.trim()), [LIGNE_TOLEREE]);
  const cas = [
    ['ligne de plus', 'outils-atelier/auto-scenario.mjs', (t) => `${t}export const autre = () => import('./autre.mjs');\n`],
    ['ligne changée', 'outils-atelier/auto-scenario.mjs', (t) => t.replace("return import('playwright');", "return import('playwright-core');")],
    ['require ajouté', 'outils-atelier/auto-scenario.mjs', (t) => `${t}export const r = (x) => nodeModule.createRequire(x);\n`],
    ['autre fichier privilégié', 'outils-atelier/auto-autonome-noyau.mjs', (t) => `${t}export const charger = (u) => import(u);\n`],
    ['porte d\'essai', 'app/essais/registre-essais.js', (t) => `${t}export const charger = (u) => import(u);\n`],
  ];
  for (const [nom, f, changer] of cas) {
    const d = copie();
    const base = commit(d, { [f]: changer(readFileSync(join(d, f), 'utf8')) }, nom);
    g(d, 'tag', '-f', '-a', `v${VERSION_REELLE}`, '-m', 'version publiée (déplacée pour isoler le cas)');
    const p = precontrole(d, base);
    assert.equal(p.json?.statut, 'refus', `${nom} : ${p.texte}`);
    assert.ok(p.json.motifs.some((m) => m.startsWith('inventaire du robot : chargement dynamique dans un fichier privilégié')), `${nom} : ${p.json.motifs}`);
    deposer(d);
    const inv = deballer(d, 'inventaire2');
    assert.equal(inv.sorties.decision, 'stop', nom);
    assert.match(inv.sorties.motif, /chargement dynamique dans un fichier privilégié/, nom);
  }
});

test('JOUEUR INTOUCHABLE : un colis qui modifie (ou ajoute à côté) le joueur de scénario est refusé par l\'inventaire', () => {
  for (const [f, contenu] of [
    ['outils-atelier/auto-scenario.mjs', (d) => readFileSync(join(d, 'outils-atelier', 'auto-scenario.mjs'), 'utf8').replace("return import('playwright');", "return import('./faux.mjs');")],
    ['outils-atelier/auto-scenario.mjs', () => '// vidé\n'],
    ['outils-atelier/auto-joueur.mjs', () => "export const x = () => import('playwright');\n"],
  ]) {
    const d = copie();
    const v = suivante(VERSION_REELLE);
    deposer(d, [['_livraison.json', JSON.stringify({ version: v, apk: false, description: 'tentative' })], [f, contenu(d)]]);
    const inv = deballer(d, 'inventaire2');
    assert.equal(inv.sorties.decision, 'refuser', `${f} : ${inv.texte}`);
    assert.match(inv.sorties.motif, /chemin privilégié « outils-atelier\/auto-[a-z]+\.mjs » : dépôt manuel seulement/);
  }
});

// ------------------------------------------------------------------------------------------------ 2. identité (segment depuis la version publiée)
test('PRÉCONTRÔLE — identité : code hors outillage après la version publiée = refus (cas du ticket 33) ; outillage seul = admis ; fusion, étiquette absente, version déjà prise = refus', () => {
  const d = copie();
  const outil = commit(d, { 'outils-atelier/note.txt': 'x\n', '.github/workflows/LISEZMOI.md': 'x\n', 'tests/atelier-x.test.mjs': 'import test from "node:test";\n' }, 'outillage');
  assert.deepEqual(precontrole(d, outil).json, { statut: 'ok', motifs: [] });
  const app = commit(d, { 'app/capacites/ecran.js': `${readFileSync(join(d, 'app', 'capacites', 'ecran.js'), 'utf8')}// changé\n`, 'outils-android/preparer.mjs': `${readFileSync(join(d, 'outils-android', 'preparer.mjs'), 'utf8')}// changé\n` }, 'applicatif non publié');
  const p = precontrole(d, app);
  assert.equal(p.json.statut, 'refus');
  assert.deepEqual(p.json.motifs, [
    `identité AT-5 : « app/capacites/ecran.js » changé depuis v${VERSION_REELLE} hors de l'outillage (version à publier d'abord)`,
    `identité AT-5 : « outils-android/preparer.mjs » changé depuis v${VERSION_REELLE} hors de l'outillage (version à publier d'abord)`,
  ]);
  // Fusion entre l'étiquette et la base.
  const e = copie();
  g(e, 'checkout', '-q', '-b', 'cote');
  commit(e, { 'outils-atelier/a.txt': 'a\n' });
  g(e, 'checkout', '-q', 'main');
  commit(e, { 'outils-atelier/b.txt': 'b\n' });
  g(e, 'merge', '-q', '--no-ff', '-m', 'fusion', 'cote');
  assert.match(precontrole(e, g(e, 'rev-parse', 'HEAD')).json.motifs.join('\n'), /1 commit\(s\) de fusion/);
  // Étiquette absente ; version visée déjà prise ; pas plus grande.
  const f = copie();
  g(f, 'tag', '-d', `v${VERSION_REELLE}`);
  assert.match(precontrole(f, g(f, 'rev-parse', 'HEAD')).json.motifs.join('\n'), /étiquette v[0-9.]+ absente/);
  const h = copie();
  g(h, 'tag', `v${suivante(VERSION_REELLE)}`);
  assert.match(precontrole(h, g(h, 'rev-parse', 'HEAD'), suivante(VERSION_REELLE)).json.motifs.join('\n'), /l'étiquette v[0-9.]+ existe déjà/);
  assert.match(precontrole(h, g(h, 'rev-parse', 'HEAD'), VERSION_REELLE).json.motifs.join('\n'), /pas plus grande/);
  // Clé de signature absente de la base : la livraison de l'APK échouerait.
  const k = copie();
  g(k, 'rm', '-q', 'signature/naissance.jks');
  g(k, 'commit', '-q', '-m', 'clé retirée');
  g(k, 'tag', '-f', '-a', `v${VERSION_REELLE}`, '-m', 'version publiée (déplacée)');
  assert.deepEqual(precontrole(k, g(k, 'rev-parse', 'HEAD')).json.motifs, ['livraison : clé de signature absente de la base (APK impossible)']);
  // Base inconnue : refus, pas d'exception ; entrée mal formée : précontrôle impossible (code 1, l'opérateur refuse).
  assert.deepEqual(precontrole(h, 'f'.repeat(40)).json, { statut: 'refus', motifs: [`base ${'f'.repeat(12)} absente du dépôt`] });
  const x = precontrole(h, 'pas-un-sha');
  assert.deepEqual([x.code, x.json.statut], [1, 'impossible']);
});

test('PRÉCONTRÔLE : même liste d\'outillage que la vérification AT-5 (app/atelier/verification.js), sans la modifier', () => {
  const js = /const OUTILLAGE = Object\.freeze\(\[([^\]]*)\]\);/.exec(readFileSync(join(RACINE, 'app', 'atelier', 'verification.js'), 'utf8'))[1];
  const py = /OUTILLAGE_SEGMENT = \(([^)]*)\)/.exec(readFileSync(join(WF, 'deballer.py'), 'utf8'))[1];
  const liste = (t) => [...t.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(liste(py), liste(js));
  assert.deepEqual(liste(js), ['.github/workflows/', 'outils-atelier/', 'tests/atelier-']);
});

// ------------------------------------------------------------------------------------------------ 3. délai de 300 s
test('DÉLAI : 300 s inchangé ; un dépassement est dit tel quel (suite interrompue, « ❌ tests automatiques en échec : délai … dépassé »), code 1, rien d\'autre n\'est affaibli', () => {
  const v = readFileSync(join(WF, 'verifier.mjs'), 'utf8');
  assert.equal(/function lancerTests\(\)[\s\S]*?\btimeout:\s*(\d+)/.exec(v)[1], '300000');
  assert.match(v, /^const DELAI_TESTS_MS = 300000;$/m);
  // Copie du VRAI vérificateur, délai réduit à 1,5 s pour l'épreuve (et sans le navigateur, hors sujet), sur une application dont un test dure 20 s.
  const d = mkdtempSync(join(tmpdir(), 'delai-'));
  try {
    const robot = join(d, 'robot');
    mkdirSync(robot);
    writeFileSync(join(robot, 'verifier.mjs'), v.replace('timeout: 300000,', 'timeout: 1500,').replace('const DELAI_TESTS_MS = 300000;', 'const DELAI_TESTS_MS = 1500;').replace('await testDeFumee();', '{ /* navigateur hors sujet ici */ }'));
    const appli = join(d, 'appli');
    mkdirSync(join(appli, 'app'), { recursive: true });
    mkdirSync(join(appli, 'tests'));
    writeFileSync(join(appli, 'app', 'index.html'), '<!doctype html>\n');
    writeFileSync(join(appli, 'tests', 'lent.test.mjs'), "import test from 'node:test';\ntest('lent', async () => { await new Promise((r) => setTimeout(r, 20000)); });\n");
    const debut = Date.now();
    const r = spawnSync(process.execPath, [join(robot, 'verifier.mjs'), '--version', '9.9.9', '--rapport', join(d, 'rapport'), '--outils', join(d, 'sans-outils')], { cwd: appli, encoding: 'utf8', timeout: 60_000, env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT')) });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /^❌ tests automatiques en échec : délai de 2 s dépassé, suite interrompue \(rien n'est livré ; relancer\)$/m);
    assert.ok(Date.now() - debut < 20000, 'la suite est bien interrompue au délai');
    // La ligne reste lue par la vérification AT-5 (même préfixe) et par le robot (motif « vérification échouée : … »).
    const lc = readFileSync(join(RACINE, 'outils-atelier', 'verifier-candidat.mjs'), 'utf8');
    assert.ok(new RegExp(/const LIGNE_TESTS = (\/.*\/);/.exec(lc)[1].slice(1, -1)).test('❌ tests automatiques en échec : délai de 300 s dépassé, suite interrompue (rien n\'est livré ; relancer)'));
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------------------------------------ 4. opérateur : blocage d'infrastructure sans dépense
function fauxGithub() {
  const etat = { tickets: new Map(), commentaires: [], relances: [], runs: [], idc: 1, idr: 1000 };
  const serveur = createServer((req, res) => {
    let b = '';
    req.on('data', (x) => { b += x; });
    req.on('end', () => {
      const corps = b ? JSON.parse(b) : null;
      const u = new URL(req.url, 'http://x');
      const p = u.pathname.replace(`/repos/${DEPOT}`, '');
      const envoyer = (code, v) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(v === undefined ? '' : JSON.stringify(v)); };
      let m;
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)$/.exec(p))) return envoyer(200, etat.tickets.get(Number(m[1])));
      if (req.method === 'POST' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) { const c = { id: etat.idc += 1, ticket: Number(m[1]), body: corps.body, user: { login: 'github-actions[bot]' } }; etat.commentaires.push(c); return envoyer(201, c); }
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) return envoyer(200, etat.commentaires.filter((c) => c.ticket === Number(m[1])));
      if (req.method === 'PATCH' && (m = /^\/issues\/comments\/(\d+)$/.exec(p))) { const c = etat.commentaires.find((x) => x.id === Number(m[1])); c.body = corps.body; return envoyer(200, c); }
      if (req.method === 'POST' && (m = /^\/actions\/workflows\/([a-z.-]+)\/dispatches$/.exec(p))) {
        etat.relances.push({ workflow: m[1], entrees: corps.inputs });
        if (m[1] === 'atelier-verification.yml') etat.runs.push({ id: etat.idr += 1, path: `.github/workflows/${m[1]}`, status: 'completed', conclusion: 'success', at5: etat.faitsPour(corps.inputs) });
        return envoyer(204);
      }
      if (req.method === 'GET' && (m = /^\/actions\/workflows\/([a-z.-]+)\/runs$/.exec(p))) return envoyer(200, { workflow_runs: etat.runs.filter((r) => r.path.endsWith(m[1])).reverse() });
      if (req.method === 'GET' && (m = /^\/actions\/runs\/(\d+)$/.exec(p))) return envoyer(200, etat.runs.find((r) => r.id === Number(m[1])) ?? { id: Number(m[1]), status: 'completed' });
      if (req.method === 'GET' && (m = /^\/actions\/runs\/(\d+)\/attempts\/1\/jobs$/.exec(p))) return envoyer(200, { jobs: ['faits-git', 'execution', 'assemblage'].map((name, i) => ({ id: Number(m[1]) * 10 + i, name })) });
      if (req.method === 'GET' && (m = /^\/check-runs\/(\d+)\/annotations$/.exec(p))) {
        const run = etat.runs.find((r) => r.id === Math.floor(Number(m[1]) / 10));
        const lignes = Number(m[1]) % 10 === 2 ? annotationsFaits('at5', run.at5) : [];
        return envoyer(200, lignes.map((l) => { const x = /^::notice title=([^:]+)::(.*)$/.exec(l); return { title: x[1], message: x[2], annotation_level: 'notice' }; }));
      }
      return envoyer(404, { message: `inconnu ${req.method} ${p}` });
    });
  });
  return { etat, serveur };
}
// Faits AT-5 du ticket 33 : identité REFUSÉE (segment v0.66.14..base hors outillage), exécution non lancée, comptes nuls.
const SEGMENT_33 = ['app/capacites/ecran.js', 'app/capacites/etat.js', 'outils-android/preparer.mjs', 'tests/preparer-android.test.mjs'];
function faitsAt5(nu, d, { refusee }) {
  const brut = g(nu, 'diff', '--name-status', '--no-renames', d.base, d.candidat).split('\n').filter(Boolean).map((l) => l.split('\t'));
  const segment = refusee ? { commits: 1, fichiers: SEGMENT_33.map((chemin) => ({ chemin, etat: 'modifie', mode: '100644' })), fusions: 0, hors_outillage: SEGMENT_33, refuses: [], statut: 'etabli' } : { commits: 0, fichiers: [], fusions: 0, hors_outillage: [], refuses: [], statut: 'etabli' };
  return ecrireFaits({
    demande: { ...d },
    diff: refusee ? { fichiers: [], refuses: [], statut: 'non-calcule', tests_modifies: [], tests_supprimes: [], zones_touchees: [] } : { fichiers: brut.map(([s, chemin]) => ({ chemin, etat: { A: 'cree', M: 'modifie' }[s], mode: '100644' })), refuses: [], statut: 'etabli', tests_modifies: [], tests_supprimes: [], zones_touchees: [] },
    erreurs_techniques: [],
    execution: refusee ? { code: null, deballer_sha256: null, delai_ms: null, duree_tests_ms: null, fichiers_injectes: [], injection_relue: false, statut: 'non-lancee', verifier_sha256: null, version_injectee: null } : { code: 0, deballer_sha256: '5'.repeat(64), delai_ms: 300000, duree_tests_ms: 1000, fichiers_injectes: ['app/sw.js', 'app/version.js'], injection_relue: true, statut: 'executee', verifier_sha256: '4'.repeat(64), version_injectee: d.version_candidat },
    identite: { base_ancetre: true, base_est_commit: true, base_sur_main: true, base_tag: d.base, branche_existe: true, branche_pointe: d.candidat, branche_pointe_fin: d.candidat, commits: 1, constats: refusee ? SEGMENT_33.map((p) => `segment v0.66.14..base : « ${p} » hors de .github/workflows/, outils-atelier/, tests/atelier- (seul l'outillage hors colis y est admis)`) : [], est_commit: true, fusions: 0, main: d.base, merge_base: d.base,
      segment, statut: refusee ? 'refusee' : 'etablie', tag_ancetre_base: true, tag_candidat_libre: true, version_fichier_base: d.version_base },
    protocole: 'atelier-faits-2',
    provenance: { depot: DEPOT, run_id: '40000000009', verificateur_sha: d.base, workflow_ref: `${DEPOT}/.github/workflows/atelier-verification.yml@refs/heads/main` },
    robot: refusee ? { erreurs: [], fumee: 'non-lancee', json: 'non-lancee', syntaxe: 'non-lancee' } : { erreurs: [], fumee: 'ok', json: 'ok', syntaxe: 'ok' },
    tests: refusee ? { annules: null, echecs: null, ignores: null, reussis: null, statut: 'non-lances', total: null } : { annules: 0, echecs: 0, ignores: 0, reussis: 10, statut: 'executes', total: 10 },
  }, hache);
}
const usage = { input_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 300 };
const tour = (blocs) => ({ emis: true, inconnu: false, statut: 200, json: { content: blocs.map(([name, input], i) => ({ type: 'tool_use', id: `u${i}`, name, input })), stop_reason: 'tool_use', usage } });
const fauxClient = (reponses) => ({ compter: async () => 5000, envoyer: async () => reponses.shift() });
const PLAN = { description: 'Salutation', missions: [{ id: 'salut', titre: 'Fonction de salutation', comportement: 'saluer() rend « bonjour ».', criteres: ['saluer() rend bonjour.'], tests: ['tests/salut.test.mjs vérifie saluer().'], autorises: ['app/salut.js', 'tests/salut.test.mjs'], cognitive: false }] };
function preparerOperateur() {
  const D = mkdtempSync(join(tmpdir(), 'infra-'));
  const nu = join(D, 'distant.git');
  g(D, 'init', '-q', '--bare', '-b', 'main', nu);
  const graine = join(D, 'graine');
  g(D, 'clone', '-q', nu, graine);
  for (const [f, c] of Object.entries({ VERSION: '0.66.14\n', 'ETAT.md': '# État\n\n## Historique\n', 'app/index.html': '<!doctype html>\n', 'app/main.js': 'export const x = 1;\n', 'signature/naissance.jks': 'cle-fictive\n', 'tests/base.test.mjs': 'import test from "node:test";\ntest("base", () => {});\n', 'CLAUDE.md': '# règles\n' })) {
    mkdirSync(dirname(join(graine, f)), { recursive: true });
    writeFileSync(join(graine, f), c);
  }
  g(graine, 'add', '-A');
  g(graine, 'commit', '-q', '-m', 'base');
  g(graine, 'tag', '-a', 'v0.66.14', '-m', 'v0.66.14');
  g(graine, 'push', '-q', 'origin', 'main', 'v0.66.14');
  const op = join(D, 'operateur');
  g(D, 'clone', '-q', nu, op);
  return { D, nu, op, graine };
}
const ctxDe = (op, url, run) => contexte({ GITHUB_REPOSITORY: DEPOT, ATELIER_API_GITHUB: url, ATELIER_RACINE: op, ATELIER_PAUSE_MS: '1', GITHUB_RUN_ID: String(run), ATELIER_PILOTE: 'actif' });
async function tourAgent(ctx, gh, D, nu, consigne, reponses, nom) {
  const travail = join(D, `travail-${nom}`);
  g(D, 'clone', '-q', nu, travail);
  g(travail, 'checkout', '-q', JSON.parse(readFileSync(consigne, 'utf8')).depart);
  const r = await agent({ consigne, travail, racineOutil: RACINE, client: fauxClient(reponses), suiteComplete: () => ({ code: 0, resume: { total: 11, reussis: 11, echecs: 0, sautes: 0 }, sortie: '' }) });
  writeFileSync(join(D, `resultat-${nom}.json`), JSON.stringify(r));
  return bilan(ctx, gh, { consigne, resultat: join(D, `resultat-${nom}.json`) });
}
const types = (ctx, t) => lireJournal(ctx).chantier(t).map((x) => x.type);
const budget = (ctx) => { const b = lireJournal(ctx).budget; return b.length ? etatBudget(b) : { consommeCycle: 0, engageCycle: 0 }; };

test('OPÉRATEUR — précontrôle refusé (code applicatif non publié sur main, comme le ticket 33) : AUCUNE réservation, AUCUN agent, blocage « infrastructure » que le pilote ne reprend jamais ; /reprendre après correction repart', async () => {
  const { D, nu, op, graine } = preparerOperateur();
  const { etat, serveur } = fauxGithub();
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  try {
    appendFileSync(join(graine, 'app', 'main.js'), 'export const y = 2;\n');
    g(graine, 'commit', '-q', '-am', 'applicatif non publié');
    g(graine, 'push', '-q', 'origin', 'main');
    const ctx = ctxDe(op, url, 10);
    const gh = github(ctx);
    etat.tickets.set(33, { number: 33, state: 'open', title: 'Atelier : bouton Saluer d\'essai', body: 'Un bouton Saluer.', user: { id: PROPRIETAIRE_ID, login: 'christopheplantegenest-prog' } });
    const consigne = join(D, 'consigne.json');
    const a = await avancer(ctx, gh, { ticket: 33, consigne });
    assert.deepEqual(a, { etape: 'bloquer', raison: 'infrastructure' });
    assert.deepEqual(types(ctx, 33), ['demande', 'bloque']);
    const e = etatChantier(lireJournal(ctx).chantier(33));
    assert.equal(e.bloque.raison, 'infrastructure');
    assert.match(e.bloque.question, /^précontrôle gratuit refusé : identité AT-5 : « app\/main\.js » changé depuis v0\.66\.14 hors de l'outillage/);
    assert.match(e.bloque.question, /aucune dépense, agent non relancé/);
    assert.deepEqual([budget(ctx).consommeCycle, budget(ctx).engageCycle, e.depense], [0, 0, 0]);
    assert.equal(etat.relances.length, 0, 'aucun tour relancé');
    // Le pilote ne reprend ni ne conclut un blocage d'infrastructure ; un nouveau passage ne fait rien.
    assert.deepEqual(etapePilote(e), { etape: 'aucune', raison: 'bloque' });
    assert.deepEqual(await avancer(ctx, gh, { ticket: 33, consigne }), { etape: 'aucune', raison: 'bloque' });
    assert.deepEqual(types(ctx, 33), ['demande', 'bloque']);
    assert.match(etat.commentaires.at(-1).body, /Bloqué \(infrastructure\)/);
    // Correction : la version est publiée (étiquette sur la tête) ; /reprendre refait le précontrôle, qui passe, et le tour est réservé.
    // (La demande garde sa base : la base de ce chantier est déjà la tête, c'est l'étiquette qui manquait.)
    g(graine, 'tag', '-d', 'v0.66.14');
    g(nu, 'tag', '-d', 'v0.66.14');
    g(op, 'tag', '-d', 'v0.66.14');
    g(graine, 'tag', '-a', 'v0.66.14', '-m', 'republiée sur la tête (épreuve)');
    g(graine, 'push', '-q', 'origin', 'v0.66.14');
    const ev = join(D, 'ev.json');
    writeFileSync(ev, JSON.stringify({ issue: { number: 33 }, comment: { body: '/reprendre', user: { id: PROPRIETAIRE_ID } } }));
    assert.equal((await commande(ctxDe(op, url, 11), gh, { evenement: ev })).commande, '/reprendre');
    const b = await avancer(ctxDe(op, url, 12), gh, { ticket: 33, consigne });
    assert.equal(b.etape, 'planifier');
    assert.equal(budget(ctx).engageCycle > 0, true);
  } finally {
    serveur.close();
    rmSync(D, { recursive: true, force: true });
  }
});

test('OPÉRATEUR — refus d\'IDENTITÉ AT-5 : blocage d\'infrastructure, aucune vérification inscrite, aucune tentative comptée, aucun agent relancé ; après /reprendre, le MÊME candidat est revérifié', async () => {
  // Chantier sans scénario (plan -> développement -> vérification) : isole la vérification AT-5.
  let refusee = true;
  const { D: D2, nu: nu2, op: op2 } = preparerOperateur();
  const f2 = fauxGithub();
  f2.etat.faitsPour = (d) => faitsAt5(nu2, d, { refusee });
  await new Promise((r) => f2.serveur.listen(0, '127.0.0.1', r));
  const url2 = `http://127.0.0.1:${f2.serveur.address().port}`;
  try {
    const ctx = contexte({ GITHUB_REPOSITORY: DEPOT, ATELIER_API_GITHUB: url2, ATELIER_RACINE: op2, ATELIER_PAUSE_MS: '1', GITHUB_RUN_ID: '30' });
    const gh = github(ctx);
    f2.etat.tickets.set(35, { number: 35, state: 'open', title: 'Atelier : saluer', body: 'Saluer.', user: { id: PROPRIETAIRE_ID, login: 'christopheplantegenest-prog' } });
    const consigne = join(D2, 'consigne.json');
    assert.equal((await avancer(ctx, gh, { ticket: 35, consigne })).etape, 'planifier');
    await tourAgent(ctx, gh, D2, nu2, consigne, [tour([['proposer_plan', { plan: PLAN }]])], 'plan');
    assert.equal((await avancer(ctx, gh, { ticket: 35, consigne })).etape, 'developper');
    const dev = await tourAgent(ctx, gh, D2, nu2, consigne, [
      tour([['ecrire', { chemin: 'app/salut.js', contenu: 'export const saluer = () => \'bonjour\';\n' }], ['ecrire', { chemin: 'tests/salut.test.mjs', contenu: 'import test from "node:test";\nimport assert from "node:assert/strict";\nimport { saluer } from "../app/salut.js";\ntest("saluer", () => { assert.equal(saluer(), "bonjour"); });\n' }]]),
      tour([['terminer', { statut: 'candidat', resume: 'saluer() ajouté' }]]),
    ], 'dev');
    assert.deepEqual(dev.evenements, ['candidat']);
    const avant = budget(ctx).consommeCycle;
    const tours = etatChantier(lireJournal(ctx).chantier(35)).tours.length;
    // AT-5 refuse l'identité : pas de « verification » inscrite, blocage « infrastructure », aucun tour de développement relancé.
    const v = await avancer(ctx, gh, { ticket: 35, consigne });
    assert.deepEqual(v, { etape: 'bloquer', raison: 'infrastructure' });
    const e = etatChantier(lireJournal(ctx).chantier(35));
    assert.equal(types(ctx, 35).includes('verification'), false);
    assert.equal(e.bloque.raison, 'infrastructure');
    assert.match(e.bloque.question, /^vérification AT-5 : identité refusée \(segment v0\.66\.14\.\.base : « app\/capacites\/ecran\.js » hors de/);
    assert.equal(e.tours.length, tours, 'aucun tour réservé');
    assert.equal(budget(ctx).consommeCycle, avant, 'aucune dépense');
    assert.deepEqual(e.missions.salut.map((t) => t.n), [1], 'une seule tentative, non comptée comme échouée');
    assert.deepEqual(await avancer(ctx, gh, { ticket: 35, consigne }), { etape: 'aucune', raison: 'bloque' });
    assert.equal(f2.etat.relances.filter((x) => x.workflow === 'atelier-verification.yml').length, 1);
    // Infrastructure corrigée, /reprendre : le MÊME candidat (tentative 1) est revérifié, sans nouveau développement.
    refusee = false;
    const ev = join(D2, 'ev.json');
    writeFileSync(ev, JSON.stringify({ issue: { number: 35 }, comment: { body: '/reprendre', user: { id: PROPRIETAIRE_ID } } }));
    assert.equal((await commande(ctx, gh, { evenement: ev })).commande, '/reprendre');
    const v2 = await avancer(ctx, gh, { ticket: 35, consigne });
    assert.equal(v2.etape, 'verifier');
    assert.equal(v2.verdict, 'verification-technique-conforme', v2.raisons?.join('\n'));
    const e2 = etatChantier(lireJournal(ctx).chantier(35));
    assert.deepEqual(e2.missions.salut.map((t) => [t.n, t.verifications.length]), [[1, 1]]);
    assert.equal(budget(ctx).consommeCycle, avant);
  } finally {
    f2.serveur.close();
    rmSync(D2, { recursive: true, force: true });
  }
});
