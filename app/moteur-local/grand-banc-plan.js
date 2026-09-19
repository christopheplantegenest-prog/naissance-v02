// === DEBUT_GRAND_BANC_PLAN ===
// Le plan du grand banc : une liste ORDONNÉE et DÉTERMINISTE d'essais à faire, chacun avec un
// identifiant stable (sert à la reprise : un essai déjà dans le journal n'est jamais refait).
// Ce sont des DONNÉES — rien ici n'exécute ni ne corrige quoi que ce soit.
//
// Six expériences, une propriété à la fois (voir ARCHITECTURE-IA.md pour le détail de chacune) :
//   variabilite   — même contexte, graine fixe vs graines variées : mesure le bruit de référence.
//   identite      — même fait, trois préfixes (normal / court / aucun), mêmes graines entre eux.
//   personne      — même fait, trois formulations (1re / 2e / 3e personne), mêmes graines entre elles.
//   fait-fourni   — souvenir imposé, quatre catégories de faits, trois variantes chacune.
//   absence       — aucun souvenir, quatre catégories, graine fixe vs graines variées.
//   completion    — un fait vrai isolé, géographique ou non, pour observer la suite ajoutée.

import { estimerJetons } from './profil.js';

export const EXPERIENCES = Object.freeze({
  variabilite: 'Variabilité (bruit de référence)',
  identite: 'Identité (normale / courte / aucune)',
  personne: 'Personne grammaticale (je / tu / il)',
  'fait-fourni': 'Fait fourni (souvenir imposé)',
  absence: 'Information absente',
  completion: 'Complétion après un fait vrai',
});

const LIEU = '{personne} habite à Marcillac-Lanville.';
const COULEUR = 'La couleur préférée de {personne} est le bleu.';
const NOMBRE = '{personne} a deux enfants.';
const PRENOM = "Le fils de {personne} s'appelle Atem.";

// Graines partagées : mêmes valeurs utilisées entre les conditions d'une même expérience,
// pour que la comparaison ne soit pas polluée par des tirages différents (demande explicite).
const GRAINES_IDENTITE = [301, 302, 303, 304, 305];
const GRAINES_PERSONNE = [401, 402, 403, 404, 405];
const GRAINES_VARIABILITE = [201, 202, 203, 204, 205, 206, 207, 208, 209, 210];
const GRAINE_VARIABILITE_FIXE = 100;
const GRAINES_ABSENCE = [501, 502, 503];

function ligne({
  id, experience, condition, repetition, question, sujet = 'personne', attendu = 'fait',
  souvenirsImposes = null, sansSouvenirs = false, sansIdentite = false, identiteCourte = false,
  limite = null, graine = null,
}) {
  return {
    id, experience, condition, repetition, question, sujet, attendu,
    souvenirsImposes, sansSouvenirs, sansIdentite, identiteCourte, limite, graine,
  };
}

function planVariabilite() {
  const plan = [];
  for (let i = 0; i < GRAINES_VARIABILITE.length; i++) {
    plan.push(ligne({
      id: `variabilite/fixe/${i + 1}`, experience: 'variabilite', condition: 'graine-fixe', repetition: i + 1,
      question: "Où est-ce que j'habite ?", souvenirsImposes: [LIEU], graine: GRAINE_VARIABILITE_FIXE,
    }));
  }
  GRAINES_VARIABILITE.forEach((g, i) => plan.push(ligne({
    id: `variabilite/variee/${i + 1}`, experience: 'variabilite', condition: 'graine-variee', repetition: i + 1,
    question: "Où est-ce que j'habite ?", souvenirsImposes: [LIEU], graine: g,
  })));
  return plan;
}

function planIdentite() {
  const plan = [];
  const faits = [{ nom: 'lieu', souvenir: LIEU, question: "Où est-ce que j'habite ?" },
    { nom: 'couleur', souvenir: COULEUR, question: 'Quelle est ma couleur préférée ?' }];
  for (const fait of faits) {
    GRAINES_IDENTITE.forEach((g, i) => {
      plan.push(ligne({
        id: `identite/${fait.nom}/normale/${i + 1}`, experience: 'identite', condition: `${fait.nom}-normale`, repetition: i + 1,
        question: fait.question, souvenirsImposes: [fait.souvenir], graine: g,
      }));
      plan.push(ligne({
        id: `identite/${fait.nom}/courte/${i + 1}`, experience: 'identite', condition: `${fait.nom}-courte`, repetition: i + 1,
        question: fait.question, souvenirsImposes: [fait.souvenir], graine: g, identiteCourte: true,
      }));
      plan.push(ligne({
        id: `identite/${fait.nom}/aucune/${i + 1}`, experience: 'identite', condition: `${fait.nom}-aucune`, repetition: i + 1,
        question: fait.question, souvenirsImposes: [fait.souvenir], graine: g, sansIdentite: true,
      }));
    });
  }
  return plan;
}

function planPersonne() {
  const plan = [];
  const faits = [
    { nom: 'lieu', souvenir: LIEU, moi: "Où est-ce que j'habite ?", toi: 'Où est-ce que tu habites ?', il: 'Où habite {personne} ?' },
    { nom: 'couleur', souvenir: COULEUR, moi: 'Quelle est ma couleur préférée ?', toi: 'Quelle est ta couleur préférée ?', il: 'Quelle est la couleur préférée de {personne} ?' },
  ];
  for (const fait of faits) {
    GRAINES_PERSONNE.forEach((g, i) => {
      plan.push(ligne({ id: `personne/${fait.nom}/1re/${i + 1}`, experience: 'personne', condition: `${fait.nom}-1re`, repetition: i + 1, question: fait.moi, souvenirsImposes: [fait.souvenir], graine: g }));
      plan.push(ligne({ id: `personne/${fait.nom}/2e/${i + 1}`, experience: 'personne', condition: `${fait.nom}-2e`, repetition: i + 1, question: fait.toi, sujet: 'ia', souvenirsImposes: [fait.souvenir], graine: g }));
      plan.push(ligne({ id: `personne/${fait.nom}/3e/${i + 1}`, experience: 'personne', condition: `${fait.nom}-3e`, repetition: i + 1, question: fait.il, souvenirsImposes: [fait.souvenir], graine: g }));
    });
  }
  return plan;
}

function planFaitFourni() {
  const plan = [];
  const categories = [
    { nom: 'lieu', souvenir: LIEU, direct: "Où est-ce que j'habite ?", reformulation: 'Tu te souviens de ma ville ?', autrePersonne: 'Où habite {personne} ?' },
    { nom: 'couleur', souvenir: COULEUR, direct: 'Quelle est ma couleur préférée ?', reformulation: 'Tu connais ma couleur favorite ?', autrePersonne: 'Quelle est la couleur préférée de {personne} ?' },
    { nom: 'nombre', souvenir: NOMBRE, direct: "Combien j'ai d'enfants ?", reformulation: "J'ai combien de gamins ?", autrePersonne: "Combien {personne} a-t-il d'enfants ?" },
    { nom: 'prenom', souvenir: PRENOM, direct: "Comment s'appelle mon fils ?", reformulation: "Quel est le prénom de mon garçon ?", autrePersonne: "Comment s'appelle le fils de {personne} ?" },
  ];
  for (const c of categories) {
    for (const [variante, question] of [['direct', c.direct], ['reformulation', c.reformulation], ['autre-personne', c.autrePersonne]]) {
      for (let r = 1; r <= 3; r++) {
        plan.push(ligne({
          id: `fait-fourni/${c.nom}/${variante}/${r}`, experience: 'fait-fourni', condition: `${c.nom}-${variante}`, repetition: r,
          question, souvenirsImposes: [c.souvenir],
        }));
      }
    }
  }
  return plan;
}

function planAbsence() {
  const plan = [];
  const categories = [
    { nom: 'pointure', question: 'Quelle est ma pointure ?' },
    { nom: 'voiture', question: 'Quelle voiture je conduis ?' },
    { nom: 'autre-lieu', question: 'Où se trouve ma résidence secondaire ?' },
    { nom: 'nombre-inconnu', question: "Combien j'ai de frères et sœurs ?" },
  ];
  const grainesVariees = [601, 602, 603];
  for (const c of categories) {
    for (let r = 1; r <= GRAINES_ABSENCE.length; r++) {
      plan.push(ligne({
        id: `absence/${c.nom}/fixe/${r}`, experience: 'absence', condition: `${c.nom}-graine-fixe`, repetition: r,
        question: c.question, attendu: 'ignorance', sansSouvenirs: true, graine: GRAINES_ABSENCE[0],
      }));
    }
    grainesVariees.forEach((g, i) => plan.push(ligne({
      id: `absence/${c.nom}/variee/${i + 1}`, experience: 'absence', condition: `${c.nom}-graine-variee`, repetition: i + 1,
      question: c.question, attendu: 'ignorance', sansSouvenirs: true, graine: g,
    })));
  }
  return plan;
}

function planCompletion() {
  const plan = [];
  const cas = [
    { nom: 'lieu', souvenir: LIEU, question: "Où est-ce que j'habite ?" },
    { nom: 'couleur', souvenir: COULEUR, question: 'Quelle est ma couleur préférée ?' },
    { nom: 'nombre', souvenir: NOMBRE, question: "Combien j'ai d'enfants ?" },
    { nom: 'prenom', souvenir: PRENOM, question: "Comment s'appelle mon fils ?" },
  ];
  for (const c of cas) {
    for (let r = 1; r <= 5; r++) {
      plan.push(ligne({
        id: `completion/${c.nom}/${r}`, experience: 'completion', condition: c.nom, repetition: r,
        question: c.question, souvenirsImposes: [c.souvenir],
      }));
    }
  }
  return plan;
}

// Plan complet, dans l'ordre où les expériences sont décrites plus haut.
// identite : { personne, ia } réellement substitués dans les questions et les souvenirs imposés
// (voir protocoles.js pour le même mécanisme). Sans quoi le texte littéral « {personne} » partirait
// tel quel vers le moteur — c'est exactement le bug corrigé ici (campagne du 19/09).
// version : si fournie, préfixe l'identifiant de chaque essai des expériences AUTRES QUE « absence »
// (ex. « corrige/variabilite/fixe/1 »). Sert à faire cohabiter, dans le même journal, une ancienne
// campagne invalidée et une nouvelle campagne corrigée SANS jamais écraser l'ancienne : les anciens
// identifiants (sans préfixe) et les nouveaux (préfixés) ne se recouvrent jamais. L'expérience
// « absence » n'est pas concernée par le bug : ses identifiants ne sont jamais préfixés, pour que
// ses 24 essais déjà valides restent reconnus tels quels et ne soient jamais refaits.
export function genererPlan(identite = { personne: 'Christophe', ia: 'Naissance' }, { version = null } = {}) {
  const brut = [
    ...planVariabilite(), ...planIdentite(), ...planPersonne(),
    ...planFaitFourni(), ...planAbsence(), ...planCompletion(),
  ];
  const remplacer = (t) => String(t).replaceAll('{personne}', identite.personne).replaceAll('{ia}', identite.ia);
  return brut.map((e) => ({
    ...e,
    id: (version && e.experience !== 'absence') ? `${version}/${e.id}` : e.id,
    question: remplacer(e.question),
    souvenirsImposes: e.souvenirsImposes ? e.souvenirsImposes.map(remplacer) : null,
  }));
}

// Un « {mot} » qui subsiste après substitution est un gabarit oublié, pas une donnée légitime :
// aucun texte destiné au modèle n'en contient jamais par ailleurs. Sert de garde de sécurité
// (grand-banc.js) et de repérage pour l'audit.
export const PLACEHOLDER_NON_RESOLU = /\{[^{}]+\}/;

export function placeholderNonResolu(ligneEssai) {
  if (PLACEHOLDER_NON_RESOLU.test(ligneEssai.question)) return ligneEssai.question;
  for (const s of ligneEssai.souvenirsImposes || []) {
    if (PLACEHOLDER_NON_RESOLU.test(s)) return s;
  }
  return null;
}

// Estimation de durée — fondée sur les mesures réelles de la campagne v0.7.0 à v0.7.3 :
// écriture ≈ 8 jetons/s ; premier mot ≈ 3 s à cache chaud, jusqu'à 15-18 s quand le préfixe change
// (une partie de l'expérience « identité », par construction). Estimation large, pas une promesse.
export function estimerDuree(plan) {
  const identiteVariable = plan.filter((e) => e.experience === 'identite').length;
  const stable = plan.length - identiteVariable;
  const secondesStable = stable * 10;       // ~3 s premier mot + ~7 s d'écriture, cache chaud
  const secondesIdentite = identiteVariable * 13; // préfixe souvent recalculé : plus lent
  const total = secondesStable + secondesIdentite;
  return {
    essais: plan.length,
    secondesBasses: Math.round(total * 0.8),
    secondesHautes: Math.round(total * 1.6),
  };
}

export function tailleEstimeeContexte(ligneEssai, identite) {
  // Estimation grossière, seulement pour le résumé avant lancement (pas utilisée pour construire le contexte réel).
  return estimerJetons(ligneEssai.question) + (ligneEssai.souvenirsImposes || []).reduce((t, s) => t + estimerJetons(s), 0) + 90;
}
// === FIN_GRAND_BANC_PLAN ===
