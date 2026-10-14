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

// v0.64.12 — J1a « ENSEIGNEMENT NATUREL CONFIRMÉ » (décision ChatGPT « MISSION DE DÉVELOPPEMENT v0.64.12 — J1 », 14/10/2026).
// Une AFFIRMATION ORDINAIRE (sans marqueur) de la forme « Mon chien s'appelle Rex. » devient une PROPOSITION de leçon « Fait : moi / chien / Rex. »,
// confirmée par le canal existant (proposerLecon → bouton Confirmer → ecrireConnaissance → apprendreFait). Rien n'est jamais écrit ici.
// Même discipline que interpreterEnseignement (couche d'entrée, jamais un second moteur) ; la différence : aucun marqueur, donc tout ce qui n'est
// pas SUFFISAMMENT DÉTERMINÉ est refusé SILENCIEUSEMENT (le message suit alors le fonctionnement antérieur, sans aucun message d'erreur).
//
// CADRE (et rien d'autre) : début du message = possessif « moi » (ma | mon | mes, rôle possessif_moi du lexique) + UN mot + « s'appelle » (ma, mon)
//   ou « s'appellent » (mes) + valeur. Le mot est la relation : connu du lexique avec le rôle relation (alors sa relation), ou inconnu (alors la
//   relation est ce mot, en minuscules, et elle ne sera connue QUE par le fait confirmé : aucune ligne de lexique n'est écrite).
// PÉRIMÈTRE RESTREINT, documenté : les formes « est » / « sont » sont REPORTÉES. Le contrat actuel (moi / relation / valeur) ne permet pas de
//   distinguer une relation-valeur (« Ma ville est Cognac ») d'une propriété attribuée (« Mon chien est gentil ») sans liste ni heuristique ;
//   « s'appelle » dit au contraire explicitement que la valeur est un NOM. « Apprends que ma ville est Cognac » (v0.16) reste disponible.
// REFUS (motif rendu pour les tests, jamais affiché) : question (« ? »), message inachevé (« … », « ... »), hors cadre (négation « ne … pas »,
//   citation, discours rapporté, autre verbe, relation de plusieurs mots, possessif « toi »), accord possessif/verbe incohérent, mot grammatical à la
//   place de la relation, valeur vide, valeur contenant « / », « ? », guillemets ou deux-points, particule de négation dans la valeur (liste FIXE
//   et limitée : pas, plus, jamais, ni — exclusions, pas une compréhension de la négation), mot à rôle grammatical dans la valeur (verbe,
//   interrogatif, possessif, pronom : « peut-être », « ou », « il »…), aller-retour de leçon impossible.
// La valeur est le texte ORIGINAL qui suit le verbe, sans ponctuation finale (« Simon et Léa » reste UNE valeur littérale, sans sémantique de liste).
//
// reconnaitreAffirmationPossessive(texte, { lexique }) -> { ok: false, motif } | { ok: true, phrase, extrait, sujet: 'moi', relation, valeur, relationNouvelle }
// PURE : aucune lecture de mémoire, aucune écriture, aucun appel de modèle.
const CADRE_APPELLE = /^(\S+)\s+(\S+)\s+s['\u2019](appelle|appellent)\s+(.+)$/iu;
const NEGATIONS_EXCLUES = new Set(['pas', 'plus', 'jamais', 'ni']);
const ROLES_GRAMMATICAUX = new Set([ROLES.VERBE, ROLES.VERBE_CONJUGUE, ROLES.INTERROGATIF, ROLES.POSSESSIF_MOI, ROLES.POSSESSIF_TOI, ROLES.PRONOM_MOI, ROLES.PRONOM_TOI, ROLES.PRONOM_3E]);
const refusAffirmation = (motif) => ({ ok: false, motif });

export function reconnaitreAffirmationPossessive(texte, { lexique } = {}) {
  const lex = lexique || {};
  const t = String(texte || '').trim();
  if (t.includes('?')) return refusAffirmation('question');
  if (/(?:\u2026|\.\.\.)\s*$/u.test(t)) return refusAffirmation('inacheve');
  const m = t.match(CADRE_APPELLE);
  if (!m) return refusAffirmation('hors cadre');
  const [, motPossessif, motRelation, verbe, reste] = m;
  const possessif = decouper(motPossessif);
  const entreePossessif = possessif.length === 1 ? lex[possessif[0]] : undefined;
  if (!entreePossessif || entreePossessif.role !== ROLES.POSSESSIF_MOI) return refusAffirmation('hors cadre');
  const pluriel = possessif[0] === 'mes';
  if (pluriel !== (verbe.toLowerCase() === 'appellent')) return refusAffirmation('accord');
  if (!/^[\p{L}\p{N}]+$/u.test(motRelation)) return refusAffirmation('hors cadre');
  const jeton = decouper(motRelation);
  if (jeton.length !== 1) return refusAffirmation('hors cadre');
  const entree = lex[jeton[0]];
  if (entree && (entree.role !== ROLES.RELATION || !entree.relation)) return refusAffirmation('mot grammatical');
  const relation = entree ? entree.relation : motRelation.toLowerCase();
  const valeur = reste.trim().replace(/[.!\s]+$/u, '');
  if (!valeur) return refusAffirmation('valeur vide');
  if (/[\/?:"\u00ab\u00bb\u201c\u201d]/u.test(valeur)) return refusAffirmation('valeur');
  const motsValeur = decouper(valeur);
  if (motsValeur.length === 0) return refusAffirmation('valeur vide');
  if (motsValeur.some((w) => NEGATIONS_EXCLUES.has(w))) return refusAffirmation('negation');
  if (motsValeur.some((w) => lex[w] && ROLES_GRAMMATICAUX.has(lex[w].role))) return refusAffirmation('mot grammatical dans la valeur');
  const phrase = `Fait : moi / ${relation} / ${valeur}.`;
  const extrait = extraireLecon(phrase);
  const d = extrait && extrait.donnees;
  if (!extrait || extrait.type !== 'fait' || d.sujet !== 'moi' || d.relation !== relation || d.valeur !== valeur) return refusAffirmation('lecon');
  return { ok: true, phrase, extrait, sujet: 'moi', relation, valeur, relationNouvelle: !entree };
}
// === FIN_LANGAGE_INTERPRETATION ===
