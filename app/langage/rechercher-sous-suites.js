// === DEBUT_LANGAGE_RECHERCHER_SOUS_SUITES ===
// v0.63.44 — RECHERCHE MÉCANIQUE DE SOUS-SUITES CONTIGUËS (décision ChatGPT, 06/10/2026, après le cadrage B2).
// FONCTION PURE, SYNCHRONE, SANS ÉTAT. Elle répond à UNE seule question :
//
//   « où chaque liste reçue apparaît-elle, comme sous-suite contiguë, dans le contenu de chaque élément reçu ? »
//
// ENTRÉES : `motifs` (collection de collections de scalaires primitifs) et `elements` (collection d'objets { chemin, contenu }, `chemin` et `contenu`
// étant des collections de scalaires primitifs ; champs en plus tolérés et jamais lus).
// SORTIE : UNE entrée par élément de `motifs`, dans l'ordre reçu :
//
//   { contenu: <la liste reçue, même référence>, occurrences: [ { element: <chemin de l'élément, même référence>, debut: <nombre> } ] }
//
// SÉMANTIQUE : pour chaque liste, dans chaque contenu (ordre des éléments reçus), à CHAQUE position de départ d (0 <= d <= longueur(contenu) - longueur(liste)),
// il y a une occurrence si les scalaires sont égaux terme à terme. Les chevauchements comptent : [a,a] dans [a,a,a] -> débuts 0 et 1. Un contenu ou une liste plus
// courts ne produisent aucune occurrence (jamais d'erreur). Une liste VIDE suit la même définition, sans cas particulier : elle a une occurrence à chaque position
// 0..n (n + 1 occurrences) et, dans un contenu vide, la position 0.
// ÉGALITÉ : celle des primitives actuelles (suites fermées, constats de valeurs) : même type ET Object.is. 7 ≠ "7", true ≠ "true", 0 ≠ -0, NaN = NaN. Les listes se
// comparent terme à terme : jamais concaténées, jamais transformées en chaînes.
// UNE ENTRÉE PAR LISTE REÇUE, même absente (occurrences: []) : l'absence est un constat, jamais une raison de retirer. Les listes dupliquées donnent des entrées
// dupliquées ; deux éléments de même contenu sont traités indépendamment, selon leur `chemin`. Aucun tri, filtre, dédoublonnage, classement, seuil, préférence
// (longueur, fréquence), choix ; aucune lecture de couverture ni d'occurrences ; aucun `parent` (les contenus sont des séquences plates) ; une seule valeur rendue.
// Entrée invalide (non tableau, tableau creux, accesseur, liste non collection ou à scalaire non primitif — null refusé —, élément non objet, `chemin` ou
// `contenu` absent / hérité / accesseur / non collection) : TypeError AVANT tout calcul, aucun résultat partiel. Aucune unicité de `chemin` exigée.
// Ce fichier n'importe RIEN.
const NOM = 'rechercherSousSuites';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireRang(tableau, rang, lieu) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${lieu}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${lieu}[${rang}] est un accesseur (une donnée est attendue)`);
  return place.value;
}

function exigerScalaires(liste, lieu) {
  if (!Array.isArray(liste)) refuser(`${lieu} doit être une collection`);
  for (let k = 0; k < liste.length; k += 1) {
    const symbole = lireRang(liste, k, lieu);
    if (typeof symbole !== 'string' && typeof symbole !== 'number' && typeof symbole !== 'boolean') refuser(`${lieu}[${k}] doit être un scalaire`);
  }
  return liste;
}

function lireChamp(element, cle, lieu) {
  const place = Object.getOwnPropertyDescriptor(element, cle);
  if (place === undefined) refuser(`${lieu} n'a pas de champ « ${cle} » propre`);
  if (!('value' in place)) refuser(`${lieu}.${cle} est un accesseur (une donnée est attendue)`);
  return exigerScalaires(place.value, `${lieu}.${cle}`);
}

export function rechercherSousSuites(motifs, elements) {
  if (!Array.isArray(motifs)) refuser('motifs doit être un tableau');
  if (!Array.isArray(elements)) refuser('elements doit être un tableau');
  const listes = [];
  for (let rang = 0; rang < motifs.length; rang += 1) listes.push(exigerScalaires(lireRang(motifs, rang, 'motifs'), `motifs[${rang}]`));
  const lus = [];
  for (let rang = 0; rang < elements.length; rang += 1) {
    const element = lireRang(elements, rang, 'elements');
    if (element === null || typeof element !== 'object' || Array.isArray(element)) refuser(`elements[${rang}] doit être un objet { chemin, contenu }`);
    lus.push({ chemin: lireChamp(element, 'chemin', `elements[${rang}]`), contenu: lireChamp(element, 'contenu', `elements[${rang}]`) });
  }
  return listes.map((liste) => {
    const occurrences = [];
    for (const { chemin, contenu } of lus) {
      for (let debut = 0; debut + liste.length <= contenu.length; debut += 1) {
        let egal = true;
        for (let j = 0; j < liste.length; j += 1) {
          if (!Object.is(contenu[debut + j], liste[j])) { egal = false; break; }
        }
        if (egal) occurrences.push({ element: chemin, debut });
      }
    }
    return { contenu: liste, occurrences };
  });
}
// === FIN_LANGAGE_RECHERCHER_SOUS_SUITES ===
