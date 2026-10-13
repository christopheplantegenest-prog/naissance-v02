// v0.63.98 — PARTIE CONNUE D'UN ÉPISODE (décision ChatGPT « AUTORISATION DE CODER L'ÉTAPE PARTIE CONNUE D'UN ÉPISODE », 12/10/2026).
// partieConnueEpisode : dans le schéma d'épisode v0.63.97, uniquement ce que episodePartiel détermine. Preuves : matrice A–I, parcourirStructure
// sans connaissance spéciale, raccord PUR (code de test seulement) avec les co-couvertures .95 sur salut et A17, dormance, gardes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { episodesDeTransformation, partieConnueEpisode } from '../app/langage/episodes-de-transformation.js';
import { famillesDEpisodes } from '../app/langage/familles-episodes.js';
import { coCouverturesParChemins } from '../app/langage/co-couvertures.js';
import { parcourirStructure } from '../app/langage/parcours-structure.js';
import { memesConstats } from '../app/langage/constats-structurels.js';
import { resoudreIdentitesDonnees } from '../app/langage/resoudre-identites.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
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
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const S2 = 'symbolesDeChaine(chaine)>environnement:conversation(emis)';

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
  async function emettre(texte) {
    const s = await tour(texte);
    const ex = await magasin.lireTout('executionsOperations');
    return (await magasin.lireTout('emissions')).filter((m) => m.idObservation === s.observation.id).find((m) => ex.find((q) => q.id === m.idExecution).operation === 'symbolesDeChaine');
  }
  async function tick(k) { for (let i = 0; i < k; i += 1) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  const contexte = async (E, structure) => (await magasin.lireTout('contextesProspectifs')).find((c) => c.idDesignation === E.id && vue(c.structure) === structure);
  return { magasin, tour, emettre, tick, contexte, vecu: () => lireExecutionsVecues(magasin) };
}
// Histoire puis présent (émission non encore répondue).
async function histoire(paires, present) {
  const w = monde();
  for (const [x, y] of paires) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tick(2); }
  const E = await w.emettre(present);
  return { w, E };
}
const partie = async (w, c) => { const v = await w.vecu(); return partieConnueEpisode(c.episodePartiel, v.valeurs, v.executions, v.descriptions); };
const valeurA = (objet, chemin) => parcourirStructure(objet).find((o) => JSON.stringify(o.chemin) === JSON.stringify(chemin));

// Raccord PUR, code de test uniquement : une classe est raccordable si au moins un de ses constats est à un chemin CONNU du présent et si TOUS
// ses constats à chemins connus sont égaux (memesConstats) aux constats présents ; candidats = ses constats à chemins non connus.
function raccorder(partieConnue, episodesHistoriques) {
  const presents = parcourirStructure(partieConnue).filter((o) => Object.hasOwn(o, 'valeur'));
  const connu = (ch) => parcourirStructure(partieConnue).some((o) => JSON.stringify(o.chemin) === JSON.stringify(ch));
  return coCouverturesParChemins(episodesHistoriques).classes.map((c) => {
    const conditions = c.constats.filter((k) => connu(k.chemin));
    const ok = conditions.length > 0 && conditions.every((k) => presents.some((o) => memesConstats({ chemin: k.chemin, type: k.type, valeur: k.valeur }, o)));
    return { classe: c.constats.map((k) => `${k.chemin.join('.')}=${k.valeur}`).sort().join(' ↔ '), ok, candidats: c.constats.filter((k) => !connu(k.chemin)).map((k) => `${k.chemin.join('.')}=${k.valeur}`) };
  });
}

// ------------------------------------------------------------------------------------------------------------------------------- A–E, I
test('A / E. conversation, départ chaîne : depart, chemin connu, valeurs.depart ; ni arrivee, ni relationValeur, ni identité future', async () => {
  const { w, E } = await histoire([['bonjour', 'merci']], 'salut');
  const c = await w.contexte(E, S2);
  const k = await partie(w, c);
  assert.deepEqual(Object.keys(k), ['depart', 'chemin', 'valeurs']);
  assert.equal(k.depart, c.episodePartiel.depart);
  assert.deepEqual(k.chemin, c.episodePartiel.chemin, 'étapes recopiées telles quelles');
  assert.deepEqual(Object.keys(k.chemin.at(-1)).sort(), ['de', 'entrees', 'operation'], 'la dernière étape reste partielle : ni execution ni vers');
  assert.deepEqual(k.valeurs, { depart: 'salut' });
  assert.equal('arrivee' in k, false); assert.equal('relationValeur' in k, false);
});

test('B. soi:tour, départ nombre : valeurs.depart numérique', async () => {
  const { w } = await histoire([['bonjour', 'merci']], 'salut');
  const c = (await w.magasin.lireTout('contextesProspectifs')).filter((x) => vue(x.structure) === 'soi:tour(etat)').at(-1);
  const k = await partie(w, c);
  assert.deepEqual(Object.keys(k), ['depart', 'chemin', 'valeurs']);
  assert.equal(typeof k.valeurs.depart, 'number');
  assert.deepEqual(Object.keys(k.valeurs), ['depart']);
});

test('C. départ collection : identité présente, aucune `valeurs`', async () => {
  const { w, E } = await histoire([['bonjour', 'merci']], 'salut');
  const c = await w.contexte(E, 'environnement:conversation(emis)');
  const k = await partie(w, c);
  assert.deepEqual(Object.keys(k), ['depart', 'chemin']);
  assert.equal(k.depart, E.idExecution);
});

test('D. chemin multi-étapes : étapes connues conservées, aucune valeur intermédiaire', async () => {
  const { w } = await histoire([['bonjour', 'merci'], ['salut', 'oui']], 'encore');
  const c = (await w.magasin.lireTout('contextesProspectifs')).find((x) => x.structure.length >= 3);
  assert.ok(c, 'un contexte à trois étapes existe dans ce vécu');
  const k = await partie(w, c);
  assert.deepEqual(k.chemin, c.episodePartiel.chemin);
  assert.equal(JSON.stringify(Object.keys(k.valeurs ?? {})), JSON.stringify(Object.keys(k.valeurs ?? {}).filter((x) => x === 'depart')), 'seul le départ peut porter une valeur');
  const v = await w.vecu();
  const inter = c.episodePartiel.chemin[0].vers;
  const [r] = resoudreIdentitesDonnees([inter], v.valeurs, v.executions, v.descriptions);
  const valeurIntermediaire = valeurDePorteur(r.porteur, r.donnee, r.acces);
  assert.ok(valeurIntermediaire !== undefined, 'la valeur intermédiaire est résoluble…');
  assert.equal(JSON.stringify(k).includes(JSON.stringify(valeurIntermediaire)), false, '…mais n’apparaît pas');
});

test('I. stabilité : K0 avant l’arrivée = K1 après l’arrivée réelle, même episodePartiel', async () => {
  const { w, E } = await histoire([['bonjour', 'merci']], 'salut');
  const c = await w.contexte(E, S2);
  const K0 = await partie(w, c);
  await w.tour('oui', E.id); await w.tick(2); await w.tour('autre chose');
  assert.deepEqual(await partie(w, c), K0);
});

// ------------------------------------------------------------------------------------------------------------------------------- F, G, H
test('F. episodePartiel portant les deux extrémités : partie connue = l’épisode complet .97 (mêmes clés, même ordre, même relation)', async () => {
  const { w } = await histoire([['bonjour', 'merci'], ['salut', 'oui']], 'x');
  const v = await w.vecu();
  const { episodes } = episodesDeTransformation(v.valeurs, v.executions, v.descriptions);
  let n = 0;
  for (const e of episodes) { assert.deepEqual(partieConnueEpisode(e, v.valeurs, v.executions, v.descriptions), e); n += 1; }
  assert.ok(n > 50);
});

test('G. identité non résoluble : même erreur que la résolution de la vue complète ; entrées mal formées : TypeError', async () => {
  const { w } = await histoire([['bonjour', 'merci']], 'x');
  const v = await w.vecu();
  let attendu = null; try { resoudreIdentitesDonnees(['inconnue'], v.valeurs, v.executions, v.descriptions); } catch (e) { attendu = e; }
  assert.ok(attendu instanceof TypeError);
  assert.throws(() => partieConnueEpisode({ depart: 'inconnue', chemin: [] }, v.valeurs, v.executions, v.descriptions), (e) => e instanceof TypeError && e.message === attendu.message);
  for (const mauvais of [null, [], 'x', { chemin: [] }, { depart: '', chemin: [] }, { depart: 'm', chemin: 'x' }, { depart: 'm', arrivee: '', chemin: [] }]) {
    assert.throws(() => partieConnueEpisode(mauvais, v.valeurs, v.executions, v.descriptions), TypeError);
  }
});

test('H. redémarrage (JSON, lignes inversées) : résultat identique ; entrées jamais modifiées', async () => {
  const { w, E } = await histoire([['bonjour', 'merci']], 'salut');
  const c = await w.contexte(E, S2);
  const K = await partie(w, c);
  const donnees = {}; for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t))).reverse();
  const neuf = magasinMemoireVive(); await neuf.remplacerTout(donnees);
  const v = await lireExecutionsVecues(neuf);
  const avant = JSON.stringify(c.episodePartiel);
  assert.deepEqual(partieConnueEpisode(c.episodePartiel, v.valeurs, v.executions, v.descriptions), K);
  assert.equal(JSON.stringify(c.episodePartiel), avant);
});

// ------------------------------------------------------------------------------------------------------------------------------- parcours, raccord
test('PARCOURS. parcourirStructure(partie connue) constate naturellement ["valeurs","depart"] = "salut" puis "A17"', async () => {
  for (const present of ['salut', 'A17']) {
    const { w, E } = await histoire([['x', 'y']], present);
    const k = await partie(w, await w.contexte(E, S2));
    const o = valeurA(k, ['valeurs', 'depart']);
    assert.deepEqual([o.type, o.valeur], ['chaine', present]);
    assert.equal(valeurA(k, ['valeurs', 'arrivee']), undefined);
    assert.equal(valeurA(k, ['relationValeur']), undefined);
  }
});

test('RACCORD PUR (test seulement) : bonjour→merci, salut→oui ×2, présent salut → salut↔oui raccordable par valeurs.depart, bonjour↔merci non', async () => {
  const { w, E } = await histoire([['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui']], 'salut');
  const k = await partie(w, await w.contexte(E, S2));
  const v = await w.vecu();
  const famille = famillesDEpisodes(episodesDeTransformation(v.valeurs, v.executions, v.descriptions)).familles.find((f) => vue(f.structure) === S2);
  const r = raccorder(k, famille.episodes);
  assert.deepEqual(r.map((x) => [x.classe, x.ok]).sort(), [['valeurs.arrivee=merci ↔ valeurs.depart=bonjour', false], ['valeurs.arrivee=oui ↔ valeurs.depart=salut', true]]);
  assert.deepEqual(r.find((x) => x.ok).candidats, ['valeurs.arrivee=oui']);
});

test('RACCORD PUR non linguistique : A17→42, Z→7, A17→42, présent A17 → A17↔42 seule raccordable', async () => {
  const { w, E } = await histoire([['A17', '42'], ['Z', '7'], ['A17', '42']], 'A17');
  const k = await partie(w, await w.contexte(E, S2));
  const v = await w.vecu();
  const famille = famillesDEpisodes(episodesDeTransformation(v.valeurs, v.executions, v.descriptions)).familles.find((f) => vue(f.structure) === S2);
  const r = raccorder(k, famille.episodes);
  assert.deepEqual(r.filter((x) => x.ok).map((x) => [x.classe, x.candidats]), [['valeurs.arrivee=42 ↔ valeurs.depart=A17', ['valeurs.arrivee=42']]]);
  assert.equal(r.filter((x) => !x.ok).length, 1);
});

// ------------------------------------------------------------------------------------------------------------------------------- dormance, gardes
test('DORMANCE (v0.64.0 : sauf attentes .74) : aucun autre fichier de production ne nomme partieConnueEpisode ; aucune fonction de raccord en production', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f.endsWith('/episodes-de-transformation.js')) continue;
    if (f.endsWith('/attentes-conditionnees.js')) continue; // MISE À JOUR DÉLIBÉRÉE v0.64.1 (attente conditionnée par la partie connue) : second branchement autorisé — le raccord des classes de co-couverture lit la partie connue
    if (f.endsWith('/attentes-prospectives.js')) continue; // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : seul branchement autorisé — les attentes .74 ne se forment plus sur un chemin connu de la partie connue
    assert.equal(/partieConnueEpisode/.test(readFileSync(f, 'utf8')), false, f);
  }
  const SRC = readFileSync(join(RACINE, 'app', 'langage', 'episodes-de-transformation.js'), 'utf8');
  const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  assert.equal(/raccord|coCouvertures|attente|contexte|issue|besoins|strategi/i.test(CODE), false);
  assert.equal(/\b(let|var)\b[^;]*=\s*(\[\]|\{\}|new (Map|Set))/.test(CODE.split('export function')[0]), false, 'aucun état de module');
});
