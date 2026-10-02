// === DEBUT_TEST_ACCESSIBILITE ===
// v0.44 — DÉCISION CHATGPT « COMPARATEUR LOGIQUE GÉNÉRAL / ACCESSIBILITÉ TRANSITIVE » (02/10),
// ARCHITECTURE X (capacité séparée, jamais une modification de confrontation.js).
//
// Nouvelle primitive INTERNE, indépendante du langage et du flux conversationnel (même discipline
// que tests/selection.test.mjs/tests/deduction.test.mjs) : « en suivant uniquement UNE relation
// donnée (« operateur »), répétée autant de fois que nécessaire, A permet-il d'atteindre B ? ».
// AUCUNE sémantique particulière n'est jamais supposée ici : le mot choisi comme operateur
// (« zordre », « zinverse », ou n'importe quel autre) n'a aucune incidence sur le code, seulement
// sur LES FAITS qui lui sont associés -- preuve apportée ci-dessous en faisant tourner la même
// primitive sur DEUX relations de significations opposées sans aucun changement de code.
//
// Domaine ARTIFICIEL neutre (zorbo/zkelmi/zrole...), comme pour tous les chantiers précédents.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chargerEsprit, apprendreFait } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import {
  estAccessible, ACCESSIBLE, INACCESSIBLE, INCONNU,
} from '../app/langage/accessibilite.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

// ---------------------------------------------------------------------------------------------
// Lien direct
// ---------------------------------------------------------------------------------------------
test('estAccessible : lien direct (A → B en un seul fait) → accessible', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  const r = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' });
  assert.equal(r.etat, ACCESSIBLE);
});

// ---------------------------------------------------------------------------------------------
// Chaîne de plusieurs occurrences de la même relation, profondeur variable
// ---------------------------------------------------------------------------------------------
test('estAccessible : chaîne de plusieurs occurrences de la même relation (profondeur 3) → accessible', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zordre', valeur: 'zfulgo' });
  await apprendreFait(esprit, { sujet: 'zfulgo', relation: 'zordre', valeur: 'zvex' });
  const r = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zvex' });
  assert.equal(r.etat, ACCESSIBLE);
});

test('estAccessible : profondeur variable (6 maillons) → accessible, aucune limite de profondeur codée en dur', async () => {
  const { esprit } = await nouvelEsprit();
  const chaine = ['za', 'zb', 'zc', 'zd', 'ze', 'zf', 'zg'];
  for (let i = 0; i < chaine.length - 1; i += 1) {
    await apprendreFait(esprit, { sujet: chaine[i], relation: 'zordre', valeur: chaine[i + 1] });
  }
  const r = estAccessible(esprit, { sujetA: 'za', operateur: 'zordre', sujetB: 'zg' });
  assert.equal(r.etat, ACCESSIBLE);
});

// ---------------------------------------------------------------------------------------------
// Cycle sans boucle infinie
// ---------------------------------------------------------------------------------------------
test('estAccessible : cycle (A → B → A) qui n\'atteint jamais la cible → inaccessible, jamais un blocage', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zordre', valeur: 'zorbo' });
  const r = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zinexistante' });
  assert.equal(r.etat, INACCESSIBLE);
});

test('estAccessible : cycle qui atteint la cible avant de reboucler → accessible', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zordre', valeur: 'zfulgo' });
  await apprendreFait(esprit, { sujet: 'zfulgo', relation: 'zordre', valeur: 'zorbo' }); // referme le cycle
  const r = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zfulgo' });
  assert.equal(r.etat, ACCESSIBLE);
});

// ---------------------------------------------------------------------------------------------
// Cible inaccessible — conclusion confiante, pas une abstention
// ---------------------------------------------------------------------------------------------
test('estAccessible : chaîne explorée en entier sans jamais atteindre la cible → inaccessible (confiant, pas inconnu)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zordre', valeur: 'zfulgo' });
  // zfulgo n'a aucun fait sortant : la chaîne s'arrête ici, sans jamais atteindre zinatteignable.
  const r = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zinatteignable' });
  assert.equal(r.etat, INACCESSIBLE);
});

// ---------------------------------------------------------------------------------------------
// Faits manquants / relation jamais enseignée — INCONNU ≠ FAUX
// ---------------------------------------------------------------------------------------------
test('estAccessible : la relation (« operateur ») n\'apparaît NULLE PART → inconnu, jamais inaccessible', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' }); // sans rapport
  const r = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordrejamaisenseigne', sujetB: 'zkelmi' });
  assert.equal(r.etat, INCONNU);
});

test('estAccessible : la relation est connue (pour d\'autres sujets) mais A n\'a AUCUN fait sortant pour elle → inconnu', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zkelmi', relation: 'zordre', valeur: 'zfulgo' }); // sans rapport avec zorbo
  const r = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zfulgo' });
  assert.equal(r.etat, INCONNU);
});

test('estAccessible : A et B canoniquement identiques sans qu\'aucun hop ne le confirme → jamais « accessible » par pure réflexivité', async () => {
  const { esprit } = await nouvelEsprit();
  const r = estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordrejamaisenseigne', sujetB: 'zorbo' });
  assert.equal(r.etat, INCONNU);
});

// ---------------------------------------------------------------------------------------------
// Conflit de faits rencontré pendant l'exploration — abstention, jamais un choix arbitraire
// ---------------------------------------------------------------------------------------------
test('estAccessible : un conflit de faits rencontré en cours de chemin → inconnu, jamais un choix arbitraire', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  // Conflit directement injecté dans le magasin (même technique que tests/identifiants-ecran.test.mjs,
  // baseAvecConflit()) : deux LIGNES de clés stockées distinctes, mais regroupées sous la même
  // identité canonique zkelmi|zordre (même sujet/relation) -- exactement comme « moi|téléphone » et
  // « moi|telephone » dans baseAvecConflit() sont deux clés distinctes pour la même identité.
  await magasin.ecrire('faits', { cle: 'zkelmi|zordre-a', sujet: 'zkelmi', relation: 'zordre', valeur: 'zfulgo' });
  await magasin.ecrire('faits', { cle: 'zkelmi|zordre-b', sujet: 'zkelmi', relation: 'zordre', valeur: 'zvex' });
  const espritRecharge = await chargerEsprit(magasin);
  const r = estAccessible(espritRecharge, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zvex' });
  assert.equal(r.etat, INCONNU);
});

// ---------------------------------------------------------------------------------------------
// Indépendance totale vis-à-vis du sens de la relation (« operateur » entièrement libre)
// ---------------------------------------------------------------------------------------------
test('estAccessible : deux relations de significations opposées, mêmes faits bruts, même code, zéro sémantique câblée', async () => {
  const { esprit: espritOrdre } = await nouvelEsprit();
  await apprendreFait(espritOrdre, { sujet: 'zorbo', relation: 'zplusgrandque', valeur: 'zkelmi' });
  await apprendreFait(espritOrdre, { sujet: 'zkelmi', relation: 'zplusgrandque', valeur: 'zfulgo' });
  assert.equal(estAccessible(espritOrdre, { sujetA: 'zorbo', operateur: 'zplusgrandque', sujetB: 'zfulgo' }).etat, ACCESSIBLE);
  assert.equal(estAccessible(espritOrdre, { sujetA: 'zfulgo', operateur: 'zplusgrandque', sujetB: 'zorbo' }).etat, INCONNU);

  const { esprit: espritAvant } = await nouvelEsprit();
  await apprendreFait(espritAvant, { sujet: 'zevenement1', relation: 'zavant', valeur: 'zevenement2' });
  await apprendreFait(espritAvant, { sujet: 'zevenement2', relation: 'zavant', valeur: 'zevenement3' });
  assert.equal(estAccessible(espritAvant, { sujetA: 'zevenement1', operateur: 'zavant', sujetB: 'zevenement3' }).etat, ACCESSIBLE);
  assert.equal(estAccessible(espritAvant, { sujetA: 'zevenement3', operateur: 'zavant', sujetB: 'zevenement1' }).etat, INCONNU);
});

// ---------------------------------------------------------------------------------------------
// Garantie structurelle : aucune écriture en mémoire
// ---------------------------------------------------------------------------------------------
test('estAccessible : ne mémorise jamais rien — une résolution ponctuelle, jamais un fait dérivé permanent', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zordre', valeur: 'zkelmi' });
  const avant = esprit.faits.size;
  estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zkelmi' });
  estAccessible(esprit, { sujetA: 'zorbo', operateur: 'zordre', sujetB: 'zinexistante' });
  assert.equal(esprit.faits.size, avant, 'aucun fait ajouté par une résolution d\'accessibilité');
});
// === FIN_TEST_ACCESSIBILITE ===
