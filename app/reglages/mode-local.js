// === DEBUT_MODE_LOCAL ===
// Préférence « Utiliser Naissance sans moteur externe », gardée UNIQUEMENT sur l'appareil (localStorage),
// sous une clé propre, distincte des réglages du fournisseur (naissance-ia.reglages.v1).
// Désactivée par défaut ; jamais activée automatiquement : seul ecrireModeLocal change la valeur.
// Aucun appel réseau, aucun import du registre ni du module du fournisseur : le seul import est la classe commune
// des erreurs des fournisseurs (erreurs.js, qui n'importe rien). C'est le registre des fournisseurs
// (registre.js, seul point de passage vers un moteur externe) qui lit cette préférence pour couper
// le moteur externe à la source.
import { ErreurFournisseur } from '../fournisseurs/erreurs.js';

export const CLE_MODE_LOCAL = 'naissance-ia.mode-local.v1';

export const REPONSE_SANS_VOIE_LOCALE = "Je n'ai pas de réponse locale à ce message.";
export const MESSAGE_MOTEUR_COUPE = "Mode local : aucun moteur externe n'est appelé. Décoche la case du mode local dans les Réglages pour le réutiliser.";
export const MESSAGE_COURS_REFUSE = "Sans moteur externe, je ne peux pas décomposer ce cours : rien n'a été appelé, rien n'a été retenu.";
export const MESSAGE_TEST_BLOQUE = "Test de clé bloqué : le mode local est en cours, aucun appel au fournisseur. Rien n'a été enregistré.";
export const MESSAGE_RANGEMENT_BLOQUE = "mode local en cours : aucun moteur externe n'est appelé, rien n'a été rangé.";
export const MESSAGE_PLUS_FORT_REFUSE = "Sans moteur externe, je ne peux pas demander à un modèle plus fort : rien n'a été appelé.";

export const CODE_MODE_LOCAL = 'reglage';

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// Vrai SEULEMENT si la valeur stockée est exactement {"actif":true}. Absente, illisible ou autre : faux.
export function lireModeLocal(stockage = stockageParDefaut()) {
  try {
    const brut = stockage && stockage.getItem(CLE_MODE_LOCAL);
    if (typeof brut !== 'string' || !brut) return false;
    const v = JSON.parse(brut);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const cles = Object.keys(v);
    return cles.length === 1 && cles[0] === 'actif' && v.actif === true;
  } catch {
    return false;
  }
}

// Écrit {"actif":true|false} sous la seule clé du mode local. Rend true si l'écriture a réussi, sinon false.
export function ecrireModeLocal(actif, stockage = stockageParDefaut()) {
  try {
    if (!stockage) return false;
    stockage.setItem(CLE_MODE_LOCAL, JSON.stringify({ actif: actif === true }));
    return true;
  } catch {
    return false;
  }
}

export function texteEtatModeLocal(actif) {
  return actif === true ? 'Mode local actif' : 'Mode local inactif';
}

// Erreur du moteur coupé : ErreurFournisseur de code « reglage » (la couche de fiabilité s'arrête
// immédiatement, aucune relance, aucun repli de modèle ; enErreurFournisseur la garde telle quelle)
// et message fixe. Une erreur neuve à chaque appel.
export function erreurModeLocal() {
  return new ErreurFournisseur(CODE_MODE_LOCAL, MESSAGE_MOTEUR_COUPE);
}
// === FIN_MODE_LOCAL ===
