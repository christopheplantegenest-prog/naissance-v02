// === DEBUT_TEST_COMPOSITION_CONNAISSANCES ===
// v0.33 — DÉCISION CHATGPT « COMPOSITION DE CONNAISSANCES ».
//
// ÉTAPE 1 — FIABILISER trouverRelation() (comprendre.js) : un mot structurel (grammatical) ne doit
// jamais créer de collision artificielle avec une relation de contenu enseignée par ailleurs, et le
// mécanisme de secours (mot-déclencheur) ne doit jamais choisir silencieusement la première de
// plusieurs relations possibles -- ambiguïté réelle → abstention, jamais un choix arbitraire.
//
// ÉTAPE 2 — LA PLUS PETITE PRIMITIVE GÉNÉRALE DE COMPOSITION : resoudreChemin(esprit, sujet, chemin)
// (esprit.js) parcourt une SÉQUENCE de relations déjà apprises, en réinjectant à chaque étape la
// VALEUR obtenue comme SUJET de l'étape suivante -- par égalité CANONIQUE EXACTE seulement, jamais
// une invention de grammaire (singulier/pluriel, déterminants...). Jamais de transitivité implicite :
// la composition n'est tentée QUE lorsque la question nomme EXPLICITEMENT au moins deux relations
// connues et DISTINCTES (comprendre().relationsNommees) ; elle n'écrit JAMAIS de fait dérivé
// permanent -- une réponse ponctuelle à la question posée, rien de plus.
//
// Domaine ARTIFICIEL neutre (zalpha/zrel1/zrel2...), comme demandé, pour isoler la capacité sans la
// mélanger avec aucune notion de grammaire française.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chargerEsprit, apprendreFait, apprendreRelation, repondre, resoudreChemin,
} from '../app/langage/esprit.js';
import { comprendre } from '../app/langage/comprendre.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

// ---------------------------------------------------------------------------------------------
// ÉTAPE 1 — FIABILISATION DE trouverRelation()
// ---------------------------------------------------------------------------------------------

test('1.A. collision de pure graphie avec un mot structurel : « est » de « Est-ce que » ne doit plus bloquer une relation par ailleurs non ambiguë (cas réel diagnostiqué)', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'pommier', relation: 'produire', valeur: 'des pommes' });
  esprit = await chargerEsprit(magasin);
  // La relation "est" existe ailleurs, sans aucun rapport -- avant ce chantier, le simple mot
  // grammatical « est » de « Est-ce que » entrait en collision avec elle et bloquait "produire".
  await apprendreFait(esprit, { sujet: 'pomme', relation: 'est', valeur: 'un fruit' });
  esprit = await chargerEsprit(magasin);

  const r = repondre(esprit, "Est-ce qu'un pommier peut produire un fruit ?");
  assert.equal(r.comprehension.sujet, 'pommier');
  assert.equal(r.comprehension.relation, 'produire', 'la relation de contenu doit être retrouvée malgré le mot structurel « est »');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'des pommes');
});

test('1.B. non-régression : un mot structurel reste une relation valide quand RIEN ne lui fait concurrence', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'pomme', relation: 'est', valeur: 'un fruit' });
  esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'Une pomme est quoi ?');
  assert.equal(r.comprehension.relation, 'est');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'un fruit');
});

test('1.C. ambiguïté RÉELLE entre deux relations de CONTENU (aucune n\'est structurelle) : abstention, jamais un choix arbitraire', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'zrel1', relation: 'zrel1' });
  await apprendreRelation(esprit, { mot: 'zrel2', relation: 'zrel2' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  esprit = await chargerEsprit(magasin);
  // Phrase qui nomme littéralement les deux relations, sans qu'aucune ne soit structurelle :
  // mécanisme 1 (séquence) voit une vraie ambiguïté de contenu, pas une collision accidentelle.
  const c = comprendre('zrel1 zrel2 zalpha', {
    lexique: esprit.lexique, prenomsConnus: esprit.prenomsConnus,
    sujetsConnus: esprit.sujetsConnus, relationsConnues: esprit.relationsConnues,
  });
  assert.equal(c.relation, null, 'deux relations de contenu concurrentes : aucun choix arbitraire');
  assert.deepEqual([...c.relationsNommees].sort(), ['zrel1', 'zrel2']);
});

test('1.D. mécanisme de secours (mot-déclencheur de rôle RELATION) : deux relations distinctes trouvées via le lexique → abstention au niveau de la compréhension, jamais la première rencontrée', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'zrel1', relation: 'zrel1' });
  await apprendreRelation(esprit, { mot: 'zrel2', relation: 'zrel2' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  esprit = await chargerEsprit(magasin);
  // Avant ce chantier : "zrel2" (premier mot-relation rencontré dans l'ordre de la phrase) aurait
  // été choisi silencieusement, et faits["zalpha|zrel2"] (absent) aurait donné une « Je ne sais pas »
  // CONFIANTE (etat=compris) -- un faux négatif plus trompeur qu'une vraie abstention. On vérifie ici
  // le niveau COMPRÉHENSION seul (comprendre(), pas repondre()) : aucun choix arbitraire entre les
  // deux relations candidates. (Que repondre() retrouve ensuite la réponse par COMPOSITION, voir
  // étape 2 ci-dessous, est un mécanisme strictement postérieur et séparé.)
  const c = comprendre('Quel est le zrel2 du zrel1 de zalpha ?', {
    lexique: esprit.lexique, prenomsConnus: esprit.prenomsConnus,
    sujetsConnus: esprit.sujetsConnus, relationsConnues: esprit.relationsConnues,
  });
  assert.equal(c.sujet, 'zalpha');
  assert.equal(c.relation, null, 'deux relations distinctes nommées : abstention, pas un choix arbitraire');
  assert.deepEqual([...c.relationsNommees].sort(), ['zrel1', 'zrel2']);
});

// ---------------------------------------------------------------------------------------------
// ÉTAPE 2 — resoudreChemin() : LA PRIMITIVE GÉNÉRIQUE DE RÉSOLUTION
// ---------------------------------------------------------------------------------------------

test('2.A. resoudreChemin() pure : chaîne de 2 relations réussie (zalpha -zrel1-> zbeta -zrel2-> zgamma)', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  esprit = await chargerEsprit(magasin);
  assert.equal(resoudreChemin(esprit, 'zalpha', ['zrel1', 'zrel2']), 'zgamma');
});

test('2.B. resoudreChemin() pure : chaîne de 3 relations réussie SANS AUCUN CODE SUPPLÉMENTAIRE (même primitive, aucune limite codée en dur à 2 étapes)', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  await apprendreFait(esprit, { sujet: 'zgamma', relation: 'zrel3', valeur: 'zdelta' });
  esprit = await chargerEsprit(magasin);
  assert.equal(resoudreChemin(esprit, 'zalpha', ['zrel1', 'zrel2', 'zrel3']), 'zdelta');
});

test('2.C. resoudreChemin() pure : rupture intermédiaire (aucun fait pour la 2e étape) → abstention (null), jamais une valeur inventée', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  // zbeta/zrel2 n'existe pas : la chaîne casse à la 2e étape.
  esprit = await chargerEsprit(magasin);
  assert.equal(resoudreChemin(esprit, 'zalpha', ['zrel1', 'zrel2']), null);
});

test('2.D. resoudreChemin() pure : première étape déjà absente → abstention', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  assert.equal(resoudreChemin(esprit, 'zalpha', ['zrel1', 'zrel2']), null);
});

test('2.E. resoudreChemin() pure : un conflit de faits en cours de chemin → abstention, jamais un choix au hasard', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  esprit = await chargerEsprit(magasin);
  // Deux lignes réellement persistées, même identité (zbeta|zrel2), valeurs différentes → conflit.
  await magasin.ecrire('faits', { cle: 'ligneA', sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  await magasin.ecrire('faits', { cle: 'ligneB', sujet: 'zbeta', relation: 'zrel2', valeur: 'zautre' });
  esprit = await chargerEsprit(magasin);
  assert.ok(esprit.conflitsFaits.has('zbeta|zrel2'), 'préconditions du test : le conflit doit être détecté par le chargement normal');
  assert.equal(resoudreChemin(esprit, 'zalpha', ['zrel1', 'zrel2']), null, 'un conflit en cours de chemin doit abstenir, jamais choisir une des deux valeurs au hasard');
});

// ---------------------------------------------------------------------------------------------
// ÉTAPE 2 (suite) — INTÉGRATION DANS repondre() : COMPRÉHENSION (chemin explicite, non ordonné) +
// RÉSOLUTION (essaie les ordres possibles, accepte seulement s'il n'y en a qu'un qui aboutisse).
// ---------------------------------------------------------------------------------------------

test('3.A. repondre() compose automatiquement une chaîne de 2 relations explicitement nommées, sans que B (zbeta) soit jamais mentionné dans la question', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'zrel1', relation: 'zrel1' });
  await apprendreRelation(esprit, { mot: 'zrel2', relation: 'zrel2' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'zalpha zrel1 zrel2 ?');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'zgamma', 'B (zbeta) est retrouvé tout seul par la chaîne, jamais nommé dans la question');
  assert.equal(r.compose, true);
});

test('3.B. repondre() : chemin de 3 relations, même mécanisme, zéro code spécial supplémentaire', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  for (const r of ['zrel1', 'zrel2', 'zrel3']) await apprendreRelation(esprit, { mot: r, relation: r });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  await apprendreFait(esprit, { sujet: 'zgamma', relation: 'zrel3', valeur: 'zdelta' });
  esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'zalpha zrel1 zrel2 zrel3 ?');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'zdelta');
});

test('3.C. rupture de chaîne (2e relation sans fait compatible) → abstention explicite, jamais une réponse inventée', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'zrel1', relation: 'zrel1' });
  await apprendreRelation(esprit, { mot: 'zrel2', relation: 'zrel2' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  // zbeta/zrel2 n'existe pas.
  esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'zalpha zrel1 zrel2 ?');
  assert.equal(r.etat, 'partiel', 'aucun chemin ne doit aboutir : abstention, jamais une tentative à moitié');
});

test('3.D. deux relations nommées mais sans AUCUN chemin compatible (sujet connu, mais ni zrel1 ni zrel2 ne partent de lui) → abstention', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'zrel1', relation: 'zrel1' });
  await apprendreRelation(esprit, { mot: 'zrel2', relation: 'zrel2' });
  // "zalpha" est un sujet CONNU (via un fait sans rapport), mais aucun fait zrel1/zrel2 ne part de
  // lui dans aucun des deux ordres : les deux chemins possibles cassent dès la première étape.
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrelautre', valeur: 'zvaleurautre' });
  esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'zalpha zrel1 zrel2 ?');
  assert.equal(r.etat, 'partiel');
});

test('3.E. AUCUNE FAUSSE TRANSITIVITÉ : « A aime B » + « B aime C » ne doit JAMAIS produire « A aime C » (une seule relation nommée, jamais deux)', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'aime', relation: 'aime' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'aime', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'aime', valeur: 'zgamma' });
  esprit = await chargerEsprit(magasin);
  // Une seule relation ("aime") répétée deux fois n'est PAS "deux relations distinctes nommées" :
  // relationsNommees doit rester de taille 1, la composition ne doit jamais se déclencher.
  const c = comprendre('Est-ce que zalpha aime zgamma ?', {
    lexique: esprit.lexique, prenomsConnus: esprit.prenomsConnus,
    sujetsConnus: esprit.sujetsConnus, relationsConnues: esprit.relationsConnues,
  });
  assert.deepEqual(c.relationsNommees, ['aime'], 'une seule relation nommée, même répétée : jamais vue comme un chemin à deux étapes');
  const r = repondre(esprit, 'Est-ce que zalpha aime zgamma ?');
  assert.notEqual(r.texte, 'zgamma', 'jamais de transitivité implicite construite à partir de deux faits qui se trouvent chaîner');
});

test('3.F. aucune écriture permanente : la composition ne crée jamais un nouveau Fait dérivé en mémoire', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'zrel1', relation: 'zrel1' });
  await apprendreRelation(esprit, { mot: 'zrel2', relation: 'zrel2' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  esprit = await chargerEsprit(magasin);
  const avant = (await magasin.lireTout('faits')).length;
  repondre(esprit, 'zalpha zrel1 zrel2 ?');
  const apres = (await magasin.lireTout('faits')).length;
  assert.equal(apres, avant, 'aucun fait composé/dérivé ne doit être écrit en mémoire : une réponse ponctuelle, jamais une connaissance permanente');
});

test('3.G. ambiguïté véritable : deux ordres de chemin différents aboutissent à des valeurs DIFFÉRENTES → abstention (jamais un choix arbitraire)', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreRelation(esprit, { mot: 'zrelx', relation: 'zrelx' });
  await apprendreRelation(esprit, { mot: 'zrely', relation: 'zrely' });
  // Construit pour que LES DEUX ordres (x puis y, et y puis x) aboutissent, à des valeurs distinctes.
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrelx', valeur: 'zun' });
  await apprendreFait(esprit, { sujet: 'zun', relation: 'zrely', valeur: 'zfinA' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrely', valeur: 'zdeux' });
  await apprendreFait(esprit, { sujet: 'zdeux', relation: 'zrelx', valeur: 'zfinB' });
  esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'zalpha zrelx zrely ?');
  assert.equal(r.etat, 'partiel', 'deux chemins valides mais de résultats différents : abstention, jamais un ordre choisi au hasard');
});

test('3.H. zéro régression : une question à relation UNIQUE continue de répondre exactement comme avant (chemin normal, jamais détourné par la composition)', async () => {
  const magasin = magasinMemoireVive();
  let esprit = await chargerEsprit(magasin);
  await apprendreFait(esprit, { sujet: 'naissance', relation: 'nom', valeur: 'Naissance' });
  esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, 'Comment tu t\'appelles ?');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'Naissance');
  assert.notEqual(r.compose, true);
});
// === FIN_TEST_COMPOSITION_CONNAISSANCES ===
