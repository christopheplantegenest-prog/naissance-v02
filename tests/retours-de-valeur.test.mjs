// v0.63.68 — retoursDeValeur : observer un retour de valeur dans une chaîne de productions (décision ChatGPT, 07/10/2026). Preuves : descendance transitive par les seules liaisons
// persistées (parent direct, profondeur 2 et 3, branche, entrées multiples, cycle synthétique) ; retour = descendance ET identités différentes ET valeur égale ; même valeur sans
// descendance et descendance sans même valeur ne produisent aucun retour ; tous les chemins distincts conservés ; valeurs non scalaires déclarées non comparables ; entrées mal formées ;
// temporalité (aucune production future) ; pureté ; dormance ; cas réel message -> R -> S' sur le scénario à 7 tours, scénario vivant inchangé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/retours-de-valeur.js';
import { retoursDeValeur } from '../app/langage/retours-de-valeur.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'retours-de-valeur.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError);

// Catalogue SYNTHÉTIQUE : trois opérations à sortie chaîne scalaire (une entrée, une entrée, deux entrées) et une à sortie collection.
const sortieChaine = { forme: 'scalaire', genre: 'chaine' };
const DESC = [
  { nom: 'transformer', entrees: { x: { forme: 'scalaire', genre: 'chaine' } }, sortie: sortieChaine },
  { nom: 'assembler', entrees: { gauche: { forme: 'scalaire', genre: 'chaine' }, droite: { forme: 'scalaire', genre: 'chaine' } }, sortie: sortieChaine },
  { nom: 'eclater', entrees: { x: { forme: 'scalaire', genre: 'chaine' } }, sortie: { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } } },
];
const msg = (id, valeur) => ({ id, valeur });
const lien = (entree, donnee) => ({ entree, donnee });
const ex = (id, operation, liaisons, resultat) => ({ id, horodatage: 1, idDesignation: `d-${id}`, operation, liaisons, resultat });
const ids = (r) => r.retours.map((x) => `${x.ancetre}>${x.descendant}`);
const ops = (chemin) => chemin.map((e) => e.operation);

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. export nommé unique, fonction synchrone à trois paramètres, sortie { retours, nonComparables, nombreDescendances }', () => {
  assert.deepEqual(Object.keys(module), ['retoursDeValeur']);
  assert.equal(retoursDeValeur.length, 3);
  assert.equal(retoursDeValeur.constructor.name, 'Function');
  const r = retoursDeValeur([], [], DESC);
  assert.deepEqual(r, { retours: [], nonComparables: [], nombreDescendances: 0 });
});

test('A2. parent direct : retour de longueur 1, chemin = une étape portant la ligne d\'exécution, l\'opération persistée et le nom d\'entrée', () => {
  const r = retoursDeValeur([msg('A', 'v')], [ex('P', 'transformer', [lien('x', 'A')], 'v')], DESC);
  assert.deepEqual(r.retours, [{ ancetre: 'A', descendant: 'P', valeur: 'v', chemins: [[{ de: 'A', execution: 'P', operation: 'transformer', entrees: ['x'], vers: 'P' }]] }]);
  assert.equal(r.nombreDescendances, 1);
});

test('A3. profondeur 2 et 3 : descendance transitive, valeur égale à l\'ancêtre lointain, chemin complet', () => {
  const E2 = [ex('B', 'transformer', [lien('x', 'A')], 'z'), ex('C', 'transformer', [lien('x', 'B')], 'v')];
  const r2 = retoursDeValeur([msg('A', 'v')], E2, DESC);
  assert.deepEqual(ids(r2), ['A>C']);
  assert.equal(r2.nombreDescendances, 3);
  assert.deepEqual(r2.retours[0].chemins.map((c) => c.map((e) => `${e.de}>${e.vers}`)), [['A>B', 'B>C']]);
  const E3 = [...E2, ex('D', 'assembler', [lien('droite', 'C'), lien('gauche', 'C')], 'w'), ex('E', 'transformer', [lien('x', 'D')], 'v')];
  const r3 = retoursDeValeur([msg('A', 'v')], E3, DESC);
  assert.deepEqual(ids(r3), ['A>C', 'A>E', 'C>E']);
  assert.deepEqual(r3.retours[1].chemins.map((c) => c.map((e) => `${e.de}>${e.vers}`)), [['A>B', 'B>C', 'C>D', 'D>E']]);
  assert.deepEqual(r3.retours[1].chemins[0][2].entrees, ['droite', 'gauche'], 'une donnée qui entre par deux noms : UNE étape, noms triés');
});

test('A4. branche : A -> B, A -> C, B -> D : D descend de B et de A, pas de C ; B et C de même valeur ne créent aucune parenté', () => {
  const E = [ex('B', 'transformer', [lien('x', 'A')], 'k'), ex('C', 'transformer', [lien('x', 'A')], 'k'), ex('D', 'transformer', [lien('x', 'B')], 'k')];
  const r = retoursDeValeur([msg('A', 'a')], E, DESC);
  assert.deepEqual(ids(r), ['B>D'], 'A vaut "a" : aucun retour avec A ; B, C, D partagent "k" : seul B>D est une descendance (C n\'est pas un ancêtre de D)');
  const r2 = retoursDeValeur([msg('A', 'k')], E, DESC);
  assert.deepEqual(ids(r2), ['A>B', 'A>C', 'A>D', 'B>D']);
  assert.equal(r2.nombreDescendances, 4);
  assert.equal(ids(r2).includes('C>D'), false);
  assert.equal(ids(r2).includes('B>C'), false);
});

test('A5. plusieurs entrées : Q issue de P(A, B) descend des deux ; aucun parent principal', () => {
  const E = [ex('P', 'assembler', [lien('droite', 'B'), lien('gauche', 'A')], 'ab'), ex('Q', 'transformer', [lien('x', 'P')], 'qq')];
  const r = retoursDeValeur([msg('A', 'qq'), msg('B', 'qq')], E, DESC);
  assert.deepEqual(ids(r), ['A>Q', 'B>Q']);
  assert.equal(r.nombreDescendances, 5, 'A>P, B>P, A>Q, B>Q, P>Q');
});

test('A6. collective : chaque identité d\'une liaison collective est un parent', () => {
  const E = [ex('P', 'transformer', [{ entree: 'x', donnees: ['A', 'B'] }], 'v')];
  const r = retoursDeValeur([msg('A', 'v'), msg('B', 'v')], E, DESC);
  assert.deepEqual(ids(r), ['A>P', 'B>P']);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. FAITS ET NON-FAITS
test('B1. même valeur sans descendance : aucun retour (coïncidence), quelle que soit la chronologie ou l\'ordre des lignes', () => {
  const E = [ex('P', 'transformer', [lien('x', 'A')], 'zzz'), ex('X', 'transformer', [lien('x', 'B')], 'bonjour Pixel')];
  const r = retoursDeValeur([msg('A', 'bonjour Pixel'), msg('B', 'autre')], E, DESC);
  assert.deepEqual(ids(r), [], 'X vaut "bonjour Pixel" comme A mais descend de B');
  const r2 = retoursDeValeur([msg('A', 'bonjour Pixel'), msg('B', 'bonjour Pixel')], [E[0]], DESC);
  assert.deepEqual(r2.retours, [], 'deux messages de même valeur : aucun lien');
});

test('B2. descendance sans même valeur : aucun retour, mais la descendance est comptée', () => {
  const E = [ex('B', 'transformer', [lien('x', 'A')], 'b'), ex('C', 'transformer', [lien('x', 'B')], 'c')];
  const r = retoursDeValeur([msg('A', 'a')], E, DESC);
  assert.deepEqual(r.retours, []);
  assert.equal(r.nombreDescendances, 3);
});

test('B3. identités différentes obligatoires : la même identité n\'est jamais un retour, même en cycle', () => {
  const r = retoursDeValeur([msg('A', 'v')], [ex('P', 'transformer', [lien('x', 'P')], 'v')], DESC);
  assert.deepEqual(r.retours, [], 'auto-liaison : P n\'est pas son propre descendant');
  assert.equal(r.nombreDescendances, 0);
});

test('B4. plusieurs chemins distincts conservés, jamais fusionnés, triés de façon déterministe', () => {
  const E = [
    ex('B', 'transformer', [lien('x', 'A')], 'b'),
    ex('C', 'transformer', [lien('x', 'A')], 'c'),
    ex('D', 'assembler', [lien('droite', 'C'), lien('gauche', 'B')], 'v'),
    ex('F', 'assembler', [lien('droite', 'D'), lien('gauche', 'A')], 'v2'),
  ];
  const r = retoursDeValeur([msg('A', 'v')], E, DESC);
  assert.deepEqual(ids(r), ['A>D']);
  assert.deepEqual(r.retours[0].chemins.map((c) => c.map((e) => e.vers).join('>')), ['B>D', 'C>D']);
  const direct = retoursDeValeur([msg('A', 'v2')], E.slice(0, 3).concat(ex('F', 'assembler', [lien('droite', 'D'), lien('gauche', 'A')], 'v2')), DESC);
  assert.deepEqual(direct.retours.map((x) => [x.ancetre, x.descendant, x.chemins.map((c) => c.map((e) => e.vers).join('>'))]), [['A', 'F', ['B>D>F', 'C>D>F', 'F']]], 'un chemin direct (longueur 1) et des chemins indirects coexistent');
});

test('B5. cycle synthétique : terminaison, déterminisme, données jamais corrigées', () => {
  const E = [ex('P', 'transformer', [lien('x', 'Q')], 'v'), ex('Q', 'transformer', [lien('x', 'P')], 'v')];
  const copie = JSON.stringify(E);
  const r = retoursDeValeur([], E, DESC);
  assert.deepEqual(ids(r), ['P>Q', 'Q>P']);
  assert.deepEqual(r.retours[0].chemins.map((c) => c.map((e) => e.vers)), [['Q']]);
  assert.deepEqual(retoursDeValeur([], E.slice().reverse(), DESC), r, 'indépendant de l\'ordre des lignes');
  assert.equal(JSON.stringify(E), copie);
  const triple = [ex('P', 'transformer', [lien('x', 'A')], 'v'), ex('Q', 'transformer', [lien('x', 'P')], 'z'), ex('R', 'transformer', [lien('x', 'Q')], 'v'), ex('A2', 'transformer', [lien('x', 'R')], 'v')];
  const r3 = retoursDeValeur([msg('A', 'v')], triple, DESC);
  assert.deepEqual(ids(r3), ['A>A2', 'A>P', 'A>R', 'P>A2', 'P>R', 'R>A2']);
});

test('B6. aucun nom d\'opération n\'intervient : le même graphe sous d\'autres noms donne les mêmes constats', () => {
  const renomme = DESC.map((d) => ({ ...d, nom: `${d.nom}2` }));
  const E = [ex('B', 'transformer', [lien('x', 'A')], 'z'), ex('C', 'transformer', [lien('x', 'B')], 'v')];
  const E2 = E.map((l) => ({ ...l, operation: 'transformer2' }));
  const a = retoursDeValeur([msg('A', 'v')], E, DESC);
  const b = retoursDeValeur([msg('A', 'v')], E2, renomme);
  assert.deepEqual(ids(a), ids(b));
  assert.deepEqual(ops(b.retours[0].chemins[0]), ['transformer2', 'transformer2']);
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. VALEURS
test('C1. valeurs non scalaires : non comparables, listées, jamais égales ni différentes ; la descendance qui les traverse reste observée', () => {
  const E = [ex('R', 'eclater', [lien('x', 'A')], ['b', 'o']), ex('S', 'transformer', [lien('x', 'R')], 'v')];
  const r = retoursDeValeur([msg('A', 'v')], E, DESC);
  assert.deepEqual(ids(r), ['A>S'], 'le retour traverse une production non comparable');
  assert.deepEqual(r.retours[0].chemins[0].map((e) => e.operation), ['eclater', 'transformer']);
  assert.deepEqual(r.nonComparables.map((q) => q.identite), ['R']);
  assert.match(r.nonComparables[0].raison, /tableau/);
  const deux = retoursDeValeur([msg('A', 'v')], [ex('R', 'eclater', [lien('x', 'A')], ['v']), ex('R2', 'eclater', [lien('x', 'A')], ['v'])], DESC);
  assert.deepEqual(deux.retours, [], 'deux collections identiques ne sont pas comparées (aucune égalité profonde)');
  assert.deepEqual(deux.nonComparables.map((q) => q.identite), ['R', 'R2']);
});

test('C2. égalité typée de l\'existant : 7 et "7" sont deux valeurs, null et undefined aussi', () => {
  const E = [ex('P', 'transformer', [lien('x', 'A')], 7), ex('Q', 'transformer', [lien('x', 'A')], null)];
  assert.deepEqual(retoursDeValeur([msg('A', '7')], E, DESC).retours, []);
  assert.deepEqual(ids(retoursDeValeur([msg('A', 7)], E, DESC)), ['A>P']);
  assert.deepEqual(ids(retoursDeValeur([msg('A', null)], E, DESC)), ['A>Q']);
  assert.deepEqual(retoursDeValeur([msg('A', undefined)], E, DESC).retours, []);
});

test('C3. sous-donnée : issue des mêmes entrées que sa production porteuse, résolue par le mécanisme existant', () => {
  const desc = [...DESC, { nom: 'decouper', entrees: { x: { forme: 'scalaire', genre: 'chaine' } }, sortie: { forme: 'objet', champs: { tete: { forme: 'scalaire', genre: 'chaine' } } } }];
  const ligne = { ...ex('P', 'decouper', [lien('x', 'A')], { tete: 'v' }), sousDonnees: [{ id: 'P-tete', chemin: ['tete'] }] };
  const r = retoursDeValeur([msg('A', 'v')], [ligne, ex('Q', 'transformer', [lien('x', 'P-tete')], 'v')], desc);
  assert.deepEqual(ids(r), ['A>P-tete', 'A>Q', 'P-tete>Q']);
  assert.deepEqual(r.retours[1].chemins[0].map((e) => `${e.de}>${e.execution}>${e.vers}`), ['A>P>P-tete', 'P-tete>Q>Q']);
  assert.deepEqual(r.nonComparables.map((q) => q.identite), ['P'], 'la production entière (objet) n\'est pas comparable');
});

// ---------------------------------------------------------------------------------------------------------------------------------- D. ENTRÉES MAL FORMÉES
test('D1. entrées mal formées : TypeError, jamais de résultat partiel, jamais de réparation', () => {
  const ok = [ex('P', 'transformer', [lien('x', 'A')], 'v')];
  const M = [msg('A', 'v')];
  refuse(() => retoursDeValeur(null, ok, DESC));
  refuse(() => retoursDeValeur(M, 'x', DESC));
  refuse(() => retoursDeValeur(M, ok, {}));
  refuse(() => retoursDeValeur(M, [null], DESC));
  refuse(() => retoursDeValeur(M, [{ id: 'P' }], DESC));
  refuse(() => retoursDeValeur(M, [ex('P', 'transformer', [], 'v')], DESC), 'sans liaison');
  refuse(() => retoursDeValeur(M, [ex('P', 'transformer', [lien('x', 'INCONNU')], 'v')], DESC), 'donnée inconnue');
  refuse(() => retoursDeValeur(M, [ex('P', 'inconnue', [lien('x', 'A')], 'v')], DESC), 'opération non décrite');
  refuse(() => retoursDeValeur(M, ok.concat(ok), DESC), 'identité d\'exécution dupliquée');
  refuse(() => retoursDeValeur(M.concat(M), ok, DESC), 'message dupliqué');
  refuse(() => retoursDeValeur([...M, msg('P', 'v')], ok, DESC), 'collision message / exécution');
  refuse(() => retoursDeValeur(M, [ex('P', 'transformer', [lien('x', 'A'), lien('x', 'A')], 'v')], DESC), 'entrée dupliquée');
  const creux = [];
  creux.length = 1;
  refuse(() => retoursDeValeur(M, creux, DESC));
  const acc = [{ get id() { return 'P'; }, operation: 'transformer', liaisons: [lien('x', 'A')], resultat: 'v' }];
  refuse(() => retoursDeValeur(M, acc, DESC));
});

// ---------------------------------------------------------------------------------------------------------------------------------- E. TEMPORALITÉ ET CAS RÉEL
async function rejouer(scenario) {
  const magasin = magasinMemoireVive();
  let n = 0;
  const nouvelId = (p) => `${p}-${++n}`;
  const tours = [];
  const apres = [];
  for (const t of scenario) {
    const suivi = suivreObservationDuTour(
      (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }),
      (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }),
    );
    const res = await traiterTourAvecEnonce(t, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    tours.push(suivi.joindre(res).sollicitation);
    apres.push({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') });
  }
  return { tours, apres };
}

const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];

test('E1. cas réel : message-1 -> (1re opération) -> R -> (2e opération) -> S\' : un seul retour sur 7 tours, observable dès que S\' est persisté (après T2), jamais avant', async () => {
  const { tours, apres } = await rejouer(SCENARIO);
  const retours = apres.map((a) => retoursDeValeur(a.valeurs, a.executions, DESCRIPTIONS_OPERATIONS));
  assert.deepEqual(retours.map((r) => r.retours.length), [0, 1, 1, 1, 1, 1, 1], 'avant la persistance de S\' (fin de T1) : aucun retour ; ensuite le même retour, stable');
  const r = retours[6];
  const un = r.retours[0];
  assert.equal(un.ancetre, 'message-1');
  assert.equal(un.valeur, 'bonjour Pixel');
  assert.notEqual(un.descendant, un.ancetre);
  assert.equal(un.chemins.length, 1);
  assert.deepEqual(ops(un.chemins[0]), ['symbolesDeChaine', 'composerCollection']);
  const finale = apres[6].executions;
  const sprime = finale.find((e) => e.id === un.descendant);
  assert.equal(sprime.operation, 'composerCollection');
  assert.equal(sprime.resultat, 'bonjour Pixel');
  const R = finale.find((e) => e.id === un.chemins[0][0].vers);
  assert.equal(R.operation, 'symbolesDeChaine');
  assert.equal(un.chemins[0][0].de, 'message-1');
  assert.equal(un.chemins[0][1].de, R.id);
  assert.equal(un.chemins[0][1].vers, sprime.id);
  // La coïncidence message-3 (même texte, aucune descendance) n'est PAS un retour.
  assert.equal(r.retours.some((x) => x.ancetre === 'message-3' || x.descendant === 'message-3' || x.descendant === 'message-7'), false);
  // scénario vivant inchangé par l'existence de la vue
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(apres[6].executions.length, 19);
  assert.equal(tours.flatMap((s) => s.automatiques).filter((x) => x.statut !== 'executee').length, 0);
});

test('E2. temporalité : la vue ne voit que les lignes reçues ; retirer S\' retire le retour, rien n\'est lu dans le futur', async () => {
  const { apres } = await rejouer(SCENARIO.slice(0, 3));
  const lignes = apres[2].executions;
  const complet = retoursDeValeur(apres[2].valeurs, lignes, DESCRIPTIONS_OPERATIONS);
  assert.equal(complet.retours.length, 1);
  const sans = lignes.filter((l) => l.id !== complet.retours[0].descendant);
  const reduit = retoursDeValeur(apres[2].valeurs, sans, DESCRIPTIONS_OPERATIONS);
  assert.equal(reduit.retours.length, 0);
  assert.equal(apres[0].executions.length, 2);
  assert.equal(retoursDeValeur(apres[0].valeurs, apres[0].executions, DESCRIPTIONS_OPERATIONS).retours.length, 0);
});

// ---------------------------------------------------------------------------------------------------------------------------------- F. PURETÉ ET DORMANCE
test('F1. pureté : entrées gelées en profondeur acceptées, jamais modifiées, appels répétés identiques, sorties neuves', () => {
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const M = gel([msg('A', 'v')]);
  const E = gel([ex('B', 'transformer', [lien('x', 'A')], 'z'), ex('C', 'transformer', [lien('x', 'B')], 'v')]);
  const D = gel(structuredClone(DESC));
  const avant = JSON.stringify([M, E, D]);
  const a = retoursDeValeur(M, E, D);
  const b = retoursDeValeur(M, E, D);
  assert.deepEqual(a, b);
  assert.notEqual(a.retours[0], b.retours[0]);
  assert.notEqual(a.retours[0].chemins[0], b.retours[0].chemins[0]);
  assert.equal(JSON.stringify([M, E, D]), avant);
});

test('F2. garde statique : ni écriture, ni magasin, ni horloge, ni hasard, ni état global, ni asynchrone ; aucune opération ni interprétation nommée', () => {
  for (const motif of [/\bDate\b/, /Math\.random/, /performance\./, /\bawait\b/, /\basync\b/, /\bsetTimeout\b/, /\bPromise\b/, /\bprocess\b/, /\bglobalThis\b/, /\blocalStorage\b/, /\becrire\b|\benregistrer\b|\.ecrire|\.lireTout/]) {
    assert.equal(motif.test(CODE), false, String(motif));
  }
  assert.equal(/symbolesDeChaine|composerCollection|inverse|apprentissage|attente|préférence/i.test(CODE), false, 'aucun nom d\'opération ni d\'interprétation dans le code');
  assert.equal(/'(symboles|composer|transformer|assembler)[A-Za-z]*'/.test(CODE), false);
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./acces-valeur.js', './entrees-production.js', './resoudre-identites.js', './sous-donnees.js', './valeurs-observees.js']);
});

test('F3. DORMANCE : aucun fichier de app/ n\'importe retours-de-valeur.js ; les mécanismes interdits ne le connaissent pas', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    assert.equal(/retours-de-valeur|retoursDeValeur/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const nom of ['applications-sollicitables', 'execution-mecanique', 'pont', 'esprit', 'correspondances-experiences']) {
    assert.equal(/retours-de-valeur|retoursDeValeur/.test(readFileSync(join(RACINE, 'app', 'langage', `${nom}.js`), 'utf8')), false, nom);
  }
});
