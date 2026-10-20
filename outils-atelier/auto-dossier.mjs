// === DEBUT_ATELIER_AUTO_DOSSIER ===
// v0.65.13 — AT-9.1 « APPEL DE DÉVELOPPEMENT À BLANC » (GO « AT-9.1 — GO OUTILLAGE APPEL DE DÉVELOPPEMENT », 20/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — outil HORS APK, lancé par le job J2 APRÈS la frontière et AVANT la préparation de l'appel. Aucun réseau,
// aucun secret, aucune écriture Git : il LIT, dans le dépôt local de main (historique complet), le contenu exact à la base de chaque
// fichier autorisé et de chaque fichier d'extrait (AT-9.2) d'une tentative portant un développement, et le dépose dans
// D/fichiers-base.json (atelier-auto-fichiers-1 ; seuls les EXTRAITS déclarés seront transmis au modèle) :
//   { chemin, etat: 'present', contenu }   fichier ordinaire (100644 ou 100755) en UTF-8 valide, <= 256 Kio
//   { chemin, etat: 'absent', contenu: null }   chemin absent à la base (création permise)
//   { chemin, etat: 'illisible', contenu: null } tout le reste (dossier, lien, sous-module, binaire, trop grand) : l'appel sera refusé
// Commandes git par listes d'arguments, sans shell : cat-file et ls-tree seulement.
//   node outils-atelier/auto-dossier.mjs --dossier D --depot R   -> sortie 0 = fichiers déposés ou sans objet (pas de développement),
//                                                                  1 = arrêt (état refusé, base introuvable) : aucune requête ne suivra

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { missionDeveloppement, BORNES_DEVELOPPEMENT, PROTOCOLE_FICHIERS } from '../app/atelier/auto.js';
import { canonique } from '../app/atelier/journal.js';
import { lireVariables, entreesDe, lireJournal } from './auto-garde.mjs';

const RE_ENTREE = /^(100644|100755) blob ([0-9a-f]{40})\t([^\0]+)\0$/;

function git(depot, args, env) {
  const r = spawnSync('git', ['-C', depot, ...args], { maxBuffer: 4 * BORNES_DEVELOPPEMENT.fichier_octets, env: { ...env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } });
  return { code: r.status, sortie: r.stdout ?? Buffer.alloc(0) };
}

// Contenu exact d'un chemin à la base, ou son état.
export function lireABase(depot, base, chemin, env) {
  const ls = git(depot, ['ls-tree', '-z', base, '--', chemin], env);
  if (ls.code !== 0) return null;
  const ligne = ls.sortie.toString('utf8');
  if (ligne === '') return { chemin, etat: 'absent', contenu: null };
  const m = RE_ENTREE.exec(ligne);
  if (!m || m[3] !== chemin) return { chemin, etat: 'illisible', contenu: null };
  const blob = git(depot, ['cat-file', 'blob', m[2]], env);
  if (blob.code !== 0) return null;
  if (blob.sortie.length > BORNES_DEVELOPPEMENT.fichier_octets) return { chemin, etat: 'illisible', contenu: null };
  try { return { chemin, etat: 'present', contenu: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(blob.sortie) }; } catch { return { chemin, etat: 'illisible', contenu: null }; }
}

export function executer({ env, dossier, depot }) {
  const v = lireVariables(env);
  const md = missionDeveloppement({ entrees: entreesDe(v), journal: lireJournal(dossier) });
  const dire = (ligne, texte) => { if (v.GITHUB_STEP_SUMMARY !== '') fs.appendFileSync(v.GITHUB_STEP_SUMMARY, `## Atelier AUTO — J2 fichiers de la base : ${ligne}\n\n${texte}\n`); };
  if (md.sansObjet) { dire('SANS OBJET', 'Tentative sans développement : aucun fichier lu.'); return { code: 0, ligne: 'SANS_OBJET' }; }
  if (md.raison) { dire('ARRET', `Raison : \`${md.raison}\`. Aucune requête ne suivra.`); return { code: 1, ligne: `ARRET ${md.raison}` }; }
  if (git(depot, ['cat-file', '-e', `${md.base}^{commit}`], env).code !== 0) { dire('ARRET', 'Raison : `base-introuvable`.'); return { code: 1, ligne: 'ARRET base-introuvable' }; }
  const fichiers = md.chemins.map((c) => lireABase(depot, md.base, c, env));
  if (fichiers.includes(null)) { dire('ARRET', 'Raison : `lecture-git-impossible`.'); return { code: 1, ligne: 'ARRET lecture-git-impossible' }; }
  fs.writeFileSync(path.join(dossier, 'fichiers-base.json'), canonique({ protocole: PROTOCOLE_FICHIERS, base: md.base, fichiers }));
  dire('DEPOSES', fichiers.map((f) => `- \`${f.chemin}\` : ${f.etat}`).join('\n'));
  return { code: 0, ligne: `DEPOSES ${fichiers.length}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dossier');
  const j = process.argv.indexOf('--depot');
  if (i < 0 || !process.argv[i + 1] || j < 0 || !process.argv[j + 1]) { process.stderr.write('usage : node outils-atelier/auto-dossier.mjs --dossier D --depot R\n'); process.exit(2); }
  const r = executer({ env: process.env, dossier: process.argv[i + 1], depot: process.argv[j + 1] });
  process.stdout.write(`${r.ligne}\n`);
  process.exit(r.code);
}
// === FIN_ATELIER_AUTO_DOSSIER ===
