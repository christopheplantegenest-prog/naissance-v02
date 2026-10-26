// Capacite en essai : NOUVELLES RECEPTIONS. Sans contenu cognitif, apres chaque tour.
// executer(entree) : entree = { lues: { receptions: [lignes] }, miennes: [lignes deja ecrites], contexte }.
// Les miennes peuvent dater d'avant un redemarrage de l'application ; elles ne sont pas forcement triees.
// Rend { lignes: [ une ligne ] } : cle = numero en texte, donnees = { numero, total, nouvelles }.
//   P         = ligne de miennes au plus grand numero entier positif (lignes mal formees ignorees) ;
//   numero    = numero de P plus 1 (1 sans P) ;
//   total     = nombre de lignes lues dans la table receptions (absente ou mal formee : 0) ;
//   nouvelles = total moins le total de P si ce total est un entier positif ou nul et ne depasse pas total ; sinon total.
// Aucune erreur levee sur une entree vide, nulle ou mal formee. Rien d'autre n'est retenu des lignes lues.

function objetSimple(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function precedente(miennes) {
  let p = null;
  if (!Array.isArray(miennes)) return p;
  for (const l of miennes) {
    if (!objetSimple(l) || !objetSimple(l.donnees)) continue;
    const v = l.donnees.numero;
    if (!Number.isInteger(v) || v < 1) continue;
    if (p === null || v > p.numero) p = l.donnees;
  }
  return p;
}

function longueur(t) {
  return Array.isArray(t) ? t.length : 0;
}

export function executer(entree) {
  const e = objetSimple(entree) ? entree : {};
  const lues = objetSimple(e.lues) ? e.lues : {};
  const total = longueur(lues.receptions);
  const p = precedente(e.miennes);
  const numero = p === null ? 1 : p.numero + 1;
  const ecartValide = p !== null && Number.isInteger(p.total) && p.total >= 0 && total >= p.total;
  const nouvelles = ecartValide ? total - p.total : total;
  return { lignes: [{ cle: String(numero), donnees: { numero, total, nouvelles } }] };
}
