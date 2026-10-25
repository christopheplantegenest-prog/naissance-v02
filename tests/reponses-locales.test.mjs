// v0.64.22 — « DONNER UNE IDENTITÉ COMMUNE AUX RÉPONSES PROPRES DE NAISSANCE » (GO ChatGPT « v0.64.22 », 15/10/2026).
// Une RÉPONSE LOCALE = un événement du moteur propre ayant délivré un obtenu structuré en réponse à une question identifiée. Action et repondre
// restent deux mécanismes distincts ; ils ne se rejoignent qu'ici, comme deux PROVENANCES. Chaînes rejouées avec les vraies primitives
// (connaissances.js, pont.js, ecran.js de langage, corrections-apprises.js, divergences.js) ; main.js (sans export) est gardé statiquement.
// Lettres A–AH : celles du GO (section 22).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const P = await import('../app/langage/pont.js');
const E = await import('../app/langage/esprit.js');
const K = await import('../app/langage/corrections-apprises.js');
const D = await import('../app/langage/divergences.js');
const S = await import('../app/memoire/sauvegarde.js');
const B = await import('../app/conversation/brouillon.js');
const { evaluerAction } = await import('../app/langage/action.js');
const { identiteRegle } = await import('../app/langage/regle-forme.js');
const { monterEcranLangage } = await import('../app/langage/ecran.js');
const { induire } = await import('../app/langage/induction.js');
const { LEXIQUE_DEPART, ROLES } = await import('../app/langage/bagage.js');

const RACINE = new URL('..', import.meta.url).pathname;
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
const ecranSur = (magasin) => monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
const REGLE_CORRECTION = { operation: 'reponseAttendue', n: 5, ancres: [{ position: 0, jeton: 'Non' }, { position: 1, jeton: ',' }, { position: 2, jeton: "c'est" }, { position: 4, jeton: '.' }], roles: [{ position: 3, nom: 'reponse' }], constantes: {} };

// Monde comme sur le téléphone après v0.64.21 : faits, forme de question active (Action recherche), forme de correction active.
async function monde(faits = [['moi', 'vélo', 'Fusée'], ['Léa', 'surnom', 'Puce'], ['moi', 'kayak', 'Torpille']]) {
  const magasin = C.magasinMemoireVive();
  const e = await E.chargerEsprit(magasin);
  for (const [sujet, relation, valeur] of faits) await E.apprendreFait(e, { sujet, relation, valeur, origine: 'apprise-conversation' });
  const { objet: action } = await C.apprendreAction(magasin, { operation: 'recherche', roles: [{ position: 3, nom: 'relation' }, { position: 4, nom: 'valeur' }], n: 6, exemples: [{ entree: 'Qui a pour chien Rex ?' }, { entree: 'Qui a pour métier pilote ?' }], statut: 'validee', origine: 'induite-supervisee' });
  const s1 = await recevoir(magasin, "Non, c'est Zoé."); const s2 = await recevoir(magasin, "Non, c'est Max.");
  await C.enregistrerDecisionForme(magasin, { idCandidat: identiteRegle(REGLE_CORRECTION), decision: 'confirmee', sources: [s1.id, s2.id], regle: REGLE_CORRECTION });
  return { magasin, action };
}
async function recevoir(magasin, texte) {
  const message = P.identifierMessage(texte, { nouvelId: C.nouvelId });
  await P.conserverValeurMessage(message, { enregistrerValeur: (entree) => C.enregistrerValeurDonnee(magasin, entree) });
  return message;
}
// Voie Action réelle (ecran.js de langage), question identifiée.
async function demander(w, question) {
  const Q = await recevoir(w.magasin, question);
  const reco = await ecranSur(w.magasin).tenterReconnaissanceAction(question, Q.id);
  return { Q, reco };
}
// Voie repondre réelle (pont.js) avec les dépendances de main.js : journal (ids numériques), expérience B1 réelle, réponse locale réelle.
async function repondreLocal(w, texte, { journal = [101, 102], sansQuestion = false } = {}) {
  const Q = await recevoir(w.magasin, texte);
  const e = await E.chargerEsprit(w.magasin);
  const r = await P.tenterPontLangage(texte, {
    assurerEsprit: async () => e,
    journaliser: async () => journal,
    enregistrerExperience: (d) => C.enregistrerExperience(w.magasin, d),
    ajouterInterpretation: (id, d) => C.ajouterInterpretation(w.magasin, id, d),
    idQuestion: sansQuestion ? null : Q.id,
    enregistrerReponseLocale: (d) => C.enregistrerReponseLocale(w.magasin, d),
  });
  return { Q, r };
}
// Réaction (geste Répondre) : la cible voyage telle que la bulle la porte ({ idTrace?, idReponseLocale? }) ; capture réelle de pont.js.
async function reagir(w, cible, texte) {
  const ecran = ecranSur(w.magasin);
  const r = await P.traiterTourAvecEnonce(texte, cible, {
    enregistrerEnonce: (t, x, m, l) => ecran.enregistrerEnonceSurTrace(t, x, m, l), traiter: async (message) => ({ message }),
    nouvelId: C.nouvelId, enregistrerValeur: (entree) => C.enregistrerValeurDonnee(w.magasin, entree),
  });
  return r.message;
}
// Réaction comprise par la forme .20 puis Confirmer (onOui de main.js : la réponse attendue de la question, rien d'autre).
async function corrigerSur(w, cible, reponse) {
  const E2 = await reagir(w, cible, `Non, c'est ${reponse}.`);
  const c = await K.reconnaitreCorrection(w.magasin, { idMessage: E2.id, texte: `Non, c'est ${reponse}.` });
  assert.equal(c.reconnue, true, JSON.stringify(c));
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: c.idQuestion, reponse: c.reponse, idLecon: E2.id });
  return { E: E2, c };
}
const cibleAction = (reco) => ({ idTrace: reco.idTrace, idReponseLocale: reco.idReponseLocale });
const cibleRepondre = (r) => ({ idReponseLocale: r.idReponseLocale });
async function locale(w, id) { return (await w.magasin.lireTout('reponsesLocales')).find((x) => x.id === id); }
async function divergences(w) { return D.divergencesDeReponses(await C.lireLignesDivergences(w.magasin)); }
async function notes(w, appuis) { return D.notesHistoire(D.historiqueDesAppuis(appuis, await divergences(w))); }
async function redemarrer(w) {
  const donnees = {};
  for (const t of C.TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t)));
  const magasin = C.magasinMemoireVive();
  await magasin.remplacerTout(donnees);
  return { magasin, action: w.action };
}
const K_VELO = { sujet: 'moi', relation: 'vélo', valeur: 'Fusée' };
// L'ordre des cas dans une note est un ordre de PRÉSENTATION (moment de la réponse produite ; deux réponses de la même milliseconde : identité) :
// on compare donc la note comme UNE note, au même début, portant exactement les mêmes cas « question → attendu », chacun séparé.
const DEBUT_DEUX = 'Ce que je sais ici (moi → vélo → Fusée) a déjà contribué à des réponses que tu as corrigées : ';
const CAS_DEUX = ['« Qui a pour vélo Fusée ? » → tu attendais Bob', '« mon vélo ? » → tu attendais Éclair'];
function memesNotes(liste) {
  assert.equal(liste.length, 1, JSON.stringify(liste));
  assert.ok(liste[0].startsWith(DEBUT_DEUX) && liste[0].endsWith('.'), liste[0]);
  assert.deepEqual(liste[0].slice(DEBUT_DEUX.length, -1).split(' ; ').sort(), [...CAS_DEUX].sort());
}

// ================================================================================================================ RL0. OBJET, MIGRATION, SAUVEGARDE
test('RL0. table reponsesLocales : déclarée en dernier (clé id), VERSION_BASE 28 ; migration 27 → 28 ne crée QUE cette table ; sauvegarde schéma 18 (17 complété par [], 18 sans la table = incomplet, 19 refusé)', async () => {
  assert.equal(C.TABLES.at(-3), 'reponsesLocales'); assert.equal(C.CLE.reponsesLocales, 'id'); // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution déclarée après reponsesLocales // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(C.VERSION_BASE, 30); assert.equal(S.SCHEMA_SAUVEGARDE, 20); assert.equal(C.TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  const existants = C.TABLES.filter((t) => t !== 'reponsesLocales');
  const donnees = new Map(existants.map((t) => [t, [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null;
  const fabrique = { open(n, v) { version = v; const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) }; const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }; queueMicrotask(() => { r.onupgradeneeded(); r.onsuccess(); }); return r; } };
  await C.ouvrirIndexedDB(fabrique);
  assert.equal(version, 30); // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.deepEqual(crees, [['reponsesLocales', 'id']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
  const w = await monde();
  await demander(w, 'Qui a pour vélo Fusée ?');
  const { creerMemoire } = await import('../app/memoire/memoire.js');
  const { creerMagasinMemoire } = await import('../app/memoire/magasin.js');
  const memoire = creerMemoire(creerMagasinMemoire());
  const TABLES_MEMOIRE = Object.keys(await memoire.exporterDonnees());
  const fichier = await S.construireSauvegardeComplete({ memoire, magasinLangage: w.magasin, idNaissance: 'id', versionAppli: '0.64.22', maintenant: new Date('2026-10-15T12:00:00Z') });
  assert.equal(fichier.objet.schema, 20); // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  const lue = await S.lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  assert.equal(lue.donnees.langage.reponsesLocales.length, 1);
  assert.deepEqual(lue.donnees.langage.reponsesLocales, await w.magasin.lireTout('reponsesLocales'));
  const { empreinte } = await import('../app/memoire/transfert.js');
  const refaire = async (o) => JSON.stringify({ ...o, empreinte: await empreinte(JSON.stringify(o.donnees)) });
  const ancien = JSON.parse(fichier.contenu); ancien.schema = 17; delete ancien.donnees.langage.reponsesLocales;
  const lu1 = await S.lireSauvegardeComplete(await refaire(ancien), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu1.ok, true, lu1.erreur); assert.deepEqual(lu1.donnees.langage.reponsesLocales, [], 'aucune reconstruction : table vide');
  const incomplet = JSON.parse(fichier.contenu); delete incomplet.donnees.langage.reponsesLocales;
  const lu2 = await S.lireSauvegardeComplete(await refaire(incomplet), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu2.ok, false); assert.match(lu2.erreur, /incomplet/);
  const futur = JSON.parse(fichier.contenu); futur.schema = 21; // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  const lu3 = await S.lireSauvegardeComplete(await refaire(futur), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu3.ok, false); assert.match(lu3.erreur, /plus récente/);
});

test('RL1. contrat d\'écriture : provenance FERMÉE, question conservée, trace existante, appuis/obtenu typés, aucun champ étranger ; chaque écriture = une identité neuve, rien n\'est réécrit', async () => {
  const w = await monde();
  const Q = await recevoir(w.magasin, 'mon vélo ?');
  const base = { idQuestion: Q.id, obtenu: ['Fusée'], appuis: [K_VELO], provenance: { voie: 'repondre' }, texteMontre: 'Fusée' };
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, provenance: { voie: 'gemini' } }), /contrat fermé/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, provenance: { voie: 'repondre', idExperience: 'exp' } }), /rien d'autre/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, provenance: { voie: 'action' } }), /idTrace/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, provenance: { voie: 'action', idTrace: 'trace-inventee' } }), /aucune trace/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, provenance: { voie: 'action', idTrace: 't', idExperience: 'e' } }), /étranger/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, idQuestion: 'message-inconnu' }), /aucune question conservée/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, obtenu: 'Fusée' }), /obtenu/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, appuis: [{ sujet: 'moi' }] }), /appuis/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, idExperience: 'exp' }), /étranger/);
  await assert.rejects(() => C.enregistrerReponseLocale(w.magasin, { ...base, referenceMemoire: { idQuestion: 1 } }), /referenceMemoire/);
  const r1 = await C.enregistrerReponseLocale(w.magasin, base);
  const r2 = await C.enregistrerReponseLocale(w.magasin, base);
  assert.notEqual(r1.id, r2.id, 'L : deux réponses textuellement identiques = deux identités');
  assert.deepEqual(Object.keys(r1).sort(), ['appuis', 'horodatage', 'id', 'idQuestion', 'obtenu', 'provenance', 'texteMontre']);
  assert.match(r1.id, /^reponse-locale-/);
  // énoncé : au moins une cible réelle ; idTrace facultatif seulement avec idReponseLocale ; réponse locale inventée refusée
  await assert.rejects(() => C.enregistrerEnonceSurTrace(w.magasin, { texte: 'x' }), /idTrace est requis/);
  await assert.rejects(() => C.enregistrerEnonceSurTrace(w.magasin, { texte: 'x', idReponseLocale: 'reponse-locale-inventee' }), /aucune réponse locale/);
  await assert.rejects(() => C.enregistrerEnonceSurTrace(w.magasin, { texte: 'x', idReponseLocale: '' }), /idReponseLocale/);
  const en = await C.enregistrerEnonceSurTrace(w.magasin, { texte: 'x', idReponseLocale: r1.id });
  assert.equal(Object.hasOwn(en, 'idTrace'), false, 'aucune trace inventée pour repondre');
  const ancien = await C.enregistrerEnonceSurTrace(w.magasin, { idTrace: 'trace-x', texte: 'x' });
  assert.deepEqual(Object.keys(ancien).sort(), ['horodatage', 'id', 'idTrace', 'origine', 'texte'], 'O : forme historique strictement inchangée');
});

// ================================================================================================================ A–C. CRÉATION
test('A. Action admissible → réponse locale (question, obtenu lu à l\'exécution, appuis de la trace, provenance action avec trace et Action réelles) ; la trace reste une trace', async () => {
  const w = await monde();
  const { Q, reco } = await demander(w, 'Qui a pour vélo Fusée ?');
  assert.equal(typeof reco.idReponseLocale, 'string');
  const r = await locale(w, reco.idReponseLocale);
  assert.equal(r.idQuestion, Q.id);
  assert.deepEqual(r.obtenu, ['moi']);
  assert.deepEqual(r.appuis, [K_VELO]);
  assert.deepEqual(r.provenance, { voie: 'action', idTrace: reco.idTrace, idAction: w.action.id });
  assert.equal(r.texteMontre, reco.texte);
  assert.equal(Object.hasOwn(r, 'referenceMemoire'), false);
  const trace = (await w.magasin.lireTout('traces')).find((t) => t.id === reco.idTrace);
  assert.equal(trace.voie, 'action'); assert.equal(Object.hasOwn(trace, 'idReponseLocale'), false, 'la trace n\'est pas modifiée');
  assert.equal((await w.magasin.lireTout('traces')).length, 1);
});

test('B. repondre, fait direct → réponse locale : obtenu [fait.valeur] AVANT rendu, appui réel, provenance repondre, referenceMemoire du journal ; aucune trace créée', async () => {
  const w = await monde();
  const { Q, r } = await repondreLocal(w, 'mon vélo ?');
  assert.equal(r.local, true); assert.equal(r.texte, 'Fusée');
  const l = await locale(w, r.idReponseLocale);
  assert.deepEqual(l, { id: r.idReponseLocale, horodatage: l.horodatage, idQuestion: Q.id, obtenu: ['Fusée'], appuis: [K_VELO], provenance: { voie: 'repondre' }, texteMontre: 'Fusée', referenceMemoire: { idQuestion: 101, idReponse: 102 } });
  assert.deepEqual(await w.magasin.lireTout('traces'), [], 'jamais une trace pour repondre');
  // expérience B1 inchangée : même forme qu'avant, liée par referenceMemoire.idReponse (aucun champ nouveau)
  const [exp] = await w.magasin.lireTout('experiences');
  assert.deepEqual(Object.keys(exp).sort(), ['date', 'id', 'interpretations', 'referenceMemoire', 'referenceTrace', 'source', 'texteRecu', 'texteRepondu']);
  assert.equal(exp.referenceMemoire.idReponse, l.referenceMemoire.idReponse, 'lien honnête réponse locale ↔ expérience, sans fusion');
  assert.equal(r.idExperience, exp.id);
  // sans question identifiée (message non conservé) : aucune réponse locale, réponse inchangée
  const sans = await repondreLocal(w, 'mon vélo ?', { sansQuestion: true });
  assert.equal(sans.r.texte, 'Fusée'); assert.equal(Object.hasOwn(sans.r, 'idReponseLocale'), false);
  // journal inconnu (dépendances neutres) : réponse locale sans referenceMemoire (jamais complétée)
  const neutre = await repondreLocal(w, 'mon kayak ?', { journal: [null, null] });
  assert.equal(Object.hasOwn(await locale(w, neutre.r.idReponseLocale), 'referenceMemoire'), false);
});

test('C. patron dynamique résolu : texteMontre différent de l\'obtenu, obtenu = la valeur du fait', async () => {
  const magasin = C.magasinMemoireVive();
  let e = await E.chargerEsprit(magasin);
  await E.apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'feminin' });
  await E.apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await E.apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta', exemple: 'ta couleur' });
  await E.apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });
  await E.apprendreRelation(e, { mot: 'voiture', relation: 'voiture' });
  await E.apprendrePropriete(e, { mot: 'voiture', propriete: 'genre', valeur: 'feminin' });
  await E.apprendreFait(e, { sujet: 'moi', relation: 'voiture', valeur: 'une Twingo' });
  const w = { magasin };
  const { r } = await repondreLocal(w, 'Quelle est ma voiture ?');
  assert.match(r.texte, /^ta voiture/i);
  const l = await locale(w, r.idReponseLocale);
  assert.deepEqual(l.obtenu, ['une Twingo']);
  assert.notEqual(l.texteMontre, 'une Twingo'); assert.equal(l.texteMontre, r.texte);
  assert.deepEqual(l.appuis, [{ sujet: 'moi', relation: 'voiture', valeur: 'une Twingo' }]);
});

// ================================================================================================================ D–K. FRONTIÈRE FERMÉE
test('D. Action dont la capacité ne déclare pas lecture.reponses (proposition de fait) → trace historique, AUCUNE réponse locale', async () => {
  const w = await monde();
  const ev = evaluerAction({ operation: 'proposerFait', roles: ['relation', 'valeur'], constantes: { sujet: 'moi' }, exemples: ['Mon chien se nomme Rex.', 'Mon chien se nomme Milo.', 'Mon chat se nomme Milo.'] });
  await C.apprendreAction(w.magasin, { operation: 'proposerFait', roles: ev.roles, n: ev.n, exemples: ev.exemples, statut: ev.statut, constantes: ev.constantes, origine: 'apprise-conversation' });
  const { reco } = await demander(w, 'Mon lapin se nomme Pif.');
  assert.equal(reco.ok, true); assert.equal(reco.proposeFait, true);
  assert.equal(typeof reco.idTrace, 'string');
  assert.equal(Object.hasOwn(reco, 'idReponseLocale'), false);
  assert.deepEqual(await w.magasin.lireTout('reponsesLocales'), []);
});

test('E/F. rejeu et composition : aucune réponse locale (composition de repondre réelle ; rejeu et trace de composition : un seul site d\'écriture dans ecran.js)', async () => {
  const magasin = C.magasinMemoireVive();
  const e = await E.chargerEsprit(magasin);
  await E.apprendreRelation(e, { mot: 'zrel1', relation: 'zrel1' });
  await E.apprendreRelation(e, { mot: 'zrel2', relation: 'zrel2' });
  await E.apprendreFait(e, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await E.apprendreFait(e, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  const w = { magasin };
  const { r } = await repondreLocal(w, 'zalpha zrel1 zrel2 ?');
  assert.equal(r.texte, 'zgamma');
  assert.equal(Object.hasOwn(r, 'idReponseLocale'), false);
  assert.deepEqual(await magasin.lireTout('reponsesLocales'), []);
  const ecran = sansCommentaires(lu('app', 'langage', 'ecran.js'));
  assert.equal((ecran.match(/enregistrerReponseLocale\(/g) || []).length, 1, 'un seul site d\'écriture');
  const action = ecran.slice(ecran.indexOf('async function tenterReconnaissanceAction('), ecran.indexOf('async function tenterRejeuAutonome('));
  assert.match(action, /enregistrerReponseLocale\(e\.magasin, \{/, 'ce site est dans la voie Action, jamais dans le rejeu ni la composition');
});

test('G/H/I. viaType, conflit de faits, ignorance : aucune réponse locale ; la frontière ne lit jamais le texte', async () => {
  // G : signification apprise (vocabulaire fictif de type-vers-comportement)
  const LEX = { ...LEXIQUE_DEPART, bouloir: { role: ROLES.RELATION, relation: 'bouloir' } };
  const m = C.magasinMemoireVive();
  const esprit = await E.chargerEsprit(m);
  const h = induire(['Ziqualo, mon bouloir est vert.', 'Ziqualo, ma teinte est jaune.'], ['Mon bouloir est vert.', 'Ma teinte est jaune.'], { lexique: LEX }).hypotheses[0];
  await E.apprendreGabaritType(esprit, { candidats: h.candidats, gabarits: h.gabarits, signification: 'TYPE_X', exemples: h.couverture });
  await E.apprendreFait(esprit, { sujet: 'TYPE_X', relation: E.RELATION_COMPORTEMENT, valeur: 'Wouiiip' });
  const viaType = E.repondre(esprit, 'Ziqualo, mon zestion est grand.');
  assert.equal(viaType.viaType, true); assert.ok(viaType.fait);
  assert.equal(P.reponseLocaleAdmissible(viaType), null);
  // H : deux valeurs persistées pour la même identité
  const w = await monde();
  await w.magasin.ecrire('faits', { cle: 'moi|velo2-a', sujet: 'moi', relation: 'trottinette', valeur: 'Alpha' });
  await w.magasin.ecrire('faits', { cle: 'moi|velo2-b', sujet: 'moi', relation: 'trottinette', valeur: 'Beta' });
  const eC = await E.chargerEsprit(w.magasin);
  const brut = E.repondre(eC, 'ma trottinette ?');
  assert.equal(brut.conflitFait, true, JSON.stringify(brut.texte));
  assert.equal(P.reponseLocaleAdmissible(brut), null);
  const conflit = await repondreLocal(w, 'ma trottinette ?');
  assert.equal(conflit.r.texte, E.PHRASE_CONFLIT_FAIT); assert.equal(Object.hasOwn(conflit.r, 'idReponseLocale'), false);
  // I : ignorance (relation connue, aucun fait pour ce sujet)
  const ign = E.repondre(eC, 'mon surnom ?');
  assert.equal(ign.etat, E.COMPRIS); assert.equal(ign.fait, null);
  assert.equal(P.reponseLocaleAdmissible(ign), null);
  const ignorance = await repondreLocal(w, 'mon surnom ?');
  assert.equal(Object.hasOwn(ignorance.r, 'idReponseLocale'), false);
  // autres exclusions, structurelles
  for (const exclu of [{ conflitPatron: true }, { conflit: true }, { regleManquante: true }, { compose: true }, { viaType: true }]) {
    assert.equal(P.reponseLocaleAdmissible({ etat: E.COMPRIS, fait: { ...K_VELO }, ...exclu }), null, JSON.stringify(exclu));
  }
  assert.deepEqual(P.reponseLocaleAdmissible({ etat: E.COMPRIS, fait: { ...K_VELO }, texte: 'texte sans rapport' }), { obtenu: ['Fusée'], appuis: [K_VELO] }, 'l\'obtenu vient du fait, jamais du texte');
  assert.deepEqual(await w.magasin.lireTout('reponsesLocales'), []);
});

test('J/K. PARTIEL / INCOMPRIS / Gemini ; propositions, confirmations, O6, notes : aucune réponse locale (pont et main.js)', async () => {
  const w = await monde();
  const partiel = await repondreLocal(w, 'mon bateau ?');
  assert.ok(partiel.r === null || partiel.r.tentative, 'PARTIEL/INCOMPRIS : une tentative, jamais une réponse locale');
  assert.equal(partiel.r && partiel.r.idReponseLocale, undefined);
  const pont = sansCommentaires(lu('app', 'langage', 'pont.js'));
  const echouee = pont.slice(pont.indexOf('export async function enregistrerExperienceTentativeEchouee('), pont.indexOf('export function referenceTraceCapturable('));
  assert.doesNotMatch(echouee, /ReponseLocale/, 'J : la réponse externe (repli) ne devient jamais une réponse locale');
  assert.equal((pont.match(/enregistrerReponseLocale\(\{/g) || []).length, 1, 'un seul site, dans la branche COMPRIS');
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.equal((main.match(/enregistrerReponseLocale\(/g) || []).length, 1, 'main.js ne fait que transmettre l\'écriture au pont');
  const corps = main.slice(main.indexOf('async function traiterTour('), main.indexOf('const conversation = monterConversation('));
  const iO6 = corps.indexOf("return { texte: 'Je garde ta réaction à ma réponse, mais je ne sais pas encore ce qu\\'elle signifie.', local: true };");
  assert.ok(iO6 > 0, 'K : le message O6 ne porte aucune identité de réponse');
  for (const f of ['function proposerLecon(', 'function proposerReponseCorrigee(', 'function proposerReponseAttendue(', 'async function notesDesAppuis(']) {
    const i = main.indexOf(f);
    assert.ok(i > 0, f);
    assert.doesNotMatch(main.slice(i, main.indexOf('\n}\n', i)), /idReponseLocale|ReponseLocale/, `K : ${f} ne crée ni ne porte de réponse locale`);
  }
});

test('L. deux réponses textuellement identiques → deux identités ; une réaction se rattache à CELLE de sa bulle, jamais par le texte', async () => {
  const w = await monde();
  const a = await repondreLocal(w, 'mon vélo ?');
  const b = await repondreLocal(w, 'mon vélo ?');
  assert.notEqual(a.r.idReponseLocale, b.r.idReponseLocale);
  assert.equal((await locale(w, a.r.idReponseLocale)).texteMontre, (await locale(w, b.r.idReponseLocale)).texteMontre);
  const { c } = await corrigerSur(w, cibleRepondre(a.r), 'Éclair');
  assert.equal(c.idQuestion, a.Q.id, 'la question de LA réponse visée (la première), pas la dernière');
  const [d] = await divergences(w);
  assert.equal(d.idReponseLocale, a.r.idReponseLocale);
});

// ================================================================================================================ M–O. RÉFÉRENCES ET ÉNONCÉS
test('M/N/O. énoncés : Action .22 → idReponseLocale + idTrace ; repondre → idReponseLocale seul ; ancien geste trace-only → forme historique, toujours compris', async () => {
  const w = await monde();
  const { reco } = await demander(w, 'Qui a pour vélo Fusée ?');
  const M = await reagir(w, cibleAction(reco), 'merci');
  const { r } = await repondreLocal(w, 'mon vélo ?');
  const N = await reagir(w, cibleRepondre(r), 'merci');
  const enonces = await w.magasin.lireTout('enonces');
  const eM = enonces.find((x) => x.idMessage === M.id); const eN = enonces.find((x) => x.idMessage === N.id);
  assert.equal(eM.idTrace, reco.idTrace); assert.equal(eM.idReponseLocale, reco.idReponseLocale);
  assert.equal(eN.idReponseLocale, r.idReponseLocale); assert.equal(Object.hasOwn(eN, 'idTrace'), false);
  // O : réaction historique par la trace seule (comme avant .22) → situation historique, correction comprise
  const ancien = await demander(w, 'Qui a pour kayak Torpille ?');
  const O = await reagir(w, { idTrace: ancien.reco.idTrace }, "Non, c'est Max.");
  const eO = (await w.magasin.lireTout('enonces')).find((x) => x.idMessage === O.id);
  assert.deepEqual(Object.keys(eO).sort(), ['horodatage', 'id', 'idMessage', 'idTrace', 'origine', 'texte']);
  const lignes = await C.lireLignesCorrections(w.magasin);
  assert.deepEqual(K.situationsDeReaction(lignes.enonces, lignes.traces, lignes.reponsesLocales).get(O.id), { idTrace: ancien.reco.idTrace, idQuestion: ancien.Q.id });
  assert.equal((await K.reconnaitreCorrection(w.magasin, { idMessage: O.id, texte: "Non, c'est Max." })).reponse, 'Max');
  // capture : cible inexistante → échec rendu, jamais une identité inventée
  const ecran = ecranSur(w.magasin);
  const capture = await P.capturerEnonceAvantTraitement('x', { idReponseLocale: 'reponse-locale-inventee' }, { enregistrerEnonce: (t, x, m, l) => ecran.enregistrerEnonceSurTrace(t, x, m, l) });
  assert.equal(capture.etat, 'echec');
  assert.deepEqual(await P.capturerEnonceAvantTraitement('x', null, {}), { etat: 'aucune' });
});

// ================================================================================================================ P–U. CONSÉQUENCES
test('P/Q/R/S. correction .20 et divergence .21 : repondre comprise directement ; Action .22 → UNE réponse attendue, UNE divergence (jamais deux chemins)', async () => {
  const w = await monde();
  // P : « mon vélo ? » → Fusée ; Répondre « Non, c'est Éclair. » → comprise sans « Apprends »
  const rep = await repondreLocal(w, 'mon vélo ?');
  const { c } = await corrigerSur(w, cibleRepondre(rep.r), 'Éclair');
  assert.deepEqual({ ...c, idForme: undefined }, { reconnue: true, idQuestion: rep.Q.id, question: 'mon vélo ?', reponse: 'Éclair', idForme: undefined });
  // Q : réaction à une réponse Action .22 (cible double) → une seule situation, une seule réponse attendue
  const act = await demander(w, 'Qui a pour vélo Fusée ?');
  const { E: E2 } = await corrigerSur(w, cibleAction(act.reco), 'Bob');
  const lignes = await C.lireLignesCorrections(w.magasin);
  const sit = K.situationsDeReaction(lignes.enonces, lignes.traces, lignes.reponsesLocales);
  assert.deepEqual(sit.get(E2.id), { idReponseLocale: act.reco.idReponseLocale, idQuestion: act.Q.id, idTrace: act.reco.idTrace });
  assert.equal((await w.magasin.lireTout('reponsesAttendues')).filter((x) => x.idMessage === act.Q.id).length, 1);
  // R/S : exactement deux divergences, chacune par sa réponse locale
  const ds = await divergences(w);
  assert.equal(ds.length, 2);
  const dA = ds.find((d) => d.attendu === 'Bob'); const dR = ds.find((d) => d.attendu === 'Éclair');
  assert.deepEqual(dA, { idReponseAttendue: act.Q.id, idReponseLocale: act.reco.idReponseLocale, idQuestion: act.Q.id, question: 'Qui a pour vélo Fusée ?', provenance: { voie: 'action', idTrace: act.reco.idTrace, idAction: w.action.id }, idTrace: act.reco.idTrace, idAction: w.action.id, obtenu: ['moi'], attendu: 'Bob', appuis: [K_VELO] });
  assert.deepEqual(dR, { idReponseAttendue: rep.Q.id, idReponseLocale: rep.r.idReponseLocale, idQuestion: rep.Q.id, question: 'mon vélo ?', provenance: { voie: 'repondre' }, obtenu: ['Fusée'], attendu: 'Éclair', appuis: [K_VELO] });
  // exclusivité : même si la réponse locale disparaissait, le chemin trace n'est jamais tenté pour cet énoncé
  const sansLocales = { ...(await C.lireLignesDivergences(w.magasin)), reponsesLocales: [] };
  assert.deepEqual(D.divergencesDeReponses(sansLocales), [], 'aucun repli sur la trace : jamais de double conséquence');
  // concordance : attendu égal à l'obtenu → aucune divergence
  const rep2 = await repondreLocal(w, 'mon kayak ?');
  await corrigerSur(w, cibleRepondre(rep2.r), 'Torpille');
  assert.equal((await divergences(w)).length, 2);
});

test('T/U/AG/AH. historique .21 toujours visible ; deux conséquences du même appui gardent chacune question → attendu ; Bob et Éclair jamais fusionnés ; l\'ordre ne choisit rien', async () => {
  const w = await monde();
  // T : la divergence .21 (réaction trace-only, comme sur le téléphone)
  const ancien = await demander(w, 'Qui a pour vélo Fusée ?');
  await corrigerSur(w, { idTrace: ancien.reco.idTrace }, 'Bob');
  const rep = await repondreLocal(w, 'mon vélo ?');
  assert.deepEqual(await notes(w, [K_VELO]), ["Ce que je sais ici (moi → vélo → Fusée) a déjà contribué à une réponse que tu as corrigée : « Qui a pour vélo Fusée ? » → tu attendais Bob."]);
  // U : correction de la réponse repondre
  await corrigerSur(w, cibleRepondre(rep.r), 'Éclair');
  const ds = await divergences(w);
  assert.equal(ds.length, 2);
  const historique = ds.find((d) => d.attendu === 'Bob');
  assert.equal(Object.hasOwn(historique, 'idReponseLocale'), false, 'T : lue par la trace, forme .21');
  assert.equal(historique.idTrace, ancien.reco.idTrace);
  memesNotes(await notes(w, [K_VELO]));
  // AG : deux conséquences distinctes, aucune valeur attendue fusionnée ni remplacée
  assert.deepEqual(ds.map((d) => [d.question, d.attendu]).sort(), [['Qui a pour vélo Fusée ?', 'Bob'], ['mon vélo ?', 'Éclair']]);
  assert.deepEqual(ds.map((d) => d.obtenu).sort(), [['Fusée'], ['moi']]);
  // AH : lignes dans un autre ordre → mêmes divergences, mêmes notes
  const lignes = await C.lireLignesDivergences(w.magasin);
  const inverse = Object.fromEntries(Object.entries(lignes).map(([k, v]) => [k, [...v].reverse()]));
  assert.deepEqual(D.divergencesDeReponses(inverse), ds);
  assert.deepEqual(D.notesHistoire(D.historiqueDesAppuis([K_VELO], D.divergencesDeReponses(inverse))), await notes(w, [K_VELO]), 'même note, même ordre de présentation');
});

test('V. un fait modifié après coup ne réécrit pas les appuis historiques ; le nouveau fait n\'hérite d\'aucune histoire', async () => {
  const w = await monde();
  const rep = await repondreLocal(w, 'mon vélo ?');
  await corrigerSur(w, cibleRepondre(rep.r), 'Éclair');
  const e = await E.chargerEsprit(w.magasin);
  await E.oublierFait(e, { sujet: 'moi', relation: 'vélo' });
  await E.apprendreFait(e, { sujet: 'moi', relation: 'vélo', valeur: 'Comète', origine: 'apprise-conversation' });
  assert.deepEqual((await locale(w, rep.r.idReponseLocale)).appuis, [K_VELO]);
  assert.deepEqual((await divergences(w))[0].appuis, [K_VELO]);
  assert.deepEqual(await notes(w, [{ sujet: 'moi', relation: 'vélo', valeur: 'Comète' }]), []);
});

// ================================================================================================================ W–Y. EXPÉRIENCE ET JUGEMENT
test('W/X/Y. correct/incorrect inchangé ; une réaction libre ne crée aucun jugement ; un jugement ne crée aucune réponse attendue ; aucune fusion', async () => {
  const w = await monde();
  const rep = await repondreLocal(w, 'mon vélo ?');
  const exp = (await w.magasin.lireTout('experiences')).find((x) => x.id === rep.r.idExperience);
  // X : réaction libre comprise et confirmée → aucun jugement binaire sur l'expérience
  await corrigerSur(w, cibleRepondre(rep.r), 'Éclair');
  const apres = (await w.magasin.lireTout('experiences')).find((x) => x.id === exp.id);
  assert.equal(apres.interpretations.some((i) => i.origine === 'jugement-christophe'), false);
  // W/Y : jugement binaire sur une AUTRE réponse → comme avant ; aucune réponse attendue, aucun énoncé, aucune réponse locale modifiée
  const rep2 = await repondreLocal(w, 'mon kayak ?');
  const avant = { attendues: await w.magasin.lireTout('reponsesAttendues'), enonces: await w.magasin.lireTout('enonces'), locales: await w.magasin.lireTout('reponsesLocales') };
  const e = await E.chargerEsprit(w.magasin);
  await C.confronterJugementEtEnregistrer(w.magasin, rep2.r.idExperience, 'incorrect', e.lexique);
  const juge = (await w.magasin.lireTout('experiences')).find((x) => x.id === rep2.r.idExperience);
  assert.equal(juge.interpretations.filter((i) => i.origine === 'jugement-christophe').length, 1);
  assert.equal(juge.interpretations.find((i) => i.origine === 'jugement-christophe').donnees.jugement, 'incorrect');
  assert.deepEqual({ attendues: await w.magasin.lireTout('reponsesAttendues'), enonces: await w.magasin.lireTout('enonces'), locales: await w.magasin.lireTout('reponsesLocales') }, avant);
  assert.equal(Object.hasOwn(juge, 'idReponseLocale'), false, 'aucun champ nouveau dans l\'expérience');
});

// ================================================================================================================ Z–AC. O6, REPLI, UI, AUCUNE ÉGALITÉ DE TEXTE
test('Z/AA/AB. main.js : O6 pour toute cible réelle (réponse locale ou trace historique), critère structurel, avant le modèle externe ; sans cible : chemin externe inchangé', () => {
  const main = sansCommentaires(lu('app', 'main.js'));
  const corps = main.slice(main.indexOf('async function traiterTour('), main.indexOf('const conversation = monterConversation('));
  const iO6 = corps.indexOf("if (referenceCible && ((typeof referenceCible.idTrace === 'string' && referenceCible.idTrace.length > 0) || (typeof referenceCible.idReponseLocale === 'string' && referenceCible.idReponseLocale.length > 0))) {");
  const iPont = corps.indexOf('const local = await tenterPontLangage(texte, {');
  const iGemini = corps.indexOf('const reponse = await esprit.repondre(texte, options);');
  assert.ok(iPont > 0 && iPont < iO6 && iO6 < iGemini, 'Z/AA : O6 après toutes les voies locales, juste avant le modèle externe');
  assert.doesNotMatch(corps.slice(iO6, iGemini), /texte\.(includes|match|test|startsWith)|merci/i, 'aucune analyse du contenu');
  // cible : réunit trace (référence d'invocation inchangée) et réponse locale ; transmise à la capture et au tour
  const wrapper = main.slice(main.indexOf('repondre: async (texte, options) => {'), main.indexOf('await traiterTourAvecEnonce('));
  assert.match(wrapper, /const referenceTrace = \(options && options\.referenceTrace\) \|\| null;/);
  assert.match(wrapper, /options\.referenceReponseLocale\.idReponseLocale/);
  // AB : la référence d'invocation transmise au pont (observation, expérience) reste la trace seule
  assert.match(corps, /\.\.\.experienceDeps,\n\s+referenceTrace,\n/);
  assert.match(corps, /enregistrerExperienceTentativeEchouee\(texte, local\.tentative, reponse, \{ \.\.\.experienceDeps, referenceTrace \}\)/);
  // sans cible, l'enveloppe ne change rien
  const r = { texte: 'x' };
  assert.equal(P.appliquerAbstentionSiReferenceIgnoree(r, null, 'aucune'), r);
});

test('AC. aucune égalité de texte pour joindre ou rattacher : texteMontre n\'est lu par aucun module ; la frontière, les situations et les divergences n\'utilisent que des identités', () => {
  for (const f of ['corrections-apprises.js', 'divergences.js', 'reponses-attendues.js', 'explication-supervisee.js']) {
    assert.doesNotMatch(sansCommentaires(lu('app', 'langage', f)), /texteMontre/, f);
  }
  const ecran = sansCommentaires(lu('app', 'langage', 'ecran.js'));
  assert.equal((ecran.match(/texteMontre/g) || []).length, 1, 'écrit une fois (création), jamais lu');
  const pont = sansCommentaires(lu('app', 'langage', 'pont.js'));
  assert.equal((pont.match(/texteMontre/g) || []).length, 1, 'écrit une fois (création), jamais lu');
  const admissible = pont.slice(pont.indexOf('export function reponseLocaleAdmissible('), pont.indexOf('function appuisDeReponseLocale('));
  assert.doesNotMatch(admissible, /texte/, 'la frontière ne lit pas le texte rendu');
  assert.doesNotMatch(sansCommentaires(lu('app', 'main.js')), /texteMontre/);
});

test('UI. une bulle portant une réponse locale offre Répondre (cible : réponse locale, et trace seulement si la bulle en porte une) ; transport structuré ; brouillon additif', () => {
  const ui = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  assert.match(ui, /if \(options\.idTrace \|\| options\.idReponseLocale\) \{/);
  assert.match(ui, /const cibleBulle = \{ \.\.\.\(options\.idTrace \? \{ idTrace: options\.idTrace \} : \{\}\), \.\.\.\(options\.idReponseLocale \? \{ idReponseLocale: options\.idReponseLocale \} : \{\}\) \};/);
  assert.match(ui, /referenceReponseLocale: reprise \|\| !referenceActuelle \|\| !referenceActuelle\.idReponseLocale \? null : \{ idReponseLocale: referenceActuelle\.idReponseLocale \},/);
  assert.match(ui, /idReponseLocale: resultat && resultat\.idReponseLocale,/);
  // correct/incorrect et Marquer : inchangés (mêmes conditions qu'avant)
  assert.match(ui, /if \(options\.idExperience && surJugement\) \{/);
  assert.match(ui, /if \(options\.idTrace && surActe\) \{/);
  // brouillon : la réponse locale survit comme la trace ; sans référence, forme { texte, date } inchangée
  const stock = new Map(); const stockage = { getItem: (k) => stock.get(k) ?? null, setItem: (k, v) => stock.set(k, v), removeItem: (k) => stock.delete(k) };
  B.garderBrouillon('Non', 'd', stockage, { idReponseLocale: 'reponse-locale-1' });
  assert.deepEqual(B.lireBrouillon(stockage), { texte: 'Non', date: 'd', referenceReponseLocale: { idReponseLocale: 'reponse-locale-1' } });
  B.garderBrouillon('Non', 'd', stockage, { idTrace: 't', idReponseLocale: 'reponse-locale-1' });
  assert.deepEqual(B.lireBrouillon(stockage), { texte: 'Non', date: 'd', referenceTrace: { idTrace: 't' }, referenceReponseLocale: { idReponseLocale: 'reponse-locale-1' } });
  B.garderBrouillon('Non', 'd', stockage);
  assert.deepEqual(B.lireBrouillon(stockage), { texte: 'Non', date: 'd' });
});

// ================================================================================================================ AD–AF. PERSISTANCE, AUCUNE RÉVISION
test('AD/AE/AF. décisif rejoué : histoires après redémarrage ; aucun fait révisé ; aucune Action modifiée', async () => {
  let w = await monde();
  const faitsAvant = JSON.stringify(await w.magasin.lireTout('faits'));
  const actionsAvant = JSON.stringify(await w.magasin.lireTout('actions'));
  const ancien = await demander(w, 'Qui a pour vélo Fusée ?');
  await corrigerSur(w, { idTrace: ancien.reco.idTrace }, 'Bob'); // historique .21
  const rep = await repondreLocal(w, 'mon vélo ?');
  assert.equal(rep.r.texte, 'Fusée');
  await corrigerSur(w, cibleRepondre(rep.r), 'Éclair');
  const encore = await demander(w, 'Qui a pour vélo Fusée ?');
  assert.equal(encore.reco.texte, ancien.reco.texte, 'réponse normale inchangée');
  memesNotes(await notes(w, encore.reco.appuis));
  w = await redemarrer(w);
  const apres = await repondreLocal(w, 'mon vélo ?');
  assert.equal(apres.r.texte, 'Fusée', 'AE : Fusée reste la réponse');
  memesNotes(await notes(w, apres.r.appuis)); // AD : les deux histoires survivent
  assert.deepEqual(await notes(w, [{ sujet: 'moi', relation: 'kayak', valeur: 'Torpille' }]), []);
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), faitsAvant, 'AE : aucun fait modifié');
  assert.equal(JSON.stringify(await w.magasin.lireTout('actions')), actionsAvant, 'AF : aucune Action modifiée');
});
