// Capacite en essai : BILAN DES ECHANGES. Sans contenu cognitif, sur demande seulement (bouton Executer maintenant).
// executer(entree) : entree = { lues: { emissions: [lignes], receptions: [lignes] }, miennes: [lignes deja ecrites], contexte }.
// Rend { lignes: [ une ligne ] } : cle = numero en texte, donnees = { numero, emissions, receptions, ecart }.
//   numero     = plus grand numero entier deja ecrit dans miennes, plus 1 (1 au depart ; lignes mal formees ignorees) ;
//   emissions  = nombre de lignes lues dans la table emissions (table absente ou mal formee : 0) ;
//   receptions = nombre de lignes lues dans la table receptions (table absente ou mal formee : 0) ;
//   ecart      = emissions moins receptions (peut etre negatif).
// Aucune erreur levee sur une entree vide, nulle ou mal formee. Rien d'autre n'est retenu des lignes lues.

function objetSimple(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function plusGrandNumero(miennes) {
  let n = 0;
  if (!Array.isArray(miennes)) return n;
  for (const l of miennes) {
    if (!objetSimple(l) || !objetSimple(l.donnees)) continue;
    const v = l.donnees.numero;
    if (Number.isInteger(v) && v > n) n = v;
  }
  return n;
}

function longueur(t) {
  return Array.isArray(t) ? t.length : 0;
}

export function executer(entree) {
  const e = objetSimple(entree) ? entree : {};
  const lues = objetSimple(e.lues) ? e.lues : {};
  const numero = plusGrandNumero(e.miennes) + 1;
  const emissions = longueur(lues.emissions);
  const receptions = longueur(lues.receptions);
  const ecart = emissions - receptions;
  return { lignes: [{ cle: String(numero), donnees: { numero, emissions, receptions, ecart } }] };
}
