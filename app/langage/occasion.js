// === DEBUT_LANGAGE_OCCASION ===
// v0.63.88 — OCCASION D'ÉVALUATION (décision ChatGPT « ORDRE DE DÉVELOPPEMENT v0.63.88 », 11/10/2026 ; règle H4 ∧ H3 de la sonde « occasion »).
// FONCTION PURE. Elle répond à UNE seule question :
//
//   « cet ÉVÉNEMENT RÉEL (tick, observation d'un message, réception…) ouvre-t-il une occasion d'évaluer les besoins et les moyens ? »
//
// RÈGLE (fixée) : une occasion existe lorsqu'un événement réel
//   - possède des conséquences persistées (des variations d'état dont la cause est cet événement) ;
//   - et au moins une de ces conséquences AGGRAVE un besoin déclaré : |après − satiété| > |avant − satiété| (formule acceptée pour les
//     besoins numériques B1/B2 de .88 ; ce n'est pas une théorie des besoins futurs) ;
//   - et cette conséquence n'est PAS elle-même le COÛT D'UNE ACTIVITÉ de Naissance (correction ChatGPT avant livraison, 11/10/2026). Les
//     identités des variations qui sont un tel coût sont FOURNIES par l'appelant (episode-propre.js les reconnaît dans les faits persistés : une
//     variation est le coût d'une activité ssi elle est l'issue d'une désignation d'ACTE — une application d'opération, pas une conséquence
//     « soi:* » — ou, sans désignation, si sa cause est l'identité d'une observation où un acte a été désigné : le lot mécanique d'un tour,
//     l'engagement d'un épisode propre). Rien ici ne nomme message, B1, relation ni conversation. Le temps et la réception produisent des
//     conséquences DIRECTES (désignées comme conséquences sur soi), jamais des coûts ;
//   - et l'événement n'est PAS une activité propre (son identité n'est pas celle d'une observation de source « soi »).
// L'événement ouvre AU PLUS UNE occasion globale, quel que soit le nombre de besoins aggravés. Une satisfaction (rapprochement de la
// satiété) n'est pas une aggravation ; une variation égale non plus ; le coût d'une activité n'en est jamais une.
//
// occasionDEvenement({ evenement, consequences, besoins, causesPropres, couts }) -> { evenement, propre, aggravations, coutsDActivite, occasion }
//   evenement     : identité (chaîne) de l'événement réel ;
//   consequences  : variations persistées { dimension, variation, cause: { type, id }, valeurAvant, valeurApres } (toutes dimensions ; seules
//                   celles dont cause.id === evenement comptent) ;
//   besoins       : les besoins déclarés { dimension, satiete } (besoins.js) ;
//   causesPropres : identités des observations de source « soi » (itérable) ;
//   couts         : identités des VARIATIONS qui sont le coût d'une activité (itérable ; défaut : aucune) ;
//   aggravations  : [{ dimension, variation, valeurAvant, valeurApres, satiete }] dans l'ordre des conséquences reçues, HORS coûts d'activité ;
//   coutsDActivite: les conséquences aggravantes écartées parce que coût d'une activité (même forme), pour la lecture ;
//   occasion      : propre === false && aggravations.length > 0.
// CE QUE CETTE FONCTION NE FAIT PAS : écrire, agir, choisir, distinguer une dimension d'une autre, compter des occasions passées, lire une
// horloge. Une occasion n'est ni une décision, ni un motif, ni un acte : elle dit seulement pourquoi réévaluer MAINTENANT.
export function aggrave(besoin, valeurAvant, valeurApres) {
  if (besoin === null || typeof besoin !== 'object' || typeof besoin.satiete !== 'number') throw new TypeError('aggrave : besoin { satiete } requis.');
  if (typeof valeurAvant !== 'number' || typeof valeurApres !== 'number' || !Number.isFinite(valeurAvant) || !Number.isFinite(valeurApres)) throw new TypeError('aggrave : valeurs numériques requises.');
  return Math.abs(valeurApres - besoin.satiete) > Math.abs(valeurAvant - besoin.satiete);
}

export function occasionDEvenement({ evenement, consequences, besoins, causesPropres, couts = [] } = {}) {
  if (typeof evenement !== 'string' || evenement.length === 0) throw new TypeError('occasionDEvenement : evenement doit être une chaîne non vide.');
  if (!Array.isArray(consequences)) throw new TypeError('occasionDEvenement : consequences doit être un tableau.');
  if (!Array.isArray(besoins)) throw new TypeError('occasionDEvenement : besoins doit être un tableau.');
  if (causesPropres === null || causesPropres === undefined || typeof causesPropres[Symbol.iterator] !== 'function') throw new TypeError('occasionDEvenement : causesPropres doit être itérable.');
  if (couts === null || couts === undefined || typeof couts[Symbol.iterator] !== 'function') throw new TypeError('occasionDEvenement : couts doit être itérable.');
  const propres = new Set(causesPropres);
  const coutsConnus = new Set(couts);
  const parDimension = new Map(besoins.map((b) => [b.dimension, b]));
  const propre = propres.has(evenement);
  const aggravations = [];
  const coutsDActivite = [];
  for (const c of consequences) {
    if (c === null || typeof c !== 'object' || c.cause === null || typeof c.cause !== 'object') throw new TypeError('occasionDEvenement : conséquence mal formée.');
    if (c.cause.id !== evenement) continue;
    const besoin = parDimension.get(c.dimension);
    if (besoin === undefined) continue;
    if (!aggrave(besoin, c.valeurAvant, c.valeurApres)) continue;
    (coutsConnus.has(c.variation) ? coutsDActivite : aggravations).push({ dimension: c.dimension, variation: c.variation, valeurAvant: c.valeurAvant, valeurApres: c.valeurApres, satiete: besoin.satiete });
  }
  return { evenement, propre, aggravations: propre ? [] : aggravations, coutsDActivite, occasion: !propre && aggravations.length > 0 };
}
// === FIN_LANGAGE_OCCASION ===
