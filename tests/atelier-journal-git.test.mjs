// v0.65.7 — AT-7 « JOURNAL GIT + REPRISE » (GO 17/10/2026 ; D-007 précision D4). OUTILLAGE NON COGNITIF — aucun réseau.
// outils-atelier/journal-atelier.mjs sur un VRAI dépôt Git local : une origine nue (main + étiquette) et un clone où « Claude » lance
// l'outil. Branche journal-atelier/<chantier> réellement orpheline, sans ancêtre avec main, chantier.json seul, un commit par sauvegarde
// effective, avance rapide, doublon sans commit, divergence / régression / autre fichier / histoire étrangère : STOP, rien n'est poussé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sauver, restaurer, lireBranche, principal, Stop } from '../outils-atelier/journal-atelier.mjs';
import { ecrireEtatDurable, decouper, canonique, assemblerParties } from '../app/atelier/journal.js';
import { conduire, FAITS } from './atelier-aide.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTIL = join(RACINE, 'outils-atelier', 'journal-atelier.mjs');
const TMP = mkdtempSync(join(tmpdir(), 'atelier-journal-'));
process.on('exit', () => rmSync(TMP, { recursive: true, force: true }));
const ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@a', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@a' };
const git = (cwd, ...a) => {
  const r = spawnSync('git', a, { cwd, encoding: 'utf8', env: ENV });
  if (r.status !== 0) throw new Error(`git ${a.join(' ')} : ${r.stderr}`);
  return r.stdout.trim();
};
const gitEntree = (cwd, entree, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8', env: ENV, input: entree }).stdout.trim();
const essai = (cwd, ...a) => spawnSync('git', a, { cwd, encoding: 'utf8', env: ENV }).status;

// Un dépôt neuf par scénario : origine nue avec main (deux fichiers) et une étiquette ; clone de travail pour l'outil. Le modèle est
// construit une fois par git, puis copié (et le clone repointé sur sa propre origine) : mêmes objets, mêmes références.
const MODELE = join(TMP, 'modele');
mkdirSync(MODELE);
git(MODELE, 'init', '-q', '--bare', 'origine.git');
git(MODELE, 'init', '-q', '-b', 'main', 'auteur');
writeFileSync(join(MODELE, 'auteur', 'VERSION'), '0.65.6\n');
writeFileSync(join(MODELE, 'auteur', 'chantier.json'), '{}\n'); // un chantier.json sur main ne crée aucun lien avec la branche journal
git(join(MODELE, 'auteur'), 'add', '-A');
git(join(MODELE, 'auteur'), 'commit', '-q', '-m', 'main');
git(join(MODELE, 'auteur'), 'tag', '-a', 'v0.65.6', '-m', 'v0.65.6');
git(join(MODELE, 'auteur'), 'remote', 'add', 'origin', join(MODELE, 'origine.git'));
git(join(MODELE, 'auteur'), 'push', '-q', 'origin', 'main', '--tags');
git(MODELE, 'clone', '-q', join(MODELE, 'origine.git'), 'clone');
const MAIN = git(join(MODELE, 'auteur'), 'rev-parse', 'HEAD');
let nDepot = 0;
function depot() {
  nDepot += 1;
  const d = join(TMP, `d${nDepot}`);
  cpSync(MODELE, d, { recursive: true });
  const origine = join(d, 'origine.git');
  const clone = join(d, 'clone');
  git(clone, 'remote', 'set-url', 'origin', origine);
  const refs = () => git(clone, 'ls-remote', 'origin');
  return { d, origine, clone, refs, main: MAIN };
}
const BRANCHE = 'journal-atelier/temoin-atelier';
const teteDistante = (D) => { const l = git(D.clone, 'ls-remote', 'origin', `refs/heads/${BRANCHE}`); return l ? l.split('\t')[0] : null; };

// États durables du témoin (vrais gestes de l'écran), du plus ancien au plus récent ; plus une histoire divergente (refus humain).
const ETATS = {};
await conduire('decide', { observer: (s, a) => { ETATS[s] = ecrireEtatDurable(a.copie()); } });
ETATS.divergent = ecrireEtatDurable((await conduire('decide', { issue: 'non-conforme' })).copie());
// État durable valide de plus de 15 000 caractères : l'état « faits » du témoin prolongé de runs « impossible » ajoutés en fin (faits en
// ajout seulement, comme le geste confronter de l'écran) ; relu entier par ecrireEtatDurable, donc valide pour le protocole.
const GRAND = (() => {
  const v = JSON.parse(ETATS['faits'].texte);
  const p = v.pieces['temoin-1/1'];
  for (let i = 2; i <= 6; i += 1) p.faits.push(FAITS({ demande: p.demande, issue: 'impossible', run: `4100000000${i}` }));
  return ecrireEtatDurable(v);
})();
const parties = (e) => decouper(e.texte, 'temoin-atelier');
const STOP = (re) => (e) => e instanceof Stop && re.test(e.message) && e.message.startsWith('STOP : ');

test('première sauvegarde : branche ORPHELINE créée, sans ancêtre avec main, chantier.json seul, contenu exact, confirmation', async () => {
  const D = depot();
  const avant = D.refs();
  const e = ETATS['lancee'];
  const r = sauver({ depot: D.clone, parties: parties(e), env: ENV });
  assert.equal(r.statut, 'creee');
  assert.equal(r.branche, BRANCHE);
  assert.equal(teteDistante(D), r.commit);
  git(D.clone, 'fetch', '-q', 'origin', `refs/heads/${BRANCHE}:refs/test/j`);
  assert.equal(git(D.clone, 'rev-list', '--count', 'refs/test/j'), '1');
  assert.equal(git(D.clone, 'rev-list', '--max-parents=0', 'refs/test/j'), r.commit);
  assert.notEqual(essai(D.clone, 'merge-base', 'refs/test/j', 'origin/main'), 0);
  assert.equal(git(D.clone, 'ls-tree', '--name-only', 'refs/test/j'), 'chantier.json');
  assert.equal(spawnSync('git', ['cat-file', 'blob', 'refs/test/j:chantier.json'], { cwd: D.clone, encoding: 'utf8', env: ENV }).stdout, e.texte);
  assert.equal(r.empreinte, e.empreinte);
  assert.equal(r.confirmation, `ATELIER-SAUVEGARDE-1 chantier=temoin-atelier empreinte=${e.empreinte} commit=${r.commit}`);
  // main, l'étiquette et toute autre référence sont inchangés : seule la branche journal s'ajoute.
  assert.deepEqual(D.refs().split('\n').filter((l) => !l.endsWith(`refs/heads/${BRANCHE}`)), avant.split('\n'));
  assert.equal(D.refs().split('\n').length, avant.split('\n').length + 1);
});

test('un commit par sauvegarde effective, en avance rapide ; état identique : aucun commit ; ordre de collage libre', async () => {
  const D = depot();
  // Trois sauvegardes effectives (création puis deux avances rapides) ; le doublon exact est rejoué sur la branche à plusieurs commits.
  const etapes = ['ouvert', 'lancee', 'decide'];
  const commits = [];
  for (const s of etapes) {
    const r = sauver({ depot: D.clone, parties: [...parties(ETATS[s])].reverse(), env: ENV });
    assert.equal(r.statut, commits.length === 0 ? 'creee' : 'avancee', s);
    commits.push(r.commit);
  }
  const refs = D.refs();
  const dup = sauver({ depot: D.clone, parties: parties(ETATS['decide']), env: ENV });
  assert.deepEqual([dup.statut, dup.commit], ['identique', commits.at(-1)]);
  assert.equal(D.refs(), refs);
  git(D.clone, 'fetch', '-q', 'origin', `refs/heads/${BRANCHE}:refs/test/j`);
  assert.deepEqual(git(D.clone, 'rev-list', '--reverse', 'refs/test/j').split('\n'), commits);
  assert.deepEqual(git(D.clone, 'rev-list', '--max-parents=0', 'refs/test/j'), commits[0]);
  for (const c of commits) assert.equal(git(D.clone, 'ls-tree', '--name-only', c), 'chantier.json');
  const b = lireBranche({ depot: D.clone, chantier: 'temoin-atelier', env: ENV });
  assert.deepEqual([b.tete, b.commits, b.texte], [commits.at(-1), etapes.length, (ETATS['decide']).texte]);
  // Une sauvegarde peut sauter des étapes : seule compte l'extension de l'état précédent.
  git(D.origine, 'update-ref', `refs/heads/${BRANCHE}`, commits[0]); // la branche distante revient à la première sauvegarde (fixture)
  assert.equal(sauver({ depot: D.clone, parties: parties(ETATS['decide']), env: ENV }).statut, 'avancee');
});

test('régression, réécriture et divergence : STOP, rien n\'est poussé', async () => {
  const D = depot();
  const r = sauver({ depot: D.clone, parties: parties(ETATS['faits']), env: ENV });
  const refs = D.refs();
  assert.throws(() => sauver({ depot: D.clone, parties: parties(ETATS['rendue']), env: ENV }), STOP(/divergence avec journal-atelier\/temoin-atelier : pièce « temoin-1\/1 » : faits raccourcis|journal AT-1 non prolongé|demande modifiée/));
  assert.throws(() => sauver({ depot: D.clone, parties: parties(ETATS.divergent), env: ENV }), STOP(/divergence avec journal-atelier\/temoin-atelier/));
  // Réécriture : même longueur de journal, un événement modifié (état valide en soi).
  const v = JSON.parse((ETATS['faits']).texte);
  v.journal[0].quand = '2026-10-17T15:00:59.000Z';
  const reecrit = canonique(v);
  assert.throws(() => sauver({ depot: D.clone, parties: decouper(reecrit, 'temoin-atelier'), env: ENV }), STOP(/journal AT-1 non prolongé/));
  assert.equal(D.refs(), refs);
  assert.equal(teteDistante(D), r.commit);
});

test('entrées refusées avant toute écriture : parties manquantes, mélangées, état invalide, autre chantier', async () => {
  const D = depot();
  const refs = D.refs();
  const grand = GRAND;
  const p = decouper(grand.texte, 'temoin-atelier');
  assert.ok(p.length >= 2, String(p.length));
  assert.throws(() => sauver({ depot: D.clone, parties: p.slice(1), env: ENV }), STOP(/parties manquantes : 1 sur \d+/));
  assert.throws(() => sauver({ depot: D.clone, parties: [p[0], parties(ETATS['decide'])[0]], env: ENV }), STOP(/mélange de deux sauvegardes|nombre de parties différent/));
  const v = JSON.parse((ETATS['faits']).texte);
  v.pieces['temoin-1/1'].demande = null;
  assert.throws(() => sauver({ depot: D.clone, parties: decouper(canonique(v), 'temoin-atelier'), env: ENV }), STOP(/état durable invalide : pièces incohérentes/));
  assert.throws(() => sauver({ depot: D.clone, parties: decouper((ETATS['faits']).texte, 'autre-chantier'), env: ENV }), STOP(/chantier des parties différent/));
  assert.throws(() => sauver({ depot: D.clone, parties: [], env: ENV }), STOP(/aucune partie/));
  assert.equal(D.refs(), refs);
  // Plusieurs parties, dans le désordre : un seul commit, contenu exact.
  const r = sauver({ depot: D.clone, parties: [p[1], ...p.slice(2), p[0]], env: ENV });
  assert.equal(spawnSync('git', ['cat-file', 'blob', `${r.commit}:chantier.json`], { cwd: D.clone, encoding: 'utf8', env: ENV }).stdout, grand.texte);
});
test('branche journal existante mais étrangère : autre fichier, ancêtre de main, fusion, état invalide : STOP en lecture', async () => {
  const e = ETATS['lancee'];
  // Fabrique (hors outil, par plomberie dans l'origine nue) une histoire distante pour la branche journal.
  const D = depot();
  const fabriquer = (fichiers, parents = []) => {
    const lignes = Object.entries(fichiers).map(([n, c]) => `100644 blob ${gitEntree(D.origine, c, 'hash-object', '-w', '--stdin')}\t${n}\n`).join('');
    const c = gitEntree(D.origine, '', 'commit-tree', gitEntree(D.origine, lignes, 'mktree'), ...parents.flatMap((x) => ['-p', x]), '-m', 'étranger');
    git(D.origine, 'update-ref', `refs/heads/${BRANCHE}`, c);
    return c;
  };
  const cas = [
    [() => fabriquer({ 'chantier.json': e.texte, 'autre.txt': 'x\n' }), /ne contient pas exactement chantier\.json/],
    [() => fabriquer({ 'chantier.json': e.texte }, [D.main]), /n'est pas une histoire linéaire née d'une racine orpheline|ancêtre commun avec main/],
    [() => { const a = fabriquer({ 'chantier.json': e.texte }); return fabriquer({ 'chantier.json': e.texte }, [a, D.main]); }, /contient une fusion/],
    [() => fabriquer({ 'chantier.json': e.texte.replace(/\n$/, '') }), /état du commit [0-9a-f]{40} invalide : forme non canonique/],
    [() => fabriquer({ 'chantier.json': e.texte.replace(/"temoin-atelier"/g, '"temoin-autre"') }), /porte le chantier « temoin-autre »/],
    [() => { const a = fabriquer({ 'chantier.json': e.texte }); return fabriquer({ 'chantier.json': e.texte }, [a]); }, /répète l'état précédent/],
  ];
  for (const [i, [f, re]] of cas.entries()) {
    const tete = f();
    const refs = D.refs();
    assert.throws(() => sauver({ depot: D.clone, parties: parties(ETATS['faits']), env: ENV }), STOP(re), String(re));
    if (i < 2) assert.throws(() => restaurer({ depot: D.clone, chantier: 'temoin-atelier', env: ENV }), STOP(re), String(re));
    assert.equal(D.refs(), refs); // rien n'a bougé : la tête distante est toujours la branche fabriquée
    assert.ok(refs.includes(`${tete}\trefs/heads/${BRANCHE}`));
  }
  // Témoin : une racine orpheline valide fabriquée de même est acceptée et prolongée.
  fabriquer({ 'chantier.json': e.texte });
  assert.equal(sauver({ depot: D.clone, parties: parties(ETATS['faits']), env: ENV }).statut, 'avancee');
});

test('restaurer : tête relue entière, redécoupée en parties exactes ; branche absente : STOP', async () => {
  const D = depot();
  assert.throws(() => restaurer({ depot: D.clone, chantier: 'temoin-atelier', env: ENV }), STOP(/n'existe pas/));
  sauver({ depot: D.clone, parties: parties(ETATS['lancee']), env: ENV });
  const grand = GRAND;
  const r = sauver({ depot: D.clone, parties: decouper(grand.texte, 'temoin-atelier'), env: ENV });
  const x = restaurer({ depot: D.clone, chantier: 'temoin-atelier', env: ENV });
  assert.deepEqual([x.commit, x.commits, x.empreinte, x.branche], [r.commit, 2, grand.empreinte, BRANCHE]);
  assert.ok(x.parties.length >= 2);
  assert.equal(assemblerParties(x.parties).contenu, grand.texte);
  assert.throws(() => restaurer({ depot: D.clone, chantier: 'Pas-Valide', env: ENV }), STOP(/identifiant de chantier invalide/));
});

test('ligne de commande : sauver depuis des fichiers de parties, restaurer vers un dossier ; STOP => code 1, rien d\'écrit', async () => {
  const D = depot();
  const e = GRAND;
  const p = decouper(e.texte, 'temoin-atelier');
  const fichiers = p.map((x, i) => { const f = join(D.d, `p${i + 1}.txt`); writeFileSync(f, x); return f; });
  const cli = (...a) => spawnSync(process.execPath, [OUTIL, ...a], { encoding: 'utf8', env: ENV });
  const ok = cli('sauver', '--depot', D.clone, ...fichiers.flatMap((f) => ['--partie', f]));
  assert.equal(ok.status, 0, ok.stderr);
  const derniere = ok.stdout.trim().split('\n').at(-1);
  assert.match(derniere, new RegExp(`^ATELIER-SAUVEGARDE-1 chantier=temoin-atelier empreinte=${e.empreinte} commit=[0-9a-f]{40}$`));
  const sortie = join(D.d, 'retour');
  // restaurer par le même point d'entrée (principal), dans ce processus : le passage par un processus est déjà prouvé par sauver ci-dessus.
  assert.match(principal(['restaurer', '--depot', D.clone, '--chantier', 'temoin-atelier', '--sortie', sortie], ENV), /"parties": \d+/);
  const noms = readdirSync(sortie).sort();
  assert.equal(noms.length, p.length);
  assert.deepEqual(noms.map((n) => readFileSync(join(sortie, n), 'utf8')), p.map((_, i) => readFileSync(join(sortie, `partie-${i + 1}.txt`), 'utf8')));
  assert.deepEqual(p.map((_, i) => readFileSync(join(sortie, `partie-${i + 1}.txt`), 'utf8')), p);
  const refs = D.refs();
  const ko = cli('sauver', '--depot', D.clone, '--partie', fichiers[0]);
  assert.equal(ko.status, 1);
  assert.match(ko.stderr, /^STOP : parties manquantes/);
  assert.throws(() => principal(['effacer', '--depot', D.clone]), STOP(/commande inconnue : effacer/));
  assert.throws(() => principal(['sauver', '--depot', D.clone, '--force', 'x']), STOP(/option inconnue : --force/));
  assert.throws(() => principal(['sauver']), STOP(/--depot attendu/));
  assert.equal(D.refs(), refs);
  assert.throws(() => principal(['restaurer', '--depot', D.clone, '--chantier', 'temoin-atelier']), STOP(/--sortie attendu/));
});

test('l\'outil ne peut ni forcer, ni supprimer, ni étiqueter, ni toucher main : une seule forme de push, sans option', () => {
  const src = readFileSync(OUTIL, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  assert.doesNotMatch(code, /--force|force-with-lease|'-f'|--delete|--mirror|--all\b|--tags|'\+|`\+|\+refs|:refs\/tags|'tag'|update-ref', '(?!-d)|reset|rebase|merge'|checkout|'commit'|'add'|shell:\s*true|execSync|secrets\.|_TOKEN|https?:/);
  // main n'est que LU (ls-remote, fetch vers une ref locale privée, puis l'ancêtre commun) : ses trois seules mentions, aucune écriture.
  const lignesMain = code.split('\n').filter((l) => l.includes('refs/heads/main'));
  assert.deepEqual(lignesMain.map((l) => l.trim()), ["const tetes = tetesDistantes(depot, distant, [ref, 'refs/heads/main'], env);", "const main = tetes['refs/heads/main'];", "rapatrier(depot, distant, 'refs/heads/main', 'refs/atelier-journal-main/main', main, env);"]);
  const pushes = [...code.matchAll(/\['push'[^\]]*\]/g)].map((m) => m[0]);
  assert.deepEqual(pushes, ["['push', '--quiet', distant, `${commit}:refs/heads/${branche}`]"]);
  const sous = [...new Set([...code.matchAll(/git(?:\(depot|\(depot, )?, \['([a-z-]+)'|lancerGit\(depot, \['([a-z-]+)'/g)].map((m) => m[1] ?? m[2]))].sort();
  assert.deepEqual(sous, ['cat-file', 'commit-tree', 'fetch', 'hash-object', 'ls-remote', 'ls-tree', 'merge-base', 'mktree', 'push', 'rev-list', 'rev-parse', 'update-ref']);
  assert.match(code, /lancerGit\(depot, \['update-ref', '-d', locale\]/);
  assert.match(code, /`refs\/atelier-journal\/\$\{chantier\}`/);
  assert.match(src.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  // Hors APK : aucun fichier de app/ ne l'importe ; il n'importe de l'atelier que journal.js.
  assert.deepEqual([...code.matchAll(/from '(\.\.\/[^']+)'/g)].map((m) => m[1]), ['../app/atelier/journal.js']);
});
