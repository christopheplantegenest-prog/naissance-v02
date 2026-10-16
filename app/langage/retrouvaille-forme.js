// === DEBUT_LANGAGE_RETROUVAILLE_FORME ===
// v0.64.31 — RETROUVAILLE-1 : FORME STRICTE du groupe `retrouvaille` (GO ChatGPT « GO DÉVELOPPEMENT RETROUVAILLE-1 — v0.64.31 », 16/10/2026).
// Séparée du calcul (retrouvailles.js) pour que l'écrivain (connaissances.js, enregistrerContexteProspectif) et la relecture
// Diagnostic (retrouvailles-persistees.js) n'importent QUE la forme : ni le présent, ni le vécu, ni les attentes ne leur sont accessibles.
//
//   retrouvaille = { statut: 'retrouvee' | 'aucune' | 'abstention' | 'non-effectuee',
//                    relations: [{ relation: { domaine, connu, attendu }, formulations: [idAttente] }],
//                    nonComparees: [idAttente],
//                    causes: ['relations-distinctes' | 'comparaison-incomplete' | 'ligne-non-identifiable'] }   (causes : abstention SEULEMENT)
//
// validerRetrouvaille(g) -> copie neuve validée ; TypeError si la forme ou la cohérence n'est pas exacte (écriture ET relecture) :
//   clés exactes, données propres ; identités chaînes non vides, sans répétition ; chaque relation exactement { domaine, connu, attendu },
//   parcourable, deux à deux distinctes (memesRelations : la SEULE égalité de relation) ; retrouvee = une relation ; aucune et non-effectuee =
//   aucune relation et nonComparees vide ; abstention = causes non vides, connues, uniques, dans l'ordre canonique, chacune ⇔ son fait.
// ligneDeLActe(ligne, idActe) -> booléen : la ligne brute (forme structurée references.idDesignation, ou forme plate idDesignation) porte-t-elle
//   cet acte ? Même lecture pour la garantie du calcul et pour celle de l'écrivain.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
import { memesRelations } from './relations-formulees.js';

const NOM = 'retrouvaille';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;

export const STATUTS_RETROUVAILLE = Object.freeze(['retrouvee', 'aucune', 'abstention', 'non-effectuee']);
export const CAUSES_ABSTENTION = Object.freeze(['relations-distinctes', 'comparaison-incomplete', 'ligne-non-identifiable']);

// Donnée propre (jamais un accesseur) : la ligne brute n'est lue qu'ainsi.
function propre(objet, cle) {
  if (!objetSimple(objet) || !Object.hasOwn(objet, cle)) return undefined;
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  return 'value' in place ? place.value : undefined;
}
export function ligneDeLActe(ligne, idActe) {
  return propre(propre(ligne, 'references'), 'idDesignation') === idActe || propre(ligne, 'idDesignation') === idActe;
}

// ------------------------------------------------------------------------------------------------------------- validation stricte
const CLES = Object.freeze(['statut', 'relations', 'nonComparees']);
export function validerRetrouvaille(g) {
  if (!objetSimple(g)) refuser('le groupe doit être un objet');
  const cles = Reflect.ownKeys(g);
  for (const k of cles) {
    if (![...CLES, 'causes'].includes(k)) refuser(`clé étrangère « ${String(k)} »`);
    if (!('value' in Object.getOwnPropertyDescriptor(g, k))) refuser(`« ${String(k)} » est un accesseur`);
  }
  for (const k of CLES) if (!Object.hasOwn(g, k)) refuser(`« ${k} » manque`);
  const { statut, relations, nonComparees } = g;
  if (!STATUTS_RETROUVAILLE.includes(statut)) refuser(`statut inconnu « ${String(statut)} »`);
  if (!Array.isArray(relations) || !Array.isArray(nonComparees)) refuser('relations et nonComparees doivent être des tableaux');
  for (const id of nonComparees) if (!chaineNonVide(id)) refuser('nonComparees ne contient que des identités (chaînes non vides)');
  if (new Set(nonComparees).size !== nonComparees.length) refuser('nonComparees ne répète aucune identité');
  relations.forEach((r, i) => {
    if (!objetSimple(r) || Reflect.ownKeys(r).length !== 2 || !Object.hasOwn(r, 'relation') || !Object.hasOwn(r, 'formulations')) refuser(`relations[${i}] doit être exactement { relation, formulations }`);
    const R = r.relation;
    if (!objetSimple(R) || Reflect.ownKeys(R).length !== 3 || !['domaine', 'connu', 'attendu'].every((k) => Object.hasOwn(R, k))) refuser(`relations[${i}].relation doit être exactement { domaine, connu, attendu }`);
    memesRelations(R, R); // parcourable (le parcours lève sinon)
    if (!Array.isArray(r.formulations) || r.formulations.length === 0 || !r.formulations.every(chaineNonVide)) refuser(`relations[${i}].formulations : identités non vides`);
    if (new Set(r.formulations).size !== r.formulations.length) refuser(`relations[${i}].formulations ne répète aucune identité`);
  });
  for (let i = 0; i < relations.length; i += 1) for (let j = i + 1; j < relations.length; j += 1) if (memesRelations(relations[i].relation, relations[j].relation)) refuser('deux relations du groupe sont identiques (une relation = une entrée)');
  const aCauses = Object.hasOwn(g, 'causes');
  const causes = aCauses ? g.causes : null;
  if (statut !== 'abstention') {
    if (aCauses) refuser(`causes n'existe que pour une abstention`);
    if (nonComparees.length > 0) refuser(`${statut} : nonComparees doit être vide`);
    if (statut === 'retrouvee' && relations.length !== 1) refuser('retrouvee : exactement une relation');
    if ((statut === 'aucune' || statut === 'non-effectuee') && relations.length !== 0) refuser(`${statut} : aucune relation`);
  } else {
    if (!Array.isArray(causes) || causes.length === 0) refuser('abstention : causes non vide requise');
    if (!causes.every((c) => CAUSES_ABSTENTION.includes(c))) refuser('abstention : cause inconnue');
    if (new Set(causes).size !== causes.length) refuser('abstention : cause répétée');
    const canonique = CAUSES_ABSTENTION.filter((c) => causes.includes(c));
    if (canonique.some((c, k) => c !== causes[k])) refuser('abstention : causes hors de l\'ordre canonique');
    if (causes.includes('relations-distinctes') !== (relations.length >= 2)) refuser('abstention : « relations-distinctes » ⇔ au moins deux relations');
    const incomplete = causes.includes('comparaison-incomplete');
    const nonIdent = causes.includes('ligne-non-identifiable');
    if (nonIdent && !incomplete) refuser('abstention : « ligne-non-identifiable » sans « comparaison-incomplete »');
    if (incomplete !== (nonComparees.length > 0 || nonIdent)) refuser('abstention : « comparaison-incomplete » ⇔ nonComparees non vide ou ligne non identifiable');
  }
  const copie = { statut, relations: relations.map((r) => ({ relation: structuredClone(r.relation), formulations: [...r.formulations] })), nonComparees: [...nonComparees] };
  if (aCauses) copie.causes = [...causes];
  return copie;
}
// === FIN_LANGAGE_RETROUVAILLE_FORME ===
