// === DEBUT_LANGAGE_DONNEES_REFERENTS_SUITES ===
// v0.64.10 — « LE RÉFÉRENT DE SUITE SATISFAIT LE CONTRAT DE DONNÉE » (autorisation ChatGPT « v0.64.10 », 14/10/2026). MODULE PUR, DORMANT.
// Il démontre UNE chose, sur le seul cas des référents de suites .64.9 :
//
//   intension découverte -> unité trans-événements -> adresse technique canonique -> donnée valide selon le contrat EXISTANT
//   { identite: chaîne non vide, forme } (celui de la primitive des possibilités de liaison), SANS l'ajouter à l'univers réel.
//
// AUTORITÉ COGNITIVE : memeReferent (.64.9) reste SEUL juge de « même référent ». L'adresse n'est qu'un encodage technique FIDÈLE, imposé par
//   le contrat historique « donnee.identite = chaîne » : memeReferent(R1, R2) <=> adresseDuReferent(R1) === adresseDuReferent(R2). Aucun
//   usage cognitif de memeReferent n'est remplacé par une comparaison d'adresses (la vue réunit les référents par referentsDecouverts).
//
// ADRESSE (domaine STRICTEMENT celui de .64.9 : suite non vide de chaînes, nombres finis, booléens) :
//   adresse = "referent-suite:" + code(S[0]) + … + code(S[n-1])
//   code(x) = étiquette + L + ":" + charge   — étiquette : "c" chaîne | "n" nombre | "b" booléen ;
//     charge : chaîne brute | num(x) | "1" (true) / "0" (false) ; L = charge.length en unités UTF-16, décimal canonique ("0" admis, aucun
//     zéro de tête) ; num(x) = "-0" si Object.is(x, -0), sinon String(x) (conversion propre de JavaScript, aller-retour exact sur les finis).
//   Codes AUTO-DÉLIMITÉS (étiquette, chiffres jusqu'au premier ":", puis EXACTEMENT L unités) : découpage unique, donc injectivité ; aucune
//   charge n'est échappée ni parcourue (":", "|", chiffres, Unicode, préfixe imité : sans effet).
//   referentDepuisAdresse(A) refuse : non-chaîne, préfixe absent ou voisin, reste vide, étiquette inconnue, longueur absente / non canonique /
//   dépassant la fin, charge numérique non canonique (num(x) !== charge, ou non finie), booléen autre que "1"/"0", hors domaine .64.9.
//   Aucun JSON, aucun hash, aucun nouvelId, aucun registre, aucune horloge, aucun témoin. Ni l'adresse ni le référent ne lisent la preuve.
//
// donneesDeReferentsDeSuites(lignesExecutions, descriptions) -> [{ donnee: { identite, forme }, porteur: { id, valeur }, acces }]
//   SOURCE : uniquement les exécutions de produireSuitesFermees DÉCRITES dans `descriptions` (même règle que la vue existante des productions
//   décrites : `operation` exactement égale au `nom` d'une description ; non décrite -> non admise ; si l'opération n'est pas décrite, AUCUNE
//   donnée, sans erreur). Leurs `resultat` sont lus et
//   réunis en référents distincts par referentsDecouverts (.64.9 : seuls les contenus ; même S dans E1 et E2 -> UNE donnée).
//   identite = adresseDuReferent(R) ; forme = copie de la forme DÉCLARÉE dans la description réelle (sortie -> elements -> champs -> contenu),
//   jamais déduite de S ; porteur = { id: identite, valeur: S } (ni operation, ni liaisons, ni idExecution : jamais pris pour une ligne
//   d'exécution) ; acces = ACCES_VALEUR_DONNEE ({ champ: 'valeur' }).
//   ORDRE : canonique par identité (unités de code), SANS signification ; il rend la sortie indépendante de l'ordre des lignes.
// resoudreAdresseDeReferent(adresse, descriptions) -> { donnee, porteur, acces } : résolution LOCALE, sans exécutions, manifestations, preuves
//   ni magasin (l'adresse contient l'intension) ; la forme vient du descripteur. Le résolveur général n'est pas modifié.
// LIMITE : ces données ne sont dans AUCUN univers réel ; rien n'est persisté, observé, lié ni exécuté.
// ERREURS : TypeError, aucun résultat partiel. PURETÉ : aucune écriture, aucune lecture de magasin, aucun état ; entrées jamais modifiées.
// NON BRANCHÉ : aucun fichier de app/ n'importe ce module (gardé par test).
import { referentDeSuite, resoudreReferent, referentsDecouverts } from './referents-suites.js';
import { ACCES_VALEUR_DONNEE } from './valeur-donnee.js';

const NOM = 'donnees-referents-suites';
const ESPACE = 'referent-suite:';
const OPERATION = 'produireSuitesFermees';

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

const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const num = (x) => (Object.is(x, -0) ? '-0' : String(x));

function code(symbole) {
  let etiquette;
  let charge;
  if (typeof symbole === 'string') { etiquette = 'c'; charge = symbole; }
  else if (typeof symbole === 'number') { etiquette = 'n'; charge = num(symbole); }
  else if (typeof symbole === 'boolean') { etiquette = 'b'; charge = symbole ? '1' : '0'; }
  else refuser('symbole hors du domaine des suites'); // inaccessible : le domaine est déjà validé par .64.9
  return `${etiquette}${charge.length}:${charge}`;
}

export function adresseDuReferent(referent) {
  const suite = resoudreReferent(referent); // valide le référent par le contrat .64.9
  let adresse = ESPACE;
  for (const symbole of suite) adresse += code(symbole);
  return adresse;
}

function estChiffre(c) {
  return c >= '0' && c <= '9' && c.length === 1;
}

export function referentDepuisAdresse(adresse) {
  if (typeof adresse !== 'string') refuser('une adresse doit être une chaîne');
  if (!adresse.startsWith(ESPACE)) refuser(`adresse hors de l'espace « ${ESPACE} »`);
  let position = ESPACE.length;
  if (position === adresse.length) refuser('adresse sans symbole (suite vide)');
  const suite = [];
  while (position < adresse.length) {
    const etiquette = adresse[position];
    if (etiquette !== 'c' && etiquette !== 'n' && etiquette !== 'b') refuser(`étiquette inconnue à la position ${position}`);
    position += 1;
    const debut = position;
    while (position < adresse.length && estChiffre(adresse[position])) position += 1;
    const chiffres = adresse.slice(debut, position);
    if (chiffres.length === 0) refuser(`longueur absente à la position ${debut}`);
    if (chiffres.length > 1 && chiffres[0] === '0') refuser(`longueur non canonique « ${chiffres} »`);
    if (adresse[position] !== ':') refuser(`« : » attendu à la position ${position}`);
    position += 1;
    const longueur = Number(chiffres);
    if (!Number.isSafeInteger(longueur) || position + longueur > adresse.length) refuser(`longueur ${chiffres} dépassant la fin de l'adresse`);
    const charge = adresse.slice(position, position + longueur);
    position += longueur;
    if (etiquette === 'c') suite.push(charge);
    else if (etiquette === 'b') {
      if (charge !== '1' && charge !== '0') refuser(`charge booléenne invalide « ${charge} »`);
      suite.push(charge === '1');
    } else {
      const x = charge === '-0' ? -0 : Number(charge);
      if (!Number.isFinite(x) || num(x) !== charge) refuser(`charge numérique non canonique « ${charge} »`);
      suite.push(x);
    }
  }
  const referent = referentDeSuite(suite); // domaine .64.9 (délégué à produireSuitesFermees)
  if (adresseDuReferent(referent) !== adresse) refuser('adresse non canonique'); // garde : la représentation est unique
  return referent;
}

// Forme DÉCLARÉE du contenu d'une suite, lue dans la description réelle ; null si l'opération n'est pas décrite.
function formeDeclaree(descriptions) {
  if (!Array.isArray(descriptions)) refuser('descriptions doit être un tableau');
  const description = descriptions.find((d) => d !== null && typeof d === 'object' && Object.hasOwn(d, 'nom') && d.nom === OPERATION);
  if (description === undefined) return null;
  const sortie = lirePropre(description, 'sortie', `description ${OPERATION}`);
  const elements = lirePropre(sortie, 'elements', `${OPERATION}.sortie`);
  const champs = lirePropre(elements, 'champs', `${OPERATION}.sortie.elements`);
  return structuredClone(lirePropre(champs, 'contenu', `${OPERATION}.sortie.elements.champs`));
}

function donneeDe(referent, forme) {
  const identite = adresseDuReferent(referent);
  return { donnee: { identite, forme: structuredClone(forme) }, porteur: { id: identite, valeur: resoudreReferent(referent) }, acces: ACCES_VALEUR_DONNEE };
}

export function donneesDeReferentsDeSuites(lignesExecutions, descriptions) {
  if (!Array.isArray(lignesExecutions)) refuser('lignesExecutions doit être un tableau');
  const forme = formeDeclaree(descriptions);
  if (forme === null) return [];
  const items = [];
  for (const ligne of lignesExecutions) {
    if (lirePropre(ligne, 'operation', 'ligne d\'exécution') !== OPERATION) continue;
    const id = lirePropre(ligne, 'id', 'ligne d\'exécution');
    if (typeof id !== 'string' || id.length === 0) refuser('une ligne d\'exécution doit porter un id non vide');
    const resultat = lirePropre(ligne, 'resultat', `exécution ${id}`);
    if (!Array.isArray(resultat)) refuser(`le résultat de l'exécution ${id} n'est pas une collection`);
    for (const item of resultat) items.push(item);
  }
  return referentsDecouverts(items)
    .map((r) => donneeDe(r, forme))
    .sort((a, b) => comparerCodes(a.donnee.identite, b.donnee.identite));
}

export function resoudreAdresseDeReferent(adresse, descriptions) {
  const forme = formeDeclaree(descriptions);
  if (forme === null) refuser(`${OPERATION} n'est pas décrite : aucune forme de référent`);
  return donneeDe(referentDepuisAdresse(adresse), forme);
}
// === FIN_LANGAGE_DONNEES_REFERENTS_SUITES ===
