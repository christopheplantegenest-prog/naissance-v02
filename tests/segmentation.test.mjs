// v0.17.2 — SEGMENTATION + PORTÉE : les mots de rôle INTERROGATIF découpent la phrase en groupes ;
// le DERNIER groupe qui en contient un est retenu ; sujet et relation ne sont cherchés QUE dans ce
// groupe. En l'absence d'interrogatif, comportement STRICTEMENT inchangé (un seul groupe = la phrase
// entière, comme avant ce chantier).
//
// PÉRIMÈTRE STRICT : ce chantier ne touche QUE ce mécanisme. Volontairement non résolu ici, à garder
// comme échec connu : « Tu peux me rappeler mon téléphone » (aucun mot interrogatif dans la phrase :
// une demande indirecte formulée à l'indicatif — capacité distincte, chantier futur sur le type
// d'énoncé). Négation, affirmation/vérification, valeurs proposées, fautes d'orthographe,
// singulier/pluriel, sujets génériques, routage main.js sans « ? », LFM2, segmentation par
// ponctuation : tous hors chantier, non touchés, non testés ici.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre, decouper, COMPRIS, PARTIEL, INCOMPRIS } from '../app/langage/comprendre.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';

// Lexique de test : le bagage de départ + trois relations inventées (téléphone, manteau, lampe),
// comme dans le rapport de diagnostic et le cadrage.
const lex = {
  ...LEXIQUE_DEPART,
  telephone: { role: 'relation', relation: 'telephone' },
  manteau: { role: 'relation', relation: 'manteau' },
  lampe: { role: 'relation', relation: 'lampe' },
};
const c = (phrase) => comprendre(phrase, { lexique: lex, prenomsConnus: new Set() });

// ============================================================================ 1. LES 5 CAS ROUGES (corrigés par ce chantier)
test('ROUGE → VERT — « Tu sais quel est mon manteau ? » : sujet moi (pas naissance)', () => {
  const r = c('Tu sais quel est mon manteau ?');
  assert.equal(r.sujet, 'moi');
  assert.equal(r.relation, 'manteau');
  assert.equal(r.etat, COMPRIS);
});

test('ROUGE → VERT — « Est-ce que tu sais quel est mon manteau ? » : sujet moi', () => {
  const r = c('Est-ce que tu sais quel est mon manteau ?');
  assert.equal(r.sujet, 'moi');
  assert.equal(r.relation, 'manteau');
});

test('ROUGE → VERT — « Peux-tu me dire quel est mon manteau ? » : sujet moi', () => {
  const r = c('Peux-tu me dire quel est mon manteau ?');
  assert.equal(r.sujet, 'moi');
  assert.equal(r.relation, 'manteau');
});

test('ROUGE → VERT — « La lampe est blanche. Quel est mon manteau ? » : relation manteau, pas lampe', () => {
  const r = c('La lampe est blanche. Quel est mon manteau ?');
  assert.equal(r.relation, 'manteau');
  assert.equal(r.sujet, 'moi');
});

test('ROUGE → VERT — « Mon manteau est bleu. Quelle est ma lampe ? » : relation lampe, pas manteau', () => {
  const r = c('Mon manteau est bleu. Quelle est ma lampe ?');
  assert.equal(r.relation, 'lampe');
  assert.equal(r.sujet, 'moi');
});

// ============================================================================ 2. LES 9 VERROUS (aucune régression)
test('VERROU — « Quel est mon téléphone ? »', () => { const r = c('Quel est mon téléphone ?'); assert.equal(r.sujet, 'moi'); assert.equal(r.relation, 'telephone'); });
test('VERROU — « Quel est mon téléphone » (sans « ? »)', () => { const r = c('Quel est mon téléphone'); assert.equal(r.sujet, 'moi'); assert.equal(r.relation, 'telephone'); });
test('VERROU — « Mon téléphone ? »', () => { const r = c('Mon téléphone ?'); assert.equal(r.sujet, 'moi'); assert.equal(r.relation, 'telephone'); });
test("VERROU — « C'est quoi mon téléphone ? »", () => { const r = c("C'est quoi mon téléphone ?"); assert.equal(r.sujet, 'moi'); assert.equal(r.relation, 'telephone'); });
test('VERROU — « Dis-moi quel est mon téléphone »', () => { const r = c('Dis-moi quel est mon téléphone'); assert.equal(r.sujet, 'moi'); assert.equal(r.relation, 'telephone'); });
test('VERROU — « Euh quel est mon téléphone »', () => { const r = c('Euh quel est mon téléphone'); assert.equal(r.sujet, 'moi'); assert.equal(r.relation, 'telephone'); });
test('VERROU — « Naissance, quel est mon manteau ? »', () => { const r = c('Naissance, quel est mon manteau ?'); assert.equal(r.sujet, 'moi'); assert.equal(r.relation, 'manteau'); });
test('VERROU — « Quel est ton téléphone ? » (sujet naissance, cohérent)', () => { const r = c('Quel est ton téléphone ?'); assert.equal(r.sujet, 'naissance'); assert.equal(r.relation, 'telephone'); });
test('VERROU — « Je voudrais savoir quel est mon téléphone »', () => { const r = c('Je voudrais savoir quel est mon téléphone'); assert.equal(r.sujet, 'moi'); assert.equal(r.relation, 'telephone'); });

// ============================================================================ 3. LES 3 PIÈGES (capacité générale, pas « mon gagne sur tu »)
test('PIÈGE — un « ton » DANS le groupe retenu donne bien naissance (pas un réflexe anti-tu)', () => {
  const r = c('Quel est ton téléphone, tu le sais ?');
  assert.equal(r.sujet, 'naissance');
  assert.equal(r.relation, 'telephone');
});

test('PIÈGE — deux interrogatifs à la suite : le DERNIER groupe l’emporte, pas le premier', () => {
  const r = c('Quelle est ta couleur, quel est mon manteau ?');
  assert.equal(r.relation, 'manteau', 'la deuxième question, pas la première');
  assert.equal(r.sujet, 'moi');
});

test('PIÈGE — aucun possessif ni pronom dans le groupe retenu : PARTIEL, jamais un choix arbitraire', () => {
  const r = c('Quel est le manteau ?');
  assert.equal(r.sujet, null);
  assert.equal(r.relation, 'manteau');
  assert.equal(r.etat, PARTIEL);
});

// ============================================================================ 4. HORS CHANTIER, VOLONTAIREMENT NON RÉSOLU
test('CONNU, NON RÉSOLU — « Tu peux me rappeler mon téléphone » (aucun interrogatif : hors périmètre)', () => {
  const r = c('Tu peux me rappeler mon téléphone');
  assert.equal(r.sujet, 'naissance', 'toujours faux : capacité distincte, chantier futur sur le type d’énoncé, volontairement non traité ici');
  assert.equal(r.relation, 'telephone');
});

// ============================================================================ 5. LE MÉCANISME NE TOUCHE RIEN D'AUTRE
test('motsInconnus reste calculé sur TOUTE la phrase, pas seulement le groupe retenu', () => {
  const r = c('Blablabla tu sais quel est mon manteau ?');
  assert.ok(r.motsInconnus.includes('blablabla'));
});

test('phrase sans aucun interrogatif : comportement STRICTEMENT identique à un seul groupe (la phrase entière)', () => {
  // Aucune régression sur une affirmation simple déjà comprise avant ce chantier.
  const r = c('Ma couleur');
  assert.equal(r.sujet, 'moi');
  assert.equal(r.relation, 'couleur');
});

test('phrase totalement incomprise reste incomprise', () => {
  const r = c('Blablabla');
  assert.equal(r.etat, INCOMPRIS);
});

test('decouper() est inchangé (aucune segmentation par ponctuation ajoutée)', () => {
  assert.deepEqual(decouper('La lampe est blanche. Quel est mon manteau ?'), ['la', 'lampe', 'est', 'blanche', 'quel', 'est', 'mon', 'manteau']);
});
