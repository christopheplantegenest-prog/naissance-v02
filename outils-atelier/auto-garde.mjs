// === DEBUT_ATELIER_AUTO_GARDE ===
// v0.65.9 — AT-8.1 « AUTO À BLANC » (GO « AT-8.1 — GO IMPLÉMENTATION À BLANC », 18/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — outil HORS APK (hors app/), lancé par le job J1 « garde » du workflow atelier-auto.yml. Aucun réseau, aucun
// secret, aucune écriture Git : les étapes du workflow déposent dans --dossier ce que le jeton du job a LU (contents:read, actions:read) :
//   tete.txt      tête actuelle de journal-atelier/<chantier> (vide si la branche est absente)
//   chantier.json contenu de chantier.json à cette tête (absent si la branche est absente)
//   total.txt     total_count des runs du workflow ; runs.jsonl : une ligne JSON { id, display_title, run_attempt, created_at } par run
// Puis la garde PURE (app/atelier/auto.js, garder) décide ; ce fichier ne fait que lire, appeler, écrire les faits.
//   node outils-atelier/auto-garde.mjs --dossier D   -> faits dans D/faits.json, résumé ajouté à $GITHUB_STEP_SUMMARY ;
//                                                       sortie 0 = AUTORISE, 1 = REFUS (le job J2 n'est alors jamais lancé)
// v0.65.21 — AT-10.4 (D-007) : les mêmes faits sont aussi écrits sur la sortie en annotations ATELIER-FAITS-1 j1 (retour.js), que
// Claude relit par l'API REST ; elles transportent les faits, elles ne les établissent pas.
// Variables lues (liste fermée) : ATELIER_CHANTIER, ATELIER_JALON, ATELIER_NUMERO, ATELIER_COMMIT, ATELIER_EMPREINTE, GITHUB_RUN_ID,
// GITHUB_RUN_ATTEMPT, GITHUB_WORKFLOW_SHA, GITHUB_REF, GITHUB_STEP_SUMMARY. Aucune autre.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { garder } from '../app/atelier/auto.js';
import { annotationsFaits } from '../app/atelier/retour.js';

export const VARIABLES = Object.freeze(['ATELIER_CHANTIER', 'ATELIER_JALON', 'ATELIER_NUMERO', 'ATELIER_COMMIT', 'ATELIER_EMPREINTE', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_WORKFLOW_SHA', 'GITHUB_REF', 'GITHUB_STEP_SUMMARY']);

export function lireVariables(env) {
  const v = {};
  for (const nom of VARIABLES) { const x = env[nom]; v[nom] = typeof x === 'string' ? x : ''; }
  return v;
}
export const entreesDe = (v) => ({ chantier: v.ATELIER_CHANTIER, jalon: v.ATELIER_JALON, numero: v.ATELIER_NUMERO, commit: v.ATELIER_COMMIT, empreinte: v.ATELIER_EMPREINTE });
export const contexteDe = (v) => ({ run_id: v.GITHUB_RUN_ID, run_attempt: v.GITHUB_RUN_ATTEMPT, workflow_sha: v.GITHUB_WORKFLOW_SHA, ref: v.GITHUB_REF });

export function lireFichier(dossier, nom) {
  try { return fs.readFileSync(path.join(dossier, nom), 'utf8'); } catch { return null; }
}
// Tête et contenu du journal tels que le workflow les a lus ; branche absente : { tete: null, texte: null }.
export function lireJournal(dossier) {
  const tete = (lireFichier(dossier, 'tete.txt') || '').trim();
  return { tete: tete === '' ? null : tete, texte: tete === '' ? null : lireFichier(dossier, 'chantier.json') };
}
function lireHistorique(dossier) {
  const total = (lireFichier(dossier, 'total.txt') || '').trim();
  const brut = lireFichier(dossier, 'runs.jsonl');
  if (!/^[0-9]{1,9}$/.test(total) || brut === null) return null;
  try { return { total: Number(total), runs: brut.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)) }; } catch { return null; }
}

export function resumeMarkdown(titre, verdict, raison, texte) {
  return `## ${titre} : ${verdict}\n\n${raison ? `Raison : \`${raison}\`\n\n` : ''}Aucun appel de modèle n'existe dans ce workflow (AT-8.1 à blanc).\n\nFaits à copier tels quels :\n\n\`\`\`json\n${texte}\`\`\`\n`;
}

export function executer({ env, dossier }) {
  const v = lireVariables(env);
  const r = garder({ entrees: entreesDe(v), contexte: contexteDe(v), historique: lireHistorique(dossier), journal: lireJournal(dossier) });
  fs.writeFileSync(path.join(dossier, 'faits.json'), r.texte);
  const verdict = r.autorise ? 'AUTORISE' : 'REFUS';
  if (v.GITHUB_STEP_SUMMARY !== '') fs.appendFileSync(v.GITHUB_STEP_SUMMARY, resumeMarkdown('Atelier AUTO à blanc — J1 garde', verdict, r.raison, r.texte));
  return { code: r.autorise ? 0 : 1, ligne: r.autorise ? 'AUTORISE' : `REFUS ${r.raison}`, ...r, annotations: annotationsFaits('j1', r.texte) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dossier');
  if (i < 0 || !process.argv[i + 1]) { process.stderr.write('usage : node outils-atelier/auto-garde.mjs --dossier D\n'); process.exit(2); }
  const r = executer({ env: process.env, dossier: process.argv[i + 1] });
  process.stdout.write(`${r.annotations.map((l) => `${l}\n`).join('')}${r.ligne}\n`);
  process.exit(r.code);
}
// === FIN_ATELIER_AUTO_GARDE ===
