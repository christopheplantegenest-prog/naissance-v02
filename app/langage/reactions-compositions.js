// === DEBUT_LANGAGE_REACTIONS_COMPOSITIONS ===
// v0.62.5 — ÉTAPE 6 : « RÉACTIONS EXPLICITEMENT LIÉES À UNE COMPOSITION RÉUSSIE » (décision ChatGPT,
// 03/10/2026, suite au diagnostic « UNE OBSERVATION DE COMPOSITION PEUT-ELLE RECEVOIR UNE CONSÉQUENCE
// VÉCUE ? »). VUE PURE ET DORMANTE. Elle répond à UNE seule question :
//
//   « pour cette observation de composition réussie, quels objets existants se réfèrent explicitement
//     à la MÊME trace ? »
//
// IDENTITÉ `idTrace` UNIQUEMENT : une observation, un énoncé, un acte et une expérience (via
// referenceTrace.idTrace) sont rattachés à la même invocation si, et seulement si, ils portent EXACTEMENT
// la même chaîne. JAMAIS de jointure par horodatage, texte, opération, proximité, provenance ni
// idTraceSource. Aucune normalisation (pas de trim, pas de casse).
//
// INDÉPENDANCE TOTALE : ce fichier n'importe RIEN. Il ne lit ni n'écrit aucun magasin, n'ouvre aucune base,
// ne connaît ni .find, ni valeurLiee, ni le rejeu, ni provenanceLiaisons. L'appelant lui fournit des
// tableaux déjà lus ; aucun appel de production n'existe aujourd'hui (garde-fou statique dans les tests).
//
// ENTRÉES : (observations, traces, enonces, actes, experiences) -- cinq tableaux, déjà lus.
//
// EXPLOITABILITÉ d'une observation : elle possède un `id` chaîne non vide, un `idTrace` chaîne non vide,
// ET une trace portant exactement cet id existe dans `traces`. Sinon elle ne produit AUCUN élément :
//   - abstention (idTrace null) -> absente ; le cas n'est pas une absence de réaction, c'est hors périmètre ;
//   - idTrace orphelin (aucune trace de cet id en entrée) -> absente : on ne fait pas confiance à une chaîne
//     dont l'invocation n'est pas réellement disponible.
// La trace n'est PAS recopiée : `idTrace` suffit à l'identité, et recopier un objet volumineux ne
// dirait rien de plus. La trace ne sert ici qu'à prouver que l'invocation existe.
//
// SORTIE : tableau d'éléments { idObservation, idTrace, enonces, actes, experiences }.
//   - enonces / actes / experiences : TROIS collections séparées, jamais mélangées dans une chronologie
//     commune, jamais appariées entre elles (un énoncé et une expérience du même message restent deux objets
//     indépendants se référant à la même trace, même si leur texte est identique).
//   - Une composition réussie SANS réaction produit quand même un élément avec trois tableaux vides :
//     « observation réussie connue, aucune réaction explicitement liée ».
//   - TOUTES les réactions sont conservées : deux énoncés de même texte = deux objets ; aucun
//     dédoublonnage, aucune fusion, aucun comptage.
//   - Deux observations de même idTrace (données artificielles) ne sont JAMAIS fusionnées : un élément
//     chacune, portant chacun les mêmes réactions (copiées). Deux observations de même `id` : également
//     conservées toutes les deux, sans choisir ni écraser.
//
// POLITIQUE SUR LES DONNÉES MALFORMÉES (cette fonction N'EST PAS un validateur de base) :
//   - REJETÉ (TypeError, erreur de programmation de l'appelant, jamais absorbée) : un des cinq arguments
//     n'est pas un tableau ;
//   - IGNORÉ (l'élément n'entre pas, sans bruit) : élément qui n'est pas un objet simple non null ;
//     observation sans `id` chaîne non vide ou sans `idTrace` chaîne non vide ; trace sans `id` chaîne ;
//     énoncé/acte dont `idTrace` n'est pas une chaîne identique ; expérience sans `referenceTrace` objet
//     (absent, null, non objet) ou dont referenceTrace.idTrace n'est pas une chaîne identique ;
//   - CONSERVÉ tel quel (copié) : tout le contenu d'un objet réaction retenu, y compris l'`interpretations`
//     d'une expérience. Aucun champ n'est ajouté, extrait, promu ni filtré. La vue ne produit AUCUN champ
//     qui qualifierait une réaction et n'applique AUCUN filtre selon le contenu d'une réaction.
//
// COPIE : chaque réaction renvoyée est une COPIE PROFONDE (JSON, la convention de connaissances.js pour
// tout objet persisté : les objets stockés sont du JSON par construction). Muter la sortie ne modifie
// jamais les entrées, et inversement. Les éléments de sortie sont de nouveaux objets.
//
// ORDRE : DÉTERMINISTE, issu des IDENTITÉS et jamais de l'ordre des entrées -- les éléments par `id`
// d'observation, chaque collection de réactions par `id` de réaction (ordre des unités de code, comme les
// couvertures ailleurs), départagé par la sérialisation JSON pour les ids identiques ou absents. Cet ordre
// ne signifie RIEN (ni chronologie, ni importance, ni causalité) : seulement la plus petite sortie
// honnête et reproductible. Permuter les entrées ne change jamais la sortie.

function estObjetSimple(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}
function estChaineNonVide(x) {
  return typeof x === 'string' && x.length > 0;
}
function copie(objet) {
  return JSON.parse(JSON.stringify(objet));
}
function comparerCodeUnits(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
// Tri déterministe : par id (ou '' si absent), puis par sérialisation. Opère sur des COPIES.
function trierParIdentite(objets) {
  return objets
    .map((o) => ({ o, id: typeof o.id === 'string' ? o.id : '', json: JSON.stringify(o) }))
    .sort((x, y) => comparerCodeUnits(x.id, y.id) || comparerCodeUnits(x.json, y.json))
    .map((x) => x.o);
}
function exigerTableau(valeur, nom) {
  if (!Array.isArray(valeur)) throw new TypeError(`vueReactionsSurCompositions : « ${nom} » doit être un tableau.`);
}

export function vueReactionsSurCompositions(observations, traces, enonces, actes, experiences) {
  exigerTableau(observations, 'observations');
  exigerTableau(traces, 'traces');
  exigerTableau(enonces, 'enonces');
  exigerTableau(actes, 'actes');
  exigerTableau(experiences, 'experiences');

  const idsTraces = new Set();
  for (const t of traces) if (estObjetSimple(t) && estChaineNonVide(t.id)) idsTraces.add(t.id);

  // Index par idTrace (une seule passe par collection ; aucune jointure autre que l'identité exacte).
  const parTrace = (collection, cle) => {
    const index = new Map();
    for (const o of collection) {
      if (!estObjetSimple(o)) continue;
      const idTrace = cle(o);
      if (!estChaineNonVide(idTrace)) continue;
      if (!index.has(idTrace)) index.set(idTrace, []);
      index.get(idTrace).push(o);
    }
    return index;
  };
  const enoncesParTrace = parTrace(enonces, (o) => o.idTrace);
  const actesParTrace = parTrace(actes, (o) => o.idTrace);
  const experiencesParTrace = parTrace(experiences, (o) => (estObjetSimple(o.referenceTrace) ? o.referenceTrace.idTrace : null));

  const lire = (index, idTrace) => trierParIdentite((index.get(idTrace) || []).map(copie));

  const elements = [];
  for (const obs of observations) {
    if (!estObjetSimple(obs)) continue;
    if (!estChaineNonVide(obs.id) || !estChaineNonVide(obs.idTrace)) continue;
    if (!idsTraces.has(obs.idTrace)) continue;
    elements.push({
      idObservation: obs.id,
      idTrace: obs.idTrace,
      enonces: lire(enoncesParTrace, obs.idTrace),
      actes: lire(actesParTrace, obs.idTrace),
      experiences: lire(experiencesParTrace, obs.idTrace),
    });
  }
  return elements.sort((a, b) => comparerCodeUnits(a.idObservation, b.idObservation)
    || comparerCodeUnits(a.idTrace, b.idTrace)
    || comparerCodeUnits(JSON.stringify(a), JSON.stringify(b)));
}
// === FIN_LANGAGE_REACTIONS_COMPOSITIONS ===
