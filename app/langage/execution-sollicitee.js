// === DEBUT_LANGAGE_EXECUTION_SOLLICITEE ===
// v0.63.34 — ÉTAPE 7, SOUS-ÉTAPE 3 : « EXÉCUTER UNE APPLICATION EXPLICITEMENT SOLLICITÉE » (décision ChatGPT, 05/10/2026). PREMIER MÉCANISME
// D'USAGE. PRIMITIVE GÉNÉRALE, DORMANTE, QUI NE CHOISIT RIEN.
//
//   « une application PRÉCISE a déjà été fournie de l'extérieur : conserver cette sollicitation, exécuter exactement cette application,
//     conserver le résultat avec sa provenance exacte. »
//
// executerApplicationSollicitee({ observation, application, univers }, { magasin, table })
//   observation : la ligne d'observation de possibilités concernée (lue par `id` et `possibilites`, comme la désignation l'exige) ;
//   application : { operation, liaisons: [{ entree, donnee }] } DÉJÀ sélectionnée par l'appelant. C'est une ENTRÉE : jamais cherchée,
//     jamais complétée, jamais comparée à d'autres, jamais remplacée ;
//   univers     : l'univers EXACT de cette observation, [{ donnee, porteur, acces }], tel que le rend l'observation au moment vécu (il retrouve
//     les porteurs et accès des identités de l'application) ;
//   magasin     : le magasin où écrire (désignation, exécution) ; table : la table d'invocation fermée à utiliser (l'appelant fournit celle du
//     dépôt) ; aucune table, aucun import des opérations ici.
//
// ORDRE OBLIGATOIRE (chaque étape attend la précédente) :
//   1. DÉSIGNATION    enregistrerDesignation({ observation, application, origine: 'exterieure' }) — l'unique autorité qui vérifie que
//                     l'application appartient aux possibilités de l'observation et qui écrit la ligne. Elle est écrite AVANT toute résolution
//                     ou invocation : elle représente le fait historique « cette application a été sollicitée », même si l'exécution échoue.
//   2. RÉSOLUTION     resoudreValeursApplication(application désignée, univers) — la primitive existante, jamais un second résolveur.
//   3. INVOCATION     invoquerOperation(table, operation, valeurs) — la primitive existante et la table fournie ; aucune sélection locale.
//   4. EXÉCUTION      enregistrerExecutionOperation({ designation, operation, liaisons, resultat }) — avec EXACTEMENT la ligne de désignation
//                     écrite à l'étape 1 ; operation et liaisons sont celles de cette ligne (l'application effectivement sollicitée) ; le
//                     résultat est celui de l'invocation, tel quel (jamais transformé).
// v0.63.40 — ÉTAPE 0, AVANT la désignation : CONFORMITÉ AU CATALOGUE. verifierApplicationAuCatalogue(application, descriptions) refuse (TypeError) une
//   application dont le mode de liaison ne correspond pas à celui que le catalogue déclare pour chaque entrée (ordinaire { entree, donnee } /
//   collective { entree, donnees }), une opération ou une entrée inconnue, une entrée manquante ou répétée. Refus = 'echec_designation' : aucune
//   écriture, rien de résolu ni d'invoqué. Le catalogue est `dependances.descriptions` (FACULTATIF) et vaut DESCRIPTIONS_OPERATIONS par défaut.
//   C'est l'UNIQUE chemin de production vers enregistrerDesignation (gardé par test) : aucune désignation ne naît sans cette confrontation.
// L'exécution porte ainsi idDesignation = désignation.id, et la désignation porte origine = 'exterieure' (jamais copiée dans l'exécution).
//
// ORIGINE : 'exterieure' est écrite ICI, en dur, parce que cette primitive SIGNIFIE « exécution sollicitée extérieurement ». Elle n'a aucun
// paramètre d'origine et ne représente aucun autre type de désignation. « exterieure » = extérieure au mécanisme autonome de Naissance ; cela
// ne dit ni QUI a sollicité, ni pourquoi, ni qu'une interface existe.
//
// AUCUN CHOIX : jamais de recherche d'application, de première application, de complétion, de comparaison de possibilités, de nouvel essai
// avec autre chose après un échec. Aucune politique, aucun score, aucun hasard. L'unicité d'un espace d'applications n'est jamais consultée.
//
// RETOUR (nouvel objet) : { statut, designation, execution, erreur }.
//   'executee'          : designation = la ligne écrite, execution = la ligne écrite, erreur = null.
//   'echec_designation' : la désignation a échoué (application étrangère à l'observation, entrée invalide, panne d'écriture) : RIEN n'a été
//                         résolu, invoqué ni écrit ; designation et execution = null ; erreur = l'erreur d'origine, telle quelle.
//   'echec_resolution'  : désignation ÉCRITE (conservée), résolution impossible ; aucune invocation ni exécution ; execution = null.
//   'echec_invocation'  : désignation ÉCRITE (conservée) ; l'invocation a refusé ou l'opération a levé ; aucune exécution ; execution = null.
//   'echec_execution'   : désignation ÉCRITE (conservée) ; le résultat n'a pas pu être enregistré (résultat non enregistrable ou panne
//                         d'écriture) ; aucune ligne d'exécution (les primitives existantes sont « tout ou rien ») ; execution = null.
// `erreur` est toujours l'objet d'erreur d'origine, jamais enveloppé ni traduit. Aucun retour en arrière : une désignation écrite n'est jamais
// supprimée. Aucune transaction globale n'est inventée : le journal reflète ce qui s'est réellement produit (une désignation peut exister sans
// exécution, c'est voulu). Des entrées de la primitive elle-même invalides (pas d'objet, champ manquant ou accesseur, magasin ou table absents)
// sont une erreur de programmation : TypeError AVANT tout effet.
//
// DORMANT : aucun mécanisme du dépôt n'appelle ni n'importe ce fichier. Elle ne lit aucun texte, n'active aucun observateur, n'étend aucun
// catalogue, ne persiste rien d'autre que les deux lignes des primitives qu'elle appelle.
import { enregistrerDesignation, enregistrerExecutionOperation, enregistrerContexteProspectif, enregistrerAttenteProspective, nouvelId } from './connaissances.js';
import { contextesProspectifs } from './contexte-prospectif.js';
import { attentesDuContexteProspectif } from './attentes-prospectives.js';
import { preparerSousDonnees } from './sous-donnees.js';
import { resoudreValeursApplication } from './valeurs-application.js';
import { invoquerOperation } from './invocation-operations.js';
import { verifierApplicationAuCatalogue } from './conformite-application.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';
// v0.63.83 — la chaîne prospective (.72 contextes, .74 attentes) lit les exécutions VÉCUES : réelles + synthétiques des réceptions déclarées
// (projection v0.63.82, recalculée, jamais persistée) et le catalogue enrichi des canaux. Lecture seule ; la conformité, la résolution,
// l'invocation et l'exécution lisent toujours le catalogue réel `descriptions` et rien d'autre.
import { lireExecutionsVecues } from './executions-vecues.js';

const ORIGINE_SOLLICITATION = 'exterieure';

function champ(objet, nom, intitule) {
  const propriete = Object.getOwnPropertyDescriptor(objet, nom);
  if (propriete === undefined) throw new TypeError(`executerApplicationSollicitee : ${intitule} n'a pas de champ « ${nom} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`executerApplicationSollicitee : ${intitule}.${nom} est un accesseur (une donnée est attendue).`);
  return propriete.value;
}

function objetSimple(valeur, intitule) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`executerApplicationSollicitee : ${intitule} doit être un objet.`);
}

// Clés CLOSES : un champ étranger (notamment une `origine`, que cette primitive ne reçoit jamais) est refusé AVANT tout effet, jamais ignoré.
function clesExactes(objet, autorisees, intitule) {
  for (const cle of Reflect.ownKeys(objet)) {
    if (typeof cle !== 'string' || !autorisees.includes(cle)) throw new TypeError(`executerApplicationSollicitee : ${intitule} contient un champ étranger.`);
  }
}

// v0.63.60 : le chemin normal est UNIQUE ; seule l'origine de la désignation diffère selon l'appelant (jamais déduite ici, jamais défaut).
// executerApplicationSollicitee = origine 'exterieure' (bouton développeur) ; execution-mecanique.js = origine 'mecanique'.
export async function executerApplicationSollicitee(entree, dependances) {
  return executerApplicationAvecOrigine(entree, dependances, ORIGINE_SOLLICITATION);
}

export async function executerApplicationAvecOrigine(entree, dependances, origine) {
  if (typeof origine !== 'string' || origine.length === 0) throw new TypeError('executerApplicationAvecOrigine : origine explicite requise.');
  objetSimple(entree, 'entree');
  objetSimple(dependances, 'dependances');
  clesExactes(entree, ['observation', 'application', 'univers'], 'entree');
  clesExactes(dependances, ['magasin', 'table', 'descriptions'], 'dependances');
  const observation = champ(entree, 'observation', 'entree');
  const application = champ(entree, 'application', 'entree');
  const univers = champ(entree, 'univers', 'entree');
  const magasin = champ(dependances, 'magasin', 'dependances');
  const table = champ(dependances, 'table', 'dependances');
  const descriptions = Object.hasOwn(dependances, 'descriptions') ? champ(dependances, 'descriptions', 'dependances') : DESCRIPTIONS_OPERATIONS;
  objetSimple(magasin, 'dependances.magasin');
  objetSimple(table, 'dependances.table');
  const resultat = (statut, designation, execution, erreur) => ({ statut, designation, execution, erreur });

  try {
    verifierApplicationAuCatalogue(application, descriptions);
  } catch (erreur) {
    return resultat('echec_designation', null, null, erreur);
  }
  let designation;
  try {
    designation = await enregistrerDesignation(magasin, { observation, application, origine });
  } catch (erreur) {
    return resultat('echec_designation', null, null, erreur);
  }
  // v0.63.72 — CONTEXTES PROSPECTIFS : la désignation est écrite (le cas concret existe : cette application, dans cette observation), et AVANT
  // toute résolution, invocation ou exécution, on fige ce que le passé rend observable des épisodes que cette application pourrait produire
  // (un contexte par projection ; calcul pur contextesProspectifs sur l'état actuel du magasin ; écriture ancrée sur la désignation et refusée
  // par enregistrerContexteProspectif si une exécution de cette désignation existait déjà). Aucune lecture du résultat, aucune influence sur
  // la résolution, l'invocation, l'exécution ni le résultat : le flux ci-dessous est strictement inchangé.
  // Si le passé n'est pas RÉSOLUBLE par les vues (identité d'une liaison inconnue du magasin, ligne hors contrat…), aucun contexte n'est
  // calculé ni écrit : l'absence de ligne signifie « calcul non effectué » (distinct de « jamais vécue » = ligne à témoins vides) ; l'exécution
  // suit son cours inchangé. Une panne d'ÉCRITURE, elle, se propage (comme pour toute autre table).
  let contextes = [];
  let vecu = null;
  try {
    vecu = await lireExecutionsVecues(magasin, descriptions);
    contextes = contextesProspectifs(application, vecu.valeurs, vecu.executions, vecu.descriptions);
  } catch (erreur) {
    if (!(erreur instanceof TypeError)) throw erreur;
    contextes = [];
  }
  const lignesContextes = [];
  for (const contexte of contextes) lignesContextes.push(await enregistrerContexteProspectif(magasin, { designation, contexte }));
  // v0.63.74 — ATTENTES PROSPECTIVES : pour chaque contexte qui vient d'être écrit, et TOUJOURS avant la résolution/invocation, on forme les
  // attentes A = B (calcul pur attentesDuContexteProspectif : A = constat historique du contexte courant, B = constat réel universel des issues
  // passées de même { structure, chemin }) à partir des contextes antérieurs et des exécutions existantes — l'issue courante n'existe pas.
  // Écriture ancrée sur la désignation et le contexte, refusée si l'exécution existait déjà. Aucune influence sur ce qui suit.
  if (lignesContextes.length > 0) {
    const anterieurs = await magasin.lireTout('contextesProspectifs');
    // v0.63.83 : même vécu (réel + synthétique) que pour les contextes, lu une seule fois ci-dessus.
    const valeursAvant = vecu.valeurs;
    const executionsAvant = vecu.executions;
    for (const contexte of lignesContextes) {
      let attentes = [];
      try {
        attentes = attentesDuContexteProspectif(contexte, designation, anterieurs, valeursAvant, executionsAvant, vecu.descriptions);
      } catch (erreur) {
        if (!(erreur instanceof TypeError)) throw erreur;
        attentes = [];
      }
      for (const attente of attentes) await enregistrerAttenteProspective(magasin, { designation, contexte, attente });
    }
  }
  let valeurs;
  try {
    valeurs = resoudreValeursApplication({ operation: designation.operation, liaisons: designation.liaisons }, univers);
  } catch (erreur) {
    return resultat('echec_resolution', designation, null, erreur);
  }
  let produit;
  try {
    produit = invoquerOperation(table, valeurs.operation, valeurs.valeurs);
  } catch (erreur) {
    return resultat('echec_invocation', designation, null, erreur);
  }
  try {
    // v0.63.46 — SOUS-DONNÉES (α2-ligne) : l'appelant, qui possède le descripteur ET la valeur réelle, calcule les champs obligatoires nommés
    // exposables de la sortie, VALIDE leurs sous-valeurs réelles et crée leurs identités UNE FOIS, juste avant l'écriture. Un seul écart :
    // exécution refusée ('echec_execution', aucune ligne, désignation conservée) ; aucune sous-donnée partielle.
    const sousDonnees = preparerSousDonnees(descriptions, designation.operation, produit, nouvelId);
    const entreeExecution = { designation, operation: designation.operation, liaisons: designation.liaisons, resultat: produit };
    if (sousDonnees !== undefined) entreeExecution.sousDonnees = sousDonnees;
    const execution = await enregistrerExecutionOperation(magasin, entreeExecution);
    return resultat('executee', designation, execution, null);
  } catch (erreur) {
    return resultat('echec_execution', designation, null, erreur);
  }
}
// === FIN_LANGAGE_EXECUTION_SOLLICITEE ===
