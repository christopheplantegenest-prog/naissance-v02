// === DEBUT_ATELIER_AUTO ===
// v0.65.9 — AT-8.1 « AUTO À BLANC » (GO « AT-8.1 — GO IMPLÉMENTATION À BLANC », 18/10/2026 ; D-007).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Module PUR du chemin AUTO à blanc : identité T, demande AUTO, garde (J1),
// frontière (J2), faits AUTO. AUCUN APPEL : ce module ne contient, n'importe et ne prépare aucun code réseau ; il ne lit aucun secret.
// IDENTITÉ T = « <chantier>/<jalon>/<numero> » : chantier et jalon en minuscules, chiffres et tirets (40 au plus), numero entier 1..999
// (rang AT-1 de la tentative). T est la SEULE autorité d'identité : tentative AT-1, engagement AT-2 (execution = T), demande AUTO,
// nom du run (« atelier-auto T »), groupe de concurrence (« atelier-auto/T »), garde et faits. Le run_id n'est qu'un témoin.
// GARANTIE ACCEPTÉE (AT-8.1 et témoin AT-8.2 seulement) : tant que l'historique GitHub Actions nécessaire est présent et dans la
// fenêtre de fraîcheur, au plus une PREMIÈRE exécution pour T franchit la garde et atteint la frontière. Une exécution incertaine
// n'est jamais réémise ; une nouvelle tentative exige une décision humaine et n+1. Ce n'est PAS « exactement une fois » : l'historique
// peut être effacé par un administrateur, il peut expirer, la session de Claude agit avec le compte de Christophe ; sans témoins,
// aucune garantie.
//   identiteT({ chantier, jalon, numero })   -> { t, chantier, jalon, numero } ou { raison }
//   nomRun(t), groupeConcurrence(t)          -> « atelier-auto <t> », « atelier-auto/<t> »
//   lireAppel(appel), estimationMax(appel)   -> appel lu ou { raison } ; borne en microdollars (arrondi vers le haut)
//   texteDemandeAuto(d), lireDemandeAuto(t)  -> demande atelier-auto-demande-1 (texte copié pour Claude) et sa relecture stricte
//   garder({ entrees, contexte, historique, journal })                  -> J1 : { autorise, raison, faits, texte }
//   frontiere({ entrees, contexte, journal, approbations, sonde })      -> J2 : { pret, raison, faits, texte }
//   lireFaitsAuto(texte)                     -> { faits } ou { raison } (atelier-auto-faits-1, empreinte vérifiée, appel_emis = false)
// Les raisons sont des CODES ASCII (faits copiables tels quels). Le coût réel d'AT-8.1 est 0 avec certitude : aucun chemin d'appel.
// PURETÉ : imports de l'atelier seulement ; aucune horloge (« maintenant » = date de création du run, fournie), aucun hasard, aucun
// état, aucune entrée/sortie, aucun réseau. Les dates sont lues par un lecteur ISO 8601 strict propre à ce module.

import { etatDe } from './chantier.js';
import { etatBudget } from './budget.js';
import { construireMission } from './mission.js';
import { hacherSha256 } from './empreinte.js';
import { canonique, lireEtatDurable } from './journal.js';
import { cleTentative } from './parcours.js';

export const PROTOCOLE_DEMANDE = 'atelier-auto-demande-1';
export const PROTOCOLE_FAITS = 'atelier-auto-faits-1';
export const ENVIRONNEMENT = 'atelier-auto';
export const REF_MAIN = 'refs/heads/main';
export const FRAICHEUR_MS = 7 * 24 * 3600 * 1000;
export const AVANCE_MS = 24 * 3600 * 1000;
export const BORNES_APPEL = Object.freeze({ max_tokens: 64000, entree_max: 200000, tarif: 1000000000 });

const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_NUMERO = /^[1-9][0-9]{0,2}$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_EMPREINTE = /^[0-9a-f]{64}$/;
const RE_MODELE = /^[a-z0-9]+([.-][a-z0-9]+)*$/;
const RE_RUN = /^[1-9][0-9]{0,19}$/;
const RE_DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.([0-9]{1,3}))?Z$/;
const CLES_APPEL = 'appels,entree_max,max_tokens,modele,tarif_entree,tarif_sortie';
const CLES_DEMANDE = Object.freeze(['protocole', 'chantier', 'jalon', 'numero', 'commit', 'empreinte']);
const CLES_FAITS = 'appel,appel_emis,empreinte,etape,etat,frontiere,protocole,provenance,raison,resultat,tentative';
const MESSAGE_SONDE = 'Resource not accessible by integration';

const estObjet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const idValide = (v) => typeof v === 'string' && v.length <= 40 && RE_ID.test(v);
const entierBorne = (v, max) => Number.isSafeInteger(v) && v >= 1 && v <= max;

function geler(v) {
  if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.freeze(v);
    for (const k of Object.keys(v)) geler(v[k]);
  }
  return v;
}

// ------------------------------------------------------------------------------------------------ identité T
export function identiteT({ chantier, jalon, numero } = {}) {
  if (!idValide(chantier) || !idValide(jalon)) return { raison: 'tentative-invalide' };
  let n = numero;
  if (typeof n === 'string') { if (!RE_NUMERO.test(n)) return { raison: 'tentative-invalide' }; n = Number(n); }
  if (!entierBorne(n, 999)) return { raison: 'tentative-invalide' };
  return geler({ t: `${chantier}/${jalon}/${n}`, chantier, jalon, numero: n });
}
export const nomRun = (t) => `atelier-auto ${t}`;
export const groupeConcurrence = (t) => `atelier-auto/${t}`;

// ------------------------------------------------------------------------------------------------ appel prévu et borne
// L'appel prévu est écrit dans le lancement AT-1 : modèle (libellé), plafonds de jetons, tarifs PLAFONDS retenus (microdollars par
// million de jetons), appels autorisés = 1. Rien n'est appelé ici : ce sont les bornes de l'engagement AT-2.
export function lireAppel(a) {
  if (!estObjet(a) || Object.keys(a).sort().join(',') !== CLES_APPEL) return { raison: 'appel-invalide' };
  if (a.appels !== 1) return { raison: 'appels-different-de-1' };
  if (typeof a.modele !== 'string' || a.modele.length > 64 || !RE_MODELE.test(a.modele)) return { raison: 'appel-invalide' };
  if (!entierBorne(a.max_tokens, BORNES_APPEL.max_tokens) || !entierBorne(a.entree_max, BORNES_APPEL.entree_max)) return { raison: 'appel-invalide' };
  if (!entierBorne(a.tarif_entree, BORNES_APPEL.tarif) || !entierBorne(a.tarif_sortie, BORNES_APPEL.tarif)) return { raison: 'appel-invalide' };
  return geler({ ...a });
}
// Division par un million arrondie vers le haut, en entiers exacts (produits <= 2e14, sous les entiers sûrs).
const parMillionHaut = (x) => (x - (x % 1000000)) / 1000000 + (x % 1000000 === 0 ? 0 : 1);
export function estimationMax(appel) {
  const a = lireAppel(appel);
  if (a.raison) throw new TypeError(`estimationMax : ${a.raison}.`);
  return parMillionHaut(a.entree_max * a.tarif_entree) + parMillionHaut(a.max_tokens * a.tarif_sortie);
}

// ------------------------------------------------------------------------------------------------ demande AUTO
export function texteDemandeAuto({ chantier, jalon, numero, commit, empreinte } = {}) {
  const id = identiteT({ chantier, jalon, numero });
  if (id.raison || !RE_SHA.test(commit || '') || !RE_EMPREINTE.test(empreinte || '')) throw new TypeError('texteDemandeAuto : T, commit (40) et empreinte (64) attendus.');
  const v = { protocole: PROTOCOLE_DEMANDE, chantier, jalon, numero: String(id.numero), commit, empreinte };
  return [
    'DEMANDE AUTO À BLANC — ATELIER (OUTILLAGE NON COGNITIF) — AT-8.1',
    'Ce collage autorise UNIQUEMENT UN déclenchement du workflow « Atelier — AUTO à blanc » (atelier-auto.yml), depuis main, avec exactement ces valeurs.',
    'Il n\'autorise aucune relance, aucun second déclenchement, aucun appel de modèle, aucun secret, aucune branche, aucun push, rien sur main, aucun tag, aucun dépôt.',
    'Une exécution incertaine n\'est jamais réémise : une nouvelle tentative exige ta décision et le numéro suivant.',
    '',
    ...CLES_DEMANDE.map((k) => `${k} = ${v[k]}`),
    '',
  ].join('\n');
}
// Relecture stricte : chaque clé exactement une fois, valeurs validées ; les lignes d'en-tête ne portent aucune valeur.
export function lireDemandeAuto(texte) {
  if (typeof texte !== 'string') return { raison: 'demande absente' };
  const v = {};
  for (const ligne of texte.split('\n')) {
    const m = /^([a-z]+) = (.*)$/.exec(ligne);
    if (!m || !CLES_DEMANDE.includes(m[1])) continue;
    if (Object.hasOwn(v, m[1])) return { raison: `clé « ${m[1]} » en double` };
    v[m[1]] = m[2];
  }
  for (const k of CLES_DEMANDE) if (!Object.hasOwn(v, k)) return { raison: `clé « ${k} » absente` };
  if (v.protocole !== PROTOCOLE_DEMANDE) return { raison: 'protocole inconnu' };
  const id = identiteT(v);
  if (id.raison) return { raison: id.raison };
  if (v.numero !== String(id.numero) || !RE_SHA.test(v.commit) || !RE_EMPREINTE.test(v.empreinte)) return { raison: 'demande-invalide' };
  return { demande: geler({ ...id, commit: v.commit, empreinte: v.empreinte }) };
}

// ------------------------------------------------------------------------------------------------ dates (ISO 8601 UTC strict)
const bissextile = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const JOURS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// Jours depuis le 1970-01-01 du calendrier grégorien proleptique (algorithme « days from civil »).
function joursDepuis1970(a, m, j) {
  const y = m <= 2 ? a - 1 : a;
  const ere = Math.floor(y / 400);
  const ae = y - ere * 400;
  const aj = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + j - 1;
  return ere * 146097 + ae * 365 + Math.floor(ae / 4) - Math.floor(ae / 100) + aj - 719468;
}
export function millisecondes(texte) {
  const r = typeof texte === 'string' ? RE_DATE.exec(texte) : null;
  if (!r) return null;
  const [a, m, j, h, mi, s] = r.slice(1, 7).map(Number);
  const ms = r[7] === undefined ? 0 : Number(r[7].padEnd(3, '0'));
  if (m < 1 || m > 12 || j < 1 || j > (m === 2 && bissextile(a) ? 29 : JOURS[m - 1]) || h > 23 || mi > 59 || s > 59) return null;
  return ((joursDepuis1970(a, m, j) * 24 + h) * 60 + mi) * 60000 + s * 1000 + ms;
}

// ------------------------------------------------------------------------------------------------ faits AUTO
function ecrireFaits(sans) {
  const faits = { ...sans, empreinte: hacherSha256(canonique(sans)) };
  return { faits: geler(faits), texte: canonique(faits) };
}
export function lireFaitsAuto(texte) {
  if (typeof texte !== 'string' || texte === '') return { raison: 'faits absents' };
  const t = texte.endsWith('\n') ? texte : `${texte}\n`;
  let f;
  try { f = JSON.parse(t); } catch { return { raison: 'JSON illisible (tronqué ?)' }; }
  if (canonique(f) !== t) return { raison: 'forme non canonique (copie altérée ?)' };
  if (!estObjet(f) || Object.keys(f).sort().join(',') !== CLES_FAITS) return { raison: 'clés des faits inattendues' };
  if (f.protocole !== PROTOCOLE_FAITS) return { raison: 'protocole inconnu' };
  const { empreinte, ...sans } = f;
  if (hacherSha256(canonique(sans)) !== empreinte) return { raison: 'empreinte : ne correspond pas au contenu' };
  if (f.appel_emis !== false) return { raison: 'appel-emis' };
  if (!['garde', 'frontiere'].includes(f.etape) || !['autorise', 'refus', 'pret-a-appeler', 'arret'].includes(f.resultat)) return { raison: 'étape ou résultat inconnu' };
  if (f.tentative !== null) {
    const p = typeof f.tentative === 'string' ? f.tentative.split('/') : [];
    if (p.length !== 3 || identiteT({ chantier: p[0], jalon: p[1], numero: p[2] }).t !== f.tentative) return { raison: 'tentative illisible' };
  }
  return { faits: geler(f) };
}

// ------------------------------------------------------------------------------------------------ contrôles communs (J1 et J2)
const refus = (raison, extra = {}) => ({ raison, ...extra });

// Entrées du déclenchement et contexte du run : T, commit, empreinte, ref main, premier essai.
function controlerEntrees(entrees, contexte) {
  const id = identiteT(entrees || {});
  if (id.raison) return refus(id.raison);
  if (!RE_SHA.test(entrees.commit || '') || !RE_EMPREINTE.test(entrees.empreinte || '')) return refus('demande-invalide', { id });
  if (!estObjet(contexte) || !RE_RUN.test(contexte.run_id || '')) return refus('contexte-invalide', { id });
  if (contexte.ref !== REF_MAIN) return refus('ref-non-main', { id });
  if (contexte.run_attempt !== '1') return refus('essai-different-de-1', { id });
  return { id };
}

// État durable : tête ACTUELLE de journal-atelier/<chantier> = commit demandé, empreinte exacte, lecture complète (journal.js),
// tentative T lancée en AUTO et toujours vivante, appel prévu valide, engagement AT-2 ouvert à la hauteur de l'estimation.
function controlerEtat(id, entrees, journal, maintenant) {
  if (!estObjet(journal) || journal.tete === null || journal.texte === null) return refus('journal-absent');
  if (journal.tete !== entrees.commit) return refus('commit-different-de-la-tete');
  if (hacherSha256(journal.texte) !== entrees.empreinte) return refus('empreinte-differente');
  const lu = lireEtatDurable(journal.texte);
  if (lu.raison) return refus('etat-illisible');
  if (lu.durable.chantier !== id.chantier) return refus('chantier-different');
  const ev = lancementDe(lu.durable.journal, id);
  if (!ev) return refus('tentative-absente');
  if (ev.donnees.mode !== 'AUTO') return refus('tentative-non-auto');
  const etat = etatDe(lu.durable.journal);
  const j = etat.plan.find((x) => x.id === id.jalon);
  if (etat.statut !== 'en-cours' || !j || j.tentatives[id.numero - 1].statut !== 'lancee') return refus('tentative-close');
  const piece = Object.hasOwn(lu.lues, cleTentative(id.jalon, id.numero)) ? lu.lues[cleTentative(id.jalon, id.numero)] : null;
  if (!piece) return refus('piece-absente');
  const appel = lireAppel(ev.donnees.appel);
  if (appel.raison) return refus(appel.raison);
  const estimation = estimationMax(appel);
  const resume = { ...appel, estimation, engagement: null };
  const quand = millisecondes(ev.quand);
  if (maintenant !== undefined) {
    const t = millisecondes(maintenant);
    if (quand === null || t === null) return refus('date-illisible', { appel: resume });
    if (t - quand > FRAICHEUR_MS) return refus('demande-perimee', { appel: resume });
    if (quand - t > AVANCE_MS) return refus('date-future', { appel: resume });
  }
  if (lu.durable.registre === null) return refus('registre-absent', { appel: resume });
  const b = etatBudget(lu.durable.registre);
  if (b.suspendu) return refus('registre-suspendu', { appel: resume });
  const x = Object.hasOwn(b.executions, id.t) ? b.executions[id.t] : null;
  if (!x) return refus('engagement-absent', { appel: resume });
  resume.engagement = x.maximum;
  if (x.chantier !== id.chantier) return refus('engagement-autre-chantier', { appel: resume });
  if (x.statut !== 'engagee') return refus('engagement-solde', { appel: resume });
  if (x.cycle !== b.cycle) return refus('engagement-autre-cycle', { appel: resume });
  if (x.maximum < estimation) return refus('engagement-insuffisant', { appel: resume });
  const c = Object.hasOwn(b.chantiers, id.chantier) ? b.chantiers[id.chantier] : null;
  if (!c) return refus('plafond-chantier-absent', { appel: resume });
  if (x.maximum > b.plafondRun) return refus('budget-run-depasse', { appel: resume });
  if (b.consommeCycle + b.engageCycle > b.utilisable) return refus('budget-cycle-depasse', { appel: resume });
  if (c.consomme + c.engage > c.plafond) return refus('budget-chantier-depasse', { appel: resume });
  return { appel: resume, piece };
}

// Événement « tentative-lancee » de rang « numero » pour le jalon (même numérotation que chantier.js).
function lancementDe(journal, id) {
  let rang = 0;
  for (const ev of journal) {
    if (ev.type !== 'tentative-lancee' || ev.donnees.jalon !== id.jalon) continue;
    rang += 1;
    if (rang === id.numero) return ev;
  }
  return null;
}

// Historique des runs du workflow (témoin technique) : complet, contenant ce run sous le nom exact de T, sans run antérieur pour T.
function controlerHistorique(id, contexte, historique) {
  if (!estObjet(historique) || !Number.isSafeInteger(historique.total) || historique.total < 0 || !Array.isArray(historique.runs)) return refus('historique-illisible');
  const runs = new Map();
  for (const r of historique.runs) {
    if (!estObjet(r) || !Number.isSafeInteger(r.id) || r.id < 1 || typeof r.display_title !== 'string') return refus('historique-illisible');
    runs.set(r.id, r);
  }
  if (runs.size < historique.total) return refus('historique-incomplet');
  const moi = runs.get(Number(contexte.run_id));
  if (!moi) return refus('historique-incomplet');
  if (moi.display_title !== nomRun(id.t)) return refus('nom-de-run-different');
  for (const r of runs.values()) if (r.display_title === nomRun(id.t) && r.id < moi.id) return refus('execution-anterieure');
  return { maintenant: moi.created_at };
}

function provenanceDe(contexte) {
  const c = estObjet(contexte) ? contexte : {};
  const texte = (v) => (typeof v === 'string' ? v : null);
  return { ref: texte(c.ref), run_attempt: texte(c.run_attempt), run_id: texte(c.run_id), workflow_sha: texte(c.workflow_sha) };
}
const etatCite = (entrees) => ({ commit: RE_SHA.test(entrees?.commit || '') ? entrees.commit : null, empreinte: RE_EMPREINTE.test(entrees?.empreinte || '') ? entrees.empreinte : null });

// ------------------------------------------------------------------------------------------------ J1 : garde
export function garder({ entrees, contexte, historique, journal } = {}) {
  const base = { protocole: PROTOCOLE_FAITS, etape: 'garde', appel_emis: false, provenance: provenanceDe(contexte), etat: etatCite(entrees), frontiere: null };
  const fin = (raison, id, appel) => {
    const r = ecrireFaits({ ...base, tentative: id ? id.t : null, resultat: raison ? 'refus' : 'autorise', raison, appel: appel || null });
    return { autorise: !raison, raison, ...r };
  };
  const e = controlerEntrees(entrees, contexte);
  if (e.raison) return fin(e.raison, e.id);
  const h = controlerHistorique(e.id, contexte, historique);
  if (h.raison) return fin(h.raison, e.id);
  const s = controlerEtat(e.id, entrees, journal, typeof h.maintenant === 'string' ? h.maintenant : '');
  if (s.raison) return fin(s.raison, e.id, s.appel);
  return fin(null, e.id, s.appel);
}

// ------------------------------------------------------------------------------------------------ J2 : frontière
// Approbation de l'environnement atelier-auto pour CE run ; sonde d'écriture refusée (403, intégration sans droit) ; dossier exact.
export function lireSonde(sonde) {
  if (!estObjet(sonde) || !Number.isInteger(sonde.code) || typeof sonde.sortie !== 'string') return { statut: null, conforme: false };
  const m = /HTTP\/[0-9.]+ ([0-9]{3})/.exec(sonde.sortie) || /\(HTTP ([0-9]{3})\)/.exec(sonde.sortie);
  const statut = m ? Number(m[1]) : null;
  return { statut: statut, conforme: sonde.code !== 0 && statut === 403 && sonde.sortie.includes(MESSAGE_SONDE) };
}
function lireApprobation(approbations) {
  if (!Array.isArray(approbations)) return { raison: 'approbation-illisible' };
  const pour = approbations.filter((a) => estObjet(a) && Array.isArray(a.environments) && a.environments.some((x) => estObjet(x) && x.name === ENVIRONNEMENT));
  if (pour.some((a) => a.state !== 'approved')) return { raison: 'approbation-refusee' };
  const a = pour.find((x) => x.state === 'approved');
  if (!a) return { raison: 'approbation-absente' };
  return { approbation: { etat: 'approved', login: estObjet(a.user) && typeof a.user.login === 'string' ? a.user.login : null } };
}

export function frontiere({ entrees, contexte, journal, approbations, sonde } = {}) {
  const base = { protocole: PROTOCOLE_FAITS, etape: 'frontiere', appel_emis: false, provenance: provenanceDe(contexte), etat: etatCite(entrees) };
  const fin = (raison, id, appel, front) => {
    const r = ecrireFaits({ ...base, tentative: id ? id.t : null, resultat: raison ? 'arret' : 'pret-a-appeler', raison, appel: appel || null, frontiere: front || null });
    return { pret: !raison, raison, ...r };
  };
  const e = controlerEntrees(entrees, contexte);
  if (e.raison) return fin(e.raison, e.id);
  const s = controlerEtat(e.id, entrees, journal);
  if (s.raison) return fin(s.raison, e.id, s.appel);
  const ap = lireApprobation(approbations);
  const so = lireSonde(sonde);
  const dossier = construireMission(s.piece.mission);
  const front = { approbation: ap.approbation || null, sonde: so, dossier_empreinte: hacherSha256(dossier), dossier_octets: octets(dossier) };
  if (ap.raison) return fin(ap.raison, e.id, s.appel, front);
  if (!so.conforme) return fin(so.statut !== null && so.statut >= 200 && so.statut < 300 ? 'sonde-ecriture-acceptee' : 'sonde-non-conforme', e.id, s.appel, front);
  return fin(null, e.id, s.appel, front);
}

function octets(s) {
  let n = 0;
  for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}
// === FIN_ATELIER_AUTO ===
