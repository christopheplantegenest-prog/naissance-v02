// === DEBUT_LANGAGE_ATTENTES_PROSPECTIVES ===
// v0.63.74 — « PREMIÈRE ATTENTE GÉNÉRALE, ÉCRITE AVANT L'ISSUE » (décision ChatGPT, 07/10/2026). CALCUL PUR, SYNCHRONE, DÉTERMINISTE.
// Il répond à UNE seule question, posée AVANT l'exécution d'une application désignée, pour UN contexte prospectif déjà écrit :
//
//   « pour quels chemins encore ouverts de ce contexte un constat historique disponible (A) est-il AUSSI le constat réellement observé dans
//     TOUTES les issues passées de situations prospectives comparables (B) ? »
//
// Une ATTENTE est un engagement précis écrit avant l'issue : « pour ce chemin encore ouvert, ce constat précis est engagé avant l'issue, sur la
// base de ces expériences passées ». Elle ne dit ni probable, ni certain, ni croyance ; elle ne choisit rien.
//
// attentesDuContexteProspectif(contexte, designation, contextesAnterieurs, lignesValeurs, lignesExecutions, descriptions) -> [attente]
//   contexte : la ligne persistée COURANTE de contextesProspectifs (A vient d'elle, jamais d'un recalcul de famille : si l'histoire évolue
//     ensuite, l'attente reste fondée sur ce que le contexte contenait vraiment) ;
//   designation : la ligne de désignation courante (id, horodatage) — l'instant de référence ;
//   contextesAnterieurs : les lignes de contextesProspectifs disponibles (la courante peut y figurer : elle est exclue par idDesignation) ;
//   lignesValeurs / lignesExecutions / descriptions : le magasin tel qu'il existe AVANT l'exécution courante (l'issue courante n'existe pas).
//
// A : chaque constat historique { type, valeur?, couverture } d'un chemin ouvert du contexte courant (contexte.chemins[i].constats).
// B : pour le même critère { structure prospective, chemin ouvert }, les UNITÉS D'ISSUE PASSÉES : un contexte antérieur de même structure, dont
//   l'exécution existe déjà (lien idDesignation) et n'est pas postérieure à la désignation courante (horodatage), dont issueDuContexteProspectif
//   rend une issue, et dont l'issue porte ce chemin ouvert ; l'unité est identifiée par [id du contexte antérieur, …chemin] et sa partie APRÈS
//   est { reel } (ou {} si le chemin était absent). constatsParChemin sur ces parties « après » : B existe si et seulement si le chemin
//   ["reel"] est porté par la couverture UNIVERSELLE des unités, avec UN constat à ["reel","type"] porté par tous et, soit aucun chemin
//   ["reel","valeur"] (constat sans valeur), soit UN constat à ["reel","valeur"] porté par tous. Deux constats réels différents, une absence
//   chez certains, ou aucune unité passée : pas de B — aucune attente (ce n'est pas un seuil : sans issue passée, B n'existe pas ; une seule
//   unité suffit, sa couverture est alors d'un témoin).
// A = B : memesConstats (l'égalité du producteur de constats : même chemin, même type, même présence de valeur, Object.is). Une attente par
//   (chemin, constat) satisfaisant A = B ; plusieurs chemins d'un même contexte donnent plusieurs attentes ; plusieurs constats A dont un seul
//   égale B donnent une attente (le contexte sait que d'autres valeurs ont été vécues ; toutes les issues comparables passées ont donné B).
//
// ATTENTE = { idContexte, idDesignation, structure, chemin, constat, temoinsContexte, unitesIssues }
//   constat : { type[, valeur] } (= B = A) ; temoinsContexte : la couverture historique de A dans le contexte courant ; unitesIssues : la
//   couverture universelle des unités passées ayant établi B (identités [idContexte, …chemin]). Tout est copié : rien n'est partagé.
// Aucun nom de champ (relationValeur, arrivee…), aucun nom d'opération, aucun seuil numérique, aucun vote, aucune majorité, aucun score :
//   une identité qui ne se répète jamais ne donne pas de B par les seules couvertures ; une famille à deux valeurs réelles non plus.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées.
import { issueDuContexteProspectif } from './issue-contexte-prospectif.js';
import { constatsParChemin } from './constats-par-chemin.js';
import { memesCouvertures } from './couverture-occurrences.js';
import { memesConstats } from './constats-structurels.js';

const NOM = 'attentesDuContexteProspectif';

function refuser(raison) {
  throw new TypeError(`${NOM} : ${raison}.`);
}

function lirePropre(objet, champ, nom) {
  if (objet === null || typeof objet !== 'object') refuser(`${nom} doit être un objet`);
  const place = Object.getOwnPropertyDescriptor(objet, champ);
  if (place === undefined) refuser(`${nom} n'a pas de champ « ${champ} » propre`);
  if (!('value' in place)) refuser(`${nom}.${champ} est un accesseur : une donnée est attendue`);
  return place.value;
}

function chaineNonVide(valeur, nom) {
  if (typeof valeur !== 'string' || valeur.length === 0) refuser(`${nom} doit être une chaîne non vide`);
  return valeur;
}

const memeStructure = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((e, i) => e.operation === b[i].operation && Array.isArray(e.entrees) && Array.isArray(b[i].entrees) && e.entrees.length === b[i].entrees.length && e.entrees.every((x, k) => x === b[i].entrees[k]));
const copierConstat = (constat) => {
  const copie = { type: constat.type };
  if (Object.hasOwn(constat, 'valeur')) copie.valeur = constat.valeur;
  return copie;
};

// B pour un groupe d'unités passées : le constat réel porté par TOUTES, ou null.
function constatUniversel(unites) {
  if (unites.length === 0) return null;
  const { universelle, chemins } = constatsParChemin(unites);
  const au = (chemin) => chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
  const unique = (c) => c !== undefined && c.constats.length === 1 && memesCouvertures(c.constats[0].couverture, universelle) ? c.constats[0] : null;
  const reel = unique(au(['reel']));
  if (reel === null || reel.type !== 'objet') return null;
  const type = unique(au(['reel', 'type']));
  if (type === null || type.type !== 'chaine') return null;
  const cheminValeur = au(['reel', 'valeur']);
  if (cheminValeur === undefined) return { constat: { type: type.valeur }, unites: universelle };
  const valeur = unique(cheminValeur);
  if (valeur === null) return null;
  return { constat: { type: type.valeur, valeur: valeur.valeur }, unites: universelle };
}

export function attentesDuContexteProspectif(contexte, designation, contextesAnterieurs, lignesValeurs, lignesExecutions, descriptions) {
  const idContexte = chaineNonVide(lirePropre(contexte, 'id', 'contexte'), 'contexte.id');
  const idDesignation = chaineNonVide(lirePropre(contexte, 'idDesignation', 'contexte'), 'contexte.idDesignation');
  const structure = lirePropre(contexte, 'structure', 'contexte');
  const chemins = lirePropre(contexte, 'chemins', 'contexte');
  if (!Array.isArray(structure) || structure.length === 0 || !Array.isArray(chemins)) refuser('contexte.structure (non vide) et contexte.chemins doivent être des tableaux');
  if (chaineNonVide(lirePropre(designation, 'id', 'designation'), 'designation.id') !== idDesignation) refuser('la désignation n\'est pas celle du contexte');
  const instant = chaineNonVide(lirePropre(designation, 'horodatage', 'designation'), 'designation.horodatage');
  if (!Array.isArray(contextesAnterieurs) || !Array.isArray(lignesExecutions)) refuser('contextesAnterieurs et lignesExecutions doivent être des tableaux');
  if (chemins.length === 0) return [];

  // 1. Situations prospectives comparables, déjà issues, antérieures : même structure, autre désignation, exécution existante et non postérieure.
  const issues = [];
  for (const anterieur of contextesAnterieurs) {
    if (anterieur === null || typeof anterieur !== 'object') refuser('contextesAnterieurs doit ne contenir que des objets');
    if (anterieur.idDesignation === idDesignation || !memeStructure(anterieur.structure, structure)) continue;
    const execution = lignesExecutions.find((e) => e !== null && typeof e === 'object' && e.idDesignation === anterieur.idDesignation);
    if (execution === undefined || typeof execution.horodatage !== 'string' || execution.horodatage > instant) continue;
    const issue = issueDuContexteProspectif(anterieur, lignesValeurs, lignesExecutions, descriptions);
    if (issue.issue !== null) issues.push({ idContexte: anterieur.id, issue });
  }

  // 2. Pour chaque chemin ouvert : unités passées, B universel, puis A = B.
  const attentes = [];
  chemins.forEach((ouvert, rang) => {
    const nom = `contexte.chemins[${rang}]`;
    const chemin = lirePropre(ouvert, 'chemin', nom);
    const constats = lirePropre(ouvert, 'constats', nom);
    if (!Array.isArray(chemin) || !Array.isArray(constats)) refuser(`${nom} doit porter chemin et constats (tableaux)`);
    const unites = [];
    for (const { idContexte: idAnterieur, issue } of issues) {
      const confronte = issue.chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
      if (confronte === undefined) continue;
      unites.push({ chemin: [idAnterieur, ...chemin], contenu: Object.hasOwn(confronte, 'reel') ? { reel: copierConstat(confronte.reel) } : {} });
    }
    const B = constatUniversel(unites);
    if (B === null) return;
    for (const A of constats) {
      if (!memesConstats({ chemin, ...copierConstat(A) }, { chemin, ...B.constat })) continue;
      attentes.push({
        idContexte, idDesignation,
        structure: structure.map((e) => ({ operation: e.operation, entrees: [...e.entrees] })),
        chemin: structuredClone(chemin),
        constat: copierConstat(B.constat),
        temoinsContexte: structuredClone(lirePropre(A, 'couverture', `${nom}.constats`)),
        unitesIssues: structuredClone(B.unites),
      });
    }
  });
  return attentes;
}
// === FIN_LANGAGE_ATTENTES_PROSPECTIVES ===
