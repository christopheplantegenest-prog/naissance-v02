// === DEBUT_ATELIER_MONTANTS ===
// v0.65.3 — AT-4 « ÉCRAN ATELIER OFF / MANUEL » (GO « AUTORISATION AT-4 », 17/10/2026 ; D-007). Frontière pure écran ↔ registre AT-2.
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance. Unité du registre : 1 USD = 1 000 000 microdollars (entiers sûrs).
//   lireUSD(texte)        -> entier de microdollars, ou { refus: true, raison } (rien n'est arrondi, rien n'est corrigé)
//   ecrireUSD(microdollars) -> texte exact « 80,00 », « 0,01 », « 0,000001 » (virgule, 2 à 6 décimales) ; lireUSD(ecrireUSD(m)) === m
// Format accepté : 0 à 999 999 dollars, un seul séparateur (virgule OU point), 1 à 6 décimales. Refusés : vide, espace, signe, exposant,
// zéro de tête (« 05 »), séparateur de milliers, 7 décimales ou plus, séparateur sans chiffre (« 5, », « ,5 »), tout autre caractère.
// Calcul par chaînes et entiers seulement : aucun nombre à virgule, aucune conversion de chaîne par l'interpréteur.
// PURETÉ : aucun import, aucune horloge, aucun état, aucune entrée/sortie.

const FORMAT = /^(0|[1-9][0-9]{0,5})(?:[.,]([0-9]{1,6}))?$/;
const MILLION = 1000000;

// Entier d'une chaîne de chiffres déjà validée, chiffre par chiffre.
function entierDe(chiffres) {
  let n = 0;
  for (let i = 0; i < chiffres.length; i += 1) n = n * 10 + (chiffres.charCodeAt(i) - 48);
  return n;
}

export function lireUSD(texte) {
  if (typeof texte !== 'string' || texte.length === 0) return Object.freeze({ refus: true, raison: 'montant vide' });
  const m = FORMAT.exec(texte);
  if (!m) return Object.freeze({ refus: true, raison: `montant « ${texte} » illisible : chiffres, une virgule ou un point, 6 décimales au plus, sans espace ni signe (ex. 12,50)` });
  const decimales = (m[2] || '').padEnd(6, '0');
  return entierDe(m[1]) * MILLION + entierDe(decimales);
}

export function ecrireUSD(microdollars) {
  if (!Number.isSafeInteger(microdollars) || microdollars < 0) throw new TypeError('ecrireUSD : entier sûr >= 0 de microdollars attendu.');
  const reste = microdollars % MILLION;
  const entier = (microdollars - reste) / MILLION;
  let decimales = String(reste).padStart(6, '0');
  while (decimales.length > 2 && decimales.endsWith('0')) decimales = decimales.slice(0, -1);
  return `${entier},${decimales}`;
}
// === FIN_ATELIER_MONTANTS ===
