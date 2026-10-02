// === DEBUT_TEST_DEDUCTION ===
// v0.42 — DÉCISION CHATGPT « DÉDUCTION DÉTERMINISTE MULTI-FAITS » (02/10).
//
// Nouvelle primitive INTERNE, indépendante du langage et du flux conversationnel (même discipline
// que tests/selection.test.mjs, v0.41) : appliquer des RÈGLES déjà enseignées (apprendreRegle(),
// esprit.js — mécanisme regles.js, présent depuis v0.10) aux FAITS RÉELS d'un sujet (proprietesDe(),
// selection.js, v0.41), là où jusqu'ici appliquerRegles() n'était nourri que de propriétés
// morphologiques d'un mot (remplirGabarit()). AUCUN raccord à comprendre()/repondre() dans ce
// fichier : voir tests/deduction-action.test.mjs pour le raccord via le registre (B2/B3).
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zrole...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait, apprendreRegle } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { deduire } from '../app/langage/deduction.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

// ---------------------------------------------------------------------------------------------
// Règle à une seule condition
// ---------------------------------------------------------------------------------------------
test('deduire : une règle à une condition se déclenche quand le fait du sujet la satisfait', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRegle(esprit, {
    role: 'zrole', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zfroid',
  });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });

  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole' });
  assert.deepEqual(r.resultat, 'zfroid');
  assert.ok(r.regle);
});

test('deduire : fait absent ou non conforme → aucune règle applicable, jamais deviné', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRegle(esprit, {
    role: 'zrole', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zfroid',
  });

  // Sujet totalement inconnu : aucun fait du tout.
  const rInconnu = deduire(esprit, { sujet: 'zinconnu', role: 'zrole' });
  assert.equal(rInconnu.resultat, null);
  assert.ok(!rInconnu.conflit);

  // Sujet connu, mais la valeur ne correspond pas à la condition.
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zrouge' });
  const rNonConforme = deduire(esprit, { sujet: 'zkelmi', role: 'zrole' });
  assert.equal(rNonConforme.resultat, null);
  assert.ok(!rNonConforme.conflit);
});

// ---------------------------------------------------------------------------------------------
// Règle à plusieurs conditions — PLUSIEURS FAITS DISTINCTS exigés ensemble
// ---------------------------------------------------------------------------------------------
test('deduire : une règle à deux conditions exige les DEUX faits à la fois', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRegle(esprit, {
    role: 'zrole',
    conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }, { propriete: 'ztaille', valeur: 'zgrand' }],
    resultat: 'zvoilier',
  });

  // Un seul des deux faits : la règle à deux conditions ne se déclenche pas.
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  const rPartiel = deduire(esprit, { sujet: 'zorbo', role: 'zrole' });
  assert.equal(rPartiel.resultat, null);

  // Les deux faits ensemble : la règle se déclenche.
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'ztaille', valeur: 'zgrand' });
  const rComplet = deduire(esprit, { sujet: 'zorbo', role: 'zrole' });
  assert.equal(rComplet.resultat, 'zvoilier');
});

test('deduire : règle la plus spécifique (deux conditions) préférée à une règle plus générale (une condition)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRegle(esprit, {
    role: 'zrole', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zgeneral',
  });
  await apprendreRegle(esprit, {
    role: 'zrole',
    conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }, { propriete: 'ztaille', valeur: 'zgrand' }],
    resultat: 'zspecifique',
  });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'ztaille', valeur: 'zgrand' });

  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole' });
  assert.equal(r.resultat, 'zspecifique');
});

// ---------------------------------------------------------------------------------------------
// Conflit — abstention explicite, jamais un choix arbitraire
// ---------------------------------------------------------------------------------------------
test('deduire : deux règles également spécifiques et contradictoires → conflit explicite, jamais un résultat deviné', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRegle(esprit, {
    role: 'zroleA', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zfroid',
  });
  // Rôle différent, mêmes conditions, résultat différent : pour forcer le conflit sans que la
  // seconde règle REMPLACE la première (apprendreRegle() remplace à rôle+conditions identiques),
  // on apprend une règle de même rôle que la première mais avec une condition différente qui,
  // combinée aux faits du sujet, est tout aussi spécifique (une seule condition chacune) et
  // contradictoire.
  await apprendreRegle(esprit, {
    role: 'zroleA', conditions: [{ propriete: 'ztaille', valeur: 'zgrand' }], resultat: 'zchaud',
  });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'ztaille', valeur: 'zgrand' });

  const r = deduire(esprit, { sujet: 'zorbo', role: 'zroleA' });
  assert.equal(r.resultat, null);
  assert.equal(r.conflit, true);
  assert.equal(r.candidats.length, 2);
});

// ---------------------------------------------------------------------------------------------
// Garanties structurelles
// ---------------------------------------------------------------------------------------------
test('deduire : ne mémorise jamais rien — une déduction ponctuelle, jamais un fait dérivé permanent', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRegle(esprit, {
    role: 'zrole', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zfroid',
  });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  const avant = esprit.faits.size;

  deduire(esprit, { sujet: 'zorbo', role: 'zrole' });

  assert.equal(esprit.faits.size, avant, 'aucun fait ajouté par une déduction');
});

test('deduire : rôle totalement absent du registre de règles → aucune règle applicable, jamais une erreur', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  const r = deduire(esprit, { sujet: 'zorbo', role: 'zroleInconnu' });
  assert.equal(r.resultat, null);
  assert.ok(!r.conflit);
});
// === FIN_TEST_DEDUCTION ===
