// === DEBUT_LANGAGE_APPLICATION_UNIQUE ===
// v0.63.25 — « DÉTERMINER L'UNICITÉ D'UNE APPLICATION » (décision ChatGPT, 05/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question, sur la sortie du module des groupes complets de candidats :
//
//   « l'espace d'applications fourni contient-il ZÉRO, EXACTEMENT UNE, ou PLUSIEURS applications complètes ? »
//
// Une application = une opération + UNE donnée par entrée. Un groupe { operation, entrees: [{ entree, donnees }] } représente
// donc prod(|donnees|) applications ; l'espace entier en contient la SOMME sur les groupes.
//
// SORTIE (nouvel objet à chaque appel) :
//   { etat: 'aucune',   application: null }
//   { etat: 'unique',   application: { operation, liaisons: [{ entree, donnee }, ...] } }   liaisons triées par entree (canonique)
//   { etat: 'plusieurs', application: null }
// Aucun nombre exact n'est exposé : seul « 0 / 1 / plus d'un » est établi.
//
// NE CHOISIT JAMAIS. Si plusieurs applications existent, l'état est 'plusieurs' et AUCUNE application n'est construite : ni
// première, ni dernière, ni récente, ni ancienne, ni ordre lexical comme préférence, ni score, ni hasard. Le tri n'intervient que
// pour mettre en forme canonique une application DÉJÀ mathématiquement unique (ses liaisons).
// NE MATÉRIALISE JAMAIS le produit cartésien : le dénombrement est un compteur SATURÉ à 2 (0, 1, 2 = « au moins deux »), linéaire
// dans la taille de la représentation (nombre de groupes + d'entrées + de données validées), jamais exponentiel.
//
// DISTINCTION FONDAMENTALE : l'état 'unique' ne signifie PAS « il faut exécuter cette application ». Il signifie uniquement
// « l'espace fourni contient exactement cette application ». La décision d'amorcer ou d'agir est une brique future, séparée.
//
// ENTRÉE : le tableau rendu par ce module des groupes de candidats et rien d'autre (ni descriptions, ni formes, ni valeurs, ni porteurs, ni
// observations, ni magasin). Contrat reçu validé STRICTEMENT plutôt que d'inventer une signification : tableau dense ; groupe
// exactement { operation, entrees } ; entrée exactement { entree, donnees } ; trois chaînes non vides ; propriétés propres de
// donnée (accesseur jamais exécuté, héritage, clé étrangère et symbole refusés) ; au moins une entrée par groupe et une donnée par
// entrée ; aucun doublon d'opération entre groupes, d'entrée dans un groupe, de donnée dans une entrée (TypeError). L'ORDRE REÇU N'A
// AUCUN SENS (il n'est pas exigé et ne change jamais le résultat). Une même donnée peut figurer dans plusieurs entrées : a←A, b←A
// est une application valide. Les identités ne sont pas rendues uniques globalement.
// INDÉPENDANCE : aucun import. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier.

const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) throw new TypeError(`${nom}[${rang}] est absent (tableau creux).`);
  if (!('value' in place)) throw new TypeError(`${nom}[${rang}] est un accesseur : une donnée est attendue.`);
  return place.value;
}

function exigerTableau(valeur, nom) {
  if (!Array.isArray(valeur)) throw new TypeError(`${nom} doit être un tableau.`);
}

function lireObjetExact(valeur, cles, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`${nom} doit être un objet { ${cles.join(', ')} }.`);
  for (const cle of Reflect.ownKeys(valeur)) {
    if (!cles.includes(cle)) throw new TypeError(`${nom} contient un champ étranger.`);
  }
  const lu = {};
  for (const cle of cles) {
    const place = Object.getOwnPropertyDescriptor(valeur, cle);
    if (place === undefined) throw new TypeError(`${nom} n'a pas de champ « ${cle} » propre.`);
    if (!('value' in place)) throw new TypeError(`${nom}.${cle} est un accesseur : une donnée est attendue.`);
    lu[cle] = place.value;
  }
  return lu;
}

function exigerChaine(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) throw new TypeError(`${nom} doit être une chaîne non vide.`);
}

// Validation complète : rend une copie neuve [{ operation, entrees: [{ entree, donnees: [..] }] }] (aucune référence conservée).
function validerGroupes(groupes) {
  exigerTableau(groupes, 'groupes');
  const operations = new Set();
  const valides = [];
  for (let g = 0; g < groupes.length; g += 1) {
    const groupe = lireObjetExact(lireRang(groupes, g, 'groupes'), ['operation', 'entrees'], `groupes[${g}]`);
    exigerChaine(groupe.operation, `groupes[${g}].operation`);
    if (operations.has(groupe.operation)) throw new TypeError(`groupes[${g}] répète une opération déjà présente.`);
    operations.add(groupe.operation);
    exigerTableau(groupe.entrees, `groupes[${g}].entrees`);
    if (groupe.entrees.length === 0) throw new TypeError(`groupes[${g}] doit avoir au moins une entrée.`);
    const noms = new Set();
    const entrees = [];
    for (let e = 0; e < groupe.entrees.length; e += 1) {
      const entree = lireObjetExact(lireRang(groupe.entrees, e, `groupes[${g}].entrees`), ['entree', 'donnees'], `groupes[${g}].entrees[${e}]`);
      exigerChaine(entree.entree, `groupes[${g}].entrees[${e}].entree`);
      if (noms.has(entree.entree)) throw new TypeError(`groupes[${g}].entrees[${e}] répète une entrée déjà présente.`);
      noms.add(entree.entree);
      exigerTableau(entree.donnees, `groupes[${g}].entrees[${e}].donnees`);
      if (entree.donnees.length === 0) throw new TypeError(`groupes[${g}].entrees[${e}] doit avoir au moins une donnée.`);
      const vues = new Set();
      for (let d = 0; d < entree.donnees.length; d += 1) {
        const donnee = lireRang(entree.donnees, d, `groupes[${g}].entrees[${e}].donnees`);
        exigerChaine(donnee, `groupes[${g}].entrees[${e}].donnees[${d}]`);
        if (vues.has(donnee)) throw new TypeError(`groupes[${g}].entrees[${e}].donnees[${d}] répète une donnée déjà présente.`);
        vues.add(donnee);
      }
      entrees.push({ entree: entree.entree, donnees: [...vues] });
    }
    valides.push({ operation: groupe.operation, entrees });
  }
  return valides;
}

// Nombre d'applications du groupe, SATURÉ à 2 (aucun produit calculé en entier). Chaque entrée a ≥ 1 donnée (validé) : le produit vaut 1 si toutes les entrées n'ont qu'une donnée, sinon au moins 2.
function applicationsDuGroupe(groupe) {
  for (const entree of groupe.entrees) {
    if (entree.donnees.length > 1) return 2;
  }
  return 1;
}

export function applicationUnique(groupes) {
  const valides = validerGroupes(groupes);
  let total = 0; // 0, 1, 2 (= au moins deux)
  let seul = null;
  for (const groupe of valides) {
    total = Math.min(2, total + applicationsDuGroupe(groupe));
    if (total === 1) seul = groupe;
    if (total >= 2) return { etat: 'plusieurs', application: null };
  }
  if (total === 0) return { etat: 'aucune', application: null };
  const liaisons = seul.entrees.map((e) => ({ entree: e.entree, donnee: e.donnees[0] })).sort((a, b) => comparer(a.entree, b.entree));
  return { etat: 'unique', application: { operation: seul.operation, liaisons } };
}
// === FIN_LANGAGE_APPLICATION_UNIQUE ===
