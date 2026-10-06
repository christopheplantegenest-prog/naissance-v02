// === DEBUT_TESTS_CONTRATS_OBSERVES ===
// v0.62.9 — OUTIL DE TESTS UNIQUEMENT (aucun fichier de production ne l'importe). Source UNIQUE des descripteurs présentés
// comme « contrats observés / réels » des fonctions et capacités, des scénarios réels qui les prouvent et de la fonction de
// conformité. Décision ChatGPT du 04/10/2026 : on corrige les PREUVES, pas les primitives.
//
// Deux directions de fidélité (voir tests/contrats-observes.test.mjs) :
//   SORTIES : tout scénario réel satisfait le descripteur (le descripteur englobe le réel observé).
//   ENTRÉES : le descripteur décrit ce que le code EXIGE réellement. Aucun genre n'est imposé quand le code accepte
//             d'autres scalaires. Ce que le vocabulaire ne sait pas exprimer est nommé dans LIMITES_CONNUES.
// Un échantillon peut réfuter une affirmation, il ne prouve jamais « n'existe jamais » : ces absences reposent sur la
// lecture du code (retours énumérés dans CHEMINS_ATTENDUS) ET sur la clôture des clés, jamais sur un seul exemple.
//
// v0.63.4 — SOURCE UNIQUE PARTAGÉE AVEC LA PRODUCTION : les descriptions des PRIMITIVES (couvrirSequence,
// decrireStructureIdentifiee, decrireValeursObservees) ne sont PLUS redéclarées ici : elles viennent de
// app/langage/descriptions-operations.js. Ce fichier ne garde en propre que les contrats de CAPACITÉS (recherche,
// deduction) et celui de repererMotifs, testés localement (CONTRATS_LOCAUX). Il fournit en plus les scénarios réels et la
// conformité pour TOUS les contrats (CONTRATS = locaux + descriptions de production).
//
// v0.63.10 — le catalogue de production compte NEUF descriptions : s'y ajoutent memesCouvertures, normaliserCouverture,
// parcourirStructure, partagerCouvertures, produireConstatsStructurels et resoudreCouverture. Leurs scénarios réels, leurs
// chemins de code et leur clôture sont ici, comme pour les trois premières. Pour resoudreCouverture, les scénarios de CET outil
// utilisent un univers d'objets { chemin } SEULEMENT (clôture des clés) ; le passage des champs supplémentaires de l'univers
// (type, valeur) est prouvé à part, dans tests/descriptions-operations.test.mjs.
//
// MISE À JOUR DÉLIBÉRÉE v0.63.38 — le catalogue de production compte DIX descriptions : s'ajoute symbolesDeChaine (décision ChatGPT,
// 05/10/2026). Ses scénarios réels (chaîne ordinaire ; chaîne vide ; cas Unicode particuliers : hors plan de base, combinant, substitut
// isolé) et sa clôture sont ici, comme pour les neuf autres. Un seul retour (Array.from) : les trois scénarios sont des classes de
// sortie, voir CHEMINS_ATTENDUS. Sortie : collection de chaînes, aucun objet, donc aucun témoin de champ à produire.
// MISE À JOUR DÉLIBÉRÉE v0.63.41 — le catalogue compte ONZE descriptions : s'ajoute elementsObservables (première opération collective réelle,
// décision ChatGPT, 06/10/2026). Scénarios : deux éléments, aucun élément, valeur vide. Sortie : collection d'objets { chemin, contenu }.
import { validerDescripteurOperation } from '../app/langage/formes-operation.js';
import { CAPACITES } from '../app/langage/registre.js';
import { apprendreFait, apprendreRegle, chargerEsprit } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { repererMotifs } from '../app/langage/induction.js';
import { decrireValeursObservees } from '../app/langage/valeurs-observees.js';
import { decrireStructureIdentifiee } from '../app/langage/structure-identifiee.js';
import { couvrirSequence } from '../app/langage/sequence-plages.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { normaliserCouverture, memesCouvertures } from '../app/langage/couverture-occurrences.js';
import { resoudreCouverture } from '../app/langage/resolution-couverture.js';
import { produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { partagerCouvertures } from '../app/langage/partition-couvertures.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';
import { elementsObservables } from '../app/langage/elements-observables.js';

const sc =(genre) => (genre === undefined ? { forme: 'scalaire' } : { forme: 'scalaire', genre });
const ob = (champs) => (champs === undefined ? { forme: 'objet' } : { forme: 'objet', champs });
const co = (elements) => (elements === undefined ? { forme: 'collection' } : { forme: 'collection', elements });
const avec = (forme, faits) => ({ ...forme, ...faits });
const contrat = (nom, entrees, sortie) => validerDescripteurOperation({ nom, entrees, sortie });

// ---------------------------------------------------------------------------------------------- DESCRIPTEURS
export const CONTRATS_LOCAUX = Object.freeze({
  // Capacités : un rôle est alimenté par la composition ; `canoniser` accepte tout scalaire (chaîne, nombre, booléen).
  // Aucun rôle n'est omissible TEL QUE COMPOSÉ : un rôle non résolu provoque une abstention (role_non_resolu).
  recherche: contrat('recherche', { relation: sc(), valeur: sc() }, ob({ sujets: co(sc('chaine')) })),
  // Les trois retours de appliquerRegles (regles.js, lignes 66, 69, 70) : { resultat:null } | { resultat:null, conflit:true, candidats }
  // | { resultat, regle }. Aucun champ `ok`. `conflit` est le booléen true ; il n'existe que dans le cas conflit.
  deduction: contrat('deduction', { sujet: sc(), role: sc() }, ob({
    resultat: avec(sc('chaine'), { peutEtreNull: true }),
    regle: avec(ob(), { peutManquer: true }),
    conflit: avec(sc('booleen'), { peutManquer: true }),
    candidats: avec(co(ob()), { peutManquer: true }),
  })),
  // repererMotifs ne valide ni id ni texteRecu : id non chaîne accepté, id absent accepté (couverture reçoit undefined),
  // texteRecu non chaîne ou absent ignoré en silence. Les identités sont rendues telles que fournies : scalaire sans genre.
  repererMotifs: contrat('repererMotifs', {
    corpus: co(ob({ id: avec(sc(), { omissible: true }), texteRecu: avec(sc(), { omissible: true }) })),
    options: avec(ob(), { omissible: true }),
  }, co(ob({ gabarit: co(ob()), cle: sc('chaine'), couverture: co(sc()) }))),
});

// Descriptions de PRIMITIVES : lues dans la source de production, jamais redéclarées ici.
export const DESCRIPTIONS = Object.freeze(Object.fromEntries(DESCRIPTIONS_OPERATIONS.map((d) => [d.nom, d])));
export const CONTRATS = Object.freeze({ ...CONTRATS_LOCAUX, ...DESCRIPTIONS });

// Clés réelles volontairement NON décrites, par chemin d'objet décrit (vide : tout ce qui existe est décrit ou opaque).
export const NON_DECRITS = Object.freeze({
  recherche: {}, deduction: {}, couvrirSequence: {}, decrireValeursObservees: {}, decrireStructureIdentifiee: {}, repererMotifs: {},
  memesCouvertures: {}, normaliserCouverture: {}, parcourirStructure: {}, partagerCouvertures: {}, produireConstatsStructurels: {}, resoudreCouverture: {},
  symbolesDeChaine: {},
  elementsObservables: {}, // MISE À JOUR DÉLIBÉRÉE v0.63.41
});

// Chemins de code énumérés par LECTURE du code (un scénario par chemin). Un test refuse qu'un chemin disparaisse.
export const CHEMINS_ATTENDUS = Object.freeze({
  recherche: ['sujets_trouves', 'aucun_sujet'],
  deduction: ['conclusion', 'aucune_regle', 'conflit'],
  couvrirSequence: ['sequence_couverte', 'sans_plage', 'sequence_vide'],
  decrireValeursObservees: ['valeurs_mixtes', 'aucune_entree', 'non_resolus', 'ambigu', 'undefined_present', 'combine'],
  decrireStructureIdentifiee: ['groupe_valide', 'arites_incompatibles', 'un_seul', 'vide'],
  repererMotifs: ['motifs_trouves', 'aucun_motif', 'corpus_vide'],
  memesCouvertures: ['couvertures_egales', 'couvertures_differentes', 'deux_vides'],
  normaliserCouverture: ['couverture_ordonnee', 'couverture_vide', 'chemin_racine', 'segments_mixtes'],
  parcourirStructure: ['structure_riche', 'scalaire_racine', 'nul_racine', 'objet_vide'],
  partagerCouvertures: ['recouvrement', 'parties_vides', 'deux_vides'],
  produireConstatsStructurels: ['constats_partages', 'contenu_nul_et_moins_zero', 'aucun_element'],
  resoudreCouverture: ['membres_resolus', 'couverture_vide', 'couverture_universelle'],
  // symbolesDeChaine n'a qu'UN retour (Array.from) : ces trois noms sont des CLASSES DE SORTIE observables (ordinaire, vide, cas Unicode
  // particuliers de la spécification), pas trois chemins de code. Elles satisfont la garde D3 (au moins trois scénarios par opération) sans la modifier.
  symbolesDeChaine: ['chaine_ordinaire', 'chaine_vide', 'unicode_particuliers'],
  // MISE À JOUR DÉLIBÉRÉE v0.63.41 : elementsObservables (première opération collective réelle) : un seul retour (map), trois classes de sortie.
  elementsObservables: ['deux_elements', 'aucun_element', 'valeur_vide'],
});

// Ce que le vocabulaire actuel ne peut PAS exprimer et que les contrats ci-dessus ne prétendent donc pas couvrir.
export const LIMITES_CONNUES = Object.freeze([
  'capacités : les rôles acceptent null et undefined (canonisés en chaîne vide) ; aucun fait ne le dit pour un rôle',
  'entrées : « chaîne non vide » n\'est pas exprimable — decrireValeursObservees et decrireStructureIdentifiee refusent un id vide',
  'entrées : « nombre fini » n\'est pas exprimable — decrireValeursObservees refuse NaN et les infinis alors que le genre nombre les contient',
  'entrées : repererMotifs accepte options sous forme de tableau ou de chaîne (ignorés) et refuse null ; « toute valeur non nulle » n\'est pas exprimable, la forme objet est la forme d\'usage',
  'entrées : repererMotifs ignore en silence un texteRecu non chaîne et met undefined dans couverture pour un id absent',
  'entrées : decrireValeursObservees accepte valeur undefined explicitement PRÉSENT (classée comme valeur observée, distincte de l\'absence) ; « undefined présent » n\'est pas exprimable',
  'sorties : une clé présente valant undefined (decrireValeursObservees) n\'est pas exprimable ; le descripteur la rapproche de peutManquer, ce qu\'elle devient après sérialisation JSON',
  'entrées : decrireValeursObservees rapporte les ids dupliqués dans ambigus (pas une erreur) et traite une propriété héritée comme absente ; ni l\'un ni l\'autre n\'est exprimable',
  'capacités nues : invoquer() tolère un rôle omis alors que la composition l\'abstient ; le descripteur décrit le rôle tel que composé',
]);

// ---------------------------------------------------------------------------------------------- SCÉNARIOS RÉELS
const sorted = (o) => Object.keys(o).sort().join(',');
const union = (liste) => [...new Set(liste.flatMap((o) => Object.keys(o)))].sort().join(',');

export async function produireScenarios() {
  const e = await chargerEsprit(magasinMemoireVive());
  for (const [s, r, v] of [['zorbo', 'zcouleur', 'zbleu'], ['zkelmi', 'zcouleur', 'zbleu'], ['zorbo', 'ztaille', 'zgrand']]) await apprendreFait(e, { sujet: s, relation: r, valeur: v });
  await apprendreRegle(e, { role: 'zrole1', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zcouleur' });
  await apprendreRegle(e, { role: 'zrole3', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zr1' });
  await apprendreRegle(e, { role: 'zrole3', conditions: [{ propriete: 'ztaille', valeur: 'zgrand' }], resultat: 'zr2' });
  const T = (...t) => t.map((texte, i) => ({ id: `E${i + 1}`, texte }));
  const memeArite = T('Non, c\'était plutôt une déduction.', 'Non, c\'était plutôt une recherche.', 'Oui, c\'était bien une déduction.');
  const motifs = memeArite.map((x) => ({ id: x.id, texteRecu: x.texte }));
  // Chaque scénario : { nom, sortie, cles (clés racine), imbriquees (clés des éléments, union) }.
  // `image: 'json'` : la sortie est contrôlée sur son IMAGE JSON (une clé présente valant undefined y devient absente) ;
  // les photos de clés (A2/A3) restent prises sur la sortie réelle elle-même.
  const sc1 = (nom, sortie, cles, imbriquees, image = null) => ({ nom, sortie, cles, imbriquees, image });
  const elementsCouverts = ['ou', 'tu', { a: [1, null] }, null, 'x'];
  const plagesCouvertes = [{ debut: 0, longueur: 1, etiquette: 'type' }, { debut: 0, longueur: 2, etiquette: { k: [1] } }, { debut: 3, longueur: 1, etiquette: null }];
  // v0.63.10 : entrées réelles des six primitives de couvertures (chemins typés : chaîne ou entier ≥ 0, jamais d'objet).
  const univers = [{ chemin: ['b', 1] }, { chemin: [] }, { chemin: ['a'] }, { chemin: [0] }];
  const contenuRiche = { a: [1, 'x', true, null], b: 'x', c: {} };
  return {
    memesCouvertures: [
      sc1('couvertures_egales', memesCouvertures([['b', 1], ['a'], []], [[], ['a'], ['b', 1]]), null),
      sc1('couvertures_differentes', memesCouvertures([['a']], [['a'], ['b']]), null),
      sc1('deux_vides', memesCouvertures([], []), null),
    ],
    normaliserCouverture: [
      sc1('couverture_ordonnee', normaliserCouverture([['b', 1], ['a'], ['b']]), null),
      sc1('couverture_vide', normaliserCouverture([]), null),
      sc1('chemin_racine', normaliserCouverture([[]]), null),
      sc1('segments_mixtes', normaliserCouverture([['0'], [0], ['a', 3]]), null),
    ],
    parcourirStructure: [
      sc1('structure_riche', parcourirStructure(contenuRiche), null, { '[]': 'chemin,type,valeur' }),
      sc1('scalaire_racine', parcourirStructure('x'), null, { '[]': 'chemin,type,valeur' }),
      sc1('nul_racine', parcourirStructure(null), null, { '[]': 'chemin,type' }),
      sc1('objet_vide', parcourirStructure({}), null, { '[]': 'chemin,type' }),
    ],
    partagerCouvertures: [
      sc1('recouvrement', partagerCouvertures([['a'], ['b', 1], []], [['b', 1], ['c']]), 'communs,seulementA,seulementB'),
      sc1('parties_vides', partagerCouvertures([['a']], [['a']]), 'communs,seulementA,seulementB'),
      sc1('deux_vides', partagerCouvertures([], []), 'communs,seulementA,seulementB'),
    ],
    produireConstatsStructurels: [
      sc1('constats_partages', produireConstatsStructurels([{ chemin: ['p'], contenu: contenuRiche }, { chemin: ['q', 0], contenu: { b: 'x' } }]), null, { '[]': 'constat,couverture' }),
      sc1('contenu_nul_et_moins_zero', produireConstatsStructurels([{ chemin: [], contenu: null }, { chemin: [0], contenu: -0 }]), null, { '[]': 'constat,couverture' }),
      sc1('aucun_element', produireConstatsStructurels([]), null),
    ],
    resoudreCouverture: [
      sc1('membres_resolus', resoudreCouverture(univers, [['a'], ['b', 1]]), null, { '[]': 'chemin' }),
      sc1('couverture_vide', resoudreCouverture(univers, []), null),
      sc1('couverture_universelle', resoudreCouverture(univers, normaliserCouverture(univers.map((u) => u.chemin))), null, { '[]': 'chemin' }),
    ],
    symbolesDeChaine: [
      sc1('chaine_ordinaire', symbolesDeChaine('ab c'), null),
      sc1('chaine_vide', symbolesDeChaine(''), null),
      sc1('unicode_particuliers', symbolesDeChaine('a\u{1F600}é\uD800'), null),
    ],
    elementsObservables: [
      sc1('deux_elements', elementsObservables([{ identite: 'execution-A', valeur: ['a', 'b'] }, { identite: 'execution-B', valeur: ['b'] }]), null, { '[]': 'chemin,contenu' }),
      sc1('aucun_element', elementsObservables([]), null),
      sc1('valeur_vide', elementsObservables([{ identite: 'message-1', valeur: [] }]), null, { '[]': 'chemin,contenu' }),
    ],
    couvrirSequence: [
      sc1('sequence_couverte', couvrirSequence({ elements: elementsCouverts, plages: plagesCouvertes }), null, { '[]': 'couvertures,element,position' }),
      sc1('sans_plage', couvrirSequence({ elements: ['a', 'b'], plages: [] }), null),
      sc1('sequence_vide', couvrirSequence({ elements: [], plages: [] }), null),
    ],
    recherche: [
      sc1('sujets_trouves', CAPACITES.recherche.invoquer(e, { relation: 'zcouleur', valeur: 'zbleu' }), 'sujets'),
      sc1('aucun_sujet', CAPACITES.recherche.invoquer(e, { relation: 'zcouleur', valeur: 'zrouge' }), 'sujets'),
    ],
    deduction: [
      sc1('conclusion', CAPACITES.deduction.invoquer(e, { sujet: 'zorbo', role: 'zrole1' }), 'regle,resultat'),
      sc1('aucune_regle', CAPACITES.deduction.invoquer(e, { sujet: 'zorbo', role: 'zinconnu' }), 'resultat'),
      sc1('conflit', CAPACITES.deduction.invoquer(e, { sujet: 'zorbo', role: 'zrole3' }), 'candidats,conflit,resultat'),
    ],
    decrireValeursObservees: [
      sc1('valeurs_mixtes', decrireValeursObservees([{ id: 'a', valeur: 'x' }, { id: 'b', valeur: 3 }, { id: 'c', valeur: true }, { id: 'd', valeur: null }, { id: 'e', valeur: 'x' }]), 'ambigus,nombreValeurs,nonResolus,valeurs', { 'valeurs[]': 'ids,valeur' }),
      sc1('aucune_entree', decrireValeursObservees([]), 'ambigus,nombreValeurs,nonResolus,valeurs'),
      sc1('non_resolus', decrireValeursObservees([{ id: 'a' }, { id: 'b' }]), 'ambigus,nombreValeurs,nonResolus,valeurs'),
      sc1('ambigu', decrireValeursObservees([{ id: 'a', valeur: 1 }, { id: 'a', valeur: 2 }]), 'ambigus,nombreValeurs,nonResolus,valeurs'),
      sc1('undefined_present', decrireValeursObservees([{ id: 'a', valeur: undefined }, { id: 'b', valeur: 'x' }]), 'ambigus,nombreValeurs,nonResolus,valeurs', { 'valeurs[]': 'ids,valeur' }, 'json'),
      sc1('combine', decrireValeursObservees([{ id: 'a' }, { id: 'b', valeur: 1 }, { id: 'c', valeur: 1 }, { id: 'd', valeur: 2 }, { id: 'd', valeur: 3 }]), 'ambigus,nombreValeurs,nonResolus,valeurs', { 'valeurs[]': 'ids,valeur' }),
    ],
    decrireStructureIdentifiee: [
      sc1('groupe_valide', decrireStructureIdentifiee(memeArite), 'couverture,rapport'),
      sc1('arites_incompatibles', decrireStructureIdentifiee([memeArite[0], { id: 'E9', texte: 'C\'était plutôt une déduction ?' }]), 'couverture,rapport'),
      sc1('un_seul', decrireStructureIdentifiee([memeArite[0]]), 'couverture,rapport'),
      sc1('vide', decrireStructureIdentifiee([]), 'couverture,rapport'),
    ],
    repererMotifs: [
      sc1('motifs_trouves', repererMotifs(motifs), null, { '[]': 'cle,couverture,gabarit' }),
      sc1('aucun_motif', repererMotifs([{ id: 'a', texteRecu: 'alpha beta' }, { id: 'b', texteRecu: 'gamma delta' }]), null),
      sc1('corpus_vide', repererMotifs([]), null),
    ],
  };
}

// Clés des éléments à un chemin 'x[]' (union) ; '[]' pour une racine tableau.
export function clesImbriquees(sortie, chemin) {
  const liste = chemin === '[]' ? sortie : sortie[chemin.slice(0, -2)];
  return union(liste);
}
export { sorted as clesRacine };

// ---------------------------------------------------------------------------------------------- CONFORMITÉ
// Retourne la liste des violations (vide = conforme). Les objets sont OUVERTS : la clôture des clés est vérifiée à part.
export function conformite(valeur, forme, chemin = 'sortie') {
  const v = [];
  if (valeur === undefined) return [`${chemin}: undefined (hors vocabulaire)`];
  if (valeur === null) return [`${chemin}: null à la racine ou dans un élément (aucun fait possible ici)`];
  if (forme.forme === 'quelconque') return v; // forme non contrainte : toute valeur définie convient (undefined est refusé plus haut)
  if (forme.forme === 'scalaire') {
    if (typeof valeur === 'object' || typeof valeur === 'function') return [`${chemin}: scalaire attendu, reçu ${Array.isArray(valeur) ? 'tableau' : typeof valeur}`];
    if (forme.genre) {
      const t = { chaine: 'string', nombre: 'number', booleen: 'boolean' }[forme.genre];
      if (typeof valeur !== t) return [`${chemin}: genre ${forme.genre} attendu, reçu ${typeof valeur}`];
    }
    return v;
  }
  if (forme.forme === 'objet') {
    if (typeof valeur !== 'object' || Array.isArray(valeur)) return [`${chemin}: objet attendu, reçu ${Array.isArray(valeur) ? 'tableau' : typeof valeur}`];
    for (const [nom, champ] of Object.entries(forme.champs || {})) {
      if (!Object.hasOwn(valeur, nom)) { if (champ.peutManquer !== true) v.push(`${chemin}.${nom}: absent alors que le champ ne peut pas manquer`); continue; }
      if (valeur[nom] === null) { if (champ.peutEtreNull !== true) v.push(`${chemin}.${nom}: null alors que le champ n'est pas nullable`); continue; }
      v.push(...conformite(valeur[nom], champ, `${chemin}.${nom}`));
    }
    return v;
  }
  if (!Array.isArray(valeur)) return [`${chemin}: collection attendue, reçu ${typeof valeur}`];
  if (forme.elements) valeur.forEach((x, i) => v.push(...conformite(x, forme.elements, `${chemin}[${i}]`)));
  return v;
}

// Pour une valeur et sa forme : la liste des [chemin, objet] correspondant aux objets DÉCRITS (champs définis).
export function instancesDecrites(forme, valeur, chemin = 'sortie', sortie = []) {
  if (valeur === null || valeur === undefined) return sortie;
  if (forme.forme === 'objet' && forme.champs && typeof valeur === 'object' && !Array.isArray(valeur)) {
    sortie.push([chemin, valeur]);
    for (const [nom, champ] of Object.entries(forme.champs)) if (Object.hasOwn(valeur, nom)) instancesDecrites(champ, valeur[nom], `${chemin}.${nom}`, sortie);
  } else if (forme.forme === 'collection' && forme.elements && Array.isArray(valeur)) {
    for (const x of valeur) instancesDecrites(forme.elements, x, `${chemin}[]`, sortie);
  }
  return sortie;
}

// Formes décrites (chemin -> objet forme) pour retrouver les champs déclarés à chaque chemin.
export function formesDecrites(forme, chemin = 'sortie', sortie = new Map()) {
  if (forme.forme === 'objet' && forme.champs) {
    sortie.set(chemin, forme);
    for (const [nom, champ] of Object.entries(forme.champs)) formesDecrites(champ, `${chemin}.${nom}`, sortie);
  } else if (forme.forme === 'collection' && forme.elements) formesDecrites(forme.elements, `${chemin}[]`, sortie);
  return sortie;
}
// === FIN_TESTS_CONTRATS_OBSERVES ===
