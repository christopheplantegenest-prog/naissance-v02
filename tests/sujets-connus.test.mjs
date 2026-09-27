// === DEBUT_TEST_SUJETS_CONNUS ===
// v0.21 — DÉCISION CHATGPT « DÉBLOQUER LA RÉUTILISATION DES CONNAISSANCES DE COURS » (Piste A).
//
// Principe : le sujet d'une connaissance RÉELLEMENT apprise (un Fait) devient un sujet reconnu, sans
// nouveau rôle lexical ni liste persistée à part -- sujetsConnus (esprit.js) est dérivé des MÊMES
// lignes que prenomsConnus (départ + apprises, conflits compris), jamais stocké, toujours reconstruit
// au chargement. RELATIONS_PRENOM garde son rôle propre pour les prénoms de personnes ; les deux
// ensembles sont vérifiés côte à côte par trouverSujet() (comprendre.js).
//
// La limite reproduite (MESSAGE POUR CHATGPT — BLOCAGE RÉUTILISATION DES CONNAISSANCES) : un fait
// Néria → lunes → deux était bien écrit, mais aucune question nommant « Néria » ne le retrouvait
// (comprehension.sujet === null). Le test RED ci-dessous le prouve sur EXACTEMENT ce cas.

import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait, apprendreRelation, repondre } from '../app/langage/esprit.js';
import { comprendre } from '../app/langage/comprendre.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

async function espritAvecNeria() {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'lunes', relation: 'lunes' });
  await apprendreFait(esprit, { sujet: 'Néria', relation: 'lunes', valeur: 'deux' });
  return magasin;
}

test('RED (limite reproduite) — sans sujetsConnus, « Néria » ne serait pas reconnu (contrôle direct de comprendre())', () => {
  // Preuve directe, sans passer par esprit.js : comprendre() reçoit ici sujetsConnus VIDE, exactement
  // le comportement d'avant la Piste A. Si ce test échouait, ce serait le signe que le nouveau
  // paramètre est devenu obligatoire ou que son absence est déjà comblée ailleurs par erreur.
  const lexique = { lunes: { role: 'relation', relation: 'lunes' } };
  const c = comprendre('Combien de lunes a Néria ?', { lexique, prenomsConnus: new Set(), sujetsConnus: new Set() });
  assert.equal(c.sujet, null, 'sans sujetsConnus, « Néria » reste non reconnu -- c\'est bien la limite d\'avant ce chantier');
});

test('APRÈS CORRECTION — un fait réellement appris (Néria → lunes → deux) rend « Néria » reconnu comme sujet', async () => {
  const magasin = await espritAvecNeria();
  const esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'Combien de lunes a Néria ?');
  assert.equal(r.comprehension.sujet, 'neria');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'deux');
});

test('1. un AUTRE sujet arbitraire appris fonctionne SANS modification du code (généralité, pas un cas particulier « Néria »)', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'localisation', relation: 'localisation' });
  await apprendreFait(esprit, { sujet: 'Térane', relation: 'localisation', valeur: 'la mer d\'Olis' });
  await apprendreRelation(esprit, { mot: 'pattes', relation: 'pattes' });
  await apprendreFait(esprit, { sujet: 'zorales', relation: 'pattes', valeur: 'six' });
  const rechargé = await chargerEsprit(magasin);
  const r1 = repondre(rechargé, 'Où se trouve Térane ?');
  assert.equal(r1.comprehension.sujet, 'terane');
  assert.equal(r1.etat, 'compris');
  const r2 = repondre(rechargé, 'Combien de pattes ont les zorales ?');
  assert.equal(r2.comprehension.sujet, 'zorales');
  assert.equal(r2.etat, 'compris');
});

test('2. un mot simplement RENCONTRÉ dans une phrase (jamais sujet d\'un Fait appris) ne devient PAS un sujet reconnu', async () => {
  const magasin = await espritAvecNeria();
  const esprit = await chargerEsprit(magasin);
  // « Morn » apparaît dans une phrase qu'on POSE en question, mais n'a jamais été le sujet d'un Fait
  // appris (seule « Néria » l'a été, ci-dessus) : il ne doit pas devenir un sujet reconnu pour autant.
  const r = repondre(esprit, 'Quelle est la couleur de Morn ?');
  assert.notEqual(r.comprehension.sujet, 'morn', '« Morn » n\'a jamais été appris comme sujet d\'un Fait : il ne doit pas être reconnu');
});

test('3. le comportement historique de moi / naissance / prénoms appris reste intact', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'couleur', relation: 'couleur' });
  await apprendreFait(esprit, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await apprendreFait(esprit, { sujet: 'naissance', relation: 'couleur', valeur: 'rouge' });
  await apprendreRelation(esprit, { mot: 'fils', relation: 'fils' });
  await apprendreFait(esprit, { sujet: 'moi', relation: 'fils', valeur: 'Atem' });
  const rechargé = await chargerEsprit(magasin);
  assert.equal(repondre(rechargé, 'Quelle est ma couleur ?').comprehension.sujet, 'moi');
  assert.equal(repondre(rechargé, 'Quelle est ta couleur ?').comprehension.sujet, 'naissance');
  assert.equal(repondre(rechargé, 'Quelle est la couleur de Atem ?').comprehension.sujet, 'atem', 'un prénom appris (relation fils) reste reconnu comme avant');
  assert.ok(rechargé.prenomsConnus.has('atem'), 'RELATIONS_PRENOM/prenomsConnus garde son rôle propre, inchangé');
});

test('4. fermeture/réouverture simulée : le sujet reste reconnaissable depuis les connaissances persistantes', async () => {
  const magasin = await espritAvecNeria();
  // Un premier esprit (déjà utilisé pour apprendre) est abandonné ; seul le magasin persiste.
  const espritRouvert = await chargerEsprit(magasin);
  assert.ok(espritRouvert.sujetsConnus.has('neria'), 'sujetsConnus est reconstruit depuis les Faits persistés, pas conservé en mémoire d\'un esprit précédent');
  const r = repondre(espritRouvert, 'Combien de lunes a Néria ?');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'deux');
});

test('5. aucune dépendance à Gemini ni à l\'historique de conversation pour cette reconnaissance', async () => {
  // Tout ce test tient sans appelerGemini, sans prose de cours, sans historique : seulement
  // apprendreFait() (esprit.js, primitive locale) et repondre() (le vrai moteur). La reconnaissance
  // du sujet est un effet de bord PUREMENT LOCAL de l'écriture d'un Fait.
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'capitale', relation: 'capitale' });
  await apprendreFait(esprit, { sujet: 'Néria', relation: 'capitale', valeur: 'Térane' });
  const r = repondre(esprit, 'Quelle est la capitale de Néria ?');
  assert.equal(r.comprehension.sujet, 'neria');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Térane');
});
// === FIN_TEST_SUJETS_CONNUS ===
