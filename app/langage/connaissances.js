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
//   experiences  : { id, texteRecu, texteRepondu, date, source, referenceMemoire, referenceTrace,
//                    interpretations }
//                  — B1, CONSERVATION D'EXPÉRIENCE : un factuel immuable (ce qui a été dit/répondu)
//                    séparé d'une liste d'interprétations ajoutées après coup. N'alimente RIEN
//                    automatiquement : c'est une mémoire, pas un apprentissage. `referenceTrace`
//                    (v0.62, ADDITIF) : { idTrace } optionnel, jamais reconstruit, jamais une
//                    causalité — voir enregistrerExperience() plus bas.
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
import { sousDonneesCanoniques } from './sous-donnees.js';

export const NOM_BASE = 'naissance-langage';
// Version 8 : ajout de la table « actions » (v0.38.0, LOT B2 — action interne apprise). Comme aux
// passages précédents, la mise à niveau ne crée QUE les tables manquantes : rien de ce qui existait
// avant n'est touché.
export const VERSION_BASE = 21; // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 21 = 20+1, ajout de la table 'attentesProspectives' (voir ci-dessous). // v0.63.72 : 20 = 19+1, 'contextesProspectifs'. // v0.46 — ajout de la table 'traces' (observation passive des tentatives
// de raisonnement) : la version DOIT être incrémentée pour qu'IndexedDB déclenche onupgradeneeded et
// crée réellement le nouveau magasin sur un appareil qui possède déjà une base plus ancienne (sinon :
// « object store was not found », le magasin n'existant tout simplement pas encore sur l'appareil) —
// RAPPEL EXPLICITE de l'incident v0.43.0 (store ajouté SANS ce bump, téléphone réel cassé). Voir
// tests/traces-schema.test.mjs : un contrat PINGLÉ qui échoue si TABLES/CLE/VERSION_BASE divergent,
// pour forcer à se poser consciemment la question à chaque future table ajoutée.
// v0.61.4 — ajout de la table 'actes' (chantier « ACTE EXPLICITE PERSISTANT PORTANT SUR UNE TRACE »,
// 03/10/2026) : MÊME RAPPEL que ci-dessus, 11 = 10+1, migration purement additive (onupgradeneeded ne
// crée que les magasins manquants, ne touche jamais aux données déjà présentes — voir tests/
// acte-explicite.test.mjs, lettre Q, qui vérifie explicitement la conservation des anciennes tables).
// v0.62.0 — ajout de la table 'enonces' (ÉTAPE 6, « CONSERVATION BRUTE D'UN ÉNONCÉ ENVOYÉ EN RÉPONSE
// À UNE TRACE », 03/10/2026) : MÊME RAPPEL, 12 = 11+1, migration purement additive — voir
// tests/enonces.test.mjs (conservation des anciennes tables) et tests/traces-schema.test.mjs (contrat).
// v0.62.4 — ajout de la table 'observationsComposition' (ÉTAPE 6, « OBSERVATIONS DE COMPOSITION »,
// 03/10/2026) : MÊME RAPPEL, 13 = 12+1, migration purement additive — voir tests/observations-composition.test.mjs.
// v0.63.0 — ajout de la table 'observationsLangage' (ÉTAPE 7, « OBSERVATION PASSIVE DE LA COMPRÉHENSION »,
// 04/10/2026) : MÊME RAPPEL, 14 = 13+1, migration purement additive — voir tests/observations-langage-schema.test.mjs.
// v0.63.16 — ajout de la table 'observationsPossibilites' (« OBSERVATION DES POSSIBILITÉS AU MOMENT VÉCU », 04/10/2026) :
// MÊME RAPPEL, 15 = 14+1, migration purement additive — voir tests/observations-possibilites-schema.test.mjs.
// v0.63.19 — ajout de la table 'executionsOperations' (« FAIT PERSISTANT D'EXÉCUTION D'UNE OPÉRATION », 05/10/2026) :
// MÊME RAPPEL, 16 = 15+1, migration purement additive — voir tests/executions-operations.test.mjs.
// v0.63.22 — ajout de la table 'designations' (« FAIT PERSISTANT DE DÉSIGNATION », 05/10/2026) :
// MÊME RAPPEL, 17 = 16+1, migration purement additive — voir tests/designations.test.mjs.
// v0.63.23 — AUCUNE nouvelle table (« LIEN EXÉCUTION → DÉSIGNATION », 05/10/2026) : version 18 = 17+1 pour tracer le changement de
// contrat de executionsOperations (idDesignation) ; la mise à niveau ne crée rien et ne touche à aucune ligne existante.
// v0.63.27 — ajout de la table 'valeursDonnees' (« PERSISTER LA VALEUR DES DONNÉES ÉPHÉMÈRES », 05/10/2026) : MÊME RAPPEL, 19 = 18+1,
// 22 tables, migration purement additive (aucune ligne existante touchée, aucune reconstruction rétroactive) — voir tests/valeurs-donnees.test.mjs.
// v0.63.72 — ajout de la table 'contextesProspectifs' (« PERSISTER CE QUI ÉTAIT ENVISAGEABLE AVANT L'ISSUE », 07/10/2026) : MÊME RAPPEL, 20 = 19+1,
// 23 tables, migration purement additive (aucune ligne existante touchée, aucune reconstruction rétroactive : les anciens tours n'ont AUCUN contexte
// prospectif, et cela reste vrai) — voir tests/contexte-prospectif.test.mjs.
// v0.63.74 — ajout de la table 'attentesProspectives' (« PREMIÈRE ATTENTE GÉNÉRALE, ÉCRITE AVANT L'ISSUE », 07/10/2026) : MÊME RAPPEL, 21 = 20+1,
// 24 tables, migration purement additive (aucune attente rétroactive pour les anciens tours) — voir tests/attentes-prospectives.test.mjs.
export const TABLES = ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes', 'experiences', 'hypotheses', 'propositions', 'transformations', 'actions', 'liaisons', 'traces', 'actes', 'enonces', 'observationsComposition', 'observationsLangage', 'observationsPossibilites', 'executionsOperations', 'designations', 'valeursDonnees', 'contextesProspectifs', 'attentesProspectives'];
export const CLE = {
  faits: 'cle', lexique: 'mot', patrons: 'id', journal: 'id', proprietes: 'cle', regles: 'id', gabaritsTypes: 'id',
  experiences: 'id', hypotheses: 'id', propositions: 'id', transformations: 'id', actions: 'id', liaisons: 'id',
  traces: 'id', actes: 'id', enonces: 'id', observationsComposition: 'id', observationsLangage: 'id', observationsPossibilites: 'id', executionsOperations: 'id', designations: 'id', valeursDonnees: 'id', contextesProspectifs: 'id', attentesProspectives: 'id',
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

// GÉNÉRATEUR COMMUN D'IDENTIFIANTS (décision ChatGPT du 03/10/2026, chantier « IDENTIFIANTS
// UNIQUES », suite au diagnostic du même jour « DIAGNOSTIC GÉNÉRAL DES IDENTIFIANTS »).
// Correctif ciblé à l'origine (décision ChatGPT du 27/09/2026, suite au refus du colis v0.26.0 par
// le robot) -- l'ancien identifiant `experience-${Date.now()}-${Math.floor(Math.random()*1000)}`
// pouvait, à de rares occasions, être partagé par deux expériences créées à la même milliseconde
// avec le même tirage aléatoire, provoquant un écrasement silencieux dans le magasin (rangé par
// id). Un compteur monotone au niveau du module rend chaque appel du même processus strictement
// distinct, quel que soit le timing ou le hasard. Le diagnostic du 03/10/2026 a démontré, par
// reproduction forcée et réelle, que la MÊME classe de collision touchait aussi (sans ce compteur)
// transformations, actions, liaisons, règles, gabaritsTypes et patrons -- jamais les
// interprétations, dont l'id n'est jamais utilisé comme clé de recherche ni de stockage. Ce
// générateur UNIQUE remplace les deux compteurs séparés qui existaient déjà (sequenceExperience,
// sequenceTrace) et sert désormais toute nouvelle création concernée, ici et dans esprit.js (déjà
// dépendant de ce fichier pour cleFait/clePropriete). AUCUNE garantie absolue entre deux PROCESSUS
// différents (le compteur repart à 0 à chaque redémarrage) : seule la collision INTRA-PROCESSUS
// réellement démontrée est éliminée -- Date.now() et le tirage aléatoire restants gardent une
// marge supplémentaire, sans jamais être présentés comme une unicité mathématique universelle.
let sequenceId = 0;
// Exposée séparément (en plus de nouvelId() ci-dessous) UNIQUEMENT parce que enregistrerTrace()
// (plus bas) a besoin du nombre de séquence lui-même comme CHAMP PROPRE de la trace (`sequence`),
// pas seulement caché à l'intérieur de la chaîne d'id -- contrat préexistant, couvert par
// tests/traces-observation.test.mjs (`esprit.traces[0].sequence < esprit.traces[1].sequence`) et
// par le tri de esprit.js (`a.sequence - b.sequence`). Un compteur PARTAGÉ avec toutes les autres
// créations (transformations, actions, etc.) préserve cette propriété d'ordre strict entre deux
// traces, puisqu'il ne fait jamais que croître.
export function nouvelleSequence() {
  sequenceId += 1;
  return sequenceId;
}
export function nouvelId(prefixe) {
  return `${prefixe}-${Date.now()}-${nouvelleSequence()}-${Math.floor(Math.random() * 1000)}`;
}

// B1 — CONSERVATION D'EXPÉRIENCE.
// Le FACTUEL : ce qui a été reçu et répondu, immuable une fois écrit. « referenceMemoire » relie
// explicitement l'expérience aux DEUX ids réels de naissance-memoire ({idQuestion, idReponse}) —
// jamais reconstruits par « idQuestion+1 », pour ne pas dépendre d'une convention d'adjacence.
// Utilise désormais nouvelId() (voir plus haut) : même format visible, compteur partagé.
//
// v0.62 — DÉCISION CHATGPT « RÉFÉRENCE EXPLICITE ENTRE VÉCUS, SANS CAUSALITÉ INFÉRÉE » (03/10/2026),
// suite au diagnostic « CONSÉQUENCES » (même jour) qui a établi qu'aucun champ ne permettait
// aujourd'hui à une expérience de désigner une tentative (trace) antérieure. `referenceTrace` ajouté
// de façon STRICTEMENT ADDITIVE, MÊME DISCIPLINE EXACTE que `referenceMemoire` ci-dessus : un objet
// reçu, reshape vers UN SEUL champ nommé connu ({ idTrace }), jamais la valeur brute transmise telle
// quelle (un champ supplémentaire glissé par l'appelant, par exemple un prétendu jugement, est donc
// SILENCIEUSEMENT ignoré — jamais conservé). Default `null`.
//
// CE QUE CE CHAMP N'EST PAS, explicitement (section 1 du cadrage) : jamais une preuve que la trace a
// causé cette expérience, jamais une confirmation, jamais une invalidation, jamais une utilité,
// jamais un jugement, jamais une indication que l'utilisateur « répondait » à cette trace — une
// RELATION DESCRIPTIVE SEULE, que l'appelant choisit d'affirmer en la fournissant.
//
// VALIDATION (section 6 du cadrage, choix A délibéré) : AUCUNE vérification que `idTrace` désigne
// réellement une trace existante dans 'traces' — exactement le même choix, déjà en vigueur depuis
// toujours, pour `referenceMemoire` (jamais vérifié contre naissance-memoire). Cohérent avec la
// convention déjà en place, pas une exception introduite pour ce chantier.
//
// AUCUNE RECONSTRUCTION AUTOMATIQUE (section 4/11 du cadrage) : cette fonction ne lit JAMAIS
// `esprit.traces`, ne compare JAMAIS une `sequence` ni un horodatage, et n'est appelée par AUCUN
// mécanisme qui retiendrait automatiquement « la dernière trace » — seul un appelant qui possède
// DÉJÀ, de façon honnête, l'id d'une trace précise peut la fournir. Aujourd'hui, AUCUN appelant réel
// (main.js/pont.js) ne le fait : la primitive reste DORMANTE, volontairement (voir le rapport).
export async function enregistrerExperience(magasin, {
  texteRecu, texteRepondu, date, source, referenceMemoire = null, referenceTrace = null,
}) {
  const objet = {
    id: nouvelId('experience'),
    texteRecu: String(texteRecu),
    texteRepondu: String(texteRepondu),
    date,
    source,
    referenceMemoire: referenceMemoire
      ? { idQuestion: referenceMemoire.idQuestion, idReponse: referenceMemoire.idReponse }
      : null,
    referenceTrace: referenceTrace ? { idTrace: referenceTrace.idTrace } : null,
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
    id: nouvelId('transformation'),
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
    id: nouvelId('action'),
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

// === LIAISONS APPRISES (v0.43.0, décision ChatGPT « RÉFÉRENÇABILITÉ ET RÉUTILISATION SCALAIRE DES
// RÉSULTATS ») =====================================================================================
// PERSISTANCE SEULEMENT, même principe que apprendreAction()/apprendreRegle() ci-dessus : ne valide
// JAMAIS ici que capaciteSource/capaciteCible/role existent réellement dans le registre fermé (voir
// evaluerLiaison(), composition.js, pure et isolée, exactement comme evaluerAction() pour les
// actions) -- écrit seulement une liaison déjà évaluée par l'appelant.
// Une liaison est beaucoup plus simple qu'une règle ou une action : son IDENTITÉ est le quadruplet
// EXACT (capaciteSource, champ, capaciteCible, role) lui-même -- aucune notion de spécificité ni de
// conflit à trancher (contrairement aux règles, où plusieurs conditions peuvent se recouper) : soit
// cette liaison précise existe déjà (rien de nouveau à écrire), soit elle est nouvelle. PLUSIEURS
// liaisons distinctes peuvent coexister pour la MÊME capaciteSource (une seule capacité source peut
// alimenter plusieurs rôles différents, d'autres capacités cibles) : jamais un remplacement
// versionné ici, simplement une collection de correspondances explicitement enseignées.
export async function apprendreLiaison(magasin, {
  capaciteSource, champ, capaciteCible, role, origine = 'apprise-test',
}) {
  if (!capaciteSource || !champ || !capaciteCible || !role) {
    throw new Error('Liaison invalide : capaciteSource, champ, capaciteCible et role sont tous requis.');
  }
  const toutes = await magasin.lireTout('liaisons');
  const identique = toutes.find((l) => l.statut === 'validee' && l.capaciteSource === capaciteSource
    && l.champ === champ && l.capaciteCible === capaciteCible && l.role === role);
  if (identique) {
    return { objet: identique, explication: 'Je connaissais déjà cette liaison.' };
  }
  const objet = {
    id: nouvelId('liaison'),
    capaciteSource, champ, capaciteCible, role, statut: 'validee', origine,
    creee: new Date().toISOString(), modifiee: new Date().toISOString(),
  };
  await magasin.ecrire('liaisons', objet);
  return { objet, explication: `J'ai appris une liaison : « ${capaciteSource}.${champ} » → « ${capaciteCible}.${role} ».` };
}

// === TRACES DE RAISONNEMENT (v0.46, décision ChatGPT « OBSERVATION PASSIVE DES TENTATIVES DE
// RAISONNEMENT ») ================================================================================
// PERSISTANCE SEULE, PURE OBSERVATION : enregistrerTrace() ne fait QUE CONSERVER un événement déjà
// survenu (une capacité du registre a RÉELLEMENT été invoquée, par l'une des deux voies existantes —
// action apprise reconnue en conversation, ou Compose:/invoquerAvecLiaisons) — jamais une décision,
// jamais un déclenchement, jamais une interprétation de « réussite »/« utilité ». AUCUNE trace n'est
// créée pour une résolution de rôle qui échoue AVANT l'invocation (ecran.js ne l'appelle que lorsque
// la capacité a réellement été invoquée et a réellement renvoyé un résultat) : une trace = une
// tentative qui a réellement atteint la capacité, jamais davantage.
//
// Délibérément SÉPARÉE de 'experiences' (conversation naturelle), 'journal' (phrases non comprises),
// 'faits'/'regles'/'liaisons' (connaissances enseignées) : une trace ne décrit AUCUNE de ces notions,
// seulement un événement d'INVOCATION DE CAPACITÉ, quelle que soit sa provenance.
//
// IDENTIFIANT : utilise désormais le compteur PARTAGÉ (nouvelleSequence(), voir plus haut) au lieu
// d'un compteur séparé propre à cette seule fonction (v0.55.0, chantier « IDENTIFIANTS UNIQUES ») :
// `sequence` garantit toujours, à lui seul, un ordre total reconstructible entre deux traces, même
// si deux invocations survenaient à la même milliseconde -- la propriété ne dépend que du fait que
// le compteur ne décroît jamais, ce qui reste vrai qu'il soit partagé ou non avec d'autres créations.
//
// COPIE DÉFENSIVE du résultat et des arguments (JSON.parse(JSON.stringify(...))) : une trace est un
// INSTANTANÉ, jamais une référence partagée vers un objet encore manipulé ailleurs (ex. `regle` d'une
// déduction, référence vers une ligne de esprit.regles) — garantit qu'une trace ne peut jamais, même
// par inadvertance, modifier le résultat réel d'une capacité ni être modifiée par un usage ultérieur
// de ce résultat.

// v0.47 — DÉCISION CHATGPT « CONTEXTE PRÉ-CHOIX » (02/10) : `contexte` ajouté de façon STRICTEMENT
// ADDITIVE. CONTEXTE ≠ TENTATIVE (diagnostic du même jour) : ne doit JAMAIS contenir de capacité, de
// rôle propre à une capacité, ni rien venant du résultat — seulement ce qui est réellement observable
// AVANT qu'une capacité soit choisie. Pour la voie « action », c'est { texteBrut, tokens } (le texte
// reçu par tenterReconnaissanceAction() AVANT reconnaissance, et sa tokenisation générique via
// tokeniser(), transformation.js — réutilisé tel quel, aucun nouveau tokenizer). Pour la voie
// « composition » (Compose:), AUCUN contexte pré-choix n'existe réellement (le bloc structurel
// contient déjà la capacité choisie dès sa première ligne) : `contexte` y vaut explicitement `null`,
// JAMAIS un faux contexte reconstruit à partir de ce bloc. Une ancienne trace (v0.46.1, avant ce
// chantier) n'a simplement pas ce champ du tout : absence d'information, jamais recalculée après
// coup, jamais confondue avec le `null` explicite de la voie composition (deux absences de nature
// différente, voir le rapport de diagnostic).
// v0.53 — `provenancePositions` ajouté de façon ADDITIVE (décision ChatGPT « PROVENANCE
// POSITIONNELLE EXACTE DES RÔLES », 03/10/2026) : { [role]: position } pour une trace voie:'action'
// (le fait brut, tiré de action.roles au moment de l'invocation — voir action.js/ecran.js), ou
// `null` EXPLICITE pour une trace voie:'composition' (aucune position textuelle n'existe pour cette
// voie, même principe que `contexte: null` ci-dessus — une absence EXPLICITE, jamais confondue avec
// l'absence TOTALE du champ sur une trace antérieure à ce chantier, qui n'a simplement jamais ce
// champ). Valeur par défaut `null` : un appelant qui ne la fournit pas obtient explicitement
// « sans objet », jamais une reconstruction ultérieure par comparaison de valeurs (voir le
// diagnostic : une telle reconstruction peut produire un faux singleton).
// v0.62.3 — `provenanceLiaisons` ajouté de façon ADDITIVE (décision ChatGPT « PROVENANCE EXACTE DES
// LIAISONS », 03/10/2026), MÊME PRÉCÉDENT que `contexte` (v0.47) et `provenancePositions` (v0.53) :
// null OU { [rôle]: { idTraceSource: string|null, idLiaison: string|null } }, une entrée UNIQUEMENT pour
// un rôle réellement résolu par une liaison (composition.js). Le fait brut « cet argument vient de
// CETTE exécution de la capacité source via CETTE liaison » conservé au moment où il existe, jamais
// reconstruit. `null` = sans objet (voie action, voie rejeu, ou composition sans aucun rôle lié) ;
// `idTraceSource: null` = liaison utilisée mais exécution source inconnue (ex. panne de persistance de
// la trace source) ; une ancienne trace n'a simplement pas ce champ (absence, jamais confondue avec
// null, jamais reconstruite rétroactivement). `provenanceArguments` (rôle -> chaîne) reste INTACT.
// Aucune vue, aucun rejeu, aucun choix ne lit ce champ.
export async function enregistrerTrace(magasin, {
  capacite, voie, argumentsUtilises, provenanceArguments, resultat, contexte = null,
  provenancePositions = null, provenanceLiaisons = null,
}) {
  const maintenant = Date.now();
  const sequence = nouvelleSequence();
  const objet = {
    id: `trace-${maintenant}-${sequence}-${Math.floor(Math.random() * 1000)}`,
    sequence,
    horodatage: new Date().toISOString(),
    capacite,
    voie,
    argumentsUtilises: JSON.parse(JSON.stringify(argumentsUtilises)),
    provenanceArguments: JSON.parse(JSON.stringify(provenanceArguments)),
    resultat: JSON.parse(JSON.stringify(resultat)),
    contexte: contexte === null ? null : JSON.parse(JSON.stringify(contexte)),
    provenancePositions: provenancePositions === null ? null : JSON.parse(JSON.stringify(provenancePositions)),
    provenanceLiaisons: provenanceLiaisons === null ? null : JSON.parse(JSON.stringify(provenanceLiaisons)),
  };
  await magasin.ecrire('traces', objet);
  return objet;
}

// === ACTE EXPLICITE PERSISTANT (v0.61.4, décision ChatGPT « ACTE EXPLICITE PERSISTANT PORTANT SUR
// UNE TRACE », 03/10/2026, suite au diagnostic du même jour « QU'EST-CE QU'UN ACTE EXPLICITE DE
// RÉFÉRENCE DANS LE VÉCU DE NAISSANCE ? ») ========================================================
// OBJET PERSISTANT DE PREMIER ORDRE, séparé de 'experiences', 'traces' et 'liaisons' — PAS une
// expérience (une expérience signifie structurellement un échange conversationnel réel, démontré par
// ses consommateurs : induction.js/repererMotifs(), les panneaux ecran.js, qui lisent tous
// texteRecu/texteRepondu sans garde ; fabriquer une expérience vide l'aurait contaminée), PAS une
// mutation de la trace visée (une trace reste l'instantané immuable de l'invocation au moment T —
// voir enregistrerTrace() ci-dessus : « une trace = une tentative qui a réellement atteint la
// capacité, jamais davantage » — un acte est un AUTRE fait historique, créé plus tard, qui ne doit
// jamais réécrire ce premier instantané).
//
// SÉMANTIQUE STRICTE (section 2 du cadrage) : cet objet signifie UNIQUEMENT qu'un acte a réellement
// été enregistré, visant explicitement idTrace, à horodatage, via le canal origine. Il ne signifie
// JAMAIS : correct, incorrect, confirmation, correction, utile, inutile, récompense, conséquence,
// causalité, ou preuve que le rejeu visé était légitime — AUCUN de ces jugements n'est un champ de
// cet objet, et aucun n'est déduit ici.
//
// IDENTITÉ DE TRACE (section 4) : idTrace DOIT être fourni explicitement par l'appelant — jamais
// reconstruit (pas de dernière trace, pas de séquence, pas de timestamp, pas d'ordre de tableau, pas
// de similarité, pas de variable globale, pas de « pending »). Un idTrace absent, vide, ou non-string
// lève une erreur explicite plutôt que d'inventer un identifiant.
//
// VALIDATION DE L'ID (section 5, choix délibéré) : AUCUNE vérification que idTrace désigne réellement
// une trace existante dans 'traces' — exactement la même convention, déjà en vigueur, que
// referenceTrace (ci-dessus) et apprendreLiaison() (qui ne valide jamais capaciteSource/capaciteCible/
// role contre le registre réel) : « T existe » ≠ « l'acte concernant T est vrai/pertinent ». Une
// vérification d'existence transformerait une simple persistance en interprétation implicite — exclu.
//
// ORIGINE (section 3) : décrit le CANAL/la provenance de l'acte, jamais l'identité personnelle de
// Christophe (pas de valeur du type « clic-christophe »). Défaut 'explicite' lorsqu'omise — reprend
// un terme déjà présent dans le petit vocabulaire fixe du dépôt (provenanceArguments : 'texte' /
// 'explicite' / 'liaison' / 'rejeu'), cohérent avec le cadrage lui-même (« un acte EXPLICITE »).
// Si fournie, doit être une chaîne non vide, sinon levée explicite — jamais une coercition silencieuse.
//
// HORODATAGE (section 12) : jamais un paramètre accepté de l'appelant (élimine d'un coup toute
// question de validité d'un horodatage fourni) — calculé UNIQUEMENT à l'intérieur, au moment réel de
// l'enregistrement, même convention que enregistrerTrace() ci-dessus (new Date().toISOString()).
//
// IMMUTABILITÉ (section 7) : n'écrit QUE dans 'actes', ne lit ni ne modifie jamais 'traces' —
// plusieurs actes peuvent référencer le même idTrace sans jamais s'écraser entre eux (identité propre
// via nouvelId('acte'), compteur partagé, jamais l'identité de la trace elle-même).
//
// AUCUN CONSOMMATEUR (section 10) : cette fonction n'appelle JAMAIS apresNouveauVecu() (import même
// absent de ce fichier), n'invoque aucune capacité, ne crée aucune expérience, ne remplit aucun
// referenceTrace, ne porte aucun jugement — reste totalement dormante, comme demandé.
export async function enregistrerActe(magasin, { idTrace, origine } = {}) {
  if (typeof idTrace !== 'string' || idTrace.trim().length === 0) {
    throw new Error('Acte explicite invalide : idTrace est requis et doit être une chaîne non vide (jamais reconstruit ni inventé).');
  }
  const origineFinale = origine === undefined ? 'explicite' : origine;
  if (typeof origineFinale !== 'string' || origineFinale.trim().length === 0) {
    throw new Error('Acte explicite invalide : origine, si fournie, doit être une chaîne non vide.');
  }
  const objet = {
    id: nouvelId('acte'),
    idTrace,
    horodatage: new Date().toISOString(),
    origine: origineFinale,
  };
  await magasin.ecrire('actes', objet);
  return objet;
}
// === ÉNONCÉ ENVOYÉ EN RÉPONSE À UNE TRACE (v0.62.0, ÉTAPE 6, décision ChatGPT du 03/10/2026) ======
// FAIT BRUT ET RIEN D'AUTRE : « Christophe a explicitement envoyé cet énoncé en réponse à cette trace
// T » (bouton « Répondre », conversation/ecran.js). Objet de premier ordre, SÉPARÉ de 'experiences'
// (une expérience est un ÉCHANGE : texteRecu + texteRepondu ; referenceTrace y reste volontairement
// une relation descriptive neutre, inchangée) et de 'actes' (un geste sans contenu).
//
// CE QUE CET OBJET N'EST PAS, explicitement : jamais une correction, une approbation, un rejet, un
// jugement, une préférence, une valence ; jamais interprété (le texte est conservé OCTET POUR OCTET,
// aucun trim, aucune normalisation) ; aucun champ dérivé de la trace (ni capacité, ni voie, ni
// contexte) ; aucun lien vers ce que le traitement ultérieur du même message produit (expérience,
// enseignement, trace de rejeu, réponse d'un modèle) -- ces objets restent distincts et non reliés.
//
// VALIDATION (même choix A que referenceTrace et enregistrerActe) : idTrace est une chaîne non vide ;
// AUCUNE vérification que la trace existe encore (une trace introuvable plus tard -- import de
// sauvegarde, brouillon restauré -- ne rend pas l'énoncé faux : il a bien été envoyé). Le texte doit
// contenir au moins un caractère non blanc (un énoncé vide ne peut pas avoir été envoyé).
// HORODATAGE : jamais fourni par l'appelant, calculé ici au moment réel de l'enregistrement.
// ORIGINE : même petit vocabulaire que enregistrerActe ('interface' par défaut).
// AUCUN DÉDOUBLONNAGE : même texte + même trace envoyés deux fois = deux énoncés distincts (chaque
// soumission explicite est un nouvel événement). N'écrit QUE dans 'enonces' ; ne lit ni ne modifie
// jamais 'traces', 'experiences' ni 'actes' ; n'appelle jamais apresNouveauVecu() ; AUCUN consommateur
// (ni rejeu, ni vue-traces.js, ni choix) : totalement dormant pour toute décision.
export async function enregistrerEnonceSurTrace(magasin, { idTrace, texte, origine } = {}) {
  if (typeof idTrace !== 'string' || idTrace.trim().length === 0) {
    throw new Error('Énoncé invalide : idTrace est requis et doit être une chaîne non vide (jamais reconstruit ni inventé).');
  }
  if (typeof texte !== 'string' || texte.trim().length === 0) {
    throw new Error('Énoncé invalide : texte est requis et doit être une chaîne contenant au moins un caractère non blanc.');
  }
  const origineFinale = origine === undefined ? 'interface' : origine;
  if (typeof origineFinale !== 'string' || origineFinale.trim().length === 0) {
    throw new Error('Énoncé invalide : origine, si fournie, doit être une chaîne non vide.');
  }
  const objet = {
    id: nouvelId('enonce'),
    idTrace,
    texte,
    horodatage: new Date().toISOString(),
    origine: origineFinale,
  };
  await magasin.ecrire('enonces', objet);
  return objet;
}

// === OBSERVATION DE COMPOSITION (v0.62.4, ÉTAPE 6, décision ChatGPT « OBSERVATIONS DE COMPOSITION »,
// 03/10/2026, suite aux diagnostics « ÉTAT DES CANDIDATES À T » et « CONTRAT ») ===========================
// OBJET PERSISTANT DE PREMIER ORDRE, distinct de 'traces' (une trace = une INVOCATION réelle), de
// 'experiences' (un échange conversationnel), de 'actes' et de 'enonces'. Il signifie UNIQUEMENT :
// « à cet instant, pendant la résolution d'une composition, voici les rôles réellement examinés et l'état
// des liaisons candidates réellement observable à cet instant ». Il ne signifie JAMAIS : décision
// correcte/incorrecte, préférence, possibilité à choisir, apprentissage, récompense, conflit à résoudre.
// Spécifique à Compose (pas une table générique de tentatives). TOTALEMENT DORMANT : aucun consommateur
// (ni rejeu, ni vue-traces, ni choix, ni induction, ni capacité).
//
// CONTRAT :
//   { id, horodatage, operation, idTrace: string|null, roleNonResolu: string|null,
//     roles: [ { role, explicite: true } | { role, candidates: [ { idLiaison: string|null,
//       etat: 'aucun_resultat'|'champ_absent'|'champ_non_scalaire'|'utilisable',
//       idTraceSource?: string|null (ABSENT si aucun_resultat), valeur?: scalaire (UNIQUEMENT si utilisable) } ] } ] }
//   - roleNonResolu === null  <=>  la capacité cible a été invoquée ; string <=> la résolution s'est arrêtée
//     sur ce rôle (rôles suivants jamais observés). idTrace null <=> pas de trace B (abstention OU panne de trace).
//   - Absence de clé = sans objet ; null = applicable mais inconnu (idTraceSource) ou VRAIE valeur null.
//   - LIMITE JSON CONNUE ET ASSUMÉE : NaN / ±Infinity deviennent null et -0 devient 0 à la copie. Aucune
//     capacité actuelle ne produit de tels nombres ; si cela arrive un jour, le contrat sera rouvert.
//   - Jamais d'observation si aucun rôle n'a nécessité d'examiner des liaisons (tout explicite).
// L'horodatage est calculé ici, à l'écriture, jamais fourni par l'appelant. Une seule écriture finale.
const ETATS_CANDIDATE = ['aucun_resultat', 'champ_absent', 'champ_non_scalaire', 'utilisable'];
export async function enregistrerObservationComposition(magasin, { operation, idTrace = null, roleNonResolu = null, roles } = {}) {
  if (typeof operation !== 'string' || operation.length === 0) throw new Error('Observation invalide : operation requise.');
  if (idTrace !== null && (typeof idTrace !== 'string' || idTrace.length === 0)) throw new Error('Observation invalide : idTrace doit être null ou une chaîne non vide.');
  if (roleNonResolu !== null && (typeof roleNonResolu !== 'string' || roleNonResolu.length === 0)) throw new Error('Observation invalide : roleNonResolu doit être null ou une chaîne non vide.');
  if (!Array.isArray(roles) || !roles.some((r) => r && Array.isArray(r.candidates))) {
    throw new Error('Observation invalide : au moins un rôle avec candidates est requis (jamais pour une composition entièrement explicite).');
  }
  for (const r of roles) {
    if (!r || typeof r.role !== 'string' || r.role.length === 0) throw new Error('Observation invalide : chaque rôle doit être nommé.');
    if (Array.isArray(r.candidates)) {
      for (const c of r.candidates) {
        if (!c || !ETATS_CANDIDATE.includes(c.etat)) throw new Error('Observation invalide : état de candidate inconnu.');
        if ((c.etat === 'aucun_resultat') === Object.prototype.hasOwnProperty.call(c, 'idTraceSource')) {
          throw new Error('Observation invalide : idTraceSource est absent si et seulement si aucun_resultat.');
        }
        if ((c.etat === 'utilisable') !== Object.prototype.hasOwnProperty.call(c, 'valeur')) {
          throw new Error('Observation invalide : valeur est présente si et seulement si utilisable.');
        }
      }
    } else if (r.explicite !== true) {
      throw new Error('Observation invalide : un rôle sans candidates doit être explicite.');
    }
  }
  const objet = {
    id: nouvelId('observation-composition'),
    horodatage: new Date().toISOString(),
    operation,
    idTrace,
    roleNonResolu,
    roles: JSON.parse(JSON.stringify(roles)),
  };
  await magasin.ecrire('observationsComposition', objet);
  return objet;
}
// === OBSERVATION DE LANGAGE (v0.63.0, ÉTAPE 7, décision ChatGPT « OBSERVATION PASSIVE DE LA COMPRÉHENSION »,
// 04/10/2026, analyses 2 et 3) ====================================================================
// PORTÉE EXACTE (à ne jamais élargir) : cette table conserve « ce que le moteur de langage propre constate
// lorsqu'un message atteint la voie de conversation ORDINAIRE ». Les messages interceptés avant cette étape
// (marqueurs explicites, squelettes d'action/transformation reconnus, rejeu autonome, reprises forcées)
// n'y figurent PAS, volontairement : cette table n'observe donc PAS « tout ce que Christophe dit ».
// L'absence d'une ligne signifie seulement « aucune observation du moteur propre n'a pu être obtenue à T »
// (voie hors périmètre, panne d'analyse ou de capture) : elle ne vaut JAMAIS INCOMPRIS, PARTIEL ni COMPRIS.
//
// SENS : photographie passive d'UNE exécution de repondre() sur l'état de langage de l'instant T.
// etatComprendre = comprehension.etat (niveau comprendre()) ; etatRepondre = état renvoyé par repondre()
// (peut différer : composition, type appris). Ce ne sont PAS des jugements de qualité : un faux COMPRIS reste
// COMPRIS, un COMPRIS suivi de « Je ne sais pas » reste COMPRIS. Aucune branche de résolution n'est conservée
// (ni texte hypothétique, ni fait, ni patron, ni règle, ni conflit, ni compose/chemin/viaType), aucun `mots`
// (dérivable du texte), aucune empreinte de l'état des connaissances.
// TOTALEMENT DORMANT : aucun consommateur (ni expérience, ni hypothèse, ni induction, ni proposition,
// ni choix de moteur, ni vue) ; elle n'est lue que par l'export de sauvegarde.
//
// CONTRAT (clés CLOSES) :
//   { id, horodatage, texte, etatComprendre, etatRepondre, type, sujet: string|null, relation: string|null,
//     motsInconnus: string[], relationsNommees: [...], idTrace: string|null,
//     referenceMemoire: { idQuestion, idReponse } | null }
//   - texte : exactement le texte reçu, intégral, sans plafond ni normalisation.
//   - referenceMemoire : null à la capture ; remplacé UNIQUEMENT par rattacherObservationLangage(), et seulement
//     quand les DEUX identifiants réels existent (jamais de rattachement partiel).
//   - L'horodatage est calculé ici, à l'écriture, jamais fourni par l'appelant. Les tableaux sont COPIÉS.
const ETATS_OBSERVATION_LANGAGE = ['compris', 'partiel', 'incompris'];
// v0.63.1 — PROVENANCE DE L'ANALYSE (champ OPTIONNEL `provenanceAnalyse`, additif). Les positions référencent
// le tableau `mots` de comprendre() (index zéro-based ; `longueur` = nombre de tokens) ; voir comprendre.js.
// Une ligne écrite avant v0.63.1 n'a pas ce champ et reste valide ; aucune ancienne ligne n'est reconstruite.
// Absent (undefined) -> la ligne n'a PAS la clé. Aucune montée de VERSION_BASE (même table, même clé : IndexedDB
// stocke des objets libres) ni de SCHEMA_SAUVEGARDE (la sauvegarde recopie les lignes telles quelles).
const plageValide = (p) => !!p && typeof p === 'object' && Number.isInteger(p.debut) && p.debut >= 0 && Number.isInteger(p.longueur) && p.longueur >= 1;
function provenanceAnalyseValide(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  if (!p.groupe || !Number.isInteger(p.groupe.debut) || p.groupe.debut < 0) return false;
  if (p.type !== null && !plageValide(p.type)) return false;
  if (p.sujet !== null && !plageValide(p.sujet)) return false;
  if (p.relation !== null && !(Array.isArray(p.relation) && p.relation.length > 0 && p.relation.every(plageValide))) return false;
  if (!Array.isArray(p.ecartees)) return false;
  return p.ecartees.every((x) => plageValide(x) && typeof x.valeur === 'string' && typeof x.raison === 'string' && x.raison.length > 0);
}
export async function enregistrerObservationLangage(magasin, {
  texte, etatComprendre, etatRepondre, type, sujet = null, relation = null,
  motsInconnus, relationsNommees, idTrace = null, provenanceAnalyse = undefined,
} = {}) {
  if (typeof texte !== 'string' || texte.length === 0) throw new Error('Observation de langage invalide : texte requis.');
  if (!ETATS_OBSERVATION_LANGAGE.includes(etatComprendre)) throw new Error('Observation de langage invalide : etatComprendre inconnu.');
  if (!ETATS_OBSERVATION_LANGAGE.includes(etatRepondre)) throw new Error('Observation de langage invalide : etatRepondre inconnu.');
  if (typeof type !== 'string' || type.length === 0) throw new Error('Observation de langage invalide : type requis.');
  if (sujet !== null && typeof sujet !== 'string') throw new Error('Observation de langage invalide : sujet doit être null ou une chaîne.');
  if (relation !== null && typeof relation !== 'string') throw new Error('Observation de langage invalide : relation doit être null ou une chaîne.');
  if (!Array.isArray(motsInconnus) || !motsInconnus.every((m) => typeof m === 'string')) throw new Error('Observation de langage invalide : motsInconnus doit être un tableau de chaînes.');
  if (!Array.isArray(relationsNommees)) throw new Error('Observation de langage invalide : relationsNommees doit être un tableau.');
  if (idTrace !== null && (typeof idTrace !== 'string' || idTrace.length === 0)) throw new Error('Observation de langage invalide : idTrace doit être null ou une chaîne non vide.');
  if (provenanceAnalyse !== undefined && !provenanceAnalyseValide(provenanceAnalyse)) throw new Error('Observation de langage invalide : provenanceAnalyse mal formée.');
  const objet = {
    id: nouvelId('observation-langage'),
    horodatage: new Date().toISOString(),
    texte,
    etatComprendre,
    etatRepondre,
    type,
    sujet,
    relation,
    motsInconnus: [...motsInconnus],
    relationsNommees: JSON.parse(JSON.stringify(relationsNommees)),
    idTrace,
    referenceMemoire: null,
  };
  if (provenanceAnalyse !== undefined) objet.provenanceAnalyse = JSON.parse(JSON.stringify(provenanceAnalyse));
  await magasin.ecrire('observationsLangage', objet);
  return objet;
}

// Rattache une observation DÉJÀ écrite à l'échange réel du journal de conversation. Réécrit la même ligne
// (même clé) en ne remplaçant QUE referenceMemoire ; ne lit rien, ne touche aucune autre table. Exige les DEUX
// identifiants réels (jamais de rattachement partiel) : sinon, lève avant toute écriture.
const identifiantEchangeValide = (v) => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length > 0);
export async function rattacherObservationLangage(magasin, observation, { idQuestion, idReponse } = {}) {
  if (!observation || typeof observation.id !== 'string') throw new Error('Rattachement invalide : observation requise.');
  if (!identifiantEchangeValide(idQuestion) || !identifiantEchangeValide(idReponse)) {
    throw new Error('Rattachement invalide : idQuestion et idReponse réels sont tous deux requis.');
  }
  const objet = { ...observation, referenceMemoire: { idQuestion, idReponse } };
  await magasin.ecrire('observationsLangage', objet);
  return objet;
}
// === OBSERVATION DES POSSIBILITÉS (v0.63.16, décision ChatGPT « OBSERVATION DES POSSIBILITÉS AU MOMENT VÉCU », 04/10/2026) ===
// SENS : « lorsque le message M est arrivé, les données D ont été examinées face aux opérations O, et l'ensemble COMPLET des
// possibilités était P ». Une ligne par message engagé dans un tour, écrite AVANT tout traitement. L'état vécu est CONSERVÉ, jamais
// recalculé (le catalogue n'est pas versionné et l'univers de données dépend de l'état à T).
// CONTRAT (clés CLOSES, TROIS GÉNÉRATIONS depuis v0.63.57) :
//   ANCIENNE : { id, idMessage, horodatage, donneesExaminees, operationsExaminees, possibilites }                                      (6 clés)
//   NOUVELLE : { id, idMessage, horodatage, donneesExaminees, operationsExaminees, empreintesOperationsExaminees, possibilites }       (7 clés, v0.63.52)
//   TROISIÈME : { id, idMessage, horodatage, donneesExaminees, operationsExaminees, empreintesOperationsExaminees, empreintesCategoriesDonnees, possibilites } (8 clés, v0.63.57)
//   QUATRIÈME : { id, idMessage, horodatage, donneesExaminees, operationsExaminees, empreintesOperationsExaminees, empreintesCategoriesDonnees, empreintesContratsRelationnels, possibilites } (9 clés, v0.63.62)
//   - empreintesContratsRelationnels (v0.63.62, FACULTATIF à l'écriture, écrit par observerPossibilites) : la PREUVE du contrat RELATIONNEL (relations déclarées entre
//     entrées) du catalogue utilisé, calculée par le PRODUCTEUR : [{ categorie, empreinte }], exactement UNE entrée, objet simple de clés closes
//     { categorie: 'contrats-relationnels', empreinte: 64 hexadécimaux minuscules }, tableau dense, aucune propriété par accesseur. Validation STRUCTURELLE seulement : ce
//     module ne calcule ni ne recalcule rien. Acceptée seulement AVEC empreintesCategoriesDonnees (donc avec empreintesOperationsExaminees) : jamais seule, aucune
//     génération hybride. Absente : ligne de génération précédente, écrite telle quelle. Jamais ajoutée à une ligne existante. Persistée mais NON VÉRIFIÉE (v0.63.62).
//   - empreintesCategoriesDonnees (v0.63.57, FACULTATIF à l'écriture, écrit par observerPossibilites) : la PREUVE du contrat de la CATÉGORIE de donnée
//     « entrées d'une production », calculée par le PRODUCTEUR de l'observation : [{ categorie, empreinte }]. v0.63.65 : DEUX formats admis, distingués par le
//     contenu seul : ANCIEN [entrées(P)] (une entrée, 'entrees-de-production') ou NOUVEAU [entrées(P), message] (deux entrées, ordre canonique par catégorie, 'message' =
//     contrat de représentation de la catégorie message) ; chaque entrée = objet simple de clés closes { categorie, empreinte: 64 hexadécimaux minuscules }, tableau dense,
//     catégories uniques et connues, aucune propriété par accesseur. Une ligne EXISTANTE n'est jamais complétée : l'absence de l'entrée message signifie « non prouvé ».
//     Ce module VALIDE le FORMAT et conserve ; il ne calcule, ne canonise ni ne recalcule rien. Elle n'est acceptée qu'AVEC empreintesOperationsExaminees
//     (jamais seule : deux preuves distinctes, pas de génération hybride). Absente : ligne de génération précédente, écrite telle quelle (rien d'inventé).
//     Jamais ajoutée à une ligne existante. Aucune vérification n'existe encore (v0.63.58).
//   - empreintesOperationsExaminees (v0.63.52, FACULTATIF à l'écriture, écrit par observerPossibilites) : la PREUVE du contrat mécanique de chaque
//     opération examinée, telle que calculée par l'appelant sur le catalogue examiné (primitive d'empreinte des contrats) : [{ operation, empreinte }], une paire par opération
//     examinée, triée par operation, operation chaîne non vide, empreinte hex64 minuscule, aucun doublon, ensemble des operation EXACTEMENT égal
//     à operationsExaminees (sinon Error, rien d'écrit : jamais d'observation contradictoire). Ce module ne calcule ni ne canonise rien : il
//     VALIDE et conserve. Absente : ligne de génération ANCIENNE, écrite telle quelle (aucune empreinte inventée). Jamais ajoutée à une ligne existante.
//   - id : identité propre de l'observation (nouvelId, préfixe « observation-possibilites ») ; JAMAIS idMessage.
//   - idMessage : message.id exact (chaîne non vide). Le message lui-même n'est PAS persisté (ni texte, ni forme).
//   - donneesExaminees / operationsExaminees : chaînes non vides, SANS doublon, ordre canonique (unités de code, sans signification).
//     Elles seules permettent d'interpréter une ABSENCE d'atome (opération absente de operationsExaminees != examinée sans atome).
//   - possibilites : ensemble COMPLET des atomes { donnee, operation, entree }, trois chaînes non vides, SANS doublon, ordre
//     canonique (operation, entree, donnee). LISTE VIDE incluse : ligne présente + [] = calcul effectué, zéro possibilité ;
//     ligne absente = calcul non effectué ou écriture impossible.
//   - L'horodatage est calculé ici, à l'écriture. Aucun consommateur : la table n'est lue que par l'export de sauvegarde.
const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
function ensembleCanonique(valeurs, nom) {
  if (!Array.isArray(valeurs)) throw new Error(`Observation de possibilités invalide : ${nom} doit être un tableau.`);
  for (const v of valeurs) if (typeof v !== 'string' || v.length === 0) throw new Error(`Observation de possibilités invalide : ${nom} ne contient que des chaînes non vides.`);
  const copie = [...valeurs].sort(comparerCodes);
  for (let i = 1; i < copie.length; i += 1) if (copie[i] === copie[i - 1]) throw new Error(`Observation de possibilités invalide : ${nom} contient un doublon.`);
  return copie;
}
const EMPREINTE_HEX64 = /^[0-9a-f]{64}$/;
function empreintesCoherentes(valeur, operations) {
  const refus = (raison) => { throw new Error(`Observation de possibilités invalide : empreintesOperationsExaminees ${raison}.`); };
  if (!Array.isArray(valeur)) refus('doit être un tableau');
  if (valeur.length !== operations.length) refus('doit contenir exactement une paire par opération examinée');
  const paires = [];
  for (let rang = 0; rang < valeur.length; rang += 1) {
    const place = Object.getOwnPropertyDescriptor(valeur, rang);
    if (place === undefined || !('value' in place)) refus(`est creux ou illisible au rang ${rang}`);
    const p = place.value;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) refus(`: la paire ${rang} doit être un objet`);
    const cles = Reflect.ownKeys(p);
    if (cles.length !== 2 || !cles.includes('operation') || !cles.includes('empreinte')) refus(`: la paire ${rang} doit être exactement { operation, empreinte }`);
    const operation = Object.getOwnPropertyDescriptor(p, 'operation').value;
    const empreinte = Object.getOwnPropertyDescriptor(p, 'empreinte').value;
    if (typeof operation !== 'string' || operation.length === 0) refus(`: operation de la paire ${rang} doit être une chaîne non vide`);
    if (typeof empreinte !== 'string' || !EMPREINTE_HEX64.test(empreinte)) refus(`: empreinte de la paire ${rang} doit être 64 hexadécimaux minuscules`);
    if (rang > 0 && !(comparerCodes(paires[rang - 1].operation, operation) < 0)) refus(': doit être strictement triée par operation (sans doublon)');
    if (operation !== operations[rang]) refus(`: l'opération « ${operation} » ne correspond pas à operationsExaminees`);
    paires.push({ operation, empreinte });
  }
  return paires;
}
const CATEGORIE_PREUVE_ENTREES = 'entrees-de-production';
const CATEGORIE_PREUVE_MESSAGE = 'message';
const CATEGORIE_PREUVE_RELATIONS = 'contrats-relationnels';
// v0.63.65 : formats admis de empreintesCategoriesDonnees : [entrées(P)] (ancien) ou [entrées(P), message] (nouveau, ordre canonique par catégorie).
const FORMATS_CATEGORIES = [[CATEGORIE_PREUVE_ENTREES], [CATEGORIE_PREUVE_ENTREES, CATEGORIE_PREUVE_MESSAGE]];
function categoriesCoherentes(valeur, champ = 'empreintesCategoriesDonnees', formats = FORMATS_CATEGORIES) {
  const refus = (raison) => { throw new Error(`Observation de possibilités invalide : ${champ} ${raison}.`); };
  if (!Array.isArray(valeur)) refus('doit être un tableau');
  const format = formats.find((attendues) => attendues.length === valeur.length);
  if (format === undefined) refus(`doit contenir ${formats.map((attendues) => attendues.length).join(' ou ')} preuve(s) (${valeur.length})`);
  const connues = new Set(formats.flat());
  const preuves = [];
  for (let rang = 0; rang < valeur.length; rang += 1) {
    const place = Object.getOwnPropertyDescriptor(valeur, rang);
    if (place === undefined || !('value' in place)) refus(`est creux ou illisible au rang ${rang}`);
    const p = place.value;
    if (p === null || typeof p !== 'object' || Array.isArray(p)) refus(': la preuve doit être un objet');
    const proto = Object.getPrototypeOf(p);
    if (proto !== Object.prototype && proto !== null) refus(': la preuve doit être un objet simple');
    const cles = Reflect.ownKeys(p);
    if (cles.length !== 2 || !cles.includes('categorie') || !cles.includes('empreinte')) refus(': la preuve doit être exactement { categorie, empreinte }');
    const categorie = Object.getOwnPropertyDescriptor(p, 'categorie');
    const empreinte = Object.getOwnPropertyDescriptor(p, 'empreinte');
    if (!('value' in categorie) || !('value' in empreinte)) refus(': la preuve ne doit contenir aucune propriété par accesseur');
    if (!connues.has(categorie.value)) refus(': categorie inconnue');
    if (preuves.some((deja) => deja.categorie === categorie.value)) refus(`: la catégorie « ${categorie.value} » est dupliquée`);
    if (categorie.value !== format[rang]) refus(`: categorie doit être exactement « ${format[rang]} » à ce rang (ordre canonique par catégorie)`);
    if (typeof empreinte.value !== 'string' || !EMPREINTE_HEX64.test(empreinte.value)) refus(': empreinte doit être 64 hexadécimaux minuscules');
    preuves.push({ categorie: categorie.value, empreinte: empreinte.value });
  }
  return preuves;
}
export async function enregistrerObservationPossibilites(magasin, { idMessage, donneesExaminees, operationsExaminees, possibilites, empreintesOperationsExaminees, empreintesCategoriesDonnees, empreintesContratsRelationnels } = {}) {
  if (typeof idMessage !== 'string' || idMessage.length === 0) throw new Error('Observation de possibilités invalide : idMessage requis.');
  const donnees = ensembleCanonique(donneesExaminees, 'donneesExaminees');
  const operations = ensembleCanonique(operationsExaminees, 'operationsExaminees');
  const empreintes = empreintesOperationsExaminees !== undefined ? empreintesCoherentes(empreintesOperationsExaminees, operations) : null;
  if (empreintesCategoriesDonnees !== undefined && empreintes === null) throw new Error('Observation de possibilités invalide : empreintesCategoriesDonnees exige empreintesOperationsExaminees (jamais seule).');
  const categories = empreintesCategoriesDonnees !== undefined ? categoriesCoherentes(empreintesCategoriesDonnees) : null;
  if (empreintesContratsRelationnels !== undefined && categories === null) throw new Error('Observation de possibilités invalide : empreintesContratsRelationnels exige empreintesCategoriesDonnees (jamais seule).');
  const relationnelles = empreintesContratsRelationnels !== undefined ? categoriesCoherentes(empreintesContratsRelationnels, 'empreintesContratsRelationnels', [[CATEGORIE_PREUVE_RELATIONS]]) : null;
  if (!Array.isArray(possibilites)) throw new Error('Observation de possibilités invalide : possibilites doit être un tableau.');
  const atomes = possibilites.map((a) => {
    if (a === null || typeof a !== 'object' || Array.isArray(a)) throw new Error('Observation de possibilités invalide : un atome est un objet.');
    for (const c of ['donnee', 'operation', 'entree']) if (typeof a[c] !== 'string' || a[c].length === 0) throw new Error(`Observation de possibilités invalide : atome.${c} requis.`);
    return { donnee: a.donnee, operation: a.operation, entree: a.entree };
  }).sort((x, y) => comparerCodes(x.operation, y.operation) || comparerCodes(x.entree, y.entree) || comparerCodes(x.donnee, y.donnee));
  for (let i = 1; i < atomes.length; i += 1) {
    const p = atomes[i - 1]; const q = atomes[i];
    if (p.operation === q.operation && p.entree === q.entree && p.donnee === q.donnee) throw new Error('Observation de possibilités invalide : possibilites contient un doublon.');
  }
  const objet = {
    id: nouvelId('observation-possibilites'),
    idMessage,
    horodatage: new Date().toISOString(),
    donneesExaminees: donnees,
    operationsExaminees: operations,
    ...(empreintes === null ? {} : { empreintesOperationsExaminees: empreintes }),
    ...(categories === null ? {} : { empreintesCategoriesDonnees: categories }),
    ...(relationnelles === null ? {} : { empreintesContratsRelationnels: relationnelles }),
    possibilites: atomes,
  };
  await magasin.ecrire('observationsPossibilites', objet);
  return objet;
}
// === FAIT PERSISTANT « LA DONNÉE D AVAIT CETTE VALEUR » (v0.63.27, décision ChatGPT « PERSISTER LA VALEUR DES DONNÉES ÉPHÉMÈRES », 05/10/2026) ===
// SENS : relation factuelle identité de donnée -> valeur brute, et RIEN d'autre. Pas un journal d'événements : une identité = une valeur.
// CONTRAT D'UNE LIGNE (clés CLOSES) : { id, valeur }
//   - id : l'identité EXACTE de la donnée source (clé primaire du magasin, option A : aucune seconde identité, aucun idDonnee, aucun
//     horodatage). Chaîne non vide.
//   - valeur : la valeur brute, une CHAÎNE (vide admise), conservée à l'identique (aucune normalisation, aucun trim, aucune dérivation :
//     ni forme, ni structure, ni longueur, ni profil). Les chaînes étant immuables, la ligne la contient sans copie.
// ÉCRITURE : la ligne n'est écrite qu'après validation complète (TypeError, rien d'écrit). Lecture préalable de la table (lireTout, seule
// primitive de lecture du magasin) : MÊME id + MÊME valeur = fait déjà vrai, AUCUNE écriture, la ligne existante est rendue ; MÊME id +
// valeur DIFFÉRENTE = TypeError, jamais de remplacement silencieux. Jamais de déduplication par valeur (deux identités, deux faits).
// La table dit « cette donnée a existé avec cette valeur », PAS « cette donnée a été observée avec succès ». Aucune ligne n'est jamais
// reconstruite pour un ancien message ; la garantie commence avec la première écriture. Les productions n'y sont PAS écrites (leur valeur
// reste portée par executionsOperations.resultat). Aucun consommateur : la table n'est lue que par cette primitive et par l'export de sauvegarde.
function champValeurDonnee(objet, champ, nom) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`Valeur de donnée invalide : ${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`Valeur de donnée invalide : ${nom}.${champ} est un accesseur (une donnée est attendue).`);
  return propriete.value;
}
export async function enregistrerValeurDonnee(magasin, entree) {
  if (entree === null || typeof entree !== 'object' || Array.isArray(entree)) throw new TypeError('Valeur de donnée invalide : l\'entrée doit être un objet.');
  for (const cle of Reflect.ownKeys(entree)) {
    if (cle !== 'id' && cle !== 'valeur') throw new TypeError('Valeur de donnée invalide : l\'entrée contient un champ étranger.');
  }
  const id = champValeurDonnee(entree, 'id', 'entrée');
  const valeur = champValeurDonnee(entree, 'valeur', 'entrée');
  if (typeof id !== 'string' || id.length === 0) throw new TypeError('Valeur de donnée invalide : id doit être une chaîne non vide.');
  if (typeof valeur !== 'string') throw new TypeError('Valeur de donnée invalide : valeur doit être une chaîne.');
  const lignes = await magasin.lireTout('valeursDonnees');
  if (!Array.isArray(lignes)) throw new TypeError('Valeur de donnée invalide : la lecture de la table doit rendre un tableau.');
  for (const ligne of lignes) {
    if (ligne === null || typeof ligne !== 'object') continue;
    const propre = Object.getOwnPropertyDescriptor(ligne, 'id');
    if (propre === undefined || !('value' in propre) || propre.value !== id) continue;
    const propreValeur = Object.getOwnPropertyDescriptor(ligne, 'valeur');
    if (propreValeur !== undefined && 'value' in propreValeur && propreValeur.value === valeur) return ligne;
    throw new TypeError('Valeur de donnée invalide : cette identité porte déjà une autre valeur (aucun remplacement).');
  }
  const objet = { id, valeur };
  await magasin.ecrire('valeursDonnees', objet);
  return objet;
}
// === FAIT PERSISTANT D'EXÉCUTION D'UNE OPÉRATION (v0.63.19, décision ChatGPT « FAIT PERSISTANT D'EXÉCUTION D'UNE OPÉRATION », 05/10/2026) ===
// SENS : « l'opération `operation` a RÉELLEMENT produit une valeur, à partir des données désignées par `liaisons` ». Rien d'autre :
// ni choix, ni succès/échec, ni score, ni récompense. UNE ligne = UNE production ; une opération qui lève avant résultat n'est PAS
// représentée ici (aucune tentative, aucun statut, aucune erreur). MONDE SÉPARÉ de 'traces' : ni enregistrerTrace, ni esprit.traces,
// ni vue-traces, ni rejeu ne sont concernés ; aucun consommateur (la table n'est lue que par l'export de sauvegarde).
// v0.63.23 — LIEN EXÉCUTION → DÉSIGNATION : la primitive reçoit la LIGNE de désignation (entrée { designation, operation, liaisons,
// resultat }, clés closes) et persiste idDesignation = designation.id, jamais un id fourni aveuglément, jamais recréé, jamais
// retrouvé par horodatage ni par ressemblance. Elle lit de la désignation, par propriétés propres de donnée, SEULEMENT id, operation
// et liaisons (ni horodatage, ni idObservation, ni le magasin designations ; les autres champs de la ligne sont ignorés sans lecture).
// COHÉRENCE exigée avant écriture : operation identique ET liaisons identiques après normalisation canonique (même nombre, mêmes
// entrées, mêmes données ; l'ordre fourni n'a aucun sens), sinon TypeError sans écriture. Aucune exécution sans désignation
// (absente / null / undefined / invalide : TypeError). La ligne designations n'est JAMAIS modifiée : provenance à sens unique.
// ANCIEN FORMAT : les lignes écrites avant v0.63.23 n'ont pas idDesignation. Aucune migration ne les réécrit ni n'en fabrique une
// (la sauvegarde ne valide pas les lignes une à une) : elles restent EXACTEMENT telles quelles, sans provenance connue.
// CONTRAT (clés CLOSES, aucun autre champ) : { id, horodatage, idDesignation, operation, liaisons, resultat [, sousDonnees] }
//   - id : nouvelId('execution-operation'). Identité du fait ET identité de la donnée produite ENTIÈRE. Calculée ici, avec l'horodatage ISO
//     (convention du dépôt) ; pas de `sequence`.
//     INVARIANT AMENDÉ (v0.63.46, α2-ligne) : l'identité d'une exécution est l'identité de sa production entière. Les champs obligatoires
//     nommés explicitement déclarés d'une sortie objet peuvent également recevoir des identités de données propres (clé optionnelle
//     `sousDonnees`, ci-dessous). Ces sous-données restent portées par la production et ne constituent pas des exécutions indépendantes.
//     (Ancien invariant : « aucune identité de résultat séparée ».)
//   - sousDonnees (v0.63.46, OPTIONNELLE) : [{ id, chemin:[nomDeChamp] }] — relations DÉJÀ CALCULÉES et validées par l'appelant (qui possède le
//     descripteur et la valeur réelle ; cette primitive n'importe pas le catalogue). Ici : FORMAT et invariants structurels seulement
//     (clés closes, ids uniques et distincts de l'id de l'exécution, chemins uniques, ordre
//     canonique par chemin sans signification de choix, chaque champ présent comme propriété propre de donnée du résultat). Clé ABSENTE =
//     aucune sous-donnée ; `[]` interdit. La clé n'est écrite que si elle est fournie : une ligne sans sous-donnée est identique à v0.63.45.
//     COLLISIONS : les ids viennent du générateur du dépôt (compteur partagé, horodatage, tirage) ; cette primitive ne LIT jamais la table. Une
//     collision éventuelle serait REFUSÉE à l'observation (la vue des productions exige l'unicité de toutes les identités), jamais fusionnée.
//   - operation : chaîne non vide, sans coercition ni trim. Cette primitive ne vérifie PAS que le nom est décrit ou autorisé :
//     elle n'importe ni les descriptions, ni la table des opérations, ni l'invocateur (structure du fait seulement).
//   - liaisons : tableau d'au moins UNE { entree, donnee } (chaînes non vides, SEULS champs admis), sans `entree` dupliquée, triées
//     par unités de code de `entree` (l'ordre fourni n'a aucun sens). La ligne contient une COPIE neuve. La complétude par rapport
//     aux entrées attendues de l'opération n'est PAS vérifiée ici (c'est l'affaire de l'invocation et des descriptions).
//     Les VALEURS d'entrée ne sont jamais persistées (ni porteur, ni forme, ni argumentsUtilises) : toute clé étrangère est refusée.
//   - resultat : COPIE JSON (JSON.parse(JSON.stringify(...)), comme enregistrerTrace) : seule forme que la sauvegarde (JSON) sait
//     restaurer à l'identique. L'original n'est jamais conservé par référence. Transformations JSON ASSUMÉES pour le contenu :
//     NaN/Infinity/-Infinity -> null ; -0 -> 0 ; valeurs `undefined`, fonctions et symboles d'une PROPRIÉTÉ d'objet -> propriété omise ;
//     ceux d'un ÉLÉMENT de tableau et les trous -> null ; propriétés de symbole et non énumérables ignorées. REFUS (TypeError, jamais
//     de SyntaxError ni de coercition) : racine undefined / fonction / symbole (aucune valeur JSON), BigInt, structure cyclique,
//     accesseur sur une propriété ou un élément lus par JSON (jamais exécuté), objet portant une méthode toJSON (Date comprise :
//     du code serait exécuté et la valeur transformée sans que l'opération l'ait produite ainsi).
//   - Écriture en TOUT OU RIEN : tout est validé et copié AVANT l'unique appel de magasin.ecrire ; aucune ligne partielle.
//     Le fait est IMMUABLE : cette primitive ne met jamais à jour ni ne réécrit une ligne. La valeur rendue est la ligne écrite
//     (le magasin en mémoire en garde la même instance, IndexedDB en garde un clone structuré : le contrat porte sur la VALEUR, pas
//     sur ===) ; elle peut servir de porteur (la primitive d'accès pur).
function champPropreDonnee(objet, champ, nom) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`Exécution d'opération invalide : ${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`Exécution d'opération invalide : ${nom}.${champ} est un accesseur (une donnée est attendue).`);
  return propriete.value;
}
function exigerObjetSimpleExec(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`Exécution d'opération invalide : ${nom} doit être un objet.`);
}
function exigerClesExactes(objet, autorisees, nom) {
  for (const cle of Reflect.ownKeys(objet)) {
    if (typeof cle !== 'string' || !autorisees.includes(cle)) throw new TypeError(`Exécution d'opération invalide : ${nom} contient un champ étranger.`);
  }
}
function exigerChaineNonVideExec(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) throw new TypeError(`Exécution d'opération invalide : ${nom} doit être une chaîne non vide.`);
}
// Parcours SANS EXÉCUTION de ce que JSON.stringify lira : propriétés propres énumérables de type chaîne, éléments de tableau.
function verifierLisibleParJson(valeur, ancetres, chemin) {
  if (valeur === null || typeof valeur !== 'object') return;
  if (ancetres.has(valeur)) throw new TypeError(`Exécution d'opération invalide : resultat est cyclique (${chemin}).`);
  let proto = valeur;
  while (proto !== null) {
    const m = Object.getOwnPropertyDescriptor(proto, 'toJSON');
    if (m !== undefined) throw new TypeError(`Exécution d'opération invalide : resultat contient un objet à méthode toJSON (${chemin}).`);
    proto = Object.getPrototypeOf(proto);
  }
  ancetres.add(valeur);
  const cles = Array.isArray(valeur) ? Array.from({ length: valeur.length }, (_, i) => String(i)) : Object.keys(valeur);
  for (const cle of cles) {
    const propriete = Object.getOwnPropertyDescriptor(valeur, cle);
    if (propriete === undefined) continue; // trou de tableau : JSON écrit null
    if (!('value' in propriete)) throw new TypeError(`Exécution d'opération invalide : resultat contient un accesseur (${chemin}.${cle}).`);
    verifierLisibleParJson(propriete.value, ancetres, `${chemin}.${cle}`);
  }
  ancetres.delete(valeur);
}
function copieJsonRefusante(valeur) {
  verifierLisibleParJson(valeur, new Set(), 'resultat');
  let texte;
  try {
    texte = JSON.stringify(valeur);
  } catch (erreur) {
    throw new TypeError(`Exécution d'opération invalide : resultat n'est pas représentable en JSON (${erreur.message}).`);
  }
  if (typeof texte !== 'string') throw new TypeError("Exécution d'opération invalide : resultat n'a aucune valeur JSON (racine undefined, fonction ou symbole).");
  return JSON.parse(texte);
}
// v0.63.23 — liaisons CANONIQUES (même représentation pour l'exécution et pour la désignation reçue) : tableau dense d'au moins UNE
// { entree, donnee } exactes (chaînes non vides), triées par unités de code de `entree`, sans `entree` dupliquée ; COPIE neuve.
function liaisonsCanoniquesExec(brutes, nom) {
  if (!Array.isArray(brutes)) throw new TypeError(`Exécution d'opération invalide : ${nom} doit être un tableau.`);
  if (brutes.length === 0) throw new TypeError(`Exécution d'opération invalide : ${nom} doit contenir au moins une liaison.`);
  const liaisons = [];
  for (let rang = 0; rang < brutes.length; rang += 1) {
    const brute = champPropreDonnee(brutes, String(rang), nom);
    exigerObjetSimpleExec(brute, `${nom}[${rang}]`);
    // v0.63.39 : { entree, donnee } (ordinaire, inchangée) ou { entree, donnees:[ids] } (collective), jamais mêlées.
    const collective = Object.hasOwn(brute, 'donnees');
    exigerClesExactes(brute, collective ? ['entree', 'donnees'] : ['entree', 'donnee'], `${nom}[${rang}]`);
    const nomEntree = champPropreDonnee(brute, 'entree', `${nom}[${rang}]`);
    exigerChaineNonVideExec(nomEntree, `${nom}[${rang}].entree`);
    if (collective) {
      const brutesIds = champPropreDonnee(brute, 'donnees', `${nom}[${rang}]`);
      if (!Array.isArray(brutesIds) || brutesIds.length === 0) throw new TypeError(`Exécution d'opération invalide : ${nom}[${rang}].donnees doit être un tableau non vide.`);
      const ids = brutesIds.map((_, k) => champPropreDonnee(brutesIds, String(k), `${nom}[${rang}].donnees`));
      ids.forEach((id, k) => exigerChaineNonVideExec(id, `${nom}[${rang}].donnees[${k}]`));
      if (new Set(ids).size !== ids.length) throw new TypeError(`Exécution d'opération invalide : ${nom}[${rang}].donnees contient une donnée dupliquée.`);
      liaisons.push({ entree: nomEntree, donnees: ids.sort(comparerCodes) });
      continue;
    }
    const donnee = champPropreDonnee(brute, 'donnee', `${nom}[${rang}]`);
    exigerChaineNonVideExec(donnee, `${nom}[${rang}].donnee`);
    liaisons.push({ entree: nomEntree, donnee });
  }
  liaisons.sort((a, b) => comparerCodes(a.entree, b.entree));
  for (let i = 1; i < liaisons.length; i += 1) {
    if (liaisons[i].entree === liaisons[i - 1].entree) throw new TypeError(`Exécution d'opération invalide : ${nom} contient une entrée dupliquée.`);
  }
  return liaisons;
}
export async function enregistrerExecutionOperation(magasin, entree) {
  exigerObjetSimpleExec(entree, 'entrée');
  exigerClesExactes(entree, ['designation', 'operation', 'liaisons', 'resultat', 'sousDonnees'].filter((cle) => cle !== 'sousDonnees' || Object.hasOwn(entree, 'sousDonnees')), 'entrée');
  const designation = champPropreDonnee(entree, 'designation', 'entrée');
  exigerObjetSimpleExec(designation, 'designation');
  const idDesignation = champPropreDonnee(designation, 'id', 'designation');
  exigerChaineNonVideExec(idDesignation, 'designation.id');
  const operationDesignee = champPropreDonnee(designation, 'operation', 'designation');
  exigerChaineNonVideExec(operationDesignee, 'designation.operation');
  const liaisonsDesignees = liaisonsCanoniquesExec(champPropreDonnee(designation, 'liaisons', 'designation'), 'designation.liaisons');
  const operation = champPropreDonnee(entree, 'operation', 'entrée');
  exigerChaineNonVideExec(operation, 'operation');
  const liaisons = liaisonsCanoniquesExec(champPropreDonnee(entree, 'liaisons', 'entrée'), 'liaisons');
  if (operation !== operationDesignee) throw new TypeError('Exécution d\'opération invalide : operation diffère de celle de la désignation.');
  if (liaisons.length !== liaisonsDesignees.length) throw new TypeError('Exécution d\'opération invalide : liaisons diffèrent de celles de la désignation (nombre).');
  for (let rang = 0; rang < liaisons.length; rang += 1) {
    const a = liaisons[rang]; const b = liaisonsDesignees[rang];
    const memesDonnees = a.donnees === undefined || b.donnees === undefined
      ? a.donnees === b.donnees && a.donnee === b.donnee
      : a.donnees.length === b.donnees.length && a.donnees.every((id, k) => id === b.donnees[k]);
    if (a.entree !== b.entree || !memesDonnees) {
      throw new TypeError('Exécution d\'opération invalide : liaisons diffèrent de celles de la désignation.');
    }
  }
  const resultat = copieJsonRefusante(champPropreDonnee(entree, 'resultat', 'entrée'));
  const objet = {
    id: nouvelId('execution-operation'),
    horodatage: new Date().toISOString(),
    idDesignation,
    operation,
    liaisons,
    resultat,
  };
  if (Object.hasOwn(entree, 'sousDonnees')) {
    const sousDonnees = sousDonneesCanoniques(champPropreDonnee(entree, 'sousDonnees', 'entrée'), 'sousDonnees', objet.id);
    if (resultat === null || typeof resultat !== 'object' || Array.isArray(resultat)) throw new TypeError('Exécution d\'opération invalide : sousDonnees exige un resultat objet.');
    for (const { chemin } of sousDonnees) {
      const [champ] = chemin;
      if (!Object.hasOwn(resultat, champ)) throw new TypeError(`Exécution d'opération invalide : sousDonnees désigne le champ « ${champ} » absent du resultat.`);
    }
    objet.sousDonnees = sousDonnees;
  }
  await magasin.ecrire('executionsOperations', objet);
  return objet;
}
// === FAIT PERSISTANT DE DÉSIGNATION (v0.63.22, décision ChatGPT « FAIT PERSISTANT DE DÉSIGNATION », 05/10/2026) ===
// SENS : « dans cette observation de possibilités, cette application DÉJÀ désignée devait être tentée ». Rien d'autre : ni pourquoi
// elle a été désignée, ni comment, ni si elle a été exécutée, ni si elle a réussi, ni si elle était bonne. Cette primitive ne CHOISIT
// JAMAIS : l'application lui est fournie par son appelant ; sans application elle refuse. Elle n'a aucune politique (ni première, ni
// dernière, ni hasard, ni tri comme sélection, ni préférence d'origine, ni compte de répétitions, ni score).
// CONTRAT (clés CLOSES, aucun autre champ) : { id, horodatage, idObservation, operation, liaisons, origine }
//   - origine (v0.63.33, « PROVENANCE DE LA DÉSIGNATION ») : QUI/QUOI a provoqué la désignation, fournie EXPLICITEMENT par l'appelant, jamais
//     choisie ni déduite ici (ni défaut, ni inférence depuis l'application ou l'observation). Valeur simple, extensible : une chaîne de
//     ORIGINES_DESIGNATION, aujourd'hui exactement ['exterieure'] = « provoquée de l'extérieur du mécanisme autonome de Naissance ». Cela ne dit
//     NI qui (Christophe, un test, un outil), NI pourquoi, NI qu'une interface existe. Aucune autre valeur n'est inventée (pas de valeur
//     « naissance » tant que Naissance ne choisit rien). Absente, undefined, vide, non chaîne ou hors liste : TypeError, AUCUNE écriture.
//   - ANCIENNES LIGNES (écrites avant v0.63.33) : elles n'ont PAS la clé `origine` et restent EXACTEMENT telles quelles. Absence = origine
//     inconnue du fait d'une époque sans provenance ; JAMAIS lue comme « exterieure », jamais reconstruite, jamais rejetée à la lecture.
//   - PERSISTANCE : aucune nouvelle table, aucune montée de VERSION_BASE ni de SCHEMA_SAUVEGARDE (même table, même clé ; IndexedDB stocke des
//     objets libres et la sauvegarde recopie les lignes telles quelles : précédent v0.53, v0.62.3, v0.63.1). La provenance reste portée par
//     la DÉSIGNATION seule : une exécution retrouve l'origine par idDesignation → désignation.id → origine, jamais copiée dans l'exécution.
//   - id : nouvelId('designation-application'). Identité de l'ÉVÉNEMENT de désignation seulement ; ni message.id, ni observation.id,
//     ni identité d'exécution. Aucune sémantique d'ordre.
//   - horodatage : ISO, calculé à l'écriture (moment où la désignation est enregistrée) ; aucun usage décisionnel.
//   - idObservation : observation.id de la LIGNE d'observation FOURNIE (la primitive ne va pas la chercher dans le magasin). Les
//     possibilités ne sont PAS recopiées : les alternatives restent dans observationsPossibilites (ni groupe, ni non-choisi).
//   - operation, liaisons : { operation, liaisons:[{ entree, donnee }] } normalisée comme enregistrerExecutionOperation (au moins une
//     liaison, chaînes non vides sans trim, une entrée au plus une fois, tri canonique par entree en unités de code, COPIE neuve).
//     La même donnée peut remplir plusieurs entrées. Ni valeur, ni forme, ni résultat, ni statut, ni erreur.
// APPARTENANCE : pour CHAQUE liaison {entree:E, donnee:D}, l'atome exact { donnee:D, operation, entree:E } doit figurer dans
// observation.possibilites, sinon TypeError. Cela garantit « cette liaison faisait partie des possibilités observées » ; cela ne
// signifie PAS que la primitive a choisi cette liaison.
// COMPLÉTUDE : enregistrerDesignation garantit l'appartenance des liaisons à l'observation fournie ; elle ne prouve pas à elle seule
// que l'application contient toutes les entrées exigées par la description de l'opération. Cette connaissance appartient au mécanisme
// amont qui construit une application à partir d'un groupe complet ; aucun statut « partiel » n'est inventé, aucune description,
// aucun groupe, aucune forme n'est consultée ici.
// LECTURE : propriétés propres de donnée (accesseur refusé SANS exécution, héritage refusé). L'observation n'est lue que par `id` et
// `possibilites` (tableau dense d'atomes exacts { donnee, operation, entree }) ; ses autres champs sont ignorés sans lecture.
// ÉCRITURE : tout est validé et copié AVANT l'unique appel magasin.ecrire (tout ou rien, TypeError, aucune ligne partielle). Fait
// IMMUABLE : aucune mise à jour. Une désignation existe indépendamment de toute exécution (qui ne la référence pas encore).
function champDesignation(objet, champ, nom) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`Désignation invalide : ${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`Désignation invalide : ${nom}.${champ} est un accesseur (une donnée est attendue).`);
  return propriete.value;
}
function objetDesignation(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`Désignation invalide : ${nom} doit être un objet.`);
}
function clesDesignation(objet, autorisees, nom) {
  for (const cle of Reflect.ownKeys(objet)) {
    if (typeof cle !== 'string' || !autorisees.includes(cle)) throw new TypeError(`Désignation invalide : ${nom} contient un champ étranger.`);
  }
}
function chaineDesignation(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) throw new TypeError(`Désignation invalide : ${nom} doit être une chaîne non vide.`);
}
function tableauDenseDesignation(valeur, nom) {
  if (!Array.isArray(valeur)) throw new TypeError(`Désignation invalide : ${nom} doit être un tableau.`);
  const elements = [];
  for (let rang = 0; rang < valeur.length; rang += 1) elements.push(champDesignation(valeur, String(rang), nom));
  return elements;
}
// v0.63.60 : deuxième valeur, 'mecanique' = « désignation produite par le déclencheur mécanique de Naissance elle-même, pour une application
// DÉJÀ entièrement déterminée par l'observation (aucun choix) ». Elle ne dit ni intention, ni préférence, ni pertinence. Aucune migration :
// même table, même clé ; les lignes antérieures (sans origine, ou 'exterieure') restent EXACTEMENT telles quelles.
export const ORIGINES_DESIGNATION = Object.freeze(['exterieure', 'mecanique']);
export async function enregistrerDesignation(magasin, entree) {
  objetDesignation(entree, 'entrée');
  clesDesignation(entree, ['observation', 'application', 'origine'], 'entrée');
  const observation = champDesignation(entree, 'observation', 'entrée');
  const application = champDesignation(entree, 'application', 'entrée');
  const origine = champDesignation(entree, 'origine', 'entrée');
  if (typeof origine !== 'string' || !ORIGINES_DESIGNATION.includes(origine)) throw new TypeError(`Désignation invalide : origine doit être l'une de ${ORIGINES_DESIGNATION.join(', ')} (fournie explicitement, sans défaut).`);
  objetDesignation(observation, 'observation');
  const idObservation = champDesignation(observation, 'id', 'observation');
  chaineDesignation(idObservation, 'observation.id');
  const possibles = new Map();
  tableauDenseDesignation(champDesignation(observation, 'possibilites', 'observation'), 'observation.possibilites').forEach((atome, rang) => {
    const nom = `observation.possibilites[${rang}]`;
    objetDesignation(atome, nom);
    clesDesignation(atome, ['donnee', 'operation', 'entree'], nom);
    const donnee = champDesignation(atome, 'donnee', nom);
    const operation = champDesignation(atome, 'operation', nom);
    const entreeAtome = champDesignation(atome, 'entree', nom);
    chaineDesignation(donnee, `${nom}.donnee`);
    chaineDesignation(operation, `${nom}.operation`);
    chaineDesignation(entreeAtome, `${nom}.entree`);
    if (!possibles.has(operation)) possibles.set(operation, new Map());
    const parEntree = possibles.get(operation);
    if (!parEntree.has(entreeAtome)) parEntree.set(entreeAtome, new Set());
    parEntree.get(entreeAtome).add(donnee);
  });
  objetDesignation(application, 'application');
  clesDesignation(application, ['operation', 'liaisons'], 'application');
  const operation = champDesignation(application, 'operation', 'application');
  chaineDesignation(operation, 'application.operation');
  const brutes = tableauDenseDesignation(champDesignation(application, 'liaisons', 'application'), 'application.liaisons');
  if (brutes.length === 0) throw new TypeError('Désignation invalide : application.liaisons doit contenir au moins une liaison.');
  const liaisons = [];
  brutes.forEach((brute, rang) => {
    const nom = `application.liaisons[${rang}]`;
    objetDesignation(brute, nom);
    // v0.63.39 : deux formes, jamais mêlées : { entree, donnee } (ordinaire, inchangée) ou { entree, donnees:[ids] } (collective).
    const collective = Object.hasOwn(brute, 'donnees');
    clesDesignation(brute, collective ? ['entree', 'donnees'] : ['entree', 'donnee'], nom);
    const nomEntree = champDesignation(brute, 'entree', nom);
    chaineDesignation(nomEntree, `${nom}.entree`);
    if (collective) {
      const ids = tableauDenseDesignation(champDesignation(brute, 'donnees', nom), `${nom}.donnees`);
      if (ids.length === 0) throw new TypeError(`Désignation invalide : ${nom}.donnees doit contenir au moins une donnée.`);
      ids.forEach((id, k) => chaineDesignation(id, `${nom}.donnees[${k}]`));
      if (new Set(ids).size !== ids.length) throw new TypeError(`Désignation invalide : ${nom}.donnees contient une donnée dupliquée.`);
      liaisons.push({ entree: nomEntree, donnees: ids.sort(comparerCodes) });
      return;
    }
    const donnee = champDesignation(brute, 'donnee', nom);
    chaineDesignation(donnee, `${nom}.donnee`);
    liaisons.push({ entree: nomEntree, donnee });
  });
  liaisons.sort((a, b) => comparerCodes(a.entree, b.entree));
  for (let i = 1; i < liaisons.length; i += 1) {
    if (liaisons[i].entree === liaisons[i - 1].entree) throw new TypeError('Désignation invalide : application.liaisons contient une entrée dupliquée.');
  }
  const parEntree = possibles.get(operation);
  for (const liaison of liaisons) {
    const donnees = parEntree === undefined ? undefined : parEntree.get(liaison.entree);
    if (liaison.donnees !== undefined) {
      // Liaison collective : l'ensemble EXACT des possibilités de cette entrée (ni sous-ensemble, ni donnée étrangère), sans quoi aucune écriture.
      if (donnees === undefined || donnees.size !== liaison.donnees.length || !liaison.donnees.every((id) => donnees.has(id))) {
        throw new TypeError(`Désignation invalide : la liaison collective « ${liaison.entree} » n'est pas l'ensemble exact des possibilités de l'observation.`);
      }
      continue;
    }
    if (donnees === undefined || !donnees.has(liaison.donnee)) throw new TypeError(`Désignation invalide : la liaison « ${liaison.entree} » n'est pas une possibilité de l'observation.`);
  }
  const objet = {
    id: nouvelId('designation-application'),
    horodatage: new Date().toISOString(),
    idObservation,
    operation,
    liaisons,
    origine,
  };
  await magasin.ecrire('designations', objet);
  return objet;
}
// === FIN_LANGAGE_CONNAISSANCES ===

// === CONTEXTE PROSPECTIF PERSISTÉ (v0.63.72, décision ChatGPT « PERSISTER CE QUI ÉTAIT ENVISAGEABLE AVANT L'ISSUE », 07/10/2026) ===
// SENS : « AVANT que cette application concrète (désignée) soit exécutée, voici ce que mes expériences comparables contenaient aux endroits
// encore inconnus des épisodes qu'elle pourrait produire ». Rien d'autre : ni attente, ni prédiction, ni choix, ni confirmation, ni préférence.
// UNE ligne = UN contexte prospectif = UNE projection (le CALCUL est pur : contextesProspectifs, contexte-prospectif.js ; ici on n'écrit que
// ce qu'il a rendu, sans y ajouter la moindre interprétation).
// LIGNE : { id, horodatage, idDesignation, idObservation, application, donnee, parent, structure, episodePartiel, temoins, chemins }.
//   id : nouvelId('contexte-prospectif') (identité TECHNIQUE de ligne) ; horodatage : instant réel de l'écriture ;
//   idDesignation / idObservation : la désignation (déjà écrite) de l'application concrète et son observation — l'ANCRAGE : après exécution,
//   l'exécution porte le même idDesignation (lien exécution → désignation, v0.63.23), et l'épisode visé est celui dont le départ et la structure
//   sont ceux du contexte ; les autres champs : EXACTEMENT ceux du contexte calculé (copie structurelle).
// ORDRE TEMPOREL — garantie MÉCANIQUE : si une ligne de executionsOperations porte DÉJÀ cet idDesignation, l'écriture est REFUSÉE : impossible
// de fabriquer après coup un contexte prétendant avoir précédé une issue déjà connue. De plus, `id` vient du compteur partagé nouvelId : la
// séquence de la ligne est postérieure à celle de la désignation et antérieure à celle de l'exécution (preuve d'ordre lisible).
// HISTOIRE FIGÉE : la ligne n'est jamais relue pour être recalculée ; ce qu'elle contient est l'autorité sur « ce qui était disponible
// avant ». Aucune ligne n'est jamais fabriquée pour une exécution passée (aucune reconstruction rétroactive).
function champContexte(objet, champ, nom) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`Contexte prospectif invalide : ${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`Contexte prospectif invalide : ${nom}.${champ} est un accesseur (une donnée est attendue).`);
  return propriete.value;
}
function objetContexte(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`Contexte prospectif invalide : ${nom} doit être un objet.`);
}
const CHAMPS_CONTEXTE = ['application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins'];
export async function enregistrerContexteProspectif(magasin, entree) {
  objetContexte(entree, 'entrée');
  for (const cle of Reflect.ownKeys(entree)) if (cle !== 'designation' && cle !== 'contexte') throw new TypeError('Contexte prospectif invalide : l\'entrée contient un champ étranger.');
  const designation = champContexte(entree, 'designation', 'entrée');
  const contexte = champContexte(entree, 'contexte', 'entrée');
  objetContexte(designation, 'designation');
  const idDesignation = champContexte(designation, 'id', 'designation');
  const idObservation = champContexte(designation, 'idObservation', 'designation');
  if (typeof idDesignation !== 'string' || idDesignation.length === 0) throw new TypeError('Contexte prospectif invalide : designation.id doit être une chaîne non vide.');
  if (typeof idObservation !== 'string' || idObservation.length === 0) throw new TypeError('Contexte prospectif invalide : designation.idObservation doit être une chaîne non vide.');
  objetContexte(contexte, 'contexte');
  for (const cle of Reflect.ownKeys(contexte)) if (!CHAMPS_CONTEXTE.includes(cle)) throw new TypeError('Contexte prospectif invalide : le contexte contient un champ étranger.');
  const copie = {};
  for (const champ of CHAMPS_CONTEXTE) copie[champ] = structuredClone(champContexte(contexte, champ, 'contexte'));
  objetContexte(copie.application, 'contexte.application');
  if (typeof copie.application.operation !== 'string' || copie.application.operation.length === 0) throw new TypeError('Contexte prospectif invalide : application.operation doit être une chaîne non vide.');
  if (!Array.isArray(copie.application.liaisons) || copie.application.liaisons.length === 0) throw new TypeError('Contexte prospectif invalide : application.liaisons doit être un tableau non vide.');
  if (copie.application.operation !== champContexte(designation, 'operation', 'designation')) throw new TypeError('Contexte prospectif invalide : l\'application du contexte n\'est pas celle de la désignation.');
  if (typeof copie.donnee !== 'string' || copie.donnee.length === 0) throw new TypeError('Contexte prospectif invalide : donnee doit être une chaîne non vide.');
  if (copie.parent !== null) objetContexte(copie.parent, 'contexte.parent');
  if (!Array.isArray(copie.structure) || copie.structure.length === 0) throw new TypeError('Contexte prospectif invalide : structure doit être un tableau non vide.');
  objetContexte(copie.episodePartiel, 'contexte.episodePartiel');
  if (!Array.isArray(copie.temoins) || !Array.isArray(copie.chemins)) throw new TypeError('Contexte prospectif invalide : temoins et chemins doivent être des tableaux.');
  // Garantie d'ordre : aucune exécution de cette désignation ne doit déjà exister.
  const executions = await magasin.lireTout('executionsOperations');
  if (executions.some((e) => e !== null && typeof e === 'object' && e.idDesignation === idDesignation)) {
    throw new Error(`Impossible d'enregistrer un contexte prospectif pour la désignation « ${idDesignation} » : son exécution existe déjà -- l'ordre contexte puis issue ne peut pas être inversé.`);
  }
  const objet = { id: nouvelId('contexte-prospectif'), horodatage: new Date().toISOString(), idDesignation, idObservation, ...copie };
  await magasin.ecrire('contextesProspectifs', objet);
  return objet;
}

// === ATTENTE PROSPECTIVE PERSISTÉE (v0.63.74, décision ChatGPT « PREMIÈRE ATTENTE GÉNÉRALE, ÉCRITE AVANT L'ISSUE », 07/10/2026) ===
// SENS : « pour ce chemin encore ouvert de ce contexte prospectif, ce constat précis est engagé AVANT l'issue, sur la base de ces expériences
// passées ». Un engagement écrit avant le résultat ; ni probable, ni certain, ni croyance, ni choix, ni réussite. Le CALCUL est pur
// (attentesDuContexteProspectif, attentes-prospectives.js) ; ici on n'écrit que ce qu'il a rendu, sans y ajouter la moindre interprétation.
// LIGNE : { id, horodatage, idDesignation, idObservation, idContexte, structure, chemin, constat, temoinsContexte, unitesIssues }.
//   id : nouvelId('attente-prospective') ; horodatage : instant réel de l'écriture ; idDesignation / idObservation / idContexte : l'ancrage
//   (la désignation précède l'exécution qui la référencera ; le contexte courant porte A et les chemins ouverts) ; les autres champs :
//   EXACTEMENT ceux de l'attente calculée (copie structurelle) — structure et chemin sont le critère, constat l'engagement, temoinsContexte la
//   couverture historique de A, unitesIssues la couverture des unités d'issue passées ayant établi B (FIGÉES : une issue différente ultérieure
//   ne change jamais cette ligne ; une nouvelle attente ne se forme plus si B n'est plus universel).
// ORDRE TEMPOREL — garantie MÉCANIQUE : si une ligne de executionsOperations porte DÉJÀ cet idDesignation, l'écriture est REFUSÉE : impossible
// de fabriquer après coup une attente prétendant avoir précédé une issue déjà connue. Le contexte référencé doit exister et porter le même
// idDesignation. Séquences (compteur partagé nouvelId) : désignation < contexte < attente < exécution.
// AUCUNE lecture par un mécanisme de choix, d'exécution, de réponse : la table n'est qu'une trace d'engagement avant issue.
const CHAMPS_ATTENTE = ['idContexte', 'idDesignation', 'structure', 'chemin', 'constat', 'temoinsContexte', 'unitesIssues'];
export async function enregistrerAttenteProspective(magasin, entree) {
  objetContexte(entree, 'entrée');
  for (const cle of Reflect.ownKeys(entree)) if (cle !== 'designation' && cle !== 'contexte' && cle !== 'attente') throw new TypeError('Attente prospective invalide : l\'entrée contient un champ étranger.');
  const designation = champContexte(entree, 'designation', 'entrée');
  const contexte = champContexte(entree, 'contexte', 'entrée');
  const attente = champContexte(entree, 'attente', 'entrée');
  objetContexte(designation, 'designation'); objetContexte(contexte, 'contexte'); objetContexte(attente, 'attente');
  const idDesignation = champContexte(designation, 'id', 'designation');
  const idObservation = champContexte(designation, 'idObservation', 'designation');
  const idContexte = champContexte(contexte, 'id', 'contexte');
  for (const [v, nom] of [[idDesignation, 'designation.id'], [idObservation, 'designation.idObservation'], [idContexte, 'contexte.id']]) if (typeof v !== 'string' || v.length === 0) throw new TypeError(`Attente prospective invalide : ${nom} doit être une chaîne non vide.`);
  if (champContexte(contexte, 'idDesignation', 'contexte') !== idDesignation) throw new TypeError('Attente prospective invalide : le contexte n\'est pas celui de la désignation.');
  for (const cle of Reflect.ownKeys(attente)) if (!CHAMPS_ATTENTE.includes(cle)) throw new TypeError('Attente prospective invalide : l\'attente contient un champ étranger.');
  const copie = {};
  for (const champ of CHAMPS_ATTENTE) copie[champ] = structuredClone(champContexte(attente, champ, 'attente'));
  if (copie.idContexte !== idContexte || copie.idDesignation !== idDesignation) throw new TypeError('Attente prospective invalide : l\'attente ne se rapporte pas à ce contexte et cette désignation.');
  if (!Array.isArray(copie.structure) || copie.structure.length === 0 || !Array.isArray(copie.chemin) || !Array.isArray(copie.temoinsContexte) || !Array.isArray(copie.unitesIssues) || copie.unitesIssues.length === 0) throw new TypeError('Attente prospective invalide : structure (non vide), chemin, temoinsContexte et unitesIssues (non vide) doivent être des tableaux.');
  objetContexte(copie.constat, 'attente.constat');
  if (typeof copie.constat.type !== 'string' || copie.constat.type.length === 0) throw new TypeError('Attente prospective invalide : constat.type doit être une chaîne non vide.');
  for (const cle of Reflect.ownKeys(copie.constat)) if (cle !== 'type' && cle !== 'valeur') throw new TypeError('Attente prospective invalide : constat contient un champ étranger.');
  // Garantie d'ordre : aucune exécution de cette désignation ne doit déjà exister.
  const executions = await magasin.lireTout('executionsOperations');
  if (executions.some((e) => e !== null && typeof e === 'object' && e.idDesignation === idDesignation)) {
    throw new Error(`Impossible d'enregistrer une attente prospective pour la désignation « ${idDesignation} » : son exécution existe déjà -- l'ordre attente puis issue ne peut pas être inversé.`);
  }
  const objet = { id: nouvelId('attente-prospective'), horodatage: new Date().toISOString(), idDesignation, idObservation, ...copie };
  await magasin.ecrire('attentesProspectives', objet);
  return objet;
}
