// v0.63.72 — contexte prospectif : persister ce qui était envisageable AVANT l'issue (décision ChatGPT, 07/10/2026). Preuves : calcul pur contextesProspectifs (une projection
// par donnée liée et par épisode parent ; épisode partiel sans placeholder ; chemins ouverts par parcours/couvertures ; tous les constats historiques avec témoins ; famille
// absente = témoins vides) ; écriture ancrée sur la désignation, AVANT résolution/invocation/exécution ; refus mécanique après l'issue ; histoire figée ; migration additive
// (20 / 10 / 23) ; mesures du scénario réel et de la sonde à six expériences ; comportement vivant inchangé ; aucun mot d'attente/prédiction/choix.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as module from '../app/langage/contexte-prospectif.js';
import { contextesProspectifs } from '../app/langage/contexte-prospectif.js';
import { episodesDeTransformation } from '../app/langage/episodes-de-transformation.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';
import { TABLE_OPERATIONS } from '../app/langage/table-operations.js';
import { executerApplicationsDeterminees } from '../app/langage/execution-mecanique.js';
import { executerApplicationSollicitee } from '../app/langage/execution-sollicitee.js';
import { suivreObservationDuTour } from '../app/langage/contexte-sollicitation.js';
import { traiterTourAvecEnonce } from '../app/langage/pont.js';
import { observerPossibilites } from '../app/langage/observation-possibilites.js';
import { magasinMemoireVive, enregistrerObservationPossibilites, enregistrerValeurDonnee, enregistrerContexteProspectif, TABLES, CLE, VERSION_BASE, NOM_BASE, ouvrirIndexedDB } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE, construireSauvegardeComplete, lireSauvegardeComplete, importerSauvegardeComplete, migrerDonnees } from '../app/memoire/sauvegarde.js';
import { creerMemoire } from '../app/memoire/memoire.js';
import { creerMagasinMemoire, TABLES as TABLES_MEMOIRE } from '../app/memoire/magasin.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CHEMIN = join(RACINE, 'app', 'langage', 'contexte-prospectif.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const CODE = SRC.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
const CONN = readFileSync(join(RACINE, 'app', 'langage', 'connaissances.js'), 'utf8');
const EXEC = readFileSync(join(RACINE, 'app', 'langage', 'execution-sollicitee.js'), 'utf8');
const sansCommentaires = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fichiersJs = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(m?js|html)$/.test(n) ? [p] : []; });
const refuse = (f) => assert.throws(f, (e) => e instanceof TypeError);
const T = 'contextesProspectifs';
const sk = (st) => st.map((s) => `${s.operation}(${s.entrees.join(',')})`).join('>');
const ch = { forme: 'scalaire', genre: 'chaine' };
const coll = { forme: 'collection', elements: ch };
const DESC = [
  { nom: 'transformer', entrees: { x: ch }, sortie: ch },
  { nom: 'assembler', entrees: { gauche: ch, droite: ch }, sortie: ch },
  { nom: 'eclater', entrees: { x: ch }, sortie: coll },
  { nom: 'recoller', entrees: { elements: coll }, sortie: ch },
];
const msg = (id, valeur) => ({ id, valeur });
const lien = (entree, donnee) => ({ entree, donnee });
const ex = (id, operation, liaisons, resultat) => ({ id, horodatage: 1, idDesignation: `d-${id}`, operation, liaisons, resultat });
const histoireRS = (n) => { // n expériences m_k -> eclater -> R_k -> recoller -> S_k (valeur revenue), plus la donnée R_n+1 à composer
  const M = []; const E = [];
  for (let k = 1; k <= n; k += 1) { M.push(msg(`m${k}`, `v${k}`)); E.push(ex(`R${k}`, 'eclater', [lien('x', `m${k}`)], ['v', String(k)]), ex(`S${k}`, 'recoller', [lien('elements', `R${k}`)], `v${k}`)); }
  M.push(msg(`m${n + 1}`, `v${n + 1}`)); E.push(ex(`R${n + 1}`, 'eclater', [lien('x', `m${n + 1}`)], ['v', String(n + 1)]));
  return { M, E, application: { operation: 'recoller', liaisons: [lien('elements', `R${n + 1}`)] } };
};

// ---------------------------------------------------------------------------------------------------------------------------------- A. CALCUL PUR
test('A1. export unique, fonction synchrone à quatre paramètres ; aucun mot d\'attente, de prédiction, de confiance, de choix dans le code', () => {
  assert.deepEqual(Object.keys(module), ['contextesProspectifs']);
  assert.equal(contextesProspectifs.length, 4);
  assert.equal(contextesProspectifs.constructor.name, 'Function');
  assert.equal(/attente|attendu(?!e)|prediction|prédiction|confirm|contradict|succes|succès|echec|échec|confiance|probab|score|frequence|fréquence|majorit|vote|seuil|preference|préférence|recompense|récompense|choisir|choix/i.test(CODE), false); // « attendue » (une donnée est attendue) est le vocabulaire des refus de lecture, pas une attente
  assert.equal(/relationValeur|symbolesDeChaine|composerCollection|'arrivee'|'valeurs'/.test(CODE), false, 'aucun nom de champ d\'épisode ni d\'opération');
});

test('A2. projection directe (donnée sans épisode parent) : une projection, structure de longueur 1, épisode partiel sans arrivée ; famille absente = témoins et chemins vides (trace « jamais vécue »)', () => {
  const r = contextesProspectifs({ operation: 'transformer', liaisons: [lien('x', 'A')] }, [msg('A', 'v')], [], DESC);
  assert.deepEqual(r, [{
    application: { operation: 'transformer', liaisons: [{ entree: 'x', donnee: 'A' }] },
    donnee: 'A', parent: null, structure: [{ operation: 'transformer', entrees: ['x'] }],
    episodePartiel: { depart: 'A', chemin: [{ de: 'A', operation: 'transformer', entrees: ['x'] }] },
    temoins: [], chemins: [],
  }]);
  assert.equal('arrivee' in r[0].episodePartiel, false);
  assert.equal('execution' in r[0].episodePartiel.chemin[0], false);
  assert.equal('vers' in r[0].episodePartiel.chemin[0], false);
});

test('A3. prolongement : une projection directe + une par épisode parent dont la donnée est l\'arrivée ; épisode partiel = étapes vécues complètes + dernière étape { de, operation, entrees }', () => {
  const E = [ex('B', 'transformer', [lien('x', 'A')], 'b')];
  const r = contextesProspectifs({ operation: 'transformer', liaisons: [lien('x', 'B')] }, [msg('A', 'v')], E, DESC);
  assert.deepEqual(r.map((c) => [c.donnee, c.parent === null, sk(c.structure)]), [['B', true, 'transformer(x)'], ['B', false, 'transformer(x)>transformer(x)']]);
  assert.deepEqual(r[1].parent.depart, 'A');
  assert.deepEqual(r[1].parent.arrivee, 'B');
  assert.deepEqual(r[1].episodePartiel, { depart: 'A', chemin: [{ de: 'A', execution: 'B', operation: 'transformer', entrees: ['x'], vers: 'B' }, { de: 'B', operation: 'transformer', entrees: ['x'] }] });
  assert.notEqual(r[1].parent, undefined);
});

test('A4. plusieurs entrées, même donnée en deux rôles, collectif : une projection par donnée liée et par lignée, rôles canoniques, jamais fusionnées', () => {
  const E = [ex('B', 'transformer', [lien('x', 'A')], 'b'), ex('C', 'transformer', [lien('x', 'A')], 'c')];
  const deux = contextesProspectifs({ operation: 'assembler', liaisons: [lien('droite', 'C'), lien('gauche', 'B')] }, [msg('A', 'v')], E, DESC);
  assert.deepEqual(deux.map((c) => `${c.donnee}:${sk(c.structure)}`), ['B:assembler(gauche)', 'B:transformer(x)>assembler(gauche)', 'C:assembler(droite)', 'C:transformer(x)>assembler(droite)']);
  const memes = contextesProspectifs({ operation: 'assembler', liaisons: [lien('gauche', 'B'), lien('droite', 'B')] }, [msg('A', 'v')], E, DESC);
  assert.deepEqual(memes.map((c) => sk(c.structure)), ['assembler(droite,gauche)', 'transformer(x)>assembler(droite,gauche)']);
  const collectif = contextesProspectifs({ operation: 'recoller', liaisons: [{ entree: 'elements', donnees: ['C', 'B'] }] }, [msg('A', 'v')], E, DESC);
  assert.deepEqual(collectif.map((c) => `${c.donnee}:${sk(c.structure)}`), ['B:recoller(elements)', 'B:transformer(x)>recoller(elements)', 'C:recoller(elements)', 'C:transformer(x)>recoller(elements)']);
  assert.deepEqual(collectif[0].application.liaisons, [{ entree: 'elements', donnees: ['B', 'C'] }], 'copie canonique de l\'application');
});

test('A5. chemins ouverts : exactement les chemins historiques que l\'épisode partiel ne possède pas ; tous les constats avec témoins ; aucune sélection', () => {
  const { M, E, application } = histoireRS(3);
  const [directe, prolongement] = contextesProspectifs(application, M, E, DESC);
  assert.equal(sk(prolongement.structure), 'eclater(x)>recoller(elements)');
  assert.equal(prolongement.temoins.length, 3);
  assert.deepEqual(prolongement.chemins.map((c) => JSON.stringify(c.chemin)), ['["arrivee"]', '["chemin",1,"execution"]', '["chemin",1,"vers"]', '["relationValeur"]', '["valeurs"]', '["valeurs","arrivee"]', '["valeurs","depart"]']);
  const relation = prolongement.chemins.find((c) => c.chemin[0] === 'relationValeur');
  assert.deepEqual(relation.constats, [{ type: 'chaine', valeur: 'egale', couverture: [['m1', 'S1', 'R1', 'S1'], ['m2', 'S2', 'R2', 'S2'], ['m3', 'S3', 'R3', 'S3']] }]);
  const arrivee = prolongement.chemins.find((c) => c.chemin[0] === 'arrivee');
  assert.deepEqual(arrivee.constats.map((k) => [k.valeur, k.couverture.length]), [['S1', 1], ['S2', 1], ['S3', 1]], 'identités futures conservées, non filtrées');
  assert.equal(prolongement.chemins.find((c) => c.chemin[0] === 'valeurs' && c.chemin.length === 1).constats[0].type, 'objet', 'conteneur sans valeur conservé');
  // la projection directe [recoller(elements)] a aussi une famille (R_k -> S_k) : non comparables
  assert.equal(directe.temoins.length, 3);
  assert.deepEqual(directe.chemins.find((c) => c.chemin[0] === 'relationValeur').constats.map((k) => k.valeur), ['non_comparable']);
});

test('A6. constats variables (egale ×2, differente ×1) et absence : conservés tels quels avec leurs témoins, couverture partielle préservée', () => {
  const { M, E, application } = histoireRS(3);
  E[3] = ex('S2', 'recoller', [lien('elements', 'R2')], 'autre'); // la 2e expérience ne revient pas
  const [, p] = contextesProspectifs(application, M, E, DESC);
  const relation = p.chemins.find((c) => c.chemin[0] === 'relationValeur');
  assert.deepEqual(relation.constats.map((k) => [k.valeur, k.couverture.map((t) => t[0])]), [['egale', ['m1', 'm3']], ['differente', ['m2']]]);
  // absence : un témoin sans `valeurs` (non comparable) -> le chemin ["valeurs"] a une couverture partielle
  E[3] = ex('S2', 'recoller', [lien('elements', 'R2')], ['pas', 'une', 'chaine']); // arrivée non comparable
  const [, q] = contextesProspectifs(application, M, E, [...DESC.filter((d) => d.nom !== 'recoller'), { nom: 'recoller', entrees: { elements: coll }, sortie: { forme: 'quelconque' } }]);
  const valeurs = q.chemins.find((c) => c.chemin[0] === 'valeurs' && c.chemin.length === 1);
  assert.equal(valeurs.couverture.length, 2);
  assert.equal(q.temoins.length, 3);
  assert.equal(JSON.stringify(q).includes('ABSENT'), false);
});

test('A7. occurrence unique : une famille d\'un témoin produit un contexte complet (couvertures de taille 1), sans refus', () => {
  const { M, E, application } = histoireRS(1);
  const [, p] = contextesProspectifs(application, M, E, DESC);
  assert.equal(p.temoins.length, 1);
  assert.equal(p.chemins.length, 7);
  for (const c of p.chemins) for (const k of c.constats) assert.equal(k.couverture.length, 1);
});

test('A8. pureté : entrées gelées intactes, appels identiques, aucune référence partagée ; entrées mal formées refusées', () => {
  const gel = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(gel); Object.freeze(o); } return o; };
  const { M, E, application } = histoireRS(2);
  gel(M); gel(E); gel(application); const D = gel(structuredClone(DESC));
  const avant = JSON.stringify([M, E, application]);
  const a = contextesProspectifs(application, M, E, D);
  const b = contextesProspectifs(application, M, E, D);
  assert.deepEqual(a, b);
  assert.notEqual(a[0], b[0]);
  assert.equal(a[0].application.liaisons === application.liaisons, false);
  assert.equal(JSON.stringify([M, E, application]), avant);
  refuse(() => contextesProspectifs(null, M, E, D));
  refuse(() => contextesProspectifs({ operation: '', liaisons: [lien('x', 'A')] }, M, E, D));
  refuse(() => contextesProspectifs({ operation: 'recoller', liaisons: [] }, M, E, D));
  refuse(() => contextesProspectifs({ operation: 'recoller', liaisons: [lien('elements', 'R1'), lien('elements', 'R2')] }, M, E, D), 'entrée dupliquée');
  refuse(() => contextesProspectifs({ operation: 'recoller', liaisons: [{ entree: 'elements', donnees: ['R1', 'R1'] }] }, M, E, D));
  refuse(() => contextesProspectifs(application, 'x', E, D));
  refuse(() => contextesProspectifs(application, M, [{ id: 'cassee' }], D));
  for (const motif of [/\bDate\b/, /Math\.random/, /\bawait\b/, /\basync\b/, /\bPromise\b/, /\blocalStorage\b/, /\.ecrire|\.lireTout|magasin/, /invoquerOperation|TABLE_OPERATIONS|\.fonction\(/]) assert.equal(motif.test(CODE), false, String(motif));
  const importees = [...SRC.matchAll(/^import .* from '(.+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(importees, ['./constats-par-chemin.js', './couverture-occurrences.js', './episodes-de-transformation.js', './familles-episodes.js', './parcours-structure.js']);
});

// ---------------------------------------------------------------------------------------------------------------------------------- B. PERSISTANCE
test('B1. table contextesProspectifs : déclarée en dernier, clé id ; VERSION_BASE 20, SCHEMA_SAUVEGARDE 10, 23 tables', () => {
  assert.equal(TABLES[TABLES.length - 4], T); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : attentesProspectives est déclarée après
  assert.equal(CLE[T], 'id');
  assert.equal(TABLES.length, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 23 → 24 (+ attentesProspectives) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.equal(new Set(TABLES).size, 26); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74
  assert.equal(VERSION_BASE, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21
  assert.equal(SCHEMA_SAUVEGARDE, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11
});

test('B2. migration 19 → 20 (IndexedDB simulée) : crée SEULEMENT contextesProspectifs, aucune donnée existante touchée, aucune ligne fabriquée', async () => {
  const existants = TABLES.filter((t) => t !== T);
  const donnees = new Map(existants.map((t) => [t, [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null; let nom = null;
  const fabrique = { open(n, v) {
    nom = n; version = v;
    const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) };
    const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null };
    Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); });
    return r;
  } };
  await ouvrirIndexedDB(fabrique);
  assert.equal(nom, NOM_BASE); assert.equal(version, 22); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 20 → 21 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 21 → 22 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.deepEqual(crees, [[T, 'id']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
  assert.deepEqual(donnees.get(T), []);
});

test('B3. sauvegarde : schéma 10 exporté/restauré à l\'identique ; un fichier de schéma 9 est complété par [] (aucune reconstruction) ; schéma 10 sans la table = incomplet ; schéma 11 refusé', async () => {
  const magasin = magasinMemoireVive();
  const { apres } = await rejouer(['bonjour Pixel', 'bonjour Luna'], magasin);
  assert.ok(apres[1].contextes.length > 0);
  const memoire = creerMemoire(creerMagasinMemoire());
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage: magasin, idNaissance: 'id', versionAppli: '0.63.72', maintenant: new Date('2026-10-07T20:00:00Z') });
  assert.equal(fichier.objet.schema, 12); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : 10 → 11 (+ table attentesProspectives : VERSION_BASE 21, SCHEMA_SAUVEGARDE 11, 24 tables) // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : 11 → 12 (+ tables emissions, receptions : VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  const neuf = magasinMemoireVive();
  await importerSauvegardeComplete({ memoire: creerMemoire(creerMagasinMemoire()), magasinLangage: neuf, donnees: lue.donnees });
  assert.deepEqual(await neuf.lireTout(T), await magasin.lireTout(T));
  // ancien schéma : complété par [], jamais fabriqué
  const ancien = JSON.parse(fichier.contenu); ancien.schema = 9; delete ancien.donnees.langage[T]; delete ancien.donnees.langage.attentesProspectives; // MISE À JOUR DÉLIBÉRÉE v0.63.74 : un schéma 9 n'a ni contextes ni attentes
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 9)[T], []);
  assert.deepEqual(migrerDonnees({ faits: [] }, [T], 10)[T], [], 'schéma 10 : complété (il manque attentesProspectives)'); // MISE À JOUR DÉLIBÉRÉE v0.63.74
  assert.equal(Object.prototype.hasOwnProperty.call(migrerDonnees({ faits: [] }, [T], 12), T), false); // MISE À JOUR DÉLIBÉRÉE v0.63.74 : courant 11 // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  assert.deepEqual(migrerDonnees({ [T]: [{ id: 'z' }] }, [T], 3)[T], [{ id: 'z' }]);
  const { empreinte } = await import('../app/memoire/transfert.js');
  const refaire = async (objet) => { const corps = JSON.stringify(objet.donnees); return JSON.stringify({ ...objet, empreinte: await empreinte(corps) }); };
  const anciennement = await lireSauvegardeComplete(await refaire(ancien), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(anciennement.ok, true, anciennement.erreur);
  assert.deepEqual(anciennement.donnees.langage[T], []);
  const incomplet = JSON.parse(fichier.contenu); delete incomplet.donnees.langage[T];
  const lu2 = await lireSauvegardeComplete(await refaire(incomplet), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu2.ok, false); assert.match(lu2.erreur, /incomplet/);
  const futur = JSON.parse(fichier.contenu); futur.schema = 13; // MISE À JOUR DÉLIBÉRÉE v0.63.74 : futur 12 // MISE À JOUR DÉLIBÉRÉE v0.63.80 (J-A, émissions/réceptions) : + emissions, receptions (VERSION_BASE 22, SCHEMA_SAUVEGARDE 12, 26 tables)
  const lu3 = await lireSauvegardeComplete(await refaire(futur), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu3.ok, false); assert.match(lu3.erreur, /plus récente/);
});

test('B4. enregistrerContexteProspectif : copie structurelle du contexte, ancrage (idDesignation, idObservation), horodatage ; refus des entrées mal formées ; AUCUNE interprétation ajoutée', async () => {
  const magasin = magasinMemoireVive();
  const designation = { id: 'designation-application-1', idObservation: 'obs-1', operation: 'recoller', liaisons: [lien('elements', 'R2')], origine: 'mecanique', horodatage: 'h' };
  const { M, E, application } = histoireRS(1);
  const [contexte] = contextesProspectifs(application, M, E, DESC).filter((c) => c.parent !== null);
  const ligne = await enregistrerContexteProspectif(magasin, { designation, contexte });
  assert.deepEqual(Object.keys(ligne), ['id', 'horodatage', 'idDesignation', 'idObservation', 'application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins']);
  assert.match(ligne.id, /^contexte-prospectif-/);
  assert.equal(ligne.idDesignation, 'designation-application-1'); assert.equal(ligne.idObservation, 'obs-1');
  for (const champ of ['application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins']) { assert.deepEqual(ligne[champ], contexte[champ]); if (typeof contexte[champ] === 'object' && contexte[champ] !== null) assert.notEqual(ligne[champ], contexte[champ]); }
  assert.deepEqual(await magasin.lireTout(T), [ligne]);
  await assert.rejects(enregistrerContexteProspectif(magasin, { designation, contexte, autre: 1 }), TypeError);
  await assert.rejects(enregistrerContexteProspectif(magasin, { designation: { ...designation, operation: 'transformer' }, contexte }), TypeError);
  await assert.rejects(enregistrerContexteProspectif(magasin, { designation, contexte: { ...contexte, attendu: 'egale' } }), TypeError);
  await assert.rejects(enregistrerContexteProspectif(magasin, { designation: { ...designation, id: '' }, contexte }), TypeError);
  await assert.rejects(enregistrerContexteProspectif(magasin, { designation, contexte: { ...contexte, temoins: 3 } }), TypeError);
  assert.equal((await magasin.lireTout(T)).length, 1);
  const bloc = sansCommentaires(CONN.slice(CONN.indexOf('// === CONTEXTE PROSPECTIF PERSISTÉ')));
  assert.equal(/attendu(?!e)|prediction|confirm|contradict|confiance|score|majorit|choisir/i.test(bloc), false);
});

test('B5. ORDRE TEMPOREL : une exécution déjà présente pour la désignation rend l\'écriture IMPOSSIBLE ; la séquence des identités prouve l\'ordre désignation < contexte < exécution', async () => {
  const magasin = magasinMemoireVive();
  const { apres } = await rejouer(['bonjour Pixel'], magasin);
  const executions = await magasin.lireTout('executionsOperations');
  const designations = await magasin.lireTout('designations');
  const contextes = await magasin.lireTout(T);
  assert.equal(executions.length, 2); assert.equal(contextes.length, 2);
  const seq = (id) => Number(id.match(/-(\d+)-\d+$/)[1]);
  for (const c of contextes) {
    const d = designations.find((x) => x.id === c.idDesignation); const e = executions.find((x) => x.idDesignation === c.idDesignation);
    assert.ok(d && e);
    assert.ok(seq(d.id) < seq(c.id) && seq(c.id) < seq(e.id), `${d.id} < ${c.id} < ${e.id}`);
    assert.ok(c.horodatage <= e.horodatage);
    assert.deepEqual(c.application, { operation: d.operation, liaisons: d.liaisons });
  }
  // après coup : impossible
  const d = designations[0]; const [contexte] = contextes;
  const copie = { application: contexte.application, donnee: contexte.donnee, parent: contexte.parent, structure: contexte.structure, episodePartiel: contexte.episodePartiel, temoins: contexte.temoins, chemins: contexte.chemins };
  await assert.rejects(enregistrerContexteProspectif(magasin, { designation: d, contexte: copie }), /existe déjà/);
  assert.equal((await magasin.lireTout(T)).length, 2);
  assert.equal(apres[0].contextes.length, 2);
});

// ---------------------------------------------------------------------------------------------------------------------------------- C. FLUX RÉEL
async function rejouer(scenario, magasin = magasinMemoireVive(), solliciter = false) {
  let n = 0;
  const nouvelId = (p) => `${p}-${++n}`;
  const tours = []; const apres = [];
  const ex = () => magasin.lireTout('executionsOperations');
  for (const t of scenario) {
    const suivi = suivreObservationDuTour(
      (m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: ex }),
      (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }),
    );
    const res = await traiterTourAvecEnonce(t, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    tours.push(s);
    if (solliciter) {
      const { observation, univers } = s;
      const vals = await magasin.lireTout('valeursDonnees'); const msgId = vals[vals.length - 1].id; const faits = await ex();
      const soll = async (operation, liaisons) => { const r = await executerApplicationSollicitee({ observation, application: { operation, liaisons }, univers }, { magasin, table: TABLE_OPERATIONS }); assert.equal(r.statut, 'executee'); };
      for (const R of faits.filter((e) => e.operation === 'symbolesDeChaine')) if (!faits.some((e) => e.operation === 'composerCollection' && e.liaisons[0].donnee === R.id) && observation.donneesExaminees.includes(R.id)) await soll('composerCollection', [lien('elements', R.id)]);
      if (!(await ex()).some((e) => e.operation === 'symbolesDeChaine' && e.liaisons[0].donnee === msgId)) await soll('symbolesDeChaine', [lien('chaine', msgId)]);
    }
    apres.push({ valeurs: await magasin.lireTout('valeursDonnees'), executions: await ex(), contextes: (await magasin.lireTout(T)).filter((c) => c.idObservation === s.observation.id) });
  }
  return { tours, apres, magasin };
}
const SCENARIO = ['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel', 'bonjour Max', 'bonjour Pixel et Luna', 'au revoir Pixel', 'bonjour Luna'];
const trouverIssue = (c, episodes, executions) => { const e = executions.find((x) => x.idDesignation === c.idDesignation); return e && episodes.find((x) => x.arrivee === e.id && x.depart === c.episodePartiel.depart && sk(x.chemin.map((y) => ({ operation: y.operation, entrees: y.entrees }))) === sk(c.structure)); };

test('C1. POINT D\'ÉCRITURE : dans executerApplicationAvecOrigine, après la désignation et avant la résolution ; mécanique, sollicitation extérieure et choix exécuté passent par le même chemin', async () => {
  const code = sansCommentaires(EXEC);
  const iDes = code.indexOf('enregistrerDesignation('); const iCtx = code.indexOf('contextesProspectifs('); const iEcr = code.indexOf('enregistrerContexteProspectif('); const iRes = code.indexOf('resoudreValeursApplication('); const iInv = code.indexOf('invoquerOperation(');
  assert.ok(iDes > 0 && iDes < iCtx && iCtx < iEcr && iEcr < iRes && iRes < iInv);
  assert.equal(/\.resultat|produit|statut/.test(code.slice(iCtx, iRes)), false, 'rien du résultat n\'est lu');
  const { apres, magasin } = await rejouer(['bonjour Pixel', 'bonjour Luna', 'bonjour Pixel'], undefined, false);
  const t3 = apres[2];
  const { observation, univers } = (await (async () => { const obs = await magasin.lireTout('observationsPossibilites'); return { observation: obs[2], univers: null }; })());
  const R = t3.executions.find((e) => e.operation === 'symbolesDeChaine');
  // sollicitation extérieure d'un choix : même chemin, contextes écrits avant l'exécution
  const avant = (await magasin.lireTout(T)).length;
  const tours = await rejouer([], magasin); void tours;
  const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), (c) => executerApplicationsDeterminees(c, { magasin, table: TABLE_OPERATIONS }));
  let n = 100; const res = await traiterTourAvecEnonce('bonjour Max', null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId: (p) => `${p}-${++n}`, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
  const s = suivi.joindre(res).sollicitation;
  assert.ok(s.choixAFaire.includes('composerCollection'));
  const r = await executerApplicationSollicitee({ observation: s.observation, application: { operation: 'composerCollection', liaisons: [lien('elements', R.id)] }, univers: s.univers }, { magasin, table: TABLE_OPERATIONS });
  assert.equal(r.statut, 'executee');
  const miens = (await magasin.lireTout(T)).filter((c) => c.idDesignation === r.designation.id);
  assert.equal(miens.length, 2, 'directe + prolongement');
  assert.deepEqual(miens.map((c) => sk(c.structure)).sort(), ['composerCollection(elements)', 'symbolesDeChaine(chaine)>composerCollection(elements)']);
  assert.ok((await magasin.lireTout(T)).length > avant);
  void observation; void univers;
});

test('C2. SCÉNARIO RÉEL 7 tours : 58 contextes pour 19 exécutions, tous avec issue ; 21 avec histoire, 37 jamais vécues ; comportement vivant inchangé', async () => {
  const { tours, apres, magasin } = await rejouer(SCENARIO);
  assert.deepEqual(tours.map((s) => s.choixAFaire.length), [0, 1, 4, 13, 13, 13, 13]);
  assert.deepEqual(tours.map((s) => s.automatiques.length), [2, 4, 9, 1, 1, 1, 1]);
  assert.equal(apres[6].executions.length, 19);
  assert.equal(tours.flatMap((s) => s.automatiques).filter((x) => x.statut !== 'executee').length, 0);
  const C = await magasin.lireTout(T);
  assert.equal(C.length, 58);
  assert.deepEqual(apres.map((a) => a.contextes.length), [2, 7, 33, 4, 4, 4, 4]);
  assert.equal(new Set(C.map((c) => c.idDesignation)).size, 19, 'une désignation = une application exécutée ; chacune a au moins un contexte');
  assert.equal(C.filter((c) => c.temoins.length > 0).length, 21);
  assert.equal(C.filter((c) => c.temoins.length === 0).length, 37);
  const episodes = episodesDeTransformation(apres[6].valeurs, apres[6].executions, DESCRIPTIONS_OPERATIONS).episodes;
  assert.equal(C.filter((c) => trouverIssue(c, episodes, apres[6].executions)).length, 58, 'chaque contexte retrouve exactement son épisode réel');
  const parApp = new Map(); for (const c of C) parApp.set(c.idDesignation, (parApp.get(c.idDesignation) ?? 0) + 1);
  assert.deepEqual([...parApp.values()].reduce((h, v) => { h[v] = (h[v] ?? 0) + 1; return h; }, {}), { 1: 3, 2: 3, 3: 6, 4: 5, 5: 1, 6: 1 });
  assert.equal(C.reduce((a, c) => a + c.chemins.length, 0), 84);
  assert.equal(C.reduce((a, c) => a + c.chemins.reduce((b, ch) => b + ch.constats.length, 0), 0), 204);
  // les 3 colonnes d'un épisode futur jamais présentes : aucun placeholder
  for (const c of C) { assert.equal('arrivee' in c.episodePartiel, false); const derniere = c.episodePartiel.chemin.at(-1); assert.equal('execution' in derniere || 'vers' in derniere, false); }
  for (const c of C) assert.equal(/attendu|prediction/.test(JSON.stringify(c)), false);
});

test('C3. CAS CENTRAL (sonde six expériences) : avant chaque composerCollection(elements=R_k), le contexte du prolongement a 1, 2, 3, 4, 5 témoins et relationValeur egale ×N parmi 7 chemins ouverts ; histoire FIGÉE', async () => {
  const { apres, magasin } = await rejouer(['bonjour Pixel', 'bonjour Luna', '', 'abc', 'é😀', 'éa', 'fin'], undefined, true);
  const C = await magasin.lireTout(T);
  const centraux = C.filter((c) => sk(c.structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)');
  assert.equal(centraux.length, 6);
  assert.deepEqual(centraux.map((c) => c.temoins.length), [0, 1, 2, 3, 4, 5]);
  for (const [i, c] of centraux.entries()) {
    if (i === 0) { assert.deepEqual(c.chemins, []); continue; }
    assert.deepEqual(c.chemins.map((x) => JSON.stringify(x.chemin)), ['["arrivee"]', '["chemin",1,"execution"]', '["chemin",1,"vers"]', '["relationValeur"]', '["valeurs"]', '["valeurs","arrivee"]', '["valeurs","depart"]']);
    const rel = c.chemins.find((x) => x.chemin[0] === 'relationValeur');
    assert.deepEqual(rel.constats.map((k) => [k.valeur, k.couverture.length]), [['egale', i]]);
    assert.equal(c.chemins.find((x) => x.chemin[0] === 'arrivee').constats.length, i, 'identités futures conservées');
    assert.equal(c.parent.chemin[0].operation, 'symbolesDeChaine');
    assert.equal(c.episodePartiel.chemin.length, 2);
  }
  // histoire figée : l'état final de la famille a 6 témoins, les anciennes lignes gardent 0…5
  const episodes = episodesDeTransformation(apres[6].valeurs, apres[6].executions, DESCRIPTIONS_OPERATIONS).episodes;
  assert.equal(episodes.filter((e) => e.relationValeur === 'egale').length, 6);
  const relus = await magasin.lireTout(T);
  assert.deepEqual(relus.filter((c) => sk(c.structure) === 'symbolesDeChaine(chaine)>composerCollection(elements)').map((c) => c.temoins.length), [0, 1, 2, 3, 4, 5]);
  assert.equal(C.length, 93);
  assert.equal(C.filter((c) => trouverIssue(c, episodes, apres[6].executions)).length, 93);
});

test('C4. HISTOIRE FIGÉE après contradiction : une trace écrite avec egale ×6 reste egale ×6 quand une expérience differente s\'ajoute ; une nouvelle trace voit egale ×6 + differente ×1', () => {
  const { M, E, application } = histoireRS(6);
  const [, avant] = contextesProspectifs(application, M, E, DESC);
  const fige = structuredClone(avant);
  // 7e expérience, differente, puis une nouvelle donnée à composer
  const M2 = [...M, msg('m8', 'v8')];
  const E2 = [...E, ex('S7', 'recoller', [lien('elements', 'R7')], 'w'), ex('R8', 'eclater', [lien('x', 'm8')], ['v', '8'])];
  const [, apres] = contextesProspectifs({ operation: 'recoller', liaisons: [lien('elements', 'R8')] }, M2, E2, DESC);
  assert.deepEqual(avant, fige, 'la valeur calculée avant n\'a pas bougé (aucun état partagé)');
  assert.deepEqual(avant.chemins.find((c) => c.chemin[0] === 'relationValeur').constats.map((k) => [k.valeur, k.couverture.length]), [['egale', 6]]);
  assert.deepEqual(apres.chemins.find((c) => c.chemin[0] === 'relationValeur').constats.map((k) => [k.valeur, k.couverture.length]), [['egale', 6], ['differente', 1]]);
  assert.equal(apres.temoins.length, 7);
});

test('C5. passé non résoluble : aucun contexte calculé, exécution inchangée (absence de ligne = « calcul non effectué », distinct de « jamais vécue »)', async () => {
  const { tours, magasin } = await rejouer(['bonjour Pixel']);
  // une ligne d'exécution étrangère au contrat (liaison vers une identité inconnue) rend le passé non résoluble par les vues
  await magasin.ecrire('executionsOperations', { id: 'execution-operation-etrangere', horodatage: 'h', idDesignation: 'd-etrangere', operation: 'parcourirStructure', liaisons: [lien('valeur', 'identite-inconnue')], resultat: [] });
  const avant = (await magasin.lireTout(T)).length;
  const { observation, univers } = tours[0];
  const r = await executerApplicationSollicitee({ observation, application: { operation: 'symbolesDeChaine', liaisons: [lien('chaine', (await magasin.lireTout('valeursDonnees'))[0].id)] }, univers }, { magasin, table: TABLE_OPERATIONS });
  assert.equal(r.statut, 'executee');
  assert.equal((await magasin.lireTout(T)).length, avant, 'aucun contexte écrit : calcul non effectué');
  assert.equal((await magasin.lireTout(T)).some((c) => c.idDesignation === r.designation.id), false);
});

test('C6. DORMANCE DES AUTRES MÉCANISMES : seul execution-sollicitee.js importe le calcul ; applicationsSollicitables, choixAFaire, pont, esprit, écran, observation ne nomment ni la table ni le calcul', () => {
  const importeurs = fichiersJs(join(RACINE, 'app')).filter((f) => /from '\.\/contexte-prospectif\.js'/.test(readFileSync(f, 'utf8'))).map((f) => f.slice(RACINE.length + 1));
  assert.deepEqual(importeurs, ['app/langage/execution-sollicitee.js']);
  for (const nom of ['applications-sollicitables', 'contexte-sollicitation', 'groupes-candidats', 'pont', 'esprit', 'observation-possibilites', 'execution-mecanique', 'descriptions-operations', 'table-operations']) {
    assert.equal(/contexte-prospectif|contextesProspectifs|contextesProspectifs|enregistrerContexteProspectif/.test(sansCommentaires(readFileSync(join(RACINE, 'app', 'langage', `${nom}.js`), 'utf8'))), false, nom);
  }
  for (const autre of ['app/conversation/ecran.js', 'app/main.js', 'sw.js', 'worker.js', 'index.html']) { let s = ''; try { s = readFileSync(join(RACINE, autre), 'utf8'); } catch { continue; } assert.equal(/contextesProspectifs|contexte-prospectif/.test(sansCommentaires(s)), false, autre); }
  assert.equal(DESCRIPTIONS_OPERATIONS.length, 17);
  assert.equal(Object.keys(TABLE_OPERATIONS).length, 17);
});
