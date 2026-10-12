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
//
// v0.63.89 — RELECTURE HISTORIQUE D'UN ÉPISODE (décision ChatGPT « ACCORD — SONDE « INDÉTERMINATION VÉCUE » », 11/10/2026). VUE PURE.
//   L'observation propre O FERME historiquement, par IDENTITÉS, ce que Naissance examinait : `donneesExaminees` contient les identités des données
//   d'état (c, r) et de TOUTES les exécutions de l'univers (productions, entrées, réceptions projetées). Rien d'autre n'est nécessaire :
//   relectureEpisode({ observation, vecu, consequences, couts, causesPropres, designations, variationsCapacite, emissions, besoins, etatsParDimension })
//     → { observation, evenement, occasion, etats, besoins, moyens, candidats, porte, autorises, engagements, cout, emission, resultat }
//   - etats : pour chaque dimension déclarée, l'identité d'état examinée par O et sa VALEUR (projection : identité → valeur) ;
//   - besoins : motif tel qu'il était à O (valeur à O ≠ satiété) ; porte : c à O > 0 ;
//   - moyens : moyensConnus (.87) sur le vécu RESTREINT aux exécutions dont l'identité figure dans donneesExaminees : un moyen appris APRÈS O, ou
//     une preuve ajoutée après O, n'apparaît jamais (fermeture par identités, pas par horodatage) ;
//   - candidats / autorises : mêmes règles que l'évaluation (productions distinctes citées par un besoin motivé ; autorisés si la porte était ouverte) ;
//   - engagements : les désignations d'origine « propre » portées par O ; cout : la variation de capacité causée par O ; emission : l'émission de O ;
//   - resultat (FACTUEL, dérivé) ∈ 'aucun candidat' | 'capacite insuffisante' | 'engagement' | 'plusieurs candidats sans engagement' |
//     'incoherence' (exactement un candidat autorisé à O et aucune désignation propre, ou une désignation sans candidat : interruption, erreur).
//   LIMITE DOCUMENTÉE : la fermeture est historique sur les FAITS ; la relecture dépend de la DÉFINITION logicielle de moyensConnus et de la
//   règle de candidature : si l'une évolue un jour, la relecture d'un O ancien évolue avec elle (compatibilité historique à réexaminer alors).
//   Aucune notion persistée d'indétermination, de choix ni d'hésitation : seulement « il y avait N moyens connus à O, la porte était ouverte,
//   aucune application n'a été désignée ».
// relireEpisode(magasin, observation) -> la relecture ci-dessus, lue depuis le magasin (aucune écriture).
// lireDernierEvenement(magasin) -> { evenement, occasion, episode } : la dernière cause persistée (variation la plus récente) et son occasion, avec
//   l'épisode éventuel : un résumé consultable même quand aucun épisode n'a été ouvert (lecture seule).
// v0.63.92 — ROTATION D'ACTUALISATION (décision ChatGPT « DÉCISION APRÈS MINI-CONCEPTION ROTATION », 12/10/2026) : 2+ stratégies autorisées dont les
//   noms d'opération sont TOUS distincts → engagement de la stratégie désignée par rotationDActualisation (successeur, dans l'ordre des noms, du dernier
//   engagement de la chaîne c appartenant à L ; sinon la première) ; noms en collision → silence pour toute l'occasion. Même engagement .91 (support,
//   1 D, 1 coût, 1 émission, aucune exécution). Relecture : rotation recalculée dans l'univers fermé de O ; sans D, « plusieurs candidats sans
//   engagement » reste un FAIT (aucune réinterprétation des O .88–.91).
// v0.63.91 — STRATÉGIES (décision ChatGPT « DÉCISION FINALE — PASSAGE AU CODE », 11/10/2026). Les candidats motivés sont des STRATÉGIES = applications
//   { operation, liaisons } (besoins.js : moyensParStrategie, cleApplication), et non plus des productions historiques : plusieurs occurrences de la même
//   application (réexécutions du lot, DT6 non corrigé) sont UNE stratégie. 0 → rien ; 1 → engagement ; 2+ → silence (aucune rotation, aucune préférence).
//   ENGAGEMENT : la désignation propre garde son format .88 (environnement:conversation(emis = production)) ; la production émise est l'OCCURRENCE SUPPORT
//   de la stratégie (première preuve dans l'ordre causal de la chaîne d'état ; ancienneté ASSUMÉE et limitée au support) ; AUCUNE nouvelle exécution.
//   Une réponse à cette émission ajoute une preuve à une occurrence de la MÊME application, donc à la même stratégie. RELECTURE : stratégies à O dans
//   l'univers fermé ; « engagement » ssi une seule stratégie autorisée et une seule D propre dont la production émise a la même application
//   (les D .88 à production exacte restent relues « engagement »).
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
import { BESOINS, IDENTITE_ETAT_APRES, lireBesoins, motifDuBesoin, moyensConnus, moyensParStrategie, cleApplication } from './besoins.js';
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

// ÉVALUATION GLOBALE (lecture pure) : tous les besoins ; candidats motivés = STRATÉGIES DISTINCTES (v0.63.91 : applications { operation, liaisons },
// et non plus productions historiques) citées par au moins un besoin actuellement hors satiété, avec les raisons (besoin, preuves de toutes les
// occurrences) ; porte B1 ; autorisés = motivés si la porte est ouverte. 0 → aucun candidat ; 1 → engagement possible ; 2+ → silence (aucune rotation).
// Chaque candidat porte `production` = l'occurrence SUPPORT de la stratégie (convention de support, besoins.js : jamais un critère entre stratégies).
export async function evaluer(magasin) {
  exigerMagasin(magasin, 'evaluer');
  const besoins = await lireBesoins(magasin);
  const capacite = await lireCapacite(magasin);
  const candidats = candidatsMotives(besoins);
  const porte = peutAgir(capacite);
  const autorises = porte ? candidats : [];
  // v0.63.92 : rotation d'actualisation (seulement si 2+ autorisés) ; engagements lus dans la chaîne c COMPLÈTE (= jusqu'à l'état courant).
  const rotation = autorises.length > 1 ? rotationDActualisation(autorises, engagementsParChaine({ variationsCapacite: await magasin.lireTout('variationsCapacite'), designations: await magasin.lireTout('designations'), executions: (await lireExecutionsVecues(magasin)).executions })) : null;
  return { besoins, capacite: capacite.valeur, candidats, porte, autorises, rotation };
}

// v0.63.92 — ROTATION D'ACTUALISATION ENTRE STRATÉGIES (décision ChatGPT « DÉCISION APRÈS MINI-CONCEPTION ROTATION », 12/10/2026). PURE.
// Ni préférence, ni apprentissage de valeur, ni exploration, ni score : une primitive d'ACTION entre stratégies équivalentes pour le besoin motivé.
//   L = les stratégies autorisées (2+). ORDONNABLE ssi leurs noms d'opération sont TOUS distincts ; ordre = noms croissants (comparaison par unités de
//   code : le précédent déterministe « sans signification » du catalogue et du tri canonique par nom d'opération du lot .60). Deux stratégies de même opération → NON ordonnable
//   → SILENCE pour toute l'occasion (jamais de retrait partiel, jamais de départage par identité, horodatage, ancienneté, récence, contenu, hash,
//   fréquence ou hasard).
//   P = le dernier engagement propre, dans l'ORDRE CAUSAL de la chaîne c, dont la stratégie appartient à L (les engagements hors de L sont sautés).
//   Actualisation : aucun P → L[0] ; sinon le successeur de P dans L, circulairement. Les occurrences d'une stratégie ne participent jamais.
// rotationDActualisation(autorises, engagements) -> { ordonnable, ordre: [operation…], precedent: operation|null, actualisee: candidat|null }
const comparerCodes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export function rotationDActualisation(autorises, engagements) {
  if (!Array.isArray(autorises) || !Array.isArray(engagements)) throw new TypeError('rotationDActualisation : autorises et engagements doivent être des tableaux.');
  const noms = autorises.map((c) => c.operation);
  if (new Set(noms).size !== noms.length) return { ordonnable: false, ordre: [...noms].sort(comparerCodes), precedent: null, actualisee: null };
  const L = [...autorises].sort((a, b) => comparerCodes(a.operation, b.operation));
  const cles = L.map((c) => cleApplication(c.application));
  let indice = -1;
  for (let i = engagements.length - 1; i >= 0 && indice < 0; i -= 1) indice = cles.indexOf(engagements[i].cle);
  const actualisee = indice < 0 ? L[0] : L[(indice + 1) % L.length];
  return { ordonnable: true, ordre: L.map((c) => c.operation), precedent: indice < 0 ? null : L[indice].operation, actualisee };
}

// Les engagements propres dans l'ORDRE CAUSAL de la chaîne c (origine → idEtatAvant → état d'après), sans horloge : chaque coût d'engagement porte
// idDesignation = D propre ; D émet une production dont l'application donne la clé de stratégie. `jusquA` (identité d'état) ferme la lecture à un
// état donné (relecture d'un O historique : l'état c examiné par O) ; sans `jusquA`, toute la chaîne.
export function engagementsParChaine({ variationsCapacite, designations, executions, jusquA = null }) {
  if (!Array.isArray(variationsCapacite) || !Array.isArray(designations) || !Array.isArray(executions)) throw new TypeError('engagementsParChaine : tableaux requis.');
  const etatApres = IDENTITE_ETAT_APRES.capacite;
  const suite = new Map(variationsCapacite.filter((v) => v && typeof v.idEtatAvant === 'string').map((v) => [v.idEtatAvant, v]));
  const apres = new Set(variationsCapacite.map((v) => etatApres(v)));
  const origines = [...suite.keys()].filter((e) => !apres.has(e));
  if (origines.length > 1) throw new TypeError('engagementsParChaine : chaîne c discontinue (plusieurs origines).');
  const propres = new Map(designations.filter((d) => d && d.origine === ORIGINE_PROPRE).map((d) => [d.id, d]));
  const execution = new Map(executions.map((x) => [x.id, x]));
  const out = [];
  let etat = origines[0];
  let pas = 0;
  while (etat !== undefined && etat !== jusquA && suite.has(etat)) {
    const v = suite.get(etat);
    const d = typeof v.idDesignation === 'string' ? propres.get(v.idDesignation) : undefined;
    const x = d ? execution.get(d.liaisons[0].donnee) : undefined;
    if (x) out.push({ designation: d.id, production: x.id, cle: cleApplication(x) });
    etat = etatApres(v);
    pas += 1;
    if (pas > variationsCapacite.length) throw new TypeError('engagementsParChaine : chaîne c cyclique.');
  }
  return out;
}

// Candidats motivés à partir des besoins (motif + strategies) : une stratégie citée par plusieurs besoins est UN candidat. Ordre : celui des stratégies
// (causal, sans signification) dans l'ordre des besoins déclarés ; il ne sert à rien d'autre qu'à l'affichage.
function candidatsMotives(besoins) {
  const parCle = new Map();
  for (const b of besoins) {
    if (b.motif !== true) continue;
    for (const s of b.strategies) {
      const cle = cleApplication(s.application);
      const c = parCle.get(cle) ?? { production: s.occurrenceSupport, operation: s.operation, application: s.application, occurrences: s.occurrences, raisons: [] };
      c.raisons.push({ besoin: b.besoin, preuves: s.preuves.map((p) => ({ production: p.production, emission: p.emission, reception: p.reception, valeurAvant: p.valeurAvant, valeurApres: p.valeurApres })) });
      parCle.set(cle, c);
    }
  }
  return [...parCle.values()];
}

function statutDeLEvaluation(evaluation) {
  if (evaluation.candidats.length === 0) return 'aucun acte - 0 candidat';
  if (!evaluation.porte) return 'aucun acte - capacite insuffisante';
  if (evaluation.autorises.length > 1 && !(evaluation.rotation && evaluation.rotation.ordonnable)) return `aucun acte - ${evaluation.autorises.length} candidats`;
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
  const A = evaluation.autorises.length === 1 ? evaluation.autorises[0] : evaluation.rotation.actualisee; // v0.63.92 : 2+ ordonnables → stratégie actualisée par la rotation
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

const RESULTATS = Object.freeze({ aucun: 'aucun candidat', capacite: 'capacite insuffisante', engagement: 'engagement', plusieurs: 'plusieurs candidats sans engagement', incoherence: 'incoherence' });
export const RESULTATS_RELECTURE = RESULTATS;

// Les identités d'état de chaque dimension déclarée (origine + états d'après de chaque variation) : pour retrouver, par identité, l'état examiné par O.
export async function etatsParDimension(magasin) {
  exigerMagasin(magasin, 'etatsParDimension');
  const out = {};
  for (const besoin of BESOINS) {
    const t = TABLES_ETAT[besoin.dimension];
    const ids = new Set((await magasin.lireTout(t.initiale)).map((o) => o.id));
    for (const v of await magasin.lireTout(t.variations)) ids.add(IDENTITE_ETAT_APRES[besoin.dimension](v));
    out[besoin.dimension] = ids;
  }
  return out;
}

export function relectureEpisode({ observation, vecu, consequences, couts, causesPropres, designations, variationsCapacite, emissions, besoins = BESOINS, etatsParDimension: etats } = {}) {
  if (observation === null || typeof observation !== 'object' || typeof observation.id !== 'string' || !Array.isArray(observation.donneesExaminees)) throw new TypeError('relectureEpisode : observation propre { id, donneesExaminees } requise.');
  if (vecu === null || typeof vecu !== 'object' || !Array.isArray(vecu.valeurs) || !Array.isArray(vecu.executions)) throw new TypeError('relectureEpisode : vecu { valeurs, executions } requis.');
  for (const [nom, l] of [['consequences', consequences], ['couts', couts], ['causesPropres', causesPropres], ['designations', designations], ['variationsCapacite', variationsCapacite], ['emissions', emissions], ['besoins', besoins]]) if (!Array.isArray(l)) throw new TypeError(`relectureEpisode : ${nom} doit être un tableau.`);
  if (etats === null || typeof etats !== 'object') throw new TypeError('relectureEpisode : etatsParDimension requis.');
  const examinees = new Set(observation.donneesExaminees);
  const valeur = new Map(vecu.valeurs.map((v) => [v.id, v.valeur]));
  const evenement = typeof observation.occasion === 'string' ? observation.occasion : null;
  const occasion = evenement === null ? null : occasionDEvenement({ evenement, consequences, besoins, causesPropres, couts });
  // états à O : l'identité d'état de chaque dimension présente dans les données examinées (une seule attendue)
  const etatsO = {};
  for (const b of besoins) {
    const ids = observation.donneesExaminees.filter((id) => etats[b.dimension] instanceof Set && etats[b.dimension].has(id));
    etatsO[b.dimension] = ids.length === 1 && valeur.has(ids[0]) ? { id: ids[0], valeur: valeur.get(ids[0]) } : null;
  }
  // univers fermé de O : seules les exécutions examinées par O
  const vecuO = { valeurs: vecu.valeurs, executions: vecu.executions.filter((e) => examinees.has(e.id)), descriptions: vecu.descriptions };
  const besoinsO = besoins.map((b) => {
    const etat = etatsO[b.dimension];
    const motif = etat === null ? null : motifDuBesoin(b, { valeur: etat.valeur });
    return { ...(motif ?? { besoin: b.dimension, valeurActuelle: null, satiete: b.satiete, motif: null }), ...moyensConnus(vecuO, b), strategies: moyensParStrategie(vecuO, b).strategies };
  });
  // v0.63.91 : candidats = STRATÉGIES à O (univers fermé), comme l'évaluation vivante.
  const candidats = candidatsMotives(besoinsO);
  const capacite = etatsO.capacite;
  const porte = capacite === null ? null : peutAgir({ valeur: capacite.valeur });
  const autorises = porte === true ? candidats : [];
  const propres = designations.filter((d) => d && d.idObservation === observation.id && d.origine === ORIGINE_PROPRE);
  const cout = variationsCapacite.find((v) => v && v.cause && v.cause.id === observation.id) ?? null;
  const emission = propres.length === 0 ? null : (emissions.find((e) => e && e.idObservation === observation.id && e.idExecution === propres[0].liaisons[0].donnee) ?? null);
  let resultat;
  // v0.63.91 : l'engagement actualise la STRATÉGIE autorisée ; la production émise (support, ou production exacte .88) doit appartenir à cette
  // application : même clé d'application (exécution lue dans le vécu complet), sans exiger une occurrence particulière.
  const execution = new Map(vecu.executions.map((e) => [e.id, e]));
  const emise = propres.length === 1 ? execution.get(propres[0].liaisons[0].donnee) : undefined;
  const memeStrategie = (candidat) => emise !== undefined && candidat !== null && cleApplication(emise) === cleApplication(candidat.application);
  // v0.63.92 : rotation RECALCULÉE à O (univers fermé : stratégies à O ; engagements de la chaîne c jusqu'à l'état c examiné par O). Relecture
  // FACTUELLE : sans D, 2+ autorisés restent « plusieurs candidats sans engagement » (les O .88–.91 ont été vécus sous la règle « silence » et aucun
  // marqueur ne permet de les distinguer : rien n'est réinterprété) ; avec une D, « engagement » si elle actualise le choix reconstructible.
  const rotation = autorises.length > 1 && capacite !== null ? rotationDActualisation(autorises, engagementsParChaine({ variationsCapacite, designations, executions: vecu.executions, jusquA: capacite.id })) : null;
  if (propres.length === 1 && autorises.length === 1 && memeStrategie(autorises[0])) resultat = RESULTATS.engagement;
  else if (propres.length === 1 && rotation !== null && rotation.ordonnable && memeStrategie(rotation.actualisee)) resultat = RESULTATS.engagement;
  else if (propres.length > 0) resultat = RESULTATS.incoherence;
  else if (candidats.length === 0) resultat = RESULTATS.aucun;
  else if (porte !== true) resultat = RESULTATS.capacite;
  else if (autorises.length > 1) resultat = RESULTATS.plusieurs;
  else resultat = RESULTATS.incoherence;
  return { observation, evenement, occasion, etats: etatsO, besoins: besoinsO, candidats, porte, autorises, engagements: propres, cout, emission, rotation, resultat };
}

// LECTURE SEULE : relecture d'une observation propre depuis le magasin.
export async function relireEpisode(magasin, observation) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') throw new TypeError('relireEpisode : magasin doit offrir lireTout.');
  const [vecu, consequences, couts, propres, designations, variationsCapacite, emissions, etats] = await Promise.all([lireExecutionsVecues(magasin), lireConsequences(magasin), coutsDActivite(magasin), causesPropres(magasin), magasin.lireTout('designations'), magasin.lireTout('variationsCapacite'), magasin.lireTout('emissions'), etatsParDimension(magasin)]);
  return relectureEpisode({ observation, vecu, consequences, couts, causesPropres: propres, designations, variationsCapacite, emissions, etatsParDimension: etats });
}

// LECTURE SEULE : le dernier épisode propre (observation portant `occasion`, la plus récente), relu historiquement ; null s'il n'y en a aucun.
export async function lireDernierEpisode(magasin) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') throw new TypeError('lireDernierEpisode : magasin doit offrir lireTout.');
  const episodes = (await magasin.lireTout('observationsPossibilites')).filter((o) => o && o.source === SOURCE_OBSERVATION_INTERNE && typeof o.occasion === 'string');
  if (episodes.length === 0) return null;
  const O = episodes.reduce((a, b) => (a.horodatage <= b.horodatage ? b : a));
  return relireEpisode(magasin, O);
}

// LECTURE SEULE : le dernier ÉVÉNEMENT RÉEL persisté (la cause, hors activité propre, de la variation d'état la plus récente), son occasion recalculée et
// l'épisode qu'il a ouvert s'il existe : consultable même quand aucun épisode n'a été ouvert. null sans aucune variation.
export async function lireDernierEvenement(magasin) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') throw new TypeError('lireDernierEvenement : magasin doit offrir lireTout.');
  const propres = new Set(await causesPropres(magasin));
  let derniere = null;
  // la dernière variation dont la cause n'est PAS une activité propre : le coût d'un épisode n'est pas un événement (sa cause est O, source soi).
  for (const besoin of BESOINS) for (const v of await magasin.lireTout(TABLES_ETAT[besoin.dimension].variations)) if (v && typeof v.horodatage === 'string' && v.cause && !propres.has(v.cause.id) && (derniere === null || derniere.horodatage <= v.horodatage)) derniere = v;
  if (derniere === null) return null;
  const evenement = derniere.cause.id;
  const occasion = occasionDEvenement({ evenement, consequences: await lireConsequences(magasin), besoins: BESOINS, causesPropres: [...propres], couts: await coutsDActivite(magasin) });
  const O = await episodeDeLOccasion(magasin, evenement);
  return { evenement, type: derniere.cause.type, occasion, episode: O === null ? null : await relireEpisode(magasin, O) };
}
// === FIN_LANGAGE_EPISODE_PROPRE ===
