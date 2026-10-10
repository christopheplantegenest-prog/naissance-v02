// === DEBUT_LANGAGE_BESOINS ===
// v0.63.87 — BESOINS DÉCLARÉS + MOTIF ACTUEL + MOYENS CONNUS (décision ChatGPT « APRÈS SONDE « INITIATIVE MOTIVÉE » », 10/10/2026 ; issue de la sonde
// du même nom, VERDICT 1 : les primitives actuelles suffisent, une vue pure générique suffit). PARTIE NON AGISSANTE de l'initiative motivée.
//
//   AUCUNE INITIATIVE. AUCUN CHOIX. AUCUNE ÉMISSION SUPPLÉMENTAIRE. AUCUNE EXÉCUTION À PARTIR DES CANDIDATS.
//   Ce module ne contient AUCUNE écriture, AUCUN appel d'émission, de déclencheur mécanique ni de tour actif, AUCUNE stratégie. Il nomme ce que
//   Naissance PEUT CONSTATER d'elle-même : « mon besoin B diffère-t-il de sa satiété ? » (motif) et « quelles productions de moi ont, dans mon vécu
//   RÉEL, pris part à une chaîne qui a amené B de non-satisfait à satiété ? » (moyens connus). Rien de plus.
//
// 1. BESOINS DÉCLARÉS (option A de la sonde : déclarations STATIQUES, aucune table nouvelle, aucune donnée persistée) :
//      { dimension, satiete }      — B1 : { 'capacite', satiété = PARAMETRES_B1.plafond } ; B2 : { 'relation', satiété 0 }.
//    La satiété relationnelle 0 est la valeur vers laquelle la réception déclarée ramène r (relation.js : consequenceReception, valeur 0) ; un test
//    garde les deux ensemble. Un futur B3 déclare { dimension, satiete } et l'identité de ses états (IDENTITE_ETAT_APRES) : l'algorithme des moyens
//    ne change pas. Aucune stratégie, aucune intensité, aucune priorité dans la déclaration.
//
// 2. MOTIF ACTUEL — motifDuBesoin(besoin, etat) -> { besoin, valeurActuelle, satiete, motif } : motif = (valeurActuelle !== satiete), BOOLÉEN seul.
//    Aucune intensité, distance, score, priorité, poids, récompense, urgence. Le motif n'est PAS une demande d'action : c < plafond ne dit pas que
//    B1 demande du repos.
//
// 3. MOYENS CONNUS — moyensConnus(vecu, besoin) -> { besoin, satiete, moyens, satisfactionsSansProduction } (vue PURE, synchrone, déterministe).
//    Entrée : le vécu projeté { valeurs, executions } (lireExecutionsVecues). Une TRANSITION VERS LA SATIÉTÉ est une exécution X de la dimension
//    dont la donnée d'état d'après (IDENTITE_ETAT_APRES[dimension](X)) vaut la satiété ET dont l'état d'avant (sa liaison `etat`) NE la valait PAS.
//    avant = satiété et après = satiété (0 → 0) reste un fait vécu mais n'est PAS une preuve de moyen. Pour chaque transition, chaque cause non
//    état est suivie par les identités RÉELLES : cause = réception R (exécution d'un opérateur `environnement:*`) → émission (R.idDesignation) →
//    production propre P (exécution liée à R par l'entrée `emis`) : seul un vécu où P a réellement été émise ET reçue ET a transformé l'état compte.
//    Sont donc IGNORÉS par construction : possibilités jamais exécutées, émissions sans réception, silences, classes seules, attentes sans issue
//    réelle, maintiens 0 → 0, réceptions sans émission propre.
//    UN MOYEN = UNE PRODUCTION EXACTE ANCIENNE (identité d'exécution P), jamais une classe, un squelette, une famille ni une application à
//    reconstruire. Deux succès de la même production = UN moyen, DEUX preuves (pas un score). Chaque preuve porte seulement des identités et deux
//    valeurs : { production, emission, reception, transformation, operation, etatAvant, valeurAvant, etatApres, valeurApres }.
//    Les moyens et les preuves sont listés dans l'ordre lexical de leurs identités : cet ordre n'a AUCUNE signification (ni préférence ni priorité).
//    connu ≠ possible ≠ préféré ≠ choisi : « moyens » ne dit jamais « seuls moyens possibles » ; l'ignorance (aucune preuve) rend moyens = [],
//    sans repli (ni « essayer », ni « au hasard », ni « explorer »).
//    satisfactionsSansProduction : transitions vers la satiété SANS production propre dans leur cause (B1 : soi:repos ; B2 : réception sans
//    émission propre) — expérience de satisfaction, JAMAIS un candidat d'action (aucune production propre à ré-émettre).
//
// CE QUE CE MODULE NE FAIT PAS : lire un contenu, compter, pondérer, préférer, choisir, déclencher, émettre, écrire, généraliser une production
// en classe, fabriquer une production nouvelle, porter la porte de B1 (c = 0) sur l'émission (limite connue, chantier suivant).
import { PARAMETRES_B1, lireCapacite } from './capacite.js';
import { identiteEtatApres, identiteEtatRelationApres, ENTREE_ETAT } from './projection-soi.js';
import { lireRelation } from './relation.js';
import { lireExecutionsVecues } from './executions-vecues.js';

export const BESOIN_CAPACITE = Object.freeze({ dimension: 'capacite', satiete: PARAMETRES_B1.plafond });
export const BESOIN_RELATION = Object.freeze({ dimension: 'relation', satiete: 0 });
export const BESOINS = Object.freeze([BESOIN_CAPACITE, BESOIN_RELATION]);

// L'identité de la donnée d'état APRÈS une variation, par dimension (une seule déclaration par dimension : B3 en ajoutera une).
export const IDENTITE_ETAT_APRES = Object.freeze({ capacite: identiteEtatApres, relation: identiteEtatRelationApres });

const OPERATION_ENVIRONNEMENT = 'environnement:';
const ENTREE_EMIS = 'emis';

function exigerBesoin(besoin, nom) {
  if (besoin === null || typeof besoin !== 'object') throw new TypeError(`${nom} : besoin { dimension, satiete } requis.`);
  if (typeof besoin.dimension !== 'string' || !Object.hasOwn(IDENTITE_ETAT_APRES, besoin.dimension)) throw new TypeError(`${nom} : dimension inconnue « ${String(besoin.dimension)} ».`);
  if (typeof besoin.satiete !== 'number' || !Number.isFinite(besoin.satiete)) throw new TypeError(`${nom} : satiete doit être un nombre fini.`);
}

export function motifDuBesoin(besoin, etat) {
  exigerBesoin(besoin, 'motifDuBesoin');
  if (etat === null || typeof etat !== 'object' || typeof etat.valeur !== 'number' || !Number.isFinite(etat.valeur)) throw new TypeError('motifDuBesoin : etat { valeur } requis.');
  return { besoin: besoin.dimension, valeurActuelle: etat.valeur, satiete: besoin.satiete, motif: etat.valeur !== besoin.satiete };
}

const parIdentite = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

export function moyensConnus(vecu, besoin) {
  exigerBesoin(besoin, 'moyensConnus');
  if (vecu === null || typeof vecu !== 'object' || !Array.isArray(vecu.valeurs) || !Array.isArray(vecu.executions)) throw new TypeError('moyensConnus : vecu { valeurs, executions } requis.');
  const etatApres = IDENTITE_ETAT_APRES[besoin.dimension];
  const valeur = new Map(vecu.valeurs.map((v) => [v.id, v.valeur]));
  const execution = new Map(vecu.executions.map((e) => [e.id, e]));
  const parProduction = new Map();
  const sansProduction = [];
  for (const x of vecu.executions) {
    const sortie = etatApres({ id: x.id });
    if (!valeur.has(sortie) || !Array.isArray(x.liaisons)) continue;
    const entree = x.liaisons.find((l) => l.entree === ENTREE_ETAT);
    if (entree === undefined || !valeur.has(entree.donnee)) continue;
    const avant = valeur.get(entree.donnee);
    const apres = valeur.get(sortie);
    if (apres !== besoin.satiete || avant === besoin.satiete) continue;
    let avecProduction = false;
    for (const l of x.liaisons) {
      if (l.entree === ENTREE_ETAT) continue;
      const reception = execution.get(l.donnee);
      if (reception === undefined || typeof reception.operation !== 'string' || !reception.operation.startsWith(OPERATION_ENVIRONNEMENT)) continue;
      const emis = Array.isArray(reception.liaisons) ? reception.liaisons.find((k) => k.entree === ENTREE_EMIS) : undefined;
      const production = emis === undefined ? undefined : execution.get(emis.donnee);
      if (production === undefined) continue;
      avecProduction = true;
      const moyen = parProduction.get(production.id) ?? { production: production.id, operation: production.operation, preuves: [] };
      moyen.preuves.push({ production: production.id, emission: reception.idDesignation, reception: reception.id, transformation: x.id, operation: x.operation, etatAvant: entree.donnee, valeurAvant: avant, etatApres: sortie, valeurApres: apres });
      parProduction.set(production.id, moyen);
    }
    if (!avecProduction) sansProduction.push({ transformation: x.id, operation: x.operation, etatAvant: entree.donnee, valeurAvant: avant, etatApres: sortie, valeurApres: apres });
  }
  const moyens = [...parProduction.values()].sort((a, b) => parIdentite(a.production, b.production));
  for (const m of moyens) m.preuves.sort((a, b) => parIdentite(a.reception, b.reception) || parIdentite(a.transformation, b.transformation));
  sansProduction.sort((a, b) => parIdentite(a.transformation, b.transformation));
  return { besoin: besoin.dimension, satiete: besoin.satiete, moyens, satisfactionsSansProduction: sansProduction };
}

// LECTURE (aucune écriture hors origine d'état déjà écrite par lireCapacite/lireRelation) : pour chaque besoin déclaré, l'état courant, le motif et
// les moyens connus, recalculés à chaque appel depuis le vécu persisté.
export async function lireBesoins(magasin) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') throw new TypeError('lireBesoins : magasin doit offrir lireTout.');
  const etats = { capacite: await lireCapacite(magasin), relation: await lireRelation(magasin) };
  const vecu = await lireExecutionsVecues(magasin);
  return BESOINS.map((besoin) => ({ ...motifDuBesoin(besoin, etats[besoin.dimension]), ...moyensConnus(vecu, besoin) }));
}
// === FIN_LANGAGE_BESOINS ===
