// === DEBUT_TEST_SOURCE_SOI ===
// v0.63.84 — SECONDE SOURCE « SOI » (B1, décision ChatGPT du 10/10/2026) : la déclaration DESCRIPTION_SOURCE_SOI et l'extension MINIMALE du
// contrat de résolution (resoudreIdentitesDonnees) : une ligne de valeurs SANS champ `source` est un message (inchangé) ; une ligne AVEC un champ
// propre `source` est résolue par cette déclaration. La table valeursDonnees reste réservée aux messages (clés closes, valeur chaîne).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import { DESCRIPTION_SOURCE_SOI } from '../app/langage/source-soi.js';
import { DESCRIPTION_SOURCE_MESSAGE } from '../app/langage/source-message.js';
import { donneeDeSource } from '../app/langage/donnee-de-source.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { magasinMemoireVive, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');

test('A1. DESCRIPTION_SOURCE_SOI : déclaration gelée, forme scalaire nombre, accès champ « valeur » ; même langage que la source message, aucune fonction, aucun import', () => {
  assert.deepEqual(DESCRIPTION_SOURCE_SOI, { forme: { forme: 'scalaire', genre: 'nombre' }, acces: { champ: 'valeur' } });
  assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_SOI), true); assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_SOI.forme), true); assert.equal(Object.isFrozen(DESCRIPTION_SOURCE_SOI.acces), true);
  assert.deepEqual(Object.keys(DESCRIPTION_SOURCE_SOI), Object.keys(DESCRIPTION_SOURCE_MESSAGE));
  assert.notDeepEqual(DESCRIPTION_SOURCE_SOI.forme, DESCRIPTION_SOURCE_MESSAGE.forme);
  const src = lu('app', 'langage', 'source-soi.js');
  assert.equal(/^import /m.test(src), false); assert.equal(/function|=>|if \(|for \(/.test(src.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')), false);
  // donneeDeSource l'accepte comme toute déclaration de source : identité de la ligne, forme déclarée (copie neuve).
  const d = donneeDeSource({ id: 'etat-1', valeur: 3 }, DESCRIPTION_SOURCE_SOI);
  assert.deepEqual(d, { identite: 'etat-1', forme: { forme: 'scalaire', genre: 'nombre' } });
  assert.notEqual(d.forme, DESCRIPTION_SOURCE_SOI.forme);
});

test('A2. resoudreIdentitesDonnees : une ligne sans `source` reste un MESSAGE (forme chaîne, inchangé) ; une ligne avec `source: DESCRIPTION_SOURCE_SOI` est résolue en nombre, même porteur, même accès « valeur »', () => {
  const message = { id: 'message-1', valeur: 'bonjour' };
  const etat = { id: 'etat-propre-1', valeur: 2, source: DESCRIPTION_SOURCE_SOI };
  const r = resoudreIdentitesDonnees(['message-1', 'etat-propre-1'], [message, etat], [], DESCRIPTIONS_OPERATIONS);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].donnee, { identite: 'message-1', forme: { forme: 'scalaire', genre: 'chaine' } });
  assert.equal(r[0].porteur, message);
  assert.deepEqual(r[1].donnee, { identite: 'etat-propre-1', forme: { forme: 'scalaire', genre: 'nombre' } });
  assert.equal(r[1].porteur, etat);
  assert.deepEqual(r[0].acces, r[1].acces);
  assert.equal(valeurDePorteur(r[1].porteur, r[1].donnee, r[1].acces), 2);
  assert.equal(valeurDePorteur(r[0].porteur, r[0].donnee, r[0].acces), 'bonjour');
  // Rien n'est deviné d'un contenu : un message dont la valeur serait un nombre reste déclaré chaîne ; une ligne soi dont la valeur serait une chaîne reste déclarée nombre.
  assert.deepEqual(resoudreIdentitesDonnees(['m'], [{ id: 'm', valeur: 7 }], [], [])[0].donnee.forme, { forme: 'scalaire', genre: 'chaine' });
  assert.deepEqual(resoudreIdentitesDonnees(['e'], [{ id: 'e', valeur: 'x', source: DESCRIPTION_SOURCE_SOI }], [], [])[0].donnee.forme, { forme: 'scalaire', genre: 'nombre' });
});

test('A3. une déclaration de source invalide (sans forme, nulle, accesseur) est refusée ; les règles d\'unicité et de collision sont inchangées pour les lignes soi', () => {
  assert.throws(() => resoudreIdentitesDonnees(['e'], [{ id: 'e', valeur: 1, source: null }], [], []), TypeError);
  assert.throws(() => resoudreIdentitesDonnees(['e'], [{ id: 'e', valeur: 1, source: {} }], [], []), TypeError);
  assert.throws(() => resoudreIdentitesDonnees(['e'], [{ id: 'e', valeur: 1, source: { forme: { forme: 'inconnue' } } }], [], []), TypeError);
  const accesseur = { id: 'e', valeur: 1 }; Object.defineProperty(accesseur, 'source', { get: () => DESCRIPTION_SOURCE_SOI, enumerable: true });
  assert.throws(() => resoudreIdentitesDonnees(['e'], [accesseur], [], []), TypeError);
  assert.throws(() => resoudreIdentitesDonnees(['e'], [{ id: 'e', valeur: 1, source: DESCRIPTION_SOURCE_SOI }, { id: 'e', valeur: 'x' }], [], []), /même identité/);
  const execution = { id: 'e', horodatage: 't', idDesignation: 'd', operation: 'symbolesDeChaine', liaisons: [{ entree: 'texte', donnee: 'm' }], resultat: ['a'] };
  assert.throws(() => resoudreIdentitesDonnees(['e'], [{ id: 'm', valeur: 'a' }, { id: 'e', valeur: 1, source: DESCRIPTION_SOURCE_SOI }], [execution], DESCRIPTIONS_OPERATIONS), /message ET par une exécution/);
  assert.throws(() => resoudreIdentitesDonnees(['x'], [{ id: 'e', valeur: 1, source: DESCRIPTION_SOURCE_SOI }], [], []), TypeError);
});

test('A4. la table valeursDonnees reste réservée aux MESSAGES : enregistrerValeurDonnee refuse un nombre et un champ `source`', async () => {
  const magasin = magasinMemoireVive();
  await assert.rejects(() => enregistrerValeurDonnee(magasin, { id: 'etat', valeur: 3 }), /valeur doit être une chaîne/);
  await assert.rejects(() => enregistrerValeurDonnee(magasin, { id: 'etat', valeur: '3', source: DESCRIPTION_SOURCE_SOI }), /champ étranger/);
  assert.deepEqual(await magasin.lireTout('valeursDonnees'), []);
});

test('A5. les épisodes (.69) lisent une ligne soi comme toute donnée : « soi:tour(etat) » d\'un état 3 vers une production 2 = relation differente, valeurs { 3, 2 } ; un message et un état ne se confondent jamais', () => {
  const valeurs = [{ id: 'message-1', valeur: '3' }, { id: 'etat-0', valeur: 3, source: DESCRIPTION_SOURCE_SOI }];
  const executions = [{ id: 'variation-1', horodatage: 't', idDesignation: 'tour-1', operation: 'soi:tour', liaisons: [{ entree: 'etat', donnee: 'etat-0' }], resultat: 2 }];
  const descriptions = [...DESCRIPTIONS_OPERATIONS, { nom: 'soi:tour', entrees: { etat: { forme: 'scalaire', genre: 'nombre' } }, sortie: { forme: 'scalaire', genre: 'nombre' } }];
  const { episodes } = episodesDeTransformation(valeurs, executions, descriptions);
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].depart, 'etat-0'); assert.equal(episodes[0].arrivee, 'variation-1'); assert.equal(episodes[0].relationValeur, 'differente');
  assert.deepEqual(episodes[0].valeurs, { depart: 3, arrivee: 2 });
  // le message '3' (chaîne) n'entre dans aucun épisode : aucune exécution ne le relie à quoi que ce soit
  assert.equal(episodes.some((e) => e.depart === 'message-1' || e.arrivee === 'message-1'), false);
});
// === FIN_TEST_SOURCE_SOI ===
