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
// v0.65.23 — R1 conception B (GO « R1 — CONCEPTION B ACCEPTÉE », 23/10/2026) : RÉGULARISATION À COÛT RÉEL 0 SUR PREUVE FINALE.
//   texteBlocPreuve / lirePreuve          -> bloc ATELIER-PREUVE-1 : état final du run lu par Claude (run, approbations V2, jobs, J3 exact)
//   texteAutorisation                     -> texte modèle EXACT que Christophe poste en commentaire GitHub depuis son compte (N2)
//   texteBlocAutorisation / lireAutorisation -> bloc ATELIER-AUTORISATION-1 : ce commentaire relu par Claude (REST), contenu exact
//   controlerPreuve / controlerAutorisation / decisionRegularisation -> décision pure, ou { raison } (rien n'est écrit)
// Base64 et SHA-256 ne prouvent que l'INTÉGRITÉ du transport, jamais une identité : l'authentification repose sur les comptes GitHub
// (approbation V2 du run, commentaire N2), relus par Claude et revérifiables par quiconque (dépôt public). Un commentaire GitHub reste
// modifiable ou supprimable : son contenu et ses dates sont CONSERVÉS tels que lus, et une édition constatée à la lecture est refusée.
// PURETÉ : imports de l'atelier seulement ; aucune horloge, aucun hasard, aucun état, aucune entrée/sortie, aucun réseau.

import { canonique, versOctets, depuisOctets, versBase64, depuisBase64 } from './journal.js';
import { hacherSha256 } from './empreinte.js';
import { identiteT, lireFaitsAuto, lireFaitsCandidat, lireRetourAuto, millisecondes, ENVIRONNEMENT, PROTOCOLE_FAITS, PROTOCOLE_FAITS_TEMOIN, REF_MAIN } from './auto.js';
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
// ================================================================================================ v0.65.23 — régularisation (R1, B)
// Seul cas accepté : tentative AUTO VIVANTE, hors carnet, engagement encore ouvert, J3 historique ISSUE INCONNUE (raison autre que
// « appel exécuté »), et preuve finale : J1 réussi ; J2 terminé, sauté sans étape Appel exécutée, ou avec UNE étape Appel terminée et
// sautée ; J4 terminé et sauté ; J3 terminé ; run terminé, premier essai ; UNE approbation V2 (atelier-auto) ; autorisation N2 du même
// compte, propriétaire, non éditée, postérieure au run et à la preuve, au texte modèle exact (T, run, empreinte de CETTE preuve, 0 USD).
export const PROTOCOLE_PREUVE = 'atelier-preuve-finale-1';
export const PROTOCOLE_AUTORISATION = 'atelier-autorisation-1';
export const PROTOCOLE_REGULARISATION = 'atelier-regularisation-1';
export const BLOCS_REGULARISATION = Object.freeze({
  preuve: Object.freeze({ mot: 'ATELIER-PREUVE-1', fin: 'ATELIER-FIN-PREUVE' }),
  autorisation: Object.freeze({ mot: 'ATELIER-AUTORISATION-1', fin: 'ATELIER-FIN-AUTORISATION' }),
});
const CLES_PREUVE = 'approbations,j3,jobs,lu_le,protocole,run,tentative';
const CLES_RUN_PREUVE = 'conclusion,created_at,head_sha,id,run_attempt,updated_at';
const CLES_APPROBATION = 'environnements,etat,login,user_id';
const CLES_JOBS_PREUVE = 'appel,candidat,constat,garde';
const CLES_AUTORISATION = 'commentaire,depot,lu_le,preuve,protocole,run,source,tentative';
const CLES_COMMENTAIRE = 'association,cree_le,id,issue,login,modifie_le,texte,url,user_id';
const RE_ETAT_JOB = /^[a-z_]{1,32}$/;
const RE_LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const RE_ID_GH = /^[1-9][0-9]{0,19}$/;
const RE_DEPOT_GH = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const LIMITE_J3 = 20000;
const LIMITE_COMMENTAIRE = 2000;
const MAX_APPROBATIONS = 20;
const MAX_ETAPES = 10;
const SOURCE_N2 = 'commentaire-github';
const PROPRIETAIRE = 'OWNER';

const etatTexte = (x) => typeof x === 'string' && RE_ETAT_JOB.test(x);
const tentativeValide = (t) => { const p = typeof t === 'string' ? t.split('/') : []; return p.length === 3 && identiteT({ chantier: p[0], jalon: p[1], numero: p[2] }).t === t; };
const entierPositif = (x) => Number.isSafeInteger(x) && x >= 1;
const instant = (x) => millisecondes(x) !== null;
function etatJob(j, avecEtapes) {
  if (!estObjet(j) || cles(j) !== (avecEtapes ? 'conclusion,etapes,status' : 'conclusion,status')) return false;
  if (!etatTexte(j.status) || !(j.conclusion === null || etatTexte(j.conclusion))) return false;
  return !avecEtapes || (Array.isArray(j.etapes) && j.etapes.length <= MAX_ETAPES && j.etapes.every((x) => etatJob(x, false)));
}

function raisonFormePreuve(v) {
  if (!estObjet(v) || cles(v) !== CLES_PREUVE) return 'clés de la preuve inattendues';
  if (v.protocole !== PROTOCOLE_PREUVE) return 'protocole de la preuve inconnu';
  if (!tentativeValide(v.tentative)) return 'tentative illisible';
  const r = v.run;
  if (!estObjet(r) || cles(r) !== CLES_RUN_PREUVE || typeof r.id !== 'string' || !RE_RUN.test(r.id) || !Number.isSafeInteger(r.run_attempt) || typeof r.head_sha !== 'string' || !RE_SHA.test(r.head_sha)
    || !instant(r.created_at) || !instant(r.updated_at) || !(r.conclusion === null || etatTexte(r.conclusion))) return 'run de la preuve illisible';
  if (!Array.isArray(v.approbations) || v.approbations.length > MAX_APPROBATIONS) return 'approbations illisibles';
  for (const a of v.approbations) {
    if (!estObjet(a) || cles(a) !== CLES_APPROBATION || !entierPositif(a.user_id) || typeof a.login !== 'string' || !RE_LOGIN.test(a.login) || !etatTexte(a.etat)
      || !Array.isArray(a.environnements) || a.environnements.length > MAX_APPROBATIONS || !a.environnements.every((x) => typeof x === 'string' && x.length <= 100)) return 'approbations illisibles';
  }
  const j = v.jobs;
  if (!estObjet(j) || cles(j) !== CLES_JOBS_PREUVE) return 'jobs de la preuve illisibles';
  for (const k of ['garde', 'constat', 'candidat']) if (!(j[k] === null || etatJob(j[k], false))) return 'jobs de la preuve illisibles';
  if (!(j.appel === null || etatJob(j.appel, true))) return 'jobs de la preuve illisibles';
  if (typeof v.j3 !== 'string' || v.j3 === '' || v.j3.length > LIMITE_J3) return 'texte J3 de la preuve illisible';
  if (!instant(v.lu_le)) return 'heure de lecture de la preuve illisible';
  return null;
}

function raisonFormeAutorisation(v) {
  if (!estObjet(v) || cles(v) !== CLES_AUTORISATION) return 'clés de l\'autorisation inattendues';
  if (v.protocole !== PROTOCOLE_AUTORISATION) return 'protocole de l\'autorisation inconnu';
  if (v.source !== SOURCE_N2) return 'source de l\'autorisation inconnue';
  if (!tentativeValide(v.tentative)) return 'tentative illisible';
  if (typeof v.run !== 'string' || !RE_RUN.test(v.run)) return 'run de l\'autorisation illisible';
  if (typeof v.preuve !== 'string' || !RE_EMPREINTE.test(v.preuve)) return 'empreinte de preuve de l\'autorisation illisible';
  if (typeof v.depot !== 'string' || !RE_DEPOT_GH.test(v.depot)) return 'dépôt de l\'autorisation illisible';
  if (!instant(v.lu_le)) return 'heure de lecture de l\'autorisation illisible';
  const c = v.commentaire;
  if (!estObjet(c) || cles(c) !== CLES_COMMENTAIRE) return 'commentaire illisible';
  if (typeof c.id !== 'string' || !RE_ID_GH.test(c.id) || !entierPositif(c.issue) || !entierPositif(c.user_id)) return 'identifiants du commentaire illisibles';
  if (typeof c.login !== 'string' || !RE_LOGIN.test(c.login) || typeof c.association !== 'string' || c.association.length > 40) return 'auteur du commentaire illisible';
  if (!instant(c.cree_le) || !instant(c.modifie_le)) return 'dates du commentaire illisibles';
  if (typeof c.texte !== 'string' || c.texte === '' || c.texte.length > LIMITE_COMMENTAIRE) return 'texte du commentaire illisible';
  if (typeof c.url !== 'string' || c.url.length > 300 || !c.url.endsWith(`/${v.depot}/issues/${c.issue}#issuecomment-${c.id}`)) return 'adresse du commentaire incohérente';
  return null;
}

const FORMES = Object.freeze({ preuve: raisonFormePreuve, autorisation: raisonFormeAutorisation });
function texteBloc(genre, v) {
  const r = FORMES[genre](v);
  if (r) throw new TypeError(`bloc ${BLOCS_REGULARISATION[genre].mot} : ${r}.`);
  const charge = canonique(v);
  const o = versOctets(charge);
  const { mot, fin } = BLOCS_REGULARISATION[genre];
  const bloc = `${mot} tentative=${v.tentative} octets=${o.length} empreinte=${hacherSha256(charge)}\n${enLignes(versBase64(o)).join('\n')}\n${fin}\n`;
  if (bloc.length > LIMITE_BLOC) throw new TypeError(`bloc ${mot} de ${bloc.length} caractères (au plus ${LIMITE_BLOC}).`);
  return bloc;
}
// Lecture stricte, comme lireRetour : seule tolérance, l'absence du saut de ligne final.
function lireBloc(genre, texte) {
  const { mot, fin } = BLOCS_REGULARISATION[genre];
  const refus = (raison) => ({ raison });
  if (typeof texte !== 'string' || texte.trim() === '') return refus(`${genre} vide`);
  if (texte.length > LIMITE_BLOC) return refus(`${genre} trop long (au plus ${LIMITE_BLOC} caractères)`);
  const lignes = (texte.endsWith('\n') ? texte.slice(0, -1) : texte).split('\n');
  const m = new RegExp(`^${mot} tentative=(\\S{1,200}) octets=([1-9][0-9]{0,6}) empreinte=([0-9a-f]{64})$`).exec(lignes[0]);
  if (!m) return refus(`début du bloc absent ou invalide (${mot} attendu)`);
  if (lignes.length < 3 || lignes[lignes.length - 1] !== fin) return refus('fin du bloc absente (bloc tronqué ?)');
  const corps = lignes.slice(1, -1);
  if (!corps.every((l, i) => RE_LIGNE.test(l) && (i === corps.length - 1 ? l.length <= LIGNE_BASE64 : l.length === LIGNE_BASE64))) return refus('Base64 invalide (lignes de 76 caractères attendues)');
  const d = depuisBase64(corps.join(''));
  if (d.raison) return refus(`Base64 invalide (${d.raison})`);
  if (d.octets.length !== Number(m[2])) return refus('longueur du bloc différente de l\'annonce');
  const charge = depuisOctets(d.octets);
  if (charge === null) return refus('octets du bloc non UTF-8');
  if (hacherSha256(charge) !== m[3]) return refus('empreinte du bloc fausse');
  let v;
  try { v = JSON.parse(charge); } catch { return refus('JSON du bloc illisible'); }
  if (canonique(v) !== charge) return refus('forme du bloc non canonique');
  const r = FORMES[genre](v);
  if (r) return refus(r);
  if (v.tentative !== m[1]) return refus('tentative de l\'en-tête différente du contenu');
  return { valeur: geler({ ...v, empreinte: m[3] }) };
}
export const texteBlocPreuve = (preuve) => texteBloc('preuve', preuve);
export function lirePreuve(texte) { const l = lireBloc('preuve', texte); return l.raison ? l : { preuve: l.valeur }; }
export const texteBlocAutorisation = (autorisation) => texteBloc('autorisation', autorisation);
export function lireAutorisation(texte) { const l = lireBloc('autorisation', texte); return l.raison ? l : { autorisation: l.valeur }; }

// Texte modèle de l'autorisation N2 : ASCII, cinq lignes, à poster TEL QUEL. Comparaison après seule normalisation des fins de ligne
// (CRLF -> LF) et des blancs finaux, que l'éditeur de GitHub peut ajouter ; tout autre écart (un caractère) est un refus.
export function texteAutorisation({ tentative, run, preuve } = {}) {
  if (!tentativeValide(tentative) || typeof run !== 'string' || !RE_RUN.test(run) || typeof preuve !== 'string' || !RE_EMPREINTE.test(preuve)) throw new TypeError('texteAutorisation : tentative, run et empreinte de preuve attendus.');
  return [
    'AUTORISATION REGULARISATION ATELIER-REGULARISATION-1',
    `tentative=${tentative} run=${run} essai=1`,
    `preuve=${preuve}`,
    'cout=0 USD conclusion=appel-non-execute',
    'J\'autorise la regularisation a 0 de cette tentative sur cette preuve. Rien d\'autre.',
  ].join('\n');
}
const normaliserCommentaire = (t) => t.replaceAll('\r\n', '\n').replace(/\s+$/, '');
const etatDe2 = (j) => `${j.status}/${j.conclusion}`;

// Preuve lue (lirePreuve) contre T et la sauvegarde confirmée que le run a lue -> { j3, v2, constat } ou { raison } (ASCII).
export function controlerPreuve(preuve, { t, d3 } = {}) {
  const refus = (raison) => ({ raison });
  if (!estObjet(preuve)) return refus('preuve-absente');
  if (raisonFormePreuve({ approbations: preuve.approbations, j3: preuve.j3, jobs: preuve.jobs, lu_le: preuve.lu_le, protocole: preuve.protocole, run: preuve.run, tentative: preuve.tentative })) return refus('preuve-illisible');
  if (preuve.tentative !== t) return refus('tentative-differente');
  const l = lireFaitsAuto(preuve.j3);
  if (!preuve.j3.endsWith('\n') || l.raison || l.faits.protocole !== PROTOCOLE_FAITS_TEMOIN || l.faits.etape !== 'constat') return refus('j3-illisible');
  const j3 = l.faits;
  if (j3.tentative !== t) return refus('tentative-differente');
  const p = j3.provenance;
  if (preuve.run.run_attempt !== 1 || p.run_id !== preuve.run.id || p.run_attempt !== '1' || p.ref !== REF_MAIN || p.workflow_sha !== preuve.run.head_sha) return refus('run-different');
  if (!estObjet(d3) || !estObjet(j3.etat) || j3.etat.commit !== d3.commit || j3.etat.empreinte !== d3.empreinte) return refus('etat-different');
  if (j3.issue !== 'issue-inconnue') return refus('regularisation-inutile');
  if (j3.raison === 'appel-execute-voir-faits-j2') return refus('appel-execute');
  const { garde, appel, constat, candidat } = preuve.jobs;
  if (!garde || !appel || !constat || !candidat) return refus('job-absent');
  if ([garde, appel, constat, candidat].some((x) => x.status !== 'completed' || x.conclusion === null)) return refus('preuve-contradictoire');
  if (garde.conclusion !== 'success') return refus('preuve-contradictoire');
  if (appel.etapes.some((x) => x.status !== 'completed' || x.conclusion === null)) return refus('etat-appel-incertain');
  if (appel.conclusion === 'skipped') {
    if (appel.etapes.some((x) => x.conclusion !== 'skipped')) return refus('preuve-contradictoire');
  } else {
    if (appel.etapes.length !== 1) return refus('etat-appel-incertain');
    if (appel.etapes[0].conclusion !== 'skipped') return refus('appel-execute');
  }
  if (candidat.conclusion !== 'skipped') return refus('preuve-contradictoire');
  if (preuve.approbations.some((a) => a.etat !== 'approved')) return refus('preuve-contradictoire');
  const v2 = preuve.approbations.filter((a) => a.environnements.includes(ENVIRONNEMENT));
  if (v2.length === 0) return refus('v2-absente');
  if (new Set(v2.map((a) => a.user_id)).size !== 1 || new Set(v2.map((a) => a.login)).size !== 1) return refus('preuve-contradictoire');
  const constatFinal = {
    garde: etatDe2(garde), appel: etatDe2(appel), etape_appel: appel.etapes.length === 1 ? etatDe2(appel.etapes[0]) : null,
    candidat: etatDe2(candidat), constat: etatDe2(constat), conclusion: 'appel-non-execute', lu_le: preuve.lu_le,
  };
  return { j3, v2: geler({ user_id: v2[0].user_id, login: v2[0].login }), constat: geler(constatFinal) };
}

// Autorisation lue (lireAutorisation) contre T, la preuve (empreinte, run, heure de lecture : null si inconnue, côté outil) et V2.
export function controlerAutorisation(autorisation, { t, preuve, v2 } = {}) {
  const refus = (raison) => ({ raison });
  if (!estObjet(autorisation)) return refus('autorisation-absente');
  const a = autorisation;
  if (raisonFormeAutorisation({ commentaire: a.commentaire, depot: a.depot, lu_le: a.lu_le, preuve: a.preuve, protocole: a.protocole, run: a.run, source: a.source, tentative: a.tentative })) return refus('autorisation-illisible');
  if (!estObjet(preuve) || !estObjet(preuve.run) || !estObjet(v2)) return refus('preuve-absente');
  if (a.tentative !== t) return refus('autorisation-autre-tentative');
  if (a.preuve !== preuve.empreinte) return refus('autorisation-autre-preuve');
  if (a.run !== preuve.run.id) return refus('autorisation-autre-run');
  const c = a.commentaire;
  if (normaliserCommentaire(c.texte) !== texteAutorisation({ tentative: t, run: preuve.run.id, preuve: preuve.empreinte })) return refus('autorisation-texte');
  if (c.user_id !== v2.user_id || c.login !== v2.login) return refus('autorisation-autre-compte');
  if (c.association !== PROPRIETAIRE) return refus('autorisation-non-proprietaire');
  if (c.modifie_le !== c.cree_le) return refus('autorisation-modifiee');
  const cree = millisecondes(c.cree_le);
  if (cree <= millisecondes(preuve.run.updated_at)) return refus('autorisation-anterieure');
  if (preuve.lu_le !== null && cree <= millisecondes(preuve.lu_le)) return refus('autorisation-anterieure');
  if (millisecondes(a.lu_le) < cree) return refus('autorisation-illisible');
  return { commentaire: c };
}

// Décision complète (téléphone) : état local (vivante, engagement, carnet, réutilisations) + preuve + autorisation + décision humaine.
// Rend { regularisation, faits_auto, faits_auto_empreinte, constat } (rien n'est écrit) ou { raison } (ASCII). Le coût 0 n'est JAMAIS
// déduit : le champ saisi doit lire exactement « 0 ». Le J3 historique est conservé tel quel (texte exact, issue « issue-inconnue »).
export function decisionRegularisation({ preuve, autorisation, t, d3, vivante, engagement, carnet, deja = {}, decideur, montant, motif } = {}) {
  const refus = (raison) => ({ raison });
  if (carnet !== false) return refus('carnet-ferme');
  if (vivante !== true) return refus('tentative-close');
  if (engagement !== 'engagee') return refus('engagement-deja-solde');
  if (!estObjet(preuve)) return refus('preuve-absente');
  const cp = controlerPreuve(preuve, { t, d3 });
  if (cp.raison) return cp;
  const dejaPreuves = Array.isArray(deja.preuves) ? deja.preuves : [];
  const dejaCommentaires = Array.isArray(deja.commentaires) ? deja.commentaires : [];
  if (dejaPreuves.includes(preuve.empreinte)) return refus('preuve-deja-utilisee');
  const ca = controlerAutorisation(autorisation, { t, preuve, v2: cp.v2 });
  if (ca.raison) return ca;
  if (dejaCommentaires.includes(autorisation.commentaire.id)) return refus('autorisation-deja-utilisee');
  if (typeof decideur !== 'string' || decideur.trim() === '') return refus('decideur-absent');
  if (decideur.trim() !== autorisation.commentaire.login) return refus('decideur-different');
  if (typeof montant !== 'string' || montant.trim() !== '0') return refus('montant-different-de-0');
  if (typeof motif !== 'string' || motif.trim() === '') return refus('motif-absent');
  const c = autorisation.commentaire;
  const { empreinte: empreintePreuve, ...contenuPreuve } = preuve;
  const regularisation = {
    protocole: PROTOCOLE_REGULARISATION, nature: 'preuve-finale', cout: 0,
    run: { id: preuve.run.id, run_attempt: 1, head_sha: preuve.run.head_sha },
    j3_empreinte_texte: hacherSha256(preuve.j3),
    constat_final: { ...cp.constat },
    preuve: { empreinte: empreintePreuve, contenu: structuredClone(contenuPreuve) },
    identite: {
      declaree: decideur.trim(),
      approbation_v2: { user_id: cp.v2.user_id, login: cp.v2.login, etat: 'approved', environnement: ENVIRONNEMENT, source: 'api-github-lue-par-claude' },
      autorisation: {
        source: SOURCE_N2, bloc_empreinte: autorisation.empreinte, depot: autorisation.depot, issue: c.issue, comment_id: c.id, url: c.url,
        user_id: c.user_id, login: c.login, association: c.association, cree_le: c.cree_le, modifie_le: c.modifie_le, lu_le: autorisation.lu_le,
        texte: c.texte, texte_empreinte: hacherSha256(c.texte), modifiable_sur_github: true,
      },
    },
  };
  return { regularisation: geler(regularisation), faits_auto: preuve.j3, faits_auto_empreinte: cp.j3.empreinte, constat: cp.constat };
}

// Réutilisations dans UN journal AT-1 : empreintes de preuve et commentaires N2 déjà cités par une régularisation (refus de réemploi).
export function regularisationsDuJournal(journal) {
  const l = Array.isArray(journal) ? journal.filter((ev) => estObjet(ev) && estObjet(ev.donnees) && estObjet(ev.donnees.regularisation)) : [];
  const r = l.map((ev) => ev.donnees.regularisation);
  return {
    preuves: r.map((x) => (estObjet(x.preuve) ? x.preuve.empreinte : null)).filter((x) => typeof x === 'string'),
    commentaires: r.map((x) => (estObjet(x.identite) && estObjet(x.identite.autorisation) ? x.identite.autorisation.comment_id : null)).filter((x) => typeof x === 'string'),
  };
}
// === FIN_ATELIER_RETOUR ===
