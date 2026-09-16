import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fauxStockage } from './outils.mjs';
import { lireSante, noterSucces, noterEchec, estDisponible, estConfirme, estDisparu, ordonnerCandidats, etatModele, ATTENTES_MS, CLE_SANTE } from '../app/fournisseurs/sante.js';

const T = Date.parse('2026-09-16T10:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

test('succès et échecs notés, puis relus', () => {
  const s = fauxStockage();
  noterEchec('gemini', 'models/a', { code: 'service', detail: '503' }, iso(T), s);
  let e = etatModele(lireSante(s), 'gemini', 'models/a');
  assert.equal(e.code, 'service');
  assert.equal(estConfirme(e), false);
  noterSucces('gemini', 'models/a', iso(T + 1), s);
  e = etatModele(lireSante(s), 'gemini', 'models/a');
  assert.equal(estConfirme(e), true);
  assert.equal(e.echec, null);
});

test('périodes d’attente selon le type d’échec', () => {
  const e = (code, depuis) => ({ echec: iso(T - depuis), code });
  assert.equal(estDisponible(e('service', 60000), T), false);
  assert.equal(estDisponible(e('service', ATTENTES_MS.service + 1), T), true);
  assert.equal(estDisponible(e('quota', 10 * 60000), T), false);
  assert.equal(estDisponible(e('modele', 3 * 24 * 3600000), T), false);
  assert.equal(estDisparu(e('modele', 3 * 24 * 3600000), T), true);
  assert.equal(estDisponible(e('cle', 1), T), true, 'une erreur de clé ne met pas un modèle en pause');
  assert.equal(estDisponible({}, T), true);
});

test('ordre des candidats : choisi, confirmés récents, puis préférence du fournisseur', () => {
  const s = fauxStockage();
  noterSucces('g', 'models/vieux-ok', iso(T - 5000), s);
  noterSucces('g', 'models/recent-ok', iso(T - 1000), s);
  noterEchec('g', 'models/sature', { code: 'service' }, iso(T - 1000), s);
  noterEchec('g', 'models/disparu', { code: 'modele' }, iso(T - 1000), s);
  const modeles = ['models/disparu', 'models/sature', 'models/liste-2', 'models/liste-1', 'models/vieux-ok', 'models/recent-ok'].map((id) => ({ id }));
  const ordonner = (l) => [...l].sort((a, b) => a.id.localeCompare(b.id));
  const ids = ordonnerCandidats({ fournisseur: 'g', prefere: 'models/choisi', modeles, sante: lireSante(s), maintenant: T, ordonner });
  assert.deepEqual(ids, ['models/choisi', 'models/recent-ok', 'models/vieux-ok', 'models/liste-1', 'models/liste-2']);
  const sansChoisi = ordonnerCandidats({ fournisseur: 'g', prefere: 'models/sature', modeles, sante: lireSante(s), maintenant: T, ordonner });
  assert.equal(sansChoisi[0], 'models/recent-ok', 'un modèle choisi en pause est sauté');
});

test('stockage abîmé ou absent : pas de plantage', () => {
  const s = fauxStockage();
  s.setItem(CLE_SANTE, '{pas du json');
  assert.deepEqual(lireSante(s), {});
  const casse = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  assert.deepEqual(lireSante(casse), {});
  assert.doesNotThrow(() => noterSucces('g', 'm', iso(T), casse));
});
