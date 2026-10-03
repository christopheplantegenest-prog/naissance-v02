// Chantier « IDENTIFIANTS UNIQUES » (décision ChatGPT du 03/10/2026, suite au diagnostic du même
// jour "DIAGNOSTIC GÉNÉRAL DES IDENTIFIANTS") -- plusieurs générateurs d'id persistants
// (transformations, actions, liaisons, règles, gabaritsTypes, patrons) combinaient Date.now() et
// Math.random() SANS compteur de séquence protecteur : une collision réelle (même milliseconde,
// même tirage aléatoire) écrase silencieusement un objet déjà persisté, soit immédiatement (le
// magasin et son miroir vivant utilisent l'id comme clé d'index direct : transformations), soit au
// prochain rechargement (regle/gabaritType/patron : le miroir vivant pousse sans jamais remplacer,
// mais le magasin, lui, est une Map clé=id et perd l'entrée écrasée).
//
// Ces tests ne vérifient JAMAIS le format textuel d'un id (ce serait un faux test, dépendant d'un
// détail d'implémentation) : ils vérifient la PROPRIÉTÉ RÉELLE recherchée -- deux créations
// distinctes, forcées à la même milliseconde et au même tirage aléatoire, restent deux objets
// distincts et persistants (dans le magasin, et après un rechargement réel quand c'est le seul
// moyen de révéler la perte).
//
// Méthode commune : on fige Date.now()/Math.random() UNIQUEMENT pendant les deux créations, avec
// le VRAI chemin de code (apprendreTransformation/apprendreAction/apprendreLiaison/apprendreRegle/
// apprendreGabaritType/apprendrePatronDirect), sur des objets SANS AUCUN RAPPORT (donc jamais
// fusionnés par le dédoublonnage par contenu propre à chaque fonction), puis on restaure les
// horloges réelles avant d'observer le résultat.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  magasinMemoireVive, apprendreTransformation, apprendreAction, apprendreLiaison,
} from '../app/langage/connaissances.js';
import { monterEcranLangage } from '../app/langage/ecran.js';
import { chargerEsprit, apprendreRegle, apprendreGabaritType, apprendrePatronDirect } from '../app/langage/esprit.js';

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});

function monterEcran(magasin = magasinMemoireVive()) {
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  return { magasin, ecran };
}

async function geler(valeurDate, valeurRandom, fn) {
  const vraiDateNow = Date.now.bind(Date);
  const vraiRandom = Math.random.bind(Math);
  Date.now = () => valeurDate;
  Math.random = () => valeurRandom;
  try { return await fn(); } finally { Date.now = vraiDateNow; Math.random = vraiRandom; }
}

// ============================================================================ 1. TRANSFORMATIONS
test('identifiants-uniques. 1. deux transformations sans rapport, id forcé identique, restent deux connaissances distinctes', async () => {
  const { magasin } = monterEcran();
  await geler(1700000000001, 0.111, async () => {
    await apprendreTransformation(magasin, {
      n: 2, insertions: [null, 'ZDIS', 'ZFIN'], garder: [true, true], interne: [null, null], certaine: true,
      intention: 'ZIDA', exemples: [{ entree: 'ZDIS un ZFIN', sortie: 'un' }, { entree: 'ZDIS deux ZFIN', sortie: 'deux' }],
    });
    await apprendreTransformation(magasin, {
      n: 1, insertions: [null, 'ZVITE'], garder: [true], interne: [null], certaine: true,
      intention: 'ZIDA', exemples: [{ entree: 'ZVITE un', sortie: 'un' }, { entree: 'ZVITE deux', sortie: 'deux' }],
    });
  });
  const toutes = await magasin.lireTout('transformations');
  assert.equal(toutes.length, 2, 'les deux transformations sans rapport doivent coexister, aucune ne doit écraser l\'autre');
  const ids = new Set(toutes.map((t) => t.id));
  assert.equal(ids.size, 2, 'les deux transformations doivent avoir des ids réellement distincts');
});

// ============================================================================ 2. ACTIONS
test('identifiants-uniques. 2. deux actions sans rapport, id forcé identique, restent deux connaissances distinctes', async () => {
  const { magasin } = monterEcran();
  const roles1 = [{ position: 1, nom: 'sujetA' }, { position: 2, nom: 'operateur' }, { position: 3, nom: 'sujetB' }];
  const exemples1 = [{ entree: 'alpha zordreidb beta' }, { entree: 'gamma zordreidb delta' }];
  const roles2 = [{ position: 1, nom: 'operateur' }, { position: 2, nom: 'sujetA' }];
  const exemples2 = [{ entree: 'zautreidb un' }, { entree: 'zautreidb deux' }];
  await geler(1700000000002, 0.222, async () => {
    await apprendreAction(magasin, { operation: 'confrontation', roles: roles1, n: 3, exemples: exemples1, statut: 'validee' });
    await apprendreAction(magasin, { operation: 'recherche', roles: roles2, n: 2, exemples: exemples2, statut: 'validee' });
  });
  const toutes = await magasin.lireTout('actions');
  assert.equal(toutes.length, 2, 'les deux actions sans rapport doivent coexister');
  const ids = new Set(toutes.map((a) => a.id));
  assert.equal(ids.size, 2, 'les deux actions doivent avoir des ids réellement distincts');
  assert.ok(toutes.some((a) => a.operation === 'confrontation'), 'l\'action confrontation ne doit pas avoir disparu');
  assert.ok(toutes.some((a) => a.operation === 'recherche'), 'l\'action recherche ne doit pas avoir disparu');
});

// ============================================================================ 3. LIAISONS
test('identifiants-uniques. 3. deux liaisons sans rapport, id forcé identique, restent deux connaissances distinctes', async () => {
  const { magasin } = monterEcran();
  await geler(1700000000003, 0.333, async () => {
    await apprendreLiaison(magasin, { capaciteSource: 'confrontation', champ: 'resultat', capaciteCible: 'recherche', role: 'sujetA' });
    await apprendreLiaison(magasin, { capaciteSource: 'deduction', champ: 'autreChamp', capaciteCible: 'accessibilite', role: 'operateur' });
  });
  const toutes = await magasin.lireTout('liaisons');
  assert.equal(toutes.length, 2, 'les deux liaisons sans rapport doivent coexister');
  const ids = new Set(toutes.map((l) => l.id));
  assert.equal(ids.size, 2, 'les deux liaisons doivent avoir des ids réellement distincts');
  assert.ok(toutes.some((l) => l.capaciteSource === 'confrontation'), 'la liaison confrontation->recherche ne doit pas avoir disparu');
  assert.ok(toutes.some((l) => l.capaciteSource === 'deduction'), 'la liaison deduction->accessibilite ne doit pas avoir disparu');
});

// ============================================================================ 4. RÈGLES
test('identifiants-uniques. 4. deux règles sans rapport (même rôle, conditions différentes), id forcé identique, survivent à un rechargement réel', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await geler(1700000000004, 0.444, async () => {
    await apprendreRegle(esprit, { role: 'zrolecommunidb', conditions: [{ propriete: 'zcouleuridb', valeur: 'zbleuidb' }], resultat: 'zresultat1idb' });
    await apprendreRegle(esprit, { role: 'zrolecommunidb', conditions: [{ propriete: 'zformeidb', valeur: 'zrondeidb' }], resultat: 'zresultat2idb' });
  });
  // La session en cours (esprit.regles, alimenté par push()) peut masquer la perte : la vraie
  // preuve est un RECHARGEMENT RÉEL depuis le même magasin, qui ne lit que ce que le magasin a
  // effectivement conservé.
  const espritRecharge = await chargerEsprit(magasin);
  const pertinentes = espritRecharge.regles.filter((r) => r.role === 'zrolecommunidb' && r.statut === 'validee');
  assert.equal(pertinentes.length, 2, 'les deux règles sans rapport doivent toutes deux survivre à un rechargement réel du magasin');
  const ids = new Set(pertinentes.map((r) => r.id));
  assert.equal(ids.size, 2, 'les deux règles doivent avoir des ids réellement distincts');
});

// ============================================================================ 5. GABARITS TYPES
test('identifiants-uniques. 5. deux gabaritsTypes sans rapport, id forcé identique, survivent à un rechargement réel', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await geler(1700000000005, 0.555, async () => {
    await apprendreGabaritType(esprit, { candidats: ['mot:zidb1'], gabarits: [[{ mot: 'zidb1' }]], signification: 'TYPE_IDB_UN', exemples: [] });
    await apprendreGabaritType(esprit, { candidats: ['mot:zidb2'], gabarits: [[{ mot: 'zidb2' }]], signification: 'TYPE_IDB_DEUX', exemples: [] });
  });
  const espritRecharge = await chargerEsprit(magasin);
  const pertinents = espritRecharge.gabaritsTypesAppris.filter((g) => g.statut === 'validee'
    && (g.signification === 'TYPE_IDB_UN' || g.signification === 'TYPE_IDB_DEUX'));
  assert.equal(pertinents.length, 2, 'les deux gabaritsTypes sans rapport doivent tous deux survivre à un rechargement réel du magasin');
  const ids = new Set(pertinents.map((g) => g.id));
  assert.equal(ids.size, 2, 'les deux gabaritsTypes doivent avoir des ids réellement distincts');
});

// ============================================================================ 6. PATRONS
test('identifiants-uniques. 6. deux patrons sans rapport, id forcé identique, survivent à un rechargement réel', async () => {
  const magasin = magasinMemoireVive();
  const esprit = await chargerEsprit(magasin);
  await geler(1700000000006, 0.666, async () => {
    // MÊME relation (le préfixe littéral de l'id de patron), sujet/gabarit DIFFÉRENTS : comme pour
    // "regle", deux relations différentes ne pourraient jamais collisionner par construction (le
    // préfixe suffit à les distinguer) -- le cas réellement à risque est la MÊME relation, deux
    // façons de dire différentes, non fusionnées par le dédoublonnage par contenu (sujet/gabarit).
    await apprendrePatronDirect(esprit, { relation: 'zrelidbcommune', sujet: 'zsujetidb1', gabarit: 'Ceci {valeur} premier.' });
    await apprendrePatronDirect(esprit, { relation: 'zrelidbcommune', sujet: 'zsujetidb2', gabarit: 'Cela {valeur} second.' });
  });
  const espritRecharge = await chargerEsprit(magasin);
  const pertinents = espritRecharge.patrons.filter((p) => p.relation === 'zrelidbcommune');
  assert.equal(pertinents.length, 2, 'les deux patrons sans rapport doivent tous deux survivre à un rechargement réel du magasin');
  const ids = new Set(pertinents.map((p) => p.id));
  assert.equal(ids.size, 2, 'les deux patrons doivent avoir des ids réellement distincts');
});
