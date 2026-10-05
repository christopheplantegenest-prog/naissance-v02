// === DEBUT_LANGAGE_ACCES_VALEUR ===
// v0.63.17 — ÉTAPE 7 : « ACCÈS PUR À LA VALEUR D'UNE DONNÉE PORTÉE » (décision ChatGPT, 05/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « une donnée désignée { identite, … } + son porteur vivant + une déclaration d'accès { champ } : quelle est sa valeur réelle ? »
//
// Trois informations restent DISTINCTES : l'identité (qui), la forme (quoi, contrat), l'accès (où, dans le porteur). Ce module ne
// traite que l'identité (pour ne jamais rendre la valeur d'un autre porteur) et l'accès. Il NE LIT JAMAIS `donnee.forme` et ne
// valide pas la valeur contre une forme : la conformité valeur/forme est une autre couche. Un porteur dont le champ contient 42
// pour une forme « chaîne » rend 42.
//
// ENTRÉES : (porteur, donnee, acces).
//   porteur : objet portant SON PROPRE champ de donnée « id » (chaîne non vide).
//   donnee  : objet portant SON PROPRE champ de donnée « identite » (chaîne non vide). Rien d'autre n'est lu.
//   acces   : objet portant SON PROPRE champ de donnée « champ » (chaîne non vide). Pas de chemin, de fonction, de défaut.
//
// ORDRE (le champ de valeur n'est lu qu'à la fin) : 1. validation des trois objets ; 2. lecture porteur.id, donnee.identite,
// acces.champ par descripteurs ; 3. exigence porteur.id === donnee.identite ; 4. SEULEMENT ALORS lecture du champ de valeur.
//
// LECTURE : uniquement une propriété PROPRE de TYPE DONNÉE. Absente, héritée ou accesseur (jamais exécuté) = TypeError :
// « aucune valeur disponible ». Une propriété présente valant undefined est rendue (undefined réel). La valeur est rendue
// EXACTEMENT (même référence, -0 conservé) : ni copie, ni coercition, ni trim, ni repli. Aucune liste de noms interdits : la
// sûreté vient des descripteurs de propriété propre, pas du texte du nom (« __proto__ », « constructor » inclus).
//
// Ce module ne connaît ni message, ni trace, ni texte, ni resultat, ni opération, ni catalogue, ne garde aucune table,
// n'importe RIEN. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique).
function lireChampPropre(objet, champ, nom) {
  const propriete = Object.getOwnPropertyDescriptor(objet, champ);
  if (propriete === undefined) throw new TypeError(`${nom} n'a pas de champ « ${champ} » propre.`);
  if (!('value' in propriete)) throw new TypeError(`${nom}.${champ} est un accesseur : une donnée est attendue.`);
  return propriete.value;
}

function exigerObjet(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) throw new TypeError(`${nom} doit être un objet.`);
}

function exigerChaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) throw new TypeError(`${nom} doit être une chaîne non vide.`);
}

export function valeurDePorteur(porteur, donnee, acces) {
  exigerObjet(porteur, 'porteur');
  exigerObjet(donnee, 'donnee');
  exigerObjet(acces, 'acces');
  const identitePorteur = lireChampPropre(porteur, 'id', 'porteur');
  exigerChaineNonVide(identitePorteur, 'porteur.id');
  const identiteDonnee = lireChampPropre(donnee, 'identite', 'donnee');
  exigerChaineNonVide(identiteDonnee, 'donnee.identite');
  const champ = lireChampPropre(acces, 'champ', 'acces');
  exigerChaineNonVide(champ, 'acces.champ');
  if (identitePorteur !== identiteDonnee) throw new TypeError('porteur.id ne correspond pas à donnee.identite.');
  return lireChampPropre(porteur, champ, 'porteur');
}
// === FIN_LANGAGE_ACCES_VALEUR ===
