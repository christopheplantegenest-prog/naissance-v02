// === DEBUT_LANGAGE_SELECTION ===
// v0.41 — DÉCISION CHATGPT « PROCHAINE CAPACITÉ GÉNÉRALE DE RAISONNEMENT » (02/10).
//
// OBSERVATION (étape 1 de la méthode demandée) : confronter()/confronterToutes() (confrontation.js,
// v0.36) savent déjà comparer deux sujets NOMMÉS sur une ou plusieurs relations NOMMÉES, et
// resoudreChemin()/tenterComposition() (esprit.js, v0.33+) savent déjà suivre un CHEMIN de relations
// explicite. Mais ni l'un ni l'autre ne sait énumérer : chaque mécanisme existant POINTE vers une
// identité précise (sujet+relation) déjà choisie par l'appelant — jamais un balayage de ce qui est
// réellement connu. esprit.faits (esprit.js) est une Map depuis toujours, techniquement énumérable,
// mais AUCUN code ne la parcourt : chaque lecture fait un .get() sur une clé exacte.
//
// PLUS PETIT DÉNOMINATEUR COMMUN (étape 2) : « recherche de propriétés communes », « différence entre
// deux sujets », « raisonnement à partir de plusieurs résultats établis » et « sélection/recherche
// parmi plusieurs connaissances » se résolvent TOUS avec UNE seule primitive nouvelle : ÉNUMÉRER les
// faits déjà connus selon un critère simple (un sujet, ou une relation+valeur), là où jusqu'ici il
// fallait déjà savoir QUOI chercher avant de chercher. C'est ce fichier.
//
// Ce module reste à l'identique de confrontation.js dans son indépendance : AUCUN appel à
// comprendre()/repondre() ici, rien ici n'est appelé par eux (le raccord conversationnel passe par le
// REGISTRE FERMÉ, registre.js, exactement comme pour « confrontation » -- v0.38/v0.39). N'écrit
// JAMAIS rien en mémoire (aucun appel à esprit.magasin) : une lecture ponctuelle, jamais un fait
// dérivé permanent, même principe que resoudreChemin()/confronter().
//
// « DÉDUCTION NÉCESSITANT PLUSIEURS FAITS » (famille listée par ChatGPT) reste délibérément HORS de ce
// module : transférer une propriété connue de B vers A parce qu'ils partagent une autre propriété est
// une INFÉRENCE (un choix sur ce qui justifie la ressemblance), pas une énumération -- plusieurs
// primitives réellement différentes et incompatibles entre elles sont concevables (toute propriété
// commune suffit ? seulement certaines ? toutes doivent correspondre ?), un choix qui engage
// l'architecture et contredirait par endroits le principe « jamais un choix arbitraire » déjà présent
// partout ailleurs dans ce moteur (confrontation.js, resoudreChemin()...). Voir le MESSAGE POUR
// CHATGPT séparé plutôt qu'un bricolage ici.
import { confronterValeurs } from './confrontation.js';
import { canoniser } from './canon.js';

// Primitive de base : tous les faits actuellement connus (jamais ceux en conflit -- esprit.faits ne
// les contient déjà pas, voir recalculerIdentiteFait()/esprit.js : même garantie que partout
// ailleurs, aucun code supplémentaire nécessaire ici pour l'obtenir).
function tousLesFaits(esprit) {
  return [...esprit.faits.values()];
}

// Toutes les propriétés (relation, valeur) RÉELLEMENT connues d'un sujet -- jamais composées, jamais
// devinées : une lecture directe de esprit.faits, la MÊME source de vérité que
// resoudreChemin()/resoudreConnaissance(), simplement énumérée au lieu d'être pointée une identité à
// la fois. Égalité de sujet CANONIQUE (accent/casse/espaces, canon.js), jamais stricte.
export function proprietesDe(esprit, sujet) {
  const cible = canoniser(sujet);
  return tousLesFaits(esprit)
    .filter((f) => canoniser(f.sujet) === cible)
    .map((f) => ({ relation: f.relation, valeur: f.valeur }));
}

// Compare les ENSEMBLES de propriétés de deux sujets -- généralise confronterToutes() (confrontation.js)
// qui exige une LISTE de relations choisie par l'appelant (point ouvert documenté dans registre.js
// depuis v0.38 : un rôle de type LISTE que B1/B2 ne produisent pas). Ici, les relations comparées sont
// DÉCOUVERTES par énumération (celles que chaque sujet a RÉELLEMENT), jamais une liste fournie par la
// conversation -- ce qui répond à la question SANS avoir besoin d'un rôle-liste : les deux rôles
// restent sujetA/sujetB, exactement la même forme que la capacité « confrontation » déjà apprenable.
//
// Retour : { identiques, differentes, uniquementA, uniquementB }.
//   identiques   : { relation, valeur } -- relation connue des DEUX côtés, valeur canoniquement égale
//                  (confronterValeurs() réutilisée, jamais redéfinie).
//   differentes  : { relation, valeurA, valeurB } -- relation connue des deux côtés, valeurs distinctes.
//   uniquementA  : { relation, valeur } -- relation connue de sujetA seul.
//   uniquementB  : { relation, valeur } -- relation connue de sujetB seul.
// Une relation totalement inconnue des deux côtés n'apparaît nulle part (rien à énumérer) : pas
// d'équivalent à « inconnu » ici -- confronter() reste la primitive à utiliser quand UNE relation
// précise est nommée et qu'on veut distinguer explicitement « inconnu » de « absent des deux ».
export function proprietesCommunes(esprit, { sujetA, sujetB }) {
  const propsA = proprietesDe(esprit, sujetA);
  const propsB = proprietesDe(esprit, sujetB);
  const parRelationB = new Map(propsB.map((p) => [canoniser(p.relation), p]));
  const vuesB = new Set();
  const identiques = [];
  const differentes = [];
  const uniquementA = [];
  for (const pa of propsA) {
    const relCanon = canoniser(pa.relation);
    const pb = parRelationB.get(relCanon);
    if (!pb) { uniquementA.push({ relation: pa.relation, valeur: pa.valeur }); continue; }
    vuesB.add(relCanon);
    if (confronterValeurs(pa.valeur, pb.valeur) === 'egal') identiques.push({ relation: pa.relation, valeur: pa.valeur });
    else differentes.push({ relation: pa.relation, valeurA: pa.valeur, valeurB: pb.valeur });
  }
  const uniquementB = propsB.filter((pb) => !vuesB.has(canoniser(pb.relation))).map((p) => ({ relation: p.relation, valeur: p.valeur }));
  return {
    identiques, differentes, uniquementA, uniquementB,
  };
}

// Recherche/sélection : quels sujets, PARMI TOUT ce qui est connu, ont telle relation avec telle
// valeur -- égalité CANONIQUE uniquement (canon.js), jamais une valeur stockée modifiée. Renvoie une
// LISTE, potentiellement VIDE (jamais une abstention : « aucun sujet trouvé » est une réponse
// légitime, pas une incompréhension -- même esprit que confronterToutes(), qui classe plutôt que de
// refuser).
export function sujetsAvec(esprit, { relation, valeur }) {
  const relCible = canoniser(relation);
  const valCible = canoniser(valeur);
  return tousLesFaits(esprit)
    .filter((f) => canoniser(f.relation) === relCible && canoniser(f.valeur) === valCible)
    .map((f) => f.sujet);
}
// === FIN_LANGAGE_SELECTION ===
