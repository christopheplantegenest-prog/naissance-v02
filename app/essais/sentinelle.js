// === DEBUT_ESSAIS_SENTINELLE ===
// v0.66.8 — ATELIER 2, L3 : SENTINELLES des capacités en essai (mécanisme technique, non cognitif ; protégé : app/essais/).
// Seul module de la porte chargé au démarrage (import statique de main.js) : synchrone, sans réseau, sans base, sans Worker.
//
// ouvrirDemarrage(stockage, quand) — appelé tout au début de main.js :
//   1. marque de DÉMARRAGE encore présente = le démarrage précédent n'est jamais allé jusqu'au bout (plantage, gel, arrêt) : TOUTES les
//      capacités actives sont coupées (mode sûr : l'application démarre exactement comme sans essai) ;
//   2. marque d'EXÉCUTION encore présente = l'application s'est arrêtée pendant l'exécution d'une capacité : CETTE capacité est coupée ;
//   3. pose la marque de démarrage. -> { coupes: [{ id, motif }] }
// fermerDemarrage(stockage) — appelé quand le démarrage est complet (juste avant le signal lu par le robot) : retire la marque.
// Prudence assumée : un arrêt de l'application pendant le démarrage pour une autre cause coupe aussi les essais actifs (réactivation à la main).
// Stockage indisponible : rien n'est coupé ni posé, et rien ne peut être actif (lireRegistre rend un registre vide).
import { CLE_DEMARRAGE, CLE_EXECUTION, lireRegistre, ecrireRegistre, essaisActifs, couper } from './registre-essais.js';

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}
const lire = (stockage, cle) => { try { return stockage.getItem(cle); } catch { return null; } };

export function ouvrirDemarrage(stockage = stockageParDefaut(), quand = new Date().toISOString()) {
  const coupes = [];
  if (!stockage) return { coupes };
  try {
    let r = lireRegistre(stockage);
    const marqueExecution = lire(stockage, CLE_EXECUTION);
    if (marqueExecution) {
      let id = null;
      try { id = JSON.parse(marqueExecution).id; } catch { id = null; }
      if (typeof id === 'string' && essaisActifs(r).includes(id)) {
        const motif = 'application arrêtée pendant une exécution de la capacité';
        r = couper(r, id, quand, motif, true);
        coupes.push({ id, motif });
      }
      stockage.removeItem(CLE_EXECUTION);
    }
    if (lire(stockage, CLE_DEMARRAGE)) {
      for (const id of essaisActifs(r)) {
        const motif = 'démarrage précédent interrompu (mode sûr)';
        r = couper(r, id, quand, motif, true);
        coupes.push({ id, motif });
      }
    }
    if (coupes.length) ecrireRegistre(r, stockage);
    stockage.setItem(CLE_DEMARRAGE, quand);
  } catch {
    // stockage refusé : aucune marque ; rien d'actif ne peut être lu non plus
  }
  return { coupes };
}

export function fermerDemarrage(stockage = stockageParDefaut()) {
  try { stockage.removeItem(CLE_DEMARRAGE); return true; } catch { return false; }
}

// Marque d'exécution (posée par la porte juste avant d'exécuter une capacité, retirée juste après).
export function marquerExecution(stockage, id, quand) {
  try { stockage.setItem(CLE_EXECUTION, JSON.stringify({ id, quand })); return true; } catch { return false; }
}
export function leverExecution(stockage) {
  try { stockage.removeItem(CLE_EXECUTION); return true; } catch { return false; }
}
// === FIN_ESSAIS_SENTINELLE ===
