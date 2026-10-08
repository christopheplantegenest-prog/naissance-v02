// === DEBUT_LANGAGE_EPISODES_ENVIRONNEMENT ===
// EXPÉRIENCE D'AUTONOMIE 04 (branche, base v0.63.76 + autonomie-03, 08/10/2026) — « L'ENVIRONNEMENT COMME OPÉRATEUR VÉCU ». VUE PURE, SYNCHRONE,
// DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « les conséquences déclarées de mes émissions (autonomie 03) peuvent-elles être présentées aux mécanismes généraux d'expérience (épisodes de
//     transformation, familles, constats, contextes prospectifs, attentes, issues) EXACTEMENT comme des exécutions d'opérations — l'environnement
//     tenant le rôle d'un opérateur dont je ne connais que ce qu'il m'a réellement renvoyé ? »
//
// projeterEnvironnements(lignesEmissions, lignesReceptions, lignesValeurs, descriptionSource = DESCRIPTION_SOURCE_MESSAGE) -> { executions, descriptions }
//   Pour CHAQUE réception déclarée (idEmission non null) : une EXÉCUTION SYNTHÉTIQUE
//     { id: reception.id, horodatage: reception.horodatage, idDesignation: emission.id, operation: 'environnement:' + nom,
//       liaisons: [{ entree: 'emis', donnee: emission.idExecution }], resultat: valeur de la donnée reçue }
//   — « l'opérateur `environnement:nom`, appliqué à la production émise, a produit la valeur reçue ». L'émission tient lieu de désignation
//   (l'acte qui précède), la réception d'exécution (le fait qui suit). Plusieurs réceptions d'une même émission : plusieurs exécutions, même
//   désignation (plusieurs issues d'un même acte ; une vue qui exige une issue unique le refusera : c'est son contrat, pas une perte).
//   Une émission sans réception : aucune exécution (une désignation sans issue). Une réception indépendante : rien (elle ne suit aucune action).
//   Pour CHAQUE environnement ayant au moins une réception déclarée : une DESCRIPTION { nom: 'environnement:' + nom, entrees: { emis: { forme:
//   'quelconque' } }, sortie: forme déclarée de la source message } — rien n'est inféré d'une valeur : l'entrée est non contrainte (n'importe quelle
//   production peut être émise), la sortie est la forme DÉCLARÉE du canal de réception (une réception est une donnée conservée du même canal que le
//   message). Cette description n'est pas apprise : c'est le contrat du canal ; ce qui est appris est dans les exécutions (ce qui est revenu).
//   Les sorties sont des objets NEUFS, prêts à être CONCATÉNÉS aux lignes réelles : episodesDeTransformation(valeurs, [...executions, ...synth],
//   [...descriptions, ...synthDescriptions]). Aucune ligne réelle n'est modifiée, aucune table n'est écrite, aucune identité n'est inventée (chaque
//   identité synthétique est l'identité persistante d'une réception).
//   ERREURS : réception référençant une émission absente, donnée reçue sans valeur conservée, environnement incohérent : TypeError, rien de partiel.
// CE QUE CETTE VUE NE FAIT PAS : juger, compter, préférer ; décider qu'une émission doit avoir lieu ; inférer une forme d'une valeur ; comparer des
// contenus (la comparaison émis/reçu est celle, générale, des épisodes : relation de valeur egale / differente / non_comparable).
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par test).
import { DESCRIPTION_SOURCE_MESSAGE } from './source-message.js';

const NOM = 'projeterEnvironnements';
export const PREFIXE_ENVIRONNEMENT = 'environnement:';
export const ENTREE_EMISE = 'emis';

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

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

export function projeterEnvironnements(lignesEmissions, lignesReceptions, lignesValeurs, descriptionSource = DESCRIPTION_SOURCE_MESSAGE) {
  if (!Array.isArray(lignesEmissions) || !Array.isArray(lignesReceptions) || !Array.isArray(lignesValeurs)) refuser('lignesEmissions, lignesReceptions et lignesValeurs doivent être des tableaux');
  const formeSortie = structuredClone(lirePropre(descriptionSource, 'forme', 'descriptionSource'));
  const emissions = new Map();
  lignesEmissions.forEach((e, rang) => {
    const id = chaineNonVide(lirePropre(e, 'id', `lignesEmissions[${rang}]`), `lignesEmissions[${rang}].id`);
    if (emissions.has(id)) refuser(`deux émissions portent l'identité « ${id} »`);
    emissions.set(id, { id, idExecution: chaineNonVide(lirePropre(e, 'idExecution', `lignesEmissions[${rang}]`), `lignesEmissions[${rang}].idExecution`), environnement: chaineNonVide(lirePropre(e, 'environnement', `lignesEmissions[${rang}]`), `lignesEmissions[${rang}].environnement`) });
  });
  const valeurs = new Map();
  lignesValeurs.forEach((v, rang) => { valeurs.set(chaineNonVide(lirePropre(v, 'id', `lignesValeurs[${rang}]`), `lignesValeurs[${rang}].id`), lirePropre(v, 'valeur', `lignesValeurs[${rang}]`)); });
  const executions = [];
  const environnements = new Set();
  lignesReceptions.forEach((r, rang) => {
    const nom = `lignesReceptions[${rang}]`;
    const idEmission = lirePropre(r, 'idEmission', nom);
    if (idEmission === null) return;
    const emission = emissions.get(chaineNonVide(idEmission, `${nom}.idEmission`));
    if (emission === undefined) refuser(`${nom} référence une émission « ${idEmission} » absente`);
    const environnement = chaineNonVide(lirePropre(r, 'environnement', nom), `${nom}.environnement`);
    if (environnement !== emission.environnement) refuser(`${nom} vient de « ${environnement} » mais l'émission était adressée à « ${emission.environnement} »`);
    const idDonnee = chaineNonVide(lirePropre(r, 'idDonnee', nom), `${nom}.idDonnee`);
    if (!valeurs.has(idDonnee)) refuser(`${nom} porte une donnée « ${idDonnee} » sans valeur conservée`);
    environnements.add(environnement);
    executions.push({
      id: chaineNonVide(lirePropre(r, 'id', nom), `${nom}.id`),
      horodatage: lirePropre(r, 'horodatage', nom),
      idDesignation: emission.id,
      operation: PREFIXE_ENVIRONNEMENT + environnement,
      liaisons: [{ entree: ENTREE_EMISE, donnee: emission.idExecution }],
      resultat: structuredClone(valeurs.get(idDonnee)),
    });
  });
  const descriptions = [...environnements].sort().map((environnement) => ({ nom: PREFIXE_ENVIRONNEMENT + environnement, entrees: { [ENTREE_EMISE]: { forme: 'quelconque' } }, sortie: structuredClone(formeSortie) }));
  return { executions, descriptions };
}
// === FIN_LANGAGE_EPISODES_ENVIRONNEMENT ===
