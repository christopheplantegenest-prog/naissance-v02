// === DEBUT_TEST_INTEGRITE_LEXIQUE ===
// v0.34 — LOT 1, DÉCISION CHATGPT « CHANTIER v0.34.0 » : un mot déjà connu peut porter un rôle
// STRUCTUREL (POSSESSIF_MOI/TOI, PRONOM_MOI/TOI, VERBE_CONJUGUE, PRONOM_3E — voir ROLES_JAMAIS_RELATION,
// comprendre.js) avant même qu'on lui enseigne une information nouvelle (apprendreMot/apprendreRelation).
// Avant ce chantier, apprendre une nouvelle information pour un mot ÉCRASAIT entièrement son entrée
// lexicale, faisant disparaître silencieusement son rôle structurel — reproduisant EXACTEMENT la
// collision « est »/« Est-ce que » que v0.33 avait corrigée (diagnostic automatisé post-v0.33, famille 4).
// Architecture retenue : CUMULATIVE, pas une liste de mots interdits — tout mot dont le rôle ACTUEL est
// structurel voit ce rôle CONSERVÉ (rolesConserves) quand il reçoit une information nouvelle ; le
// nouveau rôle devient le rôle ACTIF (relation/verbe), mais les rôles structurels hérités restent
// consultés PARTOUT où ils comptaient déjà (trouverSujet, estMotStructurelNonRelationnel,
// groupePertinent/trouverType pour INTERROGATIF, correspondContrainte pour les gabarits de vérification,
// fabriquerGabarit pour {possessif}).
import test from 'node:test';
import assert from 'node:assert/strict';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { chargerEsprit, apprendreFait, apprendreMot, apprendreRelation, repondre } from '../app/langage/esprit.js';
import { ROLES } from '../app/langage/bagage.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

test('LOT 1 — apprentissage d\'un mot NOUVEAU (sans rôle préexistant) : comportement inchangé', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRelation(esprit, { mot: 'zmotnouveau', relation: 'zinfo' });
  assert.equal(esprit.lexique.zmotnouveau.role, ROLES.RELATION);
  assert.equal(esprit.lexique.zmotnouveau.relation, 'zinfo');
  assert.equal(esprit.lexique.zmotnouveau.rolesConserves, undefined, 'aucun rôle structurel à conserver pour un mot tout neuf');
});

test('LOT 1 — enrichir un mot existant AU RÔLE STRUCTUREL conserve ce rôle (« est » reste aussi VERBE_CONJUGUE)', async () => {
  const { esprit } = await nouvelEsprit();
  assert.equal(esprit.lexique.est.role, ROLES.VERBE_CONJUGUE, 'précondition : "est" est bien structurel au départ');
  await apprendreRelation(esprit, { mot: 'est', relation: 'zrelsansrapport' });
  assert.equal(esprit.lexique.est.role, ROLES.RELATION, 'le nouveau rôle appris devient le rôle actif');
  assert.equal(esprit.lexique.est.relation, 'zrelsansrapport');
  assert.ok(Array.isArray(esprit.lexique.est.rolesConserves) && esprit.lexique.est.rolesConserves.includes(ROLES.VERBE_CONJUGUE),
    'le rôle structurel VERBE_CONJUGUE doit être conservé, pas perdu');
});

test('LOT 1 — NON-RÉGRESSION : réapprendre "est" comme relation ne réintroduit PAS la collision "Est-ce que" (diagnostic post-v0.33, famille 4)', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'pommier', relation: 'produire', valeur: 'des pommes' });
  await apprendreFait(esprit, { sujet: 'pomme', relation: 'est', valeur: 'un fruit' });
  // Christophe enseigne ensuite un mot totalement sans rapport, qui coïncide par hasard avec "est".
  await apprendreRelation(esprit, { mot: 'est', relation: 'zrelsansrapport' });
  const r = repondre(esprit, 'Est-ce qu un pommier peut produire un fruit ?');
  assert.equal(r.comprehension.relation, 'produire', 'la relation "produire" doit toujours être retenue, "est" structurel toujours écarté de la collision');
  assert.equal(r.texte, 'des pommes');
});

test('LOT 1 — le NOUVEAU rôle appris pour "est" continue de fonctionner normalement pour sa propre relation', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRelation(esprit, { mot: 'est', relation: 'zrelforcee' });
  await apprendreFait(esprit, { sujet: 'zalpha', relation: 'zrelforcee', valeur: 'zvaleur' });
  const r = repondre(esprit, 'zalpha est ?');
  assert.equal(r.texte, 'zvaleur');
});

test('LOT 1 — persistance correcte : rolesConserves survit à un rechargement complet de l\'esprit', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await apprendreRelation(esprit, { mot: 'est', relation: 'zrelsansrapport' });
  const espritRecharge = await chargerEsprit(magasin);
  assert.ok(Array.isArray(espritRecharge.lexique.est.rolesConserves) && espritRecharge.lexique.est.rolesConserves.includes(ROLES.VERBE_CONJUGUE),
    'après un rechargement depuis le magasin, le rôle structurel conservé doit toujours être là');
  const r = repondre(espritRecharge, 'Est-ce que zalpha a une zrelsansrapport ?'.toLowerCase());
  // pas d'assertion de contenu ici : on vérifie seulement l'absence de crash et la cohérence du rôle actif
  assert.equal(espritRecharge.lexique.est.role, ROLES.RELATION);
});

test('LOT 1 — apprentissages précédents INCHANGÉS : enrichir "est" ne modifie ni un autre mot ni un fait déjà appris', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreFait(esprit, { sujet: 'naissance', relation: 'couleur', valeur: 'bleu' });
  const avant = { ...esprit.lexique.peut }; // un autre mot structurel (VERBE_CONJUGUE), non touché par ce chantier
  await apprendreRelation(esprit, { mot: 'est', relation: 'zrelsansrapport' });
  assert.deepEqual(esprit.lexique.peut, avant, '"peut" ne doit pas être affecté par l\'enrichissement de "est"');
  const r = repondre(esprit, 'Quelle est ta couleur ?');
  assert.equal(r.texte, 'bleu', 'le fait appris avant ce chantier doit toujours être retrouvé normalement');
});

test('LOT 1 — apprendreMot (synonyme) hérite aussi la conservation des rôles structurels du mot qu\'il écrase', async () => {
  const { esprit } = await nouvelEsprit();
  // "peut" est VERBE_CONJUGUE de départ ; lui enseigner un synonyme de "fils" (improbable mais légitime
  // du point de vue du canal pédagogique) doit préserver son rôle structurel exactement comme apprendreRelation.
  await apprendreMot(esprit, { motNouveau: 'peut', motConnu: 'fils' });
  assert.equal(esprit.lexique.peut.role, ROLES.RELATION);
  assert.ok(Array.isArray(esprit.lexique.peut.rolesConserves) && esprit.lexique.peut.rolesConserves.includes(ROLES.VERBE_CONJUGUE));
});
// === FIN_TEST_INTEGRITE_LEXIQUE ===
