// === DEBUT_ATELIER_JOURNAL ===
// v0.65.7 — AT-7 « JOURNAL GIT + REPRISE » (GO « AT-7 v0.65.7 — GO IMPLÉMENTATION », 17/10/2026 ; D-007, précision D4).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Module PUR de l'état DURABLE d'un chantier (atelier-journal-1) et de son
// transport multiparties k/N (étude D2 : message du téléphone coupé en silence à 20 000 caractères, message de Claude <= 32 768 octets).
//   canonique(valeur)                 -> texte canonique : clés triées, indentation 1, ASCII seul (\uXXXX), saut de ligne final
//   etatDurableDe(copie)              -> { protocole, chantier, journal, registre, piecesDepuis, pieces } (histoire réellement franchie)
//   ecrireEtatDurable(copie)          -> { texte, empreinte, octets } ; l'état est relu par lireEtatDurable avant d'être rendu
//   lireEtatDurable(texte)            -> { durable, etat, lues, verdicts, etape, empreinte, octets } ou { raison }
//   lirePieces(pieces, piecesDepuis)  -> pièces relues par les vérificateurs (AT-3, AT-5), ou la raison de l'illisibilité
//   comparerEtats(ancien, nouveau)    -> { statut: 'identique' | 'extension' } ou { raison } (régression, réécriture, divergence)
//   decouper(texte, chantier)         -> [textes des parties] ; lirePartie(texte) -> { partie } ou { raison }
//   assemblerParties(textes)          -> { statut: 'vide' | 'incomplet' | 'complet' | 'refuse', ... } (ordre de collage libre)
//   preparerRestauration(textes)      -> assemblage puis lireEtatDurable : { statut: 'pret', lu, ... } ou l'état de l'assemblage
//   texteConfirmation / lireConfirmation, brancheJournal(chantier) -> « journal-atelier/<chantier> »
// Une PARTIE : « ATELIER-PARTIE-1 chantier=<id> partie=<k>/<N> total_octets=<T> empreinte=<sha256 complet> tranche=<sha256 tranche> »,
// un saut de ligne, la tranche exacte, un saut de ligne, « ATELIER-FIN-PARTIE <k>/<N> » ; <= 15 000 caractères ET <= 32 768 octets.
// Assemblage toujours par k croissant ; aucune réparation, aucune normalisation des tranches, aucun caractère inventé.
// Ni verdict, ni étape, ni mode, ni formulaire, ni fiche, ni dossier généré non lancé ne sont durables : tout est RECALCULÉ à la lecture.
// Git est un lieu durable, jamais une autorité : un état invalide reste invalide, même s'il vient réellement de la branche journal.
// PURETÉ : imports de l'atelier seulement ; aucune horloge, aucun hasard, aucun état, aucune entrée/sortie, aucun réseau.

import { verifierJournal, etatDe } from './chantier.js';
import { verifierRegistre } from './budget.js';
import { construireMission, verifierRapport } from './mission.js';
import { lireFaits, lireDemande, confronter } from './verification.js';
import { raisonPieces, etapeDe, tentativesDuJournal, cleTentative } from './parcours.js';
import { hacherSha256 } from './empreinte.js';

export const PROTOCOLE_JOURNAL = 'atelier-journal-1';
export const LIMITE_CARACTERES = 15000;
export const LIMITE_OCTETS = 32768;
// Marge réservée à l'en-tête (252 caractères au plus) et à la ligne de fin (26 au plus) : la tranche reste sous les deux limites.
const MARGE = 400;
const MAX_PARTIES = 999;
const CLES_ETAT = 'chantier,journal,pieces,piecesDepuis,protocole,registre';
const CLES_PIECE = 'demande,faits,mission,rapport';
const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_ENTETE = /^ATELIER-PARTIE-1 chantier=([a-z0-9]+(?:-[a-z0-9]+)*) partie=([1-9][0-9]{0,2})\/([1-9][0-9]{0,2}) total_octets=([1-9][0-9]{0,8}) empreinte=([0-9a-f]{64}) tranche=([0-9a-f]{64})$/;
const RE_FIN = /^ATELIER-FIN-PARTIE ([1-9][0-9]{0,2})\/([1-9][0-9]{0,2})$/;
const RE_CONFIRMATION = /^ATELIER-SAUVEGARDE-1 chantier=([a-z0-9]+(?:-[a-z0-9]+)*) empreinte=([0-9a-f]{64}) commit=([0-9a-f]{40})$/;

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const idValide = (id) => typeof id === 'string' && id.length <= 40 && RE_ID.test(id);

function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}

// Octets UTF-8 d'une chaîne (une paire de substituts = 4 octets).
export function octetsUtf8(s) {
  let n = 0;
  for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}

// ------------------------------------------------------------------------------------------------ forme canonique
function trier(v) {
  if (Array.isArray(v)) return v.map(trier);
  if (v !== null && typeof v === 'object') {
    const o = Object.create(null);
    for (const k of Object.keys(v).sort()) o[k] = trier(v[k]);
    return o;
  }
  return v;
}
// Tout caractère hors ASCII n'apparaît que dans une chaîne JSON : l'échapper en \uXXXX garde le même JSON et rend un texte ASCII,
// insensible aux transformations du transport (espaces insécables, normalisation Unicode, séparateurs de ligne).
export function canonique(valeur) {
  const t = JSON.stringify(trier(valeur), null, 1);
  if (typeof t !== 'string') throw new TypeError('canonique : valeur JSON attendue.');
  return `${t.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)}\n`;
}

// ------------------------------------------------------------------------------------------------ état durable
// Histoire réellement franchie : journal AT-1 (identité, objectif, base, plan approuvé y sont écrits), registre AT-2, pièces des
// tentatives lancées. Rien d'autre de la copie locale n'est durable.
export function etatDurableDe({ journal, registre, pieces, piecesDepuis } = {}) {
  if (!Array.isArray(journal) || journal.length === 0) throw new TypeError('etatDurableDe : chantier ouvert attendu.');
  return { protocole: PROTOCOLE_JOURNAL, chantier: estObjet(journal[0]) && estObjet(journal[0].donnees) ? journal[0].donnees.id : null, journal, registre: registre ?? null, piecesDepuis, pieces };
}

export function ecrireEtatDurable(copie) {
  const texte = canonique(etatDurableDe(copie));
  const lu = lireEtatDurable(texte);
  if (lu.raison) throw new TypeError(`ecrireEtatDurable : état durable invalide : ${lu.raison}.`);
  return { texte, empreinte: lu.empreinte, octets: lu.octets };
}

// Pièces relues par les vérificateurs (rapport : verifierRapport contre l'instantané ; faits : lireFaits, empreinte comprise ; demande :
// lireDemande). Rend les pièces lues, ou la raison de l'illisibilité. Rien n'est réparé.
export function lirePieces(pieces, piecesDepuis) {
  if (!estObjet(pieces) || !Number.isInteger(piecesDepuis)) return 'pièces illisibles';
  const lues = {};
  for (const [cle, p] of Object.entries(pieces)) {
    if (!estObjet(p) || Object.keys(p).sort().join(',') !== CLES_PIECE) return `pièce « ${cle} » illisible`;
    try { construireMission(p.mission); } catch (e) { return `pièce « ${cle} » : instantané illisible : ${e.message}`; }
    if (p.rapport !== null && typeof p.rapport !== 'string') return `pièce « ${cle} » : rapport illisible`;
    if (p.demande !== null && !estObjet(p.demande)) return `pièce « ${cle} » : demande illisible`;
    if (p.demande !== null && lireDemande(p.demande).raison) return `pièce « ${cle} » : demande illisible : ${lireDemande(p.demande).raison}`;
    if (!Array.isArray(p.faits) || !p.faits.every((t) => typeof t === 'string')) return `pièce « ${cle} » : faits illisibles`;
    const faits = [];
    for (const t of p.faits) {
      const lf = lireFaits(t, hacherSha256);
      if (lf.raison) return `pièce « ${cle} » : faits illisibles : ${lf.raison}`;
      faits.push({ texte: t, lu: lf });
    }
    lues[cle] = { mission: p.mission, rapport: p.rapport === null ? null : { texte: p.rapport, lu: verifierRapport(p.mission, p.rapport) }, demande: p.demande, faits };
  }
  return lues;
}

const verdictDe = (p, f) => confronter({ mission: p.mission, rapport: p.rapport.texte, faits: f.texte, hacherSha256 }).verdict_technique;

// Lecture COMPLÈTE d'un état durable : forme canonique, protocole, journal AT-1 et registre AT-2 relus par leurs validateurs, pièces
// relues et confrontées au journal, empreintes des faits, verdicts recalculés (y compris ceux que citent les décisions), étape dérivée.
export function lireEtatDurable(texte) {
  const refus = (raison) => ({ raison });
  if (typeof texte !== 'string' || texte === '') return refus('texte de l\'état durable absent');
  if (!/^[\x20-\x7e\n]*$/.test(texte)) return refus('caractère hors ASCII imprimable : forme non canonique');
  let v;
  try { v = JSON.parse(texte); } catch { return refus('JSON illisible'); }
  if (canonique(v) !== texte) return refus('forme non canonique (clés triées, indentation 1, ASCII, saut de ligne final)');
  if (!estObjet(v) || Object.keys(v).sort().join(',') !== CLES_ETAT) return refus('clés de l\'état durable inattendues');
  if (v.protocole !== PROTOCOLE_JOURNAL) return refus(`protocole inconnu : ${JSON.stringify(v.protocole)}`);
  if (!idValide(v.chantier)) return refus('identifiant du chantier invalide');
  const vj = verifierJournal(v.journal);
  if (!vj.ok) return refus(`journal AT-1 incohérent (événement ${vj.n}) : ${vj.raison}`);
  const etat = etatDe(v.journal);
  if (etat.id !== v.chantier) return refus('identifiant du chantier différent de celui du journal AT-1');
  if (v.registre !== null) {
    const vr = verifierRegistre(v.registre);
    if (!vr.ok) return refus(`registre AT-2 incohérent (événement ${vr.n}) : ${vr.raison}`);
  }
  if (!Number.isInteger(v.piecesDepuis) || v.piecesDepuis < 1 || v.piecesDepuis > v.journal.length + 1) return refus('début des pièces invalide');
  const lues = lirePieces(v.pieces, v.piecesDepuis);
  if (typeof lues === 'string') return refus(lues);
  const rp = raisonPieces({ etat, journal: v.journal, pieces: lues, piecesDepuis: v.piecesDepuis });
  if (rp) return refus(`pièces incohérentes : ${rp}`);
  // Un instantané lancé reprend l'objectif du chantier et le titre de son jalon tels qu'AT-1 les écrit (l'écran les compose ainsi).
  for (const [cle, p] of Object.entries(lues)) {
    const j = etat.plan.find((x) => x.id === p.mission.jalon.id);
    if (p.mission.objectif !== etat.objectif || !j || p.mission.jalon.titre !== j.titre) return refus(`pièce « ${cle} » : instantané différent de l'objectif ou du jalon écrits dans AT-1`);
  }
  const verdicts = {};
  try {
    for (const [cle, p] of Object.entries(lues)) if (p.rapport !== null && p.faits.length > 0) verdicts[cle] = verdictDe(p, p.faits[p.faits.length - 1]);
    // Une décision cite le verdict observé au moment du geste : le recalcul sur les faits cités doit le retrouver.
    for (const t of tentativesDuJournal(v.journal)) {
      const d = t.decision;
      if (!d || (d.type !== 'tentative-acceptee' && d.type !== 'tentative-rejetee') || t.n < v.piecesDepuis) continue;
      const cle = cleTentative(t.jalon, t.numero);
      const p = lues[cle];
      const f = p.faits.filter((x) => x.lu.faits.empreinte === d.donnees.faits).pop();
      if (verdictDe(p, f) !== d.donnees.verdict) return refus(`pièce « ${cle} » : verdict recalculé différent de celui cité par la décision`);
      if (f.lu.faits.provenance.run_id !== d.donnees.run_id) return refus(`pièce « ${cle} » : run cité par la décision différent des faits`);
    }
  } catch (e) { return refus(`verdict non recalculable : ${e.message}`); }
  let etape;
  try {
    const j = etat.statut === 'en-cours' ? etat.plan[etat.jalonCourant] : null;
    const t = j && j.tentatives.find((x) => x.statut === 'lancee' || x.statut === 'rendue');
    const cle = t ? cleTentative(j.id, t.numero) : null;
    etape = etapeDe({ etat, pieces: lues, verdict: cle && Object.hasOwn(verdicts, cle) ? verdicts[cle] : null });
  } catch (e) { return refus(`état incohérent : ${e.message}`); }
  return { durable: geler(v), etat, lues, verdicts: geler(verdicts), etape, empreinte: hacherSha256(texte), octets: texte.length };
}

// Extension autorisée : même chantier ; journal AT-1 et registre AT-2 PROLONGÉS (préfixe exact) ; mêmes pièces, chacune complétée
// seulement (rapport, demande : de rien vers une valeur ; faits : ajout en fin) ; nouvelles pièces permises. Tout le reste : refus.
export function comparerEtats(ancien, nouveau) {
  const egal = (x, y) => canonique(x) === canonique(y);
  const prefixe = (a, b) => Array.isArray(b) && b.length >= a.length && a.every((x, i) => egal(x, b[i]));
  if (ancien.chantier !== nouveau.chantier) return { raison: 'chantier différent' };
  if (egal(ancien, nouveau)) return { statut: 'identique' };
  if (!prefixe(ancien.journal, nouveau.journal)) return { raison: 'journal AT-1 non prolongé : événement supprimé, modifié ou réordonné' };
  if (ancien.registre !== null && !prefixe(ancien.registre, nouveau.registre)) return { raison: 'registre AT-2 non prolongé : événement supprimé, modifié ou réordonné' };
  if (ancien.piecesDepuis !== nouveau.piecesDepuis) return { raison: 'début des pièces modifié' };
  for (const [cle, p] of Object.entries(ancien.pieces)) {
    if (!Object.hasOwn(nouveau.pieces, cle)) return { raison: `pièce « ${cle} » supprimée` };
    const q = nouveau.pieces[cle];
    if (!egal(p.mission, q.mission)) return { raison: `pièce « ${cle} » : mission modifiée` };
    if (p.rapport !== null && p.rapport !== q.rapport) return { raison: `pièce « ${cle} » : rapport modifié ou supprimé` };
    if (p.demande !== null && !egal(p.demande, q.demande)) return { raison: `pièce « ${cle} » : demande modifiée ou supprimée` };
    if (!(q.faits.length >= p.faits.length && p.faits.every((f, i) => f === q.faits[i]))) return { raison: `pièce « ${cle} » : faits raccourcis ou modifiés (ajout en fin seulement)` };
  }
  return { statut: 'extension' };
}

// ------------------------------------------------------------------------------------------------ transport k/N
const entete = ({ chantier, k, N, total, empreinte, tranche }) => `ATELIER-PARTIE-1 chantier=${chantier} partie=${k}/${N} total_octets=${total} empreinte=${empreinte} tranche=${tranche}`;
const fin = (k, N) => `ATELIER-FIN-PARTIE ${k}/${N}`;

// Découpage déterministe : tranches consécutives, sans recouvrement, sur des frontières de caractère (jamais au milieu d'une paire de
// substituts), chacune au plus LIMITE - MARGE caractères (unités UTF-16) et octets.
export function decouper(texte, chantier) {
  if (typeof texte !== 'string' || texte === '') throw new TypeError('decouper : texte non vide attendu.');
  if (!idValide(chantier)) throw new TypeError('decouper : identifiant de chantier invalide.');
  const tranches = [];
  let courant = '';
  let o = 0;
  for (const ch of texte) {
    const n = octetsUtf8(ch);
    if (courant.length + ch.length > LIMITE_CARACTERES - MARGE || o + n > LIMITE_OCTETS - MARGE) { tranches.push(courant); courant = ''; o = 0; }
    courant += ch;
    o += n;
  }
  tranches.push(courant);
  const N = tranches.length;
  if (N > MAX_PARTIES) throw new TypeError(`decouper : ${N} parties (au plus ${MAX_PARTIES}).`);
  const total = octetsUtf8(texte);
  const empreinte = hacherSha256(texte);
  return tranches.map((t, i) => {
    const p = `${entete({ chantier, k: i + 1, N, total, empreinte, tranche: hacherSha256(t) })}\n${t}\n${fin(i + 1, N)}`;
    if (p.length > LIMITE_CARACTERES || octetsUtf8(p) > LIMITE_OCTETS) throw new TypeError('decouper : partie hors limites.');
    return p;
  });
}

// Une partie collée. Seule tolérance d'enveloppe : UN saut de ligne final après la ligne de fin. La tranche n'est jamais touchée.
export function lirePartie(texte) {
  const refus = (raison) => ({ raison });
  if (typeof texte !== 'string' || texte === '') return refus('partie vide');
  if (texte.length > LIMITE_CARACTERES || octetsUtf8(texte) > LIMITE_OCTETS) return refus(`partie trop longue (au plus ${LIMITE_CARACTERES} caractères et ${LIMITE_OCTETS} octets)`);
  const t = texte.endsWith('\n') ? texte.slice(0, -1) : texte;
  const i = t.indexOf('\n');
  const m = RE_ENTETE.exec(i < 0 ? t : t.slice(0, i));
  if (!m) return refus('début de partie absent ou invalide');
  const j = t.lastIndexOf('\n');
  const f = i < 0 || j === i ? null : RE_FIN.exec(t.slice(j + 1));
  if (!f) return refus('fin de partie absente (partie tronquée ?)');
  const k = Number(m[2]);
  const N = Number(m[3]);
  if (f[1] !== m[2] || f[2] !== m[3]) return refus(`numéro de la fin (${f[1]}/${f[2]}) différent du début (${k}/${N})`);
  if (k > N) return refus(`partie ${k}/${N} : numéro hors bornes`);
  const tranche = t.slice(i + 1, j);
  let sha;
  try { sha = hacherSha256(tranche); } catch { return refus(`partie ${k}/${N} : tranche illisible`); }
  if (tranche === '' || sha !== m[6]) return refus(`partie ${k}/${N} : SHA-256 de la tranche faux`);
  return { partie: geler({ chantier: m[1], k, N, total: Number(m[4]), empreinte: m[5], tranche }) };
}

// Assemblage d'un ensemble de parties collées dans n'importe quel ordre. Doublon identique : ignoré ; doublon différent : refus.
export function assemblerParties(textes) {
  const refus = (raison) => ({ statut: 'refuse', raison });
  const recues = new Map();
  let ref = null;
  for (const [i, texte] of (textes || []).entries()) {
    const l = lirePartie(texte);
    if (l.raison) return refus(`partie collée n° ${i + 1} : ${l.raison}`);
    const p = l.partie;
    if (!ref) ref = p;
    for (const [cle, nom] of [['chantier', 'chantier'], ['N', 'nombre de parties'], ['total', 'total_octets'], ['empreinte', 'empreinte complète']]) {
      if (p[cle] !== ref[cle]) return refus(`partie ${p.k}/${p.N} : ${nom} différent des parties déjà reçues (mélange de deux sauvegardes)`);
    }
    if (recues.has(p.k)) {
      if (recues.get(p.k).tranche !== p.tranche) return refus(`partie ${p.k}/${p.N} reçue deux fois avec des contenus différents`);
      continue;
    }
    recues.set(p.k, p);
  }
  if (!ref) return { statut: 'vide', recues: [], manquantes: [] };
  const base = { chantier: ref.chantier, N: ref.N, total: ref.total, empreinte: ref.empreinte, recues: [...recues.keys()].sort((a, b) => a - b) };
  const manquantes = [];
  for (let k = 1; k <= ref.N; k += 1) if (!recues.has(k)) manquantes.push(k);
  if (manquantes.length > 0) return { statut: 'incomplet', ...base, manquantes };
  let contenu = '';
  for (let k = 1; k <= ref.N; k += 1) contenu += recues.get(k).tranche;
  if (octetsUtf8(contenu) !== ref.total) return refus(`assemblage de ${octetsUtf8(contenu)} octets, ${ref.total} annoncés`);
  if (hacherSha256(contenu) !== ref.empreinte) return refus('SHA-256 complet faux après assemblage');
  return { statut: 'complet', ...base, manquantes, contenu };
}

// Restauration validable : assemblage complet, puis lecture complète de l'état durable, du même chantier que les parties.
export function preparerRestauration(textes) {
  const a = assemblerParties(textes);
  if (a.statut !== 'complet') return a;
  const lu = lireEtatDurable(a.contenu);
  if (lu.raison) return { statut: 'refuse', raison: `état durable invalide : ${lu.raison}` };
  if (lu.durable.chantier !== a.chantier) return { statut: 'refuse', raison: 'chantier des parties différent de celui de l\'état' };
  const { contenu, ...reste } = a;
  return { ...reste, statut: 'pret', texte: contenu, lu };
}

// ------------------------------------------------------------------------------------------------ branche et confirmation
export const brancheJournal = (chantier) => `journal-atelier/${chantier}`;

export function texteConfirmation({ chantier, empreinte, commit }) {
  const t = `ATELIER-SAUVEGARDE-1 chantier=${chantier} empreinte=${empreinte} commit=${commit}`;
  if (!RE_CONFIRMATION.test(t) || !idValide(chantier)) throw new TypeError('texteConfirmation : chantier, empreinte (64) et commit (40) attendus.');
  return t;
}

export function lireConfirmation(texte) {
  if (typeof texte !== 'string') return { raison: 'confirmation absente' };
  const m = RE_CONFIRMATION.exec(texte.endsWith('\n') ? texte.slice(0, -1) : texte);
  if (!m || !idValide(m[1])) return { raison: 'confirmation illisible (ATELIER-SAUVEGARDE-1 chantier=… empreinte=… commit=… attendu)' };
  return { chantier: m[1], empreinte: m[2], commit: m[3] };
}

// === FIN_ATELIER_JOURNAL ===
