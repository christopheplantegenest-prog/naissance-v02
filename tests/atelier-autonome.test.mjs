// v0.66.0 — ATELIER AUTONOME : noyau pur (L1 budget mensuel, L4 plan, L5 état du chantier, L6 gardes statiques, L8 commandes) et
// boucle agentique (L2) / bac à sable (L3) sans aucun appel payant : faux client, faux serveur local, aucune clé réelle, aucun docker.
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance (D-007).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { etatBudget } from '../app/atelier/budget.js';
import * as N from '../outils-atelier/auto-autonome-noyau.mjs';
import { boucle, clientAnthropic, outilsEtape, argumentsDocker, resumeTap, VERSION_API, PROFILS } from '../outils-atelier/auto-agent.mjs';
import { fabriquerZip, colis } from '../outils-atelier/auto-autonome.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const USD = 1_000_000;
const BASE = { sha: 'a'.repeat(40), version: '0.65.26' };
const DEMANDE = { titre: 'Atelier : bonjour', texte: 'Ajouter une salutation.', base: BASE };
const MISSION = (id, autres = {}) => ({ id, titre: `Mission ${id}`, comportement: 'Un comportement observable.', criteres: ['Critère.'], tests: ['Test.'], autorises: [`app/${id}.js`, `tests/${id}.test.mjs`], cognitive: false, ...autres });

// ------------------------------------------------------------------------------------------------ L1 budget mensuel
test('L1 : le premier tour ouvre le registre (cycle = mois UTC, 100 USD, aucune répartition), réserve la borne de l\'étape', () => {
  const r = N.reserverTour([], { quand: '2026-10-24T20:00:00Z', execution: 'ticket-1-1', issue: 1, etape: 'developper' });
  assert.equal(r.maximum, 8 * USD);
  const e = etatBudget(r.journal);
  assert.equal(e.cycle, '2026-10');
  assert.equal(e.plafond, 100 * USD);
  assert.equal(e.plafondRun, 10 * USD);
  assert.equal(e.engageCycle, 8 * USD);
  assert.equal(e.chantiers['ticket-1'].plafond, 300 * USD);
  assert.deepEqual(r.journal.map((x) => x.type), ['cycle-ouvert', 'chantier-plafonne', 'engagement']);
  // Coût réel inscrit, idempotent ; un coût déjà inscrit rend le journal reçu.
  const c = N.inscrireCout(r.journal, { quand: '2026-10-24T20:30:00Z', execution: 'ticket-1-1', montant: 1_234_567 });
  assert.equal(etatBudget(c.journal).consommeCycle, 1_234_567);
  assert.equal(N.inscrireCout(c.journal, { quand: 'x', execution: 'ticket-1-1', montant: 9 }).journal, c.journal);
  assert.equal(N.inscrireCout(c.journal, { quand: 'x', execution: 'inconnue', montant: 9 }).refus, 'execution-inconnue');
});
test('L1 : plafond mensuel = arrêt automatique ; la réserve se réduit au reste ; le mois suivant rouvre un cycle ; un engagement ouvert le retarde', () => {
  let j = [];
  let k = 0;
  const tour = (quand, etape, montant) => {
    k += 1;
    const r = N.reserverTour(j, { quand, execution: `t-${k}`, issue: 2, etape });
    if (r.refus) return r;
    j = r.journal;
    if (montant !== undefined) j = N.inscrireCout(j, { quand, execution: `t-${k}`, montant: Math.min(montant, r.maximum) }).journal;
    return r;
  };
  for (let i = 0; i < 12; i += 1) assert.equal(tour('2026-10-25T00:00:00Z', 'developper', 8 * USD).maximum, 8 * USD);
  assert.equal(etatBudget(j).consommeCycle, 96 * USD);
  assert.equal(tour('2026-10-25T00:00:00Z', 'developper', 4 * USD).maximum, 4 * USD); // réserve réduite au reste
  const refus = tour('2026-10-26T00:00:00Z', 'avis');
  assert.equal(refus.refus, 'budget');
  // Mois suivant : nouveau cycle, la consommation repart de zéro.
  const ouvert = tour('2026-11-01T00:00:00Z', 'planifier');
  assert.equal(ouvert.maximum, 3 * USD);
  assert.equal(etatBudget(j).cycle, '2026-11');
  assert.equal(etatBudget(j).consommeCycle, 0);
  // Engagement de novembre encore ouvert : décembre attend (aucun nouveau cycle tant que le coût n'est pas inscrit).
  assert.equal(tour('2026-12-01T00:00:00Z', 'avis').refus, 'engagement-ouvert');
});
test('L1 : coût réel (usage) et borne avant appel, en microdollars arrondis au-dessus', () => {
  assert.equal(N.coutUsage({ input_tokens: 1000, cache_creation_input_tokens: 2000, cache_read_input_tokens: 10000, output_tokens: 500 }), 26000);
  assert.equal(N.coutUsage({ input_tokens: 1, output_tokens: 0 }), 4);
  assert.equal(N.coutUsage({ cache_read_input_tokens: 1 }), 1);
  assert.equal(N.coutUsage(null), null);
  assert.equal(N.coutUsage({ input_tokens: -1 }), null);
  assert.equal(N.coutMaxAppel({ jetonsEntree: 10000, maxTokens: 16000 }), 50000 + 320000);
  assert.throws(() => N.coutMaxAppel({ jetonsEntree: 1.5, maxTokens: 1 }));
});

// ------------------------------------------------------------------------------------------------ L6 chemins et gardes
test('L6 : l\'agent n\'écrit que dans le périmètre de la mission, jamais l\'atelier, .github, les zones permanentes ni un package.json', () => {
  const A = ['app/langage/', 'tests/salut.test.mjs', 'app/salut.js'];
  for (const p of ['app/langage/x.js', 'tests/salut.test.mjs', 'app/salut.js']) assert.equal(N.raisonCheminEcriture(p, A), null, p);
  for (const p of ['app/atelier/ecran.js', 'outils-atelier/auto-x.mjs', 'tests/atelier-x.test.mjs', 'TESTS/ATELIER-x.test.mjs', '.github/workflows/robot.yml', 'VERSION', 'ETAT.md', 'app/version.js', 'sw.js', 'app/sw.js',
    'colis.zip', 'package.json', 'app/langage/package.json', 'app/langage/.cache.js', 'app/langage/../atelier/x.js', 'signature/x', 'android/x', 'node_modules/x', 'app/langage/x y.js', '/etc/passwd', 'app/langage/x.']) {
    assert.notEqual(N.raisonCheminEcriture(p, [...A, 'app/', 'tests/', '']), null, p);
  }
  assert.notEqual(N.raisonCheminEcriture('app/autre.js', A), null);
  assert.equal(N.raisonCheminLecture('app/main.js'), null);
  for (const p of ['.git/config', '../x', '/x', 'a//b', 'a\\b']) assert.notEqual(N.raisonCheminLecture(p), null, p);
});
test('L6 : gardes statiques — réseau ou LLM ajouté dans app/, import de l\'atelier, suppression ; BASE/SCHEMA/TABLES = migration ; modules cognitifs', () => {
  const f = (chemin, avant, apres, etat = 'modifie') => ({ chemin, etat, avant, apres });
  assert.deepEqual(N.gardesStatiques([f('app/salut.js', null, 'export const salut = () => "bonjour";\n', 'cree')]), { objections: [], cognitive: false, migration: null });
  const r = N.gardesStatiques([
    f('app/langage/a.js', 'const x = 1;\n', 'const x = 1;\nfetch("https://exemple");\n'),
    f('app/esprit/b.js', '', 'import { y } from "../atelier/auto.js";\n'),
    f('app/memoire/c.js', '', 'const k = "x-api-key";\n'),
    f('app/vieux.js', 'x', null, 'supprime'),
  ]);
  assert.equal(r.cognitive, true);
  assert.equal(r.objections.length, 4);
  assert.match(r.objections.join('\n'), /réseau/);
  assert.match(r.objections.join('\n'), /D-001/);
  assert.match(r.objections.join('\n'), /import de l'atelier/);
  assert.match(r.objections.join('\n'), /supprimé/);
  const m = N.gardesStatiques([f('app/langage/connaissances.js', 'export const VERSION_BASE = 29; // note\n', 'export const VERSION_BASE = 30; // note\n')]);
  assert.match(m.migration, /VERSION_BASE/);
  assert.equal(N.gardesStatiques([f('app/langage/connaissances.js', 'export const VERSION_BASE = 29; // a\n', 'export const VERSION_BASE = 29; // b\n')]).migration, null);
  // Une ligne existante déplacée n'est pas un ajout.
  assert.deepEqual(N.gardesStatiques([f('app/x.js', 'fetch(a);\nb;\n', 'b;\nfetch(a);\n')]).objections, []);
});

// ------------------------------------------------------------------------------------------------ L4 plan
test('L4 : plan relu et accepté par mission.js pour chaque mission (périmètre cumulé) ; refus précis sinon', () => {
  const ok = N.lirePlan({ description: 'Salutation', missions: [MISSION('salut'), MISSION('suite')] }, { issue: 3, demande: DEMANDE });
  assert.equal(ok.plan.missions.length, 2);
  const d = N.donneesMission({ issue: 3, demande: DEMANDE, plan: ok.plan, index: 1, tentative: 2 });
  assert.deepEqual(d.autorises, ['app/salut.js', 'tests/salut.test.mjs', 'app/suite.js', 'tests/suite.test.mjs']);
  assert.equal(d.chantier, 'ticket-3');
  assert.deepEqual(d.interdits, ['app/atelier/', 'outils-atelier/', 'package-lock.json', 'package.json']);
  for (const [p, re] of [
    [{ description: 'x', missions: [MISSION('a', { autorises: ['app/atelier/ecran.js'] })] }, /protégé|refusé/],
    [{ description: 'x', missions: [MISSION('a', { autorises: ['app/'] })] }, /couvre un chemin protégé/],
    [{ description: 'x', missions: [MISSION('a', { autorises: ['tests/'] })] }, /couvre un chemin protégé/],
    [{ description: 'x', missions: Array.from({ length: 7 }, (_, i) => MISSION(`m${i}`)) }, /1 à 6/],
    [{ description: 'x', missions: [MISSION('a'), MISSION('a')] }, /unique/],
    [{ description: 'x', missions: [MISSION('a', { titre: 'deux\nlignes' })] }, /mission\.js/],
    [{ description: 'x', missions: [MISSION('a', { cognitive: 'oui' })] }, /booléen/],
    [{ description: 'x', missions: [{ ...MISSION('a'), extra: 1 }] }, /clés/],
    [{ missions: [] }, /clés/],
  ]) assert.match(N.lirePlan(p, { issue: 3, demande: DEMANDE }).raison, re);
  assert.equal(N.versionSuivante('0.65.26'), '0.65.27');
  assert.equal(N.texteCanonique('  a\t b \r\n\r\n\r\n\r\n== X\nc  '), 'a  b\n\nc');
  assert.equal(N.texteCanonique(''), '(demande vide)');
});

// ------------------------------------------------------------------------------------------------ L5 état du chantier
const Q = '2026-10-24T20:00:00Z';
function chantier(evs) {
  let j = [];
  for (const [type, donnees] of evs) {
    const r = N.appliquerChantier(j, { type, quand: Q, donnees });
    assert.ok(Array.isArray(r), `${type} : ${r.raison}`);
    j = r;
  }
  return j;
}
const plan2 = { description: 'Salutation', missions: [MISSION('salut'), MISSION('suite')] };
const C = (m, t, c) => ['candidat', { mission: m, tentative: t, branche: `atelier/ticket-5/${m}/${t}`, commit: c.repeat(40), fichiers: [{ chemin: `app/${m}.js`, etat: 'cree' }] }];
const V = (m, t, verdict = 'verification-technique-conforme', extra = {}) => ['verification', { mission: m, tentative: t, verdict, raisons: verdict.endsWith('-conforme') && !verdict.includes('non') ? [] : ['tests réels en échec'], cognitive: false, migration: null, ...extra }];
const AV = (m, t, conforme = true) => ['avis', { mission: m, tentative: t, conforme, objections: conforme ? [] : ['D-003 : score caché'] }];
const TOUR = (n, etape, extra = {}) => [['tour', { execution: `ticket-5-${n}`, etape, maximum: 1000, run: '1', ...extra }], ['tour-clos', { execution: `ticket-5-${n}`, montant: 10, issue: 'ok' }]];
const DEM = ['demande', { issue: 5, titre: 'Atelier : bonjour', texte: 'x', base: BASE }];

test('L5 : chemin nominal — planifier, développer, vérifier, second avis, mission suivante (départ = candidat validé), livrer, attendre, terminer', () => {
  const pas = [];
  const evs = [DEM];
  const p = () => N.prochaineEtape(N.etatChantier(chantier(evs)));
  pas.push(p().etape);
  evs.push(...TOUR(1, 'planifier'), ['plan', { plan: plan2, version: '0.65.27' }]);
  assert.deepEqual(p(), { etape: 'developper', mission: 'salut', index: 0, tentative: 1, depart: BASE.sha, retour: [] });
  evs.push(...TOUR(2, 'developper', { mission: 'salut', tentative: 1 }), C('salut', 1, 'b'));
  assert.equal(p().etape, 'verifier');
  evs.push(V('salut', 1));
  assert.equal(p().etape, 'avis');
  evs.push(...TOUR(3, 'avis', { mission: 'salut', tentative: 1 }), AV('salut', 1));
  assert.deepEqual(p(), { etape: 'developper', mission: 'suite', index: 1, tentative: 1, depart: 'b'.repeat(40), retour: [] });
  evs.push(C('suite', 1, 'c'), V('suite', 1), AV('suite', 1));
  assert.deepEqual(p(), { etape: 'livrer', candidat: 'c'.repeat(40) });
  assert.equal(N.candidatFinal(N.etatChantier(chantier(evs))), 'c'.repeat(40));
  evs.push(['livraison', { version: '0.65.27', depot: 'd'.repeat(40), branche: 'livraison/ticket-5-1', colis_sha256: 'e'.repeat(64) }]);
  assert.equal(p().raison, 'attente-livraison');
  evs.push(['livre', { conclusion: 'livre' }]);
  assert.equal(p().etape, 'terminer');
  evs.push(['termine', {}]);
  assert.equal(p().raison, 'termine');
  const e = N.etatChantier(chantier(evs));
  assert.equal(e.depense, 30);
  assert.match(N.texteEtat(e, null), /Livré : v0\.65\.27/);
  assert.equal(pas[0], 'planifier');
});
test('L5 : corrections bornées — retour transmis, 3 tentatives puis blocage ; /reprendre rouvre 3 tentatives ; avis non conforme = correction', () => {
  const evs = [DEM, ['plan', { plan: plan2, version: '0.65.27' }], C('salut', 1, 'b'), V('salut', 1, 'verification-technique-non-conforme')];
  const p = () => N.prochaineEtape(N.etatChantier(chantier(evs)));
  assert.deepEqual(p(), { etape: 'developper', mission: 'salut', index: 0, tentative: 2, depart: 'b'.repeat(40), retour: ['tests réels en échec'] });
  evs.push(C('salut', 2, 'c'), V('salut', 2), AV('salut', 2, false));
  assert.deepEqual(p().retour, ['D-003 : score caché']);
  evs.push(['sans-candidat', { mission: 'salut', tentative: 3, raison: 'budget' }]);
  const b = p();
  assert.equal(b.etape, 'bloquer');
  assert.equal(b.raison, 'tentatives-epuisees');
  evs.push(['bloque', { raison: b.raison, question: b.question }]);
  assert.equal(p().raison, 'bloque');
  evs.push(['reprise', { par: N.PROPRIETAIRE_ID, reponse: 'Utilise une constante.' }]);
  assert.equal(p().etape, 'developper');
  assert.equal(p().tentative, 4);
  assert.deepEqual(N.etatChantier(chantier(evs)).reponses, ['Utilise une constante.']);
  // Une tentative au-delà de la borne est refusée par le journal lui-même.
  assert.equal(N.appliquerChantier(chantier([DEM, ['plan', { plan: plan2, version: '0.65.27' }]]), { type: 'candidat', quand: Q, donnees: C('salut', 4, 'f')[1] }).refuse, true);
});
test('L5 : vérification impossible relancée une fois ; migration = blocage puis, après /reprendre, correction (D-007) ; avis en échec deux fois = blocage', () => {
  const evs = [DEM, ['plan', { plan: plan2, version: '0.65.27' }], C('salut', 1, 'b'), V('salut', 1, 'verification-impossible')];
  const p = () => N.prochaineEtape(N.etatChantier(chantier(evs)));
  assert.equal(p().etape, 'verifier');
  evs.push(V('salut', 1, 'verification-impossible'));
  assert.equal(p().etape, 'developper');
  evs.push(C('salut', 2, 'c'), V('salut', 2, 'verification-technique-conforme', { migration: 'VERSION_BASE dans app/langage/connaissances.js' }));
  assert.equal(p().raison, 'migration');
  evs.push(['bloque', { raison: 'migration', question: 'q' }], ['reprise', { par: N.PROPRIETAIRE_ID }]);
  assert.equal(p().etape, 'developper');
  assert.match(p().retour.join(), /D-007/);
  const e2 = [DEM, ['plan', { plan: plan2, version: '0.65.27' }], C('salut', 1, 'b'), V('salut', 1)];
  for (let n = 1; n <= 2; n += 1) e2.push(['tour', { execution: `x-${n}`, etape: 'avis', mission: 'salut', tentative: 1, maximum: 9, run: '1' }], ['tour-clos', { execution: `x-${n}`, montant: 9, issue: 'inconnu' }]);
  assert.equal(N.prochaineEtape(N.etatChantier(chantier(e2))).raison, 'avis-impossible');
});
test('L5 : mission cognitive (plan ou gardes) = attente de /valider avant tout colis ; /stop arrête, /reprendre reprend ; un tour ouvert bloque tout autre tour', () => {
  const planC = { description: 'x', missions: [MISSION('salut', { cognitive: true })] };
  const evs = [DEM, ['plan', { plan: planC, version: '0.65.27' }], C('salut', 1, 'b'), V('salut', 1), AV('salut', 1)];
  const p = () => N.prochaineEtape(N.etatChantier(chantier(evs)));
  assert.equal(p().raison, 'attente-validation');
  evs.push(['validation', { par: N.PROPRIETAIRE_ID }]);
  assert.equal(p().etape, 'livrer');
  const g = [DEM, ['plan', { plan: plan2, version: '0.65.27' }], C('salut', 1, 'b'), V('salut', 1, 'verification-technique-conforme', { cognitive: true }), AV('salut', 1), C('suite', 1, 'c'), V('suite', 1), AV('suite', 1)];
  assert.equal(N.prochaineEtape(N.etatChantier(chantier(g))).raison, 'attente-validation');
  const s = [DEM, ['arret', { par: N.PROPRIETAIRE_ID }]];
  assert.equal(N.prochaineEtape(N.etatChantier(chantier(s))).raison, 'arret');
  s.push(['reprise', { par: N.PROPRIETAIRE_ID }]);
  assert.equal(N.prochaineEtape(N.etatChantier(chantier(s))).etape, 'planifier');
  const o = chantier([DEM, ['tour', { execution: 'ticket-5-1', etape: 'planifier', maximum: 5, run: '1' }]]);
  assert.equal(N.prochaineEtape(N.etatChantier(o)).raison, 'tour-en-cours');
  assert.equal(N.appliquerChantier(o, { type: 'tour', quand: Q, donnees: { execution: 'ticket-5-2', etape: 'planifier', maximum: 5, run: '2' } }).refuse, true);
  assert.equal(N.appliquerChantier(o, { type: 'tour-clos', quand: Q, donnees: { execution: 'ticket-5-9', montant: 1, issue: 'ok' } }).refuse, true);
  // Planification deux fois en échec : blocage avec question.
  const pl = [DEM, ['planification-echouee', { raison: 'a' }], ['planification-echouee', { raison: 'b' }]];
  assert.equal(N.prochaineEtape(N.etatChantier(chantier(pl))).raison, 'planification-impossible');
  // Livraison refusée : blocage ; /reprendre efface la livraison et en prépare une nouvelle.
  const lv = [DEM, ['plan', { plan: planC, version: '0.65.27' }], C('salut', 1, 'b'), V('salut', 1), AV('salut', 1), ['validation', { par: 1 }],
    ['livraison', { version: '0.65.27', depot: 'd'.repeat(40), branche: 'livraison/ticket-5-1', colis_sha256: 'e'.repeat(64) }], ['livre', { conclusion: 'echec' }]];
  assert.equal(N.prochaineEtape(N.etatChantier(chantier(lv))).raison, 'livraison-refusee');
  lv.push(['bloque', { raison: 'livraison-refusee', question: 'q' }], ['reprise', { par: 1 }]);
  const e = N.etatChantier(chantier(lv));
  assert.equal(N.prochaineEtape(e).etape, 'livrer');
  assert.equal(e.livraisons, 1);
  // Journal : la demande ouvre, une seule fois ; numérotation stricte ; types connus.
  assert.equal(N.appliquerChantier([], { type: 'plan', quand: Q, donnees: {} }).refuse, true);
  assert.throws(() => N.etatChantier([{ n: 2, type: 'demande', quand: Q, donnees: DEM[1] }]));
});

// ------------------------------------------------------------------------------------------------ L8 commandes
test('L8 : /stop, /reprendre (+ réponse), /valider — propriétaire seul, par identifiant numérique, première ligne exacte', () => {
  const c = (id, body, login = 'christopheplantegenest-prog') => ({ user: { id, login }, body });
  assert.deepEqual(N.lireCommande(c(N.PROPRIETAIRE_ID, '/stop')), { commande: '/stop', reste: null });
  assert.deepEqual(N.lireCommande(c(N.PROPRIETAIRE_ID, '/Reprendre\r\nUtilise la table existante.\t ')), { commande: '/reprendre', reste: 'Utilise la table existante.' });
  assert.equal(N.lireCommande(c(N.PROPRIETAIRE_ID, '/valider ')).commande, '/valider');
  for (const x of [c(1, '/stop'), c(N.PROPRIETAIRE_ID, 'merci /stop'), c(N.PROPRIETAIRE_ID, '/stopper'), c(String(N.PROPRIETAIRE_ID), '/stop'), { body: '/stop' }, null]) assert.equal(N.lireCommande(x), null);
  assert.equal(N.ticketDeChantier({ user: { id: N.PROPRIETAIRE_ID }, title: 'Atelier : afficher l\'heure' }), true);
  assert.equal(N.ticketDeChantier({ user: { id: N.PROPRIETAIRE_ID }, title: 'atelier: x' }), true);
  assert.equal(N.ticketDeChantier({ user: { id: 2 }, title: 'Atelier : x' }), false);
  assert.equal(N.ticketDeChantier({ user: { id: N.PROPRIETAIRE_ID }, title: 'Bug' }), false);
  assert.equal(N.ticketDeChantier({ user: { id: N.PROPRIETAIRE_ID }, title: 'Atelier : x', pull_request: {} }), false);
});

// ------------------------------------------------------------------------------------------------ L2 boucle agentique
function fauxClient(reponses, { compte = 1000 } = {}) {
  const corps = [];
  return { corps, compter: async () => compte, envoyer: async (c) => { corps.push(JSON.parse(c)); const r = reponses.shift(); return typeof r === 'function' ? r() : r; } };
}
const reponse = (contenu, stop = 'tool_use', usage = { input_tokens: 100, output_tokens: 50 }) => ({ emis: true, inconnu: false, statut: 200, json: { content: contenu, stop_reason: stop, usage } });
const outil = (id, name, input) => ({ type: 'tool_use', id, name, input });

test('L2 : boucle — outils exécutés, pensée renvoyée intacte, coût réel cumulé, fin par l\'outil de fin', async () => {
  const pensee = { type: 'thinking', thinking: 'je lis', signature: 'sig' };
  const client = fauxClient([reponse([pensee, outil('u1', 'lire', { chemin: 'a' })]), reponse([outil('u2', 'fin', {})])]);
  const vus = [];
  const r = await boucle({ client, systeme: 'S', message: 'M', outils: [{ name: 'lire', description: 'd', input_schema: { type: 'object' } }], reserve: 10 * USD, profil: PROFILS.developper,
    executer: async (n, e) => { vus.push([n, e]); return n === 'fin' ? { fin: { statut: 'candidat' } } : { texte: 'contenu' }; } });
  assert.equal(r.statut, 'termine');
  assert.deepEqual(r.conclusion, { statut: 'candidat' });
  assert.equal(r.appels, 2);
  assert.equal(r.depense, 2 * N.coutUsage({ input_tokens: 100, output_tokens: 50 }));
  assert.deepEqual(vus, [['lire', { chemin: 'a' }], ['fin', {}]]);
  const second = client.corps[1];
  assert.deepEqual(second.messages[1], { role: 'assistant', content: [pensee, outil('u1', 'lire', { chemin: 'a' })] });
  assert.deepEqual(second.messages[2].content, [{ type: 'tool_result', tool_use_id: 'u1', content: 'contenu' }]);
  assert.equal(second.model, 'claude-opus-5-5');
  assert.equal(second.output_config.effort, 'high');
  assert.deepEqual(second.cache_control, { type: 'ephemeral' });
  assert.equal(second.system[0].cache_control.type, 'ephemeral');
  for (const k of ['temperature', 'top_p', 'top_k', 'thinking', 'tool_choice']) assert.equal(Object.hasOwn(second, k), false, k);
});
test('L2 : budget — arrêt AVANT un appel dont la borne ne tient pas ; issue inconnue comptée à sa borne ; refus, appels bornés', async () => {
  const profil = { maxTokens: 1000, effort: 'high', maxAppels: 5 };
  const borne = N.coutMaxAppel({ jetonsEntree: 1000, maxTokens: 1000 });
  const c1 = fauxClient([]);
  assert.equal((await boucle({ client: c1, systeme: 'S', message: 'M', outils: [], reserve: borne - 1, profil, executer: async () => ({}) })).statut, 'budget');
  assert.equal(c1.corps.length, 0);
  const c2 = fauxClient([{ emis: true, inconnu: true, erreur: 'transport : délai dépassé' }]);
  const r2 = await boucle({ client: c2, systeme: 'S', message: 'M', outils: [], reserve: 10 * USD, profil, executer: async () => ({}) });
  assert.equal(r2.statut, 'erreur');
  assert.equal(r2.depense, borne);
  const c3 = fauxClient([reponse([], 'refusal')]);
  assert.equal((await boucle({ client: c3, systeme: 'S', message: 'M', outils: [], reserve: 10 * USD, profil, executer: async () => ({}) })).statut, 'refus');
  const c4 = fauxClient(Array.from({ length: 6 }, (_, i) => reponse([outil(`u${i}`, 'x', {})])));
  assert.equal((await boucle({ client: c4, systeme: 'S', message: 'M', outils: [], reserve: 10 * USD, profil, executer: async () => ({ texte: 'ok' }) })).statut, 'max-appels');
  const c5 = fauxClient([reponse([{ type: 'text', text: 'fini' }], 'end_turn'), reponse([{ type: 'text', text: 'fini' }], 'end_turn'), reponse([{ type: 'text', text: 'fini' }], 'end_turn')]);
  assert.equal((await boucle({ client: c5, systeme: 'S', message: 'M', outils: [], reserve: 10 * USD, profil, executer: async () => ({}) })).statut, 'sans-conclusion');
  // Le total ne dépasse jamais la réserve : chaque appel n'est émis que si sa borne tient dans le reste.
  const c6 = fauxClient(Array.from({ length: 5 }, (_, i) => reponse([outil(`u${i}`, 'x', {})], 'tool_use', { input_tokens: 1000, output_tokens: 1000 })));
  const r6 = await boucle({ client: c6, systeme: 'S', message: 'M', outils: [], reserve: 2 * borne, profil, executer: async () => ({ texte: 'ok' }) });
  assert.equal(r6.statut, 'budget');
  assert.ok(r6.depense <= 2 * borne);
});
test('L2 : client HTTP — en-têtes (clé dans x-api-key seulement, version 2026-10-21), count_tokens, cibles admises seulement', async () => {
  const recus = [];
  const serveur = createServer((req, res) => {
    let b = '';
    req.on('data', (d) => { b += d; });
    req.on('end', () => {
      recus.push({ url: req.url, h: req.headers, b: JSON.parse(b) });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(req.url.endsWith('count_tokens') ? { input_tokens: 4321 } : { content: [], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
    });
  });
  await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
  try {
    const c = clientAnthropic({ cible: `http://127.0.0.1:${serveur.address().port}`, cle: 'cle-de-test' });
    const corps = JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 10, system: [], tools: [], messages: [{ role: 'user', content: 'x' }] });
    assert.equal(await c.compter(corps), 4321);
    const r = await c.envoyer(corps);
    assert.equal(r.json.stop_reason, 'end_turn');
    assert.deepEqual(recus.map((x) => x.url), ['/v1/messages/count_tokens', '/v1/messages']);
    for (const x of recus) {
      assert.equal(x.h['x-api-key'], 'cle-de-test');
      assert.equal(x.h['anthropic-version'], VERSION_API);
      assert.equal(JSON.stringify(x.b).includes('cle-de-test'), false);
    }
    assert.equal(Object.hasOwn(recus[0].b, 'max_tokens'), false);
  } finally { serveur.close(); }
  for (const cible of ['https://exemple.com', 'http://localhost:80', 'http://127.0.0.1', 'https://api.anthropic.com.exemple.com']) assert.throws(() => clientAnthropic({ cible, cle: 'k' }), /cible/);
  assert.throws(() => clientAnthropic({ cle: '' }), /clé/);
  assert.equal(VERSION_API, '2026-10-21');
});

// ------------------------------------------------------------------------------------------------ L2/L3 outils et bac à sable
test('L2 : outils de développement — écriture bornée au périmètre, remplacement unique, lecture et recherche ; terminer exige la suite complète verte', async () => {
  const d = mkdtempSync(join(tmpdir(), 'outils-'));
  try {
    mkdirSync(join(d, 'app'), { recursive: true });
    writeFileSync(join(d, 'app', 'a.js'), 'const a = 1;\nconst b = 2;\n');
    const suites = [{ code: 1, resume: { total: 3, reussis: 2, echecs: 1 }, sortie: 'not ok 3 - x\n' }, { code: 0, resume: { total: 3, reussis: 3, echecs: 0 }, sortie: '' }];
    const o = outilsEtape({ etape: 'developper', racine: d, autorises: ['app/a.js', 'app/nouveau.js'], suiteComplete: () => suites.shift() });
    assert.deepEqual(o.outils.map((x) => x.name), ['lister', 'lire', 'chercher', 'ecrire', 'remplacer', 'executer_tests', 'terminer']);
    const x = (n, e) => o.executer(n, e);
    assert.match((await x('ecrire', { chemin: 'app/nouveau.js', contenu: 'export const n = 1;\n' })).texte, /écrit/);
    assert.match((await x('ecrire', { chemin: 'app/atelier/x.js', contenu: '' })).erreur, /refusée/);
    assert.match((await x('ecrire', { chemin: '.github/workflows/x.yml', contenu: '' })).erreur, /refusée/);
    assert.match((await x('ecrire', { chemin: 'app/hors.js', contenu: '' })).erreur, /périmètre/);
    assert.match((await x('remplacer', { chemin: 'app/a.js', ancien: 'const', nouveau: 'let' })).erreur, /2 fois/);
    assert.match((await x('remplacer', { chemin: 'app/a.js', ancien: 'const b', nouveau: 'let b' })).texte, /remplacé/);
    assert.equal(readFileSync(join(d, 'app', 'a.js'), 'utf8'), 'const a = 1;\nlet b = 2;\n');
    assert.match((await x('lire', { chemin: 'app/a.js', debut: 2, fin: 2 })).texte, /^2\tlet b = 2;\n/);
    assert.match((await x('lire', { chemin: '../etc/passwd' })).erreur ?? '', /./);
    assert.match((await x('chercher', { motif: 'let b' })).texte, /app\/a\.js:2/);
    assert.match((await x('lister', { dossier: '.' })).texte, /app\//);
    assert.match((await x('executer_tests', { fichiers: ['../x.test.mjs'] })).erreur, /refusé/);
    assert.match((await x('terminer', { statut: 'candidat', resume: 'r' })).erreur, /suite complète en échec/);
    assert.deepEqual((await x('terminer', { statut: 'candidat', resume: 'r' })).fin.tests, { total: 3, reussis: 3, echecs: 0 });
    assert.match((await x('terminer', { statut: 'bloque', resume: 'r' })).erreur, /question/);
    assert.match((await x('inconnu', {})).erreur, /inconnu/);
    const p = outilsEtape({ etape: 'planifier', racine: d, contexte: { issue: 3, demande: DEMANDE } });
    assert.deepEqual(p.outils.map((y) => y.name), ['lister', 'lire', 'chercher', 'proposer_plan']);
    assert.match((await p.executer('ecrire', { chemin: 'app/a.js', contenu: '' })).erreur, /inconnu/);
    assert.match((await p.executer('proposer_plan', { plan: { description: 'x', missions: [] } })).erreur, /plan refusé/);
    assert.equal((await p.executer('proposer_plan', { plan: { description: 'x', missions: [MISSION('a')] } })).fin.statut, 'plan');
    assert.deepEqual((await p.executer('proposer_plan', { question: 'Laquelle ?' })).fin, { statut: 'bloque', question: 'Laquelle ?' });
    const a = outilsEtape({ etape: 'avis', racine: d });
    assert.match((await a.executer('rendre_avis', { conforme: false, objections: [] })).erreur, /objection/);
    assert.deepEqual((await a.executer('rendre_avis', { conforme: true, objections: [] })).fin, { statut: 'avis', conforme: true, objections: [] });
  } finally { rmSync(d, { recursive: true, force: true }); }
});
test('L3 : bac à sable — docker sans réseau, sans capacité, non root, sans variable héritée ni clé ; image épinglée ; résumé TAP', () => {
  const a = argumentsDocker({ nom: 'n', copie: '/tmp/c', commande: ['node', '--test', 'tests/x.test.mjs'] });
  const ch = a.join(' ');
  for (const x of ['--network none', '--cap-drop ALL', '--security-opt no-new-privileges', '--user 1000:1000', '--read-only', '--pids-limit 1024', '--memory 3g', '--rm']) assert.ok(ch.includes(x), x);
  assert.deepEqual(a.filter((x, i) => a[i - 1] === '--env'), ['HOME=/tmp', 'CI=1']);
  assert.doesNotMatch(ch, /CLE|KEY|TOKEN|JETON|secret/i);
  assert.equal(a.filter((x) => x === '--volume').length, 1);
  const src = readFileSync(join(RACINE, 'outils-atelier', 'auto-agent.mjs'), 'utf8');
  assert.match(src, /IMAGE_BAC = 'node:22-bookworm@sha256:[0-9a-f]{64}'/);
  assert.match(src, /env: \{ PATH: process\.env\.PATH \?\? '\/usr\/bin:\/bin' \}/); // docker lancé sans l'environnement du job
  assert.deepEqual(resumeTap('# tests 12\n# suites 1\n# pass 10\n# fail 1\n# cancelled 1\n'), { total: 12, reussis: 10, echecs: 2 });
  assert.equal(resumeTap('rien'), null);
});

// ------------------------------------------------------------------------------------------------ L7 colis
test('L7 : colis au format du robot — lu par zipfile de Python, _livraison.json en tête, mode 0o100644, dates fixes, CRC justes', () => {
  const z = colis({ version: '0.65.27', description: 'Atelier autonome ticket 5 : salutation', fichiers: [{ chemin: 'tests/salut.test.mjs', donnees: Buffer.from('t\n') }, { chemin: 'app/salut.js', donnees: Buffer.from('export const s = "é";\n') }] });
  assert.deepEqual(z, colis({ version: '0.65.27', description: 'Atelier autonome ticket 5 : salutation', fichiers: [{ chemin: 'app/salut.js', donnees: Buffer.from('export const s = "é";\n') }, { chemin: 'tests/salut.test.mjs', donnees: Buffer.from('t\n') }] }));
  const d = mkdtempSync(join(tmpdir(), 'zip-'));
  try {
    writeFileSync(join(d, 'c.zip'), z);
    const py = 'import json,sys,zipfile\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint(json.dumps([[i.filename,oct(i.external_attr>>16),i.date_time[0],i.flag_bits] for i in z.infolist()]))\nprint(json.dumps(json.loads(z.read("_livraison.json"))))\nprint(z.read("app/salut.js").decode())';
    const r = spawnSync('python3', ['-I', '-c', py, join(d, 'c.zip')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const [infos, desc, contenu] = r.stdout.split('\n');
    assert.deepEqual(JSON.parse(infos), [['_livraison.json', '0o100644', 2026, 2048], ['app/salut.js', '0o100644', 2026, 2048], ['tests/salut.test.mjs', '0o100644', 2026, 2048]]);
    assert.deepEqual(JSON.parse(desc), { version: '0.65.27', action: 'livraison', apk: true, description: 'Atelier autonome ticket 5 : salutation' });
    assert.equal(contenu, 'export const s = "é";');
  } finally { rmSync(d, { recursive: true, force: true }); }
  assert.equal(fabriquerZip([]).length, 22);
});
test('L6/L5 : texte d\'état du ticket — non cognitif, budget du mois, consignes /stop /reprendre /valider', () => {
  const j = chantier([DEM, ['plan', { plan: { description: 'x', missions: [MISSION('salut', { cognitive: true })] }, version: '0.65.27' }], C('salut', 1, 'b'), V('salut', 1), AV('salut', 1)]);
  const t = N.texteEtat(N.etatChantier(j), etatBudget(N.reserverTour([], { quand: Q, execution: 'e', issue: 5, etape: 'avis' }).journal));
  assert.match(t, /OUTILLAGE NON COGNITIF/);
  assert.match(t, /\/valider/);
  assert.match(t, /mois 2026-10 : 0\.00 \$ consommés, 1\.50 \$ réservés, 98\.50 \$ restants sur 100\.00 \$/);
  assert.equal(existsSync(join(RACINE, '.github', 'workflows', 'atelier-chantier.yml')), true);
});

// ------------------------------------------------------------------------------------------------ workflows (gardes statiques)
const blocs = (texte) => Object.fromEntries(texte.split(/\n(?= {2}[a-z]+:\n)/).slice(1).map((b) => [b.trim().split(':')[0], b]));
test('L5 : atelier-chantier.yml — la clé n\'existe que dans le job agent (lecture seule, sans identifiants persistés) ; les jobs qui écrivent n\'ont aucun secret', () => {
  const y = readFileSync(join(RACINE, '.github', 'workflows', 'atelier-chantier.yml'), 'utf8');
  const jobs = blocs(y.slice(y.indexOf('\njobs:\n') + 6));
  assert.deepEqual(Object.keys(jobs), ['garde', 'agent', 'bilan', 'commande', 'veille']);
  assert.equal((y.match(/secrets\./g) || []).length, 1);
  assert.match(jobs.agent, /ATELIER_AGENT_CLE: \$\{\{ secrets\.ATELIER_AGENT_CLE \}\}/);
  assert.match(jobs.agent, /environment: atelier-agent/);
  assert.match(jobs.agent, /permissions:\n {6}contents: read\n {4}steps:/);
  assert.equal((jobs.agent.match(/persist-credentials: false/g) || []).length, 2);
  assert.doesNotMatch(jobs.agent, /github\.token|GITHUB_TOKEN|persist-credentials: true/);
  for (const j of ['garde', 'bilan', 'commande', 'veille']) {
    assert.doesNotMatch(jobs[j], /secrets\.|environment:/, j);
    assert.match(jobs[j], /ATELIER_GITHUB_JETON: \$\{\{ github\.token \}\}/, j);
  }
  assert.match(y, /^permissions: \{\}$/m);
  // Déclencheurs : ticket du propriétaire (identifiant numérique), relance par l'opérateur ou le propriétaire, commande du propriétaire.
  assert.match(jobs.garde, /github\.event\.issue\.user\.id == 308310970/);
  assert.match(jobs.garde, /github\.actor == 'github-actions\[bot\]' \|\| github\.actor == github\.repository_owner/);
  assert.match(jobs.commande, /github\.event\.comment\.user\.id == 308310970/);
  assert.match(jobs.commande, /!github\.event\.issue\.pull_request/);
  assert.match(jobs.bilan, /if: \$\{\{ !cancelled\(\) && needs\.garde\.outputs\.agent == 'oui' \}\}/);
  // Aucune valeur d'entrée interpolée dans une commande : le ticket passe par l'environnement et est contrôlé.
  for (const b of Object.values(jobs)) for (const run of b.split('run:').slice(1)) assert.doesNotMatch(run.split('\n      - ')[0], /\$\{\{/);
  assert.match(jobs.garde, /\[\[ "\$TICKET" =~ \^\[1-9\]\[0-9\]\{0,6\}\$ \]\]/);
  // Toutes les actions épinglées par empreinte.
  for (const u of y.match(/uses: \S+/g)) assert.match(u, /@[0-9a-f]{40}$/, u);
});
test('L7 : robot.yml et deballer.py — le dépôt de l\'atelier passe par les mêmes jobs et la même approbation V4 ; contrôle du parent unique', () => {
  const y = readFileSync(join(RACINE, '.github', 'workflows', 'robot.yml'), 'utf8');
  const jobs = blocs(y.slice(y.indexOf('\njobs:\n') + 6));
  assert.match(jobs.inventaire, /github\.event_name == 'workflow_dispatch' &&\n\s+inputs\.depot != '' &&\n\s+\(github\.actor == 'github-actions\[bot\]' \|\| github\.actor == github\.repository_owner\)/);
  assert.match(jobs.inventaire, /ref: \$\{\{ inputs\.depot \|\| github\.sha \}\}/);
  assert.match(jobs.inventaire, /python3 -I \.github\/workflows\/deballer\.py depot/);
  assert.match(jobs.livraison, /environment: livraison/);
  assert.match(jobs.livraison, /ROBOT_DEPOT: \$\{\{ inputs\.depot \}\}/);
  assert.match(jobs.site, /inputs\.depot == ''/);
  const py = readFileSync(join(RACINE, '.github', 'workflows', 'deballer.py'), 'utf8');
  assert.match(py, /def parent_du_depot\(depot\):/);
  assert.match(py, /if distant_main\(\) != attendu:/);
  assert.match(py, /"livrer": cmd_livrer, "depot": cmd_depot/);
});
