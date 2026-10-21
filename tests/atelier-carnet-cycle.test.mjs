// v0.65.20 — AT-10.3 « RELAIS DU CYCLE AUTOMATISÉ » (GO « AT-10.3 — GO RÉALISATION LOCALE », 21/10/2026 ; DA, DB = B1, DC, DE = E1, DF, DG).
// OUTILLAGE NON COGNITIF — aucun réseau, aucun appel, aucune dépense. outils-atelier/auto-carnet.mjs sur un VRAI dépôt Git local (origine nue,
// clone de « Claude ») : demande-auto = texte EXACT de texteDemandeAuto depuis le carnet et la D3 authentiques, relu par lireDemandeAuto et
// autorisé par la garde J1 inchangée ; demande-at5 = exactement J4.demande_at5 depuis atelier/<T> vérifiée ; refus sans écriture (divergence,
// tentative, engagement, branche, parent, fichiers, ambiguïté, tête instable) ; budget sans double compte ; L2 ; E1 (sauvegarde, D8,
// demande-auto). Fichier du dépôt P1 (avec carnet.js et auto-carnet.mjs) ; l'écran (D3 regroupée) : tests/atelier-carnet-regroupement.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, chmodSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sauver, sauverChantier, verifierLivraison, demandeAuto, demandeAt5, verifierOuverture, principal } from '../outils-atelier/auto-carnet.mjs';
import { Stop, lireBranche, sauver as sauverJournal } from '../outils-atelier/journal-atelier.mjs';
import { ecrireEtatDurable, decouper, canonique } from '../app/atelier/journal.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { appliquerBudget } from '../app/atelier/budget.js';
import { texteDemandeAuto, lireDemandeAuto, garder, nomRun } from '../app/atelier/auto.js';
import { ouvrirCarnet, appliquerCarnet, etatCarnet, etatDurableCarnet, empreinteProposition, demandeAutoMission, demandeAt5Mission, fichiersTransmisMission, ecartsTransmis, baseMission, tentativeDeMission, } from '../app/atelier/carnet.js';
import { Q, CARNET, DEV, proposition, mission, ev, chantierPrepare, faitsJ4, livraison, ouverte, approuve, suite as suiteAide } from './atelier-carnet-aide.mjs';

const TMP = mkdtempSync(join(tmpdir(), 'atelier-cycle-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
const ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@a', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@a' };
const git = (cwd, ...a) => {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
const ecrire = (d, f, t) => { mkdirSync(join(d, f, '..'), { recursive: true }); writeFileSync(join(d, f), t); };
// Moins de 7 jours après Q (horodatage des lancements fictifs) : la garde J1 rejouée l'accepte ; 8 jours : demande périmée.
const MAINTENANT = '2026-10-21T12:30:00Z';

// Modèle : main = P (base 0.65.17, ecran.js) ; branche du candidat C (née de P, les deux fichiers de la mission 1), comme J4 la pousse.
const MODELE = join(TMP, 'modele');
mkdirSync(MODELE);
git(MODELE, 'init', '-q', '--bare', 'origine.git');
git(MODELE, 'init', '-q', '-b', 'main', 'auteur');
const A = join(MODELE, 'auteur');
ecrire(A, 'VERSION', '0.65.17\n');
ecrire(A, 'app/version.js', "export const VERSION = '0.65.17';\n");
ecrire(A, 'app/atelier/ecran.js', '// écran\n');
git(A, 'add', '-A');
git(A, 'commit', '-q', '-m', 'base');
const P = git(A, 'rev-parse', 'HEAD');
const T1 = `${CARNET}-m1/essai-1/1`;
const BRANCHE_C = `atelier/${T1}`;
git(A, 'checkout', '-q', '-b', BRANCHE_C);
ecrire(A, 'app/atelier/essai-1.js', 'export const essai = 1;\n');
ecrire(A, 'tests/atelier-essai-1.test.mjs', '// test essai 1\n');
git(A, 'add', '-A');
git(A, 'commit', '-q', '-m', 'candidat');
const C = git(A, 'rev-parse', 'HEAD');
git(A, 'checkout', '-q', 'main');
git(A, 'remote', 'add', 'origin', join(MODELE, 'origine.git'));
git(A, 'push', '-q', 'origin', 'main', BRANCHE_C);
git(MODELE, 'clone', '-q', join(MODELE, 'origine.git'), 'clone');

let n = 0;
function depot(source = MODELE) {
  n += 1;
  const d = join(TMP, `d${n}`);
  cpSync(source, d, { recursive: true });
  const origine = join(d, 'origine.git');
  git(join(d, 'clone'), 'remote', 'set-url', 'origin', origine);
  git(join(d, 'auteur'), 'remote', 'set-url', 'origin', origine);
  return { d, origine, clone: join(d, 'clone'), auteur: join(d, 'auteur'), refs: () => git(origine, 'for-each-ref', '--format=%(refname) %(objectname)') };
}
// Livraison simulée comme le robot (même forme que tests/atelier-carnet-d3.test.mjs) : dépôt du colis U, puis L étiqueté v<version> sur main.
function livrer(D, { version = '0.65.18', fichiers = { 'app/atelier/essai-1.js': 'export const essai = 1;\n', 'tests/atelier-essai-1.test.mjs': '// test essai 1\n' }, base = P } = {}) {
  const a = D.auteur;
  git(a, 'checkout', '-q', '-B', 'livraison', base);
  ecrire(a, 'colis.zip', 'PK-fictif');
  git(a, 'add', '-A');
  git(a, 'commit', '-q', '-m', 'Add files via upload');
  git(a, 'rm', '-q', 'colis.zip');
  for (const [f, t] of Object.entries(fichiers)) ecrire(a, f, t);
  ecrire(a, 'VERSION', `${version}\n`);
  ecrire(a, 'app/version.js', `export const VERSION = '${version}';\n`);
  git(a, 'add', '-A');
  git(a, 'commit', '-q', '-m', `Livraison v${version}`);
  git(a, 'tag', '-a', `v${version}`, '-m', `v${version}`);
  const L = git(a, 'rev-parse', 'HEAD');
  git(a, 'push', '-q', 'origin', `${L}:refs/heads/main`, `v${version}`);
  git(a, 'checkout', '-q', 'main');
  return L;
}
// Branche candidate forgée dans l'origine (commit né de « parent », fichiers donnés) : situations que J4 ne produit pas.
function candidatForge(D, { parent = P, fichiers = {}, branche = BRANCHE_C, racine = false } = {}) {
  const a = D.auteur;
  if (racine) git(a, 'checkout', '-q', '--orphan', 'forge'); else git(a, 'checkout', '-q', '-B', 'forge', parent);
  for (const [f, t] of Object.entries(fichiers)) ecrire(a, f, t);
  git(a, 'add', '-A');
  git(a, 'commit', '-q', '--allow-empty', '-m', 'forge');
  const X = git(a, 'rev-parse', 'HEAD');
  git(a, 'push', '-q', '-f', 'origin', `${X}:refs/heads/${branche}`);
  git(a, 'checkout', '-q', '-f', 'main');
  return X;
}

const BASE_P = Object.freeze({ sha: P, version: '0.65.17' });
const carnetDe = (p) => {
  const j = ouvrirCarnet(p, Q);
  const s = (x, ...evs) => evs.reduce((y, e) => { const r = appliquerCarnet(y, e); if (!Array.isArray(r)) throw new Error(r.raison); return r; }, x);
  return { s, approuve: s(j, ev('carnet-approuve', { empreinte: empreinteProposition(p) })) };
};
const P0 = proposition({ base: { ...BASE_P } });
const K0 = carnetDe(P0);
const J_APPROUVE = K0.approuve;
const J_OUVERT = K0.s(J_APPROUVE, ev('mission-ouverte', { k: 1, chantier: `${CARNET}-m1`, base: { ...BASE_P } }));
const partiesCarnet = (j) => decouper(canonique(etatDurableCarnet(j)), CARNET);
const etatChantier = (o = {}, k = 1) => ecrireEtatDurable(chantierPrepare(k, { base: { ...BASE_P }, candidat: C, ...o }));
const partiesChantier = (e, k = 1) => decouper(e.texte, `${CARNET}-m${k}`);
const arret = (f, motif) => assert.throws(f, (e) => e instanceof Stop && motif.test(e.message), motif);
const teteBranche = (D, b) => { const l = git(D.clone, 'ls-remote', 'origin', `refs/heads/${b}`); return l ? l.split('\t')[0] : null; };
// Le carnet (mission 1 ouverte) et la D3 du chantier m1 (garde D8) sauvegardés.
function pret(o = {}, j = J_OUVERT) {
  const D = depot();
  sauver({ depot: D.clone, parties: partiesCarnet(j), env: ENV });
  const e = etatChantier(o);
  sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e), env: ENV });
  return { D, e };
}
// Copie d'un dépôt déjà prêt (mêmes branches, même origine relocalisée) : les cas répétés ne refont pas les sauvegardes.
const cache = new Map();
function pretCopie(o = {}) {
  const cle = canonique(o);
  if (!cache.has(cle)) cache.set(cle, pret(o).D.d);
  return { D: depot(cache.get(cle)) };
}
// D3 écrite sans la garde D8 (situation forgée : écriture hors de l'outil, possible pour christophe-n).
const d3Directe = (D, e, k = 1) => sauverJournal({ depot: D.clone, parties: partiesChantier(e, k), env: ENV });
// Branche du carnet écrite directement (plumbing, orpheline), sans les contrôles de « sauver » (livraison revérifiée, E1).
function carnetDirect(D, j) {
  const texte = canonique(etatDurableCarnet(j));
  const blob = spawnSync('git', ['-C', D.clone, 'hash-object', '-w', '--stdin'], { input: texte, encoding: 'utf8', env: ENV }).stdout.trim();
  const arbre = spawnSync('git', ['-C', D.clone, 'mktree'], { input: `100644 blob ${blob}\tcarnet.json\n`, encoding: 'utf8', env: ENV }).stdout.trim();
  const commit = git(D.clone, 'commit-tree', arbre, '-m', 'carnet direct');
  git(D.clone, 'push', '-q', '-f', 'origin', `${commit}:refs/heads/journal-atelier/${CARNET}`);
}
// Programme upload-pack du clone remplacé par une enveloppe qui, à son n-ième lancement, déplace une référence de l'origine : la
// référence bouge PENDANT la lecture de l'outil.
function bougerAu(D, rang, ref, cible) {
  const script = join(D.d, 'upload-pack.sh');
  const compteur = join(D.d, 'compteur');
  writeFileSync(compteur, '0');
  writeFileSync(script, `#!/bin/sh\nn=$(cat '${compteur}'); n=$((n+1)); echo $n > '${compteur}'\nif [ "$n" = "${rang}" ]; then git --git-dir='${D.origine}' update-ref '${ref}' '${cible}'; fi\nexec git-upload-pack "$@"\n`);
  chmodSync(script, 0o755);
  git(D.clone, 'config', 'remote.origin.uploadpack', script);
  return () => Number(readFileSync(compteur, 'utf8'));
}

// ------------------------------------------------------------------------------------------------ demande-auto
test('AT-10.3 demande-auto : texte EXACT de texteDemandeAuto depuis le carnet et la D3 authentiques ; relu ; autorisé par la garde J1 inchangée', () => {
  const { D, e } = pret({ etape: 'lance' });
  const avant = D.refs();
  const r = demandeAuto({ depot: D.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV });
  const tete = teteBranche(D, `journal-atelier/${CARNET}-m1`);
  const attendu = texteDemandeAuto({ chantier: `${CARNET}-m1`, jalon: 'essai-1', numero: 1, commit: tete, empreinte: hacherSha256(e.texte), developpement: true });
  assert.equal(r.texte, attendu, 'octet pour octet');
  assert.match(r.texte, /^DEMANDE AUTO AVEC APPEL DE DÉVELOPPEMENT/);
  assert.deepEqual([r.carnet, r.k, r.t, r.commit, r.empreinte, r.engagement, r.plafond, r.disponible], [CARNET, 1, T1, tete, hacherSha256(e.texte), 101200, 150000, 850000]);
  const l = lireDemandeAuto(r.texte).demande;
  assert.deepEqual([l.t, l.commit, l.empreinte], [T1, tete, hacherSha256(e.texte)]);
  // J1 réelle (auto.js inchangé) sur les entrées relues, l'état relu de Git et un historique de run réaliste : autorisée.
  const lu = lireBranche({ depot: D.clone, chantier: `${CARNET}-m1`, env: ENV });
  const g = garder({ entrees: { chantier: l.chantier, jalon: l.jalon, numero: String(l.numero), commit: l.commit, empreinte: l.empreinte },
    contexte: { run_id: '40000000001', ref: 'refs/heads/main', run_attempt: '1', workflow_sha: 'e'.repeat(40) },
    historique: { total: 1, runs: [{ id: 40000000001, display_title: nomRun(T1), created_at: MAINTENANT }] }, journal: { tete: lu.tete, texte: lu.texte } });
  assert.deepEqual([g.autorise, g.raison], [true, null]);
  // Lecture seule : aucune référence de l'origine n'a changé.
  assert.equal(D.refs(), avant);
});

// Chantier lancé daté de MAINTENANT (horloge réelle) : la commande, qui n'a pas d'option d'heure, utilise l'horloge.
function lanceFrais() {
  const c = structuredClone(chantierPrepare(1, { etape: 'lance', base: { ...BASE_P }, candidat: C }));
  const q = new Date().toISOString();
  for (const x of [...c.journal, ...c.registre]) x.quand = q;
  return ecrireEtatDurable(c);
}
test('AT-10.3 demande-auto en ligne de commande : horloge réelle seulement ; « --maintenant » refusé (option inconnue)', () => {
  const D = depot();
  sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  const e = lanceFrais();
  sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e), env: ENV });
  const tete = teteBranche(D, `journal-atelier/${CARNET}-m1`);
  const attendu = texteDemandeAuto({ chantier: `${CARNET}-m1`, jalon: 'essai-1', numero: 1, commit: tete, empreinte: hacherSha256(e.texte), developpement: true });
  const sortie = principal(['demande-auto', '--depot', D.clone, '--carnet', CARNET], ENV);
  assert.ok(sortie.endsWith(attendu));
  assert.equal(JSON.parse(sortie.slice(0, sortie.indexOf('\n}\n') + 2)).t, T1);
  arret(() => principal(['demande-auto', '--depot', D.clone, '--carnet', CARNET, '--maintenant', MAINTENANT], ENV), /option inconnue : --maintenant/);
  // Un lancement daté de plus de 7 jours (fixture Q) est refusé par la commande : l'horloge ne se règle pas.
  const { D: D2 } = pret({ etape: 'lance' });
  if (Date.now() - Date.parse(Q) > 7 * 24 * 3600 * 1000) arret(() => principal(['demande-auto', '--depot', D2.clone, '--carnet', CARNET], ENV), /demande-perimee/);
});

test('AT-10.3 demande-auto : refus sans rien rendre — carnet, mission, chantier, tentative, divergence, engagement, garde J1', () => {
  const D0 = depot();
  arret(() => demandeAuto({ depot: D0.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV }), /carnet non sauvegardé/);
  sauver({ depot: D0.clone, parties: partiesCarnet(J_APPROUVE), env: ENV });
  arret(() => demandeAuto({ depot: D0.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV }), /carnet approuve : aucune mission ouverte/);
  sauver({ depot: D0.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  arret(() => demandeAuto({ depot: D0.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV }), /chantier de la mission 1 non sauvegardé/);
  const cas = [
    [{ etape: 'prepare' }, /non lancée/],
    [{ etape: 'rendu' }, /déjà rendue ou close/],
    [{ etape: 'accepte' }, /déjà rendue ou close/],
    [{ etape: 'inconnu' }, /déjà rendue ou close/],
  ];
  for (const [o, motif] of cas) {
    const { D } = pret(o);
    const avant = D.refs();
    arret(() => demandeAuto({ depot: D.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV }), motif);
    assert.equal(D.refs(), avant);
  }
  // D3 écrites hors de la garde D8 : divergentes (plafond, lancement MANUEL, appel), engagement absent ou soldé.
  const lance = chantierPrepare(1, { etape: 'lance', base: { ...BASE_P } });
  const sansEngagement = { ...lance, registre: lance.registre.filter((x) => x.type !== 'engagement') };
  const solde = { ...lance, registre: appliquerBudget(lance.registre, { type: 'cout', quand: Q, donnees: { execution: T1, montant: 50000, issue: 'reponse-connue' } }) };
  const forges = [
    [ecrireEtatDurable(chantierPrepare(1, { etape: 'lance', base: { ...BASE_P }, plafond: 140000 })), /DIVERGENCE.*plafond/],
    [ecrireEtatDurable(chantierPrepare(1, { etape: 'lance', base: { ...BASE_P }, lancement: { appel: { ...mission(1).appel, max_tokens: 4096 } } })), /DIVERGENCE/],
    [ecrireEtatDurable(sansEngagement), /engagement AT-2 de .* absent/],
    [ecrireEtatDurable(solde), /engagement AT-2 de .* soldé/],
  ];
  for (const [e, motif] of forges) {
    const D = depot();
    sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
    d3Directe(D, e);
    arret(() => demandeAuto({ depot: D.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV }), motif);
  }
  // La garde J1 rejouée refuse une demande périmée (8 jours) : STOP, aucun texte.
  const { D } = pret({ etape: 'lance' });
  arret(() => demandeAuto({ depot: D.clone, carnet: CARNET, maintenant: '2026-10-29T12:00:01Z', env: ENV }), /garde J1 refuserait .*demande-perimee/);
});

test('AT-10.3 demande-auto : tête Git instable (carnet ou chantier déplacé pendant la lecture) = STOP, jamais un texte', () => {
  // Nombre de lectures distantes d'une demande sans incident.
  const { D: D1 } = pret({ etape: 'lance' });
  const compte = bougerAu(D1, 0, 'refs/heads/inutile', P);
  demandeAuto({ depot: D1.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV });
  const total = compte();
  assert.ok(total >= 4);
  let instables = 0;
  for (const ref of [`refs/heads/journal-atelier/${CARNET}`, `refs/heads/journal-atelier/${CARNET}-m1`]) {
    for (const rang of [1, Math.ceil(total / 2), total]) {
      const { D } = pretCopie({ etape: 'lance' });
      // Cible : un autre commit existant (la tête précédente de la branche du chantier, ou main).
      bougerAu(D, rang, ref, P);
      assert.throws(() => demandeAuto({ depot: D.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV }), (e) => {
        if (!(e instanceof Stop)) return false;
        if (/instable|a bougé/.test(e.message)) instables += 1;
        return true;
      });
    }
  }
  assert.ok(instables >= 2, 'le déplacement après la lecture complète est vu comme une tête instable');
});

// ------------------------------------------------------------------------------------------------ budget sans double compte
test('AT-10.3 budget : l\'engagement se loge dans le plafond RÉSERVÉ de la mission (jamais compté deux fois) ; disponible 0 accepté', () => {
  const p = proposition({ plafond_total: 450000, limite_espace: 450000 });
  const { j } = approuve(p);
  const J = suiteAide(j, ev('carnet-approuve', { empreinte: empreinteProposition(p) }),
    ouverte(1), ev('mission-livree', livraison(1, { cout: 150000 })), ev('mission-validee', { k: 1 }),
    ouverte(2), ev('mission-livree', livraison(2, { cout: 150000 })), ev('mission-validee', { k: 2 }), ouverte(3));
  const e = etatCarnet(J);
  assert.deepEqual(e.budget, { confirme: 300000, reserve: 150000, disponible: 0 });
  const r = demandeAutoMission(e, 3, chantierPrepare(3, { etape: 'lance' }));
  assert.equal(r.raison, undefined);
  assert.deepEqual([r.t, r.engagement, r.plafond, r.confirme, r.reserve, r.disponible], [`${CARNET}-m3/essai-3/1`, 101200, 150000, 300000, 150000, 0]);
  assert.match(demandeAutoMission(e, 2, chantierPrepare(2, { etape: 'lance' })).raison, /mission 2 non ouverte/);
  assert.match(demandeAutoMission(e, 4, chantierPrepare(3, { etape: 'lance' })).raison, /hors du carnet/);
  assert.match(demandeAutoMission(etatCarnet(J_APPROUVE), 1, chantierPrepare(1, { etape: 'lance' })).raison, /non ouverte/);
});

// ------------------------------------------------------------------------------------------------ demande-at5
test('AT-10.3 demande-at5 : depuis atelier/<T> vérifiée, exactement J4.demande_at5 (lancée, ou rendue sur ce candidat)', () => {
  const j4 = JSON.parse(faitsJ4(1, { base: { ...BASE_P }, candidat: C })).demande_at5;
  for (const etape of ['lance', 'rendu']) {
    const { D } = pret({ etape });
    const avant = D.refs();
    const r = demandeAt5({ depot: D.clone, carnet: CARNET, env: ENV });
    assert.deepEqual([r.carnet, r.k, r.t], [CARNET, 1, T1]);
    assert.deepEqual(r.demande, j4);
    assert.deepEqual(r.demande, { branche: BRANCHE_C, candidat: C, base: P, version_base: '0.65.17', version_candidat: '0.65.18' });
    assert.equal(D.refs(), avant, 'lecture seule');
    assert.deepEqual(JSON.parse(principal(['demande-at5', '--depot', D.clone, '--carnet', CARNET], ENV)).demande, j4);
  }
});

test('AT-10.3 demande-at5 : refus — tentative, candidat enregistré autre, branche absente, deux commits, racine, fichier hors périmètre, ambiguïté', () => {
  for (const [o, motif] of [[{ etape: 'prepare' }, /ni lancée ni rendue/], [{ etape: 'accepte' }, /ni lancée ni rendue/], [{ etape: 'inconnu' }, /ni lancée ni rendue/],
    [{ etape: 'rendu', candidat: 'b'.repeat(40) }, /différent du candidat enregistré/]]) {
    const { D } = pret(o);
    arret(() => demandeAt5({ depot: D.clone, carnet: CARNET, env: ENV }), motif);
  }
  const forges = [
    [(D) => git(D.origine, 'update-ref', '-d', `refs/heads/${BRANCHE_C}`), /absente : aucun candidat/],
    [(D) => candidatForge(D, { parent: C, fichiers: { 'app/atelier/essai-1.js': 'export const essai = 2;\n' } }), /commit unique né de la base/],
    [(D) => candidatForge(D, { racine: true, fichiers: { 'app/atelier/essai-1.js': 'x\n' } }), /commit unique né de la base/],
    [(D) => candidatForge(D, { fichiers: { 'app/atelier/essai-1.js': 'x\n', 'app/atelier/ecran.js': '// modifié\n' } }), /hors des chemins autorisés de la mission : app\/atelier\/ecran\.js/],
    [(D) => candidatForge(D, { fichiers: { 'app/atelier/essai-1.js': 'x\n', 'outils-atelier/auto-carnet.mjs': '// P1\n' } }), /hors des chemins autorisés.*auto-carnet\.mjs/],
    [(D) => git(D.origine, 'update-ref', `refs/heads/atelier/${CARNET}-m1/essai-1/2`, C), /branche candidate ambiguë/],
    [(D) => git(D.origine, 'update-ref', `refs/heads/atelier/${CARNET}-m1/autre/1`, C), /branche candidate ambiguë/],
    [(D) => candidatForge(D, { parent: P }), /ne change aucun fichier/],
  ];
  for (const [forger, motif] of forges) {
    const { D } = pretCopie({ etape: 'lance' });
    forger(D);
    const avant = D.refs();
    arret(() => demandeAt5({ depot: D.clone, carnet: CARNET, env: ENV }), motif);
    assert.equal(D.refs(), avant);
  }
});

test('AT-10.3 demande-at5 : branche candidate ou chantier déplacés pendant la lecture = STOP', () => {
  const { D: D1 } = pret({ etape: 'lance' });
  const compte = bougerAu(D1, 0, 'refs/heads/inutile', P);
  demandeAt5({ depot: D1.clone, carnet: CARNET, env: ENV });
  const total = compte();
  let instables = 0;
  for (const [ref, cible] of [[`refs/heads/${BRANCHE_C}`, P], [`refs/heads/journal-atelier/${CARNET}-m1`, P]]) {
    for (const rang of [1, Math.ceil(total / 2), total]) {
      const { D } = pretCopie({ etape: 'lance' });
      bougerAu(D, rang, ref, cible);
      assert.throws(() => demandeAt5({ depot: D.clone, carnet: CARNET, env: ENV }), (e) => {
        if (!(e instanceof Stop)) return false;
        if (/instable|a bougé/.test(e.message)) instables += 1;
        return true;
      });
    }
  }
  assert.ok(instables >= 2);
});

test('AT-10.3 demandeAt5Mission (pur) : suppression, branche hors motif, candidat illisible, parents multiples', () => {
  const e = etatCarnet(J_OUVERT);
  const lance = chantierPrepare(1, { etape: 'lance', base: { ...BASE_P } });
  const ok = { branche: BRANCHE_C, candidat: C, parents: [P], fichiers: { 'app/atelier/essai-1.js': '100644 x' } };
  assert.equal(demandeAt5Mission(e, 1, lance, ok).raison, undefined);
  assert.match(demandeAt5Mission(e, 1, lance, { ...ok, fichiers: { 'app/atelier/essai-1.js': '100644 x', 'tests/atelier-essai-1.test.mjs': null } }).raison, /supprimés.*atelier-essai-1\.test\.mjs/);
  assert.match(demandeAt5Mission(e, 1, lance, { ...ok, branche: `atelier/${CARNET}-m2/essai-2/1` }).raison, /au lieu de/);
  assert.match(demandeAt5Mission(e, 1, lance, { ...ok, candidat: 'C' }).raison, /illisible/);
  assert.match(demandeAt5Mission(e, 1, lance, { ...ok, parents: [P, C] }).raison, /commit unique/);
  assert.match(demandeAt5Mission(e, 1, lance, { ...ok, fichiers: {} }).raison, /aucun fichier/);
  assert.match(demandeAt5Mission(e, 1, chantierPrepare(1, { etape: 'lance', base: { ...BASE_P }, change: { objectif: 'Autre.' } }), ok).raison, /DIVERGENCE.*objectif/);
  assert.match(demandeAt5Mission(etatCarnet(J_APPROUVE), 1, lance, ok).raison, /non ouverte/);
});

// ------------------------------------------------------------------------------------------------ L2
test('AT-10.3 L2 : version livrée = proposerVersion(base) dans le modèle pur (comme verifierLivraison)', () => {
  const v = { candidat: C, carnet: CARNET, chantier: `${CARNET}-m1`, cout: 100000, k: 1, main: 'f'.repeat(40), preuve: '1'.repeat(64) };
  assert.ok(Array.isArray(appliquerCarnet(J_OUVERT, ev('mission-livree', { ...v, version: '0.65.18' }))));
  for (const version of ['0.65.19', '0.66.0', '1.0.0']) {
    assert.match(appliquerCarnet(J_OUVERT, ev('mission-livree', { ...v, version })).raison, new RegExp(`version livrée ${version.replace(/\./g, '\\.')} différente de la version candidate 0\\.65\\.18`));
  }
  assert.match(appliquerCarnet(J_OUVERT, ev('mission-livree', { ...v, version: '0.65.17' })).raison, /non supérieure/);
});

// ------------------------------------------------------------------------------------------------ E1
// Carnet dont la mission 1 est livrée (vérifiée par git) puis validée ; la mission 2 s'ouvre sur L. « p » choisit la mission 2.
function livreEtValide(p) {
  const K = carnetDe(p);
  const ouvert = K.s(K.approuve, ev('mission-ouverte', { k: 1, chantier: `${CARNET}-m1`, base: { ...BASE_P } }));
  const { D } = pret({}, ouvert);
  const L = livrer(D);
  const v = verifierLivraison({ depot: D.clone, etat: etatCarnet(ouvert), k: 1, version: '0.65.18', env: ENV });
  const livree = K.s(ouvert, ev('mission-livree', v));
  assert.equal(sauver({ depot: D.clone, parties: partiesCarnet(livree), env: ENV }).statut, 'avancee');
  const groupee = K.s(livree, ev('mission-validee', { k: 1 }), ev('mission-ouverte', { k: 2, chantier: `${CARNET}-m2`, base: { sha: L, version: '0.65.18' } }));
  return { D, L, livree, groupee };
}
const avecExtraits = (extraits) => proposition({ base: { ...BASE_P }, missions: [mission(1), mission(2, { developpement: { ...structuredClone(DEV), extraits } }), mission(3)] });

test('AT-10.3 E1 : fichiers approuvés inchangés depuis la V1 => D3 regroupée (validation + ouverture) acceptée ; mission 1 sans objet', () => {
  assert.equal(verifierOuverture({ depot: depot().clone, etat: etatCarnet(J_OUVERT), k: 1, env: ENV }).statut, 'sans-objet');
  // Mission 2 : ses fichiers (absents des deux bases) et un extrait d'un fichier existant non touché par la mission 1 (ecran.js).
  const p = avecExtraits([{ chemin: 'app/atelier/ecran.js', debut: 1, fin: 1 }]);
  const { D, L, groupee } = livreEtValide(p);
  const tete = teteBranche(D, `journal-atelier/${CARNET}`);
  const r = sauver({ depot: D.clone, parties: partiesCarnet(groupee), env: ENV });
  assert.equal(r.statut, 'avancee');
  assert.equal(git(D.clone, 'rev-parse', `${r.commit}^`), tete, 'UNE sauvegarde pour la validation et l\'ouverture');
  const v = verifierOuverture({ depot: D.clone, etat: etatCarnet(groupee), k: 2, env: ENV });
  assert.deepEqual(v, { carnet: CARNET, k: 2, base: { sha: L, version: '0.65.18' }, chemins: ['app/atelier/ecran.js', 'app/atelier/essai-2.js', 'tests/atelier-essai-2.test.mjs'], statut: 'conforme' });
  assert.match(principal(['verifier-ouverture', '--depot', D.clone, '--carnet', CARNET, '--mission', '2'], ENV), /"statut": "conforme"/);
  // Chantier m2 préparé sur L : la garde D8 rejoue E1 et l'accepte.
  const e2 = ecrireEtatDurable(chantierPrepare(2, { etape: 'lance', base: { sha: L, version: '0.65.18' }, lancement: { developpement: { ...structuredClone(DEV), extraits: [{ chemin: 'app/atelier/ecran.js', debut: 1, fin: 1 }] } } }));
  assert.equal(sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e2, 2), env: ENV }).statut, 'creee');
});

test('AT-10.3 E1 : fichier transmis à la mission 2 changé par la mission 1 => STOP à la sauvegarde, à la garde D8 et à demande-auto', () => {
  const extraits = [{ chemin: 'app/atelier/essai-1.js', debut: 1, fin: 1 }];
  const { D, L, livree, groupee } = livreEtValide(avecExtraits(extraits));
  const tete = teteBranche(D, `journal-atelier/${CARNET}`);
  arret(() => sauver({ depot: D.clone, parties: partiesCarnet(groupee), env: ENV }), /E1 : fichiers approuvés pour la mission 2 changés depuis la V1 .*: app\/atelier\/essai-1\.js ; .*nouveau carnet/);
  assert.equal(teteBranche(D, `journal-atelier/${CARNET}`), tete, 'rien n\'est écrit');
  // La validation seule (sans ouverture) reste sauvegardable : E1 ne vise que l'ouverture.
  const K = carnetDe(avecExtraits(extraits));
  assert.equal(sauver({ depot: D.clone, parties: partiesCarnet(K.s(livree, ev('mission-validee', { k: 1 }))), env: ENV }).statut, 'avancee');
  arret(() => verifierOuverture({ depot: D.clone, etat: etatCarnet(groupee), k: 2, env: ENV }), /E1/);
  arret(() => principal(['verifier-ouverture', '--depot', D.clone, '--carnet', CARNET, '--mission', '2'], ENV), /E1/);
  // Carnet écrit HORS de l'outil (ouverture sans E1) : la garde D8 et demande-auto rejouent E1 et refusent.
  carnetDirect(D, groupee);
  const dev = { ...structuredClone(DEV), extraits };
  const e2 = ecrireEtatDurable(chantierPrepare(2, { etape: 'lance', base: { sha: L, version: '0.65.18' }, lancement: { developpement: dev } }));
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e2, 2), env: ENV }), /E1/);
  assert.equal(teteBranche(D, `journal-atelier/${CARNET}-m2`), null);
  d3Directe(D, e2, 2);
  arret(() => demandeAuto({ depot: D.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV }), /E1/);
});

test('AT-10.3 E1 : base de la mission hors de main (livraison inscrite sur un commit étranger) = STOP', () => {
  const D = depot();
  const v = { candidat: C, carnet: CARNET, chantier: `${CARNET}-m1`, cout: 100000, k: 1, main: C, preuve: '1'.repeat(64), version: '0.65.18' };
  const etat = etatCarnet(K0.s(J_OUVERT, ev('mission-livree', v), ev('mission-validee', { k: 1 })));
  arret(() => verifierOuverture({ depot: D.clone, etat, k: 2, env: ENV }), new RegExp(`${C.slice(0, 8)} n'est pas dans main`));
});

test('AT-10.3 E1 (pur) : chemins transmis = autorisés + extraits ; écarts par objet Git ; base de la mission', () => {
  const p = avecExtraits([{ chemin: 'app/atelier/ecran.js', debut: 1, fin: 3 }]);
  const e = etatCarnet(carnetDe(p).approuve);
  assert.deepEqual(fichiersTransmisMission(e, 2).chemins, ['app/atelier/ecran.js', 'app/atelier/essai-2.js', 'tests/atelier-essai-2.test.mjs']);
  assert.deepEqual(fichiersTransmisMission(e, 1).chemins, ['app/atelier/essai-1.js', 'tests/atelier-essai-1.test.mjs']);
  assert.match(fichiersTransmisMission(e, 4).raison, /hors du carnet/);
  assert.deepEqual(ecartsTransmis(['b', 'a', 'c'], { a: '100644 1', b: '100644 2' }, { a: '100644 1', b: '100755 2', c: '100644 3' }), ['b', 'c']);
  assert.deepEqual(ecartsTransmis(['a'], {}, {}), []);
  assert.deepEqual(baseMission(e, 1), { sha: P, version: '0.65.17' });
  assert.equal(baseMission(e, 2), null, 'mission 1 non livrée : pas de base pour la mission 2');
  assert.equal(baseMission(e, 4), null);
  assert.equal(tentativeDeMission(e, 2), `${CARNET}-m2/essai-2/1`);
});

// ------------------------------------------------------------------------------------------------ complément avant GO P1 (ChatGPT 17:51)
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
test('AT-10.3 heure du contrôle préalable : paramètre de fonction (tests) seulement ; ne change pas le texte ; aucun workflow ni la garde J1 n\'importe auto-carnet', () => {
  const { D } = pret({ etape: 'lance' });
  const a = demandeAuto({ depot: D.clone, carnet: CARNET, maintenant: MAINTENANT, env: ENV });
  const b = demandeAuto({ depot: D.clone, carnet: CARNET, maintenant: '2026-10-22T09:00:00Z', env: ENV });
  assert.equal(a.texte, b.texte, 'l\'heure du contrôle préalable n\'entre pas dans la demande');
  assert.doesNotMatch(a.texte, /2026-10-2/);
  // Aucun workflow ne mentionne auto-carnet.mjs ; ni la garde J1 (auto-garde.mjs), ni aucun outil ou module de l'atelier ne l'importe.
  const wf = join(RACINE, '.github', 'workflows');
  for (const f of readdirSync(wf)) assert.doesNotMatch(readFileSync(join(wf, f), 'utf8'), /auto-carnet|demande-auto|--maintenant/, f);
  const importe = /(from|import)\s*\(?\s*['"][^'"]*auto-carnet/;
  for (const f of readdirSync(join(RACINE, 'outils-atelier')).filter((x) => x !== 'auto-carnet.mjs')) assert.doesNotMatch(readFileSync(join(RACINE, 'outils-atelier', f), 'utf8'), importe, f);
  for (const f of readdirSync(join(RACINE, 'app', 'atelier'))) assert.doesNotMatch(readFileSync(join(RACINE, 'app', 'atelier', f), 'utf8'), importe, f);
});

test('AT-10.3 stabilité : une branche candidate apparue pendant la lecture (même à la dernière lecture) = STOP ambiguïté', () => {
  const { D: D1 } = pretCopie({ etape: 'lance' });
  const compte = bougerAu(D1, 0, 'refs/heads/inutile', P);
  demandeAt5({ depot: D1.clone, carnet: CARNET, env: ENV });
  const total = compte();
  for (const rang of [1, Math.ceil(total / 2), total]) {
    const { D } = pretCopie({ etape: 'lance' });
    bougerAu(D, rang, `refs/heads/atelier/${CARNET}-m1/autre/1`, C);
    arret(() => demandeAt5({ depot: D.clone, carnet: CARNET, env: ENV }), /ambiguë/);
  }
});
