// v0.66.4 — SOCLE C1 « ISSUE VÉCUE D'UNE RETROUVAILLE » (GO ChatGPT « GO SOCLE C1 », 25/10/2026).
// Table 'issuesRetrouvailles' déclarée en dernier (clé id), VIDE : migration purement additive 29 → 30 (IndexedDB), schéma de sauvegarde
// 19 → 20, 36 tables. AUCUN écrivain, AUCUN lecteur à cette étape : le comportement de Naissance est inchangé (gardes statiques ci-dessous).
// L'écrivain (au moment de la conséquence) et la relecture Diagnostic viendront avec le jalon C1 lui-même, par l'atelier.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const S = await import('../app/memoire/sauvegarde.js');
const { creerMemoire } = await import('../app/memoire/memoire.js');
const { creerMagasinMemoire } = await import('../app/memoire/magasin.js');
const { empreinte } = await import('../app/memoire/transfert.js');

const T = 'issuesRetrouvailles';
const RACINE = new URL('..', import.meta.url).pathname;
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '').replace(/\/\*.*?\*\//g, '')).join('\n');
const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : (p.endsWith('.js') ? [p] : []); });

test('S1. schéma : issuesRetrouvailles déclarée en dernier (clé id), VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables sans doublon', () => {
  assert.equal(C.TABLES.at(-1), T);
  assert.equal(C.TABLES.at(-2), 'actesResolution', 'aucune table existante déplacée');
  assert.equal(C.CLE[T], 'id');
  assert.equal(C.VERSION_BASE, 30);
  assert.equal(S.SCHEMA_SAUVEGARDE, 20);
  assert.equal(C.TABLES.length, 36);
  assert.equal(new Set(C.TABLES).size, 36);
  for (const t of C.TABLES) assert.equal(typeof C.CLE[t], 'string', t);
});

test('S2. migration IndexedDB 29 → 30 : crée SEULEMENT issuesRetrouvailles, vide ; aucune donnée existante touchée', async () => {
  const existants = C.TABLES.filter((t) => t !== T);
  const donnees = new Map(existants.map((t) => [t, [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null;
  const fabrique = { open(n, v) { version = v; const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) }; const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }; queueMicrotask(() => { r.onupgradeneeded(); r.onsuccess(); }); return r; } };
  await C.ouvrirIndexedDB(fabrique);
  assert.equal(version, 30);
  assert.deepEqual(crees, [[T, 'id']]);
  assert.deepEqual(donnees.get(T), [], 'table vide : aucune issue rétroactive');
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});

test('S3. sauvegarde et restauration : la table (vide) est exportée en schéma 20 ; 19 sans la table = complétée par [] ; 20 sans la table = incomplet ; 21 = refusé ; restauration identique', async () => {
  const magasin = C.magasinMemoireVive();
  await magasin.ecrire('experiences', { id: 'experience-socle-1', texteRecu: 'bonjour', texteRepondu: 'bonjour' });
  const memoire = creerMemoire(creerMagasinMemoire());
  const TABLES_MEMOIRE = Object.keys(await memoire.exporterDonnees());
  const fichier = await S.construireSauvegardeComplete({ memoire, magasinLangage: magasin, idNaissance: 'id', versionAppli: '0.66.4', maintenant: new Date('2026-10-25T09:00:00Z') });
  assert.equal(fichier.objet.schema, 20);
  const lue = await S.lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  assert.deepEqual(lue.donnees.langage[T], []);
  assert.deepEqual(lue.donnees.langage.experiences, [{ id: 'experience-socle-1', texteRecu: 'bonjour', texteRepondu: 'bonjour' }]);
  const refaire = async (o) => JSON.stringify({ ...o, empreinte: await empreinte(JSON.stringify(o.donnees)) });
  const ancien = JSON.parse(fichier.contenu); ancien.schema = 19; delete ancien.donnees.langage[T];
  const lu1 = await S.lireSauvegardeComplete(await refaire(ancien), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu1.ok, true, lu1.erreur);
  assert.deepEqual(lu1.donnees.langage[T], [], 'schéma 19 : table complétée par [], aucune issue fabriquée');
  assert.deepEqual(lu1.donnees.langage.experiences, lue.donnees.langage.experiences, 'schéma 19 : les données existantes sont relues telles quelles');
  const incomplet = JSON.parse(fichier.contenu); delete incomplet.donnees.langage[T];
  const lu2 = await S.lireSauvegardeComplete(await refaire(incomplet), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu2.ok, false); assert.match(lu2.erreur, /incomplet/);
  const futur = JSON.parse(fichier.contenu); futur.schema = 21;
  const lu3 = await S.lireSauvegardeComplete(await refaire(futur), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu3.ok, false); assert.match(lu3.erreur, /plus récente/);
  const restaure = C.magasinMemoireVive();
  await restaure.remplacerTout(lu1.donnees.langage);
  assert.deepEqual(await restaure.lireTout(T), []);
  assert.deepEqual(await restaure.lireTout('experiences'), lue.donnees.langage.experiences);
});

// MISE À JOUR DÉLIBÉRÉE v0.66.5 (C1, issue vécue d'une retrouvaille) : la table n'est plus dormante. L'écrivain (enregistrerIssueRetrouvaille,
// mode ajout) et le lecteur (lireIssuesRetrouvailles) vivent dans connaissances.js, seul fichier qui nomme la table ; le seul appelant de
// l'écrivain est issues-vecues.js (conserverIssuesVecues). Aucun autre fichier de app/ n'écrit ni ne lit la table.
test('S4. ACCÈS FERMÉ : seuls connaissances.js (écrivain, lecteur) et issues-vecues.js (appelant de l\'écrivain) touchent la table ; connaissances.js la nomme dans TABLES, CLE, une écriture en mode ajout et une lecture', () => {
  const app = fichiersJs(join(RACINE, 'app'));
  const code = (f) => sansCommentaires(readFileSync(f, 'utf8'));
  const nommeurs = app.filter((f) => code(f).includes(T)).map((f) => relative(RACINE, f)).sort();
  assert.deepEqual(nommeurs, ['app/langage/connaissances.js'], 'seul connaissances.js nomme la table');
  assert.doesNotMatch(code(join(RACINE, 'app', 'langage', 'rappels.js')), /ecrire|enregistrer|remplacerTout|supprimer/, 'MISE À JOUR DÉLIBÉRÉE v0.66.14 (C2) : rappels.js ne fait que lire la table, jamais l\'écrire');
  const acces = app.filter((f) => /enregistrerIssueRetrouvaille|lireIssuesRetrouvailles/.test(code(f))).map((f) => relative(RACINE, f)).sort();
  // MISE À JOUR DÉLIBÉRÉE v0.66.5 (jalon issue-vecue-diagnostic) : + app/main.js, LECTEUR UNIQUE hors connaissances.js : le seul pont Diagnostic
  // (retrouvailles) appelle lireIssuesRetrouvailles, une fois, et n'appelle jamais l'écrivain. Aucun autre fichier de app/ ne lit la table.
  // MISE À JOUR DÉLIBÉRÉE v0.66.14 (C2) : + app/langage/rappels.js, SECOND LECTEUR hors connaissances.js (main.js n'est plus le lecteur unique) :
  // rappelsDesContextes appelle lireIssuesRetrouvailles une fois, seulement si une retrouvaille est 'retrouvee', pour le rappel des issues déjà
  // vécues ; il n'appelle jamais l'écrivain enregistrerIssueRetrouvaille et n'écrit rien. Le titre « touchent la table » vise l'écrivain et son
  // appelant ; les deux lecteurs (main.js, rappels.js) passent par le lecteur officiel, listés ici. Aucun autre fichier de app/ ne lit la table.
  assert.deepEqual(acces, ['app/langage/connaissances.js', 'app/langage/issues-vecues.js', 'app/langage/rappels.js', 'app/main.js'], 'MISE À JOUR DÉLIBÉRÉE v0.66.14 (C2) : seuls connaissances.js, issues-vecues.js (écrivain), rappels.js (rappel, lecture) et main.js (pont Diagnostic, lecture) touchent la table');
  const rappels = code(join(RACINE, 'app', 'langage', 'rappels.js'));
  assert.doesNotMatch(rappels, /enregistrerIssueRetrouvaille|lireTout\([^)]*issues/, 'MISE À JOUR DÉLIBÉRÉE v0.66.14 (C2) : rappels.js n\'appelle jamais l\'écrivain et ne lit pas la table en direct');
  assert.equal((rappels.match(/lireIssuesRetrouvailles\(/g) || []).length, 1, 'MISE À JOUR DÉLIBÉRÉE v0.66.14 (C2) : une seule lecture par le lecteur officiel');
  const main = code(join(RACINE, 'app', 'main.js'));
  assert.doesNotMatch(main, /enregistrerIssueRetrouvaille/, 'main.js n\'écrit jamais la table');
  assert.equal((main.match(/lireIssuesRetrouvailles\(/g) || []).length, 1, 'une seule lecture');
  const k = main.indexOf('retrouvailles: async () => {'); const pont = main.slice(k, main.indexOf('\n    },', k));
  assert.match(pont, /lireIssuesRetrouvailles\(e\.magasin\)/, 'lue dans le seul pont Diagnostic des retrouvailles');
  const conn = code(join(RACINE, 'app', 'langage', 'connaissances.js'));
  const lignes = conn.split('\n').filter((l) => l.includes(T));
  assert.equal(lignes.length, 4, 'TABLES, CLE, l\'écriture et la lecture seulement');
  assert.ok(lignes.some((l) => l.startsWith('export const TABLES = [')));
  assert.ok(lignes.some((l) => l.trim() === `${T}: 'id',`));
  const operations = [...conn.matchAll(new RegExp(`(ecrire|ecrireAtomique|lireTout)\\([^)]*${T}`, 'g'))].map((m) => m[1]);
  assert.deepEqual(operations, ['ecrireAtomique', 'lireTout'], 'une écriture atomique, une lecture ; jamais ecrire (remplacement)');
  const bloc = (nom) => { const i = conn.indexOf(`export async function ${nom}(`); assert.ok(i >= 0, nom); return conn.slice(i, conn.indexOf('\n}\n', i)); };
  assert.match(bloc('enregistrerIssueRetrouvaille'), new RegExp(`ecrireAtomique\\(\\[\\{ table: '${T}', objet, mode: 'ajout' \\}\\]\\)`));
  assert.match(bloc('lireIssuesRetrouvailles'), new RegExp(`lireTout\\('${T}'\\)`));
  assert.equal((conn.match(/enregistrerIssueRetrouvaille\(|lireIssuesRetrouvailles\(/g) || []).length, 2, 'connaissances.js déclare les deux fonctions et ne les appelle pas');
  const vecues = code(join(RACINE, 'app', 'langage', 'issues-vecues.js'));
  assert.equal((vecues.match(/enregistrerIssueRetrouvaille\(/g) || []).length, 1, 'un seul appel de l\'écrivain');
  assert.doesNotMatch(vecues, /lireIssuesRetrouvailles|ecrireAtomique|\.ecrire\(/, 'issues-vecues.js ne lit pas la table et n\'écrit que par l\'écrivain');
});
