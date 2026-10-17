// === DEBUT_ATELIER_BUDGET ===
// v0.65.1 — AT-2 « REGISTRE DE BUDGET » (GO Christophe + ChatGPT « AUTORISATION AT-2 », 17/10/2026 ; D-007 ACTIVE).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Ce module ne connaît ni le moteur, ni la mémoire, ni aucune table,
// ni le modèle du chantier : il ne l'importe pas ; les identifiants de chantier et d'exécution sont des textes opaques.
// UNITÉ INTERNE : le MICRODOLLAR. 1 USD = 1 000 000 microdollars. Tout montant est un entier sûr (Number.isSafeInteger) >= 0 ;
// aucun nombre à virgule n'est accepté, aucune conversion depuis des dollars décimaux n'est faite ici (frontière ultérieure).
//   100 USD = 100_000_000 ; 0,01 USD = 10_000 ; 0,000001 USD = 1.
// Principe : on raisonne sur la BORNE annoncée, jamais sur le coût espéré. Un engagement compte à son maximum jusqu'à ce que
// son coût réel soit inscrit (un coût réel de 0 le libère). Règles d'un engagement (égalité exacte autorisée) :
//   1. registre non suspendu ; 2. plafond du chantier déclaré ; 3. maximum <= plafondRun ;
//   4. consommeCycle + engageCycle + maximum <= plafond - reserve ; 5. consommeChantier + engageChantier + maximum <= plafondChantier.
// Un coût réel supérieur au maximum engagé est inscrit tel quel, gardé dans « depassements », et SUSPEND le registre : plus aucun
// engagement (anomalie de borne financière à examiner ; aucune levée dans AT-2). Un nouveau cycle remet à zéro la consommation et
// les engagements du cycle, jamais le plafond ni la consommation d'un chantier (plafond de chantier global à travers les cycles).
// LE JOURNAL EST LA SEULE VÉRITÉ : { n, type, quand, donnees }, n = 1, 2, … sans trou, le premier est « cycle-ouvert ».
//   ouvrirRegistre(donnees, quand)    -> journal d'un seul « cycle-ouvert » (données invalides : TypeError, aucun journal)
//   appliquerBudget(journal, evenement) -> NOUVEAU journal (le reçu est inchangé) ou { refuse: true, raison, limite } (rien d'écrit)
//   etatBudget(journal)               -> état reconstruit par rejeu (journal incohérent : TypeError)
//   verifierRegistre(journal)         -> { ok: true } ou { ok: false, n, raison } (première incohérence)
// PURETÉ : aucun import, aucune horloge (« quand » est fourni par l'appelant), aucun hasard, aucun état, aucune entrée/sortie.
// NON BRANCHÉ : aucun fichier hors de app/atelier/ ne mentionne ce module (gardé par tests/atelier-budget.test.mjs).

const TYPES = Object.freeze(['cycle-ouvert', 'chantier-plafonne', 'engagement', 'cout']);

const estTexte = (v) => typeof v === 'string' && v.trim().length > 0;
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const estMontant = (v) => Number.isSafeInteger(v) && v >= 0;
const MD = 'microdollars';

function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}
const copieGelee = (v) => geler(structuredClone(v));
const refus = (limite, raison) => ({ limite, raison });

// Somme d'entiers sûrs ; null si elle sort des entiers sûrs.
function somme(...xs) {
  let s = 0;
  for (const x of xs) s += x;
  return Number.isSafeInteger(s) ? s : null;
}

// Raison du refus des données d'un cycle, ou null.
function raisonCycle(d) {
  if (!estObjet(d)) return 'données absentes';
  if (!estTexte(d.cycle)) return 'identifiant du cycle absent';
  for (const k of ['plafond', 'reserve', 'plafondRun']) if (!estMontant(d[k])) return `« ${k} » doit être un entier sûr >= 0 (${MD})`;
  if (d.reserve > d.plafond) return `réserve ${d.reserve} > plafond ${d.plafond} (${MD})`;
  return null;
}

function ouvrirCycle(e, d) {
  e.cycle = d.cycle; e.plafond = d.plafond; e.reserve = d.reserve; e.plafondRun = d.plafondRun;
  e.consommeCycle = 0; e.engageCycle = 0;
  e.cycles.push(d.cycle);
}

function etatInitial(d) {
  const e = { cycles: [], chantiers: Object.create(null), executions: Object.create(null), depassements: [], suspendu: false };
  ouvrirCycle(e, d);
  return e;
}

// Applique un événement à un état (muté) ; rend { limite, raison } d'un refus, ou null.
function transition(e, ev) {
  const d = ev.donnees;
  if (ev.type === 'cycle-ouvert') {
    const r = raisonCycle(d);
    if (r) return refus('donnees', r);
    if (e.cycles.includes(d.cycle)) return refus('cycle-deja-utilise', `cycle « ${d.cycle} » déjà ouvert`);
    const ouverte = Object.keys(e.executions).find((x) => e.executions[x].statut === 'engagee');
    if (ouverte !== undefined) return refus('engagement-ouvert', `exécution « ${ouverte} » encore engagée : son coût réel doit être inscrit avant un nouveau cycle`);
    ouvrirCycle(e, d);
    return null;
  }
  if (ev.type === 'chantier-plafonne') {
    if (!estTexte(d.chantier)) return refus('donnees', 'identifiant du chantier absent');
    if (!estMontant(d.plafond)) return refus('donnees', `« plafond » doit être un entier sûr >= 0 (${MD})`);
    if (Object.hasOwn(e.chantiers, d.chantier)) return refus('plafond-deja-declare', `chantier « ${d.chantier} » : plafond déjà déclaré (aucune modification dans AT-2)`);
    e.chantiers[d.chantier] = { plafond: d.plafond, consomme: 0, engage: 0 };
    return null;
  }
  if (!estTexte(d.execution)) return refus('donnees', 'identifiant de l\'exécution absent');
  if (ev.type === 'engagement') {
    if (!estTexte(d.chantier)) return refus('donnees', 'identifiant du chantier absent');
    if (!Number.isSafeInteger(d.maximum) || d.maximum < 1) return refus('donnees', `« maximum » doit être un entier sûr >= 1 (${MD})`);
    if (Object.hasOwn(e.executions, d.execution)) return refus('doublon', `exécution « ${d.execution} » déjà engagée`);
    if (e.suspendu) return refus('suspendu', 'registre suspendu après un dépassement réel : aucun nouvel engagement');
    const c = Object.hasOwn(e.chantiers, d.chantier) ? e.chantiers[d.chantier] : null;
    if (!c) return refus('chantier-sans-plafond', `chantier « ${d.chantier} » sans plafond déclaré`);
    if (d.maximum > e.plafondRun) return refus('run', `maximum ${d.maximum} > plafond par exécution ${e.plafondRun} (${MD})`);
    const cycle = somme(e.consommeCycle, e.engageCycle, d.maximum);
    const utilisable = e.plafond - e.reserve;
    if (cycle === null || cycle > utilisable) return refus('cycle', `cycle : consommé ${e.consommeCycle} + engagé ${e.engageCycle} + maximum ${d.maximum} = ${cycle ?? 'hors entier sûr'} > utilisable ${utilisable} (plafond ${e.plafond} - réserve ${e.reserve}) (${MD})`);
    const chantier = somme(c.consomme, c.engage, d.maximum);
    if (chantier === null || chantier > c.plafond) return refus('chantier', `chantier « ${d.chantier} » : consommé ${c.consomme} + engagé ${c.engage} + maximum ${d.maximum} = ${chantier ?? 'hors entier sûr'} > plafond ${c.plafond} (${MD})`);
    e.executions[d.execution] = { chantier: d.chantier, cycle: e.cycle, maximum: d.maximum, statut: 'engagee', montant: null };
    e.engageCycle += d.maximum; c.engage += d.maximum;
    return null;
  }
  // cout
  if (!estMontant(d.montant)) return refus('donnees', `« montant » doit être un entier sûr >= 0 (${MD})`);
  const x = Object.hasOwn(e.executions, d.execution) ? e.executions[d.execution] : null;
  if (!x) return refus('execution-inconnue', `exécution « ${d.execution} » inconnue : aucun coût sans engagement`);
  if (x.statut !== 'engagee') return refus('doublon', `exécution « ${d.execution} » : coût réel déjà inscrit`);
  const c = e.chantiers[x.chantier];
  const cycle = somme(e.consommeCycle, d.montant);
  const chantier = somme(c.consomme, d.montant);
  if (cycle === null || chantier === null) return refus('donnees', 'somme hors des entiers sûrs');
  x.statut = 'payee'; x.montant = d.montant;
  e.consommeCycle = cycle; e.engageCycle -= x.maximum;
  c.consomme = chantier; c.engage -= x.maximum;
  if (d.montant > x.maximum) {
    e.depassements.push({ execution: d.execution, chantier: x.chantier, cycle: x.cycle, maximum: x.maximum, montant: d.montant, excedent: d.montant - x.maximum });
    e.suspendu = true;
  }
  return null;
}

// Champs dérivés de l'état rendu (jamais négatifs ; un excès reste visible dans « depassements » et les consommations).
function rendu(e) {
  const reste = (plafond, ...xs) => Math.max(0, plafond - xs.reduce((a, b) => a + b, 0));
  const chantiers = Object.create(null);
  for (const k of Object.keys(e.chantiers)) {
    const c = e.chantiers[k];
    chantiers[k] = { plafond: c.plafond, consomme: c.consomme, engage: c.engage, reste: reste(c.plafond, c.consomme, c.engage) };
  }
  const utilisable = e.plafond - e.reserve;
  return {
    unite: MD, cycle: e.cycle, plafond: e.plafond, reserve: e.reserve, plafondRun: e.plafondRun, utilisable,
    consommeCycle: e.consommeCycle, engageCycle: e.engageCycle, resteCycle: reste(utilisable, e.consommeCycle, e.engageCycle),
    chantiers, executions: e.executions, depassements: e.depassements, suspendu: e.suspendu, cycles: e.cycles,
  };
}

// Rejoue le journal : { etat } ou { n, raison, limite } à la première incohérence.
function rejouer(journal) {
  if (!Array.isArray(journal) || journal.length === 0) return { n: 0, limite: 'journal', raison: 'journal vide ou absent' };
  let e = null;
  for (let i = 0; i < journal.length; i += 1) {
    const ev = journal[i];
    const n = i + 1;
    if (!estObjet(ev)) return { n, limite: 'journal', raison: 'événement absent' };
    if (ev.n !== n) return { n, limite: 'journal', raison: `numérotation rompue (attendu ${n}, trouvé ${ev.n})` };
    if (!TYPES.includes(ev.type)) return { n, limite: 'journal', raison: `type d'événement inconnu : « ${ev.type} »` };
    if (!estTexte(ev.quand)) return { n, limite: 'journal', raison: '« quand » absent' };
    if (!estObjet(ev.donnees)) return { n, limite: 'journal', raison: '« donnees » absentes' };
    if (n === 1) {
      if (ev.type !== 'cycle-ouvert') return { n, limite: 'journal', raison: 'le premier événement doit être « cycle-ouvert »' };
      const r = raisonCycle(ev.donnees);
      if (r) return { n, limite: 'donnees', raison: r };
      e = etatInitial(ev.donnees);
      continue;
    }
    const r = transition(e, ev);
    if (r) return { n, ...r };
  }
  return { etat: e };
}

export function ouvrirRegistre(donnees, quand) {
  const r = raisonCycle(donnees);
  if (r) throw new TypeError(`ouvrirRegistre : ${r}.`);
  if (!estTexte(quand)) throw new TypeError('ouvrirRegistre : « quand » est attendu (texte fourni par l\'appelant).');
  return copieGelee([{ n: 1, type: 'cycle-ouvert', quand, donnees }]);
}

export function appliquerBudget(journal, evenement) {
  const avant = rejouer(journal);
  if (avant.raison) return { refuse: true, limite: 'journal', raison: `journal incohérent (événement ${avant.n}) : ${avant.raison}` };
  if (!estObjet(evenement)) return { refuse: true, limite: 'journal', raison: 'événement absent' };
  const n = journal.length + 1;
  if (evenement.n !== undefined && evenement.n !== n) return { refuse: true, limite: 'journal', raison: `numérotation rompue (attendu ${n}, trouvé ${evenement.n})` };
  const ev = { n, type: evenement.type, quand: evenement.quand, donnees: evenement.donnees === undefined ? {} : evenement.donnees };
  const apres = rejouer([...journal, ev]);
  if (apres.raison) return { refuse: true, limite: apres.limite, raison: apres.raison };
  return copieGelee([...journal, ev]);
}

export function etatBudget(journal) {
  const r = rejouer(journal);
  if (r.raison) throw new TypeError(`etatBudget : journal incohérent (événement ${r.n}) : ${r.raison}.`);
  return geler(rendu(r.etat));
}

export function verifierRegistre(journal) {
  const r = rejouer(journal);
  return r.raison ? { ok: false, n: r.n, raison: r.raison } : { ok: true };
}
// === FIN_ATELIER_BUDGET ===
