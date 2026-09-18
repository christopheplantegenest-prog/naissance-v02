import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireTrace, noterTrace, lireTraces, effacerTraces, traceEnTexte, rapportTraces } from '../app/moteur-local/diagnostic.js';
import { lancerBanc, analyser, rapport, QUESTIONS_PAR_DEFAUT } from '../app/moteur-local/banc.js';
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

test('banc : questions répétées, aucune écriture, rapport chiffré', async () => {
  const demandes = [];
  const essai = async (question) => {
    demandes.push(question);
    return {
      texte: question.includes('habite') ? 'Tu habites à Marcillac-Lanville.' : 'Je ne sais pas.',
      mesures,
      contexte: { ...contexte, souvenirsTrace: question.includes('habite') ? contexte.souvenirsTrace : [] },
    };
  };
  const avancement = [];
  const r = await lancerBanc({ questions: ['Où j’habite ?', 'Ma couleur ?'], repetitions: 2, essai, surAvancement: (a) => avancement.push(a) });
  assert.equal(r.resultats.length, 4);
  assert.deepEqual(demandes, ['Où j’habite ?', 'Ma couleur ?', 'Où j’habite ?', 'Ma couleur ?']);
  assert.deepEqual(avancement.at(-1), { numero: 4, total: 4, question: 'Ma couleur ?', tour: 2 });
  const a = analyser(r.resultats);
  assert.equal(a.avecSouvenir, 2);
  assert.equal(a.sansSouvenir, 2);
  assert.equal(a.echecs, 0);
  assert.equal(Math.round(a.premierMotMoyenS * 10) / 10, 6.4);
  const texte = rapport(r);
  assert.match(texte, /4 essai\(s\), 0 échec\(s\)/);
  assert.match(texte, /Souvenirs fournis : Christophe habite à Marcillac-Lanville\./);
  assert.match(texte, /Souvenirs écartés : Sa couleur préférée est le bleu\./);
  assert.equal(QUESTIONS_PAR_DEFAUT.length, 5);
});

test('banc : un échec n’arrête pas la série, l’arrêt demandé si', async () => {
  let n = 0;
  const essai = async () => {
    n++;
    if (n === 2) throw new Error('Mémoire insuffisante pour le moteur local.');
    return { texte: 'ok', mesures, contexte };
  };
  const r = await lancerBanc({ questions: ['a', 'b'], repetitions: 2, essai });
  assert.equal(r.resultats.length, 4);
  assert.equal(analyser(r.resultats).echecs, 1);
  assert.match(rapport(r), /ERREUR : Mémoire insuffisante/);
  const stop = await lancerBanc({ questions: ['a', 'b'], repetitions: 2, essai: async () => ({ texte: 'ok', mesures, contexte }), arret: () => true });
  assert.equal(stop.interrompu, true);
  assert.equal(stop.resultats.length, 0);
});
