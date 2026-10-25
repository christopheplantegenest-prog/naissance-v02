// === DEBUT_ATELIER_AUTONOME_NOYAU ===
// v0.66.0 — ATELIER AUTONOME, lots L1, L4, L5 (partie pure), L6 (gardes statiques), L8 (GO « CONSTRUCTION ATELIER AUTONOME », 24/10/2026).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance (D-007). Module PUR de l'opérateur autonome (atelier-chantier.yml) :
// il ne lit ni n'écrit rien, n'appelle aucun réseau, ne connaît aucune clé. Chemin privilégié (P1) par son nom : il ne change que par
// dépôt manuel de Christophe ; il importe app/atelier/budget.js, mission.js, verification.js (déjà privilégiés ou purs).
// L1 BUDGET MENSUEL : le registre AT-2 (budget.js) inchangé, un cycle = un mois civil UTC (« AAAA-MM »), plafond 100 USD, aucune
//   répartition demandée à Christophe : chaque tour payant réserve sa BORNE (engagement) avant l'appel ; son coût réel est inscrit à la
//   fin ; un tour sans coût connu (annulé, perdu) est inscrit à son maximum. Plafond atteint = arrêt automatique (blocage « budget »),
//   levé seul au mois suivant. 1 USD = 1 000 000 microdollars.
// L4/L5 CHANTIER : journal append-only { n, type, quand, donnees } d'un ticket GitHub ; l'état se reconstruit par rejeu ;
//   prochaineEtape(etat) dit ce que l'opérateur fait ensuite (planifier, developper, verifier, avis, livrer, bloquer, terminer, aucune).
// L6 GARDES STATIQUES : chemins écrivables par l'agent, ajouts interdits dans app/ (réseau, LLM, imports de l'atelier ou des
//   fournisseurs), changement de BASE / SCHEMA / TABLES (= migration : blocage et question), détection des modules cognitifs.
// L8 COMMANDES : /stop, /reprendre, /valider, du seul propriétaire du dépôt (identifiant numérique), relues du texte exact.
// v0.66.6 — ATELIER 2, LOT L0 « FIABILISATION » (GO ChatGPT « ATELIER 2 — GO PHASE 1 », 25/10/2026) :
//   D4 : les échecs de planification sont comptés PAR ÉPOQUE (comme les vérifications et les avis) : /reprendre rouvre deux essais.
//   D5-a : toute mission peut créer ou modifier des fichiers sous tests/ (jamais tests/atelier-*), sous la GARDE DES TESTS (qualitative :
//          aucun test retiré ni désactivé, aucune assertion retirée ni affaiblie, aucune neutralisation, chaque test modifié annoté et
//          justifié pour la version visée) ; les modifications de tests existants sont listées au second avis.
//   D5-b : une ligne « périmètre + : chemin, … » dans la réponse d'un /reprendre élargit le périmètre de la mission en cours (mêmes refus).
//   Une question posée par l'agent ne consomme pas de tentative (bonus d'une tentative à la reprise).
//   Plafond par chantier : 25 USD (registre AT-2 et blocage « plafond-chantier » du noyau ; jamais levé seul).
// v0.66.6 — L1/L2 : données d'état lisibles par l'application (donneesEtat) ; app/capacites/ protégé comme l'atelier.

import { appliquerBudget, etatBudget, ouvrirRegistre } from '../app/atelier/budget.js';
import { construireMission } from '../app/atelier/mission.js';
import { zonePermanente } from '../app/atelier/verification.js';

export const PROPRIETAIRE_ID = 308310970;
export const MODELE = 'claude-opus-5-5';
export const USD = 1_000_000;
export const PLAFOND_MENSUEL = 100 * USD;
export const PLAFOND_TOUR = 10 * USD;
// Plafond d'un chantier, cumulé sur tous les mois (garde-fou contre un chantier qui s'emballe ; la vraie borne reste le mois).
// v0.66.6 (L0) : 300 → 25 USD. Les chantiers déjà ouverts gardent le plafond déclaré au registre (300) mais le noyau leur applique aussi 25.
export const PLAFOND_CHANTIER = 25 * USD;
// Réserve de chaque tour payant (borne, jamais le coût espéré) ; minimum utile en dessous duquel le tour n'est pas lancé.
export const RESERVES = Object.freeze({ planifier: 3 * USD, developper: 8 * USD, avis: 1_500_000 });
export const MINIMUM_TOUR = 1 * USD;
export const MAX_TENTATIVES = 3;
export const MAX_MISSIONS = 6;
export const MAX_VERIFICATIONS = 2;
export const MAX_PLANIFICATIONS = 2;
// Tarifs du modèle en dixièmes de microdollar par jeton : 4 $ / MTok en entrée, 5 $ écriture de cache (5 min), 0,20 $ lecture, 20 $ sortie.
export const TARIFS = Object.freeze({ entree: 40, cacheEcriture: 50, cacheLecture: 2, sortie: 200 });

const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
const RE_CHEMIN = /^[A-Za-z0-9._/-]+$/;
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const estTexte = (v) => typeof v === 'string' && v.length > 0;
const entier = (v, min = 0) => Number.isSafeInteger(v) && v >= min;

// ------------------------------------------------------------------------------------------------ L1 budget mensuel
export const cycleDuMois = (quand) => {
  if (typeof quand !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(quand)) throw new TypeError('cycleDuMois : date ISO UTC attendue.');
  return quand.slice(0, 7);
};
export const chantierBudget = (issue) => `ticket-${issue}`;

// Réserve un tour : rend { journal, maximum } (journal du registre prolongé) ou { refus, raison }.
// Ouvre le registre au premier tour, ouvre le cycle du mois s'il a changé (refusé tant qu'un engagement reste ouvert : le tour attend),
// déclare le plafond du chantier (300 USD cumulés, garde-fou ; la vraie borne reste le mois), puis engage min(réserve, reste du cycle).
export function reserverTour(journal, { quand, execution, issue, etape, depenseChantier = 0 }) {
  if (!Object.hasOwn(RESERVES, etape)) throw new TypeError(`reserverTour : étape payante inconnue « ${etape} ».`);
  const cycle = cycleDuMois(quand);
  let j = journal && journal.length ? journal : ouvrirRegistre({ cycle, plafond: PLAFOND_MENSUEL, reserve: 0, plafondRun: PLAFOND_TOUR }, quand);
  const appliquer = (type, donnees) => {
    const r = appliquerBudget(j, { type, quand, donnees });
    if (r.refuse) return r;
    j = r;
    return null;
  };
  let e = etatBudget(j);
  if (e.cycle !== cycle) {
    const r = appliquer('cycle-ouvert', { cycle, plafond: PLAFOND_MENSUEL, reserve: 0, plafondRun: PLAFOND_TOUR });
    if (r) return { refus: r.limite === 'engagement-ouvert' ? 'engagement-ouvert' : 'registre', raison: r.raison };
    e = etatBudget(j);
  }
  if (e.suspendu) return { refus: 'suspendu', raison: 'registre suspendu après un dépassement réel : examen humain nécessaire' };
  const ch = chantierBudget(issue);
  if (!Object.hasOwn(e.chantiers, ch)) {
    const r = appliquer('chantier-plafonne', { chantier: ch, plafond: PLAFOND_CHANTIER });
    if (r) return { refus: 'registre', raison: r.raison };
    e = etatBudget(j);
  }
  // v0.66.6 (L0) : le reste du chantier est aussi borné par le plafond courant (25 USD) moins sa dépense, journal du chantier faisant foi.
  if (!entier(depenseChantier)) throw new TypeError('reserverTour : depenseChantier entier >= 0 attendu.');
  const resteChantier = Math.min(e.chantiers[ch].reste, Math.max(0, PLAFOND_CHANTIER - depenseChantier));
  if (Math.min(RESERVES[etape], resteChantier) < MINIMUM_TOUR) return { refus: 'plafond-chantier', raison: `plafond du chantier ${ch} (${PLAFOND_CHANTIER} µUSD) atteint : reste ${resteChantier} µUSD, sous le minimum d'un tour (${MINIMUM_TOUR})` };
  const maximum = Math.min(RESERVES[etape], e.resteCycle, resteChantier);
  if (maximum < MINIMUM_TOUR) return { refus: 'budget', raison: `reste du mois ${cycle} : ${e.resteCycle} µUSD, sous le minimum d'un tour (${MINIMUM_TOUR})` };
  const r = appliquer('engagement', { execution, chantier: ch, maximum });
  if (r) return { refus: r.limite === 'cycle' || r.limite === 'chantier' ? 'budget' : 'registre', raison: r.raison };
  return { journal: j, maximum };
}

// Inscrit le coût réel d'un tour (idempotent : un coût déjà inscrit rend le journal reçu). Rend { journal } ou { refus, raison }.
export function inscrireCout(journal, { quand, execution, montant }) {
  const e = etatBudget(journal);
  const x = e.executions[execution];
  if (!x) return { refus: 'execution-inconnue', raison: `exécution « ${execution} » sans engagement` };
  if (x.statut !== 'engagee') return { journal };
  const r = appliquerBudget(journal, { type: 'cout', quand, donnees: { execution, montant } });
  return r.refuse ? { refus: r.limite, raison: r.raison } : { journal: r };
}

// Coût réel d'une réponse (usage de l'API) en microdollars, arrondi au-dessus.
export function coutUsage(usage) {
  if (!estObjet(usage)) return null;
  const n = (k) => (usage[k] === undefined || usage[k] === null ? 0 : usage[k]);
  const v = [n('input_tokens'), n('cache_creation_input_tokens'), n('cache_read_input_tokens'), n('output_tokens')];
  if (!v.every((x) => entier(x))) return null;
  return Math.ceil((v[0] * TARIFS.entree + v[1] * TARIFS.cacheEcriture + v[2] * TARIFS.cacheLecture + v[3] * TARIFS.sortie) / 10);
}
// Borne d'un appel AVANT émission : toute l'entrée au tarif le plus cher (écriture de cache) + max_tokens au tarif de sortie.
// jetonsEntree = compte exact (count_tokens) ou, à défaut, nombre d'octets du corps + 4096 (un jeton couvre au moins un octet).
export function coutMaxAppel({ jetonsEntree, maxTokens }) {
  if (!entier(jetonsEntree) || !entier(maxTokens, 1)) throw new TypeError('coutMaxAppel : entiers attendus.');
  return Math.ceil((jetonsEntree * TARIFS.cacheEcriture + maxTokens * TARIFS.sortie) / 10);
}

// ------------------------------------------------------------------------------------------------ L6 chemins
// v0.66.6 (ATELIER 2, L1/L2) : app/capacites/ (écran qui commande l'Atelier, jeton GitHub) protégé comme l'atelier : l'Atelier ne modifie pas
// ses propres commandes.
const PREFIXES_PROTEGES = Object.freeze(['app/atelier/', 'app/capacites/', 'outils-atelier/', 'tests/atelier-', '.github/', '.git/', 'signature/', 'android/', 'node_modules/']);
const FICHIERS_PROTEGES = Object.freeze(['package.json', 'package-lock.json']);
// Interdits ajoutés à chaque mission (en plus des zones permanentes de mission.js) : la mission ne peut pas viser l'atelier.
export const INTERDITS_MISSION = Object.freeze(['app/atelier/', 'app/capacites/', 'outils-atelier/', 'package-lock.json', 'package.json']);
// v0.66.6 (D5-a) : périmètre implicite de toute mission (hors tests/atelier-*, protégé ci-dessus).
export const PERIMETRE_TESTS = 'tests/';
const sansControle = (p) => ![...p].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);

// Raison du refus d'un chemin de fichier relatif (lecture), ou null.
export function raisonCheminLecture(p) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 300) return 'chemin de 1 à 300 caractères attendu';
  if (!sansControle(p) || p.includes('\\') || p.startsWith('/')) return 'chemin irrégulier';
  if (p.split('/').some((m) => m === '' || m === '.' || m === '..')) return 'chemin irrégulier';
  if (p === '.git' || p.startsWith('.git/') || p.toLowerCase().startsWith('.git/')) return 'dossier .git illisible';
  return null;
}
// Raison du refus d'un chemin écrit par l'agent (création ou modification), ou null. autorises : périmètre de la mission.
export function raisonCheminEcriture(p, autorises) {
  if (typeof p !== 'string' || p.length === 0 || p.length > 200 || !RE_CHEMIN.test(p)) return 'chemin de 1 à 200 caractères ASCII sûrs attendu';
  if (p.split('/').some((m) => m === '' || m === '.' || m === '..' || m.startsWith('.') || m.endsWith('.'))) return 'chemin irrégulier ou caché';
  const b = p.toLowerCase();
  if (zonePermanente(p)) return 'zone permanente';
  if (PREFIXES_PROTEGES.some((x) => b.startsWith(x)) || FICHIERS_PROTEGES.includes(b.split('/').pop())) return 'chemin protégé de l\'atelier';
  if (p.startsWith(PERIMETRE_TESTS)) return null; // v0.66.6 (D5-a) : tests/ ouvert à toute mission, sous la garde des tests (gardesStatiques)
  if (!Array.isArray(autorises) || !autorises.some((a) => (a.endsWith('/') ? p.startsWith(a) : p === a))) return 'hors du périmètre de la mission';
  return null;
}

// v0.66.6 (D5-b) : raison du refus d'un chemin ajouté au périmètre (même règle qu'un « autorisé » du plan), ou null.
export function raisonAjoutPerimetre(a) {
  if (typeof a !== 'string') return 'chemin attendu';
  const r = raisonCheminEcriture(a.endsWith('/') ? `${a}x.mjs` : a, [a]);
  if (r) return r;
  if (a.endsWith('/') && PREFIXES_PROTEGES.some((x) => x.startsWith(a.toLowerCase()))) return 'couvre un chemin protégé';
  return null;
}
// Lignes « périmètre + : a, b » d'une réponse de Christophe -> { ajouts, refuses: [{ chemin, raison }] } (insensible à la casse et aux accents
// de « périmètre » ; séparateurs virgule, point-virgule ou espace).
export function lirePerimetre(texte) {
  const ajouts = [];
  const refuses = [];
  for (const l of String(texte ?? '').split('\n')) {
    const m = /^\s*p[ée]rim[èe]tre\s*\+\s*:\s*(.+)$/i.exec(l);
    if (!m) continue;
    for (const c of m[1].split(/[,;\s]+/).map((x) => x.replace(/^[`'"«»\s]+|[`'"«»\s]+$/g, '')).filter(Boolean)) {
      const r = raisonAjoutPerimetre(c);
      if (r) refuses.push({ chemin: c, raison: r }); else if (!ajouts.includes(c)) ajouts.push(c);
    }
  }
  return { ajouts: ajouts.slice(0, 20), refuses };
}

// ------------------------------------------------------------------------------------------------ L4 plan et missions
// Texte de Christophe rendu canonique pour mission.js (LF, sans tabulation ni contrôle, NFC, sans espace au bord des lignes, borné).
export function texteCanonique(t, max = 2000) {
  const s = String(t ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/[\t\u2028\u2029]/g, ' ')
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').split('\n').map((l) => l.trim()).filter((l) => !l.startsWith('== ') && l !== 'FIN DE MISSION').join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
  const c = [...s].slice(0, max).join('').trim();
  return c || '(demande vide)';
}
export const ligneCanonique = (t, max) => texteCanonique(t, max * 2).replace(/\n+/g, ' ').replace(/\s+/g, ' ').slice(0, max).trim();

export const versionSuivante = (v) => {
  if (!RE_VERSION.test(v)) throw new TypeError('versionSuivante : X.Y.Z attendu.');
  const [a, b, c] = v.split('.').map(Number);
  return `${a}.${b}.${c + 1}`;
};

// Données mission.js d'une mission du plan, pour une tentative ; périmètre CUMULÉ (le candidat k contient les missions 1..k).
// v0.66.6 (L0) : + les ajouts « périmètre + » de Christophe (D5-b) et le périmètre implicite tests/ (D5-a).
export function donneesMission({ issue, demande, plan, index, tentative, perimetres = {} }) {
  const m = plan.missions[index];
  const autorises = [...new Set([...plan.missions.slice(0, index + 1).flatMap((x) => [...x.autorises, ...(perimetres[x.id] ?? [])]), PERIMETRE_TESTS])];
  return {
    chantier: `ticket-${issue}`, objectif: texteCanonique(demande.texte), base: { sha: demande.base.sha, version: demande.base.version },
    jalon: { id: m.id, titre: m.titre, comportement: m.comportement }, tentative, criteres: m.criteres, tests: m.tests,
    autorises, interdits: [...INTERDITS_MISSION],
  };
}

// Plan proposé par l'agent de planification -> { plan } (forme canonique) ou { raison }. Chaque mission doit être acceptée par mission.js.
export function lirePlan(p, { issue, demande }) {
  const CLES = 'description,missions';
  if (!estObjet(p) || Object.keys(p).sort().join() !== CLES) return { raison: `plan : clés ${CLES} attendues` };
  if (!estTexte(p.description) || p.description.length > 200 || /\n/.test(p.description)) return { raison: 'plan.description : une ligne de 200 caractères au plus' };
  if (!Array.isArray(p.missions) || p.missions.length < 1 || p.missions.length > MAX_MISSIONS) return { raison: `plan.missions : 1 à ${MAX_MISSIONS} missions` };
  const CM = 'autorises,cognitive,comportement,criteres,id,tests,titre';
  const vus = new Set();
  const missions = [];
  for (const [i, m] of p.missions.entries()) {
    if (!estObjet(m) || Object.keys(m).sort().join() !== CM) return { raison: `mission ${i + 1} : clés ${CM} attendues` };
    if (typeof m.id !== 'string' || m.id.length > 40 || !RE_ID.test(m.id) || vus.has(m.id)) return { raison: `mission ${i + 1} : id [a-z0-9-] unique attendu` };
    vus.add(m.id);
    if (typeof m.cognitive !== 'boolean') return { raison: `mission ${m.id} : cognitive booléen attendu` };
    if (!Array.isArray(m.autorises) || !m.autorises.length) return { raison: `mission ${m.id} : autorises non vide attendu` };
    for (const a of m.autorises) {
      const f = typeof a === 'string' && a.endsWith('/') ? `${a}x.mjs` : a;
      const r = raisonCheminEcriture(f, [a]);
      if (r) return { raison: `mission ${m.id} : autorisé « ${a} » refusé (${r})` };
      if (typeof a === 'string' && a.endsWith('/') && PREFIXES_PROTEGES.some((x) => x.startsWith(a.toLowerCase()))) return { raison: `mission ${m.id} : autorisé « ${a} » couvre un chemin protégé` };
    }
    missions.push({ id: m.id, titre: m.titre, comportement: m.comportement, criteres: m.criteres, tests: m.tests, autorises: m.autorises, cognitive: m.cognitive });
  }
  const plan = { description: p.description, missions };
  for (let i = 0; i < missions.length; i += 1) {
    try { construireMission(donneesMission({ issue, demande, plan, index: i, tentative: 1 })); } catch (e) { return { raison: `mission ${missions[i].id} refusée par mission.js : ${e.message}` }; }
  }
  return { plan };
}

// ------------------------------------------------------------------------------------------------ L5 journal du chantier
export const TYPES_CHANTIER = Object.freeze(['demande', 'tour', 'tour-clos', 'plan', 'planification-echouee', 'candidat', 'sans-candidat', 'verification', 'avis',
  'bloque', 'arret', 'reprise', 'validation', 'livraison', 'livre', 'termine', 'perimetre']);
const ISSUES_TOUR = Object.freeze(['ok', 'echec', 'annule', 'inconnu']);
const VERDICTS = Object.freeze(['verification-technique-conforme', 'verification-technique-non-conforme', 'verification-impossible']);

function raisonDonnees(type, d, e) {
  const mt = () => (e.plan && e.plan.missions.some((m) => m.id === d.mission) && entier(d.tentative, 1) && d.tentative <= MAX_TENTATIVES + e.bonus ? null : 'mission ou tentative inconnue');
  const listeTextes = (l) => Array.isArray(l) && l.length <= 50 && l.every((x) => estTexte(x) && x.length <= 2000);
  switch (type) {
    case 'demande':
      if (!entier(d.issue, 1) || !estTexte(d.titre) || typeof d.texte !== 'string' || !estObjet(d.base) || !RE_SHA.test(d.base.sha ?? '') || !RE_VERSION.test(d.base.version ?? '')) return 'demande illisible';
      return null;
    case 'tour':
      if (!estTexte(d.execution) || !['planifier', 'developper', 'avis'].includes(d.etape) || !entier(d.maximum, 1) || !estTexte(d.run)) return 'tour illisible';
      if (e.tours.some((t) => t.execution === d.execution)) return 'exécution déjà réservée';
      if (e.tours.some((t) => !t.clos)) return 'un tour est déjà ouvert';
      return d.etape === 'planifier' ? null : mt();
    case 'tour-clos': {
      const t = e.tours.find((x) => x.execution === d.execution);
      if (!t) return 'tour inconnu';
      if (t.clos) return 'tour déjà clos';
      if (!entier(d.montant) || !ISSUES_TOUR.includes(d.issue)) return 'clôture illisible';
      return null;
    }
    case 'plan': return e.plan ? 'plan déjà adopté' : (estObjet(d.plan) && Array.isArray(d.plan.missions) && RE_VERSION.test(d.version ?? '') ? null : 'plan illisible');
    case 'planification-echouee': return estTexte(d.raison) ? null : 'raison absente';
    case 'candidat': return mt() || (d.branche === `atelier/ticket-${e.issue}/${d.mission}/${d.tentative}` && RE_SHA.test(d.commit ?? '') && Array.isArray(d.fichiers) && d.fichiers.length ? null : 'candidat illisible');
    case 'sans-candidat': return mt() || (estTexte(d.raison) ? null : 'raison absente');
    case 'verification': return mt() || (VERDICTS.includes(d.verdict) && listeTextes(d.raisons) && typeof d.cognitive === 'boolean' && (d.migration === null || estTexte(d.migration)) ? null : 'vérification illisible');
    case 'avis': return mt() || (typeof d.conforme === 'boolean' && listeTextes(d.objections) ? null : 'avis illisible');
    case 'bloque': return estTexte(d.raison) && (d.question === null || estTexte(d.question)) ? null : 'blocage illisible';
    case 'arret': case 'reprise': case 'validation': return entier(d.par) || d.par === 'veille' ? null : 'auteur illisible';
    case 'livraison': return RE_VERSION.test(d.version ?? '') && RE_SHA.test(d.depot ?? '') && estTexte(d.branche) && /^[0-9a-f]{64}$/.test(d.colis_sha256 ?? '') ? null : 'livraison illisible';
    case 'livre': return ['livre', 'refus', 'echec'].includes(d.conclusion) ? null : 'conclusion illisible';
    case 'termine': return null;
    case 'perimetre': {
      if (!e.plan || !e.plan.missions.some((m) => m.id === d.mission)) return 'mission inconnue';
      if (!e.arrete && !e.bloque) return 'périmètre élargi seulement sur un chantier arrêté ou bloqué';
      if (!entier(d.par) || !Array.isArray(d.ajouts) || d.ajouts.length < 1 || d.ajouts.length > 20) return 'périmètre illisible';
      for (const a of d.ajouts) if (raisonAjoutPerimetre(a)) return `périmètre : « ${a} » refusé (${raisonAjoutPerimetre(a)})`;
      // Le périmètre élargi doit rester acceptable par mission.js (50 entrées au plus) pour cette mission et les suivantes.
      const perimetres = { ...e.perimetres, [d.mission]: [...new Set([...(e.perimetres[d.mission] ?? []), ...d.ajouts])] };
      const debut = e.plan.missions.findIndex((m) => m.id === d.mission);
      for (let i = debut; i < e.plan.missions.length; i += 1) {
        try { construireMission(donneesMission({ issue: e.issue, demande: e.demande, plan: e.plan, index: i, tentative: 1, perimetres })); } catch (x) { return `périmètre refusé par mission.js : ${x.message}`; }
      }
      return null;
    }
    default: return 'type inconnu';
  }
}

function etatVide() {
  return { issue: null, demande: null, plan: null, version: null, tours: [], missions: {}, planifications: 0, arrete: false, bloque: null, validation: false,
    livraison: null, livraisons: 0, livre: null, termine: false, depense: 0, reponses: [], bonus: 0, epoque: 0, echecsPlanification: [], perimetres: {},
    questionTentative: false };
}
const tentativeDe = (e, mission, n) => {
  e.missions[mission] ??= [];
  let t = e.missions[mission].find((x) => x.n === n);
  if (!t) { t = { n, candidat: null, verifications: [], avis: null, echec: null }; e.missions[mission].push(t); e.missions[mission].sort((a, b) => a.n - b.n); }
  return t;
};

function transitionChantier(e, ev) {
  const d = ev.donnees;
  const r = raisonDonnees(ev.type, d, e);
  if (r) return r;
  if (e.termine) return 'chantier terminé';
  switch (ev.type) {
    case 'demande': e.issue = d.issue; e.demande = { titre: d.titre, texte: d.texte, base: { ...d.base } }; break;
    case 'tour': e.tours.push({ execution: d.execution, etape: d.etape, mission: d.mission ?? null, tentative: d.tentative ?? null, maximum: d.maximum, run: d.run, clos: false, montant: null, epoque: e.epoque }); break;
    case 'tour-clos': { const t = e.tours.find((x) => x.execution === d.execution); t.clos = true; t.montant = d.montant; t.issue = d.issue; e.depense += d.montant; break; }
    case 'plan': e.plan = d.plan; e.version = d.version; break;
    case 'planification-echouee': e.planifications += 1; e.echecsPlanification.push(e.epoque); break; // v0.66.6 (D4) : époque retenue
    case 'candidat': tentativeDe(e, d.mission, d.tentative).candidat = { branche: d.branche, commit: d.commit, fichiers: d.fichiers }; break;
    case 'sans-candidat': tentativeDe(e, d.mission, d.tentative).echec = d.raison; break;
    case 'verification': tentativeDe(e, d.mission, d.tentative).verifications.push({ verdict: d.verdict, raisons: d.raisons, cognitive: d.cognitive, migration: d.migration, epoque: e.epoque }); break;
    case 'avis': tentativeDe(e, d.mission, d.tentative).avis = { conforme: d.conforme, objections: d.objections }; break;
    case 'bloque': e.bloque = { raison: d.raison, question: d.question, quand: ev.quand }; e.bloqueRaison = d.raison; e.questionTentative = d.raison === 'question' && Boolean(e.plan); break;
    case 'perimetre': e.perimetres[d.mission] = [...new Set([...(e.perimetres[d.mission] ?? []), ...d.ajouts])]; break;
    case 'arret': e.arrete = true; break;
    case 'reprise':
      e.arrete = false; e.bloque = null;
      if (estTexte(d.reponse)) e.reponses.push(d.reponse);
      if (e.livre && e.livre.conclusion !== 'livre') { e.livraison = null; e.livre = null; }
      if (e.bloqueRaison === 'tentatives-epuisees') e.bonus += MAX_TENTATIVES;
      if (e.questionTentative) e.bonus += 1; // v0.66.6 (L0) : la tentative close par une question de l'agent ne compte pas
      e.questionTentative = false;
      e.epoque += 1;
      break;
    case 'validation': e.validation = true; break;
    case 'livraison': e.livraisons += 1; e.livraison = { version: d.version, depot: d.depot, branche: d.branche, colis_sha256: d.colis_sha256, quand: ev.quand }; break;
    case 'livre': e.livre = { conclusion: d.conclusion, run: d.run ?? null }; break;
    case 'termine': e.termine = true; break;
    default: break;
  }
  return null;
}

function rejouerChantier(journal) {
  if (!Array.isArray(journal) || journal.length === 0) return { n: 0, raison: 'journal vide' };
  const e = etatVide();
  for (const [i, ev] of journal.entries()) {
    const n = i + 1;
    if (!estObjet(ev) || ev.n !== n || !TYPES_CHANTIER.includes(ev.type) || !estTexte(ev.quand) || !estObjet(ev.donnees)) return { n, raison: 'événement illisible ou numérotation rompue' };
    if ((n === 1) !== (ev.type === 'demande')) return { n, raison: 'la demande ouvre le journal, une seule fois' };
    const r = transitionChantier(e, ev);
    if (r) return { n, raison: r };
  }
  return { etat: e };
}
export function appliquerChantier(journal, { type, quand, donnees = {} }) {
  const base = journal ?? [];
  if (base.length) { const a = rejouerChantier(base); if (a.raison) return { refuse: true, raison: `journal incohérent (${a.n}) : ${a.raison}` }; }
  const j = [...base, { n: base.length + 1, type, quand, donnees }];
  const r = rejouerChantier(j);
  return r.raison ? { refuse: true, raison: r.raison } : j;
}
export function etatChantier(journal) {
  const r = rejouerChantier(journal);
  if (r.raison) throw new TypeError(`etatChantier : journal incohérent (${r.n}) : ${r.raison}.`);
  return r.etat;
}

// Ce que l'opérateur fait ensuite. Les étapes payantes (planifier, developper, avis) passent par une réservation de budget.
export function prochaineEtape(e) {
  if (e.termine) return { etape: 'aucune', raison: 'termine' };
  if (e.arrete) return { etape: 'aucune', raison: 'arret' };
  if (e.bloque) return { etape: 'aucune', raison: 'bloque' };
  if (e.tours.some((t) => !t.clos)) return { etape: 'aucune', raison: 'tour-en-cours' };
  if (!e.plan) {
    if (e.echecsPlanification.filter((x) => x === e.epoque).length >= MAX_PLANIFICATIONS) return { etape: 'bloquer', raison: 'planification-impossible', question: 'Le plan n\'a pas pu être établi : reformuler la demande dans le ticket puis écrire /reprendre.' };
    return { etape: 'planifier' };
  }
  let depart = e.demande.base.sha;
  for (const [index, m] of e.plan.missions.entries()) {
    const ts = e.missions[m.id] ?? [];
    const der = ts[ts.length - 1];
    const precedent = (t) => (t && t.candidat ? t.candidat.commit : depart);
    if (!der) return { etape: 'developper', mission: m.id, index, tentative: 1, depart, retour: [] };
    const v = der.verifications[der.verifications.length - 1];
    if (der.candidat && !v) return { etape: 'verifier', mission: m.id, index, tentative: der.n };
    if (v && v.migration && v.epoque === e.epoque) return { etape: 'bloquer', raison: 'migration', question: `La mission « ${m.id} » change la base cognitive (${v.migration}) : nouvelle table ou migration, décision de Christophe nécessaire (répondre puis /reprendre, ou /stop).` };
    if (v && v.verdict === 'verification-impossible' && der.verifications.filter((x) => x.epoque === e.epoque).length < MAX_VERIFICATIONS) return { etape: 'verifier', mission: m.id, index, tentative: der.n };
    const conforme = der.candidat && v && v.verdict === 'verification-technique-conforme' && !v.migration;
    const avisRates = e.tours.filter((t) => t.etape === 'avis' && t.mission === m.id && t.tentative === der.n && t.clos && t.issue !== 'ok' && t.epoque === e.epoque).length;
    if (conforme && !der.avis && avisRates >= 2) return { etape: 'bloquer', raison: 'avis-impossible', question: `Le second avis sur « ${m.id} » n'a pas pu être rendu deux fois de suite (incident technique) : /reprendre pour réessayer, /stop pour arrêter.` };
    if (conforme && !der.avis) return { etape: 'avis', mission: m.id, index, tentative: der.n };
    if (conforme && der.avis.conforme) { depart = der.candidat.commit; continue; }
    const retour = der.echec ? [`tentative ${der.n} sans candidat : ${der.echec}`] : [...(v ? v.raisons : []), ...(v && v.migration ? [`changement de la base cognitive interdit à l'atelier (D-007) : ${v.migration}`] : []), ...(der.avis ? der.avis.objections : [])];
    if (der.n >= MAX_TENTATIVES + e.bonus) return { etape: 'bloquer', raison: 'tentatives-epuisees', question: `La mission « ${m.id} » a échoué ${der.n} fois (${retour.slice(0, 3).join(' ; ').slice(0, 600)}). Préciser la demande puis /reprendre, ou /stop.` };
    return { etape: 'developper', mission: m.id, index, tentative: der.n + 1, depart: precedent(der), retour };
  }
  const cognitif = e.plan.missions.some((m) => m.cognitive) || Object.values(e.missions).some((ts) => ts.some((t) => t.verifications.some((v) => v.cognitive)));
  if (cognitif && !e.validation) return { etape: 'aucune', raison: 'attente-validation', candidat: depart };
  if (!e.livraison) return { etape: 'livrer', candidat: depart };
  if (!e.livre) return { etape: 'aucune', raison: 'attente-livraison' };
  if (e.livre.conclusion === 'livre') return { etape: 'terminer' };
  return { etape: 'bloquer', raison: 'livraison-refusee', question: `Le robot n'a pas livré v${e.livraison.version} (${e.livre.conclusion}). Voir le passage du robot ; /reprendre relance une préparation de livraison, /stop arrête.` };
}

// Commit final des missions validées (candidat cumulé), ou null si aucune mission n'est encore validée.
export function candidatFinal(e) {
  let c = null;
  for (const m of e.plan?.missions ?? []) {
    const ts = e.missions[m.id] ?? [];
    const der = ts[ts.length - 1];
    const v = der?.verifications[der.verifications.length - 1];
    if (!(der?.candidat && v?.verdict === 'verification-technique-conforme' && !v.migration && der.avis?.conforme)) return c;
    c = der.candidat.commit;
  }
  return c;
}

// v0.66.6 (D5-b) : mission en cours (première mission du plan non encore validée), ou null.
export function missionCourante(e) {
  for (const m of e.plan?.missions ?? []) {
    const ts = e.missions[m.id] ?? [];
    const der = ts[ts.length - 1];
    const v = der?.verifications[der.verifications.length - 1];
    if (!(der?.candidat && v?.verdict === 'verification-technique-conforme' && !v.migration && der.avis?.conforme)) return m.id;
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ L8 commandes du ticket
export const COMMANDES = Object.freeze(['/stop', '/reprendre', '/valider']);
// Commentaire -> { commande, reste } ou null. Seul le propriétaire (identifiant numérique, jamais le nom) est entendu ; la commande est
// la première ligne exacte du commentaire ; le reste (réponse à une question) est rendu canonique.
export function lireCommande(commentaire) {
  if (!estObjet(commentaire) || !estObjet(commentaire.user) || commentaire.user.id !== PROPRIETAIRE_ID || typeof commentaire.body !== 'string') return null;
  const [premiere, ...reste] = commentaire.body.replace(/\r\n?/g, '\n').split('\n');
  const c = premiere.trim().toLowerCase();
  if (!COMMANDES.includes(c)) return null;
  const r = reste.join('\n').trim();
  return { commande: c, reste: r ? texteCanonique(r, 1500) : null };
}
// Un ticket ouvre un chantier s'il vient du propriétaire et que son titre commence par « Atelier : ».
export const RE_TITRE_CHANTIER = /^\s*atelier\s*:/i;
export const ticketDeChantier = (t) => estObjet(t) && estObjet(t.user) && t.user.id === PROPRIETAIRE_ID && typeof t.title === 'string' && RE_TITRE_CHANTIER.test(t.title) && !t.pull_request;

// ------------------------------------------------------------------------------------------------ v0.66.6 (D5-a) GARDE DES TESTS
// Qualitative, pas seulement quantitative : un test existant peut être MIS À JOUR par une mission, jamais affaibli en silence.
//  - aucun test retiré (un test peut être renommé dans un changement annoté, jamais supprimé : le nombre de tests ne baisse pas) ;
//    aucun test désactivé (.skip, .todo, .only, option skip/todo/only) ;
//  - aucune neutralisation ajoutée : assertion toujours vraie, « || true », catch vide, if (false), return nu, sortie ou saut du test,
//    valeur comparée à elle-même ;
//  - aucune assertion retirée ni remplacée par une autre forme : pour chaque forme (assert.equal, deepEqual, match, ok, throws…), les
//    lignes retirées n'en contiennent pas plus que les lignes ajoutées ;
//  - dans un fichier de test EXISTANT, chaque test (de sa ligne « test( », commentaires qui la précèdent compris, à la suivante) dont du
//    code change porte, dans ses lignes AJOUTÉES, l'annotation « MISE À JOUR DÉLIBÉRÉE v<version visée> » suivie d'une justification
//    (15 caractères au moins) ; même règle pour le code hors de tout test ;
//  - un nouveau fichier de test contient au moins un test et une assertion, sans désactivation ni neutralisation ;
//  - au plus 15 fichiers de test existants modifiés par candidat.
// Les lignes ainsi modifiées sont rendues par resumeTestsModifies pour le second avis, qui les relit une à une (la justification fait foi
// devant lui, pas devant la garde).
const ANNOTATION = 'MISE À JOUR DÉLIBÉRÉE v';
const RE_ANNOTATIONS = /MISE À JOUR DÉLIBÉRÉE v(\d+\.\d+\.\d+)([^\n]*)/g;
const RE_TITRE_TEST = /\b(?:test|it)\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const RE_ASSERTION = /\bassert(?:\.(\w+))?\s*\(/g;
const MAX_TESTS_MODIFIES = 15;
const DESACTIVATIONS = Object.freeze([
  [/\.(skip|todo|only)\s*\(/, 'test désactivé ou isolé (.skip, .todo, .only)'],
  [/[{,]\s*(skip|todo|only)\s*:/, 'option skip, todo ou only'],
]);
const NEUTRALISATIONS = Object.freeze([
  [/\bassert(?:\.ok)?\s*\(\s*(true|1|!0)\s*[,)]/, 'assertion toujours vraie'],
  [/\|\|\s*true\b/, '« || true »'],
  [/\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/, 'erreur avalée (catch vide)'],
  [/\bif\s*\(\s*(false|0)\s*\)/, 'code rendu mort (if (false))'],
  [/^\s*return\s*;?\s*$/, '« return » nu (fin anticipée du test)'],
  [/\bprocess\.exit\b|\bt\.(skip|todo)\s*\(/, 'sortie ou saut du test'],
  [/\bassert\.\w+\(\s*([A-Za-z_$][\w$.]*)\s*,\s*\1\s*[,)]/, 'valeur comparée à elle-même'],
]);
const codeDe = (l) => l.replace(/(^|[^:'"`])\/\/.*$/, '$1');
const estCommentaire = (l) => /^\s*(\/\/|\/\*|\*)/.test(l);
const titres = (t) => [...(t ?? '').matchAll(RE_TITRE_TEST)].map((m) => m[2]);
const formes = (lignes) => {
  const c = {};
  for (const l of lignes) for (const m of codeDe(l).matchAll(RE_ASSERTION)) { const k = m[1] ?? 'assert'; c[k] = (c[k] ?? 0) + 1; }
  return c;
};
// Différence ligne à ligne (préfixe et suffixe communs retirés, puis plus longue sous-suite commune) : [{ op: '=', '-', '+', l }].
export function diffLignes(avant, apres) {
  const a = (avant ?? '').split('\n');
  const b = (apres ?? '').split('\n');
  let d = 0;
  while (d < a.length && d < b.length && a[d] === b[d]) d += 1;
  let f = 0;
  while (f < a.length - d && f < b.length - d && a[a.length - 1 - f] === b[b.length - 1 - f]) f += 1;
  const x = a.slice(d, a.length - f);
  const y = b.slice(d, b.length - f);
  const out = a.slice(0, d).map((l) => ({ op: '=', l }));
  if (x.length * y.length > 4_000_000) {
    out.push(...x.map((l) => ({ op: '-', l })), ...y.map((l) => ({ op: '+', l })));
  } else {
    const L = Array.from({ length: x.length + 1 }, () => new Int32Array(y.length + 1));
    for (let i = x.length - 1; i >= 0; i -= 1) for (let j = y.length - 1; j >= 0; j -= 1) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < x.length && j < y.length) {
      if (x[i] === y[j]) { out.push({ op: '=', l: x[i] }); i += 1; j += 1; } else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ op: '-', l: x[i] }); i += 1; } else { out.push({ op: '+', l: y[j] }); j += 1; }
    }
    while (i < x.length) { out.push({ op: '-', l: x[i] }); i += 1; }
    while (j < y.length) { out.push({ op: '+', l: y[j] }); j += 1; }
  }
  out.push(...a.slice(a.length - f).map((l) => ({ op: '=', l })));
  return out;
}
const annotationValide = (l, version) => [...l.matchAll(RE_ANNOTATIONS)].some((m) => (version === null || m[1] === version) && m[2].replace(/^[\s(:—–-]+/, '').trim().length >= 15);

// Un fichier sous tests/ créé ou modifié -> { objections, lignes } (lignes : changements de code d'un test existant, pour le second avis).
export function gardeTest({ chemin, etat, avant, apres }, version = null) {
  const objections = [];
  const lignes = [];
  const ici = (m) => objections.push(`« ${chemin} » : ${m}`);
  const verifierAjouts = (ls) => {
    for (const l of ls) {
      const c = codeDe(l);
      for (const [re, motif] of [...DESACTIVATIONS, ...NEUTRALISATIONS]) if (re.test(c)) { ici(`${motif} : ${l.trim().slice(0, 160)}`); break; }
    }
  };
  if (etat === 'cree' || avant === null || avant === undefined) {
    const ls = (apres ?? '').split('\n');
    verifierAjouts(ls);
    if (chemin.endsWith('.test.mjs') && (!titres(apres).length || !Object.keys(formes(ls)).length)) ici('nouveau fichier de test sans test ou sans assertion');
    return { objections, lignes };
  }
  const ops = diffLignes(avant, apres);
  const ta = titres(avant);
  const tb = titres(apres);
  if (tb.length < ta.length) { const reste = new Set(tb); ici(`${ta.length - tb.length} test(s) retiré(s) : ${ta.filter((t) => !reste.has(t)).map((t) => `« ${t.slice(0, 100)} »`).join(', ')}`); }
  const ajoutees = ops.filter((o) => o.op === '+').map((o) => o.l);
  const retirees = ops.filter((o) => o.op === '-').map((o) => o.l);
  verifierAjouts(ajoutees);
  const fa = formes(ajoutees);
  for (const [k, n] of Object.entries(formes(retirees))) if ((fa[k] ?? 0) < n) ici(`assertion ${k === 'assert' ? 'assert(…)' : `assert.${k}`} retirée ou remplacée par une autre forme (${n} retirée(s), ${fa[k] ?? 0} ajoutée(s))`);
  // segments : un par test (sa ligne « test( » au début d'une ligne, avec les commentaires et lignes vides qui la précèdent), le code hors
  // test formant ses propres segments ; une ligne retirée appartient au segment de la ligne qui la suit dans le fichier modifié.
  const seg = new Array(ops.length).fill(0);
  let n = 0;
  for (let i = 0; i < ops.length; i += 1) {
    if (ops[i].op !== '-' && /^(test|it)\s*\(/.test(ops[i].l)) {
      n += 1;
      let j = i - 1;
      while (j >= 0 && (ops[j].op === '-' || !ops[j].l.trim() || estCommentaire(ops[j].l)) && seg[j] === n - 1) { if (ops[j].op !== '-') seg[j] = n; j -= 1; }
      for (let k = j + 1; k < i; k += 1) seg[k] = n;
    }
    seg[i] = Math.max(seg[i], n);
  }
  const parSegment = new Map();
  ops.forEach((o, i) => { if (!parSegment.has(seg[i])) parSegment.set(seg[i], []); parSegment.get(seg[i]).push(o); });
  for (const os of parSegment.values()) {
    const code = os.filter((o) => o.op !== '=' && o.l.trim() && !estCommentaire(o.l));
    if (!code.length) continue;
    if (!os.some((o) => o.op === '+' && annotationValide(o.l, version))) ici(`changement sans annotation « ${ANNOTATION}${version ?? 'X.Y.Z'} » justifiée : ${code[0].op}${code[0].l.trim().slice(0, 160)}`);
    for (const o of code) if (lignes.length < 60) lignes.push(`${o.op} ${o.l.trim().slice(0, 400)}`);
  }
  return { objections, lignes };
}

// Changements de tests EXISTANTS d'un candidat, pour le second avis : [{ chemin, lignes }].
export function resumeTestsModifies(fichiers, version = null) {
  return fichiers.filter((f) => f.chemin.startsWith(PERIMETRE_TESTS) && f.etat === 'modifie').map((f) => ({ chemin: f.chemin, lignes: gardeTest(f, version).lignes })).filter((x) => x.lignes.length);
}

// ------------------------------------------------------------------------------------------------ L6 gardes statiques
const DOSSIERS_COGNITIFS = Object.freeze(['app/langage/', 'app/esprit/', 'app/memoire/', 'app/moteur-local/', 'app/conversation/', 'app/actions/']);
const AJOUTS_INTERDITS = Object.freeze([
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, 'appel réseau ajouté dans app/'],
  [/anthropic|openai|generativelanguage|\bgemini\b|\bclaude-[a-z0-9]|api[_-]?key/i, 'appel ou clé de modèle externe ajouté dans app/ (D-001)'],
  [/(from|import\s*\()\s*['"][^'"]*\/(atelier|fournisseurs)\//, 'import de l\'atelier ou des fournisseurs ajouté dans app/'],
  [/(from|import\s*\()\s*['"][^'"]*outils-atelier/, 'import des outils de l\'atelier ajouté dans app/'],
]);
const RE_BASE = /^export const (VERSION_BASE|SCHEMA_SAUVEGARDE|TABLES) = (.*)$/m;

// fichiers : [{ chemin, etat: 'cree'|'modifie'|'supprime', avant: texte|null, apres: texte|null }] (diff base..candidat).
// Rend { objections: [textes], cognitive: booléen, migration: texte|null }.
// v0.66.6 (D5-a) : { version } = version visée du chantier, exigée dans l'annotation des tests modifiés (null : toute version).
export function gardesStatiques(fichiers, { version = null } = {}) {
  const objections = [];
  let cognitive = false;
  const migrations = [];
  const testsModifies = fichiers.filter((f) => f.chemin.startsWith(PERIMETRE_TESTS) && f.etat === 'modifie').length;
  if (testsModifies > MAX_TESTS_MODIFIES) objections.push(`${testsModifies} fichiers de test existants modifiés : ${MAX_TESTS_MODIFIES} au plus par candidat`);
  for (const f of fichiers) {
    const p = f.chemin;
    if (p.startsWith(PERIMETRE_TESTS) && f.etat !== 'supprime' && typeof f.apres === 'string') objections.push(...gardeTest(f, version).objections);
    if (f.etat === 'supprime') objections.push(`« ${p} » supprimé : l'atelier autonome ne supprime aucun fichier`);
    const r = raisonCheminEcriture(p, [p]);
    if (r) objections.push(`« ${p} » : ${r}`);
    if (DOSSIERS_COGNITIFS.some((d) => p.startsWith(d))) cognitive = true;
    if (p.startsWith('app/') && typeof f.apres === 'string') {
      const avant = new Set((f.avant ?? '').split('\n'));
      const ajouts = f.apres.split('\n').filter((l) => !avant.has(l));
      for (const [re, motif] of AJOUTS_INTERDITS) if (ajouts.some((l) => re.test(l))) objections.push(`« ${p} » : ${motif}`);
      const lire = (t) => { const out = {}; for (const l of (t ?? '').split('\n')) { const m = RE_BASE.exec(l); if (m) out[m[1]] = m[2].split('//')[0].trim(); } return out; };
      const a = lire(f.avant);
      const b = lire(f.apres);
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) migrations.push(`${k} dans ${p}`);
    }
  }
  return { objections, cognitive, migration: migrations.length ? migrations.join(', ') : null };
}

// Rapport atelier-rapport-1 construit par l'opérateur (même principe que auto.js rapportCandidat) : fichiers relus dans Git, comptes de
// tests repris des faits AT-5 (le rapport ne fait jamais foi ; la confrontation compare au diff et à l'exécution réels).
export function rapportOperateur({ mission, candidat, fichiers, tests }) {
  const liste = (etat) => fichiers.filter((x) => x.etat === etat).map((x) => x.chemin).sort();
  return `${JSON.stringify({
    protocole: 'atelier-rapport-1', chantier: mission.chantier, jalon: mission.jalon.id, tentative: mission.tentative, base: { sha: mission.base.sha, version: mission.base.version },
    statut: 'candidat', candidat: { branche: `atelier/${mission.chantier}/${mission.jalon.id}/${mission.tentative}`, sha: candidat }, fichiers: { crees: liste('cree'), modifies: liste('modifie'), supprimes: liste('supprime') },
    tests: { total: tests.total, reussis: tests.reussis, echecs: tests.echecs }, divergences: ['Rapport construit par l\'opérateur autonome : fichiers relus dans Git, comptes repris des faits AT-5.'],
    question: null, motif: null,
  }, null, 2)}\n`;
}

// ------------------------------------------------------------------------------------------------ textes du ticket
const usd = (m) => `${(m / USD).toFixed(2)} $`;
export function texteEtat(e, budget) {
  const l = [];
  const p = prochaineEtape(e);
  l.push(`**Atelier autonome** — chantier \`ticket-${e.issue}\` (OUTILLAGE NON COGNITIF : un candidat n'est jamais une acquisition de Naissance)`);
  if (e.plan) {
    l.push('', `Plan : ${e.plan.description} — version visée v${e.version}`);
    for (const m of e.plan.missions) {
      const ts = e.missions[m.id] ?? [];
      const der = ts[ts.length - 1];
      const v = der?.verifications[der.verifications.length - 1];
      const ok = der?.candidat && v?.verdict === 'verification-technique-conforme' && der.avis?.conforme;
      l.push(`- ${ok ? '✅' : der ? '🔧' : '⏳'} ${m.id} : ${m.titre}${m.cognitive ? ' (cognitive : validation de Christophe)' : ''}${der ? ` — tentative ${der.n}/${MAX_TENTATIVES + e.bonus}` : ''}${e.perimetres[m.id]?.length ? ` — périmètre + : ${e.perimetres[m.id].join(', ')}` : ''}`);
    }
  }
  l.push('', `Dépense du chantier : ${usd(e.depense)} sur ${usd(PLAFOND_CHANTIER)}${budget ? ` — mois ${budget.cycle} : ${usd(budget.consommeCycle)} consommés, ${usd(budget.engageCycle)} réservés, ${usd(budget.resteCycle)} restants sur ${usd(budget.plafond)}` : ''}`);
  const suite = {
    planifier: 'planification en cours', developper: `développement de « ${p.mission} » (tentative ${p.tentative})`, verifier: `vérification AT-5 de « ${p.mission} »`,
    avis: `second avis sur « ${p.mission} »`, livrer: 'préparation du colis et dépôt au robot', terminer: 'clôture',
  }[p.etape];
  if (suite) l.push(`Étape suivante : ${suite}. Écrire \`/stop\` pour arrêter.`);
  if (p.raison === 'arret') l.push('⏸️ Arrêté. Écrire `/reprendre` pour continuer.');
  if (p.raison === 'bloque') l.push(`⛔ Bloqué (${e.bloque.raison}).${e.bloque.question ? ` Question : ${e.bloque.question}` : ''} Répondre en écrivant \`/reprendre\` sur la première ligne puis la réponse, ou \`/stop\`.`);
  if (p.raison === 'attente-validation') l.push('🧠 Changement cognitif : valider en écrivant `/valider` (ou `/stop`). Rien n\'est livré avant.');
  if (p.raison === 'attente-livraison') l.push(`📦 Colis v${e.livraison.version} déposé au robot : approuver « Review deployments » (livraison) quand le contrôle est vert.`);
  if (p.raison === 'termine' || p.etape === 'terminer') l.push(`🏁 Livré : v${e.livraison?.version}.`);
  return `${l.join('\n')}\n`;
}

// v0.66.6 (ATELIER 2, L1) : données lisibles par l'écran « Atelier — capacités » de l'application, ajoutées au commentaire d'état
// sous forme d'un commentaire HTML invisible : <!-- atelier-autonome-donnees {json} -->. Aucun secret, aucun texte de la demande.
export const MARQUE_DONNEES = '<!-- atelier-autonome-donnees ';
export function donneesEtat(e, budget) {
  const p = prochaineEtape(e);
  const missions = (e.plan?.missions ?? []).map((m) => {
    const ts = e.missions[m.id] ?? [];
    const der = ts[ts.length - 1];
    const v = der?.verifications[der.verifications.length - 1];
    const ok = Boolean(der?.candidat && v?.verdict === 'verification-technique-conforme' && der.avis?.conforme);
    return { id: m.id, titre: m.titre, cognitive: Boolean(m.cognitive), etat: ok ? 'validee' : der ? 'en-cours' : 'a-faire', tentative: der?.n ?? 0, tentatives: MAX_TENTATIVES + e.bonus };
  });
  const d = {
    v: 1, ticket: e.issue, etape: p.etape, raison: p.raison ?? null, mission: p.mission ?? null, tentative: p.tentative ?? null,
    plan: e.plan ? e.plan.description : null, version: e.version, missions,
    bloque: e.bloque ? { raison: e.bloque.raison, question: e.bloque.question } : null,
    depense: e.depense, plafond: PLAFOND_CHANTIER,
    mois: budget ? { cycle: budget.cycle, consomme: budget.consommeCycle, engage: budget.engageCycle, reste: budget.resteCycle, plafond: budget.plafond } : null,
    livraison: e.livraison ? { version: e.livraison.version, conclusion: e.livre?.conclusion ?? null } : null,
  };
  // « -- » n'apparaît que dans des chaînes JSON : échappé, il ne peut pas fermer le commentaire HTML.
  return `${MARQUE_DONNEES}${JSON.stringify(d).replace(/--/g, '-\\u002d')} -->`;
}
// === FIN_ATELIER_AUTONOME_NOYAU ===
