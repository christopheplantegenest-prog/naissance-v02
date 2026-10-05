// === DEBUT_TEST_PROVENANCE_ANALYSE ===
// v0.63.1 — ÉTAPE 6, décision ChatGPT « PROVENANCE DE L'ANALYSE » (04/10/2026). comprendre() connaît, PENDANT son
// exécution, quels tokens ont produit le type, le sujet et la relation, d'où commence le groupe pertinent, et quelles
// occurrences ont été reconnues puis écartées. Il les jetait. Cette version les CONSERVE (propriété additive
// `provenanceAnalyse` de la compréhension, copiée dans observationsLangage) SANS changer aucune décision :
// type / sujet / relation / etat / motsInconnus / relationsNommees / réponse identiques, et aucune fonction de décision
// ne lit la provenance. Positions : index zéro-based dans le tableau `mots` retourné ; `longueur` = nombre de tokens.
//
// Preuve centrale d'invariance : tests/oracle-comprendre-v0630.mjs est une COPIE FIGÉE de comprendre.js v0.63.0 ;
// la sortie de la version courante lui est comparée sur un grand corpus déterministe et plusieurs états.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { comprendre, decouper, COMPRIS, PARTIEL, INCOMPRIS, QUESTION_INFORMATION, AFFIRMATION, VERIFICATION } from '../app/langage/comprendre.js';
import { comprendre as comprendreAvant } from './oracle-comprendre-v0630.mjs';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';
import { chargerEsprit, apprendreFait, apprendreRelation, repondre } from '../app/langage/esprit.js';
import {
  magasinMemoireVive, enregistrerObservationLangage, rattacherObservationLangage, VERSION_BASE,
} from '../app/langage/connaissances.js';
import { tenterPontLangage, enregistrerExperienceTentativeEchouee, creerObservateurLangage } from '../app/langage/pont.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import {
  SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete,
} from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';

const RACINE = join(fileURLToPath(new URL('..', import.meta.url)));
const APP = join(RACINE, 'app');
const lire = (...p) => readFileSync(join(APP, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const T = 'observationsLangage';

// ------------------------------------------------------------------------------------------------ ÉTATS
// Un « état de connaissances » tel que esprit.js le construit : lexique, prénoms, sujets, relations, gabarits appris.
function etat({ lexiqueExtra = {}, relations = [], sujets = [], prenoms = [], gabarits = [] } = {}) {
  return {
    lexique: { ...LEXIQUE_DEPART, ...lexiqueExtra },
    prenomsConnus: new Set(prenoms),
    sujetsConnus: new Set(sujets),
    relationsConnues: new Set(relations),
    gabaritsTypesAppris: gabarits,
  };
}
const REL = (relation) => ({ role: 'relation', relation });
const ETAT_REEL = () => etat({
  lexiqueExtra: {
    fait: REL('fait'), avoir: REL('avoir'), etre: REL('etre'), faire: REL('faire'), ne: REL('ne'), creer: REL('creer'),
    modifier: REL('modifier'),
    explorer: REL('examiner quelque chose afin de le decouvrir ou de mieux le connaitre'),
  },
  relations: ['est', 'fait', 'avoir', 'etre', 'faire', 'ne', 'creer', 'modifier', 'peut etre', 'peut', 'nom', 'couleur', 'ville', 'fils',
    'examiner quelque chose afin de le decouvrir ou de mieux le connaitre', 'devient'],
  sujets: ['explorer', 'sera', 'departement de la charente', 'aaa', 'bbb'],
  prenoms: ['naissance'],
  gabarits: [
    { statut: 'validee', gabarits: [[{ mot: 'zorblax' }]], signification: 'TYPE_Z' },
    { statut: 'remplacee', gabarits: [[{ mot: 'qwerty' }]], signification: 'TYPE_R' },
    { statut: 'validee', gabarits: [[{ role: 'pronom_toi' }, { mot: 'fait' }]], signification: 'TYPE_TF' },
  ],
});
const ETATS = { depart: etat(), reel: ETAT_REEL() };

// ------------------------------------------------------------------------------------------------ CORPUS
// Générateur pseudo-aléatoire DÉTERMINISTE (mulberry32) : le même corpus à chaque exécution.
function prng(graine) {
  let a = graine >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const MOTS_POOL = [
  'je', "j'ai", 'tu', 'te', 'moi', 'ma', 'ton', 'il', 'on', 'est', "c'est", 'es', 'peut', 'veux', 'fait', 'avoir', 'être', 'faire',
  'né', 'nom', 'couleur', 'ville', 'où', 'ou', 'comment', 'qui', 'quelle', 'que', 'de', 'le', 'en', 'explorer', 'créer', 'modifier',
  'peut-être', 'est-ce que', "t'appelles", 'habites', 'devient', 'sera', 'aaa', 'bbb', 'departement de la charente',
  'zorblax', 'qwerty', 'plumf', 'blorp', 'zorblax', 'qwerty', 'plumf', 'blorp', 'chat', 'maison', 'bleu', 'demain',
];
function corpus(graine, n) {
  const alea = prng(graine);
  const phrases = [];
  for (let i = 0; i < n; i += 1) {
    const longueur = 1 + Math.floor(alea() * (alea() < 0.15 ? 60 : 14));
    const m = [];
    for (let j = 0; j < longueur; j += 1) m.push(MOTS_POOL[Math.floor(alea() * MOTS_POOL.length)]);
    phrases.push(m.join(alea() < 0.2 ? ', ' : ' ') + (alea() < 0.3 ? ' ?' : ''));
  }
  return phrases;
}
const CORPUS = corpus(20261004, 2500);

// =================================================================================================
// A. AUCUNE DÉCISION NE CHANGE (oracle = comprendre.js v0.63.0 figé)
// =================================================================================================
test('A1. la sortie de comprendre() est STRICTEMENT identique à celle de v0.63.0 sur 5000 phrases et 2 états (champs historiques)', () => {
  let compare = 0;
  for (const [nom, e] of Object.entries(ETATS)) {
    for (const phrase of CORPUS) {
      const avant = comprendreAvant(phrase, e);
      const apres = comprendre(phrase, e);
      assert.deepStrictEqual(apres, avant, `état ${nom}, phrase : ${phrase}`);
      assert.deepEqual(Object.keys(apres), Object.keys(avant), 'mêmes champs, même ordre');
      compare += 1;
    }
  }
  assert.equal(compare, 5000);
});

test('A2. le corpus exerce les trois états et les mécanismes (garde-fou : une comparaison vide ne prouverait rien)', () => {
  const vus = { compris: 0, partiel: 0, incompris: 0, ecartees: 0, abstention: 0, interrogatif: 0, verification: 0, appris: 0, prefixe: 0 };
  for (const phrase of CORPUS) {
    const c = comprendre(phrase, ETATS.reel);
    vus[c.etat] += 1;
    if (c.provenanceAnalyse.ecartees.length) vus.ecartees += 1;
    if (c.relation === null && c.provenanceAnalyse.ecartees.some((x) => x.raison === 'ambigue')) vus.abstention += 1;
    if (c.type === QUESTION_INFORMATION) vus.interrogatif += 1;
    if (c.type === VERIFICATION) vus.verification += 1;
    if (c.type.startsWith('TYPE_')) vus.appris += 1;
    if (c.provenanceAnalyse.groupe.debut > 0) vus.prefixe += 1;
  }
  for (const [cle, n] of Object.entries(vus)) assert.ok(n >= 20, `le corpus doit exercer « ${cle} » (${n})`);
});

test('A3. les fonctions voisines (expliquer, decouper) sont inchangées, et la réponse de repondre() sur un état réel est identique à l\'oracle des décisions', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'manteau', relation: 'manteau' });
  await apprendreFait(esprit, { sujet: 'moi', relation: 'manteau', valeur: 'un manteau bleu' });
  const r = repondre(esprit, 'Quel est mon manteau ?');
  assert.equal(r.etat, COMPRIS);
  assert.equal(r.texte, 'un manteau bleu');
  const avant = comprendreAvant('Quel est mon manteau ?', esprit);
  assert.deepStrictEqual(r.comprehension, avant);
});

// =================================================================================================
// B. FORME ET STATUT DE LA PROPRIÉTÉ
// =================================================================================================
test('B1. provenanceAnalyse est NON énumérable, non modifiable et gelée : elle ne se recopie dans aucune table par { ...comprehension }', () => {
  const c = comprendre('je est', etat({ relations: ['est'] }));
  const d = Object.getOwnPropertyDescriptor(c, 'provenanceAnalyse');
  assert.equal(d.enumerable, false);
  assert.equal(d.writable, false);
  assert.equal(d.configurable, false);
  assert.ok(!Object.keys(c).includes('provenanceAnalyse'));
  assert.ok(!('provenanceAnalyse' in { ...c }));
  assert.ok(!JSON.stringify(c).includes('provenance'));
  assert.ok(Object.isFrozen(c.provenanceAnalyse));
  assert.ok(Object.isFrozen(c.provenanceAnalyse.groupe));
  assert.ok(Object.isFrozen(c.provenanceAnalyse.ecartees));
  assert.throws(() => { c.provenanceAnalyse = null; }, TypeError);
  assert.throws(() => { c.provenanceAnalyse.groupe.debut = 3; }, TypeError);
});

test('B2. forme exacte : { groupe:{debut}, type, sujet, relation (liste ou null), ecartees } et rien d\'autre', () => {
  const c = comprendre('comment tu t\'appelles du coup', ETATS.reel);
  assert.deepEqual(Object.keys(c.provenanceAnalyse), ['groupe', 'type', 'sujet', 'relation', 'ecartees']);
  assert.deepEqual(Object.keys(c.provenanceAnalyse.groupe), ['debut']);
  for (const plage of [c.provenanceAnalyse.type, c.provenanceAnalyse.sujet, ...c.provenanceAnalyse.relation]) {
    assert.deepEqual(Object.keys(plage), ['debut', 'longueur']);
  }
});

test('B3. texte vide : provenance vide mais bien formée', () => {
  const c = comprendre('', etat());
  assert.deepEqual(c.provenanceAnalyse, { groupe: { debut: 0 }, type: null, sujet: null, relation: null, ecartees: [] });
});

// =================================================================================================
// C. CAS RÉELS OBLIGATOIRES (mécanismes révélés par la sauvegarde v0.63.0)
// =================================================================================================
test('C1. « je est » : le sujet vient de « je » (0), la relation de « est » (1), acceptée car seule (rien d\'écarté)', () => {
  const c = comprendre('je est', etat({ relations: ['est'] }));
  assert.deepEqual(c.mots, ['je', 'est']);
  assert.equal(c.etat, COMPRIS);
  assert.deepEqual(c.provenanceAnalyse, {
    groupe: { debut: 0 }, type: null, sujet: { debut: 0, longueur: 1 }, relation: [{ debut: 1, longueur: 1 }], ecartees: [],
  });
});

test('C2. contre-exemple central « zorblax qwerty je plumf en fait blorp » : sujet = « je » (2), relation = « fait » (5), groupe dès 0, 4 inconnus hors provenance', () => {
  const c = comprendre('zorblax qwerty je plumf en fait blorp', { ...ETATS.reel, gabaritsTypesAppris: [] });
  assert.equal(c.etat, COMPRIS);
  assert.deepEqual(c.motsInconnus, ['zorblax', 'qwerty', 'plumf', 'blorp']);
  const p = c.provenanceAnalyse;
  assert.deepEqual(p.groupe, { debut: 0 });
  assert.deepEqual(p.sujet, { debut: 2, longueur: 1 });
  assert.deepEqual(p.relation, [{ debut: 5, longueur: 1 }]);
  assert.equal(p.type, null);
  assert.deepEqual(p.ecartees, []);
  // Lecture SANS lexique : texte + mots + provenance suffisent.
  const mots = decouper('zorblax qwerty je plumf en fait blorp');
  assert.equal(mots[p.sujet.debut], 'je');
  assert.equal(mots[p.relation[0].debut], 'fait');
  const hors = mots.filter((_, i) => i !== 2 && i !== 5);
  assert.deepEqual(hors, ['zorblax', 'qwerty', 'plumf', 'en', 'blorp']);
});

test('C3. « comment tu t\'appelles du coup » : type = « comment » (0), sujet = « tu » (1), relation « nom » produite par « appelles » (3) -- la SOURCE, pas la valeur', () => {
  const c = comprendre("comment tu t'appelles du coup", ETATS.reel);
  assert.deepEqual(c.mots, ['comment', 'tu', 't', 'appelles', 'du', 'coup']);
  assert.equal(c.relation, 'nom');
  assert.equal(c.sujet, 'naissance');
  assert.deepEqual(c.provenanceAnalyse, {
    groupe: { debut: 0 }, type: { debut: 0, longueur: 1 }, sujet: { debut: 1, longueur: 1 }, relation: [{ debut: 3, longueur: 1 }], ecartees: [],
  });
});

test('C4. « quelle est ta couleur préférée » : « est » (1) reconnu puis ÉCARTÉ comme structurel, la relation retenue « couleur » vient du token 3', () => {
  const c = comprendre('quelle est ta couleur préférée', ETATS.reel);
  assert.deepEqual(c.mots, ['quelle', 'est', 'ta', 'couleur', 'preferee']);
  assert.equal(c.relation, 'couleur');
  assert.deepEqual(c.provenanceAnalyse, {
    groupe: { debut: 0 }, type: { debut: 0, longueur: 1 }, sujet: { debut: 2, longueur: 1 }, relation: [{ debut: 3, longueur: 1 }],
    ecartees: [{ debut: 1, longueur: 1, valeur: 'est', raison: 'structurelle' }],
  });
});

test('C5. « né » produit le token normalisé « ne » : la provenance référence le tableau `mots` (pas les caractères du texte brut)', () => {
  const c = comprendre('tu es né', ETATS.reel);
  assert.deepEqual(c.mots, ['tu', 'es', 'ne']);
  assert.equal(c.relation, 'ne');
  assert.deepEqual(c.provenanceAnalyse.relation, [{ debut: 2, longueur: 1 }]);
  assert.equal(c.mots[c.provenanceAnalyse.relation[0].debut], 'ne');
  assert.deepEqual(c.provenanceAnalyse.sujet, { debut: 0, longueur: 1 });
});

test('C6. « ou » produit « ville » : la source est le mot-déclencheur « ou », qui est AUSSI l\'origine du type ; le préfixe est hors groupe', () => {
  const c = comprendre('zorblax qwerty plumf blorp ou tu veux', ETATS.reel);
  assert.deepEqual(c.mots, ['zorblax', 'qwerty', 'plumf', 'blorp', 'ou', 'tu', 'veux']);
  assert.equal(c.relation, 'ville');
  assert.equal(c.type, QUESTION_INFORMATION);
  assert.deepEqual(c.provenanceAnalyse, {
    groupe: { debut: 4 }, type: { debut: 4, longueur: 1 }, sujet: { debut: 5, longueur: 1 }, relation: [{ debut: 4, longueur: 1 }], ecartees: [],
  });
});

test('C7. « explorer » fournit le sujet ET la relation depuis le MÊME token (5) ; la valeur de la relation est sa définition', () => {
  const c = comprendre('non on va continuer à explorer encore pour son analyse', ETATS.reel);
  assert.equal(c.mots[5], 'explorer');
  assert.equal(c.sujet, 'explorer');
  assert.equal(c.relation, 'examiner quelque chose afin de le decouvrir ou de mieux le connaitre');
  assert.deepEqual(c.provenanceAnalyse.sujet, { debut: 5, longueur: 1 });
  assert.deepEqual(c.provenanceAnalyse.relation, [{ debut: 5, longueur: 1 }]);
});

test('C8. une relation distincte présente plusieurs fois (« est » ×3) : UNE relation retenue, TOUTES ses occurrences en provenance', () => {
  const c = comprendre("c'est un truc je dis que c'est bien et c'est tout", ETATS.reel);
  assert.deepEqual(c.mots.map((m, i) => (m === 'est' ? i : -1)).filter((i) => i >= 0), [1, 8, 12]);
  assert.equal(c.relation, 'est');
  assert.deepEqual(c.provenanceAnalyse.relation, [{ debut: 1, longueur: 1 }, { debut: 8, longueur: 1 }, { debut: 12, longueur: 1 }]);
  assert.deepEqual(c.provenanceAnalyse.ecartees, []);
  assert.deepEqual(c.provenanceAnalyse.sujet, { debut: 4, longueur: 1 });
});

test('C9. plusieurs relations de contenu distinctes => ABSTENTION : relation = null, aucune source retenue, chaque occurrence écartée comme « ambigue »', () => {
  const c = comprendre('je veux avoir et faire', ETATS.reel);
  assert.equal(c.relation, null);
  assert.equal(c.etat, PARTIEL);
  assert.deepEqual(c.provenanceAnalyse.relation, null);
  assert.deepEqual(c.provenanceAnalyse.sujet, { debut: 0, longueur: 1 });
  assert.deepEqual(c.provenanceAnalyse.ecartees, [
    { debut: 2, longueur: 1, valeur: 'avoir', raison: 'ambigue' },
    { debut: 4, longueur: 1, valeur: 'faire', raison: 'ambigue' },
  ]);
});

test('C10. long préfixe exclu par le groupe pertinent : le début du groupe est un entier dans `mots` et tout ce qui est retenu est APRÈS lui', () => {
  const prefixe = Array.from({ length: 40 }, (_, i) => `zmot${i}`).join(' ');
  const c = comprendre(`${prefixe} ou tu veux`, ETATS.reel);
  assert.equal(c.mots.length, 43);
  assert.equal(c.provenanceAnalyse.groupe.debut, 40);
  assert.equal(c.mots[40], 'ou');
  assert.deepEqual(c.provenanceAnalyse.sujet, { debut: 41, longueur: 1 });
  assert.deepEqual(c.provenanceAnalyse.relation, [{ debut: 40, longueur: 1 }]);
  assert.equal(c.motsInconnus.length, 40, 'motsInconnus compte TOUS les inconnus, y compris hors groupe (inchangé)');
});

test('C11. INCOMPRIS sans aucun élément retenu : toute la provenance est vide', () => {
  const c = comprendre('zorblax qwerty plumf', ETATS.depart);
  assert.equal(c.etat, INCOMPRIS);
  assert.deepEqual(c.provenanceAnalyse, { groupe: { debut: 0 }, type: null, sujet: null, relation: null, ecartees: [] });
});

test('C12. INCOMPRIS avec des éléments reconnus puis tous écartés (« est » et « peut » structurels) : ils sont dans `ecartees`, rien n\'est retenu', () => {
  const c = comprendre("non c'est bon enfin on peut rigoler", ETATS.reel);
  assert.equal(c.etat, INCOMPRIS);
  assert.deepEqual(c.provenanceAnalyse.sujet, null);
  assert.deepEqual(c.provenanceAnalyse.relation, null);
  assert.deepEqual(c.provenanceAnalyse.ecartees, [
    { debut: 2, longueur: 1, valeur: 'est', raison: 'structurelle' },
    { debut: 6, longueur: 1, valeur: 'peut', raison: 'structurelle' },
  ]);
});

// =================================================================================================
// D. AUTRES BRANCHES DE LA DÉCISION
// =================================================================================================
test('D1. type : gabarit de départ -- plage EXACTE du gabarit (« est ce que » = 3 tokens), puis gabarit « verbe + pronom 3e »', () => {
  const a = comprendre('est-ce que tu veux', ETATS.depart);
  assert.equal(a.type, VERIFICATION);
  assert.deepEqual(a.provenanceAnalyse.type, { debut: 0, longueur: 3 });
  const b = comprendre('maintenant peut il venir', ETATS.depart);
  assert.equal(b.type, VERIFICATION);
  assert.deepEqual(b.provenanceAnalyse.type, { debut: 1, longueur: 2 });
});

test('D2. type : gabarit APPRIS validé -- sa plage ; gabarit « remplacé » jamais utilisé ; AFFIRMATION par défaut = aucune provenance inventée', () => {
  const valide = comprendre('blorp zorblax plumf', ETATS.reel);
  assert.equal(valide.type, 'TYPE_Z');
  assert.deepEqual(valide.provenanceAnalyse.type, { debut: 1, longueur: 1 });
  const remplace = comprendre('blorp qwerty plumf', ETATS.reel);
  assert.equal(remplace.type, AFFIRMATION);
  assert.equal(remplace.provenanceAnalyse.type, null);
  const deuxieme = comprendre('xx bbb ccc', etat({ gabarits: [{ statut: 'validee', gabarits: [[{ mot: 'aaa' }], [{ mot: 'bbb' }, { mot: 'ccc' }]], signification: 'TYPE_2' }] }));
  assert.equal(deuxieme.type, 'TYPE_2');
  assert.deepEqual(deuxieme.provenanceAnalyse.type, { debut: 1, longueur: 2 });
});

test('D3. type interrogatif : le PREMIER mot interrogatif (gauche -> droite) est la source, même s\'il y en a plusieurs', () => {
  const c = comprendre('tu sais qui vient comment', ETATS.depart);
  assert.equal(c.type, QUESTION_INFORMATION);
  assert.deepEqual(c.provenanceAnalyse.type.longueur, 1);
  assert.equal(c.mots[c.provenanceAnalyse.type.debut], 'qui');
});

test('D4. sujet : séquence de plusieurs mots -- plage de toute la séquence', () => {
  const c = comprendre('zorblax departement de la charente plumf', ETATS.reel);
  assert.equal(c.sujet, 'departement de la charente');
  assert.deepEqual(c.provenanceAnalyse.sujet, { debut: 1, longueur: 4 });
});

test('D5. sujet : le PREMIER mot-personne l\'emporte ; les suivants ne sont pas en provenance ; une séquence connue ne passe jamais devant un mot-personne', () => {
  assert.deepEqual(comprendre('tu et je', etat()).provenanceAnalyse.sujet, { debut: 0, longueur: 1 });
  assert.equal(comprendre('tu et je', etat()).sujet, 'naissance');
  assert.deepEqual(comprendre('je et tu', etat()).provenanceAnalyse.sujet, { debut: 0, longueur: 1 });
  assert.equal(comprendre('je et tu', etat()).sujet, 'moi');
  const c = comprendre('explorer je', ETATS.reel);
  assert.equal(c.sujet, 'moi');
  assert.deepEqual(c.provenanceAnalyse.sujet, { debut: 1, longueur: 1 });
});

test('D6. sujet : deux séquences connues de même longueur et de valeurs différentes = ambiguïté réelle => aucun sujet, aucune provenance', () => {
  const c = comprendre('aaa bbb', etat({ sujets: ['aaa', 'bbb'] }));
  assert.equal(c.sujet, null);
  assert.equal(c.provenanceAnalyse.sujet, null);
});

test('D7. relation par mots-déclencheurs : tous les porteurs de LA relation retenue ; deux relations différentes = abstention, chaque porteur écarté comme « ambigue »', () => {
  const memes = comprendre('tu appelles appelle', etat());
  assert.equal(memes.relation, 'nom');
  assert.deepEqual(memes.provenanceAnalyse.relation, [{ debut: 1, longueur: 1 }, { debut: 2, longueur: 1 }]);
  const differents = comprendre('tu habites appelles', etat());
  assert.equal(differents.relation, null);
  assert.equal(differents.provenanceAnalyse.relation, null);
  assert.deepEqual(differents.provenanceAnalyse.ecartees, [
    { debut: 1, longueur: 1, valeur: 'ville', raison: 'ambigue' },
    { debut: 2, longueur: 1, valeur: 'nom', raison: 'ambigue' },
  ]);
});

test('D8. des mots-déclencheurs jamais CONSULTÉS (une séquence nommée existait) ne sont pas des candidats écartés', () => {
  const c = comprendre('tu appelles nom', etat({ relations: ['nom'] }));
  assert.equal(c.relation, 'nom');
  assert.deepEqual(c.provenanceAnalyse.relation, [{ debut: 2, longueur: 1 }]);
  assert.deepEqual(c.provenanceAnalyse.ecartees, []);
});

test('D9. relation multi-mots : la plage couvre toute la séquence reconnue', () => {
  const c = comprendre('je dis que peut etre demain', etat({ relations: ['peut etre'] }));
  assert.equal(c.relation, 'peut etre');
  assert.deepEqual(c.provenanceAnalyse.relation, [{ debut: 3, longueur: 2 }]);
});

// =================================================================================================
// E. INVARIANTS SUR TOUT LE CORPUS (propriétés, pas des copies de l'analyse)
// =================================================================================================
const ROLES_MOI = ['possessif_moi', 'pronom_moi'];
const ROLES_TOI = ['possessif_toi', 'pronom_toi'];
test('E1. sur 5000 phrases : positions dans les bornes de `mots`, tout est dans le groupe, cohérence avec les valeurs retournées', () => {
  for (const [nom, e] of Object.entries(ETATS)) {
    for (const phrase of CORPUS) {
      const c = comprendre(phrase, e);
      const p = c.provenanceAnalyse;
      const n = c.mots.length;
      const info = `état ${nom}, phrase : ${phrase}`;
      assert.ok(Number.isInteger(p.groupe.debut) && p.groupe.debut >= 0 && p.groupe.debut <= n, info);
      const dansLeGroupe = (r) => r.debut >= p.groupe.debut && r.longueur >= 1 && r.debut + r.longueur <= n;
      // sujet
      if (c.sujet === null) assert.equal(p.sujet, null, info);
      else {
        assert.ok(p.sujet && dansLeGroupe(p.sujet), info);
        if (c.sujet === 'moi' || c.sujet === 'naissance') {
          assert.equal(p.sujet.longueur, 1, info);
          const roles = c.sujet === 'moi' ? ROLES_MOI : ROLES_TOI;
          assert.ok(roles.includes(e.lexique[c.mots[p.sujet.debut]].role), info);
          for (let i = p.groupe.debut; i < p.sujet.debut; i += 1) {
            const r = e.lexique[c.mots[i]];
            assert.ok(!r || ![...ROLES_MOI, ...ROLES_TOI].includes(r.role), `premier mot-personne : ${info}`);
          }
        } else {
          assert.equal(c.mots.slice(p.sujet.debut, p.sujet.debut + p.sujet.longueur).join(' '), c.sujet, info);
        }
      }
      // relation
      if (c.relation === null) assert.equal(p.relation, null, info);
      else {
        assert.ok(Array.isArray(p.relation) && p.relation.length >= 1 && p.relation.every(dansLeGroupe), info);
        for (const r of p.relation) {
          const jetons = c.mots.slice(r.debut, r.debut + r.longueur);
          const porte = r.longueur === 1 && e.lexique[jetons[0]] && e.lexique[jetons[0]].relation === c.relation;
          assert.ok(jetons.join(' ') === c.relation || porte, info);
        }
        for (let i = 1; i < p.relation.length; i += 1) assert.ok(p.relation[i].debut >= p.relation[i - 1].debut + p.relation[i - 1].longueur, `ordre et non-chevauchement : ${info}`);
      }
      // type
      if (c.type === AFFIRMATION) assert.equal(p.type, null, info);
      else assert.ok(p.type && dansLeGroupe(p.type), info);
      if (c.type === QUESTION_INFORMATION) assert.equal(e.lexique[c.mots[p.type.debut]].role, 'interrogatif', info);
      // écartées
      for (const x of p.ecartees) {
        assert.ok(dansLeGroupe(x), info);
        assert.ok(['structurelle', 'ambigue'].includes(x.raison), info);
        if (x.raison === 'ambigue') assert.equal(c.relation, null, `une ambiguïté est une abstention : ${info}`);
        assert.ok(!(p.relation || []).some((r) => r.debut < x.debut + x.longueur && x.debut < r.debut + r.longueur), `écartée et retenue ne se chevauchent pas : ${info}`);
      }
    }
  }
});

test('E2. positionnement du groupe : toujours un suffixe de `mots` dont le premier token est un interrogatif OU le début de la phrase', () => {
  for (const phrase of CORPUS) {
    const c = comprendre(phrase, ETATS.reel);
    const d = c.provenanceAnalyse.groupe.debut;
    if (d > 0) assert.equal(ETATS.reel.lexique[c.mots[d]].role, 'interrogatif', phrase);
  }
});

// =================================================================================================
// F. OBSERVATION : la provenance est COPIÉE dans observationsLangage
// =================================================================================================
async function mondeLangage() {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'fait', relation: 'fait' });
  await apprendreRelation(esprit, { mot: 'manteau', relation: 'manteau' });
  await apprendreFait(esprit, { sujet: 'moi', relation: 'manteau', valeur: 'un manteau bleu' });
  const observateur = creerObservateurLangage({
    enregistrer: (d) => enregistrerObservationLangage(magasin, d),
    rattacher: (l, e) => rattacherObservationLangage(magasin, l, e),
  });
  const deps = (extra = {}) => ({
    assurerEsprit: async () => esprit,
    journaliser: async () => [101, 102],
    enregistrerExperience: async () => ({ id: 'exp-1' }),
    ajouterInterpretation: async () => ({}),
    apresNouvelleExperience: async () => ({}),
    ...extra,
  });
  return { magasin, esprit, observateur, deps };
}

test('F1. la ligne d\'observation d\'un message sans « ? » porte la provenance exacte ; texte + provenance suffisent (aucun lexique consulté)', async () => {
  const m = await mondeLangage();
  const texte = 'zorblax qwerty je plumf en fait blorp';
  const retour = await tenterPontLangage(texte, m.deps({ observer: m.observateur }));
  assert.equal(retour, null, 'le comportement du pont est inchangé (message sans « ? »)');
  const [ligne] = await m.magasin.lireTout(T);
  assert.deepEqual(ligne.provenanceAnalyse, {
    groupe: { debut: 0 }, type: null, sujet: { debut: 2, longueur: 1 }, relation: [{ debut: 5, longueur: 1 }], ecartees: [],
  });
  // Relecture honnête, APRÈS coup, sans moteur ni lexique : seulement la ligne stockée + le découpeur.
  const mots = decouper(ligne.texte);
  assert.equal(mots[ligne.provenanceAnalyse.sujet.debut], 'je');
  assert.equal(mots[ligne.provenanceAnalyse.relation[0].debut], 'fait');
  assert.equal(ligne.provenanceAnalyse.groupe.debut, 0);
  // ... même si le lexique change plus tard.
  const autre = await chargerEsprit(magasinMemoireVive());
  assert.notDeepEqual(autre.lexique.fait, m.esprit.lexique.fait);
  assert.equal(mots[ligne.provenanceAnalyse.sujet.debut], 'je');
});

test('F2. la copie stockée est une copie JSON simple : ni gelée ni partagée avec la compréhension', async () => {
  const m = await mondeLangage();
  const analyse = repondre(m.esprit, 'je veux un fait');
  const poignee = await m.observateur('je veux un fait', analyse, null);
  assert.ok(poignee);
  const [ligne] = await m.magasin.lireTout(T);
  assert.deepEqual(ligne.provenanceAnalyse, JSON.parse(JSON.stringify(analyse.comprehension.provenanceAnalyse)));
  assert.notStrictEqual(ligne.provenanceAnalyse, analyse.comprehension.provenanceAnalyse);
  assert.ok(!Object.isFrozen(ligne.provenanceAnalyse));
  ligne.provenanceAnalyse.groupe.debut = 99;
  assert.equal(analyse.comprehension.provenanceAnalyse.groupe.debut, 0);
});

test('F3. les champs historiques de la ligne sont exactement ceux de v0.63.0 + le seul champ nouveau `provenanceAnalyse`', async () => {
  const m = await mondeLangage();
  await tenterPontLangage('je dis que fait', m.deps({ observer: m.observateur }));
  const [ligne] = await m.magasin.lireTout(T);
  assert.deepEqual(Object.keys(ligne).sort(), [
    'etatComprendre', 'etatRepondre', 'horodatage', 'id', 'idTrace', 'motsInconnus', 'provenanceAnalyse',
    'referenceMemoire', 'relation', 'relationsNommees', 'sujet', 'texte', 'type',
  ].sort());
});

test('F8. l\'observateur transmet à `enregistrer` une COPIE : ni la même référence que la compréhension, ni gelée, ni partagée', async () => {
  const c = comprendre('zorblax qwerty je plumf en fait blorp', ETATS.reel);
  const resultat = { etat: c.etat, comprehension: c };
  const recus = [];
  const observateur = creerObservateurLangage({ enregistrer: async (d) => { recus.push(d); return { id: 'x' }; }, rattacher: async () => ({}) });
  await observateur('zorblax qwerty je plumf en fait blorp', resultat, null);
  assert.equal(recus.length, 1);
  const copie = recus[0].provenanceAnalyse;
  assert.deepEqual(copie, c.provenanceAnalyse);
  assert.notEqual(copie, c.provenanceAnalyse);
  assert.ok(!Object.isFrozen(copie));
  assert.notEqual(copie.sujet, c.provenanceAnalyse.sujet);
  assert.notEqual(copie.relation, c.provenanceAnalyse.relation);
  assert.notEqual(copie.relation[0], c.provenanceAnalyse.relation[0]);
});

test('F4. sans provenance fournie, la ligne n\'a PAS la clé (forme de v0.63.0) ; avec provenance mal formée, rien n\'est écrit', async () => {
  const magasin = magasinMemoireVive();
  const base = { texte: 'x', etatComprendre: 'incompris', etatRepondre: 'incompris', type: 'affirmation', motsInconnus: ['x'], relationsNommees: [] };
  const ancienne = await enregistrerObservationLangage(magasin, base);
  assert.equal(Object.prototype.hasOwnProperty.call(ancienne, 'provenanceAnalyse'), false);
  const valide = { groupe: { debut: 0 }, type: null, sujet: null, relation: null, ecartees: [] };
  const ok = await enregistrerObservationLangage(magasin, { ...base, provenanceAnalyse: valide });
  assert.deepEqual(ok.provenanceAnalyse, valide);
  const mauvaises = [
    null, 3, [], {}, { ...valide, groupe: { debut: -1 } }, { ...valide, groupe: { debut: 1.5 } }, { ...valide, type: {} },
    { ...valide, sujet: { debut: 0, longueur: 0 } }, { ...valide, relation: [] }, { ...valide, relation: [{ debut: 0 }] },
    { ...valide, ecartees: null }, { ...valide, ecartees: [{ debut: 0, longueur: 1, valeur: 3, raison: 'ambigue' }] },
    { ...valide, ecartees: [{ debut: 0, longueur: 1, valeur: 'est', raison: '' }] },
  ];
  const avant = (await magasin.lireTout(T)).length;
  for (const mauvaise of mauvaises) {
    await assert.rejects(() => enregistrerObservationLangage(magasin, { ...base, provenanceAnalyse: mauvaise }), /provenanceAnalyse/);
  }
  assert.equal((await magasin.lireTout(T)).length, avant, 'aucune écriture partielle');
});

test('F5. une compréhension SANS provenance (ancien moteur injecté) est observée comme avant : ligne sans la clé, pas d\'échec', async () => {
  const magasin = magasinMemoireVive();
  const observateur = creerObservateurLangage({ enregistrer: (d) => enregistrerObservationLangage(magasin, d), rattacher: async () => ({}) });
  const resultat = { etat: 'partiel', comprehension: { etat: 'partiel', type: 'affirmation', sujet: 'moi', relation: null, mots: ['je'], motsInconnus: [], relationsNommees: [] } };
  await observateur('je', resultat, null);
  const [ligne] = await magasin.lireTout(T);
  assert.equal(ligne.texte, 'je');
  assert.equal(Object.prototype.hasOwnProperty.call(ligne, 'provenanceAnalyse'), false);
});

test('F6. le rattachement au journal réécrit la même ligne en CONSERVANT la provenance', async () => {
  const m = await mondeLangage();
  const retour = await tenterPontLangage('Quel est mon manteau ?', m.deps({ observer: m.observateur }));
  assert.equal(retour.local, true);
  const [ligne] = await m.magasin.lireTout(T);
  assert.deepEqual(ligne.referenceMemoire, { idQuestion: 101, idReponse: 102 });
  assert.ok(ligne.provenanceAnalyse && ligne.provenanceAnalyse.type && ligne.provenanceAnalyse.type.longueur === 1);
  assert.equal(decouper(ligne.texte)[ligne.provenanceAnalyse.type.debut], 'quel');
});

test('F7. les anciennes lignes (sans provenance) restent valides : stockées telles quelles, rattachables, jamais reconstruites', async () => {
  const magasin = magasinMemoireVive();
  const ancienne = { id: 'observation-langage-1790000000000-1', horodatage: '2026-10-04T10:52:01.000Z', texte: 'salut', etatComprendre: 'partiel', etatRepondre: 'partiel', type: 'affirmation', sujet: null, relation: null, motsInconnus: ['salut'], relationsNommees: [], idTrace: null, referenceMemoire: null };
  await magasin.ecrire(T, ancienne);
  const rattachee = await rattacherObservationLangage(magasin, ancienne, { idQuestion: 1, idReponse: 2 });
  assert.equal(Object.prototype.hasOwnProperty.call(rattachee, 'provenanceAnalyse'), false);
  assert.deepEqual((await magasin.lireTout(T))[0], { ...ancienne, referenceMemoire: { idQuestion: 1, idReponse: 2 } });
});

// =================================================================================================
// G. PASSIVITÉ : la provenance ne s'écrit nulle part ailleurs et ne change aucun comportement du pont
// =================================================================================================
test('G1. expériences : les données d\'interprétation écrites par le pont (voie « ? » COMPRIS et voie tentative PARTIEL) ne contiennent PAS la provenance', async () => {
  const m = await mondeLangage();
  const interpretations = [];
  const deps = m.deps({ ajouterInterpretation: async (id, i) => { interpretations.push(i); return { id }; } });
  const compris = await tenterPontLangage('Quel est mon manteau ?', { ...deps, observer: m.observateur });
  assert.equal(compris.laboratoire, true);
  const partiel = await tenterPontLangage('Quel est mon zorblax ?', { ...deps, observer: m.observateur });
  assert.ok(partiel.tentative);
  await enregistrerExperienceTentativeEchouee('Quel est mon zorblax ?', partiel.tentative, { texte: 'Gemini', idQuestion: 3, idReponse: 4, dateQuestion: '2026-10-04T10:00:00.000Z' }, {
    enregistrerExperience: async () => ({ id: 'exp-2' }),
    ajouterInterpretation: async (id, i) => { interpretations.push(i); return { id }; },
  });
  assert.equal(interpretations.length, 2);
  for (const i of interpretations) {
    assert.deepEqual(Object.keys(i.donnees).sort(), ['etat', 'mots', 'motsInconnus', 'relation', 'relationsNommees', 'sujet', 'type']);
    assert.ok(!JSON.stringify(i).includes('provenance'));
  }
});

test('G2. le pont renvoie EXACTEMENT les mêmes retours avec et sans observateur (provenance incluse dans l\'observateur)', async () => {
  const textes = ['Quel est mon manteau ?', 'Quel est mon zorblax ?', 'zorblax qwerty je plumf en fait blorp', 'comment tu t\'appelles du coup', 'je veux avoir et faire ?', ''];
  for (const t of textes) {
    const sans = await mondeLangage();
    const avec = await mondeLangage();
    const a = await tenterPontLangage(t, sans.deps());
    const b = await tenterPontLangage(t, avec.deps({ observer: avec.observateur }));
    assert.deepEqual(JSON.parse(JSON.stringify(b)), JSON.parse(JSON.stringify(a)), t);
  }
});

test('G3. une panne de la copie de provenance (écriture qui lève) ne change ni le retour du pont ni le tour', async () => {
  const m = await mondeLangage();
  const observateur = creerObservateurLangage({ enregistrer: async () => { throw new Error('disque plein'); }, rattacher: async () => ({}) });
  const retour = await tenterPontLangage('Quel est mon manteau ?', m.deps({ observer: observateur }));
  assert.equal(retour.local, true);
  assert.equal((await m.magasin.lireTout(T)).length, 0);
});

// =================================================================================================
// H. SAUVEGARDE : ni version de base ni schéma à monter (inspection), aller-retour, compatibilité
// =================================================================================================
test('H1. DÉCISION INSPECTÉE : aucune montée PAR CETTE ÉTAPE (v0.63.1) -- l\'état courant est VERSION_BASE 15 / SCHEMA_SAUVEGARDE 5 depuis v0.63.16 (même table, même clé, lignes libres)', () => {
  assert.equal(VERSION_BASE, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
  assert.equal(SCHEMA_SAUVEGARDE, 7); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
});

test('H2. export / import : une ligne AVEC provenance et une ligne ANCIENNE (sans) font l\'aller-retour à l\'identique, empreinte valide', async () => {
  const magasin = magasinMemoireVive();
  const base = { texte: 'a', etatComprendre: 'incompris', etatRepondre: 'incompris', type: 'affirmation', motsInconnus: ['a'], relationsNommees: [] };
  const avec = await enregistrerObservationLangage(magasin, { ...base, texte: 'avec', provenanceAnalyse: { groupe: { debut: 0 }, type: null, sujet: { debut: 0, longueur: 1 }, relation: [{ debut: 1, longueur: 1 }], ecartees: [{ debut: 2, longueur: 1, valeur: 'est', raison: 'structurelle' }] } });
  const sans = await enregistrerObservationLangage(magasin, { ...base, texte: 'sans' });
  const memoire = creerMemoire(creerMagasinMemoire());
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage: magasin, idNaissance: 'id', versionAppli: '0.63.1', maintenant: new Date('2026-10-04T12:00:00Z') });
  assert.equal(fichier.objet.schema, 7); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (base 17, schéma 7)
  assert.deepEqual(fichier.objet.donnees.langage[T], [avec, sans]);
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lu.donnees });
  assert.deepEqual(await neuf.lireTout(T), [avec, sans]);
});

test('H3. une sauvegarde de v0.63.0 (schéma 4, lignes sans provenance) reste importable ; une provenance modifiée dans le fichier est détectée', async () => {
  const magasin = magasinMemoireVive();
  const ligne = await enregistrerObservationLangage(magasin, { texte: 'a', etatComprendre: 'incompris', etatRepondre: 'incompris', type: 'affirmation', motsInconnus: ['a'], relationsNommees: [] });
  const fichier = await construireSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: magasin, idNaissance: 'id', versionAppli: '0.63.0', maintenant: new Date('2026-10-04T12:00:00Z') });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  assert.deepEqual(lu.donnees.langage[T], [ligne]);
  const avec = await enregistrerObservationLangage(magasinMemoireVive(), { texte: 'b', etatComprendre: 'incompris', etatRepondre: 'incompris', type: 'affirmation', motsInconnus: ['b'], relationsNommees: [], provenanceAnalyse: { groupe: { debut: 0 }, type: null, sujet: null, relation: null, ecartees: [] } });
  const m2 = magasinMemoireVive();
  await m2.ecrire(T, avec);
  const f2 = await construireSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: m2, idNaissance: 'id', versionAppli: '0.63.1', maintenant: new Date('2026-10-04T12:00:00Z') });
  const obj = JSON.parse(f2.contenu);
  obj.donnees.langage[T][0].provenanceAnalyse.groupe.debut = 7;
  const abime = await lireSauvegardeComplete(JSON.stringify(obj), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(abime.ok, false);
  assert.match(abime.erreur, /empreinte/);
  obj.empreinte = await empreinte(JSON.stringify(obj.donnees));
  assert.equal((await lireSauvegardeComplete(JSON.stringify(obj), { tablesMemoire: TABLES_MEMOIRE })).ok, true);
});

// =================================================================================================
// I. DORMANCE DÉCISIONNELLE (statique) : seule la production de la provenance, sa copie et sa validation la nomment
// =================================================================================================
function fichiersJS(dossier) {
  const sortie = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiersJS(chemin));
    else if (nom.endsWith('.js')) sortie.push(chemin);
  }
  return sortie;
}

test('I1. dans app/, SEULS comprendre.js (production), pont.js (copie) et connaissances.js (validation/stockage) nomment la provenance', () => {
  const noms = fichiersJS(APP)
    .filter((f) => sansCommentaires(readFileSync(f, 'utf8')).includes('provenanceAnalyse'))
    .map((f) => relative(APP, f).split(sep).join('/'))
    .sort();
  assert.deepEqual(noms, ['langage/comprendre.js', 'langage/connaissances.js', 'langage/pont.js']);
});

test('I2. comprendre.js ne fait que PRODUIRE la provenance (création, gel, définition de la propriété) : aucune lecture dans une décision', () => {
  const lignes = sansCommentaires(lire('langage', 'comprendre.js')).split('\n').filter((l) => l.includes('provenanceAnalyse'));
  assert.ok(lignes.length >= 6);
  const creation = /(const provenanceAnalyse = \{|Object\.freeze\(provenanceAnalyse(\.(groupe|type|sujet|ecartees))?\)|provenanceAnalyse\.(type|sujet|relation|ecartees)\b.*(Object\.freeze|forEach)|provenanceAnalyse\.(relation|ecartees)\.forEach\(Object\.freeze\)|Object\.defineProperty\(resultat, 'provenanceAnalyse')/;
  for (const l of lignes) assert.match(l, creation, `ligne inattendue : ${l.trim()}`);
  assert.match(lire('langage', 'comprendre.js'), /Object\.defineProperty\(resultat, 'provenanceAnalyse', \{ value: provenanceAnalyse, enumerable: false, writable: false, configurable: false \}\)/);
});

test('I3. pont.js ne LIT la provenance que dans la fabrique d\'observateur, pour la copier -- jamais dans tenterPontLangage', () => {
  const pont = sansCommentaires(lire('langage', 'pont.js'));
  const lignes = pont.split('\n').filter((l) => l.includes('provenanceAnalyse') || l.includes('ProvenanceAnalyse'));
  assert.equal(lignes.length, 2, lignes.join('\n'));
  assert.match(pont, /provenanceAnalyse: copierProvenanceAnalyse\(c\.provenanceAnalyse\)/);
  const debutPont = pont.indexOf('export async function tenterPontLangage');
  const finPont = pont.indexOf('function copierProvenanceAnalyse');
  assert.ok(debutPont >= 0 && finPont > debutPont);
  assert.ok(!pont.slice(debutPont, finPont).includes('rovenance'), 'tenterPontLangage ne nomme pas la provenance');
});

test('I4. positions : le découpeur est épinglé (la provenance référence SES tokens) -- accents retirés, apostrophe et tiret séparent', () => {
  assert.deepEqual(decouper("c'est né, peut-être où j'ai"), ['c', 'est', 'ne', 'peut', 'etre', 'ou', 'j', 'ai']);
});

test('I5. main.js et esprit.js ne sont pas touchés par cette version : aucun ne nomme la provenance', () => {
  for (const f of [['main.js'], ['langage', 'esprit.js'], ['langage', 'ecran.js'], ['langage', 'induction.js'], ['langage', 'composition.js']]) {
    assert.ok(!lire(...f).includes('provenanceAnalyse'), f.join('/'));
  }
});
// === FIN_TEST_PROVENANCE_ANALYSE ===
