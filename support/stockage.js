// === DEBUT_STOCKAGE ===
// NAISSANCE V0.2 - Support navigateur.
// Adaptateur de stockage derriere une interface neutre et asynchrone.
// L'organisme n'appelle jamais localStorage directement : il ne connait que
// lire / ecrire / effacer. Remplacer ce fichier par une implementation
// IndexedDB ou Android ne demandera aucune modification ailleurs.
//
// En V0.2 rien de durable n'est stocke, hormis d'eventuels reglages.
// La base est distincte de celle de V0.1 : aucune ancienne empreinte 16D
// n'est lue, convertie ni touchee.

const PREFIXE = 'naissance-v02:';

export const Stockage = {

  async lire(cle) {
    try {
      const brut = localStorage.getItem(PREFIXE + cle);
      return brut === null ? null : JSON.parse(brut);
    } catch (e) {
      return null;
    }
  },

  async ecrire(cle, valeur) {
    try {
      localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
      return true;
    } catch (e) {
      return false;
    }
  },

  async effacer(cle) {
    try {
      localStorage.removeItem(PREFIXE + cle);
      return true;
    } catch (e) {
      return false;
    }
  },

  async demanderPersistance() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        return await navigator.storage.persist();
      }
    } catch (e) {}
    return false;
  }
};
// === FIN_STOCKAGE ===
