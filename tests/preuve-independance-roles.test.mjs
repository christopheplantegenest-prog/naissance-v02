// === DEBUT_TEST_PREUVE_INDEPENDANCE_ROLES ===
// CHANTIER — PREUVE PURE D'INDÉPENDANCE STRUCTURELLE DES RÔLES (décision ChatGPT du 03/10/2026,
// implémentant le contrat décrit par le diagnostic « DIAGNOSTIC VALIDATION DU REJEU » du même jour).
// Domaine ARTIFICIEL neutre partout (zaccede/zorbo/zordre/zkelmi...), comme pour tous les chantiers
// précédents de ce projet.
//
// preuveIndependanceRoles() décrit, pour UNE paire (forme descriptive, capacité) et SA couverture
// réelle de traces, quelles paires de rôles variables ont été observées de manière structurellement
// distinguable l'une de l'autre -- en reproduisant la logique mathématique exacte de
// positionsDistinguees() (action.js), mais appliquée à l'agrégat d'une forme plutôt qu'aux exemples
// déclarés d'un enseignement. AUCUN choix, AUCUNE invocation, AUCUN score, AUCUNE décision.

import test from 'node:test';
import assert from 'node:assert/strict';
import { decrireStructure } from '../app/langage/extraction.js';
import { preuveIndependanceRoles } from '../app/langage/vue-traces.js';
import { evaluerAction } from '../app/langage/action.js';
import { CAPACITES } from '../app/langage/registre.js';

let compteurId = 0;
function traceAction(texteBrut, capacite, provenancePositions) {
  compteurId += 1;
  const t = {
    id: compteurId,
    sequence: compteurId,
    horodatage: '2000-01-01T00:00:00.000Z',
    capacite,
    voie: 'action',
    argumentsUtilises: {},
    provenanceArguments: {},
    resultat: { peuImporte: true },
    contexte: { texteBrut, tokens: [] },
  };
  if (provenancePositions !== undefined) t.provenancePositions = provenancePositions;
  return t;
}
function traceAncienne(texteBrut, capacite) {
  return traceAction(texteBrut, capacite, undefined); // provenancePositions absent -- trace antérieure à v0.53
}

// ---------------------------------------------------------------------------------------------
// A. FORME ENTIÈREMENT ANCRÉE → AUCUNE PREUVE D'INDÉPENDANCE REQUISE
// ---------------------------------------------------------------------------------------------
test('A. forme entièrement ancrée (doublon exact) → "aucune_preuve_requise", aucune paire, tous les rôles "position_ancree"', () => {
  const texte = 'zaccede zorbo zordre zkelmi';
  const t1 = traceAction(texte, 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction(texte, 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const rapport = decrireStructure([texte, texte]);
  assert.deepEqual(rapport.positionsVariables, [], 'précondition : doublon exact -> aucune position variable');

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces: [t1, t2], couvertureIds: [t1.id, t2.id] });
  assert.equal(r.etatGlobal, 'aucune_preuve_requise');
  assert.deepEqual(r.rolesVariablesExaminables, []);
  assert.deepEqual(r.paires, []);
  assert.deepEqual(r.rolesIgnores.map((x) => x.role).sort(), ['operateur', 'sujetA', 'sujetB']);
  for (const ignore of r.rolesIgnores) assert.equal(ignore.raison, 'position_ancree');
});

// ---------------------------------------------------------------------------------------------
// B. UN SEUL RÔLE VARIABLE → AUCUNE PAIRE À DISTINGUER
// ---------------------------------------------------------------------------------------------
test('B. un seul rôle sur une position variable → "aucune_paire_a_distinguer", aucune paire', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede zalpha zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const rapport = decrireStructure([t1.contexte.texteBrut, t2.contexte.texteBrut]);
  assert.deepEqual(rapport.positionsVariables, [1], 'précondition : seul sujetA (position 1) varie');

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces: [t1, t2], couvertureIds: [t1.id, t2.id] });
  assert.equal(r.etatGlobal, 'aucune_paire_a_distinguer');
  assert.deepEqual(r.rolesVariablesExaminables, [{ role: 'sujetA', position: 1 }]);
  assert.deepEqual(r.paires, []);
  assert.deepEqual(r.rolesIgnores.map((x) => x.role).sort(), ['operateur', 'sujetB']);
  for (const ignore of r.rolesIgnores) assert.equal(ignore.raison, 'position_ancree');
});

// ---------------------------------------------------------------------------------------------
// C. DEUX RÔLES VARIABLES, EXEMPLE CONTRASTÉ RÉEL → PAIRE DISTINGUÉE
// ---------------------------------------------------------------------------------------------
test('C. deux rôles variables avec une paire d\'exemples isolant chacun -> "distinguee"', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul change
  const t3 = traceAction('zaccede zorbo zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // operateur seul change
  const traces = [t1, t2, t3];
  const textes = traces.map((t) => t.contexte.texteBrut);
  const rapport = decrireStructure(textes);
  assert.deepEqual(rapport.positionsVariables, [1, 2], 'précondition : sujetA et operateur varient, sujetB reste ancré');

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(r.etatGlobal, 'paires_evaluees');
  assert.deepEqual(r.rolesVariablesExaminables, [{ role: 'operateur', position: 2 }, { role: 'sujetA', position: 1 }]);
  assert.equal(r.paires.length, 1);
  assert.equal(r.paires[0].etat, 'distinguee');
  assert.equal(r.paires[0].roleA, 'operateur');
  assert.equal(r.paires[0].roleB, 'sujetA');
  assert.equal(r.paires[0].tracesUtilisees, 3);
});

// ---------------------------------------------------------------------------------------------
// D. DEUX RÔLES VARIABLES, VARIENT TOUJOURS ENSEMBLE → PAIRE NON DISTINGUÉE
// ---------------------------------------------------------------------------------------------
test('D. deux rôles qui varient toujours ensemble, jamais isolés -> "non_distinguee"', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA ET operateur changent ensemble
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2]);

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(r.paires.length, 1);
  assert.equal(r.paires[0].etat, 'non_distinguee');
  assert.equal(r.paires[0].tracesUtilisees, 2);
});

// ---------------------------------------------------------------------------------------------
// E. TROIS RÔLES VARIABLES, TOUTES LES PAIRES CORRECTEMENT DISTINGUÉES
// ---------------------------------------------------------------------------------------------
test('E. trois rôles variables, corpus isolant chaque rôle au moins une fois -> les trois paires "distinguee"', () => {
  const base = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const v1 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul
  const v2 = traceAction('zaccede zorbo zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // operateur seul
  const v3 = traceAction('zaccede zorbo zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetB seul
  const traces = [base, v1, v2, v3];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2, 3]);

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(r.etatGlobal, 'paires_evaluees');
  assert.equal(r.paires.length, 3);
  for (const p of r.paires) assert.equal(p.etat, 'distinguee', `paire ${p.roleA}/${p.roleB} devrait être distinguée`);
});

// ---------------------------------------------------------------------------------------------
// F. TROIS RÔLES VARIABLES, SEULEMENT CERTAINES PAIRES DISTINGUÉES → DÉTAIL CONSERVÉ
// ---------------------------------------------------------------------------------------------
test('F. trois rôles variables, une seule paire confondue -> détail par paire conservé, jamais un booléen global', () => {
  const base = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const v1 = traceAction('zaccede ztoro zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA ET operateur changent ensemble
  const v2 = traceAction('zaccede zorbo zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetB seul change
  const traces = [base, v1, v2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2, 3]);

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(r.paires.length, 3);
  const parNom = new Map(r.paires.map((p) => [`${p.roleA}/${p.roleB}`, p.etat]));
  assert.equal(parNom.get('operateur/sujetA'), 'non_distinguee');
  assert.equal(parNom.get('operateur/sujetB'), 'distinguee');
  assert.equal(parNom.get('sujetA/sujetB'), 'distinguee');
});

// ---------------------------------------------------------------------------------------------
// G. RÔLE VARIABLE SANS PROVENANCE EXPLOITABLE POUR CE RÔLE → IMPOSSIBLE À EXAMINER
// ---------------------------------------------------------------------------------------------
test('G. position réellement variable mais jamais mentionnée comme rôle dans la provenance -> "jamais_observe", non examinable', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2 }); // sujetB absent de la provenance
  const t2 = traceAction('zaccede ztoro zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 3], 'précondition : sujetA (1) et sujetB (3) varient textuellement, operateur (2) est ancré');

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.deepEqual(r.rolesVariablesExaminables, [{ role: 'sujetA', position: 1 }]);
  const sujetBIgnore = r.rolesIgnores.find((x) => x.role === 'sujetB');
  assert.ok(sujetBIgnore, 'sujetB doit apparaître dans rolesIgnores');
  assert.equal(sujetBIgnore.raison, 'jamais_observe');
  assert.equal(r.etatGlobal, 'aucune_paire_a_distinguer');
});

// ---------------------------------------------------------------------------------------------
// H. VIEILLES TRACES SANS PROVENANCE + TRACES RÉCENTES SUFFISANTES → VIEILLES TRACES NEUTRES
// ---------------------------------------------------------------------------------------------
test('H. traces antérieures sans provenance mélangées à des traces récentes complètes -> les vieilles restent neutres', () => {
  const old1 = traceAncienne('zaccede zorbo zordre zkelmi', 'accessibilite');
  const old2 = traceAncienne('zaccede ztoro zautre zkelmi', 'accessibilite'); // confondrait sujetA/operateur si elle comptait
  const new1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const new2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // isole sujetA seul
  const traces = [old1, old2, new1, new2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2]);

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(r.paires.length, 1);
  assert.equal(r.paires[0].etat, 'distinguee', 'les traces récentes seules isolent déjà sujetA, les vieilles ne doivent ni aider ni nuire');
  assert.equal(r.paires[0].tracesUtilisees, 2, 'seules les 2 traces récentes avec provenance exploitable doivent compter');
  assert.equal(r.tracesSansProvenance, 2);
  assert.equal(r.tracesAvecProvenance, 2);
});

// ---------------------------------------------------------------------------------------------
// I. RÔLE AVEC DEUX POSITIONS HISTORIQUES CONCURRENTES → ANOMALIE / NON EXAMINABLE
// ---------------------------------------------------------------------------------------------
test('I. un rôle déclaré à deux positions différentes selon la trace -> "ambigu", non examinable', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zvase', 'accessibilite', { sujetA: 3, operateur: 2, sujetB: 1 }); // sujetA/sujetB inversés (anomalie)
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  const sujetAIgnore = r.rolesIgnores.find((x) => x.role === 'sujetA');
  const sujetBIgnore = r.rolesIgnores.find((x) => x.role === 'sujetB');
  assert.equal(sujetAIgnore.raison, 'ambigu');
  assert.equal(sujetBIgnore.raison, 'ambigu');
  assert.ok(!r.rolesVariablesExaminables.some((x) => x.role === 'sujetA' || x.role === 'sujetB'));
});

// ---------------------------------------------------------------------------------------------
// J. RÔLE AVEC POSITIONS INVALIDES UNIQUEMENT → NON EXAMINABLE
// ---------------------------------------------------------------------------------------------
test('J. un rôle dont la seule position déclarée est toujours invalide -> "position_invalide", non examinable', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: -1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: -1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1], 'le texte varie bien en position 1, bien que sujetA ne s\'y trouve jamais déclaré valide');

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  const sujetAIgnore = r.rolesIgnores.find((x) => x.role === 'sujetA');
  assert.equal(sujetAIgnore.raison, 'position_invalide');
  assert.deepEqual(r.rolesVariablesExaminables, []);
  assert.equal(r.etatGlobal, 'aucune_paire_a_distinguer');
});

// ---------------------------------------------------------------------------------------------
// K. DEUX RÔLES VARIABLES PARTAGEANT LA MÊME POSITION → ÉTAT EXPLICITE "meme_position"
// ---------------------------------------------------------------------------------------------
test('K. deux rôles variables déclarés à la MÊME position -> "meme_position", jamais traité comme une preuve manquante ordinaire', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 1, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zvase', 'accessibilite', { sujetA: 1, operateur: 1, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 3]);

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.deepEqual(
    r.rolesVariablesExaminables,
    [{ role: 'operateur', position: 1 }, { role: 'sujetA', position: 1 }, { role: 'sujetB', position: 3 }],
    'operateur et sujetA partagent la position 1 ; sujetB (position 3) varie aussi, séparément',
  );
  const paireMeme = r.paires.find((p) => (p.roleA === 'operateur' && p.roleB === 'sujetA'));
  assert.ok(paireMeme);
  assert.equal(paireMeme.etat, 'meme_position');
  assert.equal(paireMeme.tracesUtilisees, 0);
  // Les deux autres paires (chacune impliquant sujetB, sur une position distincte) restent des
  // paires ORDINAIRES, évaluées normalement -- partager une position ne "contamine" jamais une
  // paire qui n'est pas elle-même concernée.
  const autresPaires = r.paires.filter((p) => p.etat !== 'meme_position');
  assert.equal(autresPaires.length, 2);
  for (const p of autresPaires) assert.equal(p.tracesUtilisees, 2);
});

// ---------------------------------------------------------------------------------------------
// L. RÔLE ANCRÉ + RÔLE VARIABLE → AUCUNE PREUVE CROISÉE INUTILE AVEC L'ANCRE
// ---------------------------------------------------------------------------------------------
test('L. un rôle ancré n\'entre jamais dans une paire, même avec provenance parfaite', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // operateur jamais vu varier
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 3]);

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.ok(!r.paires.some((p) => p.roleA === 'operateur' || p.roleB === 'operateur'), 'operateur (ancré) ne doit jamais apparaître dans une paire');
  const operateurIgnore = r.rolesIgnores.find((x) => x.role === 'operateur');
  assert.equal(operateurIgnore.raison, 'position_ancree');
});

// ---------------------------------------------------------------------------------------------
// M. OPÉRATEUR CONSTANT/ANCRÉ AVEC SUJETS VARIABLES → SEULES LES POSITIONS VARIABLES PARTICIPENT
// ---------------------------------------------------------------------------------------------
test('M. opérateur constant accidentellement anchré, sujets variables distingués -> operateur totalement hors-jeu', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul
  const t3 = traceAction('zaccede zorbo zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetB seul
  const traces = [t1, t2, t3];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 3], 'operateur ("zordre") constant sur les trois traces -> ancré');

  const r = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });
  assert.deepEqual(r.rolesVariablesExaminables, [{ role: 'sujetA', position: 1 }, { role: 'sujetB', position: 3 }]);
  assert.equal(r.paires.length, 1);
  assert.equal(r.paires[0].roleA, 'sujetA');
  assert.equal(r.paires[0].roleB, 'sujetB');
  assert.equal(r.paires[0].etat, 'distinguee');
});

// ---------------------------------------------------------------------------------------------
// N. CORPUS ANALOGUE À "EXEMPLES_BASE" DE L'ACTION ENSEIGNÉE → COHÉRENT AVEC positionsDistinguees()
// ---------------------------------------------------------------------------------------------
test('N. corpus EXEMPLES_BASE (celui qui rend une action enseignée "validee") -> toutes les paires "distinguee" ici aussi', () => {
  const EXEMPLES_BASE = [
    'zact zorbo zcouleur zbleu',
    'zact ztoro zcouleur zbleu',
    'zact zorbo ztaille zbleu',
    'zact zorbo zcouleur zrouge',
  ];
  const evalue = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'], exemples: EXEMPLES_BASE });
  assert.equal(evalue.statut, 'validee', 'précondition : positionsDistinguees() valide ce corpus pour une action enseignée');

  const traces = EXEMPLES_BASE.map((texte) => traceAction(texte, 'confrontation', { sujetA: 1, relation: 2, sujetB: 3 }));
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  assert.deepEqual(rapport.positionsVariables, [1, 2, 3]);

  const r = preuveIndependanceRoles({ rapport, capacite: 'confrontation', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(r.paires.length, 3);
  for (const p of r.paires) assert.equal(p.etat, 'distinguee', `paire ${p.roleA}/${p.roleB} devrait être distinguée, cohérence avec positionsDistinguees() attendue`);
});

// ---------------------------------------------------------------------------------------------
// O. CONTRE-EXEMPLE DE L'ACTION INCERTAINE → ABSENCE DE PREUVE, COHÉRENT AVEC positionsDistinguees()
// ---------------------------------------------------------------------------------------------
test('O. corpus confondu (celui qui rend une action enseignée "incertaine") -> aucune paire distinguée ici non plus', () => {
  const EXEMPLES_CONFONDUS = ['zact zorbo zcouleur zbleu', 'zact ztoro ztaille zrouge'];
  const evalue = evaluerAction({ operation: 'confrontation', roles: ['sujetA', 'relation', 'sujetB'], exemples: EXEMPLES_CONFONDUS });
  assert.equal(evalue.statut, 'incertaine', 'précondition : les 3 positions varient simultanément');

  const traces = EXEMPLES_CONFONDUS.map((texte) => traceAction(texte, 'confrontation', { sujetA: 1, relation: 2, sujetB: 3 }));
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));

  const r = preuveIndependanceRoles({ rapport, capacite: 'confrontation', traces, couvertureIds: traces.map((t) => t.id) });
  assert.equal(r.paires.length, 3);
  for (const p of r.paires) assert.equal(p.etat, 'non_distinguee', `paire ${p.roleA}/${p.roleB} ne devrait jamais être distinguée, cohérence avec positionsDistinguees() attendue`);
});

// ---------------------------------------------------------------------------------------------
// P. PERMUTATIONS DE L'ORDRE DES TRACES → MÊME RÉSULTAT
// ---------------------------------------------------------------------------------------------
test('P. ordre accidentel des traces/couvertureIds en entrée ne change jamais le résultat', () => {
  const base = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const v1 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const v2 = traceAction('zaccede zorbo zautre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const v3 = traceAction('zaccede zorbo zordre zvase', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [base, v1, v2, v3];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const ids = traces.map((t) => t.id);

  const r1 = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: ids });
  const tracesMelangees = [v3, base, v2, v1];
  const idsMelanges = [ids[2], ids[0], ids[3], ids[1]];
  const r2 = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces: tracesMelangees, couvertureIds: idsMelanges });
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------------------------
// Q. FRÉQUENCE 100 CONTRE 1 → AUCUNE NOTION DE MAJORITÉ
// ---------------------------------------------------------------------------------------------
test('Q. cent traces confondues ne suffisent jamais ; une seule paire isolante suffit toujours', () => {
  const confondues = [];
  for (let i = 0; i < 100; i += 1) {
    // répète toujours le même couple confondu (sujetA et operateur alternent ENSEMBLE) -- jamais isolés
    const texte = i % 2 === 0 ? 'zaccede zorbo zordre zkelmi' : 'zaccede ztoro zautre zkelmi';
    confondues.push(traceAction(texte, 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }));
  }
  const rapportSeul = decrireStructure(confondues.map((t) => t.contexte.texteBrut));
  const rSeul = preuveIndependanceRoles({
    rapport: rapportSeul, capacite: 'accessibilite', traces: confondues, couvertureIds: confondues.map((t) => t.id),
  });
  const pSeul = rSeul.paires.find((p) => p.roleA === 'operateur' && p.roleB === 'sujetA');
  assert.equal(pSeul.etat, 'non_distinguee', '100 traces confondues ne doivent jamais, par leur seul nombre, produire une preuve');

  const isolante = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 }); // sujetA seul change vs la base
  const avecUneIsolante = [...confondues, isolante];
  const rapportAvec = decrireStructure(avecUneIsolante.map((t) => t.contexte.texteBrut));
  const rAvec = preuveIndependanceRoles({
    rapport: rapportAvec, capacite: 'accessibilite', traces: avecUneIsolante, couvertureIds: avecUneIsolante.map((t) => t.id),
  });
  const pAvec = rAvec.paires.find((p) => p.roleA === 'operateur' && p.roleB === 'sujetA');
  assert.equal(pAvec.etat, 'distinguee', 'une seule paire de traces isolante suffit, même face à 100 traces confondues');
});

// ---------------------------------------------------------------------------------------------
// R. MODIFICATION DE argumentsUtilises SANS TOUCHER CONTEXTE/PROVENANCE → RÉSULTAT INCHANGÉ
// ---------------------------------------------------------------------------------------------
test('R. argumentsUtilises n\'est jamais lu : le modifier ne change jamais le résultat', () => {
  const t1 = traceAction('zaccede zorbo zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const t2 = traceAction('zaccede ztoro zordre zkelmi', 'accessibilite', { sujetA: 1, operateur: 2, sujetB: 3 });
  const traces = [t1, t2];
  const rapport = decrireStructure(traces.map((t) => t.contexte.texteBrut));
  const r1 = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces, couvertureIds: traces.map((t) => t.id) });

  const tracesAlterees = traces.map((t) => ({ ...t, argumentsUtilises: { sujetA: 'ZZZ_FAUX', operateur: 'ZZZ_FAUX', sujetB: 'ZZZ_FAUX' } }));
  const r2 = preuveIndependanceRoles({ rapport, capacite: 'accessibilite', traces: tracesAlterees, couvertureIds: tracesAlterees.map((t) => t.id) });
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------------------------
// [GARDE] DÉPENDANCE AU REGISTRE RÉEL
// ---------------------------------------------------------------------------------------------
test('[GARDE] le registre réel "accessibilite" porte toujours exactement {sujetA, operateur, sujetB}', () => {
  assert.deepEqual([...CAPACITES.accessibilite.roles].sort(), ['operateur', 'sujetA', 'sujetB']);
});
// === FIN_TEST_PREUVE_INDEPENDANCE_ROLES ===
