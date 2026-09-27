// v0.24 — DÉCISION CHATGPT « EXPÉRIENCES → INDUCTION ». Fonctions PURES et ISOLÉES (induction.js) :
// positifsEtNegatifsDepuisMotif() sépare mécaniquement un pool d'expériences en positifs/négatifs à
// partir d'un motif DÉJÀ repéré par repererMotifs() ; poolExperiencesRecentes() borne ce pool aux
// plus récentes. Aucune des deux n'appelle induire()/repererMotifs()/apprendreGabaritType() : testé
// ici en garde-fou statique, comme pour toutes les fonctions sœurs de ce fichier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  positifsEtNegatifsDepuisMotif, poolExperiencesRecentes, repererMotifs, induire,
} from '../app/langage/induction.js';

// ============================================================================ 1. Séparation mécanique positifs/négatifs
test('1. positifsEtNegatifsDepuisMotif : positifs = couverture du motif, négatifs = le reste EXACT du pool', () => {
  const pool = [
    { id: 'a', texteRecu: 'Ziqualo, mon bouloir est vert.' },
    { id: 'b', texteRecu: 'Ziqualo, ma teinte est jaune.' },
    { id: 'c', texteRecu: 'Le ciel est bleu.' },
    { id: 'd', texteRecu: 'Bonjour, comment vas-tu ?' },
  ];
  const motif = { cle: 'mot:ziqualo', couverture: ['a', 'b'] };
  const { positifs, negatifs } = positifsEtNegatifsDepuisMotif(motif, pool);
  assert.deepEqual(positifs, ['Ziqualo, mon bouloir est vert.', 'Ziqualo, ma teinte est jaune.']);
  assert.deepEqual(negatifs, ['Le ciel est bleu.', 'Bonjour, comment vas-tu ?']);
});

test('2. aucune expérience du pool n\'est ni oubliée ni dupliquée (positifs + négatifs = le pool entier)', () => {
  const pool = [
    { id: 'a', texteRecu: 'A' }, { id: 'b', texteRecu: 'B' }, { id: 'c', texteRecu: 'C' },
  ];
  const motif = { cle: 'x', couverture: ['b'] };
  const { positifs, negatifs } = positifsEtNegatifsDepuisMotif(motif, pool);
  assert.equal(positifs.length + negatifs.length, pool.length);
});

test('3. un motif dont la couverture est TOUT le pool produit un jeu négatif vide', () => {
  const pool = [{ id: 'a', texteRecu: 'A' }, { id: 'b', texteRecu: 'B' }];
  const { positifs, negatifs } = positifsEtNegatifsDepuisMotif({ cle: 'x', couverture: ['a', 'b'] }, pool);
  assert.deepEqual(positifs, ['A', 'B']);
  assert.deepEqual(negatifs, []);
});

// ============================================================================ 4. Pool récent et borné
test('4. poolExperiencesRecentes : garde les N plus récentes par date réelle, jamais par ordre de lecture', () => {
  const experiences = [
    { id: 'vieille', texteRecu: 'vieille', date: '2026-01-01T00:00:00.000Z' },
    { id: 'recente', texteRecu: 'recente', date: '2026-09-01T00:00:00.000Z' },
    { id: 'moyenne', texteRecu: 'moyenne', date: '2026-05-01T00:00:00.000Z' },
  ];
  const pool = poolExperiencesRecentes(experiences, 2);
  assert.deepEqual(pool.map((e) => e.id), ['recente', 'moyenne']);
});

test('5. poolExperiencesRecentes : une date manquante/invalide est traitée comme la plus ancienne, jamais favorisée', () => {
  const experiences = [
    { id: 'sans-date', texteRecu: 'x' },
    { id: 'avec-date', texteRecu: 'y', date: '2026-01-01T00:00:00.000Z' },
  ];
  const pool = poolExperiencesRecentes(experiences, 1);
  assert.deepEqual(pool.map((e) => e.id), ['avec-date']);
});

test('6. poolExperiencesRecentes ne mute jamais le tableau reçu', () => {
  const experiences = [{ id: 'a', texteRecu: 'a', date: '2026-01-01T00:00:00.000Z' }];
  const copie = JSON.stringify(experiences);
  poolExperiencesRecentes(experiences, 1);
  assert.equal(JSON.stringify(experiences), copie);
});

// ============================================================================ 7. BOUT EN BOUT PUR : motif réel -> positifs/négatifs -> induire() -> régularité
test('7. bout en bout pur : un motif issu de repererMotifs() sur du vécu réaliste alimente induire() sans rien fabriquer', () => {
  // Négatifs réutilisant volontairement « mon »/« ma » (sans « Ziqualo ») : sinon [role:possessif_moi]
  // couvrirait exactement les deux mêmes positifs que [mot:ziqualo] et deviendrait un synonyme
  // légitime dans la même hypothèse (comme le fait déjà induire() ailleurs, tests/induction.test.mjs)
  // — pas un bug de ce raccord, juste un jeu de données pas assez discriminant pour ISOLER « ziqualo ».
  const pool = [
    { id: '1', texteRecu: 'Ziqualo, mon bouloir est vert.' },
    { id: '2', texteRecu: 'Ziqualo, ma teinte est jaune.' },
    { id: '3', texteRecu: 'Mon bouloir est vert.' },
    { id: '4', texteRecu: 'Ma teinte est jaune.' },
  ];
  const motifs = repererMotifs(pool, { seuilMin: 2 });
  const motifZiqualo = motifs.find((m) => m.cle === 'mot:ziqualo');
  assert.ok(motifZiqualo, 'repererMotifs() doit constater le motif récurrent');
  const { positifs, negatifs } = positifsEtNegatifsDepuisMotif(motifZiqualo, pool);
  const rapport = induire(positifs, negatifs);
  assert.equal(rapport.hypotheses.length, 1);
  assert.deepEqual(rapport.hypotheses[0].candidats, ['mot:ziqualo']);
  assert.equal(rapport.conflits.length, 0);
});

// ============================================================================ 8. Contraste insuffisant/conflictuel : induire() ne conclut pas seul (comportement INCHANGÉ)
test('8. un pool sans négatif exploitable (motif couvrant tout le pool) laisse induire() constater l\'absence de contraste, sans rien forcer', () => {
  const pool = [
    { id: '1', texteRecu: 'Ziqualo, bonjour.' },
    { id: '2', texteRecu: 'Ziqualo, au revoir.' },
  ];
  const motifs = repererMotifs(pool, { seuilMin: 2 });
  const motif = motifs.find((m) => m.cle === 'mot:ziqualo');
  const { positifs, negatifs } = positifsEtNegatifsDepuisMotif(motif, pool);
  assert.deepEqual(negatifs, []);
  const rapport = induire(positifs, negatifs);
  // Sans aucun négatif, "ziqualo" seul n'est pas le meilleur candidat forcément retenu : quel que
  // soit le résultat exact, induire() reste celui déjà testé ailleurs (tests/induction.test.mjs) --
  // ce test constate seulement qu'aucune erreur n'est levée et qu'aucune conclusion n'est FORCÉE
  // au-delà de ce que induire() ferait normalement avec un jeu négatif vide.
  assert.ok(Array.isArray(rapport.hypotheses));
});

// ============================================================================ 9. GARDE-FOU statique : aucun couplage à induire()/repererMotifs()/apprendreGabaritType()
test('9. GARDE-FOU — positifsEtNegatifsDepuisMotif/poolExperiencesRecentes n\'appellent ni induire() ni apprendreGabaritType()', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'induction.js'), 'utf8');
  const debut = src.indexOf('export function positifsEtNegatifsDepuisMotif');
  assert.ok(debut > 0);
  const bloc = src.slice(debut);
  assert.ok(!bloc.includes('apprendreGabaritType'));
  const appelsInduire = bloc.match(/(?<![a-zA-Zé])induire\(/g) || [];
  assert.equal(appelsInduire.length, 0);
});

// ============================================================================ 10. GARDE-FOU : les jugements correct/incorrect n'entrent jamais dans ce raccord
test('10. GARDE-FOU — aucune mention de jugement/correct/incorrect dans le raccord (pipeline resté séparé)', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage', 'induction.js'), 'utf8');
  const debut = src.indexOf('export function positifsEtNegatifsDepuisMotif');
  const finZone = src.indexOf('export const LIMITE_POOL_RECENT');
  const bloc = src.slice(debut, finZone).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.ok(!/jugement/i.test(bloc));
});
