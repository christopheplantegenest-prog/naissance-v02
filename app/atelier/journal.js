// === DEBUT_ATELIER_JOURNAL ===
// v0.65.7 — AT-7 « JOURNAL GIT + REPRISE » (GO « AT-7 v0.65.7 — GO IMPLÉMENTATION », 17/10/2026 ; D-007, précision D4).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Module PUR de l'état DURABLE d'un chantier (atelier-journal-1) et de son
// transport multiparties k/N (étude D2 : message du téléphone coupé en silence à 20 000 caractères, message de Claude <= 32 768 octets).
// v0.65.8 — correction après STOP recette phase G (17/10/2026) : transport atelier-partie-2, tranche en Base64 ASCII de ses octets
// canoniques exacts ; l'émission de Claude décodait les séquences d'échappement du texte canonique (50 séquences altérées, SHA faux).
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
// Une PARTIE (atelier-partie-2) : « ATELIER-PARTIE-2 chantier=<id> partie=<k>/<N> total_octets=<T> empreinte=<sha256 complet>
// encodage=base64 tranche=<sha256 des octets de la tranche> » sur une ligne, puis les octets UTF-8 exacts de la tranche en Base64
// (RFC 4648, remplissage « = », lignes de 76 caractères), puis « ATELIER-FIN-PARTIE <k>/<N> » ; ASCII seul, <= 15 000 caractères.
// Le journal canonique (et chantier.json) ne change pas : seule l'enveloppe de transport porte l'encodage. ATELIER-PARTIE-1 est refusé.
// Assemblage des octets par k croissant ; aucune réparation, aucune normalisation, une seule représentation acceptée par tranche.
// Ni verdict, ni étape, ni mode, ni formulaire, ni fiche, ni dossier généré non lancé ne sont durables : tout est RECALCULÉ à la lecture.
// Git est un lieu durable, jamais une autorité : un état invalide reste invalide, même s'il vient réellement de la branche journal.
// PURETÉ : imports de l'atelier seulement ; aucune horloge, aucun hasard, aucun état, aucune entrée/sortie, aucun réseau.
// v0.65.16 — AT-10.5 (GO 20/10/2026 ; D-007), formats inchangés : confrontationDe(piece, faits, rendue) = MANUEL : rapport enregistré ; AUTO
// rendue : rapport DÉRIVÉ (faits J4 + comptes AT-5), compte absent : impossible. Lecture durable : AUTO rendue = coût PAYÉ pour T = coût J2.
// v0.65.21 — AT-10.4 (GO 21/10/2026 ; D-007), formats inchangés : versOctets, depuisOctets, versBase64, depuisBase64 exportés (même code)
// pour le transport des faits par annotations et du bloc ATELIER-RETOUR-1 (retour.js).

import { verifierJournal, etatDe } from './chantier.js';
import { verifierRegistre, etatBudget } from './budget.js';
import { construireMission, verifierRapport } from './mission.js';
import { lireFaits, lireDemande, confronter } from './verification.js';
import { raisonPieces, etapeDe, tentativesDuJournal, cleTentative } from './parcours.js';
import { hacherSha256 } from './empreinte.js';
import { rapportCandidat, lireFaitsAuto, lireRetourAuto } from './auto.js';

export const PROTOCOLE_JOURNAL = 'atelier-journal-1';
export const LIMITE_CARACTERES = 15000;
export const LIMITE_OCTETS = 32768;
// Charge d'une partie : au plus OCTETS_TRANCHE octets canoniques, soit 14 400 caractères Base64 en 190 lignes de 76 ; avec l'en-tête
// (268 caractères au plus) et la ligne de fin (26 au plus), une partie fait au plus 14 885 caractères ASCII, sous LIMITE_CARACTERES.
const OCTETS_TRANCHE = 10800;
const LIGNE_BASE64 = 76;
const MAX_PARTIES = 999;
const CLES_ETAT = 'chantier,journal,pieces,piecesDepuis,protocole,registre';
const CLES_PIECE = 'demande,faits,mission,rapport';
const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_ENTETE = /^ATELIER-PARTIE-2 chantier=([a-z0-9]+(?:-[a-z0-9]+)*) partie=([1-9][0-9]{0,2})\/([1-9][0-9]{0,2}) total_octets=([1-9][0-9]{0,8}) empreinte=([0-9a-f]{64}) encodage=base64 tranche=([0-9a-f]{64})$/;
const RE_LIGNE = /^[A-Za-z0-9+/=]+$/;
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

const autoRendue = (rendue) => !!rendue && estObjet(rendue.donnees) && rendue.donnees.mode === 'AUTO';
export function confrontationDe(p, f, rendue = null) {
  if (!autoRendue(rendue)) return confronter({ mission: p.mission, rapport: p.rapport.texte, faits: f.texte, hacherSha256 });
  const t = f.lu.faits.tests;
  if ([t.total, t.reussis, t.echecs].some((x) => x === null)) {
    return geler({ protocole: 'atelier-confrontation-1', verdict_technique: 'verification-impossible', identite: 'non-etablie', diff: 'non-etabli', frontieres: 'non-etablies', tests: 'non-etablis', robot: 'non-etabli',
      rapport: 'non-confronte', divergences_rapport: [], a_examiner: [], raisons_non_conformite: [], raisons_impossibilite: [`tests « ${t.statut} » : comptes réels absents, aucun rapport n'est dérivé du candidat AUTO`] });
  }
  const rapport = rapportCandidat({ mission: p.mission, faitsCandidatTexte: rendue.donnees.faits_candidat, tests: { total: t.total, reussis: t.reussis, echecs: t.echecs }, faitsAt5Empreinte: f.lu.faits.empreinte });
  return confronter({ mission: p.mission, rapport, faits: f.texte, hacherSha256 });
}
const verdictDe = (p, f, rendue) => confrontationDe(p, f, rendue).verdict_technique;

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
  const rp = raisonPieces({ etat, journal: v.journal, pieces: lues, piecesDepuis: v.piecesDepuis, lireRetour: lireRetourAuto });
  if (rp) return refus(`pièces incohérentes : ${rp}`);
  // Un instantané lancé reprend l'objectif du chantier et le titre de son jalon tels qu'AT-1 les écrit (l'écran les compose ainsi).
  for (const [cle, p] of Object.entries(lues)) {
    const j = etat.plan.find((x) => x.id === p.mission.jalon.id);
    if (p.mission.objectif !== etat.objectif || !j || p.mission.jalon.titre !== j.titre) return refus(`pièce « ${cle} » : instantané différent de l'objectif ou du jalon écrits dans AT-1`);
  }
  const rendues = new Map(tentativesDuJournal(v.journal).filter((t) => t.n >= v.piecesDepuis && t.rendue !== null).map((t) => [cleTentative(t.jalon, t.numero), t]));
  for (const [cle, t] of [...rendues].filter(([, y]) => autoRendue(y.rendue))) { // v0.65.16 : coût PAYÉ pour T = coût de J2
    const x = v.registre === null ? null : etatBudget(v.registre).executions[`${etat.id}/${t.jalon}/${t.numero}`];
    if (!x || x.statut !== 'payee' || x.montant !== lireFaitsAuto(t.rendue.donnees.faits_auto).faits.cout.montant) return refus(`pièce « ${cle} » : coût AUTO absent ou différent`);
  }
  const verdicts = {};
  try {
    for (const [cle, p] of Object.entries(lues)) if ((p.rapport !== null || autoRendue(rendues.get(cle)?.rendue)) && p.faits.length > 0) verdicts[cle] = verdictDe(p, p.faits.at(-1), rendues.get(cle)?.rendue ?? null);
    // Une décision cite le verdict observé au moment du geste : le recalcul sur les faits cités doit le retrouver.
    for (const t of tentativesDuJournal(v.journal)) {
      const d = t.decision;
      if (!d || (d.type !== 'tentative-acceptee' && d.type !== 'tentative-rejetee') || t.n < v.piecesDepuis) continue;
      const cle = cleTentative(t.jalon, t.numero);
      const p = lues[cle];
      const f = p.faits.filter((x) => x.lu.faits.empreinte === d.donnees.faits).pop();
      if (verdictDe(p, f, t.rendue) !== d.donnees.verdict) return refus(`pièce « ${cle} » : verdict recalculé différent de celui cité par la décision`);
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

// ------------------------------------------------------------------------------------------------ transport k/N (atelier-partie-2)
// Octets UTF-8 exacts d'une chaîne bien formée (substitut isolé : TypeError, l'encodage le remplacerait en silence).
export function versOctets(texte) {
  const o = [];
  for (const ch of texte) {
    const c = ch.codePointAt(0);
    if (c >= 0xd800 && c <= 0xdfff) throw new TypeError('decouper : substitut UTF-16 isolé (encodage UTF-8 impossible sans perte).');
    if (c < 0x80) o.push(c);
    else if (c < 0x800) o.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) o.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else o.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return o;
}

// Décodage UTF-8 STRICT : forme la plus courte seulement, ni substitut, ni code au-delà de U+10FFFF, ni séquence coupée ; sinon null.
// Sur des octets acceptés, versOctets(depuisOctets(o)) rend exactement o : le texte rendu porte les mêmes octets, rien de réinterprété.
export function depuisOctets(o) {
  let s = '';
  for (let i = 0; i < o.length;) {
    const b = o[i];
    let n;
    let c;
    let min;
    if (b < 0x80) { n = 0; c = b; min = 0; } else if (b >= 0xc2 && b <= 0xdf) { n = 1; c = b & 0x1f; min = 0x80; } else if (b >= 0xe0 && b <= 0xef) { n = 2; c = b & 0x0f; min = 0x800; } else if (b >= 0xf0 && b <= 0xf4) { n = 3; c = b & 0x07; min = 0x10000; } else return null;
    for (let j = 1; j <= n; j += 1) {
      const x = o[i + j];
      if (x === undefined || (x & 0xc0) !== 0x80) return null;
      c = (c << 6) | (x & 63);
    }
    if (c < min || c > 0x10ffff || (c >= 0xd800 && c <= 0xdfff)) return null;
    s += String.fromCodePoint(c);
    i += n + 1;
  }
  return s;
}

// Base64 (RFC 4648 §4, alphabet standard, remplissage « = » obligatoire), en lignes de LIGNE_BASE64 caractères, la dernière plus courte.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function versBase64(o) {
  let s = '';
  for (let i = 0; i < o.length; i += 3) {
    const n = (o[i] << 16) | ((o[i + 1] ?? 0) << 8) | (o[i + 2] ?? 0);
    s += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + (i + 1 < o.length ? ALPHABET[(n >> 6) & 63] : '=') + (i + 2 < o.length ? ALPHABET[n & 63] : '=');
  }
  return s;
}
// Décodage STRICT : longueur multiple de 4, alphabet seul, « = » seulement en fin (au plus deux), puis bits de remplissage nuls
// (vérifiés par réencodage) : une suite d'octets n'a qu'UNE représentation acceptée. Rend { octets } ou { raison }.
export function depuisBase64(s) {
  if (s.length === 0 || s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) return { raison: 'longueur ou remplissage « = »' };
  const o = [];
  for (let i = 0; i < s.length; i += 4) {
    const v = [0, 1, 2, 3].map((j) => (s[i + j] === '=' ? 0 : ALPHABET.indexOf(s[i + j])));
    const n = (v[0] << 18) | (v[1] << 12) | (v[2] << 6) | v[3];
    o.push(n >> 16);
    if (s[i + 2] !== '=') o.push((n >> 8) & 255);
    if (s[i + 3] !== '=') o.push(n & 255);
  }
  return versBase64(o) === s ? { octets: o } : { raison: 'bits de remplissage non nuls' };
}
const enLignes = (s) => { const l = []; for (let i = 0; i < s.length; i += LIGNE_BASE64) l.push(s.slice(i, i + LIGNE_BASE64)); return l; };

const entete = ({ chantier, k, N, total, empreinte, tranche }) => `ATELIER-PARTIE-2 chantier=${chantier} partie=${k}/${N} total_octets=${total} empreinte=${empreinte} encodage=base64 tranche=${tranche}`;
const fin = (k, N) => `ATELIER-FIN-PARTIE ${k}/${N}`;

// Découpage déterministe : tranches consécutives, sans recouvrement, sur des frontières de caractère (jamais au milieu d'une séquence
// UTF-8), chacune d'au plus OCTETS_TRANCHE octets ; chaque tranche voyage en Base64 ASCII, son SHA-256 porte sur ses octets exacts.
export function decouper(texte, chantier) {
  if (typeof texte !== 'string' || texte === '') throw new TypeError('decouper : texte non vide attendu.');
  if (!idValide(chantier)) throw new TypeError('decouper : identifiant de chantier invalide.');
  const tranches = [];
  let courant = '';
  let o = 0;
  for (const ch of texte) {
    const n = octetsUtf8(ch);
    if (o + n > OCTETS_TRANCHE) { tranches.push(courant); courant = ''; o = 0; }
    courant += ch;
    o += n;
  }
  tranches.push(courant);
  const N = tranches.length;
  if (N > MAX_PARTIES) throw new TypeError(`decouper : ${N} parties (au plus ${MAX_PARTIES}).`);
  const total = versOctets(texte).length;
  const empreinte = hacherSha256(texte);
  return tranches.map((t, i) => {
    const p = `${entete({ chantier, k: i + 1, N, total, empreinte, tranche: hacherSha256(t) })}\n${enLignes(versBase64(versOctets(t))).join('\n')}\n${fin(i + 1, N)}`;
    if (p.length > LIMITE_CARACTERES || octetsUtf8(p) > LIMITE_OCTETS) throw new TypeError('decouper : partie hors limites.');
    return p;
  });
}

// Une partie collée, lue dans l'ordre : enveloppe, forme Base64, décodage strict, octets UTF-8 stricts, SHA-256 de la tranche.
// Seule tolérance d'enveloppe : UN saut de ligne final après la ligne de fin. Aucune normalisation, aucune réparation.
export function lirePartie(texte) {
  const refus = (raison) => ({ raison });
  if (typeof texte !== 'string' || texte === '') return refus('partie vide');
  if (texte.length > LIMITE_CARACTERES || octetsUtf8(texte) > LIMITE_OCTETS) return refus(`partie trop longue (au plus ${LIMITE_CARACTERES} caractères et ${LIMITE_OCTETS} octets)`);
  const lignes = (texte.endsWith('\n') ? texte.slice(0, -1) : texte).split('\n');
  if (lignes[0].startsWith('ATELIER-PARTIE-1 ')) return refus('format ATELIER-PARTIE-1 retiré en v0.65.8 : demande à Claude un nouvel envoi (ATELIER-PARTIE-2)');
  const m = RE_ENTETE.exec(lignes[0]);
  if (!m) return refus('début de partie absent ou invalide');
  const f = lignes.length >= 3 ? RE_FIN.exec(lignes[lignes.length - 1]) : null;
  if (!f) return refus('fin de partie absente (partie tronquée ?)');
  const k = Number(m[2]);
  const N = Number(m[3]);
  if (f[1] !== m[2] || f[2] !== m[3]) return refus(`numéro de la fin (${f[1]}/${f[2]}) différent du début (${k}/${N})`);
  if (k > N) return refus(`partie ${k}/${N} : numéro hors bornes`);
  const corps = lignes.slice(1, -1);
  const b64 = corps.join('');
  if (!corps.every((l, i) => RE_LIGNE.test(l) && (i === corps.length - 1 || l.length === LIGNE_BASE64))) return refus(`partie ${k}/${N} : Base64 invalide (alphabet ou lignes de ${LIGNE_BASE64} caractères attendus)`);
  const d = depuisBase64(b64);
  if (d.raison) return refus(`partie ${k}/${N} : Base64 invalide (${d.raison})`);
  const { octets } = d;
  if (octets.length > OCTETS_TRANCHE) return refus(`partie ${k}/${N} : tranche de ${octets.length} octets (au plus ${OCTETS_TRANCHE})`);
  const tranche = depuisOctets(octets);
  if (tranche === null) return refus(`partie ${k}/${N} : octets de la tranche non UTF-8 (strict)`);
  if (hacherSha256(tranche) !== m[6]) return refus(`partie ${k}/${N} : SHA-256 de la tranche faux`);
  return { partie: geler({ chantier: m[1], k, N, total: Number(m[4]), empreinte: m[5], tranche, octets: octets.length }) };
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
