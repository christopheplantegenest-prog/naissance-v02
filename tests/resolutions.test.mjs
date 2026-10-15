// v0.64.24 — « PROPOSER LA RÉSOLUTION D'UNE INCOMPATIBILITÉ VÉCUE » (GO ChatGPT « v0.64.24 », 15/10/2026).
// Vues pures resolutions.js (examen, états historique / actif / résolu / résultat actuel, note) ; voie de manifestation 'resolution' ; raccords de
// main.js (non importable) gardés statiquement et rejoués ici avec les mêmes primitives, dans le même ordre. Lettres A–X du GO.
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
const RS = await import('../app/langage/resolutions.js');
const S = await import('../app/memoire/sauvegarde.js');
const { formesSupervisees } = await import('../app/langage/formes-supervisees.js');
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

const COULEUR = [['moi', 'couleur', 'bleu'], ['moi', 'vélo', 'Fusée'], ['moi', 'chien', 'Rex'], ['Hugo', 'chien', 'Rex']];
const lignes = (w) => C.lireLignesDivergences(w.magasin);
const instantane = async (w) => { const o = {}; for (const t of C.TABLES) o[t] = JSON.stringify(await w.magasin.lireTout(t)); return o; };
// « ma couleur ? » → réponse locale ; Répondre « Non, c'est X. » → correction comprise → Confirmer (onOui .20 : réponse attendue écrite) → EXAMEN
// (exactement ce que fait main.js juste après l'écriture). Rend { Q, E, examen }.
async function corrigerCouleur(w, valeur) {
  const R = await repondreLocal(w, 'ma couleur ?');
  const { E: E2, c } = await corrigerSur(w, cibleRepondre(R.r), valeur);
  const e = await E.chargerEsprit(w.magasin);
  return { R, E: E2, c, examen: RS.examinerResolution(await lignes(w), e, c.idQuestion) };
}
// Confirmer de la proposition, rejoué dans l'ordre exact de main.js : examen refait + même proposition, puis resoudreIncompatibilite (fait +
// manifestation de résolution en UNE écriture atomique, ou rien).
const manifestationDe = (p) => ({ idMessage: p.idMessage, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } });
async function confirmer(w, p, { esprit = null } = {}) {
  const e = esprit || await E.chargerEsprit(w.magasin);
  const examen = RS.examinerResolution(await lignes(w), e, p.idReponseAttendue);
  if (!examen.proposition || !RS.memeProposition(examen.proposition, p)) return { perimee: true };
  await E.resoudreIncompatibilite(e, { fait: { ...p.nouveau }, manifestation: manifestationDe(p) });
  return { perimee: false };
}
async function valeurCourante(w, sujet, relation) { const e = await E.chargerEsprit(w.magasin); const f = e.faits.get(C.cleFait(sujet, relation)); return f ? f.valeur : null; }
async function etats(w) { return RS.etatsDivergences(await lignes(w), await E.chargerEsprit(w.magasin)); }
const resolutions = async (w) => (await w.magasin.lireTout('manifestationsFaits')).filter((m) => m.voie.nom === 'resolution');

// ================================================================================================================ A/B/C/R. PROPOSITION, ANNULER
test('A/R. correction incompatible sur un appui actuel → proposition structurée (identités, ancien, nouveau) ; l\'examen n\'écrit rien', async () => {
  const w = await monde(COULEUR);
  const R = await repondreLocal(w, 'ma couleur ?');
  assert.equal(R.r.texte, 'bleu');
  const { E: E2, c } = await corrigerSur(w, cibleRepondre(R.r), 'vert');
  const avant = await instantane(w);
  const examen = RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion);
  assert.deepEqual(examen, { proposition: { idReponseAttendue: R.Q.id, idMessage: E2.id, question: 'ma couleur ?', ancien: { sujet: 'moi', relation: 'couleur', valeur: 'bleu' }, nouveau: { sujet: 'moi', relation: 'couleur', valeur: 'vert' } } });
  assert.deepEqual(await instantane(w), avant, 'R : aucune écriture avant Confirmer');
});

test('B/C. Annuler : rien n\'est écrit (ancien fait intact, aucune manifestation, aucune marque) ; une nouvelle correction est un nouvel événement → nouvelle proposition', async () => {
  const w = await monde(COULEUR);
  const a = await corrigerCouleur(w, 'vert');
  assert.ok(a.examen.proposition);
  // Annuler = ne rien appeler (onNon de main.js ne fait que journaliser : garde statique ci-dessous)
  assert.equal(await valeurCourante(w, 'moi', 'couleur'), 'bleu');
  assert.deepEqual(await resolutions(w), []);
  const b = await corrigerCouleur(w, 'vert');
  assert.ok(b.examen.proposition, 'nouvelle D, nouvelle proposition');
  assert.notEqual(b.examen.proposition.idReponseAttendue, a.examen.proposition.idReponseAttendue);
  const main = sansCommentaires(lu('app', 'main.js'));
  const def = main.slice(main.indexOf('function proposerResolution('), main.indexOf('function proposerReponseCorrigee('));
  const non = def.slice(def.indexOf('onNon:'));
  assert.doesNotMatch(non, /ecrireConnaissance|enregistrer|apprendre|oublier|decision/i, 'Annuler n\'écrit rien de cognitif');
});

// ================================================================================================================ D/T/U. CONFIRMER, MANIFESTATION
test('D/T. Confirmer : remplacement exact sous cleFait + manifestation nommant D ; résolution répétée impossible pour la même D', async () => {
  const w = await monde(COULEUR);
  const { examen, R, E: E2 } = await corrigerCouleur(w, 'vert');
  assert.deepEqual(await confirmer(w, examen.proposition), { perimee: false });
  assert.equal(await valeurCourante(w, 'moi', 'couleur'), 'vert');
  assert.equal((await w.magasin.lireTout('faits')).filter((f) => C.cleFait(f.sujet, f.relation) === C.cleFait('moi', 'couleur')).length, 1, 'remplacement en place, aucun conflit');
  assert.deepEqual(await resolutions(w), [{ idMessage: E2.id, fait: { sujet: 'moi', relation: 'couleur', valeur: 'vert' }, voie: { nom: 'resolution', idReponseAttendue: R.Q.id } }]);
  const [etat] = (await etats(w)).filter((x) => x.idReponseAttendue === R.Q.id);
  assert.deepEqual(etat, { idReponseAttendue: R.Q.id, historique: true, active: false, resolue: true, resultatActuel: true });
  // T : la même D ne peut plus proposer ni être résolue une seconde fois
  assert.deepEqual(RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), R.Q.id), { raison: 'deja-resolue' });
  await assert.rejects(() => C.enregistrerManifestationFait(w.magasin, { idMessage: E2.id, fait: { sujet: 'moi', relation: 'couleur', valeur: 'vert' }, voie: { nom: 'resolution', idReponseAttendue: R.Q.id } }), /déjà sa manifestation/);
});

test('T/U. contrat de la voie resolution : réponse attendue existante, établie par CE message, valeur exacte, message réactif, unique par D ; champ interdit ailleurs ; anciennes voies intactes', async () => {
  const w = await monde(COULEUR);
  const { R, E: E2 } = await corrigerCouleur(w, 'vert');
  const autre = await recevoir(w.magasin, 'autre message');
  const base = { idMessage: E2.id, fait: { sujet: 'moi', relation: 'couleur', valeur: 'vert' }, voie: { nom: 'resolution', idReponseAttendue: R.Q.id } };
  await assert.rejects(() => C.enregistrerManifestationFait(w.magasin, { ...base, voie: { nom: 'resolution' } }), /idReponseAttendue/);
  await assert.rejects(() => C.enregistrerManifestationFait(w.magasin, { ...base, voie: { nom: 'resolution', idReponseAttendue: 'message-inconnu' } }), /aucune réponse attendue/);
  await assert.rejects(() => C.enregistrerManifestationFait(w.magasin, { ...base, idMessage: autre.id }), /établie par ce message/);
  await assert.rejects(() => C.enregistrerManifestationFait(w.magasin, { ...base, fait: { ...base.fait, valeur: 'Vert' } }), /exactement la réponse attendue/);
  await assert.rejects(() => C.enregistrerManifestationFait(w.magasin, { ...base, voie: { nom: 'j1a', idReponseAttendue: R.Q.id } }), /n'appartient qu'à la voie resolution/);
  assert.deepEqual([...C.VOIES_MANIFESTATION], ['j1a', 'apprends-que', 'lecon-technique', 'forme-apprise', 'reference-explicite', 'resolution']);
  const j = await recevoir(w.magasin, 'Ma couleur est rose.');
  assert.deepEqual(await C.enregistrerManifestationFait(w.magasin, { idMessage: j.id, fait: { sujet: 'moi', relation: 'couleur', valeur: 'rose' }, voie: { nom: 'j1a' } }), { idMessage: j.id, fait: { sujet: 'moi', relation: 'couleur', valeur: 'rose' }, voie: { nom: 'j1a' } });
});

// ================================================================================================================ E/F/G/H/N/X. ABSTENTIONS
test('E/X. Bob (projection sujet, portée indéterminée) → aucune proposition ; le témoin Fusée / Bob / Éclair reste intact', async () => {
  const w = await monde(COULEUR);
  const A = await demander(w, 'Qui a pour vélo Fusée ?');
  const { c } = await corrigerSur(w, { idTrace: A.reco.idTrace }, 'Bob');
  assert.deepEqual(RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion), { raison: 'portee-indeterminee' });
  const A2 = await demander(w, 'Qui a pour vélo Fusée ?');
  const { c: c2 } = await corrigerSur(w, cibleAction(A2.reco), 'Bob');
  assert.deepEqual(RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c2.idQuestion), { raison: 'portee-indeterminee' }, 'même après plusieurs corrections : aucune fréquence');
  const B = await repondreLocal(w, 'mon vélo ?');
  await corrigerSur(w, cibleRepondre(B.r), 'Éclair');
  assert.equal(await valeurCourante(w, 'moi', 'vélo'), 'Fusée');
  assert.ok((await etats(w)).every((x) => x.resolue === false));
  assert.deepEqual(await resolutions(w), []);
});

test('F. pluralité causale ([moi, Hugo], attendu Hugo) → aucune proposition (aucun appui choisi)', async () => {
  const w = await monde(COULEUR);
  const A = await demander(w, 'Qui a pour chien Rex ?');
  const { c } = await corrigerSur(w, cibleAction(A.reco), 'Hugo');
  const ex = RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion);
  assert.ok(ex.raison === 'pluralite-causale' || ex.raison === 'portee-indeterminee', ex.raison);
  assert.equal(ex.proposition, undefined);
});

test('G/H. attendu canoniquement égal → aucune divergence ; appui déjà non actuel avant l\'examen → aucune proposition ; identité en conflit → abstention', async () => {
  const w = await monde(COULEUR);
  const g = await corrigerCouleur(w, 'BLEU');
  assert.deepEqual(g.examen, { raison: 'aucune-divergence' });
  const R = await repondreLocal(w, 'ma couleur ?');
  const { c } = await corrigerSur(w, cibleRepondre(R.r), 'vert');
  const e = await E.chargerEsprit(w.magasin);
  await E.oublierFait(e, { sujet: 'moi', relation: 'couleur' });
  await E.apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'jaune', origine: 'apprise-conversation' });
  assert.deepEqual(RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion), { raison: 'appui-non-actuel' });
  await w.magasin.ecrire('faits', { cle: 'moi|couleur-bis', sujet: 'moi', relation: 'couleur', valeur: 'bleu' });
  assert.deepEqual(RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion), { raison: 'identite-absente-ou-en-conflit' });
});

test('N. échafaudage « Apprends : Réponse » : exclu du déclenchement (seul l\'onOui de la correction comprise .20 examine une résolution)', () => {
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.equal((main.match(/examinerResolution\(/g) || []).length, 2, 'proposition (onOui de la correction) + péremption (onOui de la proposition)');
  const corr = main.slice(main.indexOf('function proposerReponseCorrigee('), main.indexOf('async function traiterTour('));
  const oui = corr.slice(corr.indexOf('onOui:'), corr.indexOf('onNon:'));
  const iEcrit = oui.indexOf('await enregistrerReponseAttendue(e.magasin, { idMessage: correction.idQuestion, reponse: correction.reponse, idLecon: message.id });');
  const iExamen = oui.indexOf('const examen = examinerResolution(await lireLignesDivergences(e.magasin), e, correction.idQuestion);');
  assert.ok(iEcrit > 0 && iExamen > iEcrit, 'examen APRÈS l\'écriture réelle de la réponse attendue');
  assert.match(oui, /return resolution \? \{ texte: reponseFinale, proposition: resolution \} : reponseFinale;/);
  const attendue = main.slice(main.indexOf('function proposerReponseAttendue('), main.indexOf('async function propositionDeReponse('));
  assert.ok(attendue.length > 0);
  assert.doesNotMatch(attendue, /examinerResolution|proposerResolution/);
  assert.equal((main.match(/proposerResolution\(/g) || []).length, 2, 'définition + un seul site');
});

// ================================================================================================================ I/S. PÉREMPTION ET ATOMICITÉ
test('I. proposition périmée entre affichage et Confirmer : V3 reste, V2 n\'est pas écrit, aucune manifestation', async () => {
  const w = await monde(COULEUR);
  const { examen } = await corrigerCouleur(w, 'vert');
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'rouge', origine: 'apprise-conversation' });
  const avant = await instantane(w);
  assert.deepEqual(await confirmer(w, examen.proposition), { perimee: true });
  assert.equal(await valeurCourante(w, 'moi', 'couleur'), 'rouge');
  assert.deepEqual(await instantane(w), avant, 'zéro écriture');
  const main = sansCommentaires(lu('app', 'main.js'));
  const def = main.slice(main.indexOf('function proposerResolution('), main.indexOf('function proposerReponseCorrigee('));
  const oui = def.slice(def.indexOf('onOui:'), def.indexOf('onNon:'));
  const iGarde = oui.indexOf('if (!examen.proposition || !memeProposition(examen.proposition, p)) {');
  const iResolution = oui.indexOf("await resoudreIncompatibilite(e, { fait: { ...p.nouveau }, manifestation: { idMessage: p.idMessage, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } } });");
  assert.ok(iGarde > 0 && iGarde < iResolution, 'garde de péremption → écriture atomique');
  assert.doesNotMatch(oui, /ecrireConnaissance|apprendreFait|enregistrerManifestationFait/, 'aucune écriture séparée du fait ou de la manifestation');
  assert.match(oui, /reponseFinale = `Je n'ai rien modifié : \$\{err\.message\}`;/);
  assert.match(oui, /n'est plus valable : ce que je sais sous \$\{p\.ancien\.sujet\} → \$\{p\.ancien\.relation\} a changé depuis\. Je n'ai rien modifié\./);
});

// ================================================================================================================ ATOMICITÉ (STOP avant dépôt)
async function propositionCouleur() {
  const w = await monde(COULEUR);
  const { examen, E: E2, c } = await corrigerCouleur(w, 'vert');
  assert.ok(examen.proposition);
  return { w, p: examen.proposition, E: E2, c };
}
const ligneCouleur = async (w) => JSON.stringify((await w.magasin.lireTout('faits')).filter((f) => C.cleFait(f.sujet, f.relation) === C.cleFait('moi', 'couleur')));

test('S/ATOM-1. chaque garde de la manifestation est vérifiée AVANT toute écriture : si elle refuse, le fait ancien reste strictement inchangé', async () => {
  const cas = [
    ['E possède déjà une manifestation', async ({ w, E: E2 }) => { await C.enregistrerManifestationFait(w.magasin, { idMessage: E2.id, fait: { sujet: 'moi', relation: 'couleur', valeur: 'rose' }, voie: { nom: 'j1a' } }); }, /déjà sa manifestation/, (p) => p],
    ['Q possède déjà une résolution', async ({ w }) => { const autre = await corrigerCouleur(w, 'vert'); await w.magasin.ecrire('manifestationsFaits', { idMessage: 'message-x', fait: { sujet: 'moi', relation: 'couleur', valeur: 'vert' }, voie: { nom: 'resolution', idReponseAttendue: autre.c.idQuestion } }); return autre; }, /déjà sa résolution/, (p, autre) => ({ ...p, idReponseAttendue: autre.c.idQuestion, idMessage: autre.E.id })],
    ['Q inexistante', async () => {}, /aucune réponse attendue/, (p) => ({ ...p, idReponseAttendue: 'message-inconnu' })],
    ['Q.idLecon ≠ E', async ({ w }) => recevoir(w.magasin, 'message sans rapport'), /établie par ce message/, (p, m) => ({ ...p, idMessage: m.id })],
    ['valeur ≠ Q.reponse', async () => {}, /exactement la réponse attendue/, (p) => ({ ...p, nouveau: { ...p.nouveau, valeur: 'VERT' } })],
    ['énoncé de E absent', async ({ w, E: E2 }) => { for (const x of await w.magasin.lireTout('enonces')) if (x.idMessage === E2.id) await w.magasin.supprimer('enonces', x.id); }, /réaction à aucune production/, (p) => p],
    ['voie invalide', async () => {}, /voie\.nom inconnue|n'appartient qu'à la voie resolution/, (p) => ({ ...p, voieForcee: { nom: 'inconnue', idReponseAttendue: p.idReponseAttendue } })],
  ];
  for (const [nom, preparer, motif, modifier] of cas) {
    const ctx = await propositionCouleur();
    const extra = await preparer(ctx);
    const p = modifier(ctx.p, extra);
    const avantFait = await ligneCouleur(ctx.w);
    const avantResolutions = JSON.stringify(await resolutions(ctx.w));
    const e = await E.chargerEsprit(ctx.w.magasin);
    const man = p.voieForcee ? { idMessage: p.idMessage, voie: p.voieForcee } : manifestationDe(p);
    await assert.rejects(() => E.resoudreIncompatibilite(e, { fait: { ...p.nouveau }, manifestation: man }), motif, nom);
    assert.equal(await ligneCouleur(ctx.w), avantFait, `${nom} : fait ancien strictement inchangé`);
    assert.equal(e.faits.get(C.cleFait('moi', 'couleur')).valeur, 'bleu', `${nom} : esprit en mémoire inchangé`);
    assert.equal(JSON.stringify(await resolutions(ctx.w)), avantResolutions, `${nom} : aucune manifestation`);
  }
});

test('ATOM-2. chemin positif : préconditions admises → fait remplacé ET manifestation nécessairement présente (même écriture) ; esprit mis à jour après', async () => {
  const { w, p, E: E2 } = await propositionCouleur();
  const e = await E.chargerEsprit(w.magasin);
  const r = await E.resoudreIncompatibilite(e, { fait: { ...p.nouveau }, manifestation: manifestationDe(p) });
  assert.equal(r.objet.valeur, 'vert');
  assert.deepEqual(r.manifestation, { idMessage: E2.id, fait: { sujet: 'moi', relation: 'couleur', valeur: 'vert' }, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } });
  assert.equal(await valeurCourante(w, 'moi', 'couleur'), 'vert');
  assert.equal(e.faits.get(C.cleFait('moi', 'couleur')).valeur, 'vert');
  assert.deepEqual(await resolutions(w), [r.manifestation]);
});

test('ATOM-3. pendant l\'écriture : ligne du fait changée sous l\'esprit (compare-and-set) ou clé de manifestation prise → refus, RIEN n\'est écrit ; magasin sans écriture atomique → refus avant toute écriture', async () => {
  // a) la ligne du fait a changé dans le magasin après la lecture de l'esprit (écriture concurrente)
  let ctx = await propositionCouleur();
  let e = await E.chargerEsprit(ctx.w.magasin);
  const ligne = (await ctx.w.magasin.lireTout('faits')).find((f) => C.cleFait(f.sujet, f.relation) === C.cleFait('moi', 'couleur'));
  await ctx.w.magasin.ecrire('faits', { ...ligne, valeur: 'jaune' });
  await assert.rejects(() => E.resoudreIncompatibilite(e, { fait: { ...ctx.p.nouveau }, manifestation: manifestationDe(ctx.p) }), /a changé/);
  assert.equal(await valeurCourante(ctx.w, 'moi', 'couleur'), 'jaune');
  assert.deepEqual(await resolutions(ctx.w), []);
  // b) la clé de la manifestation est prise entre la préparation et l'écriture : simulé par un magasin dont la lecture omet cette ligne
  ctx = await propositionCouleur();
  e = await E.chargerEsprit(ctx.w.magasin);
  const vrai = ctx.w.magasin;
  const cache = { ...vrai, lireTout: async (t) => (t === 'manifestationsFaits' ? [] : vrai.lireTout(t)), ecrireAtomique: vrai.ecrireAtomique };
  await vrai.ecrire('manifestationsFaits', { idMessage: ctx.E.id, fait: { sujet: 'moi', relation: 'couleur', valeur: 'rose' }, voie: { nom: 'j1a' } });
  e.magasin = cache;
  await assert.rejects(() => E.resoudreIncompatibilite(e, { fait: { ...ctx.p.nouveau }, manifestation: manifestationDe(ctx.p) }), /existe déjà/);
  assert.equal(await valeurCourante(ctx.w, 'moi', 'couleur'), 'bleu');
  // c) magasin sans ecrireAtomique : refus avant toute écriture
  ctx = await propositionCouleur();
  e = await E.chargerEsprit(ctx.w.magasin);
  e.magasin = { ...ctx.w.magasin, ecrireAtomique: undefined };
  await assert.rejects(() => E.resoudreIncompatibilite(e, { fait: { ...ctx.p.nouveau }, manifestation: manifestationDe(ctx.p) }), /atomique indisponible/);
  assert.equal(await valeurCourante(ctx.w, 'moi', 'couleur'), 'bleu');
});

test('ATOM-4. version IndexedDB : une seule transaction (lectures, vérification, puis écritures) ; refus = abort, rien d\'écrit (fausse IndexedDB minimale)', async () => {
  const lignes = { faits: new Map([['moi|couleur', { cle: 'moi|couleur', sujet: 'moi', relation: 'couleur', valeur: 'bleu' }]]), manifestationsFaits: new Map() };
  const transactions = [];
  const db = {
    objectStoreNames: { contains: () => true }, close() {},
    transaction(tables) {
      const tx = { tables, ecrits: [], aborte: false, oncomplete: null, onerror: null, onabort: null, attentes: 0,
        abort() { tx.aborte = true; queueMicrotask(() => tx.onabort && tx.onabort()); },
        finir() { if (tx.attentes === 0 && !tx.aborte) queueMicrotask(() => { if (tx.aborte) return; for (const [t, o] of tx.ecrits) lignes[t].set(o[t === 'faits' ? 'cle' : 'idMessage'], o); tx.oncomplete && tx.oncomplete(); }); },
        objectStore(t) {
          return {
            get(cle) { const r = { result: undefined, onsuccess: null }; tx.attentes += 1; queueMicrotask(() => { r.result = lignes[t].get(cle); tx.attentes -= 1; r.onsuccess && r.onsuccess(); tx.finir(); }); return r; },
            put(o) { tx.ecrits.push([t, o]); },
          };
        } };
      transactions.push(tx);
      return tx;
    },
  };
  const fabrique = { open() { const r = { result: db }; queueMicrotask(() => { r.onupgradeneeded && r.onupgradeneeded(); r.onsuccess(); }); return r; } };
  const magasin = await C.ouvrirIndexedDB(fabrique);
  const nouveau = { cle: 'moi|couleur', sujet: 'moi', relation: 'couleur', valeur: 'vert' };
  const man = { idMessage: 'message-1', fait: { sujet: 'moi', relation: 'couleur', valeur: 'vert' }, voie: { nom: 'resolution', idReponseAttendue: 'q' } };
  // refus : la ligne a changé → abort, rien d'écrit
  await assert.rejects(() => magasin.ecrireAtomique([{ table: 'faits', objet: nouveau, mode: 'remplacement', avant: { cle: 'moi|couleur', sujet: 'moi', relation: 'couleur', valeur: 'rouge' } }, { table: 'manifestationsFaits', objet: man, mode: 'ajout' }]), /a changé/);
  assert.equal(lignes.faits.get('moi|couleur').valeur, 'bleu'); assert.equal(lignes.manifestationsFaits.size, 0);
  // succès : une seule transaction sur les deux tables, les deux lignes écrites
  await magasin.ecrireAtomique([{ table: 'faits', objet: nouveau, mode: 'remplacement', avant: { sujet: 'moi', cle: 'moi|couleur', relation: 'couleur', valeur: 'bleu' } }, { table: 'manifestationsFaits', objet: man, mode: 'ajout' }]);
  assert.deepEqual(transactions.at(-1).tables, ['faits', 'manifestationsFaits']);
  assert.equal(lignes.faits.get('moi|couleur').valeur, 'vert'); assert.deepEqual(lignes.manifestationsFaits.get('message-1'), man);
  // refus : clé de manifestation déjà prise → rien d'écrit (pas même le fait)
  await assert.rejects(() => magasin.ecrireAtomique([{ table: 'faits', objet: { ...nouveau, valeur: 'noir' }, mode: 'remplacement', avant: nouveau }, { table: 'manifestationsFaits', objet: man, mode: 'ajout' }]), /existe déjà/);
  assert.equal(lignes.faits.get('moi|couleur').valeur, 'vert');
});

test('ATOM-5. garde contre une évolution future : enregistrerManifestationFait = preparerManifestationFait + écriture, sans aucune condition hors de la préparation ; resoudreIncompatibilite prépare avant l\'unique écriture atomique', () => {
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  const debut = conn.indexOf('export async function enregistrerManifestationFait(');
  const corps = conn.slice(debut, conn.indexOf('\n}\n', debut) + 2);
  assert.equal(corps, "export async function enregistrerManifestationFait(magasin, entree) {\n  const objet = await preparerManifestationFait(magasin, entree);\n  await magasin.ecrire('manifestationsFaits', objet);\n  return { idMessage: objet.idMessage, fait: { ...objet.fait }, voie: { ...objet.voie } };\n}");
  const prep = conn.slice(conn.indexOf('export async function preparerManifestationFait('), conn.indexOf('export async function preparerManifestationFait(') + 6000);
  assert.doesNotMatch(prep.slice(0, prep.indexOf('\n}\n')), /\.ecrire\(|\.supprimer\(/, 'la préparation n\'écrit rien');
  const esp = sansCommentaires(lu('app', 'langage', 'esprit.js'));
  const r = esp.slice(esp.indexOf('export async function resoudreIncompatibilite('));
  const corpsR = r.slice(0, r.indexOf('\n}\n'));
  const iFait = corpsR.indexOf('preparerFait(esprit');
  const iMan = corpsR.indexOf('await preparerManifestationFait(esprit.magasin');
  const iEcr = corpsR.indexOf('await esprit.magasin.ecrireAtomique([');
  const iApp = corpsR.indexOf('appliquerFait(esprit, id, objet);');
  assert.ok(iFait > 0 && iFait < iMan && iMan < iEcr && iEcr < iApp, 'préparations → une écriture atomique → mémoire');
  assert.equal((corpsR.match(/\.ecrire\(|ecrireAtomique\(/g) || []).length, 1, 'une seule écriture');
  // apprendreFait : même préparation, même application (comportement inchangé)
  const a = esp.slice(esp.indexOf('export async function apprendreFait('));
  assert.match(a.slice(0, a.indexOf('\n}\n')), /const \{ id, objet \} = preparerFait\(esprit, \{ sujet, relation, valeur, origine \}\);\n  await esprit\.magasin\.ecrire\('faits', objet\);\n  appliquerFait\(esprit, id, objet\);/);
});

// ================================================================================================================ J/K/L/M. ÉTATS DISTINCTS
test('J. un autre apprentissage vers la valeur attendue : D non active, NON résolue', async () => {
  const w = await monde(COULEUR);
  const { c } = await corrigerCouleur(w, 'vert');
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'vert', origine: 'apprise-conversation' });
  const [x] = (await etats(w)).filter((y) => y.idReponseAttendue === c.idQuestion);
  assert.deepEqual(x, { idReponseAttendue: c.idQuestion, historique: true, active: false, resolue: false, resultatActuel: false });
  assert.deepEqual(RS.notesResolution([{ sujet: 'moi', relation: 'couleur', valeur: 'vert' }], await lignes(w)), [], 'jamais « résolu » sans manifestation');
});

test('K. D1 (vert, annulée) et D2 (rouge, confirmée) : seule D2 est résolue ; D1 devient non active sans être résolue', async () => {
  const w = await monde(COULEUR);
  const d1 = await corrigerCouleur(w, 'vert');
  const d2 = await corrigerCouleur(w, 'rouge');
  assert.ok(d1.examen.proposition && d2.examen.proposition);
  await confirmer(w, d2.examen.proposition);
  const es = await etats(w);
  assert.deepEqual(es.find((x) => x.idReponseAttendue === d1.c.idQuestion), { idReponseAttendue: d1.c.idQuestion, historique: true, active: false, resolue: false, resultatActuel: false });
  assert.deepEqual(es.find((x) => x.idReponseAttendue === d2.c.idQuestion), { idReponseAttendue: d2.c.idQuestion, historique: true, active: false, resolue: true, resultatActuel: true });
  // la proposition D1 encore affichée serait périmée
  assert.deepEqual(await confirmer(w, d1.examen.proposition), { perimee: true });
});

test('L/M. résolution puis remplacement ultérieur : résolution historique conservée, résultat plus actuel ; redémarrage : lien relu à l\'identique ; note seulement pour le fait résultant actuel', async () => {
  let w = await monde(COULEUR);
  const { examen } = await corrigerCouleur(w, 'vert');
  await confirmer(w, examen.proposition);
  const NOTE = 'Ce que je sais ici (moi → couleur → vert) a remplacé bleu quand tu as confirmé la résolution de ta correction de « ma couleur ? ».';
  assert.deepEqual(RS.notesResolution([{ sujet: 'moi', relation: 'couleur', valeur: 'vert' }], await lignes(w)), [NOTE]);
  // la vraie voie repondre rend bien cet appui actuel
  const apres = await repondreLocal(w, 'ma couleur ?');
  assert.equal(apres.r.texte, 'vert');
  assert.deepEqual(RS.notesResolution(apres.r.appuis, await lignes(w)), [NOTE]);
  w = await redemarrer(w);
  assert.deepEqual(RS.notesResolution([{ sujet: 'moi', relation: 'couleur', valeur: 'vert' }], await lignes(w)), [NOTE], 'M : lien persisté');
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'couleur', valeur: 'jaune', origine: 'apprise-conversation' });
  const [x] = (await etats(w)).filter((y) => y.resolue);
  assert.equal(x.resultatActuel, false);
  assert.equal((await resolutions(w)).length, 1, 'la résolution historique reste');
  assert.deepEqual(RS.notesResolution([{ sujet: 'moi', relation: 'couleur', valeur: 'jaune' }], await lignes(w)), []);
});

// ================================================================================================================ O/P/Q/V/W
test('O. non-contamination : une manifestation de résolution n\'entre pas dans formes-supervisees (« Non, c\'est vert. » n\'est jamais un exemple de forme de fait)', async () => {
  const w = await monde(COULEUR);
  const { examen } = await corrigerCouleur(w, 'vert');
  const avant = formesSupervisees(await w.magasin.lireTout('manifestationsFaits'), await w.magasin.lireTout('valeursDonnees'));
  await confirmer(w, examen.proposition);
  const apres = formesSupervisees(await w.magasin.lireTout('manifestationsFaits'), await w.magasin.lireTout('valeursDonnees'));
  assert.deepEqual(apres, avant);
});

test('P. invariant d\'identité : au plus une divergence par réponse attendue (clé = question) ; Q. aucune reconstruction depuis le texte ; V/W. versions inchangées, aucun score', async () => {
  const w = await monde(COULEUR);
  await corrigerCouleur(w, 'vert'); await corrigerCouleur(w, 'rouge');
  const A = await demander(w, 'Qui a pour vélo Fusée ?'); await corrigerSur(w, cibleAction(A.reco), 'Bob');
  const ids = D.divergencesDeReponses(await lignes(w)).map((d) => d.idReponseAttendue);
  assert.equal(ids.length, 3); assert.equal(new Set(ids).size, ids.length);
  assert.equal(C.CLE.reponsesAttendues, 'idMessage');
  const vue = sansCommentaires(lu('app', 'langage', 'resolutions.js'));
  assert.doesNotMatch(vue, /texteMontre|\.texte\b|lireTout|ecrire|enregistrer|apprendre|oublier|Date|Math\.random/, 'pure ; aucune lecture de texte affiché');
  assert.doesNotMatch(vue, /score|poids|confiance|probab|majorit|fr[ée]quence|compte/i);
  assert.equal(C.VERSION_BASE, 28); assert.equal(S.SCHEMA_SAUVEGARDE, 18); assert.equal(C.TABLES.length, 34);
});
