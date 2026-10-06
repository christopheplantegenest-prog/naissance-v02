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
//   5. enregistrer({ idMessage, donneesExaminees, operationsExaminees, empreintesOperationsExaminees, empreintesCategoriesDonnees, possibilites }) -> persistance (UNE ligne)
//      (v0.63.52 : empreintesOperationsExaminees = empreintesDesContrats(descriptions), calculé sur le MÊME catalogue ; jamais vérifié ici)
//      (v0.63.57 : empreintesCategoriesDonnees = [{ categorie, empreinte }] pour la catégorie « entrées d'une production », rendue TELLE QUELLE par
//      empreinteContratEntreesProduction() dans le MÊME cycle de calcul ; rien n'est recalculé ni vérifié ici. Seule la PREUVE est persistée :
//      la catégorie n'entre ni dans donneesExaminees, ni dans les possibilités, ni dans l'univers.)
// Aucune règle de forme ni de compatibilité n'est recopiée ici.
//
// v0.63.59 — « ENTRÉES(P) DANS LES NOUVEAUX SNAPSHOTS » (décision ChatGPT, 06/10/2026). Pour CHAQUE exécution P présente dans l'univers (donc décrite par
// le catalogue présenté), la donnée ADJACENTE entrées(P) (v0.63.55) appartient au MÊME univers. Énumération mécanique, sans sélection (ni opération, ni
// valeur, ni forme, ni récence, ni taille, ni texte). Exclus : le message, les sous-données α2, entrées(P) elle-même (aucune récursion : P -> entrées(P) -> STOP).
// Chaque entrées(P) est construite avec EXACTEMENT les constantes et la fonction v0.63.54/55 (identiteEntreesProduction, FORME_ENTREES_PRODUCTION —
// copiée comme le fait la résolution explicite des identités —, ACCES_ENTREES_PRODUCTION, entreesDeProduction) : { donnee: { identite, forme }, porteur: { id, entrees }, acces }.
// ORDRE (réel, déterministe) : message, PUIS les productions décrites dans l'ordre canonique de productionsDecrites (tri par identité ; une sous-donnée
// est une production comme une autre), PUIS un BLOC entrées(P) : une par exécution P, dans l'ordre canonique de P (donc l'univers v0.63.58 est un PRÉFIXE de
// l'univers v0.63.59). Aucune signification n'est attachée à cet ordre. (La liste donneesExaminees PERSISTÉE est, elle, triée canoniquement par le magasin,
// comme avant : même ENSEMBLE que l'univers local, ordre de tri.) Une entrées(P) n'est JAMAIS posée avant P ni entre P et ses sous-données.
// ÉCHEC : si entreesDeProduction refuse une production présente (liaisons invalides) ou si une identité réelle porte le préfixe réservé des identités d'entrées
// (collision, jamais départagée), RIEN n'est écrit : 'echec_executions' (identité d'exécution ou de sous-donnée) ou 'echec_donnee' (identité de message).
// Les observations déjà persistées ne gagnent jamais entrées(P) rétroactivement ; seule la PREUVE de catégorie (v0.63.57) les accompagne.
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
import { CATEGORIE_ENTREES_PRODUCTION, empreinteContratEntreesProduction } from './empreinte-categorie-entrees.js';
import { FORME_ENTREES_PRODUCTION, ACCES_ENTREES_PRODUCTION, PREFIXE_IDENTITE_ENTREES, identiteEntreesProduction } from './entrees-donnee.js';
import { entreesDeProduction } from './entrees-production.js';

const echec = (statut) => ({ statut, observation: null, univers: null });

export async function observerPossibilites(message, { enregistrer, lireExecutions, descriptions = DESCRIPTIONS_OPERATIONS } = {}) {
  if (message === null || typeof message !== 'object') return echec('sans_message');
  let donnee;
  try {
    donnee = donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE);
    if (donnee.identite.startsWith(PREFIXE_IDENTITE_ENTREES)) throw new TypeError('identité de message dans le préfixe réservé des entrées.');
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
    for (const production of productions) {
      if (production.identite.startsWith(PREFIXE_IDENTITE_ENTREES)) throw new TypeError('identité de production dans le préfixe réservé des entrées.');
    }
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
    // v0.63.59 : le BLOC entrées(P), une par EXÉCUTION P présente (jamais une sous-donnée), dans l'ordre canonique des productions. Un refus de
    // entreesDeProduction ou de identiteEntreesProduction fait échouer tout le calcul d'univers : pas de snapshot où P serait présente sans entrées(P).
    for (const production of productions) {
      if (!lignes.has(production.identite)) continue;
      const identite = identiteEntreesProduction(production.identite);
      const entrees = entreesDeProduction(production.identite, executions);
      univers.push({ donnee: { identite, forme: JSON.parse(JSON.stringify(FORME_ENTREES_PRODUCTION)) }, porteur: { id: identite, entrees }, acces: ACCES_ENTREES_PRODUCTION });
    }
  } catch {
    return echec('echec_executions');
  }
  const donnees = univers.map((element) => element.donnee);
  let possibilites;
  let operationsExaminees;
  let empreintesOperationsExaminees;
  let empreintesCategoriesDonnees;
  try {
    possibilites = possibilitesDeLiaison(donnees, descriptions);
    operationsExaminees = descriptions.map((description) => description.nom);
    // v0.63.52 : la PREUVE des contrats examinés, calculée ICI, à partir du MÊME objet `descriptions` que possibilites et operationsExaminees
    // (aucun second catalogue, aucun recalcul ultérieur). Valeur rendue telle quelle par empreintesDesContrats, jamais retouchée.
    empreintesOperationsExaminees = empreintesDesContrats(descriptions);
    // v0.63.57 : la preuve du contrat de la catégorie, dans le même cycle ; un échec de ce calcul est un échec de CALCUL (rien n'est écrit).
    empreintesCategoriesDonnees = [{ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: empreinteContratEntreesProduction() }];
  } catch {
    return echec('echec_calcul');
  }
  let observation;
  try {
    observation = await enregistrer({ idMessage: message.id, donneesExaminees: donnees.map((d) => d.identite), operationsExaminees, empreintesOperationsExaminees, empreintesCategoriesDonnees, possibilites });
    if (observation === null || typeof observation !== 'object') throw new TypeError("enregistrer doit rendre la ligne écrite.");
  } catch {
    return echec('echec_ecriture');
  }
  return { statut: 'ecrite', observation, univers };
}
// === FIN_LANGAGE_OBSERVATION_POSSIBILITES ===
