// === DEBUT_MODE_LOCAL ===
// Préférence « Utiliser Naissance sans moteur externe », gardée UNIQUEMENT sur l'appareil, sous une clé propre,
// distincte de celle des réglages du fournisseur (jamais lus ni écrits ici).
// Désactivée par défaut : seule la valeur exacte {"actif":true} l'active ; absente, illisible ou autre : désactivée.
// Jamais activée automatiquement : seule ecrireModeLocal change la valeur.
// Ce module ne fait aucun appel réseau et n'importe aucun fournisseur : c'est le seul point de passage vers le
// moteur externe (la liste des fournisseurs, dans app/fournisseurs/) qui lit cette préférence.

import { ErreurFournisseur } from '../fournisseurs/erreurs.js';

export const CLE_MODE_LOCAL = 'naissance-ia.mode-local.v1';

export const REPONSE_SANS_VOIE_LOCALE = "Je n'ai pas de réponse locale à ce message.";
export const MESSAGE_MOTEUR_COUPE = "Mode local : aucun moteur externe n'est appelé. Décoche la case du mode local dans les Réglages pour le réutiliser.";
export const MESSAGE_COURS_REFUSE = "Sans moteur externe, je ne peux pas décomposer ce cours : rien n'a été appelé, rien n'a été retenu.";
export const MESSAGE_TEST_BLOQUE = "Test de clé bloqué : le mode local est en cours, aucun appel au fournisseur. Rien n'a été enregistré.";
export const MESSAGE_RANGEMENT_BLOQUE = "mode local en cours : aucun moteur externe n'est appelé, rien n'a été rangé.";
export const MESSAGE_PLUS_FORT_REFUSE = "Sans moteur externe, je ne peux pas demander à un modèle plus fort : rien n'a été appelé.";

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// true SEULEMENT si la valeur stockée est exactement {"actif":true} ; tout le reste (absence, illisible, stockage
// indisponible, autre forme) : false.
export function lireModeLocal(stockage = stockageParDefaut()) {
  try {
    if (!stockage || typeof stockage.getItem !== 'function') return false;
    const brut = stockage.getItem(CLE_MODE_LOCAL);
    if (typeof brut !== 'string' || !brut) return false;
    const v = JSON.parse(brut);
    return !!v && typeof v === 'object' && !Array.isArray(v) && v.actif === true;
  } catch {
    return false;
  }
}

// Écrit {"actif":true} ou {"actif":false} sous la seule clé du mode local. Rend true si l'écriture a réussi.
export function ecrireModeLocal(actif, stockage = stockageParDefaut()) {
  try {
    if (!stockage || typeof stockage.setItem !== 'function') return false;
    stockage.setItem(CLE_MODE_LOCAL, JSON.stringify({ actif: actif === true }));
    return true;
  } catch {
    return false;
  }
}

export function texteEtatModeLocal(actif) {
  return actif === true ? 'Mode local actif' : 'Mode local inactif';
}

// Erreur rendue par le fournisseur coupé : code « reglage », qui arrête immédiatement la couche de fiabilité
// (ni relance, ni repli de modèle, aucune santé notée).
export function erreurModeLocal() {
  return new ErreurFournisseur('reglage', MESSAGE_MOTEUR_COUPE, 'mode local actif');
}
// === FIN_MODE_LOCAL ===
