// v0.66.9 — Capacité EN ESSAI « Réceptions par jour » (classe E du robot) : app/capacites-essai/catalogue.json + receptions-par-jour.js.
// Contrôlé ici : executer (comptage par jour, numéro, entrée vide ou mal formée), recevabilité du catalogue par la porte
// (declarationsLivrees avec les TABLES de l'application, module DÉRIVÉ de l'identifiant), analyse statique du module (analyserSource et
// règles strictes du robot : ASCII, taille, aucun import, aucun gabarit, aucun échappement, aucune concaténation, mots interdits).
// Outillage non cognitif : rien n'est branché, la capacité reste inactive après installation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { executer } from '../app/capacites-essai/receptions-par-jour.js';
import * as M from '../app/capacites-essai/receptions-par-jour.js';
import { declarationsLivrees, validerDeclaration, CATALOGUE } from '../app/essais/registre-essais.js';
import { analyserSource } from '../app/essais/analyse.js';
import { TABLES } from '../app/langage/connaissances.js';

const URL_MODULE = new URL('../app/capacites-essai/receptions-par-jour.js', import.meta.url);
const URL_CATALOGUE = new URL('../app/capacites-essai/catalogue.json', import.meta.url);
const OCTETS = readFileSync(URL_MODULE);
const SOURCE = OCTETS.toString('utf8');
const CAT = JSON.parse(readFileSync(URL_CATALOGUE, 'utf8'));

const r = (horodatage) => (horodatage === undefined ? { id: 'x' } : { id: 'x', horodatage });
const ligneUnique = (sortie) => {
  assert.ok(sortie && Array.isArray(sortie.lignes));
  assert.equal(sortie.lignes.length, 1);
  return sortie.lignes[0];
};

test('executer : trois réceptions sur deux jours, comptées par les 10 premiers caractères de l\'horodatage', () => {
  const receptions = [r('2026-10-25T08:00:00.000Z'), r('2026-10-25T21:30:00.000Z'), r('2026-10-26T07:15:00.000Z')];
  const l = ligneUnique(executer({ lues: { receptions }, miennes: [], contexte: {} }));
  assert.deepEqual(l.donnees.jours, { '2026-10-25': 2, '2026-10-26': 1 });
  assert.equal(l.donnees.total, 3);
  assert.deepEqual(Object.keys(l.donnees).sort(), ['jours', 'numero', 'total']);
});

test('executer : réception sans horodatage (ou horodatage non texte) comptée sous « inconnu »', () => {
  const receptions = [r(), r(42), r('2026-10-25T08:00:00.000Z'), null, 'texte'];
  const l = ligneUnique(executer({ lues: { receptions }, miennes: [] }));
  assert.deepEqual(l.donnees.jours, { inconnu: 4, '2026-10-25': 1 });
  assert.equal(l.donnees.total, 5);
});

test('executer : numéro = plus grand numéro déjà écrit + 1, clé = numéro en texte', () => {
  const a = ligneUnique(executer({ lues: { receptions: [] }, miennes: [] }));
  assert.equal(a.donnees.numero, 1);
  assert.equal(a.cle, '1');
  const miennes = [{ cle: '2', donnees: { numero: 2 } }, { cle: '5', donnees: { numero: 5 } }];
  const b = ligneUnique(executer({ lues: { receptions: [] }, miennes }));
  assert.equal(b.donnees.numero, 6);
  assert.equal(b.cle, '6');
  // lignes déjà écrites mal formées : ignorées
  const c = ligneUnique(executer({ lues: { receptions: [] }, miennes: [null, 7, { donnees: null }, { donnees: { numero: 'x' } }, { donnees: { numero: 3 } }] }));
  assert.equal(c.donnees.numero, 4);
  assert.equal(c.cle, '4');
});

test('executer : entrée vide, absente ou mal formée, aucune erreur (numéro 1, jours {}, total 0)', () => {
  const entrees = [undefined, null, {}, 7, 'texte', [], { lues: null }, { lues: { receptions: 'non' } }, { lues: { receptions: null } },
    { lues: { receptions: {} } }, { lues: { receptions: [] }, miennes: 'non' }, { lues: { receptions: [] }, miennes: null }];
  const sorties = [executer(), ...entrees.map((e) => executer(e))];
  for (const s of sorties) {
    const l = ligneUnique(s);
    assert.equal(l.cle, '1');
    assert.deepEqual(l.donnees, { numero: 1, jours: {}, total: 0 });
  }
  // lignes lues nulles ou non objets : comptées sous « inconnu », sans erreur
  const l = ligneUnique(executer({ lues: { receptions: [null, undefined, 3] }, miennes: [null] }));
  assert.deepEqual(l.donnees, { numero: 1, jours: { inconnu: 3 }, total: 3 });
});

test('executer : le résultat contient exactement une ligne, quelle que soit l\'entrée', () => {
  const receptions = Array.from({ length: 30 }, (_, i) => r(`2026-10-${10 + (i % 5)}T00:00:00.000Z`));
  const l = ligneUnique(executer({ lues: { receptions }, miennes: [{ donnees: { numero: 1 } }] }));
  assert.equal(l.donnees.total, 30);
  assert.equal(Object.keys(l.donnees.jours).length, 5);
  assert.equal(l.donnees.numero, 2);
});

test('catalogue : forme exacte, recevable par declarationsLivrees avec les TABLES, module dérivé de l\'identifiant', () => {
  assert.deepEqual(Object.keys(CAT).sort(), ['capacites', 'format', 'v']);
  assert.equal(CAT.format, 'naissance-capacites-essai');
  assert.equal(CAT.v, 1);
  assert.equal(CAT.capacites.length, 1);
  const brut = CAT.capacites[0];
  assert.deepEqual(Object.keys(brut).sort(), ['declencheurs', 'delaiMs', 'description', 'effet', 'id', 'invariants', 'lit', 'maxLignes', 'titre']);
  assert.equal(brut.id, 'receptions-par-jour');
  assert.equal(brut.titre, 'Réceptions par jour');
  assert.equal(typeof brut.description, 'string');
  assert.deepEqual(brut.lit, ['receptions']);
  assert.equal(brut.effet, 'zone-essai');
  assert.deepEqual(brut.declencheurs, ['apres-tour', 'manuel']);
  assert.equal(brut.delaiMs, 2000);
  assert.equal(brut.maxLignes, 1);
  assert.deepEqual(brut.invariants, [{ type: 'champs', champs: ['numero', 'jours', 'total'] }, { type: 'unique', champ: 'numero' }, { type: 'apres-installation' }]);
  assert.ok(!('module' in brut));
  assert.ok(!CATALOGUE.some((d) => d.id === brut.id), 'identifiant distinct du catalogue figé');

  const { declarations, refus } = declarationsLivrees(CAT, { tables: TABLES });
  assert.deepEqual(refus, []);
  assert.equal(declarations.length, 1);
  assert.equal(declarations[0].id, 'receptions-par-jour');
  assert.equal(declarations[0].module, '../capacites-essai/receptions-par-jour.js');
  assert.equal(validerDeclaration(declarations[0], TABLES), null);
});

test('module : un seul export (executer) et analyserSource sans aucun refus', () => {
  assert.deepEqual(Object.keys(M), ['executer']);
  assert.equal(typeof executer, 'function');
  const a = analyserSource(SOURCE);
  assert.deepEqual(a.refus, []);
  assert.deepEqual(a.imports, []);
});

test('module : ASCII seul et 20 Ko au plus', () => {
  assert.ok(OCTETS.length <= 20480, `${OCTETS.length} octets`);
  assert.ok(OCTETS.length <= 20000, 'borne du robot (MODULE_OCTETS_MAX)');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(SOURCE), 'caractère hors ASCII imprimable');
});

test('module : règles strictes du robot (classe E), commentaires compris', () => {
  assert.ok(!SOURCE.includes('`'), 'gabarit de texte');
  assert.ok(!/\\[ux]/.test(SOURCE), 'échappement unicode ou hexa');
  assert.ok(!/['"]\s*\+|\+\s*['"]/.test(SOURCE), 'concaténation de textes');
  assert.equal((SOURCE.match(/^export function executer\(/gm) || []).length, 1);
  assert.equal((SOURCE.match(/\bexport\b/g) || []).length, 1, 'un seul export');
  const MOTS_ROBOT = ['import', 'require', 'eval', 'Function', 'constructor', 'prototype', '__proto__', 'globalThis', 'self', 'window', 'document',
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'Worker', 'SharedWorker', 'ServiceWorker', 'BroadcastChannel', 'postMessage',
    'importScripts', 'setTimeout', 'setInterval', 'setImmediate', 'queueMicrotask', 'requestAnimationFrame', 'Promise', 'async', 'await',
    'then', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'navigator', 'location', 'crypto', 'Reflect', 'Proxy', 'Symbol',
    'WebAssembly', 'Atomics', 'SharedArrayBuffer', 'Intl', 'fromCharCode', 'fromCodePoint', 'join', 'concat', 'replace', 'replaceAll',
    'raw', 'defineProperty', 'getPrototypeOf', 'setPrototypeOf', 'getOwnPropertyDescriptor', 'with', 'arguments', 'callee', 'bind',
    'apply', 'call', 'this', 'new', 'class', 'debugger', 'atob', 'btoa', 'escape', 'unescape', 'decodeURI', 'decodeURIComponent'];
  const re = new RegExp(`\\b(${MOTS_ROBOT.join('|')})\\b`);
  assert.equal((SOURCE.match(re) || [null])[0], null, 'mot interdit par le robot');
  // mots interdits par le ticket
  assert.ok(!/\bfor\s*\([^)]*\bof\b/.test(SOURCE), 'boucle for...of');
  assert.ok(!SOURCE.includes('String('), 'String()');
  assert.ok(!SOURCE.includes('slice'), 'slice');
});
