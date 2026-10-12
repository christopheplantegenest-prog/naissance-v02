// === DEBUT_LANGAGE_EXECUTION_MECANIQUE ===
// v0.63.60 — DÉCLENCHEUR MÉCANIQUE : exécuter les applications qui ne comportent AUCUN choix (décision ChatGPT, 06/10/2026).
//
// executerApplicationsDeterminees({ observation, univers }, { magasin, table, descriptions? }) -> { applications, choixAFaire, resultats }
//   SOURCE UNIQUE : le résultat réel de applicationsSollicitables(observation, descriptions, univers) (v0.63.61 : classification relationnelle, une application
//   n'est exécutée que si elle a EXACTEMENT UNE combinaison relationnellement valide) ; aucune seconde définition de « unique ».
//   `applications` (toutes déterminées, aucune sélection par nom, message, type, forme, récence, provenance, valeur, texte ni pertinence)
//   sont exécutées UNE FOIS CHACUNE (v0.63.93 : les applications déterminées NOUVELLES — DT6, voir plus bas), séquentiellement, dans l'ordre mécanique déjà fourni par groupesDeCandidats (tri canonique par nom
//   d'opération, un groupe par opération : une opération ne peut donc apparaître qu'une fois dans un lot). Aucun ordre de préférence.
//   `choixAFaire` : restent INERTES (rien n'est désigné, rien n'est résolu).
//   CHEMIN : exactement celui du bouton développeur (executerApplicationAvecOrigine : conformité → désignation → résolution → invocation →
//   exécution), seule l'origine de la désignation diffère : 'mecanique'.
//   UN LOT PAR OBSERVATION : aucune relecture, aucune nouvelle observation, aucune boucle ; les productions sont observables au tour suivant.
//   ÉCHEC : jamais masqué. Les exécutions sont indépendantes (aucune transaction globale) : si A réussit et B échoue, A reste écrite, B garde
//   son statut/erreur d'origine dans `resultats`, et les applications suivantes sont tout de même tentées (une seule tentative chacune).
//   `resultats` : [{ operation, statut, designation, execution, erreur }] dans l'ordre d'exécution (v0.63.93 : NOUVELLES applications seulement).
//   `dejaExecutees` (v0.63.93) : [{ operation, liaisons }] les applications déterminées déjà exécutées, non relancées.
// v0.63.93 — DT6 (décision ChatGPT « DÉCISION DT6 — PASSAGE AU CODE », 12/10/2026) : la réexécution par le LOT d'une application STRICTE déjà exécutée
//   n'est PAS un nouvel acte propre (opérations pures : même application → même résultat ; elle fait déjà partie du vécu). AVANT d'exécuter une
//   application déterminée, sa clé stricte (cleApplication, définition .91 de besoins.js, réutilisée telle quelle : même operation, mêmes liaisons
//   dans leur ordre persisté, même donnee / même suite exacte de donnees) est comparée aux clés des exécutions DÉJÀ persistées (vécu antérieur, tel que l'univers de l'observation le porte) :
//   déjà exécutée → NON relancée, rendue dans `dejaExecutees` (fait, sans résultat ni statut) ; nouvelle → chemin .60 inchangé. Rien n'est retiré de
//   l'observation ni transformé en choix ; les « choix à faire » restent inertes. Seules les NOUVELLES exécutions sont dans `resultats` : l'émission
//   (emettreLot) et le coût du tour (tourActif, main.js : ≥ 1 exécution) ne portent donc que sur elles. La sollicitation EXTÉRIEURE (bouton Exécuter,
//   .77) n'est PAS concernée : elle peut toujours exécuter de nouveau une application connue.
import { applicationsSollicitables } from './applications-sollicitables.js';
import { cleApplication } from './besoins.js';
import { executerApplicationAvecOrigine } from './execution-sollicitee.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';

const ORIGINE_MECANIQUE = 'mecanique';

export async function executerApplicationsDeterminees(entree, dependances) {
  if (entree === null || typeof entree !== 'object' || Array.isArray(entree)) throw new TypeError('executerApplicationsDeterminees : entree doit être un objet.');
  if (dependances === null || typeof dependances !== 'object' || Array.isArray(dependances)) throw new TypeError('executerApplicationsDeterminees : dependances doit être un objet.');
  const { observation, univers } = entree;
  const { magasin, table } = dependances;
  const descriptions = Object.hasOwn(dependances, 'descriptions') ? dependances.descriptions : DESCRIPTIONS_OPERATIONS;
  const { applications, choixAFaire } = applicationsSollicitables(observation, descriptions, univers);
  // v0.63.93 — DT6 : les clés strictes des applications DÉJÀ exécutées, lues dans l'UNIVERS de cette observation (aucune lecture de plus) : chaque
  // production du vécu y a pour porteur SA LIGNE d'exécution persistée ({ operation, liaisons, … } : observation-possibilites.js) ; un porteur de
  // message ou de sous-donnée n'a pas d'opération et ne compte pas.
  const connues = new Set();
  for (const u of Array.isArray(univers) ? univers : []) {
    if (u && u.porteur && typeof u.porteur.operation === 'string' && Array.isArray(u.porteur.liaisons)) connues.add(cleApplication(u.porteur));
  }
  const resultats = [];
  const dejaExecutees = [];
  for (const application of applications) {
    if (connues.has(cleApplication(application))) { dejaExecutees.push({ operation: application.operation, liaisons: application.liaisons }); continue; }
    const r = await executerApplicationAvecOrigine({ observation, application, univers }, { magasin, table, descriptions }, ORIGINE_MECANIQUE);
    resultats.push({ operation: application.operation, statut: r.statut, designation: r.designation, execution: r.execution, erreur: r.erreur });
  }
  return { applications, choixAFaire, resultats, dejaExecutees };
}
// === FIN_LANGAGE_EXECUTION_MECANIQUE ===
