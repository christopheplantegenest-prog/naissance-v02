// === DEBUT_LANGAGE_TICK_PROPRE ===
// v0.63.86 — LE TICK DE TEMPS PROPRE À DEUX CONSÉQUENCES (décision ChatGPT « APRÈS VALIDATION TÉLÉPHONE v0.63.85 », 10/10/2026).
// Généralise le tick de v0.63.85 (capacite.js) : UN événement causal T, UNE observation interne O, PLUSIEURS conséquences désignées.
//
// ORDRE PROSPECTIF OBLIGATOIRE :
//   T (fait de temps propre, identité nouvelle)
//   → O : observation interne des états propres AVANT conséquence — datum principal = l'état de capacité c, complément = l'état relationnel r
//         (même mécanisme que l'observation d'un message : même catalogue réel + DESCRIPTIONS_SOI, description de source déclarée
//         DESCRIPTION_SOURCE_SOI, forme nombre, AUCUNE chaîne de texte ; ligne persistée avec source = 'soi', idMessage = identité de c,
//         donneesExaminees = [c, r] ; une seule observation pour les deux états : « ce qui est actuellement présent »)
//   → D1 : désignation de « soi:repos(etat = c) » parmi les possibilités de O (table designations, idObservation = O.id, origine 'mecanique')
//   → D2 : désignation de « soi:temps(etat = r) » parmi les possibilités de O
//   → contextes/attentes des deux conséquences (.72/.74, ancrés D1 puis D2)
//   → V1 : variation de c (cause = T, idDesignation = D1) ; V2 : variation de r (cause = T, idDesignation = D2)
//   → issues calculables (.73) : une exécution projetée par désignation, jamais deux sous la même identité.
// Aucune désignation n'est créée après sa variation. L'observation constate les états AVANT les conséquences.
// L'observation interne N'APPELLE PAS le déclencheur mécanique (.60) : ses possibilités déterminées (sur les productions passées, et
// la structure des états) restent OBSERVÉES ; aucune exécution, aucune émission, aucun tourActif, aucune boucle, aucune cadence : le tick
// est déclenché par le bouton « Repos » (dispositif de validation du temps propre), rien d'autre.
// Une observation ou une désignation impossible = tick refusé (erreur rendue à l'appelant) : jamais une variation sans identité propre.
// Aucune somme c/r, aucun score, aucune lecture de l'un pour décider de l'autre.
import { enregistrerDesignation, enregistrerObservationPossibilites, nouvelId } from './connaissances.js';
import { observerPossibilites } from './observation-possibilites.js';
import { DESCRIPTIONS_OPERATIONS } from './descriptions-operations.js';
import { DESCRIPTION_SOURCE_SOI } from './source-soi.js';
import { DESCRIPTIONS_SOI } from './projection-soi.js';
import { SOURCE_OBSERVATION_INTERNE, ORIGINE_CONSEQUENCE } from './prospection-soi.js';
import { lireCapacite, applicationRepos, prospecterRepos, varierRepos, PARAMETRES_B1 } from './capacite.js';
import { lireRelation, applicationTemps, prospecterTemps, varierTemps, PARAMETRES_B2 } from './relation.js';

function exigerMagasin(magasin, nom) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function' || typeof magasin.ecrire !== 'function') throw new TypeError(`${nom} : magasin doit offrir lireTout et ecrire.`);
}

async function observerEtatsPropres(magasin, c, r) {
  const descriptions = [...DESCRIPTIONS_OPERATIONS, ...DESCRIPTIONS_SOI];
  const datum = { id: c.idEtat, valeur: c.valeur, source: DESCRIPTION_SOURCE_SOI };
  const complement = { id: r.idEtat, valeur: r.valeur, source: DESCRIPTION_SOURCE_SOI };
  const o = await observerPossibilites(datum, {
    enregistrer: (donnees) => enregistrerObservationPossibilites(magasin, donnees),
    lireExecutions: () => magasin.lireTout('executionsOperations'),
    descriptions,
    descriptionSource: DESCRIPTION_SOURCE_SOI,
    source: SOURCE_OBSERVATION_INTERNE,
    complements: [complement],
  });
  if (o.statut !== 'ecrite') throw new TypeError(`tickPropre : observation interne impossible (${o.statut}).`);
  return { observation: o.observation, univers: o.univers };
}

export async function tickPropre(magasin, { parametresB1 = PARAMETRES_B1, parametresB2 = PARAMETRES_B2 } = {}) {
  exigerMagasin(magasin, 'tickPropre');
  const tick = { id: nouvelId('tick-propre'), horodatage: new Date().toISOString() };
  const c = await lireCapacite(magasin, parametresB1);
  const r = await lireRelation(magasin);
  const { observation, univers } = await observerEtatsPropres(magasin, c, r);
  const d1 = await enregistrerDesignation(magasin, { observation, application: applicationRepos(c), origine: ORIGINE_CONSEQUENCE });
  const d2 = await enregistrerDesignation(magasin, { observation, application: applicationTemps(r), origine: ORIGINE_CONSEQUENCE });
  const prospection = await prospecterRepos(magasin, d1);
  const prospectionRelation = await prospecterTemps(magasin, d2);
  const b1 = await varierRepos(magasin, { tick, designation: d1, avant: c }, parametresB1);
  const b2 = await varierTemps(magasin, { tick, designation: d2, avant: r }, parametresB2);
  return {
    tick, observation, univers,
    // B1 (contrat .85 conservé : designation, variation, avant, apres, prospection)
    designation: d1, variation: b1.variation, avant: b1.avant, apres: b1.apres, prospection,
    // B2
    relation: { designation: d2, variation: b2.variation, avant: b2.avant, apres: b2.apres, prospection: prospectionRelation },
  };
}
// Alias de compatibilité (v0.63.85 : capacite.tickRepos) — le tick réel est tickPropre, avec ses deux conséquences.
export const tickRepos = tickPropre;
// === FIN_LANGAGE_TICK_PROPRE ===
