// === DEBUT_TEST_OBSERVATIONS_LANGAGE ===
// v0.63.0 — ÉTAPE 7, décision ChatGPT « OBSERVATION PASSIVE DE LA COMPRÉHENSION » (04/10/2026, analyses 2 et 3,
// contrat P1-P10). Pour tout message qui atteint la voie de conversation ORDINAIRE (après marqueurs, squelettes
// et rejeu), l'UNIQUE exécution de repondre() à l'instant T est photographiée dans la table `observationsLangage`,
// SANS rien changer d'autre : même réponse, même moteur, mêmes expériences / hypothèses / propositions / faits /
// lexique / règles / gabarits / traces / liaisons / actes / énoncés, aucun appel de plus à Gemini ni au petit LLM.
// PORTÉE EXACTE : « ce que le moteur propre constate lorsqu'un message atteint la voie de conversation
// ordinaire » -- jamais « tout ce que Christophe dit ».
//
// main.js n'a aucun export : un SIMULATEUR reproduit la fin de traiterTour() (même méthode que
// tests/capture-enonce.test.mjs) avec le VRAI pont, la VRAIE fabrique d'observateur, les VRAIES primitives de
// persistance et le VRAI écran de langage ; des tests STATIQUES lient le simulateur au texte de main.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chargerEsprit, apprendreFait, apprendreRelation, repondre } from '../app/langage/esprit.js';
import {
  magasinMemoireVive, TABLES, enregistrerExperience, ajouterInterpretation,
  enregistrerObservationLangage, rattacherObservationLangage, examinerVecuEtFormerHypotheses,
} from '../app/langage/connaissances.js';
import { tenterPontLangage, enregistrerExperienceTentativeEchouee, creerObservateurLangage } from '../app/langage/pont.js';
import { composerApresVecu } from '../app/langage/vecu.js';
import { poolExperiencesRecentes, repererMotifs } from '../app/langage/induction.js';

// Horloge MONOTONE (chaque lecture avance d'une milliseconde) : sans elle, deux expériences créées dans la même
// milliseconde sont départagées au hasard du timing par le tri du pool récent (couverture d'une proposition dans
// un ordre ou dans l'autre), ce qui rendrait les comparaisons « avec / sans observateur » instables pour une
// raison sans rapport avec l'observation. Les relations d'ordre restent celles du vrai code.
const DateReelle = Date;
let horlogeFictive = DateReelle.now();
class DateMonotone extends DateReelle {
  constructor(...args) { if (args.length === 0) super(++horlogeFictive); else super(...args); }
  static now() { return ++horlogeFictive; }
}
globalThis.Date = DateMonotone;

const universel = () => new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())),
  set: () => true,
  apply: () => universel(),
});
globalThis.document = { createElement: () => universel() };
globalThis.window = globalThis;
const { monterEcranLangage } = await import('../app/langage/ecran.js');

const RACINE = join(fileURLToPath(new URL('..', import.meta.url)));
const APP = join(RACINE, 'app');
const T = 'observationsLangage';
const lire = (...p) => readFileSync(join(APP, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
const MAIN = lire('main.js');
const PONT = lire('langage', 'pont.js');

// ------------------------------------------------------------------------------------------- OUTILS
const RE_ID = /([a-zA-Z][a-zA-Z-]*)-(\d{13})-(\d+)(?:-(\d+))?/g;
const RE_DATE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;
// Normalise ce qui est légitimement différent d'un monde à l'autre : dates et identifiants horodatés (le compteur
// de séquence est GLOBAL : les identifiants des lignes suivantes se décalent dès qu'une ligne d'observation est écrite).
function normaliser(valeur) {
  const vus = new Map();
  return JSON.stringify(valeur === undefined ? null : valeur)
    .replace(RE_DATE, 'DATE')
    .replace(RE_ID, (m, prefixe) => { if (!vus.has(m)) vus.set(m, `${prefixe}#${vus.size}`); return vus.get(m); });
}

function monter(magasin) {
  return monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
}

// Monde réel : un magasin de langage vif, un vrai écran de langage, un petit domaine de connaissances, un
// « journal de conversation » et un moteur externe simulé (Gemini) qui compte ses appels.
async function creerMonde() {
  const magasin = magasinMemoireVive();
  const amorce = await chargerEsprit(magasin);
  await apprendreRelation(amorce, { mot: 'manteau', relation: 'manteau' });
  await apprendreFait(amorce, { sujet: 'moi', relation: 'manteau', valeur: 'un manteau bleu' });
  await apprendreRelation(amorce, { mot: 'zrel1', relation: 'zrel1' });
  await apprendreRelation(amorce, { mot: 'zrel2', relation: 'zrel2' });
  await apprendreFait(amorce, { sujet: 'zalpha', relation: 'zrel1', valeur: 'zbeta' });
  await apprendreFait(amorce, { sujet: 'zbeta', relation: 'zrel2', valeur: 'zgamma' });
  const ecran = monter(magasin);
  const esprit = await ecran.assurerEsprit();
  const monde = { magasin, ecran, esprit, journal: [], evenements: [], gemini: { appels: 0, echec: false }, compteur: 1 };
  monde.ajouterEchange = (question, reponse, moteur) => {
    const idQuestion = monde.compteur++;
    const idReponse = monde.compteur++;
    monde.journal.push({ id: idQuestion, role: 'moi', texte: question, moteur }, { id: idReponse, role: 'ia', texte: reponse, moteur });
    return [idQuestion, idReponse];
  };
  monde.appelerGemini = async (texte, options) => {
    monde.gemini.appels += 1;
    monde.evenements.push(['gemini', texte]);
    if (monde.gemini.echec) throw new Error('Gemini indisponible');
    const dateQuestion = new Date().toISOString();
    const [idQuestion, idReponse] = monde.ajouterEchange(texte, 'Réponse Gemini', 'Google Gemini');
    return { texte: 'Réponse Gemini', note: '', actions: [], local: false, idQuestion, idReponse, dateQuestion };
  };
  return monde;
}

// SIMULATEUR de la fin de traiterTour() de main.js (voir les tests statiques J* qui le lient au vrai texte).
async function tour(monde, texte, { options = {}, referenceTrace = null, observation = true, surPoignee = null } = {}) {
  const trace = (nom) => async (...args) => { monde.evenements.push([nom, ...args]); };
  const experienceDeps = {
    enregistrerExperience: async (donnees) => { monde.evenements.push(['enregistrerExperience', donnees]); return enregistrerExperience(monde.magasin, donnees); },
    ajouterInterpretation: async (id, donnees) => { monde.evenements.push(['ajouterInterpretation', id, donnees]); return ajouterInterpretation(monde.magasin, id, donnees); },
    apresNouvelleExperience: composerApresVecu('experience', async (idExperience) => {
      const posees = await monde.ecran.reconnaitreAttentesPourExperience(idExperience);
      const proposition = await monde.ecran.examinerPropositionSpontanee();
      return { posees, proposition };
    }),
  };
  void trace;
  const sansObservation = !!options && (options.repriseDe != null || options.forcerExterne === true);
  let poigneeObservation = null;
  const observateurLangage = creerObservateurLangage({
    enregistrer: async (donnees) => enregistrerObservationLangage(monde.magasin, donnees),
    rattacher: async (ligne, echange) => rattacherObservationLangage(monde.magasin, ligne, echange),
  });
  const local = await tenterPontLangage(texte, {
    assurerEsprit: monde.ecran.assurerEsprit,
    journaliser: async (q, r, d) => { monde.evenements.push(['journaliser', q, r, d]); return monde.ajouterEchange(q, r, 'laboratoire'); },
    ...experienceDeps,
    referenceTrace,
    observer: (observation && !sansObservation) ? async (t, resultat, ref) => {
      poigneeObservation = await observateurLangage(t, resultat, ref);
      if (surPoignee) surPoignee(poigneeObservation);
      return poigneeObservation;
    } : null,
  });
  if (local && local.local) return { ...local };
  const reponse = await monde.appelerGemini(texte, options);
  if (poigneeObservation && reponse) {
    try { await poigneeObservation.rattacher({ idQuestion: reponse.idQuestion, idReponse: reponse.idReponse }); } catch { /* jamais */ }
  }
  if (local && local.tentative) {
    const experience = await enregistrerExperienceTentativeEchouee(texte, local.tentative, reponse, { ...experienceDeps, referenceTrace });
    return { ...reponse, idExperience: experience.id, proposition: experience.propositionSpontanee };
  }
  return reponse;
}

const observations = (monde) => monde.magasin.lireTout(T);
async function photoSansObservations(monde) {
  const photo = {};
  for (const t of TABLES) if (t !== T) photo[t] = await monde.magasin.lireTout(t);
  photo.journalConversation = monde.journal;
  photo.evenements = monde.evenements;
  photo.appelsGemini = monde.gemini.appels;
  return photo;
}

// Un scénario qui couvre toutes les formes : « ? » COMPRIS (laboratoire), « ? » PARTIEL / INCOMPRIS (tentative),
// sans « ? » INCOMPRIS / PARTIEL / faux COMPRIS / « Retiens que » / composition (les deux états diffèrent),
// réponse liée à une trace, répétition, reprise.
const SCENARIO = [
  { texte: 'Quel est mon manteau ?' },
  { texte: 'Quel est mon sac ?' },
  { texte: 'Zorglub ?' },
  { texte: 'Bonjour' },
  { texte: 'Mon manteau est bleu' },
  { texte: 'Retiens que mon manteau est bleu' },
  { texte: 'Retiens que mon manteau est bleu ?' },
  { texte: 'Est-ce que le ciel est bleu' },
  { texte: 'Mon sac est vert' },
  { texte: 'zrel1 zrel2 zalpha' },
  { texte: 'Quelle est ma couleur ?' },
  { texte: 'Bonjour', referenceTrace: { idTrace: 'trace-1' } },
  { texte: 'Bonjour' },
  { texte: 'Bonjour', options: { repriseDe: 4, forcerExterne: true } },
];
const OBSERVES = SCENARIO.filter((s) => !(s.options && (s.options.repriseDe != null || s.options.forcerExterne === true)));

async function jouer(monde, observation) {
  const sorties = [];
  for (const s of SCENARIO) {
    const r = await tour(monde, s.texte, { options: s.options || {}, referenceTrace: s.referenceTrace || null, observation });
    sorties.push(r);
  }
  return sorties;
}

// ============================================================================ A. PRIMITIVE DE PERSISTANCE
const DONNEES = () => ({
  texte: 'Mon manteau est bleu', etatComprendre: 'compris', etatRepondre: 'compris', type: 'affirmation',
  sujet: 'moi', relation: 'manteau', motsInconnus: ['bleu'], relationsNommees: ['manteau'], idTrace: null,
});

test('A1. primitive : clés EXACTES (clôture), préfixe d\'identifiant, horodatage interne, referenceMemoire null', async () => {
  const magasin = magasinMemoireVive();
  const o = await enregistrerObservationLangage(magasin, DONNEES());
  assert.deepEqual(Object.keys(o).sort(), [
    'etatComprendre', 'etatRepondre', 'horodatage', 'id', 'idTrace', 'motsInconnus', 'referenceMemoire',
    'relation', 'relationsNommees', 'sujet', 'texte', 'type',
  ]);
  assert.match(o.id, /^observation-langage-/);
  assert.equal(Number.isNaN(Date.parse(o.horodatage)), false);
  assert.equal(o.referenceMemoire, null);
  assert.deepEqual(await magasin.lireTout(T), [o]);
});

test('A2. primitive : aucun champ de résolution ni de réponse hypothétique n\'est accepté ni conservé', async () => {
  const magasin = magasinMemoireVive();
  const o = await enregistrerObservationLangage(magasin, {
    ...DONNEES(), texteRepondu: 'x', fait: { a: 1 }, patron: {}, regleUtilisee: {}, conflit: true, compose: true, chemin: [], viaType: true, mots: ['a'], empreinte: 'e',
  });
  for (const interdit of ['texteRepondu', 'fait', 'patron', 'regleUtilisee', 'conflit', 'compose', 'chemin', 'viaType', 'mots', 'empreinte', 'regleManquante']) {
    assert.equal(Object.prototype.hasOwnProperty.call(o, interdit), false, interdit);
  }
});

test('A3. primitive : le texte est conservé EXACTEMENT et INTÉGRALEMENT (espaces, retours, très long, aucun plafond)', async () => {
  const magasin = magasinMemoireVive();
  for (const texte of ['  Bonjour  ', 'ligne 1\nligne 2\t?', `x${'é'.repeat(200000)}y`, '0']) {
    const o = await enregistrerObservationLangage(magasin, { ...DONNEES(), texte });
    assert.equal(o.texte, texte);
    const stocke = (await magasin.lireTout(T)).find((l) => l.id === o.id);
    assert.equal(stocke.texte, texte);
  }
});

test('A4. primitive : les tableaux sont COPIÉS (plus aucun lien avec l\'entrée)', async () => {
  const magasin = magasinMemoireVive();
  const d = DONNEES();
  d.relationsNommees = [{ a: ['x'] }];
  const o = await enregistrerObservationLangage(magasin, d);
  d.motsInconnus.push('MUTATION');
  d.relationsNommees[0].a.push('MUTATION');
  assert.deepEqual(o.motsInconnus, ['bleu']);
  assert.deepEqual(o.relationsNommees, [{ a: ['x'] }]);
});

test('A5. primitive : validations (texte, états, type, sujet, relation, mots, relations, idTrace) -> lève AVANT toute écriture', async () => {
  const magasin = magasinMemoireVive();
  const invalides = [
    { texte: '' }, { texte: 3 }, { etatComprendre: 'inconnu' }, { etatRepondre: undefined }, { type: '' }, { type: 3 },
    { sujet: 3 }, { relation: {} }, { motsInconnus: 'x' }, { motsInconnus: [1] }, { relationsNommees: null }, { idTrace: '' }, { idTrace: 3 },
  ];
  for (const delta of invalides) {
    await assert.rejects(enregistrerObservationLangage(magasin, { ...DONNEES(), ...delta }), /invalide/, JSON.stringify(delta));
  }
  assert.deepEqual(await magasin.lireTout(T), []);
});

test('A6. primitive : sujet/relation null et idTrace chaîne sont acceptés tels quels', async () => {
  const magasin = magasinMemoireVive();
  const o = await enregistrerObservationLangage(magasin, { ...DONNEES(), sujet: null, relation: null, etatComprendre: 'incompris', etatRepondre: 'incompris', idTrace: 'trace-9' });
  assert.equal(o.sujet, null);
  assert.equal(o.relation, null);
  assert.equal(o.idTrace, 'trace-9');
});

test('A7. rattachement : remplace UNIQUEMENT referenceMemoire, avec les DEUX identifiants réels, sans toucher une autre table', async () => {
  const magasin = magasinMemoireVive();
  await magasin.ecrire('journal', { id: 'x', texte: 'ancien' });
  const o = await enregistrerObservationLangage(magasin, DONNEES());
  const avant = JSON.stringify(await magasin.lireTout('journal'));
  const r = await rattacherObservationLangage(magasin, o, { idQuestion: 7, idReponse: 8 });
  assert.deepEqual(r, { ...o, referenceMemoire: { idQuestion: 7, idReponse: 8 } });
  assert.deepEqual(await magasin.lireTout(T), [r]);
  assert.equal(JSON.stringify(await magasin.lireTout('journal')), avant);
  for (const t of TABLES) if (t !== T && t !== 'journal') assert.deepEqual(await magasin.lireTout(t), []);
});

test('A8. rattachement : jamais partiel (un seul identifiant, null, undefined, NaN) -> lève, la ligne reste inchangée', async () => {
  const magasin = magasinMemoireVive();
  const o = await enregistrerObservationLangage(magasin, DONNEES());
  for (const echange of [{ idQuestion: 1 }, { idReponse: 2 }, { idQuestion: 1, idReponse: null }, { idQuestion: null, idReponse: 2 }, { idQuestion: NaN, idReponse: 2 }, {}, undefined]) {
    await assert.rejects(rattacherObservationLangage(magasin, o, echange), /Rattachement invalide/);
  }
  await assert.rejects(rattacherObservationLangage(magasin, null, { idQuestion: 1, idReponse: 2 }), /Rattachement invalide/);
  assert.deepEqual(await magasin.lireTout(T), [o]);
});

// ============================================================================ B. L'OBSERVATEUR (pont.js)
test('B1. l\'observateur photographie les DEUX états et tous les champs d\'UNE exécution de repondre()', async () => {
  const monde = await creerMonde();
  for (const [texte, etatComprendre, etatRepondre] of [
    ['Mon manteau est bleu', 'compris', 'compris'],
    ['Bonjour', 'incompris', 'incompris'],
    ['Mon sac est vert', 'partiel', 'partiel'],
    ['zrel1 zrel2 zalpha', 'partiel', 'compris'], // composition : les deux niveaux DIFFÈRENT
    ['Est-ce que le ciel est bleu', 'incompris', 'incompris'],
  ]) {
    const attendu = repondre(monde.esprit, texte);
    await tour(monde, texte);
    const ligne = (await observations(monde)).at(-1);
    assert.equal(ligne.texte, texte);
    assert.equal(ligne.etatComprendre, etatComprendre, texte);
    assert.equal(ligne.etatRepondre, etatRepondre, texte);
    assert.equal(ligne.etatComprendre, attendu.comprehension.etat);
    assert.equal(ligne.etatRepondre, attendu.etat);
    assert.equal(ligne.type, attendu.comprehension.type);
    assert.equal(ligne.sujet, attendu.comprehension.sujet);
    assert.equal(ligne.relation, attendu.comprehension.relation);
    assert.deepEqual(ligne.motsInconnus, attendu.comprehension.motsInconnus);
    assert.deepEqual(ligne.relationsNommees, attendu.comprehension.relationsNommees);
  }
});

test('B2. les deux états sont deux CHAMPS distincts et ne se confondent jamais (composition : partiel / compris)', async () => {
  const monde = await creerMonde();
  await tour(monde, 'zrel1 zrel2 zalpha');
  const [ligne] = await observations(monde);
  assert.equal(ligne.etatComprendre, 'partiel');
  assert.equal(ligne.etatRepondre, 'compris');
  assert.notEqual(ligne.etatComprendre, ligne.etatRepondre);
});

test('B3. un faux COMPRIS reste COMPRIS (aucune correction, aucun filtre) et un COMPRIS « je ne sais pas » aussi', async () => {
  const monde = await creerMonde();
  await tour(monde, 'Retiens que mon manteau est bleu');
  await tour(monde, 'Quelle est ma couleur ?');
  const lignes = await observations(monde);
  assert.equal(lignes[0].etatComprendre, 'compris');
  assert.equal(lignes[0].etatRepondre, 'compris');
  assert.equal(lignes[1].etatRepondre, 'compris'); // la réponse locale était « Je ne sais pas. », l'état reste COMPRIS
});

test('B4. l\'observateur reçoit le résultat de l\'UNIQUE exécution : il est identique à un repondre() direct et n\'est jamais recalculé', async () => {
  const monde = await creerMonde();
  for (const texte of ['Quel est mon manteau ?', 'Bonjour', 'Mon sac est vert', 'zrel1 zrel2 zalpha']) {
    const recus = [];
    await tenterPontLangage(texte, {
      assurerEsprit: monde.ecran.assurerEsprit,
      journaliser: async () => [null, null],
      enregistrerExperience: async () => ({ id: 'exp-test' }),
      ajouterInterpretation: async () => {},
      observer: async (t, resultat, ref) => { recus.push([t, resultat, ref]); return null; },
    });
    assert.equal(recus.length, 1, texte);
    assert.equal(recus[0][0], texte);
    assert.deepEqual(recus[0][1], repondre(monde.esprit, texte));
  }
});

function esprit_compteur(esprit) {
  const compteur = { lectures: 0 };
  const proxy = new Proxy(esprit, { get: (t, k) => { if (k === 'lexique') compteur.lectures += 1; return t[k]; } });
  return { proxy, compteur };
}

test('B5. UNE seule exécution de repondre() par message (avec ET sans « ? »), mesurée par les lectures de l\'esprit', async () => {
  const monde = await creerMonde();
  for (const texte of ['Quel est mon manteau ?', 'Quel est mon sac ?', 'Zorglub ?', 'Bonjour', 'Mon manteau est bleu', 'zrel1 zrel2 zalpha', 'Retiens que mon manteau est bleu']) {
    const base = esprit_compteur(monde.esprit);
    repondre(base.proxy, texte);
    assert.ok(base.compteur.lectures >= 1);
    for (const avecObservateur of [false, true]) {
      if (!avecObservateur && !texte.includes('?')) continue; // sans « ? » et sans observateur : aucune analyse du tout
      const mesure = esprit_compteur(monde.esprit);
      await tenterPontLangage(texte, {
        assurerEsprit: async () => mesure.proxy,
        journaliser: async () => [null, null],
        enregistrerExperience: async () => ({ id: 'exp-test' }),
        ajouterInterpretation: async () => {},
        observer: avecObservateur ? async () => null : null,
      });
      assert.equal(mesure.compteur.lectures, base.compteur.lectures, `${texte} (observateur: ${avecObservateur})`);
    }
  }
});

test('B6. (statique) exactement UN site d\'appel à repondre( dans pont.js, et la décision reste soumise à « ? »', () => {
  const code = sansCommentaires(PONT);
  assert.equal((code.match(/repondre\(/g) || []).length, 1);
  assert.match(code, /const local = ressembleAUneQuestion \? analyse : null;/);
});

test('B7. sans observateur : comportement STRICTEMENT antérieur (sans « ? » : esprit jamais ouvert, retour null)', async () => {
  let ouvertures = 0;
  const monde = await creerMonde();
  const r = await tenterPontLangage('Bonjour', {
    assurerEsprit: async () => { ouvertures += 1; return monde.esprit; },
    journaliser: async () => [null, null], enregistrerExperience: async () => ({ id: 'e' }), ajouterInterpretation: async () => {},
  });
  assert.equal(r, null);
  assert.equal(ouvertures, 0);
});

test('B8. avec observateur, sans « ? » : retour null (jamais de tentative, jamais de réponse locale), esprit ouvert une fois', async () => {
  let ouvertures = 0;
  const monde = await creerMonde();
  for (const texte of ['Bonjour', 'Mon sac est vert', 'Mon manteau est bleu', 'Retiens que mon manteau est bleu', 'Est-ce que le ciel est bleu']) {
    ouvertures = 0;
    const r = await tenterPontLangage(texte, {
      assurerEsprit: async () => { ouvertures += 1; return monde.esprit; },
      journaliser: async () => { throw new Error('ne doit pas être appelé'); },
      enregistrerExperience: async () => { throw new Error('ne doit pas être appelé'); },
      ajouterInterpretation: async () => { throw new Error('ne doit pas être appelé'); },
      apresNouvelleExperience: async () => { throw new Error('ne doit pas être appelé'); },
      observer: async () => null,
    });
    assert.equal(r, null, texte);
    assert.equal(ouvertures, 1, texte);
  }
});

// ============================================================================ C. SANS « ? » : OBSERVÉ SANS DEVENIR EXPÉRIENCE
test('C1. sans « ? » : une observation, AUCUNE expérience, Gemini appelé comme avant, retour du moteur externe inchangé', async () => {
  const monde = await creerMonde();
  for (const texte of ['Bonjour', 'Mon sac est vert', 'Est-ce que le ciel est bleu']) {
    const r = await tour(monde, texte);
    assert.equal(r.texte, 'Réponse Gemini');
    assert.equal(r.idExperience, undefined);
    assert.equal(r.local, false);
  }
  assert.equal((await observations(monde)).length, 3);
  assert.deepEqual(await monde.magasin.lireTout('experiences'), []);
  assert.deepEqual(await monde.magasin.lireTout('hypotheses'), []);
  assert.deepEqual(await monde.magasin.lireTout('propositions'), []);
  assert.equal(monde.gemini.appels, 3);
  assert.equal(monde.evenements.filter((e) => e[0] === 'enregistrerExperience').length, 0);
});

test('C2. un faux COMPRIS sans « ? » continue vers Gemini : pas de réponse locale, pas d\'échange « laboratoire », pas d\'expérience', async () => {
  const monde = await creerMonde();
  for (const texte of ['Mon manteau est bleu', 'Retiens que mon manteau est bleu']) {
    const direct = repondre(monde.esprit, texte);
    assert.equal(direct.etat, 'compris'); // le moteur propre se croit sûr de lui...
    const r = await tour(monde, texte);
    assert.equal(r.texte, 'Réponse Gemini'); // ...mais la décision reste celle d'avant : Gemini répond
    assert.equal(r.laboratoire, undefined);
  }
  assert.equal(monde.journal.filter((j) => j.moteur === 'laboratoire').length, 0);
  assert.deepEqual(await monde.magasin.lireTout('experiences'), []);
  assert.equal(monde.gemini.appels, 2);
  const lignes = await observations(monde);
  assert.deepEqual(lignes.map((l) => l.etatRepondre), ['compris', 'compris']);
});

test('C3. PARTIEL / INCOMPRIS sans « ? » : observés, jamais promus en `tentative` ni en expérience (le garde « ? » n\'est pas contourné)', async () => {
  const monde = await creerMonde();
  await tour(monde, 'Mon sac est vert');
  await tour(monde, 'Bonjour');
  assert.deepEqual((await observations(monde)).map((l) => l.etatRepondre), ['partiel', 'incompris']);
  assert.deepEqual(await monde.magasin.lireTout('experiences'), []);
  // et avec un « ? » le comportement d'avant est intact : expérience créée APRÈS la réponse externe
  const r = await tour(monde, 'Quel est mon sac ?');
  assert.ok(r.idExperience);
  assert.equal((await monde.magasin.lireTout('experiences')).length, 1);
});

test('C4. avec « ? » COMPRIS : observation ET expérience ; les deux partagent le même échange du journal', async () => {
  const monde = await creerMonde();
  const r = await tour(monde, 'Quel est mon manteau ?');
  assert.equal(r.local, true);
  const [ligne] = await observations(monde);
  const [exp] = await monde.magasin.lireTout('experiences');
  assert.deepEqual(ligne.referenceMemoire, exp.referenceMemoire);
  assert.notEqual(ligne.referenceMemoire, null);
  assert.equal(ligne.etatRepondre, 'compris');
});

test('C5. avec « ? » PARTIEL : observation, expérience créée après Gemini, rattachement à l\'échange Gemini', async () => {
  const monde = await creerMonde();
  await tour(monde, 'Quel est mon sac ?');
  const [ligne] = await observations(monde);
  const [exp] = await monde.magasin.lireTout('experiences');
  assert.equal(ligne.etatRepondre, 'partiel');
  assert.deepEqual(ligne.referenceMemoire, exp.referenceMemoire);
  assert.ok(ligne.referenceMemoire && ligne.referenceMemoire.idQuestion);
});

test('C6. répétition : chaque envoi réel est un nouvel instant T (aucune déduplication), même après un échec Gemini', async () => {
  const monde = await creerMonde();
  await tour(monde, 'Bonjour');
  await tour(monde, 'Bonjour');
  monde.gemini.echec = true;
  await assert.rejects(tour(monde, 'Bonjour'), /Gemini indisponible/);
  monde.gemini.echec = false;
  await tour(monde, 'Bonjour');
  const lignes = await observations(monde);
  assert.equal(lignes.length, 4);
  assert.equal(new Set(lignes.map((l) => l.id)).size, 4);
  assert.deepEqual(lignes.map((l) => l.texte), ['Bonjour', 'Bonjour', 'Bonjour', 'Bonjour']);
});

test('C7. réponse liée à une trace : idTrace conservé (chaîne) ; sans référence ou référence invalide : null', async () => {
  const monde = await creerMonde();
  await tour(monde, 'Bonjour', { referenceTrace: { idTrace: 'trace-42' } });
  await tour(monde, 'Bonjour', { referenceTrace: null });
  await tour(monde, 'Bonjour', { referenceTrace: { idTrace: '' } });
  await tour(monde, 'Bonjour', { referenceTrace: { idTrace: 12 } });
  assert.deepEqual((await observations(monde)).map((l) => l.idTrace), ['trace-42', null, null, null]);
});

test('C8. reprise forcée : jamais observée ; un envoi sans repriseDe, avec repriseDe null ou forcerExterne faux, l\'est', async () => {
  const monde = await creerMonde();
  await tour(monde, 'Bonjour', { options: { repriseDe: 4, forcerExterne: true } });
  await tour(monde, 'Bonjour', { options: { forcerExterne: true } });
  await tour(monde, 'Bonjour', { options: { repriseDe: 0 } });
  assert.equal((await observations(monde)).length, 0);
  await tour(monde, 'Bonjour', { options: { repriseDe: null, forcerExterne: false } });
  await tour(monde, 'Bonjour', { options: {} });
  await tour(monde, 'Bonjour', { options: undefined });
  assert.equal((await observations(monde)).length, 3);
});

test('C9. chaque observation est la photographie de SON instant : un mot enseigné entre deux envois change la 2e, jamais la 1re', async () => {
  const monde = await creerMonde();
  await tour(monde, 'Quel est mon sac ?');
  const premiere = JSON.stringify((await observations(monde))[0]);
  await apprendreRelation(monde.esprit, { mot: 'sac', relation: 'sac' });
  await apprendreFait(monde.esprit, { sujet: 'moi', relation: 'sac', valeur: 'un sac vert' });
  await tour(monde, 'Quel est mon sac ?');
  const lignes = await observations(monde);
  assert.equal(lignes.length, 2);
  assert.equal(lignes[0].etatRepondre, 'partiel');
  assert.deepEqual(lignes[0].motsInconnus, ['sac']);
  assert.equal(lignes[1].etatRepondre, 'compris');
  assert.deepEqual(lignes[1].motsInconnus, []);
  assert.equal(JSON.stringify(lignes[0]), premiere.replace('"referenceMemoire":null', `"referenceMemoire":${JSON.stringify(lignes[0].referenceMemoire)}`));
});

test('C10. texte intact de bout en bout (espaces et longueur) pour un message réel passant par le moteur', async () => {
  const monde = await creerMonde();
  const texte = `  ${'Mon manteau est bleu et il est très beau. '.repeat(60)}`;
  await tour(monde, texte);
  assert.equal((await observations(monde))[0].texte, texte);
});

// ============================================================================ D. RATTACHEMENT
test('D1. voie Gemini : la ligne reçoit {idQuestion, idReponse} réels de l\'échange du journal', async () => {
  const monde = await creerMonde();
  const r = await tour(monde, 'Bonjour');
  const [ligne] = await observations(monde);
  assert.deepEqual(ligne.referenceMemoire, { idQuestion: r.idQuestion, idReponse: r.idReponse });
  assert.equal(monde.journal.find((j) => j.id === r.idQuestion).texte, 'Bonjour');
});

test('D2. Gemini échoue : l\'observation EXISTE, jamais rattachée (referenceMemoire null), aucune erreur ajoutée', async () => {
  const monde = await creerMonde();
  monde.gemini.echec = true;
  await assert.rejects(tour(monde, 'Mon sac est vert'), /Gemini indisponible/);
  const lignes = await observations(monde);
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].referenceMemoire, null);
  assert.equal(lignes[0].etatRepondre, 'partiel');
});

test('D3. voie laboratoire (« ? » COMPRIS) : rattachée par le pont avec les ids que journaliser() a rendus', async () => {
  const monde = await creerMonde();
  await tour(monde, 'Quel est mon manteau ?');
  const [ligne] = await observations(monde);
  const echange = monde.journal.filter((j) => j.moteur === 'laboratoire');
  assert.deepEqual(ligne.referenceMemoire, { idQuestion: echange[0].id, idReponse: echange[1].id });
});

test('D4. ids absents (journaliser rend [null, null]) : aucun rattachement, la ligne reste telle quelle', async () => {
  const monde = await creerMonde();
  const observateur = creerObservateurLangage({
    enregistrer: (d) => enregistrerObservationLangage(monde.magasin, d),
    rattacher: (l, e) => rattacherObservationLangage(monde.magasin, l, e),
  });
  await tenterPontLangage('Quel est mon manteau ?', {
    assurerEsprit: monde.ecran.assurerEsprit, journaliser: async () => [null, null],
    enregistrerExperience: async () => ({ id: 'e' }), ajouterInterpretation: async () => {}, observer: observateur,
  });
  assert.equal((await observations(monde))[0].referenceMemoire, null);
});

test('D5. un seul rattachement par observation (le second appel est sans effet) et jamais partiel', async () => {
  const monde = await creerMonde();
  let poignee = null;
  await tour(monde, 'Bonjour', { surPoignee: (p) => { poignee = p; } });
  const avant = JSON.stringify(await observations(monde));
  assert.equal(await poignee.rattacher({ idQuestion: 99, idReponse: 100 }), false);
  assert.equal(JSON.stringify(await observations(monde)), avant);
  const monde2 = await creerMonde();
  let p2 = null;
  monde2.gemini.echec = true;
  await assert.rejects(tour(monde2, 'Bonjour', { surPoignee: (p) => { p2 = p; } }));
  assert.equal(await p2.rattacher({ idQuestion: 5 }), false);
  assert.equal(await p2.rattacher(null), false);
  assert.equal((await observations(monde2))[0].referenceMemoire, null);
  assert.equal(await p2.rattacher({ idQuestion: 5, idReponse: 6 }), true);
  assert.deepEqual((await observations(monde2))[0].referenceMemoire, { idQuestion: 5, idReponse: 6 });
});

test('D6. le rattachement ne modifie AUCUN autre champ de la ligne ni aucune autre table', async () => {
  const monde = await creerMonde();
  monde.gemini.echec = true;
  let poignee = null;
  await assert.rejects(tour(monde, 'Mon sac est vert', { surPoignee: (p) => { poignee = p; } }));
  const avant = (await observations(monde))[0];
  const autres = JSON.stringify(await photoSansObservations(monde));
  await poignee.rattacher({ idQuestion: 5, idReponse: 6 });
  const apres = (await observations(monde))[0];
  assert.deepEqual({ ...apres, referenceMemoire: null }, avant);
  assert.equal(JSON.stringify(await photoSansObservations(monde)), autres);
});

// ============================================================================ E. PASSIVITÉ : DIFFÉRENTIEL
test('E1. différentiel : retours, appels, journal, moteurs et TOUTES les autres tables identiques avec et sans observateur', async () => {
  const sans = await creerMonde();
  const avec = await creerMonde();
  const retourSans = await jouer(sans, false);
  const retourAvec = await jouer(avec, true);
  assert.equal(normaliser(retourAvec), normaliser(retourSans), 'valeurs de retour');
  assert.equal(normaliser(await photoSansObservations(avec)), normaliser(await photoSansObservations(sans)), 'tables, journal, appels');
  assert.equal(avec.gemini.appels, sans.gemini.appels);
  assert.equal((await observations(sans)).length, 0);
  assert.equal((await observations(avec)).length, OBSERVES.length);
});

test('E2. différentiel : aucune expérience, hypothèse ni proposition de plus ou de moins ; mêmes tables pour chaque catégorie', async () => {
  const sans = await creerMonde();
  const avec = await creerMonde();
  await jouer(sans, false);
  await jouer(avec, true);
  for (const t of ['experiences', 'hypotheses', 'propositions', 'faits', 'lexique', 'regles', 'gabaritsTypes', 'patrons', 'traces', 'liaisons', 'actes', 'enonces', 'observationsComposition', 'actions', 'transformations', 'proprietes', 'journal']) {
    assert.equal(normaliser(await avec.magasin.lireTout(t)), normaliser(await sans.magasin.lireTout(t)), t);
  }
  assert.ok((await sans.magasin.lireTout('experiences')).length >= 3, 'le scénario crée bien des expériences (sensibilité du test)');
});

test('E3. différentiel : la mémoire de conversation (journal, moteur de chaque échange) est identique', async () => {
  const sans = await creerMonde();
  const avec = await creerMonde();
  await jouer(sans, false);
  await jouer(avec, true);
  assert.deepEqual(avec.journal, sans.journal);
  assert.deepEqual(avec.journal.map((j) => j.moteur), sans.journal.map((j) => j.moteur));
});

test('E4. la voie « ? » COMPRIS journalise puis enregistre l\'expérience dans le MÊME ordre qu\'avant (le rattachement s\'intercale sans réordonner)', async () => {
  const sans = await creerMonde();
  const avec = await creerMonde();
  await tour(sans, 'Quel est mon manteau ?', { observation: false });
  await tour(avec, 'Quel est mon manteau ?', { observation: true });
  assert.equal(normaliser(avec.evenements), normaliser(sans.evenements));
  assert.deepEqual(avec.evenements.map((e) => e[0]), ['journaliser', 'enregistrerExperience', 'ajouterInterpretation']);
});

test('E5. les 14 messages du scénario : exactement les messages hors reprise sont observés, dans l\'ordre', async () => {
  const monde = await creerMonde();
  await jouer(monde, true);
  const lignes = await observations(monde);
  assert.deepEqual(lignes.map((l) => l.texte), OBSERVES.map((s) => s.texte));
  assert.equal(lignes.length, SCENARIO.length - 1);
});

// ============================================================================ F. DORMANCE : PERSONNE NE LIT LA TABLE
async function monterVecuProposable(monde) {
  for (let i = 0; i < 8; i += 1) {
    await enregistrerExperience(monde.magasin, { texteRecu: `Ziqualo, mon objet${i} est couleur${i}.`, texteRepondu: 'x', date: new Date(1790000000000 + i).toISOString(), source: 'laboratoire', referenceMemoire: { idQuestion: 100 + 2 * i, idReponse: 101 + 2 * i }, referenceTrace: null });
  }
  for (let i = 0; i < 6; i += 1) {
    await enregistrerExperience(monde.magasin, { texteRecu: `Mon objet${i} est couleur${i}.`, texteRepondu: 'x', date: new Date(1790000000100 + i).toISOString(), source: 'laboratoire', referenceMemoire: { idQuestion: 200 + 2 * i, idReponse: 201 + 2 * i }, referenceTrace: null });
  }
}
const TEXTES_ORDINAIRES = Array.from({ length: 42 }, (_, i) => (i % 3 === 0 ? `Ziqualo, il fait beau aujourd'hui ${i}` : i % 3 === 1 ? `Mon voisin a un chat ${i}` : `Je suis content de ${i}`));
async function garnirObservations(monde) {
  for (const texte of TEXTES_ORDINAIRES) {
    const r = repondre(monde.esprit, texte);
    await enregistrerObservationLangage(monde.magasin, {
      texte, etatComprendre: r.comprehension.etat, etatRepondre: r.etat, type: r.comprehension.type, sujet: r.comprehension.sujet,
      relation: r.comprehension.relation, motsInconnus: r.comprehension.motsInconnus, relationsNommees: r.comprehension.relationsNommees, idTrace: null,
    });
  }
}

test('F1. dormance : 42 observations de plus ne changent AUCUNE proposition ni aucun résultat des consommateurs d\'expériences', async () => {
  const sans = await creerMonde();
  const avec = await creerMonde();
  await monterVecuProposable(sans);
  await monterVecuProposable(avec);
  await garnirObservations(avec);
  assert.equal((await observations(avec)).length, 42);
  const propSans = await sans.ecran.examinerPropositionSpontanee();
  const propAvec = await avec.ecran.examinerPropositionSpontanee();
  assert.ok(propSans, 'sensibilité : le vécu seul justifie bien une proposition');
  assert.equal(normaliser(propAvec), normaliser(propSans));
  const [exp] = await sans.magasin.lireTout('experiences');
  const [exp2] = await avec.magasin.lireTout('experiences');
  assert.equal(normaliser(await avec.ecran.reconnaitreAttentesPourExperience(exp2.id)), normaliser(await sans.ecran.reconnaitreAttentesPourExperience(exp.id)));
  assert.equal(normaliser(await examinerVecuEtFormerHypotheses(avec.magasin, avec.esprit.lexique)), normaliser(await examinerVecuEtFormerHypotheses(sans.magasin, sans.esprit.lexique)));
  for (const t of TABLES) if (t !== T) assert.equal(normaliser(await avec.magasin.lireTout(t)), normaliser(await sans.magasin.lireTout(t)), t);
});

test('F2. contrôle de sensibilité : les MÊMES 42 textes entrés comme EXPÉRIENCES changeraient bien le repérage de motifs (donc F1 n\'est pas vacueux)', async () => {
  const monde = await creerMonde();
  await monterVecuProposable(monde);
  const lectureMotifs = async () => {
    const toutes = await monde.magasin.lireTout('experiences');
    return repererMotifs(poolExperiencesRecentes(toutes.map((x) => ({ id: x.id, texteRecu: x.texteRecu, date: x.date }))), { lexique: monde.esprit.lexique });
  };
  const avant = normaliser(await lectureMotifs());
  for (const [i, texte] of TEXTES_ORDINAIRES.entries()) {
    await enregistrerExperience(monde.magasin, { texteRecu: texte, texteRepondu: 'x', date: new Date(1790000001000 + i).toISOString(), source: 'laboratoire', referenceMemoire: { idQuestion: 300 + 2 * i, idReponse: 301 + 2 * i }, referenceTrace: null });
  }
  assert.notEqual(normaliser(await lectureMotifs()), avant);
});

function fichiersJs(dossier) {
  const sortie = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiersJs(chemin));
    else if (nom.endsWith('.js')) sortie.push(chemin);
  }
  return sortie;
}

test('F3. (statique) aucun module de app/ ne LIT la table : seuls connaissances.js, pont.js, main.js et sauvegarde.js la mentionnent', () => {
  const AUTORISES = new Set(['langage/connaissances.js', 'langage/pont.js', 'main.js', 'memoire/sauvegarde.js'].map((p) => p.split('/').join(sep)));
  for (const f of fichiersJs(APP)) {
    const rel = relative(APP, f);
    const code = sansCommentaires(readFileSync(f, 'utf8'));
    const mentionne = /observationsLangage|ObservationLangage|ObservateurLangage|observateurLangage|poigneeObservation/.test(code);
    if (mentionne) assert.ok(AUTORISES.has(rel), `${rel} mentionne observationsLangage sans y être autorisé`);
    assert.equal(/lireTout\(\s*['"]observationsLangage['"]/.test(code), false, `${rel} lit la table`);
    assert.equal(/\.plage\(\s*['"]observationsLangage['"]/.test(code), false, `${rel} lit la table`);
  }
});

test('F4. (statique) connaissances.js : la table n\'apparaît dans du code exécutable que pour TABLES, CLE et les deux fonctions d\'écriture', () => {
  const code = sansCommentaires(lire('langage', 'connaissances.js'));
  const lignes = code.split('\n').filter((l) => /observationsLangage/.test(l));
  for (const l of lignes) {
    assert.ok(/TABLES = \[|observationsLangage: 'id'|magasin\.ecrire\('observationsLangage', objet\)/.test(l), `usage inattendu : ${l.trim()}`);
  }
  assert.equal(lignes.filter((l) => /magasin\.ecrire/.test(l)).length, 2);
});

test('F5. (statique) ni induction, ni hypothèses, ni propositions, ni sélection, ni aiguillage ne connaissent la table', () => {
  for (const f of ['langage/induction.js', 'langage/selection.js', 'langage/confrontation.js', 'langage/retours-traces.js', 'langage/retours-par-structure.js',
    'langage/reactions-compositions.js', 'langage/vue-traces.js', 'langage/ecran.js', 'esprit/aiguillage.js', 'esprit/esprit.js']) {
    assert.equal(/observationsLangage/i.test(lire(...f.split('/'))), false, f);
  }
});

// ============================================================================ G. ÉCHEC SILENCIEUX
const deps = (monde, extra = {}) => ({
  assurerEsprit: monde.ecran.assurerEsprit,
  journaliser: async (q, r) => monde.ajouterEchange(q, r, 'laboratoire'),
  enregistrerExperience: async (d) => enregistrerExperience(monde.magasin, d),
  ajouterInterpretation: async (id, d) => ajouterInterpretation(monde.magasin, id, d),
  ...extra,
});

test('G1. écriture de l\'observation en échec : le tour renvoie la même chose, sans note, sans erreur', async () => {
  const sain = await creerMonde();
  const casse = await creerMonde();
  const ecrireOrigine = casse.magasin.ecrire.bind(casse.magasin);
  casse.magasin.ecrire = async (table, objet) => { if (table === T) throw new Error('disque plein'); return ecrireOrigine(table, objet); };
  const a = await jouer(sain, true);
  const b = await jouer(casse, true);
  assert.equal(normaliser(b), normaliser(a));
  assert.deepEqual(await casse.magasin.lireTout(T), []);
  assert.equal(normaliser(await photoSansObservations(casse)), normaliser(await photoSansObservations(sain)));
  assert.equal(JSON.stringify(b).includes('observation'), false);
});

test('G2. validation de l\'observation en échec (résultat incohérent) : avalée, la poignée est sans effet', async () => {
  const monde = await creerMonde();
  const observateur = creerObservateurLangage({
    enregistrer: (d) => enregistrerObservationLangage(monde.magasin, { ...d, etatComprendre: 'bizarre' }),
    rattacher: (l, e) => rattacherObservationLangage(monde.magasin, l, e),
  });
  const poignee = await observateur('Bonjour', repondre(monde.esprit, 'Bonjour'), null);
  assert.equal(await poignee.rattacher({ idQuestion: 1, idReponse: 2 }), false);
  assert.deepEqual(await observations(monde), []);
});

test('G3. rattachement en échec : avalé, la ligne reste non rattachée, le tour continue', async () => {
  const monde = await creerMonde();
  const observateur = creerObservateurLangage({
    enregistrer: (d) => enregistrerObservationLangage(monde.magasin, d),
    rattacher: async () => { throw new Error('boum'); },
  });
  const poignee = await observateur('Bonjour', repondre(monde.esprit, 'Bonjour'), null);
  assert.equal(await poignee.rattacher({ idQuestion: 1, idReponse: 2 }), false);
  assert.equal((await observations(monde))[0].referenceMemoire, null);
  // et via le pont : le rattachement qui lève ne remonte jamais
  const r = await tenterPontLangage('Quel est mon manteau ?', deps(monde, { observer: observateur }));
  assert.equal(r.local, true);
});

test('G4. un observateur qui LÈVE (hors fabrique) est traité par le pont comme une capture absente, avec et sans « ? »', async () => {
  const monde = await creerMonde();
  const observer = async () => { throw new Error('observateur cassé'); };
  assert.equal(await tenterPontLangage('Bonjour', deps(monde, { observer })), null);
  const r = await tenterPontLangage('Quel est mon manteau ?', deps(monde, { observer }));
  assert.equal(r.local, true);
  assert.equal(r.texte, 'un manteau bleu');
  const t = await tenterPontLangage('Quel est mon sac ?', deps(monde, { observer }));
  assert.equal(t.tentative.etat, 'partiel');
});

test('G5. une poignée dont rattacher() lève est ignorée par le pont (voie laboratoire)', async () => {
  const monde = await creerMonde();
  const observer = async () => ({ rattacher: async () => { throw new Error('boum'); } });
  const r = await tenterPontLangage('Quel est mon manteau ?', deps(monde, { observer }));
  assert.equal(r.local, true);
  assert.equal((await monde.magasin.lireTout('experiences')).length, 1);
});

test('G6. repondre() qui lève : sans « ? » -> aucune observation, aucune fausse ligne, retour null ; avec « ? » -> l\'erreur se propage comme avant', async () => {
  const monde = await creerMonde();
  const cassé = new Proxy(monde.esprit, { get: (t, k) => { if (k === 'lexique') throw new Error('analyse impossible'); return t[k]; } });
  let appels = 0;
  const observer = async () => { appels += 1; return null; };
  assert.equal(await tenterPontLangage('Bonjour', deps(monde, { assurerEsprit: async () => cassé, observer })), null);
  assert.equal(appels, 0);
  await assert.rejects(tenterPontLangage('Bonjour ?', deps(monde, { assurerEsprit: async () => cassé, observer })), /analyse impossible/);
  await assert.rejects(tenterPontLangage('Bonjour ?', deps(monde, { assurerEsprit: async () => cassé })), /analyse impossible/);
  assert.deepEqual(await observations(monde), []);
});

test('G7. assurerEsprit() qui lève : sans « ? » avalé (tour inchangé), avec « ? » propagé comme avant', async () => {
  const monde = await creerMonde();
  const assurerEsprit = async () => { throw new Error('base fermée'); };
  assert.equal(await tenterPontLangage('Bonjour', deps(monde, { assurerEsprit, observer: async () => null })), null);
  await assert.rejects(tenterPontLangage('Bonjour ?', deps(monde, { assurerEsprit, observer: async () => null })), /base fermée/);
});

test('G8. une panne de capture n\'empêche jamais la suite : expériences et réponse Gemini identiques au scénario sain', async () => {
  const monde = await creerMonde();
  const ecrireOrigine = monde.magasin.ecrire.bind(monde.magasin);
  monde.magasin.ecrire = async (table, objet) => { if (table === T) throw new Error('panne'); return ecrireOrigine(table, objet); };
  const r = await tour(monde, 'Quel est mon sac ?');
  assert.equal(r.texte, 'Réponse Gemini');
  assert.ok(r.idExperience);
  assert.equal(monde.gemini.appels, 1);
});

// ============================================================================ J. CÂBLAGE DE main.js (statique)
const iPont = MAIN.indexOf('await tenterPontLangage(texte, {');
test('J1. main.js : importe et utilise les trois éléments, créés une seule fois par tour', () => {
  assert.match(MAIN, /enregistrerObservationLangage as enregistrerObservationLangageReelle, rattacherObservationLangage as rattacherObservationLangageReelle/);
  assert.match(MAIN, /import \{[^}]*creerObservateurLangage[^}]*\} from '\.\/langage\/pont\.js'/);
  assert.equal((sansCommentaires(MAIN).match(/creerObservateurLangage\(/g) || []).length, 1);
  assert.ok(iPont > 0);
});

test('J2. main.js : reprise exclue exactement comme dans le simulateur ; observer null en cas de reprise', () => {
  assert.match(MAIN, /const sansObservation = !!options && \(options\.repriseDe != null \|\| options\.forcerExterne === true\);/);
  assert.match(MAIN, /observer: sansObservation \? null : async \(t, resultat, ref\) => \{\s*poigneeObservation = await observateurLangage\(t, resultat, ref\);\s*return poigneeObservation;\s*\},/);
});

test('J3. main.js : l\'observateur n\'est mentionné QU\'APRÈS tous les mécanismes prioritaires (périmètre : voie ordinaire seulement)', () => {
  const code = sansCommentaires(MAIN);
  const premiere = code.search(/observateurLangage|poigneeObservation|sansObservation/);
  assert.ok(premiere > 0);
  for (const garde of [
    'MARQUEUR_SIGNIFICATION.test(texte)', 'MARQUEUR_REFUSER_PROPOSITION.test(texte)', 'estEnseignementNaturel(texte)', 'MARQUEUR_APPRENTISSAGE.test(texte)',
    'MARQUEUR_VALIDER_COURS.test(texte)', 'MARQUEUR_ANNULER_COURS.test(texte)', 'MARQUEUR_COURS.test(texte)', 'MARQUEUR_VALIDER_TRANSFORMATION.test(texte)',
    'MARQUEUR_ANNULER_TRANSFORMATION.test(texte)', 'MARQUEUR_TRANSFORMATION.test(texteSansIntention)', 'MARQUEUR_APPLIQUE.test(texte)',
    'MARQUEUR_VALIDER_ACTION.test(texte)', 'MARQUEUR_ANNULER_ACTION.test(texte)', 'MARQUEUR_ACTION.test(texte)', 'MARQUEUR_VALIDER_LIAISON.test(texte)',
    'MARQUEUR_ANNULER_LIAISON.test(texte)', 'MARQUEUR_LIAISON.test(texte)', 'MARQUEUR_COMPOSE.test(texte)',
    'ecranLangage.tenterReconnaissanceTransformation(texte)', 'ecranLangage.tenterReconnaissanceAction(texte)', 'ecranLangage.tenterRejeuAutonome(texte)',
  ]) {
    const i = code.indexOf(garde);
    assert.ok(i >= 0, `garde introuvable : ${garde}`);
    assert.ok(i < premiere, `${garde} doit précéder l'observation`);
  }
});

test('J4. main.js : le rattachement suit esprit.repondre() et précède la branche `tentative` ; esprit.repondre reste atteint une seule fois', () => {
  const code = sansCommentaires(MAIN);
  const iRepondre = code.indexOf('const reponse = await esprit.repondre(texte, options);');
  const iRattacher = code.indexOf('poigneeObservation.rattacher({ idQuestion: reponse.idQuestion, idReponse: reponse.idReponse })');
  const iTentative = code.indexOf('if (local && local.tentative)');
  assert.ok(iRepondre > 0 && iRattacher > iRepondre && iTentative > iRattacher);
  assert.equal((code.match(/esprit\.repondre\(/g) || []).length, 1);
});

test('J5. main.js : le simulateur et le vrai code passent les MÊMES dépendances au pont (extrait comparé)', () => {
  const bloc = MAIN.slice(iPont, MAIN.indexOf('});', iPont) + 3);
  for (const motif of ['assurerEsprit: ecranLangage.assurerEsprit', 'journaliser: journaliserEchangeLaboratoire', '...experienceDeps', 'referenceTrace,']) {
    assert.ok(bloc.includes(motif), motif);
  }
});

test('J6. main.js : aucune logique d\'observation hors câblage (pas de lecture de la table, pas de second appel à l\'analyse)', () => {
  const code = sansCommentaires(MAIN);
  assert.equal(/lireTout\(\s*['"]observationsLangage/.test(code), false);
  assert.equal((code.match(/[^.\w]repondre\(/g) || []).length, 0, 'main.js n\'appelle pas directement le moteur de langage');
});

test('J7. pont.js : l\'observation et le rattachement sont à des endroits uniques et dans l\'ordre prévu', () => {
  const code = sansCommentaires(PONT);
  const iAnalyse = code.indexOf('analyse = repondre(eLangage, texte);');
  const iObserver = code.indexOf('poignee = await observer(texte, analyse, referenceTrace);');
  const iBranche = code.indexOf('if (local && local.etat === COMPRIS)');
  const iJournaliser = code.indexOf('await journaliser(texte, local.texte, dateQuestion);');
  const iRattacher = code.indexOf('poignee.rattacher({ idQuestion, idReponse })');
  const iExperience = code.indexOf('await enregistrerExperience({');
  assert.ok(iAnalyse > 0 && iObserver > iAnalyse && iBranche > iObserver);
  assert.ok(iJournaliser > iBranche && iRattacher > iJournaliser && iExperience > iRattacher);
  assert.equal((code.match(/observer\(/g) || []).length, 1);
});
// === FIN_TEST_OBSERVATIONS_LANGAGE ===
