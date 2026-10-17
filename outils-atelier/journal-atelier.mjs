// === DEBUT_ATELIER_JOURNAL_GIT ===
// v0.65.7 — AT-7 « JOURNAL GIT + REPRISE » (GO « AT-7 v0.65.7 — GO IMPLÉMENTATION », 17/10/2026 ; D-007, précision D4).
// OUTILLAGE NON COGNITIF — outil MANUEL HORS APK (hors app/), lancé par Claude dans un clone du dépôt après le collage, par Christophe,
// des parties d'UNE sauvegarde. Il ne parle qu'au dépôt distant de ce clone, par git ; l'application elle-même n'a aucun réseau.
//   sauver    --depot D --partie F [--partie F …] [--distant origin]  -> confirmation ATELIER-SAUVEGARDE-1 (sortie standard)
//   restaurer --depot D --chantier ID [--distant origin] --sortie DOSSIER -> partie-<k>.txt, une par message pour le téléphone
// AUTORISATION (D-007, D4) : viser journal-atelier/<chantier> ; la créer ORPHELINE si absente, sinon l'avancer en AVANCE RAPIDE ;
// n'y écrire que chantier.json, au contenu exact reconstitué, seulement s'il est valide et prolonge l'état durable précédent.
// Un commit par sauvegarde effective ; un état identique ne crée aucun commit. Toute divergence : STOP, rien n'est poussé.
// JAMAIS : force-push, suppression, réécriture, fusion, main, étiquette, branche candidate, autre fichier, réparation silencieuse.
// Le push n'a qu'une forme, « git push <distant> <commit>:refs/heads/journal-atelier/<chantier> », sans option : le dépôt distant refuse
// lui-même tout ce qui n'est pas une avance rapide. Les lectures passent par « git ls-remote » et « git fetch » vers des refs locales
// privées refs/atelier-journal/*. Commandes par listes d'arguments, sans shell. Aucun secret lu, écrit ni affiché.
// Git est un lieu durable, jamais une autorité : chaque commit de la branche est relu par le même protocole pur (journal.js).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemblerParties, lireEtatDurable, comparerEtats, decouper, texteConfirmation, brancheJournal } from '../app/atelier/journal.js';

const FICHIER = 'chantier.json';
const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_SHA = /^[0-9a-f]{40}$/;

export class Stop extends Error {}
const stop = (raison) => { throw new Stop(`STOP : ${raison}`); };

function lancerGit(depot, args, env, entree) {
  const r = spawnSync('git', ['-C', depot, ...args], { encoding: 'utf8', input: entree, maxBuffer: 64 * 1024 * 1024, env: { ...env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } });
  return { code: r.status, sortie: r.stdout ?? '', erreur: `${r.stderr ?? ''}${r.error ? r.error.message : ''}`.trim() };
}
function git(depot, args, env, entree) {
  const r = lancerGit(depot, args, env, entree);
  if (r.code !== 0) stop(`git ${args[0]} a échoué : ${r.erreur}`);
  return r.sortie;
}

// Têtes distantes de références exactes (une seule lecture) : { ref: sha | null }.
function tetesDistantes(depot, distant, refs, env) {
  const lignes = git(depot, ['ls-remote', distant, ...refs], env).split('\n').filter(Boolean).map((l) => l.split('\t'));
  return Object.fromEntries(refs.map((ref) => {
    const exactes = lignes.filter(([, r]) => r === ref);
    if (exactes.length > 1 || (exactes.length === 1 && !RE_SHA.test(exactes[0][0]))) stop(`référence distante ${ref} ambiguë`);
    return [ref, exactes.length === 1 ? exactes[0][0] : null];
  }));
}
const teteDistante = (depot, distant, ref, env) => tetesDistantes(depot, distant, [ref], env)[ref];
// Rend le commit distant lisible ici : déjà présent (adressage par contenu), rien à faire ; sinon fetch vers une ref locale privée.
function rapatrier(depot, distant, ref, locale, sha, env) {
  if (lancerGit(depot, ['cat-file', '-e', `${sha}^{commit}`], env).code === 0) return;
  lancerGit(depot, ['update-ref', '-d', locale], env);
  git(depot, ['fetch', '--no-tags', '--quiet', distant, `${ref}:${locale}`], env);
  if (git(depot, ['rev-parse', '--verify', `${locale}^{commit}`], env).trim() !== sha) stop(`${ref} a bougé pendant la lecture`);
}

// Lecture COMPLÈTE de la branche journal existante : histoire linéaire née d'une racine orpheline, aucun ancêtre commun avec main,
// chaque commit ne contient que chantier.json, chaque état est valide, du même chantier, et prolonge strictement le précédent.
export function lireBranche({ depot, distant = 'origin', chantier, env = process.env }) {
  if (typeof chantier !== 'string' || chantier.length > 40 || !RE_ID.test(chantier)) stop('identifiant de chantier invalide');
  const ref = `refs/heads/${brancheJournal(chantier)}`;
  const tetes = tetesDistantes(depot, distant, [ref, 'refs/heads/main'], env);
  const tete = tetes[ref];
  if (tete === null) return null;
  rapatrier(depot, distant, ref, `refs/atelier-journal/${chantier}`, tete, env);
  const lignes = git(depot, ['rev-list', '--reverse', '--parents', tete], env).split('\n').filter(Boolean).map((l) => l.split(' '));
  if (lignes.some((l) => l.length > 2)) stop(`${ref} contient une fusion`);
  if (lignes[0].length !== 1 || lignes.slice(1).some((l, i) => l[1] !== lignes[i][0])) stop(`${ref} n'est pas une histoire linéaire née d'une racine orpheline`);
  const main = tetes['refs/heads/main'];
  if (main !== null) {
    rapatrier(depot, distant, 'refs/heads/main', 'refs/atelier-journal-main/main', main, env);
    if (lancerGit(depot, ['merge-base', tete, main], env).code === 0) stop(`${ref} a un ancêtre commun avec main`);
  }
  let precedent = null;
  let texte = null;
  for (const [commit] of lignes) {
    const arbre = git(depot, ['ls-tree', commit], env).split('\n').filter(Boolean);
    if (arbre.length !== 1 || !/^100644 blob [0-9a-f]{40}\tchantier\.json$/.test(arbre[0])) stop(`${ref} : le commit ${commit} ne contient pas exactement ${FICHIER}`);
    texte = git(depot, ['cat-file', 'blob', `${commit}:${FICHIER}`], env);
    const lu = lireEtatDurable(texte);
    if (lu.raison) stop(`${ref} : état du commit ${commit} invalide : ${lu.raison}`);
    if (lu.durable.chantier !== chantier) stop(`${ref} : le commit ${commit} porte le chantier « ${lu.durable.chantier} »`);
    if (precedent) {
      const c = comparerEtats(precedent, lu.durable);
      if (c.raison) stop(`${ref} : le commit ${commit} ne prolonge pas le précédent : ${c.raison}`);
      if (c.statut === 'identique') stop(`${ref} : le commit ${commit} répète l'état précédent`);
    }
    precedent = lu.durable;
  }
  return { tete, texte, durable: precedent, commits: lignes.length };
}

// Sauvegarde : parties -> état durable valide -> branche créée orpheline, ou avancée, ou laissée telle quelle si l'état est identique.
export function sauver({ depot, parties, distant = 'origin', env = process.env }) {
  const a = assemblerParties(parties);
  if (a.statut === 'incomplet') stop(`parties manquantes : ${a.manquantes.join(', ')} sur ${a.N}`);
  if (a.statut !== 'complet') stop(a.raison || 'aucune partie');
  const lu = lireEtatDurable(a.contenu);
  if (lu.raison) stop(`état durable invalide : ${lu.raison}`);
  if (lu.durable.chantier !== a.chantier) stop('chantier des parties différent de celui de l\'état');
  const chantier = a.chantier;
  const branche = brancheJournal(chantier);
  const avant = lireBranche({ depot, distant, chantier, env });
  const resultat = (statut, commit) => ({ statut, chantier, branche, commit, empreinte: a.empreinte, confirmation: texteConfirmation({ chantier, empreinte: a.empreinte, commit }) });
  if (avant) {
    const c = comparerEtats(avant.durable, lu.durable);
    if (c.raison) stop(`divergence avec ${branche} : ${c.raison}`);
    if (c.statut === 'identique') return resultat('identique', avant.tete);
  }
  const blob = git(depot, ['hash-object', '-w', '--no-filters', '--stdin'], env, a.contenu).trim();
  const arbre = git(depot, ['mktree'], env, `100644 blob ${blob}\t${FICHIER}\n`).trim();
  const parent = avant ? ['-p', avant.tete] : [];
  const commit = git(depot, ['commit-tree', arbre, ...parent, '-m', `${branche} : sauvegarde ${a.empreinte}`], env).trim();
  if (git(depot, ['cat-file', 'blob', `${commit}:${FICHIER}`], env) !== a.contenu) stop('contenu écrit différent du contenu reconstitué');
  git(depot, ['push', '--quiet', distant, `${commit}:refs/heads/${branche}`], env);
  if (teteDistante(depot, distant, `refs/heads/${branche}`, env) !== commit) stop(`${branche} distante différente du commit poussé`);
  return resultat(avant ? 'avancee' : 'creee', commit);
}

// Restauration : la tête de la branche, relue entière, redécoupée en parties pour le téléphone.
export function restaurer({ depot, chantier, distant = 'origin', env = process.env }) {
  const b = lireBranche({ depot, distant, chantier, env });
  if (!b) stop(`${brancheJournal(chantier)} n'existe pas`);
  const lu = lireEtatDurable(b.texte);
  return { chantier, branche: brancheJournal(chantier), commit: b.tete, commits: b.commits, empreinte: lu.empreinte, parties: decouper(b.texte, chantier) };
}

function options(args) {
  const o = { partie: [] };
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i];
    if (!k.startsWith('--') || i + 1 >= args.length) stop(`option illisible : ${k}`);
    const nom = k.slice(2);
    if (!['depot', 'partie', 'distant', 'chantier', 'sortie'].includes(nom)) stop(`option inconnue : ${k}`);
    if (nom === 'partie') o.partie.push(args[i + 1]); else o[nom] = args[i + 1];
  }
  return o;
}

export function principal(argv, env = process.env) {
  const [commande, ...reste] = argv;
  const o = options(reste);
  if (!o.depot) stop('--depot attendu');
  if (commande === 'sauver') {
    const r = sauver({ depot: o.depot, distant: o.distant, env, parties: o.partie.map((f) => fs.readFileSync(f, 'utf8')) });
    return `${JSON.stringify({ ...r, confirmation: undefined }, null, 2)}\n${r.confirmation}\n`;
  }
  if (commande === 'restaurer') {
    if (!o.sortie) stop('--sortie attendu');
    const r = restaurer({ depot: o.depot, distant: o.distant, chantier: o.chantier, env });
    fs.mkdirSync(o.sortie, { recursive: true });
    r.parties.forEach((p, i) => fs.writeFileSync(path.join(o.sortie, `partie-${i + 1}.txt`), p));
    return `${JSON.stringify({ ...r, parties: r.parties.length }, null, 2)}\n`;
  }
  return stop(`commande inconnue : ${commande}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try { process.stdout.write(principal(process.argv.slice(2))); } catch (e) {
    process.stderr.write(`${e instanceof Stop ? e.message : `STOP : ${e.message}`}\n`);
    process.exitCode = 1;
  }
}
// === FIN_ATELIER_JOURNAL_GIT ===
