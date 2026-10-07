// v0.63.70 — famillesDEpisodes : regrouper les épisodes de transformation par structure de chemin (décision ChatGPT, 07/10/2026). Preuves : la famille est la suite ordonnée
// des étapes { operation, entrees canoniques } ; identités, valeurs, relationValeur et formes n'y participent pas ; une même famille contient egale, differente et non_comparable
// côte à côte (garde architecturale) ; structures différentes, rôles différents, préfixes = familles différentes ; longueur 1 valide ; déterminisme ; aucune déduplication ;
// épisodes conservés par référence ; aucun compteur ; cas central ×6 ; mesures du scénario réel ; coût ; entrées mal formées ; pureté ; dormance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/familles-episodes.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'familles-episodes.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^famillesDEpisodes : /.test(e.message));

// Épisode synthétique : etapes = [[operation, entrees], …] ; identités dérivées d'un suffixe.
let compteur = 0;
const ep = (etapes, relationValeur = 'egale', valeurs) => {
  compteur += 1;
  const s = `${compteur}`;
  const chemin = etapes.map(([operation, entrees], i) => ({ de: i === 0 ? `D${s}` : `M${i}-${s}`, execution: `E${i}-${s}`, operation, entrees, vers: i === etapes.length - 1 ? `A${s}` : `M${i + 1}-${s}` }));
  const e = { depart: `D${s}`, arrivee: `A${s}`, chemin, relationValeur };
  if (valeurs) e.valeurs = valeurs;
  return e;
};
const vue = (f) => f.structure.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. export unique, fonction synchrone à un paramètre ; accepte la sortie de episodesDeTransformation ou son tableau ; vide -> aucune famille', () => {
  assert.deepEqual(Object.keys(module), ['famillesDEpisodes']);
  assert.equal(famillesDEpisodes.length, 1);
  assert.equal(famillesDEpisodes.constructor.name, 'Function');
  assert.deepEqual(famillesDEpisodes({ episodes: [], nonComparables: [], nombreDescendances: 0 }), { familles: [] });
  assert.deepEqual(famillesDEpisodes([]), { familles: [] });
  const e = ep([['op1', ['x']]]);
  assert.deepEqual(famillesDEpisodes({ episodes: [e] }), famillesDEpisodes([e]));
});

test('A2. une famille = { structure, episodes } ; structure = suite de { operation, entrees } ; aucun autre champ, aucun identifiant séparé, aucun compteur', () => {
  const a = ep([['op1', ['x']], ['op2', ['y']]]);
  const { familles } = famillesDEpisodes([a]);
  assert.deepEqual(familles, [{ structure: [{ operation: 'op1', entrees: ['x'] }, { operation: 'op2', entrees: ['y'] }], episodes: [a] }]);
  assert.deepEqual(Object.keys(familles[0]), ['structure', 'episodes']);
  assert.equal(/score|confiance|frequence|confirmation|contradiction|compteur|nombre|taille|regle|attente|famille.?id|identifiant|signature/i.test(JSON.stringify(familles)), false);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. DÉFINITION DE LA FAMILLE
test('B1. identités (depart, arrivee, de, vers, execution) et valeurs hors identité : deux expériences de même structure = UNE famille, DEUX épisodes', () => {
  const a = ep([['op1', ['x']], ['op2', ['y']]], 'egale', { depart: 'u', arrivee: 'u' });
  const b = ep([['op1', ['x']], ['op2', ['y']]], 'egale', { depart: 'w', arrivee: 'w' });
  const { familles } = famillesDEpisodes([a, b]);
  assert.equal(familles.length, 1);
  assert.deepEqual(familles[0].episodes, [a, b]);
  assert.equal(familles[0].episodes[0], a, 'même référence : épisode retrouvable');
  assert.equal(familles[0].episodes[1], b);
});

test('B2. relationValeur hors identité : egale, differente et non_comparable de même structure dans UNE SEULE famille (garde architecturale)', () => {
  const A = ep([['op1', ['x']], ['op2', ['y']]], 'egale', { depart: 'v', arrivee: 'v' });
  const B = ep([['op1', ['x']], ['op2', ['y']]], 'differente', { depart: 'v', arrivee: 'w' });
  const C = ep([['op1', ['x']], ['op2', ['y']]], 'non_comparable');
  const { familles } = famillesDEpisodes([B, C, A]);
  assert.equal(familles.length, 1);
  assert.deepEqual(vue(familles[0]), 'op1(x)>op2(y)');
  assert.deepEqual(familles[0].episodes.map((e) => e.relationValeur).sort(), ['differente', 'egale', 'non_comparable']);
  assert.equal(familles[0].episodes.length, 3);
});

test('B3. structures différentes : op1>op2, op1>op3, op4>op2 = trois familles ; rôles différents op1(a)>op2(b) vs op1(c)>op2(b) = deux familles', () => {
  const r = famillesDEpisodes([ep([['op1', ['x']], ['op2', ['y']]]), ep([['op1', ['x']], ['op3', ['y']]]), ep([['op4', ['x']], ['op2', ['y']]])]);
  assert.deepEqual(r.familles.map(vue), ['op1(x)>op2(y)', 'op1(x)>op3(y)', 'op4(x)>op2(y)']);
  const roles = famillesDEpisodes([ep([['op1', ['a']], ['op2', ['b']]]), ep([['op1', ['c']], ['op2', ['b']]])]);
  assert.deepEqual(roles.familles.map(vue), ['op1(a)>op2(b)', 'op1(c)>op2(b)']);
});

test('B4. canonicalisation des entrées : [a,b] et [b,a] = même étape ; [a] et [a,b] = étapes différentes ; doublon [a,a] = [a]', () => {
  const ab = ep([['op', ['a', 'b']]]);
  const ba = ep([['op', ['b', 'a']]]);
  const a = ep([['op', ['a']]]);
  const aa = ep([['op', ['a', 'a']]]);
  const { familles } = famillesDEpisodes([ab, ba, a, aa]);
  assert.deepEqual(familles.map(vue), ['op(a)', 'op(a,b)']);
  assert.deepEqual(familles[0].episodes, [a, aa]);
  assert.deepEqual(familles[1].episodes, [ab, ba]);
  assert.deepEqual(familles[1].structure[0].entrees, ['a', 'b']);
  assert.notEqual(familles[1].structure[0].entrees, ab.chemin[0].entrees, 'copie canonique, jamais la référence de l\'épisode');
});

test('B5. préfixes : op1>op2 et op1>op2>op3 = deux familles, aucune hiérarchie ; longueur 1 = famille valide ; tri par longueur puis structure', () => {
  const { familles } = famillesDEpisodes([ep([['op1', ['x']], ['op2', ['y']], ['op3', ['z']]]), ep([['op1', ['x']], ['op2', ['y']]]), ep([['op2', ['y']]]), ep([['op1', ['x']]])]);
  assert.deepEqual(familles.map(vue), ['op1(x)', 'op2(y)', 'op1(x)>op2(y)', 'op1(x)>op2(y)>op3(z)']);
  for (const f of familles) assert.equal(f.episodes.length, 1);
  assert.equal(/prefixe|préfixe|parent|enfant|hierarchie/i.test(CODE), false);
});

test('B6. déterminisme : même ensemble dans un autre ordre -> mêmes familles, même structure, même ordre de sortie ; épisodes triés par (depart, arrivee, vers)', () => {
  const liste = [ep([['op1', ['x']], ['op2', ['y']]], 'egale'), ep([['op3', ['x']]], 'non_comparable'), ep([['op1', ['x']], ['op2', ['y']]], 'differente'), ep([['op1', ['x']], ['op2', ['y']]], 'non_comparable')];
  const a = famillesDEpisodes(liste);
  const b = famillesDEpisodes(liste.slice().reverse());
  assert.deepEqual(a, b);
  const departs = a.familles[1].episodes.map((e) => e.depart);
  assert.deepEqual(departs, departs.slice().sort());
});

test('B7. aucune déduplication : deux épisodes identiques en structure, valeurs et relation restent deux épisodes', () => {
  const a = ep([['op', ['x']]], 'egale', { depart: 'v', arrivee: 'v' });
  const b = { ...structuredClone(a) };
  const { familles } = famillesDEpisodes([a, b]);
  assert.equal(familles.length, 1);
  assert.equal(familles[0].episodes.length, 2);
  assert.equal(familles[0].episodes[0], a);
  assert.equal(familles[0].episodes[1], b);
});

test('B8. les formes ne participent pas : le code ne lit ni catalogue, ni forme, ni valeurs, ni relationValeur, ni exécutions', () => {
  assert.equal(/^import\b|\bimport\(|\brequire\(/m.test(SRC), false, 'aucune importation');
  assert.equal(/forme|genre|catalogue|descriptions|DESCRIPTIONS|relationValeur|valeurs|resultat|liaisons|lignes/.test(CODE), false);
  const sansRelation = ep([['op', ['x']]]);
  delete sansRelation.relationValeur;
  assert.equal(famillesDEpisodes([sansRelation]).familles.length, 1, 'relationValeur jamais lue');
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. ENTRÉES MAL FORMÉES
test('C1. entrées mal formées : TypeError, aucun résultat partiel', () => {
  refuse(() => famillesDEpisodes(null));
  refuse(() => famillesDEpisodes({}));
  refuse(() => famillesDEpisodes({ episodes: 'x' }));
  refuse(() => famillesDEpisodes([null]));
  refuse(() => famillesDEpisodes([{ depart: 'a', arrivee: 'b' }]));
  refuse(() => famillesDEpisodes([{ depart: 'a', arrivee: 'b', chemin: [] }]));
  refuse(() => famillesDEpisodes([{ depart: '', arrivee: 'b', chemin: [{ operation: 'op', entrees: ['x'], vers: 'b' }] }]));
  refuse(() => famillesDEpisodes([{ depart: 'a', arrivee: 'b', chemin: [{ operation: '', entrees: ['x'], vers: 'b' }] }]));
  refuse(() => famillesDEpisodes([{ depart: 'a', arrivee: 'b', chemin: [{ operation: 'op', entrees: [], vers: 'b' }] }]));
  refuse(() => famillesDEpisodes([{ depart: 'a', arrivee: 'b', chemin: [{ operation: 'op', entrees: [1], vers: 'b' }] }]));
  refuse(() => famillesDEpisodes([{ depart: 'a', arrivee: 'b', chemin: [{ operation: 'op', entrees: 'x', vers: 'b' }] }]));
  const creux = []; creux.length = 1;
  refuse(() => famillesDEpisodes(creux));
  refuse(() => famillesDEpisodes([{ depart: 'a', arrivee: 'b', chemin: [{ get operation() { return 'op'; }, entrees: ['x'], vers: 'b' }] }]));
});

// ---------------------------------------------------------------------------------------------------------------------------------- D. CAS RÉELS
async function rejouer(scenario, solliciter = false) {
  const magasin = magasinMemoireVive();
  let n = 0;
  const nouvelId = (p) => `${p}-${++n}`;
  const tours = [];
  const ex = () => magasin.lireTout('executionsOperations');
  for (const t of scenario) {
    const suivi = suivreObservationDuTour(
      (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex }),
      (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }),
    );
    const res = await traiterTourAvecEnonce(t, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    tours.push(s);
    if (solliciter) {
      const { observation, univers } = s;
      const vals = await magasin.lireTout('valeursDonnees');
      const msgId = vals[vals.length - 1].id;
      const faits = await ex();
      const soll = async (operation, liaisons) => { const r = await executerApplicationSollicitee({ observation, application: { operation, liaisons }, univers }, { magasin, table: TABLE_OPERATIONS }); assert.equal(r.statut, 'executee'); };
      for (const R of faits.filter((e) => e.operation === 'symbolesDeChaine')) {
        if (!faits.some((e) => e.operation === 'composerCollection' && e.liaisons[0].donnee === R.id) && observation.donneesExaminees.includes(R.id)) await soll('composerCollection', [{ entree: 'elements', donnee: R.id }]);
      }
      if (!(await ex()).some((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === msgId)) await soll('symbolesDeChaine', [{ entree: 'chaine', donnee: msgId }]);
    }
  }
  return { tours, valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex() };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const relations = (f) => f.episodes.reduce((c, e) => { c[e.relationValeur] = (c[e.relationValeur] ?? 0) + 1; return c; }, {});

test('D1. scénario réel 7 tours : 67 épisodes -> 37 familles ; tailles ; aucune famille à plusieurs relations ; scénario vivant inchangé', async () => {
  const { tours, valeurs, executions } = await rejouer(SCENARIO);
  const sortie = episodesDeTransformation(valeurs, executions, DESCRIPTIONS_OPERATIONS);
  const { familles } = famillesDEpisodes(sortie);
  assert.equal(sortie.episodes.length, 67);
  assert.equal(familles.length, 37);
  assert.equal(familles.reduce((n, f) => n + f.episodes.length, 0), 67, 'chaque épisode dans exactement une famille');
  const tailles = familles.reduce((c, f) => { c[f.episodes.length] = (c[f.episodes.length] ?? 0) + 1; return c; }, {});
  assert.deepEqual(tailles, { 1: 31, 2: 1, 4: 3, 11: 2 });
  assert.equal(familles.filter((f) => f.episodes.length > 1).length, 6);
  assert.equal(familles.filter((f) => Object.keys(relations(f)).length > 1).length, 0);
  assert.deepEqual(familles.filter((f) => f.structure.length === 1).length, 15);
  const egale = familles.find((f) => relations(f).egale);
  assert.equal(vue(egale), 'symbolesDeChaine(chaine)>composerCollection(elements)');
  assert.equal(egale.episodes.length, 1);
  const differente = familles.find((f) => relations(f).differente);
  assert.equal(vue(differente), 'parcourirStructure(valeur)>projeterChemins(elements)>memesCouvertures(a,b)');
  assert.deepEqual(differente.structure[2].entrees, ['a', 'b'], 'entrée par a ET b préservée dans la structure');
  assert.equal(familles.find((f) => vue(f) === 'symbolesDeChaine(chaine)>elementsObservables(elements)').episodes.length, 11);
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(executions.length, 19);
  assert.equal(tours.flatMap((s) => s.automatiques).filter((x) => x.statut !== 'executee').length, 0);
});

test('D2. six expériences (sonde) : UNE famille symbolesDeChaine(chaine)>composerCollection(elements) de SIX épisodes distincts, chacun egale, aucun compteur', async () => {
  const { valeurs, executions } = await rejouer(['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'], true);
  const sortie = episodesDeTransformation(valeurs, executions, DESCRIPTIONS_OPERATIONS);
  assert.equal(sortie.episodes.length, 102);
  const { familles } = famillesDEpisodes(sortie);
  assert.equal(familles.length, 37);
  const centrale = familles.filter((f) => vue(f) === 'symbolesDeChaine(chaine)>composerCollection(elements)');
  assert.equal(centrale.length, 1);
  const f = centrale[0];
  assert.deepEqual(f.structure, [{ operation: 'symbolesDeChaine', entrees: ['chaine'] }, { operation: 'composerCollection', entrees: ['elements'] }]);
  assert.equal(f.episodes.length, 6);
  assert.deepEqual(f.episodes.map((e) => e.depart), ['message-1', 'message-2', 'message-3', 'message-4', 'message-5', 'message-6']);
  assert.equal(new Set(f.episodes.map((e) => e.arrivee)).size, 6);
  assert.deepEqual(f.episodes.map((e) => e.relationValeur), ['egale', 'egale', 'egale', 'egale', 'egale', 'egale']);
  assert.deepEqual(f.episodes.map((e) => e.valeurs.depart), ['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa']);
  for (const e of f.episodes) assert.equal(sortie.episodes.includes(e), true, 'même référence que la source');
  assert.equal(/inverse/i.test(JSON.stringify(familles)), false);
});

test('D3. coût : réel (67), sonde (102) et 20 000 épisodes synthétiques ; aucune réénumération de chemins', async () => {
  const { valeurs, executions } = await rejouer(SCENARIO);
  const sortie = episodesDeTransformation(valeurs, executions, DESCRIPTIONS_OPERATIONS);
  let debut = performance.now();
  for (let k = 0; k < 20; k += 1) famillesDEpisodes(sortie);
  assert.ok((performance.now() - debut) / 20 < 50);
  const syn = [];
  for (let i = 0; i < 20000; i += 1) syn.push({ depart: `d${i}`, arrivee: `a${i}`, relationValeur: 'egale', chemin: [{ de: `d${i}`, execution: `e${i}`, operation: `op${i % 50}`, entrees: ['x'], vers: `m${i}` }, { de: `m${i}`, execution: `f${i}`, operation: `op${i % 7}`, entrees: ['y'], vers: `a${i}` }] });
  debut = performance.now();
  const { familles } = famillesDEpisodes(syn);
  assert.ok(performance.now() - debut < 5000);
  assert.equal(familles.length, 350);
  assert.equal(familles.reduce((n, f) => n + f.episodes.length, 0), 20000);
  assert.equal(/parents|ascendance|explorer|chemins\(/.test(CODE), false, 'aucun parcours de graphe');
});

// ---------------------------------------------------------------------------------------------------------------------------------- E. PURETÉ / DORMANCE
test('E1. pureté : entrée gelée en profondeur acceptée et intacte ; appels répétés identiques ; familles neuves, épisodes partagés par référence', () => {
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const liste = gel([ep([['op1', ['b', 'a']], ['op2', ['y']]], 'egale', { depart: 'v', arrivee: 'v' }), ep([['op1', ['a', 'b']], ['op2', ['y']]], 'differente', { depart: 'v', arrivee: 'w' })]);
  const avant = JSON.stringify(liste);
  const a = famillesDEpisodes(liste);
  const b = famillesDEpisodes(liste);
  assert.deepEqual(a, b);
  assert.notEqual(a.familles[0], b.familles[0]);
  assert.notEqual(a.familles[0].structure, b.familles[0].structure);
  assert.equal(a.familles[0].episodes[0], liste[0]);
  assert.equal(JSON.stringify(liste), avant);
});

test('E2. garde statique : ni écriture, magasin, horloge, hasard, asynchrone, état global ; aucun nom d\'opération ; aucune interprétation', () => {
  for (const motif of [/\bDate\b/, /Math\.random/, /performance\./, /\bawait\b/, /\basync\b/, /\bsetTimeout\b/, /\bPromise\b/, /\bprocess\b/, /\bglobalThis\b/, /\blocalStorage\b/, /\becrire\b|\benregistrer\b|\.ecrire|\.lireTout/, /\bcrypto\b|sha256/]) {
    assert.equal(motif.test(CODE), false, String(motif));
  }
  assert.equal(/symbolesDeChaine|composerCollection|parcourirStructure|elementsObservables/.test(CODE), false);
  assert.equal(/confirmation|contradiction|confiance|frequence|fréquence|regle|règle|attente|prediction|prédiction|preference|préférence|inverse|apprentissage/i.test(CODE), false);
  assert.equal(/\b(let|var)\b[^;]*=\s*(\[\]|\{\}|new (Map|Set))/.test(CODE.split('export function')[0]), false, 'aucun état de module');
});

test('E3. DORMANCE : aucun fichier de app/ ne nomme le module ni la fonction en dehors de lui-même', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    if (f === join(RACINE, 'app', 'langage', 'contexte-prospectif.js')) continue; // MISE À JOUR DÉLIBÉRÉE v0.63.72 : contexte-prospectif.js (calcul pur du contenu prospectif, appelé par execution-sollicitee.js AVANT l'issue) compose cette vue : elle n'est plus dormante
    assert.equal(/familles-episodes|famillesDEpisodes/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/familles-episodes|famillesDEpisodes/.test(s), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17);
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
