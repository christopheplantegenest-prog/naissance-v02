// v0.23 — DÉCISION CHATGPT « FERMER LA CHAÎNE APPRENTISSAGE → COMPORTEMENT ».
//
// Le diagnostic précédent (rapport « CHAÎNE RÉGULARITÉ → GÉNÉRALISATION ») a établi que la chaîne
//   exemples → induire() → gabarit généralisable → apprendreGabaritType() → persistance
//   → trouverType() → reconnaissance d'une phrase JAMAIS VUE
// fonctionne déjà (voir tests/pont-induction.test.mjs), mais que comprehension.type n'était ensuite
// JAMAIS lu par repondre() : une signification reconnue ne produisait donc AUCUN effet observable.
//
// Ce fichier prouve la fermeture de cette chaîne, avec des noms et un contenu ENTIÈREMENT FICTIFS
// (aucun rapport avec une catégorie grammaticale française réelle, aucun « if (type === ...) »
// codé en dur) :
//   1. plusieurs exemples permettent d'induire une régularité (le mot-déclencheur inventé « ziqualo »)
//   2. la régularité est confirmée avec une signification arbitraire, TYPE_X
//   3. TYPE_X reçoit un comportement enseigné — un Fait ORDINAIRE (sujet: TYPE_X, relation:
//      RELATION_COMPORTEMENT), enseigné exactement comme n'importe quel autre Fait
//   4. une phrase nouvelle, absente des exemples, matche la régularité
//   5. AVANT ce chantier : comprehension.type === 'TYPE_X', mais la réponse enseignée n'est jamais
//      produite (repondre() ignore comprehension.type)
//   6. APRÈS ce chantier : la réponse enseignée EST produite pour la phrase jamais vue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre, AFFIRMATION } from '../app/langage/comprendre.js';
import { chargerEsprit, repondre, apprendreGabaritType, apprendreFait, RELATION_COMPORTEMENT } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { induire } from '../app/langage/induction.js';
import { LEXIQUE_DEPART, ROLES } from '../app/langage/bagage.js';

// Vocabulaire ENTIÈREMENT INVENTÉ : « bouloir » comme relation-mot, « ziqualo » comme marqueur —
// aucun des deux n'existe dans le bagage de départ ni dans aucune règle de grammaire française.
const LEX = { ...LEXIQUE_DEPART, bouloir: { role: ROLES.RELATION, relation: 'bouloir' } };

const POSITIFS = ['Ziqualo, mon bouloir est vert.', 'Ziqualo, ma teinte est jaune.'];
const NEGATIFS = ['Mon bouloir est vert.', 'Ma teinte est jaune.'];
const TEMOIN = 'Ziqualo, mon zestion est grand.'; // jamais dans POSITIFS/NEGATIFS ; « zestion » et
// « grand » sont eux aussi inconnus du lexique : seul le marqueur « ziqualo » importe pour le type.
const REPONSE_ENSEIGNEE = 'Wouiiip splong tralala !'; // contenu fictif, sans rapport avec le français

async function fabriquerEspritAvecTypeAppris(magasin) {
  const esprit = await chargerEsprit(magasin);
  const rapport = induire(POSITIFS, NEGATIFS, { lexique: LEX });
  const h = rapport.hypotheses[0];
  await apprendreGabaritType(esprit, { candidats: h.candidats, gabarits: h.gabarits, signification: 'TYPE_X', exemples: h.couverture });
  return esprit;
}

// ============================================================================ 1. Induction et reconnaissance (déjà acquis, non-régression)
test('1. la régularité inventée est bien induite, et la phrase témoin est reconnue TYPE_X', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await fabriquerEspritAvecTypeAppris(magasin);
  assert.equal(repondre(esprit, TEMOIN).comprehension.type, 'TYPE_X');
});

// ============================================================================ 2. RUPTURE (RED) : signification reconnue, mais AUCUN comportement enseigné
test('2. TANT QU’AUCUN comportement n’est enseigné pour TYPE_X : la signification est reconnue, la réponse reste générique', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await fabriquerEspritAvecTypeAppris(magasin);
  const r = repondre(esprit, TEMOIN);
  assert.equal(r.comprehension.type, 'TYPE_X'); // la reconnaissance, elle, fonctionne déjà.
  assert.notEqual(r.texte, REPONSE_ENSEIGNEE); // mais rien de la signification n'atteint la réponse.
  assert.ok(!r.viaType);
});

// ============================================================================ 3. FERMETURE DE LA CHAÎNE : comportement enseigné → réponse produite
test('3. APRÈS ENSEIGNEMENT du comportement (un Fait ordinaire) : la phrase JAMAIS VUE produit la réponse enseignée', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await fabriquerEspritAvecTypeAppris(magasin);
  await apprendreFait(esprit, { sujet: 'TYPE_X', relation: RELATION_COMPORTEMENT, valeur: REPONSE_ENSEIGNEE });
  const r = repondre(esprit, TEMOIN);
  assert.equal(r.comprehension.type, 'TYPE_X');
  assert.equal(r.texte, REPONSE_ENSEIGNEE);
  assert.ok(r.viaType);
  assert.equal(r.fait.sujet, 'TYPE_X');
  assert.equal(r.fait.relation, RELATION_COMPORTEMENT);
});

// ============================================================================ 4. NON-RÉGRESSION : une phrase sans le marqueur reste inchangée
test('4. une phrase SANS le marqueur inventé reste AFFIRMATION, jamais affectée par le comportement de TYPE_X', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await fabriquerEspritAvecTypeAppris(magasin);
  await apprendreFait(esprit, { sujet: 'TYPE_X', relation: RELATION_COMPORTEMENT, valeur: REPONSE_ENSEIGNEE });
  const r = repondre(esprit, 'Mon bouloir est vert.');
  assert.equal(r.comprehension.type, AFFIRMATION);
  assert.notEqual(r.texte, REPONSE_ENSEIGNEE);
  assert.ok(!r.viaType);
});

// ============================================================================ 5. PERSISTANCE : survit à un rechargement complet
test('5. APRÈS RECHARGEMENT COMPLET (nouvel esprit, même magasin) : régularité ET comportement restent utilisables', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await fabriquerEspritAvecTypeAppris(magasin);
  await apprendreFait(esprit, { sujet: 'TYPE_X', relation: RELATION_COMPORTEMENT, valeur: REPONSE_ENSEIGNEE });
  const frais = await chargerEsprit(magasin); // nouvel objet esprit, RELIT le magasin depuis zéro
  const r = repondre(frais, TEMOIN);
  assert.equal(r.comprehension.type, 'TYPE_X');
  assert.equal(r.texte, REPONSE_ENSEIGNEE);
  assert.ok(r.viaType);
});

// ============================================================================ 6. GARDE-FOU : les trois types STRUCTURELS ne sont jamais détournés
test('6. un Fait « comportement » enseigné sous le nom d’un type STRUCTUREL (affirmation) ne détourne jamais une AFFIRMATION ordinaire', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'affirmation', relation: RELATION_COMPORTEMENT, valeur: 'DÉTOURNEMENT' });
  const r = repondre(esprit, 'Mon bouloir est vert.');
  assert.equal(r.comprehension.type, AFFIRMATION);
  assert.notEqual(r.texte, 'DÉTOURNEMENT');
  assert.ok(!r.viaType);
});

// ============================================================================ 7. AUCUN comportement codé en dur : le mécanisme est générique
test('7. GARDE-FOU — repondre()/esprit.js ne contient aucun test sur une signification particulière', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const chemin = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'esprit.js');
  const src = readFileSync(chemin, 'utf8');
  assert.ok(!/===\s*['"`](SALUTATION|TYPE_X|VERIFICATION|QUESTION_INFORMATION)['"`]/.test(src));
});
