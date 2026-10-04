// === DEBUT_TEST_SAUVEGARDE_SCHEMA2 ===
// v0.62.0 — ÉTAPE 6 (décision ChatGPT, 03/10/2026) : SCHEMA_SAUVEGARDE 1 -> 2. Avant ce chantier, une
// sauvegarde de schéma 1 sans les tables ajoutées depuis ('traces' v0.46, 'actes' v0.61.4) était
// REFUSÉE à l'import (« Fichier incomplet »), faute de migration. migrerDonnees() complète désormais
// les tables absentes par des tableaux vides (jamais un vécu fabriqué) pour tout schéma < 2 ; une
// sauvegarde de schéma 2 doit rester complète.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import {
  magasinMemoireVive, enregistrerExperience, enregistrerTrace, enregistrerActe, enregistrerEnonceSurTrace,
  TABLES as TABLES_LANGAGE,
} from '../app/langage/connaissances.js';
import {
  SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees,
} from '../app/memoire/sauvegarde.js';
import { empreinte } from '../app/memoire/transfert.js';

const maintenant = new Date('2026-10-03T14:00:00Z');
const TABLES_AJOUTEES_APRES_SCHEMA_1 = ['traces', 'actes', 'enonces'];

async function etatAvecVecu() {
  const memoire = creerMemoire(creerMagasinMemoire());
  const magasinLangage = magasinMemoireVive();
  const exp = await enregistrerExperience(magasinLangage, { texteRecu: 'bonjour', texteRepondu: 'salut', date: '2026-10-03T10:00:00.000Z', source: 'laboratoire' });
  const trace = await enregistrerTrace(magasinLangage, {
    capacite: 'confrontation', voie: 'action', argumentsUtilises: { a: 'b' }, provenanceArguments: { a: 'texte' }, resultat: { etat: 'egal' },
    contexte: { texteBrut: 'compare a et b', tokens: [] },
  });
  const acte = await enregistrerActe(magasinLangage, { idTrace: trace.id });
  const enonce = await enregistrerEnonceSurTrace(magasinLangage, { idTrace: trace.id, texte: 'Non, c\'était plutôt une déduction.' });
  return { memoire, magasinLangage, exp, trace, acte, enonce };
}

// Fabrique, à partir d'une sauvegarde réelle, un fichier tel qu'une ancienne version l'aurait écrit :
// schéma 1 et SANS les tables données (empreinte recalculée pour isoler le seul cas testé).
async function ancienneSauvegarde(fichier, { schema, sansTables }) {
  const f = JSON.parse(fichier.contenu);
  f.schema = schema;
  for (const t of sansTables) delete f.donnees.langage[t];
  f.empreinte = await empreinte(JSON.stringify(f.donnees));
  return f;
}

// MISE À JOUR DÉLIBÉRÉE (v0.62.4) : SCHEMA_SAUVEGARDE 2 -> 3 ('observationsComposition' ajoutée). Les cas
// ci-dessous restent valables : « courant » = schéma 3, « futur » = schéma 4, « ancien » = schéma < 3.
// MISE À JOUR DÉLIBÉRÉE (v0.63.0) : SCHEMA_SAUVEGARDE 3 -> 4 ('observationsLangage' ajoutée) : désormais
// « courant » = schéma 4, « futur » = schéma 5, « ancien » = schéma < 4.
// MISE À JOUR DÉLIBÉRÉE (v0.63.16) : SCHEMA_SAUVEGARDE 4 -> 5 ('observationsPossibilites' ajoutée) : désormais « courant » = 5, « futur » = 6.
test('A. SCHEMA_SAUVEGARDE vaut 5 (v0.63.16) et les nouvelles sauvegardes l\'écrivent, avec la table "enonces"', async () => {
  assert.equal(SCHEMA_SAUVEGARDE, 5);
  const { memoire, magasinLangage } = await etatAvecVecu();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.0', maintenant });
  assert.equal(fichier.objet.schema, 5);
  assert.ok(Array.isArray(fichier.objet.donnees.langage.enonces));
  assert.equal(fichier.objet.donnees.langage.enonces.length, 1);
});

test('B. une sauvegarde de schéma 1 SANS "traces", "actes", "enonces" est désormais importable (tables complétées par [])', async () => {
  const { memoire, magasinLangage, exp } = await etatAvecVecu();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.45.0', maintenant });
  const ancienne = await ancienneSauvegarde(fichier, { schema: 1, sansTables: TABLES_AJOUTEES_APRES_SCHEMA_1 });
  const lu = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  for (const t of TABLES_AJOUTEES_APRES_SCHEMA_1) assert.deepEqual(lu.donnees.langage[t], [], `table ${t} complétée vide`);
  // Les tables présentes sont intactes, rien n'est fabriqué.
  assert.deepEqual(lu.donnees.langage.experiences, [exp]);
  const memoireNeuve = creerMemoire(creerMagasinMemoire());
  const langageNeuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: memoireNeuve, magasinLangage: langageNeuf, donnees: lu.donnees });
  assert.deepEqual(await langageNeuf.lireTout('experiences'), [exp]);
  for (const t of TABLES_AJOUTEES_APRES_SCHEMA_1) assert.deepEqual(await langageNeuf.lireTout(t), [], `table ${t} vide après import`);
});

test('C. régression documentée : le cas "sans actes seulement" (sauvegarde faite avant v0.61.4) est importable', async () => {
  const { memoire, magasinLangage } = await etatAvecVecu();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.61.3', maintenant });
  const ancienne = await ancienneSauvegarde(fichier, { schema: 1, sansTables: ['actes', 'enonces'] });
  const lu = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  assert.deepEqual(lu.donnees.langage.actes, []);
  assert.equal(lu.donnees.langage.traces.length, 1, 'les traces présentes sont conservées');
});

test('D. une sauvegarde de schéma 1 qui contient déjà "actes" mais pas "enonces" (APK 0.61.x) est importable', async () => {
  const { memoire, magasinLangage, acte, trace } = await etatAvecVecu();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.61.6', maintenant });
  const ancienne = await ancienneSauvegarde(fichier, { schema: 1, sansTables: ['enonces'] });
  const lu = await lireSauvegardeComplete(JSON.stringify(ancienne), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  assert.deepEqual(lu.donnees.langage.actes, [acte]);
  assert.deepEqual(lu.donnees.langage.traces, [trace]);
  assert.deepEqual(lu.donnees.langage.enonces, []);
});

test('E. une sauvegarde de schéma courant (5) reste STRICTE : une table manquante est un refus, pas une invention', async () => {
  const { memoire, magasinLangage } = await etatAvecVecu();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.0', maintenant });
  const incomplete = await ancienneSauvegarde(fichier, { schema: 5, sansTables: ['enonces'] });
  const lu = await lireSauvegardeComplete(JSON.stringify(incomplete), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, false);
  assert.match(lu.erreur, /incomplet.*enonces/);
});

test('F. un schéma futur (6) est refusé avec le message "version plus récente"', async () => {
  const { memoire, magasinLangage } = await etatAvecVecu();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.0', maintenant });
  const futur = await ancienneSauvegarde(fichier, { schema: 6, sansTables: [] });
  const lu = await lireSauvegardeComplete(JSON.stringify(futur), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, false);
  assert.match(lu.erreur, /plus récente/);
});

test('G. aller-retour complet schéma 2 : les énoncés sont restaurés à l\'identique', async () => {
  const { memoire, magasinLangage, enonce } = await etatAvecVecu();
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage, idNaissance: 'id', versionAppli: '0.62.0', maintenant });
  const lu = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu.ok, true, lu.erreur);
  const langageNeuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: langageNeuf, donnees: lu.donnees });
  assert.deepEqual(await langageNeuf.lireTout('enonces'), [enonce]);
  for (const t of TABLES_LANGAGE) assert.deepEqual(await langageNeuf.lireTout(t), await magasinLangage.lireTout(t), `table ${t}`);
});

test('H. migrerDonnees : schéma 1 complète toute table absente par [] (sans toucher aux présentes) ; schéma courant ne touche à rien', () => {
  const partiel = { faits: [{ cle: 'x' }] };
  const complete = migrerDonnees(partiel, TABLES_LANGAGE, 1);
  assert.deepEqual(complete.faits, [{ cle: 'x' }]);
  for (const t of TABLES_LANGAGE) if (t !== 'faits') assert.deepEqual(complete[t], [], t);
  assert.deepEqual(Object.keys(migrerDonnees(partiel, TABLES_LANGAGE, SCHEMA_SAUVEGARDE)), ['faits']);
});
// === FIN_TEST_SAUVEGARDE_SCHEMA2 ===
