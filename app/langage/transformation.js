// === DEBUT_LANGAGE_TRANSFORMATION ===
// CHANTIER « ÉDUQUER PLUTÔT QUE PROGRAMMER » (décision ChatGPT du 27/09/2026, suite au diagnostic
// grammaire négation v0.25) : Naissance sait déjà STOCKER des connaissances déclaratives (faits,
// propriétés, mots) et des substitutions à créneau fermé (règles de rôle, façons de dire). Il lui
// manquait une catégorie réellement nouvelle : APPRENDRE UNE TRANSFORMATION à partir de plusieurs
// couples entrée → sortie, et l'APPLIQUER à une entrée jamais vue -- sans qu'aucune notion
// grammaticale (verbe, négation, temps...) ne soit câblée en dur ici. Ce fichier ne sait donc RIEN du
// français : il aligne des jetons de surface, cherche des insertions littérales invariantes, et
// s'abstient dès que les exemples ne s'accordent pas. Pur et isolé, comme induction.js : aucun accès
// à esprit.js/connaissances.js, aucun réseau, aucun Gemini (garde-fou statique en fin de fichier).
//
// PRINCIPE (le plus petit dénominateur commun trouvé après inspection de l'architecture réelle) :
// une transformation apprise ici est une INSERTION DE JETONS LITTÉRAUX à des positions fixes
// (arité n = nombre de jetons de l'entrée). Exemple (n=2, jetons ["Je","mange"]) :
//   insertions = [ [], ["ne"], ["pas"] ]   (avant jeton 0 ; entre jeton 0 et 1 ; après jeton 1)
//   « Je cours » (n=2) → "" + "Je" + "ne" + "cours" + "pas" → « Je ne cours pas »
// COMPOSER deux transformations apprises séparément revient, dans ce modèle, à FUSIONNER leurs
// insertions position par position (fusionnerTransformations ci-dessous) : si deux transformations
// touchent des positions DIFFÉRENTES, la fusion est automatique et sans ambiguïté ; si elles se
// contredisent à la même position, la fusion s'abstient -- jamais un choix arbitraire.
//
// ÉLARGI le 27/09/2026 (décision ChatGPT « DIAGNOSTIC v0.26.0, TRANSFORMATION REFUSÉE ») : un
// enseignement réel (« Tu chantes => Est-ce que tu chantes ? ») a montré que la pure INSERTION ne
// suffit pas dès qu'un jeton d'entrée est SUPPRIMÉ ou REMPLACÉ en sortie. Chaque jeton d'entrée porte
// désormais aussi un booléen GARDER (recopié tel quel) ou non (supprimé) -- calculé par un
// ALIGNEMENT PAR PLUS LONGUE SOUS-SÉQUENCE COMMUNE (LCS), algorithme purement structurel (aucune
// notion de grammaire, comme le reste de ce fichier). Un REMPLACEMENT s'obtient sans troisième
// mécanisme : suppression d'un jeton + insertion d'un jeton littéral au même endroit. Rétrocompatible
// : une transformation persistée SANS champ « garder » (apprise avant ce jour) est interprétée comme
// « tout gardé », comportement insertion-only inchangé. Limite assumée et distincte : le RÉORDONNANCEMENT
// véritable (déplacer un jeton à une position non adjacente en préservant les autres) reste hors de
// portée -- un alignement LCS respecte toujours l'ordre relatif des jetons gardés ; l'introduire un
// jour demanderait un mécanisme réellement différent (une notion de permutation), pas une extension
// de celui-ci.

// ------------------------------------------------------------------------------------ SURFACE (jamais decouper() !)
// decouper() (comprendre.js) normalise en minuscule et retire les accents : parfait pour RETROUVER
// un mot dans le lexique, inutilisable ici puisqu'il faut RECONSTRUIRE le texte exact (casse,
// accents, ponctuation). Nouvelle primitive minimale, volontairement séparée : un simple découpage
// de SURFACE (mots avec accents/apostrophes internes conservés, ponctuation isolée en jetons à part).
const RE_JETON = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:'[A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*|[.,!?;:…«»]/g;

export function tokeniser(texte) {
  return String(texte || '').match(RE_JETON) || [];
}

const SANS_ESPACE_AVANT = new Set(['.', ',', '!', '?', ';', ':', '…', '»']);
const SANS_ESPACE_APRES = new Set(['«']);

// Réassemble une liste de jetons de surface en texte lisible (espace entre les mots, jamais avant
// une ponctuation finale). Ne prétend pas restituer une typographie parfaite : suffisant pour
// appliquer une transformation apprise à une phrase nouvelle.
export function reassembler(jetons) {
  let texte = '';
  for (let i = 0; i < jetons.length; i += 1) {
    const j = jetons[i];
    const precedent = jetons[i - 1];
    if (i > 0 && !SANS_ESPACE_AVANT.has(j) && !SANS_ESPACE_APRES.has(precedent)) texte += ' ';
    texte += j;
  }
  return texte;
}

// ------------------------------------------------------------------------------------ ALIGNEMENT D'UN EXEMPLE
// Alignement par PLUS LONGUE SOUS-SÉQUENCE COMMUNE (LCS) entre les jetons d'entrée et de sortie --
// algorithme structurel générique (programmation dynamique classique), AUCUNE notion de grammaire :
// correspondance EXACTE de jetons (casse/accents compris), dans l'ordre. Renvoie TOUJOURS un
// résultat (jamais null) : { insertions, garder }.
//   - garder : un booléen par jeton d'entrée -- true si ce jeton réapparaît tel quel dans la sortie
//     (recopié), false s'il est absent (supprimé). Un REMPLACEMENT n'est rien d'autre qu'un jeton
//     supprimé (garder=false) accompagné d'un jeton littéral inséré au même endroit.
//   - insertions : comme avant, n+1 segments de jetons de sortie qui ne correspondent à AUCUN jeton
//     d'entrée gardé, à chaque position d'insertion possible.
// Le RÉORDONNANCEMENT véritable (jetons gardés dans un ordre relatif différent) reste hors de portée
// : la LCS respecte toujours l'ordre relatif des jetons appariés, par construction.
export function alignerExemple(jetonsEntree, jetonsSortie) {
  const n = jetonsEntree.length;
  const m = jetonsSortie.length;
  // dp[i][j] = longueur de la LCS entre jetonsEntree[i:] et jetonsSortie[j:].
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = jetonsEntree[i] === jetonsSortie[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const garder = [];
  const insertions = [];
  let segment = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (jetonsEntree[i] === jetonsSortie[j]) {
      insertions.push(segment);
      segment = [];
      garder.push(true);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      // Le jeton d'entrée ne fait partie d'AUCUNE plus longue sous-séquence commune optimale ici :
      // il est supprimé. En cas d'égalité stricte, choix déterministe (mais arbitraire, purement
      // structurel) de préférer la suppression à l'insertion -- jamais une préférence linguistique.
      insertions.push(segment);
      segment = [];
      garder.push(false);
      i += 1;
    } else {
      segment.push(jetonsSortie[j]);
      j += 1;
    }
  }
  while (i < n) {
    insertions.push(segment);
    segment = [];
    garder.push(false);
    i += 1;
  }
  while (j < m) {
    segment.push(jetonsSortie[j]);
    j += 1;
  }
  insertions.push(segment);
  return { insertions, garder };
}

// ------------------------------------------------------------------------------------ INDUCTION (plusieurs exemples)
// Règle de généralisation, volontairement stricte et sans heuristique :
//  - au moins DEUX exemples (un seul exemple ne prouve jamais une régularité -- ce serait une
//    généralisation abusive à partir d'un unique cas) ;
//  - tous les exemples doivent avoir la MÊME arité (même nombre de jetons en entrée) -- ce mécanisme
//    ne généralise, pour l'instant, que sur une arité fixe ; des arités différentes ne permettent pas
//    de faire correspondre les positions d'insertion entre exemples sans inventer une règle ;
//  - à CHAQUE position, tous les exemples doivent s'accorder sur EXACTEMENT les mêmes jetons insérés
//    -- sinon conflit (abstention, jamais un choix arbitraire) ;
//  - une transformation totalement vide (aucune insertion nulle part, entrée === sortie partout)
//    n'est pas une transformation : rien à apprendre.
// Renvoie { ok:false, raison, detail } ou { ok:true, transformation:{n,insertions,garder}, exemples }.
export function induireTransformation(exemples) {
  const liste = (exemples || []).filter((e) => e && e.entree != null && e.sortie != null && String(e.entree).trim() && String(e.sortie).trim());
  if (liste.length < 2) {
    return { ok: false, raison: 'insuffisant', detail: `il faut au moins deux exemples cohérents pour généraliser, pas un seul (${liste.length} fourni${liste.length > 1 ? 's' : ''}).` };
  }
  const analyses = [];
  for (const ex of liste) {
    const jE = tokeniser(ex.entree);
    const jS = tokeniser(ex.sortie);
    if (!jE.length) return { ok: false, raison: 'entree_vide', detail: `l'exemple « ${ex.entree} » est vide une fois découpé en mots.` };
    const alignement = alignerExemple(jE, jS);
    analyses.push({ n: jE.length, insertions: alignement.insertions, garder: alignement.garder });
  }
  const n0 = analyses[0].n;
  if (analyses.some((a) => a.n !== n0)) {
    return {
      ok: false,
      raison: 'longueurs_incompatibles',
      detail: `les exemples n'ont pas tous la même arité en entrée (${analyses.map((a) => a.n).join(', ')}) : ce mécanisme ne généralise pour l'instant qu'à arité fixe.`,
    };
  }
  const insertionsFusionnees = [];
  for (let k = 0; k <= n0; k += 1) {
    const distinctes = new Set(analyses.map((a) => JSON.stringify(a.insertions[k])));
    if (distinctes.size > 1) {
      return {
        ok: false,
        raison: 'conflit',
        detail: `les exemples ne s'accordent pas sur ce qui s'insère à la même position (position ${k}) : ${[...distinctes].join(' vs ')}.`,
      };
    }
    insertionsFusionnees.push(analyses[0].insertions[k]);
  }
  const garderFusionne = [];
  for (let i = 0; i < n0; i += 1) {
    const distinctes = new Set(analyses.map((a) => a.garder[i]));
    if (distinctes.size > 1) {
      return {
        ok: false,
        raison: 'conflit',
        detail: `les exemples ne s'accordent pas sur le sort du jeton n°${i + 1} de l'entrée (gardé dans un cas, supprimé ou remplacé dans l'autre).`,
      };
    }
    garderFusionne.push(analyses[0].garder[i]);
  }
  if (insertionsFusionnees.every((seg) => seg.length === 0) && garderFusionne.every(Boolean)) {
    return { ok: false, raison: 'aucune_transformation', detail: 'entrée et sortie sont identiques dans tous les exemples : il n\'y a rien à transformer.' };
  }
  return {
    ok: true,
    transformation: { n: n0, insertions: insertionsFusionnees, garder: garderFusionne },
    exemples: liste.map((e) => ({ entree: String(e.entree).trim(), sortie: String(e.sortie).trim() })),
  };
}

// ------------------------------------------------------------------------------------ APPLICATION
// Renvoie null si l'entrée n'a pas la même arité que la transformation (abstention honnête : jamais
// une application partielle ou devinée). RÉTROCOMPATIBLE : une transformation persistée sans champ
// « garder » (apprise avant l'extension SUPPRESSION/REMPLACEMENT du 27/09/2026) est traitée comme
// « tout gardé » -- comportement insertion-only strictement inchangé.
export function appliquerTransformation(transformation, entreeTexte) {
  const jE = tokeniser(entreeTexte);
  if (jE.length !== transformation.n) return null;
  const garder = transformation.garder || jE.map(() => true);
  const sortie = [];
  for (let i = 0; i < jE.length; i += 1) {
    sortie.push(...transformation.insertions[i]);
    if (garder[i]) sortie.push(jE[i]);
  }
  sortie.push(...transformation.insertions[transformation.n]);
  return reassembler(sortie);
}

// ------------------------------------------------------------------------------------ COMPOSITION (« mobiliser plusieurs connaissances »)
// LE MÊME mécanisme que l'induction (fusion position par position), appliqué cette fois à des
// TRANSFORMATIONS déjà apprises plutôt qu'à des exemples bruts : aucun second algorithme. Une seule
// transformation se fusionne trivialement avec elle-même (identité) ; plusieurs transformations dont
// les insertions touchent des positions différentes se combinent automatiquement ; deux
// transformations qui insèrent des jetons DIFFÉRENTS à la MÊME position sont contradictoires pour ce
// cas précis -- fusion refusée, jamais un choix arbitraire entre les deux.
export function fusionnerTransformations(transformations) {
  if (!transformations || !transformations.length) return { ok: false, raison: 'aucune' };
  const n = transformations[0].n;
  if (transformations.some((t) => t.n !== n)) return { ok: false, raison: 'arites_incompatibles' };
  const insertions = [];
  for (let k = 0; k <= n; k += 1) {
    const segments = transformations.map((t) => t.insertions[k]).filter((seg) => seg.length > 0);
    if (!segments.length) { insertions.push([]); continue; }
    const distincts = new Set(segments.map((s) => JSON.stringify(s)));
    if (distincts.size > 1) return { ok: false, raison: 'conflit', position: k };
    insertions.push(segments[0]);
  }
  // Même discipline de fusion/abstention que pour les insertions, étendue au champ « garder »
  // (extension du 27/09/2026) -- rétrocompatible : une transformation sans ce champ vaut « tout
  // gardé » (son ancien comportement insertion-only, avant l'extension SUPPRESSION/REMPLACEMENT).
  const garder = [];
  for (let i = 0; i < n; i += 1) {
    const valeurs = transformations.map((t) => (t.garder ? t.garder[i] : true));
    const distincts = new Set(valeurs);
    if (distincts.size > 1) return { ok: false, raison: 'conflit', position: i };
    garder.push(valeurs[0]);
  }
  return { ok: true, transformation: { n, insertions, garder } };
}
// === FIN_LANGAGE_TRANSFORMATION ===
