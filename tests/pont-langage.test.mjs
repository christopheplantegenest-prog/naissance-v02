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

// Contrat changé (chantier B1 : conserver PARTIEL/INCOMPRIS) : pont.js ne jette plus la tentative
// PARTIEL/INCOMPRIS (null), il la TRANSMET pour que main.js puisse l'enregistrer honnêtement une
// fois la vraie réponse (fallback LLM) connue -- toujours sans rien journaliser ici.
// « Zorglub ? » : un seul mot, totalement inconnu -- ni sujet ni relation trouvés -> INCOMPRIS
// (vérifié sur le vrai moteur ; l'ancien intitulé de ce test le disait « PARTIEL » à tort).
test('pont : "?" mais mot inconnu (INCOMPRIS) → tentative transmise (pas local), esprit ouvert, jamais journalisé', async () => {
  const f = await faux();
  const r = await tenterPontLangage('Zorglub ?', f.deps);
  assert.ok(r);
  assert.equal(r.local, undefined);
  assert.equal(r.texte, undefined);
  assert.equal(r.tentative.etat, 'incompris');
  assert.equal(f.appels.assurerEsprit, 1);
  assert.equal(f.appels.journaliser.length, 0);
});

// « Mon gadget ? » : sujet trouvé (« mon ») mais relation inconnue (« gadget ») -> PARTIEL,
// distinct du cas INCOMPRIS ci-dessus (vérifié sur le vrai moteur).
test('pont : "?" avec sujet trouvé mais relation inconnue (PARTIEL) → tentative transmise, jamais journalisé', async () => {
  const f = await faux();
  const r = await tenterPontLangage('Mon gadget ?', f.deps);
  assert.ok(r);
  assert.equal(r.local, undefined);
  assert.equal(r.texte, undefined);
  assert.equal(r.tentative.etat, 'partiel');
  assert.equal(r.tentative.comprehension.sujet, 'moi');
  assert.equal(r.tentative.comprehension.relation, null);
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

// Intitulé corrigé : « Bibendumesque ? » est INCOMPRIS (ni sujet ni relation), pas PARTIEL -- et
// depuis ce chantier, « pas pris en charge » veut dire « pas de réponse locale finale », pas « null ».
test('pont : mot totalement inconnu (INCOMPRIS) → jamais pris en charge comme réponse locale finale', async () => {
  const f = await faux();
  const r = await tenterPontLangage('Bibendumesque ?', f.deps);
  assert.ok(r);
  assert.equal(r.local, undefined);
  assert.equal(r.tentative.etat, 'incompris');
});
// === FIN_TEST_PONT_LANGAGE ===
