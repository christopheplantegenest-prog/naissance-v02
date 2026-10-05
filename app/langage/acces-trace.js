// === DEBUT_LANGAGE_ACCES_TRACE ===
// v0.63.17 — DÉCLARATION D'ACCÈS du porteur TRACE : la valeur produite par une opération se trouve dans le champ `resultat` de la
// trace (copie JSON, format existant des traces). Constante unique : valable pour TOUTES les traces, donc NON recopiée dans les
// descriptions d'opérations (qui ne décrivent que des formes). Descriptive : aucune fonction, aucune importation (ni catalogue,
// ni vue des productions). DORMANTE : non branchée à la vue des productions ni à un exécuteur ; aucun mécanisme du dépôt
// n'importe ce fichier (gardé par un test statique). À utiliser avec valeurDePorteur(trace, donnee, ACCES_TRACE).
export const ACCES_TRACE = Object.freeze({ champ: 'resultat' });
// === FIN_LANGAGE_ACCES_TRACE ===
