import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composerContexte, choisirRecents, BUDGETS } from '../app/esprit/contexte.js';
import { creerIdentite } from '../app/esprit/identite.js';

const identite = creerIdentite({ personne: 'Christophe', date: 'x' });
const meta = { neeLe: '2026-09-16T09:00:00Z' };
const maintenant = new Date('2026-09-16T10:00:00Z');
const msg = (id, role, texte = `m${id}`) => ({ id, role, texte });

test('contexte complet : identité, fil, souvenirs incertains, récents après le fil', () => {
  const recents = [msg(1, 'moi'), msg(2, 'ia'), msg(3, 'moi'), msg(4, 'ia')];
  const c = composerContexte({
    identite, meta,
    fil: { texte: 'Ils ont parlé de vélo.', jusqua: 2 },
    souvenirs: [{ id: 's1', texte: 'Christophe aime le vélo', importance: 2, confiance: 'probable', source: 'dit', statut: 'actif' }],
    recents, message: 'Et maintenant ?', moteur: 'moteur X', maintenant,
  });
  assert.match(c.instructions, /Tu es Naissance/);
  assert.match(c.instructions, /Résumé de votre histoire plus ancienne :\nIls ont parlé de vélo\./);
  assert.match(c.instructions, /ne les présente jamais comme des certitudes/);
  assert.match(c.instructions, /- Christophe aime le vélo \(probable, dit par Christophe\)/);
  assert.deepEqual(c.historique, [
    { role: 'moi', texte: 'm3' }, { role: 'ia', texte: 'm4' }, { role: 'moi', texte: 'Et maintenant ?' },
  ]);
  assert.deepEqual(c.souvenirsUtilises, ['s1']);
});

test('sans souvenirs ni fil : le dit clairement', () => {
  const c = composerContexte({ identite, meta, fil: { texte: '', jusqua: 0 }, souvenirs: [], recents: [], message: 'Salut', moteur: 'm', maintenant });
  assert.match(c.instructions, /aucun souvenir durable/);
  assert.ok(!c.instructions.includes('Résumé de votre histoire'));
  assert.deepEqual(c.historique, [{ role: 'moi', texte: 'Salut' }]);
});

test('récents bornés en nombre et en taille, toujours ouverts par la personne', () => {
  const beaucoup = Array.from({ length: 100 }, (_, i) => msg(i + 1, i % 2 ? 'ia' : 'moi'));
  const r = choisirRecents(beaucoup);
  assert.ok(r.length <= BUDGETS.maxRecents);
  assert.equal(r[0].role, 'moi');
  assert.equal(r.at(-1).id, 100);
  const gros = [msg(1, 'moi', 'a'.repeat(7000)), msg(2, 'ia', 'b'.repeat(7000)), msg(3, 'moi', 'c')];
  assert.deepEqual(choisirRecents(gros).map((m) => m.id), [3]);
});

test('le texte envoyé ne dépasse jamais les budgets', () => {
  const souvenirs = Array.from({ length: 300 }, (_, i) => ({ id: `s${i}`, texte: `souvenir numéro ${i} ${'z'.repeat(80)}`, importance: 1 + (i % 3), confiance: 'incertain', source: 'deduit', statut: 'actif' }));
  const c = composerContexte({ identite, meta, fil: { texte: 'y'.repeat(5000), jusqua: 0 }, souvenirs, recents: [], message: 'q', moteur: 'm', maintenant });
  assert.ok(c.instructions.length < 3000 + BUDGETS.fil + BUDGETS.souvenirs + 800, `taille ${c.instructions.length}`);
});

test('actions disponibles et actions déjà faites présentées au moteur', () => {
  const c = composerContexte({
    identite, meta, fil: { texte: '', jusqua: 0 }, souvenirs: [
      { id: 'd', texte: 'Christophe aime la raclette.', importance: 2, confiance: 'certain', source: 'demande', statut: 'actif' },
    ], recents: [], message: 'x', moteur: 'm', maintenant,
    actions: [{ nom: 'retenir', description: 'enregistrer une information' }],
    dejaFaites: ['retenir : « X » → Souvenir enregistré.'],
  });
  assert.match(c.instructions, /- retenir : enregistrer une information/);
  assert.match(c.instructions, /DÉJÀ été exécutées[\s\S]*retenir : « X »/);
  assert.match(c.instructions, /\(confirmé, retenu à la demande de Christophe\)/);
  const sans = composerContexte({ identite, meta, fil: { texte: '', jusqua: 0 }, souvenirs: [], recents: [], message: 'x', moteur: 'm', maintenant });
  assert.ok(!sans.instructions.includes('Précision technique'));
});
