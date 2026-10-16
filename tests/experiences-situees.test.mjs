// N3b-0 — « RELIRE UN ACTE DANS LA SITUATION OÙ IL A ÉTÉ VÉCU » (GO ChatGPT « N3b-0 », 15/10/2026).
// Vue pure experiencesSitueesDeResolution (app/langage/experiences-situees.js) : historique (données persistées) / relecture (déclaration
// courante) / issue / après ; absences fermées ; aucune comparaison entre expériences ; lue seulement par le Diagnostic. Lettres A–T du GO.
// Le harnais (monde, réponses locales, corrections, raccords .25 rejoués dans l'ordre de main.js) est repris de tests/actes-resolution.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const P = await import('../app/langage/pont.js');
const E = await import('../app/langage/esprit.js');
const K = await import('../app/langage/corrections-apprises.js');
const RS = await import('../app/langage/resolutions.js');
const XS = await import('../app/langage/experiences-situees.js');
const { PROJECTION_REPONDRE_FAIT } = await import('../app/langage/pont.js');
const { CAPACITES } = await import('../app/langage/registre.js');
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


// ---- N3b-0 ----
async function vue(w, { lignesModifiees = null, declarations } = {}) {
  const l = lignesModifiees || await lignes(w);
  return XS.experiencesSitueesDeResolution(await actes(w), l, await E.chargerEsprit(w.magasin), declarations);
}
const copie = (x) => JSON.parse(JSON.stringify(x));
// P1 annulée puis P2 confirmée sur moi → ville (les témoins du téléphone), plus leurs identités.
async function temoinsVille() {
  const w = await monde();
  const a = await corrigerVille(w, 'Rennes');
  await annuler(w, a.p);
  const b = await corrigerVille(w, 'Rennes');
  assert.deepEqual(await confirmer(w, b.p), { perimee: false, ok: true });
  return { w, p1: a, p2: b };
}
const RELUE_VILLE = { statut: 'relue', base: 'declaration-courante', contraintes: ['sujet', 'relation'], delivre: 'valeur', valeurDelivree: 'Nantes', porteeSurIdentite: 'incompatible-sous-identite' };

// ================================================================================================================ A/O. P1 / P2, VOIE REPONDRE
test('A/O. P1 annulée et P2 confirmée → DEUX expériences distinctes (Q1 ≠ Q2, E1 ≠ E2), même contenu, aucune fusion, aucune relation ; voie repondre relue', async () => {
  const { w, p1, p2 } = await temoinsVille();
  const xs = await vue(w);
  assert.equal(xs.length, 2);
  const [x1, x2] = [xs.find((x) => x.acte.idReponseAttendue === p1.p.idReponseAttendue), xs.find((x) => x.acte.idReponseAttendue === p2.p.idReponseAttendue)];
  assert.notEqual(p1.p.idReponseAttendue, p2.p.idReponseAttendue); assert.notEqual(x1.acte.idMessage, x2.acte.idMessage);
  assert.deepEqual(x1, {
    acte: { idReponseAttendue: p1.p.idReponseAttendue, idMessage: p1.E.id, ancien: NANTES, nouveau: RENNES },
    situation: {
      historique: { question: 'ma ville ?', attendu: 'Rennes', reaction: { idMessage: p1.E.id, cible: { idReponseLocale: p1.R.r.idReponseLocale } }, reponseProduite: { voie: 'repondre', idReponseLocale: p1.R.r.idReponseLocale, obtenu: ['Nantes'], appuis: [NANTES] }, absences: [] },
      relecture: RELUE_VILLE,
    },
    issue: { nature: 'annulee' },
    apres: { ecritureCognitive: 'aucune' },
  });
  assert.deepEqual(x2.situation.historique.reponseProduite.idReponseLocale, p2.R.r.idReponseLocale);
  assert.deepEqual(x2.issue, { nature: 'confirmee' });
  assert.deepEqual(x2.apres.faitResultant, RENNES); assert.equal(x2.apres.resultatActuel, true);
  // aucun champ ne relie une expérience à l'autre
  assert.ok(!JSON.stringify(x1).includes(p2.p.idReponseAttendue) && !JSON.stringify(x2).includes(p1.p.idReponseAttendue));
});

// ================================================================================================================ B/C/D/E/F. ISSUES ET APRÈS
test('B. proposition sans réponse → issue ouverte, aucun état après fabriqué', async () => {
  const w = await monde();
  await corrigerVille(w, 'Rennes');
  const [x] = await vue(w);
  assert.deepEqual(x.issue, { nature: 'ouverte' });
  assert.deepEqual(x.apres, { ecritureCognitive: 'aucune' });
  assert.deepEqual(x.situation.relecture, RELUE_VILLE);
});

test('C. annulée → issue annulee telle quelle, sans interprétation ni état après', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  await annuler(w, p);
  const [x] = await vue(w);
  assert.deepEqual(x.issue, { nature: 'annulee' });
  assert.deepEqual(Object.keys(x.issue), ['nature']);
  assert.deepEqual(x.apres, { ecritureCognitive: 'aucune' });
});

test('D. périmée → issue perimee + raison structurelle, aucun échec, aucun état après', async () => {
  const w = await monde();
  const { p } = await corrigerVille(w, 'Rennes');
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'ville', valeur: 'Paris', origine: 'apprise-conversation' });
  assert.equal((await confirmer(w, p)).perimee, true);
  const [x] = await vue(w);
  assert.deepEqual(x.issue, { nature: 'perimee', raison: 'appui-non-actuel' });
  assert.deepEqual(x.apres, { ecritureCognitive: 'aucune' });
  assert.deepEqual(x.acte.ancien, NANTES, 'l\'histoire n\'est pas réécrite par le fait actuel (Paris)');
  assert.deepEqual(x.situation.historique.reponseProduite.appuis, [NANTES]);
});

test('E/F. confirmée → manifestation + fait résultant historique ; F\' ensuite remplacé → historique conservé, resultatActuel = faux', async () => {
  const w = await monde();
  const { p, E: E2 } = await corrigerVille(w, 'Rennes');
  await confirmer(w, p);
  let [x] = await vue(w);
  assert.deepEqual(x.apres, { manifestation: { idMessage: E2.id, fait: RENNES, voie: { nom: 'resolution', idReponseAttendue: p.idReponseAttendue } }, faitResultant: RENNES, resultatActuel: true });
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'ville', valeur: 'Brest', origine: 'apprise-conversation' });
  [x] = await vue(w);
  assert.deepEqual(x.apres.faitResultant, RENNES, 'l\'acte a produit Rennes (historique)');
  assert.equal(x.apres.resultatActuel, false, 'Rennes n\'est plus actuel');
  assert.deepEqual(x.issue, { nature: 'confirmee' });
});

// ================================================================================================================ G. PRÉ-.25
test('G. résolution pré-.25 (couleur → vert, sans proposition) → AUCUNE expérience située ; aucun acte rétroactif', async () => {
  const w = await monde();
  const R = await repondreLocal(w, 'ma couleur ?');
  const { c } = await corrigerSur(w, cibleRepondre(R.r), 'vert');
  await resolutionPre25(w, RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion).proposition);
  assert.deepEqual(await vue(w), []);
  assert.deepEqual(await actes(w), []);
  // avec des actes ville présents, toujours aucune entrée couleur
  const { p } = await corrigerVille(w, 'Rennes'); await annuler(w, p);
  const xs = await vue(w);
  assert.equal(xs.length, 1); assert.equal(xs[0].acte.ancien.relation, 'ville');
});

// ================================================================================================================ H/I/J/K/L. ABSENCES
test('H/I/J/K. données manquantes → raisons fermées explicites ; l\'acte, son contenu et son issue restent présents', async () => {
  const { w, p1 } = await temoinsVille();
  const base = await lignes(w);
  const Q = p1.p.idReponseAttendue;
  const garde = (x) => { assert.deepEqual(x.acte, { idReponseAttendue: Q, idMessage: p1.E.id, ancien: NANTES, nouveau: RENNES }); assert.deepEqual(x.issue, { nature: 'annulee' }); };
  const de = async (l) => (await vue(w, { lignesModifiees: l })).find((x) => x.acte.idReponseAttendue === Q);
  // H : texte de la question absent
  let l = copie(base); l.valeurs = l.valeurs.filter((v) => v.id !== Q);
  let x = await de(l); garde(x);
  assert.equal(x.situation.historique.question, null); assert.deepEqual(x.situation.historique.absences, ['question-introuvable']);
  // I : réponse attendue absente
  l = copie(base); l.reponses = l.reponses.filter((r) => r.idMessage !== Q);
  x = await de(l); garde(x);
  assert.equal(x.situation.historique.attendu, null); assert.ok(x.situation.historique.absences.includes('reponse-attendue-absente'));
  assert.deepEqual(x.situation.relecture, { statut: 'non-relue' }, 'sans réponse attendue, aucune divergence à relire');
  // J : réaction E absente
  l = copie(base); l.enonces = l.enonces.filter((y) => y.idMessage !== p1.E.id);
  x = await de(l); garde(x);
  assert.equal(x.situation.historique.reaction, null); assert.equal(x.situation.historique.reponseProduite, null);
  assert.deepEqual(x.situation.historique.absences, ['reaction-absente']); assert.deepEqual(x.situation.relecture, { statut: 'non-relue' });
  // K : réponse produite introuvable
  l = copie(base); l.reponsesLocales = l.reponsesLocales.filter((y) => y.id !== p1.R.r.idReponseLocale);
  x = await de(l); garde(x);
  assert.equal(x.situation.historique.reponseProduite, null); assert.deepEqual(x.situation.historique.absences, ['reponse-produite-introuvable']);
  assert.deepEqual(x.situation.relecture, { statut: 'non-relue' });
  assert.deepEqual(new Set(XS.ABSENCES_SITUATION), new Set(['reponse-attendue-absente', 'question-introuvable', 'reaction-absente', 'reponse-produite-introuvable', 'obtenu-non-persiste', 'appui-incoherent']));
});

test('L. appui historique incohérent avec acte.ancien → « appui-incoherent » signalé, jamais réparé avec le présent', async () => {
  const { w, p1 } = await temoinsVille();
  const l = copie(await lignes(w));
  const loc = l.reponsesLocales.find((y) => y.id === p1.R.r.idReponseLocale);
  loc.appuis = [{ sujet: 'moi', relation: 'ville', valeur: 'Lyon' }];
  const x = (await vue(w, { lignesModifiees: l })).find((y) => y.acte.idReponseAttendue === p1.p.idReponseAttendue);
  assert.deepEqual(x.situation.historique.absences, ['appui-incoherent']);
  assert.deepEqual(x.acte.ancien, NANTES, 'la copie de l\'acte reste ce qui a été proposé');
  assert.deepEqual(x.situation.historique.reponseProduite.appuis, [{ sujet: 'moi', relation: 'ville', valeur: 'Lyon' }], 'l\'historique est montré tel quel');
  assert.ok(!JSON.stringify(x.situation.historique).includes('Rennes') || x.situation.historique.attendu === 'Rennes', 'aucune valeur actuelle injectée');
});

// ================================================================================================================ M. HISTOIRE vs CODE COURANT
test('M. déclaration de projection supprimée ou modifiée → partie historique STRICTEMENT identique ; relecture non-relue ou modifiée explicitement', async () => {
  const { w } = await temoinsVille();
  const ref = await vue(w);
  const histoire = (xs) => JSON.stringify(xs.map((x) => [x.acte, x.situation.historique, x.issue, x.apres]));
  // supprimée
  const sans = await vue(w, { declarations: { capacites: CAPACITES, projectionRepondre: undefined } });
  assert.equal(histoire(sans), histoire(ref));
  assert.ok(sans.every((x) => x.situation.relecture.statut === 'relue'), 'undefined → défaut courant (paramètre JS)');
  const nulle = await vue(w, { declarations: { capacites: CAPACITES, projectionRepondre: null } });
  assert.equal(histoire(nulle), histoire(ref));
  assert.ok(nulle.every((x) => x.situation.relecture.statut === 'non-relue'));
  // modifiée mais encore vérifiable sur les données : seule la relecture change, et elle le dit
  const autre = await vue(w, { declarations: { capacites: CAPACITES, projectionRepondre: { contraintes: [{ champ: 'sujet' }], delivre: 'valeur' } } });
  assert.equal(histoire(autre), histoire(ref));
  assert.ok(autre.every((x) => x.situation.relecture.statut === 'relue' && x.situation.relecture.base === 'declaration-courante'));
  assert.deepEqual(autre.map((x) => [x.situation.relecture.contraintes, x.situation.relecture.porteeSurIdentite]), [[['sujet'], 'indeterminee'], [['sujet'], 'indeterminee']]);
  // modifiée et démentie par les données historiques (le champ délivré n'est plus l'obtenu) → non-relue
  const dementie = await vue(w, { declarations: { capacites: CAPACITES, projectionRepondre: { contraintes: [{ champ: 'sujet' }, { champ: 'valeur' }], delivre: 'relation' } } });
  assert.equal(histoire(dementie), histoire(ref));
  assert.ok(dementie.every((x) => x.situation.relecture.statut === 'non-relue'));
  assert.deepEqual(PROJECTION_REPONDRE_FAIT, { contraintes: [{ champ: 'sujet' }, { champ: 'relation' }], delivre: 'valeur' }, 'la vraie déclaration n\'a pas été touchée');
});

// ================================================================================================================ N. VOIE ACTION
test('N. voie Action (ligne proposition SYNTHÉTIQUE, pour éprouver la vue : .24 ne propose pas sur une portée indéterminée) → historique de la réponse locale Action, relecture de la capacité courante', async () => {
  const w = await monde();
  const A = await demander(w, 'Qui a pour vélo Fusée ?');
  const { E: E2, c } = await corrigerSur(w, cibleAction(A.reco), 'Bob');
  assert.deepEqual(RS.examinerResolution(await lignes(w), await E.chargerEsprit(w.magasin), c.idQuestion), { raison: 'portee-indeterminee' });
  const VELO = { sujet: 'moi', relation: 'vélo', valeur: 'Fusée' };
  await w.magasin.ecrire('actesResolution', { id: C.idActeProposition(c.idQuestion), sorte: 'proposition', idReponseAttendue: c.idQuestion, idMessage: E2.id, ancien: VELO, nouveau: { ...VELO, valeur: 'Bob' } });
  const [x] = await vue(w);
  assert.equal(x.situation.historique.reponseProduite.voie, 'action');
  assert.deepEqual(x.situation.historique.reponseProduite.obtenu, ['moi']);
  assert.deepEqual(x.situation.historique.absences, []);
  assert.deepEqual(x.situation.relecture, { statut: 'relue', base: 'declaration-courante', contraintes: ['relation', 'valeur'], delivre: 'sujet', valeurDelivree: 'moi', porteeSurIdentite: 'indeterminee' });
  // capacité retirée de la déclaration courante → relecture non-relue, historique identique
  const sansCap = await vue(w, { declarations: { capacites: {}, projectionRepondre: PROJECTION_REPONDRE_FAIT } });
  assert.deepEqual(sansCap[0].situation.historique, x.situation.historique);
  assert.deepEqual(sansCap[0].situation.relecture, { statut: 'non-relue' });
});

// ================================================================================================================ P/Q/R/T. PURETÉ, NON-CONTAMINATION
test('P. aucune fonction de comparaison, de rapprochement, de signature ni de synthèse ; module pur (ni écriture, ni horloge, ni hasard, ni tri, ni compte)', () => {
  const src = sansCommentaires(lu('app', 'langage', 'experiences-situees.js'));
  assert.deepEqual(Object.keys(XS).sort(), ['ABSENCES_SITUATION', 'experienceSitueeDeResolution', 'experiencesSitueesDeResolution']);
  assert.doesNotMatch(src, /signature|antecedent|similaire|ressembl|compar|analog|rapproch/i);
  assert.doesNotMatch(src, /lireTout|ecrire|enregistrer|apprendre|oublier|Date|Math\.random|horodatage|\.sort\(/);
  assert.doesNotMatch(src, /score|poids|confiance|probab|majorit|fr[ée]quence|compte|succ[eè]s|echec|échec|objectif|finalit|recompense|récompense|but\b/i);
  assert.doesNotMatch(src, /examinerResolution|memeProposition|etatsDivergences|resoudreIncompatibilite|besoins|moyens|strategie|occasion|initiative/);
  // une expérience ne reçoit jamais une autre expérience : la fonction unitaire ne voit que SA proposition
  assert.equal(XS.experienceSitueeDeResolution.length, 5);
});

test('Q. examinerResolution, etatsDivergences et le magasin strictement identiques avec ou sans la vue', async () => {
  const w = await monde();
  const R = await repondreLocal(w, 'ma ville ?');
  const { c } = await corrigerSur(w, cibleRepondre(R.r), 'Rennes');
  const e = await E.chargerEsprit(w.magasin);
  const avant = { examen: RS.examinerResolution(await lignes(w), e, c.idQuestion), etats: RS.etatsDivergences(await lignes(w), e), magasin: await instantane(w) };
  await vue(w); await vue(w);
  assert.deepEqual({ examen: RS.examinerResolution(await lignes(w), e, c.idQuestion), etats: RS.etatsDivergences(await lignes(w), e), magasin: await instantane(w) }, avant);
});

test('R/T. lecteurs : seul main.js importe la vue, dans le seul pont Diagnostic ; aucune réponse ordinaire, aucune décision ne la lit ; l\'UI la place après les moyens connus', () => {
  const fichiers = [];
  const parcourir = (d) => { for (const n of readdirSync(join(RACINE, d), { withFileTypes: true })) { if (n.isDirectory()) parcourir(join(d, n.name)); else if (/\.(js|mjs|html)$/.test(n.name)) fichiers.push(join(d, n.name)); } };
  parcourir('app');
  const nommant = fichiers.filter((f) => /experiences-situees|experiencesSitueesDeResolution|experienceSitueeDeResolution/.test(sansCommentaires(readFileSync(join(RACINE, f), 'utf8')))).sort();
  assert.deepEqual(nommant, ['app/langage/experiences-situees.js', 'app/main.js']);
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.equal((main.match(/experiencesSitueesDeResolution\(/g) || []).length, 1);
  const pont = main.slice(main.indexOf('experiencesSituees: async () => {'));
  assert.ok(pont.length > 0 && pont.slice(0, 300).includes('return experiencesSitueesDeResolution(await lireActesResolution(e.magasin), await lireLignesDivergences(e.magasin), e);'));
  for (const zone of ['async function notesDesAppuis(', 'function proposerResolution(', 'function proposerReponseCorrigee(', 'async function traiterTour(']) {
    const i = main.indexOf(zone); assert.ok(i >= 0, zone);
    assert.doesNotMatch(main.slice(i, i + 4000), /experiencesSitue/, `${zone} ne lit pas la vue`);
  }
  const ui = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  assert.equal((ui.match(/capacite\.experiencesSituees\(/g) || []).length, 1);
  assert.match(ui, /zoneDiagnostic\.append\(titreDiagnostic, boutonCopier, zoneEtatComplet, zoneBesoins, zoneActesSitues, zoneEvenement, zoneEpisode\);/); // MISE À JOUR DÉLIBÉRÉE v0.64.30 (OUTIL-1 « Copier le diagnostic », outillage non cognitif) : le bouton de copie en tête du panneau, juste sous son titre ; l'ordre des zones est inchangé
  assert.match(ui, /'Propositions de résolution vécues \(relecture\)'/);
  assert.match(ui, /relu aujourd'hui \(déclaration actuelle\)/);
});

test('T. réponses ordinaires .25 inchangées : mêmes textes, mêmes appuis, mêmes notes avec ou sans lecture de la vue', async () => {
  const { w } = await temoinsVille();
  const tour = async () => { const B = await repondreLocal(w, 'ma ville ?'); return [B.r.texte, B.r.appuis, await notesVue(w, B.r.appuis)]; };
  const avant = await tour();
  await vue(w);
  assert.deepEqual(await tour(), avant);
  assert.deepEqual(avant[0], 'Rennes');
  assert.deepEqual(avant[2], [NOTE_CONFIRMEE]);
});

// ================================================================================================================ S. REDÉMARRAGE
test('S. redémarrage → même relecture à code identique', async () => {
  const { w } = await temoinsVille();
  const avant = await vue(w);
  const w2 = await redemarrer(w);
  assert.deepEqual(await vue(w2), avant);
});
