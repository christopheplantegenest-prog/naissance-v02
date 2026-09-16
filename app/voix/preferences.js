// === DEBUT_PREFERENCES_VOIX ===
// Préférences de voix : réglage technique de l'appareil (localStorage),
// jamais mêlé à la mémoire de Naissance ni exporté.

export const CLE_VOIX = 'naissance-ia.voix.v1';
export const PREFERENCES_PAR_DEFAUT = Object.freeze({ lectureAuto: false });

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function lirePreferencesVoix(stockage = stockageParDefaut()) {
  try {
    const brut = stockage && stockage.getItem(CLE_VOIX);
    const p = brut ? JSON.parse(brut) : {};
    return { ...PREFERENCES_PAR_DEFAUT, lectureAuto: !!(p && p.lectureAuto) };
  } catch {
    return { ...PREFERENCES_PAR_DEFAUT };
  }
}

export function ecrirePreferencesVoix(changements, stockage = stockageParDefaut()) {
  const p = { ...lirePreferencesVoix(stockage), ...changements };
  try { stockage.setItem(CLE_VOIX, JSON.stringify(p)); } catch { /* sans effet */ }
  return p;
}
// === FIN_PREFERENCES_VOIX ===
