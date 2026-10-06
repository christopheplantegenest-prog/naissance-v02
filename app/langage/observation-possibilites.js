// === DEBUT_LANGAGE_OBSERVATION_POSSIBILITES ===
// v0.63.16 — ÉTAPE 6 : « OBSERVATION DES POSSIBILITÉS AU MOMENT VÉCU » (décision ChatGPT, 04/10/2026). Premier branchement réel
// de la chaîne message identifié → donnée de source → possibilités atomiques → observation persistante.
// v0.63.24 — « UNIVERS RÉEL ÉLARGI OBSERVÉ » (décision ChatGPT, 05/10/2026) : l'univers du tour n'est plus le seul message.
//
// observerPossibilites(message, { enregistrer, lireExecutions, descriptions }) enchaîne EXCLUSIVEMENT les primitives existantes :
//   1. donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE)         -> { identite, forme }   (v0.63.15)
//   2. lireExecutions()                                            -> lignes de executionsOperations (lecture INJECTÉE, v0.63.24)
//   3. productionsDecrites(lignes, descriptions)                   -> productions { identite, forme }  (v0.63.20)
//   4. possibilitesDeLiaison([donnée du message, ...productions], descriptions) -> atomes   (v0.63.13)
//   5. enregistrer({ idMessage, donneesExaminees, operationsExaminees, empreintesOperationsExaminees, possibilites }) -> persistance (UNE ligne)
//      (v0.63.52 : empreintesOperationsExaminees = empreintesDesContrats(descriptions), calculé sur le MÊME catalogue ; jamais vérifié ici)
// Aucune règle de forme ni de compatibilité n'est recopiée ici.
//
// UNIVERS EXAMINÉ (v0.63.24) : U = { le message courant } ∪ { TOUTES les productions décrites des lignes lues }. Aucun filtre : ni
// récence, ni ordre, ni opération, ni usage passé, ni origine, ni résultat, ni taille, ni identité, ni horodatage. Les lignes dont
// l'opération n'est pas décrite sont ignorées par productionsDecrites (contrat existant, pas une erreur). idDesignation n'est pas
// requis : une ancienne ligne { id, operation } reste une production. Exclus : anciennes traces, messages passés, énoncés,
// observations, expériences, jugements, actes, journal, désignations, observationsPossibilites elles-mêmes.
// UNE PHOTOGRAPHIE PAR TOUR : appelée une fois au début du tour ; jamais recalculée après une production ultérieure.
// OPÉRATIONS EXAMINÉES : les noms des descriptions présentées au calcul (par défaut DESCRIPTIONS_OPERATIONS).
//
// LECTURE : `lireExecutions` est OBLIGATOIRE (injectée, aucune abstraction nouvelle : l'appelant lit la table avec le magasin).
// Elle est appelée AVANT toute prétention de photographie complète. Absente, qui lève ou qui ne rend pas un tableau : 'echec_lecture',
// RIEN n'est écrit (une ligne limitée au message prétendrait à tort être la photographie complète). Une ligne dont la structure est
// invalide selon productionsDecrites : 'echec_executions', RIEN n'est écrit et la ligne n'est JAMAIS retirée en silence.
// NE LIT JAMAIS le texte du message NI aucun résultat d'exécution pour calculer les FORMES et les possibilités (les formes suffisent).
// Seule exception (v0.63.46, α2-ligne) : pour une SOUS-DONNÉE persistée, le porteur synthétique du tour référence la sous-valeur du `resultat`
// de la ligne porteuse (lecture structurelle d'une propriété propre, par référence, sans décision) ; une sous-valeur illisible = 'echec_executions'. NE FAIT JAMAIS ÉCHOUER le tour : ne lève
// pas, ne rejette pas. Aucun repli mensonger : en cas d'échec, RIEN n'est écrit, jamais une observation vide (une liste vide signifie
// uniquement « calcul réussi, aucune possibilité »). Ne choisit rien, n'exécute rien, ne désigne rien.
//
// RETOUR (v0.63.24, contrat explicite) : un objet { statut, observation, univers }.
//   - statut : 'ecrite' | 'sans_message' | 'echec_donnee' | 'echec_lecture' | 'echec_executions' | 'echec_calcul' | 'echec_ecriture'.
//   - observation : la LIGNE réellement écrite (rendue par `enregistrer`) si et seulement si statut === 'ecrite', sinon null. Un
//     enregistreur qui ne rend aucun objet viole son contrat : 'echec_ecriture'.
//   - univers : si 'ecrite', tableau LOCAL, NON PERSISTÉ, { donnee, porteur, acces } dans l'ordre message puis productions :
//     porteur = l'objet message vivant (acces DESCRIPTION_SOURCE_MESSAGE.acces) ou la LIGNE d'exécution d'identité identique
//     (acces ACCES_TRACE). Nécessaire pour que la brique suivante résolve les valeurs de CETTE photographie sans relire le magasin
//     (qui peut avoir changé) ni reconstruire les liens ; correspondance par égalité stricte production.identite === ligne.id.
//     Aucun registre global ; ce tableau n'est lu par aucune décision ici. Sinon null.
import { donneeDeSource } from './donnee-de-source.js';
import { DESCRIPTION_SOURCE_MESSAGE } from './source-message.js';
import { possibilitesDeLiaison } from './possibilites-liaison.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';
import { productionsDecrites } from './productions-decrites.js';
import { ACCES_TRACE } from './acces-trace.js';
import { indexSousDonnees, valeurSousDonnee } from './sous-donnees.js';
import { empreintesDesContrats } from './empreinte-contrats.js';

const echec = (statut) => ({ statut, observation: null, univers: null });

export async function observerPossibilites(message, { enregistrer, lireExecutions, descriptions = DESCRIPTIONS_OPERATIONS } = {}) {
  if (message === null || typeof message !== 'object') return echec('sans_message');
  let donnee;
  try {
    donnee = donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE);
  } catch {
    return echec('echec_donnee');
  }
  let executions;
  try {
    if (typeof lireExecutions !== 'function') throw new TypeError('lireExecutions absente.');
    executions = await lireExecutions();
    if (!Array.isArray(executions)) throw new TypeError('lireExecutions doit rendre un tableau.');
  } catch {
    return echec('echec_lecture');
  }
  try {
    productionsDecrites([], descriptions); // catalogue invalide : échec de CALCUL, pas d'exécution invalide
  } catch {
    return echec('echec_calcul');
  }
  let productions;
  try {
    productions = productionsDecrites(executions, descriptions);
  } catch {
    return echec('echec_executions');
  }
  const lignes = new Map();
  for (const ligne of executions) lignes.set(Object.getOwnPropertyDescriptor(ligne, 'id').value, ligne); // ids déjà validés, uniques
  let univers;
  try {
    // v0.63.46 : une identité qui n'est celle d'aucune ligne est une SOUS-DONNÉE : porteur synthétique { id, resultat: sous-valeur réelle par
    // référence }, même accès ACCES_TRACE. Si la sous-valeur n'est pas lisible, rien n'est écrit (jamais de donnée candidate sans valeur).
    const sousIndex = indexSousDonnees(executions);
    univers = [
      { donnee, porteur: message, acces: DESCRIPTION_SOURCE_MESSAGE.acces },
      ...productions.map((production) => {
        const ligne = lignes.get(production.identite);
        if (ligne !== undefined) return { donnee: production, porteur: ligne, acces: ACCES_TRACE };
        const sous = sousIndex.get(production.identite);
        if (sous === undefined) throw new TypeError('production sans porteur.');
        const resultat = Object.getOwnPropertyDescriptor(sous.execution, 'resultat');
        if (resultat === undefined || !('value' in resultat)) throw new TypeError('ligne porteuse de sous-donnée sans resultat lisible.');
        return { donnee: production, porteur: { id: production.identite, resultat: valeurSousDonnee(resultat.value, sous.chemin) }, acces: ACCES_TRACE };
      }),
    ];
  } catch {
    return echec('echec_executions');
  }
  const donnees = univers.map((element) => element.donnee);
  let possibilites;
  let operationsExaminees;
  let empreintesOperationsExaminees;
  try {
    possibilites = possibilitesDeLiaison(donnees, descriptions);
    operationsExaminees = descriptions.map((description) => description.nom);
    // v0.63.52 : la PREUVE des contrats examinés, calculée ICI, à partir du MÊME objet `descriptions` que possibilites et operationsExaminees
    // (aucun second catalogue, aucun recalcul ultérieur). Valeur rendue telle quelle par empreintesDesContrats, jamais retouchée.
    empreintesOperationsExaminees = empreintesDesContrats(descriptions);
  } catch {
    return echec('echec_calcul');
  }
  let observation;
  try {
    observation = await enregistrer({ idMessage: message.id, donneesExaminees: donnees.map((d) => d.identite), operationsExaminees, empreintesOperationsExaminees, possibilites });
    if (observation === null || typeof observation !== 'object') throw new TypeError("enregistrer doit rendre la ligne écrite.");
  } catch {
    return echec('echec_ecriture');
  }
  return { statut: 'ecrite', observation, univers };
}
// === FIN_LANGAGE_OBSERVATION_POSSIBILITES ===
