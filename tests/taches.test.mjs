// Liste de tâches persistante (ticket-37, jalon taches-stockage) : module pur app/taches/taches.js,
// stockage en mémoire (Map) injecté.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as moduleTaches from '../app/taches/taches.js';
import { CLE_TACHES, lireTaches, ajouterTache, terminerTache } from '../app/taches/taches.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(join(RACINE, 'app', 'taches', 'taches.js'), 'utf8');

function stockageMemoire() {
  const m = new Map();
  const s = {
    ecritures: 0,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { s.ecritures += 1; m.set(k, String(v)); },
    brut: () => m.get(CLE_TACHES),
  };
  return s;
}

test('clé dédiée et exports exacts', () => {
  assert.equal(CLE_TACHES, 'naissance-ia.taches.v1');
  assert.deepEqual(Object.keys(moduleTaches).sort(), ['CLE_TACHES', 'ajouterTache', 'lireTaches', 'terminerTache']);
});

test('stockage vide puis premier ajout', () => {
  const s = stockageMemoire();
  assert.deepEqual(lireTaches(s), []);
  const r = ajouterTache('Acheter du pain', s);
  assert.equal(r.ok, true);
  assert.equal(r.id, 1);
  assert.deepEqual(r.taches, [{ id: 1, texte: 'Acheter du pain', terminee: false }]);
  assert.deepEqual(lireTaches(s), [{ id: 1, texte: 'Acheter du pain', terminee: false }]);
});

test('deux ajouts : ordre de création, id 1 puis 2, texte conservé tel quel', () => {
  const s = stockageMemoire();
  const a = ajouterTache('Acheter du pain', s);
  const b = ajouterTache(' a  b ', s);
  assert.equal(a.id, 1);
  assert.equal(b.id, 2);
  assert.deepEqual(lireTaches(s), [
    { id: 1, texte: 'Acheter du pain', terminee: false },
    { id: 2, texte: ' a  b ', terminee: false },
  ]);
});

test('id = plus grand id existant + 1, sans tri de l\'ordre enregistré', () => {
  const s = stockageMemoire();
  s.setItem(CLE_TACHES, JSON.stringify({ v: 1, taches: [{ id: 5, texte: 'z', terminee: false }, { id: 2, texte: 'a', terminee: true }] }));
  const r = ajouterTache('m', s);
  assert.equal(r.id, 6);
  assert.deepEqual(lireTaches(s).map((t) => t.id), [5, 2, 6]);
});

test('texte vide, fait d\'espaces ou non chaîne : erreur vide, stockage inchangé', () => {
  const s = stockageMemoire();
  ajouterTache('Acheter du pain', s);
  const avant = s.brut();
  const ecrituresAvant = s.ecritures;
  for (const t of ['', '   ', 42]) {
    const r = ajouterTache(t, s);
    assert.equal(r.ok, false);
    assert.equal(r.erreur, 'vide');
    assert.deepEqual(r.taches, [{ id: 1, texte: 'Acheter du pain', terminee: false }]);
  }
  assert.equal(s.brut(), avant);
  assert.equal(s.ecritures, ecrituresAvant);
  const vide = stockageMemoire();
  assert.equal(ajouterTache('', vide).erreur, 'vide');
  assert.equal(vide.ecritures, 0);
  assert.equal(vide.brut(), undefined);
});

test('terminerTache : seule la tâche visée, idempotente, id inconnu refusé sans écriture', () => {
  const s = stockageMemoire();
  ajouterTache('Acheter du pain', s);
  ajouterTache('Appeler Paul', s);
  const r = terminerTache(1, s);
  assert.equal(r.ok, true);
  assert.deepEqual(r.taches, [
    { id: 1, texte: 'Acheter du pain', terminee: true },
    { id: 2, texte: 'Appeler Paul', terminee: false },
  ]);
  assert.deepEqual(lireTaches(s), r.taches);
  const r2 = terminerTache(1, s);
  assert.equal(r2.ok, true);
  assert.deepEqual(lireTaches(s), r.taches);
  const avant = s.brut();
  const ecrituresAvant = s.ecritures;
  const r3 = terminerTache(99, s);
  assert.equal(r3.ok, false);
  assert.equal(r3.erreur, 'inconnue');
  assert.deepEqual(r3.taches, r.taches);
  assert.equal(s.brut(), avant);
  assert.equal(s.ecritures, ecrituresAvant);
});

test('persistance : relecture sur le même stockage, contenu brut { v: 1, taches }', () => {
  const s = stockageMemoire();
  ajouterTache('Acheter du pain', s);
  ajouterTache('Lire', s);
  terminerTache(2, s);
  const premiere = lireTaches(s);
  const rechargee = lireTaches(s);
  assert.deepEqual(rechargee, premiere);
  assert.deepEqual(JSON.parse(s.brut()), {
    v: 1,
    taches: [
      { id: 1, texte: 'Acheter du pain', terminee: false },
      { id: 2, texte: 'Lire', terminee: true },
    ],
  });
  // copies : modifier le résultat ne touche pas le stockage
  rechargee[0].texte = 'autre';
  assert.equal(lireTaches(s)[0].texte, 'Acheter du pain');
});

test('contenus abîmés ou stockage absent : aucune exception, [] ou entrées valides seulement', () => {
  const cas = (brut) => { const s = stockageMemoire(); s.setItem(CLE_TACHES, brut); return s; };
  assert.deepEqual(lireTaches(cas('{abîmé')), []);
  assert.deepEqual(lireTaches(cas(JSON.stringify({ v: 2, taches: [{ id: 1, texte: 'x', terminee: false }] }))), []);
  assert.deepEqual(lireTaches(cas(JSON.stringify({ v: 1, taches: 'non' }))), []);
  assert.deepEqual(lireTaches(cas(JSON.stringify({ v: 1 }))), []);
  assert.deepEqual(lireTaches(cas('null')), []);
  assert.deepEqual(lireTaches(cas('[]')), []);
  const melange = cas(JSON.stringify({ v: 1, taches: [
    { id: 1, texte: 'bon', terminee: false },
    { id: 0, texte: 'id nul', terminee: false },
    { id: 1.5, texte: 'id non entier', terminee: false },
    { id: '3', texte: 'id chaîne', terminee: false },
    { id: 4, texte: 7, terminee: false },
    { id: 5, texte: 'terminee non booléen', terminee: 'oui' },
    null,
    'texte',
    { id: 6, texte: 'aussi bon', terminee: true },
  ] }));
  assert.deepEqual(lireTaches(melange), [
    { id: 1, texte: 'bon', terminee: false },
    { id: 6, texte: 'aussi bon', terminee: true },
  ]);
  assert.doesNotThrow(() => lireTaches(null));
  assert.deepEqual(lireTaches(null), []);
  const casse = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
  assert.deepEqual(lireTaches(casse), []);
  assert.deepEqual(lireTaches(stockageMemoire()), []);
});

test('setItem qui lève : erreur stockage, tâches précédentes rendues', () => {
  const s = stockageMemoire();
  ajouterTache('Acheter du pain', s);
  const precedentes = lireTaches(s);
  s.setItem = () => { throw new Error('plein'); };
  const a = ajouterTache('Nouvelle', s);
  assert.equal(a.ok, false);
  assert.equal(a.erreur, 'stockage');
  assert.deepEqual(a.taches, precedentes);
  const t = terminerTache(1, s);
  assert.equal(t.ok, false);
  assert.equal(t.erreur, 'stockage');
  assert.deepEqual(t.taches, precedentes);
  assert.deepEqual(lireTaches(s), precedentes);
  const n = ajouterTache('x', null);
  assert.equal(n.ok, false);
  assert.equal(n.erreur, 'stockage');
  assert.deepEqual(n.taches, []);
});

test('statique : aucun import, aucun réseau, aucune base, aucune horloge ni hasard', () => {
  for (const m of [/\bimport\b/, /\brequire\s*\(/, /\bfetch\b/, /XMLHttpRequest/, /indexedDB/i, /sessionStorage/, /\bDate\b/, /Math\.random/,
    /langage\//, /memoire\//, /esprit\//, /atelier/i]) {
    assert.equal(m.test(SOURCE), false, String(m));
  }
  assert.match(SOURCE, /export const CLE_TACHES = 'naissance-ia\.taches\.v1';/);
  const exportes = [...SOURCE.matchAll(/^export\s+(?:const|function)\s+([A-Za-z_]+)/gm)].map((x) => x[1]).sort();
  assert.deepEqual(exportes, ['CLE_TACHES', 'ajouterTache', 'lireTaches', 'terminerTache']);
});
