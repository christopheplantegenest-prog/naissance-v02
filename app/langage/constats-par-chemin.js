// === DEBUT_LANGAGE_CONSTATS_PAR_CHEMIN ===
// v0.63.71 — « REGROUPER LES CONSTATS STRUCTURELS PAR CHEMIN » (décision ChatGPT, 07/10/2026). VUE PURE, SYNCHRONE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « à chaque chemin de propriété rencontré dans une collection d'objets structurés, quels constats ont été observés, et chez quels
//     éléments (couvertures) ? »
//
// constatsParChemin(elements) -> { universelle, chemins }
//   elements : EXACTEMENT l'entrée de produireConstatsStructurels : [{ chemin, contenu }] où `chemin` est l'identité (chemin typé) de
//   l'élément et `contenu` une valeur JSON du domaine du parcours de structure (celui du producteur). Choix d'entrée : prendre les éléments (et non la sortie du
//   producteur) parce que la couverture universelle est alors donnée par les identités DÉCLARÉES des éléments (normaliserCouverture des
//   `chemin`), c'est-à-dire par la même autorité que le producteur, et non déduite d'une propriété du parcours (l'occurrence racine du parcours).
//   Un seul appel au producteur ; aucun parcours, aucune comparaison de valeurs ni de structures, aucun calcul de couverture n'est refait.
//
// SORTIE
//   universelle : couverture canonique de TOUS les éléments examinés (les témoins possibles) — jamais réduite à un nombre.
//   chemins : [{ chemin, constats, couverture }], un par chemin de propriété RELATIF AU CONTENU rencontré dans au moins un élément :
//     - chemin : copie neuve (segments typés : clé chaîne, indice entier) ;
//     - constats : [{ type, valeur?, couverture }] : les constats du producteur observés à ce chemin, dans son ordre (première rencontre en
//       ordre canonique des éléments), avec leur couverture EXACTE (les témoins) ; `valeur` présente seulement si le constat en porte une
//       (chaîne, nombre, booléen) ; les conteneurs ('objet', 'tableau') et 'nul' restent des constats sans valeur, jamais convertis ;
//     - couverture : union des couvertures des constats du chemin = les éléments chez qui ce chemin existe (à un chemin donné, un élément
//       porte au plus un constat : l'union est sans doublon, ce que normaliserCouverture garantit).
//   Ordre des chemins : l'ordre canonique de normaliserCouverture (déterministe, sans signification).
//   Rien n'est nommé ni décidé : ni « constant », ni « variable », ni « absent », ni nombre de valeurs, ni fréquence, ni majorité, ni score.
//   Ces lectures restent DÉRIVABLES par l'algèbre existante : memesCouvertures(constat.couverture, universelle) = « constat porté par
//   tous » ; memesCouvertures(chemin.couverture, universelle) = « chemin présent chez tous » ; la partition de couvertures existante (partie « seulement
//   universelle » de universelle contre chemin.couverture) = « éléments chez qui le chemin est absent » (l'absence est un trou de couverture, jamais une valeur).
//
// TÉMOINS ET ORDRE : les témoins sont les identités (chemins) déclarées par l'appelant pour ses éléments. Si l'appelant choisit des
// identités indépendantes de l'ordre (ids réels), la sortie est indépendante de l'ordre des éléments ; s'il choisit le rang comme identité
// ([0], [1], …), le rang EST l'identité et un ordre différent désigne d'autres témoins : c'est la sémantique du producteur, rapportée
// telle quelle, jamais corrigée ici.
// ERREURS : exactement celles du producteur et de normaliserCouverture (élément mal formé, identité dupliquée, contenu hors domaine) :
// TypeError, aucun résultat partiel. [] -> { universelle: [], chemins: [] }.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état global, aucune mutation (entrée gelée acceptée) ;
// aucune référence partagée avec l'entrée dans la sortie. Ce module ne connaît ni épisode, ni famille, ni opération, ni catalogue.
// NON BRANCHÉ : aucun fichier du dépôt n'importe ce module (gardé par un test statique).
import { produireConstatsStructurels } from './constats-structurels.js';
import { normaliserCouverture, memesCouvertures } from './couverture-occurrences.js';

const NOM = 'constatsParChemin';

function lirePropre(objet, champ, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) throw new TypeError(`${NOM} : ${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in place)) throw new TypeError(`${NOM} : ${nom}.${champ} est un accesseur : une donnée est attendue.`);
  return place.value;
}

export function constatsParChemin(elements) {
  if (!Array.isArray(elements)) throw new TypeError(`${NOM} : elements doit être un tableau d'éléments { chemin, contenu }.`);
  // 1. Les faits : le producteur existant (validation complète des éléments, parcours, égalité des constats, couvertures).
  const constats = produireConstatsStructurels(elements);
  // 2. L'univers des témoins : les identités déclarées des éléments (même autorité que le producteur).
  const identites = [];
  for (let rang = 0; rang < elements.length; rang += 1) {
    const element = Object.getOwnPropertyDescriptor(elements, rang).value;
    identites.push(lirePropre(element, 'chemin', `elements[${rang}]`));
  }
  const universelle = normaliserCouverture(identites);
  // 3. Regroupement par chemin de propriété (égalité de chemins : celle de couverture-occurrences, jamais une clé textuelle).
  const groupes = []; // [{ chemin, constats: [{ type, valeur?, couverture }] }]
  for (const { constat, couverture } of constats) {
    let groupe = groupes.find((g) => memesCouvertures([g.chemin], [constat.chemin]));
    if (groupe === undefined) {
      groupe = { chemin: [...constat.chemin], constats: [] };
      groupes.push(groupe);
    }
    const copie = { type: constat.type };
    if (Object.hasOwn(constat, 'valeur')) copie.valeur = constat.valeur;
    copie.couverture = normaliserCouverture(couverture);
    groupe.constats.push(copie);
  }
  // 4. Ordre canonique des chemins et couverture de chaque chemin (union, sans doublon par construction).
  const ordre = normaliserCouverture(groupes.map((g) => g.chemin));
  const chemins = ordre.map((chemin) => {
    const groupe = groupes.find((g) => memesCouvertures([g.chemin], [chemin]));
    return { chemin, constats: groupe.constats, couverture: normaliserCouverture(groupe.constats.flatMap((c) => c.couverture)) };
  });
  return { universelle, chemins };
}
// === FIN_LANGAGE_CONSTATS_PAR_CHEMIN ===
