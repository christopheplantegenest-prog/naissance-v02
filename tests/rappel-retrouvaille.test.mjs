// v0.66.14 — C2 « RAPPEL DES ISSUES DÉJÀ VÉCUES » (chantier ticket-28, jalon rappel-calcul). Forme pure (rappel-forme.js : validerRappel,
// restituerRappel), calcul (rappels.js : rappelDeLaRetrouvaille, rappelsDesContextes) et écriture FACULTATIVE du groupe dans la ligne du
// contexte prospectif (connaissances.js : enregistrerContexteProspectif). Aucune table, ni VERSION_BASE, ni SCHEMA_SAUVEGARDE ne change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import * as FORME from '../app/langage/rappel-forme.js';
import * as CALCUL from '../app/langage/rappels.js';
import { validerRappel, restituerRappel, STATUTS_RAPPEL, STATUTS_ISSUE_RAPPEL } from '../app/langage/rappel-forme.js';
import { rappelDeLaRetrouvaille, rappelsDesContextes } from '../app/langage/rappels.js';
import { magasinMemoireVive, enregistrerContexteProspectif, TABLES, VERSION_BASE } from '../app/langage/connaissances.js';
import { SCHEMA_SAUVEGARDE } from '../app/memoire/sauvegarde.js';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname), '..');
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');

// ---------------------------------------------------------------------------------------------------------------- données synthétiques
const R1 = { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: { valeurs: { arrivee: 1 } } };
const R2 = { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: { valeurs: { arrivee: 0 } } };
const RETROUVEE = (R) => ({ statut: 'retrouvee', relations: [{ relation: structuredClone(R), formulations: ['attente-1'] }], nonComparees: [] });
const AUCUNE = { statut: 'aucune', relations: [], nonComparees: [] };
const NON_EFFECTUEE = { statut: 'non-effectuee', relations: [], nonComparees: [] };
const ABSTENTION = { statut: 'abstention', relations: [], nonComparees: ['attente-z'], causes: ['comparaison-incomplete'] };
const RAPPEL = (precedents = [], issues = [], nonLues = []) => ({ statut: nonLues.length > 0 ? 'incomplet' : 'complet', precedents, issues, nonLues });
const ISSUE = (idIssue, idContexte, statut = 'realisee') => ({ idIssue, idContexte, statut });
const CTX = (id, acte, R, rappel) => { const l = { id, idDesignation: acte, retrouvaille: RETROUVEE(R) }; if (rappel !== undefined) l.rappel = rappel; return l; };
const LIGNE_ISSUE = (id, idContexte, acte, statut = 'realisee') => ({ id, idContexte, idDesignation: acte, idExecution: 'execution-1', horodatage: '2026-10-30T00:00:00.000Z', observe: statut === 'realisee' || statut === 'autre' ? { statut, reel: 1 } : { statut } });

// ================================================================================================================ 1. premier acte
test('1. PREMIER ACTE : rappel complet aux listes vides (aucun maillon, aucune issue) ; les lignes du même acte et les contextes sans rappel ne sont pas des maillons', () => {
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-1', [], []), { statut: 'complet', precedents: [], issues: [], nonLues: [] });
  const contextes = [CTX('c-1', 'acte-1', R1, RAPPEL()), CTX('c-0', 'acte-0', R1)];
  const issues = [LIGNE_ISSUE('i-1', 'c-1', 'acte-1')];
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-1', contextes, issues), { statut: 'complet', precedents: [], issues: [], nonLues: [] });
});

// ================================================================================================================ 2. absence ≠ illisible
test('2. ABSENCE D\'ISSUE ≠ LIGNE ILLISIBLE : complet et vide d\'un côté ; incomplet, id dans nonLues de l\'autre', () => {
  const contextes = [CTX('c-a', 'acte-a', R1, RAPPEL())];
  const absence = rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-b', contextes, []);
  assert.deepEqual(absence, { statut: 'complet', precedents: ['c-a'], issues: [], nonLues: [] });
  // issue lisible d'un autre acte, contexte ayant retrouvé exactement R1 : retenue
  const lisible = rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-b', contextes, [LIGNE_ISSUE('i-a', 'c-a', 'acte-a', 'absente')]);
  assert.deepEqual(lisible, { statut: 'complet', precedents: ['c-a'], issues: [ISSUE('i-a', 'c-a', 'absente')], nonLues: [] });
  // observe illisible
  const illisible = { ...LIGNE_ISSUE('i-x', 'c-a', 'acte-a'), observe: { statut: 'inconnu' } };
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-b', contextes, [illisible]), { statut: 'incomplet', precedents: ['c-a'], issues: [], nonLues: ['i-x'] });
  // ligne sans id : le nom de la table tient lieu d'identité (aucune identité inventée)
  const sansId = LIGNE_ISSUE('i-y', 'c-a', 'acte-a'); delete sansId.id;
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-b', contextes, [sansId]).nonLues, ['issuesRetrouvailles']);
  // contexte introuvable
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-b', contextes, [LIGNE_ISSUE('i-z', 'c-absent', 'acte-z')]), { statut: 'incomplet', precedents: ['c-a'], issues: [], nonLues: ['i-z'] });
  // groupe retrouvaille illisible dans le contexte de l'issue
  const casse = { id: 'c-k', idDesignation: 'acte-k', retrouvaille: { statut: 'retrouvee' } };
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-b', [...contextes, casse], [LIGNE_ISSUE('i-k', 'c-k', 'acte-k')]).nonLues, ['i-k']);
  // contexte d'une AUTRE relation, ou issue du même acte : ignorés (ni retenus, ni non lus)
  const autres = [...contextes, CTX('c-r2', 'acte-r2', R2, RAPPEL())];
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-b', autres, [LIGNE_ISSUE('i-r2', 'c-r2', 'acte-r2'), LIGNE_ISSUE('i-b', 'c-a', 'acte-b')]), absence);
});

// ================================================================================================================ 3. chaîne
test('3. CHAÎNE : restituerRappel parcourt le maillon et tous ses precedents ; une chaîne rompue (introuvable, sans rappel, hors forme) donne incomplet', () => {
  const ca = CTX('c-a', 'acte-a', R1, RAPPEL([], [ISSUE('i-1', 'c-0')]));
  const cb = CTX('c-b', 'acte-b', R1, RAPPEL(['c-a'], [ISSUE('i-2', 'c-a', 'autre')]));
  assert.deepEqual(restituerRappel('c-b', [ca, cb]), { statut: 'complet', issues: [ISSUE('i-2', 'c-a', 'autre'), ISSUE('i-1', 'c-0')], nonLues: [] });
  // le calcul : seul le maillon que personne ne cite est precedent ; les issues déjà connues ne sont pas répétées
  const lignesIssues = [LIGNE_ISSUE('i-2', 'c-a', 'acte-a', 'autre'), LIGNE_ISSUE('i-3', 'c-b', 'acte-b', 'incomplete')];
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-c', [ca, cb], lignesIssues), { statut: 'complet', precedents: ['c-b'], issues: [ISSUE('i-3', 'c-b', 'incomplete')], nonLues: [] });
  // cycle : chaque maillon une fois
  const cyc1 = CTX('c-1', 'acte-1', R1, RAPPEL(['c-2'])); const cyc2 = CTX('c-2', 'acte-2', R1, RAPPEL(['c-1']));
  assert.deepEqual(restituerRappel('c-1', [cyc1, cyc2]), { statut: 'complet', issues: [], nonLues: [] });
  // rompue : introuvable
  const rompue = CTX('c-b', 'acte-b', R1, RAPPEL(['c-x'], [ISSUE('i-2', 'c-a')]));
  assert.deepEqual(restituerRappel('c-b', [rompue]), { statut: 'incomplet', issues: [ISSUE('i-2', 'c-a')], nonLues: ['c-x'] });
  // rompue : sans rappel
  const sansRappel = CTX('c-n', 'acte-n', R1);
  assert.deepEqual(restituerRappel('c-b', [CTX('c-b', 'acte-b', R1, RAPPEL(['c-n'])), sansRappel]), { statut: 'incomplet', issues: [], nonLues: ['c-n'] });
  // rompue : hors forme
  const horsForme = CTX('c-h', 'acte-h', R1, { statut: 'complet', precedents: [], issues: [] });
  assert.deepEqual(restituerRappel('c-b', [CTX('c-b', 'acte-b', R1, RAPPEL(['c-h'])), horsForme]), { statut: 'incomplet', issues: [], nonLues: ['c-h'] });
  // le maillon de départ lui-même introuvable ; identité non unique : aucune ligne choisie
  assert.deepEqual(restituerRappel('c-absent', [ca]), { statut: 'incomplet', issues: [], nonLues: ['c-absent'] });
  assert.deepEqual(restituerRappel('c-a', [ca, ca]), { statut: 'incomplet', issues: [], nonLues: ['c-a'] });
  // les nonLues d'un rappel relu sont reprises
  assert.deepEqual(restituerRappel('c-i', [CTX('c-i', 'acte-i', R1, RAPPEL([], [], ['i-perdue']))]), { statut: 'incomplet', issues: [], nonLues: ['i-perdue'] });
  // dans le calcul, une restitution incomplète rend le rappel incomplet
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-c', [rompue], []), { statut: 'incomplet', precedents: ['c-b'], issues: [], nonLues: ['c-x'] });
  // un maillon dont le rappel est hors forme est lui-même non lu
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-c', [horsForme], []), { statut: 'incomplet', precedents: ['c-h'], issues: [], nonLues: ['c-h'] });
});

// ================================================================================================================ 4. deux contenus
test('4. UN MÊME idIssue À DEUX CONTENUS : incomplet, idIssue dans nonLues, aucun des deux contenus retenu', () => {
  const ca = CTX('c-a', 'acte-a', R1, RAPPEL([], [ISSUE('i-1', 'c-0', 'realisee')]));
  const cb = CTX('c-b', 'acte-b', R1, RAPPEL(['c-a'], [ISSUE('i-1', 'c-0', 'autre')]));
  assert.deepEqual(restituerRappel('c-b', [ca, cb]), { statut: 'incomplet', issues: [], nonLues: ['i-1'] });
  // même contenu deux fois : une seule issue, complet
  const cc = CTX('c-c', 'acte-c', R1, RAPPEL(['c-a'], [ISSUE('i-1', 'c-0', 'realisee')]));
  assert.deepEqual(restituerRappel('c-c', [ca, cc]), { statut: 'complet', issues: [ISSUE('i-1', 'c-0', 'realisee')], nonLues: [] });
  // dans le calcul : une issue connue relue avec un autre contenu
  const lignes = [LIGNE_ISSUE('i-1', 'c-a', 'acte-a', 'absente')];
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-d', [ca], lignes), { statut: 'incomplet', precedents: ['c-a'], issues: [], nonLues: ['i-1'] });
  // deux lignes d'issues de même id, contenus différents
  const doubles = [LIGNE_ISSUE('i-9', 'c-a', 'acte-a', 'realisee'), LIGNE_ISSUE('i-9', 'c-a', 'acte-a', 'absente')];
  assert.deepEqual(rappelDeLaRetrouvaille(RETROUVEE(R1), 'acte-d', [CTX('c-a', 'acte-a', R1, RAPPEL())], doubles), { statut: 'incomplet', precedents: ['c-a'], issues: [], nonLues: ['i-9'] });
});

// ================================================================================================================ 5. aucun rappel
test('5. AUCUN RAPPEL (null) pour abstention, aucune et non-effectuee ; rappelsDesContextes ne lit les tables que si une retrouvaille est retrouvee', async () => {
  const contextes = [CTX('c-a', 'acte-a', R1, RAPPEL())];
  for (const g of [ABSTENTION, AUCUNE, NON_EFFECTUEE]) assert.equal(rappelDeLaRetrouvaille(g, 'acte-b', contextes, []), null, g.statut);
  assert.throws(() => rappelDeLaRetrouvaille({ statut: 'retrouvee', relations: [], nonComparees: [] }, 'acte-b', [], []), TypeError);
  const lues = [];
  const magasin = { lireTout: async (t) => { lues.push(t); if (t === 'contextesProspectifs') return contextes; if (t === 'issuesRetrouvailles') return [LIGNE_ISSUE('i-a', 'c-a', 'acte-a')]; throw new Error(`table inattendue ${t}`); } };
  assert.deepEqual(await rappelsDesContextes(magasin, [ABSTENTION, AUCUNE, NON_EFFECTUEE], { id: 'acte-b' }), [null, null, null]);
  assert.deepEqual(await rappelsDesContextes(magasin, [], { id: 'acte-b' }), []);
  assert.deepEqual(lues, [], 'aucune table lue sans retrouvaille retrouvee');
  const r = await rappelsDesContextes(magasin, [AUCUNE, RETROUVEE(R1), RETROUVEE(R2)], { id: 'acte-b' });
  assert.deepEqual(lues, ['contextesProspectifs', 'issuesRetrouvailles'], 'une lecture de chaque table');
  assert.deepEqual(r, [null, { statut: 'complet', precedents: ['c-a'], issues: [ISSUE('i-a', 'c-a')], nonLues: [] }, { statut: 'complet', precedents: [], issues: [], nonLues: [] }]);
});

// ================================================================================================================ 6. forme
test('6. validerRappel refuse les formes, statuts et identités invalides ; accepte la forme exacte et rend une copie neuve', () => {
  const bon = RAPPEL(['c-a'], [ISSUE('i-1', 'c-a', 'autre')]);
  const copie = validerRappel(bon);
  assert.deepEqual(copie, bon); assert.notEqual(copie, bon); assert.notEqual(copie.issues[0], bon.issues[0]);
  assert.deepEqual(validerRappel(RAPPEL([], [], ['x'])), { statut: 'incomplet', precedents: [], issues: [], nonLues: ['x'] });
  for (const s of STATUTS_ISSUE_RAPPEL) assert.equal(validerRappel(RAPPEL([], [ISSUE('i', 'c', s)])).issues[0].statut, s);
  const invalides = [
    null, [], 'rappel', 3,
    { statut: 'complet', precedents: [], issues: [] },
    { ...RAPPEL(), extra: 1 },
    { statut: 'inconnu', precedents: [], issues: [], nonLues: [] },
    { statut: 'incomplet', precedents: [], issues: [], nonLues: [] },
    { statut: 'complet', precedents: [], issues: [], nonLues: ['x'] },
    RAPPEL(['c-a', 'c-a']), RAPPEL(['']), RAPPEL([3]), RAPPEL('c-a'),
    RAPPEL([], [ISSUE('i-1', 'c-a'), ISSUE('i-1', 'c-b')]),
    RAPPEL([], [ISSUE('i-1', 'c-a', 'probable')]),
    RAPPEL([], [{ idIssue: 'i-1', idContexte: 'c-a' }]),
    RAPPEL([], [{ ...ISSUE('i-1', 'c-a'), reel: 1 }]),
    RAPPEL([], [ISSUE('', 'c-a')]), RAPPEL([], [ISSUE('i-1', '')]), RAPPEL([], ['i-1']),
    { statut: 'incomplet', precedents: [], issues: [], nonLues: ['x', 'x'] },
  ];
  for (const g of invalides) assert.throws(() => validerRappel(g), TypeError, JSON.stringify(g));
  const accesseur = RAPPEL(); Object.defineProperty(accesseur, 'issues', { get: () => [], enumerable: true });
  assert.throws(() => validerRappel(accesseur), TypeError);
  assert.deepEqual(STATUTS_RAPPEL, ['complet', 'incomplet']);
  assert.deepEqual(STATUTS_ISSUE_RAPPEL, ['realisee', 'autre', 'absente', 'incomplete']);
});

// ================================================================================================================ 7. écrivain
const DESIGNATION = (id) => ({ id, idObservation: `observation-${id}`, operation: 'soi:tour' });
const CONTEXTE = () => ({ application: { operation: 'soi:tour', liaisons: [{ entree: 'etat', donnee: 'd-1' }] }, donnee: 'd-1', parent: null, structure: [{ operation: 'soi:tour', entrees: ['etat'] }], episodePartiel: { depart: 'd-1' }, temoins: [], chemins: [] });

test('7. enregistrerContexteProspectif : rappel facultatif, validé, refusé sans retrouvaille retrouvee, écrit dans la ligne du contexte ; sans rappel, ligne inchangée', async () => {
  const m = magasinMemoireVive();
  const rappel = RAPPEL(['c-a'], [ISSUE('i-1', 'c-a', 'realisee')]);
  await assert.rejects(() => enregistrerContexteProspectif(m, { designation: DESIGNATION('acte-1'), contexte: CONTEXTE(), rappel }), TypeError, 'sans retrouvaille');
  for (const g of [AUCUNE, NON_EFFECTUEE, ABSTENTION]) await assert.rejects(() => enregistrerContexteProspectif(m, { designation: DESIGNATION('acte-1'), contexte: CONTEXTE(), retrouvaille: g, rappel }), TypeError, g.statut);
  await assert.rejects(() => enregistrerContexteProspectif(m, { designation: DESIGNATION('acte-1'), contexte: CONTEXTE(), retrouvaille: RETROUVEE(R1), rappel: { statut: 'incomplet', precedents: [], issues: [], nonLues: [] } }), TypeError, 'hors forme');
  assert.deepEqual(await m.lireTout('contextesProspectifs'), [], 'aucune ligne écrite par un refus');
  const ligne = await enregistrerContexteProspectif(m, { designation: DESIGNATION('acte-1'), contexte: CONTEXTE(), retrouvaille: RETROUVEE(R1), rappel });
  assert.deepEqual(ligne.rappel, rappel); assert.notEqual(ligne.rappel, rappel);
  assert.deepEqual(Object.keys(ligne).slice(-2), ['retrouvaille', 'rappel']);
  const lues = await m.lireTout('contextesProspectifs');
  assert.equal(lues.length, 1); assert.deepEqual(lues[0].rappel, rappel);
  // sans rappel : forme d'avant
  const sans = await enregistrerContexteProspectif(m, { designation: DESIGNATION('acte-2'), contexte: CONTEXTE(), retrouvaille: RETROUVEE(R1) });
  assert.equal(Object.hasOwn(sans, 'rappel'), false);
  const nu = await enregistrerContexteProspectif(m, { designation: DESIGNATION('acte-3'), contexte: CONTEXTE() });
  assert.deepEqual(Object.keys(nu), ['id', 'horodatage', 'idDesignation', 'idObservation', 'application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins']);
  // le rappel écrit se relit par la chaîne
  assert.deepEqual(restituerRappel(ligne.id, await m.lireTout('contextesProspectifs')), { statut: 'incomplet', issues: [ISSUE('i-1', 'c-a', 'realisee')], nonLues: ['c-a'] });
});

// ================================================================================================================ gardes
test('8. GARDES : exports et imports exacts ; aucune table, version ni schéma changés ; idDesignation absent des nouveaux modules ; aucun score, compte, fréquence, tri, récence, confiance, préférence, prédiction ni décision', () => {
  assert.deepEqual(Object.keys(FORME).sort(), ['STATUTS_ISSUE_RAPPEL', 'STATUTS_RAPPEL', 'restituerRappel', 'validerRappel']);
  assert.deepEqual(Object.keys(CALCUL).sort(), ['rappelDeLaRetrouvaille', 'rappelsDesContextes']);
  const imports = (m) => [...sansCommentaires(lu('app', 'langage', `${m}.js`)).matchAll(/^import .* from '(.+)';$/gm)].map((x) => x[1]);
  assert.deepEqual(imports('rappel-forme'), []);
  assert.deepEqual(imports('rappels'), ['./retrouvaille-forme.js', './relations-formulees.js', './rappel-forme.js']);
  for (const m of ['rappel-forme', 'rappels']) {
    const code = sansCommentaires(lu('app', 'langage', `${m}.js`));
    assert.doesNotMatch(code, /idDesignation/, `${m} : garde J1`);
    assert.doesNotMatch(code, /score|poids|compte|compteur|frequen|\.sort\(|reduce\(|recen|horodatage|confiance|prefer|predi|decision|decide|choisi|Math\.|random|Date|setTimeout|vote|majorit|seuil/i, m);
    assert.doesNotMatch(code, /ecrire|enregistrer|remplacerTout|supprimer|reconnaissance|nonComparees/, m);
  }
  assert.doesNotMatch(sansCommentaires(lu('app', 'langage', 'rappel-forme.js')), /lireTout|magasin|retrouvaille/i, 'la forme ne lit rien');
  // l'écrivain n'importe que la forme
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  assert.match(conn, /^import \{ validerRappel \} from '\.\/rappel-forme\.js';$/m);
  assert.doesNotMatch(conn, /rappels\.js|rappelDeLaRetrouvaille|rappelsDesContextes/);
  assert.equal(VERSION_BASE, 30); assert.equal(SCHEMA_SAUVEGARDE, 20); assert.equal(TABLES.length, 36);
});
