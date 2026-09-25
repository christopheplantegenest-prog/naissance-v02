// === DEBUT_LANGAGE_CONNAISSANCES ===
// Ce que Naissance SAIT, et qui survit à la fermeture de l'application.
// Base IndexedDB « naissance-langage », TOTALEMENT SÉPARÉE de « naissance-memoire » :
// on peut l'effacer, la recommencer ou la supprimer sans aucun risque pour la mémoire réelle,
// l'identité ou la conversation de Naissance.
//
// Six tables, qui correspondent à ce qu'elle peut acquérir :
//   faits        : { cle: 'sujet|relation', sujet, relation, valeur }   — ce qu'elle sait du monde
//   lexique      : { mot, role, relation }                              — les mots qu'elle connaît
//   patrons      : { id, relation, sujet, gabarit, origine }            — comment elle formule
//   proprietes   : { cle: 'mot|propriete', mot, propriete, valeur, origine } — v0.10, ex. voiture/genre/féminin
//   regles       : { id, role, conditions:[{propriete,valeur}], resultat, origine, statut,
//                    precedente, exemples, creee, modifiee } — v0.10, données, jamais du JS codé en dur
//   gabaritsTypes: { id, candidats, gabarits, signification, origine, statut, precedent, exemples,
//                    testsReussis, testsEchoues, creee, modifiee } — v0.17.6, LE PONT avec induire() :
//                    une connaissance « ce(s) gabarit(s) signifient ceci », GÉNÉRALE — la signification
//                    est une chaîne libre, jamais limitée à une catégorie câblée dans comprendre.js.
//   journal      : phrases qu'elle n'a pas su traiter — pas une connaissance, une trace

import { canoniser } from './canon.js';

export const NOM_BASE = 'naissance-langage';
// Version 3 (v0.17.6) : ajout de la table « gabaritsTypes ». Comme au passage à la version 2, la
// mise à niveau ne crée QUE les tables manquantes : rien de ce qui existait avant n'est touché.
export const VERSION_BASE = 3;
export const TABLES = ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes'];
const CLE = { faits: 'cle', lexique: 'mot', patrons: 'id', journal: 'id', proprietes: 'cle', regles: 'id', gabaritsTypes: 'id' };

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

// v0.17.1 — L'IDENTITÉ d'un fait (sujet + relation), utilisée pour RETROUVER et pour RANGER.
// Cohérente avec le reste du moteur (lexique, propriétés, règles, façons de dire), qui range et
// cherche déjà sans accent ni casse via decouper(). Avant cette version, seuls les FAITS gardaient
// la graphie tapée pour l'identité elle-même : « Fait : moi / téléphone / … » restait introuvable
// par « Quel est mon téléphone ? » (dont la relation comprise est « telephone »). canoniser() ne
// modifie JAMAIS la valeur d'un fait, ni les champs sujet/relation des lignes (voir esprit.js) :
// seule cette CLÉ DE RECHERCHE est canonique.
export const cleFait = (sujet, relation) => `${canoniser(sujet)}|${canoniser(relation)}`;
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
