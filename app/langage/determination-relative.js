// === DEBUT_LANGAGE_DETERMINATION_RELATIVE ===
// v0.63.94 — CAUSALITÉ LOCALE : APPLICATION « DÉTERMINÉE RELATIVEMENT À L'OBSERVATION » (décision ChatGPT « DÉCISION MINI-CONCEPTION CAUSALITÉ
// LOCALE », 12/10/2026). FONCTION PURE. Elle DISTINGUE, elle ne FILTRE jamais.
//
// applicationsRelativesA(observation, descriptions, univers) -> [{ operation, liaisons }]
//   Le FAIT utilisé : observation.idMessage, persisté par observerPossibilites (« l'identité de la donnée courante observée », celle qui a déclenché
//   l'observation O). Aucun temps, aucun ordre, aucune fréquence, aucun contenu, aucune préférence : la sollicitation existe PARCE QUE cette donnée a
//   été observée.
//   Pour chaque groupe que la classification en vigueur (classerCombinaisons, source unique) laisse en CHOIX (plusieurs combinaisons valides, ou
//   produit > 1 sans relation déclarée), une application est déterminée relativement à O SI ET SEULEMENT SI :
//     1. exactement UNE entrée ORDINAIRE a observation.idMessage parmi ses candidats ;
//     2. toute autre entrée ordinaire a exactement un candidat ;
//     3. les entrées collectives restent complètes (jamais réduites) ;
//     4. si l'opération déclare des relations, la combinaison ainsi construite figure parmi les combinaisons relationnellement valides.
//   Sinon le groupe reste « choix à faire ». Deux entrées portant la donnée de O ne sont JAMAIS liées toutes deux à elle (aucun a = b fabriqué).
//   Rien n'est retiré de observation.possibilites, de l'univers, ni des choix : l'application rendue S'AJOUTE aux applications déterminées par
//   structure, pour le lot mécanique seulement. Une production (même celle d'un tour précédent) n'est jamais « locale » : seule idMessage compte.
//   Les groupes déjà déterminés par structure (une combinaison valide) ou sans combinaison valide ne sont pas concernés.
import { classerCombinaisons } from './applications-sollicitables.js';
import { groupesDeCandidats } from './groupes-candidats.js';
import { cleApplication } from './besoins.js';

export function applicationsRelativesA(observation, descriptions, univers) {
  if (observation === null || typeof observation !== 'object' || !Array.isArray(observation.possibilites)) {
    classerCombinaisons(observation, descriptions, univers); // même refus que la classification en vigueur (entrée invalide : TypeError)
    return [];
  }
  const donneeDeO = observation.idMessage;
  if (typeof donneeDeO !== 'string' || donneeDeO.length === 0) return [];
  // Seules les opérations dont un atome porte la donnée de O peuvent être concernées : la classification (source unique, inchangée) n'est appliquée
  // qu'à leurs atomes — les groupes sont formés opération par opération, ils sont donc identiques à ceux de l'observation complète.
  const operations = new Set();
  for (const atome of observation.possibilites) if (atome && atome.donnee === donneeDeO) operations.add(atome.operation);
  if (operations.size === 0) return [];
  const restreinte = { ...observation, possibilites: observation.possibilites.filter((atome) => operations.has(atome.operation)) };
  const classes = classerCombinaisons(restreinte, descriptions, univers);
  // même ordre que classerCombinaisons (qui rend groupesDeCandidats(...).map(...)) : la classe de rang i est le groupe de rang i
  const groupes = groupesDeCandidats(restreinte.possibilites, descriptions);
  const relatives = [];
  for (let i = 0; i < classes.length; i += 1) {
    const classe = classes[i];
    const groupe = groupes[i];
    if (classe.valides !== null && classe.valides.length <= 1) continue;
    let causales = 0;
    let autreMultiple = false;
    for (const e of groupe.entrees) {
      if (e.collectif === true) continue;
      if (e.donnees.includes(donneeDeO)) causales += 1;
      else if (e.donnees.length !== 1) autreMultiple = true;
    }
    if (causales !== 1 || autreMultiple) continue;
    const liaisons = groupe.entrees.map((e) => {
      if (e.collectif === true) return { entree: e.entree, donnees: [...e.donnees] };
      return { entree: e.entree, donnee: e.donnees.includes(donneeDeO) ? donneeDeO : e.donnees[0] };
    });
    const application = { operation: groupe.operation, liaisons };
    if (classe.valides !== null) {
      const cle = cleApplication(application);
      if (!classe.valides.some((v) => cleApplication({ operation: groupe.operation, liaisons: v }) === cle)) continue;
    }
    relatives.push(application);
  }
  return relatives;
}
// === FIN_LANGAGE_DETERMINATION_RELATIVE ===
