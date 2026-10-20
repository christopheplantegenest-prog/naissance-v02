// AT-9 « VERSION DE L'APK DANS L'ATELIER ». OUTILLAGE NON COGNITIF — aucune acquisition de Naissance.
// La version passée à monterAtelier apparaît en haut de l'écran, en OFF et en MANUEL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { monterEcran } from './atelier-aide.mjs';

test('AT-9 : la version apparaît en OFF puis en MANUEL', async () => {
  const e = monterEcran({ version: '0.65.13' });
  assert.equal(e.un('version-apk').textContent, 'Naissance v0.65.13');
  assert.equal(e.un('bandeau').children[0], e.un('version-apk'));
  assert.ok(e.texte().includes('ATELIER DE DÉVELOPPEMENT'));
  assert.ok(e.texte().includes('OUTILLAGE NON COGNITIF'));
  await e.cliquer('mode-manuel');
  assert.ok(e.un('mode').textContent.includes('MANUEL'));
  assert.equal(e.un('version-apk').textContent, 'Naissance v0.65.13');
  assert.ok(e.texte().includes('ATELIER DE DÉVELOPPEMENT'));
});

test('AT-9 : la ligne reflète la version passée', () => {
  const e = monterEcran({ version: '9.8.7' });
  assert.equal(e.un('version-apk').textContent, 'Naissance v9.8.7');
});
