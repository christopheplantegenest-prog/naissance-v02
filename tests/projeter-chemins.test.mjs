// === DEBUT_TEST_PROJETER_CHEMINS ===
// v0.63.45 — projeterChemins (B3) : projection MÉCANIQUE des chemins, jumelle de projeterContenus (décision ChatGPT, 06/10/2026, après le diagnostic « situation et nouveauté »).
// Preuves : le contrat de la fonction pure ; le descripteur et la table ; la chaîne réelle A,B -> P ; A,B,C -> P' ; H = projeterChemins(P), H' = projeterChemins(P') ; la primitive EXISTANTE
// partagerCouvertures(H', H) (nouveauté par IDENTITÉ : [C], A2, plusieurs ajouts [C,D]) ; la distinction valeur / identité (projeterContenus ≠ projeterChemins) ; les ambiguïtés et les
// compatibilités créées (acceptées, non corrigées) ; ce qui n'est PAS touché. Aucune notion de nouveauté, de contexte ou de dernier n'est dans le code : ici seul le TEST compose les primitives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { validerDescripteurOperation as valider } from '../app/langage/formes-operation.js';
import { fournieGarantitAttendue } from '../app/langage/garantie-forme.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { projeterChemins } from '../app/langage/projeter-chemins.js';
import { projeterContenus } from '../app/langage/projeter-contenus.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';
import { partagerCouvertures } from '../app/langage/partition-couvertures.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { verifierApplicationAuCatalogue } from '../app/langage/conformite-application.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const NOM = 'projeterChemins';
const DESCRIPTION = DESCRIPTIONS_OPERATIONS.find((d) => d.nom === NOM);
const liste = (texte) => symbolesDeChaine(texte);
const CS = { forme: 'collection', elements: { forme: 'scalaire' } };

// ============================================================================ A. LA FONCTION PURE
test('A1. contrat : pour chaque élément, dans l\'ordre, EXACTEMENT son `chemin` (même référence, aucune copie) ; champs en plus tolérés et ignorés', () => {
  const a = ['x'];
  const b = ['y', 'z'];
  const entree = [{ chemin: a, contenu: ['q'], couverture: [['E']], occurrences: [] }, { chemin: b }];
  const sortie = projeterChemins(entree);
  assert.equal(sortie.length, 2);
  assert.equal(sortie[0], a);
  assert.equal(sortie[1], b);
  assert.deepEqual(entree, [{ chemin: ['x'], contenu: ['q'], couverture: [['E']], occurrences: [] }, { chemin: ['y', 'z'] }]); // entrée intacte
  assert.equal(projeterChemins.length, 1);
});
test('A2. AUCUN autre traitement : pas de tri, de filtre, de dédoublonnage ; les doublons restent des doublons ; un chemin vide reste vide ; scalaires de tout genre', () => {
  const entree = [{ chemin: ['b', 'a'] }, { chemin: [] }, { chemin: ['b', 'a'] }, { chemin: ['a'] }, { chemin: [] }];
  assert.deepEqual(projeterChemins(entree), [['b', 'a'], [], ['b', 'a'], ['a'], []]);
  assert.deepEqual(projeterChemins([]), []);
  assert.deepEqual(projeterChemins([{ chemin: [1, true, 'x', 0, false, ''] }]), [[1, true, 'x', 0, false, '']]);
  assert.deepEqual(projeterChemins([{ chemin: ['a', 'bc'] }, { chemin: ['ab', 'c'] }]), [['a', 'bc'], ['ab', 'c']]); // listes, jamais chaînes concaténées
});
test('A3. la fonction ne lit JAMAIS `contenu` (ni couverture, ni occurrences) : des accesseurs sur ces champs ne sont jamais exécutés ; `contenu` absent ou invalide est sans effet', () => {
  let lus = 0;
  const element = { chemin: ['a'] };
  for (const cle of ['contenu', 'couverture', 'occurrences']) Object.defineProperty(element, cle, { enumerable: true, get() { lus += 1; return 'invalide'; } });
  assert.deepEqual(projeterChemins([element]), [['a']]);
  assert.equal(lus, 0);
  assert.deepEqual(projeterChemins([{ chemin: ['a'], contenu: 'pas une collection' }, { chemin: ['b'], contenu: null }]), [['a'], ['b']]);
});
test('A4. refus (TypeError, aucun résultat partiel) : entrée non tableau, tableau creux ou à accesseur, élément non objet, chemin absent / hérité / accesseur / non collection / creux / non scalaire ; unicité des chemins NON exigée', () => {
  const refus = (valeur) => assert.throws(() => projeterChemins(valeur), TypeError);
  for (const v of [undefined, null, 'abc', 12, { chemin: [] }]) refus(v);
  refus(new Array(2));
  const acc = [{ chemin: [] }];
  Object.defineProperty(acc, 0, { get() { throw new Error('exécuté'); }, enumerable: true });
  refus(acc);
  for (const e of [null, undefined, 'x', 3, [], [['a']]]) refus([e]);
  refus([{}]);
  refus([{ contenu: ['a'] }]); // un `contenu` seul ne suffit pas
  refus([Object.create({ chemin: ['a'] })]); // propriété héritée ignorée
  const accChemin = {};
  Object.defineProperty(accChemin, 'chemin', { get() { throw new Error('exécuté'); }, enumerable: true });
  refus([accChemin]);
  for (const c of [null, 'abc', 5, { 0: 'a', length: 1 }]) refus([{ chemin: c }]);
  refus([{ chemin: new Array(2) }]);
  const accSymbole = ['a'];
  Object.defineProperty(accSymbole, 0, { get() { throw new Error('exécuté'); }, enumerable: true });
  refus([{ chemin: accSymbole }]);
  for (const s of [null, undefined, {}, ['a'], () => 1, Symbol('x')]) refus([{ chemin: ['a', s] }]);
  refus([{ chemin: ['a'] }, { chemin: 'refusé en second' }]); // aucun résultat partiel
  assert.deepEqual(projeterChemins([{ chemin: ['a'] }, { chemin: ['a'] }]), [['a'], ['a']]); // chemins identiques acceptés
});

// ============================================================================ B. CATALOGUE ET TABLE
test('B1. descripteur EXACT : entrée unique `elements` { chemin : collection de scalaire } SANS `contenu` ni genre ; sortie collection de collections de scalaire ; aucune entrée collective', () => {
  assert.deepEqual(DESCRIPTION, {
    nom: NOM,
    entrees: { elements: { forme: 'collection', elements: { forme: 'objet', champs: { chemin: CS } } } },
    sortie: { forme: 'collection', elements: CS },
  });
  assert.equal(JSON.stringify(DESCRIPTION).includes('collectif'), false);
  assert.equal(JSON.stringify(DESCRIPTION).includes('genre'), false);
  assert.equal(JSON.stringify(DESCRIPTION).includes('contenu'), false);
  assert.doesNotThrow(() => valider(DESCRIPTION));
});
test('B2. table : appel positionnel, un seul paramètre « elements », la fonction réelle ; catalogue et table comptent SEIZE entrées (quinze à v0.63.45) au même ordre de noms', () => {
  assert.deepEqual({ appel: TABLE_OPERATIONS[NOM].appel, parametres: [...TABLE_OPERATIONS[NOM].parametres] }, { appel: 'positionnel', parametres: ['elements'] });
  assert.equal(TABLE_OPERATIONS[NOM].fonction, projeterChemins);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.deepEqual(Object.keys(TABLE_OPERATIONS), DESCRIPTIONS_OPERATIONS.map((d) => d.nom));
  const noms = DESCRIPTIONS_OPERATIONS.map((d) => d.nom);
  assert.equal(noms[noms.indexOf(NOM) - 1], 'produireSuitesFermees');
  assert.equal(noms[noms.indexOf(NOM) + 1], 'projeterContenus');
});
test('B3. COMPATIBILITÉS créées par la SORTIE (acceptées, jamais corrigées) : exactement neuf entrées, les mêmes que la sortie de projeterContenus ; ni projeterChemins, ni projeterContenus, ni produireSuitesFermees, ni elementsObservables', () => {
  const sortie = valider(DESCRIPTION).sortie;
  const garanties = [];
  for (const d of DESCRIPTIONS_OPERATIONS) for (const [entree, forme] of Object.entries(valider(d).entrees)) if (fournieGarantitAttendue(sortie, forme)) garanties.push(`${d.nom}.${entree}`);
  assert.deepEqual(garanties.sort(), [
    'couvrirSequence.elements', 'memesCouvertures.a', 'memesCouvertures.b', 'normaliserCouverture.chemins', 'parcourirStructure.valeur',
    'partagerCouvertures.a', 'partagerCouvertures.b', 'rechercherSousSuites.motifs', 'resoudreCouverture.couverture', 'resoudreElements.couverture', // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements.couverture (entrée « collection de collection de scalaire » : collision de forme acceptée)
  ]);
  const contenus = valider(DESCRIPTIONS_OPERATIONS.find((d) => d.nom === 'projeterContenus')).sortie;
  assert.deepEqual(contenus, sortie); // même forme déclarée : la collision avec les contenus / couvertures / M est ACCEPTÉE
  for (const op of [NOM, 'projeterContenus', 'produireSuitesFermees', 'elementsObservables']) assert.equal(fournieGarantitAttendue(sortie, valider(DESCRIPTIONS_OPERATIONS.find((d) => d.nom === op)).entrees.elements), false, op);
});
test('B4. COMPATIBILITÉS créées par l\'ENTRÉE : garantie par les sorties de elementsObservables (P), parcourirStructure et resoudreCouverture ; PAS par produireSuitesFermees (S), ni rechercherSousSuites (R), ni projeterContenus', () => {
  const entree = valider(DESCRIPTION).entrees.elements;
  const garantissent = DESCRIPTIONS_OPERATIONS.filter((d) => fournieGarantitAttendue(valider(d).sortie, entree)).map((d) => d.nom).sort();
  assert.deepEqual(garantissent, ['elementsObservables', 'parcourirStructure', 'resoudreCouverture', 'resoudreElements']); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements (sa sortie {chemin, contenu} porte un `chemin` collection de scalaire ; aucune boucle vers projeterChemins n'est créée par cette ligne : la sortie de H ne garantit pas resoudreElements.elements)
});

// ============================================================================ C. LA CHAÎNE RÉELLE : A,B -> P ; A,B,C -> P' ; H, H' ; partagerCouvertures
function monde() {
  const magasin = magasinMemoireVive();
  let n = 0;
  async function tour(texte) {
    let k = (n += 1) * 100;
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    const r = await observerPossibilites(message, {
      enregistrer: (d) => enregistrerObservationPossibilites(magasin, d),
      lireExecutions: () => magasin.lireTout('executionsOperations'),
    });
    assert.equal(r.statut, 'ecrite');
    return { message, observation: r.observation, univers: r.univers };
  }
  // application déterminée (operation seule) ou désignation explicite (liaisons)
  async function lancer(texteTour, operation, liaisons) {
    const t = await tour(texteTour);
    const application = liaisons ? { operation, liaisons } : applicationsSollicitables(t.observation, undefined, t.univers).applications.find((a) => a.operation === operation);
    assert.ok(application, `${operation} : application attendue`);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
    assert.equal(r.statut, 'executee', `${operation} : ${r.erreur && r.erreur.message}`);
    return { ...r, t };
  }
  return { magasin, tour, lancer };
}
const TEXTES = { A: 'bonjour Pixel', B: 'salut Pixel', C: 'bonsoir Pixel', D: 'bonne nuit' };
async function construire() {
  const w = monde();
  const A = await w.lancer(TEXTES.A, 'symbolesDeChaine');
  const B = await w.lancer(TEXTES.B, 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const C = await w.lancer(TEXTES.C, 'symbolesDeChaine');
  const Pp = await w.lancer("tour P'", 'elementsObservables');
  const id = { A: A.execution.id, B: B.execution.id, C: C.execution.id, P: P.execution.id, Pp: Pp.execution.id };
  const H = await w.lancer('tour H', NOM, [{ entree: 'elements', donnee: id.P }]);
  const Hp = await w.lancer("tour H'", NOM, [{ entree: 'elements', donnee: id.Pp }]);
  return { w, A, B, C, P, Pp, H, Hp, id };
}
const comparer = (w, idA, idB, tour) => w.lancer(tour, 'partagerCouvertures', [{ entree: 'a', donnee: idA }, { entree: 'b', donnee: idB }]);

test('C1. P = [A,B] puis P\' = [A,B,C] : H = [[A],[B]], H\' = [[A],[B],[C]] (les identités de production, dans l\'ordre de P / P\')', async () => {
  const { P, Pp, H, Hp, id } = await construire();
  assert.deepEqual(P.execution.resultat.map((e) => e.chemin), [[id.A], [id.B]]);
  assert.deepEqual(Pp.execution.resultat.map((e) => e.chemin), [[id.A], [id.B], [id.C]]);
  assert.deepEqual(H.execution.resultat, [[id.A], [id.B]]);
  assert.deepEqual(Hp.execution.resultat, [[id.A], [id.B], [id.C]]);
  for (const x of [H, Hp]) assert.deepEqual(Object.keys(x.execution).sort(), ['horodatage', 'id', 'idDesignation', 'liaisons', 'operation', 'resultat']);
});
test('C2. PREUVE P/P\' → [C] : partagerCouvertures(H\', H) EXISTANTE donne communs [A,B], seulementA [C], seulementB [] ; aucune nouveauté dans le code, seulement la composition de deux primitives', async () => {
  const { w, H, Hp, id } = await construire();
  const r = await comparer(w, Hp.execution.id, H.execution.id, 'tour comparaison');
  assert.deepEqual(r.execution.resultat, { communs: [[id.A], [id.B]], seulementA: [[id.C]], seulementB: [] });
  assert.deepEqual(r.execution.resultat, partagerCouvertures(Hp.execution.resultat, H.execution.resultat)); // identique à l'appel direct
});
test('C3. PROVENANCE ordinaire : H -> P -> [A,B] ; H\' -> P\' -> [A,B,C] ; la comparaison -> H\', H ; aucun mécanisme spécial', async () => {
  const { w, H, Hp, id } = await construire();
  const r = await comparer(w, Hp.execution.id, H.execution.id, 'tour comparaison');
  const lignes = new Map((await w.magasin.lireTout('executionsOperations')).map((l) => [l.id, l]));
  assert.deepEqual(lignes.get(H.execution.id).liaisons, [{ entree: 'elements', donnee: id.P }]);
  assert.deepEqual(lignes.get(Hp.execution.id).liaisons, [{ entree: 'elements', donnee: id.Pp }]);
  assert.deepEqual(lignes.get(id.P).liaisons, [{ entree: 'elements', donnees: [id.A, id.B] }]);
  assert.deepEqual(lignes.get(id.Pp).liaisons, [{ entree: 'elements', donnees: [id.A, id.B, id.C] }]);
  assert.deepEqual(lignes.get(r.execution.id).liaisons, [{ entree: 'a', donnee: Hp.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  const designation = (await w.magasin.lireTout('designations')).find((d) => d.id === lignes.get(H.execution.id).idDesignation);
  assert.equal(designation.origine, 'exterieure');
});
test('C4. A2 : identité différente de A, valeur identique : P\'\' = [A,B,C,A2] contre P\' → seulementA = [A2] PAR IDENTITÉ ; la différence ne dépend jamais du contenu', async () => {
  const { w, Hp, Pp, id } = await construire();
  const A2 = await w.lancer(TEXTES.A, 'symbolesDeChaine');
  const Ppp = await w.lancer("tour P''", 'elementsObservables');
  const idA2 = A2.execution.id;
  assert.notEqual(idA2, id.A);
  assert.deepEqual(A2.execution.resultat, (await w.magasin.lireTout('executionsOperations')).find((l) => l.id === id.A).resultat); // même valeur
  assert.deepEqual(Ppp.execution.resultat.map((e) => e.chemin), [[id.A], [id.B], [id.C], [idA2]]);
  const Hpp = await w.lancer("tour H''", NOM, [{ entree: 'elements', donnee: Ppp.execution.id }]);
  const r = await comparer(w, Hpp.execution.id, Hp.execution.id, 'tour comparaison A2');
  assert.deepEqual(r.execution.resultat, { communs: [[id.A], [id.B], [id.C]], seulementA: [[idA2]], seulementB: [] });
  assert.equal(Pp.execution.resultat.length, 3);
});
test('C5. PLUSIEURS AJOUTS : [A,B,C,D] contre [A,B] → seulementA = [C,D], sans « dernier » ; l\'ordre de P de l\'ensemble ajouté n\'est qu\'un ordre de lecture', async () => {
  const { w, H, id } = await construire();
  const D = await w.lancer(TEXTES.D, 'symbolesDeChaine');
  const P3 = await w.lancer('tour P3', 'elementsObservables');
  assert.deepEqual(P3.execution.resultat.map((e) => e.chemin), [[id.A], [id.B], [id.C], [D.execution.id]]);
  const H3 = await w.lancer('tour H3', NOM, [{ entree: 'elements', donnee: P3.execution.id }]);
  const r = await comparer(w, H3.execution.id, H.execution.id, 'tour comparaison C,D');
  assert.deepEqual(r.execution.resultat, { communs: [[id.A], [id.B]], seulementA: [[id.C], [D.execution.id]], seulementB: [] });
});
test('C6. VALEUR / IDENTITÉ figées : sur le cas A/A2, la comparaison par VALEUR (projeterContenus) ne distingue pas A et A2, celle par IDENTITÉ (projeterChemins) les garde distincts ; les deux opérations ne fusionnent jamais', async () => {
  const { w, Pp, id } = await construire();
  const A2 = await w.lancer(TEXTES.A, 'symbolesDeChaine');
  const Ppp = await w.lancer("tour P''", 'elementsObservables');
  // Par VALEUR, A et A2 sont indiscernables : la primitive existante refuse même la couverture de P'' (deux contenus égaux = doublon refusé) ; il n'y a donc AUCUNE nouveauté par valeur à lire.
  assert.throws(() => partagerCouvertures(projeterContenus(Ppp.execution.resultat), projeterContenus(Pp.execution.resultat)), /doublon/);
  const parValeur = partagerCouvertures(projeterContenus(Pp.execution.resultat), projeterContenus(Pp.execution.resultat.slice(0, 2)));
  assert.deepEqual(parValeur, { communs: [liste(TEXTES.A), liste(TEXTES.B)], seulementA: [liste(TEXTES.C)], seulementB: [] }); // ce sont des VALEURS (listes de symboles), jamais des identités
  const parIdentite = partagerCouvertures(projeterChemins(Ppp.execution.resultat), projeterChemins(Pp.execution.resultat));
  assert.deepEqual(parIdentite.seulementA, [[A2.execution.id]]); // mais A2 est NOUVEAU par identité
  assert.notDeepEqual(projeterChemins(Ppp.execution.resultat), projeterContenus(Ppp.execution.resultat));
  assert.equal(JSON.stringify(projeterChemins(Ppp.execution.resultat)).includes('Pixel'), false); // aucune valeur dans les chemins
  assert.equal(JSON.stringify(projeterContenus(Ppp.execution.resultat)).includes(id.A), false); // aucune identité dans les contenus
  assert.notEqual(TABLE_OPERATIONS.projeterChemins.fonction, TABLE_OPERATIONS.projeterContenus.fonction);
});
test('C7. AMBIGUÏTÉS : avec P et P\' présentes, projeterChemins.elements a DEUX candidats (P, P\') ; projeterContenus.elements les mêmes ; aucune application déterminée, « choix à faire » pour les deux, aucune sélection automatique ; seule la désignation explicite exécute', async () => {
  const w = monde();
  await w.lancer(TEXTES.A, 'symbolesDeChaine');
  await w.lancer(TEXTES.B, 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  await w.lancer(TEXTES.C, 'symbolesDeChaine');
  const Pp = await w.lancer("tour P'", 'elementsObservables');
  const t = await w.tour('tour observation');
  for (const op of [NOM, 'projeterContenus']) {
    const candidats = t.observation.possibilites.filter((p) => p.operation === op && p.entree === 'elements').map((p) => p.donnee).sort();
    assert.deepEqual(candidats.filter((d) => [P.execution.id, Pp.execution.id].includes(d)), [P.execution.id, Pp.execution.id].sort(), op);
  }
  const { applications, choixAFaire } = applicationsSollicitables(t.observation, undefined, t.univers);
  assert.equal(applications.some((a) => a.operation === NOM || a.operation === 'projeterContenus'), false);
  assert.equal(choixAFaire.includes(NOM), true);
  assert.equal(choixAFaire.includes('projeterContenus'), true);
  for (const a of applications) assert.equal(verifierApplicationAuCatalogue(a, DESCRIPTIONS_OPERATIONS), true);
  const avant = (await w.magasin.lireTout('executionsOperations')).length;
  assert.equal(avant, 5); // A, B, P, C, P' : rien n'a été exécuté en plus
});
test('C8. TOUR SUIVANT après H : les compatibilités de la sortie (neuf entrées, acceptées) apparaissent comme possibilités ; aucune boucle vers projeterChemins, projeterContenus, produireSuitesFermees ni elementsObservables', async () => {
  const { w, H } = await construire();
  const t = await w.tour('tour suivant');
  const deH = t.observation.possibilites.filter((p) => p.donnee === H.execution.id).map((p) => `${p.operation}.${p.entree}`).sort();
  assert.deepEqual(deH, [
    'couvrirSequence.elements', 'memesCouvertures.a', 'memesCouvertures.b', 'normaliserCouverture.chemins', 'parcourirStructure.valeur',
    'partagerCouvertures.a', 'partagerCouvertures.b', 'rechercherSousSuites.motifs', 'resoudreCouverture.couverture', 'resoudreElements.couverture', // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements.couverture (entrée « collection de collection de scalaire » : collision de forme acceptée)
  ]);
  for (const op of [NOM, 'projeterContenus', 'produireSuitesFermees', 'elementsObservables']) assert.equal(deH.some((x) => x.startsWith(`${op}.`)), false, op);
});

// ============================================================================ D. CE QUI N'EST PAS TOUCHÉ
function fichiers(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    if (nom === 'node_modules' || nom === '.git') continue;
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) fichiers(chemin, sortie); else sortie.push(chemin);
  }
  return sortie;
}
test('D1. NON TOUCHÉS et DORMANCE : la fonction n\'importe rien, ne lit ni contenu ni couverture ni occurrences, ne trie ni ne filtre, n\'utilise ni horodatage ni magasin ; seuls catalogue, table et module la nomment (hors tests et journal du robot)', () => {
  const code = (f) => readFileSync(join(RACINE, 'app', 'langage', f), 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/^\s*import\b/m.test(code('projeter-chemins.js')), false);
  assert.equal(/descriptions-operations|table-operations|DESCRIPTIONS_OPERATIONS|TABLE_OPERATIONS|couverture|occurrences|contenu|Date|horodatage|magasin|\.sort\(|\.filter\(|\.map\(|\.slice\(|\.concat\(|\.join\(/.test(code('projeter-chemins.js')), false);
  assert.equal(/projeterChemins|projeter-chemins/.test(code('suites-fermees.js') + code('elements-observables.js') + code('projeter-contenus.js') + code('partition-couvertures.js')), false);
  // MISE À JOUR : ETAT.md est le journal écrit par le robot (il cite les noms des livraisons passées) ; ce n'est pas du code.
  const nommant = fichiers(RACINE).filter((f) => !f.includes(`${join(RACINE, 'tests')}`) && !f.endsWith('.zip') && !f.endsWith(join(RACINE, 'ETAT.md')) && /projeterChemins|projeter-chemins/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(nommant.map((f) => f.slice(RACINE.length + 1)).sort(), ['app/langage/descriptions-operations.js', 'app/langage/projeter-chemins.js', 'app/langage/table-operations.js'].sort());
  for (const f of [['app', 'main.js'], ['app', 'langage', 'pont.js'], ['app', 'langage', 'ecran.js'], ['index.html'], ['sw.js'], ['worker.js']]) {
    assert.equal(/projeterChemins|projeter-chemins/.test(readFileSync(join(RACINE, ...f), 'utf8')), false, f.join('/'));
  }
});
// === FIN_TEST_PROJETER_CHEMINS ===
