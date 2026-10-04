// === DEBUT_LANGAGE_PRODUCTIONS_DECRITES ===
// v0.63.12 — ÉTAPE 6 : « VUE PURE DES PRODUCTIONS DÉCRITES » (décision ChatGPT, 04/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « quelles exécutions enregistrées ont une opération DÉCRITE, et quelle forme cette description leur donne-t-elle ? »
//
// MÉCANISME : une exécution enregistrée porte une identité (`id`) et le nom de ce qui a été exécuté (`capacite`). Une description
// porte un `nom` et une `sortie`. Si `capacite` est EXACTEMENT égal à `nom`, la production de cette exécution est
// { identite: id, forme: sortie }. La forme est HÉRITÉE de la description : elle n'est ni inférée, ni confirmée, ni rejetée, ni
// raffinée par ce qui a été produit. Le champ « resultat » d'une exécution n'est JAMAIS lu (pas même sa présence) : une production
// est décrite par sa PROVENANCE, jamais par son contenu. Une production dont le contenu ne respecterait pas la forme déclarée reste
// décrite par la forme déclarée ; la forme est une déclaration, non une vérification.
//
// ENTRÉES : (executions, descriptions), deux tableaux DENSES.
//   executions : objets portant chacun SES PROPRES champs de donnée « id » (chaîne non vide) et « capacite » (chaîne) ;
//     tous les autres champs sont ignorés sans être lus. Un accesseur (sur un rang ou sur ces deux champs) est refusé SANS être exécuté.
//     Les identités doivent être distinctes : l'identité d'une production est celle de son exécution, deux exécutions de même id
//     seraient indistinguables, ce n'est donc jamais fusionné (TypeError). Ce module ne suppose rien sur l'unicité des id
//     au-delà de CET ensemble d'exécutions.
//   descriptions : descripteurs { nom, entrees, sortie }, validés UN PAR UN par le langage de formes existant (aucune règle de forme
//     recopiée ici). Deux descriptions de même nom sont une ambiguïté : TypeError, jamais un choix silencieux (le contrat de
//     validation existant ne porte que sur UN descripteur ; l'unicité des noms n'y est pas définie).
//
// CORRESPONDANCE : égalité stricte de chaînes, sans normalisation, sans alias, sans préfixe, sans similarité, sans repli. Une
// exécution sans description correspondante n'a pas de production ; une description sans exécution n'en produit aucune.
// Toutes les exécutions et toutes les descriptions sont validées, correspondantes ou non.
//
// SORTIE : un NOUVEAU tableau de { identite, forme } exactement. `forme` est une copie neuve et indépendante de la sortie décrite
// (une copie PAR production, jamais partagée entre deux productions ni avec l'entrée). Ni nom d'opération, ni résultat, ni
// horodatage, ni entrée, ni lien vers une autre production. Ordre = ordre croissant des identités (comparaison par unités de code),
// SANS signification : l'ordre brut des exécutions n'a aucune influence.
//
// Ce module ne connaît aucun nom d'opération, ne lit aucune mémoire persistée, ne garde aucune table globale, ne stocke rien, n'exécute
// rien, ne choisit rien et ne produit aucune possibilité d'application.
// INDÉPENDANCE : il n'importe que le langage de formes. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier
// (gardé par un test statique).
import { validerDescripteurOperation } from './formes-operation.js';

function lireRang(tableau, rang, nomTableau) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) throw new TypeError(`${nomTableau}[${rang}] est absent (tableau creux).`);
  if (!('value' in place)) throw new TypeError(`${nomTableau}[${rang}] est un accesseur : une donnée est attendue.`);
  return place.value;
}

function lireChampPropre(objet, champ, rang) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`executions[${rang}] n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`executions[${rang}].${champ} est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

export function productionsDecrites(executions, descriptions) {
  if (!Array.isArray(executions)) throw new TypeError('executions doit être un tableau d\'objets portant « id » et « capacite ».');
  if (!Array.isArray(descriptions)) throw new TypeError('descriptions doit être un tableau de descripteurs d\'opération.');

  const parNom = new Map();
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    const brute = lireRang(descriptions, rang, 'descriptions');
    let validee;
    try {
      validee = validerDescripteurOperation(brute);
    } catch (erreur) {
      throw new TypeError(`descriptions[${rang}] : ${erreur.message}`);
    }
    if (parNom.has(validee.nom)) throw new TypeError(`descriptions : deux descriptions portent le même nom (rangs ${parNom.get(validee.nom).rang} et ${rang}).`);
    parNom.set(validee.nom, { rang, brute });
  }

  const identites = new Set();
  const productions = [];
  for (let rang = 0; rang < executions.length; rang += 1) {
    const execution = lireRang(executions, rang, 'executions');
    if (execution === null || typeof execution !== 'object' || Array.isArray(execution)) {
      throw new TypeError(`executions[${rang}] doit être un objet portant « id » et « capacite ».`);
    }
    const id = lireChampPropre(execution, 'id', rang);
    const capacite = lireChampPropre(execution, 'capacite', rang);
    if (typeof id !== 'string' || id.length === 0) throw new TypeError(`executions[${rang}].id doit être une chaîne non vide.`);
    if (typeof capacite !== 'string') throw new TypeError(`executions[${rang}].capacite doit être une chaîne.`);
    if (identites.has(id)) throw new TypeError(`executions : deux exécutions portent la même identité (rang ${rang}).`);
    identites.add(id);
    const description = parNom.get(capacite);
    if (description === undefined) continue;
    productions.push({ identite: id, forme: validerDescripteurOperation(description.brute).sortie });
  }
  return productions.sort((a, b) => (a.identite < b.identite ? -1 : a.identite > b.identite ? 1 : 0));
}
// === FIN_LANGAGE_PRODUCTIONS_DECRITES ===
