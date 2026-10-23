// v0.65.23 — R1 « RÉGULARISATION SUR PREUVE FINALE » (GO « R1 — CONCEPTION B ACCEPTÉE », 23/10/2026). OUTILLAGE NON COGNITIF.
// outils-atelier/auto-retour.mjs --mode preuve et --mode autorisation sur une FAUSSE API GitHub (aucun réseau) et un dépôt git local où
// la D3 réelle de R1 (8e5e3ece) est recréée à l'identique. Jobs finaux, annotations J1 / J2 frontière / J3 et approbation V2 de R1 ;
// seul le commit du workflow est celui du dépôt d'essai (J3 rescellé en conséquence). Lecture seule (GET exacts), refus = STOP sans bloc,
// commentaire N2 fictif lu et contrôlé (compte, propriétaire, ticket, modification, dates, texte), options exclusives par mode.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { preuve, autorisation, principal, resumePreuve, resumeAutorisation, WORKFLOW_AUTO } from '../outils-atelier/auto-retour.mjs';
import { annotationsFaits, lirePreuve, lireAutorisation, controlerPreuve, controlerAutorisation, decisionRegularisation, texteAutorisation } from '../app/atelier/retour.js';
import { Stop } from '../outils-atelier/journal-atelier.mjs';
import { CH, T, CHANTIER, J1, J2F, J3, D3, COMMIT, COMMIT_OBJET, RUN, RUN_ID, V2, JOBS, APPROBATIONS, ISSUE, COMMENTAIRE_ID, GITHUB, commentaire, resceller } from './atelier-regularisation-aide.mjs';

const TMP = mkdtempSync(join(tmpdir(), 'atelier-regul-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
const ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@a', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@a' };
const git = (cwd, args, { input, env = ENV } = {}) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env, input });
  assert.equal(r.status, 0, `git ${args.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
// Distant : main (le commit M du workflow), journal-atelier/recette-at104 = D3 réelle recréée (même SHA 8e5e3ece).
git(TMP, ['init', '-q', '--bare', 'origine.git']);
git(TMP, ['init', '-q', '-b', 'main', 'auteur']);
const AUT = join(TMP, 'auteur');
const vide = git(AUT, ['mktree'], { input: '' });
const M = git(AUT, ['commit-tree', vide, '-m', 'main']);
git(AUT, ['update-ref', 'refs/heads/main', M]);
const blob = git(AUT, ['hash-object', '-w', '--stdin'], { input: CHANTIER });
const arbre = git(AUT, ['mktree'], { input: `100644 blob ${blob}\tchantier.json\n` });
const o = COMMIT_OBJET;
const C = git(AUT, ['commit-tree', arbre, '-m', o.message], { env: { ...ENV, GIT_AUTHOR_NAME: o.nom, GIT_AUTHOR_EMAIL: o.courriel, GIT_AUTHOR_DATE: o.date, GIT_COMMITTER_NAME: o.nom, GIT_COMMITTER_EMAIL: o.courriel, GIT_COMMITTER_DATE: o.date } });
git(AUT, ['push', '-q', join(TMP, 'origine.git'), 'main', `${C}:refs/heads/journal-atelier/${CH}`]);
const DEPOT = join(TMP, 'clone');
git(TMP, ['clone', '-q', join(TMP, 'origine.git'), DEPOT]);

const J3M = resceller(J3, (f) => { f.provenance.workflow_sha = M; }); // J3 réel, commit du workflow = M du dépôt d'essai
const notice = (lignes) => lignes.map((l) => { const m = /^::notice title=([^:]*)::(.*)$/.exec(l); return { path: '.github', start_line: 1, end_line: 1, annotation_level: 'notice', title: m[1], message: m[2] }; });
const ID_JOB = Object.fromEntries(JOBS.map((j) => [j.name, j.id]));
function fausseApi({ change = {}, apres = {}, textes = { j1: J1, j2f: J2F, j3: J3M }, commentaires = { [COMMENTAIRE_ID]: commentaire() } } = {}) {
  const base = {
    [`repos/${GITHUB}/actions/runs/${RUN_ID}`]: { ...RUN, head_sha: M, path: WORKFLOW_AUTO, repository: { full_name: GITHUB }, event: 'workflow_dispatch', head_branch: 'main', display_title: `atelier-auto ${T}` },
    [`repos/${GITHUB}/actions/runs/${RUN_ID}/attempts/1/jobs?per_page=100`]: { total_count: JOBS.length, jobs: JOBS.map((j) => ({ ...structuredClone(j), run_id: RUN.id, run_attempt: 1, status: 'completed' })) },
    [`repos/${GITHUB}/check-runs/${ID_JOB['J1 garde']}/annotations?per_page=100`]: notice(annotationsFaits('j1', textes.j1)),
    [`repos/${GITHUB}/check-runs/${ID_JOB['J2 frontière et appel']}/annotations?per_page=100`]: notice(annotationsFaits('j2f', textes.j2f)),
    [`repos/${GITHUB}/check-runs/${ID_JOB['J3 constat']}/annotations?per_page=100`]: notice(annotationsFaits('j3', textes.j3)),
    [`repos/${GITHUB}/actions/runs/${RUN_ID}/approvals`]: structuredClone(APPROBATIONS),
    ...Object.fromEntries(Object.entries(commentaires).map(([id, c]) => [`repos/${GITHUB}/issues/comments/${id}`, c])),
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
const LU = '2026-10-23T09:00:00.000Z';
const runP = `repos/${GITHUB}/actions/runs/${RUN_ID}`;
const jobsP = `${runP}/attempts/1/jobs?per_page=100`;
const appro = `${runP}/approvals`;
const comP = `repos/${GITHUB}/issues/comments/${COMMENTAIRE_ID}`;
const lancerP = (p = {}, a = fausseApi()) => preuve({ depot: DEPOT, github: GITHUB, tentative: T, runAuto: RUN_ID, commit: COMMIT, empreinte: D3.empreinte, api: a.api, env: ENV, maintenant: LU, ...p });
const refuseP = (p, a, motif) => assert.throws(() => lancerP(p, a), (e) => e instanceof Stop && motif.test(e.message), String(motif));
const jobsAvec = (f) => (r) => { const j = r.jobs.find((x) => x.name === 'J2 frontière et appel'); f(j, r); return r; };
const etapeAppel = (j) => j.steps.find((s) => s.name === 'Appel (une seule requête)');

test('C1 commit D3 réel recréé à l\'identique (8e5e3ece, chantier.json aaeaa362)', () => {
  assert.equal(C, COMMIT);
  assert.equal(blob, 'a8e3241a7e93a371128b0db98e3cfba077c20c29');
});

test('C2 --mode preuve nominal : bloc relu = contrôle du téléphone ; GET exacts ; run relu à la fin ; modèle d\'autorisation exact', () => {
  const a = fausseApi();
  const r = lancerP({}, a);
  assert.equal(r.genre, 'preuve');
  const l = lirePreuve(r.bloc);
  assert.equal(l.raison, undefined);
  assert.equal(l.preuve.empreinte, r.empreinte);
  assert.equal(l.preuve.j3, J3M);
  assert.equal(l.preuve.lu_le, LU);
  assert.deepEqual(l.preuve.jobs.appel, { status: 'completed', conclusion: 'failure', etapes: [{ status: 'completed', conclusion: 'skipped' }] });
  assert.equal(controlerPreuve(l.preuve, { t: T, d3: D3 }).constat.conclusion, 'appel-non-execute');
  assert.deepEqual({ ...r.v2 }, V2);
  assert.equal(r.modele, texteAutorisation({ tentative: T, run: RUN_ID, preuve: r.empreinte }));
  assert.deepEqual(a.lus, [runP, jobsP, ...JOBS.filter((j) => j.conclusion !== 'skipped').map((j) => `repos/${GITHUB}/check-runs/${j.id}/annotations?per_page=100`), appro, runP]);
  assert.match(resumePreuve(r), /J1 completed\/success, J2 completed\/failure, étape Appel completed\/skipped, J4 completed\/skipped, J3 completed\/failure : appel-non-execute/);
  assert.equal(lancerP({}, fausseApi()).bloc, r.bloc, 'déterministe à heure de lecture égale');
});

test('C3 --mode preuve : refus (run, jobs, étape d\'appel, V2, D3, J3, relance pendant la lecture) — STOP sans bloc', () => {
  refuseP({}, fausseApi({ change: { [runP]: (r) => ({ ...r, run_attempt: 2 }) } }), /seul le premier essai fait foi/);
  refuseP({}, fausseApi({ change: { [runP]: (r) => ({ ...r, display_title: 'atelier-auto x/y/1' }) } }), /autre tentative/);
  refuseP({}, fausseApi({ change: { [runP]: (r) => ({ ...r, status: 'in_progress' }) } }), /non terminé/);
  refuseP({}, fausseApi({ change: { [runP]: (r) => ({ ...r, head_sha: 'f'.repeat(40) }) } }), /histoire de main/);
  refuseP({}, fausseApi({ change: { [jobsP]: jobsAvec((j) => { etapeAppel(j).conclusion = 'failure'; }) } }), /faits j2 absents/); // étape d'appel conclue : ses faits J2 font autorité
  refuseP({}, fausseApi({ change: { [jobsP]: jobsAvec((j) => { etapeAppel(j).conclusion = 'cancelled'; }) } }), /preuve refusée : appel-execute/);
  refuseP({}, fausseApi({ change: { [jobsP]: jobsAvec((j) => { j.steps = j.steps.filter((s) => s.name !== 'Appel (une seule requête)'); }) } }), /preuve refusée : etat-appel-incertain/);
  refuseP({}, fausseApi({ change: { [jobsP]: (r) => { r.jobs.find((x) => x.name === 'J4 candidat').conclusion = 'success'; return r; } } }), /check-runs\/119902661484\/annotations.*404/); // J4 non sauté : ses annotations sont exigées
  refuseP({}, fausseApi({ change: { [appro]: () => [] } }), /preuve refusée : v2-absente/);
  refuseP({}, fausseApi({ change: { [appro]: (l) => [{ ...l[0], state: 'rejected' }] } }), /preuve refusée : preuve-contradictoire/);
  refuseP({}, fausseApi({ change: { [appro]: () => ({}) } }), /approbations illisibles/);
  refuseP({ commit: 'e'.repeat(40) }, fausseApi(), /STOP/);
  refuseP({ empreinte: 'e'.repeat(64) }, fausseApi(), /STOP/);
  refuseP({}, fausseApi({ textes: { j1: J1, j2f: J2F, j3: resceller(J3M, (f) => { f.raison = 'appel-execute-voir-faits-j2'; }) } }), /preuve refusée : appel-execute/);
  refuseP({}, fausseApi({ textes: { j1: J1, j2f: J2F, j3: resceller(J3M, (f) => { f.issue = 'non-emis'; f.raison = 'etape-appel-sautee'; f.appel_emis = false; }) } }), /preuve refusée : regularisation-inutile/);
  refuseP({}, fausseApi({ apres: { [runP]: (r) => ({ ...r, updated_at: '2026-10-23T08:00:00Z' }) } }), /a changé pendant la lecture/);
  refuseP({ maintenant: 'hier' }, fausseApi(), /--maintenant illisible/);
  refuseP({ tentative: 'x' }, fausseApi(), /--tentative/);
});

test('C4 --mode autorisation nominal : commentaire relu (GET exacts), bloc contrôlé par le téléphone, décision complète possible', () => {
  const P = lirePreuve(lancerP().bloc).preuve;
  const c = commentaire({ preuve: P });
  const a = fausseApi({ commentaires: { [COMMENTAIRE_ID]: c } });
  const r = autorisation({ github: GITHUB, tentative: T, runAuto: RUN_ID, preuveEmpreinte: P.empreinte, issue: String(ISSUE), commentaire: COMMENTAIRE_ID, api: a.api, maintenant: '2026-10-23T09:12:00.000Z' });
  assert.equal(r.genre, 'autorisation');
  assert.deepEqual(a.lus, [runP, appro, comP]);
  const l = lireAutorisation(r.bloc);
  assert.equal(l.raison, undefined);
  assert.equal(controlerAutorisation(l.autorisation, { t: T, preuve: P, v2: V2 }).raison, undefined);
  const d = decisionRegularisation({ preuve: P, autorisation: l.autorisation, t: T, d3: D3, vivante: true, engagement: 'engagee', carnet: false, deja: {}, decideur: V2.login, montant: '0', motif: 'm' });
  assert.equal(d.raison, undefined);
  assert.equal(d.regularisation.identite.autorisation.texte, c.body);
  assert.match(resumeAutorisation(r), new RegExp(`ticket ${ISSUE}, commentaire ${COMMENTAIRE_ID} de ${V2.login} \\(${V2.user_id}, OWNER\\)`));
});

test('C5 --mode autorisation : refus (autre ticket, autre compte, non propriétaire, modifié, antérieur, texte, V2 absente ou multiple)', () => {
  const P = lirePreuve(lancerP().bloc).preuve;
  const lancerA = (c, a = fausseApi({ commentaires: { [COMMENTAIRE_ID]: c } }), p = {}) => autorisation({ github: GITHUB, tentative: T, runAuto: RUN_ID, preuveEmpreinte: P.empreinte, issue: String(ISSUE), commentaire: COMMENTAIRE_ID, api: a.api, maintenant: '2026-10-23T09:12:00.000Z', ...p });
  const refuse = (c, motif, a, p) => assert.throws(() => lancerA(c, a, p), (e) => e instanceof Stop && motif.test(e.message), String(motif));
  refuse(commentaire({ preuve: P, issue: 10 }), /pas dans le ticket 9/);
  refuse(commentaire({ preuve: P, id: 1 }), /autorisation refusée : autorisation-autre-compte/);
  refuse(commentaire({ preuve: P, login: 'autre' }), /autorisation refusée : autorisation-autre-compte/);
  refuse(commentaire({ preuve: P, association: 'COLLABORATOR' }), /autorisation refusée : autorisation-non-proprietaire/);
  refuse(commentaire({ preuve: P, modifieLe: '2026-10-23T09:11:00Z' }), /autorisation refusée : autorisation-modifiee/);
  refuse(commentaire({ preuve: P, creeLe: '2026-10-22T15:00:00Z' }), /autorisation refusée : autorisation-anterieure/);
  refuse(commentaire({ preuve: P, texte: 'OK' }), /autorisation refusée : autorisation-texte/);
  refuse(commentaire({ preuve: P, numero: '4000000002' }), /commentaire 4000000001 illisible/);
  refuse(commentaire({ preuve: P }), /aucune approbation V2/, fausseApi({ change: { [appro]: () => [] } }));
  refuse(commentaire({ preuve: P }), /plusieurs comptes/, fausseApi({ change: { [appro]: (l) => [l[0], { ...l[0], user: { login: 'autre', id: 1 } }] } }));
  refuse(commentaire({ preuve: P }), /--preuve-empreinte/, undefined, { preuveEmpreinte: 'abc' });
  refuse(commentaire({ preuve: P }), /--issue et --commentaire/, undefined, { issue: 'neuf' });
  refuse(commentaire({ preuve: P, creeLe: '2026-10-23T09:13:00Z' }), /autorisation refusée : autorisation-illisible/);
  // Autre preuve que celle du commentaire : texte différent.
  refuse(commentaire({ preuve: P }), /autorisation refusée : autorisation-texte/, undefined, { preuveEmpreinte: 'd'.repeat(64) });
});

test('C6 principal : modes et options exclusives (aucune écriture, aucun mode inconnu)', () => {
  const a = fausseApi();
  const base = ['--github', GITHUB, '--tentative', T, '--run-auto', RUN_ID];
  const refuse = (argv, motif) => assert.throws(() => principal(argv, ENV, a.api), (e) => e instanceof Stop && motif.test(e.message), String(motif));
  refuse([...base, '--mode', 'ecrire'], /--mode inconnu/);
  refuse([...base, '--mode', 'preuve', '--depot', DEPOT, '--commit', COMMIT, '--empreinte', D3.empreinte, '--run-at5', '1'], /--run-at5 hors du mode preuve/);
  refuse([...base, '--mode', 'retour', '--depot', DEPOT, '--commit', COMMIT, '--empreinte', D3.empreinte, '--issue', '9'], /--issue hors du mode retour/);
  refuse([...base, '--mode', 'autorisation', '--depot', DEPOT, '--preuve-empreinte', 'a'.repeat(64), '--issue', '9', '--commentaire', COMMENTAIRE_ID], /--depot hors du mode autorisation/);
  refuse([...base, '--mode', 'preuve', '--depot', DEPOT, '--commit', COMMIT, '--empreinte', D3.empreinte, '--commentaire', '1'], /--commentaire hors du mode preuve/);
  const r = principal([...base, '--mode', 'preuve', '--depot', DEPOT, '--commit', COMMIT, '--empreinte', D3.empreinte, '--maintenant', LU], ENV, a.api);
  assert.equal(r.bloc, lancerP().bloc);
});

test('C7 arguments et données illisibles : STOP précis (dépôt, run, D3, approbation, J3 absent, commentaire, titre) ; heure de lecture transmise', () => {
  refuseP({ github: 'x' }, fausseApi(), /--github PROPRIETAIRE\/DEPOT attendu/);
  refuseP({ runAuto: 'abc' }, fausseApi(), /--run-auto attendu/);
  refuseP({ commit: 'abc' }, fausseApi(), /--commit \(40 hex\) et --empreinte \(64 hex\)/);
  refuseP({ empreinte: 'abc' }, fausseApi(), /--commit \(40 hex\) et --empreinte \(64 hex\)/);
  refuseP({}, fausseApi({ change: { [appro]: (l) => [{ ...l[0], user: { login: V2.login, id: '1' } }] } }), /approbation illisible/);
  refuseP({}, fausseApi({ change: { [jobsP]: (r) => { const j = r.jobs.find((x) => x.name === 'J3 constat'); j.conclusion = 'skipped'; for (const s of j.steps) s.conclusion = 'skipped'; return r; } } }), /faits J3 absents : aucune preuve/);
  const r = lancerP({ maintenant: '2026-10-23T09:30:00Z' });
  assert.equal(lirePreuve(r.bloc).preuve.lu_le, '2026-10-23T09:30:00Z', 'heure de lecture = --maintenant');
  const P = lirePreuve(lancerP().bloc).preuve;
  const lancerA = (c, a = fausseApi({ commentaires: { [COMMENTAIRE_ID]: c } }), p = {}) => autorisation({ github: GITHUB, tentative: T, runAuto: RUN_ID, preuveEmpreinte: P.empreinte, issue: String(ISSUE), commentaire: COMMENTAIRE_ID, api: a.api, maintenant: '2026-10-23T09:12:00.000Z', ...p });
  const refuseA = (c, motif, a, p) => assert.throws(() => lancerA(c, a, p), (e) => e instanceof Stop && motif.test(e.message), String(motif));
  refuseA(commentaire({ preuve: P }), /--github PROPRIETAIRE\/DEPOT attendu/, undefined, { github: 'x' });
  refuseA(commentaire({ preuve: P }), /--tentative chantier\/jalon\/numero attendu/, undefined, { tentative: 'x' });
  refuseA(commentaire({ preuve: P }), /--run-auto attendu/, undefined, { runAuto: '' });
  refuseA(commentaire({ preuve: P }), /--maintenant illisible/, undefined, { maintenant: 'hier' });
  refuseA(commentaire({ preuve: P }), /autre tentative/, fausseApi({ change: { [runP]: (r) => ({ ...r, display_title: 'atelier-auto x/y/1' }) } }));
  for (const f of [(c) => { c.user = null; }, (c) => { c.user.id = '308310970'; }, (c) => { c.body = null; }, (c) => { c.html_url = null; }, (c) => { c.author_association = null; }, (c) => { c.user.login = 1; }]) {
    const c = commentaire({ preuve: P });
    f(c);
    refuseA(c, /commentaire 4000000001 illisible/);
  }
  refuseA({ ...commentaire({ preuve: P }), created_at: 'hier' }, /date du commentaire illisible/);
  // Une approbation d'un AUTRE environnement (autre compte) n'est pas la V2 : ignorée par le mode autorisation, comme par le téléphone.
  const autreEnv = fausseApi({ commentaires: { [COMMENTAIRE_ID]: commentaire({ preuve: P }) }, change: { [appro]: (l) => [l[0], { ...l[0], user: { login: 'autre', id: 1 }, environments: [{ name: 'livraison' }] }] } });
  assert.equal(lancerA(null, autreEnv).genre, 'autorisation');
});
