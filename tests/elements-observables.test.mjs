// === DEBUT_TEST_ELEMENTS_OBSERVABLES ===
// v0.63.41 — PREMIÈRE OPÉRATION COLLECTIVE RÉELLE : elementsObservables (décision ChatGPT, 06/10/2026). Raccord explicite
// [{ identite, valeur }] -> [{ chemin: [identite], contenu: valeur }]. Preuves : la fonction pure ; son descripteur (entrée UNIQUE collective,
// valeur = collection de chaînes, sortie compatible avec l'entrée des observateurs) ; l'effet réel sur toute la chaîne (observation, groupes,
// applications, conformité, désignation, résolution, exécution, tour suivant, UI) avec deux productions de symbolesDeChaine ; aucune
// spécialisation (ni nom d'opération, ni provenance, ni contenu). produireSuitesFermees et produireConstatsValeurs NE SONT PAS branchés :
// ils ne sont appelés ici que PAR LE TEST, pour montrer que le raccord les satisfait.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { elementsObservables } from '../app/langage/elements-observables.js';
import * as module from '../app/langage/elements-observables.js';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { invoquerOperation } from '../app/langage/invocation-operations.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { verifierApplicationAuCatalogue } from '../app/langage/conformite-application.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { produireSuitesFermees } from '../app/langage/suites-fermees.js';
import { produireConstatsValeurs } from '../app/langage/constats-valeurs.js';
import { produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { magasinMemoireVive, enregistrerObservationPossibilites } from '../app/langage/connaissances.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const NOM = 'elementsObservables';
const DESCRIPTION = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === NOM);
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && /^elementsObservables : /.test(e.message) && (motif === undefined || motif.test(e.message)), String(f));

// ============================================================================ A. LA FONCTION PURE
test('A1. un seul export ; { identite, valeur } -> { chemin: [identite], contenu: valeur } ; même ordre ; [] -> []', () => {
  assert.deepEqual(Object.keys(module), ['elementsObservables']);
  assert.equal(elementsObservables.length, 1);
  assert.deepEqual(elementsObservables([{ identite: 'b', valeur: ['x'] }, { identite: 'a', valeur: ['y', 'z'] }]), [{ chemin: ['b'], contenu: ['x'] }, { chemin: ['a'], contenu: ['y', 'z'] }]);
  assert.deepEqual(elementsObservables([]), []);
});
test('A2. INVARIANTS : contenu = la référence EXACTE de valeur (aucune copie) ; aucun tri, filtre ni dédoublonnage ; un seul segment ; entrée intacte', () => {
  const v1 = ['a']; const v2 = ['a']; const vide = [];
  const entree = [{ identite: 'z', valeur: v1 }, { identite: 'y', valeur: v2 }, { identite: 'x', valeur: vide }, { identite: 'w', valeur: v1 }];
  const photo = JSON.stringify(entree);
  const r = elementsObservables(entree);
  assert.equal(r.length, 4);
  assert.deepEqual(r.map((e) => e.chemin), [['z'], ['y'], ['x'], ['w']]);
  assert.equal(r[0].contenu, v1); assert.equal(r[1].contenu, v2); assert.equal(r[2].contenu, vide); assert.equal(r[3].contenu, v1);
  for (const e of r) { assert.deepEqual(Object.keys(e), ['chemin', 'contenu']); assert.equal(e.chemin.length, 1); assert.equal(typeof e.chemin[0], 'string'); }
  assert.equal(JSON.stringify(entree), photo);
  assert.notEqual(r, entree);
});
test('A3. entrées invalides : TypeError, aucun résultat partiel ; accesseur refusé SANS être exécuté ; héritage ignoré', () => {
  refuse(() => elementsObservables(null), /tableau/);
  refuse(() => elementsObservables({}), /tableau/);
  refuse(() => elementsObservables([null]));
  refuse(() => elementsObservables([[]]));
  refuse(() => elementsObservables([{ identite: '', valeur: [] }]), /chaîne non vide/);
  refuse(() => elementsObservables([{ identite: 1, valeur: [] }]), /chaîne non vide/);
  refuse(() => elementsObservables([{ identite: 'a' }]), /valeur/);
  refuse(() => elementsObservables([{ valeur: [] }]), /identite/);
  refuse(() => elementsObservables(new Array(2)), /absent/);
  let appels = 0;
  refuse(() => elementsObservables([{ identite: 'a', valeur: [] }, { get identite() { appels += 1; return 'b'; }, valeur: [] }]), /accesseur/);
  assert.equal(appels, 0);
  refuse(() => elementsObservables([Object.create({ identite: 'a', valeur: [] })]));
});
test('A4. aucune connaissance de l\'origine, du nom ni du contenu : le même traitement pour toute identité et toute valeur', () => {
  const code = readFileSync(join(RACINE, 'app', 'langage', 'elements-observables.js'), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(code.match(/^\s*import\b.*$/gm), null);
  assert.equal(/symbole|Pixel|message|execution|parcourir|\.sort\(|\.filter\(|\.slice\(|\.concat\(|\.map\(|JSON|Set\(|Map\(|async|await|Date|Math/.test(code), false);
});

// ============================================================================ B. LE DESCRIPTEUR
test('B1. descripteur valide ; entrée UNIQUE, collective ; valeur = collection de chaînes (jamais « quelconque ») ; sortie { chemin, contenu }', () => {
  const v = valider(DESCRIPTION);
  assert.deepEqual(Object.keys(v.entrees), ['elements']);
  assert.equal(v.entrees.elements.collectif, true);
  assert.deepEqual(v.entrees.elements.elements, { forme: 'objet', champs: { identite: { forme: 'scalaire', genre: 'chaine' }, valeur: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } } } });
  assert.deepEqual(v.sortie.elements.champs.contenu, { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } });
  assert.deepEqual(v.sortie.elements.champs.chemin, { forme: 'collection', elements: { forme: 'scalaire' } });
  assert.equal(/quelconque/.test(JSON.stringify(DESCRIPTION)), false);
});
test('B2. la sortie GARANTIT l\'entrée `elements` des observateurs { chemin, contenu } (le raccord est réellement typé)', () => {
  for (const nom of ['produireConstatsStructurels']) {
    const attendue = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === nom).entrees.elements;
    assert.equal(fournieGarantitAttendue(valider(DESCRIPTION).sortie, valider(DESCRIPTIONS_OPERATIONS.find((d) => d.nom === nom)).entrees.elements), true, nom);
    assert.ok(attendue);
  }
});
test('B3. la table : appel positionnel, un seul paramètre « elements » ; le catalogue compte 11 descriptions, ordre code-unit ; seule entrée collective du catalogue', () => {
  assert.deepEqual({ appel: TABLE_OPERATIONS[NOM].appel, parametres: [...TABLE_OPERATIONS[NOM].parametres] }, { appel: 'positionnel', parametres: ['elements'] });
  assert.equal(TABLE_OPERATIONS[NOM].fonction, elementsObservables);
  const noms = DESCRIPTIONS_OPERATIONS.map((d) => d.nom);
  assert.equal(noms.length, 16); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
  assert.deepEqual([...noms], [...noms].sort());
  assert.equal(noms.indexOf(NOM), 3);
  assert.deepEqual(Object.keys(TABLE_OPERATIONS), [...Object.keys(TABLE_OPERATIONS)].sort());
  const collectives = DESCRIPTIONS_OPERATIONS.flatMap((d) => Object.entries(d.entrees).filter(([, e]) => e.collectif === true).map(([n]) => `${d.nom}.${n}`));
  assert.deepEqual(collectives, ['elementsObservables.elements']);
});
test('B4. le nom ne contient aucune notion de symbole, de langage ni de texte', () => {
  assert.equal(/symbole|chaine|langue|langage|mot|texte|caract/i.test(NOM), false);
});
test('B5. invocation directe via l\'invocateur : le résultat est la sortie de la fonction (cas ordinaire de l\'invocateur, inchangé)', () => {
  const r = invoquerOperation(TABLE_OPERATIONS, NOM, { elements: [{ identite: 'a', valeur: ['x'] }] });
  assert.deepEqual(r, [{ chemin: ['a'], contenu: ['x'] }]);
});

// ============================================================================ C. EFFET RÉEL SUR TOUTE LA CHAÎNE
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
const applicationOrdinaire = (observation, operation) => {
  const g = groupesDeCandidats(observation.possibilites, DESCRIPTIONS_OPERATIONS).find((x) => x.operation === operation);
  return { operation, liaisons: g.entrees.map((e) => { assert.equal(e.donnees.length, 1); return { entree: e.entree, donnee: e.donnees[0] }; }) };
};
const executer = (t, application, magasin) => executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
// Deux productions de symbolesDeChaine : « bonjour Pixel » (tour 1) et « salut Pixel » (tour 2), puis un troisième tour (message quelconque).
async function monde() {
  const magasin = magasinMemoireVive();
  const t1 = await tour(magasin, 'bonjour Pixel', 1);
  const rA = await executer(t1, applicationOrdinaire(t1.observation, 'symbolesDeChaine'), magasin);
  const t2 = await tour(magasin, 'salut Pixel', 2);
  const rB = await executer(t2, applicationOrdinaire(t2.observation, 'symbolesDeChaine'), magasin);
  assert.equal(rA.statut, 'executee'); assert.equal(rB.statut, 'executee');
  const t3 = await tour(magasin, 'et maintenant', 3);
  return { magasin, t1, t2, t3, rA, rB, idA: rA.execution.id, idB: rB.execution.id, valA: symbolesDeChaine('bonjour Pixel'), valB: symbolesDeChaine('salut Pixel') };
}
test('C1. avant toute production : le message seul n\'offre PAS elementsObservables (aucune donnée de la forme) ; aucune application collective', async () => {
  const magasin = magasinMemoireVive();
  const t = await tour(magasin, 'bonjour Pixel', 1);
  assert.equal(t.observation.possibilites.some((p) => p.operation === NOM), false);
  assert.equal(applicationsSollicitables(t.observation).applications.some((a) => a.operation === NOM), false);
});
test('C2. DEUX productions compatibles : l\'application collective contient AUTOMATIQUEMENT les deux identités, sans choix ; le message n\'y est pas', async () => {
  const w = await monde();
  const atomes = w.t3.observation.possibilites.filter((p) => p.operation === NOM);
  assert.deepEqual(atomes.map((p) => p.donnee).sort(), [w.idA, w.idB].sort());
  const g = groupesDeCandidats(w.t3.observation.possibilites, DESCRIPTIONS_OPERATIONS).find((x) => x.operation === NOM);
  assert.deepEqual(g.entrees, [{ entree: 'elements', donnees: [w.idA, w.idB].sort(), collectif: true }]);
  const { applications, choixAFaire } = applicationsSollicitables(w.t3.observation);
  const app = applications.find((a) => a.operation === NOM);
  assert.deepEqual(app, { operation: NOM, liaisons: [{ entree: 'elements', donnees: [w.idA, w.idB].sort() }] });
  assert.equal(choixAFaire.some((c) => c.operation === NOM), false);
  assert.equal(verifierApplicationAuCatalogue(app, DESCRIPTIONS_OPERATIONS), true);
});
test('C3. EXÉCUTION : [{ chemin:[idA], contenu: valeurA }, { chemin:[idB], contenu: valeurB }] ; provenance complète (désignation externe, liaison collective exacte)', async () => {
  const w = await monde();
  const [app] = applicationsSollicitables(w.t3.observation).applications.filter((a) => a.operation === NOM);
  const r = await executer(w.t3, app, w.magasin);
  assert.equal(r.statut, 'executee');
  const attendu = [{ chemin: [w.idA], contenu: w.valA }, { chemin: [w.idB], contenu: w.valB }].sort((a, b) => (a.chemin[0] < b.chemin[0] ? -1 : 1));
  assert.deepEqual(r.execution.resultat, attendu);
  assert.deepEqual(r.designation.liaisons, app.liaisons);
  assert.deepEqual(r.execution.liaisons, app.liaisons);
  assert.equal(r.designation.origine, 'exterieure');
  assert.equal(r.designation.idObservation, w.t3.observation.id);
  assert.equal(r.execution.idDesignation, r.designation.id);
  assert.equal(r.execution.operation, NOM);
  const lignes = await w.magasin.lireTout('executionsOperations');
  assert.equal(lignes.length, 3);
});
test('C4. TOUR SUIVANT : la production devient une donnée ; elle N\'EST PAS réinjectée dans elementsObservables (la forme est le seul critère) ; elle devient compatible avec l\'entrée des observateurs', async () => {
  const w = await monde();
  const [app] = applicationsSollicitables(w.t3.observation).applications.filter((a) => a.operation === NOM);
  const r = await executer(w.t3, app, w.magasin);
  const t4 = await tour(w.magasin, 'quatrième tour', 4);
  const idP = r.execution.id;
  assert.ok(t4.observation.donneesExaminees.includes(idP));
  assert.deepEqual(t4.observation.possibilites.filter((p) => p.operation === NOM).map((p) => p.donnee).sort(), [w.idA, w.idB].sort());
  assert.equal(t4.observation.possibilites.some((p) => p.donnee === idP && p.operation === NOM), false);
  assert.equal(t4.observation.possibilites.some((p) => p.donnee === idP && p.operation === 'produireConstatsStructurels' && p.entree === 'elements'), true);
  const app4 = applicationsSollicitables(t4.observation).applications.find((a) => a.operation === NOM);
  assert.deepEqual(app4.liaisons, app.liaisons);
});
test('C5. UI de sollicitation : la zone reçoit l\'application collective telle quelle (liste d\'applications, aucune adaptation de l\'interface)', async () => {
  const w = await monde();
  const suivi = suivreObservationDuTour(async () => ({ statut: 'ecrite', observation: w.t3.observation, univers: w.t3.univers }));
  await suivi.observer({ id: 'x', texte: 'x' });
  const { sollicitation } = suivi.joindre({});
  const app = sollicitation.applications.find((a) => a.operation === NOM);
  assert.deepEqual(app.liaisons, [{ entree: 'elements', donnees: [w.idA, w.idB].sort() }]);
  assert.equal(sollicitation.univers, w.t3.univers);
});
test('C6. le raccord satisfait réellement les observateurs (appelés ICI par le test seulement) : l\'identité de la production ET la position du symbole sont distinguées', async () => {
  const w = await monde();
  const [app] = applicationsSollicitables(w.t3.observation).applications.filter((a) => a.operation === NOM);
  const r = await executer(w.t3, app, w.magasin);
  const elements = r.execution.resultat;
  assert.doesNotThrow(() => produireConstatsStructurels(elements));
  const suites = produireSuitesFermees(elements);
  const pixel = suites.find((s) => s.contenu.join('') === ' Pixel');
  assert.deepEqual(pixel.occurrences.map((o) => [o.element[0], o.parent, o.debut]).sort(), [[w.idA, [], 7], [w.idB, [], 5]].sort());
  const u = produireConstatsValeurs(elements).find((c) => c.constat.valeur === 'u');
  assert.deepEqual(u.occurrences.map((o) => [o.element[0], o.chemin[0]]).sort(), [[w.idA, 5], [w.idB, 3]].sort());
});
test('C7. GÉNÉRAL, sans spécialisation : une donnée future de la même forme (collection de chaînes, autre origine) est incluse elle aussi ; une donnée d\'une autre forme (production d\'une autre opération, forme DÉCLARÉE par le catalogue) ne l\'est pas', async () => {
  const w = await monde();
  const autre = { id: 'autre-1', horodatage: '2026-10-06T10:00:00.000Z', idDesignation: 'designation-autre-1', operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: 'm-0' }], resultat: ['a', 'b'] }; // MISE À JOUR DÉLIBÉRÉE v0.63.59 : liaisons réelles (au moins une), entrées(P) exposée pour toute production présente
  const nombres = { id: 'autre-2', horodatage: '2026-10-06T10:00:00.000Z', idDesignation: 'designation-autre-2', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'm-0' }], resultat: [] }; // MISE À JOUR DÉLIBÉRÉE v0.63.59 : liaisons réelles (au moins une), entrées(P) exposée pour toute production présente
  await w.magasin.ecrire('executionsOperations', autre);
  await w.magasin.ecrire('executionsOperations', nombres);
  const t = await tour(w.magasin, 'tour de plus', 5);
  const app = applicationsSollicitables(t.observation).applications.find((a) => a.operation === NOM);
  assert.deepEqual(app.liaisons[0].donnees, [w.idA, w.idB, 'autre-1'].sort());
});
test('C8. la conformité refuse toujours l\'ordinaire sur cette entrée collective, et le sous-ensemble est refusé par la désignation', async () => {
  const w = await monde();
  assert.throws(() => verifierApplicationAuCatalogue({ operation: NOM, liaisons: [{ entree: 'elements', donnee: w.idA }] }, DESCRIPTIONS_OPERATIONS), TypeError);
  const r = await executer(w.t3, { operation: NOM, liaisons: [{ entree: 'elements', donnees: [w.idA] }] }, w.magasin);
  assert.equal(r.statut, 'echec_designation');
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 2);
});
test('C9. le moteur n\'a pas bougé : aucun fichier de production autre que le catalogue, la table et le module ne nomme l\'opération ; les observateurs ne sont pas branchés', () => {
  const nommant = [];
  const parcourir = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) parcourir(f); else if (/\.js$/.test(e.name) && /elementsObservables|elements-observables/.test(readFileSync(f, 'utf8'))) nommant.push(f.slice(RACINE.length + 1)); } };
  parcourir(join(RACINE, 'app'));
  assert.deepEqual(nommant.sort(), ['app/langage/descriptions-operations.js', 'app/langage/elements-observables.js', 'app/langage/table-operations.js']);
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => /ConstatsValeurs/.test(d.nom)), false); // MISE À JOUR DÉLIBÉRÉE v0.63.42 : produireSuitesFermees est désormais décrite (v0.63.42) ; produireConstatsValeurs ne l'est toujours pas
  assert.equal(Object.keys(TABLE_OPERATIONS).some((n) => /ConstatsValeurs/.test(n)), false);
});
// === FIN_TEST_ELEMENTS_OBSERVABLES ===
