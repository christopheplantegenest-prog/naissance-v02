import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireTrace, noterTrace, lireTraces, effacerTraces, traceEnTexte, rapportTraces } from '../app/moteur-local/diagnostic.js';
import { lancerBanc, analyser, rapport, enEpreuves } from '../app/moteur-local/banc.js';
import { epreuves, GROUPES } from '../app/moteur-local/protocoles.js';
import { classer, elementsDistinctifs, variabilite, personnesEmployees } from '../app/moteur-local/classement.js';
import { fauxStockage } from './outils.mjs';

const contexte = {
  variante: 'court',
  estimation: { prefixe: 90, suite: 70, souvenirs: 25, historique: 0, message: 8, total: 160 },
  souvenirsTrace: [
    { id: 's-ville', texte: 'Christophe habite à Marcillac-Lanville.', statut: 'injecté', motsCommuns: ['habite'], importance: 3 },
    { id: 's-bleu', texte: 'Sa couleur préférée est le bleu.', statut: 'écarté (budget)', motsCommuns: ['couleur'], importance: 2 },
  ],
};
const mesures = { cache: 'mémoire', jetonsPrefixe: 88, jetonsSuite: 64, jetonsEcrits: 30, prefixeMs: 0, suiteMs: 6200, premierMotMs: 6400, lectureJps: 10.3, ecritureJps: 7.5, fin: 'naturelle' };

test('trace : ce qui a été sélectionné, injecté, écarté, et ce que ça a coûté', () => {
  const t = construireTrace({ question: "Où j'habite ?", reponse: 'Tu habites à Marcillac-Lanville.', contexte, mesures, date: '2026-09-18T16:00:00Z' });
  assert.equal(t.variante, 'court');
  assert.deepEqual(t.souvenirs.map((s) => [s.id, s.statut, s.motsCommuns]), [
    ['s-ville', 'injecté', ['habite']], ['s-bleu', 'écarté (budget)', ['couleur']],
  ]);
  assert.deepEqual(t.jetonsEstimes, { prefixe: 90, suite: 70, souvenirs: 25, historique: 0, message: 8, total: 160 });
  assert.deepEqual(t.jetonsReels, { prefixe: 88, suite: 64, ecrits: 30 });
  assert.equal(t.cache, 'mémoire');
  assert.deepEqual(t.vitesses, { lecture: 10.3, ecriture: 7.5 });
  const texte = traceEnTexte(t);
  assert.match(texte, /\[injecté\] Christophe habite à Marcillac-Lanville\. \(mots communs : habite\)/);
  assert.match(texte, /Jetons estimés : total 160 \(identité 90, souvenirs 25, conversation 0, question 8\)/);
  assert.match(texte, /premier mot 6,4 s/);
});

test('traces gardées, limitées, effaçables, avec des moyennes', () => {
  const s = fauxStockage();
  assert.equal(rapportTraces(lireTraces(s)), 'Aucune réponse locale enregistrée.');
  for (let i = 0; i < 30; i++) {
    noterTrace(construireTrace({ question: `q${i}`, reponse: 'r', contexte, mesures, date: 'd' }), s);
  }
  assert.equal(lireTraces(s).length, 20, 'les 20 dernières seulement');
  assert.match(rapportTraces(lireTraces(s)), /20 réponse\(s\)[\s\S]*lecture 10,3 jetons\/s/);
  effacerTraces(s);
  assert.deepEqual(lireTraces(s), []);
});


const IDENTITE = { personne: 'Christophe', ia: 'Naissance' };
const contexteAvec = (souvenirs, statut = 'injecté') => ({
  prefixe: "Tu es Naissance, l'IA personnelle de Christophe.",
  elements: [{ role: 'systeme', texte: souvenirs.join('\n') }, { role: 'moi', texte: 'question' }],
  estimation: { total: 160, souvenirs: 40 },
  souvenirsTrace: souvenirs.map((texte, i) => ({ id: `s${i}`, texte, statut, motsCommuns: [] })),
});
const epreuveFait = { id: 'e', groupe: 'roles', question: "Où est-ce que j'habite ?", sujet: 'personne', attendu: 'fait' };

test('classement : les six cas observés sur le téléphone', () => {
  const ctx = contexteAvec(['Christophe habite à Marcillac-Lanville.']);
  const cas = (reponse, epreuve = epreuveFait, contexte = ctx) => classer({ epreuve, reponse, contexte, identite: IDENTITE }).categorie;
  assert.equal(cas('Tu habites à Marcillac-Lanville.'), 'bonne');
  assert.equal(cas('Je suis Naissance de Christophe, et j’habite à Marcillac-Lanville.'), 'confusion-roles');
  assert.equal(cas('Tu habites à Marcillac-Lanville, dans la province du Prievér.'), 'invention');
  assert.equal(cas('Je ne sais pas.'), 'ignore', 'souvenir fourni mais non utilisé');
  assert.equal(cas('Les tomates poussent bien cette année.'), 'hors-sujet');
  assert.equal(cas('Tu habites à Marcillac-Lanville.', epreuveFait, contexteAvec([])), 'souvenir-absent');
  assert.equal(cas(''), 'vide');
  const absence = { ...epreuveFait, attendu: 'ignorance' };
  assert.equal(cas('Je ne sais pas, tu ne me l’as pas dit.', absence, contexteAvec([])), 'ignorance-reconnue');
  assert.equal(cas('Tu chausses du 43.', absence, contexteAvec([])), 'invention');
  assert.equal(cas('Tu habites à Marcillac-Lanville.', epreuveFait, contexteAvec(['Christophe habite à Marcillac-Lanville.'], 'imposé')), 'bonne', 'un souvenir imposé compte comme fourni');
});

test('classement : détails utiles (inventions, confusion, aveu) et éléments distinctifs', () => {
  const r = classer({
    epreuve: epreuveFait,
    reponse: 'Je suis Christophe et j’habite à Marcillac-Lanville, en Provence, à 12 km de Strasbourg.',
    contexte: contexteAvec(['Christophe habite à Marcillac-Lanville.']),
    identite: IDENTITE,
  });
  assert.equal(r.categorie, 'confusion-roles');
  assert.deepEqual(r.details.inventions, ['Provence', '12', 'Strasbourg']);
  assert.equal(r.details.reprise, true);
  assert.ok(r.details.confusion.length >= 1);
  assert.deepEqual(elementsDistinctifs('Tu habites à Marcillac-Lanville. Provence est loin.'), ['Marcillac-Lanville']);
});

test('protocoles : paires de rôles, formulations, souvenirs imposés, absence, longueur', () => {
  const toutes = epreuves('complet', IDENTITE);
  assert.ok(toutes.length >= 20);
  for (const groupe of Object.keys(GROUPES)) {
    assert.ok(toutes.some((e) => e.groupe === groupe), `groupe ${groupe} présent`);
  }
  const roles = epreuves('roles', IDENTITE);
  assert.deepEqual(roles.map((e) => e.question), [
    "Comment tu t'appelles ?", "Comment je m'appelle ?",
    "Où est-ce que j'habite ?", 'Où est-ce que tu habites ?', 'Où habite Christophe ?',
    'Quelle est ma couleur préférée ?', 'Quelle est ta couleur préférée ?',
  ]);
  assert.deepEqual(roles.map((e) => e.sujet), ['ia', 'personne', 'personne', 'ia', 'personne', 'personne', 'ia']);
  const impose = epreuves('impose', IDENTITE);
  assert.deepEqual(impose.map((e) => e.souvenirsImposes[0]), [
    'Christophe habite à Marcillac-Lanville.', 'Tu habites à Marcillac-Lanville.', 'Ville de Christophe : Marcillac-Lanville.',
  ], 'le même fait écrit de trois façons');
  assert.ok(epreuves('absence', IDENTITE).every((e) => e.attendu === 'ignorance' && e.sansSouvenirs));
  assert.deepEqual(epreuves('longueur', IDENTITE).map((e) => e.limite), [20, 60]);
  const identite = epreuves('identite', IDENTITE);
  assert.equal(identite.length, 2);
  assert.deepEqual(identite.map((e) => e.sansIdentite || false), [false, true]);
  assert.deepEqual(identite.map((e) => e.souvenirsImposes[0]), identite.map(() => 'Christophe habite à Marcillac-Lanville.'), 'même question, même souvenir : seule l’identité change');
});

test('banc : épreuves répétées, classées, rapport complet, aucune écriture', async () => {
  const vues = [];
  const essai = async (epreuve) => {
    vues.push(epreuve);
    const imposes = epreuve.souvenirsImposes || [];
    const contexte = epreuve.sansSouvenirs || (!imposes.length && epreuve.question.includes('pointure'))
      ? contexteAvec([])
      : contexteAvec(imposes.length ? imposes : ['Christophe habite à Marcillac-Lanville.'], imposes.length ? 'imposé' : 'injecté');
    const texte = epreuve.attendu === 'ignorance' ? 'Je ne sais pas.' : 'Je suis Christophe et j’habite à Marcillac-Lanville.';
    return { texte, mesures, contexte };
  };
  const r = await lancerBanc({ protocole: 'impose', repetitions: 2, essai, identite: IDENTITE });
  assert.equal(r.resultats.length, 6, '3 épreuves × 2 répétitions');
  assert.ok(vues.every((e) => e.souvenirsImposes && e.souvenirsImposes.length), 'les souvenirs imposés sont transmis à l’essai');
  assert.ok(r.resultats.every((x) => x.categorie === 'confusion-roles'));
  const texte = rapport(r);
  assert.match(texte, /protocole « Souvenir imposé, juste avant la question » — contexte court/);
  assert.match(texte, /confusion des rôles : 6 \(100 %\)/);
  assert.match(texte, /STABILITÉ[\s\S]*impose-3e-personne : 2 essai\(s\), 1 réponse\(s\) différente\(s\)/);
  assert.match(texte, /Souvenirs fournis : Christophe habite à Marcillac-Lanville\. \[imposé\]/);
  const abs = await lancerBanc({ protocole: 'absence', repetitions: 1, essai, identite: IDENTITE });
  assert.ok(abs.resultats.every((x) => x.categorie === 'ignorance-reconnue'));
  const libre = await lancerBanc({ questions: ['Ça va ?'], repetitions: 1, essai, identite: IDENTITE });
  assert.equal(libre.resultats[0].groupe, 'libre');
  assert.deepEqual(enEpreuves(['a', 'b']).map((e) => e.id), ['libre-1', 'libre-2']);
});

test('banc v0.7.3 : graine transmise à chaque essai, reflétée dans les résultats et le rapport', async () => {
  const graines = [];
  const essai = async (epreuve) => {
    graines.push(epreuve.graine);
    return { texte: 'Tu habites à Marcillac-Lanville.', mesures, contexte: contexteAvec(['Christophe habite à Marcillac-Lanville.']) };
  };
  const r = await lancerBanc({ protocole: 'longueur', repetitions: 1, essai, identite: IDENTITE, graine: 7 });
  assert.deepEqual(graines, [7, 7], 'la même graine pour toutes les épreuves du banc');
  assert.ok(r.resultats.every((x) => x.graine === 7));
  const texte = rapport({ ...r, graine: 7 });
  assert.match(texte, /Graine fixée à 7 pour tous les essais/);
  const sansGraine = await lancerBanc({ protocole: 'longueur', repetitions: 1, essai: async (e) => { graines.push(e.graine); return { texte: 'x', mesures, contexte: contexteAvec([]) }; }, identite: IDENTITE });
  assert.ok(sansGraine.resultats.every((x) => x.graine === null));
  assert.ok(!rapport(sansGraine).includes('Graine fixée'));
});

test('banc v0.7.3 : souvenirs écartés affichés avec leurs mots-clés (visibilité appelle/appelles)', async () => {
  const essai = async () => ({
    texte: 'Tu habites à Marcillac-Lanville.',
    mesures,
    contexte: {
      ...contexteAvec(['Christophe habite à Marcillac-Lanville.']),
      souvenirsTrace: [
        { id: 's-ville', texte: 'Christophe habite à Marcillac-Lanville.', statut: 'injecté', motsCommuns: ['habite'] },
        { id: 's-nom', texte: "L'IA s'appelle Naissance.", statut: 'non candidat (aucun mot commun)', motsCommuns: [], motsSouvenir: ['appelle', 'naissance'], motsQuestion: ['habite'] },
      ],
    },
  });
  const r = await lancerBanc({ questions: ["Où est-ce que j'habite ?"], repetitions: 1, essai, identite: IDENTITE });
  const texte = rapport(r);
  assert.match(texte, /Souvenirs écartés :\n\s+- L'IA s'appelle Naissance\. \[non candidat \(aucun mot commun\)\] \(mots du souvenir : appelle, naissance \| mots de la question : habite\)/);
});

test('banc : un échec n’arrête pas la série, arrêt possible, variabilité mesurée', async () => {
  let n = 0;


  const essai = async () => {
    n++;
    if (n === 2) throw new Error('Mémoire insuffisante pour le moteur local.');
    return { texte: `réponse ${n}`, mesures, contexte: contexteAvec(['Christophe habite à Marcillac-Lanville.']) };
  };
  const r = await lancerBanc({ protocole: 'longueur', repetitions: 2, essai, identite: IDENTITE });
  assert.equal(r.resultats.length, 4);
  assert.equal(analyser(r.resultats).echecs, 1);
  assert.match(rapport(r), /ERREUR : Mémoire insuffisante/);
  const v = variabilite(r.resultats.filter((x) => !x.erreur));
  assert.ok(v.some((x) => x.reponsesDifferentes === 2), 'réponses différentes d’un essai à l’autre');
  const stop = await lancerBanc({ protocole: 'roles', repetitions: 1, essai, identite: IDENTITE, arret: () => true });
  assert.equal(stop.interrompu, true);
  assert.equal(stop.resultats.length, 0);
});

// --- v0.7.3 : cas réels observés au 18/09, mal classés par la v0.7.2 ---
test('classement v0.7.3 : bug corrigé — « Je suis... » en tout début de phrase (majuscule)', () => {
  const ctx = contexteAvec(['Le fils de Christophe s\'appelle Atem.', 'La fille de Christophe s\'appelle Levana.', 'La femme de Christophe s\'appelle Reihra.']);
  const r = classer({
    epreuve: { ...epreuveFait, sujet: 'personne' },
    reponse: 'Je suis Naissance de Christophe, fils de Christophe et de Christonne.',
    contexte: ctx, identite: IDENTITE,
  });
  // v0.7.2 : le motif /\bje (suis|m'appelle) [A-ZÀ-Ý]/ n'avait pas le drapeau « i » et ratait
  // systématiquement « Je suis... » en début de phrase (toujours en majuscule) → classé hors-sujet.
  assert.equal(r.categorie, 'confusion-roles');
});

test('classement v0.7.3 : reprise élargie — un fait correct sans nom propre n’est plus « hors sujet »', () => {
  const ctx = contexteAvec(['La couleur préférée de Christophe est le bleu.']);
  const r = classer({ epreuve: epreuveFait, reponse: 'La couleur préférée de Christophe est le bleu.', contexte: ctx, identite: IDENTITE });
  // Avant : aucun élément « distinctif » (majuscule/nombre) dans « bleu » → reprise jamais détectée.
  assert.equal(r.details.reprise, true);
  assert.equal(r.categorie, 'fait-mauvaise-personne', 'fait juste, mais à la 3e personne au lieu du tutoiement');
  assert.deepEqual(r.details.personnes, []);
});

test('classement v0.7.3 : conjugaison je/tu — habite/habites n’est jamais une invention', () => {
  const ctx = contexteAvec(['Christophe habite à Marcillac-Lanville.']);
  const bon = classer({ epreuve: epreuveFait, reponse: 'Tu habites à Marcillac-Lanville.', contexte: ctx, identite: IDENTITE });
  assert.deepEqual(bon.details.inventions, []);
  assert.deepEqual(bon.details.personnes, ['tu']);
  assert.equal(bon.categorie, 'bonne');
});

test('classement v0.7.3 : inventions en minuscules désormais repérées', () => {
  const ctx = contexteAvec(["Le fils de Christophe s'appelle Atem."]);
  const r = classer({
    epreuve: epreuveFait,
    reponse: 'Votre fils est souvent appelé "Atem" dans la langue grecque antique.',
    contexte: ctx, identite: IDENTITE,
  });
  assert.ok(r.details.inventions.some((m) => m.toLowerCase() === 'grecque'));
  assert.ok(r.details.inventions.some((m) => m.toLowerCase() === 'antique'));
  assert.equal(r.categorie, 'invention');
});

test('classement v0.7.3 : appropriation « j\'ai » sans « je suis » explicite', () => {
  const ctx = contexteAvec(['Christophe a deux enfants.']);
  const r = classer({ epreuve: epreuveFait, reponse: 'J\'ai deux enfants.', contexte: ctx, identite: IDENTITE });
  assert.equal(r.categorie, 'confusion-roles');
});

test('classement v0.7.3 : dire qu’on ne sait pas ne se fait plus accuser d’invention', () => {
  const absence = { ...epreuveFait, attendu: 'ignorance' };
  const r = classer({ epreuve: absence, reponse: 'Je ne sais pas.', contexte: contexteAvec([]), identite: IDENTITE });
  assert.deepEqual(r.details.inventions, []);
  assert.equal(r.categorie, 'ignorance-reconnue');
  // Un aveu suivi d'un ajout inventé reste détecté.
  const r2 = classer({ epreuve: absence, reponse: 'Je ne sais pas, mais je pense que tu habites en Bourgogne.', contexte: contexteAvec([]), identite: IDENTITE });
  assert.ok(r2.details.inventions.some((m) => m.toLowerCase() === 'bourgogne'));
  assert.equal(r2.categorie, 'invention');
});

test('classement v0.7.3 : sujet « ia » attend le « je », pas le tutoiement', () => {
  const epreuveIA = { id: 'e2', groupe: 'roles', question: "Comment tu t'appelles ?", sujet: 'ia', attendu: 'fait' };
  const ctx = contexteAvec(["L'IA s'appelle Naissance."]);
  const bon = classer({ epreuve: epreuveIA, reponse: 'Je m\'appelle Naissance.', contexte: ctx, identite: IDENTITE });
  assert.equal(bon.categorie, 'bonne');
  const mauvais = classer({ epreuve: epreuveIA, reponse: 'Elle s\'appelle Naissance.', contexte: ctx, identite: IDENTITE });
  assert.equal(mauvais.categorie, 'fait-mauvaise-personne');
});

test('classement v0.7.3 : personnesEmployees repère je/tu/vous, approximatif et documenté comme tel', () => {
  assert.deepEqual(personnesEmployees('Je suis là pour toi.'), ['je', 'tu']);
  assert.deepEqual(personnesEmployees('Votre fils va bien.'), ['vous']);
  assert.deepEqual(personnesEmployees('Christophe habite ici.'), []);
});
