// === DEBUT_TEST_PROJECTION_SOI ===
// v0.63.84 — PROJECTION « SOI » (B1) : vue pure qui présente l'état propre et ses variations persistées aux mécanismes d'expérience comme des
// exécutions « soi:tour / soi:repos (etat) → nouvel état » d'UN pas, et les états comme données de source déclarées. Pureté, identités dérivées
// stables, refus de l'incohérent, aucune lignée cumulative, aucun nombre connu.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import { projeterSoi, identiteEtatApres, PREFIXE_SOI, ENTREE_ETAT, PREFIXE_ETAT_PROPRE, TYPES_CAUSE_SOI } from '../app/langage/projection-soi.js';
import { DESCRIPTION_SOURCE_SOI } from '../app/langage/source-soi.js';
import { executionsVecues } from '../app/langage/executions-vecues.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

const ORIGINE = Object.freeze({ id: 'capacite-initiale-1', horodatage: '2026-10-10T00:00:00.000Z', valeur: 3 });
const V = (n, type, idCause, idEtatAvant, valeur) => Object.freeze({ id: `variation-capacite-${n}`, horodatage: `2026-10-10T00:00:0${n}.000Z`, cause: Object.freeze({ type, id: idCause }), idEtatAvant, valeur });
// 3 → tour → 2 → tour → 1 → repos → 2 → repos → 3 → repos → 3 (saturation)
const V1 = V(1, 'tour', 'obs-1', ORIGINE.id, 2);
const V2 = V(2, 'tour', 'obs-2', identiteEtatApres(V1), 1);
const V3 = V(3, 'repos', 'tick-1', identiteEtatApres(V2), 2);
const V4 = V(4, 'repos', 'tick-2', identiteEtatApres(V3), 3);
const V5 = V(5, 'repos', 'tick-3', identiteEtatApres(V4), 3);
const VARIATIONS = Object.freeze([V1, V2, V3, V4, V5]);

test('A1. constantes et identité dérivée : préfixe soi:, entrée etat, PREFIXE_ETAT_PROPRE + id de la variation, deux types de cause (tour, repos) ; module pur (aucune écriture, horloge, hasard, magasin, nombre)', () => {
  assert.equal(PREFIXE_SOI, 'soi:'); assert.equal(ENTREE_ETAT, 'etat'); assert.equal(PREFIXE_ETAT_PROPRE, 'etat-propre-');
  assert.deepEqual([...TYPES_CAUSE_SOI], ['tour', 'repos']); assert.equal(Object.isFrozen(TYPES_CAUSE_SOI), true);
  assert.equal(identiteEtatApres(V1), 'etat-propre-variation-capacite-1');
  assert.throws(() => identiteEtatApres({ id: '' }), TypeError); assert.throws(() => identiteEtatApres(null), TypeError);
  const code = sansCommentaires(lu('app', 'langage', 'projection-soi.js'));
  assert.equal(/magasin|lireTout|ecrire\(|Date\.now|new Date|Math\.random|localStorage|plafond|PARAMETRES/.test(code), false);
  assert.equal(/prefer|préfér|score|recompense|récompense|maximis|bien|mauvais/i.test(code), false);
  assert.match(code, /^import \{ DESCRIPTION_SOURCE_SOI \} from '\.\/source-soi\.js';$/m);
  assert.equal((code.match(/^import /gm) || []).length, 1);
});

test('A2. projeterSoi : une donnée d\'état par origine et par variation (source déclarée soi), une exécution synthétique par variation (idDesignation = cause, liaison etat = état d\'avant, résultat = nouvel état), une description par opération présente', () => {
  const p = projeterSoi(ORIGINE, VARIATIONS);
  assert.deepEqual(p.valeurs.map((v) => [v.id, v.valeur]), [[ORIGINE.id, 3], ['etat-propre-variation-capacite-1', 2], ['etat-propre-variation-capacite-2', 1], ['etat-propre-variation-capacite-3', 2], ['etat-propre-variation-capacite-4', 3], ['etat-propre-variation-capacite-5', 3]]);
  for (const v of p.valeurs) assert.equal(v.source, DESCRIPTION_SOURCE_SOI);
  assert.deepEqual(p.executions[0], { id: 'variation-capacite-1', horodatage: V1.horodatage, idDesignation: 'obs-1', operation: 'soi:tour', liaisons: [{ entree: 'etat', donnee: ORIGINE.id }], resultat: 2 });
  assert.deepEqual(p.executions[2], { id: 'variation-capacite-3', horodatage: V3.horodatage, idDesignation: 'tick-1', operation: 'soi:repos', liaisons: [{ entree: 'etat', donnee: 'etat-propre-variation-capacite-2' }], resultat: 2 });
  assert.deepEqual(p.executions[4].resultat, 3); assert.equal(p.executions[4].liaisons[0].donnee, 'etat-propre-variation-capacite-4');
  assert.deepEqual(p.descriptions, [
    { nom: 'soi:repos', entrees: { etat: { forme: 'scalaire', genre: 'nombre' } }, sortie: { forme: 'scalaire', genre: 'nombre' } },
    { nom: 'soi:tour', entrees: { etat: { forme: 'scalaire', genre: 'nombre' } }, sortie: { forme: 'scalaire', genre: 'nombre' } },
  ]);
  // une seule opération présente → une seule description ; aucune variation → origine seule, rien d'autre
  assert.deepEqual(projeterSoi(ORIGINE, [V1]).descriptions.map((d) => d.nom), ['soi:tour']);
  assert.deepEqual(projeterSoi(ORIGINE, []), { valeurs: [{ id: ORIGINE.id, valeur: 3, source: DESCRIPTION_SOURCE_SOI }], executions: [], descriptions: [] });
});

test('A3. PURETÉ ET STABILITÉ : entrées jamais modifiées, sorties neuves, résultat identique quel que soit l\'ordre des lignes et d\'un appel à l\'autre (reconstruction après redémarrage)', () => {
  const avant = JSON.stringify([ORIGINE, VARIATIONS]);
  const a = projeterSoi(ORIGINE, VARIATIONS);
  const b = projeterSoi(ORIGINE, [...VARIATIONS].reverse());
  const c = projeterSoi(JSON.parse(JSON.stringify(ORIGINE)), JSON.parse(JSON.stringify(VARIATIONS)));
  assert.equal(JSON.stringify([ORIGINE, VARIATIONS]), avant);
  const tri = (p) => ({ valeurs: [...p.valeurs].sort((x, y) => x.id.localeCompare(y.id)), executions: [...p.executions].sort((x, y) => x.id.localeCompare(y.id)), descriptions: p.descriptions });
  assert.deepEqual(tri(a), tri(b)); assert.deepEqual(tri(a), tri(c));
  assert.notEqual(a.executions[0].liaisons, b.executions[0].liaisons);
  a.descriptions[0].sortie.genre = 'x'; assert.equal(DESCRIPTION_SOURCE_SOI.forme.genre, 'nombre');
});

test('A4. REFUS (TypeError, rien de partiel) : origine ou variation mal formée, valeur non numérique, type de cause inconnu, cause en double, identité en double, état d\'avant inconnu, variation partant de son propre état, fourche', () => {
  assert.throws(() => projeterSoi(null, []), TypeError);
  assert.throws(() => projeterSoi({ id: 'o' }, []), TypeError);
  assert.throws(() => projeterSoi({ id: 'o', valeur: '3' }, []), TypeError);
  assert.throws(() => projeterSoi(ORIGINE, null), TypeError);
  assert.throws(() => projeterSoi(ORIGINE, [{ ...V1, valeur: '2' }]), /nombre fini/);
  assert.throws(() => projeterSoi(ORIGINE, [{ ...V1, cause: { type: 'acte', id: 'x' } }]), /inconnu/);
  assert.throws(() => projeterSoi(ORIGINE, [V1, { ...V2, cause: { type: 'tour', id: 'obs-1' } }]), /même cause/);
  assert.throws(() => projeterSoi(ORIGINE, [V1, { ...V2, id: V1.id }]), /même identité|portent l'identité/);
  assert.throws(() => projeterSoi(ORIGINE, [{ ...V1, idEtatAvant: 'ailleurs' }]), /ni l'origine ni l'état d'après/);
  assert.throws(() => projeterSoi(ORIGINE, [{ ...V1, idEtatAvant: identiteEtatApres(V1) }]), /propre état|fourche|ni l'origine/);
  assert.throws(() => projeterSoi(ORIGINE, [V1, { ...V2, idEtatAvant: ORIGINE.id, cause: { type: 'tour', id: 'obs-9' } }]), /fourche/);
  const accesseur = { id: 'v', horodatage: 't', cause: { type: 'tour', id: 'c' }, idEtatAvant: ORIGINE.id }; Object.defineProperty(accesseur, 'valeur', { get: () => 2, enumerable: true });
  assert.throws(() => projeterSoi(ORIGINE, [accesseur]), /accesseur/);
});

test('A5. AUCUNE LIGNÉE CUMULATIVE : avec les mécanismes .69/.70 inchangés, chaque variation donne UN épisode d\'un pas (l\'état d\'après est une donnée de source, pas la production de la variation) ; familles soi:tour(etat) et soi:repos(etat) seulement ; relations differente / egale à saturation', () => {
  const p = projeterSoi(ORIGINE, VARIATIONS);
  const { episodes } = episodesDeTransformation(p.valeurs, p.executions, [...DESCRIPTIONS_OPERATIONS, ...p.descriptions]);
  assert.equal(episodes.length, 5);
  for (const e of episodes) assert.equal(e.chemin.length, 1);
  assert.deepEqual(episodes.map((e) => [e.chemin[0].operation, e.relationValeur, e.valeurs.depart, e.valeurs.arrivee]).sort(), [
    ['soi:repos', 'differente', 1, 2], ['soi:repos', 'differente', 2, 3], ['soi:repos', 'egale', 3, 3], ['soi:tour', 'differente', 2, 1], ['soi:tour', 'differente', 3, 2],
  ].sort());
  const { familles } = famillesDEpisodes({ episodes });
  assert.deepEqual(familles.map((f) => f.structure.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>')).sort(), ['soi:repos(etat)', 'soi:tour(etat)']);
  // 50 variations enchaînées : toujours 50 épisodes (linéaire), jamais n(n+1)/2
  let etat = ORIGINE.id; const longue = [];
  for (let i = 1; i <= 50; i++) { const v = V(i, i % 2 ? 'tour' : 'repos', `c-${i}`, etat, i % 2 ? 2 : 3); longue.push(v); etat = identiteEtatApres(v); }
  const q = projeterSoi(ORIGINE, longue);
  assert.equal(episodesDeTransformation(q.valeurs, q.executions, [...DESCRIPTIONS_OPERATIONS, ...q.descriptions]).episodes.length, 50);
});

test('A6. executionsVecues : sans origine de capacité, rien de soi n\'est ajouté (valeurs = lignes réelles) ; avec origine, données d\'état, exécutions et descriptions soi sont concaténées APRÈS le réel et les environnements ; deux origines = refus', () => {
  const faits = { valeurs: [{ id: 'm', valeur: 'x' }], executions: [], emissions: [], receptions: [] };
  const sans = executionsVecues(faits, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(sans, { valeurs: faits.valeurs, executions: [], descriptions: DESCRIPTIONS_OPERATIONS });
  assert.notEqual(sans.valeurs, faits.valeurs);
  const avec = executionsVecues({ ...faits, capaciteInitiale: [ORIGINE], variationsCapacite: VARIATIONS }, DESCRIPTIONS_OPERATIONS);
  assert.equal(avec.valeurs.length, 7); assert.equal(avec.valeurs[0], faits.valeurs[0]); assert.equal(avec.valeurs[1].id, ORIGINE.id);
  assert.equal(avec.executions.length, 5); assert.equal(avec.descriptions.length, DESCRIPTIONS_OPERATIONS.length + 2);
  assert.throws(() => executionsVecues({ ...faits, capaciteInitiale: [ORIGINE, ORIGINE], variationsCapacite: [] }, DESCRIPTIONS_OPERATIONS), /plusieurs origines/);
  assert.throws(() => executionsVecues({ ...faits, capaciteInitiale: null }, DESCRIPTIONS_OPERATIONS), TypeError);
});
// === FIN_TEST_PROJECTION_SOI ===
