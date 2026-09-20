// === DEBUT_LANGAGE_BAGAGE ===
// LE BAGAGE DE DÉPART de Naissance — volontairement PETIT (~60 entrées).
// Ce n'est pas son vocabulaire définitif : c'est le strict nécessaire pour qu'on puisse vérifier
// que ce qu'elle sait EN PLUS, plus tard, vient bien de l'apprentissage et pas d'ici.
// Tout ce fichier est lisible d'un coup d'œil : c'est voulu. Si elle répond juste à une question
// dont la réponse n'est pas préparée ici, c'est qu'elle a appris.
//
// Rien ici ne dépend de motsCles() (memoire/selection.js) : cette fonction jette les mots de moins
// de 4 lettres et les mots vides — donc « mon », « ton », « qui », « où », exactement ce qui porte
// la différence entre « ma couleur » et « ta couleur ». Le langage a son propre découpage (voir
// langage-comprendre.js).

// --- Les rôles qu'un mot peut jouer ------------------------------------------------------------
export const ROLES = Object.freeze({
  POSSESSIF_MOI: 'possessif_moi',       // mon, ma, mes  → le sujet est celui qui parle
  POSSESSIF_TOI: 'possessif_toi',       // ton, ta, tes  → le sujet est Naissance
  PRONOM_MOI: 'pronom_moi',             // je, j', moi, me
  PRONOM_TOI: 'pronom_toi',             // tu, te, toi
  INTERROGATIF: 'interrogatif',         // comment, où, quel, combien, qui
  RELATION: 'relation',                 // fils, fille, ville, couleur…
  VERBE: 'verbe',                       // habite, appelle, ai…
  IGNORE: 'ignore',                     // est, ce, que… : sans effet sur le sens ici
});

// --- Le lexique de départ ----------------------------------------------------------------------
// mot → { role, relation? } . Une entrée de relation dit AUSSI quelle information elle désigne,
// ce qui permet de relier une question à la mémoire sans aucune inférence.
export const LEXIQUE_DEPART = Object.freeze({
  // Possessifs : ils désignent DE QUI on parle. C'est le cœur de la confusion je/tu.
  mon: { role: ROLES.POSSESSIF_MOI }, ma: { role: ROLES.POSSESSIF_MOI }, mes: { role: ROLES.POSSESSIF_MOI },
  ton: { role: ROLES.POSSESSIF_TOI }, ta: { role: ROLES.POSSESSIF_TOI }, tes: { role: ROLES.POSSESSIF_TOI },
  // Pronoms
  je: { role: ROLES.PRONOM_MOI }, j: { role: ROLES.PRONOM_MOI }, moi: { role: ROLES.PRONOM_MOI }, me: { role: ROLES.PRONOM_MOI },
  tu: { role: ROLES.PRONOM_TOI }, te: { role: ROLES.PRONOM_TOI }, toi: { role: ROLES.PRONOM_TOI },
  // Interrogatifs : ils disent qu'on pose une question, et parfois laquelle.
  comment: { role: ROLES.INTERROGATIF }, ou: { role: ROLES.INTERROGATIF, relation: 'ville' },
  quel: { role: ROLES.INTERROGATIF }, quelle: { role: ROLES.INTERROGATIF },
  combien: { role: ROLES.INTERROGATIF }, qui: { role: ROLES.INTERROGATIF },
  // Relations connues à la naissance : six seulement.
  fils: { role: ROLES.RELATION, relation: 'fils' },
  fille: { role: ROLES.RELATION, relation: 'fille' },
  ville: { role: ROLES.RELATION, relation: 'ville' },
  couleur: { role: ROLES.RELATION, relation: 'couleur' },
  nom: { role: ROLES.RELATION, relation: 'nom' },
  enfants: { role: ROLES.RELATION, relation: 'enfants' },
  // Verbes utiles : ils désignent eux aussi une relation.
  habite: { role: ROLES.VERBE, relation: 'ville' },
  habites: { role: ROLES.VERBE, relation: 'ville' },
  appelle: { role: ROLES.VERBE, relation: 'nom' },
  appelles: { role: ROLES.VERBE, relation: 'nom' },
  // Mots sans effet sur le sens dans ce prototype.
  est: { role: ROLES.IGNORE }, ce: { role: ROLES.IGNORE }, que: { role: ROLES.IGNORE },
  qu: { role: ROLES.IGNORE }, la: { role: ROLES.IGNORE }, le: { role: ROLES.IGNORE },
  les: { role: ROLES.IGNORE }, de: { role: ROLES.IGNORE }, du: { role: ROLES.IGNORE },
  a: { role: ROLES.IGNORE }, ai: { role: ROLES.IGNORE }, as: { role: ROLES.IGNORE },
  s: { role: ROLES.IGNORE }, est_ce: { role: ROLES.IGNORE }, en: { role: ROLES.IGNORE },
  preferee: { role: ROLES.IGNORE }, prefere: { role: ROLES.IGNORE },
});

// --- Ce qu'elle sait de son monde à la naissance ----------------------------------------------
// Des triplets { sujet, relation, valeur }. Volontairement peu nombreux.
// « moi » = la personne qui parle (Christophe) ; « naissance » = elle-même.
export const FAITS_DEPART = Object.freeze([
  { sujet: 'naissance', relation: 'nom', valeur: 'Naissance' },
]);

// --- Les patrons de phrase connus à la naissance ----------------------------------------------
// UN SEUL, volontairement : répondre par la valeur seule. Tout le reste devra être APPRIS.
// gabarit : le texte, avec {valeur} et {relation} comme emplacements.
export const PATRONS_DEPART = Object.freeze([
  { id: 'valeur-seule', relation: '*', sujet: '*', gabarit: '{valeur}', origine: 'depart' },
]);

export const PHRASE_IGNORANCE = 'Je ne sais pas.';
export const PHRASE_INCOMPRIS = "Je n'ai pas compris.";

// Taille du bagage, affichée à l'écran : sert à vérifier qu'il reste petit, et à voir la mémoire grandir.
export function tailleBagage() {
  return {
    mots: Object.keys(LEXIQUE_DEPART).length,
    faits: FAITS_DEPART.length,
    patrons: PATRONS_DEPART.length,
  };
}
// === FIN_LANGAGE_BAGAGE ===
