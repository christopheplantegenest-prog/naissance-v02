// === DEBUT_LANGAGE_CONSEQUENCES_EMISSIONS ===
// v0.63.80 — J-A (décision ChatGPT, 09/10/2026 ; issu de l'expérience d'autonomie 03 du 08/10) — « CE QUI EST ARRIVÉ APRÈS CE QUE J'AI FAIT ». VUE PURE, SYNCHRONE, DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question :
//
//   « pour chaque action adressée à un environnement (émission d'une production), quelles données cet environnement a-t-il DÉCLARÉ lui faire
//     parvenir en suite de cette action — et quelles données sont arrivées sans rapport déclaré avec aucune action ? »
//
// consequencesDesEmissions(lignesEmissions, lignesReceptions) -> { emissions, independantes }
//   lignesEmissions : lignes persistées de 'emissions' { id, horodatage, idExecution, environnement, idObservation } ;
//   lignesReceptions : lignes persistées de 'receptions' { id, horodatage, environnement, idDonnee, idEmission|null }.
//   emissions : [{ id, idExecution, environnement, idObservation, consequences, donnees }] — une par émission, dans l'ordre reçu (ordre persistant,
//     non sémantique) :
//     - consequences : couverture canonique des identités [idReception] des réceptions qui référencent cette émission (vide : action sans
//       conséquence déclarée ; plusieurs : plusieurs conséquences ; jamais réduite à un nombre) ;
//     - donnees : les identités (sans doublon) des données reçues correspondantes [[idDonnee]…] (couverture canonique) — ce que Naissance peut ensuite retrouver
//       dans ses valeurs et son univers d'observation : la conséquence devient matière d'expérience comme n'importe quelle donnée.
//   independantes : couverture canonique des [idReception] des réceptions sans émission (idEmission null) : « ceci est arrivé sans que l'environnement
//     le rattache à une de mes actions » — distinct, par construction, de « ceci est apparu comme suite de mon action ».
//   Une réception référençant une émission absente des lignes fournies : TypeError (la vue ne reconstruit ni n'invente aucune émission).
// CE QUE CETTE VUE NE FAIT PAS : inférer une causalité (seule la déclaration de l'environnement relie réception et émission) ; juger (ni réussie,
// ni utile, ni attendue) ; compter ; comparer des contenus ; préférer un environnement, une opération ou une donnée ; décider.
// Deux Naissance ayant émis la même production vers deux environnements différents ont des réceptions différentes : les lignes le disent, la vue
// les rapporte telles quelles. Les expériences qui en découlent (valeurs reçues, puis observations, exécutions, épisodes, attentes) sont celles
// des mécanismes généraux existants : rien n'est ajouté ici à leur sémantique.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par test).
import { normaliserCouverture } from './couverture-occurrences.js';

const NOM = 'consequencesDesEmissions';

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

export function consequencesDesEmissions(lignesEmissions, lignesReceptions) {
  if (!Array.isArray(lignesEmissions) || !Array.isArray(lignesReceptions)) refuser('lignesEmissions et lignesReceptions doivent être des tableaux');
  const parEmission = new Map();
  const emissions = lignesEmissions.map((ligne, rang) => {
    const nom = `lignesEmissions[${rang}]`;
    const id = chaineNonVide(lirePropre(ligne, 'id', nom), `${nom}.id`);
    if (parEmission.has(id)) refuser(`deux émissions portent l'identité « ${id} »`);
    const sortie = { id, idExecution: chaineNonVide(lirePropre(ligne, 'idExecution', nom), `${nom}.idExecution`), environnement: chaineNonVide(lirePropre(ligne, 'environnement', nom), `${nom}.environnement`), idObservation: chaineNonVide(lirePropre(ligne, 'idObservation', nom), `${nom}.idObservation`), receptions: [], donnees: [] };
    parEmission.set(id, sortie);
    return sortie;
  });
  const independantes = [];
  lignesReceptions.forEach((ligne, rang) => {
    const nom = `lignesReceptions[${rang}]`;
    const id = chaineNonVide(lirePropre(ligne, 'id', nom), `${nom}.id`);
    const idDonnee = chaineNonVide(lirePropre(ligne, 'idDonnee', nom), `${nom}.idDonnee`);
    const environnement = chaineNonVide(lirePropre(ligne, 'environnement', nom), `${nom}.environnement`);
    const idEmission = lirePropre(ligne, 'idEmission', nom);
    if (idEmission === null) { independantes.push([id]); return; }
    const emission = parEmission.get(chaineNonVide(idEmission, `${nom}.idEmission`));
    if (emission === undefined) refuser(`${nom} référence une émission « ${idEmission} » absente de lignesEmissions`);
    if (emission.environnement !== environnement) refuser(`${nom} vient de « ${environnement} » mais référence une émission adressée à « ${emission.environnement} »`);
    emission.receptions.push([id]);
    if (!emission.donnees.some((d) => d[0] === idDonnee)) emission.donnees.push([idDonnee]); // une même donnée reçue deux fois en suite de la même émission : deux réceptions, une donnée
  });
  return {
    emissions: emissions.map((e) => ({ id: e.id, idExecution: e.idExecution, environnement: e.environnement, idObservation: e.idObservation, consequences: normaliserCouverture(e.receptions), donnees: normaliserCouverture(e.donnees) })),
    independantes: normaliserCouverture(independantes),
  };
}
// === FIN_LANGAGE_CONSEQUENCES_EMISSIONS ===
