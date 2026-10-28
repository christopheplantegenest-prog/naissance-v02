// GO « ATELIER 3 — D1 VALIDÉE, CORRECTION DU RÉSULTAT » (28/10/2026) : outillage non cognitif, aucune acquisition de Naissance (D-007).
// Défaut réel du ticket 35 : la veille est passée (09:35:41) pendant que le robot finissait encore son passage (site, jusqu'à 09:36:00) ;
// elle ne lisait le verdict d'acceptation que dans un passage TERMINÉ, n'en a trouvé aucun et a inscrit « livré sans preuve » alors que
// l'annotation ACCEPTATION « ok » existait déjà (job « Acceptation » terminé à 09:06:21).
// Ces tests rejouent le JOURNAL RÉEL du ticket 35 (tests/atelier-preuve-veille-ticket35.json) et la VRAIE annotation du robot n°328.
// Garanties : aucune preuve inventée ; « acquis » seulement sur verdict « ok » vérifié (empreinte du scénario) ; preuve en attente, absente
// et négative distinguées ; une attente n'est jamais une conclusion ; attente bornée ; les faits inscrits ne sont jamais réécrits.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as N from '../outils-atelier/auto-autonome-noyau.mjs';
import { contexte, github, veille, lireJournal, ecrireJournal, preuveAcceptation, BORNE_PREUVE_MS } from '../outils-atelier/auto-autonome.mjs';
import * as E from '../app/capacites/etat.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEPOT = 'christopheplantegenest-prog/naissance-v02';
const FIXTURE = JSON.parse(readFileSync(join(RACINE, 'tests', 'atelier-preuve-veille-ticket35.json'), 'utf8'));
const REEL = FIXTURE.journal;
const ANNOTATION = FIXTURE.annotation_acceptation;
const EMPREINTE = REEL.find((x) => x.type === 'plan').donnees.scenario_sha256;
const ENV_GIT = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GITHUB_'))), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
function g(d, ...a) {
  const r = spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: ENV_GIT });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}
const ROBOT = '.github/workflows/robot.yml';
const JOB_ACC = 'Acceptation (scénario figé avant le développement, joué par le robot)';
const autre = (message, x) => ({ ...ANNOTATION, message: JSON.stringify({ ...JSON.parse(ANNOTATION.message), ...x }) });

// Faux GitHub : passages du robot avec leurs jobs (statut, conclusion) et annotations, tels que l'API REST les rend.
function fauxGithub() {
  const etat = { commentaires: [], relances: [], runs: [], idc: 1, pannes: new Set() };
  const serveur = createServer((req, res) => {
    let b = '';
    req.on('data', (x) => { b += x; });
    req.on('end', () => {
      const corps = b ? JSON.parse(b) : null;
      const p = new URL(req.url, 'http://x').pathname.replace(`/repos/${DEPOT}`, '');
      const envoyer = (code, v) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(v === undefined ? '' : JSON.stringify(v)); };
      let m;
      if (req.method === 'GET' && p === '/issues') return envoyer(200, []);
      if (req.method === 'POST' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) { const c = { id: etat.idc += 1, ticket: Number(m[1]), body: corps.body, user: { login: 'github-actions[bot]' } }; etat.commentaires.push(c); return envoyer(201, c); }
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) return envoyer(200, etat.commentaires.filter((c) => c.ticket === Number(m[1])));
      if (req.method === 'PATCH' && (m = /^\/issues\/comments\/(\d+)$/.exec(p))) { const c = etat.commentaires.find((x) => x.id === Number(m[1])); c.body = corps.body; return envoyer(200, c); }
      if (req.method === 'POST' && (m = /^\/actions\/workflows\/([a-z.-]+)\/dispatches$/.exec(p))) { etat.relances.push({ workflow: m[1], entrees: corps.inputs }); return envoyer(204); }
      if (req.method === 'GET' && (m = /^\/actions\/workflows\/([a-z.-]+)\/runs$/.exec(p))) return envoyer(200, { workflow_runs: etat.runs.filter((r) => r.path.endsWith(m[1])).map(({ jobs, ...r }) => r) });
      if (req.method === 'GET' && (m = /^\/actions\/runs\/(\d+)\/attempts\/1\/jobs$/.exec(p))) {
        if (etat.pannes.has('jobs')) return envoyer(502, { message: 'panne' });
        const run = etat.runs.find((r) => r.id === Number(m[1]));
        return envoyer(200, { jobs: (run?.jobs ?? []).map(({ annotations, ...j }) => j) });
      }
      if (req.method === 'GET' && (m = /^\/check-runs\/(\d+)\/annotations$/.exec(p))) {
        if (etat.pannes.has('annotations')) return envoyer(502, { message: 'panne' });
        const job = etat.runs.flatMap((r) => r.jobs ?? []).find((j) => j.id === Number(m[1]));
        return envoyer(200, job?.annotations ?? []);
      }
      return envoyer(404, { message: `inconnu ${req.method} ${p}` });
    });
  });
  return { etat, serveur };
}
// Le passage n°328 tel qu'il était quand la veille est passée : en cours (site), job « Acceptation » terminé avec son annotation.
const passage = ({ id = 40660526574, created_at = '2026-10-28T08:57:25Z', status = 'in_progress', acc = { status: 'completed', conclusion: 'success', annotations: [ANNOTATION] } } = {}) => ({
  id, path: ROBOT, status, conclusion: status === 'completed' ? 'success' : null, created_at,
  jobs: [{ id: id * 10, name: 'Inventaire (confiance, sans code du colis)', status: 'completed', conclusion: 'success' },
    { id: id * 10 + 1, name: 'Contrôle (code du colis, sorties non fiables)', status: 'completed', conclusion: 'success' },
    ...(acc ? [{ id: id * 10 + 2, name: JOB_ACC, ...acc }] : [])],
});

// Dépôt d'essai : main -> D' (dépôt) -> commit du robot étiqueté v0.66.16 (son parent est D', comme sur GitHub). Le journal réel est
// inscrit sur sa branche, le SHA du dépôt remplacé par celui de D' (seule adaptation : l'objet réel n'existe pas ici).
function preparer(evenements) {
  const D = mkdtempSync(join(tmpdir(), 'preuve-veille-'));
  const nu = join(D, 'distant.git');
  g(D, 'init', '-q', '--bare', '-b', 'main', nu);
  const graine = join(D, 'graine');
  g(D, 'clone', '-q', nu, graine);
  writeFileSync(join(graine, 'VERSION'), '0.66.15\n');
  g(graine, 'add', '-A');
  g(graine, 'commit', '-q', '-m', 'base v0.66.15');
  writeFileSync(join(graine, 'colis.zip'), 'colis');
  g(graine, 'add', '-A');
  g(graine, 'commit', '-q', '-m', 'dépôt');
  const depot = g(graine, 'rev-parse', 'HEAD');
  g(graine, 'rm', '-q', 'colis.zip');
  writeFileSync(join(graine, 'VERSION'), '0.66.16\n');
  g(graine, 'add', '-A');
  g(graine, 'commit', '-q', '-m', 'Livraison v0.66.16');
  g(graine, 'tag', '-a', 'v0.66.16', '-m', 'v0.66.16');
  g(graine, 'push', '-q', 'origin', 'main', 'v0.66.16');
  const op = join(D, 'operateur');
  g(D, 'clone', '-q', nu, op);
  const journal = evenements.map((x) => (x.type === 'livraison' ? { ...x, donnees: { ...x.donnees, depot } } : x));
  return { D, op, depot, journal };
}
async function avecGithub(evenements, corps, { decalage = 0 } = {}) {
  const { D, op, journal } = preparer(evenements);
  const { etat, serveur } = fauxGithub();
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  try {
    const horloge = { decalage };
    const ctx = contexte({ GITHUB_REPOSITORY: DEPOT, ATELIER_API_GITHUB: url, ATELIER_RACINE: op, ATELIER_PAUSE_MS: '1', GITHUB_RUN_ID: '40665455281', ATELIER_PILOTE: 'actif', ATELIER_ELARGIE: 'actif' }, () => new Date(Date.now() + horloge.decalage));
    await ecrireJournal(ctx, () => ({ budget: [], chantiers: { 35: journal }, message: 'journal du ticket 35 (réel)' }));
    await corps({ ctx, gh: github(ctx), etat, horloge, journal });
  } finally {
    serveur.close();
    rmSync(D, { recursive: true, force: true });
  }
}
const chantier = (ctx) => lireJournal(ctx).chantier(35);
const jusquA = (type) => REEL.slice(0, REEL.findIndex((x) => x.type === type));

test('FIXTURE : le journal RÉEL du ticket 35 se rejoue tel quel (livré, « livré sans preuve », terminé) ; l\'annotation réelle se lit « ok » pour son scénario', () => {
  const e = N.etatChantier(REEL);
  assert.deepEqual([e.termine, e.pilote, e.livre.conclusion, e.livre.acceptation, e.resultat.statut], [true, true, 'livre', null, 'livre-sans-preuve']);
  assert.equal(e.scenarioSha, EMPREINTE);
  assert.equal(N.etatChantier(jusquA('livre')).livraison.version, '0.66.16');
  assert.equal(JSON.parse(ANNOTATION.message).empreinte, EMPREINTE);
});

test('PREUVE — trois états jamais confondus (passage du robot ENCORE EN COURS, comme le ticket 35 à 09:35:41)', async () => {
  const runs = [];
  const jobs = new Map();
  const ann = new Map();
  const gh = { jobs: async (id) => { if (jobs.get(id) === 'panne') throw new Error('502'); return { jobs: jobs.get(id) ?? [] }; }, annotations: async (id) => { if (ann.get(id) === 'panne') throw new Error('502'); return ann.get(id) ?? []; } };
  const cas = async (run, js, an) => { jobs.set(run.id, js); if (js !== 'panne') for (const j of js) ann.set(j.id, an); return preuveAcceptation(gh, [run, ...runs], EMPREINTE); };
  const enCours = { id: 1, status: 'in_progress', created_at: '2026-10-28T08:57:25Z' };
  const fini = { ...enCours, id: 2, status: 'completed' };
  const acc = (x) => [{ id: 9, name: JOB_ACC, status: 'completed', conclusion: 'success', ...x }];
  // Le cas du ticket 35 : passage en cours, job « Acceptation » terminé : la preuve est PRÉSENTE (avant : ignorée).
  let p = await cas(enCours, acc(), [ANNOTATION]);
  assert.deepEqual([p.etat, p.acceptation.verdict, p.acceptation.empreinte, p.run.id], ['presente', 'ok', EMPREINTE, 1]);
  // En attente : rien n'est conclu.
  assert.equal((await cas(enCours, acc({ status: 'in_progress', conclusion: null }), [])).etat, 'attente');
  assert.equal((await cas(enCours, [], [])).etat, 'attente', 'job pas encore créé');
  assert.equal((await cas(enCours, 'panne', [])).etat, 'attente', 'API momentanément illisible');
  ann.set(9, 'panne');
  jobs.set(1, acc());
  assert.equal((await preuveAcceptation(gh, [enCours], EMPREINTE)).etat, 'attente');
  // Absente : job terminé sans verdict, sauté, introuvable sur un passage fini, ou verdict d'un autre scénario.
  assert.equal((await cas(fini, [], [])).etat, 'absente');
  assert.equal((await cas(fini, acc({ conclusion: 'skipped' }), [])).etat, 'absente');
  assert.equal((await cas(fini, acc(), [])).etat, 'absente');
  assert.equal((await cas(fini, acc(), [{ ...ANNOTATION, message: '{pas du json' }])).etat, 'absente');
  p = await cas(fini, acc(), [autre(ANNOTATION.message, { empreinte: 'f'.repeat(64) })]);
  assert.deepEqual([p.etat, p.motif], ['absente', 'verdict d\'un autre scénario (empreinte ffffffffffff)']);
  assert.equal((await preuveAcceptation(gh, [], EMPREINTE)).etat, 'absente');
  // Négative : présente, verdict « echec » (jamais pris pour un « ok »).
  p = await cas(fini, acc(), [autre(ANNOTATION.message, { verdict: 'echec', motif: 'navigateur rouge' })]);
  assert.deepEqual([p.etat, p.acceptation.verdict], ['presente', 'echec']);
});

test('RÉGRESSION ticket 35 : la veille passe PENDANT que le robot finit son passage -> livraison inscrite AVEC l\'acceptation « ok » -> résultat ACQUIS', async () => {
  await avecGithub(jusquA('livre'), async ({ ctx, gh, etat }) => {
    etat.runs.push(passage()); // statut « in_progress », exactement comme à 09:35:41
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 35 : livraison livre (acceptation ok)']);
    const e = N.etatChantier(chantier(ctx));
    assert.deepEqual([e.livre.conclusion, e.livre.acceptation.verdict, e.livre.run], ['livre', 'ok', '40660526574']);
    const c = N.etapePilote(e, { elargie: true });
    assert.deepEqual([c.etape, c.statut], ['conclure', 'acquis']);
    assert.match(c.resume, /scénario d'acceptation vert \(navigateur vert, contre-épreuve rouge sur la base\)/);
  });
});

test('ATTENTE BORNÉE : job « Acceptation » encore en cours -> rien n\'est inscrit (la veille suivante relit) ; au-delà de la borne -> « preuve toujours en attente », jamais « acquis »', async () => {
  await avecGithub(jusquA('livre'), async ({ ctx, gh, etat, horloge }) => {
    etat.runs.push(passage({ acc: { status: 'in_progress', conclusion: null } }));
    const avant = chantier(ctx).length;
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 35 : livraison livre, preuve d\'acceptation en attente (job « Acceptation » en cours)']);
    assert.equal(chantier(ctx).length, avant, 'une absence temporaire n\'est jamais inscrite');
    // La preuve arrive : la veille suivante l'inscrit.
    etat.runs[0].jobs[2] = { ...etat.runs[0].jobs[2], status: 'completed', conclusion: 'success', annotations: [ANNOTATION] };
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 35 : livraison livre (acceptation ok)']);
  });
  await avecGithub(jusquA('livre'), async ({ ctx, gh, etat, horloge }) => {
    etat.runs.push(passage({ acc: { status: 'in_progress', conclusion: null } }));
    horloge.decalage = BORNE_PREUVE_MS + 60_000;
    const f = (await veille(ctx, gh)).faits;
    assert.deepEqual(f, ['ticket 35 : livraison livre (preuve d\'acceptation toujours en attente 2 h après la livraison : job « Acceptation » en cours)']);
    const e = N.etatChantier(chantier(ctx));
    assert.equal(e.livre.acceptation, null);
    const c = N.etapePilote(e, { elargie: true });
    assert.deepEqual([c.etape, c.statut], ['conclure', 'livre-sans-preuve']);
    assert.match(c.resume, /toujours en attente 2 h/);
  });
});

test('PREUVE ABSENTE ou NÉGATIVE : jamais « acquis » ; la cause est écrite', async () => {
  await avecGithub(jusquA('livre'), async ({ ctx, gh, etat }) => {
    etat.runs.push(passage({ status: 'completed', acc: { status: 'completed', conclusion: 'skipped' } }));
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 35 : livraison livre (preuve d\'acceptation absente : scénario non joué (job « Acceptation » sauté))']);
    const c = N.etapePilote(N.etatChantier(chantier(ctx)), { elargie: true });
    assert.deepEqual([c.statut, /scénario non joué/.test(c.resume)], ['livre-sans-preuve', true]);
  });
  await avecGithub(jusquA('livre'), async ({ ctx, gh, etat }) => {
    etat.runs.push(passage({ acc: { status: 'completed', conclusion: 'success', annotations: [autre(ANNOTATION.message, { empreinte: 'a'.repeat(64) })] } }));
    await veille(ctx, gh);
    assert.equal(N.etapePilote(N.etatChantier(chantier(ctx)), { elargie: true }).statut, 'livre-sans-preuve', 'verdict d\'un autre scénario : non retenu');
  });
});

test('RÉCONCILIATION du ticket 35 : la preuve existante est lue après coup, AJOUTÉE au journal (faits antérieurs intacts), affichée « acquis (réconcilié) » ; une seule fois', async () => {
  await avecGithub(REEL, async ({ ctx, gh, etat, journal }) => {
    // Un passage du robot POSTÉRIEUR à la livraison (autre chantier) ne doit jamais servir de preuve.
    etat.runs.push(passage({ status: 'completed' }), passage({ id: 40700000000, created_at: '2026-10-29T10:00:00Z', status: 'completed', acc: { status: 'completed', conclusion: 'success', annotations: [autre(ANNOTATION.message, { verdict: 'echec' })] } }));
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 35 : preuve d\'acceptation réconciliée (ok, passage 40660526574)']);
    const j = chantier(ctx);
    assert.deepEqual(j.slice(0, journal.length), journal, 'les 18 faits inscrits restent identiques');
    assert.deepEqual([j.length, j.at(-1).type, j.at(-1).donnees.run, j.at(-1).donnees.acceptation.verdict], [19, 'reconciliation', '40660526574', 'ok']);
    const e = N.etatChantier(j);
    assert.equal(e.resultat.statut, 'livre-sans-preuve', 'le résultat inscrit n\'est pas réécrit');
    const ra = N.resultatAffiche(e);
    assert.deepEqual([ra.statut, ra.reconcilie, ra.statutInscrit], ['acquis', true, 'livre-sans-preuve']);
    // Le ticket et l'écran de Naissance montrent ACQUIS (réconcilié), avec la trace du constat initial.
    const dernier = etat.commentaires.at(-1).body;
    assert.match(dernier, /Résultat : ✅ ACQUIS \(preuve de fonctionnement jouée par le robot\) \(réconcilié\)\*\* — Acquis : v0\.66\.16 livrée/);
    assert.match(dernier, /constat initial : « livré sans preuve », conservé au journal/);
    const r = E.resumer({ number: 35, state: 'open', title: 'Atelier : bouton Saluer d\'essai' }, etat.commentaires);
    assert.deepEqual([r.etat.resultat.statut, r.etat.resultat.acceptations], ['acquis', ['ok']]);
    // Une seule fois.
    assert.deepEqual((await veille(ctx, gh)).faits, []);
    assert.equal(chantier(ctx).length, 19);
  });
});

test('RÉCONCILIATION refusée sans preuve positive vérifiée : preuve absente ou d\'un autre scénario = rien ; verdict négatif = montré, statut inchangé ; noyau strict', async () => {
  await avecGithub(REEL, async ({ ctx, gh, etat }) => {
    etat.runs.push(passage({ status: 'completed', acc: { status: 'completed', conclusion: 'success', annotations: [autre(ANNOTATION.message, { empreinte: 'b'.repeat(64) })] } }));
    assert.deepEqual((await veille(ctx, gh)).faits, []);
    etat.runs[0].jobs[2].annotations = [];
    assert.deepEqual((await veille(ctx, gh)).faits, []);
    etat.runs[0].jobs[2] = { ...etat.runs[0].jobs[2], status: 'in_progress' };
    assert.deepEqual((await veille(ctx, gh)).faits, []);
    assert.equal(chantier(ctx).length, 18);
  });
  await avecGithub(REEL, async ({ ctx, gh, etat }) => {
    etat.runs.push(passage({ status: 'completed', acc: { status: 'completed', conclusion: 'success', annotations: [autre(ANNOTATION.message, { verdict: 'non-probant', motif: 'contre-épreuve verte sur la base' })] } }));
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 35 : preuve d\'acceptation réconciliée (non-probant, passage 40660526574)']);
    const ra = N.resultatAffiche(N.etatChantier(chantier(ctx)));
    assert.equal(ra.statut, 'livre-sans-preuve');
    assert.match(ra.resume, /non-probant — contre-épreuve verte sur la base/);
  });
  // Hors fenêtre de 7 jours : plus cherchée.
  await avecGithub(REEL, async ({ ctx, gh, etat, horloge }) => {
    etat.runs.push(passage({ status: 'completed' }));
    horloge.decalage = Date.parse('2026-11-05T09:00:00Z') - Date.now();
    assert.deepEqual((await veille(ctx, gh)).faits, []);
  });
  const ok = { run: '40660526574', acceptation: { verdict: 'ok', motif: 'x', empreinte: EMPREINTE } };
  const quand = '2026-10-28T10:00:00.000Z';
  assert.ok(Array.isArray(N.appliquerChantier(REEL, { type: 'reconciliation', quand, donnees: ok })));
  assert.match(N.appliquerChantier(REEL, { type: 'reconciliation', quand, donnees: { ...ok, acceptation: { ...ok.acceptation, empreinte: 'c'.repeat(64) } } }).raison, /réconciliation illisible/);
  assert.match(N.appliquerChantier(REEL, { type: 'reconciliation', quand, donnees: { ...ok, run: 'x' } }).raison, /réconciliation illisible/);
  assert.match(N.appliquerChantier(jusquA('livre'), { type: 'reconciliation', quand, donnees: ok }).raison, /réconciliation sans objet/);
  assert.match(N.appliquerChantier(N.appliquerChantier(REEL, { type: 'reconciliation', quand, donnees: ok }), { type: 'reconciliation', quand, donnees: ok }).raison, /réconciliation sans objet/);
  assert.match(N.appliquerChantier(REEL, { type: 'avis', quand, donnees: {} }).raison, /chantier terminé|illisible|inconnue/);
});
