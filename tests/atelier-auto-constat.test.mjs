// v0.65.22 — AT-10.4 correction J3 (GO « AT-10.4 — GO RÉALISATION LOCALE CORRECTION J3 », 22/10/2026 ; D-007). OUTILLAGE NON COGNITIF.
// Recette R1 (run 39799596191) : J3 a lu la liste des jobs UNE fois, 3 s après la fin de J2, et l'API montrait encore J2 « waiting » :
// ISSUE INCONNUE au lieu de NON ÉMIS. Correction : le workflow relit la liste (GET seulement, au plus 10 lectures, 6 s d'intervalle,
// 15 s par lecture) jusqu'à ce que etatStable la dise terminale et cohérente ; constater (auto.js) conclut UNE fois sur la dernière.
// Ce fichier exécute le VRAI script de l'étape (extrait du workflow) avec de faux gh, timeout et sleep (aucun réseau, aucune attente),
// puis le vrai constat (CLI) ; il prouve aussi que le reste du workflow est inchangé octet pour octet (hors commentaires).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync, chmodSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { etatStable } from '../outils-atelier/auto-constat.mjs';
import { constater, decisionCloture, lireFaitsAuto, NOMS_RUN } from '../app/atelier/auto.js';
import { VARIABLES } from '../outils-atelier/auto-garde.mjs';
import { monterEcran, confirmerSauvegarde, BASE } from './atelier-aide.mjs';
import { canonique, etatDurableDe } from '../app/atelier/journal.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = readFileSync(join(RACINE, '.github', 'workflows', 'atelier-auto.yml'), 'utf8');
const sha = (t) => createHash('sha256').update(t).digest('hex');

// ------------------------------------------------------------------------------------------------ jobs vus par J3 (formes de R1)
const ok = (name) => ({ name, status: 'completed', conclusion: 'success' });
const J1 = (conclusion = 'success', status = 'completed') => ({ name: NOMS_RUN.garde, status, conclusion, steps: [] });
const J3_EN_COURS = { name: 'J3 constat', status: 'in_progress', conclusion: null, steps: [] };
const etapesJ2 = (appel, avant = 'failure') => [ok('Set up job'), ok('Récupérer main (outils de la frontière)'), ok('Frontière (J2) — aucun appel'),
  ok('Lire les fichiers autorisés à la base (aucune requête)'), { name: 'Préparer l\'appel (aucune requête)', status: 'completed', conclusion: avant },
  ...(appel === null ? [] : [{ name: NOMS_RUN.etape, ...appel }]), { name: 'Proposition à conserver ?', status: 'completed', conclusion: 'skipped' }];
const J2 = (status, conclusion, steps = []) => ({ name: NOMS_RUN.appel, status, conclusion, steps });
// R1, première (et seule) lecture : J2 encore « waiting », sans étapes.
const R1_PERIME = [J1(), J2('waiting', null), J3_EN_COURS];
// R1, état final relu plus tard par Claude : préparation en échec, étape Appel sautée, J2 en échec.
const R1_FINAL = [J1(), J2('completed', 'failure', etapesJ2({ status: 'completed', conclusion: 'skipped' })), J3_EN_COURS, { name: 'J4 candidat', status: 'completed', conclusion: 'skipped', steps: [] }];
const SAUTE = [J1(), J2('completed', 'skipped'), J3_EN_COURS];
const APPEL = (conclusion) => [J1(), J2('completed', conclusion === 'success' ? 'success' : 'failure', etapesJ2({ status: 'completed', conclusion }, 'success')), J3_EN_COURS];
const CONTRADICTOIRE = [J1(), J2('completed', 'skipped', etapesJ2({ status: 'completed', conclusion: 'success' }, 'success')), J3_EN_COURS];

// Entrées et contexte EXACTS de R1 : le rejeu d'une API restée périmée redonne les faits j3 de R1 à l'octet près.
const ENV_R1 = {
  ATELIER_CHANTIER: 'recette-at104', ATELIER_JALON: 'blanc-1', ATELIER_NUMERO: '1',
  ATELIER_COMMIT: '8e5e3ece4e947c744f81a0b210f5ac252e5788c8', ATELIER_EMPREINTE: 'aaeaa3620e7c743e11d7c8835a95a23c154610490f285538887d0f46f276dcef',
  GITHUB_RUN_ID: '39799596191', GITHUB_RUN_ATTEMPT: '1', GITHUB_WORKFLOW_SHA: 'd1d2d2e93984278a0c9451bcac9de80709462cd9', GITHUB_REF: 'refs/heads/main',
};
const EMPREINTE_ANNOTATION_J3_R1 = '7b48bf9f42305bfdb9abcde665df99f65337762149ab958ad9a3fe1feb1b54e0'; // titre ATELIER-FAITS-1 j3 de R1 (contrôle DJ)

// ------------------------------------------------------------------------------------------------ script réel de l'étape J3
function scriptLecture(y = WORKFLOW) {
  const m = /- name: Lire les jobs de ce run \(essai courant\)\n {8}env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n {8}run: \|\n((?: {10}.*\n)+)/.exec(y);
  assert.ok(m, 'étape de lecture J3 introuvable');
  return m[1].replace(/^ {10}/gm, '');
}
// Faux outils : gh rend la k-ième lecture prévue (la dernière ensuite) ; 'ERREUR' = sortie partielle et code 1 ; 'PENDU' = code 124
// (ce que rend timeout) ; timeout et sleep sont journalisés, sans attente réelle.
function rejouer(lectures, { script = scriptLecture() } = {}) {
  const t = mkdtempSync(join(tmpdir(), 'atelier-j3-'));
  try {
    const faux = join(t, 'faux');
    const bin = join(t, 'bin');
    const runner = join(t, 'runner');
    for (const d of [faux, bin, runner]) mkdirSync(d);
    lectures.forEach((l, i) => writeFileSync(join(faux, `lecture-${i + 1}`), typeof l === 'string' ? l : JSON.stringify(l)));
    writeFileSync(join(faux, 'nombre'), String(lectures.length));
    const outil = (nom, corps) => { writeFileSync(join(bin, nom), `#!/bin/bash\n${corps}\n`); chmodSync(join(bin, nom), 0o755); };
    outil('gh', [
      'F="$ATELIER_FAUX"', 'n=$(( $(cat "$F/appels" 2>/dev/null || echo 0) + 1 ))', 'echo "$n" > "$F/appels"',
      'printf "%s\\n" "$*" >> "$F/gh.log"', 'k=$n; m=$(cat "$F/nombre"); [ "$k" -gt "$m" ] && k=$m',
      'c=$(cat "$F/lecture-$k")', 'if [ "$c" = ERREUR ]; then printf "[{\\"name\\": \\"J1 ga"; exit 1; fi',
      'if [ "$c" = PENDU ]; then printf "[{"; exit 124; fi', 'printf "%s" "$c"'].join('\n'));
    outil('timeout', 'echo "$1" >> "$ATELIER_FAUX/timeout.log"; shift; exec "$@"');
    outil('sleep', 'echo "$1" >> "$ATELIER_FAUX/sleep.log"');
    const env = { PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, ATELIER_FAUX: faux, RUNNER_TEMP: runner, GH_TOKEN: 'jeton-factice',
      GITHUB_REPOSITORY: 'proprietaire/depot', GITHUB_RUN_ID: ENV_R1.GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT: '1' };
    const r = spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], { cwd: RACINE, env, encoding: 'utf8' });
    const D = join(runner, 'atelier-auto');
    const fichiersApresLecture = readdirSync(D).sort();
    const c = spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-constat.mjs'), '--dossier', D], { cwd: RACINE, env: { PATH: env.PATH, ...ENV_R1 }, encoding: 'utf8' });
    const lire = (n) => (existsSync(join(faux, n)) ? readFileSync(join(faux, n), 'utf8').split('\n').filter(Boolean) : []);
    const texte = readFileSync(join(D, 'faits-constat.json'), 'utf8');
    return { code: r.status, sortie: r.stdout, erreur: r.stderr, gh: lire('gh.log'), sleep: lire('sleep.log'), timeout: lire('timeout.log'), fichiersApresLecture,
      codeConstat: c.status, texte, faits: JSON.parse(texte) };
  } finally { rmSync(t, { recursive: true, force: true }); }
}
const issue = (r) => [r.faits.issue, r.faits.raison];
const URL_JOBS = 'api repos/proprietaire/depot/actions/runs/39799596191/attempts/1/jobs?per_page=100 --jq .jobs';

// ------------------------------------------------------------------------------------------------ etatStable (pur)
test('etatStable : état terminal cohérent seulement ; « étape Appel terminée » n\'est pas « émission réussie » (il ne conclut rien)', () => {
  const cas = [
    [R1_PERIME, false, 'job-appel-en-cours'],
    [R1_FINAL, true, 'etape-appel-terminee'],
    [SAUTE, true, 'job-appel-saute'],
    [APPEL('success'), true, 'etape-appel-terminee'],
    [APPEL('failure'), true, 'etape-appel-terminee'],
    [APPEL('cancelled'), true, 'etape-appel-terminee'],
    [CONTRADICTOIRE, false, 'contradiction-job-saute'],
    [[J1(), J2('completed', 'skipped', etapesJ2({ status: 'completed', conclusion: 'skipped' })), J3_EN_COURS], true, 'job-appel-saute'],
    [[J1(), J2('completed', 'skipped', etapesJ2({ status: 'in_progress', conclusion: null })), J3_EN_COURS], false, 'contradiction-job-saute'],
    [[J1('failure'), J2('completed', 'skipped'), J3_EN_COURS], true, 'garde-non-franchie'],
    [[J1('failure'), J3_EN_COURS], true, 'garde-non-franchie'],
    [[J1(null, 'in_progress'), J3_EN_COURS], false, 'garde-en-cours'],
    [[J1(null, 'completed'), J3_EN_COURS], false, 'garde-en-cours'],
    [[J3_EN_COURS], false, 'job-garde-absent'],
    [[J1(), J1(), J2('completed', 'skipped')], false, 'job-garde-absent'],
    [[J1(), J3_EN_COURS], false, 'job-appel-absent'],
    [[J1(), J2('completed', 'skipped'), J2('completed', 'skipped')], false, 'job-appel-absent'],
    [[J1(), J2('queued', null)], false, 'job-appel-en-cours'],
    [[J1(), J2('in_progress', null, etapesJ2({ status: 'completed', conclusion: 'skipped' }))], false, 'job-appel-en-cours'],
    [[J1(), J2('completed', null, etapesJ2({ status: 'completed', conclusion: 'skipped' }))], false, 'job-appel-en-cours'],
    [[J1(), J2('completed', 'failure', etapesJ2(null))], false, 'etape-appel-absente'],
    [[J1(), J2('completed', 'failure')], false, 'etape-appel-absente'],
    [[J1(), J2('completed', 'failure', [...etapesJ2({ status: 'completed', conclusion: 'skipped' }), { name: NOMS_RUN.etape, status: 'completed', conclusion: 'skipped' }])], false, 'etape-appel-multiple'],
    [[J1(), J2('completed', 'failure', etapesJ2({ status: 'in_progress', conclusion: null }))], false, 'etape-appel-en-cours'],
    [[J1(), J2('completed', 'failure', etapesJ2({ status: 'completed', conclusion: null }))], false, 'etape-appel-en-cours'],
    [[J1(), { ...J2('completed', 'failure'), steps: 'x' }], false, 'etapes-illisibles'],
    [[J1(), J2('completed', 'failure', etapesJ2({ status: 'COMPLETED', conclusion: 'skipped' }))], false, 'etape-appel-en-cours'],
    [null, false, 'jobs-illisibles'], [{}, false, 'jobs-illisibles'], [[null], false, 'jobs-illisibles'], [[{ status: 'completed' }], false, 'jobs-illisibles'],
  ];
  for (const [jobs, stable, raison] of cas) assert.deepEqual(etatStable(jobs), { stable, raison }, JSON.stringify(jobs).slice(0, 160));
  // la stabilité ne vaut jamais conclusion : un appel terminé (réussi ou non) reste ISSUE INCONNUE au constat
  for (const c of ['success', 'failure', 'cancelled']) assert.equal(etatStable(APPEL(c)).stable, true);
});
test('constater (autorité de conclusion, inchangée hors contradiction) : J2 dit sauté mais étape Appel non sautée => ISSUE INCONNUE', () => {
  const e = { chantier: 'recette-at104', jalon: 'blanc-1', numero: '1', commit: ENV_R1.ATELIER_COMMIT, empreinte: ENV_R1.ATELIER_EMPREINTE };
  const x = { run_id: ENV_R1.GITHUB_RUN_ID, run_attempt: '1', workflow_sha: ENV_R1.GITHUB_WORKFLOW_SHA, ref: 'refs/heads/main' };
  const c = (jobs) => { const f = constater({ entrees: e, contexte: x, jobs }).faits; return [f.issue, f.raison]; };
  assert.deepEqual(c(CONTRADICTOIRE), ['issue-inconnue', 'etat-contradictoire']);
  assert.deepEqual(c([J1(), J2('completed', 'skipped', etapesJ2({ status: 'in_progress', conclusion: null }))]), ['issue-inconnue', 'etat-contradictoire']);
  assert.deepEqual(c(SAUTE), ['non-emis', 'job-appel-saute']);
  assert.deepEqual(c([J1(), J2('completed', 'skipped', etapesJ2({ status: 'completed', conclusion: 'skipped' }))]), ['non-emis', 'job-appel-saute']);
  // faits NON ÉMIS inchangés à l'octet près (constat.etape reste null comme en v0.65.21) ; contradiction : étape citée
  const f = (jobs) => constater({ entrees: e, contexte: x, jobs }).faits.constat.etape;
  assert.equal(f([J1(), J2('completed', 'skipped', etapesJ2({ status: 'completed', conclusion: 'skipped' }))]), null);
  assert.equal(f(SAUTE), null);
  assert.deepEqual(f(CONTRADICTOIRE), { status: 'completed', conclusion: 'success' });
  assert.deepEqual(c(R1_FINAL), ['non-emis', 'etape-appel-sautee']);
  assert.deepEqual(c(R1_PERIME), ['issue-inconnue', 'etat-appel-incertain']);
  assert.deepEqual(c(APPEL('success')), ['issue-inconnue', 'appel-execute-voir-faits-j2']);
  assert.deepEqual(c(APPEL('failure')), ['issue-inconnue', 'appel-execute-voir-faits-j2']);
});

// ------------------------------------------------------------------------------------------------ script réel, faux GitHub
test('rejeu R1 : API restée périmée => exactement 10 lectures, 9 pauses de 6 s, puis les MÊMES faits j3 que R1 (empreinte 7b48bf9f…)', () => {
  const r = rejouer([R1_PERIME]);
  assert.equal(r.code, 0, r.erreur);
  assert.equal(r.gh.length, 10);
  assert.deepEqual(r.sleep, Array(9).fill('6'));
  assert.deepEqual(r.timeout, Array(10).fill('15'));
  assert.deepEqual(issue(r), ['issue-inconnue', 'etat-appel-incertain']);
  assert.equal(sha(r.texte), EMPREINTE_ANNOTATION_J3_R1); // aucun fait réécrit : même texte, même empreinte qu'en R1
  assert.equal(r.codeConstat, 1);
  assert.match(r.sortie, /lecture 10\/10 : état non stable\n$/);
});
test('API périmée puis cohérente (R1 corrigé) : 3 lectures, 2 pauses, NON ÉMIS etape-appel-sautee ; arrêt dès la stabilité', () => {
  const r = rejouer([R1_PERIME, R1_PERIME, R1_FINAL, APPEL('success')]);
  assert.equal(r.gh.length, 3);
  assert.deepEqual(r.sleep, ['6', '6']);
  assert.deepEqual(issue(r), ['non-emis', 'etape-appel-sautee']);
  assert.equal(r.faits.appel_emis, false);
  assert.deepEqual(r.faits.constat.etape, { status: 'completed', conclusion: 'skipped' });
  assert.equal(r.codeConstat, 0);
  assert.match(r.sortie, /lecture 3\/10 : état stable\n$/);
  const d = decisionCloture({ faits: r.faits, t: 'recette-at104/blanc-1/1', temoin: false });
  assert.deepEqual(d, { issue: 'non-emis', montant: 0 });
});
test('Appel sauté (job J2 sauté) : 1 lecture, aucune pause, NON ÉMIS job-appel-saute', () => {
  const r = rejouer([SAUTE]);
  assert.deepEqual([r.gh.length, r.sleep.length], [1, 0]);
  assert.deepEqual(issue(r), ['non-emis', 'job-appel-saute']);
});
test('Appel terminé (réussi, en échec, annulé) : 1 lecture, ISSUE INCONNUE appel-execute-voir-faits-j2 (terminé n\'est pas émission connue)', () => {
  for (const c of ['success', 'failure', 'cancelled']) {
    const r = rejouer([APPEL(c)]);
    assert.deepEqual([r.gh.length, r.sleep.length], [1, 0], c);
    assert.deepEqual(issue(r), ['issue-inconnue', 'appel-execute-voir-faits-j2'], c);
    assert.equal(r.faits.appel_emis, null, c);
    assert.equal(r.faits.cout, null, c);
  }
});
test('données contradictoires persistantes : 10 lectures puis ISSUE INCONNUE etat-contradictoire ; résolues : NON ÉMIS', () => {
  const r = rejouer([CONTRADICTOIRE]);
  assert.equal(r.gh.length, 10);
  assert.deepEqual(issue(r), ['issue-inconnue', 'etat-contradictoire']);
  const s = rejouer([CONTRADICTOIRE, R1_FINAL]);
  assert.equal(s.gh.length, 2);
  assert.deepEqual(issue(s), ['non-emis', 'etape-appel-sautee']);
  // étape absente alors que J2 est terminé : jamais stable, jamais NON ÉMIS
  const u = rejouer([[J1(), J2('completed', 'failure', etapesJ2(null))]]);
  assert.equal(u.gh.length, 10);
  assert.deepEqual(issue(u), ['issue-inconnue', 'etat-appel-incertain']);
});
test('erreurs API : erreur puis réponse => relue ; toujours en erreur ou pendue => 10 lectures, jobs.json supprimé, ISSUE INCONNUE jobs-illisibles', () => {
  const r = rejouer(['ERREUR', 'PENDU', R1_FINAL]);
  assert.equal(r.gh.length, 3);
  assert.deepEqual(issue(r), ['non-emis', 'etape-appel-sautee']);
  for (const l of [['ERREUR'], ['PENDU'], ['pas du JSON'], ['{"jobs": []}']]) {
    const s = rejouer(l);
    assert.equal(s.gh.length, 10, l[0]);
    assert.equal(s.code, 0, l[0]); // l'étape réussit toujours : le constat (J3) s'exécute et produit ses faits
    assert.deepEqual(issue(s), ['issue-inconnue', 'jobs-illisibles'], l[0]);
  }
  const e = rejouer(['ERREUR']);
  assert.deepEqual(e.fichiersApresLecture, []); // sortie partielle jamais conservée
  // erreur à la DERNIÈRE lecture après des lectures instables : aucune lecture ancienne n'est réutilisée
  const f = rejouer([R1_PERIME, R1_PERIME, R1_PERIME, R1_PERIME, R1_PERIME, R1_PERIME, R1_PERIME, R1_PERIME, R1_PERIME, 'ERREUR']);
  assert.deepEqual(issue(f), ['issue-inconnue', 'jobs-illisibles']);
});
test('J1 refusée : 1 lecture, constat SANS OBJET (garde-non-franchie) ; garde encore en cours : relue', () => {
  const r = rejouer([[J1('failure'), J2('completed', 'skipped'), J3_EN_COURS]]);
  assert.deepEqual([r.gh.length, r.sleep.length], [1, 0]);
  assert.deepEqual(issue(r), [null, 'garde-non-franchie']);
  const s = rejouer([[J1(null, 'in_progress')], SAUTE]);
  assert.equal(s.gh.length, 2);
  assert.deepEqual(issue(s), ['non-emis', 'job-appel-saute']);
});
test('bornes temporelles : 10 lectures au plus, 15 s par lecture, 6 s entre deux, pire cas sous le délai du job J3 (5 min)', () => {
  const s = scriptLecture();
  assert.match(s, /^for i in 1 2 3 4 5 6 7 8 9 10; do$/m);
  assert.equal((s.match(/\bfor\b|\bwhile\b|\buntil\b/g) || []).length, 1);
  assert.match(s, /^ {2}timeout 15 gh api /m);
  assert.match(s, /^ {2}if \[ "\$i" -lt 10 \]; then sleep 6; fi$/m);
  const constat = WORKFLOW.split(/\n {2}(?=[a-z]+:\n {4}name:)/).find((j) => j.startsWith('constat:'));
  assert.match(constat, /\n {4}timeout-minutes: 5\n/);
  const pire = 10 * 15 + 9 * 6;
  assert.ok(pire <= 210 && pire < 5 * 60 - 60, String(pire)); // marge d'une minute pour checkout, setup-node et constat
});
test('absence de double émission : J3 ne fait que des GET de la liste des jobs ; --stable n\'écrit rien ; aucun appel ni secret dans J3', () => {
  const r = rejouer([R1_PERIME, R1_PERIME, R1_FINAL]);
  assert.deepEqual(r.gh, Array(3).fill(URL_JOBS));
  assert.deepEqual(r.fichiersApresLecture, ['jobs.json']); // la lecture ne produit aucun fait ; le constat les écrit une seule fois
  const s = scriptLecture();
  assert.equal((s.match(/\bgh\b/g) || []).length, 1);
  const ligneGh = s.split('\n').find((l) => /\bgh api\b/.test(l)).replace(/ \|\| rm -f "\$D\/jobs\.json"$/, '');
  assert.equal(ligneGh, '  timeout 15 gh api "repos/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID/attempts/$GITHUB_RUN_ATTEMPT/jobs?per_page=100" --jq \'.jobs\' > "$D/jobs.json"');
  for (const m of [/-X\b/, /--method/, /\s-f\s/, /\s-F\s/, /--field/, /--raw-field/, /--input/, /POST|PUT|PATCH|DELETE/]) assert.equal(m.test(ligneGh), false, String(m));
  for (const m of [/POST|PUT|PATCH|DELETE/, /auto-appel/, /ATELIER_TEMOIN_CLE/, /secrets/, /curl|wget/]) assert.equal(m.test(s), false, String(m));
  const constat = WORKFLOW.split(/\n {2}(?=[a-z]+:\n {4}name:)/).find((j) => j.startsWith('constat:'));
  for (const m of [/environment:/, /secrets\./, /auto-appel/, /contents: write/, /ATELIER_TEMOIN_CLE/]) assert.equal(m.test(constat), false, String(m));
  assert.equal((constat.match(/node outils-atelier\/auto-constat\.mjs --dossier "\$RUNNER_TEMP\/atelier-auto"\n/g) || []).length, 1); // une seule production des faits
  // --stable : sortie 0 / 3, aucun fichier écrit
  const t = mkdtempSync(join(tmpdir(), 'atelier-j3-stable-'));
  try {
    for (const [jobs, code] of [[R1_FINAL, 0], [R1_PERIME, 3], [null, 3]]) {
      if (jobs === null) rmSync(join(t, 'jobs.json'), { force: true }); else writeFileSync(join(t, 'jobs.json'), JSON.stringify(jobs));
      const avant = readdirSync(t).sort();
      const k = spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-constat.mjs'), '--dossier', t, '--stable'], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
      assert.equal(k.status, code, k.stdout + k.stderr);
      assert.deepEqual(readdirSync(t).sort(), avant);
      assert.match(k.stdout, code === 0 ? /^STABLE etape-appel-terminee\n$/ : /^NON STABLE /);
    }
  } finally { rmSync(t, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------------------------------------ workflow : reste inchangé
// Empreintes des blocs de atelier-auto.yml à main d1d2d2e9 (v0.65.21), commentaires d'en-tête exclus, corps de l'étape de lecture J3
// neutralisé : tout le reste (déclencheur, permissions, environnement, secret, V2, conditions de l'étape Appel, J4) est identique.
const BLOCS_V0_65_21 = Object.freeze({
  tete: 'afdaa49cb57ee385c764f887a7036e256dace70853a848c5e4483fff2b8a5a21',
  garde: '9514472e4a5b635332b7520215e3217911a84d6dc517f4fe85d1c4e6600f27b1',
  frontiere: '9d346cb8df257f13b622ce53c4837e0a7e87a2452b0fd6b07dd77a3a472bf5b9',
  candidat: 'a9c2c849681a42ac96e22e37742121acafb560bd1f716bbb7b0ca2656f14d7a7',
  constat: '3252106871b53b0a13df9ae62d78e5d7f53454941ca2f9f13235cb436e5fc831',
});
function blocs(y) {
  const p = y.split(/\n {2}(?=[a-z]+:\n {4}name:)/);
  const neutre = (j) => j.replace(/(- name: Lire les jobs de ce run \(essai courant\)\n {8}env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}\n {8}run: \|\n)(?: {10}.*\n)+/, '$1          <LECTURE>\n');
  return { tete: sha(p[0].replace(/^#.*\n/gm, '')), ...Object.fromEntries(p.slice(1).map((j) => [/^[a-z]+/.exec(j)[0], sha(neutre(j))])) };
}
test('workflow : seul le corps de l\'étape de lecture J3 change ; permissions, secret, V2, étape Appel, J4, déclencheur inchangés ; aucun workflow_run', () => {
  assert.deepEqual(blocs(WORKFLOW), { ...BLOCS_V0_65_21 });
  assert.match(WORKFLOW, /\non:\n {2}workflow_dispatch:\n/);
  assert.equal(/workflow_run:|pull_request|schedule:|repository_dispatch|\n {2}push:/.test(WORKFLOW.replace(/^\s*#.*$/gm, '')), false); // .workflow_runs[] (lecture J1) n'est pas un déclencheur
  assert.equal((WORKFLOW.match(/secrets\./g) || []).length, 1);
  assert.equal((WORKFLOW.match(/environment: atelier-auto/g) || []).length, 1);
  assert.match(WORKFLOW, /- name: Appel \(une seule requête\)\n {8}env:\n {10}ATELIER_TEMOIN_CLE: \$\{\{ secrets\.ATELIER_TEMOIN_CLE \}\}\n {8}run: node outils-atelier\/auto-appel\.mjs --dossier "\$RUNNER_TEMP\/atelier-auto" --reel\n/);
  // mutation : toucher une permission, le secret ou l'étape Appel change une empreinte
  for (const [a, b] of [['actions: read\n    env:\n      ATELIER_CHANTIER: ${{ inputs.chantier }}\n      ATELIER_JALON: ${{ inputs.jalon }}\n      ATELIER_NUMERO: ${{ inputs.numero }}\n      ATELIER_COMMIT: ${{ inputs.commit }}\n      ATELIER_EMPREINTE: ${{ inputs.empreinte }}\n    steps:\n      - name: Récupérer main (outil du constat)', 'actions: write\n    env:\n      ATELIER_CHANTIER: ${{ inputs.chantier }}\n      ATELIER_JALON: ${{ inputs.jalon }}\n      ATELIER_NUMERO: ${{ inputs.numero }}\n      ATELIER_COMMIT: ${{ inputs.commit }}\n      ATELIER_EMPREINTE: ${{ inputs.empreinte }}\n    steps:\n      - name: Récupérer main (outil du constat)'],
    ['--reel\n', '--reel --encore\n'], ['environment: atelier-auto', 'environment: autre'], ['workflow_dispatch:', 'workflow_run:']]) {
    assert.ok(WORKFLOW.includes(a), a.slice(0, 40));
    assert.notDeepEqual(blocs(WORKFLOW.replace(a, b)), { ...BLOCS_V0_65_21 }, b.slice(0, 40));
  }
});
test('mutations du script de lecture : chaque affaiblissement est détecté par le rejeu', () => {
  const s = scriptLecture();
  const mutants = [
    ['lecture unique (comportement de R1)', s.replace('for i in 1 2 3 4 5 6 7 8 9 10; do', 'for i in 1; do'), (r) => issue(r)[0] === 'non-emis'],
    ['11 lectures', s.replace('for i in 1 2 3 4 5 6 7 8 9 10; do', 'for i in 1 2 3 4 5 6 7 8 9 10 11; do'), (r) => r.gh.length === 10],
    ['sans arrêt à la stabilité', s.replace('; break; fi', '; fi'), (r) => r.gh.length === 3],
    ['erreur conservée', s.replace(' || rm -f "$D/jobs.json"', ' || true'), (r) => r.fichiersApresLecture.length === 0],
  ];
  const attendus = { 'lecture unique (comportement de R1)': [R1_PERIME, R1_FINAL], '11 lectures': [R1_PERIME], 'sans arrêt à la stabilité': [R1_PERIME, R1_PERIME, R1_FINAL], 'erreur conservée': ['ERREUR'] };
  for (const [nom, m, sain] of mutants) {
    assert.notEqual(m, s, nom);
    assert.equal(sain(rejouer(attendus[nom])), true, `original ${nom}`);
    assert.equal(sain(rejouer(attendus[nom], { script: m })), false, `mutant ${nom}`);
  }
});

// ------------------------------------------------------------------------------------------------ UX 8 : clôture d'une tentative à blanc
const CH = 'temoin-atelier';
const J = 'temoin-1';
const T1 = `${CH}/${J}/1`;
const COMMIT = 'e'.repeat(40);
async function conduireBlanc() {
  const a = monterEcran({ version: '0.65.5' });
  await a.cliquer('mode-auto');
  await a.cliquer('temoin');
  a.saisir('sha', BASE);
  await a.cliquer('ouvrir');
  await a.cliquer('ouvrir-cycle');
  await a.cliquer('plafonner');
  await a.cliquer('approuver');
  await a.cliquer('generer');
  await a.cliquer('auto-temoin');
  await a.cliquer('lancer-auto');
  await confirmerSauvegarde(a, COMMIT);
  return a;
}
const faitsJ3 = (a, jobs) => {
  const texte = canonique(etatDurableDe(a.copie()));
  return constater({ entrees: { chantier: CH, jalon: J, numero: '1', commit: COMMIT, empreinte: hacherSha256(texte) }, contexte: { run_id: '5000', run_attempt: '1', workflow_sha: 'f'.repeat(40), ref: 'refs/heads/main' }, jobs }).texte;
};
test('UX 8 : à blanc, le libellé de clôture suit les faits ; ISSUE INCONNUE => avertissement, bouton inactif, rien écrit, jamais NON ÉMIS', async () => {
  const a = await conduireBlanc();
  const libelle = () => a.un('clore-auto').textContent;
  // sans faits : aucun « coût réel 0 » promis
  assert.equal(libelle(), 'Clore la tentative 1 AUTO selon les faits');
  assert.equal(a.un('clore-auto').disabled, false);
  assert.doesNotMatch(libelle(), /coût réel 0/);
  // ISSUE INCONNUE (faits de R1 : J2 encore « waiting ») : refus visible, bouton inactif, même forcé rien n'est écrit
  const inconnu = faitsJ3(a, R1_PERIME);
  assert.equal(lireFaitsAuto(inconnu).faits.issue, 'issue-inconnue');
  a.saisir('faits-auto', inconnu);
  a.saisir('motif-auto', 'essai');
  await a.cliquer('mode-auto'); // nouveau rendu
  assert.equal(libelle(), 'Clore la tentative 1 AUTO (refusé : issue inconnue)');
  assert.equal(a.un('clore-auto').disabled, true);
  const n = a.stockage.ecritures;
  assert.match(a.un('auto-issue-blanc').textContent, /^⚠ ISSUE INCONNUE — ces faits ne prouvent pas l'absence d'émission \(etat-appel-incertain\)\. Aucune clôture à coût réel 0 : l'engagement de .+ reste OUVERT\./);
  for (const f of a.un('clore-auto').listeners.click) await f();
  assert.equal(a.stockage.ecritures, n);
  assert.equal(a.trouver('clore-temoin').length, 0);
  // comportement réel de decisionCloture (vérifié avant modification) : issue-inconnue => montant null, jamais 0 ; cloreAuto la refusait déjà
  assert.deepEqual(decisionCloture({ faits: lireFaitsAuto(inconnu).faits, t: T1, temoin: false }), { issue: 'issue-inconnue', montant: null });
  // NON ÉMIS prouvé par les faits : libellé explicite, clôture à 0 possible
  const nonEmis = faitsJ3(a, R1_FINAL);
  a.saisir('faits-auto', nonEmis);
  await a.cliquer('mode-auto');
  assert.equal(libelle(), 'Clore la tentative 1 AUTO : NON ÉMIS (coût réel 0)');
  assert.equal(a.trouver('auto-issue-blanc').length, 0);
  const m = a.stockage.ecritures;
  await a.cliquer('clore-auto');
  assert.equal(a.stockage.ecritures, m + 1);
  assert.deepEqual(a.copie().registre.at(-1).donnees, { execution: T1, montant: 0 });
});
test('UX 8 : faits illisibles ou d\'une autre tentative => libellé neutre, clôture refusée au clic, rien écrit', async () => {
  const a = await conduireBlanc();
  for (const faits of ['{', faitsJ3(a, R1_FINAL).replace('"blanc-1/1"', '"blanc-1/2"').replace(`${CH}/${J}/1`, `${CH}/${J}/2`)]) {
    a.saisir('faits-auto', faits);
    a.saisir('motif-auto', 'essai');
    await a.cliquer('mode-auto');
    assert.equal(a.un('clore-auto').textContent, 'Clore la tentative 1 AUTO selon les faits');
    const n = a.stockage.ecritures;
    await a.cliquer('clore-auto');
    assert.equal(a.stockage.ecritures, n);
    assert.match(a.un('message').textContent, /Clôture AUTO impossible/);
  }
});
