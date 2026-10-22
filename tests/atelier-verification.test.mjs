// v0.65.4 — AT-5 « VÉRIFICATEUR INDÉPENDANT DES BRANCHES ATELIER » (GO « GO AT-5 v0.65.4 », 17/10/2026 ; D-007). OUTILLAGE NON
// COGNITIF — aucune acquisition. Preuves pures de app/atelier/verification.js : demande stricte (entrées injectables refusées),
// classement du diff brut (liens, sous-modules, changements de type refusés), zones permanentes IDENTIQUES à celles d'AT-3 (test
// croisé contre mission.js), faits atelier-faits-1 stricts, canoniques et à empreinte, cohérence interne, provenance main seule,
// confrontation mission ↔ faits et rapport ↔ faits, distinction impossible / non conforme, vocabulaire, pureté, dormance.
// MISE À JOUR DÉLIBÉRÉE v0.65.5 (correction AT-5, GO 17/10/2026) : faits atelier-faits-2 à trois identités (T étiquette, B base Git du
// chantier, C candidat) et segment T..B d'outillage ; le délai n'est plus figé, il est lu dans le verifier.mjs réel du dépôt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as MODULE from '../app/atelier/verification.js';
import { classerDiff, confronter, ecrireFaits, jugerIdentite, lireDemande, lireFaits, zonePermanente } from '../app/atelier/verification.js';
import { verifierRapport } from '../app/atelier/mission.js';
import { VERSION_BASE, TABLES } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ATELIER = join(RACINE, 'app', 'atelier');
const SRC = readFileSync(join(ATELIER, 'verification.js'), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const CODE = sansCommentaires(SRC);
const fichiers = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiers(p) : [p]; });
const sha256Hex = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v !== null && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v));
const signer = (o) => JSON.stringify({ ...o, empreinte: sha256Hex(canon(o)) }); // sans aucun contrôle : pour fabriquer des faits incohérents
const copie = (o) => JSON.parse(JSON.stringify(o));
// Délai réel des tests du robot : l'unique « timeout » du corps de lancerTests() de .github/workflows/verifier.mjs (jamais figé ici).
const DELAI = Number(/function lancerTests\(\)[\s\S]*?\btimeout:\s*(\d+)/.exec(readFileSync(join(RACINE, '.github', 'workflows', 'verifier.mjs'), 'utf8'))[1]);
const SEGMENT_VIDE = Object.freeze({ statut: 'etabli', commits: 0, fusions: 0, fichiers: [], refuses: [], hors_outillage: [] });

const C = 'c0ffee'.padEnd(40, '1');
const B = 'ba5e00'.padEnd(40, '2');
const MISSION = Object.freeze({ chantier: 'c', objectif: 'Objectif.', base: { sha: B, version: '0.65.3' }, jalon: { id: 'j', titre: 'Titre', comportement: 'Comportement.' }, tentative: 1, criteres: ['Critère.'], tests: ['Test.'], autorises: ['app/x.js', 'tests/'], interdits: ['tests/interdit.test.mjs'] });
const RAPPORT = Object.freeze({ protocole: 'atelier-rapport-1', chantier: 'c', jalon: 'j', tentative: 1, base: { sha: B, version: '0.65.3' }, statut: 'candidat', candidat: { branche: 'atelier/c/j/1', sha: C }, fichiers: { crees: ['app/x.js', 'tests/x.test.mjs'], modifies: [], supprimes: [] }, tests: { total: 10, reussis: 10, echecs: 0 }, divergences: [], question: null, motif: null });
const FAITS = Object.freeze({
  protocole: 'atelier-faits-2',
  demande: { branche: 'atelier/c/j/1', candidat: C, base: B, version_base: '0.65.3', version_candidat: '0.65.4' },
  provenance: { workflow_ref: 'proprio/depot/.github/workflows/atelier-verification.yml@refs/heads/main', verificateur_sha: 'a'.repeat(40), run_id: '17', depot: 'proprio/depot' },
  identite: { statut: 'etablie', branche_existe: true, branche_pointe: C, est_commit: true, base_tag: B, base_est_commit: true, tag_ancetre_base: true, base_sur_main: true, version_fichier_base: '0.65.3', base_ancetre: true, merge_base: B, commits: 1, fusions: 0, tag_candidat_libre: true, main: B, branche_pointe_fin: C, constats: [], segment: SEGMENT_VIDE },
  diff: { statut: 'etabli', fichiers: [{ chemin: 'app/x.js', etat: 'cree', mode: '100644' }, { chemin: 'tests/x.test.mjs', etat: 'cree', mode: '100644' }], refuses: [], zones_touchees: [], tests_supprimes: [], tests_modifies: [] },
  execution: { statut: 'executee', version_injectee: '0.65.4', injection_relue: true, fichiers_injectes: ['app/sw.js', 'app/version.js'], delai_ms: DELAI, code: 0, duree_tests_ms: Math.round(DELAI / 2), verifier_sha256: '1'.repeat(64), deballer_sha256: '2'.repeat(64) },
  tests: { statut: 'executes', total: 10, reussis: 10, echecs: 0, annules: 0, ignores: 0 },
  robot: { syntaxe: 'ok', json: 'ok', fumee: 'ok', erreurs: [] },
  erreurs_techniques: [],
});
const faits = (modifier = () => {}) => { const f = copie(FAITS); modifier(f); return ecrireFaits(f, sha256Hex); };
const rapport = (modifier = () => {}) => { const r = copie(RAPPORT); modifier(r); return JSON.stringify(r); };
const conf = (f = faits(), r = rapport(), m = MISSION) => confronter({ mission: m, rapport: r, faits: f, hacherSha256: sha256Hex });
const RESULTATS = [];
const verdict = (res) => { RESULTATS.push(res); return res.verdict_technique; };
const CONF = 'verification-technique-conforme';
const NC = 'verification-technique-non-conforme';
const IMP = 'verification-impossible';
const refuser = (f) => {
  f.identite.statut = 'refusee'; f.diff = { ...f.diff, statut: 'non-calcule', fichiers: [], zones_touchees: [] };
  f.execution = { statut: 'non-lancee', version_injectee: null, injection_relue: false, fichiers_injectes: [], delai_ms: null, code: null, duree_tests_ms: null, verifier_sha256: null, deballer_sha256: null };
  f.tests = { statut: 'non-lances', total: null, reussis: null, echecs: null, annules: null, ignores: null };
  f.robot = { syntaxe: 'non-lancee', json: 'non-lancee', fumee: 'non-lancee', erreurs: [] };
};

// ------------------------------------------------------------------------------------------------ chaîne nominale
test('exports exacts ; candidat cohérent avec ses faits : vérification technique conforme, résultat gelé et déterministe', () => {
  assert.deepEqual(Object.keys(MODULE).sort(), ['classerDiff', 'confronter', 'ecrireFaits', 'jugerIdentite', 'lireDemande', 'lireFaits', 'zonePermanente']);
  const res = conf();
  assert.equal(verdict(res), CONF, JSON.stringify(res));
  assert.deepEqual(Object.keys(res), ['protocole', 'verdict_technique', 'identite', 'diff', 'frontieres', 'tests', 'robot', 'rapport', 'divergences_rapport', 'a_examiner', 'raisons_non_conformite', 'raisons_impossibilite']);
  assert.deepEqual([res.protocole, res.identite, res.diff, res.frontieres, res.tests, res.robot, res.rapport], ['atelier-confrontation-1', 'verifiee', 'verifie', 'respectees', 'executes-sans-echec', 'sans-erreur', 'concordant']);
  assert.equal(Object.isFrozen(res) && Object.isFrozen(res.raisons_non_conformite), true);
  assert.deepEqual(conf(), res);
  assert.equal(faits(), faits());
});

// ------------------------------------------------------------------------------------------------ format des faits
test('faits : texte canonique (clés triées), empreinte sur la forme canonique, indifférent aux espaces et à l\'ordre des clés', () => {
  const t = faits();
  const f = JSON.parse(t);
  assert.deepEqual(Object.keys(f), [...Object.keys(f)].sort());
  assert.match(f.empreinte, /^[0-9a-f]{64}$/);
  const { empreinte, ...sans } = f;
  assert.equal(empreinte, sha256Hex(canon(sans)));
  assert.equal(lireFaits(JSON.stringify(f), sha256Hex).faits.empreinte, empreinte);
  const inverse = Object.fromEntries(Object.entries(f).reverse());
  assert.equal(verdict(conf(` \n${JSON.stringify(inverse, null, 4)}\n\n`)), CONF);
  assert.throws(() => ecrireFaits({ ...copie(FAITS), empreinte: 'x' }, sha256Hex), /sans empreinte/);
  assert.throws(() => ecrireFaits(copie(FAITS)), /hacherSha256/);
});

test('sabotages des faits : tronqués, clé inconnue, clé absente, clé en double, empreinte fausse, valeur hors protocole -> impossible', () => {
  const t = faits();
  const cas = [
    t.slice(0, t.length / 2), t.slice(0, -3), '', '[]', 'null',
    t.replace('"protocole"', '"intrus": 1,\n  "protocole"'),
    t.replace('"constats": []', '"constats": [], "note": "x"'),
    t.replace(/"fumee": "ok",\n\s*/, ''),
    t.replace('"protocole": "atelier-faits-2"', '"protocole": "atelier-faits-2", "protocole": "atelier-faits-2"'),
    t.replace('"total": 10', '"total": 11'),
    t.replace('"atelier-faits-2"', '"atelier-faits-3"'),
    signer({ ...copie(FAITS), tests: { ...FAITS.tests, total: '10' } }),
    signer({ ...copie(FAITS), diff: { ...FAITS.diff, fichiers: [{ chemin: '../x', etat: 'cree', mode: '100644' }] } }),
  ];
  for (const x of cas) {
    const res = conf(x);
    assert.equal(verdict(res), IMP, x.slice(0, 60));
    assert.match(res.raisons_impossibilite[0], /^faits illisibles : /);
  }
  assert.match(conf(t.replace('"total": 10', '"total": 11')).raisons_impossibilite[0], /empreinte : ne correspond pas/);
  assert.match(conf(cas[8]).raisons_impossibilite[0], /clé en double « protocole »/);
  assert.match(conf(cas[5]).raisons_impossibilite[0], /clé inconnue intrus/);
});

test('sabotage : mauvaise version injectée (faits signés mais incohérents) -> impossible ; ecrireFaits refuse de les produire', () => {
  const f = copie(FAITS);
  f.execution.version_injectee = '0.65.5';
  assert.throws(() => ecrireFaits(f, sha256Hex), /version_injectee/);
  const res = conf(signer(f));
  assert.equal(verdict(res), IMP);
  assert.match(res.raisons_impossibilite[0], /version_injectee : "0\.65\.5" ≠ version demandée 0\.65\.4/);
  const g = copie(FAITS);
  g.execution.injection_relue = false;
  assert.equal(verdict(conf(signer(g))), IMP);
});

test('faits incohérents signés : identité « établie » malgré une merge-base fausse, constats inventés, diff et listes discordants -> impossible', () => {
  const cas = [
    (f) => { f.identite.merge_base = C; },
    (f) => { f.identite.constats = ['inventé']; },
    (f) => { f.diff.zones_touchees = ['app/x.js']; },
    (f) => { f.diff.statut = 'vide'; },
    (f) => { f.diff.fichiers.push({ chemin: 'tests/y.test.mjs', etat: 'supprime', mode: '100644' }); },
    (f) => { f.tests.echecs = 1; },
    (f) => { f.tests.statut = 'echec'; },
    (f) => { f.execution.statut = 'non-lancee'; },
    (f) => { refuser(f); f.identite.constats = []; },
    (f) => { f.identite.statut = 'non-etablie'; },
  ];
  for (const modifier of cas) {
    const f = copie(FAITS);
    modifier(f);
    assert.throws(() => ecrireFaits(f, sha256Hex), TypeError, modifier.toString());
    assert.equal(verdict(conf(signer(f))), IMP, modifier.toString());
  }
});

test('provenance : seul atelier-verification.yml lancé depuis refs/heads/main est reçu', () => {
  for (const ref of ['proprio/depot/.github/workflows/atelier-verification.yml@refs/heads/atelier/c/j/1', 'proprio/depot/.github/workflows/robot.yml@refs/heads/main',
    'proprio/depot/.github/workflows/atelier-verification.yml@refs/pull/3/merge', 'local (hors GitHub Actions)', 'x/.github/workflows/atelier-verification.yml@refs/heads/main']) {
    const res = conf(faits((f) => { f.provenance.workflow_ref = ref; }));
    assert.equal(verdict(res), IMP, ref);
    assert.match(res.raisons_impossibilite[0], /provenance non reconnue/);
  }
});

test('faits d\'une autre demande (branche, base, version de base, candidat annoncé) -> impossible, jamais conforme', () => {
  assert.match(conf(faits(), rapport(), { ...MISSION, tentative: 2 }).raisons_impossibilite[0], /autre demande : branche/);
  assert.match(conf(faits(), rapport(), { ...MISSION, base: { sha: C, version: '0.65.3' } }).raisons_impossibilite[0], /autre demande : base/);
  assert.match(conf(faits(), rapport(), { ...MISSION, base: { sha: B, version: '0.65.2' } }).raisons_impossibilite[0], /autre demande : base/);
  const res = conf(faits(), rapport((r) => { r.candidat.sha = 'd'.repeat(40); }));
  assert.equal(verdict(res), IMP);
  assert.match(res.raisons_impossibilite[0], /le rapport annonce d{40}/);
  assert.match(conf(faits(), rapport(), { ...MISSION, autorises: [] }).raisons_impossibilite[0], /mission illisible/);
});

// ------------------------------------------------------------------------------------------- impossible / non conforme
test('distinction : « impossible » = faits insuffisants ; « non conforme » = faits établis montrant un écart', () => {
  const tech = (f) => { f.erreurs_techniques = ['panne réseau']; };
  assert.equal(verdict(conf(faits((f) => { f.identite.statut = 'non-etablie'; f.diff = { ...f.diff, statut: 'non-etabli', fichiers: [] }; f.execution = copie(FAITS).execution; refuser(f); f.identite.statut = 'non-etablie'; f.diff.statut = 'non-etabli'; tech(f); }))), IMP);
  assert.equal(verdict(conf(faits(tech))), IMP);
  const crash = conf(faits((f) => { f.tests = { statut: 'crash', total: null, reussis: null, echecs: null, annules: null, ignores: null }; }));
  assert.deepEqual([verdict(crash), crash.raisons_impossibilite[0]], [IMP, 'exécution des tests interrompue (crash du vérificateur ou de la suite)']);
  const absent = conf(faits((f) => { f.tests = { statut: 'resume-absent', total: null, reussis: null, echecs: null, annules: null, ignores: null }; }));
  assert.deepEqual([verdict(absent), absent.raisons_impossibilite[0]], [IMP, 'résumé des tests absent : comptes réels inconnus']);
  const rouge = conf(faits((f) => { f.tests = { ...f.tests, statut: 'echec', reussis: 9, echecs: 1 }; }));
  assert.equal(verdict(rouge), NC);
  assert.equal(rouge.tests, 'en-echec');
  const delai = conf(faits((f) => { f.tests = { statut: 'delai-depasse', total: null, reussis: null, echecs: null, annules: null, ignores: null }; }));
  assert.deepEqual([verdict(delai), delai.tests], [NC, 'delai-depasse']);
  assert.ok(delai.raisons_non_conformite[0].includes(`délai du vérificateur du robot dépassé (${DELAI} ms)`), delai.raisons_non_conformite[0]);
  assert.notEqual(delai.raisons_non_conformite[0], rouge.raisons_non_conformite[0]);
  const zoneEtPanne = conf(faits((f) => { tech(f); f.diff.fichiers.push({ chemin: 'sw.js', etat: 'modifie', mode: '100644' }); f.diff.fichiers.sort((a, b) => (a.chemin < b.chemin ? -1 : 1)); f.diff.zones_touchees = ['sw.js']; }));
  assert.equal(verdict(zoneEtPanne), NC, 'un écart établi reste un écart même avec une panne ailleurs');
  assert.deepEqual(zoneEtPanne.raisons_impossibilite, ['erreur technique : panne réseau']);
  const robot = conf(faits((f) => { f.robot = { syntaxe: 'ok', json: 'ok', fumee: 'erreur', erreurs: ['erreur JavaScript dans la page : x'] }; }));
  assert.deepEqual([verdict(robot), robot.robot], [NC, 'en-erreur']);
  assert.equal(verdict(conf(faits((f) => { f.robot.fumee = 'non-lancee'; }))), IMP);
  const exec = conf(faits((f) => { refuser(f); f.identite.statut = 'etablie'; f.diff = copie(FAITS).diff; f.execution.statut = 'impossible'; tech(f); }));
  assert.equal(verdict(exec), IMP);
});

test('identité : chaque constat de jugerIdentite rend la vérification non conforme', () => {
  const D = FAITS.demande;
  const cas = [
    [{ branche_existe: false, branche_pointe: null }, /absente du dépôt/],
    [{ branche_pointe: 'e'.repeat(40) }, /pas sur le candidat demandé/],
    [{ est_commit: false }, /n'est pas un commit/],
    [{ base_tag: null, segment: { ...SEGMENT_VIDE, statut: 'non-calcule' } }, /étiquette v0\.65\.3 absente/],
    [{ base_tag: C, tag_ancetre_base: false, segment: { ...SEGMENT_VIDE, statut: 'non-calcule' } }, /l'étiquette v0\.65\.3 \(c0ffee1+\) n'est ni la base b+a5e0+2+ ni un ancêtre/],
    [{ tag_ancetre_base: false, segment: { ...SEGMENT_VIDE, statut: 'non-calcule' } }, /n'est ni la base .* ni un ancêtre de cette base/],
    [{ base_sur_main: false }, /n'est ni la tête de main \(ba5e0+2+\) ni un ancêtre de cette tête/],
    [{ base_est_commit: false }, /n'est pas un commit présent dans le dépôt/],
    [{ segment: { ...SEGMENT_VIDE, commits: 2, fusions: 1, fichiers: [{ chemin: '.github/workflows/o.yml', etat: 'modifie', mode: '100644' }] } }, /segment v0\.65\.3\.\.base : 1 commit\(s\) de fusion/],
    [{ segment: { ...SEGMENT_VIDE, commits: 1, fichiers: [{ chemin: 'app/x.js', etat: 'modifie', mode: '100644' }], hors_outillage: ['app/x.js'] } }, /« app\/x\.js » hors de \.github\/workflows\//],
    [{ segment: { ...SEGMENT_VIDE, commits: 1, refuses: [{ chemin: '.github/workflows/l', mode: '120000', motif: 'lien symbolique' }] } }, /« \.github\/workflows\/l » refusé \(lien symbolique, mode 120000\)/],
    [{ version_fichier_base: '0.65.2' }, /VERSION de la base/],
    [{ base_ancetre: false, merge_base: 'e'.repeat(40) }, /n'est pas un ancêtre/],
    [{ fusions: 2 }, /2 commit\(s\) de fusion/],
    [{ commits: 0 }, /aucun commit/],
    [{ tag_candidat_libre: false }, /v0\.65\.4 existe déjà/],
    [{ branche_pointe_fin: 'e'.repeat(40) }, /branche déplacée pendant la vérification/],
    [{ branche_pointe_fin: null }, /absente à la fin/],
  ];
  assert.deepEqual(jugerIdentite(D, FAITS.identite), []);
  for (const [modif, motif] of cas) {
    const constats = jugerIdentite(D, { ...FAITS.identite, ...modif });
    assert.ok(constats.some((c) => motif.test(c)), `${motif} ${constats}`);
    const res = conf(faits((f) => { refuser(f); Object.assign(f.identite, modif, { constats }); }));
    assert.deepEqual([verdict(res), res.identite], [NC, 'non-conforme'], motif.source);
    assert.ok(res.raisons_non_conformite.some((r) => motif.test(r)));
  }
});

// ------------------------------------------------------------------------------------------- mission ↔ faits, rapport ↔ faits
test('frontières : zone permanente, interdit du jalon, hors périmètre, test supprimé -> non conforme ; test modifié -> à examiner seulement', () => {
  const avec = (...ajouts) => faits((f) => {
    f.diff.fichiers.push(...ajouts);
    f.diff.fichiers.sort((a, b) => (a.chemin < b.chemin ? -1 : 1));
    f.diff.zones_touchees = f.diff.fichiers.map((x) => x.chemin).filter(zonePermanente).sort();
    f.diff.tests_supprimes = f.diff.fichiers.filter((x) => x.etat === 'supprime' && x.chemin.startsWith('tests/')).map((x) => x.chemin);
    f.diff.tests_modifies = f.diff.fichiers.filter((x) => x.etat === 'modifie' && x.chemin.startsWith('tests/')).map((x) => ({ chemin: x.chemin, marque_mise_a_jour: x.chemin.includes('marque') }));
  });
  const fichier = (chemin, etat = 'modifie') => ({ chemin, etat, mode: '100644' });
  for (const [x, motif] of [[fichier('.github/workflows/robot.yml'), /zone permanente touchée : « \.github\/workflows\/robot\.yml »/], [fichier('App/SW.js'), /zone permanente touchée/],
    [fichier('tests/interdit.test.mjs'), /interdit pour ce jalon/], [fichier('app/y.js', 'cree'), /hors du périmètre autorisé : « app\/y\.js »/],
    [fichier('tests/ancien.test.mjs', 'supprime'), /test existant supprimé : « tests\/ancien\.test\.mjs »/]]) {
    const res = conf(avec(x));
    assert.deepEqual([verdict(res), res.frontieres], [NC, 'violees'], motif.source);
    assert.ok(res.raisons_non_conformite.some((r) => motif.test(r)), motif.source);
  }
  const r2 = (f) => rapport((r) => { r.fichiers.modifies = f; });
  const modifie = conf(avec(fichier('tests/garde.test.mjs'), fichier('tests/marque.test.mjs')), r2(['tests/garde.test.mjs', 'tests/marque.test.mjs']));
  assert.equal(verdict(modifie), CONF);
  assert.deepEqual(modifie.a_examiner, [
    'test existant modifié : « tests/garde.test.mjs » ; AUCUN de ses ajouts ne porte « MISE À JOUR DÉLIBÉRÉE » (indice seulement, revue humaine nécessaire)',
    'test existant modifié : « tests/marque.test.mjs » ; ses ajouts portent « MISE À JOUR DÉLIBÉRÉE » (indice seulement, revue humaine nécessaire)',
  ]);
});

test('diff : vide ou refusé (lien, sous-module) -> non conforme ; non établi -> impossible', () => {
  const vide = conf(faits((f) => { f.diff = { ...f.diff, statut: 'vide', fichiers: [] }; f.execution = copie(FAITS).execution; refuser(f); f.identite.statut = 'etablie'; f.diff.statut = 'vide'; }));
  assert.deepEqual([verdict(vide), vide.diff], [NC, 'non-conforme']);
  const lien = conf(faits((f) => { refuser(f); f.identite.statut = 'etablie'; f.diff = { ...FAITS.diff, statut: 'refuse', refuses: [{ chemin: 'app/l', mode: '120000', motif: 'lien symbolique' }] }; }));
  assert.equal(verdict(lien), NC);
  assert.ok(lien.raisons_non_conformite.includes('diff : « app/l » refusé (lien symbolique, mode 120000)'));
  const non = conf(faits((f) => { refuser(f); f.identite.statut = 'etablie'; f.diff = { ...f.diff, statut: 'non-etabli' }; f.erreurs_techniques = ['git diff impossible']; }));
  assert.equal(verdict(non), IMP);
});

test('rapport ↔ faits : A déclaré / A + B réels, état déclaré faux, fichier inventé, comptes faux -> non conforme ; rapport seul ne fait jamais foi', () => {
  const cas = [
    [(r) => { r.fichiers.crees = ['app/x.js']; }, ['« tests/x.test.mjs » cree selon Git, non déclaré par le rapport']],
    [(r) => { r.fichiers.crees = ['tests/x.test.mjs']; r.fichiers.modifies = ['app/x.js']; }, ['« app/x.js » déclaré modifie, Git le montre cree']],
    [(r) => { r.fichiers.crees.push('app/z.js'); }, null],
    [(r) => { r.tests = { total: 12, reussis: 12, echecs: 0 }; }, ['tests.total : le rapport annonce 12, l\'exécution réelle compte 10', 'tests.reussis : le rapport annonce 12, l\'exécution réelle compte 10']],
  ];
  for (const [modifier, attendu] of cas) {
    const res = conf(faits(), rapport(modifier));
    assert.equal(verdict(res), NC);
    if (attendu) assert.deepEqual(res.divergences_rapport, attendu);
  }
  const vide = conf(faits(), rapport((r) => { r.fichiers.crees = ['app/x.js', 'tests/x.test.mjs', 'tests/fantome.test.mjs']; }));
  assert.deepEqual(vide.divergences_rapport, ['« tests/fantome.test.mjs » déclaré cree, absent du diff réel']);
  for (const r of ['', '{}', rapport((x) => { x.statut = 'bloque'; x.candidat = null; x.tests = null; x.question = 'Q ?'; }), rapport((x) => { x.statut = 'echec'; x.candidat = null; x.tests = null; x.motif = 'M.'; })]) {
    const res = conf(faits(), r);
    assert.deepEqual([verdict(res), res.rapport], [NC, 'non-conforme']);
  }
});

// ------------------------------------------------------------------------------------------------ entrées
test('lireDemande : stricte ; entrées injectables, versions non croissantes, candidat = base refusés', () => {
  const D = { branche: 'atelier/c/j/1', candidat: C, base: B, version_base: '0.65.3', version_candidat: '0.65.4' };
  assert.deepEqual(lireDemande(D).demande, D);
  assert.equal(Object.isFrozen(lireDemande(D)), true);
  assert.deepEqual(lireDemande({ ...D, version_candidat: '1.0.0', version_base: '0.99.99' }).demande.version_candidat, '1.0.0');
  for (const b of ['atelier/c/j/1;id', 'atelier/c/$(id)/1', 'atelier/../j/1', 'atelier/c j/k/1', 'atelier/C/j/1', 'atelier/c/j/0', 'atelier/c/j/1000', 'atelier/c/j/01',
    'atelier/c/j/1/x', 'atelier/-c/j/1', 'atelier/c/j-/1', `atelier/${'a'.repeat(41)}/j/1`, 'refs/heads/atelier/c/j/1', 'main', 'atelier/c/j/1\n', 'atelier/c/j/1 ', '`id`', 1]) {
    assert.match(lireDemande({ ...D, branche: b }).raison, /demande\.branche/, String(b));
  }
  for (const [k, v] of [['candidat', 'C'.repeat(40)], ['candidat', '-c'], ['base', 'b'.repeat(39)], ['version_base', '0.65'], ['version_candidat', '0.65.04'],
    ['version_candidat', '0.65.3'], ['version_candidat', '0.64.9'], ['candidat', B]]) {
    assert.ok(lireDemande({ ...D, [k]: v }).raison, `${k}=${v}`);
  }
  assert.match(lireDemande({ ...D, x: 1 }).raison, /clé inconnue x/);
  assert.match(lireDemande({ branche: D.branche }).raison, /clé absente/);
});

test('classerDiff : créé / modifié / supprimé / mode exécutable ; liens, sous-modules, changements de type, modes inconnus refusés', () => {
  const z = (...l) => `${l.join('\0')}\0`;
  const h1 = '1'.repeat(40);
  const h0 = '0'.repeat(40);
  const ligne = (a, b, s) => `:${a} ${b} ${s === 'A' ? h0 : h1} ${s === 'D' ? h0 : h1} ${s}`;
  const r = classerDiff(z(ligne('000000', '100644', 'A'), 'b/n.js', ligne('100644', '100755', 'M'), 'a/x.sh', ligne('100644', '000000', 'D'), 'a/ancien.js',
    ligne('000000', '120000', 'A'), 'lien', ligne('000000', '160000', 'A'), 'sous', ligne('100644', '120000', 'T'), 'type', ligne('000000', '040000', 'A'), 'arbre'));
  assert.deepEqual(r.fichiers, [{ chemin: 'a/ancien.js', etat: 'supprime', mode: '100644' }, { chemin: 'a/x.sh', etat: 'modifie', mode: '100755' }, { chemin: 'b/n.js', etat: 'cree', mode: '100644' }]);
  assert.deepEqual(r.refuses, [{ chemin: 'arbre', mode: '040000', motif: 'mode 040000 inconnu' }, { chemin: 'lien', mode: '120000', motif: 'lien symbolique' },
    { chemin: 'sous', mode: '160000', motif: 'sous-module' }, { chemin: 'type', mode: '120000', motif: 'lien symbolique' }]);
  assert.deepEqual(classerDiff(''), { fichiers: [], refuses: [] });
  assert.deepEqual(classerDiff(z(ligne('100644', '100755', 'T'), 't')).refuses[0].motif, 'changement de type');
  for (const mauvais of [z(ligne('100644', '100644', 'R'), 'x'), z(ligne('100644', '100644', 'M')), `${ligne('100644', '100644', 'M')}\0x`, z('M\tx', 'x'), z(ligne('100644', '100644', 'M'), '../x'),
    z(ligne('100644', '100644', 'M'), '/x'), z(ligne('100644', '100644', 'M'), 'x', ligne('100644', '100644', 'M'), 'x'), z(ligne('100644', '100644', 'A'), 'x'), 5]) {
    assert.ok(classerDiff(mauvais).raison, JSON.stringify(mauvais));
  }
});

// ------------------------------------------------------------------------------------------- v0.65.5 : trois identités
const T = '7a9000'.padEnd(40, '3');
const OUTIL = Object.freeze({ chemin: '.github/workflows/atelier-verification.yml', etat: 'cree', mode: '100644' });
const avecSegment = (f, sg) => { f.identite.base_tag = T; f.identite.segment = { ...SEGMENT_VIDE, ...sg }; };

test('trois identités : T étiquette, B base Git du chantier, C candidat ; segment d\'outillage -> conforme et signalé à examiner, jamais caché', () => {
  const res = conf(faits((f) => avecSegment(f, { commits: 1, fichiers: [OUTIL] })));
  assert.equal(verdict(res), CONF, JSON.stringify(res));
  assert.deepEqual(res.a_examiner, [`segment d'outillage hors colis entre l'étiquette v0.65.3 et la base ${B} : 1 commit(s) ; fichiers : .github/workflows/atelier-verification.yml (il n'appartient pas au candidat et n'est pas une version ; revue humaine nécessaire)`]);
  assert.deepEqual(conf().a_examiner, [], 'B = T : segment vide, rien à examiner');
  const lu = lireFaits(faits((f) => avecSegment(f, { commits: 1, fichiers: [OUTIL] })), sha256Hex).faits;
  assert.deepEqual(lu.identite.segment.fichiers, [OUTIL], 'le segment est conservé dans les faits');
  assert.deepEqual([lu.demande.base, lu.identite.base_tag], [B, T]);
});

test('sabotages du segment dans les faits : listes falsifiées, segment non calculé renseigné, segment sans étiquette ancêtre -> impossible', () => {
  const cas = [
    (f) => { avecSegment(f, { commits: 1, fichiers: [{ chemin: 'app/y.js', etat: 'modifie', mode: '100644' }], hors_outillage: [] }); },
    (f) => { avecSegment(f, { commits: 1, fichiers: [OUTIL], hors_outillage: [OUTIL.chemin] }); },
    (f) => { avecSegment(f, { statut: 'non-calcule', commits: 1, fichiers: [OUTIL] }); },
    (f) => { avecSegment(f, { commits: 1, fichiers: [OUTIL] }); f.identite.tag_ancetre_base = false; f.identite.constats = jugerIdentite(f.demande, f.identite); },
    (f) => { avecSegment(f, { commits: 0, fichiers: [OUTIL] }); },
    (f) => { avecSegment(f, { commits: 1, fichiers: [OUTIL, OUTIL] }); },
    (f) => { avecSegment(f, { statut: 'non-calcule' }); },
    (f) => { delete f.identite.segment.hors_outillage; },
  ];
  for (const modifier of cas) {
    const f = copie(FAITS);
    modifier(f);
    assert.throws(() => ecrireFaits(f, sha256Hex), TypeError, modifier.toString());
    assert.equal(verdict(conf(signer(f))), IMP, modifier.toString());
  }
  const t = faits((f) => avecSegment(f, { commits: 1, fichiers: [OUTIL] }));
  const retouche = conf(t.replace('.github/workflows/atelier-verification.yml', '.github/workflows/autre.yml'));
  assert.equal(verdict(retouche), IMP);
  assert.match(retouche.raisons_impossibilite[0], /empreinte : ne correspond pas/);
});

test('protocole : des faits atelier-faits-1 présentés au lecteur atelier-faits-2 sont refusés proprement (impossible, motif explicite)', () => {
  const ancien = copie(FAITS);
  ancien.protocole = 'atelier-faits-1';
  delete ancien.identite.segment;
  for (const k of ['base_est_commit', 'tag_ancetre_base', 'base_sur_main']) delete ancien.identite[k];
  const res = conf(signer(ancien));
  assert.equal(verdict(res), IMP);
  assert.equal(res.raisons_impossibilite[0], 'faits illisibles : protocole atelier-faits-1 périmé : atelier-faits-2 attendu (relancer la vérification avec le lanceur actuel)');
  assert.throws(() => ecrireFaits({ ...copie(FAITS), protocole: 'atelier-faits-1' }, sha256Hex), /périmé/);
});

test('marge de délai : au-delà de 80 % du délai réel, information dans a_examiner seulement ; le verdict ne change jamais', () => {
  const avecDuree = (d) => conf(faits((f) => { f.execution.duree_tests_ms = d; }));
  const proche = avecDuree(Math.floor(DELAI * 0.97));
  assert.equal(verdict(proche), CONF);
  assert.deepEqual(proche.raisons_non_conformite, []);
  assert.equal(proche.a_examiner.length, 1);
  assert.equal(proche.a_examiner[0], `marge de délai faible : durée des tests ${Math.floor(DELAI * 0.97)} ms, soit ${Math.floor((Math.floor(DELAI * 0.97) * 100) / DELAI)} % du délai de ${DELAI} ms du robot (information seulement)`);
  assert.deepEqual(avecDuree(Math.floor(DELAI * 0.8)).a_examiner, [], 'exactement 80 % : rien');
  assert.deepEqual(avecDuree(Math.floor(DELAI * 0.8) + 1).a_examiner.length, 1);
  const rouge = conf(faits((f) => { f.execution.duree_tests_ms = DELAI - 1; f.tests = { ...f.tests, statut: 'echec', reussis: 9, echecs: 1 }; }));
  assert.equal(verdict(rouge), NC);
  assert.deepEqual(rouge.raisons_non_conformite, ['tests réels en échec : 1 échec(s), 0 annulé(s) sur 10', 'rapport divergent des faits : 2 écart(s)']);
});

test('outillage : constante identique dans verification.js et le lanceur, incluse dans ce que le robot exclut de tout colis, siège réel du robot', () => {
  const lire = (s) => [...s.matchAll(/^const OUTILLAGE = '([^']*)';$/gm)].map((m) => m[1]);
  const lanceur = readFileSync(join(RACINE, 'outils-atelier', 'verifier-candidat.mjs'), 'utf8');
  assert.deepEqual(lire(SRC), ['.github/workflows/']);
  assert.deepEqual(lire(lanceur), lire(SRC));
  const py = readFileSync(join(RACINE, '.github', 'workflows', 'deballer.py'), 'utf8');
  const dossiers = /^DOSSIERS_INTERDITS = \(([^)]*)\)$/m.exec(py)[1].match(/"([^"]+)"/g).map((x) => x.slice(1, -1));
  const [racine] = lire(SRC)[0].split('/');
  assert.ok(dossiers.includes(racine), `${racine} doit être exclu des colis par le robot`);
  assert.equal(zonePermanente(`${lire(SRC)[0]}x.yml`), true, 'un candidat ne peut jamais toucher l\'outillage');
  for (const f of ['deballer.py', 'verifier.mjs', 'robot.yml', 'atelier-verification.yml']) assert.equal(statSync(join(RACINE, ...lire(SRC)[0].split('/').filter(Boolean), f)).isFile(), true, f);
});

// ------------------------------------------------------------------------------------------------ zones permanentes
test('zones permanentes : jugement IDENTIQUE à celui d\'AT-3 (mission.js, boîte noire) sur chaque zone et ses voisins autorisés', () => {
  // Oracle d'AT-3 : verifierRapport signale « zone permanente interdite » AVANT tout autre contrôle de chemin.
  const sha = 'f'.repeat(40);
  const m = { chantier: 'x', objectif: 'o', base: { sha, version: '1.0.0' }, jalon: { id: 'j', titre: 't', comportement: 'c' }, tentative: 1, criteres: ['c'], tests: ['t'], autorises: ['outils/'] };
  const at3 = (p) => {
    const r = JSON.stringify({ protocole: 'atelier-rapport-1', chantier: 'x', jalon: 'j', tentative: 1, base: { sha, version: '1.0.0' }, statut: 'echec', candidat: null, fichiers: { crees: [p], modifies: [], supprimes: [] }, tests: null, divergences: [], question: null, motif: 'm' });
    const v = verifierRapport(m, r);
    return v.structure === 'non-conforme' && v.raison === `fichiers : « ${p} » est dans une zone permanente interdite`;
  };
  const zones = ['.git', '.github', 'signature', 'android', 'node_modules', 'VERSION', 'ETAT.md', 'app/version.js', 'sw.js', 'app/sw.js', 'x.zip'];
  const corpus = new Set(['a.zip', 'colis-0_65_4.zip', 'A.ZIP', 'dossier/a.zip', 'app/colis.zip', 'zip', 'a.zip.txt', 'a.zipx', '.zip', 'version', 'Version', 'VERSIONS', 'VERSION.md',
    'etat.md', 'ETAT.MD', 'ETAT.md.bak', 'app/ETAT.md', 'docs/VERSION', 'app/version.json', 'app/version.js.map', 'app/versions.js', 'App/Version.JS', 'tests/app/version.js',
    'sw.js.map', 'app/sw.json', 'app/SW.JS', 'app/sous/sw.js', 'sw.mjs', 'github/x', '.github2/x', '.githubx', 'x/.github/y', '.gitignore', '.gitattributes', '.git/x', '.GIT/x',
    'signatures/x', 'signature.txt', 'app/signature/x', 'SIGNATURE/x', 'androidx/y', 'app/android/x', 'Android/x', 'node_modules2/x', 'app/node_modules/x', 'NODE_MODULES/x', 'tests/x.test.mjs']);
  for (const z of zones) for (const v of [z, z.toUpperCase(), z.toLowerCase(), `${z}/x`, `${z}/a/b.js`, `${z}x`, `x${z}`, `a/${z}`, `${z}.bak`, `${z}/`]) corpus.add(v);
  let zonesVues = 0;
  for (const p of corpus) {
    if (!/^[A-Za-z0-9._/-]+$/.test(p) || p.endsWith('/') || p.split('/').some((s) => s === '' || s === '.' || s === '..')) continue;
    assert.equal(zonePermanente(p), at3(p), p);
    if (zonePermanente(p)) zonesVues += 1;
  }
  assert.ok(zonesVues >= 40 && corpus.size >= 130, `${zonesVues} / ${corpus.size}`);
});

test('zones permanentes : couvrent au moins les interdictions du robot (deballer.py, lu tel quel)', () => {
  const py = readFileSync(join(RACINE, '.github', 'workflows', 'deballer.py'), 'utf8');
  const dossiers = /^DOSSIERS_INTERDITS = \(([^)]*)\)$/m.exec(py)[1].match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  assert.deepEqual(dossiers.sort(), ['.git', '.github', 'android', 'node_modules', 'signature']);
  for (const d of dossiers) assert.equal(zonePermanente(`${d}/x`), true, d);
  assert.match(py, /^FICHIERS_INTERDITS = \(FICHIER_ETAT\.lower\(\), FICHIER_VERSION\.lower\(\)\)$/m);
  for (const f of ['ETAT.md', 'VERSION', 'colis.zip']) assert.equal(zonePermanente(f), true, f);
});

// ------------------------------------------------------------------------------------------------ gardes statiques
test('vocabulaire : jamais « accepté », « validé », « acquis » dans le module ni dans aucun résultat produit', () => {
  const interdit = /accept|\bvalid|acqui/i;
  assert.doesNotMatch(CODE, interdit);
  assert.doesNotMatch(sansCommentaires(readFileSync(join(RACINE, 'outils-atelier', 'verifier-candidat.mjs'), 'utf8')), interdit);
  assert.ok(RESULTATS.length >= 60, String(RESULTATS.length));
  for (const r of RESULTATS) assert.doesNotMatch(JSON.stringify(r), interdit);
  assert.deepEqual([...new Set(RESULTATS.map((r) => r.verdict_technique))].sort(), [IMP, CONF, NC].sort());
});

test('pureté : seul import ./mission.js ; hachage injecté ; aucune horloge, aucun hasard, aucune entrée/sortie, aucun réseau', () => {
  assert.deepEqual([...CODE.matchAll(/^\s*import\b[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]), ['./mission.js']);
  assert.doesNotMatch(CODE, /\bimport\(|\brequire\(/);
  for (const m of [/\bDate\b/, /Math\.random/, /\bsetTimeout\b/, /\bsetInterval\b/, /\bfetch\b/, /localStorage/, /indexedDB/, /\basync\b/, /\bawait\b/, /\bdocument\b/, /\bnavigator\b/,
    /\bglobalThis\b/, /\bwindow\b/, /\bprocess\b/, /performance\./, /\bcrypto\b/, /node:/, /XMLHttpRequest/, /https?:/]) assert.equal(m.test(CODE), false, String(m));
  assert.match(SRC.split('\n').slice(0, 4).join('\n'), /OUTILLAGE NON COGNITIF/);
  assert.ok(SRC.split('\n').length < 500); // MISE À JOUR DÉLIBÉRÉE v0.65.5 (segment T..B et trois identités : 450 -> 500 lignes)
});

test('branchement : verification.js n\'est importé que par ecran.js (ni main.js, ni index.html, ni sw.js, ni aucun autre module)', () => {
  // MISE À JOUR DÉLIBÉRÉE v0.65.6 (AT-6 « MANUEL de bout en bout ») : la dormance devient un branchement unique — ecran.js (chargé au seul
  // toucher de l'atelier) importe lireFaits / confronter / lireDemande ; aucun autre fichier de app/ ne nomme ce module.
  const app = join(RACINE, 'app');
  // MISE À JOUR DÉLIBÉRÉE v0.65.7 (AT-7) : journal.js, pur, l'importe aussi (lireFaits, lireDemande, confronter) pour relire et recalculer
  // un état durable ; journal.js n'est lui-même importé que par ecran.js. Aucun autre fichier de app/ ne nomme verification.js.
  // MISE À JOUR DÉLIBÉRÉE v0.65.21 (AT-10.4) : retour.js, pur, l'importe aussi (lireFaits, ecrireFaits) pour relire les faits AT-5 transportés
  // par annotations ; retour.js n'est importé que par ecran.js et les outils de outils-atelier/. Aucun autre fichier de app/.
  for (const f of fichiers(app).filter((p) => /\.(m?js|html)$/.test(p) && p !== join(ATELIER, 'verification.js') && p !== join(ATELIER, 'ecran.js') && p !== join(ATELIER, 'journal.js') && p !== join(ATELIER, 'retour.js'))) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /verification\.js/, relative(RACINE, f));
  }
  for (const f of ['sw.js', 'index.html']) assert.doesNotMatch(readFileSync(join(RACINE, f), 'utf8'), /verification\.js|outils-atelier/, f);
});

test('base cognitive inchangée : VERSION_BASE 29, SCHEMA_SAUVEGARDE 19, 35 tables ; la vérification ne nomme aucune table', () => {
  assert.equal(VERSION_BASE, 29);
  assert.equal(SCHEMA_SAUVEGARDE, 19);
  assert.equal(TABLES.length, 35);
  for (const t of TABLES) assert.equal(CODE.includes(`'${t}'`), false, t);
});
