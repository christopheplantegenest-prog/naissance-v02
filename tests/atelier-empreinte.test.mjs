// v0.65.6 — AT-6 « MANUEL DE BOUT EN BOUT » (GO 17/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune acquisition.
// app/atelier/empreinte.js : SHA-256 synchrone propre à l'atelier. Preuves : vecteurs FIPS 180-4, identité avec node:crypto (UTF-8
// multioctet, astral, bornes de bloc), refus des substituts isolés, lecture des VRAIS faits atelier-faits-2 de la recette finale AT-5
// (run 39036165896) et refus des faits atelier-faits-1 de la première recette (run 39030831656), pureté.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/empreinte.js';
import { hacherSha256 } from '../app/atelier/empreinte.js';
import { lireFaits, confronter } from '../app/atelier/verification.js';
import { FAITS_RECETTE_FINALE, FAITS_PREMIERE_RECETTE } from './atelier-aide.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(RACINE, 'app', 'atelier', 'empreinte.js'), 'utf8');
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const node = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

// Faits RÉELS copiés par Christophe depuis le résumé des runs (texte exact), partagés par tests/atelier-aide.mjs.

test('vecteurs FIPS 180-4 (vide, abc, 448 et 896 bits, un million de « a »)', () => {
  assert.equal(hacherSha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(hacherSha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hacherSha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(hacherSha256('abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu'), 'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1');
  assert.equal(hacherSha256('a'.repeat(1000000)), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
});
test('UTF-8 multioctet et astral : identique à node:crypto', () => {
  for (const t of ['é', 'é', '€', '😀', 'Naissance — « atelier »', 'ÉCRAN ATELIER OFF / MANUEL', ' ', 'a😀b€c\u0000d', '日本語のテキスト']) assert.equal(hacherSha256(t), node(t), JSON.stringify(t));
});
test('200 textes déterministes (longueurs aux bornes de bloc, plans 1 à 4 octets) : identique à node:crypto', () => {
  let x = 12345;
  const alea = () => { x = (x * 1103515245 + 12345) % 2147483648; return x; };
  const points = [0x41, 0x7f, 0xe9, 0x7ff, 0x800, 0x20ac, 0xfffd, 0x1f600, 0x10ffff];
  const longueurs = [0, 1, 54, 55, 56, 57, 63, 64, 65, 118, 119, 120, 127, 128, 129, 300];
  for (let i = 0; i < 200; i += 1) {
    const n = i < longueurs.length ? longueurs[i] : alea() % 300;
    let t = '';
    for (let k = 0; k < n; k += 1) t += String.fromCodePoint(i < longueurs.length ? 0x61 : points[alea() % points.length]);
    assert.equal(hacherSha256(t), node(t), `texte ${i}`);
  }
});
test('substitut UTF-16 isolé et non-chaîne : TypeError (jamais une empreinte silencieusement fausse)', () => {
  for (const t of ['\uD800', 'a\uDC00', '\uD83D', 'x\uD83Dy', '\uDE00\uD83D']) assert.throws(() => hacherSha256(t), TypeError, JSON.stringify(t));
  for (const v of [undefined, null, 1, {}, [], new Uint8Array(1)]) assert.throws(() => hacherSha256(v), TypeError);
});
test('faits RÉELS atelier-faits-2 de la recette finale AT-5 : lus avec cette empreinte, comme avec node:crypto', () => {
  const lu = lireFaits(FAITS_RECETTE_FINALE, hacherSha256);
  assert.equal(lu.raison, undefined);
  assert.equal(lu.faits.empreinte, '7f8f187c8e2170ced363fea3be1b75649c7184f3ce9c18d78ced25454919b571');
  assert.equal(lu.faits.provenance.run_id, '39036165896');
  assert.deepEqual(lireFaits(FAITS_RECETTE_FINALE, node), lu);
  // Un seul chiffre retouché : empreinte refusée.
  assert.match(lireFaits(FAITS_RECETTE_FINALE.replace('"reussis": 5395', '"reussis": 5394'), hacherSha256).raison, /empreinte/);
  // Confrontation réelle (mission et rapport de la recette finale) : verdict exact de la recette.
  const mission = { chantier: 'temoin-atelier', objectif: 'TÉMOIN — recette finale AT-5 T/B/C sur GitHub (option B).', base: { sha: '6680c2e353388e2180e36d3d76e634feb4fd398f', version: '0.65.5' }, jalon: { id: 'temoin-2', titre: 'Jalon témoin', comportement: 'Un test témoin est ajouté.' }, tentative: 1, criteres: ['Le test témoin passe.'], tests: ['tests/temoin-atelier.test.mjs'], autorises: ['tests/temoin-atelier.test.mjs'] };
  const rapport = JSON.stringify({ protocole: 'atelier-rapport-1', chantier: 'temoin-atelier', jalon: 'temoin-2', tentative: 1, base: mission.base, statut: 'candidat', candidat: { branche: 'atelier/temoin-atelier/temoin-2/1', sha: '30a5b225bce3da0d9e4158d1be7d844b7f9f0c0a' }, fichiers: { crees: ['tests/temoin-atelier.test.mjs'], modifies: [], supprimes: [] }, tests: { total: 5395, reussis: 5395, echecs: 0 }, divergences: [], question: null, motif: null });
  const r = confronter({ mission, rapport, faits: FAITS_RECETTE_FINALE, hacherSha256 });
  assert.equal(r.verdict_technique, 'verification-technique-conforme');
  assert.equal(r.a_examiner.length, 1);
  assert.deepEqual(r, confronter({ mission, rapport, faits: FAITS_RECETTE_FINALE, hacherSha256: node }));
});
test('faits RÉELS atelier-faits-1 de la première recette : refusés comme périmés', () => {
  assert.match(lireFaits(FAITS_PREMIERE_RECETTE, hacherSha256).raison, /atelier-faits-1 périmé/);
});
test('pureté : un seul export, aucun import, ni horloge, ni hasard, ni crypto, ni asynchronisme ; aucun nom réservé du SHA-256 cognitif', () => {
  assert.deepEqual(Object.keys(MODULE), ['hacherSha256']);
  for (const m of [/\bimport\b/, /\brequire\(/, /\bDate\b/, /Math\.random/, /\bcrypto\b/, /subtle/, /\basync\b/, /\bawait\b/, /Promise/, /localStorage/, /globalThis/, /\bfetch\b/, /TextEncoder/, /sha256Hex/, /langage\//]) assert.equal(m.test(CODE), false, String(m));
  assert.equal(/sha256Hex|langage\/sha256|\.\/sha256\.js/.test(SRC), false);
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
});
