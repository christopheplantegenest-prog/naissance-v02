// === DEBUT_LANGAGE_SOURCE_SOI ===
// v0.63.84 — DÉCLARATION DESCRIPTIVE de la source SOI (décision ChatGPT « SONDE 1 VALIDÉE — INTÉGRATION DE B1 », 10/10/2026).
// Deuxième source de données que connaît Naissance, à côté du MESSAGE (sa déclaration de source, v0.63.15) : l'ÉTAT PROPRE de Naissance (sa
// capacité d'agir, B1), une donnée qui n'est ni un message venu du monde ni une production d'une opération du catalogue.
// Le CONTRAT de cette source : son contenu (`valeur`) est un NOMBRE. C'est une déclaration, pas une vérification : elle ne dépend d'aucune
// valeur, ne contient ni fonction, ni branchement, ni traitement, ni choix. Même langage de formes que la source message ; aucun catalogue de
// sources (deux constantes, dans deux fichiers, et rien d'autre).
// `acces` déclare OÙ se trouve la valeur dans le porteur : le champ « valeur », c'est-à-dire le MÊME accès que les lignes de valeursDonnees
// (l'accès mécanique déclaré en v0.63.27) : une ligne d'état de soi est une ligne { id, valeur } qui porte EN PLUS sa déclaration de source (champ `source`,
// voir resoudre-identites.js) — c'est ce champ, et lui seul, qui dit au moteur « ceci n'est pas un message ».
// Les lignes d'état de soi n'existent que PROJETÉES (projection-soi.js), jamais dans la table valeursDonnees (qui ne contient que des messages).
// À utiliser avec donneeDeSource(ligne, DESCRIPTION_SOURCE_SOI).
export const DESCRIPTION_SOURCE_SOI = Object.freeze({
  forme: Object.freeze({ forme: 'scalaire', genre: 'nombre' }),
  acces: Object.freeze({ champ: 'valeur' }),
});
// === FIN_LANGAGE_SOURCE_SOI ===
