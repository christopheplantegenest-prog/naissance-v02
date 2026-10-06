// === DEBUT_LANGAGE_EMPREINTE_CATEGORIE_ENTREES ===
// v0.63.56 — « EMPREINTE DU CONTRAT DE LA CATÉGORIE « ENTRÉES D'UNE PRODUCTION » » (décision ChatGPT, 06/10/2026). PRIMITIVE PURE, SYNCHRONE, DORMANTE.
// Elle répond à UNE seule question : « le contrat MÉCANIQUE de la catégorie de données adjacente « entrées d'une production » est-il le même ? »
// Raison d'être : une dérive NEUTRE de la forme (mêmes atomes, forme différente) était reconstruite comme « fidèle » (v0.63.55, démontré). Une
// empreinte différente rend cette dérive détectable. Ici : calcul seulement. Aucune persistance, aucune vérification historique, aucun snapshot.
//
// CE QUI EST EMPREINTÉ (le contrat de REPRÉSENTATION, pas son implémentation) :
//   { categorie, identite: { prefixe, sondes }, forme, acces }
//   - prefixe : PREFIXE_IDENTITE_ENTREES, lu dans entrees-donnee.js (source unique, jamais recopié ici) ;
//   - sondes : la CONVENTION d'identité observée, pas décrite : pour une liste FIXE de chaînes, ce que rendent réellement les fonctions de
//     entrees-donnee.js (dérivée ou refus, reconnue ou non, inverse ou refus). Si la règle (domaine, image, inverse) change, une sonde change ;
//     aucun texte documentaire ne peut diverger de l'implémentation ;
//   - forme : FORME_ENTREES_PRODUCTION, celle que la résolution copie, copiée ici telle quelle (aucune normalisation : toute différence de
//     représentation, y compris un fait « false » ajouté, change l'empreinte — protection volontairement stricte) ;
//   - acces : ACCES_ENTREES_PRODUCTION, celui que la résolution rend.
// NON EMPREINTÉS : le code des fonctions, la valeur des données, les lignes persistées, le catalogue d'opérations, les empreintes d'opérations,
// SHA-256 lui-même, un numéro de version, des commentaires, des noms de fichiers, des horodatages.
//
// CANONISATION (minimale, locale : la canonisation des descripteurs d'opération (v0.63.51) est propre aux descripteurs d'opération, on ne la détourne pas) :
// objets : clés triées par unités de code (l'ordre de construction est sans effet) ; tableaux : ordre conservé ; chaînes, booléens, nombres finis
// et null seulement ; tout autre type (undefined, fonction, symbole, accesseur, nombre non fini, objet non simple, tableau creux) est refusé.
// La chaîne canonique est écrite à la main (jamais l'ordre d'insertion de JSON.stringify). Objets gelés acceptés ; rien n'est muté.
// EMPREINTE : sha256Hex (v0.63.51, non réimplémenté) de la chaîne canonique : SHA-256 complet, 64 hexadécimaux minuscules.
//
// API : contratEntreesProduction() -> objet NEUF du contrat ; canoniserContratCategorie(contrat) -> chaîne canonique d'un contrat FOURNI
// (utile aux variantes, ne touche à aucune constante) ; canoniqueContratEntreesProduction() ; empreinteContratEntreesProduction().
import { sha256Hex } from './sha256.js';
import {
  PREFIXE_IDENTITE_ENTREES,
  FORME_ENTREES_PRODUCTION,
  ACCES_ENTREES_PRODUCTION,
  estIdentiteEntrees,
  identiteEntreesProduction,
  productionDesEntrees,
} from './entrees-donnee.js';

const NOM = 'canoniserContratCategorie';
const refuser = (raison) => { throw new TypeError(`${NOM} : ${raison}.`); };
const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function lire(objet, cle, chemin) {
  const place = Object.getOwnPropertyDescriptor(objet, cle);
  if (place === undefined) refuser(`${chemin} : champ « ${String(cle)} » illisible`);
  if (!('value' in place)) refuser(`${chemin}.${String(cle)} est un accesseur : une donnée est attendue`);
  return place.value;
}

function canoniser(valeur, chemin) {
  if (valeur === null) return 'null';
  switch (typeof valeur) {
    case 'string': return JSON.stringify(valeur);
    case 'boolean': return valeur ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(valeur)) refuser(`${chemin} : nombre non fini`);
      return JSON.stringify(valeur);
    case 'object': break;
    default: refuser(`${chemin} : type « ${typeof valeur} » non canonisable`);
  }
  if (Array.isArray(valeur)) {
    const elements = [];
    for (let rang = 0; rang < valeur.length; rang += 1) elements.push(canoniser(lire(valeur, String(rang), chemin), `${chemin}[${rang}]`));
    return `[${elements.join(',')}]`;
  }
  const proto = Object.getPrototypeOf(valeur);
  if (proto !== Object.prototype && proto !== null) refuser(`${chemin} : objet non simple`);
  if (Object.getOwnPropertySymbols(valeur).length > 0) refuser(`${chemin} : clé symbole`);
  const morceaux = [];
  for (const cle of Object.keys(valeur).sort(comparer)) morceaux.push(`${JSON.stringify(cle)}:${canoniser(lire(valeur, cle, chemin), `${chemin}.${cle}`)}`);
  return `{${morceaux.join(',')}}`;
}

export function canoniserContratCategorie(contrat) {
  if (contrat === null || typeof contrat !== 'object' || Array.isArray(contrat)) refuser('le contrat doit être un objet');
  return canoniser(contrat, 'contrat');
}

const copie = (valeur) => JSON.parse(JSON.stringify(valeur));
const essai = (f) => { try { return f(); } catch (erreur) { if (erreur instanceof TypeError) return null; throw erreur; } };
// Chaînes FIXES sondées : hors domaine, domaine simple, domaine avec séparateur, chaîne vide, préfixe seul, préfixe + reste, double préfixe.
const CHAINES_SONDEES = ['x', 'a:b', '', PREFIXE_IDENTITE_ENTREES, `${PREFIXE_IDENTITE_ENTREES}x`, `${PREFIXE_IDENTITE_ENTREES}${PREFIXE_IDENTITE_ENTREES}x`, `${PREFIXE_IDENTITE_ENTREES}a:b`];

function sondesIdentite() {
  return CHAINES_SONDEES.map((chaine) => ({
    chaine,
    derivee: essai(() => identiteEntreesProduction(chaine)),
    reconnue: estIdentiteEntrees(chaine),
    inverse: essai(() => productionDesEntrees(chaine)),
  }));
}

export function contratEntreesProduction() {
  return {
    categorie: 'entrees-de-production',
    identite: { prefixe: PREFIXE_IDENTITE_ENTREES, sondes: sondesIdentite() },
    forme: copie(FORME_ENTREES_PRODUCTION),
    acces: copie(ACCES_ENTREES_PRODUCTION),
  };
}

export function canoniqueContratEntreesProduction() {
  return canoniserContratCategorie(contratEntreesProduction());
}

export function empreinteContratEntreesProduction() {
  return sha256Hex(canoniqueContratEntreesProduction());
}
// === FIN_LANGAGE_EMPREINTE_CATEGORIE_ENTREES ===
