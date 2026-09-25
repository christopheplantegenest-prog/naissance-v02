// === DEBUT_LANGAGE_CANON ===
// v0.17.1 — L'IDENTITÉ D'UN MOT, DE FAÇON COHÉRENTE PARTOUT.
//
// Constat (v0.17.0, « le bug du téléphone ») : les mots du lexique, les propriétés, les règles et
// les façons de dire directes sont déjà rangés et cherchés de façon COHÉRENTE — sans accent, en
// minuscules — grâce à decouper() (comprendre.js). Les FAITS, eux, gardaient la graphie tapée
// (accents, majuscules) et étaient donc introuvables dès qu'on tapait « téléphone » au lieu de
// « telephone ». Ce module donne UN SEUL point de calcul pour cette identité, utilisé par
// connaissances.js (cleFait) pour que faits, sujets et prénoms soient cohérents avec le reste.
//
// canoniser() reprend exactement ce que fait decouper()[0] sur un mot simple (vérifié : les deux
// donnent le même résultat pour tout mot sans espace ni tiret), mais SANS jamais découper ni tronquer :
// « cœur » reste « cœur » (pas « c »), « Jean-Pierre » devient « jean-pierre » (pas ["jean","pierre"]),
// « porte-monnaie » devient « porte-monnaie » (pas « porte »). Ce point est important : une future
// reconnaissance d'expressions à plusieurs mots ou de mots composés doit rester possible.
//
// CE QUI EST DÉLIBÉRÉMENT LAISSÉ TEL QUEL, ET NE DOIT PAS ÊTRE PRIS POUR UN PRINCIPE DÉFINITIF :
// la suppression des accents fusionne déjà des mots distincts (à/a, où/ou, sûr/sur) au niveau de
// comprendre(). Ce module ne fait qu'aligner faits/sujets/prénoms sur ce que le moteur fait déjà
// ailleurs ; il ne prétend pas que « deux graphies avec/sans accent désignent toujours la même chose ».
//
// CE MODULE NE CANONISE JAMAIS UNE VALEUR (le texte affiché d'un fait) : seulement une IDENTITÉ
// (un sujet, une relation, un prénom). La graphie tapée reste toujours disponible dans les champs
// des lignes (sujet, relation, valeur) : ce module ne les modifie jamais lui-même.
//
// Version du modèle de canonisation : si ce modèle change un jour, seule cette constante bouge —
// l'identité étant recalculée au chargement (jamais stockée), aucune migration de données n'est
// nécessaire (voir connaissances.js et esprit.js : chargerEsprit reconstruit tout depuis les champs).
export const CANON_VERSION = 1;

const APOSTROPHES = /[’‘´`ʼ]/g;
const TIRETS = /[‐‑‒–—]/g;

// L'identité d'un mot, d'un sujet ou d'une relation : minuscules, sans accent, apostrophes et
// tirets typographiques unifiés, espaces (y compris insécables) réduits, bords retirés. Rien
// d'autre : aucun caractère n'est supprimé, aucun mot n'est découpé ni tronqué.
export function canoniser(texte) {
  return String(texte ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(APOSTROPHES, "'")
    .replace(TIRETS, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
// === FIN_LANGAGE_CANON ===
