// === DEBUT_TEST_CORRESPONDANCES_EXPERIENCES ===
// v0.63.66 — CONSTATER LES CORRESPONDANCES ENTRE POSSIBILITÉS PRÉSENTES ET EXPÉRIENCES PASSÉES (décision ChatGPT, 06/10/2026). correspondancesExperiences : vue PURE et DORMANTE qui relie
// chaque application actuelle (déterminée ou combinaison candidate d'un choix) aux expériences passées de la MÊME opération dont les formes d'entrée déclarées sont EXACTEMENT égales.
// Elle ne choisit rien, ne compte rien, ne filtre rien, ne persiste rien et n'est lue par aucun mécanisme vivant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import * as module from '../app/langage/correspondances-experiences.js';
import { correspondancesExperiences } from '../app/langage/correspondances-experiences.js';
import { formesEntreesRencontrees } from '../app/langage/formes-rencontrees.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CODE = sansCommentaires(lu('app', 'langage', 'correspondances-experiences.js'));
const D = DESCRIPTIONS_OPERATIONS;
const clone = (x) => JSON.parse(JSON.stringify(x));
const stable = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((c) => [c, v[c]])) : v));
const gelerProfond = (v) => { if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) { for (const c of Object.keys(v)) gelerProfond(v[c]); Object.freeze(v); } return v; };
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const CH = { forme: 'scalaire', genre: 'chaine' };
const NB = { forme: 'scalaire', genre: 'nombre' };

async function vie(messages, { declencheur = true } = {}) {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`; const tours = [];
  for (const texte of messages) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), declencheur ? (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }) : null);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    tours.push({ S: suivi.joindre(res).sollicitation });
  }
  return { magasin, tours };
}
const lignes = async (magasin) => ({ designations: await magasin.lireTout('designations'), observations: await magasin.lireTout('observationsPossibilites'), valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
let VIE; const vecue = async () => { if (!VIE) { const v = await vie(SCENARIO); VIE = { ...v, l: await lignes(v.magasin) }; } return VIE; };
const toutesLesTables = async (magasin) => Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await magasin.lireTout(t)])));

// Histoire AU MOMENT du tour i (index) : seules les exécutions des tours PRÉCÉDENTS existent encore ; la vue historique (.65) est appelée telle quelle.
function histoireAvant(tours, l, i) {
  const precedentes = new Set(tours.slice(0, i).map((t) => t.S.observation.id));
  const designations = l.designations.filter((d) => precedentes.has(d.idObservation));
  const executions = l.executions.filter((e) => designations.some((d) => d.id === e.idDesignation));
  return formesEntreesRencontrees(designations, l.observations.filter((o) => precedentes.has(o.id)), l.valeurs, executions, D);
}
const presentDuTour = (S, historique) => correspondancesExperiences(S.observation, D, S.univers, historique);

// ---------------------------------------------------------------------------------------------------------------- MONDE SYNTHÉTIQUE : présent construit à la main
const CATM = [{ nom: 'couple', entrees: { a: { forme: 'quelconque' }, b: { forme: 'quelconque' } }, sortie: { forme: 'scalaire', genre: 'chaine' } }];
const CATC = [{ nom: 'ens', entrees: { elements: { forme: 'collection', collectif: true, elements: { forme: 'objet', champs: { identite: { forme: 'scalaire', genre: 'chaine' }, valeur: { forme: 'quelconque' } } } } }, sortie: { forme: 'scalaire', genre: 'chaine' } }];
function present(catalogue, donnees) {
  const univers = donnees.map(([identite, forme]) => ({ donnee: { identite, forme }, porteur: { id: identite }, acces: { champ: 'valeur' } }));
  return { observation: { id: 'o', possibilites: possibilitesDeLiaison(univers.map((e) => e.donnee), catalogue) }, univers };
}
const exp = (idExecution, operation, entrees, extra = {}) => ({ idExecution, idDesignation: `d-${idExecution}`, idObservation: `o-${idExecution}`, operation, origine: 'mecanique', entrees, ...extra });
const ord = (entree, donnee, forme) => ({ entree, donnee, forme });
const hist = (experiences, refusees = []) => ({ experiences, refusees });
const parLiaisons = (r, ...formes) => r.applications.find((a) => a.liaisons.map((l) => l.forme?.genre ?? '?').join('/') === formes.join('/'));

// ------------------------------------------------------------------------------------------------------------------------ A. CAS CENTRAL T1 -> T2
test('A1. CAS CENTRAL T1 -> T2 : parcourirStructure a 5 combinaisons candidates ; EXACTEMENT UNE correspond à l\'expérience de T1 (celle de message-2, identités différentes) ; les 4 autres ont ZÉRO correspondance', async () => {
  const v = await vie(['bonjour Pixel', 'bonjour Luna']);
  const l = await lignes(v.magasin);
  const S2 = v.tours[1].S;
  const avant = { choix: clone(S2.choixAFaire), applications: stable(applicationsSollicitables(S2.observation, D, S2.univers)), designations: l.designations.length, executions: l.executions.length };
  const histoire = histoireAvant(v.tours, l, 1);
  assert.equal(histoire.experiences.filter((e) => e.operation === 'parcourirStructure').length, 1);
  const r = presentDuTour(S2, histoire);
  const parcours = r.applications.filter((a) => a.operation === 'parcourirStructure');
  assert.equal(parcours.length, 5);
  assert.deepEqual(parcours.map((a) => a.statut), ['candidate', 'candidate', 'candidate', 'candidate', 'candidate']);
  const avecCorrespondance = parcours.filter((a) => a.correspondances.length > 0);
  assert.equal(avecCorrespondance.length, 1);
  assert.deepEqual(avecCorrespondance[0].liaisons, [{ entree: 'valeur', donnee: 'message-2', forme: CH }]);
  const t1 = l.executions.find((e) => e.operation === 'parcourirStructure' && e.liaisons[0].donnee === 'message-1');
  assert.deepEqual(avecCorrespondance[0].correspondances, [{ idExecution: t1.id, idDesignation: t1.idDesignation, idObservation: v.tours[0].S.observation.id, origine: 'mecanique', entrees: [{ entree: 'valeur', donnee: 'message-1', forme: CH }] }]);
  for (const a of parcours.filter((x) => x.correspondances.length === 0)) assert.deepEqual(a.correspondances, []);
  // ni choix, ni effet : choixAFaire, applications, désignations, exécutions, tables
  assert.deepEqual(S2.choixAFaire, avant.choix);
  assert.equal(S2.choixAFaire.includes('parcourirStructure'), true);
  assert.equal(stable(applicationsSollicitables(S2.observation, D, S2.univers)), avant.applications);
  const l2 = await lignes(v.magasin);
  assert.equal(l2.designations.length, avant.designations); assert.equal(l2.executions.length, avant.executions);
});
test('A2. NOUVEAUTÉ observable sans catégorie : dans le MÊME résultat, « déjà rencontré » (correspondances non vide) et « jamais rencontré » (vide) coexistent ; l\'absence n\'a ni statut, ni marqueur, ni invalidité', async () => {
  const v = await vie(['bonjour Pixel', 'bonjour Luna']);
  const r = presentDuTour(v.tours[1].S, histoireAvant(v.tours, await lignes(v.magasin), 1));
  const parcours = r.applications.filter((a) => a.operation === 'parcourirStructure');
  assert.equal(parcours.some((a) => a.correspondances.length > 0), true);
  assert.equal(parcours.some((a) => a.correspondances.length === 0), true);
  for (const a of r.applications) assert.deepEqual(Object.keys(a), ['operation', 'statut', 'liaisons', 'correspondances']);
  assert.deepEqual(Object.keys(r), ['applications', 'refusees']);
});
test('A3. APPLICATIONS DÉTERMINÉES ET CHOIX examinés ensemble sans reclassement : statut determinee pour une combinaison valide unique, candidate pour les combinaisons d\'un choix ; les opérations de choixAFaire sont exactement celles à statut candidate', async () => {
  const v = await vie(['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel']);
  const l = await lignes(v.magasin);
  const S = v.tours[2].S;
  const r = presentDuTour(S, histoireAvant(v.tours, l, 2));
  const candidates = [...new Set(r.applications.filter((a) => a.statut === 'candidate').map((a) => a.operation))];
  assert.deepEqual(candidates, [...S.choixAFaire].sort());
  const determinees = r.applications.filter((a) => a.statut === 'determinee').map((a) => ({ operation: a.operation, liaisons: a.liaisons.map((x) => (x.donnees === undefined ? { entree: x.entree, donnee: x.donnee } : { entree: x.entree, donnees: x.donnees.map((d) => d.donnee) })) }));
  assert.deepEqual(determinees, applicationsSollicitables(S.observation, D, S.univers).applications.map((a) => ({ operation: a.operation, liaisons: a.liaisons })));
});

// ------------------------------------------------------------------------------------------------------------------------ B. MULTI-ENTRÉES (couplage)
test('B1. MULTI-ENTRÉES : historique (A=chaîne,B=chaîne) et (A=nombre,B=nombre) ; présent chaîne/chaîne, chaîne/nombre, nombre/chaîne, nombre/nombre -> 1re et 4e correspondent à leur expérience, les croisées à AUCUNE (aucune recombinaison rôle par rôle)', () => {
  const p = present(CATM, [['c', CH], ['n', NB]]);
  const h = hist([exp('e1', 'couple', [ord('a', 'h1', CH), ord('b', 'h2', CH)]), exp('e2', 'couple', [ord('a', 'h3', NB), ord('b', 'h4', NB)])]);
  const r = correspondancesExperiences(p.observation, CATM, p.univers, h);
  assert.equal(r.applications.length, 4);
  const trouve = (a, b) => r.applications.find((x) => x.liaisons[0].forme.genre === a && x.liaisons[1].forme.genre === b);
  assert.deepEqual(trouve('chaine', 'chaine').correspondances.map((c) => c.idExecution), ['e1']);
  assert.deepEqual(trouve('nombre', 'nombre').correspondances.map((c) => c.idExecution), ['e2']);
  assert.deepEqual(trouve('chaine', 'nombre').correspondances, []);
  assert.deepEqual(trouve('nombre', 'chaine').correspondances, []);
  assert.deepEqual(r.applications.map((a) => a.statut), ['candidate', 'candidate', 'candidate', 'candidate']);
});
test('B2. couplage ET rôles : une expérience (A=chaîne,B=nombre) ne correspond qu\'à (A=chaîne,B=nombre), jamais à (A=nombre,B=chaîne) ; des rôles différents (a,c) ou en nombre différent ne correspondent à rien', () => {
  const p = present(CATM, [['c', CH], ['n', NB]]);
  const croisee = correspondancesExperiences(p.observation, CATM, p.univers, hist([exp('e1', 'couple', [ord('a', 'h1', CH), ord('b', 'h2', NB)])]));
  assert.deepEqual(croisee.applications.filter((a) => a.correspondances.length).map((a) => a.liaisons.map((l) => l.forme.genre)), [['chaine', 'nombre']]);
  const autresRoles = correspondancesExperiences(p.observation, CATM, p.univers, hist([exp('e1', 'couple', [ord('a', 'h1', CH), ord('c', 'h2', CH)])]));
  assert.equal(autresRoles.applications.some((a) => a.correspondances.length), false);
  const unSeul = correspondancesExperiences(p.observation, CATM, p.univers, hist([exp('e1', 'couple', [ord('a', 'h1', CH)])]));
  assert.equal(unSeul.applications.some((a) => a.correspondances.length), false);
});
test('B3. MÊME OPÉRATION seulement : une expérience d\'une autre opération, même de formes identiques, ne correspond jamais (aucune analogie inter-opérations)', () => {
  const p = present(CATM, [['c', CH], ['n', NB]]);
  const r = correspondancesExperiences(p.observation, CATM, p.univers, hist([exp('e1', 'autre', [ord('a', 'h1', CH), ord('b', 'h2', CH)])]));
  assert.equal(r.applications.some((a) => a.correspondances.length), false);
});
test('B4. ÉGALITÉ EXACTE des formes : l\'ordre des clés est sans effet ; une forme qui GARANTIT l\'autre sans lui être égale ne correspond PAS (pas de garantie asymétrique)', () => {
  const objetAB = { forme: 'objet', champs: { a: CH, b: NB } };
  const objetBA = { forme: 'objet', champs: { b: NB, a: CH } };
  const objetPlus = { forme: 'objet', champs: { a: CH, b: NB, c: CH } };
  const p = present(CATM, [['x', objetAB]]);
  const sansOrdre = correspondancesExperiences(p.observation, CATM, p.univers, hist([exp('e1', 'couple', [ord('a', 'h1', objetBA), ord('b', 'h2', objetBA)])]));
  assert.equal(sansOrdre.applications[0].correspondances.length, 1);
  const garantie = correspondancesExperiences(p.observation, CATM, p.univers, hist([exp('e1', 'couple', [ord('a', 'h1', objetPlus), ord('b', 'h2', objetPlus)])]));
  assert.deepEqual(garantie.applications[0].correspondances, [], 'objetPlus garantit objetAB mais ne lui est pas égal');
  const q = present(CATM, [['x', { forme: 'quelconque' }]]);
  assert.deepEqual(correspondancesExperiences(q.observation, CATM, q.univers, hist([exp('e1', 'couple', [ord('a', 'h1', CH), ord('b', 'h2', CH)])])).applications[0].correspondances, []);
});

// ------------------------------------------------------------------------------------------------------------------------ C. COLLECTIFS
const collectif = (entree, donnees) => ({ entree, donnees: donnees.map(([donnee, forme]) => ({ donnee, forme })) });
test('C1. COLLECTIF : historique [chaîne,nombre] ; présent [chaîne,nombre] correspond ; présent [nombre,chaîne] (autre ordre d\'identités) correspond AUSSI (ordre sans signification, comparaison canonique) ; [chaîne,nombre,nombre] et [chaîne] ne correspondent PAS', () => {
  const h = hist([exp('e1', 'ens', [collectif('elements', [['h1', CH], ['h2', NB]])])]);
  const cas = {
    'chaîne,nombre': [['m1', CH], ['m2', NB]],
    'nombre,chaîne (identités inversées)': [['a-nombre', NB], ['z-chaine', CH]],
    'chaîne,nombre,nombre': [['m1', CH], ['m2', NB], ['m3', NB]],
    'chaîne seule': [['m1', CH]],
  };
  const attendu = { 'chaîne,nombre': 1, 'nombre,chaîne (identités inversées)': 1, 'chaîne,nombre,nombre': 0, 'chaîne seule': 0 };
  for (const [nom, donnees] of Object.entries(cas)) {
    const p = present(CATC, donnees);
    const r = correspondancesExperiences(p.observation, CATC, p.univers, h);
    assert.equal(r.applications.length, 1, nom);
    assert.equal(r.applications[0].correspondances.length, attendu[nom], nom);
    assert.equal(r.applications[0].liaisons[0].donnees.length, donnees.length, `${nom} : une forme par donnée liée préservée`);
  }
});
test('C2. COLLECTIF : la structure préservée est rendue (formes de TOUTES les données réellement liées, triées par identité) ; une nature différente (collectif face à ordinaire) ne correspond pas', () => {
  const p = present(CATC, [['m2', NB], ['m1', CH]]);
  const h = hist([exp('e1', 'ens', [collectif('elements', [['h1', CH], ['h2', NB]])]), exp('e2', 'ens', [ord('elements', 'h3', CH)])]);
  const r = correspondancesExperiences(p.observation, CATC, p.univers, h);
  assert.deepEqual(r.applications[0].liaisons, [{ entree: 'elements', donnees: [{ donnee: 'm1', forme: CH }, { donnee: 'm2', forme: NB }] }]);
  assert.deepEqual(r.applications[0].correspondances.map((c) => c.idExecution), ['e1']);
});
test('C3. COLLECTIF RÉEL (elementsObservables) : les expériences réellement exécutées correspondent au collectif présent de même structure', async () => {
  const v = await vecue();
  const i = v.tours.findIndex((t, k) => k > 0 && histoireAvant(v.tours, v.l, k).experiences.some((e) => e.operation === 'elementsObservables'));
  assert.ok(i > 0);
  const r = presentDuTour(v.tours[i].S, histoireAvant(v.tours, v.l, i));
  const a = r.applications.find((x) => x.operation === 'elementsObservables');
  assert.equal(a.statut, 'determinee');
  assert.ok(a.liaisons[0].donnees.length >= 1);
});

// ------------------------------------------------------------------------------------------------------------------------ D. RÉPÉTITIONS, ORIGINES, REFUS
test('D1. RÉPÉTITIONS : quatre expériences distinctes de même structure -> quatre correspondances distinctes (jamais fusionnées, aucune fréquence, aucun compte rendu)', () => {
  const p = present(CATM, [['c', CH]]);
  const h = hist(['e1', 'e2', 'e3', 'e4'].map((id, k) => exp(id, 'couple', [ord('a', `x${k}`, CH), ord('b', `y${k}`, CH)])));
  const r = correspondancesExperiences(p.observation, CATM, p.univers, h);
  assert.equal(r.applications.length, 1);
  assert.deepEqual(r.applications[0].correspondances.map((c) => c.idExecution), ['e1', 'e2', 'e3', 'e4']);
  assert.equal(JSON.stringify(r).includes('frequence'), false);
  assert.equal(Object.keys(r.applications[0]).some((k) => /compte|nombre|frequence|score/i.test(k)), false);
});
test('D2. ORIGINES : mécanique et extérieure correspondent toutes deux ; l\'origine est conservée comme fait, sans pondération', () => {
  const p = present(CATM, [['c', CH]]);
  const h = hist([exp('e1', 'couple', [ord('a', 'x', CH), ord('b', 'y', CH)], { origine: 'mecanique' }), exp('e2', 'couple', [ord('a', 'x', CH), ord('b', 'y', CH)], { origine: 'exterieure' })]);
  const r = correspondancesExperiences(p.observation, CATM, p.univers, h);
  assert.deepEqual(r.applications[0].correspondances.map((c) => [c.idExecution, c.origine]), [['e1', 'mecanique'], ['e2', 'exterieure']]);
});
test('D3. ORIGINE RÉELLE : une exécution extérieure (applicationSollicitée) est une expérience qui correspond comme une exécution mécanique', async () => {
  const v = await vie(['bonjour Pixel'], { declencheur: false });
  const S1 = v.tours[0].S;
  const application = applicationsSollicitables(S1.observation, D, S1.univers).applications.find((a) => a.operation === 'parcourirStructure');
  assert.ok(application);
  await executerApplicationSollicitee({ observation: S1.observation, application, univers: S1.univers }, { magasin: v.magasin, table: TABLE_OPERATIONS });
  const l = await lignes(v.magasin);
  const h = formesEntreesRencontrees(l.designations, l.observations, l.valeurs, l.executions, D);
  assert.deepEqual(h.experiences.map((e) => e.origine), ['exterieure']);
  const r = correspondancesExperiences(S1.observation, D, S1.univers, h);
  const a = r.applications.find((x) => x.operation === 'parcourirStructure');
  assert.deepEqual(a.correspondances.map((c) => c.origine), ['exterieure']);
});
test('D4. REFUS HISTORIQUES : une expérience refusée ne correspond jamais ; la liste `refusees` est RELAYÉE telle quelle (aucune réinterprétation, aucune absence silencieuse)', async () => {
  const v = await vie(['bonjour Pixel', 'bonjour Luna']);
  const l = await lignes(v.magasin);
  const c = clone(l);
  const t1 = c.executions.find((e) => e.operation === 'parcourirStructure' && e.liaisons[0].donnee === 'message-1');
  for (const o of c.observations) { delete o.empreintesOperationsExaminees; delete o.empreintesCategoriesDonnees; delete o.empreintesContratsRelationnels; } // lignes ramenées à 6 clés : message non prouvé -> refus
  const h = histoireAvant(v.tours, c, 1);
  assert.deepEqual(h.experiences, []);
  assert.ok(h.refusees.some((r) => r.idExecution === t1.id));
  const r = presentDuTour(v.tours[1].S, h);
  assert.equal(r.applications.some((a) => a.correspondances.length > 0), false);
  assert.deepEqual(r.refusees, h.refusees);
  assert.notEqual(r.refusees, h.refusees);
  assert.notEqual(r.refusees[0], h.refusees[0]);
});
test('D5. HISTOIRE VIDE : toutes les applications sont rendues avec ZÉRO correspondance ; aucune n\'est invalide ni rejetée', async () => {
  const v = await vie(['bonjour Pixel'], { declencheur: false });
  const S = v.tours[0].S;
  const r = correspondancesExperiences(S.observation, D, S.univers, hist([]));
  assert.ok(r.applications.length > 0);
  for (const a of r.applications) assert.deepEqual(a.correspondances, []);
  assert.deepEqual(r.refusees, []);
});

// ------------------------------------------------------------------------------------------------------------------------ E. FORMES ACTUELLES, ENTRÉES MAL FORMÉES, PURETÉ
test('E1. FORMES ACTUELLES : lues sur l\'univers (forme DÉCLARÉE), jamais sur la valeur ni typeof ; deux données de même forme déclarée et de valeurs de types différents correspondent à la même expérience', () => {
  const p = present(CATM, [['c1', CH], ['c2', CH]]);
  p.univers[0].porteur = { id: 'c1', valeur: 42 }; p.univers[1].porteur = { id: 'c2', valeur: 'texte' };
  const h = hist([exp('e1', 'couple', [ord('a', 'h1', CH), ord('b', 'h2', CH)])]);
  const r = correspondancesExperiences(p.observation, CATM, p.univers, h);
  assert.equal(r.applications.length, 4);
  assert.equal(r.applications.every((a) => a.correspondances.length === 1), true);
  assert.equal(/porteur|\.acces\b|\bacces:/.test(CODE), false, 'ni porteur, ni accès, ni valeur lue : seulement les formes déclarées de l\'univers');
});
test('E2. ENTRÉES MAL FORMÉES -> TypeError : univers non tableau, identité absente de l\'univers ou dupliquée, historique non objet, expérience à clés incomplètes ou étrangères, rôle répété, entrée sans forme, refusée mal formée, accesseur', () => {
  const p = present(CATM, [['c', CH]]);
  const h = hist([exp('e1', 'couple', [ord('a', 'h1', CH), ord('b', 'h2', CH)])]);
  const appel = (...a) => correspondancesExperiences(...a);
  const [o, u] = [p.observation, p.univers];
  for (const mauvais of [null, {}, 'x']) assert.throws(() => appel(o, CATM, mauvais, h), TypeError);
  assert.throws(() => appel(o, CATM, u, null), TypeError);
  assert.throws(() => appel(o, CATM, u, {}), TypeError);
  assert.throws(() => appel(o, CATM, u, { experiences: [], refusees: 'x' }), TypeError);
  assert.throws(() => appel(o, 'x', u, h), TypeError);
  assert.throws(() => appel(null, CATM, u, h), TypeError);
  assert.throws(() => appel(o, CATM, [...u, u[0]], h), TypeError);
  assert.throws(() => appel(o, CATM, [], h), TypeError, 'identité liée absente de l\'univers');
  const sans = (cle) => { const e = clone(h.experiences[0]); delete e[cle]; return hist([e]); };
  for (const cle of ['idExecution', 'idDesignation', 'idObservation', 'operation', 'origine', 'entrees']) assert.throws(() => appel(o, CATM, u, sans(cle)), TypeError, cle);
  assert.throws(() => appel(o, CATM, u, hist([{ ...h.experiences[0], extra: 1 }])), TypeError);
  assert.throws(() => appel(o, CATM, u, hist([{ ...h.experiences[0], entrees: [ord('a', 'h1', CH), ord('a', 'h2', CH)] }])), TypeError);
  assert.throws(() => appel(o, CATM, u, hist([{ ...h.experiences[0], entrees: [] }])), TypeError);
  assert.throws(() => appel(o, CATM, u, hist([{ ...h.experiences[0], entrees: [{ entree: 'a', donnee: 'h1' }] }])), TypeError);
  assert.throws(() => appel(o, CATM, u, hist([{ ...h.experiences[0], entrees: [{ entree: 'a', donnees: [] }] }])), TypeError);
  assert.throws(() => appel(o, CATM, u, hist([], [{ idExecution: 'x' }])), TypeError);
  const accesseur = clone(h); Object.defineProperty(accesseur, 'refusees', { get() { return []; }, enumerable: true });
  assert.throws(() => appel(o, CATM, u, accesseur), TypeError);
});
test('E3. PURETÉ : entrées gelées en profondeur acceptées ; aucune entrée modifiée ; sortie déterministe, NEUVE à chaque appel et sans partage avec les entrées', () => {
  const p = present(CATM, [['c', CH], ['n', NB]]);
  const h = hist([exp('e1', 'couple', [ord('a', 'h1', CH), ord('b', 'h2', CH)])]);
  const avant = stable({ p, h, CATM });
  const gele = gelerProfond(clone({ p, h, CATM }));
  const r1 = correspondancesExperiences(gele.p.observation, gele.CATM, gele.p.univers, gele.h);
  const r2 = correspondancesExperiences(p.observation, CATM, p.univers, h);
  assert.deepEqual(r1, r2);
  assert.equal(stable({ p, h, CATM }), avant);
  assert.notEqual(r1, r2);
  const a = r2.applications.find((x) => x.correspondances.length);
  a.liaisons[0].forme.genre = 'x'; a.correspondances[0].entrees[0].forme.genre = 'x';
  assert.equal(h.experiences[0].entrees[0].forme.genre, 'chaine');
  assert.equal(p.univers[0].donnee.forme.genre, 'chaine');
});
test('E4. ORDRE SANS SIGNIFICATION : l\'ordre des expériences historiques fournies n\'ajoute ni ne retire aucune correspondance (même ensemble, ordre de `experiences` conservé)', async () => {
  const v = await vecue();
  const i = 6;
  const h = histoireAvant(v.tours, v.l, i);
  const r = presentDuTour(v.tours[i].S, h);
  const inverse = presentDuTour(v.tours[i].S, { experiences: [...h.experiences].reverse(), refusees: h.refusees });
  const ids = (res) => res.applications.map((a) => a.correspondances.map((c) => c.idExecution).sort());
  assert.deepEqual(ids(inverse), ids(r));
});

// ------------------------------------------------------------------------------------------------------------------------ F. SCÉNARIO VIVANT ET MESURES (T2, T3, T4, T7)
test('F1. SCÉNARIO 7 TOURS (MISE À JOUR DÉLIBÉRÉE v0.63.67 : modifié par composerCollection) : choix 0,1,4,13,13,13,13 ; auto 2,4,9,1,1,1,1 ; 19 exécutions ; zéro echec_* ; la vue n\'écrit rien et ne modifie aucune classification', async () => {
  const { tours, l, magasin } = await vecue();
  assert.deepEqual(tours.map((t) => t.S.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]); // MISE À JOUR DÉLIBÉRÉE v0.63.67
  assert.deepEqual(tours.map((t) => t.S.automatiques.length), [2, 4, 9, 1, 1, 1, 1]); // MISE À JOUR DÉLIBÉRÉE v0.63.67
  assert.equal(l.executions.length, 19); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 23 → 19
  for (const t of tours) for (const r of t.S.automatiques) assert.equal(String(r.statut).startsWith('echec_'), false);
  const avant = stable(await toutesLesTables(magasin));
  const classement = tours.map((t) => stable(applicationsSollicitables(t.S.observation, D, t.S.univers)));
  tours.forEach((t, i) => presentDuTour(t.S, histoireAvant(tours, l, i)));
  assert.equal(stable(await toutesLesTables(magasin)), avant);
  assert.deepEqual(tours.map((t) => stable(applicationsSollicitables(t.S.observation, D, t.S.univers))), classement);
});
// MESURE (pas un score) : pour chaque opération d'un choix ou déterminée : [applications actuelles, avec >=1 correspondance, avec 0, liens application<->expérience].
function mesure(r) {
  const m = {};
  for (const a of r.applications) { const x = (m[a.operation] ??= [0, 0, 0, 0]); x[0] += 1; if (a.correspondances.length) x[1] += 1; else x[2] += 1; x[3] += a.correspondances.length; }
  return m;
}
const MESURES = {
  1: { composerCollection: [1, 0, 1, 0], elementsObservables: [1, 0, 1, 0], parcourirStructure: [5, 1, 4, 1], projeterChemins: [1, 0, 1, 0], symbolesDeChaine: [1, 1, 0, 1] }, // MISE À JOUR DÉLIBÉRÉE v0.63.67 : mesures refaites avec la dix-septième opération (composerCollection : 1 application au tour 2, 2 au-delà, toutes avec correspondance ; symbolesDeChaine : 2 candidates dès le tour 2 ; parcourirStructure : 13, 34, 40 applications) ; rien n'est corrigé
  2: { composerCollection: [2, 2, 0, 2], elementsObservables: [1, 0, 1, 0], memesCouvertures: [1, 0, 1, 0], normaliserCouverture: [1, 0, 1, 0], parcourirStructure: [13, 2, 11, 2], partagerCouvertures: [1, 0, 1, 0], produireConstatsStructurels: [1, 0, 1, 0], produireSuitesFermees: [1, 0, 1, 0], projeterChemins: [2, 1, 1, 1], projeterContenus: [1, 0, 1, 0], rechercherSousSuites: [1, 0, 1, 0], resoudreCouverture: [1, 0, 1, 0], symbolesDeChaine: [2, 2, 0, 4] },
  3: { composerCollection: [2, 2, 0, 2], elementsObservables: [1, 1, 0, 1], memesCouvertures: [36, 36, 0, 36], normaliserCouverture: [6, 6, 0, 6], parcourirStructure: [34, 2, 32, 2], partagerCouvertures: [36, 36, 0, 36], produireConstatsStructurels: [2, 2, 0, 2], produireSuitesFermees: [2, 2, 0, 2], projeterChemins: [4, 1, 3, 1], projeterContenus: [4, 2, 2, 2], rechercherSousSuites: [12, 12, 0, 12], resoudreCouverture: [14, 5, 9, 5], resoudreElements: [4, 0, 4, 0], symbolesDeChaine: [2, 2, 0, 4] },
  6: { composerCollection: [2, 2, 0, 2], elementsObservables: [1, 1, 0, 4], memesCouvertures: [36, 36, 0, 36], normaliserCouverture: [6, 6, 0, 6], parcourirStructure: [40, 2, 38, 2], partagerCouvertures: [36, 36, 0, 36], produireConstatsStructurels: [5, 5, 0, 5], produireSuitesFermees: [5, 5, 0, 5], projeterChemins: [7, 1, 6, 1], projeterContenus: [7, 5, 2, 5], rechercherSousSuites: [30, 30, 0, 30], resoudreCouverture: [20, 5, 15, 5], resoudreElements: [10, 0, 10, 0], symbolesDeChaine: [2, 2, 0, 4] },
};
test('F2. MESURES T2, T3, T4, T7 (index 1, 2, 3, 6), histoire = exécutions des tours précédents : applications actuelles, avec >=1 correspondance, avec 0, liens — constat, jamais un score', async () => {
  const { tours, l } = await vecue();
  for (const [i, attendu] of Object.entries(MESURES)) {
    const r = presentDuTour(tours[i].S, histoireAvant(tours, l, Number(i)));
    assert.deepEqual(mesure(r), attendu, `tour ${Number(i) + 1}`);
    assert.equal(tours[i].S.choixAFaire.length, [1, 4, 13, 13][Object.keys(MESURES).indexOf(i)], 'choixAFaire inchangé'); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 1,2,11,11 → 1,4,13,13
  }
});

// ------------------------------------------------------------------------------------------------------------------------ G. DORMANCE ET PURETÉ
test('G1. DORMANCE : aucun fichier de app/ ne nomme le module ni la fonction en dehors de lui-même ; ni applications-sollicitables, execution-mecanique, main, pont, contexte-sollicitation, esprit', () => {
  const sources = [];
  const parcourir = (dossier) => { for (const nom of readdirSync(dossier)) { const chemin = join(dossier, nom); if (statSync(chemin).isDirectory()) parcourir(chemin); else if (/\.(m?js|html)$/.test(nom)) sources.push(chemin); } };
  parcourir(join(RACINE, 'app'));
  const rel = (f) => relative(RACINE, f).split('\\').join('/');
  assert.deepEqual(sources.filter((f) => /correspondances-experiences|correspondancesExperiences/.test(readFileSync(f, 'utf8'))).map(rel), ['app/langage/correspondances-experiences.js']);
  for (const f of sources.filter((s) => /[\\/]esprit[\\/]/.test(s))) assert.equal(/correspondances-experiences/.test(readFileSync(f, 'utf8')), false, f);
  for (const autre of ['sw.js', 'worker.js', 'index.html', 'app/sw.js', 'app/index.html', 'app/manifest.webmanifest']) { let s = ''; try { s = lu(...autre.split('/')); } catch { continue; } assert.equal(/correspondances-experiences/.test(s), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => /correspondances/i.test(d.nom)), false);
  assert.equal(Object.keys(TABLE_OPERATIONS).some((n) => /correspondances/i.test(n)), false);
});
test('G2. IMPORTS EXACTS : la classification existante et les groupes de candidats seulement ; la vue historique n\'est PAS importée (aucune seconde reconstruction) ; ni magasin, horloge, hasard, identité générée, asynchronisme, état global', () => {
  assert.deepEqual([...CODE.matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./applications-sollicitables.js', './groupes-candidats.js']);
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'crypto', 'setTimeout', 'require(', 'typeof valeur', 'formesEntreesRencontrees', 'formes-rencontrees', 'resoudreContexteObservation']) assert.equal(CODE.includes(interdit), false, interdit);
  assert.deepEqual(Object.keys(module), ['correspondancesExperiences']);
  assert.equal(/\blet\b/.test(CODE.replace(/for \(let rang/g, '')), false, 'aucun état modifiable de module');
});
test('G3. AUCUNE PERSISTANCE NI EFFET : ni table, ni VERSION_BASE, ni migration, ni champ ; catalogue (16) et table d\'opérations (16) inchangés ; aucun score, fréquence, préférence ni choix dans le module', () => {
  assert.equal(VERSION_BASE, 24); assert.equal(TABLES.length, 30); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables)
  assert.equal(D.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(/ecrire|enregistrer|persist/.test(CODE), false);
  assert.equal(/score|frequence|preferer|choisir\(|deduplique|nouveaute/i.test(CODE.replace(/refuser\(/g, '')), false);
});
// === FIN_TEST_CORRESPONDANCES_EXPERIENCES ===
