// v0.17.6 — LE PREMIER PONT INDUCTION → COMPRÉHENSION. Une connaissance GÉNÉRALE « gabarit(s) →
// signification » (table gabaritsTypes), jamais spécifique à VERIFICATION : chaque entrée porte sa
// propre signification (une chaîne libre), pas une des trois constantes de comprendre.js. Le corpus
// est fourni EXPLICITEMENT à chaque appel (aucune mémoire d'expériences). Le point d'entrée EST
// simplement l'usage conjoint de deux fonctions déjà de la bonne taille : induire() (analyse,
// inchangée) et apprendreGabaritType() (écriture, nouvelle) — aucune troisième fonction de « colle »,
// aucun nouvel écran.
//
// PREUVE DÉCISIVE DEMANDÉE : un gabarit réellement ABSENT du bagage initial (jamais « quel »,
// « est-ce que » ou l'inversion) — ici, le simple mot « salut » comme marqueur d'une signification
// illustrative « SALUTATION », choisie arbitrairement pour la démonstration (aucun rapport avec une
// catégorie déjà câblée).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre, AFFIRMATION } from '../app/langage/comprendre.js';
import { chargerEsprit, repondre, apprendreGabaritType } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { induire } from '../app/langage/induction.js';
import { LEXIQUE_DEPART, ROLES } from '../app/langage/bagage.js';

const LEX = { ...LEXIQUE_DEPART, manteau: { role: ROLES.RELATION, relation: 'manteau' } };

const POSITIFS = ['Salut, mon manteau est bleu.', 'Salut, ma couleur est rouge.'];
const NEGATIFS = ['Mon manteau est bleu.', 'Ma couleur est rouge.'];
const TEMOIN = 'Salut, mon prénom est Paul.'; // jamais dans POSITIFS/NEGATIFS

// ============================================================================ 1. AVANT apprentissage
test('1. AVANT apprentissage : la phrase témoin reste AFFIRMATION (comprendre() seule, sans esprit)', () => {
  assert.equal(comprendre(TEMOIN, { lexique: LEX }).type, AFFIRMATION);
});

test('1bis. AVANT apprentissage, via le vrai esprit : idem', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  const r = repondre(esprit, TEMOIN);
  assert.equal(r.comprehension.type, AFFIRMATION);
});

// ============================================================================ 2. INDUCTION
test('2. induire() découvre le gabarit « salut » à partir des exemples', () => {
  const rapport = induire(POSITIFS, NEGATIFS, { lexique: LEX });
  assert.equal(rapport.hypotheses.length, 1);
  assert.deepEqual(rapport.hypotheses[0].candidats, ['mot:salut']);
  assert.equal(rapport.conflits.length, 0);
});

// ============================================================================ 3. AVANT confirmation : rien de persisté, rien de changé
test('3. AVANT confirmation : aucune écriture, comportement inchangé', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  induire(POSITIFS, NEGATIFS, { lexique: LEX }); // le rapport existe, mais n'est jamais transmis à l'esprit
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
  assert.equal(repondre(esprit, TEMOIN).comprehension.type, AFFIRMATION);
});

// ============================================================================ 4. CONFIRMATION : persistance
test('4. CONFIRMATION : apprendreGabaritType() persiste le gabarit + sa signification', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  const rapport = induire(POSITIFS, NEGATIFS, { lexique: LEX });
  const h = rapport.hypotheses[0];
  await apprendreGabaritType(esprit, { candidats: h.candidats, gabarits: h.gabarits, signification: 'SALUTATION', exemples: h.couverture });
  const table = await magasin.lireTout('gabaritsTypes');
  assert.equal(table.length, 1);
  assert.equal(table[0].signification, 'SALUTATION');
  assert.equal(table[0].statut, 'validee');
  assert.deepEqual(table[0].exemples, POSITIFS);
});

// ============================================================================ 5. APRÈS confirmation : phrase jamais vue, généralisation réelle
test('5. APRÈS confirmation : la phrase témoin (jamais vue) est classée SALUTATION, dans le même esprit', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  const rapport = induire(POSITIFS, NEGATIFS, { lexique: LEX });
  const h = rapport.hypotheses[0];
  await apprendreGabaritType(esprit, { candidats: h.candidats, gabarits: h.gabarits, signification: 'SALUTATION', exemples: h.couverture });
  assert.equal(repondre(esprit, TEMOIN).comprehension.type, 'SALUTATION');
  // Non-régression locale : une phrase sans « salut » reste inchangée.
  assert.equal(repondre(esprit, 'Mon manteau est bleu.').comprehension.type, AFFIRMATION);
});

// ============================================================================ 6. APRÈS RECHARGEMENT COMPLET
test('6. APRÈS RECHARGEMENT COMPLET (nouvel esprit, même magasin) : la connaissance survit', async () => {
  const magasin = magasinMemoireVive();
  const premier = await chargerEsprit(magasin);
  const rapport = induire(POSITIFS, NEGATIFS, { lexique: LEX });
  const h = rapport.hypotheses[0];
  await apprendreGabaritType(premier, { candidats: h.candidats, gabarits: h.gabarits, signification: 'SALUTATION', exemples: h.couverture });
  const frais = await chargerEsprit(magasin); // nouvel objet esprit, RELIT le magasin depuis zéro
  assert.equal(repondre(frais, TEMOIN).comprehension.type, 'SALUTATION');
});

// ============================================================================ 7. ANNULATION : aucun effet
test('7. ANNULATION (le rapport est vu, jamais confirmé) : aucun effet, jamais', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  const rapport = induire(POSITIFS, NEGATIFS, { lexique: LEX });
  assert.equal(rapport.hypotheses.length, 1); // le rapport EXISTE...
  // ...mais personne n'appelle apprendreGabaritType : c'est ça, « Annuler ».
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
  assert.equal(repondre(esprit, TEMOIN).comprehension.type, AFFIRMATION);
});

// ============================================================================ 8. RÉGRESSION explicite : comportement par défaut strictement identique
test('8. RÉGRESSION : comprendre() sans 3e paramètre se comporte exactement comme avant (verrou v0.17.3/4/5)', () => {
  assert.equal(comprendre('Quel est mon manteau ?', { lexique: LEX }).type, 'question_information');
  assert.equal(comprendre('Est-ce que mon manteau est bleu ?', { lexique: LEX }).type, 'verification');
  assert.equal(comprendre('Mon manteau est bleu.', { lexique: LEX }).type, AFFIRMATION);
});

// ============================================================================ Signature incomplète refusée (garde-fou d'écriture)
test('apprendreGabaritType refuse une écriture sans signification, sans candidats ou sans gabarits', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await assert.rejects(() => apprendreGabaritType(esprit, { candidats: ['mot:salut'], gabarits: [[{ mot: 'salut' }]], signification: '' }));
  await assert.rejects(() => apprendreGabaritType(esprit, { candidats: [], gabarits: [[{ mot: 'salut' }]], signification: 'X' }));
  await assert.rejects(() => apprendreGabaritType(esprit, { candidats: ['mot:salut'], gabarits: [], signification: 'X' }));
  assert.deepEqual(await magasin.lireTout('gabaritsTypes'), []);
});

// ============================================================================ Remplacement : une connaissance périmée n'est plus utilisée
test('réapprendre le MÊME gabarit avec une AUTRE signification remplace l’ancienne, jamais les deux actives', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  const rapport = induire(POSITIFS, NEGATIFS, { lexique: LEX });
  const h = rapport.hypotheses[0];
  await apprendreGabaritType(esprit, { candidats: h.candidats, gabarits: h.gabarits, signification: 'SALUTATION', exemples: h.couverture });
  assert.equal(repondre(esprit, TEMOIN).comprehension.type, 'SALUTATION');
  await apprendreGabaritType(esprit, { candidats: h.candidats, gabarits: h.gabarits, signification: 'AUTRE_CHOSE', exemples: h.couverture });
  assert.equal(repondre(esprit, TEMOIN).comprehension.type, 'AUTRE_CHOSE', 'la nouvelle signification remplace l’ancienne');
  const table = await magasin.lireTout('gabaritsTypes');
  assert.equal(table.filter((g) => g.statut === 'validee').length, 1);
  assert.equal(table.filter((g) => g.statut === 'remplacee').length, 1);
});

// ============================================================================ GARDE-FOU : induction.js reste isolé (comprendre.js ne l'importe toujours pas)
test('GARDE-FOU — comprendre.js ne dépend toujours pas de induction.js (seul esprit.js/le point d’entrée orchestrent)', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'langage');
  const src = readFileSync(join(dir, 'comprendre.js'), 'utf8');
  assert.ok(!src.includes('induction.js'));
});

test('GARDE-FOU — la logique interne de induire()/passeFinale() n’a pas changé (suite v0.17.5 intacte)', async () => {
  // Vérifié indirectement par la suite complète (tests/induction.test.mjs, inchangé) ; ce test
  // confirme seulement que le fichier exporte toujours exactement les mêmes noms qu'avant ce chantier.
  const module = await import('../app/langage/induction.js');
  for (const nom of ['induire', 'passeFinale', 'representerExemple', 'contientGabarit', 'cleGabarit']) {
    assert.equal(typeof module[nom], 'function', `induction.js doit toujours exporter ${nom}`);
  }
});
