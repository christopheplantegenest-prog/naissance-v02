// === DEBUT_LANGAGE_DONNEE_DE_SOURCE ===
// v0.63.15 — ÉTAPE 6 : « DESCRIPTION DE LA SOURCE MESSAGE » (décision ChatGPT, 04/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « cette source identifiée, avec la forme que SON CONTRAT déclare, donne-t-elle une donnée { identite, forme } ? »
//
// C'est le pendant, pour une SOURCE (événement vécu), de ce que la vue des productions décrites fait pour une OPÉRATION (v0.63.12) :
// l'identité vient de l'objet identifié, la forme vient d'une DÉCLARATION, jamais du contenu.
//
// ENTRÉES : (source, descriptionSource).
//   source : objet portant SON PROPRE champ de donnée « id » (chaîne non vide, sans coercition, sans trim). Tous les autres champs
//     (notamment le contenu, `texte` pour un message) sont ignorés SANS ÊTRE LUS : ni leur présence, ni leur valeur, ni leur type,
//     et un accesseur de contenu n'est jamais exécuté. Un accesseur sur « id » est refusé SANS être exécuté. Ce module ne GÉNÈRE
//     aucune identité (celle du message naît en v0.63.14, dans le tour).
//   descriptionSource : objet portant SON PROPRE champ de donnée « forme » : une forme du langage de formes existant, à la racine
//     d'une sortie (aucun fait de champ à la racine). Aucune déclaration (absente, null, sans « forme ») = TypeError : AUCUN repli
//     implicite, aucune forme inventée. La forme est une DÉCLARATION, non une vérification : un contenu qui ne la respecterait pas
//     ne change rien, la source reste décrite par sa forme déclarée (confiance au contrat de source).
//
// SORTIE : { identite, forme } exactement. `forme` est une copie neuve, validée et indépendante de la déclaration, à chaque appel.
// Le langage de formes existant est le seul juge de la validité de la forme : aucune règle de forme n'est recopiée ici.
//
// Ce module ne connaît aucune source particulière (ni « message », ni aucun nom), ne garde aucune table, ne stocke rien, n'exécute
// rien, ne choisit rien, n'infère rien. INDÉPENDANCE : il n'importe que le langage de formes. NON BRANCHÉ : aucun mécanisme du
// dépôt n'importe ce fichier (gardé par un test statique).
import { validerDescripteurOperation } from './formes-operation.js';

function lireChampPropre(objet, champ, nom) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`${nom}.${champ} est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

function exigerObjet(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`${nom} doit être un objet.`);
}

export function donneeDeSource(source, descriptionSource) {
  exigerObjet(source, 'source');
  exigerObjet(descriptionSource, 'descriptionSource');
  const identite = lireChampPropre(source, 'id', 'source');
  if (typeof identite !== 'string' || identite.length === 0) throw new TypeError('source.id doit être une chaîne non vide.');
  const declaree = lireChampPropre(descriptionSource, 'forme', 'descriptionSource');
  let forme;
  try {
    forme = validerDescripteurOperation({ nom: 'source', entrees: {}, sortie: declaree }).sortie;
  } catch (erreur) {
    throw new TypeError(`descriptionSource.forme : ${erreur.message}`);
  }
  return { identite, forme };
}
// === FIN_LANGAGE_DONNEE_DE_SOURCE ===
