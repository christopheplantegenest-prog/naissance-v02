import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  composerContexteLocal, identiteCompacte, identiteMinimale, premierePhrase,
  souvenirsPourQuestion, BUDGETS_COURTS, BUDGETS_LOCAL, VARIANTE_PAR_DEFAUT,
} from '../app/esprit/contexte-local.js';
import { creerIdentite } from '../app/esprit/identite.js';
import { estimerJetons } from '../app/moteur-local/profil.js';

const identite = creerIdentite({ personne: 'Christophe', date: 'x' });
const jour = new Date('2026-09-18T10:00:00Z');
const souvenir = (id, texte, importance = 2) => ({ id, texte, importance, statut: 'actif', cree: id, confiance: 'probable', source: 'dit' });
const SOUVENIRS = [
  souvenir('s-ville', 'Christophe habite à Marcillac-Lanville, en Charente.', 3),
  souvenir('s-bleu', 'La couleur préférée de Christophe est le bleu.', 2),
  souvenir('s-enfants', 'Christophe a deux enfants.', 3),
];
const composer = (message, options = {}) => composerContexteLocal({
  identite, souvenirs: SOUVENIRS, recents: [], message, moteur: 'M', maintenant: jour, ...options,
});

test('identité minimale : courte, tutoiement direct, interdiction d’inventer', () => {
  const t = identiteMinimale({ identite });
  assert.match(t, /^Tu es Naissance, l'IA personnelle de Christophe\./);
  assert.match(t, /Tu parles directement à Christophe et tu le tutoies\./);
  assert.match(t, /Réponds en deux phrases au maximum\./);
  assert.match(t, /N'invente rien/);
  assert.match(t, /Si tu ne sais pas, dis-le simplement/);
  assert.ok(estimerJetons(t) <= 120, `identité minimale : ${estimerJetons(t)} jetons`);
  assert.ok(estimerJetons(t) * 2 < estimerJetons(identiteCompacte({ identite, moteur: 'M' })), 'nettement plus courte que la v0.7.0');
  assert.equal(premierePhrase('Sois honnête : blabla. Suite.'), 'Sois honnête');
});

test('contexte court : souvenirs simples, juste avant la question', () => {
  const c = composer("Où j'habite ?");
  assert.equal(c.variante, VARIANTE_PAR_DEFAUT);
  assert.ok(c.estimation.suite <= 90, `suite relue à chaque message : ${c.estimation.suite} jetons`);
  assert.equal(c.prefixe, `${identiteMinimale({ identite })}\nNous sommes le vendredi 18 septembre 2026.`, 'préfixe = identité + jour, stable sur la journée donc mis en cache');
  const roles = c.elements.map((e) => e.role);
  assert.deepEqual(roles, ['systeme', 'moi'], 'souvenirs, puis la question : rien d’autre relu à chaque message');
  assert.match(c.elements[0].texte, /^Informations vraies sur Christophe, à utiliser telles quelles, sans rien ajouter :\n- Christophe habite à Marcillac-Lanville, en Charente\./);
  assert.equal(c.elements.at(-1).texte, "Où j'habite ?");
  assert.deepEqual(c.souvenirsUtilises, ['s-ville']);
  assert.deepEqual(c.souvenirsTrace, [{
    id: 's-ville', texte: 'Christophe habite à Marcillac-Lanville, en Charente.', importance: 3,
    confiance: 'probable', motsCommuns: ['habite'], statut: 'injecté',
  }], 'la trace dit quel souvenir a été retenu et pourquoi');
  assert.ok(c.estimation.total <= 220, `contexte court : ${c.estimation.total} jetons`);
  assert.ok(c.estimation.souvenirs > 0 && c.estimation.historique === 0);
});

test('aucun souvenir utile : le moteur reçoit la consigne de le dire', () => {
  const c = composer('Quel temps fera-t-il demain ?');
  assert.match(c.elements[0].texte, /Tu n'as aucun souvenir utile pour cette question : dis-le à Christophe plutôt que d'inventer\./);
  assert.deepEqual(c.souvenirsUtilises, []);
  assert.deepEqual(c.souvenirsTrace, []);
});

test('contexte court bien plus léger que le contexte complet', () => {
  const court = composer("Où j'habite ?");
  const complet = composer("Où j'habite ?", { variante: 'complet' });
  assert.ok(court.estimation.total * 1.5 < complet.estimation.total, `court ${court.estimation.total} vs complet ${complet.estimation.total} jetons`);
  assert.match(complet.prefixe, /petit moteur local \(M\)/, 'la variante complète reste celle de la v0.7.0');
  assert.match(complet.prefixe, /- Christophe habite à Marcillac-Lanville/, 'souvenirs importants dans le préfixe');
  assert.ok(complet.souvenirsTrace.some((s) => s.statut === 'injecté (préfixe)'));
  assert.ok(BUDGETS_COURTS.suite < BUDGETS_LOCAL.suite && BUDGETS_COURTS.prefixe < BUDGETS_LOCAL.prefixe);
});

test('sélection : au plus trois souvenirs, les plus proches de la question, les autres tracés', () => {
  const beaucoup = Array.from({ length: 12 }, (_, i) => souvenir(`s${i}`, `Christophe aime le jardin, note ${i}.`, 2));
  const c = composerContexteLocal({ identite, souvenirs: beaucoup, recents: [], message: 'Parle-moi du jardin et des tomates', moteur: 'M', maintenant: jour });
  assert.equal(c.souvenirsUtilises.length, 3, 'au plus trois souvenirs');
  assert.equal(c.souvenirsTrace.filter((s) => s.statut === 'écarté (budget)').length, 9, 'les écartés restent visibles dans la trace');
  const longs = composerContexteLocal({ identite, souvenirs: Array.from({ length: 5 }, (_, i) => souvenir(`l${i}`, `Christophe aime le jardin ${'et les tomates '.repeat(8)} ${i}`, 2)), recents: [], message: 'Parle-moi du jardin', moteur: 'M', maintenant: jour });
  assert.ok(longs.souvenirsUtilises.length <= 2, 'des souvenirs longs : le budget limite encore plus');
  assert.ok(c.estimation.total <= BUDGETS_COURTS.prefixe + BUDGETS_COURTS.suite);
  const ordre = souvenirsPourQuestion(SOUVENIRS, 'Quelle est la couleur préférée de Christophe ?');
  assert.equal(ordre[0].souvenir.id, 's-bleu');
});

test('dernier échange raccourci, message trop long signalé', () => {
  const recents = [{ id: 1, role: 'moi', texte: 'Je vais au marché' }, { id: 2, role: 'ia', texte: 'Bonne idée !' }];
  const c = composer('Et après ?', { recents });
  assert.deepEqual(c.elements.map((e) => e.texte).slice(0, 2), ['Je vais au marché', 'Bonne idée !']);
  assert.equal(c.elements.at(-1).texte, 'Et après ?');
  const long = composer('mot '.repeat(200), { recents });
  assert.equal(long.tropLong, true);
});
