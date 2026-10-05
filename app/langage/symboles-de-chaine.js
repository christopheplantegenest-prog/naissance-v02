// === DEBUT_LANGAGE_SYMBOLES_DE_CHAINE ===
// v0.63.37 — brique « symbolesDeChaine » (décision de l'architecte). PRIMITIVE PURE, DORMANTE.
// Représentation minimale des symboles d'une chaîne : un élément par point de code Unicode, chacun sous forme de chaîne.
// Aucune normalisation, aucune tokenisation, aucune connaissance linguistique. Les substituts isolés sont conservés tels quels,
// un caractère hors plan de base est UN seul élément, les suites combinantes ne sont pas fusionnées.
// Une entrée qui n'est pas une chaîne est refusée par un TypeError : aucune coercition.
// NON BRANCHÉ : aucun fichier de app/ n'importe ce module (gardé par un test statique).
export function symbolesDeChaine(chaine) {
  if (typeof chaine !== 'string') throw new TypeError(`symbolesDeChaine : une chaîne est attendue (reçu : ${chaine === null ? 'null' : typeof chaine}).`);
  return Array.from(chaine);
}
// === FIN_LANGAGE_SYMBOLES_DE_CHAINE ===
