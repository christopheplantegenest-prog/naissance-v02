// === DEBUT_COMPTEUR_APPELS ===
// Compteur LOCAL et approximatif des appels qui consomment le quota d'un moteur externe,
// par journée de quota (remise à zéro à minuit, heure du Pacifique, comme chez Google).
// Donnée technique (localStorage), jamais exportée avec la mémoire de Naissance.
// Générique : il enveloppe les requêtes réseau ; chaque fournisseur dit seulement
// quelles adresses consomment du quota (modeleDeLAppel).

import { journeeQuota } from './sante.js';

export const CLE_COMPTEUR = 'naissance-ia.appels.v1';
export const TYPES_APPEL = Object.freeze({ conversation: 'conversation', rangement: 'rangement', verification: 'vérification' });

function stockageParDefaut() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

const vide = (jour) => ({ jour, total: 0, reussis: 0, parType: {}, parModele: {} });

export function lireCompteur(stockage = stockageParDefaut(), maintenant = Date.now()) {
  const jour = journeeQuota(maintenant);
  try {
    const brut = stockage && stockage.getItem(CLE_COMPTEUR);
    const c = brut ? JSON.parse(brut) : null;
    if (!c || c.jour !== jour) return vide(jour);
    return { ...vide(jour), ...c };
  } catch {
    return vide(jour);
  }
}

export function noterAppel({ type, modele, reussi }, stockage = stockageParDefaut(), maintenant = Date.now()) {
  const c = lireCompteur(stockage, maintenant);
  c.total += 1;
  if (reussi) c.reussis += 1;
  c.parType = { ...c.parType, [type]: (c.parType[type] || 0) + 1 };
  c.parModele = { ...c.parModele, [modele]: (c.parModele[modele] || 0) + 1 };
  try { stockage.setItem(CLE_COMPTEUR, JSON.stringify(c)); } catch { /* sans effet */ }
  return c;
}

// Enveloppe une fonction fetch : compte les appels qui consomment du quota.
export function fetchCompte({ type, fournisseur, fetchFn = null, stockage = stockageParDefaut(), horloge = () => Date.now() }) {
  return async (url, options) => {
    const f = fetchFn || globalThis.fetch.bind(globalThis);
    const modele = fournisseur.modeleDeLAppel ? fournisseur.modeleDeLAppel(url) : null;
    if (!modele) return f(url, options);
    try {
      const reponse = await f(url, options);
      noterAppel({ type, modele, reussi: !!reponse.ok }, stockage, horloge());
      return reponse;
    } catch (e) {
      noterAppel({ type, modele, reussi: false }, stockage, horloge());
      throw e;
    }
  };
}

export function resumeCompteur(c) {
  if (!c.total) return "Aucun appel au moteur externe aujourd'hui.";
  const types = Object.entries(c.parType).map(([k, v]) => `${TYPES_APPEL[k] || k} ${v}`).join(', ');
  const modeles = Object.entries(c.parModele).map(([k, v]) => `${k} : ${v}`).join(', ');
  return `Aujourd'hui : ${c.total} appel(s) au moteur externe, dont ${c.reussis} réussi(s) (${types}). Par modèle : ${modeles}.`;
}
// === FIN_COMPTEUR_APPELS ===
