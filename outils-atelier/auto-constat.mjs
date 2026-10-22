// === DEBUT_ATELIER_AUTO_CONSTAT ===
// v0.65.10 — AT-8.2 « TÉMOIN À BLANC » (GO « AT-8.2 — GO IMPLÉMENTATION À BLANC », 18/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — outil HORS APK, lancé par le job J3 « constat » (if: always(), sans environnement, sans secret, jeton
// actions:read seul, AUTRE runner que J2). Aucun réseau ici : le workflow dépose dans --dossier la liste des jobs de CE run et de CET
// essai (jobs.json, lue par le jeton du job). Le constat PUR (app/atelier/auto.js, constater) dit ce que le run permet d'établir :
//   non-emis       la garde J1 a réussi ET GitHub montre le job J2 sauté ou son étape d'appel sautée
//   issue-inconnue tout le reste (étape d'appel commencée, état incertain, runner perdu, jobs illisibles)
//   sans objet     garde non franchie (issue null) : les faits J1 font foi
// Il ne transforme JAMAIS une absence de preuve en coût 0.
//   node outils-atelier/auto-constat.mjs --dossier D   -> faits dans D/faits-constat.json, résumé du run ; sortie 0 = non-emis, 1 sinon
// v0.65.21 — AT-10.4 (D-007) : les faits sont aussi écrits sur la sortie en annotations ATELIER-FAITS-1 j3 (retour.js), relues par Claude.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constater } from '../app/atelier/auto.js';
import { lireVariables, entreesDe, contexteDe, lireFichier } from './auto-garde.mjs';
import { annotationsFaits } from '../app/atelier/retour.js';

export function executer({ env, dossier }) {
  const v = lireVariables(env);
  const brut = lireFichier(dossier, 'jobs.json');
  let jobs = null;
  try { jobs = brut === null ? null : JSON.parse(brut); } catch { jobs = null; }
  const r = constater({ entrees: entreesDe(v), contexte: contexteDe(v), jobs });
  fs.writeFileSync(path.join(dossier, 'faits-constat.json'), r.texte);
  const issue = r.faits.issue === null ? 'SANS OBJET' : r.faits.issue.toUpperCase();
  const avertir = r.faits.issue === 'issue-inconnue' ? '\n**ISSUE INCONNUE : un appel a pu avoir lieu. Coût non établi. Engagement maintenu. Aucune relance.**\n' : '';
  if (v.GITHUB_STEP_SUMMARY !== '') fs.appendFileSync(v.GITHUB_STEP_SUMMARY, `## Atelier AUTO — J3 constat : ${issue}\n${avertir}\nRaison : \`${r.faits.raison}\`\n\nFaits à copier tels quels :\n\n\`\`\`json\n${r.texte}\`\`\`\n`);
  return { code: r.faits.issue === 'non-emis' ? 0 : 1, ligne: `${issue} ${r.faits.raison}`, ...r, annotations: annotationsFaits('j3', r.texte) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dossier');
  if (i < 0 || !process.argv[i + 1]) { process.stderr.write('usage : node outils-atelier/auto-constat.mjs --dossier D\n'); process.exit(2); }
  const r = executer({ env: process.env, dossier: process.argv[i + 1] });
  process.stdout.write(`${r.annotations.map((l) => `${l}\n`).join('')}${r.ligne}\n`);
  process.exit(r.code);
}
// === FIN_ATELIER_AUTO_CONSTAT ===
