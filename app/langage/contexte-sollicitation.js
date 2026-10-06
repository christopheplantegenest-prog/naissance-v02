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

// v0.63.60 — `declencheur` (FACULTATIF) : fonction ({ observation, univers }) appelée UNE FOIS, juste après l'écriture de l'observation de CE tour
//   (exécution mécanique des applications sans choix, voir execution-mecanique.js). Son retour { resultats } est gardé en mémoire pour joindre() ;
//   son échec n'est jamais avalé en silence : il est gardé comme `echecDeclenchement` et présenté, mais ne bloque pas le tour (comme l'observation).
//   Aucune boucle : l'observation de ce tour n'est jamais recalculée.
export function suivreObservationDuTour(observer, declencheur = null) {
  if (typeof observer !== 'function') throw new TypeError('suivreObservationDuTour : observer doit être une fonction.');
  if (declencheur !== null && typeof declencheur !== 'function') throw new TypeError('suivreObservationDuTour : declencheur doit être une fonction.');
  let contexte = null;
  return {
    observer: async (message) => {
      const retour = await observer(message);
      if (retour !== null && typeof retour === 'object' && retour.statut === 'ecrite'
        && retour.observation !== null && typeof retour.observation === 'object'
        && retour.univers !== null && typeof retour.univers === 'object') {
        contexte = { observation: retour.observation, univers: retour.univers, automatiques: [], echecDeclenchement: null };
        if (declencheur !== null) {
          try {
            const lot = await declencheur({ observation: retour.observation, univers: retour.univers });
            contexte.automatiques = lot && Array.isArray(lot.resultats) ? lot.resultats : [];
          } catch (erreur) {
            contexte.echecDeclenchement = erreur;
          }
        }
      }
      return retour;
    },
    joindre: (resultat) => {
      if (contexte === null || resultat === null || typeof resultat !== 'object' || Array.isArray(resultat)) return resultat;
      let presentables;
      try { presentables = applicationsSollicitables(contexte.observation); } catch { return resultat; }
      // v0.63.60 : une application déjà exécutée automatiquement (statut 'executee') n'est plus présentée comme à solliciter ; un échec reste présentable.
      const faites = new Set(contexte.automatiques.filter((r) => r.statut === 'executee').map((r) => r.operation));
      return { ...resultat, sollicitation: { observation: contexte.observation, univers: contexte.univers, applications: presentables.applications.filter((a) => !faites.has(a.operation)), choixAFaire: presentables.choixAFaire, automatiques: contexte.automatiques, echecDeclenchement: contexte.echecDeclenchement } };
    },
  };
}
// === FIN_LANGAGE_CONTEXTE_SOLLICITATION ===
