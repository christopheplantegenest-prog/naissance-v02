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
//   experiences  : { id, texteRecu, texteRepondu, date, source, referenceMemoire, interpretations }
//                  — B1, CONSERVATION D'EXPÉRIENCE : un factuel immuable (ce qui a été dit/répondu)
//                    séparé d'une liste d'interprétations ajoutées après coup. N'alimente RIEN
//                    automatiquement : c'est une mémoire, pas un apprentissage.
//   journal      : phrases qu'elle n'a pas su traiter — pas une connaissance, une trace

import { canoniser } from './canon.js';

export const NOM_BASE = 'naissance-langage';
// Version 4 (B1) : ajout de la table « experiences ». Comme aux passages précédents, la mise à
// niveau ne crée QUE les tables manquantes : rien de ce qui existait avant n'est touché.
export const VERSION_BASE = 4;
export const TABLES = ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes', 'experiences'];
const CLE = { faits: 'cle', lexique: 'mot', patrons: 'id', journal: 'id', proprietes: 'cle', regles: 'id', gabaritsTypes: 'id', experiences: 'id' };

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

// B1 — CONSERVATION D'EXPÉRIENCE.
// Le FACTUEL : ce qui a été reçu et répondu, immuable une fois écrit. « referenceMemoire » relie
// explicitement l'expérience aux DEUX ids réels de naissance-memoire ({idQuestion, idReponse}) —
// jamais reconstruits par « idQuestion+1 », pour ne pas dépendre d'une convention d'adjacence.
export async function enregistrerExperience(magasin, { texteRecu, texteRepondu, date, source, referenceMemoire = null }) {
  const objet = {
    id: `experience-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    texteRecu: String(texteRecu),
    texteRepondu: String(texteRepondu),
    date,
    source,
    referenceMemoire: referenceMemoire
      ? { idQuestion: referenceMemoire.idQuestion, idReponse: referenceMemoire.idReponse }
      : null,
    interpretations: [],
  };
  await magasin.ecrire('experiences', objet);
  return objet;
}

// Ajoute une INTERPRÉTATION à une expérience existante, sans jamais toucher au factuel.
// « donnees » est un objet libre, sans schéma imposé : différentes origines pourront y déposer
// des formes différentes sans que cette fonction ait à les connaître à l'avance.
export async function ajouterInterpretation(magasin, idExperience, { origine, donnees }) {
  const toutes = await magasin.lireTout('experiences');
  const experience = toutes.find((e) => e.id === idExperience);
  if (!experience) throw new Error(`Aucune expérience « ${idExperience} » à interpréter.`);
  const interpretation = {
    id: `interpretation-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    dateInterpretation: new Date().toISOString(),
    origine,
    donnees,
  };
  const miseAJour = { ...experience, interpretations: [...experience.interpretations, interpretation] };
  await magasin.ecrire('experiences', miseAJour);
  return miseAJour;
}

// PONT DE DONNÉES vers induire() — PAS un mécanisme d'induction. Ne sait rien de la façon dont
// induire() fonctionne, ne l'appelle jamais. Se contente de retrouver, pour des identifiants
// d'expériences EXPLICITEMENT désignés par Christophe (jamais devinés), leur texteRecu brut.
// Une expérience non désignée n'a AUCUN effet : elle n'entre ni dans « positifs » ni dans
// « negatifs » — surtout pas par déduction du complément (décision explicite de Christophe :
// l'absence de sélection ne signifie jamais « contre-exemple »). Lecture seule : n'écrit dans
// aucune table.
export async function preparerEntreesInduction(magasin, { idsPositifs = [], idsNegatifs = [] } = {}) {
  const toutes = await magasin.lireTout('experiences');
  const texteDe = (id) => {
    const e = toutes.find((exp) => exp.id === id);
    if (!e) throw new Error(`Aucune expérience « ${id} » à utiliser pour l'induction.`);
    return e.texteRecu;
  };
  return {
    positifs: idsPositifs.map(texteDe),
    negatifs: idsNegatifs.map(texteDe),
  };
}
// === FIN_LANGAGE_CONNAISSANCES ===
