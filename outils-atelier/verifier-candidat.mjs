// === DEBUT_ATELIER_VERIFIER_CANDIDAT ===
// v0.65.4 — AT-5 « VÉRIFICATEUR INDÉPENDANT DES BRANCHES ATELIER » (GO « GO AT-5 v0.65.4 », 17/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — lanceur technique HORS APK (hors app/). Il établit des FAITS sur un candidat Git ; il ne juge ni la
// pertinence du code, ni un dépôt, ni une acquisition. Il est toujours pris dans le checkout de main, jamais dans la branche candidate.
// Aucune écriture distante : seulement « git ls-remote » et « git fetch » vers des refs locales privées refs/atelier-verif/*.
// Commandes par listes d'arguments, sans shell. Aucun secret lu, écrit ni affiché.
//   git        --depot D --branche B --candidat S --base S --version-base V --version-candidat V --sortie F   (job 1, aucun code candidat)
//   execution  --robot D --dossier D --faits-git F --outils D --rapport D --sortie F                         (job 2, code candidat exécuté)
//   assembler  --depot D --faits-git F [--execution F] --sortie F                                            (job 3, aucun code candidat)
//   confronter --mission F --rapport F --faits F                                                            (pur, hors GitHub)
// Le vérificateur exécuté est celui du ROBOT, pris sur main (--robot = .github/workflows de main) : injecter_version() de deballer.py
// puis verifier.mjs, délai compris. La version injectée est une ENTRÉE explicite (version_candidat), jamais déduite de la base.
// Sous GitHub Actions, toute commande refuse de tourner si le workflow n'est pas atelier-verification.yml lancé depuis refs/heads/main.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classerDiff, confronter, ecrireFaits, jugerIdentite, lireDemande, lireFaits, zonePermanente } from '../app/atelier/verification.js';

const MARQUE = 'MISE À JOUR DÉLIBÉRÉE';
const RE_WORKFLOW = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/\.github\/workflows\/atelier-verification\.yml@refs\/heads\/main$/;
const INJECTION = 'import sys\nsys.path.insert(0, sys.argv[1])\nimport deballer\ndeballer.injecter_version(sys.argv[2], sys.stdout)\n';
const FUMEE = /^❌ (erreur JavaScript dans la page|fichier manquant|l'application n'a pas démarré|version affichée|navigateur de vérification indisponible|test dans le navigateur impossible)/;
const LIGNE_TESTS = /^(✅ tests automatiques réussis|❌ tests automatiques en échec|ℹ️ aucun test automatique)/;

export const sha256Hex = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const empreinteFichier = (f) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const borne = (t) => (t.length > 500 ? `${t.slice(0, 497)}...` : t);
const bornerListe = (l) => (l.length > 50 ? [...l.slice(0, 49), `... ${l.length - 49} autre(s)`] : l).map(borne);

export function gardeCi(env) {
  if (env.GITHUB_ACTIONS !== 'true') return;
  if (env.GITHUB_REF !== 'refs/heads/main') throw new Error(`refus : lancé depuis ${env.GITHUB_REF}, seul refs/heads/main est permis`);
  if (!RE_WORKFLOW.test(env.GITHUB_WORKFLOW_REF ?? '')) throw new Error(`refus : workflow ${env.GITHUB_WORKFLOW_REF} non reconnu`);
}

function lancerGit(depot, args, env) {
  const r = spawnSync('git', ['-C', depot, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { ...env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } });
  return { code: r.status, sortie: r.stdout ?? '', erreur: `${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim() };
}

// ------------------------------------------------------------------------------------------------ job 1 : faits Git
export function faitsGit({ depot, entree, env = process.env }) {
  const ld = lireDemande(entree);
  if (ld.raison) throw new Error(`demande refusée : ${ld.raison}`);
  const d = ld.demande;
  const g = (...a) => lancerGit(depot, a, env);
  const erreurs = [];
  const id = {
    statut: 'non-etablie', branche_existe: false, branche_pointe: null, est_commit: false, base_tag: null, version_fichier_base: null,
    base_ancetre: false, merge_base: null, commits: 0, fusions: 0, tag_candidat_libre: false, main: null, branche_pointe_fin: null, constats: [],
  };
  const diff = { statut: 'non-etabli', fichiers: [], refuses: [], zones_touchees: [], tests_supprimes: [], tests_modifies: [] };
  const fin = () => {
    if (erreurs.length) id.statut = 'non-etablie';
    return { demande: d, identite: id, diff, erreurs_techniques: bornerListe(erreurs), executer: id.statut === 'etablie' && diff.statut === 'etabli' };
  };
  const RB = `refs/heads/${d.branche}`;
  const TB = `refs/tags/v${d.version_base}`;
  const TC = `refs/tags/v${d.version_candidat}`;
  const ls = g('ls-remote', 'origin', RB, TB, `${TB}^{}`, TC, 'refs/heads/main');
  if (ls.code !== 0) { erreurs.push(`lecture des refs distantes impossible (code ${ls.code}) : ${ls.erreur}`); return fin(); }
  const refs = new Map(ls.sortie.split('\n').filter(Boolean).map((l) => l.split('\t').reverse()));
  id.branche_existe = refs.has(RB);
  id.base_tag = refs.get(`${TB}^{}`) ?? refs.get(TB) ?? null;
  id.tag_candidat_libre = !refs.has(TC);
  id.main = refs.get('refs/heads/main') ?? null;
  const recup = [];
  if (id.branche_existe) recup.push(`+${RB}:refs/atelier-verif/candidat`);
  if (id.base_tag) recup.push(`+${TB}:refs/atelier-verif/base`);
  if (recup.length) {
    const fe = g('fetch', '--no-tags', '--quiet', 'origin', ...recup);
    if (fe.code !== 0) { erreurs.push(`récupération de la branche ou de l'étiquette impossible (code ${fe.code}) : ${fe.erreur}`); return fin(); }
  }
  const resoudre = (ref) => g('rev-parse', '--verify', '--quiet', `${ref}^{commit}`).sortie.trim() || null;
  if (id.branche_existe) {
    id.branche_pointe = resoudre('refs/atelier-verif/candidat');
    if (id.branche_pointe !== refs.get(RB)) { erreurs.push('branche déplacée pendant la lecture : relancer la vérification'); return fin(); }
  }
  if (id.base_tag && resoudre('refs/atelier-verif/base') !== id.base_tag) { erreurs.push('étiquette de base déplacée pendant la lecture'); return fin(); }
  id.est_commit = g('cat-file', '-t', d.candidat).sortie.trim() === 'commit';
  if (id.base_tag === d.base) {
    const v = g('show', `${d.base}:VERSION`);
    id.version_fichier_base = v.code === 0 ? v.sortie.trim() || null : null;
    if (id.est_commit) {
      const anc = g('merge-base', '--is-ancestor', d.base, d.candidat);
      if (anc.code === 0) id.base_ancetre = true;
      else if (anc.code !== 1) erreurs.push(`merge-base --is-ancestor impossible (code ${anc.code})`);
      const mb = g('merge-base', '--all', d.base, d.candidat);
      const l = mb.sortie.split('\n').filter(Boolean);
      if (mb.code === 0 && l.length === 1) id.merge_base = l[0];
      else if (mb.code !== 0 && mb.code !== 1) erreurs.push(`merge-base impossible (code ${mb.code})`);
      const compter = (...a) => {
        const r = g('rev-list', '--count', ...a, `${d.base}..${d.candidat}`);
        if (r.code !== 0 || !/^\d+\n?$/.test(r.sortie)) { erreurs.push(`rev-list impossible (code ${r.code})`); return 0; }
        return Number(r.sortie.trim());
      };
      id.commits = compter();
      id.fusions = compter('--merges');
    }
  }
  if (erreurs.length) return fin();
  id.branche_pointe_fin = id.branche_pointe; // provisoire : le job 3 relit la branche à la fin
  id.constats = jugerIdentite(d, id);
  id.statut = id.constats.length ? 'refusee' : 'etablie';
  if (id.statut !== 'etablie') { diff.statut = 'non-calcule'; return fin(); }
  // Identité établie : une erreur technique désormais rend seulement le diff non établi (rien n'est exécuté).
  const diffImpossible = (m) => {
    erreurs.push(m);
    Object.assign(diff, { statut: 'non-etabli', fichiers: [], refuses: [], zones_touchees: [], tests_supprimes: [], tests_modifies: [] });
    return { demande: d, identite: id, diff, erreurs_techniques: bornerListe(erreurs), executer: false };
  };
  const raw = g('diff', '--raw', '-z', '--no-renames', '--no-abbrev', '--no-ext-diff', '--no-textconv', d.base, d.candidat);
  const cd = raw.code === 0 ? classerDiff(raw.sortie) : { raison: `git diff impossible (code ${raw.code}) : ${raw.erreur}` };
  if (cd.raison) return diffImpossible(cd.raison);
  diff.fichiers = cd.fichiers.map((x) => ({ ...x }));
  diff.refuses = cd.refuses.map((x) => ({ ...x }));
  const chemins = [...diff.fichiers, ...diff.refuses].map((x) => x.chemin);
  diff.statut = diff.refuses.length ? 'refuse' : chemins.length ? 'etabli' : 'vide';
  diff.zones_touchees = chemins.filter(zonePermanente).sort();
  diff.tests_supprimes = diff.fichiers.filter((x) => x.etat === 'supprime' && x.chemin.startsWith('tests/')).map((x) => x.chemin);
  for (const x of diff.fichiers.filter((y) => y.etat === 'modifie' && y.chemin.startsWith('tests/'))) {
    const p = g('diff', '-U0', '--no-color', '--no-ext-diff', '--no-textconv', d.base, d.candidat, '--', x.chemin);
    if (p.code !== 0) return diffImpossible(`diff du test ${x.chemin} impossible (code ${p.code})`);
    const corps = p.sortie.split('\n');
    const debut = corps.findIndex((l) => l.startsWith('@@'));
    const ajouts = debut < 0 ? [] : corps.slice(debut).filter((l) => l.startsWith('+'));
    diff.tests_modifies.push({ chemin: x.chemin, marque_mise_a_jour: ajouts.some((l) => l.includes(MARQUE)) });
  }
  return fin();
}

// ------------------------------------------------------------------------------------------- job 2 : exécution réelle
export function analyserTests(texte) {
  const l = texte.split('\n').map((x) => x.replace(/\r$/, ''));
  const noms = ['tests', 'suites', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
  for (let i = l.length - 1; i >= 0; i -= 1) {
    if (!/^1\.\.\d+$/.test(l[i])) continue;
    const v = noms.map((n, k) => (new RegExp(`^# ${n} (\\d+)$`).exec(l[i + 1 + k]) || [])[1]);
    if (v.every((x) => x !== undefined) && /^# duration_ms [0-9.]+$/.test(l[i + 8] ?? '')) {
      const [tests, , pass, fail, cancelled, skipped, todo] = v.map(Number);
      return { total: tests, reussis: pass, echecs: fail, annules: cancelled, ignores: skipped + todo };
    }
  }
  return null;
}

export function analyserVerification({ lignes, code, signal, testsTxt, delaiMs }) {
  const textes = lignes.map((x) => x.texte);
  const json = lignes.find((x) => x.texte.startsWith('✅ JSON contrôlés'));
  const ligneTests = lignes.find((x) => LIGNE_TESTS.test(x.texte));
  const duree = json && ligneTests ? Math.max(0, Math.round(ligneTests.t - json.t)) : null;
  const resume = testsTxt === null ? null : analyserTests(testsTxt);
  const anormal = signal !== null || ![0, 1].includes(code);
  let statut;
  if (resume && resume.total >= 1) statut = resume.echecs > 0 || resume.annules > 0 ? 'echec' : ligneTests?.texte.startsWith('✅') ? 'executes' : 'crash';
  else if (anormal || !ligneTests) statut = 'crash';
  else if (ligneTests.texte.startsWith('ℹ️') || resume) statut = 'resume-absent';
  else statut = duree !== null && duree >= delaiMs ? 'delai-depasse' : 'resume-absent';
  const comptes = ['executes', 'echec'].includes(statut) ? resume : { total: null, reussis: null, echecs: null, annules: null, ignores: null };
  const etat = (erreur, ok) => (textes.some((t) => erreur.test(t)) ? 'erreur' : textes.some((t) => ok.test(t)) ? 'ok' : 'non-lancee');
  const fumeeOk = textes.some((t) => t.startsWith('✅ application démarrée')) && textes.some((t) => /^✅ version .+ affichée$/.test(t));
  const robot = {
    syntaxe: etat(/^❌ syntaxe :/, /^✅ syntaxe contrôlée/),
    json: etat(/^❌ JSON invalide/, /^✅ JSON contrôlés/),
    fumee: textes.some((t) => FUMEE.test(t)) ? 'erreur' : fumeeOk ? 'ok' : 'non-lancee',
    erreurs: bornerListe(textes.filter((t) => t.startsWith('❌') && !LIGNE_TESTS.test(t)).map((t) => t.slice(1).trim() || 'erreur')),
  };
  const techniques = anormal ? [`vérificateur du robot terminé anormalement (code ${code}, signal ${signal})`] : [];
  return { tests: { statut, ...comptes }, robot, duree, techniques };
}

function relireVersion(dossier, v) {
  const raisons = [];
  let version = null;
  try { version = fs.readFileSync(path.join(dossier, 'VERSION'), 'utf8'); } catch { raisons.push('VERSION absent'); }
  if (version !== null && version !== `${v}\n`) raisons.push(`VERSION = ${JSON.stringify(version)}`);
  const pkg = path.join(dossier, 'package.json');
  if (fs.existsSync(pkg)) {
    let lu = null;
    try { lu = JSON.parse(fs.readFileSync(pkg, 'utf8')).version; } catch { /* signalé ci-dessous */ }
    if (lu !== v) raisons.push(`package.json version = ${JSON.stringify(lu)}`);
  }
  const pile = [path.join(dossier, 'app')];
  while (pile.length) {
    const d = pile.pop();
    if (!fs.existsSync(d)) continue;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (/\.m?js$/.test(e.name)) {
        for (const ligne of fs.readFileSync(p, 'utf8').split('\n')) {
          if (!ligne.includes('VERSION_AUTO')) continue;
          const m = /"[^"\n]*"/.exec(ligne);
          if (m && m[0] !== `"${v}"`) raisons.push(`${path.relative(dossier, p)} porte ${m[0]}`);
        }
      }
    }
  }
  return { version: version === null ? null : version.trim() || null, raisons };
}

function lancerVerificateur({ verificateur, dossier, version, outils, rapport, env, delaiSecurite }) {
  return new Promise((fini) => {
    const lignes = [];
    let reste = '';
    const enfant = spawn(process.execPath, [verificateur, '--version', version, '--rapport', rapport, '--outils', outils], { cwd: dossier, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const minuterie = setTimeout(() => enfant.kill('SIGKILL'), delaiSecurite);
    enfant.stdout.setEncoding('utf8');
    enfant.stdout.on('data', (morceau) => {
      const t = performance.now();
      const parts = (reste + morceau).split('\n');
      reste = parts.pop();
      for (const texte of parts) lignes.push({ t, texte });
    });
    enfant.stderr.resume();
    enfant.on('close', (code, signal) => {
      clearTimeout(minuterie);
      if (reste) lignes.push({ t: performance.now(), texte: reste });
      fini({ lignes, code, signal });
    });
  });
}

export async function executerCandidat({ faitsGitTexte, env = process.env, delaiSecurite = 900000, ...chemins }) {
  // Chemins absolus : le déballeur et le vérificateur tournent avec cwd = le candidat.
  const [robot, dossier, outils, rapport] = ['robot', 'dossier', 'outils', 'rapport'].map((k) => path.resolve(chemins[k]));
  const ex = {
    statut: 'non-lancee', version_injectee: null, injection_relue: false, fichiers_injectes: [], delai_ms: null, code: null, duree_tests_ms: null,
    verifier_sha256: null, deballer_sha256: null,
  };
  let tests = { statut: 'non-lances', total: null, reussis: null, echecs: null, annules: null, ignores: null };
  let rb = { syntaxe: 'non-lancee', json: 'non-lancee', fumee: 'non-lancee', erreurs: [] };
  const erreurs = [];
  const fin = () => ({ execution: ex, tests, robot: rb, erreurs_techniques: bornerListe(erreurs) });
  const impossible = (m) => { erreurs.push(m); Object.assign(ex, { statut: 'impossible' }); return fin(); };
  let part;
  try { part = JSON.parse(faitsGitTexte); } catch { return impossible('faits Git illisibles'); }
  const ld = lireDemande(part?.demande);
  if (ld.raison) return impossible(`faits Git : ${ld.raison}`);
  if (part.executer !== true) return fin();
  const d = ld.demande;
  const head = lancerGit(dossier, ['rev-parse', 'HEAD'], env).sortie.trim();
  if (head !== d.candidat) return impossible(`le checkout du candidat est ${head || 'absent'}, pas ${d.candidat}`);
  if (lancerGit(dossier, ['status', '--porcelain', '--untracked-files=all'], env).sortie !== '') return impossible('checkout du candidat non propre avant injection');
  const verificateur = path.join(robot, 'verifier.mjs');
  const deballer = path.join(robot, 'deballer.py');
  let texteVerificateur;
  try {
    texteVerificateur = fs.readFileSync(verificateur, 'utf8');
    ex.verifier_sha256 = empreinteFichier(verificateur);
    ex.deballer_sha256 = empreinteFichier(deballer);
  } catch { return impossible('vérificateur ou déballeur du robot introuvable dans le checkout de main'); }
  // Délai des tests = l'unique « timeout: N » du corps de lancerTests() dans le vérificateur pris sur main.
  const debut = texteVerificateur.indexOf('function lancerTests(');
  const corps = debut < 0 ? '' : texteVerificateur.slice(debut, (texteVerificateur.indexOf('\nfunction ', debut + 1) + 1 || texteVerificateur.length + 1) - 1);
  const delais = [...corps.matchAll(/\btimeout:\s*(\d+)\b/g)];
  if (delais.length !== 1) return impossible('délai des tests du vérificateur du robot introuvable ou ambigu');
  ex.delai_ms = Number(delais[0][1]);
  const inj = spawnSync('python3', ['-I', '-B', '-c', INJECTION, robot, d.version_candidat], { cwd: dossier, encoding: 'utf8', env, timeout: 120000 });
  if (inj.status !== 0) return impossible(`injection de version impossible (code ${inj.status}) : ${(inj.stderr || '').trim().split('\n').pop() || ''}`);
  ex.fichiers_injectes = (inj.stdout || '').split('\n').map((l) => /^version injectée : (.+)$/.exec(l)?.[1]).filter(Boolean).sort();
  const lue = relireVersion(dossier, d.version_candidat);
  ex.version_injectee = lue.version;
  ex.injection_relue = lue.raisons.length === 0 && lue.version === d.version_candidat;
  if (!ex.injection_relue) return impossible(`version relue après injection ≠ ${d.version_candidat} : ${lue.raisons.join(' ; ')}`);
  fs.mkdirSync(rapport, { recursive: true });
  fs.rmSync(path.join(rapport, 'tests.txt'), { force: true });
  ex.statut = 'executee';
  const run = await lancerVerificateur({ verificateur, dossier, version: d.version_candidat, outils, rapport, env, delaiSecurite });
  ex.code = run.code;
  const chemin = path.join(rapport, 'tests.txt');
  const testsTxt = fs.existsSync(chemin) ? fs.readFileSync(chemin, 'utf8') : null;
  const a = analyserVerification({ lignes: run.lignes, code: run.code, signal: run.signal, testsTxt, delaiMs: ex.delai_ms });
  ex.duree_tests_ms = a.duree;
  tests = a.tests;
  rb = a.robot;
  erreurs.push(...a.techniques);
  fs.writeFileSync(path.join(rapport, 'sortie-verificateur.txt'), run.lignes.map((x) => x.texte).join('\n'));
  return fin();
}

// ----------------------------------------------------------------------------------------------- job 3 : assemblage
const SANS_EXECUTION = () => ({
  execution: { statut: 'non-lancee', version_injectee: null, injection_relue: false, fichiers_injectes: [], delai_ms: null, code: null, duree_tests_ms: null, verifier_sha256: null, deballer_sha256: null },
  tests: { statut: 'non-lances', total: null, reussis: null, echecs: null, annules: null, ignores: null },
  robot: { syntaxe: 'non-lancee', json: 'non-lancee', fumee: 'non-lancee', erreurs: [] },
  erreurs_techniques: [],
});

export function assembler({ depot, faitsGitTexte, executionTexte, env = process.env }) {
  const part = JSON.parse(faitsGitTexte);
  const ld = lireDemande(part.demande);
  if (ld.raison) throw new Error(`faits Git : ${ld.raison}`);
  const d = ld.demande;
  const erreurs = [...part.erreurs_techniques];
  let id = { ...part.identite };
  let diff = part.diff;
  let ex = SANS_EXECUTION();
  if (executionTexte === null) {
    if (part.executer) { erreurs.push('résultat de l\'exécution absent'); ex.execution.statut = 'impossible'; }
  } else {
    try { ex = JSON.parse(executionTexte); } catch { ex = SANS_EXECUTION(); ex.execution.statut = 'impossible'; erreurs.push('résultat de l\'exécution illisible'); }
  }
  const ls = lancerGit(depot, ['ls-remote', 'origin', `refs/heads/${d.branche}`], env);
  const vide = { statut: 'non-etabli', fichiers: [], refuses: [], zones_touchees: [], tests_supprimes: [], tests_modifies: [] };
  if (id.statut !== 'non-etablie') {
    if (ls.code !== 0) {
      erreurs.push('relecture finale de la branche impossible');
      id = { ...id, statut: 'non-etablie', branche_pointe_fin: null };
      diff = vide;
      ex = SANS_EXECUTION();
    } else {
      id.branche_pointe_fin = ls.sortie.split('\n').filter(Boolean).map((l) => l.split('\t')).find((x) => x[1] === `refs/heads/${d.branche}`)?.[0] ?? null;
      id.constats = jugerIdentite(d, id);
      if (id.constats.length && id.statut === 'etablie') { diff = { ...vide, statut: 'non-calcule' }; ex = SANS_EXECUTION(); }
      if (id.constats.length) id.statut = 'refusee';
    }
  }
  const verificateurSha = env.GITHUB_SHA || lancerGit(depot, ['rev-parse', 'HEAD'], env).sortie.trim();
  const provenance = { workflow_ref: env.GITHUB_WORKFLOW_REF || 'local (hors GitHub Actions)', verificateur_sha: verificateurSha, run_id: env.GITHUB_RUN_ID || '0', depot: env.GITHUB_REPOSITORY || 'local' };
  const faits = (x, e) => ({ protocole: 'atelier-faits-1', demande: d, provenance, identite: id, diff, execution: x.execution, tests: x.tests, robot: x.robot, erreurs_techniques: bornerListe(e) });
  try {
    return ecrireFaits(faits(ex, [...erreurs, ...(ex.erreurs_techniques ?? [])]), sha256Hex);
  } catch (e) {
    const repli = SANS_EXECUTION();
    repli.execution.statut = 'impossible';
    return ecrireFaits(faits(repli, [...erreurs, `résultat de l'exécution incohérent : ${e.message}`]), sha256Hex);
  }
}

export function faitsBloquants(f) {
  const b = [...f.erreurs_techniques];
  if (f.identite.statut !== 'etablie') b.push(`identité ${f.identite.statut}`);
  if (f.diff.statut !== 'etabli') b.push(`diff ${f.diff.statut}`);
  if (f.diff.zones_touchees.length) b.push('zone permanente touchée');
  if (f.diff.tests_supprimes.length) b.push('test existant supprimé');
  if (f.tests.statut !== 'executes') b.push(`tests ${f.tests.statut}`);
  if (f.robot.erreurs.length) b.push('erreur du vérificateur du robot');
  return b;
}

function resume(f, texte) {
  const l = [
    '## Atelier : faits techniques établis (atelier-faits-1)', '',
    `Branche \`${f.demande.branche}\`, candidat \`${f.demande.candidat}\`, base \`${f.demande.base}\` (v${f.demande.version_base}), version injectée demandée ${f.demande.version_candidat}.`, '',
    `- Identité : ${f.identite.statut}${f.identite.constats.length ? ` (${f.identite.constats.join(' ; ')})` : ''}`,
    `- Diff réel : ${f.diff.statut}, ${f.diff.fichiers.length} fichier(s), zones permanentes touchées : ${f.diff.zones_touchees.length}`,
    `- Tests existants : ${f.diff.tests_modifies.length} modifié(s), ${f.diff.tests_supprimes.length} supprimé(s)`,
    `- Tests réels : ${f.tests.statut}${f.tests.total === null ? '' : ` (${f.tests.reussis}/${f.tests.total}, ${f.tests.echecs} échec(s))`}`,
    `- Erreurs techniques : ${f.erreurs_techniques.length}`, '',
    'Ces faits ne décident rien : la confrontation avec la mission et le rapport se fait hors de GitHub.', '',
    'Faits à copier tels quels :', '', '```json', texte.trimEnd(), '```',
  ];
  return `${l.join('\n')}\n`;
}

// ------------------------------------------------------------------------------------------------------------ CLI
function options(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!/^--[a-z-]+$/.test(argv[i]) || argv[i + 1] === undefined) throw new Error(`option illisible : ${argv[i]}`);
    o[argv[i].slice(2)] = argv[i + 1];
  }
  return o;
}
const exiger = (o, ...cles) => { for (const k of cles) if (typeof o[k] !== 'string') throw new Error(`option --${k} absente`); };
const sortieGithub = (env, cle, valeur) => { if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `${cle}=${valeur}\n`); };

export async function principal(argv, env = process.env) {
  const [commande, ...reste] = argv;
  const o = options(reste);
  if (commande === 'confronter') {
    exiger(o, 'mission', 'rapport', 'faits');
    const res = confronter({ mission: JSON.parse(fs.readFileSync(o.mission, 'utf8')), rapport: fs.readFileSync(o.rapport, 'utf8'), faits: fs.readFileSync(o.faits, 'utf8'), hacherSha256: sha256Hex });
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    return 0;
  }
  gardeCi(env);
  if (commande === 'git') {
    exiger(o, 'depot', 'branche', 'candidat', 'base', 'version-base', 'version-candidat', 'sortie');
    const p = faitsGit({ depot: o.depot, env, entree: { branche: o.branche, candidat: o.candidat, base: o.base, version_base: o['version-base'], version_candidat: o['version-candidat'] } });
    fs.writeFileSync(o.sortie, `${JSON.stringify(p, null, 2)}\n`);
    sortieGithub(env, 'executer', p.executer ? 'oui' : 'non');
    process.stdout.write(`identité ${p.identite.statut} ; diff ${p.diff.statut} ; exécution ${p.executer ? 'à lancer' : 'non lancée'}\n`);
    return 0;
  }
  if (commande === 'execution') {
    exiger(o, 'robot', 'dossier', 'faits-git', 'outils', 'rapport', 'sortie');
    const p = await executerCandidat({ robot: o.robot, dossier: o.dossier, faitsGitTexte: fs.readFileSync(o['faits-git'], 'utf8'), outils: o.outils, rapport: o.rapport, env });
    fs.writeFileSync(o.sortie, `${JSON.stringify(p, null, 2)}\n`);
    process.stdout.write(`exécution ${p.execution.statut} ; tests ${p.tests.statut}\n`);
    return 0;
  }
  if (commande === 'assembler') {
    exiger(o, 'depot', 'faits-git', 'sortie');
    const execution = o.execution && fs.existsSync(o.execution) ? fs.readFileSync(o.execution, 'utf8') : null;
    const texte = assembler({ depot: o.depot, faitsGitTexte: fs.readFileSync(o['faits-git'], 'utf8'), executionTexte: execution, env });
    fs.writeFileSync(o.sortie, texte);
    const f = lireFaits(texte, sha256Hex).faits;
    if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, resume(f, texte));
    const bloquants = faitsBloquants(f);
    process.stdout.write(bloquants.length ? `faits bloquants : ${bloquants.join(' ; ')}\n` : 'aucun fait bloquant\n');
    return bloquants.length ? 1 : 0;
  }
  throw new Error(`commande inconnue : ${commande}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  principal(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => { process.stderr.write(`${e.message}\n`); process.exitCode = 2; });
}
// === FIN_ATELIER_VERIFIER_CANDIDAT ===
