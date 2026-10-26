// Capacite EN ESSAI "Receptions par jour" (classe E du robot). Essai sans contenu cognitif : la capacite compte les receptions lues
// par jour (les 10 premiers caracteres de leur horodatage) et ne retient rien d'autre. Elle s'execute dans le bac isole de la porte
// d'essai, n'ecrit que dans la zone d'essai et reste inactive tant qu'elle n'est pas activee a la main.
// executer(entree) : entree = { lues: { receptions: [lignes] }, miennes: [lignes deja ecrites par la capacite], contexte }.
// Rendu : { lignes: [ une ligne ] }, cle = numero en texte, donnees = { numero, jours, total } :
//   numero = plus grand numero deja ecrit dans miennes, plus un (1 au depart) ;
//   jours  = nombre de receptions par jour ("inconnu" si l'horodatage manque ou n'est pas un texte) ;
//   total  = nombre de receptions lues.
// Une entree vide, absente ou mal formee ne leve jamais d'erreur.

const INCONNU = 'inconnu';
const LONGUEUR_JOUR = 10;

function tableau(x) {
  return Array.isArray(x) ? x : [];
}

function plusGrandNumero(miennes) {
  let n = 0;
  for (let i = 0; i < miennes.length; i += 1) {
    const l = miennes[i];
    const d = l !== null && typeof l === 'object' ? l.donnees : null;
    const v = d !== null && typeof d === 'object' ? d.numero : null;
    if (Number.isInteger(v) && v > n) n = v;
  }
  return n;
}

function jourDe(reception) {
  const h = reception !== null && typeof reception === 'object' ? reception.horodatage : null;
  if (typeof h !== 'string' || h.length === 0) return INCONNU;
  return h.substring(0, LONGUEUR_JOUR);
}

function compterParJour(receptions) {
  const cles = [];
  const nombres = [];
  for (let i = 0; i < receptions.length; i += 1) {
    const jour = jourDe(receptions[i]);
    const k = cles.indexOf(jour);
    if (k < 0) {
      cles.push(jour);
      nombres.push(1);
    } else {
      nombres[k] += 1;
    }
  }
  const paires = [];
  for (let i = 0; i < cles.length; i += 1) paires.push([cles[i], nombres[i]]);
  return Object.fromEntries(paires);
}

export function executer(entree) {
  const e = entree !== null && typeof entree === 'object' ? entree : {};
  const miennes = tableau(e.miennes);
  const lues = e.lues !== null && typeof e.lues === 'object' ? e.lues : {};
  const receptions = tableau(lues.receptions);
  const numero = plusGrandNumero(miennes) + 1;
  const ligne = { cle: JSON.stringify(numero), donnees: { numero, jours: compterParJour(receptions), total: receptions.length } };
  return { lignes: [ligne] };
}
