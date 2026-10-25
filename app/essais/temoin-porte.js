// === DEBUT_ESSAIS_TEMOIN ===
// v0.66.8 — ATELIER 2, L3 : TÉMOIN DE LA PORTE D'ESSAI. Capacité de démonstration SANS contenu cognitif : elle sert à vérifier la porte
// sur le téléphone (activation, coupure, provenance, redémarrage, pannes). Elle s'exécute dans le bac isolé, comme toute capacité en essai.
// executer(entree) : entree = { lues: { receptions: [...] }, miennes: [lignes déjà écrites], epreuve, contexte }.
//   Sans épreuve : UNE ligne, cle 'n-<numero>', donnees { numero, receptions } (numero = plus grand numéro déjà écrit + 1 ; receptions =
//   nombre de lignes lues dans la table receptions, sans rien en retenir d'autre).
//   Épreuves (choisies dans l'écran, une exécution manuelle chacune ; chacune DOIT provoquer la coupure automatique) :
//     panne      : lève une erreur ;
//     boucle     : ne rend jamais la main (le bac est terminé au délai) ;
//     asynchrone : rend un objet qui se donne pour une promesse ;
//     evasion    : tente de fabriquer du code à partir d'un texte par un accès calculé (le verrou du bac l'en empêche) ;
//     forme      : rend trop de lignes ;
//     doublon    : réécrit la clé de sa dernière ligne (refus de la zone, rien n'est écrit).
// Ce module n'importe rien et ne contient aucun mot interdit par l'analyse (voir analyse.js) : il est accepté par la première barrière ;
// les épreuves montrent que la seconde (verrou) et la troisième (validation de la porte) arrêtent ce que la première ne voit pas.
function plusGrandNumero(miennes) {
  let n = 0;
  for (const l of miennes) if (l && l.donnees && Number.isInteger(l.donnees.numero) && l.donnees.numero > n) n = l.donnees.numero;
  return n;
}

export function executer(entree) {
  const miennes = Array.isArray(entree && entree.miennes) ? entree.miennes : [];
  const lues = entree && entree.lues && Array.isArray(entree.lues.receptions) ? entree.lues.receptions : [];
  const numero = plusGrandNumero(miennes) + 1;
  const ligne = { cle: `n-${numero}`, donnees: { numero, receptions: lues.length } };
  const epreuve = entree ? entree.epreuve : null;
  if (epreuve === 'panne') throw new Error('panne volontaire du témoin');
  if (epreuve === 'boucle') { let k = 0; for (;;) k += 1; }
  if (epreuve === 'asynchrone') return { [`th${'en'}`]: (ok) => ok(ligne), lignes: [ligne] };
  if (epreuve === 'evasion') { const fabrique = [].map[`constr${'uctor'}`]; return fabrique('return 1')(); }
  if (epreuve === 'forme') return { lignes: Array.from({ length: 50 }, (_, i) => ({ cle: `f-${i}`, donnees: { numero: numero + i, receptions: 0 } })) };
  if (epreuve === 'doublon' && miennes.length) {
    const derniere = miennes.find((l) => l && l.donnees && l.donnees.numero === numero - 1) || miennes[miennes.length - 1];
    return { lignes: [{ cle: derniere.cle, donnees: { numero, receptions: lues.length } }] };
  }
  return { lignes: [ligne] };
}
// === FIN_ESSAIS_TEMOIN ===
