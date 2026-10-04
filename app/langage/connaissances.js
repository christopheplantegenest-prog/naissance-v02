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

export const NOM_BASE = 'naissance-langage';
// Version 8 : ajout de la table « actions » (v0.38.0, LOT B2 — action interne apprise). Comme aux
// passages précédents, la mise à niveau ne crée QUE les tables manquantes : rien de ce qui existait
// avant n'est touché.
export const VERSION_BASE = 14; // v0.46 — ajout de la table 'traces' (observation passive des tentatives
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
export const TABLES = ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes', 'experiences', 'hypotheses', 'propositions', 'transformations', 'actions', 'liaisons', 'traces', 'actes', 'enonces', 'observationsComposition', 'observationsLangage'];
export const CLE = {
  faits: 'cle', lexique: 'mot', patrons: 'id', journal: 'id', proprietes: 'cle', regles: 'id', gabaritsTypes: 'id',
  experiences: 'id', hypotheses: 'id', propositions: 'id', transformations: 'id', actions: 'id', liaisons: 'id',
  traces: 'id', actes: 'id', enonces: 'id', observationsComposition: 'id', observationsLangage: 'id',
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
// === FIN_LANGAGE_CONNAISSANCES ===
