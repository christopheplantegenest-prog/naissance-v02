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
//   propositions : { id, motifCle, candidats, gabarits, couverture, statut, dateProposition,
//                    dateReponse, gabaritTypeId } — v0.25 (décision ChatGPT du 27/09/2026,
//                    « PROPOSITION SPONTANÉE ») : le sort d'un CANDIDAT d'induction (induction.js,
//                    candidatDepuisMotif(), pure) une fois soumis à Christophe -- 'proposee' (en
//                    attente de sa réponse), 'refusee' (il a décliné CE candidat précis) ou 'apprise'
//                    (il a confirmé, gabaritTypeId pointe vers la connaissance réellement écrite dans
//                    gabaritsTypes). Table DÉLIBÉRÉMENT séparée de `hypotheses` (sémantique
//                    incompatible : une attente de JUGEMENT correct/incorrect, pas une signification à
//                    nommer) et de `gabaritsTypes` (une entrée y est déjà une connaissance VALIDÉE,
//                    avec une signification obligatoire -- un candidat proposé n'en a pas encore).
//                    `id` est l'EMPREINTE stable du candidat (cleCandidat(), induction.js), jamais le
//                    simple motif de départ : un refus ne bloque QUE ce candidat exact, jamais le
//                    motif pour toujours -- si le vécu évolue assez pour produire une empreinte
//                    différente, une nouvelle proposition reste possible (voir ecran.js,
//                    examinerPropositionSpontanee()).
//   transformations : { id, n, insertions, garder, interne, certaine, intention, exemples, origine,
//                    statut, creee, modifiee } -- « garder » ajouté le 27/09/2026 (extension SUPPRESSION/
//                    REMPLACEMENT, voir transformation.js) ; absent sur une ligne apprise avant cette
//                    date, auquel cas elle reste interprétée comme « tout gardé » (insertion-only,
//                    inchangé). « interne » (LOT 2) et « certaine » (LOT 1) ajoutés le 27/09/2026
//                    (décision ChatGPT « GRAND DIAGNOSTIC ») ; absents sur une ligne apprise avant ce
//                    chantier, auquel cas ils valent respectivement « aucune position transformée en
//                    interne » et « certaine » (comportement d'avant ces lots, strictement inchangé).
//                    « intention » ajouté le 27/09/2026 (décision ChatGPT « SÉLECTION CONTEXTUELLE PAR
//                    INTENTION ») -- chaîne libre JAMAIS interprétée, clé d'égalité pour choisir entre
//                    plusieurs transformations légitimes de même arité ; absente ou vide, normalisée à
//                    null (« aucune intention », comportement d'avant ce chantier, strictement
//                    inchangé). Chantier
//                    « ÉDUQUER PLUTÔT QUE PROGRAMMER » (décision ChatGPT du 27/09/2026, suite au
//                    diagnostic grammaire négation v0.25) : une connaissance GÉNUINEMENT NOUVELLE,
//                    qu'aucune des tables ci-dessus ne pouvait porter honnêtement -- ni un Fait
//                    (une valeur figée pour un couple précis, jamais une règle), ni une Propriété, ni
//                    une règle « Pour rôle : … » (un choix de mot à créneau fermé, jamais une
//                    transformation d'une phrase entière), ni une Façon de dire (un gabarit fixe de
//                    reconnaissance/réponse, jamais une réécriture). `n` est l'arité (nombre de mots
//                    de l'entrée) sur laquelle la transformation a été généralisée, `insertions` le
//                    résultat pur de induireTransformation() (transformation.js) -- voir ce fichier
//                    pour le mécanisme (aucune notion grammaticale câblée ici). `exemples` conserve
//                    les couples entrée→sortie d'origine, pour mémoire et pour fusionner sans
//                    doublon si le même enseignement revient. `statut` toujours 'validee' ici : rien
//                    n'est écrit avant la confirmation EXPLICITE de Christophe (« Valide la
//                    transformation. », main.js) -- pas de deuxième statut 'proposee' persistant,
//                    contrairement à `propositions` : cette proposition-ci est ponctuelle et tient
//                    en mémoire le temps d'un seul échange (comme `coursEnAttente`), jamais à travers
//                    plusieurs tours de conversation.

//   actions      : { id, operation, roles:[{position,nom}], n, exemples:[{entree}], statut, origine,
//                    precedent, creee, modifiee } — v0.38.0, LOT B2 (décision ChatGPT « ACTION
//                    INTERNE APPRISE ») : un squelette appris (mêmes `exemples`/`n` qu'une
//                    transformation, ancres TOUJOURS recalculées depuis eux via calculerAncres() —
//                    jamais une deuxième source de vérité) associé à une CAPACITÉ INTERNE du
//                    registre fermé (`operation`, une clé stable, jamais un nom de fonction
//                    JavaScript — voir registre.js) et à la correspondance entre ses positions
//                    variables et les rôles nommés qu'elle attend (`roles`). `statut` 'validee'
//                    (invocable), 'incertaine' (les exemples ne distinguent pas encore chaque rôle
//                    l'un de l'autre — JAMAIS invocable, voir action.js) ou 'remplacee' (réenseignée
//                    avec une autre association de rôles ou une autre opération sur le MÊME
//                    squelette — historique conservé via `precedent`, même convention que
//                    gabaritsTypes/regles). Le calcul (rôles valides, statut) reste exclusivement
//                    dans action.js (evaluerAction(), pure) : apprendreAction() ci-dessous ne fait
//                    QUE PERSISTER un résultat déjà évalué par l'appelant, même principe que
//                    apprendreTransformation()/apprendreGabaritType().
import { canoniser } from './canon.js';
import { confronterAttente, repererMotifs, formerHypothesesJugement } from './induction.js';
import { calculerAncres } from './transformation.js';

export const NOM_BASE = 'naissance-langage';
// Version 8 : ajout de la table « actions » (v0.38.0, LOT B2 — action interne apprise). Comme aux
// passages précédents, la mise à niveau ne crée QUE les tables manquantes : rien de ce qui existait
// avant n'est touché.
export const VERSION_BASE = 8;
export const TABLES = ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes', 'experiences', 'hypotheses', 'propositions', 'transformations', 'actions'];
const CLE = {
  faits: 'cle', lexique: 'mot', patrons: 'id', journal: 'id', proprietes: 'cle', regles: 'id', gabaritsTypes: 'id',
  experiences: 'id', hypotheses: 'id', propositions: 'id', transformations: 'id', actions: 'id',
};

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
// Correctif ciblé (décision ChatGPT du 27/09/2026, suite au refus du colis v0.26.0 par le robot) --
// l'ancien identifiant `experience-${Date.now()}-${Math.floor(Math.random()*1000)}` pouvait, à de
// rares occasions, être partagé par deux expériences créées à la même milliseconde avec le même
// tirage aléatoire, provoquant un écrasement silencieux dans le magasin (rangé par id). Un compteur
// monotone propre à cette fonction rend chaque appel du même processus strictement distinct, quel
// que soit le timing ou le hasard -- périmètre strictement limité à cet identifiant.
let sequenceExperience = 0;

export async function enregistrerExperience(magasin, { texteRecu, texteRepondu, date, source, referenceMemoire = null }) {
  sequenceExperience += 1;
  const objet = {
    id: `experience-${Date.now()}-${sequenceExperience}-${Math.floor(Math.random() * 1000)}`,
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
export async function confronterJugementEtEnregistrer(magasin, idExperience, jugement, lexique) {
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
  // FORMATION AUTOMATIQUE (chantier « FIN DES FONDATIONS », décision ChatGPT du 26/09/2026) --
  // réexamine tout le vécu disponible APRÈS chaque jugement, sans jamais dépendre du clic
  // laboratoire « Former des hypothèses ». Effet de bord silencieux (résultat non retourné ici :
  // voir examinerVecuEtFormerHypotheses ci-dessous pour l'inspecter directement) -- la forme de
  // retour historique de cette fonction (le tableau de confrontations) reste inchangée pour ne
  // rien casser des garanties déjà prouvées sur l'ordre attente/jugement.
  await examinerVecuEtFormerHypotheses(magasin, lexique);
  return resultats;
}

// RÉEXAMEN AUTOMATIQUE DU VÉCU (chantier « FIN DES FONDATIONS », décision ChatGPT du 26/09/2026) --
// SUPPRIME la dépendance au clic manuel « Former des hypothèses » : dès qu'un jugement extérieur
// arrive (via confronterJugementEtEnregistrer ci-dessus -- jamais depuis pont.js/enregistrerExperience,
// qui ignorent totalement cette fonction), Naissance réexamine elle-même TOUT son vécu disponible et
// forme les hypothèses que ce vécu justifie déjà. Ne fait rien de plus que ce que faisait le clic
// manuel : réutilise TEL QUEL repererMotifs()/formerHypothesesJugement() (induction.js, pures --
// aucun nouvel algorithme, aucune notion de combinaison de motifs inventée) et
// enregistrerHypotheseSiNouvelle() (idempotent : une hypothèse déjà connue n'est jamais recréée, son
// attente figée n'est jamais recalculée ni écrasée -- seule confronterEtEnregistrer() fait évoluer une
// hypothèse existante, jamais celle-ci). C'est cette idempotence, combinée au fait que repererMotifs()
// constate INDÉPENDAMMENT chaque motif structurel (pas de fusion, pas de hiérarchie), qui permet à une
// hypothèse PLUS PRÉCISE d'apparaître d'elle-même quand le vécu le justifie : si un motif plus étroit
// n'était pas encore assez observé (couverture < seuilMin), il devient éligible dès qu'un nouveau
// jugement l'y fait atteindre -- sans qu'aucune règle de combinaison ait été codée à la main ici (voir
// tests/formation-automatique.test.mjs, scénario bout-en-bout complet).
// `lexique` est injecté par l'appelant (jamais importé depuis esprit.js ici, voir le garde-fou
// STATIQUE de tests/motifs-recurrents.test.mjs) ; omis, repererMotifs() retombe sur son défaut
// (LEXIQUE_DEPART) -- suffisant pour les motifs de MOTS, qui ne dépendent d'aucun rôle lexical.
export async function examinerVecuEtFormerHypotheses(magasin, lexique) {
  const toutes = await magasin.lireTout('experiences');
  const entrees = toutes.map((e) => ({ id: e.id, texteRecu: e.texteRecu }));
  const jugementParId = dernierJugementParExperience(toutes);
  const motifs = repererMotifs(entrees, lexique !== undefined ? { lexique } : {});
  const pures = formerHypothesesJugement(motifs, jugementParId);
  const nouvelles = [];
  for (const pure of pures) {
    const avant = (await magasin.lireTout('hypotheses')).some((h) => h.id === pure.id);
    const objet = await enregistrerHypotheseSiNouvelle(magasin, pure);
    if (!avant) nouvelles.push(objet);
  }
  return nouvelles;
}

// RÉSOLUTION DU DERNIER JUGEMENT CONNU PAR EXPÉRIENCE -- même logique que jugementParIdDepuis()
// (app/langage/ecran.js), dupliquée ICI à dessein plutôt qu'importée : connaissances.js connaît déjà
// intégralement le schéma des interprétations (voir ajouterInterpretation/enregistrerJugement
// ci-dessus), donc cette petite résolution ne franchit aucune frontière nouvelle. Un jugement est
// FACULTATIF (expérience absente de la carte si jamais jugée) ; plusieurs jugements successifs sur la
// même expérience sont possibles (Christophe peut se corriger) -- seul le DERNIER ajouté compte,
// jamais recalculé autrement que par l'ordre réel d'ajout.
function dernierJugementParExperience(experiences) {
  const carte = new Map();
  for (const exp of experiences) {
    const jugements = exp.interpretations.filter((i) => i.origine === 'jugement-christophe');
    if (jugements.length) carte.set(exp.id, jugements[jugements.length - 1].donnees.jugement);
  }
  return carte;
}

// PROPOSITION D'UN CANDIDAT (v0.25, décision ChatGPT du 27/09/2026, « PROPOSITION SPONTANÉE ») --
// PERSISTANCE SEULEMENT, même principe que enregistrerHypotheseSiNouvelle() ci-dessus : ne recalcule
// jamais si un candidat est suffisamment sûr (voir induction.js, candidatDepuisMotif(), pure et
// isolée) -- écrit seulement l'état d'un candidat déjà décidé par l'appelant. Idempotente à dessein :
// un candidat déjà présent (quel que soit son statut -- proposee/refusee/apprise) n'est JAMAIS
// réécrit ici, pour ne jamais perdre une réponse de Christophe déjà enregistrée.
export async function proposerCandidatSiNouveau(magasin, { motifCle, hypothese, empreinte }) {
  const existante = (await magasin.lireTout('propositions')).find((p) => p.id === empreinte);
  if (existante) return existante;
  const objet = {
    id: empreinte,
    motifCle,
    candidats: [...hypothese.candidats],
    gabarits: hypothese.gabarits,
    couverture: [...hypothese.couverture],
    statut: 'proposee',
    dateProposition: new Date().toISOString(),
    dateReponse: null,
    gabaritTypeId: null,
  };
  await magasin.ecrire('propositions', objet);
  return objet;
}

// REFUS D'UNE PROPOSITION EN ATTENTE (même décision) -- n'interdit PAS pour toujours le motif de
// départ : seule CETTE empreinte précise (ce candidat exact -- mêmes candidats ET même couverture)
// est marquée 'refusee'. Si le vécu évolue assez pour produire un candidat à l'empreinte DIFFÉRENTE,
// examinerPropositionSpontanee() (ecran.js) le proposera comme un candidat réellement nouveau : c'est
// exactement la garantie demandée (« refuser » n'est jamais un blocage éternel du motif entier).
// Idempotente : refuser une proposition déjà tranchée (refusee ou apprise) ne réécrit rien.
export async function refuserProposition(magasin, id) {
  const proposition = (await magasin.lireTout('propositions')).find((p) => p.id === id);
  if (!proposition) throw new Error(`Aucune proposition « ${id} » à refuser.`);
  if (proposition.statut !== 'proposee') return proposition;
  const maj = { ...proposition, statut: 'refusee', dateReponse: new Date().toISOString() };
  await magasin.ecrire('propositions', maj);
  return maj;
}

// CONFIRMATION D'UNE PROPOSITION (même décision) -- PERSISTANCE SEULEMENT : l'apprentissage réel
// (apprendreGabaritType(), esprit.js) est TOUJOURS déclenché par l'appelant AVANT cet appel, jamais
// ici -- connaissances.js n'importe pas esprit.js (import circulaire : esprit.js importe déjà
// connaissances.js, voir le haut de ce fichier). Cette fonction se contente d'enregistrer QUE ce
// candidat a été appris, et SOUS QUELLE connaissance (gabaritTypeId), pour ne plus jamais le
// reproposer (voir examinerPropositionSpontanee(), ecran.js, qui vérifie ce statut).
export async function confirmerPropositionApprise(magasin, id, gabaritTypeId) {
  const proposition = (await magasin.lireTout('propositions')).find((p) => p.id === id);
  if (!proposition) throw new Error(`Aucune proposition « ${id} » à confirmer.`);
  const maj = { ...proposition, statut: 'apprise', dateReponse: new Date().toISOString(), gabaritTypeId };
  await magasin.ecrire('propositions', maj);
  return maj;
}

// === TRANSFORMATIONS APPRISES PAR EXEMPLES (décision ChatGPT du 27/09/2026) =======================
// PERSISTANCE SEULEMENT, même principe que apprendreRegle() (esprit.js) : ne recalcule JAMAIS si une
// transformation est valide (voir transformation.js, induireTransformation(), pure et isolée) --
// écrit seulement une transformation déjà décidée par l'appelant. Réapprendre EXACTEMENT la même
// transformation (même arité, mêmes insertions ET même « garder » -- la même signature sémantique)
// ne crée pas de doublon : les nouveaux exemples sont simplement ajoutés à ceux déjà connus, comme
// apprendreRegle() le fait pour une règle identique.
// ÉLARGI le 27/09/2026 (extension SUPPRESSION/REMPLACEMENT, transformation.js) : nouveau champ
// « garder » (un booléen par jeton d'entrée). RÉTROCOMPATIBLE : une transformation déjà persistée
// AVANT ce jour n'a pas ce champ -- interprétée comme « tout gardé » (son comportement insertion-only
// d'origine, strictement inchangé) partout où elle est relue.
// ÉLARGI le 27/09/2026 (LOT 1 + LOT 2, décision ChatGPT « GRAND DIAGNOSTIC ») : deux nouveaux champs,
// PERSISTANCE SEULEMENT (le calcul reste exclusivement dans transformation.js, jamais recalculé ici) :
//   - « interne » : un tableau (longueur n) de { prefixe, suffixe } ou null par position -- transformation
//     interne au jeton gardé (LOT 2). RÉTROCOMPATIBLE : absent = aucune position transformée en interne.
//   - « certaine » : booléen (LOT 1, anti-sur-généralisation). RÉTROCOMPATIBLE : absent = certaine (le
//     comportement d'avant ce lot, où toute transformation apprise était appliquée sans réserve).
// La signature de dédoublonnage (réapprendre EXACTEMENT la même transformation n'ajoute pas de doublon,
// seulement de nouveaux exemples) inclut désormais ces deux champs, avec les mêmes défauts
// rétrocompatibles que la relecture, pour ne pas fusionner à tort deux transformations qui ne
// coïncident que sur « insertions »/« garder » mais diffèrent par leur transformation interne ou leur
// certitude.
// ÉLARGI le 27/09/2026 (décision ChatGPT « SÉLECTION CONTEXTUELLE PAR INTENTION ») : nouveau champ
// « intention », PERSISTANCE SEULEMENT -- une chaîne libre, JAMAIS interprétée ici (ni ailleurs dans ce
// fichier), fournie par l'appelant (main.js, au moment où Christophe enseigne « Intention : ... » avant
// « Transformation : »). Sert uniquement de clé d'égalité pour la sélection (voir ecran.js,
// appliquerTransformationLocale) entre plusieurs transformations par ailleurs légitimes et de même
// arité. RÉTROCOMPATIBLE : absente ou vide, normalisée à null (« aucune intention », le comportement
// de toutes les transformations d'avant ce chantier). Incluse dans la signature de dédoublonnage : deux
// transformations identiques par ailleurs mais enseignées sous des intentions différentes restent deux
// connaissances DISTINCTES (c'est précisément leur raison d'être).
// ÉLARGI le 27/09/2026 (décision ChatGPT « PRÉSERVER LES SQUELETTES DISTINCTS », v0.30.1) : deux
// formulations enseignées séparément sous une même intention peuvent partager EXACTEMENT la même forme
// (insertions/garder/interne) tout en étant des phrasés différents -- ex. « ZDIS X ZFIN => X » et
// « ZPARLE X ZTERMINE => X ». Les fusionner détruirait une information apprise : leur SQUELETTE de
// reconnaissance (voir transformation.js, correspondSquelette/calculerAncres). Correction la PLUS
// LOCALE possible : seulement lorsqu'une intention est présente, le SQUELETTE (les ancres -- même
// notion, même fonction calculerAncres, jamais une seconde définition) entre aussi dans l'égalité de
// dédoublonnage, calculé côté « nouveaux exemples » comme côté « exemples déjà persistés » de chaque
// candidat. Sans intention (transformations historiques), rien ne change : comportement de
// dédoublonnage strictement identique à avant ce chantier.
export async function apprendreTransformation(magasin, {
  n, insertions, garder, interne, certaine, intention, exemples = [], origine = 'apprise-conversation',
}) {
  if (!Number.isInteger(n) || n < 0) throw new Error('Transformation invalide : arité manquante.');
  if (!Array.isArray(insertions) || insertions.length !== n + 1) throw new Error('Transformation invalide : insertions incohérentes avec son arité.');
  const garderNormalise = Array.isArray(garder) && garder.length === n ? garder : new Array(n).fill(true);
  const interneNormalise = Array.isArray(interne) && interne.length === n ? interne : new Array(n).fill(null);
  const certaineNormalisee = certaine !== false;
  const intentionNormalisee = typeof intention === 'string' && intention.trim() ? intention.trim() : null;
  const squeletteNouveau = intentionNormalisee != null ? JSON.stringify(calculerAncres({ n, exemples })) : null;
  const signature = JSON.stringify({
    insertions, garder: garderNormalise, interne: interneNormalise, certaine: certaineNormalisee, intention: intentionNormalisee,
    squelette: squeletteNouveau,
  });
  const toutes = await magasin.lireTout('transformations');
  const existante = toutes.find((t) => {
    if (t.statut !== 'validee' || t.n !== n) return false;
    const tIntention = t.intention || null;
    const tSquelette = tIntention != null ? JSON.stringify(calculerAncres({ n: t.n, exemples: t.exemples || [] })) : null;
    return JSON.stringify({
      insertions: t.insertions,
      garder: t.garder || new Array(n).fill(true),
      interne: t.interne || new Array(n).fill(null),
      certaine: t.certaine !== false,
      intention: tIntention,
      squelette: tSquelette,
    }) === signature;
  });
  if (existante) {
    const exemplesFusionnes = [...existante.exemples];
    for (const e of exemples) if (!exemplesFusionnes.some((f) => f.entree === e.entree && f.sortie === e.sortie)) exemplesFusionnes.push(e);
    const maj = { ...existante, exemples: exemplesFusionnes, modifiee: new Date().toISOString() };
    await magasin.ecrire('transformations', maj);
    return { objet: maj, explication: `Je connaissais déjà cette transformation : j'ai seulement ajouté ${exemples.length} exemple(s) à ceux déjà retenus.` };
  }
  const objet = {
    id: `transformation-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    n,
    insertions,
    garder: garderNormalise,
    interne: interneNormalise,
    certaine: certaineNormalisee,
    intention: intentionNormalisee,
    exemples: [...exemples],
    origine,
    statut: 'validee',
    creee: new Date().toISOString(),
    modifiee: new Date().toISOString(),
  };
  await magasin.ecrire('transformations', objet);
  return { objet, explication: `J'ai appris une transformation générale à partir de ${exemples.length} exemple(s).` };
}

// === ACTIONS APPRISES (LOT B2, v0.38.0, décision ChatGPT « ACTION INTERNE APPRISE ») ==============
// PERSISTANCE SEULEMENT, même principe que apprendreTransformation() ci-dessus : ne recalcule JAMAIS
// si une action est valide, ni son statut 'validee'/'incertaine' (voir action.js, evaluerAction(),
// pure et isolée) -- écrit seulement une action déjà évaluée par l'appelant. L'identité d'un
// squelette est TOUJOURS ses ancres (calculerAncres(), jamais recalculées différemment qu'ailleurs) :
//   - même squelette ET même association (operation + roles) -> les nouveaux exemples sont
//     simplement ajoutés à ceux déjà connus (jamais de doublon), et le statut est celui que
//     l'appelant a déjà recalculé sur l'ensemble fusionné (voir action.js : un exemple
//     supplémentaire peut faire passer 'incertaine' à 'validee', jamais l'inverse ici -- ce fichier
//     ne fait qu'écrire ce que evaluerAction() a déjà décidé) ;
//   - même squelette mais operation/roles DIFFÉRENTS -> remplacement VERSIONNÉ (comme
//     apprendreRegle()/apprendreGabaritType(), esprit.js) : l'ancienne entrée passe au statut
//     'remplacee' (jamais supprimée, jamais perdue), la nouvelle porte `precedent` vers elle ;
//   - squelette inédit -> nouvelle entrée, statut tel qu'évalué par l'appelant.
export async function apprendreAction(magasin, {
  operation, roles, n, exemples = [], statut, origine = 'apprise-test',
}) {
  if (!Number.isInteger(n) || n < 1) throw new Error('Action invalide : arité manquante.');
  if (!Array.isArray(roles) || !roles.length) throw new Error('Action invalide : rôles manquants.');
  if (statut !== 'validee' && statut !== 'incertaine') throw new Error('Action invalide : statut doit être "validee" ou "incertaine".');
  const rolesNormalises = roles.map((r) => ({ position: r.position, nom: r.nom }));
  const squeletteSignature = JSON.stringify(calculerAncres({ n, exemples }));
  const signatureAssociation = JSON.stringify({ operation, roles: rolesNormalises });

  const toutes = await magasin.lireTout('actions');
  const actif = (a) => a.statut === 'validee' || a.statut === 'incertaine';
  const memeSquelette = toutes.filter((a) => actif(a) && a.n === n
    && JSON.stringify(calculerAncres({ n: a.n, exemples: a.exemples })) === squeletteSignature);
  const identique = memeSquelette.find((a) => JSON.stringify({ operation: a.operation, roles: a.roles }) === signatureAssociation);

  if (identique) {
    const exemplesFusionnes = [...identique.exemples];
    for (const e of exemples) if (!exemplesFusionnes.some((f) => f.entree === e.entree)) exemplesFusionnes.push(e);
    const maj = {
      ...identique, exemples: exemplesFusionnes, statut, modifiee: new Date().toISOString(),
    };
    await magasin.ecrire('actions', maj);
    return {
      objet: maj,
      explication: identique.statut !== statut
        ? `Nouvel exemple intégré : cette action passe de « ${identique.statut} » à « ${statut} ».`
        : `Je connaissais déjà cette action : j'ai seulement ajouté ${exemples.length} exemple(s).`,
    };
  }

  for (const ancienne of memeSquelette) {
    const remplacee = { ...ancienne, statut: 'remplacee', modifiee: new Date().toISOString() };
    await magasin.ecrire('actions', remplacee);
    Object.assign(ancienne, remplacee);
  }
  const precedent = memeSquelette[0] ? memeSquelette[0].id : null;

  const objet = {
    id: `action-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    operation,
    roles: rolesNormalises,
    n,
    exemples: [...exemples],
    statut,
    origine,
    precedent,
    creee: new Date().toISOString(),
    modifiee: new Date().toISOString(),
  };
  await magasin.ecrire('actions', objet);
  return { objet, explication: `J'ai appris une nouvelle action (« ${operation} ») à partir de ${exemples.length} exemple(s), statut : ${statut}.` };
}
// === FIN_LANGAGE_CONNAISSANCES ===
