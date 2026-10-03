// === DEBUT_LANGAGE_RETOURS_TRACES ===
// ÉTAPE 5.4 — « VUE DESCRIPTIVE TRACE → EXPÉRIENCES RÉFÉRENCÉES → INTERPRÉTATIONS » (décision
// ChatGPT, 03/10/2026, suite au diagnostic 5.3 « QUE NOUS APPREND UN JUGEMENT SUR UNE EXPÉRIENCE
// QUI RÉFÉRENCE UNE TRACE ? »). PRIMITIVE PURE, READ-ONLY, DORMANTE -- même discipline exacte que
// vue-traces.js (traceExploitable()) : aucune écriture IndexedDB ici, aucune lecture du magasin.
// Elle reçoit directement les tableaux déjà lus par l'appelant (`traces`, `experiences`) et ne fait
// QUE les réassembler par identité stricte -- jamais un nouvel algorithme de découverte, jamais une
// interprétation de ce qu'elle réunit.
//
// NON BRANCHÉE : ce module n'est importé par AUCUN autre fichier du dépôt à ce stade (voir le test
// statique correspondant). Définition + tests seulement, comme demandé par le cadrage.
//
// IDENTITÉ DU LIEN (section 3 du cadrage) : une expérience E appartient à T UNIQUEMENT si
// E.referenceTrace existe, E.referenceTrace.idTrace est une chaîne non vide, ET cette chaîne est
// STRICTEMENT ÉGALE à l'id demandé -- jamais une proximité temporelle, une séquence, un timestamp,
// une similarité de texte, une égalité de résultat, de capacité, de voie ou d'arguments. Une trace
// introuvable dans `traces` ne doit JAMAIS être reconstruite depuis une expérience qui la
// référence : `trace` reste `null`, `etat` vaut 'introuvable' -- la liste des expériences qui
// référencent cet id peut rester non vide (un fait honnête : « ces expériences réclament un id qui
// ne correspond à aucune trace connue »), mais aucune trace n'est jamais fabriquée pour autant.
//
// INTERPRÉTATIONS (section 7/8) : exposées TELLES QUELLES, dans leur ordre réel de persistance,
// SANS AUCUNE sémantique nouvelle -- aucune conversion correct/incorrect → positif/négatif/réussite/
// échec, aucun score, aucune résolution de contradiction (deux jugements successifs, même
// contradictoires, restent deux entrées distinctes). Toute origine d'interprétation est conservée,
// pas seulement 'jugement-christophe'.
//
// ORDRE/DÉTERMINISME (section 9) : l'ordre de `experiences` en entrée n'est pas une donnée fiable
// (ordre accidentel d'un tableau déjà lu, potentiellement différent selon l'appelant). Ordre de
// sortie CHOISI et DOCUMENTÉ ici, fondé uniquement sur des données déjà présentes sur chaque
// expérience : `date` croissante (chaîne ISO 8601, comparable lexicographiquement), puis `id`
// (ordre lexicographique) pour départager une égalité stricte de date -- jamais l'ordre d'entrée.
//
// PURETÉ (section 10) : n'écrit aucune table, ne modifie aucun objet fourni (copie défensive à
// chaque niveau : trace, expérience, referenceTrace, chaque interprétation et ses `donnees`), ne
// juge rien, n'appelle aucune capacité, n'appelle pas apresNouveauVecu, ne déclenche aucune
// induction, ne modifie aucun choix futur.

// Copie défensive PROFONDE de la trace -- mêmes champs imbriqués (argumentsUtilises,
// provenanceArguments, resultat, contexte, provenancePositions) que ceux déjà clonés par
// enregistrerTrace() (connaissances.js) à l'écriture ; ici, à la LECTURE, pour qu'aucune mutation
// de la sortie ni de l'entrée ne puisse jamais se propager dans l'autre sens.
function copierTrace(trace) {
  return JSON.parse(JSON.stringify(trace));
}

function idTraceValide(referenceTrace) {
  return !!referenceTrace && typeof referenceTrace.idTrace === 'string' && referenceTrace.idTrace.length > 0;
}

function copierInterpretation(interpretation) {
  return { ...interpretation, donnees: { ...interpretation.donnees } };
}

function projeterExperience(experience) {
  return {
    id: experience.id,
    texteRecu: experience.texteRecu,
    texteRepondu: experience.texteRepondu,
    referenceTrace: { idTrace: experience.referenceTrace.idTrace },
    interpretations: experience.interpretations.map(copierInterpretation),
  };
}

function comparerExperiences(a, b) {
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

export function vueRetoursSurTrace(idTrace, traces, experiences) {
  const traceTrouvee = typeof idTrace === 'string' && idTrace.length > 0
    ? (traces || []).find((t) => t.id === idTrace) || null
    : null;

  const referencantes = (experiences || [])
    .filter((e) => e && idTraceValide(e.referenceTrace) && e.referenceTrace.idTrace === idTrace)
    .slice()
    .sort(comparerExperiences)
    .map(projeterExperience);

  return {
    etat: traceTrouvee ? 'trouvee' : 'introuvable',
    trace: traceTrouvee ? copierTrace(traceTrouvee) : null,
    experiences: referencantes,
  };
}
// === FIN_LANGAGE_RETOURS_TRACES ===
