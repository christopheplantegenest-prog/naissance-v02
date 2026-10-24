import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, s, d]) => [s.trim().replace(/^\/\*[\s\S]*?\*\/\s*/, ''), d]);
const de = (sel) => regles.filter(([s]) => s === sel).map(([, d]) => d).join(';');

test('AT-106 m3 styles.css : un bouton secondaire désactivé est grisé', () => {
  const d = de('.bouton-secondaire:disabled');
  assert.match(d, /opacity:\s*0\.5\s*(;|$)/);
  assert.match(d, /cursor:\s*default\s*(;|$)/);
});

test('AT-106 m3 styles.css : un bouton principal désactivé reste grisé', () => {
  const d = de('.bouton-principal:disabled');
  assert.match(d, /opacity:\s*0\.5\s*(;|$)/);
  assert.match(d, /cursor:\s*default\s*(;|$)/);
});

test('AT-106 m3 styles.css : un bouton secondaire actif reste inchangé', () => {
  const d = de('.bouton-secondaire');
  assert.doesNotMatch(d, /opacity/);
  assert.match(d, /border:\s*1px solid var\(--ligne\)/);
  assert.match(d, /background:\s*var\(--surface\)/);
});
