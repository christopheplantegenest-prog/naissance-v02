import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireBrouillon, garderBrouillon, effacerBrouillon } from '../app/conversation/brouillon.js';
import { fauxStockage } from './outils.mjs';

test('le message en attente est gardé, relu, puis effacé', () => {
  const s = fauxStockage();
  assert.equal(lireBrouillon(s), null);
  garderBrouillon('Mon message important', 'd', s);
  assert.deepEqual(lireBrouillon(s), { texte: 'Mon message important', date: 'd' });
  garderBrouillon('   ', 'd', s);
  assert.equal(lireBrouillon(s), null, 'un champ vidé efface le brouillon');
  garderBrouillon('encore', 'd', s);
  effacerBrouillon(s);
  assert.equal(lireBrouillon(s), null);
});

test('stockage indisponible ou abîmé : pas de plantage', () => {
  const casse = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  assert.equal(lireBrouillon(casse), null);
  assert.doesNotThrow(() => garderBrouillon('t', 'd', casse));
  assert.doesNotThrow(() => effacerBrouillon(casse));
  const s = fauxStockage();
  s.setItem('naissance-ia.message-en-attente.v1', '{abîmé');
  assert.equal(lireBrouillon(s), null);
});
