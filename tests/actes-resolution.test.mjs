// v0.64.25 — « LA PROPOSITION DE RÉSOLUTION DEVIENT UN ACTE VÉCU » (GO ChatGPT « v0.64.25 N3a », 15/10/2026).
// Table append-only actesResolution (proposition + issue, identités dérivées de Q), création AVANT affichage, Annuler = issue annulee seule,
// péremption constatée au clic = issue perimee + raison, Confirmer = fait + manifestation + issue confirmee en UNE écriture atomique ; vue pure
// actesDeResolution ; notes (une seule ligne pour un acte confirmé, note .24 inchangée sans acte) ; non-contamination. main.js n'est pas
// importable : ses raccords sont gardés statiquement et rejoués ici avec les mêmes primitives, dans le même ordre. Lettres A–T de la conception.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const P = await import('../app/langage/pont.js');
const E = await import('../app/langage/esprit.js');
const K = await import('../app/langage/corrections-apprises.js');
const RS = await import('../app/langage/resolutions.js');
const S = await import('../app/memoire/sauvegarde.js');
const { formesSupervisees } = await import('../app/langage/formes-supervisees.js');
const { identiteRegle } = await import('../app/langage/regle-forme.js');
const { monterEcranLangage } = await import('../app/langage/ecran.js');

const RACINE = new URL('..', import.meta.url).pathname;
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '').replace(/\/\*.*?\*\//g, '')).join('\n');
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
const ecranSur = (magasin) => monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
const REGLE_CORRECTION = { operation: 'reponseAttendue', n: 5, ancres: [{ position: 0, jeton: 'Non' }, { position: 1, jeton: ',' }, { position: 2, jeton: "c'est" }, { position: 4, jeton: '.' }], roles: [{ position: 3, nom: 'reponse' }], constantes: {} };
const VILLE = [['moi', 'ville', 'Nantes'], ['moi', 'vélo', 'Fusée'], ['moi', 'couleur', 'bleu'], ['moi', 'chien', 'Rex'], ['Hugo', 'chien', 'Rex']];

async function recevoir(magasin, texte) {
  const message = P.identifierMessage(texte, { nouvelId: C.nouvelId });
  await P.conserverValeurMessage(message, { enregistrerValeur: (entree) => C.enregistrerValeurDonnee(magasin, entree) });
  return message;
}
async function monde(faits = VILLE) {
  const magasin = C.magasinMemoireVive();
  const e = await E.chargerEsprit(magasin);
  for (const [sujet, relation, valeur] of faits) await E.apprendreFait(e, { sujet, relation, valeur, origine: 'apprise-conversation' });
  const { objet: action } = await C.apprendreAction(magasin, { operation: 'recherche', roles: [{ position: 3, nom: 'relation' }, { position: 4, nom: 'valeur' }], n: 6, exemples: [{ entree: 'Qui a pour chien Rex ?' }, { entree: 'Qui a pour métier pilote ?' }], statut: 'validee', origine: 'induite-supervisee' });
  const s1 = await recevoir(magasin, "Non, c'est Zoé."); const s2 = await recevoir(magasin, "Non, c'est Max.");
  await C.enregistrerDecisionForme(magasin, { idCandidat: identiteRegle(REGLE_CORRECTION), decision: 'confirmee', sources: [s1.id, s2.id], regle: REGLE_CORRECTION });
  return { magasin, action };
}
async function demander(w, question) {
  const Q = await recevoir(w.magasin, question);
  const reco = await ecranSur(w.magasin).tenterReconnaissanceAction(question, Q.id);
  return { Q, reco };
}
async function repondreLocal(w, texte) {
  const Q = await recevoir(w.magasin, texte);
  const e = await E.chargerEsprit(w.magasin);
  const r = await P.tenterPontLangage(texte, {
    assurerEsprit: async () => e, journaliser: async () => [101, 102],
    enregistrerExperience: (d) => C.enregistrerExperience(w.magasin, d), ajouterInterpretation: (id, d) => C.ajouterInterpretation(w.magasin, id, d),
    idQuestion: Q.id, enregistrerReponseLocale: (d) => C.enregistrerReponseLocale(w.magasin, d),
  });
  return { Q, r };
}
async function reagir(w, cible, texte) {
  const ecran = ecranSur(w.magasin);
  const r = await P.traiterTourAvecEnonce(texte, cible, {
    enregistrerEnonce: (t, x, m, l) => ecran.enregistrerEnonceSurTrace(t, x, m, l), traiter: async (message) => ({ message }),
    nouvelId: C.nouvelId, enregistrerValeur: (entree) => C.enregistrerValeurDonnee(w.magasin, entree),
  });
  return r.message;
}
async function corrigerSur(w, cible, reponse) {
  const E2 = await reagir(w, cible, `Non, c'est ${reponse}.`);
  const c = await K.reconnaitreCorrection(w.magasin, { idMessage: E2.id, texte: `Non, c'est ${reponse}.` });
  assert.equal(c.reconnue, true, JSON.stringify(c));
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: c.idQuestion, reponse: c.reponse, idLecon: E2.id });
  return { E: E2, c };
}
const cibleAction = (reco) => ({ idTrace: reco.idTrace, idReponseLocale: reco.idReponseLocale });
const cibleRepondre = (r) => ({ idReponseLocale: r.idReponseLocale });
const lignes = (w) => C.lireLignesDivergences(w.magasin);
const actes = (w) => w.magasin.lireTout('actesResolution');
const resolutions = async (w) => (await w.magasin.lireTout('manifestationsFaits')).filter((m) => m.voie.nom === 'resolution');
const instantane = async (w) => { const o = {}; for (const t of C.TABLES) o[t] = JSON.stringify(await w.magasin.lireTout(t)); return o; };
async function valeurCourante(w, sujet, relation) { const e = await E.chargerEsprit(w.magasin); const f = e.faits.get(C.cleFait(sujet, relation)); return f ? f.valeur : null; }
async function redemarrer(w) {
  const donnees = {};
  for (const t of C.TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t)));
  const magasin = C.magasinMemoireVive();
  await magasin.remplacerTout(donnees);
  return { magasin, action: w.action };
}

// ---- Raccords de main.js rejoués dans l'ordre exact (gardés statiquement plus bas) ----
// onOui de la correction comprise (.20) : réponse attendue déjà écrite (corrigerSur) → examen → proposition ÉCRITE → bulle ; échec → aucune bulle.
async function creer(w, Q, magasin = w.magasin) {
  const e = await E.chargerEsprit(w.magasin);
  const examen = RS.examinerResolution(await lignes(w), e, Q);
  let bulle = null;
  try {
    if (examen.proposition) { await C.enregistrerPropositionResolution(magasin, examen.proposition); bulle = examen.proposition; }
  } catch { bulle = null; }
  return { examen, bulle };
}
async function corrigerVille(w, valeur, Rville = null) {
  const R = Rville || await repondreLocal(w, 'ma ville ?');
  const { E: E2, c } = await corrigerSur(w, cibleRepondre(R.r), valeur);
  const { examen, bulle } = await creer(w, c.idQuestion);
  return { R, E: E2, c, examen, p: bulle };
}
// onNon de la proposition : issue annulee seule.
async function annuler(w, p, magasin = w.magasin) {
  try { await C.enregistrerIssueResolution(magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'annulee' }); return `D'accord, je garde ${p.ancien.sujet} → ${p.ancien.relation} → ${p.ancien.valeur}.`; } catch { return "Je n'ai pas pu noter ton annulation."; }
}
// onOui de la proposition : garde de péremption (constat → issue perimee + raison), sinon les trois écritures ou rien.
async function confirmer(w, p, { esprit = null } = {}) {
  const e = esprit || await E.chargerEsprit(w.magasin);
  const examen = RS.examinerResolution(await lignes(w), e, p.idReponseAttendue);
  if (!examen.proposition || !RS.memeProposition(examen.proposition, p)) {
    let note = true;
    try { await C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'perimee', raison: examen.proposition ? 'proposition-differente' : examen.raison }); } catch { note = false; }
    return { perimee: true, note };
  }
  try {
    await E.resoudreIncompatibilite(e, { fait: { ...p.nouveau }, manifestation: { idMessage: p.idMessage, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } } });
    return { perimee: false, ok: true };
  } catch (err) { return { perimee: false, ok: false, erreur: err.message }; }
}
// notesDesAppuis (partie .24/.25) : notesResolution(appuis, lignes, actes) puis notesActes(appuis, actes).
async function notesVue(w, appuis) {
  const a = await actes(w);
  return [...RS.notesResolution(appuis, await lignes(w), a), ...RS.notesActes(appuis, a)];
}
const NANTES = { sujet: 'moi', relation: 'ville', valeur: 'Nantes' };
const RENNES = { sujet: 'moi', relation: 'ville', valeur: 'Rennes' };
const NOTE_ANNULEE = "Je t'ai proposé de remplacer Nantes par Rennes ; tu as annulé.";
const NOTE_OUVERTE = "Je t'ai proposé de remplacer Nantes par Rennes ; cette proposition est restée sans réponse.";
const NOTE_CONFIRMEE = "Ce que je sais ici (moi → ville → Rennes) a remplacé Nantes : je te l'ai proposé après ta correction de « ma ville ? » et tu as confirmé.";
// Résolution PRÉ-.25 (écrite comme le faisait v0.64.24 : fait + manifestation, sans acte) — données historiques d'un appareil.
async function resolutionPre25(w, p) {
  const e = await E.chargerEsprit(w.magasin);
  const avant = e.faits.get(C.cleFait(p.ancien.sujet, p.ancien.relation));
  const objet = { ...avant, valeur: p.nouveau.valeur, origine: 'apprise-conversation' };
  const ligne = await C.preparerManifestationFait(w.magasin, { idMessage: p.idMessage, fait: { ...p.nouveau }, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } });
  await w.magasin.ecrireAtomique([{ table: 'faits', objet, mode: 'remplacement', avant }, { table: 'manifestationsFaits', objet: ligne, mode: 'ajout' }]);
}

// ================================================================================================================ A. CRÉATION
test('A. P affichée → l\'acte existe : ligne proposition exacte (Q, E, copies ancien/nouveau), identité dérivée de Q, seule écriture ; rien d\'autre ne change', async () => {
  const w = await monde();
  const R = await repondreLocal(w, 'ma ville ?');
  assert.equal(R.r.texte, 'Nantes');
  const { E: E2, c } = await corrigerSur(w, cibleRepondre(R.r), 'Rennes');
  const avant = await instantane(w);
  const { examen, bulle } = await creer(w, c.idQuestion);
  assert.deepEqual(bulle, examen.proposition);
  assert.deepEqual(await actes(w), [{ id: C.idActeProposition(R.Q.id), sorte: 'proposition', idReponseAttendue: R.Q.id, idMessage: E2.id, ancien: NANTES, nouveau: RENNES }]);
  assert.equal(C.idActeProposition(R.Q.id), ['proposition', R.Q.id].join('/'));
  const apres = await instantane(w);
  assert.deepEqual({ ...apres, actesResolution: null }, { ...avant, actesResolution: null }, 'aucune autre table touchée');
  assert.equal(await valeurCourante(w, 'moi', 'ville'), 'Nantes');
  // copie : modifier l'objet de la proposition après coup ne change pas l'histoire
  examen.proposition.ancien.valeur = 'X';
  assert.deepEqual((await actes(w))[0].ancien, NANTES);
});

// ================================================================================================================ B/P. ANNULER
test('B/P. Annuler → issue annulee seule, fait inchangé, aucune manifestation ; réutilisation de l\'ancien fait → note « tu as annulé »', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  const avant = await instantane(w);
  assert.equal(await annuler(w, p), "D'accord, je garde moi → ville → Nantes.");
  const apres = await instantane(w);
  assert.deepEqual({ ...apres, actesResolution: null }, { ...avant, actesResolution: null }, 'aucune écriture hors actesResolution');
  assert.deepEqual((await actes(w)).find((l) => l.sorte === 'issue'), { id: C.idActeIssue(p.idReponseAttendue), sorte: 'issue', idReponseAttendue: p.idReponseAttendue, issue: 'annulee' });
  assert.equal(await valeurCourante(w, 'moi', 'ville'), 'Nantes');
  assert.deepEqual(await resolutions(w), []);
  // P : « ma ville ? » → Nantes ; l'histoire de P1 accompagne l'appui actuel
  const B = await repondreLocal(w, 'ma ville ?');
  assert.equal(B.r.texte, 'Nantes');
  assert.deepEqual(await notesVue(w, B.r.appuis), [NOTE_ANNULEE]);
  // Annuler n'interprète rien : l'examen .24 de la même Q rend toujours la même proposition (aucune marque de refus lue)
  assert.deepEqual(RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), p.idReponseAttendue), { proposition: p });
});

// ================================================================================================================ C/Q. CONFIRMER
test('C/Q. Confirmer → fait remplacé + manifestation resolution + issue confirmee, cohérents ; réutilisation du nouveau fait → UNE seule ligne (note .24 remplacée)', async () => {
  const w = await monde();
  const { p, E: E2 } = await corrigerVille(w, 'Rennes');
  assert.deepEqual(await confirmer(w, p), { perimee: false, ok: true });
  assert.equal(await valeurCourante(w, 'moi', 'ville'), 'Rennes');
  assert.deepEqual(await resolutions(w), [{ idMessage: E2.id, fait: RENNES, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } }]);
  assert.deepEqual((await actes(w)).find((l) => l.sorte === 'issue'), { id: C.idActeIssue(p.idReponseAttendue), sorte: 'issue', idReponseAttendue: p.idReponseAttendue, issue: 'confirmee' });
  const B = await repondreLocal(w, 'ma ville ?');
  assert.equal(B.r.texte, 'Rennes');
  const n = await notesVue(w, B.r.appuis);
  assert.deepEqual(n, [NOTE_CONFIRMEE], 'une seule ligne visible');
  assert.ok(!n.some((x) => x.includes('quand tu as confirmé la résolution')), 'la note .24 n\'est pas affichée en plus');
  // vue pure : l'acte confirmé porte SA manifestation
  const [x] = RS.actesDeResolution(await actes(w), await lignes(w));
  assert.deepEqual(x, { idReponseAttendue: p.idReponseAttendue, idMessage: E2.id, ancien: NANTES, nouveau: RENNES, issue: 'confirmee', resolution: { idMessage: E2.id, fait: RENNES, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } } });
});

// ================================================================================================================ D. PÉREMPTION
test('D. P devient périmée (fait changé entre affichage et Confirmer) → aucun remplacement ; issue perimee + raison structurelle ; aucune note spontanée ; visible dans l\'histoire', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'ville', valeur: 'Paris', origine: 'apprise-conversation' });
  const avant = await instantane(w);
  assert.deepEqual(await confirmer(w, p), { perimee: true, note: true });
  assert.equal(await valeurCourante(w, 'moi', 'ville'), 'Paris');
  const apres = await instantane(w);
  assert.deepEqual({ ...apres, actesResolution: null }, { ...avant, actesResolution: null }, 'zéro écriture cognitive');
  assert.deepEqual((await actes(w)).find((l) => l.sorte === 'issue'), { id: C.idActeIssue(p.idReponseAttendue), sorte: 'issue', idReponseAttendue: p.idReponseAttendue, issue: 'perimee', raison: 'appui-non-actuel' });
  assert.deepEqual(await notesVue(w, [{ sujet: 'moi', relation: 'ville', valeur: 'Paris' }]), []);
  assert.deepEqual(await notesVue(w, [NANTES]), [], 'perimee : aucune note, même sur l\'ancien');
  assert.deepEqual(RS.actesDeResolution(await actes(w), await lignes(w)).map((x) => [x.issue, x.raison]), [['perimee', 'appui-non-actuel']]);
  // Une proposition devenue invalide SANS tentative de confirmation n'est PAS déclarée périmée (aucune surveillance) : elle reste ouverte.
  const w2 = await monde();
  const { p: p2 } = await corrigerVille(w2, 'Rennes');
  const e2 = await E.chargerEsprit(w2.magasin);
  await E.apprendreFait(e2, { sujet: 'moi', relation: 'ville', valeur: 'Paris', origine: 'apprise-conversation' });
  assert.deepEqual(RS.actesDeResolution(await actes(w2)).map((x) => [x.idReponseAttendue, x.issue]), [[p2.idReponseAttendue, 'ouverte']]);
});

// ================================================================================================================ E/S. SILENCE, REDÉMARRAGE
test('E/S. proposition sans réponse → aucune ligne issue ; ouverte, même après redémarrage ; note « restée sans réponse » seulement sur l\'ancien actuel', async () => {
  let w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  assert.equal((await actes(w)).filter((l) => l.sorte === 'issue').length, 0);
  assert.deepEqual(await notesVue(w, [NANTES]), [NOTE_OUVERTE]);
  w = await redemarrer(w);
  assert.equal((await actes(w)).filter((l) => l.sorte === 'issue').length, 0, 'aucune réponse fabriquée au redémarrage');
  assert.deepEqual(RS.actesDeResolution(await actes(w)).map((x) => x.issue), ['ouverte']);
  const B = await repondreLocal(w, 'ma ville ?');
  assert.deepEqual(await notesVue(w, B.r.appuis), [NOTE_OUVERTE]);
  assert.deepEqual(await notesVue(w, [RENNES]), [], 'aucune note hors de l\'ancien proposé');
  assert.equal(p.idReponseAttendue, RS.actesDeResolution(await actes(w))[0].idReponseAttendue);
});

// ================================================================================================================ F/G. IDENTITÉS
test('F. deux propositions identiques en contenu mais deux Q → deux actes distincts (identité = Q, aucun identifiant aléatoire)', async () => {
  const w = await monde();
  const a = await corrigerVille(w, 'Rennes');
  await annuler(w, a.p);
  const b = await corrigerVille(w, 'Rennes');
  assert.ok(a.p && b.p);
  assert.notEqual(a.p.idReponseAttendue, b.p.idReponseAttendue);
  assert.deepEqual([a.p.ancien, a.p.nouveau], [b.p.ancien, b.p.nouveau]);
  const ids = (await actes(w)).filter((l) => l.sorte === 'proposition').map((l) => l.id).sort();
  assert.deepEqual(ids, [C.idActeProposition(a.p.idReponseAttendue), C.idActeProposition(b.p.idReponseAttendue)].sort());
  assert.deepEqual(RS.actesDeResolution(await actes(w)).map((x) => [x.idReponseAttendue, x.issue]).sort(), [[a.p.idReponseAttendue, 'annulee'], [b.p.idReponseAttendue, 'ouverte']].sort());
});

test('G. P1 annulée puis P2 confirmée → deux histoires séparées, jamais fusionnées ; P1 disparaît quand Nantes n\'est plus actuel ; P2 accompagne Rennes ; redémarrage', async () => {
  let w = await monde();
  const p1 = (await corrigerVille(w, 'Rennes')).p;
  await annuler(w, p1);
  const p2 = (await corrigerVille(w, 'Rennes')).p;
  assert.deepEqual(await confirmer(w, p2), { perimee: false, ok: true });
  const vue = RS.actesDeResolution(await actes(w), await lignes(w));
  assert.equal(vue.length, 2);
  const v1 = vue.find((x) => x.idReponseAttendue === p1.idReponseAttendue); const v2 = vue.find((x) => x.idReponseAttendue === p2.idReponseAttendue);
  assert.equal(v1.issue, 'annulee'); assert.equal(v1.resolution, null);
  assert.equal(v2.issue, 'confirmee'); assert.equal(v2.resolution.voie.idReponseAttendue, p2.idReponseAttendue);
  assert.notEqual(v1.idMessage, v2.idMessage);
  const B = await repondreLocal(w, 'ma ville ?');
  assert.equal(B.r.texte, 'Rennes');
  assert.deepEqual(await notesVue(w, B.r.appuis), [NOTE_CONFIRMEE], 'P1 ne pollue pas la réponse');
  w = await redemarrer(w);
  const B2 = await repondreLocal(w, 'ma ville ?');
  assert.deepEqual(await notesVue(w, B2.r.appuis), [NOTE_CONFIRMEE], 'persistance');
  assert.equal(RS.actesDeResolution(await actes(w), await lignes(w)).length, 2);
});

// ================================================================================================================ H/I/J. AUCUN ACTE
test('H. Bob / portée indéterminée → aucun acte', async () => {
  const w = await monde();
  const A = await demander(w, 'Qui a pour vélo Fusée ?');
  const { c } = await corrigerSur(w, cibleAction(A.reco), 'Bob');
  const { examen, bulle } = await creer(w, c.idQuestion);
  assert.deepEqual(examen, { raison: 'portee-indeterminee' });
  assert.equal(bulle, null);
  assert.deepEqual(await actes(w), []);
});

test('I. correction sans proposition (attendu canoniquement égal ; pluralité causale) → aucun acte', async () => {
  const w = await monde();
  const R = await repondreLocal(w, 'ma ville ?');
  const { c } = await corrigerSur(w, cibleRepondre(R.r), 'nantes');
  assert.equal((await creer(w, c.idQuestion)).bulle, null);
  const A = await demander(w, 'Qui a pour chien Rex ?');
  const { c: c2 } = await corrigerSur(w, cibleAction(A.reco), 'Hugo');
  assert.equal((await creer(w, c2.idQuestion)).bulle, null);
  assert.deepEqual(await actes(w), []);
});

test('J. histoire pré-.25 (correction Éclair sans proposition ; résolution couleur → vert sans acte) : aucun acte rétroactif ; note .24 strictement inchangée', async () => {
  let w = await monde();
  // Éclair : correction vécue AVANT .25 (aucune création d'acte à l'époque)
  const B = await repondreLocal(w, 'mon vélo ?');
  await corrigerSur(w, cibleRepondre(B.r), 'Éclair');
  // couleur → vert résolue en .24 (fait + manifestation, sans acte)
  const R = await repondreLocal(w, 'ma couleur ?');
  const { c } = await corrigerSur(w, cibleRepondre(R.r), 'vert');
  const p = RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion).proposition;
  await resolutionPre25(w, p);
  w = await redemarrer(w);
  assert.deepEqual(await actes(w), [], 'aucun acte rétroactif');
  const V = await repondreLocal(w, 'ma couleur ?');
  assert.equal(V.r.texte, 'vert');
  assert.deepEqual(await notesVue(w, V.r.appuis), ['Ce que je sais ici (moi → couleur → vert) a remplacé bleu quand tu as confirmé la résolution de ta correction de « ma couleur ? ».']);
  const F = await repondreLocal(w, 'mon vélo ?');
  assert.equal(F.r.texte, 'Fusée');
  assert.deepEqual(await notesVue(w, F.r.appuis), [], 'Fusée/Éclair : aucune note d\'acte');
  // l'invariant admet explicitement la manifestation pré-.25 sans acte ni issue
  assert.equal((await resolutions(w)).length, 1);
  assert.deepEqual(RS.actesDeResolution(await actes(w), await lignes(w)), []);
});

// ================================================================================================================ K/L/M. ÉCHECS
const echouantSur = (vrai, table) => ({ ...vrai, ecrireAtomique: async (ops) => { if (ops.some((o) => o.table === table)) throw new Error('stockage indisponible'); return vrai.ecrireAtomique(ops); } });

test('K. échec de stockage à la création → aucune bulle, aucune proposition prétendue vécue ; la réponse attendue reste ce qu\'elle était', async () => {
  const w = await monde();
  const R = await repondreLocal(w, 'ma ville ?');
  const { c } = await corrigerSur(w, cibleRepondre(R.r), 'Rennes');
  const reponsesAvant = JSON.stringify(await w.magasin.lireTout('reponsesAttendues'));
  const { examen, bulle } = await creer(w, c.idQuestion, echouantSur(w.magasin, 'actesResolution'));
  assert.ok(examen.proposition);
  assert.equal(bulle, null);
  assert.deepEqual(await actes(w), []);
  assert.equal(JSON.stringify(await w.magasin.lireTout('reponsesAttendues')), reponsesAvant);
  assert.deepEqual(await notesVue(w, [NANTES]), []);
  // magasin sans écriture atomique : même refus
  assert.equal((await creer(w, c.idQuestion, { ...w.magasin, ecrireAtomique: undefined })).bulle, null);
  assert.deepEqual(await actes(w), []);
});

test('L. échec de stockage à Annuler → pas d\'annulation prétendue ; la proposition reste ouverte', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  assert.equal(await annuler(w, p, echouantSur(w.magasin, 'actesResolution')), "Je n'ai pas pu noter ton annulation.");
  assert.deepEqual(RS.actesDeResolution(await actes(w)).map((x) => x.issue), ['ouverte']);
  assert.equal(await valeurCourante(w, 'moi', 'ville'), 'Nantes');
});

test('M. échec de la transaction Confirmer → ni fait nouveau, ni manifestation, ni issue (tout ou rien, aucun rollback)', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  const avant = await instantane(w);
  const e = await E.chargerEsprit(w.magasin);
  e.magasin = echouantSur(w.magasin, 'actesResolution');
  const r = await confirmer(w, p, { esprit: e });
  assert.deepEqual(r, { perimee: false, ok: false, erreur: 'stockage indisponible' });
  assert.deepEqual(await instantane(w), avant, 'rien d\'écrit');
  assert.equal(e.faits.get(C.cleFait('moi', 'ville')).valeur, 'Nantes', 'esprit non modifié');
  // l'issue est déjà prise entre préparation et écriture (simulé : lecture qui omet la ligne) → refus atomique, rien d'écrit
  const vrai = w.magasin;
  const cache = { ...vrai, lireTout: async (t) => (t === 'actesResolution' ? (await vrai.lireTout(t)).filter((l) => l.sorte !== 'issue') : vrai.lireTout(t)), ecrireAtomique: vrai.ecrireAtomique };
  await vrai.ecrire('actesResolution', { id: C.idActeIssue(p.idReponseAttendue), sorte: 'issue', idReponseAttendue: p.idReponseAttendue, issue: 'annulee' });
  const avant2 = await instantane(w);
  const e2 = await E.chargerEsprit(w.magasin); e2.magasin = cache;
  await assert.rejects(() => E.resoudreIncompatibilite(e2, { fait: { ...p.nouveau }, manifestation: { idMessage: p.idMessage, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } } }), /existe déjà/);
  assert.deepEqual(await instantane(w), avant2);
  assert.equal(await valeurCourante(w, 'moi', 'ville'), 'Nantes');
});

// ================================================================================================================ N. CONCURRENCE
test('N. concurrence : fait changé sous l\'esprit → compare-and-set refusé, aucun des trois écrit ; Annuler et Confirmer simultanés → une seule issue, jamais de demi-état', async () => {
  // a) écriture concurrente du fait après la lecture de l'esprit
  let w = await monde();
  let { p } = await corrigerVille(w, 'Rennes');
  const e = await E.chargerEsprit(w.magasin);
  const ligne = (await w.magasin.lireTout('faits')).find((f) => C.cleFait(f.sujet, f.relation) === C.cleFait('moi', 'ville'));
  await w.magasin.ecrire('faits', { ...ligne, origine: 'concurrente' });
  const avant = await instantane(w);
  await assert.rejects(() => E.resoudreIncompatibilite(e, { fait: { ...p.nouveau }, manifestation: { idMessage: p.idMessage, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } } }), /a changé/);
  assert.deepEqual(await instantane(w), avant);
  // b) Annuler et Confirmer lancés ensemble : exactement une issue ; si l'annulation gagne, ni fait ni manifestation
  for (let i = 0; i < 2; i += 1) {
    w = await monde();
    ({ p } = await corrigerVille(w, 'Rennes'));
    const ex = await E.chargerEsprit(w.magasin);
    const deux = [
      () => C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'annulee' }),
      () => E.resoudreIncompatibilite(ex, { fait: { ...p.nouveau }, manifestation: { idMessage: p.idMessage, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } } }),
    ];
    const r = await Promise.allSettled(i === 0 ? deux.map((f) => f()) : deux.reverse().map((f) => f()));
    assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1, 'une seule issue gagne');
    const issues = (await actes(w)).filter((l) => l.sorte === 'issue');
    assert.equal(issues.length, 1);
    const confirmee = issues[0].issue === 'confirmee';
    assert.equal((await resolutions(w)).length, confirmee ? 1 : 0, 'issue confirmee ⇔ manifestation');
    assert.equal(await valeurCourante(w, 'moi', 'ville'), confirmee ? 'Rennes' : 'Nantes');
  }
  // c) deux issues seules simultanées, deux créations simultanées : une seule chacune
  w = await monde();
  ({ p } = await corrigerVille(w, 'Rennes'));
  const r2 = await Promise.allSettled([
    C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'annulee' }),
    C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'perimee', raison: 'appui-non-actuel' }),
  ]);
  assert.equal(r2.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal((await actes(w)).filter((l) => l.sorte === 'issue').length, 1);
  const w3 = await monde();
  const R3 = await repondreLocal(w3, 'ma ville ?');
  const { c: c3 } = await corrigerSur(w3, cibleRepondre(R3.r), 'Rennes');
  const prop = RS.examinerResolution(await lignes(w3), await E.chargerEsprit(w3.magasin), c3.idQuestion).proposition;
  const r3 = await Promise.allSettled([C.enregistrerPropositionResolution(w3.magasin, prop), C.enregistrerPropositionResolution(w3.magasin, prop)]);
  assert.equal(r3.filter((x) => x.status === 'fulfilled').length, 1, 'au plus une proposition par Q');
  assert.equal((await actes(w3)).length, 1);
});

// ================================================================================================================ O/R. APRÈS LA RÉSOLUTION
test('O. résolution déjà existante → aucune nouvelle proposition, aucune seconde issue, aucune seconde résolution', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  await confirmer(w, p);
  assert.deepEqual(RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), p.idReponseAttendue), { raison: 'deja-resolue' });
  await assert.rejects(() => C.enregistrerPropositionResolution(w.magasin, p), /existe déjà/);
  await assert.rejects(() => C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'annulee' }), /a déjà son issue/);
  // un second clic Confirmer constate la péremption (deja-resolue) mais ne peut pas écrire de seconde issue
  const avant = await instantane(w);
  assert.deepEqual(await confirmer(w, p), { perimee: true, note: false });
  assert.deepEqual(await instantane(w), avant);
});

test('R. résultat confirmé ensuite remplacé → plus aucune note sur le nouveau fait ; l\'acte confirmé reste dans l\'histoire avec SA manifestation', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  await confirmer(w, p);
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'ville', valeur: 'Brest', origine: 'apprise-conversation' });
  const B = await repondreLocal(w, 'ma ville ?');
  assert.equal(B.r.texte, 'Brest');
  assert.deepEqual(await notesVue(w, B.r.appuis), []);
  const [x] = RS.actesDeResolution(await actes(w), await lignes(w));
  assert.equal(x.issue, 'confirmee'); assert.deepEqual(x.resolution.fait, RENNES);
});

// ================================================================================================================ T. NON-CONTAMINATION
test('T. examinerResolution / memeProposition / etatsDivergences strictement identiques avec ou sans actes historiques', async () => {
  const w = await monde();
  const R = await repondreLocal(w, 'ma ville ?');
  const { c } = await corrigerSur(w, cibleRepondre(R.r), 'Rennes');
  const e = await E.chargerEsprit(w.magasin);
  const sans = RS.examinerResolution(await lignes(w), e, c.idQuestion);
  const etatsSans = RS.etatsDivergences(await lignes(w), e);
  // actes injectés de toute sorte (proposition et issue de cette Q, actes d'autres Q)
  await w.magasin.ecrire('actesResolution', { id: C.idActeProposition(c.idQuestion), sorte: 'proposition', idReponseAttendue: c.idQuestion, idMessage: 'x', ancien: NANTES, nouveau: RENNES });
  await w.magasin.ecrire('actesResolution', { id: C.idActeIssue(c.idQuestion), sorte: 'issue', idReponseAttendue: c.idQuestion, issue: 'annulee' });
  await w.magasin.ecrire('actesResolution', { id: C.idActeIssue('autre'), sorte: 'issue', idReponseAttendue: 'autre', issue: 'perimee', raison: 'appui-non-actuel' });
  const lignesAvec = { ...(await lignes(w)), actes: await actes(w), actesResolution: await actes(w) };
  assert.deepEqual(RS.examinerResolution(await lignes(w), e, c.idQuestion), sans);
  assert.deepEqual(RS.examinerResolution(lignesAvec, e, c.idQuestion), sans, 'même si les actes voyagent avec les lignes');
  assert.deepEqual(RS.etatsDivergences(lignesAvec, e), etatsSans);
  // lireLignesDivergences (lecture de la décision) ne lit pas actesResolution
  assert.equal(Object.hasOwn(await lignes(w), 'actes'), false);
  assert.equal(Object.hasOwn(await lignes(w), 'actesResolution'), false);
});

test('T. formes supervisées, corrections apprises et apprentissage de fait inchangés par les actes ; aucune lecture décisionnelle (gardes statiques)', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  const formesAvant = formesSupervisees(await w.magasin.lireTout('manifestationsFaits'), await w.magasin.lireTout('valeursDonnees'));
  const correctionsAvant = JSON.stringify(await C.lireLignesCorrections(w.magasin));
  await annuler(w, p);
  assert.deepEqual(formesSupervisees(await w.magasin.lireTout('manifestationsFaits'), await w.magasin.lireTout('valeursDonnees')), formesAvant);
  assert.equal(JSON.stringify(await C.lireLignesCorrections(w.magasin)), correctionsAvant);
  // NOMMER la table ou ses primitives : seulement connaissances (définition), esprit (confirmation atomique), resolutions (vue), main (raccords).
  const NOMS = /actesResolution|ActeResolution|ActesResolution|actesDeResolution|notesActes|IssueResolution|PropositionResolution|idActe(Proposition|Issue)|ISSUES_RESOLUTION/;
  const fichiers = [];
  const parcourir = (d) => { for (const n of readdirSync(join(RACINE, d), { withFileTypes: true })) { if (n.isDirectory()) parcourir(join(d, n.name)); else if (/\.(js|mjs|html)$/.test(n.name)) fichiers.push(join(d, n.name)); } };
  parcourir('app');
  const nommant = fichiers.filter((f) => NOMS.test(sansCommentaires(readFileSync(join(RACINE, f), 'utf8')))).sort();
  assert.deepEqual(nommant, ['app/langage/connaissances.js', 'app/langage/esprit.js', 'app/langage/resolutions.js', 'app/main.js']);
  // resolutions.js : les fonctions de DÉCISION ne lisent pas les actes
  const rs = lu('app', 'langage', 'resolutions.js');
  for (const nom of ['examinerResolution', 'memeProposition', 'etatsDivergences']) {
    const debut = rs.indexOf(`export function ${nom}(`);
    const corps = rs.slice(debut, rs.indexOf('\n}\n', debut));
    assert.ok(debut > 0 && corps.length > 0, nom);
    assert.doesNotMatch(corps, /actes|Actes/, `${nom} ne lit aucun acte`);
  }
  // esprit.js : seule la confirmation atomique touche aux actes
  const esp = sansCommentaires(lu('app', 'langage', 'esprit.js'));
  assert.equal((esp.match(/preparerIssueResolution\(/g) || []).length, 1);
  const r = esp.slice(esp.indexOf('export async function resoudreIncompatibilite('));
  const corpsR = r.slice(0, r.indexOf('\n}\n'));
  assert.ok(corpsR.includes('preparerIssueResolution('));
  assert.ok(corpsR.indexOf('preparerIssueResolution(') < corpsR.indexOf('await esprit.magasin.ecrireAtomique(['), 'préparation avant l\'unique écriture');
  assert.match(corpsR, /\{ table: 'actesResolution', objet: issue, mode: 'ajout' \}/);
  assert.equal((corpsR.match(/\.ecrire\(|ecrireAtomique\(/g) || []).length, 1, 'une seule écriture');
  // main.js : la lecture des actes n'a lieu QUE dans notesDesAppuis (vue) ; aucune décision ne la reçoit
  const main = sansCommentaires(lu('app', 'main.js'));
  // MISE À JOUR DÉLIBÉRÉE N3b-0 (relecture située, Diagnostic) : 1 → 2 lectures, la seconde dans le seul pont experiencesSituees (vue de relecture).
  assert.equal((main.match(/lireActesResolution\(/g) || []).length, 2);
  const notes = main.slice(main.indexOf('async function notesDesAppuis('), main.indexOf('async function propositionDeCorrection('));
  assert.ok(notes.includes('lireActesResolution(e.magasin)'));
  const pontDiagnostic = main.slice(main.indexOf('experiencesSituees: async () => {'));
  assert.ok(pontDiagnostic.slice(0, 300).includes('experiencesSitueesDeResolution(await lireActesResolution(e.magasin)'));
  assert.doesNotMatch(main, /examinerResolution\([^)]*actes/);
});

// ================================================================================================================ GARDES DES RACCORDS (main.js)
test('raccords main.js : proposition ÉCRITE avant la bulle (échec → aucune bulle) ; Annuler = issue annulee seule ; péremption → issue perimee + raison ; Confirmer = resoudreIncompatibilite seule', () => {
  const main = sansCommentaires(lu('app', 'main.js'));
  const corr = main.slice(main.indexOf('function proposerReponseCorrigee('), main.indexOf('async function traiterTour('));
  const oui = corr.slice(corr.indexOf('onOui:'), corr.indexOf('onNon:'));
  const iEcrit = oui.indexOf('await enregistrerPropositionResolution(e.magasin, examen.proposition);');
  const iBulle = oui.indexOf('resolution = proposerResolution(examen.proposition);');
  assert.ok(iEcrit > 0 && iBulle > iEcrit, 'écrire P AVANT de remettre la bulle');
  assert.match(oui.slice(iBulle), /\} catch \{ resolution = null; \}/, 'échec d\'écriture → aucune bulle');
  const def = main.slice(main.indexOf('function proposerResolution('), main.indexOf('function proposerReponseCorrigee('));
  const ouiP = def.slice(def.indexOf('onOui:'), def.indexOf('onNon:'));
  const non = def.slice(def.indexOf('onNon:'));
  assert.equal((non.match(/enregistrer\w*\(/g) || []).length, 1);
  assert.ok(non.includes("await enregistrerIssueResolution(e.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'annulee' });"));
  assert.doesNotMatch(non, /resoudre|apprendre|ecrireConnaissance|Manifestation|decision/i);
  assert.ok(non.indexOf("issue: 'annulee' });") < non.indexOf("reponseFinale = `D'accord, je garde"), 'le texte de succès suit l\'écriture');
  assert.match(non, /Je n'ai pas pu noter ton annulation\./);
  const iGarde = ouiP.indexOf('if (!examen.proposition || !memeProposition(examen.proposition, p)) {');
  const iPerimee = ouiP.indexOf("await enregistrerIssueResolution(e.magasin, { idReponseAttendue: p.idReponseAttendue, issue: 'perimee', raison: examen.proposition ? 'proposition-differente' : examen.raison });");
  const iResol = ouiP.indexOf('await resoudreIncompatibilite(e, {');
  assert.ok(iGarde > 0 && iPerimee > iGarde && iResol > iPerimee);
  assert.equal((ouiP.match(/enregistrer\w*\(/g) || []).length, 1, 'aucune autre écriture séparée dans Confirmer');
  assert.doesNotMatch(ouiP, /issue: 'confirmee'/, 'confirmee ne s\'écrit que dans la transaction de esprit.js');
});

// ================================================================================================================ CONTRAT DE LA TABLE
test('contrat : proposition fidèle à la réponse attendue (Q établie par E, valeur exacte, même identité) ; issues fermées ; raison pour perimee seulement ; confirmee jamais seule ; aucune issue sans proposition', async () => {
  const w = await monde();
  const R = await repondreLocal(w, 'ma ville ?');
  const { E: E2, c } = await corrigerSur(w, cibleRepondre(R.r), 'Rennes');
  const p = RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion).proposition;
  await assert.rejects(() => C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: c.idQuestion, issue: 'annulee' }), /aucune proposition vécue/);
  await assert.rejects(() => C.enregistrerPropositionResolution(w.magasin, { ...p, idMessage: 'autre' }), /aucune réponse attendue/);
  await assert.rejects(() => C.enregistrerPropositionResolution(w.magasin, { ...p, nouveau: { ...p.nouveau, valeur: 'Brest' } }), /aucune réponse attendue/);
  await assert.rejects(() => C.enregistrerPropositionResolution(w.magasin, { ...p, nouveau: { ...p.nouveau, relation: 'pays' } }), /partager sujet et relation/);
  await assert.rejects(() => C.enregistrerPropositionResolution(w.magasin, { ...p, ancien: { sujet: 'moi', relation: 'ville' } }), /ancien doit être un fait/);
  await assert.rejects(() => C.enregistrerPropositionResolution(w.magasin, { ...p, idReponseAttendue: '' }), /chaînes non vides/);
  assert.deepEqual(await actes(w), []);
  await C.enregistrerPropositionResolution(w.magasin, p);
  const q = p.idReponseAttendue;
  await assert.rejects(() => C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: q, issue: 'refusee' }), /issue inconnue/);
  await assert.rejects(() => C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: q, issue: 'perimee' }), /raison structurelle/);
  await assert.rejects(() => C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: q, issue: 'annulee', raison: 'x' }), /raison structurelle/);
  await assert.rejects(() => C.enregistrerIssueResolution(w.magasin, { idReponseAttendue: q, issue: 'confirmee' }), /ne s'écrit qu'avec la résolution/);
  assert.equal((await actes(w)).length, 1);
  // la confirmation exige la proposition vécue : sans elle (nouveau chemin), aucune résolution n'est possible
  const w2 = await monde();
  const R2 = await repondreLocal(w2, 'ma ville ?');
  const { c: c2 } = await corrigerSur(w2, cibleRepondre(R2.r), 'Rennes');
  const p2 = RS.examinerResolution(await lignes(w2), await E.chargerEsprit(w2.magasin), c2.idQuestion).proposition;
  const avant = await instantane(w2);
  const e2 = await E.chargerEsprit(w2.magasin);
  await assert.rejects(() => E.resoudreIncompatibilite(e2, { fait: { ...p2.nouveau }, manifestation: { idMessage: p2.idMessage, voie: { nom: 'resolution', idReponseAttendue: p2.idReponseAttendue } } }), /aucune proposition vécue/);
  assert.deepEqual(await instantane(w2), avant);
  assert.equal(E2.id, p.idMessage);
});

test('invariant nominal : sur les nouveaux chemins, issue confirmee(Q) ⇔ manifestation resolution(Q) ; exception admise : manifestations pré-.25 sans acte', async () => {
  const w = await monde();
  const p1 = (await corrigerVille(w, 'Rennes')).p; await annuler(w, p1);
  const p2 = (await corrigerVille(w, 'Rennes')).p; await confirmer(w, p2);
  const p3 = (await corrigerVille(w, 'Brest')).p; // ouverte (Rennes actuel)
  assert.ok(p3);
  const R = await repondreLocal(w, 'ma couleur ?');
  const { c } = await corrigerSur(w, cibleRepondre(R.r), 'vert');
  await resolutionPre25(w, RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion).proposition);
  const a = await actes(w);
  const confirmees = new Set(a.filter((l) => l.sorte === 'issue' && l.issue === 'confirmee').map((l) => l.idReponseAttendue));
  const avecProposition = new Set(a.filter((l) => l.sorte === 'proposition').map((l) => l.idReponseAttendue));
  const resolues = (await resolutions(w)).map((m) => m.voie.idReponseAttendue);
  for (const q of resolues) if (avecProposition.has(q)) assert.ok(confirmees.has(q), 'manifestation ⇒ confirmee');
  for (const q of confirmees) assert.ok(resolues.includes(q), 'confirmee ⇒ manifestation');
  assert.equal(resolues.filter((q) => !avecProposition.has(q)).length, 1, 'une seule résolution pré-.25 sans acte');
  assert.deepEqual(RS.actesDeResolution(a, await lignes(w)).map((x) => x.issue).sort(), ['annulee', 'confirmee', 'ouverte']);
});

// ================================================================================================================ VUE PURE
test('vue pure actesDeResolution / notesActes : aucune écriture, horloge, hasard ; ordre des lignes conservé, aucun classement ; lignes incohérentes ignorées ; deux Q jamais fusionnées', () => {
  const src = sansCommentaires(lu('app', 'langage', 'resolutions.js'));
  assert.doesNotMatch(src, /lireTout|ecrire|enregistrer|apprendre|Date|Math\.random|horodatage|sort\(/);
  const pr = (q, a, n) => ({ id: C.idActeProposition(q), sorte: 'proposition', idReponseAttendue: q, idMessage: `E-${q}`, ancien: { sujet: 'moi', relation: 'ville', valeur: a }, nouveau: { sujet: 'moi', relation: 'ville', valeur: n } });
  const lignesActes = [pr('Q2', 'Nantes', 'Rennes'), { id: C.idActeIssue('Q1'), sorte: 'issue', idReponseAttendue: 'Q1', issue: 'annulee' }, pr('Q1', 'Nantes', 'Rennes'), { id: C.idActeIssue('Q9'), sorte: 'issue', idReponseAttendue: 'Q9', issue: 'confirmee' }, null, { sorte: 'proposition' }];
  const vue = RS.actesDeResolution(lignesActes);
  assert.deepEqual(vue.map((x) => [x.idReponseAttendue, x.issue, x.resolution]), [['Q2', 'ouverte', null], ['Q1', 'annulee', null]]);
  assert.deepEqual(RS.notesActes([NANTES], lignesActes), [NOTE_OUVERTE, NOTE_ANNULEE], 'deux actes, deux lignes');
  assert.deepEqual(RS.notesActes([{ sujet: 'moi', relation: 'ville', valeur: 'Lyon' }], lignesActes), []);
  assert.deepEqual(RS.notesActes([], lignesActes), []);
  assert.deepEqual(RS.notesActes([NANTES], []), []);
  assert.deepEqual(RS.notesResolution([RENNES], { manifestations: [] }, lignesActes), []);
});

// ================================================================================================================ SCHÉMA, MIGRATION, SAUVEGARDE
test('schéma : actesResolution déclarée en dernier (clé id), VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables ; migration 28 → 29 ne crée QUE cette table, vide ; sauvegarde schéma 19 (18 complété par [], 19 sans la table = incomplet, 20 refusé)', async () => {
  assert.equal(C.TABLES.at(-2), 'actesResolution'); assert.equal(C.CLE.actesResolution, 'id'); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(C.VERSION_BASE, 30); assert.equal(S.SCHEMA_SAUVEGARDE, 20); assert.equal(C.TABLES.length, 36); assert.equal(new Set(C.TABLES).size, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  const existants = C.TABLES.filter((t) => t !== 'actesResolution');
  const donnees = new Map(existants.map((t) => [t, [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null;
  const fabrique = { open(n, v) { version = v; const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) }; const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }; queueMicrotask(() => { r.onupgradeneeded(); r.onsuccess(); }); return r; } };
  await C.ouvrirIndexedDB(fabrique);
  assert.equal(version, 30); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.deepEqual(crees, [['actesResolution', 'id']]);
  assert.deepEqual(donnees.get('actesResolution'), [], 'table vide : aucun acte rétroactif');
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes'); await annuler(w, p);
  const { creerMemoire } = await import('../app/memoire/memoire.js');
  const { creerMagasinMemoire } = await import('../app/memoire/magasin.js');
  const memoire = creerMemoire(creerMagasinMemoire());
  const TABLES_MEMOIRE = Object.keys(await memoire.exporterDonnees());
  const fichier = await S.construireSauvegardeComplete({ memoire, magasinLangage: w.magasin, idNaissance: 'id', versionAppli: '0.64.25', maintenant: new Date('2026-10-15T18:00:00Z') });
  assert.equal(fichier.objet.schema, 20); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  const lue = await S.lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  assert.deepEqual(lue.donnees.langage.actesResolution, await actes(w));
  assert.equal(lue.donnees.langage.actesResolution.length, 2);
  const { empreinte } = await import('../app/memoire/transfert.js');
  const refaire = async (o) => JSON.stringify({ ...o, empreinte: await empreinte(JSON.stringify(o.donnees)) });
  const ancien = JSON.parse(fichier.contenu); ancien.schema = 18; delete ancien.donnees.langage.actesResolution;
  const lu1 = await S.lireSauvegardeComplete(await refaire(ancien), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu1.ok, true, lu1.erreur); assert.deepEqual(lu1.donnees.langage.actesResolution, [], 'schéma 18 : table vide, aucun acte fabriqué');
  const incomplet = JSON.parse(fichier.contenu); delete incomplet.donnees.langage.actesResolution;
  const lu2 = await S.lireSauvegardeComplete(await refaire(incomplet), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu2.ok, false); assert.match(lu2.erreur, /incomplet/);
  const futur = JSON.parse(fichier.contenu); futur.schema = 21; // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  const lu3 = await S.lireSauvegardeComplete(await refaire(futur), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu3.ok, false); assert.match(lu3.erreur, /plus récente/);
  // restauration : l'histoire relue à l'identique
  const w2 = { magasin: C.magasinMemoireVive(), action: w.action };
  await w2.magasin.remplacerTout(lue.donnees.langage);
  assert.deepEqual(await notesVue(w2, [NANTES]), [NOTE_ANNULEE]);
});

// ================================================================================================================ ATOMICITÉ INDEXEDDB (3 tables)
// Contrôle demandé avant dépôt (ChatGPT, « DERNIER CONTRÔLE AVANT DÉPÔT ») : le chemin IndexedDB de ecrireAtomique (connaissances.js,
// magasinIndexedDB) exercé avec les TROIS opérations RÉELLES de la confirmation .25 — capturées sur un vrai resoudreIncompatibilite — sur une
// fausse IndexedDB fidèle à la sémantique transactionnelle : les put ne sont appliqués qu'au commit ; un abort (ou un échec au commit) les annule.
function fausseIndexedDB(initial, { echecAuCommit = false } = {}) {
  const lignesIdb = Object.fromEntries(C.TABLES.map((t) => [t, new Map((initial[t] || []).map((o) => [o[C.CLE[t]], structuredClone(o)]))]));
  const transactions = [];
  const db = {
    objectStoreNames: { contains: () => true }, close() {},
    transaction(tables, mode) {
      const tx = { tables, mode, ecrits: [], aborte: false, commitee: false, error: null, oncomplete: null, onerror: null, onabort: null, attentes: 0,
        abort() { tx.aborte = true; queueMicrotask(() => tx.onabort && tx.onabort()); },
        finir() {
          if (tx.attentes !== 0 || tx.aborte) return;
          queueMicrotask(() => {
            if (tx.aborte || tx.commitee) return;
            if (echecAuCommit) { tx.aborte = true; tx.error = new Error('QuotaExceededError (simulé au commit)'); if (tx.onerror) tx.onerror(); return; }
            for (const [t, o] of tx.ecrits) lignesIdb[t].set(o[C.CLE[t]], structuredClone(o));
            tx.commitee = true;
            if (tx.oncomplete) tx.oncomplete();
          });
        },
        objectStore(t) {
          assert.ok(tables.includes(t), `table ${t} hors de la transaction`);
          return {
            get(cle) { const r = { result: undefined, onsuccess: null }; tx.attentes += 1; queueMicrotask(() => { r.result = structuredClone(lignesIdb[t].get(cle)); tx.attentes -= 1; if (r.onsuccess) r.onsuccess(); tx.finir(); }); return r; },
            put(o) { tx.ecrits.push([t, o]); },
          };
        } };
      transactions.push(tx);
      return tx;
    },
  };
  const fabrique = { open() { const r = { result: db }; queueMicrotask(() => { if (r.onupgradeneeded) r.onupgradeneeded(); r.onsuccess(); }); return r; } };
  return { fabrique, lignesIdb, transactions };
}
// Les trois opérations EXACTES que produit resoudreIncompatibilite pour moi → ville : Nantes → Rennes (capturées, puis écrites en mémoire).
async function operationsReelles() {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  const e = await E.chargerEsprit(w.magasin);
  const avant = structuredClone(e.faits.get(C.cleFait('moi', 'ville')));
  let ops = null;
  const vrai = w.magasin;
  e.magasin = { ...vrai, ecrireAtomique: async (o) => { ops = structuredClone(o); return vrai.ecrireAtomique(o); } };
  await E.resoudreIncompatibilite(e, { fait: { ...p.nouveau }, manifestation: { idMessage: p.idMessage, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } } });
  assert.deepEqual(ops.map((o) => [o.table, o.mode]), [['faits', 'remplacement'], ['manifestationsFaits', 'ajout'], ['actesResolution', 'ajout']]);
  const proposition = (await vrai.lireTout('actesResolution')).find((l) => l.sorte === 'proposition');
  return { ops, avant, proposition, p };
}
const etatIdb = (l) => ({ fait: l.faits.get(C.cleFait('moi', 'ville')), manifestations: [...l.manifestationsFaits.values()], actes: [...l.actesResolution.values()] });

test('ATOM-IDB-3. IndexedDB, trois tables (faits CAS + manifestation + issue confirmee) : A succès complet ; B CAS du fait refusé ; C clé de manifestation prise ; D clé d\'issue prise ; E échec au commit → jamais d\'écriture partielle', async () => {
  const { ops, avant, proposition, p } = await operationsReelles();
  const [opFait, opMan, opIssue] = ops;
  const base = { faits: [avant], actesResolution: [proposition] };
  const ouvrir = async (initial, options) => { const f = fausseIndexedDB(initial, options); return { ...f, magasin: await C.ouvrirIndexedDB(f.fabrique) }; };

  // A. SUCCÈS : une seule transaction readwrite sur les trois tables ; les trois lignes présentes après commit.
  let x = await ouvrir(base);
  await x.magasin.ecrireAtomique(ops);
  assert.equal(x.transactions.length, 1);
  assert.deepEqual([...x.transactions[0].tables].sort(), ['actesResolution', 'faits', 'manifestationsFaits']);
  assert.equal(x.transactions[0].mode, 'readwrite');
  assert.equal(x.transactions[0].commitee, true);
  const a = etatIdb(x.lignesIdb);
  assert.deepEqual(a.fait, opFait.objet); assert.equal(a.fait.valeur, 'Rennes');
  assert.deepEqual(a.manifestations, [opMan.objet]);
  assert.deepEqual(a.actes.filter((l) => l.sorte === 'issue'), [{ id: C.idActeIssue(p.idReponseAttendue), sorte: 'issue', idReponseAttendue: p.idReponseAttendue, issue: 'confirmee' }]);
  assert.deepEqual(a.actes.filter((l) => l.sorte === 'proposition'), [proposition], 'proposition intacte');

  // B. ÉCHEC DU COMPARE-AND-SET : la ligne du fait a changé dans la base (écriture concurrente) → abort, aucune des trois.
  const concurrente = { ...avant, valeur: 'Paris' };
  x = await ouvrir({ ...base, faits: [concurrente] });
  let avantEtat = JSON.stringify(etatIdb(x.lignesIdb));
  await assert.rejects(() => x.magasin.ecrireAtomique(ops), /a changé/);
  assert.equal(x.transactions[0].aborte, true); assert.equal(x.transactions[0].commitee, false);
  assert.deepEqual(x.transactions[0].ecrits, [], 'refus AVANT tout put');
  assert.equal(JSON.stringify(etatIdb(x.lignesIdb)), avantEtat);
  assert.equal(x.lignesIdb.manifestationsFaits.size, 0); assert.equal([...x.lignesIdb.actesResolution.values()].filter((l) => l.sorte === 'issue').length, 0);

  // C. CLÉ DE MANIFESTATION DÉJÀ PRISE → aucune des trois.
  const autre = { idMessage: opMan.objet.idMessage, fait: { sujet: 'moi', relation: 'ville', valeur: 'Lyon' }, voie: { nom: 'j1a' } };
  x = await ouvrir({ ...base, manifestationsFaits: [autre] });
  avantEtat = JSON.stringify(etatIdb(x.lignesIdb));
  await assert.rejects(() => x.magasin.ecrireAtomique(ops), /existe déjà dans manifestationsFaits/);
  assert.equal(x.transactions[0].aborte, true); assert.deepEqual(x.transactions[0].ecrits, []);
  assert.equal(JSON.stringify(etatIdb(x.lignesIdb)), avantEtat);
  assert.equal(x.lignesIdb.faits.get(C.cleFait('moi', 'ville')).valeur, 'Nantes');

  // D. CLÉ D'ISSUE DÉJÀ PRISE (ex. annulée entre préparation et écriture) → aucune des trois.
  const annulee = { id: C.idActeIssue(p.idReponseAttendue), sorte: 'issue', idReponseAttendue: p.idReponseAttendue, issue: 'annulee' };
  x = await ouvrir({ ...base, actesResolution: [proposition, annulee] });
  avantEtat = JSON.stringify(etatIdb(x.lignesIdb));
  await assert.rejects(() => x.magasin.ecrireAtomique(ops), /existe déjà dans actesResolution/);
  assert.equal(x.transactions[0].aborte, true); assert.deepEqual(x.transactions[0].ecrits, []);
  assert.equal(JSON.stringify(etatIdb(x.lignesIdb)), avantEtat);
  assert.equal(x.lignesIdb.faits.get(C.cleFait('moi', 'ville')).valeur, 'Nantes'); assert.equal(x.lignesIdb.manifestationsFaits.size, 0);
  assert.equal(x.lignesIdb.actesResolution.get(annulee.id).issue, 'annulee', 'l\'issue existante n\'est pas réécrite');

  // E. ÉCHEC / ABORT DE TRANSACTION APRÈS PRÉPARATION : les trois put sont émis dans la transaction, puis le commit échoue → rien.
  x = await ouvrir(base, { echecAuCommit: true });
  avantEtat = JSON.stringify(etatIdb(x.lignesIdb));
  await assert.rejects(() => x.magasin.ecrireAtomique(ops), /QuotaExceededError/);
  assert.equal(x.transactions.length, 1);
  assert.deepEqual(x.transactions[0].ecrits.map(([t]) => t), ['faits', 'manifestationsFaits', 'actesResolution'], 'les trois écritures étaient préparées dans LA transaction');
  assert.equal(x.transactions[0].commitee, false);
  assert.equal(JSON.stringify(etatIdb(x.lignesIdb)), avantEtat, 'aucune écriture partielle');
  // ordre des opérations sans effet sur l'atomicité (issue en tête, fait en dernier) : clé d'issue prise → rien
  x = await ouvrir({ ...base, actesResolution: [proposition, annulee] });
  avantEtat = JSON.stringify(etatIdb(x.lignesIdb));
  await assert.rejects(() => x.magasin.ecrireAtomique([opIssue, opMan, opFait]), /existe déjà/);
  assert.equal(JSON.stringify(etatIdb(x.lignesIdb)), avantEtat);
});
