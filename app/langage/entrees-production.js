// === DEBUT_LANGAGE_ENTREES_PRODUCTION ===
// v0.63.54 — « EXPOSER LES ENTRÉES PERSISTÉES D'UNE PRODUCTION » (décision ChatGPT, 06/10/2026). PRIMITIVE PURE, SYNCHRONE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « quelles données cette production a-t-elle reçues comme entrées lors de son exécution ? »
//
// entreesDeProduction(identiteProduction, lignesExecutions) -> liaisons
//   identiteProduction : l'identité EXACTE d'une production = l'id de sa ligne d'exécution (chaîne non vide).
//   lignesExecutions   : les lignes d'exécution persistées (tableau). Une seule ligne doit porter cette identité.
//   Rend une COPIE STRUCTURELLE de execution.liaisons, telle que persistée, sans aucune interprétation :
//     ordinaire  : { entree, donnee }
//     collective : { entree, donnees: [...] }   (jamais éclatée en liaisons ordinaires)
//   Noms d'entrées, distinction ordinaire / collective, identités, regroupement collectif et ordre canonique persisté sont conservés.
//   Aucun objet ni tableau n'est partagé avec la ligne source (nouveaux objets à chaque appel, profondément égaux entre eux).
//
// SENS : uniquement « données reçues en entrée ». Ni cause, ni condition, ni souvenir, ni pertinence, ni passé, ni présent, ni résultat
// attendu, ni confirmation, ni observation productrice. Aucune sémantique supplémentaire.
//
// IDENTITÉ : exactement UNE ligne d'exécution d'id égal. TypeError si l'identité est invalide, si aucune ligne ne correspond, si plusieurs
// lignes correspondent, si la ligne correspondante est mal formée ou si ses liaisons le sont. Aucune dépendance à l'ordre des lignes ni à leurs
// horodatages (jamais lus). Les AUTRES lignes ne sont lues que par leur `id` (propriété propre de donnée, chaîne non vide) : c'est ce qui permet de
// décider de l'unicité ; leurs autres champs ne sont ni lus ni validés.
// MESSAGE : un message n'est pas une production ; il n'est pas dans lignesExecutions : « aucune exécution correspondante » (TypeError). Cette
// primitive ne lit JAMAIS les valeurs de données et ne crée aucun cas spécial « message sans entrée ».
// SOUS-DONNÉE α2 : une sous-donnée n'est PAS une production autonome et n'a pas de liaisons propres : TypeError. Elle n'est jamais remontée à sa
// production parente et ne reçoit jamais les entrées de celle-ci (la relation sous-donnée -> production parente reste hors de cette primitive).
// Le message d'erreur distingue ce cas par une lecture TOLÉRANTE de sousDonnees (uniquement pour mieux nommer le refus ; toute difficulté de
// lecture retombe sur le message générique « aucune exécution correspondante » : le refus est le même).
//
// LIGNE CORRESPONDANTE BIEN FORMÉE : objet dont `id` et `operation` sont des chaînes non vides (propriétés propres de donnée) et
// dont `liaisons` est valide. Ni `resultat`, ni `horodatage`, ni `sousDonnees` ne sont lus.
// LIAISONS VALIDES = exactement les invariants garantis par l'écriture actuelle (enregistrerExecutionOperation) : tableau dense d'au moins une
// liaison ; chaque liaison est EXACTEMENT { entree, donnee } ou EXACTEMENT { entree, donnees } (clés closes, une seule variante, aucune clé
// symbole) ; entree, donnee et chaque identité de donnees sont des chaînes non vides (sans trim) ; donnees est un tableau dense NON VIDE, sans
// doublon, trié en unités de code ; les liaisons sont triées par entree en unités de code, sans entree dupliquée. Aucun autre invariant n'est
// ajouté. Une ligne antérieure à ce contrat (qui ne le respecterait pas) est refusée, jamais réparée.
//
// FORME GÉNÉRALE : la sortie est conforme à « collection de { entree: chaine, donnee: chaine peutManquer, donnees: collection de chaine
// peutManquer } » (démontré par les tests). Elle n'est PAS pour autant une donnée du moteur dans cette version : aucun accès, aucune identité.
//
// PURETÉ : aucun magasin, aucune écriture, aucune horloge, aucune identité générée, aucun état global ; aucune entrée n'est modifiée ; une ligne
// gelée en profondeur est acceptée. Aucune importation. NON BRANCHÉ : aucun mécanisme du dépôt n'appelle cette primitive (gardé par un test statique).
const NOM = 'entreesDeProduction';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lirePropre(objet, champ, nom) {
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

function lireRang(tableau, rang, nom) {
  const place = Object.getOwnPropertyDescriptor(tableau, rang);
  if (place === undefined) refuser(`${nom}[${rang}] est absent (tableau creux)`);
  if (!('value' in place)) refuser(`${nom}[${rang}] est un accesseur : une donnée est attendue`);
  return place.value;
}

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

function exigerObjet(valeur, nom) {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) refuser(`${nom} doit être un objet`);
}

// Lecture tolérante, UNIQUEMENT pour nommer le refus d'une sous-donnée : jamais une décision, jamais d'exception.
function estSousDonnee(identite, lignes) {
  try {
    for (let rang = 0; rang < lignes.length; rang += 1) {
      const ligne = Object.getOwnPropertyDescriptor(lignes, rang);
      const sous = ligne && 'value' in ligne && ligne.value !== null && typeof ligne.value === 'object' ? Object.getOwnPropertyDescriptor(ligne.value, 'sousDonnees') : undefined;
      if (sous === undefined || !('value' in sous) || !Array.isArray(sous.value)) continue;
      for (let k = 0; k < sous.value.length; k += 1) {
        const s = Object.getOwnPropertyDescriptor(sous.value, k);
        const id = s && 'value' in s && s.value !== null && typeof s.value === 'object' ? Object.getOwnPropertyDescriptor(s.value, 'id') : undefined;
        if (id !== undefined && 'value' in id && id.value === identite) return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

function copierLiaisons(brutes, nom) {
  if (!Array.isArray(brutes)) refuser(`${nom} doit être un tableau`);
  if (brutes.length === 0) refuser(`${nom} doit contenir au moins une liaison`);
  const copie = [];
  for (let rang = 0; rang < brutes.length; rang += 1) {
    const brute = lireRang(brutes, rang, nom);
    const nomLiaison = `${nom}[${rang}]`;
    exigerObjet(brute, nomLiaison);
    const cles = Reflect.ownKeys(brute);
    const collective = cles.includes('donnees');
    const attendues = collective ? ['entree', 'donnees'] : ['entree', 'donnee'];
    if (cles.length !== 2 || !attendues.every((cle) => cles.includes(cle))) refuser(`${nomLiaison} doit porter exactement ${attendues.join(' et ')}`);
    const entree = chaineNonVide(lirePropre(brute, 'entree', nomLiaison), `${nomLiaison}.entree`);
    if (rang > 0 && !(copie[rang - 1].entree < entree)) refuser(`${nom} doit être strictement triée par entree (sans entree dupliquée)`);
    if (collective) {
      const ids = lirePropre(brute, 'donnees', nomLiaison);
      if (!Array.isArray(ids)) refuser(`${nomLiaison}.donnees doit être un tableau`);
      if (ids.length === 0) refuser(`${nomLiaison}.donnees doit contenir au moins une identité`);
      const donnees = [];
      for (let k = 0; k < ids.length; k += 1) {
        const id = chaineNonVide(lireRang(ids, k, `${nomLiaison}.donnees`), `${nomLiaison}.donnees[${k}]`);
        if (k > 0 && !(donnees[k - 1] < id)) refuser(`${nomLiaison}.donnees doit être strictement triée (sans doublon)`);
        donnees.push(id);
      }
      copie.push({ entree, donnees });
    } else {
      copie.push({ entree, donnee: chaineNonVide(lirePropre(brute, 'donnee', nomLiaison), `${nomLiaison}.donnee`) });
    }
  }
  return copie;
}

export function entreesDeProduction(identiteProduction, lignesExecutions) {
  chaineNonVide(identiteProduction, 'identiteProduction');
  if (!Array.isArray(lignesExecutions)) refuser('lignesExecutions doit être un tableau');
  let correspondante = null;
  let nombre = 0;
  for (let rang = 0; rang < lignesExecutions.length; rang += 1) {
    const ligne = lireRang(lignesExecutions, rang, 'lignesExecutions');
    exigerObjet(ligne, `lignesExecutions[${rang}]`);
    const id = chaineNonVide(lirePropre(ligne, 'id', `lignesExecutions[${rang}]`), `lignesExecutions[${rang}].id`);
    if (id === identiteProduction) {
      correspondante = ligne;
      nombre += 1;
    }
  }
  if (nombre === 0) {
    if (estSousDonnee(identiteProduction, lignesExecutions)) refuser(`« ${identiteProduction} » est une sous-donnée : elle n'a pas de liaisons propres (la relation vers sa production parente n'est pas exposée ici)`);
    refuser(`aucune exécution correspondante pour « ${identiteProduction} »`);
  }
  if (nombre > 1) refuser(`${nombre} exécutions portent l'identité « ${identiteProduction} »`);
  const nomLigne = `exécution « ${identiteProduction} »`;
  chaineNonVide(lirePropre(correspondante, 'operation', nomLigne), `${nomLigne}.operation`);
  return copierLiaisons(lirePropre(correspondante, 'liaisons', nomLigne), `${nomLigne}.liaisons`);
}
// === FIN_LANGAGE_ENTREES_PRODUCTION ===
