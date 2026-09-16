// === DEBUT_MAGASIN ===
// Stockage brut de la mémoire de Naissance.
// Deux réalisations de la même interface :
//  - IndexedDB (sur l'appareil, persistant) ;
//  - mémoire vive (tests, et secours si IndexedDB est indisponible).
//
// Interface : lire, lireTout, plage, compter, ecrire, supprimer, remplacerTout.
// La table « journal » a des clés numériques croissantes ; les autres des clés texte.

export const NOM_BASE = 'naissance-memoire';
export const VERSION_BASE = 1;
export const TABLES = ['journal', 'souvenirs', 'resumes', 'cles'];
const CLE_PRIMAIRE = { journal: 'id', souvenirs: 'id', resumes: 'id', cles: 'cle' };

export const cleDe = (table, objet) => objet[CLE_PRIMAIRE[table]];

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

// Plage de clés numériques strictement entre « apres » et « avant ».
function bornes(apres, avant) {
  const bas = apres === null || apres === undefined ? null : apres;
  const haut = avant === null || avant === undefined ? null : avant;
  return { bas, haut, vide: bas !== null && haut !== null && haut - bas <= 1 };
}

export function ouvrirIndexedDB(fabrique = globalThis.indexedDB) {
  return new Promise((ok, ko) => {
    if (!fabrique) { ko(new Error('IndexedDB indisponible')); return; }
    const r = fabrique.open(NOM_BASE, VERSION_BASE);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const t of TABLES) {
        if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: CLE_PRIMAIRE[t] });
      }
    };
    r.onsuccess = () => ok(magasinIndexedDB(r.result));
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error('Base de mémoire bloquée par une autre fenêtre.'));
  });
}

function magasinIndexedDB(db) {
  const table = (nom, mode = 'readonly') => db.transaction([nom], mode).objectStore(nom);
  const IDBKR = globalThis.IDBKeyRange;
  function plageCles(apres, avant) {
    const { bas, haut } = bornes(apres, avant);
    if (bas !== null && haut !== null) return IDBKR.bound(bas, haut, true, true);
    if (bas !== null) return IDBKR.lowerBound(bas, true);
    if (haut !== null) return IDBKR.upperBound(haut, true);
    return null;
  }
  return {
    type: 'indexeddb',
    persistant: true,
    lire: (nom, cle) => demande(table(nom).get(cle)),
    lireTout: (nom) => demande(table(nom).getAll()),
    plage(nom, { apres = null, avant = null, limite = Infinity, sens = 'asc' } = {}) {
      if (bornes(apres, avant).vide || limite <= 0) return Promise.resolve([]);
      return new Promise((ok, ko) => {
        const res = [];
        const r = table(nom).openCursor(plageCles(apres, avant), sens === 'desc' ? 'prev' : 'next');
        r.onsuccess = () => {
          const curseur = r.result;
          if (!curseur || res.length >= limite) { ok(res); return; }
          res.push(curseur.value);
          curseur.continue();
        };
        r.onerror = () => ko(r.error);
      });
    },
    compter(nom, { apres = null, avant = null } = {}) {
      if (bornes(apres, avant).vide) return Promise.resolve(0);
      const plage = plageCles(apres, avant);
      return demande(plage ? table(nom).count(plage) : table(nom).count());
    },
    async ecrire(nom, objets) {
      const t = db.transaction([nom], 'readwrite');
      const s = t.objectStore(nom);
      for (const o of [].concat(objets)) s.put(o);
      await terminee(t);
    },
    async supprimer(nom, cles) {
      const t = db.transaction([nom], 'readwrite');
      const s = t.objectStore(nom);
      for (const c of [].concat(cles)) s.delete(c);
      await terminee(t);
    },
    // Remplacement atomique de toutes les tables (import) : tout ou rien.
    async remplacerTout(donnees) {
      const t = db.transaction(TABLES, 'readwrite');
      for (const nom of TABLES) {
        const s = t.objectStore(nom);
        s.clear();
        for (const o of donnees[nom] || []) s.put(o);
      }
      await terminee(t);
    },
  };
}

function trierCles(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function creerMagasinMemoire() {
  const tables = Object.fromEntries(TABLES.map((t) => [t, new Map()]));
  const copie = (o) => (o === undefined ? undefined : structuredClone(o));
  const valeursTriees = (nom) => [...tables[nom].keys()].sort(trierCles).map((k) => tables[nom].get(k));
  function filtrer(nom, apres, avant) {
    return valeursTriees(nom).filter((o) => {
      const k = cleDe(nom, o);
      return (apres === null || k > apres) && (avant === null || k < avant);
    });
  }
  return {
    type: 'memoire',
    persistant: false,
    lire: async (nom, cle) => copie(tables[nom].get(cle)),
    lireTout: async (nom) => valeursTriees(nom).map(copie),
    async plage(nom, { apres = null, avant = null, limite = Infinity, sens = 'asc' } = {}) {
      let liste = filtrer(nom, apres, avant);
      if (sens === 'desc') liste = liste.reverse();
      return liste.slice(0, limite).map(copie);
    },
    compter: async (nom, { apres = null, avant = null } = {}) => filtrer(nom, apres, avant).length,
    async ecrire(nom, objets) {
      for (const o of [].concat(objets)) tables[nom].set(cleDe(nom, o), copie(o));
    },
    async supprimer(nom, cles) {
      for (const c of [].concat(cles)) tables[nom].delete(c);
    },
    async remplacerTout(donnees) {
      const neuves = Object.fromEntries(TABLES.map((t) => [t, new Map()]));
      for (const nom of TABLES) {
        for (const o of donnees[nom] || []) neuves[nom].set(cleDe(nom, o), copie(o));
      }
      for (const nom of TABLES) tables[nom] = neuves[nom];
    },
  };
}

// Ouvre IndexedDB ; en cas d'échec, mémoire vive (non persistante) pour que l'appli reste utilisable.
export async function ouvrirMagasin() {
  try {
    return await ouvrirIndexedDB();
  } catch (e) {
    const m = creerMagasinMemoire();
    m.erreur = e && e.message ? e.message : String(e);
    return m;
  }
}
// === FIN_MAGASIN ===
