// === DEBUT_STOCKAGE_REGLAGES ===
// Réglages gardés UNIQUEMENT sur l'appareil (localStorage).
// Point d'entrée unique : pourra passer plus tard au stockage natif sans toucher au reste.
// Forme : { fournisseur, parFournisseur: { gemini: { cle, methode, modele, modeles, testeLe } } }

import { FOURNISSEUR_PAR_DEFAUT } from '../fournisseurs/registre.js';

export const CLE_STOCKAGE = 'naissance-ia.reglages.v1';

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function reglagesVides() {
  return { fournisseur: FOURNISSEUR_PAR_DEFAUT, parFournisseur: {} };
}

export function lireReglages(stockage = stockageParDefaut()) {
  try {
    const brut = stockage && stockage.getItem(CLE_STOCKAGE);
    if (!brut) return reglagesVides();
    const r = JSON.parse(brut);
    if (!r || typeof r !== 'object') return reglagesVides();
    return {
      fournisseur: typeof r.fournisseur === 'string' ? r.fournisseur : FOURNISSEUR_PAR_DEFAUT,
      parFournisseur: r.parFournisseur && typeof r.parFournisseur === 'object' ? r.parFournisseur : {},
    };
  } catch {
    return reglagesVides();
  }
}

export function ecrireReglages(reglages, stockage = stockageParDefaut()) {
  try {
    stockage.setItem(CLE_STOCKAGE, JSON.stringify(reglages));
    return true;
  } catch {
    return false;
  }
}

export function reglagesDe(reglages, idFournisseur) {
  return (reglages.parFournisseur && reglages.parFournisseur[idFournisseur]) || {};
}

// Modifie les réglages d'un fournisseur et enregistre. Une valeur null efface le champ.
export function modifierFournisseur(idFournisseur, changements, stockage = stockageParDefaut()) {
  const r = lireReglages(stockage);
  const actuel = { ...reglagesDe(r, idFournisseur) };
  for (const [k, v] of Object.entries(changements)) {
    if (v === null || v === undefined) delete actuel[k];
    else actuel[k] = v;
  }
  r.parFournisseur = { ...r.parFournisseur, [idFournisseur]: actuel };
  r.fournisseur = idFournisseur;
  const ok = ecrireReglages(r, stockage);
  return { reglages: r, ok };
}
// === FIN_STOCKAGE_REGLAGES ===
