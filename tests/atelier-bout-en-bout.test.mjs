// v0.65.6 — AT-6 « MANUEL DE BOUT EN BOUT » (GO 17/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune acquisition, aucun réseau.
// La chaîne RÉELLE AT-1 → AT-5, sans rien reconstruire : l'écran de l'atelier (gestes réels) lance la tentative ; le « travail de
// Claude » est simulé par un vrai commit sur une vraie branche atelier/* d'un petit dépôt Git temporaire, partie de la base B (étiquette
// v0.65.5 + un commit d'outillage hors colis, comme la recette réelle) ; la demande copiée par l'écran alimente le VRAI lanceur
// outils-atelier/verifier-candidat.mjs (faitsGit, executerCandidat avec le vrai déballeur et le vrai vérificateur dont seule la fumée
// navigateur est simulée, assembler) ; ses faits sont collés dans l'écran, confrontés, puis la décision humaine clôt le chantier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faitsGit, executerCandidat, assembler } from '../outils-atelier/verifier-candidat.mjs';
import { etatDe } from '../app/atelier/chantier.js';
import { texteDemande } from '../app/atelier/parcours.js';
import { RAPPORT_POUR, monterEcran } from './atelier-aide.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROBOT = join(RACINE, '.github', 'workflows');
const TMP = mkdtempSync(join(tmpdir(), 'atelier-e2e-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
const { NODE_TEST_CONTEXT, ...ENV_PROPRE } = process.env; // un « node --test » imbriqué doit se comporter comme celui du robot
const ENV = { ...ENV_PROPRE, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@a', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@a', GITHUB_ACTIONS: '' };
const git = (cwd, ...a) => {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};

// ------------------------------------------------------------------------------------------------ dépôt : T = v0.65.5, B = T + outillage
const ORIGINE = join(TMP, 'origine.git');
const TRAVAIL = join(TMP, 'travail');
const ecrire = (p, t) => { mkdirSync(dirname(join(TRAVAIL, p)), { recursive: true }); writeFileSync(join(TRAVAIL, p), t); };
git(TMP, 'init', '-q', '--bare', ORIGINE);
git(TMP, 'init', '-q', '-b', 'main', TRAVAIL);
git(TRAVAIL, 'remote', 'add', 'origin', ORIGINE);
ecrire('VERSION', '0.65.5\n');
ecrire('package.json', '{\n  "name": "fixture",\n  "version": "0.65.5"\n}\n');
ecrire('app/index.html', '<!doctype html><title>t</title>\n');
ecrire('app/version.js', 'export const VERSION = "0.65.5"; // VERSION_AUTO\n');
ecrire('tests/t.test.mjs', "import { test } from 'node:test';\ntest('t', () => {});\n");
git(TRAVAIL, 'add', '-A');
git(TRAVAIL, 'commit', '-q', '-m', 'v0.65.5');
git(TRAVAIL, 'tag', '-a', 'v0.65.5', '-m', 'v0.65.5');
ecrire('.github/workflows/LISEZMOI.md', 'Robot de livraison \nRecette AT-6.\n');
git(TRAVAIL, 'add', '-A');
git(TRAVAIL, 'commit', '-q', '-m', 'outillage hors colis');
const B = git(TRAVAIL, 'rev-parse', 'HEAD');
git(TRAVAIL, 'push', '-q', 'origin', 'main', '--tags');
const VERIF = join(TMP, 'verificateur');
git(TMP, 'clone', '-q', ORIGINE, VERIF);

// « Claude » : un commit sur la branche du dossier, partie de base.sha exact.
function travailDeClaude(mission, fichiers) {
  git(TRAVAIL, 'checkout', '-q', '--detach', mission.base.sha);
  for (const [p, t] of Object.entries(fichiers)) ecrire(p, t);
  git(TRAVAIL, 'add', '-A');
  git(TRAVAIL, 'commit', '-q', '-m', `candidat ${mission.tentative}`);
  const branche = `atelier/${mission.chantier}/${mission.jalon.id}/${mission.tentative}`;
  git(TRAVAIL, 'push', '-q', 'origin', `HEAD:refs/heads/${branche}`);
  return { branche, sha: git(TRAVAIL, 'rev-parse', 'HEAD') };
}
// Robot : le VRAI déballeur et le VRAI vérificateur ; seule la fumée navigateur est simulée.
const ROBOT_SIMULE = join(TMP, 'robot');
mkdirSync(ROBOT_SIMULE);
writeFileSync(join(ROBOT_SIMULE, 'deballer.py'), readFileSync(join(ROBOT, 'deballer.py')));
const VRAI = readFileSync(join(ROBOT, 'verifier.mjs'), 'utf8');
assert.equal(VRAI.split('await testDeFumee();').length, 2);
writeFileSync(join(ROBOT_SIMULE, 'verifier.mjs'), VRAI.replace('await testDeFumee();', "{ ok('application démarrée dans le navigateur'); ok(`version ${VERSION} affichée`); }"));
const PROV = { GITHUB_WORKFLOW_REF: 'proprio/depot/.github/workflows/atelier-verification.yml@refs/heads/main', GITHUB_SHA: B, GITHUB_RUN_ID: '43', GITHUB_REPOSITORY: 'proprio/depot' };
// Le run AT-5, nourri EXCLUSIVEMENT par la demande que l'écran a copiée (texte relu ligne à ligne, comme Claude le recevrait).
let n = 0;
async function runAT5(texte) {
  const demande = Object.fromEntries(texte.split('\n').filter((l) => /^[a-z_]+ = /.test(l)).map((l) => l.split(' = ')));
  assert.deepEqual(Object.keys(demande), ['branche', 'candidat', 'base', 'version_base', 'version_candidat']);
  const partie = faitsGit({ depot: VERIF, entree: demande, env: ENV });
  n += 1;
  const dossier = join(TMP, `candidat-${n}`);
  git(TMP, 'clone', '-q', ORIGINE, dossier);
  if (partie.executer) git(dossier, 'checkout', '-q', '--detach', demande.candidat);
  const rel = (p) => relative(process.cwd(), p);
  const p = await executerCandidat({ robot: rel(ROBOT_SIMULE), dossier: rel(dossier), faitsGitTexte: JSON.stringify(partie), outils: rel(join(TMP, 'outils-absents')), rapport: rel(join(TMP, `rapport-${n}`)), env: ENV });
  return assembler({ depot: VERIF, faitsGitTexte: JSON.stringify(partie), executionTexte: JSON.stringify(p), env: { ...ENV, ...PROV } });
}
const TEMOIN = "import { test } from 'node:test';\nimport assert from 'node:assert/strict';\ntest('témoin atelier', () => { assert.equal(1 + 1, 2); });\n";

async function tentative(a, fichiers, declares = Object.keys(fichiers).sort()) {
  await a.cliquer('generer');
  await a.cliquer('lancer');
  const cle = Object.keys(a.copie().pieces).at(-1);
  const m = a.copie().pieces[cle].mission;
  assert.equal(a.copies.at(-1).endsWith('FIN DE MISSION\n'), true);
  const c = travailDeClaude(m, fichiers);
  a.saisir('rapport', RAPPORT_POUR(m, { candidat: c, fichiers: { crees: declares, modifies: [], supprimes: [] }, tests: { total: 2, reussis: 2, echecs: 0 } }));
  await a.cliquer('enregistrer');
  await a.cliquer('copier-demande');
  const demande = a.copies.at(-1);
  assert.equal(demande, texteDemande(a.copie().pieces[cle].demande));
  a.saisir('faits-colles', await runAT5(demande));
  await a.cliquer('confronter');
  return { cle, c };
}
async function chantierOuvert() {
  const a = monterEcran({ version: '0.65.5' });
  await a.cliquer('mode-manuel');
  await a.cliquer('temoin');
  a.saisir('sha', B);
  await a.cliquer('ouvrir');
  await a.cliquer('approuver');
  return a;
}

test('bout en bout RÉEL : écran -> branche atelier/* -> lanceur AT-5 (vrai déballeur, vrai vérificateur) -> faits collés -> conforme -> acceptation -> clôture', async () => {
  const a = await chantierOuvert();
  const { cle, c } = await tentative(a, { 'tests/temoin-atelier.test.mjs': TEMOIN });
  assert.equal(c.branche, 'atelier/temoin-atelier/temoin-1/1');
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-conforme', a.texte());
  // Le segment d'outillage T..B (comme la recette réelle) est montré à examiner, sans changer le verdict.
  assert.match(a.un('a-examiner').children[0].textContent, /segment d'outillage hors colis entre l'étiquette v0\.65\.5 et la base .* \.github\/workflows\/LISEZMOI\.md/);
  assert.match(a.texte(), /Tests executes : 2 au total, 2 réussis, 0 échecs/);
  assert.match(a.texte(), /version injectée 0\.65\.6/);
  a.saisir('motif-decision', 'Témoin vérifié de bout en bout.');
  await a.cliquer('accepter');
  const e = etatDe(a.copie().journal);
  assert.equal(e.statut, 'termine');
  assert.equal(e.plan[0].tentatives[0].reference, `${c.branche}@${c.sha}`);
  assert.equal(a.copie().journal.at(-1).donnees.verdict, 'verification-technique-conforme');
  assert.equal(a.copie().pieces[cle].faits.length, 1);
  // main n'a pas bougé : seule la branche atelier/* existe en plus.
  assert.equal(git(VERIF, 'ls-remote', 'origin', 'refs/heads/main').split('\t')[0], B);
});

test('bout en bout RÉEL : candidat hors périmètre -> non conforme -> refus humain -> tentative 2 conforme -> acceptation', async () => {
  const a = await chantierOuvert();
  // Le chantier témoin est à la même base B ; une autre branche (tentative 1 de ce chantier) est créée par une autre « session ».
  git(TRAVAIL, 'push', '-q', 'origin', '--delete', 'atelier/temoin-atelier/temoin-1/1');
  // Le rapport (forme valide) ne déclare que le témoin ; Git montre aussi app/hors.js : les faits font foi, pas le rapport.
  await tentative(a, { 'tests/temoin-atelier.test.mjs': TEMOIN, 'app/hors.js': 'export const hors = 1;\n' }, ['tests/temoin-atelier.test.mjs']);
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-non-conforme');
  const raisons = a.un('raisons-non-conformite').children.map((x) => x.textContent).join('\n');
  assert.match(raisons, /hors du périmètre autorisé : « app\/hors\.js »/);
  assert.match(raisons, /rapport divergent des faits/);
  assert.equal(a.trouver('accepter').length, 0);
  a.saisir('motif-decision', 'Fichier hors périmètre.');
  await a.cliquer('refuser');
  const { c } = await tentative(a, { 'tests/temoin-atelier.test.mjs': TEMOIN });
  assert.equal(c.branche, 'atelier/temoin-atelier/temoin-1/2');
  assert.equal(a.un('verdict-technique').textContent, 'Verdict : verification-technique-conforme', a.texte());
  a.saisir('motif-decision', 'Seconde tentative conforme.');
  await a.cliquer('accepter');
  const e = etatDe(a.copie().journal);
  assert.equal(e.statut, 'termine');
  assert.deepEqual(e.plan[0].tentatives.map((t) => t.statut), ['rejetee', 'acceptee']);
});
