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

// ------------------------------------------------------------------------------------ RAPPORT DESCRIPTIF (03/10/2026)
// v0.48 — DÉCISION CHATGPT « RAPPORT DESCRIPTIF DE STRUCTURE », suite du diagnostic « IDENTIFIABILITÉ
// DES STRUCTURES DE CONTEXTE » (03/10/2026) : une hypothèse de structure N'EST PAS une classe
// d'intentions. Elle affirme seulement « cette forme de surface récurrente a été observée, avec ces
// preuves positives et cette diversité » — jamais « je connais toutes les formulations équivalentes
// à celle-ci ». decrireStructure() répond à UNE SEULE question, volontairement restreinte : étant
// donné un groupe de textes DÉJÀ proposé (par repererMotifs(), induction.js, ou tout autre moyen —
// cette fonction ne sait RIEN de la façon dont le groupe a été formé, et ne forme JAMAIS elle-même
// de groupe), que peut-on en dire de façon PUREMENT DESCRIPTIVE ?
//
// AUCUN verdict, AUCUN score synthétique, AUCUN pourcentage de confiance, AUCUN statut vrai/faux,
// AUCUNE notion de réfutation ou de contradiction (diagnostic précédent : indécidable à partir du
// contexte seul — Monde A / Monde B produisent des observations rigoureusement identiques). Réutilise
// STRICTEMENT construireSquelette()/calculerAncres() déjà existants (aucun deuxième algorithme de
// squelette) : decrireStructure() n'ajoute qu'une seule chose, absente d'eux — séparer la FRÉQUENCE
// brute (le nombre d'occurrences REÇUES, répétitions identiques comprises) de la DIVERSITÉ réellement
// observée (le nombre d'exemples DISTINCTS par contenu, et pour chaque position non ancrée, les
// valeurs réellement différentes qui y apparaissent). Une répétition identique dix fois reste
// observable comme dix occurrences, mais ne doit jamais être confondue avec dix preuves de variation
// (vérifié par harnais jetable avant ce chantier : sans cette séparation, calculerAncres() seul fait
// apparaître une ancre fausse à CHAQUE position d'un groupe de répétitions identiques).
//
// Renvoie { ok:false, raison, detail } (relayé tel quel depuis construireSquelette(), jamais
// réinterprété ici) ou :
//   { ok:true, occurrences, exemplesDistincts, n, ancres, positionsVariables, diversite }
// où :
//   - occurrences : nombre d'exemples valides reçus (après le même filtre que construireSquelette()),
//     répétitions identiques comptées autant de fois qu'elles apparaissent.
//   - exemplesDistincts : nombre d'exemples UNIQUES par contenu textuel (dédoublonnage par égalité
//     exacte du texte, espaces de bord ignorés — jamais une comparaison sémantique).
//   - ancres : calculerAncres() tel quel — « ce jeton est resté identique à cette position sur les
//     exemples fournis », jamais une règle, une vérité, une obligation, une classe, une intention ou
//     une capacité. Une ancre peut disparaître si ce rapport est recalculé plus tard sur un ensemble
//     plus large — comportement VOULU, jamais figé.
//   - positionsVariables : le complément exact des positions d'ancre (0..n-1 non ancrées).
//   - diversite : { [position]: { valeursDistinctes, nombre } }, UNIQUEMENT pour les positions non
//     ancrées — les valeurs RÉELLEMENT présentes à cette position dans les exemples fournis
//     (dédoublonnées) et leur compte. Un groupe de répétitions identiques produit nombre=1 à chaque
//     position variable (aucune diversité réellement observée), même si occurrences est élevé.
//
// Fonction PURE, isolée comme le reste de ce fichier : ne mute jamais les textes reçus, ne persiste
// rien, ne forme aucun groupe elle-même (cette responsabilité reste entièrement à l'appelant), et
// n'arbitre JAMAIS entre deux groupes candidats qui se chevaucheraient — plusieurs rapports, pour
// plusieurs groupes proposés séparément (même se chevauchant), coexistent simplement, sans jamais
// être départagés ici.
export function decrireStructure(textes) {
  const squelette = construireSquelette(textes);
  if (!squelette.ok) return squelette;
  const { n, exemples } = squelette.squelette;
  const ancres = calculerAncres(squelette.squelette);
  const positionsAncrees = new Set(ancres.map((a) => a.position));
  const tokenises = exemples.map((e) => tokeniser(e.entree));
  const positionsVariables = [];
  const diversite = {};
  for (let i = 0; i < n; i += 1) {
    if (positionsAncrees.has(i)) continue;
    positionsVariables.push(i);
    const valeursDistinctes = [...new Set(tokenises.map((jetons) => jetons[i]))];
    diversite[i] = { valeursDistinctes, nombre: valeursDistinctes.length };
  }
  const exemplesDistincts = new Set(exemples.map((e) => e.entree.trim())).size;
  return {
    ok: true,
    occurrences: exemples.length,
    exemplesDistincts,
    n,
    ancres,
    positionsVariables,
    diversite,
  };
}
// === FIN_LANGAGE_EXTRACTION ===
