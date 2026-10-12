// v0.63.97 — DÉCOUPLAGE DES VALEURS D'ÉPISODE (décision ChatGPT « DÉCISION APRÈS SONDE PARTIE CONNUE », 12/10/2026).
// La présence de la valeur observée à une extrémité ne dépend que de cette extrémité ; relationValeur strictement inchangée ; schéma non étendu.
// Preuves : cas A–F sur chaîne, nombre, booléen, null, collection, objet ; épisodes réels (conversation, symbolesDeChaine, composerCollection,
// parcourirStructure, soi) ; redémarrage ; ancienne copie .96 d'un épisode parent relue telle quelle ; co-couvertures recalculées ; garde statique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { coCouverturesParChemins } from '../app/langage/co-couvertures.js';
import { issueDuContexteProspectif } from '../app/langage/issue-contexte-prospectif.js';
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
const Q = { forme: 'quelconque', peutEtreNull: true };
const DESCQ = [{ nom: 'f', entrees: { x: Q }, sortie: { forme: 'quelconque' } }];
const lien = (entree, donnee) => ({ entree, donnee });
const ex = (id, liaisons, resultat) => ({ id, horodatage: '2026-10-12T00:00:00.000Z', idDesignation: `d-${id}`, operation: 'f', liaisons, resultat });
// Épisode A > B : A = f(message), B = f(A) ; départ = valeur de A, arrivée = valeur de B.
function episodeAB(depart, arrivee) {
  const r = episodesDeTransformation([{ id: 'm', valeur: 's' }], [ex('A', [lien('x', 'm')], depart), ex('B', [lien('x', 'A')], arrivee)], DESCQ);
  return r.episodes.find((e) => e.depart === 'A' && e.arrivee === 'B');
}

// ------------------------------------------------------------------------------------------------------------------------------- A–F
test('A–F. présence de chaque valeur selon SA seule extrémité ; relationValeur inchangée ; types chaîne, nombre, booléen, null, collection, objet', () => {
  const cas = [
    // [depart, arrivee, valeurs attendues (undefined = absent), relationValeur]
    ['a', 'a', { depart: 'a', arrivee: 'a' }, 'egale'], // A + E
    ['a', 'b', { depart: 'a', arrivee: 'b' }, 'differente'], // A + F
    [7, 7, { depart: 7, arrivee: 7 }, 'egale'],
    [7, '7', { depart: 7, arrivee: '7' }, 'differente'],
    [true, false, { depart: true, arrivee: false }, 'differente'],
    [null, null, { depart: null, arrivee: null }, 'egale'],
    ['a', ['x'], { depart: 'a' }, 'non_comparable'], // B
    [3, { k: 1 }, { depart: 3 }, 'non_comparable'], // B (objet)
    [['x'], 'a', { arrivee: 'a' }, 'non_comparable'], // C
    [{ k: 1 }, false, { arrivee: false }, 'non_comparable'], // C (objet)
    [['x'], { k: 1 }, undefined, 'non_comparable'], // D
    [['x'], ['x'], undefined, 'non_comparable'], // D : aucune égalité profonde
  ];
  for (const [d, a, valeurs, relation] of cas) {
    const e = episodeAB(d, a);
    assert.equal(e.relationValeur, relation, JSON.stringify([d, a]));
    if (valeurs === undefined) assert.equal('valeurs' in e, false, JSON.stringify([d, a]));
    else { assert.deepEqual(e.valeurs, valeurs, JSON.stringify([d, a])); assert.deepEqual(Object.keys(e.valeurs), Object.keys(valeurs)); }
  }
});

test('Schéma non étendu : aucune valeur intermédiaire, aucune décomposition, aucune métadonnée ; clés d’un épisode inchangées', () => {
  const r = episodesDeTransformation([{ id: 'm', valeur: 's' }], [ex('A', [lien('x', 'm')], 'a'), ex('B', [lien('x', 'A')], ['b', 'c']), ex('C', [lien('x', 'B')], 'd')], DESCQ);
  const e = r.episodes.find((x) => x.depart === 'A' && x.arrivee === 'C');
  assert.deepEqual(Object.keys(e), ['depart', 'arrivee', 'chemin', 'relationValeur', 'valeurs']);
  assert.deepEqual(e.valeurs, { depart: 'a', arrivee: 'd' }, 'la valeur intermédiaire (B) n’apparaît nulle part');
  assert.deepEqual(Object.keys(e.chemin[0]), ['de', 'execution', 'operation', 'entrees', 'vers']);
  const versCollection = r.episodes.find((x) => x.depart === 'A' && x.arrivee === 'B');
  assert.deepEqual(versCollection.valeurs, { depart: 'a' }, 'la collection n’est jamais décomposée sous valeurs');
});

// ------------------------------------------------------------------------------------------------------------------------------- vécu réel
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
  async function emettre(texte) {
    const s = await tour(texte);
    const ex2 = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).filter((m) => m.idObservation === s.observation.id).find((m) => ex2.find((q) => q.id === m.idExecution).operation === 'symbolesDeChaine');
  }
  async function tick(k) { for (let i = 0; i < k; i += 1) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  return { magasin, tour, emettre, tick };
}
let REEL = null;
async function reel() {
  if (REEL) return REEL;
  const w = monde();
  for (const [x, y] of [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui']]) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tick(2); }
  await w.tour('encore');
  const v = await lireExecutionsVecues(w.magasin);
  const sortie = episodesDeTransformation(v.valeurs, v.executions, v.descriptions);
  REEL = { w, v, sortie, familles: famillesDEpisodes(sortie).familles };
  return REEL;
}
const vue = (f) => f.structure.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const de = (familles, structure) => familles.find((f) => vue(f) === structure);

test('RÉEL. conversation, symbolesDeChaine, composerCollection, parcourirStructure, soi : valeurs aux seules extrémités comparables', async () => {
  const { familles } = await reel();
  const conv = de(familles, 'symbolesDeChaine(chaine)>environnement:conversation(emis)');
  assert.deepEqual(conv.episodes.map((e) => e.valeurs), [{ depart: 'bonjour', arrivee: 'merci' }, { depart: 'salut', arrivee: 'oui' }, { depart: 'salut', arrivee: 'oui' }], 'deux bouts : identique à .96');
  for (const e of de(familles, 'symbolesDeChaine(chaine)').episodes) { assert.equal(e.relationValeur, 'non_comparable'); assert.deepEqual(Object.keys(e.valeurs), ['depart']); }
  for (const e of de(familles, 'parcourirStructure(valeur)').episodes) { assert.equal(e.relationValeur, 'non_comparable'); assert.deepEqual(Object.keys(e.valeurs), ['depart']); }
  const compose = de(familles, 'composerCollection(elements)');
  assert.ok(compose && compose.episodes.length > 0);
  for (const e of compose.episodes) { assert.equal(e.relationValeur, 'non_comparable'); assert.deepEqual(Object.keys(e.valeurs), ['arrivee']); assert.equal(typeof e.valeurs.arrivee, 'string'); }
  for (const s of ['soi:tour(etat)', 'soi:repos(etat)', 'soi:temps(etat)', 'soi:reception(etat)']) {
    const f = de(familles, s); assert.ok(f, s);
    for (const e of f.episodes) { assert.deepEqual(Object.keys(e.valeurs), ['depart', 'arrivee'], s); assert.equal(typeof e.valeurs.depart, 'number'); }
  }
  const env = de(familles, 'environnement:conversation(emis)');
  for (const e of env.episodes) { assert.equal(e.relationValeur, 'non_comparable'); assert.deepEqual(Object.keys(e.valeurs), ['arrivee']); }
});

test('RÉEL. relationValeur strictement identique à la règle à deux bouts ; aucun épisode perdu ni ajouté', async () => {
  const { sortie } = await reel();
  for (const e of sortie.episodes) {
    const deux = e.valeurs !== undefined && Object.hasOwn(e.valeurs, 'depart') && Object.hasOwn(e.valeurs, 'arrivee');
    assert.equal(e.relationValeur === 'non_comparable', !deux);
  }
  const compte = { deux: 0, depart: 0, arrivee: 0, aucun: 0 };
  for (const e of sortie.episodes) compte[e.valeurs === undefined ? 'aucun' : Object.keys(e.valeurs).length === 2 ? 'deux' : Object.keys(e.valeurs)[0]] += 1;
  assert.equal(compte.deux + compte.depart + compte.arrivee + compte.aucun, sortie.episodes.length);
  assert.ok(compte.depart > 0 && compte.arrivee > 0 && compte.aucun > 0 && compte.deux > 0, JSON.stringify(compte));
});

test('REDÉMARRAGE : tables relues (JSON, ordre inversé) → mêmes épisodes', async () => {
  const { w, sortie } = await reel();
  const donnees = {}; for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t))).reverse();
  const neuf = magasinMemoireVive(); await neuf.remplacerTout(donnees);
  const v = await lireExecutionsVecues(neuf);
  assert.deepEqual(episodesDeTransformation(v.valeurs, v.executions, v.descriptions), sortie);
});

test('ANCIENNE BASE .96 : une copie persistée d’épisode parent sans valeurs (schéma .96) est relue telle quelle ; l’issue n’en dépend pas', async () => {
  const { w, v } = await reel();
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  const c = contextes.find((x) => x.parent && x.parent.valeurs && Object.keys(x.parent.valeurs).length === 1);
  assert.ok(c, 'un contexte dont le parent n’a qu’une extrémité comparable');
  const ancien = { ...structuredClone(c), parent: (({ valeurs, ...reste }) => reste)(c.parent) };
  await w.magasin.ecrire('contextesProspectifs', ancien);
  const relu = (await w.magasin.lireTout('contextesProspectifs')).find((x) => x.id === c.id);
  assert.deepEqual(relu, ancien, 'aucune migration');
  assert.deepEqual(issueDuContexteProspectif(relu, v.valeurs, v.executions, v.descriptions), issueDuContexteProspectif(c, v.valeurs, v.executions, v.descriptions));
  await w.magasin.ecrire('contextesProspectifs', c);
});

test('CO-COUVERTURES recalculées : classes de conversation inchangées ; aucune classe nouvelle faite d’identités', async () => {
  const { familles } = await reel();
  const classes = (s) => coCouverturesParChemins(de(familles, s).episodes).classes.map((c) => c.constats.map((k) => `${k.chemin.join('.')}=${k.valeur}`).sort().join(' ↔ ')).sort();
  assert.deepEqual(classes('symbolesDeChaine(chaine)>environnement:conversation(emis)'), ['valeurs.arrivee=merci ↔ valeurs.depart=bonjour', 'valeurs.arrivee=oui ↔ valeurs.depart=salut']);
  for (const f of familles) for (const c of coCouverturesParChemins(f.episodes).classes) for (const k of c.constats) assert.equal(/execution-operation|reception-|message-|variation-|etat-/.test(String(k.valeur)), false, vue(f));
});

test('GARDE : la vue des épisodes n’importe rien de nouveau ; aucun nom de champ d’opération ; aucun branchement', () => {
  const SRC = readFileSync(join(RACINE, 'app', 'langage', 'episodes-de-transformation.js'), 'utf8');
  const imports = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['./acces-valeur.js', './entrees-production.js', './resoudre-identites.js', './sous-donnees.js', './valeurs-observees.js']);
  const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/besoins|strategi|initiative|coCouvertures|attente|intermediaire/i.test(CODE), false); // MISE À JOUR DÉLIBÉRÉE v0.63.98 : partieConnueEpisode est désormais définie ici (vue dormante autorisée) ; tout le reste demeure interdit
});
