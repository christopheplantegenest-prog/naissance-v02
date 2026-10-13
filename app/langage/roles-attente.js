// === DEBUT_LANGAGE_ROLES_ATTENTE ===
// v0.64.7 — « PRÉSERVER LES RÔLES DE L'ATTENTE » (décision ChatGPT « DÉCISION v0.64.7 », 13/10/2026). LECTURE PURE, SYNCHRONE, DÉTERMINISTE.
// Elle répond à UNE seule question :
//
//   « dans cette ligne persistée de attentesProspectives, quelles données occupent chacun des quatre rôles qui étaient déjà distincts pendant
//     le calcul de l'attente ? »
//
// Les rôles ne sont PAS déduits des noms : ils viennent des dépendances mesurées (diagnostic « avant que l'attente soit aplatie ») :
//   description  — ce dont dépend « ce qui est attendu » : structure, chemin, constat (+ relation d'une attente conditionnée) ; produite par le
//                  calculateur, lue par l'issue ; inchangée quand les identités changent ;
//   preuve       — ce qui établissait POURQUOI l'attente existe : temoinsContexte, unitesIssues (+ fondation d'une attente conditionnée) ;
//                  produite par le calculateur à partir des unités et des témoins, jamais lue pour savoir ce qui est attendu, non recalculable
//                  après K0 (valeur persistée complète) ;
//   references   — identités d'AUTRES objets nécessaires au raccord : idContexte (contexte visé), idDesignation (ce qui portera l'issue) ;
//                  produites par le calculateur, lues par l'issue et les vues ;
//   occurrence   — identité/provenance de la ligne PERSISTÉE : id, horodatage, idObservation ; ajoutées par l'enregistrement (magasin,
//                  désignation), jamais par le calculateur ; idObservation n'a aucun consommateur : il est conservé, aucun usage n'est inventé.
//
// DEUX FORMES PERSISTÉES, lues explicitement (aucune migration : convention du dépôt, voir .63.96 ; le magasin conserve les lignes à la montée
// de version et une sauvegarde est réimportée telle quelle) :
//   v0.64.7 et après : { id, horodatage, idObservation, description, preuve, references } — les rôles sont des POSITIONS de la ligne ;
//   v0.63.74 à v0.64.6 (lignes plates) : { id, horodatage, idDesignation, idObservation, idContexte, structure, chemin, constat,
//     temoinsContexte, unitesIssues[, fondation][, relation] } — chaque clé est rangée par la table fixe RANGEMENT_PLAT ci-dessous (la même
//     que l'écriture .64.7 : une ligne plate lue ici rend exactement les groupes que .64.7 aurait écrits pour la même attente).
// Une ligne qui mêle les deux formes, ou qui porte une clé inconnue, est REFUSÉE (TypeError) : aucune ambiguïté silencieuse, aucun repli.
//
// rolesDeLAttente(ligne) -> { occurrence, description, preuve, references } (copies neuves ; entrée jamais modifiée)
//   Forme structurée : relation et fondation ensemble ou aucune. Forme plate : relation jamais sans fondation ; fondation sans relation admise
//   (lignes .64.1 à .64.4, écrites avant la relation).
//   occurrence ne contient que les clés présentes dans la ligne (une ligne plate de test peut ne porter ni horodatage ni idObservation).
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état.

const NOM = 'rolesDeLAttente';
export const GROUPES_ATTENTE = Object.freeze(['description', 'preuve', 'references']);
const OCCURRENCE = Object.freeze(['id', 'horodatage', 'idObservation']);
const RANGEMENT_PLAT = Object.freeze({
  id: 'occurrence', horodatage: 'occurrence', idObservation: 'occurrence',
  idContexte: 'references', idDesignation: 'references',
  structure: 'description', chemin: 'description', constat: 'description', relation: 'description',
  temoinsContexte: 'preuve', unitesIssues: 'preuve', fondation: 'preuve',
});
const OBLIGATOIRES = Object.freeze({ description: ['structure', 'chemin', 'constat'], preuve: ['temoinsContexte', 'unitesIssues'], references: ['idContexte', 'idDesignation'] });
const FACULTATIVES = Object.freeze({ description: ['relation'], preuve: ['fondation'], references: [] });

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);

function donnee(objet, cle, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  if (!('value' in place)) refuser(`${nom}.${String(cle)} est un accesseur : une donnée est attendue`);
  return place.value;
}

// Vérifie les clés d'un groupe et en rend une copie (ordre : obligatoires puis facultatives présentes).
function groupe(valeurs, role, nom) {
  for (const cle of OBLIGATOIRES[role]) if (!Object.hasOwn(valeurs, cle)) refuser(`${nom} n'a pas de champ « ${cle} »`);
  const copie = {};
  for (const cle of [...OBLIGATOIRES[role], ...FACULTATIVES[role]]) if (Object.hasOwn(valeurs, cle)) copie[cle] = structuredClone(valeurs[cle]);
  return copie;
}

export function rolesDeLAttente(ligne) {
  if (!objetSimple(ligne)) refuser('la ligne doit être un objet');
  const cles = Reflect.ownKeys(ligne);
  const structuree = cles.some((c) => GROUPES_ATTENTE.includes(c));
  const occurrence = {};
  for (const cle of OCCURRENCE) if (Object.hasOwn(ligne, cle)) occurrence[cle] = donnee(ligne, cle, 'ligne');
  if (!Object.hasOwn(occurrence, 'id')) refuser('la ligne n\'a pas de champ « id »');
  if (structuree) {
    for (const cle of cles) if (!OCCURRENCE.includes(cle) && !GROUPES_ATTENTE.includes(cle)) refuser(`la ligne structurée porte une clé hors de ses rôles (${String(cle)})`);
    const roles = { occurrence: structuredClone(occurrence) };
    for (const role of GROUPES_ATTENTE) {
      if (!Object.hasOwn(ligne, role)) refuser(`la ligne structurée n'a pas de groupe « ${role} »`);
      const valeurs = donnee(ligne, role, 'ligne');
      if (!objetSimple(valeurs)) refuser(`ligne.${role} doit être un objet`);
      const permises = [...OBLIGATOIRES[role], ...FACULTATIVES[role]];
      for (const cle of Reflect.ownKeys(valeurs)) if (!permises.includes(cle)) refuser(`ligne.${role} porte une clé qui n'appartient pas à ce rôle (${String(cle)})`);
      const lues = {};
      for (const cle of permises) if (Object.hasOwn(valeurs, cle)) lues[cle] = donnee(valeurs, cle, `ligne.${role}`);
      roles[role] = groupe(lues, role, `ligne.${role}`);
    }
    // .64.7 : relation (description) et fondation (preuve) viennent ensemble d'une attente conditionnée, ou ne sont ni l'une ni l'autre.
    if (Object.hasOwn(roles.description, 'relation') !== Object.hasOwn(roles.preuve, 'fondation')) refuser('une ligne structurée porte relation et fondation ensemble ou aucune des deux');
    return roles;
  }
  // Forme plate historique (v0.63.74 → v0.64.6) : rangement fixe, clé par clé.
  const parRole = { description: {}, preuve: {}, references: {} };
  for (const cle of cles) {
    const role = RANGEMENT_PLAT[cle];
    if (role === undefined) refuser(`la ligne plate porte une clé inconnue (${String(cle)})`);
    if (role !== 'occurrence') parRole[role][cle] = donnee(ligne, cle, 'ligne');
  }
  // Historique : relation n'a jamais été écrite sans fondation (.64.5) ; une fondation sans relation est une ligne .64.1 à .64.4, lue telle quelle.
  if (Object.hasOwn(parRole.description, 'relation') && !Object.hasOwn(parRole.preuve, 'fondation')) refuser('la ligne plate porte une relation sans fondation');
  return {
    occurrence: structuredClone(occurrence),
    description: groupe(parRole.description, 'description', 'ligne'),
    preuve: groupe(parRole.preuve, 'preuve', 'ligne'),
    references: groupe(parRole.references, 'references', 'ligne'),
  };
}
// === FIN_LANGAGE_ROLES_ATTENTE ===
