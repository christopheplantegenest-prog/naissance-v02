// Module non cognitif : mise en forme lisible d'une taille exprimée en octets.
// Pur et dormant : aucune dépendance, aucune horloge, aucun hasard, aucun réseau,
// aucun stockage, aucune dépendance aux réglages régionaux. Il n'est branché nulle
// part dans l'application.
//
// formaterTaille(octets) :
// - octets doit être de type number, fini, positif ou nul (aucune conversion implicite) ;
//   -0 est accepté et rendu comme 0 ;
// - l'unité est la plus grande parmi o, Ko, Mo, Go (base 1024) dont le diviseur est
//   inférieur ou égal à la taille ; aucune unité au-delà de Go ;
// - la valeur est tronquée vers le bas au dixième (jamais arrondie vers le haut) ;
// - rendu : partie entière en chiffres décimaux (sans séparateur de milliers ni
//   exposant), puis « ,d » seulement si le dixième est non nul, puis une espace
//   ordinaire et l'unité.

const UNITES = [
  ['Go', 1024 * 1024 * 1024],
  ['Mo', 1024 * 1024],
  ['Ko', 1024],
  ['o', 1],
];

export function formaterTaille(octets) {
  if (typeof octets !== 'number') {
    throw new TypeError(`formaterTaille : la taille doit être un nombre d'octets (type reçu : ${typeof octets}).`);
  }
  if (!Number.isFinite(octets)) {
    throw new TypeError("formaterTaille : la taille doit être un nombre fini d'octets.");
  }
  if (octets < 0) {
    throw new RangeError('formaterTaille : la taille ne peut pas être négative.');
  }
  let unite = 'o';
  let diviseur = 1;
  for (const [nom, valeur] of UNITES) {
    if (valeur <= octets) {
      unite = nom;
      diviseur = valeur;
      break;
    }
  }
  const entier = Math.floor(octets / diviseur);
  const dixieme = Math.floor(((octets % diviseur) * 10) / diviseur);
  const decimale = dixieme > 0 ? `,${dixieme}` : '';
  return `${BigInt(entier).toString()}${decimale} ${unite}`;
}
