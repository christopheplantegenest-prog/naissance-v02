// === DEBUT_LANGAGE_GARANTIE_FORME ===
// v0.62.8 -- ÉTAPE 6 : « FORME FOURNIE -> FORME ATTENDUE » (décision ChatGPT, 04/10/2026, après spécification).
// MODULE PUR ET DORMANT. Il répond à UNE seule question, sur DEUX formes du langage de formes-operation.js :
//
//   « la forme fournie garantit-elle ce que réclame la forme attendue ? »  -> true | false
//
// Il ne parle jamais d'opérations : il ne connaît que deux formes.
//
// ARGUMENTS : deux formes de v0.62.7, chacune pouvant porter à sa racine les faits d'un champ (elle peut venir
// d'un champ extrait d'un descripteur) :
//   fournie  : faits permis peutManquer, peutEtreNull ; le fait omissible est refusé.
//   attendue : faits permis omissible et (v0.63.3) peutEtreNull ; peutManquer est refusé.
// VALIDATION : déléguée EXACTEMENT à validerDescripteurOperation (aucune seconde validation). Chaque argument est
// enveloppé comme champ d'un descripteur jetable, ce qui donne le contrôle des formes, des cycles, du côté des
// faits et une copie indépendante. Une entrée invalide lève un TypeError ; elle n'est jamais transformée en false.
//
// RELATION : un ET de règles, lues sur les copies validées. Un fait absent a le même sens que false.
//   R0  paire de champs : fournie peutEtreNull vrai ET attendue non peutEtreNull -> false (v0.63.3 : l'attendue peut
//       désormais déclarer qu'elle accepte null ; le fournisseur qui peut produire null n'est garanti que face à une attendue
//       qui l'accepte). Fournie peutManquer vrai ET attendue non omissible -> false. Les deux tests sont INDÉPENDANTS
//       (absent ≠ null). Accepter null ne rend jamais conciliables deux formes qui diffèrent : R1..R4 s'appliquent ensuite
//       sans changement. Les éléments de collection ne portent aucun fait.
//   R-Q (v0.63.3) forme `quelconque` : une attendue `quelconque` ne contraint pas la valeur -> true pour toute forme fournie
//       (scalaire, objet, collection, quelconque), sous réserve de R0. Une fournie `quelconque` face à toute attendue
//       qui n'est pas `quelconque` -> false (R1 : formes différentes) : une valeur non contrainte ne garantit rien de plus
//       précis. `quelconque` ne dit rien de la nullité : null reste gouverné par R0 seul.
//   R1  formes différentes -> false (aucune conversion d'une forme en une autre).
//   R2  scalaire : attendue sans genre -> true. Sinon la fournie doit avoir le MÊME genre (sans genre -> false).
//       Aucune coercition.
//   R3  objet : attendue sans champs ou à champs vides -> true. Sinon chaque champ déclaré par l'attendue doit
//       être déclaré par la fournie, qu'il soit omissible ou non (absent -> false). Un champ présent des deux
//       côtés suit R0 puis la comparaison récursive. Les champs en plus de la fournie sont ignorés.
//       Le fait omissible n'autorise jamais d'ignorer la forme d'un champ, seulement son absence dans une valeur.
//   R4  collection : attendue sans éléments décrits -> true. Fournie sans éléments décrits face à une attendue
//       qui en décrit -> false. Sinon comparaison récursive des éléments.
//
// INDÉPENDANCE : une seule importation (validerDescripteurOperation). Aucun accès magasin, aucune exécution,
// aucune modification des arguments. Le résultat est exactement true ou false.
import { validerDescripteurOperation } from './formes-operation.js';

function lireFournie(fournie) {
  const copie = validerDescripteurOperation({ nom: 'garantie', entrees: {}, sortie: { forme: 'objet', champs: { x: fournie } } });
  return copie.sortie.champs.x;
}
function lireAttendue(attendue) {
  const copie = validerDescripteurOperation({ nom: 'garantie', entrees: { x: attendue }, sortie: { forme: 'scalaire' } });
  return copie.entrees.x;
}

function champGarantit(f, a) {
  if (f.peutEtreNull === true && a.peutEtreNull !== true) return false;
  if (f.peutManquer === true && a.omissible !== true) return false;
  return formeGarantit(f, a);
}

function formeGarantit(f, a) {
  if (a.forme === 'quelconque') return true;
  if (f.forme !== a.forme) return false;
  if (a.forme === 'scalaire') return a.genre === undefined || f.genre === a.genre;
  if (a.forme === 'objet') {
    if (a.champs === undefined) return true;
    for (const nom of Object.keys(a.champs)) {
      if (f.champs === undefined || !Object.hasOwn(f.champs, nom)) return false;
      if (!champGarantit(f.champs[nom], a.champs[nom])) return false;
    }
    return true;
  }
  if (a.elements === undefined) return true;
  if (f.elements === undefined) return false;
  return formeGarantit(f.elements, a.elements);
}

export function fournieGarantitAttendue(fournie, attendue) {
  const f = lireFournie(fournie);
  const a = lireAttendue(attendue);
  return champGarantit(f, a);
}
// === FIN_LANGAGE_GARANTIE_FORME ===
