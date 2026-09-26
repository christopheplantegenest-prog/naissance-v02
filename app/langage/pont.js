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

export async function tenterPontLangage(texte, { assurerEsprit, journaliser, enregistrerExperience, ajouterInterpretation }) {
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
    });
    await ajouterInterpretation(experience.id, { origine: 'comprendre', donnees: { ...local.comprehension } });
    return { texte: local.texte, local: true, laboratoire: true };
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
export async function enregistrerExperienceTentativeEchouee(texte, tentative, reponse, { enregistrerExperience, ajouterInterpretation }) {
  const experience = await enregistrerExperience({
    texteRecu: texte,
    texteRepondu: reponse.texte,
    date: reponse.dateQuestion,
    source: 'laboratoire',
    referenceMemoire: { idQuestion: reponse.idQuestion, idReponse: reponse.idReponse },
  });
  return ajouterInterpretation(experience.id, { origine: 'comprendre', donnees: { ...tentative.comprehension } });
}
// === FIN_LANGAGE_PONT ===
