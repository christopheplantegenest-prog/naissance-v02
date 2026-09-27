// === DEBUT_TEST_RELATIONS_COMPOSEES ===
// v0.22 — DÉCISION CHATGPT « CORRECTION GÉNÉRALE DES UNITÉS LINGUISTIQUES MULTI-MOTS ».
//
// Suite du chantier « sujets connus à plusieurs mots » (tests/sujets-composes.test.mjs) : le même
// principe (« l'identité d'une unité linguistique n'est pas forcément un seul mot ») s'appliquait
// encore de façon incomplète aux RELATIONS, aux NOMS DE PROPRIÉTÉS, et aux SUJETS/RELATIONS DES
// PATRONS DIRECTS — trois troncatures artificielles au premier token (decouper(...)[0]) identifiées
// par le diagnostic dédié (MESSAGE POUR CHATGPT « UNITÉS LINGUISTIQUES MULTI-MOTS »).
//
// Cas réel qui a révélé le blocage relation (cours envoyé par Christophe le 27/09) : « Le
// département de la Charente se situe en France » réellement appris (sujet composé déjà corrigé),
// puis « Où se situe le département de la Charente ? » — sujet reconnu, mais relation résolue à
// « se » seul (premier mot de « se situe en ») : le Fait, dont la clé utilise la relation COMPLÈTE,
// restait introuvable malgré une compréhension « compris ».

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chargerEsprit, apprendreFait, apprendreRelation, apprendrePropriete, apprendreRegle,
  apprendrePatronDirect, repondre, appliquerRegles,
} from '../app/langage/esprit.js';
import { comprendre } from '../app/langage/comprendre.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

test('1. relation simple existante (un seul mot) : aucune régression', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'capitale', relation: 'capitale' });
  await apprendreFait(esprit, { sujet: 'grand royaume', relation: 'capitale', valeur: 'Térane' });
  const rechargé = await chargerEsprit(magasin);
  const r = repondre(rechargé, 'Quelle est la capitale du grand royaume ?');
  assert.equal(r.comprehension.relation, 'capitale');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Térane');
});

test('2. « se situe en » (relation à trois mots) est stockée et retrouvée intégralement', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'se', relation: 'se situe en' });
  await apprendreFait(esprit, { sujet: 'grand lac', relation: 'se situe en', valeur: 'Sud' });
  const rechargé = await chargerEsprit(magasin);
  assert.ok(rechargé.relationsConnues.has('se situe en'), 'relationsConnues doit contenir la relation complète, non tronquée');
  const r = repondre(rechargé, 'Où se situe le grand lac ?');
  assert.equal(r.comprehension.relation, 'se situe en', 'la relation résolue doit être la séquence complète, plus tronquée à « se »');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Sud');
});

test('3. cas réel intégral : département de la Charente / se situe en / France → réponse locale', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'se', relation: 'se situe en' });
  await apprendreFait(esprit, { sujet: 'département de la Charente', relation: 'se situe en', valeur: 'France' });
  const rechargé = await chargerEsprit(magasin);
  const r = repondre(rechargé, 'Où se situe le département de la Charente ?');
  assert.equal(r.comprehension.sujet, 'departement de la charente');
  assert.equal(r.comprehension.relation, 'se situe en');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'France', 'réponse locale fondée sur le Fait appris -- aucun recours à Gemini');
});

test('4. une AUTRE relation composée, différente, prouve que le correctif n\'est pas spécifique au cas Charente', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'tourne', relation: 'tourne autour de' });
  await apprendreFait(esprit, { sujet: 'planète Ymir', relation: 'tourne autour de', valeur: 'Sol' });
  const rechargé = await chargerEsprit(magasin);
  const r = repondre(rechargé, 'Autour de quoi tourne la planète Ymir ?');
  assert.equal(r.comprehension.relation, 'tourne autour de');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Sol');
});

test('5. chevauchement court/long : la relation composée la plus longue gagne', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  // Deux relations connues, l'une incluse dans l'autre au début : « vit » (1 mot) et
  // « vit depuis longtemps » (3 mots), toutes deux réellement apprises via un Fait.
  await apprendreRelation(esprit, { mot: 'habite', relation: 'vit' });
  await apprendreFait(esprit, { sujet: 'Elior', relation: 'vit', valeur: 'ici (court)' });
  await apprendreRelation(esprit, { mot: 'reside', relation: 'vit depuis longtemps' });
  await apprendreFait(esprit, { sujet: 'Elior', relation: 'vit depuis longtemps', valeur: 'là (long)' });
  const rechargé = await chargerEsprit(magasin);
  const c = comprendre('Ou vit depuis longtemps Elior ?', {
    lexique: rechargé.lexique, prenomsConnus: rechargé.prenomsConnus,
    sujetsConnus: rechargé.sujetsConnus, relationsConnues: rechargé.relationsConnues,
  });
  assert.equal(c.relation, 'vit depuis longtemps', 'la correspondance connue la plus longue doit être préférée à son sous-fragment');
});

test('6. ambiguïté réelle entre deux relations connues distinctes de même longueur → aucune sélection arbitraire', () => {
  // Même principe que l'ambiguïté sur les sujets (tests/sujets-composes.test.mjs, test 8) : deux
  // séquences connues DIFFÉRENTES, de MÊME longueur, toutes deux présentes dans la même phrase --
  // rien ne permet de départager laquelle est visée, la relation doit rester non résolue.
  const c = comprendre('Est-ce que ca monte vite ou ca tombe vite ?', {
    lexique: {}, relationsConnues: new Set(['monte vite', 'tombe vite']),
  });
  assert.equal(c.relation, null, 'ambiguïté réelle entre deux relations connues de même longueur : aucun choix arbitraire');
});

test('7. nom de propriété à plusieurs mots, utilisable par une règle', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  // « voiture » a la propriété composée « genre grammatical » = « féminin ».
  await apprendrePropriete(esprit, { mot: 'voiture', propriete: 'genre grammatical', valeur: 'féminin' });
  await apprendreRegle(esprit, {
    role: 'possessif_toi',
    conditions: [{ propriete: 'genre grammatical', valeur: 'féminin' }],
    resultat: 'ta',
  });
  const rechargé = await chargerEsprit(magasin);
  assert.equal(rechargé.proprietes.get('voiture')?.get('genre grammatical'), 'feminin', 'le nom de propriété composé n\'est plus tronqué au premier mot (« genre »)');
  const r = appliquerRegles(rechargé.regles, { role: 'possessif_toi', proprietesDuMot: rechargé.proprietes.get('voiture') });
  assert.equal(r.resultat, 'ta', 'la règle, dont la condition porte sur le nom de propriété composé intégral, s\'applique bien');
});

test('8. patron (façon de dire) avec un sujet composé', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'couleur', relation: 'couleur' });
  await apprendreFait(esprit, { sujet: 'grand chateau', relation: 'couleur', valeur: 'gris' });
  await apprendrePatronDirect(esprit, { relation: 'couleur', sujet: 'grand chateau', gabarit: 'Elle est {valeur}, et rien d\'autre.' });
  const rechargé = await chargerEsprit(magasin);
  const r = repondre(rechargé, 'Quelle est la couleur du grand chateau ?');
  assert.equal(r.comprehension.sujet, 'grand chateau');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Elle est gris, et rien d\'autre.', 'le patron enregistré sous le sujet composé intégral doit être retrouvé, pas seulement le patron générique « valeur seule »');
});

test('9. patron (façon de dire) avec une relation composée', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'se', relation: 'se situe en' });
  await apprendreFait(esprit, { sujet: 'ile de Brumes', relation: 'se situe en', valeur: 'Nord' });
  await apprendrePatronDirect(esprit, { relation: 'se situe en', sujet: '*', gabarit: '{valeur}, précisément.' });
  const rechargé = await chargerEsprit(magasin);
  const r = repondre(rechargé, 'Ou se situe l\'ile de Brumes ?');
  assert.equal(r.comprehension.relation, 'se situe en');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Nord, précisément.', 'le patron enregistré sous la relation composée intégrale doit être retrouvé');
});
// === FIN_TEST_RELATIONS_COMPOSEES ===
