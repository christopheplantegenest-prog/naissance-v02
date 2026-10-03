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
}) {
  // GARDE-FOU TROUVÉ EN TESTANT (pas anticipé dans l'analyse) : comprendre() peut atteindre l'état
  // COMPRIS sur une phrase qui n'est PAS une question — « J'ai un chat qui s'appelle Pixel » (une
  // simple présentation) est comprise comme une question sur « mon nom ». Restreint ici à un signe
  // de question explicite : couvre l'usage réel visé sans jamais intercepter une phrase qui n'en
  // est pas une.
  const ressembleAUneQuestion = texte.includes('?');
  const eLangage = ressembleAUneQuestion ? await assurerEsprit() : null;
  const local = eLangage ? repondre(eLangage, texte) : null;
  if (local && local.etat === COMPRIS) {
    const dateQuestion = new Date().toISOString();
    const [idQuestion, idReponse] = await journaliser(texte, local.texte, dateQuestion);
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
export function appliquerAbstentionSiReferenceIgnoree(resultat, referenceTrace) {
  if (!referenceTrace || !resultat || resultat.idExperience) return resultat;
  return { ...resultat, actions: [...(resultat.actions || []), MESSAGE_REFERENCE_IGNOREE] };
}
// === FIN_LANGAGE_PONT ===
