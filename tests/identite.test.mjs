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

import { appliquerAmendements, AMENDEMENTS, PRINCIPES_DE_DEPART } from '../app/esprit/identite.js';

test('nouvelle naissance : principes à jour, amendements déjà comptés', () => {
  const i = creerIdentite({ personne: 'C', date: 'x' });
  assert.deepEqual(i.amendements, AMENDEMENTS.map((a) => a.id));
  assert.equal(appliquerAmendements(i, 'd').change, false);
  const t = texteIdentite({ identite: i, neeLe: null, moteur: 'm', maintenant });
  assert.match(t, /Ne dis que tu as retenu une information que si ton action retenir a réellement réussi/);
  assert.ok(!t.includes('Ne dis jamais que tu retiens'));
  assert.match(t, /à voix haute grâce au téléphone/);
  assert.ok(!t.includes("tu n'as encore ni voix"));
  assert.equal(PRINCIPES_DE_DEPART.at(-1), "Tu ne modifies jamais ton identité sans l'accord de {personne}.");
});

test('identité née en 0.4 : principes corrigés une seule fois, avec trace, rien d’autre ne bouge', () => {
  const ancienne = {
    noyau: {
      nom: 'Naissance', personne: 'Christophe',
      nature: 'une IA personnelle en construction, qui vit sur le téléphone de {personne}',
      principes: [
        'Dis quand tu ne sais pas.',
        "N'invente jamais un souvenir.",
        "Sois honnête sur tes capacités actuelles : tu peux converser et te souvenir, mais tu n'as encore ni voix, ni outils, ni accès aux fonctions du téléphone.",
        "Tu ne modifies jamais ton identité sans l'accord de {personne}.",
      ],
      langue: 'Tu parles français et tu tutoies {personne}.',
    },
    traits: [{ texte: 't', statut: 'propose' }],
    changements: [{ date: 'n', par: 'naissance', quoi: 'Naissance, avec Christophe' }],
  };
  const { identite, change } = appliquerAmendements(ancienne, '2026-09-16T12:00:00Z');
  assert.equal(change, true);
  assert.equal(identite.noyau.principes.length, 5);
  assert.match(identite.noyau.principes[2], /à voix haute/);
  assert.match(identite.noyau.principes[3], /Ne dis que tu as retenu une information que si ton action retenir a réellement réussi/);
  assert.equal(identite.noyau.principes[4], "Tu ne modifies jamais ton identité sans l'accord de {personne}.");
  const traces = identite.changements.slice(-2);
  assert.equal(identite.changements.length, 3, 'deux amendements appliqués dans l’ordre');
  assert.ok(traces.every((x) => x.par === 'personne' && /à la demande de Christophe/.test(x.quoi)));
  assert.deepEqual(identite.traits, ancienne.traits);
  assert.equal(identite.noyau.nature, ancienne.noyau.nature);
  assert.equal(ancienne.noyau.principes.length, 4, 'l’objet d’origine n’est pas modifié');
  assert.equal(appliquerAmendements(identite, 'plus tard').change, false);
});

test('identité née en 0.5 : seul le principe de mémoire est remplacé', () => {
  const nee05 = creerIdentite({ personne: 'Christophe', date: 'n' });
  nee05.amendements = [AMENDEMENTS[0].id];
  nee05.noyau.principes = nee05.noyau.principes.map((p) => (p.startsWith('Ne dis que tu as retenu')
    ? "Ne dis jamais que tu retiens une information, que tu la gardes en mémoire ou que tu t'en souviendras : tes souvenirs durables sont choisis plus tard par tes rangements, sans garantie. Tu peux dire que l'information fait partie de votre conversation actuelle, et que {personne} peut l'ajouter comme souvenir dans l'écran Mémoire."
    : p));
  const { identite, change } = appliquerAmendements(nee05, 'd');
  assert.equal(change, true);
  assert.deepEqual(identite.noyau.principes, creerIdentite({ personne: 'Christophe', date: 'x' }).noyau.principes);
  assert.equal(identite.changements.length, 2);
  assert.equal(identite.amendements.length, AMENDEMENTS.length);
});
