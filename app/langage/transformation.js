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
// (arité n = nombre de jetons de l'entrée), le reste de l'entrée étant recopié tel quel, dans
// l'ordre, comme une variable. Exemple (n=2, jetons ["Je","mange"]) :
//   insertions = [ [], ["ne"], ["pas"] ]   (avant jeton 0 ; entre jeton 0 et 1 ; après jeton 1)
//   « Je cours » (n=2) → "" + "Je" + "ne" + "cours" + "pas" → « Je ne cours pas »
// COMPOSER deux transformations apprises séparément revient, dans ce modèle, à FUSIONNER leurs
// insertions position par position (fusionnerTransformations ci-dessous) : si deux transformations
// touchent des positions DIFFÉRENTES, la fusion est automatique et sans ambiguïté ; si elles se
// contredisent à la même position, la fusion s'abstient -- jamais un choix arbitraire.

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
// Cherche les jetons de l'entrée comme SOUS-SÉQUENCE (dans l'ordre, jamais réordonnée) des jetons de
// la sortie -- correspondance EXACTE (casse/accents compris : « Je » de l'entrée doit réapparaître
// « Je » dans la sortie), recherche gloutonne la plus à gauche (déterministe). Renvoie null si
// l'entrée n'est pas une sous-séquence de la sortie (une suppression ou un réordonnancement échappe
// à ce mécanisme -- il ne sait induire que des INSERTIONS, honnêtement).
// Sinon : { insertions } -- un tableau de n+1 segments de jetons (n = jetons de l'entrée), les jetons
// de la sortie qui ne font PAS partie de l'entrée, à chaque position d'insertion possible.
export function alignerExemple(jetonsEntree, jetonsSortie) {
  const n = jetonsEntree.length;
  const positions = [];
  let curseur = 0;
  for (let i = 0; i < n; i += 1) {
    const idx = jetonsSortie.indexOf(jetonsEntree[i], curseur);
    if (idx === -1) return null;
    positions.push(idx);
    curseur = idx + 1;
  }
  const insertions = [];
  let debut = 0;
  for (let i = 0; i < n; i += 1) {
    insertions.push(jetonsSortie.slice(debut, positions[i]));
    debut = positions[i] + 1;
  }
  insertions.push(jetonsSortie.slice(debut));
  return { insertions };
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
// Renvoie { ok:false, raison, detail } ou { ok:true, transformation:{n,insertions}, exemples }.
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
    if (!alignement) {
      return {
        ok: false,
        raison: 'non_alignable',
        detail: `« ${ex.sortie} » ne contient pas « ${ex.entree} » comme sous-séquence : ce mécanisme ne sait induire que des transformations par INSERTION (rien de supprimé ni de réordonné).`,
      };
    }
    analyses.push({ n: jE.length, insertions: alignement.insertions });
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
  if (insertionsFusionnees.every((seg) => seg.length === 0)) {
    return { ok: false, raison: 'aucune_transformation', detail: 'entrée et sortie sont identiques dans tous les exemples : il n\'y a rien à transformer.' };
  }
  return {
    ok: true,
    transformation: { n: n0, insertions: insertionsFusionnees },
    exemples: liste.map((e) => ({ entree: String(e.entree).trim(), sortie: String(e.sortie).trim() })),
  };
}

// ------------------------------------------------------------------------------------ APPLICATION
// Renvoie null si l'entrée n'a pas la même arité que la transformation (abstention honnête : jamais
// une application partielle ou devinée).
export function appliquerTransformation(transformation, entreeTexte) {
  const jE = tokeniser(entreeTexte);
  if (jE.length !== transformation.n) return null;
  const sortie = [];
  for (let i = 0; i < jE.length; i += 1) {
    sortie.push(...transformation.insertions[i]);
    sortie.push(jE[i]);
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
  return { ok: true, transformation: { n, insertions } };
}
// === FIN_LANGAGE_TRANSFORMATION ===
