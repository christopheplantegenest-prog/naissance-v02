// v0.63.33 — PROVENANCE DE LA DÉSIGNATION (décision ChatGPT, 05/10/2026). Preuves : toute NOUVELLE désignation porte une origine fournie
// EXPLICITEMENT (« exterieure », seule valeur), refus avant écriture sinon, aucun défaut caché, anciennes lignes préservées sans origine
// inventée, lien exact exécution → désignation → origine sans recherche heuristique, aucune copie dans l'exécution, aucun choix,
// aucun appelant actif, dormance, versions inchangées (décision documentée : même table, même clé, lignes libres).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  enregistrerDesignation, enregistrerExecutionOperation, magasinMemoireVive, ORIGINES_DESIGNATION, TABLES, VERSION_BASE,
} from '../app/langage/connaissances.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete } from '../app/memoire/sauvegarde.js';
import { productionsDecrites } from '../app/langage/productions-decrites.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';

const RACINE = join(import.meta.dirname, '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CONN = lu('app', 'langage', 'connaissances.js');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });
const rel = (f) => relative(RACINE, f).split('\\').join('/');
const at = (donnee, operation, entree) => ({ donnee, operation, entree });
const OBS = (extra = {}) => ({ id: 'observation-possibilites-1', possibilites: [at('A', 'memesCouvertures', 'a'), at('B', 'memesCouvertures', 'b'), at('X', 'parcourirStructure', 'valeur'), at('Y', 'parcourirStructure', 'valeur')], ...extra });
const APP = () => ({ operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'X' }] });
const espion = () => { const ecrits = []; return { ecrits, async ecrire(t, o) { ecrits.push([t, o]); }, async lireTout() { return []; } }; };
const RES = [{ chemin: [], type: 'chaine', valeur: 'X' }];
const exec = (m, d, resultat = RES) => enregistrerExecutionOperation(m, { designation: d, operation: d.operation, liaisons: d.liaisons, resultat });
// Lecture EXACTE d'une désignation par son id (égalité stricte) : aucune recherche par contenu, par position ou par proximité.
const designationDe = async (m, execution) => (await m.lireTout('designations')).filter((d) => d.id === execution.idDesignation);

test('A1. liste fermée : ORIGINES_DESIGNATION = exactement ["exterieure"], gelée ; aucune valeur « naissance » ni taxonomie', () => {
  assert.deepEqual([...ORIGINES_DESIGNATION], ['exterieure', 'mecanique']); // MISE À JOUR DÉLIBÉRÉE v0.63.60 : + 'mecanique' (déclencheur des applications sans choix) ; toujours aucune taxonomie d'intention
  assert.equal(Object.isFrozen(ORIGINES_DESIGNATION), true);
  assert.equal(ORIGINES_DESIGNATION.some((o) => /naissance|autonome|choix|systeme|test|humain|christophe/i.test(o)), false);
});
test('B1. TEST CENTRAL : O → A → désignation(origine explicite) → D → exécution X ; X.idDesignation → D.id → D.origine = "exterieure"', async () => {
  const m = magasinMemoireVive();
  const D = await enregistrerDesignation(m, { observation: OBS(), application: APP(), origine: 'exterieure' });
  const X = await exec(m, D);
  const trouvees = await designationDe(m, X);
  assert.equal(trouvees.length, 1);
  assert.equal(X.idDesignation, D.id);
  assert.equal(trouvees[0].id, D.id);
  assert.equal(trouvees[0].origine, 'exterieure');
  assert.deepEqual(Object.keys(D), ['id', 'horodatage', 'idObservation', 'operation', 'liaisons', 'origine']);
  assert.deepEqual(await m.lireTout('designations'), [D]);
});
test('B2. la ligne écrite est celle fournie : origine copiée telle quelle, observation et application inchangées, aucune clé « qui » ni « pourquoi »', async () => {
  const m = magasinMemoireVive();
  const D = await enregistrerDesignation(m, { observation: OBS(), application: APP(), origine: ORIGINES_DESIGNATION.at(0) });
  assert.equal(D.origine, 'exterieure');
  for (const interdit of ['auteur', 'qui', 'pourquoi', 'raison', 'choix', 'score', 'interface', 'ui', 'utilisateur', 'idExecution']) assert.equal(interdit in D, false, interdit);
});
test('C1. REFUS avant écriture : origine absente, undefined, null, vide, espaces, casse, hors liste, non chaîne, objets, noms de prototype', async () => {
  const invalides = [undefined, null, '', ' ', 'Exterieure', 'EXTERIEURE', ' exterieure', 'exterieure ', 'extérieure', 'naissance', 'autonome', 42, true, [], ['exterieure'], {}, { valueOf: () => 'exterieure' }, Symbol('exterieure'), 'toString', '__proto__', 'constructor'];
  for (const valeur of invalides) {
    const e = espion();
    await assert.rejects(enregistrerDesignation(e, { observation: OBS(), application: APP(), origine: valeur }), (err) => err instanceof TypeError && /origine/.test(err.message), String(valeur?.toString?.() ?? valeur));
    assert.deepEqual(e.ecrits, [], String(valeur?.toString?.() ?? valeur));
  }
  const e = espion();
  await assert.rejects(enregistrerDesignation(e, { observation: OBS(), application: APP() }), (err) => err instanceof TypeError && /origine/.test(err.message));
  assert.deepEqual(e.ecrits, []);
});
test('C2. aucun DÉFAUT silencieux : sans la clé, même avec une clé inconnue ou un undefined explicite, rien n\'est écrit', async () => {
  const e = espion();
  for (const entree of [{ observation: OBS(), application: APP() }, { observation: OBS(), application: APP(), origine: undefined }, { observation: OBS(), application: APP(), origin: 'exterieure' }]) {
    await assert.rejects(enregistrerDesignation(e, entree), TypeError);
  }
  assert.deepEqual(e.ecrits, []);
  const tout = sansCommentaires(CONN);
  const debut = tout.indexOf('export async function enregistrerDesignation(');
  const code = tout.slice(debut);
  assert.equal(/origine\s*=\s*['"`]|origine\s*\|\||origine\s*\?\?|origine\s*=\s*ORIGINES|ORIGINES_DESIGNATION\s*\[|\.at\(/.test(code), false);
  assert.equal(/'exterieure'/.test(tout.slice(0, debut)), true); // la liste porte la valeur
  assert.equal(/'exterieure'/.test(code), false); // la primitive ne la contient jamais : ni défaut, ni comparaison
});
test('C3. origine : accesseur refusé SANS exécution ; propriété héritée refusée ; clé étrangère refusée', async () => {
  const e = espion();
  const piege = { observation: OBS(), application: APP() };
  Object.defineProperty(piege, 'origine', { enumerable: true, get() { throw new Error('accesseur origine exécuté'); } });
  await assert.rejects(enregistrerDesignation(e, piege), (err) => err instanceof TypeError && /accesseur/.test(err.message) && !/exécuté$/.test(err.message));
  const herite = Object.create({ origine: 'exterieure' }, { observation: { value: OBS(), enumerable: true }, application: { value: APP(), enumerable: true } });
  await assert.rejects(enregistrerDesignation(e, herite), TypeError);
  await assert.rejects(enregistrerDesignation(e, { observation: OBS(), application: APP(), origine: 'exterieure', pourquoi: 'x' }), TypeError);
  assert.deepEqual(e.ecrits, []);
});
test('C4. un refus d\'origine survient AVANT toute écriture, même quand le reste est valide ; le reste invalide reste refusé même avec une origine valide', async () => {
  const e = espion();
  await assert.rejects(enregistrerDesignation(e, { observation: OBS(), application: APP(), origine: 'x' }), TypeError);
  await assert.rejects(enregistrerDesignation(e, { observation: OBS(), application: { operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'INCONNUE' }] }, origine: 'exterieure' }), TypeError);
  assert.deepEqual(e.ecrits, []);
});
test('D1. ANCIENNES LIGNES : sans origine, préservées exactement, jamais lues comme « exterieure », jamais rejetées', async () => {
  const ancienne = { id: 'designation-application-1-1-1', horodatage: '2026-10-05T08:00:00.000Z', idObservation: 'observation-possibilites-0', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'X' }] };
  const m = magasinMemoireVive();
  await m.ecrire('designations', ancienne);
  const nouvelle = await enregistrerDesignation(m, { observation: OBS(), application: APP(), origine: 'exterieure' });
  const lignes = await m.lireTout('designations');
  assert.equal(lignes.length, 2);
  assert.equal(JSON.stringify(lignes.find((l) => l.id === ancienne.id)), JSON.stringify(ancienne));
  assert.equal('origine' in lignes.find((l) => l.id === ancienne.id), false);
  assert.equal(lignes.find((l) => l.id === nouvelle.id).origine, 'exterieure');
  // exécution liée à l'ancienne ligne : l'origine retrouvée est ABSENTE (pas "exterieure", pas null)
  const X0 = await exec(m, ancienne);
  const [D0] = await designationDe(m, X0);
  assert.equal(D0.id, ancienne.id);
  assert.equal('origine' in D0, false);
  assert.notEqual(D0.origine, 'exterieure');
});
test('D2. DEUX DÉSIGNATIONS IDENTIQUES (même observation, opération, liaisons) : chaque exécution reste liée exactement à la sienne ; aucune inférence depuis le contenu', async () => {
  const ancienne = { id: 'designation-application-9-9-9', horodatage: '2026-10-05T07:00:00.000Z', idObservation: 'observation-possibilites-1', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'X' }] };
  const m = magasinMemoireVive();
  await m.ecrire('designations', ancienne);
  const D1 = await enregistrerDesignation(m, { observation: OBS(), application: APP(), origine: 'exterieure' });
  const D2 = await enregistrerDesignation(m, { observation: OBS(), application: APP(), origine: 'exterieure' });
  assert.notEqual(D1.id, D2.id);
  assert.deepEqual({ ...D1, id: 0, horodatage: 0 }, { ...D2, id: 0, horodatage: 0 });
  const X1 = await exec(m, D1); const X2 = await exec(m, D2); const X0 = await exec(m, ancienne);
  assert.equal(X1.idDesignation, D1.id); assert.equal(X2.idDesignation, D2.id); assert.equal(X0.idDesignation, ancienne.id);
  assert.deepEqual((await designationDe(m, X1)).map((d) => d.id), [D1.id]);
  assert.deepEqual((await designationDe(m, X2)).map((d) => d.id), [D2.id]);
  const [d0] = await designationDe(m, X0);
  assert.equal('origine' in d0, false); // même contenu que D1/D2, aucune origine déduite
});
test('E1. AUCUNE DUPLICATION : l\'exécution ne porte pas origine ; son contrat est inchangé', async () => {
  const m = magasinMemoireVive();
  const D = await enregistrerDesignation(m, { observation: OBS(), application: APP(), origine: 'exterieure' });
  const X = await exec(m, D);
  assert.deepEqual(Object.keys(X).sort(), ['horodatage', 'id', 'idDesignation', 'liaisons', 'operation', 'resultat']);
  assert.equal('origine' in X, false);
  assert.equal(JSON.stringify(X).includes('exterieure'), false);
  const bloc = CONN.slice(CONN.indexOf('export async function enregistrerExecutionOperation('), CONN.indexOf('// === FAIT PERSISTANT DE DÉSIGNATION'));
  assert.equal(/origine/.test(sansCommentaires(bloc)), false);
  await assert.rejects(enregistrerExecutionOperation(m, { designation: D, operation: D.operation, liaisons: D.liaisons, resultat: RES, origine: 'exterieure' }), TypeError);
});
test('E2. l\'exécution ne lit pas l\'origine : désignation avec accesseur piégé sur origine accepté sans exécution', async () => {
  const m = magasinMemoireVive();
  const D = await enregistrerDesignation(m, { observation: OBS(), application: APP(), origine: 'exterieure' });
  const piegee = { id: D.id, operation: D.operation, liaisons: D.liaisons };
  Object.defineProperty(piegee, 'origine', { enumerable: true, get() { throw new Error('origine lue'); } });
  const X = await exec(m, piegee);
  assert.equal(X.idDesignation, D.id);
});
test('F1. SAUVEGARDE : nouvelle ligne avec origine et ancienne ligne sans origine font l\'aller-retour à l\'identique (schéma courant, aucune réécriture)', async () => {
  const magasinLangage = magasinMemoireVive();
  const memoire = creerMemoire(creerMagasinMemoire());
  const ancienne = { id: 'designation-application-1-1-1', horodatage: '2026-10-05T08:00:00.000Z', idObservation: 'o0', operation: 'parcourirStructure', liaisons: [{ entree: 'valeur', donnee: 'X' }] };
  await magasinLangage.ecrire('designations', ancienne);
  const D = await enregistrerDesignation(magasinLangage, { observation: OBS(), application: APP(), origine: 'exterieure' });
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.33', maintenant: new Date('2026-10-05T12:00:00Z') });
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  const lignes = await neuf.lireTout('designations');
  assert.equal(JSON.stringify(lignes.find((l) => l.id === ancienne.id)), JSON.stringify(ancienne));
  assert.equal(JSON.stringify(lignes.find((l) => l.id === D.id)), JSON.stringify(D));
  assert.equal(lignes.find((l) => l.id === D.id).origine, 'exterieure');
});
test('F2. lecteurs : productionsDecrites lit toujours seulement id + operation (anciennes et nouvelles exécutions) ; aucun lecteur ne nomme origine', async () => {
  const m = magasinMemoireVive();
  const D = await enregistrerDesignation(m, { observation: OBS(), application: APP(), origine: 'exterieure' });
  const X = await exec(m, D);
  const P = productionsDecrites([X], DESCRIPTIONS_OPERATIONS);
  assert.deepEqual(P.map((p) => p.identite), [X.id]);
  for (const f of ['productions-decrites.js', 'acces-valeur.js', 'acces-trace.js', 'observation-possibilites.js', 'groupes-candidats.js', 'application-unique.js', 'valeurs-application.js', 'invocation-operations.js']) {
    assert.equal(/ORIGINES_DESIGNATION|designation\w*\.origine|\.origine\b/.test(sansCommentaires(lu('app', 'langage', f))), false, f);
  }
});
test('G1. AUCUN CHOIX NI APPELANT : seul connaissances.js nomme la primitive et la liste ; main, pont, écran, observation n\'appellent rien', () => {
  const nommant = fichiersJs(join(RACINE, 'app')).filter((f) => /enregistrerDesignation|ORIGINES_DESIGNATION/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel);
  assert.deepEqual(nommant, ['app/langage/connaissances.js', 'app/langage/execution-sollicitee.js']); // MISE À JOUR DÉLIBÉRÉE v0.63.34 : la primitive d'exécution sollicitée appelle enregistrerDesignation (origine fournie en dur)
  const code = sansCommentaires(CONN);
  assert.equal((code.match(/enregistrerDesignation\(/g) || []).length, 1);
  assert.equal((code.match(/ORIGINES_DESIGNATION/g) || []).length, 3); // déclaration + validation (test + message)
  const bloc = code.slice(code.indexOf('export async function enregistrerDesignation('));
  assert.equal(/Math\.random|applicationUnique|groupesDeCandidats|score|priorite|frequence|nouveaute|curiosite|premiere|hasard/i.test(bloc), false);
  for (const f of ['app/main.js', 'app/langage/pont.js']) assert.equal(/enregistrerDesignation|ORIGINES_DESIGNATION|idDesignation|designations/.test(sansCommentaires(lu(f))), false, f);
});
test('G2. dormance : executionsOperations toujours non alimentée par un chemin actif ; catalogue et table inchangés (10 / 10, MISE À JOUR DÉLIBÉRÉE v0.63.38 : symbolesDeChaine)', () => {
  for (const f of fichiersJs(join(RACINE, 'app')).map(rel)) {
    if (f === 'app/langage/connaissances.js' || f === 'app/langage/execution-sollicitee.js') continue; // MISE À JOUR DÉLIBÉRÉE v0.63.34
    assert.equal(/enregistrerExecutionOperation/.test(sansCommentaires(lu(f))), false, f);
  }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 (symbolesDeChaine) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : 15 → 16 (+ resoudreElements) // MISE À JOUR DÉLIBÉRÉE v0.63.45 : 14 → 15 (+ projeterChemins) // MISE À JOUR DÉLIBÉRÉE v0.63.44 : 13 → 14 (+ rechercherSousSuites) // MISE À JOUR DÉLIBÉRÉE v0.63.43 : 12 → 13 (+ projeterContenus) // MISE À JOUR DÉLIBÉRÉE v0.63.38 : 9 → 10 (symbolesDeChaine) // MISE À JOUR DÉLIBÉRÉE v0.63.41 : 10 → 11 (+ elementsObservables) // MISE À JOUR DÉLIBÉRÉE v0.63.42 : 11 → 12 (+ produireSuitesFermees) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : 16 → 17 (+ composerCollection)
  assert.equal(DESCRIPTIONS_OPERATIONS.some((d) => /origine|designation/i.test(d.nom)), false);
});
test('H1. persistance : aucune table nouvelle ; VERSION_BASE 19, SCHEMA_SAUVEGARDE 9, TABLES 22 (décision : même table, même clé, lignes libres — précédent v0.53/v0.62.3/v0.63.1)', () => {
  assert.equal(VERSION_BASE, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 19 → 20 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 9 → 10 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.72 : 22 → 23 (+ table contextesProspectifs : VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 24 → 26 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(TABLES.some((t) => /origine|provenance/i.test(t)), false);
});
