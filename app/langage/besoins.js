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

// v0.63.91 — STRATÉGIES = APPLICATIONS (décision ChatGPT « DÉCISION FINALE — PASSAGE AU CODE », 11/10/2026 ; sondes « production ou stratégie ? »,
// « DT6 » et mini-conception finale). VUE PURE au-dessus de moyensConnus, qui reste INCHANGÉ.
//   Une PRODUCTION historique (exécution) est une OCCURRENCE ; son APPLICATION { operation, liaisons } est la STRATÉGIE ; une preuve est une
//   EXPÉRIENCE d'une occurrence. Plusieurs occurrences de la même application (le lot réexécute une application inchangée : DT6, non corrigé ici)
//   ne sont plus plusieurs stratégies.
// cleApplication(execution) : égalité STRICTE, sans id ni hash : même operation, mêmes liaisons persistées entrée par entrée dans leur ordre
//   (ordinaire : même donnee ; collective : même suite exacte de donnees). Aucune généralisation par valeur, forme ou texte.
// moyensParStrategie(vecu, besoin) -> { besoin, satiete, strategies: [{ application, operation, occurrences, preuves, occurrenceSupport }] }
//   - occurrences : les productions-moyens de cette application ; preuves : TOUTES leurs preuves, inchangées (aucune supprimée) ;
//   - occurrenceSupport : la production de la PREMIÈRE preuve dans l'ORDRE CAUSAL de la chaîne d'état de la dimension (origine → état d'après →
//     transformation suivante, par identités : liaison `etat` et IDENTITE_ETAT_APRES). C'est le SUPPORT TECHNIQUE de l'émission d'une initiative
//     (toutes les occurrences d'une application ont le même résultat : opérations pures). Cette ancienneté est ASSUMÉE et LIMITÉE au support :
//     elle ne choisit, ne classe, ne départage jamais des stratégies et n'entre ni dans moyensConnus ni dans un score. Aucun horodatage, aucun tri
//     d'identités, aucun hasard, aucun hash, aucun compte de preuves.
//   - ordre des stratégies : celui de leur première preuve dans la même chaîne causale, SANS SIGNIFICATION (lecture/affichage seulement).
//   Le NOMBRE d'occurrences ou de preuves n'est lu par rien.
export function cleApplication(execution) {
  if (execution === null || typeof execution !== 'object' || typeof execution.operation !== 'string' || !Array.isArray(execution.liaisons)) throw new TypeError('cleApplication : exécution { operation, liaisons } requise.');
  return JSON.stringify([execution.operation, execution.liaisons.map((l) => {
    if (l === null || typeof l !== 'object' || typeof l.entree !== 'string') throw new TypeError('cleApplication : liaison mal formée.');
    if (Object.hasOwn(l, 'donnees')) {
      if (!Array.isArray(l.donnees)) throw new TypeError('cleApplication : liaison collective mal formée.');
      return [l.entree, 'collective', l.donnees];
    }
    return [l.entree, 'ordinaire', l.donnee];
  })]);
}

// Rang CAUSAL des transformations d'état d'une dimension : on part de l'état qui n'est l'état d'après d'aucune transformation (l'origine) et on suit
// « état d'avant → transformation → état d'après ». Purement par identités ; aucune horloge.
function rangsCausaux(vecu, besoin) {
  const etatApres = IDENTITE_ETAT_APRES[besoin.dimension];
  const valeur = new Set(vecu.valeurs.map((v) => v.id));
  const parEtatAvant = new Map();
  const apres = new Set();
  for (const x of vecu.executions) {
    if (!Array.isArray(x.liaisons)) continue;
    const sortie = etatApres({ id: x.id });
    if (!valeur.has(sortie)) continue;
    const entree = x.liaisons.find((l) => l.entree === ENTREE_ETAT);
    if (entree === undefined || typeof entree.donnee !== 'string') continue;
    if (parEtatAvant.has(entree.donnee)) throw new TypeError(`moyensParStrategie : deux transformations partent de l'état « ${entree.donnee} » (fourche).`);
    parEtatAvant.set(entree.donnee, { id: x.id, sortie });
    apres.add(sortie);
  }
  const origines = [...parEtatAvant.keys()].filter((e) => !apres.has(e));
  if (origines.length > 1) throw new TypeError('moyensParStrategie : chaîne d\'état discontinue (plusieurs origines).');
  const rangs = new Map();
  let etat = origines[0];
  while (etat !== undefined && parEtatAvant.has(etat)) {
    const t = parEtatAvant.get(etat);
    if (rangs.has(t.id)) throw new TypeError('moyensParStrategie : chaîne d\'état cyclique.');
    rangs.set(t.id, rangs.size);
    etat = t.sortie;
  }
  return rangs;
}

export function moyensParStrategie(vecu, besoin) {
  const connus = moyensConnus(vecu, besoin);
  const execution = new Map(vecu.executions.map((e) => [e.id, e]));
  const rangs = connus.moyens.length > 0 ? rangsCausaux(vecu, besoin) : new Map();
  const rang = (preuve) => {
    if (!rangs.has(preuve.transformation)) throw new TypeError(`moyensParStrategie : la transformation « ${preuve.transformation} » est hors de la chaîne causale.`);
    return rangs.get(preuve.transformation);
  };
  const parCle = new Map();
  for (const m of connus.moyens) {
    const x = execution.get(m.production);
    if (x === undefined) throw new TypeError(`moyensParStrategie : production « ${m.production} » absente du vécu.`);
    const cle = cleApplication(x);
    const s = parCle.get(cle) ?? { application: { operation: x.operation, liaisons: x.liaisons }, operation: x.operation, occurrences: [], preuves: [], premiere: null };
    s.occurrences.push(m.production);
    for (const p of m.preuves) {
      s.preuves.push(p);
      if (s.premiere === null || rang(p) < rang(s.premiere)) s.premiere = p;
    }
    parCle.set(cle, s);
  }
  const strategies = [...parCle.values()].sort((a, b) => rang(a.premiere) - rang(b.premiere))
    .map(({ premiere, ...s }) => ({ ...s, occurrenceSupport: premiere.production }));
  return { besoin: connus.besoin, satiete: connus.satiete, strategies };
}

// LECTURE (aucune écriture hors origine d'état déjà écrite par lireCapacite/lireRelation) : pour chaque besoin déclaré, l'état courant, le motif et
// les moyens connus, recalculés à chaque appel depuis le vécu persisté. v0.63.91 : + strategies (moyensParStrategie), les moyens restent intacts.
export async function lireBesoins(magasin) {
  if (magasin === null || typeof magasin !== 'object' || typeof magasin.lireTout !== 'function') throw new TypeError('lireBesoins : magasin doit offrir lireTout.');
  const etats = { capacite: await lireCapacite(magasin), relation: await lireRelation(magasin) };
  const vecu = await lireExecutionsVecues(magasin);
  return BESOINS.map((besoin) => ({ ...motifDuBesoin(besoin, etats[besoin.dimension]), ...moyensConnus(vecu, besoin), strategies: moyensParStrategie(vecu, besoin).strategies }));
}
// === FIN_LANGAGE_BESOINS ===
