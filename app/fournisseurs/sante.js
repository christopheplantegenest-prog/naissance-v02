// === DEBUT_SANTE_MODELES ===
// Santé des modèles, observée à l'usage : donnée TECHNIQUE, gardée sur l'appareil
// (localStorage), jamais exportée avec la mémoire de Naissance.
// Forme : { [fournisseur]: { [modele]: { succes, echec, code, detail } } }
// Un modèle n'est jugé utilisable que s'il a réellement répondu ;
// sa présence dans la liste du fournisseur ne suffit pas.

export const CLE_SANTE = 'naissance-ia.moteurs.v1';

// Durée pendant laquelle un modèle en échec est évité avant d'être réessayé.
export const ATTENTES_MS = Object.freeze({
  service: 10 * 60 * 1000,         // saturé ou en panne
  delai: 10 * 60 * 1000,           // trop lent
  quota: 15 * 60 * 1000,           // quota gratuit de ce modèle atteint
  modele: 7 * 24 * 60 * 60 * 1000, // n'existe plus pour cette clé
});

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function lireSante(stockage = stockageParDefaut()) {
  try {
    const brut = stockage && stockage.getItem(CLE_SANTE);
    const s = brut ? JSON.parse(brut) : {};
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}

function modifier(fournisseur, modele, changer, stockage) {
  try {
    const s = lireSante(stockage);
    const parModele = { ...(s[fournisseur] || {}) };
    parModele[modele] = changer({ ...(parModele[modele] || {}) });
    s[fournisseur] = parModele;
    stockage.setItem(CLE_SANTE, JSON.stringify(s));
  } catch {
    // stockage indisponible : l'appli fonctionne quand même, sans mémoire de santé
  }
}

export function noterSucces(fournisseur, modele, date, stockage = stockageParDefaut()) {
  modifier(fournisseur, modele, () => ({ succes: date, echec: null, code: null, detail: null }), stockage);
}

export function noterEchec(fournisseur, modele, erreur, date, stockage = stockageParDefaut()) {
  modifier(fournisseur, modele, (e) => ({
    ...e,
    echec: date,
    code: erreur.code || 'inconnu',
    detail: String(erreur.detail || erreur.message || '').slice(0, 200),
  }), stockage);
}

export function etatModele(sante, fournisseur, modele) {
  return (sante[fournisseur] || {})[modele] || {};
}

// Vrai si le modèle n'est pas dans une période d'attente après un échec.
export function estDisponible(etat, maintenant) {
  if (!etat || !etat.echec) return true;
  const attente = ATTENTES_MS[etat.code];
  if (!attente) return true;
  return maintenant - Date.parse(etat.echec) > attente;
}

export const estConfirme = (etat) => !!(etat && etat.succes && !etat.echec);
export const estDisparu = (etat, maintenant) => !!(etat && etat.code === 'modele' && !estDisponible(etat, maintenant));

// Ordre d'essai : le modèle choisi (s'il n'est pas en attente), puis les modèles
// confirmés (le plus récent d'abord), puis les autres modèles de la liste
// dans l'ordre de préférence du fournisseur. Les modèles en attente sont exclus.
export function ordonnerCandidats({ fournisseur, prefere, modeles, sante, maintenant, ordonner = (l) => l }) {
  const ids = [];
  const ajouter = (id) => { if (id && !ids.includes(id)) ids.push(id); };
  const dispo = (id) => estDisponible(etatModele(sante, fournisseur, id), maintenant);
  if (prefere && dispo(prefere)) ajouter(prefere);
  const connus = (modeles || []).map((m) => m.id);
  const confirmes = connus
    .filter((id) => dispo(id) && estConfirme(etatModele(sante, fournisseur, id)))
    .sort((a, b) => String(etatModele(sante, fournisseur, b).succes).localeCompare(String(etatModele(sante, fournisseur, a).succes)));
  confirmes.forEach(ajouter);
  ordonner(modeles || []).map((m) => m.id).filter(dispo).forEach(ajouter);
  return ids;
}
// === FIN_SANTE_MODELES ===
