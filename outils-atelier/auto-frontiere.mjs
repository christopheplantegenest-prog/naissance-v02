// === DEBUT_ATELIER_AUTO_FRONTIERE ===
// v0.65.9 — AT-8.1 « AUTO À BLANC » (GO « AT-8.1 — GO IMPLÉMENTATION À BLANC », 18/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — outil HORS APK, lancé par le job J2 « frontière » (environnement atelier-auto, approuvé par Christophe).
// FRONTIÈRE SANS APPEL : ce fichier et tout ce qu'il importe n'ont AUCUN module réseau, aucun processus, aucun import dynamique, aucun
// secret, aucune clé (gardé par tests/atelier-auto.test.mjs). Il relit l'état, l'approbation et la sonde déposés par le workflow :
//   tete.txt, chantier.json   tête actuelle de journal-atelier/<chantier> et son chantier.json (relus après l'attente d'approbation)
//   approbations.json         historique des approbations de CE run (actions:read)
//   sonde-code.txt, sonde-sortie.txt   code de sortie et sortie de la sonde d'écriture du jeton du job (doit être refusée : 403)
// Si tout est conforme : faits « pret-a-appeler », ligne PRET_A_APPELER, sortie 0, et le job S'ARRÊTE là. Sinon : « arret », sortie 1.
// Variables lues : les mêmes que la garde (liste fermée, auto-garde.mjs).
// v0.65.21 — AT-10.4 (D-007) : les faits sont aussi écrits sur la sortie en annotations ATELIER-FAITS-1 j2f (retour.js), relues par Claude.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { frontiere } from '../app/atelier/auto.js';
import { lireVariables, entreesDe, contexteDe, lireFichier, lireJournal, resumeMarkdown } from './auto-garde.mjs';
import { annotationsFaits } from '../app/atelier/retour.js';

function lireJson(dossier, nom) {
  const t = lireFichier(dossier, nom);
  try { return t === null ? null : JSON.parse(t); } catch { return null; }
}
function lireSondeDeposee(dossier) {
  const code = (lireFichier(dossier, 'sonde-code.txt') || '').trim();
  const sortie = lireFichier(dossier, 'sonde-sortie.txt');
  return /^[0-9]{1,3}$/.test(code) && sortie !== null ? { code: Number(code), sortie } : null;
}

export function executer({ env, dossier }) {
  const v = lireVariables(env);
  const r = frontiere({ entrees: entreesDe(v), contexte: contexteDe(v), journal: lireJournal(dossier), approbations: lireJson(dossier, 'approbations.json'), sonde: lireSondeDeposee(dossier) });
  fs.writeFileSync(path.join(dossier, 'faits.json'), r.texte);
  const verdict = r.pret ? 'PRET_A_APPELER (aucun appel)' : 'ARRET';
  if (v.GITHUB_STEP_SUMMARY !== '') fs.appendFileSync(v.GITHUB_STEP_SUMMARY, resumeMarkdown('Atelier AUTO à blanc — J2 frontière', verdict, r.raison, r.texte));
  return { code: r.pret ? 0 : 1, ligne: r.pret ? 'PRET_A_APPELER' : `ARRET ${r.raison}`, ...r, annotations: annotationsFaits('j2f', r.texte) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dossier');
  if (i < 0 || !process.argv[i + 1]) { process.stderr.write('usage : node outils-atelier/auto-frontiere.mjs --dossier D\n'); process.exit(2); }
  const r = executer({ env: process.env, dossier: process.argv[i + 1] });
  process.stdout.write(`${r.annotations.map((l) => `${l}\n`).join('')}${r.ligne}\n`);
  process.exit(r.code);
}
// === FIN_ATELIER_AUTO_FRONTIERE ===
