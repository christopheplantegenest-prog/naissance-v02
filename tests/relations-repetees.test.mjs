// === DEBUT_TEST_RELATIONS_REPETEES ===
// v0.40 — DÉCISION CHATGPT « PROCHAINE ÉTAPE : RELATIONS RÉPÉTÉES » : la composition (v0.33/v0.34/
// v0.35) sait déjà enchaîner plusieurs relations DISTINCTES, mais perdait la RÉPÉTITION d'une même
// relation, pour deux raisons cumulées (voir comprendre.js et esprit.js pour le détail) :
//   1. relationsNommeesDistinctes() (comprendre.js) ramenait les relations nommées à un Set — un
//      « devient » cité deux fois dans la phrase ne comptait que pour UNE occurrence, alors que
//      tenterComposition()/resoudreChemin() (esprit.js, inchangés par ce chantier, déjà génériques
//      sur un tableau de n'importe quelle longueur, avec ou sans répétition) savent très bien suivre
//      un chemin qui emprunte deux fois la même relation, à condition qu'on la leur fournisse deux
//      fois.
//   2. repondre() (esprit.js) ne tentait la composition QUE depuis la branche PARTIEL — or une
//      relation UNIQUE répétée plusieurs fois dans la phrase (aucune AUTRE relation distincte en
//      concurrence) est vue par trouverRelation() comme une SEULE relation distincte : l'état produit
//      est COMPRIS, pas PARTIEL, et le chemin normal (un seul saut) répondait avec une valeur
//      INTERMÉDIAIRE, jamais la composition.
// Ce chantier corrige les deux points, SANS toucher à resoudreChemin()/permutations()/
// tenterComposition() (déjà génériques, zéro changement), SANS coder de règle particulière pour un mot
// ou une relation précise, et sans introduire de grammaire française spécifique. Domaine ARTIFICIEL
// neutre, comme pour tous les chantiers de composition précédents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre } from '../app/langage/comprendre.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { chargerEsprit, apprendreFait, repondre, resoudreChemin } from '../app/langage/esprit.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

// -------------------------------------------------------------------------------------------
// NIVEAU COMPRÉHENSION (comprendre.js) — relationsNommees doit conserver ORDRE et RÉPÉTITIONS
// -------------------------------------------------------------------------------------------

test('COMPRENDRE — une relation nommée deux fois dans la phrase donne relationsNommees de longueur 2 (ordre conservé), pas un Set dédupliqué', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zA', relation: 'zr1', valeur: 'zB' });
  const c = comprendre('zA zr1 zr1 ?', {
    lexique: esprit.lexique, sujetsConnus: esprit.sujetsConnus, relationsConnues: esprit.relationsConnues,
  });
  assert.deepEqual(c.relationsNommees, ['zr1', 'zr1']);
});

test('COMPRENDRE — mélange d\'une relation répétée et d\'une relation distincte : ordre ET répétition conservés', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zgraine', relation: 'zdevient', valeur: 'zpousse' });
  await apprendreFait(esprit, { sujet: 'zarbre', relation: 'zproduit', valeur: 'zfruit' });
  const c = comprendre('zgraine zdevient zdevient zproduit ?', {
    lexique: esprit.lexique, sujetsConnus: esprit.sujetsConnus, relationsConnues: esprit.relationsConnues,
  });
  assert.deepEqual(c.relationsNommees, ['zdevient', 'zdevient', 'zproduit']);
});

// -------------------------------------------------------------------------------------------
// NIVEAU RÉPONSE (esprit.js / repondre()) — la composition doit être tentée même quand trouverRelation
// voit une seule relation distincte (état COMPRIS), dès que relationsNommees compte ≥ 2 occurrences.
// -------------------------------------------------------------------------------------------

test('A --r1--> B --r1--> C : la composition traverse les DEUX sauts de la même relation, jamais la valeur intermédiaire', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zA', relation: 'zr1', valeur: 'zB' });
  await apprendreFait(esprit, { sujet: 'zB', relation: 'zr1', valeur: 'zC' });
  const r = repondre(esprit, 'zA zr1 zr1 ?');
  assert.equal(r.texte, 'zC', 'jamais "zB" (valeur intermédiaire)');
  assert.equal(r.etat, 'compris');
  assert.equal(r.compose, true);
});

test('A --r1--> B --r1--> C --r2--> D : exemple du chantier (graine/pousse/arbre/fruit), devient→devient→produit', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zgraine', relation: 'zdevient', valeur: 'zpousse' });
  await apprendreFait(esprit, { sujet: 'zpousse', relation: 'zdevient', valeur: 'zarbre' });
  await apprendreFait(esprit, { sujet: 'zarbre', relation: 'zproduit', valeur: 'zfruit' });
  const r = repondre(esprit, 'zgraine zdevient zdevient zproduit ?');
  assert.equal(r.texte, 'zfruit');
  assert.equal(r.compose, true);
});

test('trois répétitions de r1 : chemin à trois sauts, même relation', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zA', relation: 'zr1', valeur: 'zB' });
  await apprendreFait(esprit, { sujet: 'zB', relation: 'zr1', valeur: 'zC' });
  await apprendreFait(esprit, { sujet: 'zC', relation: 'zr1', valeur: 'zD' });
  const r = repondre(esprit, 'zA zr1 zr1 zr1 ?');
  assert.equal(r.texte, 'zD');
  assert.equal(r.compose, true);
});

test('relations DISTINCTES déjà supportées (v0.33/v0.35) : aucune régression', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zE', relation: 'zrA', valeur: 'zF' });
  await apprendreFait(esprit, { sujet: 'zF', relation: 'zrB', valeur: 'zG' });
  const r = repondre(esprit, 'zE zrA zrB ?');
  assert.equal(r.texte, 'zG');
  assert.equal(r.compose, true);
});

test('UNE SEULE occurrence littérale de r1 n\'autorise jamais artificiellement r1 → r1 (non-régression v0.33/v0.35, fausse transitivité)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zA', relation: 'zr1', valeur: 'zB' });
  await apprendreFait(esprit, { sujet: 'zB', relation: 'zr1', valeur: 'zC' });
  const c = comprendre('Est-ce que zA zr1 zC ?', {
    lexique: esprit.lexique, sujetsConnus: esprit.sujetsConnus, relationsConnues: esprit.relationsConnues,
  });
  assert.equal(c.relationsNommees.length, 1, 'une seule mention littérale : jamais vue comme chemin à deux étapes');
  const r = repondre(esprit, 'Est-ce que zA zr1 zC ?');
  assert.notEqual(r.texte, 'zC', 'aucune transitivité implicite à partir d\'une seule mention');
});

test('ambiguïté entre plusieurs ordres (relation répétée + relation distincte) menant à des valeurs DIFFÉRENTES → abstention', async () => {
  const { esprit } = await nouvelEsprit();
  // Ordre [r1, r1, r2] : zX --r1--> zY --r1--> zZ --r2--> zFINAL1.
  await apprendreFait(esprit, { sujet: 'zX', relation: 'zr1', valeur: 'zY' });
  await apprendreFait(esprit, { sujet: 'zY', relation: 'zr1', valeur: 'zZ' });
  await apprendreFait(esprit, { sujet: 'zZ', relation: 'zr2', valeur: 'zFINAL1' });
  // Ordre [r1, r2, r1] : zX --r1--> zY --r2--> zW --r1--> zFINAL2 (différent de zFINAL1).
  await apprendreFait(esprit, { sujet: 'zY', relation: 'zr2', valeur: 'zW' });
  await apprendreFait(esprit, { sujet: 'zW', relation: 'zr1', valeur: 'zFINAL2' });
  const r = repondre(esprit, 'zX zr1 zr1 zr2 ?');
  assert.notEqual(r.etat, 'compris', 'deux ordres aboutissent à des valeurs différentes : abstention, jamais un choix arbitraire');
});

test('cycle A --r1--> B --r1--> A : pas de boucle, résolution déterministe et terminée', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zCycA', relation: 'zr1', valeur: 'zCycB' });
  await apprendreFait(esprit, { sujet: 'zCycB', relation: 'zr1', valeur: 'zCycA' });
  const r = repondre(esprit, 'zCycA zr1 zr1 ?');
  assert.equal(r.etat, 'compris');
  assert.equal(r.compose, true);
  assert.equal(r.texte, 'zCycA', 'le chemin referme la boucle sur le sujet de départ, sans boucler indéfiniment');
});

test('relation à PLUSIEURS MOTS répétée deux fois', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zMA', relation: 'zr multi un', valeur: 'zMB' });
  await apprendreFait(esprit, { sujet: 'zMB', relation: 'zr multi un', valeur: 'zMC' });
  const r = repondre(esprit, 'zMA zr multi un zr multi un ?');
  assert.equal(r.texte, 'zMC');
  assert.equal(r.compose, true);
});

test('ordre des relations dans la phrase n\'a pas besoin de correspondre à l\'ordre d\'application réel (résolution par essai de tous les ordres, inchangé)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zW1', relation: 'zrA', valeur: 'zW2' });
  await apprendreFait(esprit, { sujet: 'zW2', relation: 'zrA', valeur: 'zW3' });
  await apprendreFait(esprit, { sujet: 'zW3', relation: 'zrB', valeur: 'zW4' });
  // La phrase nomme zrB AVANT les deux zrA, dans un ordre différent de l'ordre d'application réel.
  const r = repondre(esprit, 'zW1 zrB zrA zrA ?');
  assert.equal(r.texte, 'zW4');
  assert.equal(r.compose, true);
});

test('persistance : une base rechargée (nouvelle instance d\'esprit, même magasin) compose toujours correctement une relation répétée', async () => {
  const magasin = magasinMemoireVive();
  const esprit1 = await chargerEsprit(magasin);
  await apprendreFait(esprit1, { sujet: 'zP1', relation: 'zrP', valeur: 'zP2' });
  await apprendreFait(esprit1, { sujet: 'zP2', relation: 'zrP', valeur: 'zP3' });
  const esprit2 = await chargerEsprit(magasin);
  const r = repondre(esprit2, 'zP1 zrP zrP ?');
  assert.equal(r.texte, 'zP3');
  assert.equal(r.compose, true);
});

test('resoudreChemin() directement : un chemin de longueur 2 avec la MÊME relation répétée fonctionne sans aucun changement (déjà générique)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zA', relation: 'zr1', valeur: 'zB' });
  await apprendreFait(esprit, { sujet: 'zB', relation: 'zr1', valeur: 'zC' });
  assert.equal(resoudreChemin(esprit, 'zA', ['zr1', 'zr1']), 'zC');
});
// === FIN_TEST_RELATIONS_REPETEES ===
