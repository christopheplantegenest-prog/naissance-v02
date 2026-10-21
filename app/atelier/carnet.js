// === DEBUT_ATELIER_CARNET ===
// v0.65.18 — AT-10.1 « CARNET DE TROIS MISSIONS » (GO « AT-10.1 — GO RÉALISATION LOCALE », 21/10/2026 ; D-007, décisions AT-10 D1–D10).
// v0.65.19 — AT-10.2 « PRÉPARATION AUTOMATIQUE D'UNE MISSION » (GO « AT-10.2 — GO RÉALISATION LOCALE », 21/10/2026 ; DA, DB, DC, DE) : preparationMission, comparerChantier renforcée.
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Ce module ne connaît ni le moteur, ni la mémoire, ni aucune table.
// Un carnet = TROIS missions immuables après approbation humaine (V1), menées l'une après l'autre ; la mission k est un chantier AT-1
// ordinaire « <carnet>-m<k> » (un jalon, une tentative), avec son registre AT-2, sa sauvegarde D3 et sa décision humaine (V3). Le carnet
// ne remplace rien : il fixe le plan, impose l'ordre, additionne les coûts et s'arrête au premier échec, refus, doute ou dépassement.
// LE JOURNAL EST LA SEULE VÉRITÉ : { n, type, quand, donnees }, n = 1, 2, … sans trou, le premier est « carnet-ouvert ».
//   lireProposition(donnees)          -> { proposition } ou { raison } (le texte collé au téléphone, protocole atelier-carnet-proposition-1)
//   ouvrirCarnet(donnees, quand)      -> journal d'un seul « carnet-ouvert » (proposition invalide : TypeError)
//   appliquerCarnet(journal, evenement) -> NOUVEAU journal ou { refuse: true, raison } (rien n'est écrit nulle part)
//   etatCarnet(journal)               -> état rejoué (journal incohérent : TypeError) ; verifierCarnet(journal) -> { ok } ou { ok: false, n, raison }
//   etatDurableCarnet / lireEtatCarnet / comparerCarnets : forme durable (carnet.json sur journal-atelier/<carnet>) et extension
//   bilanChantier, comparerChantier, chantierDeMission : lecture d'un chantier de mission (AT-1 + AT-2), jamais d'écriture
//   preparationMission (v0.65.19, AT-10.2) : chantier, plan, instantané, cycle, plafond et appel AUTO de la mission ouverte, dérivés de la V1
//   texteLivraison / lireLivraison : preuve de livraison ATELIER-LIVRAISON-1, émise par outils-atelier/auto-carnet.mjs après vérification Git
// BUDGET (microdollars) : à l'ouverture de la mission k, son plafond est RÉSERVÉ ; il devient une dépense CONFIRMÉE à la clôture ou à la
// livraison (coût du registre AT-2 du chantier, inscrit une seule fois) ; un coût inconnu (issue inconnue) garde la réservation entière.
// disponible = plafond_total - confirmé - réservé ; une mission ne s'ouvre que si son plafond tient dans le disponible.
// JAMAIS : quatrième mission, modification d'une mission après V1, mission hors ordre, relance, livraison sans preuve, appel payant.
// PURETÉ : aucune horloge (« quand » est fourni), aucun hasard, aucun état, aucune entrée/sortie ; imports de l'atelier seulement.

import { construireMission } from './mission.js';
import { lireAppel, estimationMax, lireDeveloppement, cheminsDeveloppement } from './auto.js';
import { etatDe } from './chantier.js';
import { etatBudget } from './budget.js';
import { canonique } from './journal.js';
import { hacherSha256 } from './empreinte.js';

export const PROTOCOLE_CARNET = 'atelier-carnet-1';
export const PROTOCOLE_PROPOSITION_CARNET = 'atelier-carnet-proposition-1';
export const PROTOCOLE_LIVRAISON = 'ATELIER-LIVRAISON-1';
// D4 (AT-10) : trois missions, 0,50 $ au plus par mission, 1 $ au plus pour le carnet.
export const BORNES_CARNET = Object.freeze({ missions: 3, plafond_mission: 500000, plafond_total: 1000000 });
// Outillage non cognitif seulement : un chemin autorisé commence par l'un de ces préfixes (les chemins P1 restent refusés par auto.js).
export const PREFIXES_CARNET = Object.freeze(['app/atelier/', 'app/styles.css', 'tests/atelier-', 'outils-atelier/']);
const TYPES = Object.freeze(['carnet-ouvert', 'carnet-approuve', 'mission-ouverte', 'mission-close', 'mission-livree', 'mission-validee', 'carnet-arrete']);
const ISSUES_CLOSE = Object.freeze(['refusee', 'sans-candidat', 'issue-inconnue', 'arretee']);
const CLES_PROPOSITION = 'base,carnet,limite_espace,missions,objectif,plafond_total,protocole';
const CLES_MISSION = 'appel,autorises,criteres,decisions,developpement,frontieres,interdits,jalon,objectif,plafond,tests';
const CLES_JALON = 'comportement,critere,id,titre';
const CLES_DURABLE = 'carnet,journal,protocole';
const RE_CARNET = /^carnet-[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_EMPREINTE = /^[0-9a-f]{64}$/;
// Même forme que mission.js : la version livrée devient la base de la mission suivante.
const RE_VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
const RE_LIVRAISON = /^ATELIER-LIVRAISON-1 carnet=(carnet-[a-z0-9]+(?:-[a-z0-9]+)*) mission=([1-3]) chantier=([a-z0-9]+(?:-[a-z0-9]+)*) version=(\d+\.\d+\.\d+) main=([0-9a-f]{40}) candidat=([0-9a-f]{40}) cout=(0|[1-9]\d{0,15}) preuve=([0-9a-f]{64})$/;

const estTexte = (v) => typeof v === 'string' && v.trim().length > 0;
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const estMontant = (v) => Number.isSafeInteger(v) && v >= 0;
const cles = (o) => Object.keys(o).sort().join(',');

function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}
const copieGelee = (v) => geler(structuredClone(v));

// Version X.Y.Z strictement supérieure (comparaison numérique champ par champ).
function versionSuperieure(a, b) {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

export const chantierDeMission = (carnet, k) => `${carnet}-m${k}`;

// Données AT-3 de la mission k (base fournie) : celles que construireMission et cheminsDeveloppement relisent.
function donneesMission(carnet, k, m, base) {
  return {
    chantier: chantierDeMission(carnet, k), objectif: m.objectif, base: { sha: base.sha, version: base.version },
    jalon: { id: m.jalon.id, titre: m.jalon.titre, comportement: m.jalon.comportement }, tentative: 1,
    criteres: m.criteres, tests: m.tests, autorises: m.autorises, interdits: m.interdits, frontieres: m.frontieres, decisions: m.decisions,
  };
}

// Raison du refus d'une mission k de la proposition, ou null.
function raisonMission(p, k, m) {
  const ici = `mission ${k}`;
  if (!estObjet(m) || cles(m) !== CLES_MISSION) return `${ici} : clés inattendues`;
  if (!estObjet(m.jalon) || cles(m.jalon) !== CLES_JALON) return `${ici} : jalon incomplet (id, titre, critere, comportement attendus)`;
  if (!estTexte(m.jalon.critere) || m.jalon.critere.length > 300) return `${ici} : critère du jalon vide ou trop long (300 caractères au plus)`;
  if (!estMontant(m.plafond) || m.plafond === 0 || m.plafond > BORNES_CARNET.plafond_mission) return `${ici} : plafond hors bornes (1 à ${BORNES_CARNET.plafond_mission} microdollars)`;
  const a = lireAppel(m.appel);
  if (a.raison) return `${ici} : appel invalide (${a.raison})`;
  if (estimationMax(m.appel) > m.plafond) return `${ici} : coût maximal de l'appel (${estimationMax(m.appel)}) au-dessus du plafond (${m.plafond})`;
  const d = lireDeveloppement(m.developpement, m.appel);
  if (d.raison) return `${ici} : développement invalide (${d.raison})`;
  if (!Array.isArray(m.autorises) || !m.autorises.every((c) => typeof c === 'string' && PREFIXES_CARNET.some((x) => c.startsWith(x)))) return `${ici} : chemin autorisé hors de l'outillage de l'atelier`;
  let donnees;
  try { donnees = donneesMission(p.carnet, k, m, p.base); construireMission(donnees); } catch (e) { return `${ici} : dossier impossible (${e.message})`; }
  const c = cheminsDeveloppement(donnees, m.developpement);
  if (c.raison) return `${ici} : périmètre refusé (${c.raison})`;
  return null;
}

// Proposition de carnet (texte canonique collé au téléphone) ; rend { proposition } gelée ou { raison }.
export function lireProposition(p) {
  const refus = (raison) => ({ raison });
  if (!estObjet(p) || cles(p) !== CLES_PROPOSITION) return refus('clés de la proposition inattendues');
  if (p.protocole !== PROTOCOLE_PROPOSITION_CARNET) return refus(`protocole inconnu : ${JSON.stringify(p.protocole)}`);
  if (typeof p.carnet !== 'string' || p.carnet.length > 37 || !RE_CARNET.test(p.carnet)) return refus('identifiant du carnet invalide (carnet-…, 37 caractères au plus)');
  // Les chantiers des missions sont « <carnet>-m<k> » sous le même espace journal-atelier/ : un carnet ne peut pas porter un tel nom.
  if (/-m[0-9]+$/.test(p.carnet)) return refus('identifiant du carnet invalide (ne peut pas finir par -m<chiffres>, réservé aux chantiers des missions)');
  if (!estTexte(p.objectif) || p.objectif.length > 2000) return refus('objectif du carnet vide ou trop long');
  if (!estObjet(p.base) || cles(p.base) !== 'sha,version' || !RE_SHA.test(p.base.sha) || typeof p.base.version !== 'string' || !RE_VERSION.test(p.base.version)) return refus('base invalide (sha de 40 caractères et version X.Y.Z attendus)');
  if (!estMontant(p.plafond_total) || p.plafond_total === 0 || p.plafond_total > BORNES_CARNET.plafond_total) return refus(`plafond total hors bornes (1 à ${BORNES_CARNET.plafond_total} microdollars)`);
  if (!estMontant(p.limite_espace) || p.plafond_total > p.limite_espace) return refus('plafond total au-dessus de la limite déclarée de l\'espace Console');
  if (!Array.isArray(p.missions) || p.missions.length !== BORNES_CARNET.missions) return refus(`exactement ${BORNES_CARNET.missions} missions attendues`);
  for (const [i, m] of p.missions.entries()) {
    const r = raisonMission(p, i + 1, m);
    if (r) return refus(r);
  }
  const somme = p.missions.reduce((s, m) => s + m.plafond, 0);
  if (somme > p.plafond_total) return refus(`somme des plafonds des missions (${somme}) au-dessus du plafond total (${p.plafond_total})`);
  return { proposition: copieGelee(p) };
}
export const empreinteProposition = (p) => hacherSha256(canonique(p));

export function ouvrirCarnet(donnees, quand) {
  const l = lireProposition(donnees);
  if (l.raison) throw new TypeError(`ouvrirCarnet : ${l.raison}.`);
  if (!estTexte(quand)) throw new TypeError('ouvrirCarnet : horodatage « quand » attendu.');
  return geler([{ n: 1, type: 'carnet-ouvert', quand, donnees: structuredClone(donnees) }]);
}

function etatInitial(p) {
  return {
    id: p.carnet, objectif: p.objectif, base: { ...p.base }, plafond_total: p.plafond_total, limite_espace: p.limite_espace,
    empreinte: empreinteProposition(p), statut: 'brouillon', missionCourante: null, motif: null,
    missions: p.missions.map((m, i) => ({ k: i + 1, chantier: chantierDeMission(p.carnet, i + 1), plafond: m.plafond, spec: m, statut: 'a-venir', base: null, issue: null, cout: null, livraison: null })),
  };
}

// Budget dérivé (jamais stocké) : confirmé = coûts connus inscrits ; réservé = plafonds des missions ouvertes et des coûts inconnus.
export function budgetCarnet(e) {
  let confirme = 0;
  let reserve = 0;
  for (const m of e.missions) {
    if (m.statut === 'ouverte' || (m.statut === 'close' && m.cout === null)) reserve += m.plafond;
    else if (m.cout !== null) confirme += m.cout;
  }
  return { confirme, reserve, disponible: e.plafond_total - confirme - reserve };
}

const TERMINAUX = Object.freeze(['termine', 'arrete']);

// Applique un événement à l'état (modifié sur place) ; rend une raison de refus ou null.
function transition(e, ev) {
  const d = ev.donnees;
  if (TERMINAUX.includes(e.statut)) return `carnet ${e.statut === 'termine' ? 'terminé' : 'arrêté'} : plus aucun événement`;
  if (ev.type === 'carnet-ouvert') return 'carnet déjà ouvert';
  if (ev.type === 'carnet-arrete') {
    if (!estTexte(d.motif)) return 'motif de l\'arrêt vide';
    e.statut = 'arrete'; e.motif = d.motif;
    return null;
  }
  if (e.statut === 'bloque') return 'carnet bloqué : seul l\'arrêt est possible';
  if (ev.type === 'carnet-approuve') {
    if (e.statut !== 'brouillon') return 'carnet déjà approuvé';
    if (d.empreinte !== e.empreinte) return 'empreinte approuvée différente de celle du carnet ouvert';
    e.statut = 'approuve';
    return null;
  }
  if (e.statut === 'brouillon') return 'carnet non approuvé (V1)';
  const k = d.k;
  if (!Number.isInteger(k) || k < 1 || k > e.missions.length) return 'numéro de mission hors du carnet';
  const m = e.missions[k - 1];
  if (ev.type === 'mission-ouverte') {
    if (e.missionCourante !== null && e.missions[e.missionCourante - 1].statut !== 'validee') return `mission ${e.missionCourante} non validée`;
    const suivante = e.missionCourante === null ? 1 : e.missionCourante + 1;
    if (k !== suivante) return `mission ${suivante} attendue (ordre strict)`;
    if (d.chantier !== m.chantier) return `chantier « ${m.chantier} » attendu pour la mission ${k}`;
    const attendue = k === 1 ? e.base : { sha: e.missions[k - 2].livraison.main, version: e.missions[k - 2].livraison.version };
    if (!estObjet(d.base) || d.base.sha !== attendue.sha || d.base.version !== attendue.version) return `base de la mission ${k} différente de ${attendue.version}@${attendue.sha.slice(0, 8)}`;
    if (m.plafond > budgetCarnet(e).disponible) return `plafond de la mission ${k} (${m.plafond}) au-dessus du disponible du carnet (${budgetCarnet(e).disponible})`;
    m.statut = 'ouverte'; m.base = { sha: attendue.sha, version: attendue.version }; e.missionCourante = k; e.statut = 'en-cours';
    return null;
  }
  if (k !== e.missionCourante) return `mission ${k} : ce n'est pas la mission en cours`;
  if (ev.type === 'mission-close') {
    if (m.statut !== 'ouverte') return `mission ${k} non ouverte`;
    if (!ISSUES_CLOSE.includes(d.issue)) return 'issue de clôture inconnue';
    if (d.issue === 'issue-inconnue' ? d.cout !== null : !estMontant(d.cout)) return d.issue === 'issue-inconnue' ? 'issue inconnue : coût non inscrit (réservation conservée)' : 'coût de la mission invalide';
    m.statut = 'close'; m.issue = d.issue; m.cout = d.cout; e.statut = 'bloque';
    return null;
  }
  if (ev.type === 'mission-livree') {
    if (m.statut !== 'ouverte') return `mission ${k} non ouverte`;
    const l = lireDonneesLivraison(d);
    if (l) return l;
    if (d.carnet !== e.id || d.chantier !== m.chantier) return 'preuve de livraison d\'un autre carnet ou d\'un autre chantier';
    if (!versionSuperieure(d.version, m.base.version)) return `version livrée ${d.version} non supérieure à la base ${m.base.version}`;
    if (d.main === m.base.sha) return 'commit livré égal à la base';
    if (d.cout > m.plafond) return `coût de la mission ${k} (${d.cout}) au-dessus de son plafond (${m.plafond}) : STOP`;
    m.statut = 'livree'; m.issue = 'livree'; m.cout = d.cout;
    m.livraison = { version: d.version, main: d.main, candidat: d.candidat, preuve: d.preuve };
    return null;
  }
  if (ev.type === 'mission-validee') {
    if (m.statut !== 'livree') return `mission ${k} non livrée`;
    m.statut = 'validee';
    if (k === e.missions.length) { e.statut = 'termine'; e.missionCourante = null; }
    return null;
  }
  return `type d'événement inconnu : ${ev.type}`;
}

function lireDonneesLivraison(d) {
  if (cles(d) !== 'candidat,carnet,chantier,cout,k,main,preuve,version') return 'preuve de livraison incomplète';
  if (!RE_SHA.test(d.main) || !RE_SHA.test(d.candidat) || !RE_EMPREINTE.test(d.preuve) || typeof d.version !== 'string' || !RE_VERSION.test(d.version) || !estMontant(d.cout)) return 'preuve de livraison illisible';
  return null;
}

function rejouer(journal) {
  if (!Array.isArray(journal) || journal.length === 0) return { n: 0, raison: 'journal vide' };
  let e = null;
  for (const [i, ev] of journal.entries()) {
    const n = i + 1;
    if (!estObjet(ev) || cles(ev) !== 'donnees,n,quand,type' || ev.n !== n || !estTexte(ev.quand) || !estObjet(ev.donnees) || !TYPES.includes(ev.type)) return { n, raison: 'événement mal formé' };
    if (n === 1) {
      if (ev.type !== 'carnet-ouvert') return { n, raison: 'le premier événement doit être « carnet-ouvert »' };
      const l = lireProposition(ev.donnees);
      if (l.raison) return { n, raison: l.raison };
      e = etatInitial(ev.donnees);
      continue;
    }
    const r = transition(e, ev);
    if (r) return { n, raison: r };
  }
  return { etat: e };
}

export function etatCarnet(journal) {
  const r = rejouer(journal);
  if (r.raison) throw new TypeError(`etatCarnet : journal incohérent (événement ${r.n}) : ${r.raison}.`);
  return geler({ ...r.etat, budget: budgetCarnet(r.etat) });
}

export function verifierCarnet(journal) {
  const r = rejouer(journal);
  return r.raison ? { ok: false, n: r.n, raison: r.raison } : { ok: true };
}

export function appliquerCarnet(journal, evenement) {
  const r = rejouer(journal);
  if (r.raison) return { refuse: true, raison: `journal incohérent (événement ${r.n}) : ${r.raison}` };
  if (!estObjet(evenement) || !TYPES.includes(evenement.type) || !estTexte(evenement.quand) || !estObjet(evenement.donnees)) return { refuse: true, raison: 'événement mal formé' };
  const ev = { n: journal.length + 1, type: evenement.type, quand: evenement.quand, donnees: structuredClone(evenement.donnees) };
  const raison = transition(r.etat, ev);
  if (raison) return { refuse: true, raison };
  return geler([...structuredClone(journal), ev]);
}

// ------------------------------------------------------------------------------------------------ forme durable (D3 du carnet)
export function etatDurableCarnet(journal) {
  const e = etatCarnet(journal);
  return { protocole: PROTOCOLE_CARNET, carnet: e.id, journal };
}

// Texte durable (carnet.json) ; rend { durable, etat, empreinte } ou { raison }. Même discipline que journal.js : ASCII canonique.
export function lireEtatCarnet(texte) {
  const refus = (raison) => ({ raison });
  if (typeof texte !== 'string' || texte === '') return refus('texte du carnet absent');
  if (!/^[\x20-\x7e\n]*$/.test(texte)) return refus('caractère hors ASCII imprimable : forme non canonique');
  let v;
  try { v = JSON.parse(texte); } catch { return refus('JSON illisible'); }
  if (canonique(v) !== texte) return refus('forme non canonique (clés triées, indentation 1, ASCII, saut de ligne final)');
  if (!estObjet(v) || cles(v) !== CLES_DURABLE) return refus('clés de l\'état du carnet inattendues');
  if (v.protocole !== PROTOCOLE_CARNET) return refus(`protocole inconnu : ${JSON.stringify(v.protocole)}`);
  const r = rejouer(v.journal);
  if (r.raison) return refus(`journal du carnet incohérent (événement ${r.n}) : ${r.raison}`);
  if (r.etat.id !== v.carnet) return refus('identifiant du carnet différent de celui du journal');
  return { durable: geler(v), etat: geler({ ...r.etat, budget: budgetCarnet(r.etat) }), empreinte: hacherSha256(texte) };
}

// Extension autorisée : même carnet, journal prolongé (préfixe exact). Rend { statut: 'identique' | 'extension' } ou { raison }.
export function comparerCarnets(ancien, nouveau) {
  if (ancien.carnet !== nouveau.carnet) return { raison: 'carnet différent' };
  const a = ancien.journal;
  const b = nouveau.journal;
  if (b.length < a.length || !a.every((x, i) => canonique(x) === canonique(b[i]))) return { raison: 'journal du carnet non prolongé (réécriture ou retrait)' };
  return { statut: b.length === a.length ? 'identique' : 'extension' };
}

// ------------------------------------------------------------------------------------------------ chantier de la mission k (lecture seule)
// Bilan d'un chantier de mission : statut AT-1, candidat accepté (sha) et coût AT-2 de ses exécutions. CONSERVATEUR : cout = null
// (inconnu = true) sans registre, tant qu'un engagement n'est pas résolu, ou si un coût a été inscrit en régularisation d'une issue
// inconnue (montant non constaté). Ne décide rien.
export function bilanChantier({ journal, registre }) {
  const e = etatDe(journal);
  const acceptee = journal.filter((ev) => ev.type === 'tentative-acceptee').pop();
  let cout = 0;
  let inconnu = !registre;
  if (registre) {
    const b = etatBudget(registre);
    for (const [id, x] of Object.entries(b.executions)) {
      if (x.chantier !== e.id) continue;
      if (x.statut === 'engagee') inconnu = true; else cout += x.montant;
      if (registre.some((ev) => ev.type === 'cout' && ev.donnees.execution === id && ev.donnees.issue === 'issue-inconnue')) inconnu = true;
    }
  }
  return { statut: e.statut, candidat: acceptee ? acceptee.donnees.candidat : null, cout: inconnu ? null : cout, inconnu };
}

// v0.65.19 — AT-10.2 : PRÉPARATION de la mission k ouverte, dérivée de la SEULE mission approuvée (V1) et de sa base ; rien d'autre.
// Rend { chantier, plan, mission, cycle, plafond, appel, developpement, engagement } gelé, ou { raison }. Aucune écriture, aucun appel :
// l'engagement est l'estimation maximale de l'appel approuvé (<= plafond de la mission) ; il ne vaut ni approbation d'appel (V2), ni dépense.
export function preparationMission(e, k) {
  const m = e.missions[k - 1];
  if (!m) return { raison: `mission ${k} hors du carnet` };
  if (e.statut !== 'en-cours' || e.missionCourante !== k || m.statut !== 'ouverte' || m.base === null) return { raison: `mission ${k} non ouverte dans le carnet` };
  const s = m.spec;
  // DB : la V1 couvre EXACTEMENT ce plan (un seul jalon, celui de la mission, une tentative) ; aucun ajout.
  const plan = [{ id: s.jalon.id, titre: s.jalon.titre, critere: s.jalon.critere, tentativesMax: 1 }];
  const mission = donneesMission(e.id, k, s, m.base);
  try { construireMission(mission); } catch (err) { return { raison: `dossier de la mission ${k} impossible (${err.message})` }; }
  const appel = lireAppel(s.appel);
  if (appel.raison) return { raison: `appel de la mission ${k} invalide (${appel.raison})` };
  const developpement = lireDeveloppement(s.developpement, s.appel);
  if (developpement.raison) return { raison: `développement de la mission ${k} invalide (${developpement.raison})` };
  const engagement = estimationMax(s.appel);
  if (engagement > m.plafond) return { raison: `estimation maximale (${engagement}) au-dessus du plafond de la mission (${m.plafond})` };
  return geler({
    chantier: { id: m.chantier, objectif: s.objectif, base: { sha: m.base.sha, version: m.base.version }, plan },
    plan, mission: structuredClone(mission),
    // DC : un cycle AT-2 par mission, borné par le plafond de la mission ; aucune réserve ; aucune dépense autorisée par lui-même.
    cycle: { cycle: m.chantier, plafond: m.plafond, reserve: 0, plafondRun: m.plafond }, plafond: m.plafond,
    appel: structuredClone(appel), developpement: structuredClone(developpement), engagement,
  });
}

// Le chantier (copie de l'appareil ou chantier.json de la D3) est-il EXACTEMENT la préparation de la mission k ? Rend une raison
// (DIVERGENCE) ou null. Même fonction pour l'écran, la garde D8 (sauver-chantier) et la preuve de livraison. Un état incomplet
// (registre, plafond ou pièce absents) ou altéré (cycle, plafond, instantané, appel, engagement différents) est une divergence.
export function comparerChantier(e, k, { journal, registre, pieces }) {
  const m = e.missions[k - 1];
  if (!m || m.statut === 'a-venir' || m.base === null) return `mission ${k} non ouverte dans le carnet`;
  const c = etatDe(journal);
  if (c.id !== m.chantier) return `chantier « ${c.id} » au lieu de « ${m.chantier} »`;
  if (c.objectif !== m.spec.objectif) return 'objectif du chantier différent de la mission';
  if (c.base.sha !== m.base.sha || c.base.version !== m.base.version) return 'base du chantier différente de la mission';
  if (c.plan.length !== 1) return 'le chantier d\'une mission a exactement un jalon';
  const j = c.plan[0];
  if (j.id !== m.spec.jalon.id || j.titre !== m.spec.jalon.titre || j.critere !== m.spec.jalon.critere || j.tentativesMax !== 1) return 'jalon du chantier différent de la mission (id, titre, critère, une tentative)';
  if (!Array.isArray(registre) || registre.length === 0) return 'préparation incomplète : registre AT-2 absent';
  const cycle = { cycle: m.chantier, plafond: m.plafond, reserve: 0, plafondRun: m.plafond };
  if (registre[0].type !== 'cycle-ouvert' || canonique(registre[0].donnees) !== canonique(cycle) || registre.filter((ev) => ev.type === 'cycle-ouvert').length !== 1) return `cycle AT-2 différent de celui de la mission (${m.chantier}, plafond ${m.plafond}, réserve 0)`;
  const plafonnes = registre.filter((ev) => ev.type === 'chantier-plafonne');
  if (plafonnes.length === 0) return 'préparation incomplète : plafond AT-2 du chantier absent';
  if (plafonnes.length !== 1 || plafonnes[0].donnees.chantier !== c.id || plafonnes[0].donnees.plafond !== m.plafond) return `plafond AT-2 du chantier différent du plafond de la mission (${m.plafond})`;
  const engagement = estimationMax(m.spec.appel);
  for (const ev of registre) {
    if (ev.type === 'engagement' && (ev.donnees.chantier !== c.id || ev.donnees.execution !== `${c.id}/${j.id}/1` || ev.donnees.maximum !== engagement)) return `engagement AT-2 différent de l'estimation de l'appel approuvé (${engagement})`;
  }
  const lancees = journal.filter((ev) => ev.type === 'tentative-lancee');
  if (lancees.length > 0) {
    const attendu = { jalon: j.id, mode: 'AUTO', appel: lireAppel(m.spec.appel), developpement: lireDeveloppement(m.spec.developpement, m.spec.appel) };
    if (canonique(lancees[0].donnees) !== canonique(attendu)) return 'lancement différent de l\'appel approuvé (AUTO, appel et développement de la mission)';
    const piece = pieces && Object.hasOwn(pieces, `${j.id}/1`) ? pieces[`${j.id}/1`] : null;
    if (!piece) return 'préparation incomplète : instantané de la mission absent';
    if (canonique(piece.mission) !== canonique(donneesMission(e.id, k, m.spec, m.base))) return 'instantané de la mission différent de la mission approuvée';
  }
  return null;
}

// Pré-remplissage du formulaire du chantier de la mission k (identifiant, objectif, base, jalon) ; la préparation complète : preparationMission.
export function formulaireMission(e, k) {
  const m = e.missions[k - 1];
  if (!m || m.statut !== 'ouverte') return null;
  return { chantier: m.chantier, objectif: m.spec.objectif, version: m.base.version, sha: m.base.sha, jalons: [{ id: m.spec.jalon.id, titre: m.spec.jalon.titre, critere: m.spec.jalon.critere, tentativesMax: '1' }] };
}

// ------------------------------------------------------------------------------------------------ preuve de livraison
export function texteLivraison({ carnet, k, chantier, version, main, candidat, cout, preuve }) {
  const t = `${PROTOCOLE_LIVRAISON} carnet=${carnet} mission=${k} chantier=${chantier} version=${version} main=${main} candidat=${candidat} cout=${cout} preuve=${preuve}`;
  if (!RE_LIVRAISON.test(t) || !RE_VERSION.test(version)) throw new TypeError('texteLivraison : champs de livraison invalides.');
  return t;
}
export function lireLivraison(texte) {
  if (typeof texte !== 'string') return { raison: 'preuve de livraison absente' };
  const m = RE_LIVRAISON.exec(texte.endsWith('\n') ? texte.slice(0, -1) : texte);
  if (!m || !RE_VERSION.test(m[4])) return { raison: 'preuve de livraison illisible (ATELIER-LIVRAISON-1 carnet=… mission=… chantier=… version=… main=… candidat=… cout=… preuve=… attendu)' };
  return { livraison: geler({ carnet: m[1], k: Number(m[2]), chantier: m[3], version: m[4], main: m[5], candidat: m[6], cout: Number(m[7]), preuve: m[8] }) };
}
// === FIN_ATELIER_CARNET ===
