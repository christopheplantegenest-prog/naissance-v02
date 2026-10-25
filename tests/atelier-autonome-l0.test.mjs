// v0.66.6 — ATELIER 2, L0 (GO « ATELIER 2 — GO PHASE 1 », 25/10/2026) : fiabilisation de l'Atelier autonome.
//  - D4 : /reprendre rouvre deux planifications (compteur par époque) ;
//  - question de l'agent : la tentative close par une question ne compte pas après /reprendre ;
//  - D5-a : tests/ ouvert à toute mission sous la garde des tests (contrôles qualitatifs, pas seulement des comptes) ;
//  - D5-b : « périmètre + : … » dans la réponse d'un /reprendre élargit la mission en cours ;
//  - plafond de 25 USD par chantier ;
//  - rejeu des journaux réels (copie figée dans tests/atelier-journaux-reels/) : même décision qu'avant.
// OUTILLAGE NON COGNITIF — aucune acquisition de Naissance (D-007). Aucun appel réseau, aucune clé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { etatBudget } from '../app/atelier/budget.js';
import { construireMission } from '../app/atelier/mission.js';
import * as N from '../outils-atelier/auto-autonome-noyau.mjs';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const USD = 1_000_000;
const Q = '2026-10-25T20:00:00Z';
const BASE = { sha: 'a'.repeat(40), version: '0.66.5' };
const MISSION = (id, autres = {}) => ({ id, titre: `Mission ${id}`, comportement: 'Un comportement observable.', criteres: ['Critère.'], tests: ['Test.'], autorises: [`app/${id}.js`, `tests/${id}.test.mjs`], cognitive: false, ...autres });
const plan2 = { description: 'Salutation', missions: [MISSION('salut'), MISSION('suite')] };
const DEM = ['demande', { issue: 5, titre: 'Atelier : bonjour', texte: 'x', base: BASE }];
const PLAN = ['plan', { plan: plan2, version: '0.66.6' }];
const SANS = (m, t, raison = 'tests réels en échec') => ['sans-candidat', { mission: m, tentative: t, raison }];
function chantier(evs, base = []) {
  let j = base;
  for (const [type, donnees] of evs) {
    const r = N.appliquerChantier(j, { type, quand: Q, donnees });
    assert.ok(Array.isArray(r), `${type} : ${r.raison}`);
    j = r;
  }
  return j;
}
const etape = (evs, base) => N.prochaineEtape(N.etatChantier(chantier(evs, base)));
const lire = (nom) => JSON.parse(readFileSync(join(RACINE, 'tests', 'atelier-journaux-reels', `${nom}.json`), 'utf8'));

// ------------------------------------------------------------------------------------------------ D4
test('D4 : deux planifications en échec = blocage ; /reprendre en rouvre deux ; deux nouveaux échecs = nouveau blocage', () => {
  const evs = [DEM, ['planification-echouee', { raison: 'a' }], ['planification-echouee', { raison: 'b' }]];
  const b = etape(evs);
  assert.equal(b.raison, 'planification-impossible');
  evs.push(['bloque', { raison: b.raison, question: b.question }]);
  assert.equal(etape(evs).raison, 'bloque');
  evs.push(['reprise', { par: N.PROPRIETAIRE_ID, reponse: 'Plan fourni : une seule mission.' }]);
  assert.equal(etape(evs).etape, 'planifier');
  evs.push(['planification-echouee', { raison: 'c' }]);
  assert.equal(etape(evs).etape, 'planifier');
  evs.push(['planification-echouee', { raison: 'd' }]);
  assert.equal(etape(evs).raison, 'planification-impossible');
  const e = N.etatChantier(chantier(evs));
  assert.equal(e.planifications, 4); // le total reste inscrit (lecture du journal inchangée)
  assert.deepEqual(e.echecsPlanification, [0, 0, 1, 1]);
  // /stop puis /reprendre rouvre aussi (le cas du ticket 16).
  const s = [DEM, ['planification-echouee', { raison: 'a' }], ['planification-echouee', { raison: 'b' }], ['bloque', { raison: 'planification-impossible', question: 'q' }], ['arret', { par: N.PROPRIETAIRE_ID }], ['reprise', { par: N.PROPRIETAIRE_ID }]];
  assert.equal(etape(s).etape, 'planifier');
});

// ------------------------------------------------------------------------------------------------ question de l'agent
test('Question : la tentative close par une question ne compte pas après /reprendre ; un autre blocage ne rend rien ; une question avant le plan non plus', () => {
  const evs = [DEM, PLAN, SANS('salut', 1, 'question : puis-je modifier tests/x.test.mjs ?'), ['bloque', { raison: 'question', question: 'puis-je ?' }], ['reprise', { par: N.PROPRIETAIRE_ID, reponse: 'Oui.' }]];
  assert.equal(N.etatChantier(chantier(evs)).bonus, 1);
  evs.push(SANS('salut', 2), SANS('salut', 3));
  assert.equal(etape(evs).tentative, 4); // sans la règle : blocage « tentatives-epuisees » ici
  evs.push(SANS('salut', 4));
  assert.equal(etape(evs).raison, 'tentatives-epuisees');
  // Un blocage « migration » ne rend aucune tentative.
  const m = [DEM, PLAN, SANS('salut', 1), ['bloque', { raison: 'migration', question: 'q' }], ['reprise', { par: N.PROPRIETAIRE_ID }]];
  assert.equal(N.etatChantier(chantier(m)).bonus, 0);
  // Question à la planification (aucune tentative de mission) : rien à rendre.
  const p = [DEM, ['bloque', { raison: 'question', question: 'Laquelle ?' }], ['reprise', { par: N.PROPRIETAIRE_ID, reponse: 'La première.' }]];
  assert.equal(N.etatChantier(chantier(p)).bonus, 0);
  // Question puis /stop puis /reprendre : rendue une seule fois.
  const s = [DEM, PLAN, SANS('salut', 1, 'question : ?'), ['bloque', { raison: 'question', question: '?' }], ['arret', { par: N.PROPRIETAIRE_ID }], ['reprise', { par: N.PROPRIETAIRE_ID }], ['arret', { par: N.PROPRIETAIRE_ID }], ['reprise', { par: N.PROPRIETAIRE_ID }]];
  assert.equal(N.etatChantier(chantier(s)).bonus, 1);
});

// ------------------------------------------------------------------------------------------------ D5-a
test('D5-a : tests/ ouvert à toute mission, jamais tests/atelier-* ni les zones protégées ; donneesMission l\'ajoute et mission.js l\'accepte', () => {
  assert.equal(N.raisonCheminEcriture('tests/retrouvailles.test.mjs', ['app/x.js']), null);
  assert.equal(N.raisonCheminEcriture('tests/outils.mjs', ['app/x.js']), null);
  assert.equal(N.raisonCheminEcriture('tests/atelier-autonome.test.mjs', ['tests/']), 'chemin protégé de l\'atelier');
  assert.equal(N.raisonCheminEcriture('tests/atelier-journaux-reels/17.json', ['tests/']), 'chemin protégé de l\'atelier');
  assert.equal(N.raisonCheminEcriture('app/y.js', ['app/x.js']), 'hors du périmètre de la mission');
  assert.equal(N.raisonCheminEcriture('tests/../app/atelier/auto.js', ['tests/']), 'chemin irrégulier ou caché');
  const d = N.donneesMission({ issue: 5, demande: DEM[1], plan: plan2, index: 1, tentative: 1 });
  assert.deepEqual(d.autorises, ['app/salut.js', 'tests/salut.test.mjs', 'app/suite.js', 'tests/suite.test.mjs', 'tests/']);
  const m = construireMission(d);
  assert.ok(m);
});

// ------------------------------------------------------------------------------------------------ D5-b
test('D5-b : lirePerimetre — lignes « périmètre + : », séparateurs, accents, refus motivés (atelier, protégés, irréguliers)', () => {
  const r = N.lirePerimetre('Oui, autorisé.\nPérimètre + : tests/retrouvailles.test.mjs, app/langage/issues-vecues.js; `app/ecran.js`\nperimetre+: app/atelier/auto.js tests/atelier-x.test.mjs ../x app/ outils/ app/langage/\nautre ligne : app/z.js');
  assert.deepEqual(r.ajouts, ['tests/retrouvailles.test.mjs', 'app/langage/issues-vecues.js', 'app/ecran.js', 'outils/', 'app/langage/']);
  assert.deepEqual(r.refuses.map((x) => x.chemin), ['app/atelier/auto.js', 'tests/atelier-x.test.mjs', '../x', 'app/']);
  assert.equal(r.refuses.find((x) => x.chemin === 'app/').raison, 'couvre un chemin protégé');
  assert.deepEqual(N.lirePerimetre('sans ligne de périmètre'), { ajouts: [], refuses: [] });
  assert.equal(N.lirePerimetre(`périmètre + : ${Array.from({ length: 30 }, (_, i) => `app/f${i}.js`).join(' ')}`).ajouts.length, 20);
  assert.equal(N.raisonAjoutPerimetre('package.json'), 'chemin protégé de l\'atelier');
  assert.equal(N.raisonAjoutPerimetre('.github/workflows/x.yml'), 'chemin irrégulier ou caché');
});
test('D5-b : l\'événement « perimetre » — seulement sur un chantier arrêté ou bloqué, mission connue, chemins valides, mission.js toujours satisfait ; cumulé et rejoué', () => {
  const evs = [DEM, PLAN, SANS('salut', 1, 'question : ?'), ['bloque', { raison: 'question', question: '?' }]];
  const j = chantier(evs);
  const ajout = (donnees, base = j) => N.appliquerChantier(base, { type: 'perimetre', quand: Q, donnees });
  assert.ok(Array.isArray(ajout({ mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: ['app/langage/x.js'] })));
  assert.match(ajout({ mission: 'inconnue', par: N.PROPRIETAIRE_ID, ajouts: ['app/x.js'] }).raison, /mission inconnue/);
  assert.match(ajout({ mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: ['app/atelier/auto.js'] }).raison, /refusé/);
  assert.match(ajout({ mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: [] }).raison, /illisible/);
  assert.match(ajout({ mission: 'salut', par: 'x', ajouts: ['app/x.js'] }).raison, /illisible/);
  const actif = chantier([DEM, PLAN]);
  assert.match(ajout({ mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: ['app/x.js'] }, actif).raison, /arrêté ou bloqué/);
  // mission.js borne le périmètre à 50 entrées : un élargissement qui le dépasserait est refusé, pas différé en panne.
  let k = chantier([['perimetre', { mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: Array.from({ length: 20 }, (_, i) => `app/a${i}.js`) }], ['perimetre', { mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: Array.from({ length: 20 }, (_, i) => `app/b${i}.js`) }]], j);
  assert.match(ajout({ mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: Array.from({ length: 10 }, (_, i) => `app/c${i}.js`) }, k).raison, /mission\.js/);
  // Cumul, doublons retirés, transmis à la mission en cours et aux suivantes.
  k = chantier([['perimetre', { mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: ['app/langage/x.js', 'tests/r.test.mjs'] }], ['perimetre', { mission: 'salut', par: N.PROPRIETAIRE_ID, ajouts: ['app/langage/x.js', 'app/ecran.js'] }], ['reprise', { par: N.PROPRIETAIRE_ID }]], j);
  const e = N.etatChantier(k);
  assert.deepEqual(e.perimetres, { salut: ['app/langage/x.js', 'tests/r.test.mjs', 'app/ecran.js'] });
  assert.equal(N.missionCourante(e), 'salut');
  assert.deepEqual(N.prochaineEtape(e).tentative, 2);
  assert.ok(N.donneesMission({ issue: 5, demande: DEM[1], plan: plan2, index: 0, tentative: 2, perimetres: e.perimetres }).autorises.includes('app/ecran.js'));
  assert.ok(N.donneesMission({ issue: 5, demande: DEM[1], plan: plan2, index: 1, tentative: 1, perimetres: e.perimetres }).autorises.includes('app/langage/x.js'));
  assert.match(N.texteEtat(e, null), /périmètre \+ .*app\/ecran\.js/);
});

// ------------------------------------------------------------------------------------------------ plafond 25 USD
test('Plafond : 25 USD par chantier — réserve réduite au reste, refus « plafond-chantier » sous le minimum d\'un tour, même pour un chantier inscrit à 300 USD', () => {
  assert.equal(N.PLAFOND_CHANTIER, 25 * USD);
  const r = N.reserverTour([], { quand: Q, execution: 'ticket-9-1', issue: 9, etape: 'developper', depenseChantier: 20_500_000 });
  assert.equal(r.maximum, 4_500_000);
  const a = N.reserverTour([], { quand: Q, execution: 'ticket-9-1', issue: 9, etape: 'avis', depenseChantier: 23_600_000 });
  assert.equal(a.maximum, 1_400_000);
  const refus = N.reserverTour([], { quand: Q, execution: 'ticket-9-1', issue: 9, etape: 'planifier', depenseChantier: 24_500_000 });
  assert.equal(refus.refus, 'plafond-chantier');
  assert.match(refus.raison, /ticket-9/);
  // Registre réel d'octobre : les chantiers 12 à 18 y sont inscrits à 300 USD ; la dépense réelle du chantier borne quand même.
  const budget = lire('budget');
  assert.equal(etatBudget(budget).chantiers['ticket-17'].plafond, 300 * USD);
  assert.equal(N.reserverTour(budget, { quand: Q, execution: 'ticket-17-4', issue: 17, etape: 'developper', depenseChantier: 24_500_000 }).refus, 'plafond-chantier');
  assert.equal(N.reserverTour(budget, { quand: Q, execution: 'ticket-17-4', issue: 17, etape: 'developper', depenseChantier: 4_099_019 }).maximum, 8 * USD);
  const neuf = N.reserverTour(budget, { quand: Q, execution: 'ticket-19-1', issue: 19, etape: 'planifier' });
  assert.equal(etatBudget(neuf.journal).chantiers['ticket-19'].plafond, 25 * USD);
  assert.match(N.texteEtat(N.etatChantier(chantier([DEM])), null), /sur 25\.00 \$/);
});

// ------------------------------------------------------------------------------------------------ garde des tests
const AVANT = [
  "import test from 'node:test';",
  "import assert from 'node:assert/strict';",
  "import { f } from '../app/f.js';",
  '',
  '// T1 : f rend deux.',
  "test('T1 : f rend deux', () => {",
  '  assert.equal(f(), 2);',
  "  assert.deepEqual([f()], [2]);",
  '});',
  '',
  "test('T2 : f est une fonction', () => {",
  "  assert.equal(typeof f, 'function');",
  '});',
  '',
].join('\n');
const MODIF = (avant, apres) => ({ chemin: 'tests/f.test.mjs', etat: 'modifie', avant, apres });
const NOTE = '// MISE À JOUR DÉLIBÉRÉE v0.66.6 : f rend désormais trois (nouvelle règle du jalon)';
const garde = (apres, version = '0.66.6') => N.gardeTest(MODIF(AVANT, apres), version).objections;

test('Garde des tests : une mise à jour annotée et justifiée, test par test, passe ; les lignes changées sont rendues au second avis', () => {
  const apres = AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  assert.equal(f(), 3);`).replace('[2]);', '[3]);');
  assert.deepEqual(garde(apres), []);
  const r = N.resumeTestsModifies([MODIF(AVANT, apres)], '0.66.6');
  assert.equal(r.length, 1);
  assert.ok(r[0].lignes.includes('+ assert.equal(f(), 3);'));
  assert.ok(r[0].lignes.includes('- assert.equal(f(), 2);'));
  // Annotation dans le commentaire d'en-tête du test (ce que fait le vrai ticket 18) : même segment, accepté.
  const tete = AVANT.replace('// T1 : f rend deux.', `// T1 : f rend deux.\n${NOTE}`).replace('  assert.equal(f(), 2);', '  assert.equal(f(), 3);').replace('[2]);', '[3]);');
  assert.deepEqual(garde(tete), []);
  // Renommer un test, annoté : accepté (le nombre de tests ne baisse pas).
  assert.deepEqual(garde(AVANT.replace("test('T2 : f est une fonction'", `${NOTE}\ntest('T2 : f reste une fonction'`)), []);
  // Ajouter un test entier, annoté, et un commentaire seul : acceptés ; un commentaire seul n'exige rien.
  assert.deepEqual(garde(`${AVANT}${NOTE}\ntest('T3 : f est stable', () => {\n  assert.equal(f(), f());\n});\n`.replace('assert.equal(f(), f())', 'assert.equal(f(), 2)')), []);
  assert.deepEqual(garde(AVANT.replace('// T1 : f rend deux.', '// T1 : f rend deux (vérifié à la main).')), []);
  // Un nouveau fichier avec un test et une assertion : accepté.
  assert.deepEqual(N.gardeTest({ chemin: 'tests/g.test.mjs', etat: 'cree', avant: null, apres: "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('g', () => { assert.ok(1 + 1 === 2); });\n" }).objections, []);
});
test('Garde des tests : affaiblissements refusés même quand les comptes sont bons (désactivation, neutralisation, forme changée, test retiré, annotation absente, fausse ou vide)', () => {
  const cas = [
    ['test sauté', AVANT.replace("test('T2", `${NOTE}\ntest.skip('T2`), /désactivé/],
    ['option skip', AVANT.replace("test('T2 : f est une fonction', ()", `${NOTE}\ntest('T2 : f est une fonction', { skip: true }, ()`), /skip, todo ou only/],
    ['assertion toujours vraie', AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  assert.ok(true);\n  assert.equal(f(), 2);`), /toujours vraie/],
    ['valeur comparée à elle-même', AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  assert.equal(x, x);`), /elle-même|retirée/],
    ['« || true »', AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  assert.ok(f() === 2 || true);\n  assert.equal(f(), 2);`), /\|\| true/],
    ['catch vide', AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  try { assert.equal(f(), 2); } catch {}`), /catch vide/],
    ['return nu', AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  return;\n  assert.equal(f(), 2);`), /return/],
    ['if (false)', AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  if (false) assert.equal(f(), 2);`), /code rendu mort/],
    ['forme changée (equal → ok, même nombre)', AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  assert.ok(f());`), /assert\.equal retirée/],
    ['assertion retirée, annotée', AVANT.replace('  assert.equal(f(), 2);\n', `  ${NOTE}\n`), /assert\.equal retirée/],
    ['test retiré, annoté', AVANT.replace("test('T2 : f est une fonction', () => {\n  assert.equal(typeof f, 'function');\n});\n", `${NOTE}\n`), /test\(s\) retiré/],
    ['annotation absente', AVANT.replace('  assert.equal(f(), 2);', '  assert.equal(f(), 3);\n  assert.equal(f(), 2);'), /sans annotation/],
    ['annotation d\'une autre version', AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE.replace('0.66.6', '0.66.5')}\n  assert.equal(f(), 3);\n  assert.equal(f(), 2);`), /sans annotation/],
    ['annotation sans justification', AVANT.replace('  assert.equal(f(), 2);', '  // MISE À JOUR DÉLIBÉRÉE v0.66.6 : ok\n  assert.equal(f(), 3);\n  assert.equal(f(), 2);'), /sans annotation/],
    ['annotation dans un autre test', AVANT.replace("  assert.equal(typeof f, 'function');", `  ${NOTE}\n  assert.equal(typeof f, 'function');`).replace('  assert.equal(f(), 2);', '  assert.equal(f(), 3);\n  assert.equal(f(), 2);'), /sans annotation/],
  ];
  for (const [nom, apres, re] of cas) {
    const o = garde(apres);
    assert.ok(o.some((x) => re.test(x)), `${nom} : ${JSON.stringify(o)}`);
  }
  // Nouveau fichier vide de sens, ou désactivé.
  assert.match(N.gardeTest({ chemin: 'tests/g.test.mjs', etat: 'cree', avant: null, apres: "import test from 'node:test';\n" }).objections.join(), /sans test ou sans assertion/);
  assert.match(N.gardeTest({ chemin: 'tests/g.test.mjs', etat: 'cree', avant: null, apres: "test.only('g', () => { assert.ok(f()); });\n" }).objections.join(), /désactivé/);
  // Par gardesStatiques : version du chantier exigée, plus de 15 fichiers de test existants refusés, tests/atelier-* protégé, suppression refusée.
  const apres = AVANT.replace('  assert.equal(f(), 2);', `  ${NOTE}\n  assert.equal(f(), 3);`).replace('[2]);', '[3]);');
  assert.deepEqual(N.gardesStatiques([MODIF(AVANT, apres)], { version: '0.66.6' }).objections, []);
  assert.match(N.gardesStatiques([MODIF(AVANT, apres)], { version: '0.66.7' }).objections.join(), /sans annotation/);
  const seize = Array.from({ length: 16 }, (_, i) => ({ ...MODIF(AVANT, apres), chemin: `tests/f${i}.test.mjs` }));
  assert.match(N.gardesStatiques(seize, { version: '0.66.6' }).objections.join(), /16 fichiers de test existants modifiés/);
  assert.match(N.gardesStatiques([{ ...MODIF(AVANT, apres), chemin: 'tests/atelier-autonome.test.mjs' }], { version: '0.66.6' }).objections.join(), /protégé/);
  assert.match(N.gardesStatiques([{ chemin: 'tests/f.test.mjs', etat: 'supprime', avant: AVANT, apres: null }]).objections.join(), /supprimé/);
});

// ------------------------------------------------------------------------------------------------ rejeu des journaux réels
test('Rejeu : les journaux réels (tickets 12, 13, 16, 17, 18) se relisent sans incohérence, avec la même décision et la même dépense qu\'en v0.66.5', () => {
  const attendu = { 12: ['termine', 703_430], 13: ['termine', 8_631_614], 16: ['arret', 3_565_628], 17: ['arret', 4_099_019], 18: ['termine', 8_574_306] };
  for (const [n, [raison, depense]] of Object.entries(attendu)) {
    const e = N.etatChantier(lire(n));
    assert.equal(N.prochaineEtape(e).raison, raison, `ticket ${n}`);
    assert.equal(e.depense, depense, `ticket ${n}`);
    assert.equal(N.texteEtat(e, null).length > 0, true);
  }
  const b = etatBudget(lire('budget'));
  assert.equal(b.cycle, '2026-10');
  assert.equal(b.consommeCycle, 25_573_997);
  // Ticket 16 (planification-impossible puis /stop) : un /reprendre replanifie désormais (D4).
  assert.equal(N.prochaineEtape(N.etatChantier(chantier([['reprise', { par: N.PROPRIETAIRE_ID }]], lire(16)))).etape, 'planifier');
});
test('Rejeu : le ticket 17 (arrêté sur deux questions de périmètre) repartirait avec le périmètre demandé et une tentative rendue', () => {
  const j17 = lire(17);
  const reponse = 'Oui.\npérimètre + : tests/retrouvailles.test.mjs, tests/lien-execution-designation.test.mjs';
  const per = N.lirePerimetre(reponse);
  assert.deepEqual(per.refuses, []);
  const e0 = N.etatChantier(j17);
  const mission = N.missionCourante(e0);
  assert.equal(mission, 'issue-vecue-ecrivain');
  const e = N.etatChantier(chantier([['perimetre', { mission, par: N.PROPRIETAIRE_ID, ajouts: per.ajouts }], ['reprise', { par: N.PROPRIETAIRE_ID, reponse }]], j17));
  const p = N.prochaineEtape(e);
  assert.equal(p.etape, 'developper');
  assert.equal(p.tentative, 3);
  assert.equal(e.bonus, 2); // les deux tentatives closes par une question
  const d = N.donneesMission({ issue: 17, demande: e.demande, plan: e.plan, index: p.index, tentative: p.tentative, perimetres: e.perimetres });
  assert.ok(d.autorises.includes('tests/retrouvailles.test.mjs'));
  assert.ok(construireMission(d));
});
