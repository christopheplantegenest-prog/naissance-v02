// === DEBUT_ATELIER_AUTO_CANDIDAT ===
// v0.65.13 — AT-9.1 « APPEL DE DÉVELOPPEMENT À BLANC » (GO « AT-9.1 — GO OUTILLAGE APPEL DE DÉVELOPPEMENT », 20/10/2026 ; D-007),
// format AT-9.2 « REMPLACEMENTS EXACTS » : J4 relit LUI-MÊME dans Git les fichiers de la base et y RÉAPPLIQUE les remplacements.
// OUTILLAGE NON COGNITIF — outil HORS APK, lancé par le job J4 « candidat » (sans environnement, sans secret, autre runner que J2),
// seulement si J2 a réussi (réponse connue ET proposition valide). Aucun réseau ici. Il ne lance, n'importe et n'interprète JAMAIS le
// contenu proposé : il l'écrit comme données dans des objets Git, par la plomberie (read-tree, hash-object --no-filters, update-index,
// write-tree, commit-tree) dans un index temporaire, sans copie de travail, sans crochet, sans filtre. Commandes git par listes
// d'arguments, sans shell. La poussée (jeton du job, création seule de atelier/<T>) est faite par le workflow, pas ici.
//   --construire   relit l'état durable (tete.txt, chantier.json), les faits de l'appel (faits-appel.json), la proposition
//                  (proposition.json, artefact de CE run) et les fichiers de la base dans Git (D/fichiers-base-j4.json) ; auto.js
//                  (preparerCandidat) réapplique et décide ; écrit le commit candidat (date et identité fixées : même proposition,
//                  même commit) ; D/candidat-branche.txt, D/candidat-sha.txt ; sortie 0 = prêt
//   --constater    relit la branche distante déposée par le workflow (distant.txt) : faits atelier-auto-candidat-1 dans
//                  D/faits-candidat.json et le résumé du run ; sortie 0 = branche créée au commit calculé, 1 sinon
// Une branche existante n'est jamais écrasée (le workflow pousse en création seule ; la règle atelier-integrite interdit la réécriture).
// v0.65.21 — AT-10.4 (D-007) : les faits du candidat sont aussi écrits sur la sortie en annotations ATELIER-FAITS-1 j4 (retour.js), relues par Claude.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preparerCandidat, faitsCandidat, missionDeveloppement, PROTOCOLE_FICHIERS } from '../app/atelier/auto.js';
import { canonique } from '../app/atelier/journal.js';
import { lireABase } from './auto-dossier.mjs';
import { lireVariables, entreesDe, contexteDe, lireFichier, lireJournal } from './auto-garde.mjs';
import { annotationsFaits } from '../app/atelier/retour.js';

const IDENTITE = Object.freeze({ nom: 'github-actions[bot]', courriel: '41898282+github-actions[bot]@users.noreply.github.com' });
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_ENTREE = /^(100644|100755) blob ([0-9a-f]{40})\t([^\0]+)\0$/;

function git(depot, args, env, entree) {
  const r = spawnSync('git', ['-C', depot, ...args], { input: entree, maxBuffer: 64 * 1024 * 1024, env: { ...env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } });
  return { code: r.status, sortie: (r.stdout ?? Buffer.alloc(0)).toString('utf8') };
}

// Fichiers de la base relus par J4 dans Git (même lecteur que J2) : écrits dans D/fichiers-base-j4.json (relu par --constater).
function relireBase(v, dossier, depot, env) {
  fs.rmSync(path.join(dossier, 'fichiers-base-j4.json'), { force: true });
  const md = missionDeveloppement({ entrees: entreesDe(v), journal: lireJournal(dossier) });
  if (md.raison || md.sansObjet) return;
  const fichiers = md.chemins.map((c) => lireABase(depot, md.base, c, env));
  if (!fichiers.includes(null)) fs.writeFileSync(path.join(dossier, 'fichiers-base-j4.json'), canonique({ protocole: PROTOCOLE_FICHIERS, base: md.base, fichiers }));
}
function preparer(env, dossier) {
  const v = lireVariables(env);
  let fichiersBase = null;
  try { fichiersBase = JSON.parse(lireFichier(dossier, 'fichiers-base-j4.json') || 'null'); } catch { fichiersBase = null; }
  const prep = preparerCandidat({ entrees: entreesDe(v), contexte: contexteDe(v), journal: lireJournal(dossier), faitsAppelTexte: lireFichier(dossier, 'faits-appel.json'), propositionTexte: lireFichier(dossier, 'proposition.json'), fichiersBase });
  return { v, prep };
}

// Commit candidat = base + fichiers proposés, dans un index temporaire. Rend { sha } ou { raison }.
export function construireCommit({ depot, prep, env, index }) {
  const g = (args, entree) => git(depot, args, { ...env, GIT_INDEX_FILE: index }, entree);
  if (g(['cat-file', '-e', `${prep.base}^{commit}`]).code !== 0) return { raison: 'base-introuvable' };
  if (g(['read-tree', prep.base]).code !== 0) return { raison: 'index-impossible' };
  for (const f of prep.fichiers) {
    const ls = g(['ls-tree', '-z', prep.base, '--', f.chemin]);
    if (ls.code !== 0) return { raison: 'lecture-git-impossible' };
    const m = RE_ENTREE.exec(ls.sortie);
    if (f.etat === 'cree' ? ls.sortie !== '' : !m || m[3] !== f.chemin) return { raison: 'base-differente' };
    const blob = g(['hash-object', '-w', '--no-filters', '--stdin'], Buffer.from(f.contenu, 'utf8'));
    const oid = blob.sortie.trim();
    if (blob.code !== 0 || !RE_SHA.test(oid)) return { raison: 'ecriture-objet-impossible' };
    if (f.etat === 'modifie' && oid === m[2]) return { raison: 'base-differente' };
    if (g(['update-index', '--add', '--cacheinfo', `${f.etat === 'cree' ? '100644' : m[1]},${oid},${f.chemin}`]).code !== 0) return { raison: 'index-impossible' };
  }
  const arbre = g(['write-tree']);
  if (arbre.code !== 0 || !RE_SHA.test(arbre.sortie.trim())) return { raison: 'index-impossible' };
  const date = `@${prep.secondes} +0000`;
  const c = git(depot, ['commit-tree', arbre.sortie.trim(), '-p', prep.base, '-m', prep.message], {
    ...env, GIT_AUTHOR_NAME: IDENTITE.nom, GIT_AUTHOR_EMAIL: IDENTITE.courriel, GIT_AUTHOR_DATE: date, GIT_COMMITTER_NAME: IDENTITE.nom, GIT_COMMITTER_EMAIL: IDENTITE.courriel, GIT_COMMITTER_DATE: date,
  });
  const sha = c.sortie.trim();
  return c.code === 0 && RE_SHA.test(sha) ? { sha } : { raison: 'commit-impossible' };
}

function ecrireFaitsEtResume(v, dossier, r) {
  fs.writeFileSync(path.join(dossier, 'faits-candidat.json'), r.texte);
  const f = r.faits;
  const suite = f.statut === 'cree'
    ? `Branche \`${f.candidat.branche}\` créée au commit \`${f.candidat.sha}\`. La vérification AT-5 est une demande SÉPARÉE (aucun lancement en chaîne).\n\n`
    : '**Aucun candidat : rien n\'est à vérifier.**\n\n';
  if (v.GITHUB_STEP_SUMMARY !== '') fs.appendFileSync(v.GITHUB_STEP_SUMMARY, `## Atelier AUTO — J4 candidat : ${f.statut.toUpperCase()}\n\n${f.raison ? `Raison : \`${f.raison}\`\n\n` : ''}${suite}Faits à copier tels quels :\n\n\`\`\`json\n${r.texte}\`\`\`\n`);
  return annotationsFaits('j4', r.texte);
}

export function construire({ env, dossier, depot }) {
  relireBase(lireVariables(env), dossier, depot, env);
  const { v, prep } = preparer(env, dossier);
  let raison = prep.raison || null;
  let commit = null;
  if (!raison) {
    const c = construireCommit({ depot, prep, env, index: path.join(dossier, 'index-candidat') });
    if (c.raison) raison = c.raison;
    else commit = c.sha;
  }
  if (raison) {
    const r = faitsCandidat({ entrees: entreesDe(v), contexte: contexteDe(v), prep: prep.raison ? prep : { raison }, raison });
    return { code: 1, ligne: `NON-CREE ${raison}`, annotations: ecrireFaitsEtResume(v, dossier, r) };
  }
  fs.writeFileSync(path.join(dossier, 'candidat-branche.txt'), `${prep.branche}\n`);
  fs.writeFileSync(path.join(dossier, 'candidat-sha.txt'), `${commit}\n`);
  return { code: 0, ligne: `PRET ${prep.branche} ${commit}`, annotations: [] };
}

export function constater({ env, dossier }) {
  const { v, prep } = preparer(env, dossier);
  const commit = (lireFichier(dossier, 'candidat-sha.txt') || '').trim();
  const distant = (lireFichier(dossier, 'distant.txt') || '').trim();
  const r = faitsCandidat({ entrees: entreesDe(v), contexte: contexteDe(v), prep, commit: RE_SHA.test(commit) ? commit : null, distant: RE_SHA.test(distant) ? distant : null, raison: prep.raison || (RE_SHA.test(commit) ? 'poussee-refusee' : 'commit-absent') });
  const annotations = ecrireFaitsEtResume(v, dossier, r);
  return { code: r.faits.statut === 'cree' ? 0 : 1, ligne: `${r.faits.statut.toUpperCase()}${r.faits.raison ? ` ${r.faits.raison}` : ''}`, ...r, annotations };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dossier');
  const j = process.argv.indexOf('--depot');
  const mode = process.argv.includes('--construire') ? 'construire' : process.argv.includes('--constater') ? 'constater' : null;
  if (i < 0 || !process.argv[i + 1] || !mode || (mode === 'construire' && (j < 0 || !process.argv[j + 1]))) {
    process.stderr.write('usage : node outils-atelier/auto-candidat.mjs --dossier D (--construire --depot R | --constater)\n');
    process.exit(2);
  }
  const env = process.env;
  const r = mode === 'construire' ? construire({ env, dossier: process.argv[i + 1], depot: process.argv[j + 1] }) : constater({ env, dossier: process.argv[i + 1] });
  process.stdout.write(`${r.annotations.map((l) => `${l}\n`).join('')}${r.ligne}\n`);
  process.exit(r.code);
}
// === FIN_ATELIER_AUTO_CANDIDAT ===
