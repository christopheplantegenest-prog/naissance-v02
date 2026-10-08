// v0.63.75 — issueDeLAttenteProspective : issue d'une attente prospective (décision ChatGPT, 08/10/2026). Preuves : vue pure sans table ; « avant » = attente figée seule, « après » =
// issueDuContexteProspectif du contexte référencé ; sans issue = rien de plus ; realisee / autre / absente par memesConstats ; conteneurs ; cas central ; identités (attendu X, réel
// Y) ; attente egale puis issue differente (attente inchangée) ; attente puis chemin absent ; attentes multiples confrontées séparément ; témoins conservés ; immutabilité ;
// scénario réel (28) et sonde (82) ; échec sans issue ; garde anti-sémantique ; dormance ; comportement vivant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/issue-attente-prospective.js';
import { issueDeLAttenteProspective, STATUTS_ATTENTE } from '../app/langage/issue-attente-prospective.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
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
const CHEMIN = join(RACINE, 'app', 'langage', 'issue-attente-prospective.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const sansCommentaires = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^issueDeLAttenteProspective : /.test(e.message));
const TA = 'attentesProspectives'; const TC = 'contextesProspectifs';
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
const ch = { forme: 'scalaire', genre: 'chaine' };
const coll = { forme: 'collection', elements: ch };
const DESC = [{ nom: 'eclater', entrees: { x: ch }, sortie: coll }, { nom: 'recoller', entrees: { elements: coll }, sortie: ch }];
const DESC_NC = [DESC[0], { nom: 'recoller', entrees: { elements: coll }, sortie: { forme: 'quelconque' } }];
const msg = (id, valeur) => ({ id, valeur });
const lien = (entree, donnee) => ({ entree, donnee });
let seq = 0;
const h = () => `2026-10-08T06:00:${String(++seq).padStart(2, '0')}.000Z`;
const ex = (id, operation, liaisons, resultat, idDesignation = `d-${id}`) => ({ id, horodatage: h(), idDesignation, operation, liaisons, resultat });
// Monde synthétique : n expériences passées (issues[k] = valeur d'arrivée de S_k ; défaut v_k = retour), contextes et attentes écrits « au fil de l'eau » ;
// le contexte courant est c{n+1}-p et son issue S_{n+1} vaut `courante` (par défaut v_{n+1}) ; sans `courante` === null, aucune exécution courante.
function monde(n, { issues = [], courante, desc = DESC } = {}) {
  seq = 0;
  const M = []; const E = []; const contextes = []; const attentes = []; let numero = 0;
  let designation = null;
  for (let k = 1; k <= n + 1; k += 1) {
    M.push(msg(`m${k}`, `v${k}`));
    E.push(ex(`R${k}`, 'eclater', [lien('x', `m${k}`)], ['v', String(k)]));
    designation = { id: `d-S${k}`, horodatage: h(), idObservation: `o${k}`, operation: 'recoller', liaisons: [lien('elements', `R${k}`)] };
    const nouveaux = contextesProspectifs({ operation: 'recoller', liaisons: [lien('elements', `R${k}`)] }, M, E, desc).map((c) => ({ id: `c${k}-${c.parent ? 'p' : 'd'}`, horodatage: h(), idDesignation: `d-S${k}`, idObservation: `o${k}`, ...c }));
    contextes.push(...nouveaux);
    for (const c of nouveaux) for (const a of attentesDuContexteProspectif(c, designation, contextes, M, E, desc)) attentes.push({ id: `a${++numero}`, horodatage: h(), idObservation: `o${k}`, ...a });
    if (k <= n) E.push(ex(`S${k}`, 'recoller', [lien('elements', `R${k}`)], issues[k - 1] === undefined ? `v${k}` : issues[k - 1], `d-S${k}`));
  }
  if (courante !== null) E.push(ex(`S${n + 1}`, 'recoller', [lien('elements', `R${n + 1}`)], courante === undefined ? `v${n + 1}` : courante, `d-S${n + 1}`));
  const courant = contextes.find((c) => c.id === `c${n + 1}-p`);
  return { M, E, contextes, attentes, courant, desc, miennes: attentes.filter((a) => a.idContexte === `c${n + 1}-p`) };
}
const issueDe = (w, a) => issueDeLAttenteProspective(a, w.contextes.find((c) => c.id === a.idContexte), w.M, w.E, w.desc);
const parChemin = (w, nom) => issueDe(w, w.miennes.find((a) => a.chemin.join('.') === nom));

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. exports : issueDeLAttenteProspective (5 paramètres, synchrone), STATUTS_ATTENTE = realisee / autre / absente ; garde anti-sémantique ; imports exacts ; aucune table', () => {
  assert.deepEqual(Object.keys(module).sort(), ['STATUTS_ATTENTE', 'issueDeLAttenteProspective']);
  assert.equal(issueDeLAttenteProspective.length, 5);
  assert.equal(issueDeLAttenteProspective.constructor.name, 'Function');
  assert.deepEqual(STATUTS_ATTENTE, ['realisee', 'autre', 'absente']);
  assert.equal(Object.isFrozen(STATUTS_ATTENTE), true);
  assert.equal(/relationValeur|egale|differente|arrivee|'execution'|'vers'|symbolesDeChaine|composerCollection|'valeurs'|'depart'/.test(CODE), false);
  assert.equal(/reussite|réussite|echec|échec|recompense|récompense|punition|confiance|score|probab|majorit|vote|\bDate\b|Math\.random|\bawait\b|\basync\b|magasin|\.ecrire|\.lireTout/i.test(CODE), false);
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./constats-structurels.js', './couverture-occurrences.js', './issue-contexte-prospectif.js']);
  assert.equal(/Object\.is|parcourirStructure|episodesDeTransformation/.test(CODE), false, 'aucune sémantique parallèle : l\'issue du contexte et memesConstats');
  assert.equal(VERSION_BASE, 21); assert.equal(SCHEMA_SAUVEGARDE, 11); assert.equal(TABLES.length, 24);
});

test('A2. SANS ISSUE : aucune exécution pour idDesignation -> issue null, l\'attente recopiée (constat, témoins, unités), ni statut ni reel', () => {
  const w = monde(2, { courante: null });
  const r = parChemin(w, 'relationValeur');
  assert.deepEqual(Object.keys(r), ['idAttente', 'idContexte', 'idDesignation', 'structure', 'chemin', 'constat', 'temoinsContexte', 'unitesIssues', 'issue']);
  assert.equal(r.issue, null);
  assert.deepEqual(r.constat, { type: 'chaine', valeur: 'egale' });
  assert.deepEqual(r.unitesIssues, [['c2-p', 'relationValeur']]);
  assert.equal(r.temoinsContexte.length, 2);
});

test('A3. REALISEE : chemin présent, constat réel = constat engagé (memesConstats) ; le réel est conservé même identique ; conteneur { objet } confronté pareil', () => {
  const w = monde(2);
  const rel = parChemin(w, 'relationValeur');
  assert.equal(rel.statut, 'realisee'); assert.deepEqual(rel.constat, { type: 'chaine', valeur: 'egale' }); assert.deepEqual(rel.reel, { type: 'chaine', valeur: 'egale' });
  assert.deepEqual(rel.issue, { idExecution: 'S3' });
  assert.deepEqual(Object.keys(rel), ['idAttente', 'idContexte', 'idDesignation', 'structure', 'chemin', 'constat', 'temoinsContexte', 'unitesIssues', 'issue', 'statut', 'reel']);
  const val = parChemin(w, 'valeurs');
  assert.equal(val.statut, 'realisee'); assert.deepEqual(val.constat, { type: 'objet' }); assert.deepEqual(val.reel, { type: 'objet' });
});

test('A4. AUTRE : attentes d\'identité (attendu S2, réel S3) et de valeur (attendu v2, réel v3) : chemin présent, constat réel différent ; attendu figé et réel conservés, pas de booléen', () => {
  const w = monde(2);
  for (const nom of ['arrivee', 'chemin.1.execution', 'chemin.1.vers']) { const r = parChemin(w, nom); assert.equal(r.statut, 'autre'); assert.deepEqual(r.constat, { type: 'chaine', valeur: 'S2' }); assert.deepEqual(r.reel, { type: 'chaine', valeur: 'S3' }); }
  for (const nom of ['valeurs.depart', 'valeurs.arrivee']) { const r = parChemin(w, nom); assert.equal(r.statut, 'autre'); assert.deepEqual(r.constat, { type: 'chaine', valeur: 'v2' }); assert.deepEqual(r.reel, { type: 'chaine', valeur: 'v3' }); }
  assert.equal(w.miennes.length, 7);
  const statuts = w.miennes.map((a) => issueDe(w, a).statut);
  assert.deepEqual(statuts.filter((s) => s === 'realisee').length, 2); assert.deepEqual(statuts.filter((s) => s === 'autre').length, 5);
});

test('A5. ATTENTE egale PUIS ISSUE differente : attendu egale, réel differente, statut autre ; l\'attente persistée est inchangée', () => {
  const w = monde(4, { courante: 'autre' });
  const avant = structuredClone(w.miennes);
  const rel = parChemin(w, 'relationValeur');
  assert.deepEqual(rel.constat, { type: 'chaine', valeur: 'egale' });
  assert.deepEqual(rel.reel, { type: 'chaine', valeur: 'differente' });
  assert.equal(rel.statut, 'autre');
  assert.deepEqual(rel.unitesIssues.map((u) => u[0]), ['c2-p', 'c3-p', 'c4-p']);
  assert.deepEqual(w.miennes, avant);
  assert.equal(parChemin(w, 'valeurs').statut, 'realisee', 'les autres attentes du même contexte sont confrontées séparément');
});

test('A6. ATTENTE PUIS CHEMIN ABSENT : issue non comparable -> les chemins valeurs/* n\'existent plus -> absente, sans reel, sans pseudo-constat', () => {
  const w = monde(3, { desc: DESC_NC, courante: ['pas', 'comparable'] });
  const val = parChemin(w, 'valeurs');
  assert.equal(val.statut, 'absente');
  assert.equal('reel' in val, false);
  assert.deepEqual(val.constat, { type: 'objet' });
  assert.deepEqual(val.issue, { idExecution: 'S4' });
  assert.equal(JSON.stringify(val).includes('ABSENT'), false);
  assert.equal(parChemin(w, 'relationValeur').statut, 'autre', 'non_comparable au lieu de egale : autre, pas absente');
  assert.deepEqual(parChemin(w, 'relationValeur').reel, { type: 'chaine', valeur: 'non_comparable' });
});

test('A7. entrées mal formées et ancrage brisé : TypeError, aucun résultat partiel', () => {
  const w = monde(2);
  const [a] = w.miennes;
  const c = w.contextes.find((x) => x.id === a.idContexte);
  refuse(() => issueDeLAttenteProspective(null, c, w.M, w.E, DESC));
  refuse(() => issueDeLAttenteProspective({ ...a, id: '' }, c, w.M, w.E, DESC));
  refuse(() => issueDeLAttenteProspective({ ...a, constat: { valeur: 'x' } }, c, w.M, w.E, DESC));
  refuse(() => issueDeLAttenteProspective({ ...a, chemin: 'x' }, c, w.M, w.E, DESC));
  refuse(() => issueDeLAttenteProspective(a, w.contextes.find((x) => x.id === 'c3-d'), w.M, w.E, DESC), 'autre contexte');
  refuse(() => issueDeLAttenteProspective(a, { ...c, idDesignation: 'd-autre' }, w.M, w.E, DESC));
  refuse(() => issueDeLAttenteProspective({ ...a, chemin: ['inconnu'] }, c, w.M, w.E, DESC), 'chemin qui n\'était pas ouvert');
});

test('A8. IMMUTABILITÉ et pureté : expériences ajoutées après l\'issue -> même issue ; entrées gelées intactes ; sorties neuves', () => {
  const w = monde(3);
  const avant = w.miennes.map((a) => issueDe(w, a));
  // le monde continue : trois expériences de plus, dont une differente
  const w2 = monde(6, { issues: ['v1', 'v2', 'v3', 'v4', 'autre', 'v6'] });
  const memes = w.miennes.map((a) => issueDeLAttenteProspective(a, w.contextes.find((c) => c.id === a.idContexte), w2.M, w2.E, DESC));
  assert.deepEqual(memes, avant);
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const a = gel(structuredClone(w.miennes[0])); const c = gel(structuredClone(w.contextes.find((x) => x.id === a.idContexte))); const M = gel(structuredClone(w.M)); const E = gel(structuredClone(w.E));
  const fige = JSON.stringify([a, c, M, E]);
  const r1 = issueDeLAttenteProspective(a, c, M, E, DESC); const r2 = issueDeLAttenteProspective(a, c, M, E, DESC);
  assert.deepEqual(r1, r2); assert.notEqual(r1, r2); assert.equal(r1.constat === a.constat, false); assert.equal(r1.unitesIssues === a.unitesIssues, false);
  assert.equal(JSON.stringify([a, c, M, E]), fige);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. FLUX RÉEL
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
  const valeurs = await magasin.lireTout('valeursDonnees'); const executions = await ex2(); const contextes = await magasin.lireTout(TC); const attentes = await magasin.lireTout(TA);
  const issues = attentes.map((a) => issueDeLAttenteProspective(a, contextes.find((c) => c.id === a.idContexte), valeurs, executions, DESCRIPTIONS_OPERATIONS));
  return { tours, magasin, valeurs, executions, contextes, attentes, issues };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const compter = (issues) => issues.reduce((c, i) => { c[i.issue ? i.statut : 'sansIssue'] += 1; return c; }, { realisee: 0, autre: 0, absente: 0, sansIssue: 0 });
const ventiler = (issues) => { const v = {}; for (const i of issues) { if (!i.issue) continue; const k = i.chemin.join('.'); v[k] = v[k] ?? { realisee: 0, autre: 0, absente: 0 }; v[k][i.statut] += 1; } return v; };

test('B1. SCÉNARIO RÉEL : 28 attentes, 28 avec issue ; 16 realisee (relationValeur non_comparable), 12 autre (toutes les identités : attendu X ancien, réel Y nouveau) ; comportement vivant inchangé', async () => {
  const { tours, executions, issues } = await rejouer(SCENARIO);
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(executions.length, 19);
  assert.equal(tours.flatMap((s) => s.automatiques).filter((x) => x.statut !== 'executee').length, 0);
  assert.equal(issues.length, 28);
  assert.deepEqual(compter(issues), { realisee: 16, autre: 12, absente: 0, sansIssue: 0 });
  assert.deepEqual(ventiler(issues), { arrivee: { realisee: 0, autre: 4, absente: 0 }, 'chemin.0.execution': { realisee: 0, autre: 2, absente: 0 }, 'chemin.0.vers': { realisee: 0, autre: 2, absente: 0 }, relationValeur: { realisee: 16, autre: 0, absente: 0 }, 'chemin.1.execution': { realisee: 0, autre: 2, absente: 0 }, 'chemin.1.vers': { realisee: 0, autre: 2, absente: 0 } });
  for (const i of issues.filter((x) => x.statut === 'autre')) { assert.notEqual(i.constat.valeur, i.reel.valeur); assert.equal(executions.some((e) => e.id === i.constat.valeur), true, 'l\'attendu est une identité d\'exécution passée'); assert.equal(i.reel.valeur, executions.find((e) => e.idDesignation === i.idDesignation).id, 'le réel est la nouvelle exécution'); }
  for (const i of issues.filter((x) => x.statut === 'realisee')) assert.deepEqual(i.reel, i.constat);
});

test('B2. SONDE SIX EXPÉRIENCES : 82 attentes ; structure centrale : relationValeur egale realisee ×4 (témoins figés 2/1 … 5/4), valeurs objet realisee ×4, identités et valeurs futures autre ×1 chacune', async () => {
  const { issues } = await rejouer(['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'], undefined, true);
  assert.equal(issues.length, 82);
  assert.deepEqual(compter(issues), { realisee: 53, autre: 29, absente: 0, sansIssue: 0 });
  const centrales = issues.filter((i) => sk(i.structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)');
  assert.equal(centrales.length, 13);
  assert.deepEqual(ventiler(centrales), { arrivee: { realisee: 0, autre: 1, absente: 0 }, 'chemin.1.execution': { realisee: 0, autre: 1, absente: 0 }, 'chemin.1.vers': { realisee: 0, autre: 1, absente: 0 }, relationValeur: { realisee: 4, autre: 0, absente: 0 }, valeurs: { realisee: 4, autre: 0, absente: 0 }, 'valeurs.arrivee': { realisee: 0, autre: 1, absente: 0 }, 'valeurs.depart': { realisee: 0, autre: 1, absente: 0 } });
  const rel = centrales.filter((i) => i.chemin[0] === 'relationValeur');
  assert.deepEqual(rel.map((i) => `${i.temoinsContexte.length}/${i.unitesIssues.length}`), ['2/1', '3/2', '4/3', '5/4']);
  for (const i of rel) { assert.deepEqual(i.constat, { type: 'chaine', valeur: 'egale' }); assert.deepEqual(i.reel, { type: 'chaine', valeur: 'egale' }); }
  const vd = centrales.find((i) => i.chemin.join('.') === 'valeurs.depart');
  assert.deepEqual(vd.constat, { type: 'chaine', valeur: 'bonjour Luna' }); assert.deepEqual(vd.reel, { type: 'chaine', valeur: '' });
  // une même exécution (T4) : realisee pour relationValeur et valeurs, autre pour identités et valeurs futures : jamais agrégé
  const t4 = centrales.filter((i) => i.idDesignation === vd.idDesignation);
  assert.deepEqual(t4.map((i) => i.statut).sort(), ['autre', 'autre', 'autre', 'autre', 'autre', 'realisee', 'realisee']);
});

test('B3. ÉCHEC APRÈS ATTENTE (cas .74) : attentes écrites, invocation qui lève, aucune exécution -> issue null pour chacune', async () => {
  const { tours, magasin } = await rejouer(['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max']);
  const { observation, univers } = tours[3];
  const message = (await magasin.lireTout('valeursDonnees')).at(-1);
  const panne = { ...TABLE_OPERATIONS, symbolesDeChaine: { ...TABLE_OPERATIONS.symbolesDeChaine, fonction: () => { throw new Error('panne volontaire'); } } };
  const r = await executerApplicationSollicitee({ observation, application: { operation: 'symbolesDeChaine', liaisons: [lien('chaine', message.id)] }, univers }, { magasin, table: panne });
  assert.equal(r.statut, 'echec_invocation');
  const V = await magasin.lireTout('valeursDonnees'); const E = await magasin.lireTout('executionsOperations'); const C = await magasin.lireTout(TC);
  const miennes = (await magasin.lireTout(TA)).filter((a) => a.idDesignation === r.designation.id);
  assert.ok(miennes.length > 0);
  for (const a of miennes) { const i = issueDeLAttenteProspective(a, C.find((c) => c.id === a.idContexte), V, E, DESCRIPTIONS_OPERATIONS); assert.equal(i.issue, null); assert.equal('statut' in i, false); }
});

test('B4. DORMANCE : aucun fichier de app/ n\'importe ni ne nomme la vue ; aucun mécanisme ne lit les attentes ; catalogue et table inchangés', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    assert.equal(/issue-attente-prospective|issueDeLAttenteProspective|STATUTS_ATTENTE/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/issue-attente-prospective/.test(s), false, autre); }
  for (const f of fichiersJs(join(RACINE, 'app'))) assert.equal(/lireTout\(\s*['"]attentesProspectives/.test(sansCommentaires(readFileSync(f, 'utf8'))), false, f);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
