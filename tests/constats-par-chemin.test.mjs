// v0.63.71 — constatsParChemin : regrouper par chemin de propriété les constats de produireConstatsStructurels (décision ChatGPT, 07/10/2026). Preuves : contrat et entrée
// (éléments du producteur), couverture universelle = identités déclarées, témoins exacts, cas générique x/y, absence comme trou de couverture, structures sans valeur
// préservées, dérivation de « porté par tous » / « présent chez tous » / « absent chez certains » par l'algèbre existante (jamais nommés par la vue), six épisodes centraux
// (aucun nom de champ codé), occurrence unique, croissance E1/E2/E3, sémantique exacte des témoins et de l'ordre, coût, entrées mal formées, pureté, dormance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/constats-par-chemin.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { memesCouvertures, normaliserCouverture } from '../app/langage/couverture-occurrences.js';
import { partagerCouvertures } from '../app/langage/partition-couvertures.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'constats-par-chemin.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError);
const el = (id, contenu) => ({ chemin: [id], contenu });
const au = (r, ...chemin) => r.chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
// Lectures DÉRIVÉES par l'algèbre existante (jamais fournies par la vue) :
const porteParTous = (r, constat) => memesCouvertures(constat.couverture, r.universelle);
const presentChezTous = (r, chemin) => memesCouvertures(chemin.couverture, r.universelle);
const absentsChez = (r, chemin) => partagerCouvertures(r.universelle, chemin.couverture).seulementA;

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. export unique, fonction synchrone à un paramètre, [] -> { universelle: [], chemins: [] }', () => {
  assert.deepEqual(Object.keys(module), ['constatsParChemin']);
  assert.equal(constatsParChemin.length, 1);
  assert.equal(constatsParChemin.constructor.name, 'Function');
  assert.deepEqual(constatsParChemin([]), { universelle: [], chemins: [] });
});

test('A2. cas générique x/y : y -> un constat "a" porté par les trois ; x -> trois constats 1, 2, 3 d\'un témoin chacun ; aucun champ dérivé dans la sortie', () => {
  const r = constatsParChemin([el('E1', { x: 1, y: 'a' }), el('E2', { x: 2, y: 'a' }), el('E3', { x: 3, y: 'a' })]);
  assert.deepEqual(r.universelle, [['E1'], ['E2'], ['E3']]);
  assert.deepEqual(r.chemins.map((c) => c.chemin), [[], ['x'], ['y']]);
  assert.deepEqual(au(r, 'y'), { chemin: ['y'], constats: [{ type: 'chaine', valeur: 'a', couverture: [['E1'], ['E2'], ['E3']] }], couverture: [['E1'], ['E2'], ['E3']] });
  assert.deepEqual(au(r, 'x'), { chemin: ['x'], constats: [
    { type: 'nombre', valeur: 1, couverture: [['E1']] }, { type: 'nombre', valeur: 2, couverture: [['E2']] }, { type: 'nombre', valeur: 3, couverture: [['E3']] },
  ], couverture: [['E1'], ['E2'], ['E3']] });
  assert.deepEqual(au(r), { chemin: [], constats: [{ type: 'objet', couverture: [['E1'], ['E2'], ['E3']] }], couverture: [['E1'], ['E2'], ['E3']] });
  for (const c of r.chemins) { assert.deepEqual(Object.keys(c), ['chemin', 'constats', 'couverture']); for (const k of c.constats) assert.deepEqual(Object.keys(k).filter((x) => x !== 'valeur'), ['type', 'couverture']); }
  assert.equal(/constant|variable|absent|nombreValeurs|frequence|majorite|score|invariant/i.test(JSON.stringify(r)), false);
});

test('A3. dérivations par l\'algèbre existante (la vue ne les nomme pas) : cas A y constant ; cas B y="a" sur E1,E2 et y="b" sur E3 ; aucune majorité', () => {
  const A = constatsParChemin([el('E1', { y: 'a' }), el('E2', { y: 'a' }), el('E3', { y: 'a' })]);
  assert.equal(au(A, 'y').constats.length, 1);
  assert.equal(porteParTous(A, au(A, 'y').constats[0]), true);
  const B = constatsParChemin([el('E1', { y: 'a' }), el('E2', { y: 'a' }), el('E3', { y: 'b' })]);
  const y = au(B, 'y');
  assert.deepEqual(y.constats.map((c) => [c.valeur, c.couverture]), [['a', [['E1'], ['E2']]], ['b', [['E3']]]]);
  assert.equal(y.constats.some((c) => porteParTous(B, c)), false);
  assert.equal(presentChezTous(B, y), true);
  assert.equal(/majorit|vote|plus (grand|frequent)/i.test(CODE), false);
});

test('A4. absence : y chez E1 et E3 seulement ; couverture du chemin [E1,E3] ; universelle [E1,E2,E3] ; l\'absence de E2 = seulementA de la partition ; aucune pseudo-valeur', () => {
  const r = constatsParChemin([el('E1', { x: 1, y: 'a' }), el('E2', { x: 2 }), el('E3', { x: 3, y: 'a' })]);
  const y = au(r, 'y');
  assert.deepEqual(y.constats, [{ type: 'chaine', valeur: 'a', couverture: [['E1'], ['E3']] }]);
  assert.deepEqual(y.couverture, [['E1'], ['E3']]);
  assert.deepEqual(r.universelle, [['E1'], ['E2'], ['E3']]);
  assert.equal(presentChezTous(r, y), false);
  assert.deepEqual(absentsChez(r, y), [['E2']]);
  assert.equal(/ABSENT|absent/.test(JSON.stringify(r)), false);
  assert.equal(presentChezTous(r, au(r, 'x')), true);
});

test('A5. structures : objets, tableaux, null restent des constats SANS valeur, regroupés à leur chemin ; jamais convertis en scalaire', () => {
  const r = constatsParChemin([el('E1', { s: { k: 1 }, t: [1, 2], n: null }), el('E2', { s: { k: 2 }, t: [1], n: null }), el('E3', { s: 'plat', t: [1, 2], n: 0 })]);
  assert.deepEqual(au(r, 's').constats.map((c) => [c.type, c.valeur, c.couverture]), [['objet', undefined, [['E1'], ['E2']]], ['chaine', 'plat', [['E3']]]]);
  assert.equal(Object.hasOwn(au(r, 's').constats[0], 'valeur'), false);
  assert.deepEqual(au(r, 't').constats, [{ type: 'tableau', couverture: [['E1'], ['E2'], ['E3']] }]);
  assert.deepEqual(au(r, 't', 1).couverture, [['E1'], ['E3']], 'indice 1 absent chez E2');
  assert.deepEqual(au(r, 'n').constats.map((c) => [c.type, Object.hasOwn(c, 'valeur'), c.couverture]), [['nul', false, [['E1'], ['E2']]], ['nombre', true, [['E3']]]]);
  assert.deepEqual(au(r, 's', 'k').constats.map((c) => c.valeur), [1, 2]);
  assert.equal(presentChezTous(r, au(r, 's', 'k')), false);
});

test('A6. égalité typée du producteur : 7 et "7", 0 et -0, true et "true" sont des constats distincts au même chemin ; [0] et ["0"] sont des chemins distincts', () => {
  const r = constatsParChemin([el('E1', { v: 7 }), el('E2', { v: '7' }), el('E3', { v: 0 }), el('E4', { v: -0 }), el('E5', { v: true }), el('E6', { v: 'true' })]);
  assert.equal(au(r, 'v').constats.length, 6);
  const c = constatsParChemin([el('E1', [5]), el('E2', { 0: 5 })]);
  assert.deepEqual(c.chemins.map((x) => x.chemin), [[], [0], ['0']]);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. SOURCE DE VÉRITÉ / TÉMOINS / ORDRE
test('B1. source unique : constats et couvertures EXACTEMENT ceux du producteur, réorganisés ; universelle = identités déclarées normalisées', () => {
  const elements = [el('b', { x: 1, y: 'a', z: { q: [1, 2] } }), el('a', { x: 2, y: 'a' }), el('c', { x: 1, z: { q: [] } })];
  const r = constatsParChemin(elements);
  const source = produireConstatsStructurels(elements);
  const aplatis = r.chemins.flatMap((c) => c.constats.map((k) => ({ constat: Object.hasOwn(k, 'valeur') ? { chemin: c.chemin, type: k.type, valeur: k.valeur } : { chemin: c.chemin, type: k.type }, couverture: k.couverture })));
  assert.equal(aplatis.length, source.length);
  for (const s of source) assert.equal(aplatis.some((a) => memesCouvertures([a.constat.chemin], [s.constat.chemin]) && a.constat.type === s.constat.type && Object.is(a.constat.valeur, s.constat.valeur) && memesCouvertures(a.couverture, s.couverture)), true);
  assert.deepEqual(r.universelle, normaliserCouverture(elements.map((e) => e.chemin)));
  assert.equal(/parcourirStructure|Object\.is|typeof contenu|\.valeur ===|=== .*\.valeur/.test(CODE), false, 'aucune réimplémentation du parcours ni de l\'égalité');
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./constats-structurels.js', './couverture-occurrences.js']);
});

test('B2. témoins et ordre (sémantique exacte du producteur) : identités réelles -> indépendance totale de l\'ordre ; identités par rang -> le rang EST le témoin', () => {
  const reels = [el('E1', { y: 'a' }), el('E2', { y: 'a' }), el('E3', { y: 'b' })];
  assert.deepEqual(constatsParChemin(reels), constatsParChemin(reels.slice().reverse()));
  const parRang = (objets) => constatsParChemin(objets.map((o, i) => ({ chemin: [i], contenu: o })));
  const d = parRang([{ y: 'a' }, { y: 'a' }, { y: 'b' }]);
  const e = parRang([{ y: 'b' }, { y: 'a' }, { y: 'a' }]);
  assert.notDeepEqual(d, e, 'avec le rang comme identité, un autre ordre désigne d\'autres témoins : rapporté tel quel, jamais corrigé');
  assert.deepEqual(au(d, 'y').constats.map((c) => [c.valeur, c.couverture]), [['a', [[0], [1]]], ['b', [[2]]]]);
  assert.deepEqual(au(e, 'y').constats.map((c) => [c.valeur, c.couverture]), [['b', [[0]]], ['a', [[1], [2]]]]);
  assert.deepEqual(d.chemins.map((c) => c.chemin), e.chemins.map((c) => c.chemin), 'les chemins et leur ordre ne dépendent pas de l\'ordre');
});

test('B3. occurrence unique : universelle à un témoin ; tout constat porte cette couverture ; la vue ne dit pas « invariant », elle garde le témoin', () => {
  const r = constatsParChemin([el('seul', { x: 1, y: 'a' })]);
  assert.deepEqual(r.universelle, [['seul']]);
  for (const c of r.chemins) for (const k of c.constats) assert.deepEqual(k.couverture, [['seul']]);
  assert.equal(/invariant|constant/i.test(JSON.stringify(r)), false);
});

test('B4. croissance E1 -> E1,E2 -> E1,E2,E3 : [a] -> [a,a] -> [a,a]+[b], sans état interne, témoins conservés', () => {
  const E1 = el('E1', { y: 'a' }); const E2 = el('E2', { y: 'a' }); const E3 = el('E3', { y: 'b' });
  const un = au(constatsParChemin([E1]), 'y');
  const deux = au(constatsParChemin([E1, E2]), 'y');
  const trois = au(constatsParChemin([E1, E2, E3]), 'y');
  assert.deepEqual(un.constats.map((c) => [c.valeur, c.couverture]), [['a', [['E1']]]]);
  assert.deepEqual(deux.constats.map((c) => [c.valeur, c.couverture]), [['a', [['E1'], ['E2']]]]);
  assert.deepEqual(trois.constats.map((c) => [c.valeur, c.couverture]), [['a', [['E1'], ['E2']]], ['b', [['E3']]]]);
  assert.deepEqual(au(constatsParChemin([E1]), 'y'), un, 'aucun état : le même appel redonne la même chose après les autres');
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. ENTRÉES MAL FORMÉES
test('C1. entrées mal formées : TypeError du producteur ou des couvertures, aucun résultat partiel', () => {
  refuse(() => constatsParChemin(null));
  refuse(() => constatsParChemin([null]));
  refuse(() => constatsParChemin([{ contenu: 1 }]));
  refuse(() => constatsParChemin([{ chemin: ['a'] }]));
  refuse(() => constatsParChemin([el('E1', { x: 1 }), el('E1', { x: 2 })]), 'identité dupliquée');
  refuse(() => constatsParChemin([el('E1', { x: undefined })]));
  refuse(() => constatsParChemin([el('E1', { x: NaN })]));
  refuse(() => constatsParChemin([el('E1', new Date(0))]));
  refuse(() => constatsParChemin([{ chemin: 'E1', contenu: {} }]));
  refuse(() => constatsParChemin([{ get chemin() { return ['E1']; }, contenu: {} }]));
  const creux = []; creux.length = 1;
  refuse(() => constatsParChemin(creux));
});

// ---------------------------------------------------------------------------------------------------------------------------------- D. SIX ÉPISODES
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

test('D1. six épisodes centraux : au chemin ["relationValeur"] un constat "egale" porté par les six ; depart variable ; valeurs présent chez tous ; aucun nom de champ dans le module', async () => {
  const { valeurs, executions } = await rejouer(['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'], true);
  const { familles } = famillesDEpisodes(episodesDeTransformation(valeurs, executions, DESCRIPTIONS_OPERATIONS));
  const famille = familles.find((f) => f.structure.length === 2 && f.structure[1].operation === 'composerCollection' && f.episodes.length === 6);
  // identités des témoins = identité réelle de l'épisode (depart, arrivee) : indépendantes de l'ordre
  const elements = famille.episodes.map((e) => ({ chemin: [e.depart, e.arrivee], contenu: e }));
  const r = constatsParChemin(elements);
  assert.equal(r.universelle.length, 6);
  assert.equal(r.chemins.length, 22);
  const relation = au(r, 'relationValeur');
  assert.deepEqual(relation.constats.map((c) => [c.type, c.valeur]), [['chaine', 'egale']]);
  assert.equal(porteParTous(r, relation.constats[0]), true);
  assert.equal(presentChezTous(r, au(r, 'valeurs')), true);
  assert.equal(au(r, 'valeurs').constats[0].type, 'objet');
  assert.equal(au(r, 'depart').constats.length, 6);
  assert.deepEqual(au(r, 'depart').constats.map((c) => c.valeur), ['message-1', 'message-2', 'message-3', 'message-4', 'message-5', 'message-6']);
  assert.equal(au(r, 'valeurs', 'depart').constats.length, 6);
  assert.equal(porteParTous(r, au(r, 'chemin', 0, 'operation').constats[0]), true, 'constante de famille rapportée sans distinction : la vue ne connaît pas les familles');
  assert.equal(au(r, 'chemin', 0, 'operation').constats[0].valeur, 'symbolesDeChaine');
  const portesParTous = r.chemins.filter((c) => c.constats.length === 1 && porteParTous(r, c.constats[0])).length;
  const plusieurs = r.chemins.filter((c) => c.constats.length > 1).length;
  assert.deepEqual([portesParTous, plusieurs], [12, 10], '12 chemins à constat unique porté par tous (10 imposés par la famille + relationValeur + valeurs), 10 chemins à plusieurs constats');
  assert.deepEqual(constatsParChemin(elements.slice().reverse()), r, 'identités réelles : indépendance de l\'ordre');
  assert.equal(/relationValeur|episode|famille|retour|apprentissage|symbolesDeChaine|composerCollection/i.test(CODE), false);
});

test('D2. coût : six épisodes (22 chemins), 67 épisodes du scénario réel, et 2 000 objets synthétiques ; scénario vivant inchangé', async () => {
  const { tours, valeurs, executions } = await rejouer(['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna']);
  const { episodes } = episodesDeTransformation(valeurs, executions, DESCRIPTIONS_OPERATIONS);
  const elements = episodes.map((e, i) => ({ chemin: [e.depart, e.arrivee, i], contenu: e }));
  let debut = performance.now();
  const r = constatsParChemin(elements);
  assert.ok(performance.now() - debut < 2000, 'scénario réel');
  assert.equal(r.universelle.length, 67);
  const syn = [];
  for (let i = 0; i < 2000; i += 1) syn.push(el(`S${i}`, { a: i % 5, b: `v${i % 3}`, c: { d: i % 2 === 0, e: [i % 4] } }));
  debut = performance.now();
  const s = constatsParChemin(syn);
  assert.ok(performance.now() - debut < 5000, 'synthétique');
  assert.equal(au(s, 'a').constats.length, 5);
  assert.equal(au(s, 'c', 'e', 0).constats.length, 4);
  assert.deepEqual(tours.map((t) => t.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((t) => t.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(executions.length, 19);
  assert.equal(tours.flatMap((t) => t.automatiques).filter((x) => x.statut !== 'executee').length, 0);
});

// ---------------------------------------------------------------------------------------------------------------------------------- E. PURETÉ / DORMANCE
test('E1. pureté : entrée gelée acceptée et intacte ; appels répétés identiques ; aucune référence partagée avec l\'entrée', () => {
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const elements = gel([el('E1', { y: 'a', t: [1] }), el('E2', { y: 'b', t: [1] })]);
  const avant = JSON.stringify(elements);
  const a = constatsParChemin(elements);
  const b = constatsParChemin(elements);
  assert.deepEqual(a, b);
  assert.notEqual(a.chemins[0], b.chemins[0]);
  assert.equal(a.universelle.some((c) => c === elements[0].chemin || c === elements[1].chemin), false);
  for (const c of a.chemins) assert.equal(c.chemin === elements[0].chemin, false);
  assert.equal(JSON.stringify(elements), avant);
});

test('E2. garde statique : ni écriture, magasin, horloge, hasard, asynchrone, état global ; aucun chemin encodé en chaîne ; aucune interprétation', () => {
  for (const motif of [/\bDate\b/, /Math\.random/, /performance\./, /\bawait\b/, /\basync\b/, /\bsetTimeout\b/, /\bPromise\b/, /\bprocess\b/, /\bglobalThis\b/, /\blocalStorage\b/, /\becrire\b|\benregistrer\b|\.ecrire|\.lireTout/, /JSON\.stringify|\.join\(/]) {
    assert.equal(motif.test(CODE), false, String(motif));
  }
  assert.equal(/constant|variable|absent|invariant|regle|règle|attente|prediction|majorit|frequence|compteur|nombreValeurs/i.test(CODE), false);
  assert.equal(/\b(let|var)\b[^;]*=\s*(\[\]|\{\}|new (Map|Set))/.test(CODE.split('export function')[0]), false, 'aucun état de module');
});

test('E3. DORMANCE : aucun fichier de app/ ne nomme le module ni la fonction en dehors de lui-même ; catalogue et table inchangés', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    if (f === join(RACINE, 'app', 'langage', 'contexte-prospectif.js')) continue; // MISE À JOUR DÉLIBÉRÉE v0.63.72 : contexte-prospectif.js (calcul pur du contenu prospectif, appelé par execution-sollicitee.js AVANT l'issue) compose cette vue : elle n'est plus dormante
    assert.equal(/constats-par-chemin|constatsParChemin/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/constats-par-chemin|constatsParChemin/.test(s), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17);
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
