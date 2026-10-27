// === DEBUT_ATELIER_AUTO_SCENARIO ===
// ATELIER 3 — BOUCLE FERMÉE, composant C « preuve de fonctionnement » (GO ChatGPT « ATELIER 3 — GO CONSTRUCTION », 27/10/2026).
// OUTILLAGE NON COGNITIF — outil HORS APK. Chemin privilégié (P1) par son nom (outils-atelier/auto-*.mjs) : un colis ne peut pas le modifier,
// l'agent non plus (chemin protégé de l'atelier) ; il ne change que par une PR de Christophe.
// SCÉNARIO D'ACCEPTATION : gestes + observations attendues, écrits au plan AVANT tout développement, relus par un avis indépendant, gelés
// dans le journal du chantier (empreinte SHA-256 de la forme canonique). L'agent de développement le lit mais ne peut pas l'écrire.
// Il est JOUÉ PAR LE ROBOT (job « acceptation »), jamais par l'agent :
//   navigateur : Chromium (Playwright) sur l'application construite par le robot ; réseau coupé hors de l'application ; stockage neuf ;
//                CONTRE-ÉPREUVE : le même scénario joué sur la BASE doit échouer (sinon il ne prouve rien : « non-probant ») ;
//   android    : émulateur Android (machine GitHub avec KVM) sur l'APK du contrôle : installation, lancement, écran éteint, attente,
//                lecture de l'écran par l'accessibilité (uiautomator) et du journal système (logcat). L'émulateur n'est PAS le téléphone de
//                Christophe : il prouve un mécanisme, pas le comportement d'économie d'énergie d'un modèle précis.
// Ce module est AUTONOME (bibliothèque de Node seule ; Playwright chargé depuis le dossier d'outils du robot) : le robot le copie hors du
// dépôt AVANT d'appliquer le colis, puis l'exécute depuis cette copie.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_ETAPES = 40;
export const ATTENTE_MAX_NAVIGATEUR_MS = 15_000;
export const ATTENTE_MAX_ANDROID_MS = 900_000;
export const ATTENTE_TOTALE_ANDROID_MS = 1_200_000;
const DELAI_OBSERVATION_MS = 10_000;
const DELAI_OBSERVATION_ANDROID_MS = 20_000;
const TOUCHES_NAVIGATEUR = Object.freeze(['Enter', 'Escape', 'Tab']);
const TOUCHES_ANDROID = Object.freeze(['ENTER', 'BACK', 'HOME']);
// Actions admises et leurs clés exactes (en plus de « action »).
const ACTIONS = Object.freeze({
  navigateur: {
    ecrire: ['champ', 'texte'], toucher: ['texte'], touche: ['touche'], recharger: [], attendre: ['ms'],
    voir: ['texte'], ne_pas_voir: ['texte'], presse_papiers: ['texte'],
  },
  android: {
    lancer: [], toucher: ['texte'], ecrire: ['texte'], touche: ['touche'], ecran_eteint: [], ecran_allume: [], attendre: ['ms'],
    voir: ['texte'], ne_pas_voir: ['texte'], redemarrer: [], processus_vivant: [], journal_contient: ['texte'],
  },
});
const OBSERVATIONS_POSITIVES = Object.freeze(['voir', 'presse_papiers', 'processus_vivant', 'journal_contient']);
const OBSERVATIONS = Object.freeze([...OBSERVATIONS_POSITIVES, 'ne_pas_voir']);
const RE_VERSION_DANS_TEXTE = /\d+\.\d+\.\d+/;
const RE_ASCII_ANDROID = /^[A-Za-z0-9 .,?!'-]{1,100}$/;
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sansControle = (t) => ![...t].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === ' ' || c === ' ');
const texteSur = (t, max) => typeof t === 'string' && t.trim() === t && t.length >= 1 && t.length <= max && sansControle(t);

// ------------------------------------------------------------------------------------------------ forme (pure)
// Scénario proposé -> { scenario } (forme canonique, clés dans un ordre fixe) ou { raison }.
export function lireScenario(s) {
  if (!estObjet(s) || Object.keys(s).sort().join() !== 'android,but,navigateur') return { raison: 'scénario : clés android, but, navigateur attendues' };
  if (!texteSur(s.but, 300)) return { raison: 'scénario.but : une ligne de 1 à 300 caractères' };
  const lire = (genre, liste) => {
    if (!Array.isArray(liste) || liste.length < 1 || liste.length > MAX_ETAPES) return { raison: `scénario.${genre} : 1 à ${MAX_ETAPES} étapes` };
    const etapes = [];
    let attente = 0;
    for (const [i, e] of liste.entries()) {
      const ici = `scénario.${genre}[${i + 1}]`;
      if (!estObjet(e) || typeof e.action !== 'string' || !Object.hasOwn(ACTIONS[genre], e.action)) return { raison: `${ici} : action inconnue` };
      const cles = ACTIONS[genre][e.action];
      if (Object.keys(e).sort().join() !== ['action', ...cles].sort().join()) return { raison: `${ici} (${e.action}) : clés ${['action', ...cles].join(', ')} attendues` };
      const x = { action: e.action };
      for (const k of cles) {
        const v = e[k];
        if (k === 'ms') {
          const max = genre === 'android' ? ATTENTE_MAX_ANDROID_MS : ATTENTE_MAX_NAVIGATEUR_MS;
          if (!Number.isSafeInteger(v) || v < 1 || v > max) return { raison: `${ici} : ms entier de 1 à ${max}` };
          attente += v;
        } else if (k === 'touche') {
          if (!(genre === 'android' ? TOUCHES_ANDROID : TOUCHES_NAVIGATEUR).includes(v)) return { raison: `${ici} : touche inconnue` };
        } else if (!texteSur(v, 300)) return { raison: `${ici} : ${k} d'une ligne, 1 à 300 caractères, sans espace au bord` };
        if (genre === 'android' && e.action === 'ecrire' && !RE_ASCII_ANDROID.test(v)) return { raison: `${ici} : texte saisi sur Android en ASCII simple (lettres, chiffres, espace, . , ? ! ' -), 100 caractères au plus` };
        x[k] = v;
      }
      if (OBSERVATIONS.includes(e.action) && 'texte' in x && (x.texte.length < 3 || RE_VERSION_DANS_TEXTE.test(x.texte))) return { raison: `${ici} : observation de 3 caractères au moins, sans numéro de version (elle doit prouver le comportement, pas la livraison)` };
      etapes.push(x);
    }
    if (!etapes.some((e) => OBSERVATIONS_POSITIVES.includes(e.action))) return { raison: `scénario.${genre} : au moins une observation positive (${OBSERVATIONS_POSITIVES.join(', ')})` };
    if (genre === 'android' && attente > ATTENTE_TOTALE_ANDROID_MS) return { raison: `scénario.android : attente totale au plus ${ATTENTE_TOTALE_ANDROID_MS} ms` };
    return { etapes };
  };
  const n = lire('navigateur', s.navigateur);
  if (n.raison) return n;
  let android = null;
  if (s.android !== null) {
    const a = lire('android', s.android);
    if (a.raison) return a;
    android = a.etapes;
  }
  return { scenario: { but: s.but, navigateur: n.etapes, android } };
}

// Forme canonique : JSON, clés triées, sans espace (même texte que json.dumps(sort_keys=True, ensure_ascii=False, separators=(',', ':'))
// de Python, pour l'inventaire du robot ; les textes n'ont aucun caractère de contrôle).
export function canonique(v) {
  if (Array.isArray(v)) return `[${v.map(canonique).join(',')}]`;
  if (estObjet(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonique(v[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export const empreinteScenario = (s) => createHash('sha256').update(canonique(s), 'utf8').digest('hex');

// Verdict d'acceptation à partir des passages : { verdict: ok | echec | non-probant | impossible, motif }.
//  - navigateur sur le candidat : vert exigé ; sur la base : ROUGE exigé (contre-épreuve), sinon « non-probant » ;
//  - android (si le scénario en a) : vert exigé ; émulateur indisponible = « impossible » (jamais un succès par défaut).
export function verdictAcceptation({ scenario, candidat, base, android }) {
  const etat = (r) => (estObjet(r) && ['ok', 'echec', 'impossible'].includes(r.verdict) ? r.verdict : 'impossible');
  if (etat(candidat) === 'impossible') return { verdict: 'impossible', motif: `navigateur : passage impossible (${candidat?.motif ?? 'résultat absent'})` };
  if (etat(candidat) === 'echec') return { verdict: 'echec', motif: `navigateur : ${candidat.motif ?? 'scénario en échec'}` };
  if (etat(base) === 'impossible') return { verdict: 'impossible', motif: `contre-épreuve sur la base impossible (${base?.motif ?? 'résultat absent'})` };
  if (etat(base) === 'ok') return { verdict: 'non-probant', motif: 'le scénario réussit déjà sur la base : il ne prouve pas le comportement demandé' };
  if (scenario.android) {
    if (etat(android) === 'impossible') return { verdict: 'impossible', motif: `android : passage impossible (${android?.motif ?? 'résultat absent'})` };
    if (etat(android) === 'echec') return { verdict: 'echec', motif: `android : ${android.motif ?? 'scénario en échec'}` };
  }
  return { verdict: 'ok', motif: scenario.android ? 'navigateur et émulateur Android verts, contre-épreuve rouge sur la base' : 'navigateur vert, contre-épreuve rouge sur la base' };
}

// ------------------------------------------------------------------------------------------------ navigateur
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};
function serveur(racine) {
  const s = createServer((req, res) => {
    let chemin;
    try { chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); res.end(); return; }
    let f = path.normalize(path.join(racine, chemin));
    if (f !== racine && !f.startsWith(racine + path.sep)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f) || fs.lstatSync(f).isSymbolicLink()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise((ok) => { s.listen(0, '127.0.0.1', () => ok(s)); });
}
async function chargerPlaywright(outils) {
  try { return createRequire(path.join(outils ?? process.cwd(), 'package.json'))('playwright'); } catch { return import('playwright'); }
}

// Joue la partie navigateur sur l'application de « racine » (dossier contenant app/). Rend { verdict, motif, etapes, erreurs }.
export async function jouerNavigateur({ scenario, racine, outils = null, delaiObservation = DELAI_OBSERVATION_MS }) {
  const etapes = [];
  const erreurs = [];
  let pw;
  try { pw = await chargerPlaywright(outils); } catch (e) { return { verdict: 'impossible', motif: `navigateur indisponible : ${e.message}`, etapes, erreurs }; }
  const r = fs.realpathSync(racine);
  if (!fs.existsSync(path.join(r, 'app', 'index.html'))) return { verdict: 'impossible', motif: 'app/index.html absent', etapes, erreurs };
  const srv = await serveur(r);
  const origine = `http://127.0.0.1:${srv.address().port}`;
  const nav = await pw.chromium.launch();
  try {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: origine });
    const page = await ctx.newPage();
    // Réseau coupé hors de l'application : aucune capacité ne peut venir d'un service extérieur (D-001) pendant la preuve.
    await page.route('**/*', (route) => (route.request().url().startsWith(`${origine}/`) ? route.continue() : route.abort()));
    page.on('pageerror', (e) => { if (erreurs.length < 20) erreurs.push(String(e.message).slice(0, 300)); });
    const demarrer = async () => {
      await page.goto(`${origine}/app/`, { waitUntil: 'load', timeout: 30_000 });
      await page.waitForFunction(() => document.documentElement.dataset.demarrage, null, { timeout: 20_000 }).catch(() => {});
    };
    await demarrer();
    const visibles = (t) => page.getByText(t).filter({ visible: true });
    for (const [i, e] of scenario.navigateur.entries()) {
      let ok = true;
      let detail = '';
      try {
        if (e.action === 'ecrire') await page.getByPlaceholder(e.champ, { exact: true }).or(page.getByLabel(e.champ, { exact: true })).filter({ visible: true }).first().fill(e.texte, { timeout: delaiObservation });
        else if (e.action === 'toucher') await page.getByRole('button', { name: e.texte, exact: true }).or(page.getByText(e.texte, { exact: true })).filter({ visible: true }).first().click({ timeout: delaiObservation });
        else if (e.action === 'touche') await page.keyboard.press(e.touche);
        else if (e.action === 'recharger') { await page.reload({ waitUntil: 'load', timeout: 30_000 }); await page.waitForFunction(() => document.documentElement.dataset.demarrage, null, { timeout: 20_000 }).catch(() => {}); }
        else if (e.action === 'attendre') await page.waitForTimeout(e.ms);
        else if (e.action === 'voir') await visibles(e.texte).first().waitFor({ state: 'visible', timeout: delaiObservation });
        else if (e.action === 'ne_pas_voir') { await page.waitForTimeout(500); const n = await visibles(e.texte).count(); if (n) { ok = false; detail = `texte visible ${n} fois`; } }
        else if (e.action === 'presse_papiers') { const t = await page.evaluate(() => navigator.clipboard.readText()); if (!String(t).includes(e.texte)) { ok = false; detail = `presse-papiers sans le texte (${String(t).length} caractères)`; } }
      } catch (x) {
        ok = false;
        detail = String(x.message).split('\n')[0].slice(0, 300);
      }
      etapes.push({ n: i + 1, action: e.action, ok, ...(detail ? { detail } : {}) });
      if (!ok) return { verdict: 'echec', motif: `étape ${i + 1} (${e.action}${e.texte ? ` « ${e.texte.slice(0, 80)} »` : ''}) : ${detail}`, etapes, erreurs };
    }
    return { verdict: 'ok', motif: `${etapes.length} étape(s) réussie(s)`, etapes, erreurs };
  } catch (x) {
    return { verdict: 'impossible', motif: `navigateur : ${String(x.message).split('\n')[0].slice(0, 300)}`, etapes, erreurs };
  } finally {
    await nav.close();
    srv.close();
  }
}

// ------------------------------------------------------------------------------------------------ android (adb)
const decoderXml = (t) => t.replace(/&quot;/g, '"').replace(/&apos;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
// Nœuds d'un vidage uiautomator : [{ texte, centre: [x, y] }] (texte = text ou content-desc).
export function noeudsEcran(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<node\b([^>]*)>/g)) {
    const a = (k) => { const x = new RegExp(`\\b${k}="([^"]*)"`).exec(m[1]); return x ? decoderXml(x[1]) : ''; };
    const b = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(a('bounds'));
    for (const t of [a('text'), a('content-desc')]) if (t) out.push({ texte: t, centre: b ? [Math.round((+b[1] + +b[3]) / 2), Math.round((+b[2] + +b[4]) / 2)] : null });
  }
  return out;
}
// adb : fonction (args) -> { code, sortie } (remplaçable dans les tests par un faux adb).
export function adbReel(binaire = 'adb') {
  return (args, { delaiMs = 120_000 } = {}) => {
    const r = spawnSync(binaire, args, { encoding: 'utf8', timeout: delaiMs, maxBuffer: 64 * 1024 * 1024 });
    return { code: r.error ? -1 : r.status, sortie: `${r.stdout ?? ''}${r.stderr ?? ''}` };
  };
}
export async function jouerAndroid({ scenario, apk, paquet, adb = adbReel(), dormir = (ms) => new Promise((r) => { setTimeout(r, ms); }), delaiObservation = DELAI_OBSERVATION_ANDROID_MS }) {
  const etapes = [];
  if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(paquet ?? '')) return { verdict: 'impossible', motif: 'paquet Android illisible', etapes };
  const sh = (...a) => adb(['shell', ...a]);
  if (adb(['get-state']).sortie.trim() !== 'device') return { verdict: 'impossible', motif: 'émulateur Android indisponible', etapes };
  const inst = adb(['install', '-r', '-g', apk], { delaiMs: 300_000 });
  if (inst.code !== 0 || !/Success/.test(inst.sortie)) return { verdict: 'impossible', motif: `installation de l'APK impossible : ${inst.sortie.slice(-200)}`, etapes };
  adb(['logcat', '-c']);
  const ecran = () => { sh('uiautomator', 'dump', '/sdcard/naissance-ecran.xml'); return noeudsEcran(adb(['exec-out', 'cat', '/sdcard/naissance-ecran.xml']).sortie); };
  const chercher = async (t, presence) => {
    const fin = Date.now() + delaiObservation;
    for (;;) {
      const trouve = ecran().find((x) => x.texte.includes(t));
      if (Boolean(trouve) === presence || Date.now() >= fin) return trouve ?? null;
      await dormir(1000);
    }
  };
  // Ce que l'écran montrait au moment de l'échec (diagnostic : textes visibles et application au premier plan), court et sans saut de ligne.
  const vuAEcran = () => {
    const textes = [...new Set(ecran().map((x) => x.texte.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 12).map((t) => t.slice(0, 40));
    const devant = (sh('dumpsys', 'window').sortie.match(/mCurrentFocus=[^\n]*/) ?? [''])[0].slice(0, 120);
    return `${textes.length ? textes.join(' · ') : 'aucun texte'}${devant ? ` ; ${devant}` : ''}`;
  };
  const lancer = async () => { sh('monkey', '-p', paquet, '-c', 'android.intent.category.LAUNCHER', '1'); await dormir(5000); };
  for (const [i, e] of scenario.android.entries()) {
    let ok = true;
    let detail = '';
    if (e.action === 'lancer') await lancer();
    else if (e.action === 'redemarrer') { sh('am', 'force-stop', paquet); await dormir(1000); await lancer(); }
    else if (e.action === 'toucher') { const n = await chercher(e.texte, true); if (n?.centre) sh('input', 'tap', String(n.centre[0]), String(n.centre[1])); else { ok = false; detail = 'élément introuvable à l\'écran'; } }
    else if (e.action === 'ecrire') sh('input', 'text', e.texte.replace(/ /g, '%s').replace(/'/g, '\\\''));
    else if (e.action === 'touche') sh('input', 'keyevent', `KEYCODE_${e.touche}`);
    else if (e.action === 'ecran_eteint') sh('input', 'keyevent', 'KEYCODE_SLEEP');
    else if (e.action === 'ecran_allume') { sh('input', 'keyevent', 'KEYCODE_WAKEUP'); sh('wm', 'dismiss-keyguard'); await dormir(1000); }
    else if (e.action === 'attendre') await dormir(e.ms);
    else if (e.action === 'voir') { if (!await chercher(e.texte, true)) { ok = false; detail = `texte absent de l'écran (vu : ${vuAEcran()})`; } }
    else if (e.action === 'ne_pas_voir') { if (await chercher(e.texte, false)) { ok = false; detail = 'texte présent à l\'écran'; } }
    else if (e.action === 'processus_vivant') { if (!sh('pidof', paquet).sortie.trim()) { ok = false; detail = 'processus de l\'application absent'; } }
    else if (e.action === 'journal_contient') { if (!adb(['logcat', '-d']).sortie.includes(e.texte)) { ok = false; detail = 'texte absent du journal système'; } }
    etapes.push({ n: i + 1, action: e.action, ok, ...(detail ? { detail } : {}) });
    if (!ok) return { verdict: 'echec', motif: `étape ${i + 1} (${e.action}${e.texte ? ` « ${e.texte.slice(0, 80)} »` : ''}) : ${detail}`, etapes };
  }
  return { verdict: 'ok', motif: `${etapes.length} étape(s) réussie(s) sur l'émulateur`, etapes };
}

// ------------------------------------------------------------------------------------------------ CLI (job « acceptation » du robot)
function options(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!/^--[a-z-]+$/.test(argv[i]) || argv[i + 1] === undefined) throw new Error(`option illisible : ${argv[i]}`);
    o[argv[i].slice(2)] = argv[i + 1];
  }
  return o;
}
const lireJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const ecrireJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 1)}\n`);
function scenarioDe(f, sha) {
  const l = lireScenario(lireJson(f));
  if (l.raison) throw new Error(l.raison);
  if (sha && empreinteScenario(l.scenario) !== sha) throw new Error('empreinte du scénario différente de celle du journal');
  return l.scenario;
}
export async function principal(argv) {
  const [cmd, ...reste] = argv;
  const o = options(reste);
  if (cmd === 'navigateur') {
    let r;
    try { r = await jouerNavigateur({ scenario: scenarioDe(o.scenario, o.empreinte), racine: o.racine, outils: o.outils }); } catch (e) { r = { verdict: 'impossible', motif: e.message, etapes: [] }; }
    ecrireJson(o.sortie, r);
    process.stdout.write(`navigateur : ${r.verdict} — ${r.motif}\n`);
    return 0;
  }
  if (cmd === 'android') {
    let r;
    try { r = await jouerAndroid({ scenario: scenarioDe(o.scenario, o.empreinte), apk: o.apk, paquet: o.paquet }); } catch (e) { r = { verdict: 'impossible', motif: e.message, etapes: [] }; }
    ecrireJson(o.sortie, r);
    process.stdout.write(`android : ${r.verdict} — ${r.motif}\n`);
    return 0;
  }
  if (cmd === 'verdict') {
    // Verdict final + annotation lue par l'opérateur de l'Atelier (::notice title=ACCEPTATION::{json}). Code 0 seulement si « ok ».
    const lire = (f) => { try { return f && fs.existsSync(f) ? lireJson(f) : null; } catch { return null; } };
    let v;
    let scenario = null;
    try { scenario = scenarioDe(o.scenario, o.empreinte); v = verdictAcceptation({ scenario, candidat: lire(o.candidat), base: lire(o.base), android: lire(o.android) }); } catch (e) { v = { verdict: 'impossible', motif: e.message }; }
    const resume = (r) => (r ? { verdict: r.verdict, motif: String(r.motif ?? '').slice(0, 300), etapes: (r.etapes ?? []).length } : null);
    const d = { v: 1, verdict: v.verdict, motif: v.motif, empreinte: o.empreinte ?? null, candidat: resume(lire(o.candidat)), base: resume(lire(o.base)), android: scenario?.android ? resume(lire(o.android)) : null };
    if (o.sortie) ecrireJson(o.sortie, d);
    process.stdout.write(`::notice title=ACCEPTATION::${JSON.stringify(d).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}\n`);
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${v.verdict}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n## Acceptation (scénario figé avant le développement)\n\n- verdict : **${v.verdict}** — ${v.motif}\n`);
    return v.verdict === 'ok' ? 0 : 1;
  }
  throw new Error(`commande inconnue : ${cmd}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { process.stderr.write(`${e.message}\n`); process.exitCode = 2; });
}
// === FIN_ATELIER_AUTO_SCENARIO ===
