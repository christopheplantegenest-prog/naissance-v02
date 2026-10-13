// v0.64.6 — CO-COUVERTURES GÉNÉRALES DE DESCRIPTIONS (décision ChatGPT « DÉCISION v0.64.6 », 13/10/2026).
// coCouverturesDeDescriptions(descriptions, universelle) : classes de descriptions DISTINCTES de même couverture exacte, non vide, non universelle.
// Cas artificiels imposés, doublons, ordres, gel, refus ; noyau exact de .95 ; sondes expériences (homogène, contradictoire) ; généricité ; gardes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { experiencesDAttentes, elementsDExperiences, regrouperExperiences } from '../app/langage/experiences-attentes.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerAttenteProspective } from '../app/langage/connaissances.js';
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
  async function message(texte, idEmission = null, operation = 'symbolesDeChaine') {
    await repos();
    const avant = (await magasin.lireTout('emissions')).length;
    await tour(texte, idEmission);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).slice(avant).filter((e) => ex.find((q) => q.id === e.idExecution).operation === operation).at(-1);
  }
  async function experiences() {
    const v = await lireExecutionsVecues(magasin);
    return experiencesDAttentes(await magasin.lireTout('attentesProspectives'), await magasin.lireTout('contextesProspectifs'), v.valeurs, v.executions, v.descriptions);
  }
  return { magasin, message, experiences };
}


import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { coCouverturesDeDescriptions } from '../app/langage/co-couvertures-descriptions.js';
import { coCouverturesParChemins } from '../app/langage/co-couvertures.js';
import { identiteEpisode } from '../app/langage/identite-episode.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const refuse = (f, motif) => assert.throws(f, (e) => e instanceof TypeError && (!motif || motif.test(e.message)));
const k = (x) => JSON.stringify(x);
const U = [[1], [2], [3], [4]];
const d = (description, ids) => ({ description, couverture: ids.map((n) => [n]) });
const BASE = [d('A', [1, 2]), d('B', [1, 2]), d('C', [2, 3]), d('D', [1, 2, 3, 4]), d('E', []), d('F', [4]), d('G', [4])];
const ATTENDU = [{ couverture: [[1], [2]], descriptions: ['A', 'B'] }, { couverture: [[4]], descriptions: ['F', 'G'] }];
const permuter = (t) => { const r = [...t].reverse(); return [...r.filter((_, i) => i % 2 === 1), ...r.filter((_, i) => i % 2 === 0)]; };

test('CAS ARTIFICIELS IMPOSÉS : U={1,2,3,4} — {A,B} sur {1,2}, {F,G} sur {4} ; C seule, D universelle, E vide : exclues', () => {
  assert.deepStrictEqual(coCouverturesDeDescriptions(BASE, U), ATTENDU);
  assert.deepStrictEqual(coCouverturesDeDescriptions([d('A', [1, 2]), d('B', [1, 2, 3])], U), [], 'inclusion : aucune classe');
  assert.deepStrictEqual(coCouverturesDeDescriptions([d('A', [1, 2, 3, 4]), d('B', [1, 2, 3, 4])], U), [], 'universelle exclue');
  assert.deepStrictEqual(coCouverturesDeDescriptions([d('A', []), d('B', [])], U), [], 'vide exclue');
  assert.deepStrictEqual(coCouverturesDeDescriptions([], U), []);
});

test('DOUBLONS : une description n’est jamais co-couverte avec elle-même ; A/C, A/C, B/C → {A,B} ; A/C, A/C → rien ; égalité par parcours (ordre des clés sans effet)', () => {
  assert.deepStrictEqual(coCouverturesDeDescriptions([...BASE, d('A', [2, 1]), d('A', [1, 2])], U), ATTENDU);
  assert.deepStrictEqual(coCouverturesDeDescriptions([d('A', [1]), d('A', [1])], U), []);
  assert.deepStrictEqual(coCouverturesDeDescriptions([d({ x: 1, y: 2 }, [3]), d({ y: 2, x: 1 }, [3])], U), [], 'mêmes occurrences : même description');
  assert.equal(coCouverturesDeDescriptions([d({ x: 1, y: 2 }, [3]), d({ y: 2, x: 1 }, [3]), d([1, 2], [3])], U)[0].descriptions.length, 2);
  assert.equal(coCouverturesDeDescriptions([d([1, 2], [3]), d([2, 1], [3])], U)[0].descriptions.length, 2, 'l’ordre d’un tableau fait partie de la description');
  assert.equal(coCouverturesDeDescriptions([d('1', [3]), d(1, [3])], U)[0].descriptions.length, 2, '"1" ≠ 1');
  // une même description sous deux couvertures : dans chacune des classes
  assert.deepStrictEqual(coCouverturesDeDescriptions([d('A', [1]), d('B', [1]), d('A', [2]), d('C', [2])], U), [{ couverture: [[1]], descriptions: ['A', 'B'] }, { couverture: [[2]], descriptions: ['A', 'C'] }]);
});

test('ORDRES ET IMMUTABILITÉ : permutations des entrées et des identités, entrées gelées en profondeur — même sortie, copies neuves', () => {
  const melange = permuter(BASE.map((x) => ({ description: x.description, couverture: [...x.couverture].reverse() })));
  assert.deepStrictEqual(coCouverturesDeDescriptions(melange, [...U].reverse()), ATTENDU);
  const gele = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gele); Object.freeze(o); } return o; };
  const objets = gele([d({ a: [1] }, [1, 2]), d({ b: 2 }, [1, 2])]);
  const r = coCouverturesDeDescriptions(objets, gele(structuredClone(U)));
  assert.deepStrictEqual(r, [{ couverture: [[1], [2]], descriptions: [{ a: [1] }, { b: 2 }] }]);
  assert.notEqual(r[0].descriptions[0], objets[0].description); assert.notEqual(r[0].couverture, objets[0].couverture);
});

test('REFUS : couverture hors univers, doublon d’identité, couverture ou univers invalides, description hors domaine, entrée mal formée', () => {
  refuse(() => coCouverturesDeDescriptions([d('A', [5])], U), /incluse/);
  refuse(() => coCouverturesDeDescriptions([d('A', [1, 1])], U), /doublon/);
  refuse(() => coCouverturesDeDescriptions([{ description: 'A', couverture: [1] }], U), /couverture invalide/);
  refuse(() => coCouverturesDeDescriptions([d('A', [1])], [[1], [1]]), /universelle invalide/);
  refuse(() => coCouverturesDeDescriptions([d(undefined, [1])], U), /hors domaine/);
  refuse(() => coCouverturesDeDescriptions([d(Number.NaN, [1])], U), /hors domaine/);
  refuse(() => coCouverturesDeDescriptions([{ description: 'A' }], U));
  refuse(() => coCouverturesDeDescriptions([{ ...d('A', [1]), score: 1 }], U));
  refuse(() => coCouverturesDeDescriptions([null], U)); refuse(() => coCouverturesDeDescriptions('x', U)); refuse(() => coCouverturesDeDescriptions([, d('A', [1])], U)); // eslint-disable-line no-sparse-arrays
});

test('NOYAU DE .95 : constatsParChemin d’une famille, R0 et R3 appliqués AVANT, puis coCouverturesDeDescriptions(…, universelle) = coCouverturesParChemins, pour TOUTES les familles d’un vécu réel', async () => {
  const w = monde();
  for (const [x, y] of [['K9', '77'], ['Q4', '55'], ['K9', '77'], ['bonjour', 'merci'], ['K9', '99']]) { const e = await w.message(x); await w.message(y, e.id); }
  const v = await lireExecutionsVecues(w.magasin);
  const { familles } = famillesDEpisodes(episodesDeTransformation(v.valeurs, v.executions, v.descriptions));
  let nonVides = 0;
  for (const f of familles) {
    const histoire = constatsParChemin(f.episodes.map((e) => ({ chemin: identiteEpisode(e), contenu: e })));
    const descriptions = histoire.chemins.flatMap((c) => c.constats
      .filter((q) => Object.hasOwn(q, 'valeur')) // R0
      .filter((q) => !q.couverture.every((t) => t.some((s) => s === q.valeur))) // R3
      .map((q) => ({ description: { chemin: c.chemin, type: q.type, valeur: q.valeur }, couverture: q.couverture })));
    const general = coCouverturesDeDescriptions(descriptions, histoire.universelle);
    const ref = coCouverturesParChemins(f.episodes).classes;
    const canon = (cl) => cl.map((x) => [k(x.couverture), x.descriptions || x.constats].flat()).map((x) => [x[0], x.slice(1).map(k).sort()]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    assert.deepStrictEqual(canon(general), canon(ref), k(f.structure));
    if (ref.length > 0) nonVides += 1;
  }
  assert.ok(nonVides >= 2, 'des familles à classes non vides sont couvertes');
});

// Expériences de la forme v0.64.5 (avant.relation, apres.statut), construites pour la sonde : la primitive ne les connaît pas.
const R = { domaine: [{ operation: 'f', entrees: ['e'] }], connu: { valeurs: { depart: 'K9' } }, attendu: { valeurs: { arrivee: '77' } } };
const S = { domaine: [{ operation: 'f', entrees: ['e'] }], connu: { valeurs: { depart: 'Q4' } }, attendu: { valeurs: { arrivee: '55' } } };
const xp = (id, relation, statut) => ({ id, critere: {}, avant: { relation }, apres: { statut } });
function descriptionsDe(experiences) { // descriptions choisies par l'APPELANT : relations composites + constats de statut
  const groupes = regrouperExperiences(experiences, [['avant', 'relation']]);
  const cpc = constatsParChemin(elementsDExperiences(experiences));
  const statuts = cpc.chemins.find((c) => k(c.chemin) === '["apres","statut"]').constats;
  return { universelle: cpc.universelle, descriptions: [...groupes.map((g) => ({ description: { relation: g.cle[0] }, couverture: g.couverture })), ...statuts.map((s) => ({ description: { statut: s.valeur }, couverture: s.couverture }))] };
}

test('SONDE EXPÉRIENCES HOMOGÈNES : R ↔ réalisée sur {E1,E2}, S ↔ autre sur {E3,E4} ; aucune causalité, seulement deux classes de couverture', () => {
  const X = [xp('E1', R, 'realisee'), xp('E2', R, 'realisee'), xp('E3', S, 'autre'), xp('E4', S, 'autre')];
  const { descriptions, universelle } = descriptionsDe(X);
  assert.deepStrictEqual(coCouverturesDeDescriptions(descriptions, universelle), [
    { couverture: [['E1'], ['E2']], descriptions: [{ relation: R }, { statut: 'realisee' }] },
    { couverture: [['E3'], ['E4']], descriptions: [{ relation: S }, { statut: 'autre' }] },
  ]);
});

test('SONDE CONTRADICTOIRE : R={E1,E2}, réalisée={E1,E3}, autre={E2}, S={E3} — aucune co-couverture relation ↔ statut ; la contradiction reste dans les couvertures', () => {
  const X = [xp('E1', R, 'realisee'), xp('E2', R, 'autre'), xp('E3', S, 'realisee')];
  const { descriptions, universelle } = descriptionsDe(X);
  const classes = coCouverturesDeDescriptions(descriptions, universelle);
  assert.deepStrictEqual(classes.map((c) => c.descriptions.map(k)), [], k(classes));
  // un seul couple accidentel serait S ↔ ? : S={E3} n'égale aucun statut (réalisée={E1,E3})
});

test('VÉCU RÉEL (monde de test) et généricité : expériences du flux réel, épisodes (ci-dessus), attentes comme éléments [id] — même contrat, aucun cas spécial', async () => {
  const w = monde();
  for (const [x, y] of [['K9', '77'], ['Q4', '55'], ['K9', '77'], ['K9', '77'], ['K9', '99']]) { const e = await w.message(x); await w.message(y, e.id); }
  const { experiences } = await w.experiences();
  const X = experiences.filter((e) => e.avant.relation);
  const { descriptions, universelle } = descriptionsDe(X);
  const classes = coCouverturesDeDescriptions(descriptions, universelle);
  assert.ok(classes.every((c) => c.descriptions.length >= 2 && c.couverture.length > 0 && c.couverture.length < universelle.length));
  // attentes comme éléments : constats de leurs constats engagés
  const attentes = await w.magasin.lireTout('attentesProspectives');
  const cpc = constatsParChemin(attentes.map((a) => ({ chemin: [a.id], contenu: { chemin: a.chemin, constat: a.constat, source: Object.hasOwn(a, 'fondation') } })));
  const desc = cpc.chemins.flatMap((c) => c.constats.filter((q) => Object.hasOwn(q, 'valeur')).map((q) => ({ description: { chemin: c.chemin, valeur: q.valeur }, couverture: q.couverture })));
  const r = coCouverturesDeDescriptions(desc, cpc.universelle);
  assert.ok(Array.isArray(r));
  for (const c of r) for (const x of c.descriptions) assert.ok(desc.some((q) => k(q.description) === k(x) && k(normaliserCouvertureLocale(q.couverture)) === k(c.couverture)));
});
const normaliserCouvertureLocale = (c) => [...c].map((t) => k(t)).sort().map((t) => JSON.parse(t));

test('GARDES : pure ; aucun nom de champ ; NON BRANCHÉE (aucun fichier de production ne l’importe ni ne la nomme)', () => {
  const SRC = readFileSync(join(RACINE, 'app', 'langage', 'co-couvertures-descriptions.js'), 'utf8');
  const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.deepEqual([...CODE.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort(), ['./couverture-occurrences.js', './parcours-structure.js']);
  assert.equal(/Date|Math\.random|globalThis|WeakMap|\bawait\b|lireTout|ecrire/.test(CODE), false);
  assert.deepEqual(CODE.split('\n').filter((l) => /^(let|var) /.test(l)), []);
  assert.equal(/statut|realisee|relation|connu|attendu|episode|experience|attente|valeurs|score|frequen|probab|majorit|confian|cause/i.test(CODE), false);
  const fichiers = (dd) => readdirSync(dd).flatMap((n) => { const p = join(dd, n); return statSync(p).isDirectory() ? fichiers(p) : p.endsWith('.js') ? [p] : []; });
  for (const f of fichiers(join(RACINE, 'app'))) if (!f.endsWith('co-couvertures-descriptions.js')) assert.equal(/co-couvertures-descriptions|coCouverturesDeDescriptions/.test(readFileSync(f, 'utf8')), false, f);
});
