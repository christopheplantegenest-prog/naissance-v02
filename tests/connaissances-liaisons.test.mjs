// === DEBUT_TEST_CONNAISSANCES_LIAISONS ===
// v0.43 — DÉCISION CHATGPT « RÉFÉRENÇABILITÉ ET RÉUTILISATION SCALAIRE DES RÉSULTATS » (02/10).
// Tests de PERSISTANCE SEULE pour apprendreLiaison() (connaissances.js), même discipline que
// tests/action-apprise.test.mjs pour apprendreAction() : ce fichier ne teste JAMAIS evaluerLiaison()
// (composition.js, pure, déjà testée dans tests/composition.test.mjs) -- seulement l'écriture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { magasinMemoireVive, apprendreLiaison } from '../app/langage/connaissances.js';

test('apprendreLiaison : nouvelle liaison → écrite, statut validee', async () => {
  const magasin = magasinMemoireVive();
  const { objet } = await apprendreLiaison(magasin, {
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  assert.equal(objet.statut, 'validee');
  assert.equal(objet.capaciteSource, 'deduction');
  assert.equal(objet.champ, 'resultat');
  assert.equal(objet.capaciteCible, 'confrontation');
  assert.equal(objet.role, 'relation');
  const toutes = await magasin.lireTout('liaisons');
  assert.equal(toutes.length, 1);
});

test('apprendreLiaison : ré-enseigner le MÊME quadruplet exact → rien de nouveau écrit', async () => {
  const magasin = magasinMemoireVive();
  await apprendreLiaison(magasin, {
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  const { explication } = await apprendreLiaison(magasin, {
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  assert.match(explication, /connaissais déjà/);
  const toutes = await magasin.lireTout('liaisons');
  assert.equal(toutes.length, 1);
});

test('apprendreLiaison : plusieurs liaisons DISTINCTES depuis la MÊME capaciteSource coexistent (pas un remplacement versionné)', async () => {
  const magasin = magasinMemoireVive();
  await apprendreLiaison(magasin, {
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  });
  await apprendreLiaison(magasin, {
    capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'recherche', role: 'valeur',
  });
  const toutes = await magasin.lireTout('liaisons');
  assert.equal(toutes.length, 2);
  assert.ok(toutes.every((l) => l.statut === 'validee'));
});

test('apprendreLiaison : un champ requis manquant → erreur, rien écrit', async () => {
  const magasin = magasinMemoireVive();
  await assert.rejects(() => apprendreLiaison(magasin, {
    capaciteSource: '', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation',
  }));
  const toutes = await magasin.lireTout('liaisons');
  assert.equal(toutes.length, 0);
});
// === FIN_TEST_CONNAISSANCES_LIAISONS ===
