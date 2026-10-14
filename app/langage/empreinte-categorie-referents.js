// === DEBUT_LANGAGE_EMPREINTE_CATEGORIE_REFERENTS ===
// v0.64.11 — « CONTRAT DE REPRÉSENTATION DE LA CATÉGORIE RÉFÉRENTS DE SUITES » (décision ChatGPT « v0.64.11 », 14/10/2026). PRIMITIVE PURE, SYNCHRONE.
// Même concept, même support, même canonisation que les catégories « entrées d'une production » (v0.63.56) et « message » (v0.63.65) : le CONTRAT DE
// REPRÉSENTATION D'UNE CATÉGORIE DE DONNÉES ; l'empreinte qui en résulte est une ENTRÉE de plus de empreintesCategoriesDonnees.
// Elle répond à UNE seule question : « le contrat MÉCANIQUE qui fait d'un référent de suite acquis une donnée { identité, forme, valeur accessible } est-il le même ? »
// Elle n'atteste NI combien de référents existent, NI lesquels, NI qu'une adresse est acquise : elle est identique avec 0, 1 ou N référents.
//
// CE QUI EST EMPREINTÉ :
//   { categorie, identite: { prefixe, sondes }, forme: { operation, chemin }, acces }
//   - prefixe : PREFIXE_REFERENT_SUITE, lu dans donnees-referents-suites.js (source unique) ;
//   - sondes : la CONVENTION d'adresse OBSERVÉE, pas décrite : pour une liste FIXE d'adresses-chaînes, ce que rend RÉELLEMENT
//     adresseDuReferent(referentDepuisAdresse(a)) (l'adresse relue) ou null si l'adresse est refusée. Toute dérive de l'encodage, du décodage ou
//     de la canonicité change une sonde. Seules des CHAÎNES y figurent (la canonisation des contrats écrit les nombres par JSON : -0 y deviendrait 0 ;
//     une adresse, elle, est une chaîne fidèle) ;
//   - forme : la RÈGLE qui donne la forme (opération + chemin dans son descripteur), pas la forme elle-même : la forme est déjà attestée par
//     l'empreinte de l'opération produireSuitesFermees (empreintesOperationsExaminees) quand elle est décrite ; la règle reste constante qu'elle le soit
//     ou non ;
//   - acces : ACCES_VALEUR_DONNEE, l'accès que la vue et la résolution rendent.
// NON EMPREINTÉS : le code, les référents présents, les lignes persistées, le catalogue, SHA-256, un numéro de version.
// CANONISATION : canoniserContratCategorie (v0.63.56, non réimplémentée) ; EMPREINTE : sha256Hex (v0.63.51), 64 hexadécimaux minuscules.
// API : CATEGORIE_REFERENTS_SUITES ; contratReferentsSuites() -> objet NEUF ; canoniqueContratReferentsSuites() ; empreinteContratReferentsSuites().
import { sha256Hex } from './sha256.js';
import { canoniserContratCategorie } from './empreinte-categorie-entrees.js';
import { ACCES_VALEUR_DONNEE } from './valeur-donnee.js';
import { PREFIXE_REFERENT_SUITE, adresseDuReferent, referentDepuisAdresse } from './donnees-referents-suites.js';

// Nom de la catégorie : défini ICI, une seule fois ; le contrat empreinté et la preuve persistée l'utilisent tous deux.
export const CATEGORIE_REFERENTS_SUITES = 'referents-de-suites';
const OPERATION_SOURCE = 'produireSuitesFermees';
const CHEMIN_FORME = Object.freeze(['sortie', 'elements', 'champs', 'contenu']);

const copie = (valeur) => JSON.parse(JSON.stringify(valeur));
const essai = (f) => { try { return f(); } catch (erreur) { if (erreur instanceof TypeError) return null; throw erreur; } };
// Adresses FIXES sondées : valides (chaîne, chaîne vide, deux chaînes, séparateurs et préfixe imité dans la charge, Unicode et paire UTF-16, nombres
// dont 0 et -0, décimal, extrême, booléens, mélange typé) et invalides (hors espace, préfixe voisin, reste vide, étiquette inconnue, longueur non
// canonique ou tronquée, charge numérique non canonique, booléen invalide, NaN).
const ADRESSES_SONDEES = [
  `${PREFIXE_REFERENT_SUITE}c1:bc1:oc1:n`, `${PREFIXE_REFERENT_SUITE}c0:`, `${PREFIXE_REFERENT_SUITE}c0:c0:`, `${PREFIXE_REFERENT_SUITE}c5:a:b|c`,
  `${PREFIXE_REFERENT_SUITE}c16:referent-suite:x`, `${PREFIXE_REFERENT_SUITE}c1:éc2:😀`, `${PREFIXE_REFERENT_SUITE}n1:0`, `${PREFIXE_REFERENT_SUITE}n2:-0`,
  `${PREFIXE_REFERENT_SUITE}n4:-1.5`, `${PREFIXE_REFERENT_SUITE}n5:1e+21`, `${PREFIXE_REFERENT_SUITE}b1:1b1:0`, `${PREFIXE_REFERENT_SUITE}n1:7c1:7`,
  'x', 'referent-suit:c1:a', PREFIXE_REFERENT_SUITE, `${PREFIXE_REFERENT_SUITE}x1:a`, `${PREFIXE_REFERENT_SUITE}c01:a`, `${PREFIXE_REFERENT_SUITE}c5:a`,
  `${PREFIXE_REFERENT_SUITE}n3:1.0`, `${PREFIXE_REFERENT_SUITE}n3:1e3`, `${PREFIXE_REFERENT_SUITE}b1:2`, `${PREFIXE_REFERENT_SUITE}n3:NaN`,
];

function sondesIdentite() {
  return ADRESSES_SONDEES.map((adresse) => ({ adresse, relue: essai(() => adresseDuReferent(referentDepuisAdresse(adresse))) }));
}

export function contratReferentsSuites() {
  return {
    categorie: CATEGORIE_REFERENTS_SUITES,
    identite: { prefixe: PREFIXE_REFERENT_SUITE, sondes: sondesIdentite() },
    forme: { operation: OPERATION_SOURCE, chemin: [...CHEMIN_FORME] },
    acces: copie(ACCES_VALEUR_DONNEE),
  };
}

export function canoniqueContratReferentsSuites() {
  return canoniserContratCategorie(contratReferentsSuites());
}

export function empreinteContratReferentsSuites() {
  return sha256Hex(canoniqueContratReferentsSuites());
}
// === FIN_LANGAGE_EMPREINTE_CATEGORIE_REFERENTS ===
