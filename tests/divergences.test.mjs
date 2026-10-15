// v0.64.21 — « RATTACHER UNE CORRECTION AUX CONNAISSANCES QUI ONT PRODUIT LA RÉPONSE » (GO ChatGPT « v0.64.21 », 15/10/2026).
// Chaîne rejouée avec les vraies primitives : question → réponse locale par une forme apprise (trace : idMessage, idAction, appuis lus à
// l'exécution) → réaction « Non, c'est Bob. » reconnue par la forme v0.64.20 → réponse attendue confirmée → divergence (vue pure) → la même
// connaissance ressert (voie repondre via pont.js réel, ou voie action) → note d'histoire, réponse inchangée, aucune connaissance modifiée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const P = await import('../app/langage/pont.js');
const { chargerEsprit, apprendreFait, oublierFait } = await import('../app/langage/esprit.js');
const K = await import('../app/langage/corrections-apprises.js');
const D = await import('../app/langage/divergences.js');
const S = await import('../app/langage/selection.js');
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

// Monde : faits + forme de question active (Action recherche) + forme de correction active (décision portant la règle), comme après v0.64.20.
async function monde(faits = [['moi', 'vélo', 'Fusée'], ['Léa', 'surnom', 'Puce'], ['moi', 'kayak', 'Torpille']]) {
  const magasin = C.magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  for (const [sujet, relation, valeur] of faits) await apprendreFait(e, { sujet, relation, valeur, origine: 'apprise-conversation' });
  const { objet: action } = await C.apprendreAction(magasin, { operation: 'recherche', roles: [{ position: 3, nom: 'relation' }, { position: 4, nom: 'valeur' }], n: 6, exemples: [{ entree: 'Qui a pour chien Rex ?' }, { entree: 'Qui a pour métier pilote ?' }], statut: 'validee', origine: 'induite-supervisee' });
  const s1 = await recevoir(magasin, "Non, c'est Zoé."); const s2 = await recevoir(magasin, "Non, c'est Max.");
  await C.enregistrerDecisionForme(magasin, { idCandidat: identiteRegle(REGLE_CORRECTION), decision: 'confirmee', sources: [s1.id, s2.id], regle: REGLE_CORRECTION });
  return { magasin, e: await chargerEsprit(magasin), action };
}
async function recevoir(magasin, texte) {
  const message = P.identifierMessage(texte, { nouvelId: C.nouvelId });
  await P.conserverValeurMessage(message, { enregistrerValeur: (entree) => C.enregistrerValeurDonnee(magasin, entree) });
  return message;
}
async function demander(w, question) {
  const Q = await recevoir(w.magasin, question);
  const reco = await ecranSur(w.magasin).tenterReconnaissanceAction(question, Q.id);
  return { Q, reco };
}
async function reagir(w, idTrace, texte) {
  const ecran = ecranSur(w.magasin);
  const r = await P.traiterTourAvecEnonce(texte, { idTrace }, {
    enregistrerEnonce: (t, x, m) => ecran.enregistrerEnonceSurTrace(t, x, m), traiter: async (message) => ({ message }),
    nouvelId: C.nouvelId, enregistrerValeur: (entree) => C.enregistrerValeurDonnee(w.magasin, entree),
  });
  return r.message;
}
// Question → réponse locale → « Non, c'est R. » reconnue → Confirmer (onOui de main.js : réponse attendue de la question).
async function corriger(w, question, reponse) {
  const { Q, reco } = await demander(w, question);
  const E = await reagir(w, reco.idTrace, `Non, c'est ${reponse}.`);
  const c = await K.reconnaitreCorrection(w.magasin, { idMessage: E.id, texte: `Non, c'est ${reponse}.` });
  assert.equal(c.reconnue, true, JSON.stringify(c));
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: c.idQuestion, reponse: c.reponse, idLecon: E.id });
  return { Q, reco, E };
}
async function divergences(w) { return D.divergencesDeReponses(await C.lireLignesDivergences(w.magasin)); }
// La voie repondre RÉELLE (pont.js), dépendances neutres.
async function repondreLocal(w, texte) {
  const e = await chargerEsprit(w.magasin);
  return P.tenterPontLangage(texte, { assurerEsprit: async () => e, journaliser: async () => [null, null], enregistrerExperience: async () => ({ id: 'exp' }), ajouterInterpretation: async () => {} });
}
async function notes(w, appuis) { return D.notesHistoire(D.historiqueDesAppuis(appuis, await divergences(w))); }
async function redemarrer(w) {
  const donnees = {};
  for (const t of C.TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t)));
  const magasin = C.magasinMemoireVive();
  await magasin.remplacerTout(donnees);
  return { magasin, e: await chargerEsprit(magasin), action: w.action };
}
const NOTE_VELO = "Ce que je sais ici (moi → vélo → Fusée) a déjà contribué à une réponse que tu as corrigée : « Qui a pour vélo Fusée ? » → tu attendais Bob.";

// ================================================================================================================ DV0. PROVENANCE À L'EXÉCUTION
test('DV0. trace d\'une réponse locale : idAction RÉELLEMENT invoquée + appuis lus à l\'exécution (faits exacts, graphie stockée) ; faitsAvec = même filtre que sujetsAvec', async () => {
  const w = await monde();
  const { Q, reco } = await demander(w, 'Qui a pour vélo Fusée ?');
  const trace = (await w.magasin.lireTout('traces')).find((t) => t.id === reco.idTrace);
  assert.equal(trace.idAction, w.action.id, 'E : identité de l\'Action conservée');
  assert.equal(trace.idMessage, Q.id);
  assert.deepEqual(trace.appuis, [{ sujet: 'moi', relation: 'vélo', valeur: 'Fusée' }]);
  assert.deepEqual(reco.appuis, trace.appuis);
  assert.deepEqual(S.faitsAvec(w.e, { relation: 'VÉLO', valeur: 'fusee' }).map((f) => f.sujet), S.sujetsAvec(w.e, { relation: 'VÉLO', valeur: 'fusee' }));
  assert.equal(typeof CAPACITES.recherche.lecture.appuis, 'function');
  // F : aucune Action inventée pour une autre voie (trace écrite sans idAction)
  const t2 = await C.enregistrerTrace(w.magasin, { capacite: 'recherche', voie: 'rejeu', argumentsUtilises: {}, provenanceArguments: {}, resultat: { sujets: [] } });
  assert.equal(Object.hasOwn(t2, 'idAction'), false); assert.equal(Object.hasOwn(t2, 'appuis'), false);
  await assert.rejects(() => C.enregistrerTrace(w.magasin, { capacite: 'x', voie: 'action', argumentsUtilises: {}, provenanceArguments: {}, resultat: {}, appuis: [{ sujet: 'a' }] }), /appuis/);
  await assert.rejects(() => C.enregistrerTrace(w.magasin, { capacite: 'x', voie: 'action', argumentsUtilises: {}, provenanceArguments: {}, resultat: {}, idAction: '' }), /idAction/);
});

// ================================================================================================================ DV1. DÉCISIF
test('DV1. décisif : « Qui a pour vélo Fusée ? » → moi ; « Non, c\'est Bob. » confirmée → divergence (obtenu moi, attendu Bob, appui moi → vélo → Fusée) ; « mon vélo ? » (voie repondre) → Fusée + note ; redémarrage → idem ; rien n\'est modifié', async () => {
  let w = await monde();
  assert.deepEqual(await divergences(w), [], 'A : aucune correction, aucune divergence');
  const faitsAvant = JSON.stringify(await w.magasin.lireTout('faits'));
  const actionsAvant = JSON.stringify(await w.magasin.lireTout('actions'));
  const { Q, reco } = await corriger(w, 'Qui a pour vélo Fusée ?', 'Bob');
  const [d, ...reste] = await divergences(w);
  assert.equal(reste.length, 0);
  assert.deepEqual(d, { idReponseAttendue: Q.id, idTrace: reco.idTrace, idQuestion: Q.id, question: 'Qui a pour vélo Fusée ?', idAction: w.action.id, obtenu: ['moi'], attendu: 'Bob', appuis: [{ sujet: 'moi', relation: 'vélo', valeur: 'Fusée' }] });
  // autre question, autre voie
  const local = await repondreLocal(w, 'mon vélo ?');
  assert.equal(local.texte, 'Fusée', 'la réponse normale reste Fusée');
  assert.deepEqual(local.appuis, [{ sujet: 'moi', relation: 'vélo', valeur: 'Fusée' }]);
  assert.deepEqual(await notes(w, local.appuis), [NOTE_VELO]);
  // M, N, O : rien de modifié, Bob n'est pas un fait, aucune Action touchée
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), faitsAvant);
  assert.equal(JSON.stringify(await w.magasin.lireTout('actions')), actionsAvant);
  assert.equal((await w.magasin.lireTout('faits')).some((f) => f.sujet === 'Bob' || f.valeur === 'Bob'), false);
  // K : redémarrage
  w = await redemarrer(w);
  const local2 = await repondreLocal(w, 'mon vélo ?');
  assert.equal(local2.texte, 'Fusée');
  assert.deepEqual(await notes(w, local2.appuis), [NOTE_VELO]);
  // voie action : la même connaissance ressert par l'Action
  const encore = await demander(w, 'Qui a pour vélo Fusée ?');
  assert.equal(encore.reco.texte, 'Résultat (recherche locale) : moi.');
  assert.deepEqual(await notes(w, encore.reco.appuis), [NOTE_VELO]);
});

// ================================================================================================================ DV2. CONCORDANCE ET IDENTITÉ DES APPUIS (B, G, I)
test('DV2. attendu canoniquement égal → aucune divergence ; appui sans divergence → aucune note ; mots voisins ou autre valeur → aucune correspondance', async () => {
  const w = await monde([['moi', 'vélo', 'Fusée'], ['Léa', 'surnom', 'Puce'], ['moi', 'vélos', 'Fusée'], ['toi', 'vélo', 'Fusée rouge']]);
  await corriger(w, 'Qui a pour surnom Puce ?', 'léa');
  assert.deepEqual(await divergences(w), [], 'B : léa = Léa canoniquement');
  assert.deepEqual(await notes(w, [{ sujet: 'Léa', relation: 'surnom', valeur: 'Puce' }]), [], 'G');
  await corriger(w, 'Qui a pour vélo Fusée ?', 'Bob');
  assert.equal((await divergences(w)).length, 1);
  for (const voisin of [{ sujet: 'moi', relation: 'vélos', valeur: 'Fusée' }, { sujet: 'moi', relation: 'vélo', valeur: 'Fusée rouge' }, { sujet: 'toi', relation: 'vélo', valeur: 'Fusée' }, { sujet: 'mo', relation: 'vélo', valeur: 'Fusée' }]) {
    assert.deepEqual(await notes(w, [voisin]), [], JSON.stringify(voisin));
  }
  assert.deepEqual(await notes(w, [{ sujet: 'MOI', relation: 'Vélo', valeur: 'fusee' }]), ["Ce que je sais ici (MOI → Vélo → fusee) a déjà contribué à une réponse que tu as corrigée : « Qui a pour vélo Fusée ? » → tu attendais Bob."], 'même fait, autre graphie');
});

// ================================================================================================================ DV3. PLUSIEURS APPUIS (J, V)
test('DV3. plusieurs appuis / plusieurs divergences : tout est signalé, rien n\'est choisi, l\'ordre des divergences n\'influence pas le contenu', async () => {
  const w = await monde([['moi', 'vélo', 'Fusée'], ['Bob', 'vélo', 'Fusée'], ['moi', 'kayak', 'Torpille']]);
  const { reco } = await corriger(w, 'Qui a pour vélo Fusée ?', 'Zoé');
  const trace = (await w.magasin.lireTout('traces')).find((t) => t.id === reco.idTrace);
  assert.deepEqual(trace.appuis.map((a) => a.sujet).sort(), ['Bob', 'moi']);
  await corriger(w, 'Qui a pour kayak Torpille ?', 'Max');
  const ds = await divergences(w);
  assert.equal(ds.length, 2);
  assert.deepEqual(ds.find((d) => d.attendu === 'Zoé').obtenu.sort(), ['Bob', 'moi'], 'résultat multiple ≠ attendu unique : divergence, aucun sujet choisi');
  const appuis = [{ sujet: 'moi', relation: 'vélo', valeur: 'Fusée' }, { sujet: 'Bob', relation: 'vélo', valeur: 'Fusée' }, { sujet: 'moi', relation: 'kayak', valeur: 'Torpille' }];
  const h = D.historiqueDesAppuis(appuis, ds);
  assert.equal(h.length, 3, 'chaque appui concerné est signalé');
  assert.deepEqual(D.historiqueDesAppuis(appuis, [...ds].reverse()).map((x) => x.appui), h.map((x) => x.appui));
  // un même appui avec deux divergences : les deux citées
  await corriger(w, 'Qui a pour vélo Fusée ?', 'Léo');
  const n = await notes(w, [{ sujet: 'moi', relation: 'vélo', valeur: 'Fusée' }]);
  assert.equal(n.length, 1);
  assert.match(n[0], /des réponses que tu as corrigées : « Qui a pour vélo Fusée \? » → tu attendais (Zoé|Léo) ; « Qui a pour vélo Fusée \? » → tu attendais (Zoé|Léo)\./);
});

// ================================================================================================================ DV4. VÉRITÉ HISTORIQUE (L) ET TRACES ANCIENNES
test('DV4. le fait change après coup : l\'appui historique reste l\'ancien, le nouveau fait n\'hérite pas de l\'histoire ; trace sans appuis (antérieure) : divergence sans appuis, jamais reconstruits', async () => {
  const w = await monde();
  await corriger(w, 'Qui a pour vélo Fusée ?', 'Bob');
  await oublierFait(w.e, { sujet: 'moi', relation: 'vélo' });
  await apprendreFait(w.e, { sujet: 'moi', relation: 'vélo', valeur: 'Éclair', origine: 'apprise-conversation' });
  const [d] = await divergences(w);
  assert.deepEqual(d.appuis, [{ sujet: 'moi', relation: 'vélo', valeur: 'Fusée' }], 'histoire non réécrite');
  const local = await repondreLocal(w, 'mon vélo ?');
  assert.equal(local.texte, 'Éclair');
  assert.deepEqual(await notes(w, local.appuis), [], 'le fait actuel (Éclair) n\'a pas l\'histoire de Fusée');
  // trace antérieure à v0.64.21 : pas d'appuis → divergence sans appuis → aucune note
  const w2 = await monde();
  const Q = await recevoir(w2.magasin, 'Qui a pour kayak Torpille ?');
  const t = await C.enregistrerTrace(w2.magasin, { capacite: 'recherche', voie: 'action', argumentsUtilises: { relation: 'kayak', valeur: 'Torpille' }, provenanceArguments: {}, resultat: { sujets: ['moi'] }, idMessage: Q.id });
  const E = await reagir(w2, t.id, "Non, c'est Max.");
  await C.enregistrerReponseAttendue(w2.magasin, { idMessage: Q.id, reponse: 'Max', idLecon: E.id });
  const [d2] = await divergences(w2);
  assert.deepEqual(d2.appuis, []); assert.equal(Object.hasOwn(d2, 'idAction'), false);
  assert.deepEqual(await notes(w2, [{ sujet: 'moi', relation: 'kayak', valeur: 'Torpille' }]), []);
});

// ================================================================================================================ DV5. ÉCHAFAUDAGE ET NON-RATTACHEMENTS
test('DV5. correction supervisée (échafaudage .20) : divergence rattachée par la réaction ; réponse attendue d\'une question naturelle sans trace : aucune divergence', async () => {
  const w = await monde();
  const { reco } = await demander(w, 'Qui a pour surnom Puce ?');
  const E = await reagir(w, reco.idTrace, 'Pas elle : Zoé.');
  const L = await recevoir(w.magasin, 'Apprends : Réponse : Zoé.');
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: E.id, reponse: 'Zoé', idLecon: L.id });
  const [d] = await divergences(w);
  assert.equal(d.idReponseAttendue, E.id); assert.equal(d.question, 'Qui a pour surnom Puce ?'); assert.deepEqual(d.obtenu, ['Léa']);
  const Qn = await recevoir(w.magasin, 'Qui a pour kayak Torpille ?');
  const Ln = await recevoir(w.magasin, 'Apprends : Réponse : Max.');
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: Qn.id, reponse: 'Max', idLecon: Ln.id });
  assert.equal((await divergences(w)).length, 1, 'question naturelle (v0.64.19) : aucune trace, aucune divergence');
});

// ================================================================================================================ DV6. RACCORDS main.js / pont.js (O6 inclus : P, Q, R, S)
test('DV6. main.js : notes séparées sur les deux voies, réponse inchangée ; O6 structurel (référence de trace seule) AVANT le modèle externe, après toutes les voies locales ; pont.js : appuis du seul fait réellement utilisé', () => {
  const main = sansCommentaires(lu('app', 'main.js'));
  const corps = main.slice(main.indexOf('async function traiterTour('));
  assert.match(corps, /const notesAction = await notesDesAppuis\(reconnaissanceAction\.appuis\);/);
  assert.match(corps, /return \{ texte: reconnaissanceAction\.texte, local: true, /);
  assert.match(corps, /const notesLocales = await notesDesAppuis\(local\.appuis\);/);
  const iO6 = corps.indexOf("if (referenceCible && ((typeof referenceCible.idTrace === 'string' && referenceCible.idTrace.length > 0) || (typeof referenceCible.idReponseLocale === 'string' && referenceCible.idReponseLocale.length > 0))) {\n      return { texte: 'Je garde ta réaction à ma réponse"); // MISE À JOUR DÉLIBÉRÉE v0.64.22 : O6 étendu à toute CIBLE réelle (trace historique ou réponse locale), critère toujours structurel
  const iGemini = corps.indexOf('const reponse = await esprit.repondre(texte, options);');
  const iPont = corps.indexOf('const local = await tenterPontLangage(texte, {');
  const iCorrection = corps.indexOf('correction = await reconnaitreCorrection(');
  assert.ok(iCorrection > 0 && iCorrection < iPont && iPont < iO6 && iO6 < iGemini, 'Q : correction .20 d\'abord ; P/S : O6 juste avant le modèle externe');
  const bloc = corps.slice(iO6, iGemini);
  assert.doesNotMatch(bloc, /texte\.(includes|match|test|startsWith)|\/\^|non|merci/i, 'aucune analyse du contenu');
  assert.doesNotMatch(main, /oublierFait|apprendreFait\(.*Bob|marquerFaux|confiance/, 'aucune révision');
  const def = main.slice(main.indexOf('async function notesDesAppuis('), main.indexOf('async function propositionDeCorrection('));
  assert.doesNotMatch(def, /ecrire|enregistrer|apprendre|oublier/, 'les notes n\'écrivent rien');
  const pont = sansCommentaires(lu('app', 'langage', 'pont.js'));
  assert.match(pont, /if \(!f \|\| local\.conflitFait \|\| local\.conflitPatron \|\| local\.conflit \|\| local\.regleManquante\) return \[\];/);
  const vue = sansCommentaires(lu('app', 'langage', 'divergences.js'));
  assert.doesNotMatch(vue, /lireTout|ecrire\(|erreur|faux|fausse/i, 'vue pure, vocabulaire neutre');
});

test('DV7. voie repondre : aucune note quand la réponse ne vient pas d\'un fait (inconnu, conflit) ; R : message ordinaire inchangé (pas de référence → le chemin externe reste celui d\'avant)', async () => {
  const w = await monde();
  await corriger(w, 'Qui a pour vélo Fusée ?', 'Bob');
  const inconnu = await repondreLocal(w, 'mon bateau ?');
  assert.equal(inconnu && inconnu.local, undefined, 'pas de réponse locale, aucun appui');
  const conflit = await repondreLocal(w, 'Bonjour');
  assert.equal(conflit, null);
});
