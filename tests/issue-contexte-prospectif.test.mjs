// v0.63.73 — issueDuContexteProspectif : confronter un contexte prospectif figé à son issue réelle (décision ChatGPT, 07/10/2026). Preuves : « avant » lu exclusivement dans la
// ligne persistée, « après » reconstruit depuis executionsOperations ; ancrage et unicité de l'épisode réel (58 contextes réels, 93 de la sonde) ; sans issue = rien d'autre ;
// chemins retrouvé / nouveau / absent par les primitives du producteur de constats (égalité exportée memesConstats) ; conteneurs et identités futures sans sémantique ;
// cas central (histoire vide à T2, egale ×1…×5 figés ensuite) ; cas 6/1 ; histoire vide avec issue ; projections multiples ; échec après contexte ; immutabilité ; déterminisme ;
// vue pure sans table ; comportement vivant inchangé ; dormance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/issue-contexte-prospectif.js';
import { issueDuContexteProspectif, STATUTS_CHEMIN } from '../app/langage/issue-contexte-prospectif.js';
import * as moduleConstats from '../app/langage/constats-structurels.js';
import { memesConstats, produireConstatsStructurels } from '../app/langage/constats-structurels.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js'; // MISE À JOUR DÉLIBÉRÉE v0.63.77 : construction du losange (C4)
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'issue-contexte-prospectif.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^issueDuContexteProspectif : /.test(e.message));
const T = 'contextesProspectifs';
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
const ch = { forme: 'scalaire', genre: 'chaine' };
const coll = { forme: 'collection', elements: ch };
const DESC = [
  { nom: 'transformer', entrees: { x: ch }, sortie: ch },
  { nom: 'eclater', entrees: { x: ch }, sortie: coll },
  { nom: 'recoller', entrees: { elements: coll }, sortie: ch },
];
const msg = (id, valeur) => ({ id, valeur });
const lien = (entree, donnee) => ({ entree, donnee });
const ex = (id, operation, liaisons, resultat, idDesignation = `d-${id}`) => ({ id, horodatage: 1, idDesignation, operation, liaisons, resultat });
// Histoire synthétique : n expériences m_k -> eclater -> R_k -> recoller -> S_k (revenue), plus R_{n+1} à composer ; le contexte est FIGÉ avant S_{n+1}.
function monde(n, { relations = [] } = {}) {
  const M = []; const E = [];
  for (let k = 1; k <= n; k += 1) { M.push(msg(`m${k}`, `v${k}`)); E.push(ex(`R${k}`, 'eclater', [lien('x', `m${k}`)], ['v', String(k)]), ex(`S${k}`, 'recoller', [lien('elements', `R${k}`)], relations[k - 1] === 'differente' ? 'autre' : `v${k}`)); }
  M.push(msg(`m${n + 1}`, `v${n + 1}`)); E.push(ex(`R${n + 1}`, 'eclater', [lien('x', `m${n + 1}`)], ['v', String(n + 1)]));
  const application = { operation: 'recoller', liaisons: [lien('elements', `R${n + 1}`)] };
  const contextes = contextesProspectifs(application, M, E, DESC).map((c, i) => ({ id: `contexte-prospectif-${i}`, horodatage: 'h', idDesignation: `d-S${n + 1}`, idObservation: 'o', ...c }));
  return { M, E, application, contextes, direct: contextes.find((c) => c.parent === null), prolongement: contextes.find((c) => c.parent !== null) };
}
const chemin = (issue, ...segments) => issue.chemins.find((c) => c.chemin.length === segments.length && c.chemin.every((s, i) => s === segments[i]));

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. exports : issueDuContexteProspectif (4 paramètres, synchrone) et STATUTS_CHEMIN = retrouve / nouveau / absent ; memesConstats exportée du producteur sans autre changement', () => {
  assert.deepEqual(Object.keys(module).sort(), ['STATUTS_CHEMIN', 'issueDuContexteProspectif']);
  assert.equal(issueDuContexteProspectif.length, 4);
  assert.equal(issueDuContexteProspectif.constructor.name, 'Function');
  assert.deepEqual(STATUTS_CHEMIN, ['retrouve', 'nouveau', 'absent']);
  assert.equal(Object.isFrozen(STATUTS_CHEMIN), true);
  assert.deepEqual(Object.keys(moduleConstats).sort(), ['memesConstats', 'produireConstatsStructurels']);
  assert.equal(memesConstats({ chemin: ['a'], type: 'nombre', valeur: 0 }, { chemin: ['a'], type: 'nombre', valeur: -0 }), false, 'égalité du producteur : 0 et -0 distincts');
  assert.equal(memesConstats({ chemin: ['a'], type: 'objet' }, { chemin: ['a'], type: 'objet' }), true);
  assert.equal(/confirm|contredit|reussi|réussi|echou|échou|correct|attendu(?!e)|prediction|prédiction|majorit|vote|probab|confiance|score|preference|préférence|recompense|récompense/i.test(CODE), false);
  assert.equal(/relationValeur|symbolesDeChaine|composerCollection|'arrivee'|'valeurs'/.test(CODE), false, 'aucun nom de champ ni d\'opération');
});

test('A2. SANS ISSUE : aucune exécution pour la désignation -> { idContexte, idDesignation, issue: null } et rien d\'autre', () => {
  const { M, E, prolongement } = monde(2);
  const r = issueDuContexteProspectif(prolongement, M, E, DESC);
  assert.deepEqual(r, { idContexte: prolongement.id, idDesignation: 'd-S3', issue: null });
  assert.equal('chemins' in r, false);
});

test('A3. ISSUE : l\'épisode réel est retrouvé par (exécution de la désignation, départ, structure) ; projection directe et prolongement retrouvent chacun LEUR épisode', () => {
  const { M, E, direct, prolongement } = monde(2);
  const E2 = [...E, ex('S3', 'recoller', [lien('elements', 'R3')], 'v3', 'd-S3')];
  const p = issueDuContexteProspectif(prolongement, M, E2, DESC);
  const d = issueDuContexteProspectif(direct, M, E2, DESC);
  assert.equal(p.issue.idExecution, 'S3'); assert.equal(d.issue.idExecution, 'S3');
  assert.equal(p.issue.episode.depart, 'm3'); assert.equal(d.issue.episode.depart, 'R3');
  assert.equal(sk(p.issue.episode.chemin.map((e) => ({ operation: e.operation, entrees: e.entrees }))), 'eclater(x)>recoller(elements)');
  assert.equal(sk(d.issue.episode.chemin.map((e) => ({ operation: e.operation, entrees: e.entrees }))), 'recoller(elements)');
  assert.notDeepEqual(p.chemins, d.chemins);
  assert.deepEqual(Object.keys(p), ['idContexte', 'idDesignation', 'issue', 'temoins', 'chemins']);
  assert.deepEqual(p.temoins, prolongement.temoins);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. CHEMINS
test('B1. retrouvé / nouveau sans sémantique : relationValeur réelle egale retrouve le constat egale (témoins figés) ; arrivee réelle S3 est nouvelle face à S1, S2 (constats et témoins historiques conservés)', () => {
  const { M, E, prolongement } = monde(2);
  const E2 = [...E, ex('S3', 'recoller', [lien('elements', 'R3')], 'v3', 'd-S3')];
  const r = issueDuContexteProspectif(prolongement, M, E2, DESC);
  assert.deepEqual(r.chemins.map((c) => [c.chemin.join('.'), c.statut]), [['arrivee', 'nouveau'], ['chemin.1.execution', 'nouveau'], ['chemin.1.vers', 'nouveau'], ['relationValeur', 'retrouve'], ['valeurs', 'retrouve'], ['valeurs.arrivee', 'nouveau'], ['valeurs.depart', 'nouveau']]);
  const rel = chemin(r, 'relationValeur');
  assert.deepEqual(rel.reel, { type: 'chaine', valeur: 'egale' });
  assert.deepEqual(rel.correspondants, [{ type: 'chaine', valeur: 'egale', couverture: [['m1', 'S1', 'R1', 'S1'], ['m2', 'S2', 'R2', 'S2']] }]);
  assert.deepEqual(rel.constats, prolongement.chemins.find((c) => c.chemin[0] === 'relationValeur').constats, 'constats historiques conservés tels quels');
  const arr = chemin(r, 'arrivee');
  assert.deepEqual(arr.reel, { type: 'chaine', valeur: 'S3' });
  assert.deepEqual(arr.correspondants, []);
  assert.deepEqual(arr.constats.map((c) => [c.valeur, c.couverture.length]), [['S1', 1], ['S2', 1]]);
  for (const c of r.chemins) assert.equal(STATUTS_CHEMIN.includes(c.statut), true);
});

test('B2. conteneur : ["valeurs"] objet retrouvé par le même mécanisme (constat sans valeur) ; chemin ABSENT quand l\'issue n\'a pas le chemin (arrivée non comparable) ; aucun constat ABSENT', () => {
  const { M, E, prolongement } = monde(2);
  const E2 = [...E, ex('S3', 'recoller', [lien('elements', 'R3')], 'v3', 'd-S3')];
  const r = issueDuContexteProspectif(prolongement, M, E2, DESC);
  const val = chemin(r, 'valeurs');
  assert.equal(val.statut, 'retrouve'); assert.deepEqual(val.reel, { type: 'objet' }); assert.equal(val.correspondants.length, 1); assert.equal('valeur' in val.correspondants[0], false);
  const descNC = [...DESC.filter((d) => d.nom !== 'recoller'), { nom: 'recoller', entrees: { elements: coll }, sortie: { forme: 'quelconque' } }];
  const E3 = [...E, ex('S3', 'recoller', [lien('elements', 'R3')], ['pas', 'comparable'], 'd-S3')];
  const q = issueDuContexteProspectif(prolongement, M, E3, descNC);
  assert.deepEqual(q.chemins.filter((c) => c.statut === 'absent').map((c) => c.chemin.join('.')), ['valeurs', 'valeurs.arrivee', 'valeurs.depart']);
  const abs = chemin(q, 'valeurs');
  assert.equal('reel' in abs, false); assert.equal('correspondants' in abs, false);
  assert.deepEqual(abs.constats, prolongement.chemins.find((c) => c.chemin[0] === 'valeurs' && c.chemin.length === 1).constats);
  assert.equal(JSON.stringify(q).includes('ABSENT'), false);
  assert.equal(chemin(q, 'relationValeur').statut, 'nouveau', 'non_comparable n\'était pas dans l\'histoire : nouveau');
});

test('B3. CAS 6/1 : histoire figée egale ×6 + differente ×1, issue egale -> retrouve egale avec ses six témoins ; aucune majorité, le constat differente reste listé', () => {
  const { M, E, prolongement } = monde(7, { relations: ['egale', 'egale', 'egale', 'egale', 'egale', 'egale', 'differente'] });
  const E2 = [...E, ex('S8', 'recoller', [lien('elements', 'R8')], 'v8', 'd-S8')];
  const r = issueDuContexteProspectif(prolongement, M, E2, DESC);
  const rel = chemin(r, 'relationValeur');
  assert.equal(rel.statut, 'retrouve');
  assert.deepEqual(rel.correspondants.map((c) => [c.valeur, c.couverture.map((t) => t[0])]), [['egale', ['m1', 'm2', 'm3', 'm4', 'm5', 'm6']]]);
  assert.deepEqual(rel.constats.map((c) => [c.valeur, c.couverture.length]), [['egale', 6], ['differente', 1]]);
  assert.equal(/majorit|attendu|probable/.test(JSON.stringify(r)), false);
  // issue differente : retrouve differente avec son unique témoin
  const E3 = [...E, ex('S8', 'recoller', [lien('elements', 'R8')], 'autre', 'd-S8')];
  const q = issueDuContexteProspectif(prolongement, M, E3, DESC);
  assert.deepEqual(chemin(q, 'relationValeur').correspondants.map((c) => [c.valeur, c.couverture.map((t) => t[0])]), [['differente', ['m7']]]);
});

test('B4. HISTOIRE VIDE : contexte à temoins [] et chemins [] puis issue réelle -> issue présente, temoins [], chemins [] (rien à confronter, le fait reste lisible)', () => {
  const { M, E, direct, prolongement } = monde(0);
  // sans aucune expérience : la projection directe [recoller] et le prolongement [eclater, recoller] ont tous deux une histoire vide
  for (const ctx of [direct, prolongement]) {
    assert.deepEqual([ctx.temoins, ctx.chemins], [[], []]);
    const E2 = [...E, ex('S1', 'recoller', [lien('elements', 'R1')], 'v1', 'd-S1')];
    const r = issueDuContexteProspectif(ctx, M, E2, DESC);
    assert.equal(r.issue.idExecution, 'S1');
    assert.deepEqual([r.temoins, r.chemins], [[], []]);
    assert.equal(r.issue.episode.relationValeur, ctx === prolongement ? 'egale' : 'non_comparable', 'l\'issue existe mais rien n\'était porté');
  }
});

test('B5. ÉCHEC APRÈS CONTEXTE : désignation et contexte sans ligne d\'exécution -> pas d\'issue (ni absent partout, ni chemins) ; plusieurs exécutions pour une désignation -> refus', async () => {
  const { tours, magasin } = await rejouer(['bonjour Pixel']);
  const { observation, univers } = tours[0];
  const message = (await magasin.lireTout('valeursDonnees'))[0];
  const table = { ...TABLE_OPERATIONS, symbolesDeChaine: { ...TABLE_OPERATIONS.symbolesDeChaine, fonction: () => { throw new Error('panne volontaire'); } } };
  const r = await executerApplicationSollicitee({ observation, application: { operation: 'symbolesDeChaine', liaisons: [lien('chaine', message.id)] }, univers }, { magasin, table });
  assert.equal(r.statut, 'echec_invocation');
  const miens = (await magasin.lireTout(T)).filter((c) => c.idDesignation === r.designation.id);
  assert.equal(miens.length, 1);
  const V = await magasin.lireTout('valeursDonnees'); const E = await magasin.lireTout('executionsOperations');
  const issue = issueDuContexteProspectif(miens[0], V, E, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(issue, { idContexte: miens[0].id, idDesignation: r.designation.id, issue: null });
  const [c] = await magasin.lireTout(T);
  const double = [...E, { ...E.find((e) => e.idDesignation === c.idDesignation), id: 'execution-dupliquee' }];
  refuse(() => issueDuContexteProspectif(c, V, double, DESCRIPTIONS_OPERATIONS));
});

test('B6. entrées mal formées : TypeError, aucun résultat partiel ; ancrage brisé (aucun épisode correspondant) : refus', () => {
  const { M, E, prolongement } = monde(1);
  const E2 = [...E, ex('S2', 'recoller', [lien('elements', 'R2')], 'v2', 'd-S2')];
  refuse(() => issueDuContexteProspectif(null, M, E2, DESC));
  refuse(() => issueDuContexteProspectif({ ...prolongement, id: '' }, M, E2, DESC));
  refuse(() => issueDuContexteProspectif({ ...prolongement, idDesignation: 3 }, M, E2, DESC));
  refuse(() => issueDuContexteProspectif({ ...prolongement, chemins: 'x' }, M, E2, DESC));
  refuse(() => issueDuContexteProspectif({ ...prolongement, episodePartiel: { depart: 'ailleurs', chemin: [] } }, M, E2, DESC), 'départ sans épisode : ancrage brisé');
  refuse(() => issueDuContexteProspectif({ ...prolongement, structure: [{ operation: 'autre', entrees: ['x'] }] }, M, E2, DESC));
  refuse(() => issueDuContexteProspectif(prolongement, M, 'x', DESC));
  refuse(() => issueDuContexteProspectif({ ...prolongement, chemins: [null] }, M, E2, DESC));
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. FLUX RÉEL
let compteurIds = 0;
async function rejouer(scenario, magasin = magasinMemoireVive(), solliciter = false) {
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const tours = []; const ex2 = () => magasin.lireTout('executionsOperations');
  for (const t of scenario) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex2 }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }));
    const res = await traiterTourAvecEnonce(t, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation; tours.push(s);
    if (solliciter) {
      const { observation, univers } = s; const vals = await magasin.lireTout('valeursDonnees'); const msgId = vals[vals.length - 1].id; const faits = await ex2();
      const soll = async (operation, liaisons) => { const r = await executerApplicationSollicitee({ observation, application: { operation, liaisons }, univers }, { magasin, table: TABLE_OPERATIONS }); assert.equal(r.statut, 'executee'); };
      for (const R of faits.filter((e) => e.operation === 'symbolesDeChaine')) if (!faits.some((e) => e.operation === 'composerCollection' && e.liaisons[0].donnee === R.id) && observation.donneesExaminees.includes(R.id)) await soll('composerCollection', [lien('elements', R.id)]);
      if (!(await ex2()).some((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === msgId)) await soll('symbolesDeChaine', [lien('chaine', msgId)]);
    }
  }
  return { tours, magasin, valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), contextes: await magasin.lireTout(T) };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const compter = (issues) => { const s = { retrouve: 0, nouveau: 0, absent: 0 }; for (const i of issues) if (i.issue) for (const c of i.chemins) s[c.statut] += 1; return s; };

test('C1. SCÉNARIO RÉEL : les 58 contextes ont une issue et retrouvent exactement un épisode ; 21 confrontables (histoire non vide), 37 à histoire vide ; 84 chemins : 21 retrouvés, 63 nouveaux, 0 absent ; comportement vivant inchangé', async () => {
  const { tours, valeurs, executions, contextes } = await rejouer(SCENARIO);
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(executions.length, 19);
  assert.equal(tours.flatMap((s) => s.automatiques).filter((x) => x.statut !== 'executee').length, 0);
  assert.equal(contextes.length, 58);
  const issues = contextes.map((c) => issueDuContexteProspectif(c, valeurs, executions, DESCRIPTIONS_OPERATIONS));
  assert.equal(issues.filter((i) => i.issue).length, 58);
  assert.equal(issues.filter((i) => i.issue && i.temoins.length > 0).length, 21);
  assert.equal(issues.filter((i) => i.issue && i.temoins.length === 0).length, 37);
  assert.deepEqual(compter(issues), { retrouve: 21, nouveau: 63, absent: 0 });
  const parChemin = {};
  for (const i of issues) for (const c of i.chemins) { const k = c.chemin.join('.'); parChemin[k] = parChemin[k] ?? { retrouve: 0, nouveau: 0, absent: 0 }; parChemin[k][c.statut] += 1; }
  assert.deepEqual(parChemin, { arrivee: { retrouve: 0, nouveau: 21, absent: 0 }, 'chemin.0.execution': { retrouve: 0, nouveau: 11, absent: 0 }, 'chemin.0.vers': { retrouve: 0, nouveau: 11, absent: 0 }, relationValeur: { retrouve: 21, nouveau: 0, absent: 0 }, 'chemin.1.execution': { retrouve: 0, nouveau: 10, absent: 0 }, 'chemin.1.vers': { retrouve: 0, nouveau: 10, absent: 0 } });
  // unicité de l'ancrage : pour chaque contexte, exactement un épisode (sinon la vue aurait refusé) ; deux contextes d'une même exécution ont des départs différents
  const parExecution = new Map();
  for (const i of issues) { const k = i.issue.idExecution; if (!parExecution.has(k)) parExecution.set(k, []); parExecution.get(k).push(i.issue.episode.depart + '|' + sk(i.issue.episode.chemin.map((e) => ({ operation: e.operation, entrees: e.entrees })))); }
  for (const [, deps] of parExecution) assert.equal(new Set(deps).size, deps.length);
  // identités réelles : nouvelles ; relationValeur : retrouvée ('non_comparable' dans toutes ces familles)
  for (const i of issues) for (const c of i.chemins) if (c.chemin[0] === 'relationValeur') assert.equal(c.reel.valeur, 'non_comparable');
});

test('C2. CAS CENTRAL (sonde) : T2 histoire vide avec issue ; T3…T7 relationValeur egale RETROUVÉE avec 1, 2, 3, 4, 5 témoins FIGÉS (la famille finale en a 6) ; identités et valeurs nouvelles', async () => {
  const { valeurs, executions, contextes } = await rejouer(['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'], undefined, true);
  const centraux = contextes.filter((c) => sk(c.structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)');
  assert.equal(centraux.length, 6);
  const issues = centraux.map((c) => issueDuContexteProspectif(c, valeurs, executions, DESCRIPTIONS_OPERATIONS));
  assert.equal(issues.every((i) => i.issue), true);
  assert.deepEqual(issues[0].temoins, []); assert.deepEqual(issues[0].chemins, []);
  assert.equal(issues[0].issue.episode.relationValeur, 'egale', 'l\'issue existe et vaut egale, mais rien n\'était porté');
  for (const [k, i] of issues.entries()) {
    if (k === 0) continue;
    const rel = chemin(i, 'relationValeur');
    assert.equal(rel.statut, 'retrouve');
    assert.deepEqual(rel.reel, { type: 'chaine', valeur: 'egale' });
    assert.deepEqual(rel.correspondants.map((c) => [c.valeur, c.couverture.length]), [['egale', k]]);
    assert.equal(chemin(i, 'arrivee').statut, 'nouveau');
    assert.equal(chemin(i, 'arrivee').constats.length, k);
    assert.equal(chemin(i, 'valeurs', 'depart').statut, 'nouveau');
    assert.equal(chemin(i, 'valeurs').statut, 'retrouve');
  }
  assert.equal(episodesDeTransformation(valeurs, executions, DESCRIPTIONS_OPERATIONS).episodes.filter((e) => e.relationValeur === 'egale').length, 6, 'la famille finale a 6 témoins : jamais utilisée pour enrichir les anciens contextes');
  const toutes = contextes.map((c) => issueDuContexteProspectif(c, valeurs, executions, DESCRIPTIONS_OPERATIONS));
  assert.equal(toutes.filter((i) => i.issue).length, 93);
  assert.deepEqual(compter(toutes), { retrouve: 61, nouveau: 178, absent: 0 });
});

test('C3. IMMUTABILITÉ et DÉTERMINISME : rejouer des tours après l\'issue ne change pas l\'issue d\'un ancien contexte ; appels répétés identiques ; entrées intactes', async () => {
  const { magasin } = await rejouer(['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel']);
  const avant = { valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations'), contextes: await magasin.lireTout(T) };
  const anciennes = avant.contextes.map((c) => issueDuContexteProspectif(c, avant.valeurs, avant.executions, DESCRIPTIONS_OPERATIONS));
  const fige = JSON.stringify(avant.contextes);
  await rejouer(['bonjour Max', 'bonjour Pixel et Luna'], magasin);
  const apres = { valeurs: await magasin.lireTout('valeursDonnees'), executions: await magasin.lireTout('executionsOperations') };
  assert.ok(apres.executions.length > avant.executions.length);
  const relues = avant.contextes.map((c) => issueDuContexteProspectif(c, apres.valeurs, apres.executions, DESCRIPTIONS_OPERATIONS));
  assert.deepEqual(relues, anciennes);
  assert.equal(JSON.stringify(await magasin.lireTout(T)).startsWith(fige.slice(0, -1)), true, 'les anciennes lignes sont intactes');
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const c0 = gel(structuredClone(avant.contextes[3])); const V = gel(structuredClone(apres.valeurs)); const E = gel(structuredClone(apres.executions));
  const a = issueDuContexteProspectif(c0, V, E, DESCRIPTIONS_OPERATIONS); const b = issueDuContexteProspectif(c0, V, E, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(a, b); assert.notEqual(a, b); assert.notEqual(a.chemins, b.chemins);
  assert.equal(a.temoins === c0.temoins, false);
});

// ---------------------------------------------------------------------------------------------------------------------------------- D. PURETÉ / DORMANCE / SANS TABLE
// MISE À JOUR DÉLIBÉRÉE v0.63.77 : ancrage par les identités des étapes connues.
test('C4. LOSANGE : une même donnée traversée deux fois par la même opération (sollicitation extérieure répétée) -> deux épisodes de même (départ, arrivée, structure) ; chaque contexte de prolongement retrouve SON épisode par les identités figées de episodePartiel.chemin', async () => {
  const magasin = magasinMemoireVive();
  await rejouer(['bonjour Pixel', 'bonjour Luna'], magasin);
  // T3 et T4 : l'extérieur sollicite symbolesDeChaine sur la MÊME production P (une chaîne déjà produite, présente dans l'univers), deux fois
  let P = null;
  for (const texte of ['', 'abc']) {
    const { tours } = await rejouer([texte], magasin);
    const { observation, univers } = tours[0];
    const candidates = groupesDeCandidats(observation.possibilites, DESCRIPTIONS_OPERATIONS).find((g) => g.operation === 'symbolesDeChaine').entrees[0].donnees.filter((d) => d.startsWith('execution-operation')).sort();
    P = P ?? candidates[0]; assert.ok(candidates.includes(P));
    const r = await executerApplicationSollicitee({ observation, application: { operation: 'symbolesDeChaine', liaisons: [lien('chaine', P)] }, univers }, { magasin, table: TABLE_OPERATIONS });
    assert.equal(r.statut, 'executee');
  }
  // T5 : elementsObservables (déterminée) prend les deux productions -> losange P -> sDC(T3) -> eO et P -> sDC(T4) -> eO
  await rejouer(['é😀'], magasin);
  const valeurs = await magasin.lireTout('valeursDonnees'); const executions = await magasin.lireTout('executionsOperations'); const contextes = await magasin.lireTout(T);
  const message1 = { id: P };
  const sdc = executions.filter((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === message1.id);
  assert.equal(sdc.length, 2, 'deux exécutions de même structure sur la même donnée');
  const { episodes } = episodesDeTransformation(valeurs, executions, DESCRIPTIONS_OPERATIONS);
  const eO = executions.filter((e) => e.operation === 'elementsObservables').at(-1);
  const losange = episodes.filter((e) => e.depart === message1.id && e.arrivee === eO.id);
  assert.equal(losange.length, 2, 'deux épisodes réels indiscernables par (départ, arrivée, structure)');
  // les contextes de prolongement de eO dont le départ est message1 : un par parent, chacun retrouve l\'épisode qui passe par SON exécution connue
  const prolongements = contextes.filter((c) => c.idDesignation === eO.idDesignation && c.parent !== null && c.episodePartiel.depart === message1.id);
  assert.equal(prolongements.length, 2);
  for (const c of prolongements) {
    const issue = issueDuContexteProspectif(c, valeurs, executions, DESCRIPTIONS_OPERATIONS);
    assert.notEqual(issue.issue, null);
    assert.equal(issue.issue.episode.chemin[0].execution, c.episodePartiel.chemin[0].execution);
    assert.equal(issue.issue.episode.chemin[0].vers, c.episodePartiel.chemin[0].vers);
  }
  assert.notEqual(prolongements[0].episodePartiel.chemin[0].execution, prolongements[1].episodePartiel.chemin[0].execution);
  // un contexte dont les identités connues ne correspondent à aucun épisode : refus (l\'ancrage ne tient plus), jamais un épisode « le plus proche »
  const faux = structuredClone(prolongements[0]); faux.episodePartiel.chemin[0].execution = 'execution-inexistante';
  assert.throws(() => issueDuContexteProspectif(faux, valeurs, executions, DESCRIPTIONS_OPERATIONS), (e) => e instanceof TypeError && /0 épisode/.test(e.message));
});

test('D1. vue pure, aucune table : VERSION_BASE 20, SCHEMA 10, 23 tables inchangés ; imports exacts ; ni écriture, horloge, hasard, état', () => {
  assert.equal(VERSION_BASE, 22); assert.equal(SCHEMA_SAUVEGARDE, 12); assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./constats-structurels.js', './couverture-occurrences.js', './episodes-de-transformation.js', './parcours-structure.js']);
  for (const motif of [/\bDate\b/, /Math\.random/, /\bawait\b/, /\basync\b/, /\bPromise\b/, /\blocalStorage\b/, /\.ecrire|\.lireTout|magasin|nouvelId/, /invoquerOperation|TABLE_OPERATIONS/, /famillesDEpisodes|constatsParChemin|contextesProspectifs\(/]) assert.equal(motif.test(CODE), false, String(motif));
  assert.equal(/\b(let|var)\b[^;]*=\s*(\[\]|\{\}|new (Map|Set))/.test(CODE.split('export function')[0]), false);
  assert.equal(/Object\.is|typeof .*=== 'number'|\.valeur ===/.test(CODE), false, 'l\'égalité des constats n\'est pas réimplémentée : memesConstats');
});

test('D2. DORMANCE : aucun fichier de app/ n\'importe ni ne nomme la vue ; aucun mécanisme de choix ou d\'exécution ne lit une issue', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    const src = readFileSync(f, 'utf8');
    if (f === join(RACINE, 'app', 'langage', 'issue-attente-prospective.js')) continue; // MISE À JOUR DÉLIBÉRÉE v0.63.75 : issue-attente-prospective.js (vue pure dormante) compose cette vue pour retrouver le chemin engagé dans l'issue du contexte précis
    if (f === join(RACINE, 'app', 'langage', 'attentes-prospectives.js')) continue; // MISE À JOUR DÉLIBÉRÉE v0.63.74 : attentes-prospectives.js (calcul pur, appelé avant l'issue) compose cette vue pour établir B : elle n'est plus dormante
    if (f === join(RACINE, 'app', 'langage', 'constats-structurels.js')) { assert.equal(/from '\.\/issue-contexte-prospectif\.js'/.test(src), false); continue; } // nomme la vue en commentaire (export memesConstats)
    assert.equal(/issue-contexte-prospectif|issueDuContexteProspectif|STATUTS_CHEMIN/.test(src), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/issue-contexte-prospectif/.test(s), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
  void produireConstatsStructurels;
});
