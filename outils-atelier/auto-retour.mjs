// === DEBUT_ATELIER_AUTO_RETOUR ===
// v0.65.21 — AT-10.4 « RETOUR DES FAITS SANS RECOPIE » (GO « AT-10.4 — GO RÉALISATION LOCALE », 21/10/2026 ; D-007 ; DI = F2, DJ, DK = NON,
// DL, DO). OUTILLAGE NON COGNITIF — outil MANUEL HORS APK, lancé par Claude dans un clone du dépôt. Chemin privilégié (P1) par son nom :
// il ne change que par dépôt manuel de Christophe ; il importe app/atelier/retour.js et outils-atelier/journal-atelier.mjs (fermeture P1).
//   node outils-atelier/auto-retour.mjs --depot D --github PROPRIETAIRE/DEPOT --tentative T --run-auto N [--run-at5 M]
//                                       --commit C --empreinte E [--distant origin]
//   -> UN bloc ATELIER-RETOUR-1 sur la sortie (à coller au téléphone, section 11), résumé de contrôle sur la sortie d'erreur ;
//      au moindre écart : « STOP : <raison> », code 1, AUCUN bloc (repli : copie manuelle F1, mêmes lecteurs).
// LECTURE SEULE : API REST GitHub par « gh api » (GET seulement : run, jobs du premier essai, annotations de chaque job) et git
// (ls-remote, fetch vers des refs locales privées, lectures d'objets). Aucune écriture GitHub, aucun lancement, aucune relance, aucun
// secret, aucun appel Anthropic, aucune dépense. Les annotations TRANSPORTENT les faits ; ce qui les rattache au réel :
//   run AUTO : atelier-auto.yml, lancé à la main (workflow_dispatch) sur main, terminé, PREMIER essai seulement (relu à la fin), titre
//              « atelier-auto T », dans ce dépôt, sur un commit de main ; jobs connus, uniques, de ce run et de ce premier essai ;
//   faits    : chaque job ne porte que ses genres ; un genre est EXIGÉ si l'étape qui l'écrit s'est conclue (succès ou échec),
//              INTERDIT si elle a été sautée, annulée ou n'existe pas ; jamais complété ;
//   D3       : C sur journal-atelier/<chantier> (histoire entière relue par journal-atelier.mjs), sha256(chantier.json à C) = E, pièce de T
//              présente ; puis controlerRetour (retour.js) : mêmes lecteurs que la copie manuelle, même T, même run, même D3, chaîne J1 ->
//              J2 -> J4 -> AT-5 sans saut, lireRetourAuto rejoué sur la pièce de T ;
//   candidat : atelier/T existe sur le distant et vaut le SHA des faits J4 ;
//   run AT-5 : atelier-verification.yml, workflow_dispatch, main, terminé, premier essai, créé après le run AUTO, sur un commit de main ;
//              seul le job « assemblage » porte des faits ; provenance et demande contrôlées par controlerRetour.
// Le bloc rendu est relu (lireRetour puis controlerRetour) avant d'être écrit. Commandes par listes d'arguments, sans shell.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireEtatDurable } from '../app/atelier/journal.js';
import { cleTentative } from '../app/atelier/parcours.js';
import { identiteT } from '../app/atelier/auto.js';
import { lireAnnotations, texteRetour, lireRetour, controlerRetour, LIBELLES } from '../app/atelier/retour.js';
import { Stop, lireBranche } from './journal-atelier.mjs';

const RE_SHA = /^[0-9a-f]{40}$/;
const RE_EMPREINTE = /^[0-9a-f]{64}$/;
const RE_RUN = /^[1-9][0-9]{0,19}$/;
const RE_DEPOT = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const PAR_PAGE = 100;
export const WORKFLOW_AUTO = '.github/workflows/atelier-auto.yml';
export const WORKFLOW_AT5 = '.github/workflows/atelier-verification.yml';
// Jobs de chaque workflow -> étapes qui écrivent des faits (nom exact de l'étape -> genre). Un job absent de la liste = job inconnu = STOP.
export const JOBS_AUTO = Object.freeze({
  'J1 garde': Object.freeze({ 'Garde (J1)': 'j1' }),
  'J2 frontière et appel': Object.freeze({ 'Frontière (J2) — aucun appel': 'j2f', 'Appel (une seule requête)': 'j2' }),
  'J4 candidat': Object.freeze({ 'Construire le commit candidat (aucun contenu proposé exécuté)': 'j4', 'Constater le candidat (J4)': 'j4' }),
  'J3 constat': Object.freeze({ 'Constat (J3)': 'j3' }),
});
export const JOBS_AT5 = Object.freeze({
  'faits-git': Object.freeze({}),
  execution: Object.freeze({}),
  assemblage: Object.freeze({ 'Assembler faits.json (relit la branche à la fin)': 'at5' }),
});

const stop = (raison) => { throw new Stop(`STOP : ${raison}`); };

function lancerGit(depot, args, env) {
  const r = spawnSync('git', ['-C', depot, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } });
  return { code: r.status, sortie: r.stdout ?? '', erreur: `${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim() };
}
function git(depot, args, env) {
  const r = lancerGit(depot, args, env);
  if (r.code !== 0) stop(`git ${args[0]} a échoué : ${r.erreur}`);
  return r.sortie;
}
// API REST par « gh api » (GET). Remplaçable dans les tests : api(chemin) -> objet JSON.
export function apiGh(env = process.env) {
  return (chemin) => {
    const r = spawnSync('gh', ['api', '--method', 'GET', chemin], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env });
    if (r.status !== 0) stop(`API GitHub ${chemin} : ${`${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim().slice(0, 300)}`);
    try { return JSON.parse(r.stdout); } catch { return stop(`API GitHub ${chemin} : réponse illisible`); }
  };
}

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// Tête distante exacte de refs/heads/<branche> (null si absente) ; deux réponses ou une réponse illisible = STOP.
function teteDistante(depot, distant, ref, env) {
  const l = git(depot, ['ls-remote', distant, ref], env).split('\n').filter(Boolean).map((x) => x.split('\t')).filter(([, r]) => r === ref);
  if (l.length > 1 || (l.length === 1 && !RE_SHA.test(l[0][0]))) stop(`référence distante ${ref} ambiguë`);
  return l.length === 1 ? l[0][0] : null;
}
// Le commit du workflow doit appartenir à l'histoire de main (lue sur le distant) : le code exécuté est celui de main protégée.
function surMain(depot, distant, sha, env) {
  const main = teteDistante(depot, distant, 'refs/heads/main', env);
  if (main === null) stop('main absente du distant');
  if (lancerGit(depot, ['cat-file', '-e', `${main}^{commit}`], env).code !== 0) {
    git(depot, ['fetch', '--no-tags', '--quiet', distant, 'refs/heads/main:refs/atelier-retour/main'], env);
  }
  if (lancerGit(depot, ['merge-base', '--is-ancestor', sha, main], env).code !== 0) stop(`le commit ${sha} du workflow n'est pas dans l'histoire de main`);
}

// Run lancé à la main sur main, terminé, premier essai, de ce dépôt, du workflow attendu.
function lireRun(api, github, id, workflow) {
  const r = api(`repos/${github}/actions/runs/${id}`);
  if (!estObjet(r) || String(r.id) !== id) stop(`run ${id} illisible`);
  if (r.path !== workflow) stop(`run ${id} : workflow « ${r.path} » (${workflow} attendu)`);
  if (!estObjet(r.repository) || r.repository.full_name !== github) stop(`run ${id} : autre dépôt`);
  if (r.event !== 'workflow_dispatch') stop(`run ${id} : déclenché par « ${r.event} » (workflow_dispatch attendu)`);
  if (r.head_branch !== 'main') stop(`run ${id} : lancé depuis « ${r.head_branch} » (main attendu)`);
  if (!RE_SHA.test(r.head_sha ?? '')) stop(`run ${id} : commit illisible`);
  if (r.status !== 'completed') stop(`run ${id} non terminé (${r.status}) : attendre la fin`);
  if (r.run_attempt !== 1) stop(`run ${id} : essai ${r.run_attempt} (seul le premier essai fait foi, aucune relance)`);
  if (typeof r.created_at !== 'string' || Number.isNaN(Date.parse(r.created_at))) stop(`run ${id} : date illisible`);
  return r;
}

// Jobs du premier essai, puis annotations de chaque job : { genre: texte } ; exigences par étape (voir l'en-tête).
function lireFaitsDuRun(api, github, id, jobsAttendus) {
  const lj = api(`repos/${github}/actions/runs/${id}/attempts/1/jobs?per_page=${PAR_PAGE}`);
  if (!estObjet(lj) || !Array.isArray(lj.jobs) || lj.total_count !== lj.jobs.length || lj.jobs.length >= PAR_PAGE) stop(`run ${id} : liste des jobs illisible ou incomplète`);
  const vus = new Set();
  const textes = {};
  const jobs = [];
  for (const j of lj.jobs) {
    if (!estObjet(j) || !Object.hasOwn(jobsAttendus, j.name)) stop(`run ${id} : job inconnu « ${estObjet(j) ? j.name : '?'} »`);
    if (vus.has(j.name)) stop(`run ${id} : job « ${j.name} » en double`);
    vus.add(j.name);
    if (String(j.run_id) !== id || j.run_attempt !== 1) stop(`run ${id} : job « ${j.name} » d'un autre run ou d'un autre essai`);
    if (j.status !== 'completed') stop(`run ${id} : job « ${j.name} » non terminé`);
    const etapes = jobsAttendus[j.name];
    const exiges = new Set();
    const permis = new Set();
    for (const s of Array.isArray(j.steps) ? j.steps : []) {
      if (!estObjet(s) || !Object.hasOwn(etapes, s.name)) continue;
      const g = etapes[s.name];
      if (s.conclusion === 'success' || s.conclusion === 'failure') { exiges.add(g); permis.add(g); }
    }
    if (j.conclusion === 'skipped') {
      if (exiges.size) stop(`run ${id} : job « ${j.name} » sauté mais étape conclue`);
      continue;
    }
    if (!/^[1-9][0-9]{0,19}$/.test(String(j.id))) stop(`run ${id} : job « ${j.name} » sans identifiant`);
    const an = api(`repos/${github}/check-runs/${j.id}/annotations?per_page=${PAR_PAGE}`);
    if (!Array.isArray(an) || an.length >= PAR_PAGE) stop(`run ${id} : annotations du job « ${j.name} » illisibles ou trop nombreuses`);
    const l = lireAnnotations(an, [...permis]);
    if (l.raison) stop(`run ${id}, job « ${j.name} » : ${l.raison}`);
    for (const g of exiges) if (!Object.hasOwn(l.textes, g)) stop(`run ${id}, job « ${j.name} » : faits ${g} absents (étape conclue sans annotations) : copie manuelle (F1)`);
    for (const [g, t] of Object.entries(l.textes)) {
      if (Object.hasOwn(textes, g)) stop(`run ${id} : faits ${g} portés par deux jobs`);
      textes[g] = t;
    }
    jobs.push({ nom: j.name, id: String(j.id), conclusion: j.conclusion, faits: Object.keys(l.textes) });
  }
  return { textes, jobs };
}

// D3 : C sur journal-atelier/<chantier>, chantier.json à C d'empreinte E, pièce de T présente -> { d3, mission }.
function lireD3({ depot, distant, chantier, jalon, numero, commit, empreinte, env }) {
  const b = lireBranche({ depot, distant, chantier, env });
  if (b === null) stop(`journal-atelier/${chantier} n'existe pas`);
  if (lancerGit(depot, ['merge-base', '--is-ancestor', commit, b.tete], env).code !== 0) stop(`le commit ${commit} n'est pas sur journal-atelier/${chantier}`);
  const lu = lireEtatDurable(git(depot, ['cat-file', 'blob', `${commit}:chantier.json`], env));
  if (lu.raison) stop(`D3 ${commit} illisible : ${lu.raison}`);
  if (lu.empreinte !== empreinte) stop('empreinte de la D3 différente de la sauvegarde confirmée');
  const piece = lu.durable.pieces[cleTentative(jalon, numero)];
  if (!estObjet(piece) || !estObjet(piece.mission)) stop(`pièce de ${chantier}/${jalon}/${numero} absente de la D3`);
  return { d3: { commit, empreinte }, mission: piece.mission };
}

export function retour({ depot, distant = 'origin', github, tentative, runAuto, runAt5 = null, commit, empreinte, api, env = process.env }) {
  if (typeof github !== 'string' || !RE_DEPOT.test(github)) stop('--github PROPRIETAIRE/DEPOT attendu');
  const p = typeof tentative === 'string' ? tentative.split('/') : [];
  if (p.length !== 3 || identiteT({ chantier: p[0], jalon: p[1], numero: p[2] }).t !== tentative) stop('--tentative chantier/jalon/numero attendu');
  const [chantier, jalon, numero] = p;
  if (!RE_RUN.test(runAuto ?? '')) stop('--run-auto attendu');
  if (runAt5 !== null && !RE_RUN.test(runAt5)) stop('--run-at5 illisible');
  if (!RE_SHA.test(commit ?? '') || !RE_EMPREINTE.test(empreinte ?? '')) stop('--commit (40 hex) et --empreinte (64 hex) de la D3 confirmée attendus');

  const ra = lireRun(api, github, runAuto, WORKFLOW_AUTO);
  if (ra.display_title !== `atelier-auto ${tentative}`) stop(`run ${runAuto} : titre « ${ra.display_title} » (autre tentative ?)`);
  surMain(depot, distant, ra.head_sha, env);
  const fa = lireFaitsDuRun(api, github, runAuto, JOBS_AUTO);
  let r5 = null;
  let f5 = { textes: {}, jobs: [] };
  if (runAt5 !== null) {
    r5 = lireRun(api, github, runAt5, WORKFLOW_AT5);
    if (Date.parse(r5.created_at) <= Date.parse(ra.created_at)) stop(`run AT-5 ${runAt5} antérieur au run AUTO`);
    surMain(depot, distant, r5.head_sha, env);
    f5 = lireFaitsDuRun(api, github, runAt5, JOBS_AT5);
    if (!Object.hasOwn(f5.textes, 'at5')) stop(`run AT-5 ${runAt5} : aucun fait AT-5 (assemblage non conclu) : aucune relance automatique`);
  }
  const { d3, mission } = lireD3({ depot, distant, chantier, jalon, numero, commit, empreinte, env });
  const v = {
    tentative,
    runs: { auto: { run_id: runAuto, workflow_sha: ra.head_sha }, at5: r5 === null ? null : { run_id: runAt5, workflow_sha: r5.head_sha } },
    d3,
    textes: { ...fa.textes, ...f5.textes },
  };
  let bloc;
  try { bloc = texteRetour(v); } catch (e) { stop(e.message); }
  const lu = lireRetour(bloc);
  if (lu.raison) stop(`bloc relu refusé : ${lu.raison}`);
  const ctl = controlerRetour(lu.retour, { t: tentative, d3, mission });
  if (ctl.raison) stop(`faits refusés : ${ctl.raison}`);
  if (ctl.lus.j4 && ctl.lus.j4.statut === 'cree') {
    const tete = teteDistante(depot, distant, `refs/heads/atelier/${tentative}`, env);
    if (tete !== ctl.lus.j4.candidat.sha) stop(`branche atelier/${tentative} absente ou différente du candidat des faits J4`);
  }
  // Relecture finale : aucune relance entre-temps (premier essai toujours seul).
  if (lireRun(api, github, runAuto, WORKFLOW_AUTO).head_sha !== ra.head_sha) stop(`run ${runAuto} a changé pendant la lecture`);
  if (r5 !== null && lireRun(api, github, runAt5, WORKFLOW_AT5).head_sha !== r5.head_sha) stop(`run ${runAt5} a changé pendant la lecture`);
  return {
    bloc,
    empreinte: lu.retour.empreinte,
    principal: ctl.principal,
    utilises: ctl.utilises,
    faits: Object.fromEntries(Object.entries(lu.retour.faits).map(([g, f]) => [g, f.empreinte])),
    runs: { auto: `https://github.com/${github}/actions/runs/${runAuto}`, at5: r5 === null ? null : `https://github.com/${github}/actions/runs/${runAt5}` },
    jobs: [...fa.jobs, ...f5.jobs],
  };
}

export function resume(r) {
  const l = [`retour ${r.empreinte.slice(0, 16)} — fait principal ${r.principal} ; utilisés : ${r.utilises.join(', ')}`];
  for (const [g, e] of Object.entries(r.faits)) l.push(`  ${LIBELLES[g].padEnd(18)} ${e.slice(0, 16)}`);
  l.push(`  run AUTO : ${r.runs.auto}`);
  if (r.runs.at5) l.push(`  run AT-5 : ${r.runs.at5}`);
  return `${l.join('\n')}\n`;
}

function options(args) {
  const o = {};
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i];
    if (!/^--[a-z0-9-]+$/.test(k) || i + 1 >= args.length) stop(`option illisible : ${k}`);
    if (Object.hasOwn(o, k.slice(2))) stop(`option répétée : ${k}`);
    o[k.slice(2)] = args[i + 1];
  }
  const connues = ['depot', 'distant', 'github', 'tentative', 'run-auto', 'run-at5', 'commit', 'empreinte'];
  for (const k of Object.keys(o)) if (!connues.includes(k)) stop(`option inconnue : --${k}`);
  return o;
}

export function principal(argv, env = process.env, api = apiGh(env)) {
  const o = options(argv);
  if (!o.depot) stop('--depot attendu');
  return retour({ depot: o.depot, distant: o.distant ?? 'origin', github: o.github, tentative: o.tentative, runAuto: o['run-auto'], runAt5: o['run-at5'] ?? null, commit: o.commit, empreinte: o.empreinte, api, env });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const r = principal(process.argv.slice(2));
    process.stderr.write(resume(r));
    process.stdout.write(r.bloc);
  } catch (e) {
    process.stderr.write(`${e instanceof Stop ? e.message : `STOP : ${e.message}`}\n`);
    process.exitCode = 1;
  }
}
// === FIN_ATELIER_AUTO_RETOUR ===
