// === DEBUT_LANGAGE_CONTEXTE_SOLLICITATION ===
// v0.63.35 — CONTEXTE EXACT D'UN TOUR POUR L'OUTIL DE SOLLICITATION (décision ChatGPT, 05/10/2026). Outil de développement ; EN MÉMOIRE SEULEMENT.
//
// suivreObservationDuTour(observer) -> { observer, joindre }
//   Créé UNE fois par tour (la fermeture est propre au tour : un nouveau tour ne remplace jamais le contexte d'un ancien).
//   observer(message)  : appelle l'observateur fourni et rend EXACTEMENT son retour (jamais modifié, jamais avalé : ses erreurs se propagent
//     telles quelles à l'appelant, qui les tolère déjà). Si ce retour est { statut: 'ecrite', observation, univers } avec observation et
//     univers objets, la paire RÉELLE (mêmes références, ni copie, ni relecture, ni nouvelle observation) est gardée pour ce tour.
//   joindre(resultat)  : si un contexte a été gardé et que `resultat` est un objet simple, rend un NOUVEL objet { ...resultat, sollicitation }
//     avec sollicitation = { observation, univers, applications, choixAFaire } (les deux premiers : les références gardées ; les deux
//     autres : applicationsSollicitables(observation)). Sinon (aucun contexte, observation non écrite, résultat non objet, calcul des
//     applications impossible) rend `resultat` tel quel : pas de zone de sollicitation.
// Rien n'est reconstruit depuis le texte, l'id du message ou une relecture ; rien n'est persisté ; aucun registre global ; ne choisit,
// ne désigne et n'exécute rien.
import { applicationsSollicitables } from './applications-sollicitables.js';

export function suivreObservationDuTour(observer) {
  if (typeof observer !== 'function') throw new TypeError('suivreObservationDuTour : observer doit être une fonction.');
  let contexte = null;
  return {
    observer: async (message) => {
      const retour = await observer(message);
      if (retour !== null && typeof retour === 'object' && retour.statut === 'ecrite'
        && retour.observation !== null && typeof retour.observation === 'object'
        && retour.univers !== null && typeof retour.univers === 'object') {
        contexte = { observation: retour.observation, univers: retour.univers };
      }
      return retour;
    },
    joindre: (resultat) => {
      if (contexte === null || resultat === null || typeof resultat !== 'object' || Array.isArray(resultat)) return resultat;
      let presentables;
      try { presentables = applicationsSollicitables(contexte.observation); } catch { return resultat; }
      return { ...resultat, sollicitation: { observation: contexte.observation, univers: contexte.univers, applications: presentables.applications, choixAFaire: presentables.choixAFaire } };
    },
  };
}
// === FIN_LANGAGE_CONTEXTE_SOLLICITATION ===
