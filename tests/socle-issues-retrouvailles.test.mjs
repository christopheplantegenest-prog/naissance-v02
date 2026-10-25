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

test('S4. DORMANCE : aucun écrivain ni lecteur ; seul connaissances.js nomme la table, et seulement dans TABLES et CLE', () => {
  const nommeurs = fichiersJs(join(RACINE, 'app')).filter((f) => sansCommentaires(readFileSync(f, 'utf8')).includes(T)).map((f) => relative(RACINE, f)).sort();
  assert.deepEqual(nommeurs, ['app/langage/connaissances.js']);
  const conn = sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', 'connaissances.js'), 'utf8'));
  const lignes = conn.split('\n').filter((l) => l.includes(T));
  assert.equal(lignes.length, 2, 'TABLES et CLE seulement');
  assert.ok(lignes.some((l) => l.startsWith('export const TABLES = [')));
  assert.ok(lignes.some((l) => l.trim() === `${T}: 'id',`));
  assert.doesNotMatch(conn, new RegExp(`(ecrire|ecrireAtomique|lireTout)\\([^)]*${T}`), 'aucune écriture ni lecture de la table');
});
