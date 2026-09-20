// === DEBUT_LANGAGE_LECON ===
// LE CANAL PÉDAGOGIQUE, généralisé en v0.12 à quatre types de connaissances déjà stockables par
// Naissance (relation, fait, propriété, règle — v0.11 n'en couvrait qu'un seul, la règle).
//
// Toujours pas de compréhension du français libre : quatre petites formes fixes, chacune reconnue
// par un mot-clé de tête différent (Mot / Fait / Propriété / Pour), jamais par le contenu qu'elle
// transporte. « Mot : xyzz désigne grbl. » doit fonctionner exactement comme une vraie leçon —
// sinon ce serait la preuve que l'extraction reconnaît du vocabulaire plutôt qu'une structure.
//
// Les mots-clés de tête étant tous différents, une phrase ne peut structurellement correspondre
// qu'à UN SEUL type à la fois : pas besoin d'une logique de désambiguïsation séparée.
//
// « Patron » (les façons de dire, esprit.js/fabriquerGabarit) reste délibérément HORS de ce canal :
// son mécanisme (reverse-ingénierie d'une phrase entière) est trop différent des quatre autres,
// qui n'extraient que des emplacements. Le forcer ici serait une abstraction artificielle.

export const TYPES_LECON = Object.freeze({
  relation: 'Mot : <mot> désigne <relation>.',
  fait: 'Fait : <sujet> / <relation> / <valeur>.',
  propriete: 'Propriété : <mot> / <propriété> / <valeur>.',
  regle: 'Pour <rôle> : si <propriété> vaut <valeur>, on dit <résultat>.',
});

const GABARIT_RELATION = /^mot\s*:\s*(.+?)\s+désigne\s+(.+?)\s*\.?\s*$/i;
const GABARIT_FAIT = /^fait\s*:\s*(.+?)\s*\/\s*(.+?)\s*\/\s*(.+?)\s*\.?\s*$/i;
const GABARIT_PROPRIETE = /^propriété\s*:\s*(.+?)\s*\/\s*(.+?)\s*\/\s*(.+?)\s*\.?\s*$/i;
const GABARIT_REGLE = /^pour\s+(.+?)\s*:\s*si\s+(.+?)\s+vaut\s+(.+?)\s*,\s*on\s+dit\s+(.+?)\s*\.?\s*$/i;

const tousRemplis = (...vals) => vals.every((v) => v && v.trim());

// Renvoie { type, donnees } — donnees a exactement la forme attendue par la fonction d'apprentissage
// existante correspondante (apprendreRelation / apprendreFait / apprendrePropriete / apprendreRegle),
// pour qu'aucune transformation intermédiaire ne soit nécessaire au moment de la confirmation.
// Renvoie null si la phrase ne respecte AUCUNE des quatre formes. Ne devine jamais.
export function extraireLecon(texte) {
  const t = String(texte || '').trim();

  let m = t.match(GABARIT_RELATION);
  if (m && tousRemplis(m[1], m[2])) {
    return { type: 'relation', donnees: { mot: m[1].trim(), relation: m[2].trim() } };
  }

  m = t.match(GABARIT_FAIT);
  if (m && tousRemplis(m[1], m[2], m[3])) {
    return { type: 'fait', donnees: { sujet: m[1].trim(), relation: m[2].trim(), valeur: m[3].trim() } };
  }

  m = t.match(GABARIT_PROPRIETE);
  if (m && tousRemplis(m[1], m[2], m[3])) {
    return { type: 'propriete', donnees: { mot: m[1].trim(), propriete: m[2].trim(), valeur: m[3].trim() } };
  }

  m = t.match(GABARIT_REGLE);
  if (m && tousRemplis(m[1], m[2], m[3], m[4])) {
    return { type: 'regle', donnees: { role: m[1].trim(), conditions: [{ propriete: m[2].trim(), valeur: m[3].trim() }], resultat: m[4].trim() } };
  }

  return null;
}

// Un aperçu lisible, adapté au type reconnu — c'est ce que Naissance affiche AVANT toute écriture,
// pour que Christophe puisse voir une mauvaise interprétation avant qu'elle n'entre en mémoire.
export function apercuLecon({ type, donnees }) {
  if (type === 'relation') return `J'ai compris : le mot « ${donnees.mot} » désigne l'information « ${donnees.relation} ». C'est correct ?`;
  if (type === 'fait') return `J'ai compris : ${donnees.sujet} → ${donnees.relation} → ${donnees.valeur}. C'est correct ?`;
  if (type === 'propriete') return `J'ai compris : ${donnees.mot} a pour propriété « ${donnees.propriete} » la valeur « ${donnees.valeur} ». C'est correct ?`;
  if (type === 'regle') {
    const c = donnees.conditions[0];
    return `J'ai compris : rôle = ${donnees.role} ; si ${c.propriete} vaut ${c.valeur} ; alors ${donnees.resultat}. C'est correct ?`;
  }
  return null;
}
// === FIN_LANGAGE_LECON ===
