// === DEBUT_LANGAGE_VALEURS_APPLICATION ===
// v0.63.26 — « RÉSOUDRE LES VALEURS D'UNE APPLICATION » (décision ChatGPT, 05/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « une application DÉJÀ déterminée { operation, liaisons: [{ entree, donnee }] } et l'univers local observé au même moment
//     [{ donnee, porteur, acces }] : quelles sont, entrée par entrée, les valeurs que cette application désigne ? »
//
// SORTIE : un NOUVEL objet { operation, valeurs } où `valeurs` porte exactement une propriété PROPRE DE DONNÉE par entrée de
// l'application (posée par defineProperty : « __proto__ », « constructor »… sont de simples noms d'entrée, le prototype n'est
// jamais modifié), prête à être donnée telle quelle à l'invocation d'une opération. Construite par noms d'entrée canoniques
// (reproductibilité) ; cet ordre n'a aucun sens et n'est jamais une préférence. Chaque valeur est EXACTEMENT ce que rend
// valeurDePorteur (même référence, aucune copie ni transformation) ; une valeur undefined rendue est PRÉSENTE (≠ donnée absente).
//
// NE CHOISIT RIEN : ni application (elle ne reçoit qu'une application précise, ne connaît aucun état unique/plusieurs et ne vérifie
// jamais l'unicité de l'espace), ni donnée. N'INVOQUE RIEN, ne persiste rien, ne connaît ni catalogue, ni table d'opérations, ni
// magasin, ni désignation, ni exécution. N'INTERPRÈTE PAS `forme`. La lecture d'une valeur est déléguée ENTIÈREMENT au mécanisme
// existant valeurDePorteur(porteur, donnee, acces) : son contrat (identité porteur ↔ donnée, champ propre de donnée, accès valide)
// s'applique et ses erreurs se propagent telles quelles.
//
// APPLICATION : exactement { operation, liaisons } ; operation chaîne non vide ; liaisons tableau dense ≥ 1 ; chaque liaison
// exactement { entree, donnee }, chaînes non vides ; entrée unique (TypeError sinon) ; la même donnée peut servir plusieurs
// entrées (même valeur, même référence). L'ordre reçu n'a aucun sens.
// UNIVERS : tableau dense ; chaque élément exactement { donnee, porteur, acces } en propriétés propres de donnée ; donnee porte une
// `identite` propre de donnée, chaîne non vide (rien d'autre n'est lu de la donnée ici) ; DÉCISION : les identités sont
// GLOBALEMENT UNIQUES dans l'univers (un univers représente des données identifiées ; une identité dupliquée est refusée même
// non utilisée : jamais premier ni dernier). Les porteurs et accès ne sont PAS inspectés ici.
// JOINTURE : uniquement liaison.donnee === element.donnee.identite, par un index LOCAL non persistant identité → élément (linéaire :
// O(univers + liaisons)). Ni index de tableau, ni ordre, ni forme, ni type de porteur, ni origine, ni horodatage.
// ORDRE DES OPÉRATIONS : (1) application validée, (2) univers validé, unicité globale, (3) présence de TOUTES les données demandées
// — le tout AVANT le premier appel à valeurDePorteur : un échec structurel ne provoque jamais de lecture partielle ; (4) lecture
// des seules données demandées (les porteurs non utilisés ne sont jamais lus). Donnée demandée absente : TypeError, aucune sortie
// partielle. Aucune entrée n'est modifiée. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier.
import { valeurDePorteur } from './acces-valeur.js';

const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) throw new TypeError(`${nom}[${rang}] est absent (tableau creux).`);
  if (!('value' in place)) throw new TypeError(`${nom}[${rang}] est un accesseur : une donnée est attendue.`);
  return place.value;
}

function lireObjetExact(valeur, cles, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`${nom} doit être un objet { ${cles.join(', ')} }.`);
  for (const cle of Reflect.ownKeys(valeur)) {
    if (!cles.includes(cle)) throw new TypeError(`${nom} contient un champ étranger.`);
  }
  const lu = {};
  for (const cle of cles) lu[cle] = lireChamp(valeur, cle, nom);
  return lu;
}

function lireChamp(objet, champ, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) throw new TypeError(`${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in place)) throw new TypeError(`${nom}.${champ} est un accesseur : une donnée est attendue.`);
  return place.value;
}

function exigerChaine(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) throw new TypeError(`${nom} doit être une chaîne non vide.`);
}

export function resoudreValeursApplication(application, univers) {
  const { operation, liaisons: brutes } = lireObjetExact(application, ['operation', 'liaisons'], 'application');
  exigerChaine(operation, 'application.operation');
  if (!Array.isArray(brutes) || brutes.length === 0) throw new TypeError('application.liaisons doit être un tableau non vide.');
  const noms = new Set();
  const liaisons = [];
  for (let rang = 0; rang < brutes.length; rang += 1) {
    const liaison = lireObjetExact(lireRang(brutes, rang, 'application.liaisons'), ['entree', 'donnee'], `application.liaisons[${rang}]`);
    exigerChaine(liaison.entree, `application.liaisons[${rang}].entree`);
    exigerChaine(liaison.donnee, `application.liaisons[${rang}].donnee`);
    if (noms.has(liaison.entree)) throw new TypeError(`application.liaisons[${rang}] répète une entrée déjà présente.`);
    noms.add(liaison.entree);
    liaisons.push({ entree: liaison.entree, donnee: liaison.donnee });
  }
  liaisons.sort((a, b) => comparer(a.entree, b.entree));

  if (!Array.isArray(univers)) throw new TypeError('univers doit être un tableau d\'éléments { donnee, porteur, acces }.');
  const index = new Map();
  for (let rang = 0; rang < univers.length; rang += 1) {
    const element = lireObjetExact(lireRang(univers, rang, 'univers'), ['donnee', 'porteur', 'acces'], `univers[${rang}]`);
    if (element.donnee === null || typeof element.donnee !== 'object' || Array.isArray(element.donnee)) throw new TypeError(`univers[${rang}].donnee doit être un objet.`);
    const identite = lireChamp(element.donnee, 'identite', `univers[${rang}].donnee`);
    exigerChaine(identite, `univers[${rang}].donnee.identite`);
    if (index.has(identite)) throw new TypeError(`univers[${rang}] répète une identité déjà présente.`);
    index.set(identite, element);
  }

  const retenus = [];
  for (const liaison of liaisons) {
    const element = index.get(liaison.donnee);
    if (element === undefined) throw new TypeError(`la donnée demandée pour l'entrée « ${liaison.entree} » est absente de l'univers.`);
    retenus.push({ entree: liaison.entree, element });
  }

  const valeurs = {};
  for (const { entree, element } of retenus) {
    const valeur = valeurDePorteur(element.porteur, element.donnee, element.acces);
    Object.defineProperty(valeurs, entree, { value: valeur, enumerable: true, writable: true, configurable: true });
  }
  return { operation, valeurs };
}
// === FIN_LANGAGE_VALEURS_APPLICATION ===
