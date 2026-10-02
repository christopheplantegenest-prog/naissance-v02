// === DEBUT_TEST_UNIFICATION_RELATIONS_V035 ===
// v0.35 — DÉCISION CHATGPT « CHANTIER v0.35.0 » : jusqu'ici, trouverRelation() (une SEULE relation,
// privilégie la plus LONGUE séquence trouvée n'importe où dans la phrase) et
// relationsNommeesDistinctes() (TOUTES les relations, balayées de GAUCHE À DROITE) étaient deux
// mécanismes INDÉPENDANTS. Quand une phrase nomme deux relations CONNUES de longueurs DIFFÉRENTES,
// trouverRelation() ne voyait AUCUNE ambiguïté (la plus longue l'emportait sans concurrence au sens de
// son propre calcul) et renvoyait un état COMPRIS directement -- court-circuitant tenterComposition(),
// qui n'est tenté QUE depuis la branche PARTIEL de repondre(). Résultat : une réponse locale confiante
// mais FAUSSE (la valeur intermédiaire), découverte par le diagnostic automatisé n°2 (axe 6, cas
// zdiag/zx/zy). Ce chantier établit un SEUL point de vérité (relationsPresentes(), comprendre.js) :
// trouverRelation() ET relationsNommeesDistinctes() en dérivent tous deux leur résultat, sans aucune
// nouvelle grammaire -- une ambiguïté réelle (plusieurs relations distinctes) ne produit plus jamais un
// état COMPRIS ; elle devient PARTIEL, avec relationsNommees renseigné, pour que la composition ait sa
// chance. Domaine ARTIFICIEL neutre, comme pour tous les chantiers de composition précédents.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comprendre } from '../app/langage/comprendre.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { chargerEsprit, apprendreFait, apprendreRelation, repondre, resoudreChemin } from '../app/langage/esprit.js';
import { LEXIQUE_DEPART } from '../app/langage/bagage.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

// -------------------------------------------------------------------------------------------
// LE CAS ROUGE DU DIAGNOSTIC N°2 (axe 6) — RELATIONS DE LONGUEURS DIFFÉRENTES
// -------------------------------------------------------------------------------------------

test('zdiag — BUG CONFIRMÉ : deux relations de longueurs DIFFÉRENTES ("rel multi un" 3 mots, "relsimple" 1 mot) doivent composer, jamais renvoyer la valeur intermédiaire', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zdiag1', relation: 'rel multi un', valeur: 'zdiag2' });
  await apprendreFait(esprit, { sujet: 'zdiag2', relation: 'relsimple', valeur: 'zdiag3' });
  const r = repondre(esprit, 'zdiag1 rel multi un relsimple ?');
  assert.equal(r.texte, 'zdiag3', 'la composition doit produire la valeur FINALE, pas "zdiag2" (valeur intermédiaire)');
  assert.equal(r.etat, 'compris');
  assert.equal(r.compose, true);
});

test('zdiag — même bug, relation 1 mot EN PREMIER puis relation multi-mots (ordre inverse)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zdy1', relation: 'relsimple', valeur: 'zdy2' });
  await apprendreFait(esprit, { sujet: 'zdy2', relation: 'rel multi un', valeur: 'zdy3' });
  const r = repondre(esprit, 'zdy1 relsimple rel multi un ?');
  assert.equal(r.texte, 'zdy3');
  assert.equal(r.compose, true);
});

// -------------------------------------------------------------------------------------------
// INVARIANT FIABILITÉ PRIORITAIRE
// -------------------------------------------------------------------------------------------

test('INVARIANT — un état COMPRIS ne doit jamais sortir d\'une phrase qui nomme réellement plusieurs relations distinctes non résolues', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zi1', relation: 'rel multi un', valeur: 'zi2' });
  await apprendreFait(esprit, { sujet: 'zi9', relation: 'relsimple', valeur: 'zi8' }); // sans lien avec zi1/zi2
  const c = comprendre('zi1 rel multi un relsimple ?', {
    lexique: esprit.lexique, sujetsConnus: esprit.sujetsConnus, relationsConnues: esprit.relationsConnues,
  });
  assert.notEqual(c.etat, 'compris', 'deux relations distinctes sont nommées : jamais un état COMPRIS direct');
  assert.deepEqual([...c.relationsNommees].sort(), ['rel multi un', 'relsimple']);
});

// -------------------------------------------------------------------------------------------
// TESTS MINIMUM EXPLICITEMENT DEMANDÉS — doivent rester/devenir VERTS
// -------------------------------------------------------------------------------------------

test('MIN 1 — une relation simple unique (1 mot)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zm1', relation: 'zrelA', valeur: 'zm2' });
  const r = repondre(esprit, 'zm1 zrelA ?');
  assert.equal(r.texte, 'zm2');
  assert.notEqual(r.compose, true);
});

test('MIN 2 — une relation multi-mots unique', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zm3', relation: 'peut avoir vraiment', valeur: 'zm4' });
  const r = repondre(esprit, 'zm3 peut avoir vraiment ?');
  assert.equal(r.texte, 'zm4');
  assert.notEqual(r.compose, true);
});

test('MIN 3 — deux relations d\'UN mot chacune (même longueur) composent', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zm5', relation: 'zrelB', valeur: 'zm6' });
  await apprendreFait(esprit, { sujet: 'zm6', relation: 'zrelC', valeur: 'zm7' });
  const r = repondre(esprit, 'zm5 zrelB zrelC ?');
  assert.equal(r.texte, 'zm7');
  assert.equal(r.compose, true);
});

test('MIN 4 — deux relations MULTI-MOTS de MÊME longueur composent (non-régression LOT 3)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zm8', relation: 'peut posseder', valeur: 'zm9' });
  await apprendreFait(esprit, { sujet: 'zm9', relation: 'peut produire', valeur: 'zm10' });
  const r = repondre(esprit, 'zm8 peut posseder peut produire ?');
  assert.equal(r.texte, 'zm10');
  assert.equal(r.compose, true);
});

test('MIN 5 — deux relations de longueurs DIFFÉRENTES composent (LE BUG zdiag, corrigé)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zm11', relation: 'rel multi un', valeur: 'zm12' });
  await apprendreFait(esprit, { sujet: 'zm12', relation: 'relsimple', valeur: 'zm13' });
  const r = repondre(esprit, 'zm11 rel multi un relsimple ?');
  assert.equal(r.texte, 'zm13');
  assert.equal(r.compose, true);
});

test('MIN 6a — mélange 1 mot puis plusieurs mots', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zm14', relation: 'zrelD', valeur: 'zm15' });
  await apprendreFait(esprit, { sujet: 'zm15', relation: 'peut vraiment avoir', valeur: 'zm16' });
  const r = repondre(esprit, 'zm14 zrelD peut vraiment avoir ?');
  assert.equal(r.texte, 'zm16');
  assert.equal(r.compose, true);
});

test('MIN 6b — mélange plusieurs mots puis 1 mot (ordre inverse)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zm17', relation: 'peut vraiment avoir', valeur: 'zm18' });
  await apprendreFait(esprit, { sujet: 'zm18', relation: 'zrelD', valeur: 'zm19' });
  const r = repondre(esprit, 'zm17 peut vraiment avoir zrelD ?');
  assert.equal(r.texte, 'zm19');
  assert.equal(r.compose, true);
});

test('MIN 7 — chaîne de 2 étapes', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zc1', relation: 'zrA', valeur: 'zc2' });
  await apprendreFait(esprit, { sujet: 'zc2', relation: 'zrB', valeur: 'zc3' });
  assert.equal(repondre(esprit, 'zc1 zrA zrB ?').texte, 'zc3');
});

test('MIN 7 — chaîne de 3 étapes', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zc1', relation: 'zrA', valeur: 'zc2' });
  await apprendreFait(esprit, { sujet: 'zc2', relation: 'zrB', valeur: 'zc3' });
  await apprendreFait(esprit, { sujet: 'zc3', relation: 'zrC', valeur: 'zc4' });
  assert.equal(repondre(esprit, 'zc1 zrA zrB zrC ?').texte, 'zc4');
});

test('MIN 7 — chaîne de 4 étapes', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zc1', relation: 'zrA', valeur: 'zc2' });
  await apprendreFait(esprit, { sujet: 'zc2', relation: 'zrB', valeur: 'zc3' });
  await apprendreFait(esprit, { sujet: 'zc3', relation: 'zrC', valeur: 'zc4' });
  await apprendreFait(esprit, { sujet: 'zc4', relation: 'zrD', valeur: 'zc5' });
  assert.equal(repondre(esprit, 'zc1 zrA zrB zrC zrD ?').texte, 'zc5');
});

test('MIN 7 — chaîne de 5 étapes (via resoudreChemin() directement : LIMITE_RELATIONS_COMPOSITION=4, pré-existante v0.33, borne le déclenchement AUTOMATIQUE par phrase à 4 relations nommées -- hors périmètre de ce chantier -- mais la primitive de résolution elle-même reste sans limite codée en dur, exactement comme vérifié par le diagnostic automatisé n°2, axe 6)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zc1', relation: 'zrA', valeur: 'zc2' });
  await apprendreFait(esprit, { sujet: 'zc2', relation: 'zrB', valeur: 'zc3' });
  await apprendreFait(esprit, { sujet: 'zc3', relation: 'zrC', valeur: 'zc4' });
  await apprendreFait(esprit, { sujet: 'zc4', relation: 'zrD', valeur: 'zc5' });
  await apprendreFait(esprit, { sujet: 'zc5', relation: 'zrE', valeur: 'zc6' });
  assert.equal(resoudreChemin(esprit, 'zc1', ['zrA', 'zrB', 'zrC', 'zrD', 'zrE']), 'zc6');
});

test('MIN 8 — plusieurs chemins convergeant vers LE MÊME résultat : réponse acceptée', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRelation(esprit, { mot: 'zrX', relation: 'zrX' });
  await apprendreRelation(esprit, { mot: 'zrY', relation: 'zrY' });
  await apprendreFait(esprit, { sujet: 'zp1', relation: 'zrX', valeur: 'zpA' });
  await apprendreFait(esprit, { sujet: 'zpA', relation: 'zrY', valeur: 'zfin' });
  await apprendreFait(esprit, { sujet: 'zp1', relation: 'zrY', valeur: 'zpB' });
  await apprendreFait(esprit, { sujet: 'zpB', relation: 'zrX', valeur: 'zfin' });
  const r = repondre(esprit, 'zp1 zrX zrY ?');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'zfin', 'les deux ordres convergent vers la même valeur : réponse acceptée');
});

test('MIN 9 — plusieurs chemins vers DES RÉSULTATS DIFFÉRENTS → abstention', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRelation(esprit, { mot: 'zrX', relation: 'zrX' });
  await apprendreRelation(esprit, { mot: 'zrY', relation: 'zrY' });
  await apprendreFait(esprit, { sujet: 'zq1', relation: 'zrX', valeur: 'zqA' });
  await apprendreFait(esprit, { sujet: 'zqA', relation: 'zrY', valeur: 'zfinA' });
  await apprendreFait(esprit, { sujet: 'zq1', relation: 'zrY', valeur: 'zqB' });
  await apprendreFait(esprit, { sujet: 'zqB', relation: 'zrX', valeur: 'zfinB' });
  const r = repondre(esprit, 'zq1 zrX zrY ?');
  assert.notEqual(r.etat, 'compris', 'résultats divergents : abstention, jamais un choix arbitraire');
});

test('MIN 10 — relation répétée deux fois dans la phrase : aucune fausse transitivité (une seule relation distincte)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRelation(esprit, { mot: 'zraime', relation: 'zraime' });
  await apprendreFait(esprit, { sujet: 'zr1', relation: 'zraime', valeur: 'zr2' });
  await apprendreFait(esprit, { sujet: 'zr2', relation: 'zraime', valeur: 'zr3' });
  const c = comprendre('Est-ce que zr1 zraime zr3 ?', {
    lexique: esprit.lexique, sujetsConnus: esprit.sujetsConnus, relationsConnues: esprit.relationsConnues,
  });
  assert.equal(c.relationsNommees.length, 1, 'une seule relation nommée, même répétée : jamais vue comme chemin à deux étapes');
  const r = repondre(esprit, 'Est-ce que zr1 zraime zr3 ?');
  assert.notEqual(r.texte, 'zr3', 'aucune transitivité implicite');
});

test('MIN 11 — collision avec un mot structurel (« est » de « Est-ce que ») : non-régression complète', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'pommier', relation: 'produire', valeur: 'des pommes' });
  await apprendreFait(esprit, { sujet: 'pomme', relation: 'est', valeur: 'un fruit' });
  const r = repondre(esprit, "Est-ce qu'un pommier peut produire un fruit ?");
  assert.equal(r.comprehension.relation, 'produire');
  assert.equal(r.etat, 'compris');
  assert.equal(r.texte, 'des pommes');
  // ET : le mot structurel reste une relation légitime quand rien ne lui fait concurrence.
  const { esprit: esprit2 } = await nouvelEsprit();
  await apprendreFait(esprit2, { sujet: 'pomme', relation: 'est', valeur: 'un fruit' });
  const r2 = repondre(esprit2, 'Une pomme est quoi ?');
  assert.equal(r2.texte, 'un fruit');
});

test('MIN 12 — relations CHEVAUCHANTES : résolution déterministe, sans invention de grammaire, aucun crash', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'zo1', relation: 'peut avoir', valeur: 'zo2' });
  await apprendreFait(esprit, { sujet: 'zo2', relation: 'avoir vraiment', valeur: 'zo3' });
  // "peut avoir vraiment" contient un chevauchement possible entre "peut avoir" et "avoir vraiment" :
  // le balayage gauche à droite, non chevauchant, doit rester déterministe (toujours le même résultat).
  const r1 = repondre(esprit, 'zo1 peut avoir vraiment ?');
  const r2 = repondre(esprit, 'zo1 peut avoir vraiment ?');
  assert.equal(r1.texte, r2.texte, 'déterministe : la même phrase donne toujours la même réponse');
});

test('MIN 13 — ordre d\'apprentissage sans effet sur le résultat', async () => {
  const { esprit: e1 } = await nouvelEsprit();
  await apprendreFait(e1, { sujet: 'zt1', relation: 'rel multi un', valeur: 'zt2' });
  await apprendreFait(e1, { sujet: 'zt2', relation: 'relsimple', valeur: 'zt3' });
  const r1 = repondre(e1, 'zt1 rel multi un relsimple ?');

  const { esprit: e2 } = await nouvelEsprit();
  await apprendreFait(e2, { sujet: 'zt2', relation: 'relsimple', valeur: 'zt3' });
  await apprendreFait(e2, { sujet: 'zt1', relation: 'rel multi un', valeur: 'zt2' });
  const r2 = repondre(e2, 'zt1 rel multi un relsimple ?');

  assert.equal(r1.texte, r2.texte);
  assert.equal(r1.texte, 'zt3');
});

test('MIN 14 — ordre des mots dans la question ne produit pas arbitrairement une réponse différente (symétrie position de la relation multi-mots)', async () => {
  const { esprit: e1 } = await nouvelEsprit();
  await apprendreFait(e1, { sujet: 'zu1', relation: 'rel multi un', valeur: 'zu2' });
  await apprendreFait(e1, { sujet: 'zu2', relation: 'relsimple', valeur: 'zu3' });
  const r1 = repondre(e1, 'zu1 rel multi un relsimple ?'); // multi-mots EN PREMIER

  const { esprit: e2 } = await nouvelEsprit();
  await apprendreFait(e2, { sujet: 'zv1', relation: 'relsimple', valeur: 'zv2' });
  await apprendreFait(e2, { sujet: 'zv2', relation: 'rel multi un', valeur: 'zv3' });
  const r2 = repondre(e2, 'zv1 relsimple rel multi un ?'); // multi-mots EN DERNIER

  assert.equal(r1.texte, 'zu3');
  assert.equal(r2.texte, 'zv3');
});
// === FIN_TEST_UNIFICATION_RELATIONS_V035 ===
