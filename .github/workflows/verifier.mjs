// ROBOT DE LIVRAISON — vérificateur (version du robot : 1)
//
// Usage : node verifier.mjs --version X.Y.Z --rapport DOSSIER --outils DOSSIER
// Code de sortie 0 = tout est bon ; 1 = au moins une erreur (lignes « ❌ »).
//
// 1. app/index.html présent
// 2. syntaxe de tous les .js/.mjs de app/, tests/, outils-android/
// 3. validité de tous les .json/.webmanifest du projet (hors anciens fichiers)
// 4. tests automatiques tests/**/*.test.js|mjs (node --test)
// 5. test de fumée dans un vrai navigateur : la page démarre, sans erreur
//    JavaScript, sans fichier manquant, et affiche la bonne version.

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}
const VERSION = args.version || '';
const RAPPORT = args.rapport || fs.mkdtempSync(path.join(os.tmpdir(), 'rapport-'));
const OUTILS = args.outils || '';
const RACINE = process.cwd();
fs.mkdirSync(RAPPORT, { recursive: true });

const lignes = [];
let erreurs = 0;
const note = (t) => { lignes.push(t); console.log(t); };
const ok = (t) => note('✅ ' + t);
const erreur = (t) => { erreurs++; note('❌ ' + t); };

const JAMAIS = new Set(['.git', 'node_modules', 'android', '.github']);

function fichiersSous(dossier) {
  const base = path.join(RACINE, dossier);
  const res = [];
  if (!fs.existsSync(base)) return res;
  const pile = [base];
  while (pile.length) {
    const d = pile.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (JAMAIS.has(e.name)) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (e.isFile()) res.push(path.relative(RACINE, p));
    }
  }
  return res.sort();
}

// ------------------------------------------------ 1. fichiers essentiels
function verifierPresence() {
  if (!fs.existsSync(path.join(RACINE, 'app', 'index.html'))) erreur('app/index.html est absent');
  else ok('app/index.html présent');
}

// ------------------------------------------------ 2. syntaxe JavaScript
function verifierSyntaxe() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'syntaxe-'));
  const fichiers = ['app', 'tests', 'outils-android']
    .flatMap(fichiersSous)
    .filter((f) => /\.(m?js)$/.test(f));
  let n = 0;
  for (const f of fichiers) {
    // copie en .mjs : analyse toujours comme module, quel que soit package.json
    const copie = path.join(tmp, `f${n++}.mjs`);
    fs.copyFileSync(path.join(RACINE, f), copie);
    const r = spawnSync(process.execPath, ['--check', copie], { encoding: 'utf8' });
    if (r.status !== 0) {
      const detail = (r.stderr || '').split('\n').filter((l) => /Error/.test(l))[0] || 'erreur de syntaxe';
      erreur(`syntaxe : ${f} — ${detail.trim()}`);
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(`syntaxe contrôlée (${fichiers.length} fichiers JavaScript)`);
}

// ------------------------------------------------ 3. JSON
function verifierJson() {
  const racine = fs.readdirSync(RACINE).filter((f) => f.endsWith('.json'));
  const fichiers = [...racine, ...['app', 'tests', 'outils-android'].flatMap(fichiersSous)]
    .filter((f) => /\.(json|webmanifest)$/.test(f));
  for (const f of fichiers) {
    try { JSON.parse(fs.readFileSync(path.join(RACINE, f), 'utf8')); }
    catch (e) { erreur(`JSON invalide : ${f} — ${e.message}`); }
  }
  ok(`JSON contrôlés (${fichiers.length} fichiers)`);
}

// ------------------------------------------------ 4. tests automatiques
function lancerTests() {
  const tests = fichiersSous('tests').filter((f) => /\.test\.m?js$/.test(f));
  if (!tests.length) { note('ℹ️ aucun test automatique'); return; }
  const r = spawnSync(process.execPath, ['--test', ...tests], {
    cwd: RACINE, encoding: 'utf8', timeout: 180000,
  });
  fs.writeFileSync(path.join(RAPPORT, 'tests.txt'), (r.stdout || '') + (r.stderr || ''));
  if (r.status !== 0) erreur(`tests automatiques en échec (voir tests.txt)`);
  else ok(`tests automatiques réussis (${tests.length} fichiers)`);
}

// ------------------------------------------------ 5. test de fumée
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

function demarrerServeur() {
  const serveur = createServer((req, res) => {
    let chemin;
    try { chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    let fichier = path.normalize(path.join(RACINE, chemin));
    if (!fichier.startsWith(RACINE + path.sep) && fichier !== RACINE) {
      res.writeHead(403); res.end(); return;
    }
    if (fs.existsSync(fichier) && fs.statSync(fichier).isDirectory()) {
      fichier = path.join(fichier, 'index.html');
    }
    if (!fs.existsSync(fichier)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(fichier).pipe(res);
  });
  return new Promise((ok_) => serveur.listen(0, '127.0.0.1', () => ok_(serveur)));
}

async function testDeFumee() {
  let chromium;
  try {
    const require = createRequire(path.join(OUTILS, 'package.json'));
    ({ chromium } = require('playwright'));
  } catch (e) {
    erreur(`navigateur de vérification indisponible : ${e.message}`);
    return;
  }
  const serveur = await demarrerServeur();
  const port = serveur.address().port;
  const origine = `http://127.0.0.1:${port}`;
  const navigateur = await chromium.launch();
  try {
    const page = await navigateur.newPage({ viewport: { width: 390, height: 844 } });
    const console_ = [];
    page.on('console', (m) => console_.push(`[${m.type()}] ${m.text()}`));
    page.on('pageerror', (e) => erreur(`erreur JavaScript dans la page : ${e.message}`));
    page.on('response', (r) => {
      const u = r.url();
      if (u.startsWith(origine) && r.status() >= 400 && !u.endsWith('/favicon.ico')) {
        erreur(`fichier manquant : ${u.slice(origine.length)} (${r.status()})`);
      }
    });
    await page.goto(`${origine}/app/`, { waitUntil: 'load', timeout: 30000 });
    let etat = null;
    try {
      await page.waitForFunction(() => document.documentElement.dataset.demarrage, null, { timeout: 15000 });
      etat = await page.evaluate(() => document.documentElement.dataset.demarrage);
    } catch { /* traité ci-dessous */ }
    if (etat !== 'ok') erreur(`l'application n'a pas démarré (état : ${etat ?? 'aucun signal'})`);
    else ok('application démarrée dans le navigateur');

    const affichee = await page.evaluate(
      () => document.querySelector('[data-version]')?.textContent ?? '',
    );
    if (!VERSION || !affichee.includes(VERSION)) {
      erreur(`version affichée « ${affichee.trim()} » au lieu de ${VERSION}`);
    } else ok(`version ${VERSION} affichée`);

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(RAPPORT, 'ecran.png'), fullPage: true });
    fs.writeFileSync(path.join(RAPPORT, 'console-navigateur.txt'), console_.join('\n'));
  } catch (e) {
    erreur(`test dans le navigateur impossible : ${e.message}`);
  } finally {
    await navigateur.close();
    serveur.close();
  }
}

// ------------------------------------------------ déroulement
try {
  verifierPresence();
  verifierSyntaxe();
  verifierJson();
  lancerTests();
  if (fs.existsSync(path.join(RACINE, 'app', 'index.html'))) await testDeFumee();
} catch (e) {
  erreur(`vérificateur interrompu : ${e.message}`);
}
fs.writeFileSync(path.join(RAPPORT, 'verification.txt'), lignes.join('\n') + '\n');
process.exit(erreurs ? 1 : 0);
