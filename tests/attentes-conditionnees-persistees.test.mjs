// v0.64.28 — « VOIR LES ATTENTES CONDITIONNÉES ÉCRITES AVANT LEUR ISSUE » (GO ChatGPT « GO DÉVELOPPEMENT v0.64.28 », 15/10/2026).
// Jalon d'OBSERVATION : vue Diagnostic en lecture seule (app/langage/attentes-conditionnees-persistees.js). Deux lectures séparées :
// AVANT L'ISSUE (lignes persistées à K0, relues telles quelles) et AUJOURD'HUI (issue relue par issuesDeLAttenteProspective, sur geste).
// Familles H1–H11 de la conception (4/5) + H12 (horodatages informatifs seulement). Le vécu est produit par le VRAI flux (harnais de
// tests/attentes-conditionnees.test.mjs : tours, émissions, « Répondre », ticks, capacité).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { relireAttentesConditionnees, relireIssuesAujourdhui } from '../app/langage/attentes-conditionnees-persistees.js';
import * as MODULE from '../app/langage/attentes-conditionnees-persistees.js';
import { rolesDeLAttente } from '../app/langage/roles-attente.js';
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
import { attentePlate } from './projection-attente.mjs';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(js|html)$/.test(p) ? [p] : []; });
const rel = (f) => f.slice(RACINE.length + 1);
const S2 = 'symbolesDeChaine(chaine)>environnement:conversation(emis)';
const vue = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const CANON = [['bonjour', 'merci'], ['salut', 'oui'], ['salut', 'oui']];
const INTERDITS = /succ[eè]s|[ée]chec|r[ée]ussite|meilleur|score|habitude|r[eè]gle|r[ée]gularit|strat[ée]gi|m[eê]me rapport|cat[ée]gorie/i;

// ---------------------------------------------------------------------------------------------------------------- vécu réel
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
  return { magasin, tour, emettre, tick };
}
async function histoire(paires, present) {
  const w = monde();
  for (const [x, y] of paires) { const E = await w.emettre(x); await w.tour(y, E.id); await w.tick(2); }
  const E = await w.emettre(present);
  return { w, E };
}
// Ce que fait le pont Diagnostic de main.js (mêmes tables, mêmes appels).
async function pontAvant(magasin) {
  const [lignes, designations, emissions, observations] = await Promise.all([magasin.lireTout('attentesProspectives'), magasin.lireTout('designations'), magasin.lireTout('emissions'), magasin.lireTout('observationsPossibilites')]);
  return relireAttentesConditionnees(lignes, { designations, emissions, observations });
}
async function pontAujourdhui(magasin) {
  const [lignes, contextes] = await Promise.all([magasin.lireTout('attentesProspectives'), magasin.lireTout('contextesProspectifs')]);
  return relireIssuesAujourdhui(lignes, contextes, await lireExecutionsVecues(magasin));
}
const conditionneesPersistees = async (magasin) => (await magasin.lireTout('attentesProspectives')).filter((l) => Object.hasOwn(rolesDeLAttente(l).preuve, 'fondation'));
const instantane = async (magasin) => { const o = {}; for (const t of TABLES) o[t] = JSON.stringify(await magasin.lireTout(t)); return o; };
// L'attente conditionnée S2 de l'émission présente E (valeurs.arrivee), sortie de la vue.
const attenteS2 = (sortie, E) => sortie.attentes.filter((x) => x.acte.idActe === E.id && vue(x.avantIssue.relation.domaine) === S2);
async function redemarrer(w) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t)));
  const magasin = magasinMemoireVive();
  await magasin.remplacerTout(donnees);
  return magasin;
}

// ================================================================================================================ H1 vrai flux
test('H1. VRAI FLUX : chaque attente conditionnée persistée apparaît UNE fois, dans l\'ordre de la table ; actes retrouvés dans observations (soi:tour), designations (soi:*, origine) et emissions (conversation) ; opération recopiée', async () => {
  const { w, E } = await histoire(CANON, 'salut');
  const persistees = await conditionneesPersistees(w.magasin);
  const sortie = await pontAvant(w.magasin);
  assert.ok(persistees.length >= 5, `vécu suffisant (${persistees.length})`);
  assert.deepEqual(sortie.attentes.map((x) => x.occurrence.idAttente), persistees.map((l) => l.id), 'toutes, une fois, ordre de la table');
  assert.deepEqual(sortie.illisibles, []);
  const tables = new Set(sortie.attentes.map((x) => x.acte.table));
  for (const t of ['observations', 'designations', 'emissions']) assert.ok(tables.has(t), t);
  for (const x of sortie.attentes) {
    const l = persistees.find((p) => p.id === x.occurrence.idAttente);
    assert.equal(x.acte.idActe, l.references.idDesignation);
    assert.equal(x.acte.operation, l.description.structure.at(-1).operation);
    assert.deepEqual(x.occurrence, { idAttente: l.id, horodatage: l.horodatage, idObservation: l.idObservation });
    if (x.acte.table === 'observations') assert.equal(x.acte.operation, 'soi:tour');
    if (x.acte.table === 'designations') { assert.match(x.acte.operation, /^soi:/); assert.equal(typeof x.acte.origine, 'string'); }
    if (x.acte.table === 'emissions') { assert.equal(x.acte.environnement, 'conversation'); assert.equal(x.acte.operation, 'environnement:conversation'); }
    assert.deepEqual(Object.keys(x), ['occurrence', 'acte', 'avantIssue']);
    assert.equal(x.avantIssue.statut, 'ecrit-avant-issue');
  }
  assert.equal(attenteS2(sortie, E).length, 1, 'l\'attente S2 de l\'émission présente est visible');
  // une attente NON conditionnée (.74) n'apparaît jamais
  const toutes = await w.magasin.lireTout('attentesProspectives');
  assert.ok(toutes.length > persistees.length);
});

// ================================================================================================================ H2 copie exacte
test('H2. COPIE EXACTE : relation, chemin, constat, fondation = la ligne persistée (rolesDeLAttente) ; sans aucune table d\'acte, la partie avant issue est identique (seule la provenance devient « aucune »)', async () => {
  const { w } = await histoire(CANON, 'salut');
  const persistees = await conditionneesPersistees(w.magasin);
  const sortie = await pontAvant(w.magasin);
  for (const x of sortie.attentes) {
    const r = rolesDeLAttente(persistees.find((p) => p.id === x.occurrence.idAttente));
    assert.deepEqual(x.avantIssue.relation, r.description.relation);
    assert.deepEqual(x.avantIssue.chemin, r.description.chemin);
    assert.deepEqual(x.avantIssue.constat, r.description.constat);
    assert.deepEqual(x.avantIssue.fondation.map(({ temoinUnique, ...f }) => f), r.preuve.fondation);
    assert.equal(x.avantIssue.idContexte, r.references.idContexte);
    assert.equal(Object.hasOwn(x.avantIssue, 'relationAbsente'), false);
  }
  const sansActes = relireAttentesConditionnees(await w.magasin.lireTout('attentesProspectives'), { designations: [], emissions: [], observations: [] });
  assert.deepEqual(sansActes.attentes.map((x) => x.avantIssue), sortie.attentes.map((x) => x.avantIssue));
  assert.ok(sansActes.attentes.every((x) => x.acte.table === 'aucune'));
  // la fonction AVANT n'a que deux paramètres : ni vécu, ni contextes
  assert.equal(relireAttentesConditionnees.length, 2);
  assert.equal(relireIssuesAujourdhui.length, 3);
});

// ================================================================================================================ H3 aucun recalcul
test('H3. AUCUN RECALCUL : après K0, une réponse contraire puis de nouveaux épisodes → partie avant issue STRICTEMENT identique ; seule l\'issue relue aujourd\'hui change', async () => {
  const { w, E } = await histoire(CANON, 'salut');
  const avant = await pontAvant(w.magasin);
  const [x] = attenteS2(avant, E);
  assert.deepEqual(x.avantIssue.relation.attendu, { valeurs: { arrivee: 'oui' } });
  const issuesK0 = (await pontAujourdhui(w.magasin)).find((i) => i.idAttente === x.occurrence.idAttente);
  assert.deepEqual(issuesK0.aujourdhui, { issues: [] });
  await w.tour('non', E.id); await w.tick(2);
  await w.emettre('salut');
  const apres = await pontAvant(w.magasin);
  const memes = apres.attentes.filter((y) => avant.attentes.some((z) => z.occurrence.idAttente === y.occurrence.idAttente));
  assert.deepEqual(memes, avant.attentes, 'aucune entrée antérieure n\'est réécrite');
  const issuesK1 = (await pontAujourdhui(w.magasin)).find((i) => i.idAttente === x.occurrence.idAttente);
  assert.equal(issuesK1.aujourdhui.issues.length, 1);
  assert.equal(issuesK1.aujourdhui.issues[0].statut, 'autre');
  assert.deepEqual(issuesK1.aujourdhui.issues[0].reel, { type: 'chaine', valeur: 'non' });
});

// ================================================================================================================ H4 issues
test('H4. ISSUES (autorité existante, sans agrégation) : oui → realisee ; non → autre ; aucune réponse → issues [] (sans issue) ; deux réponses → deux issues', async () => {
  for (const [reponses, attendus] of [[['oui'], ['realisee']], [['non'], ['autre']], [[], []], [['oui', 'non'], ['realisee', 'autre']]]) {
    const { w, E } = await histoire(CANON, 'salut');
    for (const r of reponses) await w.tour(r, E.id);
    const [x] = attenteS2(await pontAvant(w.magasin), E);
    const i = (await pontAujourdhui(w.magasin)).find((y) => y.idAttente === x.occurrence.idAttente);
    assert.deepEqual(i.aujourdhui.issues.map((s) => s.statut).sort(), [...attendus].sort(), reponses.join('+'));
    for (const s of i.aujourdhui.issues) {
      assert.deepEqual(Object.keys(s), ['idExecution', 'horodatageExecution', 'statut', 'reel']);
      assert.equal(typeof s.idExecution, 'string'); assert.equal(typeof s.horodatageExecution, 'string');
    }
  }
  // toutes les attentes conditionnées d'un vécu réel ont une relecture (issues ou erreur locale), dans le même ordre que la partie avant
  const { w } = await histoire(CANON, 'salut');
  const avant = await pontAvant(w.magasin);
  const auj = await pontAujourdhui(w.magasin);
  assert.deepEqual(auj.map((i) => i.idAttente), avant.attentes.map((x) => x.occurrence.idAttente));
  assert.ok(auj.every((i) => Array.isArray(i.aujourdhui.issues) && i.aujourdhui.issues.every((s) => ['realisee', 'autre', 'absente'].includes(s.statut))));
  assert.ok(auj.every((i) => !Object.hasOwn(i.aujourdhui, 'relation') && !Object.hasOwn(i.aujourdhui, 'fondation')), 'aujourd\'hui ne rend ni relation ni fondation');
});

// ================================================================================================================ H5 témoin unique
test('H5. TÉMOIN UNIQUE : couverture 1 → temoinUnique true ; couverture 2 → false (propriété descriptive de la couverture persistée)', async () => {
  const un = await histoire([['bonjour', 'merci'], ['salut', 'oui']], 'salut');
  const [x1] = attenteS2(await pontAvant(un.w.magasin), un.E);
  assert.equal(x1.avantIssue.fondation.length, 1);
  assert.equal(x1.avantIssue.fondation[0].couverture.length, 1);
  assert.equal(x1.avantIssue.fondation[0].temoinUnique, true);
  const deux = await histoire(CANON, 'salut');
  const [x2] = attenteS2(await pontAvant(deux.w.magasin), deux.E);
  assert.equal(x2.avantIssue.fondation[0].couverture.length, 2);
  assert.equal(x2.avantIssue.fondation[0].temoinUnique, false);
});

// ================================================================================================================ H6 lignes anciennes, illisibles
test('H6. LIGNE PLATE .64.1–.64.4 (fondation sans relation) → relation null + relationAbsente, jamais reconstruite ; ligne illisible → illisibles, les autres restent ; ligne non conditionnée → absente', async () => {
  const { w, E } = await histoire(CANON, 'salut');
  const toutes = await w.magasin.lireTout('attentesProspectives');
  const persistees = await conditionneesPersistees(w.magasin);
  const cible = persistees.find((l) => l.references.idDesignation === E.id);
  const { relation, ...ancienne } = attentePlate(cible);
  assert.ok(relation);
  const lignes = [...toutes.map((l) => (l.id === cible.id ? ancienne : l)), { id: 'attente-illisible', inconnue: 1 }, 7];
  const actes = { designations: await w.magasin.lireTout('designations'), emissions: await w.magasin.lireTout('emissions'), observations: await w.magasin.lireTout('observationsPossibilites') };
  const sortie = relireAttentesConditionnees(lignes, actes);
  const x = sortie.attentes.find((y) => y.occurrence.idAttente === cible.id);
  assert.equal(x.avantIssue.relation, null);
  assert.equal(x.avantIssue.relationAbsente, 'ligne-anterieure-a-la-relation');
  assert.deepEqual(x.avantIssue.fondation.map(({ temoinUnique, ...f }) => f), cible.preuve.fondation);
  assert.equal(sortie.attentes.length, persistees.length);
  assert.deepEqual(sortie.illisibles.map((i) => [i.rang, i.idAttente]), [[toutes.length, 'attente-illisible'], [toutes.length + 1, null]]);
  assert.ok(sortie.illisibles.every((i) => typeof i.erreur === 'string' && i.erreur.length > 0));
  // la relecture d'aujourd'hui de la ligne ancienne passe par la même autorité (lecture compatible des deux formes)
  const auj = relireIssuesAujourdhui(lignes, await w.magasin.lireTout('contextesProspectifs'), await lireExecutionsVecues(w.magasin));
  assert.deepEqual(auj.find((i) => i.idAttente === cible.id).aujourdhui, { issues: [] });
});

// ================================================================================================================ H7 ni fusion ni tri
test('H7. NI FUSION NI TRI : deux attentes de relation identique restent deux entrées ; table inversée → mêmes entrées, dans l\'ordre reçu', async () => {
  const { w } = await histoire(CANON, 'salut');
  const sortie = await pontAvant(w.magasin);
  const cles = sortie.attentes.map((x) => JSON.stringify(x.avantIssue.relation));
  assert.ok(cles.some((c, i) => cles.indexOf(c) !== i), 'au moins deux relations identiques dans le vécu réel');
  assert.equal(new Set(sortie.attentes.map((x) => x.occurrence.idAttente)).size, sortie.attentes.length);
  const actes = { designations: await w.magasin.lireTout('designations'), emissions: await w.magasin.lireTout('emissions'), observations: await w.magasin.lireTout('observationsPossibilites') };
  const inverse = relireAttentesConditionnees([...(await w.magasin.lireTout('attentesProspectives'))].reverse(), actes);
  assert.deepEqual(inverse.attentes, [...sortie.attentes].reverse());
});

// ================================================================================================================ H8 introuvables
test('H8. ACTE INTROUVABLE → table « aucune », attente affichée ; CONTEXTE INTROUVABLE → erreur pour cette seule attente', async () => {
  const { w, E } = await histoire(CANON, 'salut');
  const lignes = await w.magasin.lireTout('attentesProspectives');
  const emissions = (await w.magasin.lireTout('emissions')).filter((m) => m.id !== E.id);
  const sortie = relireAttentesConditionnees(lignes, { designations: await w.magasin.lireTout('designations'), emissions, observations: await w.magasin.lireTout('observationsPossibilites') });
  const [x] = sortie.attentes.filter((y) => y.acte.idActe === E.id && y.avantIssue.relation && vue(y.avantIssue.relation.domaine) === S2);
  assert.deepEqual(x.acte, { idActe: E.id, table: 'aucune', operation: 'environnement:conversation' });
  const contextes = (await w.magasin.lireTout('contextesProspectifs')).filter((c) => c.id !== x.avantIssue.idContexte);
  const auj = relireIssuesAujourdhui(lignes, contextes, await lireExecutionsVecues(w.magasin));
  const touchees = auj.filter((i) => Object.hasOwn(i.aujourdhui, 'erreur'));
  assert.ok(touchees.some((i) => i.idAttente === x.occurrence.idAttente && i.aujourdhui.erreur === 'contexte introuvable'));
  assert.ok(touchees.every((i) => sortie.attentes.find((y) => y.occurrence.idAttente === i.idAttente).avantIssue.idContexte === x.avantIssue.idContexte));
  assert.ok(auj.some((i) => Array.isArray(i.aujourdhui.issues)), 'les autres continuent');
  // entrées hors contrat : TypeError
  assert.throws(() => relireAttentesConditionnees(null, { designations: [], emissions: [], observations: [] }), TypeError);
  assert.throws(() => relireAttentesConditionnees([], { designations: [], emissions: [], autre: [] }), TypeError);
  assert.throws(() => relireIssuesAujourdhui([], [], {}), TypeError);
});

// ================================================================================================================ H9 redémarrage
test('H9. REDÉMARRAGE : la partie avant issue est identique octet pour octet ; l\'issue relue aussi', async () => {
  const { w } = await histoire(CANON, 'salut');
  await w.tour('oui', (await w.magasin.lireTout('emissions')).at(-1).id);
  const avant = JSON.stringify(await pontAvant(w.magasin));
  const auj = JSON.stringify(await pontAujourdhui(w.magasin));
  const m2 = await redemarrer(w);
  assert.equal(JSON.stringify(await pontAvant(m2)), avant);
  assert.equal(JSON.stringify(await pontAujourdhui(m2)), auj);
});

// ================================================================================================================ H10 pureté et gardes
test('H10a. PURETÉ : instantané de TOUTES les tables identique avant/après les deux lectures ; entrées gelées acceptées et intactes', async () => {
  const { w, E } = await histoire(CANON, 'salut');
  await w.tour('oui', E.id);
  const avant = await instantane(w.magasin);
  await pontAvant(w.magasin); await pontAujourdhui(w.magasin); await pontAvant(w.magasin);
  assert.deepEqual(await instantane(w.magasin), avant);
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const lignes = gel(await w.magasin.lireTout('attentesProspectives'));
  const actes = gel({ designations: await w.magasin.lireTout('designations'), emissions: await w.magasin.lireTout('emissions'), observations: await w.magasin.lireTout('observationsPossibilites') });
  const s = JSON.stringify(lignes);
  const r = relireAttentesConditionnees(lignes, actes);
  relireIssuesAujourdhui(lignes, gel(await w.magasin.lireTout('contextesProspectifs')), gel(await lireExecutionsVecues(w.magasin)));
  assert.equal(JSON.stringify(lignes), s);
  r.attentes[0].avantIssue.fondation[0].couverture.push('x');
  assert.equal(JSON.stringify(lignes), s, 'sortie neuve, rien n\'est partagé');
});

test('H10b. GARDES STATIQUES : deux exports ; imports exacts ; aucune lecture, écriture, horloge, hasard, tri ; vocabulaire interdit absent ; seul main.js (pont Diagnostic) importe le module ; la conversation, le lot, la résolution et la production des attentes ne le nomment pas ; dormances inchangées', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['relireAttentesConditionnees', 'relireIssuesAujourdhui']);
  const src = lu('app', 'langage', 'attentes-conditionnees-persistees.js');
  const code = sansCommentaires(src);
  assert.deepEqual([...code.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]), ['./roles-attente.js', './issue-attente-prospective.js']);
  assert.doesNotMatch(code, /lireTout|ecrire|enregistrer|magasin\.|new Date|Date\.|Math\.random|setTimeout|fetch|localStorage|indexedDB|\.sort\(|nouvelId/);
  assert.doesNotMatch(code, INTERDITS);
  // importeurs : main.js seulement, et seulement dans son pont Diagnostic
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => /attentes-conditionnees-persistees|relireAttentesConditionnees|relireIssuesAujourdhui/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(nommant, ['app/langage/attentes-conditionnees-persistees.js', 'app/main.js']);
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.equal((main.match(/relireAttentesConditionnees\(/g) || []).length, 1);
  assert.equal((main.match(/relireIssuesAujourdhui\(/g) || []).length, 1);
  assert.equal((main.match(/lireExecutionsVecues\(/g) || []).length, 1, 'le vécu actuel n\'est lu que pour la relecture des issues');
  const i = main.indexOf('attentesConditionnees: async () => {'); const j = main.indexOf('return relireIssuesAujourdhui(', i);
  assert.ok(i > 0 && j > i && j - i < 1500, 'les deux lectures sont dans un seul bloc du pont');
  const pont = main.slice(i, main.indexOf('\n', j));
  assert.doesNotMatch(pont, /ecrire|enregistrer|apprendre|examiner|traiter|emettre|executer|tourActif|tickPropre/);
  for (const zone of ['async function traiterTour(', 'function proposerResolution(', 'async function notesDesAppuis(']) {
    const k = main.indexOf(zone); assert.ok(k >= 0, zone);
    assert.doesNotMatch(main.slice(k, k + 4000), /attentesConditionnees|issuesAujourdhui|relireAttentes|relireIssues/, zone);
  }
  // l'écran : un seul appel de chaque, hors de rafraichirCapacite ; aucune autre lecture
  const ui = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  assert.equal((ui.match(/capacite\.attentesConditionnees\(/g) || []).length, 1);
  assert.equal((ui.match(/capacite\.issuesAujourdhui\(/g) || []).length, 1);
  const raf = ui.slice(ui.indexOf('async function rafraichirCapacite('), ui.indexOf('function zoneEmissions('));
  assert.doesNotMatch(raf, /attentesConditionnees|issuesAujourdhui|creerSectionAttentesConditionnees/);
  const bloc = ui.slice(ui.indexOf('const TABLE_ACTE_TEXTE'), ui.indexOf('async function rafraichirCapacite('));
  assert.doesNotMatch(bloc, INTERDITS);
  assert.doesNotMatch(bloc, /\.sort\(|ecrire|enregistrer/);
  // mécanismes vivants et dormances
  for (const f of ['execution-mecanique', 'execution-sollicitee', 'environnement-conversation', 'capacite', 'prospection-soi', 'attentes-conditionnees', 'attentes-prospectives', 'resolutions', 'pont', 'episode-propre', 'tick-propre', 'contexte-sollicitation', 'attentes-du-tour']) {
    assert.doesNotMatch(lu('app', 'langage', `${f}.js`), /attentes-conditionnees-persistees|relireAttentesConditionnees|relireIssuesAujourdhui/, f);
  }
  for (const dormant of ['experiences-attentes', 'confrontations-attentes']) {
    assert.deepEqual(fichiersJs(join(RACINE, 'app')).filter((f) => new RegExp(`from '\\./(langage/)?${dormant}\\.js'`).test(readFileSync(f, 'utf8'))).map(rel), [], dormant);
  }
});

// ================================================================================================================ H11 écran
class Faux {
  get parentNode() { return this.parent; }
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.attrs = {}; this.open = false; }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c, ref) { if (c.parent) c.remove(); c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(sel) { const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, '')); const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; }; return parcourir(this); }
}
const textes = (e) => [e.textContent, ...e.children.flatMap(textes)].filter(Boolean);
const trouver = (e, f) => (f(e) ? e : e.children.map((c) => trouver(c, f)).find(Boolean) || null);
async function ecranAvec(capacite) {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  globalThis.window = globalThis;
  const { monterConversation } = await import('../app/conversation/ecran.js');
  const page = new Faux('main'); const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  page.append(liste, formulaire);
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: async () => ({ texte: 'ok' }), capacite });
  await conv.recharger();
  const zone = page.children.find((c) => c._cls.has('diagnostic'));
  const section = trouver(zone, (e) => e._cls.has('attentes-conditionnees-zone'));
  return { page, liste, zone, section };
}
const TITRE = 'Attentes conditionnées écrites avant leur issue';

test('H11. ÉCRAN : section repliée dans le Diagnostic, rien n\'est lu avant son ouverture ; dépliée : ÉCRIT AVANT L\'ISSUE seul ; le bloc RELU AUJOURD\'HUI n\'apparaît qu\'après le geste ; témoin unique explicite ; aucune ligne dans la conversation ; vocabulaire interdit absent', async () => {
  const un = await histoire([['bonjour', 'merci'], ['salut', 'oui']], 'salut');
  await un.w.tour('oui', un.E.id);
  const appels = { avant: 0, aujourdhui: 0 };
  const capacite = { lire: async () => ({ valeur: 3, plafond: 3, derniere: null, besoins: [] }), repos: async () => ({}), attentesConditionnees: async () => { appels.avant += 1; return pontAvant(un.w.magasin); }, issuesAujourdhui: async () => { appels.aujourdhui += 1; return pontAujourdhui(un.w.magasin); } };
  const { liste, zone, section } = await ecranAvec(capacite);
  assert.ok(section, 'section montée');
  assert.equal(section.tag, 'details');
  assert.ok(textes(zone).includes(TITRE));
  assert.deepEqual(appels, { avant: 0, aujourdhui: 0 }, 'rien n\'est lu tant que la section est fermée (ni au montage ni au rafraîchissement)');
  section.open = true;
  await Promise.all(section.listeners.toggle.map((f) => f()));
  assert.deepEqual(appels, { avant: 1, aujourdhui: 0 }, 'l\'ouverture ne relit pas les issues');
  const t = textes(section);
  assert.ok(t.some((x) => /^ÉCRIT AVANT L'ISSUE — persisté le \d{4}-\d\d-\d\d \d\d:\d\d:\d\d, relu tel quel$/.test(x)));
  assert.ok(t.some((x) => x.startsWith('relation persistée : domaine symbolesDeChaine(chaine) > environnement:conversation(emis) · connu { valeurs: { depart: « salut » } } · attendu { valeurs: { arrivee: « oui » } }')));
  assert.ok(t.includes('fondation : 1 seul épisode antérieur dans cette fondation (témoin unique)'));
  assert.ok(t.some((x) => x.startsWith('  conditions : valeurs › depart = chaine "salut"')));
  assert.ok(t.some((x) => x.startsWith('  témoins : ')));
  assert.ok(t.some((x) => / · environnement:conversation · \{ valeurs: \{ depart: « salut » \} \} → \{ valeurs: \{ arrivee: « oui » \} \} · témoin unique$/.test(x)), 'résumé replié');
  assert.ok(!t.some((x) => /RELU AUJOURD'HUI/.test(x)), 'bloc 2 absent avant le geste');
  const boutonRelire = trouver(section, (e) => e.tag === 'button' && e.textContent === 'Relire les issues aujourd\'hui');
  assert.ok(boutonRelire);
  await Promise.all(boutonRelire.listeners.click.map((f) => f()));
  assert.deepEqual(appels, { avant: 1, aujourdhui: 1 });
  const t2 = textes(section);
  assert.ok(t2.includes('RELU AUJOURD\'HUI — avec le magasin et le code actuels'));
  assert.ok(t2.some((x) => /^issue \(.*\) : réalisée — réel : chaine "oui"$/.test(x)));
  assert.ok(t2.indexOf('RELU AUJOURD\'HUI — avec le magasin et le code actuels') > t2.findIndex((x) => x.startsWith('ÉCRIT AVANT L\'ISSUE')), 'aujourd\'hui sous l\'écrit avant l\'issue');
  assert.doesNotMatch(t2.join('\n'), INTERDITS);
  assert.ok(!textes(liste).some((x) => /AVANT L'ISSUE|RELU AUJOURD'HUI|fondation|témoin/.test(x)), 'rien dans la conversation ordinaire');
  // réouverture : lecture fraîche, le bloc d'aujourd'hui repart absent
  section.open = false; await Promise.all(section.listeners.toggle.map((f) => f()));
  section.open = true; await Promise.all(section.listeners.toggle.map((f) => f()));
  assert.deepEqual(appels, { avant: 2, aujourdhui: 1 });
  assert.ok(!textes(section).some((x) => /RELU AUJOURD'HUI/.test(x)));
  // vide, échec, sans capacité
  const vide = await ecranAvec({ ...capacite, attentesConditionnees: async () => ({ attentes: [], illisibles: [] }) });
  vide.section.open = true; await Promise.all(vide.section.listeners.toggle.map((f) => f()));
  assert.ok(textes(vide.section).includes('aucune attente conditionnée persistée'));
  assert.equal(trouver(vide.section, (e) => e.tag === 'button'), null, 'aucun bouton sans attente');
  const panne = await ecranAvec({ ...capacite, attentesConditionnees: async () => { throw new Error('x'); } });
  panne.section.open = true; await Promise.all(panne.section.listeners.toggle.map((f) => f()));
  assert.ok(textes(panne.section).includes('attentes conditionnées non lisibles : x'));
  const sans = await ecranAvec({ lire: capacite.lire, repos: capacite.repos });
  assert.equal(sans.section, null, 'sans le pont, aucune section');
});

test('H11b. ÉCRAN : plusieurs issues restent plusieurs lignes ; sans issue ; erreur locale ; relation non persistée', async () => {
  const x = (id, relation) => ({ occurrence: { idAttente: id, horodatage: '2026-10-15T10:00:00.000Z', idObservation: 'observation-1' }, acte: { idActe: 'emission-1', table: 'emissions', environnement: 'conversation', operation: 'environnement:conversation' }, avantIssue: { statut: 'ecrit-avant-issue', relation, ...(relation ? {} : { relationAbsente: 'ligne-anterieure-a-la-relation' }), chemin: ['valeurs', 'arrivee'], constat: { type: 'chaine', valeur: 'oui' }, fondation: [{ conditions: [{ chemin: ['valeurs', 'depart'], type: 'chaine', valeur: 'salut' }], couverture: [['a'], ['b']], constats: [], temoinUnique: false }], idContexte: 'c' } });
  const R = { domaine: [{ operation: 'f', entrees: ['e'] }], connu: { valeurs: { depart: 'salut' } }, attendu: { valeurs: { arrivee: 'oui' } } };
  const capacite = {
    lire: async () => ({ valeur: 3, plafond: 3, derniere: null, besoins: [] }), repos: async () => ({}),
    attentesConditionnees: async () => ({ attentes: [x('A', R), x('B', null), x('C', R)], illisibles: [{ rang: 9, idAttente: null, erreur: 'forme' }] }),
    issuesAujourdhui: async () => [
      { idAttente: 'A', aujourdhui: { issues: [{ idExecution: 'e1', horodatageExecution: '2026-10-15T11:00:00.000Z', statut: 'realisee', reel: { type: 'chaine', valeur: 'oui' } }, { idExecution: 'e2', horodatageExecution: '2026-10-15T12:00:00.000Z', statut: 'autre', reel: { type: 'chaine', valeur: 'non' } }, { idExecution: 'e3', horodatageExecution: null, statut: 'absente' }] } },
      { idAttente: 'B', aujourdhui: { issues: [] } },
      { idAttente: 'C', aujourdhui: { erreur: 'contexte introuvable' } },
    ],
  };
  const { section } = await ecranAvec(capacite);
  section.open = true; await Promise.all(section.listeners.toggle.map((f) => f()));
  assert.ok(textes(section).includes('relation non persistée (ligne écrite avant v0.64.5)'));
  assert.ok(textes(section).includes('fondation : 2 épisodes antérieurs'));
  assert.ok(textes(section).includes('ligne illisible (rang 9) : forme'));
  await Promise.all(trouver(section, (e) => e.tag === 'button').listeners.click.map((f) => f()));
  const t = textes(section);
  assert.ok(t.includes('issue (2026-10-15 11:00:00, exécution e1) : réalisée — réel : chaine "oui"'));
  assert.ok(t.includes('issue (2026-10-15 12:00:00, exécution e2) : autre — réel : chaine "non"'));
  assert.ok(t.includes('issue (?, exécution e3) : absente'));
  assert.ok(t.includes('sans issue'));
  assert.ok(t.includes('relecture non calculable : contexte introuvable'));
  assert.equal(t.filter((l) => l === 'RELU AUJOURD\'HUI — avec le magasin et le code actuels').length, 3);
  assert.doesNotMatch(t.join('\n'), INTERDITS);
});

// ================================================================================================================ H12 horodatages
test('H12. HORODATAGES INFORMATIFS SEULEMENT : aucune comparaison dans le module ni dans l\'écran ; changer l\'horodatage d\'une issue (même avant K0) ou d\'une attente ne change ni la sélection, ni le statut, ni la partie avant issue', async () => {
  const code = sansCommentaires(lu('app', 'langage', 'attentes-conditionnees-persistees.js'));
  const ui = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  const bloc = ui.slice(ui.indexOf('const TABLE_ACTE_TEXTE'), ui.indexOf('async function rafraichirCapacite('));
  for (const s of [code, bloc]) assert.doesNotMatch(s, /horodatage\w*\s*(<|>|<=|>=|===|!==|==|!=)|(<|>|<=|>=|===|!==|==|!=)\s*[\w.]*horodatage/i);
  const { w, E } = await histoire(CANON, 'salut');
  await w.tour('oui', E.id);
  const lignes = await w.magasin.lireTout('attentesProspectives');
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  const vecu = await lireExecutionsVecues(w.magasin);
  const actes = { designations: await w.magasin.lireTout('designations'), emissions: await w.magasin.lireTout('emissions'), observations: await w.magasin.lireTout('observationsPossibilites') };
  const ref = relireIssuesAujourdhui(lignes, contextes, vecu);
  const vieux = { ...vecu, executions: vecu.executions.map((e) => ({ ...e, horodatage: '2000-01-01T00:00:00.000Z' })) };
  const modifie = relireIssuesAujourdhui(lignes, contextes, vieux);
  const sansHeure = (r) => r.map((i) => ({ ...i, aujourdhui: i.aujourdhui.issues ? { issues: i.aujourdhui.issues.map(({ horodatageExecution, ...s }) => s) } : i.aujourdhui }));
  assert.deepEqual(sansHeure(modifie), sansHeure(ref));
  assert.ok(modifie.flatMap((i) => i.aujourdhui.issues || []).every((s) => s.horodatageExecution === null || s.horodatageExecution === '2000-01-01T00:00:00.000Z'));
  const futur = lignes.map((l) => ({ ...l, horodatage: '2099-01-01T00:00:00.000Z' }));
  const a1 = relireAttentesConditionnees(lignes, actes); const a2 = relireAttentesConditionnees(futur, actes);
  assert.deepEqual(a2.attentes.map((x) => [x.occurrence.idAttente, x.acte, x.avantIssue]), a1.attentes.map((x) => [x.occurrence.idAttente, x.acte, x.avantIssue]));
});
