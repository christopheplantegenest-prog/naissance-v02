// === DEBUT_TEST_UNIVERS_OBSERVE ===
// v0.63.24 — « UNIVERS RÉEL ÉLARGI OBSERVÉ — AUCUNE EXÉCUTION ACTIVE — AUCUN CHOIX » (décision ChatGPT, 05/10/2026).
// Au début d'un tour, Naissance observe comme données le message présent ET toutes les productions décrites déjà existantes.
// Cette observation n'en choisit aucune et n'exécute rien. Actif au niveau PERCEPTIF seulement ; groupes, désignation,
// invocation et exécution restent DORMANTS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';
import {
  magasinMemoireVive, enregistrerObservationPossibilites, enregistrerEnonceSurTrace, TABLES, VERSION_BASE,
} from '../app/langage/connaissances.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { valeurDePorteur } from '../app/langage/acces-valeur.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const OBS_CODE = sansCommentaires(lu('app', 'langage', 'observation-possibilites.js'));
const MAIN_CODE = sansCommentaires(lu('app', 'main.js'));
const PONT_CODE = sansCommentaires(lu('app', 'langage', 'pont.js'));
const T = 'observationsPossibilites';
const NOMS = DESCRIPTIONS_OPERATIONS.map((d) => d.nom);
const msg = (id, texte = 'bonjour') => ({ id, texte });
const gen = () => { let n = 0; return (p) => `${p}-u-${++n}`; };

// Ligne d'exécution de parcourirStructure (forme réelle : écrite directement, la primitive d'écriture reste dormante).
const ligne = (id, extra = {}) => ({ id, horodatage: '2026-10-05T10:00:00.000Z', idDesignation: `designation-${id}`, operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'm-0' }], resultat: [1, 2], ...extra }); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : liaisons réelles (au moins une), car entrées(P) est exposée pour toute production présente
async function monde(lignesExec = []) {
  const magasin = magasinMemoireVive();
  for (const l of lignesExec) await magasin.ecrire('executionsOperations', l);
  const enregistrer = (d) => enregistrerObservationPossibilites(magasin, d);
  const lireExecutions = () => magasin.lireTout('executionsOperations');
  const observer = (m, plus = {}) => observerPossibilites(m, { enregistrer, lireExecutions, ...plus });
  return { magasin, enregistrer, lireExecutions, observer };
}
const cle = (p) => `${p.donnee}|${p.operation}|${p.entree}`;
const canon = (obs) => JSON.stringify({ d: [...obs.donneesExaminees].sort(), o: obs.operationsExaminees, p: obs.possibilites.map(cle).sort() });

// ============================================================================ A. ZÉRO EXÉCUTION = v0.63.23
test('A1. zéro exécution : 1 donnée (le message), 10 opérations, 2 possibilités message→parcourirStructure.valeur et message→symbolesDeChaine.chaine', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38
  const w = await monde([]);
  const r = await w.observer(msg('m-1'));
  assert.equal(r.statut, 'ecrite');
  assert.deepEqual(r.observation.donneesExaminees, ['m-1']);
  assert.equal(r.observation.operationsExaminees.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.deepEqual(r.observation.operationsExaminees, NOMS);
  assert.deepEqual(r.observation.possibilites.map(cle), ['m-1|parcourirStructure|valeur', 'm-1|symbolesDeChaine|chaine']); // MISE À JOUR DÉLIBÉRÉE v0.63.38
  assert.equal(r.univers.length, 1);
});
test('A2. la ligne retournée est exactement la ligne écrite dans le magasin', async () => {
  const w = await monde([]);
  const r = await w.observer(msg('m-1'));
  const ls = await w.magasin.lireTout(T);
  assert.equal(ls.length, 1);
  assert.deepEqual(r.observation, ls[0]);
  assert.equal(r.observation.idMessage, 'm-1');
});

// ============================================================================ B. UNE PRODUCTION
test('B1. une production X + nouveau message N : 2 données, 6 atomes exacts', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.38 ; v0.63.45 : 5 → 6 atomes (+ projeterChemins.elements : la sortie de parcourirStructure porte un `chemin`, collision de forme acceptée)
  const w = await monde([ligne('execution-operation-x')]);
  const r = await w.observer(msg('m-n'));
  assert.deepEqual([...r.observation.donneesExaminees].sort(), ['entrees-de-production:execution-operation-x', 'execution-operation-x', 'm-n']); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  assert.deepEqual(r.observation.possibilites.map(cle).sort(), [
    'entrees-de-production:execution-operation-x|couvrirSequence|elements',
    'entrees-de-production:execution-operation-x|parcourirStructure|valeur',
    'execution-operation-x|couvrirSequence|elements',
    'execution-operation-x|parcourirStructure|valeur',
    'execution-operation-x|projeterChemins|elements',
    'execution-operation-x|resoudreCouverture|univers',
    'm-n|parcourirStructure|valeur',
    'm-n|symbolesDeChaine|chaine',
  ]);
  assert.equal(r.observation.possibilites.length, 8); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
});
test('B2. ancienne ligne sans idDesignation : reste une production (idDesignation non requis)', async () => {
  const ancienne = { id: 'execution-ancienne', horodatage: 'h', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'm-0' }], resultat: [] }; // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  const w = await monde([ancienne]);
  const r = await w.observer(msg('m-n'));
  assert.ok(r.observation.donneesExaminees.includes('execution-ancienne'));
  assert.equal(r.observation.possibilites.length, 8); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : 6 → 8 (+ 2 atomes de entrées(P)) ; v0.63.38 : 4 → 5 ; v0.63.45 : 5 → 6 (+ projeterChemins.elements)
});
test('B3. idDesignation n\'est pas lu (piège accesseur sur idDesignation, resultat)', async () => {
  const piegee = { id: 'execution-p', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'm-0' }] }; // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  Object.defineProperty(piegee, 'idDesignation', { enumerable: true, get() { throw new Error('idDesignation lu'); } });
  Object.defineProperty(piegee, 'resultat', { enumerable: true, get() { throw new Error('resultat lu'); } });
  const w = await monde([]);
  const r = await w.observer(msg('m-n'), { lireExecutions: async () => [piegee] });
  assert.equal(r.statut, 'ecrite');
  assert.ok(r.observation.donneesExaminees.includes('execution-p'));
});
test('B4. ligne d\'opération non décrite : ignorée, pas une erreur', async () => {
  const w = await monde([ligne('execution-inconnue', { operation: 'operationInexistante' }), ligne('execution-ok')]);
  const r = await w.observer(msg('m-n'));
  assert.equal(r.statut, 'ecrite');
  assert.deepEqual([...r.observation.donneesExaminees].sort(), ['entrees-de-production:execution-ok', 'execution-ok', 'm-n']); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente (la ligne non décrite n'a ni donnée ni entrées)
});

// ============================================================================ C. PLUSIEURS PRODUCTIONS, NON-CHOIX
test('C1. plusieurs productions : toutes présentes, identités inchangées', async () => {
  const w = await monde([ligne('execution-b'), ligne('execution-a'), ligne('execution-c')]);
  const r = await w.observer(msg('m-n'));
  assert.deepEqual([...r.observation.donneesExaminees].sort(), ['entrees-de-production:execution-a', 'entrees-de-production:execution-b', 'entrees-de-production:execution-c', 'execution-a', 'execution-b', 'execution-c', 'm-n']); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  assert.equal(r.observation.possibilites.length, 2 + 3 * (4 + 2)); // v0.63.59 : + 2 atomes par entrées(P) ; // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 1 → 2 (message) ; v0.63.45 : 3 → 4 atomes par production (+ projeterChemins.elements)
});
test('C2. réobservation sur plusieurs tours : aucune production créée ni retirée', async () => {
  const w = await monde([ligne('execution-a'), ligne('execution-b')]);
  const r1 = await w.observer(msg('m-1'));
  const r2 = await w.observer(msg('m-2'));
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 2);
  assert.equal(r1.observation.donneesExaminees.length, 5); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  assert.equal(r2.observation.donneesExaminees.length, 5);
  assert.equal((await w.magasin.lireTout(T)).length, 2);
});
test('C3. NON-CHOIX : ordre, ids lexicaux, horodatages, origines, résultats n\'enlèvent ni ne favorisent aucune donnée', async () => {
  const base = [ligne('execution-x'), ligne('execution-y'), ligne('execution-z')];
  const variantes = [
    [base[2], base[0], base[1]],
    [ligne('execution-z', { horodatage: '1999-01-01T00:00:00.000Z' }), ligne('execution-y', { horodatage: '2999-01-01T00:00:00.000Z' }), ligne('execution-x', { horodatage: '' })],
    [ligne('execution-x', { origine: 'message' }), ligne('execution-y', { origine: 'execution' }), ligne('execution-z', { origine: 'autre' })],
    [ligne('execution-x', { resultat: 'a' }), ligne('execution-y', { resultat: { grand: new Array(500).fill(1) } }), ligne('execution-z', { resultat: null })],
    [ligne('execution-x', { idDesignation: 'zzz' }), ligne('execution-y', { idDesignation: undefined }), ligne('execution-z')],
  ];
  const w0 = await monde(base);
  const ref = canon((await w0.observer(msg('m-n'))).observation);
  for (const v of variantes) {
    const w = await monde(v);
    assert.equal(canon((await w.observer(msg('m-n'))).observation), ref);
  }
  assert.equal(JSON.parse(ref).d.length, 7); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  assert.equal(JSON.parse(ref).p.length, 2 + 18); // v0.63.59 : 12 → 18 ; // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 1 → 2 (message) ; v0.63.45 : 9 → 12 (+ projeterChemins.elements par production)
});
test('C4. ordre d\'insertion sans effet sur le contenu canonique, ni sur l\'ordre des productions de l\'univers local', async () => {
  const a = await monde([ligne('execution-1'), ligne('execution-2'), ligne('execution-3')]);
  const b = await monde([ligne('execution-3'), ligne('execution-1'), ligne('execution-2')]);
  const ra = await a.observer(msg('m-n')); const rb = await b.observer(msg('m-n'));
  assert.deepEqual(ra.observation.donneesExaminees, rb.observation.donneesExaminees);
  assert.deepEqual(ra.observation.possibilites, rb.observation.possibilites);
  assert.deepEqual(ra.univers.map((e) => e.donnee.identite), rb.univers.map((e) => e.donnee.identite));
});

// ============================================================================ D. ÉCHECS
test('D1. échec de lecture (absente / lève / rejette / non-tableau) : echec_lecture, observation null, RIEN écrit', async () => {
  const w = await monde([ligne('execution-a')]);
  const cas = [undefined, () => { throw new Error('x'); }, async () => { throw new Error('x'); }, () => ({}), () => null, () => 'abc'];
  for (const lire of cas) {
    const r = await observerPossibilites(msg('m-n'), { enregistrer: w.enregistrer, lireExecutions: lire });
    assert.equal(r.statut, 'echec_lecture');
    assert.equal(r.observation, null);
    assert.equal(r.univers, null);
  }
  assert.deepEqual(await w.magasin.lireTout(T), []);
});
test('D2. échec de lecture : jamais de repli sur « message seul »', async () => {
  let appels = 0;
  const r = await observerPossibilites(msg('m-n'), { enregistrer: async () => { appels += 1; return {}; }, lireExecutions: async () => { throw new Error('x'); } });
  assert.equal(appels, 0);
  assert.equal(r.statut, 'echec_lecture');
});
test('D3. ligne invalide selon productionsDecrites : echec_executions, rien écrit, ligne non retirée en silence', async () => {
  const mauvaises = [
    { operation: 'parcourirStructure' }, { id: '', operation: 'parcourirStructure' }, { id: 'x' }, { id: 'x', operation: 3 }, null, 'texte', [],
  ];
  for (const m of mauvaises) {
    const w = await monde([ligne('execution-ok')]);
    const r = await w.observer(msg('m-n'), { lireExecutions: async () => [ligne('execution-ok'), m] });
    assert.equal(r.statut, 'echec_executions', JSON.stringify(m));
    assert.equal(r.observation, null);
    assert.deepEqual(await w.magasin.lireTout(T), []);
  }
});
test('D4. ids dupliqués : echec_executions (validation existante de productionsDecrites)', async () => {
  const w = await monde([]);
  const r = await w.observer(msg('m-n'), { lireExecutions: async () => [ligne('execution-d'), ligne('execution-d')] });
  assert.equal(r.statut, 'echec_executions');
  assert.deepEqual(await w.magasin.lireTout(T), []);
});
test('D5. catalogue invalide : echec_calcul ; message absent / sans id : sans_message / echec_donnee ; enregistreur défaillant : echec_ecriture', async () => {
  const w = await monde([]);
  assert.equal((await w.observer(msg('m-n'), { descriptions: [{ nom: 1 }] })).statut, 'echec_calcul');
  assert.equal((await w.observer(null)).statut, 'sans_message');
  assert.equal((await w.observer({ texte: 'x' })).statut, 'echec_donnee');
  for (const enr of [async () => { throw new Error('x'); }, async () => undefined, async () => null]) {
    const r = await observerPossibilites(msg('m-n'), { enregistrer: enr, lireExecutions: async () => [] });
    assert.equal(r.statut, 'echec_ecriture'); assert.equal(r.observation, null);
  }
  assert.deepEqual(await w.magasin.lireTout(T), []);
});
test('D6. lecture AVANT toute écriture', async () => {
  const journal = [];
  const r = await observerPossibilites(msg('m-n'), {
    lireExecutions: async () => { journal.push('lecture'); return []; },
    enregistrer: async (d) => { journal.push('ecriture'); return { ...d }; },
  });
  assert.equal(r.statut, 'ecrite');
  assert.deepEqual(journal, ['lecture', 'ecriture']);
});

// ============================================================================ E. UNE PHOTOGRAPHIE, RETOUR, PORTEURS
test('E1. exactement UNE tentative d\'écriture et UNE lecture par appel', async () => {
  let ecritures = 0; let lectures = 0;
  await observerPossibilites(msg('m-n'), {
    lireExecutions: async () => { lectures += 1; return [ligne('execution-a')]; },
    enregistrer: async (d) => { ecritures += 1; return { ...d }; },
  });
  assert.equal(ecritures, 1); assert.equal(lectures, 1);
});
test('E2. retour : { statut, observation, univers } — échecs : observation null, univers null', async () => {
  const w = await monde([ligne('execution-a')]);
  const ok = await w.observer(msg('m-n'));
  assert.deepEqual(Object.keys(ok).sort(), ['observation', 'statut', 'univers']);
  const ko = await w.observer(null);
  assert.deepEqual(ko, { statut: 'sans_message', observation: null, univers: null });
});
test('E3. univers local {donnee, porteur, acces} : message → texte, production → resultat ; identité porteur = identité production', async () => {
  const m = msg('m-n', 'le texte');
  const w = await monde([ligne('execution-a', { resultat: [7, 8] })]);
  const r = await w.observer(m);
  assert.equal(r.univers.length, 3); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  for (const e of r.univers) assert.deepEqual(Object.keys(e).sort(), ['acces', 'donnee', 'porteur']);
  const [em, ep] = r.univers; // [message, production, entrées(production)]
  assert.equal(em.porteur, m);
  assert.equal(valeurDePorteur(em.porteur, em.donnee, em.acces), 'le texte');
  assert.equal(ep.porteur.id, ep.donnee.identite);
  assert.deepEqual(valeurDePorteur(ep.porteur, ep.donnee, ep.acces), [7, 8]);
});
test('E3b. plusieurs productions : chaque porteur est la ligne de MÊME identité (égalité stricte), valeur propre à chacune', async () => {
  const w = await monde([ligne('execution-b', { resultat: 'B' }), ligne('execution-a', { resultat: 'A' }), ligne('execution-c', { resultat: 'C' })]);
  const r = await w.observer(msg('m-n'));
  const productions = r.univers.slice(1, 4); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente : les 3 productions précèdent le bloc entrées(P)
  assert.equal(r.univers.length, 1 + 3 + 3);
  assert.equal(productions.length, 3);
  for (const e of productions) {
    assert.equal(e.porteur.id, e.donnee.identite);
    assert.equal(valeurDePorteur(e.porteur, e.donnee, e.acces), e.donnee.identite.slice(-1).toUpperCase());
  }
});
test('E4. l\'univers local n\'est PAS persisté ; ligne écrite = 6 champs de la v0.63.16', async () => {
  const w = await monde([ligne('execution-a')]);
  const r = await w.observer(msg('m-n'));
  const ecrite = (await w.magasin.lireTout(T))[0];
  assert.equal(Object.keys(ecrite).some((k) => /porteur|acces|univers/.test(k)), false);
  assert.equal(ecrite.possibilites.every((x) => JSON.stringify(Object.keys(x).sort()) === '["donnee","entree","operation"]'), true);
  assert.deepEqual(Object.keys(r.observation).sort(), ['donneesExaminees', 'empreintesCategoriesDonnees', 'empreintesContratsRelationnels', 'empreintesOperationsExaminees', 'horodatage', 'id', 'idMessage', 'operationsExaminees', 'possibilites']); // MISE À JOUR DÉLIBÉRÉE v0.63.52 : + empreintesOperationsExaminees (nouvelle génération de ligne, écrite par observerPossibilites) // MISE À JOUR DÉLIBÉRÉE v0.63.62 : + empreintesContratsRelationnels (génération 9 clés)
});
test('E5. l\'observateur ne lit JAMAIS texte ni resultat (pièges)', async () => {
  const m = { id: 'm-n' }; Object.defineProperty(m, 'texte', { enumerable: true, get() { throw new Error('texte lu'); } });
  const piege = { id: 'execution-p', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'm-0' }] }; // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  Object.defineProperty(piege, 'resultat', { enumerable: true, get() { throw new Error('resultat lu'); } });
  const r = await observerPossibilites(m, { enregistrer: async (d) => ({ ...d }), lireExecutions: async () => [piege] });
  assert.equal(r.statut, 'ecrite');
});
test('E6. l\'ensemble ne choisit rien : aucune clé de choix dans la ligne ni dans le retour', async () => {
  const w = await monde([ligne('execution-a'), ligne('execution-b')]);
  const r = await w.observer(msg('m-n'));
  assert.equal(Object.keys(r.observation).some((k) => /choix|choisi|score|designation|invocation|execut/i.test(k)), false);
  assert.equal((await w.magasin.lireTout('designations')).length, 0);
  assert.equal((await w.magasin.lireTout('executionsOperations')).length, 2);
});

// ============================================================================ F. FRONTIÈRE D'UN TOUR (chemin réel)
test('F1. tour réel : une observation par tour, enveloppe non bloquante, même texte, productions existantes incluses', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('executionsOperations', ligne('execution-a'));
  const traces = [];
  const tour = (texte) => traiterTourAvecEnonce(texte, null, {
    nouvelId: gen(),
    observerPossibilites: (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }),
    enregistrerEnonce: (idTrace, texteE) => enregistrerEnonceSurTrace(magasin, { idTrace, texte: texteE, origine: 'interface' }),
    traiter: async (m) => { traces.push(m); return { texte: 'ok' }; },
  });
  const r1 = await tour('un'); const r2 = await tour('deux');
  assert.deepEqual(r1, { texte: 'ok' }); assert.deepEqual(r2, { texte: 'ok' });
  const ls = await magasin.lireTout(T);
  assert.equal(ls.length, 2);
  for (const l of ls) assert.equal(l.donneesExaminees.length, 3); // MISE À JOUR DÉLIBÉRÉE v0.63.59 : entrées(P) exposée pour chaque production P présente
  assert.equal((await magasin.lireTout('executionsOperations')).length, 1);
  assert.equal((await magasin.lireTout('designations')).length, 0);
});
test('F2. tour réel : lecture qui échoue → aucune observation, le tour continue normalement', async () => {
  const magasin = magasinMemoireVive();
  const r = await traiterTourAvecEnonce('un', null, {
    nouvelId: gen(),
    observerPossibilites: (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: async () => { throw new Error('x'); } }),
    enregistrerEnonce: async () => {},
    traiter: async () => ({ texte: 'ok' }),
  });
  assert.deepEqual(r, { texte: 'ok' });
  assert.deepEqual(await magasin.lireTout(T), []);
});
test('F3. tour réel : exécution invalide → aucune observation, le tour continue', async () => {
  const magasin = magasinMemoireVive();
  const r = await traiterTourAvecEnonce('un', null, {
    nouvelId: gen(),
    observerPossibilites: (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: async () => [{ id: 3 }] }),
    enregistrerEnonce: async () => {},
    traiter: async () => ({ texte: 'ok' }),
  });
  assert.deepEqual(r, { texte: 'ok' });
  assert.deepEqual(await magasin.lireTout(T), []);
});
test('F4. pont.js ignore la ligne retournée : même appel, même enveloppe, aucun usage du retour', () => {
  assert.match(PONT_CODE, /try \{ await observerPossibilites\(message\); \} catch \{ \/\* observation : jamais bloquante \*\/ \}/);
  assert.equal(/groupesDeCandidats|enregistrerDesignation|enregistrerExecutionOperation|invoquerOperation|productionsDecrites|valeurDePorteur|executionsOperations/.test(PONT_CODE), false);
});

// ============================================================================ G. MAIN, DORMANCE PARTIELLE
test('G1. main.js : lit executionsOperations en lecture seule, ne nomme aucune autre brique', () => {
  const lectures = MAIN_CODE.match(/lireTout\('[^']+'\)/g) || [];
  assert.ok(lectures.includes("lireTout('executionsOperations')"));
  assert.equal((MAIN_CODE.match(/executionsOperations/g) || []).length, 1);
  assert.equal(/groupesDeCandidats|enregistrerDesignation|enregistrerExecutionOperation|invoquerOperation|productionsDecrites|valeurDePorteur|ACCES_TRACE/.test(MAIN_CODE), false);
});
test('G2. observation-possibilites.js : ne nomme ni groupes, ni désignation, ni invocation, ni écriture d\'exécution, ni valeur, ni hasard', () => {
  assert.equal(/groupesDeCandidats|groupes-candidats|enregistrerDesignation|enregistrerExecutionOperation|invoquerOperation|invocation-operations|table-operations|valeurDePorteur|acces-valeur|Math\.random|Date\b|nouvelId|score|choisir|\.sort\(|\.filter\(|\.slice\(/.test(OBS_CODE), false);
});
test('G3. graphe d\'import depuis main.js : acces-valeur, invocation-operations, table-operations, groupes-candidats INATTEIGNABLES ; productions-decrites et acces-trace atteints', () => {
  const vus = new Set();
  const visiter = (f) => {
    if (vus.has(f)) return; vus.add(f);
    let s; try { s = sansCommentaires(readFileSync(f, 'utf8')); } catch { return; }
    for (const m of s.matchAll(/(?:import|export)\b[^;]*?from\s+'(\.[^']+)'|import\(\s*'(\.[^']+)'\s*\)/g)) { const c = resolve(dirname(f), m[1] || m[2]); if (!(f.endsWith('/app/main.js') && /\/(contexte-sollicitation|execution-sollicitee|execution-mecanique|table-operations|environnement-conversation|capacite|tick-propre|relation|besoins)\.js$/.test(c))) visiter(c); } // MISE À JOUR DÉLIBÉRÉE v0.63.35 : le démarrage importe désormais l'OUTIL DE DÉVELOPPEMENT (contexte-sollicitation, execution-sollicitee, table-operations) ; ce garde porte sur le MOTEUR : ces trois entrées d'outil sont écartées du parcours (leur atteinte est gardée par tests/sollicitation-ui.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + execution-mecanique (déclencheur mécanique de l'outil, même statut que les trois autres entrées écartées ; son atteinte est gardée par tests/execution-mecanique.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.83 : + environnement-conversation.js (l'émission est un acte prospectif : ce module vivant atteint la chaîne .72/.74 comme execution-sollicitee.js ; exclu du parcours au même titre) // MISE À JOUR DÉLIBÉRÉE v0.63.84 : + capacite.js (B1 : module vivant du besoin primitif, atteint depuis main.js ; il importe la chaîne .72/.74 et executions-vecues comme environnement-conversation.js ; exclu du parcours au même titre, son atteinte est gardée par tests/capacite.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.86 : + tick-propre.js, relation.js (B2 : modules vivants atteints depuis main.js ; ils importent la chaîne .72/.74 et executions-vecues via prospection-soi.js, comme capacite.js ; exclus du parcours au même titre, gardés par tests/relation.test.mjs) // MISE À JOUR DÉLIBÉRÉE v0.63.87 (besoins déclarés) : + besoins dans l'exclusion des imports de main.js (module de LECTURE PURE, même statut que capacite/relation : il atteint le vécu projeté, jamais un mécanisme d'action)
  };
  visiter(join(RACINE, 'app', 'main.js'));
  const atteints = new Set([...vus].map(rel));
  for (const n of ['acces-valeur', 'invocation-operations', 'table-operations', 'groupes-candidats']) assert.equal(atteints.has(`app/langage/${n}.js`), false, n);
  for (const n of ['productions-decrites', 'acces-trace']) assert.equal(atteints.has(`app/langage/${n}.js`), true, n);
});
test('G4. aucun fichier de production hors connaissances.js n\'écrit executionsOperations ou designations', () => {
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => /ecrire\(\s*'(executionsOperations|designations)'/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(nommant, ['app/langage/connaissances.js']);
});
test('G5. versions et schéma inchangés : VERSION_BASE 18, SCHEMA 8, 21 tables', () => {
  assert.equal(VERSION_BASE, 24); assert.equal(SCHEMA_SAUVEGARDE, 14); assert.equal(TABLES.length, 30); // MISE À JOUR DÉLIBÉRÉE v0.63.27 : + valeursDonnees (19 / 9 / 22) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.84 (B1, capacité d'agir) : + capaciteInitiale, variationsCapacite (VERSION_BASE 23, SCHEMA_SAUVEGARDE 13, 28 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.86 (B2, état relationnel) : + relationInitiale, variationsRelation (VERSION_BASE 24, SCHEMA_SAUVEGARDE 14, 30 tables)
});
// === FIN_TEST_UNIVERS_OBSERVE ===
