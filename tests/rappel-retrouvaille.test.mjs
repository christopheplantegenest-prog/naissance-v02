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

// ================================================================================================================ VRAI FLUX (jalon rappel-producteurs)
const { TABLE_OPERATIONS } = await import('../app/langage/table-operations.js');
const { executerApplicationsDeterminees } = await import('../app/langage/execution-mecanique.js');
const { suivreObservationDuTour } = await import('../app/langage/contexte-sollicitation.js');
const { traiterTourAvecEnonce } = await import('../app/langage/pont.js');
const { observerPossibilites } = await import('../app/langage/observation-possibilites.js');
const { enregistrerObservationPossibilites, enregistrerValeurDonnee } = await import('../app/langage/connaissances.js');
const { lireCapacite, peutAgir, tourActif, PARAMETRES_B1 } = await import('../app/langage/capacite.js');
const { emettreLot } = await import('../app/langage/environnement-conversation.js');
const { traiterOccasion } = await import('../app/langage/episode-propre.js');
const { tickPropre } = await import('../app/langage/tick-propre.js');
const vueS = (s) => s.map((e) => `${e.operation}(${e.entrees.join(',')})`).join('>');
const { memesRelations } = await import('../app/langage/relations-formulees.js');
const { construireSauvegardeComplete, lireSauvegardeComplete } = await import('../app/memoire/sauvegarde.js');
const { creerMemoire } = await import('../app/memoire/memoire.js');
const { creerMagasinMemoire } = await import('../app/memoire/magasin.js');
const { readdirSync, statSync } = await import('node:fs');
// Harnais de tests/issue-vecue-retrouvaille.test.mjs (tours, ticks, capacité), recopié. Options sans effet sur le flux : `journal` (chaque
// écriture, dans l'ordre réel, après son effet : { table, id }) ; `sansRappel` : le groupe rappel n'est JAMAIS persisté (retiré de la ligne
// du contexte au moment de l'écriture), pour comparer un vécu avec et un vécu sans rappel (patron T13).
function monde({ magasin: base = null, marque = 'c2', journal = null, sansRappel = false } = {}) {
  const magasin = base ?? magasinMemoireVive(); let n = 0; const nouvelId = (p) => `${p}-${marque}-${++n}`;
  if (journal || sansRappel) {
    const ecrire = magasin.ecrire.bind(magasin); const atomique = magasin.ecrireAtomique.bind(magasin);
    magasin.ecrire = async (t, o) => {
      let objet = o;
      if (sansRappel && t === 'contextesProspectifs' && Object.hasOwn(o, 'rappel')) { const { rappel, ...reste } = o; objet = reste; }
      const r = await ecrire(t, objet); if (journal) journal.push({ table: t, id: o.id }); return r;
    };
    magasin.ecrireAtomique = async (ops) => { const r = await atomique(ops); if (journal) for (const o of ops) journal.push({ table: o.table, id: o.objet.id }); return r; };
  }
  async function tour(texte, cout = PARAMETRES_B1.coutTourActif) {
    const suivi = suivreObservationDuTour((m) => observerPossibilites(m, { enregistrer: (d) => enregistrerObservationPossibilites(magasin, d), lireExecutions: () => magasin.lireTout('executionsOperations') }), async ({ observation, univers }) => {
      const avant = await lireCapacite(magasin);
      const l = !peutAgir(avant) ? { applications: [], choixAFaire: [], resultats: [] } : await executerApplicationsDeterminees({ observation, univers }, { magasin, table: TABLE_OPERATIONS });
      const { emises } = await emettreLot(l, { magasin, idObservation: observation.id });
      if (l.resultats.some((r) => r.statut === 'executee')) await tourActif(magasin, { idObservation: observation.id, horodatage: observation.horodatage }, { ...PARAMETRES_B1, coutTourActif: cout });
      return { ...l, emises };
    }, async () => magasin);
    const res = await traiterTourAvecEnonce(texte, null, { enregistrerEnonce: async () => {}, traiter: async () => ({ texte: 'ok' }), nouvelId, observerPossibilites: suivi.observer, enregistrerValeur: (e) => enregistrerValeurDonnee(magasin, e) });
    const s = suivi.joindre(res).sollicitation;
    await traiterOccasion(magasin, s.observation.id);
    return s;
  }
  async function tick(k) { for (let i = 0; i < k; i += 1) { const t = await tickPropre(magasin); await traiterOccasion(magasin, t.tick.id); } }
  async function etape([genre, x, cout]) {
    const avant = new Set((await magasin.lireTout('contextesProspectifs')).map((c) => c.id));
    if (genre === 'msg') await tour(x, cout); else await tick(x);
    return (await magasin.lireTout('contextesProspectifs')).filter((c) => !avant.has(c.id));
  }
  return { magasin, etape };
}
async function vivre(plan, options) {
  const w = monde(options); const etapes = [];
  for (const p of plan) etapes.push({ etiquette: p[1], contextes: await w.etape(p) });
  return { w, etapes };
}

// Scénario sondé (C1) prolongé : c 3 → 2 → 1, Repos, … ; « six » retrouve R (soi:tour, départ 2 → arrivée 1) et vit une issue realisee ;
// « neuf » (départ 2) retrouve la même R. Version longue : trois cycles de plus, pour la croissance.
const SCENARIO = [['msg', 'bonjour'], ['msg', 'salut'], ['tick', 3], ['msg', 'un'], ['msg', 'deux'], ['tick', 3], ['msg', 'trois'], ['msg', 'quatre'], ['tick', 3], ['msg', 'cinq'], ['msg', 'six'], ['msg', 'sept'], ['tick', 3], ['msg', 'huit'], ['msg', 'neuf']];
const LONG = [...SCENARIO, ['msg', 'dix'], ['tick', 3], ['msg', 'onze'], ['msg', 'douze'], ['msg', 'treize'], ['tick', 3], ['msg', 'quatorze'], ['msg', 'quinze'], ['msg', 'seize']];
// « quatre » à coût 2 : réel 2 → 0, issue autre ; c = 0, Repos, puis le tour suivant qui retrouve la même R (« six », départ 2).
const COUT2 = [...SCENARIO.slice(0, 7), ['msg', 'quatre', 2], ['tick', 3], ['msg', 'cinq'], ['msg', 'six']];
const T = 'issuesRetrouvailles';
let partage = null;
const JOURNAL = [];
const vecuLong = () => (partage ??= vivre(LONG, { journal: JOURNAL })); // lecture seule : les tests qui modifient travaillent sur une copie
let partageCout2 = null;
const vecuCout2 = () => (partageCout2 ??= vivre(COUT2, { marque: 'c2-cout2' }));
const tourDe = (etapes, etiquette) => etapes.find((e) => e.etiquette === etiquette).contextes.find((c) => vueS(c.structure) === 'soi:tour(etat)');
const relationDe = (c) => c.retrouvaille.relations[0].relation;
const parId = (lignes) => new Map(lignes.map((l) => [l.id, l]));
async function redemarrer(magasin) {
  const donnees = {};
  for (const t of TABLES) donnees[t] = JSON.parse(JSON.stringify(await magasin.lireTout(t)));
  const neuf = magasinMemoireVive();
  await neuf.remplacerTout(donnees);
  return neuf;
}
const rappelsParContexte = (contextes) => new Map(contextes.filter((c) => Object.hasOwn(c, 'rappel')).map((c) => [c.id, c.rappel]));

test('9. VRAI FLUX — après « six » (issue realisee), le rappel de l\'acte suivant qui retrouve la même relation (« neuf ») contient cette issue realisee', async () => {
  const { w, etapes } = await vecuLong();
  const six = tourDe(etapes, 'six'); const neuf = tourDe(etapes, 'neuf');
  assert.equal(six.retrouvaille.statut, 'retrouvee'); assert.equal(neuf.retrouvaille.statut, 'retrouvee');
  assert.equal(memesRelations(relationDe(six), relationDe(neuf)), true, 'même relation R');
  const issuesSix = (await w.magasin.lireTout(T)).filter((l) => l.idContexte === six.id);
  assert.equal(issuesSix.length, 1); assert.equal(issuesSix[0].observe.statut, 'realisee');
  assert.equal(neuf.rappel.statut, 'complet');
  assert.ok(neuf.rappel.precedents.includes(six.id), 'le contexte de « six » est le maillon précédent');
  assert.deepEqual(neuf.rappel.issues.filter((i) => i.idIssue === issuesSix[0].id), [ISSUE(issuesSix[0].id, six.id, 'realisee')]);
  // par la chaîne aussi
  const restitue = restituerRappel(neuf.id, await w.magasin.lireTout('contextesProspectifs'));
  assert.equal(restitue.statut, 'complet');
  assert.ok(restitue.issues.some((i) => i.idIssue === issuesSix[0].id && i.statut === 'realisee'));
  // le contexte de « six » lui-même porte un rappel (écrit AVANT son issue) qui ne la contient pas
  assert.equal(six.rappel.issues.some((i) => i.idIssue === issuesSix[0].id), false);
});

test('10. VRAI FLUX — après « quatre » à coût 2 (issue autre) puis le tour suivant qui retrouve la même relation, le rappel contient une issue autre', async () => {
  const { w, etapes } = await vecuCout2();
  const quatre = tourDe(etapes, 'quatre'); const six = tourDe(etapes, 'six');
  assert.equal(quatre.retrouvaille.statut, 'retrouvee'); assert.equal(six.retrouvaille.statut, 'retrouvee');
  assert.equal(memesRelations(relationDe(quatre), relationDe(six)), true);
  const issuesQuatre = (await w.magasin.lireTout(T)).filter((l) => l.idContexte === quatre.id);
  assert.equal(issuesQuatre.length, 1); assert.deepEqual(issuesQuatre[0].observe, { statut: 'autre', reel: { valeurs: { arrivee: 0 } } });
  // aucun acte intermédiaire n'a retrouvé R : « six » est le tour suivant qui la retrouve
  const entre = etapes.slice(etapes.findIndex((e) => e.etiquette === 'quatre') + 1, etapes.findIndex((e) => e.etiquette === 'six')).flatMap((e) => e.contextes);
  assert.equal(entre.some((c) => c.retrouvaille && c.retrouvaille.statut === 'retrouvee' && memesRelations(relationDe(c), relationDe(quatre))), false);
  assert.equal(six.rappel.statut, 'complet');
  assert.deepEqual(six.rappel.issues.filter((i) => i.idIssue === issuesQuatre[0].id), [ISSUE(issuesQuatre[0].id, quatre.id, 'autre')]);
});

test('11. VRAI FLUX — jamais l\'issue de l\'acte courant ; une relation différente n\'est pas rappelée ; rappel seulement pour une retrouvaille retrouvee', async () => {
  const { w, etapes } = await vecuLong();
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  const issues = await w.magasin.lireTout(T);
  const parContexte = new Map(contextes.map((c) => [c.id, c]));
  const ligneIssue = new Map(issues.map((l) => [l.id, l]));
  const avecRappel = contextes.filter((c) => Object.hasOwn(c, 'rappel'));
  assert.ok(avecRappel.length > 0);
  for (const c of contextes) assert.equal(Object.hasOwn(c, 'rappel'), c.retrouvaille !== undefined && c.retrouvaille.statut === 'retrouvee', c.id);
  let vues = 0;
  for (const c of avecRappel) {
    for (const groupe of [c.rappel.issues, restituerRappel(c.id, contextes).issues]) {
      for (const i of groupe) {
        const l = ligneIssue.get(i.idIssue);
        assert.ok(l, `${i.idIssue} : ligne persistée`);
        assert.notEqual(l.idDesignation, c.idDesignation, `${c.id} : jamais l'issue de l'acte courant`);
        assert.equal(l.idContexte, i.idContexte); assert.equal(l.observe.statut, i.statut);
        assert.equal(memesRelations(relationDe(parContexte.get(l.idContexte)), relationDe(c)), true, `${c.id} : ${i.idIssue} est de la même relation`);
        vues += 1;
      }
    }
    // aucune issue de l'acte courant, même écrite après
    for (const l of issues.filter((x) => x.idDesignation === c.idDesignation)) assert.equal(c.rappel.issues.some((i) => i.idIssue === l.id), false);
  }
  assert.ok(vues > 0);
  // « huit » (départ 3 → 2) : autre relation que « six » (départ 2 → 1) ; l'issue de « six » n'y est pas rappelée
  const six = tourDe(etapes, 'six'); const huit = tourDe(etapes, 'huit');
  assert.equal(memesRelations(relationDe(six), relationDe(huit)), false);
  const issueSix = issues.find((l) => l.idContexte === six.id);
  assert.equal(huit.rappel.issues.some((i) => i.idIssue === issueSix.id), false);
  assert.equal(restituerRappel(huit.id, contextes).issues.some((i) => i.idIssue === issueSix.id), false);
  assert.equal(huit.rappel.precedents.includes(six.id), false);
});

test('12. AUCUNE INFLUENCE (patron T13) : même scénario avec ou sans rappel persisté → attentesProspectives et toutes les autres tables identiques hors groupe rappel', async () => {
  const canonique = (donnees) => {
    const noms = new Map();
    const texte = JSON.stringify(donnees, (cle, valeur) => (cle === 'rappel' ? undefined : valeur));
    return texte.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g, 'H').replace(/[a-z][a-z-]*-\d{13}-\d+-\d+/g, (id) => { if (!noms.has(id)) noms.set(id, `#${noms.size}`); return noms.get(id); });
  };
  const tables = async (m) => { const o = {}; for (const t of TABLES) o[t] = await m.lireTout(t); return o; };
  const avec = await vivre(SCENARIO, { marque: 'c2-t13' });
  const sans = await vivre(SCENARIO, { marque: 'c2-t13', sansRappel: true });
  const ta = await tables(avec.w.magasin); const ts = await tables(sans.w.magasin);
  assert.ok(ta.contextesProspectifs.some((c) => c.rappel && c.rappel.issues.length > 0), 'des rappels non vides existent');
  assert.equal(ts.contextesProspectifs.some((c) => Object.hasOwn(c, 'rappel')), false, 'aucun rappel persisté');
  assert.equal(canonique(ta.attentesProspectives), canonique(ts.attentesProspectives), 'attentesProspectives identiques');
  assert.equal(canonique(ta), canonique(ts), 'ni acte, ni attente, ni issue, ni besoin, ni décision ne change');
});

test('13. RELECTURE : le rappel est identique après redémarrage et après export/import (sauvegarde complète)', async () => {
  const { w } = await vecuLong();
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  const avant = rappelsParContexte(contextes);
  assert.ok(avant.size > 0);
  const neuf = await redemarrer(w.magasin);
  const apres = await neuf.lireTout('contextesProspectifs');
  assert.deepEqual(rappelsParContexte(apres), avant);
  for (const id of avant.keys()) assert.deepEqual(restituerRappel(id, apres), restituerRappel(id, contextes), id);
  const memoire = creerMemoire(creerMagasinMemoire());
  const tablesMemoire = Object.keys(await memoire.exporterDonnees());
  const fichier = await construireSauvegardeComplete({ memoire, magasinLangage: neuf, idNaissance: 'id', versionAppli: '0.66.14', maintenant: new Date('2026-10-30T09:00:00Z') });
  const lue = await lireSauvegardeComplete(fichier.contenu, { tablesMemoire });
  assert.equal(lue.ok, true, lue.erreur);
  const restaure = magasinMemoireVive();
  await restaure.remplacerTout(lue.donnees.langage);
  const importes = await restaure.lireTout('contextesProspectifs');
  assert.deepEqual(rappelsParContexte(importes), avant);
  for (const id of avant.keys()) assert.deepEqual(restituerRappel(id, importes), restituerRappel(id, contextes), id);
});

test('14. RESTITUTION COMPLÈTE : pour chaque contexte, la chaîne rend toutes les issues de R d\'autres actes écrites avant son T2, et rien d\'autre', async () => {
  const { w } = await vecuLong();
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  const issues = await w.magasin.lireTout(T);
  const parContexte = new Map(contextes.map((c) => [c.id, c]));
  const rang = (table, id) => JOURNAL.findIndex((j) => j.table === table && j.id === id);
  let chaines = 0;
  for (const c of contextes.filter((x) => Object.hasOwn(x, 'rappel'))) {
    const t2 = rang('contextesProspectifs', c.id);
    assert.ok(t2 >= 0, c.id);
    const attendues = issues.filter((l) => {
      const k = rang(T, l.id); assert.ok(k >= 0, l.id);
      const cl = parContexte.get(l.idContexte);
      return k < t2 && l.idDesignation !== c.idDesignation && cl.retrouvaille.statut === 'retrouvee' && memesRelations(relationDe(cl), relationDe(c));
    });
    const restitue = restituerRappel(c.id, contextes);
    assert.equal(restitue.statut, 'complet', c.id); assert.deepEqual(restitue.nonLues, []);
    assert.deepEqual(new Map(restitue.issues.map((i) => [i.idIssue, i])), new Map(attendues.map((l) => [l.id, ISSUE(l.id, l.idContexte, l.observe.statut)])), c.id);
    if (attendues.length >= 2) chaines += 1;
  }
  assert.ok(chaines > 0, 'des chaînes à plusieurs issues sont restituées');
});

test('15. CROISSANCE LINÉAIRE (scénario long) : total des issues des rappels ≤ lignes de issuesRetrouvailles × contextes par acte ; une issue n\'est stockée que par un seul acte', async () => {
  const { w } = await vecuLong();
  const contextes = await w.magasin.lireTout('contextesProspectifs');
  const issues = await w.magasin.lireTout(T);
  const parActe = new Map();
  for (const c of contextes) parActe.set(c.idDesignation, (parActe.get(c.idDesignation) || 0) + 1);
  const contextesParActe = Math.max(...parActe.values());
  const avecRappel = contextes.filter((c) => Object.hasOwn(c, 'rappel'));
  const total = avecRappel.reduce((s, c) => s + c.rappel.issues.length, 0);
  assert.ok(issues.length >= 10 && total > 0, `scénario long : ${issues.length} issues, ${total} stockées`);
  assert.ok(total <= issues.length * contextesParActe, `${total} ≤ ${issues.length} × ${contextesParActe}`);
  const actesParIssue = new Map();
  for (const c of avecRappel) for (const i of c.rappel.issues) actesParIssue.set(i.idIssue, new Set([...(actesParIssue.get(i.idIssue) || []), c.idDesignation]));
  for (const [id, actes] of actesParIssue) assert.equal(actes.size, 1, id);
});

test('16. GARDES (producteurs) : les quatre producteurs appellent rappelsDesContextes entre la retrouvaille et l\'écriture, transmettent le rappel s\'il n\'est pas null ; aucun lecteur hors écrivain, forme et calcul ; « relation » absent de capacite.js', () => {
  const fichiersJs = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? fichiersJs(p) : /\.(js|html)$/.test(p) ? [p] : []; });
  const rel = (f) => f.slice(RACINE.length + 1);
  for (const p of ['capacite', 'prospection-soi', 'environnement-conversation', 'execution-sollicitee']) {
    const code = sansCommentaires(lu('app', 'langage', `${p}.js`));
    assert.match(code, /^import \{ rappelsDesContextes \} from '\.\/rappels\.js';$/m, p);
    assert.equal((code.match(/rappelsDesContextes\(/g) || []).length, 1, p);
    assert.match(code, /const rappels = await rappelsDesContextes\(magasin, retrouvailles, (acte|designation)\);/, p);
    assert.equal((code.match(/\.\.\.\(rappels\[k\] === null \? \{\} : \{ rappel: rappels\[k\] \}\)/g) || []).length, 1, p);
    const iR = code.indexOf('retrouvaillesDesContextes(contextes'); const iP = code.indexOf('rappelsDesContextes(magasin'); const iE = code.indexOf('enregistrerContexteProspectif(magasin');
    assert.ok(iR > 0 && iR < iP && iP < iE, `${p} : retrouvaille → rappel → écriture`);
    assert.ok(iE < code.indexOf('enregistrerAttenteProspective('), `${p} : avant toute attente`);
    assert.equal((code.match(/rappel/g) || []).length, 7, `${p} : import (2), constante, appel, transmission (3) — rien d'autre`);
  }
  assert.doesNotMatch(sansCommentaires(lu('app', 'langage', 'capacite.js')), /relation/i, 'capacite.js ne nomme pas la relation');
  const importeurs = (m) => fichiersJs(join(RACINE, 'app')).filter((f) => new RegExp(`from '\\.{1,2}/(langage/)?${m}\\.js'`).test(readFileSync(f, 'utf8'))).map(rel).sort();
  assert.deepEqual(importeurs('rappels'), ['app/langage/capacite.js', 'app/langage/environnement-conversation.js', 'app/langage/execution-sollicitee.js', 'app/langage/prospection-soi.js']);
  assert.deepEqual(importeurs('rappel-forme'), ['app/langage/connaissances.js', 'app/langage/rappels.js']);
  // lecteurs du champ : l'écrivain, la forme, le calcul, et la transmission des quatre producteurs ; ni attentes, ni issues, ni décision
  const lecteurs = fichiersJs(join(RACINE, 'app')).filter((f) => /\.rappel\b|'rappel'|\brappel:/.test(sansCommentaires(readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(lecteurs, ['app/langage/capacite.js', 'app/langage/connaissances.js', 'app/langage/environnement-conversation.js', 'app/langage/execution-sollicitee.js', 'app/langage/prospection-soi.js', 'app/langage/rappel-forme.js', 'app/langage/rappels.js']);
  for (const f of ['rappels', 'rappel-forme']) assert.doesNotMatch(sansCommentaires(lu('app', 'langage', `${f}.js`)), /idDesignation/, `${f} : garde J1`);
  assert.equal(VERSION_BASE, 30); assert.equal(SCHEMA_SAUVEGARDE, 20); assert.equal(TABLES.length, 36);
});
