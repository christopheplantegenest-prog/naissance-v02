// === DEBUT_TEST_ASSIMILATION_COURS ===
// v0.21 — DÉCISION CHATGPT « ASSIMILATION D'UN COURS » (Voie A), puis « DÉBLOQUER LA RÉUTILISATION
// DES CONNAISSANCES DE COURS » (Piste A).
//
// Cas réel : le cours Néria envoyé par Christophe en conversation normale (zorales, lunes Sila/Morn,
// Térane, dorins...). Ce fichier prouve, avec CE texte précis :
//   1..8. le pipeline décomposition Gemini → revalidation locale → aperçu → validation globale →
//          écriture via les primitives existantes → provenance conservée → pas de duplication
//          incohérente sur un second passage du même lot — TOUT FONCTIONNE.
//   9.     RÉUTILISATION pour un sujet que comprendre.js savait déjà représenter (« moi »).
//   10.    RÉUTILISATION pour le sujet à nom propre libre du cas réel (« Néria ») : ce même test
//          échouait avant la Piste A (voir MESSAGE POUR CHATGPT — BLOCAGE RÉUTILISATION DES
//          CONNAISSANCES) — trouverSujet() ne reconnaissait alors que 'moi', 'naissance' et les
//          prénoms (esprit.js, RELATIONS_PRENOM). Depuis la Piste A, le sujet d'un Fait RÉELLEMENT
//          appris devient un sujet reconnu (sujetsConnus, dérivé des connaissances persistantes,
//          jamais stocké séparément — voir tests/sujets-connus.test.mjs) : « Néria » est reconnu dès
//          que Néria → lunes → deux est appris, sans rien ajouter de plus.

import test from 'node:test';
import assert from 'node:assert/strict';
import { demanderDecompositionCours, assurerRelationsConnues } from '../app/langage/gemini-professeur.js';
import { verifierCours, donnerCours, instantane } from '../app/langage/cours.js';
import { chargerEsprit, repondre } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

// Faux DOM universel : suffit pour monter langage/ecran.js et récupérer son vrai dispatcher
// ecrireConnaissance — EXACTEMENT le même que celui utilisé par le laboratoire et par main.js (voir
// tests/cours.test.mjs, dont ce harnais est la copie conforme : aucun dispatcher « miroir » ici).
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
globalThis.document = { createElement: () => universel() };
globalThis.window = globalThis;
const { monterEcranLangage } = await import('../app/langage/ecran.js');

function monter(magasin) {
  return monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
}

// Le cours réel, verbatim (sans la consigne finale « Étudie ce cours... », qui n'est pas un fait).
const COURS_NERIA = `Les zorales sont de petits animaux qui vivent sur la planète Néria.
Les zorales ont six pattes et leur peau est violette.
Ils se nourrissent principalement de lumis, des fruits jaunes qui poussent dans les arbres.

Néria possède deux lunes : Sila et Morn.
Sila est plus grande que Morn.
La capitale de Néria s'appelle Térane.
Térane se trouve au bord de la mer d'Olis.

Les habitants de Térane utilisent une monnaie appelée le dorin.
Dix dorins permettent d'acheter un panier de cinq lumis.`;

// Ce que Gemini proposerait honnêtement en décomposant ce cours (simulé : aucun réseau ici, seulement
// le contrat + la revalidation locale sont réellement exercés). Une ligne volontairement mal formée
// (une phrase de prose, aucune des cinq formes) pour prouver le rejet. Une ligne « Fait : moi / ... »
// en plus, pour disposer d'AU MOINS une connaissance dont le sujet est représentable par comprendre.js
// (test 9 du succès), à côté des connaissances à sujet libre (Néria, Térane) qui, elles, alimentent le
// test de blocage.
function appelerGeminiSimule() {
  return async () => ({
    lecons: [
      'Mot : zorale désigne zorale.',
      'Mot : lunes désigne lunes.',
      'Mot : planete désigne planete.',
      'Fait : Néria / lunes / deux',
      'Fait : Térane / capitale / Néria',
      'Fait : moi / planete / Néria',
      'Les zorales sont vraiment adorables, non ?', // mal formée : ni Mot/Fait/Propriété/Pour/Façon de dire
    ],
    note: 'Je me suis concentré sur les faits vérifiables du cours.',
  });
}

async function contexte(magasin) {
  const ecran = monter(magasin);
  const esprit = await ecran.assurerEsprit();
  return { magasin, esprit, ecrire: ecran.ecrireConnaissance };
}

test('1-3. décomposition : plusieurs candidats distincts, chacun revalidé, une ligne mal formée rejetée', async () => {
  const { note, reconnues, rejetees } = await demanderDecompositionCours({
    titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule(),
  });
  assert.equal(reconnues.length, 6, 'six lignes bien formées');
  assert.equal(rejetees.length, 1, 'une ligne mal formée rejetée');
  assert.equal(rejetees[0], 'Les zorales sont vraiment adorables, non ?');
  assert.ok(note);
  // Chacune des reconnues porte bien son extrait déjà validé par extraireLecon (aucune seconde
  // interprétation nécessaire en aval : c'est CE MÊME extrait qui sera écrit).
  for (const r of reconnues) assert.ok(r.extrait && r.extrait.type, `« ${r.texte} » doit être déjà extrait`);
});

test('4. aucune connaissance n\'est écrite avant la validation globale (verifierCours = rejeu sur copie)', async () => {
  const magasin = magasinMemoireVive();
  const avant = await instantane(magasin);
  const { reconnues } = await demanderDecompositionCours({ titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule() });
  const bloc = ['Leçon : Cours Néria', 'Source : cours-neria-test', ...reconnues.map((r) => r.texte)].join('\n');
  const v = await verifierCours(bloc, await contexte(magasin));
  assert.equal(v.ok, true);
  assert.equal(v.comptes.nouveaux, 6);
  assert.equal(await instantane(magasin), avant, 'la vérification ne doit RIEN avoir écrit dans le vrai magasin');
});

test('5-7. validation du lot : plusieurs connaissances écrites via les primitives existantes, provenance conservée', async () => {
  const magasin = magasinMemoireVive();
  const { reconnues } = await demanderDecompositionCours({ titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule() });
  const bloc = ['Leçon : Cours Néria', 'Source : cours-neria-test', ...reconnues.map((r) => r.texte)].join('\n');
  const res = await donnerCours(bloc, await contexte(magasin));
  assert.equal(res.ok, true);
  const ecrites = res.elements.filter((e) => e.action === 'ecrite');
  assert.equal(ecrites.length, 6, 'les six connaissances reconnues sont réellement écrites');
  const faits = await magasin.lireTout('faits');
  const lexique = await magasin.lireTout('lexique');
  assert.equal(faits.length, 3, 'trois Faits : Néria/lunes, Térane/capitale, moi/planete');
  assert.equal(lexique.length, 3, 'trois Mots : zorale, lunes, planete');
  for (const f of faits) {
    assert.equal(f.origine, 'apprise-cours', `provenance du fait ${f.sujet}→${f.relation} doit être tracée`);
  }
  for (const l of lexique) {
    assert.equal(l.origine, 'apprise-cours', `provenance du mot ${l.mot} doit être tracée`);
  }
  // « idéalement jusqu'au cours/source » : le nom du cours (lecture.source, ici « cours-neria-test »)
  // remonte dans l'exemple tracé par enseigner() pour CHAQUE connaissance écrite (cours.js), pas
  // seulement celles qui exposent un champ « origine » -- voir le code de enseigner() (préfixe
  // « [cours-neria-test] » sur l'exemple transmis à ecrireConnaissance).
});

test('8. le même lot rejoué ne produit aucune duplication incohérente (déjà connu, sauté)', async () => {
  const magasin = magasinMemoireVive();
  const { reconnues } = await demanderDecompositionCours({ titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule() });
  const bloc = ['Leçon : Cours Néria', 'Source : cours-neria-test', ...reconnues.map((r) => r.texte)].join('\n');
  await donnerCours(bloc, await contexte(magasin));
  const apresPremierLot = { faits: (await magasin.lireTout('faits')).length, lexique: (await magasin.lireTout('lexique')).length };
  const res2 = await donnerCours(bloc, await contexte(magasin));
  assert.equal(res2.ok, true);
  assert.ok(res2.elements.every((e) => e.action === 'sautee'), 'le second passage du MÊME lot ne réécrit rien : tout est « déjà connu »');
  const apresSecondLot = { faits: (await magasin.lireTout('faits')).length, lexique: (await magasin.lireTout('lexique')).length };
  assert.deepEqual(apresSecondLot, apresPremierLot, 'aucune ligne dupliquée dans les tables');
});

test('9. RÉUTILISATION RÉUSSIE — un sujet que comprendre.js sait représenter (« moi ») répond sans le texte original ni Gemini', async () => {
  const magasin = magasinMemoireVive();
  const { reconnues } = await demanderDecompositionCours({ titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule() });
  const bloc = ['Leçon : Cours Néria', 'Source : cours-neria-test', ...reconnues.map((r) => r.texte)].join('\n');
  await donnerCours(bloc, await contexte(magasin));
  // Fermeture / réouverture simulée : un esprit tout neuf, rechargé depuis le SEUL magasin persistant,
  // sans aucune trace du texte du cours ni de l'appel Gemini (déjà hors de portée ici).
  const espritRouvert = await chargerEsprit(magasin);
  const r = repondre(espritRouvert, 'Quelle est ma planète ?');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Néria', 'la réponse vient de SA PROPRE mémoire (faits), pas de l\'historique de conversation');
});

test('10. RÉUTILISATION DU CAS RÉEL — « Néria », un sujet à nom propre libre, est reconnu SANS aucune extension du code (Piste A)', async () => {
  const magasin = magasinMemoireVive();
  const { reconnues } = await demanderDecompositionCours({ titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule() });
  const bloc = ['Leçon : Cours Néria', 'Source : cours-neria-test', ...reconnues.map((r) => r.texte)].join('\n');
  await donnerCours(bloc, await contexte(magasin));
  // Fermeture / réouverture simulée, comme le test 9 : rien dans le texte du cours ni dans un
  // historique Gemini n'est disponible ici, seul le magasin persistant.
  const espritRouvert = await chargerEsprit(magasin);
  const faits = await magasin.lireTout('faits');
  assert.ok(faits.some((f) => f.sujet === 'Néria' && f.relation === 'lunes' && f.valeur === 'deux'), 'le fait Néria→lunes→deux est bien en mémoire');
  const r = repondre(espritRouvert, 'Combien de lunes a Néria ?');
  assert.equal(r.comprehension.sujet, 'neria', '« Néria » est désormais reconnu comme sujet : c\'est le sujet d\'un Fait réellement appris');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'deux', 'la réponse vient de la connaissance propre de Naissance (faits), pas du cours ni de Gemini');
});

test('11. un mot simplement RENCONTRÉ dans une phrase ne devient PAS automatiquement un sujet reconnu', async () => {
  const magasin = magasinMemoireVive();
  const { reconnues } = await demanderDecompositionCours({ titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule() });
  const bloc = ['Leçon : Cours Néria', 'Source : cours-neria-test', ...reconnues.map((r) => r.texte)].join('\n');
  await donnerCours(bloc, await contexte(magasin));
  const espritRouvert = await chargerEsprit(magasin);
  // « Sila » et « Morn » apparaissent dans le TEXTE du cours (COURS_NERIA), mais aucune connaissance
  // n'a été apprise dont l'un d'eux serait le SUJET (le Gemini simulé ne les a proposés dans aucune
  // ligne « Fait : Sila / ... » ou « Fait : Morn / ... ») : ils ne doivent PAS devenir des sujets
  // reconnus simplement parce qu'ils ont été « vus » quelque part.
  const r = repondre(espritRouvert, 'Quelle est la taille de Sila ?');
  assert.notEqual(r.comprehension.sujet, 'sila', '« Sila » n\'a jamais été le sujet d\'un Fait appris : il ne doit pas être reconnu');
});

// === v0.21 (suite) — BLOCAGE RÉEL CONSTATÉ AU TÉLÉPHONE : les RELATIONS, pas seulement les sujets ===
// Le cours réel envoyé par Christophe (Marcillac Lanville / raisins / lune / tondeuse) a été décomposé
// par Gemini en UNIQUEMENT des lignes « Fait : ... » à relations inédites (« se situe en », « tourne
// autour de »...), SANS AUCUNE ligne « Mot : ... » pour ces relations. Le fait ci-dessus (« Térane /
// capitale / Néria ») reproduit exactement cette même faille dans CE fixture : le Gemini simulé ne
// propose aucun « Mot : capitale désigne capitale. » -- ce que les tests 1-11 ci-dessus n'exerçaient
// jamais, faute de poser une question utilisant cette relation précise.
test('12. RED (limite réelle observée au téléphone) — sans assurerRelationsConnues, une relation de Fait jamais enregistrée comme Mot reste introuvable ensuite', async () => {
  const magasin = magasinMemoireVive();
  const { reconnues } = await demanderDecompositionCours({ titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule() });
  // Bloc assemblé SANS assurerRelationsConnues, exactement comme avant ce correctif (et comme dans
  // les tests 1-11 ci-dessus) : « capitale » n'a jamais reçu de ligne « Mot : ... ».
  const bloc = ['Leçon : Cours Néria', 'Source : cours-neria-test', ...reconnues.map((r) => r.texte)].join('\n');
  await donnerCours(bloc, await contexte(magasin));
  const espritRouvert = await chargerEsprit(magasin);
  const faits = await magasin.lireTout('faits');
  assert.ok(faits.some((f) => f.sujet === 'Térane' && f.relation === 'capitale' && f.valeur === 'Néria'), 'le fait Térane→capitale→Néria est bien écrit');
  const r = repondre(espritRouvert, 'Quelle est la capitale de Térane ?');
  assert.notEqual(r.etat, 'compris', 'la connaissance existe pourtant en mémoire, mais « capitale » n\'a jamais été enregistré comme mot du lexique : introuvable localement -- c\'est exactement la panne du téléphone (bascule vers Gemini/le moteur externe)');
});

test('13. APRÈS CORRECTION — assurerRelationsConnues() enregistre automatiquement les relations manquantes, sans rien apprendre de nouveau', async () => {
  const magasin = magasinMemoireVive();
  const { reconnues } = await demanderDecompositionCours({ titre: 'Cours Néria', prose: COURS_NERIA, appelerGemini: appelerGeminiSimule() });
  const ctx = await contexte(magasin);
  // Exactement le pipeline de proposerCoursDepuisProse() (main.js) : les lignes « Mot : ... »
  // manquantes sont synthétisées AVANT l'assemblage du bloc, à partir du lexique déjà en mémoire.
  const relationsAAjouter = assurerRelationsConnues(reconnues, ctx.esprit.lexique);
  // Le lexique inspecté ici est celui déjà PERSISTÉ (esprit tout neuf, rien appris pour l'instant) :
  // « lunes » et « planete » n'y sont pas encore -- ce sont seulement des lignes « Mot : » PROPOSÉES
  // par Gemini dans ce même lot, pas encore écrites. assurerRelationsConnues() ne regarde jamais dans
  // le lot en cours d'assemblage (il n'a que le lexique déjà en mémoire) : les trois relations de
  // Fait (lunes, capitale, planete) sont donc candidates, et seule « capitale » est réellement NOUVELLE
  // pour le bloc final (les deux autres, déjà proposées par Gemini, seront simplement redondantes --
  // cours.js/statutElement s'assure qu'un même « Mot : » écrit deux fois dans le même lot ne produit
  // qu'une seule connaissance, exactement comme un second passage du même lot, voir test 8).
  assert.deepEqual(relationsAAjouter, ['Mot : lunes désigne lunes.', 'Mot : capitale désigne capitale.', 'Mot : planete désigne planete.']);
  const bloc = ['Leçon : Cours Néria', 'Source : cours-neria-test', ...relationsAAjouter, ...reconnues.map((r) => r.texte)].join('\n');
  const res = await donnerCours(bloc, ctx);
  assert.equal(res.ok, true);
  const lexique = await magasin.lireTout('lexique');
  const motsLunes = lexique.filter((l) => l.mot === 'lunes');
  assert.equal(motsLunes.length, 1, 'la ligne « Mot : lunes » redondante (proposée par Gemini ET synthétisée) ne produit qu\'une seule entrée de lexique');
  const espritRouvert = await chargerEsprit(magasin);
  const r = repondre(espritRouvert, 'Quelle est la capitale de Térane ?');
  assert.equal(r.comprehension.sujet, 'terane');
  assert.equal(r.comprehension.relation, 'capitale');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Néria', 'la réponse vient de la connaissance propre de Naissance, retrouvée localement -- plus de bascule vers le moteur externe');
});

test('14. assurerRelationsConnues() ne réécrit jamais un mot déjà connu (aucun rôle existant écrasé)', async () => {
  const magasin = magasinMemoireVive();
  const ctx = await contexte(magasin);
  // « lunes » existe déjà dans le lexique avec un rôle précis (relation) : une relation de Fait qui
  // réutilise ce même mot ne doit produire AUCUNE ligne « Mot : ... » supplémentaire.
  const { reconnues } = await demanderDecompositionCours({
    titre: 'Test', prose: 'Néria possède deux lunes.',
    appelerGemini: async () => ({ lecons: ['Mot : lunes désigne lunes.', 'Fait : Néria / lunes / deux'], note: '' }),
  });
  await donnerCours(['Leçon : Test', 'Source : test', ...reconnues.map((r) => r.texte)].join('\n'), ctx);
  const espritApres = await chargerEsprit(magasin);
  const relationsAAjouter = assurerRelationsConnues(reconnues, espritApres.lexique);
  assert.deepEqual(relationsAAjouter, [], '« lunes » est déjà dans le lexique : aucune ligne « Mot : » à ajouter');
});
// === FIN_TEST_ASSIMILATION_COURS ===
