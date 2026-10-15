// N3b-1 — « METTRE DEUX EXPÉRIENCES VÉCUES EN REGARD » (GO ChatGPT « N3b-1 — GO CODE », 15/10/2026).
// Vue pure confronterExperiencesSituees / confrontationsExperiencesSituees (app/langage/confrontations-situees.js) : deux descriptions
// N3b-0 mises en regard emplacement par emplacement (égal / différent / propre / indéterminable), historique séparé de l'actuel,
// identités jamais confrontées, toutes les paires sans sélection, aucun verdict. Familles 1–11 du GO (+ Z, ajouts).
// Le harnais (monde, réponses locales, corrections, raccords .25 rejoués) est repris de tests/experiences-situees.test.mjs.
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

// ---- N3b-1 ----
const CS = await import('../app/langage/confrontations-situees.js');
const ch = (xs) => xs.map((x) => x.chemin.join('.'));
const parChemin = (xs) => Object.fromEntries(xs.map((x) => [x.chemin.join('.'), x]));
const deVille = async () => { const { w, p1, p2 } = await temoinsVille(); const xs = await vue(w); return { w, p1, p2, xs, x1: xs.find((x) => x.acte.idReponseAttendue === p1.p.idReponseAttendue), x2: xs.find((x) => x.acte.idReponseAttendue === p2.p.idReponseAttendue) }; };
// Témoin ville / couleur par le chemin NATUREL (.20 → .24 → .25) : deux propositions vécues, toutes deux ouvertes.
async function temoinsVilleCouleur() {
  const w = await monde();
  const v = await corrigerVille(w, 'Rennes');
  const R = await repondreLocal(w, 'ma couleur ?');
  const { E: E2, c } = await corrigerSur(w, cibleRepondre(R.r), 'vert');
  const { bulle } = await creer(w, c.idQuestion);
  assert.ok(bulle, 'la correction de « ma couleur ? » produit une proposition vécue par le chemin naturel');
  const xs = await vue(w);
  return { w, xs, xv: xs.find((x) => x.acte.idReponseAttendue === v.p.idReponseAttendue), xc: xs.find((x) => x.acte.idReponseAttendue === c.idQuestion) };
}
const miroir = (c) => ({
  base: c.base,
  identites: [c.identites[1], c.identites[0]],
  ...Object.fromEntries(['historique', 'actuel'].map((k) => [k, {
    communs: c[k].communs,
    differents: c[k].differents.map((d) => ({ chemin: d.chemin, premiere: d.seconde, seconde: d.premiere })),
    propres: { premiere: c[k].propres.seconde, seconde: c[k].propres.premiere },
    indeterminables: c[k].indeterminables.map((d) => ({ chemin: d.chemin, absente: d.absente === 'les-deux' ? 'les-deux' : d.absente === 'premiere' ? 'seconde' : 'premiere' })),
  }])),
});
const VIDE = { communs: [], differents: [], propres: { premiere: [], seconde: [] }, indeterminables: [] };

// ================================================================================================================ 1. P1 / P2
test('1. P1 annulée / P2 confirmée (« ma ville ? ») : historique largement égal, issues et après différents, identités séparées, aucune fusion', async () => {
  const { x1, x2, p1, p2 } = await deVille();
  const c = CS.confronterExperiencesSituees(x1, x2);
  assert.deepEqual(Object.keys(c), ['base', 'identites', 'historique', 'actuel']);
  assert.equal(c.base, 'description-N3b-0');
  assert.deepEqual(c.historique.communs, [
    { chemin: ['acte', 'ancien', 'relation'], valeur: 'ville' }, { chemin: ['acte', 'ancien', 'sujet'], valeur: 'moi' }, { chemin: ['acte', 'ancien', 'valeur'], valeur: 'Nantes' },
    { chemin: ['acte', 'nouveau', 'relation'], valeur: 'ville' }, { chemin: ['acte', 'nouveau', 'sujet'], valeur: 'moi' }, { chemin: ['acte', 'nouveau', 'valeur'], valeur: 'Rennes' },
    { chemin: ['situation', 'historique', 'absences'], valeur: [] }, { chemin: ['situation', 'historique', 'attendu'], valeur: 'Rennes' }, { chemin: ['situation', 'historique', 'question'], valeur: 'ma ville ?' },
    { chemin: ['situation', 'historique', 'reponseProduite', 'appuis'], valeur: [NANTES] }, { chemin: ['situation', 'historique', 'reponseProduite', 'obtenu'], valeur: ['Nantes'] },
    { chemin: ['situation', 'historique', 'reponseProduite', 'voie'], valeur: 'repondre' },
  ]);
  // l'issue est au MÊME emplacement des deux côtés (deux lignes issue persistées) : elle diffère, sans aucune valence
  assert.deepEqual(c.historique.differents, [{ chemin: ['issue', 'nature'], premiere: 'annulee', seconde: 'confirmee' }]);
  assert.deepEqual(c.historique.indeterminables, []);
  assert.deepEqual(c.historique.propres, {
    premiere: [{ chemin: ['apres', 'ecritureCognitive'], valeur: 'aucune' }],
    seconde: [
      { chemin: ['apres', 'faitResultant', 'relation'], valeur: 'ville' }, { chemin: ['apres', 'faitResultant', 'sujet'], valeur: 'moi' }, { chemin: ['apres', 'faitResultant', 'valeur'], valeur: 'Rennes' },
      { chemin: ['apres', 'manifestation', 'fait', 'relation'], valeur: 'ville' }, { chemin: ['apres', 'manifestation', 'fait', 'sujet'], valeur: 'moi' }, { chemin: ['apres', 'manifestation', 'fait', 'valeur'], valeur: 'Rennes' },
      { chemin: ['apres', 'manifestation', 'voie', 'nom'], valeur: 'resolution' },
    ],
  });
  // actuel : la relecture est égale (même déclaration courante pour les deux : égalité d'AUJOURD'HUI, jamais rangée dans l'historique)
  assert.deepEqual(ch(c.actuel.communs), ['situation.relecture.base', 'situation.relecture.contraintes', 'situation.relecture.delivre', 'situation.relecture.porteeSurIdentite', 'situation.relecture.statut', 'situation.relecture.valeurDelivree']);
  assert.deepEqual(c.actuel.propres, { premiere: [], seconde: [{ chemin: ['apres', 'resultatActuel'], valeur: true }] });
  assert.ok(!ch(c.historique.communs).some((k) => k.includes('relecture') || k.includes('resultatActuel')));
  // identités : restituées, distinctes, jamais confrontées
  assert.deepEqual(c.identites[0].map((i) => i.valeur), [p1.p.idReponseAttendue, p1.E.id, p1.E.id, p1.R.r.idReponseLocale, p1.R.r.idReponseLocale]);
  assert.equal(c.identites[1][0].valeur, p2.p.idReponseAttendue);
  const tout = JSON.stringify([c.historique, c.actuel]);
  for (const id of [p1.p.idReponseAttendue, p2.p.idReponseAttendue, p1.E.id, p2.E.id, p1.R.r.idReponseLocale, p2.R.r.idReponseLocale]) assert.ok(!tout.includes(id), `identité ${id} hors des compartiments`);
  // aucune fusion, aucun verdict : seulement les clés du contrat
  for (const k of ['historique', 'actuel']) assert.deepEqual(Object.keys(c[k]), ['communs', 'differents', 'propres', 'indeterminables']);
  assert.doesNotMatch(JSON.stringify(c), /essai|succ[eè]s|[ée]chec|analog|similai|ressembl|categor|signature|score|meilleur/i);
  // les expériences d'entrée ne sont pas modifiées
  assert.deepEqual(await vue((await deVille()).w).then((xs) => xs.length), 2);
});

// ================================================================================================================ 2. VILLE / COULEUR
test('2. ville / couleur (chemin naturel) : sujet, voie et issue ouverte égaux ; relation, valeurs, question, attendu différents ; aucun « même type »', async () => {
  const { xv, xc } = await temoinsVilleCouleur();
  const c = CS.confronterExperiencesSituees(xv, xc);
  assert.deepEqual(ch(c.historique.communs), ['acte.ancien.sujet', 'acte.nouveau.sujet', 'apres.ecritureCognitive', 'situation.historique.absences', 'situation.historique.reponseProduite.voie']);
  const d = parChemin(c.historique.differents);
  assert.deepEqual(Object.keys(d), ['acte.ancien.relation', 'acte.ancien.valeur', 'acte.nouveau.relation', 'acte.nouveau.valeur', 'situation.historique.attendu', 'situation.historique.question', 'situation.historique.reponseProduite.appuis', 'situation.historique.reponseProduite.obtenu']);
  assert.deepEqual([d['acte.ancien.relation'].premiere, d['acte.ancien.relation'].seconde], ['ville', 'couleur']);
  assert.deepEqual([d['situation.historique.question'].premiere, d['situation.historique.question'].seconde], ['ma ville ?', 'ma couleur ?']);
  assert.deepEqual(c.historique.propres, { premiere: [], seconde: [] });
  // deux issues ouvertes : état AU MOMENT DE LA LECTURE (aucune ligne issue) → actuel, pas historique
  assert.ok(!ch(c.historique.communs).includes('issue.nature'));
  assert.ok(ch(c.actuel.communs).includes('issue.nature'));
  assert.deepEqual(ch(c.actuel.differents), ['situation.relecture.valeurDelivree']);
  assert.doesNotMatch(JSON.stringify(c), /type|categor|analog|similai|signature/i);
});

// ================================================================================================================ 3. AUTO-CONFRONTATION
test('3. même expérience (même Q) des deux côtés → refus ; dans l\'énumération : entrée refus, aucune mise en regard', async () => {
  const { x1 } = await deVille();
  assert.throws(() => CS.confronterExperiencesSituees(x1, x1), /même expérience/);
  assert.throws(() => CS.confronterExperiencesSituees(x1, copie(x1)), /même expérience/);
  const autreContenu = copie(x1); autreContenu.acte.nouveau.valeur = 'Brest';
  assert.throws(() => CS.confronterExperiencesSituees(x1, autreContenu), /même expérience/, 'l\'identité Q décide, pas le contenu');
  const [e] = CS.confrontationsExperiencesSituees([x1, copie(x1)]);
  assert.deepEqual(Object.keys(e), ['identites', 'refus']);
  assert.equal(e.refus, 'meme-experience');
});

// ================================================================================================================ 4. SYMÉTRIE
test('4. symétrie : (x2, x1) est exactement le miroir de (x1, x2), sur les deux témoins', async () => {
  const { x1, x2 } = await deVille();
  assert.deepEqual(CS.confronterExperiencesSituees(x2, x1), miroir(CS.confronterExperiencesSituees(x1, x2)));
  const { xv, xc } = await temoinsVilleCouleur();
  assert.deepEqual(CS.confronterExperiencesSituees(xc, xv), miroir(CS.confronterExperiencesSituees(xv, xc)));
  // ordre des clés des entrées sans effet
  const inverse = (o) => (Array.isArray(o) ? o.map(inverse) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).reverse().map(([k, v]) => [k, inverse(v)])) : o);
  assert.deepEqual(CS.confronterExperiencesSituees(inverse(x1), inverse(x2)), CS.confronterExperiencesSituees(x1, x2));
});

// ================================================================================================================ 5. ABSENCES
test('5. absences : deux questions introuvables → indéterminable (jamais égal) ; une seule → indéterminable du côté absent ; réaction / réponse produite absentes', async () => {
  const { w, p1, p2 } = await deVille();
  const base = await lignes(w);
  const de = async (l) => { const xs = await vue(w, { lignesModifiees: l }); return [xs.find((x) => x.acte.idReponseAttendue === p1.p.idReponseAttendue), xs.find((x) => x.acte.idReponseAttendue === p2.p.idReponseAttendue)]; };
  let l = copie(base); l.valeurs = l.valeurs.filter((v) => v.id !== p1.p.idReponseAttendue && v.id !== p2.p.idReponseAttendue);
  let [a, b] = await de(l);
  let c = CS.confronterExperiencesSituees(a, b);
  assert.deepEqual(parChemin(c.historique.indeterminables)['situation.historique.question'], { chemin: ['situation', 'historique', 'question'], absente: 'les-deux' });
  assert.ok(!ch(c.historique.communs).includes('situation.historique.question'), 'deux absences ne sont jamais une égalité');
  assert.ok(ch(c.historique.communs).includes('situation.historique.absences'), 'les deux constats d\'absence persistés sont, eux, égaux');
  l = copie(base); l.valeurs = l.valeurs.filter((v) => v.id !== p1.p.idReponseAttendue);
  [a, b] = await de(l);
  c = CS.confronterExperiencesSituees(a, b);
  assert.deepEqual(parChemin(c.historique.indeterminables)['situation.historique.question'].absente, 'premiere');
  assert.ok(!ch(c.historique.differents).includes('situation.historique.question'), 'une absence n\'est pas une différence');
  assert.deepEqual(parChemin(c.historique.differents)['situation.historique.absences'], { chemin: ['situation', 'historique', 'absences'], premiere: ['question-introuvable'], seconde: [] });
  // réaction (énoncé E) absente d'un côté → indéterminables réaction et réponse produite, côté premiere
  l = copie(base); l.enonces = l.enonces.filter((x) => x.idMessage !== p1.E.id);
  [a, b] = await de(l);
  c = CS.confronterExperiencesSituees(a, b);
  assert.deepEqual(c.historique.indeterminables.filter((x) => x.chemin[2] === 'reaction' || x.chemin[2] === 'reponseProduite'), [
    { chemin: ['situation', 'historique', 'reaction'], absente: 'premiere' }, { chemin: ['situation', 'historique', 'reponseProduite'], absente: 'premiere' },
  ]);
  // voie non persistée (provenance absente) des deux côtés → indéterminable, pas égal
  const s1 = copie(a); const s2 = copie(b);
  [s1, s2].forEach((x) => { if (!x.situation.historique.reponseProduite) { x.situation.historique.reaction = { idMessage: x.acte.idMessage, cible: { idReponseLocale: 'r' } }; x.situation.historique.reponseProduite = { voie: 'repondre', idReponseLocale: 'r', obtenu: ['Nantes'], appuis: [NANTES] }; } x.situation.historique.reponseProduite.voie = undefined; });
  c = CS.confronterExperiencesSituees(s1, s2);
  assert.deepEqual(parChemin(c.historique.indeterminables)['situation.historique.reponseProduite.voie'].absente, 'les-deux');
  // manifestation introuvable (confirmée) face à une manifestation présente → indéterminables côté premiere
  const m1 = copie(b); m1.acte.idReponseAttendue = 'Q-autre'; m1.apres = { manifestation: null, faitResultant: null, resultatActuel: false, absence: 'manifestation-introuvable' };
  c = CS.confronterExperiencesSituees(m1, b);
  assert.deepEqual(c.historique.indeterminables.filter((x) => x.chemin[0] === 'apres'), [{ chemin: ['apres', 'faitResultant'], absente: 'premiere' }, { chemin: ['apres', 'manifestation'], absente: 'premiere' }]);
  assert.deepEqual(c.historique.propres.premiere, [{ chemin: ['apres', 'absence'], valeur: 'manifestation-introuvable' }]);
});

// ================================================================================================================ 6. ÉGALITÉ STRICTE
test('6. « Rennes » / « rennes » → différent : aucune canonisation, aucune casse ignorée, aucun espace retiré', async () => {
  const { x1, x2 } = await deVille();
  for (const v of ['rennes', 'Rennes ', 'RENNES']) {
    const y = copie(x2); y.acte.nouveau.valeur = v;
    const c = CS.confronterExperiencesSituees(x1, y);
    assert.deepEqual(parChemin(c.historique.differents)['acte.nouveau.valeur'], { chemin: ['acte', 'nouveau', 'valeur'], premiere: 'Rennes', seconde: v });
  }
});

// ================================================================================================================ 7. TABLEAUX
test('7. appuis [A, B] / [B, A] et obtenu [x, y] / [y, x] → tableaux différents EN ENTIER, aucun élément apparié', async () => {
  const { x1, x2 } = await deVille();
  const A = NANTES; const B = { sujet: 'moi', relation: 'vélo', valeur: 'Fusée' };
  const a = copie(x1); const b = copie(x2);
  a.situation.historique.reponseProduite.appuis = [A, B]; b.situation.historique.reponseProduite.appuis = [B, A];
  a.situation.historique.reponseProduite.obtenu = ['Nantes', 'Fusée']; b.situation.historique.reponseProduite.obtenu = ['Fusée', 'Nantes'];
  const c = CS.confronterExperiencesSituees(a, b);
  const d = parChemin(c.historique.differents);
  assert.deepEqual(d['situation.historique.reponseProduite.appuis'], { chemin: ['situation', 'historique', 'reponseProduite', 'appuis'], premiere: [A, B], seconde: [B, A] });
  assert.deepEqual(d['situation.historique.reponseProduite.obtenu'].seconde, ['Fusée', 'Nantes']);
  assert.ok(!JSON.stringify([c.historique, c.actuel]).includes('"appuis",0') && ![...c.historique.communs, ...c.historique.differents].some((x) => x.chemin.some((s) => typeof s === 'number')), 'aucun chemin n\'entre dans un tableau');
  // même contenu, même ordre → égal en entier
  b.situation.historique.reponseProduite.appuis = [A, B];
  assert.ok(ch(CS.confronterExperiencesSituees(a, b).historique.communs).includes('situation.historique.reponseProduite.appuis'));
});

// ================================================================================================================ 8. DÉCLARATIONS
test('8. déclarations courantes modifiées ou supprimées → compartiment historique STRICTEMENT identique ; seul l\'actuel change', async () => {
  const { w, p1, p2 } = await deVille();
  const paire = (xs) => CS.confronterExperiencesSituees(xs.find((x) => x.acte.idReponseAttendue === p1.p.idReponseAttendue), xs.find((x) => x.acte.idReponseAttendue === p2.p.idReponseAttendue));
  const ref = paire(await vue(w));
  for (const declarations of [{ capacites: CAPACITES, projectionRepondre: null }, { capacites: CAPACITES, projectionRepondre: { contraintes: [{ champ: 'sujet' }], delivre: 'valeur' } }, { capacites: {}, projectionRepondre: PROJECTION_REPONDRE_FAIT }]) {
    const c = paire(await vue(w, { declarations }));
    assert.deepEqual(c.historique, ref.historique);
    assert.deepEqual(c.identites, ref.identites);
  }
  const nulle = paire(await vue(w, { declarations: { capacites: CAPACITES, projectionRepondre: null } }));
  assert.notDeepEqual(nulle.actuel, ref.actuel);
  assert.deepEqual(ch(nulle.actuel.communs), ['situation.relecture.statut']);
  assert.deepEqual(parChemin(nulle.actuel.communs)['situation.relecture.statut'].valeur, 'non-relue');
});

// ================================================================================================================ 9. ESPRIT COURANT
test('9. esprit courant changé (Rennes remplacé par Brest) → seul actuel.resultatActuel change ; historique et identités identiques', async () => {
  const { w, p1, p2 } = await deVille();
  const paire = (xs) => CS.confronterExperiencesSituees(xs.find((x) => x.acte.idReponseAttendue === p1.p.idReponseAttendue), xs.find((x) => x.acte.idReponseAttendue === p2.p.idReponseAttendue));
  const avant = paire(await vue(w));
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'ville', valeur: 'Brest', origine: 'apprise-conversation' });
  const apres = paire(await vue(w));
  assert.deepEqual(apres.historique, avant.historique);
  assert.deepEqual(apres.identites, avant.identites);
  assert.deepEqual(avant.actuel.propres.seconde, [{ chemin: ['apres', 'resultatActuel'], valeur: true }]);
  assert.deepEqual(apres.actuel.propres.seconde, [{ chemin: ['apres', 'resultatActuel'], valeur: false }]);
  assert.deepEqual({ ...apres.actuel, propres: null }, { ...avant.actuel, propres: null });
});

// ================================================================================================================ 10. NON-CONTAMINATION
test('10a. module pur : aucune lecture, écriture, horloge, hasard ; aucun score, compte, seuil, distance, pondération, valence ; seuls deux exports', () => {
  const src = sansCommentaires(lu('app', 'langage', 'confrontations-situees.js'));
  assert.deepEqual(Object.keys(CS).sort(), ['confrontationsExperiencesSituees', 'confronterExperiencesSituees']);
  assert.doesNotMatch(src, /^\s*import\b/m, 'aucun import : le module ne lit rien, il reçoit des expériences');
  assert.doesNotMatch(src, /lireTout|ecrire|enregistrer|apprendre|oublier|magasin|Date|Math\.|horodatage|setTimeout|fetch|localStorage|indexedDB/);
  assert.doesNotMatch(src, /signature|similai|ressembl|analog|categor|distance|score|ratio|seuil|poids|pond[ée]r|confiance|probab|majorit|fr[ée]quence|compte|succ[eè]s|echec|échec|meilleur|pr[ée]f[ée]r|objectif|finalit|r[ée]compense|moyen|applicab|strat[ée]gi|d[ée]cision|initiative|besoin|occasion/i);
  // .sort() n'apparaît que sur des CLÉS (ordre technique) ; .length ne sert qu'aux parcours et contrôles de forme, jamais à une sortie
  assert.equal((src.match(/\.sort\(/g) || []).length, 2);
  assert.match(src, /Object\.keys\(v\)\.sort\(\)/);
  assert.match(src, /\[\.\.\.new Set\(\[\.\.\.Object\.keys\(a\), \.\.\.Object\.keys\(b\)\]\)\]\.sort\(\)/);
  assert.doesNotMatch(src, /\.length\s*[,}]|nombre|total|taille/);
});
test('10b. lecteurs : seul main.js importe la vue, dans le seul pont Diagnostic (qui reçoit les expériences N3b-0) ; aucune réponse ordinaire, aucune décision ne la lit', () => {
  const fichiers = [];
  const parcourir = (d) => { for (const n of readdirSync(join(RACINE, d), { withFileTypes: true })) { if (n.isDirectory()) parcourir(join(d, n.name)); else if (/\.(js|mjs|html)$/.test(n.name)) fichiers.push(join(d, n.name)); } };
  parcourir('app');
  const nommant = fichiers.filter((f) => /confrontations-situees|confronterExperiencesSituees|confrontationsExperiencesSituees/.test(sansCommentaires(readFileSync(join(RACINE, f), 'utf8')))).sort();
  assert.deepEqual(nommant, ['app/langage/confrontations-situees.js', 'app/main.js']);
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.equal((main.match(/confrontationsExperiencesSituees\(/g) || []).length, 1);
  assert.match(main, /confrontationsSituees: \(experiences\) => confrontationsExperiencesSituees\(experiences\),/);
  for (const zone of ['async function notesDesAppuis(', 'function proposerResolution(', 'function proposerReponseCorrigee(', 'async function traiterTour(']) {
    const i = main.indexOf(zone); assert.ok(i >= 0, zone);
    assert.doesNotMatch(main.slice(i, i + 4000), /confrontation(s)?(Situees|ExperiencesSituees)|confronterExperiences/, `${zone} ne lit pas la vue`);
  }
  for (const f of fichiers.filter((x) => !['app/main.js', 'app/langage/confrontations-situees.js', 'app/conversation/ecran.js'].includes(x))) {
    assert.doesNotMatch(sansCommentaires(readFileSync(join(RACINE, f), 'utf8')), /confrontationsSituees/, f);
  }
  const ui = sansCommentaires(lu('app', 'conversation', 'ecran.js'));
  assert.equal((ui.match(/capacite\.confrontationsSituees\(/g) || []).length, 1);
  assert.match(ui, /'Deux expériences mises en regard \(descriptions\)'/);
  assert.match(ui, /reconstruit aujourd\\'hui \(déclaration et état actuels\)/);
  // l'UI ne montre ni nombre ni classement : aucune longueur de liste de confrontation n'est affichée
  const bloc = ui.slice(ui.indexOf('function lignesRegard('), ui.indexOf('async function rafraichirCapacite('));
  assert.doesNotMatch(bloc, /\.length\}|\$\{[^}]*\.length|meilleur|classement|score|nombre de/);
});
test('10c. magasin, examinerResolution et réponses ordinaires strictement identiques avec ou sans mise en regard', async () => {
  const { w, p2 } = await deVille();
  const e = await E.chargerEsprit(w.magasin);
  const avant = { examen: RS.examinerResolution(await lignes(w), e, p2.p.idReponseAttendue), etats: RS.etatsDivergences(await lignes(w), e), magasin: await instantane(w) };
  const xs = await vue(w); const gel = JSON.stringify(xs);
  CS.confrontationsExperiencesSituees(xs); CS.confrontationsExperiencesSituees(xs);
  assert.equal(JSON.stringify(xs), gel, 'les expériences reçues ne sont pas modifiées');
  assert.deepEqual({ examen: RS.examinerResolution(await lignes(w), e, p2.p.idReponseAttendue), etats: RS.etatsDivergences(await lignes(w), e), magasin: await instantane(w) }, avant);
  const B = await repondreLocal(w, 'ma ville ?');
  assert.equal(B.r.texte, 'Rennes');
  assert.deepEqual(await notesVue(w, B.r.appuis), [NOTE_CONFIRMEE]);
});
test('10d. toutes les paires non ordonnées, dans l\'ordre reçu, sans sélection ni filtre (même une paire sans rien d\'égal)', async () => {
  const { w, xs } = await temoinsVilleCouleur();
  const { p } = await corrigerVille(w, 'Rennes'); await annuler(w, p);
  const trois = await vue(w);
  assert.equal(trois.length, 3);
  const paires = CS.confrontationsExperiencesSituees(trois);
  assert.deepEqual(paires.map((c) => c.identites.map((i) => i[0].valeur)), [[0, 1], [0, 2], [1, 2]].map(([i, j]) => [trois[i].acte.idReponseAttendue, trois[j].acte.idReponseAttendue]));
  assert.deepEqual(CS.confrontationsExperiencesSituees([]), []);
  assert.deepEqual(CS.confrontationsExperiencesSituees([trois[0]]), []);
  // une paire dont l'historique n'a AUCUN emplacement égal est rendue quand même
  const a = copie(xs[0]); const b = copie(xs[1]);
  b.acte.ancien = { sujet: 'Hugo', relation: 'chien', valeur: 'Rex' }; b.acte.nouveau = { sujet: 'Hugo', relation: 'chien', valeur: 'Max' };
  b.situation.historique.reponseProduite.voie = 'action'; b.situation.historique.absences = ['appui-incoherent']; b.apres = { ecritureCognitive: 'aucune' };
  const [c] = CS.confrontationsExperiencesSituees([a, b]);
  assert.deepEqual(c.historique.communs.filter((x) => x.chemin[0] !== 'apres'), []);
  // ordre inversé des entrées → mêmes paires, simplement énumérées dans l'autre ordre technique (miroirs)
  const inv = CS.confrontationsExperiencesSituees([...trois].reverse());
  assert.deepEqual(inv[0], miroir(paires[2]));
});

// ================================================================================================================ 11. CONTRAT
test('11. entrée hors contrat N3b-0 → refus explicite (TypeError), aucun résultat partiel', async () => {
  const { x1, x2 } = await deVille();
  const hors = [];
  const avec = (f) => { const y = copie(x2); f(y); hors.push(y); };
  avec((y) => { y.inconnu = 1; });
  avec((y) => { delete y.apres; });
  avec((y) => { y.acte.idReponseAttendue = ''; });
  avec((y) => { y.acte.ancien.valeur = 3; });
  avec((y) => { y.situation.historique.absences = ['absence-inventee']; });
  avec((y) => { y.situation.historique.question = 7; });
  avec((y) => { y.situation.relecture = { statut: 'relue' }; });
  avec((y) => { y.issue = { nature: 'reussie' }; });
  avec((y) => { y.issue = { nature: 'annulee', raison: 'x' }; });
  avec((y) => { y.apres = { ecritureCognitive: 'aucune' }; });
  avec((y) => { y.situation.historique.reponseProduite.obtenu = 'Nantes'; });
  avec((y) => { y.situation.historique.reaction.cible = { autre: 'x' }; });
  for (const y of hors) {
    assert.throws(() => CS.confronterExperiencesSituees(x1, y), TypeError, JSON.stringify(y).slice(0, 80));
    assert.throws(() => CS.confronterExperiencesSituees(y, x1), TypeError);
    assert.throws(() => CS.confrontationsExperiencesSituees([x1, y]), TypeError);
  }
  for (const v of [null, undefined, 'x', [], new Map()]) assert.throws(() => CS.confronterExperiencesSituees(x1, v), TypeError);
  assert.throws(() => CS.confrontationsExperiencesSituees(null), TypeError);
  assert.throws(() => CS.confrontationsExperiencesSituees({ length: 2, 0: x1, 1: x2 }), TypeError);
});

// ================================================================================================================ Z. AJOUTS
test('Z1. une relecture « non-relue » face à une relue reste dans l\'actuel : statut différent, champs propres, historique inchangé', async () => {
  const { x1, x2 } = await deVille();
  const y = copie(x2); y.situation.relecture = { statut: 'non-relue' };
  const c = CS.confronterExperiencesSituees(x1, y);
  assert.deepEqual(c.historique, CS.confronterExperiencesSituees(x1, x2).historique);
  assert.deepEqual(ch(c.actuel.differents), ['situation.relecture.statut']);
  assert.deepEqual(ch(c.actuel.propres.premiere), ['situation.relecture.base', 'situation.relecture.contraintes', 'situation.relecture.delivre', 'situation.relecture.porteeSurIdentite', 'situation.relecture.valeurDelivree']);
});
test('Z2. issue périmée (persistée, avec raison) face à une ouverte : la périmée est historique, l\'ouverte est actuelle ; aucune valence', async () => {
  const w = await monde();
  const a = await corrigerVille(w, 'Rennes');
  const e = await E.chargerEsprit(w.magasin);
  await E.apprendreFait(e, { sujet: 'moi', relation: 'ville', valeur: 'Paris', origine: 'apprise-conversation' });
  assert.equal((await confirmer(w, a.p)).perimee, true);
  const b = await corrigerVille(w, 'Lyon');
  const xs = await vue(w);
  const c = CS.confronterExperiencesSituees(xs.find((x) => x.acte.idReponseAttendue === a.p.idReponseAttendue), xs.find((x) => x.acte.idReponseAttendue === b.p.idReponseAttendue));
  assert.deepEqual(c.historique.propres.premiere, [{ chemin: ['issue', 'nature'], valeur: 'perimee' }, { chemin: ['issue', 'raison'], valeur: 'appui-non-actuel' }]);
  assert.deepEqual(c.actuel.propres.seconde, [{ chemin: ['issue', 'nature'], valeur: 'ouverte' }]);
});
test('Z3. redémarrage → mêmes mises en regard à code identique', async () => {
  const { w } = await temoinsVilleCouleur();
  const avant = CS.confrontationsExperiencesSituees(await vue(w));
  const w2 = await redemarrer(w);
  assert.deepEqual(CS.confrontationsExperiencesSituees(await vue(w2)), avant);
});

// ---- 10e. Écran (faux DOM repris de tests/environnement-conversation.test.mjs) ----

class Faux {
  get parentNode() { return this.parent; }
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; this._cls = new Set(); this.disabled = false; this.textContent = ''; this.innerHTML = ''; this.value = ''; this.style = {}; this.hidden = false; this.scrollTop = 0; this.scrollHeight = 0; this.attrs = {}; }
  get className() { return [...this._cls].join(' '); }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this._cls; return { add: (...c) => c.forEach((x) => s.add(x)), remove: (...c) => c.forEach((x) => s.delete(x)), toggle: (c, f) => (f ? s.add(c) : s.delete(c)), contains: (c) => s.has(c) }; }
  get childNodes() { return this.children; }
  get isConnected() { return true; }
  appendChild(c) { if (c.parent) c.remove(); c.parent = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  insertBefore(c, ref) { if (c.parent) c.remove(); c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  querySelector(sel) { const t = (e) => (sel.startsWith('.') ? e._cls.has(sel.slice(1)) : e.tag === sel.replace(/\[.*\]/, '')); const parcourir = (e) => { for (const c of e.children) { if (t(c)) return c; const r = parcourir(c); if (r) return r; } return null; }; return parcourir(this); }
}
const textes = (e) => [e.textContent, ...e.children.flatMap(textes)].filter(Boolean);
test('10e. écran : la zone Diagnostic montre les paires (historique puis reconstruit aujourd\'hui), sans nombre ni classement ; aucune ligne dans la conversation', async () => {
  globalThis.document = { createElement: (tag) => new Faux(tag) };
  globalThis.window = globalThis;
  const { monterConversation } = await import('../app/conversation/ecran.js');
  const { xs } = await temoinsVilleCouleur();
  const page = new Faux('main'); const liste = new Faux('div'); const formulaire = new Faux('form'); const champ = new Faux('textarea'); const bouton = new Faux('button');
  page.append(liste, formulaire);
  formulaire.querySelector = (sel) => (sel === 'textarea' ? champ : sel.includes('submit') ? bouton : null);
  const capacite = { lire: async () => ({ valeur: 3, plafond: 3, derniere: null, besoins: [] }), repos: async () => ({}), experiencesSituees: async () => xs, confrontationsSituees: (e) => CS.confrontationsExperiencesSituees(e) };
  const conv = monterConversation({ liste, formulaire, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: async () => ({ texte: 'ok' }), capacite });
  await conv.recharger();
  const zone = page.children.find((c) => c._cls.has('diagnostic'));
  assert.ok(zone, 'zone Diagnostic montée');
  const t = textes(zone);
  const i = t.indexOf('Deux expériences mises en regard (descriptions)');
  assert.ok(i > t.indexOf('Propositions de résolution vécues (relecture)'), 'sous la relecture N3b-0');
  const apres = t.slice(i);
  assert.ok(apres.includes('traces historiques :') && apres.includes('reconstruit aujourd\'hui (déclaration et état actuels) :'));
  assert.ok(apres.indexOf('traces historiques :') < apres.indexOf('reconstruit aujourd\'hui (déclaration et état actuels) :'));
  assert.ok(apres.includes('égal · acte › ancien › sujet : « moi »'));
  assert.ok(apres.includes('différent · situation › historique › question : « ma ville ? » / « ma couleur ? »'));
  assert.ok(apres.includes('égal · issue › nature : « ouverte »'), 'issue ouverte dans la section actuelle');
  assert.doesNotMatch(apres.join('\n'), /\d+ (égal|différen|ressembl|point)|meilleur|classement|score|similai|analog/);
  assert.ok(!textes(liste).some((x) => /mises en regard|égal ·|différent ·/.test(x)), 'rien dans la conversation ordinaire');
  // vue en échec → message neutre, la relecture N3b-0 reste affichée
  const page2 = new Faux('main'); const liste2 = new Faux('div'); const f2 = new Faux('form'); page2.append(liste2, f2);
  f2.querySelector = formulaire.querySelector;
  const conv2 = monterConversation({ liste: liste2, formulaire: f2, chargerRecents: async () => [], etat: async () => 'pret', naitre: async () => {}, ouvrirReglages() {}, repondre: async () => ({ texte: 'ok' }), capacite: { ...capacite, confrontationsSituees: () => { throw new Error('x'); } } });
  await conv2.recharger();
  const t2 = textes(page2.children.find((c) => c._cls.has('diagnostic')));
  assert.ok(t2.includes('mise en regard non lisible') && t2.includes('Propositions de résolution vécues (relecture)'));
});
