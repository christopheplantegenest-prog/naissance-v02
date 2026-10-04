// === DEBUT_TEST_STRUCTURE_IDENTIFIEE ===
// v0.62.6 — ÉTAPE 6, décision ChatGPT « STRUCTURE DE TEXTES IDENTIFIÉS » (04/10/2026). Teste l'enveloppe PURE ET
// DORMANTE decrireStructureIdentifiee() : { id, texte }[] -> { couverture, rapport }, où `rapport` est la sortie
// exacte de decrireStructure() et `couverture` les ids réellement transmis, dans l'ordre exact de la description.
// Aucune découverte de groupe, aucune partition, aucune stratégie d'échec, aucune interprétation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { decrireStructureIdentifiee as decrire } from '../app/langage/structure-identifiee.js';
import { decrireStructure } from '../app/langage/extraction.js';

const R1 = 'Non, c\'était plutôt une déduction.';
const R3 = 'Non, c\'était plutôt une recherche.';
const R4 = 'Oui, c\'était bien une déduction.';
const R5 = 'C\'était plutôt une déduction ?';
const el = (id, texte) => ({ id, texte });
const permutations = (t) => (t.length <= 1 ? [t] : t.flatMap((x, i) => permutations([...t.slice(0, i), ...t.slice(i + 1)]).map((p) => [x, ...p])));
const gele = (x) => { Object.freeze(x); if (x && typeof x === 'object') Object.values(x).forEach(gele); return x; };

// ============================================================================ A–C : cas de vérité
test('A. deux textes identiques : couverture [E1,E2], rapport = répétition exacte (1 distinct, toutes positions ancrées)', () => {
  const r = decrire([el('E1', R1), el('E2', R1)]);
  assert.deepEqual(r.couverture, ['E1', 'E2']);
  assert.equal(r.rapport.ok, true);
  assert.equal(r.rapport.occurrences, 2);
  assert.equal(r.rapport.exemplesDistincts, 1);
  assert.equal(r.rapport.n, 7);
  assert.equal(r.rapport.ancres.length, 7);
  assert.deepEqual(r.rapport.positionsVariables, []);
  assert.deepEqual(r.rapport.diversite, {});
});

test('B. même arité, une position variable : le rapport est celui de decrireStructure, la couverture garde les deux ids', () => {
  const r = decrire([el('E1', R1), el('E3', R3)]);
  assert.deepEqual(r.couverture, ['E1', 'E3']);
  assert.equal(r.rapport.ok, true);
  assert.deepEqual(r.rapport.positionsVariables, [5]);
  assert.deepEqual(r.rapport.diversite[5].valeursDistinctes, ['déduction', 'recherche']);
  assert.deepEqual(r.rapport, decrireStructure([R1, R3]));
});

test('C. arités incompatibles (7 contre 5 tokens) : échec CONSERVÉ avec la couverture complète, rien retiré ni partitionné', () => {
  const r = decrire([el('E1', R1), el('E5', R5)]);
  assert.deepEqual(r.couverture, ['E1', 'E5']);
  assert.equal(r.rapport.ok, false);
  assert.equal(r.rapport.raison, 'arites_incompatibles');
  assert.match(r.rapport.detail, /\(7, 5\)/);
  assert.deepEqual(r.rapport, decrireStructure([R1, R5]));
});

// ============================================================================ D–F : déterminisme et alignement
test('D. entrée inversée : même sortie', () => {
  const a = decrire([el('E1', R1), el('E3', R3), el('E4', R4)]);
  const b = decrire([el('E4', R4), el('E3', R3), el('E1', R1)]);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'même ordre de clés et de valeurs, pas seulement deepEqual');
});

test('E. toutes les permutations de quatre éléments : même sortie, y compris l\'ordre de valeursDistinctes', () => {
  const base = [el('E1', R1), el('E3', R3), el('E4', R4), el('E7', R1)];
  const ref = JSON.stringify(decrire(base));
  for (const p of permutations(base)) assert.equal(JSON.stringify(decrire(p)), ref);
  // et le rapport dépend bien de l'ordre transmis à decrireStructure (sinon le tri serait sans objet)
  assert.notEqual(JSON.stringify(decrireStructure([R1, R3, R4])), JSON.stringify(decrireStructure([R4, R3, R1])));
});

test('F. couverture exactement alignée avec l\'ordre de description (id triés par unités de code)', () => {
  // Les ids sont donnés dans le désordre ; l'ordre de diversite.valeursDistinctes révèle l'ordre réellement décrit.
  const r = decrire([el('b', R3), el('B', R4), el('a', R1)]);
  assert.deepEqual(r.couverture, ['B', 'a', 'b'], 'majuscule avant minuscule : ordre des unités de code, pas de localeCompare');
  assert.deepEqual(r.rapport, decrireStructure([R4, R1, R3]), 'les textes sont décrits dans exactement l\'ordre de la couverture');
  assert.deepEqual(r.rapport.diversite[0].valeursDistinctes, ['Oui', 'Non']);
  const ids2 = decrire([el('E10', R1), el('E2', R3)]);
  assert.deepEqual(ids2.couverture, ['E10', 'E2'], 'tri lexicographique, pas numérique');
});

// ============================================================================ G–O : refus (TypeError)
test('G. id dupliqué + même texte → TypeError', () => {
  assert.throws(() => decrire([el('E1', R1), el('E1', R1)]), TypeError);
});

test('H. id dupliqué + textes différents → TypeError', () => {
  assert.throws(() => decrire([el('E1', R1), el('E1', R3)]), TypeError);
  assert.throws(() => decrire([el('E1', R1), el('E2', R3), el('E1', R4)]), TypeError);
});

test('I. id vide → TypeError', () => {
  assert.throws(() => decrire([el('', R1), el('E2', R3)]), TypeError);
});

test('J. id non chaîne → TypeError (aucune conversion)', () => {
  for (const id of [1, null, undefined, true, {}, [], ['E1']]) assert.throws(() => decrire([el(id, R1), el('E2', R3)]), TypeError);
  assert.throws(() => decrire([{ texte: R1 }, el('E2', R3)]), TypeError, 'id absent');
});

test('K. texte vide → TypeError', () => {
  assert.throws(() => decrire([el('E1', ''), el('E2', R3)]), TypeError);
});

test('L. texte entièrement blanc → TypeError (jamais filtré en silence par decrireStructure)', () => {
  for (const t of [' ', '   ', '\t', '\n', '   ', '\r\n ']) assert.throws(() => decrire([el('E1', t), el('E2', R3)]), TypeError);
});

test('M. texte non chaîne → TypeError', () => {
  for (const t of [42, null, undefined, true, {}, ['a'], Symbol('x')]) assert.throws(() => decrire([el('E1', t), el('E2', R3)]), TypeError);
  assert.throws(() => decrire([{ id: 'E1' }, el('E2', R3)]), TypeError, 'texte absent');
});

test('N. élément null / tableau / non-objet → TypeError', () => {
  for (const x of [null, undefined, [], ['E1', R1], 'E1', 7, true, () => ({ id: 'E1', texte: R1 })]) assert.throws(() => decrire([x, el('E2', R3)]), TypeError);
});

test('O. argument non tableau → TypeError', () => {
  for (const x of [undefined, null, {}, 'E1', 3, { length: 2, 0: el('E1', R1), 1: el('E2', R3) }, new Set([el('E1', R1)]), new Map()]) assert.throws(() => decrire(x), TypeError);
  assert.throws(() => decrire(), TypeError);
});

test('un refus ne laisse aucune sortie partielle ni ne mute les entrées (validation avant tout appel)', () => {
  const entree = [el('E1', R1), el('E2', '  ')];
  const avant = JSON.stringify(entree);
  assert.throws(() => decrire(entree), TypeError);
  assert.equal(JSON.stringify(entree), avant);
});

// ============================================================================ P–Q : groupe vide / un membre
test('P. groupe vide : couverture [] et rapport RÉEL « insuffisant » de decrireStructure([])', () => {
  const r = decrire([]);
  assert.deepEqual(r.couverture, []);
  assert.equal(r.rapport.ok, false);
  assert.equal(r.rapport.raison, 'insuffisant');
  assert.deepEqual(r.rapport, decrireStructure([]));
});

test('Q. membre unique : couverture [E1] et rapport RÉEL « insuffisant » de decrireStructure([texte])', () => {
  const r = decrire([el('E1', R1)]);
  assert.deepEqual(r.couverture, ['E1']);
  assert.equal(r.rapport.ok, false);
  assert.equal(r.rapport.raison, 'insuffisant');
  assert.deepEqual(r.rapport, decrireStructure([R1]));
});

// ============================================================================ R–S : textes transmis sans modification
test('R. espaces de bord d\'un texte valide transmis sans modification (aucun trim)', () => {
  const brut = `  ${R1}\n`;
  // le rapport est celui d'un appel avec le texte BRUT : on le prouve contre decrireStructure
  const r = decrire([el('E1', brut), el('E2', R1)]);
  assert.deepEqual(r.rapport, decrireStructure([brut, R1]));
  assert.equal(r.rapport.exemplesDistincts, 1, 'decrireStructure ignore elle-même les espaces de bord pour « distincts »');
  // un texte à espaces de bord reste valide ; seul un texte ENTIÈREMENT blanc est refusé
  assert.doesNotThrow(() => decrire([el('E1', ` ${R1} `), el('E2', R3)]));
});

test('S. casse, accents et ponctuation transmis sans modification', () => {
  const a = 'NON, c\'était PLUTÔT une déduction.';
  const b = 'non, c\'était plutôt une déduction.';
  const r = decrire([el('E1', a), el('E2', b)]);
  assert.deepEqual(r.rapport, decrireStructure([a, b]));
  assert.equal(r.rapport.exemplesDistincts, 2, 'la casse reste une différence');
  assert.deepEqual(r.rapport.positionsVariables, [0, 3]);
  assert.deepEqual(r.rapport.diversite[0].valeursDistinctes, ['NON', 'non']);
  const c = decrire([el('E1', 'a, b.'), el('E2', 'a b')]);
  assert.deepEqual(c.rapport, decrireStructure(['a, b.', 'a b']), 'la ponctuation n\'est pas retirée : arités 4 contre 2');
  assert.equal(c.rapport.ok, false);
});

// ============================================================================ T : pureté
test('T. entrées non mutées (même gelées en profondeur), éléments et propriétés ignorées non recopiés', () => {
  const entree = gele([{ id: 'E2', texte: R3, extra: { a: 1 } }, { id: 'E1', texte: R1 }]);
  const avant = JSON.stringify(entree);
  const r = decrire(entree);
  assert.equal(JSON.stringify(entree), avant);
  assert.deepEqual(r.couverture, ['E1', 'E2']);
  assert.equal(JSON.stringify(r).includes('extra'), false, 'les propriétés autres que id et texte sont ignorées');
});

test('sorties indépendantes : muter une sortie ne change ni l\'entrée ni un appel suivant', () => {
  const entree = [el('E1', R1), el('E3', R3)];
  const a = decrire(entree);
  a.couverture.push('X');
  a.rapport.ancres.length = 0;
  a.rapport.diversite[5].valeursDistinctes.push('zzz');
  const b = decrire(entree);
  assert.deepEqual(b.couverture, ['E1', 'E3']);
  assert.equal(b.rapport.ancres.length, 6);
  assert.deepEqual(b.rapport.diversite[5].valeursDistinctes, ['déduction', 'recherche']);
  assert.notEqual(a, b);
  assert.notEqual(a.couverture, b.couverture);
});

// ============================================================================ FORME EXACTE
test('FORME : la sortie a exactement deux clés, { couverture, rapport }, dans cet ordre ; rien d\'autre', () => {
  for (const entree of [[], [el('E1', R1)], [el('E1', R1), el('E3', R3)], [el('E1', R1), el('E5', R5)]]) {
    const r = decrire(entree);
    assert.deepEqual(Object.keys(r), ['couverture', 'rapport']);
    assert.ok(Array.isArray(r.couverture));
    assert.deepEqual(Object.keys(r.rapport), Object.keys(decrireStructure(entree.map((e) => e.texte))));
  }
});

test('FORME : le rapport n\'est ni retouché ni enrichi (pas d\'id, d\'arité, de partition, de couverture imbriquée)', () => {
  const ok = decrire([el('E1', R1), el('E3', R3)]).rapport;
  assert.deepEqual(Object.keys(ok), ['ok', 'occurrences', 'exemplesDistincts', 'n', 'ancres', 'positionsVariables', 'diversite']);
  const ko = decrire([el('E1', R1), el('E5', R5)]).rapport;
  assert.deepEqual(Object.keys(ko), ['ok', 'raison', 'detail']);
  assert.equal(JSON.stringify([ok, ko]).includes('E1'), false, 'aucun id ne pénètre dans le rapport');
});

test('FORME : occurrences du rapport = longueur de la couverture dès que la description réussit (rien filtré en silence)', () => {
  for (const n of [2, 3, 5]) {
    const els = Array.from({ length: n }, (_, i) => el(`E${i}`, i % 2 ? R1 : R3));
    const r = decrire(els);
    assert.equal(r.rapport.ok, true);
    assert.equal(r.rapport.occurrences, r.couverture.length);
  }
});

test('RÉPÉTITION ≠ SIGNIFICATION : dix fois le même texte → seulement « occurrences 10, 1 distinct », aucune valence', () => {
  const r = decrire(Array.from({ length: 10 }, (_, i) => el(`E${String(i).padStart(2, '0')}`, R1)));
  assert.equal(r.rapport.occurrences, 10);
  assert.equal(r.rapport.exemplesDistincts, 1);
  assert.deepEqual(Object.keys(r), ['couverture', 'rapport']);
});

test('CAS CONTRADICTOIRES : plusieurs textes pour une même situation + même texte ailleurs restent des ids distincts, jamais fusionnés', () => {
  // La fonction ne connaît aucune situation : deux ids de même texte restent deux membres de la couverture.
  const r = decrire([el('E1', R1), el('E7', R1), el('E8', R3)]);
  assert.deepEqual(r.couverture, ['E1', 'E7', 'E8']);
  assert.equal(r.rapport.occurrences, 3);
  assert.equal(r.rapport.exemplesDistincts, 2);
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
const SOURCE = readFileSync(join(RACINE, 'app', 'langage', 'structure-identifiee.js'), 'utf8');
const CODE = sansCommentaires(SOURCE);

test('DORMANTE : aucun fichier de production n\'importe ni ne nomme la primitive ou son module (seule exception : le module descriptif v0.63.4, qui la nomme sans l\'importer)', () => {
  const fichiers = [...fichiersJs(join(RACINE, 'app')), join(RACINE, 'sw.js'), join(RACINE, 'worker.js'), join(RACINE, 'index.html')];
  for (const f of fichiers) {
    if (f.endsWith('structure-identifiee.js')) continue;
    if (f.endsWith('descriptions-operations.js')) continue; // dérogation v0.63.4 : le module descriptif la NOMME sans l'importer (voir tests/descriptions-operations.test.mjs)
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    assert.equal(/structure-identifiee|decrireStructureIdentifiee/.test(src), false, `${relative(RACINE, f)} ne doit jamais l'utiliser`);
  }
});

test('DORMANTE : le module importe UNIQUEMENT decrireStructure depuis extraction.js, rien d\'autre', () => {
  const imports = CODE.match(/^\s*import\b[^;]*;/gm) || [];
  assert.equal(imports.length, 1);
  assert.match(imports[0], /^\s*import \{ decrireStructure \} from '\.\/extraction\.js';$/);
  assert.equal(/\bimport\s*\(/.test(CODE), false, 'aucun import dynamique');
  assert.equal(/\brequire\s*\(/.test(CODE), false);
});

test('DORMANTE : aucun accès magasin / base / localStorage, aucun repererMotifs, decrireValeursObservees, tokeniser, aucune partition par arité', () => {
  for (const interdit of ['magasin', 'lireTout', '.ecrire', 'supprimer(', 'indexedDB', 'IndexedDB', 'localStorage', 'sessionStorage', 'fetch(', 'await ', 'async ', 'Date.now', 'new Date', 'Math.random',
    'repererMotifs', 'decrireValeursObservees', 'tokeniser', 'decouper', 'vueDescriptive', 'vueElementsNonDecrits', 'arites', 'arite', 'partition', 'groupBy', 'Object.groupBy']) {
    assert.equal(CODE.includes(interdit), false, `le code ne doit pas contenir « ${interdit} »`);
  }
  assert.equal((CODE.match(/decrireStructure\(/g) || []).length, 1, 'un seul appel à decrireStructure : aucune retentative');
});

test('DORMANTE : aucune normalisation du texte transmis -- le seul `.trim(` du code sert à REFUSER un texte entièrement blanc', () => {
  const trims = CODE.match(/\.trim\(/g) || [];
  assert.equal(trims.length, 1);
  assert.match(CODE, /texte\.trim\(\) === ''/);
  assert.match(CODE, /copies\.push\(\{ id, texte \}\);/, 'le texte entre dans le groupe tel quel');
  for (const interdit of ['toLowerCase', 'toUpperCase', 'normalize', 'replace(', 'localeCompare', 'split(']) assert.equal(CODE.includes(interdit), false, interdit);
});

test('DORMANTE : aucun lien avec les énoncés, traces, compositions, candidates, provenance, capacités, réactions, rejeu, choix', () => {
  for (const mot of [/enonce/i, /trace/i, /composition/i, /candidate/i, /provenance/i, /capacit/i, /r[ée]action/i, /rejeu/i, /liaison/i, /observation/i, /exp[ée]rience/i, /choisi/i, /choix/i]) {
    assert.equal(mot.test(CODE), false, `le code ne doit pas contenir ${mot}`);
  }
  assert.equal(/enonce/i.test(SOURCE), false, 'même les commentaires ne nomment pas les énoncés (le test statique de non-branchement des énoncés reste vrai sans liste blanche)');
});

test('DORMANTE : aucun vocabulaire de valeur (score, récompense, préférence, correct, incorrect, jugement, valence, feedback) dans le code', () => {
  for (const mot of [/score/i, /reward/i, /r[ée]compense/i, /pr[ée]f[ée]rence/i, /\bcorrect/i, /incorrect/i, /jugement/i, /valence/i, /feedback/i, /majorit/i, /confiance/i, /seuil/i, /ratio/i]) {
    assert.equal(mot.test(CODE), false, `le code ne doit pas contenir ${mot}`);
  }
});

test('DORMANTE : extraction.js, decrireStructure et construireSquelette sont inchangés et ne connaissent pas ce module (garde-fous textuels)', () => {
  const ext = readFileSync(join(RACINE, 'app', 'langage', 'extraction.js'), 'utf8');
  assert.equal(/structure-identifiee|Identifiee/.test(ext), false);
  assert.match(ext, /export function decrireStructure\(textes\) \{\n  const squelette = construireSquelette\(textes\);\n  if \(!squelette\.ok\) return squelette;/);
  assert.match(ext, /const liste = \(exemples \|\| \[\]\)\.filter\(\(e\) => typeof e === 'string' && e\.trim\(\)\);/);
});
// === FIN_TEST_STRUCTURE_IDENTIFIEE ===
