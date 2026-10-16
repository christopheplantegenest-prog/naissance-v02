// === DEBUT_LANGAGE_RETROUVAILLES ===
// v0.64.31 — RETROUVAILLE-1 « RETROUVER UNE RELATION DANS LE PRÉSENT AVANT L'ATTENTE » (GO ChatGPT « GO DÉVELOPPEMENT RETROUVAILLE-1 — v0.64.31 »,
// 16/10/2026 ; conception approuvée : travail/v0.64.31/). CALCUL PUR, SYNCHRONE, DÉTERMINISTE.
//
// QUESTION UNIQUE, posée pour chaque contexte prospectif d'un acte, AVANT l'écriture de ce contexte et donc avant toute attente de l'acte :
//   « parmi les relations déjà persistées (description.relation des lignes de attentesProspectives), lesquelles ont EXACTEMENT le domaine de
//     ce contexte et EXACTEMENT sa partie connue, sur un attendu encore ouvert ? »
// Le résultat est FIGÉ dans le groupe `retrouvaille` de la ligne de contexte (connaissances.js). Il n'influence RIEN : ni l'acte, ni les
// attentes produites, ni l'issue, ni les besoins, ni une décision. Ce n'est ni une règle, ni une généralisation, ni une prédiction utilisée,
// ni une préférence : la réutilisation prospective d'une relation historique exacte.
//
// PRÉSENT (rien d'autre n'est lu du futur) : partie = partieConnueEpisode(contexte.episodePartiel, vecu…) — la MÊME vue, le MÊME vécu « avant »
//   que ceux de K0 ; ouverts = cheminsOuverts(contexte.chemins, partie). Si l'un des deux lève : statut 'non-effectuee', AUCUNE ligne lue.
// LIGNES (une catégorie chacune, dans cet ordre) :
//   1. sans relation brute (ni description.relation, ni relation plate) : non candidate, rien n'est écrit ;
//   2. relation brute, `id` propre non représentable (pas une chaîne non vide) : aucune identité inventée ; cause 'ligne-non-identifiable' ;
//   3. relation brute, rolesDeLAttente refuse, acte illisible ou relation sans { domaine, connu, attendu } : nonComparees (son id) ;
//   4. lisible : quatre points, chacun ÉTABLI vrai, ÉTABLI faux, ou inévaluable (un parcours lève) :
//      a. domaine   : memesRelations(R.domaine, contexte.structure) ;
//      b. chemins   : chaque chemin de parcourirStructure(R.connu) porte une occurrence dans parcourirStructure(partie) (égalité de chemin de
//                     cheminsOuverts : memesCouvertures) ;
//      c. valeurs   : memesRelations(reconstruireStructure(restreindreParcours(parcourirStructure(partie), ces chemins)), R.connu) — la
//                     projection même de relationFondatrice ; aucune autre égalité ;
//      d. attendu   : les CHEMINS des occurrences à valeur de parcourirStructure(R.attendu) sont tous parmi les chemins ouverts (au moins un).
//                     Les VALEURS de l'attendu ne sont jamais lues pour chercher.
//      Un point établi faux : ÉLIMINÉE (même si un autre est inévaluable). Aucun faux et un inévaluable : nonComparees. Quatre vrais : COMPATIBLE.
// DÉDOUBLONNAGE : les relations compatibles sont réunies par memesRelations sur R ENTIÈRE (contrat v0.64.29) : une relation, la liste des
//   identités de ses lignes (formulations ; ordre de l'instantané, SANS signification ; jamais un nombre lu).
// STATUT : présent illisible → 'non-effectuee' ; sinon, si au moins deux relations distinctes OU une comparaison incomplète → 'abstention'
//   avec causes ⊆ ['relations-distinctes', 'comparaison-incomplete', 'ligne-non-identifiable'] (ordre canonique, aucune ne prime) ; sinon une
//   relation → 'retrouvee' ; sinon → 'aucune'. Les relations compatibles lisibles restent copiées même en abstention.
// Aucun compteur, fréquence, vote, majorité, score, récence, préférence, hasard, ni taille de fondation ; la reconnaissance v0.64.29, les
// témoins, les fondations, les issues et les horodatages ne sont JAMAIS lus.
//
// API
//   retrouvaillesDesContextes(contextes, acte, instantane, vecu) -> [retrouvaille]  (rang k ↔ contextes[k])
//     contextes : sorties de contextesProspectifs (avant écriture) ; acte : { id } ; instantane : attentesProspectives lue UNE fois par
//     l'appelant juste avant ; vecu : { valeurs, executions, descriptions } (le vécu « avant » déjà lu par l'appelant).
//     GARANTIE D'ORDRE : une ligne de l'instantané dont l'acte (references.idDesignation ou idDesignation plat) est acte.id → TypeError :
//     aucune retrouvaille n'est calculée sur un instantané qui contient déjà une attente de cet acte.
//   retrouvailleDuContexte(contexte, instantane, vecu) -> retrouvaille  (un contexte ; sans la garantie d'acte)
//   La FORME du groupe (validerRetrouvaille, statuts, causes) et la lecture de l'acte d'une ligne (ligneDeLActe) sont dans
//   retrouvaille-forme.js : l'écrivain (connaissances.js) et la relecture Diagnostic n'importent qu'elle, jamais ce calcul.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
import { rolesDeLAttente } from './roles-attente.js';
import { memesRelations } from './relations-formulees.js';
import { parcourirStructure } from './parcours-structure.js';
import { restreindreParcours } from './restriction-parcours.js';
import { reconstruireStructure } from './reconstruction-structure.js';
import { partieConnueEpisode } from './episodes-de-transformation.js';
import { cheminsOuverts } from './contexte-prospectif.js';
import { memesCouvertures } from './couverture-occurrences.js';
import { validerRetrouvaille, ligneDeLActe } from './retrouvaille-forme.js';

const NOM = 'retrouvaille';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;


// Donnée propre (jamais un accesseur) : la ligne brute n'est lue qu'ainsi.
function propre(objet, cle) {
  if (!objetSimple(objet) || !Object.hasOwn(objet, cle)) return undefined;
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  return 'value' in place ? place.value : undefined;
}
function porteRelationBrute(ligne) {
  if (!objetSimple(ligne)) return false;
  if (Object.hasOwn(ligne, 'relation')) return true;
  const description = propre(ligne, 'description');
  return objetSimple(description) && Object.hasOwn(description, 'relation');
}

// Évaluation tri-valuée d'un point : true / false / null (inévaluable : un parcours a levé).
const essayer = (f) => { try { return f() === true; } catch { return null; } };

// Classement des lignes, UNE fois par instantané (indépendant du contexte).
function classerLignes(instantane) {
  const lisibles = []; // { id, relation }
  const nonComparees = [];
  let nonIdentifiable = false;
  for (const ligne of instantane) {
    if (!porteRelationBrute(ligne)) continue;
    const id = propre(ligne, 'id');
    if (!chaineNonVide(id)) { nonIdentifiable = true; continue; }
    let roles;
    try { roles = rolesDeLAttente(ligne); } catch { nonComparees.push(id); continue; }
    const relation = roles.description.relation;
    if (!chaineNonVide(roles.references.idDesignation) || !objetSimple(relation)
      || !['domaine', 'connu', 'attendu'].every((k) => Object.hasOwn(relation, k))) { nonComparees.push(id); continue; }
    lisibles.push({ id, relation });
  }
  return { lisibles, nonComparees, nonIdentifiable };
}

function evaluer(relation, contexte, occurrencesPresent, ouverts) {
  const domaine = essayer(() => memesRelations(relation.domaine, contexte.structure));
  let chemins = null;
  let K = null;
  try {
    K = parcourirStructure(relation.connu).map((o) => o.chemin);
    chemins = K.every((k) => occurrencesPresent.some((o) => memesCouvertures([o.chemin], [k])));
  } catch { chemins = null; }
  let valeurs;
  if (chemins === true) valeurs = essayer(() => memesRelations(reconstruireStructure(restreindreParcours(occurrencesPresent, K)), relation.connu));
  else valeurs = chemins === false ? false : null;
  const attendu = essayer(() => {
    const feuilles = parcourirStructure(relation.attendu).filter((o) => Object.hasOwn(o, 'valeur')).map((o) => o.chemin);
    return feuilles.length > 0 && feuilles.every((f) => ouverts.some((c) => memesCouvertures([c], [f])));
  });
  const points = [domaine, chemins, valeurs, attendu];
  if (points.includes(false)) return 'eliminee';
  if (points.includes(null)) return 'non-comparee';
  return 'compatible';
}

function calculer(contexte, obtenirClassees, vecu) {
  let partie;
  let occurrencesPresent;
  let ouverts;
  try {
    partie = partieConnueEpisode(contexte.episodePartiel, vecu.valeurs, vecu.executions, vecu.descriptions);
    occurrencesPresent = parcourirStructure(partie);
    ouverts = cheminsOuverts(contexte.chemins, partie).map((c) => c.chemin);
  } catch {
    return { statut: 'non-effectuee', relations: [], nonComparees: [] }; // aucune ligne n'est lue
  }
  const classees = obtenirClassees(); // l'instantané n'est classé qu'ici, une fois le présent lisible
  const relations = []; // { relation, formulations }
  const nonComparees = [...classees.nonComparees];
  for (const { id, relation } of classees.lisibles) {
    const verdict = evaluer(relation, contexte, occurrencesPresent, ouverts);
    if (verdict === 'eliminee') continue;
    if (verdict === 'non-comparee') { nonComparees.push(id); continue; }
    const g = relations.find((x) => memesRelations(x.relation, relation));
    if (g === undefined) relations.push({ relation: structuredClone(relation), formulations: [id] });
    else g.formulations.push(id);
  }
  const causes = [];
  if (relations.length >= 2) causes.push('relations-distinctes');
  if (nonComparees.length > 0 || classees.nonIdentifiable) causes.push('comparaison-incomplete');
  if (classees.nonIdentifiable) causes.push('ligne-non-identifiable');
  if (causes.length > 0) return { statut: 'abstention', relations, nonComparees, causes };
  return { statut: relations.length === 1 ? 'retrouvee' : 'aucune', relations, nonComparees };
}

function exigerVecu(vecu) {
  if (!objetSimple(vecu) || !Array.isArray(vecu.valeurs) || !Array.isArray(vecu.executions) || !Array.isArray(vecu.descriptions)) refuser('vecu doit porter valeurs, executions et descriptions (tableaux)');
}

export function retrouvailleDuContexte(contexte, instantane, vecu) {
  if (!objetSimple(contexte)) refuser('contexte doit être un objet');
  if (!Array.isArray(instantane)) refuser('instantane doit être un tableau');
  exigerVecu(vecu);
  return validerRetrouvaille(calculer(contexte, () => classerLignes(instantane), vecu));
}

export function retrouvaillesDesContextes(contextes, acte, instantane, vecu) {
  if (!Array.isArray(contextes)) refuser('contextes doit être un tableau');
  if (!objetSimple(acte) || !chaineNonVide(acte.id)) refuser('acte.id doit être une chaîne non vide');
  if (!Array.isArray(instantane)) refuser('instantane doit être un tableau');
  if (contextes.length === 0) return [];
  exigerVecu(vecu);
  if (instantane.some((ligne) => ligneDeLActe(ligne, acte.id))) refuser(`une attente de l'acte « ${acte.id} » existe déjà dans l'instantané : la retrouvaille doit précéder toute attente de l'acte`);
  let classees = null; // classé au plus une fois par acte, et seulement si un présent est lisible
  const obtenirClassees = () => (classees === null ? (classees = classerLignes(instantane)) : classees);
  return contextes.map((contexte, rang) => {
    if (!objetSimple(contexte)) refuser(`contextes[${rang}] doit être un objet`);
    return validerRetrouvaille(calculer(contexte, obtenirClassees, vecu));
  });
}

// === FIN_LANGAGE_RETROUVAILLES ===
