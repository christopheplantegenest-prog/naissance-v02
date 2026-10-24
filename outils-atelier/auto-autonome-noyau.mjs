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

import { appliquerBudget, etatBudget, ouvrirRegistre } from '../app/atelier/budget.js';
import { construireMission } from '../app/atelier/mission.js';
import { zonePermanente } from '../app/atelier/verification.js';

export const PROPRIETAIRE_ID = 308310970;
export const MODELE = 'claude-opus-5-5';
export const USD = 1_000_000;
export const PLAFOND_MENSUEL = 100 * USD;
export const PLAFOND_TOUR = 10 * USD;
// Plafond d'un chantier, cumulé sur tous les mois (garde-fou contre un chantier qui s'emballe ; la vraie borne reste le mois).
export const PLAFOND_CHANTIER = 300 * USD;
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
export function reserverTour(journal, { quand, execution, issue, etape }) {
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
  const maximum = Math.min(RESERVES[etape], e.resteCycle, e.chantiers[ch].reste);
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
const PREFIXES_PROTEGES = Object.freeze(['app/atelier/', 'outils-atelier/', 'tests/atelier-', '.github/', '.git/', 'signature/', 'android/', 'node_modules/']);
const FICHIERS_PROTEGES = Object.freeze(['package.json', 'package-lock.json']);
// Interdits ajoutés à chaque mission (en plus des zones permanentes de mission.js) : la mission ne peut pas viser l'atelier.
export const INTERDITS_MISSION = Object.freeze(['app/atelier/', 'outils-atelier/', 'package-lock.json', 'package.json']);
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
  if (!Array.isArray(autorises) || !autorises.some((a) => (a.endsWith('/') ? p.startsWith(a) : p === a))) return 'hors du périmètre de la mission';
  return null;
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
export function donneesMission({ issue, demande, plan, index, tentative }) {
  const m = plan.missions[index];
  const autorises = [...new Set(plan.missions.slice(0, index + 1).flatMap((x) => x.autorises))];
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
  'bloque', 'arret', 'reprise', 'validation', 'livraison', 'livre', 'termine']);
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
    default: return 'type inconnu';
  }
}

function etatVide() {
  return { issue: null, demande: null, plan: null, version: null, tours: [], missions: {}, planifications: 0, arrete: false, bloque: null, validation: false,
    livraison: null, livraisons: 0, livre: null, termine: false, depense: 0, reponses: [], bonus: 0, epoque: 0 };
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
    case 'planification-echouee': e.planifications += 1; break;
    case 'candidat': tentativeDe(e, d.mission, d.tentative).candidat = { branche: d.branche, commit: d.commit, fichiers: d.fichiers }; break;
    case 'sans-candidat': tentativeDe(e, d.mission, d.tentative).echec = d.raison; break;
    case 'verification': tentativeDe(e, d.mission, d.tentative).verifications.push({ verdict: d.verdict, raisons: d.raisons, cognitive: d.cognitive, migration: d.migration, epoque: e.epoque }); break;
    case 'avis': tentativeDe(e, d.mission, d.tentative).avis = { conforme: d.conforme, objections: d.objections }; break;
    case 'bloque': e.bloque = { raison: d.raison, question: d.question, quand: ev.quand }; e.bloqueRaison = d.raison; break;
    case 'arret': e.arrete = true; break;
    case 'reprise':
      e.arrete = false; e.bloque = null;
      if (estTexte(d.reponse)) e.reponses.push(d.reponse);
      if (e.livre && e.livre.conclusion !== 'livre') { e.livraison = null; e.livre = null; }
      if (e.bloqueRaison === 'tentatives-epuisees') e.bonus += MAX_TENTATIVES;
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
    if (e.planifications >= MAX_PLANIFICATIONS) return { etape: 'bloquer', raison: 'planification-impossible', question: 'Le plan n\'a pas pu être établi : reformuler la demande dans le ticket puis écrire /reprendre.' };
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
export function gardesStatiques(fichiers) {
  const objections = [];
  let cognitive = false;
  const migrations = [];
  for (const f of fichiers) {
    const p = f.chemin;
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
      l.push(`- ${ok ? '✅' : der ? '🔧' : '⏳'} ${m.id} : ${m.titre}${m.cognitive ? ' (cognitive : validation de Christophe)' : ''}${der ? ` — tentative ${der.n}/${MAX_TENTATIVES}` : ''}`);
    }
  }
  l.push('', `Dépense du chantier : ${usd(e.depense)}${budget ? ` — mois ${budget.cycle} : ${usd(budget.consommeCycle)} consommés, ${usd(budget.engageCycle)} réservés, ${usd(budget.resteCycle)} restants sur ${usd(budget.plafond)}` : ''}`);
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
// === FIN_ATELIER_AUTONOME_NOYAU ===
