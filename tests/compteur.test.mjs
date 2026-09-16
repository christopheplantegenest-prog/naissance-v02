import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireCompteur, noterAppel, fetchCompte, resumeCompteur } from '../app/fournisseurs/compteur.js';
import * as gemini from '../app/fournisseurs/gemini.js';
import { fauxStockage } from './outils.mjs';

const T = Date.parse('2026-09-16T16:00:00Z');

test('compteur : par journée de quota, par type et par modèle, remis à zéro le lendemain', () => {
  const s = fauxStockage();
  noterAppel({ type: 'conversation', modele: 'm1', reussi: true }, s, T);
  noterAppel({ type: 'conversation', modele: 'm1', reussi: false }, s, T);
  noterAppel({ type: 'rangement', modele: 'm2', reussi: true }, s, T);
  const c = lireCompteur(s, T);
  assert.deepEqual(c, { jour: '2026-09-16', total: 3, reussis: 2, parType: { conversation: 2, rangement: 1 }, parModele: { m1: 2, m2: 1 } });
  assert.match(resumeCompteur(c), /3 appel\(s\).*2 réussi\(s\).*conversation 2, rangement 1.*m1 : 2/);
  assert.equal(lireCompteur(s, Date.parse('2026-09-17T07:30:00Z')).total, 0, 'nouvelle journée après 9 h (heure de France)');
  assert.equal(resumeCompteur(lireCompteur(fauxStockage(), T)), "Aucun appel au moteur externe aujourd'hui.");
});

test('fetch compté : seulement les appels qui consomment du quota, réussis ou non', async () => {
  const s = fauxStockage();
  const faux = async (url) => {
    if (url.includes('panne')) throw new TypeError('Failed to fetch');
    return { ok: !url.includes('refus'), status: 200 };
  };
  const f = fetchCompte({ type: 'conversation', fournisseur: gemini, fetchFn: faux, stockage: s, horloge: () => T });
  await f('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000');
  await f('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
  await f('https://generativelanguage.googleapis.com/v1beta/models/refus:generateContent');
  await assert.rejects(f('https://generativelanguage.googleapis.com/v1beta/models/panne:generateContent'));
  const c = lireCompteur(s, T);
  assert.equal(c.total, 3, 'la liste des modèles ne compte pas');
  assert.equal(c.reussis, 1);
  assert.deepEqual(c.parModele, { 'gemini-3.6-flash': 1, refus: 1, panne: 1 });
});

test('stockage indisponible : le compteur ne bloque jamais un appel', async () => {
  const casse = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  const f = fetchCompte({ type: 'rangement', fournisseur: gemini, fetchFn: async () => ({ ok: true }), stockage: casse, horloge: () => T });
  assert.deepEqual(await f('https://x/models/m:generateContent'), { ok: true });
  assert.equal(lireCompteur(casse, T).total, 0);
});
