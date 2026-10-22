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
// v0.65.22 — AT-10.4 correction J3 (GO « RÉALISATION LOCALE CORRECTION J3 », 22/10/2026 ; course d'état vue en recette R1) : l'API des
// jobs peut montrer J2 encore « waiting » quelques secondes après sa fin. Le workflow relit donc la liste (GET seulement, au plus
// 10 lectures, 6 s d'intervalle) et s'arrête dès que etatStable la dit terminale et cohérente :
//   node outils-atelier/auto-constat.mjs --dossier D --stable  -> sortie 0 = stable, 3 = non stable ; n'écrit RIEN, ne conclut RIEN.
// La stabilité ne dit pas l'issue : « étape Appel terminée » n'est PAS « émission réussie ». Seul constater (auto.js) conclut, une
// seule fois, sur la dernière lecture ; un état resté instable ou contradictoire après la 10e lecture y donne ISSUE INCONNUE.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constater, NOMS_RUN } from '../app/atelier/auto.js';
import { lireVariables, entreesDe, contexteDe, lireFichier } from './auto-garde.mjs';
import { annotationsFaits } from '../app/atelier/retour.js';

// État terminal cohérent des jobs de CE run : J1 terminé (refusé : stable, rien ne peut suivre) ; J2 terminé ; et soit J2 sauté sans
// aucune étape Appel ayant tourné, soit UNE étape Appel terminée avec une conclusion. Tout le reste est non stable : jobs illisibles,
// job absent ou en double, en attente (« waiting »), en file, en cours, étape absente, en double, sans conclusion, contradiction.
const ETAT_RE = /^[a-z_]{1,32}$/;
export function etatStable(jobs) {
  const non = (raison) => ({ stable: false, raison });
  const oui = (raison) => ({ stable: true, raison });
  const objet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const lu = (x) => ({ status: typeof x.status === 'string' && ETAT_RE.test(x.status) ? x.status : null, conclusion: typeof x.conclusion === 'string' && ETAT_RE.test(x.conclusion) ? x.conclusion : null });
  if (!Array.isArray(jobs) || jobs.some((j) => !objet(j) || typeof j.name !== 'string')) return non('jobs-illisibles');
  const un = (nom) => { const l = jobs.filter((j) => j.name === nom); return l.length === 1 ? l[0] : null; };
  const g = un(NOMS_RUN.garde);
  if (!g) return non('job-garde-absent');
  const vg = lu(g);
  if (vg.status !== 'completed' || vg.conclusion === null) return non('garde-en-cours');
  if (vg.conclusion !== 'success') return oui('garde-non-franchie');
  const a = un(NOMS_RUN.appel);
  if (!a) return non('job-appel-absent');
  const va = lu(a);
  if (va.status !== 'completed' || va.conclusion === null) return non('job-appel-en-cours');
  if (a.steps !== undefined && a.steps !== null && !Array.isArray(a.steps)) return non('etapes-illisibles');
  const etapes = (a.steps || []).filter((x) => objet(x) && x.name === NOMS_RUN.etape).map(lu);
  if (va.conclusion === 'skipped') return etapes.every((e) => e.status === 'completed' && e.conclusion === 'skipped') ? oui('job-appel-saute') : non('contradiction-job-saute');
  if (etapes.length === 0) return non('etape-appel-absente');
  if (etapes.length > 1) return non('etape-appel-multiple');
  if (etapes[0].status !== 'completed' || etapes[0].conclusion === null) return non('etape-appel-en-cours');
  return oui('etape-appel-terminee');
}
export function lireJobs(dossier) {
  const brut = lireFichier(dossier, 'jobs.json');
  try { return brut === null ? null : JSON.parse(brut); } catch { return null; }
}

export function executer({ env, dossier }) {
  const v = lireVariables(env);
  const jobs = lireJobs(dossier);
  const r = constater({ entrees: entreesDe(v), contexte: contexteDe(v), jobs });
  fs.writeFileSync(path.join(dossier, 'faits-constat.json'), r.texte);
  const issue = r.faits.issue === null ? 'SANS OBJET' : r.faits.issue.toUpperCase();
  const avertir = r.faits.issue === 'issue-inconnue' ? '\n**ISSUE INCONNUE : un appel a pu avoir lieu. Coût non établi. Engagement maintenu. Aucune relance.**\n' : '';
  if (v.GITHUB_STEP_SUMMARY !== '') fs.appendFileSync(v.GITHUB_STEP_SUMMARY, `## Atelier AUTO — J3 constat : ${issue}\n${avertir}\nRaison : \`${r.faits.raison}\`\n\nFaits à copier tels quels :\n\n\`\`\`json\n${r.texte}\`\`\`\n`);
  return { code: r.faits.issue === 'non-emis' ? 0 : 1, ligne: `${issue} ${r.faits.raison}`, ...r, annotations: annotationsFaits('j3', r.texte) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--dossier');
  if (i < 0 || !process.argv[i + 1]) { process.stderr.write('usage : node outils-atelier/auto-constat.mjs --dossier D [--stable]\n'); process.exit(2); }
  if (process.argv.includes('--stable')) {
    const s = etatStable(lireJobs(process.argv[i + 1]));
    process.stdout.write(`${s.stable ? 'STABLE' : 'NON STABLE'} ${s.raison}\n`);
    process.exit(s.stable ? 0 : 3);
  }
  const r = executer({ env: process.env, dossier: process.argv[i + 1] });
  process.stdout.write(`${r.annotations.map((l) => `${l}\n`).join('')}${r.ligne}\n`);
  process.exit(r.code);
}
// === FIN_ATELIER_AUTO_CONSTAT ===
