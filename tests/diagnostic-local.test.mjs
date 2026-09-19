import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireTrace, noterTrace, lireTraces, effacerTraces, traceEnTexte, rapportTraces } from '../app/moteur-local/diagnostic.js';
import { lancerBanc, analyser, rapport, enEpreuves } from '../app/moteur-local/banc.js';
import { epreuves, GROUPES } from '../app/moteur-local/protocoles.js';
import { classer, elementsDistinctifs, variabilite } from '../app/moteur-local/classement.js';
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
    "Où est-ce que j'habite ?", 'Où est-ce que tu habites ?',
    'Quelle est ma couleur préférée ?', 'Quelle est ta couleur préférée ?',
  ]);
  assert.deepEqual(roles.map((e) => e.sujet), ['ia', 'personne', 'personne', 'ia', 'personne', 'ia']);
  const impose = epreuves('impose', IDENTITE);
  assert.deepEqual(impose.map((e) => e.souvenirsImposes[0]), [
    'Christophe habite à Marcillac-Lanville.', 'Tu habites à Marcillac-Lanville.', 'Ville de Christophe : Marcillac-Lanville.',
  ], 'le même fait écrit de trois façons');
  assert.ok(epreuves('absence', IDENTITE).every((e) => e.attendu === 'ignorance' && e.sansSouvenirs));
  assert.deepEqual(epreuves('longueur', IDENTITE).map((e) => e.limite), [20, 60]);
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
