// === DEBUT_LANGAGE_CONNAISSANCES ===
// Ce que Naissance SAIT, et qui survit à la fermeture de l'application.
// Base IndexedDB « naissance-langage », TOTALEMENT SÉPARÉE de « naissance-memoire » :
// on peut l'effacer, la recommencer ou la supprimer sans aucun risque pour la mémoire réelle,
// l'identité ou la conversation de Naissance.
//
// Six tables, qui correspondent à ce qu'elle peut acquérir :
//   faits      : { cle: 'sujet|relation', sujet, relation, valeur }   — ce qu'elle sait du monde
//   lexique    : { mot, role, relation }                              — les mots qu'elle connaît
//   patrons    : { id, relation, sujet, gabarit, origine }            — comment elle formule
//   proprietes : { cle: 'mot|propriete', mot, propriete, valeur, origine } — v0.10, ex. voiture/genre/féminin
//   regles     : { id, role, conditions:[{propriete,valeur}], resultat, origine, statut,
//                  precedente, exemples, creee, modifiee } — v0.10, données, jamais du JS codé en dur
//   journal    : phrases qu'elle n'a pas su traiter — pas une connaissance, une trace

export const NOM_BASE = 'naissance-langage';
// Version 2 (v0.10.1) : ajout des tables « proprietes » et « regles ». La mise à niveau ne crée
// que les tables manquantes : rien de ce qui existait à la version 1 n'est touché. Sans ce
// numéro, un appareil ayant déjà utilisé la base à la version 1 (v0.9.0) n'aurait jamais vu ces
// deux tables créées — c'est exactement ce qui a cassé « Son langage à elle » le 20/09.
export const VERSION_BASE = 2;
export const TABLES = ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles'];
const CLE = { faits: 'cle', lexique: 'mot', patrons: 'id', journal: 'id', proprietes: 'cle', regles: 'id' };

function demande(requete) {
  return new Promise((ok, ko) => {
    requete.onsuccess = () => ok(requete.result);
    requete.onerror = () => ko(requete.error);
  });
}
function terminee(tx) {
  return new Promise((ok, ko) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error || new Error('Écriture annulée.'));
  });
}

export function ouvrirIndexedDB(fabrique = globalThis.indexedDB) {
  return new Promise((ok, ko) => {
    if (!fabrique) { ko(new Error('IndexedDB indisponible')); return; }
    const r = fabrique.open(NOM_BASE, VERSION_BASE);
    r.onupgradeneeded = () => {
      const db = r.result;
      for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: CLE[t] });
    };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => db.close(); ok(magasinIndexedDB(db)); };
    r.onerror = () => ko(r.error);
  });
}

function magasinIndexedDB(db) {
  return {
    async lireTout(table) { return (await demande(db.transaction([table], 'readonly').objectStore(table).getAll())) || []; },
    async ecrire(table, objet) { const tx = db.transaction([table], 'readwrite'); tx.objectStore(table).put(objet); await terminee(tx); },
    async supprimer(table, cle) { const tx = db.transaction([table], 'readwrite'); tx.objectStore(table).delete(cle); await terminee(tx); },
    async vider() { const tx = db.transaction(TABLES, 'readwrite'); for (const t of TABLES) tx.objectStore(t).clear(); await terminee(tx); },
    fermer() { db.close(); },
  };
}

export function magasinMemoireVive() {
  const tables = Object.fromEntries(TABLES.map((t) => [t, new Map()]));
  return {
    async lireTout(table) { return [...tables[table].values()]; },
    async ecrire(table, objet) { tables[table].set(objet[CLE[table]], objet); },
    async supprimer(table, cle) { tables[table].delete(cle); },
    async vider() { for (const t of TABLES) tables[t].clear(); },
    fermer() {},
  };
}

export const cleFait = (sujet, relation) => `${sujet}|${relation}`;
export const clePropriete = (mot, propriete) => `${mot}|${propriete}`;

// Enregistre une phrase mal ou pas comprise. Une même phrase n'est gardée qu'une fois,
// avec le nombre de fois où elle est revenue.
export async function noterIncomprise(magasin, { phrase, etat, sujet, relation, motsInconnus }) {
  const id = String(phrase).trim().toLowerCase();
  const deja = (await magasin.lireTout('journal')).find((e) => e.id === id);
  const objet = {
    id, phrase: String(phrase).trim(), etat,
    sujetTrouve: sujet || null, relationTrouvee: relation || null,
    motsInconnus: motsInconnus || [],
    fois: (deja ? deja.fois : 0) + 1,
    derniere: new Date().toISOString(),
  };
  await magasin.ecrire('journal', objet);
  return objet;
}
// === FIN_LANGAGE_CONNAISSANCES ===
