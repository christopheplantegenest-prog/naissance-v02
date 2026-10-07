// v0.63.69 — episodesDeTransformation : observer les épisodes de transformation vécus, y compris les non-retours (décision ChatGPT, 07/10/2026). Preuves : un épisode = un chemin
// individuel { depart, arrivee, chemin, relationValeur } ; relation egale / differente / non_comparable par l'égalité typée existante (jamais déduite des formes) ; descendance par les seules
// liaisons persistées (direct, profondeur 2 et 3, branches, plusieurs parents, plusieurs chemins non fusionnés, cycle synthétique) ; retoursDeValeur = projection des épisodes 'egale' (une
// seule source de vérité) ; cas réel egale (message-1 -> R -> S') et differente (message-1 -> … -> true) ; six expériences répétées distinctes ; contre-exemple de même structure de
// formes ; temporalité ; coût mesuré ; entrées mal formées ; pureté ; dormance ; scénario vivant inchangé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/episodes-de-transformation.js';
import { episodesDeTransformation, RELATIONS_VALEUR } from '../app/langage/episodes-de-transformation.js';
import { retoursDeValeur } from '../app/langage/retours-de-valeur.js';
import { symbolesDeChaine } from '../app/langage/symboles-de-chaine.js';
import { composerCollection } from '../app/langage/composer-collection.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'episodes-de-transformation.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const SRC_RETOURS = readFileSync(join(RACINE, 'app', 'langage', 'retours-de-valeur.js'), 'utf8');
const CODE_RETOURS = SRC_RETOURS.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError);

const ch = { forme: 'scalaire', genre: 'chaine' };
const coll = { forme: 'collection', elements: ch };
const DESC = [
  { nom: 'transformer', entrees: { x: ch }, sortie: ch },
  { nom: 'assembler', entrees: { gauche: ch, droite: ch }, sortie: ch },
  { nom: 'eclater', entrees: { x: ch }, sortie: coll },
  { nom: 'recoller', entrees: { elements: coll }, sortie: ch },
  { nom: 'couperAuxEspaces', entrees: { x: ch }, sortie: coll },
];
const msg = (id, valeur) => ({ id, valeur });
const lien = (entree, donnee) => ({ entree, donnee });
const ex = (id, operation, liaisons, resultat) => ({ id, horodatage: 1, idDesignation: `d-${id}`, operation, liaisons, resultat });
const cles = (r) => r.episodes.map((e) => `${e.depart}>${e.arrivee}:${e.relationValeur}`);
const ops = (e) => e.chemin.map((x) => x.operation).join('>');

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. exports : episodesDeTransformation (3 paramètres, synchrone) et RELATIONS_VALEUR exactement egale/differente/non_comparable', () => {
  assert.deepEqual(Object.keys(module).sort(), ['RELATIONS_VALEUR', 'episodesDeTransformation']);
  assert.equal(episodesDeTransformation.length, 3);
  assert.equal(episodesDeTransformation.constructor.name, 'Function');
  assert.deepEqual(RELATIONS_VALEUR, ['egale', 'differente', 'non_comparable']);
  assert.equal(Object.isFrozen(RELATIONS_VALEUR), true);
  assert.deepEqual(episodesDeTransformation([], [], DESC), { episodes: [], nonComparables: [], nombreDescendances: 0 });
});

test('A2. épisode direct A -> B : un chemin d\'une étape { de, execution, operation, entrees, vers }, relation egale, valeurs exposées', () => {
  const r = episodesDeTransformation([msg('A', 'v')], [ex('P', 'transformer', [lien('x', 'A')], 'v')], DESC);
  assert.deepEqual(r.episodes, [{ depart: 'A', arrivee: 'P', chemin: [{ de: 'A', execution: 'P', operation: 'transformer', entrees: ['x'], vers: 'P' }], relationValeur: 'egale', valeurs: { depart: 'v', arrivee: 'v' } }]);
  assert.equal(r.nombreDescendances, 1);
  for (const e of r.episodes) assert.deepEqual(Object.keys(e), ['depart', 'arrivee', 'chemin', 'relationValeur', 'valeurs']);
});

test('A3. aucun champ interprétatif : ni score, confiance, fréquence, succès, échec, règle, attente, utilité (sortie et code)', () => {
  const r = episodesDeTransformation([msg('A', 'v')], [ex('P', 'transformer', [lien('x', 'A')], 'w')], DESC);
  assert.equal(/score|confiance|frequence|fréquence|succes|succès|echec|échec|regle|règle|attente|utilite|utilité|compteur|famille/i.test(JSON.stringify(r)), false);
  assert.equal(/score|confiance|frequence|succes|echec|regle|attente|utilite|compteur|famille|inverse|apprentissage/i.test(CODE), false);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. DESCENDANCE
test('B1. profondeur 2 et 3 : un épisode par couple (ancêtre, descendant), chemin complet, relation sur les extrémités', () => {
  const E2 = [ex('B', 'transformer', [lien('x', 'A')], 'z'), ex('C', 'transformer', [lien('x', 'B')], 'v')];
  const r2 = episodesDeTransformation([msg('A', 'v')], E2, DESC);
  assert.deepEqual(cles(r2), ['A>B:differente', 'A>C:egale', 'B>C:differente']);
  assert.equal(ops(r2.episodes[1]), 'transformer>transformer');
  const E3 = [...E2, ex('D', 'assembler', [lien('droite', 'C'), lien('gauche', 'C')], 'w'), ex('E', 'transformer', [lien('x', 'D')], 'v')];
  const r3 = episodesDeTransformation([msg('A', 'v')], E3, DESC);
  assert.deepEqual(cles(r3), ['A>B:differente', 'A>C:egale', 'A>D:differente', 'A>E:egale', 'B>C:differente', 'B>D:differente', 'B>E:differente', 'C>D:differente', 'C>E:egale', 'D>E:differente']);
  assert.equal(r3.episodes[3].chemin.length, 4);
  assert.deepEqual(r3.episodes[3].chemin[2].entrees, ['droite', 'gauche'], 'une donnée entrée par deux noms : UNE étape, noms triés');
  assert.equal(r3.nombreDescendances, 10);
});

test('B2. branches : A -> B, A -> C, B -> D : D a pour départs B et A, jamais C ; même valeur de B et C sans effet', () => {
  const E = [ex('B', 'transformer', [lien('x', 'A')], 'k'), ex('C', 'transformer', [lien('x', 'A')], 'k'), ex('D', 'transformer', [lien('x', 'B')], 'k')];
  const r = episodesDeTransformation([msg('A', 'a')], E, DESC);
  assert.deepEqual(cles(r), ['A>B:differente', 'A>C:differente', 'A>D:differente', 'B>D:egale']);
  assert.equal(cles(r).some((c) => c.startsWith('C>')), false);
});

test('B3. plusieurs parents : Q issue de P(A, B) a deux départs ; aucun parent principal ; une liaison collective donne un parent par identité', () => {
  const E = [ex('P', 'assembler', [lien('droite', 'B'), lien('gauche', 'A')], 'ab'), ex('Q', 'transformer', [lien('x', 'P')], 'qq')];
  const r = episodesDeTransformation([msg('A', 'qq'), msg('B', 'zz')], E, DESC);
  assert.deepEqual(cles(r), ['A>P:differente', 'A>Q:egale', 'B>P:differente', 'B>Q:differente', 'P>Q:differente']);
  const c = episodesDeTransformation([msg('A', 'v'), msg('B', 'v')], [ex('P', 'transformer', [{ entree: 'x', donnees: ['A', 'B'] }], 'v')], DESC);
  assert.deepEqual(cles(c), ['A>P:egale', 'B>P:egale']);
});

test('B4. plusieurs chemins entre un même départ et une même arrivée = plusieurs épisodes, jamais fusionnés, ordre déterministe', () => {
  const E = [
    ex('B', 'transformer', [lien('x', 'A')], 'b'),
    ex('C', 'transformer', [lien('x', 'A')], 'c'),
    ex('D', 'assembler', [lien('droite', 'C'), lien('gauche', 'B')], 'v'),
    ex('F', 'assembler', [lien('droite', 'D'), lien('gauche', 'A')], 'v2'),
  ];
  const r = episodesDeTransformation([msg('A', 'v2')], E, DESC);
  const AD = r.episodes.filter((e) => e.depart === 'A' && e.arrivee === 'D');
  assert.deepEqual(AD.map((e) => e.chemin.map((x) => x.vers).join('>')), ['B>D', 'C>D']);
  assert.deepEqual(AD.map((e) => e.relationValeur), ['differente', 'differente']);
  const AF = r.episodes.filter((e) => e.depart === 'A' && e.arrivee === 'F');
  assert.deepEqual(AF.map((e) => e.chemin.map((x) => x.vers).join('>')), ['B>D>F', 'C>D>F', 'F'], 'un chemin direct (longueur 1) et deux indirects : trois épisodes');
  assert.deepEqual(AF.map((e) => e.relationValeur), ['egale', 'egale', 'egale']);
  assert.equal(r.episodes.length, 12, '9 couples, 12 chemins');
  assert.equal(r.nombreDescendances, 9, 'les descendances comptent les couples, pas les chemins');
});

test('B5. même identité exclue ; cycle synthétique : terminaison, chemins simples, déterminisme, données intactes', () => {
  const boucle = episodesDeTransformation([msg('A', 'v')], [ex('P', 'transformer', [lien('x', 'P')], 'v')], DESC);
  assert.deepEqual(boucle.episodes, []);
  const E = [ex('P', 'transformer', [lien('x', 'Q')], 'v'), ex('Q', 'transformer', [lien('x', 'P')], 'w')];
  const copie = JSON.stringify(E);
  const r = episodesDeTransformation([], E, DESC);
  assert.deepEqual(cles(r), ['P>Q:differente', 'Q>P:differente']);
  assert.deepEqual(r.episodes.map((e) => e.chemin.length), [1, 1]);
  assert.deepEqual(episodesDeTransformation([], E.slice().reverse(), DESC), r);
  assert.equal(JSON.stringify(E), copie);
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. RELATION DE VALEUR
test('C1. égalité typée de l\'existant : 7 et "7" différents ; null et undefined différents ; -0 et 0 égaux ; booléens comparés', () => {
  const un = (va, vp) => episodesDeTransformation([msg('A', va)], [ex('P', 'transformer', [lien('x', 'A')], vp)], DESC).episodes[0].relationValeur;
  assert.equal(un(7, '7'), 'differente');
  assert.equal(un(7, 7), 'egale');
  assert.equal(un(null, undefined), 'differente');
  assert.equal(un(null, null), 'egale');
  assert.equal(un(undefined, undefined), 'egale');
  assert.equal(un(0, -0), 'egale');
  assert.equal(un(true, false), 'differente');
  assert.equal(un('bonjour Pixel', true), 'differente');
});

test('C2. non_comparable : une extrémité collection/objet ; l\'épisode est conservé, sans valeurs ; la donnée est listée avec sa raison', () => {
  const E = [ex('R', 'eclater', [lien('x', 'A')], ['b', 'o']), ex('S', 'recoller', [lien('elements', 'R')], 'v')];
  const r = episodesDeTransformation([msg('A', 'v')], E, DESC);
  assert.deepEqual(cles(r), ['A>R:non_comparable', 'A>S:egale', 'R>S:non_comparable']);
  assert.equal('valeurs' in r.episodes[0], false);
  assert.deepEqual(r.episodes[1].valeurs, { depart: 'v', arrivee: 'v' });
  assert.deepEqual(r.nonComparables.map((q) => q.identite), ['R']);
  assert.match(r.nonComparables[0].raison, /tableau/);
  const deux = episodesDeTransformation([msg('A', 'v')], [ex('R', 'eclater', [lien('x', 'A')], ['v']), ex('R2', 'eclater', [lien('x', 'R')], ['v'])], DESC);
  assert.deepEqual(deux.episodes.map((e) => e.relationValeur), ['non_comparable', 'non_comparable', 'non_comparable'], 'deux collections identiques : jamais egale (aucune égalité profonde)');
});

test('C3. contre-exemple : même structure de formes chaine -> collection<chaine> -> chaine, arrivée différente du départ : differente (rien n\'est déduit des formes)', () => {
  const S = 'bonjour Pixel';
  const E = [
    ex('R1', 'eclater', [lien('x', 'm1')], symbolesDeChaine(S)), ex('S1', 'recoller', [lien('elements', 'R1')], composerCollection(symbolesDeChaine(S))),
    ex('R2', 'couperAuxEspaces', [lien('x', 'm1')], S.split(' ')), ex('S2', 'recoller', [lien('elements', 'R2')], S.split(' ').join('')),
  ];
  const r = episodesDeTransformation([msg('m1', S)], E, DESC);
  const fin = r.episodes.filter((e) => e.depart === 'm1' && e.chemin.length === 2);
  assert.deepEqual(fin.map((e) => `${ops(e)}:${e.relationValeur}`), ['eclater>recoller:egale', 'couperAuxEspaces>recoller:differente']);
  assert.deepEqual(fin[1].valeurs, { depart: 'bonjour Pixel', arrivee: 'bonjourPixel' });
  assert.equal(/forme|genre|sortie|entrees\.|champs/.test(CODE.replace(/'entrees'|\.entrees\b/g, '')), false, 'le code ne lit aucune forme');
});

// ---------------------------------------------------------------------------------------------------------------------------------- D. PROJECTION retoursDeValeur
test('D1. retoursDeValeur = projection des épisodes egale regroupés par couple ; aucune logique de graphe/valeur dans retours-de-valeur.js', () => {
  const E = [ex('B', 'transformer', [lien('x', 'A')], 'b'), ex('C', 'transformer', [lien('x', 'A')], 'c'), ex('D', 'assembler', [lien('droite', 'C'), lien('gauche', 'B')], 'v'), ex('F', 'assembler', [lien('droite', 'D'), lien('gauche', 'A')], 'v2')];
  const M = [msg('A', 'v2')];
  const ep = episodesDeTransformation(M, E, DESC);
  const re = retoursDeValeur(M, E, DESC);
  assert.deepEqual(re.retours.map((x) => [x.ancetre, x.descendant, x.valeur, x.chemins.length]), [['A', 'F', 'v2', 3]]);
  assert.deepEqual(re.retours[0].chemins, ep.episodes.filter((e) => e.relationValeur === 'egale').map((e) => e.chemin));
  assert.deepEqual(re.nonComparables, ep.nonComparables);
  assert.equal(re.nombreDescendances, ep.nombreDescendances);
  const importees = [...SRC_RETOURS.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]);
  assert.deepEqual(importees, ['./episodes-de-transformation.js']);
  assert.equal(/liaisons|entreesDeProduction|indexSousDonnees|resoudreIdentitesDonnees|valeurDePorteur|decrireValeursObservees|parents|ascendance/.test(CODE_RETOURS), false, 'une seule source de vérité');
});

// ---------------------------------------------------------------------------------------------------------------------------------- E. ENTRÉES MAL FORMÉES
test('E1. entrées mal formées : TypeError, jamais de résultat partiel', () => {
  const ok = [ex('P', 'transformer', [lien('x', 'A')], 'v')];
  const M = [msg('A', 'v')];
  refuse(() => episodesDeTransformation(null, ok, DESC));
  refuse(() => episodesDeTransformation(M, 'x', DESC));
  refuse(() => episodesDeTransformation(M, ok, {}));
  refuse(() => episodesDeTransformation(M, [null], DESC));
  refuse(() => episodesDeTransformation(M, [{ id: 'P' }], DESC));
  refuse(() => episodesDeTransformation(M, [ex('P', 'transformer', [], 'v')], DESC));
  refuse(() => episodesDeTransformation(M, [ex('P', 'transformer', [lien('x', 'INCONNU')], 'v')], DESC));
  refuse(() => episodesDeTransformation(M, [ex('P', 'inconnue', [lien('x', 'A')], 'v')], DESC));
  refuse(() => episodesDeTransformation(M, ok.concat(ok), DESC));
  refuse(() => episodesDeTransformation(M.concat(M), ok, DESC));
  refuse(() => episodesDeTransformation([...M, msg('P', 'v')], ok, DESC));
  const creux = []; creux.length = 1;
  refuse(() => episodesDeTransformation(M, creux, DESC));
  refuse(() => episodesDeTransformation(M, [{ get id() { return 'P'; }, operation: 'transformer', liaisons: [lien('x', 'A')], resultat: 'v' }], DESC));
});

// ---------------------------------------------------------------------------------------------------------------------------------- F. CAS RÉELS
async function rejouer(scenario, solliciter = false) {
  const magasin = magasinMemoireVive();
  let n = 0;
  const nouvelId = (p) => `${p}-${++n}`;
  const tours = [];
  const apres = [];
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
      // Sonde : par le chemin du bouton développeur (origine extérieure), recomposer chaque R non encore composé, puis décomposer le message du tour.
      const { observation, univers } = s;
      const vals = await magasin.lireTout('valeursDonnees');
      const msgId = vals[vals.length - 1].id;
      const faits = await ex();
      const soll = async (operation, liaisons) => { const r = await executerApplicationSollicitee({ observation, application: { operation, liaisons }, univers }, { magasin, table: TABLE_OPERATIONS }); assert.equal(r.statut, 'executee'); };
      for (const R of faits.filter((e) => e.operation === 'symbolesDeChaine')) {
        if (!faits.some((e) => e.operation === 'composerCollection' && e.liaisons[0].donnee === R.id) && observation.donneesExaminees.includes(R.id)) await soll('composerCollection', [lien('elements', R.id)]);
      }
      if (!(await ex()).some((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === msgId)) await soll('symbolesDeChaine', [lien('chaine', msgId)]);
    }
    apres.push({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex() });
  }
  return { tours, apres };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const compter = (r) => r.episodes.reduce((c, e) => { c[e.relationValeur] += 1; return c; }, { egale: 0, differente: 0, non_comparable: 0 });

test('F1. scénario 7 tours : égal (message-1 -> R -> S\'), différent (message-1 -> … -> true), non comparables conservés ; mesures ; projection identique à .68 ; scénario vivant inchangé', async () => {
  const { tours, apres } = await rejouer(SCENARIO);
  const r = episodesDeTransformation(apres[6].valeurs, apres[6].executions, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(compter(r), { egale: 1, differente: 1, non_comparable: 65 });
  assert.equal(r.episodes.length, 67);
  assert.equal(r.nombreDescendances, 64);
  assert.equal(r.nonComparables.length, 20);
  const egal = r.episodes.find((e) => e.relationValeur === 'egale');
  assert.equal(egal.depart, 'message-1');
  assert.deepEqual(egal.valeurs, { depart: 'bonjour Pixel', arrivee: 'bonjour Pixel' });
  assert.deepEqual(egal.chemin.map((x) => `${x.operation}(${x.entrees})`), ['symbolesDeChaine(chaine)', 'composerCollection(elements)']);
  assert.equal(apres[6].executions.find((e) => e.id === egal.arrivee).operation, 'composerCollection');
  const diff = r.episodes.find((e) => e.relationValeur === 'differente');
  assert.equal(diff.depart, 'message-1');
  assert.deepEqual(diff.valeurs, { depart: 'bonjour Pixel', arrivee: true });
  assert.deepEqual(diff.chemin.map((x) => `${x.operation}(${x.entrees})`), ['parcourirStructure(valeur)', 'projeterChemins(elements)', 'memesCouvertures(a,b)']);
  assert.equal(apres[6].executions.find((e) => e.id === diff.arrivee).resultat, true);
  // longueurs et chemins multiples
  const longueurs = r.episodes.reduce((c, e) => { c[e.chemin.length] = (c[e.chemin.length] ?? 0) + 1; return c; }, {});
  assert.deepEqual(longueurs, { 1: 29, 2: 26, 3: 12 });
  // projection .68 inchangée
  const re = retoursDeValeur(apres[6].valeurs, apres[6].executions, DESCRIPTIONS_OPERATIONS);
  assert.equal(re.retours.length, 1);
  assert.deepEqual(re.retours[0].chemins, [egal.chemin]);
  // scénario vivant
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(apres[6].executions.length, 19);
  assert.equal(tours.flatMap((s) => s.automatiques).filter((x) => x.statut !== 'executee').length, 0);
});

test('F2. temporalité : le premier épisode egale du cas central n\'existe qu\'après T2 (S\' persistée) ; aucun épisode ne précède son arrivée', async () => {
  const { apres } = await rejouer(SCENARIO.slice(0, 3));
  const parTour = apres.map((a) => episodesDeTransformation(a.valeurs, a.executions, DESCRIPTIONS_OPERATIONS));
  assert.deepEqual(parTour.map((r) => compter(r).egale), [0, 1, 1]);
  assert.deepEqual(parTour.map((r) => r.episodes.length), [2, 9, 51]);
  const egal = parTour[1].episodes.find((e) => e.relationValeur === 'egale');
  assert.equal(apres[1].executions.some((e) => e.id === egal.arrivee), true);
  assert.equal(apres[0].executions.some((e) => e.id === egal.arrivee), false);
  for (const [t, r] of parTour.entries()) for (const e of r.episodes) for (const x of e.chemin) assert.equal(apres[t].executions.some((l) => l.id === x.execution), true, 'tout le chemin existe au tour observé');
});

test('F3. expériences répétées (sonde) : six chaînes distinctes dont vide et combinant -> six épisodes egale distincts, même structure, aucune fusion, aucun compteur', async () => {
  const { apres } = await rejouer(['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'], true);
  const r = episodesDeTransformation(apres[6].valeurs, apres[6].executions, DESCRIPTIONS_OPERATIONS);
  assert.equal(apres[6].executions.length, 29);
  assert.deepEqual(compter(r), { egale: 6, differente: 1, non_comparable: 95 });
  const egaux = r.episodes.filter((e) => e.relationValeur === 'egale');
  assert.deepEqual(egaux.map((e) => e.depart), ['message-1', 'message-2', 'message-3', 'message-4', 'message-5', 'message-6']);
  assert.deepEqual(egaux.map((e) => e.valeurs.depart), ['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa']);
  for (const e of egaux) {
    assert.deepEqual(e.chemin.map((x) => `${x.operation}(${x.entrees})`), ['symbolesDeChaine(chaine)', 'composerCollection(elements)']);
    assert.equal(e.valeurs.arrivee, e.valeurs.depart);
    assert.notEqual(e.arrivee, e.depart);
  }
  assert.equal(new Set(egaux.map((e) => e.arrivee)).size, 6);
  assert.equal(retoursDeValeur(apres[6].valeurs, apres[6].executions, DESCRIPTIONS_OPERATIONS).retours.length, 6);
});

test('F4. coût : énumération complète sur l\'état réel à T7 (67 chemins) et sur un graphe synthétique dense, sans limite', async () => {
  const { apres } = await rejouer(SCENARIO);
  const debut = performance.now();
  for (let k = 0; k < 10; k += 1) episodesDeTransformation(apres[6].valeurs, apres[6].executions, DESCRIPTIONS_OPERATIONS);
  const ms = (performance.now() - debut) / 10;
  assert.ok(ms < 500, `${ms} ms par appel`);
  // graphe en « losanges » enchaînés : 2^n chemins simples entre les extrémités (n = 8 -> 256) : tous énumérés.
  const E = [];
  let precedent = 'A';
  for (let k = 0; k < 8; k += 1) {
    E.push(ex(`G${k}`, 'transformer', [lien('x', precedent)], 'v'), ex(`H${k}`, 'transformer', [lien('x', precedent)], 'v'), ex(`J${k}`, 'assembler', [lien('droite', `H${k}`), lien('gauche', `G${k}`)], 'v'));
    precedent = `J${k}`;
  }
  const r = episodesDeTransformation([msg('A', 'v')], E, DESC);
  assert.equal(r.episodes.filter((e) => e.depart === 'A' && e.arrivee === 'J7').length, 256);
  assert.equal(r.nombreDescendances, [...new Set(r.episodes.map((e) => `${e.depart}>${e.arrivee}`))].length);
});

// ---------------------------------------------------------------------------------------------------------------------------------- G. PURETÉ / DORMANCE
test('G1. pureté : entrées gelées acceptées et intactes, appels répétés identiques, sorties neuves', () => {
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const M = gel([msg('A', 'v')]);
  const E = gel([ex('B', 'transformer', [lien('x', 'A')], 'z'), ex('C', 'transformer', [lien('x', 'B')], 'v')]);
  const D = gel(structuredClone(DESC));
  const avant = JSON.stringify([M, E, D]);
  const a = episodesDeTransformation(M, E, D);
  const b = episodesDeTransformation(M, E, D);
  assert.deepEqual(a, b);
  assert.notEqual(a.episodes[0], b.episodes[0]);
  assert.equal(JSON.stringify([M, E, D]), avant);
});

test('G2. garde statique : ni écriture, magasin, horloge, hasard, asynchrone, état global ; aucun nom d\'opération ; imports exactement les cinq primitives existantes', () => {
  for (const motif of [/\bDate\b/, /Math\.random/, /performance\./, /\bawait\b/, /\basync\b/, /\bsetTimeout\b/, /\bPromise\b/, /\bprocess\b/, /\bglobalThis\b/, /\blocalStorage\b/, /\becrire\b|\benregistrer\b|\.ecrire|\.lireTout/]) {
    assert.equal(motif.test(CODE), false, String(motif));
    assert.equal(motif.test(CODE_RETOURS), false, String(motif));
  }
  assert.equal(/symbolesDeChaine|composerCollection|parcourirStructure|projeterChemins|memesCouvertures/.test(CODE), false);
  assert.equal(/'(symboles|composer|transformer|assembler|eclater|recoller)[A-Za-z]*'/.test(CODE), false);
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./acces-valeur.js', './entrees-production.js', './resoudre-identites.js', './sous-donnees.js', './valeurs-observees.js']);
  assert.equal(/\blet\b[^;]*=\s*(\[\]|\{\}|new (Map|Set))/.test(CODE.split('export function')[0]), false, 'aucun état de module');
});

test('G3. DORMANCE : seul retours-de-valeur.js (dormant) importe la vue ; aucun mécanisme interdit ne la connaît ; aucun catalogue, aucune table', () => {
  const nommants = fichiersJs(join(RACINE, 'app')).filter((f) => f !== CHEMIN && /episodes-de-transformation|episodesDeTransformation/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1));
  // MISE À JOUR DÉLIBÉRÉE v0.63.70 : familles-episodes.js (vue dormante, sans aucune importation) NOMME episodesDeTransformation en commentaire : sa sortie est l'entrée de la vue des familles.
  assert.deepEqual(nommants, ['app/langage/contexte-prospectif.js', 'app/langage/familles-episodes.js', 'app/langage/retours-de-valeur.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : contexte-prospectif.js (calcul pur du contenu prospectif, appelé par execution-sollicitee.js AVANT l'issue) compose cette vue : elle n'est plus dormante
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /from '\.\/episodes-de-transformation\.js'/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1));
  assert.deepEqual(importeurs, ['app/langage/contexte-prospectif.js', 'app/langage/retours-de-valeur.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : contexte-prospectif.js (calcul pur du contenu prospectif, appelé par execution-sollicitee.js AVANT l'issue) compose cette vue : elle n'est plus dormante
  for (const nom of ['applications-sollicitables', 'execution-mecanique', 'execution-sollicitee', 'pont', 'esprit', 'correspondances-experiences', 'observation-possibilites', 'descriptions-operations', 'table-operations']) {
    assert.equal(/episodes-de-transformation|episodesDeTransformation|retours-de-valeur|retoursDeValeur/.test(readFileSync(join(RACINE, 'app', 'langage', `${nom}.js`), 'utf8')), false, nom);
  }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17);
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
