// === DEBUT_LANGAGE_PONT ===
// A1 — Extraction structurelle : la décision « le laboratoire répond-il à ce tour de conversation ? »
// vivait auparavant en ligne dans main.js (non testable : pas d'export, couplage direct à document/
// window dès le chargement du module). Ici, une fonction EXPORTÉE, à dépendances injectées,
// strictement identique en comportement au code inline d'origine (voir tests de caractérisation).
//
// A2 — Branchement de B1 : quand le laboratoire répond avec certitude (COMPRIS), l'échange est
// désormais conservé comme une EXPÉRIENCE (app/langage/connaissances.js), avec une première
// interprétation « origine: comprendre » reprenant tel quel ce que comprendre() a produit — jamais
// recalculé par un second appel à repondre() (voir le test statique qui compte les appels réels).
//
// Chantier « conserver PARTIEL/INCOMPRIS » : quand la tentative locale échoue (PARTIEL/INCOMPRIS),
// tenterPontLangage() ne jette plus l'information (elle ne retournait rien, null) -- elle la
// TRANSMET sous { local: false, tentative: { etat, comprehension } }, SANS RIEN ÉCRIRE ici : à cet
// instant, la réponse réellement montrée à Christophe n'est pas encore connue (elle viendra du
// repli LLM dans main.js). enregistrerExperienceTentativeEchouee(), ci-dessous, est appelée par
// main.js UNE FOIS cette réponse réelle connue -- jamais par tenterPontLangage() lui-même, et
// jamais en rejouant comprendre()/repondre() : elle réutilise tel quel `tentative.comprehension`,
// déjà calculé par l'unique appel fait plus haut.
import { repondre, COMPRIS, PARTIEL, INCOMPRIS } from './esprit.js';

export async function tenterPontLangage(texte, {
  assurerEsprit, journaliser, enregistrerExperience, ajouterInterpretation, apresNouvelleExperience = async () => {},
  // ÉTAPE 5.2-bis — référence EXPLICITE sélectionnée par Christophe pour CE tour (ou null) :
  // transport ADDITIF, jamais recalculée ici, jamais retrouvée depuis texte. Voir connaissances.js
  // (reshape v0.61.2, seule source de vérité) : { idTrace } ou null, rien d'autre.
  referenceTrace = null,
  // v0.63.0 (ÉTAPE 7) — OBSERVATION PASSIVE : dépendance FACULTATIVE (voir creerObservateurLangage()
  // ci-dessous). Absente (valeur par défaut), le comportement est STRICTEMENT celui d'avant : l'esprit
  // n'est même pas ouvert pour un message sans « ? ».
  observer = null,
}) {
  // GARDE-FOU TROUVÉ EN TESTANT (pas anticipé dans l'analyse) : comprendre() peut atteindre l'état
  // COMPRIS sur une phrase qui n'est PAS une question — « J'ai un chat qui s'appelle Pixel » (une
  // simple présentation) est comprise comme une question sur « mon nom ». Restreint ici à un signe
  // de question explicite : couvre l'usage réel visé sans jamais intercepter une phrase qui n'en
  // est pas une.
  const ressembleAUneQuestion = texte.includes('?');
  // v0.63.0 — UNE SEULE exécution de l'analyse par message (un seul site d'appel, voir les gardes
  // statiques). Avec « ? » : exactement le comportement d'avant (les erreurs se propagent). Sans « ? » :
  // l'analyse n'a lieu QUE si un observateur est fourni, silencieusement (toute erreur est avalée) ; son
  // résultat ne sert JAMAIS la décision ci-dessous (`local` reste null) et n'est donc jamais une `tentative`.
  let analyse = null;
  if (ressembleAUneQuestion || observer) {
    try {
      const eLangage = await assurerEsprit();
      analyse = repondre(eLangage, texte);
    } catch (erreur) {
      if (ressembleAUneQuestion) throw erreur;
    }
  }
  const local = ressembleAUneQuestion ? analyse : null;
  // Capture passive AVANT toute décision (écriture attendue, jamais bloquante : un observateur qui lève est
  // traité comme une capture absente). `poignee` ne sert qu'au rattachement ultérieur à l'échange réel.
  let poignee = null;
  if (observer && analyse) {
    try { poignee = await observer(texte, analyse, referenceTrace); } catch { poignee = null; }
  }
  if (local && local.etat === COMPRIS) {
    const dateQuestion = new Date().toISOString();
    const [idQuestion, idReponse] = await journaliser(texte, local.texte, dateQuestion);
    // v0.63.0 — rattachement OPTIONNEL de l'observation à l'échange réel qui vient d'être écrit (jamais bloquant).
    if (poignee && typeof poignee.rattacher === 'function') {
      try { await poignee.rattacher({ idQuestion, idReponse }); } catch { /* jamais */ }
    }
    const experience = await enregistrerExperience({
      texteRecu: texte,
      texteRepondu: local.texte,
      date: dateQuestion,
      source: 'laboratoire',
      referenceMemoire: { idQuestion, idReponse },
      referenceTrace,
    });
    await ajouterInterpretation(experience.id, { origine: 'comprendre', donnees: { ...local.comprehension } });
    // Étape E (décision ChatGPT du 26/09/2026) — branche le repérage d'attentes DANS la conversation
    // normale : appelée APRÈS que l'expérience existe réellement, JAMAIS avant. pont.js ne sait rien
    // de ce que fait cette dépendance (voir main.js : reliée à
    // ecranLangage.reconnaitreAttentesPourExperience(), qui ne recalcule jamais les motifs
    // récurrents ici -- seulement les hypothèses DÉJÀ persistées). Facultative : son absence ne
    // change rien au comportement existant. v0.25 (décision ChatGPT du 27/09/2026) : le MÊME point
    // rend maintenant aussi un bilan { posees, proposition } -- pont.js reste ignorant de ce qu'est
    // « proposition » (jamais interprétée ici, seulement transmise) : elle est simplement reportée
    // sous propositionSpontanee, pour que main.js puisse l'annoncer APRÈS la réponse normale,
    // jamais à sa place.
    const bilan = await apresNouvelleExperience(experience.id);
    // idExperience (étape E) : permet à la conversation normale de proposer un jugement facultatif
    // (« correct »/« incorrect ») sur CETTE expérience précise, sans jamais retaper un identifiant.
    return {
      texte: local.texte, local: true, laboratoire: true, idExperience: experience.id,
      propositionSpontanee: (bilan && bilan.proposition) || null,
    };
  }
  if (local && (local.etat === PARTIEL || local.etat === INCOMPRIS)) {
    return { tentative: { etat: local.etat, comprehension: local.comprehension } };
  }
  return null;
}

// v0.63.0 (ÉTAPE 7) — OBSERVATION PASSIVE DE LA COMPRÉHENSION (décision ChatGPT, 04/10/2026). Fabrique PURE à
// dépendances injectées (main.js n'est pas testable). L'observateur retourné reçoit (texte, résultat de l'UNIQUE
// exécution de repondre(), referenceTrace), conserve ce qui a été constaté À T, et renvoie une « poignée » qui
// permet ensuite de rattacher la ligne à l'échange de journal réel. Il NE LÈVE JAMAIS : toute panne
// (validation, écriture, rattachement) est avalée, la poignée devient alors sans effet. Il n'appelle ni ne
// rappelle jamais l'analyse, n'écrit ni expérience, ni hypothèse, ni proposition, ni autre table.
//   enregistrer(donnees) -> ligne écrite (async) ; rattacher(ligne, {idQuestion, idReponse}) -> ligne (async).
// v0.63.1 — copie JSON simple (la provenance de comprendre() est gelée) ; undefined si absente, ce qui laisse
// la ligne d'observation SANS le champ (même forme qu'avant v0.63.1).
function copierProvenanceAnalyse(provenance) {
  return provenance ? JSON.parse(JSON.stringify(provenance)) : undefined;
}
export function creerObservateurLangage({ enregistrer, rattacher }) {
  const poigneeVide = { async rattacher() { return false; } };
  return async function observerLangage(texte, resultat, referenceTrace = null) {
    let ligne;
    try {
      const c = resultat.comprehension;
      ligne = await enregistrer({
        texte,
        etatComprendre: c.etat,
        etatRepondre: resultat.etat,
        type: c.type,
        sujet: c.sujet,
        relation: c.relation,
        motsInconnus: c.motsInconnus,
        relationsNommees: c.relationsNommees,
        // v0.63.1 — copie de la PROVENANCE que comprendre() a relevée pendant sa propre exécution (jamais
        // recalculée ici). Propriété non énumérable de la compréhension : lue uniquement par son nom.
        provenanceAnalyse: copierProvenanceAnalyse(c.provenanceAnalyse),
        idTrace: referenceTraceCapturable(referenceTrace) ? referenceTrace.idTrace : null,
      });
    } catch {
      return poigneeVide;
    }
    let rattachee = false;
    return {
      // Un seul rattachement par observation, et seulement avec les deux identifiants réels.
      async rattacher(echange) {
        if (rattachee || !echange) return false;
        try {
          await rattacher(ligne, { idQuestion: echange.idQuestion, idReponse: echange.idReponse });
          rattachee = true;
          return true;
        } catch {
          return false;
        }
      },
    };
  };
}

// Enregistre honnêtement, dans B1, un tour où la tentative langage locale a échoué (PARTIEL ou
// INCOMPRIS) mais où une réponse a bien été réellement montrée à Christophe par le repli LLM.
// `reponse` porte { texte, idQuestion, idReponse, dateQuestion } : le VRAI échange déjà écrit dans
// naissance-memoire par ce repli (esprit/esprit.js) -- jamais recréé ici, jamais rejoué. AUCUNE
// dépendance à journaliser/ajouterEchange : structurellement impossible de dupliquer l'échange
// mémoire depuis cette fonction (voir le test statique correspondant).
export async function enregistrerExperienceTentativeEchouee(texte, tentative, reponse, {
  enregistrerExperience, ajouterInterpretation, apresNouvelleExperience = async () => {},
  referenceTrace = null,
}) {
  const experience = await enregistrerExperience({
    texteRecu: texte,
    texteRepondu: reponse.texte,
    date: reponse.dateQuestion,
    source: 'laboratoire',
    referenceMemoire: { idQuestion: reponse.idQuestion, idReponse: reponse.idReponse },
    referenceTrace,
  });
  const miseAJour = await ajouterInterpretation(experience.id, { origine: 'comprendre', donnees: { ...tentative.comprehension } });
  const bilan = await apresNouvelleExperience(experience.id); // étape E, voir tenterPontLangage() ci-dessus.
  // v0.25 : champ additif, jamais persisté (miseAJour vient de connaissances.js) -- seulement porté
  // jusqu'à main.js, voir le commentaire équivalent dans tenterPontLangage() ci-dessus.
  return { ...miseAJour, propositionSpontanee: (bilan && bilan.proposition) || null };
}

// ÉTAPE 5.2-bis — ABSTENTION EXPLICITE (section 8/9 du cadrage) : fonction PURE, extraite ici pour
// rester testable -- main.js (bootstrap, aucun export, couplage direct à document/window) ne l'est
// pas, exactement la raison d'être de l'extraction A1 ci-dessus. main.js enveloppe CHAQUE retour de
// son dispatch à travers cette fonction : si une référence avait été explicitement sélectionnée par
// Christophe pour ce tour, et que CE tour n'a PAS réellement créé d'expérience (absence de
// resultat.idExperience -- seul marqueur fiable, posé UNIQUEMENT par les deux voies réelles
// ci-dessus), la perte est signalée sobrement, SANS JAMAIS fabriquer d'expérience/acte/trace, et
// SANS JAMAIS remplacer le texte réellement répondu : l'avertissement s'ajoute seulement au canal
// « actions » déjà utilisé pour les notes informatives (voir conversation/ecran.js). Une expérience
// réellement créée (idExperience présent), ou l'absence de référence sélectionnée, traverse ici
// strictement inchangée.
export const MESSAGE_REFERENCE_IGNOREE = "Ce message a été traité autrement et n'a pas pu être enregistré comme expérience liée à cette référence.";
// v0.62.0 (ÉTAPE 6) — échec RÉEL de conservation de l'énoncé lié à la trace : note sobre et explicite,
// jamais un faux succès. Affichée uniquement dans ce cas (la conservation normale reste silencieuse).
export const MESSAGE_ENONCE_NON_CONSERVE = "Ta réponse à cette trace n'a pas pu être conservée comme énoncé lié à elle.";

// v0.62.0 — une référence explicite est exploitable pour la capture si c'est un objet portant un
// idTrace chaîne non vide (même exigence que enregistrerEnonceSurTrace). Jamais reconstruite.
export function referenceTraceCapturable(referenceTrace) {
  return !!referenceTrace && typeof referenceTrace.idTrace === 'string' && referenceTrace.idTrace.trim().length > 0;
}

// ÉTAPE 6 — CAPTURE BRUTE D'UN ÉNONCÉ ENVOYÉ EN RÉPONSE À UNE TRACE (décision ChatGPT, 03/10/2026).
// Fonction PURE à dépendance injectée (main.js n'a aucun export et ne se teste pas : même raison
// d'être que le reste de ce fichier). Tente de persister {idTrace, texte} AVANT que n'importe quel
// chemin de traitement puisse consommer le message. Ne lève JAMAIS : un échec de persistance est
// rapporté par { etat:'echec' }, pour ne jamais bloquer la conversation.
//   { etat:'aucune' }  -> pas de référence explicite exploitable : rien n'est tenté (comportement
//                         antérieur strictement inchangé) ;
//   { etat:'conserve' } -> l'énoncé est persisté ;
//   { etat:'echec' }   -> la tentative a échoué (raison fournie, jamais masquée).
export async function capturerEnonceAvantTraitement(texte, referenceTrace, { enregistrerEnonce } = {}) {
  if (!referenceTraceCapturable(referenceTrace)) return { etat: 'aucune' };
  try {
    await enregistrerEnonce(referenceTrace.idTrace, texte);
    return { etat: 'conserve' };
  } catch (erreur) {
    return { etat: 'echec', raison: erreur && erreur.message ? erreur.message : String(erreur) };
  }
}

// v0.63.14 — ÉTAPE 6 : « IDENTITÉ DU MESSAGE ENTRANT AVANT TRAITEMENT » (décision ChatGPT, 04/10/2026).
// Un ENVOI = une identité : { id, texte }, rien de plus. `id` vient du générateur d'identités déjà utilisé par les objets du langage
// (nouvelId, injecté : ce fichier n'importe pas la mémoire), avec un préfixe qui n'est celui d'aucun autre objet (énoncé, observation,
// trace, expérience, journal). `texte` est EXACTEMENT la chaîne reçue par le tour (même référence, aucune normalisation).
// L'objet est gelé : c'est un fait vécu, pas un état. Il n'est PAS persisté, n'est lu par aucune décision, ne porte ni forme, ni
// type, ni analyse, ni résultat ; traiter() le reçoit en argument mais le traitement actuel ne l'utilise pas.
// Non bloquant : sans générateur, ou si le générateur lève ou ne rend pas une chaîne non vide, le résultat est null et le tour se
// déroule exactement comme avant. Un brouillon, une frappe ou une dictée ne sont jamais identifiés ; seul l'appel réel du tour l'est.
export const PREFIXE_MESSAGE = 'message';
export function identifierMessage(texte, { nouvelId } = {}) {
  if (typeof nouvelId !== 'function') return null;
  try {
    const id = nouvelId(PREFIXE_MESSAGE);
    if (typeof id !== 'string' || id.length === 0) return null;
    return Object.freeze({ id, texte });
  } catch {
    return null;
  }
}

// ÉTAPE 6 — ORCHESTRATION DU TOUR (appelée par main.js à la place d'un appel direct à traiterTour) :
// 1) capture brute AVANT tout traitement ; 2) traitement INCHANGÉ (`traiter` reçoit exactement le même
// texte, par fermeture côté appelant ; ses erreurs se propagent telles quelles) ; 3) enveloppe de
// sortie. Aucune interprétation de l'énoncé, aucun lien vers ses conséquences.
export async function traiterTourAvecEnonce(texte, referenceTrace, { enregistrerEnonce, traiter, nouvelId, observerPossibilites }) {
  // v0.63.14 — PREMIÈRE ligne du tour : l'identité du message vécu naît ICI, avant la capture d'énoncé et avant tout traitement.
  const message = identifierMessage(texte, { nouvelId });
  // v0.63.16 — OBSERVATION DES POSSIBILITÉS : APRÈS l'identité, AVANT la capture d'énoncé et tout traitement. Purement observationnelle
  // et facultative (injectée) : jamais bloquante, jamais lue pour décider, n'influence ni le texte ni le traitement.
  if (typeof observerPossibilites === 'function') {
    try { await observerPossibilites(message); } catch { /* observation : jamais bloquante */ }
  }
  const capture = await capturerEnonceAvantTraitement(texte, referenceTrace, { enregistrerEnonce });
  const resultat = await traiter(message);
  return appliquerAbstentionSiReferenceIgnoree(resultat, referenceTrace, capture.etat);
}

// ÉTAPE 5.2-bis — ABSTENTION EXPLICITE (inchangée quand `etatEnonce` est omis ou 'aucune') :
// v0.62.0 — `etatEnonce` (3e paramètre, facultatif) vient de capturerEnonceAvantTraitement() :
//   - 'conserve' : l'énoncé EST conservé -> aucune alerte (l'ancien message laisserait croire que la
//     réponse à la trace a été perdue) ; le résultat traverse strictement inchangé ;
//   - 'echec' : seule la note MESSAGE_ENONCE_NON_CONSERVE est ajoutée (pas en plus de l'ancienne) ;
//   - omis / 'aucune' : comportement historique (message d'abstention si aucune expérience créée).
export function appliquerAbstentionSiReferenceIgnoree(resultat, referenceTrace, etatEnonce) {
  if (etatEnonce === 'conserve') return resultat;
  if (etatEnonce === 'echec') {
    if (!resultat || typeof resultat !== 'object') return resultat;
    return { ...resultat, actions: [...(resultat.actions || []), MESSAGE_ENONCE_NON_CONSERVE] };
  }
  if (!referenceTrace || !resultat || resultat.idExperience) return resultat;
  return { ...resultat, actions: [...(resultat.actions || []), MESSAGE_REFERENCE_IGNOREE] };
}
// === FIN_LANGAGE_PONT ===
