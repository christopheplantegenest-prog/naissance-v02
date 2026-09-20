// === DEBUT_LANGAGE_ESPRIT ===
// Le noyau : COMPRENDRE → RETROUVER → RÉPONDRE → APPRENDRE.
// Aucun appel à LFM2. Tout est déterministe et explicable : pour chaque réponse, on peut dire
// quel fait a été retrouvé et quel patron a servi à la formuler.
//
// Ce qu'elle peut acquérir, et qui persiste :
//   1. un FAIT      (« mon fils s'appelle Atem »)
//   2. un MOT       (« un gamin, c'est un fils »)
//   3. un PATRON    (« on dit : Ton fils s'appelle Atem »)
// Dans les trois cas, c'est la BASE qui change, jamais le code.

import { LEXIQUE_DEPART, FAITS_DEPART, PATRONS_DEPART, PROPRIETES_DEPART, REGLES_DEPART, PHRASE_IGNORANCE, PHRASE_INCOMPRIS, ROLES } from './bagage.js';
import { comprendre, decouper, expliquer, COMPRIS, PARTIEL, INCOMPRIS } from './comprendre.js';
import { cleFait, clePropriete } from './connaissances.js';
import { plusSpecifiques, signatureConditions, appliquerRegles, normaliserTexte } from './regles.js';

export const PHRASE_NE_SAIS_PAS_DIRE = "Je ne sais pas comment le dire : je n'ai pas de règle pour ça.";
export const PHRASE_CONFLIT = 'Deux de mes règles se contredisent pour dire ça — je préfère ne pas choisir au hasard.';
export const PHRASE_CONFLIT_PATRON = "J'ai appris deux façons de dire ça qui se contredisent — je préfère ne pas choisir au hasard.";

export async function chargerEsprit(magasin) {
  const [faitsApris, lexiqueAppris, patronsApris, proprietesApprises, reglesApprises] = await Promise.all([
    magasin.lireTout('faits'), magasin.lireTout('lexique'), magasin.lireTout('patrons'),
    magasin.lireTout('proprietes'), magasin.lireTout('regles'),
  ]);

  // Le bagage de départ, complété par ce qui a été appris. L'appris a toujours le dernier mot.
  const lexique = { ...LEXIQUE_DEPART };
  for (const e of lexiqueAppris) lexique[e.mot] = { role: e.role, relation: e.relation };

  const faits = new Map();
  for (const f of FAITS_DEPART) faits.set(cleFait(f.sujet, f.relation), f);
  for (const f of faitsApris) faits.set(f.cle, f);

  const patrons = [...PATRONS_DEPART, ...patronsApris];

  // Propriétés : Map mot → Map propriete → valeur. C'est le mot lui-même (souvent le nom de la
  // relation : « voiture ») qui porte ses propriétés, pas une phrase ni un fait ponctuel.
  const proprietes = new Map();
  for (const p of [...PROPRIETES_DEPART, ...proprietesApprises]) {
    if (!proprietes.has(p.mot)) proprietes.set(p.mot, new Map());
    proprietes.get(p.mot).set(p.propriete, p.valeur);
  }

  const regles = [...REGLES_DEPART, ...reglesApprises];

  // Les prénoms qu'elle connaît : tirés des faits, jamais codés en dur.
  const prenomsConnus = new Set();
  for (const f of faits.values()) {
    if (f.relation === 'nom' || f.relation === 'fils' || f.relation === 'fille') {
      prenomsConnus.add(String(f.valeur).toLowerCase());
    }
  }

  return { lexique, faits, patrons, proprietes, regles, prenomsConnus, magasin };
}

// Choisit le patron le plus précis disponible : un patron écrit pour CETTE relation l'emporte
// sur le patron général « valeur seule ». C'est ce qui rend un apprentissage visible.
// Même principe que le moteur de règles (plusSpecifiques) : les patrons gardent leur propre
// mesure de spécificité (relation/sujet), les règles la leur (nombre de conditions) — fusionner
// les deux formats de données n'aurait rien simplifié, mais le PRINCIPE de sélection est partagé.
export function candidatsPatron(patrons, { sujet, relation }) {
  const candidats = patrons.filter((p) => (p.relation === relation || p.relation === '*')
    && (p.sujet === sujet || p.sujet === '*'));
  return plusSpecifiques(candidats, precision);
}
export function choisirPatron(patrons, criteres) {
  return candidatsPatron(patrons, criteres)[0] || null;
}
const precision = (p) => (p.relation !== '*' ? 2 : 0) + (p.sujet !== '*' ? 1 : 0);

export function remplir(gabarit, { valeur, relation }) {
  return String(gabarit).replaceAll('{valeur}', valeur).replaceAll('{relation}', relation);
}

// Remplit un gabarit qui a en plus besoin d'un possessif CALCULÉ (jamais figé dans le texte appris) :
// c'est ce qui permet le transfert à un mot dont on n'a jamais montré la formulation.
// roleGenre : possessif_toi (Naissance parle DES affaires de Christophe, en le tutoyant) ou
// possessif_moi (Naissance parle DE ses propres affaires).
export function remplirAvecPossessif(gabarit, { valeur, relation, esprit, sujet }) {
  const roleGenre = sujet === 'naissance' ? ROLES.POSSESSIF_MOI : ROLES.POSSESSIF_TOI;
  const r = appliquerRegles(esprit.regles, { role: roleGenre, proprietesDuMot: esprit.proprietes.get(relation) });
  if (r.conflit) return { texte: null, conflit: true, candidats: r.candidats };
  if (!r.resultat) return { texte: null, manquant: true };
  const texte = String(gabarit).replaceAll('{possessif}', r.resultat)
    .replaceAll('{valeur}', valeur).replaceAll('{relation}', relation);
  return { texte, regle: r.regle };
}

// --- RÉPONDRE ----------------------------------------------------------------------------------
// Renvoie { texte, etat, comprehension, fait, patron } — tout ce qu'il faut pour EXPLIQUER.
export function repondre(esprit, phrase) {
  const c = comprendre(phrase, { lexique: esprit.lexique, prenomsConnus: esprit.prenomsConnus });
  if (c.etat === INCOMPRIS) return { texte: PHRASE_INCOMPRIS, etat: INCOMPRIS, comprehension: c, fait: null, patron: null };
  if (c.etat === PARTIEL) return { texte: PHRASE_INCOMPRIS, etat: PARTIEL, comprehension: c, fait: null, patron: null };

  const fait = esprit.faits.get(cleFait(c.sujet, c.relation)) || null;
  if (!fait) return { texte: PHRASE_IGNORANCE, etat: COMPRIS, comprehension: c, fait: null, patron: null };

  // Deux façons de dire aussi précises l'une que l'autre, mais qui ne disent pas la même chose :
  // même principe que pour les règles, on ne choisit jamais au hasard entre les deux.
  const candidats = candidatsPatron(esprit.patrons, c);
  if (candidats.length > 1 && new Set(candidats.map((p) => p.gabarit)).size > 1) {
    return { texte: PHRASE_CONFLIT_PATRON, etat: COMPRIS, comprehension: c, fait, patron: null, conflitPatron: true, candidats };
  }
  const patron = candidats[0] || null;
  if (patron && String(patron.gabarit).includes('{possessif}')) {
    const r = remplirAvecPossessif(patron.gabarit, { valeur: fait.valeur, relation: c.relation, esprit, sujet: c.sujet });
    if (r.conflit) return { texte: PHRASE_CONFLIT, etat: COMPRIS, comprehension: c, fait, patron, conflit: true, candidats: r.candidats };
    if (r.texte == null) return { texte: PHRASE_NE_SAIS_PAS_DIRE, etat: COMPRIS, comprehension: c, fait, patron, regleManquante: true };
    return { texte: r.texte, etat: COMPRIS, comprehension: c, fait, patron, regleUtilisee: r.regle };
  }

  const texte = patron ? remplir(patron.gabarit, { valeur: fait.valeur, relation: c.relation }) : String(fait.valeur);
  return { texte, etat: COMPRIS, comprehension: c, fait, patron };
}

// --- APPRENDRE UN FAIT --------------------------------------------------------------------------
export async function apprendreFait(esprit, { sujet, relation, valeur }) {
  const objet = { cle: cleFait(sujet, relation), sujet, relation, valeur };
  await esprit.magasin.ecrire('faits', objet);
  esprit.faits.set(objet.cle, objet);
  if (relation === 'nom' || relation === 'fils' || relation === 'fille') esprit.prenomsConnus.add(String(valeur).toLowerCase());
  return { type: 'fait', objet, explication: `J'ai retenu : ${sujet} → ${relation} → ${valeur}.` };
}

// --- APPRENDRE UN MOT ---------------------------------------------------------------------------
// « un gamin, c'est un fils » : le mot nouveau reçoit le rôle et la relation du mot connu.
export async function apprendreMot(esprit, { motNouveau, motConnu }) {
  const mot = decouper(motNouveau)[0];
  const ref = esprit.lexique[decouper(motConnu)[0]];
  if (!mot) throw new Error('Quel mot dois-je apprendre ?');
  if (!ref) throw new Error(`Je ne connais pas « ${motConnu} », je ne peux pas y rattacher un mot.`);
  const objet = { mot, role: ref.role, relation: ref.relation || null };
  await esprit.magasin.ecrire('lexique', objet);
  esprit.lexique[mot] = { role: objet.role, relation: objet.relation };
  return { type: 'mot', objet, explication: `J'ai retenu que « ${mot} » veut dire la même chose que « ${motConnu} ».` };
}

// --- APPRENDRE UNE NOUVELLE RELATION (v0.10) --------------------------------------------------
// « voiture » n'existait dans aucune phrase de départ : ce n'est l'équivalent d'aucun mot connu,
// c'est une information NOUVELLE. Distinct d'apprendreMot, qui ne fait que relier à un mot existant.
export async function apprendreRelation(esprit, { mot, relation }) {
  const m = decouper(mot)[0];
  const rel = decouper(relation)[0];
  if (!m || !rel) throw new Error("Il me faut le mot ET l'information qu'il désigne.");
  const objet = { mot: m, role: ROLES.RELATION, relation: rel };
  await esprit.magasin.ecrire('lexique', objet);
  esprit.lexique[m] = { role: objet.role, relation: objet.relation };
  return { type: 'relation', objet, explication: `J'ai retenu que « ${m} » désigne une information : « ${rel} ».` };
}

// --- APPRENDRE UNE PROPRIÉTÉ (v0.10) ------------------------------------------------------------
// « voiture / genre / féminin ». Une propriété d'un mot, indépendante de toute règle et de tout fait.
export async function apprendrePropriete(esprit, { mot, propriete, valeur, origine = 'apprise-christophe' }) {
  const m = decouper(mot)[0];
  const p = decouper(propriete)[0];
  const v = normaliserTexte(valeur);
  if (!m || !p || !v) throw new Error("Il me faut le mot, la propriété, et sa valeur.");
  const objet = { cle: clePropriete(m, p), mot: m, propriete: p, valeur: v, origine };
  await esprit.magasin.ecrire('proprietes', objet);
  if (!esprit.proprietes.has(m)) esprit.proprietes.set(m, new Map());
  esprit.proprietes.get(m).set(p, objet.valeur);
  return { type: 'propriete', objet, explication: `J'ai retenu : ${m} → ${p} → ${objet.valeur}.` };
}

// --- APPRENDRE UNE RÈGLE (v0.10) — LE CŒUR DU PROTOTYPE -----------------------------------------
// Une règle est une DONNÉE (rôle, conditions, résultat), jamais du JavaScript codé pour l'occasion.
// Réapprendre EXACTEMENT les mêmes conditions pour le même rôle REMPLACE la règle existante
// (nouvelle version, historique conservé via « precedente ») plutôt que d'en ajouter une concurrente.
export async function apprendreRegle(esprit, { role, conditions, resultat, origine = 'apprise-christophe', exemple = null }) {
  if (!role || !conditions?.length || !resultat) throw new Error('Il me faut un rôle, au moins une condition, et un résultat.');
  const roleNorm = normaliserTexte(role);
  const conditionsNorm = conditions.map((c) => ({ propriete: normaliserTexte(c.propriete), valeur: normaliserTexte(c.valeur) }));
  if (conditionsNorm.some((c) => !c.propriete || !c.valeur)) throw new Error('Une condition ne peut pas être vide.');
  const signature = signatureConditions(conditionsNorm);
  const ancienne = esprit.regles.find((r) => r.statut === 'validee' && normaliserTexte(r.role) === roleNorm && signatureConditions(r.conditions) === signature);
  const maintenant = new Date().toISOString();
  if (ancienne) {
    const remplacee = { ...ancienne, statut: 'remplacee', modifiee: maintenant };
    await esprit.magasin.ecrire('regles', remplacee);
    Object.assign(ancienne, remplacee);
  }
  const objet = {
    id: `regle-${roleNorm}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    role: roleNorm, conditions: conditionsNorm, resultat: String(resultat).trim(), origine, statut: 'validee',
    precedente: ancienne ? ancienne.id : null,
    exemples: exemple ? [exemple] : [],
    testsReussis: [], testsEchoues: [],
    creee: maintenant, modifiee: maintenant,
  };
  await esprit.magasin.ecrire('regles', objet);
  esprit.regles.push(objet);
  return {
    type: 'regle', objet,
    explication: ancienne
      ? `J'ai remplacé ma règle précédente pour « ${roleNorm} » sur ce cas : maintenant, ${objet.resultat}.`
      : `J'ai retenu une règle pour « ${roleNorm} » : ${conditionsNorm.map((c) => `${c.propriete}=${c.valeur}`).join(', ')} → ${objet.resultat}.`,
  };
}

// --- APPRENDRE UN PATRON ------------------------------------------------------------------------
// LE POINT CENTRAL DU PROTOTYPE v0.9.
// À partir d'une correction (« On dit : Ton fils s'appelle Atem »), on fabrique un gabarit
// RÉUTILISABLE en remplaçant la valeur connue par un emplacement : « Ton fils s'appelle {valeur}. »
//
// Le transfert vient de « portee » :
//   'relation' → le patron ne vaut que pour cette relation (fils).
//   'toutes'   → le patron vaut pour TOUTES les relations, grâce à {relation} : c'est cette
//                généralisation qui permet de l'appliquer plus tard à « ville » ou « couleur »
//                sans qu'on ait rien recodé.
// v0.10 : si demandé explicitement (dynamiserPossessif), un mot possessif connu (ta/ton/ma/mon…)
// présent dans la correction devient {possessif} — calculé plus tard par une règle, jamais figé
// dans le texte appris. C'est ce qui distingue le transfert « bête » d'une phrase (v0.9) du
// transfert d'un CHOIX grammatical (v0.10). NON ACTIVÉ PAR DÉFAUT : une façon de dire enseignée
// « à la v0.9 » (sans cette option) garde exactement son comportement d'avant — apprendre un
// nouveau patron ne doit jamais, en silence, rendre muet un patron qui marchait déjà.
// On ne devine jamais : la valeur (et le possessif, s'il est demandé) doivent réellement figurer
// dans la correction.
export function fabriquerGabarit(correction, valeur, relation, { portee = 'relation', lexique = LEXIQUE_DEPART, dynamiserPossessif = false } = {}) {
  const texte = String(correction).trim();
  const i = indexInsensible(texte, String(valeur));
  if (i < 0) return null;
  let gabarit = `${texte.slice(0, i)}{valeur}${texte.slice(i + String(valeur).length)}`;
  if (portee === 'toutes' && relation) {
    const j = indexInsensible(gabarit, relation);
    if (j >= 0) gabarit = `${gabarit.slice(0, j)}{relation}${gabarit.slice(j + relation.length)}`;
    else return null; // la relation n'apparaît pas : on ne peut pas généraliser honnêtement.
  }
  if (dynamiserPossessif) {
    const motPossessif = decouper(gabarit).find((m) => {
      const e = lexique[m];
      return e && (e.role === ROLES.POSSESSIF_TOI || e.role === ROLES.POSSESSIF_MOI);
    });
    if (motPossessif) {
      const k = indexInsensible(gabarit, motPossessif);
      if (k >= 0) gabarit = `${gabarit.slice(0, k)}{possessif}${gabarit.slice(k + motPossessif.length)}`;
      else return null; // demandé explicitement mais introuvable : on ne devine pas, on refuse.
    } else return null; // demandé explicitement mais aucun possessif dans la phrase : idem.
  }
  return gabarit;
}

function indexInsensible(texte, aTrouver) {
  const sans = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return sans(texte).indexOf(sans(aTrouver));
}

export async function apprendrePatron(esprit, { correction, sujet, relation, portee = 'relation', dynamiserPossessif = false }) {
  const fait = esprit.faits.get(cleFait(sujet, relation));
  if (!fait) throw new Error(`Je ne connais pas encore ${relation} de ${sujet} : apprends-moi d'abord le fait.`);
  const gabarit = fabriquerGabarit(correction, fait.valeur, relation, { portee, lexique: esprit.lexique, dynamiserPossessif });
  if (!gabarit) {
    throw new Error(dynamiserPossessif
      ? `Ta phrase doit contenir « ${fait.valeur} » et un mot comme « ta »/« ton »/« ma »/« mon », que je remplacerai par la bonne forme.`
      : portee === 'toutes'
        ? `Pour généraliser, ta phrase doit contenir la valeur « ${fait.valeur} » ET le mot « ${relation} ».`
        : `Ta phrase doit contenir « ${fait.valeur} », sinon je ne sais pas quoi retenir.`);
  }
  const objet = {
    id: `patron-${portee === 'toutes' ? 'toutes' : relation}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    relation: portee === 'toutes' ? '*' : relation,
    sujet, gabarit, origine: 'appris',
  };
  await esprit.magasin.ecrire('patrons', objet);
  esprit.patrons.push(objet);
  return {
    type: 'patron',
    objet,
    explication: portee === 'toutes'
      ? `J'ai retenu la façon de dire : « ${gabarit} » — et je peux l'utiliser pour d'autres informations que « ${relation} ».`
      : `J'ai retenu la façon de dire : « ${gabarit} » — pour « ${relation} ».`,
  };
}

export { comprendre, expliquer, COMPRIS, PARTIEL, INCOMPRIS };
export { plusSpecifiques, signatureConditions, appliquerRegles };
// === FIN_LANGAGE_ESPRIT ===
