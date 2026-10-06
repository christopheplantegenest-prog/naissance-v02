// === DEBUT_LANGAGE_TABLE_OPERATIONS ===
// v0.63.18 — TABLE MÉCANIQUE FERMÉE des 9 opérations décrites : OÙ est l'implémentation et COMMENT JavaScript doit l'appeler. Rien d'autre.
// Forme uniforme { fonction, appel: 'positionnel' | 'objet', parametres: [...] }, gelée en profondeur. L'ordre de `parametres` est
// l'ordre des arguments JavaScript (positionnel) ou l'ensemble des champs de l'objet unique (objet) ; il n'est JAMAIS déduit de
// la liste des descriptions (ce fichier ne l'importe pas) : l'égalité des noms est prouvée par des TESTS.
// Ni score, ni priorité, ni condition d'usage, ni forme, ni module sous forme de chaîne, ni adaptateur : aucune information de décision.
// Imports nommés statiques uniquement : les opérations sont désormais LOCALISABLES mécaniquement ; elles ne sont PAS utilisées par le moteur.
// La fonction de relations parent-enfant est volontairement ABSENTE (hors descriptions, donc hors table). Ordre des clés : unités de code, sans signification.
// v0.63.38 : DIXIÈME entrée, symbolesDeChaine (positionnel, un seul paramètre « chaine »). Même forme mécanique, rien d'autre.
// v0.63.41 : ONZIÈME entrée, elementsObservables (positionnel, un seul paramètre « elements ») : première opération collective réelle.
// v0.63.42 : DOUZIÈME entrée, produireSuitesFermees (positionnel, un seul paramètre « elements »). Même forme mécanique, rien d'autre.
// v0.63.43 : TREIZIÈME entrée, projeterContenus (positionnel, un seul paramètre « elements »). Même forme mécanique, rien d'autre.
// v0.63.44 : QUATORZIÈME entrée, rechercherSousSuites (positionnel, deux paramètres « motifs », « elements »). Même forme mécanique, rien d'autre.
// NON BRANCHÉE : seule la primitive d'invocation (qui ne l'importe pas) et les tests la rencontrent.
import { couvrirSequence } from './sequence-plages.js';
import { decrireStructureIdentifiee } from './structure-identifiee.js';
import { decrireValeursObservees } from './valeurs-observees.js';
import { elementsObservables } from './elements-observables.js';
import { memesCouvertures, normaliserCouverture } from './couverture-occurrences.js';
import { parcourirStructure } from './parcours-structure.js';
import { partagerCouvertures } from './partition-couvertures.js';
import { produireConstatsStructurels } from './constats-structurels.js';
import { produireSuitesFermees } from './suites-fermees.js';
import { projeterContenus } from './projeter-contenus.js';
import { rechercherSousSuites } from './rechercher-sous-suites.js';
import { resoudreCouverture } from './resolution-couverture.js';
import { symbolesDeChaine } from './symboles-de-chaine.js';

export const TABLE_OPERATIONS = Object.freeze({
  couvrirSequence: Object.freeze({ fonction: couvrirSequence, appel: 'objet', parametres: Object.freeze(['elements', 'plages']) }),
  decrireStructureIdentifiee: Object.freeze({ fonction: decrireStructureIdentifiee, appel: 'positionnel', parametres: Object.freeze(['elements']) }),
  decrireValeursObservees: Object.freeze({ fonction: decrireValeursObservees, appel: 'positionnel', parametres: Object.freeze(['paires']) }),
  elementsObservables: Object.freeze({ fonction: elementsObservables, appel: 'positionnel', parametres: Object.freeze(['elements']) }),
  memesCouvertures: Object.freeze({ fonction: memesCouvertures, appel: 'positionnel', parametres: Object.freeze(['a', 'b']) }),
  normaliserCouverture: Object.freeze({ fonction: normaliserCouverture, appel: 'positionnel', parametres: Object.freeze(['chemins']) }),
  parcourirStructure: Object.freeze({ fonction: parcourirStructure, appel: 'positionnel', parametres: Object.freeze(['valeur']) }),
  partagerCouvertures: Object.freeze({ fonction: partagerCouvertures, appel: 'positionnel', parametres: Object.freeze(['a', 'b']) }),
  produireConstatsStructurels: Object.freeze({ fonction: produireConstatsStructurels, appel: 'positionnel', parametres: Object.freeze(['elements']) }),
  produireSuitesFermees: Object.freeze({ fonction: produireSuitesFermees, appel: 'positionnel', parametres: Object.freeze(['elements']) }),
  projeterContenus: Object.freeze({ fonction: projeterContenus, appel: 'positionnel', parametres: Object.freeze(['elements']) }),
  rechercherSousSuites: Object.freeze({ fonction: rechercherSousSuites, appel: 'positionnel', parametres: Object.freeze(['motifs', 'elements']) }),
  resoudreCouverture: Object.freeze({ fonction: resoudreCouverture, appel: 'positionnel', parametres: Object.freeze(['univers', 'couverture']) }),
  symbolesDeChaine: Object.freeze({ fonction: symbolesDeChaine, appel: 'positionnel', parametres: Object.freeze(['chaine']) }),
});
// === FIN_LANGAGE_TABLE_OPERATIONS ===
