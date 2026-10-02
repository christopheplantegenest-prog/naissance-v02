// === DEBUT_LANGAGE_EXTRACTION ===
// v0.37.0 — DÉCISION CHATGPT « LOT B1 : EXTRACTION PURE » (02/10), premier des trois lots de la
// primitive B (« action interne paramétrée apprise » — cadrage du même jour). Ce fichier répond à
// UNE SEULE question, volontairement restreinte : étant donné plusieurs exemples qui partagent une
// même FORME (un squelette), quelles POSITIONS varient d'un exemple à l'autre, et quelles valeurs
// occupent ces positions dans une entrée NOUVELLE qui correspond à ce squelette ?
//
// AUCUN nom sémantique de rôle (pas de « sujetA »/« sujetB »), AUCUNE opération, AUCUN registre,
// AUCUNE persistance, AUCUN raccord à comprendre()/repondre(), AUCUNE UI : tout cela est hors
// périmètre de B1, réservé aux lots B2/B3. Ce fichier, comme transformation.js et induction.js, est
// PUR et ISOLÉ : aucun import d'esprit.js/comprendre.js/connaissances.js, aucun accès réseau, aucun
// Gemini.
//
// RÉUTILISE STRICTEMENT les mécanismes déjà existants et déjà testés (transformation.js) :
//   - tokeniser()        : découpage de SURFACE (jamais decouper(), qui écraserait casse/accents).
//   - calculerAncres()   : quelles POSITIONS portent EXACTEMENT le même jeton dans tous les exemples
//                          d'apprentissage d'un « squelette » (même structure qu'une transformation,
//                          { n, exemples:[{entree}] } — ici SANS jamais de champ `sortie`, B1 n'a
//                          besoin que de reconnaître une forme, jamais de la transformer).
//   - correspondSquelette() : une entrée NOUVELLE a-t-elle la même arité et porte-t-elle EXACTEMENT
//                          les mêmes jetons aux positions ancrées ? Renvoie déjà `false` sans aucune
//                          ancre (aucun signal distinctif) — même garde-fou anti-sur-généralisation
//                          qu'avant ce chantier, repris tel quel, jamais réécrit.
// AUCUN deuxième algorithme de reconnaissance de squelette n'est créé ici : extraireVariables()
// n'ajoute qu'une seule chose, absente de transformation.js — lire, à chaque position NON ancrée, le
// jeton réellement présent dans l'entrée, plutôt que de les réinsérer dans un texte de sortie
// (appliquerTransformation() résout un problème différent : texte→texte, jamais texte→valeurs).
import { tokeniser, calculerAncres, correspondSquelette } from './transformation.js';

// Construit un « squelette » minimal à partir de plusieurs exemples bruts (texte seul) : même
// plancher qu'induireTransformation() (transformation.js) — au moins DEUX exemples (un seul exemple
// ne prouve jamais une régularité), et la MÊME arité en jetons pour tous. Ne juge JAMAIS
// l'ÉLIGIBILITÉ du squelette (présence d'au moins une ancre) : cette question appartient à
// correspondSquelette()/extraireVariables() ci-dessous, pas à la construction — un squelette sans
// aucune ancre reste un objet valide, simplement jamais reconnu par la suite (voir calculerAncres,
// transformation.js : « SANS AUCUNE ancre... ne doit jamais servir à la reconnaissance »).
export function construireSquelette(exemples) {
  const liste = (exemples || []).filter((e) => typeof e === 'string' && e.trim());
  if (liste.length < 2) {
    return { ok: false, raison: 'insuffisant', detail: `il faut au moins deux exemples cohérents pour généraliser, pas un seul (${liste.length} fourni${liste.length > 1 ? 's' : ''}).` };
  }
  const tokenises = liste.map((e) => tokeniser(e));
  const n0 = tokenises[0].length;
  if (tokenises.some((jE) => jE.length !== n0)) {
    return {
      ok: false,
      raison: 'arites_incompatibles',
      detail: `les exemples n'ont pas tous la même arité (${tokenises.map((jE) => jE.length).join(', ')}) : ce mécanisme ne généralise pour l'instant qu'à arité fixe.`,
    };
  }
  return { ok: true, squelette: { n: n0, exemples: liste.map((e) => ({ entree: e })) } };
}

// Reconnaît une entrée NOUVELLE par rapport à un squelette déjà construit, et renvoie la valeur
// RÉELLEMENT présente à chaque position NON ancrée (jamais une position ancrée, puisqu'elle ne varie
// par définition jamais et ne porte donc aucune information nouvelle) : { position: jeton, ... }.
// Renvoie null si l'entrée ne correspond pas au squelette — arité différente, un jeton d'ancre non
// respecté, ou squelette sans aucune ancre (correspondSquelette() couvre déjà les trois cas
// identiquement, rien n'est dupliqué ici). Fonction PURE : ne mute jamais le squelette reçu, ne
// recalcule jamais la correspondance deux fois de façons différentes (un seul point de vérité,
// correspondSquelette(), comme transformation.js).
export function extraireVariables(squelette, entreeTexte) {
  if (!correspondSquelette(squelette, entreeTexte)) return null;
  const jetons = tokeniser(entreeTexte);
  const positionsAncrees = new Set(calculerAncres(squelette).map((a) => a.position));
  const resultat = {};
  for (let i = 0; i < squelette.n; i += 1) {
    if (!positionsAncrees.has(i)) resultat[i] = jetons[i];
  }
  return resultat;
}
// === FIN_LANGAGE_EXTRACTION ===
