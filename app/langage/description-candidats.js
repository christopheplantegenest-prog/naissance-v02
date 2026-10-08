// === DEBUT_LANGAGE_DESCRIPTION_CANDIDATS ===
// EXPÉRIENCE D'AUTONOMIE 01 (base v0.63.76, 08/10/2026) — « DÉCRIRE CHAQUE APPLICATION CANDIDATE PAR L'EXPÉRIENCE, AVANT TOUT CHOIX ». VUE PURE, SYNCHRONE,
// DÉTERMINISTE, DORMANTE.
// Elle répond à UNE seule question, posée au moment vécu d'un tour, AVANT qu'une application soit désignée :
//
//   « pour chaque application que l'observation du tour rend possible — déterminée ou à choisir —, qu'est-ce que l'expérience de Naissance
//     permet déjà de dire d'elle : quels épisodes elle prolongerait (contextes prospectifs), quels constats précis elle engagerait (attentes),
//     et ce qui est arrivé aux engagements passés de ces mêmes constats (historiques) ? »
//
// POURQUOI (diagnostic de la même date) : depuis le quatrième tour, 13 opérations sur 14 sont « à choisir » (159 à 231 combinaisons valides) et UNE
// seule est exécutée mécaniquement ; une application à choisir n'est jamais exécutée par Naissance, donc jamais éprouvée, donc l'expérience n'en dit
// rien (aucune attente écrite, aucun historique). Avant toute décision — quelle qu'elle soit et d'où qu'elle vienne —, la contrainte du projet est
// qu'elle puisse être expliquée par ce qui était disponible AVANT ; cette vue produit exactement ce « disponible avant », pour TOUTES les
// combinaisons, sans en préférer, écarter, ordonner ni noter aucune.
//
// decrireCandidats(observation, univers, passe, descriptions, instant = plus grand horodatage d'exécution) -> { determinees, choix }
//   observation / univers : la ligne d'observation de possibilités du tour et l'univers RÉEL du même tour (comme pour applicationsSollicitables) ;
//   descriptions : le catalogue présenté (OBLIGATOIRE : aucun catalogue par défaut n'est lu ici) ;
//   passe : { attentes, contextes, valeurs, executions } — les lignes persistées telles qu'elles existent à cet instant (le passé) ;
//   instant : l'instant de référence des attentes possibles (par défaut : le plus grand horodatage des exécutions, c.-à-d. « tout le passé compte ») ;
//     aucune horloge n'est lue.
//   determinees : [{ application, description }] — les applications à UNE combinaison valide (celles que le déclencheur mécanique exécuterait) ;
//   choix : [{ operation, combinaisons: [{ application, description }] }] — pour chaque opération à choisir, TOUTES ses combinaisons (valides si
//     l'opération déclare des relations, brutes sinon : exactement les candidates de classerCombinaisons / groupesDeCandidats).
//   description = { contextes, attentes, historiques }
//     contextes   : contextesProspectifs(application, valeurs, executions, descriptions) — un par projection (.72), tels quels ;
//     attentes    : pour chaque contexte, attentesDuContexteProspectif (.74) avec une désignation FICTIVE { id: 'candidat', horodatage: instant }
//                   (jamais écrite) : ce que Naissance ENGAGERAIT si cette application était désignée maintenant ; chaque attente porte `rangContexte` ;
//     historiques : pour chaque contexte, chaque chemin ouvert et chaque constat historique C : { rangContexte, chemin, constat: C,
//                   experiences: couverture [[idAttente]…], elements } où elements = elementsDExperiences des expériences d'attentes (.76) dont le
//                   critère est { contexte.structure, chemin } et le constat engagé est C (memesConstats). couverture vide = « jamais engagé » (H4).
//                   Les éléments sont prêts pour la vue des constats par chemin : statuts et réels y sont lisibles par couvertures.
//   ORDRE : celui de classerCombinaisons (canonique par opération) puis des combinaisons (produit cartésien dans l'ordre des candidats) : aucune
//   signification. Aucun nombre n'est produit en dehors des couvertures ; aucun statut n'est résumé ; aucune combinaison n'est retirée.
// CE QUE CETTE VUE NE FAIT PAS : choisir, préférer, exclure, ordonner par mérite, noter, compter des succès, désigner, exécuter, écrire. Elle ne lit
// aucun texte ni aucune valeur du monde. Elle n'introduit aucune règle nouvelle : elle compose applicationsSollicitables (candidates), contexte-prospectif,
// attentes-prospectives et experiences-attentes. Aucun nom d'opération ni de champ.
// PURETÉ : aucune écriture, aucun magasin, aucune horloge, aucun hasard, aucun état ; entrées jamais modifiées ; sorties neuves.
// NON BRANCHÉ : aucun mécanisme du dépôt n'importe ce fichier (gardé par test) ; l'écran, le choix et l'exécution ne la lisent pas.
import { classerCombinaisons } from './applications-sollicitables.js';
import { groupesDeCandidats } from './groupes-candidats.js';
import { contextesProspectifs } from './contexte-prospectif.js';
import { attentesDuContexteProspectif } from './attentes-prospectives.js';
import { experiencesDAttentes, elementsDExperiences } from './experiences-attentes.js';
import { memesCouvertures, normaliserCouverture } from './couverture-occurrences.js';
import { memesConstats } from './constats-structurels.js';

const NOM = 'decrireCandidats';
const ID_CANDIDAT = 'candidat';

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

const memeStructure = (a, b) => a.length === b.length && a.every((e, i) => e.operation === b[i].operation && e.entrees.length === b[i].entrees.length && e.entrees.every((x, k) => x === b[i].entrees[k]));

// Produit cartésien des candidats d'un groupe (même construction que applications-sollicitables : une entrée collective prend tout son ensemble).
function combinaisonsDe(entrees) {
  return entrees.reduce((resultat, entree) => {
    const choix = entree.collectif === true ? [{ entree: entree.entree, donnees: [...entree.donnees] }] : entree.donnees.map((donnee) => ({ entree: entree.entree, donnee }));
    const suite = [];
    for (const debut of resultat) for (const liaison of choix) suite.push([...debut, liaison]);
    return suite;
  }, [[]]);
}

export function decrireCandidats(observation, univers, passe, descriptions, instant = undefined) {
  if (!Array.isArray(descriptions)) refuser('descriptions (le catalogue présenté) doit être un tableau');
  const attentesPassees = lirePropre(passe, 'attentes', 'passe');
  const contextesPasses = lirePropre(passe, 'contextes', 'passe');
  const valeurs = lirePropre(passe, 'valeurs', 'passe');
  const executions = lirePropre(passe, 'executions', 'passe');
  if (![attentesPassees, contextesPasses, valeurs, executions].every(Array.isArray)) refuser('passe.attentes, contextes, valeurs et executions doivent être des tableaux');
  let reference = instant;
  if (reference === undefined) {
    reference = '';
    for (const e of executions) if (e !== null && typeof e === 'object' && typeof e.horodatage === 'string' && e.horodatage > reference) reference = e.horodatage;
  }
  if (typeof reference !== 'string') refuser('instant doit être une chaîne (horodatage)');
  const designation = { id: ID_CANDIDAT, horodatage: reference };

  // 1. Le passé des engagements, une fois pour toutes les candidates.
  const { experiences } = experiencesDAttentes(attentesPassees, contextesPasses, valeurs, executions, descriptions);

  // 2. Les candidates du tour : exactement celles de applicationsSollicitables (déterminées) et de groupesDeCandidats (à choisir).
  const classes = classerCombinaisons(observation, descriptions, univers);
  const groupes = groupesDeCandidats(lirePropre(observation, 'possibilites', 'observation'), descriptions);

  const decrire = (application) => {
    const contextes = contextesProspectifs(application, valeurs, executions, descriptions);
    const attentes = [];
    const historiques = [];
    contextes.forEach((contexte, rangContexte) => {
      const ligne = { id: `${ID_CANDIDAT}/${rangContexte}`, idDesignation: ID_CANDIDAT, ...contexte };
      for (const attente of attentesDuContexteProspectif(ligne, designation, contextesPasses, valeurs, executions, descriptions)) attentes.push({ rangContexte, ...attente });
      for (const ouvert of contexte.chemins) {
        for (const A of ouvert.constats) {
          const constat = { type: A.type };
          if (Object.hasOwn(A, 'valeur')) constat.valeur = A.valeur;
          const comparables = experiences.filter((e) => memeStructure(e.critere.structure, contexte.structure) && memesCouvertures([e.critere.chemin], [ouvert.chemin]) && memesConstats({ chemin: ouvert.chemin, ...e.avant.constat }, { chemin: ouvert.chemin, ...constat }));
          historiques.push({ rangContexte, chemin: structuredClone(ouvert.chemin), constat, experiences: normaliserCouverture(comparables.map((e) => [e.id])), elements: elementsDExperiences(comparables) });
        }
      }
    });
    return { contextes, attentes, historiques };
  };

  const determinees = [];
  const choix = [];
  for (const classe of classes) {
    if (classe.valides !== null && classe.valides.length === 0) continue; // aucune combinaison valide : ni application ni choix (comme applicationsSollicitables)
    if (classe.valides !== null && classe.valides.length === 1) {
      const application = { operation: classe.operation, liaisons: classe.valides[0] };
      determinees.push({ application, description: decrire(application) });
      continue;
    }
    const liaisonsPossibles = classe.valides ?? combinaisonsDe(groupes.find((g) => g.operation === classe.operation).entrees);
    choix.push({ operation: classe.operation, combinaisons: liaisonsPossibles.map((liaisons) => { const application = { operation: classe.operation, liaisons }; return { application, description: decrire(application) }; }) });
  }
  return { determinees, choix };
}
// === FIN_LANGAGE_DESCRIPTION_CANDIDATS ===
