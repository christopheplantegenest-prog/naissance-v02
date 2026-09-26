// === DEBUT_TEST_PONT_LANGAGE ===
// A1 — Caractérisation de tenterPontLangage(), extrait de main.js. Ces tests prouvent que la
// fonction se comporte EXACTEMENT comme le code inline d'origine, avec des dépendances injectées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tenterPontLangage } from '../app/langage/pont.js';
import { chargerEsprit, apprendreRelation, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

async function faux() {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const appels = { assurerEsprit: 0, journaliser: [] };
  return {
    magasin, appels,
    deps: {
      assurerEsprit: async () => { appels.assurerEsprit++; return e; },
      journaliser: async (q, r, d) => { appels.journaliser.push([q, r, d]); return [null, null]; },
      enregistrerExperience: async () => ({ id: 'exp-test' }),
      ajouterInterpretation: async () => {},
    },
    async apprendre(mot, relation) { await apprendreRelation(e, { mot, relation }); },
    async apprendreFaitTest(sujet, relation, valeur) { await apprendreFait(e, { sujet, relation, valeur }); },
  };
}

test('pont : pas de "?" → null, esprit jamais ouvert', async () => {
  const f = await faux();
  const r = await tenterPontLangage('Bonjour', f.deps);
  assert.equal(r, null);
  assert.equal(f.appels.assurerEsprit, 0);
});

test('pont : "?" mais mot inconnu (PARTIEL) → null, esprit ouvert, jamais journalisé', async () => {
  const f = await faux();
  const r = await tenterPontLangage('Zorglub ?', f.deps);
  assert.equal(r, null);
  assert.equal(f.appels.assurerEsprit, 1);
  assert.equal(f.appels.journaliser.length, 0);
});

test('pont : "?" + COMPRIS avec fait connu → réponse réelle, journalisée', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  const r = await tenterPontLangage('Quel est mon manteau ?', f.deps);
  assert.ok(r);
  assert.equal(r.local, true);
  assert.equal(r.laboratoire, true);
  assert.equal(r.texte, 'un manteau bleu');
  assert.equal(f.appels.journaliser.length, 1);
  assert.equal(f.appels.journaliser[0][0], 'Quel est mon manteau ?');
  assert.equal(f.appels.journaliser[0][1], 'un manteau bleu');
});

test('pont : COMPRIS sans fait connu ("couleur" déjà lexicalisée) → toujours pris en charge, journalisé', async () => {
  const f = await faux();
  const r = await tenterPontLangage('Quelle est ma couleur ?', f.deps);
  assert.ok(r);
  assert.equal(r.texte, 'Je ne sais pas.');
  assert.equal(f.appels.journaliser.length, 1);
});

test('pont : mot totalement inconnu reste PARTIEL, pas pris en charge', async () => {
  const f = await faux();
  const r = await tenterPontLangage('Bibendumesque ?', f.deps);
  assert.equal(r, null);
});
// === FIN_TEST_PONT_LANGAGE ===
