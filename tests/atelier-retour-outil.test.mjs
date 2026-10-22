// v0.65.21 — AT-10.4 « RETOUR DES FAITS SANS RECOPIE » (GO « AT-10.4 — GO RÉALISATION LOCALE », 21/10/2026 ; DI = F2, DJ, DL, DO).
// OUTILLAGE NON COGNITIF. outils-atelier/auto-retour.mjs sur une FAUSSE API GitHub (aucun réseau) et un dépôt git local : provenance
// (workflow, déclencheur, main, premier essai, titre T, dépôt, commit sur main), jobs et étapes (faits exigés, interdits), annotations
// (absentes, tronquées, dupliquées, étrangères, trop nombreuses), D3 (commit, empreinte, pièce), candidat, run AT-5, relance pendant la
// lecture, chaîne d'échec J1 ; références contradictoires ; aucun bloc sur STOP ; lecture seule (GET, aucune écriture distante).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { retour, principal, JOBS_AUTO, JOBS_AT5, WORKFLOW_AUTO, WORKFLOW_AT5 } from '../outils-atelier/auto-retour.mjs';
import { annotationsFaits, lireRetour, controlerRetour, texteRetour } from '../app/atelier/retour.js';
import { Stop } from '../outils-atelier/journal-atelier.mjs';
import { T, E7, D3, chaine, mission } from './atelier-retour-aide.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = mkdtempSync(join(tmpdir(), 'atelier-retour-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
const ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@a', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@a' };
const git = (cwd, ...a) => {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8', env: ENV });
  assert.equal(r.status, 0, `git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
const GITHUB = 'christopheplantegenest-prog/naissance-v02';
const CH = T.split('/')[0];
const SHA_CANDIDAT = JSON.parse(chaine({ commit: 'a'.repeat(40), run: '1', sha: 'a'.repeat(40), run5: '2', sha5: 'a'.repeat(40) }).textes.j4).candidat.sha;

// Distant : main (deux commits), journal-atelier/<chantier> (orpheline : E7 seul), atelier/T (référence posée telle quelle).
git(TMP, 'init', '-q', '--bare', 'origine.git');
git(TMP, 'init', '-q', '-b', 'main', 'auteur');
const A = join(TMP, 'auteur');
writeFileSync(join(A, 'VERSION'), '0.65.21\n');
git(A, 'add', '-A'); git(A, 'commit', '-q', '-m', 'base');
const HORS_MAIN = git(A, 'commit-tree', `${git(A, 'rev-parse', 'HEAD^{tree}')}`, '-m', 'hors main');
writeFileSync(join(A, 'VERSION'), '0.65.22\n');
git(A, 'add', '-A'); git(A, 'commit', '-q', '-m', 'suite');
const M = git(A, 'rev-parse', 'HEAD');
const M0 = git(A, 'rev-parse', 'HEAD^');
const blob = spawnSync('git', ['hash-object', '-w', '--stdin'], { cwd: A, input: E7, encoding: 'utf8', env: ENV }).stdout.trim();
const arbre = spawnSync('git', ['mktree'], { cwd: A, input: `100644 blob ${blob}\tchantier.json\n`, encoding: 'utf8', env: ENV }).stdout.trim();
const C = git(A, 'commit-tree', arbre, '-m', 'D3');
git(A, 'remote', 'add', 'origin', join(TMP, 'origine.git'));
git(A, 'push', '-q', 'origin', 'main', `${C}:refs/heads/journal-atelier/${CH}`, `${HORS_MAIN}:refs/heads/hors-main`);
const REF_CANDIDAT = join(TMP, 'origine.git', 'refs', 'heads', 'atelier', ...T.split('/'));
mkdirSync(dirname(REF_CANDIDAT), { recursive: true });
writeFileSync(REF_CANDIDAT, `${SHA_CANDIDAT}\n`);
const DEPOT = join(TMP, 'clone');
git(TMP, 'clone', '-q', join(TMP, 'origine.git'), DEPOT);

const RA = '7001';
const R5 = '7002';
const CH0 = chaine({ commit: C, run: RA, sha: M, run5: R5, sha5: M0 });
const E = D3.empreinte;
const notice = (lignes) => lignes.map((l) => { const m = /^::notice title=([^:]*)::(.*)$/.exec(l); return { path: '.github', start_line: 1, end_line: 1, annotation_level: 'notice', title: m[1], message: m[2] }; });
const ann = (g, t = CH0.textes[g]) => notice(annotationsFaits(g, t));
const etape = (name, conclusion = 'success') => ({ name, status: 'completed', conclusion, number: 1 });
// Fausse API : chemin -> réponse ; « change » : réponses modifiées (fonction de la réponse de base) ; journal des chemins lus.
function fausseApi({ textes = CH0.textes, change = {}, apres = {} } = {}) {
  const run = (id, path, cree, titre, sha) => ({ id: Number(id), path, repository: { full_name: GITHUB }, event: 'workflow_dispatch', head_branch: 'main', head_sha: sha, status: 'completed', conclusion: 'success', run_attempt: 1, created_at: cree, display_title: titre });
  const job = (id, name, run_id, steps, conclusion = 'success') => ({ id, name, run_id: Number(run_id), run_attempt: 1, status: 'completed', conclusion, steps });
  const base = {
    [`repos/${GITHUB}/actions/runs/${RA}`]: run(RA, WORKFLOW_AUTO, '2026-10-22T08:00:00Z', `atelier-auto ${T}`, M),
    [`repos/${GITHUB}/actions/runs/${RA}/attempts/1/jobs?per_page=100`]: { total_count: 4, jobs: [
      job(101, 'J1 garde', RA, [etape('Set up job'), etape('Garde (J1)')]),
      job(102, 'J2 frontière et appel', RA, [etape('Frontière (J2) — aucun appel'), etape('Préparer l\'appel (aucune requête)'), etape('Appel (une seule requête)')]),
      job(104, 'J4 candidat', RA, [etape('Construire le commit candidat (aucun contenu proposé exécuté)'), etape('Créer la branche candidate (création seule)'), etape('Constater le candidat (J4)')]),
      job(103, 'J3 constat', RA, [etape('Constat (J3)')]),
    ] },
    [`repos/${GITHUB}/check-runs/101/annotations?per_page=100`]: textes.j1 ? ann('j1', textes.j1) : [],
    [`repos/${GITHUB}/check-runs/102/annotations?per_page=100`]: [...(textes.j2f ? ann('j2f', textes.j2f) : []), { annotation_level: 'notice', title: 'Autre', message: 'sans rapport' }, ...(textes.j2 ? ann('j2', textes.j2) : [])],
    [`repos/${GITHUB}/check-runs/104/annotations?per_page=100`]: textes.j4 ? ann('j4', textes.j4) : [],
    [`repos/${GITHUB}/check-runs/103/annotations?per_page=100`]: textes.j3 ? ann('j3', textes.j3) : [],
    [`repos/${GITHUB}/actions/runs/${R5}`]: run(R5, WORKFLOW_AT5, '2026-10-22T08:20:00Z', 'Atelier — vérification technique', M0),
    [`repos/${GITHUB}/actions/runs/${R5}/attempts/1/jobs?per_page=100`]: { total_count: 3, jobs: [
      job(201, 'faits-git', R5, [etape('Établir les faits Git (aucun code candidat exécuté)')]),
      job(202, 'execution', R5, [etape('Exécuter le candidat avec le vérificateur du robot pris sur main')]),
      job(203, 'assemblage', R5, [etape('Assembler faits.json (relit la branche à la fin)'), etape('Conserver faits.json')]),
    ] },
    [`repos/${GITHUB}/check-runs/201/annotations?per_page=100`]: [],
    [`repos/${GITHUB}/check-runs/202/annotations?per_page=100`]: [],
    [`repos/${GITHUB}/check-runs/203/annotations?per_page=100`]: textes.at5 ? ann('at5', textes.at5) : [],
  };
  const lus = [];
  const vus = new Map();
  const api = (chemin) => {
    lus.push(chemin);
    vus.set(chemin, (vus.get(chemin) || 0) + 1);
    if (!Object.hasOwn(base, chemin)) throw new Stop(`STOP : API GitHub ${chemin} : 404`);
    let r = structuredClone(base[chemin]);
    if (change[chemin]) r = change[chemin](r);
    if (vus.get(chemin) > 1 && apres[chemin]) r = apres[chemin](r);
    return r;
  };
  return { api, lus };
}
const lancer = (p = {}, a = fausseApi()) => retour({ depot: DEPOT, github: GITHUB, tentative: T, runAuto: RA, runAt5: R5, commit: C, empreinte: E, api: a.api, env: ENV, ...p });
const refuse = (p, a, motif) => assert.throws(() => lancer(p, a), (e) => e instanceof Stop && motif.test(e.message), String(motif));
const runA = `repos/${GITHUB}/actions/runs/${RA}`;
const runB = `repos/${GITHUB}/actions/runs/${R5}`;
const jobsA = `${runA}/attempts/1/jobs?per_page=100`;
const jobsB = `${runB}/attempts/1/jobs?per_page=100`;
const annA = (id) => `repos/${GITHUB}/check-runs/${id}/annotations?per_page=100`;

test('O1 nominal : un bloc ATELIER-RETOUR-1 relu et contrôlé (mission rejouée) ; lecture seule de chemins GET exacts', () => {
  const a = fausseApi();
  const r = lancer({}, a);
  const l = lireRetour(r.bloc);
  assert.equal(l.raison, undefined);
  const c = controlerRetour(l.retour, { t: T, d3: { commit: C, empreinte: E }, mission: mission() });
  assert.equal(c.raison, undefined);
  assert.deepEqual([r.principal, r.utilises], ['j2', ['j2', 'j4', 'at5']]);
  assert.equal(r.bloc, texteRetour({ tentative: T, runs: { auto: { run_id: RA, workflow_sha: M }, at5: { run_id: R5, workflow_sha: M0 } }, d3: { commit: C, empreinte: E }, textes: CH0.textes }));
  assert.deepEqual(Object.keys(r.faits).sort(), ['at5', 'j1', 'j2', 'j2f', 'j3', 'j4']);
  assert.deepEqual(r.runs, { auto: `https://github.com/${GITHUB}/actions/runs/${RA}`, at5: `https://github.com/${GITHUB}/actions/runs/${R5}` });
  assert.deepEqual([...new Set(a.lus)].sort(), [runA, jobsA, annA(101), annA(102), annA(103), annA(104), runB, jobsB, annA(201), annA(202), annA(203)].sort());
  assert.equal(a.lus.filter((x) => x === runA).length, 2, 'run AUTO relu à la fin');
  assert.equal(a.lus.filter((x) => x === runB).length, 2, 'run AT-5 relu à la fin');
});

test('O2 run AUTO : workflow, dépôt, déclencheur, branche, état, essai, titre, commit hors main : STOP sans bloc', () => {
  const m = (f) => fausseApi({ change: { [runA]: (r) => { f(r); return r; } } });
  refuse({}, m((r) => { r.path = '.github/workflows/autre.yml'; }), /workflow « \.github\/workflows\/autre\.yml »/);
  refuse({}, m((r) => { r.repository.full_name = 'autre/depot'; }), /autre dépôt/);
  refuse({}, m((r) => { r.event = 'push'; }), /déclenché par « push »/);
  refuse({}, m((r) => { r.head_branch = 'atelier/x'; }), /lancé depuis « atelier\/x »/);
  refuse({}, m((r) => { r.status = 'in_progress'; }), /non terminé/);
  refuse({}, m((r) => { r.run_attempt = 2; }), /essai 2/);
  refuse({}, m((r) => { r.display_title = `atelier-auto ${T.replace('/1', '/2')}`; }), /titre/);
  refuse({}, m((r) => { r.id = 1; }), /illisible/);
  refuse({}, m((r) => { r.head_sha = HORS_MAIN; }), /n'est pas dans l'histoire de main/);
  refuse({}, m((r) => { r.created_at = 'hier'; }), /date illisible/);
  refuse({ runAuto: '7003' }, fausseApi(), /404/);
});

test('O3 jobs : inconnu, en double, d\'un autre run ou essai, non terminé, liste incomplète : STOP', () => {
  const m = (f) => fausseApi({ change: { [jobsA]: (r) => { f(r); return r; } } });
  refuse({}, m((r) => { r.jobs[0].name = 'J9 autre'; }), /job inconnu « J9 autre »/);
  refuse({}, m((r) => { r.jobs.push(structuredClone(r.jobs[0])); r.total_count = 5; }), /en double/);
  refuse({}, m((r) => { r.jobs[1].run_id = 1; }), /d'un autre run ou d'un autre essai/);
  refuse({}, m((r) => { r.jobs[1].run_attempt = 2; }), /d'un autre run ou d'un autre essai/);
  refuse({}, m((r) => { r.jobs[3].status = 'in_progress'; }), /non terminé/);
  refuse({}, m((r) => { r.total_count = 9; }), /incomplète/);
});

test('O4 annotations : faits absents d\'une étape conclue, genre étranger au job, étape sautée, tronquées, trop nombreuses : STOP', () => {
  refuse({}, fausseApi({ change: { [annA(102)]: (r) => r.filter((x) => !x.title.includes(' j2 ')) } }), /faits j2 absents \(étape conclue sans annotations\)/);
  refuse({}, fausseApi({ change: { [annA(101)]: () => [] } }), /faits j1 absents/);
  refuse({}, fausseApi({ change: { [annA(101)]: (r) => [...r, ...ann('j2')] } }), /job qui ne les produit pas/);
  refuse({}, fausseApi({ change: { [jobsA]: (r) => { r.jobs[1].steps[2].conclusion = 'skipped'; return r; } } }), /faits j2 annoncés par un job qui ne les produit pas/);
  refuse({}, fausseApi({ change: { [jobsA]: (r) => { r.jobs[2].conclusion = 'skipped'; return r; } } }), /job « J4 candidat » sauté mais étape conclue/);
  refuse({}, fausseApi({ change: { [annA(102)]: (r) => r.slice(0, -1) } }), /morceau 2\/2 absent/);
  refuse({}, fausseApi({ change: { [annA(104)]: (r) => [...r, ...r] } }), /en double/);
  refuse({}, fausseApi({ change: { [annA(103)]: (r) => [...r, ...Array(99).fill({ annotation_level: 'notice', title: 'x', message: 'y' })] } }), /trop nombreuses/);
  refuse({}, fausseApi({ change: { [annA(103)]: () => ({ message: 'Not Found' }) } }), /illisibles/);
  // Faits d'un AUTRE run (même T) transportés par ce run : refusés par le contrôle de provenance.
  const autre = chaine({ commit: C, run: '6999', sha: M, run5: R5, sha5: M0 });
  refuse({}, fausseApi({ textes: { ...CH0.textes, j3: autre.textes.j3 } }), /faits refusés : faits j3 d'un autre run/);
  // Faits d'un autre SHA de workflow : refusés.
  const sha = chaine({ commit: C, run: RA, sha: M0, run5: R5, sha5: M0 });
  refuse({}, fausseApi({ textes: { ...CH0.textes, j1: sha.textes.j1 } }), /faits j1 d'un autre run/);
});

test('O5 D3 : commit absent de la branche journal, empreinte différente, branche absente, chantier différent : STOP', () => {
  refuse({ commit: M }, fausseApi(), /n'est pas sur journal-atelier/);
  refuse({ empreinte: 'a'.repeat(64) }, fausseApi(), /empreinte de la D3 différente/);
  refuse({ tentative: `autre-chantier/run-at5/1` }, fausseApi({ change: { [runA]: (r) => ({ ...r, display_title: 'atelier-auto autre-chantier/run-at5/1' }) } }), /journal-atelier\/autre-chantier n'existe pas/);
  refuse({ commit: 'x' }, fausseApi(), /--commit/);
  refuse({ tentative: 'a/b' }, fausseApi(), /--tentative/);
  refuse({ github: 'pas un dépôt' }, fausseApi(), /--github/);
});

test('O6 candidat : branche atelier/T absente ou différente du SHA des faits J4 : STOP', () => {
  writeFileSync(REF_CANDIDAT, `${'b'.repeat(40)}\n`);
  try { refuse({}, fausseApi(), /branche atelier\/.* absente ou différente du candidat/); } finally { writeFileSync(REF_CANDIDAT, `${SHA_CANDIDAT}\n`); }
  rmSync(REF_CANDIDAT);
  try { refuse({}, fausseApi(), /absente ou différente du candidat/); } finally { writeFileSync(REF_CANDIDAT, `${SHA_CANDIDAT}\n`); }
  assert.ok(lancer().bloc);
});

test('O7 AT-5 : run absent alors que J4 a créé un candidat, antérieur, autre workflow, sans faits, faits hors assemblage : STOP', () => {
  refuse({ runAt5: null }, fausseApi(), /faits at5 absents : un retour après AT-5 est attendu/);
  refuse({}, fausseApi({ change: { [runB]: (r) => ({ ...r, created_at: '2026-10-22T07:00:00Z' }) } }), /antérieur au run AUTO/);
  refuse({}, fausseApi({ change: { [runB]: (r) => ({ ...r, path: WORKFLOW_AUTO }) } }), /workflow/);
  refuse({}, fausseApi({ change: { [annA(203)]: () => [] } }), /faits at5 absents/);
  refuse({}, fausseApi({ change: { [jobsB]: (r) => { r.jobs[2].steps[0].conclusion = 'skipped'; return r; }, [annA(203)]: () => [] } }), /aucun fait AT-5 \(assemblage non conclu\) : aucune relance automatique/);
  refuse({}, fausseApi({ change: { [annA(201)]: () => ann('at5') } }), /job qui ne les produit pas/);
  refuse({}, fausseApi({ change: { [runB]: (r) => ({ ...r, head_sha: M }) } }), /faits at5 d'un autre run/);
  refuse({ runAt5: RA }, fausseApi(), /workflow/);
  // Vérificateur pris sur un commit HORS de main (faits cohérents avec ce run) : refusé par la provenance Git.
  const hors = chaine({ commit: C, run: RA, sha: M, run5: R5, sha5: HORS_MAIN });
  refuse({}, fausseApi({ textes: hors.textes, change: { [runB]: (r) => ({ ...r, head_sha: HORS_MAIN }) } }), /n'est pas dans l'histoire de main/);
});

test('O8 relance pendant la lecture (second essai, autre commit) : STOP ; aucune relance automatique', () => {
  refuse({}, fausseApi({ apres: { [runA]: (r) => ({ ...r, run_attempt: 2 }) } }), /essai 2/);
  refuse({}, fausseApi({ apres: { [runB]: (r) => ({ ...r, run_attempt: 2 }) } }), /essai 2/);
  refuse({}, fausseApi({ apres: { [runA]: (r) => ({ ...r, head_sha: M0 }) } }), /a changé pendant la lecture/);
});

test('O9 échecs : J1 refusée, frontière arrêtée, issue inconnue : bloc des seuls faits établis, jamais un succès', () => {
  // J1 refusée (historique : exécution antérieure) : J2 et J4 sautés, J3 garde non franchie.
  const refus = CH0.j1({ historique: { total: 2, runs: [{ id: Number(RA), display_title: `atelier-auto ${T}`, run_attempt: 1, created_at: '2026-10-20T15:00:00Z' }, { id: 1, display_title: `atelier-auto ${T}`, run_attempt: 1, created_at: '2026-10-19T15:00:00Z' }] } });
  assert.equal(refus.raison, 'execution-anterieure');
  const j3 = CH0.j3({ garde: 'failure', appel: 'skipped' }).texte;
  const jobsRefus = (r) => {
    r.jobs[0].conclusion = 'failure'; r.jobs[0].steps[1].conclusion = 'failure';
    r.jobs[1].conclusion = 'skipped'; r.jobs[1].steps = [];
    r.jobs[2].conclusion = 'skipped'; r.jobs[2].steps = [];
    return r;
  };
  const r = lancer({ runAt5: null }, fausseApi({ textes: { j1: refus.texte, j3 }, change: { [jobsA]: jobsRefus } }));
  assert.deepEqual([r.principal, r.utilises, Object.keys(r.faits).sort()], ['j1', ['j1'], ['j1', 'j3']]);
  // Refus sans J3 : STOP (J3 « if: always » est toujours exigé).
  refuse({ runAt5: null }, fausseApi({ textes: { j1: refus.texte }, change: { [jobsA]: jobsRefus } }), /faits j3 absents/);
  // Frontière arrêtée (sonde acceptée) : étape d'appel sautée, J3 non-emis.
  const arret = CH0.j2f({ sonde: { code: 0, sortie: 'HTTP/2.0 200 OK' } });
  const jobsArret = (x) => { x.jobs[1].conclusion = 'failure'; x.jobs[1].steps[0].conclusion = 'failure'; x.jobs[1].steps[1].conclusion = 'skipped'; x.jobs[1].steps[2].conclusion = 'skipped'; x.jobs[2].conclusion = 'skipped'; x.jobs[2].steps = []; return x; };
  const ra = lancer({ runAt5: null }, fausseApi({ textes: { j1: CH0.textes.j1, j2f: arret.texte, j3: CH0.j3({ etape: 'skipped' }).texte }, change: { [jobsA]: jobsArret } }));
  assert.deepEqual([ra.principal, ra.utilises], ['j3', ['j3']]);
  // Appel exécuté mais faits J2 absents (étape en échec sans annotations) : STOP, jamais « non émis ».
  const jobsPanne = (x) => { x.jobs[1].conclusion = 'failure'; x.jobs[1].steps[2].conclusion = 'failure'; x.jobs[2].conclusion = 'skipped'; x.jobs[2].steps = []; return x; };
  refuse({ runAt5: null }, fausseApi({ textes: { j1: CH0.textes.j1, j2f: CH0.textes.j2f, j3: CH0.textes.j3 }, change: { [jobsA]: jobsPanne } }), /faits j2 absents/);
});

test('O10 ligne de commande : options strictes ; STOP = code 1, aucun bloc sur la sortie', () => {
  const a = fausseApi();
  const argv = ['--depot', DEPOT, '--github', GITHUB, '--tentative', T, '--run-auto', RA, '--run-at5', R5, '--commit', C, '--empreinte', E];
  assert.equal(principal(argv, ENV, a.api).bloc, lancer().bloc);
  assert.throws(() => principal([...argv, '--force', 'x'], ENV, a.api), /option inconnue : --force/);
  assert.throws(() => principal([...argv, '--commit', C], ENV, a.api), /option répétée/);
  assert.throws(() => principal(argv.slice(0, -1), ENV, a.api), /option illisible/);
  assert.throws(() => principal(argv.slice(2), ENV, a.api), /--depot attendu/);
  const cli = spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-retour.mjs'), ...argv.map((x) => (x === GITHUB ? 'pas-un-depot' : x))], { encoding: 'utf8', env: ENV });
  assert.deepEqual([cli.status, cli.stdout], [1, '']);
  assert.match(cli.stderr, /^STOP : --github PROPRIETAIRE\/DEPOT attendu\n$/);
});

test('O11 statique : lecture seule ; gh en GET seulement ; git sans écriture distante ; aucun secret ; imports bornés', () => {
  const src = readFileSync(join(RACINE, 'outils-atelier', 'auto-retour.mjs'), 'utf8');
  const c = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.deepEqual([...c.matchAll(/^import\b[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]).sort(), ['../app/atelier/auto.js', '../app/atelier/journal.js', '../app/atelier/parcours.js', '../app/atelier/retour.js', './journal-atelier.mjs', 'node:child_process', 'node:path', 'node:url']);
  assert.deepEqual([...new Set([...c.matchAll(/\bspawnSync\(([^,]+),/g)].map((m) => m[1]))].sort(), ["'gh'", "'git'"]);
  assert.match(c, /spawnSync\('gh', \['api', '--method', 'GET', chemin\]/);
  assert.deepEqual([...new Set([...c.matchAll(/\b(?:lancerGit|git)\(depot, \['([a-z-]+)'/g)].map((m) => m[1]))].sort(), ['cat-file', 'fetch', 'ls-remote', 'merge-base']);
  assert.equal((c.match(/\b(?:lancerGit|git)\(depot, \[/g) || []).length, 6, 'toutes les commandes git recensées');
  for (const m of [/'push'/, /--force/, /update-ref/, /commit-tree/, /secrets\./, /_TOKEN|\bTOKEN\b/, /ATELIER_TEMOIN_CLE/, /anthropic/i, /x-api-key/i, /\bfetch\(/, /require\(/, /\bimport\(/, /shell:\s*true/, /execSync|execFile|\bspawn\(/, /--method', '(POST|PUT|PATCH|DELETE)/, /writeFileSync|appendFileSync/]) assert.equal(m.test(c), false, String(m));
  assert.deepEqual(Object.keys(JOBS_AUTO), ['J1 garde', 'J2 frontière et appel', 'J4 candidat', 'J3 constat']);
  assert.deepEqual(Object.keys(JOBS_AT5), ['faits-git', 'execution', 'assemblage']);
  // Noms des jobs et des étapes : exactement ceux des workflows (lus dans .github/workflows, inchangés).
  const yAuto = readFileSync(join(RACINE, WORKFLOW_AUTO), 'utf8');
  for (const [job, etapes] of Object.entries(JOBS_AUTO)) {
    assert.equal(yAuto.split(`    name: ${job}\n`).length, 2, job);
    for (const e of Object.keys(etapes)) assert.equal(yAuto.split(`      - name: ${e}\n`).length, 2, e);
  }
  const yAt5 = readFileSync(join(RACINE, WORKFLOW_AT5), 'utf8');
  for (const [job, etapes] of Object.entries(JOBS_AT5)) {
    assert.equal(yAt5.split(`\n  ${job}:\n`).length, 2, job);
    for (const e of Object.keys(etapes)) assert.equal(yAt5.split(`      - name: ${e}\n`).length, 2, e);
  }
  assert.match(yAuto, /^run-name: atelier-auto \$\{\{ inputs\.chantier \}\}\/\$\{\{ inputs\.jalon \}\}\/\$\{\{ inputs\.numero \}\}$/m);
});
