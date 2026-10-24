// v0.65.24 — piège E-T2 (section 12) : la clôture d'une mission attend la fin de la tentative vivante (section 11). OUTILLAGE NON COGNITIF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLE_ATELIER, CLE_CARNET } from '../app/atelier/ecran.js';
import { missionOuverte, copieChantier, declencher, actif } from './atelier-carnet-ecran-aide.mjs';

for (const etape of ['lance', 'rendu']) {
  test(`carnet clôture : tentative vivante (${etape}) => bouton grisé et ligne d'attente`, async () => {
    const { a } = await missionOuverte({ etape });
    assert.equal(actif(a, 'clore-mission'), false);
    const l = a.un('carnet-clore-attente').textContent;
    assert.match(l, /section 11/);
    assert.match(l, /lancee|rendue/);
    assert.match(l, /jalon/);
  });
}

test('carnet clôture : la fonction refuse avant d\'armer la confirmation, carnet inchangé', async () => {
  const { a } = await missionOuverte({ etape: 'prepare' });
  assert.equal(actif(a, 'clore-mission'), true);
  const b = a.un('clore-mission');
  a.stockage.setItem(CLE_ATELIER, JSON.stringify(copieChantier({ etape: 'lance' })));
  a.ecran.rafraichir();
  const avant = a.stockage.getItem(CLE_CARNET);
  await declencher(b);
  await declencher(b);
  assert.equal(a.stockage.getItem(CLE_CARNET), avant);
  assert.doesNotMatch(a.un('clore-mission').textContent, /Confirmer/);
  assert.equal(actif(a, 'clore-mission'), false);
});

for (const etape of ['prepare', 'inconnu', 'refuse']) {
  test(`carnet clôture : sans tentative vivante (${etape}) => bouton actif, aucune ligne d'attente`, async () => {
    const { a } = await missionOuverte({ etape });
    assert.equal(actif(a, 'clore-mission'), true);
    assert.equal(a.trouver('carnet-clore-attente').length, 0);
  });
}
