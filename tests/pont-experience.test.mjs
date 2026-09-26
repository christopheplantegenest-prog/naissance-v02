// === DEBUT_TEST_PONT_EXPERIENCE ===
// A2 — Branchement de B1 sur le vrai tenterPontLangage(). Prouve, sur le moteur réel (pas une
// simulation parallèle) : une expérience par tour COMPRIS, avec le factuel exact et la référence
// mémoire exacte (ids volontairement NON adjacents, 41/99, pour ne jamais valider un raccourci
// « idQuestion+1 ») ; aucune expérience dans les autres cas ; et — via un test STATIQUE, parce
// qu'une mutation « recalculer au lieu de réutiliser » serait indétectable par comparaison de
// valeur sur un moteur déterministe — un seul appel réel à repondre( dans pont.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tenterPontLangage } from '../app/langage/pont.js';
import { chargerEsprit, apprendreRelation, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

async function faux() {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const sequence = [];
  const deps = {
    assurerEsprit: async () => e,
    journaliser: async (q, r, d) => { sequence.push('journaliser'); return [41, 99]; },
    enregistrerExperience: async (donnees) => { sequence.push('enregistrerExperience'); return enregistrerExperience(magasin, donnees); },
    ajouterInterpretation: async (id, donnees) => { sequence.push('ajouterInterpretation'); return ajouterInterpretation(magasin, id, donnees); },
  };
  return {
    magasin, deps, sequence,
    async apprendre(mot, relation) { await apprendreRelation(e, { mot, relation }); },
    async apprendreFaitTest(sujet, relation, valeur) { await apprendreFait(e, { sujet, relation, valeur }); },
  };
}

test('A2 : un tour COMPRIS crée exactement une expérience', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  await tenterPontLangage('Quel est mon manteau ?', f.deps);
  const toutes = await f.magasin.lireTout('experiences');
  assert.equal(toutes.length, 1);
});

test('A2 : texteRecu/texteRepondu exacts, y compris le cas "Je ne sais pas."', async () => {
  const f = await faux();
  await tenterPontLangage('Quelle est ma couleur ?', f.deps);
  const [exp] = await f.magasin.lireTout('experiences');
  assert.equal(exp.texteRecu, 'Quelle est ma couleur ?');
  assert.equal(exp.texteRepondu, 'Je ne sais pas.');
});

test('A2 : referenceMemoire porte exactement les ids (non adjacents) renvoyés par journaliser', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  await tenterPontLangage('Quel est mon manteau ?', f.deps);
  const [exp] = await f.magasin.lireTout('experiences');
  assert.deepEqual(exp.referenceMemoire, { idQuestion: 41, idReponse: 99 });
});

test('A2 : source vaut "laboratoire"', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  await tenterPontLangage('Quel est mon manteau ?', f.deps);
  const [exp] = await f.magasin.lireTout('experiences');
  assert.equal(exp.source, 'laboratoire');
});

test('A2 : une interprétation ajoutée, origine "comprendre", donnees reflète comprendre()', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  await tenterPontLangage('Quel est mon manteau ?', f.deps);
  const [exp] = await f.magasin.lireTout('experiences');
  assert.equal(exp.interpretations.length, 1);
  const interp = exp.interpretations[0];
  assert.equal(interp.origine, 'comprendre');
  assert.equal(interp.donnees.etat, 'compris');
  assert.equal(interp.donnees.sujet, 'moi');
  assert.equal(interp.donnees.relation, 'manteau');
  assert.deepEqual(interp.donnees.motsInconnus, []);
});

test('A2 : origine est une chaîne non vide, jamais un numéro de version', () => {
  const src = fs.readFileSync(new URL('../app/langage/pont.js', import.meta.url), 'utf8');
  assert.ok(/origine:\s*['"]comprendre['"]/.test(src));
  assert.ok(!/origine:\s*['"]\d+\.\d+/.test(src));
});

test('A2 : pas de "?" → aucune expérience créée', async () => {
  const f = await faux();
  await tenterPontLangage('Bonjour', f.deps);
  assert.deepEqual(await f.magasin.lireTout('experiences'), []);
});

test('A2 : PARTIEL/INCOMPRIS → aucune expérience créée', async () => {
  const f = await faux();
  await tenterPontLangage('Zorglub ?', f.deps);
  assert.deepEqual(await f.magasin.lireTout('experiences'), []);
});

test('A2 : mot totalement inconnu → aucune expérience créée', async () => {
  const f = await faux();
  await tenterPontLangage('Bibendumesque ?', f.deps);
  assert.deepEqual(await f.magasin.lireTout('experiences'), []);
});

test('A2 : comportement visible (texte/local/laboratoire) inchangé malgré les nouvelles dépendances', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  const r = await tenterPontLangage('Quel est mon manteau ?', f.deps);
  assert.deepEqual(r, { texte: 'un manteau bleu', local: true, laboratoire: true });
});

test('A2 : journaliser s\'exécute strictement AVANT enregistrerExperience', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  await tenterPontLangage('Quel est mon manteau ?', f.deps);
  const iJournaliser = f.sequence.indexOf('journaliser');
  const iEnregistrer = f.sequence.indexOf('enregistrerExperience');
  assert.ok(iJournaliser < iEnregistrer);
});

// GARDE STATIQUE — un mutant qui recalcule l'interprétation via un second repondre() au lieu de
// réutiliser local.comprehension serait invisible par comparaison de valeur (le moteur est
// déterministe : même entrée → même sortie). On compte donc les appels RÉELS (hors commentaires).
test('A2 (statique) : exactement un appel à repondre( dans pont.js', () => {
  const src = fs.readFileSync(new URL('../app/langage/pont.js', import.meta.url), 'utf8');
  const sansCommentaires = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const occurrences = (sansCommentaires.match(/repondre\(/g) || []).length;
  assert.equal(occurrences, 1);
});
// === FIN_TEST_PONT_EXPERIENCE ===
