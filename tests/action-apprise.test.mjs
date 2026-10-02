// === DEBUT_TEST_ACTION_APPRISE ===
// v0.38.0 — DÉCISION CHATGPT « LOT B2 : ACTION INTERNE APPRISE » (02/10), deuxième des trois lots de
// la primitive B. B2 construit la couche générale qui mémorise : SQUELETTE APPRIS (réutilise B1,
// extraction.js) + ASSOCIATION DES VARIABLES À DES RÔLES + CAPACITÉ INTERNE AUTORISÉE (registre
// fermé, première entrée « confrontation »). AUCUN raccord à comprendre()/repondre() : ce fichier
// n'importe donc jamais comprendre.js, et teste la reconnaissance/invocation HORS CONVERSATION,
// directement sur des chaînes artificielles.
//
// Domaine ARTIFICIEL neutre partout (zconfronte/zorbo/zkelmi/zcouleur...), comme pour tous les
// chantiers précédents de ce projet — aucune dépendance à un mot français particulier.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { apprendreAction } from '../app/langage/connaissances.js';
import { confronter } from '../app/langage/confrontation.js';
import { CAPACITES } from '../app/langage/registre.js';
import { evaluerAction, invoquerAction, reconnaitreActions, reconnaitreEtInvoquer } from '../app/langage/action.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

// ---------------------------------------------------------------------------------------------
// REGISTRE FERMÉ
// ---------------------------------------------------------------------------------------------
// Élargi le 02/10 (décision ChatGPT « PROCHAINE CAPACITÉ GÉNÉRALE DE RAISONNEMENT », v0.41) : deux
// nouvelles capacités, « proprietesCommunes » et « recherche » (selection.js) — voir
// tests/selection-action.test.mjs pour leur reconnaissance/invocation détaillée.
test('registre : exactement les trois capacités exposées, avec leurs rôles exacts', () => {
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['confrontation', 'proprietesCommunes', 'recherche']);
  assert.deepEqual([...CAPACITES.confrontation.roles].sort(), ['relation', 'sujetA', 'sujetB']);
  assert.deepEqual([...CAPACITES.proprietesCommunes.roles].sort(), ['sujetA', 'sujetB']);
  assert.deepEqual([...CAPACITES.recherche.roles].sort(), ['relation', 'valeur']);
});

test('registre : objet fermé, aucune capacité ne peut être ajoutée depuis l\'extérieur', () => {
  assert.ok(Object.isFrozen(CAPACITES));
  try { CAPACITES.nimportequoi = { roles: [], invoquer: () => {} }; } catch { /* strict mode : throw attendu, toléré */ }
  assert.deepEqual(Object.keys(CAPACITES).sort(), ['confrontation', 'proprietesCommunes', 'recherche'], 'aucune capacité supplémentaire ne doit avoir été ajoutée');
});

// ---------------------------------------------------------------------------------------------
// OPÉRATION INEXISTANTE → REFUS
// ---------------------------------------------------------------------------------------------
test('evaluerAction : opération absente du registre → refus explicite', () => {
  const r = evaluerAction({
    operation: 'zoperation-inconnue',
    roles: ['sujetA', 'relation', 'sujetB'],
    exemples: ['zact zorbo zcouleur zbleu', 'zact ztoro ztaille zrouge'],
  });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'operation_inconnue');
});

// ---------------------------------------------------------------------------------------------
// RÔLES EXACTS → ACCEPTÉ / RÔLE MANQUANT / SUPPLÉMENTAIRE / MAL ORTHOGRAPHIÉ → REFUS
// ---------------------------------------------------------------------------------------------
const EXEMPLES_BASE = [
  'zact zorbo zcouleur zbleu',
  'zact ztoro zcouleur zbleu',
  'zact zorbo ztaille zbleu',
  'zact zorbo zcouleur zrouge',
];

test('evaluerAction : rôles exacts (sujetA, relation, sujetB) → accepté', () => {
  const r = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'], exemples: EXEMPLES_BASE });
  assert.equal(r.ok, true);
  assert.equal(r.statut, 'validee');
});

test('evaluerAction : rôle manquant (sujetB absent) → refus', () => {
  const r = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation'], exemples: EXEMPLES_BASE });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'roles_incorrects');
});

test('evaluerAction : rôle supplémentaire (en trop par rapport au registre) → refus', () => {
  const r = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB', 'enTrop'], exemples: EXEMPLES_BASE });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'roles_incorrects');
});

test('evaluerAction : rôle mal orthographié (jamais corrigé silencieusement) → refus', () => {
  const r = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relasion', 'sujetB'], exemples: EXEMPLES_BASE });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'roles_incorrects');
});

test('evaluerAction : rôles dupliqués (même nom utilisé deux fois) → refus', () => {
  const r = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'sujetA', 'sujetB'], exemples: EXEMPLES_BASE });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'roles_dupliques');
});

// ---------------------------------------------------------------------------------------------
// EXTRACTION B1 CORRECTEMENT CONVERTIE EN ARGUMENTS NOMMÉS + INVOCATION IDENTIQUE À L'APPEL DIRECT DE A
// ---------------------------------------------------------------------------------------------
test('invoquerAction : arguments extraits correctement mappés aux rôles nommés, résultat identique à un appel direct de confronter()', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  const { objet: action } = await (async () => {
    const magasin = magasinMemoireVive();
    const evalue = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'], exemples: EXEMPLES_BASE });
    return apprendreAction(magasin, { ...evalue, operation: 'confrontation' });
  })();
  assert.equal(action.statut, 'validee');

  const entree = 'zact zorbo zcouleur zkelmi';
  const r = invoquerAction(action, esprit, entree);
  assert.equal(r.ok, true);

  const attendu = confronter(esprit, { sujetA: 'zorbo', cheminA: ['zcouleur'], sujetB: 'zkelmi', cheminB: ['zcouleur'] });
  assert.deepEqual(r.resultat, attendu);
  assert.equal(r.resultat.etat, 'egal');
});

// ---------------------------------------------------------------------------------------------
// ACTION INCERTAINE PERSISTÉE MAIS JAMAIS INVOCABLE + NOUVEL EXEMPLE LEVANT L'INCERTITUDE
// ---------------------------------------------------------------------------------------------
test('action incertaine (exemples insuffisants pour distinguer les rôles) : persistée, mais jamais invocable', async () => {
  const magasin = magasinMemoireVive();
  const evalue1 = evaluerAction({
    operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'],
    exemples: ['zact zorbo zcouleur zbleu', 'zact ztoro ztaille zrouge'], // les 3 positions varient simultanément : aucune paire distinguée
  });
  assert.equal(evalue1.ok, true);
  assert.equal(evalue1.statut, 'incertaine', 'précondition du test : ces deux exemples seuls ne distinguent aucune paire de rôles');

  const { objet: action } = await apprendreAction(magasin, { ...evalue1, operation: 'confrontation' });
  assert.equal(action.statut, 'incertaine');

  const { esprit } = await nouvelEsprit();
  const r = invoquerAction(action, esprit, 'zact zorbo zcouleur zbleu');
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'incertaine', 'une action incertaine n\'est jamais invocable, même si l\'entrée correspond structurellement');

  // Une action incertaine ne doit également jamais ressortir d'une reconnaissance (B3 l'utilisera).
  const reco = reconnaitreActions([action], 'zact zorbo zcouleur zbleu');
  assert.equal(reco.etat, 'aucune');
});

test('un nouvel exemple peut lever l\'incertitude : la même action, réenseignée avec plus d\'exemples, redevient validée', async () => {
  const magasin = magasinMemoireVive();
  const evalue1 = evaluerAction({
    operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'],
    exemples: ['zact zorbo zcouleur zbleu', 'zact ztoro ztaille zrouge'],
  });
  const { objet: incertaine } = await apprendreAction(magasin, { ...evalue1, operation: 'confrontation' });
  assert.equal(incertaine.statut, 'incertaine');

  // Deux exemples supplémentaires, chacun ne faisant varier qu'UNE seule position par rapport au
  // premier exemple déjà connu : lève l'ambiguïté sur les trois paires de rôles.
  const exemplesFusionnes = [...incertaine.exemples, { entree: 'zact ztoro zcouleur zbleu' }, { entree: 'zact zorbo ztaille zbleu' }];
  const evalue2 = evaluerAction({
    operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'],
    exemples: exemplesFusionnes.map((e) => e.entree),
  });
  assert.equal(evalue2.statut, 'validee', 'les exemples supplémentaires doivent suffire à distinguer les trois rôles');

  const { objet: validee } = await apprendreAction(magasin, { ...evalue2, operation: 'confrontation' });
  assert.equal(validee.statut, 'validee');
  assert.equal(validee.id, incertaine.id, 'la même action est mise à jour en place, jamais dupliquée');
});

// ---------------------------------------------------------------------------------------------
// DEUX ACTIONS VALIDÉES CORRESPONDANT À LA MÊME ENTRÉE → AMBIGUÏTÉ EXPLICITE
// ---------------------------------------------------------------------------------------------
test('deux actions VALIDÉES, de squelettes différents, correspondant toutes deux à la même entrée → abstention explicite, jamais "première trouvée"', async () => {
  const magasin = magasinMemoireVive();
  // Squelette 1 : seule l'ancre de POSITION 0 ("zconfronte") compte.
  const evalue1 = evaluerAction({
    operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'],
    exemples: [
      'zconfronte zorbo zcouleur zbleu',
      'zconfronte ztoro zcouleur zbleu',
      'zconfronte zorbo ztaille zbleu',
      'zconfronte zorbo zcouleur zrouge',
    ],
  });
  assert.equal(evalue1.statut, 'validee');
  const { objet: action1 } = await apprendreAction(magasin, { ...evalue1, operation: 'confrontation' });

  // Squelette 2 : seule l'ancre de POSITION 3 ("zkelmi") compte — un squelette structurellement
  // DIFFÉRENT du premier (ancres différentes), mais qui peut matcher la MÊME entrée par coïncidence.
  const evalue2 = evaluerAction({
    operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'],
    exemples: [
      'zalpha zorbo2 zcouleur2 zkelmi',
      'zbeta zorbo2 zcouleur2 zkelmi',
      'zalpha ztoro2 zcouleur2 zkelmi',
      'zalpha zorbo2 ztaille2 zkelmi',
    ],
  });
  assert.equal(evalue2.statut, 'validee');
  const { objet: action2 } = await apprendreAction(magasin, { ...evalue2, operation: 'confrontation' });

  const entreeAmbigue = 'zconfronte zorbo zcouleur zkelmi'; // satisfait l'ancre du squelette 1 (pos0) ET celle du squelette 2 (pos3)
  const reco = reconnaitreActions([action1, action2], entreeAmbigue);
  assert.equal(reco.etat, 'ambigu');
  assert.equal(reco.actions.length, 2);

  const resultatInvocation = reconnaitreEtInvoquer([action1, action2], await nouvelEsprit().then((x) => x.esprit), entreeAmbigue);
  assert.equal(resultatInvocation.etat, 'ambigu', 'reconnaitreEtInvoquer ne doit JAMAIS invoquer en cas d\'ambiguïté');
});

// ---------------------------------------------------------------------------------------------
// PERSISTANCE / RECHARGEMENT
// ---------------------------------------------------------------------------------------------
test('persistance : une action apprise reste identique après relecture du magasin (simulation de rechargement)', async () => {
  const magasin = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'], exemples: EXEMPLES_BASE });
  const { objet: action } = await apprendreAction(magasin, { ...evalue, operation: 'confrontation' });

  const relues = await magasin.lireTout('actions');
  const relue = relues.find((a) => a.id === action.id);
  assert.ok(relue);
  assert.deepEqual(relue, action);

  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  const r = invoquerAction(relue, esprit, 'zact zorbo zcouleur zkelmi');
  assert.equal(r.ok, true);
  assert.equal(r.resultat.etat, 'egal');
});

// ---------------------------------------------------------------------------------------------
// RÉENSEIGNEMENT VERSIONNÉ
// ---------------------------------------------------------------------------------------------
test('réenseignement : même squelette (mêmes ancres), rôles différents → remplacement versionné, historique conservé', async () => {
  const magasin = magasinMemoireVive();
  const evalue1 = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'], exemples: EXEMPLES_BASE });
  const { objet: v1 } = await apprendreAction(magasin, { ...evalue1, operation: 'confrontation' });

  // Même squelette EXACT (mêmes exemples, donc mêmes ancres), mais rôles réattribués différemment.
  const evalue2 = evaluerAction({ operation: 'confrontation', roles: ['relation', 'sujetA', 'sujetB'], exemples: EXEMPLES_BASE });
  const { objet: v2 } = await apprendreAction(magasin, { ...evalue2, operation: 'confrontation' });

  assert.notEqual(v2.id, v1.id, 'une nouvelle association de rôles crée une nouvelle entrée, jamais une écriture silencieuse sur l\'ancienne');
  assert.equal(v2.precedent, v1.id);

  const toutes = await magasin.lireTout('actions');
  const ancienne = toutes.find((a) => a.id === v1.id);
  assert.equal(ancienne.statut, 'remplacee', 'l\'ancienne version reste en base, jamais perdue');
  const nouvelle = toutes.find((a) => a.id === v2.id);
  assert.equal(nouvelle.statut, 'validee');
});

// ---------------------------------------------------------------------------------------------
// AUCUNE ÉCRITURE DANS esprit.faits LORS D'UNE INVOCATION
// ---------------------------------------------------------------------------------------------
test('invoquerAction : aucune écriture en mémoire, jamais', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  const magasinActions = magasinMemoireVive();
  const evalue = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'], exemples: EXEMPLES_BASE });
  const { objet: action } = await apprendreAction(magasinActions, { ...evalue, operation: 'confrontation' });

  const avant = JSON.stringify(await magasin.lireTout('faits'));
  invoquerAction(action, esprit, 'zact zorbo zcouleur zkelmi');
  const apres = JSON.stringify(await magasin.lireTout('faits'));
  assert.equal(apres, avant, 'une invocation ne doit jamais écrire de fait');
});

// ---------------------------------------------------------------------------------------------
// AUCUNE POSSIBILITÉ D'APPELER UNE FONCTION HORS REGISTRE
// ---------------------------------------------------------------------------------------------
test('invoquerAction : une action dont l\'opération ne figure plus/pas dans le registre est refusée, jamais appelée', async () => {
  const { esprit } = await nouvelEsprit();
  const actionForgee = {
    statut: 'validee', operation: 'zoperation-arbitraire-hors-registre',
    n: 4, roles: [{ position: 1, nom: 'sujetA' }, { position: 2, nom: 'relation' }, { position: 3, nom: 'sujetB' }],
    exemples: EXEMPLES_BASE.map((e) => ({ entree: e })),
  };
  const r = invoquerAction(actionForgee, esprit, 'zact zorbo zcouleur zkelmi');
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'operation_inconnue');
});

// === FIN_TEST_ACTION_APPRISE ===
