// === DEBUT_REGLAGES_MOTEUR_LOCAL ===
// Réglages et mesures du moteur local : données TECHNIQUES de l'appareil (localStorage),
// jamais mêlées à la mémoire de Naissance ni exportées.

export const CLE_REGLAGES_LOCAL = 'naissance-ia.moteur-local.v1';
export const CLE_MESURES_LOCAL = 'naissance-ia.mesures-local.v1';
export const MODES = Object.freeze({
  'local-seul': 'Local seulement',
  'local-dabord': "Local d'abord",
  'externe-dabord': "Externe d'abord",
  'externe-seul': 'Externe seulement',
});
export const MODE_PAR_DEFAUT = 'externe-seul';
const MAX_MESURES = 30;

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function lireReglagesLocaux(stockage = stockageParDefaut()) {
  try {
    const r = JSON.parse((stockage && stockage.getItem(CLE_REGLAGES_LOCAL)) || '{}') || {};
    return {
      mode: Object.hasOwn(MODES, r.mode) ? r.mode : MODE_PAR_DEFAUT,
      suspendu: !!r.suspendu,
      raisonSuspension: typeof r.raisonSuspension === 'string' ? r.raisonSuspension : '',
    };
  } catch {
    return { mode: MODE_PAR_DEFAUT, suspendu: false, raisonSuspension: '' };
  }
}

export function ecrireReglagesLocaux(changements, stockage = stockageParDefaut()) {
  const r = { ...lireReglagesLocaux(stockage), ...changements };
  if (!Object.hasOwn(MODES, r.mode)) r.mode = MODE_PAR_DEFAUT;
  try { stockage.setItem(CLE_REGLAGES_LOCAL, JSON.stringify(r)); } catch { /* sans effet */ }
  return r;
}

export function lireMesures(stockage = stockageParDefaut()) {
  try {
    const m = JSON.parse((stockage && stockage.getItem(CLE_MESURES_LOCAL)) || '[]');
    return Array.isArray(m) ? m : [];
  } catch {
    return [];
  }
}

export function noterMesure(mesure, stockage = stockageParDefaut()) {
  const liste = [...lireMesures(stockage), mesure].slice(-MAX_MESURES);
  try { stockage.setItem(CLE_MESURES_LOCAL, JSON.stringify(liste)); } catch { /* sans effet */ }
  return liste;
}

const nombre = (v, d = 1) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: d }) : '?');

export function resumeMesure(m) {
  if (!m) return "Aucune réponse locale mesurée pour l'instant.";
  const cache = { mémoire: 'identité en mémoire', fichier: 'identité relue depuis le cache', calculé: 'identité recalculée' }[m.cache] || m.cache;
  return `Dernière réponse locale : premier mot en ${nombre((m.premierMotMs || 0) / 1000)} s (${cache}), `
    + `lecture ${nombre(m.lectureJps)} jetons/s (${m.jetonsSuite} jetons lus${m.cache === 'calculé' ? ` + ${m.jetonsPrefixe} d'identité` : ''}), `
    + `écriture ${nombre(m.ecritureJps)} jetons/s (${m.jetonsEcrits} jetons).`;
}
// === FIN_REGLAGES_MOTEUR_LOCAL ===
