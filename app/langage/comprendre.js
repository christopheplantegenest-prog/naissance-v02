// === DEBUT_LANGAGE_COMPRENDRE ===
// COMPRENDRE : transformer une phrase en intention structurée.
// Entièrement déterministe : aucun appel à LFM2, aucun hasard. La même phrase donne toujours
// le même résultat, et on peut toujours expliquer pourquoi.
//
// ATTENTION — découpage PROPRE à ce module, volontairement différent de motsCles()
// (memoire/selection.js) : ici on GARDE les mots d'une ou deux lettres et les mots « vides ».
// « mon » et « ton » ne sont pas du bruit : ce sont eux qui disent de QUI on parle, et les
// confondre est exactement le défaut qu'on cherche à ne plus reproduire.

import { ROLES, LEXIQUE_DEPART } from './bagage.js';

// Découpe en mots en conservant tout ce qui a du sens. L'apostrophe sépare (« j'habite » → j, habite)
// car elle cache souvent un pronom. Les accents sont retirés pour comparer, la casse ignorée.
export function decouper(phrase) {
  return String(phrase || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`]/g, "'")
    .split(/[^a-z0-9']+/)
    .flatMap((m) => m.split("'"))
    .filter(Boolean);
}

// Qui est le sujet de la question, d'après les petits mots ?
//   « ma couleur »  → moi (celui qui parle)
//   « ta couleur »  → naissance
//   « tu t'appelles » → naissance
//   sinon, si un prénom connu apparaît → cette personne
function trouverSujet(mots, lexique, prenomsConnus) {
  for (const m of mots) {
    const e = lexique[m];
    if (!e) continue;
    if (e.role === ROLES.POSSESSIF_MOI || e.role === ROLES.PRONOM_MOI) return 'moi';
    if (e.role === ROLES.POSSESSIF_TOI || e.role === ROLES.PRONOM_TOI) return 'naissance';
  }
  for (const m of mots) {
    if (prenomsConnus.has(m)) return m;
  }
  return null;
}

// Quelle information est demandée ? Portée par un nom (« fils ») ou un verbe (« habites »).
// Les NOMS passent avant les VERBES, et c'est important : dans « Comment s'appelle mon fils ? »,
// le verbe « appelle » désigne le nom, mais l'information réellement demandée est « fils »
// (le fils de celui qui parle). Sans cette priorité, elle répondrait le prénom de Christophe
// au lieu de celui de son fils.
function trouverRelation(mots, lexique) {
  for (const m of mots) {
    const e = lexique[m];
    if (e && e.relation && e.role === ROLES.RELATION) return e.relation;
  }
  for (const m of mots) {
    const e = lexique[m];
    if (e && e.relation && e.role === ROLES.VERBE) return e.relation;
  }
  // Un interrogatif peut porter la relation à lui seul : « Où est-ce que j'habite ? » → ville.
  for (const m of mots) {
    const e = lexique[m];
    if (e && e.relation && e.role === ROLES.INTERROGATIF) return e.relation;
  }
  return null;
}

// v0.17.2 — SEGMENTATION + PORTÉE : chaque mot de rôle INTERROGATIF démarre un nouveau groupe (lui
// inclus) ; tout ce qui précède appartient au(x) groupe(s) précédent(s). Sert à isoler la VRAIE
// question d'une phrase qui contient aussi une adresse à Naissance (« Tu sais quel est mon
// manteau ? ») ou une autre proposition (« La lampe est blanche. Quel est mon manteau ? ») — sans
// avoir besoin de ponctuation, absente ou peu fiable en dictée vocale.
function grouperParInterrogatif(mots, lexique) {
  const groupes = [];
  let courant = [];
  for (const m of mots) {
    const estInterrogatif = lexique[m] && lexique[m].role === ROLES.INTERROGATIF;
    if (estInterrogatif && courant.length) { groupes.push(courant); courant = [m]; }
    else courant.push(m);
  }
  if (courant.length) groupes.push(courant);
  return groupes;
}

// Le groupe où chercher sujet et relation : le DERNIER groupe qui contient un interrogatif (la
// question réellement posée, généralement la plus proche de la fin) ; s'il n'y en a aucun, la
// phrase ENTIÈRE — comportement strictement inchangé pour toute phrase sans mot interrogatif.
function groupePertinent(mots, lexique) {
  const groupes = grouperParInterrogatif(mots, lexique);
  const avecInterrogatif = groupes.filter((g) => g.some((m) => lexique[m] && lexique[m].role === ROLES.INTERROGATIF));
  return avecInterrogatif.length ? avecInterrogatif[avecInterrogatif.length - 1] : mots;
}

export const COMPRIS = 'compris';
export const PARTIEL = 'partiel';
export const INCOMPRIS = 'incompris';

// Résultat : { etat, sujet, relation, mots, motsInconnus }
//   compris   : on sait de qui on parle ET quelle information est demandée.
//   partiel   : on a l'un des deux seulement — on peut le dire, et ça devient matière à apprendre.
//   incompris : ni l'un ni l'autre.
export function comprendre(phrase, { lexique = LEXIQUE_DEPART, prenomsConnus = new Set() } = {}) {
  const mots = decouper(phrase);
  // v0.17.2 — sujet et relation sont cherchés dans le groupe PERTINENT (voir groupePertinent
  // ci-dessus), jamais dans toute la phrase telle quelle : c'est la seule différence avec avant ce
  // chantier. Sans aucun mot interrogatif, le groupe pertinent EST la phrase entière — comportement
  // identique à avant.
  const groupe = groupePertinent(mots, lexique);
  const sujet = trouverSujet(groupe, lexique, prenomsConnus);
  const relation = trouverRelation(groupe, lexique);
  const motsInconnus = mots.filter((m) => !lexique[m] && !prenomsConnus.has(m));
  let etat = INCOMPRIS;
  if (sujet && relation) etat = COMPRIS;
  else if (sujet || relation) etat = PARTIEL;
  return { etat, sujet, relation, mots, motsInconnus };
}

// Explication lisible de ce qu'elle a compris — pour que Christophe voie DANS QUOI elle se trompe.
export function expliquer(c) {
  if (c.etat === COMPRIS) return `J'ai compris : sujet « ${c.sujet} », information « ${c.relation} ».`;
  if (c.etat === PARTIEL) {
    if (c.sujet && !c.relation) return `Je vois de qui on parle (« ${c.sujet} ») mais pas quelle information est demandée.`;
    return `Je vois quelle information est demandée (« ${c.relation} ») mais pas de qui on parle.`;
  }
  return `Je n'ai rien reconnu${c.motsInconnus.length ? ` — mots inconnus : ${c.motsInconnus.join(', ')}` : ''}.`;
}
// === FIN_LANGAGE_COMPRENDRE ===
