// === DEBUT_TEST_COMPOSITION ===
// v0.43 — DÉCISION CHATGPT « RÉFÉRENÇABILITÉ ET RÉUTILISATION SCALAIRE DES RÉSULTATS » (02/10),
// architecture B retenue (dernier résultat conservé PAR CAPACITÉ, jamais un historique ; deux
// mécanismes strictement séparés : conserver/référencer d'un côté, liaison apprise de l'autre ; une
// liaison n'invoque JAMAIS automatiquement une capacité cible). Nouvelle primitive INTERNE,
// indépendante du langage et du flux conversationnel (même discipline que tests/selection.test.mjs,
// tests/deduction.test.mjs) : AUCUN raccord à comprendre()/repondre() dans ce fichier.
//
// GÉNÉRALITÉ : les tests exercent PLUSIEURS paires différentes de capacités (confrontation↔deduction,
// et pas seulement un sens), pour vérifier que composition.js ne contient aucun raccord spécifique à
// une paire précise — il ne connaît que CAPACITES (registre.js) et les quadruplets fournis par
// l'appelant.
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zrole...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait, apprendreRegle } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { CAPACITES } from '../app/langage/registre.js';
import {
  evaluerLiaison, enregistrerResultat, valeurLiee, invoquerAvecLiaisons,
} from '../app/langage/composition.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return chargerEsprit(magasin);
}

// ---------------------------------------------------------------------------------------------
// evaluerLiaison — évaluation PURE, jamais de persistance (même principe que evaluerAction())
// ---------------------------------------------------------------------------------------------
test('evaluerLiaison : capacités et rôle réellement déclarés dans le registre → validée', () => {
  const r = evaluerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  assert.equal(r.ok, true);
});

test('evaluerLiaison : capacité source inconnue du registre fermé → refus explicite', () => {
  const r = evaluerLiaison({
    capaciteSource: 'zinexistante', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'capacite_source_inconnue');
});

test('evaluerLiaison : capacité cible inconnue du registre fermé → refus explicite', () => {
  const r = evaluerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'zinexistante', role: 'relation',
  });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'capacite_cible_inconnue');
});

test('evaluerLiaison : rôle absent des rôles déclarés par la capacité cible → refus explicite', () => {
  const r = evaluerLiaison({
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'zroleInexistant',
  });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'role_inconnu');
});

test('evaluerLiaison : champ manquant → refus explicite', () => {
  const r = evaluerLiaison({
    capaciteSource: 'deduction', champ: '', capaciteCible: 'confrontation', role: 'relation',
  });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'champ_manquant');
});

test('evaluerLiaison : généralité — fonctionne pour TOUTE paire de capacités déclarées dans le registre, jamais une paire câblée en dur', () => {
  for (const capaciteSource of Object.keys(CAPACITES)) {
    for (const capaciteCible of Object.keys(CAPACITES)) {
      for (const role of CAPACITES[capaciteCible].roles) {
        const r = evaluerLiaison({
          capaciteSource, champ: 'unChampQuelconque', capaciteCible, role,
        });
        assert.equal(r.ok, true, `${capaciteSource}.unChampQuelconque -> ${capaciteCible}.${role} devrait être évaluable`);
      }
    }
  }
});

// ---------------------------------------------------------------------------------------------
// enregistrerResultat / valeurLiee — MÉCANISMES STRICTEMENT SÉPARÉS : conserver ne consulte jamais
// esprit.liaisons, et l'existence d'une liaison seule ne lit jamais un résultat qu'on n'a pas encore
// enregistré ; architecture B : UN SEUL résultat par capacité, jamais un historique.
// ---------------------------------------------------------------------------------------------
test('enregistrerResultat : UN SEUL résultat gardé par capacité — le dernier efface le précédent', async () => {
  const esprit = await nouvelEsprit();
  enregistrerResultat(esprit, 'confrontation', { etat: 'egal', valeurA: 'zbleu', valeurB: 'zbleu' });
  enregistrerResultat(esprit, 'confrontation', { etat: 'different', valeurA: 'zrouge', valeurB: 'zbleu' });
  assert.deepEqual(esprit.derniersResultats.get('confrontation'), { etat: 'different', valeurA: 'zrouge', valeurB: 'zbleu' });
  assert.equal(esprit.derniersResultats.size, 1);
});

test('enregistrerResultat : conserver des résultats pour DEUX capacités différentes ne les mélange jamais', async () => {
  const esprit = await nouvelEsprit();
  enregistrerResultat(esprit, 'confrontation', { etat: 'egal', valeurA: 'zbleu', valeurB: 'zbleu' });
  enregistrerResultat(esprit, 'deduction', { resultat: 'zfroid', regle: {} });
  assert.equal(esprit.derniersResultats.get('confrontation').etat, 'egal');
  assert.equal(esprit.derniersResultats.get('deduction').resultat, 'zfroid');
});

test('valeurLiee : aucune liaison enseignée pour (capaciteCible, role) → abstention explicite', async () => {
  const esprit = await nouvelEsprit();
  esprit.liaisons = [];
  enregistrerResultat(esprit, 'deduction', { resultat: 'zfroid' });
  const r = valeurLiee(esprit, { capaciteCible: 'confrontation', role: 'relation' });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'aucune_liaison');
});

test('valeurLiee : liaison enseignée mais aucun résultat encore conservé pour sa capaciteSource → abstention explicite', async () => {
  const esprit = await nouvelEsprit();
  esprit.liaisons = [{
    statut: 'validee', capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  }];
  const r = valeurLiee(esprit, { capaciteCible: 'confrontation', role: 'relation' });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'aucun_resultat');
});

test('valeurLiee : champ désigné absent du résultat conservé → abstention explicite', async () => {
  const esprit = await nouvelEsprit();
  esprit.liaisons = [{
    statut: 'validee', capaciteSource: 'deduction', champ: 'zchampInexistant', capaciteCible: 'confrontation', role: 'relation',
  }];
  enregistrerResultat(esprit, 'deduction', { resultat: 'zfroid' });
  const r = valeurLiee(esprit, { capaciteCible: 'confrontation', role: 'relation' });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'champ_absent');
});

test('valeurLiee : champ désigné présent mais NON scalaire (liste/objet) → abstention explicite, jamais traité', async () => {
  const esprit = await nouvelEsprit();
  esprit.liaisons = [{
    statut: 'validee', capaciteSource: 'recherche', champ: 'sujets', capaciteCible: 'deduction', role: 'sujet',
  }];
  enregistrerResultat(esprit, 'recherche', { sujets: ['zorbo', 'zkelmi'] });
  const r = valeurLiee(esprit, { capaciteCible: 'deduction', role: 'sujet' });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'champ_non_scalaire');
});

test('valeurLiee : tout est réuni (liaison validée + résultat conservé + champ scalaire présent) → valeur transmise', async () => {
  const esprit = await nouvelEsprit();
  esprit.liaisons = [{
    statut: 'validee', capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  }];
  enregistrerResultat(esprit, 'deduction', { resultat: 'zcouleur' });
  const r = valeurLiee(esprit, { capaciteCible: 'confrontation', role: 'relation' });
  assert.equal(r.ok, true);
  assert.equal(r.valeur, 'zcouleur');
});

test('valeurLiee : une liaison NON validée (statut différent) est ignorée — jamais appliquée tant qu\'elle n\'est pas validée', async () => {
  const esprit = await nouvelEsprit();
  esprit.liaisons = [{
    statut: 'remplacee', capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  }];
  enregistrerResultat(esprit, 'deduction', { resultat: 'zcouleur' });
  const r = valeurLiee(esprit, { capaciteCible: 'confrontation', role: 'relation' });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'aucune_liaison');
});

test('la simple existence d\'une liaison validée et d\'un résultat conservé ne déclenche JAMAIS, à elle seule, une invocation : aucun effet de bord d\'enregistrerResultat() ni de la présence d\'une liaison', async () => {
  const esprit = await nouvelEsprit();
  esprit.liaisons = [{
    statut: 'validee', capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  }];
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  enregistrerResultat(esprit, 'deduction', { resultat: 'zcouleur' });
  // Rien d'autre que enregistrerResultat() et la présence de la liaison n'a été appelé : si un
  // orchestrateur implicite existait, esprit.derniersResultats contiendrait déjà une entrée
  // 'confrontation' -- ce n'est JAMAIS le cas tant que invoquerAvecLiaisons() n'a pas été appelée.
  assert.equal(esprit.derniersResultats.has('confrontation'), false);
});

// ---------------------------------------------------------------------------------------------
// invoquerAvecLiaisons — la SEULE fonction qui invoque réellement, et seulement sur appel explicite
// ---------------------------------------------------------------------------------------------
test('invoquerAvecLiaisons : une valeur EXPLICITE pour un rôle a toujours priorité sur une liaison', async () => {
  const esprit = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  esprit.liaisons = [{
    statut: 'validee', capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  }];
  enregistrerResultat(esprit, 'deduction', { resultat: 'ztaille' }); // un champ volontairement DIFFÉRENT du rôle explicite ci-dessous
  const r = invoquerAvecLiaisons(esprit, {
    operation: 'confrontation',
    argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi', relation: 'zcouleur' },
  });
  assert.equal(r.ok, true);
  assert.equal(r.resultat.etat, 'egal'); // a bien comparé sur "zcouleur" (explicite), pas "ztaille" (la liaison)
});

test('invoquerAvecLiaisons : un rôle non fourni explicitement, résolu par une liaison validée → invocation réussie', async () => {
  const esprit = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(esprit, { role: 'zrole', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zcouleur' });
  esprit.liaisons = [{
    statut: 'validee', capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  }];
  const dRes = invoquerAvecLiaisons(esprit, { operation: 'deduction', argumentsExplicites: { sujet: 'zorbo', role: 'zrole' } });
  assert.equal(dRes.ok, true);
  assert.equal(dRes.resultat.resultat, 'zcouleur');

  const cRes = invoquerAvecLiaisons(esprit, {
    operation: 'confrontation',
    argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' }, // "relation" volontairement omis : doit venir de la liaison
  });
  assert.equal(cRes.ok, true);
  assert.equal(cRes.resultat.etat, 'egal'); // a bien comparé sur "zcouleur", transmis depuis le résultat de deduction
});

test('invoquerAvecLiaisons : rôle ni fourni explicitement ni résolu par une liaison → abstention explicite, jamais une invocation partielle', async () => {
  const esprit = await nouvelEsprit();
  esprit.liaisons = [];
  const r = invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' } });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'role_non_resolu');
  assert.equal(r.detail.role, 'relation');
});

test('invoquerAvecLiaisons : opération inconnue du registre → abstention explicite, jamais une erreur', async () => {
  const esprit = await nouvelEsprit();
  const r = invoquerAvecLiaisons(esprit, { operation: 'zinexistante', argumentsExplicites: {} });
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'operation_inconnue');
});

test('invoquerAvecLiaisons : enregistre automatiquement SON résultat (par capacité), utilisable par une liaison suivante — généralité sur une AUTRE paire', async () => {
  const esprit = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(esprit, { role: 'zrole2', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zrouge' });
  // Chaîne DIFFÉRENTE de celle testée ci-dessus : confrontation -> deduction (sens inverse), pour
  // vérifier que rien n'est spécifique à une seule paire ni à un seul sens.
  esprit.liaisons = [{
    statut: 'validee', capaciteSource: 'confrontation', champ: 'valeurA', capaciteCible: 'deduction', role: 'role',
  }];
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zrole2' });
  invoquerAvecLiaisons(esprit, { operation: 'confrontation', argumentsExplicites: { sujetA: 'zkelmi', sujetB: 'zkelmi', relation: 'zcouleur' } });
  const r = invoquerAvecLiaisons(esprit, { operation: 'deduction', argumentsExplicites: { sujet: 'zorbo' } });
  assert.equal(r.ok, true);
  assert.equal(r.resultat.resultat, 'zrouge');
});
// === FIN_TEST_COMPOSITION ===
