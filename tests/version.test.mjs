// Tests de base : la version est cohérente partout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../app/version.js';

const lire = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('la version est bien formée', () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test('le service worker porte la même version', () => {
  assert.ok(lire('../app/sw.js').includes(`"${VERSION}"`));
});

test('package.json porte la même version', () => {
  assert.equal(JSON.parse(lire('../package.json')).version, VERSION);
});

test('chaque fichier de la coquille hors ligne existe', () => {
  const sw = lire('../app/sw.js');
  const liste = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
  assert.ok(liste.length > 0);
  for (const f of liste) assert.doesNotThrow(() => lire(`../app/${f}`), `absent : ${f}`);
});
