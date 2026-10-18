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
// v0.65.10 — AT-8.2 « TÉMOIN À BLANC » (GO « AT-8.2 — GO IMPLÉMENTATION À BLANC », 18/10/2026 ; D-007). Une tentative AUTO peut porter
// un TÉMOIN { jeton (128 bits, 32 hexadécimaux), tarif_entree, tarif_sortie (tarifs CONSTATÉS, <= plafonds) } : elle prépare alors UN
// appel minimal (texte fixe + jeton, aucun outil, aucun système, réflexion désactivée, aucun flux). Ce module reste PUR et sans réseau :
// il construit le corps, classe ce que l'outil réseau (outils-atelier/auto-appel.mjs, seul fichier réseau) a observé, calcule le coût
// et décide de la clôture. TROIS ISSUES, jamais confondues :
//   non-emis        le point d'émission n'a pas été franchi (refus avant) : coût 0 permis
//   reponse-connue  réponse HTTP 200 complète, JSON lisible, modèle demandé, usage lisible dans les bornes : coût calculé (usage x tarifs)
//   issue-inconnue  TOUT le reste après le point d'émission : coût 0 INTERDIT, engagement laissé ouvert, aucune relance, régularisation
//                   humaine obligatoire (montant > 0 saisi par Christophe)
//   preparerAppel(...)                     -> frontière J2 + témoin + corps exact, ou non-emis avec sa raison
//   classerObservation(obs, prep)          -> { issue, raison, reponse, cout } (après le point d'émission seulement)
//   faitsAppel(...), constater(...)        -> faits atelier-auto-faits-2 de l'étape « appel » (J2) et « constat » (J3)
//   decisionCloture({ faits, t, temoin })  -> { issue, montant } (montant null pour issue-inconnue) ou { raison }
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
// AT-8.2 : témoin, faits de l'appel et du constat.
export const PROTOCOLE_FAITS_TEMOIN = 'atelier-auto-faits-2';
export const ISSUES = Object.freeze(['non-emis', 'reponse-connue', 'issue-inconnue']);
export const BORNES_TEMOIN = Object.freeze({ max_tokens: 64, entree_min: 1000, corps_octets: 600, reponse_octets: 1048576, delai_ms: 60000 });
// Noms EXACTS des jobs et de l'étape d'appel dans atelier-auto.yml (le constat J3 les lit dans l'API des jobs).
export const NOMS_RUN = Object.freeze({ garde: 'J1 garde', appel: 'J2 frontière et appel', etape: 'Appel (une seule requête)' });
const RE_JETON = /^[0-9a-f]{32}$/;
const RE_REQUETE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const RE_TYPE_ERREUR = /^[a-z_]{1,64}$/;
const CLES_TEMOIN = 'jeton,tarif_entree,tarif_sortie';
const CLES_FAITS_TEMOIN = 'appel_emis,constat,cout,emission,empreinte,etape,etat,issue,protocole,provenance,raison,reponse,requete,tentative';
// Refus J1 établis APRÈS le contrôle de l'historique : le run refusé est donc le PREMIER run de T, et rien n'a été émis pour T.
const RAISONS_ETAT = new Set(['journal-absent', 'commit-different-de-la-tete', 'empreinte-differente', 'etat-illisible', 'chantier-different', 'tentative-absente',
  'tentative-non-auto', 'tentative-close', 'piece-absente', 'appel-invalide', 'appels-different-de-1', 'temoin-invalide', 'temoin-hors-bornes', 'date-illisible',
  'demande-perimee', 'date-future', 'registre-absent', 'registre-suspendu', 'engagement-absent', 'engagement-autre-chantier', 'engagement-solde',
  'engagement-autre-cycle', 'engagement-insuffisant', 'plafond-chantier-absent', 'budget-run-depasse', 'budget-cycle-depasse', 'budget-chantier-depasse']);

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

// ------------------------------------------------------------------------------------------------ témoin (AT-8.2)
// Témoin écrit dans le lancement AT-1 : jeton (relie la demande et la réponse, il n'est pas secret) et tarifs CONSTATÉS le jour du
// témoin (microdollars par million de jetons), au plus égaux aux plafonds de l'appel prévu ; l'appel prévu reste dans les bornes du
// témoin (sortie <= 64 jetons ; entrée maximale >= 1000 jetons, au-dessus de tout corps admis de 600 octets).
export function lireTemoin(temoin, appel) {
  const a = lireAppel(appel);
  if (a.raison) return { raison: a.raison };
  if (!estObjet(temoin) || Object.keys(temoin).sort().join(',') !== CLES_TEMOIN || typeof temoin.jeton !== 'string' || !RE_JETON.test(temoin.jeton)) return { raison: 'temoin-invalide' };
  if (!entierBorne(temoin.tarif_entree, a.tarif_entree) || !entierBorne(temoin.tarif_sortie, a.tarif_sortie)) return { raison: 'temoin-invalide' };
  if (a.max_tokens > BORNES_TEMOIN.max_tokens || a.entree_max < BORNES_TEMOIN.entree_min) return { raison: 'temoin-hors-bornes' };
  return geler({ ...temoin });
}
export const reponseAttendue = (jeton) => `ATELIER-TEMOIN-OK ${jeton}`;
export const texteTemoin = (jeton) => `Reply with exactly this line and nothing else: ${reponseAttendue(jeton)}`;
// Corps EXACT de l'unique requête : modèle, plafond de sortie, réflexion désactivée, un seul message utilisateur (texte fixe + jeton).
// Ni système, ni outil, ni flux, ni cache, ni métadonnées, ni aucune donnée du chantier.
export function corpsTemoin(appel, temoin) {
  const t = lireTemoin(temoin, appel);
  if (t.raison) throw new TypeError(`corpsTemoin : ${t.raison}.`);
  const corps = JSON.stringify({ model: appel.modele, max_tokens: appel.max_tokens, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: texteTemoin(t.jeton) }] });
  return geler({ corps, octets: octets(corps), empreinte: hacherSha256(corps) });
}
// Coût d'une réponse connue : usage lisible (entier >= 0), sans cache (aucun n'est demandé), dans les bornes de l'appel ; tarifs du témoin.
export function coutReel(usage, appel, temoin) {
  if (!estObjet(usage)) return { raison: 'usage-absent' };
  const n = (v) => Number.isSafeInteger(v) && v >= 0;
  if (!n(usage.input_tokens) || !n(usage.output_tokens)) return { raison: 'usage-invalide' };
  for (const k of ['cache_creation_input_tokens', 'cache_read_input_tokens']) if (usage[k] !== undefined && usage[k] !== null && usage[k] !== 0) return { raison: 'usage-cache-inattendu' };
  if (usage.input_tokens > appel.entree_max || usage.output_tokens > appel.max_tokens) return { raison: 'usage-hors-bornes' };
  return geler({ entree: usage.input_tokens, sortie: usage.output_tokens, montant: parMillionHaut(usage.input_tokens * temoin.tarif_entree) + parMillionHaut(usage.output_tokens * temoin.tarif_sortie) });
}

// ------------------------------------------------------------------------------------------------ demande AUTO
// AT-8.2 : « temoin » vrai pour une tentative portant un témoin : la portée nomme alors l'UNIQUE requête possible (mêmes lignes de valeurs).
export function texteDemandeAuto({ chantier, jalon, numero, commit, empreinte, temoin = false } = {}) {
  const id = identiteT({ chantier, jalon, numero });
  if (id.raison || !RE_SHA.test(commit || '') || !RE_EMPREINTE.test(empreinte || '')) throw new TypeError('texteDemandeAuto : T, commit (40) et empreinte (64) attendus.');
  const v = { protocole: PROTOCOLE_DEMANDE, chantier, jalon, numero: String(id.numero), commit, empreinte };
  if (temoin === true) return [
    'DEMANDE AUTO AVEC TÉMOIN RÉEL — ATELIER (OUTILLAGE NON COGNITIF) — AT-8.2',
    'Ce collage autorise UNIQUEMENT UN déclenchement du workflow AUTO (atelier-auto.yml), depuis main, avec exactement ces valeurs.',
    'Après l\'approbation de Christophe, et seulement si la clé existe, ce run fait UNE requête de témoin au plus (aucun outil, aucune donnée du chantier).',
    'Il n\'autorise aucune relance, aucun second déclenchement, aucune approbation par Claude, aucun secret lu, aucune branche, aucun push, rien sur main, aucun tag, aucun dépôt.',
    'Une issue inconnue n\'est jamais réémise : elle reste engagée jusqu\'à la régularisation humaine.',
    '',
    ...CLES_DEMANDE.map((k) => `${k} = ${v[k]}`),
    '',
  ].join('\n');
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
  if (estObjet(f) && f.protocole === PROTOCOLE_FAITS_TEMOIN) return lireFaitsTemoin(f);
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
// Faits atelier-auto-faits-2 (étapes « appel » et « constat ») : clés exactes, empreinte, issue cohérente avec l'émission et le coût.
function lireFaitsTemoin(f) {
  if (Object.keys(f).sort().join(',') !== CLES_FAITS_TEMOIN) return { raison: 'clés des faits inattendues' };
  const { empreinte, ...sans } = f;
  if (hacherSha256(canonique(sans)) !== empreinte) return { raison: 'empreinte : ne correspond pas au contenu' };
  if (!['appel', 'constat'].includes(f.etape)) return { raison: 'étape ou résultat inconnu' };
  if (f.issue !== null && !ISSUES.includes(f.issue)) return { raison: 'issue inconnue' };
  if (f.issue === null && f.etape !== 'constat') return { raison: 'issue absente' };
  if (f.issue === 'non-emis' && (f.appel_emis !== false || f.cout !== null || f.reponse !== null)) return { raison: 'issue-incoherente' };
  if (f.issue === 'reponse-connue' && (f.etape !== 'appel' || f.appel_emis !== true || !estObjet(f.cout) || !Number.isSafeInteger(f.cout.montant) || f.cout.montant < 0 || !estObjet(f.reponse))) return { raison: 'issue-incoherente' };
  if (f.issue === 'issue-inconnue' && (f.cout !== null || f.appel_emis === false)) return { raison: 'issue-incoherente' };
  const p = typeof f.tentative === 'string' ? f.tentative.split('/') : [];
  if (f.tentative !== null && (p.length !== 3 || identiteT({ chantier: p[0], jalon: p[1], numero: p[2] }).t !== f.tentative)) return { raison: 'tentative illisible' };
  if (!estObjet(f.provenance)) return { raison: 'provenance illisible' };
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
  if (Object.hasOwn(ev.donnees, 'temoin')) { const tm = lireTemoin(ev.donnees.temoin, appel); if (tm.raison) return refus(tm.raison); }
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
  return { appel: resume, piece, ev };
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

// ------------------------------------------------------------------------------------------------ AT-8.2 : appel, constat, clôture
// Préparation de l'UNIQUE requête (job J2, après la frontière) : la frontière doit être PRÊTE, la tentative doit porter un témoin
// valide, le corps doit tenir dans 600 octets. Tout refus ici est AVANT le point d'émission : issue non-emis, avec sa raison.
export function preparerAppel(args = {}) {
  const f = frontiere(args);
  const e = controlerEntrees(args.entrees, args.contexte);
  const id = e.id || null;
  if (!f.pret) return geler({ emettre: false, raison: f.raison, id });
  const s = controlerEtat(e.id, args.entrees, args.journal);
  if (s.raison) return geler({ emettre: false, raison: s.raison, id });
  if (!Object.hasOwn(s.ev.donnees, 'temoin')) return geler({ emettre: false, raison: 'temoin-absent', id });
  const appel = lireAppel(s.ev.donnees.appel);
  const temoin = lireTemoin(s.ev.donnees.temoin, appel);
  if (temoin.raison) return geler({ emettre: false, raison: temoin.raison, id });
  const c = corpsTemoin(appel, temoin);
  if (c.octets > BORNES_TEMOIN.corps_octets) return geler({ emettre: false, raison: 'corps-hors-bornes', id });
  return geler({ emettre: true, raison: null, id, appel, temoin, corps: c.corps, requete: { modele: appel.modele, max_tokens: appel.max_tokens, corps_octets: c.octets, corps_empreinte: c.empreinte } });
}

// Classement de ce que l'outil réseau a observé APRÈS le point d'émission. Par défaut : issue-inconnue. reponse-connue exige TOUT :
// pas d'échec de transport, statut 200, corps complet, JSON lisible, message assistant, modèle demandé, usage lisible dans les bornes.
// Une erreur HTTP lisible reste issue-inconnue : son statut, son type et son identifiant sont connus, son coût ne l'est pas.
export function classerObservation(obs, prep) {
  const inconnue = (raison, reponse = null) => geler({ issue: 'issue-inconnue', raison, reponse, cout: null });
  if (!estObjet(obs) || !estObjet(prep) || prep.emettre !== true) return inconnue('observation-illisible');
  const statut = Number.isInteger(obs.statut) && obs.statut >= 100 && obs.statut <= 599 ? obs.statut : null;
  const rid = typeof obs.request_id === 'string' && RE_REQUETE_ID.test(obs.request_id) ? obs.request_id : null;
  const reponse = { statut, request_id: rid, type_erreur: null, modele: null, stop_reason: null, usage: null, texte_octets: null, texte_empreinte: null, temoin_conforme: false };
  const vue = () => (statut === null ? null : reponse);
  if (obs.echec !== null && obs.echec !== undefined) return inconnue(idValide(obs.echec) ? obs.echec : 'echec-transport', vue());
  if (statut === null || obs.complet !== true || typeof obs.corps !== 'string') return inconnue('reponse-tronquee', vue());
  let m;
  try { m = JSON.parse(obs.corps); } catch { return inconnue('json-illisible', reponse); }
  if (!estObjet(m)) return inconnue('json-illisible', reponse);
  if (reponse.request_id === null && typeof m.request_id === 'string' && RE_REQUETE_ID.test(m.request_id)) reponse.request_id = m.request_id;
  if (statut !== 200) {
    if (estObjet(m.error) && typeof m.error.type === 'string' && RE_TYPE_ERREUR.test(m.error.type)) reponse.type_erreur = m.error.type;
    return inconnue('erreur-http', reponse);
  }
  if (m.type !== 'message' || m.role !== 'assistant' || !Array.isArray(m.content)) return inconnue('message-invalide', reponse);
  reponse.modele = typeof m.model === 'string' && m.model.length <= 64 && RE_MODELE.test(m.model) ? m.model : null;
  reponse.stop_reason = typeof m.stop_reason === 'string' && RE_TYPE_ERREUR.test(m.stop_reason) ? m.stop_reason : null;
  if (reponse.modele !== prep.appel.modele) return inconnue('modele-different', reponse);
  const cout = coutReel(m.usage, prep.appel, prep.temoin);
  if (cout.raison) return inconnue(cout.raison, reponse);
  const texte = m.content.filter((b) => estObjet(b) && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
  reponse.usage = { entree: cout.entree, sortie: cout.sortie };
  reponse.texte_octets = octets(texte);
  reponse.texte_empreinte = hacherSha256(texte);
  reponse.temoin_conforme = texte.trim() === reponseAttendue(prep.temoin.jeton) && reponse.stop_reason === 'end_turn';
  return geler({ issue: 'reponse-connue', raison: reponse.temoin_conforme ? null : 'temoin-non-conforme', reponse, cout: { montant: cout.montant, tarif_entree: prep.temoin.tarif_entree, tarif_sortie: prep.temoin.tarif_sortie } });
}

// Faits de l'étape « appel ». INVARIANT : point d'émission franchi => jamais non-emis ; non franchi => non-emis, sans réponse ni coût.
export function faitsAppel({ entrees, contexte, prep, emission, resultat } = {}) {
  const franchi = estObjet(emission) && emission.point_franchi === true;
  const id = estObjet(prep) && prep.id ? prep.id : (identiteT(entrees || {}).t ? identiteT(entrees || {}) : null);
  let r;
  if (!franchi) r = { issue: 'non-emis', raison: estObjet(resultat) && idValide(resultat.raison) ? resultat.raison : 'refus-avant-emission', reponse: null, cout: null };
  else if (estObjet(resultat) && resultat.issue === 'reponse-connue') r = resultat;
  else r = { issue: 'issue-inconnue', raison: estObjet(resultat) && idValide(resultat.raison) ? resultat.raison : 'issue-non-etablie', reponse: estObjet(resultat) && estObjet(resultat.reponse) ? resultat.reponse : null, cout: null };
  return ecrireFaits({
    protocole: PROTOCOLE_FAITS_TEMOIN, etape: 'appel', tentative: id ? id.t : null, provenance: provenanceDe(contexte), etat: etatCite(entrees),
    issue: r.issue, raison: r.raison, appel_emis: franchi, emission: { point_franchi: franchi, socket_connecte: franchi && emission.socket_connecte === true },
    requete: estObjet(prep) && estObjet(prep.requete) ? prep.requete : null, reponse: r.reponse, cout: r.cout, constat: null,
  });
}

// Constat J3 (autre runner, lecture des jobs de CE run, essai 1) : non-emis SEULEMENT si la garde J1 a réussi et si GitHub montre
// le job J2 sauté ou son étape d'appel sautée ; garde non franchie : sans objet (les faits J1 font foi) ; tout le reste : issue-inconnue.
export function constater({ entrees, contexte, jobs } = {}) {
  const e = controlerEntrees(entrees, contexte);
  const vu = { garde: null, appel: null, etape: null };
  const fin = (issue, raison) => ecrireFaits({
    protocole: PROTOCOLE_FAITS_TEMOIN, etape: 'constat', tentative: e.id ? e.id.t : null, provenance: provenanceDe(contexte), etat: etatCite(entrees),
    issue, raison, appel_emis: issue === 'non-emis' ? false : null, emission: null, requete: null, reponse: null, cout: null, constat: vu,
  });
  if (e.raison) return fin(null, e.raison);
  const texte = (v) => (typeof v === 'string' && v.length <= 32 && RE_ID.test(v) ? v : null);
  const lireJob = (j) => ({ status: texte(j.status), conclusion: texte(j.conclusion) });
  if (!Array.isArray(jobs) || jobs.some((j) => !estObjet(j) || typeof j.name !== 'string')) return fin('issue-inconnue', 'jobs-illisibles');
  const un = (nom) => { const l = jobs.filter((j) => j.name === nom); return l.length === 1 ? l[0] : null; };
  const g = un(NOMS_RUN.garde);
  if (!g) return fin('issue-inconnue', 'job-garde-absent');
  vu.garde = lireJob(g);
  if (vu.garde.status !== 'completed' || vu.garde.conclusion !== 'success') return fin(null, 'garde-non-franchie');
  const a = un(NOMS_RUN.appel);
  if (!a) return fin('issue-inconnue', 'job-appel-absent');
  vu.appel = lireJob(a);
  if (vu.appel.status === 'completed' && vu.appel.conclusion === 'skipped') return fin('non-emis', 'job-appel-saute');
  const etapes = Array.isArray(a.steps) ? a.steps.filter((x) => estObjet(x) && x.name === NOMS_RUN.etape) : [];
  if (etapes.length === 1) vu.etape = lireJob(etapes[0]);
  if (vu.appel.status === 'completed' && vu.etape && vu.etape.status === 'completed' && vu.etape.conclusion === 'skipped') return fin('non-emis', 'etape-appel-sautee');
  return fin('issue-inconnue', vu.etape && vu.etape.status === 'completed' && vu.etape.conclusion !== 'skipped' ? 'appel-execute-voir-faits-j2' : 'etat-appel-incertain');
}

// Clôture d'une tentative AUTO par des faits collés. Sans témoin (AT-8.1, aucun chemin d'appel) : tout fait lisible de T clôt à 0.
// Avec témoin : 0 seulement si les faits PROUVENT qu'aucune émission n'a eu lieu pour T (refus J1 établi après l'historique ; arrêt J2,
// appel non-emis ou constat non-emis du premier essai) ; coût calculé pour reponse-connue ; issue-inconnue : montant null (aucun coût
// inscrit, engagement ouvert). Faits intermédiaires (autorisé, prêt) ou d'un autre essai : refus.
export function decisionCloture({ faits, t, temoin } = {}) {
  if (!estObjet(faits) || faits.tentative !== t) return { raison: 'faits-autre-tentative' };
  // Premier essai d'un run de main : seul un tel run peut avoir franchi la garde de T (J2 et J3 ne tournent que sur main).
  const premier = estObjet(faits.provenance) && faits.provenance.run_attempt === '1' && faits.provenance.ref === REF_MAIN;
  if (faits.protocole === PROTOCOLE_FAITS) {
    if (!temoin) return { issue: 'non-emis', montant: 0 };
    if (faits.etape === 'garde' && faits.resultat === 'refus' && RAISONS_ETAT.has(faits.raison)) return { issue: 'non-emis', montant: 0 };
    if (faits.etape === 'frontiere' && faits.resultat === 'arret' && premier) return { issue: 'non-emis', montant: 0 };
    return { raison: 'faits-intermediaires' };
  }
  if (faits.protocole !== PROTOCOLE_FAITS_TEMOIN) return { raison: 'protocole inconnu' };
  if (!premier) return { raison: 'hors-premier-essai' };
  if (faits.issue === 'non-emis') return { issue: 'non-emis', montant: 0 };
  if (faits.issue === 'reponse-connue') return { issue: 'reponse-connue', montant: faits.cout.montant };
  if (faits.issue === 'issue-inconnue') return { issue: 'issue-inconnue', montant: null };
  return { raison: 'constat-sans-objet' };
}

function octets(s) {
  let n = 0;
  for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}
// === FIN_ATELIER_AUTO ===
