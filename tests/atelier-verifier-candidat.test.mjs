// v0.65.4 — AT-5 : lanceur outils-atelier/verifier-candidat.mjs sur de VRAIS petits dépôts Git temporaires (aucun réseau).
// OUTILLAGE NON COGNITIF. Chaque sabotage est construit réellement (branche, commit, lien, sous-module, fusion, déplacement…) puis
// établi par le lanceur et confronté par app/atelier/verification.js. Le déballeur exécuté est le VRAI .github/workflows/deballer.py
// de ce dépôt ; le vérificateur est le VRAI verifier.mjs (une passe), ou une copie dont seuls le délai et la fumée sont simulés.
// MISE À JOUR DÉLIBÉRÉE v0.65.5 (correction AT-5, GO 17/10/2026) : délai réel lu dans verifier.mjs (plus aucune valeur figée) ;
// dépôts dédiés au segment T..B (outillage hors colis) : positifs, sabotages et non-contournement (aucune soustraction du diff).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyserTests, assembler, executerCandidat, faitsBloquants, faitsGit, gardeCi, principal, sha256Hex } from '../outils-atelier/verifier-candidat.mjs';
import { confronter, lireFaits } from '../app/atelier/verification.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROBOT = join(RACINE, '.github', 'workflows');
// Délai réel du robot, lu comme le lit le lanceur (corps de lancerTests() de verifier.mjs) : aucune valeur figée dans ce fichier.
const DELAI_REEL = Number(/function lancerTests\(\)[\s\S]*?\btimeout:\s*(\d+)/.exec(readFileSync(join(ROBOT, 'verifier.mjs'), 'utf8'))[1]);
const TMP = mkdtempSync(join(tmpdir(), 'atelier-verif-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
const { NODE_TEST_CONTEXT, ...ENV_PROPRE } = process.env; // un « node --test » imbriqué doit se comporter comme celui du robot
const ENV = { ...ENV_PROPRE, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@a', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@a', GITHUB_ACTIONS: '' };
const git = (cwd, ...a) => {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};

// ------------------------------------------------------------------------------------------------ dépôt de fixture
const ORIGINE = join(TMP, 'origine.git');
const TRAVAIL = join(TMP, 'travail');
const ecrire = (p, t) => { mkdirSync(dirname(join(TRAVAIL, p)), { recursive: true }); writeFileSync(join(TRAVAIL, p), t); };
const TEST_VIDE = (n) => `import { test } from 'node:test';\ntest('${n}', () => {});\n`;
git(TMP, 'init', '-q', '--bare', ORIGINE);
git(TMP, 'init', '-q', '-b', 'main', TRAVAIL);
git(TRAVAIL, 'remote', 'add', 'origin', ORIGINE);
ecrire('VERSION', '0.0.1\n');
ecrire('package.json', '{\n  "name": "fixture",\n  "version": "0.0.1"\n}\n');
ecrire('app/index.html', '<!doctype html><title>t</title>\n');
ecrire('app/version.js', 'export const VERSION = "0.0.1"; // VERSION_AUTO\n');
ecrire('app/a.js', 'export const a = 1;\n');
ecrire('tests/t.test.mjs', TEST_VIDE('t'));
ecrire('tests/u.test.mjs', TEST_VIDE('u'));
git(TRAVAIL, 'add', '-A');
git(TRAVAIL, 'commit', '-q', '-m', 'C0');
const C0 = git(TRAVAIL, 'rev-parse', 'HEAD');
ecrire('app/a.js', 'export const a = 2;\n');
git(TRAVAIL, 'commit', '-q', '-am', 'base');
const BASE = git(TRAVAIL, 'rev-parse', 'HEAD');
git(TRAVAIL, 'tag', '-a', 'v0.0.1', '-m', 'v0.0.1');
git(TRAVAIL, 'tag', '-a', 'v0.0.9', '-m', 'déjà prise', C0);
git(TRAVAIL, 'push', '-q', 'origin', 'main', '--tags');

function branche(nom, faire, depuis = BASE, indexer = () => {}) {
  git(TRAVAIL, 'checkout', '-q', '--detach', depuis);
  faire();
  git(TRAVAIL, 'add', '-A');
  indexer();
  git(TRAVAIL, 'commit', '-q', '--allow-empty', '-m', nom);
  git(TRAVAIL, 'push', '-q', '-f', 'origin', `HEAD:refs/heads/atelier/c/${nom}/1`);
  return git(TRAVAIL, 'rev-parse', 'HEAD');
}
const S = {
  bon: branche('bon', () => { ecrire('app/a.js', 'export const a = 3;\n'); ecrire('app/b.js', 'export const b = 1;\n'); }),
  zone: branche('zone', () => { ecrire('app/b.js', 'export const b = 1;\n'); ecrire('.github/x.yml', 'x: 1\n'); ecrire('VERSION', '9.9.9\n'); }),
  lien: branche('lien', () => symlinkSync('a.js', join(TRAVAIL, 'app', 'lien.js'))),
  sous: branche('sous', () => {}, BASE, () => git(TRAVAIL, 'update-index', '--add', '--cacheinfo', `160000,${C0},app/sous`)),
  tests: branche('tests', () => { rmSync(join(TRAVAIL, 'tests', 'u.test.mjs')); ecrire('tests/t.test.mjs', `${TEST_VIDE('t')}test('t2', () => {});\n`); }),
  marque: branche('marque', () => ecrire('tests/t.test.mjs', `${TEST_VIDE('t')}// MISE À JOUR DÉLIBÉRÉE v0.0.2 (raison)\n`)),
  vide: branche('vide', () => {}),
  rouge: branche('rouge', () => ecrire('tests/r.test.mjs', "import { test } from 'node:test';\ntest('r', () => { throw new Error('rouge'); });\n")),
  lent: branche('lent', () => ecrire('tests/l.test.mjs', "import { test } from 'node:test';\ntest('l', () => new Promise((r) => setTimeout(r, 900)));\n")),
  amont: branche('amont', () => ecrire('app/b.js', 'export const b = 1;\n'), C0),
  deplace: branche('deplace', () => ecrire('app/b.js', 'export const b = 1;\n')),
};
git(TRAVAIL, 'checkout', '-q', '--detach', BASE);
git(TRAVAIL, 'checkout', '-q', '-b', 'cote');
ecrire('app/b.js', 'export const b = 1;\n');
git(TRAVAIL, 'add', '-A');
git(TRAVAIL, 'commit', '-q', '-m', 'côté');
git(TRAVAIL, 'checkout', '-q', '--detach', BASE);
ecrire('app/c.js', 'export const c = 1;\n');
git(TRAVAIL, 'add', '-A');
git(TRAVAIL, 'commit', '-q', '-m', 'autre');
git(TRAVAIL, 'merge', '-q', '--no-ff', '-m', 'fusion', 'cote');
git(TRAVAIL, 'push', '-q', 'origin', 'HEAD:refs/heads/atelier/c/fusion/1');
S.fusion = git(TRAVAIL, 'rev-parse', 'HEAD');
git(TRAVAIL, 'checkout', '-q', '--orphan', 'orphelin');
git(TRAVAIL, 'commit', '-q', '-m', 'orphelin');
git(TRAVAIL, 'push', '-q', 'origin', 'HEAD:refs/heads/atelier/c/orphelin/1');
S.orphelin = git(TRAVAIL, 'rev-parse', 'HEAD');

// Le vérificateur est toujours un clone neuf (comme le checkout de main du job 1).
const VERIF = join(TMP, 'verificateur');
git(TMP, 'clone', '-q', ORIGINE, VERIF);
const demande = (nom, autre = {}) => ({ branche: `atelier/c/${nom}/1`, candidat: S[nom], base: BASE, version_base: '0.0.1', version_candidat: '0.0.2', ...autre });
const fg = (nom, autre) => faitsGit({ depot: VERIF, entree: demande(nom, autre), env: ENV });

// ------------------------------------------------------------------------------------------------ robots
function robotSimule(nom, transformer) {
  const d = join(TMP, `robot-${nom}`);
  mkdirSync(d);
  writeFileSync(join(d, 'deballer.py'), readFileSync(join(ROBOT, 'deballer.py')));
  writeFileSync(join(d, 'verifier.mjs'), transformer(readFileSync(join(ROBOT, 'verifier.mjs'), 'utf8')));
  return d;
}
const remplacer = (t, a, b) => { assert.equal(t.split(a).length, 2, `motif du vrai vérificateur introuvable : ${a}`); return t.replace(a, b); };
// Copie du VRAI vérificateur : seule la fumée (navigateur) est simulée, et le délai réduit pour le cas « délai dépassé ».
const FUMEE_SIMULEE = (t) => remplacer(t, 'await testDeFumee();', "{ ok('application démarrée dans le navigateur'); ok(`version ${VERSION} affichée`); }");
const R = {
  simule: robotSimule('simule', FUMEE_SIMULEE),
  lent: robotSimule('lent', (t) => remplacer(FUMEE_SIMULEE(t), `timeout: ${DELAI_REEL},`, 'timeout: 300,')),
  crash: robotSimule('crash', () => `console.log('✅ JSON contrôlés (1 fichiers)');\nprocess.kill(process.pid, 'SIGKILL'); // function lancerTests() { timeout: ${DELAI_REEL} }\n`),
  sansResume: robotSimule('sans-resume', () => "import fs from 'node:fs';\nconst a = process.argv;\nconsole.log('✅ JSON contrôlés (1 fichiers)');\nfs.writeFileSync(a[a.indexOf('--rapport') + 1] + '/tests.txt', 'TAP version 13\\nok 1 - t\\n');\nconsole.log('❌ tests automatiques en échec (voir tests.txt)');\nprocess.exit(1); // function lancerTests() { timeout: " + DELAI_REEL + " }\n"),
};
const RM = join(TMP, 'robot-mauvaise-injection');
mkdirSync(RM);
writeFileSync(join(RM, 'deballer.py'), remplacer(readFileSync(join(ROBOT, 'deballer.py'), 'utf8'), 'def injecter_version(v, journal):\n', 'def injecter_version(v, journal):\n    v = "0.0.3"\n'));
writeFileSync(join(RM, 'verifier.mjs'), FUMEE_SIMULEE(readFileSync(join(ROBOT, 'verifier.mjs'), 'utf8')));

let n = 0;
async function executer(nom, robot, partie = fg(nom)) {
  n += 1;
  const dossier = join(TMP, `candidat-${n}`);
  git(TMP, 'clone', '-q', ORIGINE, dossier);
  if (partie.executer) git(dossier, 'checkout', '-q', '--detach', S[nom]);
  // Chemins RELATIFS au répertoire courant, comme dans le workflow : le lanceur doit les rendre absolus (cwd du robot = le candidat).
  const rel = (p) => relative(process.cwd(), p);
  const p = await executerCandidat({ robot: rel(robot), dossier: rel(dossier), faitsGitTexte: JSON.stringify(partie), outils: rel(join(TMP, 'outils-absents')), rapport: rel(join(TMP, `rapport-${n}`)), env: ENV });
  return { partie, p, dossier };
}
const memo = new Map();
const executerUneFois = (nom, robot) => { const k = `${nom}|${robot}`; if (!memo.has(k)) memo.set(k, executer(nom, robot)); return memo.get(k); };
const PROV = { GITHUB_WORKFLOW_REF: 'proprio/depot/.github/workflows/atelier-verification.yml@refs/heads/main', GITHUB_SHA: BASE, GITHUB_RUN_ID: '42', GITHUB_REPOSITORY: 'proprio/depot' };
const assembler_ = (partie, p) => assembler({ depot: VERIF, faitsGitTexte: JSON.stringify(partie), executionTexte: p === null ? null : JSON.stringify(p), env: { ...ENV, ...PROV } });
const mission = (nom, autorises = ['app/'], extra = {}) => ({ chantier: 'c', objectif: 'Objectif.', base: { sha: BASE, version: '0.0.1' }, jalon: { id: nom, titre: 'Titre', comportement: 'Comportement.' }, tentative: 1, criteres: ['Critère.'], tests: ['Test.'], autorises, ...extra });
const rapport = (nom, fichiers, tests, autre = {}) => JSON.stringify({ protocole: 'atelier-rapport-1', chantier: 'c', jalon: nom, tentative: 1, base: { sha: BASE, version: '0.0.1' }, statut: 'candidat', candidat: { branche: `atelier/c/${nom}/1`, sha: S[nom] }, fichiers: { crees: [], modifies: [], supprimes: [], ...fichiers }, tests, divergences: [], question: null, motif: null, ...autre });
const conf = (nom, faits, r, m = mission(nom)) => confronter({ mission: m, rapport: r, faits, hacherSha256: sha256Hex });
const lire = (texte) => lireFaits(texte, sha256Hex).faits;

// ------------------------------------------------------------------------------------------------ chaîne complète
test('candidat correct : identité établie, diff réel, vrai déballeur, tests réels, faits canoniques, confrontation conforme', async () => {
  const { partie, p, dossier } = await executerUneFois('bon', R.simule);
  assert.equal(partie.identite.statut, 'etablie');
  assert.deepEqual(partie.diff.fichiers, [{ chemin: 'app/a.js', etat: 'modifie', mode: '100644' }, { chemin: 'app/b.js', etat: 'cree', mode: '100644' }]);
  assert.equal(partie.executer, true);
  assert.equal(p.execution.statut, 'executee', JSON.stringify(p.erreurs_techniques));
  assert.equal(p.execution.version_injectee, '0.0.2');
  assert.deepEqual(p.execution.fichiers_injectes, ['app/version.js']);
  assert.equal(readFileSync(join(dossier, 'app', 'version.js'), 'utf8'), 'export const VERSION = "0.0.2"; // VERSION_AUTO\n');
  assert.equal(p.execution.delai_ms, DELAI_REEL);
  assert.deepEqual(p.tests, { statut: 'executes', total: 2, reussis: 2, echecs: 0, annules: 0, ignores: 0 });
  assert.deepEqual([p.robot.syntaxe, p.robot.json, p.robot.fumee, p.robot.erreurs], ['ok', 'ok', 'ok', []]);
  assert.equal(existsSync(join(ROBOT, '__pycache__')), false);
  const texte = assembler_(partie, p);
  const f = lire(texte);
  assert.equal(f.identite.branche_pointe_fin, S.bon);
  assert.deepEqual(faitsBloquants(f), []);
  assert.equal(assembler_(partie, p), texte, 'déterministe');
  const res = conf('bon', texte, rapport('bon', { crees: ['app/b.js'], modifies: ['app/a.js'] }, { total: 2, reussis: 2, echecs: 0 }));
  assert.equal(res.verdict_technique, 'verification-technique-conforme', JSON.stringify(res));
  assert.equal(Object.isFrozen(res), true);
});

test('sabotage : rapport A, Git A + B -> divergence, non conforme', async () => {
  const { partie, p } = await executerUneFois('bon', R.simule);
  const res = conf('bon', assembler_(partie, p), rapport('bon', { modifies: ['app/a.js'] }, { total: 2, reussis: 2, echecs: 0 }));
  assert.equal(res.verdict_technique, 'verification-technique-non-conforme');
  assert.deepEqual(res.divergences_rapport, ['« app/b.js » cree selon Git, non déclaré par le rapport']);
  assert.equal(res.rapport, 'divergent');
});

test('sabotage : rapport vert, tests réellement rouges -> en échec, comptes divergents, non conforme', async () => {
  const { partie, p } = await executer('rouge', R.simule);
  assert.deepEqual(p.tests, { statut: 'echec', total: 3, reussis: 2, echecs: 1, annules: 0, ignores: 0 });
  const res = conf('rouge', assembler_(partie, p), rapport('rouge', { crees: ['tests/r.test.mjs'] }, { total: 3, reussis: 3, echecs: 0 }, {}), mission('rouge', ['tests/r.test.mjs']));
  assert.equal(res.verdict_technique, 'verification-technique-non-conforme');
  assert.equal(res.tests, 'en-echec');
  assert.deepEqual(res.divergences_rapport, ['tests.reussis : le rapport annonce 3, l\'exécution réelle compte 2', 'tests.echecs : le rapport annonce 0, l\'exécution réelle compte 1']);
});

test('sabotage : candidat correct, rapport mensonger sur les fichiers et les tests -> non conforme', async () => {
  const { partie, p } = await executerUneFois('bon', R.simule);
  const res = conf('bon', assembler_(partie, p), rapport('bon', { crees: ['app/b.js', 'app/z.js'], modifies: [], supprimes: ['app/a.js'] }, { total: 9, reussis: 9, echecs: 0 }));
  assert.equal(res.verdict_technique, 'verification-technique-non-conforme');
  assert.equal(res.identite, 'verifiee');
  assert.equal(res.tests, 'executes-sans-echec');
  assert.equal(res.divergences_rapport.length, 4);
});

test('sabotages d\'identité : SHA différent, mauvaise base, base non ancêtre, merge-base incorrecte, fusion, orphelin, branche absente, étiquette déjà prise', () => {
  const cas = [
    [fg('bon', { candidat: S.zone }), /la branche pointe sur .*, pas sur le candidat demandé/],
    [fg('bon', { base: C0 }), /l'étiquette v0\.0\.1 \([0-9a-f]{40}\) n'est ni la base [0-9a-f]{40} ni un ancêtre de cette base/],
    [fg('amont'), /la base n'est pas un ancêtre du candidat/],
    [fg('amont'), new RegExp(`merge-base = ${C0}, la base ${BASE} attendue`)],
    [fg('fusion'), /1 commit\(s\) de fusion/],
    [fg('orphelin'), /merge-base = null/],
    [faitsGit({ depot: VERIF, entree: { ...demande('bon'), branche: 'atelier/c/absente/1' }, env: ENV }), /branche atelier\/c\/absente\/1 absente du dépôt/],
    [fg('bon', { version_candidat: '0.0.9' }), /l'étiquette v0\.0\.9 existe déjà/],
  ];
  for (const [p, motif] of cas) {
    assert.equal(p.identite.statut, 'refusee');
    assert.ok(p.identite.constats.some((c) => motif.test(c)), `${motif} dans ${p.identite.constats}`);
    assert.equal(p.diff.statut, 'non-calcule');
    assert.equal(p.executer, false);
    const jalon = p.demande.branche.split('/')[2];
    const base = { sha: p.demande.base, version: '0.0.1' };
    const r = rapport('bon', { modifies: ['app/a.js'] }, { total: 1, reussis: 1, echecs: 0 }, { jalon, base, candidat: { branche: p.demande.branche, sha: p.demande.candidat } });
    const res = conf(jalon, assembler_(p, null), r, mission(jalon, ['app/'], { base }));
    assert.equal(res.verdict_technique, 'verification-technique-non-conforme', motif.source);
    assert.equal(res.identite, 'non-conforme');
  }
});

test('sabotages de diff : zone permanente, lien symbolique, sous-module, diff vide, fichier hors périmètre', () => {
  const zone = fg('zone');
  assert.deepEqual(zone.diff.zones_touchees, ['.github/x.yml', 'VERSION']);
  assert.ok(conf('zone', assembler_(zone, null), '{}').raisons_non_conformite.includes('zone permanente touchée : « .github/x.yml »'));
  const lien = fg('lien');
  assert.deepEqual([lien.diff.statut, lien.diff.refuses], ['refuse', [{ chemin: 'app/lien.js', mode: '120000', motif: 'lien symbolique' }]]);
  const sous = fg('sous');
  assert.deepEqual([sous.diff.statut, sous.diff.refuses], ['refuse', [{ chemin: 'app/sous', mode: '160000', motif: 'sous-module' }]]);
  assert.equal(fg('vide').diff.statut, 'vide');
  assert.equal(zone.executer, true, 'une zone touchée n\'empêche pas d\'établir les tests réels');
  for (const p of [lien, sous, fg('vide')]) assert.equal(p.executer, false);
  for (const [nom, p, motif] of [['lien', lien, /refusé \(lien symbolique/], ['sous', sous, /refusé \(sous-module/], ['vide', fg('vide'), /diff vide/]]) {
    const res = conf(nom, assembler_(p, null), '{}');
    assert.equal(res.verdict_technique, 'verification-technique-non-conforme');
    assert.ok(res.raisons_non_conformite.some((r) => motif.test(r)), nom);
  }
  const bon = fg('bon');
  const res = conf('bon', assembler_(bon, null), '{}', mission('bon', ['app/a.js']));
  assert.ok(res.raisons_non_conformite.includes('hors du périmètre autorisé : « app/b.js »'));
});

test('tests existants : suppression non conforme, modification signalée avec ou sans marque (indice seulement)', () => {
  const t = fg('tests');
  assert.deepEqual(t.diff.tests_supprimes, ['tests/u.test.mjs']);
  assert.deepEqual(t.diff.tests_modifies, [{ chemin: 'tests/t.test.mjs', marque_mise_a_jour: false }]);
  const res = conf('tests', assembler_(t, null), '{}', mission('tests', ['tests/']));
  assert.ok(res.raisons_non_conformite.some((r) => r.startsWith('test existant supprimé : « tests/u.test.mjs »')));
  assert.match(res.a_examiner[0], /AUCUN de ses ajouts ne porte « MISE À JOUR DÉLIBÉRÉE »/);
  const m = fg('marque');
  assert.deepEqual(m.diff.tests_modifies, [{ chemin: 'tests/t.test.mjs', marque_mise_a_jour: true }]);
  assert.match(conf('marque', assembler_(m, null), '{}', mission('marque', ['tests/'])).a_examiner[0], /ses ajouts portent « MISE À JOUR DÉLIBÉRÉE »/);
});

test('sabotage : branche déplacée entre l\'établissement des faits et l\'assemblage -> non conforme', () => {
  const p = fg('deplace');
  assert.equal(p.identite.statut, 'etablie');
  git(TRAVAIL, 'checkout', '-q', '--detach', S.deplace);
  git(TRAVAIL, 'commit', '-q', '--allow-empty', '-m', 'après');
  git(TRAVAIL, 'push', '-q', '-f', 'origin', 'HEAD:refs/heads/atelier/c/deplace/1');
  const f = lire(assembler_(p, null));
  assert.equal(f.identite.statut, 'refusee');
  assert.match(f.identite.constats.join(), /branche déplacée pendant la vérification/);
  assert.equal(f.execution.statut, 'non-lancee');
  assert.equal(conf('deplace', JSON.stringify(f), '{}').verdict_technique, 'verification-technique-non-conforme');
});

test('sabotage : mauvaise version injectée -> exécution impossible, aucun test lancé, vérification impossible', async () => {
  const { partie, p } = await executer('bon', RM);
  assert.equal(p.execution.statut, 'impossible');
  assert.equal(p.execution.version_injectee, '0.0.3');
  assert.equal(p.tests.statut, 'non-lances');
  assert.match(p.erreurs_techniques[0], /version relue après injection ≠ 0\.0\.2/);
  const res = conf('bon', assembler_(partie, p), rapport('bon', { crees: ['app/b.js'], modifies: ['app/a.js'] }, { total: 2, reussis: 2, echecs: 0 }));
  assert.equal(res.verdict_technique, 'verification-impossible');
});

test('délai dépassé (délai lu dans le vérificateur pris sur main) / crash / résumé absent : trois statuts distincts', async () => {
  const lent = await executer('lent', R.lent);
  assert.equal(lent.p.execution.delai_ms, 300);
  assert.equal(lent.p.tests.statut, 'delai-depasse');
  assert.ok(lent.p.execution.duree_tests_ms >= 300);
  const r1 = conf('lent', assembler_(lent.partie, lent.p), rapport('lent', { crees: ['tests/l.test.mjs'] }, { total: 3, reussis: 3, echecs: 0 }), mission('lent', ['tests/l.test.mjs']));
  assert.equal(r1.verdict_technique, 'verification-technique-non-conforme');
  assert.equal(r1.tests, 'delai-depasse');
  const crash = await executer('bon', R.crash);
  assert.equal(crash.p.tests.statut, 'crash');
  assert.match(crash.p.erreurs_techniques[0], /signal SIGKILL/);
  const sans = await executer('bon', R.sansResume);
  assert.equal(sans.p.tests.statut, 'resume-absent');
  const rap = rapport('bon', { crees: ['app/b.js'], modifies: ['app/a.js'] }, { total: 2, reussis: 2, echecs: 0 });
  for (const x of [crash, sans]) assert.equal(conf('bon', assembler_(x.partie, x.p), rap).verdict_technique, 'verification-impossible');
});

test('rapport bloque ou echec présenté comme candidat -> non conforme', async () => {
  const { partie, p } = await executerUneFois('bon', R.simule);
  const faits = assembler_(partie, p);
  for (const autre of [{ statut: 'bloque', candidat: null, tests: null, question: 'Q ?' }, { statut: 'echec', candidat: null, tests: null, motif: 'M.' }]) {
    const res = conf('bon', faits, rapport('bon', { crees: ['app/b.js'], modifies: ['app/a.js'] }, null, autre));
    assert.equal(res.verdict_technique, 'verification-technique-non-conforme');
    assert.match(res.raisons_non_conformite[0], /aucun candidat annoncé/);
  }
});

test('entrées injectables refusées avant toute commande ; garde CI : seul atelier-verification.yml lancé depuis main', async () => {
  for (const b of ['atelier/c/j/1;rm', 'atelier/c/$(id)/1', 'atelier/../j/1', 'atelier/c j/x/1', 'atelier/C/j/1', 'atelier/c/j/0', 'atelier/c/j/1000', 'main', 'atelier/c/j/1\n']) {
    assert.throws(() => faitsGit({ depot: VERIF, entree: { ...demande('bon'), branche: b }, env: ENV }), /demande refusée/, b);
  }
  assert.throws(() => faitsGit({ depot: VERIF, entree: { ...demande('bon'), candidat: '-c x' }, env: ENV }), /demande refusée/);
  const ci = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main', GITHUB_WORKFLOW_REF: PROV.GITHUB_WORKFLOW_REF };
  assert.doesNotThrow(() => gardeCi(ci));
  assert.throws(() => gardeCi({ ...ci, GITHUB_REF: 'refs/heads/atelier/c/bon/1' }), /seul refs\/heads\/main/);
  assert.throws(() => gardeCi({ ...ci, GITHUB_WORKFLOW_REF: 'proprio/depot/.github/workflows/atelier-verification.yml@refs/heads/atelier/c/bon/1' }), /non reconnu/);
  assert.throws(() => gardeCi({ ...ci, GITHUB_WORKFLOW_REF: 'proprio/depot/.github/workflows/autre.yml@refs/heads/main' }), /non reconnu/);
  await assert.rejects(principal(['git', '--depot', VERIF, '--branche', 'atelier/c/bon/1', '--candidat', S.bon, '--base', BASE, '--version-base', '0.0.1', '--version-candidat', '0.0.2', '--sortie', join(TMP, 'x.json')], { ...ENV, ...ci, GITHUB_REF: 'refs/heads/autre' }), /refus/);
  assert.equal(existsSync(join(TMP, 'x.json')), false);
});

test('provenance hors main, faits d\'une autre demande : vérification impossible', async () => {
  const { partie, p } = await executerUneFois('bon', R.simule);
  const rap = rapport('bon', { crees: ['app/b.js'], modifies: ['app/a.js'] }, { total: 2, reussis: 2, echecs: 0 });
  for (const ref of ['proprio/depot/.github/workflows/atelier-verification.yml@refs/heads/atelier/c/bon/1', 'local (hors GitHub Actions)']) {
    const t = assembler({ depot: VERIF, faitsGitTexte: JSON.stringify(partie), executionTexte: JSON.stringify(p), env: { ...ENV, ...PROV, GITHUB_WORKFLOW_REF: ref === 'local (hors GitHub Actions)' ? '' : ref } });
    const res = conf('bon', t, rap);
    assert.equal(res.verdict_technique, 'verification-impossible');
    assert.match(res.raisons_impossibilite[0], /provenance non reconnue/);
  }
  const faits = assembler_(partie, p);
  assert.match(conf('autre', faits, rap, mission('autre')).raisons_impossibilite[0], /faits d'une autre demande : branche/);
  assert.match(conf('bon', faits, rap, { ...mission('bon'), base: { sha: C0, version: '0.0.1' } }).raisons_impossibilite[0], /faits d'une autre demande : base/);
});

test('analyse du résumé TAP : seul le bloc final « 1..N » fait foi, jamais une ligne écrite par un test', () => {
  assert.deepEqual(analyserTests('# tests 99\n# pass 99\n1..2\n# tests 2\n# suites 0\n# pass 1\n# fail 1\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 3.5\n'), { total: 2, reussis: 1, echecs: 1, annules: 0, ignores: 0 });
  const bloc = (n, f) => `1..${n}\n# tests ${n}\n# suites 0\n# pass ${n - f}\n# fail ${f}\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
  assert.deepEqual(analyserTests(`${bloc(1, 0)}ok 2 - suite\n${bloc(5, 2)}`), { total: 5, reussis: 3, echecs: 2, annules: 0, ignores: 0 }, 'le DERNIER bloc fait foi');
  assert.equal(analyserTests('TAP version 13\n# tests 99\n# pass 99\n'), null);
  assert.equal(analyserTests('1..2\n# tests 2\n# pass 2\n'), null);
});

test('le lanceur ne contient aucun shell, aucune écriture distante, aucun secret ; il n\'est importé par aucun fichier de app/', () => {
  const c = readFileSync(join(RACINE, 'outils-atelier', 'verifier-candidat.mjs'), 'utf8');
  assert.doesNotMatch(c, /shell:\s*true|\bexecSync\b|\bexecFile|\{[^}]*\bexec\b[^}]*\} from 'node:child_process'/);
  assert.deepEqual([...new Set([...c.matchAll(/\bspawn(?:Sync)?\(([^,]+),/g)].map((m) => m[1]))].sort(), ["'git'", "'python3'", 'process.execPath']);
  const sousCommandes = [...c.matchAll(/\bg\('([a-z-]+)'|lancerGit\([a-z]+, \['([a-z-]+)'/g)].map((m) => m[1] ?? m[2]);
  assert.deepEqual([...new Set(sousCommandes)].sort(), ['cat-file', 'diff', 'fetch', 'ls-remote', 'merge-base', 'rev-list', 'rev-parse', 'show', 'status']);
  assert.doesNotMatch(c, /--force\b|secrets\.|ANTHROPIC|_TOKEN|GH_TOKEN|\bfetch\(|https?:/);
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7) : outils-atelier/ gagne journal-atelier.mjs (outil MANUEL de la branche journal, gardé par
  // tests/atelier-journal-git.test.mjs) ; verifier-candidat.mjs reste le seul lanceur AT-5.
  assert.equal(readdirSync(join(RACINE, 'outils-atelier')).sort().join(), 'journal-atelier.mjs,verifier-candidat.mjs');
  const pile = [join(RACINE, 'app')];
  while (pile.length) {
    const d = pile.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) pile.push(join(d, e.name));
      else if (/\.(m?js|html)$/.test(e.name)) assert.doesNotMatch(readFileSync(join(d, e.name), 'utf8'), /(from|import\()\s*['"][^'"]*(outils-atelier|verifier-candidat)/, e.name);
    }
  }
});

// ------------------------------------------------------------------------------------------------ v0.65.5 : segment T..B
// Un dépôt neuf par scénario : T = étiquette v0.0.1, puis ce que le scénario construit (segment, main, candidat), poussé vers une
// origine nue ; le lanceur lit toujours un clone neuf. Demande : base = B (base Git du chantier), version_base 0.0.1.
let nDepot = 0;
function depotSegment(construire) {
  nDepot += 1;
  const o = join(TMP, `seg-${nDepot}.git`);
  const w = join(TMP, `seg-${nDepot}`);
  git(TMP, 'init', '-q', '--bare', o);
  git(TMP, 'init', '-q', '-b', 'main', w);
  git(w, 'remote', 'add', 'origin', o);
  const ec = (p, t) => { mkdirSync(dirname(join(w, p)), { recursive: true }); writeFileSync(join(w, p), t); };
  const commit = (m, faire = () => {}, indexer = () => {}) => { faire(); git(w, 'add', '-A'); indexer(); git(w, 'commit', '-q', '--allow-empty', '-m', m); return git(w, 'rev-parse', 'HEAD'); };
  const sur = (sha) => git(w, 'checkout', '-q', '--detach', sha);
  const pousser = (ref, sha = 'HEAD') => git(w, 'push', '-q', '-f', 'origin', `${sha}:${ref}`);
  ec('VERSION', '0.0.1\n');
  ec('package.json', '{\n  "name": "fixture",\n  "version": "0.0.1"\n}\n');
  ec('app/index.html', '<!doctype html><title>t</title>\n');
  ec('app/version.js', 'export const VERSION = "0.0.1"; // VERSION_AUTO\n');
  ec('app/a.js', 'export const a = 1;\n');
  ec('tests/t.test.mjs', TEST_VIDE('t'));
  ec('.github/workflows/outil.yml', 'x: 1\n');
  const T = commit('T');
  git(w, 'tag', '-a', 'v0.0.1', '-m', 'v0.0.1');
  pousser('refs/heads/main');
  git(w, 'push', '-q', 'origin', '--tags');
  const ctx = { w, T, ec, commit, sur, pousser, rm: (p) => rmSync(join(w, p), { recursive: true, force: true }), git: (...a) => git(w, ...a) };
  const { B, C, apres = () => {} } = construire(ctx);
  pousser('refs/heads/atelier/c/seg/1', C);
  apres(ctx);
  const verif = join(TMP, `seg-${nDepot}-verif`);
  git(TMP, 'clone', '-q', o, verif);
  const entree = { branche: 'atelier/c/seg/1', candidat: C, base: B, version_base: '0.0.1', version_candidat: '0.0.2' };
  return { T, B, C, o, verif, p: faitsGit({ depot: verif, entree, env: ENV }) };
}
const outil = (ctx, n, t = 'x: 2\n') => ctx.commit(`outil ${n}`, () => ctx.ec(`.github/workflows/${n}`, t));
const candidatSur = (ctx, B, faire = () => ctx.ec('app/b.js', 'export const b = 1;\n')) => { ctx.sur(B); return ctx.commit('candidat', faire); };
const missionSeg = (B, autorises = ['app/']) => ({ chantier: 'c', objectif: 'Objectif.', base: { sha: B, version: '0.0.1' }, jalon: { id: 'seg', titre: 'Titre', comportement: 'Comportement.' }, tentative: 1, criteres: ['Critère.'], tests: ['Test.'], autorises });
const rapportSeg = (d, fichiers, tests) => JSON.stringify({ protocole: 'atelier-rapport-1', chantier: 'c', jalon: 'seg', tentative: 1, base: { sha: d.B, version: '0.0.1' }, statut: 'candidat', candidat: { branche: 'atelier/c/seg/1', sha: d.C }, fichiers: { crees: [], modifies: [], supprimes: [], ...fichiers }, tests, divergences: [], question: null, motif: null });
const assemblerSeg = (d, partie = d.p, p = null) => assembler({ depot: d.verif, faitsGitTexte: JSON.stringify(partie), executionTexte: p === null ? null : JSON.stringify(p), env: { ...ENV, ...PROV } });
const constatsDe = (d) => d.p.identite.constats.join(' | ');

test('positif B = T : segment établi vide, identité établie (non-régression de la recette réelle)', () => {
  const d = depotSegment((ctx) => { const C = candidatSur(ctx, ctx.T); return { B: ctx.T, C }; });
  assert.equal(d.p.identite.statut, 'etablie', constatsDe(d));
  assert.deepEqual(d.p.identite.segment, { statut: 'etabli', commits: 0, fusions: 0, fichiers: [], refuses: [], hors_outillage: [] });
  assert.deepEqual([d.p.identite.base_tag, d.p.identite.tag_ancetre_base, d.p.identite.base_sur_main], [d.T, true, true]);
});

test('positif B = T + commit d\'outillage .github/workflows : chaîne complète réelle, conforme, segment signalé à examiner', async () => {
  let X;
  const d = depotSegment((ctx) => {
    X = outil(ctx, 'outil.yml');
    outil(ctx, 'atelier-verification.yml', 'y: 1\n');
    const B = ctx.git('rev-parse', 'HEAD');
    ctx.pousser('refs/heads/main');
    return { B, C: candidatSur(ctx, B) };
  });
  assert.notEqual(X, d.T);
  const id = d.p.identite;
  assert.equal(id.statut, 'etablie', constatsDe(d));
  assert.deepEqual([id.base_tag, id.main, id.segment.commits, id.segment.fusions], [d.T, d.B, 2, 0]);
  assert.deepEqual(id.segment.fichiers, [{ chemin: '.github/workflows/atelier-verification.yml', etat: 'cree', mode: '100644' }, { chemin: '.github/workflows/outil.yml', etat: 'modifie', mode: '100644' }]);
  assert.deepEqual(d.p.diff.fichiers, [{ chemin: 'app/b.js', etat: 'cree', mode: '100644' }], 'diff B..C seul : le segment n\'y entre pas, rien n\'est soustrait');
  const dossier = join(TMP, `seg-exec-${nDepot}`);
  git(TMP, 'clone', '-q', d.o, dossier);
  git(dossier, 'checkout', '-q', '--detach', d.C);
  const p = await executerCandidat({ robot: R.simule, dossier, faitsGitTexte: JSON.stringify(d.p), outils: join(TMP, 'outils-absents'), rapport: join(TMP, `seg-rapport-${nDepot}`), env: ENV });
  assert.equal(p.tests.statut, 'executes', JSON.stringify(p));
  const faits = assemblerSeg(d, d.p, p);
  assert.equal(lire(faits).identite.segment.commits, 2);
  const res = confronter({ mission: missionSeg(d.B), rapport: rapportSeg(d, { crees: ['app/b.js'] }, { total: 1, reussis: 1, echecs: 0 }), faits, hacherSha256: sha256Hex });
  assert.equal(res.verdict_technique, 'verification-technique-conforme', JSON.stringify(res));
  assert.match(res.a_examiner[0], /^segment d'outillage hors colis entre l'étiquette v0\.0\.1 et la base [0-9a-f]{40} : 2 commit\(s\) ; fichiers : \.github\/workflows\/atelier-verification\.yml, \.github\/workflows\/outil\.yml/);
  const autreBase = confronter({ mission: missionSeg(d.T), rapport: rapportSeg(d, { crees: ['app/b.js'] }, { total: 1, reussis: 1, echecs: 0 }), faits, hacherSha256: sha256Hex });
  assert.equal(autreBase.verdict_technique, 'verification-impossible');
  assert.match(autreBase.raisons_impossibilite[0], /faits d'une autre demande : base/, 'mission.base ≠ B');
});

test('positif B antérieur à la tête actuelle de main : identité établie, main lu tel qu\'observé', () => {
  let M;
  const d = depotSegment((ctx) => {
    const B = outil(ctx, 'outil.yml');
    M = outil(ctx, 'outil.yml', 'x: 3\n');
    ctx.pousser('refs/heads/main');
    return { B, C: candidatSur(ctx, B) };
  });
  assert.equal(d.p.identite.statut, 'etablie', constatsDe(d));
  assert.deepEqual([d.p.identite.main, d.p.identite.segment.commits], [M, 1]);
});

test('sabotages du segment T..B : app/, tests/, VERSION, zip racine, lien, sous-module, fusion -> identité refusée, rien n\'est exécuté', () => {
  const cas = [
    ['app/', (ctx) => ctx.commit('s', () => ctx.ec('app/x.js', 'export const x = 1;\n')), [/« app\/x\.js » hors de \.github\/workflows\//]],
    ['tests/', (ctx) => ctx.commit('s', () => ctx.ec('tests/x.test.mjs', TEST_VIDE('x'))), [/« tests\/x\.test\.mjs » hors de \.github\/workflows\//]],
    ['VERSION', (ctx) => ctx.commit('s', () => ctx.ec('VERSION', '0.0.5\n')), [/« VERSION » hors de/, /VERSION de la base = "0\.0\.5", « 0\.0\.1 » attendu/]],
    ['zip', (ctx) => ctx.commit('s', () => ctx.ec('colis-0_0_2.zip', 'PK')), [/« colis-0_0_2\.zip » hors de/]],
    ['lien', (ctx) => ctx.commit('s', () => symlinkSync('outil.yml', join(ctx.w, '.github', 'workflows', 'lien.yml'))), [/« \.github\/workflows\/lien\.yml » refusé \(lien symbolique, mode 120000\)/]],
    ['sous-module', (ctx) => ctx.commit('s', () => {}, () => ctx.git('update-index', '--add', '--cacheinfo', `160000,${ctx.T},.github/workflows/sous`)), [/« \.github\/workflows\/sous » refusé \(sous-module, mode 160000\)/]],
    ['fusion', (ctx) => { ctx.git('checkout', '-q', '-b', 'cote'); outil(ctx, 'a.yml'); ctx.sur(ctx.T); outil(ctx, 'b.yml'); ctx.git('merge', '-q', '--no-ff', '-m', 'fusion', 'cote'); return ctx.git('rev-parse', 'HEAD'); }, [/segment v0\.0\.1\.\.base : 1 commit\(s\) de fusion/]],
  ];
  for (const [nom, segment, motifs] of cas) {
    const d = depotSegment((ctx) => { segment(ctx); const B = ctx.git('rev-parse', 'HEAD'); ctx.pousser('refs/heads/main'); return { B, C: candidatSur(ctx, B) }; });
    assert.equal(d.p.identite.statut, 'refusee', nom);
    for (const m of motifs) assert.ok(d.p.identite.constats.some((c) => m.test(c)), `${nom} : ${m} dans ${constatsDe(d)}`);
    assert.equal(d.p.identite.constats.length, motifs.length, `${nom} : ${constatsDe(d)}`);
    assert.deepEqual([d.p.diff.statut, d.p.executer], ['non-calcule', false], nom);
    const res = confronter({ mission: missionSeg(d.B), rapport: rapportSeg(d, { crees: ['app/b.js'] }, { total: 1, reussis: 1, echecs: 0 }), faits: assemblerSeg(d), hacherSha256: sha256Hex });
    assert.deepEqual([res.verdict_technique, res.identite], ['verification-technique-non-conforme', 'non-conforme'], nom);
    assert.equal(lire(assemblerSeg(d)).identite.segment.statut, 'etabli', `${nom} : segment conservé dans les faits`);
  }
});

test('sabotages des identités : B fabriqué sur la branche candidate, B retiré de main, étiquette hors de la lignée de B -> refusée', () => {
  const surCandidat = depotSegment((ctx) => { const B = outil(ctx, 'outil.yml'); return { B, C: candidatSur(ctx, B) }; });
  assert.match(constatsDe(surCandidat), /la base [0-9a-f]{40} n'est ni la tête de main \([0-9a-f]{40}\) ni un ancêtre de cette tête/);
  assert.equal(surCandidat.p.identite.constats.length, 1, constatsDe(surCandidat));
  const retire = depotSegment((ctx) => {
    const B = outil(ctx, 'outil.yml');
    ctx.pousser('refs/heads/main');
    return { B, C: candidatSur(ctx, B), apres: (c) => c.pousser('refs/heads/main', c.T) };
  });
  assert.deepEqual([retire.p.identite.statut, retire.p.identite.main, retire.p.identite.base_sur_main], ['refusee', retire.T, false]);
  const horsLignee = depotSegment((ctx) => {
    const cote = ctx.commit('côté', () => ctx.ec('app/cote.js', '1;\n'));
    ctx.git('tag', '-f', '-a', 'v0.0.1', '-m', 'déplacée', cote);
    ctx.git('push', '-q', '-f', 'origin', 'refs/tags/v0.0.1');
    ctx.sur(ctx.T);
    const B = outil(ctx, 'outil.yml');
    ctx.pousser('refs/heads/main');
    return { B, C: candidatSur(ctx, B) };
  });
  assert.match(constatsDe(horsLignee), /l'étiquette v0\.0\.1 \([0-9a-f]{40}\) n'est ni la base [0-9a-f]{40} ni un ancêtre de cette base/);
  assert.deepEqual([horsLignee.p.identite.tag_ancetre_base, horsLignee.p.identite.segment.statut], [false, 'non-calcule']);
  for (const d of [surCandidat, retire, horsLignee]) assert.equal(confronter({ mission: missionSeg(d.B), rapport: rapportSeg(d, { crees: ['app/b.js'] }, null), faits: assemblerSeg(d), hacherSha256: sha256Hex }).identite, 'non-conforme');
});

test('NON-CONTOURNEMENT : T -> outillage X -> B -> C retouche, restaure ou recopie X : le changement reste visible dans B..C', () => {
  const X = '.github/workflows/outil.yml';
  const scenario = (faire, depuis = 'B') => depotSegment((ctx) => {
    const B = outil(ctx, 'outil.yml');
    ctx.pousser('refs/heads/main');
    return { B, C: candidatSur(ctx, depuis === 'B' ? B : ctx.T, () => { ctx.ec('app/b.js', 'export const b = 1;\n'); faire(ctx); }) };
  });
  for (const [nom, t] of [['retouche', 'x: 3\n'], ['restaure la version de T', 'x: 1\n']]) {
    const d = scenario((ctx) => ctx.ec(X, t));
    assert.equal(d.p.identite.statut, 'etablie', nom);
    assert.deepEqual(d.p.diff.fichiers.map((f) => [f.chemin, f.etat]), [[X, 'modifie'], ['app/b.js', 'cree']].sort(), nom);
    assert.deepEqual(d.p.diff.zones_touchees, [X], nom);
    const res = confronter({ mission: missionSeg(d.B), rapport: rapportSeg(d, { crees: ['app/b.js'], modifies: [X] }, null), faits: assemblerSeg(d), hacherSha256: sha256Hex });
    assert.equal(res.verdict_technique, 'verification-technique-non-conforme', nom);
    assert.ok(res.raisons_non_conformite.includes(`zone permanente touchée : « ${X} »`), nom);
    // La formule interdite (diff T..C moins diff T..B) aurait effacé X : la preuve est construite, puis écartée.
    const nomsDiff = (a, b) => git(d.verif, 'diff', '--name-only', a, b).split('\n').filter(Boolean);
    const soustraction = nomsDiff(d.T, d.C).filter((p) => !nomsDiff(d.T, d.B).includes(p));
    assert.equal(soustraction.includes(X), false, `${nom} : la soustraction aurait caché X`);
  }
  const recopie = scenario((ctx) => ctx.ec(X, 'x: 2\n'), 'T');
  assert.equal(recopie.p.identite.statut, 'refusee', 'un candidat parti de T qui recopie X n\'est pas un descendant de B');
  assert.match(constatsDe(recopie), /la base n'est pas un ancêtre du candidat/);
  const github = scenario((ctx) => ctx.ec('.github/workflows/autre.yml', 'z: 1\n'));
  assert.deepEqual(github.p.diff.zones_touchees, ['.github/workflows/autre.yml']);
  assert.equal(confronter({ mission: missionSeg(github.B), rapport: '{}', faits: assemblerSeg(github), hacherSha256: sha256Hex }).verdict_technique, 'verification-technique-non-conforme');
});
