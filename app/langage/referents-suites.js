// === DEBUT_LANGAGE_REFERENTS_SUITES ===
// v0.64.9 — « UNE INTENSION DÉCOUVERTE COMME RÉFÉRENT » (autorisation ChatGPT « v0.64.9 », 13/10/2026). MODULE PUR, SYNCHRONE, DÉTERMINISTE, DORMANT.
// Il isole UNE seule chose, sur UN seul cas (les suites fermées) :
//
//   découverte collective -> intension autonome de suite -> identité par intension -> redécouverte comme même intension
//   -> manifestations explicitement rattachées à cette intension.
//
// RÉFÉRENT DE SUITE = { suite: S } — S = le contenu d'une suite fermée, tel quel (copie neuve, gelée). La clé « suite » nomme la SORTE.
//   Aucune autre clé : ni preuve, ni couverture, ni occurrence, ni témoin, ni production de découverte, ni position, ni horodatage, ni domaine.
//   IDENTITÉ = l'intension elle-même (valeur structurée ; aucune sérialisation, aucun hash, aucun id).
//   MÊME RÉFÉRENT <=> même sorte, même longueur, symboles terme à terme de même type ET égaux par Object.is (7 ≠ "7", true ≠ "true", 0 ≠ -0).
//   DOMAINE : aucun. Même contenu typé = même intension, quelle que soit la provenance (contrat des consommateurs actuels, conservé tel quel).
//
// AUCUNE DÉFINITION PROPRE (ni du domaine des symboles, ni de l'égalité) : ce module DÉLÈGUE aux deux primitives existantes, sans les modifier.
//   - « S est une suite » : S est un tableau, et produireSuitesFermees([{ chemin, contenu: S }]) rend une suite de contenu égal à S (la suite
//     entière d'un élément seul est toujours fermée ; un symbole hors domaine — null, objet, tableau imbriqué : barrière ; nombre non fini,
//     tableau creux, accesseur : refus du parcours — empêche S d'y figurer entière). Contenu vide : aucune suite, donc refusé.
//   - « S1 = S2 » : même longueur ET rechercherSousSuites([S1], [{ chemin, contenu: S2 }]) trouve S1 au début 0 de S2 (égalité terme à terme
//     de rechercherSousSuites : même type ET Object.is, celle de suites-fermees).
//   Ainsi il n'existe toujours qu'UNE sémantique des suites, celle des deux modules existants.
//
// referentDeSuite(contenu) -> référent gelé neuf ; TypeError si contenu n'est pas une suite.
// memeReferent(r1, r2) -> booléen ; TypeError si l'un n'est pas un référent de suite valide.
// resoudreReferent(r) -> copie NEUVE (non gelée) de S. L'adresse contient l'intension : ni porteur, ni table, ni recherche.
// referentsDecouverts(sortie) -> [référents] : sortie = collection d'items { contenu, … } (forme de la sortie de produireSuitesFermees, ou
//   plusieurs sorties concaténées). SEUL `contenu` est lu (ni occurrences, ni couverture : la preuve n'entre pas). Un référent par intension :
//   les contenus égaux sont réunis, les contenus différents jamais. ORDRE SANS SIGNIFICATION (celui de la première rencontre ; aucune lecture
//   ne doit en dépendre : les tests comparent des ensembles).
// manifestationsDuReferent(r, elements) -> [{ referent, element, debut }] : les occurrences rendues par rechercherSousSuites([S], elements),
//   chacune portant ELLE-MÊME son intension (`referent` : le référent canonique gelé, le même objet pour toutes) ; `element` : copie neuve du
//   chemin de l'élément ; `debut` : position. Le rattachement ne dépend ni d'une collection M, ni d'un indice, ni de la preuve de découverte.
//   Ordre : celui de rechercherSousSuites, sans signification. Rien n'est persisté.
//
// LIMITE EXPLICITE : le référent est ici une VALEUR autonome, qu'une manifestation calculée peut porter. Ce n'est PAS une référence utilisable
//   par les liaisons de la boucle générale : il n'est ni une donnée de l'univers du tour, ni observable, ni proposé comme possibilité de liaison,
//   ni sollicitable, ni exécutable, et aucun fait persisté ne le référence.
// ERREURS : TypeError, aucun résultat partiel ; les erreurs des primitives déléguées se propagent telles quelles.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
// NON BRANCHÉ : aucun fichier de app/ n'importe ce module (gardé par test).
import { produireSuitesFermees } from './suites-fermees.js';
import { rechercherSousSuites } from './rechercher-sous-suites.js';

const NOM = 'referents-suites';
const CHEMIN_LOCAL = ['referent'];

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lirePropre(objet, champ, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

// Égalité de deux suites DÉJÀ validées : celle de rechercherSousSuites, à longueur égale.
function memesSuites(a, b) {
  if (a.length !== b.length) return false;
  const [trouve] = rechercherSousSuites([a], [{ chemin: CHEMIN_LOCAL, contenu: b }]);
  return trouve.occurrences.length > 0;
}

// S est-elle une suite au sens de produireSuitesFermees ? Rend une copie neuve dense de S, ou lève.
function suiteValidee(contenu, nom) {
  if (!Array.isArray(contenu)) refuser(`${nom} doit être une collection de symboles`);
  const copie = [];
  for (let k = 0; k < contenu.length; k += 1) copie.push(lirePropre(contenu, String(k), nom));
  const suites = produireSuitesFermees([{ chemin: CHEMIN_LOCAL, contenu: copie }]);
  if (!suites.some((s) => memesSuites(s.contenu, copie))) refuser(`${nom} n'est pas une suite (contenu vide, ou symbole hors du domaine des suites fermées)`);
  return copie;
}

function geler(suite) {
  return Object.freeze({ suite: Object.freeze(suite) });
}

function lireReferent(r, nom) {
  if (r === null || typeof r !== 'object' || Array.isArray(r)) refuser(`${nom} doit être un référent { suite }`);
  const cles = Reflect.ownKeys(r);
  if (cles.length !== 1 || cles[0] !== 'suite') refuser(`${nom} doit porter exactement la clé « suite »`);
  return suiteValidee(lirePropre(r, 'suite', nom), `${nom}.suite`);
}

export function referentDeSuite(contenu) {
  return geler(suiteValidee(contenu, 'contenu'));
}

export function memeReferent(r1, r2) {
  return memesSuites(lireReferent(r1, 'r1'), lireReferent(r2, 'r2'));
}

export function resoudreReferent(r) {
  return lireReferent(r, 'r');
}

export function referentsDecouverts(sortie) {
  if (!Array.isArray(sortie)) refuser('sortie doit être une collection d\'items { contenu }');
  const referents = [];
  for (let rang = 0; rang < sortie.length; rang += 1) {
    const item = lirePropre(sortie, String(rang), 'sortie');
    if (item === null || typeof item !== 'object' || Array.isArray(item)) refuser(`sortie[${rang}] doit être un objet`);
    const suite = suiteValidee(lirePropre(item, 'contenu', `sortie[${rang}]`), `sortie[${rang}].contenu`);
    if (!referents.some((r) => memesSuites(r.suite, suite))) referents.push(geler(suite));
  }
  return referents;
}

export function manifestationsDuReferent(r, elements) {
  const referent = geler(lireReferent(r, 'r'));
  const [trouve] = rechercherSousSuites([resoudreReferent(referent)], elements);
  return trouve.occurrences.map((o) => ({ referent, element: [...o.element], debut: o.debut }));
}
// === FIN_LANGAGE_REFERENTS_SUITES ===
