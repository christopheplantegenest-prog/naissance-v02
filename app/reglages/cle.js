// === DEBUT_CLE ===
// Nettoyage et diagnostic d'une clé collée. Aucun format n'est imposé :
// seuls les caractères parasites évidents sont retirés.

const INVISIBLES = /[\s\u00A0\u1680\u180E\u2000-\u200F\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]/g;
const GUILLEMETS_AUTOUR = /^["'«»“”„‘’‚`]+|["'«»“”„‘’‚`]+$/g;

export function nettoyerCle(brut) {
  if (typeof brut !== 'string') return '';
  return brut.replace(INVISIBLES, '').replace(GUILLEMETS_AUTOUR, '');
}

export function longueur(texte) {
  return [...(texte || '')].length;
}

// « AQ.A…9xZk (53 caractères) » : début, fin et longueur réellement reçue.
export function resumeCle(cle) {
  const lettres = [...(cle || '')];
  const n = lettres.length;
  if (!n) return 'aucune clé';
  const mot = n > 1 ? 'caractères' : 'caractère';
  if (n < 12) return `${'•'.repeat(n)} (${n} ${mot})`;
  return `${lettres.slice(0, 4).join('')}…${lettres.slice(-4).join('')} (${n} ${mot})`;
}

// Nombre de caractères hors ASCII visible : information, jamais un refus.
export function caracteresInhabituels(cle) {
  return [...(cle || '')].filter((c) => !/^[\x21-\x7E]$/.test(c)).length;
}
// === FIN_CLE ===
