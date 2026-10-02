// === DEBUT_TEST_RAPPORT_DESCRIPTIF_STRUCTURE ===
// v0.48 — DÉCISION CHATGPT « RAPPORT DESCRIPTIF DE STRUCTURE » (03/10/2026), suite directe du
// diagnostic « IDENTIFIABILITÉ DES STRUCTURES DE CONTEXTE » : une hypothèse de structure n'est pas
// une classe d'intentions, elle affirme seulement « cette forme de surface récurrente a été
// observée, avec ces preuves positives et cette diversité ». decrireStructure() (extraction.js)
// réutilise STRICTEMENT construireSquelette()/calculerAncres() déjà testés ailleurs
// (tests/extraction.test.mjs) : ce fichier ne reteste donc PAS leur comportement de base, seulement
// ce que decrireStructure() ajoute par-dessus — occurrences, exemplesDistincts, diversite.
// AUCUN score, AUCUN pourcentage de confiance, AUCUN statut vrai/faux : vérifié explicitement
// par l'absence de ces champs dans la forme attendue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { decrireStructure } from '../app/langage/extraction.js';

// ---------------------------------------------------------------------------------------------
// CAS A — structure diverse (brief ChatGPT, section 6)
// ---------------------------------------------------------------------------------------------
test('CAS A. structure diverse : occurrences=3, distincts=3, ancre position 0, diversité réelle', () => {
  const r = decrireStructure(['zcompare a b couleur', 'zcompare c d taille', 'zcompare e f forme']);
  assert.equal(r.ok, true);
  assert.equal(r.occurrences, 3);
  assert.equal(r.exemplesDistincts, 3);
  assert.equal(r.n, 4);
  assert.deepEqual(r.ancres, [{ position: 0, jeton: 'zcompare' }]);
  assert.deepEqual(r.positionsVariables, [1, 2, 3]);
  assert.deepEqual(r.diversite[1], { valeursDistinctes: ['a', 'c', 'e'], nombre: 3 });
  assert.deepEqual(r.diversite[2], { valeursDistinctes: ['b', 'd', 'f'], nombre: 3 });
  assert.deepEqual(r.diversite[3], { valeursDistinctes: ['couleur', 'taille', 'forme'], nombre: 3 });
});

// ---------------------------------------------------------------------------------------------
// CAS B — répétition identique (brief ChatGPT, section 6) : occurrences ≠ exemplesDistincts
// ---------------------------------------------------------------------------------------------
test('CAS B. 10 répétitions exactes de la même phrase : occurrences=10, distincts=1, aucune fausse diversité', () => {
  const dix = Array.from({ length: 10 }, () => 'zcompare a b couleur');
  const r = decrireStructure(dix);
  assert.equal(r.ok, true);
  assert.equal(r.occurrences, 10, 'la fréquence brute doit rester visible, répétitions comprises');
  assert.equal(r.exemplesDistincts, 1, 'un seul contenu réellement distinct');
  // Une répétition identique rend TOUTES les positions ancrées (comportement connu et documenté de
  // calculerAncres() lui-même, pas une invention de decrireStructure()) : aucune position variable,
  // donc aucune entrée dans `diversite` -- ce qui est exactement la bonne réponse ("aucune variation
  // n'a réellement été observée"), jamais masquée par un score.
  assert.deepEqual(r.ancres, [
    { position: 0, jeton: 'zcompare' }, { position: 1, jeton: 'a' },
    { position: 2, jeton: 'b' }, { position: 3, jeton: 'couleur' },
  ]);
  assert.deepEqual(r.positionsVariables, []);
  assert.deepEqual(r.diversite, {});
});

test('CAS B bis. répétitions + UN exemple réellement différent : la diversité redevient visible, occurrences le reflète', () => {
  const pool = [...Array.from({ length: 9 }, () => 'zcompare a b couleur'), 'zcompare x y forme'];
  const r = decrireStructure(pool);
  assert.equal(r.occurrences, 10);
  assert.equal(r.exemplesDistincts, 2);
  assert.deepEqual(r.ancres, [{ position: 0, jeton: 'zcompare' }]);
  assert.deepEqual(r.positionsVariables, [1, 2, 3]);
  assert.deepEqual(r.diversite[1], { valeursDistinctes: ['a', 'x'], nombre: 2 });
  assert.deepEqual(r.diversite[3], { valeursDistinctes: ['couleur', 'forme'], nombre: 2 });
});

// ---------------------------------------------------------------------------------------------
// CAS C — chevauchement : un motif large et un motif plus spécifique, DEUX rapports qui coexistent
// ---------------------------------------------------------------------------------------------
test('CAS C. un groupe large et un sous-groupe plus spécifique produisent chacun leur propre rapport, sans arbitrage', () => {
  const groupeLarge = ['zcompare zorbo zkelmi zcouleur', 'zcompare zalpha zbeta ztaille', 'zcompare zuno zdos zforme'];
  const sousGroupeSpecifique = ['zcompare zorbo zkelmi zcouleur', 'zcompare zorbo zbeta ztaille']; // partagent aussi "zorbo" en position 1
  const rLarge = decrireStructure(groupeLarge);
  const rSpecifique = decrireStructure(sousGroupeSpecifique);
  assert.deepEqual(rLarge.ancres, [{ position: 0, jeton: 'zcompare' }]);
  assert.deepEqual(rSpecifique.ancres, [{ position: 0, jeton: 'zcompare' }, { position: 1, jeton: 'zorbo' }]);
  // Les deux rapports coexistent : ni l'un ni l'autre n'est écrasé, modifié, ou jugé "le bon".
  assert.notDeepEqual(rLarge.ancres, rSpecifique.ancres);
});

// ---------------------------------------------------------------------------------------------
// CAS D — deux structures différentes de même arité : rapports séparés, jamais fusionnés
// ---------------------------------------------------------------------------------------------
test('CAS D. deux structures distinctes (groupes déjà séparés en amont) gardent des ancres propres et différentes', () => {
  const structureZcompare = ['zcompare zorbo zkelmi zcouleur', 'zcompare zalpha zbeta ztaille', 'zcompare zuno zdos zforme'];
  const structureZexamine = ['zexamine zuno zdos ztaille', 'zexamine zfoo zbar zcouleur', 'zexamine zorbo zkelmi zforme'];
  const r1 = decrireStructure(structureZcompare);
  const r2 = decrireStructure(structureZexamine);
  assert.deepEqual(r1.ancres, [{ position: 0, jeton: 'zcompare' }]);
  assert.deepEqual(r2.ancres, [{ position: 0, jeton: 'zexamine' }]);
});

// ---------------------------------------------------------------------------------------------
// CAS E — aucune structure lexicale récurrente : échec honnête, jamais une structure inventée
// ---------------------------------------------------------------------------------------------
test('CAS E. aucune position stable (tous les mots varient) : aucune ancre, jamais une structure fabriquée', () => {
  const r = decrireStructure(['zorbo zaime zkelmi', 'zalpha zveut zbeta', 'zuno zcherche zdos']);
  assert.equal(r.ok, true); // le squelette lui-même est valide (même arité) -- seulement sans aucune ancre.
  assert.deepEqual(r.ancres, []);
  assert.deepEqual(r.positionsVariables, [0, 1, 2]);
  assert.equal(Object.keys(r.diversite).length, 3);
  for (const pos of [0, 1, 2]) assert.equal(r.diversite[pos].nombre, 3, 'trois valeurs toutes différentes à chaque position');
});

test('CAS E bis. un seul exemple, ou arités incompatibles : échec relayé tel quel depuis construireSquelette(), jamais réinterprété', () => {
  const r1 = decrireStructure(['zcompare a b couleur']);
  assert.equal(r1.ok, false);
  assert.equal(r1.raison, 'insuffisant');
  const r2 = decrireStructure(['zcompare a b couleur', 'zcompare a b']);
  assert.equal(r2.ok, false);
  assert.equal(r2.raison, 'arites_incompatibles');
});

// ---------------------------------------------------------------------------------------------
// AUCUN SCORE, AUCUN POURCENTAGE, AUCUN STATUT VRAI/FAUX — vérifié par absence explicite
// ---------------------------------------------------------------------------------------------
test('le rapport ne contient jamais de score, de confiance, ou de statut vrai/faux synthétique', () => {
  const r = decrireStructure(['zcompare a b couleur', 'zcompare c d taille', 'zcompare e f forme']);
  const clesInterdites = ['score', 'confiance', 'certaine', 'valide', 'vrai', 'statut', 'credibilite'];
  for (const cle of clesInterdites) assert.ok(!(cle in r), `le champ "${cle}" ne doit jamais apparaître dans un rapport descriptif`);
});

// ---------------------------------------------------------------------------------------------
// PURETÉ — ne mute rien, recalculable à l'identique
// ---------------------------------------------------------------------------------------------
test('fonction pure : un même pool donne toujours le même rapport, et les textes reçus ne sont jamais mutés', () => {
  const pool = ['zcompare a b couleur', 'zcompare c d taille'];
  const copie = JSON.parse(JSON.stringify(pool));
  const r1 = decrireStructure(pool);
  const r2 = decrireStructure(pool);
  assert.deepEqual(r1, r2);
  assert.deepEqual(pool, copie);
});
// === FIN_TEST_RAPPORT_DESCRIPTIF_STRUCTURE ===
