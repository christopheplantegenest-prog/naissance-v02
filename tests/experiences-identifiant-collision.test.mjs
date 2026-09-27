// Correctif ciblé (décision ChatGPT du 27/09/2026, suite au refus du colis v0.26.0 par le robot) --
// enregistrerExperience() (connaissances.js) fabriquait son identifiant avec
// `experience-${Date.now()}-${Math.floor(Math.random()*1000)}` : deux expériences créées à la même
// milliseconde ET tirant le même nombre aléatoire (1 chance sur 1000, mais plusieurs occasions à
// chaque écriture rapprochée) obtenaient le MÊME id, et la seconde écrasait silencieusement la
// première (le magasin range par id) -- cause exacte de l'échec intermittent observé dans
// tests/diagnostic-instrumentation-import.test.mjs (fichier NON touché ici, comme demandé).
// PÉRIMÈTRE STRICT de ce correctif : uniquement la génération de l'identifiant d'une expérience,
// aucune autre sémantique changée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { magasinMemoireVive, enregistrerExperience } from '../app/langage/connaissances.js';

test('deux expériences créées à la MÊME milliseconde, avec le MÊME hasard, obtiennent des identifiants différents', async () => {
  const magasin = magasinMemoireVive();
  const dateNowOriginal = Date.now;
  const randomOriginal = Math.random;
  Date.now = () => 1234567890123;
  Math.random = () => 0.42;
  try {
    const a = await enregistrerExperience(magasin, { texteRecu: 'A', texteRepondu: 'x', date: 'd', source: 's' });
    const b = await enregistrerExperience(magasin, { texteRecu: 'B', texteRepondu: 'x', date: 'd', source: 's' });
    assert.notEqual(a.id, b.id, 'deux expériences distinctes ne doivent jamais partager le même identifiant');
    const toutes = await magasin.lireTout('experiences');
    assert.equal(toutes.length, 2, 'aucune des deux ne doit avoir écrasé l\'autre en mémoire');
    assert.deepEqual(toutes.map((e) => e.texteRecu).sort(), ['A', 'B']);
  } finally {
    Date.now = dateNowOriginal;
    Math.random = randomOriginal;
  }
});

test('de nombreuses créations rapprochées (sans mock, timing réel) ne produisent jamais de collision', async () => {
  for (let essai = 0; essai < 300; essai += 1) {
    const magasin = magasinMemoireVive();
    await enregistrerExperience(magasin, { texteRecu: 'A', texteRepondu: 'x', date: 'd', source: 's' });
    await enregistrerExperience(magasin, { texteRecu: 'B', texteRepondu: 'x', date: 'd', source: 's' });
    await enregistrerExperience(magasin, { texteRecu: 'C', texteRepondu: 'x', date: 'd', source: 's' });
    // eslint-disable-next-line no-await-in-loop
    const toutes = await magasin.lireTout('experiences');
    assert.equal(toutes.length, 3, `essai ${essai} : une collision d'identifiant a fait disparaître une expérience`);
  }
});
