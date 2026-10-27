// v0.66.14 — FINALISATION DE L'AUTOMATISATION : VOIE AUTOMATIQUE du robot pour la seule classe E STRICTE (une capacité d'essai neuve,
// rien d'existant touché), déposée par l'Atelier. Tout le reste garde la V4 ; tout doute arrête sans écrire et sans poser de question.
//  1. classer.examiner_auto : contrôles positifs et contre-épreuves (E non stricte, S, O, R, exception) ;
//  2. livraison_auto.py : choix de la voie (matrice complète), ticket du dépôt, opposition (/stop, ticket fermé, lecture impossible) ;
//  3. robot.yml : la voie ne vient que du job de confiance, interrupteur, délai, environnements, double relecture ;
//  4. BOUT EN BOUT sans appel payant : ticket -> Atelier -> dépôt D' -> robot (deballer.py et livraison_auto.py RÉELS, faux GitHub local)
//     -> livraison automatique -> veille -> clôture ; puis /stop pendant le délai, interrupteur coupé, colis E non stricte, colis S.
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance (D-007).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ecrireFaits } from '../app/atelier/verification.js';
import { annotationsFaits } from '../app/atelier/retour.js';
import { etatChantier, prochaineEtape, PROPRIETAIRE_ID, texteEtat } from '../outils-atelier/auto-autonome-noyau.mjs';
import { contexte, github, avancer, agent, bilan, veille, lireJournal, colis, commitPlomberie } from '../outils-atelier/auto-autonome.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const WF = join(RACINE, '.github', 'workflows');
const lire = (p) => readFileSync(join(RACINE, p), 'utf8');
const DEPOT = 'christopheplantegenest-prog/naissance-v02';
const ENV_GIT = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GITHUB_') && !/proxy/i.test(k))), GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C', NO_PROXY: '*' };
const hache = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
function g(d, ...a) {
  const r = spawnSync('git', ['-C', d, ...a], { encoding: 'utf8', env: ENV_GIT });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
}
function python(code, args = [], input = '') {
  const r = spawnSync('python3', ['-I', '-B', '-c', code, ...args], { input, encoding: 'utf8', env: ENV_GIT, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

// ------------------------------------------------------------------------------------------------ 1. classe E stricte
const PY_CLASSER = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("classer", sys.argv[1])
c = importlib.util.module_from_spec(spec); spec.loader.exec_module(c)
sortie = {}
for cas in json.load(sys.stdin):
    avant = cas["avant"]; apres = dict(avant)
    for p, v in cas["apres"].items():
        if v is None: apres.pop(p, None)
        else: apres[p] = v
    ch = []
    for p in sorted(set(avant) | set(apres)):
        if p not in apres: ch.append({"chemin": p, "statut": "D"})
        elif p not in avant: ch.append({"chemin": p, "statut": "A"})
        elif avant[p] != apres[p]: ch.append({"chemin": p, "statut": "M"})
    la = lambda p: avant[p].encode() if p in avant else None
    lb = lambda p: apres[p].encode() if p in apres else None
    if cas.get("boum"):
        def boum(*a): raise RuntimeError("x")
        c.examiner_auto = boum
    r = c.classer(ch, la, lb, lambda: sorted(apres))
    sortie[cas["nom"]] = {"classe": r["classe"], "auto": r["auto"]}
print(json.dumps(sortie, ensure_ascii=False))
`;
const classer = (cas) => python(PY_CLASSER, [join(WF, 'classer.py')], JSON.stringify(cas));
const DECL = (x = {}) => ({ id: 'compte-receptions', titre: 'Compte', description: 'essai', lit: ['receptions'], effet: 'zone-essai', declencheurs: ['apres-tour'], delaiMs: 1000, maxLignes: 1, invariants: [{ type: 'champs', champs: ['n'] }], ...x });
const CAT = (...capacites) => `${JSON.stringify({ format: 'naissance-capacites-essai', v: 1, capacites }, null, 1)}\n`;
const MOD = "export function executer(entree) {\n  const r = entree && entree.lues && Array.isArray(entree.lues.receptions) ? entree.lues.receptions : [];\n  return { lignes: [{ cle: 'n-1', donnees: { n: r.length } }] };\n}\n";
const TEST_CAP = (id) => `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { executer } from '../app/capacites-essai/${id}.js';\ntest('${id}', () => { assert.equal(executer({ lues: { receptions: [1, 2] } }).lignes[0].donnees.n, 2); });\n`;
const BASE = Object.fromEntries(['app/langage/connaissances.js', 'app/essais/registre-essais.js', 'app/main.js', 'app/index.html', 'app/styles.css', 'app/version.js'].map((p) => [p, lire(p)]));
// Base « réelle » : une capacité déjà livrée (comme main v0.66.13 avec bilan-echanges).
const LIVREE = DECL({ id: 'deja-livree', lit: ['emissions'] });
const BASE_L = { ...BASE, 'app/capacites-essai/catalogue.json': CAT(LIVREE), 'app/capacites-essai/deja-livree.js': MOD, 'tests/capacite-essai-deja-livree.test.mjs': TEST_CAP('deja-livree') };
const NEUVE = { 'app/capacites-essai/catalogue.json': CAT(LIVREE, DECL()), 'app/capacites-essai/compte-receptions.js': MOD, 'tests/capacite-essai-compte-receptions.test.mjs': TEST_CAP('compte-receptions') };
const cas = (nom, apres, avant = BASE_L, extra = {}) => ({ nom, avant, apres, ...extra });

test('E stricte : une capacité neuve et rien d\'existant touché ouvre la voie automatique ; toute autre forme garde la V4', () => {
  const r = classer([
    cas('neuve', NEUVE),
    cas('neuve sur catalogue vide', { 'app/capacites-essai/catalogue.json': CAT(DECL()), 'app/capacites-essai/compte-receptions.js': MOD, 'tests/capacite-essai-compte-receptions.test.mjs': TEST_CAP('compte-receptions') }, BASE),
    // LIMITE CONNUE (règle E de L4, inchangée) : un second test « capacite-essai-<id>-suffixe » est attribué à l'id « <id>-suffixe » -> S.
    cas('neuve + test à suffixe', { ...NEUVE, 'tests/capacite-essai-compte-receptions-limites.test.mjs': TEST_CAP('compte-receptions') }),
    // contre-épreuves : classe E, mais pas stricte
    cas('E- entrée livrée modifiée', { ...NEUVE, 'app/capacites-essai/catalogue.json': CAT({ ...LIVREE, titre: 'Autre titre' }, DECL()) }),
    cas('E- module livré modifié', { ...NEUVE, 'app/capacites-essai/deja-livree.js': MOD.replace('n-1', 'n-2') }),
    cas('E- seulement un module livré modifié', { 'app/capacites-essai/deja-livree.js': MOD.replace('n-1', 'n-2') }),
    cas('E- deux capacités neuves', { ...NEUVE, 'app/capacites-essai/catalogue.json': CAT(LIVREE, DECL(), DECL({ id: 'deuxieme' })), 'app/capacites-essai/deuxieme.js': MOD, 'tests/capacite-essai-deuxieme.test.mjs': TEST_CAP('deuxieme') }),
    cas('E- neuve sans test', { 'app/capacites-essai/catalogue.json': NEUVE['app/capacites-essai/catalogue.json'], 'app/capacites-essai/compte-receptions.js': MOD }),
    cas('E- neuve + test d\'une capacité livrée', { ...NEUVE, 'tests/capacite-essai-deja-livree-bis.test.mjs': TEST_CAP('deja-livree') }),
    cas('E- description d\'une capacité livrée seulement', { 'app/capacites-essai/catalogue.json': CAT({ ...LIVREE, description: 'autre' }) }),
    // autres classes
    cas('S- neuve + fichier cognitif', { ...NEUVE, 'app/langage/connaissances.js': `${BASE['app/langage/connaissances.js']}\n// x\n` }),
    cas('S- neuve + test existant modifié', { ...NEUVE, 'tests/capacite-essai-deja-livree.test.mjs': `${TEST_CAP('deja-livree')}// x\n` }),
    cas('O- couleur', { 'app/styles.css': `${BASE['app/styles.css']}\n.x { color: #333; }\n` }),
    cas('R- retrait', { 'app/capacites-essai/catalogue.json': CAT(), 'app/capacites-essai/deja-livree.js': null, 'tests/capacite-essai-deja-livree.test.mjs': null }),
    cas('mutation : examen strict en exception', NEUVE, BASE_L, { boum: true }),
  ]);
  assert.equal(r['neuve + test à suffixe'].classe, 'S');
  for (const n of ['neuve', 'neuve sur catalogue vide']) assert.deepEqual(r[n], { classe: 'E', auto: null }, n);
  const attendus = {
    'E- entrée livrée modifiée': /capacité déjà livrée modifiée \(deja-livree\)/,
    'E- module livré modifié': /seul le module neuf compte-receptions\.js/,
    'E- seulement un module livré modifié': /0 capacité\(s\) neuve\(s\)/,
    'E- deux capacités neuves': /2 capacité\(s\) neuve\(s\)/,
    'E- neuve sans test': /aucun test à son nom pour compte-receptions/,
    'E- description d\'une capacité livrée seulement': /0 capacité\(s\) neuve\(s\)/,
    'mutation : examen strict en exception': /examen impossible \(RuntimeError\)/,
  };
  for (const [n, re] of Object.entries(attendus)) {
    assert.equal(r[n].classe, 'E', `${n} : ${JSON.stringify(r[n])}`);
    assert.match(r[n].auto ?? '', re, n);
  }
  assert.deepEqual(r['E- neuve + test d\'une capacité livrée'], { classe: 'S', auto: 'classe S' }, 'déjà hors de E (test sans capacité correspondante)');
  assert.deepEqual(r['S- neuve + test existant modifié'], { classe: 'S', auto: 'classe S' });
  assert.deepEqual(r['S- neuve + fichier cognitif'], { classe: 'S', auto: 'classe S' });
  assert.deepEqual(r['O- couleur'], { classe: 'O', auto: 'classe autre que E' });
  assert.deepEqual(r['R- retrait'], { classe: 'R', auto: 'classe autre que E' });
});

// ------------------------------------------------------------------------------------------------ 2. livraison_auto.py (décisions pures)
const PY_AUTO = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("la", sys.argv[1])
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
e = json.load(sys.stdin)
out = {"voies": [list(m.choisir_voie(f)) for f in e["voies"]], "tickets": [], "oppositions": []}
for lignes, depot in e["tickets"]:
    try: out["tickets"].append(m.ticket_du_depot(lignes, depot))
    except m.Doute as d: out["tickets"].append("doute : " + str(d))
for t, c, depuis in e["oppositions"]:
    out["oppositions"].append(m.opposition(t, c, depuis, 308310970))
print(json.dumps(out, ensure_ascii=False))
`;
const D = 'a'.repeat(40);
const OK = { decision: 'controler', evenement: 'workflow_dispatch', depot: D, acteur: 'github-actions[bot]', classe: 'E', e_auto: 'oui', apk: 'true', interrupteur: 'actif', ticket: '30' };
const TICKET = { number: 30, state: 'open', title: 'Atelier : nouvelles réceptions', user: { id: 308310970 } };
const COM = (body, created_at, id = 308310970) => ({ body, created_at, user: { id } });

test('voie : « auto » exige TOUS les faits ; le moindre manque donne la V4, un fait non établi avec l\'interrupteur actif donne l\'arrêt', () => {
  const voies = [
    OK,
    { ...OK, interrupteur: '' }, { ...OK, interrupteur: 'oui' }, { ...OK, interrupteur: 'ACTIF' },
    { ...OK, decision: 'refuser' }, { ...OK, evenement: 'push' }, { ...OK, depot: '' }, { ...OK, depot: 'zz' },
    { ...OK, acteur: 'christopheplantegenest-prog' }, { ...OK, acteur: 'christophe-n' },
    { ...OK, classe: 'S' }, { ...OK, classe: 'O' }, { ...OK, classe: 'R' }, { ...OK, classe: '' },
    { ...OK, e_auto: 'non', e_auto_motif: '2 capacité(s) neuve(s)' }, { ...OK, e_auto: '' }, { ...OK, apk: 'false' },
    { ...OK, doute: 'ticket fermé' }, { ...OK, doute: 'ticket fermé', interrupteur: '' }, {},
  ];
  const r = python(PY_AUTO, [join(WF, 'livraison_auto.py')], JSON.stringify({ voies, tickets: [], oppositions: [] }));
  const v = r.voies.map((x) => x[0]);
  assert.deepEqual(v, ['auto', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'v4', 'arret', 'v4', 'v4']);
  assert.match(r.voies[1][1], /interrupteur LIVRAISON_AUTO_E coupé \(mode ombre\)/);
  assert.match(r.voies[14][1], /classe E non stricte : 2 capacité/);
  assert.match(r.voies[17][1], /fait non établi : ticket fermé/);
});

test('ticket du dépôt et opposition : un seul ticket, un /stop de Christophe depuis le dépôt arrête, tout doute arrête', () => {
  const L = (sha, ref) => `${sha}\t${ref}`;
  const B = 'b'.repeat(40);
  const tickets = [
    [[L(D, 'refs/heads/livraison/ticket-30-1'), L(B, 'refs/heads/livraison/ticket-29-1')], D],
    [[L(D, 'refs/heads/livraison/ticket-30-1'), L(D, 'refs/heads/livraison/ticket-30-2')], D],
    [[L(D, 'refs/heads/livraison/ticket-30-1'), L(D, 'refs/heads/livraison/ticket-31-1')], D],
    [[L(B, 'refs/heads/livraison/ticket-30-1')], D],
    [[L(D, 'refs/heads/livraison/prep-catalogue-v0.66.13')], D],
    [[L(D, 'refs/heads/livraison/ticket-30-1-x')], D],
  ];
  const T0 = '2026-10-26T15:00:00Z';
  const oppositions = [
    [TICKET, [COM('/reprendre', '2026-10-26T16:00:00Z'), COM('Atelier autonome', '2026-10-26T16:00:00Z', 41898282)], T0],
    [TICKET, [COM('/stop', '2026-10-26T15:10:00Z')], T0],
    [TICKET, [COM(' /stop \r\npourquoi', '2026-10-26T15:10:00Z')], T0],
    [TICKET, [COM('/stop', '2026-10-26T14:59:59Z')], T0],
    [TICKET, [COM('/stop', '2026-10-26T15:10:00Z', 1)], T0],
    [TICKET, [COM('/stopper', '2026-10-26T15:10:00Z'), COM('merci /stop', '2026-10-26T15:10:00Z')], T0],
    [{ ...TICKET, state: 'closed' }, [], T0],
    [{ ...TICKET, title: 'Bug : x' }, [], T0],
    [{ ...TICKET, user: { id: 1 } }, [], T0],
    [{ ...TICKET, pull_request: {} }, [], T0],
    [TICKET, [{ body: '/stop', user: { id: 308310970 } }], T0],
    [TICKET, 'pas une liste', T0],
    [TICKET, [], 'hier'],
  ];
  const r = python(PY_AUTO, [join(WF, 'livraison_auto.py')], JSON.stringify({ voies: [], tickets, oppositions }));
  assert.equal(r.tickets[0], 30);
  assert.equal(r.tickets[1], 30, 'deux livraisons du même ticket sur le même dépôt : un seul ticket');
  for (const i of [2, 3, 4, 5]) assert.match(String(r.tickets[i]), /^doute : \d ticket\(s\)/, String(i));
  assert.deepEqual(r.oppositions.map((x) => (x === null ? null : x.replace(/ à .*/, ''))), [
    null, '/stop de Christophe', '/stop de Christophe', null, null, null,
    'ticket fermé', 'le ticket n\'est pas une demande « Atelier : … »', 'ticket ouvert par un autre compte que le propriétaire', 'ticket illisible ou demande de fusion',
    'commentaire illisible', 'commentaires illisibles', 'date du dépôt illisible',
  ]);
});

// ------------------------------------------------------------------------------------------------ 3. robot.yml
function blocs(texte) {
  const out = {};
  const re = /^ {2}([a-z0-9-]+):\n/gm;
  const pos = [...texte.matchAll(re)].map((m) => [m[1], m.index]);
  pos.forEach(([n, i], k) => { out[n] = texte.slice(i, k + 1 < pos.length ? pos[k + 1][1] : undefined); });
  return out;
}
const sansCommentaires = (t) => t.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

test('robot.yml : la voie vient du seul job de confiance ; interrupteur, délai, environnements et double relecture', () => {
  const y = lire('.github/workflows/robot.yml');
  const jobs = blocs(y.slice(y.indexOf('\njobs:\n') + 6));
  // MISE À JOUR DÉLIBÉRÉE ATELIER 3 (PR P1, outillage) : + le job « acceptation » (scénario figé joué par le robot ; gardé par
  // tests/atelier-3-boucle.test.mjs), entre le contrôle et la livraison.
  assert.deepEqual(Object.keys(jobs), ['inventaire', 'controle', 'acceptation', 'opposition', 'livraison', 'site', 'reveil', 'publier']);
  const code = sansCommentaires(y);
  // Interrupteur : lu une seule fois, par l'étape « voie » de l'inventaire.
  assert.equal(code.match(/vars\.LIVRAISON_AUTO_E/g).length, 1);
  assert.match(jobs.inventaire, /INTERRUPTEUR: \$\{\{ vars\.LIVRAISON_AUTO_E \}\}\n[\s\S]*run: python3 -I \.github\/workflows\/livraison_auto\.py voie/);
  assert.match(jobs.inventaire, /voie: \$\{\{ steps\.voie\.outputs\.voie \}\}/);
  // La voie ne lit que les sorties de l'inventaire (jamais celles du contrôle, non fiables) et la nature du déclenchement.
  const etapeVoie = jobs.inventaire.slice(jobs.inventaire.indexOf('- name: Choisir la voie'), jobs.inventaire.indexOf('- name: Signaler un arrêt'));
  assert.doesNotMatch(etapeVoie, /needs\.|controle\.outputs|verdict|arbre_teste|secrets\./);
  assert.match(etapeVoie, /if: steps\.inventaire2\.outputs\.decision == 'controler'/);
  assert.match(jobs.inventaire, /if: steps\.voie\.outputs\.voie == 'arret'\n\s+run: \|\n[^\n]*\n\s+exit 1/);
  // Opposition : seulement en voie auto après un contrôle vert ; aucun secret ; 30 minutes puis relecture du ticket.
  assert.match(jobs.opposition, /needs\.inventaire\.outputs\.voie == 'auto' &&\n\s+needs\.controle\.result == 'success' &&\n\s+needs\.controle\.outputs\.verdict == 'ok'/);
  assert.match(jobs.opposition, /run: sleep 1800\n/);
  assert.match(jobs.opposition, /run: python3 -I \.github\/workflows\/livraison_auto\.py opposition/);
  assert.doesNotMatch(sansCommentaires(jobs.opposition), /secrets\.|environment:/);
  assert.match(jobs.opposition, /permissions:\n {6}contents: read\n {6}issues: read\n {4}steps:/);
  // Livraison : V4 par défaut ; « livraison-essai » seulement si l'inventaire a choisi « auto » ET que l'opposition a réussi.
  // MISE À JOUR DÉLIBÉRÉE ATELIER 3 (PR P1, outillage) : la livraison attend aussi le job « acceptation » (un scénario présent et non vert
  // empêche toute livraison, V4 comprise).
  assert.match(jobs.livraison, /needs: \[inventaire, controle, opposition, acceptation\]/);
  assert.match(jobs.livraison, /\(needs\.inventaire\.outputs\.voie == 'v4' \|\|\n\s+\(needs\.inventaire\.outputs\.voie == 'auto' && needs\.opposition\.result == 'success'\)\)/);
  assert.match(jobs.livraison, /environment: \$\{\{ needs\.inventaire\.outputs\.voie == 'auto' && 'livraison-essai' \|\| 'livraison' \}\}/);
  assert.equal(code.match(/livraison-essai/g).length, 1, 'l\'environnement sans réviseur n\'est nommé qu\'à un seul endroit');
  assert.match(jobs.livraison, /- name: Dernière relecture du ticket avant l'écriture \(voie automatique\)\n\s+if: needs\.inventaire\.outputs\.voie == 'auto'/);
  assert.ok(jobs.livraison.indexOf('livraison_auto.py opposition') < jobs.livraison.indexOf('deballer.py livrer'));
  assert.match(jobs.livraison, /ROBOT_VOIE: \$\{\{ needs\.inventaire\.outputs\.voie \}\}\n\s+run: python3 -I \.github\/workflows\/deballer\.py livrer/);
  // La clé de l'application reste confinée au job de livraison.
  for (const [n, b] of Object.entries(jobs)) if (n !== 'livraison') assert.doesNotMatch(sansCommentaires(b), /LIVRAISON_CLE_PRIVEE/, n);
  // Aucune valeur interpolée dans une commande ; actions épinglées.
  for (const b of Object.values(jobs)) for (const run of b.split('run:').slice(1)) assert.doesNotMatch(run.split('\n      - ')[0], /\$\{\{/);
  for (const u of y.match(/uses: \S+/g)) assert.match(u, /@[0-9a-f]{40}$/, u);
  // deballer.py livrer : double barrière (classe E stricte recalculée sur l'arbre reconstruit par la livraison).
  const py = lire('.github/workflows/deballer.py');
  assert.match(py, /if voie == "auto" and \(refus is not None or classification is None or classification\["classe"\] != "E"\n\s+or classification\["auto"\] is not None\):\n\s+raise Arret/);
  assert.match(py, /if voie == "auto" and not depot:\n\s+raise Arret/);
  // livraison_auto.py : bibliothèque standard seule, aucune valeur « auto » par défaut.
  const la = lire('.github/workflows/livraison_auto.py');
  // MISE À JOUR DÉLIBÉRÉE ATELIER 3 (PR P1, outillage) : + base64, hashlib et time (lecture du scénario gelé dans le journal : empreinte
  // recalculée, relectures espacées) ; toujours la bibliothèque standard seule.
  assert.deepEqual([...la.matchAll(/^import (\S+)/gm)].map((m) => m[1]), ['base64', 'hashlib', 'json', 'os', 're', 'subprocess', 'sys', 'time', 'urllib.error', 'urllib.request']);
  // MISE À JOUR DÉLIBÉRÉE ATELIER 3 (PR P1, outillage) : deux retours « auto » exactement : la classe E stricte (choisir_voie) et la voie
  // élargie (choisir_voie_complete, interrupteur ATELIER_VOIE_ELARGIE) ; jamais par défaut (gardé par tests/atelier-3-boucle.test.mjs).
  assert.equal(sansCommentaires(la).match(/return "auto"/g).length, 2);
});

// ------------------------------------------------------------------------------------------------ 4. bout en bout (faux GitHub local)
function fauxGithub() {
  const etat = { tickets: new Map(), commentaires: [], relances: [], runs: [], idc: 1, idr: 1000 };
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
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)$/.exec(p))) return etat.tickets.has(Number(m[1])) ? envoyer(200, etat.tickets.get(Number(m[1]))) : envoyer(404, {});
      if (req.method === 'GET' && p === '/issues') return envoyer(200, [...etat.tickets.values()]);
      if (req.method === 'POST' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) { const c = { id: etat.idc += 1, ticket: Number(m[1]), body: corps.body, created_at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), user: { login: 'github-actions[bot]', id: 41898282 } }; etat.commentaires.push(c); return envoyer(201, c); }
      if (req.method === 'GET' && (m = /^\/issues\/(\d+)\/comments$/.exec(p))) { const page = Number(u.searchParams.get('page') ?? 1); return envoyer(200, page > 1 ? [] : etat.commentaires.filter((c) => c.ticket === Number(m[1]))); }
      if (req.method === 'PATCH' && (m = /^\/issues\/comments\/(\d+)$/.exec(p))) { const c = etat.commentaires.find((x) => x.id === Number(m[1])); c.body = corps.body; return envoyer(200, c); }
      if (req.method === 'POST' && (m = /^\/actions\/workflows\/([a-z.-]+)\/dispatches$/.exec(p))) {
        etat.relances.push({ workflow: m[1], entrees: corps.inputs });
        if (m[1] === 'atelier-verification.yml') runDe(m[1], { at5: etat.faitsPour(corps.inputs) });
        if (m[1] === 'robot.yml') runDe(m[1], { status: 'in_progress', depot: corps.inputs.depot });
        return envoyer(204);
      }
      if (req.method === 'GET' && (m = /^\/actions\/workflows\/([a-z.-]+)\/runs$/.exec(p))) return envoyer(200, { workflow_runs: etat.runs.filter((r) => r.path.endsWith(m[1])).reverse() });
      if (req.method === 'GET' && (m = /^\/actions\/runs\/(\d+)$/.exec(p))) return envoyer(200, etat.runs.find((r) => r.id === Number(m[1])) ?? { id: Number(m[1]), status: 'completed' });
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
const usage = { input_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 300 };
const tour = (bs) => ({ emis: true, inconnu: false, statut: 200, json: { content: bs.map(([name, input], i) => ({ type: 'tool_use', id: `u${i}`, name, input })), stop_reason: 'tool_use', usage } });
const fauxClient = (reponses) => ({ compter: async () => 5000, envoyer: async () => reponses.shift() });
const ID = 'nouvelles-receptions';
const FICHIERS_CAP = { [`app/capacites-essai/${ID}.js`]: MOD, [`tests/capacite-essai-${ID}.test.mjs`]: TEST_CAP(ID) };
const PLAN = { description: 'Nouvelles réceptions (capacité d\'essai)', missions: [{ id: ID, titre: 'Capacité d\'essai nouvelles réceptions', comportement: 'compte les réceptions.', criteres: ['une ligne par exécution.'], tests: [`tests/capacite-essai-${ID}.test.mjs`], autorises: ['app/capacites-essai/catalogue.json', `app/capacites-essai/${ID}.js`, `tests/capacite-essai-${ID}.test.mjs`], cognitive: false }] };
const CAT_BASE = CAT(LIVREE);
const CAT_NEUF = CAT(LIVREE, DECL({ id: ID }));

function preparer() {
  const T = mkdtempSync(join(tmpdir(), 'livraison-auto-'));
  const nu = join(T, 'distant.git');
  g(T, 'init', '-q', '--bare', '-b', 'main', nu);
  const graine = join(T, 'graine');
  g(T, 'clone', '-q', nu, graine);
  const fichiers = { VERSION: '0.66.13\n', 'ETAT.md': '# État\n\n## Historique\n', 'signature/naissance.jks': 'cle-fictive\n', 'CLAUDE.md': '# règles\n', ...BASE, 'app/capacites-essai/catalogue.json': CAT_BASE, 'app/capacites-essai/deja-livree.js': MOD, 'tests/capacite-essai-deja-livree.test.mjs': TEST_CAP('deja-livree') };
  for (const [f, c] of Object.entries(fichiers)) { mkdirSync(dirname(join(graine, f)), { recursive: true }); writeFileSync(join(graine, f), c); }
  g(graine, 'add', '-A');
  g(graine, 'commit', '-q', '-m', 'base');
  g(graine, 'tag', '-a', 'v0.66.13', '-m', 'v0.66.13');
  g(graine, 'push', '-q', 'origin', 'main', 'v0.66.13');
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
// Un script du robot, lancé comme ses jobs : copie fraîche du dépôt nu, extraite sur le dépôt D', sorties GITHUB_OUTPUT relues.
// Lancement asynchrone : le faux GitHub vit dans ce même processus et doit pouvoir répondre pendant l'exécution.
function lancer(cmd, args, options) {
  return new Promise((ok) => {
    const p = spawn(cmd, args, options);
    let texte = '';
    p.stdout.on('data', (x) => { texte += x; });
    p.stderr.on('data', (x) => { texte += x; });
    p.on('close', (code) => ok({ status: code, texte }));
  });
}
async function robot({ T, nu, depot, nom, script, commande, env }) {
  const d = join(T, nom);
  g(T, 'clone', '-q', nu, d);
  g(d, 'checkout', '-q', depot);
  const temp = join(T, 'runner');
  mkdirSync(join(temp, 'controle-apk'), { recursive: true });
  const sortie = join(temp, `sortie-${nom}`);
  writeFileSync(sortie, '');
  const resume = join(temp, `resume-${nom}`);
  writeFileSync(resume, '');
  const r = await lancer('python3', ['-I', join(WF, script), commande], { cwd: d, env: { ...ENV_GIT, RUNNER_TEMP: temp, GITHUB_OUTPUT: sortie, GITHUB_STEP_SUMMARY: resume, GITHUB_REPOSITORY: DEPOT, ...env } });
  const sorties = Object.fromEntries(readFileSync(sortie, 'utf8').split('\n').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { code: r.status, sorties, texte: r.texte, resume: readFileSync(resume, 'utf8'), temp };
}
// Le passage du robot, job par job, dans l'ordre de robot.yml (le contrôle, inchangé, est simulé : verdict ok sur l'arbre attendu).
async function passageRobot({ T, nu, depot, url, interrupteur = 'actif', acteur = 'github-actions[bot]', avantOpposition = () => {}, forcerVoie = null, n = 1 }) {
  const api = { GITHUB_API_URL: url, PROPRIETAIRE_ID: String(PROPRIETAIRE_ID), GH_TOKEN: 'jeton-fictif' };
  const dep = await robot({ T, nu, depot, nom: `depot-${n}`, script: 'deballer.py', commande: 'depot', env: { ROBOT_DEPOT: depot } });
  assert.equal(dep.code, 0, dep.texte);
  const inv = await robot({ T, nu, depot, nom: `inventaire-${n}`, script: 'deballer.py', commande: 'inventaire2', env: {} });
  const s = inv.sorties;
  const voie = await robot({ T, nu, depot, nom: `voie-${n}`, script: 'livraison_auto.py', commande: 'voie', env: {
    ...api, INV_DECISION: s.decision, INV_CLASSE: s.classe, INV_E_AUTO: s.e_auto, INV_E_AUTO_MOTIF: s.e_auto_motif, INV_APK: s.apk,
    EVENEMENT: 'workflow_dispatch', ACTEUR: acteur, ROBOT_DEPOT: depot, INTERRUPTEUR: interrupteur } });
  assert.equal(voie.code, 0, voie.texte);
  const out = { inv: s, voie: voie.sorties, resumeVoie: voie.resume, opposition: null, livraison: null };
  const choisie = forcerVoie ?? voie.sorties.voie;
  if (choisie === 'arret') return out;
  const opposer = () => robot({ T, nu, depot, nom: `opposition-${n}-${Math.random().toString(36).slice(2, 7)}`, script: 'livraison_auto.py', commande: 'opposition', env: { ...api, TICKET: voie.sorties.ticket || '30', DEPUIS: voie.sorties.depuis || '2026-01-01T00:00:00Z' } });
  if (choisie === 'auto') {
    avantOpposition();
    out.opposition = await opposer();
    if (out.opposition.code !== 0) return out;
    const derniere = await opposer();
    if (derniere.code !== 0) { out.opposition = derniere; return out; }
  }
  writeFileSync(join(T, 'runner', 'controle-apk', 'app.apk'), 'apk-fictif');
  out.livraison = await robot({ T, nu, depot, nom: `livraison-${n}`, script: 'deballer.py', commande: 'livrer', env: {
    ROBOT_DEPOT: depot, ROBOT_VOIE: choisie, INV_DECISION: s.decision, INV_MOTIF: s.motif ?? '', INV_BASE_SHA: s.base_sha, INV_ZIP_BLOB: s.zip_blob, INV_ZIP_SHA256: s.zip_sha256,
    INV_ARBRE: s.arbre_attendu, INV_VERSION: s.version, CTL_VERDICT: 'ok', CTL_MOTIF: '', CTL_ARBRE: s.arbre_attendu, CTL_APK_SHA256: hache('apk-fictif') } });
  return out;
}
async function chantierJusquAuDepot({ ctx, gh, T, nu, etat, ticket, catalogue = CAT_NEUF, fichiers = FICHIERS_CAP }) {
  etat.tickets.set(ticket, { number: ticket, state: 'open', title: 'Atelier : nouvelles réceptions', body: 'Une capacité d\'essai qui compte les réceptions.', user: { id: PROPRIETAIRE_ID, login: 'christopheplantegenest-prog' } });
  const consigne = join(T, `consigne-${ticket}.json`);
  assert.equal((await avancer(ctx, gh, { ticket, consigne })).etape, 'planifier');
  await tourAgent(ctx, gh, T, nu, consigne, [tour([['proposer_plan', { plan: PLAN }]])], `plan-${ticket}`);
  assert.equal((await avancer(ctx, gh, { ticket, consigne })).etape, 'developper');
  const ecritures = [['ecrire', { chemin: 'app/capacites-essai/catalogue.json', contenu: catalogue }], ...Object.entries(fichiers).map(([chemin, contenu]) => ['ecrire', { chemin, contenu }])];
  const b = await tourAgent(ctx, gh, T, nu, consigne, [tour(ecritures), tour([['terminer', { statut: 'candidat', resume: 'capacité ajoutée' }]])], `dev-${ticket}`);
  assert.deepEqual(b.evenements, ['candidat']);
  const v = await avancer(ctx, gh, { ticket, consigne });
  assert.equal(v.verdict, 'verification-technique-conforme', v.raisons?.join('\n'));
  assert.equal((await avancer(ctx, gh, { ticket, consigne })).etape, 'avis');
  await tourAgent(ctx, gh, T, nu, consigne, [tour([['rendre_avis', { conforme: true, objections: [] }]])], `avis-${ticket}`);
  const l = await avancer(ctx, gh, { ticket, consigne });
  assert.equal(l.etape, 'livrer');
  assert.deepEqual(etat.relances.at(-1), { workflow: 'robot.yml', entrees: { depot: l.depot } });
  return { l, consigne };
}

test('BOUT EN BOUT : ticket -> Atelier -> D\' -> robot (voie automatique, sans V4) -> livré -> veille -> clôture, sans aucun geste de Christophe', async () => {
  const { T, nu, op, base } = preparer();
  const { etat, serveur } = fauxGithub();
  etat.faitsPour = (d) => faitsAt5(nu, d);
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  try {
    const ctx = ctxDe(op, url, 100);
    const gh = github(ctx);
    const { l, consigne } = await chantierJusquAuDepot({ ctx, gh, T, nu, etat, ticket: 30 });
    assert.equal(g(nu, 'rev-parse', 'livraison/ticket-30-1'), l.depot);
    // Pendant l'attente, le ticket annonce la voie automatique (et /stop), sans demander de geste.
    assert.match(texteEtat(etatChantier(lireJournal(ctx).chantier(30))), /livrée automatiquement si tous les contrôles réussissent/);

    const p = await passageRobot({ T, nu, depot: l.depot, url });
    assert.equal(p.inv.decision, 'controler');
    assert.equal(p.inv.classe, 'E');
    assert.equal(p.inv.e_auto, 'oui', p.inv.e_auto_motif);
    assert.deepEqual([p.voie.voie, p.voie.ticket], ['auto', '30']);
    assert.match(p.voie.depuis, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.match(p.resumeVoie, /voie : \*\*🤖 automatique \(sans V4\)\*\*/);
    assert.equal(p.opposition.code, 0, p.opposition.texte);
    assert.equal(p.livraison.sorties.livre, 'true', p.livraison.texte);
    const livre = g(nu, 'rev-parse', 'main');
    assert.equal(g(nu, 'rev-parse', `${livre}^`), l.depot);
    assert.equal(g(nu, 'rev-parse', 'v0.66.14^{commit}'), livre);
    assert.equal(g(nu, 'show', `${livre}:app/capacites-essai/catalogue.json`), CAT_NEUF.trim());
    assert.equal(g(nu, 'show', `${livre}:VERSION`), '0.66.14');
    assert.notEqual(livre, base);

    // Veille : l'étiquette a D' pour parent -> « livre » ; clôture sans geste.
    etat.runs.filter((r) => r.path.endsWith('robot.yml')).forEach((r) => { r.status = 'completed'; });
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 30 : livraison livre']);
    assert.equal((await avancer(ctx, gh, { ticket: 30, consigne })).etape, 'terminer');
    assert.equal(etatChantier(lireJournal(ctx).chantier(30)).termine, true);
    assert.match(etat.commentaires.filter((c) => c.ticket === 30).at(-1).body, /Livré : v0\.66\.14/);
    // Aucune commande de Christophe n'a été nécessaire : aucun /valider, aucun commentaire de sa part.
    assert.equal(etat.commentaires.filter((c) => c.user.id === PROPRIETAIRE_ID).length, 0);
  } finally {
    serveur.close();
    rmSync(T, { recursive: true, force: true });
  }
});

test('ARRÊTS AUTOMATIQUES : /stop pendant le délai, interrupteur coupé (V4), colis E non stricte (V4, et refus de la voie forcée), acteur non Atelier', async () => {
  const { T, nu, op, base } = preparer();
  const { etat, serveur } = fauxGithub();
  etat.faitsPour = (d) => faitsAt5(nu, d);
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${serveur.address().port}`;
  try {
    const ctx = ctxDe(op, url, 200);
    const gh = github(ctx);
    const { l, consigne } = await chantierJusquAuDepot({ ctx, gh, T, nu, etat, ticket: 31 });

    // a. Interrupteur coupé : mode ombre, voie V4 (rien ne change par rapport à aujourd'hui).
    const ombre = await passageRobot({ T, nu, depot: l.depot, url, interrupteur: '', forcerVoie: 'arret', n: 2 });
    assert.equal(ombre.voie.voie, 'v4');
    assert.match(ombre.voie.voie_motif, /interrupteur LIVRAISON_AUTO_E coupé \(mode ombre\)/);
    // b. Dépôt lancé par un autre acteur que l'Atelier : V4.
    assert.equal((await passageRobot({ T, nu, depot: l.depot, url, acteur: 'christopheplantegenest-prog', forcerVoie: 'arret', n: 3 })).voie.voie, 'v4');

    // c. /stop de Christophe pendant le délai : l'opposition arrête, rien n'est écrit.
    const p = await passageRobot({ T, nu, depot: l.depot, url, n: 4, avantOpposition: () => {
      etat.commentaires.push({ id: 999, ticket: 31, body: '/stop', created_at: new Date(Date.now() + 1000).toISOString().replace(/\.\d+Z$/, 'Z'), user: { id: PROPRIETAIRE_ID, login: 'christopheplantegenest-prog' } });
    } });
    assert.equal(p.voie.voie, 'auto');
    assert.equal(p.opposition.code, 1);
    assert.match(p.opposition.resume, /livraison automatique arrêtée : \/stop de Christophe/);
    assert.equal(p.livraison, null);
    assert.equal(g(nu, 'rev-parse', 'main'), base, 'rien n\'est écrit');
    // d. Ticket fermé pendant le délai : même arrêt.
    etat.commentaires.pop();
    etat.tickets.get(31).state = 'closed';
    const f = await passageRobot({ T, nu, depot: l.depot, url, n: 5 });
    assert.equal(f.voie.voie, 'arret', 'ticket déjà fermé à l\'inventaire : arrêt, ni livraison ni question');
    assert.match(f.voie.voie_motif, /ticket fermé/);
    etat.tickets.get(31).state = 'open';
    // e. API injoignable : avec l'interrupteur actif, arrêt (aucune V4 demandée pour une panne).
    const panne = await passageRobot({ T, nu, depot: l.depot, url: 'http://127.0.0.1:9', n: 6 });
    assert.equal(panne.voie.voie, 'arret');
    assert.match(panne.voie.voie_motif, /lecture GitHub impossible/);

    // f. La veille constate le passage terminé sans étiquette : chantier ARRÊTÉ de lui-même, texte simple, file d'attente libre.
    etat.runs.filter((r) => r.path.endsWith('robot.yml')).forEach((r) => { r.status = 'completed'; r.conclusion = 'failure'; });
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 31 : livraison echec']);
    const e = etatChantier(lireJournal(ctx).chantier(31));
    assert.equal(e.arrete, true);
    assert.equal(prochaineEtape(e).raison, 'arret');
    const dernier = etat.commentaires.filter((c) => c.ticket === 31).at(-1).body;
    assert.match(dernier, /n'a pas été livrée : un contrôle automatique n'a pas réussi .* Rien n'a été installé, le chantier s'est arrêté de lui-même\. Rien à faire/);
    assert.doesNotMatch(dernier, /Question|Review deployments|Voir le passage du robot/);
    etat.tickets.set(32, { number: 32, state: 'open', title: 'Atelier : suivant', body: 'x', user: { id: PROPRIETAIRE_ID } });
    assert.deepEqual((await veille(ctx, gh)).faits, ['ticket 32 : chantier lancé depuis la file']);
    void consigne;
  } finally {
    serveur.close();
    rmSync(T, { recursive: true, force: true });
  }
});

test('ROBOT : colis E non stricte -> V4 ; voie « auto » forcée -> la livraison recalcule et refuse sans écrire ; colis S -> V4', async () => {
  const { T, nu, base } = preparer();
  const serveur = fauxGithub();
  try {
    const op = join(T, 'op2');
    g(T, 'clone', '-q', nu, op);
    const deposer = (nom, fichiers, version) => {
      const zip = colis({ version, description: `essai ${nom}`, fichiers: Object.entries(fichiers).map(([chemin, t]) => ({ chemin, donnees: Buffer.from(t) })) });
      const ctx = contexte({ GITHUB_REPOSITORY: DEPOT, ATELIER_RACINE: op });
      const depot = commitPlomberie(ctx, { depart: base, fichiers: { [`atelier-ticket-40-v${version}.zip`]: zip }, parents: [base], message: `colis ${nom}` });
      g(op, 'push', '-q', 'origin', `${depot}:refs/heads/livraison/ticket-40-${nom}`);
      return depot;
    };
    // Modifie la capacité déjà livrée (classe E, non stricte).
    const d1 = deposer('1', { 'app/capacites-essai/catalogue.json': CAT_NEUF, 'app/capacites-essai/deja-livree.js': MOD.replace('n-1', 'n-9'), ...FICHIERS_CAP }, '0.66.14');
    const p1 = await passageRobot({ T, nu, depot: d1, url: 'http://127.0.0.1:9', forcerVoie: 'auto', n: 11 });
    assert.deepEqual([p1.inv.classe, p1.inv.e_auto], ['E', 'non']);
    assert.equal(p1.voie.voie, 'v4');
    assert.match(p1.voie.voie_motif, /classe E non stricte : .*seul le module neuf/);
    // Voie « auto » imposée à la livraison malgré l'inventaire (opposition court-circuitée par un faux ticket) : refus sans écriture.
    void p1;
    const forcee = await robot({ T, nu, depot: d1, nom: 'livraison-forcee', script: 'deballer.py', commande: 'livrer', env: {
      ROBOT_DEPOT: d1, ROBOT_VOIE: 'auto', INV_DECISION: 'controler', INV_BASE_SHA: p1.inv.base_sha, INV_ZIP_BLOB: p1.inv.zip_blob, INV_ZIP_SHA256: p1.inv.zip_sha256,
      INV_ARBRE: p1.inv.arbre_attendu, INV_VERSION: p1.inv.version, CTL_VERDICT: 'ok', CTL_ARBRE: p1.inv.arbre_attendu, CTL_APK_SHA256: hache('apk-fictif') } });
    assert.equal(forcee.code, 1);
    assert.match(forcee.resume, /voie automatique : classe E stricte non reproduite par la livraison, rien n'est livré/);
    assert.equal(g(nu, 'rev-parse', 'main'), base);
    // Voie illisible : refus.
    const illisible = await robot({ T, nu, depot: d1, nom: 'livraison-illisible', script: 'deballer.py', commande: 'livrer', env: { ROBOT_DEPOT: d1, ROBOT_VOIE: 'automatique', INV_DECISION: 'controler', INV_BASE_SHA: p1.inv.base_sha, INV_ZIP_BLOB: p1.inv.zip_blob, INV_ZIP_SHA256: p1.inv.zip_sha256, INV_ARBRE: p1.inv.arbre_attendu, INV_VERSION: p1.inv.version, CTL_VERDICT: 'ok', CTL_ARBRE: p1.inv.arbre_attendu } });
    assert.match(illisible.resume, /voie de livraison illisible/);
    // Classe S (fichier cognitif) : V4.
    const d2 = deposer('2', { 'app/capacites-essai/catalogue.json': CAT_NEUF, ...FICHIERS_CAP, 'app/langage/note.js': 'export const n = 1;\n' }, '0.66.14');
    const p2 = await passageRobot({ T, nu, depot: d2, url: 'http://127.0.0.1:9', forcerVoie: 'arret', n: 12 });
    assert.equal(p2.inv.classe, 'S');
    assert.equal(p2.voie.voie, 'v4');
    // La V4 reste la voie normale : un colis E stricte livré par la voie V4 (approbation) passe comme avant.
    const d3 = deposer('3', { 'app/capacites-essai/catalogue.json': CAT_NEUF, ...FICHIERS_CAP }, '0.66.14');
    const p3 = await passageRobot({ T, nu, depot: d3, url: 'http://127.0.0.1:9', forcerVoie: 'v4', n: 13 });
    assert.equal(p3.voie.voie, 'arret', 'API injoignable avec l\'interrupteur actif : la voie automatique s\'arrête');
    assert.equal(p3.livraison.sorties.livre, 'true', p3.livraison.texte);
  } finally {
    serveur.serveur.close();
    rmSync(T, { recursive: true, force: true });
  }
});

// MISE EN SERVICE (GO 26/10 15:42Z) : l'environnement sans réviseur ne peut servir qu'à la voie automatique du robot. Aucun autre workflow
// ne le nomme ni ne lit l'interrupteur ; dans robot.yml, il n'est choisi que par la voie « auto » (classe E stricte, calculée par l'inventaire).
test('environnement livraison-essai et interrupteur : nommés par le seul robot.yml, et seulement pour la voie « auto »', async () => {
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(WF).filter((x) => /\.ya?ml$/.test(x))) {
    const code = sansCommentaires(readFileSync(join(WF, f), 'utf8'));
    if (f === 'robot.yml') continue;
    assert.doesNotMatch(code, /livraison-essai['"\s}]|environment:\s*livraison-essai|LIVRAISON_AUTO_E/, f);
  }
  const code = sansCommentaires(lire('.github/workflows/robot.yml'));
  const envs = [...code.matchAll(/environment:(.*)/g)].map((m) => m[1].trim());
  assert.deepEqual(envs, ["${{ needs.inventaire.outputs.voie == 'auto' && 'livraison-essai' || 'livraison' }}", '']);
  assert.match(code, /environment:\n\s+name: github-pages/);
});
