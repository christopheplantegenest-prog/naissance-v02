// === DEBUT_LANGAGE_ENVIRONNEMENT_CONVERSATION ===
// v0.63.81 — J-B (décision ChatGPT, 09/10/2026) : « RENDRE LA BOUCLE VISIBLE ET RÉELLE SUR TÉLÉPHONE ». L'environnement 'conversation'.
//
// Deux orchestrations minimales, SANS décision, SANS signification, qui relient le tour conversationnel aux faits persistés de J-A (v0.63.80) :
//
// emettreLot(lot, { magasin, idObservation }) -> { emises, echec }
//   lot : le retour réel du déclencheur mécanique ({ resultats: [{ operation, statut, designation, execution, erreur }] }).
//   CRITÈRE D'ÉMISSION (aucune sélection) : CHAQUE résultat de statut 'executee' du lot est émis, dans l'ordre du lot (ordre mécanique
//   canonique, non sémantique) — toutes les productions du tour, aucune préférée, aucune écartée. Chaque émission est un APPEL RÉEL à
//   emettreProduction (acte persisté AVANT toute présentation) vers l'environnement nommé 'conversation' ; l'adaptateur `remettre` ne fait que
//   recueillir { idEmission, idExecution, operation, valeur } pour la bulle du tour. Aucune émission n'est fabriquée pour l'affichage.
//   emises : [{ idEmission, idExecution, operation, valeur, remise }] ; echec : null, ou l'erreur d'origine si une émission a échoué (les
//   émissions déjà faites restent vraies et présentes dans `emises` ; rien n'est masqué, rien n'est levé).
//
// declarerReceptionConversation({ idDonnee, idEmission }, { magasin }) -> { reception, echec }
//   Le FAIT BRUT : « Christophe a explicitement utilisé Répondre sur cette émission et a envoyé ce message ». idDonnee = l'identité de la valeur
//   du message déjà conservée (valeursDonnees, écrite par pont.js avant l'observation) ; idEmission = la référence EXACTE transportée par le geste.
//   enregistrerReception REFUSE une émission inconnue, d'un autre environnement ou une donnée non conservée : l'échec est RENDU (echec), jamais
//   levé, jamais corrigé, jamais remplacé par un rattachement approximatif ; le tour n'est pas touché. Sans référence : cette fonction n'est pas
//   appelée — un message ordinaire ne crée aucune réception.
//   Ni « positif », ni « négatif », ni « utile », ni « ignoré » : rien ici ne lit une réception pour quoi que ce soit.
import { emettreProduction } from './emission.js';
import { enregistrerReception } from './connaissances.js';

export const NOM_ENVIRONNEMENT_CONVERSATION = 'conversation';

export async function emettreLot(lot, dependances) {
  const emises = [];
  try {
    if (dependances === null || typeof dependances !== 'object') throw new TypeError('emettreLot : dependances doit être un objet { magasin, idObservation }.');
    const { magasin, idObservation } = dependances;
    const resultats = lot !== null && typeof lot === 'object' && Array.isArray(lot.resultats) ? lot.resultats : [];
    for (const r of resultats) {
      if (r === null || typeof r !== 'object' || r.statut !== 'executee' || r.execution === null || typeof r.execution !== 'object' || typeof r.execution.id !== 'string') continue;
      const { emission, remise } = await emettreProduction({ idExecution: r.execution.id, idObservation }, {
        magasin,
        environnement: {
          nom: NOM_ENVIRONNEMENT_CONVERSATION,
          remettre: ({ emission: e, valeur }) => { emises.push({ idEmission: e.id, idExecution: e.idExecution, operation: r.operation, valeur, remise: null }); },
        },
      });
      const ligne = emises.find((x) => x.idEmission === emission.id);
      if (ligne !== undefined) ligne.remise = remise.etat;
      else emises.push({ idEmission: emission.id, idExecution: emission.idExecution, operation: r.operation, valeur: undefined, remise: remise.etat });
    }
    return { emises, echec: null };
  } catch (echec) {
    return { emises, echec };
  }
}

export async function declarerReceptionConversation(entree, dependances) {
  try {
    if (entree === null || typeof entree !== 'object') throw new TypeError('declarerReceptionConversation : entrée { idDonnee, idEmission } requise.');
    if (dependances === null || typeof dependances !== 'object') throw new TypeError('declarerReceptionConversation : dependances { magasin } requis.');
    const { idDonnee, idEmission } = entree;
    if (typeof idDonnee !== 'string' || idDonnee.length === 0) throw new TypeError('declarerReceptionConversation : le message de ce tour n\'a pas d\'identité conservée (aucune réception écrite).');
    if (typeof idEmission !== 'string' || idEmission.length === 0) throw new TypeError('declarerReceptionConversation : référence d\'émission vide (aucune réception écrite).');
    const reception = await enregistrerReception(dependances.magasin, { environnement: NOM_ENVIRONNEMENT_CONVERSATION, idDonnee, idEmission });
    return { reception, echec: null };
  } catch (echec) {
    return { reception: null, echec };
  }
}
// === FIN_LANGAGE_ENVIRONNEMENT_CONVERSATION ===
