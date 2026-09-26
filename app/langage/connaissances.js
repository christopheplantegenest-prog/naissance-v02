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
//   hypotheses   : { id, motifCle, provenance, observations, attente, etatHypothese, dateFormation,
//                    confrontations } — REFONDU le 26/09/2026 (décision ChatGPT « SIGNAL
//                    D'APPRENTISSAGE ») : une hypothèse relie désormais un motif structurel (repéré
//                    par le repérage de motifs d'induction.js, sur le texte SEUL) à une ATTENTE de
//                    JUGEMENT humain ('correct'/'incorrect'/null si les jugements connus divergent) -- deux
//                    informations réellement indépendantes, jamais deux sorties simultanées de
//                    comprendre(). Volontairement SÉPARÉE de gabaritsTypes : une hypothèse n'est pas
//                    une connaissance de type d'énoncé. Voir induction.js
//                    (formerHypothesesJugement/confronterAttente, pures) pour ce qui les produit,
//                    et ci-dessous (enregistrerJugement/enregistrerAttenteSiPertinente/
//                    confronterJugementEtEnregistrer) pour le jugement extérieur qui les alimente.

import { canoniser } from './canon.js';
import { confronterAttente } from './induction.js';

export const NOM_BASE = 'naissance-langage';
// Version 5 : ajout de la table « hypotheses ». Comme aux passages précédents, la mise à niveau ne
// crée QUE les tables manquantes : rien de ce qui existait avant n'est touché.
export const VERSION_BASE = 5;
export const TABLES = ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes', 'experiences', 'hypotheses'];
const CLE = { faits: 'cle', lexique: 'mot', patrons: 'id', journal: 'id', proprietes: 'cle', regles: 'id', gabaritsTypes: 'id', experiences: 'id', hypotheses: 'id' };

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
    // v0.17.15 — Remplacement atomique de toutes les tables (import de sauvegarde complète) : tout
    // ou rien, une seule transaction native IndexedDB (même garantie que remplacerTout() dans
    // app/memoire/magasin.js). Une erreur en cours de route fait échouer/annuler la transaction
    // entière : aucune table n'est laissée à moitié remplacée.
    async remplacerTout(donnees) {
      const tx = db.transaction(TABLES, 'readwrite');
      for (const nom of TABLES) {
        const s = tx.objectStore(nom);
        s.clear();
        for (const o of donnees[nom] || []) s.put(o);
      }
      await terminee(tx);
    },
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
    // v0.17.15 — Même contrat que la version IndexedDB : reconstruit chaque table dans des Map
    // TEMPORAIRES d'abord, et ne les affecte à `tables` qu'une fois toutes construites SANS
    // exception -- si une exception survenait en cours de construction, aucune des tables réelles
    // n'aurait déjà été modifiée (même garantie « tout ou rien », en mémoire).
    async remplacerTout(donnees) {
      const neuves = Object.fromEntries(TABLES.map((t) => [t, new Map()]));
      for (const nom of TABLES) {
        for (const o of donnees[nom] || []) neuves[nom].set(o[CLE[nom]], o);
      }
      for (const nom of TABLES) tables[nom] = neuves[nom];
    },
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

// HYPOTHÈSES (étape B, décision ChatGPT du 26/09/2026) — PERSISTANCE SEULEMENT. Ne recalcule
// jamais ce qu'une hypothèse affirme (voir formerHypotheses()/confronterHypothese(), induction.js,
// pures et isolées) : cette fonction sait seulement ÉCRIRE une hypothèse PROPOSÉE si elle n'existe
// pas déjà. Idempotente à dessein : reformer les hypothèses (re-cliquer le bouton du laboratoire)
// après de nouvelles expériences ne doit JAMAIS écraser une hypothèse déjà là -- ni son état
// (proposee/contredite/...), ni ses confrontations déjà enregistrées, ni ses observations déjà
// confrontées. La croissance d'une hypothèse EXISTANTE passe exclusivement par
// confronterEtEnregistrer() ci-dessous, jamais par un second appel à celle-ci.
export async function enregistrerHypotheseSiNouvelle(magasin, hypothesePure) {
  const existante = (await magasin.lireTout('hypotheses')).find((h) => h.id === hypothesePure.id);
  if (existante) return existante;
  const objet = {
    ...hypothesePure,
    etatHypothese: 'proposee',
    dateFormation: new Date().toISOString(),
    confrontations: [],
  };
  await magasin.ecrire('hypotheses', objet);
  return objet;
}

// CONFRONTATION D'UNE HYPOTHÈSE EXISTANTE À UN NOUVEAU JUGEMENT (étape C, refondue le 26/09/2026).
// Réutilise TEL QUEL confronterAttente() (induction.js, pure) pour le VERDICT (compatible/
// incompatible/insuffisant), en comparant l'attente FIGÉE de l'hypothèse (jamais recalculée ici) au
// jugement reçu -- cette fonction-ci sait seulement PERSISTER ce verdict : ajoute la confrontation
// à l'historique (jamais écrasée, jamais supprimée -- une contradiction reste visible pour
// toujours), ajoute la nouvelle observation aux preuves accumulées de l'hypothèse, et ne fait
// avancer etatHypothese que dans UN SEUL sens : vers 'contredite' dès la première incompatibilité
// rencontrée, JAMAIS en arrière (aucune guérison automatique, aucun seuil de tolérance inventé).
// Une hypothèse déjà 'contredite' le reste. `nouvelleObservation` : { id, jugement }.
export async function confronterEtEnregistrer(magasin, idHypothese, nouvelleObservation) {
  const hypothese = (await magasin.lireTout('hypotheses')).find((h) => h.id === idHypothese);
  if (!hypothese) throw new Error(`Aucune hypothèse « ${idHypothese} » à confronter.`);
  const resultat = confronterAttente(hypothese.attente, nouvelleObservation.jugement);
  const confrontation = { id: nouvelleObservation.id, dateConfrontation: new Date().toISOString(), resultat };
  const miseAJour = {
    ...hypothese,
    observations: [...hypothese.observations, nouvelleObservation],
    confrontations: [...hypothese.confrontations, confrontation],
    etatHypothese: resultat === 'incompatible' ? 'contredite' : hypothese.etatHypothese,
  };
  await magasin.ecrire('hypotheses', miseAJour);
  return { hypothese: miseAJour, resultat };
}

// JUGEMENT EXTÉRIEUR SUR UNE EXPÉRIENCE (étape D refondée, décision ChatGPT du 26/09/2026,
// « SIGNAL D'APPRENTISSAGE ») — un signal FACULTATIF, humain, jamais déduit par
// comprendre()/repondre(), jamais une récompense ni un score : « Christophe a jugé cette réponse
// correcte/incorrecte ». Réutilise TEL QUEL ajouterInterpretation() : APPEND-ONLY, ne remplace ni
// ne modifie jamais l'interprétation 'comprendre' déjà là, et n'empêche jamais un second jugement
// (même contradictoire) d'être ajouté ensuite -- l'historique n'efface rien.
export async function enregistrerJugement(magasin, idExperience, jugement) {
  if (jugement !== 'correct' && jugement !== 'incorrect') {
    throw new Error(`Jugement invalide : « ${jugement} » (seuls 'correct'/'incorrect' sont acceptés).`);
  }
  return ajouterInterpretation(magasin, idExperience, {
    origine: 'jugement-christophe',
    donnees: { jugement, date: new Date().toISOString() },
  });
}

// ATTENTE FORMÉE À PARTIR D'UNE HYPOTHÈSE, POSÉE AVANT TOUT JUGEMENT (étape D) — LA GARANTIE
// D'ORDRE TEMPOREL EST ICI, MÉCANIQUE, PAS SEULEMENT DOCUMENTÉE : si l'expérience désignée porte
// DÉJÀ un jugement extérieur ('jugement-christophe'), cette fonction REFUSE d'enregistrer une
// attente -- impossible de fabriquer après coup une prétendue prédiction en relisant un jugement
// déjà connu. Rien à poser si l'hypothèse n'a pas d'attente univoque (attente=null : aucune
// majorité choisie, voir induction.js). Idempotente pour une même hypothèse : une attente déjà
// posée pour cette hypothèse sur cette expérience n'est jamais dupliquée.
export async function enregistrerAttenteSiPertinente(magasin, idExperience, hypothese) {
  if (hypothese.attente == null) return null;
  const experience = (await magasin.lireTout('experiences')).find((e) => e.id === idExperience);
  if (!experience) throw new Error(`Aucune expérience « ${idExperience} » pour y poser une attente.`);
  if (experience.interpretations.some((i) => i.origine === 'jugement-christophe')) {
    throw new Error(`Impossible de poser une attente sur « ${idExperience} » : un jugement existe déjà -- l'ordre attente puis jugement ne peut pas être inversé.`);
  }
  const dejaPosee = experience.interpretations.some((i) => i.origine === 'attente-hypothese' && i.donnees.hypotheseId === hypothese.id);
  if (dejaPosee) return experience;
  return ajouterInterpretation(magasin, idExperience, {
    origine: 'attente-hypothese',
    donnees: { hypotheseId: hypothese.id, attendu: hypothese.attente, date: new Date().toISOString() },
  });
}

// ORCHESTRATION COMPLÈTE : enregistre le jugement reçu, PUIS confronte chaque attente qui avait été
// posée sur cette expérience AVANT ce jugement (jamais reconstruite après coup -- une expérience
// sans attente préalable rend une liste VIDE, jamais un résultat fabriqué). Réutilise
// confronterEtEnregistrer() (ci-dessus, inchangée) pour persister chaque verdict sur l'hypothèse
// concernée. Une expérience peut porter plusieurs attentes (plusieurs motifs distincts couvrant le
// même texte) : chacune est confrontée séparément.
export async function confronterJugementEtEnregistrer(magasin, idExperience, jugement) {
  const experience = (await magasin.lireTout('experiences')).find((e) => e.id === idExperience);
  if (!experience) throw new Error(`Aucune expérience « ${idExperience} » à juger.`);
  const attentesPosees = experience.interpretations.filter((i) => i.origine === 'attente-hypothese');
  await enregistrerJugement(magasin, idExperience, jugement);
  const resultats = [];
  for (const attente of attentesPosees) {
    const { hypotheseId } = attente.donnees;
    const { hypothese, resultat } = await confronterEtEnregistrer(magasin, hypotheseId, { id: idExperience, jugement });
    resultats.push({ hypotheseId, resultat, hypothese });
  }
  return resultats;
}
// === FIN_LANGAGE_CONNAISSANCES ===
