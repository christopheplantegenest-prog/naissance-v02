// === DEBUT_LANGAGE_EPISODE_PROPRE ===
// v0.63.88 — ÉPISODE PROPRE : PREMIÈRE INITIATIVE MOTIVÉE MINIMALE (décision ChatGPT « ORDRE DE DÉVELOPPEMENT v0.63.88 », 11/10/2026 ; issue des
// sondes « acte motivé », « épisode propre » et « occasion »).
//
//   événement réel E (tick, observation d'un message, réception) → ses conséquences persistées → OCCASION ? (occasion.js : E a aggravé un besoin
//   déclaré et n'est pas une activité propre) → observation propre O (source soi, datum c, complément r, univers = vécu projeté, `occasion` = E) →
//   ÉVALUATION GLOBALE (tous les besoins : état, motif, moyens connus — vues .87) → candidats motivés (productions exactes DISTINCTES) → porte B1
//   (peutAgir) → candidats autorisés → si EXACTEMENT UN : ENGAGEMENT D (désignation propre de environnement:conversation(emis = A)) → COÛT B1 (une
//   variation, cause tour = O.id, idDesignation = D.id) → ÉMISSION E2 (nouvelle émission de la production exacte A, idObservation = O.id, prospection
//   .83 conservée) → conséquence vécue (une réception éventuelle ramène r à 0 : nouvelle preuve de A, par les vues .87).
//
// CE QUE CE MODULE NE FAIT PAS : départager deux candidats (2+ → aucun acte, indétermination visible) ; agir sans candidat (0 → rien ; aucune
// exploration) ; réexécuter, reconstruire ou généraliser A (seule la production exacte ancienne est réémise) ; scorer, compter, préférer, temporiser ;
// ouvrir une occasion sur son propre coût (sa cause est O, source soi) ; agir au chargement (rien ici n'est appelé sans événement).
//
// IDENTITÉS : O = l'épisode (observation propre, portant `occasion` = E : une occasion est CONSOMMÉE ssi une telle observation existe — aucune
// table) ; D = l'engagement ; la variation de capacité = le coût (cause tour:O.id, idDesignation D.id : un second coût pour O est refusé par
// « une cause, une variation » → un épisode = au plus une initiative) ; E2 = l'émission (idExecution = A, idObservation = O.id). D ↔ E2 : même
// idObservation et D.emis = E2.idExecution, non ambigu puisqu'un épisode ne contient qu'une initiative. Tout est reconstruit du magasin.
//
// traiterOccasion(magasin, evenement) -> compte rendu { evenement, occasion, statut, observation, evaluation, engagement, cout, emission, echec }
//   statut ∈ 'aucune occasion' | 'occasion deja consommee' | 'aucun acte - 0 candidat' | 'aucun acte - capacite insuffisante' |
//            'aucun acte - N candidats' | 'engagement' | 'cout refuse' | 'emission refusee'
// lireDernierEpisode(magasin) -> le dernier épisode reconstruit depuis le magasin (lecture seule, pour l'affichage), ou null.
import { enregistrerObservationPossibilites, enregistrerDesignation } from './connaissances.js';
import { observerPossibilites } from './observation-possibilites.js';
import { lireExecutionsVecues } from './executions-vecues.js';
import { DESCRIPTION_SOURCE_SOI } from './source-soi.js';
import { DESCRIPTIONS_SOI, PREFIXE_SOI } from './projection-soi.js';
import { SOURCE_OBSERVATION_INTERNE } from './prospection-soi.js';
import { lireCapacite, tourActif, peutAgir } from './capacite.js';
import { lireRelation } from './relation.js';
import { emettreLot, NOM_ENVIRONNEMENT_CONVERSATION } from './environnement-conversation.js';
import { PREFIXE_ENVIRONNEMENT, ENTREE_EMISE } from './episodes-environnement.js';
import { BESOINS, IDENTITE_ETAT_APRES, lireBesoins } from './besoins.js';
import { occasionDEvenement } from './occasion.js';

export const ORIGINE_PROPRE = 'propre';
const OPERATION_EMISSION = PREFIXE_ENVIRONNEMENT + NOM_ENVIRONNEMENT_CONVERSATION;
// Où vivent les états de chaque dimension déclarée (mêmes tables que les projections .84/.86) : aucune règle n'en dépend, seule la LECTURE.
const TABLES_ETAT = Object.freeze({
  capacite: Object.freeze({ initiale: 'capaciteInitiale', variations: 'variationsCapacite' }),
  relation: Object.freeze({ initiale: 'relationInitiale', variations: 'variationsRelation' }),
});

function exigerMagasin(magasin, nom) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function' || typeof magasin.ecrire !== 'function') throw new TypeError(`${nom} : magasin doit offrir lireTout et ecrire.`);
}

// Les conséquences persistées de TOUS les événements : une ligne par variation d'état, valeurs d'avant retrouvées par identité d'état.
export async function lireConsequences(magasin) {
  exigerMagasin(magasin, 'lireConsequences');
  const out = [];
  for (const besoin of BESOINS) {
    const t = TABLES_ETAT[besoin.dimension];
    const apres = IDENTITE_ETAT_APRES[besoin.dimension];
    const valeur = new Map((await magasin.lireTout(t.initiale)).map((o) => [o.id, o.valeur]));
    const variations = await magasin.lireTout(t.variations);
    for (const v of variations) valeur.set(apres(v), v.valeur);
    for (const v of variations) {
      if (!valeur.has(v.idEtatAvant)) continue;
      out.push({ dimension: besoin.dimension, variation: v.id, cause: { type: v.cause.type, id: v.cause.id }, valeurAvant: valeur.get(v.idEtatAvant), valeurApres: v.valeur });
    }
  }
  return out;
}

// Les identités des observations propres (source soi) : les causes qui sont une activité propre.
async function causesPropres(magasin) {
  return (await magasin.lireTout('observationsPossibilites')).filter((o) => o && o.source === SOURCE_OBSERVATION_INTERNE).map((o) => o.id);
}
// Les identités des VARIATIONS qui sont le COÛT D'UNE ACTIVITÉ de Naissance (correction ChatGPT avant livraison, 11/10/2026), reconnues dans
// les faits persistés sans nommer message, B1, relation ni conversation : une désignation est un ACTE si son opération n'est pas une
// conséquence sur soi (préfixe « soi: », prospection-soi .85) ; une variation est un coût ssi elle est l'issue d'une désignation d'acte
// (idDesignation : l'engagement D d'un épisode propre) ou, sans idDesignation (lignes .84, tour mécanique), si sa cause est l'identité d'une
// observation où un acte a été désigné (le lot mécanique sollicité par un message). Les conséquences du temps et d'une réception sont
// désignées comme conséquences sur soi (soi:repos, soi:temps, soi:reception) : jamais des coûts.
export async function coutsDActivite(magasin) {
  exigerMagasin(magasin, 'coutsDActivite');
  const designations = await magasin.lireTout('designations');
  const parId = new Map(designations.map((d) => [d.id, d]));
  const estActe = (d) => d !== undefined && d !== null && typeof d.operation === 'string' && !d.operation.startsWith(PREFIXE_SOI);
  const observationsActives = new Set(designations.filter(estActe).map((d) => d.idObservation));
  const couts = [];
  for (const besoin of BESOINS) {
    for (const v of await magasin.lireTout(TABLES_ETAT[besoin.dimension].variations)) {
      if (v === null || typeof v !== 'object' || v.cause === null || typeof v.cause !== 'object') continue;
      const cout = typeof v.idDesignation === 'string' ? estActe(parId.get(v.idDesignation)) : observationsActives.has(v.cause.id);
      if (cout) couts.push(v.id);
    }
  }
  return couts;
}

// « Occasion consommée » : une observation propre porte déjà l'identité de cet événement.
export async function episodeDeLOccasion(magasin, evenement) {
  exigerMagasin(magasin, 'episodeDeLOccasion');
  return (await magasin.lireTout('observationsPossibilites')).find((o) => o && o.source === SOURCE_OBSERVATION_INTERNE && o.occasion === evenement) ?? null;
}

async function ouvrirEpisode(magasin, evenement) {
  const c = await lireCapacite(magasin);
  const r = await lireRelation(magasin);
  const vecu = await lireExecutionsVecues(magasin);
  const presents = new Set(vecu.descriptions.map((d) => d.nom));
  const descriptions = [...vecu.descriptions, ...DESCRIPTIONS_SOI.filter((d) => !presents.has(d.nom))];
  const o = await observerPossibilites({ id: c.idEtat, valeur: c.valeur, source: DESCRIPTION_SOURCE_SOI }, {
    enregistrer: (donnees) => enregistrerObservationPossibilites(magasin, { ...donnees, occasion: evenement }),
    lireExecutions: async () => vecu.executions,
    descriptions,
    descriptionSource: DESCRIPTION_SOURCE_SOI,
    source: SOURCE_OBSERVATION_INTERNE,
    complements: [{ id: r.idEtat, valeur: r.valeur, source: DESCRIPTION_SOURCE_SOI }],
  });
  if (o.statut !== 'ecrite') throw new TypeError(`episode propre : observation propre impossible (${o.statut}).`);
  return { observation: o.observation, univers: o.univers, capacite: c };
}

// ÉVALUATION GLOBALE (lecture pure) : tous les besoins ; candidats motivés = productions exactes DISTINCTES citées par au moins un besoin
// actuellement hors satiété, avec les raisons (besoin, preuves) ; porte B1 ; autorisés = motivés si la porte est ouverte.
export async function evaluer(magasin) {
  exigerMagasin(magasin, 'evaluer');
  const besoins = await lireBesoins(magasin);
  const capacite = await lireCapacite(magasin);
  const parProduction = new Map();
  for (const b of besoins) {
    if (!b.motif) continue;
    for (const m of b.moyens) {
      const c = parProduction.get(m.production) ?? { production: m.production, operation: m.operation, raisons: [] };
      c.raisons.push({ besoin: b.besoin, preuves: m.preuves.map((p) => ({ emission: p.emission, reception: p.reception, valeurAvant: p.valeurAvant, valeurApres: p.valeurApres })) });
      parProduction.set(m.production, c);
    }
  }
  const candidats = [...parProduction.values()].sort((a, b) => (a.production < b.production ? -1 : a.production > b.production ? 1 : 0));
  const porte = peutAgir(capacite);
  return { besoins, capacite: capacite.valeur, candidats, porte, autorises: porte ? candidats : [] };
}

function statutDeLEvaluation(evaluation) {
  if (evaluation.candidats.length === 0) return 'aucun acte - 0 candidat';
  if (!evaluation.porte) return 'aucun acte - capacite insuffisante';
  if (evaluation.autorises.length > 1) return `aucun acte - ${evaluation.autorises.length} candidats`;
  return 'engagement';
}

export async function traiterOccasion(magasin, evenement) {
  exigerMagasin(magasin, 'traiterOccasion');
  if (typeof evenement !== 'string' || evenement.length === 0) throw new TypeError('traiterOccasion : evenement doit être une chaîne non vide.');
  const occasion = occasionDEvenement({ evenement, consequences: await lireConsequences(magasin), besoins: BESOINS, causesPropres: await causesPropres(magasin), couts: await coutsDActivite(magasin) });
  const rendu = { evenement, occasion, statut: 'aucune occasion', observation: null, evaluation: null, engagement: null, cout: null, emission: null, echec: null };
  if (!occasion.occasion) return rendu;
  const deja = await episodeDeLOccasion(magasin, evenement);
  if (deja !== null) return { ...rendu, statut: 'occasion deja consommee', observation: deja };
  const { observation } = await ouvrirEpisode(magasin, evenement);
  rendu.observation = observation;
  const evaluation = await evaluer(magasin);
  rendu.evaluation = evaluation;
  rendu.statut = statutDeLEvaluation(evaluation);
  if (rendu.statut !== 'engagement') return rendu;
  const A = evaluation.autorises[0];
  const application = { operation: OPERATION_EMISSION, liaisons: [{ entree: ENTREE_EMISE, donnee: A.production }] };
  rendu.engagement = await enregistrerDesignation(magasin, { observation, application, origine: ORIGINE_PROPRE });
  try {
    const t = await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage, idDesignation: rendu.engagement.id });
    rendu.cout = { variation: t.variation, avant: t.avant, apres: t.apres };
  } catch (echec) {
    return { ...rendu, statut: 'cout refuse', echec };
  }
  const { emises, echec } = await emettreLot({ resultats: [{ statut: 'executee', execution: { id: A.production }, operation: A.operation }] }, { magasin, idObservation: observation.id });
  if (echec !== null || emises.length === 0) return { ...rendu, statut: 'emission refusee', echec: echec ?? new TypeError('emission refusee : aucune ligne émise.') };
  rendu.emission = emises[0];
  return rendu;
}

// LECTURE SEULE : le dernier épisode propre, reconstruit depuis le magasin (observation portant `occasion`, désignation propre, coût, émission).
export async function lireDernierEpisode(magasin) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') throw new TypeError('lireDernierEpisode : magasin doit offrir lireTout.');
  const episodes = (await magasin.lireTout('observationsPossibilites')).filter((o) => o && o.source === SOURCE_OBSERVATION_INTERNE && typeof o.occasion === 'string');
  if (episodes.length === 0) return null;
  const O = episodes.reduce((a, b) => (a.horodatage <= b.horodatage ? b : a));
  const engagement = (await magasin.lireTout('designations')).find((d) => d.idObservation === O.id && d.origine === ORIGINE_PROPRE) ?? null;
  const cout = (await magasin.lireTout('variationsCapacite')).find((v) => v.cause && v.cause.id === O.id) ?? null;
  const emission = engagement === null ? null : ((await magasin.lireTout('emissions')).find((e) => e.idObservation === O.id && e.idExecution === engagement.liaisons[0].donnee) ?? null);
  const occasion = occasionDEvenement({ evenement: O.occasion, consequences: await lireConsequences(magasin), besoins: BESOINS, causesPropres: await causesPropres(magasin), couts: await coutsDActivite(magasin) });
  return { evenement: O.occasion, occasion, observation: O, engagement, cout, emission };
}
// === FIN_LANGAGE_EPISODE_PROPRE ===
