// === DEBUT_TEST_OBSERVATIONS_LANGAGE_SCHEMA ===
// v0.63.0 — ÉTAPE 7 : schéma, migration et sauvegarde de la table `observationsLangage` (décision ChatGPT,
// 04/10/2026). Contrat PINGLÉ (même discipline que tests/traces-schema.test.mjs) : 18 tables, base 14, sauvegarde 4.
// Migration purement ADDITIVE ; une sauvegarde de schéma 3 (dont le fichier de « point zéro » du 04/10) reste
// importable, la table y est VIDE (aucune reconstruction rétroactive) ; un schéma courant reste STRICT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  magasinMemoireVive, enregistrerObservationLangage, rattacherObservationLangage, ouvrirIndexedDB,
  TABLES, CLE, VERSION_BASE, NOM_BASE,
} from '../app/langage/connaissances.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import {
  SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees,
} from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';
import { TABLES as TABLES_LANGAGE } from '../app/langage/connaissances.js';

const T = 'observationsLangage';
const maintenant = new Date('2026-10-04T12:00:00Z');
const DONNEES = (texte = 'Bonjour') => ({
  texte, etatComprendre: 'incompris', etatRepondre: 'incompris', type: 'affirmation', sujet: null, relation: null,
  motsInconnus: ['bonjour'], relationsNommees: [], idTrace: null,
});

async function etat() {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  const a = await enregistrerObservationLangage(magasinLangage, DONNEES('Bonjour'));
  const b = await rattacherObservationLangage(magasinLangage, await enregistrerObservationLangage(magasinLangage, DONNEES('Salut')), { idQuestion: 3, idReponse: 4 });
  await magasinLangage.ecrire('journal', { id: 'j1', texte: 'ancien' });
  return { memoire, magasinLangage, a, b };
}
async function enSchema(fichier, schema, sansTables = []) {
  const f = JSON.parse(fichier.contenu);
  f.schema = schema;
  for (const t of sansTables) delete f.donnees.langage[t];
  f.empreinte = await empreinte(JSON.stringify(f.donnees));
  return f;
}

test('S1. contrat PINGLÉ : table présente, clé "id", 19 tables (v0.63.16), VERSION_BASE 15, SCHEMA_SAUVEGARDE 5', () => {
  assert.ok(TABLES.includes(T));
  assert.equal(CLE[T], 'id');
  assert.equal(TABLES.length, 21); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
  assert.equal(new Set(TABLES).size, 21); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
  assert.equal(VERSION_BASE, 18); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
  assert.equal(SCHEMA_SAUVEGARDE, 8); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (17 / 7 / 21)
  assert.equal(TABLES_LANGAGE, TABLES);
});

test('S2. migration 13 -> 17 (IndexedDB simulée) : crée SEULEMENT les magasins manquants (celui-ci, observationsPossibilites, executionsOperations, designations), aucune donnée existante touchée', async () => { // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (base 17, schéma 7)
  const existants = TABLES.filter((t) => t !== T && t !== 'observationsPossibilites' && t !== 'executionsOperations' && t !== 'designations');
  const donnees = new Map(existants.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = [];
  let versionDemandee = null;
  let nomDemande = null;
  const fabrique = {
    open(nom, version) {
      nomDemande = nom; versionDemandee = version;
      const db = {
        objectStoreNames: { contains: (t) => donnees.has(t) },
        createObjectStore: (t, opts) => { crees.push([t, opts.keyPath]); donnees.set(t, []); },
        onversionchange: null, close() {}, transaction: () => ({}),
      };
      const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
      Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); });
      return r;
    },
  };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nomDemande, NOM_BASE);
  assert.equal(versionDemandee, 18);
  assert.deepEqual(crees, [[T, 'id'], ['observationsPossibilites', 'id'], ['executionsOperations', 'id'], ['designations', 'id']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
});

test('S3. sauvegarde courante : écrite en schéma 7, la table est exportée et restaurée à l\'identique (aller-retour, empreinte valide)', async () => {
  const { memoire, magasinLangage, a, b } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.0', maintenant });
  assert.equal(fichier.objet.schema, 8); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (base 17, schéma 7)
  assert.deepEqual(fichier.objet.donnees.langage[T], [a, b]);
  assert.equal(b.referenceMemoire.idQuestion, 3);
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lu.donnees });
  assert.deepEqual(await neuf.lireTout(T), [a, b]);
  assert.deepEqual(await neuf.lireTout('journal'), [{ id: 'j1', texte: 'ancien' }]);
});

test('S4. COMPATIBILITÉ du point zéro (schéma 3, sans la table) : importable, table VIDE, toutes les autres tables intactes', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.4', maintenant });
  const pointZero = await enSchema(fichier, 3, [T]);
  const lu = await lireSauvegardeComplete(JSON.stringify(pointZero), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  assert.deepEqual(lu.donnees.langage[T], [], 'aucune reconstruction rétroactive');
  assert.deepEqual(lu.donnees.langage.journal, [{ id: 'j1', texte: 'ancien' }]);
  const neuf = magasinMemoireVive();
  await neuf.ecrire(T, { id: 'residu', texte: 'ne doit pas survivre' });
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lu.donnees });
  assert.deepEqual(await neuf.lireTout(T), []);
  assert.deepEqual(await neuf.lireTout('journal'), [{ id: 'j1', texte: 'ancien' }]);
});

test('S5. sauvegardes de schémas 1 et 2 (sans la table) : toujours importables, tables manquantes complétées par []', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.4', maintenant });
  for (const schema of [1, 2]) {
    const ancienne = await enSchema(fichier, schema, [T, 'observationsComposition', 'enonces', 'actes', 'traces']);
    const lu = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
    assert.equal(lu.ok, true, `schéma ${schema}: ${lu.erreur}`);
    assert.deepEqual(lu.donnees.langage[T], []);
  }
});

test('S6. schéma courant (8) STRICT : sans la table = refus « incomplet » ; schéma futur (9) = refus « plus récente »', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.0', maintenant });
  const incomplet = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 8, [T])), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(incomplet.ok, false);
  assert.match(incomplet.erreur, /incomplet.*observationsLangage/);
  const futur = await lireSauvegardeComplete(JSON.stringify(await enSchema(fichier, 9)), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(futur.ok, false);
  assert.match(futur.erreur, /plus récente/);
});

test('S7. migrerDonnees : complète la table manquante pour un schéma < 7 seulement, ne fabrique jamais de ligne', () => {
  const bloc = { faits: [] };
  assert.deepEqual(migrerDonnees(bloc, [T], 4)[T], []);
  assert.deepEqual(migrerDonnees(bloc, [T], 5)[T], []);
  assert.deepEqual(migrerDonnees(bloc, [T], 6)[T], []); // MISE À JOUR DÉLIBÉRÉE v0.63.22 : + designations (base 17, schéma 7)
  assert.equal(Object.prototype.hasOwnProperty.call(migrerDonnees(bloc, [T], 8), T), false);
});

test('S8. import en place : les observations existantes sont REMPLACÉES avec les autres tables (atomique), la mémoire de conversation n\'est pas touchée', async () => {
  const { memoire, magasinLangage, a, b } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.0', maintenant });
  const cible = magasinMemoireVive();
  await enregistrerObservationLangage(cible, DONNEES('autre'));
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: cible, donnees: lu.donnees });
  assert.deepEqual(await cible.lireTout(T), [a, b]);
});

test('S9. la partie « mémoire » de la sauvegarde est identique à l\'export de la mémoire (aucune incidence de la nouvelle table)', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.0', maintenant });
  assert.deepEqual(fichier.objet.donnees.memoire, await memoire.exporterDonnees());
});

test('S10. l\'empreinte couvre la table : modifier une observation dans le fichier est détecté (« abîmé ou modifié »)', async () => {
  const { memoire, magasinLangage } = await etat();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.63.0', maintenant });
  const f = JSON.parse(fichier.contenu);
  f.donnees.langage[T][0].texte = 'falsifié';
  const lu = await lireSauvegardeComplete(JSON.stringify(f), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, false);
  assert.match(lu.erreur, /empreinte/);
});
// === FIN_TEST_OBSERVATIONS_LANGAGE_SCHEMA ===
