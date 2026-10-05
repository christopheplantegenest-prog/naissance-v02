// === DEBUT_LANGAGE_VALEUR_DONNEE ===
// v0.63.27 — ACCÈS MÉCANIQUE à la valeur d'une ligne de la table 'valeursDonnees' (« PERSISTER LA VALEUR DES DONNÉES ÉPHÉMÈRES »,
// 05/10/2026). Déclaration descriptive, comme l'accès déclaré de la source message : OÙ se trouve la valeur dans le porteur historique.
// La ligne { id, valeur } a pour `id` l'identité EXACTE de la donnée : elle sert donc directement de porteur à la primitive d'accès
// pure avec cette déclaration, sans adaptateur. Une seule constante, aucune fonction, aucun import, aucun registre global.
// NON BRANCHÉ : aucun mécanisme actif du dépôt n'importe ce fichier (gardé par un test statique).
export const ACCES_VALEUR_DONNEE = Object.freeze({ champ: 'valeur' });
// === FIN_LANGAGE_VALEUR_DONNEE ===
