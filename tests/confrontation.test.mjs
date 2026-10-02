// === DEBUT_TEST_CONFRONTATION ===
// v0.36.0 — DÉCISION CHATGPT « PRIMITIVE A : CONFRONTATION » (02/10).
//
// Nouvelle primitive INTERNE, indépendante du langage et du flux conversationnel : confronter deux
// résultats déjà obtenables (faits directs ou compositions) pour dire s'ils sont égaux, différents,
// inconnus (absence d'information) ou en conflit (plusieurs valeurs persistées pour une même
// identité). AUCUN raccord à comprendre()/repondre() dans ce chantier (capacité B, hors périmètre,
// cadrée séparément) : ce fichier n'importe donc jamais comprendre.js ni repondre().
//
// Réutilise STRICTEMENT resoudreChemin() (esprit.js) pour obtenir une valeur — jamais réinventé ici.
// La seule chose que resoudreChemin() ne distingue pas (il renvoie null aussi bien pour « inconnu »
// que pour « conflit », un choix documenté là-bas : « abstient de la même façon ») est précisément ce
// que confronter() doit distinguer : voir confrontation.js pour le mécanisme de qualification du null.
//
// Domaine ARTIFICIEL neutre (zuno/zdos/zrelX...), comme pour les chantiers précédents (v0.33/v0.34),
// pour isoler la capacité sans la mélanger avec aucune notion de grammaire française.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import {
  confronterValeurs, confronter, confronterToutes,
  ETAT_EGAL, ETAT_DIFFERENT, ETAT_INCONNU, ETAT_CONFLIT,
} from '../app/langage/confrontation.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

// ---------------------------------------------------------------------------------------------
// FAMILLE 1 — ÉGAL
// ---------------------------------------------------------------------------------------------
test('1. confronterValeurs : deux valeurs identiques → egal', () => {
  assert.equal(confronterValeurs('zvaleur', 'zvaleur'), ETAT_EGAL);
});

test('1. confronter : deux faits directs de même valeur → egal', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'zcouleur', valeur: 'zbleu' });
  const r = confronter(esprit, { sujetA: 'zuno', cheminA: ['zcouleur'], sujetB: 'zdos', cheminB: ['zcouleur'] });
  assert.equal(r.etat, ETAT_EGAL);
  assert.equal(r.valeurA, 'zbleu');
  assert.equal(r.valeurB, 'zbleu');
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 2 — DIFFÉRENT
// ---------------------------------------------------------------------------------------------
test('2. confronterValeurs : deux valeurs distinctes → different', () => {
  assert.equal(confronterValeurs('zvaleur1', 'zvaleur2'), ETAT_DIFFERENT);
});

test('2. confronter : deux faits directs de valeurs distinctes → different', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'ztaille', valeur: 'zgrand' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'ztaille', valeur: 'zpetit' });
  const r = confronter(esprit, { sujetA: 'zuno', cheminA: ['ztaille'], sujetB: 'zdos', cheminB: ['ztaille'] });
  assert.equal(r.etat, ETAT_DIFFERENT);
  assert.equal(r.valeurA, 'zgrand');
  assert.equal(r.valeurB, 'zpetit');
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 3 — INCONNU (absence d'information ≠ différence : règle fondamentale explicite)
// ---------------------------------------------------------------------------------------------
test('3. confronter : un côté connu, l\'autre jamais enseigné → inconnu, jamais different', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zvitesse', valeur: 'zrapide' });
  const r = confronter(esprit, { sujetA: 'zuno', cheminA: ['zvitesse'], sujetB: 'zdos', cheminB: ['zvitesse'] });
  assert.equal(r.etat, ETAT_INCONNU);
  assert.notEqual(r.etat, ETAT_DIFFERENT);
});

test('3. confronter : les deux côtés inconnus → inconnu', async () => {
  const { esprit } = await nouvelEsprit();
  const r = confronter(esprit, { sujetA: 'zinconnuA', cheminA: ['zrien'], sujetB: 'zinconnuB', cheminB: ['zrien'] });
  assert.equal(r.etat, ETAT_INCONNU);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 4 — CONFLIT (distinct d'« inconnu » : même si resoudreChemin() renvoie null dans les
// deux cas, confronter() doit les qualifier différemment)
// ---------------------------------------------------------------------------------------------
test('4. confronter : un côté en conflit de faits → conflit, jamais confondu avec inconnu', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zcouleur', valeur: 'zrouge' });
  // Deux lignes réellement persistées, même identité (zdos|zcouleur), valeurs différentes → conflit
  // (même procédé que composition-connaissances.test.mjs et identifiants.test.mjs).
  await magasin.ecrire('faits', { cle: 'ligneA', sujet: 'zdos', relation: 'zcouleur', valeur: 'zvert' });
  await magasin.ecrire('faits', { cle: 'ligneB', sujet: 'zdos', relation: 'zcouleur', valeur: 'zjaune' });
  const esprit2 = await chargerEsprit(magasin);
  assert.ok(esprit2.conflitsFaits.has('zdos|zcouleur'), 'précondition : le conflit doit être détecté par le chargement normal');
  const r = confronter(esprit2, { sujetA: 'zuno', cheminA: ['zcouleur'], sujetB: 'zdos', cheminB: ['zcouleur'] });
  assert.equal(r.etat, ETAT_CONFLIT);
  assert.notEqual(r.etat, ETAT_INCONNU);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 5 — DEUX CHEMINS COMPOSÉS
// ---------------------------------------------------------------------------------------------
test('5. confronter : deux chemins composés (plusieurs étapes de chaque côté) → egal', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zdevient', valeur: 'zunoB' });
  await apprendreFait(esprit, { sujet: 'zunoB', relation: 'zproduit', valeur: 'zfruit' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'zdevient', valeur: 'zdosB' });
  await apprendreFait(esprit, { sujet: 'zdosB', relation: 'zproduit', valeur: 'zfruit' });
  const r = confronter(esprit, {
    sujetA: 'zuno', cheminA: ['zdevient', 'zproduit'],
    sujetB: 'zdos', cheminB: ['zdevient', 'zproduit'],
  });
  assert.equal(r.etat, ETAT_EGAL);
  assert.equal(r.valeurA, 'zfruit');
  assert.equal(r.valeurB, 'zfruit');
});

test('5. confronter : deux chemins composés qui aboutissent à des valeurs différentes → different', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zdevient', valeur: 'zunoB' });
  await apprendreFait(esprit, { sujet: 'zunoB', relation: 'zproduit', valeur: 'zfruitA' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'zdevient', valeur: 'zdosB' });
  await apprendreFait(esprit, { sujet: 'zdosB', relation: 'zproduit', valeur: 'zfruitB' });
  const r = confronter(esprit, {
    sujetA: 'zuno', cheminA: ['zdevient', 'zproduit'],
    sujetB: 'zdos', cheminB: ['zdevient', 'zproduit'],
  });
  assert.equal(r.etat, ETAT_DIFFERENT);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 6 — DIRECT vs COMPOSÉ (chemins de longueurs différentes de chaque côté)
// ---------------------------------------------------------------------------------------------
test('6. confronter : un fait direct d\'un côté, une composition à deux étapes de l\'autre → egal si même valeur finale', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zcible', valeur: 'zdestination' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'zetape1', valeur: 'zdosB' });
  await apprendreFait(esprit, { sujet: 'zdosB', relation: 'zetape2', valeur: 'zdestination' });
  const r = confronter(esprit, {
    sujetA: 'zuno', cheminA: ['zcible'],
    sujetB: 'zdos', cheminB: ['zetape1', 'zetape2'],
  });
  assert.equal(r.etat, ETAT_EGAL);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 7 — PLUSIEURS RELATIONS (confronterToutes, liste EXPLICITE)
// ---------------------------------------------------------------------------------------------
test('7. confronterToutes : classe correctement plusieurs relations explicites (identiques/différentes/inconnues)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'zcouleur', valeur: 'zbleu' }); // identique
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'ztaille', valeur: 'zgrand' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'ztaille', valeur: 'zpetit' }); // différente
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zvitesse', valeur: 'zrapide' }); // inconnue côté zdos

  const r = confronterToutes(esprit, { sujetA: 'zuno', sujetB: 'zdos', relations: ['zcouleur', 'ztaille', 'zvitesse'] });
  assert.deepEqual(r.identiques.map((x) => x.relation), ['zcouleur']);
  assert.deepEqual(r.differentes.map((x) => x.relation), ['ztaille']);
  assert.deepEqual(r.inconnues.map((x) => x.relation), ['zvitesse']);
  assert.deepEqual(r.conflits, []);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 8 — CONFLIT PARTIEL DANS confronterToutes (une relation en conflit n'empêche pas les autres)
// ---------------------------------------------------------------------------------------------
test('8. confronterToutes : une relation en conflit n\'interrompt pas le classement des autres', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zhabitat', valeur: 'zforet' });
  await magasin.ecrire('faits', { cle: 'ligneA', sujet: 'zdos', relation: 'zhabitat', valeur: 'zforet' });
  await magasin.ecrire('faits', { cle: 'ligneB', sujet: 'zdos', relation: 'zhabitat', valeur: 'zdesert' });
  const esprit2 = await chargerEsprit(magasin);

  const r = confronterToutes(esprit2, { sujetA: 'zuno', sujetB: 'zdos', relations: ['zcouleur', 'zhabitat'] });
  assert.deepEqual(r.identiques.map((x) => x.relation), ['zcouleur']);
  assert.deepEqual(r.conflits.map((x) => x.relation), ['zhabitat']);
  assert.deepEqual(r.differentes, []);
  assert.deepEqual(r.inconnues, []);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 9 — SYMÉTRIE
// ---------------------------------------------------------------------------------------------
test('9. confronter : symétrique (A,B) et (B,A) donnent le même état, quel que soit le cas', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'ztaille', valeur: 'zgrand' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'ztaille', valeur: 'zpetit' });
  const r1 = confronter(esprit, { sujetA: 'zuno', cheminA: ['ztaille'], sujetB: 'zdos', cheminB: ['ztaille'] });
  const r2 = confronter(esprit, { sujetA: 'zdos', cheminA: ['ztaille'], sujetB: 'zuno', cheminB: ['ztaille'] });
  assert.equal(r1.etat, r2.etat);
  assert.equal(r1.valeurA, r2.valeurB);
  assert.equal(r1.valeurB, r2.valeurA);
});

test('9. confronter : symétrique aussi pour inconnu', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zvitesse', valeur: 'zrapide' });
  const r1 = confronter(esprit, { sujetA: 'zuno', cheminA: ['zvitesse'], sujetB: 'zdos', cheminB: ['zvitesse'] });
  const r2 = confronter(esprit, { sujetA: 'zdos', cheminA: ['zvitesse'], sujetB: 'zuno', cheminB: ['zvitesse'] });
  assert.equal(r1.etat, ETAT_INCONNU);
  assert.equal(r2.etat, ETAT_INCONNU);
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 10 — AUCUNE ÉCRITURE MÉMOIRE
// ---------------------------------------------------------------------------------------------
test('10. confronter/confronterToutes : aucune écriture en base, jamais', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'zcouleur', valeur: 'zbleu' });
  const avant = JSON.stringify(await magasin.lireTout('faits'));
  confronter(esprit, { sujetA: 'zuno', cheminA: ['zcouleur'], sujetB: 'zdos', cheminB: ['zcouleur'] });
  confronterToutes(esprit, { sujetA: 'zuno', sujetB: 'zdos', relations: ['zcouleur'] });
  const apres = JSON.stringify(await magasin.lireTout('faits'));
  assert.equal(apres, avant, 'ni confronter() ni confronterToutes() ne doivent écrire en mémoire');
});

// ---------------------------------------------------------------------------------------------
// FAMILLE 11 — ÉGALITÉ CANONIQUE DES VALEURS (sans jamais modifier la valeur stockée)
// ---------------------------------------------------------------------------------------------
test('11. confronterValeurs : égalité CANONIQUE (accent/casse/espaces) sans modifier les valeurs d\'origine', () => {
  assert.equal(confronterValeurs('Zbleu', 'zbleu'), ETAT_EGAL, 'casse différente : canoniquement égal');
  assert.equal(confronterValeurs('zblé', 'zble'), ETAT_EGAL, 'accent différent : canoniquement égal');
  assert.equal(confronterValeurs(' zbleu ', 'zbleu'), ETAT_EGAL, 'espaces de bord : canoniquement égal');
  assert.equal(confronterValeurs('zbleu', 'zvert'), ETAT_DIFFERENT, 'reste capable de dire different');
});

test('11. confronter : deux faits dont les valeurs ne diffèrent que par la graphie → egal, et les faits stockés restent inchangés', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zuno', relation: 'zcouleur', valeur: 'Zbleu' });
  await apprendreFait(esprit, { sujet: 'zdos', relation: 'zcouleur', valeur: 'zbleu' });
  const faitUnoAvant = { ...esprit.faits.get('zuno|zcouleur') };
  const faitDosAvant = { ...esprit.faits.get('zdos|zcouleur') };
  const r = confronter(esprit, { sujetA: 'zuno', cheminA: ['zcouleur'], sujetB: 'zdos', cheminB: ['zcouleur'] });
  assert.equal(r.etat, ETAT_EGAL, 'égalité canonique, pas une égalité stricte de chaîne');
  assert.equal(r.valeurA, 'Zbleu', 'la valeur renvoyée est celle réellement stockée, jamais canonisée');
  assert.equal(r.valeurB, 'zbleu');
  // Garde-fou explicite (décision ChatGPT) : les valeurs originales restent STRICTEMENT inchangées.
  assert.deepEqual(esprit.faits.get('zuno|zcouleur'), faitUnoAvant);
  assert.deepEqual(esprit.faits.get('zdos|zcouleur'), faitDosAvant);
});

// === FIN_TEST_CONFRONTATION ===
