// === DEBUT_LANGAGE_POSSIBILITES_LIAISON ===
// v0.63.13 — ÉTAPE 6 : « POSSIBILITÉS ATOMIQUES DE LIAISON » (décision ChatGPT, 04/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « quelles paires (donnée, entrée d'opération) ont une forme de donnée qui garantit la forme attendue par l'entrée ? »
//
// Une possibilité signifie UNIQUEMENT : « la forme de cette donnée garantit la forme attendue par cette entrée ». Elle ne dit
// pas que l'opération doit être choisie, qu'elle est pertinente, qu'elle réussira, qu'elle doit être exécutée, ni que les autres
// entrées de la même opération sont satisfaites. Aucun score, aucun choix, aucune exécution.
//
// ENTRÉES : (productions, descriptions), deux tableaux DENSES.
//   productions : objets portant chacun SES PROPRES champs de donnée « identite » (chaîne non vide) et « forme » (une forme du langage
//     de formes, à la racine d'une sortie : aucun fait de champ à la racine). Tous les autres champs sont ignorés sans être lus ;
//     un accesseur (sur un rang ou sur ces deux champs) est refusé SANS être exécuté. Aucune valeur n'est reçue ni lue.
//     Deux productions de même identité sont une ambiguïté : TypeError, jamais fusionnées.
//   descriptions : descripteurs { nom, entrees, sortie } validés UN PAR UN par le langage de formes existant. Deux descriptions de
//     même nom sont une ambiguïté : TypeError, jamais un choix silencieux.
//
// COMPATIBILITÉ : pour chaque production P, chaque description O, chaque entrée E de O (nom d'entrée = clé de `entrees`), l'atome
// existe si et seulement si la relation de garantie du langage de formes dit vrai de la forme de P face au champ E. Cette relation
// n'est PAS recopiée ici : elle est appelée telle quelle, sur des copies validées. Elle ne voit jamais le nom d'une opération,
// d'une entrée ni l'identité d'une donnée. Toute entrée invalide lève un TypeError ; elle n'est jamais transformée en « incompatible ».
//
// ATOME : { donnee, operation, entree } exactement, trois chaînes : l'identité de la production, le nom de la description, le nom de
// l'entrée. Une possibilité est ATOMIQUE : jamais de liste de liaisons, jamais d'application complète ou partielle, jamais de
// combinaison entre entrées, jamais de produit cartésien. Une même donnée peut être candidate à plusieurs entrées de la même
// opération (autant d'atomes), plusieurs données peuvent l'être à la même entrée (autant d'atomes) : aucune unicité n'est imposée.
// Une opération sans entrée ne produit aucun atome. Aucun filtre « sensé » : une possibilité absurde reste une possibilité.
//
// SORTIE : un NOUVEAU tableau d'atomes, tous distincts. Ordre = ordre croissant de (operation, entree, donnee), comparaison par
// unités de code, SANS signification : l'ordre brut des entrées n'a aucune influence.
// COÛT : au plus (nombre de productions) × (nombre total d'entrées) appels à la relation de garantie, et autant d'atomes au maximum.
// Cette borne n'est pas corrigée ici.
//
// Ce module ne connaît aucun nom d'opération, ne lit aucune mémoire persistée, ne garde aucune table globale, ne stocke rien,
// n'exécute rien et ne choisit rien. INDÉPENDANCE : il n'importe que le langage de formes et sa relation de garantie. NON BRANCHÉ :
// aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique).
import { validerDescripteurOperation } from './formes-operation.js';
import { fournieGarantitAttendue } from './garantie-forme.js';

function lireRang(tableau, rang, nomTableau) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) throw new TypeError(`${nomTableau}[${rang}] est absent (tableau creux).`);
  if (!('value' in place)) throw new TypeError(`${nomTableau}[${rang}] est un accesseur : une donnée est attendue.`);
  return place.value;
}

function lireChampPropre(objet, champ, rang) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`productions[${rang}] n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`productions[${rang}].${champ} est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function possibilitesDeLiaison(productions, descriptions) {
  if (!Array.isArray(productions)) throw new TypeError('productions doit être un tableau d\'objets portant « identite » et « forme ».');
  if (!Array.isArray(descriptions)) throw new TypeError('descriptions doit être un tableau de descripteurs d\'opération.');

  const noms = new Set();
  const operations = [];
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    let validee;
    try {
      validee = validerDescripteurOperation(lireRang(descriptions, rang, 'descriptions'));
    } catch (erreur) {
      throw new TypeError(`descriptions[${rang}] : ${erreur.message}`);
    }
    if (noms.has(validee.nom)) throw new TypeError(`descriptions : deux descriptions portent le même nom (rang ${rang}).`);
    noms.add(validee.nom);
    operations.push(validee);
  }

  const identites = new Set();
  const donnees = [];
  for (let rang = 0; rang < productions.length; rang += 1) {
    const production = lireRang(productions, rang, 'productions');
    if (production === null || typeof production !== 'object' || Array.isArray(production)) {
      throw new TypeError(`productions[${rang}] doit être un objet portant « identite » et « forme ».`);
    }
    const identite = lireChampPropre(production, 'identite', rang);
    const forme = lireChampPropre(production, 'forme', rang);
    if (typeof identite !== 'string' || identite.length === 0) throw new TypeError(`productions[${rang}].identite doit être une chaîne non vide.`);
    if (identites.has(identite)) throw new TypeError(`productions : deux productions portent la même identité (rang ${rang}).`);
    identites.add(identite);
    let validee;
    try {
      validee = validerDescripteurOperation({ nom: 'production', entrees: {}, sortie: forme }).sortie;
    } catch (erreur) {
      throw new TypeError(`productions[${rang}].forme : ${erreur.message}`);
    }
    donnees.push({ identite, forme: validee });
  }

  const atomes = [];
  for (const operation of operations) {
    for (const entree of Object.keys(operation.entrees)) {
      for (const donnee of donnees) {
        const attendue = operation.entrees[entree];
        // v0.63.39 : entrée collective -> la donnée est comparée à la forme de `valeur` (même relation de garantie, même atome).
        const cible = attendue.collectif === true ? attendue.elements.champs.valeur : attendue;
        if (fournieGarantitAttendue(donnee.forme, cible)) {
          atomes.push({ donnee: donnee.identite, operation: operation.nom, entree });
        }
      }
    }
  }
  return atomes.sort((a, b) => comparer(a.operation, b.operation) || comparer(a.entree, b.entree) || comparer(a.donnee, b.donnee));
}
// === FIN_LANGAGE_POSSIBILITES_LIAISON ===
