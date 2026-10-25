// === DEBUT_CAPACITES_JETON ===
// v0.66.6 — ATELIER 2, L2 : jeton GitHub de l'écran « Atelier — capacités », gardé UNIQUEMENT sur l'appareil (localStorage, clé propre).
// Jamais exporté (la sauvegarde de Naissance ne lit pas localStorage), jamais affiché après l'enregistrement, jamais journalisé.
// Seul un jeton « fine-grained » (github_pat_…) est accepté : il se crée pour le seul dépôt naissance-v02 avec la seule permission
// « Issues : Read and write ». Un jeton classique (ghp_…) couvre tous les dépôts : refusé.
export const CLE_JETON = 'naissance-ia.atelier.jeton.v1';
const RE_JETON = /^github_pat_[A-Za-z0-9_]{30,250}$/;

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

// Texte collé -> { jeton } ou { raison } (la raison ne cite jamais le texte).
export function lireSaisieJeton(texte) {
  const t = String(texte ?? '').trim();
  if (!t) return { raison: 'Coller le jeton.' };
  if (/^(ghp|gho|ghu|ghs|ghr)_/.test(t)) return { raison: 'Jeton classique refusé : créer un jeton « fine-grained » limité au dépôt naissance-v02 (permission Issues : Read and write).' };
  if (!RE_JETON.test(t)) return { raison: 'Ce n\'est pas un jeton « fine-grained » GitHub complet (il commence par github_pat_).' };
  return { jeton: t };
}

export function lireJeton(stockage = stockageParDefaut()) {
  try {
    const j = stockage && stockage.getItem(CLE_JETON);
    return typeof j === 'string' && RE_JETON.test(j) ? j : null;
  } catch {
    return null;
  }
}
export function enregistrerJeton(texte, stockage = stockageParDefaut()) {
  const s = lireSaisieJeton(texte);
  if (s.raison) return { ok: false, raison: s.raison };
  try { stockage.setItem(CLE_JETON, s.jeton); return { ok: true }; } catch { return { ok: false, raison: 'Impossible d\'enregistrer sur cet appareil (stockage indisponible).' }; }
}
export function effacerJeton(stockage = stockageParDefaut()) {
  try { stockage.removeItem(CLE_JETON); return true; } catch { return false; }
}
// === FIN_CAPACITES_JETON ===
