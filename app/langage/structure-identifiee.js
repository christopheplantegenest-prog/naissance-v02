// === DEBUT_LANGAGE_STRUCTURE_IDENTIFIEE ===
// v0.62.6 -- ÉTAPE 6 : « STRUCTURE DE TEXTES IDENTIFIÉS » (décision ChatGPT, 04/10/2026, suite au diagnostic
// « DIAGNOSTIC FINAL AVANT ADAPTATEUR »). ENVELOPPE PURE ET DORMANTE autour de decrireStructure() (extraction.js).
// Elle répond à UNE seule question :
//
//   « pour ce groupe de textes DÉJÀ choisi par l'appelant, quels ids ont réellement été soumis à
//     decrireStructure(), et quel rapport cet appel a-t-il produit ? »
//
// decrireStructure() reçoit des textes seuls et ne renvoie aucun id. Ce module ne fait rien d'autre que
// garder, à côté de son rapport, la liste des identités qu'on lui a fournies, dans l'ordre exact de la
// description. Il ne découvre aucun groupe, ne partitionne rien, ne mesure aucune arité, ne retente
// jamais, ne retire jamais un texte : un échec de description (arités incompatibles, groupe insuffisant)
// est rendu tel quel, avec sa couverture complète.
//
// ENTRÉE : un tableau d'éléments { id, texte }.
//   - id : chaîne non vide. Aucune normalisation.
//   - texte : chaîne contenant au moins un caractère non blanc. Transmise TELLE QUELLE à decrireStructure()
//     (ni trim, ni casse, ni ponctuation, ni découpage préalable : la notion de jeton est celle de
//     decrireStructure(), sans troisième représentation).
//   - Les autres propriétés d'un élément sont ignorées et jamais recopiées.
//
// VIOLATION DE CONTRAT = TypeError (erreur de programmation de l'appelant, jamais absorbée) : entrée qui
// n'est pas un tableau ; élément qui n'est pas un objet simple ; id qui n'est pas une chaîne non vide ;
// texte qui n'est pas une chaîne ou qui est entièrement blanc ; deux éléments de MÊME id (une identité
// désigne exactement un membre du groupe décrit : jamais choisie, jamais fusionnée, jamais rapportée à
// part). Le refus d'un texte vide/blanc est ce qui garantit que decrireStructure() ne filtre RIEN en
// silence : couverture et textes réellement décrits restent les mêmes.
//
// DÉTERMINISME : les éléments sont copiés puis triés par id (ordre des unités de code) AVANT l'appel ; la
// couverture et la liste de textes sont construites dans cet ordre exact. Le tri ne signifie RIEN (ni
// chronologie, ni importance). Le rapport n'est ni retouché ni trié : son déterminisme vient uniquement de
// l'ordre des éléments transmis.
//
// SORTIE EXACTE : { couverture, rapport }
//   - couverture : tableau neuf des ids transmis, triés ;
//   - rapport : la sortie de CET appel à decrireStructure(), sans aucun champ ajouté.
// Groupe vide ou à un seul membre : aucun traitement particulier, le rapport est celui que
// decrireStructure() répond (« insuffisant »), la couverture garde les ids fournis.
//
// INDÉPENDANCE : ce fichier importe uniquement decrireStructure. Il ne connaît que { id, texte } ->
// { couverture, rapport }. Aucun magasin, aucune base, aucune écriture, aucun appel de production
// aujourd'hui (garde-fou statique dans les tests).
import { decrireStructure } from './extraction.js';

function estObjetSimple(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}
function comparerCodeUnits(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function decrireStructureIdentifiee(elements) {
  if (!Array.isArray(elements)) throw new TypeError('decrireStructureIdentifiee : « elements » doit être un tableau.');
  const copies = [];
  const vus = new Set();
  for (const [i, e] of elements.entries()) {
    if (!estObjetSimple(e)) throw new TypeError(`decrireStructureIdentifiee : l'élément ${i} doit être un objet simple { id, texte }.`);
    const { id, texte } = e;
    if (typeof id !== 'string' || id.length === 0) throw new TypeError(`decrireStructureIdentifiee : l'élément ${i} doit avoir un « id » chaîne non vide.`);
    if (typeof texte !== 'string' || texte.trim() === '') throw new TypeError(`decrireStructureIdentifiee : l'élément « ${id} » doit avoir un « texte » chaîne contenant au moins un caractère non blanc.`);
    if (vus.has(id)) throw new TypeError(`decrireStructureIdentifiee : l'id « ${id} » apparaît plusieurs fois ; une identité désigne exactement un membre.`);
    vus.add(id);
    copies.push({ id, texte });
  }
  copies.sort((a, b) => comparerCodeUnits(a.id, b.id));
  const couverture = copies.map((c) => c.id);
  const rapport = decrireStructure(copies.map((c) => c.texte));
  return { couverture, rapport };
}
// === FIN_LANGAGE_STRUCTURE_IDENTIFIEE ===
