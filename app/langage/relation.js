// === DEBUT_LANGAGE_RELATION ===
// v0.63.86 — B2 : BESOIN RELATIONNEL (décision ChatGPT « APRÈS VALIDATION TÉLÉPHONE v0.63.85 », 10/10/2026 ; issue de la sonde B2 du 10/10).
//
// DEUXIÈME BESOIN PRIMITIF PROGRAMMÉ de Naissance, même patron que B1 (capacite.js). Un ÉTAT PROPRE r ∈ [0, plafond] = TENSION RELATIONNELLE :
//   - r = 0 : besoin relationnel rassasié ; r = plafond : tension maximale ; origine r = 0 (écrite au premier besoin de la lire, jamais avant : aucune
//     reconstruction rétroactive d'un état relationnel historique) ;
//   - TICK de temps propre : r → min(plafond, r + montee) (conséquence désignée par le tick, tick-propre.js) ;
//   - RÉCEPTION DÉCLARÉE (une ligne de la table receptions reliée à une émission par le geste « Répondre » : « le monde répond à quelque chose que
//     j'ai émis ») : r → 0 ; à r = 0 : r reste 0 (un vrai fait vécu « egale »). Un message ordinaire sans référence ne change JAMAIS r. Aucune lecture
//     de contenu : « oui », « non », une phrase quelconque ont le même statut structurel. Aucune analyse du retard : la satisfaction a lieu au moment
//     RÉEL de la déclaration, quel que soit l'âge de l'émission.
//   - SILENCE : aucune réception n'est pas une « non-réception » : aucun fait, aucune issue négative, aucune attente « personne ne répond » ; r monte
//     avec le temps jusqu'au plafond et y reste. Absence d'attente ≠ prédiction de silence.
//   - AUCUNE ORIENTATION dans cette version : r est un état vécu, il n'influence aucune décision (ni le lot, ni l'émission, ni rien) ; aucune somme
//     avec c, aucun score, aucune préférence, aucune récompense. Naissance A le besoin ; elle ne sait pas encore quoi faire à cause de lui.
//
// PARAMETRES_B2 : les SEULS nombres de B2, PARAMÈTRES PRIMITIFS PROVISOIRES (décision du 10/10) : plafond 3, montée 1 par tick.
//
// CONSÉQUENCES DÉSIGNÉES (principe X1, v0.63.85) : chaque transformation de r est l'issue d'une application DÉSIGNÉE dans une observation interne :
//   - tick : « soi:temps(etat = r courant) », désignée dans l'observation interne du tick (à côté de soi:repos pour c) ;
//   - réception : « soi:reception(etat = r courant, recu = la réception) », désignée dans une observation interne déclenchée par la réception, dont
//     l'univers contient le vécu projeté (la réception y est la production de l'opérateur environnement:conversation) : la liaison `recu` fait que les
//     mécanismes .69/.70 forment d'eux-mêmes les familles « … > environnement:conversation > soi:reception » (sonde B2). L'identité de la réception
//     n'est JAMAIS réutilisée comme idDesignation (.85) : cause = la réception, désignation = D, variation = V.
// Ordre prospectif OBLIGATOIRE : événement → observation interne (états AVANT conséquence) → désignation → contextes/attentes → variation → issue.
// L'observation interne N'APPELLE JAMAIS le déclencheur mécanique : rien n'est exécuté, rien n'est émis.
import { enregistrerRelationInitiale, enregistrerVariationRelation, enregistrerDesignation, enregistrerObservationPossibilites } from './connaissances.js';
import { observerPossibilites } from './observation-possibilites.js';
import { lireExecutionsVecues } from './executions-vecues.js';
import { DESCRIPTION_SOURCE_SOI } from './source-soi.js';
import { identiteEtatRelationApres, PREFIXE_SOI, ENTREE_ETAT, ENTREE_RECU, DESCRIPTIONS_SOI } from './projection-soi.js';
import { prospecterConsequence, SOURCE_OBSERVATION_INTERNE, ORIGINE_CONSEQUENCE } from './prospection-soi.js';

export const PARAMETRES_B2 = Object.freeze({ plafond: 3, montee: 1 });
export const CAUSE_TICK = 'tick';
export const CAUSE_RECEPTION = 'reception';

function exigerMagasin(magasin, nom) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function' || typeof magasin.ecrire !== 'function') throw new TypeError(`${nom} : magasin doit offrir lireTout et ecrire.`);
}

// L'état relationnel courant : { idEtat, valeur, origine, derniere, nombreVariations }. Écrit l'origine (r = 0) si elle n'existe pas encore.
export async function lireRelation(magasin) {
  exigerMagasin(magasin, 'lireRelation');
  let origines = await magasin.lireTout('relationInitiale');
  if (!Array.isArray(origines)) throw new TypeError('lireRelation : la table relationInitiale doit rendre un tableau.');
  if (origines.length === 0) origines = [await enregistrerRelationInitiale(magasin, { valeur: 0 })];
  if (origines.length > 1) throw new TypeError('lireRelation : plusieurs origines de relation (une seule attendue).');
  const origine = origines[0];
  const variations = await magasin.lireTout('variationsRelation');
  if (!Array.isArray(variations)) throw new TypeError('lireRelation : la table variationsRelation doit rendre un tableau.');
  const suites = new Map();
  for (const v of variations) {
    if (v === null || typeof v !== 'object' || typeof v.idEtatAvant !== 'string') throw new TypeError('lireRelation : variation mal formée.');
    if (suites.has(v.idEtatAvant)) throw new TypeError(`lireRelation : deux variations partent de l'état « ${v.idEtatAvant} » (fourche).`);
    suites.set(v.idEtatAvant, v);
  }
  let idEtat = origine.id;
  let valeur = origine.valeur;
  let derniere = null;
  let pas = 0;
  while (suites.has(idEtat)) {
    derniere = suites.get(idEtat);
    idEtat = identiteEtatRelationApres(derniere);
    valeur = derniere.valeur;
    pas += 1;
    if (pas > variations.length) throw new TypeError('lireRelation : chaîne de variations cyclique.');
  }
  if (pas !== variations.length) throw new TypeError(`lireRelation : ${variations.length - pas} variation(s) hors de la chaîne (état d'avant inconnu).`);
  return { idEtat, valeur, origine, derniere, nombreVariations: variations.length };
}

// L'application « soi:temps(etat = r courant) » : ce que le tick fait DÉSIGNER dans son observation interne (tick-propre.js).
export function applicationTemps(etat) {
  return { operation: PREFIXE_SOI + 'temps', liaisons: [{ entree: ENTREE_ETAT, donnee: etat.idEtat }] };
}

// CONSÉQUENCE B2 D'UN TICK, déjà désignée (D2) : deux temps, comme pour B1 (prospecterRepos / varierRepos).
export async function prospecterTemps(magasin, designation) {
  exigerMagasin(magasin, 'prospecterTemps');
  if (designation === null || typeof designation !== 'object' || designation.operation !== PREFIXE_SOI + 'temps') throw new TypeError('prospecterTemps : la désignation doit être celle de soi:temps.');
  return prospecterConsequence(magasin, designation);
}
export async function varierTemps(magasin, { tick, designation, avant }, parametres = PARAMETRES_B2) {
  exigerMagasin(magasin, 'varierTemps');
  if (tick === null || typeof tick !== 'object' || typeof tick.id !== 'string' || tick.id.length === 0) throw new TypeError('varierTemps : tick { id } requis.');
  if (designation === null || typeof designation !== 'object' || typeof designation.id !== 'string') throw new TypeError('varierTemps : désignation requise.');
  if (avant === null || typeof avant !== 'object' || typeof avant.idEtat !== 'string') throw new TypeError('varierTemps : état d\'avant requis.');
  const variation = await enregistrerVariationRelation(magasin, { cause: { type: CAUSE_TICK, id: tick.id }, idEtatAvant: avant.idEtat, valeur: Math.min(parametres.plafond, avant.valeur + parametres.montee), idDesignation: designation.id });
  return { variation, avant: avant.valeur, apres: variation.valeur };
}

// CONSÉQUENCE B2 D'UNE RÉCEPTION DÉCLARÉE : réception Rcp (déjà persistée, table receptions) → observation interne O (datum = r courant, univers =
// le vécu projeté, où Rcp est la production de environnement:conversation) → désignation D de soi:reception(etat = r, recu = Rcp) parmi les
// possibilités de O → contextes/attentes (ancrés D) → variation (cause = Rcp, idDesignation = D, valeur 0). Rien d'autre n'est exécuté.
export async function consequenceReception(magasin, reception) {
  exigerMagasin(magasin, 'consequenceReception');
  if (reception === null || typeof reception !== 'object' || typeof reception.id !== 'string' || reception.id.length === 0 || typeof reception.idEmission !== 'string') throw new TypeError('consequenceReception : une réception DÉCLARÉE (ligne de la table receptions, reliée à une émission) est requise.');
  const avant = await lireRelation(magasin);
  const vecu = await lireExecutionsVecues(magasin);
  if (!vecu.executions.some((e) => e.id === reception.id)) throw new TypeError(`consequenceReception : la réception « ${reception.id} » n'est pas projetée dans le vécu (réception non déclarée ?).`);
  const presents = new Set(vecu.descriptions.map((d) => d.nom));
  const descriptions = [...vecu.descriptions, ...DESCRIPTIONS_SOI.filter((d) => !presents.has(d.nom))];
  const datum = { id: avant.idEtat, valeur: avant.valeur, source: DESCRIPTION_SOURCE_SOI };
  const o = await observerPossibilites(datum, {
    enregistrer: (donnees) => enregistrerObservationPossibilites(magasin, donnees),
    lireExecutions: async () => vecu.executions,
    descriptions,
    descriptionSource: DESCRIPTION_SOURCE_SOI,
    source: SOURCE_OBSERVATION_INTERNE,
  });
  if (o.statut !== 'ecrite') throw new TypeError(`consequenceReception : observation interne impossible (${o.statut}).`);
  const designation = await enregistrerDesignation(magasin, { observation: o.observation, application: { operation: PREFIXE_SOI + 'reception', liaisons: [{ entree: ENTREE_ETAT, donnee: avant.idEtat }, { entree: ENTREE_RECU, donnee: reception.id }] }, origine: ORIGINE_CONSEQUENCE });
  const prospection = await prospecterConsequence(magasin, designation);
  const variation = await enregistrerVariationRelation(magasin, { cause: { type: CAUSE_RECEPTION, id: reception.id }, idEtatAvant: avant.idEtat, valeur: 0, idDesignation: designation.id });
  return { variation, avant: avant.valeur, apres: 0, prospection, observation: o.observation, univers: o.univers, designation };
}
// === FIN_LANGAGE_RELATION ===
