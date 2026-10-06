// === DEBUT_LANGAGE_EMPREINTE_CONTRATS ===
// v0.63.51 — « EMPREINTE DÉTERMINISTE DES CONTRATS D'OPÉRATIONS » (décision ChatGPT, 06/10/2026). PRIMITIVE PURE, SYNCHRONE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « quel est, pour chaque opération d'un catalogue, l'empreinte de son CONTRAT MÉCANIQUE canonique ? »
//
// empreintesDesContrats(descriptions) -> [ { operation, empreinte } ]
//   operation : le nom de la description ; empreinte : SHA-256 COMPLET (64 caractères hexadécimaux minuscules) du contrat canonique.
//   Trié par `operation` (unités de code, sans signification) : l'ordre du catalogue fourni n'a AUCUNE influence. Un nouvel objet à chaque appel.
// contratCanonique(description) -> chaîne : la représentation canonique elle-même (exportée pour être testée SÉPARÉMENT du hachage : une erreur
//   de canonisation ne doit pas pouvoir se confondre avec une erreur de SHA-256).
//
// CONTRAT MÉCANIQUE = le descripteur VALIDÉ ENTIER { nom, entrees, sortie } (diagnostic v0.63.50 : chaque partie est lue par au moins un
// consommateur du dépôt — nom, formes d'entrée et collectif par le calcul des possibilités, le regroupement des candidats et la conformité des
// applications ; sortie par la description des productions et les sous-données α2). Aucune propriété accidentelle : un descripteur validé est un graphe de littéraux JSON (aucune fonction, aucune référence).
//
// REPRÉSENTATION CANONIQUE : le texte JSON de la copie validée (validerDescripteurOperation), dont TOUTES les clés d'objet sont triées (unités de
// code) à chaque niveau, y compris les noms d'entrées et de champs (l'ordre des clés n'a aucun sens). Les formes ne contiennent aucun tableau :
// aucun ordre de collection n'est à conserver. Les chaînes sont échappées par JSON.stringify (forme bien formée).
//
// FAITS BOOLÉENS (v0.63.51, point vérifié par test) : un fait valant false n'est supprimé que lorsque TOUS les consommateurs du dépôt le traitent
// exactement comme absent. Mesuré :
//   - CÔTÉ ENTRÉE (omissible, peutEtreNull, collectif, à la racine d'une entrée ou sur ses champs) : tous les consommateurs (relation de garantie,
//     regroupement des candidats, conformité, possibilités, applications sollicitables, validation des formes) les lisent par « === true » ou
//     « !== true » : false et absent sont équivalents. Un fait false d'ENTRÉE est donc SUPPRIMÉ ; un fait true est CONSERVÉ.
//   - CÔTÉ SORTIE (peutManquer, peutEtreNull sur les champs de la sortie) : l'équivalence est FAUSSE pour un champ exposé comme sous-donnée α2 :
//     la forme d'une sous-donnée recopie les faits du champ à sa racine, et un fait (même false) à la racine d'une forme de donnée est refusé en
//     aval par le calcul des possibilités. « peutManquer: false » explicite sur un champ exposé n'est donc PAS équivalent à son absence (test E2).
//     Les faits de SORTIE sont conservés TELS QUELS (true ET false) : une écriture explicite de false côté sortie change l'empreinte (refus prudent,
//     jamais une équivalence non démontrée).
// Les noms d'entrées et de champs ne sont jamais des faits, même s'ils portent le même nom : seules les clés d'une FORME sont examinées.
//
// VALIDATION : catalogue = tableau dense ; chaque description validée par validerDescripteurOperation (TypeError : clé inconnue, forme invalide,
// fait invalide, nom vide…) ; deux descriptions de même nom : TypeError. Rien n'est réparé ni ignoré. Aucune mutation (catalogue gelé accepté).
// PURETÉ : aucune horloge, aucun identifiant généré, aucun magasin, aucune écriture, aucun état global. NON BRANCHÉ : aucun mécanisme du dépôt
// n'importe ce fichier ; rien n'est persisté ; aucune observation n'est modifiée ni refusée ; aucune empreinte n'est jamais calculée pour une
// observation ancienne.
import { validerDescripteurOperation } from './formes-operation.js';
import { sha256Hex } from './sha256.js';

const FAITS_ENTREE = ['omissible', 'peutEtreNull', 'collectif']; // false = absent pour tous les consommateurs : supprimé
const FAITS_SORTIE = ['peutManquer', 'peutEtreNull'];            // conservés tels quels (voir plus haut)
const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function lireRang(tableau, rang) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) throw new TypeError(`empreintesDesContrats : descriptions[${rang}] est absent (tableau creux).`);
  if (!('value' in place)) throw new TypeError(`empreintesDesContrats : descriptions[${rang}] est un accesseur : une donnée est attendue.`);
  return place.value;
}

// Une FORME (objet de forme validé) : clés triées ; `champs` est une table de noms vers des formes (noms conservés tels quels).
// cote = 'entree' (faits false supprimés) ou 'sortie' (faits conservés tels quels).
function canoniserForme(forme, cote) {
  const sortie = {};
  for (const cle of Object.keys(forme).sort(comparer)) {
    const valeur = forme[cle];
    if (cle === 'champs') {
      const champs = {};
      for (const nom of Object.keys(valeur).sort(comparer)) champs[nom] = canoniserForme(valeur[nom], cote);
      sortie.champs = champs;
    } else if (cle === 'elements') {
      sortie.elements = canoniserForme(valeur, cote);
    } else if (cote === 'entree' && FAITS_ENTREE.includes(cle)) {
      if (valeur === true) sortie[cle] = true; // false : supprimé (équivalent à absent pour tous les consommateurs d'entrée)
    } else if (cote === 'sortie' && FAITS_SORTIE.includes(cle)) {
      sortie[cle] = valeur;
    } else {
      sortie[cle] = valeur; // forme, genre : chaînes
    }
  }
  return sortie;
}

export function contratCanonique(description) {
  const valide = validerDescripteurOperation(description);
  const entrees = {};
  for (const nom of Object.keys(valide.entrees).sort(comparer)) entrees[nom] = canoniserForme(valide.entrees[nom], 'entree');
  return JSON.stringify({ entrees, nom: valide.nom, sortie: canoniserForme(valide.sortie, 'sortie') });
}

export function empreintesDesContrats(descriptions) {
  if (!Array.isArray(descriptions)) throw new TypeError('empreintesDesContrats : descriptions doit être un tableau de descripteurs d\'opération.');
  const noms = new Set();
  const resultat = [];
  for (let rang = 0; rang < descriptions.length; rang += 1) {
    const description = lireRang(descriptions, rang);
    let canonique;
    try {
      canonique = contratCanonique(description);
    } catch (erreur) {
      throw new TypeError(`empreintesDesContrats : descriptions[${rang}] : ${erreur.message}`);
    }
    const nom = JSON.parse(canonique).nom;
    if (noms.has(nom)) throw new TypeError(`empreintesDesContrats : deux descriptions portent le même nom (rang ${rang}).`);
    noms.add(nom);
    resultat.push({ operation: nom, empreinte: sha256Hex(canonique) });
  }
  return resultat.sort((a, b) => comparer(a.operation, b.operation));
}
// === FIN_LANGAGE_EMPREINTE_CONTRATS ===
