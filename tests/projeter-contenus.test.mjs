// === DEBUT_TEST_PROJETER_CONTENUS ===
// v0.63.43 — projeterContenus (B1) : projection MÉCANIQUE des contenus (décision ChatGPT, 06/10/2026, après le cadrage B1). Preuves : le contrat de la
// fonction pure (ordre, références, doublons, contenu vide, refus) ; le descripteur et la table ; la chaîne réelle A + B -> P -> S -> M avec les
// mécanismes existants ; la séparation valeur / provenance ; les compatibilités de forme créées (acceptées, non corrigées) ; l'absence de sélection
// automatique quand P et S sont tous deux candidats ; ce qui n'est PAS touché. Les textes ne sont que les DONNÉES du scénario : aucune règle ne les connaît.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { projeterContenus } from '../app/langage/projeter-contenus.js';
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
const NOM = 'projeterContenus';
const DESCRIPTION = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === NOM);
const CS = { forme: 'collection', elements: { forme: 'scalaire' } };

// ============================================================================ A. LA FONCTION PURE
test('A1. contrat : pour chaque élément, dans l\'ordre, EXACTEMENT son `contenu` (même référence, aucune copie) ; champs en plus tolérés et ignorés', () => {
  const a = ['x', 'y'];
  const b = ['z'];
  const entree = [{ contenu: a, couverture: [['E']], occurrences: [], chemin: ['E'] }, { contenu: b }];
  const sortie = projeterContenus(entree);
  assert.equal(sortie.length, 2);
  assert.equal(sortie[0], a);
  assert.equal(sortie[1], b);
  assert.deepEqual(entree, [{ contenu: ['x', 'y'], couverture: [['E']], occurrences: [], chemin: ['E'] }, { contenu: ['z'] }]); // entrée intacte
  assert.equal(projeterContenus.length, 1);
});
test('A2. AUCUN autre traitement : pas de tri, de filtre, de dédoublonnage, de concaténation ; les doublons restent des doublons ; un contenu vide reste vide', () => {
  const entree = [{ contenu: ['b', 'a'] }, { contenu: [] }, { contenu: ['b', 'a'] }, { contenu: ['a'] }, { contenu: [] }, { contenu: ['a', 'b'] }];
  assert.deepEqual(projeterContenus(entree), [['b', 'a'], [], ['b', 'a'], ['a'], [], ['a', 'b']]);
  assert.deepEqual(projeterContenus([]), []);
  assert.deepEqual(projeterContenus([{ contenu: ['a', 'bc'] }, { contenu: ['ab', 'c'] }]), [['a', 'bc'], ['ab', 'c']]); // listes, jamais chaînes concaténées
  assert.deepEqual(projeterContenus([{ contenu: [1, true, 'x', 0, false, ''] }]), [[1, true, 'x', 0, false, '']]); // scalaires de tout genre, sans genre exigé
});
test('A3. la fonction ne lit NI couverture NI occurrences NI chemin : des accesseurs sur ces champs ne sont jamais exécutés', () => {
  let lus = 0;
  const element = { contenu: ['a'] };
  for (const cle of ['couverture', 'occurrences', 'chemin']) Object.defineProperty(element, cle, { enumerable: true, get() { lus += 1; return []; } });
  assert.deepEqual(projeterContenus([element]), [['a']]);
  assert.equal(lus, 0);
});
test('A4. refus (TypeError, aucun résultat partiel) : entrée non tableau, tableau creux ou à accesseur, élément non objet, contenu absent / hérité / accesseur / non collection / creux / non scalaire', () => {
  const refus = (valeur) => assert.throws(() => projeterContenus(valeur), TypeError);
  for (const v of [undefined, null, 'abc', 12, { contenu: [] }]) refus(v);
  refus(new Array(2));
  const acc = [{ contenu: [] }];
  Object.defineProperty(acc, 0, { get() { throw new Error('exécuté'); }, enumerable: true });
  refus(acc);
  for (const e of [null, undefined, 'x', 3, [], [['a']]]) refus([e]);
  refus([{}]);
  refus([{ contenu: undefined }].map((x) => ({ ...x, contenu: undefined })));
  refus([Object.create({ contenu: ['a'] })]); // propriété héritée ignorée
  const accContenu = {};
  Object.defineProperty(accContenu, 'contenu', { get() { throw new Error('exécuté'); }, enumerable: true });
  refus([accContenu]);
  for (const c of [null, 'abc', 5, { 0: 'a', length: 1 }]) refus([{ contenu: c }]);
  refus([{ contenu: new Array(2) }]);
  const accSymbole = ['a'];
  Object.defineProperty(accSymbole, 0, { get() { throw new Error('exécuté'); }, enumerable: true });
  refus([{ contenu: accSymbole }]);
  for (const s of [null, undefined, {}, ['a'], () => 1, Symbol('x')]) refus([{ contenu: ['a', s] }]);
  refus([{ contenu: ['a'] }, { contenu: 'refusé en second' }]); // aucun résultat partiel : l'erreur est levée, rien n'est rendu
});

// ============================================================================ B. CATALOGUE ET TABLE
test('B1. descripteur EXACT : entrée unique `elements` { contenu : collection de scalaire } SANS `chemin` ni genre ; sortie collection de collections de scalaire ; aucune entrée collective', () => {
  assert.deepEqual(DESCRIPTION, {
    nom: NOM,
    entrees: { elements: { forme: 'collection', elements: { forme: 'objet', champs: { contenu: CS } } } },
    sortie: { forme: 'collection', elements: CS },
  });
  assert.equal(JSON.stringify(DESCRIPTION).includes('collectif'), false);
  assert.equal(JSON.stringify(DESCRIPTION).includes('genre'), false);
  assert.equal(JSON.stringify(DESCRIPTION).includes('chemin'), false);
  assert.doesNotThrow(() => valider(DESCRIPTION));
});
test('B2. table : appel positionnel, un seul paramètre « elements », la fonction réelle ; catalogue et table comptent QUATORZE entrées (treize à v0.63.43) au même ordre de noms', () => {
  assert.deepEqual({ appel: TABLE_OPERATIONS[NOM].appel, parametres: [...TABLE_OPERATIONS[NOM].parametres] }, { appel: 'positionnel', parametres: ['elements'] });
  assert.equal(TABLE_OPERATIONS[NOM].fonction, projeterContenus);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.deepEqual(Object.keys(TABLE_OPERATIONS), DESCRIPTIONS_OPERATIONS.map((d) => d.nom));
  const noms = DESCRIPTIONS_OPERATIONS.map((d) => d.nom);
  assert.equal(noms[noms.indexOf(NOM) - 1], 'projeterChemins'); // MISE À JOUR DÉLIBÉRÉE v0.63.45 : projeterChemins s'insère juste avant (ordre code-unit)
  assert.equal(noms[noms.indexOf(NOM) + 1], 'rechercherSousSuites'); // MISE À JOUR DÉLIBÉRÉE v0.63.44 : rechercherSousSuites s'insère juste après
});
test('B3. COMPATIBILITÉS DE FORME créées par la SORTIE de projeterContenus (acceptées, jamais corrigées) : elle garantit exactement neuf entrées (huit à v0.63.43), toutes de forme « collection » ; elle ne garantit ni projeterContenus, ni produireSuitesFermees, ni elementsObservables, ni produireConstatsStructurels (aucune boucle)', () => {
  const sortie = valider(DESCRIPTION).sortie;
  const garanties = [];
  for (const d of DESCRIPTIONS_OPERATIONS) for (const [entree, forme] of Object.entries(valider(d).entrees)) if (fournieGarantitAttendue(sortie, forme)) garanties.push(`${d.nom}.${entree}`);
  assert.deepEqual(garanties.sort(), [
    'couvrirSequence.elements', 'memesCouvertures.a', 'memesCouvertures.b', 'normaliserCouverture.chemins', 'parcourirStructure.valeur',
    'partagerCouvertures.a', 'partagerCouvertures.b', 'rechercherSousSuites.motifs', 'resoudreCouverture.couverture', 'resoudreElements.couverture', // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements.couverture (entrée « collection de collection de scalaire » : collision de forme acceptée)
  ]); // MISE À JOUR DÉLIBÉRÉE v0.63.44 : + rechercherSousSuites.motifs (entrée « collection de collection de scalaire » : collision de forme acceptée)
});
test('B4. COMPATIBILITÉS créées par l\'ENTRÉE de projeterContenus : elle est garantie par la sortie de S, par celle de P (accepté) et, depuis v0.63.44, par celle de rechercherSousSuites ; elle n\'est garantie par aucune autre sortie du catalogue', () => {
  const entree = valider(DESCRIPTION).entrees.elements;
  const garantissent = DESCRIPTIONS_OPERATIONS.filter((d) => fournieGarantitAttendue(valider(d).sortie, entree)).map((d) => d.nom).sort();
  assert.deepEqual(garantissent, ['elementsObservables', 'produireSuitesFermees', 'rechercherSousSuites', 'resoudreElements']); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements (sa sortie {chemin, contenu} porte un `contenu` collection de scalaire) ; MISE À JOUR DÉLIBÉRÉE v0.63.44 : + rechercherSousSuites (sa sortie { contenu, occurrences } porte un `contenu` collection de scalaire ; aucune boucle : B2 ne la réalimente pas, voir ses tests)
});

// ============================================================================ C. LA CHAÎNE RÉELLE A + B -> P -> S -> M
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
  const rS = await executer(t4, appDe(t4, 'produireSuitesFermees'), magasin);
  const t5 = await tour(magasin, 'cinquième tour', 5);
  return { magasin, t5, rA, rB, rP, rS, idA: rA.execution.id, idB: rB.execution.id, idP: rP.execution.id, idS: rS.execution.id };
}
const liste = (texte) => symbolesDeChaine(texte);

test('C1. S et P sont tous deux candidats : AUCUNE application déterminée, « choix à faire », aucune sélection automatique ; les deux candidatures sont exactement [P, S]', async () => {
  const w = await chaine();
  assert.equal(w.rS.statut, 'executee');
  const candidats = w.t5.observation.possibilites.filter((p) => p.operation === NOM);
  assert.deepEqual(candidats.map((p) => `${p.donnee}|${p.entree}`).sort(), [`${w.idP}|elements`, `${w.idS}|elements`].sort());
  const g = groupesDeCandidats(w.t5.observation.possibilites, DESCRIPTIONS_OPERATIONS).find((x) => x.operation === NOM);
  assert.deepEqual(g.entrees.map((e) => [e.entree, [...e.donnees].sort()]), [['elements', [w.idP, w.idS].sort()]]);
  const { applications, choixAFaire } = applicationsSollicitables(w.t5.observation, undefined, w.t5.univers);
  assert.equal(applications.some((a) => a.operation === NOM), false);
  assert.equal(choixAFaire.includes(NOM), true);
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 4); // A, B, P, S : rien n'a été exécuté en plus
});
test('C2. RÉSULTAT EXACT de A + B -> P -> S -> M : six listes de symboles, dans l\'ordre produit par S (listes, jamais chaînes concaténées) ; identique à l\'appel direct', async () => {
  const w = await chaine();
  const r = await executer(w.t5, { operation: NOM, liaisons: [{ entree: 'elements', donnee: w.idS }] }, w.magasin);
  assert.equal(r.statut, 'executee');
  const M = r.execution.resultat;
  assert.deepEqual(M, [liste('bonjour Pixel'), liste('o'), liste('u'), liste(' Pixel'), liste('l'), liste('salut Pixel')]);
  assert.deepEqual(M, w.rS.execution.resultat.map((g) => g.contenu)); // l'ordre est celui de S, sans signification
  assert.deepEqual(M, projeterContenus(produireSuitesFermees(w.rP.execution.resultat)));
  assert.deepEqual(M[3], [' ', 'P', 'i', 'x', 'e', 'l']);
  for (const m of M) assert.equal(Array.isArray(m), true);
  assert.equal(M.length, w.rS.execution.resultat.length); // aucune sélection : « o », « u », « l » restent, quelle que soit leur couverture ou leur longueur
});
test('C3. SÉPARATION valeur / provenance : AUCUNE identité (A, B, P, S, ni aucune « execution-operation ») dans la valeur de M ; la provenance M -> S est dans la ligne d\'exécution ordinaire et la désignation', async () => {
  const w = await chaine();
  const r = await executer(w.t5, { operation: NOM, liaisons: [{ entree: 'elements', donnee: w.idS }] }, w.magasin);
  const texte = JSON.stringify(r.execution.resultat);
  for (const id of [w.idA, w.idB, w.idP, w.idS, r.execution.id]) assert.equal(texte.includes(id), false, id);
  assert.equal(/execution-operation|designation|message-/.test(texte), false);
  const lignes = await w.magasin.lireTout('executionsOperations');
  assert.equal(lignes.length, 5);
  const ligne = lignes.find((l) => l.id === r.execution.id);
  assert.deepEqual(Object.keys(ligne).sort(), ['horodatage', 'id', 'idDesignation', 'liaisons', 'operation', 'resultat']);
  assert.equal(ligne.operation, NOM);
  assert.deepEqual(ligne.liaisons, [{ entree: 'elements', donnee: w.idS }]);
  assert.deepEqual(ligne.resultat, r.execution.resultat);
  const designation = (await w.magasin.lireTout('designations')).find((d) => d.id === ligne.idDesignation);
  assert.equal(designation.origine, 'exterieure');
  assert.deepEqual(designation.liaisons, ligne.liaisons);
  assert.equal(designation.idObservation, w.t5.observation.id);
  assert.deepEqual(JSON.parse(JSON.stringify(ligne.resultat)), ligne.resultat);
  // la chaîne de provenance reste remontable : M -> S -> P -> A, B
  const parId = new Map(lignes.map((l) => [l.id, l]));
  assert.deepEqual(parId.get(w.idS).liaisons, [{ entree: 'elements', donnee: w.idP }]);
  assert.deepEqual(parId.get(w.idP).liaisons, [{ entree: 'elements', donnees: [w.idA, w.idB] }]);
});
test('C4. projeterContenus appliquée à P (autre candidate) : les contenus entiers des éléments, dans l\'ordre de P ; une SECONDE exécution sur S donne une nouvelle production de même valeur (deux productions, deux identités, une seule valeur : aucune identité par contenu)', async () => {
  const w = await chaine();
  const rP2 = await executer(w.t5, { operation: NOM, liaisons: [{ entree: 'elements', donnee: w.idP }] }, w.magasin);
  assert.equal(rP2.statut, 'executee');
  assert.deepEqual(rP2.execution.resultat, [liste('bonjour Pixel'), liste('salut Pixel')]);
  const m1 = await executer(w.t5, { operation: NOM, liaisons: [{ entree: 'elements', donnee: w.idS }] }, w.magasin);
  const t6 = await tour(w.magasin, 'sixième tour', 6);
  const m2 = await executer(t6, { operation: NOM, liaisons: [{ entree: 'elements', donnee: w.idS }] }, w.magasin);
  assert.notEqual(m1.execution.id, m2.execution.id);
  assert.deepEqual(m1.execution.resultat, m2.execution.resultat);
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 7); // A, B, P, S, M(P), M, M'
});
test('C5. TOUR SUIVANT après M : les compatibilités de forme de M (neuf entrées depuis v0.63.44, acceptées) apparaissent comme possibilités ; aucune application nouvelle déterminée tant que d\'autres productions de même forme existent ; aucune boucle vers projeterContenus', async () => {
  const w = await chaine();
  const r = await executer(w.t5, { operation: NOM, liaisons: [{ entree: 'elements', donnee: w.idS }] }, w.magasin);
  const t6 = await tour(w.magasin, 'sixième tour', 6);
  const deM = t6.observation.possibilites.filter((p) => p.donnee === r.execution.id).map((p) => `${p.operation}.${p.entree}`).sort();
  assert.deepEqual(deM, [
    'couvrirSequence.elements', 'memesCouvertures.a', 'memesCouvertures.b', 'normaliserCouverture.chemins', 'parcourirStructure.valeur',
    'partagerCouvertures.a', 'partagerCouvertures.b', 'rechercherSousSuites.motifs', 'resoudreCouverture.couverture', 'resoudreElements.couverture', // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements.couverture (entrée « collection de collection de scalaire » : collision de forme acceptée)
  ]); // MISE À JOUR DÉLIBÉRÉE v0.63.44 : + rechercherSousSuites.motifs
  assert.equal(deM.some((x) => x.startsWith(`${NOM}.`)), false);
  assert.equal(t6.observation.possibilites.filter((p) => p.operation === NOM).every((p) => p.donnee !== r.execution.id), true);
  const { applications, choixAFaire } = applicationsSollicitables(t6.observation, undefined, t6.univers);
  assert.equal(applications.some((a) => a.operation === NOM), false);
  assert.equal(choixAFaire.includes(NOM), true);
  for (const a of applications) assert.equal(verifierApplicationAuCatalogue(a, DESCRIPTIONS_OPERATIONS), true);
});

// ============================================================================ D. CE QUI N'EST PAS TOUCHÉ
const sha = (f) => createHash('sha256').update(readFileSync(join(RACINE, ...f))).digest('hex');
function fichiers(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules' || nom === '.git') continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, sortie); else sortie.push(chemin);
  }
  return sortie;
}
test('D1. NON TOUCHÉS : suites-fermees.js, elements-observables.js ; la fonction ne connaît ni le catalogue ni la table et n\'importe rien ; seuls catalogue, table et module la nomment (hors tests) ; produireConstatsValeurs reste hors catalogue', () => {
  const code = (f) => readFileSync(join(RACINE, 'app', 'langage', f), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/^\s*import\b/m.test(code('projeter-contenus.js')), false);
  assert.equal(/descriptions-operations|table-operations|DESCRIPTIONS_OPERATIONS|TABLE_OPERATIONS|couverture|occurrences|chemin|\.sort\(|\.filter\(|\.map\(|\.slice\(|\.concat\(|\.join\(/.test(code('projeter-contenus.js')), false);
  assert.equal(/projeterContenus|projeter-contenus/.test(code('suites-fermees.js') + code('elements-observables.js')), false);
  // MISE À JOUR DÉLIBÉRÉE v0.63.44 (refus du robot) : ETAT.md est le journal écrit par le robot, qui cite les noms des livraisons passées ; ce n'est pas du code. Seul ce fichier est exclu du balayage.
  const nommant = fichiers(RACINE).filter((f) => !f.includes(`${join(RACINE, 'tests')}`) && !f.endsWith('.zip') && !f.endsWith(join(RACINE, 'ETAT.md')) && /projeterContenus|projeter-contenus/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(nommant.map((f) => f.slice(RACINE.length + 1)).sort(), ['app/langage/descriptions-operations.js', 'app/langage/projeter-contenus.js', 'app/langage/table-operations.js'].sort());
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => /ConstatsValeurs/.test(d.nom)), false);
  assert.equal(produireSuitesFermees.length, 1);
});
test('D2. dormance : aucun chemin actif n\'atteint projeterContenus (ni main.js, ni le pont, ni l\'interface, ni sw/worker/index) ; seule la table, via l\'invocation, la rencontre', () => {
  for (const f of [['app', 'main.js'], ['app', 'langage', 'pont.js'], ['app', 'langage', 'ecran.js'], ['index.html'], ['sw.js'], ['worker.js']]) {
    assert.equal(/projeterContenus|projeter-contenus/.test(readFileSync(join(RACINE, ...f), 'utf8')), false, f.join('/'));
  }
});
// === FIN_TEST_PROJETER_CONTENUS ===
