import { test } from 'node:test';
import assert from 'node:assert/strict';
import { choisirSouvenirs, motsCles } from '../app/memoire/selection.js';

const s = (id, texte, importance = 2, extra = {}) => ({ id, texte, importance, statut: 'actif', cree: id, ...extra });

test('mots-clés sans accents ni mots vides', () => {
  assert.deepEqual([...motsCles('Le Vélo électrique avec Hélène')].sort(), ['electrique', 'helene', 'velo']);
});

test('tout passe quand le budget suffit, archivés exclus', () => {
  const r = choisirSouvenirs([s('a', 'un'), s('b', 'deux', 3), s('c', 'trois', 1, { statut: 'archive' })], 'x', 1000);
  assert.deepEqual(r.choisis.map((x) => x.id), ['b', 'a']);
});

test('budget serré : essentiels puis pertinents', () => {
  const long = 'x'.repeat(200);
  const liste = [
    s('banal', `${long} jardinage`, 2),
    s('essentiel', `${long} prénom`, 3),
    s('pertinent', `${long} guitare électrique`, 1),
  ];
  const r = choisirSouvenirs(liste, 'Tu te souviens de ma guitare ?', 520);
  assert.deepEqual(r.choisis.map((x) => x.id).sort(), ['essentiel', 'pertinent']);
  assert.deepEqual(r.pertinents, ['pertinent']);
});
