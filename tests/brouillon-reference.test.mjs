// === DEBUT_TEST_BROUILLON_REFERENCE ===
// Chantier « RÉFÉRENCE EXPLICITE D'UNE VRAIE EXPÉRIENCE À UNE TRACE » (ÉTAPE 5.2-bis). Étend
// minimalement le brouillon existant pour porter, EN PLUS, un referenceTrace facultatif --
// tests/brouillon.test.mjs (pinné, non modifié) continue de prouver que la forme par défaut reste
// EXACTEMENT { texte, date } quand aucune référence n'est fournie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireBrouillon, garderBrouillon, effacerBrouillon } from '../app/conversation/brouillon.js';
import { fauxStockage } from './outils.mjs';

// G. ancien brouillon (déjà écrit sans jamais connaître referenceTrace) reste lisible tel quel.
test('G. un brouillon écrit par l\'ancien contrat (2 clés) reste lisible sans referenceTrace', () => {
  const s = fauxStockage();
  s.setItem('naissance-ia.message-en-attente.v1', JSON.stringify({ texte: 'vieux message', date: 'd0' }));
  assert.deepEqual(lireBrouillon(s), { texte: 'vieux message', date: 'd0' });
});

// H. un brouillon écrit AVEC une référence porte exactement { texte, date, referenceTrace }.
test('H. garderBrouillon(..., referenceTrace) persiste exactement { texte, date, referenceTrace }', () => {
  const s = fauxStockage();
  garderBrouillon('Mon message', 'd1', s, { idTrace: 'trace-77' });
  assert.deepEqual(lireBrouillon(s), { texte: 'Mon message', date: 'd1', referenceTrace: { idTrace: 'trace-77' } });
});

// Sans 4e argument (ou null), la forme reste EXACTEMENT celle du contrat pinné -- jamais de clé
// referenceTrace fantôme (undefined, null, ou objet vide).
test('sans référence : la forme reste strictement { texte, date }, aucune clé referenceTrace', () => {
  const s = fauxStockage();
  garderBrouillon('Mon message', 'd1', s);
  assert.deepEqual(Object.keys(lireBrouillon(s)).sort(), ['date', 'texte']);
  const s2 = fauxStockage();
  garderBrouillon('Mon message', 'd1', s2, null);
  assert.deepEqual(Object.keys(lireBrouillon(s2)).sort(), ['date', 'texte']);
});

// E (volet brouillon) : annuler la référence (ré-appeler garderBrouillon sans référence) conserve
// le texte déjà tapé, retire seulement referenceTrace.
test('E. annuler la référence (ré-écrire sans 4e argument) conserve le texte, retire referenceTrace', () => {
  const s = fauxStockage();
  garderBrouillon('Mon message', 'd1', s, { idTrace: 'trace-1' });
  assert.ok(lireBrouillon(s).referenceTrace);
  garderBrouillon('Mon message', 'd2', s, null);
  assert.deepEqual(lireBrouillon(s), { texte: 'Mon message', date: 'd2' });
});

// D. sélectionner T2 après T1 (deux écritures successives) : la dernière écriture remplace, jamais
// une accumulation de références.
test('D. écrire T2 après T1 remplace exactement : une seule référence tenue à la fois', () => {
  const s = fauxStockage();
  garderBrouillon('Mon message', 'd1', s, { idTrace: 'trace-1' });
  garderBrouillon('Mon message', 'd2', s, { idTrace: 'trace-2' });
  assert.deepEqual(lireBrouillon(s).referenceTrace, { idTrace: 'trace-2' });
});

// contre-exemple : un champ vidé efface toujours tout le brouillon (texte ET référence), comme
// pour le contrat existant -- aucune persistance fantôme d'une référence sans texte.
test('contre-exemple : un texte vidé efface aussi la référence (aucune persistance orpheline)', () => {
  const s = fauxStockage();
  garderBrouillon('Mon message', 'd1', s, { idTrace: 'trace-1' });
  garderBrouillon('   ', 'd2', s, { idTrace: 'trace-1' });
  assert.equal(lireBrouillon(s), null);
});

// stockage indisponible ou abîmé : toujours aucun plantage, même avec une référence fournie.
test('stockage indisponible : pas de plantage même avec une référence', () => {
  const casse = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  assert.doesNotThrow(() => garderBrouillon('t', 'd', casse, { idTrace: 'trace-1' }));
});
// === FIN_TEST_BROUILLON_REFERENCE ===
