// === DEBUT_LANGAGE_OBSERVATION_POSSIBILITES ===
// v0.63.16 — ÉTAPE 6 : « OBSERVATION DES POSSIBILITÉS AU MOMENT VÉCU » (décision ChatGPT, 04/10/2026). Premier branchement réel
// de la chaîne message identifié → donnée de source → possibilités atomiques → observation persistante.
//
// observerPossibilites(message, { enregistrer, descriptions }) enchaîne EXCLUSIVEMENT les primitives existantes :
//   1. donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE)         -> { identite, forme }   (v0.63.15)
//   2. possibilitesDeLiaison([donnee], descriptions)               -> atomes                (v0.63.13)
//   3. enregistrer({ idMessage, donneesExaminees, operationsExaminees, possibilites })      -> persistance
// Aucune règle de forme ni de compatibilité n'est recopiée ici.
//
// UNIVERS EXAMINÉ : la seule donnée disponible est le message lui-même. LIMITE DOCUMENTÉE : aucune production d'opération
// antérieure n'est fournie. Il n'existe aucun mécanisme général de lecture des exécutions antérieures ; en inventer un ici pour
// remplir une liste aujourd'hui vide est interdit (et les 5 capacités exécutées ne correspondent à aucune des opérations décrites).
// OPÉRATIONS EXAMINÉES : les noms des descriptions présentées au calcul (par défaut DESCRIPTIONS_OPERATIONS).
//
// NE LIT JAMAIS le texte du message. NE FAIT JAMAIS ÉCHOUER le tour : ne lève pas, ne rejette pas. Elle rend une chaîne d'état,
// distinguant TROIS échecs : 'echec_donnee' (construction de la donnée de source), 'echec_calcul' (calcul des possibilités),
// 'echec_ecriture' (persistance). Aucun repli mensonger : en cas d'échec, RIEN n'est écrit, jamais une observation vide
// (une liste vide signifie uniquement « calcul réussi, aucune possibilité »). 'sans_message' : pas d'identité, rien à observer.
// Ne choisit rien, n'exécute rien, ne décide rien ; son résultat n'est lu par aucun mécanisme de décision.
import { donneeDeSource } from './donnee-de-source.js';
import { DESCRIPTION_SOURCE_MESSAGE } from './source-message.js';
import { possibilitesDeLiaison } from './possibilites-liaison.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';

export async function observerPossibilites(message, { enregistrer, descriptions = DESCRIPTIONS_OPERATIONS } = {}) {
  if (message === null || typeof message !== 'object') return 'sans_message';
  let donnee;
  try {
    donnee = donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE);
  } catch {
    return 'echec_donnee';
  }
  let possibilites;
  let operationsExaminees;
  try {
    possibilites = possibilitesDeLiaison([donnee], descriptions);
    operationsExaminees = descriptions.map((description) => description.nom);
  } catch {
    return 'echec_calcul';
  }
  try {
    await enregistrer({ idMessage: message.id, donneesExaminees: [donnee.identite], operationsExaminees, possibilites });
  } catch {
    return 'echec_ecriture';
  }
  return 'ecrite';
}
// === FIN_LANGAGE_OBSERVATION_POSSIBILITES ===
