// v0.65.18 — AT-10.1 « CARNET DE TROIS MISSIONS » (GO 21/10/2026 ; D-007, D3, D8). OUTILLAGE NON COGNITIF — aucun réseau.
// outils-atelier/auto-carnet.mjs sur un VRAI dépôt Git local : origine nue (base, candidat, dépôt du colis, livraison étiquetée) et un
// clone où « Claude » lance l'outil. Preuves : branche journal-atelier/<carnet> orpheline (carnet.json seul, avance rapide, doublon sans
// commit, réécriture refusée) ; garde D8 (seul le chantier de la mission ouverte et conforme est sauvegardé) ; preuve de livraison émise
// seulement si D3 du chantier, candidat, étiquette, base et fichiers livrés concordent exactement ; aucune autre référence touchée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sauver, restaurer, lireCarnet, sauverChantier, verifierLivraison, proposer, principal } from '../outils-atelier/auto-carnet.mjs';
import { Stop, sauver as sauverJournal } from '../outils-atelier/journal-atelier.mjs';
import { ecrireEtatDurable, decouper, canonique, assemblerParties } from '../app/atelier/journal.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { ouvrirCarnet, appliquerCarnet, etatCarnet, etatDurableCarnet, empreinteProposition, texteLivraison, lireLivraison } from '../app/atelier/carnet.js';
import { Q, CARNET, proposition, ev, chantierPrepare } from './atelier-carnet-aide.mjs';

const TMP = mkdtempSync(join(tmpdir(), 'atelier-carnet-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
const ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@a', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@a' };
const git = (cwd, ...a) => {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
const ecrire = (d, f, t) => { mkdirSync(join(d, f, '..'), { recursive: true }); writeFileSync(join(d, f), t); };

// Modèle : main = P (base 0.65.17) ; branche du candidat C (née de P, deux fichiers de la mission 1).
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
const BRANCHE_C = `atelier/${CARNET}-m1/essai-1/1`;
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
function depot() {
  n += 1;
  const d = join(TMP, `d${n}`);
  cpSync(MODELE, d, { recursive: true });
  const origine = join(d, 'origine.git');
  git(join(d, 'clone'), 'remote', 'set-url', 'origin', origine);
  git(join(d, 'auteur'), 'remote', 'set-url', 'origin', origine);
  return { d, origine, clone: join(d, 'clone'), auteur: join(d, 'auteur'), refs: () => git(origine, 'for-each-ref', '--format=%(refname) %(objectname)') };
}

// Livraison simulée comme le robot : U = base + colis.zip (dépôt web), L = U - zip + fichiers du colis + injection de version ; étiquette
// annotée v<version> sur L ; main avance sur L. Les options faussent un point à la fois.
function livrer(D, { version = '0.65.18', fichiers = { 'app/atelier/essai-1.js': 'export const essai = 1;\n', 'tests/atelier-essai-1.test.mjs': '// test essai 1\n' }, base = P, versionFichier = version, horsMain = false } = {}) {
  const a = D.auteur;
  git(a, 'checkout', '-q', '-B', 'livraison', base);
  ecrire(a, 'colis.zip', 'PK-fictif');
  git(a, 'add', '-A');
  git(a, 'commit', '-q', '-m', 'Add files via upload');
  git(a, 'rm', '-q', 'colis.zip');
  for (const [f, t] of Object.entries(fichiers)) ecrire(a, f, t);
  ecrire(a, 'VERSION', `${versionFichier}\n`);
  ecrire(a, 'app/version.js', `export const VERSION = '${versionFichier}';\n`);
  git(a, 'add', '-A');
  git(a, 'commit', '-q', '-m', `Livraison v${version}`);
  git(a, 'tag', '-a', `v${version}`, '-m', `v${version}`);
  const L = git(a, 'rev-parse', 'HEAD');
  git(a, 'push', '-q', 'origin', ...(horsMain ? [] : [`${L}:refs/heads/main`]), `v${version}`);
  git(a, 'checkout', '-q', 'main');
  return L;
}

const P0 = proposition({ base: { sha: P, version: '0.65.17' } });
const EMP = empreinteProposition(P0);
const suite = (j, ...evs) => evs.reduce((x, e) => { const r = appliquerCarnet(x, e); if (!Array.isArray(r)) throw new Error(r.raison); return r; }, j);
const J_BROUILLON = ouvrirCarnet(P0, Q);
const J_APPROUVE = suite(J_BROUILLON, ev('carnet-approuve', { empreinte: EMP }));
const J_OUVERT = suite(J_APPROUVE, ev('mission-ouverte', { k: 1, chantier: `${CARNET}-m1`, base: { sha: P, version: '0.65.17' } }));
const partiesCarnet = (j) => decouper(canonique(etatDurableCarnet(j)), CARNET);
// MISE À JOUR DÉLIBÉRÉE v0.65.19 (AT-10.2) : le chantier de la mission est PRÉPARÉ (cycle et plafond de la mission, lancement AUTO,
// engagement, instantané, faits J2/J4/AT-5 fictifs, décision) ; un chantier MANUEL non préparé est désormais une DIVERGENCE (garde D8).
const etatChantier = (o = {}) => ecrireEtatDurable(chantierPrepare(1, { base: { sha: P, version: '0.65.17' }, candidat: C, ...o }));
const partiesChantier = (e, id = `${CARNET}-m1`) => decouper(e.texte, id);
const arret = (f, motif) => assert.throws(f, (e) => e instanceof Stop && motif.test(e.message), motif);
// D3 d'un chantier écrite directement par journal-atelier.mjs (sans la garde D8) : situation forgée pour éprouver la vérification de livraison.
const sauverChantierD3Direct = (D, e) => sauverJournal({ depot: D.clone, parties: partiesChantier(e), env: ENV });
const teteBranche = (D, b) => { const l = git(D.clone, 'ls-remote', 'origin', `refs/heads/${b}`); return l ? l.split('\t')[0] : null; };

// Prépare un dépôt où le carnet (mission 1 ouverte) et la D3 du chantier m1 sont sauvegardés.
function pret(o = {}) {
  const D = depot();
  sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  const e = etatChantier(o);
  sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e), env: ENV });
  return { D, e };
}

test('carnet D3 : création orpheline, carnet.json seul, doublon sans commit, avance rapide, restauration exacte', () => {
  const D = depot();
  const avant = D.refs();
  const r1 = sauver({ depot: D.clone, parties: partiesCarnet(J_APPROUVE), env: ENV });
  assert.equal(r1.statut, 'creee');
  assert.equal(r1.branche, `journal-atelier/${CARNET}`);
  assert.match(r1.confirmation, new RegExp(`^ATELIER-SAUVEGARDE-1 chantier=${CARNET} empreinte=[0-9a-f]{64} commit=${r1.commit}$`));
  assert.equal(git(D.clone, 'rev-list', '--parents', '-n', '1', r1.commit), r1.commit, 'commit racine orphelin');
  assert.equal(git(D.clone, 'ls-tree', '--name-only', r1.commit), 'carnet.json');
  const r2 = sauver({ depot: D.clone, parties: partiesCarnet(J_APPROUVE), env: ENV });
  assert.deepEqual([r2.statut, r2.commit], ['identique', r1.commit]);
  const r3 = sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  assert.equal(r3.statut, 'avancee');
  assert.equal(git(D.clone, 'rev-parse', `${r3.commit}^`), r1.commit);
  const lu = lireCarnet({ depot: D.clone, carnet: CARNET, env: ENV });
  assert.deepEqual([lu.commits, lu.etat.statut, lu.etat.missionCourante], [2, 'en-cours', 1]);
  const res = restaurer({ depot: D.clone, carnet: CARNET, env: ENV });
  assert.equal(assemblerParties(res.parties).contenu, canonique(etatDurableCarnet(J_OUVERT)));
  // Seule la branche du carnet a été créée.
  const apres = D.refs().split('\n').filter((l) => !avant.includes(l));
  assert.deepEqual(apres.map((l) => l.split(' ')[0]), [`refs/heads/journal-atelier/${CARNET}`]);
});

test('carnet D3 : réécriture, retrait, autre carnet, parties incomplètes ou invalides : STOP sans écriture', () => {
  const D = depot();
  sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  const tete = teteBranche(D, `journal-atelier/${CARNET}`);
  arret(() => sauver({ depot: D.clone, parties: partiesCarnet(J_APPROUVE), env: ENV }), /divergence.*non prolongé/);
  const autre = suite(J_APPROUVE, ev('carnet-arrete', { motif: 'autre histoire' }));
  arret(() => sauver({ depot: D.clone, parties: partiesCarnet(autre), env: ENV }), /divergence/);
  const p = partiesCarnet(J_OUVERT);
  if (p.length > 1) arret(() => sauver({ depot: D.clone, parties: p.slice(1), env: ENV }), /parties manquantes/);
  arret(() => sauver({ depot: D.clone, parties: [], env: ENV }), /aucune partie/);
  arret(() => sauver({ depot: D.clone, parties: partiesChantier(etatChantier()), env: ENV }), /état du carnet invalide/);
  const triche = structuredClone(J_OUVERT); triche[0].donnees.missions[0].plafond = 160000;
  arret(() => sauver({ depot: D.clone, parties: decouper(canonique({ protocole: 'atelier-carnet-1', carnet: CARNET, journal: triche }), CARNET), env: ENV }), /incohérent/);
  assert.equal(teteBranche(D, `journal-atelier/${CARNET}`), tete);
});

test('carnet D3 : une branche du carnet portant un autre fichier que carnet.json est refusée (STOP, rien n\'est poussé)', () => {
  const D = depot();
  const r = sauver({ depot: D.clone, parties: partiesCarnet(J_APPROUVE), env: ENV });
  const a = D.auteur;
  git(a, 'fetch', '-q', 'origin', `journal-atelier/${CARNET}`);
  git(a, 'checkout', '-q', '-B', 'carnet-triche', 'FETCH_HEAD');
  ecrire(a, 'autre.txt', 'x\n');
  git(a, 'add', '-A');
  git(a, 'commit', '-q', '-m', 'triche');
  git(a, 'push', '-q', 'origin', `HEAD:refs/heads/journal-atelier/${CARNET}`);
  git(a, 'checkout', '-q', 'main');
  const tete = teteBranche(D, `journal-atelier/${CARNET}`);
  assert.notEqual(tete, r.commit);
  arret(() => lireCarnet({ depot: D.clone, carnet: CARNET, env: ENV }), /ne contient pas exactement carnet\.json/);
  arret(() => sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV }), /ne contient pas exactement carnet\.json/);
  assert.equal(teteBranche(D, `journal-atelier/${CARNET}`), tete);
});

test('carnet D3 : un carnet terminé ou arrêté n\'accepte plus aucune sauvegarde nouvelle', () => {
  const D = depot();
  const arrete = suite(J_OUVERT, ev('mission-close', { k: 1, issue: 'refusee', cout: 1000 }), ev('carnet-arrete', { motif: 'refus mission 1' }));
  assert.equal(sauver({ depot: D.clone, parties: partiesCarnet(arrete), env: ENV }).statut, 'creee');
  assert.equal(sauver({ depot: D.clone, parties: partiesCarnet(arrete), env: ENV }).statut, 'identique');
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(etatChantier()), env: ENV }), /carnet arrete : aucune mission ouverte/);
});

test('carnet D3 : garde D8 — seul le chantier de la mission ouverte, conforme, est sauvegardé (refus par défaut)', () => {
  const D = depot();
  const e = etatChantier();
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e), env: ENV }), /carnet non sauvegardé/);
  sauver({ depot: D.clone, parties: partiesCarnet(J_BROUILLON), env: ENV });
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e), env: ENV }), /carnet brouillon/);
  sauver({ depot: D.clone, parties: partiesCarnet(J_APPROUVE), env: ENV });
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e), env: ENV }), /carnet approuve/);
  sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  // Un autre chantier (mission suivante, chantier ordinaire) : hors périmètre.
  const e2 = ecrireEtatDurable(chantierPrepare(2, { base: { sha: P, version: '0.65.17' } }));
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e2, `${CARNET}-m2`), env: ENV }), /hors du périmètre du carnet/);
  // Chantier m1 divergent : objectif ou base différents, deux tentatives.
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(etatChantier({ etape: 'prepare', change: { objectif: 'Autre.' } })), env: ENV }), /DIVERGENCE.*objectif/);
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(etatChantier({ etape: 'prepare', base: { sha: C, version: '0.65.17' } })), env: ENV }), /DIVERGENCE.*base/);
  arret(() => sauverChantier({ depot: D.clone, carnet: 'carnet-autre', parties: partiesChantier(e), env: ENV }), /carnet non sauvegardé/);
  arret(() => sauverChantier({ depot: D.clone, carnet: '../main', parties: partiesChantier(e), env: ENV }), /identifiant de carnet invalide/);
  assert.equal(teteBranche(D, `journal-atelier/${CARNET}-m1`), null, 'rien n\'a été écrit pour le chantier');
  const r = sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e), env: ENV });
  assert.equal(r.statut, 'creee');
  assert.equal(r.branche, `journal-atelier/${CARNET}-m1`);
  assert.equal(teteBranche(D, `journal-atelier/${CARNET}-m1`), r.commit);
});

test('carnet D3 : preuve de livraison émise seulement quand tout concorde, puis « mission-livree » sauvegardée', () => {
  const { D, e } = pret();
  const L = livrer(D);
  const etat = etatCarnet(J_OUVERT);
  const v = verifierLivraison({ depot: D.clone, etat, k: 1, version: '0.65.18', env: ENV });
  assert.deepEqual(v, { carnet: CARNET, k: 1, chantier: `${CARNET}-m1`, version: '0.65.18', main: L, candidat: C, cout: 100000, preuve: hacherSha256(e.texte) });
  const ligne = texteLivraison(v);
  assert.deepEqual({ ...lireLivraison(ligne).livraison }, v);
  const out = principal(['livraison', '--depot', D.clone, '--carnet', CARNET, '--mission', '1', '--version', '0.65.18'], ENV);
  assert.ok(out.endsWith(`${ligne}\n`));
  // Le carnet prolongé de la livraison vérifiée est sauvegardé ; une livraison faussée (coût, candidat, preuve) est refusée.
  const livree = suite(J_OUVERT, ev('mission-livree', v));
  for (const faux of [{ cout: 90000 }, { candidat: 'c'.repeat(40) }, { preuve: '0'.repeat(64) }]) {
    arret(() => sauver({ depot: D.clone, parties: partiesCarnet(suite(J_OUVERT, ev('mission-livree', { ...v, ...faux }))), env: ENV }), /non conforme à la vérification git/);
  }
  assert.equal(sauver({ depot: D.clone, parties: partiesCarnet(livree), env: ENV }).statut, 'avancee');
  const valide = suite(livree, ev('mission-validee', { k: 1 }));
  assert.equal(sauver({ depot: D.clone, parties: partiesCarnet(valide), env: ENV }).statut, 'avancee');
  // Mission validée : plus de mission ouverte, la D3 du chantier m1 n'est plus permise.
  arret(() => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(e), env: ENV }), /mission 1 validee : sauvegarde du chantier refusée/);
});

test('carnet D3 : livraison refusée — étiquette absente, hors main, VERSION fausse, autre base, fichiers en plus ou différents', () => {
  const etat = etatCarnet(J_OUVERT);
  const cas = [
    // MISE À JOUR DÉLIBÉRÉE v0.65.20 (AT-10.3, L2) : une version autre que proposerVersion(base) est refusée AVANT toute lecture de
    // l'étiquette ; l'étiquette absente s'éprouve donc sur la version candidate 0.65.18 (livraison étiquetée v0.65.19 seulement).
    [{ version: '0.65.19' }, '0.65.18', /étiquette v0\.65\.18 absente/],
    [{}, '0.65.19', /version 0\.65\.19 différente de la version candidate 0\.65\.18/],
    [{ horsMain: true }, '0.65.18', /n'est pas dans main/],
    [{ versionFichier: '0.65.17' }, '0.65.18', /VERSION de v0\.65\.18 différente/],
    [{ base: C }, '0.65.18', /pas livrée sur la base de la mission 1/],
    [{ fichiers: { 'app/atelier/essai-1.js': 'export const essai = 1;\n', 'tests/atelier-essai-1.test.mjs': '// test essai 1\n', 'app/atelier/ecran.js': '// modifié\n' } }, '0.65.18', /fichiers livrés différents du candidat accepté : app\/atelier\/ecran\.js/],
    [{ fichiers: { 'app/atelier/essai-1.js': 'export const essai = 2;\n', 'tests/atelier-essai-1.test.mjs': '// test essai 1\n' } }, '0.65.18', /fichiers livrés différents.*essai-1\.js/],
    [{ fichiers: { 'app/atelier/essai-1.js': 'export const essai = 1;\n' } }, '0.65.18', /fichiers livrés différents.*atelier-essai-1\.test\.mjs/],
  ];
  for (const [o, version, motif] of cas) {
    const { D } = pret();
    livrer(D, o);
    arret(() => verifierLivraison({ depot: D.clone, etat, k: 1, version, env: ENV }), motif);
  }
  const { D } = pret();
  livrer(D);
  arret(() => verifierLivraison({ depot: D.clone, etat, k: 1, version: '0.65', env: ENV }), /version X\.Y\.Z/);
  arret(() => verifierLivraison({ depot: D.clone, etat, k: 2, version: '0.65.18', env: ENV }), /mission 2 non ouverte/);
  arret(() => verifierLivraison({ depot: D.clone, etat: etatCarnet(J_APPROUVE), k: 1, version: '0.65.18', env: ENV }), /mission 1 non ouverte/);
});

test('carnet D3 : livraison refusée — chantier non terminé, coût inconnu, sans D3, branche du candidat absente ou autre', () => {
  const etat = etatCarnet(J_OUVERT);
  // MISE À JOUR DÉLIBÉRÉE v0.65.19 (AT-10.2) : un chantier préparé accepté a toujours son coût réel (relecture durable) ; le coût
  // inconnu ne vient que d'une issue inconnue, qui clôt l'unique tentative (chantier bloqué) : la livraison est refusée dès le bilan.
  for (const [o, motif] of [[{ etape: 'rendu' }, /non terminé sur un candidat accepté/], [{ etape: 'inconnu' }, /non terminé sur un candidat accepté \(statut bloque\)/]]) {
    const { D } = pret(o);
    livrer(D);
    arret(() => verifierLivraison({ depot: D.clone, etat, k: 1, version: '0.65.18', env: ENV }), motif);
  }
  const D1 = depot();
  sauver({ depot: D1.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  livrer(D1);
  arret(() => verifierLivraison({ depot: D1.clone, etat, k: 1, version: '0.65.18', env: ENV }), /n'existe pas : aucune preuve/);
  const { D: D2 } = pret();
  livrer(D2);
  git(D2.origine, 'update-ref', '-d', `refs/heads/${BRANCHE_C}`);
  arret(() => verifierLivraison({ depot: D2.clone, etat, k: 1, version: '0.65.18', env: ENV }), /branche du candidat .* absente ou différente/);
  // Chantier à deux jalons dont le premier est accepté : candidat présent mais chantier non terminé.
  const { D: D4 } = (() => {
    const D = depot();
    sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
    const m = proposition().missions[0];
    const e = ecrireEtatDurable(chantierPrepare(1, { base: { sha: P, version: '0.65.17' }, candidat: C, change: { plan: [{ id: m.jalon.id, titre: m.jalon.titre, critere: m.jalon.critere, tentativesMax: 1 }, { id: 'suite', titre: 'Suite', critere: 'Suite.', tentativesMax: 1 }] } }));
    sauverChantierD3Direct(D, e);
    return { D };
  })();
  livrer(D4);
  arret(() => verifierLivraison({ depot: D4.clone, etat, k: 1, version: '0.65.18', env: ENV }), /non terminé sur un candidat accepté \(statut en-cours\)/);
  // MISE À JOUR DÉLIBÉRÉE v0.65.19 (AT-10.2) : un candidat AUTO égal à la base est refusé dès J4 ; « autre candidat » = un autre sha.
  const { D: D3 } = pret({ candidat: 'd'.repeat(40) });
  livrer(D3);
  arret(() => verifierLivraison({ depot: D3.clone, etat, k: 1, version: '0.65.18', env: ENV }), /absente ou différente du candidat accepté/);
});

// ------------------------------------------------------------------------------------------------ v0.65.19 — AT-10.2
test('AT-10.2 garde D8 : chaque étape du chantier préparé est sauvegardée en avance rapide ; préparé puis modifié : STOP sans écriture', () => {
  const D = depot();
  sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  const statuts = ['prepare', 'lance', 'rendu', 'accepte'].map((etape) => sauverChantier({ depot: D.clone, carnet: CARNET, parties: partiesChantier(etatChantier({ etape })), env: ENV }).statut);
  assert.deepEqual(statuts, ['creee', 'avancee', 'avancee', 'avancee']);
  const tete = teteBranche(D, `journal-atelier/${CARNET}-m1`);
  const D2 = depot();
  sauver({ depot: D2.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
  const cas = [
    [{ etape: 'prepare', cycle: { plafond: 500000, plafondRun: 500000 } }, /DIVERGENCE.*cycle AT-2/],
    [{ etape: 'prepare', plafond: 100000 }, /DIVERGENCE.*plafond AT-2/],
    [{ etape: 'lance', engagement: 150000 }, /DIVERGENCE.*engagement AT-2/],
    [{ etape: 'lance', lancement: { appel: { appels: 1, entree_max: 10000, max_tokens: 1024, modele: 'claude-opus-5-5', tarif_entree: 5000000, tarif_sortie: 25000000 } } }, /DIVERGENCE.*lancement différent/],
    [{ etape: 'lance', piece: { tests: ['tests/atelier-essai-1.test.mjs', 'tests/atelier-autre.test.mjs'] } }, /DIVERGENCE.*instantané/],
    [{ etape: 'lance', piece: { frontieres: [] } }, /DIVERGENCE.*instantané/],
  ];
  for (const [o, motif] of cas) arret(() => sauverChantier({ depot: D2.clone, carnet: CARNET, parties: partiesChantier(etatChantier(o)), env: ENV }), motif);
  assert.equal(teteBranche(D2, `journal-atelier/${CARNET}-m1`), null, 'rien n\'a été écrit');
  assert.equal(teteBranche(D, `journal-atelier/${CARNET}-m1`), tete);
});

test('AT-10.2 livraison : une D3 du chantier écrite hors garde mais divergente (plafond, instantané) ne donne aucune preuve', () => {
  const etat = etatCarnet(J_OUVERT);
  for (const [o, motif] of [[{ plafond: 149999 }, /DIVERGENCE.*plafond AT-2/], [{ piece: { criteres: ['Autre.'] } }, /DIVERGENCE.*instantané/]]) {
    const D = depot();
    sauver({ depot: D.clone, parties: partiesCarnet(J_OUVERT), env: ENV });
    sauverChantierD3Direct(D, etatChantier(o));
    livrer(D);
    arret(() => verifierLivraison({ depot: D.clone, etat, k: 1, version: '0.65.18', env: ENV }), motif);
  }
});

test('carnet D3 : « proposer » rend des parties ATELIER-PARTIE-2 de la proposition canonique, refuse une proposition invalide', () => {
  const r = proposer(JSON.stringify(P0));
  assert.equal(r.empreinte, EMP);
  const a = assemblerParties(r.parties);
  assert.deepEqual([a.statut, a.chantier], ['complet', CARNET]);
  assert.deepEqual(JSON.parse(a.contenu), P0);
  arret(() => proposer(JSON.stringify({ ...P0, missions: P0.missions.slice(0, 2) })), /exactement 3 missions/);
  arret(() => proposer('{'), /JSON illisible/);
  const sortie = join(TMP, 'proposition');
  writeFileSync(join(TMP, 'p.json'), JSON.stringify(P0));
  principal(['proposer', '--proposition', join(TMP, 'p.json'), '--sortie', sortie]);
  assert.deepEqual(readdirSync(sortie).sort(), r.parties.map((_, i) => `partie-${i + 1}.txt`).sort());
  assert.equal(readFileSync(join(sortie, 'partie-1.txt'), 'utf8'), r.parties[0]);
  arret(() => principal(['sauver', '--force', 'x']), /option inconnue/);
  arret(() => principal(['effacer', '--depot', 'x']), /commande inconnue/);
  arret(() => principal(['livraison', '--depot', 'x', '--carnet', CARNET, '--mission', '4', '--version', '0.65.18']), /--mission 1, 2 ou 3/);
});

test('carnet D3 : l\'outil ne pousse qu\'une forme, sans option, vers journal-atelier/ seulement', () => {
  const src = readFileSync(new URL('../outils-atelier/auto-carnet.mjs', import.meta.url), 'utf8');
  const pushes = [...src.matchAll(/'push'[^\n]*/g)].map((m) => m[0]);
  assert.deepEqual(pushes, ["'push', '--quiet', distant, `${commit}:refs/heads/${branche}`], env);"]);
  for (const motif of [/--force|\+refs\/heads\/journal|--delete|'tag'|'merge'|'reset'|'rebase'|update-ref', '(?!-d)/, /fetch\(|https?:\/\//, /api\.anthropic|x-api-key/i]) assert.doesNotMatch(src.replace(/^\s*\/\/.*$/gm, ''), motif);
});
