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
import { repondre, COMPRIS } from './esprit.js';

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
  return null;
}
// === FIN_LANGAGE_PONT ===
