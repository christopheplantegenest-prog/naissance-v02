// === DEBUT_LANGAGE_EMISSION ===
// v0.63.80 — J-A (décision ChatGPT, 09/10/2026 ; issu de l'expérience d'autonomie 03 du 08/10) — « ADRESSER UNE PRODUCTION À UN ENVIRONNEMENT ». ORCHESTRATION MINIMALE.
//
// emettreProduction({ idExecution, idObservation }, { magasin, environnement }) -> { emission, remise }
//   environnement : un ADAPTATEUR { nom, remettre } — `nom` : chaîne non vide, l'identité de l'environnement (persistée dans l'émission) ;
//     `remettre({ emission, valeur })` : fonction (synchrone ou asynchrone) qui porte réellement la valeur hors de Naissance (afficher,
//     transmettre, écrire ailleurs…). Ce fichier ne connaît AUCUN environnement concret ; la conversation, un programme d'essai, un fichier,
//     un autre agent sont des adaptateurs parmi d'autres, interchangeables.
//   ORDRE : (1) l'exécution émise est lue dans executionsOperations (sa valeur = son `resultat`, copie structurelle : rien d'autre n'est lu) ;
//   (2) l'ACTE est persisté (enregistrerEmission) — l'adresse est faite, l'identité de l'émission existe : c'est elle que l'environnement pourra
//   citer dans ses réceptions ; (3) l'adaptateur remet { emission, valeur }. Si la remise lève, l'erreur est rendue dans `remise` ({ etat: 'echec',
//   erreur }) et JAMAIS masquée ; l'émission écrite reste vraie (Naissance a adressé) : « adressé » ≠ « parvenu », et aucune réception ne le dira
//   à sa place. Sinon remise = { etat: 'remise' }.
//   Cette fonction ne DÉCIDE JAMAIS d'émettre : elle exécute un acte demandé par son appelant (acte extérieur, ou mécanisme ultérieur dûment
//   justifié). Aucune production n'est jamais transformée d'elle-même en message. Aucune lecture par le choix ou l'exécution.
//   ERREURS d'entrée (exécution absente, adaptateur mal formé) : TypeError avant tout effet, rien d'écrit.
import { enregistrerEmission } from './connaissances.js';

const NOM = 'emettreProduction';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

export async function emettreProduction(entree, dependances) {
  if (entree === null || typeof entree !== 'object' || Array.isArray(entree)) refuser('entree doit être un objet { idExecution, idObservation }');
  if (dependances === null || typeof dependances !== 'object' || Array.isArray(dependances)) refuser('dependances doit être un objet { magasin, environnement }');
  const { idExecution, idObservation } = entree;
  const { magasin, environnement } = dependances;
  if (typeof idExecution !== 'string' || idExecution.length === 0 || typeof idObservation !== 'string' || idObservation.length === 0) refuser('idExecution et idObservation doivent être des chaînes non vides');
  if (environnement === null || typeof environnement !== 'object' || typeof environnement.nom !== 'string' || environnement.nom.length === 0 || typeof environnement.remettre !== 'function') refuser('environnement doit être un adaptateur { nom: chaîne non vide, remettre: fonction }');
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') refuser('magasin doit offrir lireTout');
  const executions = await magasin.lireTout('executionsOperations');
  const execution = Array.isArray(executions) ? executions.find((e) => e !== null && typeof e === 'object' && e.id === idExecution) : undefined;
  if (execution === undefined) refuser(`aucune exécution « ${idExecution} »`);
  const valeur = structuredClone(execution.resultat);
  const emission = await enregistrerEmission(magasin, { idExecution, environnement: environnement.nom, idObservation });
  let remise;
  try {
    await environnement.remettre({ emission: structuredClone(emission), valeur });
    remise = { etat: 'remise' };
  } catch (erreur) {
    remise = { etat: 'echec', erreur };
  }
  return { emission, remise };
}
// === FIN_LANGAGE_EMISSION ===
