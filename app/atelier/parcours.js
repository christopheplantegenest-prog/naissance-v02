// === DEBUT_ATELIER_PARCOURS ===
// v0.65.6 — AT-6 « MANUEL DE BOUT EN BOUT » (GO « AT-6 — GO IMPLÉMENTATION v0.65.6 », 17/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Logique DÉRIVÉE du parcours MANUEL : aucune seconde machine d'état.
// La seule vérité des étapes reste le journal AT-1 (chantier.js) ; ce module lit son état rejoué et les PIÈCES de chaque tentative
// (instantané de mission lancé, texte du rapport, demande de vérification copiée, textes des faits AT-5) et en déduit :
//   cleTentative(jalon, numero)                          -> « <jalon>/<n> », clé des pièces
//   tentativesDuJournal(journal)                         -> [{ n, jalon, numero, rendue, decision }] dans l'ordre du journal
//   etapeDe({ etat, pieces, verdict })                   -> { etape, jalon, numero, gestes, consigne } (gelé)
//   proposerVersion(version)                             -> patch suivant « X.Y.(Z+1) » : une PROPOSITION, jamais une vérité
//   demandeDe({ mission, rapport, versionCandidat })     -> les cinq entrées du run AT-5, tirées des pièces réelles (gelé)
//   texteDemande(demande)                                -> le texte copié pour Claude, avec la portée exacte de l'autorisation
//   raisonPieces({ etat, journal, pieces, piecesDepuis, lireRetour }) -> raison d'incohérence, ou null (lireRetour : v0.65.16)
// « verdict » est TOUJOURS recalculé par l'appelant avec la confrontation AT-5 (confronter) ; il n'est ni lu ni écrit ici comme une donnée.
// Une étape sans base définie (jalon suivant après un candidat accepté qui n'est pas sur main) S'ABSTIENT : aucune tentative n'est
// proposée, aucune base n'est inventée. Le modèle AT-1 et les plans ne sont pas limités à un jalon.
// Les pièces lues sont : { mission, rapport: { texte, lu } | null, demande | null, faits: [{ texte, lu }] } où « lu » est le résultat
// déjà vérifié par l'appelant (verifierRapport, lireFaits). PURETÉ : aucun import, aucune horloge, aucun hasard, aucune entrée/sortie.
// v0.65.9 — AT-8.1 « AUTO À BLANC » : une tentative lancée avec « mode: 'AUTO' » dans son événement AT-1 suit le chemin AUTO
// (étape « auto-lancee » si etapeDe reçoit le journal) ; elle n'est jamais rendue, n'a ni rapport, ni demande AT-5, ni faits AT-5, et
// ne se termine que par une annulation (v0.65.16 : sauf l'appel de développement rendu, ci-dessous). Sans « mode » (tout le MANUEL),
// rien ne change : mêmes tentatives, mêmes étapes, mêmes gestes.
// v0.65.16 — AT-10.5 « DÉCISION HUMAINE SUR UN CANDIDAT AUTO » (GO « AT-10.5 — GO RÉALISATION LOCALE », 20/10/2026 ; D-007).
// Une tentative AUTO d'appel de développement peut être RENDUE : l'événement « tentative-rendue » porte { mode: 'AUTO', faits_auto,
// faits_auto_empreinte, faits_candidat, faits_candidat_empreinte } (textes exacts des faits J2 et J4) ; la pièce n'a pas de rapport,
// sa demande AT-5 est celle de J4. Elle suit ensuite le parcours MANUEL (demande, faits AT-5, verdict recalculé, décision humaine).
// raisonPieces reçoit de son appelant le lecteur « lireRetour » (lireRetourAuto d'auto.js, pur), qui relit J2 et J4 à chaque contrôle ;
// sans lecteur, une AUTO rendue est refusée. Ce module reste SANS IMPORT. Le MANUEL et l'AUTO non rendue sont inchangés ; la tentative
// AUTO lancée reçoit le geste « enregistrer-auto » ; tentativesDuJournal rend aussi les données de « tentative-rendue ».

const CONFORME = 'verification-technique-conforme';
const NON_CONFORME = 'verification-technique-non-conforme';
const IMPOSSIBLE = 'verification-impossible';
const CLES_DEMANDE = Object.freeze(['branche', 'candidat', 'base', 'version_base', 'version_candidat']);
const RE_VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}

export const cleTentative = (jalon, numero) => `${jalon}/${numero}`;

// Tentatives telles que le journal AT-1 les écrit : numéro = rang de « tentative-lancee » pour ce jalon (comme chantier.js).
export function tentativesDuJournal(journal) {
  const liste = [];
  const parJalon = new Map();
  for (const ev of journal || []) {
    const d = ev.donnees || {};
    if (ev.type === 'tentative-lancee') {
      const numero = (parJalon.get(d.jalon) || 0) + 1;
      parJalon.set(d.jalon, numero);
      liste.push({ n: ev.n, jalon: d.jalon, numero, rendue: null, decision: null, ...(d.mode === 'AUTO' ? { mode: 'AUTO' } : {}) });
    } else if (ev.type.startsWith('tentative-')) {
      const t = liste.find((x) => x.jalon === d.jalon && x.numero === d.numero);
      if (!t) continue;
      if (ev.type === 'tentative-rendue') t.rendue = { n: ev.n, reference: d.reference, donnees: geler(JSON.parse(JSON.stringify(d))) };
      else t.decision = { n: ev.n, type: ev.type, donnees: d };
    }
  }
  return liste;
}

const vivante = (j) => j.tentatives.find((t) => t.statut === 'lancee' || t.statut === 'rendue') || null;

const CONSIGNES = Object.freeze({
  'chantier-a-ouvrir': 'Remplis le chantier, puis ouvre-le.',
  'plan-a-approuver': 'Relis le plan, puis approuve-le.',
  'mission-a-lancer': 'Remplis la fiche du jalon, génère le dossier, puis « Copier et lancer la tentative ».',
  'base-indefinie': 'Un jalon précédent a un candidat accepté qui n\'est pas sur main : la base de ce jalon n\'est pas définie. Aucune tentative n\'est proposée (question ouverte) ; seul l\'arrêt est possible.',
  'tentative-sans-pieces': 'Tentative lancée avant AT-6 : ses pièces n\'existent pas et ne sont pas inventées. Seuls l\'annulation ou l\'arrêt sont possibles.',
  'rapport-attendu': 'Colle le dossier à Claude, puis colle ici son rapport et enregistre le candidat reçu.',
  'demande-a-copier': 'Copie la demande de vérification et colle-la à Claude.',
  'faits-attendus': 'Ouvre le run, copie les faits, colle-les ici, puis confronte.',
  'decision-attendue': 'Lis le verdict technique, puis décide : il n\'y a aucune acceptation automatique.',
  'verification-a-refaire': 'Vérification impossible : relance la vérification puis colle les nouveaux faits, ou annule la tentative.',
  'chantier-bloque': 'Chantier bloqué : tentatives épuisées. Seul l\'arrêt est possible.',
  'chantier-termine': 'Chantier terminé. Ce n\'est ni un dépôt sur main, ni une acquisition.',
  'chantier-arrete': 'Chantier arrêté.',
  'auto-lancee': 'Tentative AUTO à blanc lancée : sauvegarde-la, copie la demande AUTO pour Claude, puis colle ici les faits du run pour la clore. Aucun appel n\'existe.',
});

function etape(nom, jalon, numero, gestes) {
  return geler({ etape: nom, jalon, numero, gestes: [...gestes], consigne: CONSIGNES[nom] });
}

export function etapeDe({ etat, pieces = {}, verdict = null, journal = null } = {}) {
  if (!etat) return etape('chantier-a-ouvrir', null, null, ['ouvrir']);
  if (etat.statut === 'ouvert') return etape('plan-a-approuver', null, null, ['approuver', 'arreter']);
  if (etat.statut === 'arrete') return etape('chantier-arrete', null, null, []);
  if (etat.statut === 'termine') return etape('chantier-termine', null, null, []);
  if (etat.statut === 'bloque') return etape('chantier-bloque', null, null, ['arreter']);
  const j = etat.plan[etat.jalonCourant];
  const t = vivante(j);
  if (!t) {
    // Abstention : la base AT-1 est celle du chantier ; après un candidat accepté non déposé, la base d'un jalon suivant n'est pas définie.
    if (etat.jalonCourant > 0) return etape('base-indefinie', j.id, null, ['arreter']);
    return etape('mission-a-lancer', j.id, j.tentatives.length + 1, ['generer', 'lancer', 'arreter']);
  }
  const p = Object.hasOwn(pieces, cleTentative(j.id, t.numero)) ? pieces[cleTentative(j.id, t.numero)] : null;
  if (!p) return etape('tentative-sans-pieces', j.id, t.numero, ['annuler', 'arreter']);
  // v0.65.16 : AUTO lancée seulement ; une AUTO rendue suit le parcours MANUEL ci-dessous (mêmes gestes, verdict recalculé).
  if (journal && t.statut === 'lancee' && tentativesDuJournal(journal).some((x) => x.jalon === j.id && x.numero === t.numero && x.mode === 'AUTO')) return etape('auto-lancee', j.id, t.numero, ['copier-demande-auto', 'clore-auto', 'enregistrer-auto', 'annuler', 'arreter']);
  if (t.statut === 'lancee') return etape('rapport-attendu', j.id, t.numero, ['recopier-dossier', 'enregistrer', 'annuler', 'arreter']);
  if (p.demande === null) return etape('demande-a-copier', j.id, t.numero, ['copier-demande', 'annuler', 'arreter']);
  if (p.faits.length === 0) return etape('faits-attendus', j.id, t.numero, ['copier-demande', 'confronter', 'annuler', 'arreter']);
  if (verdict === CONFORME) return etape('decision-attendue', j.id, t.numero, ['copier-demande', 'confronter', 'accepter', 'refuser', 'arreter']);
  if (verdict === NON_CONFORME) return etape('decision-attendue', j.id, t.numero, ['copier-demande', 'confronter', 'refuser', 'arreter']);
  if (verdict === IMPOSSIBLE) return etape('verification-a-refaire', j.id, t.numero, ['copier-demande', 'confronter', 'annuler', 'arreter']);
  throw new TypeError(`etapeDe : verdict recalculé attendu (${CONFORME}, ${NON_CONFORME} ou ${IMPOSSIBLE}), reçu ${JSON.stringify(verdict)}.`);
}

export function proposerVersion(version) {
  const m = typeof version === 'string' ? RE_VERSION.exec(version) : null;
  if (!m) throw new TypeError('proposerVersion : X.Y.Z attendu.');
  return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

// Les cinq entrées viennent des pièces : branche et SHA du rapport enregistré, base de l'instantané lancé ; seule version_candidat
// est fournie (proposée puis éventuellement modifiée par Christophe). Rien n'est déduit de Git, rien n'est inventé.
export function demandeDe({ mission, rapport, versionCandidat } = {}) {
  if (!estObjet(mission) || !estObjet(mission.base)) throw new TypeError('demandeDe : instantané de mission attendu.');
  if (!estObjet(rapport) || rapport.statut !== 'candidat' || !estObjet(rapport.candidat)) throw new TypeError('demandeDe : rapport « candidat » enregistré attendu.');
  if (typeof versionCandidat !== 'string' || !RE_VERSION.test(versionCandidat)) throw new TypeError('demandeDe : version_candidat X.Y.Z attendue.');
  return geler({ branche: rapport.candidat.branche, candidat: rapport.candidat.sha, base: mission.base.sha, version_base: mission.base.version, version_candidat: versionCandidat });
}

export function texteDemande(d) {
  return [
    'DEMANDE DE VÉRIFICATION AT-5 — ATELIER (OUTILLAGE NON COGNITIF)',
    'Ce collage autorise UNIQUEMENT le run « Atelier — vérification technique » lancé depuis main avec exactement ces cinq valeurs.',
    'Il n\'autorise aucun autre run, aucune branche, aucun push, rien sur main, aucun tag, aucun dépôt.',
    '',
    ...CLES_DEMANDE.map((k) => `${k} = ${d[k]}`),
    '',
    'version_candidat est une valeur d\'essai pour l\'injection : sa validité est établie par AT-5 ; ce n\'est pas la version du candidat.',
    '',
  ].join('\n');
}

// v0.65.16 : retour AUTO d'une tentative rendue (relu par lireRetourAuto), ou la raison du refus.
const CHAMPS_RENDUE_AUTO = Object.freeze(['faits_auto', 'faits_auto_empreinte', 'faits_candidat', 'faits_candidat_empreinte']);
function retourAutoRendu(cle, t, etat, m, lireRetour) {
  const d = t.rendue.donnees;
  if (typeof lireRetour !== 'function') return { raison: `pièce « ${cle} » : tentative AUTO rendue illisible sans le lecteur du retour AUTO` };
  if (d.mode !== 'AUTO' || !CHAMPS_RENDUE_AUTO.every((k) => typeof d[k] === 'string')) return { raison: `pièce « ${cle} » : tentative AUTO rendue sans mode AUTO ni faits J2 et J4` };
  if (!d.faits_auto.endsWith('\n') || !d.faits_candidat.endsWith('\n')) return { raison: `pièce « ${cle} » : tentative AUTO rendue : faits J2 ou J4 hors de leur texte exact` };
  const r = lireRetour({ j2Texte: d.faits_auto, j4Texte: d.faits_candidat, t: `${etat.id}/${t.jalon}/${t.numero}`, mission: m });
  if (r.raison) return { raison: `pièce « ${cle} » : tentative AUTO rendue : retour refusé (${r.raison})` };
  if (r.retour.j2.empreinte !== d.faits_auto_empreinte || r.retour.j4.empreinte !== d.faits_candidat_empreinte) return { raison: `pièce « ${cle} » : tentative AUTO rendue : empreinte citée différente des faits J2 ou J4` };
  if (t.rendue.reference !== r.retour.reference) return { raison: `pièce « ${cle} » : référence rendue différente du candidat J4` };
  return r;
}

const memeDemande = (a, b) => estObjet(a) && estObjet(b) && CLES_DEMANDE.every((k) => a[k] === b[k]) && Object.keys(a).length === CLES_DEMANDE.length;

// Cohérence pièces ↔ journal. Toute pièce correspond à une tentative lancée à partir de « piecesDepuis » (numéro d'événement du
// journal où AT-6 a commencé à écrire des pièces : 1 pour un chantier né en AT-6) ; toute tentative lancée depuis a sa pièce.
export function raisonPieces({ etat, journal, pieces, piecesDepuis, lireRetour = null }) {
  if (!estObjet(pieces)) return 'pièces illisibles';
  if (!Number.isInteger(piecesDepuis) || piecesDepuis < 1) return 'début des pièces illisible';
  const tentatives = tentativesDuJournal(journal);
  for (const ev of journal || []) if (ev.type === 'tentative-lancee' && ev.donnees && Object.hasOwn(ev.donnees, 'mode') && ev.donnees.mode !== 'AUTO') return `événement ${ev.n} : mode de lancement inconnu`;
  const attendues = new Map(tentatives.filter((t) => t.n >= piecesDepuis).map((t) => [cleTentative(t.jalon, t.numero), t]));
  for (const cle of Object.keys(pieces)) if (!attendues.has(cle)) return `pièce « ${cle} » sans tentative lancée correspondante`;
  for (const [cle, t] of attendues) {
    if (!Object.hasOwn(pieces, cle)) return `tentative « ${cle} » sans sa pièce`;
    const p = pieces[cle];
    if (!estObjet(p) || !estObjet(p.mission) || !Array.isArray(p.faits)) return `pièce « ${cle} » illisible`;
    const m = p.mission;
    if (!etat || m.chantier !== etat.id || m.jalon?.id !== t.jalon || m.tentative !== t.numero || m.base?.sha !== etat.base.sha || m.base?.version !== etat.base.version) return `pièce « ${cle} » : instantané étranger à sa tentative`;
    if (t.mode !== 'AUTO' && t.rendue !== null && Object.hasOwn(t.rendue.donnees, 'mode')) return `pièce « ${cle} » : tentative MANUEL rendue avec un mode (mode incohérent)`;
    const autoRendue = t.mode === 'AUTO' && t.rendue !== null;
    if (t.mode === 'AUTO' && !autoRendue && (p.rapport !== null || p.demande !== null || p.faits.length > 0)) return `pièce « ${cle} » : tentative AUTO rendue, ou avec rapport, demande ou faits MANUEL`;
    let retour = null;
    if (autoRendue) {
      const r = retourAutoRendu(cle, t, etat, m, lireRetour);
      if (r.raison) return r.raison;
      retour = r.retour;
      if (p.rapport !== null) return `pièce « ${cle} » : tentative AUTO rendue avec un rapport MANUEL`;
      if (!memeDemande(p.demande, retour.demande)) return `pièce « ${cle} » : tentative AUTO rendue : demande différente de celle des faits J4`;
    }
    if (!autoRendue && (p.rapport === null) !== (t.rendue === null)) return `pièce « ${cle} » : rapport ${p.rapport === null ? 'absent pour une tentative rendue' : 'présent pour une tentative non rendue'}`;
    if (p.rapport !== null) {
      const r = p.rapport.lu;
      if (!r || r.structure !== 'conforme' || r.statutAnnonce !== 'candidat') return `pièce « ${cle} » : rapport enregistré non conforme`;
      if (t.rendue.reference !== `${r.rapport.candidat.branche}@${r.rapport.candidat.sha}`) return `pièce « ${cle} » : référence rendue différente du rapport`;
    }
    if (p.demande !== null && !autoRendue) {
      let attendue = null;
      try { attendue = p.rapport === null ? null : demandeDe({ mission: m, rapport: p.rapport.lu.rapport, versionCandidat: p.demande?.version_candidat }); } catch { attendue = null; }
      if (!memeDemande(p.demande, attendue)) return `pièce « ${cle} » : demande étrangère aux pièces`;
    }
    if (p.faits.length > 0 && p.demande === null) return `pièce « ${cle} » : faits sans demande copiée`;
    for (const f of p.faits) {
      if (!f || !f.lu || !f.lu.faits) return `pièce « ${cle} » : faits illisibles`;
      if (!memeDemande(f.lu.faits.demande, p.demande)) return `pièce « ${cle} » : faits d'une autre demande`;
    }
    const d = t.decision;
    if (d && (d.type === 'tentative-acceptee' || d.type === 'tentative-rejetee')) {
      if ((p.rapport === null && !autoRendue) || p.faits.length === 0) return `pièce « ${cle} » : décision sans faits`;
      if (!p.faits.some((f) => f.lu.faits.empreinte === d.donnees.faits)) return `pièce « ${cle} » : empreinte citée par la décision absente des faits`;
      if (d.donnees.candidat !== (autoRendue ? retour.j4.candidat.sha : p.rapport.lu.rapport.candidat.sha)) return `pièce « ${cle} » : candidat cité par la décision différent du rapport`;
      if (d.type === 'tentative-acceptee' && d.donnees.verdict !== CONFORME) return `pièce « ${cle} » : acceptation citant un verdict non conforme`;
      if (d.type === 'tentative-rejetee' && d.donnees.verdict !== CONFORME && d.donnees.verdict !== NON_CONFORME) return `pièce « ${cle} » : refus sans verdict exploitable`;
    }
  }
  return null;
}
// === FIN_ATELIER_PARCOURS ===
