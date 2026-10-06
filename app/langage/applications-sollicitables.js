// === DEBUT_LANGAGE_APPLICATIONS_SOLLICITABLES ===
// v0.63.35 — « PREMIÈRE SOLLICITATION EXTÉRIEURE RÉELLE DEPUIS L'INTERFACE » (décision ChatGPT, 05/10/2026). OUTIL DE DÉVELOPPEMENT.
// FONCTION PURE : qu'est-ce qui peut être PRÉSENTÉ à Christophe comme application directement exécutable, sans aucun choix de plus ?
//
// applicationsSollicitables(observation, descriptions = DESCRIPTIONS_OPERATIONS, univers) -> { applications, choixAFaire }
//   observation  : la ligne d'observation de possibilités d'UN tour (champ propre `possibilites`, tableau d'atomes { donnee, operation, entree }).
//   descriptions : le catalogue présenté à groupesDeCandidats (par défaut celui de l'observation active).
//   univers      : (v0.63.61) l'univers RÉEL du même tour, [{ donnee, porteur, acces }], tel que rendu par observerPossibilites.
//                  Il n'est exigé (TypeError s'il manque) que pour une opération qui DÉCLARE des relations entre entrées (clé `relations` du descripteur) ; il
//                  est passé en TROISIÈME position pour ne pas casser les appels existants (observation, descriptions), mais il n'est jamais optionnel quand
//                  une relation doit être jugée : jamais de repli silencieux vers l'ancien comportement.
// v0.63.61 — RELATIONS ENTRE ENTRÉES : pour une opération qui déclare des relations, la classification ne se fait plus sur la seule compatibilité de FORME par
//   entrée. Les COMBINAISONS (produit cartésien des candidats des entrées ordinaires ; une entrée collective prend toujours son ensemble complet, comme avant)
//   sont construites, leurs VALEURS résolues depuis l'univers par resoudreValeursApplication (la primitive existante), puis TOUTES les relations déclarées
//   sont appliquées (registre relations-entrees.js, mêmes prédicats que les corps des opérations ; valeurs seulement, aucune provenance). Seules les
//   combinaisons valides sont conservées :
//     0 combinaison valide -> ni application, ni choix (rien à exécuter ni à choisir ; aucun état « inapplicable » n'est créé ni persisté) ;
//     1 combinaison valide -> application déterminée ;
//     plusieurs            -> choixAFaire (aucun choix n'est fait ; il ne contient que des combinaisons satisfaisant déjà les relations).
//   Les opérations SANS relation gardent EXACTEMENT la règle antérieure (chaque entrée collective ou à un seul candidat -> application, sinon choix).
//   classerCombinaisons(...) rend le détail { operation, brutes, valides } (valides = null pour une opération sans relation à plusieurs combinaisons).
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
import { validerDescripteurOperation } from './formes-operation.js';
import { resoudreValeursApplication } from './valeurs-application.js';
import { relationsSatisfaites } from './relations-entrees.js';

function relationsParOperation(descriptions) {
  const parOperation = new Map();
  for (const rang of descriptions.keys()) {
    const place = Object.getOwnPropertyDescriptor(descriptions, String(rang));
    const valide = validerDescripteurOperation(place.value);
    if (valide.relations !== undefined) parOperation.set(valide.nom, valide.relations);
  }
  return parOperation;
}

function combinaisons(entrees) {
  return entrees.reduce((resultat, entree) => {
    const choix = entree.collectif === true ? [{ entree: entree.entree, donnees: [...entree.donnees] }] : entree.donnees.map((donnee) => ({ entree: entree.entree, donnee }));
    const suite = [];
    for (const debut of resultat) for (const liaison of choix) suite.push([...debut, liaison]);
    return suite;
  }, [[]]);
}

export function classerCombinaisons(observation, descriptions = DESCRIPTIONS_OPERATIONS, univers) {
  if (observation === null || typeof observation !== 'object' || Array.isArray(observation)) throw new TypeError('applicationsSollicitables : observation doit être un objet.');
  const propriete = Object.getOwnPropertyDescriptor(observation, 'possibilites');
  if (propriete === undefined) throw new TypeError("applicationsSollicitables : l'observation n'a pas de champ « possibilites » propre.");
  if (!('value' in propriete)) throw new TypeError('applicationsSollicitables : observation.possibilites est un accesseur (une donnée est attendue).');
  const groupes = groupesDeCandidats(propriete.value, descriptions);
  const relations = relationsParOperation(descriptions);
  return groupes.map((groupe) => {
    const brutes = groupe.entrees.reduce((n, entree) => n * (entree.collectif === true ? 1 : entree.donnees.length), 1);
    const declarees = relations.get(groupe.operation);
    if (declarees === undefined) {
      return { operation: groupe.operation, brutes, valides: brutes === 1 ? combinaisons(groupe.entrees) : null };
    }
    if (!Array.isArray(univers)) throw new TypeError(`applicationsSollicitables : l'univers du tour est requis pour juger les relations de « ${groupe.operation} ».`);
    const valides = [];
    for (const liaisons of combinaisons(groupe.entrees)) {
      const { valeurs } = resoudreValeursApplication({ operation: groupe.operation, liaisons }, univers);
      if (relationsSatisfaites(declarees, valeurs)) valides.push(liaisons);
    }
    return { operation: groupe.operation, brutes, valides };
  });
}

export function applicationsSollicitables(observation, descriptions = DESCRIPTIONS_OPERATIONS, univers) {
  const applications = [];
  const choixAFaire = [];
  for (const classe of classerCombinaisons(observation, descriptions, univers)) {
    if (classe.valides === null) choixAFaire.push(classe.operation);
    else if (classe.valides.length === 1) { const [liaisons] = classe.valides; applications.push({ operation: classe.operation, liaisons }); }
    else if (classe.valides.length > 1) choixAFaire.push(classe.operation);
    // 0 combinaison valide : ni application ni choix.
  }
  return { applications, choixAFaire };
}
// === FIN_LANGAGE_APPLICATIONS_SOLLICITABLES ===
