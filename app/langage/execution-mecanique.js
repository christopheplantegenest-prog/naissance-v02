// === DEBUT_LANGAGE_EXECUTION_MECANIQUE ===
// v0.63.60 — DÉCLENCHEUR MÉCANIQUE : exécuter les applications qui ne comportent AUCUN choix (décision ChatGPT, 06/10/2026).
//
// executerApplicationsDeterminees({ observation, univers }, { magasin, table, descriptions? }) -> { applications, choixAFaire, resultats }
//   SOURCE UNIQUE : le résultat réel de applicationsSollicitables(observation, descriptions) ; aucune seconde définition de « unique ».
//   `applications` (toutes déterminées, aucune sélection par nom, message, type, forme, récence, provenance, valeur, texte ni pertinence)
//   sont exécutées UNE FOIS CHACUNE, séquentiellement, dans l'ordre mécanique déjà fourni par groupesDeCandidats (tri canonique par nom
//   d'opération, un groupe par opération : une opération ne peut donc apparaître qu'une fois dans un lot). Aucun ordre de préférence.
//   `choixAFaire` : restent INERTES (rien n'est désigné, rien n'est résolu).
//   CHEMIN : exactement celui du bouton développeur (executerApplicationAvecOrigine : conformité → désignation → résolution → invocation →
//   exécution), seule l'origine de la désignation diffère : 'mecanique'.
//   UN LOT PAR OBSERVATION : aucune relecture, aucune nouvelle observation, aucune boucle ; les productions sont observables au tour suivant.
//   ÉCHEC : jamais masqué. Les exécutions sont indépendantes (aucune transaction globale) : si A réussit et B échoue, A reste écrite, B garde
//   son statut/erreur d'origine dans `resultats`, et les applications suivantes sont tout de même tentées (une seule tentative chacune).
//   `resultats` : [{ operation, statut, designation, execution, erreur }] dans l'ordre d'exécution.
import { applicationsSollicitables } from './applications-sollicitables.js';
import { executerApplicationAvecOrigine } from './execution-sollicitee.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';

const ORIGINE_MECANIQUE = 'mecanique';

export async function executerApplicationsDeterminees(entree, dependances) {
  if (entree === null || typeof entree !== 'object' || Array.isArray(entree)) throw new TypeError('executerApplicationsDeterminees : entree doit être un objet.');
  if (dependances === null || typeof dependances !== 'object' || Array.isArray(dependances)) throw new TypeError('executerApplicationsDeterminees : dependances doit être un objet.');
  const { observation, univers } = entree;
  const { magasin, table } = dependances;
  const descriptions = Object.hasOwn(dependances, 'descriptions') ? dependances.descriptions : DESCRIPTIONS_OPERATIONS;
  const { applications, choixAFaire } = applicationsSollicitables(observation, descriptions);
  const resultats = [];
  for (const application of applications) {
    const r = await executerApplicationAvecOrigine({ observation, application, univers }, { magasin, table, descriptions }, ORIGINE_MECANIQUE);
    resultats.push({ operation: application.operation, statut: r.statut, designation: r.designation, execution: r.execution, erreur: r.erreur });
  }
  return { applications, choixAFaire, resultats };
}
// === FIN_LANGAGE_EXECUTION_MECANIQUE ===
