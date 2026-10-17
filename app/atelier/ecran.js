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

import { ouvrirChantier, appliquer, etatDe, verifierJournal } from './chantier.js';
import { ouvrirRegistre, appliquerBudget, etatBudget, verifierRegistre } from './budget.js';
import { construireMission, verifierRapport } from './mission.js';
import { lireUSD, ecrireUSD } from './montants.js';

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
const copieVide = (version) => ({ version: 1, mode: 'OFF', formulaire: formulaireVide(version), fiches: {}, journal: null, registre: null, mission: null });

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
  if (!objet(c) || c.version !== 1 || !Object.hasOwn(c, 'mission')) return 'version de copie inconnue';
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
  return null;
}

function lireCopie(stockage, version) {
  let brut = null;
  try { brut = stockage ? stockage.getItem(CLE_ATELIER) : null; } catch { brut = null; }
  if (!brut) return { copie: copieVide(version) };
  let c;
  try { c = JSON.parse(brut); } catch { return { illisible: 'texte illisible' }; }
  const r = raisonCopie(c);
  return r ? { illisible: r } : { copie: c };
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
  let ui = { section: null, message: null, dossier: null, copie: null, rapport: '', verification: null, confirmerEffacement: false };

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
  const champ = (libelle, valeur, surSaisie, { nom, multi = false, rangs = 3, aide = '', clavier = '' } = {}) => {
    const entree = el(multi ? 'textarea' : 'input', { attrs: { 'data-atelier': nom, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', ...(clavier ? { inputmode: clavier } : {}) } });
    if (multi) entree.rows = rangs; else entree.type = 'text';
    entree.value = valeur;
    entree.disabled = !manuel();
    entree.addEventListener('input', () => { if (manuel()) { surSaisie(entree.value); sauver(); } });
    return el('label', { classe: 'champ' }, el('span', { texte: libelle }), entree, aide ? el('span', { classe: 'aide', texte: aide }) : null);
  };
  const message = (section) => (ui.message && ui.message.section === section
    ? el('p', { classe: `resultat ${ui.message.erreur ? 'resultat-erreur' : 'resultat-ok'}`, texte: ui.message.texte, attrs: { 'data-atelier': 'message' } }) : null);
  const dire = (section, texte, erreur = false) => { ui.message = { section, texte, erreur }; };

  function sauver() {
    if (!lu.copie) return false;
    try { stockage.setItem(CLE_ATELIER, JSON.stringify(lu.copie)); return true; } catch { dire('bandeau', 'Copie locale non enregistrée sur cet appareil.', true); return false; }
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
    const reference = lu.copie.mission;
    if (!reference) ui.verification = { structure: 'impossible', raison: 'aucun dossier généré' };
    else try { ui.verification = verifierRapport(reference, ui.rapport); } catch (e) { ui.verification = { structure: 'impossible', raison: e.message }; }
    rendre();
  }
  function effacer() {
    if (!ui.confirmerEffacement) { ui.confirmerEffacement = true; rendre(); return; }
    try { if (stockage) stockage.removeItem(CLE_ATELIER); } catch { /* rien à faire de plus */ }
    lu = { copie: copieVide(version) };
    ui = { section: null, message: null, dossier: null, copie: null, rapport: '', verification: null, confirmerEffacement: false };
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
    const decisions = f.decisions.map((d, i) => el('div', { classe: 'atelier-decision' },
      champ(`Décision ${i + 1} : identifiant`, d.id, (v) => { d.id = v; }, { nom: `decision-${i}-id`, aide: 'D-xxx' }),
      champ(`Décision ${i + 1} : texte copié`, d.texte, (v) => { d.texte = v; }, { nom: `decision-${i}-texte`, multi: true })));
    return section('fiche', '3. Fiche du jalon courant',
      ligneTexte(`Jalon ${j.id} — ${j.titre}`), ligneTexte(`Critère (AT-1, inchangé) : ${j.critere}`),
      ligneTexte('Une ligne = un élément. Une ligne vide est refusée.'),
      champ('Comportement observable', f.comportement, (v) => { f.comportement = v; }, { nom: 'comportement', multi: true }),
      champ('Critères d\'acceptation', f.criteres, (v) => { f.criteres = v; }, { nom: 'criteres', multi: true }),
      champ('Tests exigés', f.tests, (v) => { f.tests = v; }, { nom: 'tests', multi: true }),
      champ('Chemins autorisés', f.autorises, (v) => { f.autorises = v; }, { nom: 'autorises', multi: true, aide: 'Fichier, ou dossier terminé par /.' }),
      champ('Chemins interdits (facultatif)', f.interdits, (v) => { f.interdits = v; }, { nom: 'interdits', multi: true, rangs: 2 }),
      champ('Frontières (facultatif)', f.frontieres, (v) => { f.frontieres = v; }, { nom: 'frontieres', multi: true, rangs: 2 }),
      ...decisions,
      el('div', { classe: 'ligne' },
        bouton('+ décision', 'ajouter-decision', agir('fiche', () => { f.decisions.push({ id: '', texte: '' }); sauver(); }), { actif: manuel() }),
        bouton('− dernière décision', 'retirer-decision', agir('fiche', () => { f.decisions.pop(); sauver(); }), { actif: manuel() && f.decisions.length > 0 })),
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

  function sectionDossier() {
    if (!manuel()) return section('dossier', '5. Dossier de mission', ligneTexte('Mode OFF : consultation seulement. Aucune génération, aucune copie.', 'off-dossier'));
    const contenu = [bouton('Générer le dossier', 'generer', generer, { principal: true })];
    if (ui.dossier) {
      const apercu = el('textarea', { classe: 'atelier-dossier', attrs: { 'data-atelier': 'dossier', readonly: '', spellcheck: 'false' } });
      apercu.readOnly = true;
      apercu.rows = 12;
      apercu.value = ui.dossier.texte;
      contenu.push(apercu, ligneTexte(`${octets(ui.dossier.texte)} octets UTF-8 — texte exact du dossier, sans ajout.`),
        bouton('Copier', 'copier', copierDossier, { principal: true }),
        ui.copie ? el('p', { classe: `resultat ${ui.copie.ok ? 'resultat-ok' : 'resultat-erreur'}`, texte: ui.copie.texte, attrs: { 'data-atelier': 'copie' } }) : null);
    }
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
      ui.verification ? resultatRapport(ui.verification) : null);
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

  function sectionJournal() {
    const c = lu.copie;
    const resume = (d, montants) => Object.keys(d).map((k) => `${k} = ${montants && Number.isSafeInteger(d[k]) && k !== 'n' ? usd(d[k]) : JSON.stringify(d[k])}`).join(' ; ');
    const liste = (journal, nom, montants) => el('ul', { classe: 'atelier-journal', attrs: { 'data-atelier': nom } },
      ...(journal || []).map((ev) => el('li', { texte: `${ev.n}. ${ev.type} — ${ev.quand} — ${resume(ev.donnees, montants)}` })));
    return section('journaux', '7. Journal technique',
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
    if (ui.section === null) ui.section = manuel() && e && e.statut === 'en-cours' ? 'dossier' : 'chantier';
    zone.append(bandeau(e), sectionChantier(e), sectionPlan(e), sectionFiche(e), sectionBudget(e), sectionDossier(), sectionRapport(), sectionJournal(), blocEffacer());
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
