// === DEBUT_SANS_MOTEUR ===
// ticket-39 — Choix explicite « Utiliser Naissance sans moteur externe » (Réglages).
// Préférence d'interface, désactivée par défaut, jamais activée automatiquement : seule la case, touchée par la
// personne, écrit dans le stockage. Clé propre, distincte des réglages du fournisseur (naissance-ia.reglages.v1).
// Ce module n'importe rien, ne touche ni au réseau ni à la base de Naissance, et ne crée aucune connaissance.

export const CLE_SANS_MOTEUR = 'naissance-ia.sans-moteur.v1';

const TEXTE_ACTIF = 'Mode local actif : aucun moteur externe n’est contacté.';
const TEXTE_INACTIF = 'Mode local inactif : fonctionnement normal.';

function stockageParDefaut() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

// Rend true SEULEMENT si la valeur enregistrée est exactement { actif: true } ; false sinon (absence, JSON invalide,
// autre forme, panne du stockage). N'écrit jamais.
export function lireSansMoteur(stockage = stockageParDefaut()) {
  try {
    if (!stockage) return false;
    const brut = stockage.getItem(CLE_SANS_MOTEUR);
    if (typeof brut !== 'string') return false;
    const valeur = JSON.parse(brut);
    if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return false;
    const cles = Object.keys(valeur);
    return cles.length === 1 && cles[0] === 'actif' && valeur.actif === true;
  } catch {
    return false;
  }
}

// Écrit { actif: actif === true } ; rend true si l'écriture a réussi, false sinon.
export function ecrireSansMoteur(actif, stockage = stockageParDefaut()) {
  try {
    if (!stockage) return false;
    stockage.setItem(CLE_SANS_MOTEUR, JSON.stringify({ actif: actif === true }));
    return true;
  } catch {
    return false;
  }
}

// Monte la case dans la zone [data-zone-sans-moteur]. Le montage et rafraichir ne font que LIRE ; seule la case,
// au geste (événement change), écrit, puis surChangement est appelé.
export function monterChoixSansMoteur({ zone, surChangement, stockage } = {}) {
  const lireStockage = () => (stockage === undefined ? stockageParDefaut() : stockage);
  const caseChoix = zone ? zone.querySelector('[data-sans-moteur]') : null;
  if (!caseChoix) return { rafraichir: () => {} };
  const etat = zone.querySelector('[data-sans-moteur-etat]');

  function afficher(actif) {
    caseChoix.checked = actif;
    if (etat) etat.textContent = actif ? TEXTE_ACTIF : TEXTE_INACTIF;
  }

  function rafraichir() {
    afficher(lireSansMoteur(lireStockage()));
  }

  caseChoix.addEventListener('change', () => {
    const s = lireStockage();
    ecrireSansMoteur(caseChoix.checked === true, s);
    // L'état affiché est celui qui est réellement enregistré (une écriture refusée ne laisse pas croire au changement).
    const actif = lireSansMoteur(s);
    afficher(actif);
    if (typeof surChangement === 'function') surChangement(actif);
  });

  rafraichir();
  return { rafraichir };
}
// === FIN_SANS_MOTEUR ===
