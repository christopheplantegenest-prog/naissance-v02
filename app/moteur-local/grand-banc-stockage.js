// === DEBUT_GRAND_BANC_STOCKAGE ===
// Journal du grand banc de diagnostic : une base IndexedDB SÉPARÉE de « naissance-memoire »,
// pour que rien ici ne touche à la mémoire de Naissance. Effacer ce journal, ou même supprimer
// cette base, n'a aucune conséquence sur Naissance, son identité, sa mémoire ou sa conversation.
//
// Un seul type d'enregistrement, la table « essais » (clé : l'identifiant stable de l'essai planifié),
// écrit un par un, immédiatement après chaque génération — jamais en fin de lot.

export const NOM_BASE = 'naissance-banc-diagnostic';
export const VERSION_BASE = 1;

function demande(requete) {
  return new Promise((ok, ko) => {
    requete.onsuccess = () => ok(requete.result);
    requete.onerror = () => ko(requete.error);
  });
}

function terminee(transaction) {
  return new Promise((ok, ko) => {
    transaction.oncomplete = () => ok();
    transaction.onerror = () => ko(transaction.error);
    transaction.onabort = () => ko(transaction.error || new Error('Écriture annulée.'));
  });
}

export function ouvrirIndexedDB(fabrique = globalThis.indexedDB) {
  return new Promise((ok, ko) => {
    if (!fabrique) { ko(new Error('IndexedDB indisponible')); return; }
    const r = fabrique.open(NOM_BASE, VERSION_BASE);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('essais')) db.createObjectStore('essais', { keyPath: 'id' });
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => db.close();
      ok(magasinIndexedDB(db));
    };
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error('Journal du banc bloqué par une autre fenêtre.'));
  });
}

function magasinIndexedDB(db) {
  return {
    async enregistrerEssai(resultat) {
      const tx = db.transaction(['essais'], 'readwrite');
      tx.objectStore('essais').put(resultat);
      await terminee(tx);
    },
    async listerEssais() {
      const tx = db.transaction(['essais'], 'readonly');
      const r = await demande(tx.objectStore('essais').getAll());
      return r || [];
    },
    async effacerTout() {
      const tx = db.transaction(['essais'], 'readwrite');
      tx.objectStore('essais').clear();
      await terminee(tx);
    },
    fermer() { db.close(); },
  };
}

// Réalisation en mémoire vive : tests, et secours si IndexedDB est indisponible.
export function magasinMemoireVive() {
  const table = new Map();
  return {
    async enregistrerEssai(resultat) { table.set(resultat.id, resultat); },
    async listerEssais() { return [...table.values()]; },
    async effacerTout() { table.clear(); },
    fermer() {},
  };
}
// === FIN_GRAND_BANC_STOCKAGE ===
