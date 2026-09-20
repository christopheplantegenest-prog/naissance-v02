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

import { LEXIQUE_DEPART, FAITS_DEPART, PATRONS_DEPART, PHRASE_IGNORANCE, PHRASE_INCOMPRIS, ROLES } from './bagage.js';
import { comprendre, decouper, expliquer, COMPRIS, PARTIEL, INCOMPRIS } from './comprendre.js';
import { cleFait } from './connaissances.js';

export async function chargerEsprit(magasin) {
  const [faitsApris, lexiqueAppris, patronsApris] = await Promise.all([
    magasin.lireTout('faits'), magasin.lireTout('lexique'), magasin.lireTout('patrons'),
  ]);

  // Le bagage de départ, complété par ce qui a été appris. L'appris a toujours le dernier mot.
  const lexique = { ...LEXIQUE_DEPART };
  for (const e of lexiqueAppris) lexique[e.mot] = { role: e.role, relation: e.relation };

  const faits = new Map();
  for (const f of FAITS_DEPART) faits.set(cleFait(f.sujet, f.relation), f);
  for (const f of faitsApris) faits.set(f.cle, f);

  const patrons = [...PATRONS_DEPART, ...patronsApris];

  // Les prénoms qu'elle connaît : tirés des faits, jamais codés en dur.
  const prenomsConnus = new Set();
  for (const f of faits.values()) {
    if (f.relation === 'nom' || f.relation === 'fils' || f.relation === 'fille') {
      prenomsConnus.add(String(f.valeur).toLowerCase());
    }
  }

  return { lexique, faits, patrons, prenomsConnus, magasin };
}

// Choisit le patron le plus précis disponible : un patron écrit pour CETTE relation l'emporte
// sur le patron général « valeur seule ». C'est ce qui rend un apprentissage visible.
export function choisirPatron(patrons, { sujet, relation }) {
  const candidats = patrons.filter((p) => (p.relation === relation || p.relation === '*')
    && (p.sujet === sujet || p.sujet === '*'));
  candidats.sort((a, b) => precision(b) - precision(a));
  return candidats[0] || null;
}
const precision = (p) => (p.relation !== '*' ? 2 : 0) + (p.sujet !== '*' ? 1 : 0);

export function remplir(gabarit, { valeur, relation }) {
  return String(gabarit).replaceAll('{valeur}', valeur).replaceAll('{relation}', relation);
}

// --- RÉPONDRE ----------------------------------------------------------------------------------
// Renvoie { texte, etat, comprehension, fait, patron } — tout ce qu'il faut pour EXPLIQUER.
export function repondre(esprit, phrase) {
  const c = comprendre(phrase, { lexique: esprit.lexique, prenomsConnus: esprit.prenomsConnus });
  if (c.etat === INCOMPRIS) return { texte: PHRASE_INCOMPRIS, etat: INCOMPRIS, comprehension: c, fait: null, patron: null };
  if (c.etat === PARTIEL) return { texte: PHRASE_INCOMPRIS, etat: PARTIEL, comprehension: c, fait: null, patron: null };

  const fait = esprit.faits.get(cleFait(c.sujet, c.relation)) || null;
  if (!fait) return { texte: PHRASE_IGNORANCE, etat: COMPRIS, comprehension: c, fait: null, patron: null };

  const patron = choisirPatron(esprit.patrons, c);
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

// --- APPRENDRE UN PATRON ------------------------------------------------------------------------
// LE POINT CENTRAL DU PROTOTYPE.
// À partir d'une correction (« On dit : Ton fils s'appelle Atem »), on fabrique un gabarit
// RÉUTILISABLE en remplaçant la valeur connue par un emplacement : « Ton fils s'appelle {valeur}. »
//
// Le transfert vient de « portee » :
//   'relation' → le patron ne vaut que pour cette relation (fils).
//   'toutes'   → le patron vaut pour TOUTES les relations, grâce à {relation} : c'est cette
//                généralisation qui permet de l'appliquer plus tard à « ville » ou « couleur »
//                sans qu'on ait rien recodé.
// On ne devine jamais : la valeur à remplacer doit réellement figurer dans la correction.
export function fabriquerGabarit(correction, valeur, relation, { portee = 'relation' } = {}) {
  const texte = String(correction).trim();
  const i = indexInsensible(texte, String(valeur));
  if (i < 0) return null;
  let gabarit = `${texte.slice(0, i)}{valeur}${texte.slice(i + String(valeur).length)}`;
  if (portee === 'toutes' && relation) {
    const j = indexInsensible(gabarit, relation);
    if (j >= 0) gabarit = `${gabarit.slice(0, j)}{relation}${gabarit.slice(j + relation.length)}`;
    else return null; // la relation n'apparaît pas : on ne peut pas généraliser honnêtement.
  }
  return gabarit;
}

function indexInsensible(texte, aTrouver) {
  const sans = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return sans(texte).indexOf(sans(aTrouver));
}

export async function apprendrePatron(esprit, { correction, sujet, relation, portee = 'relation' }) {
  const fait = esprit.faits.get(cleFait(sujet, relation));
  if (!fait) throw new Error(`Je ne connais pas encore ${relation} de ${sujet} : apprends-moi d'abord le fait.`);
  const gabarit = fabriquerGabarit(correction, fait.valeur, relation, { portee });
  if (!gabarit) {
    throw new Error(portee === 'toutes'
      ? `Pour généraliser, ta phrase doit contenir la valeur « ${fait.valeur} » ET le mot « ${relation} ».`
      : `Ta phrase doit contenir « ${fait.valeur} », sinon je ne sais pas quoi retenir.`);
  }
  const objet = {
    id: `patron-${portee === 'toutes' ? 'toutes' : relation}-${Date.now()}`,
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
// === FIN_LANGAGE_ESPRIT ===
