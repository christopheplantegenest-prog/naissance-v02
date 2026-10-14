// v0.64.11 — « ADMISSION D'UNE DONNÉE TRANS-ÉVÉNEMENTS DANS L'UNIVERS » (décision ChatGPT « v0.64.11 », 14/10/2026).
// Preuves, sur le VRAI flux (observation, application, désignation, exécution persistée) : les référents de suites ACQUIS entrent dans l'univers
// observé (après entrées(P), même photographie, sans rétroactivité), une donnée par intension (redécouverte +0, intension nouvelle +1) ; retrait
// et restauration du catalogue ; résolution générale des seuls référents acquis ; utilisation réelle (parcourirStructure(S)), épisodes après
// usage, .93 ; .94 et B1 inchangés ; possibilités exactes ; aucune autre classe d'items admise ; empreinte de catégorie (constante, 0/1/N,
// dérive du codec détectée) ; formats de preuve (anciens lisibles, nouveau fidèle, hybride refusé, altérations refusées) ; espace réservé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { donneesDeReferentsDeSuites, adresseDuReferent, PREFIXE_REFERENT_SUITE } from '../app/langage/donnees-referents-suites.js';
import { referentDeSuite } from '../app/langage/referents-suites.js';
import { CATEGORIE_REFERENTS_SUITES, empreinteContratReferentsSuites, contratReferentsSuites } from '../app/langage/empreinte-categorie-referents.js';
import { CATEGORIE_ENTREES_PRODUCTION, empreinteContratEntreesProduction } from '../app/langage/empreinte-categorie-entrees.js';
import { CATEGORIE_MESSAGE, empreinteContratMessage } from '../app/langage/empreinte-categorie-message.js';
import { DESCRIPTIONS_OPERATIONS as D } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { applicationsRelativesA } from '../app/langage/determination-relative.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { cleApplication } from '../app/langage/besoins.js';
import { identifierMessage } from '../app/langage/pont.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const car = (s) => [...s];
const adr = (s) => adresseDuReferent(referentDeSuite(typeof s === 'string' ? car(s) : s));
const refsDe = (o) => o.donneesExaminees.filter((id) => id.startsWith(PREFIXE_REFERENT_SUITE));
const E = () => ({ categorie: CATEGORIE_ENTREES_PRODUCTION, empreinte: empreinteContratEntreesProduction() });
const M = () => ({ categorie: CATEGORIE_MESSAGE, empreinte: empreinteContratMessage() });
const R = () => ({ categorie: CATEGORIE_REFERENTS_SUITES, empreinte: empreinteContratReferentsSuites() });
const H = (c) => c.repeat(64);
const clone = (v) => structuredClone(v);

function monde() {
  const magasin = magasinMemoireVive(); let k = 0;
  const tour = async (texte, descriptions = D) => {
    const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
    await enregistrerValeurDonnee(magasin, { id: message.id, valeur: message.texte });
    const r = await observerPossibilites(message, { enregistrer: (o) => enregistrerObservationPossibilites(magasin, o), lireExecutions: () => magasin.lireTout('executionsOperations'), descriptions });
    assert.equal(r.statut, 'ecrite');
    return { message, observation: r.observation, univers: r.univers };
  };
  const exec = (t, application) => executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
  const appDe = (t, op) => applicationsSollicitables(t.observation, D, t.univers).applications.find((a) => a.operation === op);
  const lignes = async () => ({ observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
  return { magasin, tour, exec, appDe, lignes };
}

// Scénario réel : deux messages → symbolesDeChaine ×2 → elementsObservables → produireSuitesFermees (événement E1, au tour T) ; puis T+1.
let SCENARIO;
async function scenario() {
  if (SCENARIO) return SCENARIO;
  const w = monde();
  const t1 = await w.tour('bonjour Pixel'); await w.exec(t1, w.appDe(t1, 'symbolesDeChaine'));
  const t2 = await w.tour('bonjour Lune'); await w.exec(t2, { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: t2.message.id }] });
  const t3 = await w.tour('trois'); await w.exec(t3, w.appDe(t3, 'elementsObservables'));
  const T = await w.tour('quatre');
  const rS = await w.exec(T, w.appDe(T, 'produireSuitesFermees'));
  assert.equal(rS.statut, 'executee');
  const T1 = await w.tour('cinq');
  SCENARIO = { w, t1, t3, T, T1, rS };
  return SCENARIO;
}
const BONJOUR = adr('bonjour ');

test('A1. 0 référent : avant toute découverte, aucune donnée « referent-suite: » ; la preuve est déjà au format 3 (trois catégories, toutes ou aucune)', async () => {
  const { t1, t3 } = await scenario();
  for (const t of [t1, t3]) {
    assert.deepEqual(refsDe(t.observation), []);
    assert.deepEqual(t.observation.empreintesCategoriesDonnees, [E(), M(), R()]);
  }
});

test('A2. T / T+1 : la production de T n\'apporte AUCUN référent rétroactif à T ; à T+1 les référents ACQUIS (exactement la vue v0.64.10 des exécutions de la photographie) sont dans l\'univers, après entrées(P)', async () => {
  const { w, T, T1 } = await scenario();
  assert.deepEqual(refsDe(T.observation), []);
  const l = await w.lignes();
  const avantT1 = l.executions.filter((e) => T1.observation.donneesExaminees.includes(e.id));
  const vue = donneesDeReferentsDeSuites(avantT1, D);
  assert.ok(vue.length > 1);
  assert.deepEqual(T1.univers.filter((u) => u.donnee.identite.startsWith(PREFIXE_REFERENT_SUITE)), vue);
  assert.ok(refsDe(T1.observation).includes(BONJOUR));
  const ids = T1.univers.map((u) => u.donnee.identite);
  const dernierEntrees = ids.map((x) => x.startsWith('entrees-de-production:')).lastIndexOf(true);
  const premierRef = ids.findIndex((x) => x.startsWith(PREFIXE_REFERENT_SUITE));
  assert.ok(premierRef > dernierEntrees);
  assert.ok(ids.slice(premierRef).every((x) => x.startsWith(PREFIXE_REFERENT_SUITE)));
  // 1 référent / N référents : chacun une fois, preuve identique.
  assert.equal(new Set(refsDe(T1.observation)).size, refsDe(T1.observation).length);
  assert.deepEqual(T1.observation.empreintesCategoriesDonnees, [E(), M(), R()]);
});

test('A3. REDÉCOUVERTE (+0) puis INTENSION NOUVELLE (+1 chacune) : une seule donnée par intension, aucune duplication, aucun événement canonique', async () => {
  const w = monde();
  const a = await w.tour('bonjour Pixel'); await w.exec(a, w.appDe(a, 'symbolesDeChaine'));
  const b = await w.tour('bonjour Lune'); await w.exec(b, { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: b.message.id }] });
  const c = await w.tour('c'); await w.exec(c, w.appDe(c, 'elementsObservables'));
  const d = await w.tour('d'); await w.exec(d, w.appDe(d, 'produireSuitesFermees'));
  const e = await w.tour('e');
  const avant = refsDe(e.observation);
  assert.ok(avant.length > 0);
  // Un second événement de découverte sur le MÊME élément P : mêmes intensions → +0.
  const P = (await w.lignes()).executions.find((x) => x.operation === 'elementsObservables').id;
  await w.exec(e, { operation: 'produireSuitesFermees', liaisons: [{ entree: 'elements', donnee: P }] }).catch(() => null);
  const f = await w.tour('f');
  const deuxEvenements = (await w.lignes()).executions.filter((x) => x.operation === 'produireSuitesFermees').length;
  assert.deepEqual(refsDe(f.observation), avant, `redécouverte (${deuxEvenements} événement(s) de découverte)`);
  // Intension nouvelle : un nouveau message, une nouvelle collection, une nouvelle découverte.
  const g = await w.tour('salut Pixel'); await w.exec(g, { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: g.message.id }] });
  const h = await w.tour('h'); await w.exec(h, w.appDe(h, 'elementsObservables'));
  const i = await w.tour('i'); const Pn = (await w.lignes()).executions.filter((x) => x.operation === 'elementsObservables').at(-1).id;
  await w.exec(i, { operation: 'produireSuitesFermees', liaisons: [{ entree: 'elements', donnee: Pn }] });
  const j = await w.tour('j');
  const apres = refsDe(j.observation);
  assert.ok(avant.every((x) => apres.includes(x)), 'aucun référent ne disparaît');
  const nouveaux = apres.filter((x) => !avant.includes(x));
  assert.ok(nouveaux.length >= 1);
  assert.equal(new Set(apres).size, apres.length, 'aucune duplication');
  assert.deepEqual(apres, donneesDeReferentsDeSuites((await w.lignes()).executions.filter((x) => j.observation.donneesExaminees.includes(x.id)), D).map((x) => x.donnee.identite));
});

test('A4. CATALOGUE : produireSuitesFermees retirée → aucun référent (faits conservés) ; restaurée → les MÊMES adresses ; la preuve reste au format 3', async () => {
  const { w, T1 } = await scenario();
  const sans = D.filter((d) => d.nom !== 'produireSuitesFermees');
  const t = await w.tour('retrait', sans);
  assert.deepEqual(refsDe(t.observation), []);
  assert.deepEqual(t.observation.empreintesCategoriesDonnees, [E(), M(), R()]);
  assert.ok((await w.lignes()).executions.some((e) => e.operation === 'produireSuitesFermees'), 'les faits historiques ne sont pas supprimés');
  const u = await w.tour('restauration');
  assert.deepEqual(refsDe(u.observation), refsDe(T1.observation));
});

test('A5. POSSIBILITÉS : chaque référent produit EXACTEMENT les atomes que le catalogue garantit à sa forme (couvrirSequence.elements, parcourirStructure.valeur), sans branche spéciale ; les atomes ordinaires sont inchangés', async () => {
  const { T1 } = await scenario();
  const refs = refsDe(T1.observation);
  for (const id of refs) assert.deepEqual(T1.observation.possibilites.filter((a) => a.donnee === id).map((a) => `${a.operation}.${a.entree}`).sort(), ['couvrirSequence.elements', 'parcourirStructure.valeur']);
  const ordinaires = T1.univers.filter((u) => !u.donnee.identite.startsWith(PREFIXE_REFERENT_SUITE)).map((u) => u.donnee);
  const cle = (a) => `${a.donnee}|${a.operation}|${a.entree}`;
  assert.deepEqual(T1.observation.possibilites.filter((a) => !refs.includes(a.donnee)).map(cle).sort(), possibilitesDeLiaison(ordinaires, D).map(cle).sort());
  assert.equal(T1.observation.possibilites.length - possibilitesDeLiaison(ordinaires, D).length, 2 * refs.length);
});

test('A6. FRONTIÈRE : aucune autre classe d\'items n\'est admise (constats, couvertures, chemins, manifestations) : toute donnée examinée est un message, une production, une sous-donnée, une entrées(P) ou un référent de la vue', async () => {
  const w = monde();
  const a = await w.tour('bonjour Pixel'); await w.exec(a, w.appDe(a, 'symbolesDeChaine'));
  const b = await w.tour('bonjour Lune'); await w.exec(b, { operation: 'symbolesDeChaine', liaisons: [{ entree: 'chaine', donnee: b.message.id }] });
  const c = await w.tour('c'); await w.exec(c, w.appDe(c, 'elementsObservables'));
  const P = (await w.lignes()).executions.find((x) => x.operation === 'elementsObservables').id;
  const d = await w.tour('d');
  for (const operation of ['produireSuitesFermees', 'produireConstatsStructurels', 'projeterChemins']) assert.equal((await w.exec(d, { operation, liaisons: [{ entree: 'elements', donnee: P }] })).statut, 'executee', operation);
  const ch = (await w.lignes()).executions.find((x) => x.operation === 'projeterChemins').id;
  const e = await w.tour('e');
  assert.equal((await w.exec(e, { operation: 'normaliserCouverture', liaisons: [{ entree: 'chemins', donnee: ch }] })).statut, 'executee');
  const T1 = await w.tour('f');
  const l = await w.lignes();
  const sous = new Set(l.executions.flatMap((x) => (x.sousDonnees || []).map((s) => s.id)));
  const vue = new Set(refsDe(T1.observation));
  assert.ok(vue.size > 0);
  for (const id of T1.observation.donneesExaminees) {
    const ok = id === T1.observation.idMessage || l.executions.some((e) => e.id === id) || sous.has(id) || id.startsWith('entrees-de-production:') || vue.has(id);
    assert.ok(ok, id);
  }
  assert.ok(l.executions.some((e) => ['produireConstatsStructurels', 'projeterChemins', 'normaliserCouverture'].includes(e.operation)), 'le scénario contient bien d\'autres sorties collections');
});

test('A7. ESPACE RÉSERVÉ : un message, un complément ou une production portant « referent-suite: » fait échouer l\'observation ; le résolveur refuse aussi', async () => {
  const magasin = magasinMemoireVive();
  const r1 = await observerPossibilites({ id: `${PREFIXE_REFERENT_SUITE}c1:x`, texte: 'x' }, { enregistrer: (o) => enregistrerObservationPossibilites(magasin, o), lireExecutions: async () => [] });
  assert.equal(r1.statut, 'echec_donnee');
  const ligne = { id: `${PREFIXE_REFERENT_SUITE}c1:y`, horodatage: 'T', idDesignation: 'd', operation: 'symbolesDeChaine', liaisons: [], resultat: ['y'] };
  const r2 = await observerPossibilites({ id: 'message-1', texte: 'y' }, { enregistrer: (o) => enregistrerObservationPossibilites(magasin, o), lireExecutions: async () => [ligne] });
  assert.equal(r2.statut, 'echec_executions');
  assert.throws(() => resoudreIdentitesDonnees([], [], [ligne], D), /espace réservé des référents/);
  assert.equal((await magasin.lireTout('observationsPossibilites')).length, 0);
});

test('B1. RÉSOLUTION GÉNÉRALE : un référent ACQUIS est résolu (porteur { id, valeur }, accès de valeur, forme du descripteur) ; une adresse valide NON acquise, ou d\'une opération non décrite, est une identité inconnue', async () => {
  const { w, T1 } = await scenario();
  const l = await w.lignes();
  const [r] = resoudreIdentitesDonnees([BONJOUR], l.valeurs, l.executions, D);
  assert.deepEqual(Object.keys(r.porteur).sort(), ['id', 'valeur']);
  assert.deepEqual(valeurDePorteur(r.porteur, r.donnee, r.acces), car('bonjour '));
  assert.deepEqual(r.donnee.forme, D.find((d) => d.nom === 'produireSuitesFermees').sortie.elements.champs.contenu);
  assert.deepEqual(r, T1.univers.find((u) => u.donnee.identite === BONJOUR));
  assert.throws(() => resoudreIdentitesDonnees([adr('jamais découvert')], l.valeurs, l.executions, D), /identité inconnue/);
  assert.throws(() => resoudreIdentitesDonnees([BONJOUR], l.valeurs, l.executions, D.filter((d) => d.nom !== 'produireSuitesFermees')), /identité inconnue/);
  assert.throws(() => resoudreIdentitesDonnees(['referent-suite:c01:a'], l.valeurs, l.executions, D), /identité inconnue/);
  // Mélange avec les identités ordinaires : ordre conservé.
  const mix = resoudreIdentitesDonnees([T1.observation.idMessage, BONJOUR], l.valeurs, l.executions, D);
  assert.deepEqual(mix.map((x) => x.donnee.identite), [T1.observation.idMessage, BONJOUR]);
});

test('B2. UTILISATION RÉELLE : parcourirStructure(S) (opération existante, sollicitation explicite) s\'exécute ; les épisodes se reconstruisent ensuite (S comme départ) ; .93 reconnaît l\'application stricte déjà exécutée', async () => {
  const { w } = await scenario();
  const t = await w.tour('usage');
  const app = { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: BONJOUR }] };
  const r = await w.exec(t, app);
  assert.equal(r.statut, 'executee');
  assert.deepEqual(r.execution.liaisons, app.liaisons);
  const v = await lireExecutionsVecues(w.magasin);
  const ep = episodesDeTransformation(v.valeurs, v.executions, v.descriptions);
  assert.ok(ep.episodes.some((e) => e.depart === BONJOUR));
  const suivant = await w.tour('après usage');
  const connues = new Set(suivant.univers.filter((u) => u.porteur && typeof u.porteur.operation === 'string').map((u) => cleApplication(u.porteur)));
  assert.equal(connues.has(cleApplication(app)), true);
  // La même S redécouverte garde la même adresse : la clé stricte est donc la même.
  assert.equal(cleApplication({ operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: adr('bonjour ') }] }), cleApplication(app));
});

test('B3. LOT, .94 et B1 INCHANGÉS : aucun référent n\'est relatif à O ; le lot mécanique de T+1 n\'exécute aucune application qui mobilise un référent ; tous ses statuts sont normaux', async () => {
  const { w } = await scenario();
  const t = await w.tour('lot');
  const relatives = applicationsRelativesA(t.observation, D, t.univers);
  assert.equal(JSON.stringify(relatives).includes(PREFIXE_REFERENT_SUITE), false);
  const lot = await executerApplicationsDeterminees({ observation: t.observation, univers: t.univers }, { magasin: w.magasin, table: TABLE_OPERATIONS });
  assert.equal(JSON.stringify([...lot.applications, ...lot.relatives]).includes(PREFIXE_REFERENT_SUITE), false);
  for (const res of lot.resultats) assert.equal(res.statut, 'executee');
  assert.ok(refsDe(t.observation).length > 0, 'des référents sont bien présents dans cet univers');
});

test('C1. EMPREINTE : contrat de représentation constant (préfixe, sondes du codec, règle de forme, accès) ; identique avec 0, 1 ou N référents, avec ou sans l\'opération décrite', async () => {
  const c = contratReferentsSuites();
  assert.deepEqual(Object.keys(c).sort(), ['acces', 'categorie', 'forme', 'identite']);
  assert.equal(c.categorie, 'referents-de-suites');
  assert.equal(c.identite.prefixe, 'referent-suite:');
  assert.deepEqual(c.forme, { operation: 'produireSuitesFermees', chemin: ['sortie', 'elements', 'champs', 'contenu'] });
  assert.deepEqual(c.acces, { champ: 'valeur' });
  assert.ok(c.identite.sondes.some((s) => s.adresse === 'referent-suite:n2:-0' && s.relue === 'referent-suite:n2:-0'));
  assert.ok(c.identite.sondes.some((s) => s.adresse === 'referent-suite:n3:1.0' && s.relue === null));
  assert.match(empreinteContratReferentsSuites(), /^[0-9a-f]{64}$/);
  const { w, t1, T1 } = await scenario();
  const retrait = await w.tour('sans op', D.filter((d) => d.nom !== 'produireSuitesFermees'));
  for (const o of [t1.observation, T1.observation, retrait.observation]) assert.deepEqual(o.empreintesCategoriesDonnees[2], R());
});

test('C2. DÉRIVE DU CODEC → DÉRIVE DE L\'EMPREINTE (copie temporaire du code : charge booléenne « v/f » au lieu de « 1/0 »)', async () => {
  const dossier = mkdtempSync(join(tmpdir(), 'ref6411-'));
  try {
    cpSync(join(RACINE, 'app', 'langage'), dossier, { recursive: true });
    const p = join(dossier, 'donnees-referents-suites.js');
    const s = readFileSync(p, 'utf8');
    const derive = s.replace("charge = symbole ? '1' : '0';", "charge = symbole ? 'v' : 'f';").replace("if (charge !== '1' && charge !== '0')", "if (charge !== 'v' && charge !== 'f')").replace("suite.push(charge === '1');", "suite.push(charge === 'v');");
    assert.notEqual(derive, s);
    writeFileSync(p, derive);
    const { empreinteContratReferentsSuites: empreinteDerivee } = await import(pathToFileURL(join(dossier, 'empreinte-categorie-referents.js')).href);
    assert.notEqual(empreinteDerivee(), empreinteContratReferentsSuites());
  } finally { rmSync(dossier, { recursive: true, force: true }); }
});

test('D1. FORMAT 3 FIDÈLE : une observation réelle avec référents est reconstruite par le contexte (preuves vérifiées, référents résolus) ; formats 1 et 2 d\'une observation SANS référent restent lisibles', async () => {
  const { w, t1, T1 } = await scenario();
  const l = await w.lignes();
  const r = resoudreContexteObservation(T1.observation.id, l.observations, l.valeurs, l.executions, D);
  assert.equal(r.observation.id, T1.observation.id);
  assert.deepEqual(r.univers.filter((u) => u.donnee.identite.startsWith(PREFIXE_REFERENT_SUITE)).map((u) => u.donnee.identite), refsDe(T1.observation));
  const o1 = { ...clone(t1.observation), id: 'o-f1', empreintesCategoriesDonnees: [E()] };
  const o2 = { ...clone(t1.observation), id: 'o-f2', empreintesCategoriesDonnees: [E(), M()] };
  for (const o of [o1, o2]) assert.equal(resoudreContexteObservation(o.id, [...l.observations, o], l.valeurs, l.executions, D).observation, o);
});

test('D2. REFUS : référents sans leur preuve (génération hybride) ; preuve de référents altérée ; formats et ordres invalides ; fausse adresse malgré une empreinte correcte', async () => {
  const { w, T1 } = await scenario();
  const l = await w.lignes();
  const O = T1.observation;
  const essai = (mod) => { const o = { ...clone(O), id: 'o-x', ...mod }; return () => resoudreContexteObservation('o-x', [...l.observations, o], l.valeurs, l.executions, D); };
  assert.throws(essai({ empreintesCategoriesDonnees: [E(), M()] }), /référents de suites sont examinés sans la preuve/);
  assert.throws(essai({ empreintesCategoriesDonnees: [E()] }), /référents de suites sont examinés sans la preuve/);
  const sept = clone(O); delete sept.empreintesCategoriesDonnees; delete sept.empreintesContratsRelationnels;
  assert.throws(() => resoudreContexteObservation(O.id, [sept], l.valeurs, l.executions, D), /référents de suites sont examinés sans la preuve/);
  assert.throws(essai({ empreintesCategoriesDonnees: [E(), M(), { categorie: CATEGORIE_REFERENTS_SUITES, empreinte: H('a') }] }), /catégorie « referents-de-suites » a changé/);
  assert.throws(essai({ empreintesCategoriesDonnees: [E(), R()] }), TypeError);
  assert.throws(essai({ empreintesCategoriesDonnees: [E(), R(), M()] }), TypeError);
  assert.throws(essai({ empreintesCategoriesDonnees: [E(), M(), R(), { categorie: 'autre', empreinte: H('b') }] }), TypeError);
  const fausse = `${PREFIXE_REFERENT_SUITE}c3:zzz`;
  assert.throws(essai({ donneesExaminees: [...O.donneesExaminees, fausse].sort() }), /identité inconnue/);
  // Persistance : le magasin admet le format 3, refuse un format incohérent.
  const base = { idMessage: 'm', donneesExaminees: ['m'], operationsExaminees: [], empreintesOperationsExaminees: [], possibilites: [] };
  await assert.doesNotReject(enregistrerObservationPossibilites(magasinMemoireVive(), { ...base, empreintesCategoriesDonnees: [E(), M(), R()] }));
  await assert.rejects(enregistrerObservationPossibilites(magasinMemoireVive(), { ...base, empreintesCategoriesDonnees: [E(), R()] }));
  await assert.rejects(enregistrerObservationPossibilites(magasinMemoireVive(), { ...base, empreintesCategoriesDonnees: [E(), R(), M()] }));
});

test('E1. ATTEIGNABILITÉ BORNÉE : depuis main.js, la chaîne observation → donnees-referents-suites → referents-suites → suites-fermees / rechercherSousSuites est atteinte ; ni la mécanique d\'action ni la table ne passent par elle', () => {
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')]; const parents = new Map();
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+'(\.[^']+)'/gm)) { const c = resolve(dirname(f), m[1]); if (!parents.has(c)) parents.set(c, new Set()); parents.get(c).add(f); pile.push(c); }
  }
  const rel = (f) => f.slice(RACINE.length + 1).split('\\').join('/');
  const atteints = new Set([...vus].map(rel));
  for (const n of ['donnees-referents-suites', 'referents-suites', 'suites-fermees', 'rechercher-sous-suites', 'empreinte-categorie-referents']) assert.ok(atteints.has(`app/langage/${n}.js`), n);
  const importeurs = (n) => [...(parents.get(join(RACINE, 'app', 'langage', `${n}.js`)) || [])].map(rel).sort();
  assert.deepEqual(importeurs('donnees-referents-suites'), ['app/langage/contexte-observation.js', 'app/langage/empreinte-categorie-referents.js', 'app/langage/observation-possibilites.js', 'app/langage/resoudre-identites.js'].filter((f) => atteints.has(f)));
  assert.deepEqual(importeurs('referents-suites'), ['app/langage/donnees-referents-suites.js']);
  assert.deepEqual(importeurs('rechercher-sous-suites'), ['app/langage/referents-suites.js', 'app/langage/table-operations.js']);
});
