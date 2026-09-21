// === DEBUT_LANGAGE_INTERPRETATION ===
// v0.16 — PREMIÈRE MARCHE vers un enseignement plus naturel : « Apprends que ma couleur est rouge. »
//
// Ce module est une COUCHE D'ENTRÉE, jamais un second moteur d'apprentissage : il transforme une
// phrase en UNE leçon du canal pédagogique existant (la forme « Fait : moi / couleur / rouge. »), qui
// repasse ensuite par extraireLecon() exactement comme une leçon tapée à la main, puis par l'aperçu,
// la confirmation humaine et ecrireConnaissance() — rien de tout cela n'est réécrit ici.
//
// PÉRIMÈTRE VOLONTAIREMENT MINIMAL (décidé avec Christophe) :
//   - déclencheur explicite « Apprends que » EN TÊTE de message — jamais d'inférence sur une phrase
//     ordinaire (comprendre() est trop permissive sur les affirmations : voir main.js) ;
//   - sujet « moi » seulement : possessif ma / mon / mes ;
//   - copule « est » ou « sont » seulement ;
//   - relation DÉJÀ CONNUE du lexique seulement (role « relation ») : aucun mot n'est deviné ;
//   - valeur conservée LITTÉRALEMENT, prise dans le texte ORIGINAL (comprendre() passe tout en
//     minuscules et retire les accents : on ne peut donc pas s'en servir pour la valeur) ;
//   - aucun appel à un modèle : entièrement déterministe et local ;
//   - hors de ce cadre : REFUS CLAIR (jamais de devinette, jamais de chute silencieuse dans la
//     conversation ordinaire).
//
// « Retiens que … » n'est PAS concerné : c'est l'action retenir (souvenirs, mémoire générale).

import { decouper } from './comprendre.js';
import { ROLES } from './bagage.js';
import { extraireLecon } from './lecon.js';

export const MARQUEUR_ENSEIGNEMENT_NATUREL = /^apprends\s+que(?:\s+|$)/i;
const COPULE = /^(.+?)\s+(?:est|sont)\s+(.+)$/i;
const EXEMPLE = '« Apprends que ma couleur est rouge. »';

// Test bon marché, sans lecture de la mémoire : ce message est-il une demande d'enseignement naturel ?
export function estEnseignementNaturel(texte) {
  return MARQUEUR_ENSEIGNEMENT_NATUREL.test(String(texte || '').trim());
}

const refus = (raison) => ({ ok: false, raison });

// Renvoie :
//   null                                    — le message ne commence pas par « Apprends que » (pas concerné) ;
//   { ok: false, raison }                   — concerné, mais hors du cadre compris : refus clair, rien à écrire ;
//   { ok: true, phrase, extrait, sujet, relation, valeur }
//                                           — phrase canonique du canal (« Fait : moi / … ») + son extraction
//                                             { type, donnees }, prête pour apercuLecon / ecrireConnaissance.
// lexique : le lexique de l'esprit partagé (esprit.lexique) — mots de départ ET mots appris.
export function interpreterEnseignement(texte, { lexique } = {}) {
  const t = String(texte || '').trim();
  if (!MARQUEUR_ENSEIGNEMENT_NATUREL.test(t)) return null;
  const lex = lexique || {};

  const reste = t.replace(MARQUEUR_ENSEIGNEMENT_NATUREL, '').trim();
  if (!reste) return refus(`Dis-moi ce que je dois apprendre, par exemple : ${EXEMPLE}`);

  const m = reste.match(COPULE);
  if (!m) return refus(`Je ne trouve pas « est » ou « sont » dans ta phrase. Pour l'instant je comprends : ${EXEMPLE}`);
  const avant = m[1].trim();
  const valeurBrute = m[2];

  // Le groupe avant la copule : EXACTEMENT un possessif « moi » suivi d'une relation connue.
  const mots = decouper(avant);
  const mem = lex[mots[0]];
  if (!mem || mem.role !== ROLES.POSSESSIF_MOI) {
    return refus(`Pour l'instant, je n'apprends que des choses qui te concernent, avec « ma », « mon » ou « mes ». Par exemple : ${EXEMPLE}`);
  }
  if (mots.length < 2) {
    return refus(`Après « ${avant} », j'attends le nom d'une information que je connais (par exemple « couleur »).`);
  }
  const originaux = avant.split(/\s+/);
  const entree = lex[mots[1]];
  if (!entree || entree.role !== ROLES.RELATION || !entree.relation) {
    const inconnu = originaux.length === mots.length ? originaux[1] : mots[1];
    return refus(`Je ne connais pas encore « ${inconnu} » comme une information. Apprends-le-moi d'abord : « Apprends : Mot : ${inconnu} désigne ${inconnu}. »`);
  }
  if (mots.length > 2) {
    return refus(`Je ne sais pas interpréter « ${avant} » : je comprends seulement un possessif suivi d'un seul mot (par exemple « ${mots[0]} ${mots[1]} »), sans mot en plus.`);
  }
  const relation = entree.relation;

  // La valeur : le texte ORIGINAL après la copule, sans la ponctuation finale, sinon intacte.
  const valeur = valeurBrute.trim().replace(/[.\s…]+$/u, '');
  if (!valeur) return refus(`Il manque ce que je dois retenir après « est » ou « sont ». Par exemple : ${EXEMPLE}`);
  if (/[\/?]/.test(valeur)) {
    return refus('Je ne sais pas apprendre une valeur qui contient « / » ou « ? ». Reformule sans ces signes.');
  }

  // Aller-retour : la phrase canonique doit ressortir de extraireLecon() avec EXACTEMENT ces données.
  const phrase = `Fait : moi / ${relation} / ${valeur}.`;
  const extrait = extraireLecon(phrase);
  const d = extrait && extrait.donnees;
  if (!extrait || extrait.type !== 'fait' || d.sujet !== 'moi' || d.relation !== relation || d.valeur !== valeur) {
    return refus("Je n'ai pas réussi à écrire cette leçon proprement : reformule-la.");
  }
  return { ok: true, phrase, extrait, sujet: 'moi', relation, valeur };
}
// === FIN_LANGAGE_INTERPRETATION ===
