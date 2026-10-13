// === DEBUT_LANGAGE_ATTENTES_CONDITIONNEES ===
// v0.64.1 — « ATTENTE CONDITIONNÉE PAR LA PARTIE CONNUE » (décision ChatGPT « DÉCISION v0.64.1 », 13/10/2026). CALCUL PUR, SYNCHRONE, DÉTERMINISTE.
// Il répond à UNE seule question, posée AVANT l'issue, pour un contexte prospectif déjà écrit :
//
//   « une relation de co-couverture EXACTE de l'histoire comparable relie-t-elle ce qui est DÉJÀ CONNU de l'épisode présent à un constat
//     porté par un chemin encore OUVERT ? »
//
// Briques réutilisées telles quelles (aucune n'est modifiée) :
//   coCouverturesParChemins (.95) — classes { couverture, constats:[{ chemin, type, valeur }] } d'UNE famille d'épisodes ;
//   partieConnueEpisode (.99)     — la partie connue de l'épisode présent (départ, étapes connues, valeurs comparables connues) ;
//   cheminsOuverts (.64.0)        — chemins du contexte qu'aucune occurrence de la partie connue ne porte ;
//   constatsParChemin / memesConstats — le MÊME producteur de constats et la MÊME égalité (type ET Object.is : 42 ≠ "42").
//
// RÈGLE DE RACCORD (pour une classe C, chaque membre m = { chemin, type, valeur }) :
//   m est CONNU     si la partie connue porte une occurrence à m.chemin (même règle que cheminsOuverts) ; son constat présent est celui du
//                   producteur sur la partie connue ;
//   m est CANDIDAT  si m.chemin est un chemin OUVERT du contexte (cheminsOuverts(contexte.chemins, partieConnue)) ;
//   sinon m n'est ni l'un ni l'autre (ni condition, ni contradiction : ce chemin n'est pas connu par cette vue).
//   C se RACCORDE ssi au moins un membre est connu ET chaque membre connu a EXACTEMENT son constat historique dans le présent (memesConstats).
//   UN seul membre connu différent rejette C entière (une classe partiellement raccordée n'ignore jamais un membre connu qui la contredit).
//   Chaque membre candidat d'une classe raccordée PROPOSE son constat historique, tel quel (aucune transformation, généralisation ni choix).
// UNICITÉ PAR CHEMIN : les propositions sont regroupées par chemin ouvert.
//   toutes égales (memesConstats) → UNE attente, dont la fondation liste TOUTES les classes proposantes (aucune n'est préférée, aucune n'annule
//     l'autre ; ordre des classes = celui de coCouverturesParChemins, sans signification) ;
//   au moins deux constats différents → AUCUNE attente sur ce chemin ; le cas est RAPPORTÉ dans `divergences` (silence conditionnel, aucun arbitrage :
//     ni fréquence, ni majorité, ni premier/dernier, ni horodatage, ni ordre lexical, ni score, ni hasard).
//
// TEMPORALITÉ : l'histoire est la vue des épisodes du vécu « avant » TRANSMISE par l'appelant, restreinte aux épisodes ADMISSIBLES : chaque
//   exécution de leurs étapes existe, porte un horodatage non postérieur à l'instant de la désignation courante, et n'est PAS une conséquence de
//   cette désignation (idDesignation ≠). Aucune issue future du contexte présent ne peut donc entrer dans une classe. L'attente persistée est
//   figée (copie) : une réponse ultérieure ne la réécrit jamais.
//
// API
//   raccordsConditionnes(episodesFamille, partieConnue, cheminsContexte) -> { attentes:[{ chemin, constat, fondation }], divergences:[{ chemin,
//     propositions:[{ constat, fondation }] }] }
//     cœur pur, sur une famille déjà choisie ; fondation = [{ couverture, constats, conditions }] : la classe EXACTE (couverture + tous ses
//     constats) et les membres connus qui l'ont raccordée (conditions). Le constat attendu est { chemin, constat } de l'attente.
//   attentesConditionneesDesContextes(contextes, designation, lignesValeurs, lignesExecutions, descriptions, vueEpisodes)
//     -> [{ idContexte, attentes:[ligne d'attente], divergences }]
//     pour les contextes persistés d'UNE désignation ; la vue des épisodes est calculée UNE fois par l'appelant et transmise explicitement
//     (aucun cache, aucun état) ; familles et classes calculées au plus une fois par structure, dans cet appel.
//     LIGNE D'ATTENTE = forme .74 + champ `fondation` :
//       { idContexte, idDesignation, structure, chemin, constat, temoinsContexte, unitesIssues, fondation }
//       temoinsContexte = unitesIssues = union canonique des couvertures des classes de la fondation (identités d'épisodes historiques ; le
//       champ `fondation`, propre à cette source, est ce qui l'identifie : une attente .74 n'en a jamais).
// Aucune source n'annule l'autre : une attente .74 et une attente conditionnée identiques coexistent (deux lignes, deux fondations).
// Aucun nom de champ, d'opération, de valeur ; aucune probabilité, fréquence, confiance, score, préférence, heuristique textuelle.
// N'INFLUENCE AUCUNE ACTION : les appelants écrivent ces lignes et rien ne les lit pour décider.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
import { coCouverturesParChemins } from './co-couvertures.js';
import { famillesDEpisodes } from './familles-episodes.js';
import { partieConnueEpisode } from './episodes-de-transformation.js';
import { cheminsOuverts } from './contexte-prospectif.js';
import { constatsParChemin } from './constats-par-chemin.js';
import { memesCouvertures, normaliserCouverture } from './couverture-occurrences.js';
import { memesConstats } from './constats-structurels.js';

const NOM = 'attentesConditionnees';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lirePropre(objet, champ, nom) {
  if (objet === null || typeof objet !== 'object' || Array.isArray(objet)) refuser(`${nom} doit être un objet`);
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

const constatSeul = (c) => {
  const copie = { type: c.type };
  if (Object.hasOwn(c, 'valeur')) copie.valeur = c.valeur;
  return copie;
};
const memeStructure = (a, b) => a.length === b.length && a.every((e, i) => e.operation === b[i].operation && e.entrees.length === b[i].entrees.length && e.entrees.every((x, k) => x === b[i].entrees[k]));

// Union canonique de couvertures (identités d'épisodes), sans doublon.
function unionCouvertures(couvertures) {
  const vues = new Map();
  for (const c of couvertures) for (const t of c) vues.set(JSON.stringify(t), t);
  return normaliserCouverture([...vues.values()].map((t) => structuredClone(t)));
}

export function raccordsConditionnes(episodesFamille, partieConnue, cheminsContexte) {
  if (!Array.isArray(episodesFamille)) refuser('episodesFamille doit être un tableau');
  if (partieConnue === null || typeof partieConnue !== 'object' || Array.isArray(partieConnue)) refuser('partieConnue doit être un objet');
  if (!Array.isArray(cheminsContexte)) refuser('cheminsContexte doit être un tableau');
  cheminsContexte.forEach((c, rang) => { if (!Array.isArray(lirePropre(c, 'chemin', `cheminsContexte[${rang}]`))) refuser(`cheminsContexte[${rang}].chemin doit être un tableau`); });
  const vide = { attentes: [], divergences: [] };
  const ouverts = cheminsOuverts(cheminsContexte, partieConnue).map((c) => c.chemin);
  if (ouverts.length === 0 || episodesFamille.length === 0) return vide;
  const { classes } = coCouverturesParChemins(episodesFamille);
  if (classes.length === 0) return vide;
  // Constats présents : le même producteur, sur la partie connue (un seul élément : au plus un constat par chemin).
  const present = constatsParChemin([{ chemin: ['present'], contenu: partieConnue }]).chemins;
  const constatPresent = (chemin) => {
    const entree = present.find((p) => memesCouvertures([p.chemin], [chemin]));
    return entree === undefined ? undefined : entree.constats[0];
  };
  const estOuvert = (chemin) => ouverts.some((o) => memesCouvertures([o], [chemin]));

  const propositions = []; // { chemin, constat, classe, conditions }
  for (const classe of classes) {
    const conditions = [];
    const candidats = [];
    let contredite = false;
    for (const membre of classe.constats) {
      const ici = constatPresent(membre.chemin);
      if (ici !== undefined) {
        if (memesConstats({ chemin: membre.chemin, ...constatSeul(ici) }, { chemin: membre.chemin, ...constatSeul(membre) })) conditions.push(membre);
        else { contredite = true; break; }
      } else if (estOuvert(membre.chemin)) candidats.push(membre);
    }
    if (contredite || conditions.length === 0) continue;
    for (const membre of candidats) propositions.push({ chemin: membre.chemin, constat: constatSeul(membre), classe, conditions });
  }

  // Regroupement par chemin ouvert ; unanimes → une attente ; divergents → rapportés, aucune attente.
  const groupes = [];
  for (const p of propositions) {
    const g = groupes.find((x) => memesCouvertures([x.chemin], [p.chemin]));
    if (g === undefined) groupes.push({ chemin: p.chemin, propositions: [p] });
    else g.propositions.push(p);
  }
  const fondationDe = (p) => ({ couverture: structuredClone(p.classe.couverture), constats: structuredClone(p.classe.constats), conditions: structuredClone(p.conditions) });
  const attentes = [];
  const divergences = [];
  for (const g of groupes) {
    const premier = g.propositions[0].constat;
    const unanimes = g.propositions.every((p) => memesConstats({ chemin: g.chemin, ...p.constat }, { chemin: g.chemin, ...premier }));
    if (unanimes) attentes.push({ chemin: structuredClone(g.chemin), constat: constatSeul(premier), fondation: g.propositions.map(fondationDe) });
    else divergences.push({ chemin: structuredClone(g.chemin), propositions: g.propositions.map((p) => ({ constat: constatSeul(p.constat), fondation: [fondationDe(p)] })) });
  }
  return { attentes, divergences };
}

// Épisodes admissibles pour une désignation : toutes leurs exécutions existent, sont non postérieures à l'instant et ne sont pas des
// conséquences de cette désignation.
function episodesAdmissibles(episodes, lignesExecutions, idDesignation, instant) {
  const parId = new Map();
  for (const e of lignesExecutions) if (e !== null && typeof e === 'object' && typeof e.id === 'string') parId.set(e.id, e);
  return episodes.filter((episode) => Array.isArray(episode.chemin) && episode.chemin.length > 0 && episode.chemin.every((etape) => {
    const e = parId.get(etape.execution);
    return e !== undefined && typeof e.horodatage === 'string' && e.horodatage <= instant && e.idDesignation !== idDesignation;
  }));
}

export function attentesConditionneesDesContextes(contextes, designation, lignesValeurs, lignesExecutions, descriptions, vueEpisodes) {
  if (!Array.isArray(contextes)) refuser('contextes doit être un tableau');
  const idDesignation = chaineNonVide(lirePropre(designation, 'id', 'designation'), 'designation.id');
  const instant = chaineNonVide(lirePropre(designation, 'horodatage', 'designation'), 'designation.horodatage');
  if (!Array.isArray(lignesExecutions)) refuser('lignesExecutions doit être un tableau');
  if (vueEpisodes === null || typeof vueEpisodes !== 'object' || !Array.isArray(vueEpisodes.episodes)) refuser('vueEpisodes doit être une sortie de episodesDeTransformation');
  let familles = null;
  const classesParStructure = []; // local à cet appel : { structure, episodes }
  const sorties = [];
  contextes.forEach((contexte, rang) => {
    const nom = `contextes[${rang}]`;
    const idContexte = chaineNonVide(lirePropre(contexte, 'id', nom), `${nom}.id`);
    if (lirePropre(contexte, 'idDesignation', nom) !== idDesignation) refuser(`${nom} n'est pas un contexte de la désignation`);
    const structure = lirePropre(contexte, 'structure', nom);
    const chemins = lirePropre(contexte, 'chemins', nom);
    if (!Array.isArray(structure) || structure.length === 0 || !Array.isArray(chemins)) refuser(`${nom}.structure (non vide) et ${nom}.chemins doivent être des tableaux`);
    const episodePartiel = lirePropre(contexte, 'episodePartiel', nom);
    if (chemins.length === 0) { sorties.push({ idContexte, attentes: [], divergences: [] }); return; }
    if (familles === null) familles = famillesDEpisodes(episodesAdmissibles(vueEpisodes.episodes, lignesExecutions, idDesignation, instant)).familles;
    let entree = classesParStructure.find((x) => memeStructure(x.structure, structure));
    if (entree === undefined) {
      const famille = familles.find((f) => memeStructure(f.structure, structure));
      entree = { structure, episodes: famille === undefined ? [] : famille.episodes };
      classesParStructure.push(entree);
    }
    const partie = partieConnueEpisode(episodePartiel, lignesValeurs, lignesExecutions, descriptions);
    const { attentes, divergences } = raccordsConditionnes(entree.episodes, partie, chemins);
    sorties.push({
      idContexte,
      attentes: attentes.map((a) => {
        const temoins = unionCouvertures(a.fondation.map((f) => f.couverture));
        return {
          idContexte, idDesignation,
          structure: structure.map((e) => ({ operation: e.operation, entrees: [...e.entrees] })),
          chemin: a.chemin, constat: a.constat,
          temoinsContexte: temoins, unitesIssues: structuredClone(temoins),
          fondation: a.fondation,
        };
      }),
      divergences,
    });
  });
  return sorties;
}

// === FIN_LANGAGE_ATTENTES_CONDITIONNEES ===
