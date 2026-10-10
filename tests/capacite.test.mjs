// === DEBUT_TEST_CAPACITE ===
// v0.63.84 — B1 : CAPACITÉ D'AGIR (décision ChatGPT « SONDE 1 VALIDÉE — INTÉGRATION DE B1 », 10/10/2026). Primitives persistées (capaciteInitiale,
// variationsCapacite), règle B1 (plafond, coût d'un tour actif, récupération par repos, porte à zéro), reconstruction par la chaîne, saturation,
// épuisement, une cause = une variation, écriture des contextes/attentes sur soi AVANT la variation, garde d'ordre, aucune valeur (seule lecture de c :
// « === 0 »), tables et schéma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import { PARAMETRES_B1, CAUSE_TOUR, CAUSE_REPOS, lireCapacite, tourActif, tickRepos } from '../app/langage/capacite.js';
import { magasinMemoireVive, enregistrerCapaciteInitiale, enregistrerVariationCapacite, enregistrerContexteProspectif, enregistrerAttenteProspective, TABLES, CLE, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';
import { identiteEtatApres } from '../app/langage/projection-soi.js';
import { lireExecutionsVecues } from '../app/langage/executions-vecues.js';
import { issueDeLAttenteProspective } from '../app/langage/issue-attente-prospective.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const horodatage = () => new Date().toISOString();
let n = 0;
const tour = (magasin) => tourActif(magasin, { idObservation: `observation-${++n}`, horodatage: horodatage() });

test('A1. PARAMETRES_B1 gelés : plafond 3 (paramètre primitif initial), coût 1, récupération 1 ; causes « tour » et « repos » ; deux tables en dernier (clé id), VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables', () => {
  assert.deepEqual(PARAMETRES_B1, { plafond: 3, coutTourActif: 1, recuperationRepos: 1 }); assert.equal(Object.isFrozen(PARAMETRES_B1), true);
  assert.equal(CAUSE_TOUR, 'tour'); assert.equal(CAUSE_REPOS, 'repos');
  assert.deepEqual(TABLES.slice(-2), ['capaciteInitiale', 'variationsCapacite']); assert.equal(CLE.capaciteInitiale, 'id'); assert.equal(CLE.variationsCapacite, 'id');
  assert.equal(TABLES.length, 28); assert.equal(new Set(TABLES).size, 28); assert.equal(VERSION_BASE, 23); assert.equal(SCHEMA_SAUVEGARDE, 13);
  assert.match(lu('app', 'langage', 'capacite.js'), /PARAMÈTRES PRIMITIFS INITIAUX/);
  assert.match(lu('app', 'langage', 'capacite.js'), /DISPOSITIF DE VALIDATION DU TEMPS PROPRE/);
});

test('A2. primitives : l\'origine s\'écrit UNE fois (valeur entière ≥ 0, clés closes) ; une variation exige l\'origine, une cause typée, un état d\'avant connu et non déjà suivi, une cause jamais vue ; clés closes', async () => {
  const magasin = magasinMemoireVive();
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: 'o-1' }, idEtatAvant: 'x', valeur: 2 }), /aucune origine/);
  await assert.rejects(() => enregistrerCapaciteInitiale(magasin, { valeur: -1 }), /entier/);
  await assert.rejects(() => enregistrerCapaciteInitiale(magasin, { valeur: 1.5 }), /entier/);
  await assert.rejects(() => enregistrerCapaciteInitiale(magasin, { valeur: 3, autre: 1 }), /champ étranger/);
  const o = await enregistrerCapaciteInitiale(magasin, { valeur: 3 });
  assert.deepEqual(Object.keys(o), ['id', 'horodatage', 'valeur']); assert.match(o.id, /^capacite-initiale-/); assert.equal(o.valeur, 3);
  await assert.rejects(() => enregistrerCapaciteInitiale(magasin, { valeur: 3 }), /existe déjà/);
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'acte', id: 'o-1' }, idEtatAvant: o.id, valeur: 2 }), /cause\.type/);
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: '' }, idEtatAvant: o.id, valeur: 2 }), /cause\.id/);
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: 'o-1', x: 1 }, idEtatAvant: o.id, valeur: 2 }), /champ étranger/);
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: 'o-1' }, idEtatAvant: 'inconnu', valeur: 2 }), /ni l'origine ni l'état/);
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: 'o-1' }, idEtatAvant: o.id, valeur: 2.5 }), /entier/);
  const v1 = await enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: 'o-1' }, idEtatAvant: o.id, valeur: 2 });
  assert.deepEqual(Object.keys(v1), ['id', 'horodatage', 'cause', 'idEtatAvant', 'valeur']); assert.deepEqual(v1.cause, { type: 'tour', id: 'o-1' }); assert.match(v1.id, /^variation-capacite-/);
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'repos', id: 'o-1' }, idEtatAvant: identiteEtatApres(v1), valeur: 3 }), /une cause, une variation/);
  await assert.rejects(() => enregistrerVariationCapacite(magasin, { cause: { type: 'tour', id: 'o-2' }, idEtatAvant: o.id, valeur: 1 }), /part déjà de l'état/);
  const v2 = await enregistrerVariationCapacite(magasin, { cause: { type: 'repos', id: 'tick-1' }, idEtatAvant: identiteEtatApres(v1), valeur: 3 });
  assert.equal(v2.idEtatAvant, 'etat-propre-' + v1.id);
  assert.equal((await magasin.lireTout('variationsCapacite')).length, 2);
});

test('A3. lireCapacite : écrit l\'origine (= plafond) à la première lecture, puis la relit ; reconstruit l\'état courant par la CHAÎNE, identique quel que soit l\'ordre des lignes et après « redémarrage » (nouveau magasin, mêmes lignes)', async () => {
  const magasin = magasinMemoireVive();
  const c0 = await lireCapacite(magasin);
  assert.equal(c0.valeur, 3); assert.equal(c0.idEtat, c0.origine.id); assert.equal(c0.derniere, null); assert.equal(c0.nombreVariations, 0);
  assert.equal((await magasin.lireTout('capaciteInitiale')).length, 1);
  assert.deepEqual(await lireCapacite(magasin), c0);
  await tour(magasin); await tour(magasin); const r = await tickRepos(magasin);
  const c = await lireCapacite(magasin);
  assert.equal(c.valeur, 2); assert.equal(c.idEtat, identiteEtatApres(r.variation)); assert.equal(c.derniere.id, r.variation.id); assert.equal(c.nombreVariations, 3);
  // redémarrage : un autre magasin qui reçoit les mêmes lignes, dans l'ordre inverse
  const autre = magasinMemoireVive();
  for (const t of ['capaciteInitiale', 'variationsCapacite']) for (const ligne of [...(await magasin.lireTout(t))].reverse()) await autre.ecrire(t, JSON.parse(JSON.stringify(ligne)));
  assert.deepEqual(await lireCapacite(autre), c);
  const vA = await lireExecutionsVecues(magasin); const vB = await lireExecutionsVecues(autre);
  const tri = (l) => [...l].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(tri(vA.executions.filter((e) => e.operation.startsWith('soi:'))), tri(vB.executions.filter((e) => e.operation.startsWith('soi:'))));
  assert.deepEqual(tri(vA.valeurs), tri(vB.valeurs));
  // chaîne incohérente : fourche ou ligne hors chaîne = refus (jamais une valeur devinée)
  const casse = magasinMemoireVive();
  for (const t of ['capaciteInitiale', 'variationsCapacite']) for (const ligne of await magasin.lireTout(t)) await casse.ecrire(t, JSON.parse(JSON.stringify(ligne)));
  await casse.ecrire('variationsCapacite', { id: 'variation-capacite-etranger', horodatage: 't', cause: { type: 'tour', id: 'ailleurs' }, idEtatAvant: 'nulle-part', valeur: 1 });
  await assert.rejects(() => lireCapacite(casse), /hors de la chaîne/);
});

test('A4. RÈGLE B1 : épuisement (3 tours actifs → 0, puis tourActif refuse), récupération UNIQUEMENT par tick de repos (0 → 1 → 2 → 3), saturation (repos à 3 : variation « repos » avec état inchangé, c = 3, jamais 4)', async () => {
  const magasin = magasinMemoireVive();
  const t1 = await tour(magasin); assert.equal(t1.avant, 3); assert.equal(t1.apres, 2); assert.equal(t1.variation.cause.type, 'tour');
  const t2 = await tour(magasin); assert.equal(t2.apres, 1);
  const t3 = await tour(magasin); assert.equal(t3.apres, 0);
  await assert.rejects(() => tour(magasin), /capacité est à 0/);
  assert.equal((await lireCapacite(magasin)).valeur, 0); assert.equal((await magasin.lireTout('variationsCapacite')).length, 3);
  const r1 = await tickRepos(magasin); assert.equal(r1.avant, 0); assert.equal(r1.apres, 1); assert.equal(r1.variation.cause.type, 'repos'); assert.match(r1.variation.cause.id, /^tick-propre-/);
  const r2 = await tickRepos(magasin); assert.equal(r2.apres, 2);
  const r3 = await tickRepos(magasin); assert.equal(r3.apres, 3);
  const r4 = await tickRepos(magasin); assert.equal(r4.avant, 3); assert.equal(r4.apres, 3); assert.equal(r4.variation.valeur, 3);
  assert.equal((await magasin.lireTout('variationsCapacite')).length, 7);
  const t4 = await tour(magasin); assert.equal(t4.avant, 3); assert.equal(t4.apres, 2);
  // paramètres injectés : plafond 1 → un seul tour actif possible
  const petit = magasinMemoireVive(); const P1 = Object.freeze({ plafond: 1, coutTourActif: 1, recuperationRepos: 1 });
  assert.equal((await lireCapacite(petit, P1)).valeur, 1);
  assert.equal((await tourActif(petit, { idObservation: 'o-x', horodatage: horodatage() }, P1)).apres, 0);
  await assert.rejects(() => tourActif(petit, { idObservation: 'o-y', horodatage: horodatage() }, P1), /capacité est à 0/);
  assert.equal((await tickRepos(petit, P1)).apres, 1);
});

test('A5. UNE CAUSE = UNE VARIATION : le même tour (même idObservation) ne peut pas consommer deux fois ; entrées invalides refusées avant tout effet', async () => {
  const magasin = magasinMemoireVive();
  await tourActif(magasin, { idObservation: 'observation-unique', horodatage: horodatage() });
  await assert.rejects(() => tourActif(magasin, { idObservation: 'observation-unique', horodatage: horodatage() }), /une cause, une variation|contexte prospectif pour l'acte/);
  assert.equal((await magasin.lireTout('variationsCapacite')).length, 1);
  await assert.rejects(() => tourActif(magasin, { idObservation: '', horodatage: horodatage() }), TypeError);
  await assert.rejects(() => tourActif(magasin, { idObservation: 'o', horodatage: 5 }), TypeError);
  await assert.rejects(() => tourActif(null, { idObservation: 'o', horodatage: horodatage() }), TypeError);
  await assert.rejects(() => tickRepos({}), TypeError);
});

test('A6. AVANT L\'ISSUE : contextes (.72) puis attentes (.74) sur « soi:tour(etat) » / « soi:repos(etat) » écrits dans les tables EXISTANTES, ancrés sur la cause, AVANT la variation ; dès le 3e tour actif une attente « relationValeur = differente » existe et son issue (.75) est « realisee » ; la garde d\'ordre refuse un contexte ou une attente après la variation', async () => {
  const magasin = magasinMemoireVive();
  const a = await tour(magasin); const b = await tour(magasin); const r = await tickRepos(magasin); const c = await tour(magasin);
  const contextes = await magasin.lireTout('contextesProspectifs'); const attentes = await magasin.lireTout('attentesProspectives');
  assert.deepEqual(contextes.map((x) => x.idDesignation), [a.variation.cause.id, b.variation.cause.id, r.variation.cause.id, c.variation.cause.id]);
  for (const x of contextes) { assert.equal(x.application.liaisons[0].entree, 'etat'); assert.ok(x.operation === undefined || /^soi:/.test(x.operation)); }
  assert.equal(contextes[0].application.operation, 'soi:tour'); assert.equal(contextes[2].application.operation, 'soi:repos');
  assert.equal(contextes[0].application.liaisons[0].donnee, (await magasin.lireTout('capaciteInitiale'))[0].id);
  assert.equal(contextes[0].temoins.length, 0); assert.ok(contextes[1].temoins.length > 0);
  assert.deepEqual([a.prospection, b.prospection, r.prospection, c.prospection].map((p) => [p.contextes, p.attentes > 0]), [[1, false], [1, false], [1, false], [1, true]]);
  const attC = attentes.filter((x) => x.idDesignation === c.variation.cause.id);
  assert.ok(attC.some((x) => x.chemin.join('.') === 'relationValeur' && x.constat.valeur === 'differente'));
  for (const x of attC) assert.ok(x.horodatage <= c.variation.horodatage);
  const v = await lireExecutionsVecues(magasin);
  for (const x of attC.filter((x) => x.chemin.join('.') === 'relationValeur')) {
    const issue = issueDeLAttenteProspective(x, contextes.find((k) => k.id === x.idContexte), v.valeurs, v.executions, v.descriptions);
    assert.equal(issue.statut, 'realisee'); assert.deepEqual(issue.reel, { type: 'chaine', valeur: 'differente' }); assert.equal(issue.issue.idExecution, c.variation.id);
  }
  // garde d'ordre : la variation existe → plus aucun contexte ni attente pour cette cause
  const designation = { id: c.variation.cause.id, idObservation: c.variation.cause.id, operation: 'soi:tour', horodatage: horodatage() };
  const pur = (ligne, champs) => Object.fromEntries(champs.map((k) => [k, ligne[k]]));
  await assert.rejects(() => enregistrerContexteProspectif(magasin, { designation, contexte: pur(contextes[3], ['application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins']) }), /variation de capacité existe déjà/);
  await assert.rejects(() => enregistrerAttenteProspective(magasin, { designation, contexte: contextes[3], attente: pur(attC[0], ['idContexte', 'idDesignation', 'structure', 'chemin', 'constat', 'temoinsContexte', 'unitesIssues']) }), /variation de capacité existe déjà/);
});

test('A7. SATURATION DÉMENT UNE ATTENTE : après des repos « differente » répétés, le repos à c = 3 écrit encore l\'attente « differente » puis la variation egale → issue « autre » (réel egale) ; ensuite plus aucune attente directe sur relationValeur pour le repos', async () => {
  const magasin = magasinMemoireVive();
  await tour(magasin); await tour(magasin); await tour(magasin);          // 3 → 0
  const r1 = await tickRepos(magasin); const r2 = await tickRepos(magasin); const r3 = await tickRepos(magasin); // 0 → 3 (r3 : attente differente, réalisée)
  const r4 = await tickRepos(magasin);                                      // 3 → 3 : attente differente écrite avant, démentie
  const r5 = await tickRepos(magasin);                                      // 3 → 3 : deux issues vécues → plus d'attente sur relationValeur
  const contextes = await magasin.lireTout('contextesProspectifs'); const attentes = await magasin.lireTout('attentesProspectives'); const v = await lireExecutionsVecues(magasin);
  const rel = (x) => attentes.filter((a) => a.idDesignation === x.variation.cause.id && a.chemin.join('.') === 'relationValeur');
  assert.equal(rel(r1).length, 0); assert.equal(rel(r2).length, 0);
  assert.equal(rel(r3).length, 1); assert.equal(rel(r4).length, 1); assert.equal(rel(r5).length, 0);
  const issue = (a) => issueDeLAttenteProspective(a, contextes.find((k) => k.id === a.idContexte), v.valeurs, v.executions, v.descriptions);
  assert.equal(issue(rel(r3)[0]).statut, 'realisee');
  const dementie = issue(rel(r4)[0]); assert.equal(dementie.statut, 'autre'); assert.deepEqual(dementie.reel, { type: 'chaine', valeur: 'egale' });
  assert.equal(r4.variation.valeur, 3); assert.equal(r5.variation.valeur, 3);
});

test('A8. AUCUNE VALEUR : la seule lecture de c par un mécanisme est « === 0 » (main.js : porte ; capacite.js : refus à 0 et bornes) ; aucun tri, aucune préférence, aucun score, aucune récompense ; main.js n\'importe de B1 que lireCapacite, tourActif, tickRepos, PARAMETRES_B1', () => {
  const main = sansCommentaires(lu('app', 'main.js')); const cap = sansCommentaires(lu('app', 'langage', 'capacite.js'));
  assert.equal((main.match(/capaciteAvant\.valeur === 0/g) || []).length, 1);
  assert.equal(/capaciteAvant\.valeur\s*[<>]|\.valeur\s*[<>]=?\s*\d|\.valeur\s*!==?\s*0|sort\(|Math\.max\(|Math\.min\(/.test(main.replace(/capaciteAvant\.valeur === 0/g, '')), false);
  assert.match(main, /^import \{ lireCapacite, tourActif, tickRepos, PARAMETRES_B1 \} from '\.\/langage\/capacite\.js';$/m);
  assert.equal(/\.valeur\s*[<>]|sort\(|prefer|préfér|score|recompense|récompense|maximis|bon |mauvais|fatigu|faim/i.test(cap), false);
  assert.equal((cap.match(/c === 0\)/g) || []).length, 1);
  assert.equal(/setInterval|setTimeout|requestAnimationFrame/.test(cap), false, 'aucune cadence autonome dans B1');
  assert.equal(/setInterval\([^)]*(repos|tick|capacit)/i.test(main) || /tickRepos[^\n]*setTimeout|setTimeout[^\n]*tickRepos/.test(main), false, 'aucune cadence autonome du repos dans main.js');
  // capacite.js n'écrit que par les primitives de connaissances.js ; jamais dans valeursDonnees, executionsOperations, designations, emissions
  assert.equal(/ecrire\(/.test(cap), false);
  assert.equal(/valeursDonnees|executionsOperations|designations|'emissions'|receptions/.test(cap), false);
});
// === FIN_TEST_CAPACITE ===
