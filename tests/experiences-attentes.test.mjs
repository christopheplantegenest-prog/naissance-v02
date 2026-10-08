// v0.63.76 — experiencesDAttentes : les issues d'attentes comme collection d'expériences observables (décision ChatGPT, 08/10/2026). Preuves : vue pure sans table, composition
// seule (issueDeLAttenteProspective non réimplémentée) ; unité = une attente ayant une issue (identité idAttente) ; sans issue = hors collection, jamais un statut ; critère / avant /
// après ; regroupements A {structure, chemin} et B {+ constat attendu} (et toute autre question) ; constatsParChemin reçoit directement les éléments ; régularités de statut et
// attendu/réel par couvertures ; egale → differente ; absente (trou de couverture) ; conteneurs ordinaires ; témoins = identités ; histoire figée ; ordre non sémantique ;
// scénario réel (28) et sonde (82) ; dormance ; comportement vivant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/experiences-attentes.js';
import { experiencesDAttentes, elementsDExperiences, regrouperExperiences } from '../app/langage/experiences-attentes.js';
import { issueDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { constatsParChemin } from '../app/langage/constats-par-chemin.js';
import { memesCouvertures } from '../app/langage/couverture-occurrences.js';
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
const CHEMIN = join(RACINE, 'app', 'langage', 'experiences-attentes.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const sansCommentaires = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^experiencesDAttentes : /.test(e.message));
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
const ch = { forme: 'scalaire', genre: 'chaine' };
const coll = { forme: 'collection', elements: ch };
const DESC = [{ nom: 'eclater', entrees: { x: ch }, sortie: coll }, { nom: 'recoller', entrees: { elements: coll }, sortie: ch }];
const DESC_NC = [DESC[0], { nom: 'recoller', entrees: { elements: coll }, sortie: { forme: 'quelconque' } }];
const msg = (id, valeur) => ({ id, valeur });
const lien = (entree, donnee) => ({ entree, donnee });
let seq = 0;
const h = () => `2026-10-08T07:00:${String(++seq).padStart(2, '0')}.000Z`;
const ex = (id, operation, liaisons, resultat, idDesignation = `d-${id}`) => ({ id, horodatage: h(), idDesignation, operation, liaisons, resultat });
// Monde synthétique (celui de .75) : n expériences passées, contextes et attentes écrits « au fil de l'eau », issue courante S_{n+1} = `courante` (null : aucune).
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
  return { M, E, contextes, attentes, desc };
}
const vue = (w) => experiencesDAttentes(w.attentes, w.contextes, w.M, w.E, w.desc);
const au = (cpc, chemin) => cpc.chemins.find((c) => memesCouvertures([c.chemin], [chemin]));
const groupe = (groupes, nomChemin, etapes = 2) => groupes.find((g) => g.cle[0].chemin.join('.') === nomChemin && g.cle[0].structure.length === etapes);
const constant = (cpc, chemin) => { const c = au(cpc, chemin); return c !== undefined && c.constats.length === 1 && memesCouvertures(c.constats[0].couverture, cpc.universelle) ? c.constats[0] : null; };
const A = [['critere']]; const B = [['critere'], ['avant', 'constat']];

// ---------------------------------------------------------------------------------------------------------------------------------- A. CONTRAT
test('A1. exports (3 fonctions pures) ; imports exacts : issueDeLAttenteProspective + normaliserCouverture ; aucune sémantique réimplémentée ; garde anti-sémantique et anti-politique ; aucune table', () => {
  assert.deepEqual(Object.keys(module).sort(), ['elementsDExperiences', 'experiencesDAttentes', 'regrouperExperiences']);
  assert.equal(experiencesDAttentes.length, 5); assert.equal(elementsDExperiences.length, 1); assert.equal(regrouperExperiences.length, 2);
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./couverture-occurrences.js', './issue-attente-prospective.js']);
  assert.equal(/memesConstats|issueDuContexteProspectif|parcourirStructure|episodesDeTransformation|'realisee'|'autre'|'absente'|'absent'|idContexte ===|constatsParChemin\(/.test(CODE), false, 'ni ancrage, ni égalité de constats, ni statuts réimplémentés, ni statistique');
  assert.equal(/relationValeur|egale|differente|arrivee|'execution'|'vers'|symbolesDeChaine|composerCollection|'valeurs'|'depart'|applicationsSollicitables/.test(CODE), false);
  assert.equal(/reussite|réussite|echec|échec|recompense|récompense|punition|confiance|score|probab|majorit|vote|prefer|préfér|renforc|\bDate\b|Math\.random|\bawait\b|\basync\b|magasin|\.ecrire|\.lireTout|\.sort\(/i.test(CODE), false);
  assert.equal(VERSION_BASE, 21); assert.equal(SCHEMA_SAUVEGARDE, 11); assert.equal(TABLES.length, 24);
});

test('A2. UNITÉ ET FORME : une expérience par attente ayant une issue, identité = id de l\'attente ; { id, idContexte, idDesignation, idExecution, critere, avant, apres } ; rien de fusionné', () => {
  const w = monde(2);
  const { experiences, sansIssue } = vue(w);
  assert.deepEqual(sansIssue, []);
  assert.equal(experiences.length, w.attentes.length);
  assert.deepEqual(experiences.map((e) => e.id), w.attentes.map((a) => a.id), 'ordre persistant des attentes, une par attente');
  const e = experiences.find((x) => x.critere.chemin.join('.') === 'relationValeur' && x.idContexte === 'c3-p');
  assert.deepEqual(Object.keys(e), ['id', 'idContexte', 'idDesignation', 'idExecution', 'critere', 'avant', 'apres']);
  assert.deepEqual(Object.keys(e.critere), ['structure', 'chemin']); assert.deepEqual(Object.keys(e.avant), ['constat', 'temoinsContexte', 'unitesIssues']); assert.deepEqual(Object.keys(e.apres), ['statut', 'reel']);
  assert.equal(e.idExecution, 'S3'); assert.equal(e.idDesignation, 'd-S3');
  assert.deepEqual(e.avant.constat, { type: 'chaine', valeur: 'egale' }); assert.deepEqual(e.apres, { statut: 'realisee', reel: { type: 'chaine', valeur: 'egale' } });
  assert.deepEqual(e.avant.unitesIssues, [['c2-p', 'relationValeur']]); assert.equal(e.avant.temoinsContexte.length, 2);
  // même contenu que la vue .75, réarrangé : aucune sémantique parallèle
  const i = issueDeLAttenteProspective(w.attentes.find((a) => a.id === e.id), w.contextes.find((c) => c.id === e.idContexte), w.M, w.E, DESC);
  assert.deepEqual([e.critere.structure, e.critere.chemin, e.avant.constat, e.avant.temoinsContexte, e.avant.unitesIssues, e.apres.statut, e.apres.reel], [i.structure, i.chemin, i.constat, i.temoinsContexte, i.unitesIssues, i.statut, i.reel]);
  // deux attentes d'un même contexte / d'une même exécution restent deux expériences
  const c3 = experiences.filter((x) => x.idContexte === 'c3-p'); assert.equal(c3.length, 7); assert.equal(new Set(c3.map((x) => x.id)).size, 7); assert.equal(new Set(c3.map((x) => x.idExecution)).size, 1);
});

test('A3. SANS ISSUE : les attentes sans exécution ne sont pas des expériences ; leurs identifiants sont rendus à part ; aucun statut ne les représente', () => {
  const w = monde(3, { courante: null });
  const { experiences, sansIssue } = vue(w);
  const futures = w.attentes.filter((a) => a.idDesignation === 'd-S4').map((a) => a.id);
  assert.deepEqual(futures, ['a12', 'a13', 'a14']);
  assert.deepEqual(sansIssue, futures);
  assert.equal(experiences.length, 11); assert.deepEqual([...new Set(experiences.map((e) => e.idContexte))], ['c3-d', 'c3-p'], 'seules les attentes des contextes issus (S3) sont des expériences');
  assert.equal(experiences.some((e) => futures.includes(e.id)), false);
  const cpc = constatsParChemin(elementsDExperiences(experiences));
  assert.deepEqual(au(cpc, ['apres', 'statut']).constats.map((c) => c.valeur).sort(), ['autre', 'realisee']);
  assert.equal(JSON.stringify(vue(w)).includes('sansIssue":[') , true); assert.equal(/"statut":"(sans|null|aucun)/.test(JSON.stringify(vue(w))), false);
});

test('A4. REGROUPEMENTS A et B ; ATTENTE egale PUIS differente : le groupe contient les deux sortes d\'issues ; attendu constant, réel variable, statuts à couvertures distinctes ; passé intact', () => {
  const w = monde(4, { courante: 'autre' });
  const { experiences } = vue(w);
  const gA = regrouperExperiences(experiences, A); const gB = regrouperExperiences(experiences, B);
  const rel = groupe(gA, 'relationValeur');
  assert.deepEqual(rel.cle, [{ structure: [{ operation: 'eclater', entrees: ['x'] }, { operation: 'recoller', entrees: ['elements'] }], chemin: ['relationValeur'] }]);
  assert.equal(rel.couverture.length, 3); assert.deepEqual(rel.couverture, rel.experiences.map((e) => [e.id]).sort());
  assert.deepEqual(rel.experiences.map((e) => [e.idContexte, e.apres.statut]), [['c3-p', 'realisee'], ['c4-p', 'realisee'], ['c5-p', 'autre']]);
  const relB = groupe(gB, 'relationValeur');
  assert.deepEqual(relB.cle[1], { type: 'chaine', valeur: 'egale' }); assert.deepEqual(relB.couverture, rel.couverture, 'attendu constant : A et B coïncident ici');
  // constatsParChemin sur les éléments du groupe : seulement des constats et des couvertures
  const cpc = constatsParChemin(elementsDExperiences(rel.experiences));
  assert.deepEqual(cpc.universelle, rel.couverture);
  const statuts = au(cpc, ['apres', 'statut']).constats;
  assert.deepEqual(statuts.map((c) => [c.valeur, c.couverture.length]), [['realisee', 2], ['autre', 1]]);
  assert.deepEqual(statuts.find((c) => c.valeur === 'autre').couverture, [[rel.experiences[2].id]]);
  assert.deepEqual(constant(cpc, ['avant', 'constat', 'valeur']), { type: 'chaine', valeur: 'egale', couverture: cpc.universelle }, 'attendu constant');
  assert.equal(constant(cpc, ['apres', 'reel', 'valeur']), null, 'réel variable');
  assert.deepEqual(au(cpc, ['apres', 'reel', 'valeur']).constats.map((c) => [c.valeur, c.couverture.length]), [['egale', 2], ['differente', 1]]);
  // le passé n'est ni supprimé ni réécrit : les trois premières expériences sont celles du monde d'avant la cinquième issue
  const avant = vue(monde(3)).experiences.filter((e) => e.critere.chemin.join('.') === 'relationValeur' && e.critere.structure.length === 2);
  assert.deepEqual(rel.experiences.slice(0, 2), avant);
  assert.deepEqual(w.attentes.map((a) => a.constat.valeur).filter((v) => v === 'egale').length, 3);
  // la structure à une étape (projection directe) forme un AUTRE groupe, non mélangé
  assert.deepEqual(groupe(gA, 'relationValeur', 1).experiences.map((e) => e.apres.statut), ['realisee', 'realisee', 'realisee']);
});

test('A5. ABSENTE : une expérience statut absente dans un groupe ; après = { statut } sans reel ; l\'absence est un trou de couverture, jamais une valeur', () => {
  const w = monde(3, { desc: DESC_NC, courante: ['pas', 'comparable'] });
  const { experiences } = vue(w);
  const val = groupe(regrouperExperiences(experiences, A), 'valeurs');
  assert.deepEqual(val.experiences.map((e) => e.apres), [{ statut: 'realisee', reel: { type: 'objet' } }, { statut: 'absente' }]);
  const cpc = constatsParChemin(elementsDExperiences(val.experiences));
  assert.deepEqual(au(cpc, ['apres', 'statut']).constats.map((c) => [c.valeur, c.couverture.length]).sort(), [['absente', 1], ['realisee', 1]]);
  assert.equal(au(cpc, ['apres', 'reel']).couverture.length, 1); assert.equal(memesCouvertures(au(cpc, ['apres', 'reel']).couverture, cpc.universelle), false);
  assert.equal(JSON.stringify(experiences).includes('ABSENT'), false);
  assert.deepEqual(groupe(regrouperExperiences(experiences, A), 'relationValeur').experiences.at(-1).apres, { statut: 'autre', reel: { type: 'chaine', valeur: 'non_comparable' } });
});

test('A6. CONTENEURS : attendu { objet } / réel { objet } / realisee est une expérience ordinaire ; constatsParChemin la lit à [apres,reel,type] sans chemin valeur', () => {
  const { experiences } = vue(monde(4));
  const val = groupe(regrouperExperiences(experiences, B), 'valeurs');
  assert.deepEqual(val.cle[1], { type: 'objet' }); assert.equal(val.couverture.length, 3);
  const cpc = constatsParChemin(elementsDExperiences(val.experiences));
  assert.deepEqual(constant(cpc, ['apres', 'statut']).valeur, 'realisee');
  assert.deepEqual(constant(cpc, ['apres', 'reel', 'type']).valeur, 'objet'); assert.deepEqual(constant(cpc, ['avant', 'constat', 'type']).valeur, 'objet');
  assert.equal(au(cpc, ['apres', 'reel', 'valeur']), undefined); assert.equal(au(cpc, ['avant', 'constat', 'valeur']), undefined);
});

test('A7. HISTOIRE FIGÉE, ORDRE NON SÉMANTIQUE, PURETÉ : une collection plus grande ajoute sans changer les anciennes ; entrée renversée = mêmes expériences et couvertures ; entrées gelées intactes', () => {
  const w = monde(3);
  const avant = vue(w).experiences;
  const w2 = monde(6, { issues: ['v1', 'v2', 'v3', 'v4', 'autre', 'v6'] });
  const apres = vue(w2).experiences;
  assert.ok(apres.length > avant.length);
  for (const e of avant) assert.deepEqual(apres.find((x) => x.id === e.id), e);
  const renverse = experiencesDAttentes([...w2.attentes].reverse(), [...w2.contextes].reverse(), w2.M, w2.E, DESC).experiences;
  assert.deepEqual(renverse.map((e) => e.id), apres.map((e) => e.id).reverse());
  for (const e of apres) assert.deepEqual(renverse.find((x) => x.id === e.id), e);
  for (const sel of [A, B]) {
    const g1 = regrouperExperiences(apres, sel); const g2 = regrouperExperiences(renverse, sel);
    assert.equal(g1.length, g2.length);
    for (const g of g1) { const h2 = g2.find((x) => memesCouvertures(x.couverture, g.couverture)); assert.deepEqual(h2.cle, g.cle); }
  }
  const c1 = constatsParChemin(elementsDExperiences(apres)); const c2 = constatsParChemin(elementsDExperiences(renverse));
  assert.deepEqual(c1, c2, 'les régularités dépendent des couvertures, pas de la position');
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const AT = gel(structuredClone(w.attentes)); const CT = gel(structuredClone(w.contextes)); const M = gel(structuredClone(w.M)); const E = gel(structuredClone(w.E));
  const fige = JSON.stringify([AT, CT, M, E]);
  const r1 = experiencesDAttentes(AT, CT, M, E, DESC); const r2 = experiencesDAttentes(AT, CT, M, E, DESC);
  assert.deepEqual(r1, r2); assert.notEqual(r1.experiences[0], r2.experiences[0]); assert.equal(r1.experiences[0].avant.constat === AT[0].constat, false);
  const el = elementsDExperiences(gel(r1.experiences)); assert.equal(el[0].contenu.critere === r1.experiences[0].critere, false);
  regrouperExperiences(r1.experiences, B);
  assert.equal(JSON.stringify([AT, CT, M, E]), fige);
});

test('A8. entrées mal formées : TypeError, aucun résultat partiel (tableaux, contexte référencé absent, sélecteurs)', () => {
  const w = monde(2);
  refuse(() => experiencesDAttentes(null, w.contextes, w.M, w.E, DESC));
  refuse(() => experiencesDAttentes(w.attentes, {}, w.M, w.E, DESC));
  refuse(() => experiencesDAttentes(w.attentes, w.contextes.filter((c) => c.id !== 'c3-p'), w.M, w.E, DESC));
  refuse(() => experiencesDAttentes([{ ...w.attentes[0], idContexte: 'x' }], w.contextes, w.M, w.E, DESC));
  assert.throws(() => experiencesDAttentes([{ ...w.attentes[0], chemin: ['inconnu'] }], w.contextes, w.M, w.E, DESC), (e) => e instanceof TypeError && /^issueDeLAttenteProspective : /.test(e.message), 'les erreurs de la vue composée se propagent telles quelles');
  const { experiences } = vue(w);
  refuse(() => elementsDExperiences({}));
  refuse(() => elementsDExperiences([{ critere: {} }]));
  refuse(() => regrouperExperiences(experiences, []));
  refuse(() => regrouperExperiences(experiences, [[]]));
  refuse(() => regrouperExperiences(experiences, [['inconnu']]));
  refuse(() => regrouperExperiences(experiences, [['critere', 'inconnu']]));
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
  const valeurs = await magasin.lireTout('valeursDonnees'); const executions = await ex2(); const contextes = await magasin.lireTout('contextesProspectifs'); const attentes = await magasin.lireTout('attentesProspectives');
  const t0 = performance.now();
  const collection = experiencesDAttentes(attentes, contextes, valeurs, executions, DESCRIPTIONS_OPERATIONS);
  return { tours, magasin, valeurs, executions, contextes, attentes, ...collection, duree: performance.now() - t0 };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const distribution = (xs) => xs.reduce((c, e) => { c[e.apres.statut] = (c[e.apres.statut] ?? 0) + 1; return c; }, {});
const uniformes = (groupes) => groupes.filter((g) => new Set(g.experiences.map((e) => e.apres.statut)).size === 1).length;

test('B1. SCÉNARIO RÉEL : 28 expériences, 0 sans issue ; 8 groupes A = 8 groupes B, tous uniformes en statut ; relation (realisee, attendu = réel constants) contre identités (autre, attendu X ≠ réel Y) ; comportement vivant inchangé', async () => {
  const { tours, executions, attentes, experiences, sansIssue, duree } = await rejouer(SCENARIO);
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(executions.length, 19); assert.equal(attentes.length, 28);
  assert.equal(experiences.length, 28); assert.deepEqual(sansIssue, []);
  assert.deepEqual(distribution(experiences), { autre: 12, realisee: 16 });
  const gA = regrouperExperiences(experiences, A); const gB = regrouperExperiences(experiences, B);
  assert.equal(gA.length, 8); assert.equal(gB.length, 8); assert.equal(uniformes(gA), 8); assert.equal(uniformes(gB), 8);
  assert.deepEqual(gA.map((g) => [sk(g.cle[0].structure), g.cle[0].chemin.join('.'), g.couverture.length, [...new Set(g.experiences.map((e) => e.apres.statut))].join()]).sort(), [
    ['elementsObservables(elements)', 'arrivee', 2, 'autre'], ['elementsObservables(elements)', 'chemin.0.execution', 2, 'autre'], ['elementsObservables(elements)', 'chemin.0.vers', 2, 'autre'], ['elementsObservables(elements)', 'relationValeur', 8, 'realisee'],
    ['symbolesDeChaine(chaine)>elementsObservables(elements)', 'arrivee', 2, 'autre'], ['symbolesDeChaine(chaine)>elementsObservables(elements)', 'chemin.1.execution', 2, 'autre'], ['symbolesDeChaine(chaine)>elementsObservables(elements)', 'chemin.1.vers', 2, 'autre'], ['symbolesDeChaine(chaine)>elementsObservables(elements)', 'relationValeur', 8, 'realisee'],
  ].sort());
  // régularités par couvertures, sans nom de champ dans le mécanisme
  for (const g of gA) {
    const cpc = constatsParChemin(elementsDExperiences(g.experiences));
    assert.deepEqual(cpc.universelle, g.couverture);
    const statut = constant(cpc, ['apres', 'statut']); const attendu = constant(cpc, ['avant', 'constat', 'valeur']); const reel = constant(cpc, ['apres', 'reel', 'valeur']);
    assert.ok(statut && attendu && reel, 'statut, attendu et réel constants dans chaque groupe réel');
    if (statut.valeur === 'realisee') { assert.equal(attendu.valeur, reel.valeur); assert.equal(attendu.valeur, 'non_comparable'); } else { assert.notEqual(attendu.valeur, reel.valeur); assert.ok(executions.some((e) => e.id === attendu.valeur) && executions.some((e) => e.id === reel.valeur)); }
  }
  // la collection entière comme éléments : couvertures exactes (identités d'attentes), jamais des comptes
  const cpc = constatsParChemin(elementsDExperiences(experiences));
  assert.equal(cpc.universelle.length, 28);
  const statuts = au(cpc, ['apres', 'statut']).constats;
  assert.deepEqual(statuts.map((c) => [c.valeur, c.couverture.length]).sort(), [['autre', 12], ['realisee', 16]]);
  assert.deepEqual(statuts.find((c) => c.valeur === 'realisee').couverture, experiences.filter((e) => e.apres.statut === 'realisee').map((e) => [e.id]).sort());
  assert.ok(duree < 5000);
});

test('B2. SONDE SIX EXPÉRIENCES : 82 expériences ; 23 groupes A = 23 B, uniformes ; groupe central relationValeur egale → egale realisee ×4, valeurs objet ×4 ; regroupement par chemin seul : identités = statut autre constant, attendu variable, réel variable', async () => {
  const { experiences, sansIssue, duree } = await rejouer(['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'], undefined, true);
  assert.equal(experiences.length, 82); assert.deepEqual(sansIssue, []);
  assert.deepEqual(distribution(experiences), { autre: 29, realisee: 53 });
  const gA = regrouperExperiences(experiences, A); const gB = regrouperExperiences(experiences, B);
  assert.equal(gA.length, 23); assert.equal(gB.length, 23); assert.equal(uniformes(gA), 23);
  const central = gB.find((g) => sk(g.cle[0].structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)' && g.cle[0].chemin.join('.') === 'relationValeur');
  assert.deepEqual(central.cle[1], { type: 'chaine', valeur: 'egale' }); assert.equal(central.couverture.length, 4);
  const cpc = constatsParChemin(elementsDExperiences(central.experiences));
  assert.equal(constant(cpc, ['apres', 'statut']).valeur, 'realisee'); assert.equal(constant(cpc, ['avant', 'constat', 'valeur']).valeur, 'egale'); assert.equal(constant(cpc, ['apres', 'reel', 'valeur']).valeur, 'egale');
  assert.deepEqual(central.experiences.map((e) => `${e.avant.temoinsContexte.length}/${e.avant.unitesIssues.length}`), ['2/1', '3/2', '4/3', '5/4']);
  const objets = gB.find((g) => sk(g.cle[0].structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)' && g.cle[0].chemin.join('.') === 'valeurs');
  assert.deepEqual(objets.cle[1], { type: 'objet' }); assert.equal(objets.couverture.length, 4); assert.equal(constant(constatsParChemin(elementsDExperiences(objets.experiences)), ['apres', 'reel', 'type']).valeur, 'objet');
  // une autre question : même chemin, toutes structures confondues — les identités montrent statut constant / attendu variable / réel variable, sans que rien ne sache que ce sont des identités
  const gC = regrouperExperiences(experiences, [['critere', 'chemin']]);
  const arr = gC.find((g) => g.cle[0].join('.') === 'arrivee');
  assert.equal(arr.couverture.length, 9);
  const cArr = constatsParChemin(elementsDExperiences(arr.experiences));
  assert.equal(constant(cArr, ['apres', 'statut']).valeur, 'autre');
  assert.equal(constant(cArr, ['avant', 'constat', 'valeur']), null); assert.equal(au(cArr, ['avant', 'constat', 'valeur']).constats.length, 3);
  assert.equal(constant(cArr, ['apres', 'reel', 'valeur']), null); assert.equal(au(cArr, ['apres', 'reel', 'valeur']).constats.length, 3);
  const rel = gC.find((g) => g.cle[0].join('.') === 'relationValeur');
  const cRel = constatsParChemin(elementsDExperiences(rel.experiences));
  assert.equal(rel.couverture.length, 49); assert.equal(constant(cRel, ['apres', 'statut']).valeur, 'realisee');
  assert.deepEqual(au(cRel, ['avant', 'constat', 'valeur']).constats.map((c) => [c.valeur, c.couverture.length]).sort(), [['egale', 4], ['non_comparable', 45]]);
  assert.ok(duree < 10000);
});

test('B3. DORMANCE : aucun fichier de app/ n\'importe ni ne nomme la vue ; aucun mécanisme ne lit les attentes ; aucun contexte prospectif engendré sur des expériences ; catalogue et table inchangés', () => {
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    if (f === CHEMIN) continue;
    if (f === join(RACINE, 'app', 'langage', 'description-candidats.js')) continue; // MISE À JOUR DÉLIBÉRÉE — EXPÉRIENCE D'AUTONOMIE 01 (branche, base v0.63.76) : + description-candidats.js (vue pure dormante : description de chaque application candidate d'un tour par l'expérience ; compose applications-sollicitables, groupes-candidats, contexte-prospectif, attentes-prospectives, experiences-attentes, couverture-occurrences, constats-structurels)
    assert.equal(/experiences-attentes|experiencesDAttentes|elementsDExperiences|regrouperExperiences/.test(readFileSync(f, 'utf8')), false, f);
  }
  for (const autre of ['sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/experiences-attentes/.test(s), false, autre); }
  for (const f of fichiersJs(join(RACINE, 'app'))) assert.equal(/lireTout\(\s*['"]attentesProspectives/.test(sansCommentaires(readFileSync(f, 'utf8'))), false, f);
  assert.equal(/contextesProspectifs|contexte-prospectif/.test(CODE), false, 'pas de méta-récursion');
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
