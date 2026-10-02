// === DEBUT_LANGAGE_CONFRONTATION ===
// v0.36.0 — DÉCISION CHATGPT « PRIMITIVE A : CONFRONTATION » (02/10).
//
// La plus petite primitive INTERNE permettant de CONFRONTER deux résultats déjà obtenables (faits
// directs ou compositions) : sont-ils égaux, différents, inconnus (pas assez d'information) ou en
// conflit (plusieurs valeurs persistées contradictoires) ? Entièrement indépendante du langage et du
// flux conversationnel : AUCUN appel à comprendre() ni repondre() ici, et rien ici n'est appelé par
// eux — ce module ne fait qu'exister, prêt à être câblé plus tard par une capacité séparée (« B »,
// apprendre qu'une formulation doit déclencher cette primitive avec tels arguments), explicitement
// hors périmètre de ce chantier.
//
// Réutilise STRICTEMENT resoudreChemin() (esprit.js) pour obtenir une valeur — jamais réécrit ici.
// Un seul point reste à ajouter : resoudreChemin() renvoie `null` aussi bien pour « inconnu » (aucun
// fait à cette étape) que pour « conflit » (plusieurs valeurs contradictoires à une étape), un choix
// délibéré et documenté là-bas (« abstient de la même façon ») puisqu'aucun appelant jusqu'ici n'avait
// besoin de distinguer les deux. confronter() en a besoin (états distincts, décision ChatGPT du
// 02/10) : resoudreAvecEtat() ci-dessous REJOUE EXACTEMENT le même parcours que resoudreChemin() (même
// boucle, mêmes conditions, rien d'autre) uniquement pour qualifier un `null` déjà obtenu par un appel
// réel à resoudreChemin() — jamais pour recalculer la valeur elle-même autrement.
//
// N'ÉCRIT JAMAIS RIEN EN MÉMOIRE (aucun appel à esprit.magasin, aucun apprendreFait) : une
// confrontation ponctuelle, jamais un fait dérivé permanent — même principe que resoudreChemin() et
// tenterComposition() (esprit.js).
//
// Aucune valeur stockée n'est jamais modifiée : canoniser() (canon.js) sert UNIQUEMENT, au moment de
// la comparaison, à décider si deux valeurs représentent la même chose (accent/casse/espaces) — les
// champs `valeur` des faits, et les valeurs renvoyées par ce module, restent toujours la graphie
// réellement stockée (décision ChatGPT explicite : « ne jamais modifier la valeur stockée »).
//
// RÈGLE FONDAMENTALE : absence d'information ≠ différence. Un sujet pour lequel on ne sait rien
// n'est jamais traité comme « different » d'un sujet pour lequel on sait quelque chose : c'est
// « inconnu », un état à part entière.

import { resoudreChemin } from './esprit.js';
import { cleFait } from './connaissances.js';
import { canoniser } from './canon.js';

export const ETAT_EGAL = 'egal';
export const ETAT_DIFFERENT = 'different';
export const ETAT_INCONNU = 'inconnu';
export const ETAT_CONFLIT = 'conflit';

// Comparaison PURE de deux valeurs déjà obtenues (jamais de résolution ici) : égalité CANONIQUE
// (voir canon.js) uniquement au moment de la comparaison, jamais en modifiant quoi que ce soit en
// mémoire. Ne connaît ni « inconnu » ni « conflit » : c'est à l'appelant (confronter(), ci-dessous)
// de ne l'invoquer que lorsque les deux valeurs sont réellement connues sans conflit.
export function confronterValeurs(valeurA, valeurB) {
  return canoniser(valeurA) === canoniser(valeurB) ? ETAT_EGAL : ETAT_DIFFERENT;
}

// Rejoue le parcours de resoudreChemin() (esprit.js, inchangé, non dupliqué dans sa logique de
// VALEUR) uniquement pour dire si l'arrêt (déjà constaté par un vrai appel à resoudreChemin()) est dû
// à un CONFLIT de faits plutôt qu'à une simple absence de connaissance.
function cheminRencontreConflit(esprit, sujetInitial, chemin) {
  let sujetCourant = sujetInitial;
  for (const relation of chemin) {
    const id = cleFait(sujetCourant, relation);
    if (esprit.conflitsFaits && esprit.conflitsFaits.has(id)) return true;
    const fait = esprit.faits.get(id);
    if (!fait) return false;
    sujetCourant = fait.valeur;
  }
  return false;
}

// Résout UN chemin et le qualifie : { etat: 'ok', valeur } quand resoudreChemin() aboutit réellement,
// sinon { etat: 'conflit' } ou { etat: 'inconnu' } selon la cause de l'abstention.
function resoudreAvecEtat(esprit, sujet, chemin) {
  const valeur = resoudreChemin(esprit, sujet, chemin);
  if (valeur != null) return { etat: 'ok', valeur };
  return { etat: cheminRencontreConflit(esprit, sujet, chemin) ? ETAT_CONFLIT : ETAT_INCONNU };
}

// Confronte DEUX résultats (chacun un sujet + un chemin de relations, direct ou composé — aucune
// différence de traitement entre les deux, resoudreChemin() fonctionne identiquement pour un chemin
// d'une ou plusieurs étapes). Priorité CONFLIT > INCONNU quand les deux côtés posent un problème
// différent : un conflit de faits est un problème de mémoire plus sérieux qu'une simple absence de
// connaissance, et le mentionner ne cache jamais un conflit réel derrière un « inconnu » plus anodin.
export function confronter(esprit, { sujetA, cheminA, sujetB, cheminB }) {
  const resA = resoudreAvecEtat(esprit, sujetA, cheminA);
  const resB = resoudreAvecEtat(esprit, sujetB, cheminB);
  const valeurA = resA.etat === 'ok' ? resA.valeur : null;
  const valeurB = resB.etat === 'ok' ? resB.valeur : null;
  if (resA.etat === ETAT_CONFLIT || resB.etat === ETAT_CONFLIT) {
    return { etat: ETAT_CONFLIT, valeurA, valeurB };
  }
  if (resA.etat === ETAT_INCONNU || resB.etat === ETAT_INCONNU) {
    return { etat: ETAT_INCONNU, valeurA, valeurB };
  }
  return { etat: confronterValeurs(valeurA, valeurB), valeurA, valeurB };
}

// Confronte DEUX sujets sur une LISTE EXPLICITE de relations (jamais devinée : c'est l'appelant qui
// choisit quelles relations comparer — décision ChatGPT explicite, « aucun mécanisme ne doit essayer
// de deviner automatiquement »). Chaque relation est un chemin direct à une étape ; une relation en
// conflit ou inconnue pour l'un des deux sujets n'interrompt jamais le classement des autres
// relations de la liste : chacune est confrontée indépendamment.
export function confronterToutes(esprit, { sujetA, sujetB, relations }) {
  const resultat = { identiques: [], differentes: [], inconnues: [], conflits: [] };
  for (const relation of relations) {
    const r = confronter(esprit, { sujetA, cheminA: [relation], sujetB, cheminB: [relation] });
    const ligne = { relation, valeurA: r.valeurA, valeurB: r.valeurB };
    if (r.etat === ETAT_EGAL) resultat.identiques.push(ligne);
    else if (r.etat === ETAT_DIFFERENT) resultat.differentes.push(ligne);
    else if (r.etat === ETAT_CONFLIT) resultat.conflits.push(ligne);
    else resultat.inconnues.push(ligne);
  }
  return resultat;
}
// === FIN_LANGAGE_CONFRONTATION ===
