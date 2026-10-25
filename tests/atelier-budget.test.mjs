// v0.65.1 — AT-2 « REGISTRE DE BUDGET » (GO « AUTORISATION AT-2 », 17/10/2026 ; D-007). OUTILLAGE NON COGNITIF — aucune acquisition.
// Unité : le microdollar (1 USD = 1 000 000). Preuves : refus à la borne annoncée (égalité acceptée, une unité de plus refusée),
// réserve, plafond par exécution, plafond de chantier global, engagements ouverts comptés à leur maximum, aucun double comptage,
// dépassement réel inscrit puis suspension, changement de cycle, journal append-only, rejeu, corruption, pureté et dormance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/budget.js';
import { ouvrirRegistre, appliquerBudget, etatBudget, verifierRegistre } from '../app/atelier/budget.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ATELIER = join(RACINE, 'app', 'atelier');
const CHEMIN = join(ATELIER, 'budget.js');
const SRC = readFileSync(CHEMIN, 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CODE = sansCommentaires(SRC);
const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : p.endsWith('.js') ? [p] : []; });

const USD = 1_000_000; // microdollars
const Q = '2026-10-17T07:00:00Z';
const CYCLE = { cycle: '2026-10', plafond: 100 * USD, reserve: 20 * USD, plafondRun: 15 * USD };
const ev = (type, donnees = {}) => ({ type, quand: Q, donnees });
const plafonner = (chantier, plafond) => ev('chantier-plafonne', { chantier, plafond });
const engager = (execution, maximum, chantier = 'A') => ev('engagement', { execution, chantier, maximum });
const payer = (execution, montant) => ev('cout', { execution, montant });
const nouveauCycle = (cycle, d = {}) => ev('cycle-ouvert', { ...CYCLE, cycle, ...d });
const ouvrir = (d = CYCLE) => ouvrirRegistre(structuredClone(d), Q);

// Applique une suite d'événements ; échoue au premier refus.
function suite(journal, ...evs) {
  let j = journal;
  for (const e of evs) {
    const r = appliquerBudget(j, e);
    assert.ok(Array.isArray(r), `refus inattendu : ${r.raison}`);
    j = r;
  }
  return j;
}
function refuse(journal, e, limite) {
  const r = appliquerBudget(journal, e);
  assert.equal(r.refuse, true, 'refus attendu');
  assert.equal(r.limite, limite, r.raison);
  assert.ok(r.raison.length > 0);
  return r;
}
// Registre avec un chantier A largement plafonné et `consomme` microdollars déjà dépensés (exécutions payées de 10 USD au plus).
function avecConsomme(consomme, d = CYCLE) {
  let j = suite(ouvrir(d), plafonner('A', 1000 * USD));
  let k = 0;
  while (consomme > 0) {
    const m = Math.min(consomme, 10 * USD);
    k += 1;
    j = suite(j, engager(`pre-${k}`, m), payer(`pre-${k}`, m));
    consomme -= m;
  }
  return j;
}

// ------------------------------------------------------------------------------------------------ ouverture
test('ouverture : un seul « cycle-ouvert », état initial en microdollars', () => {
  const j = ouvrir();
  assert.equal(j.length, 1);
  assert.deepEqual({ ...j[0] }, { n: 1, type: 'cycle-ouvert', quand: Q, donnees: CYCLE });
  const e = etatBudget(j);
  assert.equal(e.unite, 'microdollars');
  assert.equal(e.utilisable, 80_000_000);
  assert.equal(e.resteCycle, 80_000_000);
  assert.equal(e.consommeCycle, 0);
  assert.equal(e.engageCycle, 0);
  assert.equal(e.suspendu, false);
  assert.deepEqual([...e.cycles], ['2026-10']);
  assert.deepEqual(e.depassements, []);
});
test('ouverture : montants non entiers sûrs >= 0 refusés (TypeError), cycle vide refusé, « quand » exigé', () => {
  for (const v of [0.1, 1.5, 100.01, -1, '10', NaN, Infinity, 2 ** 53, null, undefined]) {
    for (const k of ['plafond', 'reserve', 'plafondRun']) assert.throws(() => ouvrirRegistre({ ...CYCLE, [k]: v }, Q), TypeError, `${k} = ${String(v)}`);
  }
  assert.throws(() => ouvrirRegistre({ ...CYCLE, cycle: ' ' }, Q), TypeError);
  assert.throws(() => ouvrirRegistre(null, Q), TypeError);
  assert.throws(() => ouvrirRegistre(CYCLE), TypeError);
  assert.equal(etatBudget(ouvrirRegistre({ ...CYCLE, plafond: 0, reserve: 0, plafondRun: 0 }, Q)).utilisable, 0);
});
test('réserve > plafond refusée ; réserve = plafond : utilisable 0, tout engagement refusé', () => {
  assert.throws(() => ouvrirRegistre({ ...CYCLE, reserve: 100 * USD + 1 }, Q), TypeError);
  const j = suite(ouvrir({ ...CYCLE, reserve: 100 * USD }), plafonner('A', 50 * USD));
  assert.equal(etatBudget(j).utilisable, 0);
  refuse(j, engager('x', 1), 'cycle');
});

// ------------------------------------------------------------------------------------------------ engagement à la borne
test('exemple de la mission : 100 USD, réserve 20, consommé 73, maximum 10 → refusé avant lancement', () => {
  const j = avecConsomme(73 * USD);
  assert.equal(etatBudget(j).consommeCycle, 73_000_000);
  const r = refuse(j, engager('x', 10 * USD), 'cycle');
  assert.match(r.raison, /73000000 \+ engagé 0 \+ maximum 10000000 = 83000000 > utilisable 80000000/);
  assert.match(r.raison, /microdollars/);
  assert.equal(appliquerBudget(j, engager('x', 7 * USD)).length, j.length + 1);
});
test('égalité exacte acceptée ; une unité (1 microdollar) au-dessus refusée', () => {
  const j = avecConsomme(70 * USD);
  refuse(j, engager('x', 10 * USD + 1), 'cycle');
  const ok = suite(j, engager('x', 10 * USD));
  assert.equal(etatBudget(ok).resteCycle, 0);
  refuse(ok, engager('y', 1), 'cycle');
  // même borne exacte au niveau du chantier et du run
  const c = suite(ouvrir(), plafonner('B', 5 * USD));
  refuse(c, engager('x', 5 * USD + 1, 'B'), 'chantier');
  assert.equal(etatBudget(suite(c, engager('x', 5 * USD, 'B'))).chantiers.B.reste, 0);
  const r = suite(ouvrir(), plafonner('A', 100 * USD));
  refuse(r, engager('x', 15 * USD + 1), 'run');
  assert.ok(Array.isArray(appliquerBudget(r, engager('x', 15 * USD))));
});
test('réserve protégée : rien consommé, 100 USD au plafond, maximum 81 refusé', () => {
  const j = suite(ouvrir({ ...CYCLE, plafondRun: 100 * USD }), plafonner('A', 100 * USD));
  refuse(j, engager('x', 81 * USD), 'cycle');
  refuse(j, engager('x', 80 * USD + 1), 'cycle');
  assert.ok(Array.isArray(appliquerBudget(j, engager('x', 80 * USD))));
});
test('plafond de chantier indépendant du plafond de cycle, dans les deux sens', () => {
  let j = suite(ouvrir(), plafonner('A', 15 * USD), plafonner('B', 500 * USD), engager('a1', 10 * USD, 'A'));
  const r = refuse(j, engager('a2', 6 * USD, 'A'), 'chantier');
  assert.match(r.raison, /chantier « A » : consommé 0 \+ engagé 10000000 \+ maximum 6000000 = 16000000 > plafond 15000000/);
  j = suite(j, engager('b1', 6 * USD, 'B'));
  assert.equal(etatBudget(j).chantiers.B.engage, 6 * USD);
  // chantier large, cycle limitant
  j = suite(j, payer('a1', 10 * USD), payer('b1', 6 * USD), ...[1, 2, 3, 4].map((k) => engager(`b${k + 1}`, 15 * USD, 'B')));
  assert.equal(etatBudget(j).resteCycle, 4 * USD);
  refuse(j, engager('b9', 5 * USD, 'B'), 'cycle');
  assert.equal(etatBudget(j).chantiers.B.reste, 500 * USD - 66 * USD);
});
test('plafond par exécution : maximum > plafondRun refusé même avec de la place partout', () => {
  const j = suite(ouvrir(), plafonner('A', 1000 * USD));
  const r = refuse(j, engager('x', 16 * USD), 'run');
  assert.match(r.raison, /maximum 16000000 > plafond par exécution 15000000/);
});
test('engagements ouverts comptés à leur maximum jusqu\'au coût réel', () => {
  const j = suite(ouvrir({ ...CYCLE, plafondRun: 50 * USD }), plafonner('A', 1000 * USD), engager('x', 50 * USD));
  const e = etatBudget(j);
  assert.equal(e.engageCycle, 50 * USD);
  assert.equal(e.resteCycle, 30 * USD);
  assert.equal(e.chantiers.A.engage, 50 * USD);
  refuse(j, engager('y', 31 * USD), 'cycle');
  const deux = suite(j, engager('y', 30 * USD));
  assert.equal(etatBudget(deux).engageCycle, 80 * USD);
  refuse(deux, engager('z', 1), 'cycle');
});
test('chantier sans plafond déclaré : refusé ; données d\'engagement invalides refusées', () => {
  const j = ouvrir();
  refuse(j, engager('x', 1, 'inconnu'), 'chantier-sans-plafond');
  const a = suite(j, plafonner('A', 10 * USD));
  for (const m of [0, -1, 1.5, '1', null, 2 ** 53]) refuse(a, engager('x', m), 'donnees');
  refuse(a, ev('engagement', { chantier: 'A', maximum: 1 }), 'donnees');
  refuse(a, ev('engagement', { execution: 'x', maximum: 1 }), 'donnees');
  refuse(a, plafonner('B', 0.5), 'donnees');
  refuse(a, plafonner('', 1), 'donnees');
  refuse(a, plafonner('__proto__', -1), 'donnees');
  // un identifiant comme « __proto__ » ou « constructor » reste un texte opaque ordinaire
  const p = suite(a, plafonner('__proto__', 3), plafonner('constructor', 4), engager('__proto__', 3, '__proto__'));
  assert.equal(etatBudget(p).chantiers.__proto__.engage, 3);
  refuse(p, engager('toString', 1, 'toString'), 'chantier-sans-plafond');
});

// ------------------------------------------------------------------------------------------------ coût réel
test('le coût réel libère l\'engagement : engagé 10, coût 2 → consommé 2, reste 78', () => {
  const j = suite(ouvrir(), plafonner('A', 50 * USD), engager('x', 10 * USD), payer('x', 2 * USD));
  const e = etatBudget(j);
  assert.equal(e.consommeCycle, 2 * USD);
  assert.equal(e.engageCycle, 0);
  assert.equal(e.resteCycle, 78 * USD);
  assert.deepEqual({ ...e.chantiers.A }, { plafond: 50 * USD, consomme: 2 * USD, engage: 0, reste: 48 * USD });
  assert.deepEqual({ ...e.executions.x }, { chantier: 'A', cycle: '2026-10', maximum: 10 * USD, statut: 'payee', montant: 2 * USD });
  assert.equal(e.suspendu, false);
});
test('aucun double engagement, aucun double coût, aucun coût sans engagement', () => {
  const j = suite(ouvrir(), plafonner('A', 50 * USD), engager('x', 10 * USD));
  refuse(j, engager('x', 1), 'doublon');
  const p = suite(j, payer('x', 3 * USD));
  refuse(p, payer('x', 3 * USD), 'doublon');
  refuse(p, payer('x', 0), 'doublon');
  refuse(p, engager('x', 1), 'doublon');
  refuse(p, payer('y', 1), 'execution-inconnue');
  assert.equal(etatBudget(p).consommeCycle, 3 * USD);
});
test('dépassement réel : coût 12 sur maximum 10 inscrit intégralement, conservé, registre suspendu', () => {
  const j = suite(ouvrir(), plafonner('A', 11 * USD), engager('x', 10 * USD), engager('y', 1 * USD), payer('x', 12 * USD));
  const e = etatBudget(j);
  assert.equal(e.executions.x.montant, 12 * USD);
  assert.equal(e.consommeCycle, 12 * USD);
  assert.equal(e.chantiers.A.consomme, 12 * USD);
  assert.equal(e.chantiers.A.reste, 0);
  assert.equal(e.suspendu, true);
  assert.deepEqual(e.depassements.map((d) => ({ ...d })), [{ execution: 'x', chantier: 'A', cycle: '2026-10', maximum: 10 * USD, montant: 12 * USD, excedent: 2 * USD }]);
  const r = refuse(j, engager('z', 1), 'suspendu');
  assert.match(r.raison, /suspendu/);
  // la réalité reste inscriptible : le coût de l'engagement encore ouvert est accepté ; la suspension demeure
  const k = suite(j, payer('y', 1 * USD), plafonner('B', 50 * USD), nouveauCycle('2026-11'));
  assert.equal(etatBudget(k).suspendu, true);
  refuse(k, engager('z', 1, 'B'), 'suspendu');
  // jamais de reste négatif, même quand le cycle est franchi
  const c = suite(ouvrir(), plafonner('A', 1000 * USD), ...[1, 2, 3, 4, 5, 6].map((n) => engager(`r${n}`, 13 * USD)), payer('r1', 20 * USD));
  assert.equal(etatBudget(c).resteCycle, 0);
  for (const v of [etatBudget(c).resteCycle, etatBudget(c).chantiers.A.reste]) assert.ok(v >= 0);
});
test('run annulé avant coût : l\'engagement compte toujours ; un coût réel de 0 est valide et libère', () => {
  const j = suite(ouvrir(), plafonner('A', 50 * USD), engager('x', 15 * USD));
  assert.equal(etatBudget(j).engageCycle, 15 * USD);
  refuse(j, ev('annulation', { execution: 'x' }), 'journal');
  const z = suite(j, payer('x', 0));
  const e = etatBudget(z);
  assert.equal(e.engageCycle, 0);
  assert.equal(e.consommeCycle, 0);
  assert.equal(e.resteCycle, 80 * USD);
  assert.equal(e.executions.x.statut, 'payee');
  assert.equal(e.suspendu, false);
});
test('montant de coût non entier, négatif ou textuel refusé', () => {
  const j = suite(ouvrir(), plafonner('A', 50 * USD), engager('x', 10 * USD));
  for (const m of [0.5, 1e-6, -1, '2', NaN, null, undefined, 2 ** 53]) refuse(j, payer('x', m), 'donnees');
  refuse(j, ev('cout', { montant: 1 }), 'donnees');
});
test('aucune valeur hors des entiers sûrs : une somme trop grande est refusée', () => {
  const G = Number.MAX_SAFE_INTEGER;
  const j = suite(ouvrir({ cycle: 'c', plafond: G, reserve: 0, plafondRun: G }), plafonner('A', G), engager('x', G - 5));
  refuse(j, engager('y', 6), 'cycle');
  const k = suite(j, engager('y', 5), payer('x', G));
  assert.equal(etatBudget(k).consommeCycle, G);
  refuse(k, payer('y', 5), 'donnees');
  assert.ok(Array.isArray(appliquerBudget(k, payer('y', 0))));
});

// ------------------------------------------------------------------------------------------------ cycles et plafonds
test('changement de cycle : refusé avec engagement ouvert ; remet le cycle à zéro, jamais le chantier', () => {
  const j = suite(ouvrir(), plafonner('A', 30 * USD), engager('x', 10 * USD), payer('x', 8 * USD), engager('y', 12 * USD));
  const r = refuse(j, nouveauCycle('2026-11'), 'engagement-ouvert');
  assert.match(r.raison, /« y »/);
  const k = suite(j, payer('y', 12 * USD), nouveauCycle('2026-11', { plafond: 60 * USD, reserve: 10 * USD }));
  const e = etatBudget(k);
  assert.equal(e.cycle, '2026-11');
  assert.equal(e.consommeCycle, 0);
  assert.equal(e.engageCycle, 0);
  assert.equal(e.utilisable, 50 * USD);
  assert.equal(e.resteCycle, 50 * USD);
  assert.deepEqual({ ...e.chantiers.A }, { plafond: 30 * USD, consomme: 20 * USD, engage: 0, reste: 10 * USD });
  assert.deepEqual([...e.cycles], ['2026-10', '2026-11']);
  refuse(k, engager('z', 10 * USD + 1), 'chantier');
  const z = suite(k, engager('z', 10 * USD));
  assert.equal(etatBudget(z).executions.z.cycle, '2026-11');
  refuse(z, nouveauCycle('2026-12'), 'engagement-ouvert');
  refuse(suite(z, payer('z', 0)), nouveauCycle('2026-10'), 'cycle-deja-utilise');
  refuse(suite(z, payer('z', 0)), nouveauCycle('2026-12', { reserve: 101 * USD }), 'donnees');
});
test('plafond de chantier déclaré deux fois refusé : aucune hausse ni baisse dans AT-2', () => {
  const j = suite(ouvrir(), plafonner('A', 10 * USD));
  refuse(j, plafonner('A', 20 * USD), 'plafond-deja-declare');
  refuse(j, plafonner('A', 5 * USD), 'plafond-deja-declare');
  refuse(j, plafonner('A', 10 * USD), 'plafond-deja-declare');
  refuse(suite(j, nouveauCycle('2026-11')), plafonner('A', 20 * USD), 'plafond-deja-declare');
});

// ------------------------------------------------------------------------------------------------ journal
test('append-only : journal reçu inchangé, rendu gelé en profondeur, objets de l\'appelant copiés, refus sans écriture', () => {
  const j = suite(ouvrir(), plafonner('A', 50 * USD));
  const avant = structuredClone(j);
  const d = { execution: 'x', chantier: 'A', maximum: 10 * USD, note: { libre: [1] } };
  const k = appliquerBudget(j, { type: 'engagement', quand: Q, donnees: d });
  assert.deepEqual(j, avant);
  assert.notEqual(k, j);
  d.maximum = 1; d.note.libre.push(2);
  assert.equal(k[2].donnees.maximum, 10 * USD);
  assert.deepEqual(k[2].donnees.note, { libre: [1] });
  assert.ok(Object.isFrozen(k) && Object.isFrozen(k[2]) && Object.isFrozen(k[2].donnees) && Object.isFrozen(k[2].donnees.note.libre));
  assert.throws(() => { k.push({}); }, TypeError);
  assert.throws(() => { k[2].donnees.maximum = 1; }, TypeError);
  assert.throws(() => { k[0].donnees.reserve = 0; }, TypeError);
  const r = appliquerBudget(k, engager('y', 99 * USD));
  assert.equal(r.refuse, true);
  assert.equal(k.length, 3);
  const e = etatBudget(k);
  assert.ok(Object.isFrozen(e) && Object.isFrozen(e.chantiers.A) && Object.isFrozen(e.executions.x) && Object.isFrozen(e.depassements));
  refuse(k, { ...engager('y', 1), n: 7 }, 'journal');
  refuse(k, null, 'journal');
});
test('rejeu et déterminisme : JSON relu → même état à chaque préfixe ; même entrée → même décision', () => {
  const j = suite(ouvrir(), plafonner('A', 30 * USD), engager('x', 10 * USD), payer('x', 11 * USD), nouveauCycle('2026-11'), plafonner('B', 5 * USD));
  for (let i = 1; i <= j.length; i += 1) {
    const p = j.slice(0, i);
    assert.deepEqual(etatBudget(JSON.parse(JSON.stringify(p))), etatBudget(p));
  }
  const e = engager('y', 1, 'B');
  assert.deepEqual(appliquerBudget(j, e), appliquerBudget(JSON.parse(JSON.stringify(j)), e));
  const m = avecConsomme(73 * USD);
  assert.deepEqual(appliquerBudget(m, engager('x', 10 * USD)), appliquerBudget(avecConsomme(73 * USD), engager('x', 10 * USD)));
  assert.deepEqual(appliquerBudget(m, engager('x', 7 * USD)), appliquerBudget(m, engager('x', 7 * USD)));
});
test('corruption détectée : trou, réécriture, premier événement, type inconnu', () => {
  const j = suite(ouvrir(), plafonner('A', 20 * USD), engager('x', 10 * USD), payer('x', 2 * USD), engager('y', 15 * USD));
  assert.deepEqual(verifierRegistre(j), { ok: true });
  const c = JSON.parse(JSON.stringify(j));
  // un coût réécrit à la hausse (2 → 10, sans dépassement) ferait refuser l'engagement suivant : 10 + 15 > 20
  c[3].donnees.montant = 10 * USD;
  const v = verifierRegistre(c);
  assert.equal(v.ok, false);
  assert.equal(v.n, 5);
  assert.match(v.raison, /chantier « A »/);
  assert.throws(() => etatBudget(c), TypeError);
  assert.equal(appliquerBudget(c, payer('y', 0)).limite, 'journal');
  const trou = JSON.parse(JSON.stringify(j)); trou.splice(2, 1);
  assert.deepEqual({ ...verifierRegistre(trou), raison: undefined }, { ok: false, n: 3, raison: undefined });
  const premier = JSON.parse(JSON.stringify(j.slice(1))).map((e, i) => ({ ...e, n: i + 1 }));
  assert.match(verifierRegistre(premier).raison, /premier événement/);
  const inconnu = JSON.parse(JSON.stringify(j)); inconnu[2].type = 'remise';
  assert.match(verifierRegistre(inconnu).raison, /inconnu/);
  const plafondTriche = JSON.parse(JSON.stringify(j)); plafondTriche[0].donnees.reserve = 101 * USD;
  assert.equal(verifierRegistre(plafondTriche).n, 1);
  for (const x of [[], null, 'x', [null]]) assert.equal(verifierRegistre(x).ok, false);
});

// ------------------------------------------------------------------------------------------------ gardes statiques
test('pureté : aucun import, aucune horloge, aucun hasard, aucune persistance, aucun réseau, aucun DOM', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['appliquerBudget', 'etatBudget', 'ouvrirRegistre', 'verifierRegistre']);
  assert.doesNotMatch(CODE, /\bimport\b|\brequire\(/);
  for (const m of [/\bDate\b/, /Math\.random/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bfetch\b/, /localStorage/, /indexedDB/, /magasin/, /lireTout/, /ecrire/, /enregistrer/, /\basync\b/, /\bawait\b/, /\bdocument\b/, /\bnavigator\b/, /\bglobalThis\b/, /\bwindow\b/, /\bprocess\b/, /performance\./]) assert.equal(m.test(CODE), false, String(m));
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  assert.ok(SRC.split('\n').length < 200);
});
test('unité : le microdollar est documenté ; aucun vocabulaire de cent, ni prix, ni modèle, ni jeton, ni API', () => {
  assert.match(SRC, /1 USD = 1 000 000 microdollars/);
  assert.doesNotMatch(SRC, /\bcents?\b|centimes?/i);
  assert.doesNotMatch(CODE, /\btokens?\b|\bjetons?\b|\bprix\b|\bopus\b|\bsonnet\b|\bhaiku\b|anthropic|\bapi\b|secret|\bcle\b/i);
});
test('dormance : hors app/atelier/, seul main.js atteint l\'atelier, par l\'import dynamique de ecran.js ; budget.js ne mentionne pas chantier.js', () => { // MISE À JOUR DÉLIBÉRÉE v0.65.3 (titre)
  // MISE À JOUR DÉLIBÉRÉE v0.65.3 (AT-4 branche l'écran de l'atelier) : la dormance totale est REMPLACÉE, non supprimée, par une preuve
  // plus étroite : hors de app/atelier/, seul app/main.js mentionne l'atelier, et seulement par l'import dynamique unique
  // « import('./atelier/ecran.js') » (aucun import statique) ; index.html ne contient que la section #atelier vide et l'entrée des Réglages ;
  // sw.js ignore toujours l'atelier.
  const dehors = fichiersJs(join(RACINE, 'app')).filter((f) => !f.startsWith(join(RACINE, 'app', 'atelier') + sep) && /chantier\.js|budget\.js|\bmission\.js|montants\.js|atelier\//.test(readFileSync(f, 'utf8'))).map((f) => relative(RACINE, f));
  assert.deepEqual(dehors, [join('app', 'main.js')]);
  const codeMain = readFileSync(join(RACINE, 'app', 'main.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  assert.deepEqual(codeMain.match(/[^\s(]*atelier\/[^\s)]*/g), ["'./atelier/ecran.js'"]);
  assert.equal(codeMain.split("import('./atelier/ecran.js')").length, 2);
  assert.doesNotMatch(codeMain, /^\s*import\b[^;(]*atelier/m);
  assert.equal(SRC.includes('chantier.js'), false);
  assert.equal(readFileSync(join(RACINE, 'app', 'sw.js'), 'utf8').includes('atelier'), false);
  const SECTION = '<section id="atelier" class="panneau" hidden aria-label="Atelier de développement">\n    <header class="entete">\n      <button type="button" class="bouton-secondaire" data-fermer-panneau>← Retour</button>\n      <h2>Atelier</h2>\n    </header>\n    <div class="contenu-reglages" data-atelier-contenu></div>\n  </section>';
  const ENTREE = '<button type="button" class="bouton-secondaire" data-ouvrir-atelier>Atelier de développement →</button>';
  const html = readFileSync(join(RACINE, 'app', 'index.html'), 'utf8');
  assert.equal(html.split(SECTION).length, 2);
  assert.equal(html.split(ENTREE).length, 2);
  // MISE À JOUR DÉLIBÉRÉE v0.66.6 (ATELIER 2, L1/L2) : l'écran « Atelier — capacités » (app/capacites/, hors de l'atelier AT-4, sans import
  // de app/atelier/) ajoute exactement sa section vide et son entrée des Réglages ; elles sont retirées avant la même recherche.
  const SECTION_CAPACITES = '<section id="capacites" class="panneau" hidden aria-label="Atelier — capacités">\n    <header class="entete">\n      <button type="button" class="bouton-secondaire" data-fermer-panneau>← Retour</button>\n      <h2>Atelier — capacités</h2>\n    </header>\n    <div class="contenu-reglages" data-capacites-contenu></div>\n  </section>';
  const ENTREE_CAPACITES = '<button type="button" class="bouton-secondaire" data-ouvrir-capacites>Atelier — capacités →</button>';
  assert.equal(html.split(SECTION_CAPACITES).length, 2);
  assert.equal(html.split(ENTREE_CAPACITES).length, 2);
  assert.doesNotMatch(html.replace(SECTION, '').replace(ENTREE, '').replace(SECTION_CAPACITES, '').replace(ENTREE_CAPACITES, ''), /atelier/i);
});
test('base cognitive inchangée : VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables', () => {
  assert.equal(VERSION_BASE, 30); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(SCHEMA_SAUVEGARDE, 20); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
  assert.equal(TABLES.length, 36); // MISE À JOUR DÉLIBÉRÉE v0.66.4 (socle C1 : + issuesRetrouvailles, VERSION_BASE 30, SCHEMA_SAUVEGARDE 20, 36 tables)
});
