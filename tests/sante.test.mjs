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

import { prochaineRemiseAZero, journeeQuota, finDePause, quotaDuJourAtteint, enPauseLongue, repriseDe } from '../app/fournisseurs/sante.js';

test('remise à zéro des quotas : minuit heure du Pacifique, changements d’heure compris', () => {
  const r = (iso) => new Date(prochaineRemiseAZero(Date.parse(iso))).toISOString();
  assert.equal(r('2026-09-16T16:56:00Z'), '2026-09-17T07:00:00.000Z');
  assert.equal(r('2026-09-17T06:59:00Z'), '2026-09-17T07:00:00.000Z');
  assert.equal(r('2026-09-17T07:01:00Z'), '2026-09-18T07:00:00.000Z');
  assert.equal(r('2026-11-10T12:00:00Z'), '2026-11-11T08:00:00.000Z');
  assert.equal(r('2026-03-08T12:00:00Z'), '2026-03-09T07:00:00.000Z');
  assert.equal(journeeQuota(Date.parse('2026-09-17T06:59:00Z')), '2026-09-16');
});

test('pause jusqu’à la reprise : quota du jour, quota par minute, saturation', () => {
  const t = Date.parse('2026-09-16T16:56:00Z');
  assert.equal(finDePause({ code: 'quota', quota: { periode: 'jour', reessayerDansMs: 34000 } }, t), Date.parse('2026-09-17T07:00:00Z'));
  assert.equal(finDePause({ code: 'quota', quota: { periode: 'minute', reessayerDansMs: 12000 } }, t), t + 12000);
  assert.equal(finDePause({ code: 'quota', quota: { periode: 'minute' } }, t), t + 60000);
  assert.equal(finDePause({ code: 'service' }, t), t + ATTENTES_MS.service);
  assert.equal(finDePause({ code: 'cle' }, t), null);
  const s = fauxStockage();
  noterEchec('g', 'models/a', { code: 'quota', quota: { periode: 'jour' } }, new Date(t).toISOString(), s);
  const e = etatModele(lireSante(s), 'g', 'models/a');
  assert.equal(e.jusqua, '2026-09-17T07:00:00.000Z');
  assert.equal(quotaDuJourAtteint(e, t + 3 * 3600 * 1000), true, 'toujours en pause 3 h plus tard (et non 15 min)');
  assert.equal(enPauseLongue(e, t), true);
  assert.equal(estDisponible(e, Date.parse('2026-09-17T07:00:01Z')), true, 'disponible après la remise à zéro');
  assert.equal(repriseDe(e), Date.parse('2026-09-17T07:00:00Z'));
  noterEchec('g', 'models/b', { code: 'service' }, new Date(t).toISOString(), s);
  assert.equal(enPauseLongue(etatModele(lireSante(s), 'g', 'models/b'), t), false);
});
