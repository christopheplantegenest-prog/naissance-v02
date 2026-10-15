// === DEBUT_LANGAGE_ACTES_PEDAGOGIQUES ===
// v0.64.20 — « APPRENDRE LA FORME D'UNE CORRECTION NATURELLE » (GO ChatGPT « v0.64.20 », 15/10/2026).
// ACTES PÉDAGOGIQUES : ce qu'un message de Christophe peut ACCOMPLIR dans une situation d'enseignement, par opposition aux CAPACITÉS du registre
// (registre.js), qui sont des opérations du moteur invocables sur ses connaissances. Un acte pédagogique n'est JAMAIS invoqué par une Action, ni
// par le rejeu, ni par une composition : il n'existe que comme CIBLE EXPLICABLE (« ce message, dans cette situation, voulait dire : … ») et comme
// effet proposé puis confirmé. Registre fermé, gelé, sans import.
//   roles     : noms des valeurs que l'acte attend (positions d'une forme apprise) ;
//   situation : la seule situation où une forme de cet acte peut être reconnue ;
//   produit   : (valeurs) -> le résultat pédagogique exprimé (comparé au résultat supervisé lors de l'induction) ;
//   sens      : (lettres) -> phrase humaine pour la proposition de forme.
// reponseAttendue : « la réponse attendue à la question ayant produit la réponse corrigée était <reponse> » ; situation : RÉACTION (Répondre)
// à une réponse locale de Naissance identifiable par sa trace.
export const ACTES_PEDAGOGIQUES = Object.freeze({
  reponseAttendue: Object.freeze({
    roles: Object.freeze(['reponse']),
    situation: 'reaction-a-une-reponse',
    produit: ({ reponse } = {}) => reponse,
    sens: ({ reponse }) => `indiquant que la réponse attendue était ${reponse}`,
  }),
});
// === FIN_LANGAGE_ACTES_PEDAGOGIQUES ===
