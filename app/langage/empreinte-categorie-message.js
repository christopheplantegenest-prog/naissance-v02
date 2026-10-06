// === DEBUT_LANGAGE_EMPREINTE_CATEGORIE_MESSAGE ===
// v0.63.65 — « CONTRAT DE REPRÉSENTATION DE LA CATÉGORIE MESSAGE » (décision ChatGPT, 06/10/2026). PRIMITIVE PURE, SYNCHRONE, DORMANTE.
// Même concept, même support, même canonisation que la catégorie « entrées d'une production » (v0.63.56) : le CONTRAT DE REPRÉSENTATION D'UNE CATÉGORIE DE DONNÉES.
// Ce n'est ni une famille de preuves de plus, ni un champ d'observation de plus : l'empreinte qui en résulte est une ENTRÉE de plus de empreintesCategoriesDonnees.
// Elle répond à UNE seule question : « le contrat MÉCANIQUE qui fait d'un message une donnée { identité, forme, valeur accessible } est-il le même ? »
// Raison d'être : la forme déclarée de la source message peut dériver SANS changer aucun atome (démontré, diagnostic v0.63.64) ; une empreinte différente rend cette dérive visible.
//
// CE QUI EST EMPREINTÉ (le contrat de REPRÉSENTATION, pas son implémentation) :
//   { categorie, identite: { sondes }, forme, acces: { vivant, historique } }
//   - forme : DESCRIPTION_SOURCE_MESSAGE.forme, lue dans source-message.js (source unique), copiée telle quelle (aucune normalisation) ;
//   - acces.vivant : DESCRIPTION_SOURCE_MESSAGE.acces (OÙ se trouve la valeur dans le message vivant, tel que l'observation l'utilise), copié tel quel ;
//   - acces.historique : ACCES_VALEUR_DONNEE, lu dans valeur-donnee.js (OÙ se trouve la valeur dans la ligne historique { id, valeur }, telle que la résolution
//     historique l'utilise), copié tel quel ;
//   - identite.sondes : la CONVENTION d'identité OBSERVÉE, pas décrite : pour une liste FIXE d'objets sources, ce que rend réellement donneeDeSource (v0.63.15,
//     le mécanisme d'identité réellement utilisé par l'observation vivante ET par la résolution historique) : l'identité reconnue, ou null s'il la refuse. Si cette
//     règle change (trim, coercition, nouvelle contrainte), une sonde change ; aucun texte documentaire ne peut diverger de l'implémentation.
// IDENTITÉ : INCLUSE sous cette seule forme (sondes de donneeDeSource). Restent HORS contrat, volontairement : (a) la GÉNÉRATION des identités de message
// (identifierMessage et son préfixe vivent dans le pont, couche vivante : les importer ferait dépendre une primitive dormante du flux vivant, et leur préfixe est
// une règle de naissance, pas de représentation) ; (b) le refus, par l'observation, des identités du préfixe réservé aux entrées (garde de l'observateur, qui
// relève du contrat de la catégorie entrées) ; (c) la correspondance identité de donnée = id de la ligne historique, qui est une
// égalité de chaînes de la résolution d'identités, sans forme propre. Rien de cela n'est décrit ici : aucune pseudo-règle inventée.
// NON EMPREINTÉS : le code des fonctions, la valeur des messages, les lignes persistées, le catalogue, les empreintes d'opérations, SHA-256, un numéro de version.
//
// CANONISATION : celle de canoniserContratCategorie (v0.63.56, non réimplémentée) ; EMPREINTE : sha256Hex (v0.63.51) de la chaîne canonique, 64 hexadécimaux minuscules.
// API : CATEGORIE_MESSAGE ; contratMessage() -> objet NEUF ; canoniqueContratMessage() ; empreinteContratMessage().
import { sha256Hex } from './sha256.js';
import { canoniserContratCategorie } from './empreinte-categorie-entrees.js';
import { DESCRIPTION_SOURCE_MESSAGE } from './source-message.js';
import { ACCES_VALEUR_DONNEE } from './valeur-donnee.js';
import { donneeDeSource } from './donnee-de-source.js';

// Nom de la catégorie : défini ICI, une seule fois ; le contrat empreinté et la preuve persistée l'utilisent tous deux.
export const CATEGORIE_MESSAGE = 'message';

const copie = (valeur) => JSON.parse(JSON.stringify(valeur));
const essai = (f) => { try { return f(); } catch (erreur) { if (erreur instanceof TypeError) return null; throw erreur; } };
// Sources FIXES sondées : identité simple, chaîne vide, espaces autour (trim ?), séparateur, identité non chaîne (coercition ?).
const SOURCES_SONDEES = [{ id: 'x' }, { id: '' }, { id: ' x ' }, { id: 'a:b' }, { id: 1 }];

function sondesIdentite() {
  return SOURCES_SONDEES.map((source) => ({
    id: source.id,
    identite: essai(() => donneeDeSource(source, DESCRIPTION_SOURCE_MESSAGE).identite),
  }));
}

export function contratMessage() {
  return {
    categorie: CATEGORIE_MESSAGE,
    identite: { sondes: sondesIdentite() },
    forme: copie(DESCRIPTION_SOURCE_MESSAGE.forme),
    acces: { vivant: copie(DESCRIPTION_SOURCE_MESSAGE.acces), historique: copie(ACCES_VALEUR_DONNEE) },
  };
}

export function canoniqueContratMessage() {
  return canoniserContratCategorie(contratMessage());
}

export function empreinteContratMessage() {
  return sha256Hex(canoniqueContratMessage());
}
// === FIN_LANGAGE_EMPREINTE_CATEGORIE_MESSAGE ===
