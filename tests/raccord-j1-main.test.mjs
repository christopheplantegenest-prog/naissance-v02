// v0.64.12 — J1 : GARDE STATIQUE DU RACCORD dans main.js (traiterTour n'est pas importable : couplage DOM). L'ordre exigé :
// 1. marqueurs explicites, 2. squelettes appris et rejeu, 3. reconnaissance J1a, 4. pont local, 5. repli conversationnel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const brut = readFileSync(new URL('../app/main.js', import.meta.url), 'utf8');
const main = brut.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const debut = main.indexOf('async function traiterTour(');
const corps = main.slice(debut);
const position = (motif) => {
  const i = corps.indexOf(motif);
  assert.ok(i >= 0, `présent dans traiterTour : ${motif}`);
  return i;
};

test('R1. ordre du raccord : marqueurs → squelettes → rejeu → J1a → pont local → repli conversationnel', () => {
  assert.ok(debut >= 0);
  const ordre = [
    'estEnseignementNaturel(texte)',
    'MARQUEUR_COMPOSE.test(texte)',
    'ecranLangage.tenterReconnaissanceTransformation(texte)',
    'ecranLangage.tenterReconnaissanceAction(texte)',
    'ecranLangage.tenterRejeuAutonome(texte)',
    'reconnaitreAffirmationPossessive(texte,',
    'tenterPontLangage(texte,',
    'esprit.repondre(texte, options)',
  ].map(position);
  for (let i = 1; i < ordre.length; i += 1) assert.ok(ordre[i - 1] < ordre[i], `ordre ${i}`);
});

test('R2. J1a n\'a qu\'un site d\'appel, et une reconnaissance ne fait QUE proposer par le canal existant (proposerLecon), sans modèle externe', () => {
  assert.equal(main.match(/reconnaitreAffirmationPossessive\(/g).length, 1);
  assert.match(corps, /if \(affirmation && affirmation\.ok\) return proposerLecon\(texte, affirmation\.extrait, affirmation\.phrase, sourceProposition\(message, \{ nom: 'j1a' \}\)\);/); // MISE À JOUR DÉLIBÉRÉE v0.64.14 : + source structurée (message-N, voie j1a)
  const bloc = corps.slice(position('reconnaitreAffirmationPossessive(texte,') - 400, position('tenterPontLangage(texte,'));
  assert.doesNotMatch(bloc, /esprit\.repondre\(|apprendreFait\(|ecrireConnaissance\(/, 'aucune écriture ni repli dans le bloc J1a');
});

test('R3. aucune confirmation par message : pas de marqueur « oui », seul le bouton Confirmer (confirmation.onOui) écrit', () => {
  assert.doesNotMatch(main, /const MARQUEUR_[A-Z_]*\s*=\s*\/\^oui/i);
  assert.match(main, /import \{ estEnseignementNaturel, interpreterEnseignement, reconnaitreAffirmationPossessive \} from '\.\/langage\/interpretation\.js';/);
});
