// === DEBUT_LANGAGE_LECON ===
// LE CANAL PÉDAGOGIQUE (v0.11) : transformer une petite phrase à FORME FIXE en règle exploitable.
//
// Ce n'est PAS de la compréhension du français libre — et ça n'a jamais prétendu l'être.
// C'est un petit langage pédagogique CONTRÔLÉ : une seule forme de phrase, reconnue par ses mots
// d'échafaudage (« Pour », « si », « vaut », « on dit »), jamais par le contenu qu'elle transporte.
// « Pour xyzz : si grbl vaut zorx, on dit qud. » doit fonctionner exactement comme une vraie leçon
// grammaticale : si ce n'était pas le cas, ce serait la preuve que l'extraction reconnaît du
// vocabulaire plutôt qu'une structure — précisément ce qu'on refuse ici.
//
// Une phrase qui ne respecte pas cette forme est refusée, jamais devinée.

export const FORME_LECON = 'Pour <rôle> : si <propriété> vaut <valeur>, on dit <résultat>.';

const GABARIT_LECON = /^pour\s+(.+?)\s*:\s*si\s+(.+?)\s+vaut\s+(.+?)\s*,\s*on\s+dit\s+(.+?)\s*\.?\s*$/i;

// Renvoie { role, conditions: [{propriete, valeur}], resultat } — EXACTEMENT la forme attendue par
// apprendreRegle (esprit.js), texte brut non normalisé (la normalisation reste la responsabilité
// d'apprendreRegle, au même titre que pour une règle saisie via le formulaire) — ou null si la
// phrase ne respecte pas la forme. Ne devine jamais : pas de résultat partiel.
export function extraireLecon(texte) {
  const m = String(texte || '').trim().match(GABARIT_LECON);
  if (!m) return null;
  const [, role, propriete, valeur, resultat] = m;
  if (!role.trim() || !propriete.trim() || !valeur.trim() || !resultat.trim()) return null;
  return { role: role.trim(), conditions: [{ propriete: propriete.trim(), valeur: valeur.trim() }], resultat: resultat.trim() };
}
// === FIN_LANGAGE_LECON ===
