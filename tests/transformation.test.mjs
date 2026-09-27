// Chantier « ÉDUQUER PLUTÔT QUE PROGRAMMER » (décision ChatGPT du 27/09/2026) -- fonctions PURES et
// ISOLÉES de app/langage/transformation.js. Aucune notion grammaticale ici : la négation ne sert que
// de banc d'essai, jamais du code spécifique au sujet/verbe/négation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  tokeniser, reassembler, alignerExemple, induireTransformation, appliquerTransformation, fusionnerTransformations,
} from '../app/langage/transformation.js';

// ============================================================================ SURFACE
test('tokeniser conserve casse/accents et isole la ponctuation', () => {
  assert.deepEqual(tokeniser('Le chat dort.'), ['Le', 'chat', 'dort', '.']);
  assert.deepEqual(tokeniser("Aujourd'hui, ça va ?"), ["Aujourd'hui", ',', 'ça', 'va', '?']);
});

test('reassembler recolle sans espace avant la ponctuation finale', () => {
  assert.equal(reassembler(['Le', 'chat', 'ne', 'dort', 'pas', '.']), 'Le chat ne dort pas.');
});

// ============================================================================ ALIGNEMENT D'UN EXEMPLE
test('alignerExemple trouve les insertions quand l\'entrée est une sous-séquence de la sortie', () => {
  const r = alignerExemple(['Je', 'mange'], ['Je', 'ne', 'mange', 'pas']);
  assert.ok(r);
  assert.deepEqual(r.insertions, [[], ['ne'], ['pas']]);
});

test('alignerExemple renvoie null si l\'entrée n\'est pas une sous-séquence de la sortie', () => {
  assert.equal(alignerExemple(['Je', 'mange'], ['Il', 'ne', 'mange', 'pas']), null);
});

// ============================================================================ INDUCTION
test('un seul exemple ne suffit jamais à généraliser (abstention)', () => {
  const r = induireTransformation([{ entree: 'Je mange', sortie: 'Je ne mange pas' }]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'insuffisant');
});

test('deux exemples cohérents induisent une transformation générale (négation, banc d\'essai)', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation, { n: 2, insertions: [[], ['ne'], ['pas']] });
});

test('application à une entrée réellement nouvelle, jamais vue dans les exemples', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  const sortie = appliquerTransformation(r.transformation, 'Je cours');
  assert.equal(sortie, 'Je ne cours pas');
});

test('exemples contradictoires à la même position → abstention (conflit), jamais un choix arbitraire', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors jamais' }, // "pas" vs "jamais" à la même position
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'conflit');
});

test('arités différentes entre exemples → abstention explicite (pas de généralisation forcée)', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Le chat dort', sortie: 'Le chat ne dort pas' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'longueurs_incompatibles');
});

test('une entrée non alignable (suppression/réordonnancement) → abstention, jamais devinée', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'complètement autre chose' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'non_alignable');
});

test('entrée === sortie partout → aucune transformation à apprendre', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je mange' },
    { entree: 'Je dors', sortie: 'Je dors' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'aucune_transformation');
});

// ============================================================================ GÉNÉRALITÉ (deuxième famille, même mécanisme)
test('une DEUXIÈME famille de transformation (préfixe), sans aucun code spécifique, réussit avec le même mécanisme', () => {
  const r = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.insertions[0], ['Enfin', ',']);
  const sortie = appliquerTransformation(r.transformation, 'il danse');
  assert.equal(sortie, 'Enfin, il danse');
});

// ============================================================================ COMPOSITION
test('fusionnerTransformations combine deux transformations touchant des positions différentes', () => {
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'il chante', sortie: 'il ne chante pas' },
  ]);
  const prefixe = induireTransformation([
    { entree: 'il chante', sortie: 'Enfin, il chante' },
    { entree: 'il arrive', sortie: 'Enfin, il arrive' },
  ]);
  assert.equal(neg.ok, true);
  assert.equal(prefixe.ok, true);
  const fusion = fusionnerTransformations([neg.transformation, prefixe.transformation]);
  assert.equal(fusion.ok, true);
  // Cas nouveau, jamais enseigné : ni la négation seule ni le préfixe seul n'ont vu "je chante".
  const sortie = appliquerTransformation(fusion.transformation, 'je chante');
  assert.equal(sortie, 'Enfin, je ne chante pas');
});

test('fusionnerTransformations s\'abstient si deux transformations se contredisent à la même position', () => {
  const negPas = { n: 2, insertions: [[], ['ne'], ['pas']] };
  const negJamais = { n: 2, insertions: [[], ['ne'], ['jamais']] };
  const fusion = fusionnerTransformations([negPas, negJamais]);
  assert.equal(fusion.ok, false);
  assert.equal(fusion.raison, 'conflit');
});

test('fusionnerTransformations d\'une seule transformation est une identité (application inchangée)', () => {
  const neg = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'Je ne dors pas' },
  ]);
  const fusion = fusionnerTransformations([neg.transformation]);
  assert.equal(fusion.ok, true);
  assert.equal(appliquerTransformation(fusion.transformation, 'Je cours'), 'Je ne cours pas');
});

// ============================================================================ GARDE-FOU STATIQUE : aucun réseau, aucun Gemini
test('GARDE-FOU — transformation.js n\'importe rien, ne connaît aucun réseau ni Gemini', () => {
  const src = readFileSync(new URL('../app/langage/transformation.js', import.meta.url), 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/^import /m.test(sansCommentaires), 'ce fichier ne doit importer aucun autre module (pur et isolé)');
  assert.ok(!/gemini/i.test(sansCommentaires));
  assert.ok(!/fetch\(/.test(sansCommentaires));
});
