// === DEBUT_LANGAGE_PROJECTION_SOI ===
// v0.63.84 — PROJECTION « SOI » (décision ChatGPT « SONDE 1 VALIDÉE — INTÉGRATION DE B1 », 10/10/2026 ; issue de la sonde 1 du 10/10). VUE PURE,
// SYNCHRONE, DÉTERMINISTE. Miroir exact de la projection environnementale (v0.63.82) : là où l'environnement est présenté comme un opérateur dont
// Naissance ne connaît que ce qu'il lui a renvoyé, SOI est présenté comme un opérateur dont Naissance ne connaît que ce qu'il lui a fait.
// Elle répond à UNE seule question :
//
//   « les variations persistées de ma capacité d'agir (B1), à cause déclarée, peuvent-elles être présentées aux mécanismes généraux
//     d'expérience (.69 épisodes → .70 familles → .71 constats → .72 contextes → .74 attentes → .73/.75 issues) EXACTEMENT comme des
//     exécutions d'opérations sur une donnée d'état — « état c + tour actif → nouvel état c », « état c + repos → nouvel état c » ? »
//
// projeterSoi(ligneOrigine, lignesVariations) -> { valeurs, executions, descriptions }
//   ligneOrigine : la ligne de 'capaciteInitiale' { id, valeur } (l'état d'origine, c = plafond) ; lignesVariations : les lignes de
//   'variationsCapacite' { id, horodatage, cause: { type, id }, idEtatAvant, valeur } (voir connaissances.js). L'ordre des lignes est SANS
//   effet : chaque ligne est projetée pour elle-même.
//   valeurs : les DONNÉES D'ÉTAT, lignes { id, valeur, source: DESCRIPTION_SOURCE_SOI } prêtes à être concaténées aux lignes de valeursDonnees :
//     l'état d'origine (id = ligneOrigine.id) et, pour CHAQUE variation, l'état d'après (id = identiteEtatApres(variation), valeur = variation
//     .valeur). Ces identités sont DÉRIVÉES de façon stable d'identités persistées (préfixe fixe + identité de la variation) : identiques d'une
//     lecture à l'autre et après redémarrage. Le champ `source` est ce qui distingue une donnée de soi d'un message (resoudre-identites.js) :
//     rien n'est jamais écrit dans valeursDonnees.
//   executions : pour CHAQUE variation, une EXÉCUTION SYNTHÉTIQUE
//     { id: variation.id, horodatage: variation.horodatage, idDesignation: variation.cause.id, operation: 'soi:' + cause.type,
//       liaisons: [{ entree: 'etat', donnee: variation.idEtatAvant }], resultat: variation.valeur }
//     — « l'opérateur soi:tour (ou soi:repos), appliqué à l'état d'avant, a produit l'état d'après ». La cause tient lieu de désignation (le
//     fait antérieur : le tour actif identifié par son observation, ou le tick de repos), la variation d'exécution (le fait qui suit). Les
//     épisodes de transformation obtenus sont D'UN PAS : l'état d'après d'une variation (identiteEtatApres) est une DONNÉE DE SOURCE, pas la
//     production de la variation (dont la production porte l'identité variation.id et n'est l'entrée d'AUCUNE autre exécution) ; aucune
//     lignée cumulative n'est donc présentée aux mécanismes (choix de la sonde 1 : la lignée explose en n², la source par tick reste linéaire).
//   descriptions : UNE par opération soi:* effectivement présente dans les variations : { nom, entrees: { etat: forme nombre }, sortie:
//     forme nombre } — le contrat de la source soi (DESCRIPTION_SOURCE_SOI.forme) des deux côtés ; rien n'est inféré d'une valeur.
//   Sorties NEUVES, prêtes à être concaténées aux lignes réelles (executions-vecues.js). Aucune ligne réelle n'est modifiée, aucune table n'est
//   écrite, aucune identité n'est inventée (chaque identité est persistée ou dérivée d'une identité persistée par une règle fixe).
//   ERREURS : origine ou variation mal formée, type de cause inconnu, idEtatAvant qui n'est ni l'origine ni l'état d'après d'une variation
//   présente, deux variations de même identité ou de même cause, deux variations partant du même état (fourche) : TypeError, rien de partiel.
// CE QUE CETTE VUE NE FAIT PAS : juger, compter, préférer, comparer des valeurs de capacité ; décider qu'un tour doit avoir lieu ou qu'un
// repos doit être pris ; lire le plafond ou les paramètres de B1 (elle ne connaît aucun nombre).
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées.
import { DESCRIPTION_SOURCE_SOI } from './source-soi.js';

const NOM = 'projeterSoi';
export const PREFIXE_SOI = 'soi:';
export const ENTREE_ETAT = 'etat';
export const PREFIXE_ETAT_PROPRE = 'etat-propre-';
export const TYPES_CAUSE_SOI = Object.freeze(['tour', 'repos']);

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lirePropre(objet, champ, nom) {
  if (objet === null || typeof objet !== 'object') refuser(`${nom} doit être un objet`);
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

function nombreFini(valeur, nom) {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) refuser(`${nom} doit être un nombre fini`);
  return valeur;
}

// L'identité de la donnée d'état APRÈS une variation : dérivée, stable, jamais persistée.
export function identiteEtatApres(variation) {
  return PREFIXE_ETAT_PROPRE + chaineNonVide(lirePropre(variation, 'id', 'variation'), 'variation.id');
}

export function projeterSoi(ligneOrigine, lignesVariations) {
  if (!Array.isArray(lignesVariations)) refuser('lignesVariations doit être un tableau');
  const idOrigine = chaineNonVide(lirePropre(ligneOrigine, 'id', 'ligneOrigine'), 'ligneOrigine.id');
  const valeurOrigine = nombreFini(lirePropre(ligneOrigine, 'valeur', 'ligneOrigine'), 'ligneOrigine.valeur');
  const variations = [];
  const identites = new Set([idOrigine]);
  const causes = new Set();
  lignesVariations.forEach((v, rang) => {
    const nom = `lignesVariations[${rang}]`;
    const id = chaineNonVide(lirePropre(v, 'id', nom), `${nom}.id`);
    if (identites.has(id) || identites.has(PREFIXE_ETAT_PROPRE + id)) refuser(`deux lignes portent l'identité « ${id} »`);
    const cause = lirePropre(v, 'cause', nom);
    const type = chaineNonVide(lirePropre(cause, 'type', `${nom}.cause`), `${nom}.cause.type`);
    if (!TYPES_CAUSE_SOI.includes(type)) refuser(`${nom}.cause.type « ${type} » inconnu (attendu : ${TYPES_CAUSE_SOI.join(', ')})`);
    const idCause = chaineNonVide(lirePropre(cause, 'id', `${nom}.cause`), `${nom}.cause.id`);
    if (causes.has(idCause)) refuser(`deux variations portent la même cause « ${idCause} »`);
    causes.add(idCause);
    const idEtatAvant = chaineNonVide(lirePropre(v, 'idEtatAvant', nom), `${nom}.idEtatAvant`);
    const valeur = nombreFini(lirePropre(v, 'valeur', nom), `${nom}.valeur`);
    const horodatage = lirePropre(v, 'horodatage', nom);
    identites.add(id);
    identites.add(PREFIXE_ETAT_PROPRE + id);
    variations.push({ id, horodatage, type, idCause, idEtatAvant, valeur });
  });
  const etats = new Set([idOrigine, ...variations.map((v) => PREFIXE_ETAT_PROPRE + v.id)]);
  const departs = new Set();
  for (const v of variations) {
    if (!etats.has(v.idEtatAvant)) refuser(`la variation « ${v.id} » part d'un état « ${v.idEtatAvant} » qui n'est ni l'origine ni l'état d'après d'une variation présente`);
    if (v.idEtatAvant === PREFIXE_ETAT_PROPRE + v.id) refuser(`la variation « ${v.id} » part de son propre état d'après`);
    if (departs.has(v.idEtatAvant)) refuser(`deux variations partent du même état « ${v.idEtatAvant} » (fourche)`);
    departs.add(v.idEtatAvant);
  }
  const valeurs = [
    { id: idOrigine, valeur: valeurOrigine, source: DESCRIPTION_SOURCE_SOI },
    ...variations.map((v) => ({ id: PREFIXE_ETAT_PROPRE + v.id, valeur: v.valeur, source: DESCRIPTION_SOURCE_SOI })),
  ];
  const executions = variations.map((v) => ({
    id: v.id,
    horodatage: v.horodatage,
    idDesignation: v.idCause,
    operation: PREFIXE_SOI + v.type,
    liaisons: [{ entree: ENTREE_ETAT, donnee: v.idEtatAvant }],
    resultat: v.valeur,
  }));
  const forme = () => structuredClone(DESCRIPTION_SOURCE_SOI.forme);
  const descriptions = [...new Set(variations.map((v) => v.type))].sort().map((type) => ({ nom: PREFIXE_SOI + type, entrees: { [ENTREE_ETAT]: forme() }, sortie: forme() }));
  return { valeurs, executions, descriptions };
}
// === FIN_LANGAGE_PROJECTION_SOI ===
