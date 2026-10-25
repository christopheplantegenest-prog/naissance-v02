// v0.64.18 — « UNE FORME APPRISE PEUT PORTER LES TROIS CHAMPS D'UN FAIT » (GO ChatGPT « v0.64.18 », 14/10/2026).
// Une famille supervisée DÉTERMINÉE dont sujet, relation et valeur sont tous des RÔLES (portés par le texte) est désormais compatible avec la
// septième capacité, proposerFaitComplet (roles [sujet, relation, valeur], aucune constante) ; la famille à sujet constant reste celle de
// proposerFait. Les capacités de fait sont reconnues par la propriété DÉCLARATIVE `proposeFait: true` ; elles ne sont jamais rejouées
// (`rejouable: false`). Le chemin est REJOUÉ avec les fonctions réelles que main.js appelle (même patron que tests/formes-confirmees.test.mjs) ;
// la reconnaissance et le rejeu passent par le VRAI écran de langage (monterEcranLangage), comme tests/rejeu-autonome.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const C = await import('../app/langage/connaissances.js');
const { identifierMessage, conserverValeurMessage } = await import('../app/langage/pont.js');
const { chargerEsprit, apprendreFait, repondre } = await import('../app/langage/esprit.js');
const { extraireLecon } = await import('../app/langage/lecon.js');
const { evaluerAction, reconnaitreActions, invoquerAction } = await import('../app/langage/action.js');
const { reconnaitreAffirmationPossessive } = await import('../app/langage/interpretation.js');
const F = await import('../app/langage/formes-confirmees.js');
const { identiteRegle, regleDeLAction } = await import('../app/langage/regle-forme.js');
const { formesSupervisees } = await import('../app/langage/formes-supervisees.js');
const { CAPACITES } = await import('../app/langage/registre.js');
const { monterEcranLangage } = await import('../app/langage/ecran.js');
const { possibilitesRejeuAdmissibles } = await import('../app/langage/vue-traces.js');
const S = await import('../app/memoire/sauvegarde.js');

const RACINE = new URL('..', import.meta.url).pathname;
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// --- CHEMIN RÉEL (rejoué) --------------------------------------------------------------------------------------------------------------------------
async function monde() { const magasin = C.magasinMemoireVive(); return { magasin, e: await chargerEsprit(magasin) }; }
async function recevoir(magasin, texte) {
  const message = identifierMessage(texte, { nouvelId: C.nouvelId });
  await conserverValeurMessage(message, { enregistrerValeur: (entree) => C.enregistrerValeurDonnee(magasin, entree) });
  return message;
}
// M naturel, « Répondre » sur M, L « Apprends : Fait : … », Confirmer : fait, manifestation L, manifestation M, PUIS examinerFormeApresSupervision(M).
async function superviser(w, texteM, texteL) {
  const M = await recevoir(w.magasin, texteM);
  const nonCompris = reconnaitreActions(w.e.actions || [], texteM).etat === 'aucune' && !reconnaitreAffirmationPossessive(texteM, { lexique: w.e.lexique }).ok;
  const L = await recevoir(w.magasin, texteL);
  const { donnees } = extraireLecon(texteL.replace(/^apprends\s*:\s*/i, '').trim());
  const r = await apprendreFait(w.e, { ...donnees, origine: 'apprise-conversation' });
  const fait = { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur };
  await C.enregistrerManifestationFait(w.magasin, { idMessage: L.id, fait, voie: { nom: 'lecon-technique' } });
  await C.enregistrerManifestationFait(w.magasin, { idMessage: M.id, fait: { ...fait }, voie: { nom: 'reference-explicite', idLecon: L.id } });
  const examen = await F.examinerFormeApresSupervision(w.magasin, M.id);
  return { M, L, nonCompris, examen };
}
async function confirmerRegle(w, proposition) {
  const r = await F.confirmerFormeSupervisee(w.magasin, proposition);
  w.e.actions = await w.magasin.lireTout('actions'); // comme main.js après Confirmer
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
function ecranSur(magasin) {
  return monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
}
// Le raccord forme-apprise de main.js, rejoué : reconnaissance par l'écran RÉEL ; si la capacité déclare proposer un fait, aller-retour
// extraireLecon(« Fait : s / r / v. ») ; la confirmation écrit le fait (apprendreFait) et la manifestation forme-apprise.
async function proposerParLaForme(magasin, texte) {
  const reco = await ecranSur(magasin).tenterReconnaissanceAction(texte);
  if (!(reco.reconnu && reco.ok && reco.proposeFait === true)) return { reco };
  const d = reco.resultat.donnees;
  const phraseFait = `Fait : ${d.sujet} / ${d.relation} / ${d.valeur}.`;
  const extrait = extraireLecon(phraseFait);
  return { reco, phraseFait, extrait };
}
async function confirmerFaitPropose(w, texte, { reco, extrait }) {
  const M = await recevoir(w.magasin, texte);
  const r = await apprendreFait(w.e, { ...extrait.donnees, origine: 'apprise-conversation' });
  await C.enregistrerManifestationFait(w.magasin, { idMessage: M.id, fait: { sujet: r.objet.sujet, relation: r.objet.relation, valeur: r.objet.valeur }, voie: { nom: 'forme-apprise', idAction: reco.idAction } });
  return r;
}
async function enseignerALaMain(magasin, operation, exemples, roles, statut = null) {
  const ev = evaluerAction({ operation, roles, exemples });
  assert.equal(ev.ok, true, JSON.stringify(ev));
  return (await C.apprendreAction(magasin, { operation, roles: ev.roles, n: ev.n, exemples: ev.exemples, statut: statut || ev.statut, origine: 'apprise-conversation' })).objet;
}
const PAUL = ['Le métier de Paul est pilote.', 'Apprends : Fait : Paul / métier / pilote.'];
const LEA = ['Le surnom de Léa est Puce.', 'Apprends : Fait : Léa / surnom / Puce.'];
const MON_CHIEN = ['Mon chien porte le nom Rex.', 'Apprends : Fait : moi / chien / Rex.'];
const MON_CHAT = ['Mon chat porte le nom Milo.', 'Apprends : Fait : moi / chat / Milo.'];
const famille = (vue, idMessage) => vue.familles.find((f) => f.membres.includes(idMessage));
async function vueDe(w) { return formesSupervisees(await w.magasin.lireTout('manifestationsFaits'), await w.magasin.lireTout('valeursDonnees')); }

// ================================================================================================================ FX0. REGISTRE
test('FX0. registre : proposerFaitComplet = roles [sujet, relation, valeur], AUCUNE constante ; les deux capacités de fait déclarent proposeFait et rejouable: false, elles seules ; primitive partagée', () => {
  const c = CAPACITES.proposerFaitComplet;
  assert.ok(Object.isFrozen(c));
  assert.deepEqual([...c.roles], ['sujet', 'relation', 'valeur']);
  assert.equal(c.constantes, undefined);
  for (const nom of Object.keys(CAPACITES)) {
    const deFait = nom === 'proposerFait' || nom === 'proposerFaitComplet';
    assert.equal(CAPACITES[nom].proposeFait, deFait ? true : undefined, nom);
    assert.equal(CAPACITES[nom].rejouable, deFait ? false : undefined, nom);
  }
  assert.deepEqual(F.capacitesDeFait().sort(), ['proposerFait', 'proposerFaitComplet']);
  // même primitive pure : même structure, aucun accès à l'esprit
  const piege = new Proxy({}, { get: () => { throw new Error('esprit lu'); } });
  const attendu = { type: 'fait', donnees: { sujet: 'Hugo', relation: 'chien', valeur: 'Rex' } };
  assert.deepEqual(c.invoquer(piege, { sujet: 'Hugo', relation: 'chien', valeur: 'Rex' }), attendu);
  assert.deepEqual(CAPACITES.proposerFait.invoquer(piege, { sujet: 'Hugo', relation: 'chien', valeur: 'Rex' }), attendu);
  for (const args of [{}, { sujet: 'Hugo', relation: 'chien' }, { sujet: ' ', relation: 'chien', valeur: 'Rex' }, { sujet: 'Hugo', relation: 3, valeur: 'Rex' }]) assert.equal(c.invoquer(piege, args), null, JSON.stringify(args));
  assert.equal(c.representer(attendu), 'Proposition (forme apprise) : Hugo → chien → Rex.');
  assert.equal(c.representer(null), CAPACITES.proposerFait.representer(null));
  const src = lu('app', 'langage', 'registre.js');
  assert.equal((src.match(/function proposerStructureFait\(/g) || []).length, 1, 'une seule primitive de proposition');
  assert.equal((src.match(/invoquer: \(_esprit, champs = \{\}\) => proposerStructureFait\(champs\)/g) || []).length, 2, 'partagée par les deux capacités');
  // contrat exact d'evaluerAction : aucune constante acceptée
  assert.equal(evaluerAction({ operation: 'proposerFaitComplet', roles: ['relation', 'sujet', 'valeur'], constantes: { sujet: 'moi' }, exemples: [PAUL[0], LEA[0]] }).raison, 'constantes_inattendues');
});

// ================================================================================================================ FX1. DÉCISIF
test('FX1. décisif : Paul (insuffisant) → Léa → proposition « Le X de Y est Z. » comme Y → X → Z → Confirmer ; redémarrage → « Le chien de Hugo est Rex. » proposé LOCALEMENT ; fait confirmé ; redémarrage → « Quel est le chien de Hugo ? » → Rex', async () => {
  let w = await monde();
  const t1 = await superviser(w, ...PAUL);
  assert.equal(t1.nonCompris, true, 'M1 inconnu de toute forme et de J1a');
  assert.deepEqual(t1.examen, { raison: 'famille-insuffisante' }, 'un seul exemple : rien n\'est proposé');
  const t2 = await superviser(w, ...LEA);
  assert.equal(t2.nonCompris, true);
  const fam = famille(await vueDe(w), t2.M.id);
  assert.deepEqual(fam.signature, [{ jeton: 'Le' }, { champ: 'relation' }, { jeton: 'de' }, { champ: 'sujet' }, { jeton: 'est' }, { champ: 'valeur' }, { jeton: '.' }], 'Le <relation> de <sujet> est <valeur> .');
  assert.deepEqual(fam.champs, { sujet: { etat: 'role', position: 3 }, relation: { etat: 'role', position: 1 }, valeur: { etat: 'role', position: 5 } });
  const p = t2.examen.proposition;
  assert.ok(p, JSON.stringify(t2.examen));
  assert.equal(p.texte, [
    "J'ai remarqué une forme commune à tes exemples :",
    '« Le métier de Paul est pilote. »',
    '« Le surnom de Léa est Puce. »',
    '',
    'Je propose de comprendre désormais :',
    '« Le X de Y est Z. »',
    'comme : Y → X → Z.',
    '',
    'Est-ce correct ?',
  ].join('\n'));
  assert.doesNotMatch(p.texte, /position|proposer|relation|valeur|sujet|constante/, 'aucun nom interne affiché');
  assert.deepEqual(p.regle, { operation: 'proposerFaitComplet', n: 7, ancres: [{ position: 0, jeton: 'Le' }, { position: 2, jeton: 'de' }, { position: 4, jeton: 'est' }, { position: 6, jeton: '.' }], roles: [{ position: 1, nom: 'relation' }, { position: 3, nom: 'sujet' }, { position: 5, nom: 'valeur' }], constantes: {} });
  assert.deepEqual(p.sources, [t1.M.id, t2.M.id].sort());
  assert.deepEqual(await w.magasin.lireTout('actions'), [], 'rien n\'est actif avant Confirmer');
  const { action, decision, echecDecision } = await confirmerRegle(w, p);
  assert.equal(echecDecision, null);
  assert.deepEqual({ operation: action.operation, statut: action.statut, origine: action.origine, roles: action.roles, n: action.n },
    { operation: 'proposerFaitComplet', statut: 'validee', origine: 'induite-supervisee', roles: [{ position: 1, nom: 'relation' }, { position: 3, nom: 'sujet' }, { position: 5, nom: 'valeur' }], n: 7 });
  assert.equal(Object.hasOwn(action, 'constantes'), false, 'constantes {} : aucune constante persistée (contrat exact de la capacité)');
  assert.deepEqual(regleDeLAction(action).constantes, {});
  assert.deepEqual(action.exemples.map((x) => x.entree), [PAUL[0], LEA[0]]);
  assert.deepEqual(decision, { idCandidat: p.idCandidat, decision: 'confirmee', sources: p.sources, idAction: action.id });
  assert.equal(identiteRegle(regleDeLAction(action)), p.idCandidat, 'l\'Action porte exactement la règle confirmée');
  // redémarrage
  w = await redemarrer(w);
  const fp = await proposerParLaForme(w.magasin, 'Le chien de Hugo est Rex.');
  assert.equal(fp.reco.operation, 'proposerFaitComplet');
  assert.equal(fp.reco.proposeFait, true, 'le raccord main.js est atteint par la propriété déclarative');
  assert.equal(fp.reco.idAction, action.id);
  assert.deepEqual(fp.reco.resultat, { type: 'fait', donnees: { sujet: 'Hugo', relation: 'chien', valeur: 'Rex' } });
  assert.equal(fp.phraseFait, 'Fait : Hugo / chien / Rex.');
  assert.deepEqual({ type: fp.extrait.type, ...fp.extrait.donnees }, { type: 'fait', sujet: 'Hugo', relation: 'chien', valeur: 'Rex' }, 'aller-retour extraireLecon fidèle');
  // PROPOSITION seulement : rien n'est écrit tant que Christophe n'a pas confirmé (D hors périmètre)
  assert.equal((await w.magasin.lireTout('faits')).some((f) => f.sujet === 'Hugo'), false);
  w.e = await chargerEsprit(w.magasin);
  await confirmerFaitPropose(w, 'Le chien de Hugo est Rex.', fp);
  w = await redemarrer(w);
  const r = repondre(w.e, 'Quel est le chien de Hugo ?');
  assert.equal(r.texte, 'Rex');
  assert.equal(r.etat, 'compris');
  // la question n'est pas captée par la forme (autre squelette)
  assert.equal(reconnaitreActions(w.e.actions, 'Quel est le chien de Hugo ?').etat, 'aucune');
  const manif = (await w.magasin.lireTout('manifestationsFaits')).find((m) => m.fait.sujet === 'Hugo');
  assert.deepEqual(manif.voie, { nom: 'forme-apprise', idAction: action.id });
});

// ================================================================================================================ FX2. CHOIX DE CAPACITÉ (A, B, D, E)
test('FX2. sélection UNIQUE : 3 rôles → proposerFaitComplet ; sujet constant → proposerFait ; aucune capacité compatible → incompatible ; deux compatibles injectées → abstention, quel que soit l\'ordre', async () => {
  // A
  const w = await monde();
  await superviser(w, ...PAUL);
  const { M } = await superviser(w, ...LEA);
  const fam3 = famille(await vueDe(w), M.id);
  assert.deepEqual(F.capaciteDeFaitCompatible(fam3), { ok: true, operation: 'proposerFaitComplet' });
  // B : la famille v0.64.17 (sujet constant) reste à proposerFait, sans ambiguïté de capacité
  const w2 = await monde();
  await superviser(w2, ...MON_CHIEN);
  const t = await superviser(w2, ...MON_CHAT);
  const fam2 = famille(await vueDe(w2), t.M.id);
  assert.deepEqual(F.capaciteDeFaitCompatible(fam2), { ok: true, operation: 'proposerFait' });
  assert.equal(t.examen.proposition.regle.operation, 'proposerFait');
  assert.deepEqual(t.examen.proposition.regle.constantes, { sujet: 'moi' });
  assert.match(t.examen.proposition.texte, /comme : moi → X → Y\./);
  // D : sujet rôle + relation constante + valeur rôle → aucune capacité de fait ne déclare ce contrat
  const w3 = await monde();
  await superviser(w3, 'Paul porte le nom Milo.', 'Apprends : Fait : paul / surnom / Milo.');
  const t3 = await superviser(w3, 'Léa porte le nom Rex.', 'Apprends : Fait : léa / surnom / Rex.');
  assert.deepEqual(t3.examen, { raison: 'incompatible' });
  assert.deepEqual(F.capaciteDeFaitCompatible(fam3, { recherche: CAPACITES.recherche }), { ok: false, raison: 'incompatible' }, 'aucune capacité de fait déclarée');
  // E : deux capacités artificiellement compatibles (registre injecté) → abstention, jamais la première, ni par ordre
  const jumelle = Object.freeze({ ...CAPACITES.proposerFaitComplet });
  for (const reg of [
    { proposerFaitComplet: CAPACITES.proposerFaitComplet, zJumelle: jumelle },
    { zJumelle: jumelle, proposerFaitComplet: CAPACITES.proposerFaitComplet },
    { aJumelle: jumelle, proposerFait: CAPACITES.proposerFait, proposerFaitComplet: CAPACITES.proposerFaitComplet },
  ]) assert.deepEqual(F.capaciteDeFaitCompatible(fam3, reg), { ok: false, raison: 'plusieurs-capacites' }, Object.keys(reg).join(','));
  // une capacité qui ne DÉCLARE pas proposeFait n'est jamais candidate, même de contrat identique
  const sansDeclaration = Object.freeze({ roles: CAPACITES.proposerFaitComplet.roles, invoquer: () => null, representer: () => '' });
  assert.deepEqual(F.capaciteDeFaitCompatible(fam3, { proposerFaitComplet: CAPACITES.proposerFaitComplet, autre: sansDeclaration }), { ok: true, operation: 'proposerFaitComplet' });
  // le module ne nomme aucune capacité
  assert.doesNotMatch(sansCommentaires(lu('app', 'langage', 'formes-confirmees.js')), /'proposerFait'|'proposerFaitComplet'|OPERATION_FORME_FAIT/);
});

// ================================================================================================================ FX3. AMBIGUÏTÉ CONSERVÉE (C)
test('FX3. « Paul possède un vélo. » / « Marie possède un chat. » : relation placée invariante → famille ambiguë (roleOuConstante), aucune proposition, rien d\'écrit', async () => {
  const w = await monde();
  await superviser(w, 'Paul possède un vélo.', 'Apprends : Fait : Paul / possède / vélo.');
  const t = await superviser(w, 'Marie possède un chat.', 'Apprends : Fait : Marie / possède / chat.');
  assert.deepEqual(t.examen, { raison: 'famille-ambigue' });
  const fam = famille(await vueDe(w), t.M.id);
  assert.equal(fam.etat, 'ambigue');
  assert.deepEqual(fam.champs.relation, { etat: 'roleOuConstante', position: 1, valeurs: ['possède'] });
  assert.deepEqual(F.capaciteDeFaitCompatible(fam), { ok: false, raison: 'famille-non-determinee' });
  assert.deepEqual(await w.magasin.lireTout('actions'), []);
  assert.deepEqual(await w.magasin.lireTout('decisionsFormes'), []);
});

// ================================================================================================================ FX4. REJEU (F, G)
let compteurId = 0;
function trace(texteBrut, capacite, provenancePositions) {
  compteurId += 1;
  return { id: compteurId, sequence: compteurId, horodatage: '2000-01-01T00:00:00.000Z', capacite, voie: 'action', argumentsUtilises: {}, provenanceArguments: {}, resultat: { peuImporte: true }, contexte: { texteBrut, tokens: [] }, provenancePositions };
}
// Corpus à trois rôles convergents ; la MÊME forme est utilisée pour une capacité de fait et pour accessibilite (rejouable), seul le nom diffère.
// Chaque rôle est démontré substituable par une paire de traces qui ne diffère QUE sur lui (exigence du pipeline pur v0.60.1).
const corpus3 = (capacite, roles) => ['zA a1 zB b1 zC c1', 'zA a2 zB b1 zC c1', 'zA a1 zB b2 zC c1', 'zA a1 zB b1 zC c2']
  .map((t) => trace(t, capacite, { [roles[0]]: 1, [roles[1]]: 3, [roles[2]]: 5 }));
async function rejeuSur(traces, texte) {
  const magasin = C.magasinMemoireVive();
  const ecran = ecranSur(magasin);
  const e = await ecran.assurerEsprit();
  for (const t of traces) e.traces.push(t);
  const avant = e.traces.length;
  return { r: await ecran.tenterRejeuAutonome(texte), nouvelles: e.traces.length - avant };
}
test('FX4. rejeu : proposerFaitComplet (aucune constante) n\'est JAMAIS rejouée alors que le pipeline pur l\'aurait admise ; accessibilite, même forme, l\'est toujours ; un corpus mixte rejoue seulement l\'historique', async () => {
  const texte = 'zA zX zB zY zC zZ';
  const deFait = corpus3('proposerFaitComplet', ['relation', 'sujet', 'valeur']);
  const pur = possibilitesRejeuAdmissibles(deFait, texte);
  assert.equal(pur.etat, 'unique', 'sans le filtre déclaratif, la capacité de fait SERAIT rejouée : le filtre est nécessaire');
  const a = await rejeuSur(deFait, texte);
  assert.deepEqual(a.r, { reconnu: false });
  assert.equal(a.nouvelles, 0, 'aucune invocation, aucune trace, aucune proposition');
  const ancien = await rejeuSur(corpus3('proposerFait', ['relation', 'sujet', 'valeur']), texte);
  assert.deepEqual(ancien.r, { reconnu: false }, 'proposerFait toujours exclue (même critère déclaratif)');
  const hist = await rejeuSur(corpus3('accessibilite', ['sujetA', 'operateur', 'sujetB']), texte);
  assert.equal(hist.r.reconnu, true, 'une capacité historique de même forme reste rejouable');
  assert.equal(hist.r.ok, true);
  assert.equal(hist.nouvelles, 1);
  const mixte = await rejeuSur([...deFait, ...corpus3('accessibilite', ['sujetA', 'operateur', 'sujetB'])], texte);
  assert.equal(mixte.r.reconnu, true, 'les traces de fait écartées AVANT le calcul : aucune ambiguïté artificielle');
  assert.match(mixte.r.texte, /accessibilité locale/);
  // aucun autre exécuteur autonome ne voit le registre : la liste des modules qui l'importent est inchangée
  const importeurs = [];
  const parcourir = (dir) => { for (const n of readdirSync(join(RACINE, dir), { withFileTypes: true })) { const r = `${dir}/${n.name}`; if (n.isDirectory()) parcourir(r); else if (r.endsWith('.js') && /from '\.\/registre\.js'|from '\.\.\/langage\/registre\.js'/.test(lu(r))) importeurs.push(r); } };
  parcourir('app');
  assert.deepEqual(importeurs.sort(), ['app/langage/action.js', 'app/langage/composition.js', 'app/langage/divergences-localisees.js', 'app/langage/divergences.js', 'app/langage/ecran.js', 'app/langage/experiences-situees.js', 'app/langage/formes-confirmees.js', 'app/langage/reponses-attendues.js', 'app/langage/resolutions.js', 'app/langage/vue-traces.js']); // MISE À JOUR DÉLIBÉRÉE N3b-0 : + experiences-situees.js (vue pure de relecture : transmet la déclaration courante à la localisation, n'invoque ni ne rejoue rien) // MISE À JOUR DÉLIBÉRÉE v0.64.24 : + resolutions.js (vue pure : transmet la projection déclarée à la localisation, n'invoque ni ne rejoue rien) // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + reponses-attendues.js, l'inducteur de formes de question (lecture du registre, n'exécute rien de façon autonome) // MISE À JOUR DÉLIBÉRÉE v0.64.21 : + divergences.js (lit lecture.reponses du registre, vue pure, n'exécute rien) // MISE À JOUR DÉLIBÉRÉE v0.64.23 : + divergences-localisees.js (vue pure : lit la PROJECTION déclarée du registre, n'invoque ni ne rejoue rien)
});

// ================================================================================================================ FX5. IDENTITÉ (H)
test('FX5. identité : même signature textuelle, autre association ou autre opération → identités différentes ; règle identique → même identité', async () => {
  const w = await monde();
  await superviser(w, ...PAUL);
  const p = (await superviser(w, ...LEA)).examen.proposition;
  const r = p.regle;
  assert.match(p.idCandidat, /^forme-[0-9a-f]{64}$/);
  assert.equal(identiteRegle({ ...r, roles: [...r.roles].reverse(), ancres: [...r.ancres].reverse() }), p.idCandidat);
  assert.notEqual(identiteRegle({ ...r, operation: 'proposerFait' }), p.idCandidat, 'autre opération');
  const associationEchangee = { ...r, roles: [{ position: 1, nom: 'sujet' }, { position: 3, nom: 'relation' }, { position: 5, nom: 'valeur' }] };
  assert.notEqual(identiteRegle(associationEchangee), p.idCandidat, 'même signature, autre association');
  assert.notEqual(identiteRegle({ ...r, constantes: { sujet: 'moi' } }), p.idCandidat);
  const w2 = await monde();
  await superviser(w2, ...LEA);
  assert.equal((await superviser(w2, ...PAUL)).examen.proposition.idCandidat, p.idCandidat, 'l\'ordre d\'arrivée est sans effet');
});

// ================================================================================================================ FX6. CONFIRMATION / REFUS / REDÉMARRAGE (I, J, K, M)
test('FX6. Refuser → décision refusee, aucune Action, faits sources intacts ; redémarrage ; nouvel exemple de même signature → aucune reproposition, aucune proposition locale', async () => {
  let w = await monde();
  await superviser(w, ...PAUL);
  const { examen } = await superviser(w, ...LEA);
  const avantFaits = JSON.stringify(await w.magasin.lireTout('faits'));
  const avantManifs = JSON.stringify(await w.magasin.lireTout('manifestationsFaits'));
  const decision = await F.refuserFormeSupervisee(w.magasin, examen.proposition);
  assert.deepEqual(decision, { idCandidat: examen.proposition.idCandidat, decision: 'refusee', sources: examen.proposition.sources });
  assert.deepEqual(await w.magasin.lireTout('actions'), []);
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), avantFaits);
  assert.equal(JSON.stringify(await w.magasin.lireTout('manifestationsFaits')), avantManifs);
  w = await redemarrer(w);
  const t3 = await superviser(w, 'Le chat de Zoé est Tigre.', 'Apprends : Fait : Zoé / chat / Tigre.');
  assert.deepEqual(t3.examen, { raison: 'deja-decidee' });
  assert.deepEqual((await proposerParLaForme(w.magasin, 'Le chien de Hugo est Rex.')).reco, { reconnu: false });
});

test('FX7. Confirmer : faits et manifestations sources inchangés ; la décision valide son Action EXACTE ; même règle active → déjà couverte ; sauvegarde/restauration → forme toujours active', async () => {
  let w = await monde();
  await superviser(w, ...PAUL);
  const { examen } = await superviser(w, ...LEA);
  const faits = JSON.stringify(await w.magasin.lireTout('faits'));
  const manifs = JSON.stringify(await w.magasin.lireTout('manifestationsFaits'));
  const { action } = await confirmerRegle(w, examen.proposition);
  assert.equal(JSON.stringify(await w.magasin.lireTout('faits')), faits, 'confirmer la règle ne touche aucun fait');
  assert.equal(JSON.stringify(await w.magasin.lireTout('manifestationsFaits')), manifs);
  assert.deepEqual(F.decisionsIncoherentes(await w.magasin.lireTout('decisionsFormes'), await w.magasin.lireTout('actions')), []);
  await assert.rejects(() => C.enregistrerDecisionForme(w.magasin, { idCandidat: identiteRegle({ ...examen.proposition.regle, operation: 'proposerFait' }), decision: 'confirmee', sources: examen.proposition.sources, idAction: action.id }), /ne porte pas la règle/);
  await assert.rejects(() => F.confirmerFormeSupervisee(w.magasin, examen.proposition), /déjà reçu ta réponse/);
  // un nouvel exemple de la famille : déjà décidée
  assert.deepEqual((await superviser(w, 'Le chat de Zoé est Tigre.', 'Apprends : Fait : Zoé / chat / Tigre.')).examen, { raison: 'deja-decidee' });
  // sauvegarde → restauration (schéma inchangé)
  assert.equal(S.SCHEMA_SAUVEGARDE, 20); // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(C.VERSION_BASE, 30); // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(C.TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.64.19 : + table reponsesAttendues (VERSION_BASE 27, SCHEMA_SAUVEGARDE 17, 33 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.22 : + table reponsesLocales (VERSION_BASE 28, SCHEMA_SAUVEGARDE 18, 34 tables) // MISE À JOUR DÉLIBÉRÉE v0.64.25 : + table actesResolution (VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables) // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  w = await redemarrer(w);
  assert.equal((await proposerParLaForme(w.magasin, 'Le chat de Zoé est Tigre.')).reco.idAction, action.id);
});

// ================================================================================================================ FX8. COLLISIONS ET ACTIONS INACTIVES (13, 14)
test('FX8. collisions : autre règle active sur le même squelette → abstention (rien d\'écrit) ; même règle validée à la main → déjà couverte ; même règle incertaine → réactivée (même id) ; remplacee → nouvelle Action', async () => {
  const MAIN3 = ['Le chien de Paul est Rex.', 'Le chat de Paul est Rex.', 'Le chat de Léa est Rex.', 'Le chat de Léa est Milo.'];
  // autre règle (accessibilite, trois rôles) sur le même squelette
  const w = await monde();
  await enseignerALaMain(w.magasin, 'accessibilite', MAIN3, ['operateur', 'sujetA', 'sujetB']);
  const avant = JSON.stringify(await w.magasin.lireTout('actions'));
  w.e.actions = [];
  await superviser(w, ...PAUL);
  assert.deepEqual((await superviser(w, ...LEA)).examen, { raison: 'squelette-occupe' });
  assert.equal(JSON.stringify(await w.magasin.lireTout('actions')), avant);
  assert.deepEqual(await w.magasin.lireTout('decisionsFormes'), []);
  // même règle validée à la main
  const w2 = await monde();
  const manuelle = await enseignerALaMain(w2.magasin, 'proposerFaitComplet', MAIN3, ['relation', 'sujet', 'valeur']);
  assert.equal(manuelle.statut, 'validee');
  w2.e.actions = [];
  await superviser(w2, ...PAUL);
  assert.deepEqual((await superviser(w2, ...LEA)).examen, { raison: 'deja-couverte' });
  // même règle incertaine (exemples qui ne distinguent pas les positions)
  const w3 = await monde();
  const inc = await enseignerALaMain(w3.magasin, 'proposerFaitComplet', ['Le chien de Paul est Rex.', 'Le chat de Léa est Milo.'], ['relation', 'sujet', 'valeur']);
  assert.equal(inc.statut, 'incertaine');
  w3.e.actions = [];
  await superviser(w3, ...PAUL);
  const t = await superviser(w3, ...LEA);
  assert.equal(t.examen.proposition.idCandidat, identiteRegle(regleDeLAction(inc)));
  const r = await confirmerRegle(w3, t.examen.proposition);
  assert.equal(r.action.id, inc.id);
  assert.equal(r.action.statut, 'validee');
  assert.equal((await w3.magasin.lireTout('actions')).length, 1);
  // remplacee
  const w4 = await monde();
  const vieille = await enseignerALaMain(w4.magasin, 'proposerFaitComplet', MAIN3, ['relation', 'sujet', 'valeur']);
  await w4.magasin.ecrire('actions', { ...vieille, statut: 'remplacee' });
  w4.e.actions = await w4.magasin.lireTout('actions');
  await superviser(w4, ...PAUL);
  const t4 = await superviser(w4, ...LEA);
  const r4 = await confirmerRegle(w4, t4.examen.proposition);
  assert.notEqual(r4.action.id, vieille.id);
  assert.equal((await w4.magasin.lireTout('actions')).find((a) => a.id === vieille.id).statut, 'remplacee');
  assert.equal(r4.action.origine, 'induite-supervisee');
});

// ================================================================================================================ FX9. NON-RÉGRESSION ET PURETÉ (N)
test('FX9. non-régression : la forme v0.64.17 (sujet constant) propose toujours moi → X → Y et ne rend pas la phrase ambiguë ; reconnaissance d\'une capacité non-fait : proposeFait false ; formesSupervisees reste pure', async () => {
  let w = await monde();
  await superviser(w, ...MON_CHIEN);
  const p = (await superviser(w, ...MON_CHAT)).examen.proposition;
  await confirmerRegle(w, p);
  await superviser(w, ...PAUL);
  const pl = (await superviser(w, ...LEA)).examen.proposition;
  await confirmerRegle(w, pl);
  w = await redemarrer(w);
  const a = await proposerParLaForme(w.magasin, 'Mon lapin porte le nom Kiwi.');
  assert.deepEqual(a.reco.resultat, { type: 'fait', donnees: { sujet: 'moi', relation: 'lapin', valeur: 'Kiwi' } });
  assert.equal(a.reco.operation, 'proposerFait');
  const b = await proposerParLaForme(w.magasin, 'Le chien de Hugo est Rex.');
  assert.equal(b.reco.operation, 'proposerFaitComplet');
  assert.equal(reconnaitreActions(w.e.actions, 'Mon lapin porte le nom Kiwi.').etat, 'unique');
  assert.equal(reconnaitreActions(w.e.actions, 'Le chien de Hugo est Rex.').etat, 'unique');
  // une capacité qui ne propose pas de fait garde son chemin (texte local), proposeFait false
  const w2 = await monde();
  await enseignerALaMain(w2.magasin, 'recherche', ['Qui zrelA zvalA ?', 'Qui zrelB zvalA ?', 'Qui zrelB zvalB ?'], ['relation', 'valeur']);
  const reco = await ecranSur(w2.magasin).tenterReconnaissanceAction('Qui zrelC zvalC ?');
  assert.equal(reco.ok, true);
  assert.equal(reco.proposeFait, false);
  assert.match(reco.texte, /recherche locale/);
  // pureté
  const lignes = JSON.stringify([await w.magasin.lireTout('manifestationsFaits'), await w.magasin.lireTout('valeursDonnees')]);
  const v1 = JSON.stringify(formesSupervisees(...JSON.parse(lignes)));
  const gele = JSON.parse(lignes).map((t) => Object.freeze(t.map((l) => Object.freeze(l))));
  assert.equal(JSON.stringify(formesSupervisees(...gele)), v1);
  assert.doesNotMatch(lu('app', 'langage', 'formes-supervisees.js'), /registre\.js|CAPACITES|proposerFait/);
});

// ================================================================================================================ FX10. RACCORDS (source)
test('FX10. raccords : main.js route sur proposeFait (aucun nom de capacité) ; ecran.js expose proposeFait depuis le registre et filtre le rejeu sur rejouable ; formes-confirmees ne transmet des constantes que si la règle en porte', () => {
  const main = sansCommentaires(lu('app', 'main.js'));
  assert.match(main, /if \(reconnaissanceAction\.reconnu && reconnaissanceAction\.ok && reconnaissanceAction\.proposeFait === true\) \{/);
  assert.doesNotMatch(main, /'proposerFait'|'proposerFaitComplet'/);
  const ecran = sansCommentaires(lu('app', 'langage', 'ecran.js'));
  assert.match(ecran, /proposeFait: Boolean\(CAPACITES\[action\.operation\]\) && CAPACITES\[action\.operation\]\.proposeFait === true,/);
  assert.doesNotMatch(ecran, /'proposerFait'|'proposerFaitComplet'|capacite\.constantes\.length/);
  const fc = sansCommentaires(lu('app', 'langage', 'formes-confirmees.js'));
  assert.match(fc, /const avecConstantes = \(regle\) => \(Object\.keys\(regle\.constantes\)\.length \? \{ constantes: \{ \.\.\.regle\.constantes \} \} : \{\}\);/);
  assert.equal((fc.match(/\.\.\.avecConstantes\(regle\)/g) || []).length, 2, 'evaluerAction et apprendreAction');
});
