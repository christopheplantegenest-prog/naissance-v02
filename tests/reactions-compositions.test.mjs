// === DEBUT_TEST_REACTIONS_COMPOSITIONS ===
// v0.62.5 — ÉTAPE 6, décision ChatGPT « RÉACTIONS EXPLICITEMENT LIÉES À UNE COMPOSITION RÉUSSIE »
// (03/10/2026). Teste la vue PURE ET DORMANTE vueReactionsSurCompositions() : pour une observation de
// composition réussie, quels énoncés / actes / expériences se réfèrent EXPLICITEMENT à la même trace ?
// Identité `idTrace` uniquement -- jamais d'horodatage, de texte, d'opération, de proximité ni de
// provenance. Aucun champ qui qualifie une réaction ; aucune table, aucun magasin, aucun appel de production.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { vueReactionsSurCompositions as vue } from '../app/langage/reactions-compositions.js';
import { apprendreFait, apprendreRegle } from '../app/langage/esprit.js';
import { magasinMemoireVive, apprendreAction, enregistrerExperience, ajouterInterpretation, enregistrerEnonceSurTrace, enregistrerActe } from '../app/langage/connaissances.js';
import { evaluerAction } from '../app/langage/action.js';
import { monterEcranLangage } from '../app/langage/ecran.js';

const obs = (id, idTrace, extra = {}) => ({ id, horodatage: '2026-10-03T10:00:00.000Z', operation: 'confrontation', idTrace, roleNonResolu: idTrace ? null : 'relation', roles: [], ...extra });
const trace = (id) => ({ id, voie: 'composition', capacite: 'confrontation' });
const enonce = (id, idTrace, texte = 'Non, c\'était plutôt une déduction.') => ({ id, idTrace, texte, horodatage: '2026-10-03T10:01:00.000Z', origine: 'interface' });
const acte = (id, idTrace) => ({ id, idTrace, horodatage: '2026-10-03T10:02:00.000Z', origine: 'interface' });
const experience = (id, idTrace, extra = {}) => ({
  id, texteRecu: 'q ?', texteRepondu: 'r', date: '2026-10-03T10:03:00.000Z', source: 'laboratoire', referenceMemoire: null,
  referenceTrace: idTrace === undefined ? undefined : idTrace === null ? null : { idTrace }, interpretations: [], ...extra,
});
const clone = (x) => JSON.parse(JSON.stringify(x));

// ============================================================================ A–L
test('A. observation réussie + trace + 1 énoncé : un élément, l\'énoncé brut est conservé', () => {
  const e1 = enonce('en1', 'T1');
  const r = vue([obs('o1', 'T1')], [trace('T1')], [e1], [], []);
  assert.deepEqual(r, [{ idObservation: 'o1', idTrace: 'T1', enonces: [e1], actes: [], experiences: [] }]);
});

test('B. observation réussie SANS réaction : un élément avec trois tableaux vides (≠ absence, ≠ abstention)', () => {
  const r = vue([obs('o1', 'T1')], [trace('T1')], [], [], []);
  assert.deepEqual(r, [{ idObservation: 'o1', idTrace: 'T1', enonces: [], actes: [], experiences: [] }]);
});

test('C. observation d\'abstention (idTrace null) : AUCUN élément, même si des réactions existent par ailleurs', () => {
  const r = vue([obs('o1', null)], [trace('T1')], [enonce('en1', 'T1')], [acte('a1', 'T1')], [experience('x1', 'T1')]);
  assert.deepEqual(r, []);
});

test('D. deux énoncés identiques (même texte, même trace) : DEUX objets, jamais dédoublonnés', () => {
  const r = vue([obs('o1', 'T1')], [trace('T1')], [enonce('en2', 'T1'), enonce('en1', 'T1')], [], []);
  assert.equal(r[0].enonces.length, 2);
  assert.deepEqual(r[0].enonces.map((e) => e.id), ['en1', 'en2']);
  assert.equal(r[0].enonces[0].texte, r[0].enonces[1].texte);
});

test('E. deux expériences de même idTrace : DEUX objets, aucun appariement avec les énoncés (même texte, même trace)', () => {
  const texte = 'est-ce bleu ?';
  const r = vue([obs('o1', 'T1')], [trace('T1')], [enonce('en1', 'T1', texte)], [],
    [experience('x1', 'T1', { texteRecu: texte }), experience('x2', 'T1', { texteRecu: texte })]);
  assert.equal(r[0].experiences.length, 2);
  assert.equal(r[0].enonces.length, 1);
  for (const cle of Object.keys(r[0])) assert.ok(['idObservation', 'idTrace', 'enonces', 'actes', 'experiences'].includes(cle), cle);
  assert.equal(JSON.stringify(r[0]).includes('paire'), false);
});

test('F. expérience avec jugement : conservée TELLE QUELLE (interpretations incluses), aucun champ de jugement dans la vue', () => {
  const x = experience('x1', 'T1', { interpretations: [
    { origine: 'comprendre', donnees: { etat: 'compris' } },
    { origine: 'jugement-christophe', donnees: { jugement: 'incorrect', date: '2026-10-03T10:05:00.000Z' } },
  ] });
  const r = vue([obs('o1', 'T1')], [trace('T1')], [], [], [x]);
  assert.deepEqual(r[0].experiences, [x]);
  assert.deepEqual(Object.keys(r[0]).sort(), ['actes', 'enonces', 'experiences', 'idObservation', 'idTrace']);
  assert.deepEqual(Object.keys(r[0].experiences[0]).sort(), Object.keys(x).sort(), 'aucun champ ajouté à l\'expérience');
  // aucun filtrage selon le jugement : une expérience SANS jugement est présente aussi
  const r2 = vue([obs('o1', 'T1')], [trace('T1')], [], [], [x, experience('x2', 'T1')]);
  assert.equal(r2[0].experiences.length, 2);
  const brut = JSON.stringify(r);
  for (const mot of ['"correct"', '"valence"', '"score"', '"feedback"', '"preference"', '"jugement":']) {
    assert.equal(brut.replace(/"jugement":"incorrect"/g, '').includes(mot), false, mot);
  }
});

test('G. acte lié : présent, tel quel', () => {
  const a = acte('a1', 'T1');
  const r = vue([obs('o1', 'T1')], [trace('T1')], [], [a, acte('a2', 'T1')], []);
  assert.deepEqual(r[0].actes, [a, acte('a2', 'T1')]);
});

test('H. réaction sur une AUTRE trace : absente', () => {
  const r = vue([obs('o1', 'T1')], [trace('T1'), trace('T2')], [enonce('en1', 'T2')], [acte('a1', 'T2')], [experience('x1', 'T2')]);
  assert.deepEqual(r, [{ idObservation: 'o1', idTrace: 'T1', enonces: [], actes: [], experiences: [] }]);
});

test('I. deux observations proches avec traces différentes : réactions correctement séparées', () => {
  const r = vue(
    [obs('o2', 'T2', { horodatage: '2026-10-03T10:00:00.001Z' }), obs('o1', 'T1', { horodatage: '2026-10-03T10:00:00.000Z' })],
    [trace('T1'), trace('T2')],
    [enonce('en1', 'T1'), enonce('en2', 'T2')], [acte('a2', 'T2')], [experience('x1', 'T1')],
  );
  assert.deepEqual(r.map((e) => e.idObservation), ['o1', 'o2']);
  assert.deepEqual(r[0].enonces.map((e) => e.id), ['en1']);
  assert.deepEqual(r[0].actes, []);
  assert.deepEqual(r[0].experiences.map((e) => e.id), ['x1']);
  assert.deepEqual(r[1].enonces.map((e) => e.id), ['en2']);
  assert.deepEqual(r[1].actes.map((e) => e.id), ['a2']);
  assert.deepEqual(r[1].experiences, []);
});

test('J. observation dont idTrace est ORPHELIN (aucune trace de cet id en entrée) : absente, même avec des réactions', () => {
  const r = vue([obs('o1', 'T-fantome')], [trace('T1')], [enonce('en1', 'T-fantome')], [], []);
  assert.deepEqual(r, []);
  assert.deepEqual(vue([obs('o1', 'T1')], [], [], [], []), [], 'aucune trace du tout');
});

test('K. DONNÉES ARTIFICIELLES : deux observations de même trace -> deux éléments, JAMAIS fusionnés ; même id d\'observation -> conservées toutes les deux', () => {
  const e1 = enonce('en1', 'T1');
  const r = vue([obs('o2', 'T1'), obs('o1', 'T1')], [trace('T1')], [e1], [], []);
  assert.equal(r.length, 2);
  assert.deepEqual(r.map((e) => e.idObservation), ['o1', 'o2']);
  assert.deepEqual(r[0].enonces, [e1]);
  assert.deepEqual(r[1].enonces, [e1]);
  assert.notEqual(r[0].enonces[0], r[1].enonces[0], 'copies distinctes, pas la même référence');
  const doublon = vue([obs('o1', 'T1'), obs('o1', 'T1', { operation: 'autre' })], [trace('T1')], [], [], []);
  assert.equal(doublon.length, 2, 'même id : rien n\'est écrasé ni choisi');
});

test('L. COPIES : muter la sortie ne modifie JAMAIS les entrées (et inversement)', () => {
  const e1 = enonce('en1', 'T1');
  const x = experience('x1', 'T1', { interpretations: [{ origine: 'jugement-christophe', donnees: { jugement: 'correct' } }] });
  const a = acte('a1', 'T1');
  const entrees = { observations: [obs('o1', 'T1')], traces: [trace('T1')], enonces: [e1], actes: [a], experiences: [x] };
  const avant = clone(entrees);
  const r = vue(entrees.observations, entrees.traces, entrees.enonces, entrees.actes, entrees.experiences);
  assert.notEqual(r[0].enonces[0], e1);
  assert.notEqual(r[0].actes[0], a);
  assert.notEqual(r[0].experiences[0], x);
  assert.notEqual(r[0].experiences[0].interpretations, x.interpretations);
  r[0].enonces[0].texte = 'MUTÉ';
  r[0].actes[0].idTrace = 'MUTÉ';
  r[0].experiences[0].interpretations[0].donnees.jugement = 'MUTÉ';
  r[0].enonces.push('MUTÉ');
  r.length = 0;
  assert.deepEqual(entrees, avant);
  // et inversement : muter l'entrée après l'appel ne change pas le résultat déjà rendu
  const r2 = vue(entrees.observations, entrees.traces, entrees.enonces, entrees.actes, entrees.experiences);
  const figé = clone(r2);
  e1.texte = 'ENTRÉE MUTÉE';
  assert.deepEqual(r2, figé);
});

// ============================================================================ CONTRAT / POLITIQUE
test('forme exacte de l\'élément : seulement idObservation, idTrace, enonces, actes, experiences ; la trace n\'est pas recopiée', () => {
  const t = { id: 'T1', voie: 'composition', capacite: 'confrontation', resultat: { gros: 'objet' }, argumentsUtilises: { a: 1 } };
  const [el] = vue([obs('o1', 'T1')], [t], [], [], []);
  assert.deepEqual(Object.keys(el), ['idObservation', 'idTrace', 'enonces', 'actes', 'experiences']);
  assert.equal(JSON.stringify(el).includes('gros'), false);
  assert.equal(JSON.stringify(el).includes('roles'), false, 'ni les candidates ni aucun contenu de l\'observation');
});

test('JOINTURE par identité EXACTE uniquement : pas de trim, pas de casse, pas de préfixe, pas de texte, pas de proximité', () => {
  const r = vue([obs('o1', 'T1')], [trace('T1'), trace('t1'), trace('T1 ')], [
    enonce('e-a', 't1'), enonce('e-b', 'T1 '), enonce('e-c', ' T1'), enonce('e-d', 'T10'), enonce('e-e', 'T'),
  ], [], [experience('x', 'T1 ')]);
  assert.deepEqual(r[0].enonces, []);
  assert.deepEqual(r[0].experiences, []);
  // même texte, même horodatage, même opération que l'observation ne créent aucun lien
  const r2 = vue([obs('o1', 'T1', { horodatage: 'H', operation: 'confrontation' })], [trace('T1'), trace('T2')],
    [{ id: 'e', idTrace: 'T2', texte: 'confrontation', horodatage: 'H', origine: 'interface' }], [], []);
  assert.deepEqual(r2[0].enonces, []);
});

test('ORDRE déterministe issu des identités : permuter les entrées ne change jamais la sortie ; trois collections séparées', () => {
  const O = [obs('o3', 'T3'), obs('o1', 'T1'), obs('o2', 'T2')];
  const Tr = [trace('T1'), trace('T2'), trace('T3')];
  const E = [enonce('en3', 'T1'), enonce('en1', 'T1'), enonce('en2', 'T1')];
  const A = [acte('a2', 'T1'), acte('a1', 'T1')];
  const X = [experience('x2', 'T1'), experience('x1', 'T1')];
  const ref = vue(O, Tr, E, A, X);
  assert.deepEqual(ref.map((e) => e.idObservation), ['o1', 'o2', 'o3']);
  assert.deepEqual(ref[0].enonces.map((e) => e.id), ['en1', 'en2', 'en3']);
  assert.deepEqual(ref[0].actes.map((e) => e.id), ['a1', 'a2']);
  assert.deepEqual(ref[0].experiences.map((e) => e.id), ['x1', 'x2']);
  const inv = (t) => t.slice().reverse();
  assert.deepEqual(vue(inv(O), inv(Tr), inv(E), inv(A), inv(X)), ref);
  assert.deepEqual(vue([O[1], O[2], O[0]], [Tr[2], Tr[0], Tr[1]], [E[1], E[2], E[0]], [A[1], A[0]], [X[1], X[0]]), ref);
  // aucune chronologie commune : pas de champ d'ordre global
  assert.equal(Object.keys(ref[0]).some((k) => /ordre|chrono|sequence|temps/i.test(k)), false);
});

test('ORDRE : ids identiques ou absents départagés par la sérialisation (pas par l\'ordre d\'entrée)', () => {
  const a = { idTrace: 'T1', texte: 'b' };
  const b = { idTrace: 'T1', texte: 'a' };
  const r1 = vue([obs('o1', 'T1')], [trace('T1')], [a, b], [], []);
  const r2 = vue([obs('o1', 'T1')], [trace('T1')], [b, a], [], []);
  assert.deepEqual(r1, r2);
  assert.equal(r1[0].enonces.length, 2);
});

test('DONNÉES MALFORMÉES : un argument non tableau est REJETÉ (TypeError) ; les éléments invalides sont IGNORÉS sans bruit', () => {
  const ok = [[], [], [], [], []];
  for (let i = 0; i < 5; i += 1) {
    for (const mauvais of [null, undefined, {}, 'x', 3]) {
      const args = ok.slice(); args[i] = mauvais;
      assert.throws(() => vue(...args), TypeError, `argument ${i} = ${String(mauvais)}`);
    }
  }
  const e1 = enonce('en1', 'T1');
  const r = vue(
    [null, 7, 'x', [], obs('', 'T1'), obs('oX', ''), obs('oY', 7), obs('oZ', null), { idTrace: 'T1' }, obs('o1', 'T1')],
    [null, 7, { voie: 'sans id' }, { id: '' }, { id: 7 }, trace('T1')],
    [null, 7, 'x', [], { id: 'e0' }, { id: 'e1', idTrace: '' }, { id: 'e2', idTrace: 7 }, { id: 'e3', idTrace: null }, e1],
    [null, 'x', { id: 'a0' }, { id: 'a1', idTrace: 7 }],
    [null, 3, { id: 'x0' }, experience('x1', undefined), experience('x2', null), { id: 'x3', referenceTrace: 'T1' }, { id: 'x4', referenceTrace: [] },
      { id: 'x5', referenceTrace: {} }, { id: 'x6', referenceTrace: { idTrace: '' } }, { id: 'x7', referenceTrace: { idTrace: 7 } }, experience('x8', 'T1')],
  );
  assert.deepEqual(r.map((e) => e.idObservation), ['o1']);
  assert.deepEqual(r[0].enonces, [e1]);
  assert.deepEqual(r[0].actes, []);
  assert.deepEqual(r[0].experiences.map((e) => e.id), ['x8']);
});

test('DONNÉES MALFORMÉES : trace sans id valide ne valide pas une observation ; doublons d\'id de TRACE sans effet', () => {
  assert.deepEqual(vue([obs('o1', 'T1')], [{ id: 7 }, { nom: 'T1' }, { id: '' }], [], [], []), []);
  const r = vue([obs('o1', 'T1')], [trace('T1'), trace('T1')], [], [], []);
  assert.equal(r.length, 1, 'une trace dupliquée ne multiplie pas les éléments');
});

test('ABSENCE de réaction ≠ abstention : succès sans réaction présent, abstention absente, dans la même sortie', () => {
  const r = vue([obs('o1', 'T1'), obs('o2', null)], [trace('T1')], [], [], []);
  assert.deepEqual(r.map((e) => e.idObservation), ['o1']);
});

test('aucune lecture de roleNonResolu / candidates / operation : seule l\'identité idTrace compte', () => {
  const o = obs('o1', 'T1', { roleNonResolu: 'relation', operation: 'n-importe-quoi', roles: [{ role: 'x', candidates: [{ idLiaison: 'l', etat: 'utilisable', idTraceSource: 'T9', valeur: 'v' }] }] });
  const r = vue([o], [trace('T1'), trace('T9')], [enonce('en9', 'T9')], [], []);
  assert.deepEqual(r[0].enonces, [], 'idTraceSource (T9) ne sert jamais de jointure');
});

// ============================================================================ DONNÉES RÉELLES (vrais objets persistés)
test('VRAIES DONNÉES : observation réelle d\'une composition réussie jointe à son énoncé, son acte et son expérience réels', async () => {
  const universel = () => new Proxy(function () {}, {
    get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : (k in t ? t[k] : universel())), set: () => true, apply: () => universel(),
  });
  const magasin = magasinMemoireVive();
  const ecran = monterEcranLangage({ zone: { querySelector: () => universel() }, ouvrirStockage: async () => magasin, confirmer: () => true });
  const e = await ecran.assurerEsprit();
  await apprendreFait(e, { sujet: 'zorbo', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreFait(e, { sujet: 'zkelmi', relation: 'zcouleur', valeur: 'zbleu' });
  await apprendreRegle(e, { role: 'zrole1', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'zcouleur' });
  await apprendreRegle(e, { role: 'zrole2', conditions: [{ propriete: 'zcouleur', valeur: 'zbleu' }], resultat: 'ztaille' });
  const ev = evaluerAction({ operation: 'deduction', roles: ['sujet', 'role'], exemples: ['zdeduit zorbo zrole1', 'zdeduit zkelmi zrole1', 'zdeduit zorbo zrole2'] });
  await apprendreAction(magasin, { ...ev, operation: 'deduction' });
  e.actions = await magasin.lireTout('actions');
  await ecran.confirmerLiaison({ capaciteSource: 'deduction', champ: 'resultat', capaciteCible: 'confrontation', role: 'relation' });
  await ecran.confirmerLiaison({ capaciteSource: 'accessibilite', champ: 'etat', capaciteCible: 'confrontation', role: 'relation' });
  await ecran.tenterReconnaissanceAction('zdeduit zorbo zrole1');
  await ecran.invoquerComposition({ operation: 'accessibilite', argumentsExplicites: { sujetA: 'zorbo', operateur: 'zcouleur', sujetB: 'zkelmi' } });
  const b1 = await ecran.invoquerComposition({ operation: 'confrontation', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' } });
  const b2 = await ecran.invoquerComposition({ operation: 'confrontation', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' } });
  e.derniersResultats.delete('deduction'); e.originesResultats.delete('deduction');
  const abst = await ecran.invoquerComposition({ operation: 'confrontation', argumentsExplicites: { sujetA: 'zorbo', sujetB: 'zkelmi' } });
  assert.equal(b1.ok && b2.ok, true);
  assert.equal(abst.ok, false);

  const en1 = await enregistrerEnonceSurTrace(magasin, { idTrace: b1.idTrace, texte: 'non, c\'était plutôt une déduction' });
  const en2 = await enregistrerEnonceSurTrace(magasin, { idTrace: b1.idTrace, texte: 'non, c\'était plutôt une déduction' });
  const ac = await enregistrerActe(magasin, { idTrace: b1.idTrace });
  const xp = await enregistrerExperience(magasin, { texteRecu: 'est-ce bleu ?', texteRepondu: 'oui', date: new Date().toISOString(), source: 'laboratoire', referenceMemoire: null, referenceTrace: { idTrace: b1.idTrace } });
  await ajouterInterpretation(magasin, xp.id, { origine: 'jugement-christophe', donnees: { jugement: 'incorrect', date: new Date().toISOString() } });

  const lire = async (t) => magasin.lireTout(t);
  const entrees = [await lire('observationsComposition'), await lire('traces'), await lire('enonces'), await lire('actes'), await lire('experiences')];
  const avant = clone(entrees);
  const r = vue(...entrees);
  assert.deepEqual(entrees, avant, 'entrées intactes');
  assert.equal(entrees[0].length, 3, 'deux réussites + une abstention observées');
  assert.equal(r.length, 2, 'l\'abstention n\'entre pas dans la vue');
  const e1 = r.find((x) => x.idTrace === b1.idTrace);
  const e2 = r.find((x) => x.idTrace === b2.idTrace);
  assert.deepEqual(e1.enonces.map((x) => x.id).sort(), [en1.id, en2.id].sort());
  assert.deepEqual(e1.actes.map((x) => x.id), [ac.id]);
  assert.deepEqual(e1.experiences.map((x) => x.id), [xp.id]);
  assert.equal(e1.experiences[0].interpretations.some((i) => i.origine === 'jugement-christophe'), true, 'jugement conservé DANS l\'expérience copiée');
  assert.deepEqual([e2.enonces, e2.actes, e2.experiences], [[], [], []], 'la composition voisine n\'hérite d\'aucune réaction');
  const obsPour = entrees[0].find((o) => o.idTrace === b1.idTrace);
  assert.equal(e1.idObservation, obsPour.id);
  // lecture d'une observation d'abstention : aucun élément, quoi qu'il arrive ensuite
  const obsAbst = entrees[0].find((o) => o.idTrace === null);
  assert.equal(r.some((x) => x.idObservation === obsAbst.id), false);
});

// ============================================================================ STATIQUE : DORMANTE
const RACINE = join(import.meta.dirname, '..');
const sansCommentaires = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
function fichiersJs(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) { if (nom !== 'node_modules') fichiersJs(chemin, sortie); } else if (nom.endsWith('.js')) sortie.push(chemin);
  }
  return sortie;
}
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'reactions-compositions.js'), 'utf8');
const CODE = sansCommentaires(SOURCE);

test('DORMANTE : aucun fichier de production n\'importe ni ne nomme la primitive ou son module', () => {
  const fichiers = [...fichiersJs(join(RACINE, 'app')), join(RACINE, 'sw.js'), join(RACINE, 'worker.js'), join(RACINE, 'index.html')];
  for (const f of fichiers) {
    if (f.endsWith('reactions-compositions.js')) continue;
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    assert.equal(/reactions-compositions|vueReactionsSurCompositions/.test(sansCommentaires(src)), false, `${relative(RACINE, f)} ne doit jamais l'utiliser`);
  }
});

test('DORMANTE : le module n\'importe RIEN et n\'accède à aucun magasin, base, capacité ni mécanisme de choix', () => {
  assert.equal(/^\s*import\b/m.test(CODE), false, 'aucun import statique');
  assert.equal(/\bimport\s*\(/.test(CODE), false, 'aucun import dynamique');
  assert.equal(/\brequire\s*\(/.test(CODE), false);
  for (const interdit of ['magasin', 'lireTout', '.ecrire', 'supprimer(', 'indexedDB', 'IndexedDB', 'localStorage', 'fetch(', 'await ', 'async ', 'Date.now', 'new Date', 'Math.random',
    'observationsComposition', 'valeurLiee', 'provenanceLiaisons', 'derniersResultats', 'originesResultats', 'tenterRejeu', 'possibilitesRejeu', 'invoquer', 'CAPACITES', 'liaisons']) {
    assert.equal(CODE.includes(interdit), false, `le code ne doit pas contenir « ${interdit} »`);
  }
  assert.equal(/\.find\(/.test(CODE), false, 'aucun `.find` (la sélection de liaison n\'est pas son affaire)');
});

test('DORMANTE : aucun vocabulaire de valeur (score, récompense, préférence, correct, incorrect, jugement, valence, feedback) dans le code', () => {
  for (const mot of [/score/i, /reward/i, /r[ée]compense/i, /pr[ée]f[ée]rence/i, /\bcorrect/i, /incorrect/i, /jugement/i, /valence/i, /feedback/i, /majorit/i, /confiance/i, /seuil/i, /ratio/i]) {
    assert.equal(mot.test(CODE), false, `le code ne doit pas contenir ${mot}`);
  }
});

test('DORMANTE : composition.js, valeurLiee, `.find`, rejeu et provenanceLiaisons sont inchangés par ce chantier (garde-fous textuels)', () => {
  const comp = readFileSync(join(RACINE, 'app', 'langage', 'composition.js'), 'utf8');
  assert.equal(/reactions-compositions|vueReactionsSurCompositions/.test(comp), false);
  assert.match(comp, /\(esprit\.liaisons \|\| \[\]\)\.find\(\(l\) => l\.statut === 'validee'/);
  const ecran = readFileSync(join(RACINE, 'app', 'langage', 'ecran.js'), 'utf8');
  assert.equal(/reactions-compositions|vueReactionsSurCompositions/.test(ecran), false);
  assert.equal((comp.match(/provenanceLiaisons/g) || []).length > 0, true);
});

test('PURETÉ : appels répétés identiques, aucune propriété ajoutée aux entrées, aucune dépendance à l\'état global', () => {
  const entrees = [[obs('o1', 'T1')], [trace('T1')], [enonce('en1', 'T1')], [acte('a1', 'T1')], [experience('x1', 'T1')]];
  const gele = (x) => { Object.freeze(x); if (x && typeof x === 'object') Object.values(x).forEach(gele); return x; };
  entrees.forEach(gele); // toute écriture sur une entrée lèverait (modules ES = mode strict)
  const a = vue(...entrees);
  const b = vue(...entrees);
  assert.deepEqual(a, b);
  assert.notEqual(a, b);
});
// === FIN_TEST_REACTIONS_COMPOSITIONS ===
