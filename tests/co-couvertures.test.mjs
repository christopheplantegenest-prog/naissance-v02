// v0.63.95 — coCouverturesParChemins : relation de co-couverture entre positions (décision ChatGPT « DÉCISION MINI-DESIGN CO-COUVERTURES », 12/10/2026).
// Preuves : contrat, famille réelle d'échanges (exactement deux classes), familles B1/B2 réelles, cas limites A–F, non-sémantique, 7 ≠ "7", permutation,
// deux réceptions d'une même émission, universels exclus, même chemin jamais relié, famille non comparable, pureté des entrées, singleton ≠ confiance,
// aucune sémantique d'ordre, R3 structurel (identités sans préfixe particulier), redémarrage, extraction strictement équivalente d'identiteEpisode, dormance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/co-couvertures.js';
import { coCouverturesParChemins } from '../app/langage/co-couvertures.js';
import * as moduleIdentite from '../app/langage/identite-episode.js';
import { identiteEpisode } from '../app/langage/identite-episode.js';
import { memesCouvertures } from '../app/langage/couverture-occurrences.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES } from '../app/langage/connaissances.js';
import { lireCapacite, peutAgir, tourActif } from '../app/langage/capacite.js';
import { emettreLot, declarerReceptionConversation } from '../app/langage/environnement-conversation.js';
import { consequenceReception } from '../app/langage/relation.js';
import { traiterOccasion } from '../app/langage/episode-propre.js';
import { tickPropre } from '../app/langage/tick-propre.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'co-couvertures.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError);

// Épisodes synthétiques de la forme réelle « message → symbolesDeChaine → environnement:conversation → réception ».
function fabrique(prefixe = 'message-', exec = 'exec-', rec = 'reception-') {
  let n = 0;
  return (depart, arrivee, ids = {}) => {
    n += 1;
    const d = ids.depart ?? `${prefixe}${n}`; const x = ids.vers ?? `${exec}${n}`; const r = ids.arrivee ?? `${rec}${n}`;
    const comparable = arrivee !== undefined;
    return {
      depart: d, arrivee: r,
      chemin: [{ de: d, execution: x, operation: 'symbolesDeChaine', entrees: ['chaine'], vers: x }, { de: x, execution: r, operation: 'environnement:conversation', entrees: ['emis'], vers: r }],
      relationValeur: comparable ? (JSON.stringify(depart) === JSON.stringify(arrivee) ? 'egale' : 'differente') : 'non_comparable',
      ...(comparable ? { valeurs: { depart, arrivee } } : {}),
    };
  };
}
const lot = (paires, ...f) => { const ep = fabrique(...f); return paires.map(([d, a]) => ep(d, a)); };
// Lecture SUBSTANTIELLE (ensemble) : chaque classe = couverture + ENSEMBLE de constats ; l'ensemble des classes est trié ici, pour comparer, jamais pour signifier.
const substance = (r) => r.classes.map((c) => JSON.stringify({ couverture: c.couverture, constats: c.constats.map((k) => JSON.stringify(k)).sort() })).sort();
const lisible = (r) => r.classes.map((c) => ({ temoins: c.couverture.map((t) => t[0]), relation: c.constats.map((k) => `${k.chemin.join('.')}=${JSON.stringify(k.valeur)}`).sort() }));

// ------------------------------------------------------------------------------------------------------------------------------- harnais réel
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
    let reception = null;
    if (idEmission) { const d = await declarerReceptionConversation({ idDonnee: s.observation.idMessage, idEmission }, { magasin }); reception = d.reception; await consequenceReception(magasin, reception); }
    for (const ev of [s.observation.id, reception ? reception.id : null].filter(Boolean)) await traiterOccasion(magasin, ev);
    return s;
  }
  async function tick() { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); }
  async function echange(x, y) {
    const s = await tour(x);
    const ex = await magasin.lireTout('executionsOperations');
    const e = (await magasin.lireTout('emissions')).filter((m) => m.idObservation === s.observation.id).find((m) => ex.find((q) => q.id === m.idExecution).operation === 'symbolesDeChaine');
    const s2 = await tour(y, e.id);
    const r = (await magasin.lireTout('receptions')).find((q) => q.idEmission === e.id);
    return { M1: s.observation.idMessage, P: e.idExecution, E: e.id, R: r.id, M2: s2.observation.idMessage };
  }
  return { magasin, tick, echange };
}
const vue = (f) => f.structure.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
async function famillesDuMagasin(magasin) {
  const vecu = await lireExecutionsVecues(magasin);
  return famillesDEpisodes(episodesDeTransformation(vecu.valeurs, vecu.executions, vecu.descriptions)).familles;
}
let REEL = null;
async function reel() {
  if (REEL) return REEL;
  const w = monde(); const echanges = [];
  for (const [x, y] of [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui'], ['bonjour', 'merci']]) { if (echanges.length) { await w.tick(); await w.tick(); } echanges.push(await w.echange(x, y)); }
  REEL = { w, echanges, familles: await famillesDuMagasin(w.magasin) };
  return REEL;
}

// ------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. export unique, fonction synchrone à un paramètre ; [] -> { universelle: [], classes: [] }', () => {
  assert.deepEqual(Object.keys(module), ['coCouverturesParChemins']);
  assert.equal(coCouverturesParChemins.length, 1);
  assert.deepEqual(coCouverturesParChemins([]), { universelle: [], classes: [] });
});

test('A2. entrées mal formées : TypeError, aucun résultat partiel ; identité dupliquée refusée (producteur)', () => {
  for (const x of [undefined, null, 'x', {}, 3]) refuse(() => coCouverturesParChemins(x));
  refuse(() => coCouverturesParChemins([null]));
  refuse(() => coCouverturesParChemins([[]]));
  refuse(() => coCouverturesParChemins([{ depart: 'a', arrivee: 'b' }]));
  const e = lot([['x', 'y']])[0];
  refuse(() => coCouverturesParChemins([e, structuredClone(e)]));
});

// ------------------------------------------------------------------------------------------------------------------------------- B. RÉEL
test('T1. famille réelle bonjour→merci, salut→oui, salut→oui, bonjour→merci : EXACTEMENT les deux classes attendues, couvertures = épisodes réels', async () => {
  const { echanges, familles } = await reel();
  const [A, B, B2, D] = echanges;
  const f = familles.find((x) => vue(x) === 'symbolesDeChaine(chaine)>environnement:conversation(emis)');
  assert.equal(f.episodes.length, 4);
  const r = coCouverturesParChemins(f.episodes);
  assert.equal(r.universelle.length, 4);
  const id = (X) => [X.M1, X.R, X.P, X.R];
  assert.deepEqual(new Set(substance(r)), new Set(substance({ classes: [
    { couverture: [id(A), id(D)].sort((a, b) => (a[0] < b[0] ? -1 : 1)), constats: [{ chemin: ['valeurs', 'arrivee'], type: 'chaine', valeur: 'merci' }, { chemin: ['valeurs', 'depart'], type: 'chaine', valeur: 'bonjour' }] },
    { couverture: [id(B), id(B2)].sort((a, b) => (a[0] < b[0] ? -1 : 1)), constats: [{ chemin: ['valeurs', 'arrivee'], type: 'chaine', valeur: 'oui' }, { chemin: ['valeurs', 'depart'], type: 'chaine', valeur: 'salut' }] },
  ] })));
  assert.equal(r.classes.length, 2);
  for (const c of r.classes) for (const k of c.constats) assert.equal(k.chemin[0], 'valeurs', 'aucune identité, aucun nom d’opération, aucune relationValeur constante');
});

test('T1b. familles B1/B2 réelles : les classes retrouvent la dynamique des états propres, sans connaître les besoins', async () => {
  const { familles } = await reel();
  const toutes = {};
  for (const f of familles) { const r = coCouverturesParChemins(f.episodes); if (r.classes.length) toutes[vue(f)] = lisible(r).map((c) => c.relation.join(' ↔ ')).sort(); }
  assert.deepEqual(toutes['soi:tour(etat)'], ['valeurs.arrivee=0 ↔ valeurs.depart=1', 'valeurs.arrivee=1 ↔ valeurs.depart=2', 'valeurs.arrivee=2 ↔ valeurs.depart=3']);
  assert.deepEqual(toutes['soi:temps(etat)'], ['valeurs.arrivee=1 ↔ valeurs.depart=0', 'valeurs.arrivee=2 ↔ valeurs.depart=1']);
  assert.ok(toutes['soi:repos(etat)'].includes('valeurs.arrivee=2 ↔ valeurs.depart=1'));
  for (const [cle, l] of Object.entries(toutes)) for (const rel of l) assert.equal(/execution-operation|reception-|message-|variation-|observation-|designation-/.test(rel), false, `${cle} : ${rel}`);
  assert.equal(Object.keys(toutes).length >= 4, true);
});

test('T20. redémarrage : mêmes faits persistés relus (JSON, ordre des lignes inversé) → mêmes classes substantielles', async () => {
  const { w, familles } = await reel();
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t))).reverse();
  const neuf = magasinMemoireVive(); await neuf.remplacerTout(donnees);
  const apres = await famillesDuMagasin(neuf);
  const resume = (fs) => fs.map((f) => vue(f) + JSON.stringify(substance(coCouverturesParChemins(f.episodes)))).sort();
  assert.deepEqual(resume(apres), resume(familles));
});

// ------------------------------------------------------------------------------------------------------------------------------- C. CAS LIMITES
test('T2. A : bonjour→merci, bonjour→oui → aucune classe (bonjour universel, merci/oui sans partenaire)', () => {
  assert.deepEqual(coCouverturesParChemins(lot([['bonjour', 'merci'], ['bonjour', 'oui']])).classes, []);
});

test('T3. B : bonjour→merci, salut→merci → aucune classe (égalité exacte seulement : merci = union, jamais inclusion)', () => {
  assert.deepEqual(coCouverturesParChemins(lot([['bonjour', 'merci'], ['salut', 'merci']])).classes, []);
});

test('T4. C : bonjour→merci ×2, salut→oui → deux classes, dont une couverture singleton conservée', () => {
  const r = coCouverturesParChemins(lot([['bonjour', 'merci'], ['bonjour', 'merci'], ['salut', 'oui']]));
  assert.deepEqual(lisible(r).map((c) => [c.temoins, c.relation]).sort(), [
    [['message-1', 'message-2'], ['valeurs.arrivee="merci"', 'valeurs.depart="bonjour"']],
    [['message-3'], ['valeurs.arrivee="oui"', 'valeurs.depart="salut"']],
  ]);
});

test('T5. D : un seul épisode → aucune classe (tout est universel)', () => {
  const r = coCouverturesParChemins(lot([['bonjour', 'merci']]));
  assert.equal(r.universelle.length, 1);
  assert.deepEqual(r.classes, []);
});

test('T6. E : valeur absente à un chemin = trou de couverture, jamais une valeur ; relationValeur, qui varie ici, est un constat ordinaire', () => {
  const r = coCouverturesParChemins(lot([['bonjour', 'merci'], ['salut', undefined]]));
  assert.deepEqual(lisible(r), [{ temoins: ['message-1'], relation: ['relationValeur="differente"', 'valeurs.arrivee="merci"', 'valeurs.depart="bonjour"'] }]);
  assert.equal(JSON.stringify(r.classes).includes('non_comparable'), false, 'l’autre épisode n’a aucun partenaire : pas de classe');
});

test('T7. F : collections/objets → seules les feuilles scalaires entrent ; relation possible à l’intérieur d’une même extrémité', () => {
  const r = coCouverturesParChemins(lot([[['b', 'o'], { x: 1 }], [['s'], { x: 2 }], [['b', 'o'], { x: 1 }]]));
  assert.deepEqual(lisible(r).map((c) => [c.temoins, c.relation]).sort(), [
    [['message-1', 'message-3'], ['valeurs.arrivee.x=1', 'valeurs.depart.0="b"', 'valeurs.depart.1="o"']],
    [['message-2'], ['valeurs.arrivee.x=2', 'valeurs.depart.0="s"']],
  ]);
  for (const c of r.classes) for (const k of c.constats) assert.equal(['chaine', 'nombre', 'booleen'].includes(k.type), true, 'R0 : aucun conteneur');
});

test('T8. non-sémantique : "A17"↔42 a exactement la même forme que "bonjour"↔"merci"', () => {
  const a = coCouverturesParChemins(lot([['bonjour', 'merci'], ['z', 'w'], ['bonjour', 'merci']]));
  const b = coCouverturesParChemins(lot([['A17', 42], ['z', 'w'], ['A17', 42]]));
  const forme = (r) => r.classes.map((c) => ({ couverture: c.couverture, chemins: c.constats.map((k) => k.chemin), cles: c.constats.map((k) => Object.keys(k)) }));
  assert.deepEqual(forme(b), forme(a));
  assert.deepEqual(lisible(b).map((c) => c.relation)[0], ['valeurs.arrivee=42', 'valeurs.depart="A17"']);
});

test('T9. 7 ≠ "7" : deux constats distincts, deux classes distinctes', () => {
  const r = coCouverturesParChemins(lot([[7, 'x'], ['7', 'y']]));
  assert.deepEqual(lisible(r).map((c) => c.relation).sort(), [['valeurs.arrivee="x"', 'valeurs.depart=7'], ['valeurs.arrivee="y"', 'valeurs.depart="7"']]);
});

test('T10 / T18. permutation des épisodes et des constats sources : même ensemble substantiel ; l’ordre ne porte rien', () => {
  const base = lot([['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui'], ['bonjour', 'merci'], ['z', 9]]);
  const ref = substance(coCouverturesParChemins(base));
  const perms = [[...base].reverse(), [base[2], base[0], base[4], base[1], base[3]], [base[4], base[3], base[2], base[1], base[0]]];
  for (const p of perms) assert.deepEqual(substance(coCouverturesParChemins(p)), ref);
  // constats sources permutés : même épisode, propriétés écrites dans un autre ordre
  const reordonne = base.map((e) => ({ relationValeur: e.relationValeur, valeurs: { arrivee: e.valeurs.arrivee, depart: e.valeurs.depart }, chemin: e.chemin, arrivee: e.arrivee, depart: e.depart }));
  assert.deepEqual(substance(coCouverturesParChemins(reordonne)), ref);
});

test('T11. deux réceptions d’une même émission : départ et production communs (identités) exclus par R3 ; la relation de valeurs reste', () => {
  const ep = fabrique();
  const e1 = ep('salut', 'oui', { depart: 'message-1', vers: 'exec-1', arrivee: 'reception-1' });
  const e2 = ep('salut', 'oui', { depart: 'message-1', vers: 'exec-1', arrivee: 'reception-2' });
  const e3 = ep('bonjour', 'merci', { depart: 'message-9', vers: 'exec-9', arrivee: 'reception-9' });
  const r = coCouverturesParChemins([e1, e2, e3]);
  assert.deepEqual(lisible(r).map((c) => [c.temoins, c.relation]).sort(), [
    [['message-1', 'message-1'], ['valeurs.arrivee="oui"', 'valeurs.depart="salut"']],
    [['message-9'], ['valeurs.arrivee="merci"', 'valeurs.depart="bonjour"']],
  ]);
});

test('T12. constats universels jamais en classe (opérations, entrées, relationValeur constante) — synthétique et réel', async () => {
  const r = coCouverturesParChemins(lot([['a', 'b'], ['c', 'd']]));
  for (const c of r.classes) { assert.equal(memesCouvertures(c.couverture, r.universelle), false); for (const k of c.constats) assert.equal(['symbolesDeChaine', 'environnement:conversation', 'chaine', 'emis', 'differente'].includes(k.valeur), false); }
  const { familles } = await reel();
  for (const f of familles) { const s = coCouverturesParChemins(f.episodes); for (const c of s.classes) assert.equal(memesCouvertures(c.couverture, s.universelle), false, vue(f)); }
});

test('T13. un même chemin n’est jamais relié à lui-même ; une classe a au moins deux constats de chemins distincts', async () => {
  const { familles } = await reel();
  const toutes = [...familles.map((f) => coCouverturesParChemins(f.episodes)), coCouverturesParChemins(lot([[['b', 'o'], { x: 1 }], [['s'], { x: 2 }]]))];
  for (const r of toutes) for (const c of r.classes) {
    assert.equal(c.constats.length >= 2, true);
    assert.equal(new Set(c.constats.map((k) => JSON.stringify(k.chemin))).size, c.constats.length);
  }
});

test('T14. famille non comparable (aucune `valeurs`) → aucune classe', () => {
  const r = coCouverturesParChemins(lot([['a', undefined], ['b', undefined], ['c', undefined]]));
  assert.equal(r.universelle.length, 3);
  assert.deepEqual(r.classes, []);
});

test('T16. entrées jamais modifiées (gelées acceptées) ; sortie entièrement neuve', () => {
  const base = lot([['bonjour', 'merci'], ['salut', 'oui'], ['bonjour', 'merci']]);
  const avant = JSON.stringify(base);
  const gel = (o) => { if (o && typeof o === 'object') { Object.freeze(o); for (const v of Object.values(o)) gel(v); } return o; };
  const r1 = coCouverturesParChemins(gel(base));
  assert.equal(JSON.stringify(base), avant);
  const ref = substance(r1);
  r1.classes[0].couverture[0][0] = 'X'; r1.classes[0].constats[0].chemin.push('X'); r1.universelle.length = 0;
  assert.deepEqual(substance(coCouverturesParChemins(base)), ref);
});

test('T17. singleton ≠ confiance : même forme de classe pour 1 et 3 épisodes ; seule la couverture diffère ; aucun champ score/confiance/fréquence', () => {
  const un = coCouverturesParChemins(lot([['bonjour', 'merci'], ['salut', 'oui']])).classes.find((c) => c.constats.some((k) => k.valeur === 'bonjour'));
  const trois = coCouverturesParChemins(lot([['bonjour', 'merci'], ['bonjour', 'merci'], ['bonjour', 'merci'], ['salut', 'oui']])).classes.find((c) => c.constats.some((k) => k.valeur === 'bonjour'));
  assert.equal(un.couverture.length, 1); assert.equal(trois.couverture.length, 3);
  assert.deepEqual(Object.keys(un), ['couverture', 'constats']); assert.deepEqual(Object.keys(trois), ['couverture', 'constats']);
  assert.deepEqual(un.constats, trois.constats);
  for (const k of [...un.constats, ...trois.constats]) assert.deepEqual(Object.keys(k), ['chemin', 'type', 'valeur']);
  const sortie = coCouverturesParChemins(lot([['bonjour', 'merci'], ['salut', 'oui']]));
  assert.deepEqual(Object.keys(sortie), ['universelle', 'classes']);
  assert.equal(/score|confian|frequen|fréquen|poids|nombre|taille/i.test(JSON.stringify(sortie)), false);
});

test('T19. R3 structurel : identités quelconques (sans préfixe, sans nom) exclues ; une valeur égale à l’identité de CERTAINS témoins seulement reste', () => {
  const ep = fabrique('', '', '');
  const e1 = ep('bonjour', 'merci', { depart: 'α', vers: 'ζ7', arrivee: 'Ω' });
  const e2 = ep('salut', 'oui', { depart: 'β', vers: 'ξ', arrivee: '9' });
  const e3 = ep('bonjour', 'merci', { depart: 'γ', vers: 'π', arrivee: '∂' });
  const r = coCouverturesParChemins([e1, e2, e3]);
  assert.deepEqual(lisible(r).map((c) => c.relation).sort(), [['valeurs.arrivee="merci"', 'valeurs.depart="bonjour"'], ['valeurs.arrivee="oui"', 'valeurs.depart="salut"']]);
  // une valeur du monde qui coïncide avec l’identité d’UN des deux témoins n’est pas une identité de chacun : conservée
  const f1 = ep('Ω2', 'k', { depart: 'Ω2', vers: 'v1', arrivee: 'w1' });
  const f2 = ep('Ω2', 'k', { depart: 'd2', vers: 'v2', arrivee: 'w2' });
  const f3 = ep('autre', 'm', { depart: 'd3', vers: 'v3', arrivee: 'w3' });
  const s = coCouverturesParChemins([f1, f2, f3]);
  assert.deepEqual(lisible(s).find((c) => c.temoins.length === 2).relation, ['valeurs.arrivee="k"', 'valeurs.depart="Ω2"']);
  assert.equal(s.classes.flatMap((c) => c.constats).some((k) => ['v1', 'w1', 'd2', 'v2', 'w2', 'd3', 'v3', 'w3'].includes(k.valeur)), false, 'les identités restent exclues des constats');
});

// ------------------------------------------------------------------------------------------------------------------------------- G. IDENTITÉ, PURETÉ, DORMANCE
test('G1. identiteEpisode extraite : export unique, définition textuellement identique, résultats égaux à l’ancienne définition sur tous les épisodes réels', async () => {
  assert.deepEqual(Object.keys(moduleIdentite), ['identiteEpisode']);
  const SRC_ID = readFileSync(join(RACINE, 'app', 'langage', 'identite-episode.js'), 'utf8');
  assert.equal(SRC_ID.includes('export const identiteEpisode = (episode) => [episode.depart, episode.arrivee, ...episode.chemin.map((e) => e.vers)];'), true);
  const ancienne = (episode) => [episode.depart, episode.arrivee, ...episode.chemin.map((e) => e.vers)];
  const { familles } = await reel();
  let n = 0;
  for (const f of familles) for (const e of f.episodes) { assert.deepEqual(identiteEpisode(e), ancienne(e)); n += 1; }
  assert.equal(n > 50, true);
  const CP = readFileSync(join(RACINE, 'app', 'langage', 'contexte-prospectif.js'), 'utf8');
  assert.equal(/const identiteEpisode\s*=/.test(CP), false, 'plus de définition locale');
  assert.equal(CP.includes("import { identiteEpisode } from './identite-episode.js';"), true);
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /from '\.\/identite-episode\.js'/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1)).sort();
  assert.deepEqual(importeurs, ['app/langage/attentes-conditionnees.js' /* MISE À JOUR DÉLIBÉRÉE v0.64.5 (relation fondatrice structurée) : premier branchement réel des primitives structurelles : identiteEpisode retrouve les témoins de la fondation dans la famille */, 'app/langage/co-couvertures.js', 'app/langage/contexte-prospectif.js']);
});

test('G2. pureté : imports exactement connus ; ni horloge, ni hasard, ni magasin, ni état de module, ni vocabulaire de jugement', () => {
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./constats-par-chemin.js', './couverture-occurrences.js', './identite-episode.js']);
  for (const motif of [/\bDate\b/, /Math\.random/, /performance\./, /\bawait\b/, /\basync\b/, /\bsetTimeout\b/, /\bPromise\b/, /\bprocess\b/, /\bglobalThis\b/, /\blocalStorage\b/, /\becrire\b|\benregistrer\b|\.ecrire|\.lireTout/, /\bcrypto\b|sha256/]) assert.equal(motif.test(CODE), false, String(motif));
  assert.equal(/cause|confian|frequen|fréquen|score|probab|regle|règle|predict|prédi|prefer|préfér|apprentissage|attente|besoin|strategi|moyen/i.test(CODE), false);
  assert.equal(/\b(let|var)\b[^;]*=\s*(\[\]|\{\}|new (Map|Set))/.test(CODE.split('export function')[0]), false, 'aucun état de module');
});

test('G3. DORMANCE : aucun fichier de app/ ne nomme le module ni la fonction ; aucun import depuis les mécanismes de décision ; catalogue et table inchangés', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    if (f === join(RACINE, 'app', 'langage', 'attentes-conditionnees.js')) continue;
    if (f === join(RACINE, 'app', 'langage', 'co-couvertures-descriptions.js')) continue; // MISE À JOUR DÉLIBÉRÉE v0.64.6 : le noyau général NOMME .95 dans son contrat (et porte « co-couvertures » dans son nom), sans l'importer // MISE À JOUR DÉLIBÉRÉE v0.64.1 (attente conditionnée par la partie connue) : + attentes-conditionnees.js (calcul pur, appelé aux quatre sites des attentes .74 ; importe co-couvertures, familles-episodes, episodes-de-transformation (vue + partieConnueEpisode), contexte-prospectif (cheminsOuverts), constats-par-chemin, couverture-occurrences, constats-structurels (memesConstats)) : la co-couverture n'est plus dormante, son SEUL lecteur est ce raccord
    assert.equal(/co-couvertures|coCouverturesParChemins/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/co-couvertures|coCouverturesParChemins/.test(s), false, autre); }
  for (const interdit of ['besoins', 'episode-propre', 'attentes-prospectives', 'execution-mecanique', 'execution-sollicitee', 'capacite', 'relation', 'tick-propre', 'contexte-prospectif', 'environnement-conversation']) assert.equal(SRC.includes(`'./${interdit}.js'`), false, interdit);
  assert.equal(/moyensConnus|moyensParStrategie|strategies/.test(CODE), false);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17);
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
