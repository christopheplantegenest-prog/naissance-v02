// v0.64.19 — « APPRENDRE À UTILISER UNE CONNAISSANCE PAR LA RÉPONSE ATTENDUE » (GO ChatGPT « v0.64.19 », 14/10/2026).
// Une question naturelle + la réponse attendue (« Apprends : Réponse : … », via Répondre) → Naissance cherche quelle capacité de LECTURE déclarée,
// avec quels jetons de la question, explique EXACTEMENT la réponse ; deux exemples indépendants convergeant vers UNE explication → proposition
// d'une forme de question ; Confirmer → Action validée induite-supervisee ; une question inédite est ensuite répondue localement.
// Chemin rejoué avec les fonctions réelles que main.js appelle ; reconnaissance par le VRAI écran de langage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const { identifierMessage, conserverValeurMessage } = await import('../app/langage/pont.js');
const { chargerEsprit, apprendreFait, oublierFait, repondre } = await import('../app/langage/esprit.js');
const { reconnaitreActions } = await import('../app/langage/action.js');
const F = await import('../app/langage/formes-confirmees.js');
const R = await import('../app/langage/reponses-attendues.js');
const { identiteRegle, regleDeLAction } = await import('../app/langage/regle-forme.js');
const { CAPACITES } = await import('../app/langage/registre.js');
const { monterEcranLangage } = await import('../app/langage/ecran.js');
const S = await import('../app/memoire/sauvegarde.js');

const RACINE = new URL('..', import.meta.url).pathname;
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const FAITS = [['Hugo', 'chien', 'Rex'], ['Paul', 'métier', 'pilote'], ['Léa', 'surnom', 'Puce'], ['moi', 'tracteur', 'Hercule']];
async function monde(faits = FAITS) {
  const magasin = C.magasinMemoireVive();
  const e = await chargerEsprit(magasin);
  for (const [sujet, relation, valeur] of faits) await apprendreFait(e, { sujet, relation, valeur, origine: 'apprise-conversation' });
  return { magasin, e };
}
async function recevoir(magasin, texte) {
  const message = identifierMessage(texte, { nouvelId: C.nouvelId });
  await conserverValeurMessage(message, { enregistrerValeur: (entree) => C.enregistrerValeurDonnee(magasin, entree) });
  return message;
}
// Q naturelle, « Répondre » sur Q, L « Apprends : Réponse : r. », Confirmer : la réponse attendue est écrite, PUIS l'inducteur est consulté pour Q
// (exactement l'ordre de proposerReponseAttendue dans main.js, vérifié par RA11 dans la source).
async function superviser(w, question, reponse, capacites) {
  const Q = await recevoir(w.magasin, question);
  const L = await recevoir(w.magasin, `Apprends : Réponse : ${reponse}.`);
  const extrait = R.extraireReponseAttendue(L.texte.replace(/^apprends\s*:\s*/i, ''));
  await C.enregistrerReponseAttendue(w.magasin, { idMessage: Q.id, reponse: extrait.reponse, idLecon: L.id });
  const examen = await R.examinerReponseApresSupervision(w.magasin, w.e, Q.id, capacites);
  return { Q, L, examen };
}
async function confirmerRegle(w, proposition) {
  const r = await F.confirmerFormeSupervisee(w.magasin, proposition);
  w.e.actions = await w.magasin.lireTout('actions');
  return r;
}
async function redemarrer(w) {
  const donnees = {};
  for (const t of C.TABLES) donnees[t] = JSON.parse(JSON.stringify(await w.magasin.lireTout(t)));
  const magasin = C.magasinMemoireVive();
  await magasin.remplacerTout(donnees);
  return { magasin, e: await chargerEsprit(magasin) };
}
const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
const ecranSur = (magasin) => monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
const Q1 = ['Qui a pour chien Rex ?', 'Hugo'];
const Q2 = ['Qui a pour métier pilote ?', 'Paul'];
const REGLE_ATTENDUE = { operation: 'recherche', n: 6, ancres: [{ position: 0, jeton: 'Qui' }, { position: 1, jeton: 'a' }, { position: 2, jeton: 'pour' }, { position: 5, jeton: '?' }], roles: [{ position: 3, nom: 'relation' }, { position: 4, nom: 'valeur' }], constantes: {} };

// ================================================================================================================ RA0. CAPACITÉS DE LECTURE (E, F)
test('RA0. capacités admissibles : SEULE recherche déclare `lecture` ; une capacité sans lecture ou qui propose un fait n\'est jamais candidate', () => {
  assert.deepEqual(R.capacitesDeLecture(), ['recherche']);
  for (const nom of Object.keys(CAPACITES)) assert.equal(Boolean(CAPACITES[nom].lecture), nom === 'recherche', nom);
  assert.ok(Object.isFrozen(CAPACITES.recherche.lecture));
  assert.deepEqual(CAPACITES.recherche.lecture.reponses({ sujets: ['Hugo', 'Zoé'] }), ['Hugo', 'Zoé']);
  assert.deepEqual(CAPACITES.recherche.lecture.reponses(null), []);
  // F : une capacité qui propose un fait est exclue même si elle déclarait une lecture
  const effet = Object.freeze({ ...CAPACITES.proposerFaitComplet, lecture: CAPACITES.recherche.lecture });
  assert.deepEqual(R.capacitesDeLecture({ recherche: CAPACITES.recherche, effet }), ['recherche']);
  // E : une capacité de même contrat SANS déclaration n'est jamais essayée
  const muette = Object.freeze({ roles: CAPACITES.recherche.roles, invoquer: CAPACITES.recherche.invoquer, representer: CAPACITES.recherche.representer });
  assert.deepEqual(R.capacitesDeLecture({ muette }), []);
  // l'inducteur ne nomme aucune capacité
  assert.doesNotMatch(sansCommentaires(lu('app', 'langage', 'reponses-attendues.js')), /'recherche'|'proposerFait|'deduction'|'confrontation'/);
});

// ================================================================================================================ RA1. DÉCISIF
test('RA1. décisif : Q1 → Hugo (aucune proposition) ; Q2 → Paul → « Qui a pour X Y ? » proposée ; Confirmer ; redémarrage ; « Qui a pour surnom Puce ? » → Léa, localement, aucune connaissance écrite', async () => {
  let w = await monde();
  assert.equal(repondre(w.e, 'Qui a pour surnom Puce ?').texte, 'Je n\'ai pas compris.', 'l\'ancien comprendre/repondre ne sait pas répondre');
  // explication unique de Q1 seul (contrat exact)
  const ex1 = R.explications(...Q1, w.e);
  assert.deepEqual(ex1.map((x) => x.regle), [REGLE_ATTENDUE]);
  const t1 = await superviser(w, ...Q1);
  assert.deepEqual(t1.examen, { raison: 'insuffisant' }, 'A : une seule question, même expliquée, ne démontre aucune forme');
  const t2 = await superviser(w, ...Q2);
  const p = t2.examen.proposition;
  assert.ok(p, JSON.stringify(t2.examen));
  assert.deepEqual(p.regle, REGLE_ATTENDUE);
  assert.equal(p.idCandidat, identiteRegle(REGLE_ATTENDUE));
  assert.deepEqual(p.exemples, [Q1[0], Q2[0]]);
  assert.deepEqual(p.sources, [t1.Q.id, t2.Q.id].sort());
  assert.equal(p.texte, [
    "J'ai remarqué une forme commune à tes exemples :",
    '« Qui a pour chien Rex ? » → Hugo',
    '« Qui a pour métier pilote ? » → Paul',
    '',
    'Je propose de comprendre désormais :',
    '« Qui a pour X Y? »', // reassembler (transformation.js, inchangé) ne met jamais d'espace avant une ponctuation finale
    'comme : chercher qui a X → Y dans ce que je sais.',
    '',
    'Est-ce correct ?',
  ].join('\n'));
  assert.doesNotMatch(p.texte, /recherche|relation|valeur|position|forme-[0-9a-f]/, 'aucun nom interne affiché');
  assert.deepEqual(await w.magasin.lireTout('actions'), [], 'rien d\'actif avant Confirmer');
  const faitsAvant = JSON.stringify(await w.magasin.lireTout('faits'));
  const { action, decision, echecDecision } = await confirmerRegle(w, p);
  assert.equal(echecDecision, null);
  assert.deepEqual({ operation: action.operation, statut: action.statut, origine: action.origine, roles: action.roles, n: action.n },
    { operation: 'recherche', statut: 'validee', origine: 'induite-supervisee', roles: REGLE_ATTENDUE.roles, n: 6 });
  assert.equal(Object.hasOwn(action, 'constantes'), false);
  assert.deepEqual(action.exemples.map((x) => x.entree), [Q1[0], Q2[0]]);
  assert.deepEqual(decision, { idCandidat: p.idCandidat, decision: 'confirmee', sources: p.sources, idAction: action.id });
  assert.equal(identiteRegle(regleDeLAction(action)), p.idCandidat);
  // redémarrage, question inédite
  w = await redemarrer(w);
  const reco = await ecranSur(w.magasin).tenterReconnaissanceAction('Qui a pour surnom Puce ?');
  assert.equal(reco.reconnu, true); assert.equal(reco.ok, true);
  assert.equal(reco.operation, 'recherche'); assert.equal(reco.idAction, action.id);
  assert.equal(reco.proposeFait, false, 'chemin de réponse locale, jamais le canal pédagogique');
  assert.deepEqual(reco.resultat, { sujets: ['Léa'] });
  assert.equal(reco.texte, 'Résultat (recherche locale) : Léa.');
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), faitsAvant, 'aucune connaissance écrite par la réponse');
  assert.equal(reconnaitreActions(w.e.actions, 'Qui est le chien de Hugo ?').etat, 'aucune', 'autre signature : non captée');
});

// ================================================================================================================ RA2. EXPLICATIONS (C, D, G, O)
test('RA2. intersection : deux explications communes → abstention (registre injecté, tous ordres) ; aucune explication → abstention ; coïncidence sur Q1 éliminée par Q2', async () => {
  // C
  const jumelle = Object.freeze({ ...CAPACITES.recherche });
  for (const reg of [{ recherche: CAPACITES.recherche, zJumelle: jumelle }, { aJumelle: jumelle, recherche: CAPACITES.recherche }]) {
    const w = await monde();
    await superviser(w, ...Q1, reg);
    assert.deepEqual((await superviser(w, ...Q2, reg)).examen, { raison: 'plusieurs-explications' }, Object.keys(reg).join(','));
  }
  // D
  const w2 = await monde();
  assert.deepEqual(R.explications('Qui a pour chien Rex ?', 'Paul', w2.e), []);
  assert.deepEqual((await superviser(w2, 'Qui a pour chien Rex ?', 'Paul')).examen, { raison: 'aucune-explication' });
  assert.deepEqual(R.explications('Bonjour toi', 'Hugo', w2.e), []);
  // G : une capacité de lecture « fantôme » rend toujours Hugo : Q1 a de nombreuses explications accidentelles ; Q2 (Paul) les élimine
  const fantome = Object.freeze({ roles: Object.freeze(['a', 'b']), lecture: Object.freeze({ reponses: () => ['Hugo'], sens: () => 'deviner' }), invoquer: () => ({}), representer: () => '' });
  const reg = { recherche: CAPACITES.recherche, fantome };
  const w3 = await monde();
  assert.ok(R.explications(...Q1, w3.e, reg).length > 1, 'Q1 seul : plusieurs explications');
  await superviser(w3, ...Q1, reg);
  const t = await superviser(w3, ...Q2, reg);
  assert.deepEqual(t.examen.proposition.regle, REGLE_ATTENDUE, 'seule l\'explication commune survit');
  // O : un résultat multiple n'explique pas une réponse (aucun choix) ; la forme apprise rend la collection entière
  const w4 = await monde([...FAITS, ['Zoé', 'chien', 'Rex']]);
  assert.deepEqual(R.explications(...Q1, w4.e), [], 'recherche(chien, Rex) = [Hugo, Zoé] : n\'explique pas « Hugo »');
  const w5 = await monde();
  await superviser(w5, ...Q1);
  await confirmerRegle(w5, (await superviser(w5, ...Q2)).examen.proposition);
  await apprendreFait(w5.e, { sujet: 'Zoé', relation: 'surnom', valeur: 'Puce', origine: 'apprise-conversation' });
  const reco = await ecranSur(w5.magasin).tenterReconnaissanceAction('Qui a pour surnom Puce ?');
  assert.equal(reco.texte, 'Résultat (recherche locale) : Léa, Zoé.', 'collection entière, aucun sujet choisi');
});

// ================================================================================================================ RA3. REVALIDATION (H)
test('RA3. revalidation : un fait oublié après Q1 → Q1 n\'est plus une preuve → aucune proposition ; le fait réappris → la proposition revient', async () => {
  const w = await monde();
  await superviser(w, ...Q1);
  await oublierFait(w.e, { sujet: 'Hugo', relation: 'chien' });
  const t2 = await superviser(w, ...Q2);
  assert.deepEqual(t2.examen, { raison: 'insuffisant' }, 'aucun cache de vérité : Q1 rejouée contre l\'état actuel');
  await apprendreFait(w.e, { sujet: 'Hugo', relation: 'chien', valeur: 'Rex', origine: 'apprise-conversation' });
  const again = await R.examinerReponseApresSupervision(w.magasin, w.e, t2.Q.id);
  assert.deepEqual(again.proposition.regle, REGLE_ATTENDUE);
});

// ================================================================================================================ RA4. INDÉPENDANCE (I, J, K) ET RÔLES DÉMONTRÉS
test('RA4. ordre inversé → même identité ; même message deux fois → refusé ; même question dans deux messages → UN exemple ; réponses différentes → contradiction ; rôle jamais varié → non démontré', async () => {
  const a = await monde();
  await superviser(a, ...Q1);
  const pa = (await superviser(a, ...Q2)).examen.proposition;
  const b = await monde();
  await superviser(b, ...Q2);
  const pb = (await superviser(b, ...Q1)).examen.proposition;
  assert.equal(pa.idCandidat, pb.idCandidat, 'I');
  // J
  const w = await monde();
  const { Q, L } = await superviser(w, ...Q1);
  await assert.rejects(() => C.enregistrerReponseAttendue(w.magasin, { idMessage: Q.id, reponse: 'Hugo', idLecon: L.id }), /déjà sa réponse attendue/);
  // K : la même question, deux messages, même réponse → un seul exemple
  const k = await monde();
  await superviser(k, ...Q1);
  assert.deepEqual((await superviser(k, ...Q1)).examen, { raison: 'insuffisant' });
  assert.equal(R.exemplesIndependants(await k.magasin.lireTout('reponsesAttendues'), await k.magasin.lireTout('valeursDonnees')).length, 1);
  // K' : même question, réponses différentes → contradictoire, jamais une preuve
  const kc = await monde();
  await superviser(kc, ...Q1);
  assert.deepEqual((await superviser(kc, 'Qui a pour chien Rex ?', 'Paul')).examen, { raison: 'contradiction' });
  // rôle non démontré : la relation ne varie jamais
  const r = await monde([...FAITS, ['Zoé', 'chien', 'Médor']]);
  await superviser(r, ...Q1);
  assert.deepEqual((await superviser(r, 'Qui a pour chien Médor ?', 'Zoé')).examen, { raison: 'role-non-demontre' });
  assert.deepEqual(await r.magasin.lireTout('actions'), []);
});

// ================================================================================================================ RA5. REFUS / CONFIRMATION PERSISTANTS (L, M) ET COLLISIONS
test('RA5. Refuser → décision refusee persistante après redémarrage, jamais reproposée ; Confirmer → Action active après redémarrage, plus de proposition (déjà décidée) ; Action d\'une autre règle sur le même squelette → abstention', async () => {
  let w = await monde();
  await superviser(w, ...Q1);
  const p = (await superviser(w, ...Q2)).examen.proposition;
  const d = await F.refuserFormeSupervisee(w.magasin, p);
  assert.deepEqual(d, { idCandidat: p.idCandidat, decision: 'refusee', sources: p.sources });
  w = await redemarrer(w);
  assert.deepEqual((await superviser(w, 'Qui a pour surnom Puce ?', 'Léa')).examen, { raison: 'deja-decidee' });
  assert.deepEqual(await ecranSur(w.magasin).tenterReconnaissanceAction('Qui a pour surnom Puce ?'), { reconnu: false });
  let w2 = await monde();
  await superviser(w2, ...Q1);
  const { action } = await confirmerRegle(w2, (await superviser(w2, ...Q2)).examen.proposition);
  w2 = await redemarrer(w2);
  assert.equal((await ecranSur(w2.magasin).tenterReconnaissanceAction('Qui a pour surnom Puce ?')).idAction, action.id);
  assert.deepEqual((await superviser(w2, 'Qui a pour surnom Puce ?', 'Léa')).examen, { raison: 'deja-decidee' });
  // collision : une Action active d'une autre règle (rôles inversés) occupe le squelette
  const w3 = await monde();
  await C.apprendreAction(w3.magasin, { operation: 'recherche', roles: [{ position: 3, nom: 'valeur' }, { position: 4, nom: 'relation' }], n: 6, exemples: [{ entree: Q1[0] }, { entree: Q2[0] }], statut: 'validee', origine: 'apprise-conversation' });
  await superviser(w3, ...Q1);
  assert.deepEqual((await superviser(w3, ...Q2)).examen, { raison: 'squelette-occupe' });
});

// ================================================================================================================ RA6. PERSISTANCE
test('RA6. enregistrerReponseAttendue : champs exacts, réponse non vide, messages résolubles, pas d\'auto-référence, immuable ; ce n\'est pas un fait', async () => {
  const w = await monde();
  const Q = await recevoir(w.magasin, Q1[0]);
  const L = await recevoir(w.magasin, 'Apprends : Réponse : Hugo.');
  const ecrire = (x) => C.enregistrerReponseAttendue(w.magasin, x);
  await assert.rejects(() => ecrire({ idMessage: Q.id, reponse: 'Hugo', idLecon: L.id, score: 1 }), /champ étranger/);
  await assert.rejects(() => ecrire({ idMessage: Q.id, reponse: '  ', idLecon: L.id }), /texte non vide/);
  await assert.rejects(() => ecrire({ idMessage: 'message-inconnu', reponse: 'Hugo', idLecon: L.id }), /aucun message conservé/);
  await assert.rejects(() => ecrire({ idMessage: Q.id, reponse: 'Hugo', idLecon: 'message-inconnu' }), /aucune leçon conservée/);
  await assert.rejects(() => ecrire({ idMessage: Q.id, reponse: 'Hugo', idLecon: Q.id }), /elle-même/);
  const faits = JSON.stringify(await w.magasin.lireTout('faits'));
  const manifs = JSON.stringify(await w.magasin.lireTout('manifestationsFaits'));
  assert.deepEqual(await ecrire({ idMessage: Q.id, reponse: ' Hugo ', idLecon: L.id }), { idMessage: Q.id, reponse: 'Hugo', idLecon: L.id });
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), faits);
  assert.equal(JSON.stringify(await w.magasin.lireTout('manifestationsFaits')), manifs, 'manifestationsFaits n\'est pas détournée');
  assert.deepEqual(R.extraireReponseAttendue('Réponse : Hugo.'), { reponse: 'Hugo' });
  assert.deepEqual(R.extraireReponseAttendue('reponse:Léa'), { reponse: 'Léa' });
  assert.deepEqual(R.extraireReponseAttendue('Réponse : '), { reponse: '' });
  assert.equal(R.extraireReponseAttendue('Fait : Hugo / chien / Rex.'), null);
});

test('RA7. table reponsesAttendues : déclarée en dernier (clé idMessage), VERSION_BASE 27 ; migration 26 → 27 ne crée QUE cette table ; sauvegarde schéma 17 (16 complété par [], 17 sans la table = incomplet, 18 refusé)', async () => {
  assert.equal(C.TABLES.at(-1), 'reponsesAttendues'); assert.equal(C.CLE.reponsesAttendues, 'idMessage');
  assert.equal(C.VERSION_BASE, 27); assert.equal(S.SCHEMA_SAUVEGARDE, 17); assert.equal(C.TABLES.length, 33);
  const existants = C.TABLES.filter((t) => t !== 'reponsesAttendues');
  const donnees = new Map(existants.map((t) => [t, [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }]]));
  const crees = []; let version = null;
  const fabrique = { open(n, v) { version = v; const db = { objectStoreNames: { contains: (t) => donnees.has(t) }, createObjectStore: (t, o) => { crees.push([t, o.keyPath]); donnees.set(t, []); }, onversionchange: null, close() {}, transaction: () => ({}) }; const r = { result: db, error: null, onupgradeneeded: null, onsuccess: null, onerror: null }; Promise.resolve().then(() => { r.onupgradeneeded(); r.onsuccess(); }); return r; } };
  await C.ouvrirIndexedDB(fabrique);
  assert.equal(version, 27);
  assert.deepEqual(crees, [['reponsesAttendues', 'idMessage']]);
  for (const t of existants) assert.deepEqual(donnees.get(t), [{ [C.CLE[t]]: 'x', contenu: `ancien-${t}` }], t);
  const w = await monde();
  await superviser(w, ...Q1);
  const { creerMemoire } = await import('../app/memoire/memoire.js');
  const { creerMagasinMemoire } = await import('../app/memoire/magasin.js');
  const memoire = creerMemoire(creerMagasinMemoire());
  const TABLES_MEMOIRE = Object.keys(await memoire.exporterDonnees());
  const fichier = await S.construireSauvegardeComplete({ memoire, magasinLangage: w.magasin, idNaissance: 'id', versionAppli: '0.64.19', maintenant: new Date('2026-10-14T20:00:00Z') });
  assert.equal(fichier.objet.schema, 17);
  const lue = await S.lireSauvegardeComplete(fichier.contenu, { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lue.ok, true, lue.erreur);
  assert.deepEqual(lue.donnees.langage.reponsesAttendues, await w.magasin.lireTout('reponsesAttendues'));
  const { empreinte } = await import('../app/memoire/transfert.js');
  const refaire = async (o) => JSON.stringify({ ...o, empreinte: await empreinte(JSON.stringify(o.donnees)) });
  const ancien = JSON.parse(fichier.contenu); ancien.schema = 16; delete ancien.donnees.langage.reponsesAttendues;
  const lu1 = await S.lireSauvegardeComplete(await refaire(ancien), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu1.ok, true, lu1.erreur); assert.deepEqual(lu1.donnees.langage.reponsesAttendues, []);
  const incomplet = JSON.parse(fichier.contenu); delete incomplet.donnees.langage.reponsesAttendues;
  const lu2 = await S.lireSauvegardeComplete(await refaire(incomplet), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu2.ok, false); assert.match(lu2.erreur, /incomplet/);
  const futur = JSON.parse(fichier.contenu); futur.schema = 18;
  const lu3 = await S.lireSauvegardeComplete(await refaire(futur), { tablesMemoire: TABLES_MEMOIRE });
  assert.equal(lu3.ok, false); assert.match(lu3.erreur, /plus récente/);
});

// ================================================================================================================ RA8. NON-RÉGRESSION (P, Q)
test('RA8. non-régression : formes de fait v0.64.17/18 toujours proposées ; une forme de question n\'interfère pas avec elles ; rejeu : recherche reste rejouable comme avant', async () => {
  const w = await monde();
  await superviser(w, ...Q1);
  await confirmerRegle(w, (await superviser(w, ...Q2)).examen.proposition);
  // forme de fait complète apprise à côté
  const sup = async (texteM, s, r, v) => {
    const M = await recevoir(w.magasin, texteM);
    const L = await recevoir(w.magasin, `Apprends : Fait : ${s} / ${r} / ${v}.`);
    const res = await apprendreFait(w.e, { sujet: s, relation: r, valeur: v, origine: 'apprise-conversation' });
    const fait = { sujet: res.objet.sujet, relation: res.objet.relation, valeur: res.objet.valeur };
    await C.enregistrerManifestationFait(w.magasin, { idMessage: L.id, fait, voie: { nom: 'lecon-technique' } });
    await C.enregistrerManifestationFait(w.magasin, { idMessage: M.id, fait: { ...fait }, voie: { nom: 'reference-explicite', idLecon: L.id } });
    return F.examinerFormeApresSupervision(w.magasin, M.id);
  };
  await sup('Le métier de Zoé est pilote.', 'Zoé', 'métier', 'pilote');
  const pf = (await sup('Le surnom de Max est Bip.', 'Max', 'surnom', 'Bip')).proposition;
  assert.equal(pf.regle.operation, 'proposerFaitComplet');
  await confirmerRegle(w, pf);
  const ecran = ecranSur(w.magasin);
  assert.equal((await ecran.tenterReconnaissanceAction('Le chien de Hugo est Rex.')).proposeFait, true);
  assert.equal((await ecran.tenterReconnaissanceAction('Qui a pour chien Rex ?')).texte, 'Résultat (recherche locale) : Hugo.');
  // les réponses attendues ne touchent ni les familles de faits ni les manifestations
  assert.equal((await w.magasin.lireTout('manifestationsFaits')).some((m) => m.idMessage && (m.fait.valeur === 'Hugo' || m.fait.sujet === 'Hugo')), false);
  assert.equal(CAPACITES.recherche.rejouable, undefined, 'recherche reste rejouable (aucune propriété de rejeu ajoutée)');
});

// ================================================================================================================ RA9. RACCORDS (source)
test('RA9. main.js : « Apprends : Réponse » examiné AVANT extraireLecon ; refus sans référence ; écriture dans onOui puis SEULEMENT l\'inducteur ; Confirmer/Refuser réutilisent les fonctions de forme ; registre : lecture déclarative', () => {
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.match(main, /import \{ extraireReponseAttendue, examinerReponseApresSupervision \} from '\.\/langage\/reponses-attendues\.js';/);
  const bloc = main.slice(main.indexOf('if (MARQUEUR_APPRENTISSAGE.test(texte)) {'));
  const iRep = bloc.indexOf('const reponseAttendue = extraireReponseAttendue(contenuLecon);');
  const iLecon = bloc.indexOf('const extrait = extraireLecon(contenuLecon);');
  assert.ok(iRep > 0 && iRep < iLecon, 'branche Réponse avant les leçons ordinaires');
  assert.match(bloc, /if \(reponseAttendue\) return proposerReponseAttendue\(texte, reponseAttendue\.reponse, message, referenceSupervisee\(options, message\)\);/);
  const def = main.slice(main.indexOf('function proposerReponseAttendue('), main.indexOf('async function propositionDeReponse('));
  assert.match(def, /if \(!reference\) return \{ texte:/);
  const oui = def.slice(def.indexOf('onOui:'), def.indexOf('onNon:'));
  const iEcrire = oui.indexOf('await enregistrerReponseAttendue(e.magasin, { idMessage: reference.idMessage, reponse, idLecon: message.id });');
  const iInduire = oui.indexOf('propositionQuestion = await propositionDeReponse(reference.idMessage);');
  assert.ok(iEcrire > 0 && iEcrire < iInduire);
  assert.doesNotMatch(def.slice(def.indexOf('onNon:')), /enregistrerReponseAttendue|propositionDeReponse/);
  const prop = main.slice(main.indexOf('async function propositionDeReponse('), main.indexOf('async function traiterTour('));
  assert.match(prop, /await confirmerFormeSupervisee\(esp\.magasin, proposition\);\s*esp\.actions = await esp\.magasin\.lireTout\('actions'\);/);
  assert.match(prop, /await refuserFormeSupervisee\(esp\.magasin, proposition\);/);
  assert.match(prop, /libelleNon: 'Refuser'/);
  assert.doesNotMatch(main, /'recherche'/);
  const module = sansCommentaires(lu('app', 'langage', 'reponses-attendues.js'));
  assert.doesNotMatch(module, /lireTout\(|'reponsesAttendues'|'valeursDonnees'|ecrire\(/, 'aucune table nommée, aucune écriture hors connaissances.js');
  assert.match(module, /valeurs\.length === 1 && typeof valeurs\[0\] === 'string' && canoniser\(valeurs\[0\]\) === canoniser\(reponse\)/, 'contrat exact d\'« explique »');
});
