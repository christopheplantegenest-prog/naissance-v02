// === DEBUT_BROUILLON ===
// Le message qui n'a pas pu partir est gardé sur l'appareil (localStorage),
// même si l'appli est fermée, jusqu'à ce qu'il soit envoyé avec succès.
// Ce n'est PAS la mémoire de Naissance : rien n'entre dans son journal avant une vraie réponse.

export const CLE_BROUILLON = 'naissance-ia.message-en-attente.v1';

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function lireBrouillon(stockage = stockageParDefaut()) {
  try {
    const brut = stockage && stockage.getItem(CLE_BROUILLON);
    const b = brut ? JSON.parse(brut) : null;
    return b && typeof b.texte === 'string' && b.texte.trim() ? b : null;
  } catch {
    return null;
  }
}

// ÉTAPE 5.2-bis — RÉFÉRENCE EXPLICITE D'UNE VRAIE EXPÉRIENCE À UNE TRACE : 4e paramètre FACULTATIF,
// purement additif. Quand referenceTrace est absent/null (tout appelant existant, non modifié), la
// forme écrite reste EXACTEMENT { texte, date } -- voir tests/brouillon.test.mjs (pinné, inchangé).
// Cet état appartient au brouillon/UI, pas encore à la mémoire de Naissance (voir conversation/
// ecran.js : aucune écriture ici ne crée jamais d'acte/expérience/trace).
export function garderBrouillon(texte, date, stockage = stockageParDefaut(), referenceTrace = null) {
  try {
    if (!String(texte || '').trim()) { stockage.removeItem(CLE_BROUILLON); return; }
    const objet = { texte, date };
    if (referenceTrace && referenceTrace.idTrace) objet.referenceTrace = { idTrace: referenceTrace.idTrace };
    stockage.setItem(CLE_BROUILLON, JSON.stringify(objet));
  } catch {
    // stockage indisponible : le texte reste au moins dans le champ
  }
}

export function effacerBrouillon(stockage = stockageParDefaut()) {
  try { stockage.removeItem(CLE_BROUILLON); } catch { /* rien à faire */ }
}
// === FIN_BROUILLON ===
