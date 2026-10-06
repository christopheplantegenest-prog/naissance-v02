// === DEBUT_LANGAGE_APPLICATIONS_SOLLICITABLES ===
// v0.63.35 — « PREMIÈRE SOLLICITATION EXTÉRIEURE RÉELLE DEPUIS L'INTERFACE » (décision ChatGPT, 05/10/2026). OUTIL DE DÉVELOPPEMENT.
// FONCTION PURE : qu'est-ce qui peut être PRÉSENTÉ à Christophe comme application directement exécutable, sans aucun choix de plus ?
//
// applicationsSollicitables(observation, descriptions = DESCRIPTIONS_OPERATIONS) -> { applications, choixAFaire }
//   observation  : la ligne d'observation de possibilités d'UN tour (champ propre `possibilites`, tableau d'atomes { donnee, operation, entree }).
//   descriptions : le catalogue présenté à groupesDeCandidats (par défaut celui de l'observation active).
//
// Elle n'utilise QUE groupesDeCandidats (représentation compacte de l'espace des applications). Pour chaque groupe (ordre CANONIQUE de
// groupesDeCandidats, jamais réordonné) :
//   - si CHAQUE entrée du groupe possède EXACTEMENT UN candidat (donnees.length === 1), l'application est entièrement DÉTERMINÉE par
//     l'observation : { operation, liaisons: [{ entree, donnee }] } est construite mécaniquement (une liaison par entrée, ordre des entrées
//     du groupe). C'est une constatation de détermination, pas une politique de sélection ;
//   - si AU MOINS UNE entrée a plusieurs candidats, le groupe représente un produit cartésien : il n'est PAS matérialisé, aucun candidat n'est
//     choisi ni présélectionné ; l'opération est seulement signalée dans `choixAFaire` (noms, même ordre canonique). Aucune application n'est
//     construite pour elle.
// TOUTES les applications déterminées sont rendues, sans préférence, sans filtre, sans score. Une opération incomplète est absente de
// groupesDeCandidats donc absente ici (rien n'est réinventé). Aucune lecture de valeur, de texte, de mémoire ; aucun état ; nouveaux objets à
// chaque appel ; l'entrée n'est jamais modifiée. Entrée invalide : TypeError (ou celle de groupesDeCandidats), jamais ignorée.
// NON ÉCRITE PAR NAISSANCE : elle ne désigne rien et n'exécute rien ; elle ne prétend qu'à dire ce que l'écran peut offrir sans choisir.
import { groupesDeCandidats } from './groupes-candidats.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';

export function applicationsSollicitables(observation, descriptions = DESCRIPTIONS_OPERATIONS) {
  if (observation === null || typeof observation !== 'object' || Array.isArray(observation)) throw new TypeError('applicationsSollicitables : observation doit être un objet.');
  const propriete = Object.getOwnPropertyDescriptor(observation, 'possibilites');
  if (propriete === undefined) throw new TypeError("applicationsSollicitables : l'observation n'a pas de champ « possibilites » propre.");
  if (!('value' in propriete)) throw new TypeError('applicationsSollicitables : observation.possibilites est un accesseur (une donnée est attendue).');
  const groupes = groupesDeCandidats(propriete.value, descriptions);
  const applications = [];
  const choixAFaire = [];
  for (const groupe of groupes) {
    // v0.63.39 : une entrée collective est toujours déterminée (elle prend l'ensemble complet : aucune alternative, aucun choix).
    if (groupe.entrees.every((entree) => entree.collectif === true || entree.donnees.length === 1)) {
      applications.push({ operation: groupe.operation, liaisons: groupe.entrees.map((entree) => {
        if (entree.collectif === true) return { entree: entree.entree, donnees: [...entree.donnees] };
        const [unique] = entree.donnees; return { entree: entree.entree, donnee: unique };
      }) });
    } else {
      choixAFaire.push(groupe.operation);
    }
  }
  return { applications, choixAFaire };
}
// === FIN_LANGAGE_APPLICATIONS_SOLLICITABLES ===
