// v0.64.23 — « LOCALISER UNE DIVERGENCE DANS LA CONNAISSANCE QUI L'A PRODUITE » (GO ChatGPT « v0.64.23 », 15/10/2026). NIVEAU 1.
// Vue pure divergences-localisees.js : projection DÉCLARÉE (registre.js lecture.projection ; pont.js PROJECTION_REPONDRE_FAIT), VÉRIFIÉE sur
// les données persistées, portée sur l'identité tirée du seul invariant cleFait. Chaînes rejouées avec les vraies primitives. Lettres A–Z du GO.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const P = await import('../app/langage/pont.js');
const E = await import('../app/langage/esprit.js');
const K = await import('../app/langage/corrections-apprises.js');
const D = await import('../app/langage/divergences.js');
const L = await import('../app/langage/divergences-localisees.js');
const { CAPACITES } = await import('../app/langage/registre.js');
const { identiteRegle } = await import('../app/langage/regle-forme.js');
const { monterEcranLangage } = await import('../app/langage/ecran.js');

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

const lignes = (w) => C.lireLignesDivergences(w.magasin);
async function localisees(w) { const l = await lignes(w); return L.localiserDivergences({ divergences: D.divergencesDeReponses(l), traces: l.traces }); }
const instantane = async (w) => { const o = {}; for (const t of C.TABLES) o[t] = JSON.stringify(await w.magasin.lireTout(t)); return o; };
// Les deux histoires du téléphone : Bob par la trace seule (.21), Éclair par la réponse locale repondre (.22).
async function deuxHistoires() {
  const w = await monde();
  const A = await demander(w, 'Qui a pour vélo Fusée ?');
  await corrigerSur(w, { idTrace: A.reco.idTrace }, 'Bob');
  const B = await repondreLocal(w, 'mon vélo ?');
  await corrigerSur(w, cibleRepondre(B.r), 'Éclair');
  return { w, A, B };
}
const NOTE_BOB = 'Dans ma réponse à « Qui a pour vélo Fusée ? », moi → vélo → Fusée a fourni son sujet (moi) ; tu attendais Bob. La conséquence pour cette connaissance reste indéterminée.';
const NOTE_ECLAIR = 'Dans ma réponse à « mon vélo ? », moi → vélo → Fusée a fourni sa valeur (Fusée) ; tu attendais Éclair. Ces deux valeurs ne peuvent pas coexister sous la même identité de connaissance.';

// ================================================================================================================ A/B/C/U. LES DEUX HISTOIRES RÉELLES
test('A/B/C/U. Bob (trace .21 seule) : sujet délivré, indéterminée ; Éclair (réponse locale .22) : valeur délivrée, incompatible sous l\'identité ; aucun backfill', async () => {
  const { w, A, B } = await deuxHistoires();
  const avant = await instantane(w);
  const ls = await localisees(w);
  assert.equal(ls.length, 2);
  const bob = ls.find((x) => x.attendu === 'Bob'); const eclair = ls.find((x) => x.attendu === 'Éclair');
  assert.deepEqual(bob, {
    idReponseAttendue: A.Q.id, idQuestion: A.Q.id, question: 'Qui a pour vélo Fusée ?', idTrace: A.reco.idTrace, voie: 'action', appui: K_VELO,
    projection: { contraintes: [{ champ: 'relation', valeur: 'vélo', role: 'relation' }, { champ: 'valeur', valeur: 'Fusée', role: 'valeur' }], delivre: 'sujet' },
    valeurDelivree: 'moi', delivreEgaleAttendu: false, obtenu: ['moi'], attendu: 'Bob', porteeSurIdentite: 'indeterminee',
  });
  assert.deepEqual(eclair, {
    idReponseAttendue: B.Q.id, idQuestion: B.Q.id, question: 'mon vélo ?', idReponseLocale: B.r.idReponseLocale, voie: 'repondre', appui: K_VELO,
    projection: { contraintes: [{ champ: 'sujet', valeur: 'moi' }, { champ: 'relation', valeur: 'vélo' }], delivre: 'valeur' },
    valeurDelivree: 'Fusée', delivreEgaleAttendu: false, obtenu: ['Fusée'], attendu: 'Éclair', porteeSurIdentite: 'incompatible-sous-identite',
  });
  assert.deepEqual(L.notesLocalisation([K_VELO], ls).sort(), [NOTE_BOB, NOTE_ECLAIR].sort());
  // C/D : rien n'est écrit, aucune trace réécrite, aucune ligne ajoutée
  assert.deepEqual(await instantane(w), avant);
  assert.equal(Object.hasOwn((await w.magasin.lireTout('traces')).find((t) => t.id === A.reco.idTrace), 'projection'), false);
});

test('D/E/X/Y. la vue n\'écrit rien ; K reste moi → vélo → Fusée ; aucun fait candidat, aucune proposition, aucun apprentissage (source)', async () => {
  const { w } = await deuxHistoires();
  const faits = JSON.stringify(await w.magasin.lireTout('faits'));
  await localisees(w); await localisees(w);
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), faits);
  const e = await E.chargerEsprit(w.magasin);
  assert.equal(E.repondre(e, 'mon vélo ?').texte, 'Fusée');
  const vue = sansCommentaires(lu('app', 'langage', 'divergences-localisees.js'));
  assert.doesNotMatch(vue, /lireTout|ecrire|enregistrer|apprendre|oublier|proposer|magasin|Date|Math\.random/, 'pure : aucune écriture, aucun magasin, aucune horloge');
  assert.doesNotMatch(vue, /erreur|faux|fausse|vrai|confiance|probab|score|poids|compte|majorit|frequence|fréquence/i, 'W : vocabulaire neutre, aucun score');
  assert.match(vue, /^import \{ CAPACITES \} from '\.\/registre\.js';$/m);
  const main = sansCommentaires(lu('app', 'main.js'));
  const def = main.slice(main.indexOf('async function notesDesAppuis('), main.indexOf('async function propositionDeCorrection('));
  assert.match(def, /\.\.\.notesLocalisation\(appuis, localiserDivergences\(\{ divergences, traces: lignes\.traces \}\)\)/);
  assert.doesNotMatch(def, /ecrire|enregistrer|apprendre|oublier|proposerLecon/, 'les notes n\'écrivent rien et ne proposent rien');
  assert.equal((main.match(/localiserDivergences\(/g) || []).length, 1, 'un seul usage : la note');
});

// ================================================================================================================ F/G/H/I. DÉCLARATION ET VÉRIFICATION
test('F/G/H. déclaration absente ou malformée → abstention ; données qui démentent la déclaration → abstention ; noms identiques sans correspondance déclarée → abstention', async () => {
  const { w } = await deuxHistoires();
  const l = await lignes(w);
  const ds = D.divergencesDeReponses(l);
  const sansProjection = { ...CAPACITES, recherche: { ...CAPACITES.recherche, lecture: { ...CAPACITES.recherche.lecture, projection: undefined } } };
  assert.deepEqual(L.localiserDivergences({ divergences: ds, traces: l.traces }, sansProjection).map((x) => x.attendu), ['Éclair'], 'F : Bob non localisé');
  for (const fausse of [{ contraintes: [], delivre: 'sujet' }, { contraintes: [{ role: 'relation', champ: 'relation' }], delivre: 'relation' }, { contraintes: [{ role: 'relation', champ: 'genre' }, { role: 'valeur', champ: 'valeur' }], delivre: 'sujet' }, { contraintes: [{ champ: 'relation' }, { champ: 'valeur' }], delivre: 'sujet' }]) {
    const cap = { ...CAPACITES, recherche: { ...CAPACITES.recherche, lecture: { ...CAPACITES.recherche.lecture, projection: fausse } } };
    assert.deepEqual(L.localiserDivergences({ divergences: ds, traces: l.traces }, cap).filter((x) => x.attendu === 'Bob'), [], JSON.stringify(fausse));
  }
  // G : déclaration croisée (rôle relation → champ valeur) : démentie par la trace → abstention, jamais une correction silencieuse
  const croisee = { ...CAPACITES, recherche: { ...CAPACITES.recherche, lecture: { ...CAPACITES.recherche.lecture, projection: { contraintes: [{ role: 'relation', champ: 'valeur' }, { role: 'valeur', champ: 'relation' }], delivre: 'sujet' } } } };
  assert.deepEqual(L.localiserDivergences({ divergences: ds, traces: l.traces }, croisee).filter((x) => x.attendu === 'Bob'), []);
  // G : trace historique dont les arguments ne correspondent plus aux appuis, ou obtenu différent des champs délivrés → abstention
  const bob = ds.find((d) => d.attendu === 'Bob');
  const traces = l.traces.map((t) => (t.id === bob.idTrace ? { ...t, argumentsUtilises: { relation: 'kayak', valeur: 'Fusée' } } : t));
  assert.deepEqual(L.localiserDivergences({ divergences: [bob], traces }), []);
  assert.deepEqual(L.localiserDivergences({ divergences: [{ ...bob, obtenu: ['Hugo'] }], traces: l.traces }), []);
  const role3 = l.traces.map((t) => (t.id === bob.idTrace ? { ...t, argumentsUtilises: { ...t.argumentsUtilises, autre: 'x' } } : t));
  assert.deepEqual(L.localiserDivergences({ divergences: [bob], traces: role3 }), [], 'les rôles déclarés doivent être exactement les arguments utilisés');
  // H : capacité aux rôles x / y (noms ≠ champs) : seule la correspondance DÉCLARÉE compte
  const capXY = { recherche: { roles: ['x', 'y'], lecture: { projection: { contraintes: [{ role: 'x', champ: 'relation' }, { role: 'y', champ: 'valeur' }], delivre: 'sujet' } } } };
  const traceXY = l.traces.map((t) => (t.id === bob.idTrace ? { ...t, argumentsUtilises: { x: 'vélo', y: 'Fusée' } } : t));
  const [xy] = L.localiserDivergences({ divergences: [bob], traces: traceXY }, capXY);
  assert.deepEqual(xy.projection.contraintes, [{ champ: 'relation', valeur: 'vélo', role: 'x' }, { champ: 'valeur', valeur: 'Fusée', role: 'y' }]);
  // déclaration de la voie repondre retirée → Éclair non localisé
  assert.deepEqual(L.localiserDivergences({ divergences: ds, traces: l.traces }, CAPACITES, null).map((x) => x.attendu), ['Bob']);
  // registre : seule recherche déclare une projection ; repondre déclare la sienne dans pont.js et c'est elle qui fixe l'obtenu
  for (const nom of Object.keys(CAPACITES)) assert.equal(Boolean(CAPACITES[nom].lecture && CAPACITES[nom].lecture.projection), nom === 'recherche', nom);
  assert.ok(Object.isFrozen(CAPACITES.recherche.lecture.projection));
  assert.deepEqual(P.PROJECTION_REPONDRE_FAIT, { contraintes: [{ champ: 'sujet' }, { champ: 'relation' }], delivre: 'valeur' });
  assert.match(sansCommentaires(lu('app', 'langage', 'pont.js')), /return \{ obtenu: \[appuis\[0\]\[PROJECTION_REPONDRE_FAIT\.delivre\]\], appuis \};/);
});

test('H (déclaration ↔ mécanisme). la projection de recherche décrit exactement invoquer / appuis sur un esprit réel ; sinon la déclaration serait démentie', async () => {
  const w = await monde([['moi', 'chien', 'Rex'], ['Hugo', 'chien', 'Rex'], ['Léa', 'chat', 'Rex']]);
  const e = await E.chargerEsprit(w.magasin);
  const args = { relation: 'CHIEN', valeur: 'rex' };
  const { projection } = CAPACITES.recherche.lecture;
  const appuis = CAPACITES.recherche.lecture.appuis(e, args);
  const obtenu = CAPACITES.recherche.lecture.reponses(CAPACITES.recherche.invoquer(e, args));
  assert.deepEqual(appuis.map((a) => a[projection.delivre]), obtenu);
  for (const a of appuis) for (const c of projection.contraintes) assert.equal(a[c.champ].toLowerCase(), args[c.role].toLowerCase());
});

test('I. une même valeur dans plusieurs champs du fait : aucune ambiguïté, la projection déclarée tranche (jamais la comparaison de valeurs)', async () => {
  const w = await monde([['Fusée', 'vélo', 'Fusée']]);
  const A = await demander(w, 'Qui a pour vélo Fusée ?');
  assert.deepEqual((await locale(w, A.reco.idReponseLocale)).obtenu, ['Fusée']);
  await corrigerSur(w, cibleAction(A.reco), 'Bob');
  const [x] = await localisees(w);
  assert.equal(x.projection.delivre, 'sujet'); assert.equal(x.valeurDelivree, 'Fusée');
  assert.deepEqual(x.projection.contraintes.map((c) => c.champ), ['relation', 'valeur']);
  assert.equal(x.porteeSurIdentite, 'indeterminee');
});

// ================================================================================================================ J/K/L. PLUSIEURS APPUIS / OBTENUS
test('J/K/L. [moi, Hugo] attendu Hugo : une entrée PAR appui, dans l\'ordre persisté ; l\'égalité à l\'attendu est constatée, jamais « fautif » ni « juste » ; la divergence globale reste rappelée', async () => {
  const w = await monde([['moi', 'chien', 'Rex'], ['Hugo', 'chien', 'Rex']]);
  const A = await demander(w, 'Qui a pour chien Rex ?');
  assert.deepEqual((await locale(w, A.reco.idReponseLocale)).obtenu, ['moi', 'Hugo']);
  await corrigerSur(w, cibleAction(A.reco), 'Hugo');
  const ls = await localisees(w);
  assert.equal(ls.length, 2);
  assert.deepEqual(ls.map((x) => [x.appui.sujet, x.valeurDelivree, x.delivreEgaleAttendu, x.porteeSurIdentite]), [['moi', 'moi', false, 'indeterminee'], ['Hugo', 'Hugo', true, 'indeterminee']]);
  for (const x of ls) { assert.deepEqual(x.obtenu, ['moi', 'Hugo']); assert.deepEqual(Object.keys(x).filter((k) => /faut|respons|juste|correct/i.test(k)), []); }
  // chaque appui ne reçoit que SA ligne
  assert.deepEqual(L.notesLocalisation([{ sujet: 'Hugo', relation: 'chien', valeur: 'Rex' }], ls), ['Dans ma réponse à « Qui a pour chien Rex ? », Hugo → chien → Rex a fourni son sujet (Hugo) ; tu attendais Hugo. La conséquence pour cette connaissance reste indéterminée.']);
});

// ================================================================================================================ M/N/R/S. AUTRES CAS
test('M. deux divergences de la même projection, attendus différents → deux constats séparés, aucun arbitrage', async () => {
  const w = await monde();
  const r1 = await repondreLocal(w, 'mon vélo ?'); await corrigerSur(w, cibleRepondre(r1.r), 'Éclair');
  const r2 = await repondreLocal(w, 'mon vélo ?'); await corrigerSur(w, cibleRepondre(r2.r), 'Comète');
  const ls = await localisees(w);
  assert.deepEqual(ls.map((x) => x.attendu).sort(), ['Comète', 'Éclair']);
  assert.ok(ls.every((x) => x.porteeSurIdentite === 'incompatible-sous-identite' && x.valeurDelivree === 'Fusée'));
  assert.equal(L.notesLocalisation([K_VELO], ls).length, 2);
});

test('N. patron dynamique : la localisation suit fait → valeur → obtenu, jamais le texte montré', async () => {
  const magasin = C.magasinMemoireVive();
  const e = await E.chargerEsprit(magasin);
  await E.apprendrePropriete(e, { mot: 'couleur', propriete: 'genre', valeur: 'feminin' });
  await E.apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  await E.apprendreRegle(e, { role: 'possessif_toi', conditions: [{ propriete: 'genre', valeur: 'feminin' }], resultat: 'ta', exemple: 'ta couleur' });
  await E.apprendrePatron(e, { correction: 'Ta couleur, c’est bleu.', sujet: 'moi', relation: 'couleur', portee: 'toutes', dynamiserPossessif: true });
  await E.apprendreRelation(e, { mot: 'voiture', relation: 'voiture' });
  await E.apprendrePropriete(e, { mot: 'voiture', propriete: 'genre', valeur: 'feminin' });
  await E.apprendreFait(e, { sujet: 'moi', relation: 'voiture', valeur: 'une Twingo' });
  const w0 = await monde([]);
  for (const t of C.TABLES) for (const ligne of await magasin.lireTout(t)) if (['faits', 'lexique', 'patrons', 'regles', 'proprietes'].includes(t)) await w0.magasin.ecrire(t, ligne);
  const R = await repondreLocal(w0, 'Quelle est ma voiture ?');
  assert.match(R.r.texte, /^ta voiture/i);
  await corrigerSur(w0, cibleRepondre(R.r), 'Clio');
  const [x] = await localisees(w0);
  assert.equal(x.valeurDelivree, 'une Twingo'); assert.notEqual(x.valeurDelivree, R.r.texte);
  assert.equal(x.porteeSurIdentite, 'incompatible-sous-identite');
});

test('R. attendu canoniquement égal à l\'obtenu → aucune divergence, aucune localisation', async () => {
  const w = await monde();
  const R = await repondreLocal(w, 'mon vélo ?');
  await corrigerSur(w, cibleRepondre(R.r), 'fusée');
  assert.deepEqual(await localisees(w), []);
});

test('S/Z. fait modifié après coup : la lecture historique parle toujours de moi → vélo → Fusée ; après redémarrage, même lecture', async () => {
  const { w } = await deuxHistoires();
  const avant = await localisees(w);
  const e = await E.chargerEsprit(w.magasin);
  await E.oublierFait(e, { sujet: 'moi', relation: 'vélo' });
  await E.apprendreFait(e, { sujet: 'moi', relation: 'vélo', valeur: 'Comète', origine: 'apprise-conversation' });
  assert.deepEqual(await localisees(w), avant);
  assert.deepEqual(L.notesLocalisation([{ sujet: 'moi', relation: 'vélo', valeur: 'Comète' }], avant), [], 'le fait actuel n\'hérite de rien');
  const w2 = await redemarrer(w);
  assert.deepEqual(await localisees(w2), avant);
});

// ================================================================================================================ O/P/Q/T. EXCLUSIONS ET ANTI-DOUBLE
test('O/P. composition et viaType : aucune réponse locale, donc aucune divergence localisable ; une divergence de voie inconnue → abstention', async () => {
  const w = await monde([['zalpha', 'zrel1', 'zbeta'], ['zbeta', 'zrel2', 'zgamma']]);
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreRelation(e, { mot: 'zrel1', relation: 'zrel1' }); await E.apprendreRelation(e, { mot: 'zrel2', relation: 'zrel2' });
  const R = await repondreLocal(w, 'zalpha zrel1 zrel2 ?');
  assert.equal(R.r.texte, 'zgamma'); assert.equal(Object.hasOwn(R.r, 'idReponseLocale'), false);
  assert.equal(P.reponseLocaleAdmissible({ etat: E.COMPRIS, fait: { ...K_VELO }, viaType: true }), null);
  const divergenceInconnue = { idReponseAttendue: 'm', idReponseLocale: 'r', idQuestion: 'q', question: 'q', provenance: { voie: 'composition' }, obtenu: ['x'], attendu: 'y', appuis: [K_VELO] };
  assert.deepEqual(L.localiserDivergences({ divergences: [divergenceInconnue], traces: [] }), []);
});

test('Q. .19 seule (« Apprends : Réponse » sans production corrigée) : aucune divergence, aucune localisation, aucune note', async () => {
  const w = await monde();
  const q = await recevoir(w.magasin, 'Qui a pour surnom Puce ?');
  const lecon = await recevoir(w.magasin, 'Apprends : Réponse : Bob.');
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: q.id, reponse: 'Bob', idLecon: lecon.id });
  assert.deepEqual(await localisees(w), []);
  assert.deepEqual(L.notesLocalisation([{ sujet: 'Léa', relation: 'surnom', valeur: 'Puce' }], await localisees(w)), []);
});

test('T. Action .22 (réponse locale + trace) : UNE seule localisation, lue par la réponse locale et vérifiée sur la trace de sa provenance', async () => {
  const w = await monde();
  const A = await demander(w, 'Qui a pour vélo Fusée ?');
  await corrigerSur(w, cibleAction(A.reco), 'Bob');
  const ls = await localisees(w);
  assert.equal(ls.length, 1);
  assert.equal(ls[0].idReponseLocale, A.reco.idReponseLocale); assert.equal(ls[0].idTrace, A.reco.idTrace);
  assert.equal(ls[0].projection.delivre, 'sujet'); assert.equal(ls[0].porteeSurIdentite, 'indeterminee');
});

test('V/W. l\'ordre des lignes n\'induit aucun choix : entrées inversées → mêmes localisations (comme ensemble), mêmes notes', async () => {
  const { w } = await deuxHistoires();
  const l = await lignes(w);
  const ds = D.divergencesDeReponses(l);
  const a = L.localiserDivergences({ divergences: ds, traces: l.traces });
  const b = L.localiserDivergences({ divergences: [...ds].reverse(), traces: [...l.traces].reverse() });
  const cle = (x) => JSON.stringify(x);
  assert.deepEqual(a.map(cle).sort(), b.map(cle).sort());
  assert.deepEqual(L.notesLocalisation([K_VELO], a).sort(), L.notesLocalisation([K_VELO], b).sort());
  assert.ok(a.every((x) => ['indeterminee', 'incompatible-sous-identite'].includes(x.porteeSurIdentite)), 'deux degrés seulement');
});
