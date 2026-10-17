// === DEBUT_ATELIER_CHANTIER ===
// v0.65.0 — AT-1 « MODÈLE DU CHANTIER » (GO Christophe + ChatGPT « AUTORISATION AT-1 », 17/10/2026 ; D-007 ADOPTÉE).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Ce module ne connaît ni le moteur, ni la mémoire, ni aucune table.
// Un chantier = un objectif, un plan de jalons immuable après approbation, des tentatives bornées par jalon.
// LE JOURNAL EST LA SEULE VÉRITÉ : une liste d'événements { n, type, quand, donnees }, n = 1, 2, … sans trou, le premier est « ouvert ».
// L'état n'est jamais stocké : etatDe() le reconstruit en rejouant le journal depuis le début.
//   ouvrirChantier(donnees, quand) -> journal d'un seul événement « ouvert » (données invalides : TypeError, aucun journal)
//   appliquer(journal, evenement)  -> NOUVEAU journal (le reçu est inchangé) ou { refuse: true, raison } (rien n'est écrit nulle part)
//   etatDe(journal)                -> état courant (journal incohérent : TypeError)
//   verifierJournal(journal)       -> { ok: true } ou { ok: false, n, raison } (première incohérence)
// Append-only par construction : tout journal rendu est une copie profonde gelée (Object.freeze à tous les niveaux) ; un événement
// ajouté est copié avant d'être gelé, l'appelant ne peut donc pas le changer après coup. Une clé inconnue de « donnees » est conservée.
// Terminal dans AT-1 : « arrete », « termine », et « bloque » (qui ne peut qu'être arrêté). Aucun déblocage, aucune modification de plan.
// PURETÉ : aucun import, aucune horloge (« quand » est fourni par l'appelant), aucun hasard, aucun état, aucune entrée/sortie.
// NON BRANCHÉ : aucun fichier de app/ n'importe ce module (gardé par tests/atelier-chantier.test.mjs).

const TYPES = Object.freeze(['ouvert', 'plan-approuve', 'tentative-lancee', 'tentative-rendue', 'tentative-acceptee', 'tentative-rejetee', 'tentative-annulee', 'chantier-arrete']);

const estTexte = (v) => typeof v === 'string' && v.trim().length > 0;
const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}
const copieGelee = (v) => geler(structuredClone(v));

// Raison du refus des données d'ouverture, ou null.
function raisonOuverture(d) {
  if (!estObjet(d)) return 'données absentes';
  if (!estTexte(d.id)) return 'identifiant du chantier absent';
  if (!estTexte(d.objectif)) return 'objectif vide';
  if (!estObjet(d.base) || !estTexte(d.base.sha) || !estTexte(d.base.version)) return 'base incomplète (sha et version attendus)';
  if (!Array.isArray(d.plan) || d.plan.length === 0) return 'plan vide';
  const ids = new Set();
  for (const j of d.plan) {
    if (!estObjet(j) || !estTexte(j.id) || !estTexte(j.titre) || !estTexte(j.critere)) return 'jalon incomplet (id, titre, critere attendus)';
    if (!Number.isInteger(j.tentativesMax) || j.tentativesMax < 1) return `tentativesMax invalide pour le jalon « ${j.id} »`;
    if (ids.has(j.id)) return `identifiant de jalon en double : « ${j.id} »`;
    ids.add(j.id);
  }
  return null;
}

function etatInitial(d) {
  return {
    id: d.id, objectif: d.objectif, base: { sha: d.base.sha, version: d.base.version }, statut: 'ouvert', jalonCourant: null,
    plan: d.plan.map((j) => ({ id: j.id, titre: j.titre, critere: j.critere, tentativesMax: j.tentativesMax, statut: 'a-faire', tentatives: [] })),
  };
}

const vivante = (j) => j.tentatives.find((t) => t.statut === 'lancee' || t.statut === 'rendue') || null;

// Après un rejet ou une annulation : le jalon repart, ou bloque le chantier s'il n'a plus de tentative.
function apresEchec(e, j) {
  if (j.tentatives.length < j.tentativesMax) j.statut = 'a-faire';
  else { j.statut = 'bloque'; e.statut = 'bloque'; }
}

// Applique un événement à un état (muté) ; rend la raison d'un refus, ou null.
function transition(e, ev) {
  const d = ev.donnees;
  if (e.statut === 'arrete' || e.statut === 'termine') return `chantier ${e.statut} : plus aucun événement accepté`;
  if (ev.type === 'ouvert') return 'chantier déjà ouvert';
  if (ev.type === 'plan-approuve') {
    if (e.statut !== 'ouvert') return 'plan déjà approuvé';
    e.statut = 'en-cours'; e.jalonCourant = 0;
    return null;
  }
  if (ev.type === 'chantier-arrete') {
    if (!estTexte(d.motif)) return 'motif absent';
    const j = e.jalonCourant === null ? null : e.plan[e.jalonCourant];
    const t = j && vivante(j);
    if (t) { t.statut = 'annulee'; t.motif = d.motif; j.statut = 'a-faire'; }
    e.statut = 'arrete';
    return null;
  }
  if (e.statut !== 'en-cours') return `chantier ${e.statut} : aucune tentative possible`;
  const j = e.plan[e.jalonCourant];
  if (d.jalon !== j.id) return `jalon « ${d.jalon} » non courant (courant : « ${j.id} »)`;
  const t = vivante(j);
  if (ev.type === 'tentative-lancee') {
    if (t) return `une tentative est déjà vivante (n° ${t.numero})`;
    if (j.tentatives.length >= j.tentativesMax) return 'tentatives épuisées';
    j.tentatives.push({ numero: j.tentatives.length + 1, statut: 'lancee', reference: null, motif: null });
    j.statut = 'en-cours';
    return null;
  }
  if (!t || d.numero !== t.numero) return `tentative n° ${d.numero} inexistante ou terminée`;
  if (ev.type === 'tentative-rendue') {
    if (t.statut !== 'lancee') return 'tentative déjà rendue';
    if (!estTexte(d.reference)) return 'référence absente';
    t.statut = 'rendue'; t.reference = d.reference;
    return null;
  }
  if (!estTexte(d.motif)) return 'motif absent';
  if (ev.type === 'tentative-annulee') { t.statut = 'annulee'; t.motif = d.motif; apresEchec(e, j); return null; }
  if (t.statut !== 'rendue') return 'tentative non rendue';
  t.motif = d.motif;
  if (ev.type === 'tentative-rejetee') { t.statut = 'rejetee'; apresEchec(e, j); return null; }
  t.statut = 'acceptee'; j.statut = 'accepte';
  if (e.jalonCourant + 1 < e.plan.length) e.jalonCourant += 1;
  else { e.jalonCourant = null; e.statut = 'termine'; }
  return null;
}

// Rejoue le journal : { etat } ou { n, raison } à la première incohérence.
function rejouer(journal) {
  if (!Array.isArray(journal) || journal.length === 0) return { n: 0, raison: 'journal vide ou absent' };
  let e = null;
  for (let i = 0; i < journal.length; i += 1) {
    const ev = journal[i];
    const n = i + 1;
    if (!estObjet(ev)) return { n, raison: 'événement absent' };
    if (ev.n !== n) return { n, raison: `numérotation rompue (attendu ${n}, trouvé ${ev.n})` };
    if (!TYPES.includes(ev.type)) return { n, raison: `type d'événement inconnu : « ${ev.type} »` };
    if (!estTexte(ev.quand)) return { n, raison: '« quand » absent' };
    if (!estObjet(ev.donnees)) return { n, raison: '« donnees » absentes' };
    if (n === 1) {
      if (ev.type !== 'ouvert') return { n, raison: 'le premier événement doit être « ouvert »' };
      const r = raisonOuverture(ev.donnees);
      if (r) return { n, raison: r };
      e = etatInitial(ev.donnees);
      continue;
    }
    const r = transition(e, ev);
    if (r) return { n, raison: r };
  }
  return { etat: e };
}

export function ouvrirChantier(donnees, quand) {
  const r = raisonOuverture(donnees);
  if (r) throw new TypeError(`ouvrirChantier : ${r}.`);
  if (!estTexte(quand)) throw new TypeError('ouvrirChantier : « quand » est attendu (texte fourni par l\'appelant).');
  return copieGelee([{ n: 1, type: 'ouvert', quand, donnees }]);
}

export function appliquer(journal, evenement) {
  const avant = rejouer(journal);
  if (avant.raison) return { refuse: true, raison: `journal incohérent (événement ${avant.n}) : ${avant.raison}` };
  if (!estObjet(evenement)) return { refuse: true, raison: 'événement absent' };
  const n = journal.length + 1;
  if (evenement.n !== undefined && evenement.n !== n) return { refuse: true, raison: `numérotation rompue (attendu ${n}, trouvé ${evenement.n})` };
  const ev = { n, type: evenement.type, quand: evenement.quand, donnees: evenement.donnees === undefined ? {} : evenement.donnees };
  const apres = rejouer([...journal, ev]);
  if (apres.raison) return { refuse: true, raison: apres.raison };
  return copieGelee([...journal, ev]);
}

export function etatDe(journal) {
  const r = rejouer(journal);
  if (r.raison) throw new TypeError(`etatDe : journal incohérent (événement ${r.n}) : ${r.raison}.`);
  return geler(r.etat);
}

export function verifierJournal(journal) {
  const r = rejouer(journal);
  return r.raison ? { ok: false, n: r.n, raison: r.raison } : { ok: true };
}
// === FIN_ATELIER_CHANTIER ===
