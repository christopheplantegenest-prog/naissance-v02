// === DEBUT_TEST_ACTION_ECRAN ===
// v0.39.0 — DÉCISION CHATGPT « LOT B3 : RACCORD CONVERSATIONNEL » (02/10), troisième et dernier lot de
// la primitive B (« action interne paramétrée apprise »). B1 (extraction.js) et B2 (action.js,
// registre.js, connaissances.js) existaient déjà, isolés de toute conversation. Ce fichier teste
// l'ORCHESTRATION (langage/ecran.js : confirmerAction, tenterReconnaissanceAction) bout en bout, sur
// le VRAI esprit partagé (chargerEsprit) — EXACTEMENT le même principe que
// tests/transformations-ecran.test.mjs pour tenterReconnaissanceTransformation().
//
// Domaine ARTIFICIEL neutre partout (zact/zorbo/ztoro/zcouleur/zbleu...), comme pour tous les
// chantiers de la primitive B (confrontation.test.mjs, action-apprise.test.mjs) : aucun mot français
// n'est jamais nécessaire à la reconnaissance ou à l'invocation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { evaluerAction } from '../app/langage/action.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});

function monter(magasin = magasinMemoireVive()) {
  // v0.39 — SANS appelerGemini (null, comme monterEcranLangage() le permet par défaut) : la réussite
  // de tenterReconnaissanceAction() ci-dessous, dans CHAQUE test, prouve qu'aucun accès réseau n'a
  // jamais été nécessaire, succès COMME abstention/ambiguïté — « jamais Gemini pour masquer l'échec
  // d'une action locale » (cadrage B3).
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  return { magasin, ecran };
}

// Un squelette à quatre exemples SUFFISAMMENT indépendants pour distinguer ses trois rôles dès le
// départ (statut 'validee') : sujetA (pos 1), relation (pos 2), sujetB (pos 3), zact en ancre (pos 0).
const EXEMPLES_VALIDES = [
  'zact zorbo zcouleur zbleu',
  'zact ztoro zcouleur zbleu',
  'zact zorbo ztaille zbleu',
  'zact zorbo zcouleur zrouge',
];
const ROLES_VALIDES = ['sujetA', 'relation', 'sujetB'];

// ============================================================================ 1. APPRENTISSAGE RÉEL
test('1. apprentissage réel d\'une action via le canal pédagogique (evaluerAction → confirmerAction), rien écrit avant confirmerAction', async () => {
  const { magasin, ecran } = monter();
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  assert.equal(evalue.ok, true);
  assert.equal(evalue.statut, 'validee');
  assert.deepEqual(await magasin.lireTout('actions'), [], 'evaluerAction() est pure : rien ne doit être écrit avant confirmerAction()');
  const conf = await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  assert.match(conf.explication, /J'ai appris/);
  const toutes = await magasin.lireTout('actions');
  assert.equal(toutes.length, 1);
  assert.equal(toutes[0].statut, 'validee');
});

// ============================================================================ 2. ACTION INCERTAINE NON UTILISÉE
test('2. action incertaine (exemples insuffisants pour distinguer les rôles) : persistée, mais jamais reconnue/utilisée', async () => {
  const { ecran } = monter();
  const evalue = evaluerAction({
    operation: 'confrontation',
    roles: ROLES_VALIDES,
    // Les 3 positions variables changent SIMULTANÉMENT entre les deux seuls exemples : aucune paire de
    // rôles n'est distinguée (même piège que action-apprise.test.mjs, B2).
    exemples: ['zact zorbo zcouleur zbleu', 'zact ztoro ztaille zrouge'],
  });
  assert.equal(evalue.statut, 'incertaine', 'précondition du test : ces deux exemples seuls ne distinguent aucune paire de rôles');
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  // Une entrée qui correspond pourtant littéralement au squelette appris ne doit JAMAIS être reconnue :
  // une action incertaine ne participe jamais à la reconnaissance (defense in depth, voir action.js).
  const r = await ecran.tenterReconnaissanceAction('zact zorbo zcouleur zbleu');
  assert.deepEqual(r, { reconnu: false });
});

// ============================================================================ 3. AJOUT D'EXEMPLES → VALIDATION
test('3. un nouvel exemple peut lever l\'incertitude : la même action, réenseignée avec plus d\'exemples, devient reconnaissable', async () => {
  const { ecran } = monter();
  const incertaine = evaluerAction({
    operation: 'confrontation', roles: ROLES_VALIDES, exemples: ['zact zorbo zcouleur zbleu', 'zact ztoro ztaille zrouge'],
  });
  assert.equal(incertaine.statut, 'incertaine');
  await ecran.confirmerAction({
    operation: 'confrontation', roles: incertaine.roles, n: incertaine.n, exemples: incertaine.exemples, statut: incertaine.statut,
  });
  assert.deepEqual(await ecran.tenterReconnaissanceAction('zact zorbo zcouleur zrouge'), { reconnu: false });
  // Deux exemples supplémentaires, chacun ne faisant varier qu'UNE seule position par rapport au
  // premier exemple de base : de quoi distinguer les trois rôles deux à deux.
  const exemplesFusionnes = [
    ...incertaine.exemples.map((e) => e.entree),
    'zact ztoro zcouleur zbleu',
    'zact zorbo ztaille zbleu',
  ];
  const valide = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: exemplesFusionnes });
  assert.equal(valide.statut, 'validee', 'les exemples supplémentaires doivent suffire à distinguer les trois rôles');
  const conf = await ecran.confirmerAction({
    operation: 'confrontation', roles: valide.roles, n: valide.n, exemples: valide.exemples, statut: valide.statut,
  });
  assert.match(conf.explication, /passe de « incertaine » à « validee »/);
  // Désormais reconnue : une phrase JAMAIS tapée avant (ni dans les 2 ni dans les 4 exemples).
  const r = await ecran.tenterReconnaissanceAction('zact zorbo zcouleur zjaune');
  assert.equal(r.reconnu, true);
});

// ============================================================================ 4/5. PHRASE NOUVELLE RECONNUE, EXTRACTION, INVOCATION — LES QUATRE ÉTATS
test('4. phrase nouvelle jamais enseignée → reconnue, extraction sujetA/sujetB/relation correcte, invocation confrontation → EGAL', async () => {
  const { ecran } = monter();
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(e, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'zbleu' });
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  // « zact zalpha zcouleur zbeta » : jamais tapée dans les exemples d'enseignement. sujetA=zalpha,
  // relation=zcouleur, sujetB=zbeta (ordre des rôles ['sujetA','relation','sujetB'] = ordre des
  // positions 1,2,3) -- zalpha et zbeta partagent la même zcouleur → egal.
  const r = await ecran.tenterReconnaissanceAction('zact zalpha zcouleur zbeta');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, true);
  assert.equal(r.texte, 'Résultat (confrontation locale) : égal.');
});

test('5a. DIFFÉRENT : deux sujets avec des valeurs distinctes pour la même relation', async () => {
  const { ecran } = monter();
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zalpha', relation: 'ztaille', valeur: 'zgrand' });
  await apprendreFait(e, { sujet: 'zbeta', relation: 'ztaille', valeur: 'zpetit' });
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  const r = await ecran.tenterReconnaissanceAction('zact zalpha ztaille zbeta');
  assert.equal(r.ok, true);
  assert.equal(r.texte, 'Résultat (confrontation locale) : différent.');
});

test('5b. INCONNU : aucune information pour l\'un des deux sujets (absence d\'information ≠ différence)', async () => {
  const { ecran } = monter();
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zalpha', relation: 'zvitesse', valeur: 'zrapide' });
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  const r = await ecran.tenterReconnaissanceAction('zact zalpha zvitesse zbeta');
  assert.equal(r.ok, true);
  assert.equal(r.texte, 'Résultat (confrontation locale) : inconnu.');
});

test('5c. CONFLIT : plusieurs valeurs persistées contradictoires pour un même sujet/relation', async () => {
  const { magasin, ecran } = monter();
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'zrouge' });
  await magasin.ecrire('faits', { cle: 'ligneA', sujet: 'zbeta', relation: 'zcouleur', valeur: 'zvert' });
  await magasin.ecrire('faits', { cle: 'ligneB', sujet: 'zbeta', relation: 'zcouleur', valeur: 'zjaune' });
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  // Rechargement nécessaire : les deux lignes de faits concurrentes écrites DIRECTEMENT dans le magasin
  // ci-dessus ne sont détectées comme conflit qu'au chargement (chargerEsprit), jamais recalculées à la
  // volée sur un esprit déjà en mémoire (même principe que confrontation.test.mjs, famille 4).
  const { ecran: ecranRecharge } = monter(magasin);
  const r = await ecranRecharge.tenterReconnaissanceAction('zact zalpha zcouleur zbeta');
  assert.equal(r.ok, true);
  assert.equal(r.texte, 'Résultat (confrontation locale) : conflit.');
});

// ============================================================================ 6. AUCUNE ACTION → COMPORTEMENT ANCIEN INCHANGÉ
test('6. aucune action apprise du tout → {reconnu:false}, jamais une erreur', async () => {
  const { ecran } = monter();
  assert.deepEqual(await ecran.tenterReconnaissanceAction('zact zalpha zcouleur zbeta'), { reconnu: false });
});

test('6b. une action apprise existe, mais la phrase ne correspond à aucun squelette connu → {reconnu:false}', async () => {
  const { ecran } = monter();
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  assert.deepEqual(await ecran.tenterReconnaissanceAction('une phrase totalement sans rapport'), { reconnu: false });
});

// ============================================================================ 7. DEUX ACTIONS COMPATIBLES → AMBIGUÏTÉ
test('7. deux actions VALIDÉES, de squelettes différents, correspondant toutes deux à la même entrée → abstention explicite, jamais "première trouvée"', async () => {
  const { ecran } = monter();
  const action1 = evaluerAction({
    operation: 'confrontation',
    roles: ['sujetA', 'relation', 'sujetB'],
    exemples: [
      'zconfronte zorbo zcouleur zbleu',
      'zconfronte ztoro zcouleur zbleu',
      'zconfronte zorbo ztaille zbleu',
      'zconfronte zorbo zcouleur zrouge',
    ],
  });
  assert.equal(action1.statut, 'validee');
  await ecran.confirmerAction({
    operation: 'confrontation', roles: action1.roles, n: action1.n, exemples: action1.exemples, statut: action1.statut,
  });
  const action2 = evaluerAction({
    operation: 'confrontation',
    roles: ['sujetA', 'sujetB', 'relation'],
    exemples: [
      'zalpha zorbo2 zcouleur2 zkelmi',
      'zbeta zorbo2 zcouleur2 zkelmi',
      'zalpha ztoro2 zcouleur2 zkelmi',
      'zalpha zorbo2 ztaille2 zkelmi',
    ],
  });
  assert.equal(action2.statut, 'validee');
  await ecran.confirmerAction({
    operation: 'confrontation', roles: action2.roles, n: action2.n, exemples: action2.exemples, statut: action2.statut,
  });
  // Satisfait l'ancre du squelette 1 (position 0 = « zconfronte ») ET celle du squelette 2 (position 3
  // = « zkelmi ») à la fois.
  const r = await ecran.tenterReconnaissanceAction('zconfronte zorbo zcouleur zkelmi');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'ambigu');
});

// ============================================================================ 8. PERSISTANCE APRÈS REDÉMARRAGE
test('8. persistance après redémarrage/rechargement (nouvel esprit sur le même magasin)', async () => {
  const magasin = magasinMemoireVive();
  const { ecran } = monter(magasin);
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(e, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'zbleu' });
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  const { ecran: ecranRedemarre } = monter(magasin); // même magasin, nouvel écran = équivaut à fermer/rouvrir
  const r = await ecranRedemarre.tenterReconnaissanceAction('zact zalpha zcouleur zbeta');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, true);
  assert.equal(r.texte, 'Résultat (confrontation locale) : égal.');
});

// ============================================================================ 9. AUCUNE FONCTION HORS REGISTRE INVOCABLE
test('9. une action persistée dont l\'opération ne figure pas (plus) dans le registre n\'est jamais invoquée via tenterReconnaissanceAction', async () => {
  const { magasin, ecran } = monter();
  // Ligne forgée directement dans le magasin (jamais produite par evaluerAction()/confirmerAction()) :
  // simule une action antérieure à un retrait de capacité, ou une corruption -- defense in depth, même
  // garde-fou que invoquerAction() (action.js, déjà testé en B2), exercé ici via le VRAI chemin
  // conversationnel (tenterReconnaissanceAction), jamais contourné.
  await magasin.ecrire('actions', {
    id: 'action-forgee',
    operation: 'operation_qui_n_existe_pas',
    roles: [{ position: 1, nom: 'sujetA' }, { position: 2, nom: 'relation' }, { position: 3, nom: 'sujetB' }],
    n: 4,
    exemples: EXEMPLES_VALIDES.map((e) => ({ entree: e })),
    statut: 'validee',
    origine: 'test',
    creee: new Date().toISOString(),
    modifiee: new Date().toISOString(),
  });
  const r = await ecran.tenterReconnaissanceAction('zact zalpha zcouleur zbeta');
  assert.equal(r.reconnu, true);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'operation_inconnue');
});

// ============================================================================ 10. AUCUNE ÉCRITURE EN MÉMOIRE LORS D'UNE INVOCATION
test('10. tenterReconnaissanceAction (succès comme ambiguïté) n\'écrit jamais dans esprit.faits', async () => {
  const { ecran } = monter();
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(e, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'zbleu' });
  const evalue = evaluerAction({ operation: 'confrontation', roles: ROLES_VALIDES, exemples: EXEMPLES_VALIDES });
  await ecran.confirmerAction({
    operation: 'confrontation', roles: evalue.roles, n: evalue.n, exemples: evalue.exemples, statut: evalue.statut,
  });
  const avant = e.faits.size;
  await ecran.tenterReconnaissanceAction('zact zalpha zcouleur zbeta');
  assert.equal(e.faits.size, avant);
});
// === FIN_TEST_ACTION_ECRAN ===
