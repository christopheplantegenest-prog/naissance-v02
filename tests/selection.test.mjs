// === DEBUT_TEST_SELECTION ===
// v0.41 — DÉCISION CHATGPT « PROCHAINE CAPACITÉ GÉNÉRALE DE RAISONNEMENT » (02/10).
//
// Nouvelle primitive INTERNE, indépendante du langage et du flux conversationnel (même discipline que
// tests/confrontation.test.mjs, v0.36) : ÉNUMÉRER les faits déjà connus selon un critère simple (un
// sujet, ou une relation+valeur), là où confronter()/confronterToutes() exigent déjà de savoir QUOI
// comparer, et où resoudreChemin() exige déjà un CHEMIN explicite. AUCUN raccord à
// comprendre()/repondre() dans ce fichier : voir tests/selection-action.test.mjs pour le raccord via
// le registre (B2/B3), et tests/relations-repetees.test.mjs pour l'esprit de ce genre de fichier.
//
// Domaine ARTIFICIEL neutre (zalpha/zbeta/zcouleur...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { proprietesDe, proprietesCommunes, sujetsAvec } from '../app/langage/selection.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

// ---------------------------------------------------------------------------------------------
// proprietesDe
// ---------------------------------------------------------------------------------------------
test('proprietesDe : toutes les propriétés réellement connues d\'un sujet, rien d\'autre', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zforme', valeur: 'rond' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'bleu' });
  const props = proprietesDe(esprit, 'zalpha');
  assert.deepEqual(props.sort((a, b) => a.relation.localeCompare(b.relation)), [
    { relation: 'zcouleur', valeur: 'rouge' },
    { relation: 'zforme', valeur: 'rond' },
  ]);
});

test('proprietesDe : sujet totalement inconnu → tableau vide, jamais une erreur', async () => {
  const { esprit } = await nouvelEsprit();
  assert.deepEqual(proprietesDe(esprit, 'zinconnu'), []);
});

test('proprietesDe : une identité en CONFLIT n\'apparaît jamais (même garantie que resoudreChemin)', async () => {
  const { magasin, esprit: e1 } = await nouvelEsprit();
  await apprendreFait(e1, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' });
  await magasin.ecrire('faits', { cle: 'ligneA', sujet: 'zalpha', relation: 'ztaille', valeur: 'grand' });
  await magasin.ecrire('faits', { cle: 'ligneB', sujet: 'zalpha', relation: 'ztaille', valeur: 'petit' });
  const esprit = await chargerEsprit(magasin);
  assert.ok(esprit.conflitsFaits.has('zalpha|ztaille'), 'précondition : conflit détecté');
  const props = proprietesDe(esprit, 'zalpha');
  assert.deepEqual(props, [{ relation: 'zcouleur', valeur: 'rouge' }], 'ztaille (en conflit) absent');
});

test('proprietesDe : égalité de sujet CANONIQUE (accent/casse/espaces)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'Zalpha', relation: 'zcouleur', valeur: 'rouge' });
  assert.deepEqual(proprietesDe(esprit, ' zalpha '), [{ relation: 'zcouleur', valeur: 'rouge' }]);
});

// ---------------------------------------------------------------------------------------------
// proprietesCommunes
// ---------------------------------------------------------------------------------------------
test('proprietesCommunes : classe correctement identiques / différentes / uniquement A / uniquement B', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' }); // identique
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'rouge' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zforme', valeur: 'rond' }); // différente
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zforme', valeur: 'carre' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zhabitat', valeur: 'foret' }); // uniquement A
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zvitesse', valeur: 'rapide' }); // uniquement B

  const r = proprietesCommunes(esprit, { sujetA: 'zalpha', sujetB: 'zbeta' });
  assert.deepEqual(r.identiques, [{ relation: 'zcouleur', valeur: 'rouge' }]);
  assert.deepEqual(r.differentes, [{ relation: 'zforme', valeurA: 'rond', valeurB: 'carre' }]);
  assert.deepEqual(r.uniquementA, [{ relation: 'zhabitat', valeur: 'foret' }]);
  assert.deepEqual(r.uniquementB, [{ relation: 'zvitesse', valeur: 'rapide' }]);
});

test('proprietesCommunes : aucune propriété connue nulle part → quatre listes vides, jamais une erreur', async () => {
  const { esprit } = await nouvelEsprit();
  const r = proprietesCommunes(esprit, { sujetA: 'zrien1', sujetB: 'zrien2' });
  assert.deepEqual(r, {
    identiques: [], differentes: [], uniquementA: [], uniquementB: [],
  });
});

test('proprietesCommunes : égalité CANONIQUE des valeurs (accent/casse), jamais une valeur stockée modifiée', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'Rouge' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'rouge' });
  const r = proprietesCommunes(esprit, { sujetA: 'zalpha', sujetB: 'zbeta' });
  assert.deepEqual(r.identiques, [{ relation: 'zcouleur', valeur: 'Rouge' }], 'la graphie renvoyée est celle de sujetA, jamais canonisée');
});

test('proprietesCommunes : un sujet sans AUCUNE propriété connue → tout est "uniquement" l\'autre côté', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' });
  const r = proprietesCommunes(esprit, { sujetA: 'zalpha', sujetB: 'zrien' });
  assert.deepEqual(r.identiques, []);
  assert.deepEqual(r.differentes, []);
  assert.deepEqual(r.uniquementA, [{ relation: 'zcouleur', valeur: 'rouge' }]);
  assert.deepEqual(r.uniquementB, []);
});

test('proprietesCommunes : aucune écriture en mémoire, jamais', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'rouge' });
  const avant = JSON.stringify(await magasin.lireTout('faits'));
  proprietesCommunes(esprit, { sujetA: 'zalpha', sujetB: 'zbeta' });
  const apres = JSON.stringify(await magasin.lireTout('faits'));
  assert.equal(apres, avant);
});

// ---------------------------------------------------------------------------------------------
// sujetsAvec
// ---------------------------------------------------------------------------------------------
test('sujetsAvec : tous les sujets ayant une relation/valeur donnée, rien d\'autre', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zcouleur', valeur: 'rouge' });
  await apprendreFait(esprit, { sujet: 'zgamma', relation: 'zcouleur', valeur: 'bleu' });
  assert.deepEqual(sujetsAvec(esprit, { relation: 'zcouleur', valeur: 'rouge' }).sort(), ['zalpha', 'zbeta']);
});

test('sujetsAvec : aucun sujet trouvé → tableau vide, JAMAIS une abstention', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' });
  assert.deepEqual(sujetsAvec(esprit, { relation: 'zcouleur', valeur: 'vert' }), []);
});

test('sujetsAvec : égalité CANONIQUE de la relation et de la valeur (accent/casse/espaces)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'Rouge' });
  assert.deepEqual(sujetsAvec(esprit, { relation: ' ZCOULEUR ', valeur: 'rouge' }), ['zalpha']);
});

test('sujetsAvec : une identité en CONFLIT n\'est jamais retournée', async () => {
  const { magasin, esprit: e1 } = await nouvelEsprit();
  await apprendreFait(e1, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' });
  await magasin.ecrire('faits', { cle: 'ligneA', sujet: 'zbeta', relation: 'zcouleur', valeur: 'rouge' });
  await magasin.ecrire('faits', { cle: 'ligneB', sujet: 'zbeta', relation: 'zcouleur', valeur: 'vert' });
  const esprit = await chargerEsprit(magasin);
  assert.deepEqual(sujetsAvec(esprit, { relation: 'zcouleur', valeur: 'rouge' }), ['zalpha'], 'zbeta (en conflit) absent');
});

test('sujetsAvec : aucune écriture en mémoire, jamais', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zcouleur', valeur: 'rouge' });
  const avant = JSON.stringify(await magasin.lireTout('faits'));
  sujetsAvec(esprit, { relation: 'zcouleur', valeur: 'rouge' });
  const apres = JSON.stringify(await magasin.lireTout('faits'));
  assert.equal(apres, avant);
});
// === FIN_TEST_SELECTION ===
