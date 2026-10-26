// v0.66.14 — C2 « RAPPEL DES ISSUES DÉJÀ VÉCUES » (jalon rappel-calcul) : forme pure (rappel-forme.js), restitution d'une chaîne, calcul pur
// (rappels.js) et écriture FACULTATIVE dans la ligne du contexte prospectif (enregistrerContexteProspectif). Aucune table ne change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const { validerRappel, restituerRappel, STATUTS_RAPPEL, STATUTS_ISSUE_RAPPEL } = await import('../app/langage/rappel-forme.js');
const FORME = await import('../app/langage/rappel-forme.js');
const CALCUL = await import('../app/langage/rappels.js');
const { rappelDeLaRetrouvaille, rappelsDesContextes } = CALCUL;
const { enregistrerContexteProspectif, magasinMemoireVive, VERSION_BASE, TABLES } = await import('../app/langage/connaissances.js');
const { SCHEMA_SAUVEGARDE } = await import('../app/memoire/sauvegarde.js');

const RACINE = new URL('..', import.meta.url).pathname;
const lu = (...p) => readFileSync(join(RACINE, ...p), 'utf8');
const sansCommentaires = (s) => s.split('\n').filter((l) => !l.trim().startsWith('//')).map((l) => l.replace(/\s\/\/ .*$/, '').replace(/\/\*.*?\*\//g, '')).join('\n');

const R1 = { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 2 } }, attendu: { valeurs: { arrivee: 1 } } };
const R2 = { domaine: [{ operation: 'soi:tour', entrees: ['etat'] }], connu: { valeurs: { depart: 3 } }, attendu: { valeurs: { arrivee: 1 } } };
const retrouvee = (R, f = 'attente-a') => ({ statut: 'retrouvee', relations: [{ relation: structuredClone(R), formulations: [f] }], nonComparees: [] });
const AUCUNE = { statut: 'aucune', relations: [], nonComparees: [] };
const NON_EFFECTUEE = { statut: 'non-effectuee', relations: [], nonComparees: [] };
const ABSTENTION = { statut: 'abstention', relations: [{ relation: R1, formulations: ['a'] }, { relation: R2, formulations: ['b'] }], nonComparees: [], causes: ['relations-distinctes'] };
const VIDE = { statut: 'complet', precedents: [], issues: [], nonLues: [] };

const ctx = (id, acte, retrouvaille, rappel) => {
  const l = { id, idDesignation: acte };
  if (retrouvaille !== undefined) l.retrouvaille = retrouvaille;
  if (rappel !== undefined) l.rappel = rappel;
  return l;
};
const issue = (idContexte, acte, exec, observe = { statut: 'realisee', reel: 1 }) => ({ id: ['issue-retrouvaille', idContexte, exec].join('/'), idContexte, idDesignation: acte, idExecution: exec, horodatage: '2026-10-26T10:00:00.000Z', observe });

// ------------------------------------------------------------------------------------------------------------- 1. premier acte
test('1. PREMIER ACTE : rappel complet aux listes vides (aucun maillon, aucune issue) ; les contextes du même acte ou d\'une autre relation ne comptent pas', () => {
  assert.deepEqual(rappelDeLaRetrouvaille(retrouvee(R1), 'acte-1', [], []), VIDE);
  const contextes = [ctx('c-meme', 'acte-1', retrouvee(R1), VIDE), ctx('c-autreR', 'acte-0', retrouvee(R2), VIDE), ctx('c-ancien', 'acte-0')];
  const issues = [issue('c-meme', 'acte-1', 'e1'), issue('c-autreR', 'acte-0', 'e2')];
  assert.deepEqual(rappelDeLaRetrouvaille(retrouvee(R1), 'acte-1', contextes, issues), VIDE);
});

// ------------------------------------------------------------------------------------------------------------- 2. absence / illisible
test('2. ABSENCE D\'ISSUE ≠ LIGNE ILLISIBLE : un contexte retrouvé sans issue donne complet et vide ; une ligne illisible donne incomplet, son id dans nonLues', () => {
  const contextes = [ctx('c1', 'acte-1', retrouvee(R1)), ctx('c-ill', 'acte-2', { statut: 'retrouvee' })];
  assert.deepEqual(rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', contextes, []), VIDE, 'absence d\'issue : complet et vide');
  const lisible = issue('c1', 'acte-1', 'e1');
  const r = rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', contextes, [lisible]);
  assert.deepEqual(r, { statut: 'complet', precedents: [], issues: [{ idIssue: lisible.id, idContexte: 'c1', statut: 'realisee' }], nonLues: [] });
  const observeIllisible = issue('c1', 'acte-1', 'e2', { statut: 'inconnu' });
  const sansReel = issue('c1', 'acte-1', 'e3', { statut: 'autre' });
  const introuvable = issue('c-absent', 'acte-9', 'e4');
  const groupeIllisible = issue('c-ill', 'acte-2', 'e5');
  const sansId = { ...issue('c1', 'acte-1', 'e6') }; delete sansId.id;
  for (const [ligne, attendu] of [[observeIllisible, observeIllisible.id], [sansReel, sansReel.id], [introuvable, introuvable.id], [groupeIllisible, groupeIllisible.id], [sansId, 'c1']]) {
    const x = rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', contextes, [lisible, ligne]);
    assert.equal(x.statut, 'incomplet', JSON.stringify(ligne));
    assert.deepEqual(x.nonLues, [attendu]);
    assert.deepEqual(x.issues, [{ idIssue: lisible.id, idContexte: 'c1', statut: 'realisee' }], 'la ligne lisible reste rendue');
  }
  // une issue d'un contexte ayant retrouvé une AUTRE relation est étrangère à R : ni issue, ni nonLues
  const autre = rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', [...contextes, ctx('c2', 'acte-2', retrouvee(R2))], [issue('c2', 'acte-2', 'e7', { statut: 'inconnu' })]);
  assert.deepEqual(autre, VIDE);
});

test('2 bis. CHAÎNE : precedents = maillons qu\'aucun autre ne cite ; issues = celles qui ne sont pas déjà connues de la chaîne', () => {
  const i1 = issue('c1', 'acte-1', 'e1');
  const i2 = issue('c2', 'acte-2', 'e2', { statut: 'absente' });
  const rappel1 = VIDE;
  const rappel2 = { statut: 'complet', precedents: ['c1'], issues: [{ idIssue: i1.id, idContexte: 'c1', statut: 'realisee' }], nonLues: [] };
  const contextes = [ctx('c1', 'acte-1', retrouvee(R1), rappel1), ctx('c2', 'acte-2', retrouvee(R1, 'attente-b'), rappel2)];
  const r = rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', contextes, [i1, i2]);
  assert.deepEqual(r, { statut: 'complet', precedents: ['c2'], issues: [{ idIssue: i2.id, idContexte: 'c2', statut: 'absente' }], nonLues: [] });
  assert.deepEqual(restituerRappel('c2', contextes), { statut: 'complet', issues: rappel2.issues, nonLues: [] });
  // deux maillons qui ne se citent pas : les deux sont précédents
  const paralleles = [ctx('c1', 'acte-1', retrouvee(R1), VIDE), ctx('c4', 'acte-4', retrouvee(R1), VIDE)];
  assert.deepEqual(rappelDeLaRetrouvaille(retrouvee(R1), 'acte-5', paralleles, []).precedents, ['c1', 'c4']);
  // entrées jamais modifiées
  const avant = structuredClone(contextes);
  rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', contextes, [i1, i2]);
  assert.deepEqual(contextes, avant);
});

// ------------------------------------------------------------------------------------------------------------- 3. chaîne rompue
test('3. CHAÎNE ROMPUE : maillon introuvable, sans rappel ou hors forme → incomplet, son id dans nonLues', () => {
  const cite = (p) => ({ statut: 'complet', precedents: [p], issues: [], nonLues: [] });
  const cas = [
    ['introuvable', [ctx('c2', 'acte-2', retrouvee(R1), cite('c-absent'))], 'c-absent'],
    ['sans rappel', [ctx('c1', 'acte-1', retrouvee(R1)), ctx('c2', 'acte-2', retrouvee(R1), cite('c1'))], 'c1'],
    ['hors forme', [ctx('c1', 'acte-1', retrouvee(R1), { statut: 'complet', precedents: [], issues: [] }), ctx('c2', 'acte-2', retrouvee(R1), cite('c1'))], 'c1'],
  ];
  for (const [nom, contextes, id] of cas) {
    assert.deepEqual(restituerRappel('c2', contextes), { statut: 'incomplet', issues: [], nonLues: [id] }, nom);
    const r = rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', contextes, []);
    assert.equal(r.statut, 'incomplet', nom); assert.ok(r.nonLues.includes(id), nom);
  }
  assert.deepEqual(restituerRappel('c-rien', []), { statut: 'incomplet', issues: [], nonLues: ['c-rien'] });
  // un maillon hors forme, non cité : il reste précédent et sa restitution le signale
  const r = rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', [ctx('c1', 'acte-1', retrouvee(R1), { statut: 'complet' })], []);
  assert.deepEqual(r, { statut: 'incomplet', precedents: ['c1'], issues: [], nonLues: ['c1'] });
  // un cycle ne boucle pas
  const cycle = [ctx('ca', 'acte-1', retrouvee(R1), cite('cb')), ctx('cb', 'acte-2', retrouvee(R1), cite('ca'))];
  assert.deepEqual(restituerRappel('ca', cycle), { statut: 'complet', issues: [], nonLues: [] });
});

// ------------------------------------------------------------------------------------------------------------- 4. deux contenus
test('4. MÊME idIssue À DEUX CONTENUS : incomplet, l\'identité dans nonLues, aucun des deux contenus retenu', () => {
  const r1 = { statut: 'complet', precedents: [], issues: [{ idIssue: 'i-x', idContexte: 'c0', statut: 'realisee' }, { idIssue: 'i-y', idContexte: 'c0', statut: 'absente' }], nonLues: [] };
  const r2 = { statut: 'complet', precedents: ['c1'], issues: [{ idIssue: 'i-x', idContexte: 'c0', statut: 'autre' }], nonLues: [] };
  const contextes = [ctx('c1', 'acte-1', retrouvee(R1), r1), ctx('c2', 'acte-2', retrouvee(R1), r2)];
  assert.deepEqual(restituerRappel('c2', contextes), { statut: 'incomplet', issues: [{ idIssue: 'i-y', idContexte: 'c0', statut: 'absente' }], nonLues: ['i-x'] });
  const memeContenu = [ctx('c1', 'acte-1', retrouvee(R1), r1), ctx('c2', 'acte-2', retrouvee(R1), { ...r2, issues: [{ idIssue: 'i-x', idContexte: 'c0', statut: 'realisee' }] })];
  assert.equal(restituerRappel('c2', memeContenu).statut, 'complet', 'même contenu : un seul, sans doublon');
  assert.equal(restituerRappel('c2', memeContenu).issues.length, 2);
  const r = rappelDeLaRetrouvaille(retrouvee(R1), 'acte-3', contextes, []);
  assert.equal(r.statut, 'incomplet'); assert.deepEqual(r.nonLues, ['i-x']);
});

// ------------------------------------------------------------------------------------------------------------- 5. aucun rappel
test('5. AUCUN RAPPEL (null) pour abstention, aucune et non-effectuee ; rien n\'est lu', async () => {
  for (const g of [ABSTENTION, AUCUNE, NON_EFFECTUEE]) assert.equal(rappelDeLaRetrouvaille(g, 'acte-1', [ctx('c1', 'acte-0', retrouvee(R1), VIDE)], [issue('c1', 'acte-0', 'e1')]), null, g.statut);
  assert.throws(() => rappelDeLaRetrouvaille({ statut: 'retrouvee', relations: [], nonComparees: [] }, 'acte-1', [], []), TypeError, 'groupe hors forme');
  assert.throws(() => rappelDeLaRetrouvaille(retrouvee(R1), '', [], []), TypeError);
  // rappelsDesContextes : aucune lecture sans retrouvaille 'retrouvee'
  const journal = [];
  const base = magasinMemoireVive();
  await base.ecrire('contextesProspectifs', ctx('c1', 'acte-0', retrouvee(R1), VIDE));
  await base.ecrireAtomique([{ table: 'issuesRetrouvailles', objet: issue('c1', 'acte-0', 'e1'), mode: 'ajout' }]);
  const magasin = { ...base, lireTout: async (t) => { journal.push(t); return base.lireTout(t); } };
  assert.deepEqual(await rappelsDesContextes(magasin, [ABSTENTION, AUCUNE, NON_EFFECTUEE], { id: 'acte-1' }), [null, null, null]);
  assert.deepEqual(await rappelsDesContextes(magasin, [], { id: 'acte-1' }), []);
  assert.deepEqual(journal, [], 'aucune table lue');
  const r = await rappelsDesContextes(magasin, [AUCUNE, retrouvee(R1)], { id: 'acte-1' });
  assert.equal(r[0], null);
  assert.deepEqual(r[1], { statut: 'complet', precedents: ['c1'], issues: [{ idIssue: 'issue-retrouvaille/c1/e1', idContexte: 'c1', statut: 'realisee' }], nonLues: [] });
  assert.deepEqual([...journal].sort(), ['contextesProspectifs', 'issuesRetrouvailles'], 'une lecture de chaque table');
});

// ------------------------------------------------------------------------------------------------------------- 6. forme
test('6. validerRappel : forme exacte ; refuse formes, statuts et identités invalides', () => {
  assert.deepEqual(STATUTS_RAPPEL, ['complet', 'incomplet']);
  assert.deepEqual(STATUTS_ISSUE_RAPPEL, ['realisee', 'autre', 'absente', 'incomplete']);
  const bon = { statut: 'incomplet', precedents: ['c1'], issues: [{ idIssue: 'i1', idContexte: 'c1', statut: 'incomplete' }], nonLues: ['i2'] };
  const copie = validerRappel(bon);
  assert.deepEqual(copie, bon); assert.notEqual(copie, bon); assert.notEqual(copie.issues[0], bon.issues[0]);
  assert.deepEqual(validerRappel(VIDE), VIDE);
  const issueOk = { idIssue: 'i1', idContexte: 'c1', statut: 'realisee' };
  const accesseur = { statut: 'complet', precedents: [], issues: [], get nonLues() { return []; } };
  const invalides = [
    null, [], 'complet',
    { statut: 'complet', precedents: [], issues: [] },
    { statut: 'complet', precedents: [], issues: [], nonLues: [], score: 1 },
    { statut: 'partiel', precedents: [], issues: [], nonLues: [] },
    { statut: 'complet', precedents: [''], issues: [], nonLues: [] },
    { statut: 'complet', precedents: ['c1', 'c1'], issues: [], nonLues: [] },
    { statut: 'complet', precedents: 'c1', issues: [], nonLues: [] },
    { statut: 'complet', precedents: [], issues: [issueOk, { ...issueOk, statut: 'autre' }], nonLues: [] },
    { statut: 'complet', precedents: [], issues: [{ ...issueOk, statut: 'reussie' }], nonLues: [] },
    { statut: 'complet', precedents: [], issues: [{ ...issueOk, rang: 1 }], nonLues: [] },
    { statut: 'complet', precedents: [], issues: [{ idIssue: 'i1', statut: 'realisee' }], nonLues: [] },
    { statut: 'complet', precedents: [], issues: [{ ...issueOk, idContexte: '' }], nonLues: [] },
    { statut: 'complet', precedents: [], issues: [], nonLues: ['x'] },
    { statut: 'incomplet', precedents: [], issues: [], nonLues: [] },
    { statut: 'incomplet', precedents: [], issues: [], nonLues: ['x', 'x'] },
    { statut: 'incomplet', precedents: [], issues: [], nonLues: [3] },
    accesseur,
  ];
  for (const g of invalides) assert.throws(() => validerRappel(g), TypeError, JSON.stringify(g));
});

// ------------------------------------------------------------------------------------------------------------- 7. écriture
const CONTEXTE = { application: { operation: 'soi:tour', liaisons: [{ entree: 'etat', donnee: 'd1' }] }, donnee: 'd1', parent: null, structure: [{ operation: 'soi:tour', entrees: ['etat'] }], episodePartiel: { depart: 'd1' }, temoins: [], chemins: [] };
const designation = (id) => ({ id, idObservation: 'observation-1', operation: 'soi:tour' });

test('7. enregistrerContexteProspectif : rappel facultatif, validé, refusé sans retrouvaille \'retrouvee\', écrit dans la ligne sinon ; sans rappel, ligne inchangée', async () => {
  const m = magasinMemoireVive();
  const rappel = { statut: 'complet', precedents: ['c1'], issues: [{ idIssue: 'i1', idContexte: 'c1', statut: 'realisee' }], nonLues: [] };
  await assert.rejects(enregistrerContexteProspectif(m, { designation: designation('acte-a'), contexte: CONTEXTE, rappel }), TypeError, 'sans retrouvaille');
  for (const g of [AUCUNE, NON_EFFECTUEE, ABSTENTION]) await assert.rejects(enregistrerContexteProspectif(m, { designation: designation('acte-a'), contexte: CONTEXTE, retrouvaille: g, rappel }), TypeError, g.statut);
  await assert.rejects(enregistrerContexteProspectif(m, { designation: designation('acte-a'), contexte: CONTEXTE, retrouvaille: retrouvee(R1), rappel: { ...rappel, statut: 'incomplet' } }), TypeError, 'rappel hors forme');
  assert.deepEqual(await m.lireTout('contextesProspectifs'), [], 'aucune écriture sur refus');
  const ligne = await enregistrerContexteProspectif(m, { designation: designation('acte-a'), contexte: CONTEXTE, retrouvaille: retrouvee(R1), rappel });
  assert.deepEqual(ligne.rappel, rappel); assert.notEqual(ligne.rappel, rappel);
  assert.deepEqual(Object.keys(ligne).slice(-2), ['retrouvaille', 'rappel']);
  const relue = await m.lireTout('contextesProspectifs');
  assert.equal(relue.length, 1); assert.deepEqual(relue[0].rappel, rappel);
  const sans = await enregistrerContexteProspectif(m, { designation: designation('acte-b'), contexte: CONTEXTE, retrouvaille: retrouvee(R1) });
  assert.equal(Object.hasOwn(sans, 'rappel'), false);
  const ancien = await enregistrerContexteProspectif(m, { designation: designation('acte-c'), contexte: CONTEXTE });
  assert.deepEqual(Object.keys(ancien), ['id', 'horodatage', 'idDesignation', 'idObservation', 'application', 'donnee', 'parent', 'structure', 'episodePartiel', 'temoins', 'chemins']);
  // le rappel écrit est relu par restituerRappel : ses issues sont restituées ; son précédent 'c1' n'existe pas dans ce magasin → incomplet
  assert.deepEqual(restituerRappel(ligne.id, relue), { statut: 'incomplet', issues: rappel.issues, nonLues: ['c1'] });
});

// ------------------------------------------------------------------------------------------------------------- 8. gardes
test('8. GARDES : exports et imports exacts ; aucune table ni version ; idDesignation absent des nouveaux fichiers ; aucun score, compte, tri, horloge, hasard', () => {
  assert.deepEqual(Object.keys(FORME).sort(), ['STATUTS_ISSUE_RAPPEL', 'STATUTS_RAPPEL', 'restituerRappel', 'validerRappel']);
  assert.deepEqual(Object.keys(CALCUL).sort(), ['rappelDeLaRetrouvaille', 'rappelsDesContextes']);
  const imports = (m) => [...sansCommentaires(lu('app', 'langage', `${m}.js`)).matchAll(/^import .* from '(.+)';$/gm)].map((x) => x[1]);
  assert.deepEqual(imports('rappel-forme'), []);
  assert.deepEqual(imports('rappels'), ['./retrouvaille-forme.js', './relations-formulees.js', './rappel-forme.js', './connaissances.js']);
  for (const m of ['rappel-forme', 'rappels']) {
    assert.doesNotMatch(lu('app', 'langage', `${m}.js`), /idDesignation/, `${m} : garde J1`);
    const code = sansCommentaires(lu('app', 'langage', `${m}.js`));
    assert.doesNotMatch(code, /Math\.|Date|random|score|poids|vote|majorit|frequen|compte|recen|prefer|confian|predi|\.sort\(|reduce\(|setTimeout|ecrire|horodatage/i, m);
  }
  assert.doesNotMatch(sansCommentaires(lu('app', 'langage', 'rappel-forme.js')), /lireTout|magasin/, 'la forme ne lit rien');
  const conn = sansCommentaires(lu('app', 'langage', 'connaissances.js'));
  assert.equal((conn.match(/validerRappel\(/g) || []).length, 1, 'l\'écrivain valide le rappel une fois');
  assert.equal(VERSION_BASE, 30); assert.equal(SCHEMA_SAUVEGARDE, 20); assert.equal(TABLES.length, 36);
});
