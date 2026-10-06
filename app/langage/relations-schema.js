// === DEBUT_LANGAGE_RELATIONS_SCHEMA ===
// v0.63.61 — SCHÉMA DES RELATIONS ENTRE ENTRÉES (décision ChatGPT, 06/10/2026). DONNÉE PURE, SANS IMPORT, SANS FONCTION.
//
// Il dit seulement QUELLES relations un descripteur d'opération peut déclarer et quels RÔLES chacune exige :
//   couvertureDansChemins : { relation, couverture, collection }  — chaque chemin de la couverture est le `chemin` d'au moins un objet de la
//                           collection (égalité des chemins de la résolution de couverture : segment à segment, sans coercion).
//   plagesDansSequence    : { relation, plages, sequence }         — chaque plage tient dans la séquence : debut + longueur <= longueur(sequence).
// Chaque rôle désigne le NOM d'une entrée de l'opération qui déclare la relation. Deux rôles d'une même relation désignent deux entrées
// distinctes. Aucun langage d'expressions : deux relations seulement, correspondant aux deux contraintes démontrées du catalogue.
// L'IMPLÉMENTATION vit ailleurs (relations-entrees.js, registre mécanique) ; ce fichier ne contient aucune règle de validité.
export const SCHEMA_RELATIONS = Object.freeze({
  couvertureDansChemins: Object.freeze(['couverture', 'collection']),
  plagesDansSequence: Object.freeze(['plages', 'sequence']),
});
// === FIN_LANGAGE_RELATIONS_SCHEMA ===
