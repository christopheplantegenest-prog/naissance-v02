// === DEBUT_ATELIER_RETOUR ===
// v0.65.21 — AT-10.4 « RETOUR DES FAITS SANS RECOPIE » (GO « AT-10.4 — GO RÉALISATION LOCALE », 21/10/2026 ; D-007 ; DI = F2, DJ, DL, DO).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Module PUR du transport des faits J1 à J4 et AT-5 :
//   annotationsFaits(genre, texte)        -> lignes « ::notice title=ATELIER-FAITS-1 <genre> <i>/<n> <sha256> <longueur>::<base64> » écrites par
//                                            l'outil qui produit les faits (texte exact, découpé en morceaux de MORCEAU caractères Base64)
//   lireAnnotations(annotations, genres)  -> { textes: { genre: texte } } ou { raison } (annotations REST d'UN job : complètes, ordonnées,
//                                            sans doublon, SHA-256 exact ; toute autre annotation ATELIER-FAITS* est refusée)
//   texteRetour(retour) / lireRetour(t)   -> bloc ATELIER-RETOUR-1 (ASCII, Base64) que Claude rend et que Christophe colle au téléphone
//   controlerRetour(retour, { t, d3, mission }) -> { lus, principal, utilises } ou { raison } : mêmes lecteurs que la copie manuelle (F1)
// Les annotations TRANSPORTENT les faits, elles ne les établissent pas : chaque fait est relu par son lecteur d'origine (lireFaitsAuto,
// lireFaitsCandidat, lireRetourAuto, lireFaits d'AT-5), puis rattaché au run, à T, à la D3 et au candidat. Aucun fait absent n'est
// complété ; un échec reste un échec (aucun succès déduit) ; toute incohérence = refus, et la copie manuelle (F1) reste possible.
// PURETÉ : imports de l'atelier seulement ; aucune horloge, aucun hasard, aucun état, aucune entrée/sortie, aucun réseau.

import { canonique, versOctets, depuisOctets, versBase64, depuisBase64 } from './journal.js';
import { hacherSha256 } from './empreinte.js';
import { identiteT, lireFaitsAuto, lireFaitsCandidat, lireRetourAuto, PROTOCOLE_FAITS, PROTOCOLE_FAITS_TEMOIN, REF_MAIN } from './auto.js';
import { lireFaits, ecrireFaits } from './verification.js';

export const PROTOCOLE_RETOUR = 'atelier-retour-1';
export const GENRES = Object.freeze(['j1', 'j2f', 'j2', 'j3', 'j4', 'at5']);
export const LIBELLES = Object.freeze({ j1: 'J1 garde', j2f: 'J2 frontière', j2: 'J2 appel', j3: 'J3 constat', j4: 'J4 candidat', at5: 'AT-5 vérification' });
export const MORCEAU = 3000;
export const MAX_MORCEAUX = 10;
export const LIMITE_BLOC = 30000;
const LIGNE_BASE64 = 76;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_EMPREINTE = /^[0-9a-f]{64}$/;
const RE_RUN = /^[1-9][0-9]{0,19}$/;
const RE_TITRE = /^ATELIER-FAITS-1 (j1|j2f|j2|j3|j4|at5) (0|[1-9][0-9]?)\/([1-9][0-9]{0,3}) ([0-9a-f]{64}) (0|[1-9][0-9]{0,4})$/;
const RE_MORCEAU = /^[A-Za-z0-9+/=]+$/;
const RE_ENTETE = /^ATELIER-RETOUR-1 tentative=(\S{1,200}) octets=([1-9][0-9]{0,6}) empreinte=([0-9a-f]{64})$/;
const RE_LIGNE = /^[A-Za-z0-9+/=]+$/;
const FIN = 'ATELIER-FIN-RETOUR';
const RE_WORKFLOW_AT5 = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/\.github\/workflows\/atelier-verification\.yml@refs\/heads\/main$/;
const CLES_RETOUR = 'd3,faits,protocole,runs,tentative';
const CLES_RUN = 'run_id,workflow_sha';
const CLES_DEMANDE_AT5 = ['base', 'branche', 'candidat', 'version_base', 'version_candidat'];

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const cles = (o) => Object.keys(o).sort().join(',');
function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}

// ------------------------------------------------------------------------------------------------ émission (outils des workflows)
// Texte exact -> octets UTF-8 -> Base64 -> morceaux de MORCEAU caractères. Au-delà de MAX_MORCEAUX : UNE annotation « 0/<n> trop-grand »,
// que la lecture refuse (repli F1) : jamais une partie des faits.
export function annotationsFaits(genre, texte) {
  if (!GENRES.includes(genre)) throw new TypeError(`annotationsFaits : genre inconnu « ${genre} ».`);
  if (typeof texte !== 'string' || texte === '') throw new TypeError('annotationsFaits : texte non vide attendu.');
  const b64 = versBase64(versOctets(texte));
  const sha = hacherSha256(texte);
  const n = Math.ceil(b64.length / MORCEAU);
  if (n > MAX_MORCEAUX) return [`::notice title=ATELIER-FAITS-1 ${genre} 0/${n} ${sha} 0::trop-grand`];
  const l = [];
  for (let i = 0; i < n; i += 1) {
    const m = b64.slice(i * MORCEAU, (i + 1) * MORCEAU);
    l.push(`::notice title=ATELIER-FAITS-1 ${genre} ${i + 1}/${n} ${sha} ${m.length}::${m}`);
  }
  return l;
}

// ------------------------------------------------------------------------------------------------ lecture des annotations d'un job
// annotations : tableau REST (check-runs/<job>/annotations) ; genres : genres que CE job peut porter. Les annotations étrangères (sans le
// préfixe ATELIER-FAITS) sont ignorées ; toute annotation au préfixe ATELIER-FAITS qui n'est pas exactement conforme est refusée.
export function lireAnnotations(annotations, genres) {
  const refus = (raison) => ({ raison });
  if (!Array.isArray(annotations) || !Array.isArray(genres)) return refus('annotations illisibles');
  const groupes = new Map();
  for (const a of annotations) {
    if (!estObjet(a)) return refus('annotation illisible');
    const titre = typeof a.title === 'string' ? a.title : '';
    if (!titre.startsWith('ATELIER-FAITS')) continue;
    const m = RE_TITRE.exec(titre);
    if (!m) return refus(`annotation ATELIER-FAITS illisible : « ${titre.slice(0, 80)} »`);
    if (a.annotation_level !== 'notice') return refus(`annotation ATELIER-FAITS de niveau « ${a.annotation_level} » (notice attendu)`);
    const [, genre, is, ns, sha, ls] = m;
    const i = Number(is);
    const n = Number(ns);
    if (!genres.includes(genre)) return refus(`faits ${genre} annoncés par un job qui ne les produit pas`);
    if (i === 0) return refus(`faits ${genre} trop grands pour les annotations (${n} morceaux) : copie manuelle (F1)`);
    if (i > n) return refus(`faits ${genre} : morceau ${i}/${n} hors bornes`);
    const message = typeof a.message === 'string' ? a.message : '';
    if (message.length !== Number(ls) || !RE_MORCEAU.test(message)) return refus(`faits ${genre} : morceau ${i}/${n} tronqué ou altéré`);
    if (!groupes.has(genre)) groupes.set(genre, { n, sha, morceaux: new Map() });
    const g = groupes.get(genre);
    if (g.n !== n || g.sha !== sha) return refus(`faits ${genre} ambigus : plusieurs émissions dans le même job`);
    if (g.morceaux.has(i)) return refus(`faits ${genre} : morceau ${i}/${n} en double`);
    g.morceaux.set(i, message);
  }
  const textes = {};
  for (const [genre, g] of groupes) {
    for (let i = 1; i <= g.n; i += 1) if (!g.morceaux.has(i)) return refus(`faits ${genre} : morceau ${i}/${g.n} absent (tronqué ?)`);
    for (let i = 1; i < g.n; i += 1) if (g.morceaux.get(i).length !== MORCEAU) return refus(`faits ${genre} : morceau ${i}/${g.n} de longueur inattendue`);
    if (g.morceaux.get(g.n).length > MORCEAU) return refus(`faits ${genre} : dernier morceau trop long`);
    const d = depuisBase64([...Array(g.n).keys()].map((k) => g.morceaux.get(k + 1)).join(''));
    if (d.raison) return refus(`faits ${genre} : Base64 invalide (${d.raison})`);
    const texte = depuisOctets(d.octets);
    if (texte === null) return refus(`faits ${genre} : octets non UTF-8`);
    if (hacherSha256(texte) !== g.sha) return refus(`faits ${genre} : SHA-256 faux`);
    textes[genre] = texte;
  }
  return { textes };
}

// ------------------------------------------------------------------------------------------------ bloc ATELIER-RETOUR-1
const enLignes = (s) => { const l = []; for (let i = 0; i < s.length; i += LIGNE_BASE64) l.push(s.slice(i, i + LIGNE_BASE64)); return l; };

function raisonForme(v) {
  if (!estObjet(v) || cles(v) !== CLES_RETOUR) return 'clés du retour inattendues';
  if (v.protocole !== PROTOCOLE_RETOUR) return 'protocole inconnu';
  if (typeof v.tentative !== 'string') return 'tentative illisible';
  const p = v.tentative.split('/');
  if (p.length !== 3 || identiteT({ chantier: p[0], jalon: p[1], numero: p[2] }).t !== v.tentative) return 'tentative illisible';
  const run = (r) => estObjet(r) && cles(r) === CLES_RUN && RE_RUN.test(r.run_id) && RE_SHA.test(r.workflow_sha);
  if (!estObjet(v.runs) || cles(v.runs) !== 'at5,auto' || !run(v.runs.auto) || !(v.runs.at5 === null || run(v.runs.at5))) return 'runs illisibles';
  if (!estObjet(v.d3) || cles(v.d3) !== 'commit,empreinte' || !RE_SHA.test(v.d3.commit) || !RE_EMPREINTE.test(v.d3.empreinte)) return 'D3 illisible';
  if (!estObjet(v.faits) || Object.keys(v.faits).length === 0 || !Object.keys(v.faits).every((g) => GENRES.includes(g))) return 'faits illisibles';
  for (const [g, f] of Object.entries(v.faits)) {
    if (!estObjet(f) || cles(f) !== 'empreinte,texte' || typeof f.texte !== 'string' || f.texte === '' || !RE_EMPREINTE.test(f.empreinte)) return `faits ${g} illisibles`;
    if (hacherSha256(f.texte) !== f.empreinte) return `faits ${g} : empreinte fausse`;
  }
  return null;
}

// retour : { tentative, runs: { auto, at5 }, d3: { commit, empreinte }, textes: { genre: texte } } -> texte du bloc (lève si invalide).
export function texteRetour({ tentative, runs, d3, textes } = {}) {
  const faits = {};
  for (const g of GENRES) if (estObjet(textes) && Object.hasOwn(textes, g)) faits[g] = { empreinte: hacherSha256(textes[g]), texte: textes[g] };
  const v = { protocole: PROTOCOLE_RETOUR, tentative, runs, d3, faits };
  const r = raisonForme(v);
  if (r) throw new TypeError(`texteRetour : ${r}.`);
  const charge = canonique(v);
  const o = versOctets(charge);
  const bloc = `ATELIER-RETOUR-1 tentative=${tentative} octets=${o.length} empreinte=${hacherSha256(charge)}\n${enLignes(versBase64(o)).join('\n')}\n${FIN}\n`;
  if (bloc.length > LIMITE_BLOC) throw new TypeError(`texteRetour : bloc de ${bloc.length} caractères (au plus ${LIMITE_BLOC}) : copie manuelle (F1).`);
  return bloc;
}

// Lecture stricte : seule tolérance, l'absence du saut de ligne final. Aucune réparation, aucune normalisation.
export function lireRetour(texte) {
  const refus = (raison) => ({ raison });
  if (typeof texte !== 'string' || texte.trim() === '') return refus('retour vide');
  if (texte.length > LIMITE_BLOC) return refus(`retour trop long (au plus ${LIMITE_BLOC} caractères)`);
  const lignes = (texte.endsWith('\n') ? texte.slice(0, -1) : texte).split('\n');
  const m = RE_ENTETE.exec(lignes[0]);
  if (!m) return refus('début du retour absent ou invalide (ATELIER-RETOUR-1 attendu)');
  if (lignes.length < 3 || lignes[lignes.length - 1] !== FIN) return refus('fin du retour absente (retour tronqué ?)');
  const corps = lignes.slice(1, -1);
  if (!corps.every((l, i) => RE_LIGNE.test(l) && (i === corps.length - 1 ? l.length <= LIGNE_BASE64 : l.length === LIGNE_BASE64))) return refus('Base64 invalide (lignes de 76 caractères attendues)');
  const d = depuisBase64(corps.join(''));
  if (d.raison) return refus(`Base64 invalide (${d.raison})`);
  if (d.octets.length !== Number(m[2])) return refus('longueur du retour différente de l\'annonce');
  const charge = depuisOctets(d.octets);
  if (charge === null) return refus('octets du retour non UTF-8');
  if (hacherSha256(charge) !== m[3]) return refus('empreinte du retour fausse');
  let v;
  try { v = JSON.parse(charge); } catch { return refus('JSON du retour illisible'); }
  if (canonique(v) !== charge) return refus('forme du retour non canonique');
  const r = raisonForme(v);
  if (r) return refus(r);
  if (v.tentative !== m[1]) return refus('tentative de l\'en-tête différente du contenu');
  return { retour: geler({ ...v, empreinte: m[3] }) };
}

// ------------------------------------------------------------------------------------------------ contrôle (Claude et téléphone)
// Lit chaque fait par son lecteur d'origine, puis exige : même T, même run (id, premier essai, main, SHA du workflow), même D3, chaîne
// J1 -> J2 -> J4 -> AT-5 sans saut, constat J3 cohérent, demande AT-5 = J4.demande_at5, provenance AT-5. d3 (facultatif) : la sauvegarde
// confirmée attendue ; mission (facultative) : la pièce de T, pour rejouer lireRetourAuto. Rend le genre « principal » pour la clôture.
export function controlerRetour(retour, { t, d3 = null, mission = null } = {}) {
  const refus = (raison) => ({ raison });
  const r0 = estObjet(retour) ? raisonForme({ protocole: retour.protocole, tentative: retour.tentative, runs: retour.runs, d3: retour.d3, faits: retour.faits }) : 'retour illisible';
  if (r0) return refus(r0);
  if (typeof t !== 'string' || retour.tentative !== t) return refus('retour d\'une autre tentative');
  if (d3 !== null && (!estObjet(d3) || d3.commit !== retour.d3.commit || d3.empreinte !== retour.d3.empreinte)) return refus('D3 du retour différente de la sauvegarde confirmée');
  const texte = (g) => (Object.hasOwn(retour.faits, g) ? retour.faits[g].texte : null);
  const lus = {};
  for (const g of ['j1', 'j2f', 'j2', 'j3']) {
    if (texte(g) === null) continue;
    const l = lireFaitsAuto(texte(g));
    if (l.raison) return refus(`faits ${g} illisibles : ${l.raison}`);
    const attendu = { j1: [PROTOCOLE_FAITS, 'garde'], j2f: [PROTOCOLE_FAITS, 'frontiere'], j2: [PROTOCOLE_FAITS_TEMOIN, 'appel'], j3: [PROTOCOLE_FAITS_TEMOIN, 'constat'] }[g];
    if (l.faits.protocole !== attendu[0] || l.faits.etape !== attendu[1]) return refus(`faits ${g} d'une autre étape`);
    lus[g] = l.faits;
  }
  if (texte('j4') !== null) {
    const l = lireFaitsCandidat(texte('j4'));
    if (l.raison) return refus(`faits j4 illisibles : ${l.raison}`);
    lus.j4 = l.faits;
  }
  if (texte('at5') !== null) {
    const l = lireFaits(texte('at5'), hacherSha256);
    if (l.raison) return refus(`faits at5 illisibles : ${l.raison}`);
    // Le lecteur d'AT-5 tolère toute mise en forme JSON ; le transport, lui, porte le texte EXACT écrit par le vérificateur (ecrireFaits).
    const { empreinte, ...sans } = l.faits;
    let ecrit = null;
    try { ecrit = ecrireFaits(sans, hacherSha256); } catch { ecrit = null; }
    if (ecrit !== texte('at5')) return refus('faits at5 : forme différente de celle écrite par le vérificateur');
    lus.at5 = l.faits;
  }
  const run = retour.runs.auto;
  for (const g of ['j1', 'j2f', 'j2', 'j3', 'j4']) {
    if (!lus[g]) continue;
    const f = lus[g];
    if (f.tentative !== t) return refus(`faits ${g} d'une autre tentative`);
    const p = f.provenance;
    if (!estObjet(p) || p.run_id !== run.run_id || p.run_attempt !== '1' || p.ref !== REF_MAIN || p.workflow_sha !== run.workflow_sha) return refus(`faits ${g} d'un autre run`);
    if (!estObjet(f.etat) || f.etat.commit !== retour.d3.commit || f.etat.empreinte !== retour.d3.empreinte) return refus(`faits ${g} d'une autre D3`);
  }
  // Chaîne sans saut : J1 toujours ; J2 frontière seulement après J1 autorisé ; J2 appel seulement après PRET ; J4 seulement après une
  // réponse connue ; AT-5 seulement après un candidat créé. J3 (if: always) est toujours là et s'en remet à J2 si l'appel a été exécuté.
  if (!lus.j1) return refus('faits j1 absents');
  if (!lus.j3) return refus('faits j3 absents');
  if (lus.j2f && lus.j1.resultat !== 'autorise') return refus('faits j2f sans autorisation j1');
  if (lus.j2 && (!lus.j2f || lus.j2f.resultat !== 'pret-a-appeler')) return refus('faits j2 sans frontière franchie');
  if (lus.j4 && (!lus.j2 || lus.j2.issue !== 'reponse-connue')) return refus('faits j4 sans réponse connue');
  if (lus.j2 && (lus.j3.issue !== 'issue-inconnue' || lus.j3.raison !== 'appel-execute-voir-faits-j2')) return refus('constat j3 incohérent avec l\'appel j2');
  if (!lus.j2 && lus.j3.raison === 'appel-execute-voir-faits-j2') return refus('faits j2 absents alors que l\'appel a été exécuté');
  if (lus.j1.resultat !== 'autorise' && lus.j3.issue !== null) return refus('constat j3 incohérent avec le refus j1');
  const cree = !!lus.j4 && lus.j4.statut === 'cree';
  if (lus.at5 && !cree) return refus('faits at5 sans candidat créé');
  if (cree && !lus.at5) return refus('faits at5 absents : un retour après AT-5 est attendu');
  if ((retour.runs.at5 === null) !== !lus.at5) return refus('run AT-5 et faits at5 incohérents');
  if (lus.at5) {
    const f = lus.at5;
    if (f.provenance.run_id !== retour.runs.at5.run_id || !RE_WORKFLOW_AT5.test(f.provenance.workflow_ref) || f.provenance.verificateur_sha !== retour.runs.at5.workflow_sha) return refus('faits at5 d\'un autre run');
    const da = lus.j4.demande_at5;
    if (!estObjet(da) || !CLES_DEMANDE_AT5.every((k) => f.demande[k] === da[k])) return refus('faits at5 d\'une autre demande que J4');
  }
  if (cree && mission !== null) {
    const l = lireRetourAuto({ j2Texte: texte('j2'), j4Texte: texte('j4'), t, mission });
    if (l.raison) return refus(`retour AUTO refusé : ${l.raison}`);
  }
  const principal = lus.j2 ? 'j2' : lus.j3.issue !== null ? 'j3' : lus.j2f ? 'j2f' : 'j1';
  const utilises = [principal, ...(lus.j4 ? ['j4'] : []), ...(lus.at5 ? ['at5'] : [])];
  return { lus: geler(lus), principal, utilises: geler(utilises) };
}
// === FIN_ATELIER_RETOUR ===
