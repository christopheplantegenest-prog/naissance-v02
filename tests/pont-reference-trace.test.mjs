// === DEBUT_TEST_PONT_REFERENCE_TRACE ===
// Chantier « RÉFÉRENCE EXPLICITE D'UNE VRAIE EXPÉRIENCE À UNE TRACE » (ÉTAPE 5.2-bis). Vérifie,
// sur le moteur réel, les DEUX voies identifiées au diagnostic 5.2 (I/J du cadrage), puis la
// fonction PURE d'abstention (L à Q) -- extraite ici pour rester testable, main.js (bootstrap, non
// exporté) ne l'étant pas (même raison que l'extraction A1 déjà en place dans ce fichier).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  tenterPontLangage, enregistrerExperienceTentativeEchouee, appliquerAbstentionSiReferenceIgnoree,
  MESSAGE_REFERENCE_IGNOREE,
} from '../app/langage/pont.js';
import { chargerEsprit, apprendreRelation, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive, enregistrerExperience, ajouterInterpretation } from '../app/langage/connaissances.js';

async function faux() {
  const magasin = magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  const deps = {
    assurerEsprit: async () => e,
    journaliser: async () => [41, 99],
    enregistrerExperience: async (donnees) => enregistrerExperience(magasin, donnees),
    ajouterInterpretation: async (id, donnees) => ajouterInterpretation(magasin, id, donnees),
  };
  return {
    magasin, deps,
    async apprendre(mot, relation) { await apprendreRelation(e, { mot, relation }); },
    async apprendreFaitTest(sujet, relation, valeur) { await apprendreFait(e, { sujet, relation, valeur }); },
  };
}

// I. branche COMPRIS (tenterPontLangage) : l'expérience reçoit exactement referenceTrace.
test('I. tenterPontLangage() transmet exactement referenceTrace à l\'expérience créée (branche COMPRIS)', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  await tenterPontLangage('Quel est mon manteau ?', { ...f.deps, referenceTrace: { idTrace: 'trace-abc' } });
  const [exp] = await f.magasin.lireTout('experiences');
  assert.deepEqual(exp.referenceTrace, { idTrace: 'trace-abc' });
});

// K. sans referenceTrace fourni : une expérience normale reste strictement inchangée (null).
test('K. sans référence fournie, l\'expérience créée a referenceTrace: null (inchangé)', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  await tenterPontLangage('Quel est mon manteau ?', f.deps);
  const [exp] = await f.magasin.lireTout('experiences');
  assert.equal(exp.referenceTrace, null);
});

// J. voie « tentative échouée + repli réel » : l'expérience reçoit exactement referenceTrace.
test('J. enregistrerExperienceTentativeEchouee() transmet exactement referenceTrace', async () => {
  const f = await faux();
  const reponse = { texte: 'Je ne connais pas encore ce mot.', idQuestion: 41, idReponse: 99, dateQuestion: '2026-10-03T08:00:00.000Z' };
  await enregistrerExperienceTentativeEchouee('Zorglub ?', { etat: 'incompris', comprehension: {} }, reponse, { ...f.deps, referenceTrace: { idTrace: 'trace-xyz' } });
  const [exp] = await f.magasin.lireTout('experiences');
  assert.deepEqual(exp.referenceTrace, { idTrace: 'trace-xyz' });
});

// W. la trace référencée elle-même n'est jamais touchée par la création de l'expérience (aucune
// table autre que 'experiences' ne change -- ni 'traces', ni 'actes').
test('W/X. plusieurs expériences peuvent référencer la même trace, sans jamais la modifier', async () => {
  const f = await faux();
  await f.apprendre('manteau', 'manteau');
  await f.apprendreFaitTest('moi', 'manteau', 'un manteau bleu');
  await tenterPontLangage('Quel est mon manteau ?', { ...f.deps, referenceTrace: { idTrace: 'trace-partagee' } });
  await tenterPontLangage('Quel est mon manteau ?', { ...f.deps, referenceTrace: { idTrace: 'trace-partagee' } });
  const experiences = await f.magasin.lireTout('experiences');
  assert.equal(experiences.length, 2);
  assert.deepEqual(experiences[0].referenceTrace, { idTrace: 'trace-partagee' });
  assert.deepEqual(experiences[1].referenceTrace, { idTrace: 'trace-partagee' });
  assert.equal((await f.magasin.lireTout('traces')).length, 0);
  assert.equal((await f.magasin.lireTout('actes')).length, 0);
});

// -------------------------------------------------------------------------------------------
// appliquerAbstentionSiReferenceIgnoree() -- extraction PURE des chemins locaux (L à Q).
// -------------------------------------------------------------------------------------------

// L. action locale : aucune fabrication, texte réel conservé, avertissement ajouté.
test('L. chemin action (idTrace propre, sans idExperience) + référence sélectionnée → avertissement, texte conservé', () => {
  const resultat = { texte: 'Action exécutée.', local: true, idTrace: 'trace-action-propre' };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, { idTrace: 'ref-choisie' });
  assert.equal(r.texte, 'Action exécutée.');
  assert.equal(r.local, true);
  assert.equal(r.idTrace, 'trace-action-propre', 'le idTrace propre de CE tour (action) ne doit jamais être confondu avec la référence');
  assert.ok(r.actions.includes(MESSAGE_REFERENCE_IGNOREE));
});

// M. rejeu local : idem.
test('M. chemin rejeu (idTrace propre, sans idExperience) + référence sélectionnée → avertissement', () => {
  const resultat = { texte: 'Rejeu exécuté.', local: true, idTrace: 'trace-rejeu-propre' };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, { idTrace: 'ref-choisie' });
  assert.equal(r.texte, 'Rejeu exécuté.');
  assert.ok(r.actions.includes(MESSAGE_REFERENCE_IGNOREE));
});

// N. transformation locale : idem (aucun idTrace propre sur cette voie).
test('N. chemin transformation (aucun idTrace) + référence sélectionnée → avertissement', () => {
  const resultat = { texte: 'Résultat transformé.', local: true };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, { idTrace: 'ref-choisie' });
  assert.equal(r.texte, 'Résultat transformé.');
  assert.ok(r.actions.includes(MESSAGE_REFERENCE_IGNOREE));
});

// O. marqueur/enseignement (aperçu + confirmation) : idem, confirmation jamais altérée.
test('O. chemin marqueur/enseignement (confirmation) + référence sélectionnée → avertissement, confirmation intacte', () => {
  const onOui = async () => 'ok';
  const resultat = { texte: 'Voici ce que je propose de retenir…', confirmation: { onOui, onNon: async () => {} } };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, { idTrace: 'ref-choisie' });
  assert.equal(r.texte, 'Voici ce que je propose de retenir…');
  assert.equal(r.confirmation.onOui, onOui);
  assert.ok(r.actions.includes(MESSAGE_REFERENCE_IGNOREE));
});

// P. composition : idem (porte aussi un idTrace propre, dormant).
test('P. chemin composition (idTrace propre) + référence sélectionnée → avertissement', () => {
  const resultat = { texte: 'Composition invoquée.', local: true, idTrace: 'trace-composition-propre' };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, { idTrace: 'ref-choisie' });
  assert.equal(r.idTrace, 'trace-composition-propre');
  assert.ok(r.actions.includes(MESSAGE_REFERENCE_IGNOREE));
});

// Q. message sans « ? » ni expérience (repli direct) : idem.
test('Q. réponse sans "?" (aucune expérience) + référence sélectionnée → avertissement, aucune fausse persistance', () => {
  const resultat = { texte: 'Réponse ordinaire du repli.' };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, { idTrace: 'ref-choisie' });
  assert.equal(r.texte, 'Réponse ordinaire du repli.');
  assert.equal(r.idExperience, undefined, 'aucune expérience ne doit être prétendue créée');
  assert.ok(r.actions.includes(MESSAGE_REFERENCE_IGNOREE));
});

// Une véritable expérience (idExperience présent) : AUCUN avertissement, résultat strictement
// inchangé -- la référence a réellement été honorée (voir I/J ci-dessus pour la persistance elle-même).
test('contre-exemple : une vraie expérience (idExperience) + référence sélectionnée → aucun avertissement', () => {
  const resultat = { texte: 'un manteau bleu', local: true, laboratoire: true, idExperience: 'exp-1' };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, { idTrace: 'ref-choisie' });
  assert.deepEqual(r, resultat);
});

// Sans référence sélectionnée : le résultat traverse STRICTEMENT inchangé, quelle que soit la voie
// -- aucun avertissement fabriqué quand Christophe n'a jamais demandé de référence.
test('contre-exemple : sans référence sélectionnée, aucun avertissement n\'est jamais ajouté', () => {
  const resultat = { texte: 'Action exécutée.', local: true, idTrace: 'trace-action-propre' };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, null);
  assert.equal(r, resultat, 'même référence d\'objet : aucune enveloppe créée inutilement');
});

// Avertissement cumulable avec des « actions » déjà présentes (jamais un remplacement du tableau).
test('contre-exemple : des actions déjà présentes sont conservées, l\'avertissement s\'ajoute à la suite', () => {
  const resultat = { texte: 'Action exécutée.', local: true, actions: ['Déjà fait avant.'] };
  const r = appliquerAbstentionSiReferenceIgnoree(resultat, { idTrace: 'ref-choisie' });
  assert.deepEqual(r.actions, ['Déjà fait avant.', MESSAGE_REFERENCE_IGNOREE]);
});
// === FIN_TEST_PONT_REFERENCE_TRACE ===
