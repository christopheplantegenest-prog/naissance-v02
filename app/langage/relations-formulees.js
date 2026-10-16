// === DEBUT_LANGAGE_RELATIONS_FORMULEES ===
// v0.64.29 — « RECONNAÎTRE UNE RELATION DÉJÀ FORMULÉE » (GO ChatGPT « GO DÉVELOPPEMENT v0.64.29 », 16/10/2026). CALCUL PUR, SYNCHRONE,
// DÉTERMINISTE. Appelé UNIQUEMENT par enregistrerAttenteProspective (connaissances.js), pour une attente conditionnée C déjà calculée et
// validée, APRÈS les garanties d'ordre et AVANT l'unique écriture de C. Il ne participe JAMAIS à la production de C : il reçoit ses rôles
// déjà figés, ne les modifie pas, et rend seulement le groupe `reconnaissance` qui sera écrit avec elle.
//
// SENS (limite maximale) : « au moment où C est écrite, parmi les attentes déjà persistées d'AUTRES actes, celles dont la relation est
// exactement la même (même domaine, mêmes valeurs aux mêmes chemins) ; pour chacune, les épisodes témoins étaient-ils les mêmes ? ».
// Des identités, rien d'autre : ni objet relationnel, ni nombre, ni classement, ni preuve nouvelle ou indépendante.
//
// memesRelations(r1, r2) -> booléen
//   Les deux relations ENTIÈRES { domaine, connu, attendu } sont parcourues par parcourirStructure (occurrences en préfixe, clés d'objet
//   triées : leur ordre n'a pas de sens ; indices de tableau croissants : l'ordre des étapes du domaine et de leurs entrées compte).
//   Égales ssi même nombre d'occurrences et, rang par rang : même chemin (segment par segment, Object.is), même type, même présence d'une
//   valeur et même valeur (Object.is : 0 et -0 diffèrent, 1 et "1" diffèrent). Aucune normalisation, aucune sérialisation.
//
// formulationsAnterieures(c, instantane) -> { formulationsAnterieures: [{ idAttente, temoins }], nonComparees: [idAttente] }
//   c : rôles de C { description: { relation, … }, preuve: { unitesIssues, … }, references: { idDesignation, … } }.
//   instantane : la table attentesProspectives lue par l'écrivain juste avant d'écrire C (C n'y est donc pas). Chaque ligne tombe dans UNE
//   seule catégorie :
//     NON CANDIDATE (rien d'écrit) : ligne lisible sans relation ; ligne lisible du même acte (memeActe) ; ligne illisible SANS relation brute ;
//       ligne NON REPRÉSENTABLE : son champ propre `id` n'est pas une chaîne non vide (aucune identité persistée ne peut la nommer ; aucune
//       identité n'est inventée, ni null, ni rang, ni index). Tout écrivain de Naissance donne à chaque ligne un id nouvelId (chaîne non
//       vide) et IndexedDB exige la clé : ce cas ne naît que d'une table forgée (sauvegarde modifiée puis réempreintée) ou d'un test.
//     COMPARÉE DIFFÉRENTE (rien d'écrit).
//     COMPARÉE IDENTIQUE -> formulationsAnterieures, temoins = 'identiques' si memesCouvertures(unitesIssues de la ligne, de C), sinon
//       'differents' (seulement : mêmes épisodes témoins, ou épisodes témoins différents).
//     CANDIDATE ILLISIBLE -> nonComparees : la ligne porte une relation brute (description.relation, ou relation de la forme plate) mais
//       rolesDeLAttente la refuse, son acte n'est pas une chaîne non vide, ou un parcours (relation, couverture) échoue. MISE À JOUR
//       DÉLIBÉRÉE v0.64.29 (correction avant dépôt, ChatGPT 16/10/2026) : chaque élément est EXACTEMENT ligne.id, chaîne non vide ; jamais null.
//   memeActe(A, C) : idA et idC (references.idDesignation, lus par rolesDeLAttente) chaînes non vides et idA === idC sur la chaîne
//     entière. Aucune date, aucun tour, aucun ordre, aucun préfixe.
//   Ordre des deux listes : celui de l'instantané, sans signification.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
import { rolesDeLAttente } from './roles-attente.js';
import { parcourirStructure } from './parcours-structure.js';
import { memesCouvertures } from './couverture-occurrences.js';

const NOM = 'formulationsAnterieures';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const objetSimple = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const chaineNonVide = (x) => typeof x === 'string' && x.length > 0;

function memesChemins(a, b) {
  if (a.length !== b.length) return false;
  for (let k = 0; k < a.length; k += 1) if (!Object.is(a[k], b[k])) return false;
  return true;
}

function memesParcours(p, q) {
  if (p.length !== q.length) return false;
  for (let i = 0; i < p.length; i += 1) {
    const o = p[i];
    const w = q[i];
    if (o.type !== w.type || !memesChemins(o.chemin, w.chemin)) return false;
    const aValeur = Object.hasOwn(o, 'valeur');
    if (aValeur !== Object.hasOwn(w, 'valeur')) return false;
    if (aValeur && !Object.is(o.valeur, w.valeur)) return false;
  }
  return true;
}

export function memesRelations(r1, r2) {
  return memesParcours(parcourirStructure(r1), parcourirStructure(r2));
}

// Donnée propre (jamais un accesseur) : la ligne brute n'est lue qu'ainsi.
function propre(objet, cle) {
  if (!objetSimple(objet) || !Object.hasOwn(objet, cle)) return undefined;
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  return 'value' in place ? place.value : undefined;
}

// La ligne brute porte-t-elle une relation (forme structurée description.relation, ou forme plate relation) ?
function porteRelationBrute(ligne) {
  if (!objetSimple(ligne)) return false;
  if (Object.hasOwn(ligne, 'relation')) return true;
  const description = propre(ligne, 'description');
  return objetSimple(description) && Object.hasOwn(description, 'relation');
}


export function formulationsAnterieures(c, instantane) {
  if (!objetSimple(c) || !objetSimple(c.description) || !objetSimple(c.preuve) || !objetSimple(c.references)) refuser('c doit porter les rôles description, preuve et references');
  if (!Object.hasOwn(c.description, 'relation')) refuser('c doit être une attente conditionnée (relation présente)');
  if (!Array.isArray(instantane)) refuser('instantane doit être un tableau');
  const idC = c.references.idDesignation;
  if (!chaineNonVide(idC)) refuser('c.references.idDesignation doit être une chaîne non vide');
  let parcoursC = null;
  try { parcoursC = parcourirStructure(c.description.relation); } catch { parcoursC = null; }
  const anterieures = [];
  const nonComparees = [];
  for (const ligne of instantane) {
    const idAttente = propre(ligne, 'id');
    if (!chaineNonVide(idAttente)) continue; // non représentable : aucune identité persistée lisible (voir l'en-tête)
    let roles;
    try {
      roles = rolesDeLAttente(ligne);
    } catch {
      if (porteRelationBrute(ligne)) nonComparees.push(idAttente);
      continue;
    }
    if (!Object.hasOwn(roles.description, 'relation')) continue;
    const idA = roles.references.idDesignation;
    if (!chaineNonVide(idA)) { nonComparees.push(idAttente); continue; }
    if (idA === idC) continue;
    let egales;
    try {
      if (parcoursC === null) throw new TypeError('relation de c non parcourable');
      egales = memesParcours(parcourirStructure(roles.description.relation), parcoursC);
    } catch {
      nonComparees.push(idAttente);
      continue;
    }
    if (!egales) continue;
    let temoins;
    try {
      temoins = memesCouvertures(roles.preuve.unitesIssues, c.preuve.unitesIssues) ? 'identiques' : 'differents';
    } catch {
      nonComparees.push(idAttente);
      continue;
    }
    anterieures.push({ idAttente, temoins });
  }
  return { formulationsAnterieures: anterieures, nonComparees };
}
// === FIN_LANGAGE_RELATIONS_FORMULEES ===
