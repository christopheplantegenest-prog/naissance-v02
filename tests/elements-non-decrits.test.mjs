// === DEBUT_TEST_ELEMENTS_NON_DECRITS ===
// v0.62.1 — ÉTAPE 6 : « ÉLÉMENTS NON DÉCRITS » (décision ChatGPT D7/D8/D9, 03/10/2026). Teste la
// primitive sœur vueElementsNonDecrits() (vue-traces.js) : « un ensemble a été découvert par repererMotifs,
// mais decrireStructure n'a pas pu le décrire ». vueDescriptive() reste STRICTEMENT inchangée (valeurs
// de référence ci-dessous = sortie de la version PRÉCÉDENTE du fichier, figées avant ce chantier) ; la
// nouvelle primitive est PURE, DESCRIPTIVE et jamais importée par un chemin d'exploitation.
//
// Les corpus E1..E10 sont les énoncés RÉELS d'une session téléphone (export du 03/10/2026) ; les 17
// traces sont celles de ce même export (id, voie, capacité, texte brut). Aucun sens n'est attribué aux
// textes : seules leurs formes et leurs longueurs comptent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { vueDescriptive, vueElementsNonDecrits, cooccurrencesSituationAction } from '../app/langage/vue-traces.js';
import { decrireStructure } from '../app/langage/extraction.js';
import { tokeniser } from '../app/langage/transformation.js';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.join(ICI, '..');

const TEXTES = {
  e1: "Non, c'était plutôt une déduction.",
  e2: "C'était plutôt une déduction ?",
  e3: "C'était plutôt une déduction ?",
  e4: 'Action: quand je dis « Le ciel est bleu », réponds « déduction ».',
  e5: "Non, c'était plutôt une déduction.",
  e6: "Non, c'était plutôt une déduction.",
  e7: "Non, c'était plutôt une recherche.",
  e8: "Non, c'était plutôt une déduction, pas une comparaison.",
  e9: "Non, c'était plutôt une déduction.",
  e10: "Non, c'était une déduction.",
};
const CAP = { e9: 'recherche', e10: 'recherche' };
const trace = (id, texte, capacite = 'proprietesCommunes') => ({
  id, voie: 'action', capacite, contexte: { texteBrut: texte, tokens: tokeniser(texte) },
});
const enonces = (ids) => ids.map((id) => trace(id, TEXTES[id], CAP[id] || 'proprietesCommunes'));
const tri = (a) => a.slice().sort();
const clone = (x) => JSON.parse(JSON.stringify(x));

const OR = {"e567":[{"couverture":["e5","e6"],"forme":"n=7::ancres(0:Non,1:,,2:c'était,3:plutôt,4:une,5:déduction,6:.)::varPos()::diversite()","rapport":{"ok":true,"occurrences":2,"exemplesDistincts":1,"n":7,"ancres":[{"position":0,"jeton":"Non"},{"position":1,"jeton":","},{"position":2,"jeton":"c'était"},{"position":3,"jeton":"plutôt"},{"position":4,"jeton":"une"},{"position":5,"jeton":"déduction"},{"position":6,"jeton":"."}],"positionsVariables":[],"diversite":{}}},{"couverture":["e5","e6","e7"],"forme":"n=7::ancres(0:Non,1:,,2:c'était,3:plutôt,4:une,6:.)::varPos(5)::diversite(5=[déduction|recherche])","rapport":{"ok":true,"occurrences":3,"exemplesDistincts":2,"n":7,"ancres":[{"position":0,"jeton":"Non"},{"position":1,"jeton":","},{"position":2,"jeton":"c'était"},{"position":3,"jeton":"plutôt"},{"position":4,"jeton":"une"},{"position":6,"jeton":"."}],"positionsVariables":[5],"diversite":{"5":{"valeursDistinctes":["déduction","recherche"],"nombre":2}}}}],"e5678":[],"e910":[],"tous":[]}; // vueDescriptive de la version PRÉCÉDENTE, par corpus d'énoncés
const LIGNES_17 = [["trace-1790976848621-1-329", "composition", "recherche", null], ["trace-1790976955667-2-859", "composition", "recherche", null], ["trace-1790978674367-1-917", "action", "accessibilite", "zaccede zorbo zordre zkelmi"], ["trace-1790982493413-1-319", "action", "accessibilite", "zaccede zalpha zordre zbeta"], ["trace-1790982517998-2-873", "action", "accessibilite", "zaccede zuno zordre zdos"], ["trace-1790982540216-3-143", "action", "accessibilite", "zaccede zfoo zautre zbar"], ["trace-1790982564694-4-530", "action", "accessibilite", "zaccede zorbo zordre zkelmi"], ["trace-1790982687724-5-13", "action", "recherche", "cherche zcouleur zbleu"], ["trace-1790982705639-6-590", "action", "recherche", "cherche zforme zvert"], ["trace-1791031772303-3-145", "action", "recherche", "zpivot zrelX zmid zCOMMUN"], ["trace-1791031810645-4-387", "action", "recherche", "zpivot zrelY zother zCOMMUN"], ["trace-1791031842223-5-974", "rejeu", "recherche", "zpivot zrelNEW zailleurs zCOMMUN"], ["trace-1791036659608-2-688", "action", "confrontation", "zaction zorbo zcouleur zvert"], ["trace-1791042433552-1-735", "action", "confrontation", "zact zkelmi zforme zronde"], ["trace-1791049028824-2-846", "action", "proprietesCommunes", "compare zalpha et zbeta"], ["trace-1791054830798-1-902", "action", "proprietesCommunes", "compare zalpha et zgamma"], ["trace-1791055057088-6-726", "action", "recherche", "cherche zcouleur zbleu"]];
const OR_17 = [{"couverture":["trace-1790978674367-1-917","trace-1790982493413-1-319","trace-1790982517998-2-873","trace-1790982540216-3-143","trace-1790982564694-4-530"],"forme":"n=4::ancres(0:zaccede)::varPos(1,2,3)::diversite(1=[zalpha|zfoo|zorbo|zuno];2=[zautre|zordre];3=[zbar|zbeta|zdos|zkelmi])","rapport":{"ok":true,"occurrences":5,"exemplesDistincts":4,"n":4,"ancres":[{"position":0,"jeton":"zaccede"}],"positionsVariables":[1,2,3],"diversite":{"1":{"valeursDistinctes":["zorbo","zalpha","zuno","zfoo"],"nombre":4},"2":{"valeursDistinctes":["zordre","zautre"],"nombre":2},"3":{"valeursDistinctes":["zkelmi","zbeta","zdos","zbar"],"nombre":4}}}},{"couverture":["trace-1790978674367-1-917","trace-1790982493413-1-319","trace-1790982517998-2-873","trace-1790982564694-4-530"],"forme":"n=4::ancres(0:zaccede,2:zordre)::varPos(1,3)::diversite(1=[zalpha|zorbo|zuno];3=[zbeta|zdos|zkelmi])","rapport":{"ok":true,"occurrences":4,"exemplesDistincts":3,"n":4,"ancres":[{"position":0,"jeton":"zaccede"},{"position":2,"jeton":"zordre"}],"positionsVariables":[1,3],"diversite":{"1":{"valeursDistinctes":["zorbo","zalpha","zuno"],"nombre":3},"3":{"valeursDistinctes":["zkelmi","zbeta","zdos"],"nombre":3}}}},{"couverture":["trace-1790978674367-1-917","trace-1790982564694-4-530"],"forme":"n=4::ancres(0:zaccede,1:zorbo,2:zordre,3:zkelmi)::varPos()::diversite()","rapport":{"ok":true,"occurrences":2,"exemplesDistincts":1,"n":4,"ancres":[{"position":0,"jeton":"zaccede"},{"position":1,"jeton":"zorbo"},{"position":2,"jeton":"zordre"},{"position":3,"jeton":"zkelmi"}],"positionsVariables":[],"diversite":{}}},{"couverture":["trace-1790978674367-1-917","trace-1790982564694-4-530","trace-1791036659608-2-688"],"forme":"n=4::ancres(1:zorbo)::varPos(0,2,3)::diversite(0=[zaccede|zaction];2=[zcouleur|zordre];3=[zkelmi|zvert])","rapport":{"ok":true,"occurrences":3,"exemplesDistincts":2,"n":4,"ancres":[{"position":1,"jeton":"zorbo"}],"positionsVariables":[0,2,3],"diversite":{"0":{"valeursDistinctes":["zaccede","zaction"],"nombre":2},"2":{"valeursDistinctes":["zordre","zcouleur"],"nombre":2},"3":{"valeursDistinctes":["zkelmi","zvert"],"nombre":2}}}},{"couverture":["trace-1790978674367-1-917","trace-1790982564694-4-530","trace-1791042433552-1-735"],"forme":"n=4::ancres()::varPos(0,1,2,3)::diversite(0=[zaccede|zact];1=[zkelmi|zorbo];2=[zforme|zordre];3=[zkelmi|zronde])","rapport":{"ok":true,"occurrences":3,"exemplesDistincts":2,"n":4,"ancres":[],"positionsVariables":[0,1,2,3],"diversite":{"0":{"valeursDistinctes":["zaccede","zact"],"nombre":2},"1":{"valeursDistinctes":["zorbo","zkelmi"],"nombre":2},"2":{"valeursDistinctes":["zordre","zforme"],"nombre":2},"3":{"valeursDistinctes":["zkelmi","zronde"],"nombre":2}}}},{"couverture":["trace-1790982493413-1-319","trace-1791049028824-2-846"],"forme":"n=4::ancres(1:zalpha,3:zbeta)::varPos(0,2)::diversite(0=[compare|zaccede];2=[et|zordre])","rapport":{"ok":true,"occurrences":2,"exemplesDistincts":2,"n":4,"ancres":[{"position":1,"jeton":"zalpha"},{"position":3,"jeton":"zbeta"}],"positionsVariables":[0,2],"diversite":{"0":{"valeursDistinctes":["zaccede","compare"],"nombre":2},"2":{"valeursDistinctes":["zordre","et"],"nombre":2}}}},{"couverture":["trace-1790982493413-1-319","trace-1791049028824-2-846","trace-1791054830798-1-902"],"forme":"n=4::ancres(1:zalpha)::varPos(0,2,3)::diversite(0=[compare|zaccede];2=[et|zordre];3=[zbeta|zgamma])","rapport":{"ok":true,"occurrences":3,"exemplesDistincts":3,"n":4,"ancres":[{"position":1,"jeton":"zalpha"}],"positionsVariables":[0,2,3],"diversite":{"0":{"valeursDistinctes":["zaccede","compare"],"nombre":2},"2":{"valeursDistinctes":["zordre","et"],"nombre":2},"3":{"valeursDistinctes":["zbeta","zgamma"],"nombre":2}}}},{"couverture":["trace-1790982687724-5-13","trace-1790982705639-6-590","trace-1791055057088-6-726"],"forme":"n=3::ancres(0:cherche)::varPos(1,2)::diversite(1=[zcouleur|zforme];2=[zbleu|zvert])","rapport":{"ok":true,"occurrences":3,"exemplesDistincts":2,"n":3,"ancres":[{"position":0,"jeton":"cherche"}],"positionsVariables":[1,2],"diversite":{"1":{"valeursDistinctes":["zcouleur","zforme"],"nombre":2},"2":{"valeursDistinctes":["zbleu","zvert"],"nombre":2}}}},{"couverture":["trace-1790982687724-5-13","trace-1791055057088-6-726"],"forme":"n=3::ancres(0:cherche,1:zcouleur,2:zbleu)::varPos()::diversite()","rapport":{"ok":true,"occurrences":2,"exemplesDistincts":1,"n":3,"ancres":[{"position":0,"jeton":"cherche"},{"position":1,"jeton":"zcouleur"},{"position":2,"jeton":"zbleu"}],"positionsVariables":[],"diversite":{}}},{"couverture":["trace-1791031772303-3-145","trace-1791031810645-4-387"],"forme":"n=4::ancres(0:zpivot,3:zCOMMUN)::varPos(1,2)::diversite(1=[zrelX|zrelY];2=[zmid|zother])","rapport":{"ok":true,"occurrences":2,"exemplesDistincts":2,"n":4,"ancres":[{"position":0,"jeton":"zpivot"},{"position":3,"jeton":"zCOMMUN"}],"positionsVariables":[1,2],"diversite":{"1":{"valeursDistinctes":["zrelX","zrelY"],"nombre":2},"2":{"valeursDistinctes":["zmid","zother"],"nombre":2}}}},{"couverture":["trace-1791049028824-2-846","trace-1791054830798-1-902"],"forme":"n=4::ancres(0:compare,1:zalpha,2:et)::varPos(3)::diversite(3=[zbeta|zgamma])","rapport":{"ok":true,"occurrences":2,"exemplesDistincts":2,"n":4,"ancres":[{"position":0,"jeton":"compare"},{"position":1,"jeton":"zalpha"},{"position":2,"jeton":"et"}],"positionsVariables":[3],"diversite":{"3":{"valeursDistinctes":["zbeta","zgamma"],"nombre":2}}}}];
const traces17 = () => LIGNES_17.map(([id, voie, capacite, texte]) => ({
  id, voie, capacite, contexte: texte == null ? null : { texteBrut: texte, tokens: tokeniser(texte) },
}));

// --- 1. vueDescriptive strictement identique avant/après ----------------------------------------
test('1. vueDescriptive : sortie strictement identique à la version précédente (énoncés et 17 traces réelles)', () => {
  assert.deepEqual(vueDescriptive(enonces(['e5', 'e6', 'e7'])), OR.e567);
  assert.deepEqual(vueDescriptive(enonces(['e5', 'e6', 'e7', 'e8'])), OR.e5678);
  assert.deepEqual(vueDescriptive(enonces(['e9', 'e10'])), OR.e910);
  assert.deepEqual(vueDescriptive(enonces(Object.keys(TEXTES))), OR.tous);
  assert.deepEqual(vueDescriptive(traces17()), OR_17);
  assert.equal(OR_17.length, 11);
});

test('1b. appeler vueElementsNonDecrits ne modifie ni les traces reçues ni la vue décrite (pureté)', () => {
  const t = traces17();
  const avant = clone(t);
  const vueAvant = vueDescriptive(t);
  vueElementsNonDecrits(t);
  assert.deepEqual(t, avant);
  assert.deepEqual(vueDescriptive(t), vueAvant);
  const gele = enonces(['e5', 'e6', 'e7', 'e8']).map((x) => Object.freeze({ ...x, contexte: Object.freeze({ ...x.contexte }) }));
  assert.doesNotThrow(() => vueElementsNonDecrits(Object.freeze(gele)));
});

// --- 2. E5/E6/E7 : rien de non décrit -----------------------------------------------------------
test('2. E5/E6/E7 : éléments décrits normaux, aucun faux élément non décrit', () => {
  const t = enonces(['e5', 'e6', 'e7']);
  assert.equal(vueDescriptive(t).length, 2);
  assert.deepEqual(vueElementsNonDecrits(t), []);
});

// --- 3. E5/E6/E7 + E8 ---------------------------------------------------------------------------
test('3. E5/E6/E7 + E8 : les éléments auparavant rejetés apparaissent, couvertures, raison et arités exactes', () => {
  const t = enonces(['e5', 'e6', 'e7', 'e8']);
  assert.deepEqual(vueDescriptive(t), []);
  const nd = vueElementsNonDecrits(t);
  assert.deepEqual(nd.map((e) => e.couverture), [['e5', 'e6', 'e7', 'e8'], ['e5', 'e6', 'e8']]);
  for (const e of nd) assert.equal(e.raison, 'arites_incompatibles');
  assert.deepEqual(nd[0].arites, [
    { id: 'e5', arite: 7 }, { id: 'e6', arite: 7 }, { id: 'e7', arite: 7 }, { id: 'e8', arite: 11 },
  ]);
  assert.deepEqual(nd[1].arites, [{ id: 'e5', arite: 7 }, { id: 'e6', arite: 7 }, { id: 'e8', arite: 11 }]);
  assert.match(nd[0].detail, /7, 7, 7, 11/);
});

// --- 4. E9 + E10 --------------------------------------------------------------------------------
test('4. E9 + E10 : élément non décrit observable', () => {
  const t = enonces(['e9', 'e10']);
  assert.deepEqual(vueDescriptive(t), []);
  const nd = vueElementsNonDecrits(t);
  assert.equal(nd.length, 1);
  assert.deepEqual(nd[0].couverture, ['e10', 'e9']);
  assert.equal(nd[0].raison, 'arites_incompatibles');
  assert.deepEqual(nd[0].arites, [{ id: 'e10', arite: 6 }, { id: 'e9', arite: 7 }]);
});

// --- 5. les 17 traces réelles -------------------------------------------------------------------
test('5. 17 traces réelles : les 3 éléments perdus sont observables, les 11 éléments décrits ne changent pas', () => {
  const t = traces17();
  const nd = vueElementsNonDecrits(t);
  assert.deepEqual(nd.map((e) => e.couverture), [
    ['trace-1790982687724-5-13', 'trace-1791036659608-2-688', 'trace-1791055057088-6-726'],
    ['trace-1790982705639-6-590', 'trace-1791036659608-2-688'],
    ['trace-1790982705639-6-590', 'trace-1791042433552-1-735'],
  ]);
  assert.deepEqual(nd.map((e) => e.arites.map((a) => a.arite)), [[3, 4, 3], [3, 4], [3, 4]]);
  for (const e of nd) assert.equal(e.raison, 'arites_incompatibles');
  assert.equal(vueDescriptive(t).length, 11);
  const decrites = new Set(vueDescriptive(t).map((e) => e.couverture.join('|')));
  for (const e of nd) assert.equal(decrites.has(e.couverture.join('|')), false, 'jamais à la fois décrit et non décrit');
});

// --- 6. même couverture, plusieurs motifs -------------------------------------------------------
test('6. même couverture produite par plusieurs motifs : un seul élément non décrit', () => {
  const t = [trace('a', 'zun zdeux zlong'), trace('b', 'zun zdeux')];
  const nd = vueElementsNonDecrits(t);
  assert.equal(nd.length, 1);
  assert.deepEqual(nd[0].couverture, ['a', 'b']);
  assert.deepEqual(nd[0].arites, [{ id: 'a', arite: 3 }, { id: 'b', arite: 2 }]);
});

// --- 7. répétition exacte descriptible ----------------------------------------------------------
test('7. répétition exacte descriptible : reste dans vueDescriptive, pas dans les non-décrits', () => {
  const t = enonces(['e5', 'e6']);
  assert.equal(vueDescriptive(t).length, 1);
  assert.deepEqual(vueElementsNonDecrits(t), []);
  // Répétition + un texte de longueur différente : le sous-ensemble répété reste décrit, l'ensemble élargi est non décrit.
  const m = [trace('a', 'zx zy zz'), trace('b', 'zx zy zz'), trace('c', 'zx zy')];
  assert.deepEqual(vueDescriptive(m).map((e) => e.couverture), [['a', 'b']]);
  assert.deepEqual(vueElementsNonDecrits(m).map((e) => e.couverture), [['a', 'b', 'c']]);
});

// --- 8. aucun motif >= 2 ------------------------------------------------------------------------
test('8. aucun motif >= 2 : aucun élément dans aucune des deux vues', () => {
  const cas = [
    [],
    [trace('a', 'zun zdeux zlong')],
    [trace('a', 'zun zdeux'), trace('b', 'ztrois zquatre')],
    [trace('a', '...'), trace('b', '???')],
    [trace('a', '   '), trace('b', '   ')],
  ];
  for (const t of cas) {
    assert.deepEqual(vueDescriptive(t), []);
    assert.deepEqual(vueElementsNonDecrits(t), []);
  }
});

// --- contrat de sortie, corpus exploitable, déterminisme, options -------------------------------
test('contrat D8 : exactement { couverture, raison, detail, arites } ; pas de capacité, forme, rapport, score', () => {
  const nd = vueElementsNonDecrits(enonces(['e5', 'e6', 'e7', 'e8']));
  for (const e of nd) {
    assert.deepEqual(Object.keys(e).sort(), ['arites', 'couverture', 'detail', 'raison']);
    assert.deepEqual(e.couverture, tri(e.couverture));
    assert.equal(e.arites.length, e.couverture.length);
    e.arites.forEach((a, i) => {
      assert.deepEqual(Object.keys(a).sort(), ['arite', 'id']);
      assert.equal(a.id, e.couverture[i]);
    });
  }
});

test('raison/detail = résultat BRUT de decrireStructure sur les textes de la couverture (ordre trié)', () => {
  const t = enonces(['e5', 'e6', 'e7', 'e8']);
  for (const e of vueElementsNonDecrits(t)) {
    const brut = decrireStructure(e.couverture.map((id) => TEXTES[id]));
    assert.equal(brut.ok, false);
    assert.equal(e.raison, brut.raison);
    assert.equal(e.detail, brut.detail);
  }
});

test('même corpus exploitable que vueDescriptive : seules les traces voie action avec texteBrut participent', () => {
  const base = enonces(['e5', 'e6', 'e8']);
  const rejeu = { ...trace('r1', TEXTES.e5), voie: 'rejeu' };
  const compo = { id: 'c1', voie: 'composition', capacite: 'x', contexte: null };
  const ancienne = { id: 'o1', voie: 'action', capacite: 'x' };
  assert.deepEqual(vueElementsNonDecrits([...base, rejeu, compo, ancienne]), vueElementsNonDecrits(base));
});

test('déterministe : l\'ordre des traces reçues ne change pas la sortie', () => {
  const t = enonces(Object.keys(TEXTES));
  const a = vueElementsNonDecrits(t);
  const b = vueElementsNonDecrits(t.slice().reverse());
  const c = vueElementsNonDecrits([...t.slice(5), ...t.slice(0, 5)]);
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
  assert.ok(a.length > 0);
  const t17 = traces17();
  assert.deepEqual(vueElementsNonDecrits(t17.slice().reverse()), vueElementsNonDecrits(t17));
});

test('options de repererMotifs transmises telles quelles (seuilMin)', () => {
  const t = enonces(['e5', 'e6', 'e7', 'e8']);
  assert.deepEqual(vueElementsNonDecrits(t), vueElementsNonDecrits(t, { seuilMin: 2, nMax: 4 }));
  assert.ok(vueElementsNonDecrits(t, { seuilMin: 5 }).length === 0, 'seuilMin 5 : aucun motif sur 4 textes');
});

test('les capacités restent hors de la primitive : cooccurrences existantes inchangées par sa présence', () => {
  const t = traces17();
  const avant = clone(cooccurrencesSituationAction(t));
  vueElementsNonDecrits(t);
  assert.deepEqual(cooccurrencesSituationAction(t), avant);
  assert.equal(avant.length, 11);
});

// --- 9. non-branchement statique ----------------------------------------------------------------
function fichiersJs(dossier) {
  const sortie = [];
  for (const nom of fs.readdirSync(dossier, { withFileTypes: true })) {
    const p = path.join(dossier, nom.name);
    if (nom.isDirectory()) sortie.push(...fichiersJs(p));
    else if (/\.(js|mjs)$/.test(nom.name)) sortie.push(p);
  }
  return sortie;
}
const sansCommentairesPurs = (s) => s.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');

test('9. aucun fichier de app/ (hors sa définition) ne référence vueElementsNonDecrits', () => {
  const fautifs = [];
  for (const f of fichiersJs(path.join(RACINE, 'app'))) {
    const rel = path.relative(RACINE, f).split(path.sep).join('/');
    if (rel === 'app/langage/vue-traces.js') continue;
    if (/vueElementsNonDecrits/.test(sansCommentairesPurs(fs.readFileSync(f, 'utf8')))) fautifs.push(rel);
  }
  assert.deepEqual(fautifs, []);
});

test('9b. dans vue-traces.js, la primitive n\'est qu\'EXPORTÉE : aucune autre fonction ne l\'appelle', () => {
  const src = sansCommentairesPurs(fs.readFileSync(path.join(RACINE, 'app', 'langage', 'vue-traces.js'), 'utf8'));
  const occ = [...src.matchAll(/vueElementsNonDecrits/g)].length;
  assert.equal(occ, 1, 'une seule occurrence hors commentaires : la définition exportée');
  assert.match(src, /export function vueElementsNonDecrits\(/);
});

test('9c. les chemins de choix/rejeu ne lisent pas non plus la notion « non décrit » (aucun import croisé)', () => {
  for (const rel of ['app/main.js', 'app/langage/ecran.js', 'app/langage/pont.js', 'app/langage/action.js', 'app/langage/registre.js',
    'app/langage/retours-par-structure.js', 'app/langage/retours-par-capacite.js']) {
    const src = sansCommentairesPurs(fs.readFileSync(path.join(RACINE, rel), 'utf8'));
    assert.equal(/NonDecrits|non[_ ]?decrit/i.test(src), false, rel);
  }
  const vt = sansCommentairesPurs(fs.readFileSync(path.join(RACINE, 'app/langage/vue-traces.js'), 'utf8'));
  // vueDescriptive n'a pas été « rendue sûre » par un garde ajouté : elle écarte toujours via rapport.ok.
  assert.match(vt, /if \(!rapport\.ok\) continue;/);
});
// === FIN_TEST_ELEMENTS_NON_DECRITS ===
