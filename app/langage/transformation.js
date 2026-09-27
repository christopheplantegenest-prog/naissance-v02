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
//
// ÉLARGI le 27/09/2026, LOT 1 (décision ChatGPT « GRAND DIAGNOSTIC APPRENTISSAGE LINGUISTIQUE ») :
// ANTI-SUR-GÉNÉRALISATION. Le grand diagnostic a révélé un piège : quand un jeton supprimé se
// retrouve, IDENTIQUE, réinséré ailleurs dans TOUS les exemples fournis (ex. « tu chantes => chantes
// tu ? » / « tu arrives => arrives tu ? »), rien ne permet de distinguer un vrai littéral invariant
// (comme « ne »/« pas », qui ne coïncide jamais avec un jeton supprimé) d'une VARIABLE qui n'a
// simplement pas encore varié dans l'échantillon. La transformation est alors marquée
// `certaine:false` -- toujours APPRISE (ne pas empêcher l'apprentissage), mais JAMAIS appliquée
// (appliquerTransformation renvoie null) tant qu'aucun exemple ne lève le doute. Vérification
// purement structurelle (comparaison de jetons), aucune notion de grammaire.
//
// ÉLARGI le 27/09/2026, LOT 2 : TRANSFORMATION INTERNE À UNE VARIABLE. Certaines familles (singulier/
// pluriel, masculin/féminin...) ne remplacent pas un jeton par un littéral FIXE, mais appliquent une
// opération sur son PROPRE CONTENU (« chat »→« chats », « petit »→« petite »). Chaque position gardée
// porte désormais, en plus du booléen `garder`, un champ `interne` optionnel { prefixe, suffixe } --
// littéraux de caractères ajoutés avant/après le mot gardé. Volontairement restreint à un préfixe et/
// ou un suffixe (jamais une transformation interne arbitraire) : au niveau du MOT, la même arité doit
// se retrouver dans tous les exemples (limite déjà assumée plus haut) ; au niveau du CARACTÈRE en
// revanche, la longueur d'un mot varie naturellement d'un exemple à l'autre pour la MÊME opération
// (« chat »=4 caractères, « chien »=5) -- une LCS complète et récursive au niveau du caractère se
// heurterait donc à la même contrainte d'arité fixe. Le préfixe/suffixe est le plus petit mécanisme
// trouvé qui débloque ces familles sans coder aucune règle française : une variation qui n'est ni un
// préfixe ni un suffixe littéral cohérent entre TOUS les exemples (ex. « beau »→« belle », une
// irrégularité) reste une abstention honnête, jamais une règle inventée.
//
// LOT 3 (coordination entre positions) : le Lot 2 appliqué indépendamment à CHAQUE position suffit --
// AUCUN mécanisme séparé de « coordination » n'a été nécessaire -- mais une LIMITE de l'alignement LCS
// devait d'abord être levée : quand AUCUN jeton ne correspond exactement entre l'entrée et la sortie
// (ex. « le chat est petit » → « Les chats sont petits » : « le »≠« Les », « chat »≠« chats », « est »≠
// « sont », « petit »≠« petits »), la LCS ne trouve aucune ancre et effondre toute la sortie en un SEUL
// bloc d'insertion final, empêchant le Lot 2 de rattraper position par position. L'induction essaie
// donc D'ABORD l'alignement LCS habituel (général, ordre non supposé) ; s'il échoue par CONFLIT et que
// tous les exemples ont la MÊME arité en sortie qu'en entrée, elle retente avec un alignement
// POSITIONNEL DIRECT (position i d'entrée <-> position i de sortie, sans recherche -- alignerParPosition
// ci-dessous), qui alimente exactement le MÊME mécanisme de fusion/rattrapage Lot 1/Lot 2. Confirmé par
// les tests : la Cause 2 était bien une composition de plusieurs Cause 1, une fois cette ancre minimale
// disponible -- pas un mécanisme de coordination séparé.

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
// Tente d'expliquer une paire (motSupprime, motInsere) par un simple PRÉFIXE et/ou SUFFIXE littéral
// de caractères ajouté au mot entier (jamais une transformation interne arbitraire). Renvoie
// { prefixe, suffixe } si motInsere = prefixe + motSupprime + suffixe (l'un des deux peut être vide),
// ou null si aucune relation préfixe/suffixe simple n'existe (ex. une irrégularité comme « beau »/
// « belle »).
function relationPrefixeSuffixe(motSupprime, motInsere) {
  if (motInsere.startsWith(motSupprime)) return { prefixe: '', suffixe: motInsere.slice(motSupprime.length) };
  if (motInsere.endsWith(motSupprime)) return { prefixe: motInsere.slice(0, motInsere.length - motSupprime.length), suffixe: '' };
  return null;
}

// LOT 3 -- alignement alternatif utilisé UNIQUEMENT en repli, quand la LCS échoue par conflit et que
// l'entrée et la sortie ont la MÊME arité dans TOUS les exemples : correspondance DIRECTE, position par
// position (aucune recherche de plus longue sous-séquence commune), toujours possible dans ce cas
// précis puisque les deux séquences ont la même longueur. Sert uniquement à poser des ANCRES là où la
// LCS n'en trouve aucune (aucun jeton identique entre entrée et sortie) ; alimente ensuite exactement le
// même mécanisme de fusion/rattrapage (Lot 1/Lot 2) que l'alignement LCS.
function alignerParPosition(jetonsEntree, jetonsSortie) {
  const n = jetonsEntree.length;
  const garder = [];
  const insertions = Array.from({ length: n + 1 }, () => []);
  for (let i = 0; i < n; i += 1) {
    if (jetonsEntree[i] === jetonsSortie[i]) {
      garder.push(true);
    } else {
      garder.push(false);
      insertions[i + 1] = [jetonsSortie[i]];
    }
  }
  return { insertions, garder };
}

// Fusionne des analyses PAR EXEMPLE déjà alignées (LCS ou positionnelles, même forme) en une seule
// transformation généralisée -- même discipline stricte d'abstention pour les deux stratégies
// d'alignement. Renvoie { ok:false, raison, detail } ou
// { ok:true, transformation:{n,insertions,garder,interne,certaine}, exemples }.
function fusionnerAnalyses(analyses, liste, n0) {
  // LOT 2 -- pour chaque position uniformément SUPPRIMÉE dont le littéral de remplacement diffère
  // d'un exemple à l'autre (ce qui aurait provoqué un 'conflit' avant ce lot), tente un rattrapage par
  // préfixe/suffixe interne AVANT le contrôle d'égalité stricte des insertions. `interne[i]` reste
  // null hors de ce cas ; `boundariesAbsorbees` retient, par position i, la limite d'insertion (i+1)
  // désormais neutralisée (son contenu est représenté par `interne`, plus par une insertion littérale).
  const garderFusionne = [];
  const interneFusionne = [];
  const boundariesAbsorbees = new Set();
  for (let i = 0; i < n0; i += 1) {
    const distinctes = new Set(analyses.map((a) => a.garder[i]));
    if (distinctes.size > 1) {
      return {
        ok: false,
        raison: 'conflit',
        detail: `les exemples ne s'accordent pas sur le sort du jeton n°${i + 1} de l'entrée (gardé dans un cas, supprimé ou remplacé dans l'autre).`,
      };
    }
    const gardeIci = analyses[0].garder[i];
    garderFusionne.push(gardeIci);
    if (gardeIci) { interneFusionne.push(null); continue; }
    const candidats = analyses.map((a) => a.insertions[i + 1]);
    const candidatsUnJeton = candidats.every((seg) => seg.length === 1);
    const litteralIdentique = candidatsUnJeton && new Set(candidats.map((seg) => seg[0])).size === 1;
    if (!candidatsUnJeton || litteralIdentique) { interneFusionne.push(null); continue; } // remplacement littéral classique (ou pas de rattrapage possible), géré plus bas
    const relations = analyses.map((a, idx) => relationPrefixeSuffixe(a.jE[i], candidats[idx][0]));
    if (relations.every((r) => r && r.suffixe === relations[0].suffixe && r.prefixe === relations[0].prefixe)) {
      interneFusionne.push(relations[0]);
      garderFusionne[i] = true; // le jeton est en réalité GARDÉ (transformé), pas supprimé
      boundariesAbsorbees.add(i + 1);
    } else {
      return {
        ok: false,
        raison: 'conflit',
        detail: `les exemples ne s'accordent pas sur ce qui remplace le jeton n°${i + 1} de l'entrée, et aucun préfixe/suffixe cohérent ne l'explique (irrégularité) : ${candidats.map((c) => c[0]).join(' vs ')}.`,
      };
    }
  }
  const insertionsFusionnees = [];
  for (let k = 0; k <= n0; k += 1) {
    if (boundariesAbsorbees.has(k)) { insertionsFusionnees.push([]); continue; }
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
  if (insertionsFusionnees.every((seg) => seg.length === 0) && garderFusionne.every(Boolean) && interneFusionne.every((v) => v == null)) {
    return { ok: false, raison: 'aucune_transformation', detail: 'entrée et sortie sont identiques dans tous les exemples : il n\'y a rien à transformer.' };
  }
  // LOT 1 -- ANTI-SUR-GÉNÉRALISATION : un littéral inséré qui coïncide avec un jeton SUPPRIMÉ (vraie
  // suppression, pas une position rattrapée par le Lot 2) dans N'IMPORTE QUEL exemple ne peut pas être
  // distingué avec certitude d'une variable qui n'a simplement pas encore varié dans l'échantillon.
  const jetonsVraimentSupprimes = new Set();
  analyses.forEach((a) => {
    a.garder.forEach((g, i) => { if (!g && interneFusionne[i] == null) jetonsVraimentSupprimes.add(a.jE[i]); });
  });
  const certaine = !insertionsFusionnees.some((segment) => segment.some((jeton) => jetonsVraimentSupprimes.has(jeton)));
  return {
    ok: true,
    transformation: {
      n: n0, insertions: insertionsFusionnees, garder: garderFusionne, interne: interneFusionne, certaine,
    },
    exemples: liste.map((e) => ({ entree: String(e.entree).trim(), sortie: String(e.sortie).trim() })),
  };
}

// Renvoie { ok:false, raison, detail } ou
// { ok:true, transformation:{n,insertions,garder,interne,certaine}, exemples }.
export function induireTransformation(exemples) {
  const liste = (exemples || []).filter((e) => e && e.entree != null && e.sortie != null && String(e.entree).trim() && String(e.sortie).trim());
  if (liste.length < 2) {
    return { ok: false, raison: 'insuffisant', detail: `il faut au moins deux exemples cohérents pour généraliser, pas un seul (${liste.length} fourni${liste.length > 1 ? 's' : ''}).` };
  }
  const parJeton = [];
  for (const ex of liste) {
    const jE = tokeniser(ex.entree);
    const jS = tokeniser(ex.sortie);
    if (!jE.length) return { ok: false, raison: 'entree_vide', detail: `l'exemple « ${ex.entree} » est vide une fois découpé en mots.` };
    parJeton.push({ jE, jS });
  }
  const n0 = parJeton[0].jE.length;
  if (parJeton.some((a) => a.jE.length !== n0)) {
    return {
      ok: false,
      raison: 'longueurs_incompatibles',
      detail: `les exemples n'ont pas tous la même arité en entrée (${parJeton.map((a) => a.jE.length).join(', ')}) : ce mécanisme ne généralise pour l'instant qu'à arité fixe.`,
    };
  }
  // Tentative 1 : alignement LCS habituel, général (aucune hypothèse sur l'arité de la sortie).
  const analysesLCS = parJeton.map(({ jE, jS }) => {
    const alignement = alignerExemple(jE, jS);
    return { n: jE.length, jE, insertions: alignement.insertions, garder: alignement.garder };
  });
  const resultatLCS = fusionnerAnalyses(analysesLCS, liste, n0);
  if (resultatLCS.ok || resultatLCS.raison !== 'conflit') return resultatLCS;
  // Tentative 2 (LOT 3) : uniquement si la LCS échoue par CONFLIT et que la sortie a la MÊME arité que
  // l'entrée dans TOUS les exemples -- repli par alignement positionnel direct (voir commentaire de
  // alignerParPosition), qui peut réussir là où la LCS n'a posé aucune ancre.
  const memeArite = parJeton.every(({ jS }) => jS.length === n0);
  if (!memeArite) return resultatLCS;
  const analysesPositionnelles = parJeton.map(({ jE, jS }) => {
    const alignement = alignerParPosition(jE, jS);
    return { n: jE.length, jE, insertions: alignement.insertions, garder: alignement.garder };
  });
  const resultatPositionnel = fusionnerAnalyses(analysesPositionnelles, liste, n0);
  return resultatPositionnel.ok ? resultatPositionnel : resultatLCS;
}

// ------------------------------------------------------------------------------------ RECONNAISSANCE DE SQUELETTE
// v0.30 (décision ChatGPT « RACCORDEMENT COMPRÉHENSION → INTENTION → TRANSFORMATION ») : une phrase
// NOUVELLE, jamais vue, correspond-elle LITTÉRALEMENT au squelette fixe d'une transformation déjà
// enseignée ? Ne réutilise QUE ce qui existe déjà : tokeniser(), les `exemples` déjà persistés
// verbatim sur chaque transformation, et son arité `n` -- aucune nouvelle notion, aucune catégorie
// grammaticale, aucune tolérance (ni casse, ni synonyme, ni accent) : une correspondance EXACTE,
// mot pour mot, comme partout ailleurs dans ce fichier.
// PRINCIPE : une position i est une ANCRE si TOUS les exemples d'entraînement de cette transformation
// ont, une fois tokenisés, EXACTEMENT le même jeton à cette position -- qu'elle soit gardée (garder=
// true) ou supprimée (garder=false) n'a aucune importance ici : ce qui compte, structurellement, est
// l'INVARIANCE across-exemples, pas le sort donné à cette position par la transformation elle-même.
// Une transformation SANS AUCUNE ancre (ex. « petit=>petite / grand=>grande » : la seule position
// varie déjà entre les deux exemples) n'a rien d'un « squelette de phrase » : elle ne fournit AUCUN
// signal distinctif et ne doit jamais servir à la reconnaissance (elle « correspondrait » à n'importe
// quelle entrée de son arité) -- seule une transformation avec AU MOINS une ancre est un squelette
// éligible. Une entrée nouvelle correspond au squelette si elle a la même arité ET si elle porte
// EXACTEMENT le même jeton que l'ancre à chaque position ancrée (les autres positions sont libres :
// c'est précisément là que vit la partie variable, extraite ensuite par appliquerTransformation() --
// AUCUN second mécanisme d'extraction, la sortie déjà induite EST l'extraction).
export function correspondSquelette(transformation, entreeTexte) {
  const jetons = tokeniser(entreeTexte);
  if (jetons.length !== transformation.n) return false;
  const exemplesTokenises = (transformation.exemples || [])
    .map((e) => tokeniser(e.entree))
    .filter((jE) => jE.length === transformation.n);
  if (!exemplesTokenises.length) return false;
  let auMoinsUneAncre = false;
  for (let i = 0; i < transformation.n; i += 1) {
    const premier = exemplesTokenises[0][i];
    const estAncre = exemplesTokenises.every((jE) => jE[i] === premier);
    if (estAncre) {
      auMoinsUneAncre = true;
      if (jetons[i] !== premier) return false;
    }
  }
  return auMoinsUneAncre;
}

// ------------------------------------------------------------------------------------ APPLICATION
// Renvoie null si l'entrée n'a pas la même arité que la transformation, OU si la transformation n'est
// pas `certaine` (abstention honnête : jamais une application partielle, devinée, ou d'une règle non
// démontrée avec certitude). RÉTROCOMPATIBLE : une transformation persistée sans champ « garder »
// (apprise avant l'extension SUPPRESSION/REMPLACEMENT du 27/09/2026) est traitée comme « tout gardé »,
// sans transformation interne, et certaine -- comportement insertion-only strictement inchangé.
export function appliquerTransformation(transformation, entreeTexte) {
  if (transformation.certaine === false) return null;
  const jE = tokeniser(entreeTexte);
  if (jE.length !== transformation.n) return null;
  const garder = transformation.garder || jE.map(() => true);
  const interne = transformation.interne || jE.map(() => null);
  const sortie = [];
  for (let i = 0; i < jE.length; i += 1) {
    sortie.push(...transformation.insertions[i]);
    if (garder[i]) {
      const t = interne[i];
      sortie.push(t ? `${t.prefixe}${jE[i]}${t.suffixe}` : jE[i]);
    }
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
  // LOT 2 -- même principe pour le champ « interne » : rétrocompatible (absent = aucune transformation
  // interne à aucune position, comme avant ce lot).
  const interne = [];
  for (let i = 0; i < n; i += 1) {
    const valeurs = transformations.map((t) => JSON.stringify((t.interne && t.interne[i]) || null));
    const distincts = new Set(valeurs);
    if (distincts.size > 1) return { ok: false, raison: 'conflit', position: i };
    interne.push((transformations.map((t) => (t.interne ? t.interne[i] : null)).find((v) => v != null)) || null);
  }
  // LOT 1 -- composer avec une transformation NON CERTAINE donne un résultat NON CERTAIN : jamais
  // gagner en confiance par simple composition avec autre chose. Rétrocompatible : une transformation
  // sans ce champ (apprise avant ce lot) vaut « certaine ».
  const certaine = transformations.every((t) => t.certaine !== false);
  return { ok: true, transformation: { n, insertions, garder, interne, certaine } };
}
// === FIN_LANGAGE_TRANSFORMATION ===
