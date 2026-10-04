// === DEBUT_LANGAGE_SOURCE_MESSAGE ===
// v0.63.15 — DÉCLARATION DESCRIPTIVE de la source MESSAGE (message humain entrant, identifié en v0.63.14 par identifierMessage).
// Le CONTRAT de cette source : son contenu (`texte`) est une chaîne. C'est une déclaration, pas une vérification : elle ne dépend
// d'aucune valeur, ne contient ni fonction, ni branchement, ni traitement, ni choix. Une seule constante, pas de catalogue de sources.
// Elle vit hors de l'interface et hors du tour (aucune importation). NON BRANCHÉE : aucun mécanisme du dépôt n'importe ce fichier
// (gardé par un test statique). À utiliser avec donneeDeSource(message, DESCRIPTION_SOURCE_MESSAGE).
export const DESCRIPTION_SOURCE_MESSAGE = Object.freeze({
  forme: Object.freeze({ forme: 'scalaire', genre: 'chaine' }),
});
// === FIN_LANGAGE_SOURCE_MESSAGE ===
