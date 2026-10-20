// v0.65.10 — AT-8.2 « TÉMOIN À BLANC » (GO 18/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune acquisition de Naissance.
// Mécanique complète de l'UNIQUE appel du témoin, éprouvée CONTRE UN FAUX SERVEUR LOCAL (http://127.0.0.1, port éphémère) : aucune clé
// réelle, aucun secret, aucun hôte distant. node:https.request est remplacé, pour tout ce fichier, par un piège qui compte et refuse :
// il doit rester à 0. Chaque scénario compte les connexions et les requêtes reçues (<= 1), puis attend pour établir qu'aucune requête
// retardée n'arrive. Trois issues : non-emis (refus avant le point d'émission), reponse-connue, issue-inconnue (tout le reste).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import * as AUTO from '../app/atelier/auto.js';
import { canonique, etatDurableDe, lireEtatDurable, ecrireEtatDurable } from '../app/atelier/journal.js';
import { etatBudget, appliquerBudget } from '../app/atelier/budget.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { executer as executerAppel, emettre, CIBLE_ANTHROPIC } from '../outils-atelier/auto-appel.mjs';
import { executer as executerConstat } from '../outils-atelier/auto-constat.mjs';
import { monterEcran, confirmerSauvegarde, BASE } from './atelier-aide.mjs';

const { lireTemoin, corpsTemoin, coutReel, classerObservation, faitsAppel, constater, decisionCloture, lireFaitsAuto, garder, frontiere, nomRun, reponseAttendue, texteTemoin, preparerAppel, NOMS_RUN, BORNES_TEMOIN } = AUTO;
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sansCommentaires = (c) => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const CH = 'temoin-atelier';
const J = 'temoin-1';
const T1 = `${CH}/${J}/1`;
const COMMIT = 'e'.repeat(40);
const RUN = '5000';
const MODELE = 'modele-essai-1';
const CLE = 'cle-essai-locale-0123456789';
const SONDE_OK = { code: 1, sortie: 'HTTP/2.0 403 Forbidden\nContent-Type: application/json\n\n{"message":"Resource not accessible by integration","status":"403"}\ngh: Resource not accessible by integration (HTTP 403)\n' };
const APPROUVE = [{ state: 'approved', comment: '', environments: [{ name: 'atelier-auto' }], user: { login: 'christopheplantegenest-prog' } }];
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const APRES_MS = 1000; // attente après chaque scénario : aucune requête retardée ne doit arriver

// Piège : aucun appel à node:https dans ce fichier (l'hôte réel ne peut être joint par aucun scénario).
const PIEGE = { https: 0 };
const httpsOriginal = https.request;
https.request = (...a) => { PIEGE.https += 1; throw new Error(`node:https interdit dans la recette à blanc (${typeof a[0]})`); };

// ------------------------------------------------------------------------------------------------ chantier témoin (vrais gestes)
async function conduireTemoin(jusqua = 'sauvegardee', { constate = ['0,1', '0,5'], modele = MODELE, maximum } = {}) {
  const a = monterEcran({ version: '0.65.5' });
  await a.cliquer('mode-auto');
  await a.cliquer('temoin');
  a.saisir('sha', BASE);
  await a.cliquer('ouvrir');
  await a.cliquer('ouvrir-cycle');
  await a.cliquer('plafonner');
  await a.cliquer('approuver');
  await a.cliquer('generer');
  await a.cliquer('auto-temoin-reel');
  a.saisir('auto-modele', modele);
  a.saisir('auto-constate-entree', constate[0]);
  a.saisir('auto-constate-sortie', constate[1]);
  if (maximum !== undefined) a.saisir('auto-engagement-saisi', maximum);
  if (jusqua === 'prepare') return a;
  await a.cliquer('lancer-auto');
  if (jusqua === 'lancee') return a;
  await confirmerSauvegarde(a, COMMIT);
  return a;
}
let memo = null;
async function base() { if (!memo) { const a = await conduireTemoin(); memo = a.copie(); } return structuredClone(memo); }
const jetonDe = (copie) => copie.journal.find((e) => e.type === 'tentative-lancee').donnees.temoin.jeton;

// Dossier du job J2 tel que le workflow le dépose ; variables du run.
function dossierJ2(copie, { approbations = APPROUVE, sonde = SONDE_OK } = {}) {
  const texte = canonique(etatDurableDe(copie));
  const d = mkdtempSync(join(tmpdir(), 'atelier-appel-'));
  writeFileSync(join(d, 'tete.txt'), `${COMMIT}\n`);
  writeFileSync(join(d, 'chantier.json'), texte);
  if (approbations) writeFileSync(join(d, 'approbations.json'), JSON.stringify(approbations));
  if (sonde) { writeFileSync(join(d, 'sonde-code.txt'), `${sonde.code}\n`); writeFileSync(join(d, 'sonde-sortie.txt'), sonde.sortie); }
  const env = { ATELIER_CHANTIER: CH, ATELIER_JALON: J, ATELIER_NUMERO: '1', ATELIER_COMMIT: COMMIT, ATELIER_EMPREINTE: hacherSha256(texte), GITHUB_RUN_ID: RUN, GITHUB_RUN_ATTEMPT: '1', GITHUB_WORKFLOW_SHA: 'f'.repeat(40), GITHUB_REF: 'refs/heads/main', GITHUB_STEP_SUMMARY: join(d, 'resume.md') };
  return { d, env, texte };
}

// Faux serveur local instrumenté : connexions et requêtes comptées, corps et en-têtes reçus conservés.
async function fauxServeur(traiter) {
  const vu = { connexions: 0, requetes: 0, corps: [], entetes: [] };
  const sockets = new Set();
  const srv = http.createServer((req, res) => {
    vu.requetes += 1;
    vu.entetes.push(req.headers);
    const m = [];
    req.on('data', (x) => m.push(x));
    req.on('end', () => { vu.corps.push(Buffer.concat(m).toString('utf8')); traiter(req, res, vu); });
  });
  srv.on('connection', (s) => { vu.connexions += 1; sockets.add(s); s.on('close', () => sockets.delete(s)); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const cible = { protocole: 'http:', hote: '127.0.0.1', port: srv.address().port, chemin: '/v1/messages' };
  const fermer = () => new Promise((r) => { sockets.forEach((s) => s.destroy()); srv.close(() => r()); });
  return { vu, cible, fermer };
}
const json = (res, statut, objet, entetes = {}) => { const t = JSON.stringify(objet); res.writeHead(statut, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(t), ...entetes }); res.end(t); };
const message = (jeton, patch = {}) => ({ id: 'msg_essai', type: 'message', role: 'assistant', model: MODELE, content: [{ type: 'text', text: reponseAttendue(jeton) }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 40, output_tokens: 15, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }, ...patch });

// Un scénario complet : dossier J2, faux serveur, executer en mode « essai », attente, comptes, faits relus.
async function scenario(traiter, { copie, env: patchEnv = {}, delaiMs = 2000, cible, mode = 'essai', requete = http.request, dossier = {} } = {}) {
  const c = copie || await base();
  const { d, env } = dossierJ2(c, dossier);
  const s = await fauxServeur(traiter || ((req, res) => json(res, 200, message(jetonDe(c)), { 'request-id': 'req_essai_1' })));
  try {
    const r = await executerAppel({ env: { ...env, ATELIER_TEMOIN_CLE: CLE, ...patchEnv }, dossier: d, mode, cible: cible === undefined ? s.cible : cible, requete, delaiMs });
    await attendre(APRES_MS);
    const ecrit = readFileSync(join(d, 'faits-appel.json'), 'utf8');
    assert.equal(ecrit, r.texte);
    assert.equal(lireFaitsAuto(r.texte).raison, undefined, 'faits relus');
    assert.doesNotMatch(r.texte, new RegExp(CLE));
    assert.doesNotMatch(readFileSync(join(d, 'resume.md'), 'utf8'), new RegExp(CLE));
    return { r, f: r.faits, vu: s.vu, copie: c };
  } finally { await s.fermer(); rmSync(d, { recursive: true, force: true }); }
}
const decision = (f) => decisionCloture({ faits: f, t: T1, temoin: true });

// ------------------------------------------------------------------------------------------------ fonctions pures
test('témoin : jeton 32 hexadécimaux, tarifs constatés <= plafonds, sortie <= 64, entrée max >= 1000 ; corps exact et minimal', () => {
  const appel = { modele: MODELE, entree_max: 1000, max_tokens: 64, tarif_entree: 500000, tarif_sortie: 2500000, appels: 1 };
  const t = { jeton: 'a'.repeat(32), tarif_entree: 100000, tarif_sortie: 500000 };
  assert.deepEqual({ ...lireTemoin(t, appel) }, t);
  assert.equal(AUTO.estimationMax(appel), 660);
  for (const x of [{ ...t, jeton: 'A'.repeat(32) }, { ...t, jeton: 'a'.repeat(31) }, { ...t, tarif_entree: 500001 }, { ...t, tarif_sortie: 0 }, { ...t, extra: 1 }, (({ jeton, ...r }) => r)(t), null]) assert.equal(lireTemoin(x, appel).raison, 'temoin-invalide', JSON.stringify(x));
  assert.equal(lireTemoin(t, { ...appel, max_tokens: 65 }).raison, 'temoin-hors-bornes');
  assert.equal(lireTemoin(t, { ...appel, entree_max: 999 }).raison, 'temoin-hors-bornes');
  assert.equal(lireTemoin(t, { ...appel, appels: 2 }).raison, 'appels-different-de-1');
  const c = corpsTemoin(appel, t);
  assert.equal(c.corps, `{"model":"${MODELE}","max_tokens":64,"thinking":{"type":"disabled"},"messages":[{"role":"user","content":"Reply with exactly this line and nothing else: ATELIER-TEMOIN-OK ${'a'.repeat(32)}"}]}`);
  assert.equal(c.octets, Buffer.byteLength(c.corps));
  assert.ok(c.octets <= BORNES_TEMOIN.corps_octets);
  assert.equal(c.empreinte, hacherSha256(c.corps));
  assert.deepEqual(Object.keys(JSON.parse(c.corps)).sort(), ['max_tokens', 'messages', 'model', 'thinking']); // ni system, ni tools, ni stream, ni metadata
  assert.equal(texteTemoin('b'.repeat(32)), `Reply with exactly this line and nothing else: ATELIER-TEMOIN-OK ${'b'.repeat(32)}`);
  assert.throws(() => corpsTemoin(appel, { ...t, jeton: 'x' }), TypeError);
});
test('coût réel : usage x tarifs constatés, arrondi au microdollar supérieur ; usage absent, invalide, avec cache ou hors bornes : aucun coût', () => {
  const appel = { modele: MODELE, entree_max: 1000, max_tokens: 64, tarif_entree: 500000, tarif_sortie: 2500000, appels: 1 };
  const t = { jeton: 'a'.repeat(32), tarif_entree: 100000, tarif_sortie: 500000 };
  assert.deepEqual({ ...coutReel({ input_tokens: 40, output_tokens: 15 }, appel, t) }, { entree: 40, sortie: 15, montant: 4 + 8 });
  assert.equal(coutReel({ input_tokens: 0, output_tokens: 0, cache_read_input_tokens: null }, appel, t).montant, 0);
  assert.equal(coutReel({ input_tokens: 1, output_tokens: 1 }, appel, t).montant, 2); // 0,1 et 0,5 microdollar : arrondis à 1 chacun
  assert.equal(coutReel({ input_tokens: 1000, output_tokens: 64 }, appel, t).montant, 100 + 32);
  assert.equal(coutReel(undefined, appel, t).raison, 'usage-absent');
  for (const u of [{ input_tokens: -1, output_tokens: 1 }, { input_tokens: 1.5, output_tokens: 1 }, { output_tokens: 1 }, { input_tokens: '4', output_tokens: 1 }]) assert.equal(coutReel(u, appel, t).raison, 'usage-invalide', JSON.stringify(u));
  assert.equal(coutReel({ input_tokens: 4, output_tokens: 1, cache_read_input_tokens: 3 }, appel, t).raison, 'usage-cache-inattendu');
  assert.equal(coutReel({ input_tokens: 4, output_tokens: 1, cache_creation_input_tokens: 1 }, appel, t).raison, 'usage-cache-inattendu');
  assert.equal(coutReel({ input_tokens: 1001, output_tokens: 1 }, appel, t).raison, 'usage-hors-bornes');
  assert.equal(coutReel({ input_tokens: 1, output_tokens: 65 }, appel, t).raison, 'usage-hors-bornes');
});
test('point d\'émission franchi : jamais non-emis ; non franchi : toujours non-emis, sans réponse ni coût (faitsAppel)', async () => {
  const c = await base();
  const { d, env } = dossierJ2(c);
  try {
    const entrees = { chantier: CH, jalon: J, numero: '1', commit: COMMIT, empreinte: env.ATELIER_EMPREINTE };
    const contexte = { run_id: RUN, run_attempt: '1', workflow_sha: 'f'.repeat(40), ref: 'refs/heads/main' };
    const prep = preparerAppel({ entrees, contexte, journal: { tete: COMMIT, texte: canonique(etatDurableDe(c)) }, approbations: APPROUVE, sonde: SONDE_OK });
    assert.equal(prep.emettre, true);
    const connu = classerObservation({ echec: null, statut: 200, request_id: 'r1', corps: JSON.stringify(message(jetonDe(c))), complet: true }, prep);
    assert.equal(connu.issue, 'reponse-connue');
    const vrai = { point_franchi: true, socket_connecte: true };
    const faux = { point_franchi: false, socket_connecte: false };
    assert.equal(faitsAppel({ entrees, contexte, prep, emission: vrai, resultat: { issue: 'non-emis', raison: 'x' } }).faits.issue, 'issue-inconnue');
    assert.equal(faitsAppel({ entrees, contexte, prep, emission: vrai, resultat: undefined }).faits.issue, 'issue-inconnue');
    assert.equal(faitsAppel({ entrees, contexte, prep, emission: vrai, resultat: connu }).faits.issue, 'reponse-connue');
    const nf = faitsAppel({ entrees, contexte, prep, emission: faux, resultat: connu }).faits;
    assert.deepEqual([nf.issue, nf.appel_emis, nf.reponse, nf.cout], ['non-emis', false, null, null]);
    assert.equal(faitsAppel({ entrees, contexte, prep, emission: undefined, resultat: connu }).faits.issue, 'non-emis');
    // classement : toute observation douteuse est issue-inconnue
    for (const [obs, raison] of [[null, 'observation-illisible'], [{ echec: 'delai-depasse' }, 'delai-depasse'], [{ echec: 'X Y' }, 'echec-transport'], [{ statut: 200, complet: false, corps: '{}' }, 'reponse-tronquee'],
      [{ statut: null, complet: true, corps: '{}' }, 'reponse-tronquee'], [{ statut: 200, complet: true, corps: '[' }, 'json-illisible'], [{ statut: 200, complet: true, corps: '[]' }, 'json-illisible'],
      [{ statut: 200, complet: true, corps: JSON.stringify({ type: 'error' }) }, 'message-invalide'], [{ statut: 200, complet: true, corps: JSON.stringify(message(jetonDe(c), { model: 'autre-modele' })) }, 'modele-different']]) {
      const r = classerObservation(obs, prep);
      assert.deepEqual([r.issue, r.raison, r.cout], ['issue-inconnue', raison, null], JSON.stringify(obs));
    }
    assert.equal(classerObservation({ statut: 200, complet: true, corps: '{}' }, { ...prep, emettre: false }).raison, 'observation-illisible');
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------------------------------------ faux serveur : scénarios A à J
describe('faux serveur local : au plus UNE requête par scénario, aucune requête retardée', { concurrency: true }, () => {
  test('A. succès : une requête exactement, corps exact, en-têtes attendus ; reponse-connue ; coût calculé ; clé absente des faits', async () => {
    const { r, f, vu, copie } = await scenario();
    assert.deepEqual([vu.connexions, vu.requetes], [1, 1]);
    assert.deepEqual([r.code, r.ligne, f.issue, f.raison, f.appel_emis, f.emission.point_franchi, f.emission.socket_connecte], [0, 'REPONSE-CONNUE', 'reponse-connue', null, true, true, true]);
    const attendu = corpsTemoin(lireEtatDurable(canonique(etatDurableDe(copie))).durable.journal.find((e) => e.type === 'tentative-lancee').donnees.appel, copie.journal.find((e) => e.type === 'tentative-lancee').donnees.temoin);
    assert.equal(vu.corps[0], attendu.corps);
    assert.deepEqual([f.requete.corps_empreinte, f.requete.corps_octets, f.requete.modele, f.requete.max_tokens], [attendu.empreinte, attendu.octets, MODELE, 64]);
    assert.deepEqual([vu.entetes[0]['x-api-key'], vu.entetes[0]['anthropic-version'], vu.entetes[0]['content-type'], vu.entetes[0].connection], [CLE, '2023-06-01', 'application/json', 'close']);
    assert.doesNotMatch(vu.corps[0], new RegExp(`${CH}|${COMMIT}|journal|chantier|${CLE}`)); // aucune donnée du chantier, aucune clé dans le corps
    assert.deepEqual({ ...f.reponse, usage: { ...f.reponse.usage } }, { statut: 200, request_id: 'req_essai_1', type_erreur: null, modele: MODELE, stop_reason: 'end_turn', usage: { entree: 40, sortie: 15 }, texte_octets: 50, texte_empreinte: hacherSha256(reponseAttendue(jetonDe(copie))), temoin_conforme: true });
    assert.deepEqual({ ...f.cout }, { montant: 12, tarif_entree: 100000, tarif_sortie: 500000 });
    assert.deepEqual(decision(f), { issue: 'reponse-connue', montant: 12 });
  });
  test('B. refus avant émission : non-emis, 0 connexion, 0 requête, coût 0 permis (frontière, clé, cible, mode, délai, essai, témoin)', async () => {
    const sansTemoin = structuredClone(await base());
    delete sansTemoin.journal.find((e) => e.type === 'tentative-lancee').donnees.temoin;
    const cas = [
      [{ dossier: { approbations: null } }, 'approbation-illisible'],
      [{ dossier: { approbations: [] } }, 'approbation-absente'],
      [{ dossier: { sonde: { code: 0, sortie: 'HTTP/2.0 201 Created\n' } } }, 'sonde-ecriture-acceptee'],
      [{ env: { ATELIER_TEMOIN_CLE: '' } }, 'cle-absente'],
      [{ env: { ATELIER_TEMOIN_CLE: 'cle avec espace' } }, 'cle-invalide'],
      [{ cible: { protocole: 'http:', hote: '10.0.0.1', port: 80, chemin: '/v1/messages' } }, 'cible-refusee'],
      [{ cible: CIBLE_ANTHROPIC }, 'cible-refusee'],
      [{ mode: 'reel' }, 'cible-refusee'],
      [{ mode: 'reel', cible: CIBLE_ANTHROPIC, requete: http.request }, 'cible-refusee'],
      [{ mode: 'aucun' }, 'appel-reel-non-active'],
      [{ delaiMs: 0 }, 'delai-invalide'],
      [{ delaiMs: 60001 }, 'delai-invalide'],
      [{ env: { GITHUB_RUN_ATTEMPT: '2' } }, 'essai-different-de-1'],
      [{ env: { GITHUB_REF: 'refs/heads/autre' } }, 'ref-non-main'],
      [{ copie: sansTemoin }, 'temoin-absent'],
    ];
    const resultats = await Promise.all(cas.map(([o]) => scenario(undefined, o)));
    resultats.forEach(({ r, f, vu }, i) => {
      const raison = cas[i][1];
      assert.deepEqual([vu.connexions, vu.requetes, f.issue, f.raison, f.appel_emis, f.emission.point_franchi, f.reponse, f.cout, r.code], [0, 0, 'non-emis', raison, false, false, null, null, 1], raison);
      // des faits d'un autre essai ou hors de main ne prouvent rien pour T : refusés à la clôture
      assert.deepEqual(decision(f), ['essai-different-de-1', 'ref-non-main'].includes(raison) ? { raison: 'hors-premier-essai' } : { issue: 'non-emis', montant: 0 }, raison);
    });
  });
  test('B bis. tentative sans témoin (AT-8.1) : non-emis « temoin-absent », aucune requête', async () => {
    const a = await conduireTemoin('prepare');
    await a.cliquer('auto-sans-temoin');
    a.saisir('auto-modele', MODELE);
    await a.cliquer('lancer-auto');
    await confirmerSauvegarde(a, COMMIT);
    const c = a.copie();
    assert.equal(Object.hasOwn(c.journal.find((e) => e.type === 'tentative-lancee').donnees, 'temoin'), false);
    const { f, vu } = await scenario(undefined, { copie: c });
    assert.deepEqual([vu.requetes, f.issue, f.raison], [0, 'non-emis', 'temoin-absent']);
  });
  test('C. connexion impossible (port fermé) : issue-inconnue « connexion-impossible » (point franchi), jamais coût 0 ; 0 requête reçue', async () => {
    const s = await fauxServeur(() => {});
    const ferme = { ...s.cible };
    await s.fermer();
    const { f, vu } = await scenario(undefined, { cible: ferme });
    assert.deepEqual([vu.requetes, f.issue, f.raison, f.appel_emis, f.emission.socket_connecte, f.cout], [0, 'issue-inconnue', 'connexion-impossible', true, false, null]);
    assert.deepEqual(decision(f), { issue: 'issue-inconnue', montant: null });
  });
  test('D. connexion coupée après la requête : issue-inconnue, une requête, jamais coût 0', async () => {
    const { f, vu } = await scenario((req) => req.socket.destroy());
    assert.deepEqual([vu.connexions, vu.requetes, f.issue, f.raison, f.emission.socket_connecte, f.cout], [1, 1, 'issue-inconnue', 'connexion-coupee', true, null]);
    assert.equal(decision(f).montant, null);
  });
  test('E. délai dépassé (serveur muet) : issue-inconnue « delai-depasse », une requête au plus, aucune requête après l\'attente', async () => {
    const { f, vu } = await scenario(() => {}, { delaiMs: 200 });
    assert.deepEqual([vu.connexions, vu.requetes, f.issue, f.raison, f.cout], [1, 1, 'issue-inconnue', 'delai-depasse', null]);
  });
  test('F. réponse tronquée, trop longue ou JSON illisible : issue-inconnue (le statut connu est cité, le coût ne l\'est pas)', async () => {
    const [tronque, illisible, long] = await Promise.all([
      scenario((req, res) => { res.writeHead(200, { 'content-type': 'application/json', 'content-length': 1000 }); res.write('{"type":"mess'); setTimeout(() => res.socket.destroy(), 50); }),
      scenario((req, res) => { res.writeHead(200, { 'content-type': 'application/json', 'request-id': 'req_f2' }); res.end('pas du json'); }),
      scenario((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('x'.repeat(BORNES_TEMOIN.reponse_octets + 10)); }),
    ]);
    assert.deepEqual([tronque.vu.requetes, tronque.f.issue, tronque.f.cout], [1, 'issue-inconnue', null]);
    assert.ok(['reponse-tronquee', 'connexion-coupee'].includes(tronque.f.raison), tronque.f.raison);
    assert.equal(tronque.f.reponse.statut, 200);
    assert.deepEqual([illisible.vu.requetes, illisible.f.issue, illisible.f.raison, illisible.f.reponse.request_id], [1, 'issue-inconnue', 'json-illisible', 'req_f2']);
    assert.deepEqual([long.vu.requetes, long.f.issue, long.f.raison], [1, 'issue-inconnue', 'reponse-trop-longue']);
  });
  test('G. JSON valide mais usage absent, invalide, avec cache ou hors bornes : issue-inconnue, aucun coût inventé', async () => {
    const c = await base();
    const j = jetonDe(c);
    const cas = [[{ usage: undefined }, 'usage-absent'], [{ usage: { input_tokens: -1, output_tokens: 2 } }, 'usage-invalide'], [{ usage: { input_tokens: 4, output_tokens: 2, cache_read_input_tokens: 7 } }, 'usage-cache-inattendu'], [{ usage: { input_tokens: 4, output_tokens: 65 } }, 'usage-hors-bornes']];
    const r = await Promise.all(cas.map(([p]) => scenario((req, res) => json(res, 200, message(j, p)), { copie: c })));
    r.forEach(({ f, vu }, i) => {
      assert.deepEqual([vu.requetes, f.issue, f.raison, f.cout, f.reponse.statut], [1, 'issue-inconnue', cas[i][1], null, 200], cas[i][1]);
      assert.deepEqual(decision(f), { issue: 'issue-inconnue', montant: null });
    });
  });
  test('H. mauvais jeton, texte en plus, arrêt sur max_tokens : réponse connue (coût calculé) mais témoin NON réussi', async () => {
    const c = await base();
    const j = jetonDe(c);
    const cas = [{ content: [{ type: 'text', text: reponseAttendue('0'.repeat(32)) }] }, { content: [{ type: 'text', text: `${reponseAttendue(j)} merci` }] }, { stop_reason: 'max_tokens' }, { content: [] }];
    const r = await Promise.all(cas.map((p) => scenario((req, res) => json(res, 200, message(j, p)), { copie: c })));
    r.forEach(({ r: x, f, vu }) => {
      assert.deepEqual([vu.requetes, f.issue, f.raison, f.reponse.temoin_conforme, f.cout.montant, x.code], [1, 'reponse-connue', 'temoin-non-conforme', false, 12, 1]);
    });
  });
  test('I. erreurs HTTP : statut, type et identifiant connus ; coût NON établi => issue-inconnue ; une requête, aucune relance, pas de redirection suivie', async () => {
    const cas = [[400, 'invalid_request_error'], [401, 'authentication_error'], [402, 'billing_error'], [429, 'rate_limit_error'], [500, 'api_error'], [529, 'overloaded_error']];
    const r = await Promise.all(cas.map(([s, t]) => scenario((req, res) => json(res, s, { type: 'error', error: { type: t, message: 'essai' }, request_id: `req_${s}` }, s === 429 ? { 'retry-after': '1' } : {}))));
    r.forEach(({ f, vu }, i) => {
      assert.deepEqual([vu.connexions, vu.requetes, f.issue, f.raison, f.reponse.statut, f.reponse.type_erreur, f.reponse.request_id, f.cout], [1, 1, 'issue-inconnue', 'erreur-http', cas[i][0], cas[i][1], `req_${cas[i][0]}`, null], String(cas[i][0]));
    });
    const red = await scenario((req, res) => { if (req.url === '/v1/messages') { res.writeHead(307, { location: '/ailleurs', 'content-length': 0 }); res.end(); } else json(res, 200, {}); });
    assert.deepEqual([red.vu.requetes, red.f.issue, red.f.raison, red.f.reponse.statut], [1, 'issue-inconnue', 'json-illisible', 307]);
  });
  test('J. exception à chaque frontière : avant le point (non-emis), à l\'invocation (issue-inconnue, une invocation), pendant la réponse', async () => {
    let invocations = 0;
    const jette = () => { invocations += 1; throw new Error('panne simulée'); };
    const a = await scenario(undefined, { requete: jette });
    assert.deepEqual([invocations, a.vu.requetes, a.f.issue, a.f.raison, a.f.appel_emis], [1, 0, 'issue-inconnue', 'exception-requete', true]);
    let inv2 = 0;
    const erreurApres = (opts, rappel) => { inv2 += 1; return http.request(opts, (res) => { rappel(res); res.emit('error', new Error('panne')); }); };
    const b = await scenario((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.write('{'); }, { requete: erreurApres });
    assert.deepEqual([inv2, b.vu.requetes, b.f.issue], [1, 1, 'issue-inconnue']);
    // avant le point : journal illisible (exception de lecture rattrapée par la frontière) => non-emis, aucune invocation
    let inv3 = 0;
    const compte = (...x) => { inv3 += 1; return http.request(...x); };
    const c = structuredClone(await base());
    const { d, env } = dossierJ2(c);
    try {
      writeFileSync(join(d, 'chantier.json'), '{');
      const r = await executerAppel({ env: { ...env, ATELIER_TEMOIN_CLE: CLE }, dossier: d, mode: 'essai', cible: { protocole: 'http:', hote: '127.0.0.1', port: 9, chemin: '/v1/messages' }, requete: compte, delaiMs: 500 });
      assert.deepEqual([inv3, r.faits.issue, r.faits.raison], [0, 'non-emis', 'empreinte-differente']);
    } finally { rmSync(d, { recursive: true, force: true }); }
  });
  test('K. une réponse qui renverrait la clé (identifiant de requête) : faits retenus, issue-inconnue, la clé n\'est écrite nulle part', async () => {
    const { f, vu } = await scenario((req, res) => json(res, 200, message('0'.repeat(32)), { 'request-id': CLE }));
    assert.deepEqual([vu.requetes, f.issue, f.raison, f.reponse, f.cout], [1, 'issue-inconnue', 'faits-retenus', null, null]);
  });
});

test('garde et préparation : un témoin invalide dans le journal est refusé dès J1 (temoin-invalide), avant toute requête', async () => {
  const c = structuredClone(await base());
  c.journal.find((e) => e.type === 'tentative-lancee').donnees.temoin.jeton = 'XYZ';
  const texte = canonique(etatDurableDe(c));
  const entrees = { chantier: CH, jalon: J, numero: '1', commit: COMMIT, empreinte: hacherSha256(texte) };
  const contexte = { run_id: RUN, run_attempt: '1', workflow_sha: 'f'.repeat(40), ref: 'refs/heads/main' };
  const historique = { total: 1, runs: [{ id: 5000, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' }] };
  const g = garder({ entrees, contexte, historique, journal: { tete: COMMIT, texte } });
  assert.deepEqual([g.autorise, g.raison], [false, 'temoin-invalide']);
  assert.deepEqual(decisionCloture({ faits: g.faits, t: T1, temoin: true }), { issue: 'non-emis', montant: 0 });
  const p = preparerAppel({ entrees, contexte, journal: { tete: COMMIT, texte }, approbations: APPROUVE, sonde: SONDE_OK });
  assert.deepEqual([p.emettre, p.raison], [false, 'temoin-invalide']);
});

test('emettre : UNE invocation de requete quoi qu\'il arrive ; plusieurs événements de fin => un seul résultat', async () => {
  let n = 0;
  const s = await fauxServeur((req, res) => json(res, 200, { ok: true }));
  try {
    const obs = await emettre({ requete: (...x) => { n += 1; const r = http.request(...x); r.on('response', () => { r.emit('error', Object.assign(new Error('x'), { code: 'ECONNRESET' })); }); return r; }, cible: s.cible, cle: CLE, corps: '{}', delaiMs: 1000 });
    await attendre(300);
    assert.equal(n, 1);
    assert.equal(s.vu.requetes, 1);
    assert.equal(typeof obs, 'object');
  } finally { await s.fermer(); }
});

// ------------------------------------------------------------------------------------------------ décision de clôture
test('clôture : témoin => coût 0 seulement si les faits PROUVENT l\'absence d\'émission pour T ; faits intermédiaires ou autre essai refusés', async () => {
  const c = await base();
  const texte = canonique(etatDurableDe(c));
  const entrees = { chantier: CH, jalon: J, numero: '1', commit: COMMIT, empreinte: hacherSha256(texte) };
  const contexte = (n = '1') => ({ run_id: RUN, run_attempt: n, workflow_sha: 'f'.repeat(40), ref: 'refs/heads/main' });
  const runs = (extra = []) => ({ total: 1 + extra.length, runs: [{ id: 5000, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T16:00:00Z' }, ...extra] });
  const g = (patch) => garder({ entrees: { ...entrees, ...patch.entrees }, contexte: patch.contexte || contexte(), historique: patch.historique || runs(), journal: patch.journal || { tete: COMMIT, texte } }).faits;
  const autorise = g({});
  assert.equal(autorise.resultat, 'autorise');
  assert.deepEqual(decisionCloture({ faits: autorise, t: T1, temoin: true }), { raison: 'faits-intermediaires' });
  assert.deepEqual(decisionCloture({ faits: autorise, t: T1, temoin: false }), { issue: 'non-emis', montant: 0 }); // AT-8.1 inchangé
  const anterieure = g({ historique: runs([{ id: 4000, display_title: nomRun(T1), run_attempt: 1, created_at: '2026-10-17T15:59:00Z' }]) });
  assert.equal(anterieure.raison, 'execution-anterieure');
  assert.deepEqual(decisionCloture({ faits: anterieure, t: T1, temoin: true }), { raison: 'faits-intermediaires' }); // un run antérieur a PU émettre
  assert.deepEqual(decisionCloture({ faits: g({ contexte: contexte('2') }), t: T1, temoin: true }), { raison: 'faits-intermediaires' });
  assert.deepEqual(decisionCloture({ faits: g({ entrees: { commit: 'd'.repeat(40) } }), t: T1, temoin: true }), { issue: 'non-emis', montant: 0 }); // refus après l'historique
  const f = (args) => frontiere({ entrees, contexte: contexte(), journal: { tete: COMMIT, texte }, approbations: APPROUVE, sonde: SONDE_OK, ...args }).faits;
  assert.deepEqual(decisionCloture({ faits: f({}), t: T1, temoin: true }), { raison: 'faits-intermediaires' });
  assert.deepEqual(decisionCloture({ faits: f({ approbations: [] }), t: T1, temoin: true }), { issue: 'non-emis', montant: 0 });
  assert.deepEqual(decisionCloture({ faits: f({ approbations: [], contexte: contexte('2') }), t: T1, temoin: true }), { raison: 'faits-intermediaires' });
  assert.deepEqual(decisionCloture({ faits: autorise, t: `${CH}/${J}/2`, temoin: true }), { raison: 'faits-autre-tentative' });
  // faits -2 d'un autre essai : refusés, même non-emis
  const prep = { emettre: false, raison: 'essai-different-de-1', id: AUTO.identiteT({ chantier: CH, jalon: J, numero: 1 }) };
  const ne2 = faitsAppel({ entrees, contexte: contexte('2'), prep, emission: { point_franchi: false } }).faits;
  assert.deepEqual(decisionCloture({ faits: ne2, t: T1, temoin: true }), { raison: 'hors-premier-essai' });
});

// ------------------------------------------------------------------------------------------------ constat J3
test('constat J3 : non-emis seulement si J1 a réussi ET J2 ou son étape d\'appel est sautée ; garde refusée : sans objet ; sinon issue-inconnue', () => {
  const entrees = { chantier: CH, jalon: J, numero: '1', commit: COMMIT, empreinte: 'a'.repeat(64) };
  const contexte = { run_id: RUN, run_attempt: '1', workflow_sha: 'f'.repeat(40), ref: 'refs/heads/main' };
  const j1 = (conclusion = 'success') => ({ name: NOMS_RUN.garde, status: 'completed', conclusion, steps: [] });
  const j2 = (status, conclusion, etape) => ({ name: NOMS_RUN.appel, status, conclusion, steps: etape ? [{ name: 'Frontière', status: 'completed', conclusion: 'success' }, { name: NOMS_RUN.etape, ...etape }] : [] });
  const c = (jobs, ctx = contexte) => { const r = constater({ entrees, contexte: ctx, jobs }); assert.equal(lireFaitsAuto(r.texte).raison, undefined); return [r.faits.issue, r.faits.raison]; };
  assert.deepEqual(c([j1(), j2('completed', 'failure', { status: 'completed', conclusion: 'skipped' })]), ['non-emis', 'etape-appel-sautee']);
  assert.deepEqual(c([j1(), j2('completed', 'skipped')]), ['non-emis', 'job-appel-saute']);
  assert.deepEqual(c([j1('failure'), j2('completed', 'skipped')]), [null, 'garde-non-franchie']);
  assert.deepEqual(c([j1(), j2('completed', 'failure', { status: 'completed', conclusion: 'failure' })]), ['issue-inconnue', 'appel-execute-voir-faits-j2']);
  assert.deepEqual(c([j1(), j2('completed', 'success', { status: 'completed', conclusion: 'success' })]), ['issue-inconnue', 'appel-execute-voir-faits-j2']);
  assert.deepEqual(c([j1(), j2('completed', 'failure', { status: 'in_progress', conclusion: null })]), ['issue-inconnue', 'etat-appel-incertain']); // runner perdu pendant l'appel
  assert.deepEqual(c([j1(), j2('completed', 'failure')]), ['issue-inconnue', 'etat-appel-incertain']); // étapes absentes (environnement refusé, runner perdu)
  assert.deepEqual(c([j1(), j2('in_progress', null, { status: 'completed', conclusion: 'skipped' })]), ['issue-inconnue', 'etat-appel-incertain']);
  assert.deepEqual(c([j1()]), ['issue-inconnue', 'job-appel-absent']);
  assert.deepEqual(c([j2('completed', 'skipped')]), ['issue-inconnue', 'job-garde-absent']);
  assert.deepEqual(c(null), ['issue-inconnue', 'jobs-illisibles']);
  assert.deepEqual(c([j1(), j1(), j2('completed', 'skipped')]), ['issue-inconnue', 'job-garde-absent']); // doublon : ambigu
  assert.deepEqual(c([j1(), j2('completed', 'skipped')], { ...contexte, run_attempt: '2' }), [null, 'essai-different-de-1']);
  const sans = constater({ entrees, contexte, jobs: [j1(), j2('completed', 'skipped')] }).faits;
  assert.deepEqual([sans.appel_emis, sans.cout, sans.reponse, sans.etape], [false, null, null, 'constat']);
  assert.deepEqual(decisionCloture({ faits: sans, t: T1, temoin: true }), { issue: 'non-emis', montant: 0 });
  const nul = constater({ entrees, contexte, jobs: [j1('failure')] }).faits;
  assert.deepEqual(decisionCloture({ faits: nul, t: T1, temoin: true }), { raison: 'constat-sans-objet' });
});
test('faits atelier-auto-faits-2 : relecture stricte (empreinte, clés, cohérence issue / émission / coût)', async () => {
  const { f } = await scenario();
  const re = (patch) => { const { empreinte, ...sans } = { ...f, ...patch }; return canonique({ ...sans, empreinte: hacherSha256(canonique(sans)) }); };
  assert.equal(lireFaitsAuto(canonique(f)).raison, undefined);
  assert.match(lireFaitsAuto(canonique(f).replace('"reponse-connue"', '"non-emis"')).raison, /empreinte/);
  assert.equal(lireFaitsAuto(re({ issue: 'non-emis' })).raison, 'issue-incoherente');
  assert.equal(lireFaitsAuto(re({ issue: 'issue-inconnue' })).raison, 'issue-incoherente'); // coût présent
  assert.equal(lireFaitsAuto(re({ issue: 'issue-inconnue', cout: null, appel_emis: false })).raison, 'issue-incoherente');
  assert.equal(lireFaitsAuto(re({ appel_emis: false })).raison, 'issue-incoherente');
  assert.equal(lireFaitsAuto(re({ cout: { montant: -1 } })).raison, 'issue-incoherente');
  assert.equal(lireFaitsAuto(re({ issue: 'autre' })).raison, 'issue inconnue');
  assert.equal(lireFaitsAuto(re({ issue: null })).raison, 'issue absente');
  assert.equal(lireFaitsAuto(re({ etape: 'garde' })).raison, 'étape ou résultat inconnu');
  assert.equal(lireFaitsAuto(re({ tentative: 'a/b' })).raison, 'tentative illisible');
  assert.equal(lireFaitsAuto(re({ extra: 1 })).raison, 'clés des faits inattendues');
});

// ------------------------------------------------------------------------------------------------ outils en ligne de commande
test('CLI auto-appel : --preparer (aucune requête), sans mode (non-emis), --reel sans clé (non-emis « cle-absente ») ; CLI auto-constat', async () => {
  const c = await base();
  const { d, env } = dossierJ2(c);
  try {
    const propre = { PATH: process.env.PATH, ...env, GITHUB_STEP_SUMMARY: '' }; // aucune ATELIER_TEMOIN_CLE
    const lancer = (...args) => spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-appel.mjs'), '--dossier', d, ...args], { env: propre, encoding: 'utf8' });
    const p = lancer('--preparer');
    assert.deepEqual([p.status, p.stdout], [0, 'PREPARATION_OK\n']);
    const sans = lancer();
    assert.deepEqual([sans.status, sans.stdout], [1, 'NON-EMIS appel-reel-non-active\n']);
    const reel = lancer('--reel');
    assert.deepEqual([reel.status, reel.stdout], [1, 'NON-EMIS cle-absente\n']);
    assert.equal(JSON.parse(readFileSync(join(d, 'faits-appel.json'), 'utf8')).emission.point_franchi, false);
    writeFileSync(join(d, 'approbations.json'), '[]');
    assert.deepEqual([lancer('--preparer').status, lancer('--preparer').stdout], [1, 'ARRET approbation-absente\n']);
    writeFileSync(join(d, 'jobs.json'), JSON.stringify([{ name: NOMS_RUN.garde, status: 'completed', conclusion: 'success', steps: [] }, { name: NOMS_RUN.appel, status: 'completed', conclusion: 'failure', steps: [{ name: NOMS_RUN.etape, status: 'completed', conclusion: 'skipped' }] }]));
    const k = spawnSync(process.execPath, [join(RACINE, 'outils-atelier', 'auto-constat.mjs'), '--dossier', d], { env: propre, encoding: 'utf8' });
    assert.deepEqual([k.status, k.stdout], [0, 'NON-EMIS etape-appel-sautee\n']);
    writeFileSync(join(d, 'jobs.json'), '{');
    const resume = join(d, 'r.md');
    const k2 = executerConstat({ env: { ...env, GITHUB_STEP_SUMMARY: resume }, dossier: d });
    assert.deepEqual([k2.code, k2.faits.issue], [1, 'issue-inconnue']);
    assert.match(readFileSync(resume, 'utf8'), /ISSUE INCONNUE : un appel a pu avoir lieu/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------------------------------------ téléphone
test('écran : préparer le témoin réel => jeton 128 bits tiré sur l\'appareil, modèle et tarifs constatés à saisir ; lancement = témoin + engagement saisi', async () => {
  const a = await conduireTemoin('prepare');
  const ft = a.copie().formulaire.temoin;
  assert.match(ft.jeton, /^[0-9a-f]{32}$/);
  assert.equal(a.copie().formulaire.auto.modele, MODELE);
  await a.cliquer('auto-nouveau-jeton');
  assert.notEqual(a.copie().formulaire.temoin.jeton, ft.jeton);
  assert.match(a.un('auto-estimation').textContent, /: 0,00066 USD — appels autorisés : 1\.$/);
  await a.cliquer('lancer-auto');
  const c = a.copie();
  const ev = c.journal.at(-1);
  assert.deepEqual(ev.donnees, { jalon: J, mode: 'AUTO', appel: { modele: MODELE, entree_max: 1000, max_tokens: 64, tarif_entree: 500000, tarif_sortie: 2500000, appels: 1 }, temoin: { jeton: c.formulaire.temoin.jeton, tarif_entree: 100000, tarif_sortie: 500000 } });
  assert.deepEqual(c.registre.at(-1).donnees, { execution: T1, chantier: CH, maximum: 1000 });
  assert.match(a.un('auto-temoin-lance').textContent, /UN appel au plus/);
  assert.match(a.un('auto-bandeau').textContent, /TÉMOIN RÉEL/);
  await confirmerSauvegarde(a, COMMIT);
  await a.cliquer('copier-demande-auto');
  assert.match(a.copies.at(-1), /^DEMANDE AUTO AVEC TÉMOIN RÉEL/);
  assert.match(a.copies.at(-1), /UNE requête de témoin au plus/);
  assert.deepEqual({ ...AUTO.lireDemandeAuto(a.copies.at(-1)).demande }.t, T1);
});
test('écran : témoin refusé si tarif constaté > plafond, engagement < estimation, sortie > 64 ; rien n\'est écrit', async () => {
  for (const [o, attendu] of [[{ constate: ['0,6', '0,5'] }, /témoin refusé \(temoin-invalide\)/], [{ maximum: '0,0006' }, /engagement 0,0006 USD inférieur/], [{ constate: ['', '0,5'] }, /Tarif constaté d'entrée/]]) {
    const a = await conduireTemoin('prepare', o);
    const n = a.stockage.ecritures;
    await a.cliquer('lancer-auto');
    assert.match(a.un('message').textContent, attendu);
    assert.equal(a.stockage.ecritures, n);
  }
  const a = await conduireTemoin('prepare');
  a.saisir('auto-max-tokens', '65');
  await a.cliquer('lancer-auto');
  assert.match(a.un('message').textContent, /temoin-hors-bornes/);
});
test('écran : les trois issues sont distinctes ; ISSUE INCONNUE n\'inscrit aucun coût, bloque tout lancement AUTO, exige une régularisation > 0', async () => {
  // RÉPONSE CONNUE
  const { r: connu } = await scenario();
  let a = await conduireTemoin();
  a.saisir('faits-auto', connu.texte);
  a.saisir('motif-auto', 'Témoin : réponse connue.');
  assert.equal(a.trouver('clore-auto').length, 0); // pas de clôture « coût 0 » pour un témoin
  await a.cliquer('lire-faits-auto');
  assert.match(a.un('auto-lecture').textContent, /^RÉPONSE CONNUE — .* coût réel calculé 0,000012 USD .* Témoin CONFORME\.$/);
  await a.cliquer('clore-temoin');
  let c = a.copie();
  assert.deepEqual([c.journal.at(-1).donnees.issue, c.registre.at(-1).donnees.montant, etatBudget(c.registre).executions[T1].statut], ['reponse-connue', 12, 'payee']);
  // NON ÉMIS
  const ne = await scenario(undefined, { env: { ATELIER_TEMOIN_CLE: '' } });
  a = await conduireTemoin();
  a.saisir('faits-auto', ne.r.texte);
  a.saisir('motif-auto', 'Clé absente.');
  await a.cliquer('lire-faits-auto');
  assert.match(a.un('auto-lecture').textContent, /^NON ÉMIS — aucune requête n'est partie \(appel, cle-absente\)\. Coût réel 0\.$/);
  await a.cliquer('clore-temoin');
  c = a.copie();
  assert.deepEqual([c.journal.at(-1).donnees.issue, c.registre.at(-1).donnees.montant], ['non-emis', 0]);
  // ISSUE INCONNUE
  const inc = await scenario((req) => req.socket.destroy());
  a = await conduireTemoin();
  // faits intermédiaires (frontière prête) refusés pour un témoin
  const pret = frontiere({ entrees: { chantier: CH, jalon: J, numero: '1', commit: COMMIT, empreinte: hacherSha256(canonique(etatDurableDe(a.copie()))) }, contexte: { run_id: RUN, run_attempt: '1', workflow_sha: 'f'.repeat(40), ref: 'refs/heads/main' }, journal: { tete: COMMIT, texte: canonique(etatDurableDe(a.copie())) }, approbations: APPROUVE, sonde: SONDE_OK });
  a.saisir('faits-auto', pret.texte);
  await a.cliquer('lire-faits-auto');
  assert.match(a.un('message').textContent, /faits intermédiaires/);
  for (const b of a.trouver('clore-temoin')) assert.fail(`aucun bouton de clôture attendu (${b.textContent})`);
  a.saisir('faits-auto', inc.r.texte);
  a.saisir('motif-auto', 'Coupure après la requête.');
  const n = a.stockage.ecritures;
  assert.equal(a.trouver('clore-temoin').length, 0); // sans lecture préalable : aucun geste de clôture
  assert.equal(a.stockage.ecritures, n);
  await a.cliquer('lire-faits-auto');
  const lecture = a.un('auto-lecture');
  assert.match(lecture.className, /resultat-erreur/);
  assert.match(lecture.textContent, /^⚠ ISSUE INCONNUE — un appel a pu avoir lieu \(connexion-coupee\)\. Coût NON établi : ce n'est ni un succès, ni un coût nul\. L'engagement de 0,001 USD reste OUVERT\. Aucune relance\./);
  assert.match(a.un('clore-temoin').textContent, /^Constater : ISSUE INCONNUE \(aucun coût inscrit, engagement maintenu\)$/);
  await a.cliquer('clore-temoin');
  c = a.copie();
  assert.equal(c.journal.at(-1).donnees.issue, 'issue-inconnue');
  assert.equal(c.registre.at(-1).type, 'engagement'); // AUCUN coût inscrit
  assert.equal(etatBudget(c.registre).executions[T1].statut, 'engagee');
  assert.match(a.un(`auto-close-${J}-1`).className, /resultat-erreur/);
  assert.equal(appliquerBudget(c.registre, { type: 'cycle-ouvert', quand: 'x', donnees: { cycle: 'c2', plafond: 1, reserve: 0, plafondRun: 1 } }).limite, 'engagement-ouvert');
  // tentative suivante : lancement AUTO bloqué jusqu'à la régularisation
  await a.cliquer('generer');
  assert.match(a.un('auto-bloque').textContent, /ISSUE INCONNUE n'est pas régularisée/);
  assert.equal(a.un('lancer-auto').disabled, true);
  // régularisation : 0 refusé, motif obligatoire, puis montant > 0 accepté
  a.saisir('montant-regul', '0');
  a.saisir('motif-regul', 'Console : 1 requête.');
  await a.cliquer('regulariser');
  assert.match(a.un('message').textContent, /montant nul refusé/);
  a.saisir('montant-regul', '0,001');
  a.saisir('motif-regul', '');
  await a.cliquer('regulariser');
  assert.match(a.un('message').textContent, /motif obligatoire/);
  a.saisir('motif-regul', 'Console : aucune ligne lisible, maximum engagé inscrit.');
  await a.cliquer('regulariser');
  c = a.copie();
  assert.deepEqual(c.registre.at(-1).donnees, { execution: T1, montant: 1000, issue: 'issue-inconnue', regularisation: 'Console : aucune ligne lisible, maximum engagé inscrit.' });
  assert.equal(etatBudget(c.registre).executions[T1].statut, 'payee');
  assert.equal(a.trouver('auto-bloque').length, 0);
  assert.equal(a.un('lancer-auto').disabled, false);
  assert.equal(lireEtatDurable(ecrireEtatDurable(c).texte).raison, undefined);
});
test('écran : aucune clôture AT-8.1 (coût 0) n\'est offerte pour un témoin', async () => {
  const a = await conduireTemoin();
  const { r } = await scenario();
  a.saisir('faits-auto', r.texte);
  a.saisir('motif-auto', 'm');
  assert.equal(a.trouver('clore-auto').length, 0);
});

// ------------------------------------------------------------------------------------------------ frontières statiques
test('auto-appel.mjs : SEUL fichier réseau ; node:https seulement ; une invocation de requete ; aucun SDK, agent, flux, boucle ni relance', () => {
  const brut = readFileSync(join(RACINE, 'outils-atelier', 'auto-appel.mjs'), 'utf8');
  const c = sansCommentaires(brut);
  assert.deepEqual([...c.matchAll(/^\s*import\b[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]).sort(), ['../app/atelier/auto.js', './auto-garde.mjs', 'node:fs', 'node:https', 'node:path', 'node:url']);
  assert.equal((c.match(/\brequete\(/g) || []).length, 1); // l'UNIQUE invocation
  assert.equal((c.match(/https\.request/g) || []).length, 2); // la cible admise et la ligne de commande
  assert.match(c, /agent: false/);
  for (const m of [/\bfor\s*\(/, /\bwhile\s*\(/, /\bdo\s*\{/, /setInterval/, /retr(y|ies)/i, /maxRetries|max_retries/, /keepAlive/, /\bstream\b/, /\bfetch\b/, /require\(/, /\bimport\(/, /child_process/, /node:(http|http2|net|tls|dns)\b/, /@anthropic-ai/, /\beval\(/, /follow/i]) assert.equal(m.test(c), false, String(m));
  assert.equal((c.match(/process\.env/g) || []).length, 1);
  assert.equal((c.match(/ATELIER_TEMOIN_CLE/g) || []).length, 2); // lecture unique de la clé (env.ATELIER_TEMOIN_CLE, deux mentions d'une même expression)
  assert.match(c, /'x-api-key': cle/);
  // la clé n'apparaît nulle part ailleurs que dans l'en-tête et le contrôle anti-fuite des faits
  // MISE À JOUR DÉLIBÉRÉE v0.65.13 (AT-9.1) : 10 -> 12 : + le contrôle anti-fuite de la proposition (longueur, recherche) avant son écriture.
  assert.equal((c.match(/\bcle\b/g) || []).length, 12); // paramètre, en-tête, lecture, deux contrôles (et leurs codes), passage à emettre, contrôles anti-fuite
});
test('hôte réel et en-tête de clé : présents dans auto-appel.mjs SEULEMENT (code capable après activation explicite), nulle part ailleurs', () => {
  const fichiers = [];
  const pile = [join(RACINE, 'app'), join(RACINE, 'outils-atelier')];
  while (pile.length) {
    const d = pile.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) pile.push(p);
      else if (/\.(m?js|json|html)$/.test(e.name)) fichiers.push(relative(RACINE, p));
    }
  }
  const avec = fichiers.filter((f) => /api\.anthropic\.com|x-api-key|ATELIER_TEMOIN_CLE/.test(readFileSync(join(RACINE, f), 'utf8'))).sort();
  assert.deepEqual(avec, ['outils-atelier/auto-appel.mjs']);
  const p = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys({ ...p.dependencies, ...p.devDependencies }).filter((x) => /anthropic|openai|claude/i.test(x)), []);
});
test('auto-constat.mjs : sans réseau (atelier pur + node:fs/path/url) ; aucun secret ; fermeture des imports bornée', () => {
  const c = sansCommentaires(readFileSync(join(RACINE, 'outils-atelier', 'auto-constat.mjs'), 'utf8'));
  assert.deepEqual([...c.matchAll(/^\s*import\b[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]).sort(), ['../app/atelier/auto.js', './auto-garde.mjs', 'node:fs', 'node:path', 'node:url']);
  for (const m of [/\bfetch\b/, /https?:/, /node:(https?|http2|net|tls|dns)\b/, /secrets\./, /_TOKEN|\bTOKEN\b/, /child_process/, /anthropic/i, /x-api-key/i, /\bimport\(/, /require\(/]) assert.equal(m.test(c), false, String(m));
});
test('recette à blanc : node:https n\'a JAMAIS été appelé dans ce fichier (aucun hôte réel joint)', async () => {
  await attendre(APRES_MS + 500);
  assert.equal(PIEGE.https, 0);
  assert.notEqual(https.request, httpsOriginal);
});
