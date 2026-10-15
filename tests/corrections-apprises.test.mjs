// v0.64.20 — « APPRENDRE LA FORME D'UNE CORRECTION NATURELLE » (GO ChatGPT « v0.64.20 », 15/10/2026).
// Chaîne rejouée avec les VRAIES primitives : question Q (message-N conservé) → réponse locale par une forme apprise (écran de langage réel, trace
// portant l'identité de Q) → réaction E par « Répondre » sur cette réponse (pont.js réel : énoncé portant l'identité de E) → échafaudage
// « Apprends : Réponse : Zoé. » sur E (réponse attendue v0.64.19) → induction par le noyau commun → proposition → décision qui porte la règle →
// redémarrage → correction inédite reconnue DANS sa situation → aperçu → (Confirmer) réponse attendue de Q.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const P = await import('../app/langage/pont.js');
const { chargerEsprit, apprendreFait } = await import('../app/langage/esprit.js');
const { reconnaitreActions } = await import('../app/langage/action.js');
const F = await import('../app/langage/formes-confirmees.js');
const R = await import('../app/langage/reponses-attendues.js');
const K = await import('../app/langage/corrections-apprises.js');
const N = await import('../app/langage/explication-supervisee.js');
const { ACTES_PEDAGOGIQUES } = await import('../app/langage/actes-pedagogiques.js');
const { identiteRegle } = await import('../app/langage/regle-forme.js');
const { CAPACITES } = await import('../app/langage/registre.js');
const { monterEcranLangage } = await import('../app/langage/ecran.js');

const RACINE = new URL('..', import.meta.url).pathname;
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const FAITS = [['Léa', 'surnom', 'Puce'], ['moi', 'kayak', 'Torpille'], ['moi', 'vélo', 'Fusée'], ['Paul', 'métier', 'pilote']];
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
const ecranSur = (magasin) => monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
// Monde : faits + forme de question « Qui a pour X Y? » déjà active (Action recherche validée, comme après v0.64.19).
async function monde() {
  const magasin = C.magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  for (const [sujet, relation, valeur] of FAITS) await apprendreFait(e, { sujet, relation, valeur, origine: 'apprise-conversation' });
  await C.apprendreAction(magasin, { operation: 'recherche', roles: [{ position: 3, nom: 'relation' }, { position: 4, nom: 'valeur' }], n: 6, exemples: [{ entree: 'Qui a pour chien Rex ?' }, { entree: 'Qui a pour métier pilote ?' }], statut: 'validee', origine: 'induite-supervisee' });
  return { magasin, e: await chargerEsprit(magasin) };
}
async function recevoir(magasin, texte) {
  const message = P.identifierMessage(texte, { nouvelId: C.nouvelId });
  await P.conserverValeurMessage(message, { enregistrerValeur: (entree) => C.enregistrerValeurDonnee(magasin, entree) });
  return message;
}
// Question → réponse locale (trace portant l'identité de la question), comme main.js.
async function demander(w, question) {
  const Q = await recevoir(w.magasin, question);
  const reco = await ecranSur(w.magasin).tenterReconnaissanceAction(question, Q.id);
  assert.equal(reco.ok, true, question);
  return { Q, idTrace: reco.idTrace, texte: reco.texte };
}
// Réaction par « Répondre » sur la réponse de Naissance : le VRAI pont.js (valeur conservée, énoncé portant l'identité du message).
async function reagir(w, idTrace, texte) {
  const ecran = ecranSur(w.magasin);
  const r = await P.traiterTourAvecEnonce(texte, { idTrace }, {
    enregistrerEnonce: (t, x, m) => ecran.enregistrerEnonceSurTrace(t, x, m),
    traiter: async (message) => ({ message }),
    nouvelId: C.nouvelId,
    enregistrerValeur: (entree) => C.enregistrerValeurDonnee(w.magasin, entree),
  });
  return r.message;
}
// Échafaudage : Répondre sur E + « Apprends : Réponse : r. » → Confirmer : réponse attendue de E, puis les DEUX inducteurs (comme main.js).
async function superviser(w, E, reponse) {
  const L = await recevoir(w.magasin, `Apprends : Réponse : ${reponse}.`);
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: E.id, reponse, idLecon: L.id });
  const question = await R.examinerReponseApresSupervision(w.magasin, w.e, E.id);
  const correction = await K.examinerCorrectionApresSupervision(w.magasin, E.id);
  return { question, correction };
}
async function corriger(w, question, texte, reponse) {
  const { idTrace } = await demander(w, question);
  const E = await reagir(w, idTrace, texte);
  return { E, idTrace, ...(await superviser(w, E, reponse)) };
}
async function redemarrer(w) {
  const donnees = {};
  for (const t of C.TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t)));
  const magasin = C.magasinMemoireVive();
  await magasin.remplacerTout(donnees);
  return { magasin, e: await chargerEsprit(magasin) };
}
const REGLE = { operation: 'reponseAttendue', n: 5, ancres: [{ position: 0, jeton: 'Non' }, { position: 1, jeton: ',' }, { position: 2, jeton: "c'est" }, { position: 4, jeton: '.' }], roles: [{ position: 3, nom: 'reponse' }], constantes: {} };

// ================================================================================================================ KC0. FRONTIÈRES
test('KC0. acte pédagogique ≠ capacité : reponseAttendue est déclaré hors du registre, jamais invocable ; le noyau commun est pur ; aucun mot de correction codé', () => {
  assert.deepEqual(Object.keys(ACTES_PEDAGOGIQUES), ['reponseAttendue']);
  assert.ok(Object.isFrozen(ACTES_PEDAGOGIQUES) && Object.isFrozen(ACTES_PEDAGOGIQUES.reponseAttendue));
  assert.equal('reponseAttendue' in CAPACITES, false, 'Q : jamais une capacité invocable');
  assert.equal(reconnaitreActions([{ ...REGLE, statut: 'validee', exemples: [] }], "Non, c'est Bob.").etat, 'aucune');
  for (const f of ['corrections-apprises.js', 'explication-supervisee.js', 'actes-pedagogiques.js']) {
    const src = sansCommentaires(lu('app', 'langage', f));
    assert.doesNotMatch(src, /['"]non['"]|c'est|n[ée]gation/i, f);
  }
  assert.doesNotMatch(sansCommentaires(lu('app', 'langage', 'explication-supervisee.js')), /import .*connaissances|lireTout|ecrire\(|CAPACITES/, 'noyau pur');
  assert.doesNotMatch(sansCommentaires(lu('app', 'langage', 'corrections-apprises.js')), /CAPACITES|registre\.js|invoquer|apprendreFait|apprendreAction|oublierFait/, 'P/Q : ni capacité, ni fait, ni Action');
});

// ================================================================================================================ KC1. DÉCISIF
test('KC1. décisif : Zoé (insuffisant) → Max → « Non, c\'est X. » proposée → Confirmer (décision portant la règle, aucune Action) → redémarrage → « Non, c\'est Bob. » en réaction → aperçu → Confirmer → réponse attendue de la question', async () => {
  let w = await monde();
  const t1 = await corriger(w, 'Qui a pour surnom Puce ?', "Non, c'est Zoé.", 'Zoé');
  // chaîne d'identités persistante : Q → trace → énoncé E
  const trace = (await w.magasin.lireTout('traces')).find((t) => t.id === t1.idTrace);
  assert.equal(typeof trace.idMessage, 'string');
  const enonce = (await w.magasin.lireTout('enonces')).find((x) => x.idTrace === t1.idTrace);
  assert.equal(enonce.idMessage, t1.E.id);
  assert.deepEqual(t1.question, { raison: 'aucun-exemple' }, 'une réaction n\'est pas une question naturelle pour v0.64.19');
  assert.deepEqual(t1.correction, { raison: 'insuffisant' }, 'A : un seul exemple');
  const t2 = await corriger(w, 'Qui a pour kayak Torpille ?', "Non, c'est Max.", 'Max');
  const p = t2.correction.proposition;
  assert.ok(p, JSON.stringify(t2.correction));
  assert.deepEqual(p.regle, REGLE);
  assert.equal(p.idCandidat, identiteRegle(REGLE));
  assert.deepEqual(p.sources, [t1.E.id, t2.E.id].sort());
  assert.equal(p.texte, [
    "J'ai remarqué une forme commune à tes corrections :",
    "« Non, c'est Zoé. » → Zoé",
    "« Non, c'est Max. » → Max",
    '',
    'Je propose de comprendre désormais, quand tu réponds ainsi à l\'une de mes réponses :',
    "« Non, c'est X. »",
    'comme indiquant que la réponse attendue était X.',
    '',
    'Est-ce correct ?',
  ].join('\n'));
  assert.doesNotMatch(p.texte, /reponseAttendue|position|négation|forme-[0-9a-f]/);
  const actionsAvant = JSON.stringify(await w.magasin.lireTout('actions'));
  const d = await K.confirmerFormeCorrection(w.magasin, p);
  assert.deepEqual(d, { idCandidat: p.idCandidat, decision: 'confirmee', sources: p.sources, regle: REGLE });
  assert.equal(JSON.stringify(await w.magasin.lireTout('actions')), actionsAvant, 'la forme de correction n\'est PAS une Action');
  assert.deepEqual(F.decisionsIncoherentes(await w.magasin.lireTout('decisionsFormes'), await w.magasin.lireTout('actions')), []);
  // R : redémarrage
  w = await redemarrer(w);
  const faitsAvant = JSON.stringify(await w.magasin.lireTout('faits'));
  const { Q, idTrace } = await demander(w, 'Qui a pour vélo Fusée ?');
  const E3 = await reagir(w, idTrace, "Non, c'est Bob.");
  const reponsesAvant = JSON.stringify(await w.magasin.lireTout('reponsesAttendues'));
  const reco = await K.reconnaitreCorrection(w.magasin, { idMessage: E3.id, texte: "Non, c'est Bob." });
  assert.deepEqual(reco, { reconnue: true, idQuestion: Q.id, question: 'Qui a pour vélo Fusée ?', reponse: 'Bob', idForme: p.idCandidat });
  assert.equal(JSON.stringify(await w.magasin.lireTout('reponsesAttendues')), reponsesAvant, 'G : rien n\'est écrit par la reconnaissance');
  // H : Confirmer (onOui de main.js) → réponse attendue de la QUESTION
  const r = await C.enregistrerReponseAttendue(w.magasin, { idMessage: reco.idQuestion, reponse: reco.reponse, idLecon: E3.id });
  assert.deepEqual(r, { idMessage: Q.id, reponse: 'Bob', idLecon: E3.id });
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), faitsAvant, 'P : aucun fait écrit ni modifié');
});

// ================================================================================================================ KC2. SITUATION (E, S)
test('KC2. hors situation : même texte sans réaction à une trace, réaction à une trace sans question identifiée (ancienne), message inconnu → rien n\'est reconnu ni examiné', async () => {
  const w = await monde();
  await corriger(w, 'Qui a pour surnom Puce ?', "Non, c'est Zoé.", 'Zoé');
  await K.confirmerFormeCorrection(w.magasin, (await corriger(w, 'Qui a pour kayak Torpille ?', "Non, c'est Max.", 'Max')).correction.proposition);
  // E : même texte, message ordinaire (pas de Répondre sur une réponse de Naissance)
  const libre = await recevoir(w.magasin, "Non, c'est Bob.");
  assert.deepEqual(await K.reconnaitreCorrection(w.magasin, { idMessage: libre.id, texte: "Non, c'est Bob." }), { reconnue: false, raison: 'hors-situation' });
  assert.deepEqual(await K.examinerCorrectionApresSupervision(w.magasin, libre.id), { raison: 'hors-situation' });
  // S : réaction à une trace qui n'a pas l'identité de sa question (trace d'avant v0.64.20, ou d'une autre voie)
  const reco = await ecranSur(w.magasin).tenterReconnaissanceAction('Qui a pour vélo Fusée ?');
  const E = await reagir(w, reco.idTrace, "Non, c'est Bob.");
  assert.deepEqual(await K.reconnaitreCorrection(w.magasin, { idMessage: E.id, texte: "Non, c'est Bob." }), { reconnue: false, raison: 'hors-situation' });
  // S : un énoncé sans identité de message (capture d'avant v0.64.20) n'est jamais une situation
  const { idTrace } = await demander(w, 'Qui a pour métier pilote ?');
  await C.enregistrerEnonceSurTrace(w.magasin, { idTrace, texte: "Non, c'est Bob." });
  assert.equal(K.situationsDeReaction(await w.magasin.lireTout('enonces'), await w.magasin.lireTout('traces')).size, 2, 'seules les deux réactions identifiées vers une question identifiée');
  // en situation mais texte d'une autre forme : rien
  const t = await demander(w, 'Qui a pour métier pilote ?');
  const autre = await reagir(w, t.idTrace, 'Pas du tout, Bob.');
  assert.deepEqual(await K.reconnaitreCorrection(w.magasin, { idMessage: autre.id, texte: 'Pas du tout, Bob.' }), { reconnue: false, raison: 'aucune-forme' });
});

// ================================================================================================================ KC3. INDUCTION (C, D, K, L)
test('KC3. deux copies → insuffisant ; rôle jamais varié → non démontré ; plusieurs explications → abstention ; ordre inversé → même identité ; contradiction', async () => {
  const c = await monde();
  await corriger(c, 'Qui a pour surnom Puce ?', "Non, c'est Zoé.", 'Zoé');
  assert.deepEqual((await corriger(c, 'Qui a pour kayak Torpille ?', "Non, c'est Zoé.", 'Zoé')).correction, { raison: 'insuffisant' }, 'C : même texte = un exemple');
  // D : réponse jamais variée. Pour un acte à UN rôle qui EST la réponse, deux exemples de même règle ne diffèrent que par ce rôle : si la réponse
  // ne varie pas, ils sont soit le même exemple (jetons canoniques identiques, même à la casse près), soit d'ancres différentes (autre règle).
  const d = await monde();
  await corriger(d, 'Qui a pour surnom Puce ?', "Non, c'est Zoé.", 'Zoé');
  assert.deepEqual((await corriger(d, 'Qui a pour kayak Torpille ?', "Non, c'est zoé.", 'Zoé')).correction, { raison: 'insuffisant' }, 'D : casse seule → un exemple');
  const d2 = await monde();
  await corriger(d2, 'Qui a pour surnom Puce ?', "Non, c'est Zoé, pas Max.", 'Zoé');
  assert.deepEqual((await corriger(d2, 'Qui a pour kayak Torpille ?', "Non, c'est Zoé, pas Bob.", 'Zoé')).correction, { raison: 'insuffisant' }, 'D : ancres différentes → aucune explication commune');
  // K : la réponse figure à DEUX positions de chaque réaction : deux explications par exemple, mais l'autre occurrence est une ancre qui varie →
  // aucune explication commune → abstention (jamais « la première position »).
  const k = await monde();
  await corriger(k, 'Qui a pour surnom Puce ?', 'Zoé ? Oui, Zoé.', 'Zoé');
  assert.equal(K.explicationsCorrection('Zoé ? Oui, Zoé.', 'Zoé').length, 2);
  assert.deepEqual((await corriger(k, 'Qui a pour kayak Torpille ?', 'Max ? Oui, Max.', 'Max')).correction, { raison: 'insuffisant' });
  // K (noyau) : deux explications réellement communes et démontrées → 'plusieurs-explications', quel que soit l'ordre
  const g = (id, texte) => ({ cle: id, representant: { idMessage: id, texte, resultat: 'r' }, membres: [id], contradictoire: false });
  const deux = [{ id: 'a', regle: { roles: [{ position: 0, nom: 'r' }] } }, { id: 'b', regle: { roles: [{ position: 1, nom: 'r' }] } }];
  const [g1, g2] = [g('m1', 'x y'), g('m2', 'z w')];
  assert.deepEqual(N.retenirExplication(g1, [g1, g2], () => deux), { raison: 'plusieurs-explications' });
  assert.deepEqual(N.retenirExplication(g1, [g1, g2], () => [...deux].reverse()), { raison: 'plusieurs-explications' });
  // L
  const a = await monde();
  await corriger(a, 'Qui a pour surnom Puce ?', "Non, c'est Zoé.", 'Zoé');
  const pa = (await corriger(a, 'Qui a pour kayak Torpille ?', "Non, c'est Max.", 'Max')).correction.proposition;
  const b = await monde();
  await corriger(b, 'Qui a pour surnom Puce ?', "Non, c'est Max.", 'Max');
  const pb = (await corriger(b, 'Qui a pour kayak Torpille ?', "Non, c'est Zoé.", 'Zoé')).correction.proposition;
  assert.equal(pa.idCandidat, pb.idCandidat);
  // contradiction : même texte, réponses différentes
  const x = await monde();
  await corriger(x, 'Qui a pour surnom Puce ?', "Non, c'est Zoé.", 'Zoé');
  assert.deepEqual((await corriger(x, 'Qui a pour kayak Torpille ?', "Non, c'est Zoé.", 'Max')).correction, { raison: 'contradiction' });
  // aucune explication : la réponse supervisée n'apparaît pas dans la réaction
  const y = await monde();
  assert.deepEqual((await corriger(y, 'Qui a pour surnom Puce ?', 'Non, pas elle.', 'Zoé')).correction, { raison: 'aucune-explication' });
});

// ================================================================================================================ KC4. REFUS (I, J)
test('KC4. refus de l\'aperçu → rien écrit ; refus de la règle → décision refusee, non reproposée après redémarrage, aucune correction reconnue', async () => {
  let w = await monde();
  await corriger(w, 'Qui a pour surnom Puce ?', "Non, c'est Zoé.", 'Zoé');
  const p = (await corriger(w, 'Qui a pour kayak Torpille ?', "Non, c'est Max.", 'Max')).correction.proposition;
  assert.deepEqual(await K.refuserFormeCorrection(w.magasin, p), { idCandidat: p.idCandidat, decision: 'refusee', sources: p.sources });
  w = await redemarrer(w);
  assert.deepEqual((await corriger(w, 'Qui a pour vélo Fusée ?', "Non, c'est Bob.", 'Bob')).correction, { raison: 'deja-decidee' });
  const { idTrace } = await demander(w, 'Qui a pour métier pilote ?');
  const E = await reagir(w, idTrace, "Non, c'est Léo.");
  assert.deepEqual(await K.reconnaitreCorrection(w.magasin, { idMessage: E.id, texte: "Non, c'est Léo." }), { reconnue: false, raison: 'aucune-forme' });
  // I : l'aperçu refusé n'écrit rien — la reconnaissance elle-même n'écrit rien (KC1) et onNon n'appelle aucune écriture (KC6, source)
});

// ================================================================================================================ KC5. PERSISTANCE DES LIENS ET DÉCISIONS
test('KC5. liens additifs : énoncé.idMessage et trace.idMessage seulement quand fournis ; décision confirmée portant une règle : acte déclaré, identité exacte, ni Action ni refus avec règle', async () => {
  const w = await monde();
  const sans = await C.enregistrerEnonceSurTrace(w.magasin, { idTrace: 'trace-x', texte: 'bonjour' });
  assert.equal(Object.hasOwn(sans, 'idMessage'), false);
  await assert.rejects(() => C.enregistrerEnonceSurTrace(w.magasin, { idTrace: 'trace-x', texte: 'bonjour', idMessage: '' }), /idMessage/);
  const tr = await C.enregistrerTrace(w.magasin, { capacite: 'recherche', voie: 'action', argumentsUtilises: {}, provenanceArguments: {}, resultat: {} });
  assert.equal(Object.hasOwn(tr, 'idMessage'), false);
  const M = await recevoir(w.magasin, "Non, c'est Zoé.");
  const N2 = await recevoir(w.magasin, "Non, c'est Max.");
  const base = { idCandidat: identiteRegle(REGLE), decision: 'confirmee', sources: [M.id, N2.id] };
  await assert.rejects(() => C.enregistrerDecisionForme(w.magasin, { ...base, regle: { ...REGLE, operation: 'recherche' } }), /acte pédagogique déclaré/);
  await assert.rejects(() => C.enregistrerDecisionForme(w.magasin, { ...base, regle: { ...REGLE, n: 6 } }), /identité/);
  await assert.rejects(() => C.enregistrerDecisionForme(w.magasin, { ...base, regle: REGLE, idAction: 'a' }), /aucune Action/);
  await assert.rejects(() => C.enregistrerDecisionForme(w.magasin, { ...base, decision: 'refusee', regle: REGLE }), /aucune règle/);
  assert.deepEqual(await C.enregistrerDecisionForme(w.magasin, { ...base, regle: REGLE }), { ...base, sources: [M.id, N2.id].sort(), regle: REGLE });
  await assert.rejects(() => C.enregistrerDecisionForme(w.magasin, { ...base, regle: REGLE }), /immuable/);
  assert.equal(C.VERSION_BASE, 27, 'aucune table ajoutée');
});

// ================================================================================================================ KC6. NON-RÉGRESSIONS (M, N, O) ET RACCORDS
test('KC6. v0.64.19 inchangée pour les questions naturelles ; noyau partagé ; main.js : correction examinée seulement en réaction identifiée, AVANT les actions, aperçu puis écriture dans onOui seulement', async () => {
  // N/M : apprentissage d'une forme de question par « Apprends : Réponse » toujours identique
  const w = await monde();
  const q1 = await recevoir(w.magasin, 'Qui a pour surnom Puce ?');
  const l1 = await recevoir(w.magasin, 'Apprends : Réponse : Léa.');
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: q1.id, reponse: 'Léa', idLecon: l1.id });
  assert.deepEqual(await R.examinerReponseApresSupervision(w.magasin, w.e, q1.id), { raison: 'insuffisant' });
  assert.deepEqual(await K.examinerCorrectionApresSupervision(w.magasin, q1.id), { raison: 'hors-situation' }, 'une question naturelle n\'est pas une correction');
  // noyau
  assert.match(lu('app', 'langage', 'reponses-attendues.js'), /from '\.\/explication-supervisee\.js'/);
  assert.match(lu('app', 'langage', 'corrections-apprises.js'), /from '\.\/explication-supervisee\.js'/);
  assert.equal(typeof N.retenirExplication, 'function');
  // raccords main.js
  const main = sansCommentaires(lu('app', 'main.js'));
  const corps = main.slice(main.indexOf('async function traiterTour('));
  const iCorr = corps.indexOf('correction = await reconnaitreCorrection(e.magasin, { idMessage: message.id, texte });');
  const iAction = corps.indexOf('const reconnaissanceAction = await ecranLangage.tenterReconnaissanceAction(texte, ');
  assert.ok(iCorr > 0 && iCorr < iAction, 'correction avant les actions');
  assert.match(corps, /if \(referenceTrace && message && typeof message\.id === 'string' && message\.id\.length > 0\) \{/);
  const def = main.slice(main.indexOf('function proposerReponseCorrigee('), main.indexOf('async function traiterTour('));
  const oui = def.slice(def.indexOf('onOui:'), def.indexOf('onNon:'));
  assert.match(oui, /await enregistrerReponseAttendue\(e\.magasin, \{ idMessage: correction\.idQuestion, reponse: correction\.reponse, idLecon: message\.id \}\);/);
  assert.doesNotMatch(def.slice(def.indexOf('onNon:')), /enregistrer|apprendre|confirmer/i, 'I : Annuler n\'écrit rien');
  assert.doesNotMatch(def, /apprendreFait|oublierFait|apprendreAction|ecrireConnaissance/, 'P : jamais de fait');
  assert.match(main, /propositionQuestion = \(await propositionDeReponse\(reference\.idMessage\)\) \|\| \(await propositionDeCorrection\(reference\.idMessage\)\);/);
  assert.match(main, /enregistrerEnonce: \(idTrace, texteEnonce, idMessageEnonce\) => ecranLangage\.enregistrerEnonceSurTrace\(idTrace, texteEnonce, idMessageEnonce\),/);
  const pont = sansCommentaires(lu('app', 'langage', 'pont.js'));
  assert.match(pont, /capturerEnonceAvantTraitement\(texte, referenceTrace, \{ enregistrerEnonce \}, message !== null && valeurConservee \? message\.id : undefined\)/);
});
