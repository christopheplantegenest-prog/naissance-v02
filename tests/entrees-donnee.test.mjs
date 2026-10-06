// v0.63.55 — « DONNÉE ADJACENTE : ENTRÉES D'UNE PRODUCTION » (décision ChatGPT, 06/10/2026) : identité dérivée, forme, accès, porteur synthétique,
// résolution par resoudreIdentitesDonnees. Tout est DORMANT : ni snapshot, ni persistance, ni catalogue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import * as moduleDonnee from '../app/langage/entrees-donnee.js';
import { PREFIXE_IDENTITE_ENTREES, FORME_ENTREES_PRODUCTION, ACCES_ENTREES_PRODUCTION, estIdentiteEntrees, identiteEntreesProduction, productionDesEntrees } from '../app/langage/entrees-donnee.js';
import { entreesDeProduction } from '../app/langage/entrees-production.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { resoudreContexteObservation } from '../app/langage/contexte-observation.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { possibilitesDeLiaison } from '../app/langage/possibilites-liaison.js';
import { sousValeurConforme } from '../app/langage/sous-donnees.js';
import { validerDescripteurOperation } from '../app/langage/formes-operation.js';
import { DESCRIPTIONS_OPERATIONS as C16 } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { ACCES_VALEUR_DONNEE } from '../app/langage/valeur-donnee.js';
import { ACCES_TRACE } from '../app/langage/acces-trace.js';
import { applicationsSollicitables } from '../app/langage/applications-sollicitables.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { VERSION_BASE, TABLES, magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
const CODE = sansCommentaires(lu('app', 'langage', 'entrees-donnee.js'));
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (motif === undefined || motif.test(e.message)));
const clone = (v) => JSON.parse(JSON.stringify(v));
const gelProfond = (v) => { if (v && typeof v === 'object') { Object.freeze(v); for (const k of Reflect.ownKeys(v)) gelProfond(v[k]); } return v; };
const FORME_ATTENDUE = { forme: 'collection', elements: { forme: 'objet', champs: { entree: { forme: 'scalaire', genre: 'chaine' }, donnee: { forme: 'scalaire', genre: 'chaine', peutManquer: true }, donnees: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' }, peutManquer: true } } } };
const idEnt = identiteEntreesProduction;
const resoudre = (ids, l, d = C16) => resoudreIdentitesDonnees(ids, l.valeurs, l.executions, d);

// ---- chaîne réelle (mêmes mécanismes que le flux vivant)
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
    const application = liaisons ? { operation, liaisons } : applicationsSollicitables(t.observation).applications.find((a) => a.operation === operation);
    assert.ok(application, operation);
    const r = await executerApplicationSollicitee({ observation: t.observation, application, univers: t.univers }, { magasin, table: TABLE_OPERATIONS });
    assert.equal(r.statut, 'executee', `${operation} : ${r.erreur && r.erreur.message}`);
    return { ...r, t };
  }
  const lire = async () => ({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations'), designations: await magasin.lireTout('designations'), observations: await magasin.lireTout('observationsPossibilites') });
  return { magasin, tour, lancer, lire };
}
let CACHE = null;
async function chaine() {
  if (CACHE) return CACHE;
  const w = monde(); const E = {};
  E.A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  E.B = await w.lancer('salut Pixel', 'symbolesDeChaine');
  E.P = await w.lancer('tour P', 'elementsObservables');
  E.S = await w.lancer('tour S', 'produireSuitesFermees', [{ entree: 'elements', donnee: E.P.execution.id }]);
  E.M = await w.lancer('tour M', 'projeterContenus', [{ entree: 'elements', donnee: E.S.execution.id }]);
  E.H = await w.lancer('tour H', 'projeterChemins', [{ entree: 'elements', donnee: E.P.execution.id }]);
  E.Q = await w.lancer('tour Q', 'partagerCouvertures', [{ entree: 'a', donnee: E.H.execution.id }, { entree: 'b', donnee: E.H.execution.id }]);
  E.AY = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  E.PY = await w.lancer('tour PY', 'elementsObservables');
  E.R = await w.lancer('tour R', 'rechercherSousSuites', [{ entree: 'motifs', donnee: E.M.execution.id }, { entree: 'elements', donnee: E.PY.execution.id }]);
  const l0 = await w.lire();
  const sousCommuns = l0.executions.find((e) => e.id === E.Q.execution.id).sousDonnees.find((s) => s.chemin[0] === 'communs').id;
  E.N = await w.lancer('tour N', 'normaliserCouverture', [{ entree: 'chemins', donnee: sousCommuns }]);
  const l = await w.lire();
  CACHE = { w, E, l, sousCommuns, id: (k) => E[k].execution.id, ligne: (k) => l.executions.find((e) => e.id === E[k].execution.id) };
  return CACHE;
}

// ============================================================================ A. IDENTITÉ DÉRIVÉE
test('A1. surface du module : constantes et trois fonctions pures ; le préfixe réservé est celui documenté', () => {
  assert.deepEqual(Object.keys(moduleDonnee).sort(), ['ACCES_ENTREES_PRODUCTION', 'FORME_ENTREES_PRODUCTION', 'PREFIXE_IDENTITE_ENTREES', 'estIdentiteEntrees', 'identiteEntreesProduction', 'productionDesEntrees']);
  assert.equal(PREFIXE_IDENTITE_ENTREES, 'entrees-de-production:');
  for (const f of [estIdentiteEntrees, identiteEntreesProduction, productionDesEntrees]) assert.equal(f.constructor.name, 'Function', 'synchrone');
  assert.equal(idEnt('execution-operation-1-2-3'), 'entrees-de-production:execution-operation-1-2-3');
});
test('A2. INJECTIVITÉ et inverse strict : productionDesEntrees(identiteEntreesProduction(x)) === x, sans trim ni normalisation, pour des identités pièges', () => {
  const pieges = ['a', 'x:y', ':', '::', ' a', 'a ', 'a\n', 'é', 'Z', 'entrees-de-production', 'entrees-de-productio:x', 'xentrees-de-production:y', 'a:entrees-de-production:b', 'entrees:de:production:', 'execution-operation-1791291018118-3-634', 'sous-donnee-1-2-3', '\u0000', '😀', 'a'.repeat(5000)];
  let graine = 12345; const alea = () => { graine = (graine + 0x6D2B79F5) | 0; let t = Math.imul(graine ^ (graine >>> 15), 1 | graine); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return (t ^ (t >>> 14)) >>> 0; };
  const alphabet = ['a', 'b', ':', '-', ' ', 'e', 'n', 't', 'r', 'é', 'p'];
  for (let i = 0; i < 3000; i += 1) { let s = ''; const n = 1 + (alea() % 40); for (let k = 0; k < n; k += 1) s += alphabet[alea() % alphabet.length]; pieges.push(s); }
  const domaine = [...new Set(pieges)].filter((x) => !x.startsWith(PREFIXE_IDENTITE_ENTREES));
  const images = new Map();
  for (const x of domaine) {
    const y = idEnt(x);
    assert.equal(productionDesEntrees(y), x, JSON.stringify(x));
    assert.equal(estIdentiteEntrees(y), true);
    assert.equal(images.has(y), false, 'deux identités du domaine ne partagent jamais une image');
    images.set(y, x);
    assert.equal(idEnt(x), y, 'déterministe');
    assert.equal(domaine.includes(y) && estIdentiteEntrees(y), false, 'une image n\'est jamais dans le domaine');
  }
  assert.ok(domaine.length > 1000);
});
test('A3. DOMAINE : chaîne non vide ne commençant pas par le préfixe ; tout le reste est un TypeError (aucune re-dérivation, aucune devinette)', () => {
  for (const mauvais of [undefined, null, 3, {}, [], '', true, Symbol('x')]) refuse(() => idEnt(mauvais));
  refuse(() => idEnt(PREFIXE_IDENTITE_ENTREES), /préfixe réservé/);
  refuse(() => idEnt(idEnt('x')), /re-dérivée/);
  refuse(() => idEnt(PREFIXE_IDENTITE_ENTREES + 'x'), /préfixe réservé/);
});
test('A4. RECONNAISSANCE et inverse : seuls « préfixe + reste » avec un reste non vide ne commençant pas par le préfixe sont dans l\'image', () => {
  for (const hors of ['', 'x', 'entrees-de-production', PREFIXE_IDENTITE_ENTREES, PREFIXE_IDENTITE_ENTREES + PREFIXE_IDENTITE_ENTREES + 'x', ' ' + PREFIXE_IDENTITE_ENTREES + 'x', 'ENTREES-DE-PRODUCTION:x']) {
    assert.equal(estIdentiteEntrees(hors), false, JSON.stringify(hors));
    refuse(() => productionDesEntrees(hors), /n'est pas une identité d'entrées/);
  }
  for (const nonChaine of [undefined, null, 3, {}, []]) { assert.equal(estIdentiteEntrees(nonChaine), false); refuse(() => productionDesEntrees(nonChaine)); }
  assert.equal(estIdentiteEntrees(PREFIXE_IDENTITE_ENTREES + 'x'), true);
  assert.equal(productionDesEntrees(PREFIXE_IDENTITE_ENTREES + 'a:b'), 'a:b');
});
test('A5. les identités réelles du système (messages, exécutions, sous-données) ne sont jamais dans l\'image : aucune ne commence par le préfixe', async () => {
  const c = await chaine();
  const tous = [...c.l.valeurs.map((v) => v.id), ...c.l.executions.map((e) => e.id), ...c.l.executions.flatMap((e) => (e.sousDonnees || []).map((s) => s.id))];
  assert.ok(tous.length >= 24);
  for (const id of tous) { assert.equal(id.startsWith(PREFIXE_IDENTITE_ENTREES), false, id); assert.equal(estIdentiteEntrees(id), false); }
});

// ============================================================================ B. FORME CONSTANTE
test('B1. FORME_ENTREES_PRODUCTION : exactement la forme demandée, gelée en profondeur, valide pour le langage de formes', () => {
  assert.deepEqual(FORME_ENTREES_PRODUCTION, FORME_ATTENDUE);
  const gelee = (v) => v === null || typeof v !== 'object' || (Object.isFrozen(v) && Reflect.ownKeys(v).every((k) => gelee(v[k])));
  assert.equal(gelee(FORME_ENTREES_PRODUCTION), true);
  assert.doesNotThrow(() => validerDescripteurOperation({ nom: 'sonde', entrees: { a: { forme: 'scalaire', genre: 'chaine' } }, sortie: FORME_ENTREES_PRODUCTION }));
});
test('B2. toutes les liaisons réellement persistées de la chaîne sont conformes à la forme (ordinaires et collectives)', async () => {
  const c = await chaine();
  for (const e of c.l.executions) assert.doesNotThrow(() => sousValeurConforme(e.liaisons, FORME_ENTREES_PRODUCTION, 'liaisons'));
  assert.ok(c.l.executions.some((e) => e.liaisons.some((q) => q.donnees)) && c.l.executions.some((e) => e.liaisons.some((q) => q.donnee)));
});
test('B3. la forme ne dépend ni de l\'opération productrice ni du catalogue : même forme pour toutes les exécutions, même avec un catalogue réduit', async () => {
  const c = await chaine();
  const ids = c.l.executions.map((e) => idEnt(e.id));
  const complet = resoudre(ids, c.l);
  assert.equal(complet.length, ids.length);
  for (const x of complet) assert.deepEqual(x.donnee.forme, FORME_ATTENDUE);
  // un catalogue qui ne décrit AUCUNE opération ne gêne pas la donnée adjacente (forme constante), alors qu'il gêne le résultat
  const reduit = resoudre(ids, c.l, []);
  assert.deepEqual(reduit.map((x) => x.donnee), complet.map((x) => x.donnee));
  refuse(() => resoudre([c.id('R')], c.l, []), /forme est indéterminée/);
});
test('B4. avec C16, une donnée de cette forme n\'est compatible QUE de couvrirSequence.elements et parcourirStructure.valeur ; aucune entrée collective n\'est perturbée', () => {
  const atomes = possibilitesDeLiaison([{ identite: 'sonde-x', forme: clone(FORME_ENTREES_PRODUCTION) }], C16);
  assert.deepEqual(atomes.map((a) => `${a.operation}.${a.entree}`).sort(), ['couvrirSequence.elements', 'parcourirStructure.valeur']);
  assert.equal(C16.length, 16);
});

// ============================================================================ C. ACCÈS PROPRE
test('C1. ACCES_ENTREES_PRODUCTION = { champ: \'entrees\' }, gelé, distinct de ACCES_TRACE et de l\'accès d\'un message', () => {
  assert.deepEqual(ACCES_ENTREES_PRODUCTION, { champ: 'entrees' });
  assert.equal(Object.isFrozen(ACCES_ENTREES_PRODUCTION), true);
  assert.notDeepEqual(ACCES_ENTREES_PRODUCTION, ACCES_TRACE);
  assert.notDeepEqual(ACCES_ENTREES_PRODUCTION, ACCES_VALEUR_DONNEE);
});
test('C2. valeurDePorteur sait DÉJÀ lire ce champ générique (non modifié) : il rend exactement porteur.entrees, et exige toujours porteur.id === donnee.identite', () => {
  assert.equal(/entrees/.test(lu('app', 'langage', 'acces-valeur.js')), false, 'acces-valeur.js ne connaît pas ce champ : il est générique');
  const entrees = [{ entree: 'a', donnee: 'x' }];
  const porteur = { id: 'entrees-de-production:e1', entrees };
  assert.equal(valeurDePorteur(porteur, { identite: porteur.id }, ACCES_ENTREES_PRODUCTION), entrees);
  refuse(() => valeurDePorteur(porteur, { identite: 'autre' }, ACCES_ENTREES_PRODUCTION), /ne correspond pas/);
  refuse(() => valeurDePorteur({ id: porteur.id, resultat: entrees }, { identite: porteur.id }, ACCES_ENTREES_PRODUCTION), /champ « entrees »/);
});

// ============================================================================ D. RÉSOLUTION
test('D1. resoudreIdentitesDonnees([idEntrees(E)]) rend { donnee: {identite, forme}, porteur: {id, entrees}, acces } exact, valeur = entreesDeProduction', async () => {
  const c = await chaine();
  for (const k of ['A', 'P', 'S', 'M', 'H', 'Q', 'PY', 'R', 'N']) {
    const id = idEnt(c.id(k));
    const r = resoudre([id], c.l);
    assert.equal(r.length, 1);
    assert.deepEqual(Object.keys(r[0]), ['donnee', 'porteur', 'acces']);
    assert.deepEqual(r[0].donnee, { identite: id, forme: FORME_ATTENDUE });
    assert.deepEqual(Object.keys(r[0].porteur), ['id', 'entrees']);
    assert.equal(r[0].porteur.id, id);
    assert.deepEqual(r[0].porteur.entrees, entreesDeProduction(c.id(k), c.l.executions));
    assert.deepEqual(r[0].porteur.entrees, c.ligne(k).liaisons);
    assert.deepEqual(r[0].acces, ACCES_ENTREES_PRODUCTION);
    assert.deepEqual(valeurDePorteur(r[0].porteur, r[0].donnee, r[0].acces), c.ligne(k).liaisons);
  }
});
test('D2. COPIE : deux résolutions indépendantes = valeurs profondément égales, porteurs / tableaux / objets / formes distincts ; aucune mutation de la ligne persistée', async () => {
  const c = await chaine();
  const avant = clone(c.l);
  const id = idEnt(c.id('PY'));
  const [a] = resoudre([id], c.l); const [b] = resoudre([id], c.l);
  assert.deepEqual(a, b);
  assert.notEqual(a.porteur, b.porteur); assert.notEqual(a.porteur.entrees, b.porteur.entrees); assert.notEqual(a.donnee, b.donnee); assert.notEqual(a.donnee.forme, b.donnee.forme);
  assert.notEqual(a.donnee.forme, FORME_ENTREES_PRODUCTION, 'copie de la constante, jamais la constante');
  assert.notEqual(a.porteur.entrees, c.ligne('PY').liaisons);
  a.porteur.entrees[0].donnees.push('intrus'); a.porteur.entrees.push({ entree: 'z', donnee: 'y' }); a.donnee.forme.elements.champs.entree.genre = 'nombre'; a.donnee.identite = 'x';
  assert.deepEqual(c.l, avant, 'tables inchangées');
  assert.deepEqual(FORME_ENTREES_PRODUCTION, FORME_ATTENDUE, 'constante inchangée');
  assert.deepEqual(resoudre([id], c.l)[0], b);
});
test('D3. tables PROFONDÉMENT GELÉES acceptées ; la résolution ne modifie rien', async () => {
  const c = await chaine();
  const l = gelProfond(clone(c.l));
  const [r] = resoudre([idEnt(c.id('R'))], l);
  assert.deepEqual(r.porteur.entrees, c.ligne('R').liaisons);
  r.porteur.entrees[0].entree = 'modifie';
  assert.equal(l.executions.find((e) => e.id === c.id('R')).liaisons[0].entree, 'elements');
});
test('D4. ORDRE, DOUBLONS et mélange de catégories : la sortie suit exactement les identités demandées ; une identité demandée deux fois donne deux éléments distincts ; la donnée résultat de E se résout comme avant', async () => {
  const c = await chaine();
  const R = c.id('R'); const M = c.id('M'); const msg = c.l.valeurs[0].id; const sd = c.sousCommuns;
  const demandes = [idEnt(R), msg, R, idEnt(R), sd, M, idEnt(M)];
  const r = resoudre(demandes, c.l);
  assert.deepEqual(r.map((x) => x.donnee.identite), demandes);
  assert.notEqual(r[0].porteur, r[3].porteur); assert.deepEqual(r[0], r[3]);
  for (const [i, id] of [[1, msg], [2, R], [4, sd], [5, M]]) assert.deepEqual(r[i], resoudre([id], c.l)[0], 'résolution inchangée pour les catégories existantes');
  assert.deepEqual(r[2].acces, ACCES_TRACE); assert.deepEqual(r[1].acces, ACCES_VALEUR_DONNEE);
  assert.equal(r[2].porteur, c.l.executions.find((e) => e.id === R), 'le porteur du résultat reste la ligne');
  assert.deepEqual(resoudre([], c.l), []);
});
test('D5. la résolution d\'une identité d\'entrées ne dépend ni de l\'ordre des lignes ni des horodatages', async () => {
  const c = await chaine();
  const a = resoudre([idEnt(c.id('R'))], c.l);
  const b = resoudre([idEnt(c.id('R'))], { ...c.l, executions: [...c.l.executions].reverse(), valeurs: [...c.l.valeurs].reverse() });
  assert.deepEqual(a, b);
  const l2 = clone(c.l); for (const e of l2.executions) e.horodatage = '1999-01-01T00:00:00.000Z';
  assert.deepEqual(resoudre([idEnt(c.id('R'))], l2), a);
});
test('D6. PAS de lecture du résultat : seul `liaisons` et `operation` de la ligne source comptent ; un résultat illisible n\'empêche pas la donnée adjacente', async () => {
  const c = await chaine();
  const l = clone(c.l);
  const ligne = l.executions.find((e) => e.id === c.id('A'));
  Object.defineProperty(ligne, 'resultat', { get() { throw new Error('ne doit jamais être lu'); }, enumerable: true, configurable: true });
  const [r] = resoudre([idEnt(c.id('A'))], l);
  assert.deepEqual(r.porteur.entrees, c.ligne('A').liaisons);
});

// ============================================================================ E. COLLISIONS ET SOURCES INVALIDES
test('E1. une identité de MESSAGE, d\'EXÉCUTION ou de SOUS-DONNÉE qui porte le préfixe réservé est refusée (même non demandée), sans priorité implicite', async () => {
  const c = await chaine();
  const pieges = {
    message: (l) => { l.valeurs.push({ id: idEnt('quelconque'), valeur: 'x' }); },
    execution: (l) => { l.executions[0].id = idEnt('quelconque'); },
    sousDonnee: (l) => { l.executions.find((e) => e.sousDonnees).sousDonnees[0].id = idEnt('quelconque'); },
  };
  for (const [nom, piege] of Object.entries(pieges)) {
    const l = clone(c.l); piege(l);
    refuse(() => resoudre([c.id('R')], l), /préfixe réservé/);
    refuse(() => resoudre([idEnt(c.id('R'))], l), /préfixe réservé/);
    assert.ok(nom);
  }
  // collision exacte : message ET exécution portant la même identité dérivée → refus (aucune des deux ne gagne)
  const l = clone(c.l); const derive = idEnt(c.id('R'));
  l.valeurs.push({ id: derive, valeur: 'x' }); l.executions.find((e) => e.id === c.id('A')).id = derive;
  refuse(() => resoudre([derive], l));
  // identité (non dérivée) portée à la fois par un message et une exécution : comportement antérieur conservé
  const l2 = clone(c.l); l2.valeurs.push({ id: c.id('R'), valeur: 'x' });
  refuse(() => resoudre([idEnt(c.id('R'))], l2), /message ET par une exécution/);
});
test('E2. plusieurs lignes d\'exécution avec idE : refus (productionsDecrites / entreesDeProduction)', async () => {
  const c = await chaine();
  const l = clone(c.l); l.executions.push(clone(l.executions.find((e) => e.id === c.id('R'))));
  refuse(() => resoudre([idEnt(c.id('R'))], l));
  refuse(() => entreesDeProduction(c.id('R'), l.executions), /exécutions portent l'identité/);
});
test('E3. SANS PRODUCTEUR : chaîne syntaxiquement dérivée dont la source n\'existe pas, préfixe seul, double préfixe : TypeError', async () => {
  const c = await chaine();
  for (const faux of [PREFIXE_IDENTITE_ENTREES + 'inexistante', PREFIXE_IDENTITE_ENTREES, PREFIXE_IDENTITE_ENTREES + PREFIXE_IDENTITE_ENTREES + c.id('R'), idEnt(idEnt.name ? 'x' : 'y')]) refuse(() => resoudre([faux], c.l));
  refuse(() => resoudre([PREFIXE_IDENTITE_ENTREES + 'inexistante'], c.l), /n'a pas de production source/);
  refuse(() => resoudre([PREFIXE_IDENTITE_ENTREES], c.l), /ressemble à une identité d'entrées mais n'en est pas une/);
  refuse(() => resoudre([PREFIXE_IDENTITE_ENTREES + PREFIXE_IDENTITE_ENTREES + c.id('R')], c.l), /ressemble à une identité d'entrées/);
  refuse(() => resoudre([idEnt(c.id('R')), PREFIXE_IDENTITE_ENTREES + 'inexistante'], c.l), undefined); // aucun résultat partiel
});
test('E4. ligne source MAL FORMÉE (liaisons invalides) : TypeError, aucune donnée partielle ; le résultat de la même production se résout toujours comme avant', async () => {
  const c = await chaine();
  const l = clone(c.l); l.executions.find((e) => e.id === c.id('R')).liaisons = [{ entree: 'x', donnee: 'a', donnees: ['b'] }];
  refuse(() => resoudre([idEnt(c.id('R'))], l), /ne sont pas exposables/);
  assert.equal(resoudre([c.id('R')], l).length, 1);
});
test('E5. arguments invalides : comportement existant de resoudreIdentitesDonnees conservé', async () => {
  const c = await chaine();
  for (const mauvais of [undefined, null, 'x', {}]) refuse(() => resoudreIdentitesDonnees(mauvais, c.l.valeurs, c.l.executions, C16));
  refuse(() => resoudre([''], c.l)); refuse(() => resoudre([3], c.l));
  refuse(() => resoudre(['inconnue'], c.l), /identité inconnue/);
});

// ============================================================================ F. MESSAGE ET α2
test('F1. MESSAGE : l\'identité dérivée d\'un id de message est lexicalement valide mais la RÉSOLUTION refuse (aucune donnée entrées pour un message)', async () => {
  const c = await chaine();
  for (const v of c.l.valeurs) {
    const derive = idEnt(v.id);
    assert.equal(estIdentiteEntrees(derive), true);
    refuse(() => resoudre([derive], c.l), /n'a pas de production source/);
  }
});
test('F2. SOUS-DONNÉE α2 : idéntité dérivée de l\'id d\'une sous-donnée refusée ; aucune remontée vers le parent', async () => {
  const c = await chaine();
  const sous = c.ligne('Q').sousDonnees.map((s) => s.id);
  assert.equal(sous.length, 3);
  for (const id of sous) refuse(() => resoudre([idEnt(id)], c.l), /n'a pas de production source/);
  // la sous-donnée elle-même se résout normalement (porteur synthétique { id, resultat }, accès ACCES_TRACE)
  const [d] = resoudre([sous[0]], c.l);
  assert.deepEqual(Object.keys(d.porteur), ['id', 'resultat']); assert.deepEqual(d.acces, ACCES_TRACE);
});
test('F3. la dérivation est purement lexicale : on ne prétend PAS valider la catégorie sans consulter les lignes (idEntrees(msg) existe comme chaîne)', () => {
  assert.equal(idEnt('message-1'), PREFIXE_IDENTITE_ENTREES + 'message-1');
  assert.equal(/lireTout|executions|magasin/.test(CODE), false);
});

// ============================================================================ G. CAS R, COMPOSITION, ARBRE
test('G1. CAS R : idEntrees(R) se résout en donnée adjacente contenant exactement elements → P_Y, motifs → M (ordre canonique persisté)', async () => {
  const c = await chaine();
  const [d] = resoudre([idEnt(c.id('R'))], c.l);
  assert.deepEqual(valeurDePorteur(d.porteur, d.donnee, d.acces), [{ entree: 'elements', donnee: c.id('PY') }, { entree: 'motifs', donnee: c.id('M') }]);
});
test('G2. COMPOSITION (identités extraites dans le TEST seulement) : on retrouve M et P_Y avec leurs formes exactes, celles du catalogue courant', async () => {
  const c = await chaine();
  const [d] = resoudre([idEnt(c.id('R'))], c.l);
  const ids = valeurDePorteur(d.porteur, d.donnee, d.acces).flatMap((q) => q.donnees || [q.donnee]);
  assert.deepEqual(ids, [c.id('PY'), c.id('M')]);
  const r = resoudre(ids, c.l);
  const formes = new Map(productionsDecrites(c.l.executions, C16).map((p) => [p.identite, p.forme]));
  assert.deepEqual(r.map((x) => x.donnee), ids.map((id) => ({ identite: id, forme: formes.get(id) })));
  assert.deepEqual(r.map((x) => x.acces), [ACCES_TRACE, ACCES_TRACE]);
});
test('G3. ARBRE COMPLET depuis R : chaque ensemble d\'entrées traversé est une VRAIE donnée { identite, forme, porteur, acces } lue par valeurDePorteur ; les messages sont les feuilles', async () => {
  const c = await chaine();
  const feuilles = []; const donneesEntrees = [];
  function arbre(id) {
    const [element] = resoudre([id], c.l);
    if (element.acces.champ === ACCES_VALEUR_DONNEE.champ && element.acces !== undefined && JSON.stringify(element.acces) === JSON.stringify(ACCES_VALEUR_DONNEE)) { feuilles.push(id); return { message: id }; }
    const [adjacente] = resoudre([idEnt(id)], c.l);
    assert.deepEqual(adjacente.acces, ACCES_ENTREES_PRODUCTION);
    assert.deepEqual(adjacente.donnee.forme, FORME_ATTENDUE);
    donneesEntrees.push(adjacente.donnee.identite);
    const liaisons = valeurDePorteur(adjacente.porteur, adjacente.donnee, adjacente.acces);
    return { production: id, entrees: liaisons.map((x) => (x.donnees === undefined ? { entree: x.entree, de: [arbre(x.donnee)] } : { entree: x.entree, collectif: true, de: x.donnees.map(arbre) })) };
  }
  const t = arbre(c.id('R'));
  const m = (k) => c.E[k].execution.liaisons[0].donnee;
  const msg = (k) => ({ message: m(k) });
  const A = { production: c.id('A'), entrees: [{ entree: 'chaine', de: [msg('A')] }] };
  const B = { production: c.id('B'), entrees: [{ entree: 'chaine', de: [msg('B')] }] };
  const AY = { production: c.id('AY'), entrees: [{ entree: 'chaine', de: [msg('AY')] }] };
  const P = { production: c.id('P'), entrees: [{ entree: 'elements', collectif: true, de: [A, B] }] };
  const attendu = {
    production: c.id('R'),
    entrees: [
      { entree: 'elements', de: [{ production: c.id('PY'), entrees: [{ entree: 'elements', collectif: true, de: [A, B, AY] }] }] },
      { entree: 'motifs', de: [{ production: c.id('M'), entrees: [{ entree: 'elements', de: [{ production: c.id('S'), entrees: [{ entree: 'elements', de: [P] }] }] }] }] },
    ],
  };
  assert.deepEqual(t, attendu, 'même arbre que v0.63.54');
  assert.equal(new Set(feuilles).size, 3);
  assert.ok(donneesEntrees.every((x) => estIdentiteEntrees(x)) && donneesEntrees.length >= 8);
});
test('G4. aucun texte, valeur, id codé ni ordre temporel : la récursion n\'a utilisé que les identités, les formes et les accès rendus', async () => {
  const src = sansCommentaires(readFileSync(new URL(import.meta.url), 'utf8'));
  const g3 = src.slice(src.indexOf("test('G3."), src.indexOf("test('G4."));
  assert.equal(/\.valeur\b|horodatage|texte|Date\b/.test(g3), false);
});

// ============================================================================ H. COLLECTIFS ET α2 EN ENTRÉE
test('H1. COLLECTIFS : P et P_Y gardent UNE liaison collective { entree, donnees:[…] } complète et sans doublon', async () => {
  const c = await chaine();
  for (const [k, attendu] of [['P', [c.id('A'), c.id('B')]], ['PY', [c.id('A'), c.id('AY'), c.id('B')]]]) {
    const [d] = resoudre([idEnt(c.id(k))], c.l);
    const v = valeurDePorteur(d.porteur, d.donnee, d.acces);
    assert.equal(v.length, 1);
    assert.deepEqual(Object.keys(v[0]), ['entree', 'donnees']);
    assert.deepEqual([...v[0].donnees].sort(), [...attendu].sort());
    assert.equal(new Set(v[0].donnees).size, v[0].donnees.length);
    assert.equal(v[0].entree, 'elements');
  }
});
test('H2. Q : deux entrées ordinaires partagent la même donnée (a = H, b = H) ; cette multiplicité est conservée', async () => {
  const c = await chaine();
  const [d] = resoudre([idEnt(c.id('Q'))], c.l);
  assert.deepEqual(valeurDePorteur(d.porteur, d.donnee, d.acces), [{ entree: 'a', donnee: c.id('H') }, { entree: 'b', donnee: c.id('H') }]);
});
test('H3. SOUS-DONNÉE UTILISÉE COMME ENTRÉE : entrées(N) contient l\'identité D (chemins → D) ; D se résout ; entrées(D) est refusée ; aucune remontée vers Q', async () => {
  const c = await chaine();
  const [dN] = resoudre([idEnt(c.id('N'))], c.l);
  const v = valeurDePorteur(dN.porteur, dN.donnee, dN.acces);
  assert.deepEqual(v, [{ entree: 'chemins', donnee: c.sousCommuns }]);
  const [dD] = resoudre([v[0].donnee], c.l);
  assert.equal(dD.donnee.identite, c.sousCommuns); assert.deepEqual(dD.acces, ACCES_TRACE);
  refuse(() => resoudre([idEnt(c.sousCommuns)], c.l), /n'a pas de production source/);
  refuse(() => entreesDeProduction(c.sousCommuns, c.l.executions), /aucune exécution correspondante|sous-donnée/);
  // Q n'apparaît nulle part dans ce qui est rendu pour D
  assert.equal(JSON.stringify(dD.porteur).includes(c.id('Q')), false);
});

// ============================================================================ I. SNAPSHOT ET HISTORIQUE INCHANGÉS
test('I1. SNAPSHOT : aucune observation de la chaîne ne contient d\'identité d\'entrées (donneesExaminees, possibilites), mêmes sept clés ; la résolution explicite n\'écrit rien', async () => {
  const c = await chaine();
  const avant = JSON.stringify(c.l);
  for (const o of c.l.observations) {
    assert.deepEqual(Object.keys(o), ['id', 'idMessage', 'horodatage', 'donneesExaminees', 'operationsExaminees', 'empreintesOperationsExaminees', 'possibilites']);
    for (const id of o.donneesExaminees) assert.equal(id.startsWith(PREFIXE_IDENTITE_ENTREES), false);
    assert.equal(JSON.stringify(o).includes(PREFIXE_IDENTITE_ENTREES), false);
  }
  for (const k of ['A', 'P', 'R', 'N']) resoudre([idEnt(c.id(k))], c.l);
  assert.equal(JSON.stringify(c.l), avant);
  assert.equal((await c.w.lire()).observations.length, c.l.observations.length);
});
test('I2. SNAPSHOT : un tour supplémentaire APRÈS résolutions explicites produit une observation sans identité d\'entrées ; l\'univers local n\'en contient pas', async () => {
  const w = monde();
  const A = await w.lancer('bonjour Pixel', 'symbolesDeChaine');
  const l0 = await w.lire();
  resoudre([idEnt(A.execution.id)], l0);
  const t = await w.tour('tour suivant');
  assert.equal(JSON.stringify(t.observation).includes(PREFIXE_IDENTITE_ENTREES), false);
  assert.equal(t.univers.every((u) => !estIdentiteEntrees(u.donnee.identite)), true);
  assert.deepEqual(t.observation.donneesExaminees.length, t.univers.length);
});
test('I3. CONTEXTE HISTORIQUE : resoudreContexteObservation reconstruit chaque observation de la chaîne exactement sur donneesExaminees, sans donnée adjacente, avant comme après des résolutions d\'entrées', async () => {
  const c = await chaine();
  const contexte = () => c.l.observations.map((o) => resoudreContexteObservation(o.id, c.l.observations, c.l.valeurs, c.l.executions, C16));
  const avant = contexte();
  for (const k of ['A', 'P', 'R']) resoudre([idEnt(c.id(k))], c.l);
  const apres = contexte();
  assert.deepEqual(apres, avant);
  avant.forEach((x, i) => {
    assert.deepEqual(x.univers.map((u) => u.donnee.identite), c.l.observations[i].donneesExaminees);
    assert.equal(x.univers.every((u) => !estIdentiteEntrees(u.donnee.identite)), true);
  });
  assert.ok(avant.length >= 10);
});

// ============================================================================ J. DORMANCE, PURETÉ, AUCUN AUTRE EFFET
test('J1. DORMANCE : seul resoudre-identites.js importe entrees-donnee.js ; aucun flux vivant (observation, désignation, exécution, pont, contexte, univers) ne dérive ni ne nomme ces identités', () => {
  const sources = [];
  const parcourir = (dossier) => { for (const nom of readdirSync(dossier)) { const chemin = join(dossier, nom); if (statSync(chemin).isDirectory()) parcourir(chemin); else if (/\.(m?js|html)$/.test(nom)) sources.push(chemin); } };
  parcourir(join(RACINE, 'app'));
  const rel = (f) => relative(RACINE, f).split('\\').join('/');
  const nommants = sources.filter((f) => /entrees-donnee|identiteEntreesProduction|productionDesEntrees|estIdentiteEntrees|PREFIXE_IDENTITE_ENTREES|ACCES_ENTREES_PRODUCTION|FORME_ENTREES_PRODUCTION/.test(readFileSync(f, 'utf8'))).map(rel);
  // MISE À JOUR DÉLIBÉRÉE v0.63.56 : empreinte-categorie-entrees.js (pure, dormante, importée par aucun mécanisme) importe ces constantes et fonctions
  // pour empreinter le contrat de la catégorie ; elle ne dérive ni ne résout aucune identité réelle.
  assert.deepEqual(nommants, ['app/langage/empreinte-categorie-entrees.js', 'app/langage/entrees-donnee.js', 'app/langage/resoudre-identites.js']);
  for (const f of ['contexte-observation.js', 'observation-possibilites.js', 'connaissances.js', 'execution-sollicitee.js', 'pont.js', 'applications-sollicitables.js', 'groupes-candidats.js', 'valeurs-application.js', 'univers-valeurs.js', 'possibilites-liaison.js', 'productions-decrites.js', 'acces-valeur.js']) {
    assert.equal(/entrees-donnee|entrees-production|entreesDeProduction|identiteEntreesProduction|ACCES_ENTREES_PRODUCTION/.test(lu('app', 'langage', f)), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html', 'app/main.js']) { let s = ''; try { s = lu(autre); } catch { continue; } assert.equal(/entrees-donnee|entreesDeProduction/.test(s), false, autre); }
});
test('J2. PURETÉ de entrees-donnee.js : aucun import, ni horloge, ni hasard, ni identité générée, ni magasin, ni asynchronisme, ni état global', () => {
  assert.equal(/\bimport\b/.test(CODE), false);
  for (const interdit of ['Date', 'Math.random', 'nouvelId', 'magasin', 'ecrire', 'lireTout', 'async ', 'await ', 'Promise', 'localStorage', 'indexedDB', 'process.', 'globalThis', 'crypto', 'setTimeout', 'require(']) assert.equal(CODE.includes(interdit), false, interdit);
});
test('J3. AUCUN AUTRE EFFET : pas de table, de migration ni de persistance ; VERSION_BASE, schéma, catalogue (16), table d\'opérations (16) inchangés ; contrats et empreintes non touchés', () => {
  assert.equal(VERSION_BASE, 19); assert.equal(SCHEMA_SAUVEGARDE, 9); assert.equal(TABLES.length, 22);
  assert.equal(C16.length, 16); assert.equal(Object.keys(TABLE_OPERATIONS).length, 16);
  assert.equal(C16.some((d) => /entrees|liaisons/i.test(d.nom)), false);
  for (const f of ['descriptions-operations.js', 'empreinte-contrats.js', 'table-operations.js', 'formes-operation.js']) assert.equal(/entrees-donnee|ENTREES_PRODUCTION|entrees-de-production/.test(lu('app', 'langage', f)), false, f);
});
test('J4. resoudre-identites.js ne réimplémente PAS la validation des liaisons : il n\'appelle que entreesDeProduction', () => {
  const code = sansCommentaires(lu('app', 'langage', 'resoudre-identites.js'));
  assert.equal(/liaisons/.test(code.replace(/lignesExecutions|entreesDeProduction/g, '')), false);
  assert.equal(/entreesDeProduction\(/.test(code), true);
});
