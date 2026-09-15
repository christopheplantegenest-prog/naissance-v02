import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerConversation, ajouterMessage, historiquePourEnvoi } from '../app/conversation/etat.js';
import { texteEnHtml } from '../app/conversation/texte.js';

test('historique : seulement les échanges réussis, dans l’ordre', () => {
  const c = creerConversation();
  ajouterMessage(c, 'systeme', 'Bienvenue');
  ajouterMessage(c, 'moi', 'A');
  ajouterMessage(c, 'ia', 'B');
  const rate = ajouterMessage(c, 'moi', 'perdu');
  rate.etat = 'echec';
  ajouterMessage(c, 'erreur', 'oups');
  ajouterMessage(c, 'moi', 'C');
  assert.deepEqual(historiquePourEnvoi(c), [
    { role: 'moi', texte: 'A' }, { role: 'ia', texte: 'B' }, { role: 'moi', texte: 'C' },
  ]);
});

test('historique limité et commençant toujours par l’utilisateur', () => {
  const c = creerConversation();
  for (let i = 0; i < 30; i++) { ajouterMessage(c, 'moi', `q${i}`); ajouterMessage(c, 'ia', `r${i}`); }
  ajouterMessage(c, 'moi', 'dernier');
  const h = historiquePourEnvoi(c, 10);
  assert.equal(h[0].role, 'moi');
  assert.ok(h.length <= 10);
  assert.equal(h.at(-1).texte, 'dernier');
});

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
