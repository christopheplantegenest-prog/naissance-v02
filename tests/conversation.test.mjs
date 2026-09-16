import { test } from 'node:test';
import assert from 'node:assert/strict';
import { texteEnHtml } from '../app/conversation/texte.js';

test('mise en forme : le HTML du modèle est neutralisé', () => {
  const h = texteEnHtml('<img src=x onerror=alert(1)> **gras** `<b>`');
  assert.ok(!h.includes('<img'));
  assert.ok(h.includes('&lt;img'));
  assert.ok(h.includes('<strong>gras</strong>'));
  assert.ok(h.includes('<code>&lt;b&gt;</code>'));
});

test('mise en forme : blocs de code, titres et puces', () => {
  const h = texteEnHtml('# Titre\n- un\n```js\nlet a = "<x>";\n```\nfin');
  assert.ok(h.includes('<strong>Titre</strong>'));
  assert.ok(h.includes('• un'));
  assert.ok(h.includes('<pre><code>let a = &quot;&lt;x&gt;&quot;;</code></pre>'));
  assert.ok(texteEnHtml('```\n<script>').includes('&lt;script&gt;'));
});
