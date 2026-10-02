// === DEBUT_TEST_REGLES_MULTI_CONDITIONS ===
// v0.45 — DÉCISION CHATGPT « ENSEIGNEMENT DE RÈGLES À PLUSIEURS CONDITIONS » (02/10).
//
// Le diagnostic global avait montré que appliquerRegles() (regles.js) sait déjà évaluer N
// conditions (conditions.every(...)), et que apprendreRegle() (esprit.js) sait déjà PERSISTER un
// tableau de conditions de longueur quelconque — AUCUN des deux n'est modifié par ce chantier. Le
// seul obstacle réel était la couche d'ENSEIGNEMENT (lecon.js) : son gabarit ne produisait jamais
// qu'UNE SEULE condition (conditions[0]), quelle que soit la complexité réellement exécutable par
// le moteur.
//
// CE QUI CHANGE : GABARIT_REGLE (lecon.js) accepte désormais un BLOC de conditions séparées par
// « et », chaque clause gardant EXACTEMENT la même forme qu'avant (« <propriété> vaut <valeur> »).
// Une seule clause (sans « et ») continue de fonctionner EXACTEMENT comme avant — pas une branche de
// code séparée, le même découpage produit un tableau à un seul élément. AUCUNE logique « ET »
// spéciale : « et » n'est qu'un SÉPARATEUR générique entre des clauses de forme identique, du même
// principe que « / » dans « Fait : <sujet> / <relation> / <valeur>. » — jamais une opération
// booléenne câblée en dur. La SÉMANTIQUE « toutes les conditions doivent être vraies » reste
// entièrement celle, inchangée, de appliquerRegles() (conditions.every(...)) : ce fichier ne fait
// que lui fournir un tableau plus long, jamais une nouvelle façon de les combiner.
//
// Domaine ARTIFICIEL neutre, DIFFÉRENT à chaque famille de test (zcouleur/zbleu, zforme/zronde,
// zpoids/zlourd...) pour démontrer que rien n'est câblé sur un nom de propriété particulier (point 6
// de la méthode demandée).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chargerEsprit, apprendreFait, apprendreRegle,
} from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { deduire } from '../app/langage/deduction.js';
import { extraireLecon, apercuLecon, reconstruireLeconRegle } from '../app/langage/lecon.js';
import { monterEcranLangage } from '../app/langage/ecran.js';

async function nouvelEsprit() {
  const magasin = magasinMemoireVive();
  return { magasin, esprit: await chargerEsprit(magasin) };
}

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
function monterEcran(magasin = magasinMemoireVive()) {
  return { magasin, ecran: monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true }) };
}

// ---------------------------------------------------------------------------------------------
// 1. LA FRONTIÈRE ACTUELLE, précisément démontrée (étape 2 de la méthode)
// ---------------------------------------------------------------------------------------------
test('FRONTIÈRE — une condition : extraireLecon() fonctionne déjà, sans changement de comportement', () => {
  assert.deepEqual(
    extraireLecon('Pour zrole1 : si zcouleur vaut zbleu, on dit zresultat1.'),
    { type: 'regle', donnees: { role: 'zrole1', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zresultat1' } },
  );
});

test('FRONTIÈRE — deux conditions : le moteur (appliquerRegles) sait déjà les exécuter si on les injecte directement', async () => {
  const { esprit } = await nouvelEsprit();
  await apprendreRegle(esprit, {
    role: 'zrole2',
    conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }, { propriete: 'zforme', valeur: 'zronde' }],
    resultat: 'zresultat2',
  });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zforme', valeur: 'zronde' });
  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole2' });
  assert.equal(r.resultat, 'zresultat2', 'le moteur exécute déjà deux conditions quand elles lui sont fournies directement');
});

// ---------------------------------------------------------------------------------------------
// 2. EXTRACTION — 1, 2, 3 conditions, et généralité (propriétés différentes à chaque fois)
// ---------------------------------------------------------------------------------------------
test('extraireLecon : deux conditions, séparées par « et », produisent un tableau de deux éléments', () => {
  assert.deepEqual(
    extraireLecon('Pour zrole2 : si zcouleur vaut zbleu et zforme vaut zronde, on dit zresultat2.'),
    {
      type: 'regle',
      donnees: {
        role: 'zrole2',
        conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }, { propriete: 'zforme', valeur: 'zronde' }],
        resultat: 'zresultat2',
      },
    },
  );
});

test('extraireLecon : trois conditions, aucune limite codée en dur', () => {
  assert.deepEqual(
    extraireLecon('Pour zrole3 : si zcouleur vaut zbleu et zforme vaut zronde et zpoids vaut zlourd, on dit zresultat3.'),
    {
      type: 'regle',
      donnees: {
        role: 'zrole3',
        conditions: [
          { propriete: 'zcouleur', valeur: 'zbleu' },
          { propriete: 'zforme', valeur: 'zronde' },
          { propriete: 'zpoids', valeur: 'zlourd' },
        ],
        resultat: 'zresultat3',
      },
    },
  );
});

test('extraireLecon : une clause mal formée au milieu du bloc → abstention complète, jamais une règle partielle devinée', () => {
  assert.equal(
    extraireLecon('Pour zrole2 : si zcouleur vaut zbleu et zforme sans le mot vaut, on dit zresultat2.'),
    null,
  );
});

// ---------------------------------------------------------------------------------------------
// 3. APERÇU ET RECONSTRUCTION — toutes les conditions affichées, pas seulement la première
// ---------------------------------------------------------------------------------------------
test('apercuLecon : une règle à deux conditions liste les DEUX conditions dans l\'aperçu', () => {
  const extrait = extraireLecon('Pour zrole2 : si zcouleur vaut zbleu et zforme vaut zronde, on dit zresultat2.');
  const aperçu = apercuLecon(extrait);
  assert.match(aperçu, /zcouleur/);
  assert.match(aperçu, /zbleu/);
  assert.match(aperçu, /zforme/);
  assert.match(aperçu, /zronde/);
  assert.match(aperçu, /zresultat2/);
});

test('reconstruireLeconRegle : une condition → chaîne IDENTIQUE à avant ce chantier (compatibilité stricte)', () => {
  const regle = { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'féminin' }], resultat: 'ta' };
  assert.equal(reconstruireLeconRegle(regle), 'Pour possessif_toi : si genre vaut féminin, on dit ta.');
});

test('reconstruireLeconRegle : plusieurs conditions → aller-retour fidèle avec extraireLecon()', () => {
  const regle = {
    role: 'zrole2',
    conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }, { propriete: 'zforme', valeur: 'zronde' }],
    resultat: 'zresultat2',
  };
  const phrase = reconstruireLeconRegle(regle);
  const extrait = extraireLecon(phrase);
  assert.deepEqual(extrait, { type: 'regle', donnees: regle });
});

// ---------------------------------------------------------------------------------------------
// 4. COMPORTEMENT DU MOTEUR PRÉSERVÉ — abstention, contradiction, spécificité, conflit
// ---------------------------------------------------------------------------------------------
async function enseigner(esprit, phrase) {
  const extrait = extraireLecon(phrase);
  return apprendreRegle(esprit, { ...extrait.donnees, origine: 'apprise-lecon', exemple: phrase });
}

test('deux conditions enseignées, une seule satisfaite → abstention, jamais un résultat deviné', async () => {
  const { esprit } = await nouvelEsprit();
  await enseigner(esprit, 'Pour zrole2 : si zcouleur vaut zbleu et zforme vaut zronde, on dit zresultat2.');
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  // zforme n'est jamais renseignée pour zorbo.
  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole2' });
  assert.equal(r.resultat, null);
});

test('deux conditions enseignées, une valeur contradictoire → abstention', async () => {
  const { esprit } = await nouvelEsprit();
  await enseigner(esprit, 'Pour zrole2 : si zcouleur vaut zbleu et zforme vaut zronde, on dit zresultat2.');
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zforme', valeur: 'zcarree' }); // contredit zronde
  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole2' });
  assert.equal(r.resultat, null);
});

test('deux conditions enseignées, les deux faits satisfaits → la règle se déclenche', async () => {
  const { esprit } = await nouvelEsprit();
  await enseigner(esprit, 'Pour zrole2 : si zcouleur vaut zbleu et zforme vaut zronde, on dit zresultat2.');
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zforme', valeur: 'zronde' });
  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole2' });
  assert.equal(r.resultat, 'zresultat2');
});

test('trois conditions enseignées, les trois faits satisfaits → la règle se déclenche', async () => {
  const { esprit } = await nouvelEsprit();
  await enseigner(esprit, 'Pour zrole3 : si zcouleur vaut zbleu et zforme vaut zronde et zpoids vaut zlourd, on dit zresultat3.');
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zforme', valeur: 'zronde' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zpoids', valeur: 'zlourd' });
  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole3' });
  assert.equal(r.resultat, 'zresultat3');
});

test('règle plus spécifique (deux conditions, enseignée via la phrase) préférée à une règle plus générale (une condition)', async () => {
  const { esprit } = await nouvelEsprit();
  await enseigner(esprit, 'Pour zrole4 : si zcouleur vaut zbleu, on dit zgeneral.');
  await enseigner(esprit, 'Pour zrole4 : si zcouleur vaut zbleu et zforme vaut zronde, on dit zspecifique.');
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zforme', valeur: 'zronde' });
  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole4' });
  assert.equal(r.resultat, 'zspecifique', 'le comportement de plusSpecifiques()/regles.js reste inchangé');
});

test('conflit entre deux règles également spécifiques (deux conditions chacune, enseignées via la phrase) → abstention explicite', async () => {
  const { esprit } = await nouvelEsprit();
  await enseigner(esprit, 'Pour zrole5 : si zcouleur vaut zbleu et zforme vaut zronde, on dit zresultatA.');
  await enseigner(esprit, 'Pour zrole5 : si zpoids vaut zlourd et zmatiere vaut zbois, on dit zresultatB.');
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zforme', valeur: 'zronde' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zpoids', valeur: 'zlourd' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zmatiere', valeur: 'zbois' });
  const r = deduire(esprit, { sujet: 'zorbo', role: 'zrole5' });
  assert.equal(r.resultat, null);
  assert.equal(r.conflit, true);
});

// ---------------------------------------------------------------------------------------------
// 5. PERSISTANCE / RECHARGEMENT
// ---------------------------------------------------------------------------------------------
test('persistance : une règle à trois conditions, enseignée via la phrase, survit à un rechargement complet de l\'esprit', async () => {
  const { magasin, esprit } = await nouvelEsprit();
  await enseigner(esprit, 'Pour zrole3 : si zcouleur vaut zbleu et zforme vaut zronde et zpoids vaut zlourd, on dit zresultat3.');
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zforme', valeur: 'zronde' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zpoids', valeur: 'zlourd' });

  const espritRecharge = await chargerEsprit(magasin);
  const regleRechargee = espritRecharge.regles.find((r) => r.statut === 'validee' && r.role === 'zrole3');
  assert.equal(regleRechargee.conditions.length, 3, 'les trois conditions sont bien persistées, pas seulement la première');
  const r = deduire(espritRecharge, { sujet: 'zorbo', role: 'zrole3' });
  assert.equal(r.resultat, 'zresultat3');
});

// ---------------------------------------------------------------------------------------------
// 6. RACCORD BOUT-EN-BOUT RÉEL (étape 7 de la méthode) — canal pédagogique réel (ecrireConnaissance,
// la même fonction que celle appelée après confirmation dans l'écran réel), puis « deduction »
// (capacité déjà existante du registre) pour prouver l'exploitation RÉELLE de la règle, sans
// injection directe en mémoire.
// ---------------------------------------------------------------------------------------------
test('RACCORD — règle à deux conditions enseignée via le canal pédagogique réel (ecrireConnaissance), puis exploitée par "deduction"', async () => {
  const { ecran } = monterEcran();
  const esprit = await ecran.assurerEsprit();

  const phrase = 'Pour zroleRaccord : si zcouleur vaut zbleu et zforme vaut zronde, on dit zresultatRaccord.';
  const extrait = extraireLecon(phrase);
  assert.ok(extrait, 'la phrase à deux conditions doit être reconnue par le canal pédagogique réel');
  const r = await ecran.ecrireConnaissance(esprit, extrait, { origine: 'apprise-christophe', exemple: phrase });
  assert.match(r.explication, /appris|retenu/i);

  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(esprit, { sujet: 'zorbo', relation: 'zforme', valeur: 'zronde' });

  // "deduction" est la capacité DÉJÀ existante du registre fermé (v0.42) — invoquée ici sans
  // aucune injection directe de la règle en mémoire : seule ecrireConnaissance() l'a posée.
  const d = await ecran.invoquerComposition({ operation: 'deduction', argumentsExplicites: { sujet: 'zorbo', role: 'zroleRaccord' } });
  assert.equal(d.ok, true);
  assert.match(d.texte, /zresultatRaccord/);
});
// === FIN_TEST_REGLES_MULTI_CONDITIONS ===
