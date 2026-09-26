// === DEBUT_TEST_EXPERIENCES ===
// B1 — CONSERVATION D'EXPÉRIENCE. Table « experiences », séparée des 7 tables de connaissances et
// de « naissance-memoire ». Ces tests figent : le factuel est immuable, les interprétations
// s'ajoutent sans jamais l'écraser, et rien ici n'écrit dans les tables de connaissances existantes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  magasinMemoireVive,
  enregistrerExperience,
  ajouterInterpretation,
  TABLES,
} from '../app/langage/connaissances.js';
import * as comprendreModule from '../app/langage/comprendre.js';
import * as espritModule from '../app/langage/esprit.js';
import * as ecranModule from '../app/langage/ecran.js';
import fs from 'node:fs';

test('experiences : table présente dans TABLES', () => {
  assert.ok(TABLES.includes('experiences'));
});

test('experiences : enregistrer puis relire renvoie la même expérience', async () => {
  const magasin = magasinMemoireVive();
  const date = new Date().toISOString();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'Quel est mon manteau ?',
    texteRepondu: 'ton manteau, c\'est un manteau bleu.',
    date, source: 'laboratoire',
    referenceMemoire: { idQuestion: 41, idReponse: 99 },
  });
  const toutes = await magasin.lireTout('experiences');
  assert.equal(toutes.length, 1);
  assert.equal(toutes[0].id, e.id);
  assert.equal(toutes[0].texteRecu, 'Quel est mon manteau ?');
  assert.equal(toutes[0].texteRepondu, 'ton manteau, c\'est un manteau bleu.');
  assert.deepEqual(toutes[0].referenceMemoire, { idQuestion: 41, idReponse: 99 });
  assert.deepEqual(toutes[0].interpretations, []);
});

test('experiences : texteRecu/texteRepondu préservés même sans référence mémoire', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'Bonjour', texteRepondu: 'Bonjour !',
    date: new Date().toISOString(), source: 'laboratoire',
  });
  assert.equal(e.referenceMemoire, null);
  assert.equal(e.texteRecu, 'Bonjour');
  assert.equal(e.texteRepondu, 'Bonjour !');
});

test('experiences : referenceMemoire garde exactement les deux ids donnés, non adjacents', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(),
    source: 'laboratoire', referenceMemoire: { idQuestion: 41, idReponse: 99 },
  });
  assert.equal(e.referenceMemoire.idQuestion, 41);
  assert.equal(e.referenceMemoire.idReponse, 99);
  assert.notEqual(e.referenceMemoire.idReponse, e.referenceMemoire.idQuestion + 1);
});

test('experiences : une seconde interprétation s\'ajoute sans effacer la première', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
  });
  const apres1 = await ajouterInterpretation(magasin, e.id, {
    origine: 'comprendre', donnees: { etat: 'compris', type: 'AFFIRMATION' },
  });
  assert.equal(apres1.interpretations.length, 1);
  const apres2 = await ajouterInterpretation(magasin, e.id, {
    origine: 'induction', donnees: { hypothese: 'X', score: 0.9 },
  });
  assert.equal(apres2.interpretations.length, 2);
  assert.deepEqual(apres2.interpretations[0].donnees, { etat: 'compris', type: 'AFFIRMATION' });
  assert.deepEqual(apres2.interpretations[1].donnees, { hypothese: 'X', score: 0.9 });
  assert.equal(apres2.texteRecu, 'x');
  assert.equal(apres2.texteRepondu, 'y');
});

test('experiences : donnees accepte des formes futures sans schéma fixe', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
  });
  const apres = await ajouterInterpretation(magasin, e.id, {
    origine: 'futur-mecanisme', donnees: { forme: 'jamais-vue-avant', imbrique: { a: [1, 2, 3] } },
  });
  assert.deepEqual(apres.interpretations[0].donnees, { forme: 'jamais-vue-avant', imbrique: { a: [1, 2, 3] } });
});

test('experiences : ajouterInterpretation sur un id inconnu échoue explicitement', async () => {
  const magasin = magasinMemoireVive();
  await assert.rejects(() => ajouterInterpretation(magasin, 'inexistant', { origine: 'x', donnees: {} }));
});

test('experiences : aucune écriture dans les 7 tables de connaissances préexistantes', async () => {
  const magasin = magasinMemoireVive();
  const e = await enregistrerExperience(magasin, {
    texteRecu: 'x', texteRepondu: 'y', date: new Date().toISOString(), source: 'laboratoire',
  });
  await ajouterInterpretation(magasin, e.id, { origine: 'comprendre', donnees: {} });
  for (const t of ['faits', 'lexique', 'patrons', 'journal', 'proprietes', 'regles', 'gabaritsTypes']) {
    assert.deepEqual(await magasin.lireTout(t), [], `la table ${t} ne doit pas avoir bougé`);
  }
});

test('experiences : comprendre.js ne référence jamais B1 (statique)', () => {
  const src = fs.readFileSync(new URL('../app/langage/comprendre.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('enregistrerExperience'));
  assert.ok(!src.includes('ajouterInterpretation'));
});

test('experiences : esprit.js ne référence jamais B1 (statique)', () => {
  const src = fs.readFileSync(new URL('../app/langage/esprit.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('enregistrerExperience'));
  assert.ok(!src.includes('ajouterInterpretation'));
});

test('experiences : ecran.js (banc d\'essai v0.17.7) ne référence jamais B1 (statique)', () => {
  const src = fs.readFileSync(new URL('../app/langage/ecran.js', import.meta.url), 'utf8');
  assert.ok(!src.includes('enregistrerExperience'));
  assert.ok(!src.includes('ajouterInterpretation'));
});

test('non-régression : comprendre() garde son comportement par défaut', () => {
  const r = comprendreModule.comprendre('Bonjour', {});
  assert.ok(r && typeof r === 'object');
});
// === FIN_TEST_EXPERIENCES ===
