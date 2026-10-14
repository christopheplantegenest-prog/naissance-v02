// v0.63.74 — attentes prospectives : première attente générale, écrite avant l'issue (décision ChatGPT, 07/10/2026). Preuves : A = constat historique du contexte courant
// (ligne figée), B = constat réel universel des unités d'issue PASSÉES de même { structure, chemin } (contextes antérieurs + issueDuContexteProspectif + constatsParChemin sur la
// partie « après »), égalité par memesConstats ; une unité passée suffit ; 6/1 et identités : aucune attente par les seules couvertures ; conteneurs admis ; absence jamais
// une pseudo-valeur ; plusieurs A ; B figé ; temporalité (exclusion de l'issue courante et du futur, refus après l'issue, séquences) ; point d'écriture ; échec sans issue ;
// table additive (21 / 11 / 24) ; première attente centrale ; mesures scénario réel et sonde ; comportement vivant ; garde anti-règle ; dormance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/attentes-prospectives.js';
import { attentesDuContexteProspectif } from '../app/langage/attentes-prospectives.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { issueDuContexteProspectif } from '../app/langage/issue-contexte-prospectif.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerAttenteProspective, TABLES, CLE, VERSION_BASE, NOM_BASE, ouvrirIndexedDB } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees } from '../app/memoire/sauvegarde.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';

import { attentePlate } from './projection-attente.mjs'; // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : projection de vérification vers la forme plate .64.6
const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'attentes-prospectives.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CONN = readFileSync(join(RACINE, 'app', 'langage', 'connaissances.js'), 'utf8');
const EXEC = readFileSync(join(RACINE, 'app', 'langage', 'execution-sollicitee.js'), 'utf8');
const sansCommentaires = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError && /^attentesDuContexteProspectif : /.test(e.message));
const T = 'attentesProspectives';
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
const ch = { forme: 'scalaire', genre: 'chaine' };
const coll = { forme: 'collection', elements: ch };
const DESC = [
  { nom: 'eclater', entrees: { x: ch }, sortie: coll },
  { nom: 'recoller', entrees: { elements: coll }, sortie: ch },
];
const msg = (id, valeur) => ({ id, valeur });
const lien = (entree, donnee) => ({ entree, donnee });
let seq = 0;
const h = () => `2026-10-07T20:00:${String(++seq).padStart(2, '0')}.000Z`;
const ex = (id, operation, liaisons, resultat, idDesignation = `d-${id}`) => ({ id, horodatage: h(), idDesignation, operation, liaisons, resultat });
// Monde synthétique : expériences m_k -> eclater -> R_k -> recoller -> S_k ; `issues` = valeurs d'arrivée des recoller (par défaut v_k = retour) ; le contexte
// courant est celui écrit avant S_{n+1} ; chaque contexte est écrit avec l'état du magasin à son instant (comme le flux réel).
function monde(n, { issues = [] } = {}) {
  seq = 0;
  const M = []; const E = []; const contextes = []; const designations = [];
  for (let k = 1; k <= n + 1; k += 1) {
    M.push(msg(`m${k}`, `v${k}`));
    E.push(ex(`R${k}`, 'eclater', [lien('x', `m${k}`)], ['v', String(k)]));
    const designation = { id: `d-S${k}`, horodatage: h(), idObservation: `o${k}`, operation: 'recoller', liaisons: [lien('elements', `R${k}`)] };
    designations.push(designation);
    for (const c of contextesProspectifs({ operation: 'recoller', liaisons: [lien('elements', `R${k}`)] }, M, E, DESC)) contextes.push({ id: `c${k}-${c.parent ? 'p' : 'd'}`, horodatage: h(), idDesignation: `d-S${k}`, idObservation: `o${k}`, ...c });
    if (k <= n) E.push(ex(`S${k}`, 'recoller', [lien('elements', `R${k}`)], issues[k - 1] === undefined ? `v${k}` : issues[k - 1], `d-S${k}`));
  }
  const courant = contextes.find((c) => c.id === `c${n + 1}-p`);
  return { M, E, contextes, designations, courant, designation: designations[n], direct: contextes.find((c) => c.id === `c${n + 1}-d`) };
}
// MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : le calcul rend { description, preuve, references } ; les assertions de calcul lisent sa projection plate (même information, aucune
// ajoutée ni perdue : voir projection-attente.mjs) ; la forme elle-même est vérifiée en A3 et B3.
const plat = (a) => (Object.hasOwn(a, 'description') ? attentePlate(a) : a);
const brutes = (w, contexte = w.courant) => attentesDuContexteProspectif(contexte, w.designation, w.contextes, w.M, w.E, DESC);
const attentesDe = (w, contexte = w.courant) => brutes(w, contexte).map(plat);
const cle = (x) => { const a = plat(x); return `${a.chemin.join('.')}=${JSON.stringify(a.constat)}`; };

// ---------------------------------------------------------------------------------------------------------------------------------- A. CALCUL PUR
test('A1. export unique, six paramètres, synchrone ; GARDE ANTI-RÈGLE : aucun nom de champ ni d\'opération, aucun seuil numérique, aucun vote', () => {
  assert.deepEqual(Object.keys(module), ['attentesDuContexteProspectif']);
  assert.equal(attentesDuContexteProspectif.length, 6);
  assert.equal(attentesDuContexteProspectif.constructor.name, 'Function');
  assert.equal(/relationValeur|egale|differente|non_comparable|arrivee|symbolesDeChaine|composerCollection|'valeurs'|'depart'|'vers'|'execution'/.test(CODE), false);
  assert.equal(/length\s*(>=|>|<|<=|===|==)\s*[2-9]|[2-9]\s*(<=|<|>|>=|===|==)\s*\w*\.length|Math\.(max|min|round|floor)|\/\s*\w+\.length|majorit|vote|seuil|score|probab|confiance|certitude|croyance|reussite|réussite/i.test(CODE), false, 'aucun seuil numérique de témoins, aucun vote');
  assert.equal(/\bDate\b|Math\.random|\bawait\b|\basync\b|\bPromise\b|magasin|\.ecrire|\.lireTout|nouvelId/.test(CODE), false);
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./constats-par-chemin.js', './constats-structurels.js', './contexte-prospectif.js', './couverture-occurrences.js', './episodes-de-transformation.js', './issue-contexte-prospectif.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.98 (réutilisation de la vue des épisodes) : .74 calcule une fois la vue de son vécu et la transmet aux issues // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : + contexte-prospectif.js (cheminsOuverts, règle structurelle partagée) ; episodes-de-transformation.js fournit aussi partieConnueEpisode
});

test('A2. PAS D\'ATTENTE SANS PASSÉ D\'ISSUE : un A à un témoin mais aucune unité d\'issue antérieure comparable -> aucune attente', () => {
  const w = monde(1);
  // le contexte courant c2-p a 1 témoin (S1), mais le contexte c1-p (histoire vide) n'a aucun chemin ouvert : aucune unité -> pas de B
  assert.equal(w.courant.temoins.length, 1);
  assert.deepEqual(attentesDe(w), []);
});

test('A3. UN SEUL TÉMOIN PASSÉ suffit : B universel sur sa couverture d\'une unité ; attentes sur tous les chemins où A = B (conteneur compris), témoins exacts conservés', () => {
  const w = monde(2); // c2-p (histoire S1) a eu pour issue S2 ; c3-p courant : histoire S1, S2
  const attentes = attentesDe(w);
  const cles = attentes.map(cle).sort();
  // B (une unité : l'issue de c2-p) : relation egale, valeurs objet, arrivee S2, chemin.1.execution S2, chemin.1.vers S2, valeurs.depart v2, valeurs.arrivee v2 ; A (histoire S1, S2) contient tout cela
  assert.deepEqual(cles, ['arrivee={"type":"chaine","valeur":"S2"}', 'chemin.1.execution={"type":"chaine","valeur":"S2"}', 'chemin.1.vers={"type":"chaine","valeur":"S2"}', 'relationValeur={"type":"chaine","valeur":"egale"}', 'valeurs.arrivee={"type":"chaine","valeur":"v2"}']); // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : le départ m_k est connu (« v_k »), donc `valeurs` et valeurs.depart sont déjà déterminés dans la partie connue : plus d'attente sur eux
  const rel = attentes.find((a) => a.chemin[0] === 'relationValeur');
  assert.deepEqual(rel.temoinsContexte.map((t) => t[0]), ['m1', 'm2'], 'témoins de A dans le contexte courant');
  assert.deepEqual(rel.unitesIssues, [['c2-p', 'S2', 'relationValeur']], 'la seule unité passée ayant établi B'); // MISE À JOUR DÉLIBÉRÉE v0.63.96 (pluralité des issues) : identité d'unité uniforme [idContexte, idExecution, …chemin] (contexte × conséquence × chemin)
  assert.equal(rel.idContexte, 'c3-p'); assert.equal(rel.idDesignation, 'd-S3'); assert.equal(sk(rel.structure), 'eclater(x)>recoller(elements)');
  const brute = brutes(w).find((a) => a.description.chemin[0] === 'relationValeur'); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : les rôles sont des positions de la sortie
  assert.deepEqual([Object.keys(brute), Object.keys(brute.description), Object.keys(brute.preuve), Object.keys(brute.references)], [['description', 'preuve', 'references'], ['structure', 'chemin', 'constat'], ['temoinsContexte', 'unitesIssues'], ['idContexte', 'idDesignation']]);
  assert.deepEqual(Object.keys(rel), ['idContexte', 'idDesignation', 'structure', 'chemin', 'constat', 'temoinsContexte', 'unitesIssues'], 'projection = forme .64.6');
  const direct = attentesDe(w, w.contextes.find((c) => c.id === 'c3-d')); // contexte direct : départ R3 (collection) sans valeur connue -> le conteneur `valeurs` reste ouvert
  assert.equal('valeur' in direct.find((a) => a.chemin.join('.') === 'valeurs').constat, false, 'constat structurel sans valeur'); // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : le départ m_k est connu (« v_k »), donc `valeurs` et valeurs.depart sont déjà déterminés dans la partie connue : plus d'attente sur eux
});

test('A4. IDENTITÉS : dès deux unités passées, les constats réels d\'identité diffèrent -> aucun B -> aucune attente, par les seules couvertures ; relationValeur et valeurs restent', () => {
  const w = monde(3);
  const cles = attentesDe(w).map(cle).sort();
  assert.deepEqual(cles, ['relationValeur={"type":"chaine","valeur":"egale"}']); // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : le départ m_k est connu (« v_k »), donc `valeurs` et valeurs.depart sont déjà déterminés dans la partie connue : plus d'attente sur eux
  const rel = attentesDe(w).find((a) => a.chemin[0] === 'relationValeur');
  assert.deepEqual(rel.unitesIssues.map((u) => u[0]), ['c2-p', 'c3-p']);
  assert.deepEqual(rel.temoinsContexte.map((t) => t[0]), ['m1', 'm2', 'm3']);
});

test('A5. CAS 6/1 : unités passées egale ×6 et differente ×1 -> aucun constat réel universel -> aucune attente pour ce chemin, même si le statut retrouve est universel', () => {
  const w = monde(8, { issues: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'autre', 'v8'] });
  // unités passées pour c9-p : issues de c2-p…c8-p (7 unités : relation egale ×6 — c2…c6 et c8 — et differente ×1 — c7)
  const cles = attentesDe(w).map(cle);
  assert.equal(cles.some((c) => c.startsWith('relationValeur=')), false);
  assert.deepEqual(cles, []); // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : le départ m_k est connu (« v_k »), donc `valeurs` et valeurs.depart sont déjà déterminés dans la partie connue : plus d'attente sur eux
  // les statuts, eux, étaient tous 'retrouve' (vérifié sur les issues) : la régularité de statut ne fait pas une attente
  for (const c of w.contextes.filter((x) => /^c[2-6]-p$|^c8-p$/.test(x.id))) { const i = issueDuContexteProspectif(c, w.M, w.E, DESC); assert.equal(i.chemins.find((x) => x.chemin[0] === 'relationValeur').statut, 'retrouve'); }
  assert.equal(issueDuContexteProspectif(w.contextes.find((x) => x.id === 'c7-p'), w.M, w.E, DESC).chemins.find((x) => x.chemin[0] === 'relationValeur').statut, 'nouveau', 'differente n\'était pas dans l\'histoire de c7-p');
});

test('A6. PLUSIEURS A : le contexte courant connaît egale ET differente, mais toutes les issues comparables passées ont donné egale -> attente egale (A = B strict)', () => {
  // histoire : m1 egale, m2 differente (mais sa propre issue, c2-p, est la première unité : B = relation differente ? non : voir ci-dessous)
  // On construit : S1 = v1 (egale), S2 = autre (differente), puis S3 = v3, S4 = v4 ; au contexte c5-p : A = {egale ×3, differente ×1} ; unités passées c2-p (reel egale), c3-p (reel differente), c4-p (reel egale) -> pas universel.
  // Pour obtenir « A multiple, B universel egale » il faut que l'issue differente soit dans l'histoire sans être une unité : c'est le cas de S1 (c1-p a une histoire vide : aucun chemin ouvert, donc aucune unité).
  const w = monde(3, { issues: ['autre', 'v2', 'v3'] });
  const A = w.courant.chemins.find((c) => c.chemin[0] === 'relationValeur').constats.map((k) => k.valeur).sort();
  assert.deepEqual(A, ['differente', 'egale'], 'le contexte courant connaît deux valeurs');
  const rel = attentesDe(w).find((a) => a.chemin[0] === 'relationValeur');
  assert.deepEqual(rel.constat, { type: 'chaine', valeur: 'egale' });
  assert.deepEqual(rel.unitesIssues.map((u) => u[0]), ['c2-p', 'c3-p'], 'les issues de c2-p et c3-p (egale) ; c1-p n\'avait pas de chemin ouvert');
  assert.deepEqual(rel.temoinsContexte.map((t) => t[0]), ['m2', 'm3'], 'les témoins de A = egale, pas de differente');
});

test('A7. ABSENCE : un chemin absent chez une unité passée casse l\'universalité de ["reel"] -> aucune attente ; aucune pseudo-valeur ABSENT n\'est jamais engagée', () => {
  const descNC = [DESC[0], { nom: 'recoller', entrees: { elements: coll }, sortie: { forme: 'quelconque' } }];
  const w = monde(3, { issues: ['v1', ['pas', 'comparable'], 'v3'] });
  const attentes = attentesDuContexteProspectif(w.courant, w.designation, w.contextes, w.M, w.E, descNC).map(plat); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  assert.equal(attentes.some((a) => a.chemin.join('.') === 'valeurs.arrivee'), false, 'valeurs.arrivee absent chez l\'unité c3-p'); // MISE À JOUR DÉLIBÉRÉE v0.63.97 (découplage des valeurs) : l'arrivée non comparable n'efface plus `valeurs` (le départ comparable garde valeurs.depart) ; l'absence porte désormais sur valeurs.arrivee
  assert.equal(JSON.stringify(attentes).includes('ABSENT'), false);
});

test('A8. FIGEMENT DE B : après une issue differente, l\'ancienne attente (calculée avant) ne change pas ; une nouvelle attente ne se forme plus', () => {
  const w = monde(5);
  const avant = attentesDe(w);
  const fige = structuredClone(avant);
  assert.deepEqual(avant.find((a) => a.chemin[0] === 'relationValeur').unitesIssues.length, 4);
  // l'issue courante S6 est differente ; un contexte suivant c7-p ne reçoit plus d'attente sur relationValeur
  const w2 = monde(6, { issues: ['v1', 'v2', 'v3', 'v4', 'v5', 'autre'] });
  assert.deepEqual(avant, fige);
  assert.equal(attentesDe(w2).some((a) => a.chemin[0] === 'relationValeur'), false);
  assert.deepEqual(attentesDe(w2).map(cle), []); // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : le départ m_k est connu (« v_k »), donc `valeurs` et valeurs.depart sont déjà déterminés dans la partie connue : plus d'attente sur eux
});

test('A9. TEMPORALITÉ EXPLICITE : l\'issue courante, une exécution postérieure et un contexte sans issue sont exclus mécaniquement', () => {
  const w = monde(3);
  const base = attentesDe(w).map(cle);
  // (a) issue courante ajoutée artificiellement (comme si elle existait déjà) : exclue par idDesignation -> même résultat
  const E1 = [...w.E, ex('S4', 'recoller', [lien('elements', 'R4')], 'autre', 'd-S4')];
  assert.deepEqual(attentesDuContexteProspectif(w.courant, w.designation, w.contextes, w.M, E1, DESC).map(cle), base);
  // (b) un contexte et une exécution POSTÉRIEURS à la désignation courante (horodatage plus grand) : exclus
  const futurs = contextesProspectifs({ operation: 'recoller', liaisons: [lien('elements', 'R4')] }, w.M, w.E, DESC).map((c) => ({ id: `f-${c.parent ? 'p' : 'd'}`, horodatage: '2099-01-01T00:00:00.000Z', idDesignation: 'd-futur', idObservation: 'o', ...c }));
  const E2 = [...w.E, { ...ex('Sf', 'recoller', [lien('elements', 'R4')], 'autre', 'd-futur'), horodatage: '2099-01-01T00:00:01.000Z' }];
  const avecFutur = attentesDuContexteProspectif(w.courant, w.designation, [...w.contextes, ...futurs], w.M, E2, DESC);
  assert.deepEqual(avecFutur.map(cle), base, 'une issue differente « future » ne casse pas B');
  // (c) un contexte antérieur sans issue (désignation sans exécution) : aucune unité
  const sansIssue = { ...structuredClone(w.contextes.find((c) => c.id === 'c3-p')), id: 'c-sans', idDesignation: 'd-jamais' };
  assert.deepEqual(attentesDuContexteProspectif(w.courant, w.designation, [...w.contextes, sansIssue], w.M, w.E, DESC).map(cle), base);
  // (d) entrées mal formées
  refuse(() => attentesDuContexteProspectif(null, w.designation, w.contextes, w.M, w.E, DESC));
  refuse(() => attentesDuContexteProspectif(w.courant, { ...w.designation, id: 'autre' }, w.contextes, w.M, w.E, DESC));
  refuse(() => attentesDuContexteProspectif(w.courant, w.designation, 'x', w.M, w.E, DESC));
  refuse(() => attentesDuContexteProspectif({ ...w.courant, chemins: [null] }, w.designation, w.contextes, w.M, w.E, DESC));
});

test('A10. pureté : entrées gelées intactes, appels identiques, aucune référence partagée', () => {
  const w = monde(3);
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  gel(w.courant); gel(w.designation); gel(w.contextes); gel(w.M); gel(w.E);
  const avant = JSON.stringify([w.courant, w.contextes, w.E]);
  const a = attentesDe(w); const b = attentesDe(w);
  assert.deepEqual(a, b); assert.notEqual(a[0], b[0]);
  assert.equal(a[0].structure === w.courant.structure, false);
  assert.equal(JSON.stringify([w.courant, w.contextes, w.E]), avant);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. PERSISTANCE
test('B1. table attentesProspectives : déclarée en dernier, clé id ; VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables ; migration 20 → 21 ne crée que cette table', async () => {
  assert.equal(TABLES[TABLES.length - 8], T); assert.equal(CLE[T], 'id'); assert.equal(TABLES.length, 31); assert.equal(new Set(TABLES).size, 31); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.14 : position -7 → -8 (+ table manifestationsFaits déclarée en dernier : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 30 → 31 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables)
  assert.equal(VERSION_BASE, 25); assert.equal(SCHEMA_SAUVEGARDE, 15); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 24 → 25 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 14 → 15 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables)
  const existants = TABLES.filter((t) => t !== T);
  const donnees = new Map(existants.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null; let nom = null;
  const fabrique = { open(n, v) { nom = n; version = v; const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) }; const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }; Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); }); return r; } };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nom, NOM_BASE); assert.equal(version, 25); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 24 → 25 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables)
  assert.deepEqual(crees, [[T, 'id']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});

test('B2. sauvegarde : schéma 11 exporté/restauré à l\'identique ; schéma 10 complété par [] ; schéma 11 sans la table = incomplet ; schéma 12 refusé', async () => {
  // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : ancienne fixture dépendante de DT6 (les attentes venaient des réexécutions du lot). La sauvegarde est générique à
  // l'origine des attentes : la fixture utilise la sollicitation extérieure (.77) déjà prévue par rejouer (solliciter = true).
  const { magasin } = await rejouer(['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max'], magasinMemoireVive(), true);
  assert.ok((await magasin.lireTout(T)).length > 0);
  const memoire = creerMemoire(creerMagasinMemoire());
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage: magasin, idNaissance: 'id', versionAppli: '0.63.74', maintenant: new Date('2026-10-07T21:00:00Z') });
  assert.equal(fichier.objet.schema, 15); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE — v0.64.14 : 14 → 15 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables)
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  assert.deepEqual(await neuf.lireTout(T), await magasin.lireTout(T));
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 10)[T], []);
  assert.equal(Object.prototype.hasOwnProperty.call(migrerDonnees({ faits: [] }, [T], 15), T), false); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.14 : schéma de sauvegarde courant 14 → 15, futur 15 → 16 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables)
  const { empreinte } = await import('../app/memoire/transfert.js');
  const refaire = async (objet) => { const corps = JSON.stringify(objet.donnees); return JSON.stringify({ ...objet, empreinte: await empreinte(corps) }); };
  const ancien = JSON.parse(fichier.contenu); ancien.schema = 10; delete ancien.donnees.langage[T];
  const lu1 = await lireSauvegardeComplete(await refaire(ancien), { tablesMemoire: TABLES_MEMOIRE }); assert.equal(lu1.ok, true, lu1.erreur); assert.deepEqual(lu1.donnees.langage[T], []);
  const incomplet = JSON.parse(fichier.contenu); delete incomplet.donnees.langage[T];
  const lu2 = await lireSauvegardeComplete(await refaire(incomplet), { tablesMemoire: TABLES_MEMOIRE }); assert.equal(lu2.ok, false); assert.match(lu2.erreur, /incomplet/);
  const futur = JSON.parse(fichier.contenu); futur.schema = 16; // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.14 : schéma de sauvegarde courant 14 → 15, futur 15 → 16 (+ table manifestationsFaits : VERSION_BASE 25, SCHEMA_SAUVEGARDE 15, 31 tables)
  const lu3 = await lireSauvegardeComplete(await refaire(futur), { tablesMemoire: TABLES_MEMOIRE }); assert.equal(lu3.ok, false); assert.match(lu3.erreur, /plus récente/);
});

test('B3. enregistrerAttenteProspective : copie, ancrage (idDesignation, idObservation, idContexte), refus des entrées mal formées ; REFUS si l\'exécution existe déjà ; aucun vocabulaire de confiance', async () => {
  const magasin = magasinMemoireVive();
  const w = monde(2);
  // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : l'attente arrive par rôles ; la ligne garde description / preuve / references et n'ajoute que l'occurrence (id, horodatage, idObservation).
  const [attente] = brutes(w).filter((a) => a.description.chemin[0] === 'relationValeur');
  const ligne = await enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente });
  assert.deepEqual(Object.keys(ligne), ['id', 'horodatage', 'idObservation', 'description', 'preuve', 'references']);
  assert.match(ligne.id, /^attente-prospective-/);
  assert.equal(ligne.references.idDesignation, 'd-S3'); assert.equal(ligne.idObservation, 'o3'); assert.equal(ligne.references.idContexte, 'c3-p');
  for (const role of ['description', 'preuve', 'references']) { assert.deepEqual(ligne[role], attente[role]); assert.notEqual(ligne[role], attente[role]); }
  for (const champ of ['structure', 'chemin', 'constat']) assert.notEqual(ligne.description[champ], attente.description[champ]);
  for (const champ of ['temoinsContexte', 'unitesIssues']) assert.notEqual(ligne.preuve[champ], attente.preuve[champ]);
  const dans = (role, champ, valeur) => ({ ...attente, [role]: { ...attente[role], [champ]: valeur } });
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente, autre: 1 }), TypeError);
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.direct, attente }), TypeError, 'attente d\'un autre contexte');
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: { ...w.designation, id: 'd-autre' }, contexte: w.courant, attente }), TypeError);
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: { ...attente, attendu: 'egale' } }), TypeError);
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: dans('description', 'constat', { type: 'chaine', valeur: 'egale', probable: true }) }), TypeError);
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: dans('preuve', 'unitesIssues', []) }), TypeError, 'sans unité passée, pas d\'attente');
  // validation stricte des rôles : forme plate, groupe manquant, donnée au mauvais rôle, fondation sans relation, références qui ne sont pas celles de l'ancrage
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: attentePlate(attente) }), TypeError, 'forme plate refusée à l\'écriture');
  const { preuve, ...sansPreuve } = attente;
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: sansPreuve }), TypeError, 'groupe manquant');
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: dans('preuve', 'constat', attente.description.constat) }), TypeError, 'donnée au mauvais rôle');
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: dans('references', 'temoinsContexte', preuve.temoinsContexte) }), TypeError, 'donnée au mauvais rôle');
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: dans('description', 'idContexte', 'c3-p') }), TypeError, 'référence au mauvais rôle');
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: dans('preuve', 'fondation', [{ couverture: [['x']], constats: [{}, {}], conditions: [{}] }]) }), TypeError, 'fondation sans relation : incohérente avec une attente .74');
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente: dans('references', 'idContexte', 'c3-d') }), TypeError, 'références');
  assert.equal((await magasin.lireTout(T)).length, 1);
  // après l'issue : impossible
  await magasin.ecrire('executionsOperations', ex('S3', 'recoller', [lien('elements', 'R3')], 'v3', 'd-S3'));
  await assert.rejects(enregistrerAttenteProspective(magasin, { designation: w.designation, contexte: w.courant, attente }), /existe déjà/);
  assert.equal((await magasin.lireTout(T)).length, 1);
  const bloc = sansCommentaires(CONN.slice(CONN.indexOf('// === ATTENTE PROSPECTIVE PERSISTÉE')));
  assert.equal(/confiance|probab|certitude|croyance|reussite|réussite|satisfaite|deçue|déçue|confirm|contradict|relationValeur|egale/i.test(bloc), false);
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. FLUX RÉEL
let compteurIds = 0;
async function rejouer(scenario, magasin = magasinMemoireVive(), solliciter = false) {
  const nouvelId = (p) => `${p}-${++compteurIds}`;
  const tours = []; const parTour = []; const ex2 = () => magasin.lireTout('executionsOperations');
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
    parTour.push((await magasin.lireTout(T)).filter((a) => a.idObservation === s.observation.id).length);
  }
  return { tours, parTour, magasin, valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex2(), contextes: await magasin.lireTout('contextesProspectifs'), attentes: (await magasin.lireTout(T)).map(plat) }; // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente) : lignes lues par projection plate
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const seqDe = (id) => Number(id.match(/-(\d+)-\d+$/)[1]);

test('C1. POINT D\'ÉCRITURE : désignation → contextes → attentes → résolution → invocation → exécution ; séquences désignation < contexte < attente < exécution ; aucun résultat lu', async () => {
  const code = sansCommentaires(EXEC);
  const i = (s) => code.indexOf(s);
  assert.ok(i('enregistrerDesignation(') < i('contextesProspectifs(') && i('contextesProspectifs(') < i('enregistrerContexteProspectif(') && i('enregistrerContexteProspectif(') < i('attentesDuContexteProspectif(') && i('attentesDuContexteProspectif(') < i('enregistrerAttenteProspective(') && i('enregistrerAttenteProspective(') < i('resoudreValeursApplication(') && i('resoudreValeursApplication(') < i('invoquerOperation('));
  assert.equal(/\.resultat|produit|statut/.test(code.slice(i('contextesProspectifs('), i('resoudreValeursApplication('))), false);
  // MISE À JOUR DÉLIBÉRÉE v0.63.93 — DT6 : le point d'écriture (execution-sollicitee.js) est GÉNÉRIQUE à l'origine de la désignation ; le scénario ordinaire
  // n'a plus d'attente (elles venaient des réexécutions DT6) : la fixture enrichit l'univers par sollicitation extérieure ; les attentes vérifiées
  // sont celles des désignations extérieures ET des désignations mécaniques NOUVELLES du lot qui en découlent.
  const { magasin, attentes, executions, contextes } = await rejouer(SCENARIO.slice(0, 4), magasinMemoireVive(), true);
  assert.ok(attentes.length > 0);
  const origines = new Set((await magasin.lireTout('designations')).filter((d) => attentes.some((a) => a.idDesignation === d.id)).map((d) => d.origine)); assert.ok(origines.has('mecanique'), [...origines].join(','));
  const designations = await magasin.lireTout('designations');
  for (const a of attentes) {
    const d = designations.find((x) => x.id === a.idDesignation); const c = contextes.find((x) => x.id === a.idContexte); const e = executions.find((x) => x.idDesignation === a.idDesignation);
    assert.ok(d && c && e);
    assert.ok(seqDe(d.id) < seqDe(c.id) && seqDe(c.id) < seqDe(a.id) && seqDe(a.id) < seqDe(e.id), `${d.id} < ${c.id} < ${a.id} < ${e.id}`);
    assert.ok(a.horodatage <= e.horodatage);
    assert.equal(c.idDesignation, a.idDesignation);
  }
});

test('C2. SCÉNARIO RÉEL 7 tours (MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chaque message est traité ; .93 : 0 attente ; .92 : 28 par réexécutions) : 70 attentes (0,0,8,26,10,12,14) ; aucune application déjà exécutée', async () => {
  const { tours, parTour, attentes, executions } = await rejouer(SCENARIO);
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 5, 13, 13, 13, 13]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 5, 10, 3, 3, 3, 3]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.deepEqual(tours.map((s) => s.dejaExecutees.length), [0, 0, 0, 0, 0, 0, 0]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.equal(executions.length, 29); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation)
  assert.equal(tours.flatMap((s) => s.automatiques).filter((x) => x.statut !== 'executee').length, 0);
  assert.equal(attentes.length, 70); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
  assert.deepEqual(parTour, [0, 0, 8, 26, 10, 12, 14]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
});

test('C2 bis. MÉCANISME DES ATTENTES DU LOT (scénario dédié : univers enrichi par sollicitation extérieure ; désignations MÉCANIQUES NOUVELLES) : des attentes sont écrites pour des désignations mécaniques du lot, toutes avec issue ; relationValeur et identités engagées apparaissent ; témoins/unités cohérents', async () => {
  const { magasin, tours, attentes, executions } = await rejouer(SCENARIO, magasinMemoireVive(), true);
  const designations = await magasin.lireTout('designations');
  const mecaniques = new Set(tours.flatMap((s) => s.automatiques.map((r) => r.designation.id)));
  for (const s of tours) assert.deepEqual(s.dejaExecutees, [], 'le lot n\'a que des applications NOUVELLES');
  const duLot = attentes.filter((a) => mecaniques.has(a.idDesignation));
  assert.ok(duLot.length > 0);
  for (const a of duLot) { assert.equal(designations.find((d) => d.id === a.idDesignation).origine, 'mecanique'); assert.ok(executions.some((e) => e.idDesignation === a.idDesignation), 'avec issue'); assert.ok(a.unitesIssues.length >= 1); assert.equal(a.temoinsContexte.length >= a.unitesIssues.length, true); }
  const chemins = new Set(duLot.map((a) => a.chemin[0])); assert.ok(chemins.has('relationValeur'), [...chemins].join(','));
});

test('C3. SONDE SIX EXPÉRIENCES : première attente centrale à T4 (A egale ×2, B une unité : l\'issue du contexte de T3) ; puis 3/2, 4/3, 5/4 ; aucun nom de champ dans le mécanisme', async () => {
  const { attentes, parTour, contextes, magasin } = await rejouer(['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'], undefined, true);
  assert.deepEqual(parTour, [0, 0, 8, 37, 13, 15, 17]); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
  assert.equal(attentes.length, 90); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : chiffres mesurés ; chaque message est désormais traité (symbolesDeChaine et parcourirStructure déterminées relativement à l’observation) // MISE À JOUR DÉLIBÉRÉE v0.63.97 — DÉCOUPLAGE DES VALEURS D’ÉPISODE : chiffres mesurés ; chaque extrémité comparable porte sa valeur, de nouveaux chemins valeurs.* deviennent observables // MISE À JOUR DÉLIBÉRÉE v0.64.0 — CHEMINS OUVERTS DE L’ÉPISODE PRÉSENT : chiffres mesurés ; plus aucune attente sur un chemin déjà connu dans la partie connue (valeurs, valeurs.depart)
  const centrales = attentes.filter((a) => sk(a.structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)' && a.chemin[0] === 'relationValeur');
  assert.equal(centrales.length, 4);
  assert.deepEqual(centrales.map((a) => `${a.temoinsContexte.length}/${a.unitesIssues.length}`), ['2/1', '3/2', '4/3', '5/4']);
  for (const a of centrales) assert.deepEqual(a.constat, { type: 'chaine', valeur: 'egale' });
  const premiere = centrales[0];
  const observations = await magasin.lireTout('observationsPossibilites');
  assert.equal(observations.findIndex((o) => o.id === premiere.idObservation) + 1, 4, 'T4');
  const contexte = contextes.find((c) => c.id === premiere.idContexte);
  assert.equal(contexte.temoins.length, 2);
  assert.deepEqual(premiere.unitesIssues.length, 1);
  const unite = contextes.find((c) => c.id === premiere.unitesIssues[0][0]);
  assert.equal(unite.temoins.length, 1, 'l\'unité B est le contexte central de T3 (1 témoin), dont l\'issue egale est connue');
  const executionUnite = (await magasin.lireTout('executionsOperations')).find((e) => e.idDesignation === unite.idDesignation);
  assert.deepEqual(premiere.unitesIssues[0].slice(1), [executionUnite.id, 'relationValeur']); // MISE À JOUR DÉLIBÉRÉE v0.63.96 (pluralité des issues) : identité d'unité uniforme [idContexte, idExecution, …chemin] ; idExecution = l'exécution (unique) de la désignation de ce contexte
  // conteneur : attente ["valeurs"] objet aux mêmes tours ; identités et valeurs : seulement à T4 (une unité) puis plus jamais
  const centraux = attentes.filter((a) => sk(a.structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)');
  const parChemin = {}; for (const a of centraux) { const k = a.chemin.join('.'); parChemin[k] = (parChemin[k] ?? 0) + 1; }
  assert.deepEqual(parChemin, { arrivee: 1, 'chemin.1.execution': 1, 'chemin.1.vers': 1, relationValeur: 4, 'valeurs.arrivee': 1 }); // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : le départ m_k est connu (« v_k »), donc `valeurs` et valeurs.depart sont déjà déterminés dans la partie connue : plus d'attente sur eux
});

test('C4. ÉCHEC D\'EXÉCUTION APRÈS ATTENTE : l\'attente reste, sans issue, sans qualification', async () => {
  const { tours, magasin } = await rejouer(['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max']);
  const { observation, univers } = tours[3];
  const message = (await magasin.lireTout('valeursDonnees')).at(-1);
  const panne = { ...TABLE_OPERATIONS, symbolesDeChaine: { ...TABLE_OPERATIONS.symbolesDeChaine, fonction: () => { throw new Error('panne volontaire'); } } };
  const avant = (await magasin.lireTout(T)).length;
  // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : le lot de T4 a déjà exécuté symbolesDeChaine(message de T4) (déterminée relativement à
  // l'observation). La sollicitation extérieure en panne porte donc sur l'AUTRE candidat, resté choix à faire : la chaîne historique (production).
  const autre = observation.possibilites.find((p) => p.operation === 'symbolesDeChaine' && p.donnee !== message.id).donnee;
  const r = await executerApplicationSollicitee({ observation, application: { operation: 'symbolesDeChaine', liaisons: [lien('chaine', autre)] }, univers }, { magasin, table: panne });
  assert.equal(r.statut, 'echec_invocation');
  const miennes = (await magasin.lireTout(T)).map(plat).filter((a) => a.idDesignation === r.designation.id); // MISE À JOUR DÉLIBÉRÉE v0.64.7 (rôles de l'attente)
  assert.ok(miennes.length >= 1, 'des attentes écrites avant l\'invocation');
  assert.deepEqual(miennes.map((a) => a.chemin.join('.')).sort(), ['relationValeur'], 'une seule attente (relation non comparable)'); // MISE À JOUR DÉLIBÉRÉE v0.64.0 (chemins ouverts de l'épisode présent) : le départ de symbolesDeChaine est connu, `valeurs` n'est plus un chemin ouvert ; retour à l'attente unique d'avant v0.63.97
  assert.equal(miennes.some((a) => a.chemin[0] === 'relationValeur' && a.unitesIssues.length === 3), true); // MISE À JOUR DÉLIBÉRÉE v0.63.94 — CAUSALITÉ LOCALE : mesuré, trois unités passées (symbolesDeChaine est désormais exécutée à chaque message)
  assert.equal((await magasin.lireTout('executionsOperations')).some((e) => e.idDesignation === r.designation.id), false);
  assert.ok((await magasin.lireTout(T)).length > avant);
  for (const a of miennes) assert.equal(/echec|échec|erreur|deçue|déçue/.test(JSON.stringify(a)), false);
});

test('C5. COMPORTEMENT VIVANT / DORMANCE : seul execution-sollicitee importe le calcul ; aucun mécanisme de choix, d\'exécution, d\'esprit ou de réponse ne lit la table ; catalogue et table inchangés', () => {
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /from '\.\/attentes-prospectives\.js'/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1));
  assert.deepEqual(importeurs, ['app/langage/capacite.js', 'app/langage/environnement-conversation.js', 'app/langage/execution-sollicitee.js', 'app/langage/prospection-soi.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + prospection-soi.js : le calcul commun aux conséquences sur soi (B1 et B2), ancrage = la désignation ; capacite.js le garde pour le tour actif // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1) : + capacite.js : la variation de l'état propre est un acte prospectif sur soi (mêmes primitives, même calcul, ancrage = identité de la cause) // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + environnement-conversation.js : l'ÉMISSION est un acte prospectif (mêmes primitives, même calcul, ancrage = identité de l'émission)
  for (const f of fichiersJs(join(RACINE, 'app'))) {
    const r = f.slice(RACINE.length + 1); const code = sansCommentaires(readFileSync(f, 'utf8'));
    if (r === 'app/langage/connaissances.js' || r === 'app/langage/execution-sollicitee.js' || r === 'app/langage/attentes-prospectives.js' || r === 'app/memoire/sauvegarde.js') continue;
    if (r === 'app/langage/prospection-soi.js' || r === 'app/langage/relation.js' || r === 'app/langage/tick-propre.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : les conséquences sur soi écrivent contextes et attentes avec les mêmes primitives (aucune lecture pour décider)
    if (r === 'app/langage/capacite.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1) : B1 écrit contextes et attentes sur soi avec les mêmes primitives (aucune lecture pour décider)
    if (r === 'app/langage/environnement-conversation.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.83 : l'ÉMISSION est un acte prospectif : environnement-conversation.js écrit contextes et attentes avec les mêmes primitives (aucune lecture pour décider)
    if (r === 'app/langage/attentes-du-tour.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.78 (jalon 1) : attentes-du-tour.js LIT la table (lireTout, lecture seule) pour PRÉSENTER les attentes du lot et leurs issues dans la zone de développement ; aucun mécanisme de choix, d'exécution, d'esprit ou de réponse ne la lit.
    assert.equal(/attentesProspectives|attentes-prospectives|attentesDuContexteProspectif|enregistrerAttenteProspective/.test(code), false, r);
  }
  assert.equal(/lireTout\(\s*['"]attentesProspectives/.test(sansCommentaires(CONN)), false, 'la table n\'est lue par aucune fonction');
  assert.equal(/lireTout\(\s*['"]attentesProspectives/.test(sansCommentaires(EXEC)), false);
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
