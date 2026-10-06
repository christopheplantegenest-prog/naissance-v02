// === DEBUT_TEST_CONTRATS_OBSERVES ===
// v0.62.9 — ÉTAPE 6, décision ChatGPT « CORRECTION DES PREUVES » (04/10/2026). Preuves de FIDÉLITÉ des descripteurs présentés
// comme contrats observés/réels (tests/contrats-observes.mjs) : sorties (le descripteur englobe le réel observé), entrées (le
// descripteur décrit ce que le code EXIGE). Une fixture qui dériverait de la fonction réelle fait échouer ces tests.
// RAPPEL DE MÉTHODE : un échantillon peut réfuter, jamais prouver « n'existe jamais ». Les absences affirmées reposent sur la
// lecture du code (retours énumérés, tests A4) ET sur la clôture des clés, et les libellés le disent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CONTRATS, CONTRATS_LOCAUX, DESCRIPTIONS, CHEMINS_ATTENDUS, LIMITES_CONNUES, NON_DECRITS, clesImbriquees, clesRacine, conformite, formesDecrites, instancesDecrites, produireScenarios } from './contrats-observes.mjs';
import { CAPACITES } from '../app/langage/registre.js';
import { invoquerAvecLiaisons } from '../app/langage/composition.js';
import { chargerEsprit } from '../app/langage/esprit.js';
import { magasinMemoireVive } from '../app/langage/connaissances.js';
import { repererMotifs } from '../app/langage/induction.js';
import { decrireValeursObservees } from '../app/langage/valeurs-observees.js';
import { decrireStructureIdentifiee } from '../app/langage/structure-identifiee.js';
import { couvrirSequence } from '../app/langage/sequence-plages.js';
import { DESCRIPTIONS_OPERATIONS } from '../app/langage/descriptions-operations.js';

const RACINE = join(import.meta.dirname, '..');
const SC = await produireScenarios();
const OPS = Object.keys(CONTRATS);
const clone = (x) => JSON.parse(JSON.stringify(x));
const lu = (...chemin) => readFileSync(join(RACINE, ...chemin), 'utf8');

// Contrôle complet d'un descripteur de SORTIE contre les scénarios réels : conformité + témoins + clôture.
function controler(op, forme) {
  const p = [];
  // Un scénario `image: 'json'` est contrôlé sur son IMAGE JSON : une clé présente valant undefined y devient absente (peutManquer).
  const vue = (s) => (s.image === 'json' ? JSON.parse(JSON.stringify(s.sortie)) : s.sortie);
  for (const s of SC[op]) for (const x of conformite(vue(s), forme, `${op}/${s.nom}`)) p.push(`conformité: ${x}`);
  const insts = new Map();
  for (const s of SC[op]) for (const [ch, o] of instancesDecrites(forme, vue(s))) { if (!insts.has(ch)) insts.set(ch, []); insts.get(ch).push(o); }
  for (const [ch, f] of formesDecrites(forme)) {
    const objets = insts.get(ch) || [];
    if (objets.length === 0) { p.push(`témoin: aucun objet observé à ${ch}`); continue; }
    for (const [nom, champ] of Object.entries(f.champs)) {
      const pres = objets.filter((o) => Object.hasOwn(o, nom)).length;
      const nul = objets.filter((o) => o[nom] === null).length;
      if (pres === 0) p.push(`témoin de présence manquant pour ${ch}.${nom}`);
      if (champ.peutManquer === true && pres === objets.length) p.push(`témoin d'absence manquant pour ${ch}.${nom} (peutManquer sans jamais manquer)`);
      if (champ.peutEtreNull === true && nul === 0) p.push(`témoin null manquant pour ${ch}.${nom} (peutEtreNull sans jamais valoir null)`);
    }
    const observees = new Set(objets.flatMap((o) => Object.keys(o)));
    const declarees = new Set(Object.keys(f.champs));
    const nonDecrites = new Set(NON_DECRITS[op][ch] || []);
    for (const k of observees) if (!declarees.has(k) && !nonDecrites.has(k)) p.push(`clôture: la clé réelle « ${k} » de ${ch} n'est ni déclarée ni listée comme non décrite`);
    for (const k of nonDecrites) if (!observees.has(k)) p.push(`clôture: la clé « ${k} » listée non décrite n'est jamais observée à ${ch}`);
  }
  return p;
}

// ============================================================================ A. CHEMINS RÉELS ET PHOTOS DES FORMES RÉELLES
test('A1. les chemins de code énumérés par lecture du code sont tous exercés (un scénario par chemin)', () => {
  assert.deepEqual(Object.keys(SC).sort(), [...OPS].sort());
  for (const op of OPS) assert.deepEqual(SC[op].map((s) => s.nom), CHEMINS_ATTENDUS[op], op);
});

test('A2. PHOTO des formes réelles : clés racine exactes de chaque scénario (une dérive d\'une fonction casse ici)', () => {
  for (const op of OPS) for (const s of SC[op]) if (s.cles !== null) assert.equal(clesRacine(s.sortie), s.cles, `${op}/${s.nom}`);
});

test('A3. PHOTO des formes réelles : clés des éléments imbriqués (valeurs[] : ids,valeur ; motifs : cle,couverture,gabarit)', () => {
  let verifies = 0;
  for (const op of OPS) for (const s of SC[op]) for (const [chemin, attendu] of Object.entries(s.imbriquees || {})) {
    assert.equal(clesImbriquees(s.sortie, chemin), attendu, `${op}/${s.nom} ${chemin}`); verifies += 1;
  }
  assert.ok(verifies >= 3);
});

test('A4. LECTURE DU CODE : les retours de appliquerRegles et de decrireValeursObservees sont exactement ceux énumérés (c\'est ce qui porte « ok n\'existe pas »)', () => {
  const regles = lu('app', 'langage', 'regles.js');
  assert.equal((regles.match(/return \{/g) || []).length, 3, 'appliquerRegles : exactement trois retours d\'objet');
  for (const re of [/return \{ resultat: null \};/, /return \{ resultat: null, conflit: true, candidats: groupe \};/, /return \{ resultat: groupe\[0\]\.resultat, regle: groupe\[0\] \};/]) assert.match(regles, re);
  assert.equal(/\bok\b\s*:/.test(regles.split('\n').filter((l) => /return \{/.test(l)).join('\n')), false, 'aucun retour de appliquerRegles ne porte de clé ok');
  const valeurs = lu('app', 'langage', 'valeurs-observees.js');
  assert.equal((valeurs.match(/^\s*return \{/gm) || []).length, 1, 'decrireValeursObservees : un seul retour d\'objet');
  assert.match(valeurs, /return \{ valeurs, nombreValeurs: valeurs\.length, nonResolus, ambigus \};/);
  assert.match(valeurs, /groupes\.set\(valeur, \{ valeur, ids: \[\] \}\)/, 'les éléments de valeurs portent ids, jamais id');
});

// ============================================================================ B. SORTIES : CONFORMITÉ, TÉMOINS, CLÔTURE
for (const op of OPS) {
  test(`B1. ${op} : tout scénario réel satisfait le descripteur de sortie ; témoins de présence / d'absence / null ; clôture des clés`, () => {
    assert.deepEqual(controler(op, CONTRATS[op].sortie), []);
  });
}

test('B2. NON_DECRITS : mécanisme de clôture présent, volontairement vide (tout ce qui existe est décrit ou opaque)', () => {
  for (const op of OPS) assert.deepEqual(NON_DECRITS[op], {}, op);
});

test('B3. chaque descripteur de sortie fait partie du vocabulaire : les contrats sont valides, JSON-sérialisables et sans fonction', () => {
  for (const op of OPS) {
    assert.deepEqual(JSON.parse(JSON.stringify(CONTRATS[op])), CONTRATS[op]);
    assert.equal(CONTRATS[op].nom, op);
  }
});

// ============================================================================ C. ASSERTIONS CONTRE LE RETOUR DES FICTIONS
test('C1. deduction : `ok` n\'existe ni dans le descripteur ni dans une sortie réelle ; conflit = booléen qui peut manquer ; candidats et regle peuvent manquer ; resultat nullable', () => {
  const champs = CONTRATS.deduction.sortie.champs;
  assert.equal('ok' in champs, false);
  assert.deepEqual(Object.keys(champs).sort(), ['candidats', 'conflit', 'regle', 'resultat']);
  assert.deepEqual(champs.conflit, { forme: 'scalaire', genre: 'booleen', peutManquer: true });
  assert.deepEqual(champs.candidats, { forme: 'collection', elements: { forme: 'objet' }, peutManquer: true });
  assert.deepEqual(champs.regle, { forme: 'objet', peutManquer: true });
  assert.deepEqual(champs.resultat, { forme: 'scalaire', genre: 'chaine', peutEtreNull: true });
  for (const s of SC.deduction) assert.equal(Object.hasOwn(s.sortie, 'ok'), false, s.nom);
  const conflit = SC.deduction.find((s) => s.nom === 'conflit').sortie;
  assert.equal(conflit.conflit, true); assert.equal(typeof conflit.conflit, 'boolean'); assert.equal(Array.isArray(conflit.candidats), true);
});

test('C2. decrireValeursObservees : valeurs[] porte `ids` et `valeur`, jamais `id` ; nonResolus et ambigus sont toujours présents', () => {
  const el = CONTRATS.decrireValeursObservees.sortie.champs.valeurs.elements;
  assert.equal('id' in el.champs, false);
  assert.deepEqual(Object.keys(el.champs).sort(), ['ids', 'valeur']);
  assert.deepEqual(el.champs.ids, { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } });
  assert.deepEqual(el.champs.valeur, { forme: 'scalaire', peutManquer: true, peutEtreNull: true });
  const champs = CONTRATS.decrireValeursObservees.sortie.champs;
  for (const nom of ['nonResolus', 'ambigus']) { assert.equal(champs[nom].peutManquer, undefined, nom); assert.deepEqual(champs[nom], { forme: 'collection', elements: { forme: 'scalaire', genre: 'chaine' } }); }
  for (const s of SC.decrireValeursObservees) for (const x of s.sortie.valeurs) { assert.equal(Object.hasOwn(x, 'id'), false, s.nom); assert.equal(Object.hasOwn(x, 'ids'), true); }
  for (const s of SC.decrireValeursObservees) { assert.equal(Array.isArray(s.sortie.nonResolus), true); assert.equal(Array.isArray(s.sortie.ambigus), true); }
});

test('C3. repererMotifs : les identités de couverture sont rendues telles que fournies (scalaire sans genre), pas une chaîne imposée', () => {
  const el = CONTRATS.repererMotifs.sortie.elements;
  assert.deepEqual(el.champs.couverture, { forme: 'collection', elements: { forme: 'scalaire' } });
  const rendu = repererMotifs([{ id: 1, texteRecu: 'un deux' }, { id: 2, texteRecu: 'un deux' }]);
  assert.equal(rendu.some((m) => m.couverture.some((x) => typeof x === 'number')), true, 'un id numérique est rendu numérique');
});

// ============================================================================ D. LA PREUVE ATTRAPE VRAIMENT LES DÉRIVES (descripteurs falsifiés)
const falsifier = (op, modifier) => { const f = clone(CONTRATS[op].sortie); modifier(f); return controler(op, f); };
const attrape = (op, modifier, motif) => assert.ok(falsifier(op, modifier).some((x) => motif.test(x)), `la falsification devait être attrapée : ${motif}`);

test('D1. `ok` fictif requis, ou caché derrière peutManquer : attrapé (conformité / témoin de présence)', () => {
  attrape('deduction', (f) => { f.champs.ok = { forme: 'scalaire', genre: 'booleen' }; }, /conformité: .*ok: absent/);
  attrape('deduction', (f) => { f.champs.ok = { forme: 'scalaire', genre: 'booleen', peutManquer: true }; }, /témoin de présence manquant pour sortie\.ok/);
});
test('D2. conflit décrit avec la mauvaise forme (objet), ou sans peutManquer : attrapé', () => {
  attrape('deduction', (f) => { f.champs.conflit = { forme: 'objet', peutManquer: true }; }, /conflit: objet attendu/);
  attrape('deduction', (f) => { delete f.champs.conflit.peutManquer; }, /conflit: absent/);
  attrape('deduction', (f) => { f.champs.conflit.genre = 'chaine'; }, /conflit: genre chaine attendu/);
});
test('D3. resultat sans peutEtreNull, regle / candidats sans peutManquer : attrapé', () => {
  attrape('deduction', (f) => { delete f.champs.resultat.peutEtreNull; }, /resultat: null alors/);
  attrape('deduction', (f) => { delete f.champs.regle.peutManquer; }, /regle: absent/);
  attrape('deduction', (f) => { delete f.champs.candidats.peutManquer; }, /candidats: absent/);
});
test('D4. `id` à la place de `ids` dans valeurs[] (requis, ou caché derrière peutManquer) : attrapé', () => {
  attrape('decrireValeursObservees', (f) => { f.champs.valeurs.elements.champs.id = { forme: 'scalaire', genre: 'chaine' }; }, /\.id: absent/);
  attrape('decrireValeursObservees', (f) => { f.champs.valeurs.elements.champs.id = { forme: 'scalaire', genre: 'chaine', peutManquer: true }; }, /témoin de présence manquant pour sortie\.valeurs\[\]\.id/);
  attrape('decrireValeursObservees', (f) => { delete f.champs.valeurs.elements.champs.ids; }, /clôture: la clé réelle « ids »/);
});
test('D5. disparition de nonResolus / ambigus / nombreValeurs dans le descripteur : attrapé par la clôture ; mauvais genre : attrapé', () => {
  attrape('decrireValeursObservees', (f) => { delete f.champs.nonResolus; }, /clôture: la clé réelle « nonResolus »/);
  attrape('decrireValeursObservees', (f) => { delete f.champs.ambigus; }, /clôture: la clé réelle « ambigus »/);
  attrape('decrireValeursObservees', (f) => { delete f.champs.nombreValeurs; }, /clôture: la clé réelle « nombreValeurs »/);
  attrape('decrireValeursObservees', (f) => { f.champs.nombreValeurs.genre = 'chaine'; }, /nombreValeurs: genre chaine attendu/);
  attrape('decrireValeursObservees', (f) => { delete f.champs.valeurs.elements.champs.valeur.peutEtreNull; }, /valeur: null alors/);
});
test('D6. champ fictif caché derrière peutManquer, ou peutManquer / peutEtreNull sans témoin : attrapé', () => {
  attrape('recherche', (f) => { f.champs.fictif = { forme: 'scalaire', peutManquer: true }; }, /témoin de présence manquant pour sortie\.fictif/);
  attrape('recherche', (f) => { f.champs.sujets.peutManquer = true; }, /témoin d'absence manquant pour sortie\.sujets/);
  attrape('recherche', (f) => { f.champs.sujets.peutEtreNull = true; }, /témoin null manquant pour sortie\.sujets/);
  attrape('recherche', (f) => { f.champs.sujets.elements.genre = 'nombre'; }, /genre nombre attendu/);
  attrape('recherche', (f) => { delete f.champs.sujets; }, /clôture: la clé réelle « sujets »/);
});
test('D7. decrireStructureIdentifiee et repererMotifs : champ manquant, mauvaise forme, genre imposé à tort : attrapé', () => {
  attrape('decrireStructureIdentifiee', (f) => { delete f.champs.rapport; }, /clôture: la clé réelle « rapport »/);
  attrape('decrireStructureIdentifiee', (f) => { f.champs.couverture = { forme: 'scalaire', genre: 'chaine' }; }, /couverture: scalaire attendu/);
  attrape('repererMotifs', (f) => { f.elements.champs.couverture.elements.genre = 'nombre'; }, /genre nombre/);
  attrape('repererMotifs', (f) => { delete f.elements.champs.cle; }, /clôture: la clé réelle « cle »/);
  attrape('repererMotifs', (f) => { f.forme = 'objet'; delete f.elements; }, /objet attendu/);
});
test('D8. un scénario retiré, ou un objet décrit jamais observé : attrapé (aucun objet à ce chemin)', () => {
  const sauve = SC.deduction.splice(0, SC.deduction.length);
  try { assert.ok(controler('deduction', CONTRATS.deduction.sortie).length > 0); } finally { SC.deduction.push(...sauve); }
  attrape('decrireValeursObservees', (f) => { f.champs.valeurs.elements.champs.sous = { forme: 'objet', champs: { x: { forme: 'scalaire' } } }; }, /témoin de présence manquant pour sortie\.valeurs\[\]\.sous/);
});

test('D9. couvrirSequence et le témoin JSON de decrireValeursObservees : element / etiquette sans nullable, position avec mauvais genre, couvertures retirées, peutManquer retiré de la valeur de sortie : attrapé', () => {
  attrape('couvrirSequence', (f) => { delete f.elements.champs.element.peutEtreNull; }, /element: null alors/);
  attrape('couvrirSequence', (f) => { delete f.elements.champs.couvertures.elements.champs.etiquette.peutEtreNull; }, /etiquette: null alors/);
  attrape('couvrirSequence', (f) => { f.elements.champs.position.genre = 'chaine'; }, /position: genre chaine attendu/);
  attrape('couvrirSequence', (f) => { delete f.elements.champs.couvertures; }, /clôture: la clé réelle « couvertures »/);
  attrape('couvrirSequence', (f) => { f.elements.champs.element.forme = 'scalaire'; }, /element: scalaire attendu/);
  attrape('couvrirSequence', (f) => { f.elements.champs.fictif = { forme: 'quelconque', peutManquer: true }; }, /témoin de présence manquant pour sortie\[\]\.fictif/);
  attrape('couvrirSequence', (f) => { f.elements.champs.element.peutManquer = true; }, /témoin d'absence manquant pour sortie\[\]\.element/);
  attrape('decrireValeursObservees', (f) => { delete f.champs.valeurs.elements.champs.valeur.peutManquer; }, /valeur: absent alors que le champ ne peut pas manquer/);
  attrape('decrireValeursObservees', (f) => { f.champs.valeurs.elements.champs.valeur.peutManquer = false; }, /valeur: absent alors/);
});
test('D10. sans le scénario « undefined_present » (image JSON), le peutManquer de valeurs[].valeur n\'a plus aucun témoin d\'absence : la preuve le réclame', () => {
  const sauve = SC.decrireValeursObservees.splice(0, SC.decrireValeursObservees.length, ...SC.decrireValeursObservees.filter((x) => x.nom !== 'undefined_present'));
  try { assert.ok(controler('decrireValeursObservees', CONTRATS.decrireValeursObservees.sortie).some((x) => /témoin d'absence manquant pour sortie\.valeurs\[\]\.valeur/.test(x))); } finally { SC.decrireValeursObservees.length = 0; SC.decrireValeursObservees.push(...sauve); }
  assert.deepEqual(controler('decrireValeursObservees', CONTRATS.decrireValeursObservees.sortie), []);
  const img = SC.decrireValeursObservees.find((x) => x.nom === 'undefined_present');
  assert.equal(img.image, 'json');
  assert.equal(Object.hasOwn(img.sortie.valeurs.find((v) => v.ids.includes('a')), 'valeur'), true, 'la sortie réelle porte la clé undefined');
  assert.equal(Object.hasOwn(JSON.parse(JSON.stringify(img.sortie)).valeurs.find((v) => v.ids.includes('a')), 'valeur'), false, 'son image JSON ne la porte plus');
});

// ============================================================================ E. LA FONCTION DE CONFORMITÉ ELLE-MÊME
test('E1. conformite : détecte absent, null, undefined, mauvais genre, mauvaise forme, tableau pris pour objet, objet pris pour collection', () => {
  const f = { forme: 'objet', champs: { a: { forme: 'scalaire', genre: 'chaine' }, b: { forme: 'scalaire', peutManquer: true }, c: { forme: 'scalaire', peutEtreNull: true }, d: { forme: 'collection', elements: { forme: 'scalaire', genre: 'nombre' } } } };
  assert.deepEqual(conformite({ a: 'x', c: null, d: [1, 2] }, f), []);
  assert.equal(conformite({ c: null, d: [] }, f).length, 1, 'a absent');
  assert.equal(conformite({ a: null, c: null, d: [] }, f).length, 1, 'a null non nullable');
  assert.equal(conformite({ a: 'x', c: null, d: [], b: undefined }, f).length, 1, 'undefined présent hors vocabulaire');
  assert.equal(conformite({ a: 3, c: null, d: [] }, f).length, 1, 'mauvais genre');
  assert.equal(conformite({ a: 'x', c: null, d: [1, 'y'] }, f).length, 1, 'mauvais genre d\'élément');
  assert.equal(conformite({ a: 'x', c: null, d: {} }, f).length, 1, 'objet pris pour collection');
  assert.equal(conformite({ a: { x: 1 }, c: null, d: [] }, f).length, 1, 'objet pris pour scalaire');
  assert.equal(conformite([], f).length, 1, 'tableau pris pour objet');
  assert.equal(conformite(null, f).length, 1);
  assert.equal(conformite('x', { forme: 'collection' }).length, 1);
  assert.deepEqual(conformite({ b: 5, a: 'x', c: 'y', d: [], extra: 1 }, f), [], 'objets ouverts : clé en plus tolérée (la clôture est vérifiée à part)');
});

test('E2. conformite : la forme quelconque accepte toute valeur DÉFINIE (scalaire, objet, tableau) ; null seulement avec le fait peutEtreNull ; undefined jamais', () => {
  const f = { forme: 'objet', champs: { x: { forme: 'quelconque' }, y: { forme: 'quelconque', peutEtreNull: true } } };
  for (const v of ['a', 3, true, { k: [1] }, [1, 2], '']) assert.deepEqual(conformite({ x: v, y: v }, f), [], JSON.stringify(v));
  assert.deepEqual(conformite({ x: 1, y: null }, f), []);
  assert.equal(conformite({ x: null, y: null }, f).length, 1, 'null non déclaré sur x');
  assert.equal(conformite({ x: 1, y: undefined }, f).length, 1, 'undefined jamais conforme');
  assert.equal(conformite({ y: 1 }, f).length, 1, 'x absent');
});

// ============================================================================ F. ENTRÉES : CE QUE LE CODE EXIGE RÉELLEMENT
const e = await chargerEsprit(magasinMemoireVive());
const throws = (f) => { try { f(); return false; } catch (err) { return err instanceof TypeError; } };

test('F1. rôles de capacités : noms exacts du registre, scalaire SANS genre, non omissible tel que composé', () => {
  for (const nom of ['recherche', 'deduction']) {
    assert.deepEqual(Object.keys(CONTRATS[nom].entrees).sort(), [...CAPACITES[nom].roles].sort(), nom);
    for (const r of Object.values(CONTRATS[nom].entrees)) assert.deepEqual(r, { forme: 'scalaire' });
  }
});
test('F2. rôles de capacités : chaîne, nombre et booléen sont tous acceptés (aucun genre chaîne n\'est exigé par le code)', () => {
  for (const nom of ['recherche', 'deduction']) for (const v of ['x', 5, true, false]) {
    const args = Object.fromEntries(CAPACITES[nom].roles.map((r) => [r, v]));
    assert.doesNotThrow(() => CAPACITES[nom].invoquer(e, args), `${nom} avec ${typeof v}`);
  }
  assert.deepEqual(CAPACITES.recherche.invoquer(e, { relation: 5, valeur: 5 }), CAPACITES.recherche.invoquer(e, { relation: '5', valeur: '5' }), 'nombre ≡ chaîne par canonisation');
  assert.deepEqual(CAPACITES.recherche.invoquer(e, { relation: true, valeur: true }), CAPACITES.recherche.invoquer(e, { relation: 'true', valeur: 'true' }), 'booléen ≡ chaîne par canonisation');
});
test('F3. un rôle n\'est pas omissible TEL QUE COMPOSÉ : rôle non résolu = abstention (role_non_resolu)', () => {
  for (const [nom, args] of [['recherche', { relation: 'zx' }], ['deduction', { sujet: 'zx' }]]) {
    const r = invoquerAvecLiaisons({ ...e, liaisons: [], derniersResultats: new Map() }, { operation: nom, argumentsExplicites: args });
    assert.equal(r.ok, false); assert.equal(r.raison, 'role_non_resolu');
  }
});

const valeursOk = [{ id: 'a' }, { id: 'b', valeur: 'x' }, { id: 'c', valeur: 3 }, { id: 'd', valeur: true }];
test('F4. decrireValeursObservees.paires : entrée conforme acceptée (valeur absente, null, undefined présent, primitives) ; id non chaîne ou vide, valeur objet ou non finie, élément non objet, argument non tableau : TypeError', () => {
  const el = CONTRATS.decrireValeursObservees.entrees.paires;
  assert.deepEqual(el, { forme: 'collection', elements: { forme: 'objet', champs: { id: { forme: 'scalaire', genre: 'chaine' }, valeur: { forme: 'scalaire', omissible: true, peutEtreNull: true } } } });
  assert.deepEqual(Object.keys(CONTRATS.decrireValeursObservees.entrees), ['paires'], 'nom du paramètre réel du code');
  assert.doesNotThrow(() => decrireValeursObservees(valeursOk));
  assert.doesNotThrow(() => decrireValeursObservees([{ id: 'a', valeur: null }]), 'valeur nullable');
  assert.equal(throws(() => decrireValeursObservees([{ id: 1, valeur: 'x' }])), true, 'id exigé chaîne');
  assert.equal(throws(() => decrireValeursObservees([{ id: true }])), true);
  assert.equal(throws(() => decrireValeursObservees([{ id: 'a', valeur: {} }])), true, 'valeur : primitive seulement');
  assert.equal(throws(() => decrireValeursObservees([[]])), true);
  assert.equal(throws(() => decrireValeursObservees('x')), true);
  assert.doesNotThrow(() => decrireValeursObservees([{ id: 'a' }]), 'valeur omissible');
});
test('F5. decrireStructureIdentifiee.elements : entrée conforme acceptée ; id ou texte non chaîne, argument non tableau : TypeError', () => {
  assert.deepEqual(CONTRATS.decrireStructureIdentifiee.entrees.elements, { forme: 'collection', elements: { forme: 'objet', champs: { id: { forme: 'scalaire', genre: 'chaine' }, texte: { forme: 'scalaire', genre: 'chaine' } } } });
  assert.doesNotThrow(() => decrireStructureIdentifiee([{ id: 'a', texte: 'un deux' }]));
  assert.equal(throws(() => decrireStructureIdentifiee([{ id: 1, texte: 'un deux' }])), true);
  assert.equal(throws(() => decrireStructureIdentifiee([{ id: 'a', texte: 5 }])), true);
  assert.equal(throws(() => decrireStructureIdentifiee('x')), true);
});
test('F6. repererMotifs : corpus exigé tableau ; options omissible et non nullable ; id et texteRecu SANS genre et omissibles car le code n\'impose rien d\'autre', () => {
  const { corpus, options } = CONTRATS.repererMotifs.entrees;
  assert.deepEqual(corpus, { forme: 'collection', elements: { forme: 'objet', champs: { id: { forme: 'scalaire', omissible: true }, texteRecu: { forme: 'scalaire', omissible: true } } } });
  assert.deepEqual(options, { forme: 'objet', omissible: true });
  const ok = [{ id: 'a', texteRecu: 'un deux trois' }, { id: 'b', texteRecu: 'un deux quatre' }];
  assert.doesNotThrow(() => repererMotifs(ok));
  assert.equal(throws(() => repererMotifs('x')), true, 'corpus : tableau exigé');
  assert.equal(throws(() => repererMotifs(undefined)), true);
  assert.doesNotThrow(() => repererMotifs(ok, undefined), 'options omissible');
  assert.equal(throws(() => repererMotifs(ok, null)), true, 'options non nullable');
  // le code n'impose AUCUN genre : id nombre, id absent, texteRecu non chaîne ou absent sont acceptés sans erreur
  assert.doesNotThrow(() => repererMotifs([{ id: 1, texteRecu: 'un deux' }, { id: 2, texteRecu: 'un deux' }]));
  assert.doesNotThrow(() => repererMotifs([{ texteRecu: 'un deux' }, { id: 'b', texteRecu: 'un deux' }]));
  assert.doesNotThrow(() => repererMotifs([{ id: 'a', texteRecu: 5 }, { id: 'b' }]));
});

test('F7. couvrirSequence.{elements,plages} : entrée conforme acceptée (null et valeurs JSON quelconques dans elements, étiquette quelconque ou null) ; entrée hors contrat : TypeError', () => {
  const { elements, plages } = CONTRATS.couvrirSequence.entrees;
  assert.deepEqual(elements, { forme: 'collection' }, 'les éléments de elements ne sont PAS décrits (limite : un élément de collection ne porte pas de fait nullable)');
  assert.deepEqual(plages.elements.champs.etiquette, { forme: 'quelconque', peutEtreNull: true });
  assert.equal('omissible' in plages.elements.champs.etiquette, false, 'etiquette est exigée présente : le code refuse une plage sans etiquette');
  assert.deepEqual(Object.keys(CONTRATS.couvrirSequence.entrees).sort(), ['elements', 'plages']);
  assert.doesNotThrow(() => couvrirSequence({ elements: ['a', null, { x: [1, null] }, 3, true], plages: [{ debut: 0, longueur: 2, etiquette: null }, { debut: 2, longueur: 1, etiquette: { k: ['v'] } }, { debut: 4, longueur: 1, etiquette: 7 }] }));
  assert.equal(throws(() => couvrirSequence({ elements: ['a'], plages: [{ debut: 0, longueur: 1 }] })), true, 'etiquette exigée');
  assert.equal(throws(() => couvrirSequence({ elements: 'x', plages: [] })), true);
  assert.equal(throws(() => couvrirSequence({ elements: ['a'], plages: {} })), true);
  assert.equal(throws(() => couvrirSequence({ elements: ['a'], plages: [{ debut: 0.5, longueur: 1, etiquette: 'e' }] })), true, 'nombre entier exigé : non exprimable, le genre nombre le contient');
  assert.equal(throws(() => couvrirSequence({ elements: ['a'], plages: [{ debut: 0, longueur: 1, etiquette: undefined }] })), true, 'undefined n\'est pas une valeur JSON : refusé');
  assert.equal(throws(() => couvrirSequence({ elements: [undefined], plages: [] })), true);
});

// ============================================================================ G. LIMITES CONNUES (constat explicite, sans prétendre que le descripteur les couvre)
test('G1. LIMITE : les rôles de capacités acceptent aussi null et undefined (canonisés), non exprimable ; le descripteur ne prétend pas le couvrir', () => {
  for (const v of [null, undefined]) assert.doesNotThrow(() => CAPACITES.recherche.invoquer(e, { relation: v, valeur: v }));
  assert.deepEqual(CAPACITES.recherche.invoquer(e, { relation: null, valeur: null }), CAPACITES.recherche.invoquer(e, { relation: '', valeur: '' }), 'null ≡ chaîne vide');
  for (const nom of ['recherche', 'deduction']) for (const r of Object.values(CONTRATS[nom].entrees)) { assert.equal('peutEtreNull' in r, false); assert.equal('peutManquer' in r, false); }
});
test('G2. LIMITES (entrées) de decrireValeursObservees, TESTÉES mais NON portées par le descripteur : undefined explicitement présent accepté et classé ; id vide, NaN et infinis refusés ; ids dupliqués rapportés ; propriété héritée = absente', () => {
  assert.doesNotThrow(() => decrireValeursObservees([{ id: 'a', valeur: null }]), 'null : exprimé par peutEtreNull');
  const indef = decrireValeursObservees([{ id: 'a', valeur: undefined }, { id: 'b' }]);
  assert.deepEqual(indef.nonResolus, ['b'], 'absent ≠ undefined présent');
  assert.deepEqual(indef.valeurs.map((v) => v.ids), [['a']], 'undefined présent est une valeur observée');
  assert.equal(throws(() => decrireValeursObservees([{ id: '', valeur: 1 }])), true, 'id vide refusé');
  for (const v of [NaN, Infinity, -Infinity]) assert.equal(throws(() => decrireValeursObservees([{ id: 'a', valeur: v }])), true, String(v));
  assert.deepEqual(decrireValeursObservees([{ id: 'a', valeur: 1 }, { id: 'a', valeur: 1 }]), { valeurs: [], nombreValeurs: 0, nonResolus: [], ambigus: ['a'] }, 'doublons rapportés, jamais une erreur');
  const herite = Object.assign(Object.create({ valeur: 3 }), { id: 'a' });
  assert.deepEqual(decrireValeursObservees([herite]).nonResolus, ['a'], 'valeur héritée = absente');
  const v = CONTRATS.decrireValeursObservees.entrees.paires.elements.champs;
  assert.deepEqual(Object.keys(v.valeur).sort(), ['forme', 'omissible', 'peutEtreNull']);
  assert.equal(JSON.stringify(CONTRATS.decrireValeursObservees).includes('undefined'), false, 'aucune trace d\'undefined dans le descripteur');
});
test('G3. LIMITE CONNUE (sortie) : une valeur undefined explicite donne une clé PRÉSENTE valant undefined ; le descripteur ne prétend pas la couvrir', () => {
  const sortie = decrireValeursObservees([{ id: 'a', valeur: undefined }, { id: 'b', valeur: 'x' }]);
  const el = sortie.valeurs.find((x) => x.ids.includes('a'));
  assert.equal(Object.hasOwn(el, 'valeur'), true);
  assert.equal(el.valeur, undefined);
  const violations = conformite(sortie, CONTRATS.decrireValeursObservees.sortie);
  assert.ok(violations.some((x) => /undefined \(hors vocabulaire\)/.test(x)), 'le cas est signalé comme non couvert, pas masqué');
  assert.equal(JSON.stringify(sortie).includes('"a"'), true);
  assert.deepEqual(conformite(JSON.parse(JSON.stringify(sortie)), CONTRATS.decrireValeursObservees.sortie), [], 'sur son IMAGE JSON la sortie est conforme : la clé undefined est devenue absente (peutManquer)');
});
test('G4. LIMITE : repererMotifs ignore en silence un texteRecu non chaîne, met undefined dans couverture pour un id absent, accepte options tableau ou chaîne', () => {
  assert.deepEqual(repererMotifs([{ id: 'a', texteRecu: 5 }, { id: 'b', texteRecu: 'un deux' }]), []);
  const sansId = repererMotifs([{ texteRecu: 'un deux' }, { id: 'b', texteRecu: 'un deux' }]);
  assert.equal(sansId.some((m) => m.couverture.includes(undefined)), true);
  const ok = [{ id: 'a', texteRecu: 'un deux trois' }, { id: 'b', texteRecu: 'un deux quatre' }];
  assert.doesNotThrow(() => repererMotifs(ok, []));
  assert.doesNotThrow(() => repererMotifs(ok, 'x'));
});
test('G5. LIMITE : une capacité nue tolère un rôle omis, la composition abstient ; le descripteur décrit le rôle tel que composé', () => {
  assert.deepEqual(CAPACITES.recherche.invoquer(e, { relation: 'zx' }), { sujets: [] });
});
test('G6. les limites connues restent nommées (liste figée, neuf entrées)', () => {
  assert.equal(Object.isFrozen(LIMITES_CONNUES), true);
  assert.equal(LIMITES_CONNUES.length, 9);
  for (const motif of [/capacités : les rôles/, /chaîne non vide/, /nombre fini/, /options/, /texteRecu/, /undefined explicitement PRÉSENT/, /clé présente valant undefined/, /ids dupliqués/, /capacités nues/]) assert.ok(LIMITES_CONNUES.some((l) => motif.test(l)), String(motif));
});

// ============================================================================ H. DISCIPLINE : SOURCE UNIQUE, OUTIL DE TESTS SEULEMENT
function fichiersJs(dossier, sortie = []) {
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) { if (nom !== 'node_modules') fichiersJs(chemin, sortie); } else if (nom.endsWith('.js')) sortie.push(chemin);
  }
  return sortie;
}
test('H1. aucun fichier de production n\'importe ni ne nomme l\'outil de tests contrats-observes', () => {
  for (const f of [...fichiersJs(join(RACINE, 'app')), join(RACINE, 'sw.js'), join(RACINE, 'worker.js'), join(RACINE, 'index.html')]) {
    let src; try { src = readFileSync(f, 'utf8'); } catch { continue; }
    assert.equal(/contrats-observes/.test(src), false, relative(RACINE, f));
  }
});
test('H2. SOURCE UNIQUE : les tests de v0.62.7 et v0.62.8 prennent leurs contrats dans cet outil, et cet outil ne redéclare AUCUNE description de primitive qui vit en production', () => {
  for (const f of ['garantie-forme.test.mjs', 'formes-operation.test.mjs']) {
    const src = lu('tests', f);
    assert.match(src, /import \{ CONTRATS \} from '\.\/contrats-observes\.mjs';/, f);
    assert.equal(/ok: sc\('booleen'\)/.test(src), false, `${f} : plus de ok fictif`);
    assert.equal(/operation\('(recherche|deduction|decrireValeursObservees|decrireStructureIdentifiee|repererMotifs|couvrirSequence)'/.test(src), false, `${f} : aucun contrat réel redéfini`);
  }
  const outil = lu('tests', 'contrats-observes.mjs');
  assert.match(outil, /import \{ DESCRIPTIONS_OPERATIONS \} from '\.\.\/app\/langage\/descriptions-operations\.js';/);
  for (const nom of DESCRIPTIONS_OPERATIONS.map((d) => d.nom)) assert.equal(new RegExp(`contrat\\('${nom}'`).test(outil), false, `${nom} ne doit pas être redéclaré dans l'outil`);
  for (const nom of DESCRIPTIONS_OPERATIONS.map((d) => d.nom)) {
    assert.equal(CONTRATS[nom], DESCRIPTIONS[nom], `${nom} : le contrat est l'objet de production lui-même`);
    assert.equal(nom in CONTRATS_LOCAUX, false, `${nom} ne doit pas exister en double dans les contrats locaux`);
  }
});
test('H3. ce que protégeait « cinq fonctions » : aucune capacité ni fonction non encore décrite n\'entre par la porte de l\'outil ; les contrats locaux (capacités et repererMotifs) et les descriptions de production restent DEUX ensembles disjoints', () => {
  assert.deepEqual(Object.keys(CONTRATS_LOCAUX).sort(), ['deduction', 'recherche', 'repererMotifs']);
  // MISE À JOUR DÉLIBÉRÉE v0.63.38 : symbolesDeChaine s'ajoute aux descriptions de production (dix noms) et donc à OPS (treize noms). Rien d'autre n'entre.
  assert.deepEqual(Object.keys(DESCRIPTIONS).sort(), ['composerCollection', 'couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'elementsObservables', 'memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'produireSuitesFermees', 'projeterChemins', 'projeterContenus', 'rechercherSousSuites', 'resoudreCouverture', 'resoudreElements', 'symbolesDeChaine']); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements (après resoudreCouverture) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : + composerCollection
  assert.deepEqual([...OPS].sort(), ['composerCollection', 'couvrirSequence', 'decrireStructureIdentifiee', 'decrireValeursObservees', 'deduction', 'elementsObservables', 'memesCouvertures', 'normaliserCouverture', 'parcourirStructure', 'partagerCouvertures', 'produireConstatsStructurels', 'produireSuitesFermees', 'projeterChemins', 'projeterContenus', 'recherche', 'rechercherSousSuites', 'repererMotifs', 'resoudreCouverture', 'resoudreElements', 'symbolesDeChaine']); // MISE À JOUR DÉLIBÉRÉE v0.63.47 : + resoudreElements (après resoudreCouverture) // MISE À JOUR DÉLIBÉRÉE v0.63.67 : + composerCollection
  // MISE À JOUR DÉLIBÉRÉE v0.63.44 : rechercherSousSuites s'ajoute aux descriptions de production (quatorze noms) et à OPS (dix-sept noms). Rien d'autre n'entre.
  // MISE À JOUR DÉLIBÉRÉE v0.63.45 : projeterChemins s'ajoute aux descriptions de production (quinze noms) et à OPS (dix-sept noms). Rien d'autre n'entre.
  // MISE À JOUR DÉLIBÉRÉE v0.63.43 : projeterContenus s'ajoute aux descriptions de production (treize noms) et à OPS (seize noms). Rien d'autre n'entre.
  for (const nom of ['confrontation', 'proprietesCommunes', 'accessibilite']) assert.equal(nom in CONTRATS, false, nom);
  for (const nom of Object.keys(DESCRIPTIONS)) assert.equal(nom in CAPACITES, false, `${nom} n'est pas une capacité`);
  for (const nom of ['recherche', 'deduction']) assert.equal(nom in DESCRIPTIONS, false, `${nom} (capacité du registre) n'entre pas dans les descriptions de production`);
});
// === FIN_TEST_CONTRATS_OBSERVES ===
