// === DEBUT_LANGAGE_RESOUDRE_IDENTITES ===
// v0.63.48 — « RÉSOLUTION HISTORIQUE D'IDENTITÉS » (décision ChatGPT, 06/10/2026). PRIMITIVE PURE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « connaissant l'identité d'une donnée, quelle est cette donnée (forme d'origine selon le catalogue COURANT, porteur, accès à la
//     valeur), sans la remettre dans l'univers courant ? »
//
// resoudreIdentitesDonnees(identites, lignesValeurs, lignesExecutions, descriptions) -> [ { donnee: { identite, forme }, porteur, acces } ]
//
// REPRÉSENTATION : EXACTEMENT celle que observerPossibilites place dans le tableau `univers` d'un tour (aucune seconde représentation) :
//   - MESSAGE (ligne de valeursDonnees { id, valeur }) : porteur = la LIGNE elle-même (même référence) ; acces = ACCES_VALEUR_DONNEE
//     (champ « valeur ») ; forme = DESCRIPTION_SOURCE_MESSAGE.forme, par donneeDeSource (la ligne ne porte pas sa forme : elle est connue
//     parce que la table ne contient que des messages).
//   - EXÉCUTION (ligne de executionsOperations) : porteur = la LIGNE (même référence) ; acces = ACCES_TRACE (champ « resultat ») ;
//     forme = sortie déclarée de son opération dans `descriptions` (productionsDecrites).
//   - SOUS-DONNÉE α2 (identité opaque listée dans la clé `sousDonnees` d'une ligne) : porteur SYNTHÉTIQUE { id, resultat: sous-valeur réelle
//     lue PAR RÉFÉRENCE dans le `resultat` de la ligne porteuse } ; acces = ACCES_TRACE ; forme = formeSousDonnee du descripteur courant.
// Pour que la valeur se lise, on utilise valeurDePorteur(élément.porteur, élément.donnee, élément.acces) : ce module ne lit jamais la
// valeur d'un message ni d'une exécution (seule la sous-valeur d'une sous-donnée est lue, pour fabriquer son porteur synthétique, comme
// le fait observerPossibilites).
//
// IDENTITÉS EXPLICITES UNIQUEMENT. La fonction résout exactement les identités fournies : elle ne cherche jamais « les dernières »,
// « les premières », « les pertinentes », ne choisit aucun type de donnée, ne sait rien de RC, de temporalité ni de paire.
// ORDRE : la sortie suit exactement l'ordre des identités demandées ; aucun tri.
// DOUBLONS : une identité demandée deux fois produit DEUX éléments correspondants (deux positions), jamais une collection dédupliquée.
// Chaque élément est un objet NEUF avec une `donnee` neuve et une copie neuve de la forme ; le porteur reste la ligne originale
// (même référence) ou, pour une sous-donnée, un porteur synthétique neuf par position.
// IDENTITÉ INCONNUE : TypeError, aucun résultat partiel. Idem pour une exécution (ou sous-donnée) dont l'opération n'est plus décrite
// dans `descriptions` : sa forme est indéterminée, jamais devinée.
// COLLISION : une même identité portée par un message, une exécution ou une sous-donnée (deux sources, ou deux fois dans une source) est
// un TypeError, y compris pour des identités non demandées (même invariant d'unicité qu'universValeurs : jamais fusionnée ni départagée).
// DONNÉE MAL FORMÉE : TypeError (ligne non objet, sans `id`, tableau creux, accesseur, `valeur` / `resultat` absents d'une ligne
// demandée, sous-donnée illisible). Les lignes d'exécution sont validées par productionsDecrites et indexSousDonnees (mécanismes existants).
// FORMES : toujours déterminées par le catalogue COURANT ; rien n'est persisté ni corrigé ici (contrat actuel de productionsDecrites).
// PURETÉ : aucune lecture de magasin, aucune écriture, aucun état global, aucun horodatage, aucune identité générée ; aucune entrée
// n'est modifiée. NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par un test statique) ; ni opération, ni
// catalogue, ni table d'opérations.
import { donneeDeSource } from './donnee-de-source.js';
import { DESCRIPTION_SOURCE_MESSAGE } from './source-message.js';
import { ACCES_VALEUR_DONNEE } from './valeur-donnee.js';
import { ACCES_TRACE } from './acces-trace.js';
import { productionsDecrites } from './productions-decrites.js';
import { indexSousDonnees, valeurSousDonnee } from './sous-donnees.js';

const NOM = 'resoudreIdentitesDonnees';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${nom}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${nom}[${rang}] est un accesseur : une donnée est attendue`);
  return place.value;
}

function exigerTableau(valeur, nom) {
  if (!Array.isArray(valeur)) refuser(`${nom} doit être un tableau`);
  return valeur;
}

function lirePropre(objet, champ, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

const copierForme = (forme) => JSON.parse(JSON.stringify(forme));

export function resoudreIdentitesDonnees(identites, lignesValeurs, lignesExecutions, descriptions) {
  exigerTableau(identites, 'identites');
  exigerTableau(lignesValeurs, 'lignesValeurs');
  exigerTableau(lignesExecutions, 'lignesExecutions');
  exigerTableau(descriptions, 'descriptions');
  const demandees = [];
  for (let rang = 0; rang < identites.length; rang += 1) {
    const id = lireRang(identites, rang, 'identites');
    if (typeof id !== 'string' || id.length === 0) refuser(`identites[${rang}] doit être une chaîne non vide`);
    demandees.push(id);
  }

  // Messages : l'identité est celle de la ligne (donneeDeSource valide l'objet et son `id`).
  const messages = new Map();
  for (let rang = 0; rang < lignesValeurs.length; rang += 1) {
    const ligne = lireRang(lignesValeurs, rang, 'lignesValeurs');
    let donnee;
    try {
      donnee = donneeDeSource(ligne, DESCRIPTION_SOURCE_MESSAGE);
    } catch (erreur) {
      refuser(`lignesValeurs[${rang}] : ${erreur.message}`);
    }
    if (messages.has(donnee.identite)) refuser(`lignesValeurs : deux lignes portent la même identité (rang ${rang})`);
    messages.set(donnee.identite, ligne);
  }

  // Exécutions et sous-données : mécanismes existants (validation complète, unicité dans l'ensemble exécutions + sous-données).
  const productions = new Map();
  for (const production of productionsDecrites(lignesExecutions, descriptions)) productions.set(production.identite, production);
  const sousDonnees = indexSousDonnees(lignesExecutions);
  const executions = new Map();
  for (let rang = 0; rang < lignesExecutions.length; rang += 1) {
    const ligne = lireRang(lignesExecutions, rang, 'lignesExecutions');
    executions.set(lirePropre(ligne, 'id', `lignesExecutions[${rang}]`), ligne);
  }

  // Collision entre sources : un message ne peut porter l'identité d'une exécution ni d'une sous-donnée.
  for (const id of messages.keys()) {
    if (executions.has(id) || sousDonnees.has(id)) refuser(`l'identité « ${id} » est portée par un message ET par une exécution ou une sous-donnée`);
  }

  const resolues = [];
  for (let rang = 0; rang < demandees.length; rang += 1) {
    const id = demandees[rang];
    if (messages.has(id)) {
      const ligne = messages.get(id);
      lirePropre(ligne, 'valeur', `message « ${id} »`);
      resolues.push({ donnee: donneeDeSource(ligne, DESCRIPTION_SOURCE_MESSAGE), porteur: ligne, acces: ACCES_VALEUR_DONNEE });
      continue;
    }
    if (executions.has(id)) {
      const ligne = executions.get(id);
      const production = productions.get(id);
      if (production === undefined) refuser(`l'exécution « ${id} » n'a pas d'opération décrite dans le catalogue courant : sa forme est indéterminée`);
      lirePropre(ligne, 'resultat', `exécution « ${id} »`);
      resolues.push({ donnee: { identite: id, forme: copierForme(production.forme) }, porteur: ligne, acces: ACCES_TRACE });
      continue;
    }
    if (sousDonnees.has(id)) {
      const sous = sousDonnees.get(id);
      const production = productions.get(id);
      if (production === undefined) refuser(`la sous-donnée « ${id} » n'est plus exposable dans le catalogue courant : sa forme est indéterminée`);
      const resultat = lirePropre(sous.execution, 'resultat', `exécution porteuse de la sous-donnée « ${id} »`);
      let sousValeur;
      try {
        sousValeur = valeurSousDonnee(resultat, sous.chemin);
      } catch (erreur) {
        refuser(`la sous-donnée « ${id} » n'est pas lisible : ${erreur.message}`);
      }
      resolues.push({ donnee: { identite: id, forme: copierForme(production.forme) }, porteur: { id, resultat: sousValeur }, acces: ACCES_TRACE });
      continue;
    }
    refuser(`identité inconnue « ${id} » (identites[${rang}])`);
  }
  return resolues;
}
// === FIN_LANGAGE_RESOUDRE_IDENTITES ===
