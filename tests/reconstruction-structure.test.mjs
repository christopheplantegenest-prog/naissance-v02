// v0.64.3 — INVERSE GÉNÉRAL DU PARCOURS STRUCTUREL (décision ChatGPT « DÉCISION v0.64.3 », 13/10/2026).
// reconstruireStructure : l'unique valeur dont les occurrences reçues sont exactement les occurrences du parcours ; refus sinon.
// Aller-retour sur tous les types, refus du point 4, invariance à l'ordre, objets réels du dépôt, constats de classe (refus), gardes.
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
import { reconstruireStructure } from '../app/langage/reconstruction-structure.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { episodesDeTransformation, partieConnueEpisode } from '../app/langage/episodes-de-transformation.js';
import { coCouverturesParChemins } from '../app/langage/co-couvertures.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (!motif || motif.test(e.message)));
// Aller-retour exact dans les deux sens : valeur ≡ valeur (égalité stricte profonde) ET occurrences ≡ occurrences (mêmes, même ordre de parcours).
function allerRetour(x) {
  const occ = parcourirStructure(x);
  const y = reconstruireStructure(occ);
  assert.deepStrictEqual(y, x);
  assert.deepStrictEqual(parcourirStructure(y), occ);
  return y;
}
// Permutation totale déterministe (renversement + entrelacement) : aucune dépendance au hasard.
const permuter = (t) => { const r = [...t].reverse(); return [...r.filter((_, i) => i % 2 === 1), ...r.filter((_, i) => i % 2 === 0)]; };

test('A–G. ALLER-RETOUR sur les six types : scalaires, nul, objet simple, tableau simple, objet ⊃ tableau, tableau ⊃ objets, profond, vides', () => {
  for (const x of ['', 'K9', 0, -0, 42, 1.5, -7, true, false, null]) { const y = allerRetour(x); assert.ok(Object.is(y, x)); }
  allerRetour({ a: 1, b: 'x', c: null, d: false });
  allerRetour([1, 'deux', null, true]);
  allerRetour({ t: [1, 2, [3, [4]]], o: {} });
  allerRetour([{ a: 1 }, { b: [{}] }, [], {}]);
  let profond = { feuille: 'fond' }; for (let i = 0; i < 60; i += 1) profond = i % 2 ? { [`n${i}`]: profond } : [profond, i];
  allerRetour(profond);
  allerRetour({}); allerRetour([]); allerRetour([[]]); allerRetour({ v: {} });
  // clés qui ne se confondent pas : "0" ≠ 0, "" ≠ racine, "a/b" ≠ ["a","b"], "__proto__" reste une propriété propre
  const cles = JSON.parse('{"0":["0"],"":{"":""},"a/b":1,"__proto__":{"x":1}}');
  const y = reconstruireStructure(parcourirStructure(cles));
  assert.deepStrictEqual(parcourirStructure(y), parcourirStructure(cles));
  assert.equal(Object.getPrototypeOf(y), Object.prototype); assert.ok(Object.hasOwn(y, '__proto__'));
  // prototype null et sous-structure partagée : reviennent comme copies structurellement égales (le parcours ne les distingue pas)
  const sansProto = Object.assign(Object.create(null), { a: 1 }); const partage = { p: 1 };
  assert.deepStrictEqual(parcourirStructure(reconstruireStructure(parcourirStructure({ s: sansProto, u: partage, v: partage }))), parcourirStructure({ s: { a: 1 }, u: { p: 1 }, v: { p: 1 } }));
});

test('H. VALEURS RÉELLEMENT UTILISÉES PAR NAISSANCE : épisode, partie connue, application, contexte prospectif, attente, expérience d’attente — aller-retour exact, sans adaptation', async () => {
  const { w, E } = await cas5577();
  await w.message('77', E.id);
  const v = await lireExecutionsVecues(w.magasin);
  const { episodes } = episodesDeTransformation(v.valeurs, v.executions, v.descriptions);
  assert.ok(episodes.length > 10);
  for (const e of episodes) allerRetour(e);
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  for (const c of contextes) { allerRetour(c); allerRetour(c.application); allerRetour(partieConnueEpisode(c.episodePartiel, v.valeurs, v.executions, v.descriptions)); }
  for (const a of await w.magasin.lireTout('attentesProspectives')) allerRetour(a);
  const { experiences } = await w.experiences();
  assert.ok(experiences.some((x) => x.avant.fondation));
  for (const x of experiences) allerRetour(x);
  for (const d of await w.magasin.lireTout('designations')) allerRetour(d);
});

test('I. ORDRE : toute permutation des occurrences rend la même valeur (même ordre de clés) ; l’ordre d’un tableau est celui de ses indices', () => {
  const x = { z: [3, 1, 2], a: { m: [{ k: 'v' }, null], b: true }, '': 0 };
  const occ = parcourirStructure(x);
  for (const p of [permuter(occ), [...occ].reverse(), [occ[occ.length - 1], ...occ.slice(0, -1)]]) {
    const y = reconstruireStructure(p);
    assert.deepStrictEqual(y, x);
    assert.equal(JSON.stringify(y), JSON.stringify(reconstruireStructure(occ)), 'même ordre d’insertion des clés');
  }
  assert.deepStrictEqual(reconstruireStructure(permuter(parcourirStructure([3, 1, 2]))), [3, 1, 2], 'les indices portent l’ordre du tableau');
});

test('J. REFUS (TypeError, aucune réparation) : racine absente ou double, doublon strict, valeurs ou types contradictoires, feuille avec descendants, segment incompatible avec le conteneur, parent absent, indices non contigus, chemin ou occurrence invalides', () => {
  const R = { chemin: [], type: 'objet' };
  const n = (chemin, type, valeur) => (valeur === undefined ? { chemin, type } : { chemin, type, valeur });
  refuse(() => reconstruireStructure([]), /racine/);
  refuse(() => reconstruireStructure([n(['a'], 'nombre', 1)]), /racine|parente/);
  refuse(() => reconstruireStructure([R, R]), /deux fois/);
  refuse(() => reconstruireStructure([R, n(['a'], 'nombre', 1), n(['a'], 'nombre', 1)]), /deux fois/, 'doublon strict : le parcours ne répète jamais un nœud');
  refuse(() => reconstruireStructure([R, n(['a'], 'nombre', 1), n(['a'], 'nombre', 2)]), /deux fois/, 'deux valeurs au même chemin');
  refuse(() => reconstruireStructure([R, n(['a'], 'nombre', 1), n(['a'], 'chaine', '1')]), /deux fois/, 'types incompatibles au même chemin');
  refuse(() => reconstruireStructure([R, n(['a'], 'chaine', 'x'), n(['a', 'b'], 'nul')]), /feuille/);
  refuse(() => reconstruireStructure([R, n(['a'], 'nul'), n(['a', 0], 'nul')]), /feuille/);
  refuse(() => reconstruireStructure([R, n([0], 'nul')]), /objet n'a que des clés/, 'conteneur annoncé objet, structure exigeant un tableau');
  refuse(() => reconstruireStructure([n([], 'tableau'), n(['0'], 'nul')]), /tableau n'a que des indices/, 'conteneur annoncé tableau, segment clé');
  refuse(() => reconstruireStructure([R, n(['a', 'b'], 'nombre', 1)]), /parente/, 'enfant sans information sur son parent');
  refuse(() => reconstruireStructure([n([], 'tableau'), n([1], 'nul')]), /contigus/);
  refuse(() => reconstruireStructure([n([], 'tableau'), n([0], 'nul'), n([2], 'nul')]), /contigus/);
  for (const chemin of ['a', [1.5], [-1], [-0], [null], [Symbol.iterator], [[]], [true]]) refuse(() => reconstruireStructure([R, { chemin, type: 'nul' }]));
  refuse(() => reconstruireStructure([{ chemin: [], type: 'nombre', valeur: '1' }]));
  refuse(() => reconstruireStructure([{ chemin: [], type: 'nombre', valeur: Infinity }]));
  refuse(() => reconstruireStructure([{ chemin: [], type: 'chaine' }]));
  refuse(() => reconstruireStructure([{ chemin: [], type: 'objet', valeur: {} }]));
  refuse(() => reconstruireStructure([{ chemin: [], type: 'nul', valeur: null }]));
  refuse(() => reconstruireStructure([{ chemin: [], type: 'inconnu' }]));
  refuse(() => reconstruireStructure([{ chemin: [], type: 'nul', couverture: [] }]), /étrangère/);
  refuse(() => reconstruireStructure([Object.defineProperty({ type: 'nul' }, 'chemin', { get: () => [], enumerable: true })]));
  refuse(() => reconstruireStructure('x')); refuse(() => reconstruireStructure([null])); refuse(() => reconstruireStructure([, R])); // eslint-disable-line no-sparse-arrays
  const entree = Object.freeze([Object.freeze({ chemin: Object.freeze([]), type: 'objet' })]);
  assert.deepStrictEqual(reconstruireStructure(entree), {}, 'entrée gelée acceptée, jamais modifiée');
});

test('CONSTATS DE CLASSE (.95) : sans occurrences de conteneurs ni racine, la reconstruction générique est REFUSÉE — même sans segment numérique (une complétion ajouterait des occurrences absentes de l’entrée)', async () => {
  const { w, E } = await cas5577();
  const v = await lireExecutionsVecues(w.magasin);
  const famille = famillesDEpisodes(episodesDeTransformation(v.valeurs, v.executions, v.descriptions)).familles.find((f) => f.structure.length === 2 && f.structure[1].operation === 'environnement:conversation' && f.structure[0].operation === 'symbolesDeChaine');
  const { classes } = coCouverturesParChemins(famille.episodes);
  assert.ok(classes.length > 0);
  for (const c of classes) {
    assert.ok(c.constats.every((k) => k.chemin.every((s) => typeof s === 'string')), 'cas simple : aucun segment numérique');
    refuse(() => reconstruireStructure(c.constats.map((k) => ({ chemin: k.chemin, type: k.type, valeur: k.valeur }))), /racine/);
    refuse(() => reconstruireStructure([{ chemin: [], type: 'objet' }, ...c.constats.map((k) => ({ chemin: k.chemin, type: k.type, valeur: k.valeur }))]), /parente/);
  }
  assert.ok(E);
});

test('GARDES : pure, sans import, sans état ; aucun nom de champ de Naissance ; NON BRANCHÉE (aucun fichier de production ne l’importe)', () => {
  const SRC = readFileSync(join(RACINE, 'app', 'langage', 'reconstruction-structure.js'), 'utf8');
  const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/^\s*import\b/m.test(CODE), false);
  assert.equal(/Date|Math\.random|globalThis|WeakMap|\bawait\b|lireTout|ecrire/.test(CODE), false);
  assert.deepEqual(CODE.split('\n').filter((l) => /^(let|var) /.test(l)), []);
  assert.equal(/valeurs|depart|arrivee|fondation|couverture|conditions|episode|attente/i.test(CODE), false);
  const fichiers = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiers(p) : p.endsWith('.js') ? [p] : []; });
  for (const f of fichiers(join(RACINE, 'app'))) if (!f.endsWith('reconstruction-structure.js')) assert.equal(/reconstruction-structure|reconstruireStructure/.test(readFileSync(f, 'utf8')), false, f);
});
