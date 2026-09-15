import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireReglages, modifierFournisseur, reglagesDe, CLE_STOCKAGE } from '../app/reglages/stockage.js';

function fauxStockage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

test('réglages vides par défaut, puis enregistrés et relus', () => {
  const s = fauxStockage();
  assert.equal(lireReglages(s).fournisseur, 'gemini');
  modifierFournisseur('gemini', { cle: 'AQ.k', modele: 'models/x', methode: 'entete' }, s);
  const p = reglagesDe(lireReglages(s), 'gemini');
  assert.deepEqual(p, { cle: 'AQ.k', modele: 'models/x', methode: 'entete' });
});

test('une valeur null efface le champ', () => {
  const s = fauxStockage();
  modifierFournisseur('gemini', { cle: 'AQ.k', modele: 'm' }, s);
  modifierFournisseur('gemini', { modele: null }, s);
  assert.deepEqual(reglagesDe(lireReglages(s), 'gemini'), { cle: 'AQ.k' });
});

test('contenu abîmé ou stockage indisponible : pas de plantage', () => {
  const s = fauxStockage();
  s.setItem(CLE_STOCKAGE, '{pas du json');
  assert.equal(lireReglages(s).fournisseur, 'gemini');
  const casse = { getItem: () => { throw new Error('bloqué'); }, setItem: () => { throw new Error('plein'); } };
  assert.equal(lireReglages(casse).fournisseur, 'gemini');
  assert.equal(modifierFournisseur('gemini', { cle: 'x' }, casse).ok, false);
});
