import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nettoyerCle, resumeCle, caracteresInhabituels, longueur } from '../app/reglages/cle.js';

test('nettoyage : espaces, retours à la ligne, invisibles et guillemets autour', () => {
  assert.equal(nettoyerCle('  AQ.Ab8-x_Y\n'), 'AQ.Ab8-x_Y');
  assert.equal(nettoyerCle('"AQ.abc"'), 'AQ.abc');
  assert.equal(nettoyerCle('«\u00A0AQ.abc\u00A0»'), 'AQ.abc');
  assert.equal(nettoyerCle('\uFEFFAQ.a\u200Bbc'), 'AQ.abc');
  assert.equal(nettoyerCle('AQ.a b\tc'), 'AQ.abc');
  assert.equal(nettoyerCle(undefined), '');
});

test('aucun format imposé : préfixe et longueur libres', () => {
  for (const cle of ['AQ.xyz', 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456', 'n-importe-quoi.123/+=']) {
    assert.equal(nettoyerCle(cle), cle);
  }
});

test('résumé masqué : début, fin et longueur réelle', () => {
  assert.equal(resumeCle('AQ.Ab8RN6abcdefghijk9xZk'), 'AQ.A…9xZk (24 caractères)');
  assert.equal(resumeCle('court'), '••••• (5 caractères)');
  assert.equal(resumeCle(''), 'aucune clé');
  assert.ok(!resumeCle('AQ.Ab8RN6abcdefghijk9xZk').includes('RN6abc'));
});

test('caractères inhabituels signalés sans refus', () => {
  assert.equal(caracteresInhabituels('AQ.abc'), 0);
  assert.equal(caracteresInhabituels('AQ.abcé'), 1);
  assert.equal(longueur('é😀'), 2);
});
