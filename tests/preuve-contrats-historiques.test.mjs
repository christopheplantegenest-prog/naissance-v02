// v0.63.53 — « VÉRIFIER LA PREUVE DES CONTRATS HISTORIQUES » (décision ChatGPT, 06/10/2026).
// resoudreContexteObservation : ligne de NOUVELLE génération (empreintesOperationsExaminees présente) => mêmes contrôles PLUS égalité exacte des
// empreintes du sous-catalogue historique ; ligne ANCIENNE (propriété absente) => garantie faible v0.63.50, inchangée. F1 seulement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { empreintesDesContrats } from '../app/langage/empreinte-contrats.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const C16 = DESCRIPTIONS_OPERATIONS;
const N_SIMPLE = { nom: 'longueurChaine', entrees: { chaine: { forme: 'scalaire', genre: 'chaine' } }, sortie: { forme: 'scalaire', genre: 'nombre' } };
const N_COLLECTIVE = {
  nom: 'nouvelleCollective',
  entrees: { elements: { forme: 'collection', collectif: true, elements: { forme: 'objet', champs: { identite: { forme: 'scalaire', genre: 'chaine' }, valeur: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } } } } } },
  sortie: { forme: 'scalaire', genre: 'nombre' },
};
const C17 = [...C16, N_SIMPLE, N_COLLECTIVE];
const modifier = (nom, f, catalogue = C16) => catalogue.map((d) => { if (d.nom !== nom) return d; const c = clone(d); f(c); return c; });
const J10 = (catalogue = C16) => modifier('partagerCouvertures', (d) => { d.sortie.champs.supplementaire = { forme: 'scalaire', genre: 'nombre', peutManquer: true }; }, catalogue);
const J10B = (catalogue = C16) => modifier('memesCouvertures', (d) => { d.entrees.c = { forme: 'scalaire', genre: 'booleen' }; }, catalogue);
const cle = (a) => JSON.stringify([a.operation, a.entree, a.donnee]);
const enAncienne = (observation) => { const { empreintesOperationsExaminees, empreintesCategoriesDonnees, empreintesContratsRelationnels, ...sans } = observation; return sans; }; // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)

function monde() {
  const magasin = magasinMemoireVive();
  let n = 0;
  async function tour(texte) {
    let k = (n += 1) * 100;
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    await enregistrerValeurDonnee(magasin, { id: message.id, valeur: message.texte });
    const r = await observerPossibilites(message, { enregistrer: (o) => enregistrerObservationPossibilites(magasin, o), lireExecutions: () => magasin.lireTout('executionsOperations') });
    assert.equal(r.statut, 'ecrite');
    return { message, observation: r.observation, univers: r.univers };
  }
  async function lancer(texteTour, operation, liaisons) {
    const t = await tour(texteTour);
    const application = liaisons ? { operation, liaisons } : applicationsSollicitables(t.observation, undefined, t.univers).applications.find((a) => a.operation === operation);
    assert.ok(application, operation);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
    assert.equal(r.statut, 'executee', `${operation} : ${r.erreur && r.erreur.message}`);
    return { ...r, t };
  }
  const lire = async () => ({ observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
  return { magasin, tour, lancer, lire };
}
// A,B -> P -> H -> Q ; puis O(Y) (nouvelle génération, écrite par le flux réel) et un tour suivant.
async function chaine() {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  const P = await w.lancer('tour P', 'elementsObservables');
  const H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: P.execution.id }]);
  const Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: H.execution.id }, { entree: 'b', donnee: H.execution.id }]);
  const Y = await w.tour('message Y');
  await w.tour('suivant');
  const l = await w.lire();
  const O = l.observations.find((o) => o.id === Y.observation.id);
  assert.ok('empreintesOperationsExaminees' in O, 'O(Y) est de NOUVELLE génération');
  return { w, A, B, P, H, Q, Y, l, O };
}
const lire = (c, descriptions, observation = c.O) => resoudreContexteObservation(observation.id, c.l.observations.map((o) => (o.id === observation.id ? observation : o)), c.l.valeurs, c.l.executions, descriptions);
const refusMessage = (f) => { try { f(); } catch (e) { assert.ok(e instanceof TypeError, 'TypeError attendu'); return e.message; } assert.fail('refus attendu'); };
const avecPreuve = (c, preuve) => ({ ...c.O, empreintesOperationsExaminees: preuve });

// ============================================================================ A. C16 ORIGINAL ET AJOUT PUR
test('A1. C16 original : contexte rendu pour une ligne nouvelle ; même référence ; la preuve persistée == empreintesDesContrats du sous-catalogue historique', async () => {
  const c = await chaine();
  const r = lire(c, C16);
  assert.equal(r.observation, c.O);
  assert.deepEqual(c.O.empreintesOperationsExaminees, empreintesDesContrats(C16));
  assert.equal(c.O.empreintesOperationsExaminees.length, 16);
});
test('A2. AJOUT PUR C17 = C16 + N (simple et collective) : O rendue, même référence, même univers, 16 empreintes historiques vérifiées, N ignorée, aucune possibilité de N', async () => {
  const c = await chaine();
  const avant = JSON.stringify(c.O);
  const sous16 = lire(c, C16); const sous17 = lire(c, C17);
  assert.equal(sous17.observation, c.O);
  assert.deepEqual(sous17.univers, sous16.univers);
  assert.equal(JSON.stringify(c.O), avant, 'O inchangée');
  assert.equal(c.O.empreintesOperationsExaminees.length, 16);
  assert.equal(empreintesDesContrats(C17).length, 18);
  assert.deepEqual(empreintesDesContrats(C17).filter((p) => c.O.operationsExaminees.includes(p.operation)), c.O.empreintesOperationsExaminees, 'les 16 empreintes historiques sont celles de C17 pour ces noms');
  assert.equal(c.O.empreintesOperationsExaminees.some((p) => p.operation === 'longueurChaine' || p.operation === 'nouvelleCollective'), false);
  assert.equal(sous17.observation.possibilites.some((p) => p.operation === 'longueurChaine' || p.operation === 'nouvelleCollective'), false);
  assert.equal(JSON.stringify(c.O.empreintesOperationsExaminees), JSON.stringify(empreintesDesContrats(C16)), 'la preuve est celle de C16, seule');
});
test('A3. la vérification est réellement active sous C17 : un contrat historique dérivé DANS C17 est refusé (et l\'ajout seul ne l\'est pas)', async () => {
  const c = await chaine();
  assert.doesNotThrow(() => lire(c, C17));
  assert.throws(() => lire(c, J10(C17)), TypeError);
  assert.throws(() => lire(c, J10B(C17)), TypeError);
});

// ============================================================================ B. J10 : REFUS EFFECTIF, PAR LA PREUVE
test('B1. J10 (sortie productrice modifiée, atomes identiques) : REFUSÉ par différence d\'empreinte ; atomes identiques ; v0.63.50 (ligne ancienne) rend ce contexte', async () => {
  const c = await chaine();
  const derive = J10();
  const message = refusMessage(() => lire(c, derive));
  assert.match(message, /contrat mécanique/);
  assert.match(message, /\[partagerCouvertures\]/, 'seule l\'opération dérivée est nommée');
  // le refus ne vient PAS des atomes : mêmes atomes recalculés avec les deux catalogues
  const univers = lire(c, C16).univers; const donnees = univers.map((e) => e.donnee);
  assert.deepEqual(new Set(possibilitesDeLiaison(donnees, derive).map(cle)), new Set(c.O.possibilites.map(cle)), 'atomes recalculés sous le catalogue dérivé == persistés');
  // la ligne ancienne (sans preuve) est rendue : le régime v0.63.50 ne voit pas la dérive
  assert.doesNotThrow(() => lire(c, derive, enAncienne(c.O)));
  // et une ligne dont la preuve est celle du catalogue dérivé est rendue : seule la preuve distingue
  assert.doesNotThrow(() => lire(c, derive, avecPreuve(c, empreintesDesContrats(derive))));
});

// ============================================================================ C. J10b : REFUS EFFECTIF, PAR LA PREUVE (TEST CENTRAL DE F1)
test('C1. J10b (entrée insatisfiable ajoutée, atomes identiques) : REFUSÉ par différence d\'empreinte avant que le nouveau choixAFaire puisse passer pour fidèle', async () => {
  const c = await chaine();
  const derive = J10B();
  const message = refusMessage(() => lire(c, derive));
  assert.match(message, /contrat mécanique/);
  assert.match(message, /\[memesCouvertures\]/);
  const donnees = lire(c, C16).univers.map((e) => e.donnee);
  assert.deepEqual(possibilitesDeLiaison(donnees, derive).filter((p) => p.operation === 'memesCouvertures').map(cle), c.O.possibilites.filter((p) => p.operation === 'memesCouvertures').map(cle), 'atomes identiques');
  assert.deepEqual(new Set(possibilitesDeLiaison(donnees, derive).map(cle)), new Set(c.O.possibilites.map(cle)));
  // l'ambiguïté historique, elle, serait faussée par ce catalogue : la ligne ancienne la verrait disparaître sans le savoir
  assert.equal(applicationsSollicitables(c.O, C16, lire(c, C16).univers).choixAFaire.includes('memesCouvertures'), true);
  assert.equal(applicationsSollicitables(c.O, derive, lire(c, C16).univers).choixAFaire.includes('memesCouvertures'), false);
  assert.doesNotThrow(() => lire(c, derive, enAncienne(c.O)), 'garantie faible : rendu');
  assert.doesNotThrow(() => lire(c, derive, avecPreuve(c, empreintesDesContrats(derive))), 'seule la preuve distingue');
});
test('C2. toute autre dérive de contrat d\'une opération examinée est refusée sur une ligne nouvelle : renommage (via retrait), entrée modifiée, collectif ajouté, champ de sortie rendu optionnel', async () => {
  const c = await chaine();
  const refuses = [
    modifier('symbolesDeChaine', (d) => { d.entrees.chaine = { forme: 'scalaire', genre: 'nombre' }; }),
    modifier('symbolesDeChaine', (d) => { d.entrees.chaine.omissible = true; }),
    modifier('partagerCouvertures', (d) => { d.sortie.champs.communs.peutManquer = true; }),
    modifier('elementsObservables', (d) => { d.sortie = { forme: 'scalaire', genre: 'chaine' }; }),
    C16.map((d) => (d.nom === 'symbolesDeChaine' ? { ...clone(d), nom: 'symbolesRenommes' } : d)),
    C16.filter((d) => d.nom !== 'symbolesDeChaine'),
  ];
  for (const derive of refuses) assert.throws(() => lire(c, derive), TypeError);
});

// ============================================================================ D. ANCIENNE GÉNÉRATION : GARANTIE FAIBLE INCHANGÉE
test('D1. ligne ANCIENNE (six clés, sans preuve) : rendue sous C16 et sous C17 exactement comme une ligne nouvelle (même univers) ; aucune empreinte inventée ; la ligne n\'est pas modifiée', async () => {
  const c = await chaine();
  const ancienne = enAncienne(c.O);
  const avant = JSON.stringify(ancienne);
  assert.equal('empreintesOperationsExaminees' in ancienne, false);
  for (const catalogue of [C16, C17]) {
    const r = lire(c, catalogue, ancienne);
    assert.equal(r.observation, ancienne);
    assert.deepEqual(r.univers, lire(c, catalogue).univers);
  }
  assert.equal(JSON.stringify(ancienne), avant);
  assert.equal('empreintesOperationsExaminees' in ancienne, false, 'aucune empreinte ajoutée par la lecture');
});
test('D2. ligne ANCIENNE : dérives neutres J10 et J10b TOUJOURS rendues (volontaire, garantie faible) ; dérives visibles toujours refusées (retrait, renommage, modification qui change les atomes)', async () => {
  const c = await chaine();
  const ancienne = enAncienne(c.O);
  assert.doesNotThrow(() => lire(c, J10(), ancienne));
  assert.doesNotThrow(() => lire(c, J10B(), ancienne));
  assert.throws(() => lire(c, C16.filter((d) => d.nom !== 'symbolesDeChaine'), ancienne), TypeError);
  assert.throws(() => lire(c, C16.map((d) => (d.nom === 'symbolesDeChaine' ? { ...clone(d), nom: 'symbolesRenommes' } : d)), ancienne), TypeError);
  assert.throws(() => lire(c, modifier('symbolesDeChaine', (d) => { d.entrees.chaine = { forme: 'scalaire', genre: 'nombre' }; }), ancienne), TypeError);
});
test('D3. deux générations dans le MÊME magasin : chacune garde sa garantie sous le même catalogue dérivé (nouvelle refusée, ancienne rendue)', async () => {
  const c = await chaine();
  const ancienne = { ...enAncienne(c.O), id: 'observation-ancienne-1' };
  const lignes = [...c.l.observations, ancienne];
  const via = (id, catalogue) => resoudreContexteObservation(id, lignes, c.l.valeurs, c.l.executions, catalogue);
  assert.throws(() => via(c.O.id, J10B()), TypeError);
  assert.doesNotThrow(() => via('observation-ancienne-1', J10B()));
});

// ============================================================================ E. PREUVE MALFORMÉE : PRÉSENT + INVALIDE = REFUS, JAMAIS DE REPLI
test('E1. preuve présente mais invalide : TypeError dans TOUS les cas, sous le catalogue d\'origine (qui rendrait la ligne ancienne) — aucun repli vers le régime ancien', async () => {
  const c = await chaine();
  const bonne = c.O.empreintesOperationsExaminees;
  const H = (x) => x.repeat(64);
  const creux = [...bonne]; delete creux[3];
  const accesseurRang = [...bonne]; Object.defineProperty(accesseurRang, 2, { enumerable: true, get() { return bonne[2]; } });
  const accesseurChamp = bonne.map((p) => ({ ...p })); Object.defineProperty(accesseurChamp[1], 'empreinte', { enumerable: true, get() { return bonne[1].empreinte; } });
  const echange = [...bonne]; [echange[0], echange[1]] = [echange[1], echange[0]];
  const cas = {
    nonTableau: 'x', objet: {}, nul: null, nombre: 3, indefini: undefined, vide: [],
    creux, accesseurRang, accesseurChamp,
    paireNonObjet: [...bonne.slice(0, 15), 'x'], paireNulle: [...bonne.slice(0, 15), null], paireTableau: [...bonne.slice(0, 15), []],
    cleManquante: [...bonne.slice(0, 15), { operation: bonne[15].operation }],
    cleEtrangere: [...bonne.slice(0, 15), { ...bonne[15], extra: 1 }],
    operationVide: [...bonne.slice(0, 15), { ...bonne[15], operation: '' }],
    operationNonChaine: [...bonne.slice(0, 15), { ...bonne[15], operation: 7 }],
    empreinteMajuscule: [...bonne.slice(0, 15), { ...bonne[15], empreinte: H('A') }],
    empreinteCourte: [...bonne.slice(0, 15), { ...bonne[15], empreinte: bonne[15].empreinte.slice(1) }],
    empreinteLongue: [...bonne.slice(0, 15), { ...bonne[15], empreinte: `${bonne[15].empreinte}0` }],
    empreinteNonHex: [...bonne.slice(0, 15), { ...bonne[15], empreinte: H('g') }],
    empreinteNonChaine: [...bonne.slice(0, 15), { ...bonne[15], empreinte: 12 }],
    doublon: [...bonne.slice(0, 15), bonne[14]],
    mauvaisTri: echange,
    operationManquante: bonne.slice(0, 15),
    operationSupplementaire: [...bonne, { operation: 'zzzSupplementaire', empreinte: H('1') }],
    nomDifferent: [...bonne.slice(0, 15), { operation: 'zzzInconnue', empreinte: bonne[15].empreinte }],
    empreinteFausse: [{ ...bonne[0], empreinte: H('0') }, ...bonne.slice(1)],
  };
  for (const [nom, preuve] of Object.entries(cas)) {
    const ligne = { ...c.O, empreintesOperationsExaminees: preuve };
    assert.throws(() => lire(c, C16, ligne), TypeError, nom);
    assert.doesNotThrow(() => lire(c, C16, enAncienne(c.O)), 'contrôle : sans le champ, la même ligne est rendue');
  }
});
test('E2. la propriété « présente » est une existence, pas une valeur : { empreintesOperationsExaminees: undefined } est PRÉSENTE donc refusée ; un accesseur sur la propriété elle-même est refusé', async () => {
  const c = await chaine();
  assert.throws(() => lire(c, C16, { ...c.O, empreintesOperationsExaminees: undefined }), TypeError);
  const acc = enAncienne(c.O);
  Object.defineProperty(acc, 'empreintesOperationsExaminees', { enumerable: true, get() { return c.O.empreintesOperationsExaminees; } });
  assert.throws(() => lire(c, C16, acc), TypeError);
});
test('E3. clés closes : une autre clé étrangère reste refusée, avec ou sans preuve', async () => {
  const c = await chaine();
  assert.throws(() => lire(c, C16, { ...c.O, extra: 1 }), TypeError);
  assert.throws(() => lire(c, C16, { ...enAncienne(c.O), extra: 1 }), TypeError);
  assert.throws(() => lire(c, C16, { ...enAncienne(c.O), empreinte: 'x' }), TypeError);
});

// ============================================================================ F. ORDRE DES CONTRÔLES
test('F1. la preuve persistée est validée AVANT toute reconstruction : une ligne à preuve invalide ET à donnée non résoluble est refusée pour sa PREUVE ; une preuve valide mais fausse est refusée pour son contrat avant l\'univers', async () => {
  const c = await chaine();
  const bonne = c.O.empreintesOperationsExaminees;
  const sansDonnee = (ligne) => resoudreContexteObservation(ligne.id, [ligne], [], [], C16); // aucune valeur ni exécution : les données sont non résolubles
  const invalide = { ...c.O, empreintesOperationsExaminees: bonne.slice(0, 15) };
  assert.match(refusMessage(() => sansDonnee(invalide)), /empreintesOperationsExaminees/);
  const fausse = { ...c.O, empreintesOperationsExaminees: [{ ...bonne[0], empreinte: '0'.repeat(64) }, ...bonne.slice(1)] };
  assert.match(refusMessage(() => sansDonnee(fausse)), /contrat mécanique/);
  assert.match(refusMessage(() => sansDonnee(enAncienne(c.O))), /non résoluble/, 'la ligne ancienne, elle, échoue plus tard (garantie faible, ordre v0.63.50)');
});
test('F2. opération examinée absente du catalogue fourni : refus (inchangé) — avant le calcul de la preuve', async () => {
  const c = await chaine();
  assert.match(refusMessage(() => lire(c, C16.filter((d) => d.nom !== 'projeterChemins'))), /absentes du catalogue/);
});

// ============================================================================ G. COLLECTIF ET choixAFaire APRÈS VÉRIFICATION
test('G1. nouvelle ligne vérifiée sous C17 : la collective historique est EXACTEMENT celle de l\'observation (Z apparue après n\'est pas absorbée) et s\'exécute ; choixAFaire identique à celui de C16', async () => {
  const c = await chaine();
  const Z = await c.w.lancer('tour Z après Y', 'symbolesDeChaine');
  await c.w.tour('dernier');
  const l = await c.w.lire();
  const O = l.observations.find((o) => o.id === c.Y.observation.id);
  const r = resoudreContexteObservation(O.id, l.observations, l.valeurs, l.executions, C17);
  assert.equal(r.observation, O);
  const collective = (observation, catalogue) => applicationsSollicitables(observation, catalogue, r.univers).applications.find((a) => a.operation === 'elementsObservables').liaisons[0].donnees;
  const attendus = r.observation.possibilites.filter((p) => p.operation === 'elementsObservables' && p.entree === 'elements').map((p) => p.donnee).sort();
  assert.deepEqual([...collective(r.observation, C17)].sort(), attendus);
  assert.equal(collective(r.observation, C17).includes(Z.execution.id), false);
  const application = applicationsSollicitables(r.observation, C17, r.univers).applications.find((a) => a.operation === 'elementsObservables');
  const execution = await executerApplicationSollicitee({ observation: r.observation, application, univers: r.univers }, { magasin: c.w.magasin, table: TABLE_OPERATIONS, descriptions: C17 });
  assert.equal(execution.statut, 'executee', execution.erreur && execution.erreur.message);
  assert.deepEqual([...execution.execution.liaisons[0].donnees].sort(), attendus);
  assert.deepEqual(applicationsSollicitables(r.observation, C17, r.univers), applicationsSollicitables(r.observation, C16, r.univers));
  assert.deepEqual(applicationsSollicitables(r.observation, C17, r.univers), applicationsSollicitables(c.Y.observation, C16, c.Y.univers), 'identique à celle de l\'époque');
  assert.ok(applicationsSollicitables(r.observation, C17, r.univers).choixAFaire.length >= 1);
});
test('G2. sous J10b : le contexte est refusé AVANT qu\'un choixAFaire altéré puisse être présenté comme historiquement fidèle (aucun résultat partiel)', async () => {
  const c = await chaine();
  let rendu = null;
  assert.throws(() => { rendu = lire(c, J10B()); }, TypeError);
  assert.equal(rendu, null);
});

// ============================================================================ H. BOUT EN BOUT
test('H1. BOUT EN BOUT sur la chaîne réelle A,B → P → H → Q → O(Y) (nouvelle génération) : A. C16 rendu ; B. C17 rendu et identique ; C. J10 refusé (atomes identiques) ; D. J10b refusé (atomes identiques) ; E. même ligne sans preuve : régime v0.63.50 conservé', async () => {
  const c = await chaine();
  const base = lire(c, C16);
  assert.equal(base.observation, c.O);                                                                  // A
  assert.deepEqual(lire(c, C17).univers, base.univers);                                                 // B
  const donnees = base.univers.map((e) => e.donnee);
  for (const derive of [J10(), J10B()]) {                                                               // C, D
    assert.deepEqual(new Set(possibilitesDeLiaison(donnees, derive).map(cle)), new Set(c.O.possibilites.map(cle)), 'mêmes atomes');
    assert.notDeepEqual(empreintesDesContrats(derive), c.O.empreintesOperationsExaminees, 'empreinte différente');
    assert.throws(() => lire(c, derive), TypeError);
    assert.doesNotThrow(() => lire(c, derive, enAncienne(c.O)));                                       // E
  }
  assert.throws(() => lire(c, C16.filter((d) => d.nom !== 'symbolesDeChaine'), enAncienne(c.O)), TypeError); // E : refus visibles conservés
});

// ============================================================================ I. PURETÉ
test('I1. PURETÉ : catalogue gelé en profondeur accepté et inchangé ; ligne, lignes et preuve non modifiées ; déterministe ; aucune écriture, aucune nouvelle ligne', async () => {
  const c = await chaine();
  const catalogue = gelProfond(clone(C17));
  const lignes = gelProfond(clone(c.l.observations));
  const valeurs = gelProfond(clone(c.l.valeurs)); const executions = gelProfond(clone(c.l.executions));
  const avantCatalogue = JSON.stringify(catalogue); const avantLignes = JSON.stringify(lignes);
  const a = resoudreContexteObservation(c.O.id, lignes, valeurs, executions, catalogue);
  const b = resoudreContexteObservation(c.O.id, lignes, valeurs, executions, catalogue);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(catalogue), avantCatalogue);
  assert.equal(JSON.stringify(lignes), avantLignes);
  assert.equal(a.observation, lignes.find((o) => o.id === c.O.id));
  assert.equal((await c.w.lire()).observations.length, c.l.observations.length, 'aucune observation créée');
  assert.equal(JSON.stringify((await c.w.lire()).observations), JSON.stringify(c.l.observations), 'magasin inchangé');
});
test('I2. PURETÉ STATIQUE : le module reste synchrone et sans horloge/hasard/identité/magasin ; il n\'importe empreinte-contrats.js que pour RECALCULER, ne canonise ni ne hache rien lui-même ; versions, schéma, tables inchangés', () => {
  const code = sansCommentaires(lu('app', 'langage', 'contexte-observation.js'));
  assert.deepEqual([...code.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./empreinte-categorie-entrees.js', './empreinte-categorie-message.js', './empreinte-contrats.js', './empreinte-relations.js', './possibilites-liaison.js', './resoudre-identites.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.65 : + empreinte-categorie-message.js (vérification de la preuve message, seulement si la ligne la porte) ; // MISE À JOUR DÉLIBÉRÉE v0.63.58 : + empreinte-categorie-entrees.js (vérification de la preuve de catégorie, génération 8 clés) // MISE À JOUR DÉLIBÉRÉE v0.63.63 : + empreinte-relations.js (vérification de la preuve relationnelle)
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'crypto', 'sha256', 'JSON.stringify(valeur', 'contratCanonique']) {
    assert.equal(code.includes(interdit), false, `« ${interdit} » ne doit pas figurer dans le code`);
  }
  assert.equal(VERSION_BASE, 19);
  assert.equal(SCHEMA_SAUVEGARDE, 9);
  assert.equal(TABLES.length, 22);
  assert.equal(C16.length, 16);
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 16);
});
