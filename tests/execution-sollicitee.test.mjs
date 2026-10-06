// v0.63.34 — EXÉCUTER UNE APPLICATION EXPLICITEMENT SOLLICITÉE (décision ChatGPT, 05/10/2026). Preuves : la chaîne désignation (origine
// « exterieure ») → résolution → invocation → exécution tourne exactement dans cet ordre pour l'application FOURNIE ; la désignation reste si la
// suite échoue ; rien n'est invoqué si la désignation échoue ; aucune sélection ni nouvel essai ; la production devient un vécu du tour suivant ;
// primitive dormante ; catalogue, P/V/S et versions inchangés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import * as module from '../app/langage/execution-sollicitee.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { identifierMessage } from '../app/langage/pont.js';
import { groupesDeCandidats } from '../app/langage/groupes-candidats.js';
import { applicationUnique } from '../app/langage/application-unique.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const SRC = readFileSync(join(RACINE, 'app', 'langage', 'execution-sollicitee.js'), 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const PIXEL = [{ chemin: [], type: 'chaine', valeur: 'bonjour Pixel' }];

// Magasin en mémoire qui journalise chaque écriture (table, dans l'ordre) et peut échouer sur une table donnée.
function magasinJournal({ echecSur = null, journal = [] } = {}) {
  const m = magasinMemoireVive();
  return {
    journal,
    async ecrire(table, objet) { if (table === echecSur) throw new Error(`panne ${table}`); journal.push(`ecrire:${table}`); return m.ecrire(table, objet); },
    lireTout: (t) => m.lireTout(t),
  };
}
// Un tour réel : message → observation (UNE ligne écrite) → univers, avec les primitives actives.
async function tour(magasin, texte, n) {
  let k = n * 100;
  const message = identifierMessage(texte, { nouvelId: (p) => `${p}-${++k}` });
  const r = await observerPossibilites(message, {
    enregistrer: (d) => enregistrerObservationPossibilites(magasin, d),
    lireExecutions: () => magasin.lireTout('executionsOperations'),
  });
  assert.equal(r.statut, 'ecrite');
  return { message, observation: r.observation, univers: r.univers };
}
const uniqueDe = (observation) => {
  const g = groupesDeCandidats(observation.possibilites, DESCRIPTIONS_OPERATIONS);
  return applicationUnique(g);
};
// MISE À JOUR DÉLIBÉRÉE v0.63.38 : le message seul a désormais DEUX applications déterminées (parcourirStructure, symbolesDeChaine) : applicationUnique rend « plusieurs ».
// Le TEST construit lui-même l'application visée (le rôle de la personne qui sollicite) ; aucune primitive ne choisit.
const applicationDe = (observation, operation) => {
  const g = groupesDeCandidats(observation.possibilites, DESCRIPTIONS_OPERATIONS).find((x) => x.operation === operation);
  return { operation, liaisons: g.entrees.map((e) => { assert.equal(e.donnees.length, 1); return { entree: e.entree, donnee: e.donnees[0] }; }) };
};
const appel = (monde, application, extra = {}, table = TABLE_OPERATIONS) => executerApplicationSollicitee(
  { observation: monde.observation, application, univers: monde.univers, ...extra }, { magasin: monde.magasin, table });
async function monde1(options) {
  const magasin = magasinJournal(options);
  const t = await tour(magasin, 'bonjour Pixel', 1);
  return { magasin, ...t, application: applicationDe(t.observation, 'parcourirStructure') };
}

test('A1. export unique ; fonction asynchrone ; deux paramètres (entrée, dépendances) ; AUCUN paramètre origine', () => {
  assert.deepEqual(Object.keys(module), ['executerApplicationSollicitee']);
  assert.equal(executerApplicationSollicitee.constructor.name, 'AsyncFunction');
  assert.equal(executerApplicationSollicitee.length, 2);
});
test('B1. CAS RÉEL MINIMAL : « bonjour Pixel » → application unique (construite par le TEST) → désignation externe puis exécution réelle', async () => {
  const w = await monde1();
  assert.deepEqual(w.application, { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: w.message.id }] });
  const r = await appel(w, w.application);
  assert.equal(r.statut, 'executee');
  assert.equal(r.erreur, null);
  assert.deepEqual(Object.keys(r), ['statut', 'designation', 'execution', 'erreur']);
  assert.deepEqual(r.execution.resultat, PIXEL);
  assert.equal(r.designation.origine, 'exterieure');
  assert.equal(r.designation.operation, 'parcourirStructure');
  assert.equal(r.designation.idObservation, w.observation.id);
  assert.deepEqual(r.execution.liaisons, w.application.liaisons);
  assert.equal(r.execution.idDesignation, r.designation.id);
  assert.equal(r.execution.operation, 'parcourirStructure');
  assert.equal('origine' in r.execution, false);
  const d = (await w.magasin.lireTout('designations')); const x = (await w.magasin.lireTout('executionsOperations'));
  assert.deepEqual(d, [r.designation]); assert.deepEqual(x, [r.execution]);
  assert.equal(d.find((l) => l.id === x[0].idDesignation).origine, 'exterieure');
});
test('B2. FERMETURE AU TOUR SUIVANT : l\'exécution est une production décrite et entre dans l\'univers des possibilités du tour suivant', async () => {
  const w = await monde1();
  const r = await appel(w, w.application);
  const lignes = await w.magasin.lireTout('executionsOperations');
  const P = productionsDecrites(lignes, DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(P.map((p) => p.identite), [r.execution.id]);
  const t2 = await tour(w.magasin, 'salut Pixel', 2);
  assert.deepEqual(t2.univers.map((u) => u.donnee.identite), [t2.message.id, r.execution.id, `entrees-de-production:${r.execution.id}`]); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : + entrées(P) après les productions
  assert.equal(t2.observation.possibilites.some((a) => a.donnee === r.execution.id), true);
  assert.equal(t2.observation.possibilites.some((a) => a.donnee === t2.message.id), true);
});
test('C1. ORDRE : désignation → résolution → invocation → exécution (journal commun, résolution observée par un porteur instrumenté)', async () => {
  const journal = [];
  const w = await monde1({ journal }); journal.length = 0;
  const univers = w.univers.map((u) => ({ ...u, porteur: new Proxy(u.porteur, { getOwnPropertyDescriptor(c, k) { journal.push('resolution'); return Reflect.getOwnPropertyDescriptor(c, k); } }) }));
  const table = { ...TABLE_OPERATIONS, parcourirStructure: { ...TABLE_OPERATIONS.parcourirStructure, fonction: (v) => { journal.push('invocation'); return TABLE_OPERATIONS.parcourirStructure.fonction(v); } } };
  const r = await executerApplicationSollicitee({ observation: w.observation, application: w.application, univers }, { magasin: w.magasin, table });
  assert.equal(r.statut, 'executee');
  assert.deepEqual(journal.filter((e, i) => e !== 'resolution' || journal[i - 1] !== 'resolution'), ['ecrire:designations', 'resolution', 'invocation', 'ecrire:executionsOperations']); // la lecture d'un porteur peut toucher plusieurs descripteurs : on ne compte que la séquence
});
test('D1. ÉCHEC DE RÉSOLUTION : désignation CONSERVÉE, aucune invocation, aucune exécution', async () => {
  const journal = []; const w = await monde1({ journal }); journal.length = 0;
  let appels = 0;
  const table = { parcourirStructure: { ...TABLE_OPERATIONS.parcourirStructure, fonction: () => { appels += 1; return []; } } };
  const r = await executerApplicationSollicitee({ observation: w.observation, application: w.application, univers: [] }, { magasin: w.magasin, table });
  assert.equal(r.statut, 'echec_resolution');
  assert.equal(r.execution, null);
  assert.equal(r.erreur instanceof TypeError, true);
  assert.equal(appels, 0);
  assert.deepEqual(journal, ['ecrire:designations']);
  assert.deepEqual(await w.magasin.lireTout('designations'), [r.designation]);
  assert.deepEqual(await w.magasin.lireTout('executionsOperations'), []);
});
test('D2. OPÉRATION INCONNUE de la table : désignation conservée, aucune exécution', async () => {
  const journal = []; const w = await monde1({ journal }); journal.length = 0;
  const r = await appel(w, w.application, {}, {});
  assert.equal(r.statut, 'echec_invocation');
  assert.equal(r.erreur instanceof TypeError, true);
  assert.equal(r.execution, null);
  assert.deepEqual(journal, ['ecrire:designations']);
  assert.equal((await w.magasin.lireTout('designations')).length, 1);
});
test('D3. L\'OPÉRATION LÈVE (erreur d\'origine, même référence) : désignation conservée, aucune exécution, aucun nouvel essai', async () => {
  const journal = []; const w = await monde1({ journal }); journal.length = 0;
  const boom = new Error('boum'); let appels = 0;
  const table = { parcourirStructure: { ...TABLE_OPERATIONS.parcourirStructure, fonction: () => { appels += 1; throw boom; } } };
  const r = await appel(w, w.application, {}, table);
  assert.equal(r.statut, 'echec_invocation');
  assert.equal(r.erreur, boom);
  assert.equal(appels, 1);
  assert.deepEqual(journal, ['ecrire:designations']);
  assert.deepEqual(await w.magasin.lireTout('executionsOperations'), []);
});
test('D4. PANNE D\'ÉCRITURE DE L\'EXÉCUTION : désignation conservée (aucun retour en arrière), aucune ligne d\'exécution', async () => {
  const journal = []; const w = await monde1({ journal, echecSur: 'executionsOperations' }); journal.length = 0;
  const r = await appel(w, w.application);
  assert.equal(r.statut, 'echec_execution');
  assert.equal(r.erreur.message, 'panne executionsOperations');
  assert.equal(r.execution, null);
  assert.deepEqual(journal, ['ecrire:designations']);
  assert.deepEqual(await w.magasin.lireTout('designations'), [r.designation]);
  assert.deepEqual(await w.magasin.lireTout('executionsOperations'), []);
});
test('D5. RÉSULTAT NON ENREGISTRABLE (racine undefined) : aucune exécution fabriquée, désignation conservée', async () => {
  const w = await monde1();
  const table = { parcourirStructure: { ...TABLE_OPERATIONS.parcourirStructure, fonction: () => undefined } };
  const r = await appel(w, w.application, {}, table);
  assert.equal(r.statut, 'echec_execution');
  assert.equal(r.execution, null);
  assert.deepEqual(await w.magasin.lireTout('executionsOperations'), []);
  assert.equal((await w.magasin.lireTout('designations')).length, 1);
});
test('E1. ÉCHEC DE DÉSIGNATION (application étrangère à l\'observation) : ni résolution, ni invocation, ni exécution, aucune désignation écrite', async () => {
  const journal = []; const w = await monde1({ journal }); journal.length = 0;
  let appels = 0; let lectures = 0;
  const table = { parcourirStructure: { ...TABLE_OPERATIONS.parcourirStructure, fonction: () => { appels += 1; return []; } } };
  const univers = w.univers.map((u) => ({ ...u, porteur: new Proxy(u.porteur, { getOwnPropertyDescriptor(c, k) { lectures += 1; return Reflect.getOwnPropertyDescriptor(c, k); } }) }));
  for (const etrangere of [
    { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'donnee-etrangere' }] },
    { operation: 'memesCouvertures', liaisons: [{ entree: 'a', donnee: w.message.id }] },
    { operation: 'parcourirStructure', liaisons: [{ entree: 'autre', donnee: w.message.id }] },
  ]) {
    const r = await executerApplicationSollicitee({ observation: w.observation, application: etrangere, univers }, { magasin: w.magasin, table });
    assert.equal(r.statut, 'echec_designation');
    assert.equal(r.designation, null); assert.equal(r.execution, null);
    assert.equal(r.erreur instanceof TypeError, true);
  }
  assert.equal(appels, 0); assert.equal(lectures, 0);
  assert.deepEqual(journal, []);
  assert.deepEqual(await w.magasin.lireTout('designations'), []);
  assert.deepEqual(await w.magasin.lireTout('executionsOperations'), []);
});
test('E2. PANNE D\'ÉCRITURE DE LA DÉSIGNATION : aucune suite (ni résolution, ni invocation, ni exécution)', async () => {
  const w = await monde1({ echecSur: 'designations' });
  let appels = 0;
  const table = { parcourirStructure: { ...TABLE_OPERATIONS.parcourirStructure, fonction: () => { appels += 1; return []; } } };
  const r = await appel(w, w.application, {}, table);
  assert.equal(r.statut, 'echec_designation');
  assert.equal(r.erreur.message, 'panne designations');
  assert.equal(appels, 0);
  assert.deepEqual(await w.magasin.lireTout('executionsOperations'), []);
});
test('F1. PLUSIEURS APPLICATIONS POSSIBLES : l\'application FOURNIE est exécutée exactement, sans refus, sans comparaison, sans préférence', async () => {
  const w1 = await monde1();
  const r1 = await appel(w1, w1.application);
  const t2 = await tour(w1.magasin, 'salut Pixel', 2);
  assert.equal(uniqueDe(t2.observation).etat, 'plusieurs');
  const sur = (donnee) => ({ operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee }] });
  const w2 = { magasin: w1.magasin, observation: t2.observation, univers: t2.univers };
  const rProduction = await appel(w2, sur(r1.execution.id));
  assert.equal(rProduction.statut, 'executee');
  assert.deepEqual(rProduction.execution.liaisons, [{ entree: 'valeur', donnee: r1.execution.id }]);
  assert.equal(rProduction.execution.resultat.some((o) => o.valeur === 'bonjour Pixel' && o.chemin.join() === '0,valeur'), true);
  const rMessage = await appel(w2, sur(t2.message.id));
  assert.equal(rMessage.statut, 'executee');
  assert.deepEqual(rMessage.execution.resultat, [{ chemin: [], type: 'chaine', valeur: 'salut Pixel' }]);
  assert.notEqual(rProduction.execution.id, rMessage.execution.id);
  assert.equal((await w1.magasin.lireTout('executionsOperations')).length, 3);
});
test('G1. APPLICATION INVALIDE : aucune invocation, aucune exécution, aucune désignation invalide écrite (déjà couvert par E1) ; application partielle d\'une opération complète acceptée telle que la désignation l\'accepte', async () => {
  const w = await monde1();
  const r = await appel(w, { operation: 'parcourirStructure', liaisons: [] });
  assert.equal(r.statut, 'echec_designation');
  assert.deepEqual(await w.magasin.lireTout('designations'), []);
});
test('H1. DEUX SOLLICITATIONS IDENTIQUES : deux désignations, deux exécutions, chacune liée à la sienne, aucune déduplication', async () => {
  const w = await monde1();
  const a = await appel(w, w.application); const b = await appel(w, w.application);
  assert.equal(a.statut, 'executee'); assert.equal(b.statut, 'executee');
  assert.notEqual(a.designation.id, b.designation.id);
  assert.equal(a.execution.idDesignation, a.designation.id);
  assert.equal(b.execution.idDesignation, b.designation.id);
  assert.notEqual(a.execution.id, b.execution.id);
  assert.equal((await w.magasin.lireTout('designations')).length, 2);
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 2);
  assert.equal(a.designation.origine, 'exterieure'); assert.equal(b.designation.origine, 'exterieure');
});
test('I1. LIAISONS ET RÉSULTAT : opération à deux entrées, liaisons canoniques de l\'application, résultat exactement celui de l\'invocation', async () => {
  const magasin = magasinJournal();
  const A = { id: 'A', texte: 'x' }; const B = { id: 'B', texte: 'y' };
  const observation = { id: 'observation-possibilites-7', possibilites: [{ donnee: 'A', operation: 'memesCouvertures', entree: 'a' }, { donnee: 'B', operation: 'memesCouvertures', entree: 'b' }, { donnee: 'A', operation: 'memesCouvertures', entree: 'b' }] };
  const univers = [{ donnee: { identite: 'A' }, porteur: A, acces: { champ: 'texte' } }, { donnee: { identite: 'B' }, porteur: B, acces: { champ: 'texte' } }];
  let recu;
  const table = { memesCouvertures: { fonction: (a, b) => { recu = [a, b]; return true; }, appel: 'positionnel', parametres: ['a', 'b'] } };
  const application = { operation: 'memesCouvertures', liaisons: [{ entree: 'b', donnee: 'B' }, { entree: 'a', donnee: 'A' }] };
  const r = await executerApplicationSollicitee({ observation, application, univers }, { magasin, table });
  assert.equal(r.statut, 'executee');
  assert.deepEqual(recu, ['x', 'y']);
  assert.deepEqual(r.execution.liaisons, [{ entree: 'a', donnee: 'A' }, { entree: 'b', donnee: 'B' }]);
  assert.deepEqual(r.designation.liaisons, r.execution.liaisons);
  assert.equal(r.execution.resultat, true);
  // l'autre application (a←A, b←A) est possible : celle fournie est la seule exécutée
  assert.equal((await magasin.lireTout('executionsOperations')).length, 1);
});
test('I2. RÉSULTAT NON TRANSFORMÉ : l\'exécution persiste exactement ce que l\'opération a rendu (copie JSON, mêmes valeurs)', async () => {
  const w = await monde1();
  const rendu = [{ chemin: [], type: 'chaine', valeur: 'x' }, { z: [1, 2, { a: null }] }];
  const table = { parcourirStructure: { ...TABLE_OPERATIONS.parcourirStructure, fonction: () => rendu } };
  const r = await appel(w, w.application, {}, table);
  assert.deepEqual(r.execution.resultat, rendu);
});
test('J1. ORIGINE : aucun paramètre ; une `origine` ou tout champ étranger est refusé AVANT tout effet ; entrées invalides = TypeError sans effet', async () => {
  const w = await monde1(); w.magasin.journal.length = 0;
  const base = { observation: w.observation, application: w.application, univers: w.univers };
  const dep = { magasin: w.magasin, table: TABLE_OPERATIONS };
  const piege = { ...base }; Object.defineProperty(piege, 'univers', { enumerable: true, get() { throw new Error('accesseur exécuté'); } });
  const cas = [
    [{ ...base, origine: 'exterieure' }, dep], [{ ...base, origine: 'naissance' }, dep], [base, { ...dep, origine: 'exterieure' }],
    [null, dep], [[], dep], ['x', dep], [base, null], [base, {}], [{ observation: base.observation }, dep],
    [piege, dep], [base, { magasin: null, table: TABLE_OPERATIONS }], [base, { magasin: w.magasin, table: null }],
    [Object.create(base), dep],
  ];
  for (const [e, d] of cas) await assert.rejects(executerApplicationSollicitee(e, d), (err) => err instanceof TypeError && !/accesseur exécuté/.test(err.message));
  assert.deepEqual(w.magasin.journal, []);
});
test('K1. STATIQUE : imports exacts ; origine écrite une seule fois, en dur ; aucune sélection, boucle, recherche, nouvel essai ni unicité', () => {
  assert.deepEqual(CODE.match(/^\s*import\b.*$/gm), [
    'import { enregistrerDesignation, enregistrerExecutionOperation, nouvelId } from \'./connaissances.js\';', // MISE À JOUR DÉLIBÉRÉE v0.63.46 : + nouvelId (identités des sous-données, créées une fois avant l'écriture)
    'import { preparerSousDonnees } from \'./sous-donnees.js\';', // MISE À JOUR DÉLIBÉRÉE v0.63.46 : calcul + validation des sous-données côté appelant (α2-ligne)
    'import { resoudreValeursApplication } from \'./valeurs-application.js\';',
    'import { invoquerOperation } from \'./invocation-operations.js\';',
    'import { verifierApplicationAuCatalogue } from \'./conformite-application.js\';', // MISE À JOUR DÉLIBÉRÉE v0.63.40 : étape 0, conformité application ↔ catalogue
    'import { DESCRIPTIONS_OPERATIONS } from \'./descriptions-operations.js\';', // MISE À JOUR DÉLIBÉRÉE v0.63.40 : catalogue par défaut du contrôle
  ]);
  assert.equal((CODE.match(/'exterieure'/g) || []).length, 1);
  assert.equal(/origine\s*:\s*['"]|origine\s*=/.test(CODE.replace("origine: ORIGINE_SOLLICITATION", '')), false);
  for (const nom of ['applicationUnique', 'application-unique', 'groupesDeCandidats', 'groupes-candidats', 'possibilitesDeLiaison', 'TABLE_OPERATIONS', 'table-operations',
    'productionsDecrites', 'observerPossibilites', 'Math', 'random', 'switch', 'case', 'while', 'do', 'retry', 'reessayer', 'score', 'seuil', 'priorite', 'hasard', 'curiosite', 'preference', 'nouveaute',
    'universValeurs', 'produireConstats', 'produireSuites', 'parcourirStructure', 'tokeniser', 'split', 'Array\\.from', 'codePointAt', 'JSON', 'Date', 'localStorage', 'setTimeout']) {
    assert.ok(!new RegExp(`(?<![\\w.])${nom}(?![\\w])`).test(CODE.replace(/'[^'\n]*'|`[^`\n]*`/g, "''")), nom);
  }
  assert.equal(/\[\s*0\s*\]|\.find\(|\.filter\(|\.map\(|\.sort\(|\.some\(|\.every\(|\.reduce\(|\.slice\(|\.keys\(|\.values\(|\.entries\(/.test(CODE), false);
  assert.equal((CODE.match(/enregistrerDesignation\(/g) || []).length, 1);
  assert.equal((CODE.match(/resoudreValeursApplication\(/g) || []).length, 1);
  assert.equal((CODE.match(/invoquerOperation\(/g) || []).length, 1);
  assert.equal((CODE.match(/enregistrerExecutionOperation\(/g) || []).length, 1);
  assert.equal((CODE.match(/\btry\b/g) || []).length, 5) // MISE À JOUR DÉLIBÉRÉE v0.63.40 : 4 -> 5 (try du contrôle de conformité);
  assert.equal((CODE.match(/\bawait\b/g) || []).length, 2);
  assert.equal((CODE.match(/\bfor\b/g) || []).length, 1); // la seule boucle : contrôle des clés closes de l'ENTRÉE (jamais d'application ni de possibilité)
  assert.ok(CODE.indexOf('for (') < CODE.indexOf('export async function') && CODE.indexOf('for (') > CODE.indexOf('function clesExactes'));
  const o = ['enregistrerDesignation(', 'resoudreValeursApplication(', 'invoquerOperation(', 'enregistrerExecutionOperation('].map((n) => CODE.indexOf(n, CODE.indexOf('export async function')));
  assert.deepEqual(o, [...o].sort((a, b) => a - b));
});
test('K2. COMPORTEMENT SANS CHOIX : l\'espace n\'est jamais consulté — ni refus quand plusieurs applications existent, ni nouvelle tentative après échec', async () => {
  const w = await monde1();
  const r1 = await appel(w, w.application);
  const t2 = await tour(w.magasin, 'salut Pixel', 2);
  let appels = 0;
  const table = { parcourirStructure: { ...TABLE_OPERATIONS.parcourirStructure, fonction: () => { appels += 1; throw new Error('échec'); } } };
  const r = await executerApplicationSollicitee({ observation: t2.observation, application: { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: t2.message.id }] }, univers: t2.univers }, { magasin: w.magasin, table });
  assert.equal(r.statut, 'echec_invocation');
  assert.equal(appels, 1); // ni retry, ni autre application (la production r1.execution reste inexploitée)
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 1);
  assert.equal(r1.statut, 'executee');
});
test('L1. DORMANCE (MOTEUR) : seuls ce fichier et main.js (outil de développement v0.63.35) nomment la primitive ; absente de pont, écran, observation ; inaccessible depuis le moteur', () => {
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => /execution-sollicitee|executerApplicationSollicitee/.test(readFileSync(f, 'utf8'))).map(rel);
  assert.deepEqual(nommant, ['app/langage/execution-sollicitee.js', 'app/main.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.35 : main.js appelle la primitive UNIQUEMENT dans surSollicitation (outil de développement, gardé par tests/sollicitation-ui.test.mjs)
  const vus = new Set(); const pile = [join(RACINE, 'app', 'main.js')];
  while (pile.length) {
    const f = pile.pop(); if (vus.has(f)) continue; vus.add(f);
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\b[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|table-operations)\.js$/.test(c))) pile.push(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs)
  }
  assert.equal([...vus].some((f) => rel(f) === 'app/langage/execution-sollicitee.js'), false);
});
test('L2. INVARIANTS : catalogue 10, table 10, P/V/S et univers des valeurs non touchés, aucune UI, aucune persistance nouvelle (BASE 19, schéma 9, 22 tables)', () => {
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 16); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 16); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees)
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => /sollicit|Sollicit/.test(d.nom)), false);
  assert.equal(VERSION_BASE, 19); assert.equal(SCHEMA_SAUVEGARDE, 9); assert.equal(TABLES.length, 22);
  assert.equal(TABLES.some((t) => /sollicit/i.test(t)), false);
  for (const f of ['constats-valeurs.js', 'suites-fermees.js', 'univers-valeurs.js', 'constats-structurels.js']) {
    assert.equal(/execution-sollicitee|executerApplicationSollicitee/.test(readFileSync(join(RACINE, 'app', 'langage', f), 'utf8')), false, f);
  }
});
