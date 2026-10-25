// === DEBUT_ESSAIS_REGISTRE ===
// v0.66.8 — ATELIER 2, L3 (GO « ATELIER 2 — GO CONSTRUCTION L3 », 25/10/2026) : REGISTRE des capacités en essai. Mécanisme technique, non
// cognitif : il ne décide rien de ce que Naissance sait ; il dit quelles capacités expérimentales existent, lesquelles sont actives, et garde
// la trace technique de leurs exécutions. Protégé (app/essais/) : l'Atelier autonome ne peut ni le modifier ni y ajouter une capacité.
// (Nommé registre-essais.js : app/langage/registre.js est le registre des opérations, sans rapport.)
//
// CATALOGUE : déclarations figées, livrées avec la version. Une déclaration dit ce que la capacité LIT (tables existantes, en lecture seule,
// par copie), quand elle s'exécute, ses invariants et ses bornes. Elle n'a qu'un effet possible : ajouter des lignes dans la ZONE D'ESSAI
// (base séparée 'naissance-essais', voir zone.js). Toute autre forme d'effet est REFUSÉE (validerDeclaration).
//
// ÉTAT LOCAL (localStorage, clé CLE_REGISTRE) : technique, hors des 36 tables, jamais exporté avec la sauvegarde de Naissance.
//   { v: 1, essais: { [id]: { etat: 'actif' | 'coupe', installe, depuis, version, verifie, motif, auto, executions, lignes, anomalies,
//     derniere } }, journal: [{ quand, id, type, texte }] }   — une capacité absente de `essais` est INACTIVE (état par défaut).
// Le journal est borné (MAX_JOURNAL) et ne contient aucun texte de conversation : seulement des motifs techniques.
// Un état illisible est traité comme vide : rien n'est actif, donc rien ne s'exécute (aucun essai ne démarre « par défaut »).
import { TABLES } from '../langage/connaissances.js';

export const CLE_REGISTRE = 'naissance-ia.essais.v1';
export const CLE_DEMARRAGE = 'naissance-ia.essais.demarrage.v1';
export const CLE_EXECUTION = 'naissance-ia.essais.execution.v1';
export const MAX_JOURNAL = 40;
export const DELAI_MAX_MS = 5000;
export const LIGNES_MAX = 20;
export const INVARIANTS_MAX = 3;
export const DECLENCHEURS = Object.freeze(['apres-tour', 'manuel']);
export const TYPES_INVARIANT = Object.freeze(['champs', 'unique', 'apres-installation', 'max-par-execution']);
export const EPREUVES = Object.freeze(['panne', 'boucle', 'asynchrone', 'evasion', 'forme', 'doublon']);

const gel = (o) => Object.freeze(o);
export const CATALOGUE = gel([
  gel({
    id: 'temoin-porte',
    titre: 'Témoin de la porte d\'essai',
    description: 'Capacité de démonstration, sans contenu cognitif : à chaque tour, note un numéro et le nombre de réceptions lues. Sert à vérifier la porte (activation, coupure, provenance, pannes).',
    module: './temoin-porte.js',
    lit: gel(['receptions']),
    effet: 'zone-essai',
    declencheurs: gel(['apres-tour', 'manuel']),
    delaiMs: 3000,
    maxLignes: 1,
    invariants: gel([gel({ type: 'champs', champs: gel(['numero', 'receptions']) }), gel({ type: 'unique', champ: 'numero' }), gel({ type: 'apres-installation' })]),
    epreuves: EPREUVES,
  }),
]);

const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaine = (x) => typeof x === 'string' && x.length > 0;
export const RE_ID = /^[a-z][a-z0-9-]{2,40}$/;
export const RE_MODULE = /^\.\.?\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.js$/;
export const RE_CLE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

// Déclaration -> null si recevable, sinon le motif du refus (texte fixe).
export function validerDeclaration(d) {
  if (!objetSimple(d)) return 'déclaration illisible';
  if (!RE_ID.test(d.id || '')) return 'identifiant invalide';
  if (!chaine(d.titre)) return 'titre manquant';
  if (!RE_MODULE.test(d.module || '') || d.module.includes('/../') || d.module.startsWith('../essais/')) return 'module invalide (chemin relatif .js attendu, hors de la porte)';
  if (d.effet !== 'zone-essai') return 'effet refusé : seule la zone d\'essai peut recevoir des écritures (une capacité qui change une réponse ou une table existante n\'est pas isolable)';
  if (!Array.isArray(d.lit) || d.lit.some((t) => !TABLES.includes(t)) || new Set(d.lit).size !== d.lit.length) return 'lecture refusée : tables inconnues ou en double';
  if (!Array.isArray(d.declencheurs) || d.declencheurs.length === 0 || d.declencheurs.some((x) => !DECLENCHEURS.includes(x))) return 'déclencheur refusé';
  if (!Number.isInteger(d.delaiMs) || d.delaiMs < 100 || d.delaiMs > DELAI_MAX_MS) return 'délai refusé';
  if (!Number.isInteger(d.maxLignes) || d.maxLignes < 1 || d.maxLignes > LIGNES_MAX) return 'nombre de lignes refusé';
  if (!Array.isArray(d.invariants) || d.invariants.length > INVARIANTS_MAX) return 'invariants refusés (3 au plus)';
  for (const inv of d.invariants) {
    if (!objetSimple(inv) || !TYPES_INVARIANT.includes(inv.type)) return 'invariant inconnu';
    if (inv.type === 'champs' && (!Array.isArray(inv.champs) || inv.champs.length === 0 || !inv.champs.every(chaine))) return 'invariant « champs » invalide';
    if (inv.type === 'unique' && !chaine(inv.champ)) return 'invariant « unique » invalide';
    if (inv.type === 'max-par-execution' && (!Number.isInteger(inv.n) || inv.n < 1)) return 'invariant « max-par-execution » invalide';
  }
  if (d.epreuves !== undefined && (!Array.isArray(d.epreuves) || d.epreuves.some((x) => !EPREUVES.includes(x)))) return 'épreuve inconnue';
  return null;
}
export const declaration = (id, catalogue = CATALOGUE) => catalogue.find((d) => d.id === id) || null;

// ------------------------------------------------------------------------------------------------ état local
function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
const vide = () => ({ v: 1, essais: {}, journal: [] });
export function lireRegistre(stockage = stockageParDefaut()) {
  try {
    const brut = stockage && stockage.getItem(CLE_REGISTRE);
    if (!brut) return vide();
    const r = JSON.parse(brut);
    if (!objetSimple(r) || r.v !== 1 || !objetSimple(r.essais) || !Array.isArray(r.journal)) return vide();
    for (const [id, e] of Object.entries(r.essais)) if (!objetSimple(e) || (e.etat !== 'actif' && e.etat !== 'coupe')) delete r.essais[id];
    return r;
  } catch {
    return vide();
  }
}
// Écriture synchrone : une coupure est inscrite AVANT tout autre geste (un redémarrage ne peut pas la défaire).
export function ecrireRegistre(r, stockage = stockageParDefaut()) {
  try { stockage.setItem(CLE_REGISTRE, JSON.stringify(r)); return true; } catch { return false; }
}
export const etatDe = (r, id) => (r.essais[id] ? r.essais[id].etat : 'inactif');
export const essaisActifs = (r, catalogue = CATALOGUE) => catalogue.filter((d) => etatDe(r, d.id) === 'actif').map((d) => d.id);
export function aucunEssaiActif(stockage = stockageParDefaut(), catalogue = CATALOGUE) {
  return essaisActifs(lireRegistre(stockage), catalogue).length === 0;
}

// Transitions PURES : (registre, …) -> nouveau registre. Les compteurs d'une capacité survivent à ses coupures et réactivations.
export function journaliser(r, quand, id, type, texte) {
  const journal = [...r.journal, { quand, id, type, texte: String(texte).slice(0, 300) }].slice(-MAX_JOURNAL);
  return { ...r, journal };
}
const compteursVides = () => ({ executions: 0, lignes: 0, anomalies: 0, derniere: null });
export function activer(r, id, quand, version) {
  const avant = r.essais[id] || null;
  const e = { ...compteursVides(), ...(avant || {}), etat: 'actif', installe: (avant && avant.installe) || quand, depuis: quand, version, verifie: version, motif: null, auto: false };
  return journaliser({ ...r, essais: { ...r.essais, [id]: e } }, quand, id, 'activation', avant ? `réactivée (v${version})` : `activée (v${version})`);
}
export function couper(r, id, quand, motif, auto = false) {
  const avant = r.essais[id];
  if (!avant || avant.etat !== 'actif') return r;
  const e = { ...avant, etat: 'coupe', depuis: quand, motif: String(motif).slice(0, 300), auto, anomalies: avant.anomalies + (auto ? 1 : 0) };
  return journaliser({ ...r, essais: { ...r.essais, [id]: e } }, quand, id, auto ? 'coupure-automatique' : 'coupure', motif);
}
export function noterExecution(r, id, quand, lignes) {
  const avant = r.essais[id];
  if (!avant) return r;
  return { ...r, essais: { ...r.essais, [id]: { ...avant, executions: avant.executions + 1, lignes: avant.lignes + lignes, derniere: quand } } };
}
export function noterVerification(r, id, version) {
  const avant = r.essais[id];
  return avant ? { ...r, essais: { ...r.essais, [id]: { ...avant, verifie: version } } } : r;
}

// ------------------------------------------------------------------------------------------------ invariants (purs)
// lignes : les lignes déjà conservées de la capacité (zone) ; nouvelles : celles d'une exécution, pas encore écrites (vide à la relecture).
// -> null si respectés, sinon le motif.
export function violationInvariants(decl, etat, lignes, nouvelles = []) {
  const toutes = [...lignes, ...nouvelles];
  for (const inv of decl.invariants) {
    if (inv.type === 'champs') {
      const fautive = toutes.find((l) => !objetSimple(l.donnees) || inv.champs.some((c) => !Object.hasOwn(l.donnees, c)));
      if (fautive) return `invariant « champs » violé (ligne ${fautive.id})`;
    } else if (inv.type === 'unique') {
      const vus = new Set();
      for (const l of toutes) {
        const v = JSON.stringify(objetSimple(l.donnees) ? l.donnees[inv.champ] : undefined);
        if (vus.has(v)) return `invariant « unique » violé (${inv.champ} = ${v})`;
        vus.add(v);
      }
    } else if (inv.type === 'apres-installation') {
      const fautive = toutes.find((l) => !(typeof l.horodatage === 'string' && etat && typeof etat.installe === 'string' && l.horodatage >= etat.installe));
      if (fautive) return `invariant « après installation » violé (ligne ${fautive.id})`;
    } else if (inv.type === 'max-par-execution') {
      const parExecution = new Map();
      for (const l of toutes) parExecution.set(l.execution, (parExecution.get(l.execution) || 0) + 1);
      for (const [execution, n] of parExecution) if (n > inv.n) return `invariant « max-par-execution » violé (${n} lignes pour ${execution})`;
    }
  }
  return null;
}
// === FIN_ESSAIS_REGISTRE ===
