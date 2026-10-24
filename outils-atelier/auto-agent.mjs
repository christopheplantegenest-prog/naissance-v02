// === DEBUT_ATELIER_AUTO_AGENT ===
// v0.66.0 — ATELIER AUTONOME, lots L2 (boucle agentique) et L3 (bac à sable des tests) (GO « CONSTRUCTION ATELIER AUTONOME », 24/10/2026).
// OUTILLAGE NON COGNITIF — outil HORS APK, lancé par le job « agent » de atelier-chantier.yml, SEUL job qui reçoit la clé (environnement
// atelier-agent). Chemin privilégié (P1) par son nom : il ne change que par dépôt manuel de Christophe.
// Boucle : API Messages en HTTPS direct (sans SDK), outils de l'atelier exécutés ici, sur une COPIE de travail du candidat :
//   lister, lire, chercher (lecture bornée), ecrire, remplacer (chemins de la mission seulement, jamais l'atelier, .github, les zones
//   permanentes, un package.json ; aucune suppression), executer_tests (bac à sable), terminer / proposer_plan / rendre_avis (fin).
// BUDGET (L1) : avant CHAQUE appel, sa borne (entrée comptée par count_tokens, au tarif le plus cher, + max_tokens au tarif de sortie)
//   est comparée au reste de la réserve du tour ; si elle ne tient pas, la boucle s'arrête AVANT l'appel. Un appel dont l'issue est
//   inconnue (coupure, délai, réponse illisible) compte à sa borne. Le coût réel vient de « usage » ; le total ne dépasse jamais la réserve.
// ISOLATION (L3) : le code du candidat (tests) ne s'exécute JAMAIS dans ce processus : seulement dans un conteneur docker sans réseau
//   (--network none), sans variable d'environnement héritée, utilisateur non root, sans capacité, mémoire, processus et durée bornés,
//   sur une copie jetable. La clé ne va que dans l'en-tête x-api-key vers l'unique cible admise ; jamais dans un fichier, un journal,
//   une sortie ou le conteneur. Cibles admises : https://api.anthropic.com (réel) ou http://127.0.0.1:<port> (faux serveur des tests).

import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { coutMaxAppel, coutUsage, lirePlan, raisonCheminEcriture, raisonCheminLecture, MODELE } from './auto-autonome-noyau.mjs';

export const VERSION_API = '2026-10-21';
export const CIBLE_REELLE = 'https://api.anthropic.com';
const RE_CIBLE_ESSAI = /^http:\/\/127\.0\.0\.1:[0-9]{2,5}$/;
const RE_CLE = /^[!-~]{1,512}$/;
// Image du bac à sable : node 22 (Debian bookworm, avec git et python3 exigés par la suite de tests), ÉPINGLÉE par empreinte : rien
// n'est construit ni installé ; elle est tirée AVANT le travail (avec réseau), les tests tournent ensuite SANS réseau.
export const IMAGE_BAC = 'node:22-bookworm@sha256:63538dfe497cc29dfafdda25ada09b46db68a3f4cc205abf1f5d6bf0913f3384';
export const BORNES = Object.freeze({ lecture_octets: 200_000, lignes: 2000, ecriture_octets: 262_144, resultat_octets: 30_000, sortie_tests: 12_000, liste: 500, recherche: 200, delai_tests_ms: 900_000, delai_appel_ms: 600_000 });
export const PROFILS = Object.freeze({
  planifier: { maxTokens: 16000, effort: 'high', maxAppels: 30 },
  developper: { maxTokens: 16000, effort: 'high', maxAppels: 80 },
  avis: { maxTokens: 8000, effort: 'high', maxAppels: 20 },
});

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const octets = (s) => Buffer.byteLength(s, 'utf8');
const borner = (t, n) => (octets(t) > n ? `${Buffer.from(t, 'utf8').subarray(0, n).toString('utf8')}\n[… tronqué à ${n} octets]` : t);
const attendre = (ms) => new Promise((r) => { setTimeout(r, ms); });

// ------------------------------------------------------------------------------------------------ client HTTP de l'API
export function clientAnthropic({ cible = CIBLE_REELLE, cle, delaiMs = BORNES.delai_appel_ms, essais = 3, pause = 20_000 } = {}) {
  if (cible !== CIBLE_REELLE && !RE_CIBLE_ESSAI.test(cible)) throw new Error('cible de l\'API non admise');
  if (typeof cle !== 'string' || !RE_CLE.test(cle)) throw new Error('clé absente ou illisible');
  const poster = async (chemin, corps) => {
    for (let essai = 1; ; essai += 1) {
      let r;
      try {
        r = await fetch(`${cible}${chemin}`, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(delaiMs),
          headers: { 'content-type': 'application/json', 'anthropic-version': VERSION_API, 'x-api-key': cle },
          body: corps,
        });
      } catch (e) {
        return { emis: true, inconnu: true, erreur: `transport : ${e.name === 'TimeoutError' ? 'délai dépassé' : 'connexion'}` };
      }
      let json = null;
      try { json = await r.json(); } catch { json = null; }
      // Surcharge ou limite de débit : la requête n'a pas été traitée, nouvelle tentative bornée.
      if ((r.status === 429 || r.status === 529) && essai < essais) { await attendre(pause * essai); continue; }
      if (r.status >= 500 || (r.ok && !estObjet(json))) return { emis: true, inconnu: true, statut: r.status, erreur: `réponse ${r.status} illisible ou serveur en erreur` };
      if (!r.ok) return { emis: true, inconnu: false, statut: r.status, erreur: `refus ${r.status} : ${String(json?.error?.type ?? '')} ${String(json?.error?.message ?? '').slice(0, 300)}` };
      return { emis: true, inconnu: false, statut: r.status, json };
    }
  };
  return {
    async compter(corps) {
      const c = JSON.parse(corps);
      const r = await poster('/v1/messages/count_tokens', JSON.stringify({ model: c.model, system: c.system, tools: c.tools, messages: c.messages }));
      return r.json && Number.isSafeInteger(r.json.input_tokens) ? r.json.input_tokens : null;
    },
    envoyer: (corps) => poster('/v1/messages', corps),
  };
}

// ------------------------------------------------------------------------------------------------ boucle agentique
// Rend { statut, conclusion, depense, appels, journal } ; statut : termine | budget | refus | erreur | max-appels | sans-conclusion.
export async function boucle({ client, systeme, message, outils, executer, reserve, profil, consigner = () => {} }) {
  const tools = outils.map((o) => ({ name: o.name, description: o.description, input_schema: o.input_schema }));
  const messages = [{ role: 'user', content: message }];
  let depense = 0;
  let appels = 0;
  let relances = 0;
  const fin = (statut, conclusion = null, detail = null) => ({ statut, conclusion, detail, depense, appels });
  while (true) {
    if (appels >= profil.maxAppels) return fin('max-appels');
    const corps = JSON.stringify({
      model: MODELE, max_tokens: profil.maxTokens, system: [{ type: 'text', text: systeme, cache_control: { type: 'ephemeral' } }],
      tools, messages, cache_control: { type: 'ephemeral' }, output_config: { effort: profil.effort },
    });
    const compte = await client.compter(corps);
    const borne = coutMaxAppel({ jetonsEntree: compte ?? octets(corps) + 4096, maxTokens: profil.maxTokens });
    if (depense + borne > reserve) return fin('budget', null, `borne du prochain appel ${borne} µUSD, reste ${reserve - depense} µUSD`);
    appels += 1;
    const r = await client.envoyer(corps);
    if (r.inconnu) { depense += borne; consigner({ appel: appels, borne, cout: borne, issue: 'inconnue' }); return fin('erreur', null, r.erreur); }
    if (!r.json) { consigner({ appel: appels, borne, cout: 0, issue: 'refus' }); return fin('erreur', null, r.erreur); }
    const cout = coutUsage(r.json.usage);
    depense += cout === null ? borne : cout;
    consigner({ appel: appels, borne, cout: cout ?? borne, usage: r.json.usage ?? null, stop: r.json.stop_reason ?? null });
    const contenu = Array.isArray(r.json.content) ? r.json.content : [];
    if (r.json.stop_reason === 'refusal') return fin('refus');
    messages.push({ role: 'assistant', content: contenu });
    const usages = contenu.filter((b) => b.type === 'tool_use');
    if (!usages.length) {
      if (relances >= 2) return fin('sans-conclusion');
      relances += 1;
      messages.push({ role: 'user', content: [{ type: 'text', text: r.json.stop_reason === 'max_tokens' ? 'Réponse coupée (max_tokens). Continue avec des appels d\'outils plus courts.' : 'Continue avec les outils ; termine par l\'outil de fin prévu.' }] });
      continue;
    }
    const resultats = [];
    let conclusion = null;
    for (const u of usages) {
      let res;
      if (r.json.stop_reason === 'max_tokens' && u === usages[usages.length - 1]) res = { erreur: 'entrée de l\'outil tronquée (max_tokens) : recommence en plus court' };
      else {
        try { res = await executer(u.name, estObjet(u.input) ? u.input : {}); } catch (e) { res = { erreur: `outil en échec : ${e.message}` }; }
      }
      if (res.fin) conclusion = res.fin;
      const texte = borner(typeof res.texte === 'string' ? res.texte : res.erreur ?? JSON.stringify(res.fin ?? {}), BORNES.resultat_octets);
      resultats.push({ type: 'tool_result', tool_use_id: u.id, content: texte, ...(res.erreur ? { is_error: true } : {}) });
    }
    if (conclusion) return fin('termine', conclusion);
    messages.push({ role: 'user', content: resultats });
  }
}

// ------------------------------------------------------------------------------------------------ L3 bac à sable
export function preparerImage({ docker = 'docker' } = {}) {
  if (spawnSync(docker, ['image', 'inspect', IMAGE_BAC], { stdio: 'ignore' }).status === 0) return;
  const r = spawnSync(docker, ['pull', '-q', IMAGE_BAC], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`image du bac à sable indisponible : ${(r.stderr || '').slice(-500)}`);
}
// Arguments docker d'une exécution isolée (exportés pour la garde des tests).
export function argumentsDocker({ nom, copie, commande }) {
  return ['run', '--rm', '--name', nom, '--network', 'none', '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--memory', '3g', '--cpus', '2', '--pids-limit', '1024', '--read-only', '--tmpfs', '/tmp:rw,exec,size=1g', '--env', 'HOME=/tmp', '--env', 'CI=1',
    '--volume', `${copie}:/travail:rw`, '--workdir', '/travail', IMAGE_BAC, ...commande];
}
export function resumeTap(sortie) {
  const n = (k) => { const m = new RegExp(`^# ${k} (\\d+)$`, 'm').exec(sortie); return m ? Number(m[1]) : null; };
  const total = n('tests');
  return total === null ? null : { total, reussis: n('pass') ?? 0, echecs: (n('fail') ?? 0) + (n('cancelled') ?? 0) };
}
// Exécute node --test sur des fichiers de tests d'une COPIE jetable de la racine. Rend { code, resume, sortie }.
export function executerTests({ racine, fichiers, docker = 'docker', delaiMs = BORNES.delai_tests_ms }) {
  const copie = fs.mkdtempSync(path.join(os.tmpdir(), 'bac-'));
  try {
    fs.cpSync(racine, copie, { recursive: true, filter: (s) => !s.split(path.sep).includes('.git') && !s.split(path.sep).includes('node_modules') });
    spawnSync('chmod', ['-R', 'a+rwX', copie]);
    // Le dépôt de la copie n'a pas de .git : les tests qui lancent git créent leurs propres dépôts temporaires.
    const nom = `bac-${process.pid}-${Date.now()}`;
    const r = spawnSync(docker, argumentsDocker({ nom, copie, commande: ['node', '--test', '--test-concurrency=3', ...fichiers] }), { encoding: 'utf8', timeout: delaiMs, maxBuffer: 256 * 1024 * 1024, env: { PATH: process.env.PATH ?? '/usr/bin:/bin' } });
    if (r.error) spawnSync(docker, ['kill', nom]);
    const sortie = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    return { code: r.error ? 'delai' : r.status, resume: resumeTap(sortie), sortie };
  } finally {
    fs.rmSync(copie, { recursive: true, force: true });
  }
}
export const tousLesTests = (racine) => fs.readdirSync(path.join(racine, 'tests')).filter((f) => f.endsWith('.test.mjs')).sort().map((f) => `tests/${f}`);
// Lignes d'échec utiles d'une sortie TAP (pour le retour à l'agent).
export const echecsTap = (sortie) => borner(sortie.split('\n').filter((l) => /^\s*not ok|^\s+(error|expected|actual|location):|AssertionError|Error:/.test(l)).slice(0, 120).join('\n'), BORNES.sortie_tests);

// ------------------------------------------------------------------------------------------------ outils sur la copie de travail
const SCHEMA = (props, requis) => ({ type: 'object', properties: props, required: requis, additionalProperties: false });
const T = { type: 'string' };
const OUTILS_LECTURE = [
  { name: 'lister', description: 'Liste un dossier du dépôt (chemin relatif, "." pour la racine).', input_schema: SCHEMA({ dossier: T }, ['dossier']) },
  { name: 'lire', description: 'Lit un fichier du dépôt, lignes numérotées (debut/fin facultatifs, 2000 lignes au plus).', input_schema: SCHEMA({ chemin: T, debut: { type: 'integer' }, fin: { type: 'integer' } }, ['chemin']) },
  { name: 'chercher', description: 'Cherche une expression régulière JavaScript dans les fichiers texte du dépôt (200 résultats au plus).', input_schema: SCHEMA({ motif: T, dossier: T }, ['motif']) },
];
const OUTILS_ECRITURE = [
  { name: 'ecrire', description: 'Crée ou remplace entièrement un fichier du périmètre autorisé de la mission.', input_schema: SCHEMA({ chemin: T, contenu: T }, ['chemin', 'contenu']) },
  { name: 'remplacer', description: 'Remplace UNE occurrence exacte et unique de « ancien » par « nouveau » dans un fichier du périmètre autorisé.', input_schema: SCHEMA({ chemin: T, ancien: T, nouveau: T }, ['chemin', 'ancien', 'nouveau']) },
  { name: 'executer_tests', description: 'Exécute node --test sur des fichiers tests/*.test.mjs (sans réseau). Rend le décompte et les échecs.', input_schema: SCHEMA({ fichiers: { type: 'array', items: T } }, ['fichiers']) },
  { name: 'terminer', description: 'Fin du travail. statut "candidat" : la suite complète est alors exécutée ; si elle échoue, tu reçois les échecs et tu continues. statut "bloque" : une question précise pour Christophe.', input_schema: SCHEMA({ statut: { type: 'string', enum: ['candidat', 'bloque'] }, resume: T, question: T }, ['statut', 'resume']) },
];
const OUTIL_PLAN = { name: 'proposer_plan', description: 'Propose le plan (fin de la planification) ou, si la demande est réellement ambiguë, une question.', input_schema: SCHEMA({
  plan: SCHEMA({ description: T, missions: { type: 'array', items: SCHEMA({ id: T, titre: T, comportement: T, criteres: { type: 'array', items: T }, tests: { type: 'array', items: T }, autorises: { type: 'array', items: T }, cognitive: { type: 'boolean' } }, ['id', 'titre', 'comportement', 'criteres', 'tests', 'autorises', 'cognitive']) } }, ['description', 'missions']),
  question: T }, []) };
const OUTIL_AVIS = { name: 'rendre_avis', description: 'Rend le second avis sur le candidat.', input_schema: SCHEMA({ conforme: { type: 'boolean' }, objections: { type: 'array', items: T } }, ['conforme', 'objections']) };

function fichiersTexte(racine, dossier) {
  const out = [];
  const pile = [dossier];
  while (pile.length && out.length < 20000) {
    const d = pile.pop();
    for (const e of fs.readdirSync(path.join(racine, d), { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const p = d === '.' ? e.name : `${d}/${e.name}`;
      if (e.isDirectory()) pile.push(p); else if (e.isFile()) out.push(p);
    }
  }
  return out.sort();
}

// Outils d'une étape : { outils, executer(nom, entree) } ; ecriture = périmètre autorisé (null = lecture seule).
export function outilsEtape({ etape, racine: racineRecue, autorises = null, contexte = {}, docker = 'docker', suiteComplete = null }) {
  const racine = fs.realpathSync(racineRecue);
  const reel = (p) => {
    const r = raisonCheminLecture(p === '.' ? 'x' : p);
    if (r) throw new Error(r);
    const abs = path.resolve(racine, p);
    if (abs !== racine && !abs.startsWith(racine + path.sep)) throw new Error('hors du dépôt');
    if (fs.existsSync(abs) && fs.realpathSync(abs) !== abs) throw new Error('lien symbolique refusé');
    return abs;
  };
  let echecsSuite = 0;
  const lecture = {
    lister({ dossier }) {
      const abs = reel(dossier);
      const l = fs.readdirSync(abs, { withFileTypes: true }).filter((e) => e.name !== '.git').map((e) => `${e.name}${e.isDirectory() ? '/' : ''}`).sort();
      return { texte: l.slice(0, BORNES.liste).join('\n') + (l.length > BORNES.liste ? `\n[… ${l.length - BORNES.liste} autres]` : '') };
    },
    lire({ chemin, debut = 1, fin }) {
      const abs = reel(chemin);
      if (!fs.statSync(abs).isFile()) return { erreur: 'pas un fichier' };
      const lignes = fs.readFileSync(abs, 'utf8').split('\n');
      const d = Math.max(1, debut | 0);
      const f = Math.min(lignes.length, fin ? fin | 0 : d + BORNES.lignes - 1, d + BORNES.lignes - 1);
      return { texte: borner(lignes.slice(d - 1, f).map((l, i) => `${d + i}\t${l}`).join('\n') + (f < lignes.length ? `\n[… ${lignes.length} lignes au total]` : ''), BORNES.lecture_octets) };
    },
    chercher({ motif, dossier = '.' }) {
      let re;
      try { re = new RegExp(motif); } catch { return { erreur: 'expression régulière invalide' }; }
      const res = [];
      for (const p of fichiersTexte(racine, dossier === '.' ? '.' : (reel(dossier), dossier))) {
        const abs = path.join(racine, p);
        if (fs.statSync(abs).size > 1_000_000) continue;
        const t = fs.readFileSync(abs, 'utf8');
        if (t.includes('\u0000')) continue;
        t.split('\n').forEach((l, i) => { if (res.length < BORNES.recherche && re.test(l)) res.push(`${p}:${i + 1}: ${l.slice(0, 300)}`); });
        if (res.length >= BORNES.recherche) break;
      }
      return { texte: res.join('\n') || '(aucun résultat)' };
    },
  };
  const ecriture = {
    ecrire({ chemin, contenu }) {
      const r = raisonCheminEcriture(chemin, autorises);
      if (r) return { erreur: `écriture refusée « ${chemin} » : ${r}` };
      if (typeof contenu !== 'string' || octets(contenu) > BORNES.ecriture_octets) return { erreur: 'contenu absent ou trop gros' };
      const abs = reel(chemin);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      if (fs.realpathSync(path.dirname(abs)) !== path.dirname(abs)) return { erreur: 'dossier par un lien symbolique refusé' };
      fs.writeFileSync(abs, contenu);
      return { texte: `écrit : ${chemin} (${octets(contenu)} octets)` };
    },
    remplacer({ chemin, ancien, nouveau }) {
      const r = raisonCheminEcriture(chemin, autorises);
      if (r) return { erreur: `écriture refusée « ${chemin} » : ${r}` };
      const abs = reel(chemin);
      if (!fs.existsSync(abs)) return { erreur: 'fichier absent' };
      const t = fs.readFileSync(abs, 'utf8');
      const n = typeof ancien === 'string' && ancien ? t.split(ancien).length - 1 : 0;
      if (n !== 1) return { erreur: `« ancien » trouvé ${n} fois (exactement 1 attendu)` };
      const s = t.replace(ancien, () => nouveau);
      if (octets(s) > BORNES.ecriture_octets) return { erreur: 'fichier résultant trop gros' };
      fs.writeFileSync(abs, s);
      return { texte: `remplacé dans ${chemin}` };
    },
    executer_tests({ fichiers }) {
      if (!Array.isArray(fichiers) || !fichiers.length || fichiers.length > 50) return { erreur: '1 à 50 fichiers attendus' };
      for (const f of fichiers) if (typeof f !== 'string' || !/^tests\/[A-Za-z0-9._-]+\.test\.mjs$/.test(f) || !fs.existsSync(path.join(racine, f))) return { erreur: `fichier de test refusé : ${f}` };
      const r = executerTests({ racine, fichiers, docker });
      return { texte: `${r.resume ? `tests ${r.resume.total}, réussis ${r.resume.reussis}, échecs ${r.resume.echecs}` : `résumé absent (code ${r.code})`}\n${r.resume && r.resume.echecs === 0 ? '' : echecsTap(r.sortie)}` };
    },
    terminer({ statut, resume, question }) {
      if (statut === 'bloque') return typeof question === 'string' && question.trim() ? { fin: { statut, resume, question } } : { erreur: 'question attendue' };
      const s = (suiteComplete ?? (() => executerTests({ racine, fichiers: tousLesTests(racine), docker })))();
      if (s.resume && s.resume.total > 0 && s.resume.echecs === 0 && s.resume.reussis === s.resume.total) return { fin: { statut, resume, tests: s.resume } };
      echecsSuite += 1;
      if (echecsSuite >= 4) return { fin: { statut: 'echec', resume: 'suite complète toujours en échec après quatre essais', tests: s.resume } };
      return { erreur: `suite complète en échec (${s.resume ? `${s.resume.echecs} échec(s) sur ${s.resume.total}` : `code ${s.code}`}) :\n${echecsTap(s.sortie)}` };
    },
  };
  const fins = {
    proposer_plan({ plan, question }) {
      if (typeof question === 'string' && question.trim() && !plan) return { fin: { statut: 'bloque', question: question.trim() } };
      const l = lirePlan(plan, contexte);
      return l.raison ? { erreur: `plan refusé : ${l.raison}` } : { fin: { statut: 'plan', plan: l.plan } };
    },
    rendre_avis({ conforme, objections }) {
      if (typeof conforme !== 'boolean' || !Array.isArray(objections) || !objections.every((x) => typeof x === 'string')) return { erreur: 'avis illisible' };
      if (!conforme && !objections.length) return { erreur: 'un avis non conforme exige au moins une objection' };
      return { fin: { statut: 'avis', conforme, objections: objections.map((x) => x.slice(0, 2000)).slice(0, 20) } };
    },
  };
  const table = etape === 'developper' ? { ...lecture, ...ecriture } : etape === 'planifier' ? { ...lecture, proposer_plan: fins.proposer_plan } : { ...lecture, rendre_avis: fins.rendre_avis };
  const outils = etape === 'developper' ? [...OUTILS_LECTURE, ...OUTILS_ECRITURE] : [...OUTILS_LECTURE, etape === 'planifier' ? OUTIL_PLAN : OUTIL_AVIS];
  return {
    outils,
    executer: async (nom, entree) => {
      if (!Object.hasOwn(table, nom)) return { erreur: `outil inconnu « ${nom} »` };
      try { return table[nom](entree); } catch (e) { return { erreur: `${nom} refusé : ${e.message}` }; }
    },
  };
}
// === FIN_ATELIER_AUTO_AGENT ===
