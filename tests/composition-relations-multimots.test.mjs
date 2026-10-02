// === DEBUT_TEST_COMPOSITION_RELATIONS_MULTIMOTS ===
// v0.34 — LOT 3, DÉCISION CHATGPT « CHANTIER v0.34.0 » : relationsNommeesDistinctes() (comprendre.js,
// v0.33) ne détectait que les relations à UN SEUL MOT -- limite assumée dès v0.33, confirmée par le
// diagnostic automatisé post-v0.33 (famille 1 : « peut posséder »/« peut produire », cas néril/talo/
// séra). Ce chantier étend la détection aux relations à PLUSIEURS MOTS déjà apprises, en réutilisant le
// même mécanisme de recherche de séquence que trouverRelation() (trouverSequenceConnueDetail), balayé de
// GAUCHE À DROITE pour trouver TOUTES les relations distinctes non chevauchantes (pas seulement la
// meilleure) -- aucune morphologie, aucune conjugaison, correspondance canonique exacte uniquement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre } from '../app/langage/comprendre.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { chargerEsprit, apprendreFait, repondre } from '../app/langage/esprit.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

test('LOT 3 — relationsNommeesDistinctes détecte DEUX relations à PLUSIEURS mots dans une même phrase', () => {
  const lex = { ...LEXIQUE_DEPART };
  const relationsConnues = new Set(['peut posseder', 'peut produire']);
  const c = comprendre('Un neril peut posseder quoi qui peut produire du sera ?', { lexique: lex, relationsConnues, sujetsConnus: new Set(['neril']) });
  assert.deepEqual([...c.relationsNommees].sort(), ['peut posseder', 'peut produire']);
});

test('LOT 3 — mélange relation 1 mot / relation plusieurs mots, toutes deux détectées sans chevauchement', () => {
  const lex = { ...LEXIQUE_DEPART };
  const relationsConnues = new Set(['possede', 'se situe en']);
  const c = comprendre('zalpha possede se situe en quoi ?', { lexique: lex, relationsConnues, sujetsConnus: new Set(['zalpha']) });
  assert.deepEqual([...c.relationsNommees].sort(), ['possede', 'se situe en']);
});

test('LOT 3 — CAS RÉEL néril/talo/séra (non-régression du diagnostic) : COMPOSE enfin avec des formes qui coïncident littéralement', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'neril', relation: 'peut posseder', valeur: 'talo' });
  await apprendreFait(esprit, { sujet: 'talo', relation: 'peut produire', valeur: 'sera' });
  const r = repondre(esprit, 'Un neril peut posseder quoi qui peut produire du sera ?');
  assert.equal(r.texte, 'sera');
  assert.equal(r.etat, 'compris');
  assert.equal(r.compose, true);
});

test('LOT 3 — le cas néril/talo/séra avec la formulation LITTÉRALE originale ("un talo" ≠ "talo") reste une abstention honnête (morphologie hors périmètre)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'neril', relation: 'peut posseder', valeur: 'un talo' });
  await apprendreFait(esprit, { sujet: 'talo', relation: 'peut produire', valeur: 'sera' });
  const r = repondre(esprit, 'Un neril peut posseder quoi qui peut produire du sera ?');
  assert.notEqual(r.texte, 'sera', 'la non-coïncidence littérale "un talo"/"talo" est hors périmètre de ce chantier');
});

test('LOT 3 — chemin 3 étapes avec relations à plusieurs mots, zéro code supplémentaire', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'peut avoir', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'peut produire', valeur: 'zgamma' });
  await apprendreFait(esprit, { sujet: 'zgamma', relation: 'peut devenir', valeur: 'zdelta' });
  const r = repondre(esprit, 'zalpha peut avoir peut produire peut devenir ?');
  assert.equal(r.texte, 'zdelta');
  assert.equal(r.compose, true);
});

test('LOT 3 — rupture de chemin avec relations à plusieurs mots → abstention, pas de fait dérivé', async () => {
  const { esprit, magasin } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'peut avoir', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zautre', relation: 'peut produire', valeur: 'zignore' }); // connue, mais zbeta n'en a pas
  const avant = (await magasin.lireTout('faits')).length;
  const r = repondre(esprit, 'zalpha peut avoir peut produire ?');
  assert.notEqual(r.etat, 'compris');
  const apres = (await magasin.lireTout('faits')).length;
  assert.equal(apres, avant, 'aucun fait dérivé ne doit être écrit');
});

test('LOT 3 — aucune fausse transitivité : une relation à plusieurs mots répétée ne compose jamais seule', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'peut aimer', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'peut aimer', valeur: 'zgamma' });
  const c = comprendre('Est-ce que zalpha peut aimer zgamma ?', { lexique: LEXIQUE_DEPART, relationsConnues: esprit.relationsConnues, sujetsConnus: esprit.sujetsConnus });
  assert.equal(c.relationsNommees.length, 1, 'une seule relation distincte, même répétée deux fois dans la phrase');
  const r = repondre(esprit, 'Est-ce que zalpha peut aimer zgamma ?');
  assert.notEqual(r.texte, 'zgamma');
});

test('LOT 3 — NON-RÉGRESSION : la composition à relations 1 mot (v0.33) fonctionne toujours', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await apprendreFait(esprit, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  const r = repondre(esprit, 'zalpha zrel1 zrel2 ?');
  assert.equal(r.texte, 'zgamma');
  assert.equal(r.compose, true);
});
// === FIN_TEST_COMPOSITION_RELATIONS_MULTIMOTS ===
