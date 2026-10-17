// === DEBUT_ATELIER_ECRAN ===
// v0.65.3 — AT-4 « ÉCRAN ATELIER OFF / MANUEL » (GO Christophe + ChatGPT « AUTORISATION AT-4 », 17/10/2026 ; D-007 ACTIVE).
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Seul module d'interface de l'atelier, et seul raccord des modules purs
// chantier.js (AT-1), budget.js (AT-2), mission.js (AT-3) et montants.js. Il ne connaît ni le moteur, ni la mémoire, ni aucune table.
//   monterAtelier({ zone, version, stockage, copier, maintenant }) -> { rafraichir }
// Chargé seulement au toucher « Atelier de développement » (import dynamique dans main.js) : rien ne s'exécute au démarrage.
// MODE (donnée d'interface, jamais transmise aux modules purs) : OFF au premier lancement = consultation seulement ; MANUEL = formulaire,
// ouverture / approbation / arrêt du chantier, ouverture du cycle et plafond du chantier, génération + copie du dossier, vérification
// de forme d'un rapport collé. AUTO n'existe pas. Aucun réseau, aucune API, aucun GitHub, dans aucun mode.
// COPIE DE TRAVAIL LOCALE JETABLE : une seule clé localStorage « naissance-ia.atelier.v1 » { version, mode, formulaire, fiches, journal,
// registre, mission }. Ni autorité Git, ni acquisition, ni table, ni reprise AT-7, jamais exportée. Relue avec verifierJournal / verifierRegistre :
// incohérente => déclarée illisible, rien n'est utilisé ni réparé ; seul « Effacer l'atelier de cet appareil » reste possible.
// Données SÉPARÉES : AT-1 garde id, objectif, base, jalons (titre, critere, tentativesMax) ; la fiche locale du jalon garde comportement,
// critères, tests, autorisés, interdits, frontières, décisions. Le dossier les compose explicitement ; AT-1 n'est pas réinterprété.
// Une vérification de rapport n'écrit RIEN : ni journal AT-1, ni registre AT-2, ni copie locale ; elle n'avance aucun état.
// v0.65.3 (correction avant dépôt) : « Générer » fige dans la copie locale l'INSTANTANÉ des données exactes du dossier (« mission ») ;
// « Vérifier la forme » contrôle le rapport contre CET instantané, jamais contre la fiche courante. Seul un nouveau « Générer » le remplace.
// v0.65.6 — AT-6 « MANUEL DE BOUT EN BOUT » (GO 17/10/2026 ; décision D-007 sur les autorisations manuelles) : parcours complet
// mission -> tentative -> rapport -> demande de vérification -> faits AT-5 -> verdict technique -> décision humaine -> clôture.
// Les étapes sont DÉRIVÉES (parcours.js) du journal AT-1 et des PIÈCES de chaque tentative, gardées dans la copie locale (version 2) :
// pieces["<jalon>/<n>"] = { mission (instantané exact lancé), rapport (texte exact enregistré), demande (copiée, figée), faits [textes AT-5] }.
// Le verdict technique est RECALCULÉ à chaque affichage (verification.js, confronter) et n'est jamais stocké comme une vérité ; la
// décision humaine est un événement AT-1 (motif obligatoire) qui cite l'empreinte des faits et le verdict observé au moment du geste.
// Tout geste persistant SAUVE D'ABORD (copie vérifiée entière, sinon rien n'est fait), effet externe (presse-papiers) ENSUITE.
// Une copie version 1 est lue comme un chantier sans pièces AT-6 (aucune pièce historique n'est inventée).

import { ouvrirChantier, appliquer, etatDe, verifierJournal } from './chantier.js';
import { ouvrirRegistre, appliquerBudget, etatBudget, verifierRegistre } from './budget.js';
import { construireMission, verifierRapport } from './mission.js';
import { lireUSD, ecrireUSD } from './montants.js';
import { lireFaits, confronter, lireDemande } from './verification.js';
import { cleTentative, etapeDe, proposerVersion, demandeDe, texteDemande, raisonPieces, tentativesDuJournal } from './parcours.js';
import { hacherSha256 } from './empreinte.js';

export const CLE_ATELIER = 'naissance-ia.atelier.v1';
const RE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const RE_SHA = /^[0-9a-f]{40}$/;
const RE_VERSION = /^(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})\.(0|[1-9]\d{0,3})$/;
const CHAMPS_FICHE = ['comportement', 'criteres', 'tests', 'autorises', 'interdits', 'frontieres'];
const CHAMPS_BUDGET = ['cycle', 'plafond', 'reserve', 'plafondRun', 'plafondChantier'];
const usd = (m) => `${ecrireUSD(m)} USD`;

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

const jalonVide = () => ({ id: '', titre: '', critere: '', tentativesMax: '2' });
const ficheVide = () => ({ comportement: '', criteres: '', tests: '', autorises: '', interdits: '', frontieres: '', decisions: [] });
const formulaireVide = (version) => ({
  chantier: '', objectif: '', version, sha: '', jalons: [jalonVide()],
  budget: { cycle: '', plafond: '', reserve: '', plafondRun: '', plafondChantier: '' },
});
const copieVide = (version) => ({ version: 2, mode: 'OFF', formulaire: formulaireVide(version), fiches: {}, journal: null, registre: null, mission: null, pieces: {}, piecesDepuis: 1 });
// Section ouverte d'office pour les étapes AT-6 (les autres gardent la règle AT-4).
const SECTION_DE_L_ETAPE = Object.freeze({ 'rapport-attendu': 'rapport', 'demande-a-copier': 'verification', 'faits-attendus': 'verification', 'verification-a-refaire': 'verification', 'decision-attendue': 'verification', 'chantier-termine': 'decision' });
const CONFORME = 'verification-technique-conforme';
const NON_CONFORME = 'verification-technique-non-conforme';

// Chantier TÉMOIN : reconnaissable par son identifiant « temoin- ». Aucun SHA n'est inventé : il reste à coller.
function temoin(version) {
  return {
    formulaire: {
      chantier: 'temoin-atelier', objectif: 'TÉMOIN — démontrer l\'écran Atelier OFF / MANUEL, sans aucun développement réel.', version, sha: '',
      jalons: [{ id: 'temoin-1', titre: 'Jalon témoin', critere: 'Le dossier témoin est généré puis copié sans aucune modification.', tentativesMax: '2' }],
      budget: { cycle: 'temoin-cycle', plafond: '100', reserve: '20', plafondRun: '15', plafondChantier: '30' },
    },
    fiche: {
      comportement: 'TÉMOIN — le dossier de mission est généré et copié, puis un rapport témoin collé est vérifié dans sa forme seulement.',
      criteres: 'Le dossier copié est identique au dossier généré.\nLe rapport témoin est déclaré conforme mais non vérifié.',
      tests: 'Aucun test réel : chantier témoin.', autorises: 'tests/temoin-atelier.test.mjs', interdits: '',
      frontieres: 'Aucun développement réel.\nAucun dépôt.',
      decisions: [{ id: 'D-007', texte: 'Atelier de développement : OUTILLAGE NON COGNITIF. Claude produit des candidats, jamais des acquisitions.' }],
    },
  };
}

// Forme de la copie locale ; rend une raison ou null. Le journal et le registre sont vérifiés par leurs propres modules.
function raisonCopie(c) {
  const objet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const textes = (o, cles) => objet(o) && cles.every((k) => typeof o[k] === 'string');
  if (!objet(c) || (c.version !== 1 && c.version !== 2) || !Object.hasOwn(c, 'mission')) return 'version de copie inconnue';
  if (c.mode !== 'OFF' && c.mode !== 'MANUEL') return 'mode inconnu';
  const f = c.formulaire;
  if (!textes(f, ['chantier', 'objectif', 'version', 'sha']) || !Array.isArray(f.jalons) || !f.jalons.every((j) => textes(j, ['id', 'titre', 'critere', 'tentativesMax'])) || !textes(f.budget, CHAMPS_BUDGET)) return 'formulaire illisible';
  if (!objet(c.fiches) || !Object.values(c.fiches).every((x) => textes(x, CHAMPS_FICHE) && Array.isArray(x.decisions) && x.decisions.every((d) => textes(d, ['id', 'texte'])))) return 'fiche illisible';
  if (c.journal !== null) { const v = verifierJournal(c.journal); if (!v.ok) return `journal du chantier incohérent (événement ${v.n}) : ${v.raison}`; }
  if (c.registre !== null) { const v = verifierRegistre(c.registre); if (!v.ok) return `registre de budget incohérent (événement ${v.n}) : ${v.raison}`; }
  if (c.mission !== null) {
    if (!objet(c.mission) || c.journal === null) return 'instantané du dossier illisible';
    try { construireMission(c.mission); } catch (e) { return `instantané du dossier illisible : ${e.message}`; }
    const etat = etatDe(c.journal);
    if (c.mission.chantier !== etat.id || c.mission.base.sha !== etat.base.sha || c.mission.base.version !== etat.base.version) return 'instantané du dossier étranger au chantier';
  }
  if (c.version === 2) {
    const lues = piecesLues(c);
    if (typeof lues === 'string') return lues;
    const r = raisonPieces({ etat: c.journal ? etatDe(c.journal) : null, journal: c.journal, pieces: lues, piecesDepuis: c.piecesDepuis });
    if (r) return `pièces incohérentes : ${r}`;
  }
  return null;
}

// Pièces de la copie relues par les vérificateurs (rapport : verifierRapport contre l'instantané ; faits : lireFaits, empreinte comprise).
// Rend les pièces lues, ou la raison de l'illisibilité. Rien n'est réparé.
function piecesLues(c) {
  const objet = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!objet(c.pieces) || !Number.isInteger(c.piecesDepuis)) return 'pièces illisibles';
  const lues = {};
  for (const [cle, p] of Object.entries(c.pieces)) {
    if (!objet(p) || Object.keys(p).sort().join(',') !== 'demande,faits,mission,rapport') return `pièce « ${cle} » illisible`;
    try { construireMission(p.mission); } catch (e) { return `pièce « ${cle} » : instantané illisible : ${e.message}`; }
    if (p.rapport !== null && typeof p.rapport !== 'string') return `pièce « ${cle} » : rapport illisible`;
    if (p.demande !== null && !objet(p.demande)) return `pièce « ${cle} » : demande illisible`;
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

function lireCopie(stockage, version) {
  let brut = null;
  try { brut = stockage ? stockage.getItem(CLE_ATELIER) : null; } catch { brut = null; }
  if (!brut) return { copie: copieVide(version) };
  let c;
  try { c = JSON.parse(brut); } catch { return { illisible: 'texte illisible' }; }
  const r = raisonCopie(c);
  if (r) return { illisible: r };
  // Copie AT-4 (version 1) : lue comme un chantier sans pièces AT-6 ; les tentatives déjà écrites n'en reçoivent aucune.
  if (c.version === 1) return { copie: { ...c, version: 2, pieces: {}, piecesDepuis: c.journal ? c.journal.length + 1 : 1 } };
  return { copie: c };
}

// Une ligne de zone de texte = un élément ; une ligne vide est refusée, jamais ignorée.
function lignes(texte, nom) {
  if (texte === '') return [];
  const l = texte.split('\n');
  const i = l.indexOf('');
  if (i >= 0) throw new Error(`${nom} : ligne ${i + 1} vide`);
  return l;
}

export function monterAtelier({ zone, version, stockage = stockageParDefaut(), copier = (t) => navigator.clipboard.writeText(t), maintenant = () => new Date().toISOString() }) {
  let lu = lireCopie(stockage, version);
  // État temporaire d'interface (mémoire vive seulement).
  let ui = { section: null, message: null, dossier: null, copie: null, rapport: '', verification: null, confirmerEffacement: false, faits: '', versionCandidat: null, motifDecision: '', retour: null };

  const el = (tag, { classe, texte, attrs } = {}, ...enfants) => {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    e.append(...enfants.filter(Boolean));
    return e;
  };
  const manuel = () => !!lu.copie && lu.copie.mode === 'MANUEL';
  const bouton = (texte, nom, action, { principal = false, actif = true } = {}) => {
    const b = el('button', { classe: principal ? 'bouton-principal' : 'bouton-secondaire', texte, attrs: { type: 'button', 'data-atelier': nom } });
    b.disabled = !actif;
    b.addEventListener('click', () => (b.disabled ? undefined : action()));
    return b;
  };
  const champ = (libelle, valeur, surSaisie, { nom, multi = false, rangs = 3, aide = '', clavier = '', verrou = false } = {}) => {
    const entree = el(multi ? 'textarea' : 'input', { attrs: { 'data-atelier': nom, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', ...(clavier ? { inputmode: clavier } : {}) } });
    if (multi) entree.rows = rangs; else entree.type = 'text';
    entree.value = valeur;
    entree.disabled = !manuel() || verrou;
    entree.addEventListener('input', () => { if (manuel() && !verrou) { surSaisie(entree.value); sauver(); } });
    return el('label', { classe: 'champ' }, el('span', { texte: libelle }), entree, aide ? el('span', { classe: 'aide', texte: aide }) : null);
  };
  // Saisie d'interface seulement (mémoire vive) : motif, faits, version proposée. Rien n'est enregistré à la frappe.
  const saisie = (libelle, valeur, surSaisie, { nom, multi = false, rangs = 3, aide = '' } = {}) => {
    const entree = el(multi ? 'textarea' : 'input', { attrs: { 'data-atelier': nom, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' } });
    if (multi) entree.rows = rangs; else entree.type = 'text';
    entree.value = valeur;
    entree.disabled = !manuel();
    entree.addEventListener('input', () => { if (manuel()) surSaisie(entree.value); });
    return el('label', { classe: 'champ' }, el('span', { texte: libelle }), entree, aide ? el('span', { classe: 'aide', texte: aide }) : null);
  };
  const message = (section) => (ui.message && ui.message.section === section
    ? el('p', { classe: `resultat ${ui.message.erreur ? 'resultat-erreur' : 'resultat-ok'}`, texte: ui.message.texte, attrs: { 'data-atelier': 'message' } }) : null);
  const dire = (section, texte, erreur = false) => { ui.message = { section, texte, erreur }; };

  const ecrireCopie = (c) => stockage.setItem(CLE_ATELIER, JSON.stringify(c));
  function sauver() {
    if (!lu.copie) return false;
    try { ecrireCopie(lu.copie); return true; } catch { dire('bandeau', 'Copie locale non enregistrée sur cet appareil.', true); return false; }
  }
  // AT-6 : un geste persistant prépare une NOUVELLE copie, la fait relire entière par les vérificateurs, l'enregistre, et seulement
  // alors la retient. Copie incohérente ou enregistrement impossible : rien n'est fait (la copie retenue reste l'ancienne).
  function engager(nouvelle) {
    const r = raisonCopie(nouvelle);
    if (r) throw new Error(`Refusé : ${r}.`);
    try { ecrireCopie(nouvelle); } catch { throw new Error('Copie locale non enregistrée sur cet appareil : rien n\'est fait.'); }
    lu = { copie: nouvelle };
  }
  // Exécute une action technique en MANUEL seulement, puis enregistre la copie locale et redessine.
  const agir = (section, action) => () => {
    if (!manuel()) return;
    try { action(); } catch (e) { dire(section, e && e.message ? e.message : String(e), true); }
    rendre();
  };
  const etatChantier = () => (lu.copie && lu.copie.journal ? etatDe(lu.copie.journal) : null);
  const ficheDe = (id) => lu.copie.fiches[id] || (lu.copie.fiches[id] = ficheVide());

  // ---------------------------------------------------------------------------------------------- actions techniques (MANUEL)
  function ouvrir() {
    const f = lu.copie.formulaire;
    if (!RE_ID.test(f.chantier) || f.chantier.length > 40) throw new Error('Identifiant du chantier : lettres minuscules, chiffres et tirets (40 au plus).');
    if (!RE_VERSION.test(f.version)) throw new Error('Version de base : X.Y.Z attendu.');
    if (!RE_SHA.test(f.sha)) throw new Error('SHA de base : 40 caractères hexadécimaux minuscules attendus (il n\'est jamais deviné : colle-le).');
    const plan = f.jalons.map((j, i) => {
      if (!RE_ID.test(j.id) || j.id.length > 40) throw new Error(`Jalon ${i + 1} : identifiant en lettres minuscules, chiffres et tirets.`);
      if (!/^[1-9][0-9]{0,2}$/.test(j.tentativesMax)) throw new Error(`Jalon ${i + 1} : tentatives max = entier de 1 à 999.`);
      return { id: j.id, titre: j.titre, critere: j.critere, tentativesMax: Number.parseInt(j.tentativesMax, 10) };
    });
    lu.copie.journal = ouvrirChantier({ id: f.chantier, objectif: f.objectif, base: { sha: f.sha, version: f.version }, plan }, maintenant());
    sauver();
    dire('chantier', 'Chantier ouvert (état technique). Plan à approuver.');
  }
  function appliquerChantier(type, donnees, section, texte) {
    const r = appliquer(lu.copie.journal, { type, quand: maintenant(), donnees });
    if (!Array.isArray(r)) throw new Error(`Refusé : ${r.raison}.`);
    lu.copie.journal = r;
    sauver();
    dire(section, texte);
  }
  function ouvrirCycle() {
    const b = lu.copie.formulaire.budget;
    const m = {};
    for (const [k, nom] of [['plafond', 'Plafond du cycle'], ['reserve', 'Réserve'], ['plafondRun', 'Plafond par exécution']]) {
      const v = lireUSD(b[k]);
      if (typeof v !== 'number') throw new Error(`${nom} : ${v.raison}.`);
      m[k] = v;
    }
    lu.copie.registre = ouvrirRegistre({ cycle: b.cycle, ...m }, maintenant());
    sauver();
    dire('budget', 'Cycle ouvert (registre technique).');
  }
  function plafonnerChantier() {
    const v = lireUSD(lu.copie.formulaire.budget.plafondChantier);
    if (typeof v !== 'number') throw new Error(`Plafond du chantier : ${v.raison}.`);
    const r = appliquerBudget(lu.copie.registre, { type: 'chantier-plafonne', quand: maintenant(), donnees: { chantier: etatChantier().id, plafond: v } });
    if (!Array.isArray(r)) throw new Error(`Refusé : ${r.raison}.`);
    lu.copie.registre = r;
    sauver();
    dire('budget', 'Plafond du chantier fixé.');
  }
  // Données du dossier : AT-1 (id, objectif, base, titre, numéro de tentative) + fiche locale (le reste), composées explicitement.
  function donneesMission() {
    const e = etatChantier();
    if (!e || e.statut !== 'en-cours') throw new Error('le chantier doit être en cours (plan approuvé)');
    const j = e.plan[e.jalonCourant];
    const f = lu.copie.fiches[j.id] || ficheVide();
    return {
      chantier: e.id, objectif: e.objectif, base: { sha: e.base.sha, version: e.base.version },
      jalon: { id: j.id, titre: j.titre, comportement: f.comportement }, tentative: j.tentatives.length + 1,
      criteres: lignes(f.criteres, 'Critères'), tests: lignes(f.tests, 'Tests exigés'), autorises: lignes(f.autorises, 'Chemins autorisés'),
      interdits: lignes(f.interdits, 'Chemins interdits'), frontieres: lignes(f.frontieres, 'Frontières'),
      decisions: f.decisions.map((d) => ({ id: d.id, texte: d.texte })),
    };
  }
  function generer() {
    if (!manuel()) return;
    ui.copie = null;
    try {
      const donnees = donneesMission();
      if (!permis('generer')) throw new Error(`aucune nouvelle tentative à cette étape (« ${etapeCourante().etape} »)`);
      const texte = construireMission(donnees);
      lu.copie.mission = structuredClone(donnees);
      sauver();
      ui.dossier = { texte }; ui.verification = null; ui.message = null;
    } catch (e) { ui.dossier = null; dire('dossier', `Dossier impossible : ${e.message}`, true); }
    rendre();
  }
  async function copierDossier() {
    if (!manuel() || !ui.dossier) return;
    const texte = ui.dossier.texte;
    try {
      await copier(texte);
      ui.copie = { ok: true, texte: `Copié ✓ (${octets(texte)} octets)` };
    } catch (e) {
      ui.copie = { ok: false, texte: `Copie impossible : ${e && e.message ? e.message : String(e)} — sélectionne le texte ci-dessus.` };
    }
    rendre();
  }
  function verifier() {
    if (!manuel()) return;
    const v = vivanteCourante();
    const reference = v && v.piece ? v.piece.mission : lu.copie.mission;
    if (!reference) ui.verification = { structure: 'impossible', raison: 'aucun dossier généré' };
    else try { ui.verification = verifierRapport(reference, ui.rapport); } catch (e) { ui.verification = { structure: 'impossible', raison: e.message }; }
    rendre();
  }
  // ---------------------------------------------------------------------------------------------- parcours MANUEL (AT-6)
  // Pièce de la tentative vivante du jalon courant (lue), ou null.
  function vivanteCourante() {
    const e = etatChantier();
    if (!e || e.statut !== 'en-cours') return null;
    const j = e.plan[e.jalonCourant];
    const t = j.tentatives.find((x) => x.statut === 'lancee' || x.statut === 'rendue');
    if (!t) return null;
    const cle = cleTentative(j.id, t.numero);
    const lues = piecesLues(lu.copie);
    return { e, j, t, cle, piece: Object.hasOwn(lues, cle) ? lues[cle] : null };
  }
  // Verdict technique RECALCULÉ depuis les pièces (dernier texte de faits reçu) ; jamais lu depuis la copie.
  function confrontationCourante() {
    const v = vivanteCourante();
    if (!v || !v.piece || v.piece.rapport === null || v.piece.faits.length === 0) return null;
    const f = v.piece.faits[v.piece.faits.length - 1];
    return { ...v, faits: f, resultat: confronter({ mission: v.piece.mission, rapport: v.piece.rapport.texte, faits: f.texte, hacherSha256 }) };
  }
  function etapeCourante() {
    const e = etatChantier();
    const c = confrontationCourante();
    return etapeDe({ etat: e, pieces: lu.copie ? piecesLues(lu.copie) : {}, verdict: c ? c.resultat.verdict_technique : null });
  }
  const permis = (geste) => etapeCourante().gestes.includes(geste);
  function exiger(geste) {
    if (!permis(geste)) throw new Error(`Geste impossible à l'étape « ${etapeCourante().etape} ».`);
  }
  // Nouvelle copie = copie retenue + journal AT-1 avec l'événement (refus AT-1 : erreur) + modification des pièces.
  function avecEvenement(type, donnees, modifier = () => {}) {
    const c = structuredClone(lu.copie);
    const r = appliquer(c.journal, { type, quand: maintenant(), donnees });
    if (!Array.isArray(r)) throw new Error(`Refusé : ${r.raison}.`);
    c.journal = r;
    modifier(c);
    return c;
  }
  async function copierVers(cle, texte, quoi) {
    try { await copier(texte); ui.retour = { cle, ok: true, texte: `${quoi} copié ✓ (${octets(texte)} octets)` }; } catch (e) {
      ui.retour = { cle, ok: false, texte: `Copie impossible : ${e && e.message ? e.message : String(e)} — utilise « Recopier ».` };
    }
  }
  // Geste 1 : « Copier et lancer la tentative n ». Tentative AT-1 lancée + instantané figé, ENREGISTRÉS AVANT le presse-papiers.
  async function lancer() {
    if (!manuel()) return;
    try {
      exiger('lancer');
      const et = etapeCourante();
      const m = lu.copie.mission;
      if (!m || m.jalon.id !== et.jalon || m.tentative !== et.numero) throw new Error(`génère d'abord le dossier de la tentative ${et.numero}`);
      const texte = construireMission(m);
      engager(avecEvenement('tentative-lancee', { jalon: et.jalon }, (c) => {
        c.pieces[cleTentative(et.jalon, et.numero)] = { mission: structuredClone(m), rapport: null, demande: null, faits: [] };
      }));
      ui.dossier = { texte };
      dire('dossier', `Tentative ${et.numero} lancée (état technique) : dossier figé.`);
      await copierVers('dossier', texte, 'Dossier');
    } catch (e) { dire('dossier', `Lancement impossible : ${e.message}`, true); }
    rendre();
  }
  async function recopierDossier() {
    if (!manuel()) return;
    const v = vivanteCourante();
    if (!v || !v.piece || !permis('recopier-dossier')) return;
    const texte = construireMission(v.piece.mission);
    ui.dossier = { texte };
    await copierVers('dossier', texte, 'Dossier');
    rendre();
  }
  // Geste 2 : « Enregistrer le candidat reçu » — rapport « candidat » conforme seulement ; tentative AT-1 rendue, référence branche@sha.
  function enregistrer() {
    if (!manuel()) return;
    try {
      exiger('enregistrer');
      const v = vivanteCourante();
      const vr = verifierRapport(v.piece.mission, ui.rapport);
      if (vr.structure !== 'conforme') throw new Error(`rapport non conforme : ${vr.raison}. Rien n'est enregistré`);
      if (vr.statutAnnonce !== 'candidat') throw new Error(`Claude annonce « ${vr.statutAnnonce} » : aucun candidat n'est rendu. Seule l'annulation de la tentative est possible`);
      const ref = `${vr.rapport.candidat.branche}@${vr.rapport.candidat.sha}`;
      const texte = ui.rapport;
      engager(avecEvenement('tentative-rendue', { jalon: v.j.id, numero: v.t.numero, reference: ref }, (c) => { c.pieces[v.cle].rapport = texte; }));
      ui.rapport = ''; ui.verification = null;
      ui.section = 'verification';
      dire('verification', `Candidat reçu enregistré (tentative ${v.t.numero} rendue : ${ref}). Il n'est pas vérifié.`);
    } catch (e) { dire('rapport', `Enregistrement impossible : ${e.message}.`, true); }
    rendre();
  }
  // Demande de vérification : construite depuis les pièces ; version_candidat proposée, modifiable, puis FIGÉE à la première copie.
  async function copierDemande() {
    if (!manuel()) return;
    try {
      exiger('copier-demande');
      const v = vivanteCourante();
      let d = v.piece.demande;
      if (d === null) {
        d = demandeDe({ mission: v.piece.mission, rapport: v.piece.rapport.lu.rapport, versionCandidat: versionProposee(v) });
        const ld = lireDemande(d);
        if (ld.raison) throw new Error(ld.raison);
        const figee = { ...d };
        const c = structuredClone(lu.copie);
        c.pieces[v.cle].demande = figee;
        engager(c);
        dire('verification', 'Demande figée : elle ne change plus pour cette tentative.');
      }
      await copierVers('demande', texteDemande(d), 'Demande');
    } catch (e) { dire('verification', `Demande impossible : ${e.message}.`, true); }
    rendre();
  }
  const versionProposee = (v) => (ui.versionCandidat !== null ? ui.versionCandidat : proposerVersion(v.piece.mission.base.version));
  // Geste 3 : « Confronter les faits » — faits AT-5 lisibles, d'empreinte vérifiée, de CETTE demande : texte exact ajouté (append-only).
  function confronterFaits() {
    if (!manuel()) return;
    try {
      exiger('confronter');
      const v = vivanteCourante();
      const texte = ui.faits;
      const lf = lireFaits(texte, hacherSha256);
      if (lf.raison) throw new Error(`faits illisibles : ${lf.raison}. Rien n'est conservé`);
      const d = lf.faits.demande;
      if (!['branche', 'candidat', 'base', 'version_base', 'version_candidat'].every((k) => d[k] === v.piece.demande[k])) throw new Error('faits d\'une autre demande que celle copiée pour cette tentative. Rien n\'est conservé');
      const c = structuredClone(lu.copie);
      c.pieces[v.cle].faits.push(texte);
      engager(c);
      ui.faits = '';
      dire('verification', `Faits reçus (run ${lf.faits.provenance.run_id}) : verdict technique recalculé ci-dessous.`);
    } catch (e) { dire('verification', `Confrontation impossible : ${e.message}.`, true); }
    rendre();
  }
  // Geste 4 : décision humaine. Le verdict est RECALCULÉ au moment du geste ; le motif est écrit par Christophe.
  function decider(type) {
    if (!manuel()) return;
    try {
      exiger(type === 'tentative-acceptee' ? 'accepter' : 'refuser');
      const motif = ui.motifDecision || '';
      if (motif.trim() === '') throw new Error('motif humain obligatoire');
      const c = confrontationCourante();
      const verdict = c.resultat.verdict_technique;
      if (type === 'tentative-acceptee' && verdict !== CONFORME) throw new Error('acceptation possible seulement sur un verdict technique conforme');
      if (type === 'tentative-rejetee' && verdict !== CONFORME && verdict !== NON_CONFORME) throw new Error('refus possible seulement sur un verdict technique exploitable');
      const f = c.faits.lu.faits;
      engager(avecEvenement(type, { jalon: c.j.id, numero: c.t.numero, motif, candidat: c.piece.rapport.lu.rapport.candidat.sha, faits: f.empreinte, verdict, run_id: f.provenance.run_id }));
      ui.motifDecision = '';
      dire('decision', type === 'tentative-acceptee' ? `Candidat accepté (décision humaine, tentative ${c.t.numero}). Ce n'est ni un dépôt, ni une acquisition ; main est inchangé.` : `Candidat refusé (décision humaine, tentative ${c.t.numero}).`);
    } catch (e) { dire('decision', `Décision impossible : ${e.message}.`, true); }
    rendre();
  }
  function annuler() {
    if (!manuel()) return;
    try {
      exiger('annuler');
      const motif = ui.motifDecision || '';
      if (motif.trim() === '') throw new Error('motif humain obligatoire');
      const v = vivanteCourante();
      engager(avecEvenement('tentative-annulee', { jalon: v.j.id, numero: v.t.numero, motif }));
      ui.motifDecision = '';
      dire('decision', `Tentative ${v.t.numero} annulée (état technique).`);
    } catch (e) { dire('decision', `Annulation impossible : ${e.message}.`, true); }
    rendre();
  }
  function effacer() {
    if (!ui.confirmerEffacement) { ui.confirmerEffacement = true; rendre(); return; }
    try { if (stockage) stockage.removeItem(CLE_ATELIER); } catch { /* rien à faire de plus */ }
    lu = { copie: copieVide(version) };
    ui = { section: null, message: null, dossier: null, copie: null, rapport: '', verification: null, confirmerEffacement: false, faits: '', versionCandidat: null, motifDecision: '', retour: null };
    rendre();
  }

  // ---------------------------------------------------------------------------------------------- rendu
  const sections = [];
  function section(nom, titre, ...contenu) {
    const d = el('details', { classe: 'bloc atelier-section', attrs: { 'data-atelier-section': nom } }, el('summary', { texte: titre }), ...contenu);
    d.open = ui.section === nom;
    d.addEventListener('toggle', () => {
      if (d.open) { ui.section = nom; for (const autre of sections) if (autre !== d) autre.open = false; } else if (ui.section === nom) ui.section = null;
    });
    sections.push(d);
    return d;
  }
  const ligneTexte = (texte, nom) => el('p', { classe: 'aide atelier-ligne', texte, attrs: nom ? { 'data-atelier': nom } : {} });

  function bandeau(e) {
    const c = lu.copie;
    const idChantier = e ? e.id : c ? c.formulaire.chantier : '';
    const modes = c ? el('div', { classe: 'ligne' },
      el('span', { texte: `Mode : ${c.mode}`, attrs: { 'data-atelier': 'mode' } }),
      ...['OFF', 'MANUEL'].map((m) => {
        const b = bouton(m, `mode-${m.toLowerCase()}`, () => { c.mode = m; ui.dossier = null; ui.copie = null; ui.verification = null; sauver(); rendre(); });
        b.setAttribute('aria-pressed', String(c.mode === m));
        return b;
      })) : null;
    return el('div', { classe: 'atelier-bandeau', attrs: { 'data-atelier': 'bandeau' } },
      el('p', { classe: 'atelier-titre', texte: 'ATELIER DE DÉVELOPPEMENT' }),
      el('p', { classe: 'atelier-titre', texte: 'OUTILLAGE NON COGNITIF' }),
      el('p', { classe: 'aide', texte: 'Rien ici n\'est une acquisition de Naissance.' }),
      modes,
      idChantier.startsWith('temoin-') ? el('div', { classe: 'atelier-temoin', attrs: { 'data-atelier': 'temoin-bandeau' } },
        el('p', { classe: 'atelier-titre', texte: 'CHANTIER TÉMOIN' }), el('p', { classe: 'aide', texte: 'Démonstration — aucun développement réel.' })) : null,
      c ? el('p', { classe: 'aide', texte: `Prochaine étape : ${etapeCourante().consigne}`, attrs: { 'data-atelier': 'prochaine-etape' } }) : null,
      message('bandeau'));
  }

  function sectionChantier(e) {
    const c = lu.copie;
    const f = c.formulaire;
    if (e) {
      const arret = e.statut === 'ouvert' || e.statut === 'en-cours' || e.statut === 'bloque';
      return section('chantier', '1. Chantier (état technique)',
        ligneTexte(`Identifiant : ${e.id}`), ligneTexte(`Objectif : ${e.objectif}`), ligneTexte(`Version de base : ${e.base.version}`),
        ligneTexte(`SHA de base : ${e.base.sha}`), ligneTexte(`Statut technique : ${e.statut}`, 'statut'),
        arret ? champ('Motif d\'un arrêt', ui.motifArret || '', (v) => { ui.motifArret = v; }, { nom: 'motif-arret' }) : null,
        arret ? bouton('Arrêter définitivement le chantier', 'arreter', agir('chantier', () => appliquerChantier('chantier-arrete', { motif: ui.motifArret || '' }, 'chantier', 'Chantier arrêté (état technique).')), { actif: manuel() }) : null,
        message('chantier'));
    }
    const jalons = f.jalons.map((j, i) => el('div', { classe: 'atelier-jalon' },
      ligneTexte(`Jalon ${i + 1}`),
      champ('Identifiant du jalon', j.id, (v) => { j.id = v; }, { nom: `jalon-${i}-id` }),
      champ('Titre', j.titre, (v) => { j.titre = v; }, { nom: `jalon-${i}-titre` }),
      champ('Critère (AT-1)', j.critere, (v) => { j.critere = v; }, { nom: `jalon-${i}-critere`, multi: true, rangs: 2 }),
      champ('Tentatives max', j.tentativesMax, (v) => { j.tentativesMax = v; }, { nom: `jalon-${i}-tentatives`, clavier: 'numeric' })));
    return section('chantier', '1. Chantier (préparation)',
      bouton('Remplir avec le chantier TÉMOIN', 'temoin', agir('chantier', () => { const t = temoin(version); c.formulaire = t.formulaire; c.fiches = { 'temoin-1': t.fiche }; sauver(); dire('chantier', 'Chantier TÉMOIN prérempli. Colle le SHA de base, puis ouvre le chantier.'); }), { actif: manuel() }),
      champ('Identifiant du chantier', f.chantier, (v) => { f.chantier = v; }, { nom: 'chantier-id', aide: 'Lettres minuscules, chiffres et tirets.' }),
      champ('Objectif', f.objectif, (v) => { f.objectif = v; }, { nom: 'objectif', multi: true }),
      champ('Version de base', f.version, (v) => { f.version = v; }, { nom: 'version', aide: 'Préremplie avec la version de l\'appli.' }),
      champ('SHA de base', f.sha, (v) => { f.sha = v; }, { nom: 'sha', aide: '40 caractères. L\'appli ne connaît pas son commit : il est collé, jamais deviné.' }),
      ...jalons,
      el('div', { classe: 'ligne' },
        bouton('+ jalon', 'ajouter-jalon', agir('chantier', () => { f.jalons.push(jalonVide()); sauver(); }), { actif: manuel() }),
        bouton('− dernier jalon', 'retirer-jalon', agir('chantier', () => { f.jalons.pop(); sauver(); }), { actif: manuel() && f.jalons.length > 1 })),
      bouton('Ouvrir le chantier', 'ouvrir', agir('chantier', ouvrir), { principal: true, actif: manuel() }),
      message('chantier'));
  }

  function sectionPlan(e) {
    if (!e) return section('plan', '2. Plan', ligneTexte('Aucun chantier ouvert.'));
    const jalons = e.plan.map((j, i) => ligneTexte(`${i + 1}. ${j.id} — ${j.titre} — ${j.statut} — tentatives ${j.tentatives.length} / ${j.tentativesMax}${i === e.jalonCourant ? ' — jalon courant' : ''}`, `plan-${i}`));
    return section('plan', '2. Plan', ligneTexte(`Chantier ${e.id} — statut technique : ${e.statut}`), ...jalons,
      e.statut === 'ouvert' ? bouton('Approuver le plan', 'approuver', agir('plan', () => appliquerChantier('plan-approuve', {}, 'plan', 'Plan approuvé : il est désormais figé.')), { principal: true, actif: manuel() }) : null,
      ligneTexte('Le plan est figé après son approbation (aucune modification, aucun ajout).'),
      message('plan'));
  }

  function sectionFiche(e) {
    if (!e || e.statut !== 'en-cours') return section('fiche', '3. Fiche du jalon courant', ligneTexte('Aucun jalon courant : le plan doit être approuvé.'));
    const j = e.plan[e.jalonCourant];
    const f = ficheDe(j.id);
    // AT-6 : la fiche n'est modifiable que tant qu'aucune tentative n'est vivante ; le dossier lancé reste l'instantané figé.
    const verrou = etapeCourante().etape !== 'mission-a-lancer';
    const decisions = f.decisions.map((d, i) => el('div', { classe: 'atelier-decision' },
      champ(`Décision ${i + 1} : identifiant`, d.id, (v) => { d.id = v; }, { nom: `decision-${i}-id`, aide: 'D-xxx', verrou }),
      champ(`Décision ${i + 1} : texte copié`, d.texte, (v) => { d.texte = v; }, { nom: `decision-${i}-texte`, multi: true, verrou })));
    return section('fiche', '3. Fiche du jalon courant',
      ligneTexte(`Jalon ${j.id} — ${j.titre}`), ligneTexte(`Critère (AT-1, inchangé) : ${j.critere}`),
      ligneTexte('Une ligne = un élément. Une ligne vide est refusée.'),
      verrou ? ligneTexte('Fiche figée : une tentative est lancée (son dossier est l\'instantané exact) ou aucune nouvelle tentative n\'est possible.', 'fiche-figee') : null,
      champ('Comportement observable', f.comportement, (v) => { f.comportement = v; }, { nom: 'comportement', multi: true, verrou }),
      champ('Critères d\'acceptation', f.criteres, (v) => { f.criteres = v; }, { nom: 'criteres', multi: true, verrou }),
      champ('Tests exigés', f.tests, (v) => { f.tests = v; }, { nom: 'tests', multi: true, verrou }),
      champ('Chemins autorisés', f.autorises, (v) => { f.autorises = v; }, { nom: 'autorises', multi: true, aide: 'Fichier, ou dossier terminé par /.', verrou }),
      champ('Chemins interdits (facultatif)', f.interdits, (v) => { f.interdits = v; }, { nom: 'interdits', multi: true, rangs: 2, verrou }),
      champ('Frontières (facultatif)', f.frontieres, (v) => { f.frontieres = v; }, { nom: 'frontieres', multi: true, rangs: 2, verrou }),
      ...decisions,
      el('div', { classe: 'ligne' },
        bouton('+ décision', 'ajouter-decision', agir('fiche', () => { if (!verrou) { f.decisions.push({ id: '', texte: '' }); sauver(); } }), { actif: manuel() && !verrou }),
        bouton('− dernière décision', 'retirer-decision', agir('fiche', () => { if (!verrou) { f.decisions.pop(); sauver(); } }), { actif: manuel() && !verrou && f.decisions.length > 0 })),
      message('fiche'));
  }

  function sectionBudget(e) {
    const c = lu.copie;
    const b = c.formulaire.budget;
    const contenu = [ligneTexte('Aucune exécution dans AT-4 : aucun engagement, aucun coût.', 'sans-execution')];
    if (!c.registre) {
      contenu.push(
        champ('Libellé du cycle', b.cycle, (v) => { b.cycle = v; }, { nom: 'cycle' }),
        champ('Plafond du cycle (USD)', b.plafond, (v) => { b.plafond = v; }, { nom: 'plafond', clavier: 'decimal' }),
        champ('Réserve (USD)', b.reserve, (v) => { b.reserve = v; }, { nom: 'reserve', clavier: 'decimal' }),
        champ('Plafond par exécution (USD)', b.plafondRun, (v) => { b.plafondRun = v; }, { nom: 'plafond-run', clavier: 'decimal' }),
        bouton('Ouvrir le cycle', 'ouvrir-cycle', agir('budget', ouvrirCycle), { principal: true, actif: manuel() }));
    } else {
      const r = etatBudget(c.registre);
      const ligneBudget = (libelle, cle, valeur) => ligneTexte(`${libelle} : ${usd(valeur)}`, `budget-${cle}`);
      contenu.push(ligneTexte(`Cycle : ${r.cycle}`, 'budget-cycle'),
        ligneBudget('Plafond du cycle', 'plafond', r.plafond), ligneBudget('Réserve', 'reserve', r.reserve), ligneBudget('Utilisable', 'utilisable', r.utilisable),
        ligneBudget('Consommé', 'consommeCycle', r.consommeCycle), ligneBudget('Engagé', 'engageCycle', r.engageCycle), ligneBudget('Restant du cycle', 'resteCycle', r.resteCycle),
        ligneBudget('Plafond par exécution', 'plafondRun', r.plafondRun),
        ligneTexte(r.suspendu ? 'SUSPENDU : anomalie de borne financière à examiner' : 'Registre non suspendu.', 'budget-suspendu'));
      const ch = e && Object.hasOwn(r.chantiers, e.id) ? r.chantiers[e.id] : null;
      if (ch) {
        contenu.push(ligneBudget('Plafond du chantier', 'chantier-plafond', ch.plafond), ligneBudget('Consommé (chantier)', 'chantier-consomme', ch.consomme),
          ligneBudget('Engagé (chantier)', 'chantier-engage', ch.engage), ligneBudget('Restant (chantier)', 'chantier-reste', ch.reste));
      } else if (e) {
        contenu.push(champ('Plafond du chantier (USD)', b.plafondChantier, (v) => { b.plafondChantier = v; }, { nom: 'plafond-chantier', clavier: 'decimal' }),
          bouton('Fixer le plafond du chantier', 'plafonner', agir('budget', plafonnerChantier), { principal: true, actif: manuel() }));
      } else contenu.push(ligneTexte('Plafond du chantier : à fixer après l\'ouverture du chantier.'));
    }
    return section('budget', '4. Budget (registre technique)', ...contenu, message('budget'));
  }

  const portee = (texte, nom) => el('p', { classe: 'aide atelier-ligne', texte, attrs: { 'data-atelier': nom } });
  const retour = (cle) => (ui.retour && ui.retour.cle === cle
    ? el('p', { classe: `resultat ${ui.retour.ok ? 'resultat-ok' : 'resultat-erreur'}`, texte: ui.retour.texte, attrs: { 'data-atelier': `retour-${cle}` } }) : null);
  const branchePrevue = (m) => `atelier/${m.chantier}/${m.jalon.id}/${m.tentative}`;
  const porteeDossier = (m) => `Ce geste, suivi de ton collage de ce dossier à Claude, autorise UNIQUEMENT la création et le push de la branche ${branchePrevue(m)}, pour cette tentative et conformément au dossier. Rien sur main, aucun tag, aucun dépôt, aucune autre tentative, rien hors mission.`;
  const apercuDossier = (texte) => {
    const apercu = el('textarea', { classe: 'atelier-dossier', attrs: { 'data-atelier': 'dossier', readonly: '', spellcheck: 'false' } });
    apercu.readOnly = true;
    apercu.rows = 12;
    apercu.value = texte;
    return apercu;
  };

  function sectionDossier() {
    if (!manuel()) return section('dossier', '5. Dossier de mission', ligneTexte('Mode OFF : consultation seulement. Aucune génération, aucune copie.', 'off-dossier'));
    const et = etapeCourante();
    const v = vivanteCourante();
    const contenu = [bouton('Générer le dossier', 'generer', generer, { principal: true })];
    if (v && v.piece) {
      const texte = construireMission(v.piece.mission);
      contenu.push(ligneTexte(`Tentative ${v.t.numero} lancée : dossier figé (instantané exact, ${octets(texte)} octets).`, 'dossier-fige'), apercuDossier(texte),
        bouton(`Recopier le dossier de la tentative ${v.t.numero}`, 'recopier-dossier', recopierDossier, { principal: true, actif: permis('recopier-dossier') }),
        portee(porteeDossier(v.piece.mission), 'portee-dossier'), retour('dossier'));
    } else if (ui.dossier) {
      contenu.push(apercuDossier(ui.dossier.texte), ligneTexte(`${octets(ui.dossier.texte)} octets UTF-8 — texte exact du dossier, sans ajout.`),
        bouton('Copier', 'copier', copierDossier, { principal: false }),
        ui.copie ? el('p', { classe: `resultat ${ui.copie.ok ? 'resultat-ok' : 'resultat-erreur'}`, texte: ui.copie.texte, attrs: { 'data-atelier': 'copie' } }) : null);
      const m = lu.copie.mission;
      if (et.etape === 'mission-a-lancer' && m && m.jalon.id === et.jalon && m.tentative === et.numero) {
        contenu.push(ligneTexte('« Copier » ne lance rien. Le lancement est un geste séparé :'),
          bouton(`Copier et lancer la tentative ${et.numero}`, 'lancer', lancer, { principal: true }), portee(porteeDossier(m), 'portee-dossier'));
      }
      contenu.push(retour('dossier'));
    } else if (et.etape === 'base-indefinie') contenu.push(ligneTexte(et.consigne, 'abstention-base'));
    return section('dossier', '5. Dossier de mission', ...contenu, message('dossier'));
  }

  function sectionRapport() {
    if (!manuel()) return section('rapport', '6. Rapport de Claude', ligneTexte('Mode OFF : consultation seulement. Aucune vérification.', 'off-rapport'));
    const zoneRapport = el('textarea', { attrs: { 'data-atelier': 'rapport', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' } });
    zoneRapport.rows = 6;
    zoneRapport.value = ui.rapport;
    zoneRapport.addEventListener('input', () => { ui.rapport = zoneRapport.value; });
    return section('rapport', '6. Rapport de Claude',
      el('label', { classe: 'champ' }, el('span', { texte: 'Coller le rapport JSON de Claude' }), zoneRapport),
      ligneTexte(lu.copie.mission ? `Référence : dernier dossier généré (jalon ${lu.copie.mission.jalon.id}, tentative ${lu.copie.mission.tentative}), jamais la fiche actuelle.` : 'Référence : aucun dossier généré.', 'reference'),
      bouton('Vérifier la forme', 'verifier', verifier, { principal: true }),
      ui.verification ? resultatRapport(ui.verification) : null,
      etapeCourante().etape === 'rapport-attendu' ? bouton(`Enregistrer le candidat reçu (tentative ${etapeCourante().numero})`, 'enregistrer', enregistrer, { principal: true }) : null,
      etapeCourante().etape === 'rapport-attendu' ? ligneTexte('Enregistrer = « Claude a rendu ce candidat » (tentative rendue). Ce n\'est ni une vérification, ni une acceptation.') : null,
      message('rapport'));
  }

  function resultatRapport(v) {
    const p = (texte) => el('p', { texte });
    const boite = (...enfants) => el('div', { classe: 'resultat atelier-verification', attrs: { 'data-atelier': 'verification' } }, ...enfants);
    if (v.structure === 'impossible') return boite(p(`Vérification impossible : ${v.raison}.`));
    if (v.structure !== 'conforme') return boite(p(`Rapport NON CONFORME : ${v.raison}.`), p('Rien n\'est enregistré.'));
    const r = v.rapport;
    if (v.statutAnnonce === 'bloque') return boite(p('Rapport structurellement conforme — Claude annonce : BLOQUÉ.'), p(`Question de Claude : ${r.question}`));
    if (v.statutAnnonce === 'echec') return boite(p('Rapport structurellement conforme — Claude annonce : ÉCHEC.'), p(`Motif annoncé : ${r.motif}`));
    const liste = (l) => (l.length ? l.join(', ') : '(aucun)');
    return boite(p('Rapport structurellement conforme.'), p('Candidat NON VÉRIFIÉ.'), p('Aucune validation ni acquisition.'),
      el('p', { classe: 'atelier-titre', texte: 'Annoncé par Claude (non vérifié)' }),
      p(`Branche : ${r.candidat.branche}`), p(`SHA : ${r.candidat.sha}`), p(`Fichiers créés : ${liste(r.fichiers.crees)}`),
      p(`Fichiers modifiés : ${liste(r.fichiers.modifies)}`), p(`Fichiers supprimés : ${liste(r.fichiers.supprimes)}`),
      p(`Tests : ${r.tests.total} au total, ${r.tests.reussis} réussis, ${r.tests.echecs} échecs`),
      p(`Divergences : ${r.divergences.length ? r.divergences.join(' / ') : '(aucune)'}`));
  }

  function sectionVerification() {
    const v = vivanteCourante();
    const titre = '7. Vérification technique (AT-5)';
    if (!v || !v.piece || v.piece.rapport === null) return section('verification', titre, ligneTexte('Aucun candidat reçu à vérifier.', 'verification-vide'), message('verification'));
    const p = v.piece;
    const cand = p.rapport.lu.rapport.candidat;
    const contenu = [ligneTexte(`Candidat reçu (annoncé par Claude, non vérifié) : ${cand.branche}@${cand.sha}`, 'candidat-recu'),
      el('p', { classe: 'atelier-titre', texte: 'Demande de vérification' })];
    const valeurs = p.demande || { branche: cand.branche, candidat: cand.sha, base: p.mission.base.sha, version_base: p.mission.base.version };
    for (const k of ['branche', 'candidat', 'base', 'version_base']) contenu.push(ligneTexte(`${k} = ${valeurs[k]}`, `demande-${k}`));
    if (p.demande === null) {
      contenu.push(saisie('version_candidat (valeur d\'essai proposée)', versionProposee(v), (x) => { ui.versionCandidat = x; }, { nom: 'version-candidat',
        aide: 'Proposée : patch suivant de version_base. Modifiable jusqu\'à la copie, puis figée. Sa validité est établie par AT-5 : ce n\'est pas la version du candidat.' }));
    } else contenu.push(ligneTexte(`version_candidat = ${p.demande.version_candidat} (valeur d'essai figée dans la demande)`, 'demande-version_candidat'));
    contenu.push(bouton(p.demande === null ? 'Copier la demande de vérification' : 'Recopier la demande', 'copier-demande', copierDemande, { principal: true, actif: manuel() && permis('copier-demande') }),
      portee('Ton collage de cette demande à Claude autorise UNIQUEMENT le run AT-5 « Atelier — vérification technique » lancé depuis main avec exactement ces cinq valeurs. Aucun autre run, aucune branche, rien sur main, aucun tag, aucun dépôt.', 'portee-demande'),
      retour('demande'));
    if (p.demande !== null) {
      const zoneFaits = el('textarea', { attrs: { 'data-atelier': 'faits-colles', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off' } });
      zoneFaits.rows = 6;
      zoneFaits.value = ui.faits;
      zoneFaits.disabled = !manuel();
      zoneFaits.addEventListener('input', () => { if (manuel()) ui.faits = zoneFaits.value; });
      contenu.push(el('p', { classe: 'atelier-titre', texte: 'FAITS TECHNIQUES (AT-5)' }),
        el('label', { classe: 'champ' }, el('span', { texte: 'Coller les faits du run (« Faits à copier tels quels »)' }), zoneFaits),
        bouton('Confronter les faits', 'confronter', confronterFaits, { principal: true, actif: manuel() && permis('confronter') }),
        ...p.faits.map((f, i) => ligneTexte(`Faits n° ${i + 1} — run ${f.lu.faits.provenance.run_id} — empreinte ${f.lu.faits.empreinte.slice(0, 16)}… (texte exact conservé)`, `faits-recus-${i}`)));
    }
    const c = confrontationCourante();
    if (c) contenu.push(blocFaits(c.faits.lu.faits), blocVerdict(c.resultat));
    return section('verification', titre, ...contenu, message('verification'));
  }
  function blocFaits(f) {
    const id = f.identite;
    const fichiers = f.diff.fichiers.map((x) => `${x.chemin} (${x.etat})`).join(', ') || '(aucun)';
    return el('div', { classe: 'resultat', attrs: { 'data-atelier': 'faits-techniques' } },
      el('p', { classe: 'atelier-titre', texte: 'Faits techniques du dernier run (établis par AT-5, jamais par le rapport)' }),
      el('p', { texte: `Run ${f.provenance.run_id} — identité ${id.statut} — segment d'outillage : ${id.segment.statut}, ${id.segment.commits} commit(s)` }),
      el('p', { texte: `Diff ${f.diff.statut} : ${fichiers}` }),
      el('p', { texte: `Tests ${f.tests.statut} : ${f.tests.total} au total, ${f.tests.reussis} réussis, ${f.tests.echecs} échecs` }),
      el('p', { texte: `Exécution ${f.execution.statut} — durée ${f.execution.duree_tests_ms} ms, délai ${f.execution.delai_ms} ms — version injectée ${f.execution.version_injectee}` }),
      el('p', { texte: `Robot : syntaxe ${f.robot.syntaxe}, JSON ${f.robot.json}, fumée ${f.robot.fumee}` }));
  }
  function blocVerdict(r) {
    const liste = (titre, l, nom) => (l.length ? [el('p', { classe: 'atelier-titre', texte: titre }), el('ul', { attrs: { 'data-atelier': nom } }, ...l.map((x) => el('li', { texte: x })))] : []);
    return el('div', { classe: 'resultat atelier-verification', attrs: { 'data-atelier': 'verdict' } },
      el('p', { classe: 'atelier-titre', texte: 'Verdict technique — ce n\'est pas une acceptation.' }),
      el('p', { texte: `Verdict : ${r.verdict_technique}`, attrs: { 'data-atelier': 'verdict-technique' } }),
      el('p', { texte: 'Recalculé à l\'instant depuis la mission lancée, le rapport enregistré et les faits ; il ne déclenche rien.' }),
      ...liste('À examiner', r.a_examiner, 'a-examiner'), ...liste('Raisons de non-conformité', r.raisons_non_conformite, 'raisons-non-conformite'),
      ...liste('Raisons d\'impossibilité', r.raisons_impossibilite, 'raisons-impossibilite'));
  }

  function sectionDecision() {
    const e = etatChantier();
    const et = etapeCourante();
    const contenu = [el('p', { classe: 'atelier-titre', texte: 'DÉCISION HUMAINE' }),
      ligneTexte('Toi seul décides. Une acceptation n\'est ni un dépôt, ni une acquisition, et ne modifie pas main.')];
    if (e && e.statut === 'termine') {
      contenu.push(ligneTexte('Chantier terminé (état technique). Ni dépôt sur main, ni acquisition.', 'chantier-termine'));
      for (const t of tentativesDuJournal(lu.copie.journal)) {
        if (t.decision && t.decision.type === 'tentative-acceptee') contenu.push(ligneTexte(`Jalon ${t.jalon}, tentative ${t.numero} — candidat accepté : ${t.rendue.reference}`, `accepte-${t.jalon}`));
      }
    }
    if (et.etape === 'verification-a-refaire') contenu.push(ligneTexte('Vérification impossible : aucune acceptation ni aucun refus du candidat sur ces faits. Relance une vérification, ou annule la tentative.', 'decision-impossible'));
    if (['accepter', 'refuser', 'annuler'].some(permis)) {
      contenu.push(saisie('Ton motif (obligatoire)', ui.motifDecision, (x) => { ui.motifDecision = x; }, { nom: 'motif-decision', multi: true, rangs: 2 }));
      if (permis('accepter')) contenu.push(bouton(`Accepter le candidat (tentative ${et.numero})`, 'accepter', () => decider('tentative-acceptee'), { principal: true, actif: manuel() }));
      if (permis('refuser')) contenu.push(bouton(`Refuser le candidat (tentative ${et.numero})`, 'refuser', () => decider('tentative-rejetee'), { actif: manuel() }));
      if (permis('annuler')) contenu.push(bouton(`Annuler la tentative ${et.numero}`, 'annuler', annuler, { actif: manuel() }));
    }
    return section('decision', '8. Décision humaine', ...contenu, message('decision'));
  }

  function sectionJournal() {
    const c = lu.copie;
    const resume = (d, montants) => Object.keys(d).map((k) => `${k} = ${montants && Number.isSafeInteger(d[k]) && k !== 'n' ? usd(d[k]) : JSON.stringify(d[k])}`).join(' ; ');
    const liste = (journal, nom, montants) => el('ul', { classe: 'atelier-journal', attrs: { 'data-atelier': nom } },
      ...(journal || []).map((ev) => el('li', { texte: `${ev.n}. ${ev.type} — ${ev.quand} — ${resume(ev.donnees, montants)}` })));
    return section('journaux', '9. Journal technique',
      el('p', { classe: 'atelier-titre', texte: 'Journal du chantier (AT-1)' }), c.journal ? liste(c.journal, 'journal-chantier', false) : ligneTexte('(vide)', 'journal-chantier-vide'),
      el('p', { classe: 'atelier-titre', texte: 'Registre de budget (AT-2)' }), c.registre ? liste(c.registre, 'registre-budget', true) : ligneTexte('(vide)', 'registre-budget-vide'),
      ligneTexte('Lecture seule. Les fiches de jalon et les rapports vérifiés n\'entrent dans aucun de ces deux journaux.'));
  }

  function rendre() {
    sections.length = 0;
    zone.textContent = '';
    if (!lu.copie) {
      zone.append(bandeau(null), el('p', { classe: 'resultat resultat-erreur', texte: `Copie locale illisible : rien n'est utilisé (${lu.illisible}).`, attrs: { 'data-atelier': 'illisible' } }), blocEffacer());
      return;
    }
    const e = etatChantier();
    if (ui.section === null) ui.section = SECTION_DE_L_ETAPE[etapeCourante().etape] || (manuel() && e && e.statut === 'en-cours' ? 'dossier' : 'chantier');
    zone.append(bandeau(e), sectionChantier(e), sectionPlan(e), sectionFiche(e), sectionBudget(e), sectionDossier(), sectionRapport(), sectionVerification(), sectionDecision(), sectionJournal(), blocEffacer());
  }
  function blocEffacer() {
    return el('div', { classe: 'bloc' },
      ligneTexte('Copie de travail locale jetable : ni autorité Git, ni acquisition, ni sauvegarde de Naissance.'),
      bouton(ui.confirmerEffacement ? 'Confirmer : effacer l\'atelier de cet appareil' : 'Effacer l\'atelier de cet appareil', 'effacer', effacer));
  }

  rendre();
  return {
    rafraichir() {
      lu = lireCopie(stockage, version);
      ui = { ...ui, dossier: null, copie: null, verification: null, confirmerEffacement: false };
      rendre();
    },
  };
}

// Nombre d'octets UTF-8 d'une chaîne (affichage seulement).
function octets(s) {
  let n = 0;
  for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }
  return n;
}
// === FIN_ATELIER_ECRAN ===
