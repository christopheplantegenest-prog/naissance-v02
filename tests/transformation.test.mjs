// Chantier « ÉDUQUER PLUTÔT QUE PROGRAMMER » (décision ChatGPT du 27/09/2026) -- fonctions PURES et
// ISOLÉES de app/langage/transformation.js. Aucune notion grammaticale ici : la négation ne sert que
// de banc d'essai, jamais du code spécifique au sujet/verbe/négation.
// ÉLARGI le 27/09/2026 (décision ChatGPT « DIAGNOSTIC v0.26.0, TRANSFORMATION REFUSÉE ») : le
// mécanisme n'induisait que des INSERTIONS (entrée = sous-séquence stricte de la sortie). Nouvel
// alignement par PLUS LONGUE SOUS-SÉQUENCE COMMUNE (LCS, algorithme structurel générique, aucune
// notion de grammaire) : chaque jeton d'entrée est désormais soit GARDÉ (recopié), soit SUPPRIMÉ ;
// un REMPLACEMENT s'obtient sans troisième mécanisme (suppression + insertion au même endroit).
// Rétrocompatible : une transformation persistée SANS le champ « garder » (apprise avant ce jour)
// reste interprétée comme « tout gardé », comportement inchangé. Le RÉORDONNANCEMENT véritable reste
// hors de portée (LCS respecte l'ordre relatif) -- limite distincte, non traitée ici.
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
test('alignerExemple trouve les insertions quand l\'entrée est une sous-séquence de la sortie (rien à garder=false)', () => {
  const r = alignerExemple(['Je', 'mange'], ['Je', 'ne', 'mange', 'pas']);
  assert.ok(r);
  assert.deepEqual(r.insertions, [[], ['ne'], ['pas']]);
  assert.deepEqual(r.garder, [true, true]);
});

test('alignerExemple (LCS) supprime un jeton d\'entrée absent de la sortie, au lieu d\'échouer', () => {
  // « Je » n'apparaît nulle part dans la sortie : ce jeton est SUPPRIMÉ (garder=false), le reste
  // de la sortie devient une insertion -- un alignement structurel, jamais un devinage grammatical.
  const r = alignerExemple(['Je', 'mange'], ['Il', 'ne', 'mange', 'pas']);
  assert.ok(r);
  assert.deepEqual(r.garder, [false, true]);
  assert.deepEqual(r.insertions, [[], ['Il', 'ne'], ['pas']]);
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
  assert.deepEqual(r.transformation, { n: 2, insertions: [[], ['ne'], ['pas']], garder: [true, true] });
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

test('deux exemples radicalement incompatibles (l\'un garde tout, l\'autre supprime tout) → conflit, jamais devinée', () => {
  // Avant l'extension LCS, ce cas était rejeté avec 'non_alignable' (impossible d'aligner le second
  // exemple comme une pure sous-séquence). Depuis l'extension SUPPRESSION/REMPLACEMENT, le second
  // exemple s'aligne désormais structurellement (tout supprimé, tout remplacé) -- mais il CONTREDIT
  // le premier exemple à la position 0 (gardé vs supprimé) : abstention toujours garantie, avec une
  // raison plus précise.
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je ne mange pas' },
    { entree: 'Je dors', sortie: 'complètement autre chose' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'conflit');
});

test('entrée === sortie partout → aucune transformation à apprendre', () => {
  const r = induireTransformation([
    { entree: 'Je mange', sortie: 'Je mange' },
    { entree: 'Je dors', sortie: 'Je dors' },
  ]);
  assert.equal(r.ok, false);
  assert.equal(r.raison, 'aucune_transformation');
});

// ============================================================================ SUPPRESSION (v0.27)
test('SUPPRESSION — un jeton présent dans TOUS les exemples en entrée mais absent en sortie est appris comme supprimé', () => {
  const r = induireTransformation([
    { entree: 'a b c', sortie: 'a c' },
    { entree: 'x b y', sortie: 'x y' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.garder, [true, false, true]);
  assert.equal(appliquerTransformation(r.transformation, 'p b q'), 'p q');
});

// ============================================================================ REMPLACEMENT (v0.27, suppression + insertion au même endroit -- aucun 3e mécanisme)
test('REMPLACEMENT — un mot substitué par un autre mot littéral, sur une famille sans rapport avec le français', () => {
  const r = induireTransformation([
    { entree: 'alpha beta', sortie: 'alpha ZETA' },
    { entree: 'gamma beta', sortie: 'gamma ZETA' },
  ]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.transformation.garder, [true, false]);
  assert.equal(appliquerTransformation(r.transformation, 'delta beta'), 'delta ZETA');
});

test('REMPLACEMENT — cas français réel (singulier → pluriel), deux substitutions dans la même transformation', () => {
  const r = induireTransformation([
    { entree: 'un chat', sortie: 'des chats' },
    { entree: 'un chien', sortie: 'des chiens' },
  ]);
  assert.equal(r.ok, false); // "chat"→"chats" et "chien"→"chiens" ne sont PAS le même remplacement littéral : conflit attendu, jamais un devinage morphologique.
  assert.equal(r.raison, 'conflit');
});

// ============================================================================ RÉTROCOMPATIBILITÉ (v0.26 → v0.27)
test('une transformation persistée SANS champ garder (apprise avant ce jour) s\'applique comme avant (tout gardé)', () => {
  const ancienne = { n: 2, insertions: [[], ['ne'], ['pas']] }; // forme exacte des transformations v0.26 déjà sur le téléphone
  assert.equal(appliquerTransformation(ancienne, 'Je cours'), 'Je ne cours pas');
});

test('fusionnerTransformations compose une transformation ancienne (sans garder) avec une nouvelle (avec garder)', () => {
  const ancienne = { n: 2, insertions: [[], ['ne'], ['pas']] };
  const nouvelle = { n: 2, insertions: [['Enfin', ','], [], []], garder: [true, true] };
  const fusion = fusionnerTransformations([ancienne, nouvelle]);
  assert.equal(fusion.ok, true);
  assert.equal(appliquerTransformation(fusion.transformation, 'Je cours'), 'Enfin, Je ne cours pas');
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
