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
import { canoniser } from './canon.js';

export const PHRASE_NE_SAIS_PAS_DIRE = "Je ne sais pas comment le dire : je n'ai pas de règle pour ça.";
export const PHRASE_CONFLIT = 'Deux de mes règles se contredisent pour dire ça — je préfère ne pas choisir au hasard.';
export const PHRASE_CONFLIT_PATRON = "J'ai appris deux façons de dire ça qui se contredisent — je préfère ne pas choisir au hasard.";
// v0.17.1 — conflit entre plusieurs LIGNES DE FAIT de même identité (héritées d'avant la correction
// des identifiants, ou laissées par une écriture antérieure) : même principe que les deux ci-dessus,
// jamais de choix arbitraire. Voir regrouperLigneFait / recalculerIdentiteFait plus bas.
export const PHRASE_CONFLIT_FAIT = "J'ai appris deux réponses différentes pour ça — je préfère ne pas choisir au hasard.";
const RELATIONS_PRENOM = new Set(['nom', 'fils', 'fille']);

// La « clé de ligne » réellement stockée en base pour un fait — repli sur son identité si absente
// (cas du bagage de départ, jamais persisté). Ne JAMAIS utiliser pour chercher : uniquement pour
// savoir si une ligne DÉJÀ ÉCRITE correspond à celle qu'on s'apprête à modifier ou retirer.
function cleLigneFait(f) { return f.cle || cleFait(f.sujet, f.relation); }

// Range une ligne de fait dans son groupe d'identité (Map identité → lignes). Une ligne qui a la
// MÊME clé stockée qu'une déjà présente REMPLACE cette entrée (recalcul après une écriture), elle
// ne s'ajoute pas en double.
function regrouperLigneFait(groupes, ligne) {
  const id = cleFait(ligne.sujet, ligne.relation);
  const g = groupes.get(id) || [];
  const cle = cleLigneFait(ligne);
  const i = g.findIndex((l) => cleLigneFait(l) === cle);
  if (i >= 0) g[i] = ligne; else g.push(ligne);
  groupes.set(id, g);
  return id;
}

// La décision « une réponse servie, ou un conflit » pour UN groupe de lignes PERSISTÉES (jamais le
// bagage de départ). Conflit = valeurs STRICTEMENT différentes après un simple rognage — jamais
// normalisées pour décider qu'elles sont identiques (v0.17.1, décision explicite). Plusieurs lignes
// de MÊME valeur : aucun conflit, la ligne dont la clé stockée est déjà l'identité canonique est
// préférée, sinon la plus petite clé — choix déterministe, aucune donnée perdue, les autres lignes
// restent en base. UN SEUL point de calcul, utilisé au chargement ET après chaque écriture/retrait :
// une mutation ici doit se voir des deux côtés à la fois.
function deriverFaitDuGroupe(groupe) {
  if (!groupe.length) return { conflit: false, gagnante: null };
  const valeurs = new Set(groupe.map((l) => String(l.valeur).trim()));
  if (valeurs.size > 1) return { conflit: true, gagnante: null };
  const id = cleFait(groupe[0].sujet, groupe[0].relation);
  const gagnante = groupe.find((l) => cleLigneFait(l) === id)
    || [...groupe].sort((a, b) => cleLigneFait(a).localeCompare(cleLigneFait(b)))[0];
  return { conflit: false, gagnante };
}

// Recalcule, pour UNE identité, l'état de esprit.faits / esprit.conflitsFaits à partir de son groupe
// courant — appelé après chaque écriture (apprendreFait) et chaque retrait (oublierFait).
function recalculerIdentiteFait(esprit, id) {
  const groupe = esprit.groupesFaits.get(id) || [];
  const { conflit, gagnante } = deriverFaitDuGroupe(groupe);
  esprit.conflitsFaits.delete(id);
  esprit.faits.delete(id);
  if (conflit) esprit.conflitsFaits.set(id, groupe);
  else if (gagnante) esprit.faits.set(id, gagnante);
}


export async function chargerEsprit(magasin) {
  const [faitsApris, lexiqueAppris, patronsApris, proprietesApprises, reglesApprises] = await Promise.all([
    magasin.lireTout('faits'), magasin.lireTout('lexique'), magasin.lireTout('patrons'),
    magasin.lireTout('proprietes'), magasin.lireTout('regles'),
  ]);

  // Le bagage de départ, complété par ce qui a été appris. L'appris a toujours le dernier mot.
  const lexique = { ...LEXIQUE_DEPART };
  for (const e of lexiqueAppris) lexique[e.mot] = { role: e.role, relation: e.relation };

  // v0.17.1 — les faits APPRIS sont d'abord regroupés par IDENTITÉ (cleFait, canonique), jamais par
  // leur clé stockée telle quelle : c'est ce qui retrouve, sans aucune migration, une ligne laissée
  // par la v0.17.0 sous une clé brute comme « moi|téléphone ». Le bagage de départ garde la priorité
  // la plus basse : un fait appris avec la MÊME identité le remplace toujours (comme avant), sans
  // jamais déclencher de conflit avec le départ — un conflit ne peut naître qu'entre deux lignes
  // réellement PERSISTÉES (voir recalculerIdentiteFait).
  const groupesFaits = new Map();
  for (const f of faitsApris) regrouperLigneFait(groupesFaits, f);

  const faits = new Map();
  for (const f of FAITS_DEPART) faits.set(cleFait(f.sujet, f.relation), f);
  const conflitsFaits = new Map();
  for (const [id, groupe] of groupesFaits) {
    const { conflit, gagnante } = deriverFaitDuGroupe(groupe);
    if (conflit) { conflitsFaits.set(id, groupe); faits.delete(id); continue; }
    faits.set(id, gagnante);
  }

  const patrons = [...PATRONS_DEPART, ...patronsApris];

  // Propriétés : Map mot → Map propriete → valeur. C'est le mot lui-même (souvent le nom de la
  // relation : « voiture ») qui porte ses propriétés, pas une phrase ni un fait ponctuel.
  const proprietes = new Map();
  for (const p of [...PROPRIETES_DEPART, ...proprietesApprises]) {
    if (!proprietes.has(p.mot)) proprietes.set(p.mot, new Map());
    proprietes.get(p.mot).set(p.propriete, p.valeur);
  }

  const regles = [...REGLES_DEPART, ...reglesApprises];

  // Les prénoms qu'elle connaît : tirés de TOUTES les lignes (bagage de départ, apprises — y compris
  // celles en conflit : reconnaître un prénom dans une phrase n'a pas besoin de savoir laquelle des
  // deux réponses en conflit est la bonne), sous leur forme canonique — v0.17.1, sinon « Aurélie »
  // ou « Marie » restaient introuvables comme sujets malgré leur majuscule ou leur accent.
  const prenomsConnus = new Set();
  for (const f of [...FAITS_DEPART, ...faitsApris]) {
    if (RELATIONS_PRENOM.has(canoniser(f.relation))) prenomsConnus.add(canoniser(f.valeur));
  }

  // Diagnostic pour le laboratoire (v0.17.1) : nombre de lignes de faits réellement en jeu (départ
  // non recouvert + toutes les lignes apprises, doublons et conflits compris — pas le nombre
  // d'identités), et nombre de lignes dont la clé stockée n'est plus la forme canonique actuelle
  // (héritées d'avant cette version). Purement informatif, ne change aucune réponse.
  const departActifs = FAITS_DEPART.filter((f) => !groupesFaits.has(cleFait(f.sujet, f.relation)));
  const diagnosticFaits = {
    lignes: departActifs.length + faitsApris.length,
    conflits: conflitsFaits.size,
    ancienneGraphie: faitsApris.filter((f) => cleLigneFait(f) !== cleFait(f.sujet, f.relation)).length,
  };

  return { lexique, faits, conflitsFaits, groupesFaits, diagnosticFaits, patrons, proprietes, regles, prenomsConnus, magasin };
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

// --- RÔLES DYNAMIQUES DANS UN GABARIT (v0.14.1) ------------------------------------------------
// Un patron peut contenir des emplacements au-delà de {valeur}/{relation}. Chacun DEVIENT
// littéralement le nom d'un rôle cherché dans les règles — aucune connaissance grammaticale n'est
// codée ici : ni « genre », ni « possessif », ni aucun autre mot du domaine. La seule exception
// EXPLICITE et VOLONTAIRE est {possessif} lui-même : les patrons déjà appris (v0.9 à v0.14) s'en
// servent, avec un choix de rôle qui dépend de QUI PARLE (Naissance elle-même, ou Christophe) —
// une information que le nom de l'emplacement seul ne porte pas. Généraliser ce cas précis
// casserait tout ce qui est déjà validé sur un vrai téléphone ; il reste donc câblé à la main,
// à côté du mécanisme générique, jamais à sa place.
const EMPLACEMENTS_STRUCTURELS = new Set(['valeur', 'relation']);

export function emplacementsDynamiques(gabarit) {
  const trouves = new Set();
  const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let m;
  while ((m = re.exec(String(gabarit)))) {
    if (!EMPLACEMENTS_STRUCTURELS.has(m[1])) trouves.add(m[1]);
  }
  return [...trouves];
}

// Remplit un gabarit qui a besoin d'au moins une règle pour être complété (un possessif calculé,
// ou tout autre rôle jamais codé en dur) : c'est ce qui permet le transfert à un mot dont on n'a
// jamais montré la formulation. Si UN SEUL des emplacements ne peut pas être résolu (aucune règle,
// ou un conflit réel entre plusieurs), rien n'est produit à moitié : jamais un emplacement laissé
// tel quel dans une phrase, jamais un choix arbitraire entre deux règles qui se contredisent.
export function remplirGabarit(gabarit, { valeur, relation, esprit, sujet }) {
  const emplacements = emplacementsDynamiques(gabarit);
  let texte = String(gabarit);
  const reglesUtilisees = [];
  for (const nom of emplacements) {
    const role = nom === 'possessif' ? (sujet === 'naissance' ? ROLES.POSSESSIF_MOI : ROLES.POSSESSIF_TOI) : nom;
    const r = appliquerRegles(esprit.regles, { role, proprietesDuMot: esprit.proprietes.get(relation) });
    if (r.conflit) return { texte: null, conflit: true, candidats: r.candidats };
    if (!r.resultat) return { texte: null, manquant: true };
    texte = texte.replaceAll(`{${nom}}`, r.resultat);
    reglesUtilisees.push(r.regle);
  }
  texte = texte.replaceAll('{valeur}', valeur).replaceAll('{relation}', relation);
  return { texte, reglesUtilisees };
}

// --- RÉPONDRE ----------------------------------------------------------------------------------
// Renvoie { texte, etat, comprehension, fait, patron } — tout ce qu'il faut pour EXPLIQUER.
export function repondre(esprit, phrase) {
  const c = comprendre(phrase, { lexique: esprit.lexique, prenomsConnus: esprit.prenomsConnus });
  if (c.etat === INCOMPRIS) return { texte: PHRASE_INCOMPRIS, etat: INCOMPRIS, comprehension: c, fait: null, patron: null };
  if (c.etat === PARTIEL) return { texte: PHRASE_INCOMPRIS, etat: PARTIEL, comprehension: c, fait: null, patron: null };

  const idFait = cleFait(c.sujet, c.relation);
  if (esprit.conflitsFaits && esprit.conflitsFaits.has(idFait)) {
    return {
      texte: PHRASE_CONFLIT_FAIT, etat: COMPRIS, comprehension: c, fait: null, patron: null,
      conflitFait: true, candidatsFait: esprit.conflitsFaits.get(idFait),
    };
  }
  const fait = esprit.faits.get(idFait) || null;
  if (!fait) return { texte: PHRASE_IGNORANCE, etat: COMPRIS, comprehension: c, fait: null, patron: null };

  // Deux façons de dire aussi précises l'une que l'autre, mais qui ne disent pas la même chose :
  // même principe que pour les règles, on ne choisit jamais au hasard entre les deux.
  const candidats = candidatsPatron(esprit.patrons, c);
  if (candidats.length > 1 && new Set(candidats.map((p) => p.gabarit)).size > 1) {
    return { texte: PHRASE_CONFLIT_PATRON, etat: COMPRIS, comprehension: c, fait, patron: null, conflitPatron: true, candidats };
  }
  const patron = candidats[0] || null;
  if (patron && emplacementsDynamiques(patron.gabarit).length) {
    const r = remplirGabarit(patron.gabarit, { valeur: fait.valeur, relation: c.relation, esprit, sujet: c.sujet });
    if (r.conflit) return { texte: PHRASE_CONFLIT, etat: COMPRIS, comprehension: c, fait, patron, conflit: true, candidats: r.candidats };
    if (r.texte == null) return { texte: PHRASE_NE_SAIS_PAS_DIRE, etat: COMPRIS, comprehension: c, fait, patron, regleManquante: true };
    return { texte: r.texte, etat: COMPRIS, comprehension: c, fait, patron, regleUtilisee: r.reglesUtilisees[0], reglesUtilisees: r.reglesUtilisees };
  }

  const texte = patron ? remplir(patron.gabarit, { valeur: fait.valeur, relation: c.relation }) : String(fait.valeur);
  return { texte, etat: COMPRIS, comprehension: c, fait, patron };
}

// --- APPRENDRE UN FAIT --------------------------------------------------------------------------
// v0.17.1 — sujet, relation et valeur restent EXACTEMENT ce qui est tapé (jamais canonisés : c'est
// la graphie humaine, affichée telle quelle). Seule l'IDENTITÉ (cleFait) sert à ranger et retrouver.
// Une ligne EXISTANTE pour cette identité est REMPLACÉE EN PLACE (même clé stockée, aucun doublon) ;
// à défaut, une nouvelle ligne est créée avec l'identité canonique comme clé. Si l'identité est déjà
// en CONFLIT (plusieurs valeurs différentes en mémoire), l'écriture est REFUSÉE tant qu'il n'est pas
// résolu à la main (oublierFait) : jamais de choix silencieux entre deux réponses.
export async function apprendreFait(esprit, { sujet, relation, valeur }) {
  const id = cleFait(sujet, relation);
  if (esprit.conflitsFaits.has(id)) {
    const candidats = esprit.conflitsFaits.get(id).map((l) => `« ${l.valeur} »`).join(' et ');
    throw new Error(`J'ai déjà plusieurs réponses différentes en mémoire pour « ${sujet} → ${relation} » (${candidats}) : oublie d'abord la mauvaise avant d'en apprendre une nouvelle.`);
  }
  const groupe = esprit.groupesFaits.get(id) || [];
  const existante = esprit.faits.get(id) || groupe[0] || null;
  const objet = existante ? { ...existante, sujet, relation, valeur, cle: existante.cle || id } : { cle: id, sujet, relation, valeur };
  await esprit.magasin.ecrire('faits', objet);
  regrouperLigneFait(esprit.groupesFaits, objet);
  recalculerIdentiteFait(esprit, id);
  if (RELATIONS_PRENOM.has(canoniser(relation))) esprit.prenomsConnus.add(canoniser(valeur));
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

// Écriture partagée, entre l'ancien chemin (reconstruit depuis un exemple) et le nouveau (v0.14.2,
// gabarit fourni tout fait) : une seule définition de ce qui constitue « le même patron », pour ne
// jamais risquer que les deux chemins se contredisent sur ce qu'est un doublon. Réapprendre
// EXACTEMENT la même façon de dire ne crée jamais de copie — sans ce garde-fou, redemander
// plusieurs fois la même chose (ex. un bouton de test cliqué deux fois) accumule des façons de
// dire identiques en apparence mais distinctes en mémoire, qui finissent par se contredire sans
// raison visible (observé le 21/09).
async function ecrirePatron(esprit, { relation, sujet, gabarit }) {
  const dejaConnu = esprit.patrons.find((p) => p.relation === relation && p.sujet === sujet && p.gabarit === gabarit);
  if (dejaConnu) {
    return { type: 'patron', objet: dejaConnu, explication: `Je connais déjà cette façon de dire, je n'ai rien ajouté de plus : « ${gabarit} ».` };
  }
  const objet = {
    id: `patron-${relation === '*' ? 'toutes' : relation}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    relation, sujet, gabarit, origine: 'appris',
  };
  await esprit.magasin.ecrire('patrons', objet);
  esprit.patrons.push(objet);
  return {
    type: 'patron', objet,
    explication: relation === '*'
      ? `J'ai retenu la façon de dire : « ${gabarit} » — et je peux l'utiliser pour d'autres informations.`
      : `J'ai retenu la façon de dire : « ${gabarit} » — pour « ${relation} ».`,
  };
}

export async function apprendrePatron(esprit, { correction, sujet, relation, portee = 'relation', dynamiserPossessif = false }) {
  const fait = esprit.faits.get(cleFait(sujet, relation));
  if (!fait) throw new Error(`Je ne connais pas encore ${relation} de ${sujet} : apprends-moi d'abord le fait.`);
  // v0.17.1 — la RECHERCHE littérale dans la phrase de correction (ci-dessous) utilise
  // indexInsensible, déjà insensible à l'accent et à la casse : chercher la forme canonique de
  // « relation » y retrouve aussi bien « téléphone » que « telephone » dans le texte tapé. Mais le
  // patron doit être RANGÉ sous une identité canonique (comme candidatsPatron le compare), sinon un
  // patron appris pour « téléphone » ne s'applique jamais aux questions (dont la relation comprise
  // est toujours canonique) — c'était exactement le bug constaté avec le rapport du 21/09.
  const idRelation = canoniser(relation);
  const idSujet = canoniser(sujet);
  const gabarit = fabriquerGabarit(correction, fait.valeur, idRelation, { portee, lexique: esprit.lexique, dynamiserPossessif });
  if (!gabarit) {
    throw new Error(dynamiserPossessif
      ? `Ta phrase doit contenir « ${fait.valeur} » et un mot comme « ta »/« ton »/« ma »/« mon », que je remplacerai par la bonne forme.`
      : portee === 'toutes'
        ? `Pour généraliser, ta phrase doit contenir la valeur « ${fait.valeur} » ET le mot « ${relation} ».`
        : `Ta phrase doit contenir « ${fait.valeur} », sinon je ne sais pas quoi retenir.`);
  }
  return ecrirePatron(esprit, { relation: portee === 'toutes' ? '*' : idRelation, sujet: idSujet, gabarit });
}

// --- FAÇON DE DIRE PAR LE CANAL PÉDAGOGIQUE (v0.14.2) --------------------------------------------
// À la différence d'apprendrePatron ci-dessus, AUCUNE reconstruction depuis un exemple : le gabarit
// est fourni tout fait, avec ses emplacements déjà écrits. C'est la seule façon d'accepter un rôle
// arbitraire, jamais vu ni codé — rien, dans un exemple concret, ne permet de
// deviner quel mot représente le résultat d'un rôle inventé (voir fabriquerGabarit : son mécanisme
// {possessif} ne sait chercher QUE les mots du lexique ayant le rôle possessif_toi/possessif_moi,
// il ne généralise à rien d'autre). Ce chemin n'a donc besoin d'aucun fait préexistant : un patron
// peut être appris avant sa règle, ou après — l'ordre n'a jamais d'importance ici.
const NOM_EMPLACEMENT_VALIDE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Exportée pour être testée isolément, et pour que l'écran puisse annoncer une erreur AVANT même
// de tenter l'écriture.
export function validerGabaritDirect(gabarit) {
  const g = String(gabarit || '').trim();
  if (!g) return 'Le gabarit ne peut pas être vide.';
  let profondeur = 0;
  for (const c of g) {
    if (c === '{') profondeur++;
    else if (c === '}') {
      profondeur--;
      if (profondeur < 0) return 'Une accolade fermante n’a pas d’accolade ouvrante correspondante.';
    }
  }
  if (profondeur !== 0) return 'Une accolade ouvrante n’a pas d’accolade fermante.';
  const emplacements = [...g.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  for (const nom of emplacements) {
    if (!nom) return 'Un emplacement est vide : « {} ».';
    if (!NOM_EMPLACEMENT_VALIDE.test(nom)) return `« {${nom}} » n'est pas un nom d'emplacement valide (lettres, chiffres, tiret bas).`;
  }
  if (!emplacements.includes('valeur')) return 'Le gabarit doit contenir {valeur}, sinon il ne dira jamais ce que je sais.';
  return null;
}

export async function apprendrePatronDirect(esprit, { relation, sujet, gabarit }) {
  const rel = String(relation).trim();
  const relationFinale = rel === '*' ? '*' : (decouper(rel)[0] || rel);
  const suj = decouper(sujet)[0] || String(sujet).trim();
  const g = String(gabarit).trim();
  const erreur = validerGabaritDirect(g);
  if (erreur) throw new Error(erreur);
  return ecrirePatron(esprit, { relation: relationFinale, sujet: suj, gabarit: g });
}

// --- OUBLIER UNE SEULE FAÇON DE DIRE ---------------------------------------------------------
// Les façons de dire, contrairement aux règles, n'ont pas de mécanisme de version : en réapprendre
// une ne remplace jamais une ancienne, ce qui peut laisser deux façons générales se contredire
// (observé le 21/09 : « Ton {relation} s'appelle {valeur}. » de v0.9 contre
// « {possessif} {relation}, c'est {valeur}. » de v0.12 — toutes deux générales, jamais départagées).
// « Tout lui faire oublier » est le seul recours existant, mais efface tout. Ce retrait ciblé
// n'efface qu'UNE façon de dire précise, jamais rien d'autre.
export async function oublierPatron(esprit, id) {
  const patron = esprit.patrons.find((p) => p.id === id);
  if (!patron) throw new Error("Je ne connais pas cette façon de dire.");
  await esprit.magasin.supprimer('patrons', id);
  esprit.patrons = esprit.patrons.filter((p) => p.id !== id);
  return { explication: `J'ai oublié cette façon de dire : « ${patron.gabarit} ».` };
}

// --- RETRAIT CIBLÉ DES AUTRES CONNAISSANCES (v0.14) ---------------------------------------------
// Même principe que oublierPatron ci-dessus, étendu aux quatre autres types. AUCUNE CASCADE :
// retirer une relation ne touche jamais les faits ou propriétés qui la mentionnent — ils restent
// en mémoire, simplement inaccessibles tant que la relation n'est pas réenseignée. C'est un choix
// délibéré (réversibilité maximale, jamais de suppression massive imprévisible), pas un oubli.

// v0.17.1 — avec `cle` : retire EXACTEMENT cette ligne stockée (utilisé quand plusieurs lignes
// existent pour une même identité — conflit ou doublon — et qu'il faut en viser une seule ; c'est
// ce que le panneau « Gérer ce qu'elle sait » transmet pour chaque ligne d'un conflit affiché).
// Sans `cle` : retire le fait par son identité, comme avant ; si l'identité est EN CONFLIT, refuse
// clairement (jamais de suppression arbitraire) et liste les valeurs en présence.
export async function oublierFait(esprit, { sujet, relation, cle }) {
  const id = cleFait(sujet, relation);
  if (cle) {
    const groupe = esprit.groupesFaits.get(id) || [];
    const ligne = groupe.find((l) => cleLigneFait(l) === cle);
    if (!ligne) throw new Error('Je ne connais pas ce fait.');
    await esprit.magasin.supprimer('faits', cle);
    esprit.groupesFaits.set(id, groupe.filter((l) => l !== ligne));
    recalculerIdentiteFait(esprit, id);
    return { explication: `J'ai oublié : ${ligne.sujet} → ${ligne.relation} → ${ligne.valeur}.` };
  }
  if (esprit.conflitsFaits.has(id)) {
    const lignes = esprit.conflitsFaits.get(id);
    throw new Error(`Il y a ${lignes.length} réponses différentes en mémoire pour « ${sujet} → ${relation} » (${lignes.map((l) => `« ${l.valeur} »`).join(', ')}) : précise laquelle oublier.`);
  }
  const fait = esprit.faits.get(id);
  if (!fait) throw new Error('Je ne connais pas ce fait.');
  const cleReelle = cleLigneFait(fait);
  await esprit.magasin.supprimer('faits', cleReelle);
  const groupe = (esprit.groupesFaits.get(id) || []).filter((l) => cleLigneFait(l) !== cleReelle);
  esprit.groupesFaits.set(id, groupe);
  recalculerIdentiteFait(esprit, id);
  return { explication: `J'ai oublié : ${fait.sujet} → ${fait.relation} → ${fait.valeur}.` };
}

export async function oublierPropriete(esprit, { mot, propriete }) {
  const m = decouper(mot)[0];
  const p = decouper(propriete)[0];
  const carte = esprit.proprietes.get(m);
  const valeur = carte?.get(p);
  if (valeur === undefined) throw new Error('Je ne connais pas cette propriété.');
  await esprit.magasin.supprimer('proprietes', clePropriete(m, p));
  carte.delete(p);
  if (!carte.size) esprit.proprietes.delete(m);
  return { explication: `J'ai oublié : ${m} → ${p} → ${valeur}.` };
}

// Couvre aussi bien un mot déclaré comme nouvelle information (apprendreRelation) qu'un synonyme
// (apprendreMot) : les deux vivent dans la même table, sous la même forme. Un mot du bagage de
// départ ne peut pas être oublié : il n'existe pas dans la base, le « retirer » n'y survivrait pas
// à un redémarrage — mieux vaut le dire clairement que de laisser croire à un oubli qui ne tient pas.
export async function oublierRelation(esprit, mot) {
  const m = decouper(mot)[0];
  const entree = esprit.lexique[m];
  if (!entree || entree.role !== ROLES.RELATION) throw new Error("Je ne connais pas ce mot comme une information à part.");
  if (LEXIQUE_DEPART[m]) throw new Error('Ce mot fait partie de mon bagage de départ : je ne peux pas l’oublier.');
  await esprit.magasin.supprimer('lexique', m);
  delete esprit.lexique[m];
  return { explication: `J'ai oublié que « ${m} » désigne une information. Les faits et propriétés déjà donnés à son sujet restent en mémoire, mais inaccessibles tant que je ne connais plus ce mot.` };
}

// Ne supprime JAMAIS l'enregistrement : détruirait l'historique de version déjà en place
// (precedente/remplacee). Un simple statut de plus, que appliquerRegles() ignore déjà — aucun
// changement nécessaire côté moteur de règles.
export async function oublierRegle(esprit, id) {
  const regle = esprit.regles.find((r) => r.id === id && r.statut === 'validee');
  if (!regle) throw new Error('Je ne connais pas cette règle active.');
  const maintenant = new Date().toISOString();
  const desactivee = { ...regle, statut: 'desactivee', modifiee: maintenant };
  await esprit.magasin.ecrire('regles', desactivee);
  Object.assign(regle, desactivee);
  return {
    explication: `J'ai désactivé cette règle : ${regle.role} — ${regle.conditions.map((c) => `${c.propriete}=${c.valeur}`).join(', ')} → ${regle.resultat}. Son historique reste consultable.`,
  };
}

export { comprendre, expliquer, COMPRIS, PARTIEL, INCOMPRIS };
export { plusSpecifiques, signatureConditions, appliquerRegles };
// === FIN_LANGAGE_ESPRIT ===
