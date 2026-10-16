// v0.64.4 — SOUS-PARCOURS STRUCTUREL MINIMAL (décision ChatGPT « DÉCISION v0.64.4 », 13/10/2026).
// restreindreParcours(P, C) : le minimum des sous-ensembles de P contenant les occurrences de C et reconstructibles. Preuve par force brute
// (intersection de toutes les sélections reconstructibles) sur de petits objets ; cas imposés ; invariances ; aller-retour ; objets réels ; gardes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { experiencesDAttentes, elementsDExperiences, regrouperExperiences } from '../app/langage/experiences-attentes.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee } from '../app/langage/connaissances.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';

// Monde réel ; avant chaque message, repos jusqu'au plafond (comme le protocole du téléphone).
function monde() {
  const magasin = magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${++n}`;
  async function tour(texte, idEmission = null) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); await consequenceReception(magasin, d.reception); await traiterOccasion(magasin, d.reception.id); }
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function repos() { for (let c = await lireCapacite(magasin); c.valeur < 3; c = await lireCapacite(magasin)) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  async function message(texte, idEmission = null) {
    await repos();
    const avant = (await magasin.lireTout('emissions')).length;
    await tour(texte, idEmission);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).slice(avant).filter((e) => ex.find((q) => q.id === e.idExecution).operation === 'symbolesDeChaine').at(-1);
  }
  async function experiences() {
    const v = await lireExecutionsVecues(magasin);
    return experiencesDAttentes(await magasin.lireTout('attentesProspectives'), await magasin.lireTout('contextesProspectifs'), v.valeurs, v.executions, v.descriptions);
  }
  return { magasin, message, experiences };
}
async function cas5577() {
  const w = monde();
  for (const [x, y] of [['K9', '77'], ['Q4', '55']]) { const E = await w.message(x); await w.message(y, E.id); }
  const E = await w.message('K9');
  return { w, E };
}


import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { restreindreParcours } from '../app/langage/restriction-parcours.js';
import { reconstruireStructure } from '../app/langage/reconstruction-structure.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { episodesDeTransformation, partieConnueEpisode } from '../app/langage/episodes-de-transformation.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (!motif || motif.test(e.message)));
const k = (c) => JSON.stringify(c);
const projection = (X, C) => reconstruireStructure(restreindreParcours(parcourirStructure(X), C));
const permuter = (t) => { const r = [...t].reverse(); return [...r.filter((_, i) => i % 2 === 1), ...r.filter((_, i) => i % 2 === 0)]; };
// Définition mathématique, par force brute : intersection de TOUTES les sélections reconstructibles de P contenant les occurrences de C.
function parDefinition(X, C) {
  const P = parcourirStructure(X); const n = P.length; const voulus = new Set(C.map(k));
  let inter = null;
  for (let m = 0; m < (1 << n); m += 1) {
    const S = P.filter((_, i) => m & (1 << i));
    const ks = new Set(S.map((o) => k(o.chemin)));
    if (![...voulus].every((v) => ks.has(v))) continue;
    try { reconstruireStructure(S); } catch { continue; }
    inter = inter === null ? m : inter & m;
  }
  return P.filter((_, i) => inter & (1 << i));
}
const X1 = { a: 1, b: 2, c: { d: 3, e: 4 } };
const XT = { t: ['A', 'B', 'C'] };
const XA = { a: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }] };

test('CAS IMPOSÉS : objets, tableaux, tableaux d’objets — exactement les projections du diagnostic', () => {
  assert.deepStrictEqual(projection(X1, [['a']]), { a: 1 });
  assert.deepStrictEqual(projection(X1, [['c', 'd']]), { c: { d: 3 } });
  assert.deepStrictEqual(projection(X1, [['a'], ['c', 'd']]), { a: 1, c: { d: 3 } });
  assert.deepStrictEqual(projection(X1, [['c']]), { c: {} }, 'demander un conteneur = demander son occurrence');
  assert.deepStrictEqual(projection(X1, [[]]), {});
  assert.deepStrictEqual(projection(XT, [['t', 0]]), { t: ['A'] });
  assert.deepStrictEqual(projection(XT, [['t', 1]]), { t: ['A', 'B'] });
  assert.deepStrictEqual(projection(XT, [['t', 2]]), { t: ['A', 'B', 'C'] });
  assert.deepStrictEqual(projection(XT, [['t', 0], ['t', 2]]), { t: ['A', 'B', 'C'] });
  assert.deepStrictEqual(projection(XT, [['t']]), { t: [] });
  assert.deepStrictEqual(projection(XA, [['a', 2, 'x']]), { a: [{}, {}, { x: 5 }] });
  assert.deepStrictEqual(projection(XA, [['a', 1, 'y']]), { a: [{}, { y: 4 }] });
  assert.deepStrictEqual(projection(XA, [['a', 0, 'x'], ['a', 2, 'y']]), { a: [{ x: 1 }, {}, { y: 6 }] });
  assert.deepStrictEqual(projection(XA, [['a', 2]]), { a: [{}, {}, {}] }, 'aucun contenu des objets prédécesseurs');
  assert.deepStrictEqual(projection({ m: [[1, 2], [3, [4, 5]]] }, [['m', 1, 1, 1]]), { m: [[], [3, [4, 5]]] }, 'prédécesseur conteneur sans descendants, prédécesseurs scalaires avec leur valeur');
  assert.deepStrictEqual(projection({ c: { d: 3 } }, []), {}, 'C vide : la racine seule');
  assert.equal(projection(5, [[]]), 5);
});

test('ÉQUIVALENCE À LA DÉFINITION : égale à l’intersection de toutes les sélections reconstructibles contenant C (force brute), sur objets, tableaux, imbrications', () => {
  const cas = [[X1, [['a']]], [X1, [['c', 'd']]], [X1, [['a'], ['c', 'd']]], [X1, [['c']]], [X1, [[]]], [X1, []],
    [XT, [['t', 0]]], [XT, [['t', 1]]], [XT, [['t', 2]]], [XT, [['t', 0], ['t', 2]]], [XT, [['t']]],
    [XA, [['a', 2, 'x']]], [XA, [['a', 1, 'y']]], [XA, [['a', 0, 'x'], ['a', 2, 'y']]], [XA, [['a', 2]]],
    [{ m: [[1, 2], [3, [4, 5]]] }, [['m', 1, 1, 1]]], [[{ p: [null, true] }, []], [[0, 'p', 1], [1]]], ['s', [[]]], [{}, [[]]], [[], [[]]]];
  for (const [X, C] of cas) {
    const S = restreindreParcours(parcourirStructure(X), C);
    assert.deepStrictEqual(new Set(S.map((o) => k(o))), new Set(parDefinition(X, C).map((o) => k(o))), k([X, C]));
  }
});

test('INVARIANCES : permutation complète de P, permutation de C, répétitions dans C, entrées gelées — même sortie, ordre technique du parcours', () => {
  const P = parcourirStructure(XA);
  const C = [['a', 0, 'x'], ['a', 2, 'y']];
  const ref = restreindreParcours(P, C);
  for (const [p, c] of [[permuter(P), C], [P, [...C].reverse()], [permuter(P), [C[1], C[0], C[1], C[0]]], [[...P].reverse(), [...C, ...C]]]) assert.deepStrictEqual(restreindreParcours(p, c), ref);
  assert.deepStrictEqual(ref, parcourirStructure(reconstruireStructure(ref)), 'ordre = celui du parcours de la projection');
  const gele = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gele); Object.freeze(o); } return o; };
  const Pg = gele(structuredClone(P)); const Cg = gele(structuredClone(C));
  assert.deepStrictEqual(restreindreParcours(Pg, Cg), ref);
  assert.ok(ref.every((o) => !P.includes(o)), 'occurrences neuves');
});

test('ALLER-RETOUR : reconstruireStructure(S) réussit et parcourirStructure(reconstruireStructure(S)) = S — scalaires, objets, tableaux, vides, profondeur ; toutes les demandes d’un chemin', () => {
  let profond = { feuille: 'fond' }; for (let i = 0; i < 40; i += 1) profond = i % 2 ? { [`n${i}`]: profond } : [i, profond];
  for (const X of [null, 'x', 0, true, {}, [], { a: [] }, [[], {}], X1, XT, XA, profond]) {
    const P = parcourirStructure(X);
    for (const o of P) {
      const S = restreindreParcours(P, [o.chemin]);
      assert.deepStrictEqual(parcourirStructure(reconstruireStructure(S)), S);
      assert.ok(S.every((s) => P.some((q) => k(q) === k(s))), 'S ⊆ P : aucune occurrence, valeur ni type inventé');
      assert.ok(S.some((s) => k(s.chemin) === k(o.chemin)));
    }
    assert.deepStrictEqual(restreindreParcours(P, P.map((o) => o.chemin)), P, 'tous les chemins : P lui-même');
  }
});

test('REFUS : chemin absent du parcours, chemin mal formé, parcours hors domaine (incomplet, doublon), entrées non tableaux', () => {
  const P = parcourirStructure(X1);
  refuse(() => restreindreParcours(P, [['z']]), /aucune occurrence/);
  refuse(() => restreindreParcours(P, [['c', 'd', 'e']]), /aucune occurrence/);
  refuse(() => restreindreParcours(parcourirStructure(XT), [['t', '0']]), /aucune occurrence/, 'la clé "0" n’est pas l’indice 0');
  for (const c of ['a', [1.5], [-1], [null], [[]]]) refuse(() => restreindreParcours(P, [c]));
  refuse(() => restreindreParcours(P.slice(1), [['a']]), /racine/);
  refuse(() => restreindreParcours([...P, P[1]], [['a']]), /deux fois/);
  refuse(() => restreindreParcours('x', [])); refuse(() => restreindreParcours(P, 'x')); refuse(() => restreindreParcours(P, [, ['a']])); // eslint-disable-line no-sparse-arrays
});

test('OBJETS RÉELS (sans adaptation) : épisode, partie connue, contexte prospectif, application, attente, expérience — chaque chemin présent donne une projection reconstructible et incluse', async () => {
  const { w, E } = await cas5577();
  await w.message('77', E.id);
  const v = await lireExecutionsVecues(w.magasin);
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  const c = contextes.find((x) => x.chemins.length > 0 && x.parent !== null);
  const objets = [episodesDeTransformation(v.valeurs, v.executions, v.descriptions).episodes.find((e) => e.valeurs && e.valeurs.arrivee !== undefined), partieConnueEpisode(c.episodePartiel, v.valeurs, v.executions, v.descriptions), c, c.application,
    (await w.magasin.lireTout('attentesProspectives')).find((a) => a.preuve.fondation), (await w.experiences()).experiences.find((x) => x.avant.preuve.fondation)]; // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  for (const X of objets) {
    const P = parcourirStructure(X);
    for (const o of P) {
      const S = restreindreParcours(P, [o.chemin]);
      assert.deepStrictEqual(parcourirStructure(reconstruireStructure(S)), S);
      assert.ok(S.length <= P.length);
    }
  }
});

test('GARDES : pure ; aucun nom de champ de Naissance ; importée en production par attentes-conditionnees.js SEULEMENT (MISE À JOUR DÉLIBÉRÉE v0.64.5)', () => {
  const SRC = readFileSync(join(RACINE, 'app', 'langage', 'restriction-parcours.js'), 'utf8');
  const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.deepEqual([...CODE.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort(), ['./parcours-structure.js', './reconstruction-structure.js']);
  assert.equal(/Date|Math\.random|globalThis|WeakMap|\bawait\b|lireTout|ecrire/.test(CODE), false);
  assert.deepEqual(CODE.split('\n').filter((l) => /^(let|var) /.test(l)), []);
  assert.equal(/valeurs|depart|arrivee|fondation|couverture|conditions|episode|attente/i.test(CODE), false);
  const fichiers = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiers(p) : p.endsWith('.js') ? [p] : []; });
  for (const f of fichiers(join(RACINE, 'app'))) if (!f.endsWith('restriction-parcours.js') && !f.endsWith('attentes-conditionnees.js') && !f.endsWith('/retrouvailles.js') && !f.endsWith('/issue-retrouvaille.js') /* MISE À JOUR DÉLIBÉRÉE v0.64.33 (confronter une relation retrouvée à ce qui est arrivé) : issue-retrouvaille.js, vue pure lue SEULEMENT par le pont Diagnostic de main.js, réutilise exactement les primitives exigées par la mission (issuesDuContexteProspectifSurVue, episodesDeTransformation, parcourirStructure, restreindreParcours, reconstruireStructure, memesCouvertures, memesRelations) ; aucune seconde notion d'égalité, aucune écriture ; gardée par tests/issue-retrouvaille.test.mjs */ /* MISE À JOUR DÉLIBÉRÉE v0.64.31 (RETROUVAILLE-1) : retrouvailles.js, calcul pur appelé par les quatre producteurs AVANT l'écriture des contextes, réutilise exactement les primitives exigées par la mission (partieConnueEpisode, cheminsOuverts, parcourirStructure, restreindreParcours, reconstruireStructure, memesCouvertures, memesRelations, rolesDeLAttente) ; aucune seconde notion d'égalité ; gardé par tests/retrouvailles.test.mjs */ /* MISE À JOUR DÉLIBÉRÉE v0.64.5 (relation fondatrice structurée) : attentes-conditionnees.js calcule la relation à K0 avec les primitives structurelles (premier branchement réel) ; seul importeur de production */) assert.equal(/restriction-parcours|restreindreParcours/.test(readFileSync(f, 'utf8')), false, f);
});
