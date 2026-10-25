// v0.66.0 — ATELIER AUTONOME : l'opérateur de bout en bout, SANS appel payant ni docker : faux serveur GitHub local (tickets, relances,
// passages AT-5 avec annotations ATELIER-FAITS-1, robot), dépôt Git nu local, agent piloté par un faux client de l'API.
// Ticket « Atelier : … » -> plan -> développement -> branche candidate -> AT-5 + gardes -> second avis -> colis -> dépôt D' -> le robot
// (deballer.py réel : depot, inventaire2, livrer) avance main -> veille -> terminé ; puis /stop, /reprendre et un tour perdu.
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance (D-007).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireFaits } from '../app/atelier/verification.js';
import { annotationsFaits } from '../app/atelier/retour.js';
import { etatBudget } from '../app/atelier/budget.js';
import { etatChantier, prochaineEtape, PROPRIETAIRE_ID } from '../outils-atelier/auto-autonome-noyau.mjs';
import { contexte, github, avancer, agent, bilan, commande, veille, lireJournal, BRANCHE_JOURNAL } from '../outils-atelier/auto-autonome.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEPOT = 'christopheplantegenest-prog/naissance-v02';
// MISE À JOUR DÉLIBÉRÉE v0.66.3 : sans les variables GITHUB_* du job qui lance la suite (le robot et AT-5 voyaient un faux « Dépôt de l'atelier » dans leur résumé).
const ENV_GIT = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GITHUB_'))), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
const hache = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
function g(d, ...a) {
  const r = spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: ENV_GIT });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}

// ------------------------------------------------------------------------------------------------ faux GitHub
function fauxGithub({ T, nu }) {
  const etat = { tickets: new Map(), commentaires: [], relances: [], runs: [], annules: [], idc: 1, idr: 1000 };
  const runDe = (workflow, extra) => { const r = { id: etat.idr += 1, path: `.github/workflows/${workflow}`, status: 'completed', conclusion: 'success', created_at: new Date().toISOString(), ...extra }; etat.runs.push(r); return r; };
  const serveur = createServer((req, res) => {
    let b = '';
    req.on('data', (x) => { b += x; });
    req.on('end', () => {
      const corps = b ? JSON.parse(b) : null;
      const u = new URL(req.url, 'http://x');
      const p = u.pathname.replace(`/repos/${DEPOT}`, '');
      const envoyer = (code, v) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(v === undefined ? '' : JSON.stringify(v)); };
      let m;
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)$/.exec(p))) return envoyer(200, etat.tickets.get(Number(m[1])));
      if (req.method === 'GET' && p === '/issues') return envoyer(200, [...etat.tickets.values()]);
      if (req.method === 'POST' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) { const c = { id: etat.idc += 1, ticket: Number(m[1]), body: corps.body, user: { login: 'github-actions[bot]' } }; etat.commentaires.push(c); return envoyer(201, c); }
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) return envoyer(200, etat.commentaires.filter((c) => c.ticket === Number(m[1])));
      if (req.method === 'PATCH' && (m = /^\/issues\/comments\/(\d+)$/.exec(p))) { const c = etat.commentaires.find((x) => x.id === Number(m[1])); c.body = corps.body; c.modifie = (c.modifie ?? 0) + 1; return envoyer(200, c); }
      if (req.method === 'POST' && (m = /^\/actions\/workflows\/([a-z.-]+)\/dispatches$/.exec(p))) {
        assert.equal(corps.ref, 'main');
        etat.relances.push({ workflow: m[1], entrees: corps.inputs });
        if (m[1] === 'atelier-verification.yml') runDe(m[1], { at5: etat.faitsPour(corps.inputs) });
        if (m[1] === 'robot.yml') runDe(m[1], { status: 'waiting', depot: corps.inputs.depot });
        return envoyer(204);
      }
      if (req.method === 'GET' && (m = /^\/actions\/workflows\/([a-z.-]+)\/runs$/.exec(p))) return envoyer(200, { workflow_runs: etat.runs.filter((r) => r.path.endsWith(m[1])).reverse() });
      if (req.method === 'GET' && (m = /^\/actions\/runs\/(\d+)$/.exec(p))) return envoyer(200, etat.runs.find((r) => r.id === Number(m[1])) ?? { id: Number(m[1]), status: 'completed' });
      if (req.method === 'POST' && (m = /^\/actions\/runs\/(\d+)\/cancel$/.exec(p))) { etat.annules.push(Number(m[1])); return envoyer(202, {}); }
      if (req.method === 'GET' && (m = /^\/actions\/runs\/(\d+)\/attempts\/1\/jobs$/.exec(p))) return envoyer(200, { jobs: ['faits-git', 'execution', 'assemblage'].map((name, i) => ({ id: Number(m[1]) * 10 + i, name })) });
      if (req.method === 'GET' && (m = /^\/check-runs\/(\d+)\/annotations$/.exec(p))) {
        const run = etat.runs.find((r) => r.id === Math.floor(Number(m[1]) / 10));
        const lignes = Number(m[1]) % 10 === 2 ? annotationsFaits('at5', run.at5) : [];
        return envoyer(200, lignes.map((l) => { const x = /^::notice title=([^:]+)::(.*)$/.exec(l); return { title: x[1], message: x[2], annotation_level: 'notice' }; }));
      }
      return envoyer(404, { message: `inconnu ${req.method} ${p}` });
    });
  });
  return { etat, serveur };
}

// Faits AT-5 établis sur le dépôt nu (diff réel base..candidat), tests réels « exécutés » (10/10).
function faitsAt5(nu, d) {
  const brut = g(nu, 'diff', '--name-status', '--no-renames', d.base, d.candidat).split('\n').filter(Boolean).map((l) => l.split('\t'));
  return ecrireFaits({
    demande: { ...d },
    diff: { fichiers: brut.map(([s, chemin]) => ({ chemin, etat: { A: 'cree', M: 'modifie' }[s], mode: '100644' })), refuses: [], statut: 'etabli', tests_modifies: [], tests_supprimes: [], zones_touchees: [] },
    erreurs_techniques: [],
    execution: { code: 0, deballer_sha256: '5'.repeat(64), delai_ms: 300000, duree_tests_ms: 1000, fichiers_injectes: ['app/sw.js', 'app/version.js'], injection_relue: true, statut: 'executee', verifier_sha256: '4'.repeat(64), version_injectee: d.version_candidat },
    identite: { base_ancetre: true, base_est_commit: true, base_sur_main: true, base_tag: d.base, branche_existe: true, branche_pointe: d.candidat, branche_pointe_fin: d.candidat, commits: 1, constats: [], est_commit: true, fusions: 0, main: d.base, merge_base: d.base,
      segment: { commits: 0, fichiers: [], fusions: 0, hors_outillage: [], refuses: [], statut: 'etabli' }, statut: 'etablie', tag_ancetre_base: true, tag_candidat_libre: true, version_fichier_base: d.version_base },
    protocole: 'atelier-faits-2',
    provenance: { depot: DEPOT, run_id: '40000000009', verificateur_sha: d.base, workflow_ref: `${DEPOT}/.github/workflows/atelier-verification.yml@refs/heads/main` },
    robot: { erreurs: [], fumee: 'ok', json: 'ok', syntaxe: 'ok' },
    tests: { annules: 0, echecs: 0, ignores: 0, reussis: 10, statut: 'executes', total: 10 },
  }, hache);
}

// ------------------------------------------------------------------------------------------------ faux client de l'API (aucun appel payant)
const usage = { input_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 300 };
const tour = (blocs) => ({ emis: true, inconnu: false, statut: 200, json: { content: blocs.map(([name, input], i) => ({ type: 'tool_use', id: `u${i}`, name, input })), stop_reason: 'tool_use', usage } });
const fauxClient = (reponses) => ({ compter: async () => 5000, envoyer: async () => reponses.shift() });
const PLAN = { description: 'Salutation de Naissance', missions: [{ id: 'salut', titre: 'Fonction de salutation', comportement: 'saluer() rend « bonjour ».', criteres: ['saluer() rend bonjour.'], tests: ['tests/salut.test.mjs vérifie saluer().'], autorises: ['app/salut.js', 'tests/salut.test.mjs'], cognitive: false }] };

function preparer() {
  const T = mkdtempSync(join(tmpdir(), 'operateur-'));
  const nu = join(T, 'distant.git');
  g(T, 'init', '-q', '--bare', '-b', 'main', nu);
  const graine = join(T, 'graine');
  g(T, 'clone', '-q', nu, graine);
  for (const [f, c] of Object.entries({ VERSION: '0.65.26\n', 'ETAT.md': '# État\n\n## Historique\n', 'app/index.html': '<!doctype html>\n', 'app/main.js': 'export const x = 1;\n', 'signature/naissance.jks': 'cle-fictive\n', 'tests/base.test.mjs': 'import test from "node:test";\ntest("base", () => {});\n', 'CLAUDE.md': '# règles\n' })) {
    mkdirSync(dirname(join(graine, f)), { recursive: true });
    writeFileSync(join(graine, f), c);
  }
  g(graine, 'add', '-A');
  g(graine, 'commit', '-q', '-m', 'base');
  g(graine, 'tag', '-a', 'v0.65.26', '-m', 'v0.65.26');
  g(graine, 'push', '-q', 'origin', 'main', 'v0.65.26');
  const op = join(T, 'operateur');
  g(T, 'clone', '-q', nu, op);
  return { T, nu, op, base: g(nu, 'rev-parse', 'main') };
}
const ctxDe = (op, url, run) => contexte({ GITHUB_REPOSITORY: DEPOT, ATELIER_API_GITHUB: url, ATELIER_RACINE: op, ATELIER_PAUSE_MS: '1', GITHUB_RUN_ID: String(run) });
async function tourAgent(ctx, gh, T, nu, consigne, reponses, nom) {
  const travail = join(T, `travail-${nom}`);
  g(T, 'clone', '-q', nu, travail);
  g(travail, 'checkout', '-q', JSON.parse(readFileSync(consigne, 'utf8')).depart);
  const r = await agent({ consigne, travail, racineOutil: RACINE, client: fauxClient(reponses), suiteComplete: () => ({ code: 0, resume: { total: 11, reussis: 11, echecs: 0 }, sortie: '' }) });
  writeFileSync(join(T, `resultat-${nom}.json`), JSON.stringify(r));
  return bilan(ctx, gh, { consigne, resultat: join(T, `resultat-${nom}.json`) });
}
function deballer(dossier, commande, env) {
  const r = spawnSync('python3', ['-I', join(RACINE, '.github', 'workflows', 'deballer.py'), commande], { cwd: dossier, encoding: 'utf8', env: { ...ENV_GIT, ...env } });
  const sorties = Object.fromEntries(readFileSync(env.GITHUB_OUTPUT, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { code: r.status, sorties, texte: `${r.stdout}${r.stderr}` };
}

test('opérateur : un ticket « Atelier : » mène, sans geste intermédiaire, du plan au dépôt D\' ; le robot (deballer.py réel) livre après V4 ; veille et clôture', async () => {
  const { T, nu, op, base } = preparer();
  const { etat, serveur } = fauxGithub({ T, nu });
  etat.faitsPour = (d) => faitsAt5(nu, d);
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  try {
    const ctx = ctxDe(op, url, 100);
    const gh = github(ctx);
    etat.tickets.set(7, { number: 7, state: 'open', title: 'Atelier : Naissance sait saluer', body: 'Je voudrais que Naissance sache dire bonjour.', user: { id: PROPRIETAIRE_ID, login: 'christopheplantegenest-prog' } });
    etat.tickets.set(6, { number: 6, state: 'open', title: 'Atelier : intrus', body: 'x', user: { id: 1, login: 'autre' } });
    assert.equal((await avancer(ctx, gh, { ticket: 6, consigne: join(T, 'c0.json') })).raison, 'ticket-non-recevable');
    const consigne = join(T, 'consigne.json');

    // 1. Planification (tour payant réservé AVANT l'appel ; coût réel inscrit au bilan).
    const a1 = await avancer(ctx, gh, { ticket: 7, consigne });
    assert.equal(a1.etape, 'planifier');
    assert.equal(a1.consigne.maximum, 3_000_000);
    let j = lireJournal(ctx);
    assert.equal(etatBudget(j.budget).engageCycle, 3_000_000);
    assert.equal(etatChantier(j.chantier(7)).demande.base.sha, base);
    const b1 = await tourAgent(ctx, gh, T, nu, consigne, [tour([['proposer_plan', { plan: PLAN }]])], 'plan');
    assert.deepEqual(b1.evenements, ['plan']);
    j = lireJournal(ctx);
    assert.equal(etatBudget(j.budget).engageCycle, 0);
    assert.equal(etatBudget(j.budget).consommeCycle, b1.montant);
    assert.equal(etatChantier(j.chantier(7)).version, '0.65.27');

    // 2. Développement : écritures dans le périmètre, suite complète verte -> branche candidate créée par la plomberie (job bilan).
    assert.equal((await avancer(ctx, gh, { ticket: 7, consigne })).etape, 'developper');
    const b2 = await tourAgent(ctx, gh, T, nu, consigne, [
      tour([['ecrire', { chemin: 'app/salut.js', contenu: 'export const saluer = () => \'bonjour\';\n' }], ['ecrire', { chemin: 'tests/salut.test.mjs', contenu: 'import test from "node:test";\n' }], ['ecrire', { chemin: 'app/atelier/x.js', contenu: 'refusé' }]]),
      tour([['terminer', { statut: 'candidat', resume: 'saluer() ajouté' }]]),
    ], 'dev');
    assert.deepEqual(b2.evenements, ['candidat']);
    assert.equal(g(nu, 'rev-parse', 'atelier/ticket-7/salut/1'), b2.candidat);
    assert.equal(g(nu, 'rev-parse', `${b2.candidat}^`), base);
    assert.deepEqual(g(nu, 'diff', '--name-only', base, b2.candidat).split('\n'), ['app/salut.js', 'tests/salut.test.mjs']);

    // 3. Vérification AT-5 (atelier-verification.yml relancé, faits relus en annotations, confrontés) + gardes statiques AT-11.
    const v = await avancer(ctx, gh, { ticket: 7, consigne });
    assert.equal(v.verdict, 'verification-technique-conforme', v.raisons.join('\n'));
    assert.deepEqual(etat.relances.find((x) => x.workflow === 'atelier-verification.yml').entrees, { branche: 'atelier/ticket-7/salut/1', candidat: b2.candidat, base, version_base: '0.65.26', version_candidat: '0.65.27' });

    // 4. Second avis (payant, borné) puis colis + dépôt D' + relance du robot.
    assert.equal((await avancer(ctx, gh, { ticket: 7, consigne })).etape, 'avis');
    assert.match(JSON.parse(readFileSync(consigne, 'utf8')).diff, /saluer/);
    const b3 = await tourAgent(ctx, gh, T, nu, consigne, [tour([['rendre_avis', { conforme: true, objections: [] }]])], 'avis');
    assert.deepEqual(b3.evenements, ['avis']);
    const l = await avancer(ctx, gh, { ticket: 7, consigne });
    assert.equal(l.etape, 'livrer');
    assert.equal(g(nu, 'rev-parse', 'livraison/ticket-7-1'), l.depot);
    assert.equal(g(nu, 'rev-parse', `${l.depot}^`), base);
    assert.deepEqual(g(nu, 'diff', '--name-status', base, l.depot).split('\n'), ['A\tatelier-ticket-7-v0.65.27.zip']);
    assert.deepEqual(etat.relances.at(-1), { workflow: 'robot.yml', entrees: { depot: l.depot } });
    assert.equal(prochaineEtape(etatChantier(lireJournal(ctx).chantier(7))).raison, 'attente-livraison');

    // 5. Le robot, avec le deballer.py MODIFIÉ, sur des copies fraîches comme ses jobs : depot -> inventaire2 -> (contrôle simulé) -> livrer.
    const copie = (nom) => { const d = join(T, nom); g(T, 'clone', '-q', nu, d); g(d, 'checkout', '-q', l.depot); return d; };
    const temp = join(T, 'runner');
    mkdirSync(join(temp, 'controle-apk'), { recursive: true });
    const sortie = (n) => { const f = join(temp, `sortie-${n}`); writeFileSync(f, ''); return f; };
    const d1 = deballer(copie('robot-1'), 'depot', { ROBOT_DEPOT: l.depot, RUNNER_TEMP: temp, GITHUB_OUTPUT: sortie(1) });
    assert.equal(d1.code, 0, d1.texte);
    const inv = deballer(copie('robot-2'), 'inventaire2', { RUNNER_TEMP: temp, GITHUB_OUTPUT: sortie(2) });
    assert.equal(inv.sorties.decision, 'controler', inv.texte);
    assert.equal(inv.sorties.version, '0.65.27');
    assert.equal(inv.sorties.apk, 'true');
    assert.equal(inv.sorties.base_sha, l.depot);
    writeFileSync(join(temp, 'controle-apk', 'app.apk'), 'apk-fictif');
    const liv = deballer(copie('robot-3'), 'livrer', {
      RUNNER_TEMP: temp, GITHUB_OUTPUT: sortie(3), ROBOT_DEPOT: l.depot, INV_DECISION: 'controler', INV_MOTIF: '', INV_BASE_SHA: inv.sorties.base_sha, INV_ZIP_BLOB: inv.sorties.zip_blob,
      INV_ZIP_SHA256: inv.sorties.zip_sha256, INV_ARBRE: inv.sorties.arbre_attendu, INV_VERSION: inv.sorties.version, CTL_VERDICT: 'ok', CTL_MOTIF: '', CTL_ARBRE: inv.sorties.arbre_attendu, CTL_APK_SHA256: hache('apk-fictif'),
    });
    assert.equal(liv.sorties.livre, 'true', liv.texte);
    const livre = g(nu, 'rev-parse', 'main');
    assert.equal(g(nu, 'rev-parse', `${livre}^`), l.depot); // main -> D' -> livraison : avance rapide
    assert.equal(g(nu, 'rev-parse', 'v0.65.27^{commit}'), livre);
    assert.deepEqual(g(nu, 'ls-tree', '--name-only', '-r', livre).split('\n').filter((x) => x.endsWith('.zip')), []);
    assert.equal(g(nu, 'show', `${livre}:app/salut.js`), 'export const saluer = () => \'bonjour\';');
    assert.equal(g(nu, 'show', `${livre}:VERSION`), '0.65.27');
    // Refus du mode dépôt : main a bougé (le parent de D' n'est plus la tête de main).
    const d4 = deballer(copie('robot-4'), 'depot', { ROBOT_DEPOT: l.depot, RUNNER_TEMP: temp, GITHUB_OUTPUT: sortie(4) });
    assert.equal(d4.code, 1);
    assert.match(d4.texte, /parent du dépôt/);

    // 6. Veille : l'étiquette du robot a D' pour parent -> « livre » ; puis clôture.
    const vv = await veille(ctx, gh);
    assert.deepEqual(vv.faits, ['ticket 7 : livraison livre']);
    // MISE À JOUR DÉLIBÉRÉE v0.66.3 : un ticket en file d'attente démarre dès la clôture, sans attendre la veille.
    etat.tickets.set(10, { number: 10, state: 'open', title: 'Atelier : suivant', body: 'x', user: { id: PROPRIETAIRE_ID } });
    const fin = await avancer(ctx, gh, { ticket: 7, consigne });
    assert.equal(fin.etape, 'terminer');
    assert.deepEqual(fin.faits, ['ticket 10 : chantier lancé depuis la file']);
    assert.deepEqual(etat.relances.at(-1), { workflow: 'atelier-chantier.yml', entrees: { ticket: '10' } });
    const e = etatChantier(lireJournal(ctx).chantier(7));
    assert.equal(e.termine, true);
    assert.equal(etatBudget(lireJournal(ctx).budget).consommeCycle, e.depense);
    // Ticket : un commentaire d'état modifié en place ; nouveaux commentaires seulement pour V4 et la fin.
    const c7 = etat.commentaires.filter((c) => c.ticket === 7);
    assert.ok(c7.length <= 3, String(c7.length));
    assert.match(c7.at(-1).body, /Livré : v0\.65\.27/);
    assert.match(c7.map((c) => c.body).join('\n'), /OUTILLAGE NON COGNITIF/);
    // Le journal n'a jamais été réécrit : chaque écriture prolonge la précédente.
    assert.equal(g(nu, 'rev-list', '--merges', '--count', BRANCHE_JOURNAL), '0');
    assert.ok(Number(g(nu, 'rev-list', '--count', BRANCHE_JOURNAL)) >= 10);
  } finally {
    serveur.close();
    rmSync(T, { recursive: true, force: true });
  }
});

test('opérateur : /stop annule le tour en cours (compté à sa borne), /reprendre relance ; un tour perdu est inscrit à sa borne par la veille ; intrus ignorés', async () => {
  const { T, nu, op } = preparer();
  const { etat, serveur } = fauxGithub({ T, nu });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  try {
    const gh = github(ctxDe(op, url, 300));
    etat.tickets.set(8, { number: 8, state: 'open', title: 'Atelier : autre capacité', body: 'texte', user: { id: PROPRIETAIRE_ID } });
    const consigne = join(T, 'consigne.json');
    assert.equal((await avancer(ctxDe(op, url, 300), gh, { ticket: 8, consigne })).etape, 'planifier');
    // Un second passage pendant le tour ouvert ne réserve rien.
    assert.equal((await avancer(ctxDe(op, url, 301), gh, { ticket: 8, consigne })).raison, 'tour-en-cours');
    etat.runs.push({ id: 300, path: '.github/workflows/atelier-chantier.yml', status: 'in_progress', created_at: new Date().toISOString() });
    const ev = (n, body, id = PROPRIETAIRE_ID) => { const f = join(T, `ev-${n}.json`); writeFileSync(f, JSON.stringify({ issue: { number: 8 }, comment: { body, user: { id } } })); return f; };
    assert.equal((await commande(ctxDe(op, url, 400), gh, { evenement: ev(1, '/stop', 12345) })).commande, null);
    setTimeout(() => { etat.runs.find((r) => r.id === 300).status = 'completed'; }, 5);
    assert.equal((await commande(ctxDe(op, url, 400), gh, { evenement: ev(2, '/stop') })).commande, '/stop');
    assert.deepEqual(etat.annules, [300]);
    let j = lireJournal(ctxDe(op, url, 400));
    let e = etatChantier(j.chantier(8));
    assert.equal(e.arrete, true);
    assert.deepEqual(e.tours.map((t) => [t.clos, t.issue, t.montant]), [[true, 'annule', 3_000_000]]);
    assert.equal(etatBudget(j.budget).consommeCycle, 3_000_000);
    assert.equal(etatBudget(j.budget).engageCycle, 0);
    assert.equal((await avancer(ctxDe(op, url, 401), gh, { ticket: 8, consigne })).raison, 'arret');
    // /reprendre avec une réponse : relance immédiate ; la réponse est transmise au prochain agent.
    await commande(ctxDe(op, url, 402), gh, { evenement: ev(3, '/reprendre\nPrécision : en français.') });
    assert.deepEqual(etat.relances.at(-1), { workflow: 'atelier-chantier.yml', entrees: { ticket: '8' } });
    const a = await avancer(ctxDe(op, url, 500), gh, { ticket: 8, consigne });
    assert.equal(a.etape, 'planifier');
    assert.deepEqual(a.consigne.reponses, ['Précision : en français.']);
    // Le passage 500 disparaît (annulé, coupé) sans bilan : la veille l'inscrit à sa borne et relance.
    etat.runs.push({ id: 500, path: '.github/workflows/atelier-chantier.yml', status: 'completed', conclusion: 'cancelled', created_at: new Date().toISOString() });
    const vv = await veille(ctxDe(op, url, 600), gh);
    assert.deepEqual(vv.faits, ['ticket 8 : tour ticket-8-2 perdu, inscrit à sa borne']);
    j = lireJournal(ctxDe(op, url, 600));
    e = etatChantier(j.chantier(8));
    assert.deepEqual(e.tours.map((t) => t.issue), ['annule', 'inconnu']);
    assert.equal(etatBudget(j.budget).consommeCycle, 6_000_000);
    assert.equal(e.depense, 6_000_000);
    // /valider hors attente de validation : sans effet.
    await commande(ctxDe(op, url, 700), gh, { evenement: ev(4, '/valider') });
    assert.equal(etatChantier(lireJournal(ctxDe(op, url, 700)).chantier(8)).validation, false);
    // Un second ticket attend : un chantier à la fois.
    etat.tickets.set(9, { number: 9, state: 'open', title: 'Atelier : troisième', body: 'x', user: { id: PROPRIETAIRE_ID } });
    assert.equal((await avancer(ctxDe(op, url, 800), gh, { ticket: 9, consigne })).raison, 'file');
  } finally {
    serveur.close();
    rmSync(T, { recursive: true, force: true });
  }
});
