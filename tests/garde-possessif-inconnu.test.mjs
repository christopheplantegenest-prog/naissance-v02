// v0.64.12 — J1b « GARDE CONTRE L'IGNORANCE SILENCIEUSE » (décision ChatGPT « MISSION DE DÉVELOPPEMENT v0.64.12 — J1 », 14/10/2026).
// Un mot INCONNU juste après un possessif (« mon chat ») ne doit plus être ignoré au profit d'une autre relation connue : comprendre() rend
// relation = null (PARTIEL), la provenance consigne l'occurrence écartée avec la raison « possessif-inconnu », aucune relation nommée n'est rendue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre, indicePossessifSuiviDInconnu, COMPRIS, PARTIEL } from '../app/langage/comprendre.js';
import { comprendre as comprendreAvant } from './oracle-comprendre-v0630.mjs';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';
import { chargerEsprit, repondre, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';

async function espritAvec(faits) {
  const e = await chargerEsprit(magasinMemoireVive());
  for (const [sujet, relation, valeur] of faits) await apprendreFait(e, { sujet, relation, valeur });
  return e;
}
const FAITS = [['moi', 'nom', 'Christophe'], ['moi', 'couleur', 'bleu'], ['moi', 'ville', 'Cognac'], ['moi', 'fils', 'Atem'],
  ['moi', 'chien', 'Rex'], ['naissance', 'couleur', 'rouge'], ['Rex', 'couleur', 'noir']];

test('G1. le défaut supprimé : « Comment s\'appelle mon chat ? » ne rend plus le nom de Christophe (PARTIEL), ni celui du chien', async () => {
  const e = await espritAvec(FAITS);
  for (const q of ["Comment s'appelle mon chat ?", 'Quel est le nom de mon chat ?', "Comment s'appelle ton chat ?"]) {
    const r = repondre(e, q);
    assert.equal(r.etat, PARTIEL, q);
    assert.notEqual(r.texte, 'Christophe', q);
    assert.notEqual(r.texte, 'Rex', q);
    assert.notEqual(r.texte, 'Naissance', q);
  }
});

test('G2. autres réponses fausses mesurées, supprimées : objet inconnu sous un possessif, y compris par la COMPOSITION', async () => {
  const e = await espritAvec(FAITS);
  for (const q of ['Quelle est la couleur de mon vélo ?', 'Quelle est la couleur du chien de mon voisin ?', "Comment s'appelle mon gamin ?"]) {
    const r = repondre(e, q);
    assert.equal(r.etat, PARTIEL, q);
    assert.ok(!['bleu', 'noir', 'Christophe'].includes(r.texte), q);
    assert.deepEqual(r.comprehension.relationsNommees, [], `aucune relation nommée sous la garde : ${q}`);
  }
});

test('G3. questions valides PRÉSERVÉES (mêmes réponses qu\'avant la garde)', async () => {
  const e = await espritAvec(FAITS);
  const attendus = {
    "Comment je m'appelle ?": 'Christophe', 'Quel est mon nom ?': 'Christophe', "Comment s'appelle mon chien ?": 'Rex',
    'Quelle est ma ville ?': 'Cognac', 'Quelle est ma couleur ?': 'bleu', 'Quelle est ma couleur préférée ?': 'bleu',
    'Quelle est ta couleur ?': 'rouge', 'Quelle est la couleur de mon chien ?': 'noir', 'Quel est mon chien ?': 'Rex',
  };
  for (const [q, valeur] of Object.entries(attendus)) {
    const r = repondre(e, q);
    assert.equal(r.etat, COMPRIS, q);
    assert.equal(r.texte, valeur, q);
  }
});

test('G4. ABSTENTION PRUDENTE documentée : un adjectif inconnu entre le possessif et la relation (« mon petit chien ») → PARTIEL', async () => {
  const e = await espritAvec(FAITS);
  const r = repondre(e, "Comment s'appelle mon petit chien ?");
  assert.equal(r.etat, PARTIEL);
  assert.notEqual(r.texte, 'Rex');
});

test('G5. provenance : relation null, occurrence écartée « possessif-inconnu » à la position du porteur, invariants respectés', () => {
  const e = { lexique: LEXIQUE_DEPART, prenomsConnus: new Set(), sujetsConnus: new Set(), relationsConnues: new Set(['nom']) };
  const c = comprendre("Comment s'appelle mon chat ?", e);
  assert.equal(c.relation, null);
  assert.equal(c.etat, PARTIEL);
  assert.equal(c.provenanceAnalyse.relation, null);
  const ecartees = c.provenanceAnalyse.ecartees.filter((x) => x.raison === 'possessif-inconnu');
  assert.equal(ecartees.length, 1);
  assert.equal(c.mots[ecartees[0].debut], 'appelle', 'le porteur écarté est le verbe « appelle » (relation nom)');
  assert.equal(ecartees[0].valeur, 'nom');
  // l'ancien comportement, pour mémoire : la relation était « nom »
  assert.equal(comprendreAvant("Comment s'appelle mon chat ?", e).relation, 'nom');
});

test('G6. la garde est STRUCTURELLE et non globale : un mot inconnu ailleurs ne change rien', () => {
  const e = { lexique: LEXIQUE_DEPART, prenomsConnus: new Set(), sujetsConnus: new Set(), relationsConnues: new Set(['couleur']) };
  const phrase = 'Quelle est ma couleur zorblax ?';
  assert.deepStrictEqual(comprendre(phrase, e), comprendreAvant(phrase, e));
  assert.equal(comprendre(phrase, e).relation, 'couleur');
  const mots = ['comment', 's', 'appelle', 'mon', 'chat'];
  assert.equal(indicePossessifSuiviDInconnu(mots, LEXIQUE_DEPART, new Set(), new Set(), new Set()), 4);
  assert.equal(indicePossessifSuiviDInconnu(mots, LEXIQUE_DEPART, new Set(), new Set(), new Set(['chat'])), -1, 'relation connue (par un fait) : pas de garde');
  assert.equal(indicePossessifSuiviDInconnu(mots, LEXIQUE_DEPART, new Set(['chat']), new Set(), new Set()), -1, 'prénom connu : pas de garde');
  assert.equal(indicePossessifSuiviDInconnu(mots, LEXIQUE_DEPART, new Set(), new Set(['chat']), new Set()), -1, 'sujet connu : pas de garde');
  assert.equal(indicePossessifSuiviDInconnu(['quelle', 'est', 'ma', 'couleur'], LEXIQUE_DEPART, new Set(), new Set(), new Set()), -1);
  assert.equal(indicePossessifSuiviDInconnu(['mon'], LEXIQUE_DEPART, new Set(), new Set(), new Set()), -1, 'possessif final : rien à garder');
});

test('G7. une relation connue SEULEMENT par un fait (aucune ligne de lexique) n\'est pas un mot inconnu pour la garde', async () => {
  const e = await espritAvec([['moi', 'chien', 'Rex']]);
  assert.equal(e.lexique.chien, undefined);
  const r = repondre(e, "Comment s'appelle mon chien ?");
  assert.equal(r.etat, COMPRIS);
  assert.equal(r.texte, 'Rex');
});
