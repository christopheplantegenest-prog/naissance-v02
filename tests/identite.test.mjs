import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerIdentite, changerPersonne, texteIdentite } from '../app/esprit/identite.js';

const maintenant = new Date('2026-09-16T10:00:00Z');

test('identité minimale : Naissance, la personne, aucun trait', () => {
  const i = creerIdentite({ personne: ' Christophe ', date: '2026-09-16T09:00:00Z' });
  assert.equal(i.noyau.nom, 'Naissance');
  assert.equal(i.noyau.personne, 'Christophe');
  assert.deepEqual(i.traits, []);
  assert.equal(i.changements.length, 1);
});

test('le texte d’identité sépare Naissance de son moteur', () => {
  const i = creerIdentite({ personne: 'Christophe', date: 'x' });
  const t = texteIdentite({ identite: i, neeLe: '2026-09-16T09:00:00Z', moteur: 'Google Gemini — gemini-3.8-flash', maintenant });
  assert.match(t, /^Tu es Naissance, une IA personnelle en construction, qui vit sur le téléphone de Christophe\./);
  assert.match(t, /tu n'es pas lui/);
  assert.match(t, /réponds honnêtement : Google Gemini — gemini-3\.8-flash/);
  assert.match(t, /sans l'accord de Christophe/);
  assert.match(t, /tu tutoies Christophe/);
  assert.match(t, /née le 16 septembre 2026/);
  assert.ok(!t.includes('{personne}'));
  assert.ok(!/Tu es (Gemini|Google)/.test(t));
});

test('seuls les traits actifs entrent dans le texte', () => {
  const i = creerIdentite({ personne: 'C', date: 'x' });
  i.traits = [
    { texte: 'curieuse', statut: 'actif' },
    { texte: 'ironique', statut: 'propose' },
  ];
  const t = texteIdentite({ identite: i, neeLe: null, moteur: 'm', maintenant });
  assert.ok(t.includes('- curieuse'));
  assert.ok(!t.includes('ironique'));
});

test('changer le prénom est journalisé, jamais vide', () => {
  const i = creerIdentite({ personne: 'Chris', date: 'x' });
  const j = changerPersonne(i, 'Christophe', 'd2');
  assert.equal(j.noyau.personne, 'Christophe');
  assert.equal(j.changements.at(-1).par, 'personne');
  assert.equal(i.noyau.personne, 'Chris');
  assert.throws(() => changerPersonne(i, '  ', 'd3'));
  assert.equal(changerPersonne(j, 'Christophe', 'd4'), j);
});
