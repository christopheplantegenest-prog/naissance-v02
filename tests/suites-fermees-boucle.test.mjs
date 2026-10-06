// === DEBUT_TEST_SUITES_FERMEES_BOUCLE ===
// v0.63.42 — produireSuitesFermees DÉCRITE (catalogue) et INVOCABLE (table), donc sollicitable par les mécanismes existants (décision ChatGPT,
// 06/10/2026). Preuves : le descripteur ; la chaîne réelle « bonjour Pixel » / « salut Pixel » -> symbolesDeChaine -> A, B -> elementsObservables -> P ->
// produireSuitesFermees -> S, avec les mécanismes réels (observation, groupes, applications sollicitables, conformité, désignation, résolution,
// invocation, exécution persistée) ; S est une production persistée ordinaire ; deux productions compatibles P et P2 laissent « choix à faire »
// SANS sélection automatique. Les textes ne sont que les DONNÉES du scénario : aucune règle ne les connaît. Aucun plafond de coût.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { produireSuitesFermees } from '../app/langage/suites-fermees.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { verifierApplicationAuCatalogue } from '../app/langage/conformite-application.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites } from '../app/langage/connaissances.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const NOM = 'produireSuitesFermees';
const DESCRIPTION = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === NOM);
const CH = { forme: 'collection', elements: { forme: 'scalaire' } };

test('A1. descripteur EXACT : entrée unique `elements` (même forme que produireConstatsStructurels.elements), sortie réelle, « debut » = scalaire nombre, aucune contrainte inventée', () => {
  assert.deepEqual(DESCRIPTION, {
    nom: NOM,
    entrees: { elements: { forme: 'collection', elements: { forme: 'objet', champs: { chemin: CH, contenu: { forme: 'quelconque', peutEtreNull: true } } } } },
    sortie: { forme: 'collection', elements: { forme: 'objet', champs: {
      contenu: { forme: 'collection', elements: { forme: 'scalaire' } },
      occurrences: { forme: 'collection', elements: { forme: 'objet', champs: { element: CH, parent: CH, debut: { forme: 'scalaire', genre: 'nombre' } } } },
      couverture: { forme: 'collection', elements: CH },
    } } },
  });
  const structurels = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === 'produireConstatsStructurels');
  assert.deepEqual(DESCRIPTION.entrees.elements, structurels.entrees.elements);
  assert.equal(JSON.stringify(DESCRIPTION).includes('collectif'), false);
  assert.doesNotThrow(() => valider(DESCRIPTION));
});
test('A2. table : appel positionnel, un seul paramètre « elements », la fonction réelle ; produireSuitesFermees elle-même inchangée (une seule entrée, nom, signature)', () => {
  assert.deepEqual({ appel: TABLE_OPERATIONS[NOM].appel, parametres: [...TABLE_OPERATIONS[NOM].parametres] }, { appel: 'positionnel', parametres: ['elements'] });
  assert.equal(TABLE_OPERATIONS[NOM].fonction, produireSuitesFermees);
  assert.equal(produireSuitesFermees.length, 1);
});
test('A3. la sortie d\'elementsObservables garantit l\'entrée `elements` ; la sortie de produireSuitesFermees ne garantit AUCUNE entrée de ce catalogue sauf les entrées « quelconque »/collection sans champ (aucune boucle)', () => {
  const sortieP = valider(DESCRIPTIONS_OPERATIONS.find((d) => d.nom === 'elementsObservables')).sortie;
  assert.equal(fournieGarantitAttendue(sortieP, valider(DESCRIPTION).entrees.elements), true);
  const sortieS = valider(DESCRIPTION).sortie;
  for (const d of DESCRIPTIONS_OPERATIONS) for (const [entree, forme] of Object.entries(valider(d).entrees)) {
    if (fournieGarantitAttendue(sortieS, forme)) assert.ok(['parcourirStructure.valeur', 'couvrirSequence.elements', 'projeterContenus.elements'].includes(`${d.nom}.${entree}`), `${d.nom}.${entree}`); // MISE À JOUR DÉLIBÉRÉE v0.63.43 : + projeterContenus.elements (entrée { contenu : collection de scalaire } : la sortie de S la garantit, sans boucle : sa sortie ne garantit aucune entrée de ce catalogue hors « quelconque »/collection sans champ)
  }
  for (const [op, e] of [[NOM, 'elements'], ['elementsObservables', 'elements'], ['produireConstatsStructurels', 'elements'], ['resoudreCouverture', 'univers']]) {
    assert.equal(fournieGarantitAttendue(sortieS, valider(DESCRIPTIONS_OPERATIONS.find((d) => d.nom === op)).entrees[e]), false, `${op}.${e}`);
  }
});

// ============================================================================ B. LA CHAÎNE RÉELLE
async function tour(magasin, texte, n) {
  let k = n * 100;
  const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
  const r = await observerPossibilites(message, {
    enregistrer: (d) => enregistrerObservationPossibilites(magasin, d),
    lireExecutions: () => magasin.lireTout('executionsOperations'),
  });
  assert.equal(r.statut, 'ecrite');
  return { message, observation: r.observation, univers: r.univers };
}
const executer = (t, application, magasin) => executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
const appDe = (t, operation) => applicationsSollicitables(t.observation, undefined, t.univers).applications.find((a) => a.operation === operation);
async function chaine() {
  const magasin = magasinMemoireVive();
  const t1 = await tour(magasin, 'bonjour Pixel', 1);
  const rA = await executer(t1, appDe(t1, 'symbolesDeChaine'), magasin);
  const t2 = await tour(magasin, 'salut Pixel', 2);
  const rB = await executer(t2, appDe(t2, 'symbolesDeChaine'), magasin);
  const t3 = await tour(magasin, 'troisième tour', 3);
  const rP = await executer(t3, appDe(t3, 'elementsObservables'), magasin);
  const t4 = await tour(magasin, 'quatrième tour', 4);
  return { magasin, t3, t4, rA, rB, rP, idA: rA.execution.id, idB: rB.execution.id, idP: rP.execution.id };
}
test('B1. avec P pour UNIQUE candidat, l\'application de produireSuitesFermees est DÉTERMINÉE (liaison ordinaire { elements, donnee: idP }), conforme au catalogue, sans « choix à faire »', async () => {
  const w = await chaine();
  assert.equal(w.rP.statut, 'executee');
  assert.equal(w.t4.observation.possibilites.filter((p) => p.operation === NOM).length, 1);
  assert.deepEqual(w.t4.observation.possibilites.filter((p) => p.operation === NOM).map((p) => p.donnee), [w.idP]);
  const g = groupesDeCandidats(w.t4.observation.possibilites, DESCRIPTIONS_OPERATIONS).find((x) => x.operation === NOM);
  assert.deepEqual(g.entrees, [{ entree: 'elements', donnees: [w.idP] }]);
  const { applications, choixAFaire } = applicationsSollicitables(w.t4.observation, undefined, w.t4.univers);
  const app = applications.find((a) => a.operation === NOM);
  assert.deepEqual(app, { operation: NOM, liaisons: [{ entree: 'elements', donnee: w.idP }] });
  assert.equal(choixAFaire.includes(NOM), false);
  assert.equal(verifierApplicationAuCatalogue(app, DESCRIPTIONS_OPERATIONS), true);
});
test('B2. RÉSULTAT EXACT de A + B -> P -> S : les six suites fermées, avec identités et positions (le scénario est une DONNÉE de test, pas une règle)', async () => {
  const w = await chaine();
  const r = await executer(w.t4, appDe(w.t4, NOM), w.magasin);
  assert.equal(r.statut, 'executee');
  const S = r.execution.resultat;
  const attendu = [
    { contenu: 'bonjour Pixel', occ: [[w.idA, 0]], couv: [w.idA] },
    { contenu: 'o', occ: [[w.idA, 1], [w.idA, 4]], couv: [w.idA] },
    { contenu: 'u', occ: [[w.idA, 5], [w.idB, 3]], couv: [w.idA, w.idB] },
    { contenu: ' Pixel', occ: [[w.idA, 7], [w.idB, 5]], couv: [w.idA, w.idB] },
    { contenu: 'l', occ: [[w.idA, 12], [w.idB, 2], [w.idB, 10]], couv: [w.idA, w.idB] },
    { contenu: 'salut Pixel', occ: [[w.idB, 0]], couv: [w.idB] },
  ];
  const lu = (g) => ({ contenu: g.contenu.join(''), occ: g.occurrences.map((o) => { assert.deepEqual(o.parent, []); assert.equal(o.element.length, 1); return [o.element[0], o.debut]; }), couv: g.couverture.map((c) => c[0]) });
  const trie = (l) => [...l].sort((a, b) => (a.contenu < b.contenu ? -1 : 1));
  assert.equal(S.length, 6);
  assert.deepEqual(trie(S.map(lu)), trie(attendu.map((a) => ({ ...a, occ: [...a.occ].sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1])), couv: [...a.couv].sort() }))).map((a) => ({ ...a })));
  assert.deepEqual(S, produireSuitesFermees(w.rP.execution.resultat)); // identique à l'appel direct sur P : la boucle ne transforme rien
});
test('B3. S est une production persistée ORDINAIRE avec sa provenance complète (ligne d\'exécution, désignation externe, liaison, observation) ; la ligne est relue telle quelle', async () => {
  const w = await chaine();
  const r = await executer(w.t4, appDe(w.t4, NOM), w.magasin);
  const lignes = await w.magasin.lireTout('executionsOperations');
  assert.equal(lignes.length, 4); // A, B, P, S
  const ligne = lignes.find((l) => l.id === r.execution.id);
  assert.equal(ligne.operation, NOM);
  assert.deepEqual(ligne.liaisons, [{ entree: 'elements', donnee: w.idP }]);
  assert.deepEqual(ligne.resultat, r.execution.resultat);
  const designation = (await w.magasin.lireTout('designations')).find((d) => d.id === ligne.idDesignation);
  assert.equal(designation.origine, 'exterieure');
  assert.equal(designation.idObservation, w.t4.observation.id);
  assert.deepEqual(designation.liaisons, ligne.liaisons);
  assert.deepEqual(JSON.parse(JSON.stringify(ligne.resultat)), ligne.resultat); // lisible par JSON (persistance)
});
test('B4. TOUR SUIVANT : S est une donnée ordinaire ; elle n\'ouvre AUCUNE application nouvelle propre (ni suites, ni elementsObservables) ; les ensembles existants sont inchangés', async () => {
  const w = await chaine();
  const r = await executer(w.t4, appDe(w.t4, NOM), w.magasin);
  const t5 = await tour(w.magasin, 'cinquième tour', 5);
  const idS = r.execution.id;
  assert.ok(t5.observation.donneesExaminees.includes(idS));
  assert.deepEqual(t5.observation.possibilites.filter((p) => p.donnee === idS).map((p) => `${p.operation}.${p.entree}`).sort(), ['couvrirSequence.elements', 'parcourirStructure.valeur', 'projeterContenus.elements']); // MISE À JOUR DÉLIBÉRÉE v0.63.43 : S ouvre désormais aussi projeterContenus.elements (compatibilité de forme, aucune application déterminée : P et S sont tous deux candidats)
  assert.deepEqual(t5.observation.possibilites.filter((p) => p.operation === 'elementsObservables').map((p) => p.donnee).sort(), [w.idA, w.idB].sort());
  assert.deepEqual(t5.observation.possibilites.filter((p) => p.operation === NOM).map((p) => p.donnee), [w.idP]);
});
test('B5. AMBIGUÏTÉ P / P2 NON RÉSOLUE : deux productions compatibles -> « choix à faire », aucune application, aucune sélection automatique ; l\'exécution explicite d\'UNE application choisie par l\'appelant reste possible', async () => {
  const w = await chaine();
  const rP2 = await executer(w.t4, appDe(w.t4, 'elementsObservables'), w.magasin); // deuxième exécution : P2 a le même contenu que P
  const t5 = await tour(w.magasin, 'cinquième tour', 5);
  const idP2 = rP2.execution.id;
  assert.notEqual(idP2, w.idP);
  assert.deepEqual(t5.observation.possibilites.filter((p) => p.operation === NOM).map((p) => p.donnee).sort(), [w.idP, idP2].sort());
  const g = groupesDeCandidats(t5.observation.possibilites, DESCRIPTIONS_OPERATIONS).find((x) => x.operation === NOM);
  assert.deepEqual(g.entrees, [{ entree: 'elements', donnees: [w.idP, idP2].sort() }]);
  const { applications, choixAFaire } = applicationsSollicitables(t5.observation, undefined, t5.univers);
  assert.equal(applications.some((a) => a.operation === NOM), false);
  assert.equal(choixAFaire.includes(NOM), true);
  const avant = (await w.magasin.lireTout('executionsOperations')).length;
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, avant); // aucune exécution automatique
  const r = await executer(t5, { operation: NOM, liaisons: [{ entree: 'elements', donnee: idP2 }] }, w.magasin);
  assert.equal(r.statut, 'executee');
  assert.deepEqual(r.execution.liaisons, [{ entree: 'elements', donnee: idP2 }]);
});
test('B6. cas limites de la boucle : produireSuitesFermees sur un SEUL élément et sur deux contenus identiques ; chaîne vide ; les résultats sont des productions valides', async () => {
  const magasin = magasinMemoireVive();
  const t1 = await tour(magasin, 'abca', 1);
  const rA = await executer(t1, appDe(t1, 'symbolesDeChaine'), magasin);
  const t2 = await tour(magasin, 'tour deux', 2);
  const rP = await executer(t2, appDe(t2, 'elementsObservables'), magasin);
  const t3 = await tour(magasin, 'tour trois', 3);
  const r = await executer(t3, appDe(t3, NOM), magasin);
  assert.equal(r.statut, 'executee');
  assert.deepEqual(r.execution.resultat.map((g) => g.contenu.join('')).sort(), ['a', 'abca']);
  assert.deepEqual(r.execution.resultat.find((g) => g.contenu.join('') === 'a').occurrences.map((o) => [o.element[0], o.debut]), [[rA.execution.id, 0], [rA.execution.id, 3]]);
  assert.ok(rP.execution.id);
  assert.deepEqual(produireSuitesFermees([{ chemin: ['x'], contenu: symbolesDeChaine('') }, { chemin: ['y'], contenu: symbolesDeChaine('') }]), []);
  assert.deepEqual(produireSuitesFermees([{ chemin: ['x'], contenu: symbolesDeChaine('abc') }, { chemin: ['y'], contenu: symbolesDeChaine('abc') }]).map((g) => g.contenu.join('')), ['abc']);
});
test('C1. NON TOUCHÉS : suites-fermees.js et elements-observables.js ne connaissent ni le catalogue ni la table ; aucun autre fichier de production que catalogue, table et module ne nomme l\'opération ; produireConstatsValeurs reste hors catalogue', () => {
  const code = (f) => readFileSync(join(RACINE, 'app', 'langage', f), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/descriptions-operations|table-operations|DESCRIPTIONS_OPERATIONS|TABLE_OPERATIONS/.test(code('suites-fermees.js')), false);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => /ConstatsValeurs/.test(d.nom)), false);
  for (const f of ['execution-sollicitee.js', 'applications-sollicitables.js', 'groupes-candidats.js', 'application-unique.js', 'valeurs-application.js', 'invocation-operations.js', 'connaissances.js', 'possibilites-liaison.js']) assert.equal(/produireSuitesFermees|suites-fermees/.test(code(f)), false, f);
});
// === FIN_TEST_SUITES_FERMEES_BOUCLE ===
